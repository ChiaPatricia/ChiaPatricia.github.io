// Just enough physics for a heap of plush toys: each toy is a soft ball that falls, piles up,
// rolls a little and rights itself, inside a glass box with a chute in one corner.
import { Quaternion, Vector3 } from 'three';

/** Half the size of the space inside the glass (x across, z front to back). The floor is y = 0. */
export const BOX = { x: 1.0, z: 0.8 };
/** The opening of the prize chute, front left. */
export const HOLE = { x0: -1.0, x1: -0.42, z0: 0.22, z1: 0.8 };
/** The clear wall around the chute. */
export const WALL = { top: 0.34, half: 0.02 };
/** Below this a toy has gone down the chute: a prize. */
export const GONE_Y = -0.45;

const GRAVITY = 9;
const SUBSTEPS = 4;

export interface Body {
  p: Vector3;
  v: Vector3;
  r: number;
  inv: number; // 1 / mass
  q: Quaternion; // how the toy is turned, for drawing only
  yaw: number; // the way it likes to face when it settles
  held: boolean; // in the claw: moved by the claw, not by gravity
  gone: boolean; // down the chute
  ground: boolean;
  still: number;
}

/** Something that pushes the toys but is moved by hand: the claw's fingers and hub. */
export interface Pusher {
  p: Vector3;
  v: Vector3;
  r: number;
}

const WALLS = [
  { min: new Vector3(HOLE.x1 - WALL.half, -1.2, HOLE.z0 - WALL.half), max: new Vector3(HOLE.x1 + WALL.half, WALL.top, BOX.z) },
  { min: new Vector3(-BOX.x, -1.2, HOLE.z0 - WALL.half), max: new Vector3(HOLE.x1 + WALL.half, WALL.top, HOLE.z0 + WALL.half) },
];

const n = new Vector3();
const rel = new Vector3();
const tmp = new Vector3();
const spin = new Quaternion();
const upright = new Quaternion();
const axis = new Vector3();
const UP = new Vector3(0, 1, 0);
const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

export function overHole(x: number, z: number, margin = 0) {
  return x > HOLE.x0 - margin && x < HOLE.x1 + margin && z > HOLE.z0 - margin && z < HOLE.z1 + margin;
}

export function body(p: Vector3, r: number, mass = 1, yaw = 0): Body {
  return { p, v: new Vector3(), r, inv: 1 / mass, q: new Quaternion().setFromAxisAngle(UP, yaw), yaw, held: false, gone: false, ground: false, still: 0 };
}

export class World {
  bodies: Body[] = [];
  pushers: Pusher[] = [];
  onGone: (b: Body) => void = () => {};

  step(dt: number) {
    const h = dt / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) {
      for (const b of this.bodies) {
        if (b.held || b.gone) continue;
        b.v.y -= GRAVITY * h;
        b.p.addScaledVector(b.v, h);
        b.ground = false;
      }
      for (let pass = 0; pass < 2; pass++) {
        this.pairs();
        this.push();
        for (const b of this.bodies) if (!b.held && !b.gone) this.statics(b, h);
      }
      for (const b of this.bodies) {
        if (b.held || b.gone) continue;
        if (b.p.y < GONE_Y) {
          b.gone = true;
          this.onGone(b);
          continue;
        }
        // A toy at rest stays at rest, instead of creeping about in the heap.
        if (b.ground && b.v.lengthSq() < 0.003) {
          b.still += h;
          if (b.still > 0.2) b.v.set(0, 0, 0);
        } else b.still = 0;
      }
    }
  }

  /** Turns the toys as they roll, and lets them sit back up when they stop (they are weighted). */
  look(dt: number) {
    for (const b of this.bodies) {
      if (b.held || b.gone) continue;
      const speed = Math.hypot(b.v.x, b.v.z);
      if (speed > 0.03) {
        axis.set(b.v.z, 0, -b.v.x).multiplyScalar(1 / speed);
        spin.setFromAxisAngle(axis, (speed / b.r) * dt * 0.45);
        b.q.premultiply(spin);
      }
      upright.setFromAxisAngle(UP, b.yaw);
      b.q.slerp(upright, 1 - Math.exp(-(b.ground ? 3.2 : 0.7) * dt));
    }
  }

  private pairs() {
    const all = this.bodies;
    for (let i = 0; i < all.length; i++) {
      const a = all[i];
      if (a.gone) continue;
      for (let j = i + 1; j < all.length; j++) {
        const b = all[j];
        if (b.gone) continue;
        const wa = a.held ? 0 : a.inv;
        const wb = b.held ? 0 : b.inv;
        const w = wa + wb;
        if (w === 0) continue;
        n.subVectors(b.p, a.p);
        const reach = a.r + b.r;
        const d2 = n.lengthSq();
        if (d2 >= reach * reach) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) {
          n.set(0, 1, 0);
          d = 0;
        } else n.multiplyScalar(1 / d);
        const overlap = reach - d;
        a.p.addScaledVector(n, (-overlap * wa) / w);
        b.p.addScaledVector(n, (overlap * wb) / w);
        rel.subVectors(b.v, a.v);
        const vn = rel.dot(n);
        if (vn < 0) {
          const impulse = (-1.05 * vn) / w;
          a.v.addScaledVector(n, -impulse * wa);
          b.v.addScaledVector(n, impulse * wb);
          tmp.copy(rel).addScaledVector(n, -vn).multiplyScalar(0.3);
          a.v.addScaledVector(tmp, wa / w);
          b.v.addScaledVector(tmp, -wb / w);
        }
        if (n.y > 0.55) b.ground = true;
        else if (n.y < -0.55) a.ground = true;
      }
    }
  }

  private push() {
    for (const k of this.pushers) {
      for (const b of this.bodies) {
        if (b.held || b.gone) continue;
        n.subVectors(b.p, k.p);
        const reach = b.r + k.r;
        const d2 = n.lengthSq();
        if (d2 >= reach * reach) continue;
        let d = Math.sqrt(d2);
        if (d < 1e-6) {
          n.set(0, 1, 0);
          d = 0;
        } else n.multiplyScalar(1 / d);
        b.p.addScaledVector(n, reach - d);
        rel.subVectors(b.v, k.v);
        const vn = rel.dot(n);
        if (vn < 0) b.v.addScaledVector(n, -vn * 1.05);
        if (n.y > 0.55) b.ground = true;
      }
    }
  }

  private statics(b: Body, h: number) {
    const { p, v, r } = b;
    if (!overHole(p.x, p.z) && p.y < r) {
      p.y = r;
      if (v.y < 0) v.y *= -0.15;
      const f = Math.max(0, 1 - 6 * h);
      v.x *= f;
      v.z *= f;
      b.ground = true;
    }
    if (p.x < -BOX.x + r) {
      p.x = -BOX.x + r;
      if (v.x < 0) v.x *= -0.25;
    } else if (p.x > BOX.x - r) {
      p.x = BOX.x - r;
      if (v.x > 0) v.x *= -0.25;
    }
    if (p.z < -BOX.z + r) {
      p.z = -BOX.z + r;
      if (v.z < 0) v.z *= -0.25;
    } else if (p.z > BOX.z - r) {
      p.z = BOX.z - r;
      if (v.z > 0) v.z *= -0.25;
    }
    for (const w of WALLS) {
      tmp.set(clamp(p.x, w.min.x, w.max.x), clamp(p.y, w.min.y, w.max.y), clamp(p.z, w.min.z, w.max.z));
      n.subVectors(p, tmp);
      const d2 = n.lengthSq();
      if (d2 >= r * r) continue;
      if (d2 > 1e-10) {
        const d = Math.sqrt(d2);
        n.multiplyScalar(1 / d);
        p.addScaledVector(n, r - d);
      } else {
        p.y = w.max.y + r;
        n.set(0, 1, 0);
      }
      const vn = v.dot(n);
      if (vn < 0) v.addScaledVector(n, -vn * 1.2);
      if (n.y > 0.55) b.ground = true;
    }
  }
}

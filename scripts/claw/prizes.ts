// The plush toys, one for each collection on the photography site: a squirrel (Cache), a maple
// leaf (Turning), a duckling (Glitter: the river), a sleepy moon (Still) and a snail (Slow), and
// now and then a golden squirrel. Made from soft shapes with a velvety sheen and a small face.
import * as THREE from 'three';

export type Kind = 'squirrel' | 'leaf' | 'duck' | 'moon' | 'snail' | 'golden';

export const KINDS: Kind[] = ['squirrel', 'leaf', 'duck', 'moon', 'snail'];
export const EMOJI: Record<Kind, string> = { squirrel: '🐿️', golden: '🐿️', leaf: '🍁', duck: '🐥', moon: '🌙', snail: '🐌' };
export const RADIUS: Record<Kind, number> = { squirrel: 0.22, golden: 0.22, leaf: 0.21, duck: 0.22, moon: 0.2, snail: 0.2 };
const SIZE: Record<Kind, number> = { squirrel: 0.95, golden: 0.95, leaf: 0.93, duck: 0.95, moon: 0.9, snail: 0.96 };

const VARIANTS: Record<Kind, string[]> = {
  squirrel: ['#c9783f', '#a8907e', '#d98e4f'],
  golden: ['#ffcc4d'],
  leaf: ['#e4573d', '#f0862f', '#efaf1f'],
  duck: ['#ffe066', '#fff3d6', '#ffd09b'],
  moon: ['#ffe58a', '#fff1c4', '#ffd6a5'],
  snail: ['#7ee0b5|#ff9fd2', '#9fd3ff|#c9a6ff', '#ffd23f|#ff8fa3'],
};

export const variantCount = (kind: Kind) => VARIANTS[kind].length;

// ------------------------------------------------------------------ materials and shapes

const materials = new Map<string, THREE.Material>();

function plush(color: string) {
  let m = materials.get(color);
  if (!m) {
    const c = new THREE.Color(color);
    m = new THREE.MeshPhysicalMaterial({
      color: c,
      roughness: 0.88,
      sheen: 1,
      sheenRoughness: 0.5,
      sheenColor: new THREE.Color('#ffffff').lerp(c, 0.35),
    });
    materials.set(color, m);
  }
  return m;
}

const gold = new THREE.MeshStandardMaterial({ color: '#ffc93c', metalness: 0.9, roughness: 0.28, emissive: '#4a3000', emissiveIntensity: 0.35 });
const eyeMat = new THREE.MeshStandardMaterial({ color: '#2b1d1b', roughness: 0.18 });
const white = new THREE.MeshBasicMaterial({ color: '#ffffff' });
const blush = new THREE.MeshBasicMaterial({ color: '#ff8fa3', transparent: true, opacity: 0.6, depthWrite: false });
const ink = new THREE.MeshBasicMaterial({ color: '#3a2422' });

const geometries = new Map<string, THREE.BufferGeometry>();
function cached<T extends THREE.BufferGeometry>(key: string, make: () => T): T {
  let g = geometries.get(key) as T | undefined;
  if (!g) {
    g = make();
    geometries.set(key, g);
  }
  return g;
}
const sphere = (r: number) => cached(`s${r}`, () => new THREE.SphereGeometry(r, 24, 16));
const arc = (r: number, tube: number) => cached(`a${r}/${tube}`, () => new THREE.TorusGeometry(r, tube, 6, 14, Math.PI));

function add(g: THREE.Group, geo: THREE.BufferGeometry, mat: THREE.Material, x: number, y: number, z: number, sx = 1, sy = sx, sz = sx) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.scale.set(sx, sy, sz);
  m.castShadow = true;
  g.add(m);
  return m;
}

interface Face {
  x: number;
  y: number;
  z: number; // depth of the surface at (x, y), for flat toys
  s: number; // eye size
  gap: number; // half the distance between the eyes
  round?: { c: THREE.Vector3; r: number }; // follow a sphere instead
  sleepy?: boolean;
  eyes?: boolean;
  mouth?: boolean;
}

function face(g: THREE.Group, f: Face) {
  const at = (x: number, y: number, lift: number) => {
    let z = f.z;
    if (f.round) {
      const dx = x - f.round.c.x;
      const dy = y - f.round.c.y;
      z = f.round.c.z + Math.sqrt(Math.max(0, f.round.r ** 2 - dx * dx - dy * dy));
    }
    return [x, y, z + lift] as const;
  };
  for (const side of [-1, 1]) {
    const ex = f.x + side * f.gap;
    if (f.eyes !== false) {
      if (f.sleepy) {
        const lid = add(g, arc(f.s * 0.8, f.s * 0.24), ink, ...at(ex, f.y, 0.003));
        lid.rotation.z = Math.PI;
        lid.castShadow = false;
      } else {
        add(g, sphere(f.s), eyeMat, ...at(ex, f.y, -f.s * 0.2), 1, 1.2, 0.6).castShadow = false;
        add(g, sphere(f.s * 0.36), white, ...at(ex + f.s * 0.32, f.y + f.s * 0.45, f.s * 0.28)).castShadow = false;
      }
    }
    const cheek = add(g, sphere(f.s * 1.1), blush, ...at(f.x + side * (f.gap + f.s * 1.45), f.y - f.s * 1.55, 0.002), 1.3, 0.75, 0.22);
    cheek.castShadow = false;
  }
  if (f.mouth !== false) {
    const mouth = add(g, arc(f.s * 0.55, f.s * 0.17), ink, ...at(f.x, f.y - f.s * 1.35, 0.003));
    mouth.rotation.z = Math.PI;
    mouth.castShadow = false;
  }
}

/** A flat outline made puffy, like a cushion. */
function puffy(shape: THREE.Shape, depth = 0.06) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.045,
    bevelSize: 0.032,
    bevelSegments: 5,
    curveSegments: 10,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return geo;
}

// ------------------------------------------------------------------ the toys

function squirrel(color: string, golden: boolean) {
  const g = new THREE.Group();
  const fur = golden ? gold : plush(color);
  const cream = golden ? gold : plush('#f6e2c4');
  add(g, sphere(0.15), fur, 0, -0.07, -0.01, 1, 1.02, 0.92);
  add(g, sphere(0.1), cream, 0, -0.09, 0.075, 0.92, 1.05, 0.6);
  for (const s of [-1, 1]) add(g, sphere(0.055), fur, s * 0.085, -0.19, 0.07, 1, 0.62, 1.25);
  const tail = add(g, sphere(0.1), fur, 0, 0.03, -0.15, 0.74, 1.42, 0.74);
  tail.rotation.x = -0.38;
  add(g, sphere(0.068), fur, 0, 0.175, -0.205, 1, 0.9, 0.9);
  const head = new THREE.Vector3(0, 0.1, 0.03);
  add(g, sphere(0.115), fur, head.x, head.y, head.z);
  for (const s of [-1, 1]) {
    const ear = add(g, cached('ear', () => new THREE.ConeGeometry(0.036, 0.08, 16)), fur, s * 0.064, 0.205, 0.02);
    ear.rotation.z = -s * 0.32;
  }
  add(g, sphere(0.04), cream, 0, 0.072, 0.128, 1.25, 0.85, 0.7);
  add(g, sphere(0.014), eyeMat, 0, 0.088, 0.156).castShadow = false;
  face(g, { x: 0, y: 0.118, z: 0, s: 0.019, gap: 0.046, round: { c: head, r: 0.115 }, mouth: false });
  return g;
}

function leafShape() {
  const lobes: [number, number][] = [
    [Math.PI / 2, 0.13],
    [Math.PI / 2 + 1.05, 0.115],
    [Math.PI / 2 - 1.05, 0.115],
    [Math.PI / 2 + 2.15, 0.07],
    [Math.PI / 2 - 2.15, 0.07],
  ];
  const pts: THREE.Vector2[] = [];
  for (let i = 0; i < 90; i++) {
    const t = (i / 90) * Math.PI * 2;
    let r = 0.072;
    for (const [a, h] of lobes) {
      const d = Math.atan2(Math.sin(t - a), Math.cos(t - a));
      r += h * Math.exp(-((d / 0.3) ** 2));
    }
    pts.push(new THREE.Vector2(Math.cos(t) * r, Math.sin(t) * r - 0.02));
  }
  return new THREE.Shape(pts);
}

function leaf(color: string) {
  const g = new THREE.Group();
  add(g, cached('leaf', () => puffy(leafShape())), plush(color), 0, 0, 0);
  const stem = add(g, cached('stem', () => new THREE.CylinderGeometry(0.013, 0.016, 0.065, 10)), plush('#8a4a2b'), 0.01, -0.175, 0);
  stem.rotation.z = 0.25;
  face(g, { x: 0, y: 0.0, z: 0.077, s: 0.018, gap: 0.045 });
  return g;
}

function duck(color: string) {
  const g = new THREE.Group();
  const down = plush(color);
  const orange = plush('#ff9b3d');
  add(g, sphere(0.155), down, 0, -0.075, -0.02, 1.1, 0.92, 1.05);
  for (const s of [-1, 1]) {
    const wing = add(g, sphere(0.075), down, s * 0.15, -0.07, -0.02, 0.42, 0.78, 1.1);
    wing.rotation.z = s * 0.35;
  }
  const tail = add(g, cached('tail', () => new THREE.ConeGeometry(0.055, 0.11, 16)), down, 0, -0.01, -0.175);
  tail.rotation.x = -1.0;
  const head = new THREE.Vector3(0, 0.1, 0.035);
  add(g, sphere(0.112), down, head.x, head.y, head.z);
  add(g, sphere(0.022), down, 0.01, 0.222, 0.02, 1, 1.7, 1);
  add(g, sphere(0.046), orange, 0, 0.072, 0.14, 1.35, 0.5, 0.95);
  for (const s of [-1, 1]) add(g, sphere(0.046), orange, s * 0.07, -0.2, 0.06, 1.25, 0.34, 1.45);
  face(g, { x: 0, y: 0.125, z: 0, s: 0.019, gap: 0.048, round: { c: head, r: 0.112 }, mouth: false });
  return g;
}

/** Points along a circle from one angle to another, going the way that passes `via`. */
function arcPoints(cx: number, cy: number, r: number, from: number, to: number, via: number, n: number) {
  const tau = Math.PI * 2;
  const norm = (x: number) => ((x % tau) + tau) % tau;
  const ccw = norm(to - from);
  const dir = norm(via - from) <= ccw ? 1 : -1;
  const span = dir > 0 ? ccw : tau - ccw;
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = from + (dir * span * i) / n;
    return new THREE.Vector2(cx + r * Math.cos(t), cy + r * Math.sin(t));
  });
}

function moonShape() {
  const o = new THREE.Vector2(0.045, 0.03); // the moon
  const c = new THREE.Vector2(0.15, 0.1); // the circle that bites it
  const R0 = 0.2;
  const R1 = 0.17;
  const u = c.clone().sub(o);
  const d = u.length();
  u.multiplyScalar(1 / d);
  const a = (R0 * R0 - R1 * R1 + d * d) / (2 * d);
  const h = Math.sqrt(R0 * R0 - a * a);
  const mid = o.clone().addScaledVector(u, a);
  const i1 = new THREE.Vector2(mid.x - h * u.y, mid.y + h * u.x);
  const i2 = new THREE.Vector2(mid.x + h * u.y, mid.y - h * u.x);
  const away = Math.atan2(-u.y, -u.x);
  const outer = arcPoints(o.x, o.y, R0, Math.atan2(i1.y - o.y, i1.x - o.x), Math.atan2(i2.y - o.y, i2.x - o.x), away, 48);
  const inner = arcPoints(c.x, c.y, R1, Math.atan2(i2.y - c.y, i2.x - c.x), Math.atan2(i1.y - c.y, i1.x - c.x), away, 36);
  return new THREE.Shape([...outer, ...inner.slice(1, -1)]);
}

function moon(color: string) {
  const g = new THREE.Group();
  add(g, cached('moon', () => puffy(moonShape(), 0.07)), plush(color), 0, 0, 0);
  face(g, { x: -0.07, y: -0.04, z: 0.082, s: 0.017, gap: 0.04, sleepy: true });
  return g;
}

const shells = new Map<string, THREE.Material>();
function shellMaterial(a: string, b: string) {
  const key = `${a}|${b}`;
  let m = shells.get(key);
  if (!m) {
    const canvas = document.createElement('canvas');
    canvas.width = 8;
    canvas.height = 128;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 128);
    grad.addColorStop(0, b);
    grad.addColorStop(1, a);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 8, 128);
    const map = new THREE.CanvasTexture(canvas);
    map.colorSpace = THREE.SRGBColorSpace;
    m = new THREE.MeshPhysicalMaterial({ map, roughness: 0.85, sheen: 1, sheenRoughness: 0.5, sheenColor: new THREE.Color('#ffffff') });
    shells.set(key, m);
  }
  return m;
}

function spiral(side: number) {
  return cached(`spiral${side}`, () => {
    const pts: THREE.Vector3[] = [];
    for (let i = 0; i <= 70; i++) {
      const t = 0.4 + (i / 70) * Math.PI * 3.1;
      const rho = 0.012 + 0.0098 * t;
      const x = -0.04 + rho * Math.cos(t);
      const y = 0.0 + rho * Math.sin(t);
      const z = side * (0.104 * Math.sqrt(Math.max(0, 1 - (rho / 0.14) ** 2)) + 0.004);
      pts.push(new THREE.Vector3(x, y, z));
    }
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 90, 0.0085, 6);
  });
}

function snail(colors: string) {
  const [a, b] = colors.split('|');
  const g = new THREE.Group();
  const skin = plush('#f6dcb0');
  const bodyGeo = cached('snailBody', () => new THREE.CapsuleGeometry(0.055, 0.24, 8, 16));
  const foot = add(g, bodyGeo, skin, 0.01, -0.15, 0);
  foot.rotation.z = Math.PI / 2;
  const head = new THREE.Vector3(0.14, -0.085, 0);
  add(g, sphere(0.068), skin, head.x, head.y, head.z, 0.95, 1.08, 0.95);
  for (const s of [-1, 1]) {
    const stalk = add(g, cached('stalk', () => new THREE.CylinderGeometry(0.011, 0.013, 0.1, 8)), skin, 0.155, -0.0, s * 0.032);
    stalk.rotation.z = -0.28;
    stalk.rotation.x = s * 0.3;
    add(g, sphere(0.026), white, 0.17, 0.055, s * 0.05);
    add(g, sphere(0.012), eyeMat, 0.174, 0.057, s * 0.05 + 0.02).castShadow = false;
  }
  add(g, sphere(0.14), shellMaterial(a, b), -0.04, 0.0, 0, 1, 1, 0.74);
  const line = plush(new THREE.Color(a).lerp(new THREE.Color('#5a3a5a'), 0.35).getStyle());
  for (const side of [1, -1]) add(g, spiral(side), line, 0, 0, 0).castShadow = false;
  face(g, { x: 0.15, y: -0.075, z: 0, s: 0.016, gap: 0.03, round: { c: head, r: 0.066 }, eyes: false });
  return g;
}

export interface Plush {
  kind: Kind;
  mesh: THREE.Group;
  r: number;
}

export function makePlush(kind: Kind, variant = 0): Plush {
  const colors = VARIANTS[kind];
  const color = colors[variant % colors.length];
  const mesh =
    kind === 'squirrel' || kind === 'golden'
      ? squirrel(color, kind === 'golden')
      : kind === 'leaf'
        ? leaf(color)
        : kind === 'duck'
          ? duck(color)
          : kind === 'moon'
            ? moon(color)
            : snail(color);
  // A little smaller than the ball that stands for it, so neighbours squash rather than overlap.
  mesh.scale.setScalar(SIZE[kind]);
  const wrap = new THREE.Group();
  wrap.add(mesh);
  wrap.userData.kind = kind;
  return { kind, mesh: wrap, r: RADIUS[kind] };
}

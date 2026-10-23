// The moment a prize comes out: the toy jumps out of the prize door to the front, gold light
// opens up behind it, and a burst of sequins (亮片) flips and flashes as it falls. The sequins
// are real metal discs, so they catch the light as they turn.
import * as THREE from 'three';

function texture(size: number, draw: (ctx: CanvasRenderingContext2D, s: number) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  draw(canvas.getContext('2d')!, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

const rays = () =>
  texture(512, (ctx, s) => {
    const c = s / 2;
    const n = 18;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const w = (Math.PI / n) * (i % 2 ? 0.55 : 0.9);
      const g = ctx.createRadialGradient(c, c, 0, c, c, c);
      g.addColorStop(0, 'rgba(255,236,160,0.95)');
      g.addColorStop(0.45, 'rgba(255,196,60,0.45)');
      g.addColorStop(1, 'rgba(255,170,40,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.arc(c, c, c, a - w, a + w);
      ctx.closePath();
      ctx.fill();
    }
  });

const glow = () =>
  texture(256, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c);
    g.addColorStop(0, 'rgba(255,248,214,1)');
    g.addColorStop(0.25, 'rgba(255,210,90,0.7)');
    g.addColorStop(1, 'rgba(255,180,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
  });

// A round glint of light, with a faint flare across it.
const twinkle = () =>
  texture(128, (ctx, s) => {
    const c = s / 2;
    const g = ctx.createRadialGradient(c, c, 0, c, c, c * 0.5);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,236,170,0.75)');
    g.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, s, s);
    const flare = ctx.createLinearGradient(0, 0, s, 0);
    flare.addColorStop(0, 'rgba(255,220,140,0)');
    flare.addColorStop(0.5, 'rgba(255,240,200,0.55)');
    flare.addColorStop(1, 'rgba(255,220,140,0)');
    ctx.fillStyle = flare;
    ctx.fillRect(0, c - 1.5, s, 3);
  });

const SEQUIN_COLOURS = ['#ffd34d', '#ffc23a', '#ffe9a3', '#ff9fb3', '#7fe3ff', '#c9a6ff', '#f4f4f4'].map((c) => new THREE.Color(c));
const MAX = 280;

const easeOutCubic = (x: number) => 1 - (1 - x) ** 3;
const easeOutBack = (x: number) => 1 + 2.4 * (x - 1) ** 3 + 1.4 * (x - 1) ** 2;
const easeInBack = (x: number) => 2.4 * x ** 3 - 1.4 * x ** 2;

export class Party {
  readonly group = new THREE.Group();
  private raysMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private glowSprite: THREE.Sprite;
  private sparkles: { s: THREE.Sprite; phase: number; speed: number; size: number }[] = [];
  private sequins: THREE.InstancedMesh;
  private light = new THREE.PointLight('#ffd060', 0, 6, 1.5);
  private pos = new Float32Array(MAX * 3);
  private vel = new Float32Array(MAX * 3);
  private axes = new Float32Array(MAX * 3);
  private angle = new Float32Array(MAX);
  private spin = new Float32Array(MAX);
  private life = new Float32Array(MAX);
  private span = new Float32Array(MAX);
  private size = new Float32Array(MAX);
  private next = 0;
  private t = -1;
  private ending = -1;
  private raining = 0;
  private prize: THREE.Object3D | null = null;
  private from = new THREE.Vector3();
  private to = new THREE.Vector3();
  private scale = 1;
  private golden = false;
  private unit = 1;
  private basis = { right: new THREE.Vector3(), up: new THREE.Vector3(), back: new THREE.Vector3() };
  private m = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private sc = new THREE.Vector3();
  onDone: () => void = () => {};

  constructor(
    private camera: THREE.PerspectiveCamera,
    private calm: boolean,
  ) {
    this.raysMesh = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: rays(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }),
    );
    this.glowSprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: glow(), transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    const sparkleTex = twinkle();
    for (let i = 0; i < 26; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: sparkleTex, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
      this.sparkles.push({ s, phase: Math.random() * Math.PI * 2, speed: 2 + Math.random() * 4, size: 0.12 + Math.random() * 0.2 });
      this.group.add(s);
    }
    this.sequins = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(1, 1, 0.14, 14),
      new THREE.MeshStandardMaterial({ color: '#ffffff', metalness: 0.9, roughness: 0.18, emissive: '#2a2010', envMapIntensity: 2.6 }),
      MAX,
    );
    this.sequins.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.sequins.frustumCulled = false;
    for (let i = 0; i < MAX; i++) {
      this.sequins.setColorAt(i, SEQUIN_COLOURS[i % SEQUIN_COLOURS.length]);
      this.sequins.setMatrixAt(i, this.m.makeScale(0, 0, 0));
    }
    this.group.add(this.raysMesh, this.glowSprite, this.sequins, this.light);
    this.group.visible = false;
  }

  get active() {
    return this.t >= 0;
  }

  /** Brings `prize` from `from` (the prize door) to `to`, `scale` times bigger, and lets the gold out. */
  start(prize: THREE.Object3D, from: THREE.Vector3, to: THREE.Vector3, scale: number, golden: boolean) {
    this.prize = prize;
    this.from.copy(from);
    this.to.copy(to);
    this.scale = scale;
    this.golden = golden;
    this.t = 0;
    this.ending = -1;
    this.raining = 0;
    this.group.visible = true;
    const q = this.camera.quaternion;
    this.basis.right.set(1, 0, 0).applyQuaternion(q);
    this.basis.up.set(0, 1, 0).applyQuaternion(q);
    this.basis.back.set(0, 0, 1).applyQuaternion(q);
    this.unit = this.camera.position.distanceTo(to) * Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2));
    prize.position.copy(from);
    prize.scale.setScalar(1);
    this.raysMesh.position.copy(to).addScaledVector(this.basis.back, -0.6);
    this.glowSprite.position.copy(to).addScaledVector(this.basis.back, -0.3);
    this.light.position.copy(to).addScaledVector(this.basis.back, 0.8).addScaledVector(this.basis.up, 0.3);
    for (const sp of this.sparkles) {
      const a = Math.random() * Math.PI * 2;
      const r = this.unit * (0.32 + Math.random() * 0.55);
      sp.s.position.copy(to).addScaledVector(this.basis.right, Math.cos(a) * r * 1.2).addScaledVector(this.basis.up, Math.sin(a) * r * 0.8);
    }
  }

  /** Puts the toy away and lets the light fade. */
  end() {
    if (this.t >= 0 && this.ending < 0) this.ending = 0;
  }

  private burst(n: number, speed: number) {
    const { right, up, back } = this.basis;
    for (let k = 0; k < n; k++) {
      const i = this.next++ % MAX;
      const dir = this.v
        .set(0, 0, 0)
        .addScaledVector(right, (Math.random() * 2 - 1) * 1.1)
        .addScaledVector(up, 0.25 + Math.random() * 1.1)
        .addScaledVector(back, Math.random() * 0.7)
        .normalize();
      const s = speed * this.unit * (0.45 + Math.random() * 0.75);
      this.spawn(i, this.to, dir.multiplyScalar(s), 2.6 + Math.random() * 1.4);
    }
  }

  private shower(n: number) {
    const { right, up, back } = this.basis;
    for (let k = 0; k < n; k++) {
      const i = this.next++ % MAX;
      const at = this.v
        .copy(this.to)
        .addScaledVector(up, this.unit * (1.05 + Math.random() * 0.2))
        .addScaledVector(right, (Math.random() * 2 - 1) * this.unit * 1.6)
        .addScaledVector(back, (Math.random() * 2 - 1) * 0.4);
      const start = at.clone();
      const drift = new THREE.Vector3().addScaledVector(right, (Math.random() - 0.5) * 0.3 * this.unit).addScaledVector(up, -0.25 * this.unit);
      this.spawn(i, start, drift, 3.6 + Math.random());
    }
  }

  private spawn(i: number, at: THREE.Vector3, v: THREE.Vector3, span: number) {
    this.pos.set([at.x, at.y, at.z], i * 3);
    this.vel.set([v.x, v.y, v.z], i * 3);
    const ax = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
    this.axes.set([ax.x, ax.y, ax.z], i * 3);
    this.angle[i] = Math.random() * Math.PI;
    this.spin[i] = (8 + Math.random() * 14) * (Math.random() < 0.5 ? -1 : 1);
    this.life[i] = 0;
    this.span[i] = span;
    this.size[i] = this.unit * (0.018 + Math.random() * 0.02);
  }

  update(dt: number) {
    if (this.t < 0) return;
    this.t += dt;
    const t = this.t;
    const calm = this.calm;
    const fly = calm ? 0.45 : 0.95;

    // The toy.
    if (this.prize) {
      const u = Math.min(1, t / fly);
      const e = easeOutCubic(u);
      const p = this.prize.position;
      p.lerpVectors(this.from, this.to, e);
      if (!calm) p.addScaledVector(this.basis.up, Math.sin(Math.PI * u) * this.unit * 0.25);
      let s = 1 + (this.scale - 1) * (calm ? e : easeOutBack(u));
      if (u >= 1) p.addScaledVector(this.basis.up, Math.sin((t - fly) * 2.2) * this.unit * 0.025);
      if (this.ending >= 0) s *= 1 - easeInBack(Math.min(1, this.ending / 0.45));
      this.prize.scale.setScalar(Math.max(0.0001, s));
      this.prize.rotation.set(0, calm ? 0 : u < 1 ? (1 - e) * Math.PI * 4 : Math.sin((t - fly) * 1.4) * 0.4, 0);
    }

    // Light.
    const on = THREE.MathUtils.smoothstep(t, fly * 0.45, fly * 0.9) * (this.ending >= 0 ? 1 - Math.min(1, this.ending / 0.45) : 1);
    this.raysMesh.material.opacity = on * (this.golden ? 1 : 0.85);
    this.raysMesh.scale.setScalar(this.unit * 2.4 * (0.6 + 0.4 * on));
    this.raysMesh.quaternion.copy(this.camera.quaternion);
    if (!calm) this.raysMesh.rotateZ(t * 0.35);
    this.glowSprite.material.opacity = on * 0.9;
    this.glowSprite.scale.setScalar(this.unit * (1.3 + 0.08 * Math.sin(t * 3)));
    this.light.intensity = on * (t < fly + 0.3 ? 9 : 4);
    for (const sp of this.sparkles) {
      const k = Math.max(0, Math.sin(sp.phase + t * sp.speed));
      sp.s.material.opacity = on * k;
      sp.s.scale.setScalar(this.unit * sp.size * (0.3 + 0.7 * k));
    }

    // Sequins: two bursts, then a shower from above.
    const prev = t - dt;
    if (prev < fly * 0.6 && t >= fly * 0.6) this.burst(calm ? 50 : 150, 3.2);
    if (!calm && prev < fly + 0.25 && t >= fly + 0.25) this.burst(80, 2.2);
    if (!calm && t > fly && t < fly + 2.6 && this.ending < 0) {
      this.raining += dt * 40;
      const n = Math.floor(this.raining);
      if (n > 0) {
        this.shower(n);
        this.raining -= n;
      }
    }
    const g = this.unit * 0.9;
    let alive = false;
    for (let i = 0; i < MAX; i++) {
      const span = this.span[i];
      if (!span) continue;
      const life = (this.life[i] += dt);
      if (life >= span) {
        this.span[i] = 0;
        this.sequins.setMatrixAt(i, this.m.makeScale(0, 0, 0));
        continue;
      }
      alive = true;
      const j = i * 3;
      const drag = Math.exp(-1.3 * dt);
      this.vel[j] *= drag;
      this.vel[j + 1] = this.vel[j + 1] * drag - g * dt;
      this.vel[j + 2] *= drag;
      this.pos[j] += this.vel[j] * dt;
      this.pos[j + 1] += this.vel[j + 1] * dt;
      this.pos[j + 2] += this.vel[j + 2] * dt;
      this.angle[i] += this.spin[i] * dt;
      this.q.setFromAxisAngle(this.v.set(this.axes[j], this.axes[j + 1], this.axes[j + 2]), this.angle[i]);
      const fade = Math.min(1, (span - life) / 0.5) * Math.min(1, life / 0.08);
      this.sc.setScalar(this.size[i] * fade);
      this.m.compose(this.v.set(this.pos[j], this.pos[j + 1], this.pos[j + 2]), this.q, this.sc);
      this.sequins.setMatrixAt(i, this.m);
    }
    this.sequins.instanceMatrix.needsUpdate = true;

    if (this.ending >= 0) {
      const before = this.ending;
      this.ending += dt;
      if (before <= 0.45 && this.ending > 0.45) {
        this.prize = null;
        this.onDone();
      }
      if (this.ending > 0.45 && !alive) {
        this.t = -1;
        this.group.visible = false;
      }
    }
  }
}

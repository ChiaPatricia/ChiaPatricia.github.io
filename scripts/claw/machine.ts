// The claw machine as a 3D model: a pink cabinet, a pale blue glass box with a polka-dot back
// wall, a lit sign with chasing bulbs, a puffy heart on top, the gantry and its three-fingered claw, a control panel with a
// joystick, a button and a little LED display, a coin slot and the prize door.
// Units are roughly decimetres; the floor inside the glass is y = 0.
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { BOX, HOLE, WALL } from './physics';

export const RAIL_Y = 2.06;
export const TOP_Y = 1.76; // the claw's hub, raised
export const LIMIT = { x: 0.84, z: 0.64 }; // how far the claw can travel
export const HOME = { x: (HOLE.x0 + HOLE.x1) / 2, z: (HOLE.z0 + HOLE.z1) / 2 }; // above the chute
export const DOOR = new THREE.Vector3(-0.71, -1.06, 0.97);
export const SLOT = new THREE.Vector3(0.68, -0.6, 0.97);
export const OPEN = 0.62; // finger angles
export const SHUT = -0.12;
const PIVOT = { r: 0.07, y: -0.045 };
const TIP = new THREE.Vector2(-0.02, -0.34);
const ELBOW = new THREE.Vector2(0.06, -0.2);

const C = {
  cabinet: '#ffcfc4',
  trim: '#e4573d',
  top: '#ffc94a',
  panel: '#fff6e8',
  back: '#e6efff',
  floor: '#dff3ea',
  dark: '#2c2430',
};

// ------------------------------------------------------------------ textures drawn on a canvas

function paint(w: number, h: number, draw: (ctx: CanvasRenderingContext2D) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  draw(ctx);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

function heartPath(ctx: CanvasRenderingContext2D, x: number, y: number, s: number) {
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.62);
  ctx.bezierCurveTo(x - s * 1.25, y - s * 0.1, x - s * 0.62, y - s * 1.05, x, y - s * 0.42);
  ctx.bezierCurveTo(x + s * 0.62, y - s * 1.05, x + s * 1.25, y - s * 0.1, x, y + s * 0.62);
  ctx.closePath();
}

// Old LED digits, drawn segment by segment.
const SEGMENTS: Record<string, string> = {
  '0': 'abcdef',
  '1': 'bc',
  '2': 'abdeg',
  '3': 'abcdg',
  '4': 'bcfg',
  '5': 'acdfg',
  '6': 'acdefg',
  '7': 'abc',
  '8': 'abcdefg',
  '9': 'abcdfg',
  '-': 'g',
};

function sevenSegment(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, h: number, on: string, off: string) {
  const w = h * 0.52;
  const t = h * 0.13;
  const half = h / 2;
  ctx.save();
  ctx.transform(1, 0, -0.1, 1, h * 0.1, 0);
  for (let i = 0; i < text.length; i++) {
    const lit = SEGMENTS[text[i]] ?? '';
    const dx = x + i * (w + h * 0.17);
    const rects: Record<string, [number, number, number, number]> = {
      a: [dx + t * 0.7, y, w - t * 1.4, t],
      g: [dx + t * 0.7, y + half - t / 2, w - t * 1.4, t],
      d: [dx + t * 0.7, y + h - t, w - t * 1.4, t],
      f: [dx, y + t * 0.7, t, half - t * 1.2],
      b: [dx + w - t, y + t * 0.7, t, half - t * 1.2],
      e: [dx, y + half + t * 0.5, t, half - t * 1.2],
      c: [dx + w - t, y + half + t * 0.5, t, half - t * 1.2],
    };
    for (const [seg, [rx, ry, rw, rh]] of Object.entries(rects)) {
      ctx.fillStyle = lit.includes(seg) ? on : off;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, t / 2);
      ctx.fill();
    }
  }
  ctx.restore();
}

const SANS = 'Inter, "Noto Sans SC", system-ui, sans-serif';

function backWall() {
  return paint(512, 512, (ctx) => {
    ctx.fillStyle = C.back;
    ctx.fillRect(0, 0, 512, 512);
    for (let y = 0; y < 9; y++)
      for (let x = 0; x < 9; x++) {
        const cx = x * 64 + (y % 2 ? 32 : 0);
        const cy = y * 64;
        if ((x + y * 3) % 5 === 0) {
          ctx.fillStyle = '#ffb3c1';
          heartPath(ctx, cx, cy, 12);
          ctx.fill();
        } else {
          ctx.fillStyle = (x + y) % 3 ? '#ffffff' : '#ffc6d4';
          ctx.beginPath();
          ctx.arc(cx, cy, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
  });
}

function floorTexture() {
  return paint(512, 512, (ctx) => {
    ctx.fillStyle = C.floor;
    ctx.fillRect(0, 0, 512, 512);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    for (let y = 0; y < 16; y++)
      for (let x = 0; x < 16; x++) {
        ctx.beginPath();
        ctx.arc(x * 32 + (y % 2 ? 16 : 0), y * 32, 3, 0, Math.PI * 2);
        ctx.fill();
      }
  });
}

function holeTexture() {
  return paint(256, 256, (ctx) => {
    const g = ctx.createRadialGradient(128, 128, 20, 128, 128, 150);
    g.addColorStop(0, '#120c14');
    g.addColorStop(0.7, '#2a2030');
    g.addColorStop(1, '#4a3a4e');
    ctx.fillStyle = g;
    roundRect(ctx, 0, 0, 256, 256, 26);
    ctx.fill();
  });
}

function streaks() {
  return paint(256, 256, (ctx) => {
    ctx.clearRect(0, 0, 256, 256);
    ctx.rotate(-0.5);
    const bands: [number, number, number][] = [
      [40, 26, 0.5],
      [86, 8, 0.35],
      [190, 40, 0.28],
      [246, 10, 0.3],
    ];
    for (const [x, w, a] of bands) {
      const g = ctx.createLinearGradient(x, 0, x + w, 0);
      g.addColorStop(0, 'rgba(255,255,255,0)');
      g.addColorStop(0.5, `rgba(255,255,255,${a})`);
      g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g;
      ctx.fillRect(x, -200, w, 700);
    }
  });
}

function signTexture() {
  return paint(1024, 256, (ctx) => {
    ctx.fillStyle = '#fff7ea';
    roundRect(ctx, 6, 6, 1012, 244, 60);
    ctx.fill();
    ctx.lineWidth = 12;
    ctx.strokeStyle = C.trim;
    ctx.stroke();
    for (const [x, y, r, c] of [
      [96, 76, 26, '#ff8fa3'],
      [930, 182, 28, '#ffd35c'],
      [880, 66, 15, '#ffd35c'],
      [150, 192, 13, '#ff8fa3'],
    ] as const) {
      ctx.fillStyle = c;
      heartPath(ctx, x, y, r);
      ctx.fill();
    }
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `italic 600 58px ${SANS}`;
    ctx.fillStyle = C.trim;
    ctx.fillText('Jia’s', 268, 112);
    ctx.font = `700 150px ${SANS}`;
    ctx.lineJoin = 'round';
    ctx.lineWidth = 22;
    ctx.strokeStyle = C.trim;
    ctx.strokeText('CLAW', 580, 136);
    ctx.fillStyle = '#ffffff';
    ctx.fillText('CLAW', 580, 136);
  });
}

function label(text: string, bg: string, fg: string, w = 256, h = 96) {
  return paint(w, h, (ctx) => {
    ctx.fillStyle = bg;
    roundRect(ctx, 4, 4, w - 8, h - 8, (h - 8) / 2);
    ctx.fill();
    ctx.fillStyle = fg;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `700 ${Math.round(h * 0.5)}px ${SANS}`;
    ctx.fillText(text, w / 2, h / 2 + 2);
  });
}

function glowTexture() {
  return paint(128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(60,30,40,0.34)');
    g.addColorStop(1, 'rgba(60,30,40,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, 128, 128);
  });
}

// ------------------------------------------------------------------ the model

export interface Machine {
  root: THREE.Group;
  carriage: THREE.Mesh;
  bridge: THREE.Mesh;
  cable: THREE.Mesh;
  head: THREE.Group;
  pivots: THREE.Group[];
  stick: THREE.Group;
  button: THREE.Mesh;
  slotLight: THREE.MeshStandardMaterial;
  flap: THREE.Group;
  topper: THREE.Group;
  bulbs: THREE.MeshStandardMaterial[];
  pick: THREE.Object3D[];
  display(credits: number, time: string, blink: boolean, idle: boolean): void;
  /** Where the fingertips and elbows are, relative to the hub, for a given finger angle. */
  fingers(angle: number, out: THREE.Vector3[]): void;
  redraw(): void;
}

export function buildMachine(): Machine {
  const root = new THREE.Group();
  const std = (color: string, roughness = 0.55, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
  const chrome = new THREE.MeshStandardMaterial({ color: '#e7e9ee', metalness: 1, roughness: 0.22 });
  const trim = std(C.trim, 0.45);
  const mesh = (geo: THREE.BufferGeometry, mat: THREE.Material, x = 0, y = 0, z = 0, shadow = true) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    m.castShadow = shadow;
    m.receiveShadow = true;
    root.add(m);
    return m;
  };

  const W = 2 * (BOX.x + 0.13); // outer width
  const D = 2 * (BOX.z + 0.13);
  const GH = 2.2; // glass height

  // Cabinet below, housing above.
  mesh(new RoundedBoxGeometry(W + 0.04, 1.72, D + 0.04, 4, 0.12), std(C.cabinet, 0.6), 0, -0.86, 0, false);
  const housing = mesh(new RoundedBoxGeometry(W + 0.04, 0.66, D + 0.04, 4, 0.12), std(C.top, 0.5), 0, GH + 0.33, 0, false);
  housing.receiveShadow = false;
  mesh(new RoundedBoxGeometry(W + 0.1, 0.08, D + 0.1, 2, 0.04), trim, 0, -0.04, 0, false);
  mesh(new RoundedBoxGeometry(W + 0.1, 0.07, D + 0.1, 2, 0.035), trim, 0, GH, 0, false);
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) mesh(new THREE.CylinderGeometry(0.06, 0.06, GH, 20), trim, sx * (BOX.x + 0.1), GH / 2, sz * (BOX.z + 0.1));
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) mesh(new THREE.CylinderGeometry(0.1, 0.12, 0.09, 20), std(C.dark, 0.6), sx * (W / 2 - 0.2), -1.765, sz * (D / 2 - 0.2), false);

  // A light along the top of the glass.
  mesh(new THREE.BoxGeometry(W - 0.3, 0.03, 0.05), new THREE.MeshBasicMaterial({ color: '#fff8ee' }), 0, GH - 0.06, BOX.z + 0.05, false);

  // Inside: back wall, floor, the chute.
  const back = mesh(new THREE.PlaneGeometry(2 * BOX.x + 0.2, GH), new THREE.MeshStandardMaterial({ map: backWall(), roughness: 0.9 }), 0, GH / 2, -BOX.z - 0.06, false);
  (back.material as THREE.MeshStandardMaterial).map!.wrapS = THREE.RepeatWrapping;
  const floorShape = new THREE.Shape([
    new THREE.Vector2(-BOX.x - 0.1, BOX.z + 0.1),
    new THREE.Vector2(BOX.x + 0.1, BOX.z + 0.1),
    new THREE.Vector2(BOX.x + 0.1, -HOLE.z1 - 0.13),
    new THREE.Vector2(HOLE.x1, -HOLE.z1 - 0.13),
    new THREE.Vector2(HOLE.x1, -HOLE.z0),
    new THREE.Vector2(-BOX.x - 0.1, -HOLE.z0),
  ]);
  const floorGeo = new THREE.ShapeGeometry(floorShape);
  floorGeo.rotateX(-Math.PI / 2);
  const floorTex = floorTexture();
  floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
  floorTex.repeat.set(0.9, 0.9);
  // ShapeGeometry's UVs are its x/y in units, so the dots tile in world space.
  mesh(floorGeo, new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.95 }), 0, 0.003, 0, false).castShadow = false;
  const hole = mesh(
    new THREE.PlaneGeometry(HOLE.x1 - HOLE.x0 + 0.1, HOLE.z1 - HOLE.z0 + 0.13),
    new THREE.MeshBasicMaterial({ map: holeTexture() }),
    (HOLE.x0 + HOLE.x1) / 2 - 0.05,
    0.004,
    (HOLE.z0 + HOLE.z1) / 2 + 0.065,
    false,
  );
  hole.rotation.x = -Math.PI / 2;
  hole.receiveShadow = false;
  const acrylic = new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.28, roughness: 0.1, depthWrite: false });
  const yellow = std('#ffd35c', 0.4);
  const wallA = mesh(new THREE.BoxGeometry(0.03, WALL.top, BOX.z - HOLE.z0 + 0.13), acrylic, HOLE.x1, WALL.top / 2, (HOLE.z0 + BOX.z + 0.13) / 2, false);
  const wallB = mesh(new THREE.BoxGeometry(HOLE.x1 + BOX.x + 0.13, WALL.top, 0.03), acrylic, (HOLE.x1 - BOX.x - 0.13) / 2, WALL.top / 2, HOLE.z0, false);
  wallA.receiveShadow = wallB.receiveShadow = false;
  mesh(new THREE.BoxGeometry(0.045, 0.045, BOX.z - HOLE.z0 + 0.13), yellow, HOLE.x1, WALL.top, (HOLE.z0 + BOX.z + 0.13) / 2, false);
  mesh(new THREE.BoxGeometry(HOLE.x1 + BOX.x + 0.13, 0.045, 0.045), yellow, (HOLE.x1 - BOX.x - 0.13) / 2, WALL.top, HOLE.z0, false);

  // Glass.
  const glass = new THREE.MeshStandardMaterial({
    color: '#cbe6ff',
    transparent: true,
    opacity: 0.2,
    roughness: 0.05,
    metalness: 0.05,
    envMapIntensity: 1.8,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const front = mesh(new THREE.PlaneGeometry(W - 0.12, GH - 0.04), glass, 0, GH / 2, BOX.z + 0.11, false);
  front.receiveShadow = false;
  const shine = mesh(
    new THREE.PlaneGeometry(W - 0.12, GH - 0.04),
    new THREE.MeshBasicMaterial({ map: streaks(), transparent: true, opacity: 0.75, depthWrite: false }),
    0,
    GH / 2,
    BOX.z + 0.112,
    false,
  );
  shine.receiveShadow = false;
  for (const sx of [-1, 1]) {
    const side = mesh(new THREE.PlaneGeometry(D - 0.12, GH - 0.04), glass, sx * (BOX.x + 0.11), GH / 2, 0, false);
    side.rotation.y = Math.PI / 2;
    side.receiveShadow = false;
  }

  // Sign and bulbs.
  const signTex = signTexture();
  mesh(new THREE.PlaneGeometry(1.9, 0.475), new THREE.MeshBasicMaterial({ map: signTex, toneMapped: false }), 0, GH + 0.33, D / 2 + 0.025, false);
  const bulbs = [0, 1, 2].map(() => new THREE.MeshStandardMaterial({ color: '#fff3c4', emissive: '#ffd24a', emissiveIntensity: 1, roughness: 0.3 }));
  const bulbGeo = new THREE.SphereGeometry(0.032, 12, 8);
  let bi = 0;
  for (let i = 0; i < 11; i++) {
    const x = -1.05 + i * 0.21;
    mesh(bulbGeo, bulbs[bi++ % 3], x, GH + 0.6, D / 2 + 0.03, false);
    mesh(bulbGeo, bulbs[bi++ % 3], x, GH + 0.06, D / 2 + 0.03, false);
  }

  // A puffy heart with a face sits on top.
  const topper = new THREE.Group();
  const heartShape = new THREE.Shape();
  heartShape.moveTo(0, -0.27);
  heartShape.bezierCurveTo(-0.38, 0.0, -0.28, 0.31, 0, 0.13);
  heartShape.bezierCurveTo(0.28, 0.31, 0.38, 0.0, 0, -0.27);
  const heartGeo = new THREE.ExtrudeGeometry(heartShape, { depth: 0.09, bevelEnabled: true, bevelThickness: 0.06, bevelSize: 0.045, bevelSegments: 6, curveSegments: 24 });
  heartGeo.translate(0, 0, -0.045);
  const mascot = new THREE.Mesh(heartGeo, new THREE.MeshPhysicalMaterial({ color: '#ff7084', roughness: 0.55, sheen: 1, sheenColor: new THREE.Color('#ffd6dd') }));
  mascot.castShadow = true;
  topper.add(mascot);
  const eye = new THREE.MeshStandardMaterial({ color: '#2b1d1b', roughness: 0.2 });
  for (const s of [-1, 1]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.026, 16, 12), eye);
    e.position.set(s * 0.075, 0.03, 0.1);
    e.scale.set(1, 1.2, 0.6);
    topper.add(e);
    const shine = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' }));
    shine.position.set(s * 0.075 + 0.009, 0.042, 0.112);
    topper.add(shine);
    const c = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshBasicMaterial({ color: '#ffc2cc', transparent: true, opacity: 0.85 }));
    c.position.set(s * 0.135, -0.02, 0.094);
    c.scale.set(1.3, 0.7, 0.25);
    topper.add(c);
  }
  const smile = new THREE.Mesh(new THREE.TorusGeometry(0.022, 0.0065, 6, 14, Math.PI), new THREE.MeshBasicMaterial({ color: '#3a2422' }));
  smile.position.set(0, -0.01, 0.103);
  smile.rotation.z = Math.PI;
  topper.add(smile);
  topper.position.set(0, GH + 0.94, 0.25);
  root.add(topper);

  // The control panel, tilted towards whoever is playing.
  const panel = new THREE.Group();
  panel.position.set(0, -0.14, D / 2 + 0.24);
  panel.rotation.x = 0.3;
  root.add(panel);
  const slab = new THREE.Mesh(new RoundedBoxGeometry(W + 0.04, 0.2, 0.56, 3, 0.07), std(C.panel, 0.5));
  slab.castShadow = slab.receiveShadow = true;
  panel.add(slab);
  const panelTrim = new THREE.Mesh(new RoundedBoxGeometry(W + 0.06, 0.06, 0.6, 2, 0.03), trim);
  panelTrim.position.y = -0.1;
  panel.add(panelTrim);

  const stick = new THREE.Group();
  stick.position.set(-0.66, 0.1, 0.02);
  panel.add(stick);
  const darkMat = std(C.dark, 0.5);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.13, 0.03, 28), darkMat);
  stick.add(base);
  const lever = new THREE.Group();
  stick.add(lever);
  const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.06, 0.05, 20), std('#1c171f', 0.8));
  boot.position.y = 0.035;
  lever.add(boot);
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.22, 12), chrome);
  shaft.position.y = 0.13;
  lever.add(shaft);
  const ball = new THREE.Mesh(new THREE.SphereGeometry(0.075, 28, 20), new THREE.MeshPhysicalMaterial({ color: C.trim, roughness: 0.18, clearcoat: 1, clearcoatRoughness: 0.1 }));
  ball.position.y = 0.26;
  ball.castShadow = true;
  ball.userData.role = 'stick';
  lever.add(ball);

  const ring = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.155, 0.04, 32), chrome);
  ring.position.set(0.66, 0.1, 0.02);
  panel.add(ring);
  const capGeo = new THREE.SphereGeometry(0.125, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
  const button = new THREE.Mesh(capGeo, new THREE.MeshPhysicalMaterial({ color: '#ff6a4f', roughness: 0.2, clearcoat: 1, clearcoatRoughness: 0.08 }));
  button.scale.y = 0.5;
  button.position.set(0.66, 0.115, 0.02);
  button.userData.role = 'go';
  button.castShadow = true;
  panel.add(button);
  const goLabel = new THREE.Mesh(new THREE.CircleGeometry(0.075, 32), new THREE.MeshBasicMaterial({ map: label('GO', 'rgba(0,0,0,0)', '#ffffff', 128, 128), transparent: true, depthWrite: false }));
  goLabel.rotation.x = -Math.PI / 2;
  goLabel.position.set(0, 0.127, 0);
  button.add(goLabel);

  // The little LED display between them.
  const ledCanvas = document.createElement('canvas');
  ledCanvas.width = 512;
  ledCanvas.height = 160;
  const led = ledCanvas.getContext('2d')!;
  const ledTex = new THREE.CanvasTexture(ledCanvas);
  ledTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.2), new THREE.MeshBasicMaterial({ map: ledTex, toneMapped: false }));
  screen.rotation.x = -Math.PI / 2;
  screen.position.set(0, 0.102, 0.02);
  panel.add(screen);
  let last = '';
  const display = (credits: number, time: string, blink: boolean, idle: boolean) => {
    const key = `${credits}|${time}|${blink}|${idle}`;
    if (key === last) return;
    last = key;
    led.fillStyle = '#231a22';
    roundRect(led, 0, 0, 512, 160, 28);
    led.fill();
    led.textBaseline = 'alphabetic';
    led.font = `700 21px ${SANS}`;
    led.fillStyle = '#9a6b4d';
    led.textAlign = 'left';
    led.fillText('COIN', 40, 44);
    led.textAlign = 'right';
    led.fillText('TIME', 472, 44);
    sevenSegment(led, String(Math.min(99, credits)).padStart(2, '0'), 40, 58, 80, '#ff8a1f', 'rgba(255,138,31,0.1)');
    sevenSegment(led, blink ? '  ' : time, 366, 58, 80, '#ff8a1f', 'rgba(255,138,31,0.1)');
    if (idle) {
      led.font = `700 26px ${SANS}`;
      led.fillStyle = '#ff8a1f';
      led.textAlign = 'center';
      led.fillText('INSERT', 256, 86);
      led.fillText('COIN', 256, 118);
    }
    ledTex.needsUpdate = true;
  };

  // Coin slot.
  mesh(new RoundedBoxGeometry(0.38, 0.52, 0.05, 3, 0.04), chrome, SLOT.x, SLOT.y, SLOT.z, false).userData.role = 'coin';
  mesh(new THREE.BoxGeometry(0.04, 0.17, 0.02), std('#141014', 0.6), SLOT.x, SLOT.y + 0.08, SLOT.z + 0.026, false).userData.role = 'coin';
  const slotLight = new THREE.MeshStandardMaterial({ color: '#ff6b5a', emissive: '#ff3b2f', emissiveIntensity: 1.2 });
  mesh(new THREE.SphereGeometry(0.024, 14, 10), slotLight, SLOT.x, SLOT.y + 0.2, SLOT.z + 0.03, false);
  mesh(new THREE.PlaneGeometry(0.28, 0.105), new THREE.MeshBasicMaterial({ map: label('COIN', C.trim, '#ffffff'), transparent: true }), SLOT.x, SLOT.y - 0.14, SLOT.z + 0.027, false).userData.role = 'coin';

  // Prize door.
  mesh(new RoundedBoxGeometry(0.66, 0.52, 0.06, 3, 0.05), trim, DOOR.x, DOOR.y, DOOR.z - 0.01, false);
  mesh(new THREE.PlaneGeometry(0.52, 0.38), new THREE.MeshBasicMaterial({ color: '#1d1620' }), DOOR.x, DOOR.y, DOOR.z + 0.025, false);
  const flap = new THREE.Group();
  flap.position.set(DOOR.x, DOOR.y + 0.19, DOOR.z + 0.03);
  root.add(flap);
  const flapPane = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.38),
    new THREE.MeshStandardMaterial({ color: '#ffe9e3', transparent: true, opacity: 0.55, roughness: 0.2, side: THREE.DoubleSide }),
  );
  flapPane.position.y = -0.19;
  flap.add(flapPane);
  mesh(new THREE.PlaneGeometry(0.34, 0.12), new THREE.MeshBasicMaterial({ map: label('PRIZE', '#ffd35c', '#7a4a00'), transparent: true }), DOOR.x, DOOR.y + 0.36, DOOR.z + 0.005, false);

  // A sticker or two.
  const heart = new THREE.Shape();
  heart.moveTo(0, -0.09);
  heart.bezierCurveTo(-0.16, -0.0, -0.1, 0.12, 0, 0.05);
  heart.bezierCurveTo(0.1, 0.12, 0.16, 0.0, 0, -0.09);
  const heartMesh = mesh(new THREE.ExtrudeGeometry(heart, { depth: 0.01, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 3 }), trim, 0.06, -1.2, D / 2 + 0.02, false);
  heartMesh.rotation.z = 0.2;
  const sticker = new THREE.Mesh(
    new THREE.PlaneGeometry(0.42, 0.21),
    new THREE.MeshBasicMaterial({
      map: paint(256, 128, (ctx) => {
        ctx.fillStyle = '#ffffff';
        roundRect(ctx, 4, 4, 248, 120, 60);
        ctx.fill();
        ctx.fillStyle = C.trim;
        ctx.font = `italic 700 64px ${SANS}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('Jia', 106, 66);
        heartPath(ctx, 186, 62, 20);
        ctx.fill();
      }),
      transparent: true,
    }),
  );
  sticker.position.set(0.12, -0.92, D / 2 + 0.027);
  sticker.rotation.z = -0.12;
  root.add(sticker);

  // A soft shadow on the ground.
  const blob = mesh(new THREE.PlaneGeometry(W * 1.9, D * 1.9), new THREE.MeshBasicMaterial({ map: glowTexture(), transparent: true, depthWrite: false }), 0, -1.805, 0.1, false);
  blob.rotation.x = -Math.PI / 2;
  blob.receiveShadow = false;

  // Gantry and claw.
  for (const sz of [-1, 1]) {
    const rail = mesh(new THREE.CylinderGeometry(0.022, 0.022, 2 * BOX.x + 0.2, 12), chrome, 0, RAIL_Y, sz * (BOX.z + 0.02), false);
    rail.rotation.z = Math.PI / 2;
  }
  const bridge = mesh(new THREE.BoxGeometry(0.06, 0.045, 2 * BOX.z + 0.06), chrome, 0, RAIL_Y - 0.01, 0);
  const carriage = mesh(new RoundedBoxGeometry(0.2, 0.11, 0.2, 2, 0.04), trim, 0, RAIL_Y - 0.06, 0);
  const cable = mesh(new THREE.CylinderGeometry(0.008, 0.008, 1, 6), std('#4a4048', 0.7), 0, RAIL_Y - 0.5, 0);

  const head = new THREE.Group();
  root.add(head);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.09, 0.1, 28), chrome);
  hub.castShadow = true;
  head.add(hub);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 20, 12), trim);
  cap.position.y = 0.06;
  cap.castShadow = true;
  head.add(cap);
  const fingerGeo = new THREE.TubeGeometry(
    new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.045, -0.1, 0),
      new THREE.Vector3(ELBOW.x, ELBOW.y, 0),
      new THREE.Vector3(0.04, -0.29, 0),
      new THREE.Vector3(0.006, -0.332, 0),
      new THREE.Vector3(TIP.x, TIP.y, 0),
    ]),
    32,
    0.014,
    8,
  );
  const tipGeo = new THREE.SphereGeometry(0.022, 12, 8);
  const pivots: THREE.Group[] = [];
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * Math.PI * 2 + Math.PI / 6;
    const pivot = new THREE.Group();
    pivot.position.set(PIVOT.r * Math.cos(a), PIVOT.y, PIVOT.r * Math.sin(a));
    pivot.rotation.order = 'YZX';
    pivot.rotation.y = -a;
    const finger = new THREE.Mesh(fingerGeo, chrome);
    finger.castShadow = true;
    pivot.add(finger);
    const tip = new THREE.Mesh(tipGeo, trim);
    tip.position.set(TIP.x, TIP.y, 0);
    tip.castShadow = true;
    pivot.add(tip);
    pivot.userData.angle = a;
    head.add(pivot);
    pivots.push(pivot);
  }

  const fingers = (angle: number, out: THREE.Vector3[]) => {
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    let k = 0;
    for (const pivot of pivots) {
      const a = pivot.userData.angle as number;
      for (const p of [TIP, ELBOW]) {
        const X = p.x * c - p.y * s;
        const Y = p.x * s + p.y * c;
        out[k++].set(PIVOT.r * Math.cos(a) + X * Math.cos(a), PIVOT.y + Y, PIVOT.r * Math.sin(a) + X * Math.sin(a));
      }
    }
  };

  return {
    root,
    carriage,
    bridge,
    cable,
    head,
    pivots,
    stick: lever,
    button,
    slotLight,
    flap,
    topper,
    bulbs,
    pick: [ball, button, ...root.children.filter((o) => o.userData.role === 'coin')],
    display,
    fingers,
    redraw() {
      const sign = signTexture();
      signTex.image = sign.image;
      signTex.needsUpdate = true;
      last = '';
    },
  };
}

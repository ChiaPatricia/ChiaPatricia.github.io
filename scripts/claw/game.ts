// The claw machine (luckyjiaxu.com/claw.html). Put in a coin and the clock starts; steer with
// the joystick (or arrow keys), press GO and the claw drops, closes, lifts and carries whatever it
// holds to the chute. How firmly it holds depends on how well it was aimed and on the difficulty.
// Anything that goes down the chute comes out of the prize door, with gold and sequins, and
// counts on the leaderboard.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { T, PLUSH, HOMES, fill, homeHref, tr, type Text } from './text';
import { Board, addCatch, cleanName, mine, myName, setMyName, type Standing } from './board';
import { BOX, World, WALL, body, overHole, type Body, type Pusher } from './physics';
import { buildMachine, DOOR, HOME, LIMIT, OPEN, RAIL_Y, SHUT, SLOT, TOP_Y } from './machine';
import { EMOJI, KINDS, makePlush, variantCount, type Kind } from './prizes';
import { Party } from './fx';
import { setMuted, sfx, unlock } from './sound';

type Level = 'easy' | 'normal' | 'hard';

// grab: how far from the middle of the claw a toy can be and still be caught
// hold + align × aim: the chance it holds on; weak: chance it lets go at the top;
// slip: chance per second of dropping it on the way; sway: how much the claw swings;
// points: what a catch is worth on the leaderboard.
const LEVELS: Record<Level, { time: number; grab: number; hold: number; align: number; weak: number; slip: number; sway: number; damp: number; points: number }> = {
  easy: { time: 25, grab: 0.19, hold: 0.5, align: 0.45, weak: 0.06, slip: 0.05, sway: 0.05, damp: 2.8, points: 1 },
  normal: { time: 18, grab: 0.155, hold: 0.28, align: 0.5, weak: 0.17, slip: 0.13, sway: 0.09, damp: 1.8, points: 2 },
  hard: { time: 10, grab: 0.115, hold: 0.06, align: 0.48, weak: 0.42, slip: 0.36, sway: 0.14, damp: 1.0, points: 3 },
};

type Phase = 'idle' | 'play' | 'drop' | 'close' | 'lift' | 'carry' | 'open';

interface Toy {
  kind: Kind;
  mesh: THREE.Group;
  body: Body;
  squeeze: number;
}

const SPEED = 0.95; // claw speed while steering
const DROP = 0.9;
const LIFT = 0.75;
const CARRY = 0.8;
const FLOOR_STOP = 0.4; // the hub's lowest point: fingertips just above the floor
const GRIP = 0.2; // finger angle when closed around a toy
const MAX_COINS = 9;
const YAW = 0.3; // the machine is seen a little from the right
const TURN_LIMIT = 1.45; // how far round it can be turned either way (about 83°), to see where the claw is
const STOPS = [-1.4, -0.7, 0, 0.7, 1.4]; // the angles the turn buttons step through
const MACHINE = { top: 2.92, bottom: -1.84, width: 2.66, depth: 2.45 };
const halfWidth = (yaw: number) => 0.5 * (MACHINE.width * Math.abs(Math.cos(yaw)) + MACHINE.depth * Math.abs(Math.sin(yaw)));

const KEYS: Record<string, 'left' | 'right' | 'up' | 'down'> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowUp: 'up',
  ArrowDown: 'down',
  a: 'left',
  d: 'right',
  w: 'up',
  s: 'down',
  A: 'left',
  D: 'right',
  W: 'up',
  S: 'down',
};

declare const TESTING: boolean; // set by the build
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = () => matchMedia('(hover: hover) and (pointer: fine)').matches;

function load<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? fallback : (JSON.parse(raw) as T);
  } catch {
    return fallback;
  }
}

function save(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* nothing is remembered */
  }
}

export async function startClaw() {
  const root = document.querySelector<HTMLElement>('[data-claw]');
  if (!root) return;
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!;
  const stage = $('[data-stage]');
  const canvas = $<HTMLCanvasElement>('[data-canvas]');

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  } catch {
    root.classList.add('is-failed');
    $('[data-failed]').hidden = false;
    return;
  }

  // The machine's labels are painted with the site's fonts, so wait a moment for them.
  await Promise.race([
    Promise.all(['700 100px Inter', 'italic 600 60px Inter'].map((f) => document.fonts.load(f))).catch(() => {}),
    new Promise((r) => setTimeout(r, 1500)),
  ]);

  const calm = reduced();
  const coarse = matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(devicePixelRatio, coarse ? 1.75 : 2));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.6;
  pmrem.dispose();

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 60);
  const target = new THREE.Vector3(0, 0.8, 0);
  let dist = 12;

  scene.add(new THREE.HemisphereLight('#fff6ee', '#e6dcf4', 1.15));
  const sun = new THREE.DirectionalLight('#ffffff', 1.9);
  sun.position.set(1.6, 5.4, 5.8);
  sun.target.position.set(0, 0.5, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  Object.assign(sun.shadow.camera, { left: -1.9, right: 1.9, top: 2.1, bottom: -1.9, near: 2, far: 14 });
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.02;
  sun.shadow.radius = 3;
  scene.add(sun, sun.target);
  const lamp = new THREE.PointLight('#fff0d8', 3, 0, 2);
  lamp.position.set(0, 1.95, 0.3);
  scene.add(lamp);

  const machine = buildMachine();
  scene.add(machine.root);
  document.fonts.ready.then(() => machine.redraw());

  const party = new Party(camera, calm);
  scene.add(party.group);

  // ------------------------------------------------------------------ the toys

  const world = new World();
  let toys: Toy[] = [];
  const byBody = new Map<Body, Toy>();

  const spot = (y: number) => {
    let x = 0;
    let z = 0;
    do {
      x = (Math.random() * 2 - 1) * (BOX.x - 0.24);
      z = (Math.random() * 2 - 1) * (BOX.z - 0.24);
    } while (overHole(x, z, 0.3));
    return new THREE.Vector3(x, y, z);
  };

  const addToy = (kind: Kind, variant: number, at: THREE.Vector3) => {
    const p = makePlush(kind, variant);
    p.mesh.traverse((o) => {
      if ((o as THREE.Mesh).isMesh) o.receiveShadow = true;
    });
    const b = body(at, p.r, kind === 'golden' ? 1.3 : 1, (Math.random() - 0.5) * 1.1);
    const toy: Toy = { kind, mesh: p.mesh, body: b, squeeze: 0 };
    scene.add(p.mesh);
    world.bodies.push(b);
    toys.push(toy);
    byBody.set(b, toy);
    return toy;
  };

  const removeToy = (toy: Toy) => {
    scene.remove(toy.mesh);
    toys = toys.filter((x) => x !== toy);
    world.bodies = world.bodies.filter((b) => b !== toy.body);
    byBody.delete(toy.body);
  };

  const stock: [Kind, number][] = [];
  for (const kind of KINDS) for (let v = 0; v < 3; v++) stock.push([kind, v]);
  stock.push(['golden', 0]);
  stock.sort(() => Math.random() - 0.5);
  stock.forEach(([kind, v], i) => addToy(kind, v, spot(0.3 + i * 0.17)));
  for (let i = 0; i < 360; i++) world.step(1 / 60);
  for (const toy of toys) {
    toy.body.v.set(0, 0, 0);
    toy.body.q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), toy.body.yaw);
  }

  // ------------------------------------------------------------------ state

  let level: Level = load<Level>('jia:claw-level', 'normal');
  if (!(level in LEVELS)) level = 'normal';
  let lv = LEVELS[level];
  let phase: Phase = 'idle';
  let phaseT = 0;
  let credits = 0;
  let flying = 0;
  let time = 0;
  let lastSecond = -1;
  let cx = HOME.x;
  let cz = HOME.z;
  let vx = 0;
  let vz = 0;
  let sx = 0;
  let sz = 0;
  let svx = 0;
  let svz = 0;
  let hubY = TOP_Y;
  let hubV = 0;
  let angle = OPEN * 0.45;
  let angleTo = angle;
  let held: Toy | null = null;
  let mode: 'hold' | 'tease' | null = null;
  let slipAt = 0;
  let candidate: { toy: Toy; aim: number } | null = null;
  let outcome: 'empty' | 'slipped' | 'close' | null = null;
  let released: Toy | null = null;
  let wonRound = false;
  let celebrating = false;
  let partyToy: Toy | null = null;
  let pressT = 1;
  let flap = 0;
  let clock = 0;
  const attach = new THREE.Vector3();
  const snug = new THREE.Vector3();
  const won: Kind[] = load<Kind[]>('jia:claw', []).filter((k) => k in EMOJI);
  let manual: [THREE.Vector3, THREE.Vector3] | null = null;
  let yaw = YAW;
  let yawTo = YAW;
  let turning: { id: number; x: number; from: number } | null = null;

  // ------------------------------------------------------------------ page

  const creditsEl = $('[data-credits]');
  const toast = $('[data-toast]');
  const live = $('[data-say]');
  const card = $('[data-win]');
  const what = $('[data-what]');
  const rare = $('[data-rare]');
  const score = $('[data-score]');
  const homeLink = $<HTMLAnchorElement>('[data-home]');
  const again = $<HTMLButtonElement>('[data-again]');
  const shelf = $('[data-shelf]');
  const shelfCount = $('[data-shelf-count]');
  const soundBtn = $<HTMLButtonElement>('[data-sound]');
  const coinBtn = $<HTMLButtonElement>('[data-coin]');
  const levelBtns = [...root.querySelectorAll<HTMLButtonElement>('[data-level]')];

  let toastTimer = 0;
  const say = (text: Text | string) => {
    const words = typeof text === 'string' ? text : tr(text);
    live.textContent = words;
    toast.textContent = words;
    toast.classList.add('is-on');
    clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-on'), 2100);
  };

  const showCredits = () => {
    creditsEl.textContent = String(credits);
  };

  const renderShelf = (fresh = false) => {
    shelf.innerHTML = won
      .slice(0, 24)
      .map(
        (k, i) =>
          `<li class="${k === 'golden' ? 'is-golden' : ''}${fresh && i === 0 ? ' is-new' : ''}" style="--tilt:${((i * 37) % 17) - 8}deg" title="${tr(PLUSH[k])}"><span aria-hidden="true">${EMOJI[k]}</span><span class="visually-hidden">${tr(PLUSH[k])}</span></li>`,
      )
      .join('');
    shelfCount.textContent = won.length ? `· ${won.length}` : '';
  };
  renderShelf();

  // ------------------------------------------------------------------ the leaderboard

  const board = new Board(root.dataset.boardUrl ?? '');
  const boardList = document.querySelector<HTMLOListElement>('ol[data-board]');
  const boardNote = document.querySelector<HTMLElement>('[data-board-note]');
  const nameForm = document.querySelector<HTMLFormElement>('[data-name-form]');
  const nameInput = document.querySelector<HTMLInputElement>('#claw-name') ?? document.createElement('input');
  nameInput.value = myName();
  let standing: Standing | null = null;
  let trouble = false;

  const row = (rank: string, r: { name: string; points: number; wins: number; golden: number }, me: boolean) => {
    const li = document.createElement('li');
    if (me) li.className = 'is-me';
    const cells = [
      ['rk', rank],
      ['nm', r.name || tr(T.you)],
      ['ct', fill(T.catches, { n: r.wins }) + (r.golden ? ` · ${fill(T.golden, { n: r.golden })}` : '')],
      ['pts', `${r.points} ${tr(T.pts)}`],
    ];
    for (const [cls, text] of cells) {
      const span = document.createElement('span');
      span.className = cls;
      span.textContent = text;
      if (cls === 'nm' && me && r.name) {
        const you = document.createElement('small');
        you.textContent = tr(T.you);
        span.append(' ', you);
      }
      li.append(span);
    }
    return li;
  };

  const renderBoard = () => {
    if (!boardList) return;
    const me = mine();
    const items: HTMLLIElement[] = [];
    if (board.shared && standing) {
      standing.top.forEach((r, i) => {
        const isMe = standing!.rank ? standing!.rank === i + 1 : !!me.name && r.name === me.name;
        items.push(row(i < 3 ? ['🥇', '🥈', '🥉'][i] : String(i + 1), r, isMe));
      });
      if (standing.rank && standing.rank > standing.top.length && me.points > 0) {
        const gap = document.createElement('li');
        gap.className = 'gap';
        gap.textContent = '⋯';
        items.push(gap, row(String(standing.rank), me, true));
      }
    } else if (me.points > 0) items.push(row('·', me, true));
    boardList.replaceChildren(...items);
    if (boardNote) boardNote.textContent = !board.shared ? tr(T.boardOff) : trouble ? tr(T.boardDown) : items.length ? '' : tr(T.boardNone);
  };

  const refresh = async () => {
    if (board.shared) {
      try {
        const fresh = await board.load();
        standing = { top: fresh.top, rank: standing?.rank ?? null };
        trouble = false;
      } catch {
        trouble = true;
      }
    }
    renderBoard();
  };

  /** Sends this player's score and name; returns their place on the board, if they have one. */
  const syncScore = async (): Promise<number | null> => {
    if (!board.shared || !myName()) return null;
    try {
      standing = await board.sync();
      trouble = false;
      renderBoard();
      return standing.rank;
    } catch {
      trouble = true;
      renderBoard();
      return null;
    }
  };

  nameForm?.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = cleanName(nameInput.value);
    if (!name) {
      if (boardNote) boardNote.textContent = tr(T.nameEmpty);
      nameInput.focus();
      return;
    }
    const first = !myName();
    setMyName(name);
    nameInput.value = name;
    say(first ? T.named : T.renamed);
    renderBoard();
    void syncScore();
  });
  if (boardNote && board.shared) boardNote.textContent = tr(T.boardWait);
  void refresh();
  setInterval(() => {
    if (document.visibilityState === 'visible') void refresh();
  }, 90_000);

  const setLevel = (l: Level) => {
    level = l;
    for (const b of levelBtns) b.setAttribute('aria-checked', String(b.dataset.level === l));
    save('jia:claw-level', l);
    if (phase === 'idle') lv = LEVELS[l];
  };
  setLevel(level);
  for (const b of levelBtns) b.addEventListener('click', () => setLevel(b.dataset.level as Level));

  const soundOn = load<boolean>('jia:claw-sound', true);
  soundBtn.setAttribute('aria-pressed', String(soundOn));
  setMuted(!soundOn);
  soundBtn.addEventListener('click', () => {
    const on = soundBtn.getAttribute('aria-pressed') !== 'true';
    soundBtn.setAttribute('aria-pressed', String(on));
    setMuted(!on);
    save('jia:claw-sound', on);
    if (on) {
      unlock();
      sfx.tick();
    }
  });

  // ------------------------------------------------------------------ the game

  const startRound = () => {
    if (credits <= 0 || phase !== 'idle' || celebrating) return;
    credits--;
    lv = LEVELS[level];
    time = lv.time;
    lastSecond = -1;
    phase = 'play';
    phaseT = 0;
    wonRound = false;
    outcome = null;
    root.classList.add('is-playing');
    sfx.start();
    say(T.start);
    showCredits();
  };

  const drop = () => {
    if (phase !== 'play') return;
    phase = 'drop';
    phaseT = 0;
    pressT = 0;
    sfx.press();
  };

  const go = () => {
    unlock();
    if (phase === 'play') drop();
    else if (phase === 'idle' && !celebrating) {
      pressT = 0;
      if (credits > 0) startRound();
      else {
        say(T.needCoin);
        coinBtn.animate([{ transform: 'rotate(0)' }, { transform: 'rotate(-8deg) scale(1.08)' }, { transform: 'rotate(7deg)' }, { transform: 'rotate(0)' }], { duration: 420 });
      }
    }
  };

  // A coin flies into the slot.
  const coinGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.018, 32);
  const coinMat = new THREE.MeshStandardMaterial({ color: '#ffcf4d', metalness: 1, roughness: 0.28 });
  const coins: { mesh: THREE.Mesh; u: number; done: () => void }[] = [];
  const insertCoin = () => {
    unlock();
    if (credits + flying >= MAX_COINS) {
      say(T.full);
      return;
    }
    flying++;
    const mesh = new THREE.Mesh(coinGeo, coinMat);
    mesh.castShadow = true;
    scene.add(mesh);
    coins.push({
      mesh,
      u: 0,
      done: () => {
        flying--;
        credits++;
        sfx.coin();
        if (phase === 'idle' && !celebrating) startRound();
        else say(T.saved);
        showCredits();
      },
    });
  };
  const coinFrom = SLOT.clone().add(new THREE.Vector3(0.5, 0.45, 1.5));
  const coinMid = SLOT.clone().add(new THREE.Vector3(0.25, 0.6, 0.7));
  const coinTo = SLOT.clone().add(new THREE.Vector3(0, 0.08, 0.06));
  const bez = new THREE.QuadraticBezierCurve3(coinFrom, coinMid, coinTo);

  // Where the claw would come to rest if dropped here: on top of a toy, or just above the floor.
  const contact = (x: number, z: number) => {
    let y = FLOOR_STOP;
    if (overHole(x, z, 0.12)) y = Math.max(y, WALL.top + 0.42);
    for (const toy of toys) {
      const b = toy.body;
      if (b.gone || b.held) continue;
      const dx = b.p.x - x;
      const dz = b.p.z - z;
      const R = b.r + 0.07;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R) y = Math.max(y, b.p.y + Math.sqrt(R * R - d2) + 0.035);
    }
    return y;
  };

  const findCandidate = () => {
    const hx = cx + sx;
    const hz = cz + sz;
    let best: Toy | null = null;
    let bestD = Infinity;
    for (const toy of toys) {
      const b = toy.body;
      if (b.gone || b.held) continue;
      const d = Math.hypot(b.p.x - hx, b.p.z - hz);
      const below = hubY - b.p.y;
      if (d < lv.grab && below > 0.08 && below < 0.52 && d < bestD) {
        best = toy;
        bestD = d;
      }
    }
    return best ? { toy: best, aim: 1 - bestD / lv.grab } : null;
  };

  const decide = () => {
    const c = candidate;
    candidate = null;
    if (!c) {
      outcome = 'empty';
      return;
    }
    let chance = Math.min(0.97, lv.hold + lv.align * c.aim);
    if (c.toy.kind === 'golden') chance *= 0.75;
    if (Math.random() < chance) mode = 'hold';
    else if (c.aim > 0.2) {
      mode = 'tease';
      slipAt = 0.12 + Math.random() * 0.5;
    } else {
      outcome = 'close';
      return;
    }
    held = c.toy;
    const b = held.body;
    b.held = true;
    attach.set(b.p.x - (cx + sx), b.p.y - hubY, b.p.z - (cz + sz));
    outcome = null;
  };

  const letGo = (why: 'slipped' | 'close' | null) => {
    if (!held) return;
    const b = held.body;
    b.held = false;
    b.v.set(vx + svx + (Math.random() - 0.5) * 0.25, hubV, vz + svz + (Math.random() - 0.5) * 0.25);
    released = held;
    held = null;
    mode = null;
    if (why) outcome = why;
  };

  const finish = () => {
    phase = 'idle';
    phaseT = 0;
    root.classList.remove('is-playing');
    sfx.hum(false);
    if (!wonRound) {
      say(outcome === 'empty' ? T.empty : outcome === 'slipped' ? T.slipped : T.close);
      sfx.miss();
    }
    wonRound = false;
    outcome = null;
    released = null;
    lv = LEVELS[level];
    if (credits > 0) startRound();
  };

  // ------------------------------------------------------------------ a prize

  const showcase = () => {
    const dir = new THREE.Vector3(0, coarse ? 0.36 : 0.42, 0.5).unproject(camera).sub(camera.position).normalize();
    const d = dist * 0.55;
    const at = camera.position.clone().addScaledVector(dir, d);
    const visible = 2 * d * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    return { at, scale: (0.24 * visible) / 0.45 };
  };

  const showCard = (toy: Toy, points: number) => {
    what.innerHTML = `<span class="e" aria-hidden="true">${EMOJI[toy.kind]}</span>`;
    what.append(tr(PLUSH[toy.kind]));
    rare.hidden = toy.kind !== 'golden';
    homeLink.href = homeHref(toy.kind);
    homeLink.textContent = fill(T.lives, { word: tr(HOMES[toy.kind].word) });
    score.textContent = fill(T.plus, { n: points });
    if (!myName()) {
      const sign = document.createElement('button');
      sign.type = 'button';
      sign.className = 'sign';
      sign.textContent = tr(T.sign);
      sign.addEventListener('click', () => {
        closeCard(false);
        nameInput.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' });
        nameInput.focus({ preventScroll: true });
      });
      score.append(' · ', sign);
    }
    card.hidden = false;
    say(`${tr(T.won)} ${tr(PLUSH[toy.kind])}`);
    again.focus({ preventScroll: true });
  };

  const closeCard = (more: boolean) => {
    if (card.hidden) return;
    card.hidden = true;
    party.end();
    celebrating = false;
    if (more) insertCoin();
    else if (phase === 'idle' && credits > 0) startRound();
  };
  party.onDone = () => {
    if (partyToy) removeToy(partyToy);
    partyToy = null;
  };
  $('[data-again]').addEventListener('click', () => closeCard(true));
  $('[data-keep]').addEventListener('click', () => closeCard(false));

  const restock = () => {
    const goldenHere = toys.some((x) => x.kind === 'golden' && !x.body.gone);
    const kind: Kind = !goldenHere && Math.random() < 0.1 ? 'golden' : KINDS[Math.floor(Math.random() * KINDS.length)];
    const toy = addToy(kind, Math.floor(Math.random() * variantCount(kind)), spot(1.45));
    toy.body.v.set(0, -0.4, 0);
  };

  world.onGone = (b) => {
    const toy = byBody.get(b);
    if (!toy) return;
    if (released === toy) released = null;
    if (partyToy) removeToy(partyToy);
    wonRound = true;
    celebrating = true;
    partyToy = toy;
    toy.squeeze = 0;
    won.unshift(toy.kind);
    won.length = Math.min(won.length, 60);
    save('jia:claw', won);
    renderShelf(true);
    const points = lv.points * (toy.kind === 'golden' ? 3 : 1);
    addCatch(points, toy.kind === 'golden');
    renderBoard();
    void syncScore().then((rank) => {
      if (rank && !card.hidden) score.textContent = `${fill(T.plus, { n: points })} · ${fill(T.rank, { n: rank })}`;
    });
    const { at, scale } = showcase();
    party.start(toy.mesh, DOOR.clone().add(new THREE.Vector3(0, 0, -0.1)), at, scale, toy.kind === 'golden');
    flap = 1;
    window.setTimeout(() => sfx.win(), 320);
    window.setTimeout(() => showCard(toy, points), calm ? 300 : 900);
    window.setTimeout(restock, 2400);
  };

  // ------------------------------------------------------------------ controls

  const keys = new Set<string>();
  const stickV = { x: 0, y: 0 };
  const drag = { on: false, x: 0, y: 0, sx: 0, sy: 0 };
  const pointer = { x: 0, y: 0 };
  const view = { x: 0, y: 0 };

  addEventListener('keydown', (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const el = e.target as HTMLElement;
    if (el.closest?.('input, textarea, select, [contenteditable]')) return;
    const dir = KEYS[e.key];
    if (dir) {
      keys.add(dir);
      if (phase === 'play') e.preventDefault();
      return;
    }
    if (e.key === 'Escape' && !card.hidden) {
      closeCard(false);
      return;
    }
    if (el.closest?.('button, a')) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      go();
    } else if (e.key === 'c' || e.key === 'C') insertCoin();
    else if (e.key === 'q' || e.key === 'Q') turn(1);
    else if (e.key === 'e' || e.key === 'E') turn(-1);
  });
  addEventListener('keyup', (e) => {
    const dir = KEYS[e.key];
    if (dir) keys.delete(dir);
  });
  addEventListener('blur', () => keys.clear());

  const stick = $('[data-stick]');
  const knob = $('[data-knob]');
  const moveStick = (e: PointerEvent) => {
    const r = stick.getBoundingClientRect();
    const R = r.width * 0.3;
    let dx = e.clientX - (r.left + r.width / 2);
    let dy = e.clientY - (r.top + r.height / 2);
    const l = Math.hypot(dx, dy);
    if (l > R) {
      dx *= R / l;
      dy *= R / l;
    }
    knob.style.setProperty('--kx', `${dx.toFixed(1)}px`);
    knob.style.setProperty('--ky', `${dy.toFixed(1)}px`);
    const m = Math.hypot(dx, dy) / R;
    stickV.x = m < 0.15 ? 0 : dx / R;
    stickV.y = m < 0.15 ? 0 : -dy / R;
  };
  const endStick = () => {
    stickV.x = stickV.y = 0;
    knob.style.setProperty('--kx', '0px');
    knob.style.setProperty('--ky', '0px');
    stick.classList.remove('is-held');
  };
  stick.addEventListener('pointerdown', (e) => {
    unlock();
    stick.setPointerCapture(e.pointerId);
    stick.classList.add('is-held');
    moveStick(e);
  });
  stick.addEventListener('pointermove', (e) => {
    if (stick.hasPointerCapture(e.pointerId)) moveStick(e);
  });
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);
  stick.addEventListener('lostpointercapture', endStick);

  $('[data-go]').addEventListener('click', go);
  coinBtn.addEventListener('click', insertCoin);

  // Pointing at the machine itself: the coin slot, the button and the joystick work too.
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const pickAt = (e: PointerEvent) => {
    const r = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    return ray.intersectObjects(machine.pick, false)[0]?.object.userData.role as string | undefined;
  };
  canvas.addEventListener('pointerdown', (e) => {
    const role = pickAt(e);
    if (role === 'coin') insertCoin();
    else if (role === 'go') go();
    else if (role === 'stick' && e.pointerType === 'mouse') {
      unlock();
      drag.on = true;
      drag.sx = e.clientX;
      drag.sy = e.clientY;
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    } else if (!role) {
      turning = { id: e.pointerId, x: e.clientX, from: yawTo };
      canvas.setPointerCapture(e.pointerId);
      canvas.style.cursor = 'grabbing';
    }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (turning && e.pointerId === turning.id) {
      yawTo = clamp(turning.from - (e.clientX - turning.x) * 0.008, -TURN_LIMIT, TURN_LIMIT);
      return;
    }
    if (drag.on) {
      drag.x = clamp((e.clientX - drag.sx) / 55, -1, 1);
      drag.y = clamp(-(e.clientY - drag.sy) / 55, -1, 1);
    } else if (e.pointerType === 'mouse') {
      const role = pickAt(e);
      canvas.style.cursor = role === 'stick' || !role ? 'grab' : 'pointer';
    }
  });
  const endDrag = () => {
    turning = null;
    drag.on = false;
    drag.x = drag.y = 0;
    canvas.style.cursor = '';
  };
  canvas.addEventListener('pointerup', endDrag);
  canvas.addEventListener('pointercancel', endDrag);
  canvas.addEventListener('lostpointercapture', endDrag);

  /** Turns the machine to the next angle: +1 turns it to the left (you see its right side). */
  const turn = (dir: number) => {
    const next = dir > 0 ? STOPS.find((a) => a > yawTo + 0.05) : [...STOPS].reverse().find((a) => a < yawTo - 0.05);
    if (next !== undefined) yawTo = next;
  };
  for (const b of root.querySelectorAll<HTMLButtonElement>('[data-turn]'))
    b.addEventListener('click', () => {
      unlock();
      sfx.tick();
      turn(b.dataset.turn === 'left' ? 1 : -1);
    });

  // Steering is relative to the view: the stick's up is always away from you.
  const steerX = (m: { x: number; y: number }) => m.x * Math.cos(yaw) - m.y * Math.sin(yaw);
  const steerZ = (m: { x: number; y: number }) => -m.x * Math.sin(yaw) - m.y * Math.cos(yaw);

  const tilt = !calm && finePointer();
  if (tilt)
    addEventListener('pointermove', (e) => {
      pointer.x = (e.clientX / innerWidth) * 2 - 1;
      pointer.y = (e.clientY / innerHeight) * 2 - 1;
    });

  const input = () => {
    let x = (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0) + stickV.x + drag.x;
    let y = (keys.has('up') ? 1 : 0) - (keys.has('down') ? 1 : 0) + stickV.y + drag.y;
    const l = Math.hypot(x, y);
    if (l > 1) {
      x /= l;
      y /= l;
    }
    return { x, y };
  };

  // ------------------------------------------------------------------ framing

  // Frame the machine as large as it can be without hiding behind the controls: only the
  // controls that overlap it from above or below take away room. The controls are measured when
  // the page changes size; the framing is worked out every frame, since the machine can turn.
  type Rect = { l: number; r: number; t: number; b: number };
  let room = { w: 1, h: 1, top: 0, bottom: 0, above: [] as Rect[], below: [] as Rect[] };
  const measure = () => {
    const w = stage.clientWidth;
    const h = stage.clientHeight;
    if (!w || !h) return;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const s = stage.getBoundingClientRect();
    const rel = (el: Element | null): Rect | null => {
      const r = el?.getBoundingClientRect();
      return r && r.width ? { l: r.left - s.left, r: r.right - s.left, t: r.top - s.top, b: r.bottom - s.top } : null;
    };
    const some = (list: (Rect | null)[]) => list.filter((x): x is Rect => x !== null);
    room = {
      w,
      h,
      top: (rel(document.querySelector('.site-header'))?.b ?? 0) + 6,
      bottom: h - (rel($('.coin'))?.t ?? h) + 6,
      above: some(['.claw-head', '.claw-bar'].map((q) => rel(root.querySelector(q)))),
      below: some(['.stick', '.money', '.go', ...(won.length ? ['.claw-shelf'] : [])].map((q) => rel(root.querySelector(q)))),
    };
    framing(yaw);
  };
  const framing = (angle: number) => {
    const { w, h } = room;
    let { top, bottom } = room;
    const tan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const halfH = ((MACHINE.top - MACHINE.bottom) / 2) * 1.01;
    const halfW = halfWidth(angle);
    for (let pass = 0; pass < 4; pass++) {
      const usable = Math.max(0.3, (h - top - bottom) / h);
      dist = Math.max(halfH / (tan * usable), (halfW * 1.04) / (tan * camera.aspect)) + 0.3;
      const half = (halfW * 1.06 * h) / (2 * tan * (dist - 0.3)) + 10;
      const [l, r] = [w / 2 - half, w / 2 + half];
      let moved = false;
      for (const b of room.above) if (b.r > l && b.l < r && b.b + 6 > top) (top = b.b + 6), (moved = true);
      for (const b of room.below) if (b.r > l && b.l < r && h - b.t + 6 > bottom) (bottom = h - b.t + 6), (moved = true);
      if (!moved) break;
    }
    target.set(0, (MACHINE.top + MACHINE.bottom) / 2 + ((top - bottom) * tan * dist) / h, 0.2);
  };
  new ResizeObserver(measure).observe(stage);
  measure();

  let visible = true;
  new IntersectionObserver(([e]) => (visible = e.isIntersecting)).observe(stage);

  // ------------------------------------------------------------------ every frame

  const fingerPts = Array.from({ length: 6 }, () => new THREE.Vector3());
  const pushers: Pusher[] = [{ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0.085 }, ...fingerPts.map(() => ({ p: new THREE.Vector3(), v: new THREE.Vector3(), r: 0.03 }))];
  world.pushers = pushers;
  const prev = new THREE.Vector3();
  const headQ = new THREE.Quaternion();
  const yawQ = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);
  const down = new THREE.Vector3();

  const update = (dt: number) => {
    clock += dt;
    phaseT += dt;
    const move = input();
    let tvx = 0;
    let tvz = 0;

    switch (phase) {
      case 'idle':
        angleTo = OPEN * 0.45;
        break;
      case 'play': {
        angleTo = OPEN * 0.45;
        tvx = steerX(move) * SPEED;
        tvz = steerZ(move) * SPEED;
        time -= dt;
        const sec = Math.ceil(time);
        if (sec !== lastSecond) {
          lastSecond = sec;
          if (sec <= 5 && sec > 0) sfx.tick();
          if (sec === 5) say(T.hurry);
        }
        if (time <= 0) drop();
        break;
      }
      case 'drop': {
        angleTo = OPEN;
        hubV = -DROP;
        hubY += hubV * dt;
        const stop = contact(cx + sx, cz + sz);
        if (hubY <= stop) {
          hubY = stop;
          hubV = 0;
          phase = 'close';
          phaseT = 0;
          candidate = findCandidate();
          sfx.grab();
        }
        break;
      }
      case 'close':
        angleTo = candidate ? GRIP : SHUT;
        if (phaseT > 0.55) {
          decide();
          phase = 'lift';
          phaseT = 0;
        }
        break;
      case 'lift':
        hubV = LIFT;
        hubY += hubV * dt;
        if (mode === 'tease' && phaseT > slipAt) letGo('slipped');
        if (hubY >= TOP_Y) {
          hubY = TOP_Y;
          hubV = 0;
          if (held && Math.random() < lv.weak) letGo('close');
          phase = 'carry';
          phaseT = 0;
        }
        break;
      case 'carry': {
        const dx = HOME.x - cx;
        const dz = HOME.z - cz;
        const d = Math.hypot(dx, dz);
        if (d < 0.015 && Math.hypot(vx, vz) < 0.06) {
          phase = 'open';
          phaseT = 0;
          angleTo = OPEN;
          sfx.release();
        } else {
          const s = Math.min(CARRY, d * 2.6);
          tvx = (dx / d) * s;
          tvz = (dz / d) * s;
        }
        if (held && Math.random() < lv.slip * dt) letGo('close');
        break;
      }
      case 'open': {
        angleTo = OPEN;
        if (held && phaseT > 0.12) letGo(null);
        const r = released?.body;
        if (phaseT > 3 || (phaseT > 0.9 && (!r || r.gone || r.still > 0.2 || r.p.y < 0.5))) finish();
        break;
      }
    }

    // The gantry: smooth starts and stops, and a claw that swings a little on its cable.
    const k = 1 - Math.exp(-dt / 0.22);
    const ax = (tvx - vx) * k;
    const az = (tvz - vz) * k;
    vx += ax;
    vz += az;
    cx = clamp(cx + vx * dt, -LIMIT.x, LIMIT.x);
    cz = clamp(cz + vz * dt, -LIMIT.z, LIMIT.z);
    const cableLen = Math.max(0.3, RAIL_Y - hubY);
    const spring = 9.8 / cableLen;
    const accX = ax / Math.max(dt, 1e-3);
    const accZ = az / Math.max(dt, 1e-3);
    svx += (-spring * sx - lv.damp * svx - accX * lv.sway) * dt;
    svz += (-spring * sz - lv.damp * svz - accZ * lv.sway) * dt;
    sx = clamp(sx + svx * dt, -0.14, 0.14);
    sz = clamp(sz + svz * dt, -0.14, 0.14);
    const moving = Math.hypot(vx, vz) > 0.05 || phase === 'drop' || phase === 'lift';
    sfx.hum(moving);

    angle += (angleTo - angle) * (1 - Math.exp(-dt * (phase === 'close' ? 7 : 9)));
    const hx = cx + sx;
    const hz = cz + sz;

    // The claw's hub and fingers push the toys around.
    machine.fingers(angle, fingerPts);
    pushers.forEach((p, i) => {
      prev.copy(p.p);
      if (i === 0) p.p.set(hx, hubY, hz);
      else p.p.set(hx, hubY, hz).add(fingerPts[i - 1]);
      p.v.subVectors(p.p, prev).divideScalar(Math.max(dt, 1e-3));
    });

    if (held) {
      const b = held.body;
      attach.lerp(snug.set(0, -(0.06 + b.r), 0), 1 - Math.exp(-6 * dt));
      prev.copy(b.p);
      b.p.set(hx + attach.x, hubY + attach.y, hz + attach.z);
      b.v.subVectors(b.p, prev).divideScalar(Math.max(dt, 1e-3));
      headQ.setFromEuler(machine.head.rotation);
      yawQ.setFromAxisAngle(UP, b.yaw);
      b.q.slerp(headQ.multiply(yawQ), 1 - Math.exp(-6 * dt));
    }

    world.step(dt);
    world.look(dt);

    for (const toy of toys) {
      if (toy.body.gone) continue;
      toy.squeeze += ((toy === held ? 1 : 0) - toy.squeeze) * (1 - Math.exp(-10 * dt));
      toy.mesh.position.copy(toy.body.p);
      toy.mesh.quaternion.copy(toy.body.q);
      const q = toy.squeeze;
      toy.mesh.scale.set(1 + 0.05 * q, 1 - 0.07 * q, 1 + 0.05 * q);
    }

    // Coins in flight.
    for (let i = coins.length - 1; i >= 0; i--) {
      const c = coins[i];
      c.u = Math.min(1, c.u + dt / 0.6);
      const e = 1 - (1 - c.u) ** 2;
      bez.getPoint(Math.min(1, e / 0.9), c.mesh.position);
      if (e > 0.9) c.mesh.position.z -= ((e - 0.9) / 0.1) * 0.1;
      c.mesh.rotation.set((1 - c.u) * 9, 0, (Math.PI / 2) * Math.min(1, c.u * 1.3));
      if (c.u >= 1) {
        scene.remove(c.mesh);
        coins.splice(i, 1);
        c.done();
      }
    }

    // The machine.
    machine.bridge.position.x = cx;
    machine.carriage.position.set(cx, RAIL_Y - 0.06, cz);
    machine.head.position.set(hx, hubY, hz);
    machine.head.rotation.set((sz / cableLen) * 0.9, 0, (-sx / cableLen) * 0.9);
    const topY = RAIL_Y - 0.1;
    down.set(hx - cx, hubY + 0.08 - topY, hz - cz);
    const len = down.length();
    machine.cable.position.set(cx + down.x / 2, topY + down.y / 2, cz + down.z / 2);
    machine.cable.scale.set(1, len, 1);
    machine.cable.quaternion.setFromUnitVectors(UP, down.normalize().negate());
    for (const p of machine.pivots) p.rotation.z = angle;
    machine.stick.rotation.set(steerZ(move) * 0.38, 0, -steerX(move) * 0.38);
    pressT += dt;
    const press = pressT < 0.1 ? pressT / 0.1 : Math.max(0, 1 - (pressT - 0.1) / 0.2);
    machine.button.position.y = 0.115 - 0.03 * press;
    flap = Math.max(0, flap - dt * 0.6);
    machine.flap.rotation.x = -Math.min(1, flap * 2.5) * 1.15;
    const idle = phase === 'idle' && credits === 0 && !celebrating;
    machine.slotLight.emissiveIntensity = idle ? 0.6 + 0.9 * (0.5 + 0.5 * Math.sin(clock * 6)) : 1.2;
    machine.bulbs.forEach((m, i) => {
      if (celebrating) {
        m.emissive.setHSL((clock * 1.6 + i / 3) % 1, 0.9, 0.55);
        m.emissiveIntensity = 2;
      } else {
        m.emissive.set('#ffd24a');
        m.emissiveIntensity = phase === 'idle' ? (Math.floor(clock * 5) % 3 === i ? 1.8 : 0.2) : 1.1 + 0.25 * Math.sin(clock * 9 + i * 2);
      }
    });
    const secs = phase === 'play' ? String(Math.max(0, Math.ceil(time))).padStart(2, '0') : '--';
    machine.display(credits, secs, phase === 'play' && time <= 5 && Math.floor(time * 4) % 2 === 0, idle);

    party.update(dt);

    // The camera leans a little with the pointer.
    view.x += (pointer.x - view.x) * (1 - Math.exp(-3 * dt));
    view.y += (pointer.y - view.y) * (1 - Math.exp(-3 * dt));
    if (manual) {
      camera.position.copy(manual[0]);
      camera.lookAt(manual[1]);
      return;
    }
    yaw += (yawTo - yaw) * (1 - Math.exp(-5 * dt));
    framing(yaw);
    const look = yaw + view.x * 0.07;
    camera.position.set(target.x + Math.sin(look) * dist, target.y + dist * 0.15 - view.y * 0.3, target.z + Math.cos(look) * dist);
    camera.lookAt(target);
  };

  // For testing (npm run build:claw:test): the game can be poked at from the console.
  if (TESTING)
    Object.assign(window, {
      __claw: {
        look: (pos?: number[], at?: number[]) => (manual = pos && at ? [new THREE.Vector3(...pos), new THREE.Vector3(...at)] : null),
        state: () => ({ phase, credits, cx, cz, hubY, yaw, yawTo, held: held?.kind, dist, ty: target.y, aspect: camera.aspect, w: stage.clientWidth, h: stage.clientHeight, toys: toys.map((x) => [x.kind, +x.body.p.x.toFixed(2), +x.body.p.y.toFixed(2), +x.body.p.z.toFixed(2)]) }),
        aim: (x: number, z: number) => ((cx = x), (cz = z)),
        step: (frames = 60) => {
          for (let i = 0; i < frames; i++) update(1 / 60);
          renderer.render(scene, camera);
          return phase;
        },
        coin: insertCoin,
        go,
      },
    });

  let last = performance.now();
  let first = true;
  const frame = (now: number) => {
    const dt = Math.min(1 / 30, Math.max(0, (now - last) / 1000));
    last = now;
    if (visible || first) {
      update(dt);
      renderer.render(scene, camera);
      if (first) {
        first = false;
        root.classList.add('is-ready');
      }
    }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

void startClaw();

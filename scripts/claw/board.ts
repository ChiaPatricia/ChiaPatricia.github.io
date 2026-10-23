// The leaderboard, shared by everyone who plays. It lives in a Google Sheet behind a small Apps
// Script web app (scripts/claw-leaderboard.gs); its address goes in the page's data-board-url attribute.
// Each browser gets a random id, never shown, so one player's catches add up under their name.
// Until the board is set up, this device keeps its own score.

declare const TESTING: boolean; // set by the build

export interface Row {
  name: string;
  points: number;
  wins: number;
  golden: number;
}

export interface Standing {
  top: Row[];
  rank: number | null;
}

const KEY = { id: 'jia:claw-id', name: 'jia:claw-name', points: 'jia:claw-points', wins: 'jia:claw-wins', golden: 'jia:claw-golden' };

const read = (k: string) => {
  try {
    return localStorage.getItem(k);
  } catch {
    return null;
  }
};
const write = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* private mode: nothing is kept */
  }
};

export function playerId() {
  let id = read(KEY.id);
  if (!id || !/^[a-z0-9]{12,40}$/.test(id)) {
    id = Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => (b % 36).toString(36)).join('');
    write(KEY.id, id);
  }
  return id;
}

export const cleanName = (s: string) =>
  s
    .replace(/[\u0000-\u001f\u007f<>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 16);

export const myName = () => read(KEY.name) ?? '';
export const setMyName = (name: string) => write(KEY.name, name);

/** This device's own totals. */
export function mine(): Row {
  const n = (k: string) => Math.max(0, Math.floor(Number(read(k)) || 0));
  return { name: myName(), points: n(KEY.points), wins: n(KEY.wins), golden: n(KEY.golden) };
}

export function addCatch(points: number, golden: boolean) {
  const m = mine();
  write(KEY.points, String(m.points + points));
  write(KEY.wins, String(m.wins + 1));
  if (golden) write(KEY.golden, String(m.golden + 1));
}

export class Board {
  constructor(readonly url: string) {}

  get shared() {
    return /^https:\/\/script\.google(usercontent)?\.com\//.test(this.url) || (TESTING && /^http:\/\/(localhost|127\.0\.0\.1):\d+\//.test(this.url));
  }

  async load(): Promise<Standing> {
    const r = await fetch(this.url, { cache: 'no-store' });
    if (!r.ok) throw new Error(`board ${r.status}`);
    const data = (await r.json()) as Partial<Standing>;
    return { top: data.top ?? [], rank: null };
  }

  /** Sends this device's totals and name; the sheet keeps the highest, a little at a time. */
  async sync(): Promise<Standing> {
    const m = mine();
    const r = await fetch(this.url, {
      method: 'POST',
      body: JSON.stringify({ id: playerId(), name: m.name, total: m.points, wins: m.wins, golden: m.golden }),
    });
    if (!r.ok) throw new Error(`board ${r.status}`);
    const data = (await r.json()) as Partial<Standing> & { error?: string };
    if (data.error) throw new Error(data.error);
    return { top: data.top ?? [], rank: data.rank ?? null };
  }
}

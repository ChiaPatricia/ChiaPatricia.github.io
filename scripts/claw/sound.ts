// Little arcade sounds, synthesised on the spot: nothing to download. The audio starts only
// after the first press (browsers require that), and can be switched off.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let muted = false;
let hum: { osc: OscillatorNode; gain: GainNode } | null = null;

export function setMuted(value: boolean) {
  muted = value;
  if (master && ctx) master.gain.setTargetAtTime(value ? 0 : 0.55, ctx.currentTime, 0.02);
}

export function unlock() {
  if (!ctx) {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 0.55;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

function tone(freq: number, at: number, length: number, type: OscillatorType = 'sine', volume = 0.25, glide?: number) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(glide, t + length);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(volume, t + 0.008);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + length);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + length + 0.02);
}

function noise(at: number, length: number, volume = 0.12, cutoff = 2400) {
  if (!ctx || !master) return;
  const t = ctx.currentTime + at;
  const buffer = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * length), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / data.length);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buffer;
  filter.type = 'bandpass';
  filter.frequency.value = cutoff;
  gain.gain.value = volume;
  src.connect(filter).connect(gain).connect(master);
  src.start(t);
}

export const sfx = {
  coin() {
    noise(0, 0.05, 0.15, 5200);
    tone(1975, 0.02, 0.16, 'square', 0.06);
    tone(2637, 0.1, 0.42, 'sine', 0.2);
  },
  start() {
    [523, 659, 784].forEach((f, i) => tone(f, i * 0.07, 0.16, 'square', 0.05));
  },
  press() {
    tone(180, 0, 0.08, 'triangle', 0.25, 90);
  },
  tick() {
    tone(1400, 0, 0.04, 'square', 0.035);
  },
  grab() {
    noise(0, 0.06, 0.2, 900);
    tone(240, 0, 0.09, 'square', 0.06, 120);
  },
  release() {
    tone(320, 0, 0.12, 'triangle', 0.12, 520);
  },
  thud() {
    tone(110, 0, 0.18, 'sine', 0.3, 55);
    noise(0, 0.08, 0.08, 400);
  },
  miss() {
    tone(392, 0, 0.22, 'triangle', 0.16, 370);
    tone(330, 0.22, 0.42, 'triangle', 0.16, 262);
  },
  win() {
    const notes = [523, 659, 784, 1047, 1319, 1568];
    notes.forEach((f, i) => tone(f, i * 0.075, 0.32, 'triangle', 0.16));
    tone(2093, 0.48, 0.9, 'sine', 0.12, 4186);
    for (let i = 0; i < 14; i++) tone(2400 + Math.random() * 2600, 0.5 + i * 0.06, 0.18, 'sine', 0.05);
  },
  /** The motor that drives the claw: a soft hum while anything moves. */
  hum(on: boolean) {
    if (!ctx || !master) return;
    if (on && !hum) {
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = 58;
      filter.type = 'lowpass';
      filter.frequency.value = 340;
      gain.gain.value = 0.0001;
      gain.gain.setTargetAtTime(0.045, ctx.currentTime, 0.05);
      osc.connect(filter).connect(gain).connect(master);
      osc.start();
      hum = { osc, gain };
    } else if (!on && hum) {
      const { osc, gain } = hum;
      gain.gain.setTargetAtTime(0.0001, ctx.currentTime, 0.04);
      osc.stop(ctx.currentTime + 0.25);
      hum = null;
    }
  },
};

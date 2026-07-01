// @ts-nocheck
/* ============================================================
   NIVAR audio — procedural ambient music + SFX via Web Audio API.
   No external assets (no licensing/hosting): everything is synthesized.
   Music starts on the first user gesture (autoplay policy) and can be muted.
   ============================================================ */

let ctx = null, master = null, musicBus = null, sfxBus = null, delay = null;
let started = false, musicTimer = null, step = 0, chordIdx = 0;
let muted = false;

try { muted = localStorage.getItem("nivar_muted") === "1"; } catch (e) {}

// A-minor-ish winter progression: Am · F · Cmaj · G (i–VI–III–VII)
const CHORDS = [
  [220.0, 261.63, 329.63], // Am
  [174.61, 220.0, 261.63], // F
  [261.63, 329.63, 392.0], // C
  [196.0, 246.94, 293.66], // G
];

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain(); master.gain.value = muted ? 0 : 0.85; master.connect(ctx.destination);
  musicBus = ctx.createGain(); musicBus.gain.value = 0.28;
  sfxBus = ctx.createGain(); sfxBus.gain.value = 0.6; sfxBus.connect(master);
  // shared feedback delay for ambience
  delay = ctx.createDelay(); delay.delayTime.value = 0.375;
  const fb = ctx.createGain(); fb.gain.value = 0.33;
  const wet = ctx.createGain(); wet.gain.value = 0.35;
  delay.connect(fb); fb.connect(delay); delay.connect(wet); wet.connect(master);
  musicBus.connect(master); musicBus.connect(delay);
  return ctx;
}

function tone(freq, t, dur, type, peak, dest) {
  const o = ctx.createOscillator(); o.type = type || "sine"; o.frequency.value = freq;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + 0.02);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(dest || sfxBus); o.start(t); o.stop(t + dur + 0.05);
  return o;
}

function pad(freqs, t, dur) {
  freqs.forEach((f) => [-4, 4].forEach((det) => {
    const o = ctx.createOscillator(); o.type = "triangle"; o.frequency.value = f; o.detune.value = det;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.05, t + 1.4);
    g.gain.linearRampToValueAtTime(0.05, t + dur - 1.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const lp = ctx.createBiquadFilter(); lp.type = "lowpass"; lp.frequency.value = 900;
    o.connect(lp); lp.connect(g); g.connect(musicBus); o.start(t); o.stop(t + dur + 0.1);
  }));
}

function musicStep() {
  if (!ctx) return;
  const t = ctx.currentTime + 0.04;
  const chord = CHORDS[chordIdx];
  if (step % 8 === 0) { // new bar → pad + bass
    pad(chord, t, 4.2);
    tone(chord[0] / 2, t, 3.6, "triangle", 0.06, musicBus); // soft bass
    chordIdx = (chordIdx + 1) % CHORDS.length;
  }
  // gentle arpeggio (skip some beats for space)
  if (step % 2 === 0 || Math.random() < 0.5) {
    const oct = Math.random() < 0.35 ? 2 : 1;
    const f = chord[step % chord.length] * oct;
    tone(f, t, 0.9, "sine", 0.09, musicBus);
  }
  step++;
}

function startMusic() {
  if (musicTimer || !ctx) return;
  step = 0; chordIdx = 0; musicStep();
  musicTimer = setInterval(musicStep, 500); // ~120bpm beat
}

/* ---------------- SFX ---------------- */
function blip(freqs, dur, type, peak) {
  if (!ctx || muted) return;
  const t0 = ctx.currentTime;
  freqs.forEach((f, i) => tone(f, t0 + i * (dur * 0.6), dur, type, peak || 0.28, sfxBus));
}
const SFX = {
  click: () => blip([520], 0.06, "square", 0.14),
  coin: () => blip([880, 1320], 0.12, "sine", 0.3),
  build: () => blip([392, 523, 659], 0.14, "triangle", 0.26),
  boost: () => blip([330, 494, 740, 988], 0.1, "sawtooth", 0.22),
  level: () => blip([523, 659, 784, 1046], 0.13, "square", 0.24),
  summon: () => blip([440, 587, 784], 0.16, "triangle", 0.28),
  win: () => blip([523, 659, 784, 1046], 0.18, "sawtooth", 0.26),
  lose: () => blip([220, 174], 0.22, "sawtooth", 0.24),
  reward: () => blip([784, 1046, 1318], 0.14, "sine", 0.3),
};

export const Audio = {
  /** Call from the first user gesture — unlocks + starts the music. */
  start() {
    if (started) { if (ctx && ctx.state === "suspended") ctx.resume(); return; }
    if (!ensure()) return;
    started = true;
    if (ctx.state === "suspended") ctx.resume();
    startMusic();
  },
  sfx(name) { const f = SFX[name]; if (f) { try { if (ctx && ctx.state === "suspended") ctx.resume(); f(); } catch (e) {} } },
  toggleMute() {
    muted = !muted;
    try { localStorage.setItem("nivar_muted", muted ? "1" : "0"); } catch (e) {}
    if (master) master.gain.setTargetAtTime(muted ? 0 : 0.85, ctx.currentTime, 0.05);
    return muted;
  },
  isMuted() { return muted; },
};

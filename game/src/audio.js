// All sound is synthesized with WebAudio — no audio files, no network. A tiny
// helper builds short shaped bursts: a gunshot is filtered noise plus a low thump,
// a footstep is a soft low-passed tick, a plant beep is a pure sine blip, and the
// round sting is two detuned triangles. AudioContext starts on the first user
// gesture; every call guards for a missing or suspended context so headless
// captures and muted play never throw.
export class Sfx {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.enabled = true;
    this.volume = 0.32;
  }
  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return true; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.volume;
      this.master.connect(this.ctx.destination);
    } catch { return false; }
    return true;
  }
  setVolume(v) {
    this.volume = v;
    if (this.master) this.master.gain.value = v;
  }
  // One shaped noise burst through a band-pass filter.
  noise(dur, freq, q, gain, when = 0) {
    if (!this.ensure() || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource(); src.buffer = buf;
    const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq; f.Q.value = q;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.02);
  }
  // One sine/triangle tone with a fast decay.
  tone(freq, dur, type, gain, slideTo = 0, when = 0) {
    if (!this.ensure() || !this.enabled) return;
    const t0 = this.ctx.currentTime + when;
    const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.02);
  }
  shot(kind, dist = 0) {
    // Distant shots are quieter and duller, so firefights read across the map.
    const att = Math.max(0.15, 1 - dist / 70);
    if (kind === 'sniper') { this.noise(0.22, 900, 0.7, 0.9 * att); this.tone(140, 0.18, 'sine', 0.7 * att, 45); }
    else if (kind === 'shotgun') { this.noise(0.20, 500, 0.8, 0.9 * att); this.tone(110, 0.16, 'sine', 0.6 * att, 40); }
    else if (kind === 'pistol') { this.noise(0.09, 1800, 1.2, 0.55 * att); this.tone(190, 0.08, 'sine', 0.35 * att, 70); }
    else if (kind === 'smg') { this.noise(0.08, 1400, 1.1, 0.5 * att); this.tone(170, 0.07, 'sine', 0.3 * att, 60); }
    else if (kind === 'dmr') { this.noise(0.16, 1000, 0.9, 0.8 * att); this.tone(160, 0.14, 'sine', 0.55 * att, 50); }
    else if (kind === 'lmg') { this.noise(0.11, 800, 0.9, 0.75 * att); this.tone(130, 0.11, 'sine', 0.5 * att, 48); }
    else if (kind === 'revolver') { this.noise(0.18, 700, 0.8, 0.9 * att); this.tone(120, 0.16, 'sine', 0.65 * att, 42); }
    else { this.noise(0.12, 1100, 1.0, 0.7 * att); this.tone(150, 0.10, 'sine', 0.45 * att, 55); }
  }
  dryFire() { this.tone(1400, 0.03, 'square', 0.12); }
  knifeSwing() { this.noise(0.12, 3200, 2.5, 0.18); }
  knifeHit() { this.noise(0.08, 900, 1.5, 0.4); this.tone(220, 0.08, 'sawtooth', 0.2, 110); }
  ding() { this.tone(1750, 0.09, 'sine', 0.28); this.tone(2340, 0.07, 'sine', 0.18, 0, 0.05); }
  radioBeep() { this.tone(1180, 0.06, 'sine', 0.16); this.tone(1180, 0.06, 'sine', 0.16, 0, 0.1); }
  fireCrackle() { this.noise(0.25, 500, 0.7, 0.35); this.noise(0.15, 1800, 1.5, 0.15, 0.08); }
  // Harbour ambience: low water wash with a gull cry every few seconds.
  // Started once per match; the timer guards itself if called twice.
  startAmbient() {
    if (this._ambTimer || !this.ensure()) return;
    this._ambTimer = setInterval(() => {
      if (!this.enabled || document.hidden) return;
      this.noise(1.4, 300, 0.5, 0.05);
      if (Math.random() < 0.5) this.tone(1400 + Math.random() * 500, 0.35, 'sine', 0.05, 900 + Math.random() * 400);
    }, 4000);
  }
  reload() { this.tone(500, 0.05, 'square', 0.10); this.tone(340, 0.05, 'square', 0.10, 0, 0.14); this.tone(620, 0.05, 'square', 0.12, 0, 0.34); }
  step(run) { this.noise(0.05, run ? 300 : 220, 1, run ? 0.10 : 0.07); }
  hit(head) { this.tone(head ? 1250 : 950, 0.06, 'sine', 0.22); }
  hurt() { this.tone(220, 0.14, 'sawtooth', 0.14, 110); }
  beep(final = false) { this.tone(final ? 1560 : 1180, final ? 0.12 : 0.07, 'sine', 0.22); }
  plant() { this.tone(880, 0.09, 'sine', 0.2); this.tone(1320, 0.12, 'sine', 0.2, 0, 0.12); }
  defuse() { this.tone(660, 0.09, 'sine', 0.2); this.tone(990, 0.12, 'sine', 0.2, 0, 0.12); }
  explosion() { this.noise(0.7, 160, 0.6, 1.0); this.tone(70, 0.6, 'sine', 0.8, 30); }
  flashbang() { this.noise(0.35, 2600, 0.8, 0.5); this.tone(2400, 0.3, 'sine', 0.12); }
  roundStart() { this.tone(523, 0.12, 'triangle', 0.22); this.tone(784, 0.2, 'triangle', 0.22, 0, 0.12); }
  roundWin() { this.tone(523, 0.14, 'triangle', 0.25); this.tone(659, 0.14, 'triangle', 0.25, 0, 0.14); this.tone(784, 0.26, 'triangle', 0.28, 0, 0.28); }
  roundLose() { this.tone(392, 0.16, 'triangle', 0.22); this.tone(311, 0.3, 'triangle', 0.22, 0, 0.16); }
  click() { this.tone(900, 0.04, 'square', 0.10); }
  buy() { this.tone(1046, 0.07, 'sine', 0.2); this.tone(1318, 0.1, 'sine', 0.2, 0, 0.08); }
}

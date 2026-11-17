// Harbor Heat — all sound is synthesised with WebAudio. No audio assets,
// no network: oscillators and filtered noise, started on first user input.
export class Sound {
  constructor() {
    this.ctx = null;
    this.muted = false;
    this.engineOsc = null;
    this.engineGain = null;
    this.sirenOsc = null;
    this.sirenGain = null;
    this.sirenTimer = 0;
    this.master = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.5;
      this.master.connect(this.ctx.destination);
      // Engine: a low sawtooth whose pitch follows speed.
      this.engineOsc = this.ctx.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 55;
      this.engineGain = this.ctx.createGain();
      this.engineGain.gain.value = 0;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 420;
      this.engineOsc.connect(lp); lp.connect(this.engineGain); this.engineGain.connect(this.master);
      this.engineOsc.start();
      // Siren: a sine that wails between two tones while police are near.
      this.sirenOsc = this.ctx.createOscillator();
      this.sirenOsc.type = 'sine';
      this.sirenOsc.frequency.value = 720;
      this.sirenGain = this.ctx.createGain();
      this.sirenGain.gain.value = 0;
      this.sirenOsc.connect(this.sirenGain); this.sirenGain.connect(this.master);
      this.sirenOsc.start();
    } catch { this.ctx = null; }
  }

  toggleMute() { this.muted = !this.muted; if (this.master) this.master.gain.value = this.muted ? 0 : 0.5; return this.muted; }

  setEngine(speedRatio, driving) {
    if (!this.ctx) return;
    const target = driving ? 0.035 + speedRatio * 0.075 : 0;
    this.engineGain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.08);
    this.engineOsc.frequency.setTargetAtTime(52 + speedRatio * 130, this.ctx.currentTime, 0.08);
  }

  setSiren(on, dt) {
    if (!this.ctx) return;
    this.sirenTimer += dt;
    if (!on) { this.sirenGain.gain.setTargetAtTime(0, this.ctx.currentTime, 0.1); return; }
    const f = 660 + 240 * Math.sin(this.sirenTimer * 5.2);
    this.sirenOsc.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.05);
    this.sirenGain.gain.setTargetAtTime(0.035, this.ctx.currentTime, 0.1);
  }

  blip(freq, dur = 0.08, type = 'square', vol = 0.12) {
    if (!this.ctx || this.muted) return;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
    o.connect(g); g.connect(this.master);
    o.start(); o.stop(this.ctx.currentTime + dur);
  }

  noise(dur = 0.15, vol = 0.25, freq = 1200) {
    if (!this.ctx || this.muted) return;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'bandpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.value = vol;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
  }

  shot() { this.noise(0.12, 0.3, 1800); this.blip(160, 0.07, 'square', 0.1); }
  punch() { this.noise(0.08, 0.2, 500); }
  crash() { this.noise(0.25, 0.35, 300); }
  pickup() { this.blip(880, 0.09, 'sine', 0.14); this.blip(1320, 0.12, 'sine', 0.1); }
  missionDone() {
    [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.blip(f, 0.16, 'triangle', 0.16), i * 110));
  }
  fail() { [330, 262, 196].forEach((f, i) => setTimeout(() => this.blip(f, 0.2, 'sawtooth', 0.1), i * 140)); }
  click() { this.blip(1200, 0.04, 'square', 0.08); }
}

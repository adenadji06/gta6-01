// Harbor Heat — procedural WebAudio: engine hum, sirens, gunshots, pickups.
// No audio files, no network. Everything is synthesized and guarded.
export function createAudio() {
  const api = { muted: false, ctx: null, engineOsc: null, engineGain: null, sirenOsc: null, sirenGain: null };

  api.ensure = function () {
    try {
      if (!api.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return;
        api.ctx = new AC();
        api.engineOsc = api.ctx.createOscillator();
        api.engineGain = api.ctx.createGain();
        api.engineOsc.type = 'sawtooth';
        api.engineOsc.frequency.value = 50;
        api.engineGain.gain.value = 0;
        api.engineOsc.connect(api.engineGain).connect(api.ctx.destination);
        api.engineOsc.start();
        api.sirenOsc = api.ctx.createOscillator();
        api.sirenGain = api.ctx.createGain();
        api.sirenOsc.type = 'square';
        api.sirenOsc.frequency.value = 700;
        api.sirenGain.gain.value = 0;
        api.sirenOsc.connect(api.sirenGain).connect(api.ctx.destination);
        api.sirenOsc.start();
      }
      if (api.ctx.state === 'suspended') void api.ctx.resume();
    } catch { /* audio is cosmetic; never break the game */ }
  };

  api.setEngine = function (speed01, driving) {
    if (!api.ctx || api.muted) return;
    try {
      api.engineOsc.frequency.value = 48 + speed01 * 140;
      api.engineGain.gain.value = driving ? 0.02 + speed01 * 0.035 : 0.008;
    } catch { /* ignore */ }
  };

  api.setSiren = function (on, t) {
    if (!api.ctx || api.muted) return;
    try {
      api.sirenGain.gain.value = on ? 0.016 : 0;
      if (on) api.sirenOsc.frequency.value = 660 + Math.sin(t * 5) * 220;
    } catch { /* ignore */ }
  };

  function blip(freq, dur, type, vol) {
    if (!api.ctx || api.muted) return;
    try {
      const o = api.ctx.createOscillator();
      const g = api.ctx.createGain();
      o.type = type || 'sine';
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol || 0.08, api.ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, api.ctx.currentTime + dur);
      o.connect(g).connect(api.ctx.destination);
      o.start();
      o.stop(api.ctx.currentTime + dur);
    } catch { /* ignore */ }
  }

  api.shot = function () { blip(180, 0.12, 'square', 0.10); };
  api.pickup = function () { blip(880, 0.18, 'sine', 0.09); setTimeout(() => blip(1320, 0.22, 'sine', 0.08), 90); };
  api.busted = function () { blip(220, 0.5, 'sawtooth', 0.10); };
  api.mission = function () { blip(660, 0.15, 'triangle', 0.09); setTimeout(() => blip(990, 0.3, 'triangle', 0.09), 130); };

  api.toggleMute = function () {
    api.muted = !api.muted;
    if (api.ctx) {
      try {
        api.engineGain.gain.value = 0;
        api.sirenGain.gain.value = 0;
      } catch { /* ignore */ }
    }
    return api.muted;
  };
  return api;
}

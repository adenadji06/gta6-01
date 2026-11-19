// Harbor Heat — bootstrap: canvas, loop, screen transitions, debug hooks.
import { VIEW_W, VIEW_H } from './config.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createSim } from './sim.js';
import { render } from './render.js';
import { getShotParam, stageShot } from './shots.js';

const canvas = document.getElementById('game');
canvas.width = VIEW_W;
canvas.height = VIEW_H;
const ctx = canvas.getContext('2d');

const input = createInput(canvas);
const audio = createAudio();
const sim = createSim();

window.__gameDebug = () => sim.debug();
window.__shotReady = false;

const shot = getShotParam();
if (shot) stageShot(sim, shot);

function frame(now) {
  const dt = Math.min(0.05, (now - (frame.last || now)) / 1000 || 0.016);
  frame.last = now;
  const s = sim.state;

  if (!shot) {
    if (s.screen === 'title' && input.pressed('Enter')) {
      audio.ensure();
      s.screen = 'playing';
    } else if (s.screen === 'paused' && (input.pressed('KeyP') || input.pressed('Enter'))) {
      s.screen = 'playing';
    } else if (s.screen === 'complete' && input.pressed('Enter')) {
      s.screen = 'playing';
    } else if (s.screen === 'playing' && input.pressed('KeyM')) {
      audio.toggleMute();
    }
    if (s.screen === 'playing') audio.ensure();
    sim.update(dt, input, audio);
    // Pause key is consumed inside sim.update while playing.
  }

  render(ctx, sim);
  if (shot && !window.__shotReady) window.__shotReady = true;
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

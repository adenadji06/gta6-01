// Harbor Heat — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, playing, paused, busted, wasted, failed, complete, epilogue.
//
// ?seed=N fixes the city. ?shot=start|play|chase|end (with &seed=N) stages
// that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { LANDMARKS, SAVE_KEY } from './config.js';
import { Input } from './input.js';
import { Sound } from './audio.js';
import { createGame, stepGame, STEP, toast } from './sim.js';
import { createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { startMission } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const game = createGame(seed);
const renderer = createRenderer(canvas);
const sound = new Sound();
// The shot stager drives the sim through this hook (same step the loop uses).
game.__step = (input, dt, snd) => stepGame(game, input, dt, snd);

function readSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (typeof s.cash !== 'number' || typeof s.missionIndex !== 'number') return null;
    return s;
  } catch { return null; }
}

function writeSave() {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: game.player.cash,
      missionIndex: game.missionIndex,
      missionsDone: game.missionsDone,
      bestWanted: game.stats.bestWanted,
      carsStolen: game.stats.carsStolen,
    }));
  } catch { /* storage can be off: progress then lasts this visit only */ }
}

function respawn(at) {
  const p = game.player;
  if (p.car) { p.car.driver = 'parked'; p.car.speed = 0; p.car = null; }
  p.onFoot = true;
  p.x = at.x; p.y = at.y + 40;
  p.health = 100;
  p.wanted = 0;
  p.wantedTimer = 0;
  p.bustedT = 0;
  p.ammo = 12;
  p.reserve = 60;
  game.goons.length = 0;
  game.bullets.length = 0;
  game.cam.x = p.x - 640;
  game.cam.y = p.y - 360;
}

function runShot(name) {
  const screen = stageShot(name, game);
  const save = readSave();
  let painted = 0;
  function paint() {
    renderer.draw(game, screen, save);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = new Input(canvas);
  let screen = 'title';
  let save = readSave();

  function applySave(s) {
    game.player.cash = s.cash;
    game.missionsDone = s.missionsDone || 0;
    game.stats.bestWanted = s.bestWanted || 0;
    game.stats.carsStolen = s.carsStolen || 0;
    startMission(game, s.missionIndex);
    game.saveLoaded = true;
  }

  function startFresh() {
    startMission(game, 0);
    screen = 'playing';
    sound.ensure();
  }

  function startContinued() {
    if (save) applySave(save);
    screen = 'playing';
    sound.ensure();
  }

  function toTitle() {
    save = readSave();
    screen = 'title';
  }

  // First gesture unlocks audio.
  const unlock = () => sound.ensure();
  window.addEventListener('keydown', unlock, { once: true });
  canvas.addEventListener('mousedown', unlock, { once: true });

  let accumulator = 0;
  let last = performance.now();

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    // Global keys.
    if (input.hit('KeyM')) {
      const muted = sound.toggleMute();
      toast(game, muted ? 'SOUND OFF' : 'SOUND ON', '', 1.4);
    }
    if (screen === 'title') {
      if (input.hit('Enter') || input.clicked) startContinued();
      else if (input.hit('KeyN')) startFresh();
      // The city idles behind the title.
      while (accumulator >= STEP) { stepGame(game, input, STEP, sound); accumulator -= STEP; }
    } else if (screen === 'playing') {
      if (input.hit('KeyP') || input.hit('Escape')) { screen = 'paused'; sound.setEngine(0, false); }
      else {
        while (accumulator >= STEP) {
          stepGame(game, input, STEP, sound);
          accumulator -= STEP;
          if (game.events.busted) { game.events.busted = false; game.player.cash = Math.max(0, game.player.cash - 200); writeSave(); screen = 'busted'; break; }
          if (game.events.wasted) { game.events.wasted = false; game.player.cash = Math.max(0, game.player.cash - 300); writeSave(); screen = 'wasted'; break; }
          if (game.events.missionFailed) { game.events.missionFailed = null; screen = 'failed'; break; }
          if (game.mission?.done && game.mission.epilogue) { screen = 'epilogue'; break; }
          if (game.mission?.done) { writeSave(); screen = 'complete'; break; }
        }
      }
    } else if (screen === 'complete') {
      // The city stays alive behind the banner; the mission auto-advances.
      while (accumulator >= STEP) { stepGame(game, input, STEP, sound); accumulator -= STEP; }
      if (!game.mission?.done) screen = 'playing';
    } else if (screen === 'epilogue') {
      while (accumulator >= STEP) { stepGame(game, input, STEP, sound); accumulator -= STEP; }
      if (input.hit('Enter') || input.clicked) { startMission(game, 6); screen = 'playing'; }
    } else if (screen === 'paused') {
      if (input.hit('KeyP') || input.hit('Escape') || input.clicked) screen = 'playing';
      else if (input.hit('KeyR')) { startMission(game, game.missionIndex); screen = 'playing'; }
      accumulator = 0;
    } else if (screen === 'busted') {
      if (input.hit('Enter') || input.clicked) { respawn(LANDMARKS.safehouse); screen = 'playing'; }
      accumulator = 0;
    } else if (screen === 'wasted') {
      if (input.hit('Enter') || input.clicked) { respawn(LANDMARKS.hospital); screen = 'playing'; }
      accumulator = 0;
    } else if (screen === 'failed') {
      if (input.hit('Enter') || input.clicked) { startMission(game, game.missionIndex); screen = 'playing'; }
      accumulator = 0;
    }

    renderer.draw(game, screen, save);
    input.endFrame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'playing') screen = 'paused';
  });

  // Debug hook for the playtest harness (not part of the game UI).
  window.__gameDebug = () => ({
    screen,
    cash: game.player.cash,
    wanted: game.player.wanted,
    health: Math.round(game.player.health),
    x: Math.round(game.player.x),
    y: Math.round(game.player.y),
    onFoot: game.player.onFoot,
    mission: game.mission ? `${game.mission.index + 1}/6 ${game.mission.title} — ${game.mission.objective}` : 'none',
    cars: game.cars.length,
    peds: game.peds.length,
    police: game.cars.filter((c) => c.driver === 'police').length,
    goons: game.goons.length,
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

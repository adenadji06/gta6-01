// Harbor Heat — the screenshot scenes behind ?shot=start|play|chase|end.
// Each one drives the real simulation forward from a fresh game with a
// scripted input, so the frame is what real play looks like and the same
// seed always gives the same frame. The renderer then paints it twice and
// main.js sets window.__shotReady.
import { LANDMARKS } from './config.js';
import { STEP, spawnGoon, spawnPolice } from './sim.js';
import { startMission } from './missions.js';

function fakeInput() {
  return {
    moveVec: () => ({ x: 0, y: -1 }),
    down: () => false,
    hit: () => false,
    mouseDown: false,
    mouseX: 640,
    mouseY: 300,
  };
}
const silentSound = { setEngine() {}, setSiren() {}, blip() {}, noise() {}, shot() {}, punch() {}, crash() {}, pickup() {}, missionDone() {}, fail() {}, click() {} };

function driveForward(state, seconds, input) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i++) {
    // The sim's step function lives on the game object in main.js; here we
    // call the step exported from sim.js via the state's own stepper.
    state.__step(input, STEP, silentSound);
  }
}

/**
 * Stage `state` (a fresh game from main.js) for the named shot and return
 * the screen the renderer should draw over it.
 */
export function stageShot(name, state) {
  const input = fakeInput();
  // The fresh game already toasted mission 1; staging replaces it, so the
  // frame shows exactly one mission toast — the staged one.
  state.msg.length = 0;
  if (name === 'play') {
    // Mid-chase: Jax in the orange sports car, three stars, two cruisers
    // on his tail, the Hot Delivery running with 78 seconds on the clock.
    startMission(state, 2);
    state.mission.stage = 1;
    state.mission.timer = 78;
    state.mission.objective = 'Deliver to North Hills — 78s left';
    state.mission.target = LANDMARKS.hills;
    const car = state.cars.find((c) => c.type === 'sports' && c.driver === 'parked');
    const p = state.player;
    p.x = 2096; p.y = 1280; p.angle = 0;
    if (car) {
      car.x = 2096; car.y = 1280; car.angle = 0; car.speed = 380; car.driver = 'player';
      car.color = '#ff7a3c';
      p.car = car; p.onFoot = false;
    }
    p.wanted = 3;
    p.cash = 2450;
    p.ammo = 9;
    const c1 = spawnPolice(state); c1.x = 2096 - 190; c1.y = 1280 + 16; c1.angle = 0; c1.speed = 430;
    const c2 = spawnPolice(state); c2.x = 2096 - 250; c2.y = 1280 - 44; c2.angle = 0.08; c2.speed = 415;
    driveForward(state, 1.6, input);
    state.cam.x = p.x - 640; state.cam.y = p.y - 360;
    return 'playing';
  }
  if (name === 'chase') {
    // On foot at the Marina: two goons closing in, two stars, a cruiser
    // rolling in, Jax mid-shot with the pistol out. The sim runs first;
    // the bullet and muzzle flash are placed last so they are in the frame.
    startMission(state, 1);
    const p = state.player;
    p.x = LANDMARKS.marina.x; p.y = LANDMARKS.marina.y + 60;
    p.wanted = 2;
    p.cash = 1180;
    p.ammo = 7;
    driveForward(state, 0.7, { ...input, moveVec: () => ({ x: 0, y: 0 }) });
    // Re-assert the stage after the step: the mission logic advances to
    // stage 2 on its own when it sees zero goons, and drops the $900
    // pickup — both are undone here so the frame shows the fight.
    state.mission.stage = 1;
    state.mission.objective = "Deal with the debtor's friends (2 left)";
    state.mission.target = LANDMARKS.docks;
    state.pickups = state.pickups.filter((k) => !(k.kind === 'cash' && k.amount === 900));
    const g1 = spawnGoon(state, p.x + 170, p.y - 80);
    const g2 = spawnGoon(state, p.x + 210, p.y + 90);
    g1.angle = Math.atan2(p.y - g1.y, p.x - g1.x);
    g2.angle = Math.atan2(p.y - g2.y, p.x - g2.x);
    const c1 = spawnPolice(state); c1.x = p.x - 300; c1.y = p.y + 40; c1.angle = 0; c1.speed = 300;
    p.aim = Math.atan2(g1.y - p.y, g1.x - p.x);
    state.bullets.push({ x: p.x + Math.cos(p.aim) * 22, y: p.y + Math.sin(p.aim) * 22, vx: 950 * Math.cos(p.aim), vy: 950 * Math.sin(p.aim), life: 0.9, from: 'player' });
    for (let i = 0; i < 5; i++) {
      state.parts.push({ x: p.x + Math.cos(p.aim) * 22, y: p.y + Math.sin(p.aim) * 22, vx: Math.cos(p.aim) * 140 + (state.rng() - 0.5) * 60, vy: Math.sin(p.aim) * 140 + (state.rng() - 0.5) * 60, life: 0.18, max: 0.18, color: '#ffe08a', size: 2.5 });
    }
    state.cam.x = p.x - 640; state.cam.y = p.y - 360;
    return 'playing';
  }
  if (name === 'end') {
    // The Harbor Job, done: the complete screen over a city still alive.
    startMission(state, 4);
    state.mission.done = true;
    state.mission.doneT = 0.4;
    state.mission.objective = '';
    state.player.cash = 7400;
    state.missionsDone = 5;
    driveForward(state, 1.2, { ...input, moveVec: () => ({ x: 0, y: 0 }) });
    return 'complete';
  }
  // start: the title screen over a living city.
  state.time = 2.5;
  driveForward(state, 2.5, { ...input, moveVec: () => ({ x: 0, y: 0 }) });
  return 'title';
}

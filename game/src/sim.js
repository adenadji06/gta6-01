// Harbor Heat — the simulation: player on foot and in cars, traffic, peds,
// police, combat, wanted level, pickups and particles. Rendering lives in
// render.js; the story lives in missions.js. No DOM here except none.
import {
  CAR_TYPES, LANDMARKS, PAL, ROADS_X, ROADS_Y, ROAD_W, WORLD_H, WORLD_W,
  angDiff, clamp, dist, mulberry32,
} from './config.js';
import { buildCity, buildingAt, clampToWorld, collideBuildings, inWater, nearestRoadPoint, randomRoadPoint } from './world.js';
import { startMission, updateMission } from './missions.js';

export const STEP = 1 / 60;

let nextCarId = 1;

export function createGame(seed) {
  const city = buildCity(seed);
  const rng = mulberry32(seed ^ 0x9e3779b9);
  const state = {
    seed, city, rng,
    time: 0,
    cam: { x: LANDMARKS.safehouse.x - 640, y: LANDMARKS.safehouse.y - 360 },
    player: {
      x: LANDMARKS.safehouse.x, y: LANDMARKS.safehouse.y + 40, angle: -Math.PI / 2,
      onFoot: true, car: null, health: 100, cash: 200, wanted: 0, wantedTimer: 0,
      ammo: 12, reserve: 60, reloadT: 0, punchT: 0, punchCd: 0, shootCd: 0,
      aim: 0, speed: 0, invuln: 0, bustedT: 0, walkPhase: 0, hiddenT: 0,
    },
    cars: [], peds: [], goons: [], bullets: [], pickups: [], parts: [],
    mission: null, missionIndex: 0, missionsDone: 0,
    msg: [], // toasts {text, sub, t, dur}
    stats: { carsStolen: 0, pedsHit: 0, shotsFired: 0, goonsDown: 0, bestWanted: 0, distance: 0 },
    events: { busted: false, wasted: false, missionFailed: null },
    saveLoaded: false,
  };
  // Parked cars around the safehouse and the city.
  spawnParkedCars(state, 26);
  // Traffic.
  for (let i = 0; i < 16; i++) spawnTrafficCar(state);
  // Pedestrians.
  for (let i = 0; i < 42; i++) spawnPed(state);
  startMission(state, 0);
  return state;
}

export function toast(state, text, sub = '', dur = 3.2) {
  state.msg.push({ text, sub, t: 0, dur });
  if (state.msg.length > 3) state.msg.shift();
}

export function addWanted(state, n, reason) {
  const p = state.player;
  const before = p.wanted;
  p.wanted = clamp(p.wanted + n, 0, 5);
  p.wantedTimer = 0;
  if (p.wanted > state.stats.bestWanted) state.stats.bestWanted = p.wanted;
  if (p.wanted > before) toast(state, `WANTED ${'★'.repeat(p.wanted)}`, reason, 2.6);
}

// ---- spawning --------------------------------------------------------------
const TRAFFIC_TYPES = ['sedan', 'sedan', 'taxi', 'coupe', 'truck', 'van', 'sedan', 'sports'];

export function makeCar(state, type, x, y, angle, driver) {
  const t = CAR_TYPES[type];
  const car = {
    id: nextCarId++, type, x, y, angle, speed: 0, color: t.color,
    driver, hp: 100, ai: null, police: null, honkT: 0, brakeT: 0,
  };
  if (driver === 'traffic') {
    const vertical = Math.abs(Math.sin(angle)) < 0.1 ? false : Math.abs(Math.cos(angle)) < 0.1;
    car.ai = {
      axis: vertical ? 'x' : 'y',
      line: vertical ? nearestRoadPoint(x, y).x : nearestRoadPoint(x, y).y,
      pos: vertical ? y : x,
      dir: 1, lane: (state.rng() < 0.5 ? -1 : 1) * 20,
      speed: 130 + state.rng() * 70, waitT: 0, justTurned: 0,
    };
    // Snap onto the road line.
    if (car.ai.axis === 'x') { car.x = car.ai.line + car.ai.lane; car.y = car.ai.pos; }
    else { car.x = car.ai.pos; car.y = car.ai.line + car.ai.lane; }
    car.angle = car.ai.axis === 'x' ? (car.ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (car.ai.dir > 0 ? 0 : Math.PI);
    car.speed = car.ai.speed;
  }
  state.cars.push(car);
  return car;
}

export function spawnParkedCars(state, n) {
  const types = ['sedan', 'coupe', 'sports', 'taxi', 'van', 'truck'];
  for (let i = 0; i < n; i++) {
    const pt = randomRoadPoint(state.rng, 2400, 1800, 0);
    const vertical = state.rng() < 0.5;
    const line = vertical ? nearestRoadPoint(pt.x, pt.y).x : nearestRoadPoint(pt.x, pt.y).y;
    const along = vertical ? pt.y : pt.x;
    const type = types[Math.floor(state.rng() * types.length)];
    const lane = (state.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 - 16);
    const car = makeCar(state, type,
      vertical ? line + lane : along,
      vertical ? along : line + lane,
      vertical ? (state.rng() < 0.5 ? Math.PI / 2 : -Math.PI / 2) : (state.rng() < 0.5 ? 0 : Math.PI),
      'parked');
    car.color = pickColor(state.rng);
  }
  // A guaranteed sports car near the safehouse for the first mission's fun.
  const sport = makeCar(state, 'sports', LANDMARKS.safehouse.x + 60, LANDMARKS.safehouse.y + 96, 0, 'parked');
  sport.color = '#ff7a3c';
}

function pickColor(rng) {
  const colors = ['#c9c9c9', '#3c6bd6', '#d63c3c', '#3cd6a0', '#e8e83c', '#8a4dd6', '#e8e8e8', '#2a2a2a', '#ff9a3c'];
  return colors[Math.floor(rng() * colors.length)];
}

export function spawnTrafficCar(state) {
  const pt = randomRoadPoint(state.rng, state.player.x, state.player.y, 500);
  const type = TRAFFIC_TYPES[Math.floor(state.rng() * TRAFFIC_TYPES.length)];
  const vertical = state.rng() < 0.5;
  const car = makeCar(state, type, pt.x, pt.y, vertical ? Math.PI / 2 : 0, 'traffic');
  car.color = pickColor(state.rng);
  if (type === 'taxi') car.color = '#f2c230';
  return car;
}

export function spawnPed(state, nearX = null, nearY = null) {
  const x = nearX ?? 200 + state.rng() * (WORLD_W - 400);
  const y = nearY ?? 200 + state.rng() * (WORLD_H - 800);
  const ped = {
    x, y, angle: state.rng() * Math.PI * 2, speed: 28 + state.rng() * 22,
    tx: x, ty: y, state: 'walk', panicT: 0, color: pickPedColor(state.rng),
    shirt: pickPedColor(state.rng), phase: state.rng() * 6,
  };
  state.peds.push(ped);
  return ped;
}

function pickPedColor(rng) {
  const c = ['#e8b48a', '#c98a5a', '#8a5a3c', '#f0d0b0', '#6b4a2a'];
  return c[Math.floor(rng() * c.length)];
}

export function spawnPolice(state) {
  const p = state.player;
  const pt = randomRoadPoint(state.rng, p.x, p.y, 650);
  const car = makeCar(state, 'police', pt.x, pt.y, 0, 'police');
  car.color = '#1d2a3a';
  car.police = { state: 'chase', stuckT: 0, siren: state.rng() * 2 };
  car.speed = 200;
  return car;
}

export function spawnGoon(state, x, y) {
  const goon = { x, y, hp: 60, angle: 0, state: 'chase', shootT: 1 + state.rng(), punchCd: 0, speed: 120, phase: state.rng() * 6 };
  state.goons.push(goon);
  return goon;
}

export function spawnPickup(state, x, y, kind, amount = 0) {
  state.pickups.push({ x, y, kind, amount, t: 0 });
}

export function burst(state, x, y, n, color, speed = 120, size = 3, life = 0.6) {
  for (let i = 0; i < n; i++) {
    const a = state.rng() * Math.PI * 2;
    const s = speed * (0.3 + state.rng() * 0.7);
    state.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: life * (0.5 + state.rng() * 0.5), max: life, color, size: size * (0.6 + state.rng() * 0.8) });
  }
  if (state.parts.length > 400) state.parts.splice(0, state.parts.length - 400);
}

// ---- player ----------------------------------------------------------------
function nearestCar(state, x, y, maxD) {
  let best = null, bestD = maxD;
  for (const c of state.cars) {
    if (c.driver === 'police') continue;
    const d = dist(x, y, c.x, c.y);
    if (d < bestD) { bestD = d; best = c; }
  }
  return best;
}

function updatePlayerOnFoot(state, input, dt, sound) {
  const p = state.player;
  const mv = input.moveVec();
  const run = input.down('ShiftLeft') || input.down('ShiftRight');
  const speed = run ? 265 : 175;
  p.speed = Math.hypot(mv.x, mv.y) * speed;
  p.x += mv.x * speed * dt;
  p.y += mv.y * speed * dt;
  if (mv.x !== 0 || mv.y !== 0) {
    p.angle = Math.atan2(mv.y, mv.x);
    p.walkPhase += dt * 11;
  }
  // Aim at the mouse.
  const wx = p.x + (input.mouseX - 640);
  const wy = p.y + (input.mouseY - 360);
  p.aim = Math.atan2(wy - p.y, wx - p.x);
  // Keep out of the water and the buildings.
  if (inWater(p.x, p.y)) p.y = 3080;
  collideBuildings(state.city, p, 14);
  clampToWorld(p, 20);
  state.stats.distance += p.speed * dt;

  // Enter / steal a car.
  if (input.hit('KeyE')) {
    const car = nearestCar(state, p.x, p.y, 84);
    if (car) {
      if (car.driver === 'traffic') {
        // Yank the driver out: they flee on foot, the law notices.
        spawnPed(state, car.x + 30, car.y);
        const flee = state.peds[state.peds.length - 1];
        flee.state = 'flee'; flee.panicT = 4;
        addWanted(state, 1, 'CAR STOLEN');
        state.stats.carsStolen++;
        sound?.noise(0.12, 0.2, 700);
      }
      car.driver = 'player';
      p.car = car;
      p.onFoot = false;
      p.speed = 0;
      sound?.click();
    }
  }
  // Punch.
  if (p.punchCd > 0) p.punchCd -= dt;
  if (p.punchT > 0) p.punchT -= dt;
  if (input.hit('KeyF') && p.punchCd <= 0) {
    p.punchT = 0.22; p.punchCd = 0.45;
    sound?.punch();
    const fx = p.x + Math.cos(p.aim) * 30, fy = p.y + Math.sin(p.aim) * 30;
    for (const g of state.goons) {
      if (dist(fx, fy, g.x, g.y) < 34) {
        g.hp -= 26;
        g.x += Math.cos(p.aim) * 26; g.y += Math.sin(p.aim) * 26;
        burst(state, g.x, g.y, 6, '#ffdd88', 90, 3, 0.4);
        if (g.hp <= 0) { state.stats.goonsDown++; spawnPickup(state, g.x, g.y, 'cash', 60 + Math.floor(state.rng() * 80)); }
      }
    }
  }
  // Shoot.
  if (p.reloadT > 0) p.reloadT -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (input.down('KeyR') && p.reloadT <= 0 && p.ammo < 12 && p.reserve > 0) {
    p.reloadT = 1.1;
    const need = 12 - p.ammo;
    const take = Math.min(need, p.reserve);
    p.ammo += take; p.reserve -= take;
    sound?.blip(600, 0.08, 'square', 0.08);
  }
  if (input.mouseDown && p.shootCd <= 0 && p.reloadT <= 0 && p.ammo > 0) {
    p.shootCd = 0.22;
    p.ammo--;
    state.stats.shotsFired++;
    const bx = p.x + Math.cos(p.aim) * 20, by = p.y + Math.sin(p.aim) * 20;
    state.bullets.push({ x: bx, y: by, vx: Math.cos(p.aim) * 950, vy: Math.sin(p.aim) * 950, life: 0.9, from: 'player' });
    burst(state, bx, by, 4, '#ffe08a', 160, 2, 0.18);
    sound?.shot();
    if (p.wanted < 1) addWanted(state, 1, 'SHOTS FIRED');
  }
}

function updatePlayerDriving(state, input, dt, sound) {
  const p = state.player;
  const car = p.car;
  if (!car) { p.onFoot = true; return; }
  const t = CAR_TYPES[car.type];
  const mv = input.moveVec();
  const forward = mv.y < 0 ? 1 : mv.y > 0 ? -0.55 : 0; // W accelerates, S brakes/reverses
  const steer = mv.x;
  const handbrake = input.down('Space');
  car.speed += forward * t.accel * dt;
  // Drag + rolling resistance.
  car.speed -= car.speed * (handbrake ? 1.9 : 0.55) * dt;
  if (Math.abs(car.speed) < 4 && forward === 0) car.speed = 0;
  car.speed = clamp(car.speed, -t.top * 0.45, t.top);
  const steerRate = t.grip * clamp(Math.abs(car.speed) / 160, 0.25, 1) * (car.speed >= 0 ? 1 : -1);
  car.angle += steer * steerRate * dt * (handbrake ? 1.35 : 1);
  const nx = car.x + Math.cos(car.angle) * car.speed * dt;
  const ny = car.y + Math.sin(car.angle) * car.speed * dt;
  car.x = nx; car.y = ny;
  p.x = car.x; p.y = car.y; p.angle = car.angle; p.speed = Math.abs(car.speed);
  state.stats.distance += Math.abs(car.speed) * dt;
  // Skid smoke + sound when handbraking hard.
  if (handbrake && Math.abs(car.speed) > 180 && Math.random() < 0.5) {
    burst(state, car.x - Math.cos(car.angle) * 20, car.y - Math.sin(car.angle) * 20, 1, '#9a9a9a', 30, 4, 0.5);
  }
  sound?.setEngine(Math.abs(car.speed) / t.top, true);
  // Collisions with buildings.
  const before = { x: car.x, y: car.y };
  if (collideBuildings(state.city, car, 20)) {
    if (Math.abs(car.speed) > 260) { sound?.crash(); burst(state, car.x, car.y, 8, '#ffcc88', 140, 3, 0.5); car.hp -= 12; }
    car.speed *= -0.25;
  }
  if (inWater(car.x, car.y)) { car.x = before.x; car.y = 3080; car.speed *= -0.3; }
  clampToWorld(car, 24);
  // Exit the car.
  if (input.hit('KeyE')) {
    const side = car.angle + Math.PI / 2;
    p.x = car.x + Math.cos(side) * 34;
    p.y = car.y + Math.sin(side) * 34;
    collideBuildings(state.city, p, 14);
    car.driver = 'parked';
    car.speed = 0;
    p.car = null;
    p.onFoot = true;
    p.speed = 0;
    sound?.click();
    sound?.setEngine(0, false);
  }
  // Drive-by shooting.
  if (p.reloadT > 0) p.reloadT -= dt;
  if (p.shootCd > 0) p.shootCd -= dt;
  if (input.mouseDown && p.shootCd <= 0 && p.ammo > 0) {
    p.shootCd = 0.3;
    p.ammo--;
    state.stats.shotsFired++;
    const wx = p.x + (input.mouseX - 640);
    const wy = p.y + (input.mouseY - 360);
    const a = Math.atan2(wy - p.y, wx - p.x);
    state.bullets.push({ x: p.x + Math.cos(a) * 26, y: p.y + Math.sin(a) * 26, vx: Math.cos(a) * 950, vy: Math.sin(a) * 950, life: 0.9, from: 'player' });
    sound?.shot();
    if (p.wanted < 1) addWanted(state, 1, 'SHOTS FIRED');
  }
}

// ---- traffic, peds, police --------------------------------------------------
function updateTraffic(state, dt) {
  const p = state.player;
  for (const car of state.cars) {
    if (car.driver !== 'traffic' || !car.ai) continue;
    const ai = car.ai;
    if (ai.waitT > 0) { ai.waitT -= dt; car.speed = 0; continue; }
    // Slow for a car ahead on the same line.
    let blocked = false;
    for (const o of state.cars) {
      if (o === car || o.ai?.axis !== ai.axis || o.ai?.line !== ai.line) continue;
      const along = ai.axis === 'x' ? o.y - ai.pos : o.x - ai.pos;
      const ahead = along * ai.dir;
      if (ahead > 0 && ahead < 70 && Math.abs((ai.axis === 'x' ? o.x - (ai.line + ai.lane) : o.y - (ai.line + ai.lane))) < 26) { blocked = true; break; }
    }
    // Slow for the player's car crossing ahead.
    if (p.car && p.car !== car) {
      const d = dist(car.x, car.y, p.car.x, p.car.y);
      if (d < 60) blocked = true;
    }
    const target = blocked ? 0 : ai.speed;
    car.speed += (target - car.speed) * Math.min(1, dt * 2.2);
    ai.pos += car.speed * ai.dir * dt;
    if (ai.axis === 'x') { car.x = ai.line + ai.lane; car.y = ai.pos; }
    else { car.x = ai.pos; car.y = ai.line + ai.lane; }
    car.angle = ai.axis === 'x' ? (ai.dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (ai.dir > 0 ? 0 : Math.PI);
    // Wrap around the world edges.
    if (ai.pos > WORLD_H + 80 || ai.pos > WORLD_W + 80) { respawnTraffic(state, car); continue; }
    if (ai.pos < -80) { respawnTraffic(state, car); continue; }
    // At an intersection, sometimes turn.
    if (ai.justTurned > 0) ai.justTurned -= dt;
    else {
      const crossings = ai.axis === 'x' ? ROADS_Y : ROADS_X;
      for (const c of crossings) {
        if (Math.abs(ai.pos - c) < 6 && state.rng() < 0.22) {
          turnTraffic(state, car, c);
          break;
        }
      }
    }
  }
}

function turnTraffic(state, car, crossing) {
  const ai = car.ai;
  const r = state.rng();
  if (r < 0.45) return; // go straight
  const newAxis = ai.axis === 'x' ? 'y' : 'x';
  const newLine = crossing;
  const newDir = state.rng() < 0.5 ? 1 : -1;
  ai.axis = newAxis;
  ai.line = newLine;
  ai.pos = newAxis === 'x' ? car.y : car.x;
  // Keep the car on the new road: snap the perpendicular coordinate.
  if (newAxis === 'x') { car.x = newLine + ai.lane; car.y = ai.pos; }
  else { car.x = ai.pos; car.y = newLine + ai.lane; }
  ai.dir = newDir;
  ai.justTurned = 1.2;
}

function respawnTraffic(state, car) {
  const pt = randomRoadPoint(state.rng, state.player.x, state.player.y, 700);
  const vertical = state.rng() < 0.5;
  car.ai.axis = vertical ? 'x' : 'y';
  car.ai.line = vertical ? nearestRoadPoint(pt.x, pt.y).x : nearestRoadPoint(pt.x, pt.y).y;
  car.ai.pos = vertical ? pt.y : pt.x;
  car.ai.dir = state.rng() < 0.5 ? 1 : -1;
  car.ai.waitT = 0;
  car.speed = car.ai.speed;
  if (car.ai.axis === 'x') { car.x = car.ai.line + car.ai.lane; car.y = car.ai.pos; }
  else { car.x = car.ai.pos; car.y = car.ai.line + car.ai.lane; }
}

function updatePeds(state, dt) {
  const p = state.player;
  for (let i = state.peds.length - 1; i >= 0; i--) {
    const ped = state.peds[i];
    ped.phase += dt * 8;
    // Panic: run away from gunfire, crashes and speeding cars.
    let threat = null;
    if (p.car && Math.abs(p.car.speed) > 200 && dist(ped.x, ped.y, p.car.x, p.car.y) < 150) threat = p.car;
    if (state.bullets.length && dist(ped.x, ped.y, state.bullets[state.bullets.length - 1].x, state.bullets[state.bullets.length - 1].y) < 160) threat = state.bullets[state.bullets.length - 1];
    if (threat) { ped.state = 'flee'; ped.panicT = 2.5; }
    if (ped.state === 'flee') {
      ped.panicT -= dt;
      const a = Math.atan2(ped.y - (threat ? threat.y : p.y), ped.x - (threat ? threat.x : p.x));
      ped.x += Math.cos(a) * 150 * dt;
      ped.y += Math.sin(a) * 150 * dt;
      ped.angle = a;
      if (ped.panicT <= 0) ped.state = 'walk';
    } else {
      const d = dist(ped.x, ped.y, ped.tx, ped.ty);
      if (d < 12) {
        // Pick a new stroll target on a nearby sidewalk.
        const pt = randomRoadPoint(state.rng, ped.x, ped.y, 0);
        ped.tx = pt.x + (state.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
        ped.ty = pt.y + (state.rng() < 0.5 ? -1 : 1) * (ROAD_W / 2 + 12);
      } else {
        const a = Math.atan2(ped.ty - ped.y, ped.tx - ped.x);
        ped.angle = a;
        ped.x += Math.cos(a) * ped.speed * dt;
        ped.y += Math.sin(a) * ped.speed * dt;
      }
    }
    if (inWater(ped.x, ped.y)) ped.y = 3070;
    collideBuildings(state.city, ped, 10);
    clampToWorld(ped, 16);
    // Run over by a car.
    if (p.car && dist(ped.x, ped.y, p.car.x, p.car.y) < 26 && Math.abs(p.car.speed) > 60) {
      state.peds.splice(i, 1);
      state.stats.pedsHit++;
      burst(state, ped.x, ped.y, 10, '#c94d4d', 130, 3, 0.6);
      addWanted(state, 1, 'PEDESTRIAN DOWN');
    }
  }
  // Keep the streets populated near the player.
  if (state.peds.length < 34) {
    const pt = randomRoadPoint(state.rng, p.x, p.y, 500);
    spawnPed(state, pt.x, pt.y);
  }
}

function updatePolice(state, dt, sound) {
  const p = state.player;
  const want = p.wanted;
  const cruisers = state.cars.filter((c) => c.driver === 'police');
  // Spawn up to the wanted level's quota.
  const quota = want === 0 ? 0 : want <= 1 ? 1 : want <= 2 ? 2 : want <= 3 ? 3 : 4;
  if (cruisers.length < quota && state.time % 1 < dt * 2) spawnPolice(state);
  let anyNear = false;
  for (const car of cruisers) {
    const d = dist(car.x, car.y, p.x, p.y);
    if (d < 520) anyNear = true;
    // Pursuit steering toward the player, with a little wobble.
    const wantAngle = Math.atan2(p.y - car.y, p.x - car.x) + Math.sin(state.time * 2 + car.id) * 0.12;
    const diff = angDiff(car.angle, wantAngle);
    const t = CAR_TYPES.police;
    car.speed += t.accel * 0.9 * dt;
    car.speed = clamp(car.speed, 0, t.top * (0.92 + want * 0.03));
    car.angle += clamp(diff, -1, 1) * t.grip * 0.9 * dt;
    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    car.police.siren += dt;
    if (collideBuildings(state.city, car, 20)) {
      car.speed *= -0.2;
      if (Math.abs(car.speed) > 200) burst(state, car.x, car.y, 6, '#ffcc88', 120, 3, 0.4);
    }
    if (inWater(car.x, car.y)) { car.y = 3070; car.speed *= 0.4; }
    clampToWorld(car, 24);
    // Ram the player: damage on hard contact.
    if (d < 40) {
      if (p.onFoot) {
        if (p.invuln <= 0) {
          p.health -= 14;
          p.invuln = 0.8;
          burst(state, p.x, p.y, 8, '#ff6a6a', 120, 3, 0.5);
          sound?.crash();
        }
      } else if (Math.abs(car.speed) > 150) {
        p.car.hp -= 6;
        p.health -= 2;
        burst(state, (car.x + p.x) / 2, (car.y + p.y) / 2, 6, '#ffcc88', 110, 3, 0.4);
        sound?.crash();
      }
    }
    // Too far: give up the chase for this cruiser, respawn it closer.
    if (d > 1700) {
      const pt = randomRoadPoint(state.rng, p.x, p.y, 600);
      car.x = pt.x; car.y = pt.y; car.speed = 260;
    }
    // Busted: on foot, a cruiser sits on the player while they crawl.
    if (p.onFoot && d < 66 && p.speed < 30) {
      p.bustedT += dt;
      if (p.bustedT > 2.2) state.events.busted = true;
    }
  }
  if (want > 0 && !anyNear) {
    p.wantedTimer += dt;
    if (p.wantedTimer > 12) {
      p.wanted--;
      p.wantedTimer = 0;
      toast(state, `HEAT DOWN — ${'★'.repeat(p.wanted) || 'CLEAN'}`, 'Stay out of sight to cool off', 2.4);
    }
  } else p.wantedTimer = 0;
  if (want === 0 && cruisers.length) {
    // Heat gone: cruisers peel off and despawn.
    for (let i = state.cars.length - 1; i >= 0; i--) {
      if (state.cars[i].driver === 'police') state.cars.splice(i, 1);
    }
  }
  const near = cruisers.some((c) => dist(c.x, c.y, p.x, p.y) < 700);
  sound?.setSiren(near && want > 0, dt);
}

function updateGoons(state, dt, sound) {
  const p = state.player;
  for (let i = state.goons.length - 1; i >= 0; i--) {
    const g = state.goons[i];
    if (g.hp <= 0) { state.goons.splice(i, 1); continue; }
    g.phase += dt * 8;
    const d = dist(g.x, g.y, p.x, p.y);
    if (d > 700) continue;
    g.angle = Math.atan2(p.y - g.y, p.x - g.x);
    if (d > 260) {
      g.x += Math.cos(g.angle) * g.speed * dt;
      g.y += Math.sin(g.angle) * g.speed * dt;
    } else if (d < 60) {
      // Close enough to swing.
      if (g.punchCd <= 0) {
        g.punchCd = 0.9;
        p.health -= 8;
        p.invuln = 0.4;
        burst(state, p.x, p.y, 5, '#ffdd88', 90, 3, 0.35);
        sound?.punch();
      }
    } else {
      g.shootT -= dt;
      if (g.shootT <= 0) {
        g.shootT = 1.5 + state.rng() * 0.8;
        const a = g.angle + (state.rng() - 0.5) * 0.35;
        state.bullets.push({ x: g.x + Math.cos(a) * 18, y: g.y + Math.sin(a) * 18, vx: Math.cos(a) * 700, vy: Math.sin(a) * 700, life: 1.1, from: 'goon' });
        burst(state, g.x + Math.cos(a) * 18, g.y + Math.sin(a) * 18, 3, '#ffe08a', 120, 2, 0.15);
        sound?.noise(0.09, 0.16, 1500);
      }
    }
    if (g.punchCd > 0) g.punchCd -= dt;
    collideBuildings(state.city, g, 13);
    clampToWorld(g, 16);
  }
}

function updateBullets(state, dt) {
  const p = state.player;
  for (let i = state.bullets.length - 1; i >= 0; i--) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && buildingAt(state.city, b.x, b.y)) {
      burst(state, b.x, b.y, 4, '#ffd88a', 90, 2, 0.25);
      dead = true;
    }
    if (!dead && b.from !== 'player') {
      if (dist(b.x, b.y, p.x, p.y) < (p.onFoot ? 14 : 24)) {
        p.health -= 7;
        p.invuln = 0.3;
        burst(state, p.x, p.y, 6, '#ff6a6a', 110, 3, 0.4);
        dead = true;
      }
    }
    if (!dead && b.from === 'player') {
      for (const g of state.goons) {
        if (dist(b.x, b.y, g.x, g.y) < 16) {
          g.hp -= 34;
          burst(state, g.x, g.y, 8, '#ff6a6a', 130, 3, 0.45);
          if (g.hp <= 0) { state.stats.goonsDown++; spawnPickup(state, g.x, g.y, 'cash', 60 + Math.floor(state.rng() * 80)); }
          dead = true;
          break;
        }
      }
      if (!dead) {
        for (const car of state.cars) {
          if (car.driver === 'player') continue;
          if (dist(b.x, b.y, car.x, car.y) < 24) {
            car.hp -= 20;
            burst(state, b.x, b.y, 5, '#ffd88a', 110, 2, 0.3);
            if (car.driver === 'traffic') { car.ai.waitT = 1.2; }
            dead = true;
            break;
          }
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }
}

function updatePickups(state, dt) {
  const p = state.player;
  for (let i = state.pickups.length - 1; i >= 0; i--) {
    const pk = state.pickups[i];
    pk.t += dt;
    const d = dist(pk.x, pk.y, p.x, p.y);
    if (d < 90) { pk.x += (p.x - pk.x) * dt * 6; pk.y += (p.y - pk.y) * dt * 6; }
    if (d < 28) {
      if (pk.kind === 'cash') { p.cash += pk.amount; toast(state, `+$${pk.amount}`, '', 1.6); }
      if (pk.kind === 'health') p.health = Math.min(100, p.health + 40);
      if (pk.kind === 'ammo') p.reserve += 36;
      state.pickups.splice(i, 1);
    }
  }
}

// ---- main step ---------------------------------------------------------------
export function stepGame(state, input, dt, sound) {
  state.time += dt;
  const p = state.player;
  if (p.invuln > 0) p.invuln -= dt;
  if (p.bustedT > 0 && !(p.onFoot && state.cars.some((c) => c.driver === 'police' && dist(c.x, c.y, p.x, p.y) < 66))) p.bustedT = 0;

  if (p.onFoot) updatePlayerOnFoot(state, input, dt, sound);
  else updatePlayerDriving(state, input, dt, sound);

  updateTraffic(state, dt);
  updatePeds(state, dt);
  updatePolice(state, dt, sound);
  updateGoons(state, dt, sound);
  updateBullets(state, dt);
  updatePickups(state, dt);

  // Particles.
  for (let i = state.parts.length - 1; i >= 0; i--) {
    const pt = state.parts[i];
    pt.x += pt.vx * dt; pt.y += pt.vy * dt;
    pt.vx *= 0.96; pt.vy *= 0.96;
    pt.life -= dt;
    if (pt.life <= 0) state.parts.splice(i, 1);
  }
  // Toasts.
  for (let i = state.msg.length - 1; i >= 0; i--) {
    state.msg[i].t += dt;
    if (state.msg[i].t > state.msg[i].dur) state.msg.splice(i, 1);
  }
  // Car wrecks: a driven car at 0 hp stalls and smokes.
  if (p.car && p.car.hp <= 0) {
    burst(state, p.car.x, p.car.y, 2, '#555555', 40, 5, 0.8);
    p.car.speed *= 0.94;
  }
  // Wasted.
  if (p.health <= 0) state.events.wasted = true;

  // Missions drive the story.
  updateMission(state, dt, sound);

  // Camera follows the player, clamped to the world.
  const tx = clamp(p.x - 640, 0, WORLD_W - 1280);
  const ty = clamp(p.y - 360, 0, WORLD_H - 720);
  state.cam.x += (tx - state.cam.x) * Math.min(1, dt * 5);
  state.cam.y += (ty - state.cam.y) * Math.min(1, dt * 5);
}

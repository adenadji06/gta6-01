// Harbor Heat — simulation: player, cars, traffic, pedestrians, police, wanted,
// combat, missions, camera, save. All gameplay lives here; render.js only draws.
import {
  MAP_W, MAP_H, ROADS_V, ROADS_H, ROAD_W, SPAWN, SAFEHOUSE, GT,
  TUNING, CAR_COLORS, MISSIONS, SAVE_KEY, districtAt,
} from './config.js';
import { buildWorld, onRoad, nearestRoadPoint, collideBuildings, mulberry32 } from './world.js';
import { createMissions } from './missions.js';

export function createSim() {
  const world = buildWorld();
  const rand = mulberry32(20261119);

  const state = {
    screen: 'title',        // title | playing | paused | busted | complete
    time: 0,
    bustedT: 0,
    cash: 0,
    wanted: 0,
    ammo: TUNING.pistolAmmo,
    heatCooldown: 0,        // seconds between wanted increments
    unseenT: 0,             // seconds since any police was near
    player: {
      x: SPAWN.x, y: SPAWN.y, angle: -Math.PI / 2, speed: 0,
      onFoot: true, car: null,
    },
    cars: [],               // traffic
    peds: [],
    police: [],
    bullets: [],
    camera: { x: SPAWN.x, y: SPAWN.y },
    world,
    bannerOverride: '',
  };

  const missions = createMissions((ev) => {
    if (ev.type === 'mission-start') {
      if (ev.wanted) state.wanted = ev.wanted;
      syncPolice();
    } else if (ev.type === 'mission-complete') {
      state.cash += ev.reward;
      save();
    } else if (ev.type === 'all-complete') {
      state.screen = 'complete';
    }
  });
  state.missions = missions;

  function save() {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify({ cash: state.cash, mission: missions.index }));
    } catch { /* storage unavailable */ }
  }
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (typeof d.cash === 'number') state.cash = Math.max(0, Math.floor(d.cash));
      if (typeof d.mission === 'number') missions.load(Math.min(d.mission, MISSIONS.length - 1));
    } catch { /* corrupted save: start fresh */ }
  }

  function spawnTraffic() {
    state.cars = [];
    for (let i = 0; i < TUNING.trafficCount; i++) {
      const vertical = rand() > 0.5;
      const line = vertical
        ? ROADS_V[Math.floor(rand() * ROADS_V.length)]
        : ROADS_H[Math.floor(rand() * ROADS_H.length)];
      const pos = 120 + rand() * (vertical ? MAP_H - 240 : MAP_W - 240);
      state.cars.push({
        x: vertical ? line : pos,
        y: vertical ? pos : line,
        angle: vertical ? (rand() > 0.5 ? Math.PI / 2 : -Math.PI / 2) : (rand() > 0.5 ? 0 : Math.PI),
        speed: 120 + rand() * 90,
        color: CAR_COLORS[i % CAR_COLORS.length],
        axis: vertical ? 'y' : 'x',
        line,
        dir: rand() > 0.5 ? 1 : -1,
      });
    }
  }

  function spawnPeds() {
    state.peds = [];
    for (let i = 0; i < TUNING.pedCount; i++) {
      const vertical = rand() > 0.5;
      const line = vertical
        ? ROADS_V[Math.floor(rand() * ROADS_V.length)]
        : ROADS_H[Math.floor(rand() * ROADS_H.length)];
      const off = (rand() > 0.5 ? 1 : -1) * (ROAD_W / 2 + 14);
      const pos = 100 + rand() * (vertical ? MAP_H - 200 : MAP_W - 200);
      state.peds.push({
        x: vertical ? line + off : pos,
        y: vertical ? pos : line + off,
        angle: rand() * Math.PI * 2,
        speed: 38 + rand() * 34,
        axis: vertical ? 'y' : 'x',
        line: line + off,
        dir: rand() > 0.5 ? 1 : -1,
        color: ['#e8c39e', '#c98d64', '#8a5a3b', '#f0d0a8'][i % 4],
        shirt: ['#d94f4f', '#4f7ad9', '#4fd97a', '#d9c84f', '#9b4fd9'][i % 5],
        down: false, downT: 0,
      });
    }
  }

  function raiseWanted(n) {
    if (state.heatCooldown > 0) return;
    state.wanted = Math.min(TUNING.maxWanted, state.wanted + n);
    state.heatCooldown = TUNING.wantedCooldown;
    state.unseenT = 0;
    syncPolice();
  }

  function syncPolice() {
    // Keep exactly `wanted` cruisers (cap 5); remove the far ones first.
    while (state.police.length > state.wanted) {
      let far = 0; let fd = -1;
      state.police.forEach((p, i) => {
        const d = (p.x - state.player.x) ** 2 + (p.y - state.player.y) ** 2;
        if (d > fd) { fd = d; far = i; }
      });
      state.police.splice(far, 1);
    }
    while (state.police.length < state.wanted) {
      const p = nearestRoadPoint(state.player.x, state.player.y);
      // Push the spawn point away from the player so cruisers arrive, not appear.
      const dx = p.x - state.player.x; const dy = p.y - state.player.y;
      const d = Math.hypot(dx, dy) || 1;
      const sx = Math.max(60, Math.min(MAP_W - 60, p.x + (dx / d) * 420));
      const sy = Math.max(60, Math.min(MAP_H - 60, p.y + (dy / d) * 420));
      const sp = nearestRoadPoint(sx, sy);
      state.police.push({
        x: sp.x, y: sp.y, angle: Math.atan2(state.player.y - sp.y, state.player.x - sp.x),
        speed: 0, bustT: 0, stunT: 0, color: '#1c1e24', light: rand() * 10,
      });
    }
  }

  function nearestCar(x, y, maxD) {
    let best = null; let bd = maxD * maxD;
    const consider = (c) => {
      const d = (c.x - x) ** 2 + (c.y - y) ** 2;
      if (d < bd) { bd = d; best = c; }
    };
    world.parked.forEach(consider);
    state.cars.forEach(consider);
    return best;
  }

  function enterCar() {
    const p = state.player;
    const car = nearestCar(p.x, p.y, 110);
    if (!car) return;
    p.onFoot = false;
    p.car = car;
    p.angle = car.angle;
    p.speed = 0;
    p.x = car.x; p.y = car.y;
    // Remove it from its list so it is not drawn twice.
    const pi = world.parked.indexOf(car);
    if (pi >= 0) world.parked.splice(pi, 1);
    const ti = state.cars.indexOf(car);
    if (ti >= 0) state.cars.splice(ti, 1);
    if (!car.isGT) raiseWanted(1); // stealing a stranger's car is a crime
  }

  function exitCar() {
    const p = state.player;
    if (p.onFoot || Math.abs(p.speed) > 30) return;
    const car = p.car;
    car.x = p.x + Math.cos(p.angle + Math.PI / 2) * 46;
    car.y = p.y + Math.sin(p.angle + Math.PI / 2) * 46;
    car.angle = p.angle;
    car.parked = true;
    world.parked.push(car);
    p.car = null;
    p.onFoot = true;
    p.speed = 0;
    p.x += Math.cos(p.angle - Math.PI / 2) * 30;
    p.y += Math.sin(p.angle - Math.PI / 2) * 30;
  }

  function shoot(wx, wy) {
    const p = state.player;
    if (state.ammo <= 0 || !p.onFoot) return;
    state.ammo -= 1;
    const a = Math.atan2(wy - p.y, wx - p.x);
    state.bullets.push({ x: p.x, y: p.y, vx: Math.cos(a) * 900, vy: Math.sin(a) * 900, life: 1.1 });
    raiseWanted(1);
  }

  function busted() {
    state.cash = Math.floor(state.cash * (1 - TUNING.bustCashLoss));
    state.wanted = 0;
    state.police = [];
    state.bullets = [];
    const p = state.player;
    if (!p.onFoot) { p.car = null; }
    p.onFoot = true;
    p.x = SAFEHOUSE.x; p.y = SAFEHOUSE.y + 80;
    p.angle = -Math.PI / 2; p.speed = 0;
    state.screen = 'busted';
    state.bustedT = 2.5;
    save();
  }

  function updateTraffic(dt) {
    for (const c of state.cars) {
      const speed = c.speed * dt;
      if (c.axis === 'y') {
        c.y += c.dir * speed;
        c.angle = c.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        // At an intersection, sometimes turn onto the cross road.
        for (const hy of ROADS_H) {
          if (Math.abs(c.y - hy) < 24 && rand() < 0.012) {
            c.axis = 'x'; c.line = hy; c.y = hy;
            c.dir = rand() > 0.5 ? 1 : -1;
            break;
          }
        }
        if (c.y < 60) { c.y = 60; c.dir = 1; }
        if (c.y > MAP_H - 60) { c.y = MAP_H - 60; c.dir = -1; }
        c.x = c.line;
      } else {
        c.x += c.dir * speed;
        c.angle = c.dir > 0 ? 0 : Math.PI;
        for (const vx of ROADS_V) {
          if (Math.abs(c.x - vx) < 24 && rand() < 0.012) {
            c.axis = 'y'; c.line = vx; c.x = vx;
            c.dir = rand() > 0.5 ? 1 : -1;
            break;
          }
        }
        if (c.x < 60) { c.x = 60; c.dir = 1; }
        if (c.x > MAP_W - 60) { c.x = MAP_W - 60; c.dir = -1; }
        c.y = c.line;
      }
    }
  }

  function updatePeds(dt) {
    for (const p of state.peds) {
      if (p.down) {
        p.downT -= dt;
        if (p.downT <= 0) { p.down = false; p.x = 200 + rand() * 2000; p.y = 200 + rand() * 1400; }
        continue;
      }
      const step = p.speed * dt;
      if (p.axis === 'y') {
        p.y += p.dir * step;
        if (p.y < 80) { p.y = 80; p.dir = 1; }
        if (p.y > MAP_H - 80) { p.y = MAP_H - 80; p.dir = -1; }
        p.x = p.line;
        for (const hy of ROADS_H) if (Math.abs(p.y - hy) < 20 && rand() < 0.008) { p.axis = 'x'; p.line = hy + (rand() > 0.5 ? 62 : -62); p.y = p.line; p.dir = rand() > 0.5 ? 1 : -1; break; }
      } else {
        p.x += p.dir * step;
        if (p.x < 80) { p.x = 80; p.dir = 1; }
        if (p.x > MAP_W - 80) { p.x = MAP_W - 80; p.dir = -1; }
        p.y = p.line;
        for (const vx of ROADS_V) if (Math.abs(p.x - vx) < 20 && rand() < 0.008) { p.axis = 'y'; p.line = vx + (rand() > 0.5 ? 62 : -62); p.x = p.line; p.dir = rand() > 0.5 ? 1 : -1; break; }
      }
    }
  }

  function updatePolice(dt) {
    const p = state.player;
    let nearest = Infinity;
    for (const c of state.police) {
      if (c.stunT > 0) { c.stunT -= dt; c.speed *= 0.9; continue; }
      const dx = p.x - c.x; const dy = p.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      nearest = Math.min(nearest, d);
      const want = Math.atan2(dy, dx);
      let diff = want - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
      c.speed = Math.min(500, c.speed + 420 * dt);
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      const hit = collideBuildings(world.buildings, c.x, c.y, 24);
      c.x = hit.x; c.y = hit.y;
      // Ram / bust: close and slow player means the VPD closes in.
      if (d < 58 && Math.abs(p.speed) < 130) {
        c.bustT += dt;
        if (c.bustT > TUNING.bustHoldSeconds) { busted(); return; }
      } else {
        c.bustT = Math.max(0, c.bustT - dt);
      }
    }
    // Heat decays only when no cruiser can see the player.
    if (state.wanted > 0) {
      if (nearest > 620) {
        state.unseenT += dt;
        if (state.unseenT > TUNING.heatDecaySeconds) {
          state.wanted -= 1;
          state.unseenT = 0;
          syncPolice();
        }
      } else {
        state.unseenT = 0;
      }
    }
  }

  function updateBullets(dt) {
    for (let i = state.bullets.length - 1; i >= 0; i--) {
      const b = state.bullets[i];
      b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
      let dead = b.life <= 0 || b.x < 0 || b.y < 0 || b.x > MAP_W || b.y > MAP_H;
      if (!dead) {
        for (const bl of world.buildings) {
          if (b.x > bl.x && b.x < bl.x + bl.w && b.y > bl.y && b.y < bl.y + bl.h) { dead = true; break; }
        }
      }
      if (!dead) {
        for (const c of state.police) {
          if (Math.hypot(b.x - c.x, b.y - c.y) < 30) { c.stunT = 2; c.speed = 0; dead = true; break; }
        }
      }
      if (!dead) {
        for (const pd of state.peds) {
          if (!pd.down && Math.hypot(b.x - pd.x, b.y - pd.y) < 16) {
            pd.down = true; pd.downT = 8; dead = true; raiseWanted(1); break;
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
  }

  function updatePlayer(dt, input, audio) {
    const p = state.player;
    const ax = input.axis();
    if (p.onFoot) {
      const len = Math.hypot(ax.x, ax.y) || 1;
      const mx = (ax.x / len) * TUNING.walkSpeed * dt;
      const my = (ax.y / len) * TUNING.walkSpeed * dt;
      if (ax.x || ax.y) {
        p.angle = Math.atan2(my, mx);
        const hit = collideBuildings(world.buildings, p.x + mx, p.y + my, 14);
        p.x = hit.x; p.y = hit.y;
        p.speed = TUNING.walkSpeed;
      } else p.speed = 0;
      if (input.pressed('KeyE')) enterCar();
      if (input.consumeClick()) {
        const wx = state.camera.x - 640 + input.mouse.x;
        const wy = state.camera.y - 360 + input.mouse.y;
        shoot(wx, wy);
      }
    } else {
      // Driving.
      const forward = ax.y < 0 ? 1 : ax.y > 0 ? -0.45 : 0;
      if (ax.y < 0) p.speed += TUNING.carAccel * dt;
      else if (ax.y > 0) p.speed -= (p.speed > 0 ? TUNING.carBrake : TUNING.carReverse) * dt;
      else p.speed -= p.speed * TUNING.carDrag * dt;
      p.speed = Math.max(-TUNING.carReverse, Math.min(TUNING.carMaxSpeed, p.speed));
      const speed01 = Math.min(1, Math.abs(p.speed) / 260);
      const turn = TUNING.turnBase * (TUNING.turnFloor + (1 - TUNING.turnFloor) * speed01);
      if (ax.x !== 0 && Math.abs(p.speed) > 4) {
        p.angle += ax.x * turn * dt * (p.speed >= 0 ? 1 : -1);
      }
      const nx = p.x + Math.cos(p.angle) * p.speed * dt;
      const ny = p.y + Math.sin(p.angle) * p.speed * dt;
      const hit = collideBuildings(world.buildings, nx, ny, 26);
      if (Math.hypot(hit.x - nx, hit.y - ny) > 1) p.speed *= 0.55;
      p.x = hit.x; p.y = hit.y;
      if (p.car) { p.car.x = p.x; p.car.y = p.y; p.car.angle = p.angle; }
      if (input.pressed('KeyE')) exitCar();
      // Hitting a pedestrian at speed is a crime.
      for (const pd of state.peds) {
        if (!pd.down && Math.hypot(pd.x - p.x, pd.y - p.y) < 34 && Math.abs(p.speed) > 110) {
          pd.down = true; pd.downT = 8; raiseWanted(1);
        }
      }
    }
    // Safehouse restock.
    if (input.pressed('KeyR') && Math.hypot(p.x - SAFEHOUSE.x, p.y - SAFEHOUSE.y) < 130) {
      state.ammo = TUNING.pistolAmmo;
    }
    void audio;
  }

  function updateMission(dt) {
    missions.update(dt);
    const t = missions.target();
    if (t) {
      const p = state.player;
      if (Math.hypot(p.x - t.x, p.y - t.y) < 110) missions.completeStage();
    } else if (missions.current() && missions.current().id === 4 && state.wanted === 0 && state.screen === 'playing') {
      // Heat Wave ends the moment the tail is lost.
      missions.completeStage();
    }
  }

  function updateCamera(dt) {
    const p = state.player;
    const tx = Math.max(640, Math.min(MAP_W - 640, p.x));
    const ty = Math.max(360, Math.min(MAP_H - 360, p.y));
    const k = Math.min(1, dt * 5);
    state.camera.x += (tx - state.camera.x) * k;
    state.camera.y += (ty - state.camera.y) * k;
  }

  function update(dt, input, audio) {
    state.time += dt;
    if (state.heatCooldown > 0) state.heatCooldown -= dt;
    if (state.screen === 'busted') {
      state.bustedT -= dt;
      if (state.bustedT <= 0) state.screen = 'playing';
      return;
    }
    if (state.screen !== 'playing') return;
    updatePlayer(dt, input, audio);
    updateTraffic(dt);
    updatePeds(dt);
    updatePolice(dt);
    updateBullets(dt);
    updateMission(dt);
    updateCamera(dt);
    if (input.pressed('KeyP')) state.screen = 'paused';
    audio.setEngine(state.player.onFoot ? 0 : Math.min(1, Math.abs(state.player.speed) / TUNING.carMaxSpeed), !state.player.onFoot);
    audio.setSiren(state.wanted > 0, state.time);
  }

  function start() {
    spawnTraffic();
    spawnPeds();
    load();
    missions.start(missions.index || 0);
    if (missions.index >= MISSIONS.length) { missions.index = 0; missions.start(0); }
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  function debug() {
    const p = state.player;
    return {
      screen: state.screen,
      onFoot: p.onFoot,
      x: Math.round(p.x), y: Math.round(p.y),
      angle: Math.round(p.angle * 100) / 100,
      speed: Math.round(p.speed),
      wanted: state.wanted,
      cash: state.cash,
      ammo: state.ammo,
      mission: missions.current() ? missions.current().name : 'done',
      missionIndex: missions.index,
      district: districtName(),
    };
  }

  function districtName() {
    const p = state.player;
    return districtAt(p.x, p.y);
  }

  start();

  return {
    state, missions, update, start,
    enterCar, exitCar, shoot, raiseWanted, syncPolice, busted,
    save, load, debug, districtName,
  };
}

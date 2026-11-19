// Harbor Heat — deterministic screenshot staging for ?shot=start|play|chase|end.
// Each shot arranges the live game state, renders one frame, then sets
// window.__shotReady so the capture tool knows the frame is settled.
import { GT } from './config.js';

export function getShotParam() {
  try {
    return new URLSearchParams(window.location.search).get('shot');
  } catch {
    return null;
  }
}

function putInGT(sim, x, y, angle, speed) {
  const s = sim.state;
  const gt = s.world.parked.find((c) => c.isGT) || { x: GT.x, y: GT.y, angle: 0, color: GT.color, isGT: true, name: 'GT' };
  const pi = s.world.parked.indexOf(gt);
  if (pi >= 0) s.world.parked.splice(pi, 1);
  s.player.onFoot = false;
  s.player.car = gt;
  s.player.x = x; s.player.y = y;
  s.player.angle = angle;
  s.player.speed = speed;
  gt.x = x; gt.y = y; gt.angle = angle;
}

export function stageShot(sim, name) {
  const s = sim.state;
  s.time = 12.5; // fixed phase so stars, sirens and markers render identically
  if (name === 'start') {
    s.screen = 'title';
    s.player.x = 480; s.player.y = 560;
    s.camera.x = 640; s.camera.y = 480;
    s.wanted = 0;
    s.cash = 0;
    return;
  }
  if (name === 'play') {
    // First Wheels: already driving the GT east toward the Downtown paint shop.
    s.screen = 'playing';
    sim.missions.start(0);
    s.cash = 500;
    putInGT(sim, 1180, 320, 0, 320);
    s.camera.x = 1180; s.camera.y = 320;
    s.wanted = 0;
    sim.syncPolice();
    return;
  }
  if (name === 'chase') {
    // Hot Delivery, 2:21 left, 3 stars, two VPD cruisers closing in.
    s.screen = 'playing';
    sim.missions.start(2);
    sim.missions.timer = 141;
    s.cash = 3200;
    putInGT(sim, 1400, 960, 0, 340);
    s.camera.x = 1400; s.camera.y = 960;
    s.wanted = 3;
    sim.syncPolice();
    // Pin the cruisers in frame, lights flashing.
    if (s.police[0]) { s.police[0].x = 1240; s.police[0].y = 900; s.police[0].angle = 0.5; s.police[0].speed = 380; }
    if (s.police[1]) { s.police[1].x = 1560; s.police[1].y = 1030; s.police[1].angle = Math.PI - 0.4; s.police[1].speed = 380; }
    if (s.police[2]) { s.police[2].x = 1330; s.police[2].y = 1120; s.police[2].angle = -0.6; s.police[2].speed = 380; }
    return;
  }
  if (name === 'end') {
    // Dusk at the Docks: the Harbor Job just paid out.
    s.screen = 'playing';
    sim.missions.start(5);
    s.cash = 12700;
    s.dusk = true;
    sim.missions.banner = 'Job complete — The Harbor Job — +$3,500';
    sim.missions.bannerT = 30;
    putInGT(sim, 700, 1650, Math.PI / 2, 0);
    s.camera.x = 700; s.camera.y = 1560;
    s.wanted = 0;
    sim.syncPolice();
    return;
  }
}

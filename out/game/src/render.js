// Harbor Heat — canvas renderer: city, cars, people, police, HUD, minimap, screens.
import { MAP_W, MAP_H, ROADS_V, ROADS_H, ROAD_W, SOUTH_ROAD, DISTRICTS, VIEW_W, VIEW_H } from './config.js';

function drawCar(ctx, x, y, angle, color, isPolice, lightT) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(-24, -12, 48, 26);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-23, -13, 46, 26, 6);
  ctx.fill();
  ctx.fillStyle = 'rgba(180,220,255,0.85)';
  ctx.fillRect(-6, -11, 14, 22);
  ctx.fillStyle = 'rgba(20,20,20,0.9)';
  ctx.fillRect(-20, -13, 7, 5); ctx.fillRect(-20, 8, 7, 5);
  ctx.fillRect(13, -13, 7, 5); ctx.fillRect(13, 8, 7, 5);
  if (isPolice) {
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-2, -13, 8, 26);
    const on = Math.floor(lightT * 6) % 2 === 0;
    ctx.fillStyle = on ? '#ff2d2d' : '#2d7bff';
    ctx.fillRect(-14, -13, 7, 6);
    ctx.fillStyle = on ? '#2d7bff' : '#ff2d2d';
    ctx.fillRect(-14, 7, 7, 6);
  }
  ctx.restore();
}

function drawPed(ctx, x, y, angle, shirt, skin, down) {
  ctx.save();
  ctx.translate(x, y);
  if (down) { ctx.rotate(Math.PI / 2); }
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 7, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = skin;
  ctx.beginPath(); ctx.arc(Math.cos(angle) * 4, Math.sin(angle) * 4, 4, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function star(ctx, x, y, r, filled) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.45;
    ctx[i === 0 ? 'moveTo' : 'lineTo'](Math.cos(a) * rr, Math.sin(a) * rr);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd23f' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.stroke();
  ctx.restore();
}

export function render(ctx, sim) {
  const s = sim.state;
  const cam = s.camera;
  const ox = cam.x - VIEW_W / 2;
  const oy = cam.y - VIEW_H / 2;
  const t = s.time;

  // --- ground: district tiles + bay water ---
  ctx.fillStyle = '#22303a';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(d.x0 - ox, d.y0 - oy, d.x1 - d.x0, d.y1 - d.y0);
  }
  // Bay water along the south edge (Docks / Marina).
  ctx.fillStyle = '#1d4e6b';
  ctx.fillRect(0 - ox, 1800 - oy, 2560, 120);
  ctx.fillStyle = 'rgba(255,255,255,0.10)';
  for (let i = 0; i < 40; i++) {
    const wx = ((i * 173) % 2560) - ox;
    const wy = 1830 + ((i * 47) % 70) - oy;
    ctx.fillRect(wx, wy, 60, 3);
  }

  // --- roads ---
  ctx.fillStyle = '#2b2b30';
  for (const rx of ROADS_V) ctx.fillRect(rx - ROAD_W / 2 - ox, 0 - oy, ROAD_W, MAP_H);
  for (const ry of ROADS_H) ctx.fillRect(0 - ox, ry - ROAD_W / 2 - oy, MAP_W, ROAD_W);
  ctx.fillRect(SOUTH_ROAD.x0 - ox, SOUTH_ROAD.y - ROAD_W / 2 - oy, SOUTH_ROAD.x1 - SOUTH_ROAD.x0, ROAD_W);
  // Centre dashes.
  ctx.fillStyle = '#d8c95a';
  for (const rx of ROADS_V) {
    for (let y = 40; y < MAP_H; y += 80) ctx.fillRect(rx - 3 - ox, y - oy, 6, 34);
  }
  for (const ry of ROADS_H) {
    for (let x = 40; x < MAP_W; x += 80) ctx.fillRect(x - ox, ry - 3 - oy, 34, 6);
  }
  for (let x = SOUTH_ROAD.x0 + 40; x < SOUTH_ROAD.x1; x += 80) {
    ctx.fillRect(x - ox, SOUTH_ROAD.y - 3 - oy, 34, 6);
  }

  // --- piers ---
  for (const pier of s.world.piers) {
    ctx.fillStyle = '#7a5c38';
    ctx.fillRect(pier.x - ox, pier.y - oy, pier.w, pier.h);
    ctx.fillStyle = '#5d4527';
    ctx.fillRect(pier.x - 4 - ox, pier.y - oy, 4, pier.h);
    ctx.fillRect(pier.x + pier.w - ox, pier.y - oy, 4, pier.h);
  }

  // --- buildings ---
  for (const b of s.world.buildings) {
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(b.x + 5 - ox, b.y + 6 - oy, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x - ox, b.y - oy, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.14)';
    ctx.fillRect(b.x - ox, b.y - oy, b.w, 6);
    if (b.roof) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8 - ox, b.y + 8 - oy, b.w - 16, b.h - 16);
    }
    if (b.tall) {
      ctx.fillStyle = '#ffe9a8';
      for (let wx = b.x + 10; wx < b.x + b.w - 12; wx += 22) {
        for (let wy = b.y + 12; wy < b.y + b.h - 12; wy += 24) {
          if (((wx * 7 + wy * 13) % 5) < 2) ctx.fillRect(wx - ox, wy - oy, 8, 10);
        }
      }
    }
  }

  // --- mission target marker + guide line ---
  const target = sim.missions.target();
  if (target && s.screen === 'playing') {
    const bob = Math.sin(t * 4) * 6;
    ctx.strokeStyle = 'rgba(255,210,63,0.9)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(target.x - ox, target.y - oy + bob, 26, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath();
    ctx.moveTo(target.x - ox, target.y - oy + bob - 34);
    ctx.lineTo(target.x - 9 - ox, target.y - oy + bob - 18);
    ctx.lineTo(target.x + 9 - ox, target.y - oy + bob - 18);
    ctx.closePath();
    ctx.fill();
    // Guide line from the player.
    ctx.strokeStyle = 'rgba(255,210,63,0.35)';
    ctx.setLineDash([10, 10]);
    ctx.beginPath();
    ctx.moveTo(s.player.x - ox, s.player.y - oy);
    ctx.lineTo(target.x - ox, target.y - oy);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // --- parked cars, traffic, pedestrians, police, bullets ---
  for (const c of s.world.parked) drawCar(ctx, c.x - ox, c.y - oy, c.angle, c.color, false, t);
  for (const c of s.cars) drawCar(ctx, c.x - ox, c.y - oy, c.angle, c.color, false, t);
  for (const p of s.peds) drawPed(ctx, p.x - ox, p.y - oy, p.angle, p.shirt, p.color, p.down);
  for (const c of s.police) drawCar(ctx, c.x - ox, c.y - oy, c.angle, c.color, true, t + c.light);
  ctx.fillStyle = '#ffe9a8';
  for (const b of s.bullets) {
    ctx.beginPath(); ctx.arc(b.x - ox, b.y - oy, 4, 0, Math.PI * 2); ctx.fill();
  }

  // --- player ---
  const p = s.player;
  if (p.onFoot) {
    ctx.save();
    ctx.translate(p.x - ox, p.y - oy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#2b2b30';
    ctx.beginPath(); ctx.arc(0, 0, 13, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b13c';
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#f0d0a8';
    ctx.beginPath(); ctx.arc(7, 0, 5, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  } else if (p.car) {
    drawCar(ctx, p.x - ox, p.y - oy, p.angle, p.car.color, false, t);
  }

  // --- safehouse marker ---
  ctx.strokeStyle = 'rgba(120,220,120,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(480 - 60 - ox, 480 - 60 - oy, 120, 120);
  ctx.fillStyle = '#78dc78';
  ctx.font = 'bold 13px sans-serif';
  ctx.fillText('SAFEHOUSE', 480 - 40 - ox, 480 - 68 - oy);

  // --- dusk tint (end shot) ---
  if (s.dusk) {
    ctx.fillStyle = 'rgba(255,120,40,0.10)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.fillStyle = 'rgba(60,30,90,0.14)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  if (s.screen !== 'playing') { drawScreen(ctx, sim); return; }

  // --- HUD ---
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, VIEW_W, 64);
  ctx.fillStyle = '#7dff7d';
  ctx.font = 'bold 26px sans-serif';
  ctx.fillText(`$${s.cash.toLocaleString()}`, 18, 40);
  for (let i = 0; i < 5; i++) star(ctx, 220 + i * 30, 32, 12, i < s.wanted);
  ctx.fillStyle = '#fff';
  ctx.font = '15px sans-serif';
  ctx.fillText(sim.districtName(), 400, 26);
  ctx.fillText(`Ammo ${s.ammo}  •  ${p.onFoot ? 'On foot — E to enter a car' : 'Driving — E to exit'}`, 400, 48);
  // Mission objective + timer.
  const m = sim.missions;
  ctx.fillStyle = '#ffd23f';
  ctx.font = 'bold 16px sans-serif';
  ctx.fillText(`${m.current() ? m.current().name : 'Free roam'}: ${m.objective()}`, 18, 92);
  if (m.timer > 0) {
    const mm = Math.floor(m.timer / 60);
    const ss = Math.floor(m.timer % 60).toString().padStart(2, '0');
    ctx.fillStyle = m.timer < 30 ? '#ff5a5a' : '#fff';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(`${mm}:${ss}`, 18, 124);
  }
  if (m.bannerT > 0 && m.banner) {
    ctx.fillStyle = 'rgba(0,0,0,0.65)';
    const w = Math.min(900, 40 + m.banner.length * 8);
    ctx.fillRect((VIEW_W - w) / 2, 140, w, 44);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 17px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(m.banner, VIEW_W / 2, 168);
    ctx.textAlign = 'left';
  }
  // Speed.
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 20px sans-serif';
  ctx.fillText(`${Math.round(Math.abs(p.speed) * 0.12)} mph`, VIEW_W - 130, VIEW_H - 24);

  // --- minimap ---
  const mmX = VIEW_W - 210, mmY = 76, mmW = 190, mmH = 142;
  const sx = mmW / MAP_W, sy = mmH / MAP_H;
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(mmX - 6, mmY - 6, mmW + 12, mmH + 12);
  for (const d of DISTRICTS) {
    ctx.fillStyle = d.ground;
    ctx.fillRect(mmX + d.x0 * sx, mmY + d.y0 * sy, (d.x1 - d.x0) * sx, (d.y1 - d.y0) * sy);
  }
  ctx.fillStyle = '#1d4e6b';
  ctx.fillRect(mmX, mmY + 1800 * sy, mmW, (MAP_H - 1800) * sy);
  if (target) {
    ctx.fillStyle = '#ffd23f';
    ctx.beginPath(); ctx.arc(mmX + target.x * sx, mmY + target.y * sy, 5, 0, Math.PI * 2); ctx.fill();
  }
  ctx.fillStyle = '#ff5a5a';
  for (const c of s.police) {
    ctx.beginPath(); ctx.arc(mmX + c.x * sx, mmY + c.y * sy, 3, 0, Math.PI * 2); ctx.fill();
  }
  ctx.save();
  ctx.translate(mmX + p.x * sx, mmY + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -5); ctx.lineTo(-6, 5); ctx.closePath(); ctx.fill();
  ctx.restore();
}

function drawScreen(ctx, sim) {
  const s = sim.state;
  ctx.fillStyle = 'rgba(8,10,18,0.72)';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.textAlign = 'center';
  if (s.screen === 'title') {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 84px sans-serif';
    ctx.fillText('HARBOR HEAT', VIEW_W / 2, 240);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText('Port Vermilion • Jax Marlowe • six jobs, one way out', VIEW_W / 2, 290);
    ctx.font = '20px sans-serif';
    ctx.fillText('WASD drive & walk  •  E enter / exit car  •  Mouse aim, click to shoot', VIEW_W / 2, 340);
    ctx.fillText('R restock at the safehouse  •  P pause  •  M mute', VIEW_W / 2, 372);
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 26px sans-serif';
    ctx.fillText(Math.floor(s.time * 1.4) % 2 === 0 ? 'Press ENTER to start' : '', VIEW_W / 2, 450);
    ctx.fillStyle = '#9db3c8';
    ctx.font = '15px sans-serif';
    ctx.fillText('A fictional open-world crime game. No real people, places or brands.', VIEW_W / 2, 500);
  } else if (s.screen === 'paused') {
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('PAUSED', VIEW_W / 2, 330);
    ctx.font = '22px sans-serif';
    ctx.fillText('Press P to resume', VIEW_W / 2, 380);
  } else if (s.screen === 'busted') {
    ctx.fillStyle = '#ff5a5a';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('BUSTED', VIEW_W / 2, 330);
    ctx.fillStyle = '#fff';
    ctx.font = '22px sans-serif';
    ctx.fillText('The VPD took 10% of your cash. Back at the safehouse.', VIEW_W / 2, 380);
  } else if (s.screen === 'complete') {
    ctx.fillStyle = '#ffd23f';
    ctx.font = 'bold 54px sans-serif';
    ctx.fillText('THE LONG GOODBYE', VIEW_W / 2, 300);
    ctx.fillStyle = '#fff';
    ctx.font = '24px sans-serif';
    ctx.fillText(`All six jobs done. Jax walks away with $${s.cash.toLocaleString()}.`, VIEW_W / 2, 350);
    ctx.fillText('Press ENTER to keep roaming Port Vermilion.', VIEW_W / 2, 390);
  }
  ctx.textAlign = 'left';
}

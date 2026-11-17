// Harbor Heat — all drawing: the city, its cars and people, the HUD with its
// minimap, and the title / pause / busted / wasted / ending screens. Canvas
// 2D only, no images: every visual is drawn from the simulation state.
import {
  CAR_TYPES, DISTRICTS, LANDMARKS, PAL, ROADS_X, ROADS_Y, ROAD_W, VIEW_H, VIEW_W,
  WORLD_H, WORLD_W, clamp, dist,
} from './config.js';
import { inBeach, inWater } from './world.js';

const fonts = new Map();
function font(size, weight = 'bold') {
  const key = `${weight}:${size}`;
  if (!fonts.has(key)) fonts.set(key, `${weight} ${size}px "Trebuchet MS", "Segoe UI", Verdana, sans-serif`);
  return fonts.get(key);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function text(s, x, y, size, color, align = 'left', weight = 'bold') {
    ctx.font = font(size, weight);
    ctx.fillStyle = color;
    ctx.textAlign = align;
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(s, x, y);
  }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ---- world ---------------------------------------------------------------
  function drawGround(state) {
    const { cam } = state;
    const x0 = Math.max(0, cam.x - 40), y0 = Math.max(0, cam.y - 40);
    const x1 = Math.min(WORLD_W, cam.x + VIEW_W + 40), y1 = Math.min(WORLD_H, cam.y + VIEW_H + 40);
    // Base ground: warm dusk concrete.
    ctx.fillStyle = '#54503f';
    ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
    // District tints.
    for (const d of DISTRICTS) {
      ctx.fillStyle = d.tint + '33';
      ctx.fillRect(Math.max(x0, d.x), Math.max(y0, d.y), Math.min(x1, d.x + d.w) - Math.max(x0, d.x), Math.min(y1, d.y + d.h) - Math.max(y0, d.y));
    }
    // Parks.
    for (const pk of state.city.parks) {
      if (pk.x > x1 || pk.x + pk.w < x0 || pk.y > y1 || pk.y + pk.h < y0) continue;
      ctx.fillStyle = PAL.grass;
      ctx.fillRect(pk.x, pk.y, pk.w, pk.h);
      ctx.fillStyle = '#3d6b8a';
      ctx.beginPath();
      ctx.ellipse(pk.x + pk.w * 0.7, pk.y + pk.h * 0.6, pk.w * 0.16, pk.h * 0.2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    // Beach + bay.
    ctx.fillStyle = PAL.sand;
    ctx.fillRect(x0, 2960, x1 - x0, 120);
    ctx.fillStyle = PAL.water;
    ctx.fillRect(x0, 3080, x1 - x0, y1 - 3080 > 0 ? y1 - 3080 : 0);
    ctx.fillStyle = PAL.waterDeep;
    for (let wx = Math.floor(x0 / 90) * 90; wx < x1; wx += 90) {
      const wob = Math.sin(state.time * 1.4 + wx * 0.05) * 6;
      ctx.fillRect(wx, 3100 + wob, 52, 5);
      ctx.fillRect(wx + 30, 3180 - wob, 40, 4);
    }
    // Roads: asphalt, edge lines, centre dashes.
    ctx.fillStyle = PAL.asphalt;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, y0, ROAD_W, y1 - y0);
    for (const ry of ROADS_Y) ctx.fillRect(x0, ry - ROAD_W / 2, x1 - x0, ROAD_W);
    ctx.strokeStyle = 'rgba(232,210,122,0.55)';
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 30]);
    for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(rx, y0); ctx.lineTo(rx, y1); ctx.stroke(); }
    for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(x0, ry); ctx.lineTo(x1, ry); ctx.stroke(); }
    ctx.setLineDash([]);
    // Sidewalk edging around each block.
    ctx.strokeStyle = 'rgba(210,200,180,0.35)';
    ctx.lineWidth = 2;
    for (let bx = 0; bx < ROADS_X.length - 1; bx++) {
      for (let by = 0; by < ROADS_Y.length - 1; by++) {
        const bx0 = ROADS_X[bx] + ROAD_W / 2, by0 = ROADS_Y[by] + ROAD_W / 2;
        const bx1 = ROADS_X[bx + 1] - ROAD_W / 2, by1 = ROADS_Y[by + 1] - ROAD_W / 2;
        if (bx1 < x0 || bx0 > x1 || by1 < y0 || by0 > y1 || by1 > 3060) continue;
        ctx.strokeRect(bx0, by0, bx1 - bx0, by1 - by0);
      }
    }
  }

  function drawBuildings(state) {
    const { cam } = state;
    const x0 = cam.x - 60, y0 = cam.y - 60, x1 = cam.x + VIEW_W + 60, y1 = cam.y + VIEW_H + 60;
    for (const b of state.city.buildings) {
      if (b.x > x1 || b.x + b.w < x0 || b.y > y1 || b.y + b.h < y0) continue;
      // Drop shadow for height.
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.fillRect(b.x + 6, b.y + 8, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      // Rooftop detail: parapet + vents + skylights.
      ctx.strokeStyle = 'rgba(0,0,0,0.35)';
      ctx.lineWidth = 3;
      ctx.strokeRect(b.x + 4, b.y + 4, b.w - 8, b.h - 8);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      const cols = Math.max(1, Math.floor(b.w / 46));
      const rows = Math.max(1, Math.floor(b.h / 46));
      for (let i = 0; i < cols; i++) {
        for (let j = 0; j < rows; j++) {
          if (((i * 7 + j * 3 + b.seed * 13) | 0) % 3 === 0) {
            ctx.fillRect(b.x + 12 + i * 46, b.y + 12 + j * 46, 22, 16);
          }
        }
      }
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 8, 24, 16);
    }
    // Trees.
    for (const t of state.city.trees) {
      if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
      ctx.fillStyle = '#2f5a2e';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#4d8a45';
      ctx.beginPath(); ctx.arc(t.x - 3, t.y - 3, t.r * 0.7, 0, Math.PI * 2); ctx.fill();
    }
    // Props: lamps and hydrants.
    for (const pr of state.city.props) {
      if (pr.x < x0 || pr.x > x1 || pr.y < y0 || pr.y > y1) continue;
      if (pr.kind === 'lamp') {
        ctx.fillStyle = '#2a2a2a';
        ctx.fillRect(pr.x - 2, pr.y - 2, 4, 4);
        ctx.fillStyle = 'rgba(255,220,120,0.5)';
        ctx.beginPath(); ctx.arc(pr.x, pr.y, 6, 0, Math.PI * 2); ctx.fill();
      } else {
        ctx.fillStyle = '#c94d4d';
        ctx.fillRect(pr.x - 3, pr.y - 3, 6, 6);
      }
    }
    // Neon signs.
    for (const s of state.city.signs) {
      if (s.x < x0 || s.x > x1 || s.y < y0 || s.y > y1) continue;
      const glow = 0.65 + 0.35 * Math.sin(state.time * 3 + s.x);
      ctx.globalAlpha = glow;
      text(s.text, s.x, s.y, 15, s.color, 'center');
      ctx.globalAlpha = 1;
    }
    // Landmark pads + labels.
    for (const [key, l] of Object.entries(LANDMARKS)) {
      if (l.x < x0 - 120 || l.x > x1 + 120 || l.y < y0 - 60 || l.y > y1 + 60) continue;
      ctx.fillStyle = 'rgba(20,16,24,0.55)';
      const w = ctx.measureText(l.label).width;
      ctx.font = font(13);
      const tw = ctx.measureText(l.label).width;
      rr(l.x - tw / 2 - 8, l.y - 52, tw + 16, 22, 6);
      ctx.fill();
      ctx.strokeStyle = '#ff7a3c';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      text(l.label, l.x, l.y - 36, 13, '#ffd9a0', 'center');
      ctx.fillStyle = '#ff7a3c';
      ctx.beginPath(); ctx.arc(l.x, l.y, 5, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ---- entities --------------------------------------------------------------
  function drawCar(car, isPlayer) {
    const t = CAR_TYPES[car.type];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    rr(-t.len / 2 + 3, -t.wid / 2 + 3, t.len, t.wid, 7);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#161616';
    const wl = t.len * 0.32, ww = 5;
    ctx.fillRect(-t.len / 2 + 6, -t.wid / 2 - 2, wl * 0.5, ww);
    ctx.fillRect(-t.len / 2 + 6, t.wid / 2 - 3, wl * 0.5, ww);
    ctx.fillRect(t.len / 2 - 6 - wl * 0.5, -t.wid / 2 - 2, wl * 0.5, ww);
    ctx.fillRect(t.len / 2 - 6 - wl * 0.5, t.wid / 2 - 3, wl * 0.5, ww);
    // Body.
    ctx.fillStyle = car.color;
    rr(-t.len / 2, -t.wid / 2, t.len, t.wid, 7);
    ctx.fill();
    // Cabin + windshield.
    ctx.fillStyle = 'rgba(20,30,44,0.85)';
    rr(-t.len * 0.12, -t.wid / 2 + 4, t.len * 0.3, t.wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(140,200,230,0.5)';
    ctx.fillRect(t.len * 0.18, -t.wid / 2 + 5, 5, t.wid - 10);
    // Headlights.
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(t.len / 2 - 2, -t.wid / 2 + 3, 3, 4);
    ctx.fillRect(t.len / 2 - 2, t.wid / 2 - 7, 3, 4);
    if (car.type === 'police') {
      // Light bar, flashing red/blue.
      const phase = Math.floor(state_time() * 6) % 2 === 0;
      ctx.fillStyle = phase ? '#ff2a2a' : '#2a6aff';
      ctx.fillRect(-4, -t.wid / 2 + 2, 8, 5);
      ctx.fillStyle = phase ? '#2a6aff' : '#ff2a2a';
      ctx.fillRect(-4, t.wid / 2 - 7, 8, 5);
      ctx.fillStyle = '#e8e8e8';
      text('PD', 0, 4, 10, '#111111', 'center');
    }
    if (car.type === 'taxi') {
      ctx.fillStyle = '#111111';
      text('TAXI', 0, 4, 9, '#111111', 'center');
    }
    if (isPlayer) {
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2;
      rr(-t.len / 2 - 3, -t.wid / 2 - 3, t.len + 6, t.wid + 6, 9);
      ctx.stroke();
    }
    ctx.restore();
    // Wreck smoke.
    if (car.hp <= 25 && car.driver === 'player') {
      ctx.fillStyle = 'rgba(80,80,80,0.5)';
      ctx.beginPath();
      ctx.arc(car.x - Math.cos(car.angle) * 14, car.y - Math.sin(car.angle) * 14, 7 + Math.sin(state_time() * 5) * 2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  // The renderer keeps its own clock for purely visual pulses.
  let _t = 0;
  function state_time() { return _t; }

  function drawPed(ped) {
    const bob = Math.sin(ped.phase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath(); ctx.ellipse(ped.x, ped.y + 8, 7, 3, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.shirt;
    ctx.beginPath(); ctx.arc(ped.x, ped.y + bob * 0.3, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = ped.color;
    ctx.beginPath(); ctx.arc(ped.x, ped.y - 7 + bob * 0.3, 5.5, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(ped.x, ped.y - 9 + bob * 0.3, 5, Math.PI, 0); ctx.fill();
  }

  function drawGoon(g) {
    const bob = Math.sin(g.phase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(g.x, g.y + 9, 8, 3.5, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#5a1f1f';
    ctx.beginPath(); ctx.arc(g.x, g.y + bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b48a';
    ctx.beginPath(); ctx.arc(g.x, g.y - 8 + bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
    // Gun arm toward the player.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(g.x, g.y);
    ctx.lineTo(g.x + Math.cos(g.angle) * 16, g.y + Math.sin(g.angle) * 16);
    ctx.stroke();
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(g.x - 14, g.y - 22, 28, 4);
    ctx.fillStyle = '#ff4d4d';
    ctx.fillRect(g.x - 14, g.y - 22, 28 * Math.max(0, g.hp / 60), 4);
  }

  function drawPlayer(state) {
    const p = state.player;
    if (!p.onFoot) return;
    const bob = Math.sin(p.walkPhase) * 2;
    const blink = p.invuln > 0 && Math.floor(p.invuln * 12) % 2 === 0;
    if (blink) return;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(p.x, p.y + 9, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    // Legs (two dots stepping).
    ctx.fillStyle = '#2a2a3a';
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4 - Math.sin(p.angle) * 3, p.y + Math.sin(p.angle) * 4 + Math.cos(p.angle) * 3 + bob * 0.4, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(p.x + Math.cos(p.angle) * 4 + Math.sin(p.angle) * 3, p.y + Math.sin(p.angle) * 4 - Math.cos(p.angle) * 3 - bob * 0.4, 3.5, 0, Math.PI * 2); ctx.fill();
    // Body: teal jacket, the driver's signature.
    ctx.fillStyle = '#1f8a7a';
    ctx.beginPath(); ctx.arc(p.x, p.y + bob * 0.3, 9, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e8b48a';
    ctx.beginPath(); ctx.arc(p.x, p.y - 8 + bob * 0.3, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1a1a1a';
    ctx.beginPath(); ctx.arc(p.x, p.y - 10 + bob * 0.3, 6, Math.PI, 0); ctx.fill();
    // Gun arm toward the aim.
    ctx.strokeStyle = '#222';
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + Math.cos(p.aim) * 17, p.y + Math.sin(p.aim) * 17);
    ctx.stroke();
    // Punch arc.
    if (p.punchT > 0) {
      ctx.strokeStyle = 'rgba(255,220,120,0.9)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 26, p.aim - 0.7, p.aim + 0.7);
      ctx.stroke();
    }
    // Direction tick so the facing reads at a glance.
    ctx.fillStyle = '#ff7a3c';
    ctx.beginPath();
    ctx.arc(p.x + Math.cos(p.angle) * 12, p.y + Math.sin(p.angle) * 12, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawPickups(state) {
    for (const pk of state.pickups) {
      const pulse = 1 + 0.15 * Math.sin(state.time * 5 + pk.x);
      ctx.save();
      ctx.translate(pk.x, pk.y);
      ctx.scale(pulse, pulse);
      if (pk.kind === 'cash') {
        ctx.fillStyle = '#2a7a3c';
        rr(-11, -7, 22, 14, 3); ctx.fill();
        ctx.fillStyle = '#e8f5c9';
        text('$', 0, 5, 12, '#e8f5c9', 'center');
      } else if (pk.kind === 'health') {
        ctx.fillStyle = '#e8e8e8';
        rr(-10, -10, 20, 20, 4); ctx.fill();
        ctx.fillStyle = '#d63c3c';
        ctx.fillRect(-3, -8, 6, 16);
        ctx.fillRect(-8, -3, 16, 6);
      } else {
        ctx.fillStyle = '#8a6f2a';
        rr(-10, -7, 20, 14, 3); ctx.fill();
        ctx.fillStyle = '#ffe08a';
        text('AMMO', 0, 4, 8, '#ffe08a', 'center');
      }
      ctx.restore();
    }
  }

  function drawParts(state) {
    for (const pt of state.parts) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const b of state.bullets) {
      ctx.strokeStyle = '#ffe08a';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
  }

  // ---- HUD -------------------------------------------------------------------
  function drawHud(state, screen) {
    const p = state.player;
    const m = state.mission;
    // Top-left: cash + mission card. The panel grows to fit the wrapped
    // objective so its text never spills past the panel's edge.
    const objLines = [];
    if (m) {
      const words = (m.objective || '').split(' ');
      let line = '';
      for (const w of words) {
        if ((line + ' ' + w).trim().length > 42 && line) { objLines.push(line.trim()); line = w; }
        else line += ' ' + w;
      }
      if (line.trim()) objLines.push(line.trim());
    }
    const cardH = m ? 78 + objLines.length * 17 + 10 : 86;
    ctx.fillStyle = 'rgba(12,10,16,0.72)';
    rr(16, 14, 300, cardH, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,122,60,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    text(`$${p.cash.toLocaleString('en-US')}`, 30, 44, 26, '#7dff9a');
    text(p.onFoot ? 'ON FOOT' : `DRIVING — ${p.car ? p.car.type.toUpperCase() : ''}`, 30, 68, 13, '#ffd9a0', 'left', 'normal');
    if (m) {
      text(m.title, 30, 90, 15, '#ff7a3c');
      ctx.font = font(13, 'normal');
      ctx.fillStyle = '#f5e6d0';
      ctx.textAlign = 'left';
      objLines.forEach((ln, i) => ctx.fillText(ln, 30, 108 + i * 17));
    }
    // Top-right: wanted stars + health + ammo.
    ctx.fillStyle = 'rgba(12,10,16,0.72)';
    rr(VIEW_W - 316, 14, 300, 86, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,122,60,0.6)'; ctx.lineWidth = 1.5; ctx.stroke();
    const flash = p.wanted > 0 && Math.floor(state.time * 2.4) % 2 === 0;
    for (let i = 0; i < 5; i++) {
      text('★', VIEW_W - 292 + i * 30, 46, 26, i < p.wanted ? (flash ? '#ff4d4d' : '#ffd23c') : 'rgba(255,255,255,0.22)');
    }
    text(districtLabel(state), VIEW_W - 30, 68, 12, '#d8b48f', 'right', 'normal');
    // Health bar.
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    rr(VIEW_W - 292, 76, 130, 12, 6); ctx.fill();
    ctx.fillStyle = p.health > 50 ? '#4dd67a' : p.health > 25 ? '#ffd23c' : '#ff4d4d';
    rr(VIEW_W - 292, 76, 130 * Math.max(0, p.health / 100), 12, 6); ctx.fill();
    text('HP', VIEW_W - 152, 87, 11, '#f5e6d0', 'left', 'normal');
    text(`AMMO ${p.ammo}/${p.reserve}${p.reloadT > 0 ? ' …' : ''}`, VIEW_W - 30, 87, 12, '#f5e6d0', 'right', 'normal');
    // Speed + car health, bottom-left when driving.
    if (!p.onFoot && p.car) {
      ctx.fillStyle = 'rgba(12,10,16,0.72)';
      rr(16, VIEW_H - 64, 170, 48, 10); ctx.fill();
      text(`${Math.round(Math.abs(p.car.speed) * 0.24)} km/h`, 30, VIEW_H - 36, 20, '#f5e6d0');
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      rr(30, VIEW_H - 28, 142, 8, 4); ctx.fill();
      ctx.fillStyle = p.car.hp > 40 ? '#4dd67a' : '#ff4d4d';
      rr(30, VIEW_H - 28, 142 * Math.max(0, p.car.hp / 100), 8, 4); ctx.fill();
    }
    // Toasts, centre-top.
    let ty = 130;
    for (const msg of state.msg) {
      const a = msg.t < 0.2 ? msg.t / 0.2 : msg.t > msg.dur - 0.4 ? Math.max(0, (msg.dur - msg.t) / 0.4) : 1;
      ctx.globalAlpha = a;
      ctx.font = font(20);
      const w = ctx.measureText(msg.text).width;
      ctx.fillStyle = 'rgba(12,10,16,0.78)';
      rr(VIEW_W / 2 - w / 2 - 16, ty - 24, w + 32, 34, 8); ctx.fill();
      text(msg.text, VIEW_W / 2, ty, 20, '#ffd23c', 'center');
      if (msg.sub) {
        ctx.font = font(13, 'normal');
        const w2 = ctx.measureText(msg.sub).width;
        ctx.fillStyle = 'rgba(12,10,16,0.78)';
        rr(VIEW_W / 2 - w2 / 2 - 12, ty + 12, w2 + 24, 24, 7); ctx.fill();
        text(msg.sub, VIEW_W / 2, ty + 29, 13, '#f5e6d0', 'center', 'normal');
        ty += 30;
      }
      ctx.globalAlpha = 1;
      ty += 44;
    }
    // Busted warning pulse.
    if (p.bustedT > 0) {
      const a = 0.25 + 0.25 * Math.sin(state.time * 10);
      ctx.fillStyle = `rgba(255,40,40,${a})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
      text('THEY ARE ON YOU — RUN!', VIEW_W / 2, 200, 30, '#ffffff', 'center');
    }
    drawMinimap(state);
    // Mission-failed / complete banners are drawn by the screen overlays.
  }

  function districtLabel(state) {
    const p = state.player;
    for (const d of DISTRICTS) {
      if (p.x >= d.x && p.x < d.x + d.w && p.y >= d.y && p.y < d.y + d.h) return d.name;
    }
    return 'PORT VERMILION';
  }

  function drawMinimap(state) {
    const mw = 230, mh = 172;
    const mx = VIEW_W - mw - 16, my = VIEW_H - mh - 16;
    const sx = mw / WORLD_W, sy = mh / WORLD_H;
    ctx.fillStyle = 'rgba(10,10,16,0.82)';
    rr(mx - 6, my - 6, mw + 12, mh + 12, 10); ctx.fill();
    ctx.strokeStyle = '#ff7a3c'; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.save();
    ctx.beginPath(); ctx.rect(mx, my, mw, mh); ctx.clip();
    // Water + land.
    ctx.fillStyle = '#14455c';
    ctx.fillRect(mx, my, mw, mh);
    ctx.fillStyle = '#3a3f4a';
    ctx.fillRect(mx, my, mw, mh * (3080 / WORLD_H));
    // Roads.
    ctx.strokeStyle = 'rgba(232,210,122,0.7)';
    ctx.lineWidth = 1.5;
    for (const rx of ROADS_X) { ctx.beginPath(); ctx.moveTo(mx + rx * sx, my); ctx.lineTo(mx + rx * sx, my + mh); ctx.stroke(); }
    for (const ry of ROADS_Y) { ctx.beginPath(); ctx.moveTo(mx, my + ry * sy); ctx.lineTo(mx + mw, my + ry * sy); ctx.stroke(); }
    // Landmarks.
    ctx.fillStyle = '#ff7a3c';
    for (const l of Object.values(LANDMARKS)) {
      ctx.fillRect(mx + l.x * sx - 2, my + l.y * sy - 2, 4, 4);
    }
    // Pickups.
    ctx.fillStyle = '#7dff9a';
    for (const pk of state.pickups) ctx.fillRect(mx + pk.x * sx - 2, my + pk.y * sy - 2, 4, 4);
    // Goons.
    ctx.fillStyle = '#ff4d4d';
    for (const g of state.goons) ctx.fillRect(mx + g.x * sx - 2, my + g.y * sy - 2, 4, 4);
    // Police, flashing.
    if (Math.floor(state.time * 3) % 2 === 0) ctx.fillStyle = '#2a6aff'; else ctx.fillStyle = '#ff2a2a';
    for (const c of state.cars) {
      if (c.driver !== 'police') continue;
      ctx.beginPath(); ctx.arc(mx + c.x * sx, my + c.y * sy, 4, 0, Math.PI * 2); ctx.fill();
    }
    // Mission target: pulsing yellow diamond.
    const m = state.mission;
    if (m && m.target) {
      const pulse = 4 + 2 * Math.sin(state.time * 5);
      ctx.fillStyle = '#ffd23c';
      ctx.save();
      ctx.translate(mx + m.target.x * sx, my + m.target.y * sy);
      ctx.rotate(Math.PI / 4);
      ctx.fillRect(-pulse / 2, -pulse / 2, pulse, pulse);
      ctx.restore();
    }
    // Player arrow.
    const p = state.player;
    ctx.save();
    ctx.translate(mx + p.x * sx, my + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.moveTo(7, 0); ctx.lineTo(-5, -4.5); ctx.lineTo(-5, 4.5); ctx.closePath(); ctx.fill();
    ctx.restore();
    ctx.restore();
    // Viewport rectangle.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(mx + state.cam.x * sx, my + state.cam.y * sy, VIEW_W * sx, VIEW_H * sy);
    text('PORT VERMILION', mx + mw / 2, my - 12, 11, '#d8b48f', 'center', 'normal');
  }

  // ---- screens -----------------------------------------------------------------
  function panel(x, y, w, h, title, titleColor = '#ff7a3c') {
    ctx.fillStyle = 'rgba(10,8,14,0.88)';
    rr(x, y, w, h, 14); ctx.fill();
    ctx.strokeStyle = 'rgba(255,122,60,0.7)'; ctx.lineWidth = 2; ctx.stroke();
    text(title, x + w / 2, y + 58, 40, titleColor, 'center');
  }

  function drawTitle(state, save) {
    // Sunset gradient sky behind the panel.
    const g = ctx.createLinearGradient(0, 0, 0, VIEW_H);
    g.addColorStop(0, '#2a1230');
    g.addColorStop(0.55, '#7a2a4d');
    g.addColorStop(1, '#ff7a3c');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Sun, off to the side so it never sits behind the story text.
    ctx.fillStyle = 'rgba(255,122,60,0.35)';
    ctx.beginPath(); ctx.arc(1050, 210, 96, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#ffd9a0';
    ctx.beginPath(); ctx.arc(1050, 210, 64, 0, Math.PI * 2); ctx.fill();
    // City silhouette.
    ctx.fillStyle = '#1a0f1e';
    let bx = 0;
    const rngH = [120, 190, 150, 210, 170, 200, 130, 205, 180, 150, 195];
    for (let i = 0; i < rngH.length; i++) {
      const w = VIEW_W / rngH.length;
      ctx.fillRect(bx, 560 - rngH[i], w - 8, rngH[i] + 160);
      bx += w;
    }
    ctx.fillStyle = '#14455c';
    ctx.fillRect(0, 620, VIEW_W, 100);
    text('HARBOR HEAT', VIEW_W / 2, 150, 84, '#ffffff', 'center');
    text('P O R T   V E R M I L I O N', VIEW_W / 2, 196, 22, '#ffd23c', 'center');
    const lines = [
      'Jax Marlowe came home to settle a debt. Six jobs stand between him',
      'and the boat out — and the whole Vermilion police force is in the way.',
      '',
      'Steal cars. Lose the heat. Run the jobs. Get out.',
      '',
      'WASD move / drive · E enter or steal a car · Mouse aim, Click shoot',
      'F punch · R reload · Space handbrake · P pause · M mute',
    ];
    let y = 250;
    for (const ln of lines) {
      text(ln, VIEW_W / 2, y, ln === '' ? 10 : 17, '#f5e6d0', 'center', 'normal');
      y += 26;
    }
    // Start prompt, always visible on a dark pill (a blinking prompt once
    // vanished from a screenshot when the frame landed between blinks).
    const prompt = save ? 'ENTER — CONTINUE  ·  N — NEW GAME' : 'ENTER OR CLICK — START THE STORY';
    ctx.font = font(22);
    const pw = ctx.measureText(prompt).width;
    ctx.fillStyle = 'rgba(10,8,14,0.8)';
    rr(VIEW_W / 2 - pw / 2 - 18, 472, pw + 36, 40, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(255,210,60,0.8)'; ctx.lineWidth = 1.5; ctx.stroke();
    text(prompt, VIEW_W / 2, 500, 22, '#ffffff', 'center');
    if (save) text(`Save found: $${save.cash.toLocaleString('en-US')} · ${save.missionsDone}/6 jobs done`, VIEW_W / 2, 536, 15, '#7dff9a', 'center', 'normal');
    text('An original open-world crime game. No real city, person or brand appears in it.', VIEW_W / 2, 690, 12, 'rgba(245,230,208,0.6)', 'center', 'normal');
  }

  function drawPaused() {
    ctx.fillStyle = 'rgba(8,6,12,0.6)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(VIEW_W / 2 - 260, VIEW_H / 2 - 130, 520, 260, 'PAUSED');
    text('The city waits for no one — except right now.', VIEW_W / 2, VIEW_H / 2 - 30, 16, '#f5e6d0', 'center', 'normal');
    text('P or Click — resume · M — mute · R — restart the current job', VIEW_W / 2, VIEW_H / 2 + 10, 14, '#d8b48f', 'center', 'normal');
    text('Progress saves automatically after every job.', VIEW_W / 2, VIEW_H / 2 + 44, 14, '#7dff9a', 'center', 'normal');
  }

  function drawEnd(title, lines, prompt, color) {
    ctx.fillStyle = 'rgba(8,6,12,0.62)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    panel(VIEW_W / 2 - 300, VIEW_H / 2 - 150, 600, 300, title, color);
    let y = VIEW_H / 2 - 62;
    for (const ln of lines) {
      text(ln, VIEW_W / 2, y, 16, '#f5e6d0', 'center', 'normal');
      y += 26;
    }
    text(prompt, VIEW_W / 2, VIEW_H / 2 + 108, 18, '#ffd23c', 'center');
  }

  function drawComplete(state) {
    const m = state.mission;
    const cash = state.player.cash;
    drawEnd('JOB DONE', [
      m ? `${m.title} — complete.` : 'Job complete.',
      `Cash on hand: $${cash.toLocaleString('en-US')}`,
      `${state.missionsDone} of 6 jobs finished.`,
      m && m.epilogue ? 'The boat is waiting at the pier. Jax is free.' : 'Ray is already lining up the next one…',
    ], 'The next job starts in a moment…', '#7dff9a');
  }

  function drawEpilogue(state) {
    drawEnd('THE LONG GOODBYE', [
      'Six jobs. Five stars. One boat.',
      'Jax Marlowe leaves Port Vermilion behind —',
      'richer, faster, and still wanted in three districts.',
      '',
      `Final cash: $${state.player.cash.toLocaleString('en-US')} · Cars stolen: ${state.stats.carsStolen}`,
    ], 'ENTER — keep driving in free roam', '#ffd23c');
  }

  // ---- main draw ---------------------------------------------------------------
  function draw(state, screen, save) {
    _t = state.time;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#120a14';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    if (screen === 'title') { drawTitle(state, save); return; }
    // World view.
    ctx.save();
    ctx.translate(-Math.round(state.cam.x), -Math.round(state.cam.y));
    drawGround(state);
    drawBuildings(state);
    drawPickups(state);
    // Draw cars: parked/traffic first, police + player car last.
    const cars = [...state.cars].sort((a, b) => (a.driver === 'player' ? 1 : 0) - (b.driver === 'player' ? 1 : 0));
    for (const car of cars) drawCar(car, car.driver === 'player');
    for (const ped of state.peds) drawPed(ped);
    for (const g of state.goons) drawGoon(g);
    drawPlayer(state);
    drawParts(state);
    // Mission target beacon.
    const m = state.mission;
    if (m && m.target && !m.done) {
      const pulse = 1 + 0.25 * Math.sin(state.time * 5);
      ctx.save();
      ctx.translate(m.target.x, m.target.y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ffd23c';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#ffd23c';
      ctx.beginPath(); ctx.moveTo(0, -14); ctx.lineTo(10, 8); ctx.lineTo(-10, 8); ctx.closePath(); ctx.fill();
      ctx.restore();
      // Off-screen direction arrow at the view edge, kept clear of the HUD.
      const px = clamp(m.target.x, state.cam.x + 330, state.cam.x + VIEW_W - 350);
      const py = clamp(m.target.y, state.cam.y + 140, state.cam.y + VIEW_H - 230);
      if (px !== m.target.x || py !== m.target.y) {
        const a = Math.atan2(m.target.y - state.player.y, m.target.x - state.player.x);
        ctx.save();
        ctx.translate(px, py);
        ctx.rotate(a);
        ctx.fillStyle = '#ffd23c';
        ctx.beginPath(); ctx.moveTo(16, 0); ctx.lineTo(-8, -10); ctx.lineTo(-8, 10); ctx.closePath(); ctx.fill();
        ctx.restore();
        const d = Math.round(dist(state.player.x, state.player.y, m.target.x, m.target.y));
        text(`${d}m`, px, py - 18, 13, '#ffd23c', 'center');
      }
    }
    ctx.restore();
    // Vignette for the sunset mood.
    const vg = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.45, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.95);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, 'rgba(20,8,20,0.35)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    // Low-health pulse.
    if (state.player.health < 30 && screen === 'playing') {
      ctx.fillStyle = `rgba(255,0,0,${0.1 + 0.08 * Math.sin(state.time * 6)})`;
      ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    }
    drawHud(state, screen);
    if (screen === 'paused') drawPaused();
    else if (screen === 'busted') drawEnd('BUSTED', ['The Vermilion PD finally got their hands on you.', 'They took $200 in “processing fees”.', 'The job is still open — if you still want it.'], 'ENTER — walk out and try again', '#2a6aff');
    else if (screen === 'wasted') drawEnd('WASTED', ['St. Vera Hospital patched you up. Again.', 'The bill was $300. The debt is still yours.'], 'ENTER — get back on the street', '#ff4d4d');
    else if (screen === 'failed') drawEnd('JOB FAILED', [state.mission?.failReason || 'The job fell apart.', 'Ray is not happy. But he still needs you.'], 'ENTER — run it back', '#ff4d4d');
    else if (screen === 'complete') drawComplete(state);
    else if (screen === 'epilogue') drawEpilogue(state);
  }

  return { draw };
}

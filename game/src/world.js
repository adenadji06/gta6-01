// Harbor Heat — world generation: roads, blocks, buildings, parked cars.
// Deterministic: one seeded RNG so every load builds the same Port Vermilion.
import { MAP_W, MAP_H, ROADS_V, ROADS_H, ROAD_W, SOUTH_ROAD, GT, WALK_CAR, CAR_COLORS } from './config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function onRoad(x, y, pad = 0) {
  const half = ROAD_W / 2 + pad;
  for (const rx of ROADS_V) if (Math.abs(x - rx) <= half) return true;
  for (const ry of ROADS_H) if (Math.abs(y - ry) <= half) return true;
  if (Math.abs(y - SOUTH_ROAD.y) <= half && x >= SOUTH_ROAD.x0 - half && x <= SOUTH_ROAD.x1 + half) return true;
  return false;
}

export function nearestRoadPoint(x, y) {
  // Closest point on any road centre line (used for police spawns).
  let best = null; let bd = Infinity;
  const consider = (px, py) => {
    const d = (px - x) * (px - x) + (py - y) * (py - y);
    if (d < bd) { bd = d; best = { x: px, y: py }; }
  };
  for (const rx of ROADS_V) consider(rx, Math.max(0, Math.min(MAP_H, y)));
  for (const ry of ROADS_H) consider(Math.max(0, Math.min(MAP_W, x)), ry);
  consider(Math.max(SOUTH_ROAD.x0, Math.min(SOUTH_ROAD.x1, x)), SOUTH_ROAD.y);
  return best;
}

export function buildWorld() {
  const rand = mulberry32(1337);
  const buildings = [];
  const palette = ['#6b5d4f', '#7a6a58', '#5d6b7a', '#715f6b', '#4f6b5d', '#8a7a5a', '#5a5a6b', '#7a5a4a'];
  // Blocks are the cells between road lines; drop 1–3 buildings per block.
  const xs = [0, ...ROADS_V, MAP_W];
  const ys = [0, ...ROADS_H, MAP_H];
  for (let bi = 0; bi < xs.length - 1; bi++) {
    for (let bj = 0; bj < ys.length - 1; bj++) {
      const x0 = xs[bi] + ROAD_W / 2 + 14;
      const x1 = xs[bi + 1] - ROAD_W / 2 - 14;
      const y0 = ys[bj] + ROAD_W / 2 + 14;
      const y1 = ys[bj + 1] - ROAD_W / 2 - 14;
      if (x1 - x0 < 90 || y1 - y0 < 90) continue;
      // The bay: south edge of the Docks/Marina is water, not buildings.
      const n = 1 + Math.floor(rand() * 3);
      for (let k = 0; k < n; k++) {
        const w = 60 + rand() * 110;
        const h = 50 + rand() * 90;
        const bx = x0 + rand() * Math.max(1, (x1 - x0) - w);
        const by = y0 + rand() * Math.max(1, (y1 - y0) - h);
        // Keep the safehouse clearing free.
        if (bx < 640 && by < 720 && bx + w > 380 && by + h > 380) continue;
        // Keep the south water strip clear (y > 1740 in Docks/Marina).
        if (by + h > 1740 && bx < 2240) continue;
        buildings.push({
          x: bx, y: by, w, h,
          color: palette[Math.floor(rand() * palette.length)],
          roof: rand() > 0.5,
          tall: rand() > 0.72,
        });
      }
    }
  }

  // Parked cars along road edges (stealable; not the GT).
  const parked = [];
  const parkSpots = [
    { x: 320, y: 700, angle: Math.PI / 2 }, { x: 960, y: 500, angle: -Math.PI / 2 },
    { x: 1600, y: 700, angle: Math.PI / 2 }, { x: 2240, y: 1200, angle: -Math.PI / 2 },
    { x: 700, y: 320, angle: 0 }, { x: 1300, y: 960, angle: Math.PI },
    { x: 1900, y: 320, angle: 0 }, { x: 500, y: 1600, angle: Math.PI },
    { x: 1100, y: 1600, angle: 0 }, { x: 2000, y: 960, angle: Math.PI },
  ];
  parkSpots.forEach((s, i) => parked.push({
    x: s.x, y: s.y, angle: s.angle, color: CAR_COLORS[i % CAR_COLORS.length],
    parked: true, name: 'Parked car',
  }));
  // The GT and the walk-path sedan are fixed, always present.
  parked.push({ x: GT.x, y: GT.y, angle: 0, color: GT.color, parked: true, isGT: true, name: 'GT' });
  parked.push({ x: WALK_CAR.x, y: WALK_CAR.y, angle: Math.PI / 2, color: WALK_CAR.color, parked: true, name: 'Sedan' });

  // Piers along the south edge (The Docks / Marina).
  const piers = [
    { x: 500, y: 1800, w: 26, h: 120 },
    { x: 1100, y: 1800, w: 26, h: 120 },
    { x: 1500, y: 1800, w: 26, h: 130 },
    { x: 2000, y: 1800, w: 26, h: 120 },
  ];

  return { buildings, parked, piers };
}

// Circle vs building-rect collision: push the circle out, return corrected pos.
export function collideBuildings(buildings, x, y, r) {
  let nx = x; let ny = y;
  for (const b of buildings) {
    const cx = Math.max(b.x, Math.min(nx, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ny, b.y + b.h));
    const dx = nx - cx; const dy = ny - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        nx = cx + (dx / d) * r;
        ny = cy + (dy / d) * r;
      } else {
        ny = b.y - r;
      }
    }
  }
  return { x: Math.max(r, Math.min(MAP_W - r, nx)), y: Math.max(r, Math.min(MAP_H - r, ny)) };
}

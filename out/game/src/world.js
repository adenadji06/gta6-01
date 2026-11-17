// Harbor Heat — Port Vermilion itself: a seeded grid city with roads,
// blocks, buildings, parks, the beach and the bay. Pure layout + collision;
// nothing here knows about the player, the police or the story.
import {
  BLOCK_H, BLOCK_W, DISTRICTS, LANDMARKS, PAL, ROADS_X, ROADS_Y, ROAD_W,
  WORLD_H, WORLD_W, clamp, mulberry32,
} from './config.js';

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const props = []; // lamps, hydrants, benches, signs
  const parks = [];
  const signs = []; // neon signs with text, drawn on rooftops / walls

  // One building (or two) per block, placed inside the block's inset.
  for (let bx = 0; bx < ROADS_X.length - 1; bx++) {
    for (let by = 0; by < ROADS_Y.length - 1; by++) {
      const x0 = ROADS_X[bx] + ROAD_W / 2 + 14;
      const y0 = ROADS_Y[by] + ROAD_W / 2 + 14;
      const x1 = ROADS_X[bx + 1] - ROAD_W / 2 - 14;
      const y1 = ROADS_Y[by + 1] - ROAD_W / 2 - 14;
      if (y1 > 3060) continue; // the bay shore stays open beach
      const roll = rng();
      if (roll < 0.14) {
        // Park block: grass, trees, benches, a pond ellipse.
        parks.push({ x: x0, y: y0, w: x1 - x0, h: y1 - y0 });
        const n = 6 + Math.floor(rng() * 6);
        for (let i = 0; i < n; i++) {
          trees.push({ x: x0 + 20 + rng() * (x1 - x0 - 40), y: y0 + 20 + rng() * (y1 - y0 - 40), r: 12 + rng() * 8 });
        }
        continue;
      }
      const split = rng() < 0.45;
      const mk = (ax, ay, aw, ah) => {
        const color = PAL.buildingRoof[Math.floor(rng() * PAL.buildingRoof.length)];
        buildings.push({ x: ax, y: ay, w: aw, h: ah, color, hgt: 8 + Math.floor(rng() * 22), seed: rng() });
      };
      if (split && x1 - x0 > 260) {
        const mid = x0 + (x1 - x0) * (0.42 + rng() * 0.16);
        mk(x0, y0, mid - x0 - 10, y1 - y0);
        mk(mid + 10, y0, x1 - mid - 10, y1 - y0);
      } else {
        mk(x0, y0, x1 - x0, y1 - y0);
      }
      // Street props around the block's edge.
      const nProp = 2 + Math.floor(rng() * 3);
      for (let i = 0; i < nProp; i++) {
        props.push({
          kind: rng() < 0.6 ? 'lamp' : 'hydrant',
          x: x0 + rng() * (x1 - x0),
          y: rng() < 0.5 ? y0 - 8 : y1 + 8,
        });
      }
    }
  }

  // Neon signs on a few downtown / marina rooftops (original names only).
  const signTexts = ['HOTEL LUNA', 'NEON BAR', 'PIZZA BAY', '24H TACOS', 'CINEMA REX', 'CLUB VOLT', 'GYM IRON', 'DONUT KING'];
  for (let i = 0; i < signTexts.length; i++) {
    const b = buildings[Math.floor(rng() * buildings.length)];
    if (!b) break;
    signs.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, text: signTexts[i], color: i % 2 ? PAL.pink : PAL.cyan });
  }

  // Landmark pads: flat open areas so mission spots are reachable on foot.
  const pads = Object.values(LANDMARKS).map((l) => ({ x: l.x - 90, y: l.y - 70, w: 180, h: 140 }));
  // Clear any building overlapping a landmark pad.
  for (let i = buildings.length - 1; i >= 0; i--) {
    const b = buildings[i];
    if (pads.some((p) => b.x < p.x + p.w && b.x + b.w > p.x && b.y < p.y + p.h && b.y + b.h > p.y)) buildings.splice(i, 1);
  }

  return { seed, buildings, trees, props, parks, signs, pads };
}

// ---- queries ---------------------------------------------------------------
export function onRoad(x, y) {
  for (const rx of ROADS_X) if (Math.abs(x - rx) < ROAD_W / 2) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < ROAD_W / 2) return true;
  return false;
}
export function inWater(x, y) { return y > 3080; }
export function inBeach(x, y) { return y > 2960 && y <= 3080; }

export function buildingAt(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Circle vs building AABBs: push the circle out, return true on contact.
export function collideBuildings(city, p, r) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = clamp(p.x, b.x, b.x + b.w);
    const cy = clamp(p.y, b.y, b.y + b.h);
    const dx = p.x - cx, dy = p.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < r * r) {
      hit = true;
      if (d2 > 0.0001) {
        const d = Math.sqrt(d2);
        p.x = cx + (dx / d) * r;
        p.y = cy + (dy / d) * r;
      } else {
        p.x += r; // centre inside the box: shove out along x
      }
    }
  }
  return hit;
}

export function clampToWorld(p, m = 24) {
  p.x = clamp(p.x, m, WORLD_W - m);
  p.y = clamp(p.y, m, WORLD_H - m);
}

// Nearest point on the road network (for spawning traffic / placing cars).
export function nearestRoadPoint(x, y) {
  let best = null, bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y: clamp(y, 60, WORLD_H - 60) }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x: clamp(x, 60, WORLD_W - 60), y: ry }; }
  }
  return best;
}

export function districtAt(x, y) {
  for (const d of DISTRICTS) if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d.name;
  return 'PORT VERMILION';
}

// A random road position at least `minDist` from (x, y), for traffic spawns.
export function randomRoadPoint(rng, x, y, minDist) {
  for (let tries = 0; tries < 24; tries++) {
    const vertical = rng() < 0.5;
    const px = vertical
      ? ROADS_X[Math.floor(rng() * ROADS_X.length)]
      : 120 + rng() * (WORLD_W - 240);
    const py = vertical
      ? 120 + rng() * (WORLD_H - 240)
      : ROADS_Y[Math.floor(rng() * ROADS_Y.length)];
    if (Math.hypot(px - x, py - y) >= minDist) return { x: px, y: py };
  }
  return { x: ROADS_X[4], y: ROADS_Y[4] };
}

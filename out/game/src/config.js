// Harbor Heat — tuning constants and the fictional city bible.
// Everything here is original: Port Vermilion, its districts, people and
// cars were invented for this game. No real place, person or brand is used.
export const VIEW_W = 1280;
export const VIEW_H = 720;

// World: a 4800 x 3600 harbour city. South edge is the bay.
export const WORLD_W = 4800;
export const WORLD_H = 3600;
export const ROAD_W = 92;
export const BLOCK_W = 372;
export const BLOCK_H = 268;
// Grid lines of the road network (centres), derived from block size.
export const ROADS_X = [240, 704, 1168, 1632, 2096, 2560, 3024, 3488, 3952, 4416];
export const ROADS_Y = [200, 560, 920, 1280, 1640, 2000, 2360, 2720, 3080];

export const DISTRICTS = [
  { name: 'OLD TOWN', x: 0, y: 0, w: 1500, h: 1200, tint: '#8a6f4d' },
  { name: 'DOWNTOWN', x: 1500, y: 0, w: 1800, h: 1200, tint: '#5d6b8a' },
  { name: 'NORTH HILLS', x: 3300, y: 0, w: 1500, h: 1200, tint: '#4d7a5a' },
  { name: 'THE DOCKS', x: 0, y: 1200, w: 1500, h: 1200, tint: '#7a5a4d' },
  { name: 'MARINA', x: 1500, y: 1200, w: 1800, h: 1200, tint: '#3f7a8a' },
  { name: 'SOUTH BEACH', x: 3300, y: 1200, w: 1500, h: 1200, tint: '#8a7a4d' },
  { name: 'THE BAY', x: 0, y: 3080, w: 4800, h: 520, tint: '#1d5a74' },
];

// Sunset palette.
export const PAL = {
  asphalt: '#3a3f4a',
  asphaltDark: '#31363f',
  lane: '#e8d27a',
  sidewalk: '#6b6258',
  grass: '#4d7a45',
  sand: '#c9a86a',
  water: '#1d5a74',
  waterDeep: '#14455c',
  buildingRoof: ['#7a4d5a', '#5a6b8a', '#8a6f4d', '#4d7a6b', '#6b4d7a', '#94552f'],
  neon: '#ff7a3c',
  pink: '#ff4d8a',
  cyan: '#3cd6e8',
};

export const CAR_TYPES = {
  sedan:   { len: 46, wid: 22, accel: 420, top: 430, grip: 3.4, color: '#c9c9c9' },
  taxi:    { len: 46, wid: 22, accel: 400, top: 410, grip: 3.4, color: '#f2c230' },
  coupe:   { len: 44, wid: 21, accel: 560, top: 560, grip: 4.2, color: '#ff4d6a' },
  sports:  { len: 46, wid: 22, accel: 680, top: 640, grip: 4.8, color: '#ff7a3c' },
  truck:   { len: 62, wid: 26, accel: 300, top: 330, grip: 2.6, color: '#7a8a99' },
  van:     { len: 54, wid: 24, accel: 340, top: 360, grip: 2.8, color: '#8a9a6b' },
  police:  { len: 48, wid: 22, accel: 620, top: 600, grip: 4.6, color: '#1d2a3a' },
};

// Landmarks the story and the minimap point at (all fictional).
export const LANDMARKS = {
  garage:   { x: 1168, y: 920,  label: "RAY'S GARAGE" },
  docks:    { x: 500,  y: 2000, label: 'THE DOCKS' },
  marina:   { x: 2400, y: 2000, label: 'MARINA' },
  bank:     { x: 2560, y: 560,  label: 'HARBOR BANK' },
  safehouse:{ x: 704,  y: 560,  label: 'SAFEHOUSE' },
  hills:    { x: 3952, y: 560,  label: 'NORTH HILLS' },
  pier:     { x: 3488, y: 3080, label: 'THE PIER' },
  hospital: { x: 1632, y: 1640, label: 'ST. VERA HOSPITAL' },
};

export const SAVE_KEY = 'harbor-heat-save-v1';
export const MISSION_REWARDS = [400, 900, 1400, 2000, 5000, 10000];

export function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(ax, ay, bx, by) { return Math.hypot(bx - ax, by - ay); }
export function angDiff(a, b) {
  let d = (b - a) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}
// Deterministic RNG so staged screenshots and the city are stable per seed.
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

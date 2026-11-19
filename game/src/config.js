// Harbor Heat — configuration: map, districts, tuning, mission data.
// Port Vermilion is a fictional city. All names, people and places are original.
export const MAP_W = 2560;
export const MAP_H = 1920;
export const VIEW_W = 1280;
export const VIEW_H = 720;

// Road centre lines (road width 96). The grid carries all traffic and mission targets.
export const ROADS_V = [320, 960, 1600, 2240];
export const ROADS_H = [320, 960, 1600];
export const ROAD_W = 96;
// South-edge marina road (partial): piers and the finale sit on it.
export const SOUTH_ROAD = { y: 1800, x0: 960, x1: 2240 };

export const DISTRICTS = [
  { name: 'Old Town', x0: 0, y0: 0, x1: 960, y1: 960, ground: '#3d4a35' },
  { name: 'Downtown', x0: 960, y0: 0, x1: 1920, y1: 960, ground: '#45424a' },
  { name: 'North Hills', x0: 1920, y0: 0, x1: 2560, y1: 960, ground: '#2f4433' },
  { name: 'The Docks', x0: 0, y0: 960, x1: 960, y1: 1920, ground: '#4a4038' },
  { name: 'Marina', x0: 960, y0: 960, x1: 1920, y1: 1920, ground: '#33505a' },
  { name: 'South Beach', x0: 1920, y0: 960, x1: 2560, y1: 1920, ground: '#5a4a33' },
];

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d.name;
  }
  return 'Port Vermilion';
}

// Player spawn (on foot, by the safehouse in Old Town).
export const SPAWN = { x: 480, y: 560 };
export const SAFEHOUSE = { x: 480, y: 480 };
// Jax's own GT — entering it is not a crime.
export const GT = { x: 560, y: 640, color: '#c8332b', name: 'GT' };
// A parked sedan right on the D+S walk path from spawn (live play-test route).
export const WALK_CAR = { x: 640, y: 700, color: '#2b6cb0', name: 'Sedan' };

export const TUNING = {
  walkSpeed: 195,
  carAccel: 620,
  carBrake: 900,
  carReverse: 260,
  carMaxSpeed: 540,
  carDrag: 0.55,
  turnBase: 2.6,
  turnFloor: 0.45,
  trafficCount: 22,
  pedCount: 36,
  maxWanted: 5,
  wantedCooldown: 4,
  bustCashLoss: 0.10,
  bustHoldSeconds: 1.5,
  pistolAmmo: 24,
  heatDecaySeconds: 9,
};

export const CAR_COLORS = [
  '#c8332b', '#2b6cb0', '#d9a441', '#3f9e4d', '#8e44ad',
  '#e67e22', '#1abc9c', '#95a5a6', '#34495e', '#f1c40f',
];

export const MISSIONS = [
  {
    id: 1, name: 'First Wheels',
    briefing: 'Get in your GT and drive to the Downtown paint shop.',
    objective: 'Reach the Downtown paint shop',
    target: { x: 1600, y: 320 }, reward: 500, timer: 0,
  },
  {
    id: 2, name: 'The Collector',
    briefing: 'Pick up the package on Marina Row, then drop it in Old Town.',
    objective: 'Pick up the package on Marina Row',
    target: { x: 1400, y: 960 }, reward: 500, timer: 0,
    stage2: { objective: 'Deliver the package to Old Town', target: { x: 480, y: 320 }, reward: 500 },
  },
  {
    id: 3, name: 'Hot Delivery',
    briefing: 'Three minutes. Two stars on your tail. Get the parcel to the Docks.',
    objective: 'Deliver to the Docks before the timer runs out',
    target: { x: 480, y: 1600 }, reward: 1000, timer: 180, startWanted: 2,
  },
  {
    id: 4, name: 'Heat Wave',
    briefing: 'The VPD is all over you. Lose the tail — get your wanted level to zero.',
    objective: 'Lose the VPD tail (wanted to zero)',
    target: null, reward: 800, timer: 150,
  },
  {
    id: 5, name: 'The Harbor Job',
    briefing: 'Grab the dock truck at the pier, then run it down to South Beach.',
    objective: 'Grab the dock truck at the pier',
    target: { x: 700, y: 1600 }, reward: 1000, timer: 0,
    stage2: { objective: 'Drive the truck to South Beach', target: { x: 2240, y: 1600 }, reward: 2500 },
  },
  {
    id: 6, name: 'The Long Goodbye',
    briefing: 'One last drive. Meet the boat at the Marina pier and disappear.',
    objective: 'Reach the Marina pier',
    target: { x: 1500, y: 1800 }, reward: 5000, timer: 0,
  },
];

export const SAVE_KEY = 'harborheat-save-v5';

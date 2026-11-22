// Neon Tide — config.js
// Every tuning number for the game lives here so the rest of the code
// reads like a description of Solmar Bay instead of a pile of literals.

export const WORLD = {
  width: 3600,
  height: 3200,
  roadWidth: 96,
  laneWidth: 48,
  // Road centre lines form the city grid. The strip east of x=3200 is beach + ocean.
  roadXs: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  roadYs: [200, 600, 1000, 1400, 1800, 2200, 2600, 3000],
  beachX: 3050,
  oceanX: 3220,
};

export const DISTRICTS = [
  { name: 'Old Town', x: 0, y: 0, w: 1100, h: 1100, style: 'old' },
  { name: 'Downtown', x: 1100, y: 1100, w: 1300, h: 1300, style: 'downtown' },
  { name: 'The Marina', x: 2100, y: 2200, w: 1100, h: 1000, style: 'marina' },
  { name: 'Palm Heights', x: 0, y: 2200, w: 1100, h: 1000, style: 'suburb' },
  { name: 'North Park', x: 2100, y: 0, w: 1100, h: 1100, style: 'park' },
];

export const PLAYER = {
  walkSpeed: 210,
  sprintSpeed: 330,
  radius: 13,
  maxHealth: 100,
  punchDamage: 12,
  bulletDamage: 34,
  fireCooldown: 0.22,
  bulletSpeed: 900,
};

export const CAR = {
  accel: 520,
  reverseAccel: 300,
  maxSpeed: 560,
  maxReverse: 180,
  turnRate: 2.6,
  grip: 3.2,
  brake: 700,
  handbrakeGrip: 1.1,
};

export const TRAFFIC = {
  count: 26,
  speed: 150,
  minGap: 46,
};

export const PEDS = { count: 42, speed: 55 };

export const POLICE = {
  maxCars: 6,
  carSpeed: 520,
  ramDamage: 6,
  footSpeed: 240,
  // Seconds the player must stay out of every cop's sight to drop a star.
  loseSightSeconds: 9,
  sightRange: 620,
};

export const WANTED = {
  stealCar: 1,
  hitPed: 2,
  shoot: 2,
  killCop: 3,
  max: 5,
};

export const COLORS = {
  grass: '#7fae5a',
  grassDark: '#74a24f',
  sand: '#e8d29a',
  ocean: '#2f7fb8',
  oceanDeep: '#256b9e',
  road: '#3a3f46',
  roadEdge: '#2c3036',
  lane: '#d8c95a',
  sidewalk: '#9aa0a3',
  buildingRoof: ['#b5654a', '#c98a4b', '#7d8aa0', '#a06a7d', '#5f7d6a', '#8a6f4d'],
  downtownRoof: ['#5a6b84', '#6b7d94', '#4e5f78', '#7d94a8'],
  park: '#5d9b4e',
  carPalette: ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#2c3e50', '#8e44ad', '#e67e22', '#16a085', '#d35400'],
  policeCar: '#e8e8e8',
  policeLight: ['#ff2d2d', '#2d7bff'],
  hud: '#101820',
};

export const SAVE_KEY = 'neon-tide-save-v1';

export const VIEW = { width: 1280, height: 720 };

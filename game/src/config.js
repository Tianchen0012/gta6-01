// Tunable constants for Solmar — Streets of Gold. One place for every number the
// world, the cars, the police and the missions share, so balance lives here, not
// scattered through the update code.
export const STEP = 1 / 60;
export const SAVE_KEY = 'solmar-streets-of-gold-save-v1';

// World layout: a 10-by-10 street grid. Roads are 64 px wide, blocks 296 px.
export const CITY_SIZE = 3600;
export const ROAD_WIDTH = 64;
export const BLOCK = 360;
export const ROAD_COUNT = 10;

// On-foot movement.
export const WALK_SPEED = 175;
export const SPRINT_SPEED = 265;

// Driving: arcade handling, forgiving on purpose.
export const CAR_ACCEL = 620;
export const CAR_BRAKE = 900;
export const CAR_REVERSE_MAX = 220;
export const CAR_MAX_SPEED = 560;
export const POLICE_MAX_SPEED = 600;
export const TRAFFIC_SPEED = 150;
export const CAR_STEER = 2.6;

// Combat.
export const PLAYER_MAX_HEALTH = 100;
export const PISTOL_DAMAGE = 34;
export const PISTOL_MAG = 12;
export const PISTOL_RANGE = 520;
export const PISTOL_RATE = 0.22;
export const ENEMY_HEALTH = 68;

// Wanted: points decay when no officer can see the player.
export const WANTED_DECAY = 2.2;
export const WANTED_CRIME_CAR = 1;
export const WANTED_CRIME_HIT_PED = 2;
export const WANTED_CRIME_SHOOT = 1;
export const WANTED_CRIME_KILL_COP = 3;

// Rewards.
export const MISSION_REWARDS = [400, 650, 900, 1200, 2500];
export const START_CASH = 150;

// Colours: a warm, sun-soaked coastal palette, all drawn, no image files.
export const COLORS = {
  grass: '#7fae62',
  grassDark: '#74a258',
  sand: '#e8d9a0',
  water: '#2f7fa8',
  waterDeep: '#256b90',
  road: '#3a3f46',
  roadEdge: '#2c3036',
  sidewalk: '#b9b3a4',
  lane: '#d8c95a',
  buildingRoof: ['#c96f4a', '#b85c5c', '#7d8aa0', '#a08a5c', '#5c8a7d', '#946b8f', '#8a7a5c', '#6b7d9e'],
  buildingEdge: '#00000033',
  parkTree: '#3f7d3a',
  parkTreeDark: '#356b31',
  carColors: ['#d64545', '#3f7fd6', '#e8c33f', '#e8e8e8', '#3a3a3a', '#7fc94f', '#c96fd6', '#f08a2e'],
  policeCar: '#e8e8e8',
  taxi: '#f2c230',
};

// The screenshot scenes behind ?shot=start|drive|foot|mission. Each one plays the
// real game forward from a fresh world for a fixed number of steps, steering the
// player with a simple autopilot, so the frame is what real play looks like —
// never a posed mock-up — and the same seed always gives the same frame.
import { STEP } from './config.js';
import { SCREEN_BUSTED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 6;
const FOOT_SECONDS = 8;

/** A stub input that holds one driving direction, so the world can be stepped. */
function stubInput(ax, ay) {
  return {
    axis() {
      return { x: ax, y: ay };
    },
    get sprint() {
      return false;
    },
  };
}

function stepWorld(world, seconds, input, mouseWorld) {
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    world.step(STEP, input, 0, mouseWorld);
  }
}

/**
 * Set `world` to the named scene and return the screen to draw over it.
 * start: the title screen over a living city. drive: a police chase in a stolen
 * car. foot: on foot among traffic and pedestrians. mission: the Plaza shootout.
 */
export function stageShot(name, world) {
  const state = world.state;
  const city = state.city;
  world.reset();

  if (name === 'drive') {
    // A stolen sedan tearing down the east-west avenue, two cruisers on its tail.
    // It starts mid-city so the chase stays among buildings, not at the edge.
    const road = city.centres[4];
    const car = state.cars[0];
    car.x = 900;
    car.y = road;
    car.angle = 0;
    car.speed = 420;
    world.enterCar(car);
    state.player.x = car.x;
    state.player.y = car.y;
    world.beginMission(1);
    // Three stars exactly: enterCar already added one point for the theft.
    state.wantedPoints = 3;
    state.wanted = 3;
    const cop1 = world.spawnCar(260, road - 18, 'police', 'police');
    cop1.angle = 0;
    cop1.speed = 500;
    state.police.push(cop1);
    const cop2 = world.spawnCar(140, road + 18, 'police', 'police');
    cop2.angle = 0;
    cop2.speed = 480;
    state.police.push(cop2);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    stepWorld(world, 4, stubInput(0, -1), { x: state.player.x + 400, y: state.player.y });
    // The drive may have clipped a pedestrian and raised the heat: pin the
    // wanted level back to the three stars this cover is meant to show.
    state.wantedPoints = 3;
    state.wanted = 3;
    state.message = '';
    state.messageTimer = 0;
    return { screen: SCREEN_PLAY };
  }

  if (name === 'foot') {
    // On foot at the plaza, traffic rolling past, pedestrians on the sidewalks.
    state.player.x = city.centres[6];
    state.player.y = city.centres[2] + 120;
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    const mouse = { x: state.player.x + 200, y: state.player.y - 100 };
    stepWorld(world, FOOT_SECONDS, stubInput(0, 0), mouse);
    return { screen: SCREEN_PLAY };
  }

  if (name === 'mission') {
    // The Plaza shootout: Jax facing the Vipers, wanted level climbing.
    world.beginMission(2);
    state.mission.step = 1;
    state.mission.kills = 1;
    state.player.x = city.plaza.x + 60;
    state.player.y = city.plaza.y + city.plaza.h - 40;
    state.player.health = 100;
    const e1 = world.spawnEnemy(city.plaza.x + 150, city.plaza.y + 60);
    const e2 = world.spawnEnemy(city.plaza.x + city.plaza.w - 50, city.plaza.y + 70);
    // Hold their fire for the first moments so the frame catches the standoff,
    // not the aftermath of a two-second gunfight.
    e1.shootTimer = 2.2;
    e2.shootTimer = 2.6;
    world.addWanted(2);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
    const mouse = { x: city.plaza.x + 150, y: city.plaza.y + 60 };
    // Let the scene settle, then fire once so a tracer is in the frame. The
    // whole staging lasts about a second and a half: long enough for the
    // camera to settle, short enough that the cruisers and the foot cop
    // closing in have not yet mauled the player.
    stepWorld(world, 1.2, stubInput(0, 0), mouse);
    world.step(STEP, stubInput(0, 0), 32, mouse);
    stepWorld(world, 0.25, stubInput(0, 0), mouse);
    state.mission.bannerTimer = 0;
    return { screen: SCREEN_PLAY };
  }

  // Default: the title screen over a city that has been living for a few seconds.
  stepWorld(world, START_SECONDS, stubInput(0, 0), null);
  return { screen: SCREEN_TITLE, best: state.stats.missionsDone };
}

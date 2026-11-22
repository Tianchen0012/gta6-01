// The story of Solmar: Jax Marlow, new in town, doing jobs for the fixer Mara Voss.
// Five missions, each a small state machine over the same world: drive somewhere,
// fight someone, or lose the police. All names, places and people are invented.
import { MISSION_REWARDS } from './config.js';

export const STORY_INTRO =
  'Jax Marlow came to Solmar with a duffel bag and a debt. The fixer Mara Voss has work for anyone fast enough — and dumb enough — to take it.';

// Each mission: a title, Mara's briefing, and the steps it walks through.
// A step is { kind, label, x, y, seconds?, kills? }; the world checks it off.
export const MISSIONS = [
  {
    title: 'First Wheels',
    briefing: 'Mara: "You need wheels before you need anything else. Take any car on the street and bring it to my garage up north."',
    reward: MISSION_REWARDS[0],
    steps: [
      { kind: 'steal', label: 'Steal a car (walk up to one and press E)', x: 0, y: 0 },
      { kind: 'goto', label: 'Drive to the North Garage', x: 540, y: 540 },
    ],
  },
  {
    title: 'Harbour Run',
    briefing: 'Mara: "A package for the docks. Pier 9, ninety seconds, no questions. The harbour cops are bored tonight — keep it that way."',
    reward: MISSION_REWARDS[1],
    steps: [
      { kind: 'goto', label: 'Drive to Pier 9 before the timer runs out', x: 1620, y: 3250, seconds: 90 },
    ],
  },
  {
    title: 'Street Heat',
    briefing: 'Mara: "The Vipers are leaning on my shops at the Plaza. Go remind them whose streets these are. Bring a gun — there will be three of them."',
    reward: MISSION_REWARDS[2],
    steps: [
      { kind: 'goto', label: 'Get to Solmar Plaza', x: 2340, y: 900 },
      { kind: 'kill', label: 'Deal with the Vipers (0/3)', x: 2340, y: 900, kills: 3 },
    ],
  },
  {
    title: 'Heat Wave',
    briefing: 'Mara: "You made the evening news, Jax. Three stars and every cruiser in Solmar is looking for you. Lose them, then get to the safehouse."',
    reward: MISSION_REWARDS[3],
    steps: [
      { kind: 'survive', label: 'Survive the heat — lose the wanted level', x: 3060, y: 2700, seconds: 45 },
      { kind: 'goto', label: 'Reach the Safehouse', x: 3060, y: 2700 },
    ],
  },
  {
    title: 'The Bay Job',
    briefing: 'Mara: "The big one. Bay Bank, midday, in and out. Grab the cash, then run — the whole city will be on you. Make it to the safehouse and we are both rich."',
    reward: MISSION_REWARDS[4],
    steps: [
      { kind: 'goto', label: 'Get to Bay Bank', x: 1980, y: 1980 },
      { kind: 'grab', label: 'Hold still in the bank to grab the cash', x: 1980, y: 1980, seconds: 3 },
      { kind: 'goto', label: 'Escape to the Safehouse — the police are coming', x: 3060, y: 2700 },
    ],
  },
];

export function missionCount() {
  return MISSIONS.length;
}

/** The label the HUD shows for the mission's current step. */
export function objectiveText(world) {
  const mission = MISSIONS[world.mission.index];
  if (!mission || world.mission.done) return 'All jobs done — Solmar is yours. Free roam!';
  const step = mission.steps[world.mission.step];
  let text = `${mission.title}: ${step.label}`;
  if (step.kind === 'kill') text = `${mission.title}: Deal with the Vipers (${world.mission.kills}/${step.kills})`;
  if (step.kind === 'survive') text = `${mission.title}: ${step.label} (${Math.ceil(world.mission.timer)}s)`;
  if (step.kind === 'grab') text = `${mission.title}: ${step.label} (${world.mission.grab.toFixed(1)}s)`;
  if (step.kind === 'goto' && step.seconds) text += ` (${Math.ceil(world.mission.timer)}s left)`;
  return text;
}

/** Begin a mission: reset its runtime state and arm its first step. */
export function beginMission(world, index) {
  const mission = MISSIONS[index];
  world.mission = {
    index,
    step: 0,
    timer: mission.steps[0].seconds ?? 0,
    kills: 0,
    grab: 0,
    done: false,
    failed: false,
    banner: mission.title,
    bannerTimer: 3,
  };
  if (index === 3) {
    // Heat Wave opens with the police already on the player.
    world.wanted = 3;
    world.wantedPoints = 3;
  }
  if (index === 4) world.wanted = 0;
  return mission;
}

/** Advance to the next step, or finish the mission and pay out. Returns 'done' | 'step' | null. */
export function advanceStep(world) {
  const mission = MISSIONS[world.mission.index];
  world.mission.step += 1;
  if (world.mission.step >= mission.steps.length) {
    world.mission.done = true;
    world.cash += mission.reward;
    world.stats.missionsDone += 1;
    world.audio.cash();
    return 'done';
  }
  const step = mission.steps[world.mission.step];
  world.mission.timer = step.seconds ?? 0;
  world.mission.grab = 0;
  world.audio.pickup();
  return 'step';
}

/**
 * Check the current step against the world; called every frame from the world
 * update. Returns 'done' when the mission completes, 'failed' when it fails.
 */
export function updateMission(world, dt) {
  const mission = MISSIONS[world.mission.index];
  if (!mission || world.mission.done) return null;
  const step = mission.steps[world.mission.step];
  const player = world.player;

  if (step.kind === 'steal') {
    if (player.inCar) return advanceStep(world);
    return null;
  }
  if (step.kind === 'goto') {
    const dx = player.x - step.x;
    const dy = player.y - step.y;
    if (dx * dx + dy * dy < 90 * 90) {
      return advanceStep(world);
    }
    if (step.seconds) {
      world.mission.timer -= dt;
      if (world.mission.timer <= 0) {
        world.mission.failed = true;
        return 'failed';
      }
    }
    return null;
  }
  if (step.kind === 'kill') {
    if (world.mission.kills >= step.kills) return advanceStep(world);
    return null;
  }
  if (step.kind === 'survive') {
    world.mission.timer -= dt;
    if (world.wanted === 0) return advanceStep(world);
    if (world.mission.timer <= 0) {
      world.mission.failed = true;
      return 'failed';
    }
    return null;
  }
  if (step.kind === 'grab') {
    const dx = player.x - step.x;
    const dy = player.y - step.y;
    if (dx * dx + dy * dy < 100 * 100) {
      world.mission.grab += dt;
      if (world.mission.grab >= step.seconds) {
        world.wanted = 4;
        world.wantedPoints = 4;
        return advanceStep(world);
      }
    } else {
      world.mission.grab = 0;
    }
    return null;
  }
  return null;
}

/** Where the current step wants the player to go, for the marker and minimap. */
export function missionMarker(world) {
  const mission = MISSIONS[world.mission.index];
  if (!mission || world.mission.done) return null;
  const step = mission.steps[world.mission.step];
  if (step.kind === 'steal') return null;
  return { x: step.x, y: step.y, label: step.label };
}

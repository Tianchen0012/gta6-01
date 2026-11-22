// Neon Tide — missions.js
// The story of Milo Kade, and the five jobs that pay off his debt to
// Odette Voss of the Vesper Club. Each mission is a small state machine:
// a list of objectives, each with a place on the map and a test for done.

export const STORY_INTRO =
  'Milo Kade drove out of Solmar Bay three years ago with a busted gearbox and a worse reputation. ' +
  'Now he is back, and Odette Voss — who owns the Vesper Club and half the waterfront — ' +
  'says his old debt is due. Five jobs, she says. Do them, and the slate is clean. ' +
  'Refuse, and the tide takes him.';

// place keys match city.landmarks; x/y are set from the city at mission start.
export const MISSIONS = [
  {
    id: 'homecoming',
    title: '1 · Homecoming',
    briefing: 'Odette wants to see you. Drive to the Vesper Club in Downtown and hear her out. Follow the gold marker — stealing a car is faster than walking, and nobody in Solmar minds much.',
    reward: 300,
    objectives: [
      { id: 'goto-club', text: 'Drive to the Vesper Club', place: 'vesperClub', kind: 'reach', radius: 130 },
      { id: 'talk', text: 'Step inside (walk to the door)', place: 'vesperClub', kind: 'reach', radius: 60, onFoot: true },
    ],
  },
  {
    id: 'the-pickup',
    title: '2 · The Pickup',
    briefing: 'A package is waiting at the Marina — a locked case, no questions. Collect it and bring it back to the Vesper Club. The Harbormen have been sniffing around the docks, so keep your eyes open.',
    reward: 500,
    objectives: [
      { id: 'goto-marina', text: 'Collect the case at the Marina', place: 'marina', kind: 'reach', radius: 120 },
      { id: 'return-club', text: 'Deliver the case to the Vesper Club', place: 'vesperClub', kind: 'reach', radius: 130, needsItem: true },
    ],
  },
  {
    id: 'hot-wheels',
    title: '3 · Hot Wheels',
    briefing: "Ray Calloway wants a Vesper GT — the purple one that cruises Palm Heights. Steal it and bring it to his chop shop. The cops will notice a stolen GT, so lose them or outrun them.",
    reward: 800,
    objectives: [
      { id: 'steal-gt', text: 'Steal the purple Vesper GT', kind: 'steal-gt' },
      { id: 'deliver-shop', text: 'Deliver the GT to the Chop Shop', place: 'chopShop', kind: 'reach', radius: 140, inCar: 'Vesper GT' },
    ],
  },
  {
    id: 'heat-wave',
    title: '4 · Heat Wave',
    briefing: 'The job went loud and Solmar PD is all over you. Survive three stars of heat for 60 seconds — stay moving, stay out of the cruisers\' way, and do not get caught on foot.',
    reward: 900,
    objectives: [
      { id: 'survive', text: 'Survive the heat: 60 seconds at 3 stars', kind: 'survive', seconds: 60, setWanted: 3 },
    ],
  },
  {
    id: 'the-marlin-job',
    title: '5 · The Marlin Job',
    briefing: 'The last job. A briefcase of Vesper money is changing hands on Sunset Pier, guarded by Harbormen. Take it, and the debt is gone. They will shoot — so will you.',
    reward: 2000,
    objectives: [
      { id: 'goto-pier', text: 'Reach Sunset Pier', place: 'pier', kind: 'reach', radius: 140 },
      { id: 'take-case', text: 'Take the briefcase from the Harbormen', kind: 'take-case', place: 'pier', radius: 90 },
      { id: 'escape', text: 'Escape to your Hideout', place: 'hideout', kind: 'reach', radius: 130, needsItem: true },
    ],
  },
];

export function createMissionState() {
  return {
    index: 0, // which mission is active
    objectiveIndex: 0,
    started: false,
    completed: [], // mission ids finished
    timer: 0,
    hasItem: false,
    gtStolen: false,
    caseTaken: false,
    enemies: [], // armed Harbormen for the finale
    message: null,
    messageTimer: 0,
  };
}

export function currentMission(state) {
  return MISSIONS[state.index] || null;
}

export function currentObjective(state) {
  const m = currentMission(state);
  return m ? m.objectives[state.objectiveIndex] : null;
}

export function startMission(state, index) {
  state.index = index;
  state.objectiveIndex = 0;
  state.started = true;
  state.timer = 0;
  state.hasItem = false;
  state.gtStolen = false;
  state.caseTaken = false;
  state.enemies = [];
}

// Advance the objective when its condition is met. Returns 'objective' | 'mission' | null.
export function advanceObjective(state) {
  const m = currentMission(state);
  if (!m) return null;
  state.objectiveIndex++;
  if (state.objectiveIndex >= m.objectives.length) {
    state.completed.push(m.id);
    state.started = false;
    state.hasItem = false;
    return 'mission';
  }
  return 'objective';
}

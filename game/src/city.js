// Neon Tide — city.js
// Builds Solmar Bay: a road grid, the blocks between the roads, the
// buildings on them, and the named places the story sends the player to.
// Everything is derived from one seed, so the city is the same every run.

import { WORLD, DISTRICTS, COLORS } from './config.js';
import { mulberry32, pick, range, int } from './rng.js';

export function districtAt(x, y) {
  for (const d of DISTRICTS) {
    if (x >= d.x && x < d.x + d.w && y >= d.y && y < d.y + d.h) return d;
  }
  return DISTRICTS[1];
}

export function buildCity(seed) {
  const rng = mulberry32(seed);
  const buildings = [];
  const trees = [];
  const colliders = []; // {x, y, w, h} axis-aligned solid rects
  const parks = [];

  const xs = WORLD.roadXs;
  const ys = WORLD.roadYs;
  const half = WORLD.roadWidth / 2;

  // One block sits between each pair of neighbouring roads.
  for (let i = 0; i < xs.length - 1; i++) {
    for (let j = 0; j < ys.length - 1; j++) {
      const bx = xs[i] + half + 14;
      const by = ys[j] + half + 14;
      const bw = xs[i + 1] - xs[i] - WORLD.roadWidth - 28;
      const bh = ys[j + 1] - ys[j] - WORLD.roadWidth - 28;
      const district = districtAt(bx + bw / 2, by + bh / 2);

      if (district.style === 'park') {
        parks.push({ x: bx, y: by, w: bw, h: bh });
        for (let t = 0; t < 14; t++) {
          trees.push({ x: range(rng, bx + 20, bx + bw - 20), y: range(rng, by + 20, by + bh - 20), r: range(rng, 9, 15) });
        }
        continue;
      }

      // Split the block into 1-4 buildings with a little breathing room.
      const cols = int(rng, 1, 2);
      const rows = int(rng, 1, 2);
      const gap = 18;
      const cw = (bw - gap * (cols - 1)) / cols;
      const ch = (bh - gap * (rows - 1)) / rows;
      for (let c = 0; c < cols; c++) {
        for (let r = 0; r < rows; r++) {
          if (rng() < 0.12) continue; // an empty lot, for variety
          const w = cw * range(rng, 0.55, 0.95);
          const h = ch * range(rng, 0.55, 0.95);
          const x = bx + c * (cw + gap) + (cw - w) / 2;
          const y = by + r * (ch + gap) + (ch - h) / 2;
          const tall = district.style === 'downtown' ? int(rng, 2, 5) : 1;
          const roof = district.style === 'downtown'
            ? pick(rng, COLORS.downtownRoof)
            : pick(rng, COLORS.buildingRoof);
          const b = { x, y, w, h, roof, tall, district: district.style };
          buildings.push(b);
          colliders.push({ x, y, w, h });
        }
      }
      // A few palm trees along the block's edge.
      for (let t = 0; t < 3; t++) {
        trees.push({ x: range(rng, bx, bx + bw), y: by + 4, r: range(rng, 7, 11) });
      }
    }
  }

  // Named story places, pinned to fixed spots so missions can find them.
  const landmarks = {
    vesperClub: { name: 'The Vesper Club', x: 1400, y: 1400, label: 'Vesper Club' },
    marina: { name: 'Solmar Marina', x: 2900, y: 2700, label: 'Marina' },
    chopShop: { name: "Ray's Chop Shop", x: 400, y: 2600, label: 'Chop Shop' },
    clinic: { name: 'Bay Clinic', x: 2600, y: 600, label: 'Clinic' },
    pier: { name: 'Sunset Pier', x: 3150, y: 1600, label: 'Pier' },
    park: { name: 'Palm Court Park', x: 2400, y: 400, label: 'Park' },
    hideout: { name: "Milo's Hideout", x: 600, y: 600, label: 'Hideout' },
  };

  return { buildings, trees, colliders, parks, landmarks, seed };
}

// True when the point is on a road (drivable) rather than inside a block.
export function onRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const rx of WORLD.roadXs) if (Math.abs(x - rx) <= half) return true;
  for (const ry of WORLD.roadYs) if (Math.abs(y - ry) <= half) return true;
  return false;
}

// Nearest road centre line to a point, used to snap traffic onto lanes.
export function nearestRoadX(x) {
  let best = WORLD.roadXs[0];
  for (const rx of WORLD.roadXs) if (Math.abs(rx - x) < Math.abs(best - x)) best = rx;
  return best;
}
export function nearestRoadY(y) {
  let best = WORLD.roadYs[0];
  for (const ry of WORLD.roadYs) if (Math.abs(ry - y) < Math.abs(best - y)) best = ry;
  return best;
}

// Axis-aligned rect vs the city's solid buildings. Returns the collider hit, or null.
export function hitBuilding(city, x, y, w, h) {
  for (const c of city.colliders) {
    if (x < c.x + c.w && x + w > c.x && y < c.y + c.h && y + h > c.y) return c;
  }
  return null;
}

// Clamp a point inside the playable world (ocean is a wall of water).
export function clampToWorld(x, y, margin = 16) {
  return {
    x: Math.max(margin, Math.min(WORLD.width - margin, x)),
    y: Math.max(margin, Math.min(WORLD.height - margin, y)),
  };
}

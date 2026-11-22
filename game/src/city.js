// The city of Solmar: a seeded street grid with blocks, buildings, parks, a beach
// and a harbour along the south edge. Everything the game draws and drives on comes
// from this one model, built once per game from the seed.
import { BLOCK, CITY_SIZE, COLORS, ROAD_COUNT, ROAD_WIDTH } from './config.js';

// Where a street centreline runs (roads are spaced BLOCK apart, inset half a block).
export function roadCentres() {
  const centres = [];
  for (let i = 0; i < ROAD_COUNT; i += 1) centres.push(BLOCK / 2 + i * BLOCK);
  return centres;
}

export function isOnRoad(x, y) {
  for (let i = 0; i < ROAD_COUNT; i += 1) {
    const c = BLOCK / 2 + i * BLOCK;
    if (Math.abs(x - c) < ROAD_WIDTH / 2 || Math.abs(y - c) < ROAD_WIDTH / 2) return true;
  }
  return false;
}

/** The nearest point on the road network to (x, y), snapped to a lane centre. */
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestDist = Infinity;
  for (let i = 0; i < ROAD_COUNT; i += 1) {
    const c = BLOCK / 2 + i * BLOCK;
    for (const point of [{ x: c, y }, { x, y: c }]) {
      const d = (point.x - x) ** 2 + (point.y - y) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = point;
      }
    }
  }
  return best;
}

export function buildCity(random) {
  const centres = roadCentres();
  const buildings = [];
  const parks = [];
  const trees = [];
  // The south strip is beach and harbour water; the north-east corner is the plaza.
  const beach = { x: 0, y: CITY_SIZE - 260, w: CITY_SIZE, h: 260 };
  const water = { x: 0, y: CITY_SIZE - 110, w: CITY_SIZE, h: 110 };
  const plaza = { x: centres[6] - 110, y: centres[2] - 110, w: 220, h: 220 };

  for (let bx = 0; bx < ROAD_COUNT - 1; bx += 1) {
    for (let by = 0; by < ROAD_COUNT - 1; by += 1) {
      const x0 = centres[bx] + ROAD_WIDTH / 2 + 14;
      const y0 = centres[by] + ROAD_WIDTH / 2 + 14;
      const w = BLOCK - ROAD_WIDTH - 28;
      const h = BLOCK - ROAD_WIDTH - 28;
      // Skip blocks that fall in the beach strip.
      if (y0 > CITY_SIZE - 300) continue;
      // The plaza block stays open.
      if (bx === 6 && by === 2) continue;
      if (random.chance(0.16)) {
        // A park block: grass and trees, walkable.
        parks.push({ x: x0, y: y0, w, h });
        const count = random.int(5, 9);
        for (let i = 0; i < count; i += 1) {
          trees.push({
            x: x0 + random.range(24, w - 24),
            y: y0 + random.range(24, h - 24),
            r: random.range(10, 18),
          });
        }
        continue;
      }
      // One or two buildings per block, with a gap between them.
      const split = random.chance(0.55);
      const spots = split
        ? [
            { x: x0, y: y0, w: w * 0.46, h },
            { x: x0 + w * 0.54, y: y0, w: w * 0.46, h },
          ]
        : [{ x: x0, y: y0, w, h }];
      for (const spot of spots) {
        const inset = random.chance(0.4) ? random.range(0, 40) : 0;
        buildings.push({
          x: spot.x + inset,
          y: spot.y + inset,
          w: spot.w - inset * 2,
          h: spot.h - inset * 2,
          color: random.pick(COLORS.buildingRoof),
          floors: random.int(1, 5),
        });
      }
    }
  }

  // Named landmarks the missions and the HUD can point at.
  const landmarks = [
    { name: 'Harbour Market', x: centres[2], y: centres[8] },
    { name: 'Solmar Plaza', x: centres[6], y: centres[2] },
    { name: 'Villa Rosa', x: centres[8], y: centres[4] },
    { name: 'North Garage', x: centres[1], y: centres[1] },
    { name: 'Bay Bank', x: centres[5], y: centres[5] },
    { name: 'Safehouse', x: centres[8], y: centres[7] },
    { name: 'Pier 9', x: centres[4], y: CITY_SIZE - 320 },
  ];

  return {
    size: CITY_SIZE,
    centres,
    buildings,
    parks,
    trees,
    beach,
    water,
    plaza,
    landmarks,
  };
}

/** Push a circle (x, y, r) out of every building it overlaps; returns true on a hit. */
export function collideBuildings(city, body) {
  let hit = false;
  for (const b of city.buildings) {
    const cx = Math.max(b.x, Math.min(body.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(body.y, b.y + b.h));
    const dx = body.x - cx;
    const dy = body.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 < body.r * body.r) {
      hit = true;
      if (d2 > 0.01) {
        const d = Math.sqrt(d2);
        body.x = cx + (dx / d) * body.r;
        body.y = cy + (dy / d) * body.r;
      } else {
        body.x += body.r;
      }
    }
  }
  return hit;
}

/** True when the point is in the sea (not walkable, not drivable). */
export function inWater(city, x, y) {
  return x >= city.water.x && x <= city.water.x + city.water.w && y >= city.water.y && y <= city.water.y + city.water.h;
}

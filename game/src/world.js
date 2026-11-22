// The living world: the player on foot or in a car, traffic that follows the street
// grid, pedestrians on the sidewalks, police who chase a wanted player, gang
// enemies, bullets, pickups and the mission state. One fixed-step update advances
// everything; the renderer only reads what is here.
import {
  BLOCK, CAR_ACCEL, CAR_BRAKE, CAR_MAX_SPEED, CAR_REVERSE_MAX, CAR_STEER,
  CITY_SIZE, COLORS, ENEMY_HEALTH, PISTOL_DAMAGE, PISTOL_MAG, PISTOL_RANGE,
  PISTOL_RATE, PLAYER_MAX_HEALTH, POLICE_MAX_SPEED, ROAD_WIDTH, SPRINT_SPEED,
  START_CASH, TRAFFIC_SPEED, WALK_SPEED, WANTED_CRIME_CAR, WANTED_CRIME_HIT_PED,
  WANTED_CRIME_KILL_COP, WANTED_CRIME_SHOOT, WANTED_DECAY,
} from './config.js';
import { buildCity, collideBuildings, inWater, isOnRoad, nearestRoadPoint } from './city.js';
import { beginMission, MISSIONS, updateMission } from './missions.js';

export const EVENT_NONE = 0;
export const EVENT_BUSTED = 1;
export const EVENT_MISSION_DONE = 2;
export const EVENT_MISSION_FAILED = 4;

const TAU = Math.PI * 2;

function dist2(a, b) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function angleTo(from, to) {
  return Math.atan2(to.y - from.y, to.x - from.x);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= TAU;
  while (d < -Math.PI) d += TAU;
  return d;
}

export function createWorld(random, audio) {
  const city = buildCity(random);
  const state = {
    random,
    audio,
    city,
    time: 0,
    clockMinutes: 9 * 60 + 20,
    cash: START_CASH,
    wanted: 0,
    wantedPoints: 0,
    player: null,
    cars: [],
    traffic: [],
    peds: [],
    police: [],
    footCops: [],
    enemies: [],
    bullets: [],
    particles: [],
    pickups: [],
    mission: { index: 0, step: 0, timer: 0, kills: 0, grab: 0, done: false, failed: false, banner: '', bannerTimer: 0 },
    stats: { missionsDone: 0, carsStolen: 0, pedsHit: 0, shotsFired: 0, distanceDriven: 0 },
    camera: { x: 0, y: 0 },
    shake: 0,
    busted: false,
    message: '',
    messageTimer: 0,
  };

  function spawnCar(x, y, kind, driver) {
    const car = {
      x, y,
      angle: random.range(0, TAU),
      speed: 0,
      color: kind === 'police' ? COLORS.policeCar : kind === 'taxi' ? COLORS.taxi : random.pick(COLORS.carColors),
      kind,
      driver,
      hp: 100,
      target: null,
      node: null,
      honkTimer: random.range(2, 8),
    };
    state.cars.push(car);
    return car;
  }

  function spawnPed(x, y) {
    const ped = {
      x, y,
      angle: random.range(0, TAU),
      speed: random.range(38, 68),
      color: random.pick(['#e8b04f', '#7fa8d6', '#d67f9e', '#8fd67f', '#c9c9c9', '#5c4a3a']),
      state: 'walk',
      stateTimer: random.range(2, 8),
      dead: false,
      deadTimer: 0,
      fleeX: 0,
      fleeY: 0,
    };
    state.peds.push(ped);
    return ped;
  }

  function spawnEnemy(x, y) {
    const enemy = {
      x, y,
      angle: 0,
      hp: ENEMY_HEALTH,
      shootTimer: random.range(0.5, 1.5),
      speed: 120,
      color: '#8a2f2f',
    };
    state.enemies.push(enemy);
    return enemy;
  }

  function spawnPickup(x, y, kind) {
    state.pickups.push({ x, y, kind, bob: random.range(0, TAU) });
  }

  function randomRoadPoint() {
    const centres = city.centres;
    const horizontal = random.chance(0.5);
    const c = random.pick(centres);
    const along = random.range(120, CITY_SIZE - 120);
    return horizontal ? { x: along, y: c } : { x: c, y: along };
  }

  function randomSidewalkPoint() {
    const centres = city.centres;
    const c = random.pick(centres);
    const along = random.range(120, CITY_SIZE - 120);
    const off = (random.chance(0.5) ? 1 : -1) * (ROAD_WIDTH / 2 + 14);
    return random.chance(0.5) ? { x: along, y: c + off } : { x: c + off, y: along };
  }

  function reset() {
    state.time = 0;
    state.clockMinutes = 9 * 60 + 20;
    state.cash = START_CASH;
    state.wanted = 0;
    state.wantedPoints = 0;
    state.cars = [];
    state.traffic = [];
    state.peds = [];
    state.police = [];
    state.footCops = [];
    state.enemies = [];
    state.bullets = [];
    state.particles = [];
    state.pickups = [];
    state.stats = { missionsDone: 0, carsStolen: 0, pedsHit: 0, shotsFired: 0, distanceDriven: 0 };
    state.busted = false;
    state.shake = 0;
    state.message = '';
    state.messageTimer = 0;
    state.player = {
      x: city.centres[6], y: city.centres[2] + 90,
      angle: -Math.PI / 2,
      r: 14,
      health: PLAYER_MAX_HEALTH,
      ammo: PISTOL_MAG,
      reserve: 60,
      reloading: 0,
      shootTimer: 0,
      inCar: null,
      speed: 0,
    };
    // Parked cars around the plaza and the streets.
    for (let i = 0; i < 9; i += 1) {
      const p = randomRoadPoint();
      const car = spawnCar(p.x, p.y, 'civilian', 'parked');
      car.angle = random.chance(0.5) ? 0 : Math.PI / 2;
      if (random.chance(0.2)) car.kind = 'taxi';
    }
    // Moving traffic.
    for (let i = 0; i < 11; i += 1) {
      const p = randomRoadPoint();
      const car = spawnCar(p.x, p.y, 'civilian', 'traffic');
      car.speed = TRAFFIC_SPEED * random.range(0.8, 1.15);
      car.node = nearestNode(p.x, p.y);
      car.target = pickNextNode(car.node, null, random);
      state.traffic.push(car);
    }
    for (let i = 0; i < 18; i += 1) {
      const p = randomSidewalkPoint();
      spawnPed(p.x, p.y);
    }
    for (let i = 0; i < 6; i += 1) {
      const p = randomSidewalkPoint();
      spawnPickup(p.x, p.y, i % 3 === 0 ? 'health' : i % 3 === 1 ? 'ammo' : 'cash');
    }
    beginMission(state, 0);
    state.camera.x = state.player.x;
    state.camera.y = state.player.y;
  }

  function nearestNode(x, y) {
    let best = { i: 0, j: 0 };
    let bestD = Infinity;
    for (let i = 0; i < city.centres.length; i += 1) {
      for (let j = 0; j < city.centres.length; j += 1) {
        const dx = city.centres[i] - x;
        const dy = city.centres[j] - y;
        const d = dx * dx + dy * dy;
        if (d < bestD) {
          bestD = d;
          best = { i, j };
        }
      }
    }
    return best;
  }

  function pickNextNode(node, from, random) {
    const options = [];
    if (node.i > 0) options.push({ i: node.i - 1, j: node.j });
    if (node.i < city.centres.length - 1) options.push({ i: node.i + 1, j: node.j });
    if (node.j > 0) options.push({ i: node.i, j: node.j - 1 });
    if (node.j < city.centres.length - 1) options.push({ i: node.i, j: node.j + 1 });
    const forward = options.filter((o) => !from || o.i !== from.i || o.j !== from.j);
    const pool = forward.length > 0 && random.chance(0.8) ? forward : options;
    return random.pick(pool);
  }

  function nodePos(node) {
    return { x: city.centres[node.i], y: city.centres[node.j] };
  }

  function addWanted(points) {
    state.wantedPoints = clamp(state.wantedPoints + points, 0, 5);
    state.wanted = Math.floor(state.wantedPoints);
  }

  function burst(x, y, color, count, speed) {
    for (let i = 0; i < count; i += 1) {
      const a = random.range(0, TAU);
      const s = random.range(speed * 0.3, speed);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: random.range(0.25, 0.6),
        maxLife: 0.6,
        color,
        size: random.range(2, 5),
      });
    }
  }

  function fireBullet(from, x, y, angle, speed, damage) {
    state.bullets.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: PISTOL_RANGE / speed,
      damage,
      from,
    });
  }

  function playerShoot(targetX, targetY) {
    const p = state.player;
    if (p.shootTimer > 0 || p.reloading > 0) return;
    if (p.ammo <= 0) {
      p.reloading = 1.1;
      return;
    }
    p.shootTimer = PISTOL_RATE;
    p.ammo -= 1;
    p.angle = Math.atan2(targetY - p.y, targetX - p.x);
    state.stats.shotsFired += 1;
    const mx = p.x + Math.cos(p.angle) * 22;
    const my = p.y + Math.sin(p.angle) * 22;
    fireBullet('player', mx, my, p.angle + random.range(-0.03, 0.03), 900, PISTOL_DAMAGE);
    burst(mx, my, '#ffd76a', 4, 160);
    state.audio.gunshot();
    addWanted(WANTED_CRIME_SHOOT * 0.15);
    if (p.inCar) p.inCar.speed *= 0.995;
  }

  function enterCar(car) {
    const p = state.player;
    p.inCar = car;
    car.driver = 'player';
    if (car.kind === 'traffic') {
      // The driver bails out and runs.
      const d = spawnPed(car.x + 30, car.y + 30);
      d.state = 'flee';
      d.fleeX = car.x;
      d.fleeY = car.y;
      state.traffic = state.traffic.filter((t) => t !== car);
      addWanted(WANTED_CRIME_CAR);
      state.message = 'Car stolen! The driver ran off.';
    } else if (car.kind === 'police') {
      addWanted(WANTED_CRIME_CAR + 1);
      state.message = 'You stole a police cruiser!';
    } else {
      addWanted(WANTED_CRIME_CAR);
      state.message = 'Car stolen!';
    }
    state.messageTimer = 2.5;
    state.stats.carsStolen += 1;
    state.audio.pickup();
  }

  function exitCar() {
    const p = state.player;
    const car = p.inCar;
    if (!car) return;
    p.inCar = null;
    p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 30;
    p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 30;
    p.angle = car.angle;
    if (car.kind === 'police') {
      car.driver = 'police';
      state.police.push(car);
    } else {
      car.driver = 'parked';
    }
    collideBuildings(city, p);
  }

  function nearestCar(maxDist) {
    const p = state.player;
    let best = null;
    let bestD = maxDist * maxDist;
    for (const car of state.cars) {
      if (car.driver === 'player') continue;
      const d = dist2(p, car);
      if (d < bestD) {
        bestD = d;
        best = car;
      }
    }
    return best;
  }

  function bustPlayer() {
    state.busted = true;
    state.player.health = PLAYER_MAX_HEALTH;
    state.player.ammo = PISTOL_MAG;
    state.wanted = 0;
    state.wantedPoints = 0;
    const fine = Math.floor(state.cash * 0.2);
    state.cash -= fine;
    state.audio.busted();
    // Respawn at the plaza, on foot.
    if (state.player.inCar) {
      state.player.inCar.driver = 'parked';
      state.player.inCar = null;
    }
    state.player.x = city.centres[6];
    state.player.y = city.centres[2] + 90;
    state.police = state.police.filter((c) => c.kind !== 'police');
    state.footCops = [];
    state.message = `BUSTED! Fine $${fine}. Mara is not pleased.`;
    state.messageTimer = 4;
    return EVENT_BUSTED;
  }

  function updatePlayer(dt, input, actions, mouseWorld) {
    const p = state.player;
    p.shootTimer = Math.max(0, p.shootTimer - dt);
    if (p.reloading > 0) {
      p.reloading -= dt;
      if (p.reloading <= 0 && p.reserve > 0) {
        const need = PISTOL_MAG - p.ammo;
        const take = Math.min(need, p.reserve);
        p.ammo += take;
        p.reserve -= take;
      }
    }
    if (actions & 8) {
      if (p.ammo < PISTOL_MAG && p.reserve > 0 && p.reloading <= 0) p.reloading = 1.1;
    }

    if (p.inCar) {
      const car = p.inCar;
      const axis = input.axis();
      const driving = axis.y !== 0;
      if (axis.y < 0) car.speed += CAR_ACCEL * dt;
      else if (axis.y > 0) {
        car.speed -= car.speed > 30 ? CAR_BRAKE * dt : CAR_ACCEL * 0.5 * dt;
      } else {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 320 * dt);
      }
      car.speed = clamp(car.speed, -CAR_REVERSE_MAX, CAR_MAX_SPEED);
      const steer = axis.x * CAR_STEER * clamp(Math.abs(car.speed) / 220, 0, 1) * Math.sign(car.speed || 1);
      car.angle += steer * dt;
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const body = { x: nx, y: ny, r: 16 };
      const hitWall = collideBuildings(city, body);
      const inSea = inWater(city, nx, ny);
      if (!hitWall && !inSea) {
        state.stats.distanceDriven += Math.abs(car.speed) * dt;
        car.x = nx;
        car.y = ny;
      } else {
        if (Math.abs(car.speed) > 200) {
          car.hp -= 12;
          state.audio.crash();
          burst(car.x, car.y, '#ffb347', 10, 220);
          state.shake = 0.35;
          if (car.hp <= 0) {
            state.message = 'The car is wrecked. Find another ride.';
            state.messageTimer = 3;
            exitCar();
          }
        }
        car.speed *= -0.25;
      }
      car.x = clamp(car.x, 20, CITY_SIZE - 20);
      car.y = clamp(car.y, 20, CITY_SIZE - 20);
      p.x = car.x;
      p.y = car.y;
      p.speed = car.speed;
      state.audio.setEngine(Math.abs(car.speed) / CAR_MAX_SPEED, driving);
      if (actions & 4) exitCar();
      if ((actions & 32) && mouseWorld) playerShoot(mouseWorld.x, mouseWorld.y);
      return;
    }

    // On foot.
    state.audio.setEngine(0, false);
    const axis = input.axis();
    const len = Math.hypot(axis.x, axis.y) || 1;
    const speed = input.sprint ? SPRINT_SPEED : WALK_SPEED;
    const vx = (axis.x / len) * speed;
    const vy = (axis.y / len) * speed;
    const nx = p.x + vx * dt;
    const ny = p.y + vy * dt;
    const body = { x: nx, y: ny, r: p.r };
    const wasX = p.x;
    const wasY = p.y;
    collideBuildings(city, body);
    if (!inWater(city, body.x, body.y)) {
      p.x = body.x;
      p.y = body.y;
    } else {
      p.x = wasX;
      p.y = wasY;
    }
    p.x = clamp(p.x, 20, CITY_SIZE - 20);
    p.y = clamp(p.y, 20, CITY_SIZE - 20);
    if (axis.x !== 0 || axis.y !== 0) p.angle = Math.atan2(vy, vx);
    p.speed = Math.hypot(vx, vy);
    if (mouseWorld) p.angle = Math.atan2(mouseWorld.y - p.y, mouseWorld.x - p.x);
    if (actions & 4) {
      const car = nearestCar(64);
      if (car) enterCar(car);
    }
    if ((actions & 32) && mouseWorld) playerShoot(mouseWorld.x, mouseWorld.y);
    // Pickups.
    for (let i = state.pickups.length - 1; i >= 0; i -= 1) {
      const pk = state.pickups[i];
      if (dist2(p, pk) < 36 * 36) {
        if (pk.kind === 'health') {
          p.health = Math.min(PLAYER_MAX_HEALTH, p.health + 35);
          state.message = 'Health +35';
        } else if (pk.kind === 'ammo') {
          p.reserve += 36;
          state.message = 'Ammo +36';
        } else {
          state.cash += 50;
          state.message = 'Found $50 on the street';
        }
        state.messageTimer = 2;
        state.audio.pickup();
        state.pickups.splice(i, 1);
      }
    }
  }

  function updateTraffic(dt) {
    for (const car of state.traffic) {
      const target = nodePos(car.target);
      const dx = target.x - car.x;
      const dy = target.y - car.y;
      const d = Math.hypot(dx, dy);
      if (d < 14) {
        const from = car.node;
        car.node = car.target;
        car.target = pickNextNode(car.node, from, random);
        continue;
      }
      const wantAngle = Math.atan2(dy, dx);
      car.angle += clamp(angleDiff(car.angle, wantAngle), -2.4 * dt, 2.4 * dt);
      // Slow down for the car ahead.
      let speed = TRAFFIC_SPEED;
      for (const other of state.traffic) {
        if (other === car) continue;
        const odx = other.x - car.x;
        const ody = other.y - car.y;
        const ahead = odx * Math.cos(car.angle) + ody * Math.sin(car.angle);
        const side = Math.abs(-odx * Math.sin(car.angle) + ody * Math.cos(car.angle));
        if (ahead > 0 && ahead < 70 && side < 26) speed = Math.min(speed, other.speed * 0.9);
      }
      car.speed += clamp(speed - car.speed, -300 * dt, 200 * dt);
      car.x += Math.cos(car.angle) * car.speed * dt;
      car.y += Math.sin(car.angle) * car.speed * dt;
      // A wrecked traffic car is towed away.
      if (car.hp <= 0) {
        burst(car.x, car.y, '#ff7a2e', 20, 300);
        state.cars = state.cars.filter((c) => c !== car);
        state.traffic = state.traffic.filter((c) => c !== car);
        continue;
      }
      // Bump into the player car.
      const p = state.player;
      if (p.inCar) {
        const pc = p.inCar;
        if (dist2(car, pc) < 34 * 34) {
          const push = angleTo(car, pc);
          car.x -= Math.cos(push) * 30 * dt * 10;
          car.y -= Math.sin(push) * 30 * dt * 10;
          if (Math.abs(pc.speed) > 260) {
            car.hp -= 20;
            state.audio.crash();
            burst(car.x, car.y, '#ffb347', 8, 200);
          }
        }
      }
    }
  }

  function updatePeds(dt) {
    const p = state.player;
    for (const ped of state.peds) {
      if (ped.dead) {
        ped.deadTimer -= dt;
        continue;
      }
      ped.stateTimer -= dt;
      if (ped.state === 'flee') {
        const away = Math.atan2(ped.y - ped.fleeY, ped.x - ped.fleeX);
        ped.angle = away;
        ped.x += Math.cos(away) * 190 * dt;
        ped.y += Math.sin(away) * 190 * dt;
        if (ped.stateTimer <= 0) {
          ped.state = 'walk';
          ped.stateTimer = random.range(3, 9);
        }
      } else {
        if (ped.stateTimer <= 0) {
          ped.stateTimer = random.range(3, 9);
          ped.angle = random.range(0, TAU);
        }
        ped.x += Math.cos(ped.angle) * ped.speed * dt;
        ped.y += Math.sin(ped.angle) * ped.speed * dt;
        // Stay on sidewalks: steer back onto a road edge when drifting into a block.
        if (!isOnRoad(ped.x, ped.y)) {
          const near = nearestRoadPoint(ped.x, ped.y);
          ped.angle = angleTo(ped, near);
        }
      }
      ped.x = clamp(ped.x, 20, CITY_SIZE - 20);
      ped.y = clamp(ped.y, 20, CITY_SIZE - 20);
      collideBuildings(city, { x: ped.x, y: ped.y, r: 10 });
      // Hit by the player's car.
      if (p.inCar && Math.abs(p.inCar.speed) > 60 && dist2(ped, p.inCar) < 30 * 30) {
        ped.dead = true;
        ped.deadTimer = 6;
        state.stats.pedsHit += 1;
        addWanted(WANTED_CRIME_HIT_PED);
        burst(ped.x, ped.y, '#d64545', 8, 160);
        state.audio.crash();
        state.message = 'You hit a pedestrian! The police were told.';
        state.messageTimer = 2.5;
        for (const other of state.peds) {
          if (!other.dead && dist2(other, ped) < 300 * 300) {
            other.state = 'flee';
            other.fleeX = ped.x;
            other.fleeY = ped.y;
            other.stateTimer = 4;
          }
        }
      }
    }
    // Remove long-dead peds, keep the streets populated.
    state.peds = state.peds.filter((ped) => !ped.dead || ped.deadTimer > 0);
    while (state.peds.filter((ped) => !ped.dead).length < 14) {
      const point = randomSidewalkPoint();
      if (dist2(point, p) > 500 * 500) spawnPed(point.x, point.y);
      else break;
    }
  }

  function updatePolice(dt) {
    const p = state.player;
    // Keep the number of cruisers in line with the wanted level.
    const wantCruisers = Math.min(state.wanted, 5);
    while (state.police.length < wantCruisers) {
      const angle = random.range(0, TAU);
      const px = clamp(p.x + Math.cos(angle) * 620, 60, CITY_SIZE - 60);
      const py = clamp(p.y + Math.sin(angle) * 620, 60, CITY_SIZE - 60);
      const near = nearestRoadPoint(px, py);
      const car = spawnCar(near.x, near.y, 'police', 'police');
      car.speed = POLICE_MAX_SPEED * 0.8;
      state.police.push(car);
    }
    for (let i = state.police.length - 1; i >= 0; i -= 1) {
      const car = state.police[i];
      if (state.wanted === 0) {
        // The heat is off: cruisers peel away and despawn at a distance.
        car.speed = POLICE_MAX_SPEED * 0.7;
        car.angle += 1.2 * dt;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        if (dist2(car, p) > 1100 * 1100) {
          state.cars = state.cars.filter((c) => c !== car);
          state.police.splice(i, 1);
        }
        continue;
      }
      const wantAngle = angleTo(car, p);
      car.angle += clamp(angleDiff(car.angle, wantAngle), -3.2 * dt, 3.2 * dt);
      car.speed += clamp(POLICE_MAX_SPEED - car.speed, -500 * dt, 420 * dt);
      const nx = car.x + Math.cos(car.angle) * car.speed * dt;
      const ny = car.y + Math.sin(car.angle) * car.speed * dt;
      const body = { x: nx, y: ny, r: 16 };
      if (!collideBuildings(city, body) && !inWater(city, nx, ny)) {
        car.x = nx;
        car.y = ny;
      } else {
        car.speed *= 0.4;
      }
      // Ram the player: damage the car, then bounce off so the hit is a shove,
      // not a pin — the chase stays a chase instead of an instant wreck.
      if (p.inCar) {
        if (dist2(car, p.inCar) < 36 * 36) {
          p.inCar.hp -= 25 * dt;
          p.inCar.speed *= 0.985;
          state.shake = Math.max(state.shake, 0.2);
          const away = angleTo(p.inCar, car);
          car.x += Math.cos(away) * 46;
          car.y += Math.sin(away) * 46;
          car.speed *= 0.85;
          if (p.inCar.hp <= 0) {
            state.message = 'Your car is wrecked — run!';
            state.messageTimer = 3;
            exitCar();
          }
        }
      } else if (dist2(car, p) < 30 * 30) {
        p.health -= 22 * dt;
        state.shake = Math.max(state.shake, 0.25);
        if (p.health <= 0) return bustPlayer();
      }
    }
    // Foot cops chase a wanted player who is on foot.
    const wantCops = state.wanted >= 2 && !p.inCar ? Math.min(2, state.wanted - 1) : 0;
    while (state.footCops.length < wantCops) {
      const angle = random.range(0, TAU);
      state.footCops.push({
        x: clamp(p.x + Math.cos(angle) * 320, 40, CITY_SIZE - 40),
        y: clamp(p.y + Math.sin(angle) * 320, 40, CITY_SIZE - 40),
        speed: 205,
      });
    }
    for (const cop of state.footCops) {
      if (state.wanted === 0 || p.inCar) {
        cop.gone = true;
        continue;
      }
      const a = angleTo(cop, p);
      cop.x += Math.cos(a) * cop.speed * dt;
      cop.y += Math.sin(a) * cop.speed * dt;
      collideBuildings(city, { x: cop.x, y: cop.y, r: 12 });
      if (dist2(cop, p) < 34 * 34) {
        p.health -= 14 * dt;
        if (p.health <= 0) return bustPlayer();
      }
    }
    state.footCops = state.footCops.filter((c) => !c.gone);
    // Wanted decays when no cruiser is close.
    const nearestCop = state.police.reduce((best, car) => Math.min(best, dist2(car, p)), Infinity);
    if (state.wanted > 0 && nearestCop > 700 * 700) {
      state.wantedPoints -= WANTED_DECAY * dt;
      state.wanted = Math.floor(state.wantedPoints);
    }
    state.audio.setSiren(state.wanted > 0);
    return EVENT_NONE;
  }

  function updateEnemies(dt) {
    const p = state.player;
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.hp <= 0) continue;
      const d = Math.hypot(p.x - e.x, p.y - e.y);
      e.angle = angleTo(e, p);
      if (d > 260) {
        e.x += Math.cos(e.angle) * e.speed * dt;
        e.y += Math.sin(e.angle) * e.speed * dt;
        collideBuildings(city, { x: e.x, y: e.y, r: 12 });
      }
      e.shootTimer -= dt;
      if (d < 460 && e.shootTimer <= 0) {
        e.shootTimer = random.range(0.9, 1.6);
        fireBullet('enemy', e.x, e.y, e.angle + random.range(-0.12, 0.12), 620, 9);
        state.audio.enemyShot();
      }
    }
    state.enemies = state.enemies.filter((e) => e.hp > 0);
  }

  function updateBullets(dt) {
    const p = state.player;
    for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
      const b = state.bullets[i];
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      let dead = b.life <= 0;
      // Buildings stop bullets.
      for (const bd of state.city.buildings) {
        if (b.x >= bd.x && b.x <= bd.x + bd.w && b.y >= bd.y && b.y <= bd.y + bd.h) {
          dead = true;
          burst(b.x, b.y, '#c9c9c9', 3, 120);
          break;
        }
      }
      if (!dead && b.from === 'player') {
        for (const e of state.enemies) {
          if (e.hp > 0 && dist2(b, e) < 20 * 20) {
            e.hp -= b.damage;
            dead = true;
            burst(b.x, b.y, '#d64545', 6, 180);
            if (e.hp <= 0) {
              state.mission.kills += 1;
              state.cash += 75;
              burst(e.x, e.y, '#d64545', 16, 260);
              state.message = 'Viper down. +$75';
              state.messageTimer = 2;
            }
            break;
          }
        }
        if (!dead) {
          for (const cop of state.footCops) {
            if (dist2(b, cop) < 18 * 18) {
              dead = true;
              cop.gone = true;
              addWanted(WANTED_CRIME_KILL_COP);
              state.message = 'You shot a cop! Wanted level up.';
              state.messageTimer = 2.5;
              break;
            }
          }
        }
        if (!dead) {
          for (const car of state.cars) {
            if (car.driver === 'player') continue;
            if (dist2(b, car) < 26 * 26) {
              car.hp -= b.damage;
              dead = true;
              burst(b.x, b.y, '#ffb347', 5, 160);
              if (car.hp <= 0) {
                burst(car.x, car.y, '#ff7a2e', 20, 300);
                state.cars = state.cars.filter((c) => c !== car);
                state.traffic = state.traffic.filter((c) => c !== car);
                state.police = state.police.filter((c) => c !== car);
              }
              break;
            }
          }
        }
      }
      if (!dead && b.from === 'enemy') {
        const target = p.inCar ? p.inCar : p;
        const radius = p.inCar ? 26 : 16;
        if (dist2(b, target) < radius * radius) {
          dead = true;
          if (p.inCar) {
            p.inCar.hp -= b.damage;
            if (p.inCar.hp <= 0) exitCar();
          } else {
            p.health -= b.damage;
            state.shake = Math.max(state.shake, 0.15);
            if (p.health <= 0) return bustPlayer();
          }
        }
      }
      if (dead) state.bullets.splice(i, 1);
    }
    return EVENT_NONE;
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const pt = state.particles[i];
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vx *= 0.92;
      pt.vy *= 0.92;
      pt.life -= dt;
      if (pt.life <= 0) state.particles.splice(i, 1);
    }
  }

  function updateMissionFlow(dt) {
    // Mission 3 spawns its gang when the player reaches the plaza step.
    const mission = state.mission;
    if (mission.index === 2 && mission.step === 1 && state.enemies.length === 0 && mission.kills < 3) {
      if (!mission.spawnedVipers) {
        mission.spawnedVipers = true;
        const plaza = state.city.plaza;
        spawnEnemy(plaza.x + 40, plaza.y + 40);
        spawnEnemy(plaza.x + plaza.w - 40, plaza.y + 60);
        spawnEnemy(plaza.x + plaza.w / 2, plaza.y + plaza.h - 50);
        state.message = 'Three Vipers. Take them down.';
        state.messageTimer = 3;
      }
    }
    const result = updateMission(state, dt);
    if (result === 'done') {
      const doneIndex = state.mission.index;
      state.message = `Job done! ${MISSIONS[doneIndex].title} paid $${MISSIONS[doneIndex].reward}.`;
      state.messageTimer = 4;
      state.audio.mission();
      if (doneIndex + 1 < MISSIONS.length) {
        beginMission(state, doneIndex + 1);
        state.mission.banner = MISSIONS[doneIndex + 1].title;
        state.mission.bannerTimer = 3;
      }
      return EVENT_MISSION_DONE;
    }
    if (result === 'failed') {
      state.message = 'Job failed. Mara gives you one more shot — try again.';
      state.messageTimer = 4;
      state.audio.fail();
      beginMission(state, state.mission.index);
      return EVENT_MISSION_FAILED;
    }
    return EVENT_NONE;
  }

  function step(dt, input, actions, mouseWorld) {
    state.time += dt;
    state.clockMinutes += dt * 2;
    if (state.clockMinutes >= 24 * 60) state.clockMinutes -= 24 * 60;
    state.messageTimer = Math.max(0, state.messageTimer - dt);
    state.mission.bannerTimer = Math.max(0, state.mission.bannerTimer - dt);
    state.shake = Math.max(0, state.shake - dt * 1.4);

    let events = EVENT_NONE;
    updatePlayer(dt, input, actions, mouseWorld);
    if (state.busted) {
      state.busted = false;
      return EVENT_BUSTED;
    }
    updateTraffic(dt);
    updatePeds(dt);
    const policeEvent = updatePolice(dt);
    if (policeEvent === EVENT_BUSTED) return EVENT_BUSTED;
    updateEnemies(dt);
    const bulletEvent = updateBullets(dt);
    if (bulletEvent === EVENT_BUSTED) return EVENT_BUSTED;
    updateParticles(dt);
    events |= updateMissionFlow(dt);
    // Camera follows the player, eased.
    const target = state.player;
    state.camera.x += (target.x - state.camera.x) * Math.min(1, dt * 5);
    state.camera.y += (target.y - state.camera.y) * Math.min(1, dt * 5);
    return events;
  }

  function save() {
    try {
      const data = {
        cash: state.cash,
        missionIndex: state.mission.done ? state.mission.index + 1 : state.mission.index,
        missionsDone: state.stats.missionsDone,
        health: state.player.health,
        x: state.player.x,
        y: state.player.y,
        clockMinutes: state.clockMinutes,
      };
      window.localStorage.setItem('solmar-save-v1', JSON.stringify(data));
      return true;
    } catch {
      return false;
    }
  }

  function load() {
    try {
      const raw = window.localStorage.getItem('solmar-save-v1');
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
      state.cash = data.cash;
      state.stats.missionsDone = data.missionsDone || 0;
      state.player.health = data.health ?? PLAYER_MAX_HEALTH;
      state.player.x = data.x ?? state.player.x;
      state.player.y = data.y ?? state.player.y;
      state.clockMinutes = data.clockMinutes ?? state.clockMinutes;
      const index = Math.min(data.missionIndex, MISSIONS.length - 1);
      beginMission(state, index);
      state.camera.x = state.player.x;
      state.camera.y = state.player.y;
      return data;
    } catch {
      return null;
    }
  }

  reset();
  return { state, reset, step, save, load, spawnCar, spawnPed, spawnEnemy, spawnPickup, nearestRoadPoint: (x, y) => nearestRoadPoint(x, y), enterCar, exitCar, addWanted, beginMission: (index) => beginMission(state, index) };
}

// Neon Tide — vehicles.js
// Cars: the player's ride, the traffic that fills the roads, and the
// black-and-white cruisers that chase a wanted player. One shared physics
// shape — a rectangle with a heading, a speed and a colour — driven by
// three different brains.

import { WORLD, CAR, TRAFFIC, POLICE } from './config.js';
import { nearestRoadX, nearestRoadY, hitBuilding, clampToWorld, onRoad } from './city.js';
import { pick } from './rng.js';

export const CAR_MODELS = [
  { name: 'Civic runabout', w: 34, h: 62, color: '#c0392b', top: 1.0 },
  { name: 'Harbor taxi', w: 34, h: 62, color: '#f1c40f', top: 1.0 },
  { name: 'Bay sedan', w: 36, h: 66, color: '#2980b9', top: 1.1 },
  { name: 'Palm coupe', w: 34, h: 60, color: '#e67e22', top: 1.15 },
  { name: 'Marina van', w: 38, h: 76, color: '#ecf0f1', top: 0.9 },
  { name: 'Vesper GT', w: 36, h: 64, color: '#8e44ad', top: 1.35 },
  { name: 'Sunset pickup', w: 38, h: 72, color: '#16a085', top: 1.05 },
];

export function makeCar(x, y, angle, model, opts = {}) {
  return {
    x, y, angle, speed: 0,
    w: model.w, h: model.h, color: model.color, topSpeed: CAR.maxSpeed * model.top,
    name: model.name,
    kind: opts.kind || 'traffic', // traffic | player | police | parked
    driver: opts.driver ?? true,
    siren: 0,
    // Traffic brains follow one road axis at a time.
    axis: opts.axis || 'x',
    dir: opts.dir || 1,
    stuck: 0,
    health: 100,
  };
}

// --- player car physics: arcade, with a handbrake that lets the tail out ---
export function drivePlayerCar(car, move, dt, handbrake) {
  const forward = Math.cos(car.angle);
  const right = Math.sin(car.angle);
  const along = car.speed;
  if (move.y < 0) car.speed += CAR.accel * dt;
  else if (move.y > 0) car.speed -= CAR.reverseAccel * dt;
  else {
    // Rolling drag, stronger when the handbrake is down.
    const drag = handbrake ? 500 : 120;
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), drag * dt);
  }
  if (move.y === 0 && Math.abs(car.speed) < 8) car.speed = 0;
  car.speed = Math.max(-CAR.maxReverse, Math.min(car.topSpeed, car.speed));
  const steer = move.x * CAR.turnRate * (along >= 0 ? 1 : -1);
  const grip = handbrake ? CAR.handbrakeGrip : CAR.grip;
  car.angle += steer * Math.min(1, Math.abs(along) / 120) * dt * (handbrake ? 1.5 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  void forward; void right; void grip;
}

export function collideCarWithWorld(car, city) {
  const c = clampToWorld(car.x, car.y, 30);
  car.x = c.x; car.y = c.y;
  // Buildings are solid: push the car out along the smallest overlap.
  const half = Math.max(car.w, car.h) / 2;
  const hit = hitBuilding(city, car.x - half, car.y - half, half * 2, half * 2);
  if (hit) {
    const overlapL = car.x + half - hit.x;
    const overlapR = hit.x + hit.w - (car.x - half);
    const overlapT = car.y + half - hit.y;
    const overlapB = hit.y + hit.h - (car.y - half);
    const m = Math.min(overlapL, overlapR, overlapT, overlapB);
    if (m === overlapL) car.x = hit.x - half;
    else if (m === overlapR) car.x = hit.x + hit.w + half;
    else if (m === overlapT) car.y = hit.y - half;
    else car.y = hit.y + hit.h + half;
    car.speed *= 0.4;
    return true;
  }
  return false;
}

// --- traffic: follow the grid, turn at intersections, queue behind cars ---
export function spawnTraffic(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = vertical
      ? pick(rng, WORLD.roadXs)
      : pick(rng, WORLD.roadYs);
    const along = (vertical ? WORLD.roadYs : WORLD.roadXs)[Math.floor(rng() * 8)];
    const lane = (rng() < 0.5 ? -1 : 1) * WORLD.laneWidth / 2;
    const x = vertical ? road + lane : along;
    const y = vertical ? along : road + lane;
    const model = pick(rng, CAR_MODELS);
    const car = makeCar(x, y, vertical ? (lane > 0 ? Math.PI / 2 : -Math.PI / 2) : (lane > 0 ? 0 : Math.PI), model);
    car.axis = vertical ? 'y' : 'x';
    car.dir = lane > 0 ? 1 : -1;
    car.speed = TRAFFIC.speed * (0.85 + rng() * 0.3);
    cars.push(car);
  }
  return cars;
}

export function updateTraffic(cars, playerCar, dt, rng) {
  for (const car of cars) {
    // Slow down for the car ahead on the same lane.
    let target = TRAFFIC.speed;
    for (const other of cars) {
      if (other === car || other.axis !== car.axis) continue;
      const dx = other.x - car.x;
      const dy = other.y - car.y;
      const ahead = car.axis === 'x' ? dx * car.dir : dy * car.dir;
      const lateral = car.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
      if (ahead > 0 && ahead < TRAFFIC.minGap + 60 && lateral < 30) target = 0;
    }
    if (playerCar) {
      const dx = playerCar.x - car.x;
      const dy = playerCar.y - car.y;
      const ahead = car.axis === 'x' ? dx * car.dir : dy * car.dir;
      const lateral = car.axis === 'x' ? Math.abs(dy) : Math.abs(dx);
      if (ahead > 0 && ahead < TRAFFIC.minGap + 80 && lateral < 34) target = 0;
    }
    car.speed += (target - car.speed) * Math.min(1, dt * 2);

    // At an intersection, sometimes turn onto the crossing road.
    const nearX = Math.abs(car.x - nearestRoadX(car.x)) < 14;
    const nearY = Math.abs(car.y - nearestRoadY(car.y)) < 14;
    if (car.axis === 'x' && nearX && rng() < dt * 0.35) {
      const ny = nearestRoadY(car.y);
      if (Math.abs(ny - car.y) < 40) {
        car.axis = 'y';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.y = ny + car.dir * WORLD.laneWidth / 2 * -1;
        car.angle = car.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
      }
    } else if (car.axis === 'y' && nearY && rng() < dt * 0.35) {
      const nx = nearestRoadX(car.x);
      if (Math.abs(nx - car.x) < 40) {
        car.axis = 'x';
        car.dir = rng() < 0.5 ? 1 : -1;
        car.x = nx + car.dir * WORLD.laneWidth / 2 * -1;
        car.angle = car.dir > 0 ? 0 : Math.PI;
      }
    }

    car.x += Math.cos(car.angle) * car.speed * dt;
    car.y += Math.sin(car.angle) * car.speed * dt;
    // Wrap around the city edge so the roads never run dry.
    if (car.x < -80) car.x = WORLD.width + 60;
    if (car.x > WORLD.width + 80) car.x = -60;
    if (car.y < -80) car.y = WORLD.height + 60;
    if (car.y > WORLD.height + 80) car.y = -60;
  }
}

// --- police: cruisers that hunt the player and try to ram them off the road ---
export function spawnPoliceCar(x, y) {
  const model = { name: 'Solmar PD Cruiser', w: 36, h: 66, color: '#e8e8e8', top: 1.0 };
  const car = makeCar(x, y, 0, model, { kind: 'police' });
  car.topSpeed = POLICE.carSpeed;
  return car;
}

export function updatePoliceCar(car, target, dt) {
  const dx = target.x - car.x;
  const dy = target.y - car.y;
  const dist = Math.hypot(dx, dy) || 1;
  const want = Math.atan2(dy, dx);
  let diff = want - car.angle;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  car.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
  const speedTarget = dist > 120 ? POLICE.carSpeed : POLICE.carSpeed * 0.7;
  car.speed += (speedTarget - car.speed) * Math.min(1, dt * 1.5);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  car.siren += dt;
  // Police ignore buildings the way a movie chase does — no, they don't:
  // they slow down hard when they clip one, so the player can lose them.
  return dist;
}

// Parked cars the player can steal, scattered near roads.
export function spawnParkedCars(city, rng, count) {
  const cars = [];
  for (let i = 0; i < count; i++) {
    const vertical = rng() < 0.5;
    const road = vertical ? pick(rng, WORLD.roadXs) : pick(rng, WORLD.roadYs);
    const along = range(rng, 300, WORLD.height - 300);
    const off = (rng() < 0.5 ? -1 : 1) * (WORLD.roadWidth / 2 + 22);
    const x = vertical ? road + off : along;
    const y = vertical ? along : road + off;
    if (onRoad(x, y)) continue;
    const model = pick(rng, CAR_MODELS);
    const car = makeCar(x, y, vertical ? 0 : Math.PI / 2, model, { kind: 'parked', driver: false });
    cars.push(car);
  }
  return cars;
}

function range(rng, min, max) {
  return min + rng() * (max - min);
}

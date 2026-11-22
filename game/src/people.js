// Neon Tide — people.js
// Everyone on foot: Milo the player, the pedestrians who fill the
// sidewalks, the cops who chase him when he's wanted, and the bullets
// that fly when someone starts shooting.

import { PLAYER, PEDS, POLICE, WORLD } from './config.js';
import { hitBuilding, clampToWorld, onRoad } from './city.js';
import { pick, range } from './rng.js';

export function makePlayer(x, y) {
  return {
    x, y, angle: 0, speed: 0,
    health: PLAYER.maxHealth,
    cash: 250,
    onFoot: true,
    car: null,
    fireTimer: 0,
    punchTimer: 0,
    aimAngle: 0,
    wanted: 0,
    unseenTimer: 0,
    dead: false,
    busted: false,
    aimX: x, aimY: y,
  };
}

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: rng() * Math.PI * 2,
    speed: PEDS.speed * (0.7 + rng() * 0.6),
    color: pick(rng, ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c', '#ecf0f1', '#e67e22']),
    shirt: pick(rng, ['#e74c3c', '#3498db', '#f39c12', '#9b59b6', '#1abc9c']),
    state: 'walk', // walk | flee | down
    tx: x, ty: y, // current sidewalk target
    panic: 0,
    dead: false,
  };
}

export function spawnPeds(city, rng, count) {
  const peds = [];
  for (let i = 0; i < count; i++) {
    const x = range(rng, 100, WORLD.width - 100);
    const y = range(rng, 100, WORLD.height - 100);
    peds.push(makePed(x, y, rng));
  }
  return peds;
}

// Pedestrians wander the sidewalks; gunfire or a speeding car sends them running.
export function updatePeds(peds, player, bullets, dt, rng, city) {
  for (const p of peds) {
    if (p.dead) continue;
    if (p.panic > 0) p.panic -= dt;
    const dx = p.tx - p.x;
    const dy = p.ty - p.y;
    const d = Math.hypot(dx, dy);
    if (d < 12 || p.panic > 0 && rng() < dt * 0.2) {
      // Pick a new nearby spot on a road edge to stroll toward.
      p.tx = p.x + range(rng, -260, 260);
      p.ty = p.y + range(rng, -260, 260);
      p.tx = Math.max(60, Math.min(WORLD.width - 60, p.tx));
      p.ty = Math.max(60, Math.min(WORLD.height - 60, p.ty));
    }
    const speed = p.panic > 0 ? p.speed * 2.2 : p.speed;
    if (d > 4) {
      p.angle = Math.atan2(dy, dx);
      p.x += Math.cos(p.angle) * speed * dt;
      p.y += Math.sin(p.angle) * speed * dt;
    }
    // Don't walk through buildings.
    const hit = hitBuilding(city, p.x - 8, p.y - 8, 16, 16);
    if (hit) { p.x -= Math.cos(p.angle) * speed * dt; p.y -= Math.sin(p.angle) * speed * dt; p.tx = p.x; p.ty = p.y; }
  }
}

// --- combat: bullets fly straight, hit peds, cops, cars and walls ---
export function makeBullet(x, y, angle, owner) {
  return { x, y, vx: Math.cos(angle) * PLAYER.bulletSpeed, vy: Math.sin(angle) * PLAYER.bulletSpeed, life: 1.1, owner };
}

export function updateBullets(bullets, city, peds, cops, player, cars, dt) {
  const events = [];
  for (const b of bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0) continue;
    if (hitBuilding(city, b.x - 2, b.y - 2, 4, 4)) { b.life = 0; continue; }
    if (b.x < 0 || b.x > WORLD.width || b.y < 0 || b.y > WORLD.height) { b.life = 0; continue; }
    for (const p of peds) {
      if (!p.dead && Math.hypot(p.x - b.x, p.y - b.y) < 14) {
        p.dead = true; b.life = 0;
        events.push({ type: 'pedDown', x: p.x, y: p.y });
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const c of cops) {
      if (!c.dead && Math.hypot(c.x - b.x, c.y - b.y) < 14) {
        c.health -= PLAYER.bulletDamage; b.life = 0;
        if (c.health <= 0) { c.dead = true; events.push({ type: 'copDown', x: c.x, y: c.y }); }
        break;
      }
    }
    if (b.life <= 0) continue;
    for (const car of cars) {
      if (Math.hypot(car.x - b.x, car.y - b.y) < 30) {
        car.health -= PLAYER.bulletDamage; b.life = 0;
        if (car.health <= 0) events.push({ type: 'carWrecked', car });
        break;
      }
    }
    if (b.life <= 0) continue;
    if (b.owner !== 'player' && player.onFoot && Math.hypot(player.x - b.x, player.y - b.y) < 14) {
      player.health -= 9; b.life = 0;
      events.push({ type: 'playerHit' });
    }
  }
  return { bullets: bullets.filter((b) => b.life > 0), events };
}

// --- police on foot: spawn near the player, chase, and punch or shoot ---
export function makeCop(x, y) {
  return { x, y, angle: 0, health: 100, state: 'chase', fireTimer: 1, dead: false };
}

export function updateCops(cops, player, dt, rng) {
  for (const c of cops) {
    if (c.dead) continue;
    const dx = player.x - c.x;
    const dy = player.y - c.y;
    const d = Math.hypot(dx, dy) || 1;
    c.angle = Math.atan2(dy, dx);
    if (player.onFoot && d < 26) {
      // Close enough to grab him: a bust, not a beating.
      if (d < 22) return 'busted';
    } else if (d < 420 && player.onFoot) {
      c.fireTimer -= dt;
      if (c.fireTimer <= 0) {
        c.fireTimer = 0.9 + rng() * 0.6;
        return { shoot: c };
      }
    }
    const speed = POLICE.footSpeed * (player.onFoot ? 1 : 0.6);
    c.x += Math.cos(c.angle) * speed * dt;
    c.y += Math.sin(c.angle) * speed * dt;
  }
  return null;
}

// --- the player, on foot ---
export function updatePlayerOnFoot(player, move, dt, city) {
  const sprint = move.sprint;
  const speed = sprint ? PLAYER.sprintSpeed : PLAYER.walkSpeed;
  let mx = move.x;
  let my = move.y;
  const len = Math.hypot(mx, my);
  if (len > 0) { mx /= len; my /= len; }
  player.x += mx * speed * dt;
  player.y += my * speed * dt;
  const c = clampToWorld(player.x, player.y, 18);
  player.x = c.x; player.y = c.y;
  // Buildings are solid.
  const hit = hitBuilding(city, player.x - PLAYER.radius, player.y - PLAYER.radius, PLAYER.radius * 2, PLAYER.radius * 2);
  if (hit) {
    player.x -= mx * speed * dt;
    player.y -= my * speed * dt;
  }
  if (len > 0) player.angle = Math.atan2(my, mx);
  player.fireTimer -= dt;
  player.punchTimer -= dt;
}

// Player runs a pedestrian over while driving: wanted, and the ped goes down.
export function carHitsPed(car, peds) {
  const hits = [];
  for (const p of peds) {
    if (p.dead) continue;
    const dx = p.x - car.x;
    const dy = p.y - car.y;
    // The car is a long rectangle: test in the car's own frame.
    const lx = Math.cos(-car.angle) * dx - Math.sin(-car.angle) * dy;
    const ly = Math.sin(-car.angle) * dx + Math.cos(-car.angle) * dy;
    if (Math.abs(lx) < car.h / 2 + 8 && Math.abs(ly) < car.w / 2 + 8 && Math.abs(car.speed) > 60) {
      p.dead = true;
      hits.push(p);
    }
  }
  return hits;
}

export function anyPedSees(player, peds, rangePx = 420) {
  for (const p of peds) {
    if (!p.dead && Math.hypot(p.x - player.x, p.y - player.y) < rangePx) return true;
  }
  return false;
}

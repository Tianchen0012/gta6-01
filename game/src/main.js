// Neon Tide — main.js
// Boot and the one loop. The game moves between screens — title, briefing,
// play, paused, game over, story complete — and the world advances in
// fixed 1/60 s steps. ?shot=start|drive|chase|mission stages one scene
// for a screenshot instead of running the loop.

import { VIEW, WORLD, PLAYER, CAR, POLICE, WANTED, SAVE_KEY } from './config.js';
import { mulberry32 } from './rng.js';
import { buildCity } from './city.js';
import { createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer } from './render.js';
import { MISSIONS, STORY_INTRO, createMissionState, currentMission, currentObjective, startMission, advanceObjective } from './missions.js';
import { makePlayer, spawnPeds, updatePeds, makeBullet, updateBullets, makeCop, updateCops, updatePlayerOnFoot, carHitsPed, anyPedSees } from './people.js';
import { spawnTraffic, updateTraffic, spawnPoliceCar, updatePoliceCar, spawnParkedCars, drivePlayerCar, collideCarWithWorld, makeCar, CAR_MODELS } from './vehicles.js';
import { saveGame, loadSave, clearSave, hasSave } from './save.js';

const STEP = 1 / 60;
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : 1337;

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const renderer = createRenderer(canvas);
const input = createInput(canvas);

function newGame() {
  const rng = mulberry32(seed);
  const city = buildCity(seed);
  const player = makePlayer(city.landmarks.hideout.x, city.landmarks.hideout.y);
  const game = {
    seed, rng, city, player,
    peds: spawnPeds(city, rng, 42),
    traffic: spawnTraffic(city, rng, 26),
    parked: spawnParkedCars(city, rng, 14),
    policeCars: [],
    cops: [],
    bullets: [],
    particles: [],
    missions: createMissionState(),
    missionEnemies: [],
    missionMarker: null,
    objectiveText: '',
    banner: null,
    bannerTimer: 0,
    message: null,
    messageTimer: 0,
    time: 0,
    screen: 'title',
    briefing: null,
    hasSave: hasSave(),
    saveTimer: 0,
    gtCar: null,
    surviveTimer: 0,
  };
  return game;
}

let game = newGame();

function announce(text) {
  status.textContent = text;
}

function showBanner(text) {
  game.banner = text;
  game.bannerTimer = 3;
}

function showMessage(text, seconds = 4) {
  game.message = text;
  game.messageTimer = seconds;
}

function burst(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    const a = game.rng() * Math.PI * 2;
    const s = 60 + game.rng() * 160;
    game.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.6, max: 0.6, color, size: 3 + game.rng() * 3 });
  }
}

function addWanted(amount) {
  game.player.wanted = Math.min(WANTED.max, game.player.wanted + amount);
  game.player.unseenTimer = 0;
}

function refreshMissionMarker() {
  const obj = currentObjective(game.missions);
  const m = currentMission(game.missions);
  if (!game.missions.started || !obj || !m) {
    game.missionMarker = null;
    game.objectiveText = game.missions.completed.length >= MISSIONS.length ? '' : 'Go to the Vesper Club to start the next job';
    return;
  }
  game.objectiveText = m.title + ' — ' + obj.text;
  if (obj.kind === 'reach' && obj.place) {
    const lm = game.city.landmarks[obj.place];
    game.missionMarker = { x: lm.x, y: lm.y };
  } else if (obj.kind === 'steal-gt' && game.gtCar) {
    game.missionMarker = { x: game.gtCar.x, y: game.gtCar.y };
  } else if (obj.kind === 'take-case') {
    const lm = game.city.landmarks.pier;
    game.missionMarker = { x: lm.x, y: lm.y };
  } else if (obj.kind === 'survive') {
    game.missionMarker = null;
  } else {
    game.missionMarker = null;
  }
}

function beginMission(index) {
  const m = MISSIONS[index];
  if (!m) return;
  startMission(game.missions, index);
  game.briefing = m;
  game.screen = 'briefing';
  const obj = currentObjective(game.missions);
  if (obj && obj.kind === 'survive') {
    game.player.wanted = Math.max(game.player.wanted, obj.setWanted || 3);
  }
  if (m.id === 'hot-wheels') {
    // The purple Vesper GT cruises Palm Heights: park one there to steal.
    const model = CAR_MODELS.find((c) => c.name === 'Vesper GT');
    game.gtCar = makeCar(674, 2430, 0, model, { kind: 'parked', driver: false });
    game.parked.push(game.gtCar);
  }
  if (m.id === 'the-marlin-job') {
    // Three armed Harbormen guard the briefcase on Sunset Pier.
    const pier = game.city.landmarks.pier;
    game.missionEnemies = [0, 1, 2].map((i) => ({
      x: pier.x - 60 + i * 60, y: pier.y - 40 + (i % 2) * 80,
      angle: 0, health: 100, dead: false, fireTimer: 1 + i * 0.4,
    }));
  }
  refreshMissionMarker();
}

function finishObjective() {
  const result = advanceObjective(game.missions);
  if (result === 'mission') {
    const m = MISSIONS[game.missions.index];
    game.player.cash += m.reward;
    showBanner('JOB DONE  +$' + m.reward.toLocaleString());
    audio.missionDone();
    saveGame(game);
    refreshMissionMarker();
    if (game.missions.index + 1 >= MISSIONS.length) {
      game.screen = 'complete';
    } else {
      setTimeout(() => beginMission(game.missions.index + 1), 1200);
    }
  } else if (result === 'objective') {
    audio.pickup();
    refreshMissionMarker();
  }
}

function checkObjectives(dt) {
  const ms = game.missions;
  if (!ms.started) return;
  const obj = currentObjective(ms);
  const m = currentMission(ms);
  if (!obj || !m) return;
  const p = game.player;

  if (obj.kind === 'reach' && obj.place) {
    const lm = game.city.landmarks[obj.place];
    const d = Math.hypot(p.x - lm.x, p.y - lm.y);
    if (d < obj.radius) {
      if (obj.onFoot && !p.onFoot) { showMessage('Get out of the car and walk in'); return; }
      if (obj.inCar && (!p.car || p.car.name !== obj.inCar)) { showMessage('Bring the ' + obj.inCar); return; }
      if (obj.needsItem && !ms.hasItem) return;
      if (obj.id === 'talk') showMessage('Odette: "Five jobs, Milo. Start with the Marina."');
      if (obj.id === 'return-club' || obj.id === 'goto-marina') ms.hasItem = true;
      finishObjective();
    }
  } else if (obj.kind === 'steal-gt') {
    if (p.car && p.car.name === 'Vesper GT') {
      ms.gtStolen = true;
      addWanted(1);
      showMessage('The GT is yours — get it to the Chop Shop!');
      finishObjective();
    }
  } else if (obj.kind === 'survive') {
    if (p.wanted >= 3) {
      game.surviveTimer += dt;
      game.objectiveText = m.title + ' — Survive the heat: ' + Math.ceil(obj.seconds - game.surviveTimer) + 's';
      if (game.surviveTimer >= obj.seconds) finishObjective();
    } else {
      game.objectiveText = m.title + ' — Get the heat back to 3 stars!';
    }
  } else if (obj.kind === 'take-case') {
    const alive = game.missionEnemies.filter((e) => !e.dead).length;
    if (alive === 0) {
      ms.hasItem = true;
      ms.caseTaken = true;
      showMessage('Briefcase taken — run for the Hideout!');
      finishObjective();
    }
  }
}

function nearestCar(maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of [...game.parked, ...game.traffic]) {
    const d = Math.hypot(car.x - game.player.x, car.y - game.player.y);
    if (d < bestD) { bestD = d; best = car; }
  }
  return best;
}

function enterCar(car) {
  const p = game.player;
  const wasParked = car.kind === 'parked';
  const wasTraffic = car.kind === 'traffic';
  // Pull the car out of its old list and make it the player's ride.
  game.parked = game.parked.filter((c) => c !== car);
  game.traffic = game.traffic.filter((c) => c !== car);
  car.kind = 'player';
  car.driver = true;
  p.car = car;
  p.onFoot = false;
  p.x = car.x;
  p.y = car.y;
  if (wasParked || wasTraffic) {
    // Stealing: a witness means the law takes notice.
    if (anyPedSees(p, game.peds) || game.cops.some((c) => !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 500)) {
      addWanted(WANTED.stealCar);
      showMessage('Car stolen — Solmar PD is on to you!');
    } else {
      showMessage('You took the ' + car.name);
    }
    audio.blip(300, 0.1);
  }
}

function exitCar() {
  const p = game.player;
  const car = p.car;
  if (!car) return;
  car.kind = 'parked';
  car.driver = false;
  car.speed = 0;
  game.parked.push(car);
  p.car = null;
  p.onFoot = true;
  p.x = car.x + Math.cos(car.angle + Math.PI / 2) * 40;
  p.y = car.y + Math.sin(car.angle + Math.PI / 2) * 40;
}

function updateWanted(dt) {
  const p = game.player;
  // How many cruisers should be out: one per star, up to the cap.
  const wantCars = Math.min(p.wanted, POLICE.maxCars);
  while (game.policeCars.length < wantCars) {
    const a = game.rng() * Math.PI * 2;
    const d = 500 + game.rng() * 300;
    game.policeCars.push(spawnPoliceCar(p.x + Math.cos(a) * d, p.y + Math.sin(a) * d));
  }
  while (game.policeCars.length > wantCars) game.policeCars.pop();

  // Foot cops join the chase on foot when the player is walking.
  if (p.wanted >= 2 && p.onFoot && game.cops.filter((c) => !c.dead).length < 3) {
    const a = game.rng() * Math.PI * 2;
    game.cops.push(makeCop(p.x + Math.cos(a) * 420, p.y + Math.sin(a) * 420));
  }

  // Stay unseen long enough and a star drops off.
  const nearestCop = Math.min(
    ...game.policeCars.map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
    ...game.cops.filter((c) => !c.dead).map((c) => Math.hypot(c.x - p.x, c.y - p.y)),
    Infinity,
  );
  if (p.wanted > 0 && nearestCop > POLICE.sightRange) {
    p.unseenTimer += dt;
    if (p.unseenTimer >= POLICE.loseSightSeconds) {
      p.wanted -= 1;
      p.unseenTimer = 0;
      showMessage('The heat is cooling off…');
    }
  } else {
    p.unseenTimer = 0;
  }
}

function update(dt) {
  game.time += dt;
  const p = game.player;
  const move = input.move();

  // Aim: the mouse, translated from screen space into the world.
  const cam = renderer.camera;
  const aimWorldX = cam.x + (input.mouseX - VIEW.width / 2) / cam.zoom;
  const aimWorldY = cam.y + (input.mouseY - VIEW.height / 2) / cam.zoom;
  p.aimAngle = Math.atan2(aimWorldY - p.y, aimWorldX - p.x);

  if (p.onFoot) {
    updatePlayerOnFoot(p, { x: move.x, y: move.y, sprint: input.down('shift') }, dt, game.city);
    if (input.wasPressed('e')) {
      const car = nearestCar(70);
      if (car) enterCar(car);
    }
    // Click to shoot; hold to keep firing.
    if (input.mouseDown && p.fireTimer <= 0) {
      p.fireTimer = PLAYER.fireCooldown;
      game.bullets.push(makeBullet(p.x + Math.cos(p.aimAngle) * 20, p.y + Math.sin(p.aimAngle) * 20, p.aimAngle, 'player'));
      audio.shot();
      if (anyPedSees(p, game.peds)) addWanted(WANTED.shoot);
    }
  } else if (p.car) {
    drivePlayerCar(p.car, move, dt, input.down(' '));
    const crashed = collideCarWithWorld(p.car, game.city);
    if (crashed && Math.abs(p.car.speed) > 200) {
      audio.crash();
      burst(p.car.x, p.car.y, '#ffb347', 8);
    }
    p.x = p.car.x;
    p.y = p.car.y;
    if (input.wasPressed('e')) exitCar();
    // Running a pedestrian over is a crime the whole street sees.
    const hits = carHitsPed(p.car, game.peds);
    if (hits.length) {
      addWanted(WANTED.hitPed);
      showMessage('You ran someone over!');
      audio.crash();
    }
  }

  // Traffic and parked life.
  updateTraffic(game.traffic, p.car, dt, game.rng);
  updatePeds(game.peds, p, game.bullets, dt, game.rng, game.city);
  // Player car vs traffic: a soft shove and a scrape.
  if (p.car) {
    for (const car of game.traffic) {
      const d = Math.hypot(car.x - p.car.x, car.y - p.car.y);
      if (d < 44 && d > 0.01) {
        const push = (44 - d) / 2;
        const nx = (p.car.x - car.x) / d;
        const ny = (p.car.y - car.y) / d;
        p.car.x += nx * push; p.car.y += ny * push;
        car.x -= nx * push; car.y -= ny * push;
        if (Math.abs(p.car.speed) > 150) { audio.crash(); burst(p.car.x, p.car.y, '#ffb347', 6); }
        p.car.speed *= 0.92;
      }
    }
  }

  // Wanted level and the police response.
  updateWanted(dt);
  for (const car of game.policeCars) {
    const dist = updatePoliceCar(car, p, dt);
    collideCarWithWorld(car, game.city);
    if (dist < 46) {
      // A cruiser rams the player: damage on foot, a shove in a car.
      if (p.onFoot) { p.health -= POLICE.ramDamage * dt * 6; }
      else { p.car.speed *= 0.97; p.health -= POLICE.ramDamage * dt * 2; }
      if (game.rng() < dt * 2) burst(p.x, p.y, '#9fb2c8', 4);
    }
  }
  const copEvent = updateCops(game.cops, p, dt, game.rng);
  if (copEvent === 'busted') {
    p.busted = true;
    game.screen = 'over';
    return;
  }
  if (copEvent && copEvent.shoot) {
    const c = copEvent.shoot;
    const a = Math.atan2(p.y - c.y, p.x - c.x) + (game.rng() - 0.5) * 0.3;
    game.bullets.push(makeBullet(c.x, c.y, a, 'cop'));
    audio.shot();
  }
  game.cops = game.cops.filter((c) => !c.dead);

  // Harbormen in the finale shoot back.
  for (const e of game.missionEnemies) {
    if (e.dead) continue;
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d < 460) {
      e.angle = Math.atan2(p.y - e.y, p.x - e.x);
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = 1.1 + game.rng() * 0.7;
        game.bullets.push(makeBullet(e.x, e.y, e.angle + (game.rng() - 0.5) * 0.25, 'enemy'));
        audio.shot();
      }
    }
  }

  // Bullets and what they hit.
  const result = updateBullets(game.bullets, game.city, game.peds, game.cops, p, [...game.traffic, ...game.parked, ...game.policeCars], dt);
  game.bullets = result.bullets;
  for (const ev of result.events) {
    if (ev.type === 'pedDown') { burst(ev.x, ev.y, '#c0392b', 8); }
    if (ev.type === 'copDown') { addWanted(WANTED.killCop); burst(ev.x, ev.y, '#1d3a6e', 10); showMessage('A cop is down — the whole city is after you now!'); }
    if (ev.type === 'carWrecked') { burst(ev.car.x, ev.car.y, '#ff8c00', 16); audio.crash(); }
    if (ev.type === 'playerHit') { burst(p.x, p.y, '#e5534b', 5); }
  }
  // Enemy bullets hitting Harbormen is handled by the same pass: cops list
  // is separate, so check the finale enemies here.
  for (const b of game.bullets) {
    for (const e of game.missionEnemies) {
      if (!e.dead && b.owner === 'player' && Math.hypot(e.x - b.x, e.y - b.y) < 14) {
        e.health -= PLAYER.bulletDamage;
        b.life = 0;
        if (e.health <= 0) { e.dead = true; burst(e.x, e.y, '#7a1f1f', 10); }
      }
    }
  }
  game.bullets = game.bullets.filter((b) => b.life > 0);

  // Particles.
  for (const pt of game.particles) {
    pt.x += pt.vx * dt;
    pt.y += pt.vy * dt;
    pt.life -= dt;
  }
  game.particles = game.particles.filter((pt) => pt.life > 0);

  // Missions.
  checkObjectives(dt);

  // Health: slow recovery when calm, death when empty.
  if (p.wanted === 0 && p.health < PLAYER.maxHealth) p.health = Math.min(PLAYER.maxHealth, p.health + 2 * dt);
  if (p.health <= 0) {
    p.health = 0;
    p.dead = true;
    game.screen = 'over';
    return;
  }

  // Banners and messages fade.
  if (game.bannerTimer > 0) { game.bannerTimer -= dt; if (game.bannerTimer <= 0) game.banner = null; }
  if (game.messageTimer > 0) { game.messageTimer -= dt; if (game.messageTimer <= 0) game.message = null; }

  // Autosave.
  game.saveTimer += dt;
  if (game.saveTimer > 10) { game.saveTimer = 0; saveGame(game); }

  // Audio follows the action.
  audio.setEngine(p.car ? Math.abs(p.car.speed) / CAR.maxSpeed : 0, !!p.car);
  audio.setSiren(p.wanted);

  // Camera follows the player, zoomed out a little while driving.
  const targetZoom = p.onFoot ? 0.95 : 0.72;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 2);
  cam.x += (p.x - cam.x) * Math.min(1, dt * 5);
  cam.y += (p.y - cam.y) * Math.min(1, dt * 5);
}

function draw() {
  const cam = renderer.camera;
  if (game.screen === 'title') {
    cam.x = game.city.landmarks.vesperClub.x;
    cam.y = game.city.landmarks.vesperClub.y;
    cam.zoom = 0.7;
  }
  renderer.drawWorld(game);
  if (game.screen === 'play' || game.screen === 'paused' || game.screen === 'briefing') {
    renderer.drawHUD(game);
    renderer.drawBanner(game);
    renderer.drawMessage(game);
  }
  if (game.screen === 'title') renderer.drawStart(game);
  else if (game.screen === 'briefing') renderer.drawBriefing(game);
  else if (game.screen === 'paused') renderer.drawPause();
  else if (game.screen === 'over') renderer.drawGameOver(game);
  else if (game.screen === 'complete') renderer.drawComplete(game);
}

function applySave(data) {
  game.player.cash = data.cash;
  game.player.x = data.x;
  game.player.y = data.y;
  game.player.health = data.health;
  game.missions.completed = data.completed || [];
  game.missions.index = data.missionIndex || 0;
  renderer.camera.x = data.x;
  renderer.camera.y = data.y;
  refreshMissionMarker();
}

function startPlaying(fromSave) {
  audio.init();
  if (fromSave) {
    const data = loadSave();
    if (data) applySave(data);
  }
  game.screen = 'play';
  refreshMissionMarker();
  if (!game.missions.started && game.missions.index < MISSIONS.length) {
    beginMission(game.missions.index);
  }
  announce('Playing Neon Tide.');
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();
  renderer.camera.x = game.player.x;
  renderer.camera.y = game.player.y;

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;

    if (game.screen === 'title') {
      if (input.wasPressed('enter') || input.clicked) startPlaying(game.hasSave);
      else if (input.wasPressed('n')) { clearSave(); game = newGame(); startPlaying(false); }
    } else if (game.screen === 'briefing') {
      if (input.wasPressed('enter') || input.clicked) { game.screen = 'play'; announce('Job accepted.'); }
    } else if (game.screen === 'play') {
      if (input.wasPressed('escape')) { game.screen = 'paused'; announce('Paused.'); }
      else if (input.wasPressed('m')) { const muted = audio.toggleMute(); showMessage(muted ? 'Sound off' : 'Sound on'); }
      while (accumulator >= STEP) { update(STEP); accumulator -= STEP; if (game.screen !== 'play') break; }
    } else if (game.screen === 'paused') {
      if (input.wasPressed('escape')) { game.screen = 'play'; }
      else if (input.wasPressed('s')) { saveGame(game); showMessage('Progress saved.'); }
      else if (input.wasPressed('q')) { saveGame(game); game.screen = 'title'; game.hasSave = hasSave(); }
      accumulator = 0;
    } else if (game.screen === 'over') {
      if (input.wasPressed('enter') || input.clicked) {
        // Back on your feet at the Hideout, lighter in the pocket.
        game.player.dead = false;
        game.player.busted = false;
        game.player.health = PLAYER.maxHealth;
        game.player.wanted = 0;
        game.player.cash = Math.max(0, game.player.cash - 150);
        if (game.player.car) { game.player.car = null; game.player.onFoot = true; }
        game.player.x = game.city.landmarks.hideout.x;
        game.player.y = game.city.landmarks.hideout.y;
        game.policeCars = [];
        game.cops = [];
        game.screen = 'play';
        showMessage('Patched up at the Hideout. $150 hospital fee.');
        saveGame(game);
      }
      accumulator = 0;
    } else if (game.screen === 'complete') {
      if (input.wasPressed('enter') || input.clicked) { game.screen = 'play'; refreshMissionMarker(); }
      accumulator = 0;
    }

    draw();
    input.endFrame();
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && game.screen === 'play') game.screen = 'paused';
  });

  announce('Neon Tide. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

// --- screenshot staging: one deterministic scene per name ---
function runShot(name) {
  const paint = () => {
    draw();
    window.__shotReady = true;
  };
  const stepWorld = (seconds) => {
    const steps = Math.floor(seconds / STEP);
    for (let i = 0; i < steps; i++) update(STEP);
  };
  if (name === 'start') {
    game.screen = 'title';
    requestAnimationFrame(() => requestAnimationFrame(paint));
    return;
  }
  game.screen = 'play';
  audio.init = () => {}; // screenshots stay silent
  if (name === 'drive') {
    // Milo in a red runabout, mid-traffic on a Downtown avenue.
    const car = game.parked.find((c) => c.name === 'Civic runabout') || game.parked[0];
    if (car) {
      game.player.x = 1400; game.player.y = 1380;
      enterCar(car);
      game.player.car.speed = 320;
      game.player.car.angle = 0;
      game.player.car.x = 1400; game.player.car.y = 1400;
      game.player.x = 1400; game.player.y = 1400;
    }
    beginMission(0);
    game.screen = 'play';
    game.missions.started = true;
    stepWorld(2.5);
    if (game.player.car) game.player.car.speed = 320; // hold the speed for the shot
  } else if (name === 'chase') {
    game.player.x = 1800; game.player.y = 1800;
    const car = game.parked[0];
    if (car) {
      enterCar(car);
      game.player.car.x = 1800; game.player.car.y = 1800;
      game.player.car.speed = 380;
    }
    game.player.wanted = 3;
    beginMission(3);
    game.screen = 'play';
    game.missions.started = true;
    game.surviveTimer = 12;
    stepWorld(2.0);
    if (game.player.car) game.player.car.speed = 380; // hold the speed for the shot
  } else if (name === 'mission') {
    // On foot at Sunset Pier, the gold marker ahead, Harbormen in view.
    game.player.x = 3030; game.player.y = 1560;
    game.player.onFoot = true;
    game.player.car = null;
    beginMission(4);
    game.screen = 'play';
    game.missions.started = true;
    game.player.wanted = 1;
    stepWorld(1.5);
  }
  refreshMissionMarker();
  renderer.camera.x = game.player.x;
  renderer.camera.y = game.player.y;
  renderer.camera.zoom = game.player.onFoot ? 0.95 : 0.72;
  requestAnimationFrame(() => requestAnimationFrame(paint));
}

if (shot) runShot(shot);
else runGame();

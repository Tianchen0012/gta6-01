// Everything the player sees: the top-down city (roads, buildings, parks, beach),
// the cars, pedestrians, police and effects, then the HUD — health, cash, wanted
// stars, ammo, the mission objective and a live minimap — and the title, pause and
// busted screens. All drawing is canvas shapes; there are no image files.
import { BLOCK, CITY_SIZE, COLORS, PISTOL_MAG, ROAD_WIDTH } from './config.js';
import { MISSIONS, objectiveText, missionMarker } from './missions.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_BUSTED = 'busted';
export const SCREEN_DONE = 'done';

const TAU = Math.PI * 2;

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let width = 0;
  let height = 0;
  let scale = 1;

  function resize() {
    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    width = Math.max(320, Math.floor(rect.width));
    height = Math.max(240, Math.floor(rect.height));
    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scale = Math.min(width / 1280, height / 720);
    scale = Math.max(0.62, Math.min(1.15, scale));
  }
  resize();
  window.addEventListener('resize', resize);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function drawBuilding(b) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(b.x + 4, b.y + 5, b.w, b.h);
    ctx.fillStyle = b.color;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = 'rgba(255,255,255,0.16)';
    ctx.fillRect(b.x, b.y, b.w, 8);
    ctx.fillRect(b.x, b.y, 8, b.h);
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    const floors = Math.max(1, b.floors);
    for (let f = 0; f < floors; f += 1) {
      const wy = b.y + 18 + f * ((b.h - 30) / floors);
      for (let wx = b.x + 14; wx < b.x + b.w - 14; wx += 26) {
        ctx.fillRect(wx, wy, 12, 10);
      }
    }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    ctx.strokeRect(b.x, b.y, b.w, b.h);
  }

  function drawCar(car, isPlayer) {
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(-19, -11, 40, 24);
    ctx.fillStyle = car.color;
    roundRect(-19, -11, 38, 22, 5);
    ctx.fill();
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    roundRect(-6, -9, 12, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(15, -9, 3, 5);
    ctx.fillRect(15, 4, 3, 5);
    ctx.fillStyle = '#ff5a4e';
    ctx.fillRect(-19, -9, 2, 5);
    ctx.fillRect(-19, 4, 2, 5);
    if (car.kind === 'police') {
      ctx.fillStyle = '#20242c';
      ctx.fillRect(-4, -11, 8, 22);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(-10, -8, 2.5, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#3b82ff';
      ctx.beginPath();
      ctx.arc(-10, 8, 2.5, 0, TAU);
      ctx.fill();
    }
    if (isPlayer) {
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, 26, 0, TAU);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawPerson(x, y, angle, color, opts = {}) {
    ctx.save();
    ctx.translate(x, y);
    if (opts.dead) {
      ctx.rotate(angle + Math.PI / 2);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.ellipse(0, 0, 12, 6, 0, 0, TAU);
      ctx.fill();
      ctx.restore();
      return;
    }
    ctx.rotate(angle);
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.beginPath();
    ctx.ellipse(2, 3, 9, 6, 0, 0, TAU);
    ctx.fill();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, 8, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#f2c89b';
    ctx.beginPath();
    ctx.arc(5, 0, 4.5, 0, TAU);
    ctx.fill();
    if (opts.armed) {
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(6, 0);
      ctx.lineTo(16, 0);
      ctx.stroke();
    }
    if (opts.cop) {
      ctx.fillStyle = '#1c3a6e';
      ctx.beginPath();
      ctx.arc(0, 0, 8, 0, TAU);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 6px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 2);
    }
    ctx.restore();
  }

  function drawWorld(world, view) {
    const city = world.city;
    const cam = world.camera;
    const shakeX = world.shake > 0 ? (Math.random() - 0.5) * world.shake * 22 : 0;
    const shakeY = world.shake > 0 ? (Math.random() - 0.5) * world.shake * 22 : 0;
    const vx = cam.x - width / 2 / scale + shakeX;
    const vy = cam.y - height / 2 / scale + shakeY;
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-vx, -vy);
    // Ground.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(vx - 40, vy - 40, width / scale + 80, height / scale + 80);
    const x0 = Math.max(0, Math.floor(vx / 120));
    const x1 = Math.min(CITY_SIZE / 120, Math.ceil((vx + width / scale) / 120));
    const y0 = Math.max(0, Math.floor(vy / 120));
    const y1 = Math.min(CITY_SIZE / 120, Math.ceil((vy + height / scale) / 120));
    ctx.fillStyle = COLORS.grassDark;
    for (let gx = x0; gx <= x1; gx += 1) {
      for (let gy = y0; gy <= y1; gy += 1) {
        if ((gx + gy) % 2 === 0) ctx.fillRect(gx * 120, gy * 120, 120, 120);
      }
    }
    // Beach and sea.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(city.beach.x, city.beach.y, city.beach.w, city.beach.h);
    ctx.fillStyle = COLORS.water;
    ctx.fillRect(city.water.x, city.water.y, city.water.w, city.water.h);
    ctx.fillStyle = COLORS.waterDeep;
    for (let wx = 0; wx < CITY_SIZE; wx += 180) {
      ctx.fillRect(wx, city.water.y + 30, 120, 6);
      ctx.fillRect(wx + 60, city.water.y + 70, 120, 6);
    }
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR BAY', 40, city.water.y + 60);
    // Parks.
    for (const park of city.parks) {
      ctx.fillStyle = '#6aa85e';
      ctx.fillRect(park.x, park.y, park.w, park.h);
    }
    for (const tree of city.trees) {
      ctx.fillStyle = COLORS.parkTreeDark;
      ctx.beginPath();
      ctx.arc(tree.x + 3, tree.y + 4, tree.r, 0, TAU);
      ctx.fill();
      ctx.fillStyle = COLORS.parkTree;
      ctx.beginPath();
      ctx.arc(tree.x, tree.y, tree.r, 0, TAU);
      ctx.fill();
    }
    // Plaza.
    ctx.fillStyle = '#c9bfa5';
    ctx.fillRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
    ctx.strokeStyle = '#a89a7c';
    ctx.lineWidth = 3;
    ctx.strokeRect(city.plaza.x, city.plaza.y, city.plaza.w, city.plaza.h);
    ctx.fillStyle = '#7fb3d6';
    ctx.beginPath();
    ctx.arc(city.plaza.x + city.plaza.w / 2, city.plaza.y + city.plaza.h / 2, 26, 0, TAU);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('SOLMAR PLAZA', city.plaza.x + city.plaza.w / 2, city.plaza.y + 24);
    // Roads.
    ctx.fillStyle = COLORS.road;
    for (const c of city.centres) {
      ctx.fillRect(0, c - ROAD_WIDTH / 2, CITY_SIZE, ROAD_WIDTH);
      ctx.fillRect(c - ROAD_WIDTH / 2, 0, ROAD_WIDTH, CITY_SIZE);
    }
    // Sidewalk edges.
    ctx.strokeStyle = COLORS.sidewalk;
    ctx.lineWidth = 8;
    for (const c of city.centres) {
      ctx.beginPath();
      ctx.moveTo(0, c - ROAD_WIDTH / 2 - 4);
      ctx.lineTo(CITY_SIZE, c - ROAD_WIDTH / 2 - 4);
      ctx.moveTo(0, c + ROAD_WIDTH / 2 + 4);
      ctx.lineTo(CITY_SIZE, c + ROAD_WIDTH / 2 + 4);
      ctx.moveTo(c - ROAD_WIDTH / 2 - 4, 0);
      ctx.lineTo(c - ROAD_WIDTH / 2 - 4, CITY_SIZE);
      ctx.moveTo(c + ROAD_WIDTH / 2 + 4, 0);
      ctx.lineTo(c + ROAD_WIDTH / 2 + 4, CITY_SIZE);
      ctx.stroke();
    }
    // Lane dashes.
    ctx.fillStyle = COLORS.lane;
    for (const c of city.centres) {
      for (let d = 40; d < CITY_SIZE; d += 80) {
        ctx.fillRect(d, c - 2, 34, 4);
        ctx.fillRect(c - 2, d, 4, 34);
      }
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    for (const cx of city.centres) {
      for (const cy of city.centres) {
        for (let s = -24; s <= 24; s += 12) {
          ctx.fillRect(cx + s - 4, cy - ROAD_WIDTH / 2 + 4, 8, 12);
          ctx.fillRect(cx + s - 4, cy + ROAD_WIDTH / 2 - 16, 8, 12);
          ctx.fillRect(cx - ROAD_WIDTH / 2 + 4, cy + s - 4, 12, 8);
          ctx.fillRect(cx + ROAD_WIDTH / 2 - 16, cy + s - 4, 12, 8);
        }
      }
    }
    // Buildings.
    for (const b of city.buildings) drawBuilding(b);
    // Landmark labels.
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    for (const lm of city.landmarks) {
      if (lm.name === 'Pier 9') continue;
      ctx.fillText(lm.name, lm.x, lm.y - 44);
    }
    ctx.fillText('PIER 9', 1620, CITY_SIZE - 300);
    // Pickups.
    for (const pk of world.pickups) {
      const bob = Math.sin(world.time * 3 + pk.bob) * 3;
      ctx.save();
      ctx.translate(pk.x, pk.y + bob);
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.beginPath();
      ctx.ellipse(0, 10 - bob, 10, 4, 0, 0, TAU);
      ctx.fill();
      if (pk.kind === 'health') {
        ctx.fillStyle = '#fff';
        ctx.fillRect(-9, -9, 18, 18);
        ctx.fillStyle = '#d64545';
        ctx.fillRect(-2.5, -7, 5, 14);
        ctx.fillRect(-7, -2.5, 14, 5);
      } else if (pk.kind === 'ammo') {
        ctx.fillStyle = '#2c3036';
        ctx.fillRect(-8, -6, 16, 12);
        ctx.fillStyle = '#ffd76a';
        ctx.fillRect(-5, -9, 3, 6);
        ctx.fillRect(0, -9, 3, 6);
        ctx.fillRect(5, -9, 3, 6);
      } else {
        ctx.fillStyle = '#2fae5f';
        ctx.beginPath();
        ctx.arc(0, 0, 10, 0, TAU);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('$', 0, 4);
      }
      ctx.restore();
    }
    // Mission marker.
    const marker = missionMarker(world);
    if (marker) {
      const pulse = 1 + Math.sin(world.time * 4) * 0.12;
      ctx.save();
      ctx.translate(marker.x, marker.y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ffd21f';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath();
      ctx.moveTo(0, -52);
      ctx.lineTo(-12, -28);
      ctx.lineTo(12, -28);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
    // Cars: traffic and parked first, police, then the player's car on top.
    for (const car of world.cars) {
      if (car.driver === 'player') continue;
      drawCar(car, false);
    }
    const playerCar = world.player.inCar;
    if (playerCar) drawCar(playerCar, true);
    // Pedestrians.
    for (const ped of world.peds) {
      drawPerson(ped.x, ped.y, ped.angle, ped.color, { dead: ped.dead });
    }
    // Foot cops.
    for (const cop of world.footCops) {
      drawPerson(cop.x, cop.y, Math.atan2(world.player.y - cop.y, world.player.x - cop.x), '#1c3a6e', { cop: true });
    }
    // Gang enemies with a red ring and a health bar.
    for (const e of world.enemies) {
      drawPerson(e.x, e.y, e.angle, e.color, { armed: true });
      ctx.strokeStyle = '#ff3b30';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(e.x, e.y, 16, 0, TAU);
      ctx.stroke();
      ctx.fillStyle = '#222';
      ctx.fillRect(e.x - 16, e.y - 26, 32, 5);
      ctx.fillStyle = '#ff3b30';
      ctx.fillRect(e.x - 16, e.y - 26, 32 * Math.max(0, e.hp / 68), 5);
    }
    // Bullets.
    for (const b of world.bullets) {
      ctx.strokeStyle = b.from === 'player' ? '#ffd76a' : '#ff8a7a';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.012, b.y - b.vy * 0.012);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const pt of world.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.maxLife);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, TAU);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // The player on foot: a gold-jacketed figure with an aim line.
    const p = world.player;
    if (!playerCar) {
      drawPerson(p.x, p.y, p.angle, '#e8b13f', { armed: true });
      ctx.strokeStyle = 'rgba(255,255,255,0.65)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(p.x + Math.cos(p.angle) * 20, p.y + Math.sin(p.angle) * 20);
      ctx.lineTo(p.x + Math.cos(p.angle) * 46, p.y + Math.sin(p.angle) * 46);
      ctx.stroke();
      if (p.reloading > 0) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('RELOADING', p.x, p.y - 24);
      }
    }
    // Off-screen mission arrow at the screen edge.
    if (marker) {
      const dx = marker.x - p.x;
      const dy = marker.y - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 420) {
        const ax = p.x + (dx / d) * 300;
        const ay = p.y + (dy / d) * 300;
        const a = Math.atan2(dy, dx);
        ctx.save();
        ctx.translate(ax, ay);
        ctx.rotate(a);
        ctx.fillStyle = '#ffd21f';
        ctx.beginPath();
        ctx.moveTo(16, 0);
        ctx.lineTo(-10, -11);
        ctx.lineTo(-10, 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
        ctx.fillStyle = '#ffd21f';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`${Math.round(d)}m`, ax, ay - 18);
      }
    }
    ctx.restore();
  }

  function drawMinimap(world) {
    const size = 178;
    const x = width - size - 14;
    const y = 14;
    const k = size / CITY_SIZE;
    ctx.save();
    ctx.fillStyle = 'rgba(10,16,22,0.82)';
    roundRect(x - 6, y - 6, size + 12, size + 12, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.rect(x, y, size, size);
    ctx.clip();
    ctx.fillStyle = '#5d8a4e';
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#2f7fa8';
    ctx.fillRect(x, y + (CITY_SIZE - 110) * k, size, 110 * k);
    ctx.fillStyle = '#3a3f46';
    for (const c of world.city.centres) {
      ctx.fillRect(x, y + (c - ROAD_WIDTH / 2) * k, size, ROAD_WIDTH * k);
      ctx.fillRect(x + (c - ROAD_WIDTH / 2) * k, y, ROAD_WIDTH * k, size);
    }
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (const b of world.city.buildings) {
      ctx.fillRect(x + b.x * k, y + b.y * k, Math.max(1.5, b.w * k), Math.max(1.5, b.h * k));
    }
    const marker = missionMarker(world);
    if (marker) {
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath();
      ctx.arc(x + marker.x * k, y + marker.y * k, 6, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    for (const car of world.police) {
      ctx.fillStyle = '#3b82ff';
      ctx.beginPath();
      ctx.arc(x + car.x * k, y + car.y * k, 4, 0, TAU);
      ctx.fill();
    }
    for (const e of world.enemies) {
      ctx.fillStyle = '#ff3b30';
      ctx.beginPath();
      ctx.arc(x + e.x * k, y + e.y * k, 4, 0, TAU);
      ctx.fill();
    }
    const p = world.player;
    ctx.save();
    ctx.translate(x + p.x * k, y + p.y * k);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.moveTo(8, 0);
    ctx.lineTo(-6, -5);
    ctx.lineTo(-6, 5);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    ctx.restore();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SOLMAR', x, y + size + 18);
  }

  function drawHud(world) {
    const p = world.player;
    // Top-left: health, cash, wanted stars.
    ctx.fillStyle = 'rgba(10,16,22,0.72)';
    roundRect(12, 12, 250, 96, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`$${world.cash.toLocaleString('en-US')}`, 26, 40);
    ctx.fillStyle = '#9fb3c8';
    ctx.font = '13px sans-serif';
    ctx.fillText('CASH', 26, 58);
    ctx.fillStyle = '#222';
    ctx.fillRect(26, 66, 150, 12);
    ctx.fillStyle = p.health > 30 ? '#3fae5f' : '#d64545';
    ctx.fillRect(26, 66, 150 * Math.max(0, p.health / 100), 12);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 12px sans-serif';
    ctx.fillText('HEALTH', 182, 76);
    // Wanted stars.
    ctx.font = '22px sans-serif';
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < world.wanted ? '#ffd21f' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', 26 + i * 26, 102);
    }
    if (world.wanted > 0) {
      ctx.fillStyle = '#ff8a7a';
      ctx.font = 'bold 12px sans-serif';
      ctx.fillText('WANTED', 160, 100);
    }
    // Bottom-left: weapon and ammo.
    ctx.fillStyle = 'rgba(10,16,22,0.72)';
    roundRect(12, height - 62, 210, 50, 10);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 17px sans-serif';
    ctx.fillText(`PISTOL  ${p.ammo} / ${p.reserve}`, 26, height - 32);
    if (p.inCar) {
      ctx.fillStyle = '#ffd21f';
      ctx.font = '13px sans-serif';
      ctx.fillText(`${Math.abs(Math.round(p.inCar.speed * 0.24))} km/h  •  E to get out`, 26, height - 18);
    } else {
      ctx.fillStyle = '#9fb3c8';
      ctx.font = '13px sans-serif';
      ctx.fillText('E near a car to steal it  •  Click to shoot', 26, height - 18);
    }
    // Bottom-centre: current objective.
    const objective = objectiveText(world);
    ctx.font = 'bold 15px sans-serif';
    const ow = ctx.measureText(objective).width + 28;
    ctx.fillStyle = 'rgba(10,16,22,0.72)';
    roundRect((width - ow) / 2, height - 52, ow, 34, 9);
    ctx.fill();
    ctx.fillStyle = '#ffd21f';
    ctx.textAlign = 'center';
    ctx.fillText(objective, width / 2, height - 30);
    // Clock, bottom-right, clear of the minimap.
    const hh = Math.floor(world.clockMinutes / 60) % 24;
    const mm = Math.floor(world.clockMinutes % 60);
    ctx.fillStyle = 'rgba(10,16,22,0.72)';
    roundRect(width - 90, height - 62, 76, 30, 8);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`, width - 52, height - 42);
    // Mission banner.
    if (world.mission.bannerTimer > 0 && world.mission.banner) {
      ctx.globalAlpha = Math.min(1, world.mission.bannerTimer);
      ctx.fillStyle = 'rgba(10,16,22,0.8)';
      const mission = MISSIONS[world.mission.index];
      const title = mission ? mission.title : world.mission.banner;
      ctx.font = 'bold 34px sans-serif';
      const tw = ctx.measureText(title).width + 48;
      roundRect((width - tw) / 2, 96, tw, 58, 12);
      ctx.fill();
      ctx.fillStyle = '#ffd21f';
      ctx.fillText(title, width / 2, 134);
      ctx.globalAlpha = 1;
    }
    // Toast message.
    if (world.messageTimer > 0 && world.message) {
      ctx.fillStyle = 'rgba(10,16,22,0.78)';
      ctx.font = '15px sans-serif';
      const mw = ctx.measureText(world.message).width + 28;
      roundRect((width - mw) / 2, 160, mw, 32, 9);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(world.message, width / 2, 181);
    }
    drawMinimap(world);
  }

  function drawButton(label, x, y, w, h, active) {
    ctx.fillStyle = active ? '#ffd21f' : 'rgba(255,255,255,0.12)';
    roundRect(x, y, w, h, 10);
    ctx.fill();
    ctx.strokeStyle = active ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = active ? '#111' : '#fff';
    ctx.font = 'bold 18px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h / 2 + 6);
  }

  function drawTitle(world, best, hasSave) {
    drawWorld(world, SCREEN_TITLE);
    ctx.fillStyle = 'rgba(8,14,20,0.55)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 64px sans-serif';
    ctx.fillText('SOLMAR', width / 2, height * 0.24);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px sans-serif';
    ctx.fillText('STREETS OF GOLD', width / 2, height * 0.24 + 42);
    ctx.fillStyle = '#dfe9f2';
    ctx.font = '16px sans-serif';
    ctx.fillText('An open-world crime game. Steal cars, dodge the law, and work your way', width / 2, height * 0.24 + 82);
    ctx.fillText('from a nobody to the name every fixer in Solmar calls first.', width / 2, height * 0.24 + 104);
    const bx = width / 2 - 130;
    drawButton('NEW GAME', bx, height * 0.46, 260, 52, true);
    if (hasSave) drawButton('CONTINUE', bx, height * 0.46 + 64, 260, 52, false);
    ctx.fillStyle = '#c8d6e2';
    ctx.font = '15px sans-serif';
    ctx.fillText('WASD move / drive  •  Mouse aim, click to shoot  •  E steal or exit a car', width / 2, height * 0.46 + (hasSave ? 150 : 86));
    ctx.fillText('R reload  •  Shift sprint  •  P pause  •  M mute  •  Progress saves automatically', width / 2, height * 0.46 + (hasSave ? 174 : 110));
    if (best > 0) {
      ctx.fillStyle = '#ffd21f';
      ctx.font = 'bold 15px sans-serif';
      ctx.fillText(`Missions completed: ${best} / ${MISSIONS.length}`, width / 2, height * 0.46 + (hasSave ? 204 : 140));
    }
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.font = '13px sans-serif';
    ctx.fillText('A wholly original game. No characters, places or art from any other game.', width / 2, height - 22);
  }

  function drawPaused(world) {
    drawWorld(world, SCREEN_PAUSED);
    ctx.fillStyle = 'rgba(8,14,20,0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('PAUSED', width / 2, height * 0.3);
    ctx.font = '16px sans-serif';
    ctx.fillStyle = '#dfe9f2';
    ctx.fillText('P or Esc to keep playing  •  Progress is saved automatically after each job', width / 2, height * 0.3 + 36);
    ctx.fillText(`Cash $${world.cash.toLocaleString('en-US')}  •  Jobs done ${world.stats.missionsDone} / ${MISSIONS.length}  •  Cars stolen ${world.stats.carsStolen}`, width / 2, height * 0.3 + 62);
    const bx = width / 2 - 130;
    drawButton('RESUME', bx, height * 0.44, 260, 52, true);
    drawButton('SAVE & QUIT TO TITLE', bx, height * 0.44 + 64, 260, 52, false);
  }

  function drawBusted(world) {
    drawWorld(world, SCREEN_BUSTED);
    ctx.fillStyle = 'rgba(20,8,10,0.62)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff5a4e';
    ctx.font = 'bold 58px sans-serif';
    ctx.fillText('BUSTED', width / 2, height * 0.36);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('The Solmar PD caught up with you. You paid the fine and walked out —', width / 2, height * 0.36 + 40);
    ctx.fillText('but Mara heard about it, and the street remembers.', width / 2, height * 0.36 + 64);
    const bx = width / 2 - 130;
    drawButton('BACK ON THE STREET', bx, height * 0.52, 260, 52, true);
  }

  function drawDone(world) {
    drawWorld(world, SCREEN_DONE);
    ctx.fillStyle = 'rgba(8,14,20,0.6)';
    ctx.fillRect(0, 0, width, height);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 44px sans-serif';
    ctx.fillText('SOLMAR IS YOURS', width / 2, height * 0.32);
    ctx.fillStyle = '#fff';
    ctx.font = '17px sans-serif';
    ctx.fillText('Every job done. Mara Voss has one last thing to say: "You are not a', width / 2, height * 0.32 + 40);
    ctx.fillText('nobody any more, Jax. Keep the streets — they are yours now."', width / 2, height * 0.32 + 64);
    ctx.fillStyle = '#dfe9f2';
    ctx.fillText(`Final cash $${world.cash.toLocaleString('en-US')}  •  Cars stolen ${world.stats.carsStolen}  •  Shots fired ${world.stats.shotsFired}`, width / 2, height * 0.32 + 96);
    const bx = width / 2 - 130;
    drawButton('KEEP PLAYING', bx, height * 0.5, 260, 52, true);
  }

  function draw(world, screen, best, hasSave) {
    ctx.clearRect(0, 0, width, height);
    if (screen === SCREEN_TITLE) drawTitle(world, best, hasSave);
    else if (screen === SCREEN_PAUSED) drawPaused(world);
    else if (screen === SCREEN_BUSTED) drawBusted(world);
    else if (screen === SCREEN_DONE) drawDone(world);
    else {
      drawWorld(world, screen);
      // Warm afternoon light over everything.
      ctx.fillStyle = 'rgba(255,170,60,0.05)';
      ctx.fillRect(0, 0, width, height);
      drawHud(world);
    }
  }

  return {
    draw,
    get size() {
      return { width, height, scale };
    },
    /** Screen-space button hit test used by the title and pause menus. */
    buttonAt(mx, my, label) {
      const bx = width / 2 - 130;
      const rows = {
        'NEW GAME': height * 0.46,
        CONTINUE: height * 0.46 + 64,
        RESUME: height * 0.44,
        'SAVE & QUIT TO TITLE': height * 0.44 + 64,
        'BACK ON THE STREET': height * 0.52,
        'KEEP PLAYING': height * 0.5,
      };
      const y = rows[label];
      if (y === undefined) return false;
      return mx >= bx && mx <= bx + 260 && my >= y && my <= y + 52;
    },
  };
}

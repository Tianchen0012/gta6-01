// Neon Tide — render.js
// Everything the player sees: the city from above, the cars and people in
// it, the HUD with its minimap, and every menu. One canvas, no DOM, so
// the screenshots are exactly what the player sees.

import { WORLD, COLORS, VIEW } from './config.js';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const renderer = { ctx, camera: { x: 0, y: 0, zoom: 1 } };

  renderer.resize = () => {
    canvas.width = VIEW.width;
    canvas.height = VIEW.height;
  };
  renderer.resize();

  // --- world ---
  renderer.drawWorld = (game) => {
    const { city } = game;
    const cam = renderer.camera;
    ctx.save();
    ctx.scale(cam.zoom, cam.zoom);
    ctx.translate(-cam.x + VIEW.width / 2 / cam.zoom, -cam.y + VIEW.height / 2 / cam.zoom);

    // Ground: grass, with a checker of mowed tones.
    ctx.fillStyle = COLORS.grass;
    ctx.fillRect(0, 0, WORLD.width, WORLD.height);
    ctx.fillStyle = COLORS.grassDark;
    const tile = 400;
    for (let x = 0; x < WORLD.width; x += tile) {
      for (let y = 0; y < WORLD.height; y += tile) {
        if (((x + y) / tile) % 2 === 0) ctx.fillRect(x, y, tile, tile);
      }
    }

    // Ocean and beach on the east edge.
    ctx.fillStyle = COLORS.sand;
    ctx.fillRect(WORLD.beachX, 0, WORLD.oceanX - WORLD.beachX, WORLD.height);
    ctx.fillStyle = COLORS.ocean;
    ctx.fillRect(WORLD.oceanX, 0, WORLD.width - WORLD.oceanX, WORLD.height);
    ctx.fillStyle = COLORS.oceanDeep;
    for (let y = 0; y < WORLD.height; y += 180) {
      ctx.fillRect(WORLD.oceanX + 40, y + 60, 300, 8);
    }

    // Parks.
    for (const p of city.parks) {
      ctx.fillStyle = COLORS.park;
      ctx.fillRect(p.x, p.y, p.w, p.h);
    }

    // Roads: asphalt, edge lines, dashed centre lines.
    ctx.fillStyle = COLORS.road;
    for (const rx of WORLD.roadXs) ctx.fillRect(rx - WORLD.roadWidth / 2, 0, WORLD.roadWidth, WORLD.height);
    for (const ry of WORLD.roadYs) ctx.fillRect(0, ry - WORLD.roadWidth / 2, WORLD.width, WORLD.roadWidth);
    ctx.strokeStyle = COLORS.roadEdge;
    ctx.lineWidth = 3;
    for (const rx of WORLD.roadXs) {
      ctx.beginPath(); ctx.moveTo(rx - WORLD.roadWidth / 2, 0); ctx.lineTo(rx - WORLD.roadWidth / 2, WORLD.height); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(rx + WORLD.roadWidth / 2, 0); ctx.lineTo(rx + WORLD.roadWidth / 2, WORLD.height); ctx.stroke();
    }
    for (const ry of WORLD.roadYs) {
      ctx.beginPath(); ctx.moveTo(0, ry - WORLD.roadWidth / 2); ctx.lineTo(WORLD.width, ry - WORLD.roadWidth / 2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(0, ry + WORLD.roadWidth / 2); ctx.lineTo(WORLD.width, ry + WORLD.roadWidth / 2); ctx.stroke();
    }
    ctx.strokeStyle = COLORS.lane;
    ctx.lineWidth = 3;
    ctx.setLineDash([26, 22]);
    for (const rx of WORLD.roadXs) {
      ctx.beginPath(); ctx.moveTo(rx, 0); ctx.lineTo(rx, WORLD.height); ctx.stroke();
    }
    for (const ry of WORLD.roadYs) {
      ctx.beginPath(); ctx.moveTo(0, ry); ctx.lineTo(WORLD.width, ry); ctx.stroke();
    }
    ctx.setLineDash([]);

    // Buildings: a soft shadow, then the roof with a lighter inner slab.
    for (const b of city.buildings) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(b.x + 8, b.y + 10 + b.tall * 2, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.14)';
      ctx.fillRect(b.x + 8, b.y + 8, b.w - 16, b.h - 16);
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + b.w / 2 - 6, b.y + b.h / 2 - 6, 12, 12); // rooftop vent
      if (b.tall > 2) {
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.fillRect(b.x + 10, b.y + 10, 18, 10); // skylight
      }
    }

    // Trees: a dark ring and a bright crown.
    for (const t of city.trees) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.beginPath(); ctx.arc(t.x + 3, t.y + 4, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3e7d32';
      ctx.beginPath(); ctx.arc(t.x, t.y, t.r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#66a34e';
      ctx.beginPath(); ctx.arc(t.x - 2, t.y - 2, t.r * 0.6, 0, Math.PI * 2); ctx.fill();
    }

    // Landmark labels, painted on the ground.
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (const key of Object.keys(city.landmarks)) {
      const lm = city.landmarks[key];
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(lm.x - 62, lm.y - 12, 124, 22);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(lm.label, lm.x, lm.y + 4);
    }

    renderer.drawEntities(game);
    ctx.restore();
  };

  renderer.drawEntities = (game) => {
    const { player, peds, traffic, parked, policeCars, cops, bullets, particles } = game;

    // Mission marker: a pulsing gold ring and a beam of light.
    const marker = game.missionMarker;
    if (marker) {
      const pulse = 1 + Math.sin(game.time * 4) * 0.12;
      ctx.strokeStyle = '#ffd94d';
      ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,217,77,0.18)';
      ctx.beginPath(); ctx.arc(marker.x, marker.y, 46 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath();
      ctx.moveTo(marker.x, marker.y - 66);
      ctx.lineTo(marker.x + 12, marker.y - 40);
      ctx.lineTo(marker.x - 12, marker.y - 40);
      ctx.closePath(); ctx.fill();
    }

    for (const car of [...parked, ...traffic]) drawCar(ctx, car, game.time);
    for (const car of policeCars) drawPoliceCar(ctx, car, game.time);
    if (player.car) drawCar(ctx, player.car, game.time);

    for (const p of peds) {
      if (p.dead) {
        ctx.fillStyle = 'rgba(120,20,20,0.8)';
        ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
        continue;
      }
      drawPerson(ctx, p.x, p.y, p.angle, p.shirt, '#2c2c34');
    }
    for (const c of cops) {
      if (c.dead) continue;
      drawPerson(ctx, c.x, c.y, c.angle, '#1d3a6e', '#101018');
      // Cop hat.
      ctx.fillStyle = '#16294d';
      ctx.beginPath(); ctx.arc(c.x, c.y - 4, 7, 0, Math.PI * 2); ctx.fill();
    }
    for (const e of game.missionEnemies || []) {
      if (e.dead) continue;
      drawPerson(ctx, e.x, e.y, e.angle, '#7a1f1f', '#1c1c1c');
      ctx.fillStyle = '#ffd94d';
      ctx.font = 'bold 11px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('HARBORMAN', e.x, e.y - 20);
    }
    if (player.onFoot) {
      // A white ring marks the player so he never blends into a crowd.
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath(); ctx.arc(player.x, player.y, 18, 0, Math.PI * 2); ctx.stroke();
      drawPerson(ctx, player.x, player.y, player.angle, '#ff5a3c', '#20242c');
      // Aim direction.
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(player.x, player.y);
      ctx.lineTo(player.x + Math.cos(player.aimAngle) * 34, player.y + Math.sin(player.aimAngle) * 34);
      ctx.stroke();
    }

    for (const b of bullets) {
      ctx.fillStyle = '#ffe27a';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3.5, 0, Math.PI * 2); ctx.fill();
    }
    for (const pt of particles) {
      ctx.fillStyle = pt.color;
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  };

  // --- HUD ---
  renderer.drawHUD = (game) => {
    const { player } = game;
    ctx.textAlign = 'left';
    // Top-left: cash and health.
    panel(ctx, 14, 12, 250, 64);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('$' + player.cash.toLocaleString(), 28, 40);
    ctx.fillStyle = '#e5534b';
    ctx.fillRect(28, 50, 200 * (player.health / 100), 10);
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1;
    ctx.strokeRect(28, 50, 200, 10);
    ctx.fillStyle = '#cfd6dd';
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillText('HEALTH', 232, 60);

    // Wanted stars, top centre.
    const stars = player.wanted;
    ctx.font = '30px system-ui, sans-serif';
    ctx.textAlign = 'center';
    for (let i = 0; i < 5; i++) {
      ctx.fillStyle = i < stars ? '#ffd94d' : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', VIEW.width / 2 - 60 + i * 30, 46);
    }
    ctx.textAlign = 'left';

    // Mission objective under the stars.
    const obj = game.objectiveText;
    if (obj) {
      ctx.font = 'bold 16px system-ui, sans-serif';
      const w = ctx.measureText(obj).width + 28;
      panel(ctx, VIEW.width / 2 - w / 2, 56, w, 30);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillText(obj, VIEW.width / 2 - w / 2 + 14, 77);
    }

    // Speed, bottom-left, only when driving.
    if (!player.onFoot && player.car) {
      const mph = Math.round(Math.abs(player.car.speed) * 0.16);
      panel(ctx, 14, VIEW.height - 62, 150, 48);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 26px system-ui, sans-serif';
      ctx.fillText(mph + ' mph', 28, VIEW.height - 28);
    }

    // Controls hint, bottom centre.
    ctx.font = '13px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.textAlign = 'center';
    ctx.fillText(player.onFoot
      ? 'WASD move · Shift sprint · E enter car · Click shoot · M mute · Esc pause'
      : 'WASD drive · Space handbrake · E leave car · Esc pause',
      VIEW.width / 2, VIEW.height - 14);
    ctx.textAlign = 'left';

    renderer.drawMinimap(game);
  };

  renderer.drawMinimap = (game) => {
    const size = 190;
    const x0 = VIEW.width - size - 14;
    const y0 = 14;
    const scale = size / WORLD.width;
    panel(ctx, x0 - 6, y0 - 6, size + 12, size * (WORLD.height / WORLD.width) + 12);
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, size, size * (WORLD.height / WORLD.width));
    ctx.clip();
    ctx.fillStyle = '#5d8a48';
    ctx.fillRect(x0, y0, size, size * (WORLD.height / WORLD.width));
    ctx.fillStyle = '#2f7fb8';
    ctx.fillRect(x0 + WORLD.oceanX * scale, y0, size, size * (WORLD.height / WORLD.width));
    ctx.fillStyle = '#3a3f46';
    for (const rx of WORLD.roadXs) ctx.fillRect(x0 + rx * scale - 2, y0, 4, size * (WORLD.height / WORLD.width));
    for (const ry of WORLD.roadYs) ctx.fillRect(x0, y0 + ry * scale - 2, size, 4);
    const marker = game.missionMarker;
    if (marker) {
      ctx.fillStyle = '#ffd94d';
      ctx.beginPath(); ctx.arc(x0 + marker.x * scale, y0 + marker.y * scale, 5, 0, Math.PI * 2); ctx.fill();
    }
    // Player arrow.
    const px = x0 + game.player.x * scale;
    const py = y0 + game.player.y * scale;
    ctx.fillStyle = '#ff5a3c';
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(px, py, 5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
    ctx.fillStyle = '#cfd6dd';
    ctx.font = '12px system-ui, sans-serif';
    ctx.fillText('SOLMAR BAY', x0, y0 + size * (WORLD.height / WORLD.width) + 26);
  };

  // --- menus ---
  renderer.drawStart = (game) => {
    overlay(ctx, 'rgba(8,18,32,0.72)');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 72px system-ui, sans-serif';
    ctx.fillText('NEON TIDE', VIEW.width / 2, 190);
    ctx.fillStyle = '#7fd4ff';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.fillText('A SOLMAR BAY STORY', VIEW.width / 2, 232);
    ctx.fillStyle = '#eef1f5';
    ctx.font = '19px system-ui, sans-serif';
    const lines = [
      'Milo Kade is back in Solmar Bay — and his debt to Odette Voss is due.',
      'Five jobs stand between him and a clean slate. Steal cars, outrun the',
      'Solmar PD, and finish what the tide started.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, VIEW.width / 2, 300 + i * 28));
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText(game.hasSave ? 'ENTER — Continue your story      N — New game' : 'ENTER or CLICK — Start your story', VIEW.width / 2, 430);
    ctx.fillStyle = '#9fb2c8';
    ctx.font = '16px system-ui, sans-serif';
    ctx.fillText('WASD move & drive · E steal / enter car · Mouse aim, Click shoot · Space handbrake · Esc pause', VIEW.width / 2, 480);
    ctx.fillText('Your progress saves automatically. An original game — no part of it is borrowed from any other.', VIEW.width / 2, 510);
    ctx.textAlign = 'left';
  };

  renderer.drawBriefing = (game) => {
    overlay(ctx, 'rgba(8,18,32,0.78)');
    const m = game.briefing;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 40px system-ui, sans-serif';
    ctx.fillText(m.title, VIEW.width / 2, 170);
    ctx.fillStyle = '#eef1f5';
    ctx.font = '20px system-ui, sans-serif';
    wrapText(ctx, m.briefing, VIEW.width / 2, 230, 820, 30);
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.fillText('Reward: $' + m.reward.toLocaleString(), VIEW.width / 2, 420);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — Accept the job', VIEW.width / 2, 480);
    ctx.textAlign = 'left';
  };

  renderer.drawPause = () => {
    overlay(ctx, 'rgba(8,18,32,0.66)');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.fillText('PAUSED', VIEW.width / 2, 300);
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText('Esc — Resume      S — Save now      Q — Quit to title', VIEW.width / 2, 360);
    ctx.textAlign = 'left';
  };

  renderer.drawBanner = (game) => {
    if (!game.banner) return;
    ctx.textAlign = 'center';
    ctx.globalAlpha = Math.min(1, game.bannerTimer * 2);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 42px system-ui, sans-serif';
    ctx.fillText(game.banner, VIEW.width / 2, 150);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'left';
  };

  renderer.drawMessage = (game) => {
    if (!game.message) return;
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.fillText(game.message, VIEW.width / 2, VIEW.height - 84);
    ctx.textAlign = 'left';
  };

  renderer.drawGameOver = (game) => {
    overlay(ctx, 'rgba(40,4,4,0.72)');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ff6b5e';
    ctx.font = 'bold 64px system-ui, sans-serif';
    ctx.fillText(game.player.busted ? 'BUSTED' : 'WASTED', VIEW.width / 2, 300);
    ctx.fillStyle = '#eef1f5';
    ctx.font = '20px system-ui, sans-serif';
    ctx.fillText(game.player.busted
      ? 'Solmar PD hauled Milo in. The debt is still due.'
      : 'Milo went down in Solmar Bay. The tide does not wait.',
      VIEW.width / 2, 350);
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — Back on your feet', VIEW.width / 2, 420);
    ctx.textAlign = 'left';
  };

  renderer.drawComplete = (game) => {
    overlay(ctx, 'rgba(8,26,14,0.78)');
    ctx.textAlign = 'center';
    ctx.fillStyle = '#7ee787';
    ctx.font = 'bold 52px system-ui, sans-serif';
    ctx.fillText('DEBT PAID', VIEW.width / 2, 260);
    ctx.fillStyle = '#eef1f5';
    ctx.font = '20px system-ui, sans-serif';
    const lines = [
      'Five jobs. One clean slate. Milo Kade walks out of Solmar Bay',
      'owing nobody anything — and the Vesper Club owes him a drink.',
      'Free roam continues: keep the city, keep the cars, keep the heat.',
    ];
    lines.forEach((l, i) => ctx.fillText(l, VIEW.width / 2, 320 + i * 30));
    ctx.fillStyle = '#ffd94d';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.fillText('ENTER — Keep playing Solmar Bay', VIEW.width / 2, 460);
    ctx.textAlign = 'left';
  };

  return renderer;
}

function panel(ctx, x, y, w, h) {
  ctx.fillStyle = 'rgba(10,16,24,0.72)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w, h);
}

function overlay(ctx, color) {
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, VIEW.width, VIEW.height);
}

function wrapText(ctx, text, cx, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, cx, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, cx, yy);
}

function drawPerson(ctx, x, y, angle, shirt, pants) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  // Shadow, body, head, shoulders — a person seen from above.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 3, 11, 9, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = pants;
  ctx.fillRect(-7, -5, 14, 10);
  ctx.fillStyle = shirt;
  ctx.beginPath(); ctx.arc(0, 0, 9, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#e8b98a';
  ctx.beginPath(); ctx.arc(4, 0, 5.5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function drawCar(ctx, car, time) {
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.beginPath(); ctx.ellipse(2, 3, car.h / 2, car.w / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = car.color;
  roundRect(ctx, -car.h / 2, -car.w / 2, car.h, car.w, 9);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,24,30,0.85)';
  roundRect(ctx, -car.h / 4, -car.w / 2 + 4, car.h / 4.5, car.w - 8, 4);
  ctx.fill();
  roundRect(ctx, car.h / 8, -car.w / 2 + 4, car.h / 5, car.w - 8, 4);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.fillRect(car.h / 2 - 4, -car.w / 2 + 3, 3, 6);
  ctx.fillRect(car.h / 2 - 4, car.w / 2 - 9, 3, 6);
  ctx.fillStyle = '#ff5a3c';
  ctx.fillRect(-car.h / 2 + 1, -car.w / 2 + 3, 3, 6);
  ctx.fillRect(-car.h / 2 + 1, car.w / 2 - 9, 3, 6);
  ctx.restore();
}

function drawPoliceCar(ctx, car, time) {
  drawCar(ctx, car, time);
  // Light bar, flashing red and blue.
  const on = Math.floor(time * 6) % 2 === 0;
  ctx.save();
  ctx.translate(car.x, car.y);
  ctx.rotate(car.angle);
  ctx.fillStyle = on ? '#ff2d2d' : '#2d7bff';
  ctx.fillRect(-6, -car.w / 2 + 2, 12, 8);
  ctx.fillStyle = on ? '#2d7bff' : '#ff2d2d';
  ctx.fillRect(-6, car.w / 2 - 10, 12, 8);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('PD', 0, 4);
  ctx.restore();
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

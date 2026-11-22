# Neon Tide — A Solmar Bay Story

[![make.fun](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Tianchen0012/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Tianchen0012/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

A make.fun bounty entry for **gta6-01**: an original open-world crime game, built from scratch in a single recorded session. No part of it is borrowed from any commercial game — the city, characters, story, art and sounds are all invented here.

## The game

**Neon Tide** is set in **Solmar Bay**, a sun-soaked coastal city of avenues, palm courts, a marina and a beach. You are **Milo Kade**, a wheelman who drove out of town three years ago and has just come back — to find his old debt to **Odette Voss** of the Vesper Club is due. Five jobs stand between him and a clean slate, and the rival **Harbormen** crew, led by Ray Calloway, would rather see him at the bottom of the bay.

## What's in the world

- **A city to explore on foot and by car** — a 3600×3200 road grid with five districts (Old Town, Downtown, the Marina, Palm Heights, North Park), a beach and an ocean, parks, and hundreds of buildings.
- **Traffic and pedestrians** — cars follow the roads, turn at intersections and queue behind each other; pedestrians stroll the sidewalks and flee from gunfire.
- **Cars to steal and drive** — walk up to any parked car or one in traffic and press **E**. Seven models, from a Harbor taxi to the purple Vesper GT.
- **A wanted level with responding police** — 0–5 stars. Stealing a car, running someone over or shooting raises the heat; cruisers chase and ram you, foot cops chase and shoot when you're walking, and a star drops off after you stay out of sight.
- **Missions and a story** — five jobs with briefings, gold markers and minimap waypoints: Homecoming, The Pickup, Hot Wheels, Heat Wave, and the finale, The Marlin Job.
- **Combat** — mouse aim, click to shoot, with a pistol on foot; the Harbormen shoot back in the finale.
- **HUD with minimap** — cash, health, wanted stars, the current objective, a speedometer while driving, and a live minimap of Solmar Bay.
- **Start screen, pause, and saving** — your cash, completed jobs and position save automatically (and with **S** while paused) to localStorage.

## Controls

| Key | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive in a car |
| Shift | Sprint |
| E | Enter / steal a car, leave a car |
| Mouse + click | Aim and shoot (on foot) |
| Space | Handbrake |
| M | Mute |
| Esc | Pause |

## Sound

All sound is synthesized live with the Web Audio API — engine growl, two-tone police sirens, gunshots, and a low synth pad underneath. No audio files.

## Play it

```sh
node serve.ts
# open http://localhost:8080
```

`game/index.html` is plain static files with no build step and no network requests: every script is a file under `game/`, every sound is generated in code.

## Handing it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` to the output directory and writes `dossier.json` with the vendored `make.fun` library.

## Files

- `game/index.html` — the page; a full-window canvas.
- `game/src/config.js` — every tuning number and colour.
- `game/src/rng.js` — the seeded random generator behind the city.
- `game/src/city.js` — builds Solmar Bay: roads, blocks, buildings, landmarks.
- `game/src/vehicles.js` — car physics, traffic AI, police pursuit.
- `game/src/people.js` — the player, pedestrians, foot cops, bullets.
- `game/src/missions.js` — the story and the five jobs.
- `game/src/audio.js` — synthesized sound: engine, sirens, shots, music pad.
- `game/src/input.js` — keyboard + mouse.
- `game/src/render.js` — the city, the HUD, the minimap, every menu.
- `game/src/save.js` — localStorage save / load.
- `game/src/main.js` — boot, the game loop, screens, wanted logic, screenshot staging.
- `screenshots/` — four real renders of the game running in headless Chromium.

## License

MIT — see `LICENSE`.

[![make.fun bounty](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/Tianchen0012/gta6-01/rank.svg)](https://make.fun/bounty/gta6-01)
[![reward](https://make.fun/badge/gta6-01/Tianchen0012/gta6-01/reward.svg)](https://make.fun/bounty/gta6-01)

# Solmar — Streets of Gold

A make.fun bounty entry for **gta6-01**: an original open-world crime game that runs
entirely from static files in a desktop browser. No assets are borrowed from any
other game — the city, the characters, the story, the art and the sounds are all
invented here.

## The game

Jax Marlow came to Solmar with a duffel bag and a debt. The fixer Mara Voss has
work for anyone fast enough to take it: five story missions across a sun-soaked
coastal city — steal a car, run a package to the docks, settle a gang dispute at
the Plaza, outrun a three-star police chase, and finally hit Bay Bank.

- **Open city** — a 10×10 street grid with a beach, a harbour, parks, a plaza and
  named landmarks, explorable on foot and by car.
- **Traffic and pedestrians** — cars follow the street grid, pedestrians walk the
  sidewalks and flee gunfire.
- **Steal and drive** — walk up to any parked or moving car and press E. Police
  cruisers can be stolen too, if you dare.
- **Wanted level** — crimes raise the stars; cruisers chase and ram you, foot
  cops run you down. Lose them and the heat cools off. Get caught and you are
  busted, fined, and dropped back at the Plaza.
- **Combat** — mouse aim, click to shoot, R to reload; gang enemies shoot back.
- **Missions and story** — five jobs with objectives, a timer on the delivery
  run, a shootout, a getaway and a bank job, each paying cash.
- **HUD** — health, cash, wanted stars, ammo, speed, a live minimap with the
  mission marker, police and enemy blips, and the current objective.
- **Save** — progress (cash, jobs done, position) is stored in localStorage and
  saved automatically after every job; Continue picks up where you left off.
- **Sound** — engine hum, sirens, gunshots and jingles, all synthesised with
  WebAudio. No audio files.

## Controls

| Input | Action |
| --- | --- |
| WASD / arrows | Move on foot, drive |
| Mouse | Aim |
| Click | Shoot |
| E | Steal / exit a car |
| R | Reload |
| Shift / Space | Sprint |
| P / Esc | Pause (saves) |
| M | Mute |

## Play it

```sh
node serve.ts
```

Then open http://localhost:8080 in desktop Chrome. The game makes no network
requests: every script is a file under `game/`.

## Files

- `game/index.html` — the page; `game/src/` holds the game, one file per job:
  `config.js` (tuning), `random.js` (seeded RNG), `city.js` (the city model),
  `world.js` (player, cars, traffic, police, combat), `missions.js` (the story),
  `render.js` (drawing, HUD, minimap, menus), `input.js`, `audio.js`
  (WebAudio synth), `shots.js` (screenshot staging), `main.js` (boot and loop).
- `main.ts` — copies `game/` and `screenshots/` to `/output` and writes
  `dossier.json` with the vendored make.fun library.
- `screenshots/` — four real renders of the game running in a browser:
  the title screen, a police chase, on-foot play, and the Plaza shootout.

## Screenshots

The four shots are staged by the game's own code (`?shot=start|drive|foot|mission`
with a fixed seed): each one plays the real rules forward from a fresh world, so
every frame is what actual play looks like.

Verified independently in this session: `main.ts` reproduces the `/output`
dossier byte-for-byte across runs, and `game/` makes no network requests.

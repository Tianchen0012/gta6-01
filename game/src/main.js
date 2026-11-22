// Boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps, and the renderer paints what is there. The game moves between five
// screens: title, play, paused, busted and done (all missions finished).
//
// ?seed=N fixes the city. ?shot=start|drive|foot|mission (with &seed=N) stages that
// scene instead of running the loop, paints it twice and sets window.__shotReady
// for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { createAudio } from './audio.js';
import { createWorld, EVENT_BUSTED, EVENT_MISSION_DONE } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createRenderer, SCREEN_BUSTED, SCREEN_DONE, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';
import { MISSIONS } from './missions.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = createAudio();
const world = createWorld(createRandom(seed), audio);
const renderer = createRenderer(canvas);

function hasSave() {
  try {
    return window.localStorage.getItem('solmar-save-v1') !== null;
  } catch {
    return false;
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best ?? 0, hasSave());
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = world.state.stats.missionsDone;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame(fresh) {
    audio.unlock();
    if (fresh) {
      world.reset();
      best = 0;
    }
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Playing. Follow the gold marker — Mara has work for you.');
  }

  function toTitle() {
    world.save();
    screen = SCREEN_TITLE;
    announce('Solmar, Streets of Gold. Press Enter or click New Game to start.');
  }

  function handleTitleClick() {
    const mouse = input.mouse;
    if (!input.consumeClick()) return;
    if (renderer.buttonAt(mouse.x, mouse.y, 'NEW GAME')) startGame(true);
    else if (hasSave() && renderer.buttonAt(mouse.x, mouse.y, 'CONTINUE')) {
      audio.unlock();
      world.load();
      best = world.state.stats.missionsDone;
      screen = SCREEN_PLAY;
      announce('Continuing your story.');
    }
  }

  function handlePausedClick() {
    const mouse = input.mouse;
    if (!input.consumeClick()) return;
    if (renderer.buttonAt(mouse.x, mouse.y, 'RESUME')) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (renderer.buttonAt(mouse.x, mouse.y, 'SAVE & QUIT TO TITLE')) {
      toTitle();
    }
  }

  function handleEndClick() {
    const mouse = input.mouse;
    if (!input.consumeClick()) return;
    if (screen === SCREEN_BUSTED && renderer.buttonAt(mouse.x, mouse.y, 'BACK ON THE STREET')) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    } else if (screen === SCREEN_DONE && renderer.buttonAt(mouse.x, mouse.y, 'KEEP PLAYING')) {
      screen = SCREEN_PLAY;
      announce('Free roam. Solmar is yours.');
    }
  }

  function handleActions(actions) {
    audio.unlock();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
      return;
    }
    if (screen === SCREEN_TITLE) {
      handleTitleClick();
      if (actions & ACTION_CONFIRM) startGame(true);
      return;
    }
    if (screen === SCREEN_PAUSED) {
      handlePausedClick();
      if (actions & ACTION_PAUSE) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      }
      return;
    }
    if (screen === SCREEN_BUSTED || screen === SCREEN_DONE) {
      handleEndClick();
      if (actions & ACTION_CONFIRM) screen = SCREEN_PLAY;
      return;
    }
    // Playing.
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Paused. Progress saved.');
    }
  }

  function mouseWorld() {
    const { width, height, scale } = renderer.size;
    const mouse = input.mouse;
    const cam = world.state.camera;
    return {
      x: cam.x - width / 2 / scale + mouse.x / scale,
      y: cam.y - height / 2 / scale + mouse.y / scale,
    };
  }

  function step(actions) {
    const events = world.step(STEP, input, actions, mouseWorld());
    if (events & EVENT_BUSTED) {
      screen = SCREEN_BUSTED;
      world.save();
      announce('Busted. The Solmar PD caught you.');
    } else if (events & EVENT_MISSION_DONE) {
      best = world.state.stats.missionsDone;
      world.save();
      if (world.state.mission.done && world.state.mission.index === MISSIONS.length - 1) {
        screen = SCREEN_DONE;
        announce('All missions done. Solmar is yours.');
      } else {
        announce(`Job done. Next: ${MISSIONS[world.state.mission.index].title}.`);
      }
    }
    // Clicking a car-free spot on foot does nothing; the E key and mouse buttons
    // are handled inside the world step through the actions bitmask.
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // Read the one-shot actions once per frame: handleActions consumes the menu
    // keys, and the first world step gets the rest (shoot, steal, reload).
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      let first = true;
      while (accumulator >= STEP) {
        step(first ? actions : 0);
        first = false;
        accumulator -= STEP;
        if (screen !== SCREEN_PLAY) {
          accumulator = 0;
          break;
        }
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, hasSave());
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      world.save();
      announce('Paused.');
    }
  });

  announce('Solmar, Streets of Gold. Press Enter or click New Game to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

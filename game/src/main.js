// Canyon Courier — boot and the one loop: input is read every frame, the world
// advances in fixed 1/60 s steps (several in a slow frame, none in a fast one),
// and the renderer paints what is there. The game moves between four screens:
// title, play, paused and game over.
//
// ?seed=N fixes the canyon. ?shot=start|play|end (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady.

import { BEST_KEY, STEP } from './config.js';
import { createRandom } from './random.js';
import {
  EVENT_DROP,
  EVENT_LAND,
  EVENT_LOW_FUEL,
  EVENT_MISSION,
  EVENT_OVER,
  EVENT_RING,
  EVENT_SCRAPE,
  createWorld,
} from './world.js';
import {
  ACTION_CONFIRM,
  ACTION_DROP,
  ACTION_PAUSE,
  createInput,
} from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best score then lasts this visit only.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  let painted = 0;
  function paint() {
    renderer.draw(world, scene.screen, scene.best, world.state.time);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();
  let dropPressed = false;
  // Debug handle for automated checks; the game never reads it.
  window.__game = { world, get screen() { return screen; } };

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    audio.unlock();
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce('Flying. Thread the rings, mind the fuel.');
  }

  function endGame() {
    screen = SCREEN_OVER;
    if (world.state.score > best) {
      best = world.state.score;
      saveBest(best);
    }
    announce(`${world.state.overReason}. Score ${world.state.score}. Best ${best}.`);
  }

  function playEvents(events) {
    if (events & EVENT_RING) audio.ring();
    if (events & EVENT_DROP) audio.drop();
    if (events & EVENT_LAND) audio.land();
    if (events & EVENT_MISSION) audio.mission();
    if (events & EVENT_SCRAPE) audio.scrape();
    if (events & EVENT_LOW_FUEL) audio.lowFuel();
    if (events & EVENT_OVER) {
      audio.crash();
      endGame();
    }
  }

  function handleActions() {
    const actions = input.takeActions();
    // Space is both the drop key in flight and the confirm key on menus, so it
    // also starts the game; Enter and click confirm too.
    const confirm = (actions & (ACTION_CONFIRM | ACTION_DROP)) !== 0;
    if (actions & (ACTION_CONFIRM | ACTION_DROP)) audio.unlock();
    if (actions & ACTION_DROP && screen === SCREEN_PLAY) dropPressed = true;
    if (confirm && (screen === SCREEN_TITLE || screen === SCREEN_OVER)) startGame();
    else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if ((actions & (ACTION_PAUSE | ACTION_CONFIRM | ACTION_DROP)) && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Flying.');
    }
  }

  function step() {
    const frameInput = {
      steer: input.steer(),
      pitch: input.pitch(),
      throttle: input.throttle(),
      dropPressed,
    };
    dropPressed = false;
    if (screen === SCREEN_TITLE) {
      world.step(STEP, frameInput, true);
      return;
    }
    const events = world.step(STEP, frameInput, false);
    playEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    audio.setEngine(world.state.throttle, world.state.speed);
    renderer.draw(world, screen, best, world.state.time);
  }

  // Leaving the tab pauses a running game rather than letting the canyon fly unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Canyon Courier. Press Space or click to fly.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();

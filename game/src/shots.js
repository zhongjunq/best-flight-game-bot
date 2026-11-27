// The screenshot scenes behind ?shot=start|play|end. Each one plays the real rules
// forward from a fresh world for a fixed number of steps, so the frame is what a
// short game really looks like and the same seed always gives the same frame.
// The play pilot steers for the next ring; the end pilot flies blind into the wall.

import { STEP } from './config.js';
import { EVENT_OVER } from './world.js';
import { SCREEN_OVER, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const END_LIMIT_SECONDS = 120;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/** Steer and pitch toward the next unhit ring; level flight when none is ahead. */
function ringPilot(world) {
  const state = world.state;
  const next = state.rings.find((ring) => !ring.hit && ring.d > state.distance - 20);
  // Near a wall, the centre line comes first: a ring is never worth a scrape.
  const localX = state.x - world.centerAt(state.distance);
  if (Math.abs(localX) > 36) {
    return { steer: clamp(-localX / 20, -1, 1), pitch: 0, throttle: 0, dropPressed: false };
  }
  if (!next) return { steer: 0, pitch: 0, throttle: 0, dropPressed: false };
  const ringAbsX = world.centerAt(next.d) + next.x;
  const steer = clamp((ringAbsX - state.x) / 28, -1, 1);
  const pitch = clamp((next.h - state.alt) / 500, -1, 1);
  return { steer, pitch, throttle: 0, dropPressed: false };
}

/** A pilot who never looks up: full left bank until the canyon takes the plane. */
function blindPilot() {
  return { steer: -1, pitch: 0, throttle: 0, dropPressed: false };
}

function demoInput() {
  return { steer: 0, pitch: 0, throttle: 0, dropPressed: false };
}

/**
 * Set `world` to the named scene (start, play or end; any other name is start) and
 * return the screen to draw over it and the best score to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'end') {
    for (let index = 0; index < START_SECONDS / STEP; index += 1) {
      world.step(STEP, demoInput(), true);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'end') {
    for (let index = 0; index < END_LIMIT_SECONDS / STEP; index += 1) {
      if (world.step(STEP, blindPilot(), false) & EVENT_OVER) break;
    }
    return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
  }
  // Play: fly the autopilot until at least one ring is banked and the next ring
  // sits a good camera distance ahead (close enough to read, far enough to see
  // the plane and the canyon), or 26 s.
  for (let index = 0; index < PLAY_SECONDS / STEP; index += 1) {
    if (world.step(STEP, ringPilot(world), false) & EVENT_OVER) break;
    const next = world.state.rings.find((ring) => !ring.hit && ring.d > world.state.distance - 20);
    if (next && world.state.mission && world.state.mission.ringsHit >= 1) {
      const z = next.d - world.state.distance;
      if (z >= 70 && z <= 160 && index > 4 / STEP) break;
    }
  }
  return { screen: world.state.over ? SCREEN_OVER : SCREEN_PLAY, best: world.state.score };
}

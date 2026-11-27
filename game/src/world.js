// Canyon Courier — the world: flight model, canyon terrain, missions, scoring.
// The plane flies forward along a winding canyon. Distance grows with speed; the
// canyon curves, narrows and widens; rings, a drop target and a runway appear ahead
// as missions ask for them. Everything is deterministic from the boot seed.

import {
  CANYON_HALF,
  DAMAGE,
  DRAW_AHEAD,
  FIELD,
  FUEL,
  MISSION,
  PALETTES,
  PLANE,
  RING,
  SEGMENT,
  STEP,
} from './config.js';

export const EVENT_NONE = 0;
export const EVENT_RING = 1;
export const EVENT_DROP = 2;
export const EVENT_LAND = 4;
export const EVENT_SCRAPE = 8;
export const EVENT_MISSION = 16;
export const EVENT_OVER = 32;
export const EVENT_LOW_FUEL = 64;

const MISSION_TYPES = ['rings', 'drop', 'land'];
const METRES_PER_KNOT_SECOND = 0.514444;
const FEET_PER_METRE = 3.28084;

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

/**
 * The canyon winds as two slow sines, so the centre line drifts smoothly within
 * about ±56 m and a pilot (or the autopilot) can always follow it. A random walk
 * would wander hundreds of metres and push the rings outside the walls.
 */
function makeCenterFn(random) {
  const phase1 = random.range(0, Math.PI * 2);
  const phase2 = random.range(0, Math.PI * 2);
  return (distance) => 38 * Math.sin(distance * 0.006 + phase1) + 18 * Math.sin(distance * 0.013 + phase2);
}

/** One slice of canyon: wall heights, ground dressing. The centre comes from the sine. */
function buildSegment(random, previous, center) {
  const wall = previous ? previous.wall : random.range(200, 520);
  const wallL = clamp(wall + random.range(-46, 46), 160, 560);
  const wallR = clamp(wall + random.range(-46, 46), 160, 560);
  return {
    curve: 0,
    wall: (wallL + wallR) / 2,
    wallL,
    wallR,
    center,
    field: random.chance(0.5) ? 0 : 1,
    river: random.chance(0.16),
    riverX: random.range(-0.55, 0.55),
    road: random.chance(0.3),
    roadX: random.range(-0.6, 0.6),
  };
}

export function createWorld(random) {
  const state = {
    distance: 0,
    x: 0,
    alt: 900,
    speed: PLANE.cruiseSpeed,
    throttle: 0.62,
    pitch: 0,
    bank: 0,
    heading: 0,
    fuel: FUEL.capacity,
    damage: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    level: 1,
    missionIndex: 0,
    time: 0,
    mission: null,
    rings: [],
    runway: null,
    dropTarget: null,
    particles: [],
    message: '',
    messageTime: 0,
    shake: 0,
    scrapeTimer: 0,
    lowFuelWarned: false,
    over: false,
    overReason: '',
    landed: false,
    dropScored: false,
    ringsCleared: 0,
    dropsMade: 0,
    landingsMade: 0,
  };

  let segments = [];
  let generatedUpTo = -1;
  const centerFn = makeCenterFn(random);

  function ensureSegments(uptoIndex) {
    while (generatedUpTo < uptoIndex) {
      generatedUpTo += 1;
      const previous = generatedUpTo > 0 ? segments[generatedUpTo - 1] : null;
      const segment = buildSegment(random, previous, centerFn(generatedUpTo * SEGMENT));
      segments.push(segment);
    }
  }

  function segmentAt(distance) {
    const index = Math.max(0, Math.floor(distance / SEGMENT));
    ensureSegments(index + DRAW_AHEAD + 4);
    return segments[index];
  }

  function centerAt(distance) {
    return segmentAt(distance).center;
  }

  function reset() {
    segments = [];
    generatedUpTo = -1;
    ensureSegments(DRAW_AHEAD + 4);
    state.distance = 0;
    state.x = 0;
    state.alt = 900;
    state.speed = PLANE.cruiseSpeed;
    state.throttle = 0.62;
    state.pitch = 0;
    state.bank = 0;
    state.heading = 0;
    state.fuel = FUEL.capacity;
    state.damage = 0;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.level = 1;
    state.missionIndex = 0;
    state.time = 0;
    state.rings = [];
    state.runway = null;
    state.dropTarget = null;
    state.particles = [];
    state.message = '';
    state.messageTime = 0;
    state.shake = 0;
    state.scrapeTimer = 0;
    state.lowFuelWarned = false;
    state.over = false;
    state.overReason = '';
    state.landed = false;
    state.dropScored = false;
    state.ringsCleared = 0;
    state.dropsMade = 0;
    state.landingsMade = 0;
    setupMission();
  }

  function showMessage(text, seconds = 2.6) {
    state.message = text;
    state.messageTime = seconds;
  }

  /** Place the next mission ahead of the plane and announce it. */
  function setupMission() {
    const type = MISSION_TYPES[state.missionIndex % MISSION_TYPES.length];
    const level = Math.floor(state.missionIndex / MISSION_TYPES.length) + 1;
    state.level = level;
    state.rings = [];
    state.runway = null;
    state.dropTarget = null;
    state.dropScored = false;
    state.landed = false;
    const ahead = state.distance + 900;
    // A fresh leg after a landing starts back in the air.
    if (state.alt <= 0) {
      state.alt = 650;
      state.speed = PLANE.cruiseSpeed;
    }
    if (type === 'rings') {
      const count = MISSION.ringsBase + MISSION.ringsPerLevel * (level - 1);
      for (let i = 0; i < count; i += 1) {
        state.rings.push({
          d: ahead + i * 620,
          x: random.range(-34, 34),
          h: random.range(420, 2100),
          hit: false,
        });
      }
      state.mission = {
        type,
        label: `RING RUN — fly through ${count} rings`,
        ringsTotal: count,
        ringsHit: 0,
        timeLeft: MISSION.ringTime,
      };
      showMessage(`MISSION ${state.missionIndex + 1}: RING RUN — ${count} rings ahead!`);
    } else if (type === 'drop') {
      state.dropTarget = {
        d: ahead + 2600,
        x: random.range(-28, 28),
        scored: false,
      };
      state.mission = {
        type,
        label: 'COURIER DROP — release the parcel over the target',
        ringsTotal: 0,
        ringsHit: 0,
        timeLeft: 0,
      };
      showMessage('MISSION: COURIER DROP — parcel target ahead, press SPACE over it!');
    } else {
      state.runway = { d0: ahead + 2400, d1: ahead + 3600 };
      state.mission = {
        type,
        label: 'PRECISION LANDING — put her down on the runway',
        ringsTotal: 0,
        ringsHit: 0,
        timeLeft: 0,
      };
      showMessage('MISSION: PRECISION LANDING — runway ahead, slow down and line up!');
    }
  }

  function completeMission(bonus, text) {
    state.score += bonus;
    state.ringsCleared += state.mission && state.mission.type === 'rings' ? 1 : 0;
    showMessage(`${text}  +${bonus}`, 3.2);
    state.missionIndex += 1;
    state.combo = 0;
    setupMission();
  }

  function addSparks(count, color) {
    for (let i = 0; i < count; i += 1) {
      state.particles.push({
        x: FIELD.width / 2 + random.range(-70, 70),
        y: FIELD.height - 150 + random.range(-40, 40),
        vx: random.range(-160, 160),
        vy: random.range(-220, -40),
        life: random.range(0.3, 0.8),
        maxLife: 0.8,
        color,
        size: random.range(2, 5),
      });
    }
  }

  function updateParticles(dt) {
    for (let i = state.particles.length - 1; i >= 0; i -= 1) {
      const p = state.particles[i];
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      if (p.life <= 0) state.particles.splice(i, 1);
    }
  }

  /** Advance the world one fixed step. Returns a bitmask of events. */
  function step(dt, input, demo = false) {
    let events = EVENT_NONE;
    state.time += dt;
    if (state.messageTime > 0) state.messageTime -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 2.2);
    if (state.scrapeTimer > 0) state.scrapeTimer -= dt;
    updateParticles(dt);

    if (state.over) return events;

    // --- controls: smooth bank and pitch toward the pilot's input ---
    const steer = demo ? Math.sin(state.time * 0.35) * 0.45 : input.steer;
    const pitchIn = demo ? 0 : input.pitch;
    const throttleIn = demo ? 0 : input.throttle;
    state.bank += clamp(steer - state.bank, -dt * 3.2, dt * 3.2);
    state.pitch += clamp(pitchIn - state.pitch, -dt * 2.6, dt * 2.6);
    if (!demo) state.throttle = clamp(state.throttle + throttleIn * 0.45 * dt, 0, 1);

    // --- speed: chases the throttle, climbs bleed speed, dives gain it ---
    const targetSpeed = PLANE.minSpeed + state.throttle * (PLANE.maxSpeed - PLANE.minSpeed);
    state.speed += clamp(targetSpeed - state.speed, -PLANE.accel * dt, PLANE.accel * dt);
    if (state.pitch > 0) state.speed -= state.pitch * 14 * dt;
    if (state.pitch < 0) state.speed -= state.pitch * 9 * dt;
    state.speed = clamp(state.speed, 40, PLANE.maxSpeed + 12);

    // --- position: forward, lateral from banking, altitude from pitch ---
    const speedMetres = state.speed * METRES_PER_KNOT_SECOND;
    state.distance += speedMetres * dt;
    state.x += state.bank * PLANE.turnRate * dt;
    state.heading = (state.heading + state.bank * 38 * dt + 360) % 360;
    const speedFactor = clamp(state.speed / PLANE.maxSpeed, 0.35, 1);
    state.alt += state.pitch * PLANE.climbRate * speedFactor * dt;
    if (state.speed < 78) state.alt -= (78 - state.speed) * 2.4 * dt;
    state.alt = clamp(state.alt, 0, 3200);

    if (demo) {
      state.alt = 900 + Math.sin(state.time * 0.5) * 120;
      state.fuel = FUEL.capacity;
      return events;
    }

    // --- fuel: throttle burns it; empty tanks mean a dead engine ---
    const burn = (FUEL.burnIdle + state.throttle * (FUEL.burnFull - FUEL.burnIdle)) * dt;
    state.fuel = Math.max(0, state.fuel - burn);
    if (state.fuel <= FUEL.lowAt && !state.lowFuelWarned) {
      state.lowFuelWarned = true;
      events |= EVENT_LOW_FUEL;
      showMessage('LOW FUEL — find the runway or glide home!', 3);
    }
    if (state.fuel <= 0) {
      state.throttle = 0;
      state.speed = Math.max(58, state.speed - 26 * dt);
    }

    // --- canyon walls: scrape when the plane is past the wall line and below its top ---
    const segment = segmentAt(state.distance);
    const center = segment.center;
    const altMetres = state.alt / FEET_PER_METRE;
    const wallL = center - CANYON_HALF;
    const wallR = center + CANYON_HALF;
    const wallHeight = state.x < center ? segment.wallL : segment.wallR;
    if (state.scrapeTimer <= 0 && altMetres < wallHeight && (state.x < wallL + 4 || state.x > wallR - 4)) {
      state.damage += DAMAGE.scrape;
      state.scrapeTimer = PLANE.scrapeGrace;
      state.shake = 1;
      state.x = clamp(state.x, wallL + 6, wallR - 6);
      addSparks(14, '#ffb347');
      events |= EVENT_SCRAPE;
      showMessage('SCRAPE! Canyon wall — watch the edges!', 1.6);
      if (state.damage >= 100) {
        state.over = true;
        state.overReason = 'CRASHED INTO THE CANYON WALL';
        return EVENT_OVER;
      }
    }

    // --- rings: fly through to score; the combo grows per consecutive ring ---
    for (const ring of state.rings) {
      if (ring.hit || ring.d < state.distance - 60) continue;
      if (Math.abs(ring.d - state.distance) < 34) {
        const lateral = Math.abs(state.x - ring.x);
        const vertical = Math.abs(state.alt - ring.h);
        if (lateral < RING.radius && vertical < RING.radius * FEET_PER_METRE * 1.5) {
          ring.hit = true;
          state.combo = Math.min(state.combo + 1, RING.maxCombo);
          state.bestCombo = Math.max(state.bestCombo, state.combo);
          const gained = RING.points * state.combo;
          state.score += gained;
          events |= EVENT_RING;
          if (state.mission) state.mission.ringsHit += 1;
        }
      }
    }
    for (const ring of state.rings) {
      if (!ring.hit && ring.d < state.distance - 60) state.combo = 0;
    }

    // --- mission timers and completion ---
    if (state.mission && state.mission.type === 'rings') {
      state.mission.timeLeft -= dt;
      if (state.mission.ringsHit >= state.mission.ringsTotal) {
        const bonus = Math.round(state.mission.timeLeft) * 5 + 150;
        events |= EVENT_MISSION;
        completeMission(bonus, 'RING RUN CLEAR!');
        return events;
      }
      if (state.mission.timeLeft <= 0) {
        showMessage('TIME UP — next mission!', 2.4);
        state.missionIndex += 1;
        setupMission();
      }
    }

    // --- courier drop: SPACE over the target scores by accuracy ---
    if (input.dropPressed && state.dropTarget && !state.dropTarget.scored) {
      const target = state.dropTarget;
      const along = Math.abs(state.distance - target.d);
      if (along < 130 && state.alt < 1900) {
        const error = Math.abs(state.x - target.x) + along * 0.25;
        const gained = Math.max(60, Math.round(MISSION.dropMax - error * 5));
        state.score += gained;
        state.dropTarget.scored = true;
        state.dropScored = true;
        state.dropsMade += 1;
        events |= EVENT_DROP;
        completeMission(gained, `PARCEL DELIVERED — ${Math.round(error)}m off target!`);
        return events;
      }
      showMessage('Drop missed — too far from the target!', 2);
      state.dropTarget.scored = true;
      state.missionIndex += 1;
      setupMission();
    }

    // --- ground: a gentle touchdown on the runway lands; anything else crashes ---
    if (state.alt <= 0) {
      const onRunway =
        state.runway && state.distance >= state.runway.d0 && state.distance <= state.runway.d1;
      if (onRunway && state.mission && state.mission.type === 'land' && state.speed < 138) {
        const alignment = Math.abs(state.x - center);
        const gained = Math.max(
          80,
          Math.round(MISSION.landMax - alignment * 4 - Math.max(0, state.speed - 95) * 3),
        );
        state.score += gained;
        state.landed = true;
        state.landingsMade += 1;
        state.fuel = Math.min(FUEL.capacity, state.fuel + FUEL.landingRefuel);
        state.lowFuelWarned = false;
        state.alt = 0;
        events |= EVENT_LAND;
        completeMission(gained, 'TOUCHDOWN — beautiful landing!');
        return events;
      }
      state.over = true;
      state.overReason =
        state.fuel <= 0 ? 'RAN OUT OF FUEL' : 'CRASHED INTO THE GROUND';
      return EVENT_OVER;
    }

    return events;
  }

  reset();

  return {
    state,
    reset,
    step,
    segmentAt,
    centerAt,
    /** The palette for the current level's time of day. */
    palette() {
      return PALETTES[(state.level - 1) % PALETTES.length];
    },
  };
}
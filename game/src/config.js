// Canyon Courier — every tuning number and colour in one place.
// The playfield is a fixed 1280x720 logical area; the renderer scales it to the
// window, so no rule below depends on the screen size.

export const FIELD = { width: 1280, height: 720, horizonY: 296 };

/** The simulation's fixed step, in seconds: 60 updates a second whatever the display's rate. */
export const STEP = 1 / 60;

/** The canyon is this wide at the plane's height, in metres, wall to wall. */
export const CANYON_HALF = 78;
/** One terrain slice, in metres of forward travel. */
export const SEGMENT = 40;
/** How many slices the renderer draws ahead. */
export const DRAW_AHEAD = 26;

/** The plane: speeds in knots, altitudes in feet, fuel in percent. */
export const PLANE = {
  minSpeed: 62,
  maxSpeed: 218,
  cruiseSpeed: 132,
  /** Knots per second the speed chases the throttle target. */
  accel: 34,
  /** Feet per second at full climb, scaled by speed. */
  climbRate: 620,
  /** Lateral metres per second at full bank. */
  turnRate: 52,
  /** Degrees of visual bank at full turn. */
  bankDegrees: 34,
  /** Seconds of invulnerability after a scrape. */
  scrapeGrace: 1.2,
};

export const FUEL = {
  capacity: 100,
  /** Percent per second at full throttle. */
  burnFull: 1.55,
  /** Percent per second at idle. */
  burnIdle: 0.35,
  /** Fuel back on a good landing. */
  landingRefuel: 55,
  /** Warning threshold. */
  lowAt: 25,
};

export const DAMAGE = {
  /** Damage from one wall or ground scrape. */
  scrape: 26,
  /** Damage per second while scraping along. */
  grind: 18,
};

export const RING = {
  /** Ring radius in metres. */
  radius: 15,
  points: 100,
  /** Combo grows per consecutive ring, up to this multiplier. */
  maxCombo: 5,
};

export const MISSION = {
  /** Rings per Ring Run, growing with the level. */
  ringsBase: 5,
  ringsPerLevel: 1,
  /** Seconds for a Ring Run before the clock runs out. */
  ringTime: 75,
  /** Points for a parcel dropped inside the target. */
  dropMax: 500,
  /** Points for a textbook landing. */
  landMax: 500,
};

/** Three times of day, cycled one per level. */
export const PALETTES = [
  {
    name: 'dawn',
    skyTop: '#2b3a6b',
    skyMid: '#e08a4c',
    skyLow: '#f7c873',
    sun: '#ffd98a',
    sunGlow: 'rgba(255, 190, 110, 0.55)',
    mountainFar: '#6b5a8e',
    mountainNear: '#4a3d63',
    groundFar: '#6b6a42',
    groundNear: '#4a5a2e',
    fieldA: '#5d8a35',
    fieldB: '#c2a13e',
    river: '#4f7fa8',
    road: '#5a5560',
    rockFar: '#8a6a72',
    rockNear: '#6b4a52',
    runway: '#3c3f46',
    runwayLine: '#f2e9c9',
  },
  {
    name: 'day',
    skyTop: '#2f6fc4',
    skyMid: '#7fb5e8',
    skyLow: '#cfe8f7',
    sun: '#fff3c4',
    sunGlow: 'rgba(255, 244, 190, 0.5)',
    mountainFar: '#7d90b5',
    mountainNear: '#5d7396',
    groundFar: '#7a8a48',
    groundNear: '#4f6d2e',
    fieldA: '#58a03e',
    fieldB: '#d0b23e',
    river: '#3f7fb8',
    road: '#6a6a70',
    rockFar: '#9a7a68',
    rockNear: '#7a5a4e',
    runway: '#41444c',
    runwayLine: '#f5f0d0',
  },
  {
    name: 'dusk',
    skyTop: '#1d2340',
    skyMid: '#a34a6b',
    skyLow: '#e88a5a',
    sun: '#ff9a5a',
    sunGlow: 'rgba(255, 140, 90, 0.55)',
    mountainFar: '#5a4368',
    mountainNear: '#3e2f4a',
    groundFar: '#5d4c38',
    groundNear: '#3e3a2c',
    fieldA: '#4e7a30',
    fieldB: '#a8842e',
    river: '#3a5a7d',
    road: '#4a464e',
    rockFar: '#6e4a52',
    rockNear: '#523640',
    runway: '#33363d',
    runwayLine: '#e8ddba',
  },
];

export const PLANE_COLORS = {
  fuselage: '#e8e4da',
  wing: '#c94f38',
  tail: '#c94f38',
  canopy: '#2f5d8a',
  stripe: '#2f5d8a',
  prop: 'rgba(220, 225, 235, 0.35)',
};

export const FONT = 'system-ui, -apple-system, "Segoe UI", sans-serif';

/** Where the best score is kept between visits (this browser only). */
export const BEST_KEY = 'canyon-courier.best';

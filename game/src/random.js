// A tiny seeded random generator (mulberry32) so a ?seed=N run is the same every time.
// The world takes one of these at boot and never touches Math.random afterwards.

export function createRandom(seed) {
  let state = seed >>> 0;
  if (state === 0) state = 0x9e3779b9;
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  }
  return {
    next,
    /** A float in [min, max). */
    range(min, max) {
      return min + next() * (max - min);
    },
    /** An integer in [min, max]. */
    int(min, max) {
      return Math.floor(min + next() * (max - min + 1));
    },
    /** True with the given probability. */
    chance(p) {
      return next() < p;
    },
    /** One of the given items, uniformly. */
    pick(items) {
      return items[Math.floor(next() * items.length)];
    },
  };
}

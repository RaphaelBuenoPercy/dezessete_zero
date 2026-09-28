// Seeded pseudo-random number generator and small math/array helpers.
// Shared by league generation and the game-simulation engine so runs
// are reproducible from a string seed.

function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function seedFromString(s) {
  let h = 0;
  for (let i = 0; i < s.length; i++) { h = (Math.imul(31, h) + s.charCodeAt(i)) | 0; }
  return h;
}
function randInt(rng, min, max) { return Math.floor(rng() * (max - min + 1)) + min; }
function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

export { mulberry32, seedFromString, randInt, pick, clamp };

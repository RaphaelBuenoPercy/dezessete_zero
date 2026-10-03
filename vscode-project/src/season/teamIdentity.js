import { mulberry32, seedFromString, pick } from "../lib/rng.js";

// ============================================================
// TEAM IDENTITY
//
// Purely cosmetic, purely deterministic: the same abbreviation always
// produces the same mascot/nickname/stadium, seeded from the abbreviation
// itself, so nothing needs to be generated at league-build time or
// persisted in the save — any screen can just call teamIdentity(abbr).
// ============================================================

const MASCOTS = [
  "Lobos", "Falcões", "Touros", "Guerreiros", "Tubarões", "Cavalaria", "Dragões",
  "Panteras", "Furacão", "Titãs", "Corsários", "Centuriões", "Vigias", "Linces",
];
const FAN_PREFIXES = ["Exército", "Nação", "Legião", "Multidão", "Fiel Torcida", "Horda", "Esquadrão"];
const STADIUM_SUFFIXES = ["Arena", "Stadium", "Coliseu", "Domo", "Field", "Park"];
const CHANTS = [
  "no ataque, no ataque, vai pra cima!",
  "defesa, defesa, levanta esse muro!",
  "essa casa é nossa, ninguém vai tirar!",
  "hoje o jogo é nosso, bota fé!",
];

function teamIdentity(abbr, city) {
  const rng = mulberry32(seedFromString("identity-" + abbr));
  const mascot = pick(rng, MASCOTS);
  const fanNickname = `${pick(rng, FAN_PREFIXES)} ${mascot}`;
  const stadiumName = `${city || abbr} ${pick(rng, STADIUM_SUFFIXES)}`;
  const chant = pick(rng, CHANTS);
  return { mascot, fanNickname, stadiumName, chant };
}

export { teamIdentity };

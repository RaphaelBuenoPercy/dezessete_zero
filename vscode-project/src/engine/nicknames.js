import { pick } from "../lib/rng.js";

// ============================================================
// PLAYER NICKNAMES
//
// Assigned once, at creation (same moment attrs are rolled), from
// whichever of the player's two tracked sub-attributes is stronger. Pure
// flavor — never read by any gameplay system — so it's safe to call from
// makePlayer/makeCustomPlayer without touching anything else.
// ============================================================

const NICKNAME_POOL = {
  ARM: ["Canhão", "Braço de Aço", "Mísseis"],
  ACC: ["Cirurgião", "Precisão", "Relojoeiro"],
  SPD: ["Foguete", "Relâmpago", "Vento"],
  POW: ["Trator", "Muralha", "Demolidor"],
  HND: ["Mãos de Veludo", "Aranha", "Imã"],
  BLK: ["Porta de Aço", "Parede"],
  RBK: ["O Muro", "Fundação"],
  PBK: ["Guardião", "Escudo"],
  RSH: ["Caçador", "Pesadelo do QB", "Fera"],
  RUN: ["Parede de Contenção", "Freio"],
  COV: ["Sombra", "Cadeado", "Fantasma"],
  TKL: ["Martelo", "Trem-Bala"],
};

// Picks the stronger of the player's two sub-attributes and draws a
// nickname from that trait's pool — small random element so two players
// with the same standout trait don't always share a name.
function generateNickname(rng, pos, attrs, subAttrKeys) {
  const keys = subAttrKeys || Object.keys(attrs || {});
  if (keys.length !== 2) return null;
  const [k1, k2] = keys;
  const hiKey = (attrs[k1] ?? 0) >= (attrs[k2] ?? 0) ? k1 : k2;
  const pool = NICKNAME_POOL[hiKey];
  if (!pool) return null;
  return pick(rng, pool);
}

export { generateNickname };

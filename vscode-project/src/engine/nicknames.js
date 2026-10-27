import { pick } from "../lib/rng.js";

// ============================================================
// PLAYER NICKNAMES
//
// Assigned once, at creation (same moment attrs are rolled), a partir do
// MAIOR atributo do jogador entre todos os atributos da posição. Pure
// flavor — never read by any gameplay system — so it's safe to call from
// makePlayer/makeCustomPlayer without touching anything else.
// ============================================================

const NICKNAME_POOL = {
  // QB
  THP: ["Canhão", "Braço de Aço", "Mísseis"],
  STA: ["Metrônomo", "Relojoeiro", "Bisturi"],
  MTA: ["Cirurgião", "Precisão", "Mira Laser"],
  DTA: ["Franco-Atirador", "Míssil Guiado", "Bomba Certeira"],
  AWR: ["Professor", "Cérebro", "Enxadrista"],
  MOB: ["Houdini", "Enguia", "Escapista"],
  TUP: ["Sangue-Frio", "Gelo nas Veias", "Imperturbável"],
  // velocidade / físico
  SPD: ["Foguete", "Relâmpago", "Vento"],
  ACC: ["Turbo", "Arrancada", "Mola"],
  POW: ["Trator", "Muralha", "Demolidor"],
  STR: ["Touro", "Hércules", "Gigante"],
  AGI: ["Gato", "Dançarino", "Elástico"],
  VIS: ["Radar", "Olhos de Águia", "GPS"],
  // recebedores
  CTH: ["Mãos de Veludo", "Aranha", "Imã"],
  RTE: ["Bússola", "Desenhista", "Gelo"],
  CIT: ["Destemido", "Blindado", "Sem Medo"],
  // linha
  PBK: ["Guardião", "Escudo", "Cofre"],
  RBK: ["O Muro", "Fundação", "Porta de Aço"],
  PMV: ["Marreta", "Britadeira", "Fera"],
  FMV: ["Navalha", "Enguia do Pass Rush", "Pesadelo do QB"],
  BSH: ["Faxineiro", "Desintegrador", "Parede de Contenção"],
  // defesa
  TKL: ["Martelo", "Trem-Bala", "Guilhotina"],
  PRC: ["Vidente", "Leitor", "Radar de Jogadas"],
  ZCV: ["Teia", "Redoma", "Guardião da Zona"],
  MCV: ["Sombra", "Cadeado", "Fantasma"],
  PRS: ["Algema", "Grudento", "Muro de Contenção"],
  PUR: ["Cão de Caça", "Perseguidor", "Rastreador"],
  // especialistas
  KPW: ["Bazuca", "Pé de Ferro", "Canhão do Pé"],
  KAC: ["Relógio Suíço", "Pé de Ouro", "Mira Perfeita"],
  CLT: ["Hora H", "Decisivo", "Gelado"],
  TRK: ["Mágico", "Ilusionista", "Truqueiro"],
};

// Escolhe o maior atributo entre TODOS os do jogador e sorteia um apelido do
// pool desse atributo. Empates entre atributos são resolvidos no sorteio, e o
// apelido em si também é sorteado, então dois jogadores com o mesmo destaque
// nem sempre dividem o nome.
function generateNickname(rng, pos, attrs, subAttrKeys) {
  const keys = (subAttrKeys && subAttrKeys.length ? subAttrKeys : Object.keys(attrs || {})).filter((k) => attrs?.[k] != null);
  if (!keys.length) return null;
  const top = Math.max(...keys.map((k) => attrs[k]));
  const best = keys.filter((k) => attrs[k] === top);
  const hiKey = best.length > 1 ? pick(rng, best) : best[0];
  const pool = NICKNAME_POOL[hiKey];
  if (!pool) return null;
  return pick(rng, pool);
}

export { generateNickname, NICKNAME_POOL };

import { SUB_ATTRS, ATTR_LABELS } from "../data/rosterSlots.js";

// Rótulos do relatório de olheiros para os atributos novos.
// TRAIT_LABELS = ponto forte (maior atributo); CONCERN_LABELS = ponto fraco (menor).
const TRAIT_LABELS = {
  THP: "braço forte", STA: "precisão nos passes curtos", MTA: "precisão nos passes médios", DTA: "precisão nos lançamentos longos",
  AWR: "ótima leitura de jogo", MOB: "mobilidade para escapar da pressão", TUP: "frieza sob pressão",
  SPD: "velocidade de elite", ACC: "aceleração explosiva", POW: "força para quebrar tackles", VIS: "visão de corrida",
  CTH: "mãos seguras", RTE: "rotas precisas", CIT: "pega a bola mesmo com marcação",
  PBK: "bloqueio de passe sólido", RBK: "bloqueio de corrida dominante", STR: "força física", AGI: "agilidade acima da média",
  PMV: "power moves devastadores", FMV: "finesse moves refinados", BSH: "se livra dos bloqueios com facilidade",
  TKL: "tackle seguro", PRC: "lê as jogadas antes de acontecerem", ZCV: "cobertura por zona", MCV: "cobertura individual (man)",
  PRS: "press agressivo na linha", PUR: "perseguição incansável",
  KPW: "pé potente", KAC: "precisão de chute", CLT: "frieza nos momentos decisivos", TRK: "chutes de efeito",
};
const CONCERN_LABELS = {
  THP: "braço limitado", STA: "falha nos passes curtos", MTA: "imprecisão nos passes médios", DTA: "imprecisão nos lançamentos longos",
  AWR: "leitura de jogo imatura", MOB: "estático no pocket", TUP: "desmonta sob pressão",
  SPD: "falta velocidade", ACC: "arrancada lenta", POW: "cai fácil nos contatos", VIS: "enxerga pouco os buracos",
  CTH: "mãos pouco confiáveis", RTE: "rotas imprecisas", CIT: "evita o contato ao pegar a bola",
  PBK: "fraco na proteção de passe", RBK: "fraco no bloqueio de corrida", STR: "falta força física", AGI: "pouca agilidade",
  PMV: "pouca força no pass rush", FMV: "sem repertório de finesse", BSH: "fica preso nos bloqueios",
  TKL: "erra tackles", PRC: "demora a ler as jogadas", ZCV: "perdido na zona", MCV: "sofre na cobertura individual",
  PRS: "não incomoda no press", PUR: "ângulos ruins de perseguição",
  KPW: "pé fraco", KAC: "chute irregular", CLT: "treme nos momentos decisivos", TRK: "sem repertório no punt",
};

// Maior e menor atributo do jogador (com frases prontas para o scoutingReport).
// Ex.: const { best, worst } = attrHighlights(p.pos, p.attrs);
function attrHighlights(pos, attrs) {
  const keys = (SUB_ATTRS[pos] || []).filter((k) => attrs?.[k] != null);
  if (!keys.length) return null;
  const sorted = [...keys].sort((a, b) => attrs[b] - attrs[a]);
  const mk = (k, map) => ({ key: k, value: attrs[k], label: ATTR_LABELS[k] || k, text: map[k] || k });
  return { best: mk(sorted[0], TRAIT_LABELS), worst: mk(sorted[sorted.length - 1], CONCERN_LABELS) };
}

export { TRAIT_LABELS, CONCERN_LABELS, attrHighlights };

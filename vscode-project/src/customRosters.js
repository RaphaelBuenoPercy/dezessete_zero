// ============================================================
// CUSTOM ROSTERS
// ============================================================
// Edite este arquivo para jogar com o elenco que você quiser: um time
// retrô, uma liga fictícia, o time dos seus sonhos, etc. Nenhum código
// do jogo precisa mudar — o App.jsx lê este arquivo automaticamente.
//
// Como funciona:
// - CUSTOM_ROSTERS é um objeto: a chave é a sigla do time (veja TEAM_META
//   em App.jsx para a lista de siglas, ex: "BUF", "SF", "KC"...).
// - Cada time pode definir "scheme" (opcional, "4-3" ou "3-4") e uma lista
//   de "players".
// - Você NÃO precisa preencher o elenco inteiro. Qualquer posição (slot)
//   que você não definir é preenchida automaticamente pelo gerador do
//   jogo, então dá pra customizar só o QB e o RB titular, por exemplo, e
//   deixar o resto aleatório.
// - Cada jogador customizado também não precisa ter todos os campos: o que
//   faltar é preenchido com valores automáticos (overall aleatório dentro
//   da faixa do "tier", atributos derivados do overall, etc).
//
// Campos de cada jogador:
//   slot   (obrigatório) - a posição no elenco. Lista completa abaixo.
//   name   - nome do jogador (padrão: nome aleatório)
//   pos    - posição real (padrão: a posição do slot, ex: RB1 -> "RB")
//   ovr    - overall de 1 a 99 (padrão: sorteado pelo tier do slot)
//   tier   - "star" | "starter" | "backup" | "bench" (só usado se "ovr"
//            não for definido, pra sortear o overall numa faixa)
//   attrs  - objeto com os 2 atributos secundários da posição, ex:
//            RB -> { SPD, POW } | QB -> { ARM, ACC } | WR -> { SPD, HND }
//            (o que não for definido é derivado do overall)
//   age, years, salary, dev - campos de carreira/contrato (opcionais)
//
// Slots disponíveis (ofensivos e especiais, iguais para todo mundo):
//   QB1, QB2, RB1, RB2, WR1, WR2, WR3, TE1, LT, LG, C, RG, RT,
//   CB1, CB2, CB3, S1, S2, K1, P1, BEN1..BEN5
// ATENÇÃO: a linha ofensiva NÃO segue o padrão numerado (nada de OL1,
// LG1, C1...). Os 5 slots de O-Line são nomeados pela posição real na
// linha: LT, LG, C, RG, RT — sem número.
// Slots defensivos de frente (dependem do "scheme" escolhido):
//   4-3 -> DE1, DE2, DT1, DT2, LB1, LB2, LB3
//   3-4 -> DE1, DE2, NT1, LB1, LB2, LB3, LB4
//
// Pares de atributos por posição (para o campo "attrs"):
//   QB: ARM, ACC   RB: SPD, POW   WR: SPD, HND   TE: HND, BLK
//   OL (LT/LG/C/RG/RT): RBK, PBK   DL: RSH, RUN   LB: COV, RUN
//   CB: COV, SPD   S: COV, TKL    K: POW, ACC    P: POW, ACC
//
// ------------------------------------------------------------
// EXEMPLO (apague os "//" para ativar). Isso monta um QB e um RB1
// customizados pro Buffalo, com o resto do elenco gerado normalmente:
//
// BUF: {
//   players: [
//     { slot: "QB1", name: "Meu QB Lendário", pos: "QB", ovr: 99,
//       attrs: { ARM: 99, ACC: 96 }, age: 27 },
//     { slot: "RB1", name: "Corredor Retrô", pos: "RB", ovr: 92,
//       attrs: { SPD: 95, POW: 80 } },
//   ],
// },
// ------------------------------------------------------------

export const CUSTOM_ROSTERS = {
  // Adicione seus times aqui, um por sigla. Veja o exemplo acima.
  NO: {
    players: [
      { slot: "QB1", name: "Tyler Shough", pos: "QB", ovr: 91,
        attrs: { ARM: 90, ACC: 92 }, age: 26 },
      { slot: "RB2", name: "Travis Etienne", pos: "RB", ovr: 85,
        attrs: { SPD: 88, POW: 82 }, age: 27 },
      { slot: "WR1", name: "Chris Olave", pos: "WR", ovr: 93,
        attrs: { SPD: 95, HND: 91 }, age: 25 },
      { slot: "WR2", name: "DeVaughn Vele", pos: "WR", ovr: 84,
        attrs: { SPD: 82, HND: 86 }, age: 25 },
      { slot: "WR3", name: "Jordyn Tyson", pos: "WR", ovr: 83,
        attrs: { SPD: 83, HND: 83 }, age: 22 },
      { slot: "TE1", name: "Juwan Johnson", pos: "TE", ovr: 84,
        attrs: { HND: 87, BLK: 81 }, age: 30 },
      // O-Line: slots corrigidos (LT, LG, C, RG, RT — sem número) e o
      // "pos" do David Edwards corrigido de "LG" pra "OL".
      { slot: "LT", name: "Kelvin Banks Jr", pos: "OL", ovr: 84,
        attrs: { RBK: 85, PBK: 83 }, age: 22 },
      { slot: "LG", name: "David Edwards", pos: "OL", ovr: 89,
        attrs: { RBK: 87, PBK: 91 }, age: 29 },
      { slot: "C", name: "Erik McCoy", pos: "OL", ovr: 92,
        attrs: { RBK: 92, PBK: 92 }, age: 29 },
      { slot: "RG", name: "Cesar Ruiz", pos: "OL", ovr: 81,
        attrs: { RBK: 85, PBK: 83 }, age: 27 },
      { slot: "RT", name: "Talaese Fuaga", pos: "OL", ovr: 85,
        attrs: { RBK: 85, PBK: 85 }, age: 24 },
      { slot: "DE1", name: "Chase Young", pos: "DL", ovr: 92,
        attrs: { RSH: 86, RUN: 98 }, age: 28 },
      { slot: "DE2", name: "Carl Granderson", pos: "DL", ovr: 90,
        attrs: { RSH: 86, RUN: 94 }, age: 29 },
      { slot: "DT1", name: "Christen Miller", pos: "DL", ovr: 81,
        attrs: { RSH: 81, RUN: 81 }, age: 24 },
      { slot: "DT2", name: "Bryan Bresee", pos: "DL", ovr: 80,
        attrs: { RSH: 84, RUN: 76 }, age: 26 },
      { slot: "LB1", name: "Pete Werner", pos: "LB", ovr: 86,
        attrs: { COV: 85, RUN: 87 }, age: 27 },
      { slot: "LB2", name: "Kaden Eliss", pos: "LB", ovr: 84,
        attrs: { COV: 86, RUN: 82 }, age: 30 },
      { slot: "LB3", name: "Danny Stutsman", pos: "LB", ovr: 79,
        attrs: { COV: 79, RUN: 79 }, age: 25 },
      { slot: "CB1", name: "Kool-Aid McKinstry", pos: "CB", ovr: 83,
        attrs: { COV: 82, SPD: 84 }, age: 23 },
      { slot: "CB2", name: "Quincy Riley", pos: "CB", ovr: 80,
        attrs: { COV: 81, SPD: 79 }, age: 26 },
      { slot: "CB3", name: "Jonas Sanker", pos: "CB", ovr: 80,
        attrs: { COV: 82, SPD: 78 }, age: 23 },
      { slot: "S1", name: "Justin Reid", pos: "S", ovr: 82,
        attrs: { COV: 85, TKL: 79 }, age: 31 },
      { slot: "S2", name: "Julian Blackmon", pos: "S", ovr: 79,
        attrs: { COV: 79, TKL: 80 }, age: 25 },
      { slot: "K1", name: "Daniel Carlson", pos: "K", ovr: 83,
        attrs: { POW: 82, ACC: 84 }, age: 31 },
      { slot: "P1", name: "Ryan Wright", pos: "P", ovr: 76,
        attrs: { POW: 77, ACC: 75 }, age: 26 },
    ],
  },
};
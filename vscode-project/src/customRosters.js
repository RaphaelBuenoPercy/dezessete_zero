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
  // New Orleans Saints (existente)
  NO: {
    scheme: "4-3",
    players: [
      { slot: "QB1", name: "Tyler Shough", pos: "QB", ovr: 91, attrs: { ARM: 90, ACC: 92 }, age: 26 },
      { slot: "RB1", name: "Travis Etienne", pos: "RB", ovr: 85, attrs: { SPD: 88, POW: 82 }, age: 27 },
      { slot: "RB2", name: "Alvin Kamara", pos: "RB", ovr: 84, attrs: { SPD: 85, POW: 83 }, age: 27 },
      { slot: "WR1", name: "Chris Olave", pos: "WR", ovr: 93, attrs: { SPD: 95, HND: 91 }, age: 25 },
      { slot: "WR2", name: "DeVaughn Vele", pos: "WR", ovr: 84, attrs: { SPD: 82, HND: 86 }, age: 25 },
      { slot: "WR3", name: "Jordyn Tyson", pos: "WR", ovr: 83, attrs: { SPD: 83, HND: 83 }, age: 22 },
      { slot: "TE1", name: "Juwan Johnson", pos: "TE", ovr: 84, attrs: { HND: 87, BLK: 81 }, age: 30 },
      { slot: "LT", name: "Kelvin Banks Jr", pos: "OL", ovr: 84, attrs: { RBK: 85, PBK: 83 }, age: 22 },
      { slot: "LG", name: "David Edwards", pos: "OL", ovr: 89, attrs: { RBK: 87, PBK: 91 }, age: 29 },
      { slot: "C", name: "Erik McCoy", pos: "OL", ovr: 92, attrs: { RBK: 92, PBK: 92 }, age: 29 },
      { slot: "RG", name: "Cesar Ruiz", pos: "OL", ovr: 81, attrs: { RBK: 85, PBK: 83 }, age: 27 },
      { slot: "RT", name: "Talaese Fuaga", pos: "OL", ovr: 85, attrs: { RBK: 85, PBK: 85 }, age: 24 },
      { slot: "DE1", name: "Chase Young", pos: "DL", ovr: 92, attrs: { RSH: 86, RUN: 98 }, age: 28 },
      { slot: "DE2", name: "Carl Granderson", pos: "DL", ovr: 90, attrs: { RSH: 86, RUN: 94 }, age: 29 },
      { slot: "DT1", name: "Christen Miller", pos: "DL", ovr: 81, attrs: { RSH: 81, RUN: 81 }, age: 24 },
      { slot: "DT2", name: "Bryan Bresee", pos: "DL", ovr: 80, attrs: { RSH: 84, RUN: 76 }, age: 26 },
      { slot: "LB1", name: "Pete Werner", pos: "LB", ovr: 86, attrs: { COV: 85, RUN: 87 }, age: 27 },
      { slot: "LB2", name: "Kaden Eliss", pos: "LB", ovr: 84, attrs: { COV: 86, RUN: 82 }, age: 30 },
      { slot: "LB3", name: "Danny Stutsman", pos: "LB", ovr: 79, attrs: { COV: 79, RUN: 79 }, age: 25 },
      { slot: "CB1", name: "Kool-Aid McKinstry", pos: "CB", ovr: 83, attrs: { COV: 82, SPD: 84 }, age: 23 },
      { slot: "CB2", name: "Quincy Riley", pos: "CB", ovr: 80, attrs: { COV: 81, SPD: 79 }, age: 26 },
      { slot: "CB3", name: "Jonas Sanker", pos: "CB", ovr: 80, attrs: { COV: 82, SPD: 78 }, age: 23 },
      { slot: "S1", name: "Justin Reid", pos: "S", ovr: 82, attrs: { COV: 85, TKL: 79 }, age: 31 },
      { slot: "S2", name: "Julian Blackmon", pos: "S", ovr: 79, attrs: { COV: 79, TKL: 80 }, age: 25 },
      { slot: "K1", name: "Daniel Carlson", pos: "K", ovr: 83, attrs: { POW: 82, ACC: 84 }, age: 31 },
      { slot: "P1", name: "Ryan Wright", pos: "P", ovr: 76, attrs: { POW: 77, ACC: 75 }, age: 26 },
    ],
  },

  // Kansas City Chiefs
  KC: {
    scheme: "4-3",
    players: [
      { slot: "QB1", name: "Patrick Mahomes", pos: "QB", ovr: 99, attrs: { ARM: 99, ACC: 98 }, age: 29 },
      { slot: "QB2", name: "Carson Wentz", pos: "QB", ovr: 74, attrs: { ARM: 84, ACC: 72 }, age: 31 },
      { slot: "RB1", name: "Isiah Pacheco", pos: "RB", ovr: 89, attrs: { SPD: 91, POW: 92 }, age: 25 },
      { slot: "RB2", name: "Samaje Perine", pos: "RB", ovr: 78, attrs: { SPD: 82, POW: 84 }, age: 29 },
      { slot: "WR1", name: "Rashee Rice", pos: "WR", ovr: 88, attrs: { SPD: 90, HND: 89 }, age: 24 },
      { slot: "WR2", name: "Xavier Worthy", pos: "WR", ovr: 83, attrs: { SPD: 98, HND: 80 }, age: 21 },
      { slot: "WR3", name: "JuJu Smith-Schuster", pos: "WR", ovr: 80, attrs: { SPD: 84, HND: 86 }, age: 27 },
      { slot: "TE1", name: "Travis Kelce", pos: "TE", ovr: 97, attrs: { HND: 98, BLK: 74 }, age: 35 },
      { slot: "LT", name: "Wanya Morris", pos: "OL", ovr: 77, attrs: { RBK: 79, PBK: 75 }, age: 23 },
      { slot: "LG", name: "Joe Thuney", pos: "OL", ovr: 94, attrs: { RBK: 90, PBK: 97 }, age: 31 },
      { slot: "C", name: "Creed Humphrey", pos: "OL", ovr: 96, attrs: { RBK: 97, PBK: 94 }, age: 25 },
      { slot: "RG", name: "Trey Smith", pos: "OL", ovr: 91, attrs: { RBK: 95, PBK: 85 }, age: 25 },
      { slot: "RT", name: "Jawaan Taylor", pos: "OL", ovr: 81, attrs: { RBK: 78, PBK: 86 }, age: 26 },
      { slot: "DE1", name: "George Karlaftis", pos: "DL", ovr: 86, attrs: { RSH: 85, RUN: 87 }, age: 23 },
      { slot: "DE2", name: "Mike Danna", pos: "DL", ovr: 80, attrs: { RSH: 78, RUN: 83 }, age: 26 },
      { slot: "DT1", name: "Chris Jones", pos: "DL", ovr: 98, attrs: { RSH: 99, RUN: 92 }, age: 30 },
      { slot: "DT2", name: "Tershawn Wharton", pos: "DL", ovr: 78, attrs: { RSH: 80, RUN: 75 }, age: 26 },
      { slot: "LB1", name: "Nick Bolton", pos: "LB", ovr: 89, attrs: { COV: 82, RUN: 95 }, age: 24 },
      { slot: "LB2", name: "Drue Tranquill", pos: "LB", ovr: 83, attrs: { COV: 86, RUN: 80 }, age: 29 },
      { slot: "LB3", name: "Leo Chenal", pos: "LB", ovr: 81, attrs: { COV: 72, RUN: 92 }, age: 24 },
      { slot: "CB1", name: "Trent McDuffie", pos: "CB", ovr: 95, attrs: { COV: 96, SPD: 92 }, age: 24 },
      { slot: "CB2", name: "Jaylen Watson", pos: "CB", ovr: 81, attrs: { COV: 82, SPD: 88 }, age: 26 },
      { slot: "CB3", name: "Nazeeh Johnson", pos: "CB", ovr: 76, attrs: { COV: 75, SPD: 91 }, age: 24 },
      { slot: "S1", name: "Justin Reid", pos: "S", ovr: 83, attrs: { COV: 84, TKL: 81 }, age: 27 },
      { slot: "S2", name: "Bryan Cook", pos: "S", ovr: 80, attrs: { COV: 81, TKL: 79 }, age: 25 },
      { slot: "K1", name: "Harrison Butker", pos: "K", ovr: 95, attrs: { POW: 97, ACC: 94 }, age: 29 },
      { slot: "P1", name: "Matt Araiza", pos: "P", ovr: 81, attrs: { POW: 98, ACC: 75 }, age: 24 },
    ],
  },

  // San Francisco 49ers
  SF: {
    scheme: "4-3",
    players: [
      { slot: "QB1", name: "Brock Purdy", pos: "QB", ovr: 91, attrs: { ARM: 88, ACC: 96 }, age: 24 },
      { slot: "QB2", name: "Joshua Dobbs", pos: "QB", ovr: 73, attrs: { ARM: 80, ACC: 74 }, age: 29 },
      { slot: "RB1", name: "Christian McCaffrey", pos: "RB", ovr: 99, attrs: { SPD: 93, POW: 85 }, age: 28 },
      { slot: "RB2", name: "Jordan Mason", pos: "RB", ovr: 82, attrs: { SPD: 88, POW: 89 }, age: 25 },
      { slot: "WR1", name: "Deebo Samuel", pos: "WR", ovr: 92, attrs: { SPD: 92, HND: 90 }, age: 28 },
      { slot: "WR2", name: "Brandon Aiyuk", pos: "WR", ovr: 91, attrs: { SPD: 92, HND: 94 }, age: 26 },
      { slot: "WR3", name: "Jauan Jennings", pos: "WR", ovr: 84, attrs: { SPD: 84, HND: 90 }, age: 27 },
      { slot: "TE1", name: "George Kittle", pos: "TE", ovr: 97, attrs: { HND: 95, BLK: 92 }, age: 31 },
      { slot: "LT", name: "Trent Williams", pos: "OL", ovr: 99, attrs: { RBK: 99, PBK: 98 }, age: 36 },
      { slot: "LG", name: "Aaron Banks", pos: "OL", ovr: 80, attrs: { RBK: 82, PBK: 78 }, age: 27 },
      { slot: "C", name: "Jake Brendel", pos: "OL", ovr: 77, attrs: { RBK: 78, PBK: 76 }, age: 32 },
      { slot: "RG", name: "Dominick Puni", pos: "OL", ovr: 81, attrs: { RBK: 84, PBK: 80 }, age: 24 },
      { slot: "RT", name: "Colton McKivitz", pos: "OL", ovr: 75, attrs: { RBK: 78, PBK: 74 }, age: 28 },
      { slot: "DE1", name: "Nick Bosa", pos: "DL", ovr: 98, attrs: { RSH: 98, RUN: 95 }, age: 27 },
      { slot: "DE2", name: "Leonard Floyd", pos: "DL", ovr: 82, attrs: { RSH: 85, RUN: 78 }, age: 32 },
      { slot: "DT1", name: "Javon Hargrave", pos: "DL", ovr: 88, attrs: { RSH: 92, RUN: 83 }, age: 31 },
      { slot: "DT2", name: "Maliek Collins", pos: "DL", ovr: 80, attrs: { RSH: 82, RUN: 78 }, age: 29 },
      { slot: "LB1", name: "Fred Warner", pos: "LB", ovr: 99, attrs: { COV: 99, RUN: 96 }, age: 27 },
      { slot: "LB2", name: "Dre Greenlaw", pos: "LB", ovr: 89, attrs: { COV: 85, RUN: 92 }, age: 27 },
      { slot: "LB3", name: "De'Vondre Campbell", pos: "LB", ovr: 78, attrs: { COV: 78, RUN: 79 }, age: 31 },
      { slot: "CB1", name: "Charvarius Ward", pos: "CB", ovr: 90, attrs: { COV: 92, SPD: 90 }, age: 28 },
      { slot: "CB2", name: "Deommodore Lenoir", pos: "CB", ovr: 86, attrs: { COV: 86, SPD: 89 }, age: 25 },
      { slot: "CB3", name: "Isaac Yiadom", pos: "CB", ovr: 77, attrs: { COV: 78, SPD: 88 }, age: 28 },
      { slot: "S1", name: "Talanoa Hufanga", pos: "S", ovr: 86, attrs: { COV: 82, TKL: 90 }, age: 24 },
      { slot: "S2", name: "Ji'Ayir Brown", pos: "S", ovr: 81, attrs: { COV: 82, TKL: 80 }, age: 24 },
      { slot: "K1", name: "Jake Moody", pos: "K", ovr: 81, attrs: { POW: 94, ACC: 79 }, age: 24 },
      { slot: "P1", name: "Mitch Wishnowsky", pos: "P", ovr: 82, attrs: { POW: 84, ACC: 88 }, age: 32 },
    ],
  },

  // Baltimore Ravens (Exemplo de frente 3-4 usando os slots corretos)
  BAL: {
    scheme: "3-4",
    players: [
      { slot: "QB1", name: "Lamar Jackson", pos: "QB", ovr: 98, attrs: { ARM: 94, ACC: 92 }, age: 27 },
      { slot: "QB2", name: "Josh Johnson", pos: "QB", ovr: 70, attrs: { ARM: 78, ACC: 70 }, age: 38 },
      { slot: "RB1", name: "Derrick Henry", pos: "RB", ovr: 96, attrs: { SPD: 90, POW: 99 }, age: 30 },
      { slot: "RB2", name: "Justice Hill", pos: "RB", ovr: 79, attrs: { SPD: 89, POW: 74 }, age: 26 },
      { slot: "WR1", name: "Zay Flowers", pos: "WR", ovr: 87, attrs: { SPD: 94, HND: 86 }, age: 24 },
      { slot: "WR2", name: "Rashod Bateman", pos: "WR", ovr: 81, attrs: { SPD: 90, HND: 83 }, age: 24 },
      { slot: "WR3", name: "Nelson Agholor", pos: "WR", ovr: 78, attrs: { SPD: 88, HND: 79 }, age: 31 },
      { slot: "TE1", name: "Mark Andrews", pos: "TE", ovr: 94, attrs: { HND: 95, BLK: 82 }, age: 29 },
      { slot: "LT", name: "Ronnie Stanley", pos: "OL", ovr: 88, attrs: { RBK: 85, PBK: 91 }, age: 30 },
      { slot: "LG", name: "Andrew Vorhees", pos: "OL", ovr: 76, attrs: { RBK: 78, PBK: 75 }, age: 25 },
      { slot: "C", name: "Tyler Linderbaum", pos: "OL", ovr: 92, attrs: { RBK: 94, PBK: 90 }, age: 24 },
      { slot: "RG", name: "Daniel Faalele", pos: "OL", ovr: 75, attrs: { RBK: 78, PBK: 72 }, age: 24 },
      { slot: "RT", name: "Patrick Mekari", pos: "OL", ovr: 79, attrs: { RBK: 76, PBK: 82 }, age: 27 },
      { slot: "DE1", name: "Justin Madubuike", pos: "DL", ovr: 92, attrs: { RSH: 94, RUN: 89 }, age: 27 },
      { slot: "DE2", name: "Broderick Washington", pos: "DL", ovr: 76, attrs: { RSH: 70, RUN: 80 }, age: 27 },
      // Frente 3-4 requer um NT1 em vez de DT1 e DT2
      { slot: "NT1", name: "Michael Pierce", pos: "DL", ovr: 85, attrs: { RSH: 74, RUN: 94 }, age: 31 },
      { slot: "LB1", name: "Roquan Smith", pos: "LB", ovr: 96, attrs: { COV: 92, RUN: 97 }, age: 27 },
      { slot: "LB2", name: "Trenton Simpson", pos: "LB", ovr: 78, attrs: { COV: 78, RUN: 79 }, age: 23 },
      { slot: "LB3", name: "Odafe Oweh", pos: "LB", ovr: 84, attrs: { COV: 70, RUN: 85 }, age: 25 },
      // Frente 3-4 requer um LB4 adicional
      { slot: "LB4", name: "Kyle Van Noy", pos: "LB", ovr: 83, attrs: { COV: 72, RUN: 82 }, age: 33 },
      { slot: "CB1", name: "Marlon Humphrey", pos: "CB", ovr: 89, attrs: { COV: 90, SPD: 89 }, age: 28 },
      { slot: "CB2", name: "Brandon Stephens", pos: "CB", ovr: 82, attrs: { COV: 84, SPD: 88 }, age: 26 },
      { slot: "CB3", name: "Nate Wiggins", pos: "CB", ovr: 79, attrs: { COV: 80, SPD: 96 }, age: 21 },
      { slot: "S1", name: "Kyle Hamilton", pos: "S", ovr: 95, attrs: { COV: 96, TKL: 92 }, age: 23 },
      { slot: "S2", name: "Marcus Williams", pos: "S", ovr: 86, attrs: { COV: 88, TKL: 80 }, age: 28 },
      { slot: "K1", name: "Justin Tucker", pos: "K", ovr: 96, attrs: { POW: 98, ACC: 96 }, age: 34 },
      { slot: "P1", name: "Jordan Stout", pos: "P", ovr: 80, attrs: { POW: 84, ACC: 78 }, age: 26 },
    ],
  },
  // Detroit Lions
  DET: {
    scheme: "4-3",
    players: [
      { slot: "QB1", name: "Jared Goff", pos: "QB", ovr: 84, attrs: { ARM: 85, ACC: 90 }, age: 29 },
      { slot: "RB1", name: "Jahmyr Gibbs", pos: "RB", ovr: 89, attrs: { SPD: 94, POW: 78 }, age: 22 },
      { slot: "RB2", name: "David Montgomery", pos: "RB", ovr: 86, attrs: { SPD: 87, POW: 92 }, age: 27 },
      { slot: "WR1", name: "Amon-Ra St. Brown", pos: "WR", ovr: 95, attrs: { SPD: 90, HND: 98 }, age: 24 },
      { slot: "WR2", name: "Jameson Williams", pos: "WR", ovr: 81, attrs: { SPD: 97, HND: 78 }, age: 23 },
      { slot: "WR3", name: "Kalif Raymond", pos: "WR", ovr: 78, attrs: { SPD: 92, HND: 80 }, age: 30 },
      { slot: "TE1", name: "Sam LaPorta", pos: "TE", ovr: 89, attrs: { HND: 90, BLK: 75 }, age: 23 },
      { slot: "LT", name: "Taylor Decker", pos: "OL", ovr: 85, attrs: { RBK: 82, PBK: 88 }, age: 31 },
      { slot: "LG", name: "Graham Glasgow", pos: "OL", ovr: 80, attrs: { RBK: 82, PBK: 78 }, age: 32 },
      { slot: "C", name: "Frank Ragnow", pos: "OL", ovr: 93, attrs: { RBK: 94, PBK: 91 }, age: 28 },
      { slot: "RG", name: "Kevin Zeitler", pos: "OL", ovr: 84, attrs: { RBK: 82, PBK: 87 }, age: 34 },
      { slot: "RT", name: "Penei Sewell", pos: "OL", ovr: 97, attrs: { RBK: 98, PBK: 95 }, age: 24 },
      { slot: "DE1", name: "Aidan Hutchinson", pos: "DL", ovr: 92, attrs: { RSH: 94, RUN: 88 }, age: 24 },
      { slot: "DE2", name: "Josh Paschal", pos: "DL", ovr: 77, attrs: { RSH: 78, RUN: 80 }, age: 24 },
      { slot: "DT1", name: "Alim McNeill", pos: "DL", ovr: 85, attrs: { RSH: 82, RUN: 89 }, age: 24 },
      { slot: "DT2", name: "DJ Reader", pos: "DL", ovr: 88, attrs: { RSH: 74, RUN: 96 }, age: 30 },
      { slot: "LB1", name: "Alex Anzalone", pos: "LB", ovr: 81, attrs: { COV: 78, RUN: 84 }, age: 30 },
      { slot: "LB2", name: "Jack Campbell", pos: "LB", ovr: 78, attrs: { COV: 72, RUN: 86 }, age: 24 },
      { slot: "LB3", name: "Derrick Barnes", pos: "LB", ovr: 76, attrs: { COV: 70, RUN: 82 }, age: 25 },
      { slot: "CB1", name: "Carlton Davis III", pos: "CB", ovr: 82, attrs: { COV: 84, SPD: 89 }, age: 27 },
      { slot: "CB2", name: "Terrion Arnold", pos: "CB", ovr: 78, attrs: { COV: 79, SPD: 91 }, age: 21 },
      { slot: "CB3", name: "Amik Robertson", pos: "CB", ovr: 76, attrs: { COV: 77, SPD: 88 }, age: 26 },
      { slot: "S1", name: "Brian Branch", pos: "S", ovr: 87, attrs: { COV: 89, TKL: 85 }, age: 23 },
      { slot: "S2", name: "Kerby Joseph", pos: "S", ovr: 82, attrs: { COV: 85, TKL: 75 }, age: 23 },
      { slot: "K1", name: "Jake Bates", pos: "K", ovr: 74, attrs: { POW: 99, ACC: 72 }, age: 24 },
      { slot: "P1", name: "Jack Fox", pos: "P", ovr: 84, attrs: { POW: 95, ACC: 80 }, age: 28 },
    ],
  },

  // Philadelphia Eagles
  PHI: {
    scheme: "3-4",
    players: [
      { slot: "QB1", name: "Jalen Hurts", pos: "QB", ovr: 88, attrs: { ARM: 88, ACC: 86 }, age: 26 },
      { slot: "QB2", name: "Kenny Pickett", pos: "QB", ovr: 68, attrs: { ARM: 82, ACC: 72 }, age: 26 },
      { slot: "RB1", name: "Saquon Barkley", pos: "RB", ovr: 93, attrs: { SPD: 93, POW: 90 }, age: 27 },
      { slot: "RB2", name: "Kenneth Gainwell", pos: "RB", ovr: 77, attrs: { SPD: 88, POW: 75 }, age: 25 },
      { slot: "WR1", name: "DeVonta Smith", pos: "WR", ovr: 90, attrs: { SPD: 93, HND: 95 }, age: 25 },
      { slot: "WR2", name: "Jahan Dotson", pos: "WR", ovr: 78, attrs: { SPD: 90, HND: 81 }, age: 24 },
      { slot: "WR3", name: "Johnny Wilson", pos: "WR", ovr: 72, attrs: { SPD: 85, HND: 76 }, age: 23 },
      { slot: "TE1", name: "Dallas Goedert", pos: "TE", ovr: 85, attrs: { HND: 86, BLK: 82 }, age: 29 },
      { slot: "LT", name: "Jordan Mailata", pos: "OL", ovr: 90, attrs: { RBK: 92, PBK: 88 }, age: 27 },
      { slot: "LG", name: "Landon Dickerson", pos: "OL", ovr: 88, attrs: { RBK: 90, PBK: 85 }, age: 26 },
      { slot: "C", name: "Cam Jurgens", pos: "OL", ovr: 80, attrs: { RBK: 82, PBK: 79 }, age: 25 },
      { slot: "RG", name: "Mekhi Becton", pos: "OL", ovr: 77, attrs: { RBK: 80, PBK: 74 }, age: 25 },
      { slot: "RT", name: "Lane Johnson", pos: "OL", ovr: 95, attrs: { RBK: 92, PBK: 98 }, age: 34 },
      { slot: "DE1", name: "Jalen Carter", pos: "DL", ovr: 89, attrs: { RSH: 92, RUN: 85 }, age: 23 },
      { slot: "DE2", name: "Milton Williams", pos: "DL", ovr: 78, attrs: { RSH: 75, RUN: 80 }, age: 25 },
      { slot: "NT1", name: "Jordan Davis", pos: "DL", ovr: 82, attrs: { RSH: 70, RUN: 94 }, age: 24 },
      { slot: "LB1", name: "Nakobe Dean", pos: "LB", ovr: 78, attrs: { COV: 75, RUN: 82 }, age: 23 },
      { slot: "LB2", name: "Zack Baun", pos: "LB", ovr: 80, attrs: { COV: 77, RUN: 84 }, age: 27 },
      { slot: "LB3", name: "Bryce Huff", pos: "LB", ovr: 81, attrs: { COV: 65, RUN: 86 }, age: 26 },
      { slot: "LB4", name: "Josh Sweat", pos: "LB", ovr: 84, attrs: { COV: 68, RUN: 88 }, age: 27 },
      { slot: "CB1", name: "Darius Slay", pos: "CB", ovr: 88, attrs: { COV: 90, SPD: 89 }, age: 33 },
      { slot: "CB2", name: "Quinyon Mitchell", pos: "CB", ovr: 80, attrs: { COV: 81, SPD: 94 }, age: 23 },
      { slot: "CB3", name: "Cooper DeJean", pos: "CB", ovr: 78, attrs: { COV: 79, SPD: 91 }, age: 21 },
      { slot: "S1", name: "C.J. Gardner-Johnson", pos: "S", ovr: 84, attrs: { COV: 85, TKL: 80 }, age: 26 },
      { slot: "S2", name: "Reed Blankenship", pos: "S", ovr: 82, attrs: { COV: 80, TKL: 86 }, age: 25 },
      { slot: "K1", name: "Jake Elliott", pos: "K", ovr: 86, attrs: { POW: 92, ACC: 88 }, age: 29 },
      { slot: "P1", name: "Braden Mann", pos: "P", ovr: 78, attrs: { POW: 84, ACC: 80 }, age: 26 },
    ],
  },

  // Dallas Cowboys
  DAL: {
    scheme: "4-3",
    players: [
      { slot: "QB1", name: "Dak Prescott", pos: "QB", ovr: 89, attrs: { ARM: 89, ACC: 92 }, age: 31 },
      { slot: "RB1", name: "Rico Dowdle", pos: "RB", ovr: 79, attrs: { SPD: 87, POW: 81 }, age: 26 },
      { slot: "RB2", name: "Ezekiel Elliott", pos: "RB", ovr: 75, attrs: { SPD: 82, POW: 86 }, age: 29 },
      { slot: "WR1", name: "CeeDee Lamb", pos: "WR", ovr: 97, attrs: { SPD: 93, HND: 98 }, age: 25 },
      { slot: "WR2", name: "Brandin Cooks", pos: "WR", ovr: 81, attrs: { SPD: 92, HND: 82 }, age: 31 },
      { slot: "WR3", name: "Jalen Tolbert", pos: "WR", ovr: 78, attrs: { SPD: 89, HND: 79 }, age: 25 },
      { slot: "TE1", name: "Jake Ferguson", pos: "TE", ovr: 84, attrs: { HND: 86, BLK: 74 }, age: 25 },
      { slot: "LT", name: "Tyler Guyton", pos: "OL", ovr: 75, attrs: { RBK: 76, PBK: 74 }, age: 23 },
      { slot: "LG", name: "Tyler Smith", pos: "OL", ovr: 89, attrs: { RBK: 92, PBK: 86 }, age: 23 },
      { slot: "C", name: "Cooper Beebe", pos: "OL", ovr: 76, attrs: { RBK: 78, PBK: 75 }, age: 23 },
      { slot: "RG", name: "Zack Martin", pos: "OL", ovr: 96, attrs: { RBK: 94, PBK: 98 }, age: 33 },
      { slot: "RT", name: "Terence Steele", pos: "OL", ovr: 77, attrs: { RBK: 82, PBK: 72 }, age: 27 },
      { slot: "DE1", name: "DeMarcus Lawrence", pos: "DL", ovr: 89, attrs: { RSH: 85, RUN: 94 }, age: 32 },
      { slot: "DE2", name: "Marshawn Kneeland", pos: "DL", ovr: 75, attrs: { RSH: 78, RUN: 80 }, age: 23 },
      { slot: "DT1", name: "Kenny Clark", pos: "DL", ovr: 90, attrs: { RSH: 84, RUN: 92 }, age: 29 },
      { slot: "DT2", name: "Osa Odighizuwa", pos: "DL", ovr: 84, attrs: { RSH: 86, RUN: 80 }, age: 26 },
      { slot: "LB1", name: "Eric Kendricks", pos: "LB", ovr: 83, attrs: { COV: 84, RUN: 82 }, age: 32 },
      { slot: "LB2", name: "DeMarvion Overshown", pos: "LB", ovr: 78, attrs: { COV: 80, RUN: 76 }, age: 24 },
      { slot: "LB3", name: "Damone Clark", pos: "LB", ovr: 76, attrs: { COV: 72, RUN: 79 }, age: 24 },
      { slot: "CB1", name: "Trevon Diggs", pos: "CB", ovr: 88, attrs: { COV: 89, SPD: 92 }, age: 26 },
      { slot: "CB2", name: "DaRon Bland", pos: "CB", ovr: 90, attrs: { COV: 92, SPD: 90 }, age: 25 },
      { slot: "CB3", name: "Jourdan Lewis", pos: "CB", ovr: 80, attrs: { COV: 81, SPD: 88 }, age: 29 },
      { slot: "S1", name: "Malik Hooker", pos: "S", ovr: 82, attrs: { COV: 86, TKL: 74 }, age: 28 },
      { slot: "S2", name: "Donovan Wilson", pos: "S", ovr: 81, attrs: { COV: 78, TKL: 87 }, age: 29 },
      { slot: "K1", name: "Brandon Aubrey", pos: "K", ovr: 95, attrs: { POW: 99, ACC: 92 }, age: 29 },
      { slot: "P1", name: "Bryan Anger", pos: "P", ovr: 84, attrs: { POW: 86, ACC: 84 }, age: 36 },
    ],
  },
};
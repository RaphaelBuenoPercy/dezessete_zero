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
};

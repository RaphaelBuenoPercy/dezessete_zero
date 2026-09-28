// ============================================================
// PRESS CONFERENCES
//
// Every press moment is built by buildPressEvent(type, ctx, rng) into a
// ready-to-store object: { key, reporter, prompt, options }. `ctx` carries
// whatever that event type needs (score, opponent, streak, a player to
// name-drop...) — see the call sites in App.jsx for exactly what's passed.
// Options can affect owner confidence, fan support, and — new — a specific
// player's morale, when the option is about praising or calling them out
// by name.
// ============================================================

const REPORTERS = [
  { name: "Marina Lopes", outlet: "ESPN Brasil" },
  { name: "Carlos Bittencourt", outlet: "Rádio da Cidade" },
  { name: "Renata Duarte", outlet: "Jornal Local" },
  { name: "Tiago Moraes", outlet: "podcast de estatísticas" },
];

function pick(rng, arr) { return arr[Math.floor(rng() * arr.length)]; }
function fill(text, ctx) {
  return text.replace(/\{(\w+)\}/g, (_, k) => (ctx[k] ?? ""));
}

// ------------------------------------------------------------
// Post-game
// ------------------------------------------------------------
const GAME_PROMPTS = {
  win_big: [
    "Vitória tranquila hoje. Como avalia a atuação do time?",
    "Domínio do início ao fim. O que mudou pra vocês jogarem assim?",
    "Poucas vezes vimos uma vitória tão folgada. Isso muda as expectativas pro resto da temporada?",
  ],
  win_close: [
    "Vitória apertada. A diretoria quer saber se o time está pronto pros próximos desafios.",
    "Ganharam no fio da navalha. Foi sorte ou o time realmente merecia?",
    "Um final de coração na mão. Como foi administrar a pressão?",
  ],
  loss_close: [
    "Derrota de virada nos minutos finais. A pressão aumenta.",
    "Tão perto de vencer... o que faltou?",
    "Uma derrota dolorida. O grupo consegue se recuperar rápido?",
  ],
  loss_big: [
    "Derrota feia em casa. A torcida está impaciente e o dono quer respostas.",
    "Um resultado constrangedor. Dá pra explicar o que aconteceu?",
    "A pior atuação da temporada até aqui. Isso é motivo de preocupação?",
  ],
  rivalry_win: [
    "Vitória contra o maior rival! O que esse jogo significa pro elenco?",
    "Bateram o rival outra vez. Isso já virou hábito?",
    "{h2h}. Como é enfrentar esse adversário toda temporada?",
  ],
  rivalry_loss: [
    "Derrota pro rival dói mais que as outras. Como o vestiário está reagindo?",
    "Perder esse clássico pesa na temporada. O que precisa mudar?",
    "{h2h}. Dá pra reverter esse cenário?",
  ],
  win_streak: ["Já são {streak} vitórias seguidas! O time está vivendo uma fase especial?"],
  loss_streak: ["{streak} derrotas seguidas. A cadeira do técnico está esquentando?"],
};

const GAME_OPTIONS = {
  win_big: [
    { label: "Elogiar o elenco publicamente", owner: 3, fan: 6 },
    { label: "Focar no próximo adversário, sem festejar", owner: 5, fan: 2 },
    { label: "Cutucar o rival da divisão", owner: -2, fan: 8 },
  ],
  win_close: [
    { label: "Defender o grupo, dizer que estão evoluindo", owner: 4, fan: 4 },
    { label: "Ser crítico, cobrar mais da equipe", owner: 2, fan: -3 },
    { label: "Elogiar a torcida pelo apoio", owner: 1, fan: 7 },
  ],
  loss_close: [
    { label: "Assumir a responsabilidade pelas escolhas táticas", owner: -1, fan: 5 },
    { label: "Culpar erros de arbitragem", owner: -4, fan: 4 },
    { label: "Prometer ajustes já na próxima semana", owner: 3, fan: 1 },
  ],
  loss_big: [
    { label: "Pedir paciência ao projeto", owner: -3, fan: -2 },
    { label: "Anunciar mudanças na escalação titular", owner: 4, fan: 3 },
    { label: "Ficar na defensiva com a imprensa", owner: -6, fan: -6 },
  ],
  rivalry_win: [
    { label: "Provocar o rival com bom humor", owner: 2, fan: 9 },
    { label: "Manter o discurso humilde", owner: 5, fan: 3 },
  ],
  rivalry_loss: [
    { label: "Reconhecer que o rival foi melhor", owner: 1, fan: -1 },
    { label: "Prometer revanche", owner: -1, fan: 4 },
  ],
  win_streak: [
    { label: "Dizer que o trabalho está só começando", owner: 4, fan: 5 },
    { label: "Comemorar abertamente a sequência", owner: 1, fan: 8 },
  ],
  loss_streak: [
    { label: "Pedir tempo pra reverter o cenário", owner: -2, fan: -3 },
    { label: "Assumir total responsabilidade", owner: 2, fan: 2 },
  ],
};

// Builds the post-game press event: picks the right category (result ×
// rivalry × streak), a random prompt/reporter for variety, and — when a
// standout player is available — appends an option to praise them by name,
// which nudges that specific player's morale instead of the team's.
function buildGamePressEvent(ctx, rng) {
  const diff = ctx.myScore - ctx.oppScore;
  let key = diff >= 14 ? "win_big" : diff > 0 ? "win_close" : diff <= -14 ? "loss_big" : "loss_close";
  if (ctx.rivalryTier) key = diff > 0 ? "rivalry_win" : "rivalry_loss";
  else if (ctx.streak >= 3) key = diff > 0 ? "win_streak" : "loss_streak";

  let pool = GAME_PROMPTS[key];
  if ((key === "rivalry_win" || key === "rivalry_loss") && !ctx.h2h) pool = pool.filter((p) => !p.includes("{h2h}"));
  const prompt = fill(pick(rng, pool), ctx);
  const options = [...GAME_OPTIONS[key]];
  if (ctx.starPlayer) {
    const praiseGood = diff > 0
      ? `Destacar a atuação de ${ctx.starPlayer.name}`
      : `Defender ${ctx.starPlayer.name} das críticas`;
    options.push({ label: praiseGood, owner: 1, fan: 2, moraleTarget: ctx.starPlayer.id, moraleDelta: 8 });
  }
  return { key, reporter: pick(rng, REPORTERS), prompt, options };
}

// ------------------------------------------------------------
// Season milestones
// ------------------------------------------------------------
const MILESTONE_EVENTS = {
  clinched_playoffs: {
    prompts: ["Vaga nos playoffs garantida! Qual a meta agora — só participar ou ir mais longe?"],
    options: [
      { label: "Dizer que o objetivo é o título", owner: 3, fan: 8 },
      { label: "Manter os pés no chão, jogo a jogo", owner: 5, fan: 3 },
    ],
  },
  eliminated_playoffs: {
    prompts: ["Fim de temporada nos playoffs. Como avalia o ano como um todo?"],
    options: [
      { label: "Chamar a temporada de sucesso, apesar do fim", owner: 2, fan: 3 },
      { label: "Dizer que faltou muito pra chegar lá", owner: -3, fan: -1 },
      { label: "Prometer reforços na offseason", owner: 4, fan: 5 },
    ],
  },
  champion: {
    prompts: ["CAMPEÕES DO SUPER BOWL! O que passa pela sua cabeça agora?"],
    options: [
      { label: "Dedicar o título à torcida", owner: 6, fan: 15 },
      { label: "Já falar em construir um bicampeonato", owner: 10, fan: 8 },
    ],
  },
  hot_seat: {
    prompts: ["A diretoria está claramente impaciente com os resultados. Seu emprego está em risco — o que você diz?"],
    options: [
      { label: "Pedir mais tempo pro projeto", owner: 2, fan: -1 },
      { label: "Assumir toda a responsabilidade pelos resultados", owner: -2, fan: 4 },
      { label: "Desafiar a diretoria publicamente", owner: -8, fan: 6 },
    ],
  },
};

function buildMilestoneEvent(type, ctx, rng) {
  const def = MILESTONE_EVENTS[type];
  if (!def) return null;
  return { key: type, reporter: pick(rng, REPORTERS), prompt: fill(pick(rng, def.prompts), ctx), options: def.options };
}

// ------------------------------------------------------------
// Draft grade — reads the class the user just built and reacts to it.
// ------------------------------------------------------------
function buildDraftGradeEvent(ctx, rng) {
  const { pickCount, steals } = ctx;
  let prompt;
  if (steals >= 2) prompt = `Sua classe de draft está sendo elogiada — ${steals} escolhas de ótimo valor. Como conseguiu tanta coisa boa?`;
  else if (pickCount === 0) prompt = "Vocês não fizeram nenhuma escolha nesse draft. Qual foi a estratégia?";
  else prompt = `Draft encerrado com ${pickCount} escolha(s). Como avalia a classe?`;
  const options = [
    { label: "Elogiar o departamento de scouting", owner: 3, fan: 4 },
    { label: "Dizer que só o tempo vai dizer se valeu a pena", owner: 1, fan: 1 },
  ];
  return { key: "draft_grade", reporter: pick(rng, REPORTERS), prompt, options };
}

function buildPressEvent(type, ctx, rng) {
  if (type === "game_result") return buildGamePressEvent(ctx, rng);
  if (type === "draft_grade") return buildDraftGradeEvent(ctx, rng);
  return buildMilestoneEvent(type, ctx, rng);
}

export { buildPressEvent, REPORTERS };

# Documentação Completa da Arquitetura do Jogo (Gridiron GM)

Este documento é o manual mestre do projeto: mapeia todos os módulos, os fluxos principais e as convenções que **não podem ser quebradas**. Ele orienta a IA a fazer alterações cirúrgicas na base de código. Leia a **Parte 0** antes de mexer em qualquer coisa.

**Stack:** React (componentes funcionais) + Tailwind (classes utilitárias, tema escuro `#0B1220` / `#121a2c`) + JS puro no motor. Sem backend: o save fica no **IndexedDB** (`lib/storage.js`). Idioma da interface: **português (BR)**. O usuário joga principalmente no **celular** (telas estreitas, listas roláveis, botões grandes).

**Estrutura de pastas (`src/`):**

```
App.jsx  main.jsx  customRosters.js
lib/        rng.js  storage.js
hooks/      useAutoSave.js  useDraftSession.js
data/       names.js  rosterSlots.js  teams.js
engine/     simulation.js  ratings.js  playerGen.js  nicknames.js  press.js  coachesGen.js  staffEffects.js
season/     careerState.js  depth.js  morale.js  contracts.js  freeAgencyAI.js  negotiation.js  trades.js  roster.js
            picks.js  scouting.js  attrLabels.js  fog.js  draftEvents.js  legacy.js  offseason.js  records.js
            rivalries.js  powerRankings.js  weeklyRecap.js  teamIdentity.js  standings.js  stats.js
            events.js  coachingCarousel.js  archive.js  allTime.js  draftSession.js  lineup.js
screens/    HubScreen  MarketScreens  SeasonScreens  TeamManagementScreens  LineupScreens  TeamAndPlayer  MenuScreens
            HistoryScreen  AllTimePanel  SpectatorScreens
components/ ui.jsx  CoachCard.jsx  Fog.jsx  AllPro.jsx  logos/*.png
```

---

## PARTE 0: CONVENÇÕES CRÍTICAS (leia primeiro)

1. **OVR é derivado dos atributos.** Cada posição tem vários atributos (`SUB_ATTRS` em `data/rosterSlots.js`) e `p.ovr` é a média ponderada deles (`POSITION_WEIGHTS` em `engine/playerGen.js`). Quem alterar `p.attrs` **deve chamar `recalcOvr(p)`** (ou `computeOvr(pos, attrs)`). Nunca altere `p.ovr` diretamente.
2. **Bônus temporários nunca mexem em `attrs`/`ovr`.** Bônus de coordenadores e modificadores de eventos entram só durante o jogo em `p.fx` (e `p.fxOvr`), montados por `applyStaffBonuses` e limpos por `clearStaffBonuses`. `p.tmpMods` (eventos) persiste por algumas semanas e é somado ao `fx`. Toda leitura de atributo no motor deve passar por `attr(p, "KEY")` / `rawAttr` (`engine/ratings.js`), que já incluem `fx`.
3. **Funções puras no loop do jogo.** `advanceWeek(prev, inPlace)`, `advancePlayoffRound(prev, inPlace)` e `advanceSeasonYear(prev, inPlace)` recebem o `career` e devolvem o novo. `inPlace = true` só quando o chamador já é dono do objeto (simulações em lote). As ações do usuário usam `setCareer(prev => structuredClone(prev) ...)`.
4. **Determinismo.** Sorteios usam `mulberry32(seedFromString(c.id + "-...")`). O `c.id` faz parte das sementes, então salvar com outro id (bifurcar realidade) muda o futuro. Já `teamIdentity` e o elenco inicial de cada time são determinísticos pela abreviação.
5. **Modo espectador:** `career.spectator = true` e `career.teamAbbr = null`. Todo código que usa `c.leagueTeams[c.teamAbbr]` precisa tolerar `undefined`. Telas que pedem `myTeam` recebem `SPECTATOR_STUB`. O `MenuScreen` quebraria com `teamAbbr` nulo (faz `TEAM_META.find(...).city`), por isso saves de espectador ficam fora da lista dele e aparecem em `SpectatorMenuSection`.
6. **Fog of War do draft:** `draftClass[i].attrs/ovr` são os valores **reais**. A UI só mostra o que `career.scouting.reveals` liberou (`fogRead`, `FogAttrBars`). A IA draftea pelo OVR real. Nunca exiba `p.ovr` de prospect direto.
7. **Coordenadores têm rendimento oculto:** o nível (S–D) é só reputação; o rendimento real é `talent × form × fit` (ocultos). As telas mostram apenas o bônus *nominal* (`coachBonusMap(coach, true)`).
8. **Moral é narrativa.** `morale` (0–100) **não entra na matemática do jogo**; ela influencia contratos (`extensionAsk`), notícias, coletivas e eventos. Mexer nela é seguro; para mexer na força em campo use `tmpMods`.
9. **Persistência:** o `career` é gravado no **IndexedDB** (clone estruturado, sem JSON) por `useAutoSave`, com debounce de ~1,2 s, pausado durante simulações em lote e com gravação extra ao esconder/fechar a aba. O menu lista resumos leves (`meta`), sem carregar a carreira. Saves antigos do `localStorage` (`nflcareer:<id>`) são migrados na abertura do menu (`migrateLegacy`) ou na primeira carga (`onLoadCareer`). Erros de gravação aparecem num banner vermelho. Mesmo sem o limite de 5 MB, evite objetos enormes: `archive.js` enxuga box scores e o espectador poda notícias/históricos.
10. **Saves antigos:** toda feature nova precisa ser retrocompatível. Padrão: uma função `ensureXxx(career)` idempotente chamada em `onCreateCareer` e `onLoadCareer` (hoje: `upgradeCareerPlayers`, `ensureCoachingState`, `ensureEventsState`, `ensureAllTimeLeaders`, `ensureScoutingState`).
11. **Convenção de slots do elenco:** o motor lê **slots**, não posições. `QB1`/`QB2`, `RB1`, `WR1–3`, `TE1`, `LT/LG/C/RG/RT`, front 4-3 (`DE1, DE2, DT1, DT2, LB1–3`) ou 3-4 (`DE1, DE2, NT1, LB1–4`), `CB1–3`, `S1–2`, `K1`, `P1` e reservas `BEN1…BENn`. Qualquer movimentação de jogadores precisa terminar com o jogador certo no slot certo (use `autoSortDepth`/`refreshGroups`).

---

## PARTE 1: NÚCLEO DA APLICAÇÃO (`src/`)

* **`App.jsx`**: controlador principal (estado `career`, `screen`, `detail`, saves, progresso de simulação). Persiste automaticamente no `localStorage`.
  * **Criação/carga:** `onCreateCareer`, `onStartSpectator`, `forkSpectator` (copia a liga para novo save), `onLoadCareer` (async: IndexedDB, com fallback e migração do localStorage), `onDeleteCareer`, `onRestart` (aguarda o último `flushSave`).
  * **Persistência:** `useAutoSave(career, { paused })` e `refreshSaves` (lista resumos do IndexedDB).
  * **Loop da temporada:**
    * `advanceWeek`: simula a semana (jogo do usuário em detalhe, os outros em modo rápido), aplica resultados, atualiza moral, lesões, rivalidades, recordes e recap; dispara coletivas; **cobra promessas** (`checkPromises`), expira modificadores (`tickTempMods`) e **sorteia os eventos da próxima semana** (`rollWeeklyEvents`).
    * `advancePlayoffRound`: avança o mata-mata. Ao coroar o campeão entra na **offseason** (contratos de IA, free agency inicial, classe do draft, `resetScouting`, **coaching carousel**).
    * `advanceSeasonYear`: prêmios, arquivo histórico, `applyCareerRollover` (careerStats + Top 100), aposentadorias, desenvolvimento por coordenadores, novo calendário, eventos da semana 1.
    * `simSeason` (usuário): temporada inteira com `autoSortDepth`, descartando coletivas e eventos.
    * `simSpectator(mode)`: `"step"`, `"season"` ou N temporadas, em fatias de tempo, com progresso e cancelamento (`spectatorUnit` = 1 semana, 1 rodada de playoffs ou a offseason inteira).
  * **Ações do usuário:** escalação (`swapSlot`, `autoSortDepthChart`), extensões (`extendContract`, `releaseExpiring`), free agency (`makeFreeAgentOffer`, `withdrawFreeAgentOffer`, `advanceFreeAgencyMarket`), draft, trocas (`proposeTrade`), coletivas (`choosePress`), eventos (`onChooseEvent`), comissão técnica (`onHireCoach`/`onFireCoach`/`onRenewCoach`).
  * **Draft:** o usuário usa `useDraftSession` (`draft.userPick`, `draft.liveTick`, `draft.scout`, `draft.chooseEvent`, `draft.skipToMyPick`; ver `season/draftSession.js`). `draftOneAI`/`draftAuto` ficam só para o modo espectador (headless, em memória). **Free agency:** `faWave` (onda de ofertas + resolução entre IAs).
  * **Raiz de renderização:** menu, shell do espectador, `TopBar`/`BottomNav`, `PressModal`, `EventModal`, overlay de progresso.
* **`customRosters.js`**: elencos customizados por time. Aceita atributos novos **e** antigos (`ARM`, `HND`, `RSH`... via `LEGACY_ATTR_MAP`); `ovr`, se informado, é a meta para os atributos livres; `scheme` escolhe o front e o DC é gerado para combinar.
* **`main.jsx`**: ponto de entrada React.
* **`lib/rng.js`**: `mulberry32`, `seedFromString`, `clamp`, `randInt`, `pick`.

---

## PARTE 2: FRONTEND: TELAS (`src/screens`)

* **`MenuScreens.jsx`**: `MenuScreen` (lista de saves de carreira; **espera** `s.teamAbbr` válido), `NewCareerScreen` (nome do técnico + escolha do time por divisão), `FiredScreen` (game over; usa `career.seasonsCoached`).
* **`HubScreen.jsx`**: painel central. Avisos de eventos (`eventNotices`), promessas em aberto, alertas da comissão (`staffAlerts`), card da comissão, confiança do dono/torcida/moral, próximo jogo (probabilidade da mídia, rivalidade), offseason (FA/Draft/Contratos/Mercado de técnicos), prêmios e notícias. Botões de jogar/simular ficam desativados com evento pendente.
* **`MarketScreens.jsx`**:
  * Free agency (`FreeAgencyScreen`, `FreeAgentDetailScreen`).
  * **Draft** (`DraftScreen`, `ProspectDetailScreen`, `ProspectCard`, `PickAnnouncement`, `DraftRecap`): Fog of War, painel de scouting, "Assistir ao vivo", feed e `EventModal`.
  * `TradeScreen`.
  * `StatsScreen` com 5 abas: Líderes, Power Rankings, Tier Lists, Recordes e **Histórico** (`AllTimePanel`).
  * **`CoachMarketScreen`** (contratar OC/DC/SC com impacto nominal por setor).
* **`SeasonScreens.jsx`**: `ScheduleScreen` (tabela, playoffs, rivalidades), `ResultsScreen` (aceita `career.isArchive`; usa `WeeklyRecapCard`), `GameScreen`, `HonorsScreen` (cerimônia + All-Pro), `PressModal`, **`EventModal`** (eventos semanais e do draft; categorias crisis, positive, strategy, rivalry, media, relations, draft).
* **`LineupScreens.jsx`**: **`RosterScreen`** e **`DepthChartScreen`** (re-exportados por `TeamManagementScreens.jsx`, então os imports do `App` não mudam).
  * Escalação: alertas acionáveis (titular lesionado, reserva melhor que o titular, moral baixa), força dos setores com ranking na liga, campo em SVG com cor por Overall/Moral/Idade e **ficha do slot** (toque num jogador: lista quem pode jogar ali, diferença de OVR e botão "Colocar aqui", via `onSwapSlots(slotA, slotB)`), mais listas por grupo.
  * Elenco: folha salarial com barra de cap, resumo (OVR dos titulares, lesionados, contratos no fim, moral), filtro por setor, ordenação e filtros de problemas/contratos.
* **`TeamManagementScreens.jsx`**: `TacticsScreen`, `ContractsScreen`, **`StaffScreen`** (e re-exporta `RosterScreen`/`DepthChartScreen`).
* **`TeamAndPlayer.jsx`**: `TeamDetailScreen` e `PlayerDetailScreen` (atributos dinâmicos, carreira, All-Pro 1º/2º time, posição no Top 10 histórico).
* **`HistoryScreen.jsx`**: temporadas passadas (jogos, tabela, líderes, prêmios + All-Pro). Reaproveita `ResultsScreen` com um "career de visualização".
* **`AllTimePanel.jsx`**: aba Histórico do `StatsScreen`.
* **`SpectatorScreens.jsx`**: `SPECTATOR_STUB`, `SpectatorTopBar`, `SpectatorScreen`, `SpectatorMenuSection`.

---

## PARTE 3: FRONTEND: COMPONENTES (`src/components`)

* **`ui.jsx`**: `TeamLogo` (PNG em `components/logos/<ABBR>.png`, com fallback de escudo SVG gerado das cores do time), `TopBar`, `BottomNav` (prop `items`; `NAV` inclui "Comissão"), `Card`, `Bar`, `Btn`, `OvrBadge`, `PosPill`, `DevTag`, `PlayerRow`, `primaryStatLine`, **`AttrBars`** (grid dinâmico 2 ou 3 colunas, prop `top`).
* **`CoachCard.jsx`**: cartão de coordenador (nível, esquema, bônus nominais, badges, contrato, relatório de rendimento, impacto por setor).
* **`Fog.jsx`**: `FogOvr`, `FogAttrBars`, `TraitLine`, `ScoutPanel`.
* **`AllPro.jsx`**: `AllProTeams` (1º/2º time; aceita o formato antigo `allPro`).

---

## PARTE 4: BACKEND: TEMPORADA (`src/season`)

### 4.1 Estado e persistência
* **`careerState.js`**: `newCareerState(teamAbbr, coachName)` monta o save: liga (`buildLeague`), calendário (`buildSchedule`), `tendencies` (`passRatio`, `aggressive`, `rb2CarryShare`, `personnel`, `lightFormationShare`), `freeAgentPool`, `futurePicks`, `rivalries`, `nemeses`, `powerRankings`, `predictionRecord`, `leagueRecords`, `allTimeLeaders`, campos de eventos e `news`. Exporta também `AI_TEND` (tendências fixas das IAs).
* **`archive.js`**: `snapshotLeaders` e `archiveSeason` guardam, em `career.seasonArchive[ano]`, o mesmo formato da temporada atual (schedule/playoffs enxutos), tabela, líderes, prêmios e All-Pro. Só as 5 últimas temporadas mantêm box score (espectador: 1).
* **`lineup.js`**: helpers puros das telas de elenco/escalação (`groupStrength` com ranking na liga, `lineupAlerts`, `candidatesFor`, `starterSlots`, `depthGroups`, cores de OVR/idade).
* **`allTime.js`**: Top 100 por categoria (`allTimeLeaders`). `updateLeadersFromTeams` roda dentro de `applyCareerRollover`; `markLeadersRetired` dentro de `retireAndRefreshLeague`; `markRetiredLeaders` é varredura de segurança. `getAllTimeList` e `allTimeRanksFor` alimentam as telas (ativos somam `careerStats` + `seasonStats`).

### 4.2 Elenco, contratos e moral
* **`depth.js`**: `autoSortDepth(team)` (promove reservas melhores e ordena cada grupo do melhor ao pior), `promoteBench`, `refreshGroups(team, slotKeys)` (reordena só os grupos tocados, usado após trocas). OL e TE/K/P só são promovidos do banco, nunca reembaralhados. Os grupos mudam com o front (`DE1,DE2,NT1`/`LB1–4` no 3-4). Usado pela IA via `sortAIDepth`.
* **`roster.js`**: helpers pequenos de edição do elenco, usados por draft, free agency e trocas.
  * `findSlotForRookie(roster, pos)`: devolve o slot onde um novo jogador entra, nesta ordem: reserva (`BENn`) da mesma posição; qualquer reserva, o de menor OVR; por último, o slot do jogador mais fraco da mesma posição.
  * `insertPlayer(roster, slotKey, newPlayer)`: grava o jogador no slot. **Se já houver alguém nesse slot, ele é substituído (sai do elenco)**; se o slot não existir, o jogador é acrescentado.
* **`morale.js`**: `expectedSalary(ovr)` (curva de salário "justo", espelha o `playerGen`), `targetMorale` (vitórias, justiça salarial, lesão, desenvolvimento, idade), `moraleLabel`, `updateWeeklyMorale` (aproxima 18% do alvo por semana; devolve eventos de jogadores de OVR 80+ que ficaram muito felizes ou infelizes).
* **`contracts.js`**: `years` = temporadas restantes incluindo a atual, então `years <= 1` é último ano. `isExpiring` (`years <= 1`, idade < 34, OVR >= 44), `extensionAsk(p)` (pede mais se moral baixa; recusa se moral < 30), `processAIContracts(leagueTeams, pool, rng, excludeAbbr)` (IA renova ou libera; liberados de OVR >= 68 viram free agents nomeados), `releaseToMarket` (usuário deixa o jogador ir), `replacementFor`.

### 4.3 Mercado: free agency, picks e trocas
* **`freeAgencyAI.js`**: `teamNeeds` (posições com o melhor jogador mais fraco primeiro), `scoreTeamForFreeAgent` (prioridades do jogador: dinheiro, vitória, minutos, clima, torcida, mercado, mais bônus de "casa"), `runFreeAgencyWave` (versão simples de uma onda; o jogo usa o motor de negociação abaixo).
* **`negotiation.js`**: negociação viva. `career.faMarket[playerId] = { offers: [{teamAbbr, years, salary}], decisionIn, log, interestCount }`. `aiOffersWave` (IAs abrem/melhoram ofertas), `resolveMarket` (decide por sorteio ponderado `score³`; o contrato gravado soma +1 ano), `submitUserOffer`, `withdrawUserOffer`, `scoreOffer`, `rankOffers`, `winReason`.
* **`picks.js`**: cada escolha é um ativo `{ id, year, round, originalAbbr, currentOwner }`. `rollFuturePicks` mantém 3 anos negociáveis, `resolvePickOwner`/`consumePick` (draft), `teamPicks`, `pickTradeValue` (valor pela rodada, posição projetada e distância no tempo), `pickProjectionLabel`, `pickLabel`.
* **`trades.js`**: avaliação e execução de trocas entre o time do usuário e uma IA.
  * **Valor de mercado:** `marketValue(p) = talentValue(ovr) × POSITION_VALUE[pos] × ageFactor(idade) × tendência (dev)`. `talentValue` é bem convexa (≈0 até 60 de OVR, ≈33 em 80, ≈80 em 90, ≈140 em 99). QB vale 1,7× e K/P quase nada (`POSITION_VALUE`).
  * **Visão da IA:** o que ela **recebe** é multiplicado por `needFactor` (quanto o jogador melhora a escalação dela; 0,2 se só seria reserva; 0,15 se já tem QB de franquia), e o que ela **entrega** por `lossFactor` (titulares custam mais que reservas; o QB de franquia custa 25% a mais). Times fortes descontam picks (×0,85) e times fracos valorizam (×1,2) (`strategyPickFactor`); o valor do pick vem de `pickTradeValue` (`picks.js`).
  * `evaluateTrade(leagueTeams, targetAbbr, mine, theirs, currentYear)` devolve `{ gain, loss, hasAssets, fair }`; a IA aceita quando `gain >= loss × 1,05`. Os jogadores são avaliados um a um contra um elenco de trabalho, então mandar três QBs não conta a mesma necessidade três vezes. Também há `incomingRole` / `outgoingRole` (rótulos da tela de trocas: "seria titular", "reforço", "titular deles"...).
  * `executeTrade(c, mine, theirs, targetAbbr, rng)` (sobre o `career` já clonado): tira os jogadores, coloca os recebidos nos slots vagos de mesma posição (`placeIncoming`, depois uma vaga de reserva, depois `findSlotForRookie`), preenche qualquer slot ainda vazio com um **reserva** novo de 58–74 de OVR (`fillVacated`, via `makePlayer`; vender um astro por picks custa de verdade), reordena só os grupos tocados na escalação do usuário (`refreshGroups`) e faz `autoSortDepth` completo na IA. Os picks mudam de dono em `c.futurePicks[].currentOwner`.
  * Assume que o usuário é `c.teamAbbr`, então não se aplica ao modo espectador.

### 4.4 Draft
* **`scouting.js`**: `ovrGrade`, `gradeColor`, `fitForTeam`, `pickValueRead` (roubada/reach pela rodada projetada), `pickForTeamAI` (janela dos 8 primeiros do board, equilibra valor e necessidade usando o OVR real) e `scoutingReport` (usa `attrHighlights`).
* **`attrLabels.js`**: `TRAIT_LABELS`, `CONCERN_LABELS`, `attrHighlights`.
* **`fog.js`**: Fog of War. `c.scouting = { points, total, reveals, log }`. Ações (`SCOUT_ACTIONS`): campus 1, vídeo 2, workout 3, entrevista 2, avaliação completa 5 (12 pontos por draft). `fogRead` devolve a faixa de OVR, `consensusScore` é a ordem "da mídia" (OVR real + `scoutNoise`). Perfil oculto `p.trait` (normal, trabalhador, líder, problemático, frágil), revelado pela entrevista.
* **`draftSession.js`** (+ `hooks/useDraftSession.js`): estado volátil do draft **fora do `career`**. Funções puras e determinísticas (`createDraftSession`, `liveTick`, `skipToUser`, `userPick`, `scoutPure`, `chooseEventPure`) trabalham numa sessão que imita os campos que `draftEvents.js`/`fog.js` esperam; `commitDraftSession(prev, d, {final})` faz o merge com compartilhamento estrutural (só os times que assinaram ganham novo elenco). O merge acontece a cada 32 escolhas, a cada escolha do usuário, ao terminar o draft ou ao sair da tela; as telas leem `draft.view` (`draftOverlay`).
* **`draftEvents.js`**: draft ao vivo. `pickCommentary`, `rollMyTurnEvent` / `rollBetweenEvent`, `resolveDraftEvent`, `afterUserPick` (reação da torcida, pedidos cumpridos ou ignorados, perfil revelado).

### 4.5 Comissão técnica e eventos
* **`coachingCarousel.js`**: `runCoachingCarousel` (uma vez, ao começar a offseason): envelhece coordenadores, promove/rebaixa, aposenta, times ruins demitem HCs (ex-HCs viram coordenadores), vagas de HC roubam coordenadores de times de sucesso (Fiel resiste, Mercenário sai), IA repõe vagas, mercado é reposto. Também: `hireCoach`, `fireCoach`, `renewCoach`, `convertFront` (reorganiza 4-3 ↔ 3-4 quando o DC muda; pode assinar um reforço), `applyCoachDevelopment`, `pushAlert`.
* **`events.js`**: eventos semanais.
  * Banco `EVENTS` (23 eventos): crises (vestiário, greve, incidente, dúvida de lesão, kicker em crise, polêmica no QB), positivos (mentoria, jantar, ação social, investimento do dono, capitães), estratégicos (reunião com coordenador, semana curta, clima, OL em apuros, briga por playoffs), rivalidade (usa `rivalryTier`), mídia (vazamento, rumores de demissão, fofoca do QB, rumor de troca) e relações (dono exige sequência, WR exige passes).
  * Efeitos declarativos: `owner`, `fan`, `teamMorale`, `morale`, `tmp`, `dev`, `injury`, `heal`, `healTeam`, `salary`, `weekMod`, `swap`, `chance`, `promise`.
  * Promessas (`activePromises`): `targets`, `result`, `streak`, checadas por `checkPromises` logo após o jogo. `withWeekMods` soma a tática do evento aos sliders só naquele jogo.

### 4.6 Narrativa, mídia e tabela
* **`press.js`** (fica em `src/engine/`): coletivas. `buildPressEvent(type, ctx, rng)` com `game_result` (categorias win_big, win_close, loss_close, loss_big, rivalry_win/loss, win_streak, loss_streak), `draft_grade` e marcos (`clinched_playoffs`, `eliminated_playoffs`, `champion`, `hot_seat`). Opções: `{ label, owner, fan, moraleTarget?, moraleDelta? }` (resposta gravada em `choosePress`).
* **`rivalries.js`**: `career.rivalries[opp]` (retrospecto, sequência, encontros de playoff) e `career.nemeses`. `recordMeeting`, `rivalryTier` (devolve `{label, color}` ou `null`; um time de divisão sem histórico ainda é "Rival de divisão"), `headToHeadLine`, `detectStandoutPerformances`, `updateNemeses`.
* **`powerRankings.js`**: `teamScore`, `buildPowerRankings` (com movimento e blurbs), `rankingMap`, `hotTake`, `winProbability` (previsão da mídia antes dos jogos), `buildTierList` (faixas S/A/B/C/D de tamanho fixo). **Atenção:** tem uma cópia própria de `seasonValueScore`, igual à do `legacy.js`; se mudar uma, mude a outra.
* **`weeklyRecap.js`**: `buildWeeklyRecap(leagueTeams, weekGames)` (jogador da semana, destaques, zebras, atropelos, jogos sem pontos). Depende do box score da semana.
* **`teamIdentity.js`**: `teamIdentity(abbr, city)`: mascote, apelido da torcida, estádio e grito de guerra. Determinístico pela abreviação e **não é salvo**.
* **`standings.js`**: `standingsSorted`, `conferenceSeeds` (7 por conferência), `draftOrderFromStandings`, `applyResult`.
* **`stats.js`**: `STAT_CATEGORIES`, `leagueLeaders`, estatísticas de razão com volume mínimo crescente (`RATIO_STATS`, `ratioMinimum`), `gamesPlayedThisSeason`, `formatStatValue`, `resetSeasonStats`.
* **`records.js`**: recordes de jogo (`checkGameRecords`, após cada jogo da liga) e de temporada (`checkSeasonRecords`, antes do reset de stats). Guardados em `career.leagueRecords`.

### 4.7 Fim de ano
* **`legacy.js`**: `computeSeasonAwards` (MVP, melhor ataque/defesa, novatos, melhor campanha e **All-Pro 1º e 2º time**, formação em `ALL_PRO_SLOTS`: 1 QB, 1 RB, 2 WR, 1 TE, 5 OL, 4 DL, 3 LB, 2 CB, 2 S, K, P). `applyCareerRollover(leagueTeams, awards, allTimeLeaders)` soma stats, concede honras ("All-Pro 1º Time 2026"...) e atualiza o Top 100. Deve rodar **antes** de `resetSeasonStats` e da aposentadoria.
* **`offseason.js`**: `retireAndRefreshLeague(teams, year, allTimeLeaders)` (envelhece com `agePlayer`, aposenta quem tem mais de 34 anos ou OVR < 44, repõe o slot, `normalizeSalaries`; devolve `{ news, retirees }`). `isLegendary` pondera honras (principais 1, All-Pro 1º 0,5, 2º 0,2) para o Hall da Fama.

---

## PARTE 5: BACKEND/ENGINE (`src/engine`)

* **`playerGen.js`**:
  * `POSITION_WEIGHTS`, `computeOvr`, `recalcOvr`, `rollAttrs` (talento compartilhado do tier ± dispersão, mais um ponto forte e um fraco).
  * `makePlayer` / `makeCustomPlayer`, `agePlayer` (físicos caem mais rápido; recalcula o OVR).
  * Migração: `LEGACY_ATTR_MAP`, `upgradePlayerAttrs`, `upgradeCareerPlayers`.
  * `buildRoster` / `buildLeague` (front seven vem do esquema do DC; times nascem com `coaches {OC, DC, SC}`), `normalizeSalaries`, `circleSchedule`, `buildSchedule` (17 semanas).
  * `generateFreeAgents`, `convertToFreeAgent`, `generateDraftClass` (inclui `scoutNoise` e `trait`), `capUsed`, `playerValue`.
* **`simulation.js`**: motor da partida.
  * Entradas públicas `simGameDetailed` e `simGameQuick` aplicam/limpam os bônus de staff e eventos (núcleos: `simGameDetailedCore`, `simGameQuickCore`).
  * Passe: precisão do QB por profundidade (`STA`/`MTA`/`DTA`), `TUP` sob pressão, `THP` nos lançamentos longos, `MOB` escapa de sacks; cobertura man (`MCV` + `PRS`) ou zone (`ZCV`) contra o `RTE` (`coverageType`).
  * Proteção: `PBK` (+`AGI` contra finesse, +`STR` contra power); RB ou TE seguram blitz; LB e safeties blitzam com `FMV`/`PMV`.
  * Corrida: bloqueio da OL com `AGI` forte nas corridas por fora; `rbRunScore`, `runDefRating`.
  * Special teams: `CLT` no 4º quarto, `KPW`/`KAC` nos FGs, `puntDistance` (`TRK`/`KAC`); o SC muda alcance de FG (`fgRangeBias`) e agressividade na 4ª descida (`goBias`).
  * Coordenadores: `schemePassBias`, `withDefScheme` (blitz e `manBias`).
* **`ratings.js`**: `attr`, `rawAttr`, `posAvg`, `manCover`, `zoneCover`, `coverRating`, `finesseMove`, `powerMove`, `rushRating`, `runDefRating`, `routeSkill`, `rbRunScore`, `runBlockRating`, `passBlockRating`, `offenseRating`, `defenseRating`, `teamOverall` (inclui `fxOvr`).
* **`coachesGen.js`**: coordenadores.
  * Níveis S/A/B/C/D (`LEVEL_MULT`); funções OC/DC/SC.
  * Esquemas: ataque (Spread, West Coast, Smashmouth, Air Raid), defesa (4-3, 3-4, Tampa 2, Man-Heavy), ST (Agressivo, Passivo). `SCHEME_BONUS`/`SCHEME_META`/`SCHEME_BLURB`, `FRONT_BY_SCHEME`.
  * Badges: Mentor de Linha, Mentor de Especialistas, Fiel, Mercenário, Disciplinador, Visionário.
  * Ocultos: `talent`, `form` (muda a cada temporada), `fit` (sorteado ao chegar a um time). Só bônus positivos são multiplicados por eles.
  * `ensureCoachingState`. Não existe orçamento de staff (o salário é informativo).
* **`staffEffects.js`**: `applyStaffBonuses` (junta staff e `tmpMods` em `p.fx`/`p.fxOvr`), `clearStaffBonuses`, `staffImpact` (estimativa nominal por setor para a UI).
* **`press.js`**: coletivas reativas (detalhes na seção 4.6).
* **`nicknames.js`**: apelido pelo maior atributo (`NICKNAME_POOL` cobre todos os atributos).

---

## PARTE 6: DADOS ESTÁTICOS (`src/data`)

* **`rosterSlots.js`**: slots do elenco (front 4-3 ou 3-4), `rosterSlotsFor(scheme)`, `SUB_ATTRS`, `ATTR_LABELS`.
* **`teams.js`**: `TEAM_META` (abbr, cidade, nome, cores `c1`/`c2`, conferência, divisão, mercado, clima, astros), `CAP`.
* **`names.js`**: geração de nomes.

---

## PARTE 7: ESTADO DA CARREIRA (`career`)

Campos principais: `id`, `coachName`, `teamAbbr` (null no espectador), `spectator`, `forkOf`, `year`, `week`, `phase` (`season`/`playoffs`/`offseason`), `seasonsCoached`, `leagueTeams`, `schedule`, `playoffs`, `tendencies`, `weekMods`, `lastGame`, `gameRevealCount`, `pressPending`, `hotSeatWarned`, `news`.

* **Mercado/draft:** `freeAgentPool`, `faMarket`, `freeAgencyActivity`, `draftClass`, `draftOrder`, `draftPickIndex`, `draftHistory`, `futurePicks`, `tradeHistory`.
* **Draft ao vivo/fog:** `scouting`, `draftFeed`, `pendingDraftEvent`, `draftWish`, `draftEventPick`, `draftFlags`.
* **Narrativa:** `rivalries`, `nemeses`, `powerRankings`, `powerRankingsPrev`, `hotTake`, `predictionRecord`, `leagueRecords` (`single_game`, `single_season`).
* **Histórico:** `seasonArchive`, `allTimeLeaders`, `hallOfFame`, `lastSeasonAwards` (inclui `allPro` e `allProTeams`).
* **Comissão:** `coachesMarket`, `staffAlerts`, `hcHires`, `staffInit`.
* **Eventos:** `pendingEvents`, `activePromises`, `eventNotices`, `eventCooldowns`.

**Time** (`leagueTeams[abbr]`): `roster`, `scheme` (front), `coaches {OC, DC, SC}`, `hc` (coordenador promovido a HC), `wins/losses/ties/pf/pa`, `ownerConfidence`, `fanSupport`, `picks`, metadados do `TEAM_META`.

**Jogador:** `id`, `name`, `pos`, `ovr`, `attrs`, `age`, `years`, `salary`, `dev`, `slot`, `morale`, `injuredWeeks`, `injuryHistory`, `seasonStats`, `careerStats`, `seasonsPlayed`, `accolades`, `nickname`, `rookieYear`. Transitórios: `fx`, `fxOvr` (só durante o jogo), `tmpMods` (eventos). De free agent: `askingYears`, `priorities`, `climatePref`, `homeTeam`, `formerTeam`. De prospect: `draftRound`, `scoutNoise`, `trait`.

---

## PARTE 8: FLUXOS PRINCIPAIS

1. **Semana:** Hub (responder eventos pendentes) → `playWeek` → `advanceWeek` (jogos, resultados, moral, rivalidades, recordes, coletiva, promessas, expiração de modificadores, power rankings, eventos da próxima semana).
2. **Playoffs → offseason:** `advancePlayoffRound` até o campeão → offseason (`processAIContracts`, ofertas iniciais de free agency, classe de draft, `resetScouting`, carrossel de técnicos) → usuário contrata coordenadores, negocia (`faMarket`), troca e faz o draft.
3. **Virada de ano:** `advanceSeasonYear` → `checkSeasonRecords` → prêmios → arquivo → `applyCareerRollover` + Top 100 → `retireAndRefreshLeague` (`isRetired`) → desenvolvimento por coordenadores → `resetSeasonStats` → novo calendário e ano.
4. **Draft:** scouting (pontos) → "Assistir ao vivo" (`liveDraftTick`, eventos) ou "Pular até minha vez" → `draftPick` (reação, revelação do OVR real, coletiva de nota do draft) → recap.
5. **Espectador:** menu → liga sem time → `simSpectator` (1/5/10/25 temporadas ou semana a semana) → bifurcar realidades → Stats/Histórico/Top 100.

---

## PARTE 9: ONDE MEXER (RECEITAS)

* **Novo atributo ou posição:** `SUB_ATTRS`, `ATTR_LABELS`, `POSITION_WEIGHTS`, `LEGACY_ATTR_MAP` (se precisar migrar), `attrLabels.js`, `nicknames.js`; depois use o atributo em `simulation.js` via `attr()`. Se criar um slot novo, atualize `rosterSlots.js` e `depth.js`.
* **Novo evento semanal:** item em `EVENTS` (`events.js`) com `id`, `category`, `weight`, `cd`, `when`, `build` usando `opt(label, effects)`. Efeito novo: `applyEffects` e `chipsFor`.
* **Novo evento de draft:** `MY_TURN` ou `BETWEEN` em `draftEvents.js` (efeitos próprios em `applyDraftEffects`).
* **Nova coletiva:** adicione prompts/opções em `press.js` e o ponto de chamada em `App.jsx`.
* **Ajustar o valor de jogadores/picks nas trocas:** `POSITION_VALUE`, `talentValue`, `ageFactor`, `needFactor`/`lossFactor` em `trades.js` e `ROUND_CURVE` em `picks.js`.
* **Novo esquema/bônus de coordenador:** `SCHEME_BONUS`, `SCHEME_META`, `SCHEME_BLURB` e `schemesFor` em `coachesGen.js` (e `FRONT_BY_SCHEME` se mexer no front).
* **Nova estatística histórica:** `ALL_TIME_CATEGORIES` e `POS_GROUPS` em `allTime.js` (a chave precisa existir em `careerStats`). Para líderes da temporada: `STAT_CATEGORIES` em `stats.js`.
* **Novo prêmio ou nota de temporada:** `legacy.js` (e a cópia de `seasonValueScore` em `powerRankings.js`).
* **Nova ação de scouting:** `SCOUT_ACTIONS` e `doScout` em `fog.js`.
* **Nova tela:** crie em `screens/`, adicione `screen === "..."` no `App.jsx` e, se for aba, no `NAV` de `ui.jsx` (no espectador, em `SPEC_NAV`).
* **Novo campo no save:** inicialize em `careerState.js` **e** em uma `ensureXxx` idempotente.

---

## PARTE 10: PONTOS DE ATENÇÃO

* Ao criar jogadores sem passar por `makePlayer`, use `rollAttrs` + `computeOvr`; nunca atribua `ovr` à mão. Substituições de contratos/aposentadoria já usam `makePlayer`.
* Movimentar jogadores entre slots exige `autoSortDepth`/`refreshGroups`; `convertFront` usa os slots `NT1`, `LB4`, `DT1`, `DT2` e reservas `BENn`.
* O Top 100 histórico só conhece jogadores que passaram por `careerStats`; em saves antigos, aposentados anteriores à feature não são recuperáveis (exceto os do Hall da Fama).
* `markRetiredLeaders` marca como aposentado quem não está em elenco, mercado ou draft (inclui free agents que ninguém contratou).
* `legacy.js` e `powerRankings.js` têm `seasonValueScore` duplicado.
* `freeAgencyAI.runFreeAgencyWave` é a versão antiga de uma onda de free agency; o fluxo atual usa `negotiation.js`.
* O draft ao vivo usa sessão separada; qualquer código novo que leia `draftClass`/`scouting`/`draftFeed` na tela do draft deve ler de `draft.view`, não de `career`, ou verá dados defasados até o próximo merge.
* O IndexedDB elimina o limite de ~5 MB do `localStorage`, mas o clone estruturado de um `career` muito grande ainda custa tempo; por isso o autosave é com debounce e pausado em simulações em lote.
* Telas que esperam `myTeam` no espectador dependem de `SPECTATOR_STUB` ter os campos que elas leem.
* `insertPlayer` **sobrescreve** o jogador que ocupa o slot. Se `findSlotForRookie` cair no último caso (sem reservas), um titular da posição pode ser substituído por um novato/reforço. Código que só quer "adicionar" um jogador sem cortar ninguém (como o `convertFront` e o `fillVacated`) faz `roster.push` com um slot livre.
* `executeTrade` e `evaluateTrade` usam `needFactor`/`lossFactor` pelo número de titulares do front atual (`startersAt`: DL 4 e LB 3 no 4-3; DL 3 e LB 4 no 3-4); ao trocar de DC (front diferente) os cálculos mudam junto.
* Todos os módulos da pasta `season/` e `engine/` estão descritos neste manual; não há mais arquivos pendentes de revisão.
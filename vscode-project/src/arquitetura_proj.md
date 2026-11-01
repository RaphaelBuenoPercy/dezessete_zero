# Documentação Completa da Arquitetura do Jogo (Gridiron GM)

Este documento é o manual mestre do projeto: mapeia todos os módulos, os fluxos principais e as convenções que **não podem ser quebradas**. Ele foi escrito para orientar a IA a fazer alterações cirúrgicas na base de código. Leia a **Parte 0** antes de mexer em qualquer coisa.

Stack: React (componentes funcionais) + Tailwind (classes utilitárias, tema escuro `#0B1220`/`#121a2c`) + JS puro no motor. Sem backend: o save fica no `localStorage` (`nflcareer:<id>`). Idioma da interface: **português (BR)**. O usuário joga principalmente no **celular** (telas estreitas, listas roláveis, botões grandes).

---

## PARTE 0: CONVENÇÕES CRÍTICAS (leia primeiro)

1. **OVR é derivado dos atributos.** Cada posição tem vários atributos (`SUB_ATTRS` em `data/rosterSlots.js`) e o `p.ovr` é a média ponderada deles (`POSITION_WEIGHTS` em `engine/playerGen.js`). Quem alterar `p.attrs` **deve chamar `recalcOvr(p)`** (ou `computeOvr(pos, attrs)`). Nunca altere `p.ovr` diretamente.
2. **Bônus temporários nunca mexem em `attrs`/`ovr`.** Bônus de coordenadores e modificadores de eventos entram só durante o jogo, em `p.fx` (e `p.fxOvr`), montados por `applyStaffBonuses` e limpos por `clearStaffBonuses`. `p.tmpMods` (eventos) persiste por algumas semanas e é somado ao `fx`. Toda leitura de atributo no motor deve passar por `attr(p, "KEY")` / `rawAttr` (`engine/ratings.js`), que já incluem `fx`.
3. **Funções puras no loop do jogo.** `advanceWeek(prev, inPlace)`, `advancePlayoffRound(prev, inPlace)` e `advanceSeasonYear(prev, inPlace)` recebem o `career` e devolvem o novo. `inPlace = true` só quando o chamador já é dono do objeto (simulações em lote). As funções de ação do usuário usam `setCareer(prev => structuredClone(prev) ...)`.
4. **Determinismo.** Sorteios usam `mulberry32(seedFromString(c.id + "-..."))`. O `c.id` faz parte das sementes, então salvar com outro id (bifurcar realidade) muda o futuro.
5. **Modo espectador:** `career.spectator = true` e `career.teamAbbr = null`. Todo código que usa `c.leagueTeams[c.teamAbbr]` precisa tolerar `undefined`. Telas que pedem `myTeam` recebem `SPECTATOR_STUB`.
6. **Fog of War do draft:** `draftClass[i].attrs/ovr` são os valores **reais**. A UI só mostra o que `career.scouting.reveals` liberou (`fogRead`, `FogAttrBars`). A IA draftea pelo OVR real. Nunca exiba `p.ovr` de prospect direto.
7. **Coordenadores têm rendimento oculto:** o nível (S–D) é só reputação. O rendimento real depende de `talent × form × fit` (ocultos). As telas mostram apenas o bônus *nominal* (`coachBonusMap(coach, true)`).
8. **Persistência:** `career` inteiro é serializado a cada mudança de estado. Evite guardar objetos grandes (box scores completos, históricos longos). O `localStorage` tem ~5 MB: `archive.js` enxuga box scores e o modo espectador poda notícias/históricos.
9. **Saves antigos:** toda feature nova precisa ser retrocompatível. Padrão: uma função `ensureXxx(career)` idempotente chamada em `onCreateCareer` e `onLoadCareer` (hoje: `upgradeCareerPlayers`, `ensureCoachingState`, `ensureEventsState`, `ensureAllTimeLeaders`, `ensureScoutingState`).

---

## PARTE 1: NÚCLEO DA APLICAÇÃO (`src/`)

* **`App.jsx`**: controlador principal (estado global `career`, tela atual `screen`, detalhe aberto `detail`, saves, progresso de simulação). Persiste automaticamente no `localStorage`.
  * **Criação/carga:** `onCreateCareer` (carreira com time), `onStartSpectator` (liga sem time), `forkSpectator` (copia a liga para um novo save), `onLoadCareer`, `onDeleteCareer`, `onRestart`. Saves de espectador são listados à parte (`spectatorSaves`) abaixo do `MenuScreen`.
  * **Loop da temporada:**
    * `advanceWeek` simula uma semana (o jogo do usuário em detalhe; os demais em modo rápido), atualiza moral, lesões, recap, **cobra promessas** (`checkPromises`), expira modificadores (`tickTempMods`) e **sorteia os eventos da próxima semana** (`rollWeeklyEvents`).
    * `advancePlayoffRound` avança o mata-mata. Ao coroar o campeão entra na **offseason**: contratos de IA, free agency inicial, classe do draft, `resetScouting`, e o **coaching carousel** (`runCoachingCarousel`).
    * `advanceSeasonYear` (virada de ano): prêmios (`computeSeasonAwards`), arquivo histórico (`archiveSeason`), `applyCareerRollover` (atualiza `careerStats` e o Top 100 histórico), `retireAndRefreshLeague`, desenvolvimento por coordenadores (`applyCoachDevelopment`), novo calendário e eventos da semana 1.
    * `simSeason` (usuário): simula a temporada inteira com `autoSortDepth`, descartando coletivas e eventos.
    * `simSpectator(mode)`: `"step"`, `"season"` ou N temporadas completas, em fatias de tempo com progresso e cancelamento. Cada "unidade" é 1 semana, 1 rodada de playoffs ou a offseason inteira (`spectatorUnit`: 4 ondas de FA + draft automático + virada de ano).
  * **Ações do usuário:** troca de escalação, extensões, ofertas de free agency (`makeFreeAgentOffer`), draft (`draftPick`), trocas (`proposeTrade`), coletivas (`choosePress`), eventos (`onChooseEvent`), comissão técnica (`onHireCoach`/`onFireCoach`/`onRenewCoach`).
  * **Draft:** `draftOneAI` (uma escolha da IA), `draftAuto` (até a vez do usuário), `liveDraftTick` (draft ao vivo: uma escolha por tick com comentário e eventos), `onScout`, `onChooseDraftEvent`, `simToMyPick`.
  * **Free agency:** `faWave` (uma onda de ofertas/resoluções entre IAs), `advanceFreeAgencyMarket`.
  * **Raiz de renderização:** menu, shell do espectador, `TopBar`/`BottomNav`, `PressModal`, `EventModal` (eventos semanais) e overlay de progresso de simulação.
* **`customRosters.js`**: elencos customizados. Aceita atributos novos **e** antigos (`ARM`, `HND`, `RSH`...) via `LEGACY_ATTR_MAP`; o `ovr`, se informado, é a meta que os atributos livres tentam atingir. O `scheme` escolhe o front e o DC é gerado para combinar.
* **`main.jsx`**: ponto de entrada React.
* **`lib/rng.js`**: PRNG `mulberry32`, `seedFromString`, `clamp`, `randInt`, `pick`.

---

## PARTE 2: FRONTEND: TELAS (`src/screens`)

* **`HubScreen.jsx`**: painel central. Avisos de eventos (`eventNotices`), promessas em aberto, alertas da comissão (`staffAlerts`), card da comissão técnica, próximo jogo, offseason, prêmios, cap e notícias. Botões de jogar semana, simular temporada e histórico ficam desativados com evento pendente (`pendingEvents`).
* **`MarketScreens.jsx`**:
  * Free agency (`FreeAgencyScreen`, `FreeAgentDetailScreen`).
  * **Draft** (`DraftScreen`, `ProspectDetailScreen`, `ProspectCard`, `PickAnnouncement`, `DraftRecap`): Fog of War, painel de scouting, modo "Assistir ao vivo", feed "Ao vivo do draft" e `EventModal` do draft.
  * `TradeScreen`.
  * `StatsScreen` com 5 abas: Líderes, Power Rankings, Tier Lists, Recordes e **Histórico** (`AllTimePanel`).
  * **`CoachMarketScreen`**: contratar OC/DC/SC, com impacto nominal por setor.
* **`SeasonScreens.jsx`**: `ScheduleScreen`, `ResultsScreen` (aceita `career.isArchive` para temporadas passadas), `GameScreen`, `HonorsScreen` (cerimônia + All-Pro), `PressModal`, **`EventModal`** (eventos semanais e do draft; categorias crisis/positive/strategy/rivalry/media/relations/draft).
* **`TeamManagementScreens.jsx`**: `RosterScreen`, `DepthChartScreen`, `TacticsScreen`, `ContractsScreen`, **`StaffScreen`** (comissão técnica: renovar/dispensar).
* **`TeamAndPlayer.jsx`**: `TeamDetailScreen` e `PlayerDetailScreen` (atributos dinâmicos, carreira, All-Pro 1º/2º time, posição no Top 10 histórico).
* **`HistoryScreen.jsx`**: temporadas passadas (jogos, tabela, líderes, prêmios + All-Pro). Reaproveita `ResultsScreen` montando um "career de visualização".
* **`AllTimePanel.jsx`**: aba Histórico do `StatsScreen` (filtros de posição, categoria e status ativo/todos).
* **`SpectatorScreens.jsx`**: `SPECTATOR_STUB`, `SpectatorTopBar`, `SpectatorScreen` (controles de simulação, bifurcar, campeões) e `SpectatorMenuSection`.
* **`MenuScreens.jsx`** (`MenuScreen`, `NewCareerScreen`, `FiredScreen`): não alterado.

---

## PARTE 3: FRONTEND: COMPONENTES (`src/components`)

* **`ui.jsx`**: `TeamLogo` (PNG em `components/logos/` com fallback SVG), `TopBar`, `BottomNav` (prop `items` permite menus alternativos; `NAV` inclui a aba "Comissão"), `Card`, `Bar`, `Btn`, `OvrBadge`, `PosPill`, `DevTag`, `PlayerRow`, `primaryStatLine`, **`AttrBars`** (grid dinâmico de 2 ou 3 colunas, prop `top`).
* **`CoachCard.jsx`**: cartão de coordenador (nível, esquema, bônus nominais, badges, contrato, relatório de rendimento, impacto por setor).
* **`Fog.jsx`**: `FogOvr` (faixa de OVR), `FogAttrBars` (atributos `??`), `TraitLine`, `ScoutPanel` (ações de scouting).
* **`AllPro.jsx`**: `AllProTeams` (alterna 1º/2º time; aceita o formato antigo `allPro`).

---

## PARTE 4: BACKEND: TEMPORADA (`src/season`)

### Estado e histórico
* **`careerState.js`**: `newCareerState` (liga, calendário, tendências, picks futuros, `allTimeLeaders`, campos de eventos) e `AI_TEND` (tendências fixas da IA).
* **`archive.js`**: `snapshotLeaders` e `archiveSeason` guardam por ano, em `career.seasonArchive[ano]`, o mesmo formato da temporada atual (schedule e playoffs enxutos), tabela, líderes, prêmios e All-Pro. Só as últimas 5 temporadas mantêm box score (espectador: 1).
* **`allTime.js`**: Top 100 histórico por categoria (`allTimeLeaders`). `updateLeadersFromTeams` roda dentro de `applyCareerRollover`; `markLeadersRetired` dentro de `retireAndRefreshLeague`; `markRetiredLeaders` é uma varredura de segurança. `getAllTimeList` e `allTimeRanksFor` alimentam as telas (valores de ativos somam `careerStats` + `seasonStats`).

### Gestão da máquina (IA)
* `depth.js` (escalação), `morale.js`, `contracts.js` (renovações/dispensas; `processAIContracts`).
* `freeAgencyAI.js` (`teamNeeds`, `aiOffersWave`), `negotiation.js` (leilão), `trades.js`, `picks.js` (escolhas como ativos; `resolvePickOwner`, `consumePick`).

### Draft
* **`scouting.js`**: `ovrGrade`, `gradeColor`, `fitForTeam`, `pickValueRead`, `pickForTeamAI` (IA escolhe pelo OVR real + necessidade) e `scoutingReport` (usa `attrHighlights`).
* **`attrLabels.js`**: `TRAIT_LABELS`, `CONCERN_LABELS` e `attrHighlights` (maior e menor atributo).
* **`fog.js`**: Fog of War. `c.scouting = { points, total, reveals, log }`. Ações (`SCOUT_ACTIONS`): campus 1, vídeo 2, workout 3, entrevista 2, avaliação completa 5 (12 pontos por draft). `fogRead` devolve a faixa de OVR, `consensusScore` é a ordem "da mídia" (OVR real + `scoutNoise`). Perfil oculto `p.trait` (normal, trabalhador, líder, problemático, frágil), revelado pela entrevista.
* **`draftEvents.js`**: draft ao vivo. `pickCommentary` (feed), `rollMyTurnEvent` / `rollBetweenEvent` (despencou no board, tesouro tardio, sala de guerra dividida, torcida pede posição, boato médico, pedido do dono), `resolveDraftEvent`, `afterUserPick` (reação da torcida, pedidos cumpridos/ignorados, perfil revelado).

### Comissão técnica e eventos
* **`coachingCarousel.js`**: `runCoachingCarousel` (rodado uma vez ao começar a offseason): envelhece coordenadores, promove/rebaixa, aposenta, times ruins demitem HCs (ex-HCs viram coordenadores), vagas de HC roubam coordenadores de times de sucesso (Fiel resiste, Mercenário sai), IA repõe vagas, mercado é reposto. Também: `hireCoach`, `fireCoach`, `renewCoach`, `convertFront` (reorganiza o front 4-3 ↔ 3-4 quando o DC muda), `applyCoachDevelopment` (Mentor de Linha/Especialistas).
* **`events.js`**: eventos semanais.
  * Banco `EVENTS` (23 eventos): crises (vestiário, greve, incidente, dúvida de lesão, kicker em crise, polêmica no QB), positivos (mentoria, jantar, ação social, investimento do dono, capitães), estratégicos (reunião com coordenador, semana curta, clima, OL em apuros, briga por playoffs), rivalidade (usa `rivalryTier`), mídia (vazamento, rumores de demissão, fofoca do QB, rumor de troca) e relações (dono exige sequência, WR exige passes).
  * Efeitos declarativos: `owner`, `fan`, `teamMorale`, `morale`, `tmp`, `dev`, `injury`, `heal`, `healTeam`, `salary`, `weekMod`, `swap`, `chance`, `promise`.
  * Promessas (`activePromises`): `targets`, `result`, `streak`, checadas por `checkPromises` logo após o jogo.
  * `withWeekMods` soma a tática do evento aos sliders só naquele jogo.

### Fim de ano e narrativa
* **`legacy.js`**: `computeSeasonAwards` (MVP, OPOY, DPOY, novatos, melhor campanha e **All-Pro 1º e 2º time** com formação `ALL_PRO_SLOTS`: 1 QB, 1 RB, 2 WR, 1 TE, 5 OL, 4 DL, 3 LB, 2 CB, 2 S, K, P). `applyCareerRollover(leagueTeams, awards, allTimeLeaders)` soma stats, concede honras ("All-Pro 1º Time 2026"...) e atualiza o Top 100.
* **`offseason.js`**: `retireAndRefreshLeague(teams, year, allTimeLeaders)` (envelhece, aposenta, repõe elencos, marca `isRetired`). `isLegendary` pondera honras (principais 1, All-Pro 1º 0,5, 2º 0,2) para o Hall da Fama.
* `records.js`, `rivalries.js`, `powerRankings.js`, `weeklyRecap.js`, `teamIdentity.js`, `standings.js`, `stats.js` (líderes e categorias).

---

## PARTE 5: BACKEND/ENGINE (`src/engine`)

* **`playerGen.js`**:
  * `POSITION_WEIGHTS`, `computeOvr`, `recalcOvr`, `rollAttrs` (talento compartilhado do tier ± dispersão, mais um ponto forte e um fraco).
  * `makePlayer` / `makeCustomPlayer`, `agePlayer` (atributos físicos caem mais rápido; recalcula o OVR).
  * Migração de saves antigos: `LEGACY_ATTR_MAP`, `upgradePlayerAttrs`, `upgradeCareerPlayers`.
  * `buildRoster` / `buildLeague` (o front seven vem do esquema do DC; times nascem com `coaches {OC, DC, SC}`).
  * `generateFreeAgents`, `generateDraftClass` (inclui `scoutNoise` e `trait`).
* **`simulation.js`**: motor da partida.
  * Entradas públicas `simGameDetailed` e `simGameQuick` aplicam/limpam os bônus de staff e eventos. Os núcleos são `simGameDetailedCore` e `simGameQuickCore`.
  * Uso dos atributos: precisão do QB por profundidade (`STA`/`MTA`/`DTA`) e `TUP` sob pressão, `THP` nos lançamentos longos, `MOB` escapa de sacks.
  * Proteção: bloqueadores usam `PBK` (+`AGI` contra finesse, +`STR` contra power); o RB ou o TE seguram blitz; LB/safeties blitzam com `FMV`/`PMV`.
  * Corrida: bloqueio da OL usa `AGI` forte nas corridas por fora; `rbRunScore` e `runDefRating`.
  * Cobertura: man (`MCV` + `PRS` nas rotas curtas) ou zone (`ZCV`) contra o `RTE` do recebedor (`coverageType`).
  * Special teams: `CLT` no 4º quarto, `KPW`/`KAC` nos FGs, `puntDistance` (`TRK`/`KAC` colocam a bola). Coordenador de ST: `fgRangeBias` e `goBias`.
  * Estilo dos coordenadores: `schemePassBias`, `withDefScheme` (blitz e `manBias`).
* **`ratings.js`**: `attr`, `rawAttr`, `posAvg`, `manCover`, `zoneCover`, `coverRating`, `finesseMove`, `powerMove`, `rushRating`, `runDefRating`, `routeSkill`, `rbRunScore`, `runBlockRating`, `passBlockRating`, `offenseRating`, `defenseRating`, `teamOverall` (inclui `fxOvr`).
* **`coachesGen.js`**: coordenadores.
  * Níveis S/A/B/C/D (`LEVEL_MULT`); funções OC/DC/SC.
  * Esquemas: ataque (Spread, West Coast, Smashmouth, Air Raid), defesa (4-3, 3-4, Tampa 2, Man-Heavy), ST (Agressivo, Passivo).
  * `SCHEME_BONUS`/`SCHEME_META` (bônus de atributo e vieses de estilo), `FRONT_BY_SCHEME`.
  * Badges: Mentor de Linha, Mentor de Especialistas, Fiel, Mercenário, Disciplinador, Visionário.
  * Ocultos: `talent`, `form` (muda a cada temporada), `fit` (sorteado ao chegar a um time). Só bônus positivos são multiplicados por eles.
  * `ensureCoachingState`; não existe orçamento de staff (o salário é informativo).
* **`staffEffects.js`**: `applyStaffBonuses` (junta bônus de staff e `tmpMods` em `p.fx`/`p.fxOvr`), `clearStaffBonuses`, `staffImpact` (estimativa nominal por setor para a UI).
* **`press.js`**, **`nicknames.js`** (apelido pelo maior atributo; `NICKNAME_POOL` cobre todos os atributos).

---

## PARTE 6: ESTRUTURA DE DADOS ESTÁTICOS (`src/data`)

* **`rosterSlots.js`**: slots do elenco (front 4-3 ou 3-4), `SUB_ATTRS` (atributos por posição), `ATTR_LABELS`.
* **`teams.js`**: `TEAM_META`, `CAP`, astros predefinidos. **`names.js`**: geração de nomes.

---

## PARTE 7: ESTADO DA CARREIRA (`career`)

Campos principais: `id`, `coachName`, `teamAbbr` (null no espectador), `spectator`, `forkOf`, `year`, `week`, `phase` (`season`/`playoffs`/`offseason`), `leagueTeams`, `schedule`, `playoffs`, `tendencies`, `weekMods`, `lastGame`, `pressPending`, `news`.

* **Mercado/draft:** `freeAgentPool`, `faMarket`, `freeAgencyActivity`, `draftClass`, `draftOrder`, `draftPickIndex`, `draftHistory`, `futurePicks`, `tradeHistory`.
* **Draft ao vivo/fog:** `scouting`, `draftFeed`, `pendingDraftEvent`, `draftWish`, `draftEventPick`, `draftFlags`.
* **Histórico:** `seasonArchive`, `allTimeLeaders`, `hallOfFame`, `lastSeasonAwards` (inclui `allPro` e `allProTeams`), `leagueRecords`, `rivalries`, `powerRankings`.
* **Comissão:** `coachesMarket`, `staffAlerts`, `hcHires`, `staffInit`.
* **Eventos:** `pendingEvents`, `activePromises`, `eventNotices`, `eventCooldowns`.

Time (`leagueTeams[abbr]`): `roster`, `scheme` (front), `coaches {OC, DC, SC}`, `hc` (coordenador promovido a HC), `wins/losses/ties/pf/pa`, `ownerConfidence`, `fanSupport`, `picks`.

Jogador: `id`, `name`, `pos`, `ovr`, `attrs`, `age`, `years`, `salary`, `dev`, `slot`, `morale`, `injuredWeeks`, `injuryHistory`, `seasonStats`, `careerStats`, `accolades`, `nickname`, `rookieYear`. Campos transitórios: `fx`, `fxOvr` (só durante o jogo), `tmpMods` (eventos). Campos de prospect: `draftRound`, `scoutNoise`, `trait`.

---

## PARTE 8: FLUXOS PRINCIPAIS

1. **Semana da temporada:** Hub (responder eventos pendentes) → `playWeek` → `advanceWeek` (jogos, promessas, expiração de modificadores, eventos da próxima semana).
2. **Playoffs → offseason:** `advancePlayoffRound` até o campeão → offseason (contratos, FA, classe de draft, scouting reiniciado, carrossel de técnicos) → usuário contrata coordenadores, negocia e faz o draft.
3. **Virada de ano:** `advanceSeasonYear` → prêmios → arquivo → rollover de carreira + Top 100 → aposentadorias (`isRetired`) → desenvolvimento por coordenadores → novo ano.
4. **Draft:** scouting (pontos) → "Assistir ao vivo" (`liveDraftTick`, eventos) ou "Pular até minha vez" → `draftPick` (reação, revelação do OVR real) → recap.
5. **Espectador:** menu → liga sem time → `simSpectator` (1/5/10/25 temporadas ou semana a semana) → bifurcar realidades → consultar Stats/Histórico/Top 100.

---

## PARTE 9: ONDE MEXER (RECEITAS)

* **Novo atributo ou posição:** `SUB_ATTRS`, `ATTR_LABELS`, `POSITION_WEIGHTS`, `LEGACY_ATTR_MAP` (se precisar migrar), `attrLabels.js` e `nicknames.js`; depois use o atributo em `simulation.js` via `attr()`.
* **Novo evento semanal:** adicione um item a `EVENTS` em `events.js` (`id`, `category`, `weight`, `cd`, `when`, `build` com `opt(label, effects)`). Efeito novo: trate em `applyEffects` e em `chipsFor`.
* **Novo evento de draft:** `MY_TURN` ou `BETWEEN` em `draftEvents.js`. Efeitos próprios ficam em `applyDraftEffects`.
* **Novo esquema/bônus de coordenador:** `SCHEME_BONUS`, `SCHEME_META`, `SCHEME_BLURB` em `coachesGen.js` (e `schemesFor`). Se mexer no front, atualize `FRONT_BY_SCHEME`.
* **Nova estatística histórica:** `ALL_TIME_CATEGORIES` e `POS_GROUPS` em `allTime.js` (a chave deve existir em `careerStats`).
* **Nova ação de scouting:** `SCOUT_ACTIONS` e `doScout` em `fog.js`.
* **Nova tela:** crie em `screens/`, adicione o `screen === "..."` no `App.jsx` e, se for aba, no `NAV` de `ui.jsx`. No espectador, adicione também em `SPEC_NAV`.
* **Novo campo no save:** inicialize em `careerState.js` **e** em uma `ensureXxx` idempotente (saves antigos).

---

## PARTE 10: PONTOS DE ATENÇÃO

* Quando o código criar jogadores sem passar por `makePlayer`, use `rollAttrs` + `computeOvr`; nunca atribua `ovr` à mão.
* O Top 100 histórico só conhece jogadores que passaram por `careerStats`; em saves antigos, aposentados anteriores à feature não são recuperáveis (exceto os do Hall da Fama).
* `markRetiredLeaders` marca como aposentado quem não está em elenco, mercado ou draft (inclui free agents que ninguém contratou).
* O modo ao vivo do draft clona a carreira a cada escolha; se ficar pesado, mova o estado do draft para um objeto separado.
* Saves grandes (muitas temporadas simuladas) podem não caber no `localStorage`; a falha de gravação é silenciosa.
* Telas que esperam `myTeam` no espectador dependem de `SPECTATOR_STUB` ter os campos que elas leem.
* Arquivos citados aqui que não foram alterados nem revisados em detalhe nesta fase: `depth.js`, `contracts.js`, `freeAgencyAI.js`, `negotiation.js`, `trades.js`, `picks.js`, `morale.js`, `rivalries.js`, `powerRankings.js`, `weeklyRecap.js`, `teamIdentity.js`, `standings.js`, `stats.js`, `records.js`, `press.js`, `MenuScreens.jsx`.

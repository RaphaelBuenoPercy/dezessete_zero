# Documentação Completa da Arquitetura do Jogo (Gridiron GM)

Este documento atua como o manual mestre do projeto, mapeando todos os módulos do sistema, desde o motor de simulação (backend) até a renderização de telas e componentes visuais (frontend). Ele é ideal para orientar a Inteligência Artificial a realizar alterações e atualizações de forma cirúrgica na base de código.

## PARTE 1: NÚCLEO DA APLICAÇÃO E UTILITÁRIOS (`src/` e `src/lib`)

O coração do jogo, onde o estado global é gerenciado e a aplicação é montada.

* **`App.jsx`**: O controlador principal (Controller) da aplicação.
  * **Gestão de Estado e Persistência**: Armazena o estado global da carreira (`career`) e a tela atual (`screen`). Salva e carrega os dados automaticamente usando o `localStorage`.
  * **Loop do Jogo (Game Loop)**: Contém as funções vitais que avançam o tempo: `playWeek()` (simula jogos da temporada regular, atualiza morais, lesões e gera o recap), `simPlayoffRound()` (avança o mata-mata até o Super Bowl) e `advanceToNextSeason()` (distribui prêmios, aposenta jogadores e reinicia o ano).
  * **Ações do Usuário**: Intercepta cliques das telas (como aceitar troca, assinar jogador, draftar prospecto) e invoca as funções puras da *engine* para atualizar o estado (ex: `draftPick`, `proposeTrade`, `makeFreeAgentOffer`).
* **`customRosters.js`**: Arquivo de configuração de elenco. Permite injetar jogadores reais ou customizados em times específicos (ex: Tyler Shough no Saints). O motor lê essas predefinições durante a criação do *save* e completa as vagas vazias proceduralmente.
* **`main.jsx`**: Ponto de entrada padrão do React. Monta o `<App />` no DOM.
* **`lib/rng.js`**: Biblioteca de geração de números pseudo-aleatórios (PRNG). Usa o algoritmo `mulberry32` semeado (`seedFromString`). Isso é crítico: como o jogo usa *seeds*, eventos simulados na mesma semana geram resultados consistentes. Contém também ajudantes matemáticos (`clamp`, `randInt`, `pick`).

## PARTE 2: FRONTEND - TELAS E INTERFACES (`src/screens`)

Este diretório gerencia as grandes "páginas" ou fluxos da aplicação.

### 1. Dashboard Principal (`HubScreen.jsx`)
* **`HubScreen`**: Tela central. Mostra métricas de gestão (confiança do dono, apoio da torcida, moral, teto salarial) e dita o fluxo de navegação. Renderiza alertas de jogos pendentes e últimas notícias.

### 2. Mercado, Draft e Lideranças (`MarketScreens.jsx`)
* **Agência Livre**: `FreeAgencyScreen` e `FreeAgentDetailScreen` controlam a exploração e a negociação de contratos ao vivo.
* **Draft**: `DraftScreen` e `ProspectDetailScreen` controlam a visualização da classe de novatos e a escolha ("On the Clock").
* **Central de Trocas**: `TradeScreen` permite construir propostas com jogadores e picks (escolhas), exibindo balanço de valor aceito pela IA.
* **Estatísticas**: `StatsScreen` abriga as abas de Líderes da Liga, Power Rankings, Tier Lists e o Livro de Recordes.

### 3. Menus e Estado de Carreira (`MenuScreens.jsx`)
* Menus estáticos: `MenuScreen` (iniciar/carregar jogo), `NewCareerScreen` (criar nome de treinador e escolher franquia) e `FiredScreen` (Game Over por demissão).

### 4. Temporada e Experiência de Jogo (`SeasonScreens.jsx`)
* **Tabelas e Rivalidades**: `ScheduleScreen` agrupa a tabela, chaveamentos de playoffs e cartões de Rivalidades.
* **Partida e Resultados**: `ResultsScreen` lista os jogos e box scores semanais. `GameScreen` é o motor visual da partida ao vivo (campo 2D, placar e histórico lances a lances).
* **Eventos**: `HonorsScreen` (cerimônia de final de ano) e `PressModal` (coletivas de imprensa).

### 5. Gestão do Time (`TeamManagementScreens.jsx` e `TeamAndPlayer.jsx`)
* **Meu Time**: `RosterScreen` (elenco completo), `DepthChartScreen` (titulares/reservas com mapa visual), `TacticsScreen` (sliders táticos) e `ContractsScreen` (extensões e dispensas no último ano de contrato).
* **Inspeção**: `TeamDetailScreen` e `PlayerDetailScreen` fornecem visões detalhadas de outras franquias e perfil estatístico de atletas.

## PARTE 3: FRONTEND - COMPONENTES VISUAIS (`src/components`)

Contém os blocos de construção reutilizáveis da interface (UI Kit).

### 1. Base Visual e Identidade (`ui.jsx`)
* **`TeamLogo`**: Tenta importar automaticamente a imagem PNG de `src/components/logos/`. Caso o logo não exista, faz um *fallback* renderizando um escudo SVG procedural degradê com as cores oficiais.
* **Navegação e Layout**: `TopBar` (cabeçalho), `BottomNav` (barra inferior), `Card`, `Bar` e `Btn`.
* **Visualizadores de Dados**: `OvrBadge` (Overall), `AttrBars` (atributos), `PosPill` (posição) e `DevTag` (evolução).
* **Linhas de Jogadores**: `PlayerRow` e `primaryStatLine` criam as linhas compactas para listas.

## PARTE 4: BACKEND/ENGINE - TEMPORADA (`src/season`)

Controla a inteligência artificial, simulação de mercado, progressão de temporada e a narrativa.

* **Inicialização**: `careerState.js` cria o estado inicial do jogo, liga, calendário e tendências de IA.
* **Gestão da Máquina (IA)**: `depth.js` (arruma os times); `morale.js` (flutua a satisfação); `contracts.js` (renovações e dispensas da IA).
* **Mercado Dinâmico**: `freeAgencyAI.js` (avaliação de times pelos jogadores); `negotiation.js` (leilão de propostas); `trades.js` (cálculo de valor para trocas).
* **Draft e Valor**: `scouting.js` (relatórios de olheiros e decisões da IA); `picks.js` (tratamento de escolhas futuras como ativos financeiros).
* **Fim de Ano**: `legacy.js` (cálculo de prêmios e histórico); `offseason.js` (aposentadorias).
* **Narrativa**: `records.js`, `rivalries.js`, `powerRankings.js`, `weeklyRecap.js` e `teamIdentity.js` (mascotes e gritos).
* **Matemática da Liga**: `standings.js` (tabelas e playoffs); `stats.js` (cálculo de líderes).

## PARTE 5: BACKEND/ENGINE - SIMULAÇÃO (`src/engine`)

Sistemas responsáveis pela matemática em campo e geração do universo de dados.

* **Geração de Dados (`playerGen.js`)**: Criação (`makePlayer`) de atletas com atributos, nomes, idades, desenvolvimento e ajuste de Cap Space. Gera Draft e Free Agents.
* **Motor da Partida (`simulation.js`)**:
  * Simulação PBP (Play-by-play): Lida com passes (`ROUTE_CONCEPTS`), corridas (`RUN_GAPS`), pressões/blitzes (`passProtection`), leituras (pre-snap), lesões (`maybeInjure`) e gestão de relógio.
  * Simulação Rápida: Aproxima estatísticas (`quickGameStats`) para as outras 31 equipes simularem jogos instantaneamente.
* **Avaliação (`ratings.js`)**: Converte atributos de 53 atletas em Ratings unificados de Ataque/Defesa/Passe/Corrida.
* **Interatividade (`press.js`)**: Coletivas de imprensa reativas ao momento do time (ex: vitórias, zebras).
* **Sabores Visuais (`nicknames.js`)**: Determina apelidos folclóricos ("Canhão", "Sombra") com base nos atributos do atleta.

## PARTE 6: ESTRUTURA DE DADOS ESTÁTICOS (`src/data`)

Dicionários e constantes de base.

* **Listas de Geração (`names.js`)**: Arrays de nomes e sobrenomes.
* **Mapeamento Posicional (`rosterSlots.js`)**: Define elencos. Diz quem entra dependendo do esquema (3-4 vs 4-3) e mapeia os sub-atributos importes por posição (`SUB_ATTRS`).
* **Franquias Oficiais (`teams.js`)**: Dicionário imutável (`TEAM_META`) com cores, divisão, tamanho do mercado, clima, o teto salarial (`CAP`) e os astros predefinidos (`stars`).
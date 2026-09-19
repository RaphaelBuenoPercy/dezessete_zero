# Gridiron GM

Simulador de carreira de técnico de NFL: elenco, escalação, táticas, free agency,
draft, trocas, coletivas de imprensa e temporadas jogo a jogo com play-by-play.

## Rodando no VS Code

1. Abra esta pasta no VS Code (`code .`).
2. No terminal integrado, instale as dependências:
   ```bash
   npm install
   ```
3. Rode o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
4. Abra o endereço que aparecer no terminal (algo como `http://localhost:5173`).

Qualquer alteração no código em `src/App.jsx` recarrega o navegador automaticamente.

## Build de produção

```bash
npm run build
npm run preview
```

Isso gera a pasta `dist/` com um build otimizado, que você pode hospedar em
qualquer serviço de arquivos estáticos (Vercel, Netlify, GitHub Pages, etc.).

## Estrutura

- `src/App.jsx` — todo o jogo: dados dos times, geração de elenco, motor de
  simulação jogada a jogada, e todas as telas (React, um arquivo só por
  simplicidade — fique à vontade pra separar em módulos menores).
- `src/main.jsx` — ponto de entrada, só monta `<App />` na página.
- `index.html` — carrega o Tailwind via CDN (`cdn.tailwindcss.com`) para
  simplicidade. Se quiser um build "de verdade" do Tailwind (com purge,
  plugins, etc.), instale `tailwindcss` normalmente e troque essa tag de
  script por um `@import "tailwindcss"` no seu CSS.

## Salvamento

O progresso é salvo no `localStorage` do navegador (por isso funciona
offline e sem backend). Se limpar os dados do site, as carreiras salvas
somem.

## Avisos sobre o conteúdo

- Nomes de jogadores e times reais são usados como sabor de ambientação;
  os elencos são aproximados/gerados e não refletem transações recentes.
  Projeto independente, sem afiliação com a NFL.
- É uma simulação propositalmente simplificada (não é uma réplica 1:1 das
  regras da NFL): esquemas defensivos são fixos por time (4-3 ou 3-4,
  sorteado na criação da liga), não trocáveis a meio de temporada.

## Ideias pra expandir

- Múltiplos slots de treino/desenvolvimento por jogador jovem.
- Lesões com efeito mais granular por posição.
- Box score detalhado por jogador (jardas, TDs) após cada jogo.
- Alternar esquema defensivo como decisão de offseason.

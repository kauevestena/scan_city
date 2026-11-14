# Plano de Execução — Tarefas de Implementação

> Lista **ordenada** de tarefas para o agente implementador. Cada tarefa é uma fatia autocontida: pode ser implementada, testada e verificada isoladamente, desde que suas dependências estejam concluídas. Siga o protocolo do [README](README.md) e a [constitution](constitution.md).

## Como ler cada tarefa

| Campo | Significado |
| :--- | :--- |
| **Fase / Depende de** | Fase do plano e tarefas que precisam estar ✅ antes |
| **REQs** | Requisitos de [requirements.md](requirements.md) que a tarefa implementa, total ou parcialmente (*parc.*) |
| **Spec** | Seções que **devem** ser lidas antes de começar |
| **Arquivos** | Arquivos a criar (+) ou modificar (~) |
| **Passos** | Ordem recomendada de implementação |
| **Aceite** | Critérios verificáveis. Todos precisam estar marcados para concluir |
| **Verificação** | Comandos e checagem manual obrigatórios, **além** do `npm run verify` (DoD) |

**Status:** ☐ pendente · ◐ em andamento · ✅ concluída · ⛔ bloqueada (ver [open-questions.md](open-questions.md)).

## Fases e marcos

| Fase | Nome | Tarefas | Marco ao final |
| :--- | :--- | :--- | :--- |
| F0 | Fundação | T001–T009 | **M0** — projeto roda, navega entre telas-shell, input/áudio/save funcionam |
| F1 | Domínio puro | T010–T019 | Toda a matemática testada com golden values |
| F2 | Vertical Slice | T020–T027 | **M1** — C00 jogável de ponta a ponta: escritório → mapa → campo → voo → processamento → museu |
| F3 | Voo completo | T028–T036 | **M2** — motor 2.5D com todos os sistemas |
| F4 | Campo & mundo | T037–T040 | Mini-games, veículos e eventos |
| F5 | Processamento & produtos | T041–T044 | Visualizador completo, LiDAR, Van |
| F6 | Progressão | T045–T051 | Loja, skills, equipe, Atlas, cosméticos, museu e rival |
| F7 | Conteúdo | T052–T071 | **M3** — 7 contratos reais + 11 fendas + campanha |
| F8 | Mesa & Laboratório | T072–T074 | Museu completo e os 4 infográficos |
| F9 | Polimento | T075–T079 | **M4** — release: zero placeholders, performance, acessibilidade |

## Grafo de dependências (resumo)

```
T001 → T002 → T003 → {T004, T005} → T006 → T007 → {T008, T009}                     (F0)
T003 → T010 → {T011, T012} → T013 → T014 → T015 → T016 → T017 → T018 → T019        (F1, sequencial por simplicidade)
F0+F1 → T020 → T021 → T022 → T023 → T024 → T025 → T026 → T027                       (F2)
T027 → F3 (T028…T036, em ordem) → F4 → F5 → F6 → F7 → F8 → F9
```

O paralelismo é possível em F6, F7 e F8. Nesse caso, respeite os campos "Depende de".

---

# F0 — Fundação

### T001 — Bootstrap do projeto
- **Fase:** F0 · **Depende de:** — · **REQs:** REQ-NFR-002, REQ-NFR-003 (*parc.*: config), REQ-NFR-006 (*parc.*: script), REQ-NFR-009
- **Spec:** [constitution §1, §3](constitution.md), [architecture §1, §1.1, §8](design/architecture.md)
- **Arquivos:**
  - \+ `package.json`, `vite.config.ts`, `vitest.config.ts`, `playwright.config.ts`, `tsconfig*.json`, `eslint.config.js`, `.prettierrc`, `index.html`
  - \+ `src/main.tsx`, `src/App.tsx`, `src/index.css`, `src/vite-env.d.ts`
  - \+ `scripts/check-placeholders.mjs`, `scripts/check-assets.mjs`
  - \+ `tests/e2e/boot.spec.ts`
- **Passos:**
  1. Criar o projeto Vite `react-ts`. Instalar `react`, `react-dom`, `zustand` e `lucide-react`, e as devDependencies listadas em [architecture §8](design/architecture.md), mais `tailwindcss`, `@tailwindcss/vite`, `eslint`, `typescript-eslint`, `eslint-plugin-react-hooks`, `prettier` e `@vitejs/plugin-react`.
  2. Configurar o TS `strict` com `noUncheckedIndexedAccess` e o alias `@/`.
  3. Configurar o Tailwind v4 (`@import "tailwindcss";`) e o Vitest (jsdom, setup com `@testing-library/jest-dom` e `vitest-canvas-mock`, thresholds de cobertura em `src/domain/**` e `src/lib/**` ≥ 90 %, global ≥ 60 %).
  4. Configurar o Playwright (Chromium, `webServer: npm run build && npm run preview`).
  5. Criar os scripts npm de [architecture §1.1](design/architecture.md).
  6. Criar o `App` com uma tela de boot real: título "Scan City", versão de `package.json` e fundo `slate-950`.
  7. Escrever `check-placeholders.mjs` (grep de `TODO|FIXME|XXX` em `src/`, sai com código 1 se encontrar) e `check-assets.mjs` (lista `dist/`, falha em extensões proibidas).
- **Aceite:**
  - [x] `npm run dev` abre a página com o título.
  - [x] `npm run verify` passa (com um teste trivial de `App`).
  - [x] `npm run e2e` passa com `boot.spec.ts` (o título está visível).
  - [x] `npm run check:assets` passa após o build.
- **Verificação:** `npm run verify && npm run e2e && npm run check:assets`
- **Status:** ✅

### T002 — Bibliotecas base (`lib/`)
- **Fase:** F0 · **Depende de:** T001 · **REQs:** REQ-CORE-006 (*parc.*), REQ-NFR-008
- **Spec:** [constitution §2.3–2.4](constitution.md), [architecture §1](design/architecture.md)
- **Arquivos:** \+ `src/lib/rng.ts`, `src/lib/math.ts`, `src/lib/format.ts` e os testes de cada um.
- **Passos:**
  1. `rng.ts`:
     - `mulberry32(seed)` retornando `{ next(): number; int(min,max); range(min,max); normal(); pick(arr); shuffle(arr); fork(label) }`;
     - `hashString(s)` (FNV-1a 32 bits);
     - `hash2(ix, iy, seed)`.
  2. `math.ts`: `clamp`, `lerp`, `invLerp`, `remap`, `smoothstep`, `degToRad`, `radToDeg`, `vec2`/`vec3` (add, sub, scale, dot, cross, len, norm) e `mod`.
  3. `format.ts`:
     - `formatBRL(cents)` → "R$ 12.345,67";
     - `formatNumber(n, decimals)`;
     - `formatPct`;
     - `formatDuration(s)` → "mm:ss";
     - `formatCm(m)`, `formatUm(m)`, `formatMm(m)`;
     - `formatDistance(m)` → "1,2 km" / "340 m".
- **Aceite:**
  - [ ] O mesmo `seed` produz a mesma sequência de 1.000 valores.
  - [ ] `normal()` tem média ≈ 0 e desvio ≈ 1 em 10.000 amostras (tolerância de 0,05).
  - [ ] `fork('x')` é determinístico e independente do consumo do pai.
  - [ ] `formatBRL(1234567) === 'R$ 12.345,67'` (normalizando o espaço não separável do Intl).
  - [ ] Cobertura de `lib/` ≥ 90 %.
- **Verificação:** `npx vitest run src/lib --coverage`
- **Status:** ☐

### T003 — Tipos canônicos
- **Fase:** F0 · **Depende de:** T002 · **REQs:** — (fundação para todos)
- **Spec:** [data-model](design/data-model.md) (completo)
- **Arquivos:** \+ `src/types/{basics,catalog,progression,contracts,world,mission,report,save}.ts`, `src/types/index.ts`
- **Passos:**
  1. Transcrever **exatamente** as interfaces e unions de [data-model](design/data-model.md).
  2. Exportar tudo de `index.ts`.
  3. Criar um teste de tipos (`expectTypeOf` do Vitest) para 3 objetos de exemplo (Contract, SaveGame, Shot).
- **Aceite:**
  - [ ] `npm run typecheck` passa.
  - [ ] Nenhum `any`.
  - [ ] Os nomes batem com o data-model.
- **Verificação:** `npm run typecheck && npx vitest run src/types`
- **Status:** ☐

### T004 — Tokens visuais e kit de UI
- **Fase:** F0 · **Depende de:** T003 · **REQs:** REQ-UI-001, REQ-UI-002, REQ-UI-004, REQ-UI-005, REQ-NFR-004 (*parc.*), REQ-NFR-007 (*parc.*: foco)
- **Spec:** [ui-style](design/ui-style.md) (completo)
- **Arquivos:** \+ `src/ui/tokens.ts`, `src/ui/{Panel,Button,Slider,Tabs,Modal,ConfirmDialog,Toast,ToastHost,Stat,Gauge,ProgressBar,ChecklistItem,Tooltip,EmblemBadge,MoneyText,DialogueBox}.tsx`, `src/ui/index.ts`, `src/app/UiKitGallery.tsx` e os testes. ~ `src/index.css` (`@theme`).
- **Passos:**
  1. Definir os tokens no CSS e em `tokens.ts`.
  2. Implementar cada componente com as props de [ui-style §2](design/ui-style.md).
     - O `Modal` usa focus trap simples: ciclar o Tab entre os focáveis e restaurar o foco ao fechar.
     - O `ToastHost` lê a fila de uma store local temporária, que é migrada para o `sessionSlice` em T005.
     - O `DialogueBox` tem máquina de escrever a 40 car/s; um clique completa ou avança.
     - O `InputGlyph` ainda não existe; o `Button.glyph` fica opcional e é ligado em T008.
  3. Criar a galeria `UiKitGallery` com todos os estados, acessível via `?screen=UIKIT`. O `App` lê o query param diretamente; em T005 isso passa para o debugFlags.
- **Aceite:**
  - [ ] Todos os 16 componentes renderizam na galeria.
  - [ ] Testes RTL: `Slider` (teclado ←/→ altera o valor, limites), `Modal` (Esc fecha quando `dismissable`, foco preso), `ToastHost` (máximo 4, expira em 4 s com timers falsos), `DialogueBox` (avanço).
  - [ ] Nenhuma cor hex fora de `tokens.ts`/`index.css`, conferido com `grep -rnE "#[0-9a-fA-F]{6}" src/ui src/app`, que deve achar só o arquivo de tokens.
- **Verificação:** `npx vitest run src/ui` · manual: abrir `/?screen=UIKIT`.
- **Status:** ☐

### T005 — Store, máquina de estados, roteador e flags de debug
- **Fase:** F0 · **Depende de:** T004 · **REQs:** REQ-CORE-001, REQ-CORE-002, REQ-CORE-003 (*parc.*: overlay), REQ-CORE-007, REQ-UI-004
- **Spec:** [architecture §2, §3, §7](design/architecture.md)
- **Arquivos:**
  - \+ `src/state/store.ts`, `src/state/machine.ts`, `src/state/slices/*.ts` (todas as slices com estado e ações básicas; os detalhes vêm nas tarefas de cada sistema), `src/state/selectors.ts`
  - \+ `src/app/{ScreenRouter,PauseOverlay,DebugScreenShell,debugFlags}.ts(x)`
  - ~ `App.tsx`
- **Passos:**
  1. Implementar `SCREEN_TRANSITIONS` (T1–T16), `canTransition` e `InvalidTransitionError`.
  2. `sessionSlice.goTo` com hooks `onExit`/`onEnter` (um registro simples) e os toasts migrados.
  3. `ScreenRouter`: mapeia `ScreenId → componente`. Telas sem implementação usam o `DebugScreenShell`, que mostra o nome da tela, o payload em JSON e um botão por transição válida (chamando `goTo` com um payload mínimo de teste).
  4. `PauseOverlay` (por enquanto: Continuar), aberto pela tecla Esc via listener simples. Em T008, passa ao `InputManager`.
  5. `debugFlags.ts`: parse de `debug`, `seed`, `screen`, `contract`, `autopilot`, `unlockAll`, `money` e `skipIntro`. `screen=UIKIT|SOUNDBOARD` roteia para as galerias.
- **Aceite:**
  - [ ] Teste de tabela: todas as 16 transições aceitas, e todas as outras combinações (42 − 16 = 26) rejeitadas.
  - [ ] Em `DEV` lança erro, e em `PROD` (mock de `import.meta.env`) faz `console.warn` sem mudar a tela.
  - [ ] É possível navegar por todas as telas pelo shell.
  - [ ] O overlay de pausa aparece com Esc e congela `session.paused`.
- **Verificação:** `npx vitest run src/state src/app` · E2E: `tests/e2e/navigation.spec.ts` (percorre T1→T15 pelo shell com `?debug=1`).
- **Status:** ☐

### T006 — Persistência, migrações e novo jogo
- **Fase:** F0 · **Depende de:** T005 · **REQs:** REQ-CORE-004, REQ-CORE-005, REQ-CORE-009 (*parc.*: lógica)
- **Spec:** [architecture §6](design/architecture.md), [progression §3, §13](features/progression.md), [data-model §8](design/data-model.md)
- **Arquivos:** \+ `src/state/{persistence,migrations,initialState}.ts` e os testes · ~ `store.ts` (`persist` com `partialize`, storage customizado) · ~ `App.tsx` (autosave a cada 30 s + `beforeunload`)
- **Passos:**
  1. `createNewGame()` com os valores de [progression §3](features/progression.md). Os IDs de contratos ainda não existem: usar `Record` vazio, preenchido em T022 por `refreshUnlocks`.
  2. `validateSave(obj)`: validador manual dos campos obrigatórios e dos tipos.
  3. `loadSave()`:
     - JSON inválido ou schema inválido → backup + novo jogo + toast;
     - versão menor → migrações;
     - versão maior → trata como inválido.
  4. Settings em uma chave separada.
  5. Autosave:
     - subscription com debounce de 1 s nas mudanças de `screen`;
     - intervalo de 30 s não pausado;
     - `beforeunload`.
  6. Ação `newGame()`: backup, reset e `goTo` forçado para `OFFICE`. A UI vem em T075.
- **Aceite:**
  - [ ] Testes: round-trip save/load; JSON truncado → backup criado + novo jogo; campo ausente → idem; migração fictícia v0→v1 (registrar `MIGRATIONS[0]` de teste); settings sobrevivem ao `newGame`.
  - [ ] E2E: mudar o saldo via debug (`?money=12345`), recarregar e conferir que persistiu.
- **Verificação:** `npx vitest run src/state` · `npx playwright test tests/e2e/persistence.spec.ts`
- **Status:** ☐

### T007 — Game loop, Canvas e FPS
- **Fase:** F0 · **Depende de:** T006 · **REQs:** REQ-CORE-008, REQ-CORE-003 (*parc.*: congelar loops), REQ-NFR-001 (*parc.*: medição)
- **Spec:** [architecture §4](design/architecture.md)
- **Arquivos:** \+ `src/engines/loop.ts`, `src/engines/canvas.ts`, `src/engines/useGameLoop.ts`, `src/engines/useCanvas.ts`, `src/app/FpsOverlay.tsx` e os testes.
- **Passos:**
  1. `GameLoop` com rAF injetável (para testes), clamp de `dt`, sub-passos, `timeScale` e pausa.
  2. `useCanvas`: DPR e ResizeObserver, retornando o tamanho lógico.
  3. `useGameLoop` ligado a `session.paused`.
  4. `FpsOverlay` (`?debug=1` ou `settings.showFps`).
  5. Demonstração: uma cena de teste no `DebugScreenShell` desenha um quadrado girando no Canvas.
- **Aceite:**
  - [ ] Teste com rAF falso: `dt = 0,2 s` vira clamp de 0,05 s e 3 sub-passos (com `stepS = 1/60`).
  - [ ] `timeScale = 4` multiplica os sub-passos.
  - [ ] Pausado = 0 updates e 1 render.
  - [ ] O canvas mantém a nitidez em DPR 2 (largura do buffer = 2 × CSS).
- **Verificação:** `npx vitest run src/engines`
- **Status:** ☐

### T008 — Sistema de input unificado
- **Fase:** F0 · **Depende de:** T007 · **REQs:** REQ-INP-001 a REQ-INP-006
- **Spec:** [input](design/input.md) (completo)
- **Arquivos:** \+ `src/input/{actions,bindings,InputManager,gamepad,InputGlyph,useFocusNavigation,useInputContext}.ts(x)` e os testes · ~ `Button` (glyph), `Modal` (contexto UI + foco), `App` (attach), `PauseOverlay` (ação PAUSE)
- **Passos:**
  1. Bindings conforme a tabela de [input §2](design/input.md), com contextos.
  2. `InputManager` com poll de gamepads, deadzone e borda, e dispositivo ativo com subscribers.
  3. `detectFamily` e toast de conexão.
  4. `InputGlyph`, inclusive na galeria UIKIT, com seletor de dispositivo forçado.
  5. `useFocusNavigation`, com navegação espacial e repetição.
  6. Ligar o `PAUSE` global.
- **Aceite:**
  - [ ] Testes do [input §6](design/input.md), 6 casos.
  - [ ] Na galeria, o glyph troca ao apertar uma tecla ou um botão de controle real (verificação manual com controle, se disponível).
  - [ ] Os modais navegam com as setas e fecham com Esc.
- **Verificação:** `npx vitest run src/input` · manual: `/?debug=1&screen=UIKIT`.
- **Status:** ☐

### T009 — Áudio procedural
- **Fase:** F0 · **Depende de:** T008 · **REQs:** REQ-AUD-001, REQ-AUD-002, REQ-AUD-003 (*parc.*: API)
- **Spec:** [audio](design/audio.md) (completo)
- **Arquivos:** \+ `src/audio/{AudioEngine,sfx,envelope}.ts`, `src/app/SoundBoard.tsx` e os testes · ~ `App` (unlock no 1º gesto, aplicar volumes das settings) · ~ `Button` (`UI_CLICK`)
- **Passos:**
  1. Grafo de nós, envelope, buffer de ruído e limite de vozes.
  2. Todas as receitas de [audio §3](design/audio.md).
  3. Loops com `LoopHandle`.
  4. SoundBoard (`?debug=1&screen=SOUNDBOARD`).
- **Aceite:**
  - [ ] Testes do [audio §5](design/audio.md), 5 casos.
  - [ ] Todos os sons tocam no SoundBoard (manual: ouvir e conferir que soam distintos e sem cliques estourados).
- **Verificação:** `npx vitest run src/audio` · manual: SoundBoard.
- **Status:** ☐

> **Marco M0:** `npm run verify && npm run e2e` verdes; navegação por shell, input, áudio e save funcionando.

---

# F1 — Domínio puro (TDD com golden values)

### T010 — Catálogo de dados
- **Fase:** F1 · **Depende de:** T003 · **REQs:** REQ-PRG-002 (*parc.*: dados), REQ-PRG-003 (*parc.*), REQ-PRG-004 (*parc.*), REQ-PRG-005 (*parc.*), REQ-PRG-008 (*parc.*), REQ-PRG-013 (*parc.*)
- **Spec:** [catalog §1–§11](content/catalog.md)
- **Arquivos:** \+ `src/data/catalog/{sensors,lenses,payloads,aircraft,vehicles,fieldEquipment,hardware,staff}.ts`, `src/data/{skills,cosmetics,souvenirs,strings}.ts`, `src/data/catalog/catalog.test.ts`
- **Passos:**
  1. Transcrever as tabelas, com preços em centavos.
  2. Escrever as histórias dos souvenirs (1–2 frases).
  3. Criar os testes de integridade.
- **Aceite:**
  - [ ] IDs únicos.
  - [ ] Toda referência cruzada existe: `compatibleAircraft`, `compatibleSensors`, `rgbSensorId`, `requires` das skills, cosméticos com `unlock` válido.
  - [ ] Pixel pitch calculado bate com a coluna "Pixel (µm)" (tolerância de 0,5 %).
  - [ ] Cada ramo de skills tem 4 nós que somam 6 pontos.
- **Verificação:** `npx vitest run src/data`
- **Status:** ☐

### T011 — Fotogrametria
- **Fase:** F1 · **Depende de:** T010 · **REQs:** REQ-FLD-007 (*parc.*), REQ-FLT-008 (*parc.*), REQ-FLT-017 (*parc.*), REQ-LAB-005 (*parc.*)
- **Spec:** [domain-math §1, §2](design/domain-math.md)
- **Arquivos:** \+ `src/domain/photogrammetry.ts` + teste
- **Passos:** escrever primeiro os testes G1–G7, G10, G11 e G13. Depois, implementar todas as funções de §1 e §2.
- **Aceite:**
  - [ ] Golden values G1–G7, G10, G11 e G13 passam.
  - [ ] Propriedade: `gsd` é linear em H (teste com 3 alturas).
  - [ ] `blurClass` nos limites 0,5 e 1,0.
  - [ ] `obliqueFootprint` limita θ + α/2 a 85°.
  - [ ] Cobertura ≥ 95 %.
- **Verificação:** `npx vitest run src/domain/photogrammetry --coverage`
- **Status:** ☐

### T012 — LiDAR e estereoscopia
- **Fase:** F1 · **Depende de:** T011 · **REQs:** REQ-FLT-009 (*parc.*), REQ-LAB-002 (*parc.*), REQ-LAB-003 (*parc.*)
- **Spec:** [domain-math §3, §4](design/domain-math.md)
- **Arquivos:** \+ `src/domain/lidar.ts`, `src/domain/stereo.ts` + testes
- **Aceite:**
  - [ ] G8, G9, G14, G15 e G16 passam.
  - [ ] A identidade da paralaxe vale (1e-9) para 50 combinações aleatórias seedadas.
  - [ ] `lidarRmseZ`/`XY` seguem as fórmulas (3 casos).
- **Verificação:** `npx vitest run src/domain/lidar src/domain/stereo`
- **Status:** ☐

### T013 — Dinâmica de voo e energia (puro)
- **Fase:** F1 · **Depende de:** T012 · **REQs:** REQ-FLT-004 (*parc.*), REQ-FLT-013 (*parc.*), REQ-FLT-014 (*parc.*), REQ-FLT-016 (*parc.*)
- **Spec:** [domain-math §5, §7](design/domain-math.md)
- **Arquivos:** \+ `src/domain/flightPhysics.ts`, `src/domain/energy.ts` + testes
- **Passos:**
  1. Definir `AircraftState`, `FlightInput` e `FlightEnv` (tipos locais exportados).
  2. Implementar `stepAircraft` com todos os limites.
  3. `terrainFollowTargetAlt` recebe uma função `elevationAlong(s)` (sem acoplar ao sampler).
- **Aceite:**
  - [ ] G12 (crab) e G17 (sombras) passam.
  - [ ] A velocidade nunca sai de [vMin, vMax], em 1.000 passos aleatórios.
  - [ ] Asa fixa com `MOVE_X = 1` respeita `aLat ≤ v²/R`.
  - [ ] TF sobre uma rampa de 30 % mantém o AGL dentro de ±15 %.
  - [ ] `drainPerSecond` no cruzeiro sem vento = 1/endurance.
  - [ ] `BLIZZARD_DRAIN` dobra o dreno.
  - [ ] `rthRequired` dispara no limiar.
- **Verificação:** `npx vitest run src/domain/flightPhysics src/domain/energy`
- **Status:** ☐

### T014 — Planejador de voo
- **Fase:** F1 · **Depende de:** T013 · **REQs:** REQ-FLD-008 (*parc.*), REQ-FLD-012 (*parc.*), REQ-FLD-013 (*parc.*)
- **Spec:** [domain-math §2.6](design/domain-math.md), [field-setup §5.3, §5.5](features/field-setup.md)
- **Arquivos:** \+ `src/domain/flightPlanner.ts` + teste
- **Passos:**
  1. `buildFlightPlan(params, contract, catalog): FlightPlan`: linhas centradas, zigue-zague, lead-in/out, malha cruzada e LiDAR primário.
  2. `validatePlan(plan, inventory): PlanValidation`.
  3. `defaultPlanParams(contract, inventory)`.
- **Aceite:**
  - [ ] G23 (C00) passa: 6 linhas, 96 fotos, 231,45 s.
  - [ ] A malha cruzada gera as linhas perpendiculares (contagem igual à soma).
  - [ ] As linhas alternam a direção.
  - [ ] `validatePlan` cobre os 5 bloqueios.
  - [ ] Teste de propriedade: aumentar q nunca reduz o nº de linhas.
- **Verificação:** `npx vitest run src/domain/flightPlanner`
- **Status:** ☐

### T015 — Geometria e cobertura
- **Fase:** F1 · **Depende de:** T014 · **REQs:** REQ-FLD-004 (*parc.*), REQ-PRC-007 (*parc.*)
- **Spec:** [domain-math §6.6, §9](design/domain-math.md)
- **Arquivos:** \+ `src/domain/geometry.ts`, `src/domain/coverage.ts` + testes
- **Aceite:**
  - [ ] O casco convexo de um quadrado com ponto interno retorna 4 vértices.
  - [ ] A colinearidade de pontos alinhados é < 1e-6, e a de um quadrado é ≈ 1.
  - [ ] A rasterização de uma pegada que cobre exatamente 1/4 da AOI marca ≈ 1/4 das células (± 2 %).
  - [ ] 5 pegadas sobrepostas na mesma área dão células verdes.
  - [ ] Células de água são excluídas.
  - [ ] Fotos borradas e de névoa (RGB) não contam.
- **Verificação:** `npx vitest run src/domain/geometry src/domain/coverage`
- **Status:** ☐

### T016 — Acurácia e normas cartográficas
- **Fase:** F1 · **Depende de:** T015 · **REQs:** REQ-PRC-004 (*parc.*), REQ-PRC-005 (*parc.*), REQ-PRC-006 (*parc.*)
- **Spec:** [domain-math §6, §8](design/domain-math.md)
- **Arquivos:** \+ `src/domain/accuracy.ts`, `src/domain/standards.ts` + testes
- **Aceite:**
  - [ ] G18 e G25 passam.
  - [ ] Cada linha da tabela de multiplicadores (§6.3) tem um teste.
  - [ ] `generateResiduals` reproduz exatamente o RMSE-alvo dos CPs (1e-9) e é determinístico por seed.
  - [ ] Sem CPs, usa GCP × 1,8.
  - [ ] `classifyPec` retorna 'FORA' quando nenhuma classe passa.
  - [ ] A regra dos 90 % ≤ PEC é testada com 1 ponto fora em 10.
- **Verificação:** `npx vitest run src/domain/accuracy src/domain/standards`
- **Status:** ☐

### T017 — Terreno procedural (framework + bioma do tutorial) e acessibilidade
- **Fase:** F1 · **Depende de:** T016 · **REQs:** REQ-CORE-006, REQ-FLD-001 (*parc.*), REQ-FLD-003 (*parc.*)
- **Spec:** [terrain](design/terrain.md), [architecture §5](design/architecture.md), [catalog §5](content/catalog.md)
- **Arquivos:** \+ `src/world/terrain/{noise,TerrainSampler,objects,spatialHash,distanceField}.ts`, `src/world/terrain/biomes/ruralTutorial.ts`, `src/domain/accessibility.ts` + testes
- **Passos:**
  1. Ruído e o kit de ruído.
  2. `createTerrain(contract)` com memoização e as consultas de [architecture §5](design/architecture.md).
  3. A receita `RURAL_TUTORIAL`.
  4. `isAccessible(u, v, sampler, vehicles, rules)` e `snapToAccessible(p, …, maxR = 30)`.
- **Aceite:**
  - [ ] Determinismo: dois `createTerrain` com a mesma seed → mesmas amostras em 1.000 pontos e mesmos objetos.
  - [ ] `elevation` custa < 2 µs/chamada (benchmark Vitest: 100.000 chamadas em < 200 ms).
  - [ ] `distanceToRoad` é 0 sobre a estrada.
  - [ ] `isAccessible` retorna cada motivo em pontos construídos para isso (água do açude, telhado da casa, longe da estrada com FOOT_BIKE).
- **Verificação:** `npx vitest run src/world src/domain/accessibility`
- **Status:** ☐

### T018 — Requisitos, avaliação da missão e volumetria
- **Fase:** F1 · **Depende de:** T017 · **REQs:** REQ-FLD-009 (*parc.*), REQ-PRC-009 (*parc.*: score), REQ-PRC-013 (*parc.*), REQ-FLT-024 (*parc.*: avaliação de features)
- **Spec:** [domain-math §10, §11](design/domain-math.md)
- **Arquivos:** \+ `src/domain/{requirements,mission,volumetrics,features}.ts` + testes
- **Passos:**
  1. `predictRequirements`.
  2. `evaluateRequirements`.
  3. `evaluateMission`, que compõe cobertura, acurácia, normas, volumetria e score. O cálculo do pagamento chega por injeção de dependência (`deps.computePayment`), porque é implementado em T019. Nos testes desta tarefa, use um *stub* de teste.
  4. `capturedFeatures(mission, sampler)`.
- **Aceite:**
  - [ ] G22 (cone) passa.
  - [ ] Cenário golden: uma missão sintética do C00 (shots gerados pelo plano de referência, sem ruído) é aprovada com score ≥ 0,85.
  - [ ] Com só 2 GCPs, o requisito `MIN_GCP(3)` (MAJOR) falha: a missão continua aprovada, com o fator ×0,85 no `qualityFactor` e o multiplicador `gcpCount` aplicado.
  - [ ] Cada `check.type` é avaliado em ao menos 1 teste.
- **Verificação:** `npx vitest run src/domain/requirements src/domain/mission src/domain/volumetrics src/domain/features`
- **Status:** ☐

### T019 — Economia, progressão, modificadores, museu, rival e eventos
- **Fase:** F1 · **Depende de:** T018 · **REQs:** REQ-PRG-001, REQ-PRG-006, REQ-PRG-007 (*parc.*), REQ-PRG-009 (*parc.*), REQ-PRG-011 (*parc.*), REQ-PRG-012 (*parc.*), REQ-CNT-003 (*parc.*), REQ-CNT-005 (*parc.*), REQ-WLD-006 (*parc.*)
- **Spec:** [domain-math §12, §13](design/domain-math.md), [progression](features/progression.md)
- **Arquivos:** \+ `src/domain/{economy,progression,modifiers,museum,rival,fieldEvents}.ts` + testes
- **Aceite:**
  - [ ] G19, G20, G21 e G24 passam.
  - [ ] `canBuy`, com todas as razões.
  - [ ] `addXp` com múltiplos níveis.
  - [ ] `applyModifiers` cumulativo.
  - [ ] `evaluateUnlock`, recursivo.
  - [ ] Roubo e retorno.
  - [ ] Replay a 0,4.
  - [ ] `rollFieldEvent` determinístico, respeitando o cooldown e o veículo.
  - [ ] `offlineIncome` limitada a 2 h.
- **Verificação:** `npx vitest run src/domain --coverage` (≥ 90 % em `domain/`)
- **Status:** ☐

---

# F2 — Vertical Slice (C00 de ponta a ponta)

### T020 — TopBar e Escritório v1
- **Fase:** F2 · **Depende de:** T019, T009 · **REQs:** REQ-OFF-001 (*parc.*: render + 4 hotspots), REQ-OFF-002, REQ-OFF-007, REQ-UI-003
- **Spec:** [office](features/office.md) §3–§5 (Porta, Mesa, Laboratório, Workstation; intro), [ui-style §3](design/ui-style.md)
- **Arquivos:** \+ `src/app/TopBar.tsx`, `src/engines/office/{OfficeRenderer,hotspots}.ts`, `src/data/office.ts`, `src/screens/office/{OfficeScreen,WorkstationPanel,IntroSequence}.tsx` + testes
- **Passos:**
  1. A TopBar.
  2. O renderer da sala, com **todos** os móveis desenhados.
  3. Hotspots interativos só para Porta, Mesa, Laboratório e Workstation. Os demais móveis ficam visíveis, mas sem botão (ganham interação nas tarefas F6).
  4. Workstation v1: só a aba Fila.
  5. A intro.
- **Aceite:**
  - [ ] Os critérios 1, 3 e 5 de [office §8](features/office.md), estes últimos restritos aos 4 hotspots.
  - [ ] A TopBar mostra saldo, nível/XP, reputação e renda (0).
- **Verificação:** `npx vitest run src/screens/office src/app` · E2E `office.spec.ts` (intro → porta).
- **Status:** ☐

### T021 — Mapa-múndi v1
- **Fase:** F2 · **Depende de:** T020 · **REQs:** REQ-WLD-001, REQ-WLD-002 (*parc.*: a pé), REQ-WLD-003 (*parc.*), REQ-WLD-007
- **Spec:** [world-map §5.1–§5.3](features/world-map.md)
- **Arquivos:** \+ `src/data/overworld/map.ts`, `src/world/overworld/{tiles,pathfinding}.ts`, `src/engines/overworld/{OverworldEngine,tileRenderer,avatar,camera,minimap}.ts`, `src/screens/world/WorldMapScreen.tsx` + testes
- **Passos:**
  1. Desenhar o **mapa ASCII completo** (160 × 100) com o layout macro inteiro, incluindo todos os marcadores 0–6 e a–k e os cinturões A/%.
  2. Renderizar os chunks estáticos e as camadas animadas.
  3. Avatar a pé, colisão por eixo e câmera.
  4. Minimapa.
  5. Interação com a porta da sede.
- **Aceite:**
  - [ ] Os testes de mapa (dimensões, legenda) e de BFS para **todos** os marcadores × veículos passam, inclusive os 4x4-only.
  - [ ] O avatar anda com WASD/setas/analógico e para nos tiles bloqueados com a dica.
  - [ ] Entrar na sede volta ao `OFFICE`.
  - [ ] ≥ 58 FPS (overlay).
- **Verificação:** `npx vitest run src/world src/engines/overworld` · manual: andar pelo mapa todo com `?debug=1`.
- **Status:** ☐

### T022 — Contratos: schema, C00 e briefing
- **Fase:** F2 · **Depende de:** T021 · **REQs:** REQ-CNT-001 (*parc.*: C00), REQ-CNT-007 (*parc.*), REQ-WLD-005, REQ-WLD-008
- **Spec:** [contracts-real §2, C00](content/contracts-real.md), [world-map §5.4](features/world-map.md)
- **Arquivos:** \+ `src/data/contracts/{real,index,schema.test}.ts` (só C00 por enquanto), `src/screens/world/{BriefingModal,MarkerLayer}.tsx`, `src/data/contracts/viability.test.ts` · ~ `contractsSlice` (`refreshUnlocks` real) · ~ `initialState`
- **Passos:**
  1. Objeto do C00 com o plano de referência.
  2. Teste de schema e teste de **viabilidade** genérico, que roda para todos os contratos em `index.ts` ([contracts-real §2](content/contracts-real.md)).
  3. Marcadores com status.
  4. Briefing completo (disponível, bloqueado, roubado, replay).
  5. Aceitar → `startMission` → `FIELD_SETUP`. A contraproposta do rival entra em T051.
- **Aceite:**
  - [ ] A viabilidade do C00 passa.
  - [ ] O critério 1 de [world-map §8](features/world-map.md) passa.
  - [ ] Testes RTL do briefing nos 4 estados.
- **Verificação:** `npx vitest run src/data/contracts src/screens/world`
- **Status:** ☐

### T023 — Planejamento de campo v1
- **Fase:** F2 · **Depende de:** T022 · **REQs:** REQ-FLD-001, REQ-FLD-002 (*parc.*: Estação Total), REQ-FLD-003 (*parc.*: a pé), REQ-FLD-004, REQ-FLD-005, REQ-FLD-006, REQ-FLD-007, REQ-FLD-008, REQ-FLD-009, REQ-FLD-013
- **Spec:** [field-setup](features/field-setup.md) §3, §4, §5.1–§5.3, §5.5 (a aba 3 fica para T037/T038)
- **Arquivos:** \+ `src/engines/field/SatelliteRenderer.ts`, `src/screens/field/{FieldSetupScreen,GroundPointsTab,FlightPlanTab,ChecklistTab,PlanStats}.tsx` + testes · ~ `missionSlice`
- **Passos:**
  1. Raster de satélite e overlays, com pan e zoom.
  2. Aba 1 completa, exceto o toggle de instrumento, que é feito em T039.
  3. Aba 2 completa para as aeronaves possuídas. Os toggles de modos aparecem só se suportados: com Atlas, nenhum.
  4. Aba 4: checklist e decolagem.
  5. A aba 3 (Calibração) **não** é renderizada nesta tarefa. Ela entra em T037 com os mini-games de verdade.
- **Aceite:**
  - [ ] Os critérios 1, 2, 3 e 6 de [field-setup §8](features/field-setup.md).
  - [ ] As estatísticas recalculam em < 16 ms (`performance.now` em teste).
  - [ ] A sugestão automática de GCPs funciona no C00.
- **Verificação:** `npx vitest run src/screens/field src/engines/field` · E2E `field.spec.ts`.
- **Status:** ☐

### T024 — Motor de voo v1
- **Fase:** F2 · **Depende de:** T023 · **REQs:** REQ-FLT-001, REQ-FLT-002, REQ-FLT-003, REQ-FLT-004, REQ-FLT-005, REQ-FLT-006 (*parc.*: automático), REQ-FLT-018 (*parc.*), REQ-FLT-019 (*parc.*: sem nova surtida)
- **Spec:** [survey-flight](features/survey-flight.md) §3, §5.1–§5.3, §5.6–§5.8 (sem rolling shutter), §5.16, §6
- **Arquivos:** \+ `src/engines/flight/{FlightEngine,projection,runFrame,terrainRenderer,sky,aircraftSprite,cameraSensor,autopilot,hudPublisher}.ts`, `src/screens/flight/{SurveyFlightScreen,FlightHud,PostFlightDialog}.tsx` + testes
- **Passos:**
  1. `project` e mapeamento de *run*, com testes.
  2. Terreno em faixas com hillshade, curvas de nível, névoa e `buildDrawList`.
  3. Sprite da aeronave (Atlas).
  4. Fases TAKEOFF, RUN, TURN, LANDING e POST_FLIGHT.
  5. Câmera RGB automática com pegada, flash e som.
  6. HUD com o snapshot (campos disponíveis).
  7. Autopilot de debug.
  8. Pós-voo: "Levar dados" → `queueActive` → T10, ou "Processar agora" se houver Van. A Van vem em T044, mas o botão já respeita a guarda.
- **Aceite:**
  - [ ] Teste de draw list (morro oclui objeto). Nesta tarefa, o "objeto" pode ser um GCP_TARGET marcado como teste.
  - [ ] O critério 1 de [survey-flight §8](features/survey-flight.md), com autopilot.
  - [ ] Pausa congela o voo (E2E).
  - [ ] ≥ 55 FPS em Alta no C00 (overlay, manual).
- **Verificação:** `npx vitest run src/engines/flight src/screens/flight` · E2E `flight.spec.ts`.
- **Status:** ☐

### T025 — Processamento e relatório v1
- **Fase:** F2 · **Depende de:** T024 · **REQs:** REQ-PRC-001, REQ-PRC-002, REQ-PRC-004, REQ-PRC-006, REQ-PRC-007, REQ-PRC-009, REQ-PRC-010, REQ-PRG-010 (*parc.*), REQ-OFF-003 (*parc.*: fila)
- **Spec:** [processing-results](features/processing-results.md) §3, §5.1, §5.2, §5.4–§5.6, §5.8, §5.9
- **Arquivos:** \+ `src/engines/raster/{pipelineViz,orthoPreview}.ts`, `src/screens/processing/{ProcessingResultsScreen,Pipeline,ReportSummary,ReportAccuracy,ReportCoverage,ReportPayment}.tsx` + testes · ~ `missionSlice`, `playerSlice` e `museumSlice` (`applyMissionResult`)
- **Passos:**
  1. `LOADING`: `evaluateMission`.
  2. Esteira SfM animada (6 etapas). Na etapa 4, a nuvem usa uma projeção 2D simples (pontos com rotação em Y), que T026 substitui pelo `soft3d`.
  3. Abas Resumo, Acurácia (sem o comparativo MegaMap), Cobertura e Pagamento.
  4. `applyMissionResult` idempotente.
  5. "Enviar ao Museu" → T11.
- **Aceite:**
  - [ ] Os critérios 1, 2 e 4 de [processing-results §8](features/processing-results.md).
  - [ ] Recarregar durante a esteira não aplica as recompensas.
- **Verificação:** `npx vitest run src/screens/processing src/engines/raster` · E2E `processing.spec.ts`.
- **Status:** ☐

### T026 — Motor `soft3d` e Mesa Holográfica v1
- **Fase:** F2 · **Depende de:** T025 · **REQs:** REQ-HOL-001, REQ-HOL-002, REQ-HOL-003, REQ-HOL-008
- **Spec:** [holo-table](features/holo-table.md) §5.1, §5.2, §5.3 (só `ORTHO`), §5.6 (sem dimensão e modos)
- **Arquivos:** \+ `src/engines/soft3d/{vec3,mat4,OrbitCamera,Renderer,picking}.ts`, `src/engines/holo/{HoloEngine,sceneBuilder}.ts`, `src/screens/holo/{HoloTableScreen,SectorCard}.tsx` + testes · ~ `OfficeRenderer` (preview da mesa) · ~ etapa 4 da esteira (nuvem 3D)
- **Aceite:**
  - [ ] O critério 1 de [holo-table §8](features/holo-table.md).
  - [ ] Testes de `mat4`, `OrbitCamera` (clamp) e `pickSector`.
  - [ ] O *fly-to* e a animação de esculpir funcionam ao chegar do processamento.
  - [ ] ≥ 55 FPS em Alta.
- **Verificação:** `npx vitest run src/engines/soft3d src/engines/holo` · E2E `holo.spec.ts` (parcial).
- **Status:** ☐

### T027 — Integração do Vertical Slice
- **Fase:** F2 · **Depende de:** T026 · **REQs:** REQ-CORE-004 (*parc.*: E2E), REQ-CNT-007 (*parc.*: tutorial dirigido)
- **Spec:** [contracts-real C00 (tutorial dirigido)](content/contracts-real.md), [README §Marcos](README.md)
- **Arquivos:** \+ `tests/e2e/slice.spec.ts`, `src/screens/common/TutorialHint.tsx` · ~ as telas, para as dicas de `tutorialStep`
- **Passos:**
  1. Dicas do tutorial dirigido nas 5 telas.
  2. E2E completo com `?debug=1&autopilot=1&skipIntro=1`: escritório → porta → teleporte (F9) para C00 → aceitar → sugestão de GCPs → decolar → autopilot → levar dados → andar ou teleportar à sede → Workstation → processar → enviar ao museu → mesa mostra o setor.
  3. Recarregar no meio (após o voo) e verificar a missão pendente preservada.
- **Aceite:**
  - [ ] `slice.spec.ts` verde.
  - [ ] Tutorial: as dicas aparecem uma vez cada e avançam `tutorialStep`.
  - [ ] Nenhum `DebugScreenShell` é usado no fluxo do C00 (o `INFOGRAPHIC_LAB` ainda usa o shell).
- **Verificação:** `npm run verify && npm run e2e`
- **Status:** ☐

> **Marco M1 — Vertical Slice jogável.** Revisão manual: jogar o C00 do zero, sem debug, em ≤ 10 min.

---

# F3 — Voo completo

### T028 — Objetos 2.5D, colisão, dano e queda
- **Fase:** F3 · **Depende de:** T027 · **REQs:** REQ-FLT-011
- **Spec:** [survey-flight §5.4, §5.11](features/survey-flight.md), [terrain §4](design/terrain.md)
- **Arquivos:** \+ `src/engines/flight/{objectRenderer,collision,effects}.ts` · ~ `FlightEngine`, `missionSlice.endSortie` (descarte) · ~ `ruralTutorial` (árvores e casa como sólidos)
- **Aceite:**
  - [ ] Testes de `checkCollision` para cada forma (caixa, cilindro, esfera, fio, arco com vão livre, beam on/off).
  - [ ] O critério 2 de [survey-flight §8](features/survey-flight.md).
  - [ ] Uma queda descarta só os dados da surtida (teste do slice).
  - [ ] Atlas "volta para casa" sem custo de reparo.
- **Verificação:** `npx vitest run src/engines/flight`
- **Status:** ☐

### T029 — Iluminação, céu, sombras e clima
- **Fase:** F3 · **Depende de:** T028 · **REQs:** REQ-FLT-012, REQ-FLT-021
- **Spec:** [survey-flight §5.3 (névoa, água), §5.4 (sombras), §5.5](features/survey-flight.md), [contracts-real §1](content/contracts-real.md) (BLIZZARD_DRAIN visual, MAGIC_FOG, SPECULAR_WATER)
- **Aceite:**
  - [ ] As 5 iluminações produzem paletas e sombras distintas (snapshot da draw list: presença e comprimento dos polígonos de sombra).
  - [ ] `SPECULAR_WATER` + `SUN_HIGH` marca `overWater` e desenha o brilho.
  - [ ] `MAGIC_FOG` marca `inFog`.
  - [ ] As partículas de neve respeitam o vento.
  - [ ] `reduceFlashes` desliga o shake.
- **Verificação:** `npx vitest run src/engines/flight` · manual: `?debug=1&screen=SURVEY_FLIGHT&contract=C00` alternando a iluminação no plano.
- **Status:** ☐

### T030 — Vento, térmicas, EM e RTK
- **Fase:** F3 · **Depende de:** T029 · **REQs:** REQ-FLT-013, REQ-FLT-020, REQ-FLT-022
- **Spec:** [survey-flight §5.13](features/survey-flight.md), [domain-math §5](design/domain-math.md)
- **Aceite:**
  - [ ] HUD de vento e crab.
  - [ ] Deriva proporcional ao `driftFactor` × `windDrift`.
  - [ ] `STRONG_WIND` acima da tolerância dobra a deriva e emite o alerta.
  - [ ] Térmicas somam lift.
  - [ ] EM com ruído (Atlas imune, testado).
  - [ ] `rtkStatusAt` com zonas de teste.
  - [ ] Fotos registram `rtk`.
- **Verificação:** `npx vitest run src/engines/flight src/domain/flightPhysics`
- **Status:** ☐

### T031 — Energia, RTH e múltiplas surtidas
- **Fase:** F3 · **Depende de:** T030 · **REQs:** REQ-FLT-014, REQ-FLT-019
- **Spec:** [survey-flight §5.12](features/survey-flight.md), [architecture §2 (T16)](design/architecture.md)
- **Aceite:**
  - [ ] O critério 5 de [survey-flight §8](features/survey-flight.md).
  - [ ] RTH com confirmação e timeout.
  - [ ] "Nova surtida" retoma na 1ª linha incompleta e consome a bateria reserva.
  - [ ] Sem reservas, o botão some.
  - [ ] T16 "Tentar de novo" funciona sem dados.
  - [ ] O plano C05 (2 baterias) é completável com autopilot em 2 surtidas.
- **Verificação:** `npx vitest run src/engines/flight` · E2E `flight-sorties.spec.ts`.
- **Status:** ☐

### T032 — Comportamento de Atlas
- **Fase:** F3 · **Depende de:** T031 · **REQs:** REQ-FLT-015, REQ-PRG-013 (*parc.*: consumo de milho em voo)
- **Spec:** [survey-flight §5.15](features/survey-flight.md), [catalog §8](content/catalog.md)
- **Aceite:**
  - [ ] Distração seedada, com aviso, força lateral e cancelamento por contrabalanço.
  - [ ] HUD com milho.
  - [ ] Nova surtida enche o papo a partir do estoque.
  - [ ] Calibração reduz a penalidade (teste no `accuracy` via `atlasCalibrated`).
- **Verificação:** `npx vitest run src/engines/flight`
- **Status:** ☐

### T033 — Sensor LiDAR e alternância
- **Fase:** F3 · **Depende de:** T032 · **REQs:** REQ-FLT-009, REQ-FLT-010
- **Spec:** [survey-flight §5.9, §5.10](features/survey-flight.md), [domain-math §4.4](design/domain-math.md)
- **Arquivos:** \+ `src/engines/flight/lidarSensor.ts` · ~ `missionSlice.mergeLidar`
- **Aceite:**
  - [ ] O critério 4 de [survey-flight §8](features/survey-flight.md).
  - [ ] O acúmulo na grade bate com `lidarDensityWithOverlap` ± 10 % no centro da AOI após um voo de autopilot (teste de integração do engine, sem render).
  - [ ] Amostras limitadas a 50.000.
- **Verificação:** `npx vitest run src/engines/flight`
- **Status:** ☐

### T034 — Modos especiais em voo (TF, malha cruzada, oblíqua)
- **Fase:** F3 · **Depende de:** T033 · **REQs:** REQ-FLT-016, REQ-FLD-012
- **Spec:** [survey-flight §5.6, §5.7](features/survey-flight.md), [field-setup §5.3](features/field-setup.md), [domain-math §2.8](design/domain-math.md)
- **Aceite:**
  - [ ] TF sobre um terreno de teste com rampa mantém o AGL ≤ 15 % de desvio.
  - [ ] As linhas cruzadas voam após as primárias.
  - [ ] Na oblíqua, a pegada desenhada é deslocada e trapezoidal e os shots registram `tiltDeg`.
  - [ ] Os toggles no Field Setup aparecem conforme a aeronave.
- **Verificação:** `npx vitest run src/engines/flight src/screens/field`
- **Status:** ☐

### T035 — Alertas de qualidade e disparo manual
- **Fase:** F3 · **Depende de:** T034 · **REQs:** REQ-FLT-006, REQ-FLT-007, REQ-FLT-008, REQ-FLT-017, REQ-FLT-018
- **Spec:** [survey-flight §5.8, §5.17](features/survey-flight.md)
- **Aceite:**
  - [ ] Os critérios 3 e 6 de [survey-flight §8](features/survey-flight.md).
  - [ ] Disparo manual com cooldown.
  - [ ] Rolling shutter com skew registrado e pegada cisalhada.
  - [ ] Fila de alertas respeita a prioridade (máximo 2).
  - [ ] HUD completo (todos os campos do snapshot).
- **Verificação:** `npx vitest run src/engines/flight src/screens/flight`
- **Status:** ☐

### T036 — Aceleração de tempo e elementos de fenda
- **Fase:** F3 · **Depende de:** T035 · **REQs:** REQ-FLT-023, REQ-FLT-024
- **Spec:** [survey-flight §5.13, §5.14](features/survey-flight.md), [contracts-real §1](content/contracts-real.md) (`SEARCHLIGHTS`, `MOVING_HAZARDS`, `ENERGY_BEAMS`, `COLLECTIBLE_RINGS`, `ELECTRIC_CREATURES`, `FEATURE_TARGETS`)
- **Aceite:**
  - [ ] *Time warp* com as regras de volta para ×1 (teste).
  - [ ] Holofote: detecção em 1,5 s (Atlas 3 s).
  - [ ] Anéis coletados somam.
  - [ ] Features avaliadas no fim da surtida.
  - [ ] Picos elétricos seedados.
  - [ ] Hazards móveis e beams com estado por `t`.
  - [ ] Cada regra tem uma cena de teste num bioma sintético (`src/world/terrain/biomes/testArena.ts`, usado só em testes).
- **Verificação:** `npx vitest run src/engines/flight`
- **Status:** ☐

> **Marco M2 — Motor de voo completo.**

---

# F4 — Campo e mundo

### T037 — Mini-game de nivelamento (bolha)
- **Fase:** F4 · **Depende de:** T036 · **REQs:** REQ-FLD-010
- **Spec:** [field-setup §5.4](features/field-setup.md)
- **Arquivos:** \+ `src/engines/field/minigames/bubble.ts`, `src/domain/minigameScoring.ts`, `src/screens/field/CalibrationTab.tsx` + testes
- **Aceite:**
  - [ ] `scoreBubble` é puro e testado.
  - [ ] O critério 5 de [field-setup §8](features/field-setup.md), com input simulado.
  - [ ] `levelScore` alimenta o σ dos GCPs e é visível no texto.
  - [ ] A aba 3 aparece no wizard.
- **Verificação:** `npx vitest run src/domain/minigameScoring src/engines/field`
- **Status:** ☐

### T038 — Mini-game de calibração da IMU (lemniscata)
- **Fase:** F4 · **Depende de:** T037 · **REQs:** REQ-FLD-011
- **Spec:** [field-setup §5.4](features/field-setup.md)
- **Aceite:**
  - [ ] `scoreLemniscate` é puro: um cursor exatamente sobre o guia dá 1, e um cursor a 40 px dá 0.
  - [ ] O `imuScore` aplicado reduz a deriva no voo e o multiplicador `imu` na acurácia.
- **Verificação:** `npx vitest run src/domain/minigameScoring src/engines/field`
- **Status:** ☐

### T039 — Veículos: locomoção no mapa e acessibilidade de campo
- **Fase:** F4 · **Depende de:** T038 · **REQs:** REQ-WLD-002, REQ-WLD-003, REQ-FLD-002, REQ-FLD-003
- **Spec:** [world-map §5.2–§5.3](features/world-map.md), [catalog §4, §5](content/catalog.md), [field-setup §5.2](features/field-setup.md)
- **Aceite:**
  - [ ] `CYCLE_VEHICLE` entre os possuídos.
  - [ ] Sprites por modo.
  - [ ] Velocidades da tabela.
  - [ ] Recusa ao trocar para um modo inválido no tile.
  - [ ] Field Setup usa a união dos veículos.
  - [ ] Toggle de instrumento (Estação Total / GNSS) com os limites.
  - [ ] O critério 4 de [world-map §8](features/world-map.md).
- **Verificação:** `npx vitest run src/engines/overworld src/domain/accessibility src/screens/field`
- **Status:** ☐

### T040 — Eventos de campo
- **Fase:** F4 · **Depende de:** T039 · **REQs:** REQ-WLD-006
- **Spec:** [world-map §5.5](features/world-map.md), [catalog §12](content/catalog.md)
- **Arquivos:** \+ `src/data/fieldEvents.ts`, `src/screens/world/FieldEventModal.tsx` + testes
- **Aceite:**
  - [ ] Os 6 eventos implementados, com efeitos e escolhas.
  - [ ] Seed fixa gera a sequência esperada (teste de domínio já existe; aqui, teste RTL do modal e da aplicação dos efeitos).
  - [ ] Pausa congela os timers do evento.
- **Verificação:** `npx vitest run src/screens/world`
- **Status:** ☐

---

# F5 — Processamento e produtos

### T041 — Rasters de produto (Orto, MDS, MDT, NDVI)
- **Fase:** F5 · **Depende de:** T040 · **REQs:** REQ-PRC-008 (*parc.*)
- **Spec:** [processing-results §5.7](features/processing-results.md)
- **Arquivos:** \+ `src/engines/raster/products.ts`, `src/screens/processing/ProductViewer.tsx` + testes
- **Aceite:**
  - [ ] Os 4 rasters têm 256², são determinísticos e geram em fatias sem travar (cada fatia < 8 ms).
  - [ ] Máscaras de sem-dados e hachuras.
  - [ ] Abas indisponíveis com o motivo (critério 5 de [processing-results §8](features/processing-results.md)).
  - [ ] Features capturadas são marcadas.
- **Verificação:** `npx vitest run src/engines/raster src/screens/processing`
- **Status:** ☐

### T042 — Visualizador de nuvem de pontos e TIN
- **Fase:** F5 · **Depende de:** T041 · **REQs:** REQ-PRC-008
- **Spec:** [processing-results §5.7](features/processing-results.md), [holo-table §5.1](features/holo-table.md)
- **Aceite:**
  - [ ] Nuvem fotogramétrica (cores da orto) e nuvem LiDAR (cores por retorno).
  - [ ] Toggle TIN.
  - [ ] Órbita por mouse e gamepad.
  - [ ] 30.000 pontos a ≥ 50 FPS.
- **Verificação:** `npx vitest run src/screens/processing` · manual com `?debug=1&screen=PROCESSING_RESULTS`.
- **Status:** ☐

### T043 — Relatório completo e esteira LiDAR
- **Fase:** F5 · **Depende de:** T042 · **REQs:** REQ-PRC-001, REQ-PRC-003, REQ-PRC-005, REQ-PRC-013, REQ-PRG-011 (*parc.*: comparativo)
- **Spec:** [processing-results §5.3, §5.5, §5.6 (camada LiDAR)](features/processing-results.md)
- **Aceite:**
  - [ ] Esteira LiDAR nas missões LiDAR e as duas em sequência nas mistas.
  - [ ] Multiplicadores listados com rótulos pt-BR.
  - [ ] Calibração de lente determinística.
  - [ ] Volumetria exibida quando exigida.
  - [ ] Card do comparativo MegaMap.
  - [ ] O critério 2 de [processing-results §8](features/processing-results.md).
- **Verificação:** `npx vitest run src/screens/processing src/engines/raster`
- **Status:** ☐

### T044 — Van Lab e etapa da equipe
- **Fase:** F5 · **Depende de:** T043 · **REQs:** REQ-PRC-011, REQ-PRC-012
- **Spec:** [processing-results §5.1](features/processing-results.md), [survey-flight §5.12](features/survey-flight.md)
- **Aceite:**
  - [ ] Com a Van, "Processar agora" leva a `PROCESSING_RESULTS` com `inField` e, ao concluir, a `WORLD_MAP` (T13).
  - [ ] Fator de 2,5 aplicado.
  - [ ] Com equipe, aparece a etapa 7 e os bônus entram no pagamento.
- **Verificação:** `npx vitest run src/screens/processing` · E2E `van.spec.ts` (`?unlockAll=1`).
- **Status:** ☐

---

# F6 — Progressão

### T045 — Garagem (loja) e upgrade de hardware
- **Fase:** F6 · **Depende de:** T044 · **REQs:** REQ-OFF-003, REQ-OFF-004, REQ-PRG-002, REQ-PRG-003, REQ-PRG-004
- **Spec:** [office §5](features/office.md) (Garagem, Workstation/Hardware), [progression §5](features/progression.md)
- **Arquivos:** \+ `src/screens/office/{GaragePanel,ShopItemCard,HardwarePanel}.tsx` · ~ `OfficeRenderer` (frota visível)
- **Aceite:**
  - [ ] O critério 2 de [office §8](features/office.md).
  - [ ] Combo T2 com os itens faltantes.
  - [ ] Hardware sequencial.
  - [ ] Desconto `shopPrice`.
  - [ ] Hotspot da Garagem ativo.
- **Verificação:** `npx vitest run src/screens/office`
- **Status:** ☐

### T046 — Quadro de Carreira: habilidades e perfil
- **Fase:** F6 · **Depende de:** T045 · **REQs:** REQ-PRG-006, REQ-PRG-007, REQ-PRG-012
- **Spec:** [office §5](features/office.md) (Quadro de Carreira), [progression §6, §9](features/progression.md)
- **Aceite:**
  - [ ] O critério 4 de [office §8](features/office.md).
  - [ ] Árvore com estados (bloqueado, disponível, adquirido).
  - [ ] Perfil com faixas de reputação, estatísticas e o rival.
  - [ ] **Todos** os 13 modificadores conectados aos consumidores ([progression §6](features/progression.md)), com 1 teste por consumidor.
- **Verificação:** `npx vitest run src/screens/office src/domain/modifiers`
- **Status:** ☐

### T047 — Equipe
- **Fase:** F6 · **Depende de:** T046 · **REQs:** REQ-PRG-005
- **Spec:** [progression §7](features/progression.md), [catalog §7](content/catalog.md)
- **Aceite:**
  - [ ] Contratar e demitir com limites.
  - [ ] Custos aplicados no pagamento.
  - [ ] Bonecos desenhados no escritório.
  - [ ] Hotspot ativo.
- **Verificação:** `npx vitest run src/screens/office`
- **Status:** ☐

### T048 — Poleiro do Atlas
- **Fase:** F6 · **Depende de:** T047 · **REQs:** REQ-OFF-005, REQ-PRG-013
- **Spec:** [office §5](features/office.md) (Poleiro), [catalog §8](content/catalog.md)
- **Aceite:**
  - [ ] Comprar milho, alimentar (limite 10) e calibrar (3 voos).
  - [ ] Acessórios.
  - [ ] Arrulho ao clicar.
  - [ ] Hotspot ativo.
- **Verificação:** `npx vitest run src/screens/office`
- **Status:** ☐

### T049 — Cosméticos e editor de emblema
- **Fase:** F6 · **Depende de:** T048 · **REQs:** REQ-PRG-008
- **Spec:** [catalog §10](content/catalog.md), [office §5](features/office.md) (Carreira → Visual), [ui-style §2](design/ui-style.md) (`EmblemBadge`)
- **Aceite:**
  - [ ] Skins visíveis no mapa (avatar), pinturas no voo e na mesa, acessório do Atlas no voo e no poleiro.
  - [ ] O emblema aparece na TopBar, no relatório e no escritório.
  - [ ] O editor persiste e valida as iniciais (≤ 4, maiúsculas).
- **Verificação:** `npx vitest run src/screens/office`
- **Status:** ☐

### T050 — Museu: renda passiva e estante de relíquias
- **Fase:** F6 · **Depende de:** T049 · **REQs:** REQ-PRG-009, REQ-PRG-010, REQ-OFF-006, REQ-OFF-001
- **Spec:** [progression §10, §11](features/progression.md), [office §5](features/office.md) (Estante)
- **Aceite:**
  - [ ] O critério 5 de [progression §14](features/progression.md).
  - [ ] Renda offline com toast.
  - [ ] Estante com os 18 slots e estados.
  - [ ] Todos os 9 hotspots do escritório funcionais (REQ-OFF-001 completo).
- **Verificação:** `npx vitest run src/state src/screens/office`
- **Status:** ☐

### T051 — Rival MegaMap e reputação no mapa
- **Fase:** F6 · **Depende de:** T050 · **REQs:** REQ-PRG-011, REQ-PRG-012
- **Spec:** [progression §8, §9](features/progression.md), [world-map §5.4](features/world-map.md)
- **Aceite:**
  - [ ] Modal de contraproposta com as duas opções e o portfólio.
  - [ ] Roubo após falha crítica processada e retorno após outro contrato (critério 4 de [progression §14](features/progression.md)).
  - [ ] Marcador rosa "MM".
- **Verificação:** `npx vitest run src/screens/world src/domain/rival`
- **Status:** ☐

---

# F7 — Conteúdo

> **Padrão de cada tarefa de contrato (T053–T058, T060–T070):**
> 1. Implementar a receita do bioma em `src/world/terrain/biomes/<bioma>.ts`, conforme [terrain §3](design/terrain.md) e o bloco do contrato.
> 2. Adicionar o objeto `Contract` em `src/data/contracts/{real|rifts}.ts`, com diálogos e plano de referência.
> 3. Garantir que as regras especiais do contrato funcionam, reusando T052.
> 4. Rodar o teste de **viabilidade**, que deve passar.
> 5. Jogar com autopilot (`?debug=1&contract=<id>&screen=SURVEY_FLIGHT&autopilot=1`) até o relatório.
> 6. Fazer a revisão visual do bioma no satélite, no voo, nos produtos e na mesa.
>
> **Aceite comum:**
> - [ ] Viabilidade verde.
> - [ ] Autopilot conclui o voo sem queda (o autopilot sobe sobre obstáculos).
> - [ ] Relatório aprovado com o plano de referência.
> - [ ] Bioma visualmente distinto.
> - [ ] Determinismo verificado.
>
> **Verificação comum:** `npx vitest run src/data/contracts src/world/terrain` + E2E parametrizado `tests/e2e/contracts.spec.ts --grep <id>`.

### T052 — Framework de regras especiais
- **Fase:** F7 · **Depende de:** T051 · **REQs:** REQ-CNT-004
- **Spec:** [contracts-real §1](content/contracts-real.md)
- **Arquivos:** \+ `src/data/specialRules.ts` (metadados: nome, descrição pt-BR, ícone), `src/domain/specialRules.ts` (registro de efeitos por sistema: `terrain`, `flight`, `field`, `coverage`, `accuracy`) + testes
- **Aceite:**
  - [ ] Todas as 20 regras têm metadados e efeito registrado.
  - [ ] 1 teste por regra, usando a `testArena` de T036.
  - [ ] O briefing exibe as regras com ícone e descrição.
- **Verificação:** `npx vitest run src/domain/specialRules`
- **Status:** ☐

### T053 — C01 Metrópole Vertical
- **Fase:** F7 · **Depende de:** T052 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*), REQ-FLT-022
- **Spec:** [contracts-real C01](content/contracts-real.md), [terrain §3](design/terrain.md) (`URBAN_VERTICAL`)
- **Aceite específico:**
  - [ ] Zonas `RTK_CANYON` geradas (≥ 2).
  - [ ] Prédios > 60 m são ≥ 20 %.
  - [ ] O briefing avisa a altura máxima.
- **Status:** ☐

### T054 — C05 Centro Histórico Colonial
- **Fase:** F7 · **Depende de:** T053 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*)
- **Spec:** [contracts-real C05](content/contracts-real.md)
- **Aceite específico:**
  - [ ] Fios entre os postes colidem.
  - [ ] O plano de referência exige 2 surtidas com o T1 e é completável.
- **Status:** ☐

### T055 — C06 Zona Costeira e Estuário
- **Fase:** F7 · **Depende de:** T054 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*), REQ-FLT-021 (*parc.*)
- **Spec:** [contracts-real C06](content/contracts-real.md)
- **Aceite específico:**
  - [ ] Água excluída da cobertura.
  - [ ] Com `SUN_HIGH`, as fotos sobre a água ficam inválidas.
  - [ ] Faixa de terra garantida.
- **Status:** ☐

### T056 — C02 Planalto Agrícola
- **Fase:** F7 · **Depende de:** T055 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*)
- **Spec:** [contracts-real C02](content/contracts-real.md)
- **Aceite específico:**
  - [ ] NDVI com manchas de estresse visíveis no produto.
  - [ ] A asa fixa faz as curvas com o tempo da fórmula.
  - [ ] Textura homogênea penaliza com p < 80.
- **Status:** ☐

### T057 — C04 Mina a Céu Aberto
- **Fase:** F7 · **Depende de:** T056 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*), REQ-PRC-013
- **Spec:** [contracts-real C04](content/contracts-real.md)
- **Aceite específico:**
  - [ ] Bancadas visíveis no voo.
  - [ ] TF obrigatório.
  - [ ] Volumetria com erro ≤ 2 % no plano de referência.
  - [ ] Marcador acessível só de 4x4.
- **Status:** ☐

### T058 — C03 Floresta Amazônica
- **Fase:** F7 · **Depende de:** T057 · **REQs:** REQ-CNT-001, REQ-CNT-004 (*parc.*)
- **Spec:** [contracts-real C03](content/contracts-real.md)
- **Aceite específico:**
  - [ ] 7 clareiras fixas.
  - [ ] Sem LiDAR, o MDT fica "sem dados" e a missão é reprovada por crítico.
  - [ ] Com o plano de referência, a densidade de solo é ≥ 8.
- **Status:** ☐

### T059 — Framework das Fendas Dimensionais
- **Fase:** F7 · **Depende de:** T058 · **REQs:** REQ-WLD-004, REQ-CNT-002 (*parc.*), REQ-CNT-006, REQ-HOL-005 (*parc.*)
- **Spec:** [contracts-rifts §1, §3](content/contracts-rifts.md), [world-map §5.4](features/world-map.md), [constitution §6](constitution.md)
- **Arquivos:** \+ `src/data/contracts/rifts.ts` (vazio tipado, preenchido nas tarefas seguintes), `scripts/check-forbidden-terms.mjs`, teste `src/data/contracts/forbiddenTerms.test.ts` · ~ mapa (aba Fendas, portais, tonalidade), briefing (moldura rift), transição com distorção, HUD com moldura rift
- **Aceite:**
  - [ ] O critério 3 de [world-map §8](features/world-map.md), usando uma fenda de teste.
  - [ ] `npm run check:terms` integrado ao `verify`.
  - [ ] Retratos como emblemas.
- **Verificação:** `npm run check:terms && npx vitest run src/data/contracts src/screens/world`
- **Status:** ☐

### T060–T070 — Fendas R01 a R11
Uma tarefa por fenda, **nesta ordem**: T060 = R01, T061 = R02, T062 = R08, T063 = R11, T064 = R06, T065 = R07, T066 = R09, T067 = R03, T068 = R05, T069 = R04, T070 = R10. A ordem segue o desbloqueio.
- **Fase:** F7 · **Depende de:** T059 e a tarefa anterior · **REQs:** REQ-CNT-002 (*parc.*), REQ-CNT-004 (*parc.*), REQ-CNT-006 · **Spec:** o bloco da fenda em [contracts-rifts](content/contracts-rifts.md), [terrain §3](design/terrain.md)
- **Aceite específico por fenda:**

| Tarefa | Fenda | Verificações extras |
| :--- | :--- | :--- |
| T060 | R01 | Anéis coletáveis somam bônus. Arcos com vão livre. Atlas consegue completar (autonomia) |
| T061 | R02 | Hazards móveis. Canos de até 40 m. PEC A altimétrico avaliado |
| T062 | R08 | Vielas de 4–6 m, fios, casas coladas |
| T063 | R11 | `PAINT_MARKERS` permite GCPs no paredão. Feature `TEMPLE_FACADE` capturada com oblíqua |
| T064 | R06 | Sensor THERMAL obrigatório. Tocas visíveis só no render termal. 4x4 para chegar |
| T065 | R07 | Holofotes. `NOT_DETECTED`. Dreno 2×. Walker como feature |
| T066 | R09 | NDVI, picos elétricos |
| T067 | R03 | Crateras com volumetria ≤ 3 %. Beams |
| T068 | R05 | Terreno quantizado. Lava com térmicas. TF |
| T069 | R04 | Névoa invalida o RGB. Templo revelado no MDT |
| T070 | R10 | Trincheira, escotilha de 2 m capturada, > 100 pts/m² |

- **Status:** T060 ☐ · T061 ☐ · T062 ☐ · T063 ☐ · T064 ☐ · T065 ☐ · T066 ☐ · T067 ☐ · T068 ☐ · T069 ☐ · T070 ☐

### T071 — Campanha integrada: desbloqueios, replay, final e balanceamento
- **Fase:** F7 · **Depende de:** T070 · **REQs:** REQ-CNT-003, REQ-CNT-005, REQ-CNT-008, REQ-CNT-002
- **Spec:** [progression §11, §12](features/progression.md), [contracts-real §3, §4](content/contracts-real.md), [catalog §13](content/catalog.md)
- **Arquivos:** \+ `src/domain/campaignSim.test.ts`, `src/screens/office/FinaleSequence.tsx`
- **Aceite:**
  - [ ] A simulação de campanha ([catalog §13](content/catalog.md)) passa: ordem de desbloqueio correta e compras viáveis.
  - [ ] Replay a 40 %, sem souvenir.
  - [ ] O final é exibido uma vez e desbloqueia o chapéu.
  - [ ] Desbloqueios de cosméticos por coleção (6 e 11 fendas, C03).
- **Verificação:** `npx vitest run src/domain/campaignSim`
- **Status:** ☐

> **Marco M3 — Conteúdo completo.**

---

# F8 — Mesa completa e Laboratório

### T072 — Mesa Holográfica completa
- **Fase:** F8 · **Depende de:** T071 · **REQs:** REQ-HOL-004, REQ-HOL-005, REQ-HOL-006, REQ-HOL-007
- **Spec:** [holo-table](features/holo-table.md) (completo)
- **Aceite:**
  - [ ] Os critérios 2, 3 e 4 de [holo-table §8](features/holo-table.md).
  - [ ] Miniaturas por aeronave.
  - [ ] Painel de alas com destaque.
  - [ ] Queda automática de qualidade.
  - [ ] ≥ 55 FPS com os 18 setores mapeados (`?unlockAll=1` + debug "mapear tudo").
- **Verificação:** `npx vitest run src/engines/holo src/screens/holo` · E2E `holo.spec.ts`.
- **Status:** ☐

### T073 — Laboratório: Óptica & GSD e Estereoscopia
- **Fase:** F8 · **Depende de:** T072 · **REQs:** REQ-LAB-001, REQ-LAB-002, REQ-LAB-005 (*parc.*)
- **Spec:** [infographic-lab §3–§5.2](features/infographic-lab.md)
- **Arquivos:** \+ `src/screens/lab/{InfographicLabScreen,OpticsPanel,StereoPanel}.tsx`, `src/engines/lab/{opticsRenderer,stereoRenderer}.ts`
- **Aceite:**
  - [ ] Os critérios 1 e 2 de [infographic-lab §8](features/infographic-lab.md).
  - [ ] "Usar valores do meu equipamento".
  - [ ] Teste de *spy* confirmando o uso de `@/domain`.
  - [ ] `INFOGRAPHIC_LAB` deixa de usar o shell.
- **Verificação:** `npx vitest run src/screens/lab src/engines/lab`
- **Status:** ☐

### T074 — Laboratório: Dossel e Shutter
- **Fase:** F8 · **Depende de:** T073 · **REQs:** REQ-LAB-003, REQ-LAB-004, REQ-LAB-005
- **Spec:** [infographic-lab §5.3, §5.4](features/infographic-lab.md)
- **Aceite:**
  - [ ] Os critérios 3 e 4 de [infographic-lab §8](features/infographic-lab.md).
  - [ ] `sampleRollingShutter` é puro e testado.
  - [ ] E2E `lab.spec.ts`.
- **Verificação:** `npx vitest run src/screens/lab src/engines/lab && npx playwright test tests/e2e/lab.spec.ts`
- **Status:** ☐

---

# F9 — Polimento e release

### T075 — Menu de pausa, configurações e novo jogo
- **Fase:** F9 · **Depende de:** T074 · **REQs:** REQ-CORE-003, REQ-CORE-009, REQ-AUD-003, REQ-NFR-007 (*parc.*)
- **Spec:** [architecture §2 (pausa)](design/architecture.md), [progression §13](features/progression.md), [ui-style §5](design/ui-style.md)
- **Aceite:**
  - [ ] Pausa com Continuar, Configurações (volumes, mudo, qualidade, reduzir flashes, FPS), Controles (tabela de glyphs do dispositivo ativo), Salvar agora, Novo jogo (ConfirmDialog), Abandonar missão (no FIELD_SETUP e no voo) e Sair para o escritório (onde fizer sentido pela tabela de transições).
  - [ ] Teste do REQ-CORE-003 (voo congelado por 5 s).
  - [ ] E2E do novo jogo.
- **Verificação:** `npx vitest run src/app src/state && npx playwright test tests/e2e/pause.spec.ts`
- **Status:** ☐

### T076 — *Game juice*: transições, partículas e sons de ambiente
- **Fase:** F9 · **Depende de:** T075 · **REQs:** REQ-UI-004, REQ-AUD-002
- **Spec:** [audio §4](design/audio.md), [survey-flight §5.5](features/survey-flight.md), [ui-style §5](design/ui-style.md)
- **Aceite:**
  - [ ] Transições de tela com fade de 200 ms e "distorção" nas fendas.
  - [ ] Loops `MOTOR`, `WIND` e `PROCESSING` integrados.
  - [ ] `UI_HOVER` nos botões.
  - [ ] Toasts com ícones por tipo.
  - [ ] Tudo respeita `reduceFlashes` e o mudo.
- **Verificação:** `npm run verify && npm run e2e` · manual: jogar o C00 com som e com `reduceFlashes` ligado.
- **Status:** ☐

### T077 — Passe de performance
- **Fase:** F9 · **Depende de:** T076 · **REQs:** REQ-NFR-001, REQ-NFR-004
- **Spec:** [survey-flight §5.18](features/survey-flight.md), [holo-table §5.7](features/holo-table.md), [requirements NFR-001](requirements.md)
- **Passos:**
  1. Profiling com o painel F9 (tempos por etapa).
  2. Aplicar as otimizações obrigatórias.
  3. Validar as qualidades Baixa, Média e Alta.
  4. Documentar as medições em `specs/decisions.md` (ADR "Medições de performance"), por tela e qualidade.
- **Aceite:**
  - [ ] Voo C01 e C03, mesa com 18 setores: ≥ 55 FPS em Alta no perfil de referência.
  - [ ] Mapa ≥ 58 FPS.
  - [ ] E2E em 1280 × 720 e 1920 × 1080 sem rolagem horizontal.
- **Verificação:** `npx playwright test tests/e2e/viewports.spec.ts` · manual: overlay de FPS nos cenários listados, com os números registrados na ADR.
- **Status:** ☐

### T078 — Auditoria de gamepad e acessibilidade
- **Fase:** F9 · **Depende de:** T077 · **REQs:** REQ-INP-006, REQ-NFR-007, REQ-NFR-009
- **Passos:**
  1. Percorrer **todas** as telas, modais e painéis só com o gamepad (real ou emulado) e só com o teclado.
  2. Corrigir as lacunas de foco.
  3. Verificar o contraste.
  4. Smoke test no Firefox (manual) documentado.
- **Aceite:**
  - [ ] Checklist de auditoria (anexada a esta tarefa ao concluir) com 100 % dos itens OK.
  - [ ] E2E `keyboard-only.spec.ts` cobrindo o slice inteiro sem mouse.
- **Verificação:** `npx playwright test tests/e2e/keyboard-only.spec.ts` · manual: checklist de auditoria.
- **Status:** ☐

### T079 — Regressão final e release
- **Fase:** F9 · **Depende de:** T078 · **REQs:** REQ-NFR-005, REQ-NFR-006, REQ-CNT-006, REQ-NFR-002, REQ-NFR-003
- **Passos:**
  1. Garantir que o `DebugScreenShell` só existe atrás de `?debug=1` e que nenhuma tela o usa.
  2. Rodar `verify`, `e2e`, `check:assets`, `check:terms`, `check:placeholders` e `test:coverage`.
  3. Atualizar a matriz de rastreabilidade (abaixo) com o status final.
  4. Jogar a campanha (manual, com debug de dinheiro permitido) para uma verificação de sanidade.
- **Aceite:**
  - [ ] Todos os scripts verdes.
  - [ ] Cobertura atendida.
  - [ ] Todos os REQs com status ✅ na matriz.
- **Verificação:** `npm run verify && npm run e2e && npm run check:assets && npm run test:coverage`
- **Status:** ☐

> **Marco M4 — Release.**

---

## Matriz de rastreabilidade (REQ → spec → tarefas)

> Gerada a partir das referências cruzadas. Ao concluir uma tarefa, o agente marca a coluna **Status** do REQ como ✅ quando **todas** as tarefas listadas estiverem concluídas.

| REQ | Título | Spec de detalhe | Tarefas | Status |
| :--- | :--- | :--- | :--- | :-: |
| REQ-CORE-001 | Máquina de estados de telas | [architecture](design/architecture.md) | T005 | ☐ |
| REQ-CORE-002 | Transição inválida | [architecture](design/architecture.md) | T005 | ☐ |
| REQ-CORE-003 | Pausa | [architecture](design/architecture.md), [survey-flight](features/survey-flight.md) | T005, T007, T075 | ☐ |
| REQ-CORE-004 | Persistência e autosave | [architecture](design/architecture.md), [data-model](design/data-model.md) | T006, T027 | ☐ |
| REQ-CORE-005 | Migração e corrupção de save | [architecture](design/architecture.md), [data-model](design/data-model.md) | T006 | ☐ |
| REQ-CORE-006 | Determinismo | [architecture](design/architecture.md), [terrain](design/terrain.md) | T002, T017 | ☐ |
| REQ-CORE-007 | Flags de depuração | [architecture](design/architecture.md) | T005 | ☐ |
| REQ-CORE-008 | Game loop e Canvas | [architecture](design/architecture.md), [survey-flight](features/survey-flight.md) | T007 | ☐ |
| REQ-CORE-009 | Novo jogo | [architecture](design/architecture.md), [progression](features/progression.md) | T006, T075 | ☐ |
| REQ-INP-001 | Teclado e mouse | [input](design/input.md), [world-map](features/world-map.md) | T008 | ☐ |
| REQ-INP-002 | Detecção de gamepad | [input](design/input.md) | T008 | ☐ |
| REQ-INP-003 | Mapeamento padrão | [input](design/input.md), [world-map](features/world-map.md) | T008 | ☐ |
| REQ-INP-004 | Glyphs dinâmicos | [input](design/input.md) | T008 | ☐ |
| REQ-INP-005 | Deadzone e borda | [input](design/input.md) | T008 | ☐ |
| REQ-INP-006 | Navegação de UI por gamepad | [input](design/input.md), [field-setup](features/field-setup.md), [infographic-lab](features/infographic-lab.md), [office](features/office.md) | T008, T078 | ☐ |
| REQ-AUD-001 | Inicialização preguiçosa | [audio](design/audio.md) | T009 | ☐ |
| REQ-AUD-002 | Catálogo de efeitos | [audio](design/audio.md), [processing-results](features/processing-results.md), [survey-flight](features/survey-flight.md) | T009, T076 | ☐ |
| REQ-AUD-003 | Volume e mudo | [audio](design/audio.md) | T009, T075 | ☐ |
| REQ-UI-001 | Paleta dark geodésica | [ui-style](design/ui-style.md) | T004 | ☐ |
| REQ-UI-002 | Kit de componentes | [ui-style](design/ui-style.md) | T004 | ☐ |
| REQ-UI-003 | Barra superior | [ui-style](design/ui-style.md), [office](features/office.md) | T020 | ☐ |
| REQ-UI-004 | Toasts | [ui-style](design/ui-style.md), [progression](features/progression.md) | T004, T005, T076 | ☐ |
| REQ-UI-005 | Ícones | [ui-style](design/ui-style.md) | T004 | ☐ |
| REQ-OFF-001 | Sala interativa | [office](features/office.md) | T020, T050 | ☐ |
| REQ-OFF-002 | Navegação entre hotspots | [office](features/office.md) | T020 | ☐ |
| REQ-OFF-003 | Workstation | [office](features/office.md) | T025, T045 | ☐ |
| REQ-OFF-004 | Garagem | [office](features/office.md) | T045 | ☐ |
| REQ-OFF-005 | Poleiro do Atlas | [office](features/office.md) | T048 | ☐ |
| REQ-OFF-006 | Estante de Relíquias | [office](features/office.md) | T050 | ☐ |
| REQ-OFF-007 | Introdução narrativa | [office](features/office.md) | T020 | ☐ |
| REQ-WLD-001 | Mapa em tiles | [world-map](features/world-map.md) | T021 | ☐ |
| REQ-WLD-002 | Locomoção | [catalog](content/catalog.md), [input](design/input.md), [world-map](features/world-map.md) | T021, T039 | ☐ |
| REQ-WLD-003 | Passabilidade | [world-map](features/world-map.md) | T021, T039 | ☐ |
| REQ-WLD-004 | Seletor de dimensão | [contracts-rifts](content/contracts-rifts.md), [input](design/input.md), [world-map](features/world-map.md) | T059 | ☐ |
| REQ-WLD-005 | Briefing de contrato | [world-map](features/world-map.md) | T022 | ☐ |
| REQ-WLD-006 | Eventos de campo | [catalog](content/catalog.md), [world-map](features/world-map.md) | T019, T040 | ☐ |
| REQ-WLD-007 | Retorno à sede | [world-map](features/world-map.md) | T021 | ☐ |
| REQ-WLD-008 | Marcadores bloqueados | [world-map](features/world-map.md) | T022 | ☐ |
| REQ-FLD-001 | Vista de satélite da AOI | [terrain](design/terrain.md), [field-setup](features/field-setup.md) | T017, T023 | ☐ |
| REQ-FLD-002 | Colocação de GCPs e CPs | [catalog](content/catalog.md), [field-setup](features/field-setup.md) | T023, T039 | ☐ |
| REQ-FLD-003 | Acessibilidade por veículo | [catalog](content/catalog.md), [field-setup](features/field-setup.md) | T017, T023, T039 | ☐ |
| REQ-FLD-004 | Indicador de distribuição | [field-setup](features/field-setup.md) | T015, T023 | ☐ |
| REQ-FLD-005 | Seleção de equipamento | [field-setup](features/field-setup.md) | T023 | ☐ |
| REQ-FLD-006 | Parâmetros do plano | [field-setup](features/field-setup.md) | T023 | ☐ |
| REQ-FLD-007 | Estatísticas ao vivo | [domain-math](design/domain-math.md), [field-setup](features/field-setup.md) | T011, T023 | ☐ |
| REQ-FLD-008 | Traçado das linhas | [field-setup](features/field-setup.md) | T014, T023 | ☐ |
| REQ-FLD-009 | Checklist de requisitos | [field-setup](features/field-setup.md) | T018, T023 | ☐ |
| REQ-FLD-010 | Mini-game de nivelamento | [field-setup](features/field-setup.md) | T037 | ☐ |
| REQ-FLD-011 | Mini-game de calibração da IMU | [field-setup](features/field-setup.md) | T038 | ☐ |
| REQ-FLD-012 | Modos especiais de voo | [field-setup](features/field-setup.md) | T014, T034 | ☐ |
| REQ-FLD-013 | Validação para decolar | [field-setup](features/field-setup.md) | T014, T023 | ☐ |
| REQ-FLT-001 | Projeção em perspectiva | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T024 | ☐ |
| REQ-FLT-002 | Terreno com relevo | [architecture](design/architecture.md), [terrain](design/terrain.md), [survey-flight](features/survey-flight.md) | T024 | ☐ |
| REQ-FLT-003 | Decolagem cinematográfica | [survey-flight](features/survey-flight.md) | T024 | ☐ |
| REQ-FLT-004 | Controles de voo | [input](design/input.md), [survey-flight](features/survey-flight.md) | T013, T024 | ☐ |
| REQ-FLT-005 | Linhas como corridas | [survey-flight](features/survey-flight.md) | T024 | ☐ |
| REQ-FLT-006 | Câmera RGB | [survey-flight](features/survey-flight.md) | T024, T035 | ☐ |
| REQ-FLT-007 | Sobreposição real e faixa | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T035 | ☐ |
| REQ-FLT-008 | Motion blur | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T011, T035 | ☐ |
| REQ-FLT-009 | Sensor LiDAR | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T012, T033 | ☐ |
| REQ-FLT-010 | Alternância de sensor | [input](design/input.md), [survey-flight](features/survey-flight.md) | T033 | ☐ |
| REQ-FLT-011 | Obstáculos e colisão | [terrain](design/terrain.md), [survey-flight](features/survey-flight.md) | T028 | ☐ |
| REQ-FLT-012 | Iluminação | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T029 | ☐ |
| REQ-FLT-013 | Vento e térmicas | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T013, T030 | ☐ |
| REQ-FLT-014 | Energia e RTH | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T013, T031 | ☐ |
| REQ-FLT-015 | Comportamento de Atlas | [catalog](content/catalog.md), [survey-flight](features/survey-flight.md) | T032 | ☐ |
| REQ-FLT-016 | Terrain Following | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T013, T034 | ☐ |
| REQ-FLT-017 | Rolling shutter | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T011, T035 | ☐ |
| REQ-FLT-018 | HUD de voo | [survey-flight](features/survey-flight.md) | T024, T035 | ☐ |
| REQ-FLT-019 | Fim da surtida e da missão | [survey-flight](features/survey-flight.md), [world-map](features/world-map.md) | T024, T031 | ☐ |
| REQ-FLT-020 | Interferência eletromagnética | [contracts-rifts](content/contracts-rifts.md), [survey-flight](features/survey-flight.md) | T030 | ☐ |
| REQ-FLT-021 | Clima especial | [contracts-real](content/contracts-real.md), [survey-flight](features/survey-flight.md) | T029, T055 | ☐ |
| REQ-FLT-022 | Perda de RTK em cânions urbanos | [contracts-real](content/contracts-real.md), [survey-flight](features/survey-flight.md) | T030, T053 | ☐ |
| REQ-FLT-023 | Aceleração de tempo | [input](design/input.md), [survey-flight](features/survey-flight.md) | T036 | ☐ |
| REQ-FLT-024 | Detecção furtiva e alvos especiais | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [survey-flight](features/survey-flight.md) | T018, T036 | ☐ |
| REQ-PRC-001 | Esteira SfM | [processing-results](features/processing-results.md) | T025, T043 | ☐ |
| REQ-PRC-002 | Velocidade por hardware | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T025 | ☐ |
| REQ-PRC-003 | Calibração de lente | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T043 | ☐ |
| REQ-PRC-004 | Tabela de resíduos e RMSE | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T016, T025 | ☐ |
| REQ-PRC-005 | Penalidades de acurácia | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T016, T043 | ☐ |
| REQ-PRC-006 | Classificação cartográfica | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T016, T025 | ☐ |
| REQ-PRC-007 | Mapa de calor de sobreposição | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T015, T025 | ☐ |
| REQ-PRC-008 | Visualizador de produtos | [processing-results](features/processing-results.md) | T041, T042 | ☐ |
| REQ-PRC-009 | Pagamento e recompensas | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T018, T025 | ☐ |
| REQ-PRC-010 | Enviar ao Museu | [processing-results](features/processing-results.md) | T025 | ☐ |
| REQ-PRC-011 | Processamento em campo | [processing-results](features/processing-results.md) | T044 | ☐ |
| REQ-PRC-012 | Vetorização pela equipe | [processing-results](features/processing-results.md) | T044 | ☐ |
| REQ-PRC-013 | Volumetria | [contracts-real](content/contracts-real.md), [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T018, T043, T057 | ☐ |
| REQ-HOL-001 | Render 3D orbital | [holo-table](features/holo-table.md) | T026 | ☐ |
| REQ-HOL-002 | Névoa cartográfica | [holo-table](features/holo-table.md) | T026 | ☐ |
| REQ-HOL-003 | Setores mapeados | [holo-table](features/holo-table.md) | T026 | ☐ |
| REQ-HOL-004 | Miniaturas animadas | [holo-table](features/holo-table.md) | T072 | ☐ |
| REQ-HOL-005 | Chave dimensional | [holo-table](features/holo-table.md) | T059, T072 | ☐ |
| REQ-HOL-006 | Modos de exibição | [holo-table](features/holo-table.md) | T072 | ☐ |
| REQ-HOL-007 | Gestão das alas | [holo-table](features/holo-table.md) | T072 | ☐ |
| REQ-HOL-008 | Seleção de setor | [holo-table](features/holo-table.md) | T026 | ☐ |
| REQ-LAB-001 | Óptica e GSD | [infographic-lab](features/infographic-lab.md) | T073 | ☐ |
| REQ-LAB-002 | Estereoscopia e paralaxe | [infographic-lab](features/infographic-lab.md) | T012, T073 | ☐ |
| REQ-LAB-003 | LiDAR vs. fotogrametria no dossel | [infographic-lab](features/infographic-lab.md) | T012, T074 | ☐ |
| REQ-LAB-004 | Global vs. rolling shutter | [infographic-lab](features/infographic-lab.md) | T074 | ☐ |
| REQ-LAB-005 | Reuso do domínio | [domain-math](design/domain-math.md), [infographic-lab](features/infographic-lab.md) | T011, T073, T074 | ☐ |
| REQ-PRG-001 | Saldo | [processing-results](features/processing-results.md), [progression](features/progression.md) | T019 | ☐ |
| REQ-PRG-002 | Aeronaves e sensores por tier | [catalog](content/catalog.md), [progression](features/progression.md) | T010, T045 | ☐ |
| REQ-PRG-003 | Frota terrestre | [catalog](content/catalog.md), [progression](features/progression.md) | T010, T045 | ☐ |
| REQ-PRG-004 | Hardware de processamento | [catalog](content/catalog.md), [progression](features/progression.md) | T010, T045 | ☐ |
| REQ-PRG-005 | Equipe | [catalog](content/catalog.md), [progression](features/progression.md) | T010, T047 | ☐ |
| REQ-PRG-006 | XP e níveis | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md), [progression](features/progression.md) | T019, T046 | ☐ |
| REQ-PRG-007 | Árvore de habilidades | [catalog](content/catalog.md), [progression](features/progression.md) | T019, T046 | ☐ |
| REQ-PRG-008 | Cosméticos | [catalog](content/catalog.md), [office](features/office.md), [progression](features/progression.md), [world-map](features/world-map.md) | T010, T049 | ☐ |
| REQ-PRG-009 | Renda passiva do museu | [domain-math](design/domain-math.md), [holo-table](features/holo-table.md), [progression](features/progression.md) | T019, T050 | ☐ |
| REQ-PRG-010 | Souvenirs | [catalog](content/catalog.md), [processing-results](features/processing-results.md), [progression](features/progression.md) | T025, T050 | ☐ |
| REQ-PRG-011 | Rival MegaMap | [processing-results](features/processing-results.md), [progression](features/progression.md), [world-map](features/world-map.md) | T019, T043, T051 | ☐ |
| REQ-PRG-012 | Reputação | [processing-results](features/processing-results.md), [progression](features/progression.md) | T019, T046, T051 | ☐ |
| REQ-PRG-013 | Milho | [catalog](content/catalog.md), [field-setup](features/field-setup.md), [progression](features/progression.md) | T010, T032, T048 | ☐ |
| REQ-CNT-001 | Contratos reais | [contracts-real](content/contracts-real.md), [data-model](design/data-model.md) | T022, T053, T054, T055, T056, T057, T058 | ☐ |
| REQ-CNT-002 | Fendas | [contracts-rifts](content/contracts-rifts.md), [data-model](design/data-model.md) | T059, T060–T070, T071 | ☐ |
| REQ-CNT-003 | Progressão e desbloqueio | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [progression](features/progression.md) | T019, T071 | ☐ |
| REQ-CNT-004 | Regras especiais | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [data-model](design/data-model.md), [terrain](design/terrain.md) | T052, T053, T054, T055, T056, T057, T058, T060–T070 | ☐ |
| REQ-CNT-005 | Repetição | [contracts-real](content/contracts-real.md), [processing-results](features/processing-results.md), [progression](features/progression.md) | T019, T071 | ☐ |
| REQ-CNT-006 | Guarda de paródias | [contracts-rifts](content/contracts-rifts.md), [architecture](design/architecture.md) | T059, T060–T070, T079 | ☐ |
| REQ-CNT-007 | Diálogos | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [processing-results](features/processing-results.md) | T022, T027 | ☐ |
| REQ-CNT-008 | Final da campanha | [catalog](content/catalog.md), [contracts-real](content/contracts-real.md), [office](features/office.md), [progression](features/progression.md) | T071 | ☐ |
| REQ-NFR-001 | Performance | [holo-table](features/holo-table.md), [survey-flight](features/survey-flight.md) | T007, T077 | ☐ |
| REQ-NFR-002 | Qualidade de build | [architecture](design/architecture.md) | T001, T079 | ☐ |
| REQ-NFR-003 | Cobertura de testes | [architecture](design/architecture.md) | T001, T079 | ☐ |
| REQ-NFR-004 | Resolução e responsividade | [ui-style](design/ui-style.md) | T004, T077 | ☐ |
| REQ-NFR-005 | Zero placeholders | [architecture](design/architecture.md) | T079 | ☐ |
| REQ-NFR-006 | Sem assets externos | [architecture](design/architecture.md) | T001, T079 | ☐ |
| REQ-NFR-007 | Acessibilidade | [ui-style](design/ui-style.md), [survey-flight](features/survey-flight.md) | T004, T075, T078 | ☐ |
| REQ-NFR-008 | Localização pt-BR | [ui-style](design/ui-style.md) | T002 | ☐ |
| REQ-NFR-009 | Navegadores | [architecture](design/architecture.md) | T001, T078 | ☐ |

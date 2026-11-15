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
  - [x] O mesmo `seed` produz a mesma sequência de 1.000 valores.
  - [x] `normal()` tem média ≈ 0 e desvio ≈ 1 em 10.000 amostras (tolerância de 0,05).
  - [x] `fork('x')` é determinístico e independente do consumo do pai.
  - [x] `formatBRL(1234567) === 'R$ 12.345,67'` (normalizando o espaço não separável do Intl).
  - [x] Cobertura de `lib/` ≥ 90 %.
- **Verificação:** `npx vitest run src/lib --coverage`
- **Status:** ✅

### T003 — Tipos canônicos
- **Fase:** F0 · **Depende de:** T002 · **REQs:** — (fundação para todos)
- **Spec:** [data-model](design/data-model.md) (completo)
- **Arquivos:** \+ `src/types/{basics,catalog,progression,contracts,world,mission,report,save}.ts`, `src/types/index.ts`
- **Passos:**
  1. Transcrever **exatamente** as interfaces e unions de [data-model](design/data-model.md).
  2. Exportar tudo de `index.ts`.
  3. Criar um teste de tipos (`expectTypeOf` do Vitest) para 3 objetos de exemplo (Contract, SaveGame, Shot).
- **Aceite:**
  - [x] `npm run typecheck` passa.
  - [x] Nenhum `any`.
  - [x] Os nomes batem com o data-model.
- **Verificação:** `npm run typecheck && npx vitest run src/types`
- **Status:** ✅

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
  - [x] Todos os 16 componentes renderizam na galeria.
  - [x] Testes RTL: `Slider` (teclado ←/→ altera o valor, limites), `Modal` (Esc fecha quando `dismissable`, foco preso), `ToastHost` (máximo 4, expira em 4 s com timers falsos), `DialogueBox` (avanço).
  - [x] Nenhuma cor hex fora de `tokens.ts`/`index.css`, conferido com `grep -rnE "#[0-9a-fA-F]{6}" src/ui src/app`, que deve achar só o arquivo de tokens.
- **Verificação:** `npx vitest run src/ui` · manual: abrir `/?screen=UIKIT`.
- **Status:** ✅

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
  - [x] Teste de tabela: todas as 16 transições aceitas, e todas as outras combinações (42 − 16 = 26) rejeitadas.
  - [x] Em `DEV` lança erro, e em `PROD` (mock de `import.meta.env`) faz `console.warn` sem mudar a tela.
  - [x] É possível navegar por todas as telas pelo shell.
  - [x] O overlay de pausa aparece com Esc e congela `session.paused`.
- **Verificação:** `npx vitest run src/state src/app` · E2E: `tests/e2e/navigation.spec.ts` (percorre T1→T15 pelo shell com `?debug=1`).
- **Notas de implementação:**
  - As guardas que dependem de sistemas futuros ficam na forma mínima e são completadas na tarefa do sistema: T8 exige a missão ativa do payload (o `validatePlan` entra em T023), e T11 exige o setor do contrato em `museum.sectors` (um relatório aprovado sempre esculpe o setor; ver T025).
  - As flags `debug`, `screen`, `contract`, `money` e `skipIntro` já têm efeito. `unlockAll` é aplicada em T010 (itens) e T022 (contratos), `autopilot` em T024 e `seed` em T019/T040 (eventos e rival).
  - O painel de depuração (`DebugPanel`) vive dentro do `DebugScreenShell`. O atalho `F9`, para abri-lo por cima das telas reais, entra em T020, quando a primeira tela real existir.
  - A posição inicial do avatar é o centro do mapa até T021 definir o tile de spawn `@`.
- **Status:** ✅

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
  - [x] Testes: round-trip save/load; JSON truncado → backup criado + novo jogo; campo ausente → idem; migração fictícia v0→v1 (registrar `MIGRATIONS[0]` de teste); settings sobrevivem ao `newGame`.
  - [x] E2E: mudar o saldo via debug (`?money=12345`), recarregar e conferir que persistiu.
- **Verificação:** `npx vitest run src/state` · `npx playwright test tests/e2e/persistence.spec.ts`
- **Status:** ✅

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
  - [x] Teste com rAF falso: `dt = 0,2 s` vira clamp de 0,05 s e 3 sub-passos (com `stepS = 1/60`).
  - [x] `timeScale = 4` multiplica os sub-passos.
  - [x] Pausado = 0 updates e 1 render.
  - [x] O canvas mantém a nitidez em DPR 2 (largura do buffer = 2 × CSS).
- **Verificação:** `npx vitest run src/engines`
- **Status:** ✅

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
  - [x] Testes do [input §6](design/input.md), 6 casos.
  - [x] Na galeria, o glyph troca ao apertar uma tecla ou um botão de controle real (verificação manual com controle, se disponível).
  - [x] Os modais navegam com as setas e fecham com Esc.
- **Verificação:** `npx vitest run src/input` · manual: `/?debug=1&screen=UIKIT`.
- **Notas de implementação:** a verificação manual com um controle físico não foi possível no ambiente de desenvolvimento. O gamepad foi coberto por testes com `navigator.getGamepads` mockado (Xbox e DualSense, botões, eixos, gatilhos, repetição), e o teclado, por E2E no Chromium. A troca de glyph com controle real fica para a auditoria de T078. Decisões em ADR-022.
- **Status:** ✅

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
  - [x] Testes do [audio §5](design/audio.md), 5 casos.
  - [x] Todos os sons tocam no SoundBoard (manual: ouvir e conferir que soam distintos e sem cliques estourados).
- **Verificação:** `npx vitest run src/audio` · manual: SoundBoard.
- **Notas de implementação:**
  - A audição manual não foi possível no ambiente de desenvolvimento. Em seu lugar: o E2E `audio.spec.ts` toca todos os efeitos e os 4 loops (nas 3 variantes de motor) na Web Audio real do Chromium sem erros, e cada receita foi renderizada num `OfflineAudioContext`. Todas soaram (RMS > 0), o pico máximo foi 0,41 (sem saturação) e a cauda depois do fim ficou ≈ 0 (sem estalos). A audição fica para a revisão manual do marco M1.
  - Integrações já ligadas: `UI_CLICK` no `Button` e `DENIED` no `spend` recusado (progression §4). As demais da tabela de audio §4 entram nas tarefas de cada sistema (e em T076).
  - `startLoop` aceita `{ variant }` para o `MOTOR` (multirrotor, asa fixa, Atlas). O parâmetro `rate` é a velocidade (MOTOR), a varredura do leque (LIDAR_HUM) ou o fator do hardware (PROCESSING), e `gain` no WIND é a intensidade do vento de 0 a 1.
- **Status:** ✅

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
  - [x] IDs únicos.
  - [x] Toda referência cruzada existe: `compatibleAircraft`, `compatibleSensors`, `rgbSensorId`, `requires` das skills, cosméticos com `unlock` válido.
  - [x] Pixel pitch calculado bate com a coluna "Pixel (µm)" (tolerância de 0,5 %).
  - [x] Cada ramo de skills tem 4 nós que somam 6 pontos.
- **Verificação:** `npx vitest run src/data`
- **Status:** ✅

### T011 — Fotogrametria
- **Fase:** F1 · **Depende de:** T010 · **REQs:** REQ-FLD-007 (*parc.*), REQ-FLT-008 (*parc.*), REQ-FLT-017 (*parc.*), REQ-LAB-005 (*parc.*)
- **Spec:** [domain-math §1, §2](design/domain-math.md)
- **Arquivos:** \+ `src/domain/photogrammetry.ts` + teste
- **Passos:** escrever primeiro os testes G1–G7, G10, G11 e G13. Depois, implementar todas as funções de §1 e §2.
- **Aceite:**
  - [x] Golden values G1–G7, G10, G11 e G13 passam.
  - [x] Propriedade: `gsd` é linear em H (teste com 3 alturas).
  - [x] `blurClass` nos limites 0,5 e 1,0.
  - [x] `obliqueFootprint` limita θ + α/2 a 85°.
  - [x] Cobertura ≥ 95 %.
- **Verificação:** `npx vitest run src/domain/photogrammetry --coverage`
- **Status:** ✅

### T012 — LiDAR e estereoscopia
- **Fase:** F1 · **Depende de:** T011 · **REQs:** REQ-FLT-009 (*parc.*), REQ-LAB-002 (*parc.*), REQ-LAB-003 (*parc.*)
- **Spec:** [domain-math §3, §4](design/domain-math.md)
- **Arquivos:** \+ `src/domain/lidar.ts`, `src/domain/stereo.ts` + testes
- **Aceite:**
  - [x] G8, G9, G14, G15 e G16 passam.
  - [x] A identidade da paralaxe vale (1e-9) para 50 combinações aleatórias seedadas.
  - [x] `lidarRmseZ`/`XY` seguem as fórmulas (3 casos).
- **Verificação:** `npx vitest run src/domain/lidar src/domain/stereo`
- **Status:** ✅

### T013 — Dinâmica de voo e energia (puro)
- **Fase:** F1 · **Depende de:** T012 · **REQs:** REQ-FLT-004 (*parc.*), REQ-FLT-013 (*parc.*), REQ-FLT-014 (*parc.*), REQ-FLT-016 (*parc.*)
- **Spec:** [domain-math §5, §7](design/domain-math.md)
- **Arquivos:** \+ `src/domain/flightPhysics.ts`, `src/domain/energy.ts` + testes
- **Passos:**
  1. Definir `AircraftState`, `FlightInput` e `FlightEnv` (tipos locais exportados).
  2. Implementar `stepAircraft` com todos os limites.
  3. `terrainFollowTargetAlt` recebe uma função `elevationAlong(s)` (sem acoplar ao sampler).
- **Aceite:**
  - [x] G12 (crab) e G17 (sombras) passam.
  - [x] A velocidade nunca sai de [vMin, vMax], em 1.000 passos aleatórios.
  - [x] Asa fixa com `MOVE_X = 1` respeita `aLat ≤ v²/R`.
  - [x] TF sobre uma rampa de 30 % mantém o AGL dentro de ±15 %.
  - [x] `drainPerSecond` no cruzeiro sem vento = 1/endurance.
  - [x] `BLIZZARD_DRAIN` dobra o dreno.
  - [x] `rthRequired` dispara no limiar.
- **Verificação:** `npx vitest run src/domain/flightPhysics src/domain/energy`
- **Notas de implementação:** `FlightEnv` recebe a elevação sob a aeronave e uma função `elevationAhead(d)`, usada pelo TF (sem acoplar ao sampler). O estado guarda a velocidade lateral comandada (`vLat`) separada da deriva (`drift`). Detalhes de dinâmica não fixados na spec em OQ-006.
- **Status:** ✅

### T014 — Planejador de voo
- **Fase:** F1 · **Depende de:** T013 · **REQs:** REQ-FLD-008 (*parc.*), REQ-FLD-012 (*parc.*), REQ-FLD-013 (*parc.*)
- **Spec:** [domain-math §2.6](design/domain-math.md), [field-setup §5.3, §5.5](features/field-setup.md)
- **Arquivos:** \+ `src/domain/flightPlanner.ts` + teste
- **Passos:**
  1. `buildFlightPlan(params, contract, catalog): FlightPlan`: linhas centradas, zigue-zague, lead-in/out, malha cruzada e LiDAR primário.
  2. `validatePlan(plan, inventory): PlanValidation`.
  3. `defaultPlanParams(contract, inventory)`.
- **Aceite:**
  - [x] G23 (C00) passa: 6 linhas, 96 fotos, 231,45 s.
  - [x] A malha cruzada gera as linhas perpendiculares (contagem igual à soma).
  - [x] As linhas alternam a direção.
  - [x] `validatePlan` cobre os 5 bloqueios.
  - [x] Teste de propriedade: aumentar q nunca reduz o nº de linhas.
- **Verificação:** `npx vitest run src/domain/flightPlanner`
- **Notas de implementação:**
  - `validatePlan(plan, inventory, contract, catalog)` recebe também o contrato (teto e vento) e o catálogo.
  - `buildFlightPlan` aceita `{ enduranceMod, meanCanopy }` para as baterias e a densidade de solo previstas.
  - Na malha cruzada, o zigue-zague continua pelas linhas perpendiculares, e o tempo de voo usa a mesma fórmula, com o comprimento somado das linhas.
  - A densidade LiDAR média é `lidarDensityWithOverlap` com a sobreposição efetiva `1 − S/faixa`, o que vale tanto com LiDAR quanto com RGB como sensor primário.
  - Avisos de energia: "O voo precisará de N surtidas" e, se faltar energia, "Energia para M de N surtidas". As surtidas disponíveis são 1 + reservas, ou os papos de milho (papo + estoque).
- **Status:** ✅

### T015 — Geometria e cobertura
- **Fase:** F1 · **Depende de:** T014 · **REQs:** REQ-FLD-004 (*parc.*), REQ-PRC-007 (*parc.*)
- **Spec:** [domain-math §6.6, §9](design/domain-math.md)
- **Arquivos:** \+ `src/domain/geometry.ts`, `src/domain/coverage.ts` + testes
- **Aceite:**
  - [x] O casco convexo de um quadrado com ponto interno retorna 4 vértices.
  - [x] A colinearidade de pontos alinhados é < 1e-6, e a de um quadrado é ≈ 1.
  - [x] A rasterização de uma pegada que cobre exatamente 1/4 da AOI marca ≈ 1/4 das células (± 2 %).
  - [x] 5 pegadas sobrepostas na mesma área dão células verdes.
  - [x] Células de água são excluídas.
  - [x] Fotos borradas e de névoa (RGB) não contam.
- **Verificação:** `npx vitest run src/domain/geometry src/domain/coverage`
- **Status:** ✅

### T016 — Acurácia e normas cartográficas
- **Fase:** F1 · **Depende de:** T015 · **REQs:** REQ-PRC-004 (*parc.*), REQ-PRC-005 (*parc.*), REQ-PRC-006 (*parc.*)
- **Spec:** [domain-math §6, §8](design/domain-math.md)
- **Arquivos:** \+ `src/domain/accuracy.ts`, `src/domain/standards.ts` + testes
- **Aceite:**
  - [x] G18 e G25 passam.
  - [x] Cada linha da tabela de multiplicadores (§6.3) tem um teste.
  - [x] `generateResiduals` reproduz exatamente o RMSE-alvo dos CPs (1e-9) e é determinístico por seed.
  - [x] Sem CPs, usa GCP × 1,8.
  - [x] `classifyPec` retorna 'FORA' quando nenhuma classe passa.
  - [x] A regra dos 90 % ≤ PEC é testada com 1 ponto fora em 10.
- **Verificação:** `npx vitest run src/domain/accuracy src/domain/standards`
- **Notas de implementação:**
  - `classifyPec(residuals, M, Eq?, requiredClass = 'A')` recebe a classe exigida para preencher o `PecResult`: `epM`, `pecM` e `pct90` se referem a ela, e `pass` diz se a classe atingida é igual ou melhor.
  - `accuracyMultipliers` lista só os multiplicadores diferentes de 1, com o rótulo pt-BR de `STRINGS.accuracy.multipliers`.
  - `requirementAccuracy(residuals)` centraliza a regra "sem CPs, GCP × 1,8 e não verificável".
- **Status:** ✅

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
  - [x] Determinismo: dois `createTerrain` com a mesma seed → mesmas amostras em 1.000 pontos e mesmos objetos.
  - [x] `elevation` custa < 2 µs/chamada (benchmark Vitest: 100.000 chamadas em < 200 ms).
  - [x] `distanceToRoad` é 0 sobre a estrada.
  - [x] `isAccessible` retorna cada motivo em pontos construídos para isso (água do açude, telhado da casa, longe da estrada com FOOT_BIKE).
- **Verificação:** `npx vitest run src/world src/domain/accessibility`
- **Notas de implementação:**
  - `createTerrain` mora em `world/terrain/createTerrain.ts` (e não em `TerrainSampler.ts`) para evitar import circular com as receitas de bioma, que importam os tipos do sampler. As receitas ficam registradas em `biomes/index.ts`.
  - O sampler expõe, além de architecture §5: `aoi`, `bounds` (AOI + margem de 20 %), `biome`, `palette`, `roads`, `guaranteedAccessible` e `distanceToTrack` (estradas + trilhas). A rede `ROADS` mede por `distanceToRoad`; `ROADS_TRAILS` e `OFFROAD`, por `distanceToTrack`.
  - O telhado (`ROOF`) e a estrada (`ROAD`) são aplicados de forma genérica sobre a cobertura da receita, a partir dos prédios e das polilinhas de via. Sob a copa de uma árvore isolada o dossel é 0,85.
  - `isAccessible` detalha o "fora do alcance" em `TOO_STEEP` e `SWAMP` quando é isso que impede todos os veículos. `snapToAccessible` busca em anéis de 2 m até `maxR`.
  - No `RURAL_TUTORIAL`, a casa, o pomar, as árvores esparsas e a cerca foram posicionados para que os 7 pontos de apoio do plano de referência do C00 fiquem acessíveis a pé.
- **Status:** ✅

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
  - [x] G22 (cone) passa.
  - [x] Cenário golden: uma missão sintética do C00 (shots gerados pelo plano de referência, sem ruído) é aprovada com score ≥ 0,85.
  - [x] Com só 2 GCPs, o requisito `MIN_GCP(3)` (MAJOR) falha: a missão continua aprovada, com o fator ×0,85 no `qualityFactor` e o multiplicador `gcpCount` aplicado.
  - [x] Cada `check.type` é avaliado em ao menos 1 teste.
- **Verificação:** `npx vitest run src/domain/requirements src/domain/mission src/domain/volumetrics src/domain/features`
- **Notas de implementação:**
  - **Contratos entre tarefas:** o fator de qualidade `Q` (§12.1) é calculado em `mission.qualityFactor` e chega pronto ao `computePayment` (T019), que só monta o pagamento. XP e reputação também são injetados (`deps.computeRewards`). Assim, o aceite "×0,85 no qualityFactor" é verificado com o stub.
  - `processingBaseTimeS`, `processingSpeed` e `STAGE_WEIGHTS` (§12.4) estão em `domain/processing.ts`, já com o G21, porque o `QualityReport` exige `processingTimeS`. A calibração de lente (`lensCalibration`) fica para T043.
  - `modifiers.ts` nasce com `neutralModifiers()`; `applyModifiers` vem em T019.
  - `predictRequirements(plan, contract, groundPoints, ctx)` recebe um contexto (catálogo, kit RTK, instrumento, mini-games, modificadores) no lugar do inventário. `estimateFromPlan` faz a previsão de acurácia com fotos ideais: `m̄ = 1/((1 − p)(1 − q))`, sem buracos e com o blur previsto.
  - `evaluateRequirements(plan, measures, contract, catalog)` recebe as medições já calculadas por `evaluateMission`: GSD efetivo, mediana de `p_real`, `q` estimado pelo espaçamento real entre linhas vizinhas, acurácia de requisito, densidades e volume.
  - A captura de features segue contracts-real §1 (`PHOTO`: ≥ 3 fotos válidas cobrindo o centro; `LIDAR`: ≥ 50 pulsos/m² na célula do centro). Cobertura de missões LiDAR em OQ-008.
  - O PRNG da missão é injetado (`ctx.rng`) e bifurcado em `residuals` e `volume`: o mesmo terreno e a mesma seed dão o mesmo relatório.
  - Correção em T017: com `PAINT_MARKERS`, o dossel também é ignorado (contracts-real §1: "só água e telhado continuam inválidos").
- **Status:** ✅

### T019 — Economia, progressão, modificadores, museu, rival e eventos
- **Fase:** F1 · **Depende de:** T018 · **REQs:** REQ-PRG-001, REQ-PRG-006, REQ-PRG-007 (*parc.*), REQ-PRG-009 (*parc.*), REQ-PRG-011 (*parc.*), REQ-PRG-012 (*parc.*), REQ-CNT-003 (*parc.*), REQ-CNT-005 (*parc.*), REQ-WLD-006 (*parc.*)
- **Spec:** [domain-math §12, §13](design/domain-math.md), [progression](features/progression.md)
- **Arquivos:** \+ `src/domain/{economy,progression,modifiers,museum,rival,fieldEvents}.ts` + testes
- **Aceite:**
  - [x] G19, G20, G21 e G24 passam.
  - [x] `canBuy`, com todas as razões.
  - [x] `addXp` com múltiplos níveis.
  - [x] `applyModifiers` cumulativo.
  - [x] `evaluateUnlock`, recursivo.
  - [x] Roubo e retorno.
  - [x] Replay a 0,4.
  - [x] `rollFieldEvent` determinístico, respeitando o cooldown e o veículo.
  - [x] `offlineIncome` limitada a 2 h.
- **Verificação:** `npx vitest run src/domain --coverage` (≥ 90 % em `domain/`)
- **Notas de implementação:**
  - `computePayment(input, roles = STAFF)` recebe o fator de qualidade pronto, calculado por `mission.qualityFactor` (ver T018); G20 é testado com `qualityFactor(0,8, …)`. `computeRewards` aplica a regra de replay: numa falha crítica em repetição, a reputação cai no máximo 3.
  - O G21 (`processingBaseTimeS`) já foi implementado e testado em T018 (`domain/processing.ts`).
  - Loja: `canBuy(item, state)` usa `PURCHASE_PREREQUISITES` do catálogo (tier anterior, VTOL para o pod, hardware anterior). `purchaseItems` expande o combo T2 e `addItems` aplica a compra: hardware substitui, o pod traz a câmera RGB embutida e o Drone T1 vem com a câmera de 20 MP.
  - Portfólio do rival: `ContractProgress.bestClass` guarda a classe PEC atingida, ou `ASPRS-H5` / `ASPRS` / `FORA` nas missões ASPRS (`portfolioClass`). Convencem o cliente a classe `A` ou a `ASPRS-H5`.
  - Museu: `museumIncomePerMin` devolve centavos possivelmente fracionários, e `accrueIncome` credita os inteiros, guardando a fração em `carryCents`.
- **Status:** ✅

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
  - [x] Os critérios 1, 3 e 5 de [office §8](features/office.md), estes últimos restritos aos 4 hotspots.
  - [x] A TopBar mostra saldo, nível/XP, reputação e renda (0).
- **Verificação:** `npx vitest run src/screens/office src/app` · E2E `office.spec.ts` (intro → porta).
- **Notas de implementação:**
  - A TopBar é montada pelo `App` acima do `ScreenRouter` nas 4 telas de REQ-UI-003, inclusive nas que ainda usam o shell.
  - Com o escritório real, o painel de depuração passa a abrir com **F9** (`DebugOverlay`, só com `?debug=1`). Nas telas servidas pelo shell, continua embutido.
  - A mesa holográfica do escritório mostra, por enquanto, um relevo de linhas animadas; o mini-render do museu com o `soft3d` entra em T026.
  - A navegação espacial segue input §5 à risca: no layout da sala, da Mesa a seta → leva ao Laboratório (mais próximo na diagonal) e, do Laboratório, ← leva à Mesa. Os 4 hotspots são alcançáveis a partir da Porta (E2E com busca em largura pelas setas).
- **Status:** ✅

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
  - [x] Os testes de mapa (dimensões, legenda) e de BFS para **todos** os marcadores × veículos passam, inclusive os 4x4-only.
  - [x] O avatar anda com WASD/setas/analógico e para nos tiles bloqueados com a dica.
  - [x] Entrar na sede volta ao `OFFICE`.
  - [x] ≥ 58 FPS (overlay).
- **Verificação:** `npx vitest run src/world src/engines/overworld` · manual: andar pelo mapa todo com `?debug=1`.
- **Notas de implementação:**
  - A posição do avatar é contínua, em tiles: o centro do tile (x, y) é (x + 0,5, y + 0,5). O avatar de um novo jogo nasce no centro do spawn `@`, e sair pela Porta do escritório o recoloca ali. Os retornos do campo (T7, T10, T13) mantêm a posição salva.
  - O zoom é 1,5 × (largura / 1280), entre 1 e 3: sempre cerca de 27 tiles na horizontal.
  - Os chunks pré-renderizados ficam num cache LRU de 20 (cada um ocupa alguns MB com DPR 2). Os visíveis cabem com folga.
  - O `INTERACT` chega como ação discreta (`InputManager.onAction`), e não por `pressed()` dentro dos sub-passos, que poderiam vê-lo mais de uma vez no mesmo frame.
  - A distância percorrida vai para `stats.distanceTiles` pela nova ação `addStats`, junto com a gravação da posição a cada 1 s e na saída.
  - Os marcadores 0–6 aparecem em ciano. As cores por status e o briefing entram em T022. As fendas ficam ocultas até a aba Fendas (T059).
  - O sprite a pé é o único por enquanto. Os veículos e o `CYCLE_VEHICLE` são de T039.
  - O veículo mínimo de R05 (`e`) não está na ficha do contrato. O layout do mapa o põe atrás do cinturão `A`: ver OQ-009.
  - Medição: 58–60 FPS no Chromium headless a 1280 × 720, andando por vários chunks.
- **Status:** ✅

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
  - [x] A viabilidade do C00 passa.
  - [x] O critério 1 de [world-map §8](features/world-map.md) passa.
  - [x] Testes RTL do briefing nos 4 estados.
- **Verificação:** `npx vitest run src/data/contracts src/screens/world`
- **Notas de implementação:**
  - O `museum.slot` numérico codifica (col, lin) da ficha como `lin · 4 + col` (grade 4 × 2 da ala): `museumSlot` e `museumSlotCoords` em `src/data/contracts/museum.ts`. O C00 fica no slot 6.
  - `refreshUnlocks` roda depois de `changeReputation` e, em silêncio, ao carregar o save: contratos que entraram no catálogo depois do save chegam `LOCKED` e já são reavaliados. Também roda em `applyMissionResult` e na compra de veículo quando essas ações existirem.
  - `startMission(contractId, rivalAdjustment)` cria a missão `PLANNING` com `defaultPlanParams` e o primeiro equipamento de campo possuído. A contraproposta da MegaMap entra em T051; até lá, o Aceitar usa o fator 1.
  - Pelo teclado, o briefing abre ao **soltar** a tecla de `INTERACT`: o Espaço solto com o modal já aberto "clicaria" a caixa de diálogo, que recebe o foco. Pelo gamepad, abre na hora.
  - Os marcadores 1–6 só aparecem quando os contratos entrarem no catálogo. Sem progresso salvo, um contrato conta como bloqueado.
  - Os nomes das iluminações ("Sol alto", "Nublado", "Hora dourada", "Nevasca", "Névoa mágica") não constam da spec e foram definidos em `STRINGS.lighting`.
  - Depuração: o painel F9 no mapa ganhou "Teleportar para marcador", e `?unlockAll=1` passa a liberar todos os contratos (os concluídos continuam concluídos).
  - O `C00_FIXTURE` dos testes de domínio foi substituído pelo C00 real.
- **Status:** ✅

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
  - [x] Os critérios 1, 2, 3 e 6 de [field-setup §8](features/field-setup.md).
  - [x] As estatísticas recalculam em < 16 ms (`performance.now` em teste).
  - [x] A sugestão automática de GCPs funciona no C00.
- **Verificação:** `npx vitest run src/screens/field src/engines/field` · E2E `field.spec.ts`.
- **Notas de implementação:**
  - O raster tem 512 px no lado **maior** e segue a proporção da área (AOI + margem), para não esticar o pixel: 512 × 341 no C00. É gerado uma vez por sampler (cerca de 140 ms) e guardado num `WeakMap`. O sampler é o mesmo `createTerrain(contract)` memoizado do voo (REQ-FLD-001).
  - Os objetos vistos de cima (telhados, copas) e suas sombras são desenhados numa camada por iluminação. A sombra vai para SE, oposta ao sol de NO (o azimute de 315° do hillshade; a spec não fixa o do sol). Com luz difusa não há sombra.
  - Pan pelo teclado (WASD) e pelo analógico esquerdo; arrastar com o botão direito ou do meio; zoom pela roda, em torno do cursor. A **retícula de gamepad** de §5.1 fica para T078 (REQ-INP-006).
  - Pontos: as recusas trazem os números ("Declividade 45 % > 30 %", "Fora do alcance (189 m da via mais próxima > 150 m)"), tocam `DENIED` e piscam no mapa. O σ dos pontos só é calculado na decolagem (`launchMission`).
  - Esc: na aba 1 pede para cancelar; nas abas 2 e 4 volta para a anterior.
  - Checklist: requisito previsto em falha aparece ⚠ se for `MINOR` e ✗ nos demais.
  - Malha cruzada: as perpendiculares cobrem a outra dimensão da AOI, então o total só "dobra" em AOIs quadradas (no C00 com o DRONE_T1 a 80 m: 5 + 7 linhas).
  - A iluminação mostra as consequências num texto abaixo das abas, em vez de tooltip.
  - Depuração: a transição T6 do painel F9 também cria a missão (`startMission`), como o Aceitar do briefing.
- **Status:** ✅

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
  - [x] Teste de draw list (morro oclui objeto). Nesta tarefa, o "objeto" pode ser um GCP_TARGET marcado como teste.
  - [x] O critério 1 de [survey-flight §8](features/survey-flight.md), com autopilot.
  - [x] Pausa congela o voo (E2E).
  - [x] ≥ 55 FPS em Alta no C00 (overlay, manual).
- **Verificação:** `npx vitest run src/engines/flight src/screens/flight` · E2E `flight.spec.ts`.
- **Notas de implementação:**
  - `buildDrawList` e `renderTerrain` percorrem a grade pela mesma função (`traverse`), com um destino diferente: a lista de comandos nos testes e o canvas no jogo. Assim a ordem testada é a desenhada.
  - Curvas de nível: em cada quad, todos os níveis cruzados (até 6), não só o maior; com faixas largas ao longe, um nível só pularia as mestras.
  - Sombreamento: com sol, ambiente 0,45 + difusa 0,65 (a spec fixa só os valores da luz difusa, 0,75 + 0,25).
  - O primeiro disparo automático de cada linha sai ao entrar na janela `[aoiStartS − B, aoiEndS + B]`, e os seguintes pelo temporizador; assim a série fica alinhada com a base do plano (16 fotos por linha no C00).
  - A duração da surtida conta o tempo real das curvas (a apresentação dura até 2,5 s) e 4,5 s de decolagem e pouso. O tempo de voo do plano reserva 20 s para isso, então a surtida do C00 dura ~216 s contra 231 s previstos.
  - Energia esgotada encerra a surtida como `ENERGY_DEPLETED` (dados descartados), ainda sem a animação de queda, que entra com as colisões (T028).
  - O autopilot de depuração voa a ×8 (o `TIME_WARP` do jogador entra em T036) e confirma "Levar dados" 1,5 s depois do pós-voo, para o E2E ver o diálogo.
  - O HUD lê um snapshot publicado a 10 Hz de tempo real. O minimapa do HUD é um SVG.
  - A transição de depuração T8 lança a missão (`launchMission`), e o mapa mostra o toast "Dados salvos…" ao voltar com `outcome = 'QUEUED'`.
  - Medição: 60 FPS em Alta a 1280 × 720 no C00 (Chromium headless).
- **Status:** ✅

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
  - [x] Os critérios 1, 2 e 4 de [processing-results §8](features/processing-results.md).
  - [x] Recarregar durante a esteira não aplica as recompensas.
- **Verificação:** `npx vitest run src/screens/processing src/engines/raster` · E2E `processing.spec.ts`.
- **Notas de implementação:**
  - O relatório é calculado uma vez na montagem (LOADING) com o RNG seedado pelo id da missão: recarregar e reprocessar dá o mesmo resultado. As recompensas só entram no REPORT, por `applyMissionResult`, que tira a missão da fila (ou da missão ativa, em campo) antes de tudo; as chamadas seguintes devolvem `false`.
  - `lensCalibration` (domain-math §12.4) entrou já aqui, porque a etapa 3 da esteira e a aba Acurácia usam o erro de reprojeção e os parâmetros. O `qualityProduct` é o produto dos multiplicadores XY. T043 fica com o restante de REQ-PRC-003.
  - O museu recebe o setor no REPORT (só se o score for maior); "Enviar à Mesa do Museu" apenas navega (T11).
  - Rótulo dos multiplicadores: "(×v)" quando XY e Z são iguais; senão, "(XY ×a, Z ×b)", omitindo o eixo neutro. Com 3 GCPs colineares, o casco tem área zero e o XY também é penalizado: "Geometria dos GCPs (XY ×2,50, Z ×3,00)".
  - Roubo: ver OQ-010. Sem outro contrato jogável, a MegaMap não leva o contrato. Os roubados voltam a `AVAILABLE` quando outro contrato é concluído (progression §8), o que já está no `applyMissionResult`.
  - A esteira avança no `GameLoop` (congela na pausa) e toca `STAGE_DONE` por etapa e o loop `PROCESSING` com `rate` = fator de velocidade.
  - Os ícones dos souvenirs passaram a ser registrados em `souvenirs.ts` (antes caíam no ícone de reserva).
- **Status:** ✅

### T026 — Motor `soft3d` e Mesa Holográfica v1
- **Fase:** F2 · **Depende de:** T025 · **REQs:** REQ-HOL-001, REQ-HOL-002, REQ-HOL-003, REQ-HOL-008
- **Spec:** [holo-table](features/holo-table.md) §5.1, §5.2, §5.3 (só `ORTHO`), §5.6 (sem dimensão e modos)
- **Arquivos:** \+ `src/engines/soft3d/{vec3,mat4,OrbitCamera,Renderer,picking}.ts`, `src/engines/holo/{HoloEngine,sceneBuilder}.ts`, `src/screens/holo/{HoloTableScreen,SectorCard}.tsx` + testes · ~ `OfficeRenderer` (preview da mesa) · ~ etapa 4 da esteira (nuvem 3D)
- **Aceite:**
  - [x] O critério 1 de [holo-table §8](features/holo-table.md).
  - [x] Testes de `mat4`, `OrbitCamera` (clamp) e `pickSector`.
  - [x] O *fly-to* e a animação de esculpir funcionam ao chegar do processamento.
  - [x] ≥ 55 FPS em Alta.
- **Verificação:** `npx vitest run src/engines/soft3d src/engines/holo` · E2E `holo.spec.ts` (parcial).
- **Notas de implementação:**
  - Painter's algorithm e polígonos grandes: o tampo de vidro da mesa (leque de triângulos) tinha profundidade média menor que a de setores sobre ele e os cobria. Malhas marcadas como `background` são desenhadas antes, fora da ordenação.
  - Backface culling pela área assinada do quad projetado; quads com vértice atrás da câmera são descartados inteiros.
  - Os slots da grade sem contrato no catálogo aparecem em gesso sem nome ("Setor não mapeado"); os do catálogo em névoa mostram "Contrato: <nome> — não mapeado".
  - O AOI (retangular) é mapeado no setor 1 × 1. A altura dos prédios usa a mesma escala do relevo, limitada a 0,5 unidade, com amplitude mínima de 10 m para relevos muito planos.
  - Miniaturas: `trajectoryAt` percorre as linhas da melhor missão e as ligações entre elas num ciclo de 12 s. O sprite reaproveita os de `aircraftSprite`, com a unidade em px ajustada.
  - Esc na mesa: o voltar vem de uma camada de foco (`onBack`), e não de um ouvinte global, que deixava o Esc cair também no fallback de pausa.
  - O preview do escritório (`HoloPreview`) e a etapa 4 da esteira (nuvem 3D) usam o mesmo `soft3d`.
  - Medição: 57–60 FPS em Alta na mesa, com o C00 esculpido.
- **Status:** ✅

### T027 — Integração do Vertical Slice
- **Fase:** F2 · **Depende de:** T026 · **REQs:** REQ-CORE-004 (*parc.*: E2E), REQ-CNT-007 (*parc.*: tutorial dirigido)
- **Spec:** [contracts-real C00 (tutorial dirigido)](content/contracts-real.md), [README §Marcos](README.md)
- **Arquivos:** \+ `tests/e2e/slice.spec.ts`, `src/screens/common/TutorialHint.tsx` · ~ as telas, para as dicas de `tutorialStep`
- **Passos:**
  1. Dicas do tutorial dirigido nas 5 telas.
  2. E2E completo com `?debug=1&autopilot=1&skipIntro=1`: escritório → porta → teleporte (F9) para C00 → aceitar → sugestão de GCPs → decolar → autopilot → levar dados → andar ou teleportar à sede → Workstation → processar → enviar ao museu → mesa mostra o setor.
  3. Recarregar no meio (após o voo) e verificar a missão pendente preservada.
- **Aceite:**
  - [x] `slice.spec.ts` verde.
  - [x] Tutorial: as dicas aparecem uma vez cada e avançam `tutorialStep`.
  - [x] Nenhum `DebugScreenShell` é usado no fluxo do C00 (o `INFOGRAPHIC_LAB` ainda usa o shell).
- **Verificação:** `npm run verify && npm run e2e`
- **Notas de implementação:**
  - Cada dica aparece só na etapa corrente de `flags.tutorialStep` e avança com "Entendi" ou com a ação que ela ensina: abrir o briefing (0), ter ao menos 3 GCPs (1), mexer na altura (2), terminar a surtida (3) e abrir a aba Cobertura (4).
  - O painel F9 no mapa ganhou o teleporte "Sede" (porta), além dos marcadores.
  - `slice.spec.ts` cobre o fluxo inteiro com o autopilot a ×8, recarrega a página depois do voo (a missão segue na fila pelo autosave) e confere que nenhuma tela usou o `DebugScreenShell`.
  - Revisão manual do M1 (jogar o C00 sem depuração em ≤ 10 min): não feita por pessoa. Estimativa pelo próprio jogo: intro ~1 min, caminhada até o C00 ~10 s, planejamento ~1 min, voo ~3,6 min a ×1 (216 s), volta e processamento ~1 min no notebook (≈ 13 s de esteira). Cerca de 7 min no total.
- **Status:** ✅

> **Marco M1 — Vertical Slice jogável.** Revisão manual: jogar o C00 do zero, sem debug, em ≤ 10 min.

---

# F3 — Voo completo

### T028 — Objetos 2.5D, colisão, dano e queda
- **Fase:** F3 · **Depende de:** T027 · **REQs:** REQ-FLT-011
- **Spec:** [survey-flight §5.4, §5.11](features/survey-flight.md), [terrain §4](design/terrain.md)
- **Arquivos:** \+ `src/engines/flight/{objectRenderer,collision,effects}.ts` · ~ `FlightEngine`, `missionSlice.endSortie` (descarte) · ~ `ruralTutorial` (árvores e casa como sólidos)
- **Aceite:**
  - [x] Testes de `checkCollision` para cada forma (caixa, cilindro, esfera, fio, arco com vão livre, beam on/off).
  - [x] O critério 2 de [survey-flight §8](features/survey-flight.md).
  - [x] Uma queda descarta só os dados da surtida (teste do slice).
  - [x] Atlas "volta para casa" sem custo de reparo.
- **Verificação:** `npx vitest run src/engines/flight`
- **Notas de implementação:**
  - `collision.ts` é puro: recebe o terreno por `groundAt` e o estado de feixes e móveis por `t` (`isBeamOn`, `motionOffset`). Formas: caixa com rotação, árvore (tronco r = 0,6 + copa esférica no topo), PIPE/POLE (cilindros), fio (distância 3D ao segmento, raio 0,5), arco (duas colunas de 20 % da largura + viga de 20 % da altura, vão livre), feixe (só ligado) e perigo móvel (esfera). Anel, holofote e alvo não colidem.
  - A copa da árvore e a viga do arco são proporções minhas (a spec dá só o raio da copa e que o vão é livre).
  - `makeObject` passou a repassar `motion`, `activePeriod`, `u2`/`v2` e `collectible`, que os biomes de fenda vão usar.
  - Colisão com objeto: casco −1, velocidade a 30 %, 1,5 s de invulnerabilidade (pisca; com `reduceFlashes`, translúcida), shake de 0,3 s a 8 px (desligado com `reduceFlashes`) e `CRASH`. Casco 0, terreno ou energia esgotada iniciam a fase `CRASHED` (2 s: gira, cai e solta fumaça) e só então encerram a surtida.
  - As colisões da surtida somam em `events.collisions` mesmo quando os dados são descartados; `events.crashes` conta só as quedas.
  - Atlas: o pós-voo mostra "Atlas se assustou e voltou para casa". O custo de reparo já é zero porque o preço do Atlas é R$ 0 (teste).
  - `objectRenderer.ts` desenha cada tipo (caixa com 3 faces, árvore, cilindros, fio com catenária, arco, anel, feixe com pulso, perigo com sombra, holofote). O render da árvore e da casa do C00 usa o mesmo código.
  - O índice de objetos é por `u`, então a busca de colisão usa uma janela de ±40 m em torno da aeronave.
- **Status:** ✅

### T029 — Iluminação, céu, sombras e clima
- **Fase:** F3 · **Depende de:** T028 · **REQs:** REQ-FLT-012, REQ-FLT-021
- **Spec:** [survey-flight §5.3 (névoa, água), §5.4 (sombras), §5.5](features/survey-flight.md), [contracts-real §1](content/contracts-real.md) (BLIZZARD_DRAIN visual, MAGIC_FOG, SPECULAR_WATER)
- **Aceite:**
  - [x] As 5 iluminações produzem paletas e sombras distintas (snapshot da draw list: presença e comprimento dos polígonos de sombra).
  - [x] `SPECULAR_WATER` + `SUN_HIGH` marca `overWater` e desenha o brilho.
  - [x] `MAGIC_FOG` marca `inFog`.
  - [x] As partículas de neve respeitam o vento.
  - [x] `reduceFlashes` desliga o shake.
- **Verificação:** `npx vitest run src/engines/flight` · manual: `?debug=1&screen=SURVEY_FLIGHT&contract=C00` alternando a iluminação no plano.
- **Notas de implementação:**
  - As sombras entram na draw list (`SHADOW`, com o comprimento de `shadowLengthM`) antes do objeto da faixa, só em `SUN_HIGH` e `GOLDEN_HOUR`. Fios, anéis, postes, feixes, holofotes e alvos não projetam. Direção: oposta ao sol de SE (§5.3).
  - O brilho especular (`GLINT`) é uma elipse branca aditiva e cintilante no centro de cada quad de água, só com `SPECULAR_WATER` sob `SUN_HIGH`. A spec fala em "posição refletida do sol"; a posição exata ficou simplificada.
  - `overWater` e `inFog` já eram marcados por `recordShot`; a regra de validade (que zera a cobertura) é de `isShotValid`. Foram acrescentados testes.
  - Partículas (`particles.ts`): neve (260) com a deriva proporcional ao vento cruzado e vaga-lumes (60), no máximo 300, com RNG seedado. Poeira da mina e faíscas elétricas entram com os biomas e a regra `ELECTRIC_CREATURES`.
  - O dreno 2× do `BLIZZARD_DRAIN` já vinha do T024. O shake desligado com `reduceFlashes` é de T028.
  - Os contratos reais não oferecem todas as janelas ao mesmo tempo; o manual com 5 janelas depende dos contratos de F7.
- **Status:** ✅

### T030 — Vento, térmicas, EM e RTK
- **Fase:** F3 · **Depende de:** T029 · **REQs:** REQ-FLT-013, REQ-FLT-020, REQ-FLT-022
- **Spec:** [survey-flight §5.13](features/survey-flight.md), [domain-math §5](design/domain-math.md)
- **Aceite:**
  - [x] HUD de vento e crab.
  - [x] Deriva proporcional ao `driftFactor` × `windDrift`.
  - [x] `STRONG_WIND` acima da tolerância dobra a deriva e emite o alerta.
  - [x] Térmicas somam lift.
  - [x] EM com ruído (Atlas imune, testado).
  - [x] `rtkStatusAt` com zonas de teste.
  - [x] Fotos registram `rtk`.
- **Verificação:** `npx vitest run src/engines/flight src/domain/flightPhysics`
- **Notas de implementação:**
  - A deriva dobra sempre que `mean + gust` passa de `windToleranceMs` da aeronave (a spec liga isso à regra `STRONG_WIND`, que o contrato com vento ≥ 8 m/s declara; aplicar pela tolerância cobre os dois casos e o aviso do plano). O alerta é `WIND_LIMIT`.
  - As térmicas somam `thermalLiftMs` das zonas `THERMAL` do terreno (× `thermalEffect` das skills, metade sem `SUN_HIGH`). A distorção visual do ar sobre a zona não foi feita.
  - EM: tremor lateral de ±0,8 m/s somado ao X e deriva de rumo de ±3° (lenta) somada ao `crab` das fotos; Atlas imune. O glitch de scanlines no HUD sai com `reduceFlashes`.
  - O rumo da EM só afeta o registro das fotos; a aeronave não gira visualmente.
  - RTK: o `onRtkChange` dispara um toast "RTK FLOAT — multipercurso GNSS" ao entrar no cânion; as fotos registram `rtk`. As zonas `RTK_CANYON` vêm do gerador do bioma urbano (T052), então aqui foram testadas com zonas fabricadas.
- **Status:** ✅

### T031 — Energia, RTH e múltiplas surtidas
- **Fase:** F3 · **Depende de:** T030 · **REQs:** REQ-FLT-014, REQ-FLT-019
- **Spec:** [survey-flight §5.12](features/survey-flight.md), [architecture §2 (T16)](design/architecture.md)
- **Aceite:**
  - [x] O critério 5 de [survey-flight §8](features/survey-flight.md).
  - [x] RTH com confirmação e timeout.
  - [x] "Nova surtida" retoma na 1ª linha incompleta e consome a bateria reserva.
  - [x] Sem reservas, o botão some.
  - [x] T16 "Tentar de novo" funciona sem dados.
  - [x] O plano C05 (2 baterias) é completável com autopilot em 2 surtidas.
- **Verificação:** `npx vitest run src/engines/flight` · E2E `flight-sorties.spec.ts`.
- **Notas de implementação:**
  - RTH: o 1º `R` abre a confirmação (3 s, "Retornar à base? [R] confirmar / [Esc] cancelar" no HUD); o 2º dentro da janela inicia `RETURNING` (3 s, sobe) e a surtida termina `RTH`, com os dados mantidos e a linha corrente incompleta. O Esc cancela e também pausa (no contexto `FLIGHT` o Esc não tem `UI_BACK`).
  - A "base" para a distância de volta é o início da primeira linha do plano. O limiar é o de `rthRequired` (energia < máx(20 %, 1,2 × tempo de volta × dreno de cruzeiro)); o bip `RTH_BEEP` toca a cada 1,5 s enquanto durar.
  - "Nova surtida" (`canStartNewSortie`): linhas incompletas e, para multirrotor e asa fixa, bateria sobrando (`1 + reservas − surtidas`); para o Atlas, milho em estoque (a ação enche o papo). O voo é remontado com um engine novo, que começa na 1ª linha incompleta, com os disparos continuando do índice anterior.
  - O consumo de milho durante o voo do Atlas (e o papo como energia inicial) é de T032: aqui a energia de toda surtida começa em 100 %.
  - O plano do C05 (2 baterias) só existe em T054; o critério foi coberto com o DRONE_T1 e a resistência reduzida a 30 % por modificador: o autopilot completa as 6 linhas do C00 em 2 surtidas (`RTH` + `COMPLETED`). O autopilot confirma o RTH e a nova surtida sozinho.
  - `flight-sorties.spec.ts` usa o Atlas (milho em estoque), sem autopilot.
- **Status:** ✅

### T032 — Comportamento de Atlas
- **Fase:** F3 · **Depende de:** T031 · **REQs:** REQ-FLT-015, REQ-PRG-013 (*parc.*: consumo de milho em voo)
- **Spec:** [survey-flight §5.15](features/survey-flight.md), [catalog §8](content/catalog.md)
- **Aceite:**
  - [x] Distração seedada, com aviso, força lateral e cancelamento por contrabalanço.
  - [x] HUD com milho.
  - [x] Nova surtida enche o papo a partir do estoque.
  - [x] Calibração reduz a penalidade (teste no `accuracy` via `atlasCalibrated`).
- **Verificação:** `npx vitest run src/engines/flight`
- **Notas de implementação:**
  - Distração (`atlas.ts`): ao começar cada linha, sorteia-se com p = 0,15 um instante e um lado, seedados por `hash(missão:surtida)` e pela linha (determinístico). Aviso de 1 s ("Atlas avistou sementes!"), depois força lateral de 4 m/s por 2–3 s; segurar o lado oposto com intensidade > 0,7 por 0,5 s encerra antes.
  - A spec tem duas formulações: força de 4 m/s por 2–3 s (survey-flight §5.15, ≈ 8–12 m de desvio) e "desvio-alvo de ±20 m" (catalog §8). Segui a de survey-flight, a normativa do voo; o desvio de 20 m não é alcançado.
  - Milho: o papo parte de `crop / 10` como energia; a decolagem alimenta o pombo (enche o papo com o estoque); ao fim da surtida o milho consumido (`⌈energia usada × 10⌉`) sai do papo. A "Nova surtida" realimenta pelo estoque.
  - HUD: "🌽 × n · % tempo restante". O cálculo de 10 unidades = 600 s está testado; a calibração da câmera (1,30 → 1,15 com `atlasCalibrated`) já tinha teste em `accuracy` (T016).
- **Status:** ✅

### T033 — Sensor LiDAR e alternância
- **Fase:** F3 · **Depende de:** T032 · **REQs:** REQ-FLT-009, REQ-FLT-010
- **Spec:** [survey-flight §5.9, §5.10](features/survey-flight.md), [domain-math §4.4](design/domain-math.md)
- **Arquivos:** \+ `src/engines/flight/lidarSensor.ts` · ~ `missionSlice.mergeLidar`
- **Aceite:**
  - [x] O critério 4 de [survey-flight §8](features/survey-flight.md).
  - [x] O acúmulo na grade bate com `lidarDensityWithOverlap` ± 10 % no centro da AOI após um voo de autopilot (teste de integração do engine, sem render).
  - [x] Amostras limitadas a 50.000.
- **Verificação:** `npx vitest run src/engines/flight`
- **Notas de implementação:**
  - O acúmulo reparte `PRR · dt` pulsos por até 96 × 4 pontos da faixa `v·dt × swath` sob a aeronave; cada ponto soma na célula 64 × 64 que o contém, com `ground = pulsos · P_solo(dossel)` (dossel 1 sobre telhado) e `firstAbove = pulsos · dossel`. Num voo de autopilot do C00 (DRONE_T2 + Pod, H 60 m, q 60 %), a densidade no centro da AOI fica a ±10 % de `lidarDensityWithOverlap` (teste).
  - Os lotes (células + amostras) ficam no sensor durante a surtida e entram na missão no **fim** dela (`endSortie` → `mergeLidar`), e não a cada 0,5 s como diz a spec: assim uma queda ou energia esgotada descarta os dados LiDAR da surtida sem precisar desfazer fusões, como o descarte das fotos.
  - Visual: 24 feixes em `θ(t − k·δ)` com o impacto na superfície (copa ou solo), e os impactos persistem 1,5 s (ciano no 1º retorno, esmeralda no solo). O raymarch contra objetos (passo de 2 m) não foi feito: o impacto usa `surface(u, v)` no ponto do feixe.
  - `TOGGLE_SENSOR` (Tab, 1, 2): cooldown de 0,5 s; sem Pod é no-op com o toast "Sem LiDAR a bordo"; no LiDAR não há disparo automático nem manual ("Ative a câmera [Tab]"). `LIDAR_HUM` toca enquanto o LiDAR é o sensor ativo, com `rate` = frequência de varredura, e para ao sair.
  - Uma linha só de LiDAR conta como completa se houve pulsos na janela da AOI.
  - Risco: até 50.000 amostras por missão vão no save (localStorage, ≈ 2 MB). Se estourar a cota, o autosave avisa (T006); T077 pode reduzir a amostragem.
- **Status:** ✅

### T034 — Modos especiais em voo (TF, malha cruzada, oblíqua)
- **Fase:** F3 · **Depende de:** T033 · **REQs:** REQ-FLT-016, REQ-FLD-012
- **Spec:** [survey-flight §5.6, §5.7](features/survey-flight.md), [field-setup §5.3](features/field-setup.md), [domain-math §2.8](design/domain-math.md)
- **Aceite:**
  - [x] TF sobre um terreno de teste com rampa mantém o AGL ≤ 15 % de desvio.
  - [x] As linhas cruzadas voam após as primárias.
  - [x] Na oblíqua, a pegada desenhada é deslocada e trapezoidal e os shots registram `tiltDeg`.
  - [x] Os toggles no Field Setup aparecem conforme a aeronave.
- **Verificação:** `npx vitest run src/engines/flight src/screens/field`
- **Notas de implementação:**
  - Com TF, a decolagem sobe até H acima do terreno sob a aeronave (e não H sobre a cota média), e o autopilot não corrige a altitude: o AGL-alvo é mantido pela física (`terrainFollowTargetAlt`). Numa rampa de 10 %, o AGL fica a ≤ 15 % de 60 m; sem TF, passa disso (teste).
  - As linhas cruzadas já vinham depois das primárias no plano; o engine as voa na mesma ordem, e o rumo delas é perpendicular (teste com o DRONE_T1).
  - Oblíqua: `obliqueCorners` desenha o trapézio de domain-math §2.8, deslocado à frente em `centerOffsetM`, com a borda distante mais larga. Os disparos registram `tiltDeg`; a cobertura já usava a pegada oblíqua (T015).
  - O `Shot` guarda a pegada nadir em `footprintWM/HM`: a pegada oblíqua é recalculada de `aglM` e `tiltDeg` onde for preciso.
  - Os toggles de modo (aba 2) já apareciam conforme a aeronave desde T023; entrou o teste RTL para Atlas, T1, Condor e Albatroz.
- **Status:** ✅

### T035 — Alertas de qualidade e disparo manual
- **Fase:** F3 · **Depende de:** T034 · **REQs:** REQ-FLT-006, REQ-FLT-007, REQ-FLT-008, REQ-FLT-017, REQ-FLT-018
- **Spec:** [survey-flight §5.8, §5.17](features/survey-flight.md)
- **Aceite:**
  - [x] Os critérios 3 e 6 de [survey-flight §8](features/survey-flight.md).
  - [x] Disparo manual com cooldown.
  - [x] Rolling shutter com skew registrado e pegada cisalhada.
  - [x] Fila de alertas respeita a prioridade (máximo 2).
  - [x] HUD completo (todos os campos do snapshot).
- **Verificação:** `npx vitest run src/engines/flight src/screens/flight`
- **Notas de implementação:**
  - A maior parte desta tarefa já existia desde T024 (disparo manual com cooldown, alertas de overlap, blur e pouca luz, fila de no máximo 2 por prioridade); entraram os testes dos critérios 3 (velocidade +30 % → `OVERLAP INSUFICIENTE`) e 6 (`reduceFlashes` sem overlay branco).
  - Pegada cisalhada: com movimento lateral (ou em curva), a borda da frente do trapézio desloca `skewPx × GSD` (em metros) para o lado do movimento. O skew continua registrado em cada `Shot`: câmeras de obturador global, como a do Atlas, têm skew 0.
  - Novos alertas: `CRASH_IMMINENT` (AGL < 5 m e descendo, ou casco = 1) e `MIN_SPEED` ("VELOCIDADE MÍNIMA", asa fixa no vMin; o stall não é modelado). O contador de fotos pulsa a cada disparo, exceto com `reduceFlashes`.
  - O alerta `DETECTED` e os campos `detectedProgress` e `rings` do snapshot entram com os holofotes e os anéis (T036).
- **Status:** ✅

### T036 — Aceleração de tempo e elementos de fenda
- **Fase:** F3 · **Depende de:** T035 · **REQs:** REQ-FLT-023, REQ-FLT-024
- **Spec:** [survey-flight §5.13, §5.14](features/survey-flight.md), [contracts-real §1](content/contracts-real.md) (`SEARCHLIGHTS`, `MOVING_HAZARDS`, `ENERGY_BEAMS`, `COLLECTIBLE_RINGS`, `ELECTRIC_CREATURES`, `FEATURE_TARGETS`)
- **Aceite:**
  - [x] *Time warp* com as regras de volta para ×1 (teste).
  - [x] Holofote: detecção em 1,5 s (Atlas 3 s).
  - [x] Anéis coletados somam.
  - [x] Features avaliadas no fim da surtida.
  - [x] Picos elétricos seedados.
  - [x] Hazards móveis e beams com estado por `t`.
  - [x] Cada regra tem uma cena de teste num bioma sintético (`src/world/terrain/biomes/testArena.ts`, usado só em testes).
- **Verificação:** `npx vitest run src/engines/flight`
- **Notas de implementação:**
  - `fieldElements.ts` reúne a lógica pura (holofote, anéis, picos elétricos, regras do time warp); o engine a chama a cada passo do `RUN`. A arena sintética está em `src/world/terrain/biomes/testArena.ts` (plana, com objetos, zonas e alvos sob medida) e cada regra tem uma cena em `fieldElements.test.ts`.
  - Holofote: a spec não define a geometria da mancha. Interpretei `sweepRad` como a amplitude do giro (`ângulo = sweepRad · sin(2π t / período)`), com a mancha a 50 % do raio da zona e raio de 35 % dele. Detecção: mais de 1,5 s seguidos dentro (Atlas: 3 s); sair do cone zera; a detecção é permanente na surtida e o voo continua. `events.detected` vale mesmo que a surtida seja perdida.
  - Time warp (tecla T): ×1 → ×2 → ×4 → ×1, só no `RUN`. Volta a ×1 com objeto sólido a < 150 m à frente e |X − Xobj| < 15 m, com alerta **crítico** ativo (a spec diz "prioridade ≥ 2"; adotei qualquer alerta de nível crítico), fora do `RUN` ou com holofote a < 100 m. O autopilot de depuração segue a ×8.
  - Anéis: coletados a < 3 m do centro (em 3D), com som `COLLECT` e o anel some. Só contam se a surtida não for perdida. O bônus de R$ 50 por anel entra no `evaluateMission` (`payment.ringBonusBRL`) só em contratos com `COLLECTIBLE_RINGS`, e aparece na aba Pagamento.
  - Picos elétricos: seedados por missão, de 8 a 12 s, 2 s de 3 m/s para o lado sorteado; o Atlas é imune (`emImmune`). O glitch do HUD também liga durante o pico. As faíscas visuais não foram desenhadas.
  - Features: `capturedFeatures` roda no fim de cada surtida com as fotos e os pulsos acumulados de todas as surtidas, e vai para `events.featuresCaptured` (só sem queda). A exigência de sensor térmico das tocas `DEN_*` continua na avaliação dos requisitos.
  - Hazards móveis e feixes têm o estado calculado por `t` (T028); aqui entraram os testes de cena.
- **Status:** ✅

> **Marco M2 — Motor de voo completo.**

---

# F4 — Campo e mundo

### T037 — Mini-game de nivelamento (bolha)
- **Fase:** F4 · **Depende de:** T036 · **REQs:** REQ-FLD-010
- **Spec:** [field-setup §5.4](features/field-setup.md)
- **Arquivos:** \+ `src/engines/field/minigames/bubble.ts`, `src/domain/minigameScoring.ts`, `src/screens/field/CalibrationTab.tsx` + testes
- **Aceite:**
  - [x] `scoreBubble` é puro e testado.
  - [x] O critério 5 de [field-setup §8](features/field-setup.md), com input simulado.
  - [x] `levelScore` alimenta o σ dos GCPs e é visível no texto.
  - [x] A aba 3 aparece no wizard.
- **Verificação:** `npx vitest run src/domain/minigameScoring src/engines/field`
- **Notas de implementação:**
  - `scoreBubble(samples)` recebe `{ d, dtS }[]` (distância e passo de cada amostra), para não depender do tamanho do sub-passo. Se as amostras cobrem menos de 8 s, é o caso do nível travado: extrapola a média e aplica o piso de 0,9.
  - `BubbleSim` (`engines/field/minigames/bubble.ts`) segue a física da spec: deriva por `valueNoise2D` (120 px/s², varia no tempo), chutes de 250 px/s² a cada 1,5–3 s, arrasto 2,5, entrada de 400 px/s² e raio máximo de 150 px. A spec não dá a duração do chute: usei 0,2 s. O estado inicial é a 40 px do centro, em direção sorteada. A seed é `hash(missionId) + tentativa`, então repetir o jogo muda a cena.
  - Entrada: WASD ou analógico (eixos `MOVE` do contexto `FIELD`) ou arrastar com o mouse, que puxa a bolha para o ponteiro com ganho cheio a partir de 60 px.
  - Critério 5 testado com um controlador PD como jogador simulado (5 seeds, todos ≥ 0,9). Sem entrada, a média de 10 seeds fica abaixo de 0,5; uma seed ou outra, por sorte, trava sozinha.
  - `recordMinigame('level' | 'imu', score)` guarda a melhor pontuação da missão. O σ dos GCPs sai de `gcpSigma` com o `levelScore` (já usado em `launchMission` e nas previsões) e aparece no texto da aba: "Precisão do apoio: σ = X cm", mais "Base RTK nivelada: FIX mais estável" com kit RTK e aeronave RTK.
  - A aba 3 mostra só o nivelamento por enquanto; a lemniscata (IMU) entra na T038.
- **Status:** ✅

### T038 — Mini-game de calibração da IMU (lemniscata)
- **Fase:** F4 · **Depende de:** T037 · **REQs:** REQ-FLD-011
- **Spec:** [field-setup §5.4](features/field-setup.md)
- **Aceite:**
  - [x] `scoreLemniscate` é puro: um cursor exatamente sobre o guia dá 1, e um cursor a 40 px dá 0.
  - [x] O `imuScore` aplicado reduz a deriva no voo e o multiplicador `imu` na acurácia.
- **Verificação:** `npx vitest run src/domain/minigameScoring src/engines/field`
- **Notas de implementação:**
  - `scoreLemniscate(distâncias)` é `clamp(1 − média/40)`; o `LemniscateSim` amostra a distância a 30 Hz (360 amostras em 12 s, qualquer que seja o passo). O guia dá 2 voltas em 12 s sobre a curva de Bernoulli com `a = 200 px`.
  - Cursor: o mouse (só passar sobre o canvas, sem clicar) tem prioridade; sem ele, os eixos `MOVE` movem o cursor a 350 px/s. A aba 3 passa a ter os dois mini-games, um por vez (iniciar um encerra o outro). Vale a melhor pontuação da missão, e sem jogar o `imuScore` é 0.
  - "Deriva giroscópica (°/h)": a spec só diz que cai com a pontuação. Defini `20 · (1 − 0,8·score)`: 20 °/h sem calibrar, 4 °/h com score 1. É só leitura de HUD, com o valor em tempo real durante o jogo.
  - Efeito no jogo: não há deriva de IMU separada no voo. O `imuScore` entra pelo multiplicador `imu` da acurácia (`1 − 0,08s` em XY, `1 − 0,12s` em Z) e pelo ruído do LiDAR (`1 − 0,12s`), que já liam `mission.minigames.imuScore`; o teste em `mission.test.ts` confirma o multiplicador e a queda do RMSE.
- **Status:** ✅

### T039 — Veículos: locomoção no mapa e acessibilidade de campo
- **Fase:** F4 · **Depende de:** T038 · **REQs:** REQ-WLD-002, REQ-WLD-003, REQ-FLD-002, REQ-FLD-003
- **Spec:** [world-map §5.2–§5.3](features/world-map.md), [catalog §4, §5](content/catalog.md), [field-setup §5.2](features/field-setup.md)
- **Aceite:**
  - [x] `CYCLE_VEHICLE` entre os possuídos.
  - [x] Sprites por modo.
  - [x] Velocidades da tabela.
  - [x] Recusa ao trocar para um modo inválido no tile.
  - [x] Field Setup usa a união dos veículos.
  - [x] Toggle de instrumento (Estação Total / GNSS) com os limites.
  - [x] O critério 4 de [world-map §8](features/world-map.md).
- **Verificação:** `npx vitest run src/engines/overworld src/domain/accessibility src/screens/field`
- **Notas de implementação:**
  - `V` (`CYCLE_VEHICLE`) agora é tratado em `WorldMapScreen`: `nextVehicle` (worldSlice) dá o próximo modo entre os possuídos, e `OverworldEngine.switchRefusal(next)` testa se a caixa do avatar cabe no tile atual com o novo modo. Se não cabe, o modo não muda e a dica é a de `blockedHint` (ex.: "Fora de estrada — carros não passam; troque para A Pé [V]"). Pausado, `V` não faz nada.
  - Sprites em `engines/overworld/vehicleSprites.ts` (o avatar a pé saiu do engine para lá): carro, picape (com caçamba) e van (com janelas e antena), girados para os 4 rumos, nas cores da skin. O modo `FOOT_BIKE` é um só: mostra o ciclista quando está em movimento sobre via (estrada pavimentada, de terra ou ponte) e o pedestre no resto.
  - A tabela de velocidades de catalog §5 já estava em `data/catalog`; o teste `vehicles.test.ts` agora a confere célula a célula (15 tiles × 4 veículos) e mede que 1 s de movimento percorre exatamente `tiles/s`.
  - Field Setup: a união dos veículos já valia (`isAccessible`); passou a ter teste de tela (com a picape, um ponto vedado a pé é aceito).
  - Toggle de instrumento: com os dois equipamentos, `GroundPointsTab` mostra [Estação Total | GNSS RTK], que grava `mission.fieldEquipmentId` (`setFieldEquipment`, só entre os possuídos) e muda o σ. Os limites (20 pontos, GCP ≤ 12, CP ≤ 8) seguem o kit GNSS enquanto ele for possuído, independentemente do instrumento escolhido (catalog §4). `placePoint` passou a validar o limite por tipo (`PointLimits`), com a recusa "Limite do instrumento (N)" do que estourou.
- **Status:** ✅

### T040 — Eventos de campo
- **Fase:** F4 · **Depende de:** T039 · **REQs:** REQ-WLD-006
- **Spec:** [world-map §5.5](features/world-map.md), [catalog §12](content/catalog.md)
- **Arquivos:** \+ `src/data/fieldEvents.ts`, `src/screens/world/FieldEventModal.tsx` + testes
- **Aceite:**
  - [x] Os 6 eventos implementados, com efeitos e escolhas.
  - [x] Seed fixa gera a sequência esperada (teste de domínio já existe; aqui, teste RTL do modal e da aplicação dos efeitos).
  - [x] Pausa congela os timers do evento.
- **Verificação:** `npx vitest run src/screens/world`
- **Notas de implementação:**
  - Dados em `src/data/fieldEvents.ts` (efeitos, custos e durações do catalog §12); o estado do evento em curso vive em `engines/overworld/fieldEventRuntime.ts`, uma classe sem React nem store, com efeitos injetados. `screens/world/fieldEventDeps.ts` a liga à store, ao áudio e aos textos, e `FieldEventModal.tsx` tem o modal (pneu, marco, proprietário) e o banner do gado.
  - Sorteio: o engine chama `onTile` a cada tile inteiro percorrido; a tela faz `rollFieldEvent` com `mulberry32(createdAt ⊕ tiles·φ)`, em que `tiles = stats.distanceTiles + distância ainda não gravada`. O jogo não tem uma "seed global" própria; usei o `createdAt` do save. O intervalo de 20 s usa o relógio de parede (`world.lastEventAt` em segundos, via `markFieldEvent`). Um sorteio só vale se não houver outro evento em curso.
  - FLAT_TIRE: avatar parado e modal sem fechar. "Trocar pneu" vira a barra de 10 toques (`INTERACT` ou `UI_CONFIRM`, porque o modal põe o contexto de input em UI); "Guincho" debita R$ 150 e fica desabilitado sem saldo. CATTLE: bloqueio de 3 s com banner e contagem em décimos; cada buzina (`INTERACT`) tira 1 s, com som `RTH_BEEP`, e o toque não abre porta/marcador. LOST_BENCHMARK: +50 XP e R$ 100 entram na hora, com `COLLECT`, toast e diálogo curto. SUSPICIOUS_OWNER: autorização (reputação ≥ 40: +1; senão −1) ou café (−R$ 50, +1; sem saldo, não vale). SUDDEN_RAIN: velocidade × 0,7 por 15 s e partículas (riscos inclinados, em tela). ATLAS_FINDS_CORN: +3 no estoque, `PIGEON_COO` e toast; a spec não exige o Atlas como aeronave, então vale sempre.
  - Pausa: os timers (gado e chuva) andam em `runtime.update(dt)`, que o `GameLoop` não chama pausado; a buzina também é ignorada pausado. Teste de tela confirma o congelamento.
  - Novas ações da store: `grantXp` (a lógica de XP e toasts de nível saiu de `applyMissionResult`), `addCorn` e `markFieldEvent`.
  - O teste de "seed fixa gera a sequência esperada" continua no domínio (`fieldEvents.test.ts`); a tela aceita um `eventRuntime` por prop só para os testes.
- **Status:** ✅

---

# F5 — Processamento e produtos

### T041 — Rasters de produto (Orto, MDS, MDT, NDVI)
- **Fase:** F5 · **Depende de:** T040 · **REQs:** REQ-PRC-008 (*parc.*)
- **Spec:** [processing-results §5.7](features/processing-results.md)
- **Arquivos:** \+ `src/engines/raster/products.ts`, `src/screens/processing/ProductViewer.tsx` + testes
- **Aceite:**
  - [x] Os 4 rasters têm 256², são determinísticos e geram em fatias sem travar (cada fatia < 8 ms).
  - [x] Máscaras de sem-dados e hachuras.
  - [x] Abas indisponíveis com o motivo (critério 5 de [processing-results §8](features/processing-results.md)).
  - [x] Features capturadas são marcadas.
- **Verificação:** `npx vitest run src/engines/raster src/screens/processing`
- **Notas de implementação:**
  - `engines/raster/products.ts`: `ProductJob(kind, inputs)` gera Orto, MDS, MDT e NDVI em 256 × 256 (a spec diz "256 × 256 sobre a AOI", então o pixel não é quadrado e o canvas é esticado por CSS à proporção da AOI; a prévia antiga do `orthoPreview` segue em 256 no lado maior). As fatias são por orçamento de tempo (`runSlice(4 ms)`): cada tarefa é uma linha do raster ou a sombra de um objeto, bem menor que a fatia, e o teste mede cada fatia < 8 ms nos 4 produtos (com `GOLDEN_HOUR`, o pior caso). As fatias não alteram o resultado. O ruído é por hash da seed da missão.
  - Ortofoto: cobertura × hillshade; luz difusa achata o relevo; `GOLDEN_HOUR` põe tom quente e sombras longas (caixa deslocada para SE, a mesma direção da vista de satélite). Células com < 3 fotos ficam borradas (média ao longo de u) e com ruído; sem foto, ou excluídas (água), viram xadrez cinza (`noData`). MDS: `surface` + ruído do RMSE_z do relatório, na rampa hipsométrica × hillshade. MDT: `elevation`; sob dossel > 0,6 sem LiDAR vira hachura diagonal; com LiDAR, a hachura só fica onde a densidade de solo < 1 pt/m², e células com solo < 1 pt/m² são suavizadas (média 3 × 3). NDVI: rampa vermelho → amarelo → verde com histograma de 22 faixas.
  - `productModel.ts` decide a disponibilidade e o motivo (tooltip da aba): Orto exige fotos RGB válidas e câmera RGB/multiespectral; MDS, fotos válidas ou LiDAR; MDT, LiDAR ou fotos com área aberta; NDVI, câmera multiespectral. Foto "válida" é a de `isShotValid` (sem borrão, névoa em RGB ou reflexo na água).
  - `ProductViewer.tsx` gera um produto por vez, uma fatia por frame, com cache por produto, barra de progresso, legendas (elevação, NDVI, sem-dados, hachura) e marcadores com rótulo das features capturadas (`events.featuresCaptured`) sobre o raster. A aba "Produtos" e o botão "Ver produtos" entraram no relatório; a "Nuvem / TIN" é a T042.
  - Ajustei `castsShadow` para exportado (`terrainRenderer`).
- **Status:** ✅

### T042 — Visualizador de nuvem de pontos e TIN
- **Fase:** F5 · **Depende de:** T041 · **REQs:** REQ-PRC-008
- **Spec:** [processing-results §5.7](features/processing-results.md), [holo-table §5.1](features/holo-table.md)
- **Aceite:**
  - [x] Nuvem fotogramétrica (cores da orto) e nuvem LiDAR (cores por retorno).
  - [x] Toggle TIN.
  - [x] Órbita por mouse e gamepad.
  - [x] 30.000 pontos a ≥ 50 FPS.
- **Verificação:** `npx vitest run src/screens/processing` · manual com `?debug=1&screen=PROCESSING_RESULTS`.
- **Notas de implementação:**
  - `engines/raster/pointCloud.ts`: `CloudJob` monta a cena em fatias de tempo (mesmo padrão do `ProductJob`; o teste mede cada fatia < 8 ms). Fotogrametria: até 30.000 pontos numa grade com jitter sobre a AOI, só em células com dados, com a elevação do MDS e a cor do pixel da orto (se a orto ainda não foi gerada, gera antes; sem orto, hipsometria). Os pontos são agrupados por cor em baldes de 4 bits por canal, um `PointSet` por balde. LiDAR: as amostras da missão (até 50.000) são reduzidas a 30.000 em passo regular, com 1º retorno ciano, intermediário violeta e solo verde (tokens `COLORS`). TIN: 65 × 65 vértices sobre o MDS, com arestas horizontais, verticais e uma diagonal por célula (64 × 64 células), em wireframe ciano.
  - Cena em unidades próprias (a AOI cabe em [−1, 1]); relevo plano ganha exagero vertical automático (altura-alvo de 0,45, no máximo ×10).
  - `PointCloudView.tsx` usa `OrbitCamera` e `Soft3DRenderer` (os mesmos da Mesa): arrastar orbita, a roda dá zoom e o analógico direito (`LOOK_X/Y`) e os gatilhos (`ZOOM`) funcionam no controle. O relatório roda no contexto `UI`, que não tinha eixos; acrescentei a ele só `LOOK_X`, `LOOK_Y` (analógico direito) e `ZOOM`, sem tocar nas setas, que seguem na navegação de foco (teste em `InputManager.test.ts`).
  - A aba "Nuvem / TIN" fica entre o MDT e o NDVI. Com fotos e LiDAR na mesma missão, aparece a escolha de origem (LiDAR é o padrão, se há LiDAR). Toggle "Mostrar malha TIN" desligado por padrão; legenda com contagem de pontos e as cores dos retornos. Disponível com fotos válidas ou LiDAR.
  - Desempenho: o teste projeta e desenha a nuvem cheia (30.000 pontos + TIN) com o `Soft3DRenderer` e um contexto sem custo de raster, e exige < 20 ms por quadro (≥ 50 FPS); a medição de FPS real num navegador fica para a revisão manual.
  - Nos testes de tela, a nuvem pronta sai de um `requestAnimationFrame` fora de `act`; é preciso um `act` vazio para o loop do canvas ligar antes de simular o controle.
- **Status:** ✅

### T043 — Relatório completo e esteira LiDAR
- **Fase:** F5 · **Depende de:** T042 · **REQs:** REQ-PRC-001, REQ-PRC-003, REQ-PRC-005, REQ-PRC-013, REQ-PRG-011 (*parc.*: comparativo)
- **Spec:** [processing-results §5.3, §5.5, §5.6 (camada LiDAR)](features/processing-results.md)
- **Aceite:**
  - [x] Esteira LiDAR nas missões LiDAR e as duas em sequência nas mistas.
  - [x] Multiplicadores listados com rótulos pt-BR.
  - [x] Calibração de lente determinística.
  - [x] Volumetria exibida quando exigida.
  - [x] Card do comparativo MegaMap.
  - [x] O critério 2 de [processing-results §8](features/processing-results.md).
- **Verificação:** `npx vitest run src/screens/processing src/engines/raster`
- **Notas de implementação:**
  - Planejamento das etapas: `domain/processing.pipelineShares(fotos, pulsos)` divide T entre as esteiras (só fotos → SfM; só pulsos → LiDAR; as duas, proporcional a 0,08 s por foto e 0,12 s por milhão de pulsos; sem dados, SfM) e `pipelineModel.planStages` monta a lista: SfM e depois LiDAR, cada uma com os pesos das 6 etapas, e a vetorização da equipe (10 % de T) por último. A tela decide a trilha pelos dados da missão (fotos e `mission.lidar`), não pelo contrato.
  - `Pipeline` lista as etapas pelo plano (rótulos da LiDAR em `STRINGS.processing.stagesLidar`), com o título de cada trilha só quando as duas rodam. `engines/raster/lidarViz.ts` traz os 6 visuais: trajetória SBET com o σ (2,5 cm com RTK e kit, 6 cm sem, × `1 − 0,12·imuScore`), georreferenciamento com o contador de pontos, histograma de discrepâncias que estreita de 12 para 3 cm, classificação (cinza → cor do retorno numa varredura), MDT/MDS por varredura e exportação do LAS (375 B de cabeçalho + 30 B por ponto, valor meu: a spec só pede "barra de tamanho").
  - Já existiam, e ganharam teste de tela: calibração de lente (determinística, teste de domínio de T012), volumetria (só aparece se o relatório a traz, ou seja, quando o contrato a exige), multiplicadores com rótulos em `STRINGS.accuracy.multipliers` (teste confere que todos são pt-BR, sem códigos soltos) e o critério 2 (3 GCPs colineares, T022).
  - Card do comparativo MegaMap na aba Acurácia (`MegaMapCard`, `engines/raster/megaMap.ts`): a orto de 192 px de lado deformada por barril (k = 0,28) e deslocada de 2 a 6 m (módulo e direção por hash da seed da missão), com "RMSE declarado: ± 1,5 m (sem pontos de controle)", o selo "Reprovado PEC-PCD" e, abaixo, o RMSE planimétrico e a classe do jogador para comparar.
  - `ReportAccuracy` passou a receber `mission` (a seed do card).
- **Status:** ✅

### T044 — Van Lab e etapa da equipe
- **Fase:** F5 · **Depende de:** T043 · **REQs:** REQ-PRC-011, REQ-PRC-012
- **Spec:** [processing-results §5.1](features/processing-results.md), [survey-flight §5.12](features/survey-flight.md)
- **Aceite:**
  - [x] Com a Van, "Processar agora" leva a `PROCESSING_RESULTS` com `inField` e, ao concluir, a `WORLD_MAP` (T13).
  - [x] Fator de 2,5 aplicado.
  - [x] Com equipe, aparece a etapa 7 e os bônus entram no pagamento.
- **Verificação:** `npx vitest run src/screens/processing` · E2E `van.spec.ts` (`?unlockAll=1`).
- **Notas de implementação:**
  - A lógica já existia (T015/T019/T021/T043); esta tarefa a fechou com testes: "Processar agora" (Van + dados) já ia a `PROCESSING_RESULTS` com `inField`, o fator vem de `processingSpeed` (`max(hardware, 2,5)` só em campo, com a Van possuída) e a etapa 7 e os bônus da equipe saem de `planStages` e `computePayment`.
  - Testes de tela (`processing.test.tsx`): com a Van em campo o cabeçalho mostra ×2,5 e, no escritório ou sem Van, o fator do hardware (×1,0 no notebook); a esteira em campo leva 13,68 s ÷ 2,5, aplica o pagamento uma vez, tira a missão da `mission.active` e "Voltar ao mapa" vai a `WORLD_MAP` (T13); com equipe aparece "7 Vetorização automática (equipe)" e "+ equipe" no cabeçalho, e a aba Pagamento traz "× equipe" e "− custo da equipe".
  - E2E `van.spec.ts`: voo do C00 por autopilot com `unlockAll`, clique em "Processar agora" no pós-voo (antes de o autopilot levar os dados ao escritório, 1,5 s depois), esteira, relatório aprovado e volta ao mapa. Com `unlockAll` o hardware vira a nuvem (×15), então o fator 2,5 é conferido nos testes de tela, não no E2E.
- **Status:** ✅

---

# F6 — Progressão

### T045 — Garagem (loja) e upgrade de hardware
- **Fase:** F6 · **Depende de:** T044 · **REQs:** REQ-OFF-003, REQ-OFF-004, REQ-PRG-002, REQ-PRG-003, REQ-PRG-004
- **Spec:** [office §5](features/office.md) (Garagem, Workstation/Hardware), [progression §5](features/progression.md)
- **Arquivos:** \+ `src/screens/office/{GaragePanel,ShopItemCard,HardwarePanel}.tsx` · ~ `OfficeRenderer` (frota visível)
- **Aceite:**
  - [x] O critério 2 de [office §8](features/office.md).
  - [x] Combo T2 com os itens faltantes.
  - [x] Hardware sequencial.
  - [x] Desconto `shopPrice`.
  - [x] Hotspot da Garagem ativo.
- **Verificação:** `npx vitest run src/screens/office`
- **Notas de implementação:**
  - A lógica de loja já estava em `domain/economy` (`canBuy`, `shopPrice`, `purchaseItems` do combo T2, `addItems`); faltava a ação: `buyItem(id)` na store confere `canBuy` com o `shopPrice` das habilidades, debita (transação registrada), entrega os itens, toca `CASH_REGISTER` e chama `refreshUnlocks` (posse de item é condição de contratos). Sem condição, toca `DENIED` e mostra o motivo no toast ("Exige possuir …", "Bloqueado: …", "Saldo insuficiente (faltam R$ X)").
  - `GaragePanel` (hotspot GARAGE, agora ativo): abas Aeronaves, Sensores & Lentes (câmeras, lentes e o pod), Veículos, Equipamento de Campo e Pintura (só as tintas de drone; skins e acessórios do Atlas têm painéis próprios). `ShopItemCard` mostra a tabela compacta de especificações (`shopModel.specRows`), o preço com o desconto (e o original riscado), o estado (Possuído / Comprar / "Bloqueado: Requer <item>") e, na pintura, as cores e o botão Equipar. A compra abre `ConfirmDialog`; sem saldo não há diálogo (o `buyItem` toca `DENIED` direto, como em office §7).
  - Combo T2: o card avisa antes da compra o que já se possui ("só adiciona o que falta, sem reembolso") e a confirmação lista os itens que faltam; o preço é o do T2 (R$ 70.000), com ou sem a câmera.
  - Hardware: a Workstation ganhou a aba Hardware (`HardwarePanel`): Atual, Substituído (os anteriores), Próximo (com Comprar) e os seguintes sem botão; a compra sequencial vem de `PURCHASE_PREREQUISITES`.
  - A frota na garagem do `OfficeRenderer` já crescia com o inventário (`fleetSprites`, testado). Os testes de navegação por teclado do escritório passaram de 4 para 5 hotspots (a Garagem entra entre a Porta e o Laboratório). Testes: `state/shop.test.ts` (critério 2, tiers, combo, hardware, desconto), `GaragePanel.test.tsx` e o E2E de compra em `office.spec.ts`.
- **Status:** ✅

### T046 — Quadro de Carreira: habilidades e perfil
- **Fase:** F6 · **Depende de:** T045 · **REQs:** REQ-PRG-006, REQ-PRG-007, REQ-PRG-012
- **Spec:** [office §5](features/office.md) (Quadro de Carreira), [progression §6, §9](features/progression.md)
- **Aceite:**
  - [x] O critério 4 de [office §8](features/office.md).
  - [x] Árvore com estados (bloqueado, disponível, adquirido).
  - [x] Perfil com faixas de reputação, estatísticas e o rival.
  - [x] **Todos** os 13 modificadores conectados aos consumidores ([progression §6](features/progression.md)), com 1 teste por consumidor.
- **Verificação:** `npx vitest run src/screens/office src/domain/modifiers`
- **Notas de implementação:**
  - Nova ação `unlockSkill(id)` na store: exige pontos e o pré-requisito (`canUnlockSkill`), debita e soma o nó, toca `COLLECT` e mostra o toast; recusa com `DENIED`. `CareerPanel` (hotspot CAREER ativo) tem as abas Habilidades e Perfil; a aba Visual entra na T049.
  - Árvore: 3 colunas (ramos) × 4 nós (`skillTreeModel`): Adquirida, Disponível (pontos e pré-requisito OK; pulsa, e fica estática com `reduceFlashes`) ou Bloqueada, com o motivo ("Requer <nó anterior>" ou "Falta/Faltam N ponto(s)"). A aquisição pede `ConfirmDialog`. Critério 4 testado: 2 pontos, adquirir `PIL_1` → 1 ponto e `windDrift` 0,8.
  - Perfil: nível, barra de XP (`xpToNext`), reputação com a faixa de `reputationBand`, estatísticas (contratos, fotos, tempo de voo, quedas, distância em tiles) e o rival MegaMap (placar de contratos tomados e o histórico de roubos e contrapropostas).
  - Os 13 modificadores: auditei os consumidores e 12 já estavam ligados; o `rivalChance` tem o consumidor `rollCounterOffer` (domínio), mas a chamada na interface (modal de contraproposta ao aceitar o contrato) é a T051. `domain/modifiers.test.ts` traz um teste por consumidor (`driftVelocityMs`, `drainPerSecond`/plano de voo, `stepAvatar`, `thermalLiftMs`, os multiplicadores `skills`, `texture` e `rollingShutter`, `lidarRmseZ`, `computePayment`, `museumIncomePerMin`, `shopPrice`, `computeRewards`, `rollCounterOffer`), mais a cobertura das 13 chaves pelas 12 habilidades e o seletor `selectModifiers`.
  - Os testes de navegação por teclado do escritório viraram uma busca em largura pelas setas sobre os retângulos reais dos hotspots (agora 6 ativos; o E2E também).
- **Status:** ✅

### T047 — Equipe
- **Fase:** F6 · **Depende de:** T046 · **REQs:** REQ-PRG-005
- **Spec:** [progression §7](features/progression.md), [catalog §7](content/catalog.md)
- **Aceite:**
  - [x] Contratar e demitir com limites.
  - [x] Custos aplicados no pagamento.
  - [x] Bonecos desenhados no escritório.
  - [x] Hotspot ativo.
- **Verificação:** `npx vitest run src/screens/office`
- **Notas de implementação:**
  - Ações `hireStaff(role)` e `fireStaff(role)` na store: contratar respeita `maxCount` e cobra `hireCostBRL` via `spend` (sem saldo: `DENIED` e o aviso do que falta; com sucesso, `CASH_REGISTER` e toast); demitir tira 1, sem custo nem reembolso, e recusa com 0 pessoas.
  - `StaffPanel` (hotspot STAFF ativo): um card por função com custo de contratação, custo por contrato processado, bônus de pagamento e de velocidade, quantidade atual / máxima e os botões Contratar (desabilitado no máximo, com o aviso "Equipe completa") e Demitir (desabilitado com 0).
  - Custos no pagamento: já saíam de `computePayment` (T019/T044); o teste de integração contrata um estagiário e um engenheiro e confere, no relatório, o bônus 1 + 0,06 + 0,15, o custo de R$ 500 + R$ 1.800 por contrato, o total e o tempo da esteira ÷ 1,15. Os bonecos e a mesa extra do escritório já eram desenhados por `OfficeRenderer` (`drawStaffDesk`, com teste).
  - O escritório passa a ter 7 hotspots ativos; os testes de teclado (unitário e E2E) cobrem os 7.
- **Status:** ✅

### T048 — Poleiro do Atlas
- **Fase:** F6 · **Depende de:** T047 · **REQs:** REQ-OFF-005, REQ-PRG-013
- **Spec:** [office §5](features/office.md) (Poleiro), [catalog §8](content/catalog.md)
- **Aceite:**
  - [x] Comprar milho, alimentar (limite 10) e calibrar (3 voos).
  - [x] Acessórios.
  - [x] Arrulho ao clicar.
  - [x] Hotspot ativo.
- **Verificação:** `npx vitest run src/screens/office`
- **Notas de implementação:**
  - Ações na store: `buyCorn(pack)` (pacotes de 10 e 50 a R$ 5 a unidade; sem saldo, `spend` avisa e nada muda), `feedAtlas()` (usa `feedCrop`: o papo enche com o estoque, até 10; devolve o que passou e arrulha) e `calibrateAtlas()` (grátis: `atlasCalibrationFlights = 3`, com toast).
  - `PerchPanel` (hotspot PERCH ativo): gauge do papo (n / 10) e do estoque, botões "Comprar 10 (R$ 50)" e "Comprar 50 (R$ 250)", "Alimentar" (desabilitado com a dica "O papo já está cheio" ou "Compre milho"), "Calibrar câmera" (2 s de barra de progresso, só então grava os 3 voos; recalibrar volta a 3, sem acumular) e os acessórios.
  - Acessórios reaproveitam `ShopItemCard`/`buyItem`: o "sem acessório" começa equipado, os de preço fixo se compram e se equipam, e os bloqueados mostram o motivo (a mochila GPS exige o kit GNSS RTK; a coroa de louros, o C03). Ativar o hotspot toca `PIGEON_COO`: é o clique no Atlas do canvas, já que o hotspot cobre o poleiro. O desconto `shopPrice` da Garagem vale para os acessórios (passam por `buyItem`), não para o milho.
  - O escritório tem agora 8 hotspots ativos (testes de teclado, unitário e E2E).
- **Status:** ✅

### T049 — Cosméticos e editor de emblema
- **Fase:** F6 · **Depende de:** T048 · **REQs:** REQ-PRG-008
- **Spec:** [catalog §10](content/catalog.md), [office §5](features/office.md) (Carreira → Visual), [ui-style §2](design/ui-style.md) (`EmblemBadge`)
- **Aceite:**
  - [x] Skins visíveis no mapa (avatar), pinturas no voo e na mesa, acessório do Atlas no voo e no poleiro.
  - [x] O emblema aparece na TopBar, no relatório e no escritório.
  - [x] O editor persiste e valida as iniciais (≤ 4, maiúsculas).
- **Verificação:** `npx vitest run src/screens/office`
- **Notas de implementação:**
  - Aba **Visual** no Quadro de Carreira (`VisualTab`): as skins do personagem (cards com cores, compra por `buyItem`, Equipar/Equipado e o motivo do bloqueio) e o editor de emblema: forma (4), ícone (8), cor principal e secundária (paleta `EMBLEM_PALETTE`) e sigla, com pré-visualização ao vivo. Cada mudança válida já vai para `inventory.emblem` (e, pelo autosave, para o save).
  - Sigla: `domain/emblem.ts` (`sanitizeInitials`, `validInitials`): maiúsculas, só letras e números, de 1 a 4. O campo saneia enquanto se digita; vazio fica inválido na tela (borda e dica em vermelho) e não é gravado. `setEmblem` usa a mesma regra e, com sigla inválida, mantém a anterior.
  - Onde cada cosmético aparece: a skin no avatar do mapa (já vinha de `characterColors`, T021/T039); a pintura no voo (T024) e agora na miniatura do drone da Mesa Holográfica (`HoloEngine.droneColors`; a ave mantém as cores do pombo); o acessório do Atlas no voo (T031) e no poleiro do escritório (T020/T048).
  - O emblema aparece na TopBar (já existia), no Resumo do relatório (`report-emblem`) e na parede do escritório (`office-emblem`, uma placa em HTML sobre o canvas).
  - Testes: `domain/emblem.test.ts`, `VisualTab.test.tsx` (skins, editor, TopBar ao vivo, persistência por `saveFromGameData` → `serializeSave` → `gameDataFromSave`, escritório e relatório) e a pintura na mesa em `HoloEngine.test.ts`.
- **Status:** ✅

### T050 — Museu: renda passiva e estante de relíquias
- **Fase:** F6 · **Depende de:** T049 · **REQs:** REQ-PRG-009, REQ-PRG-010, REQ-OFF-006, REQ-OFF-001
- **Spec:** [progression §10, §11](features/progression.md), [office §5](features/office.md) (Estante)
- **Aceite:**
  - [x] O critério 5 de [progression §14](features/progression.md).
  - [x] Renda offline com toast.
  - [x] Estante com os 18 slots e estados.
  - [x] Todos os 9 hotspots do escritório funcionais (REQ-OFF-001 completo).
- **Verificação:** `npx vitest run src/state src/screens/office`
- **Notas de implementação:**
  - Renda passiva: `tickIncome(nowMs)` credita `renda/min × Δt` desde `museum.lastIncomeAt`, soma os visitantes e guarda as frações de centavo em `session.incomeCarryCents` (a spec fala em `museum.carryCents` "só em memória"; como `museum` vai inteiro para o save, o campo ficou na sessão, que nunca é salva). O crédito entra direto no saldo, sem transação nem toast, para não inundar o histórico a cada 10 s.
  - `state/museumIncome.startMuseumIncome()` é o timer global do `App`: conta os segundos não pausados e chama `tickIncome` a cada 10. Ao pausar, credita o que já correu; durante a pausa só avança o relógio (`syncIncomeClock`), então o tempo pausado não rende.
  - Renda offline: `hydrateGame` chama `applyOfflineIncome(agora)` quando há um save carregado: `offlineIncome` (no máximo 2 h), com a transação "Renda do Museu" e o toast "Enquanto você esteve fora, o Museu rendeu R$ X"; jogo novo ou museu vazio não mostram nada.
  - Critério 5 testado: C00 (0,8) e C01 (1,0), sem destaque, rendem R$ 49,00 em 1 min, de uma vez ou em 6 ticks de 10 s.
  - Estante de Relíquias (`ShelfPanel`, hotspot SHELF): grade 6 × 3 com os 18 souvenirs e a contagem. Obtido: ícone na cor do souvenir, nome e história (no painel de detalhe do nicho escolhido). Não obtido: "?" e "Conclua <título>" se o contrato já está desbloqueado; "???" se está bloqueado ou se o contrato ainda não existe no catálogo.
  - Com a Estante, os 9 hotspots do escritório estão ativos (REQ-OFF-001): um teste abre e fecha cada painel e confere as três trocas de tela; a navegação por teclado (unitário e E2E) cobre os 9.
- **Status:** ✅

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
| REQ-CORE-001 | Máquina de estados de telas | [architecture](design/architecture.md) | T005 | ✅ |
| REQ-CORE-002 | Transição inválida | [architecture](design/architecture.md) | T005 | ✅ |
| REQ-CORE-003 | Pausa | [architecture](design/architecture.md), [survey-flight](features/survey-flight.md) | T005, T007, T075 | ☐ |
| REQ-CORE-004 | Persistência e autosave | [architecture](design/architecture.md), [data-model](design/data-model.md) | T006, T027 | ✅ |
| REQ-CORE-005 | Migração e corrupção de save | [architecture](design/architecture.md), [data-model](design/data-model.md) | T006 | ✅ |
| REQ-CORE-006 | Determinismo | [architecture](design/architecture.md), [terrain](design/terrain.md) | T002, T017 | ✅ |
| REQ-CORE-007 | Flags de depuração | [architecture](design/architecture.md) | T005 | ✅ |
| REQ-CORE-008 | Game loop e Canvas | [architecture](design/architecture.md), [survey-flight](features/survey-flight.md) | T007 | ✅ |
| REQ-CORE-009 | Novo jogo | [architecture](design/architecture.md), [progression](features/progression.md) | T006, T075 | ☐ |
| REQ-INP-001 | Teclado e mouse | [input](design/input.md), [world-map](features/world-map.md) | T008 | ✅ |
| REQ-INP-002 | Detecção de gamepad | [input](design/input.md) | T008 | ✅ |
| REQ-INP-003 | Mapeamento padrão | [input](design/input.md), [world-map](features/world-map.md) | T008 | ✅ |
| REQ-INP-004 | Glyphs dinâmicos | [input](design/input.md) | T008 | ✅ |
| REQ-INP-005 | Deadzone e borda | [input](design/input.md) | T008 | ✅ |
| REQ-INP-006 | Navegação de UI por gamepad | [input](design/input.md), [field-setup](features/field-setup.md), [infographic-lab](features/infographic-lab.md), [office](features/office.md) | T008, T078 | ☐ |
| REQ-AUD-001 | Inicialização preguiçosa | [audio](design/audio.md) | T009 | ✅ |
| REQ-AUD-002 | Catálogo de efeitos | [audio](design/audio.md), [processing-results](features/processing-results.md), [survey-flight](features/survey-flight.md) | T009, T076 | ☐ |
| REQ-AUD-003 | Volume e mudo | [audio](design/audio.md) | T009, T075 | ☐ |
| REQ-UI-001 | Paleta dark geodésica | [ui-style](design/ui-style.md) | T004 | ✅ |
| REQ-UI-002 | Kit de componentes | [ui-style](design/ui-style.md) | T004 | ☐ |
| REQ-UI-003 | Barra superior | [ui-style](design/ui-style.md), [office](features/office.md) | T020 | ✅ |
| REQ-UI-004 | Toasts | [ui-style](design/ui-style.md), [progression](features/progression.md) | T004, T005, T076 | ☐ |
| REQ-UI-005 | Ícones | [ui-style](design/ui-style.md) | T004 | ✅ |
| REQ-OFF-001 | Sala interativa | [office](features/office.md) | T020, T050 | ✅ |
| REQ-OFF-002 | Navegação entre hotspots | [office](features/office.md) | T020 | ✅ |
| REQ-OFF-003 | Workstation | [office](features/office.md) | T025, T045 | ✅ |
| REQ-OFF-004 | Garagem | [office](features/office.md) | T045 | ✅ |
| REQ-OFF-005 | Poleiro do Atlas | [office](features/office.md) | T048 | ✅ |
| REQ-OFF-006 | Estante de Relíquias | [office](features/office.md) | T050 | ✅ |
| REQ-OFF-007 | Introdução narrativa | [office](features/office.md) | T020 | ✅ |
| REQ-WLD-001 | Mapa em tiles | [world-map](features/world-map.md) | T021 | ✅ |
| REQ-WLD-002 | Locomoção | [catalog](content/catalog.md), [input](design/input.md), [world-map](features/world-map.md) | T021, T039 | ✅ |
| REQ-WLD-003 | Passabilidade | [world-map](features/world-map.md) | T021, T039 | ✅ |
| REQ-WLD-004 | Seletor de dimensão | [contracts-rifts](content/contracts-rifts.md), [input](design/input.md), [world-map](features/world-map.md) | T059 | ☐ |
| REQ-WLD-005 | Briefing de contrato | [world-map](features/world-map.md) | T022 | ✅ |
| REQ-WLD-006 | Eventos de campo | [catalog](content/catalog.md), [world-map](features/world-map.md) | T019, T040 | ✅ |
| REQ-WLD-007 | Retorno à sede | [world-map](features/world-map.md) | T021 | ✅ |
| REQ-WLD-008 | Marcadores bloqueados | [world-map](features/world-map.md) | T022 | ✅ |
| REQ-FLD-001 | Vista de satélite da AOI | [terrain](design/terrain.md), [field-setup](features/field-setup.md) | T017, T023 | ✅ |
| REQ-FLD-002 | Colocação de GCPs e CPs | [catalog](content/catalog.md), [field-setup](features/field-setup.md) | T023, T039 | ✅ |
| REQ-FLD-003 | Acessibilidade por veículo | [catalog](content/catalog.md), [field-setup](features/field-setup.md) | T017, T023, T039 | ✅ |
| REQ-FLD-004 | Indicador de distribuição | [field-setup](features/field-setup.md) | T015, T023 | ✅ |
| REQ-FLD-005 | Seleção de equipamento | [field-setup](features/field-setup.md) | T023 | ✅ |
| REQ-FLD-006 | Parâmetros do plano | [field-setup](features/field-setup.md) | T023 | ✅ |
| REQ-FLD-007 | Estatísticas ao vivo | [domain-math](design/domain-math.md), [field-setup](features/field-setup.md) | T011, T023 | ✅ |
| REQ-FLD-008 | Traçado das linhas | [field-setup](features/field-setup.md) | T014, T023 | ✅ |
| REQ-FLD-009 | Checklist de requisitos | [field-setup](features/field-setup.md) | T018, T023 | ✅ |
| REQ-FLD-010 | Mini-game de nivelamento | [field-setup](features/field-setup.md) | T037 | ✅ |
| REQ-FLD-011 | Mini-game de calibração da IMU | [field-setup](features/field-setup.md) | T038 | ✅ |
| REQ-FLD-012 | Modos especiais de voo | [field-setup](features/field-setup.md) | T014, T034 | ✅ |
| REQ-FLD-013 | Validação para decolar | [field-setup](features/field-setup.md) | T014, T023 | ✅ |
| REQ-FLT-001 | Projeção em perspectiva | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T024 | ✅ |
| REQ-FLT-002 | Terreno com relevo | [architecture](design/architecture.md), [terrain](design/terrain.md), [survey-flight](features/survey-flight.md) | T024 | ✅ |
| REQ-FLT-003 | Decolagem cinematográfica | [survey-flight](features/survey-flight.md) | T024 | ✅ |
| REQ-FLT-004 | Controles de voo | [input](design/input.md), [survey-flight](features/survey-flight.md) | T013, T024 | ✅ |
| REQ-FLT-005 | Linhas como corridas | [survey-flight](features/survey-flight.md) | T024 | ✅ |
| REQ-FLT-006 | Câmera RGB | [survey-flight](features/survey-flight.md) | T024, T035 | ✅ |
| REQ-FLT-007 | Sobreposição real e faixa | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T035 | ✅ |
| REQ-FLT-008 | Motion blur | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T011, T035 | ✅ |
| REQ-FLT-009 | Sensor LiDAR | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T012, T033 | ✅ |
| REQ-FLT-010 | Alternância de sensor | [input](design/input.md), [survey-flight](features/survey-flight.md) | T033 | ✅ |
| REQ-FLT-011 | Obstáculos e colisão | [terrain](design/terrain.md), [survey-flight](features/survey-flight.md) | T028 | ✅ |
| REQ-FLT-012 | Iluminação | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T029 | ✅ |
| REQ-FLT-013 | Vento e térmicas | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T013, T030 | ✅ |
| REQ-FLT-014 | Energia e RTH | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T013, T031 | ✅ |
| REQ-FLT-015 | Comportamento de Atlas | [catalog](content/catalog.md), [survey-flight](features/survey-flight.md) | T032 | ✅ |
| REQ-FLT-016 | Terrain Following | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T013, T034 | ✅ |
| REQ-FLT-017 | Rolling shutter | [domain-math](design/domain-math.md), [survey-flight](features/survey-flight.md) | T011, T035 | ✅ |
| REQ-FLT-018 | HUD de voo | [survey-flight](features/survey-flight.md) | T024, T035 | ✅ |
| REQ-FLT-019 | Fim da surtida e da missão | [survey-flight](features/survey-flight.md), [world-map](features/world-map.md) | T024, T031 | ✅ |
| REQ-FLT-020 | Interferência eletromagnética | [contracts-rifts](content/contracts-rifts.md), [survey-flight](features/survey-flight.md) | T030 | ✅ |
| REQ-FLT-021 | Clima especial | [contracts-real](content/contracts-real.md), [survey-flight](features/survey-flight.md) | T029, T055 | ✅ |
| REQ-FLT-022 | Perda de RTK em cânions urbanos | [contracts-real](content/contracts-real.md), [survey-flight](features/survey-flight.md) | T030, T053 | ✅ |
| REQ-FLT-023 | Aceleração de tempo | [input](design/input.md), [survey-flight](features/survey-flight.md) | T036 | ✅ |
| REQ-FLT-024 | Detecção furtiva e alvos especiais | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [survey-flight](features/survey-flight.md) | T018, T036 | ✅ |
| REQ-PRC-001 | Esteira SfM | [processing-results](features/processing-results.md) | T025, T043 | ✅ |
| REQ-PRC-002 | Velocidade por hardware | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T025 | ✅ |
| REQ-PRC-003 | Calibração de lente | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T043 | ✅ |
| REQ-PRC-004 | Tabela de resíduos e RMSE | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T016, T025 | ✅ |
| REQ-PRC-005 | Penalidades de acurácia | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T016, T043 | ✅ |
| REQ-PRC-006 | Classificação cartográfica | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T016, T025 | ✅ |
| REQ-PRC-007 | Mapa de calor de sobreposição | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T015, T025 | ✅ |
| REQ-PRC-008 | Visualizador de produtos | [processing-results](features/processing-results.md) | T041, T042 | ✅ |
| REQ-PRC-009 | Pagamento e recompensas | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T018, T025 | ✅ |
| REQ-PRC-010 | Enviar ao Museu | [processing-results](features/processing-results.md) | T025 | ✅ |
| REQ-PRC-011 | Processamento em campo | [processing-results](features/processing-results.md) | T044 | ✅ |
| REQ-PRC-012 | Vetorização pela equipe | [processing-results](features/processing-results.md) | T044 | ✅ |
| REQ-PRC-013 | Volumetria | [contracts-real](content/contracts-real.md), [domain-math](design/domain-math.md), [processing-results](features/processing-results.md) | T018, T043, T057 | ✅ |
| REQ-HOL-001 | Render 3D orbital | [holo-table](features/holo-table.md) | T026 | ✅ |
| REQ-HOL-002 | Névoa cartográfica | [holo-table](features/holo-table.md) | T026 | ✅ |
| REQ-HOL-003 | Setores mapeados | [holo-table](features/holo-table.md) | T026 | ✅ |
| REQ-HOL-004 | Miniaturas animadas | [holo-table](features/holo-table.md) | T072 | ☐ |
| REQ-HOL-005 | Chave dimensional | [holo-table](features/holo-table.md) | T059, T072 | ☐ |
| REQ-HOL-006 | Modos de exibição | [holo-table](features/holo-table.md) | T072 | ☐ |
| REQ-HOL-007 | Gestão das alas | [holo-table](features/holo-table.md) | T072 | ☐ |
| REQ-HOL-008 | Seleção de setor | [holo-table](features/holo-table.md) | T026 | ✅ |
| REQ-LAB-001 | Óptica e GSD | [infographic-lab](features/infographic-lab.md) | T073 | ☐ |
| REQ-LAB-002 | Estereoscopia e paralaxe | [infographic-lab](features/infographic-lab.md) | T012, T073 | ☐ |
| REQ-LAB-003 | LiDAR vs. fotogrametria no dossel | [infographic-lab](features/infographic-lab.md) | T012, T074 | ☐ |
| REQ-LAB-004 | Global vs. rolling shutter | [infographic-lab](features/infographic-lab.md) | T074 | ☐ |
| REQ-LAB-005 | Reuso do domínio | [domain-math](design/domain-math.md), [infographic-lab](features/infographic-lab.md) | T011, T073, T074 | ☐ |
| REQ-PRG-001 | Saldo | [processing-results](features/processing-results.md), [progression](features/progression.md) | T019 | ✅ |
| REQ-PRG-002 | Aeronaves e sensores por tier | [catalog](content/catalog.md), [progression](features/progression.md) | T010, T045 | ✅ |
| REQ-PRG-003 | Frota terrestre | [catalog](content/catalog.md), [progression](features/progression.md) | T010, T045 | ✅ |
| REQ-PRG-004 | Hardware de processamento | [catalog](content/catalog.md), [progression](features/progression.md) | T010, T045 | ✅ |
| REQ-PRG-005 | Equipe | [catalog](content/catalog.md), [progression](features/progression.md) | T010, T047 | ✅ |
| REQ-PRG-006 | XP e níveis | [domain-math](design/domain-math.md), [processing-results](features/processing-results.md), [progression](features/progression.md) | T019, T046 | ✅ |
| REQ-PRG-007 | Árvore de habilidades | [catalog](content/catalog.md), [progression](features/progression.md) | T019, T046 | ✅ |
| REQ-PRG-008 | Cosméticos | [catalog](content/catalog.md), [office](features/office.md), [progression](features/progression.md), [world-map](features/world-map.md) | T010, T049 | ✅ |
| REQ-PRG-009 | Renda passiva do museu | [domain-math](design/domain-math.md), [holo-table](features/holo-table.md), [progression](features/progression.md) | T019, T050 | ✅ |
| REQ-PRG-010 | Souvenirs | [catalog](content/catalog.md), [processing-results](features/processing-results.md), [progression](features/progression.md) | T025, T050 | ✅ |
| REQ-PRG-011 | Rival MegaMap | [processing-results](features/processing-results.md), [progression](features/progression.md), [world-map](features/world-map.md) | T019, T043, T051 | ✅ |
| REQ-PRG-012 | Reputação | [processing-results](features/processing-results.md), [progression](features/progression.md) | T019, T046, T051 | ✅ |
| REQ-PRG-013 | Milho | [catalog](content/catalog.md), [field-setup](features/field-setup.md), [progression](features/progression.md) | T010, T032, T048 | ✅ |
| REQ-CNT-001 | Contratos reais | [contracts-real](content/contracts-real.md), [data-model](design/data-model.md) | T022, T053, T054, T055, T056, T057, T058 | ☐ |
| REQ-CNT-002 | Fendas | [contracts-rifts](content/contracts-rifts.md), [data-model](design/data-model.md) | T059, T060–T070, T071 | ☐ |
| REQ-CNT-003 | Progressão e desbloqueio | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [progression](features/progression.md) | T019, T071 | ☐ |
| REQ-CNT-004 | Regras especiais | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [data-model](design/data-model.md), [terrain](design/terrain.md) | T052, T053, T054, T055, T056, T057, T058, T060–T070 | ☐ |
| REQ-CNT-005 | Repetição | [contracts-real](content/contracts-real.md), [processing-results](features/processing-results.md), [progression](features/progression.md) | T019, T071 | ☐ |
| REQ-CNT-006 | Guarda de paródias | [contracts-rifts](content/contracts-rifts.md), [architecture](design/architecture.md) | T059, T060–T070, T079 | ☐ |
| REQ-CNT-007 | Diálogos | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [processing-results](features/processing-results.md) | T022, T027 | ✅ |
| REQ-CNT-008 | Final da campanha | [catalog](content/catalog.md), [contracts-real](content/contracts-real.md), [office](features/office.md), [progression](features/progression.md) | T071 | ☐ |
| REQ-NFR-001 | Performance | [holo-table](features/holo-table.md), [survey-flight](features/survey-flight.md) | T007, T077 | ☐ |
| REQ-NFR-002 | Qualidade de build | [architecture](design/architecture.md) | T001, T079 | ☐ |
| REQ-NFR-003 | Cobertura de testes | [architecture](design/architecture.md) | T001, T079 | ☐ |
| REQ-NFR-004 | Resolução e responsividade | [ui-style](design/ui-style.md) | T004, T077 | ☐ |
| REQ-NFR-005 | Zero placeholders | [architecture](design/architecture.md) | T079 | ☐ |
| REQ-NFR-006 | Sem assets externos | [architecture](design/architecture.md) | T001, T079 | ☐ |
| REQ-NFR-007 | Acessibilidade | [ui-style](design/ui-style.md), [survey-flight](features/survey-flight.md) | T004, T075, T078 | ☐ |
| REQ-NFR-008 | Localização pt-BR | [ui-style](design/ui-style.md) | T002 | ✅ |
| REQ-NFR-009 | Navegadores | [architecture](design/architecture.md) | T001, T078 | ☐ |

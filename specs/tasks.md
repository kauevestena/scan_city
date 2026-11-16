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
  - [x] Modal de contraproposta com as duas opções e o portfólio.
  - [x] Roubo após falha crítica processada e retorno após outro contrato (critério 4 de [progression §14](features/progression.md)).
  - [x] Marcador rosa "MM".
- **Verificação:** `npx vitest run src/screens/world src/domain/rival`
- **Notas de implementação:**
  - Aceitar no briefing agora sorteia a contraproposta: `domain/rival.counterOfferFor` usa `rollCounterOffer(rng, rivalChance)` (20 % × o modificador das habilidades), nunca em replay, com o RNG seedado por `counterOfferSeed(seed global, contrato, aceite)`. O jogo não tem uma seed global própria: vale a de `?seed=` na depuração ou, senão, o `createdAt` do save (a mesma escolha dos eventos de campo, T040). O "aceite" é `contractsCompleted + rival.history.length`, então cada tentativa tem o seu sorteio e a mesma seed repete a mesma sequência.
  - `CounterOfferModal` (não dispensável: sem ✕ e o Esc não resolve): o emblema da MegaMap (`data/rival.ts`: hexágono, ícone Map, #e11d48 / #0f172a, "MM") e a fala da spec, com as duas opções. "Igualar preço" segue com o fator 0,85. "Apresentar portfólio técnico" usa `portfolioOutcome`: com um contrato concluído em classe A (ou ASPRS H ≤ 5 cm) o cliente diz "Seu histórico fala por si" e o preço se mantém; senão diz "Bonito, mas o preço da concorrência é menor", o fator é 0,85 e a reputação cai 2. Nos dois casos `recordCounterOffer` grava o evento no histórico (sem somar no placar de roubos), e só então a missão começa com o fator escolhido (`startMission` e o payload do `FIELD_SETUP`).
  - Roubo e retorno já funcionavam (T019/T043): falha crítica fora de replay → `STOLEN` com `stolenAtCompletionCount`, e o contrato volta a `AVAILABLE` ao concluir outro (`missionResult.test.ts`, `rival.test.ts`). O marcador rosa com "MM" já era desenhado (`tileRenderer`, com teste). Como só o C00 existe até a F7, o critério 4 completo (C05 → R08) fica coberto nos testes de domínio e de store, e de ponta a ponta quando os contratos chegarem.
  - O Perfil ganhou o resumo "MegaMap: N contratos roubados, M contrapropostas".
  - Para os testes não ficarem sujeitos ao sorteio, `resetGameStore` fixa `createdAt = 4` (sem contraproposta no C00) e exporta `TEST_SEED_COUNTER_OFFER = 3`; os E2E que aceitam o C00 usam `?seed=4`.
- **Status:** ✅

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
> - [x] Viabilidade verde.
> - [x] Autopilot conclui o voo sem queda (o autopilot sobe sobre obstáculos).
> - [x] Relatório aprovado com o plano de referência.
> - [x] Bioma visualmente distinto.
> - [x] Determinismo verificado.
>
> **Verificação comum:** `npx vitest run src/data/contracts src/world/terrain` + E2E parametrizado `tests/e2e/contracts.spec.ts --grep <id>`.

### T052 — Framework de regras especiais
- **Fase:** F7 · **Depende de:** T051 · **REQs:** REQ-CNT-004
- **Spec:** [contracts-real §1](content/contracts-real.md)
- **Arquivos:** \+ `src/data/specialRules.ts` (metadados: nome, descrição pt-BR, ícone), `src/domain/specialRules.ts` (registro de efeitos por sistema: `terrain`, `flight`, `field`, `coverage`, `accuracy`) + testes
- **Aceite:**
  - [x] Todas as 20 regras têm metadados e efeito registrado.
  - [x] 1 teste por regra, usando a `testArena` de T036.
  - [x] O briefing exibe as regras com ícone e descrição.
- **Verificação:** `npx vitest run src/domain/specialRules`
- **Notas de implementação:**
  - `data/specialRules.ts`: as 20 regras com nome, descrição pt-BR, ícone (lucide, registrado em `registerIcons`) e os sistemas em que atuam (`systems`, a coluna "onde atua" da spec). `domain/specialRules.ts` guarda os números normativos num só lugar (`RULE_PARAMS`: 60 m/40 m do cânion, 0,6 de tie points, 8 m/s, ±0,8 m/s e 3°, ×2/400 m, 250 m, 1,5 s/3 s, anéis de 3 m, R$ 50…) e o registro `RULE_REGISTRY`: cada regra liga os seus efeitos em `RuleEffects`, com cinco grupos (`terrain`, `flight`, `field`, `coverage`, `accuracy`). `resolveRuleEffects(contract.specialRules)` junta as regras (memoizado) e é o que os sistemas consultam, no lugar de procurar a regra pelo nome.
  - Os consumidores foram migrados para os efeitos: `engines/flight/{environment,fieldElements,FlightEngine}`, `domain/{mission,accuracy,requirements,energy}`, `screens/field/{PlanStats,useFieldContext}`, `screens/processing/{ProcessingResultsScreen,productModel}` e `engines/raster/pipelineViz` (o fator de tie points da textura homogênea). Os sistemas sem grupo próprio caem num grupo existente: ENERGY, EVALUATION e ECONOMY em `flight`; PROCESSING em `accuracy` (`SYSTEM_GROUP`). Um teste garante que cada regra liga efeito em todos os sistemas que declara (`touchedGroups`).
  - `world/terrain/ruleGenerators.ts`: os geradores que as receitas de bioma das tarefas seguintes vão reusar — `rtkCanyonZones` (a caixa que cobre dois prédios > 60 m a < 40 m um do outro), `lavaThermalZones` (uma térmica de 6 m/s e r = 40 m por aglomerado de lava), `trenchElevation` (−40 m em |v − centro| < 25) e `lowWireLine` (postes a 30–40 m, fios a 8–14 m, a seed vem do chamador). Também `terrainReliefM` e `maxSlopeDeg`, que os testes de viabilidade dos biomas `STEEP_RELIEF` e `VERTICAL_CLIFFS` vão usar.
  - Briefing: a seção "Regras especiais" (`SpecialRulesList`, com o ícone, o nome e a descrição de cada regra) aparece entre as condições e o equipamento recomendado, e some nos contratos sem regra (C00).
  - Testes: metadados completos, "onde atua" idêntico à spec, registro completo, `resolveRuleEffects` (soma, memoização, neutro) e **20 testes, um por regra**, todos sobre `buildTestArena` (T036) — por exemplo cânion → `rtkStatusAt` devolve FLOAT; fio → colide a ±1 m; térmica → 6 m/s no centro e 3 m/s sem sol alto; trincheira → −40 m com torres sólidas; anel → coleta a < 3 m sem colisão; pico elétrico → a cada 8–12 s com 2 s de duração e Atlas imune; feature de LIDAR → só com ≥ 50 pulsos/m². Mais os testes dos geradores e do briefing (ícone, nome e descrição).
  - `REQ-CNT-004` continua ☐ na matriz: a regra só fecha quando os contratos T053–T070 usarem o framework.
- **Status:** ✅

### T053 — C01 Metrópole Vertical
- **Fase:** F7 · **Depende de:** T052 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*), REQ-FLT-022
- **Spec:** [contracts-real C01](content/contracts-real.md), [terrain §3](design/terrain.md) (`URBAN_VERTICAL`)
- **Aceite específico:**
  - [x] Zonas `RTK_CANYON` geradas (≥ 2).
  - [x] Prédios > 60 m são ≥ 20 %.
  - [x] O briefing avisa a altura máxima.
- **Notas de implementação:**
  - `world/terrain/biomes/urbanVertical.ts`: relevo de até 10 m (fbm de 2 oitavas, escala 260 m), grade de ruas de 10 m de largura a cada 60–80 m, ancorada nas quatro ruas que cercam a praça (u = 145/215, v = 85/155) e estendida até uma rua além de cada borda da margem de 20 %, de modo que as quadras cobrem tudo. Cada quadra (menos a praça) recebe de 2 a 6 lotes, por corte recursivo do lado maior, com calçada de 2 m e beco de 3 m. A praça de 60 × 60 m é GRASS, com 10 árvores e o miolo livre (`guaranteedAccessible`). Telhado e rua vêm do sampler (ROOF sob os prédios, ROAD nas polilinhas).
  - Alturas `10 + 80·r³`: os prédios altos são sorteados à parte, 25 % em cada grupo (dentro e fora da AOI), com r ∈ [0,86; 0,995) → 60,9–89,6 m; os baixos usam r ≤ 0,85 → no máximo 59,1 m. Assim a fatia de altos (≥ 20 %) vale na AOI e no conjunto, e só os altos formam cânion. O mais alto da AOI é fixado em exatamente 90 m. Com a seed 2002: 120 prédios (44 na AOI, 25 % acima de 60 m) e 41 zonas `RTK_CANYON`, geradas por `rtkCanyonZones` (T052).
  - Contrato `C01` em `data/contracts/real.ts` conforme a ficha (7 requisitos, R$ 12.000, 400 XP, +8 de reputação, museu (1, 0) a R$ 40/min, desbloqueio `CONTRACT_DONE(C00)`, marcador `1`). O plano de referência bate com a spec (GSD 3,02 cm, 10 linhas, 493,7 s; 190 fotos) e o teste de viabilidade passa de primeira.
  - Aviso da altura máxima: a nota do cliente no briefing é "Voe acima dos prédios mais altos (90 m)!", e `real.test.ts` confere que o 90 é o do prédio mais alto da AOI gerada e que o plano de referência passa a ≥ 10 m acima do topo mais alto da cena (≈ 115 m contra ≤ 100 m). O briefing também mostra a regra de cânion (T052).
  - Infra de depuração por contrato, reaproveitada pelas tarefas seguintes: `domain/referencePlan.ts` (`referenceParams`, `referencePoints` com encaixe opcional no ponto acessível e `syntheticMission`, agora com o catálogo injetado; `test/fixtures/syntheticMission.ts` virou um invólucro). `createDebugMission` usa o plano de referência do contrato (pontos encaixados, e fotos "perfeitas" com dados) para os contratos do catálogo, mantendo o plano fixo do C00 e o do tutorial para ids desconhecidos; `ensureActiveMission` libera o contrato bloqueado.
  - E2E parametrizado `tests/e2e/contracts.spec.ts` (`--grep C01`): autopilot ×8 até "Voo concluído" com 0 colisões e ~190 fotos, leva os dados à sede, processa no notebook, relatório **APROVADO**, souvenir e setor no museu (~1,3 min). Revisão visual no satélite (grade de quadras com a praça verde), no voo (arranha-céus azulados a 107 m de AGL, 60 FPS), na ortofoto e na nuvem (29.892 pontos).
  - Ajustes: `markers.test` deixou de supor um só contrato; o botão "Sugerir GCPs" continua só do tutorial (C00), então no C01 os pontos são cravados à mão. O `obstacleAhead` do autopilot segue `false`: no C01 o plano já passa acima de tudo e isso só vira necessário numa tarefa de contrato com obstáculos acima do plano. No aceite pelo briefing, o sorteio da contraproposta do C01 com `?seed=4` e nenhum contrato concluído dá oferta; use `?seed=5` ou conclua o C00 antes.
- **Status:** ✅

### T054 — C05 Centro Histórico Colonial
- **Fase:** F7 · **Depende de:** T053 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*)
- **Spec:** [contracts-real C05](content/contracts-real.md)
- **Aceite específico:**
  - [x] Fios entre os postes colidem.
  - [x] O plano de referência exige 2 surtidas com o T1 e é completável.
- **Notas de implementação:**
  - `world/terrain/biomes/colonialCenter.ts`: a ladeira é um plano que sobe 25 m ao longo de `u` (6 m + 25 m · u/150, e segue subindo na margem) com uma ondulação de ±1,5 m; na AOI o relevo dá 24,9 m e a declividade máxima, 18 % (os veículos vencem 30 %). Seis ruas de pedra de 7 m em cada eixo, a ~54 m uma da outra, formam 25 quadras que cobrem toda a margem de 20 %. Cada quadra recebe quatro fileiras de casarões (faixa de 13 m, lotes de ~10,5 m de frente, 8–10 m de altura, fachadas em oito cores pastéis, vão de 0,8 m entre vizinhos) em volta de um quintal de grama com 1–2 árvores. O telhado e a rua vêm do sampler; o quintal sai de `inYard`, calculado pela grade fixa de ruas.
  - A quadra do meio é a da igreja matriz: nave de 30 × 20 × 18 m em (75, 63), duas torres de 35 m encostadas na fachada sul (u = 62,5 e 87,5) e o largo de pedra aberto ao sul, com quatro árvores nos cantos e o miolo livre — o GCP de referência (75, 75) cai ali (`guaranteedAccessible`: (75, 90)). Com a seed 5005: 355 objetos (179 casarões, a nave, 2 torres, 25 árvores, 80 postes e 68 fios).
  - `LOW_WIRES` (T052): `lowWireLine` em cada rua, a 3 m do eixo, com postes a 30–40 m e fios de 8–14 m que seguem o terreno (cada ponta fica à altura sobre o seu chão). O teste do bioma confere que o fio colide a ±1 m da sua altura (corpo de 0,6 m + fio de 0,5 m), que a 20 m de AGL nenhum fio é tocado (a nota do briefing) e que o plano de referência passa a ≥ 10 m acima do topo mais alto da cena (≈ 13 m, nas torres).
  - Contrato `C05` conforme a ficha (7 requisitos, com `FLIGHT_MODE` oblíquo e malha cruzada e PEC A 1:500 de eq. 0,5 m; R$ 18.000, 600 XP, +10; museu (1, 1) a R$ 60/min; desbloqueio `CONTRACT_DONE(C01)`; marcador `5`; `SV_TILE`). O plano de referência (T1 + 20 MP, H 50 m, oblíquo de 45° em malha cruzada, 14 linhas, 605,9 s, GSD 1,37 cm) bate com a spec e a viabilidade passa de primeira. A lente `LENS_24` do equipamento recomendado não cabe em `recommended` (só aeronaves e sensores), então a lista traz T1 e T2 com as câmeras `CAM_20MP_RS` e `CAM_45MP_FF`.
  - Duas surtidas: `plan.stats.batteriesNeeded = 2` e o T1 (1 bateria + 2 reservas) as completa. No E2E o autopilot faz o RTH da primeira, inicia a segunda sozinho e só aparece o pós-voo ao fim: ~210 fotos, 0 colisões, relatório **APROVADO**, souvenir e museu (~1,6 min). `tests/e2e/contracts.spec.ts` ganhou o C05.
  - Testes: 10 do bioma (determinismo, ladeira, ruas e quintais, casarões, igreja, largo, fios, folga do plano, desempenho), ficha do contrato e o plano de 2 surtidas em `real.test.ts`, e o briefing com os dados reais (`BriefingModal.real.test.tsx`, renomeado do teste do C01). Revisão visual: satélite (grade de casarões coloridos, igreja e largo), voo (postes e fios sobre as fachadas a 52 m de AGL, 60 FPS) e ortofoto. O chão além da margem é uma planície bege lisa, como no C01.
  - O autopilot ainda não sobe sobre obstáculos (`obstacleAhead` segue `false`): o plano do C05 já passa acima de tudo, e isso só passa a ser necessário numa tarefa com obstáculos acima do plano. Para o aceite pelo briefing do C05 com `?seed=`, use uma seed sem contraproposta (por exemplo `?seed=3`).
- **Status:** ✅

### T055 — C06 Zona Costeira e Estuário
- **Fase:** F7 · **Depende de:** T054 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*), REQ-FLT-021 (*parc.*)
- **Spec:** [contracts-real C06](content/contracts-real.md)
- **Aceite específico:**
  - [x] Água excluída da cobertura.
  - [x] Com `SUN_HIGH`, as fotos sobre a água ficam inválidas.
  - [x] Faixa de terra garantida.
- **Notas de implementação:**
  - `world/terrain/biomes/coastalEstuary.ts` (AOI de 300 × 800 m): a costa fica entre v = 170 e 176 (`shoreV`, ondulada ao longo de `u`) e o mar, a −2 m, ocupa 43 % da AOI. Em terra, dunas de fbm (3 oitavas) de até ~18 m que baixam em 80 m até o topo de uma falésia baixa de 4 m (rocha) sobre a praia de areia; restinga (GRASS) nas baixadas e areia nas cristas. O declive das dunas fica abaixo de 35 % (o resto é a falésia e as margens do canal).
  - Canal do estuário: o eixo serpenteia (`540 + 40·sen(v/24)`), a ponta de terra em v = 112 é arredondada e antes dela a várzea some aos poucos (sem degrau no terreno), a largura passa de 6,5 a 12 m e se abre a 20 m na foz, com leito a −2 m. Nas margens baixas nasce o manguezal (FOREST, dossel 0,7), onde o GCP não vale. As árvores do mangue são postas pela distância perpendicular ao eixo, então nenhuma cai na água.
  - Acesso: estrada de terra no meio da faixa (v ≈ 95, sempre em terra firme, pois o canal acaba antes dela), trilha de 3 m na praia e o acesso ao farol; toda a terra da faixa fica a ≤ 150 m de uma via. Farol (TOWER de 25 m) na duna em (610, 136), 14 barcos não sólidos (`CUBE_BLOCK` sobre a água), ~160 árvores (mangue, palmeiras e arbustos da restinga).
  - **Faixa de terra garantida**: a costa nunca recua de v = 170, só o canal tem água em v ∈ [0, 170] (1,5 % da faixa), e os 8 pontos de referência e os `guaranteedAccessible` são terra acessível a pé. **Água excluída da cobertura**: já era a regra da avaliação (OQ-007); o teste confere que 43 % das células da grade saem do cálculo e que as frações verde, amarela e vermelha somam 1 sobre o resto. **`SUN_HIGH` invalida as fotos sobre a água**: `recordShot` sobre a terra real do C06 marca `overWater` na linha do mar, `isShotValid` recusa sob sol alto e aceita sob nublado e hora dourada.
  - Contrato `C06` conforme a ficha (nível ≥ 2 e ASPRS 7/10 cm críticos, R$ 22.000, 700 XP, +10, museu (3, 0) a R$ 70/min, desbloqueio `ALL[C01, reputação 40]`, marcador `6`). O plano de referência (T2 + câmera de 45 MP + lente 24, H 110 m, 12 m/s, nublado, 7 linhas, 568,5 s, GSD 2,01 cm; 224 fotos) bate com a spec. O vento (9 + 4 = 13 m/s) passa da tolerância do T2 (12 m/s): o HUD mostra "VENTO ACIMA DO LIMITE DA AERONAVE" e a deriva dobra, e o autopilot conclui o voo mesmo assim. O recomendado traz só o T2 e a câmera (a lente não cabe em `recommended`) e, sem veículo na ficha, `FOOT_BIKE`.
  - **Viabilidade com o kit GNSS**: o teste passou a contar com o kit quando a aeronave do plano é RTK (`ownsRtkKit = aircraft.rtk`), já que o T2 é vendido em combo com ele (`T2_COMBO_ITEMS`); sem o kit o plano do C06 dá V = 15 cm contra os 10 cm exigidos. Pelo mesmo motivo, os fluxos de depuração por contrato (`prepareContractState`) agora dão ao jogador o equipamento do plano de referência (aeronave, câmera, lente e kit GNSS) além de liberar o contrato; sem isso o relatório do E2E avaliava sem RTK e reprovava.
  - E2E: `tests/e2e/contracts.spec.ts` ganhou o C06 (~1,6 min): autopilot ×8 sem colisões, 224 fotos (98 sobre a água, válidas sob nublado), relatório **APROVADO** (ASPRS H 4,8 cm · V 9,2 cm, cobertura verde de 100 % das células de terra), souvenir e museu. O relatório de contratos ASPRS não tem classe PEC, então o E2E só confere o `report-class` nos contratos de PEC-PCD. Revisão visual no satélite (dunas, praia, canal com mangue, mar com barcos), no voo (costa, farol e o aviso de vento) e na ortofoto. Cuidado ao rodar os E2E à mão: o Playwright reaproveita um servidor que já esteja de pé na porta 4173, e então testa o build antigo.
- **Status:** ✅

### T056 — C02 Planalto Agrícola
- **Fase:** F7 · **Depende de:** T055 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*)
- **Spec:** [contracts-real C02](content/contracts-real.md)
- **Aceite específico:**
  - [x] NDVI com manchas de estresse visíveis no produto.
  - [x] A asa fixa faz as curvas com o tempo da fórmula.
  - [x] Textura homogênea penaliza com p < 80.
- **Notas de implementação:**
  - `world/terrain/biomes/agriPlateau.ts` (AOI de 600 × 1500 m): relevo suave de 0 a 30 m (fbm de 2 oitavas, escala 600 m, declive máximo de 12 %); 10 × 4 talhões de 190–270 m separados por estradas internas de 6 m (a principal, em v = 330, de 9 m), todos de cultivo (`CROP`, 80 % da AOI) exceto os cantos de pousio dos três pivôs e o pátio de terra da sede. Como o bioma é só deste contrato, a grade de divisas e as posições dos pivôs são constantes fixas (como o açude do C00), e a cidade-fazenda inteira cobre a margem de 20 %.
  - **NDVI**: cada talhão tem um vigor de 0,55 a 0,85 (`fieldVigor`, por hash da posição) menos a mancha de estresse (`fbm` suavizado, até −0,4); 22 % do cultivo fica abaixo de 0,45 e 10 %, abaixo de 0,3. O pivô 3 (a mancha amarela do diálogo de sucesso) tem um setor de 30° a 80° com −0,4 (vale o maior entre o entupimento e o estresse, sem somar), a ~0,2 de NDVI contra ~0,5 no resto do círculo. Estradas, telhados e o pátio ficam abaixo de 0,15. No produto NDVI da Workstation (multiespectral) aparecem os talhões, as estradas alaranjadas, as manchas amarelas, os três círculos e o setor do pivô 3; o teste confere o histograma (faixas abaixo de 0,3 cheias) e que o raster tem pixels quentes e verdes.
  - Objetos: os 3 pivôs, de torre central e braço radial de 8 postes não sólidos no ângulo próprio, 4 silos (`PIPE` de 16–22 m, sólidos), 2 galpões e a casa da sede no pátio — 34 objetos, e a criação do terreno leva ~150 ms.
  - Contrato `C02` conforme a ficha (teto especial de 200 m, requisitos de sensor multiespectral e aeronave de asa fixa, R$ 35.000, 900 XP, +12, museu (0, 1) a R$ 90/min, desbloqueio `ALL[C06, reputação 50]`, marcador `2`). O plano de referência (T3 + CAM_MS5, H 200 m, p 80, 22 m/s, 8 linhas, 725,7 s, GSD 12,54 cm; 328 fotos) bate com a spec e a viabilidade passa de primeira.
  - **Curvas da asa fixa**: `fixedWing.test.ts` confere `turnTimeS = (π·R + |s − 2R|)/v` com R = 80 m e o espaçamento de 90,6 m (curva em gota, 14,6 s) e que o motor voa as 8 linhas do plano com autopilot e a surtida dura `8 · 1.660 m / 22 + 7 curvas + 4,5 s`, o tempo do plano. **Textura homogênea**: o multiplicador de acurácia `texture` vale ×1,24 com p = 80 e ×1,6 com p = 70 (RMSE maior), e some sem a regra (`real.test.ts`); a nota do briefing pede p ≥ 80 % e o requisito de sobreposição, os mesmos 80 %.
  - E2E: `tests/e2e/contracts.spec.ts` ganhou o C02 (~1,9 min): autopilot ×8 sem colisões, 328 fotos, relatório **APROVADO** com classe PEC, souvenir e museu. Revisão visual no satélite (talhões, círculos dos pivôs, sede), no voo (60 FPS) e nos produtos.
- **Status:** ✅

### T057 — C04 Mina a Céu Aberto
- **Fase:** F7 · **Depende de:** T056 · **REQs:** REQ-CNT-001 (*parc.*), REQ-CNT-004 (*parc.*), REQ-PRC-013
- **Spec:** [contracts-real C04](content/contracts-real.md)
- **Aceite específico:**
  - [x] Bancadas visíveis no voo.
  - [x] TF obrigatório.
  - [x] Volumetria com erro ≤ 2 % no plano de referência.
  - [x] Marcador acessível só de 4x4.
- **Notas de implementação:**
  - `world/terrain/biomes/openPitMine.ts` (AOI de 480 × 320 m, cava centrada em (240, 160)): a profundidade segue o perfil de degraus `pitDepthM` — 10 bancadas de 15 m, cada uma com berma plana de 8 m e talude suavizado de 14 m (≈ 47°, com picos de 65° nas curvas), de 0 na borda (cota 150 m) a 150 m no fundo (raio de 220 m). A borda é irregular (ridged de ±9 m, só nas três bancadas de cima, para que as bermas de baixo sejam círculos exatos). A cobertura vem da mesma conta: `BENCH` nas bermas e no fundo, `ROCK` nos taludes e fora da cava, `SAND` nas quatro pilhas cônicas (r 32–40 m, h 20–30 m, nos cantos, fora do raio da borda).
  - Rampa de acesso em espiral (`ROAD` de 8 m, 2,5 voltas da borda ao raio de 25 m, 200 pontos) com a estrada que a liga à margem; duas torres de britagem (`BUILDING` de 15 × 15 × 30 m) com galpões. O relevo da AOI dá 180 m (os 150 m da cava mais 30 m das pilhas); os pontos de apoio de referência já caem em terra acessível da picape (o fundo e quase todos os outros a 0–6 m do encaixe, 4 `guaranteedAccessible` em bermas), e a picape não sobe nos taludes (> 60 %).
  - Contrato `C04` conforme a ficha (TF, volume ≤ 2 % e cobertura de 85 % críticos, ASPRS 5/8 cm, 6 GCPs, R$ 55.000, 1.200 XP, +12, museu (0, 0) a R$ 120/min, desbloqueio `ALL[C05, reputação 55]`, marcador `4`, **veículo mínimo `PICKUP_4X4`**). O plano de referência (T2 + 45 MP + lente 24, H 80 m AGL com TF, 9 linhas, 563,5 s, GSD 1,46 cm; 243 fotos) bate com a spec e a viabilidade passa de primeira.
  - **Aceites.** *Bancadas visíveis no voo*: o teste do perfil radial acha os 11 platôs de 15 em 15 m, e a revisão visual mostra as bermas e os taludes escalonados vistos da aeronave. *TF obrigatório*: voando a H sobre a cota média, o AGL varia mais de 150 m (do chão ao dobro do teto) e o plano sem o modo reprova o requisito `C04-tf`. *Volumetria*: corte de 6,2 milhões de m³ e aterro de 0,2 milhão (profundidade média de 42 m); com o RMSE de 8 cm do plano o erro fica em ≤ 0,3 % em 100 seeds (0,03 % no relatório), e com 5 % de buracos de cobertura passa de 2 %. *Marcador 4*: a picape o alcança do escritório e a pé, de carro e de van não (BFS do mapa).
  - Duas correções de infra que o C04 pediu. **`TerrainSampler`**: o teste "o ponto está numa via?" varria todos os segmentos de todas as vias, e a rampa de 200 pontos derrubava o voo para ~40 FPS; agora cada segmento guarda a caixa envolvente e só calcula a distância quando o ponto cabe nela (60 FPS de volta, e as grades de ruas dos outros biomas ganham também). **`syntheticMission`**: com Terrain Following as fotos "perfeitas" ficam a H de AGL sobre o terreno de cada foto (antes eram a altitude constante, e o relatório de depuração do C04 dava volume de 14,7 %, cobertura de 66 % e ASPRS reprovado); agora dá 0,03 %, 100 % e H = V = 4,2 cm. `referencePlan.test.ts` cobre os parâmetros, o encaixe dos pontos e a missão sintética.
  - E2E: o C04 em `tests/e2e/contracts.spec.ts` (~1,5 min): autopilot ×8 com TF sem colisões, 243 fotos, relatório **APROVADO** (os contratos de ASPRS não têm classe PEC), souvenir e museu. Revisão visual no satélite (círculos das bancadas, a espiral escura da rampa, pilhas e britadores), no voo e nos produtos.
- **Status:** ✅

### T058 — C03 Floresta Amazônica
- **Fase:** F7 · **Depende de:** T057 · **REQs:** REQ-CNT-001, REQ-CNT-004 (*parc.*)
- **Spec:** [contracts-real C03](content/contracts-real.md)
- **Aceite específico:**
  - [x] 7 clareiras fixas.
  - [x] Sem LiDAR, o MDT fica "sem dados" e a missão é reprovada por crítico.
  - [x] Com o plano de referência, a densidade de solo é ≥ 8.
- **Notas de implementação:**
  - `world/terrain/biomes/amazon.ts` (AOI de 500 × 1000 m): mata de dossel 0,97 (0,95–0,98 por ruído), relevo de até 40 m (fbm de 4 oitavas, escala 200 m), 4.165 copas aglutinadas de 25–45 m, uma a cada ~15 m com jitter, fora das clareiras e do igarapé. O igarapé é uma senoide em `u` (v = 175 + 35·sen(u/120)), entre as duas fileiras de clareiras, com 8 m de água, brejo (`SWAMP`, dossel 0,88) até 14 m do eixo e o leito escavado 4 m. As **7 clareiras** têm posição e raio fixos (22–35 m, os centros da spec: (150,100), (850,100), (150,400), (850,400), (500,250), (300,250), (700,250)), `GRASS`, dossel 0, e são os `guaranteedAccessible`. Três trilhas ligam as clareiras (por elas a pé e de picape se chega). A criação do terreno leva ~60 ms.
  - Contrato `C03` conforme a ficha (LiDAR e solo ≥ 8 pts/m² críticos, densidade ≥ 100, ASPRS 10/15 cm, 4 GCPs, R$ 90.000, 1.500 XP, +15, museu (2, 0) a R$ 150/min, desbloqueio `ALL[C04, C02, reputação 65]`, marcador `3`, **veículo mínimo `PICKUP_4X4`**, acesso por brejo). O plano de referência (T3 + pod LiDAR, H 120 m, p 70, q 50, 18 m/s, nublado) dá faixa de 168,05 m, 7 linhas, 580,2 s e 158,7 pts/m², e ~17 pts/m² de solo com o dossel de 0,97 (`1 − c + c · 0,02 · (5 − 1)` = 10,8 %); com a média real da AOI (0,915, pelas clareiras e pelo brejo) são ~25. `ReferencePlan.expected` ganhou o campo opcional `lidar` (faixa, densidade e solo; também no data-model) e o teste de viabilidade tem um ramo de LiDAR (faixa e densidade ±1 %, solo ±10 % sobre o dossel mais comum da AOI); `gsdCm` (3,2) é o da câmera RGB do pod.
  - **Aceites.** *7 clareiras fixas*: posições, raios, dossel 0, sem se tocar nem tocar o igarapé, todas dentro da AOI. *Sem LiDAR*: o MDT só de fotos fica 80 % hachurado (sem dados sob o dossel), e a missão feita com a câmera falha o requisito crítico `C03-sensor` (reprovada, `critical`); com a nuvem do plano de referência, o MDT só tem hachura em menos de 2 % (`real.test.ts`). *Densidade de solo*: a missão sintética do plano mede 158,7 pts/m² e ≥ 8 de solo (22,7 no relatório de depuração), e o relatório aprova com ASPRS H 6,6 · V 5,2 cm.
  - **Quatro correções que o C03 pediu.** (1) *Voo de LiDAR sem nenhuma foto não podia ser levado*: `PostFlightDialog` e o autopilot só contavam `shots`, então o botão "Levar dados" nem aparecia; agora `missionHasData` (fotos ou nuvem, o mesmo critério da máquina de estados) decide, com testes. (2) *Trilhas finas sumiam do campo de distâncias*: a grade de 4 m podia não ter centro de célula a menos de 1,5 m de uma trilha de 3 m (a distância à trilha virava 200 m); as sementes do campo valem ao menos meia diagonal da célula (2,8 m), sem mexer na cobertura. (3) *Desempenho do voo*: o motor montava a cena com todos os objetos da faixa de `Z`; agora corta os que estão fora da faixa lateral visível (`halfWidthAt`), o que leva a mata de 4 mil copas de ~45 para ~60 FPS. (4) `syntheticMission` passou a gerar a nuvem LiDAR "perfeita" do plano (densidade em toda a AOI e solo pela probabilidade de retorno sob o dossel) para os fluxos de depuração e os testes. O teste de "bioma sem receita" do `terrain.test.ts` usa agora um id que nunca existirá.
  - E2E: o C03 em `tests/e2e/contracts.spec.ts` (~1,6 min; sem contagem de fotos nos voos de LiDAR): autopilot da asa fixa sobre a mata, 0 colisões, relatório **APROVADO**, souvenir e museu. Revisão visual no satélite (a mata com as 7 clareiras claras e o igarapé), no voo (copas e troncos, o HUD "LIDAR 75 pts/m² · solo 8") e nos produtos.
- **Status:** ✅

### T059 — Framework das Fendas Dimensionais
- **Fase:** F7 · **Depende de:** T058 · **REQs:** REQ-WLD-004, REQ-CNT-002 (*parc.*), REQ-CNT-006, REQ-HOL-005 (*parc.*)
- **Spec:** [contracts-rifts §1, §3](content/contracts-rifts.md), [world-map §5.4](features/world-map.md), [constitution §6](constitution.md)
- **Arquivos:** \+ `src/data/contracts/rifts.ts` (vazio tipado, preenchido nas tarefas seguintes), `scripts/check-forbidden-terms.mjs`, teste `src/data/contracts/forbiddenTerms.test.ts` · ~ mapa (aba Fendas, portais, tonalidade), briefing (moldura rift), transição com distorção, HUD com moldura rift
- **Aceite:**
  - [x] O critério 3 de [world-map §8](features/world-map.md), usando uma fenda de teste.
  - [x] `npm run check:terms` integrado ao `verify`.
  - [x] Retratos como emblemas.
- **Verificação:** `npm run check:terms && npx vitest run src/data/contracts src/screens/world`
- **Notas de implementação:**
  - **Dados.** `data/contracts/rifts.ts` exporta `RIFT_CONTRACTS: readonly Contract[] = []` (vazio e tipado) e `index.ts` o junta a `CONTRACTS`; as tarefas T060–T070 só acrescentam fichas ali. Sem fendas reais ainda, tudo o que é de tela e de motor é testado com duas fendas fictícias (`R01`/marcador `a`, `R02`/`b`, liberadas pelo C01) injetadas por `vi.mock('@/data/contracts', …withTestRifts)` — `src/test/riftFixtures.ts`.
  - **Guarda de paródias.** `scripts/check-forbidden-terms.mjs` varre `src/` (nomes, termos e títulos de obras existentes; minúsculas, sem acento, com limites de palavra para não pegar trechos de outras palavras) e sai com 1 listando cada ocorrência; entra no `npm run verify` (`… && npm run check:placeholders && npm run check:terms`) e é exercitado por `forbiddenTerms.test.ts` (o script limpo passa; um arquivo com termo proibido reprova). Os próprios termos ficam só no script, e os testes os montam por partes para não se denunciarem.
  - **Mapa (critério 3 de world-map §8).** A aba "Fendas Dimensionais" só existe depois da primeira descoberta: `world.discoveredRifts` é preenchido por `refreshUnlocks` quando uma fenda sai de `LOCKED` (um único `RIFT_OPEN` por lote, mesmo que duas abram juntas, e o aviso "Anomalia dimensional detectada: …"). `Tab` (`TOGGLE_DIMENSION`) alterna as abas; antes da primeira descoberta, mostra a dica "Nenhuma anomalia detectada ainda". `activeDimension(world)` (`world/overworld/markers.ts`) decide a aba efetiva — a aba salva só vale com fendas descobertas — e é usada pelo mapa e pelo painel de depuração (os botões de teleporte seguem a aba). Cada aba tem seu próprio cache de marcadores; na aba Fendas só aparecem os portais descobertos (`a`–`k`), com o status de cada contrato.
  - **Visual.** `tileRenderer`: `drawPortal` (anéis violeta pulsantes com oito faíscas em órbita, sem as faíscas se `reduceFlashes`; fenda concluída fica calma e verde) e `drawRiftAtmosphere` (tonalidade violeta e 60 partículas, semente fixa `0x51f7`) quando a aba é a das Fendas; o minimapa também ganha cores de fenda. `RiftWarp` (`screens/common`): distorção de 700 ms (faixas horizontais deslocadas com tonalidade) ao aceitar uma fenda no briefing, antes de ir ao FIELD_SETUP; `reduceFlashes` a pula e o aceite segue direto. `BriefingModal`: etiqueta "Fenda dimensional" (`briefing-rift-frame`, `data-dimension="RIFT"`) e moldura violeta. Voo: `FlightHud` ganha a moldura violeta (`rift-hud-frame`, `data-rift`) e o `FlightEngine` desenha `drawRiftSky` (degradê violeta) e 48 partículas flutuantes (`drawRiftParticles`, sem elas com `reduceFlashes`) quando `contract.dimension === 'RIFT'`.
  - **Depuração.** `?debug=1&unlockAll=1` também descobre as fendas do catálogo (a aba Fendas aparece sem jogar), e o painel de depuração teleporta para os marcadores da aba que está na tela.
  - **Aceites.** *Critério 3*: com o C01 concluído, `R01`/`R02` saem do bloqueio, `RIFT_OPEN` toca uma vez, os portais só são interativos na aba Fendas (Espaço neles abre o briefing de fenda) e o jogo novo não mostra a aba (`WorldMapScreen.rift.test.tsx`, 9 testes). *`check:terms` no `verify`*: ver acima. *Retratos como emblemas*: `forbiddenTerms.test.ts` exige, de todo contrato de `RIFT_CONTRACTS`, um `client.portrait` de emblema abstrato (forma entre CIRCLE/SHIELD/HEXAGON/DIAMOND/STAR, ícone, duas cores hex e 1–3 iniciais, sem rosto); vale para as fendas reais a partir de T060, e as fendas de teste seguem o mesmo molde.
  - Revisão visual (com fenda de teste temporária, revertida): portal violeta com faíscas sobre o gramado, aba "Fendas Dimensionais" ativa, briefing com a etiqueta e a moldura violeta, quadro da distorção a meio caminho e o voo com HUD emoldurado e o céu de fenda. Sem erros no console.
- **Status:** ✅

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

- **Notas de implementação — T060 (R01):**
  - **Bioma** `world/terrain/biomes/riftGreenHills.ts` (AOI de 200 × 400 m, seed 9101): relevo de senoides cruzadas `35·(½ + ¼·(sen(ku) + sen(kv)))` com λ = 120 m (de 0 nos vales a 35 m nas cristas; declive máximo ≈ 65 %, então só 12,5 % da AOI passa do limite de 30 % do FOOT_BIKE: cristas e vales); relva em xadrez de 8 m (o sampler guarda uma cor por cobertura, então os dois verdes são `GRASS` claro e `CROP` escuro, saturados como pedem as fendas); 3 lagoas nos vales ((90|210|330, 90), r = 9 m) com uma cachoeira de 3 m que desce 48 m da crista (`WATER`, "sem dados" na ortofoto como a água dos outros biomas); 2 trilhas ondulantes (nada a mais de 60 m delas); 6 arcos de pedra, 48 palmeiras estilizadas (`TREE`, copa de 4,5–6,5 m) e 40 anéis. `guaranteedAccessible` são as 4 cristas planas.
  - **Arcos**: caixa de 20 × 4 m com colunas de 20 % (o vão livre dá os 12 m da spec), 20–30 m de altura, largura ao longo de `v` para que as linhas de voo (ao longo de `u`) passem pelo vão, nas linhas planas do relevo (v = 30, 90, 150) para as colunas pousarem no mesmo nível. **Anéis**: 5 arcos de 8, sobre as linhas 2–6 do plano de referência (v = 24,6; 54,8; 84,9; 115,1; 145,2, que o teste confere com o planejador), Ø 6 m, parábola de 10 m nas pontas a ~40 m no meio, não sólidos e coletáveis a menos de 3 m.
  - **Contrato** `R01` em `rifts.ts` (ícone `Zap` registrado) conforme a ficha: Sonisvaldo, `EM_INTERFERENCE` + `COLLECTIBLE_RINGS`, 4 requisitos (GSD ≤ 3 cm e cobertura ≥ 80 % críticos; 4 GCPs e PEC B 1:1.000 importantes), R$ 25.000, 500 XP, +5, souvenir `SV_GOLD_RING`, museu (fendas, slot 0) a R$ 80/min, desbloqueio pelo C01, marcador `a` (FOOT_BIKE). O plano de referência (Atlas, câmera do peito, H 55, p 70, q 60, 9 m/s, sol alto) dá faixa de 30,16 m, 8 linhas, 208 fotos, GSD 2,31 cm e 473,4 s; a spec não lista CPs para a R01, então `cps: []` e o relatório mostra o PEC como "não verificável" (GCP × 1,8): classe A, RMSE 7,0 cm, **APROVADO**, nota 95. Os 5 GCPs encaixam a ≤ 16 m (viabilidade genérica).
  - **Aceites.** *Anéis somam bônus*: R$ 50 por anel ao pagamento (7 anéis = R$ 350; os 40 = R$ 2.000), sem mexer no valor-base nem no fator de qualidade; o HUD já mostra "Anéis: n". *Arcos com vão livre*: `hitsObject` não acusa nada no vão (±6 m do centro, nem numa passada ao longo de `u`); as colunas (6–10 m do centro) e a viga colidem; por cima do topo o corpo passa. *Atlas completa*: 473 s de voo para os 600 s de autonomia, uma bateria só, H 55 m dentro do teto de 80 m do Atlas e dos 100 m do contrato; o autopilot do E2E voa tudo sem queda. Testes em `riftGreenHills.test.ts` (13) e `rifts.test.ts` (8).
  - **Quatro ajustes colaterais.** (1) `withTestRifts` só injeta as fendas ainda ausentes do catálogo (a R01 de teste deu lugar à real; a R02 de teste fica até a T061) e os testes leem títulos e clientes do catálogo. (2) `HoloTableScreen` só foca o setor se ele for da ala Real: o `slot` de uma fenda é do anel do Multiverso (a mesa completa é a T072), e antes a chegada do relatório da R01 (slot 0) selecionaria o setor Real do slot 0. (3) `renderTerrain` junta as curvas de nível de cada faixa num traço só por estilo (de ~7.400 para ~2.430 `stroke` por quadro na R01, cerca de 6 % mais quadros; as colinas de 35 m em 120 m têm 3× mais segmentos de curva que o C03). (4) O E2E marca as fendas (`rift`) para não exigir o cartão do setor na mesa v1.
  - E2E: a R01 em `tests/e2e/contracts.spec.ts` (~1,6 min): autopilot do Atlas, 208 fotos, 0 colisões, relatório **APROVADO** com classe PEC, souvenir "Anel Dourado" e envio ao museu. Revisão visual no satélite (xadrez, lagoas com cachoeira, arcos e trilhas), no voo (colinas, arcos, anéis, palmeiras, moldura violeta e HUD "Anéis: 0") e nos produtos (ortofoto em xadrez, MDT de 0,5 a 35 m). Voo no Chromium sem GPU: 45–58 FPS (C00 60, C03 ~57); a otimização global fica para a T077/T078.
- **Notas de implementação — T061 (R02):**
  - **Bioma** `world/terrain/biomes/riftPipes.ts` (AOI de 240 × 300 m, seed 9202): relevo suave (fbm de 3 oitavas, 0–10 m) mais 10 morrinhos semiesféricos (meia elipsoide de raio 8–12 m e altura 6–9 m, no total ~20 m de relevo), cada um com dois olhos pretos (`ROCK` escuro, r ≥ 1,1 m) lado a lado no topo; relva `GRASS` saturada e duas trilhas onduladas (nada a mais de 80 m delas); 14 canos verdes (`PIPE`, 6–10 m de diâmetro e 15–40 m de altura, ≥ 10 m entre si), 10 plataformas de tijolos flutuantes (`BRICK_PLATFORM`, lajes de 12–18 × 6–9 × 3 m a 20–50 m do chão, giradas ao acaso) e 8 cascos (`MOVING_HAZARD`, Ø 5 m, verdes e vermelhos). Canos e lajes ficam dentro da AOI, longe das trilhas, dos morrinhos e dos 7 pontos de apoio do plano (5 GCPs e 2 CPs, que também são o `guaranteedAccessible`).
  - **Cascos**: um por eixo em rodízio (`u`, `v`, vertical `h`), amplitude de 10–25 m e período de 3–6 s (`RULE_PARAMS.movingHazards`), fase sorteada, a 30–45 m do chão (o vertical sobe a partir de uma base que não o enterra). São função pura do tempo (`motionOffset`); o corpo colide com a esfera onde ela está em `t`. Todos pairam ao menos 8 m abaixo da altitude do plano de referência (H = 100 m sobre a cota média), então o autopilot passa por cima; quem planeja mais baixo é que precisa cronometrar a passagem.
  - **Contrato** `R02` em `rifts.ts` (ícone `Wrench` registrado) conforme a ficha: Seu Márcio Bross, `EM_INTERFERENCE` + `MOVING_HAZARDS`, 5 requisitos (PEC A 1:1.000 com **equidistância de 1 m** e cobertura ≥ 80 % críticos; GSD ≤ 3 cm e 5 GCPs importantes; 2 CPs menor), R$ 30.000, 600 XP, +5, souvenir `SV_GREEN_PIPE`, museu das fendas slot 1 a R$ 90/min, desbloqueio pelo C01 (a R01 e a R02 saem do bloqueio juntas, com um `RIFT_OPEN` e dois avisos), marcador `b` (FOOT_BIKE). Plano de referência (Drone T1, câmera de 20 MP, H 100, p 75, q 70, 8 m/s, nublado): GSD 2,74 cm, 7 linhas, 105 fotos, 386,8 s, 1 bateria.
  - **Aceites.** *Hazards móveis*: 8 cascos, amplitude e período dentro da regra, periódicos e função pura do tempo, com colisão no centro da esfera e nenhuma depois que ela sai. *Canos de até 40 m*: 14 canos de 15 a 40 m, sólidos (`hitsObject` pega o tronco, não o ar ao lado nem o que passa por cima do topo), todos ≥ 20 m abaixo do plano. *PEC A altimétrico avaliado*: o relatório do plano de referência traz planimetria e altimetria classe A (EP 16,7 cm e PEC 27 cm na altimetria, 100 % dos pontos ≤ PEC; RMSE de checagem 9,8 cm em XY e 11,3 cm em Z na seed 3 do ensaio visual), com o multiplicador de interferência (×1,20) e o de rolling shutter sem RTK (×1,35) à mostra; `classifyPec` com 30 cm de erro de cota reprova a altimetria (classe B) com a planimetria ainda em A. Com só 2 CPs a amostra é pequena, então o resultado varia com a seed do jogo (o E2E fixa a seed 4).
  - **Ajustes colaterais.** (1) As fixtures de fendas de teste (`src/test/riftFixtures.ts` e os `vi.mock` de 4 arquivos) saíram: R01 e R02 são fichas de verdade e os testes de mapa, painel de depuração, voo e `unlockAll` usam o catálogo. (2) Desempenho: `landCover` e `baseElevation` rodam milhares de vezes por quadro no voo; a primeira versão dos olhos custava 50 % do tempo de CPU (20 `Math.hypot` e `eyeRadius` por chamada), e com os olhos e o raio ao quadrado pré-calculados o voo do R02 passou de ~40 para 60 FPS. (3) A seed 4 do E2E e dos testes visuais foi escolhida por não sortear contraproposta da MegaMap (as seeds 3 e 5 sorteiam).
  - E2E: a R02 em `tests/e2e/contracts.spec.ts` (~1,2 min): autopilot do T1 com a interferência (lateral e rumo), 105 fotos, 0 colisões, relatório **APROVADO** com classe PEC, souvenir "Cano Verde em Miniatura" e envio ao museu. Revisão visual no satélite (morrinhos com olhos, canos, lajes e cascos), no voo (canos, lajes e cascos sobre o campo, HUD com falhas da interferência) e na ortofoto.
- **Notas de implementação — T062 (R08):**
  - **Bioma** `world/terrain/biomes/riftSantosHood.ts` (AOI de 240 × 300 m, seed 9808): morro ondulado de 0–20 m (fbm de 2 oitavas, escala 110 m) com **16 vielas norte–sul e 13 leste–oeste** de 4, 5 e 6 m de largura (a largura de cada uma vem de um rodízio fixo; eixos a 26–36 m um do outro, o que dá quadras de 21–31 m), todas `ROAD`. Cada quadra é loteada em ~13 × 12,5 m com larguras sorteadas e vira **629 casas coladas** (0,3 m entre vizinhas, 6–12 m de altura, 10 cores vivas), que cobrem mais de 85 % do miolo das quadras e nunca pisam numa viela; 6 % dos lotes ficam vagos, cada um com uma **palmeira** (a quadra leva mais 4). A **quadra de basquete** (28 × 15 m, piso `BENCH` laranja, duas tabelas de 3,2 m não sólidas) ocupa a quadra do meio (u 132–168, v 108–134) e é **nivelada** na cota do seu centro, com 6 m de rampa; é o ponto de apoio garantido, e o GCP central do plano (150, 120) cai nela. O emaranhado de **fios baixos** (`LOW_WIRES`): 251 postes e 226 fios a 8–14 m, à beira de todas as vielas norte–sul e de uma em cada duas leste–oeste. Céu alaranjado na paleta (o véu violeta-ciano das fendas se mistura a ele). Ao todo 1.157 objetos, criados em ~21 ms.
  - **Contrato** `R08` em `rifts.ts` (ícone `Bike` registrado) conforme a ficha: Carlinhos Joilson (CJ), `EM_INTERFERENCE` + `LOW_WIRES`, 7 requisitos (PEC A 1:1.000 e cobertura ≥ 85 % críticos; GSD ≤ 2 cm, sobreposições de 80 % e 70 % e 5 GCPs importantes; 3 CPs menor), R$ 28.000, 700 XP, +5, souvenir `SV_BMX`, museu das fendas slot 7 a R$ 85/min, **desbloqueio pelo C05** (concluir o C01 abre só a R01 e a R02), marcador `h` (FOOT_BIKE). Plano de referência (T2, câmera de 45 MP, lente de 35 mm, H 80, p 80, q 70, 8 m/s, sol alto): GSD 1,00 cm, 11 linhas, 330 fotos, 575,8 s, 1 bateria. Os 8 pontos de apoio encaixam a ≤ 4 m (vielas e quadra).
  - **Aceites.** *Vielas de 4–6 m*: todas as 29 vielas têm de 4 a 6 m (três larguras), são polilinhas `ROAD` e o sampler pinta o eixo de cada uma. *Fios*: poste à beira de uma viela e fio a 8–14 m, com a tolerância de colisão de 1 m da regra; o plano passa 30 m ou mais acima de tudo. *Casas coladas*: a área construída passa de 85 % do miolo das quadras, com no máximo 0,5 m entre vizinhas.
  - **A sobreposição lateral do plano de referência fica em 69,97 %.** A ficha pede q ≥ 70 % e o plano tem q = 70 %, sem folga: com 20 m de relevo e voo de altitude constante (sem Terrain Following) a faixa estreita nos morros e alarga nos vales, e como `1 − s/W` é côncava em W a média das duplas de linhas cai uns 0,03 ponto (Jensen). O relatório (também no voo do autopilot) marca "Sobreposição lateral" como não atendida, **IMPORTANTE**, e a missão segue **APROVADA** (classe A, nota 100, sem crítico). A viabilidade previsível (q nominal) passa, como a spec define; o briefing manda "dar folga ao q", e com q = 72 % o requisito passa (teste). Dados da spec mantidos.
  - **Ajuste colateral.** O relatório mostrava "70 %" ao lado de "Não atendido ≥ 70 %": `pctVs` (`domain/requirements.ts`) passa a mostrar duas casas ("69,97 %") quando o arredondamento esconderia a reprovação, nas sobreposições e na cobertura.
  - E2E: a R08 em `tests/e2e/contracts.spec.ts` (~1,9 min): autopilot do T2 sobre as casas, os fios e a interferência, 330 fotos, 0 colisões, relatório **APROVADO** com classe PEC, souvenir "BMX em Miniatura" e envio ao museu. Revisão visual no satélite (o bairro colorido, a quadra laranja, as palmeiras nos lotes vagos), no voo (casas, postes e fios sobre o céu alaranjado com o véu violeta) e no briefing da fenda. Voo a 60 FPS no Chromium sem GPU, igual ao C05.
- **Notas de implementação — T063 (R11):**
  - **Bioma** `world/terrain/biomes/riftCliffTombs.ts` (AOI de 240 × 400 m, seed 9111): cânion ao longo de `u` com `cota = f(u) + (100 − f(u))·smoothstep(25, 35, |v − 120| − 60)` (terrain §3), mais rugosidade de ±0,8 m no fundo e ±1,5 m no planalto. O **fundo `f(u)` sobe e desce de 0 a 40 m** num ciclo só de 400 m (`20 + 20·sen(2π(u + 40)/400)`, declive máximo de ~31 %), o que dá **paredões de 60 a 100 m** e uma rampa de 10 m (|v − 120| de 85 a 95, até 86° de declive). Um rio sinuoso (eixo 120 ± 14 m, 12 m de largura, leito 3 m abaixo, margens de areia), estratos nas paredes (`ROCK` e `SAND` alternam a cada 12 m de cota), uma trilha pela margem, **3 templos** `CLIFF_TEMPLE` no pé dos paredões (40 × 12 × 32 m em (200, 44), 36 × 12 × 28 m em (110, 196) e 34 × 12 × 36 m em (315, 44)), o alvo `TEMPLE_FACADE` em (200, 60) com r = 20 m e `PHOTO`, e **2 pontes de corda** (`WIRE` de v = 12 a v = 228, em u = 90 e 300, 2 m acima do planalto, com um poste em cada ponta). Céu claro e paleta de arenito saturada.
  - **Por que o fundo oscila.** O plano de referência não tem Terrain Following, e a altitude constante é a cota média da AOI mais H (70 m). Com o fundo plano em 0 m a média seria 25 m, a altitude 95 m e as linhas de borda (v = −5,7; 25,8; 214,2; 245,7) bateriam no planalto de 100 m. Com o fundo de 0 a 40 m (média 20 m) a média da AOI vai a 44,7 m, a altitude a 114,7 m, e o plano passa **13 m acima** do ponto mais alto sob as linhas. Nas quatro linhas sobre o planalto o AGL é de 11–14 m: ali as fotos saem borradas (124 das 279 no voo do autopilot, com os avisos "Overlap insuficiente" e "Motion blur" no HUD), mas a cobertura segue em 100 %, porque a pegada oblíqua das linhas do fundo (150 m de largura, projetada no plano do terreno) já cobre as bordas.
  - **Contrato** `R11` em `rifts.ts` (ícone `Crosshair` registrado) conforme a ficha: Dona Laura da Silva, `EM_INTERFERENCE` + `VERTICAL_CLIFFS` + `FEATURE_TARGETS` + `PAINT_MARKERS`, 5 requisitos (voo oblíquo e fachada capturada críticos; cobertura ≥ 75 %, ASPRS 6/8 cm e 5 GCPs importantes), R$ 65.000, 1.100 XP, +5, souvenir `SV_PAINT_PISTOL`, museu das fendas slot 10 a R$ 130/min, **desbloqueio pelo C05** (junto com a R08: um `RIFT_OPEN` e dois avisos), marcador `k` (FOOT_BIKE). Plano de referência (T2, 45 MP, lente de 24 mm, H 70, p 80, q 70, 6 m/s, oblíqua de 45°, nublado): GSD 1,28 cm, 9 linhas, 279 fotos, 775,9 s, 1 bateria. Sem CPs na ficha, o ASPRS sai "não verificável" (GCP × 1,8): H 4,4 cm e V 4,4 cm no voo do autopilot (limites de 6 e 8 cm), relatório **APROVADO**, nota 92.
  - **Aceites.** *`PAINT_MARKERS` permite GCPs no paredão*: os GCPs dos quatro cantos caem a 62–70 m de cota, na face do paredão (declive > 300 %): com a tinta são válidos e sem ela reprovam por `TOO_STEEP`; a água segue inválida mesmo com a tinta, então o GCP do meio, em cima do rio, encaixa na margem a ≤ 30 m. *`TEMPLE_FACADE` capturada com oblíqua*: o plano de referência cobre o centro do alvo com ≥ 3 fotos válidas (cada uma das linhas 2 a 5 o captura sozinha, pela pegada oblíqua de ~155 m) e, sem essas linhas, o crítico `R11-facade` reprova a missão. *Voo oblíquo crítico*: o plano previsto passa e o mesmo plano sem a inclinação reprova `R11-mode`. Paredões de 60–100 m com declive máximo de 86° (> 80°) e templos sólidos (`hitsObject`). Testes em `riftCliffTombs.test.ts` (11) e `rifts.test.ts` (7 da R11).
  - E2E: a R11 em `tests/e2e/contracts.spec.ts` (~2,2 min): autopilot do T2 sobre o cânion, pelo vento e pela interferência, 279 fotos, 0 colisões, relatório **APROVADO** (sem classe PEC: o requisito é ASPRS), souvenir "Pistola de Tinta Marcadora" e envio ao museu. Revisão visual no satélite (planalto, paredão em faixas, rio e trilha, os templos), no voo (o cânion com os estratos, o rio no fundo e o planalto) e no briefing. Voo a 60 FPS no Chromium sem GPU.
- **Notas de implementação — T064 (R06):**
  - **Alvos térmicos.** `FeatureTarget` ganhou o campo opcional `sensorKind`; as tocas `DEN_A/B/C` o trazem como `THERMAL`. `capturedFeatures` só conta as fotos de uma câmera desse tipo (a spec de survey-flight §5 já dizia "para `DEN_*`, o sensor tem de ser THERMAL"): as mesmas fotos RGB passam em branco pela toca, e o alvo da fachada do templo, sem `sensorKind`, segue valendo para qualquer câmera.
  - **Render termal do voo** (`engines/flight/thermal.ts`): com a câmera termal o terreno deixa as cores do bioma e vira uma rampa de calor ("ferro quente": preto-azulado → roxo → vermelho → laranja → branco, só sobe). Cada cobertura tem seu calor sob céu encoberto (água 0,16 < brejo 0,30 < capim 0,38 < pedra 0,52 < estrada 0,58 < telhado 0,62), os objetos também (árvore morta fria, prédio morno) e as tocas somam uma mancha gaussiana de até +0,55 (22 % a um raio, nada a 2,5). O `TerrainScene` ganhou o campo `thermal: { heatAt }`, que o `FlightEngine` preenche quando `planEquipment(...).camera.kind === 'THERMAL'`; no RGB a cena é a de sempre e a toca não deixa rastro.
  - **Bioma** `world/terrain/biomes/riftGreySwamp.ts` (AOI de 200 × 300 m, seed 9606): brejo quase plano de 0–8 m (fbm de 3 oitavas), ~69 % `SWAMP`, ~10 % de poças (`WATER`) e ~12 % de ilhotas de capim, paleta lavada e névoa baixa cinza; 90 árvores mortas (copa de 2,5–4 m, 5–9 m de altura, cinza) e 4 ruínas de pedra (muros de 2–4 m em volta de um pátio, até 10 muros em pé); uma calçada de pedra velha (`TRAIL` de 3 m, chão firme e ponto de apoio garantido). As 3 tocas (80, 60), (220, 150) e (150, 40), de r = 8 m, são só `features`: num raio de 14 m não há água, árvore, muro nem nada além de brejo, então no RGB elas não existem.
  - **Contrato** `R06` em `rifts.ts` (ícone `Sword` registrado) conforme a ficha: Geraldo de Rívia, `EM_INTERFERENCE` + `FEATURE_TARGETS`, 6 requisitos (sensor térmico e toca A críticos; tocas B e C e cobertura ≥ 70 % importantes; GSD ≤ 14 cm menor), R$ 60.000, 1.100 XP, +5, souvenir `SV_THEODOLITE_SWORD`, museu das fendas slot 5 a R$ 130/min, **desbloqueio pelo C06**, marcador `f`, **veículo mínimo picape 4x4**. Plano de referência (T2, câmera termal, H 100, p 75, q 65, 8 m/s, nublado), sem pontos de apoio: GSD 13,08 cm, 8 linhas, 160 fotos, 426,6 s. Voo do autopilot: **APROVADO**, nota 91, as três tocas capturadas, cobertura 100 %.
  - **Aceites.** *Sensor térmico obrigatório*: a previsão do plano térmico passa e a do mesmo plano com a câmera de 45 MP reprova o crítico `R06-sensor`; uma missão voada em RGB reprova ainda pelas tocas (`R06-den-a` crítico) e fica reprovada. *Tocas visíveis só no render termal*: as fotos do plano de referência capturam as três tocas com a câmera termal e nenhuma com a RGB; no render, a mancha de calor 0,55 acima do brejo fica 2× mais clara na rampa, e o `FlightEngine` só liga o `thermal` com a câmera termal (testado com o motor de verdade). *4x4 para chegar*: o marcador `f` só se alcança de picape (a pé, de carro e de van, não), e no brejo a bicicleta é barrada por `SWAMP` enquanto a picape passa. Testes em `thermal.test.ts` (8), `riftGreySwamp.test.ts` (8) e `rifts.test.ts` (8 da R06).
  - **Ajustes colaterais.** (1) `RIFT_CONTRACTS` passa a seguir a ordem dos ids (R01, R02, R06, R08, R11, …). (2) Missão sem pontos de apoio (R06, e as próximas fendas sem GCPs): a aba Acurácia mostrava uma tabela de resíduos vazia e "RMSE 0,0" e o comparativo da MegaMap, "Seu mapa: RMSE planimétrico 0,0 cm"; agora há uma nota ("Esta missão não usa pontos de apoio…") e o comparativo diz que não há pontos para medir (`ReportAccuracy`, `MegaMapCard`, com testes).
  - E2E: a R06 em `tests/e2e/contracts.spec.ts` (~1,3 min): autopilot do T2 com a câmera termal sobre o brejo, 160 fotos, 0 colisões, relatório **APROVADO** (sem classe PEC), souvenir "Espada-Teodolito em Miniatura" e envio ao museu. Revisão visual no voo (o brejo na rampa térmica, roxo e magenta, com as tocas como manchas laranja) e no relatório. Voo a 60 FPS no Chromium sem GPU. A ortofoto segue só para RGB e multiespectral, como a spec define (o produto térmico não existe), então as tocas aparecem no voo e nos marcadores de captura do visualizador.
- **Notas de implementação — T065 (R07):**
  - **Bioma** `world/terrain/biomes/riftPolarBase.ts` (AOI de 240 × 300 m, seed 9707): planície nevada de 0–15 m (fbm de 2 oitavas, escala 140 m) com o **complexo nivelado** na cota do centro do pátio (retângulo de 220 × 180 m com 15 m de rampa); um **pátio cercado** de 120 × 100 m (u 90–210, v 70–170) com cerca de 2,5 m (44 trechos de tela de 10 m, com um poste por vão), **4 torres de vigia** de 20 m nos cantos do pátio, **4 hangares** de 36 × 22 × 10 m fora dele e 2 galpões de 12 × 8 × 5 m dentro, o **andador bípede gigante** (`GIANT_WALKER` de 16 × 12 × 25 m) parado em (150, 120) e o alvo `WALKER` (r = 15 m, `PHOTO`, sem `sensorKind`: qualquer câmera o fotografa). Uma estrada de serviço de 8 m contorna o complexo e outra chega pelo oeste. Neve em tudo (só telhados e estrada fogem dela), céu e névoa claros.
  - **Holofotes**: um por torre (`zones()` devolve 4 zonas `SEARCHLIGHT` de r = 15 m, varredura de 90° e período sorteado entre 6 e 9 s). A mancha de luz tem 35 % do raio (5,25 m) e gira a 7,5 m da torre; atravessá-la a 9 m/s leva `2·5,25/9 = 1,17 s`, abaixo dos 1,5 s da detecção do T2 (3 s do Atlas), então o plano de referência passa sem ser visto.
  - **Contrato** `R07` em `rifts.ts` (ícone `Package` registrado) conforme a ficha: Cobrinha Sólida, `EM_INTERFERENCE` + `BLIZZARD_DRAIN` + `SEARCHLIGHTS` + `FEATURE_TARGETS`, só `BLIZZARD`, vento de 7 m/s com rajadas de 4, 4 requisitos (`NOT_DETECTED` e andador capturado críticos; cobertura ≥ 70 % importante; GSD ≤ 3 cm menor), R$ 70.000, 1.200 XP, +5, souvenir `SV_CARDBOARD_BOX`, museu das fendas slot 6 a R$ 140/min, **desbloqueio pelo C06** (junto com a R06), marcador `g` (FOOT_BIKE). Plano de referência (T2, 45 MP, lente de 24 mm, H 110, p 75, q 65, 9 m/s, nevasca), sem pontos de apoio: GSD 2,01 cm, 6 linhas, 78 fotos, 307,0 s, 1 bateria.
  - **Aceites.** *`NOT_DETECTED`*: o autopilot voa as 6 linhas a 1× no motor de verdade, sem detecção, sem colisão e capturando o andador; o relatório da missão detectada reprova o crítico e a missão fica reprovada. *Dreno 2×*: o mesmo voo gasta de 1,9× a 2,1× a energia com `BLIZZARD_DRAIN` (307 s de voo viram 614 s dos 2.100 s do T2: sobram cerca de 66 %). *Andador como feature*: o plano de referência o captura (≥ 3 fotos válidas cobrem o centro) e o `FlightEngine` o devolve em `featuresCaptured`. Testes em `riftPolarBase.test.ts` (9) e `rifts.test.ts` (7 da R07, com duas simulações de voo completo).
  - E2E: a R07 em `tests/e2e/contracts.spec.ts` (~1 min): autopilot do T2 sob a nevasca, 78 fotos, 0 colisões, **sem detecção**, relatório **APROVADO** (nota 100, 66 % de bateria), souvenir "Caixa de Papelão" e envio ao museu. Revisão visual no satélite (o anel da estrada, os hangares, o pátio com as torres e o andador) e no voo (a neve, os flocos e o HUD). Voo a 60 FPS no Chromium sem GPU.
- **Notas de implementação — T066 (R09):**
  - **Bioma** `world/terrain/biomes/riftTallGrass.ts` (AOI de 400 × 800 m, seed 9909): relevo de 0 a 20 m com `RELIEF_M·w²`, `w = ½ + ½·clamp(1,3·fbm, −1, 1)` (fbm de 3 oitavas, escala 260 m): o quadrado dá mais várzea que morro (média 5,5 m, mediana 5,3 m, máximo 16 m), e a bacia do **lago** (elipse de 220 × 140 m em (560, 250), 3 m de bacia, margem de areia a 1,25×) afunda por baixo; cobertura em ~52 % `GRASS` (capim baixo claro), ~36 % `CROP` (as **manchas de capim alto**, escuras e viçosas: ruído de baixa frequência, `n.b(u/95, v/95) > 0,2`), ~4 % `SAND` e ~7 % `WATER`; NDVI de 0,84 ± 0,04 no capim alto, 0,50 ± 0,06 no baixo, 0,14 na areia, 0,10 na estrada e −0,3 na água (nenhum pixel de capim baixo passa de 0,6, nenhum de capim alto fica abaixo de 0,8); 3 trilhas de terra de 3 m (duas ao longo de `u`, uma cruzando por `v`) e 60 árvores isoladas (`TREE`, copa de 6–9 m, 8–14 m de altura) longe do lago, da margem e das trilhas. A trilha em (400, 100) é o ponto de apoio garantido. Não há objeto de criatura: os picos vêm do tempo (`ELECTRIC_CREATURES`).
  - **Faíscas** `engines/flight/electricSparks.ts` (ligadas no `FlightEngine` depois do LiDAR e antes do clima e das partículas): durante um pico, 28 retângulos amarelos (`rgba(250, 204, 21, a)`, 2–4 × 5–10 px) sobem do capim **do lado da criatura**, o oposto ao do empurrão, com o brilho `sen(π·idade)` (nada no instante exato em que o pico começa ou termina) e uma fase por faísca. O desenho depende só do tempo e do início do pico (`hash2`, sem `Math.random`) e não acontece com `reduceFlashes` nem para o Atlas (imune, sem agenda de picos).
  - **Contrato** `R09` em `rifts.ts` (ícone `Backpack` registrado) conforme a ficha: Ailton da Rocha, `EM_INTERFERENCE` + `ELECTRIC_CREATURES` + `HOMOGENEOUS_TEXTURE`, 4 requisitos (sensor multiespectral e cobertura ≥ 75 % críticos; GSD ≤ 12 cm e sobreposição longitudinal ≥ 80 % importantes), R$ 40.000, 800 XP, +5, souvenir `SV_CAP`, museu das fendas slot 8 a R$ 100/min, desbloqueio pelo C02 (a R09 sai do bloqueio sozinha, com um `RIFT_OPEN`), marcador `i` (FOOT_BIKE). Plano de referência (T2, CAM_MS5, H 120, p 80, q 65, 12 m/s, sol alto), sem pontos de apoio: GSD 7,53 cm, 9 linhas, 333 fotos, 725,2 s, 1 bateria.
  - **Aceites.** *NDVI*: o produto NDVI do mapa mostra o histograma bimodal (capim baixo em ~0,5, alto a partir de 0,8, ~36 % da AOI; a água, abaixo de 0), e o plano com a câmera RGB reprova o crítico `R09-sensor` (missão reprovada). *Picos elétricos*: 8–12 s entre picos, 2 s de duração, 3 m/s de empurrão lateral; o T2 não é imune e o Atlas é (testes de agenda do T052 e deste bioma); no motor de verdade o quadro do pico traz as 28 faíscas, o de fora do pico nenhuma, e `reduceFlashes` e o Atlas não as veem. *Textura homogênea*: o relatório mostra o multiplicador de textura ×1,24 com p ≥ 80 % e ×1,6 com p = 75 %. O autopilot voa o plano de referência inteiro (9 linhas, 333 fotos, sem colisão, 50 % de bateria, 725 s de voo dos 2.100 s do T2). Testes em `riftTallGrass.test.ts` (12), `electricSparks.test.ts` (9) e `rifts.test.ts` (11 da R09).
  - **A sobreposição longitudinal do plano de referência fica logo abaixo de 80 % no voo de verdade.** A ficha pede p ≥ 80 % e o plano tem p = 80 % a H = 120 m, que é justamente o teto do T2 (`hMaxM` = 120): a altitude constante é a cota média da AOI mais H, e nos vales o teto de AGL do T2 a corta, então nenhuma foto sai com AGL acima de 120 m e nos morros o AGL cai. A mediana medida no voo do autopilot fica em ~79,85 % ("Não atendido: Sobreposição longitudinal ≥ 80 % | 79,86 %", **IMPORTANTE**) e a missão segue **APROVADA** (nota 100, sem crítico); a missão sintética, que não modela o teto, dá 80,03 %. É o mesmo caso da R08 (dados da spec mantidos): o briefing manda "dar folga ao p", e com p = 82 % o voo de verdade mede ~81,9 % e passa (teste). A previsão antes do voo (p nominal) passa, como a spec define.
  - **Ajuste colateral.** O `fly` do `rifts.test.ts` (voo completo com o motor de verdade) subiu para o escopo do módulo, devolve as fotos (`onShots`) e serve à R07 e à R09.
  - E2E: a R09 em `tests/e2e/contracts.spec.ts` (~2 min): autopilot do T2 sobre o capim, com os picos elétricos e a interferência, 333 fotos, 0 colisões, relatório **APROVADO** (sem classe PEC), souvenir "Boné Virado para Trás" e envio ao museu. Revisão visual no satélite (manchas escuras de capim alto, lago com margem de areia, trilhas e árvores), no briefing e no voo (a savana, o lago, as árvores e as faíscas amarelas sobre o capim durante o pico). Voo a 59–60 FPS no Chromium sem GPU.
- **Notas de implementação — T067 (R03):**
  - **Bioma** `world/terrain/biomes/riftCraters.ts` (AOI de 400 m em `u` × 300 m em `v`, seed 9303): planalto rochoso de cristas `60·smoothstep(0,3; 1; ridged)` (ruído de cristas de 3 oitavas, escala 250 m) com **8 crateras** de raios 45, 40, 32, 28, 24, 20, 16 e 15 m (6–10 na ficha, 15–45 m), cada uma com a cota `−0,4·r·(1 − (d/r)²)` (fundo de 0,4·r, borda viva de ~38,7° e nada fora do raio; ~150.000 m³ de terra vaporizada no total, `0,2·π·r³` cada); a cota da AOI vai de −14 m (cratera em baixada) a 60 m, **74 m de alívio** e declive máximo de 61,8° (p99 de 55°, mediana de 28°), dentro dos 35°–70° do `STEEP_RELIEF`. Cobertura ~78 % `ROCK` (cor de brasa) e ~22 % `SAND` (o fundo das crateras, até 0,8·r, e as baixadas abaixo de 8 m), NDVI de 0,05–0,09, sem dossel. As crateras ficam dentro da AOI, afastadas entre si e a mais de 36 m dos patamares.
  - **Patamares e trilhas.** O chão do planalto tem mediana de 28° de declive, então os 5 GCPs do plano de referência ((30, 30), (370, 30), (30, 270), (370, 270) e (200, 150)) ganham **patamares nivelados** (10 m planos e 26 m de rampa, na cota média do disco, calculada uma vez por ruído; a rampa larga mantém os taludes abaixo de 70°: com rampa de 12 m o declive passava de 74°). E, como a pé (`FOOT_BIKE`) só se crava GCP a ≤ 150 m de uma estrada ou trilha (`gcpReachM`), o planalto ganhou **2 trilhas de terra de 3 m**, uma por borda (`v ≈ 22` e `v ≈ 282`), que deixam toda a AOI a ≤ 130 m delas; sem elas os cinco pontos davam `OUT_OF_REACH`. Os patamares são o `guaranteedAccessible`.
  - **Colunas de energia e rochas.** 6 `ENERGY_BEAM` de 80 m e 6 m de diâmetro, no centro das 6 maiores crateras, **ciano e amarelas** alternadas, com o ciclo da regra (2 s ligada, 3 s apagada) e as 6 fases defasadas de 5/6 s (sempre há coluna ligada e coluna apagada). O `objectRenderer` desenhava o feixe sempre em rosa; agora usa a cor do objeto (com a névoa), e ligado ganha um núcleo claro de 40 % da largura (apagado, só a coluna fraca; a 0,5 s de ligar, o pulso de antes). 14 rochas flutuantes pequenas (`BRICK_PLATFORM` de 3–7 m, 2–4 m de altura, a 8–24 m do chão, **não sólidas**: decorativas, `hitsObject` nunca as pega).
  - **Contrato** `R03` em `rifts.ts` (ícone `Flame` registrado) conforme a ficha: Guko, `EM_INTERFERENCE` + `ENERGY_BEAMS` + `STEEP_RELIEF`, 4 requisitos (erro de volume ≤ 3 % e cobertura ≥ 85 % críticos; ASPRS 8 cm (H) e 10 cm (V) e 5 GCPs importantes), R$ 45.000, 900 XP, +5, souvenir `SV_STAR_SPHERE`, museu das fendas slot 2 a R$ 110/min, **desbloqueio pelo C04**, marcador `c` (FOOT_BIKE). Plano de referência (T2, 45 MP, lente de 24 mm, H 90, p 75, q 65, 10 m/s, **Terrain Following**, sol alto) com os 5 GCPs: GSD 1,64 cm, 8 linhas (v = −15 a 315), 160 fotos, 442,0 s, 1 bateria. Sem CPs na ficha, o ASPRS sai "não verificável" (GCP × 1,8) e cabe nos limites: H 5,0 cm e V 5,3 cm. Missão sintética: **APROVADA**, nota 100.
  - **Aceites.** *Volumetria ≤ 3 %*: o relatório do plano de referência dá 0,00 % (o volume é o do alívio todo da AOI contra o plano médio das bordas, ~1,7 milhão de m³, com profundidade média de ~25 m: σ = 0,5·RMSE_z/profundidade ≈ 0,2 %); cada ponto de cobertura vermelha (< 3 fotos) tira meio ponto, então 5 % de buracos dão ~2,5 % (passa) e 7 % dão ~3,5 % (reprova), e com só 4 das 8 linhas o relatório reprova a cobertura e o volume pelos dois críticos. *Beams*: as colunas só ferem ligadas e só abaixo do topo (a 80,5 m ainda batem, a 90 m o T2 passa); no voo do autopilot o T2 passa **12 m acima do topo** (o TF segura o AGL entre 82 e 107 m), 8 linhas, 160 fotos, 0 colisões, 74 % de bateria. Em altitude constante o AGL varia ~140 m (63 a 137 m): é por isso que a ficha pede o TF. Testes em `riftCraters.test.ts` (16), `objectRenderer.test.ts` (5) e `rifts.test.ts` (10 da R03).
  - **Ajuste colateral.** O `fly` do `rifts.test.ts` ganhou o gancho `onFrame(engine)` por quadro (a folga sobre as colunas e o AGL saem dele).
  - E2E: a R03 em `tests/e2e/contracts.spec.ts` (~1,2 min): autopilot do T2 com TF sobre o planalto, 160 fotos, 0 colisões, relatório **APROVADO** (sem classe PEC: o requisito é ASPRS), souvenir "Esfera Laranja de 4 Estrelas" e envio ao museu. Revisão visual no satélite (planalto cor de brasa, crateras de fundo claro, colunas ciano e amarelas com sombra, trilhas pontilhadas, hachura nos trechos íngremes), no briefing e no voo (terraços do planalto e as colunas translúcidas de pé nas crateras). Voo a 56–60 FPS no Chromium sem GPU.
- **Notas de implementação — T068 (R05):**
  - **Bioma** `world/terrain/biomes/riftCubes.ts` (AOI de 320 m em `u` × 240 m em `v`, seed 9505): um terreno de blocos. O chão é feito de **colunas de 4 × 4 m** com a cota `floor(h/4)·4` (a ficha: degraus de 4 m), `h = 80·clamp(½ + fbm, 0, 1)` avaliado no centro da coluna (fbm de 4 oitavas, escala 130 m): 21 degraus possíveis de 0 a 80 m, todos presentes, cada coluna plana e dois vizinhos sempre diferindo em múltiplos de 4 m. O declive de talude (diferença central de 12 m, três colunas) tem mediana de ~34°, p99 de ~56° e máximo de ~66°, dentro dos 35°–70° do `STEEP_RELIEF`. A cota de cada coluna fica numa tabela por ruído (cada amostra consulta as quatro vizinhas para achar a borda). Cobertura: ~12 % `LAVA` (toda coluna abaixo de 8 m: um lago a oeste), ~20 % `ROCK` (a faixa de 1 m junto de cada degrau para baixo: a "parede"), o resto `GRASS` e `CROP` num **xadrez de pixels de 1 m** (16 por quadrado de 4 m, 38 % do escuro): a "textura de 4 × 4 pixels por quad" da ficha. NDVI de 0,62–0,74 no verde e 0,02 na lava.
  - **Blocos, árvores, patamares e trilha.** 30 `CUBE_BLOCK` soltos de 4 × 4 × 4 m no centro de colunas (8 com outro bloco por cima) e 12 árvores cúbicas (tronco de 1 × 1 × 6 m e copa de 5 × 5 × 4 m a 6 m do chão, dois `CUBE_BLOCK` cada): 62 caixas sólidas ao todo, nunca na lava, nos patamares nem na trilha. Os 5 GCPs do plano de referência ((20, 20), (300, 20), (20, 220), (300, 220), (160, 120)) ficam em **patamares planos** de 8 m de raio na cota da coluna do centro (no mínimo 8 m: nunca lava); com 12 m de raio o declive máximo passava de 70° (as bordas do patamar viram degraus altos), com 8 m fica em ~66°. Uma **trilha de terra** de 3 m cruza a AOI (a picape chega a 400 m de uma via; sem via os GCPs dariam `OUT_OF_REACH`).
  - **Lava com térmicas e brilho.** `zones` das receitas passou a receber o contexto de `placeObjects` (`PlacementCtx`: a cota, os limites e as vias; parâmetro novo e opcional, as receitas de antes seguem valendo): a R05 acha as colunas de lava na AOI e chama o gerador `lavaThermalZones`, que põe uma térmica (6 m/s, r = 40 m) por aglomerado de 40 m: **11 térmicas** sobre o lago. O `terrainRenderer` ganhou `lavaGlow` (ligado pelo efeito `thermalGlow` da regra `LAVA_THERMALS`, antes sem uso): a lava sai mais clara (×1,18) e pulsa ±0,14 devagar, de ponto em ponto: o "brilho laranja" da spec. As térmicas valem a metade sem sol a pino (`thermalLiftMs`): sob céu encoberto o TF absorve os 3 m/s, mas com `SUN_HIGH` os 6 m/s passam dos 5 m/s de subida do T2 e o drone sobe (o AGL médio dentro delas passa de ~88 m para ~98 m).
  - **Contrato** `R05` em `rifts.ts` (ícone `Box` registrado) conforme a ficha: Estêvão, `EM_INTERFERENCE` + `LAVA_THERMALS` + `STEEP_RELIEF`, 5 requisitos (cobertura ≥ 85 % crítica; sobreposição longitudinal ≥ 80 %, ASPRS 6 cm (H) e 8 cm (V), Terrain Following e 5 GCPs importantes), R$ 50.000, 1.000 XP, +5, souvenir `SV_CUBE_ORE`, museu das fendas slot 4 a R$ 120/min, **desbloqueio pelo C04** (a R03 e a R05 saem do bloqueio juntas, com dois avisos), marcador `e`, **veículo mínimo picape 4x4** (OQ-009, padrão provisório A: o portal fica atrás do cinturão). Plano de referência (T2, 45 MP, lente de 24 mm, H 80, p 80, q 70, 8 m/s, **TF**, nublado) com os 5 GCPs: GSD 1,46 cm, 8 linhas, 184 fotos, 452,4 s, 1 bateria. Sem CPs na ficha, o ASPRS sai "não verificável" (GCP × 1,8) e cabe: H 4,6 cm e V 4,8 cm. Missão sintética: **APROVADA**, com os 5 requisitos atendidos.
  - **Aceites.** *Terreno quantizado*: toda cota da AOI e da margem é múltipla de 4 m, de 0 a 80 m, e cada coluna é plana. *Lava com térmicas*: a lava só existe abaixo de 8 m, toda célula de lava da AOI fica a ≤ 40 m de uma das 11 térmicas e o voo sob sol sobe mais que o nublado, sempre sem colisão. *TF*: o autopilot voa as 8 linhas sobre os degraus, 0 colisões, 74 % de bateria, com o AGL entre ~50 e ~106 m (o TF olha 2 s à frente e voa sobre o ponto mais alto da janela, então o AGL médio passa dos 80 m do plano); sem o modo a previsão reprova o `R05-tf`. Ao contrário da R08 e da R09, **a sobreposição longitudinal passa no voo de verdade** (mediana de ~80,7 %), pelo mesmo motivo. Em altitude constante o AGL varia mais de 80 m. Testes em `riftCubes.test.ts` (13), `rifts.test.ts` (11 da R05 e da liberação pelo C04), `terrainRenderer.test.ts` (2), `lavaGlow.test.ts` (2) e `terrain.test.ts` (2).
  - **Questão aberta.** OQ-011 (GCP sobre a lava): a spec de acessibilidade não invalida a lava, então um GCP pode ser cravado nela; padrão provisório: manter a spec.
  - E2E: a R05 em `tests/e2e/contracts.spec.ts` (~1,2 min): autopilot do T2 com TF sobre os degraus, ~176 fotos, 0 colisões, relatório **APROVADO** (sem classe PEC), souvenir "Bloco de Minério Cúbico" e envio ao museu. Revisão visual no satélite (o xadrez de verdes com o contorno de rocha de cada degrau, o lago de lava a oeste, a trilha), no briefing e no voo (a colcha de degraus verdes e cinzentos, os blocos, as árvores cúbicas e a lava clara). Voo a 58–60 FPS no Chromium sem GPU.
- **Notas de implementação — T069 (R04):**
  - **Bioma** `world/terrain/biomes/riftFairyForest.ts` (AOI de 600 m em `u` × 400 m em `v`, seed 9404): relevo de 0 a 29 m (`30·(½ + ½·clamp(2·fbm, −1, 1))`, fbm de 4 oitavas, escala 180 m, declive máximo de ~41°); **floresta** `FOREST` em ~96 % da AOI, com dossel de 0,95 (0,94–0,96, dentro dos 0,90–0,98 do `DENSE_CANOPY`); **5 clareiras** fixas de 22–30 m de raio e dossel 0, niveladas (disco plano na cota média dele, 12 m de rampa por fora: com o relevo cru, uma das clareiras dava `TOO_STEEP` ao GCP a pé); **4 trilhas** de terra de 3 m que ligam as clareiras (toda a AOI a ≤ 150 m de uma); ~1.600 **árvores gigantes** (`TREE`, uma por célula de 16 m, de 30 a 50 m de altura e copa de 14 a 20 m; a copa nunca invade a clareira nem cobre a trilha: a árvore sai a meia copa mais 1 m delas) e ~57 **cogumelos luminosos** (caule e chapéu como dois `PIPE` de 0,7 × 1,6 m e 2,6 × 0,8 m, **não sólidos**, em magenta, ciano, violeta e lima, nas clareiras e à beira das trilhas); a zona `FOG` de densidade 0,9 sobre tudo, como pede terrain §3. Os vaga-lumes e a névoa violeta do voo já vinham da iluminação `MAGIC_FOG` (partículas `FIREFLY`, névoa de 220 m, paleta violeta do bioma).
  - **O templo soterrado.** O alvo `TEMPLE` (300, 200), r = 30 m, `LIDAR`, e o platô de **+3 m** de chão nesse disco (rampa de 6 m na borda), que só existe no solo (`elevation`): o LiDAR o vê nos retornos de solo, e o MDS (solo mais as copas de 30–50 m) o esconde, porque a dispersão da copa no disco tem desvio padrão acima de 6 m contra os 3 m do platô. No raster do MDT, sem LiDAR o disco inteiro sai hachurado (sem dados de solo sob o dossel de 0,95: > 95 %); com a densidade de solo do LiDAR, nada.
  - **Contrato** `R04` em `rifts.ts` (ícone `Triangle` registrado) conforme a ficha: Lino, `EM_INTERFERENCE` + `MAGIC_FOG` + `DENSE_CANOPY` + `FEATURE_TARGETS`, só `MAGIC_FOG`, 4 requisitos (sensor LiDAR e templo capturado críticos; densidade de solo ≥ 10 pts/m² importante; densidade LiDAR ≥ 120 pts/m² menor), R$ 80.000, 1.400 XP, +5, souvenir `SV_TRIANGLE`, museu das fendas slot 3 a R$ 160/min, desbloqueio pelo C03, marcador `d` (FOOT_BIKE). Plano de referência (T2 com o pod LiDAR como sensor primário, H 80, q 50, 10 m/s, névoa; **a ficha não traz o p, então 70 %, o mesmo do C03**, que só afeta as fotos da câmera do pod): faixa de 112,03 m, 9 linhas, 682,8 s e 428 pts/m² (o solo, de 54 pts/m², é o do dossel de 0,95), GSD de 2,13 cm na câmera do pod, 1 bateria, sem pontos de apoio. Missão sintética: **APROVADA** (solo de ~70 pts/m² no relatório).
  - **Aceites.** *Névoa invalida o RGB*: o mesmo bosque com a câmera de 45 MP sai todo na névoa (`inFog`), a cobertura vai a 0 e a missão reprova pelos dois críticos (sem LiDAR, sem templo) e pelo solo; a névoa não mexe no LiDAR. *Templo revelado no MDT*: o autopilot voa as 9 linhas do plano de referência com o pod, sem colisão (16 m acima da copa mais alta: sem TF, a altitude é a cota média mais 80 m), com 33 % de bateria, sem disparar a câmera (o LiDAR é o sensor primário) e captura o `TEMPLE` (≥ 50 pulsos/m² na célula do centro); sem os dados do LiDAR o templo não é capturado e a missão reprova. Testes em `riftFairyForest.test.ts` (13) e `rifts.test.ts` (9 da R04; o voo completo leva ~7 s).
  - E2E: a R04 em `tests/e2e/contracts.spec.ts` (~2 min): autopilot do T2 com o pod sobre a floresta na névoa, 0 colisões, relatório **APROVADO** (sem classe PEC), souvenir "Fragmento do Triângulo Geodésico" e envio ao museu. Revisão visual no satélite (a mata azul-esverdeada, as clareiras niveladas e as trilhas) e no voo (a névoa violeta, as copas, os troncos, os vaga-lumes e o HUD do LiDAR). Voo a 52–58 FPS no Chromium sem GPU (1.600 árvores por quadro; a otimização global fica para a T077/T078).
- **Notas de implementação — T070 (R10):**
  - **Bioma** `world/terrain/biomes/riftIronTrench.ts` (AOI de 900 m em `u` × 120 m em `v`, seed 9010): um plano metálico a 0 m cortado de ponta a ponta pela **trincheira** do `NARROW_TRENCH` (50 m de largura e 40 m de fundo, de v = 35 a v = 85, `trenchElevation` do gerador da regra: paredes verticais, 40 m de queda entre dois pontos a 0,2 m um do outro), alívio de 40 m e cota média de −16,2 m. Cobertura: **painéis cinza em grade** (`METAL` claro com emendas escuras de 1 m, `ROCK`, a cada 15 m em `u` e em `v`) e uma faixa escura de 1 m junto de cada parede, em cima e embaixo; NDVI de 0,03 e nada de dossel.
  - **Torres, luzes e escotilha.** 12 `TOWER` de 6 × 6 × 20 m, seis de cada lado a ~6 m da borda (v = 29 e v = 91, u = 80, 230, …, 830); cada torre ganha uma **luz de navegação que pisca**, vermelha ao sul e verde ao norte: um `ENERGY_BEAM` de 1,2 × 3 m no topo (`baseM` = 20), **não sólido**, acesa 0,6 s e apagada 0,6 s com as 12 fases defasadas (o feixe de energia já liga e desliga por `activePeriod` e o render já o desenha com um núcleo claro). A **escotilha de exaustão** é um disco de 2 m (`PIPE` não sólido, vermelho) no fundo da trincheira, em (860, 60), e o alvo `EXHAUST_PORT` (r = 2 m, `needs: 'LIDAR'`) fica ali (≥ 50 pulsos/m² na célula do centro). Uma **trilha de manutenção** de 3 m pela borda sul deixa toda a AOI a ≤ 150 m de uma via: sem ela o campo todo ficava `OUT_OF_REACH` na tela de pontos de apoio (o plano de referência não usa GCP, mas o jogador pode querer).
  - **Contrato** `R10` em `rifts.ts` (ícone `Orbit` registrado) conforme a ficha: Lorde Válter, `EM_INTERFERENCE` + `NARROW_TRENCH` + `FEATURE_TARGETS`, só `SUN_HIGH`, sem vento, 3 requisitos todos críticos (sensor LiDAR, densidade ≥ 100 pts/m² e escotilha capturada), R$ 150.000, 2.000 XP, +5, souvenir `SV_EXHAUST_PORT`, museu das fendas slot 9 a R$ 200/min, marcador `j` (FOOT_BIKE), **desbloqueio `ALL[CONTRACT_DONE(C03), RIFTS_DONE(5)]`** (a condição `ALL`/`RIFTS_DONE` já existia na progressão: o C03 feito e cinco fendas concluídas; com quatro, ou sem o C03, segue bloqueada, e ao abrir sai o aviso de anomalia). Plano de referência (T2 com o pod LiDAR como primário, H 60, q 50, 8 m/s, sol; **a ficha não traz o p, então 70 %, o do C03**): faixa de 84,02 m, 4 linhas, 524,8 s e 714 pts/m² (sem dossel, o solo também: 714), GSD de 1,6 cm na câmera do pod, 1 bateria. Com este contrato as 11 fendas ocupam os slots 0 a 10 do museu. Missão sintética: **APROVADA**.
  - **Aceites.** *Densidade > 100 pts/m²*: a densidade vai com 1/(H·v): o T2 no teto de 120 m e a 18 m/s ainda faz ~159 pts/m², então o plano do T2 não reprova o requisito; o relatório reprova se a varredura vier rala (1/10 dos pulsos: 71 pts/m², mas ainda ≥ 50 pulsos/m² na escotilha) e reprova também a escotilha com 1/20 (36 pts/m²); a câmera RGB reprova os três críticos. *Escotilha de 2 m capturada*: o autopilot voa as 4 linhas sem colisão e captura o `EXHAUST_PORT`; sem TF o T2 voa a ~44 m (a cota média mais 60 m), **24 m acima das torres de 20 m**, e no fundo da trincheira o AGL passa dos 80 m (a densidade cai ali, e o requisito de 100 pts/m² vigia isso). Testes em `riftIronTrench.test.ts` (10) e `rifts.test.ts` (7 da R10, com um voo completo de ~3 s).
  - E2E: a R10 em `tests/e2e/contracts.spec.ts` (~1,5 min): autopilot do T2 com o pod sobre a trincheira, 0 colisões, relatório **APROVADO** (sem classe PEC), souvenir "Escotilha de Exaustão (miniatura)" e envio ao museu. Revisão visual no satélite (o plano em grade, a trincheira, as torres) e no voo (o plano claro, a trincheira e as paredes escuras, as torres com as luzes e o laser do LiDAR). Voo a 60 FPS no Chromium sem GPU.
- **Status:** T060 ✅ · T061 ✅ · T062 ✅ · T063 ✅ · T064 ✅ · T065 ✅ · T066 ✅ · T067 ✅ · T068 ✅ · T069 ✅ · T070 ✅

### T071 — Campanha integrada: desbloqueios, replay, final e balanceamento
- **Fase:** F7 · **Depende de:** T070 · **REQs:** REQ-CNT-003, REQ-CNT-005, REQ-CNT-008, REQ-CNT-002
- **Spec:** [progression §11, §12](features/progression.md), [contracts-real §3, §4](content/contracts-real.md), [catalog §13](content/catalog.md)
- **Arquivos:** \+ `src/domain/campaignSim.test.ts`, `src/screens/office/FinaleSequence.tsx`
- **Aceite:**
  - [x] A simulação de campanha ([catalog §13](content/catalog.md)) passa: ordem de desbloqueio correta e compras viáveis.
  - [x] Replay a 40 %, sem souvenir.
  - [x] O final é exibido uma vez e desbloqueia o chapéu.
  - [x] Desbloqueios de cosméticos por coleção (6 e 11 fendas, C03).
- **Verificação:** `npx vitest run src/domain/campaignSim`
- **Notas de implementação:**
  - **Simulação** (`domain/campaignSim.test.ts`, 11 testes): roda pela **store de verdade**, comprando com `buyItem` e aplicando relatórios aprovados com score fixo de 0,8 (qualityFactor 0,92, sem renda passiva, equipe nem contraproposta) pelo `applyMissionResult`, que já dispara o `refreshUnlocks`, o museu, os souvenirs e a descoberta das fendas. Segue o roteiro de catalog §13 (C00, C01, R01, R02, C05, C06, R07, R08, R11, C02, R09, C04, R03, R05, C03) e, depois dele, as três fendas que sobram (R04, R06 e R10) para fechar as 11.
  - **Resultado.** Cada contrato está disponível na hora de aceitá-lo (os reais na ordem C00 → C01 → C05 → C06 → C02 → C04 → C03, com as reputações mínimas de contracts-real §4: C06 ≥ 40, C02 ≥ 50, C04 ≥ 55, C03 ≥ 65 cumpridas) e **nada falta de dinheiro**: os itens do plano de referência de cada um (aeronave, câmera ou pod, lente e veículo) são comprados antes. O ponto mais apertado é o C01 (R$ 7.300 menos o T1 de R$ 6.000: sobram R$ 1.300) e, depois, o C06 (R$ 79.500 menos o combo T2 de R$ 70.000 e a lente de 24 mm de R$ 6.000: sobram R$ 3.500). Os saldos batem com a tabela manual de catalog §13 até o C05; **do C06 em diante estão R$ 6.000 abaixo**, porque a tabela só conta o combo T2 e o combo traz a LENS_35 (catalog §3), enquanto o C06 e as fendas de T2 (R07, R11, R03, R05) usam a de 24 mm: a lente é uma compra à parte. Sem falta de saldo, não há o que ajustar com ADR (OQ-012).
  - **Fendas e cosméticos.** A R10 só abre com o C03 e cinco fendas: com cinco fendas (a R11, no roteiro) e sem o C03 segue bloqueada. As coleções liberam, por `canBuy`: `CHAR_MULTIVERSE` na 6ª fenda (a R09 no roteiro; na 5ª ainda não), `PAINT_CAMO` (R$ 1.200), `ATLAS_LAUREL` e `CHAR_GRANDPA_HAT` com o C03 (que fecha os 7 reais) e `PAINT_HOLO` só com a 11ª (a R10, a última).
  - **Replay (REQ-CNT-005).** Pelo `applyMissionResult`: o replay do C00 paga R$ 920 contra os R$ 2.300 da primeira vez (40 %), dá 40 % do XP, não repete o souvenir nem conta setor novo, e o contrato segue concluído (2 conclusões); uma falha crítica no replay tira no máximo 3 de reputação e não rouba o contrato; fora do replay a falha tira 10 e o contrato é roubado.
  - **Final (REQ-CNT-008).** `finaleDue` (`domain/progression.ts`: a introdução vista, o final ainda não visto e os 7 contratos reais concluídos; as 11 fendas não contam), `completeFinale` na store (marca `finaleSeen`, entrega o `CHAR_GRANDPA_HAT` sem equipá-lo, toca o `LEVEL_UP` e mostra o toast "Museu da Terra inaugurado!"; só vale uma vez) e `screens/office/FinaleSequence.tsx`: o `DialogueBox` com os 4 cartões (a caderneta, a **carta canônica** de contracts-real §3, a inauguração do Grande Museu da Terra e o chapéu). O `OfficeScreen` avalia o `finaleDue` **uma vez, ao montar**: concluir o último contrato com a sede aberta não o dispara na hora, ele vem na próxima entrada (e o foco do teclado só vai à Porta depois dele). Testes: `finaleDue` (2), `completeFinale` (3), `OfficeScreen` (4) e o E2E `finale.spec.ts`, que parte de um save gerado pelo próprio jogo com os 7 contratos reais trocados por concluídos, num contexto novo, e confere a carta, o toast, o chapéu no save e que o final não volta.
  - **Marco M3 — Conteúdo completo:** os 7 contratos reais, as 11 fendas e a campanha integrada estão no ar.
- **Status:** ✅

> **Marco M3 — Conteúdo completo.**

---

# F8 — Mesa completa e Laboratório

### T072 — Mesa Holográfica completa
- **Fase:** F8 · **Depende de:** T071 · **REQs:** REQ-HOL-004, REQ-HOL-005, REQ-HOL-006, REQ-HOL-007
- **Spec:** [holo-table](features/holo-table.md) (completo)
- **Arquivos:** ~ `src/engines/holo/{sceneBuilder,HoloEngine,HoloPreview}.ts`, `src/engines/soft3d/{Renderer,OrbitCamera}.ts`, `src/screens/holo/{HoloTableScreen,SectorCard}.tsx`, `src/domain/museum.ts`, `src/input/bindings.ts`, `src/data/strings.ts`, `src/app/{debugFixtures.ts,DebugPanel.tsx}`; \+ `src/engines/holo/qualityGovernor.ts`, `src/screens/holo/{HoloControls,WingsPanel}.tsx`
- **Aceite:**
  - [x] Os critérios 2, 3 e 4 de [holo-table §8](features/holo-table.md).
  - [x] Miniaturas por aeronave.
  - [x] Painel de alas com destaque.
  - [x] Queda automática de qualidade.
  - [x] ≥ 55 FPS com os 18 setores mapeados (`?unlockAll=1` + debug "mapear tudo").
- **Verificação:** `npx vitest run src/engines/holo src/screens/holo` · E2E `holo.spec.ts`.
- **Notas de implementação:**
  - **Cena** (`sceneBuilder.ts`): `buildHoloScene(sectors, progress, quality, terrainFor, contracts?, view?)`, com `view = { dimension, mode, featured }` (o preview do escritório segue chamando com 4 argumentos: Real em ORTHO). O terreno é amostrado **uma vez por contrato e resolução** (`sampleGrid`: elevação normalizada, cor da cobertura e prédios) e a geometria sai **uma vez por modo** em cima dela, então trocar de modo não reamostra nada. `invalidateHoloSector(contractId)` descarta os dois caches de um contrato (o replay melhor reconstrói o setor, §7); como o terreno é determinístico por contrato, a geometria em si não muda, o que muda é o `museum`/`bestMissionLines` que a tela relê da store.
  - **Modos** (§5.3). *ORTHO*: como antes. *HYPSO*: rampa hipsométrica (`hypsoColor`: verde, amarelo, ocre, marrom e neve) sobre o hillshade do rasterizador, **curvas de nível** a cada 1/10 do relevo por *marching squares* (`contourLines`, com a regra da sela pelo centro da célula) e prédios brancos translúcidos (alfa 0,6). *NEON*: sem preenchimento; **pontos** ciano do heightmap com *jitter* (seed `hashString('holo:' + id)`, sem mexer nas bordas), **TIN** (grade triangulada a cada n/16 amostras, ciano a 40 % com glow) e prédios só em arestas emerald (12 por prédio); a mesa vira preto puro, some a grade de chão, os setores em gesso viram só wireframe e o oceano fica nas ondas. As ondas do oceano (`oceanWaves`) correm em todos os modos.
  - **Multiverso** (§5.2). `ringCenter(slot)`: 11 dioramas a 3,5 do centro, igualmente espaçados (o slot 0 ao fundo, no sentido horário), numa mesa de raio 4,4 com a borda violeta. Os dioramas **flutuam** a `FLOAT_Y` (0,14) e a engine soma `0,05·sin(t + slot)` por `yOffset`; cada um tem a borda luminosa violeta, e o em névoa é um **cubo em wireframe violeta girando** (`wireCube`, gerado por quadro). Os 11 `slot` das fendas (0–10) cobrem o anel, sem repetição (teste). Com R01 mapeada: 1 esculpido e 10 cubos.
  - **Malha dos dioramas: desvio.** O anel usa **uma resolução abaixo** da grade Real (`RING_RES` 24/16/12 contra 32/24/16 de `HEIGHTMAP_RES`): as 11 ilhas ocupam uma fração da tela e 11 × 32² quads estouravam o orçamento de 10 ms por quadro (ver as medições abaixo). A queda automática segue cortando um nível por vez.
  - **Destaque** (§5.5). O setor destacado ganha **pedestal** e **cone de luz** (`spotMesh`, alfa 0,13): na Real o setor sobe `PEDESTAL_Y` sobre uma caixa; no anel a ilha já flutua, então o pedestal é a laje sob ela. O destaque é por ala (`setFeatured(wing, id)` troca o anterior daquela ala).
  - **Domínio.** `wingIncomePerMin(sectors, featured, wing, wingOf, visitorsMod)` (`domain/museum.ts`, 4 testes): a renda de uma ala, com o ×2 só no destacado da própria ala; a soma das alas fecha com o `museumIncomePerMin`. Destacar um setor soma **exatamente a renda dele** à ala (critério 3).
  - **Renderer** (`soft3d/Renderer.ts`). `yScale`/`yBase`/`yOffset` em malhas, linhas e pontos (oscilação, pedestal e esculpir também no NEON). Três ganhos de custo, medidos no navegador (Chromium sem GPU, 1280 × 720, 18 setores, HIGH): (1) a ordenação passou de `sort` com comparador (callback por comparação) para uma **chave empacotada** (profundidade em 1/4096 · 2²⁰ + índice) num `Float64Array.sort()` nativo; (2) quads opacos seguidos da mesma cor viram **um só caminho** (um `fill`; translúcidos continuam um a um, senão a sobreposição não somaria); (3) o `stroke` por quad (que escondia as costuras) saiu: o quad é **inflado em 0,45 px** a partir do centro. O (3) foi o que pesou: a fase de desenho do anel foi de 25,7 ms para 8,1 ms. A cena do anel foi de ~37 para ~58 FPS.
  - **Engine** (`HoloEngine.ts`). Render por modo (fundo `#000` no NEON, sem grade), `bob`, cubos, pedestal/cone, miniaturas **por aeronave** (`getAircraft(id).kind`: pombo, multirrotor ou asa VTOL, nas duas dimensões; teste por aeronave), `moveSelection(dir)` (navegação espacial pelos centros projetados, com o `pickNeighbor` do foco de UI), `focus(slot)` (seleciona e voa), troca de dimensão (`setRadius` na `OrbitCamera`, voo de 0,8 s ao centro e `overviewDistance`: 1,8 raios na Real e 2,2 no anel, para o anel caber).
  - **Queda de qualidade** (`qualityGovernor.ts`). FPS médio < 50 por 3 s derruba **a qualidade da mesa** (não a global) um nível, com toast "Qualidade da mesa reduzida para Média (FPS baixo)"; a janela recomeça a cada queda e a cada troca de cena (o *rebuild* não conta como quadro lento); quadros > 1 s (aba em segundo plano) não entram. **O governor mede no `render`**, com o relógio real entre desenhos: o `GameLoop` divide cada quadro em sub-passos de `update` de até 1/60 s, e medindo ali um quadro de 40 ms apareceria como três de 13 ms (FPS fantasma de 75).
  - **Tela** (`HoloTableScreen`, `HoloControls`, `WingsPanel`, `SectorCard`). Barra superior com a chave **Terra Real | Multiverso** (a aba fica desabilitada com "Nenhuma anomalia registrada" sem fendas descobertas ou mapeadas) e **1 Ortofoto · 2 Hipsometria · 3 LiDAR Neon**; a chegada de uma fenda ("Enviar ao Museu") abre direto no Multiverso, com o diorama focado e esculpido. **Painel de alas** (`W`/`UI_TAB_NEXT`, botão "Alas"): uma seção por ala com a renda dela, os setores (classe · nota, renda, ★ de destaque, nome que foca o setor — e troca de dimensão se for de outra ala), os em névoa como "░ <título> — não mapeado" e o rodapé "Visitantes: X/h" com o total acumulado. Uma fenda **não descoberta** aparece como "Anomalia desconhecida" (no painel e no cartão), sem entregar o nome. O cartão do setor passou a usar a ala dele (destaque por ala) e mostra a renda com o ×2 e o modificador de visitantes.
  - **Entrada** (bindings `HOLO`). `W`/`RB` painel; `1`/`2`/`3` modo e `FIRE` (Espaço/X) cicla; `Tab`/`Y` dimensão; D-pad e analógico esquerdo movem a seleção entre setores (com o painel aberto, navegam pelos botões dele); `Enter`/`A` destaca o setor selecionado (com um botão focado o Enter já o ativa, nativo, então não destaca em dobro); `Esc`/`B` voltam sempre ao escritório. As setas seguem orbitando. A navegação do painel só chega ao teclado pelo mouse e pelo gamepad (o `Tab` é a troca de dimensão): fica para a auditoria de teclado/gamepad da T078.
  - **Depuração.** F9 → **"Mapear tudo (museu)"** (`mapAllSectors`): um setor para cada um dos 18 contratos, com as linhas do plano de referência e a aeronave dele; só o museu muda (status e bloqueios dos contratos ficam como estão, então não dispara o final). A tela expõe `data-dimension`, `data-mode`, `data-sectors`, `data-mapped` e `data-quality` para os testes.
  - **Medição (REQ-NFR-001, parcial).** 18 setores mapeados, 1280 × 720, Chromium headless **sem GPU**, média de 3 s por combinação: REAL ORTHO 56,4 · HYPSO 52,8 · NEON 55,5 FPS; anel (RIFT) ORTHO 56,7 · HYPSO 57,8 · NEON 60,3 FPS, todos em HIGH (sem queda automática). Antes da otimização: 35–46 FPS em ORTHO/HYPSO. A tabela completa e o ADR de performance ficam na T077. O E2E só exige > 25 FPS em cada combinação (o CI é mais lento e variável) e anota os valores no relatório.
  - **Testes.** `sceneBuilder` (modos, curvas, pontos e TIN, anel, destaque, caches, `RING_RES`), `HoloEngine.modes` (render por modo, anel, oscilação, troca de dimensão, pedestal, miniatura por aeronave, seleção espacial, governor), `qualityGovernor`, `soft3d` (ordenação por chave empacotada, runs, sem stroke, `yOffset`, `setRadius`), `domain/museum` (renda por ala), `HoloTableScreen` (modos, dimensão, painel de alas, destaque ×2, visitantes, spoiler, queda de qualidade com toast) e `debugFixtures` (mapear tudo). E2E `holo.spec.ts`: modos (fundo preto e pontos ciano no NEON), Tab ↔ Multiverso com a R01 (1 esculpido + 10 em violeta), aba desabilitada, painel de alas e 18 setores nas duas dimensões e nos três modos.
- **Status:** ✅

### T073 — Laboratório: Óptica & GSD e Estereoscopia
- **Fase:** F8 · **Depende de:** T072 · **REQs:** REQ-LAB-001, REQ-LAB-002, REQ-LAB-005 (*parc.*)
- **Spec:** [infographic-lab §3–§5.2](features/infographic-lab.md)
- **Arquivos:** \+ `src/screens/lab/{InfographicLabScreen,OpticsPanel,StereoPanel}.tsx`, `src/engines/lab/{opticsRenderer,stereoRenderer}.ts`
- **Arquivos (efetivos):** \+ `src/screens/lab/{InfographicLabScreen,OpticsPanel,StereoPanel,LabParts}.tsx`, `src/screens/lab/{readings,labels,equipment,LabSimulation}.ts`, `src/engines/lab/{opticsRenderer,stereoRenderer,draw,tween}.ts`, `tests/e2e/lab.spec.ts`; ~ `src/domain/{photogrammetry,stereo}.ts`, `src/app/ScreenRouter.tsx`, `src/data/strings.ts`
- **Aceite:**
  - [x] Os critérios 1 e 2 de [infographic-lab §8](features/infographic-lab.md).
  - [x] "Usar valores do meu equipamento".
  - [x] Teste de *spy* confirmando o uso de `@/domain`.
  - [x] `INFOGRAPHIC_LAB` deixa de usar o shell.
- **Verificação:** `npx vitest run src/screens/lab src/engines/lab`
- **Notas de implementação:**
  - **Tela** (`InfographicLabScreen`): abas (Q/E e LB/RB também trocam), o diagrama animado à esquerda e, à direita, a coluna do painel: sliders (UI kit), leituras, **fórmulas ao vivo** em `font-mono` com os valores substituídos e o "Você sabia?". O payload `panel` abre direto um painel (desconhecido cai no primeiro); `Esc`/`B`/"Voltar" → `OFFICE` (T15), sem pausar. Os valores dos sliders ficam no estado da tela (cada painel guarda os seus ao trocar de aba) e **não** são salvos. Nesta tarefa só há as duas primeiras abas; as de dossel e shutter entram na T074 (a lista `LAB_PANELS` cresce, sem *placeholder*). `INFOGRAPHIC_LAB` está no `ScreenRouter` e deixou o shell.
  - **Domínio, sem fórmula no componente** (REQ-LAB-005): `readings.ts` monta as entradas e chama `gsd`, `footprint`, `horizontalFovRad`, `pixelPitchM`, `realFocalM` (`domain/photogrammetry`) e `photoBaseM`, `parallaxDiffM`, `heightFromParallax`, `baseHeightRatio`, `depthPrecisionM` (`domain/stereo`). Duas funções novas, com testes primeiro: `pecMaxScaleDenominator(gsd)` (a regra prática 1:(GSD·4000), exibida como **heurística**, com a nota) e `baseHeightClass(B/H)` (< 0,3 fraca, 0,3–0,6 boa, > 0,6 forte, mas com oclusões). A câmera do painel de óptica é um `CameraSensor` montado dos sliders (proporção 3:2, focal fixa) para passar pelas mesmas funções do jogo. O teste de *spy* (`domainUse.test.tsx`) confere duas coisas: as funções do domínio recebem as entradas dos sliders (`gsd(100, 4,38 µm, 0,035)`, `parallaxDiffM(30, 0,035, 100, 20)`…) e, **trocando o retorno delas** por um valor sentinela, a tela passa a mostrar esse valor (7,77 cm/px, 123,00 mm…), o que prova que nenhuma fórmula foi reescrita.
  - **Golden values**: G2 (H 100 m, f 35 mm, pixel 4,38 µm → **1,25 cm/px**, W_g 102,9 m, escala ≈ 1:50) e G14/G15 (B 30, H 100, h 20, f 35 mm → **b 10,50 mm, Δp 2,625 mm, h 20,00 m, σ_Z 2,09 cm**, B/H 0,30 "boa") são os valores de abertura de cada painel e estão nos testes de leituras, de tela (RTL) e no E2E. O h reconstruído bate com o slider (± 0,1 %) em toda a faixa (teste em grade). O σ_Z usa o pixel da câmera de 45 MP (4,3823 µm), já que o painel não tem slider de pixel.
  - **Óptica** (`opticsRenderer`): sensor com a grade de pixels e um em âmbar, lente a `f` em escala exagerada, **cone de raios no ângulo real** (`horizontalFovRad`/2) até o solo na **régua logarítmica de H** (20 a 300 m, com marcas), segmento W_g, pixel projetado em âmbar, **lupa** de 50 cm de chão (até 40 × 40 células do tamanho do GSD, com a textura de ladrilhos de 6 cm, juntas de 8 mm e uma faixa pintada, e cada pixel como a média de 3 × 3 amostras: o detalhe menor que o GSD some) e 7 pontos de luz do solo ao sensor. **Estereoscopia** (`stereoRenderer`): C1 e C2, prédio (cresce com h), raios ao topo (âmbar, cheio) e à base (ciano, tracejado) com pulsos, e os planos-imagem ampliados (foto 1, **sobreposição** com ○ foto 1 e ● foto 2 e foto 2) com as cotas b e Δp; a escala dos planos encolhe se o ponto mais afastado não couber (B/H alto). Os renderers só desenham: números e rótulos chegam prontos (`labels.ts`).
  - **Animação de 150 ms** (`tween.ts`): `approach` é exponencial (95 % em 150 ms, independente de como o tempo é fatiado em quadros); o `LabSimulation` interpola todos os campos numéricos dos sliders, e o diagrama desenha as leituras do domínio dos valores já interpolados, enquanto a coluna lateral mostra os alvos. Na abertura os valores desenhados já são os dos sliders (sem animar).
  - **"Usar valores do meu equipamento"** (`equipment.ts`): a melhor câmera RGB possuída (a de maior resolução; a de lente intercambiável usa a de maior focal que o jogador tem, ou a primeira do catálogo sem nenhuma) e a de maior teto entre as aeronaves; H = min(100 m, teto da aeronave). Na estereoscopia, B é a **base aérea de 70 % de sobreposição** do pegada da câmera (`footprint` e `airBase` do domínio). Mostra "Equipamento: <câmera> em <aeronave>". Os presets de câmera saem do catálogo (uma entrada por câmera; as intercambiáveis, uma por lente) e cabem nas faixas dos sliders (teste).
  - **Testes.** `readings`, `labels`, `equipment`, `LabSimulation`, `opticsRenderer`, `stereoRenderer`, `tween`, os dois do domínio (`baseHeightClass`, `pecMaxScaleDenominator`), `InfographicLabScreen` (14 RTL: golden values, sliders, presets, equipamento, abas, Q/E, Esc, h ≤ 0,8·H) e `domainUse` (5, o *spy*). E2E `lab.spec.ts` (3): hotspot do escritório → sliders nas duas abas → Esc; equipamento; diagramas desenhados (âmbar e ciano no canvas) e animados. Os testes de `app.test.tsx` e o `navigation.spec.ts` deixaram de tratar o laboratório como shell (o painel F9 fica aberto sobre ele).
- **Status:** ✅

### T074 — Laboratório: Dossel e Shutter
- **Fase:** F8 · **Depende de:** T073 · **REQs:** REQ-LAB-003, REQ-LAB-004, REQ-LAB-005
- **Spec:** [infographic-lab §5.3, §5.4](features/infographic-lab.md)
- **Aceite:**
  - [x] Os critérios 3 e 4 de [infographic-lab §8](features/infographic-lab.md).
  - [x] `sampleRollingShutter` é puro e testado.
  - [x] E2E `lab.spec.ts`.
- **Verificação:** `npx vitest run src/screens/lab src/engines/lab && npx playwright test tests/e2e/lab.spec.ts`
- **Arquivos (efetivos):** \+ `src/screens/lab/{CanopyPanel,ShutterPanel}.tsx`, `src/engines/lab/{canopyRenderer,shutterRenderer,rollingShutter}.ts`; ~ `src/screens/lab/{InfographicLabScreen,LabSimulation,readings,labels,equipment}`, `src/domain/{lidar,photogrammetry}.ts`, `src/data/strings.ts`, `tests/e2e/lab.spec.ts`
- **Notas de implementação:**
  - **As quatro abas** (`LAB_PANELS`: óptica, estereoscopia, dossel e shutter), com Q/E e LB/RB em volta; o `LabSimulation` e o "Usar valores do meu equipamento" passaram a cobrir os quatro painéis, e cada um guarda os próprios sliders.
  - **Dossel** (`CanopyPanel`, `canopyRenderer`): sliders de cobertura (0–98 %), nº máximo de retornos (1–5), PRR (50–500 kHz), H (40–300 m) e v (5–25 m/s), com o FOV fixo em 70° (o do Pod). As leituras vêm só do domínio (`canopyReadings`): P_solo (`groundReturnProbability`), densidade de pontos (`lidarDensity`), densidade de solo (`groundDensity`), faixa (`lidarSwathM`), solo visível em fotos (`photoGroundVisibility`) e o **veredito do MDT**, que ganhou a função `isDtmReliable` no domínio (`MIN_GROUND_DENSITY` = 4 pts/m², testes primeiro): "MDT confiável" ou "MDT insuficiente" (vermelho, sem erro com 98 % e 1 retorno). **G16**: 97 % e 5 retornos dão **P_solo = 10,76 %** (e só 0,09 % do solo aparece em duas fotos).
  - **Diagrama do dossel**, em perfil e em duas metades sobre a mesma floresta (sorteio determinístico das copas por coluna; subir a cobertura só acrescenta copas). *LiDAR*: o leque de 13 pulsos desce e deixa o 1º retorno (ciano), até 3 intermediários (violeta) e o último no solo (emerald) **só com a probabilidade de atravessar a copa fechada**, que sai do próprio domínio (`groundReturnProbability(1, n)`, 2 % por retorno extra); nos buracos o pulso chega ao solo. Embaixo, o MDS (ciano, pelos 1ºs retornos) e o MDT (emerald, só pelos retornos de solo). *Câmera RGB*: os raios param na copa; o MDS segue a copa e o "MDT fotogramétrico" é pontilhado e interpolado, só nos buracos vistos em duas fotos (fração (1 − c)²). O leque ocupa 46 % da largura de cada metade (o ângulo real de 70° seria mais largo que o quadro).
  - **Shutter** (`ShutterPanel`, `shutterRenderer`, `rollingShutter`): sliders de v (0–25 m/s), leitura (5–60 ms), giro (0–90 °/s) e GSD (0,5–5 cm) e o interruptor "Sensor global" (que desabilita o de leitura). O **modelo é puro** (`engines/lab/rollingShutter.ts`): `sampleRollingShutter(scene, t0, readout, v)` devolve, para cada linha de um sensor virtual de 240 × 160 cuja leitura inteira dura o `t_readout`, o instante, o deslocamento horizontal da cena (pelo `rollingShutterSkewPx` do domínio, então a última linha tem exatamente o skew da leitura; 0 com v = 0 ou sensor global) e a rotação acumulada (θ = −ω·Δt); `captureImage` aplica isso pixel a pixel (transformação inversa de "cena girada e deslocada") sobre a cena analítica (prédio com janelas, poste vertical, grade de quadrados). Com giro, o poste vira uma **curva** (a rotação em torno do centro desloca mais as linhas distantes), o efeito gelatina. O desenho mostra a cena à esquerda e a captura à direita, com a **varredura ciano** descendo em câmera lenta (20×, 0,6 s para 30 ms) e uma pausa de 1,4 s, e a coluna do poste na cena como referência tracejada âmbar; o sensor global captura tudo de uma vez.
  - **Leituras do shutter**: skew (`rollingShutterSkewPx`), **ângulo de cisalhamento** (função nova `rollingShutterShearRad` no domínio, atan(skew · GSD / altura da imagem no solo), com a imagem de 160 linhas), a altura dela no solo e a **penalidade de RMSE que o jogo aplicaria**, por `accuracyMultipliers` com φ = 0 ("sem RTK") e φ = 1 ("com RTK"), num contexto neutro em que só o rolling pesa (os tetos de 1,8 e 1,4 aparecem a 25 m/s e 60 ms). **G11**: v 8 m/s, leitura de 30 ms e GSD de 2,74 cm dão **skew de 8,76 px** (× 1,35 sem RTK e × 1,18 com RTK; ângulo de 3,13°) e o poste sai inclinado (teste: o centro dele anda o skew de uma ponta à outra, linearmente).
  - **Equipamento**: o dossel usa o PRR e os retornos do Pod, se possuído (senão, "sem Pod LiDAR (só a aeronave)"), e a altura e a velocidade de cruzeiro da aeronave; o shutter usa o obturador da melhor câmera (rolling: a leitura dela; global ou mecânico: o interruptor ligado), a velocidade de cruzeiro e o GSD que a câmera faz na altura de trabalho (a de 20 MP a 100 m dá 2,74 cm, a G6).
  - **Testes.** Domínio: `isDtmReliable` e `rollingShutterShearRad`. Unitários: `rollingShutter` (11: G11 pela última linha, instantes, linearidade, giro, buffers, "o poste sai inclinado" e curvo), `canopyRenderer` e `shutterRenderer` (ciclo em câmera lenta, rótulos, cores, extremos), `readings`/`labels`/`equipment`/`LabSimulation` com o dossel e o shutter. RTL: 27 testes da tela, com a G16 e a G11 pela interface. O *spy* (`domainUse`, 10 testes) cobre agora o dossel e o shutter: as funções de `@/domain/lidar`, `@/domain/photogrammetry` e `@/domain/accuracy` recebem as entradas dos sliders e, trocando o retorno delas, a tela mostra o valor trocado. E2E `lab.spec.ts` (4): o último abre as quatro abas, confere G16 e G11 pelos sliders e os pixels (ciano, violeta, emerald e âmbar) do diagrama do dossel e a varredura do shutter.
- **Status:** ✅

---

# F9 — Polimento e release

### T075 — Menu de pausa, configurações e novo jogo
- **Fase:** F9 · **Depende de:** T074 · **REQs:** REQ-CORE-003, REQ-CORE-009, REQ-AUD-003, REQ-NFR-007 (*parc.*)
- **Spec:** [architecture §2 (pausa)](design/architecture.md), [progression §13](features/progression.md), [ui-style §5](design/ui-style.md)
- **Aceite:**
  - [x] Pausa com Continuar, Configurações (volumes, mudo, qualidade, reduzir flashes, FPS), Controles (tabela de glyphs do dispositivo ativo), Salvar agora, Novo jogo (ConfirmDialog), Abandonar missão (no FIELD_SETUP e no voo) e Sair para o escritório (onde fizer sentido pela tabela de transições).
  - [x] Teste do REQ-CORE-003 (voo congelado por 5 s).
  - [x] E2E do novo jogo.
- **Verificação:** `npx vitest run src/app src/state && npx playwright test tests/e2e/pause.spec.ts`
- **Arquivos (efetivos):** ~ `src/app/PauseOverlay.tsx`, `src/data/strings.ts`; \+ `src/app/{SettingsPanel,ControlsPanel}.tsx`, `src/app/PauseOverlay.test.tsx`, `src/engines/flight/pause.test.ts`, `tests/e2e/pause.spec.ts`
- **Notas de implementação:**
  - **Menu** (`PauseOverlay`): a pausa segue sendo `session.paused` com o overlay por cima da tela (`Esc`/`M`/Menu). O menu monta ao pausar e desmonta ao retomar (a aba e as confirmações voltam ao começo). Itens: **Continuar**, **Configurações**, **Controles**, **Salvar agora** (`flushSave`: grava o que estiver pendente e avisa "Jogo salvo"; a falha já avisa por conta própria), **Novo jogo**, **Abandonar missão** (só no `FIELD_SETUP` e no `SURVEY_FLIGHT`) e **Sair para o escritório** (só onde a tabela de transições leva ao `OFFICE` com a guarda satisfeita: mapa, mesa e laboratório; nunca no planejamento nem no voo). As confirmações são `ConfirmDialog`s irmãos do menu (não filhos), para a camada de input da confirmação ficar acima da do menu: o `Esc` fecha só a confirmação.
  - **Esc e M.** Onde há para onde voltar, o `Esc` é "voltar" (`UI_BACK`) e não pausa (a mesa e o laboratório vão ao escritório; o planejamento abre a confirmação de cancelar), como no ADR-022; o `M` (e o Menu/Options do gamepad) pausa em qualquer tela. Dentro de Configurações ou Controles o `Esc` volta ao menu; no menu, retoma.
  - **Configurações** (`SettingsPanel`, REQ-AUD-003, REQ-NFR-007): volume geral e de efeitos (sliders de 0 a 100 %), mudo, qualidade gráfica (Baixa, Média, Alta), "Reduzir flashes e tremores" e "Mostrar FPS", estes como interruptores acessíveis (`role="switch"`, `aria-checked`). Mudam na hora (o `AudioDriver` já aplica os volumes ao nó master) e o autosave grava a chave `scan-city-settings` na hora, **à parte do save**, por isso sobrevivem ao reload e ao "Novo jogo". Com `?debug=1` o overlay de FPS fica sempre ligado; sem ele, só pela configuração.
  - **Controles** (`ControlsPanel`, REQ-INP-004): uma linha por ação (mover, olhar, zoom, subir e descer, interagir, disparar, sensor, RTH, dimensão, veículo, tempo, confirmar, voltar, abas e pausa) com o glyph do **dispositivo ativo** (`InputGlyph`), que troca em tempo real; mostra "Dispositivo ativo: Teclado, Xbox ou PlayStation".
  - **Novo jogo** (REQ-CORE-009): `ConfirmDialog` in-app ("Todo o progresso será perdido. Um backup será guardado."); ao confirmar, `newGame()` (que já existia) grava o save atual em `scan-city-save-backup`, volta ao estado inicial, força a máquina de telas ao `OFFICE` e a intro volta; as configurações ficam. Nenhum `window.confirm` (testes RTL e E2E conferem; o E2E reprova qualquer diálogo nativo).
  - **Abandonar** (T7 e T10): descarta a missão (`discardActive`) e vai ao mapa, com o desfecho `ABORTED` no voo; confirmação com os mesmos textos do cancelar do planejamento e do abandono do pós-voo.
  - **REQ-CORE-003** (`engines/flight/pause.test.ts`): o `FlightEngine` com autopilot, o `useGameLoop` real e um `requestAnimationFrame` falso; com a store pausada por 5 s simulados, a posição, a bateria, as fotos e a fase **não mudam**, e ao retomar o voo continua de onde parou; o laço segue desenhando (só a simulação congela). O resto da pausa já estava coberto: a renda passiva (`museumIncome`) e o autosave de 30 s ignoram o tempo pausado, e o E2E `flight.spec.ts` ("a pausa congela o voo") confere o HUD no navegador.
  - **Testes.** RTL (`PauseOverlay.test.tsx`, 16, pelo `<App/>`): itens do menu por tela, Continuar/Esc/M, foco inicial, "Sair para o escritório" no mapa, mesa e laboratório (e a ausência no planejamento e no voo), abandonar no planejamento e no voo (confirmar e cancelar, Esc só na confirmação), sliders e interruptores de configurações com a gravação à parte, Esc voltando ao menu, a tabela de controles, Salvar agora e o novo jogo (cancelar, confirmar com backup, intro e configurações mantidas). E2E `pause.spec.ts` (3): o menu e as configurações que sobrevivem ao reload (volume, mudo, qualidade, flashes, FPS), os controles e o salvar; o novo jogo sem diálogo nativo; e abandonar no planejamento e no voo e sair para o escritório.
  - **Fora do escopo desta tarefa:** o E2E de "reduzir flashes" sem o overlay branco do obturador (REQ-NFR-007, *parc.*) fica para a auditoria de acessibilidade da T078: o flash é um preenchimento de 80 ms em tempo de simulação (10 ms reais a ×8), difícil de amostrar sem fragilidade.
- **Status:** ✅

### T076 — *Game juice*: transições, partículas e sons de ambiente
- **Fase:** F9 · **Depende de:** T075 · **REQs:** REQ-UI-004, REQ-AUD-002
- **Spec:** [audio §4](design/audio.md), [survey-flight §5.5](features/survey-flight.md), [ui-style §5](design/ui-style.md)
- **Aceite:**
  - [x] Transições de tela com fade de 200 ms e "distorção" nas fendas.
  - [x] Loops `MOTOR`, `WIND` e `PROCESSING` integrados.
  - [x] `UI_HOVER` nos botões.
  - [x] Toasts com ícones por tipo.
  - [x] Tudo respeita `reduceFlashes` e o mudo.
- **Verificação:** `npm run verify && npm run e2e` · manual: jogar o C00 com som e com `reduceFlashes` ligado.
- **Arquivos (efetivos):** \+ `src/app/ScreenTransition.tsx`, `src/ui/hoverSound.ts`, `src/audio/flightAmbience.ts`, `src/app/ScreenTransition.test.tsx`, `src/ui/{hoverSound,Toast}.test.tsx`, `src/audio/flightAmbience.test.ts`, `tests/e2e/transitions.spec.ts`; ~ `src/App.tsx`, `src/index.css`, `src/ui/{Button,Tabs}.tsx`, `src/screens/flight/{SurveyFlightScreen.tsx,flightScreens.test.tsx}`
- **Notas de implementação:**
  - **Transições** (`ScreenTransition`, em volta do `ScreenRouter` no `GameLayout`). A cada troca de `screen.current` o contêiner da tela remonta (`key` = contador) com a animação CSS `screen-fade` (opacidade de 0 a 1, **200 ms**, `ease-out`); a abertura do jogo entra sem fade. O estado "mostrado" é derivado **durante a renderização** (padrão do React para estado derivado de props, sem efeito e sem ref, que o lint do React 19 proíbe). A **distorção** (`screen-rift`, também 200 ms: matiz girado, saturação, desfoque de 5 px, escala 1,03 e inclinação de 1,5°, que relaxam até a tela normal) vale quando a troca **entra ou sai de um contexto de fenda** (`inRiftContext`): o mapa na aba Fendas, ou o planejamento, o voo e o processamento de uma missão ou contrato com `dimension === 'RIFT'` (a missão é achada pelo `missionId` entre as ativas e as pendentes). Trocar de aba **dentro** do mapa não é transição. Com **"Reduzir flashes e tremores"** a distorção vira o fade simples, e com `prefers-reduced-motion: reduce` as duas animações ficam desligadas. A tela expõe `data-transition` (`NONE`, `FADE` ou `RIFT`) para os testes.
  - **Sons de ambiente** (`audio/flightAmbience.ts`, REQ-AUD-002). `FlightAmbience` nasce em cada surtida do `SurveyFlightScreen`: liga o `MOTOR` com a **variante da aeronave** (`BIRD` para o Atlas, `MULTIROTOR`, `FIXED_WING` para a asa VTOL; os três do audio §3) e o `WIND`; a cada snapshot do HUD (`update(speedMs, vento cruzado)`) leva a velocidade ao `rate` do motor e o |vento transversal| à intensidade do vento (`windIntensity`: 0 a 1, cheia a partir de 12 m/s, sem sinal); `setPaused` **cala os dois na pausa** e os devolve ao nível de antes ao retomar (a store `session.paused` é assinada); `stop` encerra com um fade de 0,3 s no fim da surtida e ao desmontar, e `start` de novo (StrictMode) religa. O `PROCESSING` (esteira do pós-voo) e o `LIDAR_HUM` (liga e desliga com o sensor) **já estavam ligados** desde as tarefas de cada tela: a tabela de [audio §4](design/audio.md) está completa, e cada um dos 13 efeitos tem pelo menos uma chamada fora do módulo de áudio (`SHUTTER`, `LIDAR_HUM`, `RTH_BEEP`, `PIGEON_COO`, `CASH_REGISTER`, `CRASH`, `UI_CLICK`, `UI_HOVER`, `DENIED`, `LEVEL_UP`, `COLLECT`, `RIFT_OPEN`, `STAGE_DONE`).
  - **`UI_HOVER`** (`ui/hoverSound.ts`). O `Button` e as abas (`Tabs`) tocam o hover ao **passar o mouse** (só ponteiro de mouse: o toque não "passa por cima") e ao **receber foco por navegação**: o do gamepad (`data-input-device="GAMEPAD"`) conta sempre, o do teclado só se for `:focus-visible` (clicar no botão não soa duas vezes). Há um intervalo mínimo de **70 ms** entre dois hovers (varrer uma grade de cartões não vira rajada) e botões desabilitados ou carregando, e abas desabilitadas, ficam mudos; os handlers `onPointerEnter` e `onFocus` do chamador seguem valendo. O clique continua tocando o `UI_CLICK`.
  - **Toasts com ícone por tipo** (REQ-UI-004). O `Toast` já trazia um ícone `lucide` por tipo desde a T004 (info, success, warn, error, money e rift, cada um com a sua cor de borda e `aria-hidden`; erros e avisos são `role="alert"`, o resto `role="status"`; um `icon` da própria mensagem tem prioridade). O que faltava era o **teste**, que agora trava o contrato: ícone distinto por tipo, decorativo, papel de leitor de tela e borda distinta.
  - **Partículas** (survey-flight §5.5) já existiam desde a T024c (`engines/flight/particles.ts`: neve, vaga-lumes, poeira da mina e faíscas, no máximo 300, sorteio seedado). Nada a acrescentar: o tremor de tela (0 px), as faíscas das criaturas elétricas e a piscada da invulnerabilidade (translúcida fixa) já ficam quietos com `reduceFlashes`, e o flash do obturador (80 ms) nem é desenhado com ele.
  - **Respeito ao mudo.** Mudo e volumes são o ganho do nó master (T009/T075), que o hover, os loops de voo e todos os efeitos atravessam; não há caminho de som fora do `AudioEngine`. E o `reduceFlashes` agora também alcança as transições.
  - **Testes.** `ScreenTransition.test.tsx` (9: `transitionKind` e a constante de 200 ms; `inRiftContext` no mapa, no planejamento, no voo e no processamento, achando o contrato pela missão ativa ou pendente; abertura sem fade; fade em cada troca; distorção ao entrar numa fenda e ao sair do mapa em Fendas; trocar de aba não é transição; `reduceFlashes` → só o fade), `hoverSound.test.tsx` (8: intervalo de 70 ms, mouse × toque, foco do gamepad e do teclado, `Button` e `Tabs`, desabilitados, handlers do chamador), `flightAmbience.test.ts` (7: variantes, intensidade do vento, motor e vento ligados com a velocidade, variantes por aeronave, pausa e retomada, começar pausado, `stop` e religar), `Toast.test.tsx` (4) e, em `flightScreens.test.tsx`, o som de ambiente no voo (BIRD e vento ao entrar, `rate` > 0 com o HUD, `stop` ao desmontar, pausa cala e retomar devolve). E2E `transitions.spec.ts` (2): trocar de tela entra com `screen-fade` de 0,2 s no navegador real, e sair da aba Fendas do mapa pelo menu de pausa ganha `screen-rift` (e com "Reduzir flashes", só `screen-fade`).
- **Status:** ✅

### T077 — Passe de performance
- **Fase:** F9 · **Depende de:** T076 · **REQs:** REQ-NFR-001, REQ-NFR-004
- **Spec:** [survey-flight §5.18](features/survey-flight.md), [holo-table §5.7](features/holo-table.md), [requirements NFR-001](requirements.md)
- **Passos:**
  1. Profiling com o painel F9 (tempos por etapa).
  2. Aplicar as otimizações obrigatórias.
  3. Validar as qualidades Baixa, Média e Alta.
  4. Documentar as medições em `specs/decisions.md` (ADR "Medições de performance"), por tela e qualidade.
- **Aceite:**
  - [x] Voo C01 e C03, mesa com 18 setores: ≥ 55 FPS em Alta no perfil de referência.
  - [x] Mapa ≥ 58 FPS.
  - [x] E2E em 1280 × 720 e 1920 × 1080 sem rolagem horizontal.
- **Verificação:** `npx playwright test tests/e2e/viewports.spec.ts` · manual: overlay de FPS nos cenários listados, com os números registrados na ADR.
- **Arquivos (efetivos):** \+ `src/engines/perf.ts`, `src/app/PerfSection.tsx`, `tests/e2e/viewports.spec.ts` e os testes `src/engines/perf.test.ts` e `src/app/PerfSection.test.tsx`; ~ `src/engines/flight/{terrainRenderer,FlightEngine}.ts` (+ testes), `src/engines/{holo/HoloEngine,overworld/OverworldEngine}.ts`, `src/world/terrain/{TerrainSampler,spatialHash}.ts`, `src/app/DebugPanel.tsx`, `tests/e2e/flight.spec.ts`, `specs/{decisions,open-questions}.md`
- **Notas de implementação:**
  - **Método e ambiente** (detalhes e tabelas no [ADR-024](decisions.md)). Chromium headless do Playwright **sem GPU** (o canvas é rasterizado por software, na thread principal, no *commit* do quadro: o pior caso perto do notebook de referência), 4 vCPU, 1280 × 720, DPR 1, vsync de 60 Hz. FPS é a média de 10 s de `requestAnimationFrame` depois de 10 s de aquecimento (voo com autopilot e `seed=3`; mesa com os 18 setores mapeados; mapa andando a pé), em Alta, Média e Baixa. A "capacidade" é a mediana de ms por quadro sem vsync, que mostra a folga que o teto de 60 Hz esconde. A medição num notebook com GPU ficou como a [OQ-013](open-questions.md).
  - **Contador de tempo por etapa e painel F9** (survey-flight §5.18). `StageTimer` (`engines/perf.ts`): cada instante pertence a **uma** etapa (`enter(i)` fecha a aberta e abre a `i`; `leave()` fecha sem abrir), então as etapas somam o tempo coberto; `endFrame()` leva o quadro a uma média móvel exponencial (peso 0,1). Desligado (o padrão) custa um `if` por chamada: o painel F9 liga os contadores ao abrir (`acquirePerf`, com contagem de quem olha) e desliga ao fechar. Etapas do **voo** (update, HUD, cena, grade do terreno, terreno, objetos, sobreposições, aeronave), da **mesa** (update, cena, renderer 3D, rótulos) e do **mapa** (update, chunks, camada animada, atmosfera); a `PerfSection` mostra, só da tela que está rodando, o total contra o orçamento (voo ≤ 12 ms, mesa ≤ 10 ms, mapa 17,2 ms) e uma barra por etapa. O contador mede o **JS**: a rasterização por software acontece depois, no *commit*, e aparece só como a diferença para o tempo do quadro.
  - **Diagnóstico** (painel F9, *trace* do Chromium e microbenchmarks com os quads reais capturados de um quadro da C03). A C03 gastava 13,2 ms por quadro sem vsync: 5,7 ms de JS (a grade do terreno era o maior item, 2,0 ms) e o resto, rasterização, dominada pelos quads (~5,5 ms por causa do `fill` mais `stroke` de cada um) e pelas copas (~1,4 ms). A mesa e o mapa já estavam na meta.
  - **Otimizações aplicadas** (survey-flight §5.18): (1) **sem `stroke` por quad**: cada quad avança `QUAD_OVERLAP_PX` = 1 px na borda de baixo e na da direita, que a faixa mais perto e a coluna seguinte (pintadas depois) cobrem, então a emenda some sem contorno (`extendQuad`); (2) **elevação uma vez por ponto da grade**: `TerrainScene.sampleGround` e `TerrainSampler.landCoverAt` (a cobertura reaproveita a elevação, que era avaliada duas vezes); (3) **objetos, sombras e alvos assentam na malha da grade** (`gridElevation`, interpolação bilinear), sem reavaliar o relevo por objeto, o que também deixa a base do objeto sobre a superfície que os quads desenham; (4) **hash espacial com chave numérica** (a de texto era montada milhares de vezes por quadro) e um hash só de prédios para o "é telhado?" que a grade pergunta a cada ponto; (5) **sem alocação por quadro** nos pontos quentes: buffers da grade reaproveitados (um jogo por qualidade), cor do quad sem vetores temporários e estilos prontos por degrau (12) para os pontos do LiDAR. Já atendidas desde antes: normais da mesma grade, cache de `fillStyle` por cor quantizada (64 níveis) e objetos e quads fora do frustum descartados antes da ordenação.
  - **Avaliadas e descartadas, com a medição** (todas no ADR-024): quads de mesma cor num caminho só (14,6 contra 5,2 ms), lote mais quads inflados como na mesa (igual ao traço), `Path2D` reutilizado nas copas (2,9 contra 2,7 ms do `arc`), `fillRect` no lugar do quad (muda a geometria) e limitar o tamanho dos runs na mesa (sem efeito além do ruído).
  - **Resultados** (média de 10 s, vsync de 60 Hz, Alta): voo C01 **60,0**, C03 **58,8** (era 52,4), R04 **59,9** (era 54,6); mesa com 18 setores **58,8 a 59,9** nas duas dimensões e nos três modos; mapa **60,0** (Real e Fendas). Média e Baixa ficam em 59,3 a 60,0. Capacidade sem vsync: C01 7,3 → 4,9 ms, C03 14,5 → 10,3 ms, R04 16,4 → 10,7 ms. JS no painel F9 (Alta): C03 3,8 ms, R04 3,6 ms, C01 1,6 ms e mesa de 5,0 a 7,4 ms, dentro dos orçamentos de 12 e 10 ms.
  - **Viewports** (REQ-NFR-004, `viewports.spec.ts`, 24 testes): em 1280 × 720 e 1920 × 1080, escritório, mapa, planejamento, voo, processamento, mesa (com o painel de alas aberto) e laboratório (as quatro abas), mais o menu de pausa com configurações e controles. Como a raiz do app é `overflow: hidden` (o `scrollWidth` da página não acusaria nada), o teste confere **elemento por elemento**: nenhum elemento visível passa da janela, nenhum contêiner corta conteúdo na horizontal (fora os com reticências) e a raiz tem o tamanho exato da janela. Com DPR 2, o buffer de cada canvas visível é o tamanho CSS vezes o DPR (mapa, planejamento, voo, mesa e laboratório); o minimapa de 160 × 100, que é arte de pixel de 1 px por tile (`image-rendering: pixelated`), fica de fora, porque o navegador já o amplia sem suavizar.
  - **Testes.** `perf` (8: relógio manual, exclusividade das etapas, visitas somadas, média móvel, ligar e desligar), `PerfSection` (3: só a tela com quadros novos aparece, tempos e orçamento na tela, total acima do orçamento em vermelho, contadores ligados só com o painel aberto), um teste por motor (voo, mesa e mapa: ligado, cada render fecha um quadro com as etapas), `terrainRenderer` (`extendQuad`, um `fill` por quad e nenhum `stroke` por quad, `sampleGround` sem chamar `elevation` nem `cover` e com o mesmo resultado, objetos e alvos sem reavaliar o relevo, `gridElevation` exato nos vértices e nos planos, borda fora da grade, erro baixo no relevo curvo, buffers reaproveitados) e `terrain` (`landCoverAt` igual a `landCover` em todos os biomas). E2E: `viewports.spec.ts` e, em `flight.spec.ts`, o painel F9 mostrando o tempo por etapa do voo dentro do orçamento.
- **Status:** ✅

### T078 — Auditoria de gamepad e acessibilidade
- **Fase:** F9 · **Depende de:** T077 · **REQs:** REQ-INP-006, REQ-NFR-007, REQ-NFR-009 (*parc.*: Firefox)
- **Passos:**
  1. Percorrer **todas** as telas, modais e painéis só com o gamepad (real ou emulado) e só com o teclado.
  2. Corrigir as lacunas de foco.
  3. Verificar o contraste.
  4. Smoke test no Firefox (manual) documentado.
- **Aceite:**
  - [x] Checklist de auditoria (abaixo) com 100 % dos itens automatizáveis OK; o smoke manual no Firefox está documentado, e a execução dele ficou na [OQ-014](open-questions.md).
  - [x] E2E `keyboard-only.spec.ts` cobrindo o slice inteiro sem mouse.
- **Verificação:** `npx playwright test tests/e2e/keyboard-only.spec.ts` · manual: checklist de auditoria.
- **Arquivos (efetivos):** \+ `tests/e2e/{keyboard-only,keyboard,focus-audit,gamepad,contrast}.spec.ts|ts`; ~ `src/input/{actions,bindings,glyphs,useFocusNavigation}.ts`, `src/ui/{Modal,Tabs,index}.ts(x)`, `src/screens/{common/TutorialHint,holo/HoloTableScreen,field/{FieldSetupScreen,SatelliteView},processing/{ProcessingResultsScreen,PointCloudView,Pipeline},office/*Panel,office/OfficeScreen,flight/{SurveyFlightScreen,FlightHud}}.tsx`, `src/engines/flight/{FlightEngine,hudPublisher}.ts`, `src/data/strings.ts`, `specs/{design/input,features/holo-table,decisions,open-questions}.md` e os testes de cada um
- **Notas de implementação:**
  - **Método** ([ADR-025](decisions.md)). Em vez de só percorrer as telas à mão, a auditoria virou **testes**: `focus-audit.spec.ts` varre, em 23 estados (as 7 telas, 6 painéis do escritório, o menu de pausa com configurações e controles, a confirmação de novo jogo, a intro, o briefing, o abandono do campo e do voo, o final da campanha, as quatro abas do campo e do laboratório, o painel de alas e as cinco abas do relatório), todo controle visível e confere **nome acessível, alcance por Tab (ou por grupo de abas) e anel de foco** com o teclado como última entrada; nos modais, também que o **foco entra, não escapa por Tab/Shift+Tab** e o Esc fecha devolvendo o foco. Um teste confere que a própria varredura acusa um botão sem nome, outro fora do Tab e outro sem anel. `gamepad.spec.ts` (6) emula um Xbox por `navigator.getGamepads` e `keyboard-only.spec.ts` (5) joga sem tocar em elemento nenhum (o foco só chega por `Tab`, setas e `Enter`).
  - **Lacunas achadas e corrigidas.** (1) **Mapa, mesa e voo**: o `Tab` e as setas são do jogo, então os botões do DOM dessas telas (a dica "Entendi", o painel de alas) eram inalcançáveis: nova ação `DISMISS_HINT` (`H`; `View` no controle) dispensa a dica do tutorial; e todo botão do DOM tem uma tecla equivalente (documentado em [input §2](design/input.md)). (2) **Painel de alas da mesa** não tinha caminho de teclado (as setas orbitavam, o `Tab` troca a dimensão): novo contexto `HOLO_PANEL`, em que as setas, o Enter e o Esc navegam pelo painel, o `Tab` fica livre, `W`/`RB` fecham e o analógico direito orbita; o foco entra no painel ao abrir. (3) **Abas**: as setas mudavam a seleção, mas o foco ficava na aba antiga (o `Tabs` agora leva o foco junto e aceita Home/End); o campo e o relatório não tinham **Q/E nem LB/RB** (o D-pad não alcança as abas inativas), e o relatório não tinha navegação por foco nenhuma (D-pad morto): passaram a ter. (4) **Painéis do escritório** (6) não recebiam o foco ao abrir: `useFocusNavigation({ autoFocus })` o leva para dentro e o devolve ao fechar, sem atropelar quem já focou outro controle. (5) **Final da campanha**: o foco ia para a Porta de trás do modal (o Enter a ativaria): a sala não rouba mais o foco enquanto o final está aberto, e o **`Modal` ganhou uma guarda** (só a do modal do topo): se o foco sai do modal, volta; empilhados, vale o de cima. (6) **Só mouse**: o mapa de satélite do campo (colocar, mover, apagar pontos) e a nuvem 3D do relatório. O mapa ganhou uma **mira no centro** com o foco: WASD move a vista debaixo dela, `+` e `−` dão zoom (também pelos gatilhos), Enter ou Espaço coloca o ponto da ferramenta (G, C ou X) ou, com a Borracha, remove o que estiver sob a mira (mover um ponto é apagar e pôr de novo); a nuvem recebe o foco e as setas orbitam. (7) Separadores `·` e textos de apoio em `text-slate-500` (3,9 : 1) subiram para `slate-400`; os ícones de estado inativo (estrela, coração vazio, cadeado) ficam em `slate-500`, que passa de 3 : 1.
  - **Reduzir flashes** (REQ-NFR-007, E2E de aceite). O HUD publica `flashes` (quantos flashes do obturador foram mostrados) e a tela do voo o expõe em `data-flashes`: com a opção desligada o autopilot passa de 6 flashes em 6 fotos; com ela ligada, as fotos saem e `data-flashes` fica em `0` (`flight.spec.ts`; no motor, dois testes com `reduceFlashes` verdadeiro e falso). Também respeitam a opção, já desde antes: tremor de tela, faíscas das criaturas elétricas, piscada da invulnerabilidade e, agora, as transições de fenda (T076).
  - **Contraste AA** (`contrast.spec.ts`, 13 testes). A varredura percorre o DOM de cada tela, calcula a cor do texto e a do fundo efetivo (fundos translúcidos se compõem até um opaco; as cores `oklch` do Tailwind v4 são convertidas por um canvas) e exige 4,5 : 1 (3 : 1 para texto grande). Cobre as 6 telas, o menu de pausa, os 6 painéis do escritório, a garagem, a carreira e as relíquias aba por aba, o campo e o laboratório aba por aba, o painel de alas com setores mapeados e em névoa, o briefing, a dica do tutorial, a esteira e as 5 abas do relatório. Isenções, pela WCAG: texto em canvas (os tokens são conferidos à parte em `tokens.test.ts`: todos os de texto passam de 4,5 : 1 sobre os dois fundos), controles desabilitados e marcas (os emblemas, `role="img"`). Achados: os separadores `·` do HUD do voo (4,2 : 1) e a nota da regra prática do laboratório (3,9 : 1), mais os mesmos tons em outros 6 lugares.
  - **Navegadores** (REQ-NFR-009). O E2E roda no Chromium. O **Firefox não está disponível neste ambiente** (o `playwright install firefox` é bloqueado pela rede), então o smoke manual ficou **documentado e não executado**: abrir `npm run build && npm run preview`, no Firefox atual percorrer o roteiro do `keyboard-only.spec.ts` (escritório → mapa → campo → voo → processamento → museu), conferir o som (um clique libera o áudio), o controle (a Gamepad API existe no Firefox, mas o mapeamento `standard` depende do sistema) e o foco visível. Nenhuma API só do Chromium é usada (varredura do código; o `roundRect` do canvas existe no Firefox desde a 112). Por isso o REQ-NFR-009 continua ☐ na matriz até alguém rodar o roteiro ([OQ-014](open-questions.md)).
  - **Fora do escopo desta tarefa.** O `Tab` continua sendo `TOGGLE_DIMENSION` e `TOGGLE_SENSOR` no mapa, na mesa e no voo (a spec); a seleção de setor da mesa fica com o painel de alas (teclado) e o analógico (controle); o RTH do voo é um aviso do HUD confirmado por `R`/`B`, não um modal (não pede foco).
  - **Testes.** Unitários: `bindings` (`DISMISS_HINT`, sem tecla repetida em dois botões do mesmo contexto, `HOLO_PANEL`), `TutorialHint` (H, pausa), `HoloTableScreen` (painel de alas só com o teclado: 4), `useFocusNavigation` (`autoFocus`: 4), `Modal` (guarda de foco, empilhados), `OfficeScreen` (foco do final), `Tabs` (foco junto com a seleção, Home/End), campo (Q/E, LB/RB, mira: 5), relatório (abas e D-pad), nuvem 3D (setas), `FlightEngine` (`flashes`), `tokens` (contraste). E2E: `keyboard-only` (5: o slice inteiro, a mesa, o campo com a mira, a nuvem e o voo manual), `focus-audit` (24 testes: os 23 estados e a conferência da própria varredura), `gamepad` (6), `contrast` (13) e 2 em `flight.spec.ts`.
  - **Checklist de auditoria.** ✅ = coberto por teste que passa; todos os itens abaixo estão ✅, exceto o último.

| Superfície | Só teclado | Só controle | Foco visível | Esc / B | Teste |
| :--- | :---: | :---: | :---: | :---: | :--- |
| Escritório (9 hotspots) | ✅ Tab, setas, Enter | ✅ D-pad, A | ✅ | pausa (M) | `office`, `focus-audit`, `gamepad` |
| Painéis do escritório (6) | ✅ foco entra ao abrir | ✅ D-pad, A | ✅ | ✅ devolve o foco | `focus-audit` |
| Mapa-múndi | ✅ setas, Enter, `Tab`, `V`, `H` | ✅ analógico, A, Y, LB, View | n/a (cada botão tem tecla) | ✅ pausa | `keyboard-only`, `gamepad`, `focus-audit` |
| Briefing | ✅ Tab preso | ✅ D-pad, A | ✅ | ✅ | `focus-audit`, `gamepad` |
| Pausa, configurações, controles | ✅ | ✅ Menu, D-pad, A, B | ✅ | ✅ | `focus-audit`, `gamepad` |
| Confirmações (novo jogo, abandonar campo e voo) | ✅ foco preso | ✅ D-pad, B | ✅ | ✅ devolve o foco | `focus-audit`, `gamepad` |
| Intro e final da campanha | ✅ foco preso | — (sem escolha) | ✅ | não dispensáveis | `focus-audit` |
| Planejamento de campo (4 abas) | ✅ Tab, Q/E, mira no mapa | ✅ LB/RB, D-pad, B | ✅ | ✅ volta uma aba | `keyboard-only`, `focus-audit`, `gamepad` |
| Voo | ✅ Espaço, WASD, Q/E, `Tab`, R, T | ✅ botões do controle | n/a (HUD sem controles) | ✅ pausa | `keyboard-only` (manual), `flight` |
| Pós-voo | ✅ foco entra, Tab, Enter | ✅ D-pad, A | ✅ | — | `keyboard-only` |
| Processamento e relatório (5 abas) | ✅ Tab, Q/E, setas | ✅ LB/RB, D-pad | ✅ | — | `keyboard-only`, `focus-audit` |
| Nuvem 3D do relatório | ✅ foco + setas orbitam, `+` `−` | ✅ analógico dir., gatilhos | ✅ | — | `keyboard-only`, `ProductViewer` |
| Mesa holográfica | ✅ `W`, `1 2 3`, `Tab`, painel por setas | ✅ RB, D-pad, A, analógicos | ✅ | ✅ Esc volta ao escritório | `keyboard-only`, `gamepad`, `focus-audit` |
| Painel de alas | ✅ foco entra, setas, Enter | ✅ D-pad, A, RB fecha | ✅ | ✅ | `keyboard-only`, `gamepad`, `focus-audit` |
| Laboratório (4 abas, sliders) | ✅ Tab, Q/E, setas | ✅ LB/RB, D-pad | ✅ | ✅ | `lab`, `focus-audit` |
| Dica do tutorial | ✅ `H` | ✅ `View` | ✅ | — | `keyboard-only`, `gamepad`, `TutorialHint` |
| Contraste AA dos textos do DOM | — | — | — | — | `contrast` (13), `tokens` |
| Reduzir flashes e tremores | — | — | — | — | `flight` (flash), `FlightEngine` |
| Firefox atual (smoke manual) | roteiro escrito | roteiro escrito | — | — | **pendente**: [OQ-014](open-questions.md) |
- **Status:** ✅

### T079 — Regressão final e release
- **Fase:** F9 · **Depende de:** T078 · **REQs:** REQ-NFR-005, REQ-NFR-006, REQ-CNT-006, REQ-NFR-002, REQ-NFR-003
- **Passos:**
  1. Garantir que o `DebugScreenShell` só existe atrás de `?debug=1` e que nenhuma tela o usa.
  2. Rodar `verify`, `e2e`, `check:assets`, `check:terms`, `check:placeholders` e `test:coverage`.
  3. Atualizar a matriz de rastreabilidade (abaixo) com o status final.
  4. Jogar a campanha (manual, com debug de dinheiro permitido) para uma verificação de sanidade.
- **Aceite:**
  - [x] Todos os scripts verdes.
  - [x] Cobertura atendida.
  - [x] Todos os REQs com status ✅ na matriz, exceto o REQ-NFR-009 (Firefox), que espera a verificação humana da [OQ-014](open-questions.md).
- **Verificação:** `npm run verify && npm run e2e && npm run check:assets && npm run test:coverage`
- **Arquivos (efetivos):** \+ `README.md`; − `src/app/{DebugScreenShell,DebugCanvasDemo}.tsx`; ~ `src/app/{ScreenRouter,DebugOverlay,debugFixtures}.ts(x)`, `src/app/{app,FpsOverlay}.test.tsx`, `src/audio/AudioEngine.test.ts`, `src/engines/raster/products.test.ts`, `eslint.config.js`, `scripts/check-placeholders.mjs`, `tests/e2e/{slice,navigation}.spec.ts` e as specs (`constitution`, `requirements`, `design/architecture`, `decisions`, `tasks`).
- **Notas de implementação:**
  - **O shell saiu do repositório, e não só de trás do `?debug=1`** ([ADR-026](decisions.md)). O passo 1 pedia o shell atrás do parâmetro; como as sete telas já eram reais, o arquivo e a cena de demonstração do Canvas (`DebugCanvasDemo`) foram apagados. O `ScreenRouter` exporta `SCREEN_COMPONENTS: Record<ScreenId, ComponentType>`, que é total pelo tipo: um `ScreenId` novo sem tela não compila. `app.test.tsx` ganhou o teste que compara as chaves com `SCREEN_IDS` e confere que nenhuma tela renderiza um `debug-screen-shell`; as asserções equivalentes saíram de `slice.spec.ts` e `navigation.spec.ts`. O `?debug=1` segue abrindo o painel `F9` e as galerias `UIKIT` e `SOUNDBOARD`, que são ferramentas. O texto da constituição (§4.3), do REQ-CORE-007 e da arquitetura foi atualizado junto.
  - **Zero placeholders, por duas redes** (REQ-NFR-005). `check:placeholders` barra em `src/` `TODO`/`FIXME`/`XXX`, o nome `DebugScreenShell` e função de corpo vazio escrita numa linha (`() => {}`, `function f() {}`), fora dos testes; o ESLint (`@typescript-eslint/no-empty-function`, erro) pega o resto: funções em várias linhas e métodos. Provado com arquivos de teste, depois apagados: o script acusou as 4 linhas (2 funções vazias, o shell, um `TODO`) e o ESLint 4 erros, entre eles uma seta em duas linhas e um método vazio que o script não vê. O código já estava limpo, exceto por um `cancelScheduledValues(){}` no mock de áudio, que agora conta as chamadas (`AudioEngine.test.ts` confere a contagem).
  - **Cobertura** (`npm run test:coverage`, 172 arquivos e 1985 testes, limites: global ≥ 60 %, `src/domain` e `src/lib` ≥ 90 % de linhas). Total: **96,30 %** dos comandos, **91,50 %** dos ramos, **96,16 %** das funções e **96,78 %** das linhas. `src/domain`: 99,06 / 95,93 / 99,16 / **99,56 %**; `src/lib`: 100 %. A única mudança de teste por causa da cobertura foi o teto de 8 ms (em vez de 4) do "nenhuma tarefa passa de metade da fatia" quando `NODE_V8_COVERAGE` existe: o v8 instrumentado levou uma tarefa a 4,36 ms. O orçamento do jogo não mudou (ADR-026).
  - **Build e assets** (REQ-NFR-002, REQ-NFR-006). `npm run verify` (`typecheck`, `lint` com zero avisos, os 1985 testes, `build`, `check:placeholders`, `check:terms`) verde; `check:assets` lista 3 arquivos em `dist/` (`index.html`, um `.js` de 884 kB, 287 kB com gzip, e um `.css` de 44 kB) e nenhum asset externo. O Vite avisa que o `.js` passa de 500 kB: o jogo é um chunk só, que carrega uma vez e não busca nada na rede; não há requisito de tamanho de bundle, e dividir o código não mudaria nenhum REQ.
  - **E2E** (`CI=1 npx playwright test`, Chromium, 2 *workers*): **132 de 132** testes em 15,8 min, todos os arquivos, incluindo os de acessibilidade da T078.
  - **Sanidade da campanha** (passo 4). Sem sessão humana aqui, a campanha é jogada pelos testes, que usam as mesmas telas e botões do jogador e só pegam atalhos de depuração para chegar ao ponto de partida (`screen=`, `contract=`, `autopilot=`, o teleporte do mapa). `slice.spec` joga o **C00** do escritório ao museu (mapa, briefing, campo, voo com o autopilot a ×8, recarga da página com a missão na fila, Workstation, relatório aprovado, mesa) e `keyboard-only.spec` repete o percurso sem tocar no mouse; `contracts.spec` abre o voo de cada um dos **17 outros contratos** (C01 a C06 e R01 a R11) e segue pelo caminho real: sem colisão, mapa, sede, Workstation, relatório **APROVADO** (com a classe PEC-PCD onde há), pagamento, souvenir e setor na mesa, com o saldo da barra superior alterado; `finale.spec` parte de um save de jogo novo com os 7 contratos reais concluídos e confere o final (uma vez, a carta do avô em 4 cartões, o toast e o chapéu); `gamepad.spec` joga painéis, abas e o briefing só com o controle; `campaignSim.test.ts` simula a campanha toda: ordem de desbloqueio dos contratos e das fendas, reputações mínimas, compras viáveis e saldos contra a tabela do catálogo (§13).
  - **O que um humano ainda precisa fazer:** ouvir os sons (`audio.spec.ts` toca os 14 efeitos e os 4 loops (nas 3 aeronaves) na Web Audio real e confere que não há erro, mas não "escuta" nada), abrir o jogo no Firefox ([OQ-014](open-questions.md), roteiro escrito na T078) e medir o FPS com GPU ([OQ-013](open-questions.md)). Nada disso muda o código.
  - **Matriz final** (abaixo): 131 requisitos, **130 ✅** e o REQ-NFR-009 ☐. Viraram ✅ nesta tarefa o REQ-NFR-002, o 003, o 005 e o 006 (as linhas que citavam a T079) e o **REQ-UI-002**, que ficou ☐ desde a T004 porque o `InputGlyph` só foi ligado na T008: a galeria `?debug=1&screen=UIKIT` mostra os 17 componentes do kit (os 12 do requisito e mais 5) e o `UiKitGallery.test.tsx` os renderiza.
  - **`README.md`** na raiz: o que é o jogo, como rodar, roteiro, controles, scripts, depuração, estrutura e o mapa da especificação.
- **Status:** ✅

> **Marco M4 — Release.**

---

## Matriz de rastreabilidade (REQ → spec → tarefas)

> Gerada a partir das referências cruzadas. Ao concluir uma tarefa, o agente marca a coluna **Status** do REQ como ✅ quando **todas** as tarefas listadas estiverem concluídas.

| REQ | Título | Spec de detalhe | Tarefas | Status |
| :--- | :--- | :--- | :--- | :-: |
| REQ-CORE-001 | Máquina de estados de telas | [architecture](design/architecture.md) | T005 | ✅ |
| REQ-CORE-002 | Transição inválida | [architecture](design/architecture.md) | T005 | ✅ |
| REQ-CORE-003 | Pausa | [architecture](design/architecture.md), [survey-flight](features/survey-flight.md) | T005, T007, T075 | ✅ |
| REQ-CORE-004 | Persistência e autosave | [architecture](design/architecture.md), [data-model](design/data-model.md) | T006, T027 | ✅ |
| REQ-CORE-005 | Migração e corrupção de save | [architecture](design/architecture.md), [data-model](design/data-model.md) | T006 | ✅ |
| REQ-CORE-006 | Determinismo | [architecture](design/architecture.md), [terrain](design/terrain.md) | T002, T017 | ✅ |
| REQ-CORE-007 | Flags de depuração | [architecture](design/architecture.md) | T005 | ✅ |
| REQ-CORE-008 | Game loop e Canvas | [architecture](design/architecture.md), [survey-flight](features/survey-flight.md) | T007 | ✅ |
| REQ-CORE-009 | Novo jogo | [architecture](design/architecture.md), [progression](features/progression.md) | T006, T075 | ✅ |
| REQ-INP-001 | Teclado e mouse | [input](design/input.md), [world-map](features/world-map.md) | T008 | ✅ |
| REQ-INP-002 | Detecção de gamepad | [input](design/input.md) | T008 | ✅ |
| REQ-INP-003 | Mapeamento padrão | [input](design/input.md), [world-map](features/world-map.md) | T008 | ✅ |
| REQ-INP-004 | Glyphs dinâmicos | [input](design/input.md) | T008 | ✅ |
| REQ-INP-005 | Deadzone e borda | [input](design/input.md) | T008 | ✅ |
| REQ-INP-006 | Navegação de UI por gamepad | [input](design/input.md), [field-setup](features/field-setup.md), [infographic-lab](features/infographic-lab.md), [office](features/office.md) | T008, T078 | ✅ |
| REQ-AUD-001 | Inicialização preguiçosa | [audio](design/audio.md) | T009 | ✅ |
| REQ-AUD-002 | Catálogo de efeitos | [audio](design/audio.md), [processing-results](features/processing-results.md), [survey-flight](features/survey-flight.md) | T009, T076 | ✅ |
| REQ-AUD-003 | Volume e mudo | [audio](design/audio.md) | T009, T075 | ✅ |
| REQ-UI-001 | Paleta dark geodésica | [ui-style](design/ui-style.md) | T004 | ✅ |
| REQ-UI-002 | Kit de componentes | [ui-style](design/ui-style.md) | T004 | ✅ |
| REQ-UI-003 | Barra superior | [ui-style](design/ui-style.md), [office](features/office.md) | T020 | ✅ |
| REQ-UI-004 | Toasts | [ui-style](design/ui-style.md), [progression](features/progression.md) | T004, T005, T076 | ✅ |
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
| REQ-WLD-004 | Seletor de dimensão | [contracts-rifts](content/contracts-rifts.md), [input](design/input.md), [world-map](features/world-map.md) | T059 | ✅ |
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
| REQ-HOL-004 | Miniaturas animadas | [holo-table](features/holo-table.md) | T072 | ✅ |
| REQ-HOL-005 | Chave dimensional | [holo-table](features/holo-table.md) | T059, T072 | ✅ |
| REQ-HOL-006 | Modos de exibição | [holo-table](features/holo-table.md) | T072 | ✅ |
| REQ-HOL-007 | Gestão das alas | [holo-table](features/holo-table.md) | T072 | ✅ |
| REQ-HOL-008 | Seleção de setor | [holo-table](features/holo-table.md) | T026 | ✅ |
| REQ-LAB-001 | Óptica e GSD | [infographic-lab](features/infographic-lab.md) | T073 | ✅ |
| REQ-LAB-002 | Estereoscopia e paralaxe | [infographic-lab](features/infographic-lab.md) | T012, T073 | ✅ |
| REQ-LAB-003 | LiDAR vs. fotogrametria no dossel | [infographic-lab](features/infographic-lab.md) | T012, T074 | ✅ |
| REQ-LAB-004 | Global vs. rolling shutter | [infographic-lab](features/infographic-lab.md) | T074 | ✅ |
| REQ-LAB-005 | Reuso do domínio | [domain-math](design/domain-math.md), [infographic-lab](features/infographic-lab.md) | T011, T073, T074 | ✅ |
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
| REQ-CNT-001 | Contratos reais | [contracts-real](content/contracts-real.md), [data-model](design/data-model.md) | T022, T053, T054, T055, T056, T057, T058 | ✅ |
| REQ-CNT-002 | Fendas | [contracts-rifts](content/contracts-rifts.md), [data-model](design/data-model.md) | T059, T060–T070, T071 | ✅ |
| REQ-CNT-003 | Progressão e desbloqueio | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [progression](features/progression.md) | T019, T071 | ✅ |
| REQ-CNT-004 | Regras especiais | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [data-model](design/data-model.md), [terrain](design/terrain.md) | T052, T053, T054, T055, T056, T057, T058, T060–T070 | ✅ |
| REQ-CNT-005 | Repetição | [contracts-real](content/contracts-real.md), [processing-results](features/processing-results.md), [progression](features/progression.md) | T019, T071 | ✅ |
| REQ-CNT-006 | Guarda de paródias | [contracts-rifts](content/contracts-rifts.md), [architecture](design/architecture.md) | T059, T060–T070, T079 | ✅ |
| REQ-CNT-007 | Diálogos | [contracts-real](content/contracts-real.md), [contracts-rifts](content/contracts-rifts.md), [processing-results](features/processing-results.md) | T022, T027 | ✅ |
| REQ-CNT-008 | Final da campanha | [catalog](content/catalog.md), [contracts-real](content/contracts-real.md), [office](features/office.md), [progression](features/progression.md) | T071 | ✅ |
| REQ-NFR-001 | Performance | [holo-table](features/holo-table.md), [survey-flight](features/survey-flight.md) | T007, T077 | ✅ |
| REQ-NFR-002 | Qualidade de build | [architecture](design/architecture.md) | T001, T079 | ✅ |
| REQ-NFR-003 | Cobertura de testes | [architecture](design/architecture.md) | T001, T079 | ✅ |
| REQ-NFR-004 | Resolução e responsividade | [ui-style](design/ui-style.md) | T004, T077 | ✅ |
| REQ-NFR-005 | Zero placeholders | [architecture](design/architecture.md) | T079 | ✅ |
| REQ-NFR-006 | Sem assets externos | [architecture](design/architecture.md) | T001, T079 | ✅ |
| REQ-NFR-007 | Acessibilidade | [ui-style](design/ui-style.md), [survey-flight](features/survey-flight.md) | T004, T075, T078 | ✅ |
| REQ-NFR-008 | Localização pt-BR | [ui-style](design/ui-style.md) | T002 | ✅ |
| REQ-NFR-009 | Navegadores | [architecture](design/architecture.md) | T001, T078 | ☐ |

# Design — Arquitetura

> Estrutura do código, máquina de estados, store, game loop, contrato dos engines, persistência e ferramentas de depuração.
>
> **Requisitos cobertos:** REQ-CORE-001 a REQ-CORE-009, REQ-NFR-002, REQ-NFR-003, REQ-NFR-005, REQ-NFR-006, REQ-NFR-009 (navegadores-alvo: Chrome, Edge e Firefox atuais; Playwright em Chromium).

---

## 1. Estrutura de pastas

```
scan_city/
├── index.html
├── package.json
├── vite.config.ts            # react(), tailwindcss(), alias @ → src
├── vitest.config.ts          # jsdom, coverage thresholds (domain/lib ≥ 90%, global ≥ 60%)
├── playwright.config.ts      # webServer: npm run preview, baseURL http://localhost:4173
├── tsconfig.json             # strict, noUncheckedIndexedAccess, paths @/*
├── eslint.config.js
├── .prettierrc
├── scripts/
│   ├── check-placeholders.mjs   # TODO/FIXME/XXX, funções vazias e DebugScreenShell em src/ (REQ-NFR-005)
│   ├── check-assets.mjs         # REQ-NFR-006
│   └── check-forbidden-terms.mjs# REQ-CNT-006
├── tests/e2e/                   # specs Playwright (*.spec.ts)
└── src/
    ├── main.tsx                 # monta <App/>, importa index.css
    ├── index.css                # @import "tailwindcss"; @theme tokens
    ├── App.tsx                  # providers + <ScreenRouter/> + <PauseOverlay/> + <ToastHost/>
    ├── app/
    │   ├── ScreenRouter.tsx     # SCREEN_COMPONENTS: Record<ScreenId, ComponentType> (total: toda tela tem componente)
    │   ├── PauseOverlay.tsx
    │   ├── FpsOverlay.tsx
    │   ├── TopBar.tsx
    │   └── debugFlags.ts        # parse de query string
    ├── state/
    │   ├── store.ts             # create<GameStore>()(persist(...)) combinando slices
    │   ├── machine.ts           # SCREEN_TRANSITIONS, canTransition, goTo
    │   ├── persistence.ts       # serialize/deserialize/validate SaveGame
    │   ├── migrations.ts        # MIGRATIONS: Record<number, (s) => s>
    │   ├── initialState.ts      # createNewGame()
    │   ├── selectors.ts         # seletores memoizados (owned items, modifiers, unlocked contracts)
    │   └── slices/
    │       ├── sessionSlice.ts  # screen, payload, paused, toasts
    │       ├── playerSlice.ts   # money, xp, level, skillPoints, reputation
    │       ├── inventorySlice.ts
    │       ├── contractsSlice.ts
    │       ├── missionSlice.ts  # missão ativa + fila pendente
    │       ├── museumSlice.ts
    │       ├── worldSlice.ts    # avatar, dimensionTab, rifts descobertas
    │       ├── rivalSlice.ts
    │       └── settingsSlice.ts
    ├── domain/                  # TS puro — ver domain-math.md
    │   ├── photogrammetry.ts
    │   ├── lidar.ts
    │   ├── flightPlanner.ts
    │   ├── coverage.ts
    │   ├── accuracy.ts
    │   ├── standards.ts         # PEC-PCD, ASPRS
    │   ├── geometry.ts          # convex hull, covariance, collinearity, polygon raster
    │   ├── volumetrics.ts
    │   ├── energy.ts            # dreno de bateria/milho, RTH threshold
    │   ├── flightPhysics.ts     # stepAircraft, crab, wind/thermals (puro, sem render)
    │   ├── requirements.ts      # predictRequirements, evaluateRequirements
    │   ├── mission.ts           # evaluateMission → QualityReport
    │   ├── economy.ts           # computePayment, prices with discount, staff
    │   ├── progression.ts       # xpForLevel, addXp, unlock evaluation
    │   ├── modifiers.ts         # applyModifiers(skills, cosmetics?) → ModifierSet
    │   ├── museum.ts            # museumIncome, visitors, offline income
    │   ├── rival.ts             # rollCounterOffer, stealContract
    │   └── fieldEvents.ts       # rollFieldEvent
    ├── world/
    │   ├── terrain/
    │   │   ├── noise.ts         # value noise 2D, fbm, ridged
    │   │   ├── TerrainSampler.ts# interface + factory createTerrain(contract)
    │   │   ├── objects.ts       # tipos de WorldObject e placement helpers
    │   │   └── biomes/          # um arquivo por BiomeId (rural_tutorial.ts, urban_vertical.ts, ...)
    │   └── overworld/
    │       ├── tiles.ts         # TileType, legenda ASCII, passabilidade
    │       └── pathfinding.ts   # BFS para testes de alcance
    ├── engines/
    │   ├── loop.ts              # GameLoop (rAF, clamp, substeps, pause)
    │   ├── canvas.ts            # setupCanvas(dpr), resize
    │   ├── overworld/           # OverworldEngine, renderer, avatar, camera
    │   ├── flight/              # FlightEngine, projection, terrainRenderer, objectRenderer,
    │   │                        # sensors (camera, lidar), hud snapshot, autopilot, effects
    │   ├── field/               # SatelliteRenderer, minigames (bubble, imu)
    │   ├── soft3d/              # mat4/vec3, OrbitCamera, mesh/points/quads, painter sort, picking
    │   ├── holo/                # HoloEngine (cena da mesa), sceneBuilder
    │   ├── raster/              # geradores de Orto/MDS/MDT/NDVI/heatmap (ImageData)
    │   ├── office/              # OfficeRenderer (sala), hotspots
    │   └── lab/                 # renderers dos 4 infográficos
    ├── input/
    │   ├── actions.ts           # enum Action, AxisAction
    │   ├── InputManager.ts      # singleton; poll(); keyboard/mouse/gamepad
    │   ├── gamepad.ts           # detectFamily, standard mapping
    │   ├── bindings.ts          # tabela de bindings
    │   ├── InputGlyph.tsx
    │   └── useFocusNavigation.ts# navegação espacial de UI
    ├── audio/
    │   ├── AudioEngine.ts
    │   └── sfx.ts               # receitas de síntese
    ├── data/
    │   ├── strings.ts
    │   ├── catalog/             # sensors.ts, lenses.ts, aircraft.ts, payloads.ts, vehicles.ts,
    │   │                        # fieldEquipment.ts, hardware.ts, staff.ts
    │   ├── skills.ts
    │   ├── cosmetics.ts
    │   ├── souvenirs.ts
    │   ├── contracts/real.ts
    │   ├── contracts/rifts.ts
    │   ├── specialRules.ts
    │   ├── fieldEvents.ts
    │   ├── dialogs.ts           # intro, final, rival
    │   └── overworld/map.ts     # 100 strings × 160 chars
    ├── screens/
    │   ├── office/OfficeScreen.tsx (+ painéis)
    │   ├── world/WorldMapScreen.tsx (+ BriefingModal)
    │   ├── field/FieldSetupScreen.tsx (+ steps)
    │   ├── flight/SurveyFlightScreen.tsx (+ Hud, PostFlightDialog)
    │   ├── processing/ProcessingResultsScreen.tsx (+ Pipeline, Report, ProductViewer)
    │   ├── holo/HoloTableScreen.tsx
    │   └── lab/InfographicLabScreen.tsx
    ├── ui/                      # kit de componentes (ui-style.md) + tokens.ts
    └── lib/
        ├── rng.ts               # mulberry32, hashString, normal(), pick(), shuffle()
        ├── math.ts              # clamp, lerp, smoothstep, remap, vec2/vec3 helpers, deg/rad
        └── format.ts            # pt-BR numbers, BRL, units
```

### 1.1 Scripts npm (exigidos)

| Script | Comando |
| :--- | :--- |
| `dev` | `vite` |
| `build` | `tsc -b && vite build` |
| `preview` | `vite preview` |
| `typecheck` | `tsc -b --noEmit` |
| `lint` | `eslint . --max-warnings 0` |
| `format` | `prettier --write .` |
| `test` | `vitest run` |
| `test:watch` | `vitest` |
| `test:coverage` | `vitest run --coverage` |
| `e2e` | `playwright test` |
| `check:placeholders` | `node scripts/check-placeholders.mjs` |
| `check:assets` | `node scripts/check-assets.mjs` (roda após o build) |
| `check:terms` | `node scripts/check-forbidden-terms.mjs` |
| `verify` | `npm run typecheck && npm run lint && npm run test && npm run build && npm run check:placeholders && npm run check:terms` |

---

## 2. Máquina de estados de telas

```ts
export type ScreenId =
  | 'OFFICE' | 'WORLD_MAP' | 'FIELD_SETUP' | 'SURVEY_FLIGHT'
  | 'PROCESSING_RESULTS' | 'HOLO_TABLE_VIEW' | 'INFOGRAPHIC_LAB';
```

**Estado inicial:** `OFFICE`. Com `?debug=1&screen=X`, a tela X abre com um payload de teste (ver §7).

### 2.1 Tabela de transições

| # | De | Para | Gatilho | Guarda (`guard(state, payload)`) | Payload |
| :-: | :--- | :--- | :--- | :--- | :--- |
| T1 | OFFICE | WORLD_MAP | Hotspot Porta | — | — |
| T2 | OFFICE | HOLO_TABLE_VIEW | Hotspot Mesa Holográfica | — | `{ focusSectorId? }` |
| T3 | OFFICE | INFOGRAPHIC_LAB | Hotspot Laboratório | — | `{ panel? }` |
| T4 | OFFICE | PROCESSING_RESULTS | Workstation → "Processar" | `pendingMissions` contém `missionId` | `{ missionId, inField: false }` |
| T5 | WORLD_MAP | OFFICE | INTERACT na porta da sede | — | — |
| T6 | WORLD_MAP | FIELD_SETUP | Briefing → "Aceitar" | contrato `AVAILABLE` (ou `COMPLETED`, para replay) e sem missão pendente do mesmo contrato | `{ contractId, rivalAdjustment }` |
| T7 | FIELD_SETUP | WORLD_MAP | "Cancelar" ou pausa → "Abandonar" | — | — |
| T8 | FIELD_SETUP | SURVEY_FLIGHT | "Decolar" | `validatePlan(plan).blocking.length === 0` | `{ missionId }` |
| T9 | SURVEY_FLIGHT | PROCESSING_RESULTS | Pós-voo → "Processar agora" | missão com dados **e** possui `LAB_VAN` | `{ missionId, inField: true }` |
| T10 | SURVEY_FLIGHT | WORLD_MAP | Pós-voo → "Levar dados" ou falha/abandono | — | `{ outcome: 'QUEUED' \| 'FAILED' \| 'ABORTED' }` |
| T11 | PROCESSING_RESULTS | HOLO_TABLE_VIEW | "Enviar à Mesa do Museu" | relatório aprovado | `{ focusSectorId }` |
| T12 | PROCESSING_RESULTS | OFFICE | "Concluir" | `inField === false` | — |
| T13 | PROCESSING_RESULTS | WORLD_MAP | "Voltar ao mapa" | `inField === true` | — |
| T14 | HOLO_TABLE_VIEW | OFFICE | "Voltar" / `UI_BACK` | — | — |
| T15 | INFOGRAPHIC_LAB | OFFICE | "Voltar" / `UI_BACK` | — | — |
| T16 | SURVEY_FLIGHT | FIELD_SETUP | Pós-voo sem dados → "Tentar de novo" | missão sem shots nem pulsos salvos | `{ missionId }` (plano e pontos mantidos) |

Notas:
- `HOLO_TABLE_VIEW` aberta por T11 volta ao `OFFICE` (T14) mesmo quando o processamento foi em campo. O avatar é reposicionado na porta da sede, como se o jogador tivesse voltado.
- A **pausa** não é uma tela. É `session.paused = true` com `<PauseOverlay/>` por cima da tela atual.
- Novas surtidas (troca de bateria) acontecem **dentro** de `SURVEY_FLIGHT`, sem transição.

### 2.2 API

```ts
export const SCREEN_TRANSITIONS: readonly TransitionDef[];
export function canTransition(from: ScreenId, to: ScreenId, state: GameState, payload?: unknown): boolean;
// no store (sessionSlice):
goTo(to: ScreenId, payload?: ScreenPayload): void
//  1. valida com canTransition; inválida → InvalidTransitionError (DEV) ou console.warn (PROD)
//  2. executa onExit(from) → onEnter(to, payload) (hooks registrados por tela, ex.: limpar missão)
//  3. set({ screen: to, payload }) e dispara autosave
```

---

## 3. Store (Zustand)

Uma store única, `useGameStore`, composta por slices. O estado persistido é exatamente o `SaveGame` de [data-model §8](data-model.md). O estado efêmero (`session`, missão em voo, toasts) fica fora do `persist` via `partialize`.

| Slice | Estado | Ações principais |
| :--- | :--- | :--- |
| `session` | `screen`, `payload`, `paused`, `toasts[]`, `activeModal` | `goTo`, `setPaused`, `pushToast`, `dismissToast`, `openModal`, `closeModal` |
| `player` | `money` (centavos), `xp`, `level`, `skillPoints`, `reputation`, `name` | `earn(amount, reason)`, `spend(amount, reason) → boolean`, `addXp(n)`, `changeReputation(d)` |
| `inventory` | itens possuídos, equipados, milho, emblema, calibração de Atlas | `buy(itemId)`, `equip(slot, id)`, `buyCorn(n)`, `feedAtlas()`, `calibrateAtlas()`, `setEmblem(e)` |
| `skills` (no `player`) | `unlockedSkills[]` | `unlockSkill(id)` |
| `staff` (no `player`) | `{ INTERN: n, JUNIOR_ENG: n }` | `hire(role)`, `fire(role)` |
| `contracts` | `Record<ContractId, ContractProgress>` | `refreshUnlocks()`, `markStolen(id)`, `recordResult(id, report)` |
| `mission` | `active?: MissionData`, `pending: MissionData[]` | `startMission(contractId, adj)`, `updatePlan(p)`, `setGroundPoints(g)`, `setMinigameScore(k, s)`, `appendShots(s[])`, `mergeLidar(batch)`, `endSortie(outcome)`, `queueActive()`, `discardActive()`, `consumePending(id)` |
| `museum` | `sectors`, `featured`, `lastIncomeAt`, `totalVisitors` | `upsertSector(contractId, report)`, `setFeatured(wing, id)`, `tickIncome(nowMs)` |
| `world` | `avatar {x,y,facing}`, `vehicleMode`, `dimensionTab`, `discoveredRifts[]`, `lastEventAt` | `setAvatar`, `cycleVehicle`, `setDimensionTab`, `discoverRift(id)` |
| `rival` | `score`, `history[]` | `rollCounterOffer(contractId)`, `steal(contractId)` |
| `settings` | `masterVolume`, `sfxVolume`, `muted`, `quality`, `reduceFlashes`, `showFps` | `setSetting(k, v)` |

**Regras:**
- Dinheiro em **centavos inteiros** (`number` inteiro). Formatação via `formatBRL`.
- Toda ação que altera desbloqueios chama `contracts.refreshUnlocks()`, que avalia as `UnlockCondition`.
- Engines acessam a store via `useGameStore.getState()` e despacham ações **só em eventos discretos**.

---

## 4. Game loop e Canvas

```ts
// engines/loop.ts
export interface Simulation {
  update(dtS: number): void;      // chamado em sub-passos ≤ 1/60 s
  render(alpha: number): void;    // uma vez por frame
}
export class GameLoop {
  constructor(sim: Simulation, opts?: { maxDtS?: number /*0.05*/; stepS?: number /*1/60*/; timeScale?: () => number });
  start(): void; stop(): void; setPaused(p: boolean): void;
  readonly fps: number;            // média móvel de 1 s
}
// hooks
useCanvas(ref): { ctx, width, height, dpr }   // ResizeObserver + DPR scaling
useGameLoop(simFactory, deps)                  // cria/destrói o loop com a tela; respeita session.paused
```

- **`timeScale`** é usado pelo `TIME_WARP` do voo. Cada frame executa `ceil(dt·timeScale / stepS)` sub-passos.
- **`dt` real** é limitado a 50 ms. Aba em segundo plano ⇒ rAF pausa naturalmente e não há "salto".
- **Ordem por frame:**
  1. `InputManager.poll()`
  2. `sim.update` (sub-passos)
  3. `sim.render`
  4. publicação de snapshot do HUD (throttle de 100 ms)

### 4.1 Contrato dos engines

```ts
export interface EngineEvents {             // exemplo do FlightEngine
  onShot(shot: Shot): void;
  onLidarBatch(batch: LidarBatch): void;
  onCollision(e: CollisionEvent): void;
  onLineComplete(lineIndex: number): void;
  onSortieEnd(outcome: SortieOutcome): void;
  onAlert(alert: FlightAlert): void;
}
export interface HudPublisher<T> { publish(snapshot: T): void }   // implementado por um store leve (zustand vanilla) por tela
```

O componente React da tela:
1. cria o engine num `useEffect`;
2. injeta `ctx`, `events` (que chamam as ações da store) e o `hudPublisher`;
3. destrói o engine no cleanup.

O HUD lê o snapshot por `useStore(hudStore)`.

---

## 5. Terreno compartilhado

```ts
export interface TerrainSampler {
  readonly widthM: number; readonly lengthM: number;      // AOI + margem
  elevation(u: number, v: number): number;                // solo nu (MDT), m
  surface(u: number, v: number): number;                  // MDS = solo + objetos/copas
  landCover(u: number, v: number): LandCover;             // 'GRASS'|'CROP'|'FOREST'|'WATER'|'ROAD'|'ROOF'|'SAND'|'ROCK'|'SWAMP'|'URBAN'|'BENCH'|'LAVA'|'SNOW'|'METAL'
  canopy(u: number, v: number): number;                   // 0..1 cobertura de dossel
  ndvi(u: number, v: number): number;                     // -1..1
  slopePct(u: number, v: number): number;
  distanceToRoad(u: number, v: number): number;            // m
  objects: readonly WorldObject[];                         // ordenados por u
  objectsInRange(uMin: number, uMax: number): readonly WorldObject[];
  features: readonly FeatureTarget[];                      // alvos especiais (templo, escotilha)
  zones: readonly SpecialZone[];                           // térmicas, cânions RTK, holofotes, lava
}
export function createTerrain(contract: Contract): TerrainSampler;   // memoizado por contract.id
```

**Sistema de coordenadas da AOI:**
- `u` é o eixo do **comprimento** da AOI (0…`lengthM`), e `v` é o da **largura** (0…`widthM`). A origem fica no canto inferior esquerdo da AOI.
- A margem de 20 % se estende para valores negativos e acima do tamanho.

**Consumidores do terreno:**
- Field Setup (satélite e acessibilidade);
- Voo (relevo e objetos);
- Avaliação (cobertura sobre água, volumetria);
- Rasters de produto;
- Mesa holográfica (heightmap reduzido).

---

## 6. Persistência

- **Chaves:**
  - `scan-city-save`: o `SaveGame` JSON;
  - `scan-city-save-backup`: o último save inválido ou o save anterior ao "Novo jogo";
  - `scan-city-settings`: as configurações, para que sobrevivam ao "Novo jogo".
- **Versão atual:** `SAVE_VERSION = 1`.
- **Migrações:** `MIGRATIONS[n]` converte de n para n+1.
- **Validação:** `validateSave(obj): obj is SaveGame`, um validador manual tipado (sem dependências) que checa os campos obrigatórios e os tipos.
- **Autosave:**
  - via subscription da store, com debounce de 1 s, após `goTo`;
  - por intervalo de 30 s de jogo não pausado;
  - no `beforeunload`.
- **Armazenamento indisponível:** só *acessar* `localStorage` já lança (`SecurityError`) com os cookies bloqueados ou num iframe sem `allow-same-origin`, e `getItem` e `removeItem` podem lançar por erro do navegador. Toda leitura e gravação passa por `browserStorage()` (`persistence.ts`): sem armazenamento, o jogo abre vazio (um jogo novo) e o primeiro autosave recusado mostra o toast "Não foi possível salvar", uma vez por sequência de falhas. A gravação continua lançando para quem grava tratar a recusa (`writeSave`, `writeSettings`, `backupSave`).
- **Dados volumosos** da fila de missões (shots e grade LiDAR) são salvos com `number[]`. As amostras LiDAR são limitadas a 8.000 por missão no save, e na memória a 50.000.
- **Renda offline:** ao carregar, calcula `min(now − lastIncomeAt, 2 h)` × renda/min.

---

## 7. Flags de depuração (`?debug=1`)

| Parâmetro | Efeito |
| :--- | :--- |
| `debug=1` | Liga o overlay de FPS, o painel de debug (atalho `F9`) e libera os demais parâmetros |
| `seed=<n>` | Sobrescreve a seed global (eventos e rival). O terreno continua usando a seed do contrato |
| `screen=<ScreenId\|UIKIT\|SOUNDBOARD>` | Abre a tela direto, com um payload de teste: `FIELD_SETUP`/`SURVEY_FLIGHT`/`PROCESSING_RESULTS` usam o contrato C00 com o plano de referência |
| `contract=<id>` | Contrato usado pelos payloads de teste |
| `autopilot=1` | No voo, segue as linhas com perfeição (cross-track 0, AGL e velocidade do plano), desvia de obstáculos subindo e permite `TIME_WARP` ×8 |
| `unlockAll=1` | Todos os contratos `AVAILABLE`, todos os itens possuídos |
| `money=<n>` | Saldo inicial em reais |
| `souvenirs=1` | Os 18 souvenirs na estante (para examinar todos, office §5.1, ADR-036) |
| `skipIntro=1` | `flags.introSeen = true` |

O painel `F9` mostra o estado da store (JSON resumido), os botões de transição e as ações rápidas (dar dinheiro, completar contrato, gerar missão pendente).

---

## 8. Estratégia de testes

| Nível | Ferramenta | Escopo | Local |
| :--- | :--- | :--- | :--- |
| Unitário (domínio) | Vitest | fórmulas, avaliação, economia, progressão, PRNG | `src/domain/*.test.ts`, `src/lib/*.test.ts` |
| Unitário (engines) | Vitest + canvas mock (`vitest-canvas-mock`, devDependency) | projeção, física, colisão, câmera orbital, picking, builders de cena | `src/engines/**/*.test.ts` |
| Componente | Testing Library | painéis, modais, HUD, sliders, checklist | `src/**/*.test.tsx` |
| Conteúdo | Vitest | schema, referências cruzadas, viabilidade dos planos de referência, BFS do mapa | `src/data/**/*.test.ts` |
| E2E | Playwright | fluxos completos com `?debug=1&autopilot=1&skipIntro=1` | `tests/e2e/*.spec.ts` |

DevDependencies de teste permitidas: `vitest`, `@vitest/coverage-v8`, `jsdom`, `@testing-library/react`, `@testing-library/user-event`, `@testing-library/jest-dom`, `vitest-canvas-mock`, `@playwright/test`.

**Testes de canvas:**
- Para cenas que exigem verificação de pixel (REQ-FLT-002), use um canvas "software" mínimo: renderize no `OffscreenCanvas` do Chromium, via E2E com `page.evaluate`.
- Como alternativa, teste a **lista de primitivas** gerada. O renderer expõe `buildDrawList()`, que é testável sem pixels.

# Scan City

Simulador RPG de gerenciamento, exploração e engenharia cartográfica. O jogador herda a oficina de um agrimensor analógico, funda a **GeoSurvey Soluções Cartográficas** e aprende **fotogrametria e LiDAR jogando**: as fórmulas reais (GSD, sobreposição, base aérea, densidade de pontos, RMSE e PEC-PCD) decidem se cada missão dá certo. O dinheiro dos contratos financia o **Grande Museu da Terra**, uma mesa topográfica holográfica que cresce conforme o mundo é mapeado, e as fendas dimensionais paródicas guardam os contratos secretos.

O jogo roda inteiro no navegador, sem servidor e sem arquivo externo: o terreno é gerado por seed, a arte é desenhada no Canvas 2D e o som é sintetizado na Web Audio. O texto do jogo está em português do Brasil.

## Jogar online

**https://kauevestena.github.io/scan_city/**: cada push na `main` que passa no `npm run verify` publica a versão nova ([`.github/workflows/pages.yml`](.github/workflows/pages.yml), [ADR-028](specs/decisions.md)). Os parâmetros de depuração de [Depuração](#depuração-debug1) valem também lá.

## Como rodar

Requer Node.js 22 (a versão usada no desenvolvimento).

```bash
npm install
npm run dev        # servidor de desenvolvimento (Vite), http://localhost:5173
```

Para jogar a versão de produção: `npm run build && npm run preview` (http://localhost:4173).

O progresso é salvo no `localStorage` do navegador (autosave ao trocar de tela). O menu de pausa (**Esc**) tem **Configurações** (volume, mudo, reduzir flashes e tremores, FPS e qualidade gráfica), **Controles**, **Salvar agora** e **Novo jogo** (guarda um backup do save antes de apagar).

## Roteiro de jogo

1. **Escritório (`OFFICE`)**: a sede, com nove pontos de interação. A **Garagem** vende aeronaves, sensores, veículos, equipamento e pintura; o **Poleiro do Atlas** cuida do milho e da câmera do pombo; a **Mesa da Equipe** contrata e demite; o **Quadro de Carreira** guarda habilidades, perfil e visual; a **Estante de Relíquias** guarda os souvenirs; a **Workstation** processa as missões; o **Laboratório** abre os infográficos; a **Mesa Holográfica** abre o Museu; e a **Porta** leva ao mapa.
2. **Mapa (`WORLD_MAP`)**: mundo aberto 2D. Cada marcador é um contrato; entre num e aceite o briefing.
3. **Campo (`FIELD_SETUP`)**: pontos de apoio (GCPs) com a Estação Total do Avô, plano de voo, calibração e checklist.
4. **Voo (`SURVEY_FLIGHT`)**: voo 2.5D sobre o relevo, pelos portais do corredor de cada linha. Cada foto ganha nota (faixa, altura e avanço), as rajadas avisadas empurram a aeronave, a linha mal voada volta para revoo e a execução do voo entra no relatório; RGB ou LiDAR, vento, bateria e eventos.
5. **Processamento (`PROCESSING_RESULTS`)**: SfM no notebook, relatório de qualidade e produtos (ortofoto, MDS, MDT, NDVI e nuvem 3D).
6. **Museu (`HOLO_TABLE_VIEW`)**: a mesa 3D mostra cada setor mapeado, na dimensão real ou no Multiverso.
7. **Laboratório (`INFOGRAPHIC_LAB`)**: infográficos interativos de óptica e GSD, estereoscopia, dossel e shutter.

## Controles

Teclado e mouse, ou controle Xbox/PS5 (Gamepad API, layout `standard`). A tela **Esc → Controles** mostra os botões do dispositivo em uso.

| Ação                              | Teclado                   | Controle                     |
| :-------------------------------- | :------------------------ | :--------------------------- |
| Mover (mapa) / pilotar (voo)      | `W A S D` ou setas        | Analógico esquerdo / D-pad   |
| Interagir, confirmar              | `Espaço` ou `Enter`       | `A` / `✕`                    |
| Voltar, fechar                    | `Esc` ou `Backspace`      | `B` / `○`                    |
| Pausar                            | `Esc` ou `M`              | `Menu` / `Options`           |
| Subir / descer altura (voo)       | `Q` / `E`                 | `RT` / `LT`                  |
| Foto manual, ação do mini-game    | `Espaço`                  | `X` / `□`                    |
| Trocar RGB ↔ LiDAR, Real ↔ Fendas | `Tab` (ou `1` `2` no voo) | `Y` / `△`                    |
| Retorno à base (voo)              | `R`                       | `B` / `○`                    |
| Cruzeiro automático (voo)         | `T`                       | `RB` / `R1`                  |
| Trocar de veículo (mapa)          | `V`                       | `LB` / `L1`                  |
| Trocar de aba                     | `Q` / `E`                 | `LB` / `RB`                  |
| Dispensar a dica do tutorial      | `H`                       | `View` / `Create`            |
| Orbitar e dar zoom (mesa, nuvem)  | mouse, setas, `+` `−`     | Analógico direito, `RT` `LT` |

O jogo se joga do começo ao fim só com o teclado ou só com o controle (REQ-NFR-007); a tabela completa de ações está em [specs/design/input.md](specs/design/input.md).

## Scripts

| Comando                                                 | O que faz                                                                                                                                                                             |
| :------------------------------------------------------ | :------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`                                           | Vite em modo de desenvolvimento                                                                                                                                                       |
| `npm run build`                                         | `tsc -b` e build de produção em `dist/`                                                                                                                                               |
| `npm run preview`                                       | serve o `dist/`                                                                                                                                                                       |
| `npm test`                                              | testes de unidade e de componente (Vitest + jsdom)                                                                                                                                    |
| `npm run test:coverage`                                 | os mesmos testes com cobertura v8 e limites (global ≥ 60 %; `src/domain` e `src/lib` ≥ 90 %)                                                                                          |
| `npm run e2e`                                           | Playwright em Chromium (constrói e serve o app na porta 4173)                                                                                                                         |
| `npm run e2e:firefox`                                   | os mesmos testes no Firefox (REQ-NFR-009); na primeira vez, `npx playwright install firefox`                                                                                          |
| `npm run typecheck` / `npm run lint` / `npm run format` | TypeScript estrito, ESLint (zero avisos) e Prettier                                                                                                                                   |
| `npm run check:placeholders`                            | zero `TODO`/`FIXME`/`XXX`, funções vazias e `DebugScreenShell` em `src/` (REQ-NFR-005)                                                                                                |
| `npm run check:terms`                                   | nenhum nome de franquia em `src/` (REQ-CNT-006)                                                                                                                                       |
| `npm run check:assets`                                  | nenhum asset externo no `dist/` (REQ-NFR-006)                                                                                                                                         |
| `npm run qa:random`                                     | entradas aleatórias (teclado, mouse e controle) contra o `npm run preview`, procurando erro, queda e travada; com `--soak` mede a memória (opções no topo de `scripts/qa-random.mjs`) |
| `npm run qa:flight`                                     | os quatro pilotos simulados (parado, distraído, mediano e bom) nos 18 contratos, em 3 sementes (`QA_SEEDS=<n>` muda), com a tabela de execução e as metas de desafio (REQ-NFR-010)    |
| `npm run verify`                                        | `typecheck`, `lint`, `test`, `build`, `check:placeholders` e `check:terms`: o que cada commit precisa passar                                                                          |

Na primeira execução do `npm run e2e` numa máquina nova, instale o navegador: `npx playwright install chromium`. A suíte completa leva cerca de 16 minutos; `npx playwright test tests/e2e/<arquivo>.spec.ts` roda um arquivo só.

## Depuração (`?debug=1`)

Os parâmetros abaixo só valem com `debug=1`; sem ele a URL é ignorada.

| Parâmetro           | Efeito                                                                                                                  |
| :------------------ | :---------------------------------------------------------------------------------------------------------------------- |
| `debug=1`           | liga o contador de FPS e o painel **F9** (estado da store, transições, ações rápidas, tempo por etapa do voo e da mesa) |
| `skipIntro=1`       | pula a introdução                                                                                                       |
| `seed=<n>`          | seed global (eventos e rival)                                                                                           |
| `screen=<ScreenId>` | abre a tela direto com um payload de teste; `UIKIT` abre a galeria de componentes e `SOUNDBOARD` a mesa de som          |
| `contract=<id>`     | contrato usado pelos payloads de teste (por exemplo `C03` ou `R04`)                                                     |
| `autopilot=1`       | o voo segue o plano sozinho (é o piloto "bom" das metas de desafio) e libera o tempo ×8                                 |
| `calm=1`            | voo sem rajadas e sem erro de entrada de faixa, para testar o resto sem pilotar                                         |
| `unlockAll=1`       | todos os contratos disponíveis e todos os itens possuídos                                                               |
| `money=<n>`         | saldo inicial em reais                                                                                                  |

Exemplo: `http://localhost:5173/?debug=1&screen=SURVEY_FLIGHT&autopilot=1` abre um voo que se completa sozinho. Com `screen=` ou `unlockAll=1` as dicas do tutorial ficam desligadas.

## Estrutura

```
src/
├── app/       roteador de telas, pausa, configurações, overlays e ferramentas de depuração
├── audio/     síntese de efeitos e ambientes na Web Audio
├── data/      catálogo, contratos, regras especiais, eventos e todo o texto do jogo (strings.ts)
├── domain/    regras e fórmulas puras (GSD, voo, SfM, acurácia, economia, progressão); sem DOM
├── engines/   Canvas 2D: laço do jogo, voo 2.5D, mesa 3D (soft3d), campo, laboratório, escritório, mapa
├── input/     InputManager: teclado, mouse, Gamepad API, glyphs e navegação por foco
├── lib/       PRNG com seed, matemática e formatação
├── screens/   as sete telas do jogo e os painéis de cada uma
├── state/     store Zustand (slices), máquina de telas, persistência e migrações
├── types/     interfaces canônicas (data-model)
├── ui/        kit de componentes e tokens visuais
└── world/     terreno procedural, biomas e mapa-múndi
tests/e2e/     Playwright: um fluxo por contrato, o slice do C00, teclado, controle, foco, contraste
specs/         a especificação (SDD): a fonte da verdade do projeto
```

## Especificação

O projeto foi construído por **Spec-Driven Development**: a pasta [`specs/`](specs/README.md) é a fonte da verdade e cada tarefa de [`specs/tasks.md`](specs/tasks.md) cita os requisitos (`REQ-*`) que atende. O mapa:

- [`constitution.md`](specs/constitution.md): stack, princípios, convenções e Definition of Done;
- [`product.md`](specs/product.md) e [`requirements.md`](specs/requirements.md): visão, narrativa e os 138 requisitos;
- [`design/`](specs/design) e [`features/`](specs/features): arquitetura, matemática do domínio, terreno, input, áudio, UI e uma spec por tela;
- [`decisions.md`](specs/decisions.md) e [`open-questions.md`](specs/open-questions.md): decisões (ADRs) e perguntas em aberto.

## Pendências conhecidas

O roteiro dos testes que só uma pessoa faz (Firefox e Edge, controle real, FPS com GPU, som e campanha jogada) está em [`specs/qa-manual.md`](specs/qa-manual.md).

- **Firefox:** a suíte E2E inteira (135 testes) passa no Firefox 155 (`npm run e2e:firefox`) e o jogo publicado também ([OQ-014](specs/open-questions.md), resolvida); o toque humano (aparência, som, controle de verdade) segue no roteiro.
- **GPU:** os FPS foram medidos em Chromium sem GPU, com raster por software ([OQ-013](specs/open-questions.md)).

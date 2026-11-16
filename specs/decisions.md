# Registro de Decisões de Arquitetura (ADRs)

> Toda decisão que desvia do [spec_inicial.md](../spec_inicial.md) ou que fixa algo que ele deixou em aberto é registrada aqui. O agente implementador **acrescenta** ADRs (numeração sequencial) sempre que tomar uma decisão não coberta pela spec. Nunca apague uma ADR. Para revertê-la, marque-a como "Substituída por ADR-NNN".
>
> **Formato:** Contexto → Decisão → Consequências · Status · Data.

---

### ADR-001 — Projeto modular, sem a restrição de arquivo único
- **Contexto:** o spec original pede um único componente React (Claude Artifact). O escopo inteiro (7 telas, 4 motores gráficos, 18 contratos, progressão) passaria de 10 mil linhas, o que inviabiliza o desenvolvimento incremental e testável.
- **Decisão:** decisão do usuário na conversão. O projeto é um Vite + React + TypeScript modular, sem a exigência de caber num Artifact.
- **Consequências:** permite testes unitários e E2E, separação domínio/engines/UI e tarefas pequenas. Os demais requisitos estritos continuam valendo: React funcional, Tailwind, Canvas nativo, lucide-react, Web Audio e zero placeholders.
- **Status:** Aceita · 2026-11-13

### ADR-002 — Zustand como estado global
- **Contexto:** o original cita `useState` para a máquina de estados. Os engines de Canvas precisam ler e escrever estado fora do ciclo do React.
- **Decisão:** Zustand com slices e `persist`. A máquina de telas é uma tabela explícita (`machine.ts`) e não um `useState` solto.
- **Consequências:** acesso via `getState()` nos engines e persistência simples. Uma dependência a mais, aprovada aqui.
- **Status:** Aceita · 2026-11-13

### ADR-003 — Engines de Canvas fora do React, com HUD por snapshot
- **Contexto:** 60 FPS é incompatível com `setState` por frame.
- **Decisão:** os engines usam estado mutável próprio, eventos discretos para a store e um snapshot do HUD a 10 Hz.
- **Consequências:** performance previsível, e os engines podem ser testados sem DOM (`buildDrawList`).
- **Status:** Aceita · 2026-11-13

### ADR-004 — Disparo da câmera por tempo (Δt)
- **Contexto:** o original pede o alerta "Overlap Insuficiente se voar rápido demais".
- **Decisão:** a câmera dispara a cada `Δt = B/v` do **plano**. A sobreposição real é medida pela distância entre disparos e pelo `H_g` no AGL do momento.
- **Consequências:** voar mais rápido ou mais baixo que o planejado reduz `p_real` de forma física e ensinável. Drones reais também oferecem disparo por distância; isso fica fora do escopo.
- **Status:** Aceita · 2026-11-13

### ADR-005 — Lentes como focal equivalente
- **Contexto:** o original oferece lentes de 24 e 35 mm e sensores de 20 MP e 45 MP. Uma lente de 24 mm *real* num sensor de 1" seria irrealista.
- **Decisão:** as lentes são definidas por focal equivalente. `f_real = f_eq / crop`. O sensor de 20 MP (1") tem lente fixa de 8,8 mm (≈ 24 mm eq.). O full-frame aceita 24 e 35 mm reais.
- **Consequências:** valores fiéis a equipamentos reais.
- **Status:** Aceita · 2026-11-13

### ADR-006 — Contrato tutorial C00 "Sítio do Avô"
- **Contexto:** o original não define um contrato inicial executável com o equipamento inicial (Atlas).
- **Decisão:** é adicionado o C00, um contrato pequeno e didático que vira o primeiro setor do Museu e amarra a narrativa do avô. Ele é o alvo do Vertical Slice (M1).
- **Consequências:** o Museu Real tem 7 setores (4 × 2 com 1 oceano decorativo), e são 18 souvenirs.
- **Status:** Aceita · 2026-11-13

### ADR-007 — Flags de depuração e autopilot
- **Contexto:** os testes E2E de um jogo de ação precisam de determinismo e de automação.
- **Decisão:** `?debug=1` com `seed`, `screen`, `contract`, `autopilot`, `unlockAll`, `money` e `skipIntro`, mais o painel F9.
- **Consequências:** E2E estáveis. O debug fica inacessível sem o parâmetro (REQ-NFR-005).
- **Status:** Aceita · 2026-11-13

### ADR-008 — Guarda de conteúdo para as paródias
- **Contexto:** as Fendas parodiam franquias reais.
- **Decisão:** usar nomes paródicos, descrições textuais, motivos visuais genéricos procedurais e retratos como emblemas abstratos. Nenhum nome de franquia em `src/`, verificado por script.
- **Consequências:** o jogo permanece uma obra original. O humor fica nos textos e nas mecânicas.
- **Status:** Aceita · 2026-11-13

### ADR-009 — Só o sensor ativo registra dados
- **Contexto:** o original pede alternância RGB/LiDAR, mas não diz se ambos gravam ao mesmo tempo.
- **Decisão:** com o Pod LiDAR, só o sensor ativo registra. O sensor inicial é o primário do plano.
- **Consequências:** a alternância vira uma decisão tática. Contratos que exigem LiDAR pedem atenção ao sensor ativo.
- **Status:** Aceita · 2026-11-13

### ADR-010 — Ações de input adicionais
- **Contexto:** os sistemas especificados precisam de entradas que a tabela original não lista: troca de dimensão no mapa e na mesa, troca de veículo, aceleração de tempo, órbita, zoom e modos da mesa.
- **Decisão:** foram adicionadas as ações `TOGGLE_DIMENSION`, `CYCLE_VEHICLE`, `TIME_WARP`, `LOOK_X/Y`, `ZOOM` e `MODE_1..3`, marcadas como **[ADIÇÃO]** em [input §2](design/input.md). Os bindings da tabela original foram mantidos.
- **Consequências:** os conflitos de tecla (Tab) são resolvidos por contexto.
- **Status:** Aceita · 2026-11-13

### ADR-011 — Transição T16 (Voo → Planejamento, "Tentar de novo")
- **Contexto:** depois de uma surtida sem nenhum dado salvo, o jogador precisa voltar ao planejamento sem perder os GCPs.
- **Decisão:** nova transição `SURVEY_FLIGHT → FIELD_SETUP`, guardada por "missão sem dados".
- **Consequências:** a tabela tem 16 transições.
- **Status:** Aceita · 2026-11-13

### ADR-012 — Múltiplas surtidas por missão
- **Contexto:** AOIs grandes e baterias curtas (12 min no Tier 1). O original prevê RTH e perda de dados se a bateria zerar.
- **Decisão:** cada aeronave tem baterias reservas por missão (o Atlas usa o estoque de milho). Após um RTH, o jogador pode iniciar uma nova surtida a partir da primeira linha incompleta. Queda ou bateria zerada descartam só os dados **daquela** surtida.
- **Consequências:** gestão de recurso mais rica e fiel à prática de campo.
- **Status:** Aceita · 2026-11-13

### ADR-013 — Tier 4 é uma carga (pod), não uma aeronave
- **Contexto:** o original lista o "Pod LiDAR Aerotransportado" como Tier 4 de "Aeronaves & Sensores".
- **Decisão:** o Pod LiDAR é uma carga montável nos Tiers 2 e 3. A compra exige o Tier 3. Ele inclui uma câmera RGB e a IMU tática.
- **Consequências:** combinações táticas (multirrotor lento para densidade alta, asa fixa para áreas grandes).
- **Status:** Aceita · 2026-11-13

### ADR-014 — Sensores adicionais
- **Contexto:** os contratos C02 e R09 pedem NDVI (multiespectral), e R06 pede termografia. O original lista só as câmeras de 20 e 45 MP.
- **Decisão:** foram adicionados `CAM_MS5` (multiespectral), `CAM_THERMAL` e `CAM_POD_RGB` (embutida no pod), com specs inspiradas em equipamentos reais.
- **Status:** Aceita · 2026-11-13

### ADR-015 — Balanceamento econômico e combo T2
- **Contexto:** os preços precisam viabilizar a campanha sem grind excessivo.
- **Decisão:**
  - os preços, pagamentos e a ordem de referência estão em [catalog §13](content/catalog.md), com uma simulação manual viável;
  - o Tier 2 é vendido como combo: aeronave, câmera de 45 MP, lente de 35 mm e kit GNSS RTK.
- **Consequências:** um teste de simulação de campanha (T071) protege o balanceamento. Ajustes futuros exigem uma nova ADR.
- **Status:** Aceita · 2026-11-13

### ADR-016 — Acurácia simulada por modelo, não por SfM real
- **Contexto:** executar SfM real no navegador está fora de escopo.
- **Decisão:** a acurácia é calculada por um modelo determinístico ([domain-math §6](design/domain-math.md)) baseado em GSD, RTK, geometria dos GCPs e fatores de qualidade. Os resíduos são sorteados com seed e escalados ao RMSE-alvo. As normas PEC-PCD e ASPRS são aplicadas sobre esses resíduos.
- **Consequências:** as relações causa-efeito são corretas e ensináveis, e os números são plausíveis. Não pretende reproduzir a precisão de software comercial.
- **Status:** Aceita · 2026-11-13

### ADR-017 — Projeção 2.5D sem pitch de câmera
- **Contexto:** a fórmula original é uma projeção cônica com horizonte fixo.
- **Decisão:** a câmera olha na horizontal, sem pitch. O horizonte é animado só na decolagem. A convenção de sinal do eixo vertical está explícita em [survey-flight §5.1](features/survey-flight.md).
- **Consequências:** implementação simples e rápida. O efeito de "Mode-7 avançado" vem das faixas não lineares e do relevo.
- **Status:** Aceita · 2026-11-13

### ADR-018 — Motor 3D por software (`soft3d`) em Canvas 2D
- **Contexto:** o original exige Canvas HTML5 nativo para a mesa holográfica e para a nuvem de pontos.
- **Decisão:** um motor próprio com matrizes, *painter's algorithm* e *picking*. Sem WebGL.
- **Consequências:** limita a contagem de primitivas (cerca de 10 mil quads ou 30 mil pontos), o que se resolve com níveis de qualidade.
- **Status:** Aceita · 2026-11-13

### ADR-019 — Instrumento inicial e mini-game de nivelamento unificado
- **Contexto:** o mini-game "Nivelamento da Base GNSS RTK" pressupõe uma base RTK, que o jogador inicial não tem.
- **Decisão:** o jogador começa com a **Estação Total do Avô** (máximo de 8 pontos, σ de 1 cm). O mesmo mini-game de bolha nivela a estação total **ou** a base GNSS. O `GNSS_RTK_KIT` habilita o RTK nas aeronaves e permite mais pontos.
- **Consequências:** o mini-game é útil desde o C00 e coerente com a herança do avô.
- **Status:** Aceita · 2026-11-13

### ADR-020 — Aceleração de tempo no voo
- **Contexto:** os voos de referência duram de 4 a 13 min a ×1, o que fica longo para o ritmo arcade.
- **Decisão:** `TIME_WARP` de ×2 e ×4 nas retas, com volta automática a ×1 diante de riscos.
- **Status:** Aceita · 2026-11-13

### ADR-021 — Versões fixadas do ferramental
- **Contexto:** a constitution pede "Vite (última estável)" e React 18+. No bootstrap (T001), as últimas versões estáveis eram Vite 8, React 19, Tailwind 4, Vitest 5, ESLint 10 e TypeScript 7. O `typescript-eslint` 8 só aceita TypeScript `< 6.1`, e os navegadores do Playwright disponíveis no ambiente de desenvolvimento correspondem à versão 1.63.0.
- **Decisão:**
  - TypeScript fixado em `~6.0` até o `typescript-eslint` suportar a linha 7;
  - `@playwright/test` fixado em `1.63.0` (sem `^`), para casar com o Chromium instalado;
  - `@eslint/js` entra como devDependency, por ser a fonte de `eslint.configs.recommended` no flat config;
  - o script `verify` só passa a incluir `check:terms` em T059, quando o script é criado (como já diz o [README §3](README.md)).
- **Consequências:** atualizar o TypeScript ou o Playwright exige revisar esta ADR. Nenhuma dependência de runtime além das quatro permitidas.
- **Status:** Aceita · 2026-11-14

### ADR-022 — Precedência do `detectFamily` e camadas de input
- **Contexto:** em T008, dois pontos do [input](design/input.md) precisaram de ajuste ou detalhe:
  - a regra de `detectFamily` testava a PlayStation primeiro, com o termo "wireless controller". O id do Xbox no Chrome ("Xbox Wireless Controller (… 045e …)"), que é um dos casos de teste exigidos em input §6, seria classificado como PlayStation;
  - a spec não dizia como a UI (eventos) e os engines (estado por frame) dividem o input, nem como o `Esc` convive entre "voltar" e "pausar".
- **Decisão:**
  - `detectFamily` testa a família Xbox antes da PlayStation;
  - teclado na UI por eventos imediatos, gamepad por `poll`; `poll(timeMs)` ignora a segunda chamada no mesmo frame;
  - pilha de camadas (modais acima), `Esc` = voltar ou, se não houver para onde voltar, pausar;
  - `UI_CONFIRM` do teclado fica com a ativação nativa dos botões.
  - Os detalhes estão em input §3.1 e §3.2.
- **Consequências:** os 6 IDs reais de controles são classificados corretamente. O mesmo `Esc` fecha modais e pausa a partir das telas. Enter não ativa um botão duas vezes.
- **Status:** Aceita · 2026-11-14

### ADR-023 — Desempenho do `soft3d` e da Mesa: ordenação empacotada, sem traço por quad, anel em resolução menor
- **Contexto:** em T072, com os 18 setores mapeados, a Mesa Holográfica rodava a 35–46 FPS num Chromium sem GPU (1280 × 720, HIGH), contra a meta de ≥ 55 FPS. A medição por fase mostrou que a coleta (projeção e descarte) custa ~0,5 ms e a ordenação ~0,8 ms, mas o **desenho** custava até 25,7 ms por quadro no anel do Multiverso. Além disso, o [holo-table §5.7](features/holo-table.md) pede "FPS médio < 50 por 3 s" sem dizer onde medir, e o `GameLoop` divide cada quadro em sub-passos de `update` de até 1/60 s.
- **Decisão:**
  - a ordenação por profundidade usa uma **chave empacotada** (profundidade média em 1/4096 · 2²⁰ + índice do quad) num `Float64Array.sort()` nativo, sem comparador; os quads de fundo ficam fora da ordenação;
  - quads **opacos** seguidos da mesma cor viram um só caminho (um `fill`); os translúcidos continuam um a um;
  - o `stroke` por quad, que escondia as costuras entre vizinhos, **sai**: cada quad é inflado em 0,45 px a partir do centro, e o quad seguinte da ordem de pintura cobre a costura (de 25,7 ms para 8,1 ms no desenho do anel);
  - os dioramas do anel usam **uma resolução abaixo** da grade Real (24, 16 e 12 em vez de 32, 24 e 16);
  - o governor de qualidade mede o FPS no **`render`** (o relógio real entre desenhos), não no `update`.
- **Consequências:** com os 18 setores a mesa fica entre 52,8 e 60,3 FPS no mesmo ambiente (REQ-NFR-001, parcial; a tabela completa vem na T077). O traço inflado sobrepõe vizinhos em menos de 1 px (imperceptível no sombreamento *flat*). Os dioramas ficam um pouco mais facetados do que os setores Reais, mas ocupam uma fração da tela e a queda automática de qualidade continua cortando um nível por vez. Quem desenhar translúcidos em `soft3d` deve usar `MeshInstance.alpha` (o caminho dos opacos não os mistura).
- **Status:** Aceita · 2026-11-16

### ADR-024 — Medições de performance: custo de rasterização por software e otimizações do voo
- **Contexto:** o REQ-NFR-001 pede ≥ 55 FPS (média de 10 s) a 1280 × 720, DPR 1, em Alta, no voo e na mesa, e ≥ 58 FPS no mapa-múndi, num notebook de 4 núcleos. O [survey-flight §5.18](features/survey-flight.md) dá o orçamento de ≤ 12 ms por quadro no voo e o [holo-table §5.7](features/holo-table.md), de ≤ 10 ms na mesa. O ambiente de medição **não tem GPU**: o Chromium headless do Playwright rasteriza o canvas por software, na thread principal (4 vCPU Xeon de 2,3 GHz), que é o **pior caso** perto do notebook de referência (onde o canvas 2D é acelerado). No começo da T077 o voo na C03 (floresta de 4 mil copas) fazia 52,4 FPS e o da R04, 54,6, abaixo da meta.
- **Método:** FPS é a média de 10 s de `requestAnimationFrame` depois de 10 s de aquecimento (voo com autopilot e `seed=3`; mesa com os 18 setores mapeados, 10 s por combinação; mapa andando a pé), em Alta, Média e Baixa (`scan-city-settings`), com o vsync de 60 Hz. A **capacidade** é a mediana de ms por quadro sem vsync (`--disable-frame-rate-limit --disable-gpu-vsync`), que mostra a folga que o teto de 60 Hz esconde. As etapas vêm do contador do painel F9 (`engines/perf.ts`); o diagnóstico fino, de um *trace* do Chromium e de microbenchmarks com os 1.811 quads reais de um quadro da C03.
- **Diagnóstico:** a thread principal fica ~100 % ocupada. Na C03 (13,2 ms por quadro sem vsync) o JS do motor somava 5,7 ms (grade do terreno 2,0 · terreno 1,2 · objetos 0,9 · simulação 0,9 · LiDAR e clima 0,6) e o resto era a **rasterização por software**, feita no *commit* do quadro e que o JS não enxerga: os quads custavam ~5,5 ms (um `fill` e um `stroke` por quad) e as copas, ~1,4 ms. O contador por etapa mede o JS; a rasterização aparece como a diferença para o tempo do quadro.
- **Decisão (aplicadas):**
  1. **Sem `stroke` por quad** (survey-flight §5.18, fillStyle e Path): cada quad avança `QUAD_OVERLAP_PX` = 1 px na borda de baixo e na da direita; a faixa mais perto e a coluna seguinte são pintadas depois e cobrem o avanço, então a emenda de antisserrilhado some sem contorno. Medido com os 1.811 quads reais de um quadro da C03: 5,3 → 3,9 ms por quadro; na cena inteira, +14 % de FPS sem vsync (64,7 → 73,8).
  2. **Elevação uma vez por ponto da grade**: `TerrainScene.sampleGround` e `TerrainSampler.landCoverAt` entregam elevação e cobertura juntas (a cobertura reaproveitava o relevo, que era avaliado duas vezes por ponto).
  3. **Objetos, sombras e alvos assentam na malha da grade** (`gridElevation`, interpolação bilinear das elevações já amostradas), sem reavaliar o relevo por objeto: é o item "elevação por faixa calculada uma vez por frame, sem recálculo por objeto" do §5.18, e a base do objeto fica na superfície que os quads desenham.
  4. **Hash espacial com chave numérica** e um hash só de prédios para a pergunta "é telhado?" que a grade faz a cada ponto: a chave de texto (`"cx,cy"`) era montada milhares de vezes por quadro e, numa floresta, cada célula devolvia dezenas de árvores.
  5. **Sem alocação por quadro** nos pontos quentes: a grade reaproveita os buffers (um jogo por qualidade) e a cor do quad sai sem vetores temporários; os pontos do LiDAR usam estilos prontos por degrau de desvanecimento (12), em vez de uma string por ponto.
- **Decisão (avaliadas e não adotadas, com a medição):**
  - **Quads de mesma cor num caminho só** (o que a mesa faz, ADR-023): num caminho com os 48 quads de cada faixa, 14,6 ms contra 5,2 ms com os quads separados (um caminho com vários contornos fica caro no raster por software).
  - **Lote de cores iguais mais quads inflados a partir do centro** (também como na mesa): na cena real da C03, 64,5 FPS sem vsync, igual ao traço por quad (64,7) e abaixo do quad simples com avanço de 1 px (73,8); o avanço lateral vence.
  - **`Path2D` reutilizado** (§5.18): um círculo unitário com `setTransform` para as 700 copas custou 2,9 ms contra 2,7 ms do `arc`; sem ganho, então fica o `arc`.
  - **`fillRect` no lugar do quad** (1,5 ms): descartado, porque troca a geometria por degraus nas encostas.
  - **Limitar o tamanho dos runs de cor na mesa** (6 ou 2 quads por caminho): sem diferença além do ruído (± 5 %).
- **Já atendidas (§5.18):** normais da mesma grade (`dzdx` e `dzdz` das elevações da grade), cache de `fillStyle` por cor quantizada (64 níveis), objetos fora do frustum descartados antes da ordenação (corte lateral no motor e `bandOf`) e quads fora da tela descartados.
- **Resultados** (Chromium sem GPU, 1280 × 720, DPR 1, vsync de 60 Hz; média de 10 s):

| Tela | Alta | Média | Baixa |
| :--- | :---: | :---: | :---: |
| Voo C01 (cidade) | 60,0 | 60,0 | 60,0 |
| Voo C03 (floresta) | 58,8 | 60,0 | 60,0 |
| Voo R04 (fada) | 59,9 | 59,3 | 60,0 |
| Mesa, Real · Ortofoto / Hipsometria / LiDAR Neon | 59,1 / 58,8 / 59,4 | 59,8 / 59,9 / 60,0 | 60,0 / 59,8 / 60,0 |
| Mesa, Multiverso · Ortofoto / Hipsometria / LiDAR Neon | 59,7 / 59,1 / 59,9 | 60,0 / 60,0 / 59,5 | 60,0 / 60,0 / 60,0 |
| Mapa-múndi, Real e Fendas (andando) | 60,0 | 60,0 | 60,0 |

  Capacidade (mediana de ms por quadro sem vsync, Alta), antes e depois: C01 **7,3 → 4,9 ms**; C03 **14,5 → 10,3 ms**; R04 **16,4 → 10,7 ms**; mesa (18 setores) 14–16 ms, sem mudança (o código da mesa não mudou); mapa 1,2–1,3 ms. JS por etapa no painel F9 (Alta): C03 de 5,7 para **3,8 ms** (grade 2,0 → 1,1; terreno 1,2 → 0,9; LiDAR e clima 0,6 → 0,2; simulação 0,9 → 0,7), R04 **3,6 ms**, C01 **1,6 ms**, mesa 5,0 a 7,4 ms conforme a combinação (orçamentos: voo ≤ 12 ms, mesa ≤ 10 ms). Com a qualidade Média o `QualityGovernor` da mesa nunca precisou agir (a qualidade final de cada combinação é a pedida).
- **Consequências:** o voo e a mesa passam de 55 FPS em Alta e o mapa passa de 58 neste ambiente, que é mais lento que o de referência; a C03 em Alta é o cenário com menos folga (≈ 10,3 ms sem vsync contra 16,7 ms do quadro). O contador por etapa, ligado só com o painel F9 aberto, mede o JS (a rasterização por software não aparece nele; ver o diagnóstico): uma regressão de raster se vê no FPS do overlay, não nas etapas. O avanço de 1 px dos quads pode fazer o terreno invadir 1 px do vizinho nos degraus de silhueta (imperceptível). Quem acrescentar desenho ao voo deve preferir muitos `fill` simples e curtos a caminhos grandes, e evitar `stroke` por primitiva.
- **Status:** Aceita · 2026-11-16

### ADR-025 — Teclado e controle: o que o foco faz em cada tela, e a auditoria como teste
- **Contexto:** a auditoria de acessibilidade da T078 (REQ-NFR-007: navegação completa sem mouse; REQ-INP-006: D-pad, A e B em todo painel, modal ou menu) achou lacunas que nenhum teste de unidade pegava, porque dependem do foco real no navegador: no mapa, na mesa e no voo o `Tab` e as setas são do jogo (dimensão, sensor, movimento, órbita), então os botões de DOM dessas telas ficavam inalcançáveis; o painel de alas da mesa não tinha caminho de teclado; as setas das abas mudavam a seleção e deixavam o foco para trás; o campo e o relatório não tinham Q/E nem LB/RB, e o relatório não tinha navegação por D-pad; os painéis do escritório não recebiam o foco; o final da campanha perdia o foco para a Porta de trás do modal; o mapa de satélite e a nuvem 3D só respondiam ao ponteiro.
- **Decisão:**
  - **Uma tecla equivalente para cada botão de DOM das telas de jogo**, em vez de abrir o `Tab` nelas (o que quebraria a dimensão e o sensor, que a spec fixa): `H` (`View` no controle), a ação `DISMISS_HINT`, dispensa a dica do tutorial; o resto (`M`/`Esc`, `Tab`, `1 2 3`, `W`) já existia.
  - **Contexto `HOLO_PANEL`** para a mesa com o painel de alas aberto: as setas, o Enter e o Esc navegam pelos botões, o `Tab` fica livre para o foco nativo, `W`/`RB` fecham e o analógico direito segue orbitando. A seleção de setor da mesa fica, no teclado, com esse painel.
  - **Abas** (`Tabs`): a seta leva o foco junto com a seleção (padrão ARIA de abas com `tabindex` móvel) e Home/End vão às pontas; o campo e o relatório trocam de aba com Q/E e LB/RB, como o laboratório; o relatório ganha navegação por foco.
  - **`useFocusNavigation({ autoFocus })`**: o foco entra no painel ao montar e volta a quem o tinha ao desmontar, sem atropelar quem já focou outro controle e sem repetir a cada reativação (uma confirmação que fecha). Vale para as gavetas do escritório, que são **não modais**: o Tab pode sair delas.
  - **`Modal`**: uma guarda de foco (só a do modal do topo): se algo leva o foco para fora, ele volta; com modais empilhados vale o de cima. A sala do escritório não foca a Porta enquanto o final da campanha está aberto.
  - **Paridade sem mouse nos dois canvases de ponteiro**: o mapa de satélite ganha uma mira no centro (WASD move a vista, `+` e `−` dão zoom, Enter coloca ou, com a Borracha, remove) e a nuvem 3D, o foco com setas que orbitam.
  - **A auditoria é um teste.** `focus-audit.spec.ts` varre, em 23 estados, cada controle visível (nome, Tab, anel de foco) e, nos modais, o foco preso e o retorno; `contrast.spec.ts` calcula o contraste de todo texto do DOM em 13 estados; `keyboard-only` e `gamepad` jogam sem tocar num elemento. Uma regressão de foco ou de contraste vira um teste vermelho, não uma nova rodada manual.
- **Alternativas descartadas:** abrir o `Tab` no mapa, na mesa e no voo (conflita com a dimensão e o sensor da spec); mover a seleção de setor para `Shift`+setas (exigiria modificadores no `InputManager`); prender o Tab nas gavetas do escritório (não são modais); inflar os emblemas dos clientes para passar no contraste (são marcas, isentas pela WCAG).
- **Consequências:** o jogo se joga do começo ao fim só com o teclado ou só com o controle. Quem criar um painel precisa passar `autoFocus` (e a varredura acusa um botão sem nome, sem anel ou fora do Tab); quem criar um canvas interativo precisa de `tabIndex`, de uma tecla para cada gesto de ponteiro e de `stopPropagation` nas setas que ele consome (como o `Tabs`). O Firefox ficou sem verificação humana ([OQ-014](open-questions.md)).
- **Status:** Aceita · 2026-11-16

### ADR-026 — Release: sem shell provisório, sem função vazia, e a verificação como script
- **Contexto:** a T079 fecha o marco M4. O `DebugScreenShell` (T005) servia as telas ainda não implementadas e a constituição (§4.3) exige zero uso dele em produção; o REQ-NFR-005 pede ainda zero funções vazias. Deixar o arquivo "atrás de `?debug=1`" (o passo 1 da tarefa) mantinha uma tela provisória ao alcance de quem digitasse o parâmetro e um `ScreenId` sem a garantia de que cada id tem uma tela real. A busca por `TODO`/`FIXME`/`XXX` do `check:placeholders` não via nem o shell nem uma função vazia.
- **Decisão:**
  - **O shell e a cena de demonstração do Canvas (`DebugCanvasDemo`) saem do repositório.** O `ScreenRouter` exporta `SCREEN_COMPONENTS: Record<ScreenId, ComponentType>`: o tipo é total, então um `ScreenId` novo sem tela não compila. O teste do app confere que as chaves são exatamente os `SCREEN_IDS` e que nenhuma tela renderiza um `debug-screen-shell`. O que o `?debug=1` ainda abre é o painel `F9` (por cima das telas reais) e as duas galerias, `?screen=UIKIT` e `?screen=SOUNDBOARD`, que são ferramentas e não telas do jogo.
  - **`check:placeholders` passa a barrar três coisas em `src/`:** `TODO`/`FIXME`/`XXX`, o nome `DebugScreenShell` e, fora dos testes, função de corpo vazio escrita numa linha (`() => {}` e `function f() {}`). Uma função que só tem um comentário passa, como no `no-empty-function` do ESLint; o código de produção não tem nenhuma.
  - **ESLint `@typescript-eslint/no-empty-function` como erro**, que alcança também métodos, construtores e as funções em várias linhas que o script não vê (os construtores só com propriedades de parâmetro passam). O único caso que existia, um `cancelScheduledValues` vazio no mock de áudio, passou a contar as chamadas e o teste confere a contagem.
  - **`test:coverage`:** com a instrumentação do v8 uma tarefa do processamento passou a levar 4,36 ms e reprovou o teste "nenhuma tarefa passa de metade da fatia" (teto de 4 ms). Só nessa execução (`NODE_V8_COVERAGE` definida) o teto sobe para 8 ms, o que ainda deixa a fatia do loop abaixo de 16 ms; sem cobertura o teste segue com 4 ms e o código de produção não mudou.
- **Alternativas descartadas:** manter o shell só com `?debug=1` (a tela continuaria acessível e o tipo não seria total); confiar só no ESLint (ele não vê o nome do shell); uma regra de ESLint própria para o shell (um plugin local para uma palavra); exigir que a cobertura rode com o mesmo orçamento (o orçamento mede o ritmo do jogo, não o código instrumentado).
- **Consequências:** qualquer retorno de placeholder reprova o `npm run verify` antes do commit. O marco M4 fica sem nenhuma tela provisória e o REQ-CORE-007 deixa de citar o shell. A cobertura segue acima dos limites (global ≥ 60 %, `src/domain` e `src/lib` ≥ 90 %; os números estão na T079).
- **Status:** Aceita · 2026-11-16

### ADR-027 — APIs do navegador indisponíveis não derrubam o jogo
- **Contexto:** o teste de entradas aleatórias da T080 não achou nenhum erro em 31 execuções, mas um teste que *tira* APIs do navegador achou três jeitos de o jogo cair ou parar, todos em ambientes reais e nenhum coberto pelos testes: (1) com o `localStorage` bloqueado (cookies bloqueados, iframe sem `allow-same-origin`) só acessá-lo lança `SecurityError`, e como a leitura do save acontece no boot a tela ficava **em branco**; um `getItem` quebrado fazia o mesmo; (2) `navigator.getGamepads()` lança `SecurityError` quando a Permissions Policy bloqueia o controle (o jogo dentro de um iframe de outra origem): o `poll` rodava dentro do `requestAnimationFrame` antes de pedir o próximo quadro, então a exceção **matava o loop** do `InputDriver` e dos motores, e o voo e o mapa paravam; (3) `new AudioContext()` lança sem dispositivo de áudio, e cada tecla ou clique repetia a exceção, porque o `unlock` tentava de novo.
- **Decisão:**
  - **Armazenamento:** `browserStorage()` (`persistence.ts`) devolve o `localStorage` protegido (`getItem` e `removeItem` não lançam) ou, se só acessá-lo lança, um armazenamento vazio que recusa toda gravação. As funções de ler e gravar usam esse padrão; quem grava (`writeSave`, `writeSettings`, `backupSave`) já tratava a recusa, e o `flushSave` já avisava o jogador uma vez por sequência de falhas, então o aviso do primeiro autosave ("Não foi possível salvar") vale também aqui. Um save inválido com a cota cheia não é apagado sem a cópia do backup.
  - **Controle:** `InputManager.readGamepads()` trata a exceção de `getGamepads()` como "sem controle": teclado e mouse seguem valendo e o loop não morre.
  - **Áudio:** `AudioEngine.unlock()` captura a falha de criar o contexto, marca o áudio como indisponível (sem nova tentativa) e o jogo segue mudo (`play` e `startLoop` já eram inertes sem contexto); um `resume()` recusado não vira erro, e o próximo gesto tenta de novo.
- **Alternativas descartadas:** um *fallback* em memória para o save (a sessão se perderia do mesmo jeito ao recarregar e o jogador acharia que está salvo); um aviso no boot além do do autosave (o primeiro autosave vem na primeira troca de tela, a poucos segundos); um `try/catch` em volta de cada loop de jogo (esconderia defeitos de verdade: nenhuma exceção própria apareceu nas 31 execuções, e as de ambiente agora são tratadas na origem).
- **Consequências:** o jogo abre e roda em Firefox ou Chrome com os cookies bloqueados, dentro de um iframe com a Permissions Policy do controle fechada e numa máquina sem saída de áudio, só sem salvar, sem controle ou mudo. Os testes: `persistence`, `storePersistence`, `AudioEngine` e `InputManager` (unidade) e `persistence.spec.ts` e `environment.spec.ts` (E2E); eles falham com o código antigo.
- **Status:** Aceita · 2026-11-16

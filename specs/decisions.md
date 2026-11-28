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
- **Status:** Substituída por ADR-031 · 2026-11-17 (aceita em 2026-11-13)

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

### ADR-028 — Publicação no GitHub Pages: base relativa e um workflow que também é o CI
- **Contexto:** o repositório ganhou o GitHub Pages com a *Source* "GitHub Actions" (`https://kauevestena.github.io/scan_city/`) e não tinha CI nem publicação. O `dist/index.html` apontava para `/assets/...` (caminho absoluto), que dá 404 numa subpasta como `/scan_city/`.
- **Decisão:**
  - **`base: './'` no Vite**: os caminhos do build são relativos, então o mesmo `dist/` roda na raiz (`npm run preview`, os E2E) e em qualquer subpasta, sem amarrar o build ao nome do repositório. Testado servindo o build em `/scan_city` (sem a barra final) no Chromium e no Firefox: assets 200, o jogo abre e o save grava.
  - **Um workflow, `.github/workflows/pages.yml`**: em todo push na `main` e em todo pull request roda `npm ci`, `npm run verify` e `npm run check:assets`; só o push na `main` (ou o disparo manual) empacota o `dist/` e publica com `actions/deploy-pages`. O pull request só valida, então o CI que faltava vem junto. O E2E (≈ 16 min) não entra no caminho da publicação: roda na máquina de quem desenvolve.
  - **O teste de fatias do processamento** (`products.test`, teto de 4 ms por tarefa) sobe para 8 ms também com `CI` definida: é o único teste do `verify` cujo resultado depende do relógio de uma máquina compartilhada e mais lenta, e ele não pode barrar uma publicação.
- **Alternativas descartadas:** `base: '/scan_city/'` (amarra o build ao nome do repositório e quebra o `preview` e os E2E, que servem na raiz); publicar por uma branch `gh-pages` ou pela pasta `docs/` (guarda arquivo gerado no repositório, exige push em outra branch e não passa pelo `verify`); rodar o E2E no deploy (16 minutos no caminho de cada publicação).
- **Consequências:** cada merge na `main` publica a versão que passou no `verify`; um pull request que quebre o `verify` aparece vermelho antes do merge. O jogo publicado aceita os mesmos parâmetros de URL do `npm run preview` (`?debug=1&...`), o que facilita o [QA manual](qa-manual.md) em qualquer máquina. O `localStorage` é por origem (`kauevestena.github.io`), e a chave do save (`scan-city-save`) é própria do jogo.
- **Status:** Aceita · 2026-11-16 (o CI ganha a cobertura, o E2E e o Firefox semanal na ADR-039)

### ADR-029 — A execução do voo vale nota: corredor, nota por amostra, aceitação e revoo
- **Contexto:** depois do release, o primeiro teste com uma pessoa achou o voo, que é o centro do jogo, sem desafio e enfadonho. Uma medição com os 18 contratos e o plano de referência de cada um confirmou: um jogador que **não toca em nenhum controle** é aprovado nos 18 (só aperta `R` para voltar à base em dois); em 13 a nota dele é idêntica à do voo perfeito e nos outros 5 a diferença é de no máximo 0,03; no C02 a aeronave parada deriva 271 m e passa 91 % do tempo fora da faixa com a mesma nota de 0,94; dos 7.983 objetos sólidos dos terrenos, só um alcança a altura de voo do plano; e as missões duram de 3,6 a 12,7 min. O resultado era decidido inteiro no planejamento, e o voo era uma reprise dele.
- **Decisão** (Fase 1 do replanejamento do voo; a variedade por contrato e as transições jogáveis ficam para as Fases 2 e 3):
  - **Corredor de voo.** Cada linha tem portais nos pontos de disparo do plano, com a largura da tolerância lateral e a altura da tolerância de altura de voo. A altitude do corredor segue o relevo (a mesma regra do Terrain Following), então quem voa sem TF acompanha o terreno na mão.
  - **Nota por amostra.** Cada foto automática (e, no LiDAR, cada portal cruzado) recebe uma nota (Perfeita, Boa, Fraca ou Rejeitada), a pior de três eixos: **faixa** (desvio lateral sobre o espaçamento `S`), **altura** (desvio da altitude do corredor sobre `H`) e **avanço** (distância à foto anterior sobre a base `B`). São as grandezas das especificações de execução de voo aerofotogramétrico (desvio da faixa, variação da altura de voo e recobrimento longitudinal), e a foto fora de tolerância é rejeitada como no controle de qualidade de um voo real.
  - **A nota entra na avaliação.** Foto rejeitada não conta na cobertura nem no ajustamento, e fraca conta metade. A execução `E` (0 a 1) da missão multiplica a nota (`0,4 + 0,6·E`), entra no RMSE como multiplicador e rende um bônus de pilotagem no pagamento. Um requisito novo, `MIN_EXECUTION`, reprova a missão com `E` baixa, em todo contrato.
  - **Aceitação da linha e revoo.** A linha só fica concluída se a passada for aceita (nota da passada ≥ 0,5). A linha recusada volta para o fim da fila da surtida e pode ser revoada, gastando bateria.
- **Alternativas descartadas:** penalizar só pela cobertura física (a medição mostrou que a cobertura quase não cai com o desvio, porque as faixas derivam juntas); nota contínua por foto em vez de quatro classes (difícil de ler em voo e de mostrar no relatório); disparo por distância com um portal por foto (tira do jogo a lição de que a velocidade no solo muda a sobreposição, ADR-004); manter a nota e só reduzir o pagamento do voo ruim (o jogador parado continuaria aprovado).
- **Consequências:** o plano continua definindo o teto da qualidade, e a execução decide quanto dele se alcança. Missões sem dado de execução (saves antigos e missões sintéticas de teste) valem `E = 1`, então nada do que já existia muda de nota. O modelo de dados ganha a nota em cada foto e o resumo de cada passada, como campos opcionais: o save continua na versão 1 e os saves antigos seguem válidos, sem migração. A economia da campanha precisa ser conferida com a nota média nova (T089).
- **Status:** Aceita · 2026-11-17

### ADR-030 — Vento em duas partes, velocidade no solo e erro de entrada de faixa
- **Contexto:** o vento era uma senoide lenta projetada só na transversal. Em 7 dos 18 planos de referência o vento fica paralelo às faixas (ou não existe) e não empurrava nada, inclusive no C06, cujo tema é vento cruzado forte; onde empurrava, pedia a tecla segurada a linha inteira. Para a execução valer nota (ADR-029), o ambiente precisa perturbar a aeronave de um jeito que se possa ver, antecipar e corrigir, em qualquer contrato.
- **Decisão:**
  - **Vento médio compensado.** A aeronave já voa compensando o vento médio: na transversal (o *crab* que o HUD mostra, sem deriva constante) e ao longo da linha (mantém a velocidade no solo do plano dentro dos limites de velocidade no ar; fora deles a velocidade no solo fica limitada e o HUD avisa). O vento médio segue custando energia.
  - **Rajadas com seed e com aviso.** De 1 a 3 rajadas por linha, sorteadas pela seed da missão, cada uma com rampa, patamar e direção própria (em torno do vento médio, sempre com pelo menos metade da força na transversal). A rajada empurra de lado e muda a **velocidade no solo** (a parte de proa ou de cauda), o que mexe no avanço das fotos. Um aviso de 1,5 s (alerta com o lado, biruta no HUD e riscos no ar) vem antes de cada uma. Todo contrato tem pelo menos 2 m/s de rajada.
  - **Erro de entrada de faixa.** Cada linha começa com a aeronave deslocada de 30 % a 40 % de `S` para um lado sorteado (limitado ao que a aeronave consegue corrigir até o início da AOI). As fotos da margem de entrada não entram na nota. É o que garante que ninguém conclui uma linha sem pilotar, com qualquer vento.
- **Alternativas descartadas:** manter a deriva constante do vento médio (exige comando contínuo, impede o cruzeiro e não existe com vento paralelo às faixas); rajadas sem aviso (viram sorte); deixar a entrada alinhada e confiar só nas rajadas (a simulação do jogador parado passa em vários contratos, porque o passeio aleatório de 1 a 3 rajadas nem sempre sai da tolerância).
- **Consequências:** `windAt` continua valendo como vento de fundo (HUD, energia e limites de velocidade). `stepAircraft` passa a receber os empurrões das rajadas e a devolver a velocidade no solo; fotos e pulsos usam a velocidade no solo. A regra `STRONG_WIND` dobra o empurrão das rajadas acima da tolerância da aeronave. O texto do REQ-FLT-013 muda.
- **Status:** Aceita · 2026-11-17 (rajadas revisadas na ADR-034)

### ADR-031 — Cruzeiro automático no lugar da aceleração manual (substitui a ADR-020)
- **Contexto:** o `TIME_WARP` manual (×2 e ×4) existia para pular um voo vazio. Com corredor, rajadas e nota, sobram trechos calmos entre os eventos, e acelerá-los na mão seria mais uma tecla sem decisão.
- **Decisão:** o tempo acelera **sozinho** quando a aeronave está estável no corredor (faixa, altura e avanço em Boa ou melhor por 1 s; 1,5 s na versão inicial, mudado na T091) e nada pede atenção (nenhuma rajada ativa ou avisada, nenhum dos motivos de volta a ×1 que já existiam e, sem TF, corredor plano à frente). O fator máximo cresce com a duração da linha (de ×2 a ×6). Volta a ×1 no instante em que uma condição cai. `TIME_WARP` (`T`, `RB`, `R1`) passa a ligar e desligar o cruzeiro; ele começa ligado.
- **Consequências:** precisão vira tempo ganho, e a chegada de uma rajada "desacelera o mundo", o que serve de aviso. O ×8 do autopilot de depuração continua. O REQ-FLT-023 muda de texto.
- **Status:** Aceita · 2026-11-17 (o fator vai até ×4, sobre o ritmo ×1,75 do voo, na ADR-034)

### ADR-032 — O desafio do voo como requisito verificável: pilotos simulados
- **Contexto:** "o voo tem desafio" não é verificável por um teste comum, e foi exatamente o que passou despercebido até uma pessoa jogar.
- **Decisão:** três pilotos simulados voam cada contrato com o plano de referência, pelo motor de verdade e sem render: o **parado** (nenhum comando; só volta à base quando o alarme toca), o **mediano** (reage 0,35 s depois, comanda tudo ou nada como num teclado e, de vez em quando, demora 1 s) e o **bom** (o autopilot de depuração). As metas viram teste automático: o parado é reprovado em todos os contratos; o mediano é aprovado em todos com execução entre 0,5 e 0,9; o bom é aprovado com execução ≥ 0,9. Um script (`npm run qa:flight`) repete com várias seeds e mede o tempo real de cada surtida.
- **Consequências:** o desafio não regride calado: se uma mudança deixar o jogador parado passar, ou o bom falhar, o `verify` quebra. Os valores da Fase 1 (tolerâncias, rajadas, entrada, cruzeiro) são calibrados por essa medição e ficam registrados na T089.
- **Revisão na calibração (T089, 2026-11-20):**
  - **Um quarto piloto, o distraído:** o mediano que só pilota na entrada de cada linha (até 2 s depois do início da AOI) e larga o controle. Com as rajadas da spec inicial (1 a 3 por linha, ~1 m/s de empurrão no C00) ele passaria: o voo exigiria um gesto por linha, que é o tédio que motivou a fase. Ele força as rajadas a importar.
  - **Metas finais:** o parado é reprovado em todos os contratos, com execução abaixo da mínima; o distraído fica pelo menos 0,2 abaixo do mediano em todos e reprova em pelo menos 15 dos 18; o mediano é aprovado em todos com execução ≥ 0,7 e nota média ≥ 0,8 (a da simulação da campanha); o bom é aprovado com execução ≥ 0,9 e nenhuma linha recusada.
  - **O teto de 0,9 do mediano saiu.** O mediano da definição (0,35 s de reação, tudo ou nada, lapsos) é um jogador atento e chega a 0,74–0,97; baixar o modelo dele só para caber no número seria arbitrário. O que separa quem pilota de quem não pilota está nas metas do parado e do distraído.
- **Status:** Aceita · 2026-11-17 (revisada em 2026-11-20 e na ADR-034: pilotos em tempo real, mediano a 0,65)

### ADR-033 — FPS em telas de alta densidade: resolução adaptativa e menos chamadas de desenho
- **Contexto:** o usuário pediu mais FPS antes do teste humano da Fase 1. A ADR-024 mediu a DPR 1, mas o canvas usa o `devicePixelRatio` inteiro. Medido agora (Chromium sem GPU, 1280 × 720, Alta, sem vsync; mediana e p95 de ms por quadro): voo C03 10,8 / 19,9 ms a DPR 1 e **27,2 / 49,3 ms a DPR 2**; R04 10,4 / 20,3 e **29,7 / 48,1**; C01 5,4 / 8,1 e 16,5 / 32,4; mesa (18 setores) 15,6 / 33,7 e 19,2 / 28,3; mapa 1,4 e 5,2. Com vsync de 60 Hz, a DPR 2: C03 ~37 FPS, R04 ~34. O JS do motor fica em 1,5 a 3,6 ms; o resto é rasterização. Num quadro congelado (a pausa segue desenhando o mesmo quadro), desligando uma camada de cada vez, a DPR 1 (C03 / R04 / C01): terreno 4,1 / 4,2 / 3,5 ms, objetos 3,2 / 1,4 / 0,6 ms, céu 0,7 / 0,5 / 1,1 ms; chuva e HUD em DOM, perto de zero.
- **Método:** capacidade (mediana sem vsync, `--disable-frame-rate-limit --disable-gpu-vsync`), FPS com vsync (média de 10 s depois de 10 s de aquecimento, autopilot e `seed=3`) e A/B num quadro congelado, alternando a variante e a base no mesmo quadro (o viés da ordem, medido com uma variante nula, fica em ±3 %). Além do raster por software, o canvas **acelerado** (Chromium com `--use-angle=swiftshader --enable-unsafe-swiftshader --enable-gpu-rasterization --ignore-gpu-blocklist`, que reporta `2d_canvas: enabled`) aproxima o caminho de GPU do Skia, onde cada chamada de desenho pesa mais que cada pixel; os tempos absolutos dele não valem (a GPU é emulada), só a comparação.
- **Decisão:**
  1. **Resolução adaptativa no voo e na mesa** (`RenderScaleGovernor`, `useCanvas(ref, { kind, floor })`): a escala do buffer começa no teto da qualidade (Alta: o DPR da tela; Média: até 1,5; Baixa: até 1) e cai um degrau (× 0,8) quando uma janela de 1,5 s fecha abaixo de 54 FPS; com 3 s seguidos a 58 FPS ou mais, sobe um degrau; uma subida que não se segura volta e dobra a espera da próxima (até 1 min). **Uma descida só fica se ajudou:** se a janela seguinte não ganha 5 % de FPS (o navegador limitado a 30 Hz pela economia de energia, ou o gargalo no JS), a escala volta e as descidas param por 30 s. Piso: 0,75 no voo; 1 na mesa, que abaixo disso já tem a queda de qualidade dela (holo-table §5.7). A escala que se segurou fica lembrada na sessão (a próxima visita começa nela), subir a qualidade leva a escala ao teto novo, o canvas marca a escala em `data-render-scale` e o painel F9 a mostra. O HUD é DOM e segue nítido; trocar só a escala não reinicia a chuva do voo.
  2. **Quads vizinhos de mesma cor de uma faixa num polígono só** (`QuadStrip`, um contorno, não vários como o lote descartado na ADR-024): numa cena real a cor quantizada se repete muito (C03: 1.859 quads viram 223 trechos; R04: 2.108 viram 79; C01: 1.967 viram 285). Com o canvas acelerado, tirar a fusão deixa o quadro mais lento em todas as cenas medidas: C01 2,1 → 4,5 ms (+114 %), C03 5,7 → 7,1 ms (+25 %), R04 4,0 → 4,3 ms (+8 %). No raster por software o efeito fica entre neutro (DPR 2, ±3 %) e um custo pequeno a DPR 1 (C01 e C03, 5 % a 19 %, com folga: ~90 FPS de capacidade). Como o Chrome rasteriza o canvas na GPU onde há uma, a fusão fica. Por dentro do trecho não há emenda; o brilho da água espera o fim da faixa.
- **Decisão (avaliadas e não adotadas, com a medição):**
  - **Névoa só onde o terreno não chega** (o céu pintava a névoa na metade de baixo inteira e o terreno pintava por cima): no A/B do quadro congelado, sem diferença além do ruído a DPR 2 (−2 % a +3 %) e nenhum ganho a DPR 1. Saiu, para não arriscar fresta.
  - **Detalhe por tamanho nas árvores** (tronco e sombra só acima de alguns px): numa cena da C03 a mediana do raio das copas é 10 px (p25 7 px) e nenhuma passa de 1,5 px: quase nada a cortar.
- **Resultados** (Chromium sem GPU, 1280 × 720, Alta, vsync de 60 Hz, média de 10 s; a escala é a que o governador escolheu):

| Cena | DPR 1 | DPR 1,5 | DPR 2 (antes) | DPR 2 (depois) |
| :--- | :---: | :---: | :---: | :---: |
| Voo C01 | 60,1 (×1) | 60,0 (×1,5) | 60,6 de capacidade (16,5 ms) | 60,0 (×2) |
| Voo C03 | 58,6 (×1) | 54,2 (×0,75) | ~37 | 57,0 (×0,82) |
| Voo R04 | 59,3 (×1) | 55,6 (×0,96) | ~34 | 57,4 (×0,82) |
| Mesa (18 setores) | 54,2 a 58,3 (×1, Alta) | 55,9 (×1,5, Média) | 52,1 de capacidade (19,2 ms) | 56,5 (×1,28, Média) |

  O voo nas DPR 1,5 e 2 e a C03 e a R04 a DPR 1 são da versão final do governador (54 e 58 FPS); C01 e a mesa vêm de uma rodada anterior, com 50 e 57 FPS, em que o voo da C01 não desceu da escala cheia e a mesa usou a mesma queda de qualidade.

- **Consequências:** em telas de alta densidade o voo e a mesa trocam nitidez do canvas por quadros, sozinhos, e voltam a subir quando sobra folga; a DPR 1 nada muda (a escala fica em 1). Neste ambiente sem GPU, a DPR 1,5 a C03 para em ~54 FPS mesmo no piso: a composição da tela inteira em 1920 × 1080 é feita por software e não depende da escala do canvas (numa máquina com GPU ela é barata). A mesa a DPR 1 continua oscilando entre 54 e 58 FPS aqui, como na T077; o teste com GPU fica no roteiro ([qa-manual §4](qa-manual.md)), que agora pede para anotar a escala do F9.
- **Status:** Aceita · 2026-11-21

### ADR-034 — Voo mais rápido, rajadas só visuais com contragolpe, atmosfera épica e degraus de detalhe
- **Contexto:** o jogador testou a Fase 1 e achou que o voo acertou no desafio (os portais flutuantes "são incríveis"), mas ficou **lento e fácil demais**. Pediu: mais velocidade; rajadas avisadas só por pistas visuais, para reagir mais rápido, "como um tempo perfeito"; um visual mais épico, no espírito de um voo montado sobre nuvens; mais FPS em máquina **sem GPU** (ou com o navegador sem aceleração); e um mini-game da IMU mais fácil, porque o guia era rápido e saía do quadro. A medição confirmou: o piloto mediano tinha execução de 0,84 a 0,97 em quase todo contrato e cada surtida levava de 3 a 11 minutos reais; o voo ia a 47 FPS na C03 e 53 na R04 (Chromium sem GPU, DPR 1, vsync); e o canvas da IMU desenhava em 480 × 300 fixos dentro de um painel de ~310 px de largura, então o "8" saía da tela.
- **Decisão:**
  1. **Ritmo do voo ×1,75** (`FLIGHT_TEMPO`, `engines/flight/tempo.ts`): na decolagem e nas linhas, o tempo simulado corre 1,75 vez o real; a física, as fotos, a energia e as notas não mudam (tudo é medido em tempo simulado), só o mundo passa mais rápido e sobra menos tempo real para reagir. A curva (com o boletim), o pouso, o retorno e a queda ficam em ×1. O cruzeiro multiplica por cima, agora até ×4 (o fator máximo vem da duração **real** da linha), e cai 0,5 s (simulado) antes de cada frente de vento aparecer: a rajada chega sempre no ritmo base. Os efeitos de tela (flash, pegadas, piscar do portal) e a janela de confirmação do RTH correm num relógio de tempo real. ×2 foi medido e descartado: o piloto mediano caía a 0,53–0,73 e reprovava; ×1,5 deixava o mediano em 0,66–0,82, mas com pouco ganho de ritmo.
  2. **Rajadas mais curtas, frequentes e fortes:** uma a cada 7 s de linha (até 9), rampa de 0,25 s, patamar de 1,2 a 2 s, pico `max(5, rajada + 3)·U(0,8, 1,3)`. Numa passada, as rajadas vêm de uma direção só: a do vento médio (±50°) ou, sem vento, uma sorteada para a passada; e as quase paralelas à linha tombam para o mesmo lado (o do vento, ou um sorteado). Sem isso, com vento paralelo às faixas ou sem vento (R07, R10), os empurrões se anulavam para quem larga o controle.
  3. **Aviso só visual:** sai o alerta "RAJADA ▶ em 1,2 s" e a biruta deixa de reagir ao aviso (só ao sopro). O aviso é uma **frente de vento** na cena: uma cortina translúcida paralela à linha, com riscos de vento, que parte a 80 m do lado de onde a rajada vem e varre a paisagem até chegar à aeronave no instante do empurrão (1,5 s simulados, ~0,86 s reais).
  4. **Contragolpe ("tempo perfeito"):** o **começo** de um comando lateral contra a rajada (|MOVE_X| > 0,5) entre 0,3 s antes e 0,2 s depois da chegada (simulados; 0,29 s reais no ritmo ×1,75) corta a rajada: ela empurra só 20 %. Antes da janela é "CEDO", depois "TARDE" (até 1 s), e quem não reage leva o empurrão inteiro. Segurar desde antes da frente não vale como começo. A marca "NO TEMPO!", "CEDO" ou "TARDE" aparece ao lado da aeronave; a rajada cortada toca `GUST_CUT` e desenha um arco claro do lado de onde veio; a que bate sem contragolpe toca `GUST_HIT` e dá um tranco lateral na tela (nada disso com "Reduzir flashes e tremores", exceto o som e a marca, que só some).
  5. **Pilotos simulados (ADR-032) em tempo real:** o atraso de 0,35 s, os lapsos e a nova antecipação do mediano são tempo real (no ritmo ×1,75, 0,35 s são 0,61 s simulados). O mediano agora antecipa a faixa e a altura em 0,15 s pela velocidade com que se aproxima delas (segurar até ver o cruzamento passaria da faixa inteira nesse ritmo) e tenta o contragolpe em cada frente com erro normal de +80 ± 150 ms (acerta cerca de metade). O distraído não faz contragolpe. O bom (autopilot) segura o comando contra a rajada abaixo do limiar até 0,1 s antes da chegada e então o dá inteiro: acerta todas. **A meta de execução do mediano cai de 0,7 para 0,65** (ele fica entre 0,68 e 0,96 em 3 sementes, aprovado em 54 de 54; o mínimo dos contratos é 0,6). As outras metas não mudam.
  6. **Atmosfera épica no Canvas 2D:** o céu é pintado **uma vez** num bitmap (gradiente em camadas, brilho e raios do sol, nuvens altas e um mar de nuvens no horizonte) e copiado a cada quadro em pixels inteiros do buffer (um deslocamento fracionário reamostrava a tela toda: 7 ms); a decolagem só desloca a cópia. Depois do relevo, uma névoa funde o horizonte no mar de nuvens. Nuvens baixas, fixas no mundo, passam por cima da aeronave; riscos de velocidade saem do ponto de fuga quando o mundo passa rápido; rastros claros saem das pontas das asas; os portais mais perto ganham um halo e o próximo pulsa com o losango aceso; a câmera **inclina** até 5° com a velocidade lateral; uma vinheta escurece as bordas de cima e de baixo. A inclinação e o tranco somem com "Reduzir flashes e tremores".
  7. **FPS sem GPU:** (a) o canvas do voo é **opaco** (`alpha: false`): o navegador não mistura o canvas com a página; (b) a lista de objetos à vista parte do intervalo de `u` coberto pelo trapézio visível (numa linha ao longo de `u`, a mata de 4 mil copas não é percorrida inteira por quadro): os objetos da C03 caíram de 3,2 para 1,75 ms; (c) **degraus de detalhe** (`detailLevel.ts`), com o mesmo governador da resolução adaptativa (ADR-033): 3 = tudo; 2 = sem a inclinação da câmera; 1 = também sem nuvens baixas e vinheta; 0 = também com o relevo um nível de qualidade abaixo. O teto é a qualidade escolhida (Alta 3, Média 2, Baixa 1); o degrau que se segurou fica lembrado na sessão e o F9 o mostra. A inclinação vem primeiro porque, no raster por software, girar a cena transforma milhares de retângulos (troncos) em polígonos: 7 ms na C03.
  8. **IMU:** o desenho escala para caber no canvas do painel (o bug do quadro), com 2 s de preparação (o guia espera e nada conta), 2 voltas em 20 s (eram 12), um halo da zona boa em volta do guia e `imuScore = clamp(1 − mean(d)/60)` (eram 40 px). O nivelamento ganhou a mesma escala.
- **Método:** os pilotos simulados com 3 sementes (`npm run qa:flight`) para cada ajuste de ritmo e de rajada; FPS no Chromium sem GPU (1280 × 720, autopilot, `seed=3`), com vsync (média de 8 s depois de 8 s) e sem vsync, e A/B de cada efeito com a escala do buffer presa em 1 (chaves temporárias que não entraram no código).
- **Resultados** (Chromium sem GPU, vsync de 60 Hz, FPS médio):

| Cena | Antes, DPR 1 | Depois, DPR 1 | Antes, DPR 2 | Depois, DPR 2 |
| :--- | :-: | :-: | :-: | :-: |
| Voo C01 | 60,1 | 58,8 | — | — |
| Voo C03 | 47,3 | 56,1 | 47,1 | 53,8 |
| Voo R04 | 52,6 | 58,0 | — | 54,8 |

  JS do motor na C03 (F9, autopilot ×8): 9,4 → 6,0 ms. Pilotos (3 sementes): parado 0/54 aprovados; distraído 3/54; mediano 54/54 com execução de 0,68 a 0,96; bom 54/54 com 0,95 a 1,00 e nenhuma linha recusada. A surtida do mediano caiu de 0,76–10,3 para 0,45–6,7 minutos reais.
- **Alternativas descartadas:** ritmo ×2 (o mediano reprova); aviso escrito mais curto (continuaria sendo texto, e o pedido é de pista visual); contragolpe que anula a rajada inteira (o toque de 0,1 s, que anda de lado, sairia sempre melhor que segurar no meio); inclinação da câmera só no céu (o relevo girado sem o céu desencontra o horizonte, e o custo está no relevo); céu redesenhado a cada quadro (mais caro que a cópia em pixels inteiros).
- **Consequências:** o voo é mais rápido e mais difícil, e o que separa um bom jogador de um mediano agora inclui o tempo do contragolpe. O modelo de dados e o save não mudam. As metas do desafio continuam no `verify` com o mediano a 0,65. Numa máquina sem GPU, os efeitos caros saem sozinhos em poucos segundos (o jogador vê o degrau no F9); com GPU, tudo fica. O REQ-FLT-013, o REQ-FLT-023 e o REQ-FLD-011 mudam de texto.
- **Status:** Aceita · 2026-11-25

### ADR-035 — Vento vertical, troca de faixa na mão, três dificuldades, voo mais alto e chão sem quadrados
- **Contexto:** o jogador testou o voo da ADR-034 e pediu, para o voo de levantamento: (1) **rajadas e ventos verticais**, para mais desafio; (2) a faixa de movimento vertical parecia pequena demais; (3) a **segunda missão (C01) era impossível** com o Atlas: os prédios iam a 90 m, o Atlas só subia a 80 m (e o GSD de 3,5 cm do contrato o limita a 83 m), então ele batia e se machucava; e 80 m de teto é pouco; (4) **três dificuldades**, escolhidas antes do voo: a fácil mais lenta e só com vento horizontal, pagando menos; a média no ritmo atual, com vento vertical de vez em quando, sem bônus (o padrão); a difícil mais rápida, com vento vertical frequente, pagando mais; (5) a **troca de faixa não pode ser automática**: o jogador faz a manobra, `W`+`E`+`D` segurados à direita (`W`+`A`+`Q` à esquerda), ou a sequência `D` → `E` → `W` (alguns teclados não registram três teclas juntas), numa janela de interação mais curta na difícil; no controle, junto; (6) **quadrados pixelados, em geral marrons, no solo**; (7) o Atlas mais "badass" e fofo, num PR separado (T097). A medição confirmou o (3): com o Atlas, o `predictRequirements` do C01 passa em tudo de H 60 a 83 m (GSD 2,52 a 3,49 cm) e só os prédios barravam. A tela confirmou o (2): a câmera ficava presa 12 m acima da aeronave, que nunca saía do lugar no quadro (só o chão se afastava), e o (6): cada quad do terreno tinha a cor de um canto só, então estradas e manchas de solo viravam escadas de quadrados (estradas finas, pontos soltos).
- **Decisão:**
  1. **Rajadas verticais** (`gusts.ts`): uma parte das rajadas (20 % na média, 45 % na difícil, nenhuma na fácil) sobe ou desce, com a mesma força das de lado, e nunca em cima de uma corrente vertical (as verticais saem das que não cruzam nenhuma, com a chance ajustada para a fração da passada). A frente é uma lâmina horizontal que desce do céu ou sobe do chão e chega à altitude da aeronave no instante do empurrão; o contragolpe é o começo de `Q` contra a que desce ou de `E` contra a que sobe, na mesma janela de 0,5 s simulados. O tranco da tela é vertical e o arco do corte fica em cima ou embaixo.
  2. **Correntes verticais** (o "vento vertical"): uma a cada 22 s de linha na média e 13 s na difícil, com rampa de 0,8 s, patamar de 2,5 a 4 s e 2 a 3,5 m/s, sem contragolpe: pedem `Q`/`E` enquanto duram (com Terrain Following, o laço do TF corrige). Riscos verticais lentos aparecem 1 s antes. Numa passada, as correntes e as rajadas verticais vão **para o mesmo lado**, como as de lado na ADR-034 (senão se anulam para quem larga o controle).
  3. **Movimento vertical:** as razões de subida crescem (Atlas 3 → 5, T1 4 → 6, T2 5 → 7, VTOL 4 → 6 m/s), o Atlas sobe até 120 m, e a câmera segue a altitude com 0,35 s de atraso (no máximo 4 m): subir e descer aparecem na tela, até ~120 px.
  4. **C01 viável com o Atlas:** prédios de `10 + 55·r³` (10–65 m), 25 % altos (46–64 m), o mais alto da AOI com 65 m, e o cânion RTK acima de 45 m (era 60). O Atlas a 80 m (GSD 3,36 cm) passa 15 m acima do mais alto; o plano de referência do T1 (H 110) não muda.
  5. **Dificuldade** (`difficulty.ts`, escolhida no checklist, gravada em `MissionData.difficulty`, ausente = média): ritmo ×1,3 / ×1,75 / ×2,1; uma rajada a cada 7 / 7 / 5,5 s; verticais 0 / 20 / 45 %; correntes — / 22 / 13 s; janela da curva 0,9 e 0,6 / 0,45 e 0,3 / 0,25 e 0,15 s antes e depois do portal; pagamento ×0,8 / ×1 / ×1,25 (o fator `D` de domain-math §12.1, uma linha no detalhamento). Campo opcional: o save fica na versão 1, sem migração.
  6. **Troca de faixa na mão** (`turnManeuver.ts`, puro): quando os dados da linha fecham (`aoiEndS + B`), a curva arma: uma seta âmbar (o **portal da curva**) aponta o lado da próxima faixa, no fim da linha ou, com lead-out curto, até 1,5 s (reais) depois do fim dos dados; o HUD mostra as teclas e a barra da janela. A manobra é o acorde (os três toques juntos, contando o último que desce) ou a sequência lado → tecla da curva → frente (até 0,6 s entre os toques); no controle, o analógico para a frente e para o lado e o gatilho do lado (`RT` à direita: no teclado a tecla da curva é a de cima do lado, `E` sobre o `D`). Julgada uma vez: no tempo, a curva; cedo, do lado errado ou tarde, a **arremetida** (2 s, a energia da volta) e a volta ao portal; na terceira seguida, **retorno automático** à base (o failsafe de quem não comanda). O cruzeiro cai 3,5 s antes do fim da linha. O piloto bom faz o acorde no centro da janela; os pilotos simulados mediano e distraído o fazem mirando o portal com o mesmo erro do contragolpe (N(80 ms, 150 ms)).
  7. **Chão sem quadrados:** no quad de cantos mistos, a base é a cobertura da maioria e cada canto diferente vira um pedaço cortado nos meios das arestas (triângulo, ou meio quad para dois cantos vizinhos): a divisa fica em diagonal, sem escada; nos quads finos de longe (< 6 px), a média das cores. As **estradas** viram faixas contínuas pelas polilinhas, faixa do terreno a faixa (por cima do chão, antes dos objetos), e a grade pinta a cobertura sob elas (`groundCoverAt`).
- **Alternativas descartadas:** rajada vertical ×1,3 mais forte que a de lado (a tolerância de altura, em fração de `H`, é maior que a de faixa): na R07, na penumbra, descer encolhe o GSD e borra as fotos, e o mediano caiu a 0,63; rajadas e correntes verticais para lados sorteados (na R07 o distraído ficava a 0,06 do mediano); sortear a rajada vertical sem olhar as correntes e só então tirar as que caem em cima de uma (na difícil isso devolvia 68 % das verticais para o lado, e a difícil ficava com menos rajadas verticais que a média; a chance agora é ajustada sobre as livres); deixar a rajada vertical cair em cima da corrente do mesmo lado (o tranco somado afundava a aeronave: na R07, na penumbra, o mediano caiu a 0,65 pelo blur, com o distraído a 0,55); troca de faixa automática depois de um prazo (o pedido é que não seja automática; o retorno automático depois de três curvas perdidas encerra a surtida, como um failsafe de drone); manobra cedo ignorada sem penalidade (quem martela o acorde sempre acertaria a janela); julgar a manobra antes de os dados fecharem (`W`, `D` e `E` das correções do voo formariam acordes sem querer); câmera presa à altitude do corredor (a aeronave sairia do quadro nos desvios grandes); gradiente de cor por quad (o Canvas 2D não interpola cor por vértice, e um gradiente por quad são milhares de objetos por quadro); média das cores em todo quad misto (blocos borrados perto da câmera).
- **Resultados** (pilotos simulados, `npm run qa:flight`): na média, com 3 sementes, o parado aprova 0 de 54 (execução de 0,00 a 0,18); o distraído 3 de 54 (de 0,00 a 0,57); o mediano 54 de 54, de 0,73 a 0,96, com a surtida de 0,54 a 7,1 minutos reais; o bom 54 de 54, de 0,98 a 1,00 e nenhuma linha recusada. Na fácil (1 semente): o mediano 18 de 18, de 0,79 a 0,98. Na difícil (1 semente): o mediano 17 de 18, de 0,52 a 0,93 (a C05, na fiação baixa, fica abaixo do mínimo); o bom 18 de 18, de 0,99 a 1,00. No Chromium sem GPU (1280 × 720, DPR 1), C00, C01, C02, C04 e C05 seguem a 60 FPS com os pedaços e as estradas.
- **Consequências:** o voo pede a mão também no eixo vertical e na curva, e a dificuldade escala o desafio (e o pagamento) pela escolha do jogador. O mediano das metas (ADR-032) voa na média e as metas não mudam. O REQ-FLT-004, 005, 013, 022 e 023 mudam de texto; entram o REQ-FLT-030 (dificuldade) e o REQ-FLT-031 (troca de faixa). A curva e a arremetida somam alguns segundos de voo por linha (o portal pode ficar além do fim da linha).
- **Status:** Aceita · 2026-11-27

### ADR-036 — Souvenirs que se examinam: objetos desenhados, a caderneta que se folheia e a letra à mão
- **Contexto:** o jogador pediu que a Estante de Relíquias guardasse souvenirs **de verdade**: a Caderneta de Campo do Avô deve abrir e deixar ver as páginas, com inscrições engraçadas, como ao abrir um livro no *Red Dead Redemption II* (a referência de design: o diário em papel envelhecido, a letra à mão, os esboços a lápis e o virar das páginas; o nome só aparece nas specs). Até a T097, cada souvenir era um ícone lucide e duas frases (`story`) no painel lateral, e a estante da sala desenhava uma bolinha colorida por souvenir.
- **Decisão:**
  1. **Forma e faces.** Cada souvenir ganha uma forma (`form`): `OBJECT`, um objeto que se vira nas mãos, ou `BOOK`, um caderno que se folheia; e as faces (`faces`), na ordem: a primeira é o objeto (no caderno, a capa); as outras são o que se lê nele (verso gravado, etiqueta com barbante, placa de latão, bilhete dobrado, certificado, etiqueta de amostra, croqui antigo; no caderno, as páginas e a contracapa). O texto das faces fica em `src/data`, em blocos (título, texto com ~~riscado~~ e sublinhado, lista, tabela de caderneta de campo, esboço, assinatura, carimbo); o desenho fica em `engines/souvenir`.
  2. **O exame** é um diálogo de tela cheia: a face desenhada em Canvas sobre uma mesa de madeira à luz de um abajur, com o nome, a origem (cliente e contrato), a história e o contador de páginas em DOM. O caderno aparece fechado (a capa no centro), abre em páginas duplas e termina na contracapa fechada; o objeto fica sozinho no centro, flutuando de leve. Virar a página é a folha girando em torno da lombada (escala horizontal pelo cosseno do ângulo, sombra na dobra e na página de baixo, e o caderno deslizando para o centro ao abrir e ao fechar); virar o objeto é a mesma escala em torno do centro. Com `prefers-reduced-motion`, um esmaecimento de 160 ms no lugar do giro e o objeto parado.
  3. **Controles:** `←`/`→` e `Q`/`E` no teclado; D-pad, analógico e `LB`/`RB` no controle; clique na metade esquerda ou direita do desenho e os botões **Anterior** e **Próxima** no mouse. `Enter`/`Espaço` sem botão focado e `A`/`✕` avançam; `Esc`/`Backspace` e `B`/`○` fecham e devolvem o foco a quem abriu. As setas viram a página em vez de mover o foco: o diálogo tem a sua camada de input (modal), com a mesma armadilha de foco do `Modal` do kit (o foco entra, o `Tab` não escapa e volta ao fechar), que passa a ser um hook compartilhado. Cada virada toca `PAGE_TURN`, um ruído de papel sintetizado.
  4. **Letra à mão sem fonte externa.** A constituição proíbe fontes web, então o texto usa a primeira fonte manuscrita **instalada** de uma lista (Segoe Print e Ink Free no Windows; Bradley Hand, Noteworthy e Chalkboard SE no macOS; Z003 e URW Chancery L no Linux), detectada pela largura do texto medida contra a da fonte genérica; sem nenhuma, uma serifada itálica (Georgia, Times New Roman, Liberation Serif). Cada letra sai com um tremor seedado (rotação de até ±2,5°, linha de base ±0,6 px, tamanho ±4 %, tinta de 0,8 a 0,95 de opacidade) e a linha inteira com uma inclinação pequena, então até a serifada parece escrita. Tudo é determinístico (seed = id do souvenir + face, pelo PRNG do projeto) e cada face é desenhada uma vez num bitmap, na resolução da tela.
  5. **A carta do Vô.** O final já dizia que a carta estava "entre as folhas da caderneta velha". Depois dele (`flags.finaleSeen`), a contracapa interna da caderneta mostra a carta dobrada, com o texto canônico (`FINALE_LETTER`); antes, um bolso de papel com um aviso. O número de páginas não muda: as duas versões da contracapa são excludentes.
  6. **A estante mostra os objetos.** A grade do painel, o card de souvenir do relatório e a estante da sala desenham a miniatura do objeto (o mesmo desenho da primeira face, em escala) no lugar do ícone e da bolinha. A sala guarda a estante num bitmap e só o refaz quando muda a coleção ou a escala: nenhum gradiente novo a cada quadro (como na T097). O card do relatório ganha **Examinar**, para a caderneta poder ser aberta na hora em que o Zé Bento a entrega.
  7. **Acessibilidade:** o canvas tem o rótulo da face (`role="img"`), o texto inteiro da face fica numa região viva visualmente escondida e o contador ("Página 3 de 8") é texto; os botões têm nome e anel de foco.
  8. **Guarda de conteúdo (constitution §6).** Os objetos das fendas são motivos genéricos: anel dourado, cano verde, esfera laranja com brilhos (sem estrelas vermelhas), uma placa triangular com a rede de triangulação gravada, um bloco cúbico de rocha com veios, uma caixa de papelão, uma bicicletinha, um boné, uma escotilha redonda, uma pistola de tinta; nenhum copia o desenho característico de um item de franquia. As inscrições são textuais e paródicas, e a lista do `check:terms` ganha o nome do jogo de faroeste e o do protagonista dele.
- **Alternativas descartadas:** páginas em DOM com virada em CSS 3D (a folha que gira tem esboços em Canvas, e a letra com tremor seria um `<span>` por letra, milhares por página); uma fonte manuscrita embutida em base64 (é fonte externa, proibida); um alfabeto vetorial próprio, à moda das fontes de plotter (centenas de glifos com acento para pouco ganho sobre o tremor); o `Modal` do kit como está (o cabeçalho e o painel não servem para a tela cheia, e nele as setas movem o foco); detectar a fonte por `document.fonts.check` (responde `true` para qualquer fonte do sistema, instalada ou não); só a caderneta examinável (os outros 17 seguiriam sendo ícones, e o pedido é de souvenirs de verdade).
- **Consequências:** `Souvenir` ganha `form` e `faces` (data-model §3); o save não muda (a coleção segue como ids). Entram o efeito `PAGE_TURN`, o REQ-OFF-008 (examinar), o parâmetro de depuração `souvenirs=1` (os 18 na estante, para o roteiro de QA) e a seção office §5.1. O REQ-OFF-006 troca o "ícone" pela miniatura. A aparência da letra depende das fontes da máquina: o roteiro de QA pede uma olhada no Windows e no macOS.
- **Status:** Aceita · 2026-11-27

### ADR-037 — Telas mais largas que 16:9: o foco do voo é limitado pela altura
- **Contexto:** num monitor ultrawide (21:9), o foco calculado pelo FOV horizontal (`focalPx = (W/2)/tan(35°)`) crescia com a largura e ampliava a cena inteira: a aeronave, desenhada abaixo do horizonte, saía pela borda de baixo da tela. A correção entrou no commit `8ab9413`, fora do protocolo (sem tarefa nem ADR), e a [survey-flight §5.1](features/survey-flight.md) continuou com a fórmula antiga. Esta ADR registra o que já está no código; o comportamento não muda.
- **Decisão:** `focalPx = (min(W, H · 16/9) / 2) / tan(35°)` (`REFERENCE_ASPECT = 16/9` em `engines/flight/projection.ts`). Até 16:9 nada muda (o FOV horizontal segue em 70°). Mais largo que isso, o enquadramento vertical fica o do 16:9 na mesma altura, e a largura que sobra mostra mais cenário dos lados.
- **Consequências:** a aeronave fica na tela em qualquer proporção. O REQ-NFR-004 continua pedindo a UI de 1280 × 720 a 1920 × 1080; as telas mais largas são suportadas no voo, sem E2E próprio. O teste `projection.test.ts` cobre o foco em 16:9 e em 21:9. Registrado na T099.
- **Status:** Aceita · 2026-11-28 (o código é de 2026-11-27)

### ADR-038 — O mini-game é a camada de input do topo, e o Voltar o interrompe
- **Contexto:** o commit `b83ad75` quis que o D-pad e o analógico movessem o cursor dos mini-games da calibração chamando `useInputContext('MINIGAME')`. Isso troca só o contexto **da tela**, mas o `FieldSetupScreen` empilha uma camada de foco no contexto `FIELD`, e o contexto efetivo do `InputManager` é o da camada do topo. Com a bolha ou a lemniscata abertas, então: o D-pad e as setas moviam o foco da tela; o `B` e o `Esc` voltavam uma aba e desmontavam o jogo no meio; e o analógico movia o cursor **e** o mapa de satélite, que fica visível em todas as abas e lê o `MOVE` a cada quadro (achado da T099).
- **Decisão:**
  - Cada mini-game, enquanto montado, empilha a própria camada `MINIGAME` (`useMinigameLayer` em `CalibrationTab.tsx`). Nela, o analógico esquerdo, o D-pad, o WASD e as setas são o `MOVE` do jogo; não há navegação de foco nem troca de aba.
  - `Voltar` (`Esc`, `B`, `○`) **interrompe** o jogo sem pontuar: a nota guardada não muda, a tela segue na aba da calibração e o foco volta ao botão do jogo. É o que o jogador espera de um "voltar" no meio do jogo, em vez de perder a aba.
  - Quando o jogo termina ou é interrompido, o foco volta ao botão que o abriu, se não tiver ido para outro lugar (a regra do `autoFocus` da navegação de foco).
  - O mapa de satélite só ouve o `MOVE` e o `ZOOM` quando o contexto efetivo é `FIELD`: com um mini-game ou um modal por cima, ele fica parado.
  - A pausa (`M`, Menu, Options) não passa pelas camadas e segue valendo durante o jogo.
- **Alternativas descartadas:** deixar só o analógico e o mouse moverem o cursor (é o mínimo da field-setup §5.4, mas contradiz o contexto `MINIGAME`, que liga o D-pad e as setas, e mantém o mapa andando junto com a bolha); mudar o contexto da camada `FIELD` enquanto há jogo (acopla a tela ao estado de dentro da aba).
- **Consequências:** o `useInputContext('MINIGAME')` sai dos mini-games; o contexto `MINIGAME` passa a ser sempre uma camada. Os testes de `CalibrationTab.test.tsx` e de `FieldSetupScreen.test.tsx` cobrem o D-pad, as setas, o analógico, o `B`, o `Esc` sem pausa, o foco de volta e o mapa parado; os cinco de comportamento falham no código de antes. Registrado na T103.
- **Status:** Aceita · 2026-11-28

### ADR-039 — CI com cobertura, E2E que barra a publicação e Firefox toda semana
- **Contexto:** a avaliação da T099 achou dois portões da Definition of Done fora do CI. O `verify` rodava o `test` e não o `test:coverage`, então os limites do REQ-NFR-003 (≥ 90 % em `src/domain` e `src/lib`, ≥ 60 % no todo) foram medidos pela última vez na T079, 19 tarefas antes. E a suíte Playwright (137 testes, ~18 min no Chromium) só rodava quando alguém se lembrava dela, assim como o Firefox do REQ-NFR-009.
- **Decisão:**
  - **Cobertura no `verify`.** O `verify` troca o `test` pelo `test:coverage`: os limites valem em todo commit, na máquina e no CI. Custa ~85 s a mais (de ~151 para ~236 s num contêiner de 4 núcleos). O único teste de relógio, `products.test.ts`, já relaxa o teto com `NODE_V8_COVERAGE` ou `CI` (ADR-028).
  - **Job `e2e` no `pages.yml`**, em paralelo ao `build`, em todo pull request, todo push na `main` e no disparo manual: `npm ci`, `npx playwright install --with-deps chromium` e `npm run e2e`. Se falhar, guarda `playwright-report/` e `test-results/` por 14 dias.
  - **A publicação espera os dois jobs** (`deploy` com `needs: [build, e2e]`): nenhuma versão vai ao ar sem a suíte E2E verde. O preço é ~20 min a mais entre o merge e o site novo.
  - **Só a `main` publica.** O empacotamento e o `deploy` exigem `github.ref == 'refs/heads/main'`; o disparo manual em outra branch só valida (antes, ele publicaria a branch).
  - **No CI, o Playwright** tenta de novo uma vez cada teste que falha (o relatório marca o teste como *flaky*, em vez de escondê-lo), escreve o relatório HTML e tira a captura de tela das falhas. Na máquina local nada muda (`retries: 0`, só a lista).
  - **Firefox toda semana** (`e2e-firefox.yml`): segunda-feira às 07:17 UTC e no disparo manual, a mesma suíte com `npm run e2e:firefox`. Não publica nem barra a publicação; uma falha aparece na aba Actions com o relatório.
- **Alternativas descartadas:** rodar a cobertura só no CI, com o `verify` local sem ela (o `verify` deixaria de ser "o que cada commit precisa passar"); E2E só agendado, sem barrar a publicação (deixaria a regressão chegar ao site); Firefox em todo pull request (mais ~22 min por PR, para um navegador que a suíte já passou inteiro na T083).
- **Consequências:** o REQ-NFR-003 e o REQ-NFR-009 passam a ser conferidos pelo CI. Um teste E2E instável que falhe duas vezes barra a publicação até ser consertado (nunca pulado). O CI novo só roda num pull request ou na `main`. Registrado na T104.
- **Status:** Aceita · 2026-11-28

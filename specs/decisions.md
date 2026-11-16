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

# Conteúdo — Campanha Principal: Contratos do Mundo Real

> Dados normativos para `src/data/contracts/real.ts` e para as regras em `src/data/specialRules.ts`. Os diálogos aqui são **canônicos**: o implementador pode expandi-los mantendo o sentido, com no máximo 4 linhas por bloco.
>
> **Requisitos cobertos:** REQ-CNT-001, REQ-CNT-003, REQ-CNT-004, REQ-CNT-005, REQ-CNT-007, REQ-CNT-008, REQ-FLT-021, REQ-FLT-022, REQ-FLT-024, REQ-PRC-013.

---

## 1. Catálogo de regras especiais (`SpecialRuleId`)

| Regra | Onde atua | Comportamento normativo |
| :--- | :--- | :--- |
| `URBAN_CANYON_RTK_LOSS` | Terreno, voo, acurácia | O gerador cria zonas `RTK_CANYON` onde dois prédios > 60 m distam < 40 m. Dentro delas, o `rtkStatusAt()` retorna `FLOAT` e o HUD mostra "RTK FLOAT — multipercurso GNSS". As fotos registram `rtk = 'FLOAT'` |
| `HOMOGENEOUS_TEXTURE` | Acurácia, processamento | Aplica o multiplicador `texture` ([domain-math §6.3](../design/domain-math.md)). Na etapa 2 do pipeline, a visualização mostra 40 % menos tie points |
| `DENSE_CANOPY` | Terreno, campo, cobertura | O dossel fica entre 0,90 e 0,98, com as clareiras circulares definidas pelo bioma (r = 20–35 m, dossel 0). Os GCPs só são válidos nas clareiras. Sem LiDAR, o MDT do visualizador fica "sem dados" sob o dossel |
| `STEEP_RELIEF` | Terreno, voo | Amplitude de relevo ≥ 60 m. Bancadas ou degraus com taludes de 35–70°. Em altitude constante (sem TF), o AGL varia muito: o GSD varia e há risco de colisão |
| `LOW_WIRES` | Terreno, voo | Postes a cada 30–40 m ao longo das ruas, com fios entre eles a 8–14 m. O fio colide se o AGL da aeronave estiver a ±1 m da altura do fio entre os postes |
| `SPECULAR_WATER` | Voo, cobertura, acurácia | Zonas `WATER`. Sob `SUN_HIGH`, as fotos com > 50 % da pegada sobre água ficam inválidas (`overWater`) e a água recebe um brilho especular no render. Células de água são sempre excluídas da cobertura |
| `STRONG_WIND` | Voo | Vento médio ≥ 8 m/s. Se `mean + gust` passar de `windToleranceMs`, a deriva dobra e o HUD exibe "VENTO ACIMA DO LIMITE DA AERONAVE" |
| `EM_INTERFERENCE` | Voo, acurácia | Em aeronave não imune: tremor lateral (ruído de ±0,8 m/s), deriva de rumo (±3°, lenta) e glitch no HUD (scanlines; desligado com `reduceFlashes`). Multiplicador RMSE de 1,2 |
| `BLIZZARD_DRAIN` | Voo, energia | Dreno de energia × 2, partículas de neve e visibilidade de 400 m (névoa branca) |
| `MAGIC_FOG` | Voo, cobertura | Névoa violeta densa com visibilidade de 250 m. Toda foto RGB fica `inFog = true` e não conta para a cobertura. O LiDAR não é afetado |
| `SEARCHLIGHTS` | Voo | Zonas `SEARCHLIGHT` (cones no solo que giram). Ficar dentro de um cone por mais de 1,5 s (Atlas: 3 s) gera `detected = true`, um alarme `ALERT` e o aviso "DETECTADO!". O voo continua |
| `MOVING_HAZARDS` | Voo | Objetos `MOVING_HAZARD` com `motion` senoidal (amplitude de 10–25 m, período de 3–6 s) |
| `ENERGY_BEAMS` | Voo | Colunas `ENERGY_BEAM` com ciclo de 2 s ligadas e 3 s desligadas (fase aleatória). Só colidem quando ligadas. Pulsam 0,5 s antes de ligar |
| `LAVA_THERMALS` | Terreno, voo | Células `LAVA` geram térmicas com lift de 6 m/s (r = 40 m) e brilho laranja |
| `VERTICAL_CLIFFS` | Terreno | Paredões quase verticais (> 80°) com 60–100 m de altura. Exigem oblíqua para modelar as fachadas `CLIFF_TEMPLE` |
| `FEATURE_TARGETS` | Terreno, voo, avaliação | O terreno expõe `features`. A captura é registrada quando: `PHOTO` → ≥ 3 fotos válidas cobrem o centro; `LIDAR` → a célula do centro tem ≥ 50 pulsos/m² |
| `COLLECTIBLE_RINGS` | Voo, economia | Objetos `RING` (r = 3 m) flutuando a 10–40 m. Passar pelo anel dá +R$ 50 (somados ao pagamento como "bônus de anéis") e toca `COLLECT` |
| `ELECTRIC_CREATURES` | Voo | A cada 8–12 s (seedado), um pico de 2 s empurra a aeronave lateralmente a 3 m/s e causa glitch. Atlas é imune |
| `NARROW_TRENCH` | Terreno | Trincheira ao longo de `u`, com 50 m de largura e 40 m de profundidade, paredes sólidas e torres (`TOWER`) nas bordas |
| `PAINT_MARKERS` | Campo | Os GCPs ignoram o alcance por veículo (item 4 de [catalog §5](catalog.md)). Só água e telhado continuam inválidos |

---

## 2. Formato de cada contrato

Cada bloco abaixo se converte 1:1 num objeto `Contract` ([data-model §4](../design/data-model.md)).

- **Requisitos:** `Severidade · tipo(valor)`.
- **Plano de referência:** é **usado em teste** (viabilidade). O teste:
  1. gera o plano com `domain/flightPlanner`;
  2. confere `expected` (tolerância de 1 % no GSD, igualdade no nº de linhas, 2 % no tempo);
  3. "encaixa" cada GCP/CP no ponto acessível mais próximo, num raio de até 30 m (`snapToAccessible`);
  4. verifica com `predictRequirements` que **nenhum** requisito previsível falha.

---

## C00 — Sítio do Avô *(tutorial, [ADIÇÃO])*

| Campo | Valor |
| :--- | :--- |
| Cliente | **Seu Zé Bento**, caseiro do sítio. Senhor de chapéu de palha que conheceu o avô por 40 anos. Retrato: `CIRCLE` / `Tractor` / #a16207 / #fde68a / "ZB" |
| Objetivo | Levantamento planialtimétrico do sítio do avô para o inventário da família. É o primeiro setor do Museu |
| Bioma / seed | `RURAL_TUTORIAL` / 1001. Pasto ondulado, pomar, casa sede, açude pequeno, estrada de terra cortando a AOI |
| AOI (larg. × comp.) | 160 × 240 m |
| Teto / relevo | 80 m / 15 m |
| Iluminação | `SUN_HIGH`, `OVERCAST` |
| Vento | médio 2, rajada 1, direção 90° |
| Regras | — |
| Requisitos | `CRITICAL · MIN_COVERAGE_GREEN(0,70)` · `MAJOR · MAX_GSD_CM(5)` · `MAJOR · MIN_GCP(3)` · `MAJOR · ACCURACY_PEC(C, 1:2000)` · `MINOR · MIN_FORWARD_OVERLAP(65)` · `MINOR · MIN_SIDE_OVERLAP(55)` |
| Recomendado | ATLAS + CAM_PIGEON · A Pé |
| Veículo mínimo (mapa) | FOOT_BIKE |
| Pagamento / XP / reputação | R$ 2.500 / 150 / +5 |
| Souvenir | `SV_NOTEBOOK` |
| Museu | Ala REAL, slot (col 2, lin 1), R$ 10/min |
| Desbloqueio | `ALWAYS` |
| Marcador | `0` |
| Plano de referência | ATLAS · CAM_PIGEON · H 60 · p 70 · q 60 · v 10 · `SUN_HIGH`. GCPs (u,v): (25,20), (215,20), (25,140), (215,140), (120,80). CPs: (70,50), (170,110). **Esperado:** GSD 2,52 cm · 6 linhas · 231,5 s |

**Diálogos:**
- **Briefing:**
  - "Seu avô mediu essas cercas com teodolito e paciência."
  - "Agora é sua vez — e com um pombo, quem diria!"
  - "Coloque uns alvos no chão antes de soltar o Atlas, viu?"
- **Sucesso:**
  - "Tá tudo aqui, tintim por tintim. Ele ia ficar orgulhoso."
  - "Guarde a caderneta dele. Ela é sua agora."
- **Falha:**
  - "Uai, faltou pedaço do sítio no mapa…"
  - "Tenta de novo, sem pressa."

**Tutorial dirigido** (`flags.tutorialStep`). São dicas contextuais, não bloqueantes, em cada tela da primeira execução:
1. no mapa, "Encoste no marcador e aperte [INTERACT]";
2. no campo, "Clique para cravar ao menos 3 GCPs";
3. no plano, "Observe o GSD mudar com a altura";
4. no voo, "Mantenha-se na linha — fotos saem sozinhas";
5. no processamento, "Veja o mapa de calor: verde = ≥ 5 fotos".

---

## C01 — Metrópole Vertical

| Campo | Valor |
| :--- | :--- |
| Cliente | **Prefeito Dr. Aurélio Bastos**, Prefeitura de Vila Nova. Retrato: `SHIELD` / `Landmark` / #0ea5e9 / #0f172a / "AB" |
| Objetivo | Atualização cadastral do IPTU com **True-Ortho** do centro, sem tombamento de arranha-céus |
| Bioma / seed | `URBAN_VERTICAL` / 2002. Grade de ruas a cada 60–80 m, quadras com prédios de 10–90 m (20 % acima de 60 m), praça central |
| AOI | 240 × 360 m |
| Teto / relevo | 120 m / 10 m (fora os prédios) |
| Iluminação | `SUN_HIGH`, `OVERCAST`, `GOLDEN_HOUR` |
| Vento | 4 / 3 / 90° |
| Regras | `URBAN_CANYON_RTK_LOSS` |
| Requisitos | `CRITICAL · MIN_SIDE_OVERLAP(80)` · `CRITICAL · MIN_COVERAGE_GREEN(0,80)` · `CRITICAL · ACCURACY_PEC(A, 1:1000)` · `MAJOR · MIN_FORWARD_OVERLAP(80)` · `MAJOR · MAX_GSD_CM(3,5)` · `MAJOR · MIN_GCP(5)` · `MINOR · MIN_CP(2)` |
| Recomendado | DRONE_T1 + CAM_20MP_RS · Carro Compacto. Nota: "Voe acima dos prédios mais altos (90 m)!" |
| Veículo mínimo | FOOT_BIKE |
| Pagamento / XP / reputação | R$ 12.000 / 400 / +8 |
| Souvenir | `SV_CITY_KEY` |
| Museu | REAL (1, 0), R$ 40/min |
| Desbloqueio | `CONTRACT_DONE(C00)` |
| Marcador | `1` |
| Plano de referência | DRONE_T1 · CAM_20MP_RS · H 110 · p 80 · q 82 · v 10 · `SUN_HIGH`. GCPs: (30,30), (330,30), (30,210), (330,210), (180,120). CPs: (100,80), (260,160). **Esperado:** GSD 3,02 cm · 10 linhas · 493,7 s |

**Diálogos:**
- **Briefing:**
  - "Metade dos prédios não existe no cadastro, e a outra metade aparece deitada no mapa velho!"
  - "Quero True-Ortho: sobreposição lateral de 80 %, nada menos."
  - "E cuidado: o GPS enlouquece entre os arranha-céus."
- **Sucesso:**
  - "Impecável! Cada telhado no lugar."
  - "Leve a chave da cidade — simbólica, viu?"
- **Falha:**
  - "Com prédios tombados assim, não dá para cobrar IPTU de ninguém."
  - "A MegaMap disse que faria melhor…"

---

## C05 — Centro Histórico Colonial

| Campo | Valor |
| :--- | :--- |
| Cliente | **Arq.ª Helena Vasconcelos**, Instituto do Patrimônio Histórico (inspirado no IPHAN). Retrato: `DIAMOND` / `Church` / #3b82f6 / #f8fafc / "HV" |
| Objetivo | Modelo 3D de fachadas de casarões e da igreja matriz para o projeto de restauração |
| Bioma / seed | `COLONIAL_CENTER` / 5005. Ladeiras (relevo de 25 m), casarões de 2 pavimentos (8–10 m), igreja com torres de 35 m, ruas de pedra com fiação baixa |
| AOI | 150 × 150 m |
| Teto / relevo | 120 m / 25 m |
| Iluminação | `OVERCAST`, `SUN_HIGH`, `GOLDEN_HOUR` |
| Vento | 3 / 2 / 45° |
| Regras | `LOW_WIRES` |
| Requisitos | `CRITICAL · FLIGHT_MODE(OBLIQUE)` · `CRITICAL · MIN_COVERAGE_GREEN(0,85)` · `CRITICAL · ACCURACY_PEC(A, 1:500, Eq 0,5 m)` · `MAJOR · FLIGHT_MODE(CROSS_GRID)` · `MAJOR · MAX_GSD_CM(1,5)` · `MAJOR · MIN_GCP(5)` · `MINOR · MIN_CP(3)` |
| Recomendado | DRONE_T1 (gimbal) ou DRONE_T2 + LENS_24 · Carro Compacto. Nota: "Fiação a 8–14 m: mantenha o AGL acima de 20 m." |
| Veículo mínimo | FOOT_BIKE |
| Pagamento / XP / reputação | R$ 18.000 / 600 / +10 |
| Souvenir | `SV_TILE` |
| Museu | REAL (1, 1), R$ 60/min |
| Desbloqueio | `CONTRACT_DONE(C01)` |
| Marcador | `5` |
| Plano de referência | DRONE_T1 · CAM_20MP_RS · H 50 · p 75 · q 65 · v 6 · `OBLIQUE` 45° + `CROSS_GRID` · `OVERCAST`. GCPs: (15,15), (135,15), (15,135), (135,135), (75,75). CPs: (45,105), (105,45), (75,20). **Esperado:** GSD 1,37 cm · 14 linhas · 605,9 s (2 baterias) |

**Diálogos:**
- **Briefing:**
  - "Esses casarões têm 250 anos e fachadas que nenhum mapa vertical enxerga."
  - "Preciso de câmera inclinada e voo em malha cruzada."
  - "E pelo amor de Deus, não encoste na fiação!"
- **Sucesso:**
  - "Cada azulejo, cada cornija. Vamos restaurar com precisão milimétrica."
- **Falha:**
  - "As fachadas ficaram borradas e deformadas. O patrimônio merece mais."

---

## C06 — Zona Costeira e Estuário

| Campo | Valor |
| :--- | :--- |
| Cliente | **Comandante Iara Moreira**, Agência Marítima. Retrato: `CIRCLE` / `Anchor` / #0891b2 / #f8fafc / "IM" |
| Objetivo | Monitoramento da erosão costeira e do assoreamento do estuário |
| Bioma / seed | `COASTAL_ESTUARY` / 6006. Faixa de praia, dunas (relevo de 20 m), falésia baixa, canal do estuário e mar ocupando ~40 % da AOI, manguezal |
| AOI | 300 × 800 m |
| Teto / relevo | 120 m / 20 m |
| Iluminação | `SUN_HIGH`, `OVERCAST`, `GOLDEN_HOUR` |
| Vento | **9 / 4 / 90°** (cruzado) |
| Regras | `SPECULAR_WATER`, `STRONG_WIND` |
| Requisitos | `CRITICAL · MIN_AIRCRAFT_TIER(2)` · `CRITICAL · MIN_COVERAGE_GREEN(0,80)` · `CRITICAL · ACCURACY_ASPRS(7 cm H, 10 cm V)` · `MAJOR · MAX_GSD_CM(3)` · `MAJOR · MIN_GCP(5)` · `MINOR · MIN_CP(3)` |
| Recomendado | DRONE_T2 + CAM_45MP_FF + LENS_24 · `OVERCAST` (evita o reflexo). Nota: "Água não tem tie points: GCPs só na faixa de areia." |
| Veículo mínimo | FOOT_BIKE |
| Pagamento / XP / reputação | R$ 22.000 / 700 / +10 |
| Souvenir | `SV_BOTTLE_MAP` |
| Museu | REAL (3, 0), R$ 70/min |
| Desbloqueio | `ALL[CONTRACT_DONE(C01), REPUTATION(40)]` |
| Marcador | `6` |
| Plano de referência | DRONE_T2 · CAM_45MP_FF · LENS_24 · H 110 · p 75 · q 65 · v 12 · `OVERCAST`. GCPs: (40,40), (760,40), (40,140), (760,140), (400,90). CPs: (200,70), (600,110), (400,30). Faixa de terra garantida pelo gerador em v ∈ [0, 170]. **Esperado:** GSD 2,01 cm · 7 linhas · 568,5 s |

**Diálogos:**
- **Briefing:**
  - "O mar avança dois metros por ano aqui."
  - "Vento cruzado forte — seu drone aguenta?"
  - "E água espelhada não serve para fotogrametria: escolha bem a hora do voo."
- **Sucesso:**
  - "Agora temos a linha de costa com precisão de centímetros. Bom trabalho, marinheiro."
- **Falha:**
  - "Metade do mapa é reflexo de sol. Isso não mede erosão nenhuma."

---

## C02 — Planalto Agrícola

| Campo | Valor |
| :--- | :--- |
| Cliente | **Seu Valdemar Prado**, produtor rural, Fazenda Boa Safra. Retrato: `HEXAGON` / `Wheat` / #65a30d / #fef9c3 / "VP" |
| Objetivo | Monitoramento de safra e vigor vegetativo (NDVI) em área extensa |
| Bioma / seed | `AGRI_PLATEAU` / 2020. Talhões retangulares de soja e milho com vigor variável (manchas de estresse hídrico), estradas internas, pivôs centrais, relevo suave (30 m) |
| AOI | 600 × 1500 m |
| Teto / relevo | **200 m** (autorização especial) / 30 m |
| Iluminação | `SUN_HIGH`, `OVERCAST`, `GOLDEN_HOUR` |
| Vento | 5 / 3 / 0° |
| Regras | `HOMOGENEOUS_TEXTURE` |
| Requisitos | `CRITICAL · SENSOR_KIND(MULTISPECTRAL)` · `CRITICAL · AIRCRAFT_KIND(FIXED_WING_VTOL)` · `CRITICAL · MIN_COVERAGE_GREEN(0,75)` · `MAJOR · MAX_GSD_CM(15)` · `MAJOR · MIN_FORWARD_OVERLAP(80)` · `MAJOR · ACCURACY_PEC(B, 1:5000)` · `MINOR · MIN_GCP(5)` |
| Recomendado | VTOL_T3 + CAM_MS5 · Picape 4x4. Nota: "Textura homogênea: use p ≥ 80 % para o SIFT não se perder." |
| Veículo mínimo | FOOT_BIKE |
| Pagamento / XP / reputação | R$ 35.000 / 900 / +12 |
| Souvenir | `SV_CORN_GOLD` |
| Museu | REAL (0, 1), R$ 90/min |
| Desbloqueio | `ALL[CONTRACT_DONE(C06), REPUTATION(50)]` |
| Marcador | `2` |
| Plano de referência | VTOL_T3 · CAM_MS5 · H 200 · p 80 · q 65 · v 22 · `SUN_HIGH`. GCPs: (100,80), (1400,80), (100,520), (1400,520), (750,300). CPs: (400,200), (1100,400). **Esperado:** GSD 12,54 cm · 8 linhas · 725,7 s |

**Diálogos:**
- **Briefing:**
  - "Mil e quinhentos metros de soja até onde a vista alcança."
  - "Quero saber onde a planta tá sofrendo antes de eu perder a safra."
  - "Drone de hélice não dá conta, não: precisa de asa."
- **Sucesso:**
  - "Olha só esse NDVI! Aquela mancha amarela é o pivô 3 entupido. Valeu demais!"
- **Falha:**
  - "Isso aí não mostra vigor nenhum, moço."

---

## C04 — Mina a Céu Aberto

| Campo | Valor |
| :--- | :--- |
| Cliente | **Eng.ª Rosa Lima**, Mineração Serra Alta. Retrato: `SHIELD` / `Pickaxe` / #f97316 / #1c1917 / "RL" |
| Objetivo | Cálculo volumétrico de corte e aterro da cava e das pilhas de minério |
| Bioma / seed | `OPEN_PIT_MINE` / 4004. Cava em bancadas (degraus de 15 m, 150 m de profundidade total), pilhas cônicas de estéril, estradas de acesso em rampa, torres de britagem |
| AOI | 320 × 480 m |
| Teto / relevo | 120 m AGL / **150 m** |
| Iluminação | `SUN_HIGH`, `OVERCAST`, `GOLDEN_HOUR` |
| Vento | 6 / 4 / 270° |
| Regras | `STEEP_RELIEF` |
| Requisitos | `CRITICAL · FLIGHT_MODE(TERRAIN_FOLLOWING)` · `CRITICAL · MAX_VOLUME_ERROR_PCT(2)` · `CRITICAL · MIN_COVERAGE_GREEN(0,85)` · `MAJOR · ACCURACY_ASPRS(5 cm H, 8 cm V)` · `MAJOR · MIN_GCP(6)` · `MINOR · MIN_CP(3)` |
| Recomendado | DRONE_T2 + CAM_45MP_FF + LENS_24 · **Picape 4x4** |
| Veículo mínimo | **PICKUP_4X4** (a mina fica atrás de encostas íngremes) |
| Pagamento / XP / reputação | R$ 55.000 / 1200 / +12 |
| Souvenir | `SV_ORE_NUGGET` |
| Museu | REAL (0, 0), R$ 120/min |
| Desbloqueio | `ALL[CONTRACT_DONE(C05), REPUTATION(55)]` |
| Marcador | `4` |
| Plano de referência | DRONE_T2 · CAM_45MP_FF · LENS_24 · H 80 (AGL) · p 75 · q 65 · v 10 · `TERRAIN_FOLLOWING` · `OVERCAST`. GCPs: (40,40), (440,40), (40,280), (440,280), (240,160), (240,40). CPs: (140,100), (340,220), (240,280). **Esperado:** GSD 1,46 cm · 9 linhas · 563,5 s |

**Diálogos:**
- **Briefing:**
  - "Cento e cinquenta metros de desnível entre a borda e o fundo da cava."
  - "Se voar em altitude constante, você bate na bancada ou perde resolução lá embaixo."
  - "Terrain Following, e volume com erro máximo de 2 %."
- **Sucesso:**
  - "Volume fechou com a balança da usina. Engenharia de verdade!"
- **Falha:**
  - "Esse volume aí não fecha nem com reza."

---

## C03 — Floresta Amazônica

| Campo | Valor |
| :--- | :--- |
| Cliente | **Dra. Jaci Tupinambá**, ONG Raízes da Floresta. Retrato: `CIRCLE` / `TreePine` / #16a34a / #052e16 / "JT" |
| Objetivo | Modelo Digital de Terreno **sob o dossel** para regularização fundiária de comunidades tradicionais |
| Bioma / seed | `AMAZON` / 3003. Floresta densa (dossel de 0,97, árvores de 25–45 m), igarapé sinuoso, 7 clareiras em posições fixas (ver plano de referência), relevo de 40 m |
| AOI | 500 × 1000 m |
| Teto / relevo | 150 m / 40 m |
| Iluminação | `OVERCAST`, `SUN_HIGH` |
| Vento | 3 / 2 / 180° |
| Regras | `DENSE_CANOPY` |
| Requisitos | `CRITICAL · SENSOR_KIND(LIDAR)` · `CRITICAL · MIN_GROUND_DENSITY(8)` · `MAJOR · MIN_LIDAR_DENSITY(100)` · `MAJOR · ACCURACY_ASPRS(10 cm H, 15 cm V)` · `MAJOR · MIN_GCP(4)` · `MINOR · MIN_CP(2)` |
| Recomendado | VTOL_T3 + POD_LIDAR · **Picape 4x4** |
| Veículo mínimo | **PICKUP_4X4** (acesso por brejo) |
| Pagamento / XP / reputação | R$ 90.000 / 1500 / +15 |
| Souvenir | `SV_BRAZIL_NUT` |
| Museu | REAL (2, 0), R$ 150/min |
| Desbloqueio | `ALL[CONTRACT_DONE(C04), CONTRACT_DONE(C02), REPUTATION(65)]` |
| Marcador | `3` |
| Plano de referência | VTOL_T3 · POD_LIDAR (primário LIDAR) · H 120 · p 70 · q 50 · v 18 · `OVERCAST`. GCPs e CPs nos centros das clareiras, que o gerador garante em (150,100), (850,100), (150,400), (850,400), (500,250), mais CPs em (300,250) e (700,250) (clareiras extras). **Esperado:** faixa de 168,05 m · 7 linhas · 580,2 s · 158,7 pts/m² · solo ≈ 17 pts/m² |

**Diálogos:**
- **Briefing:**
  - "A foto aérea só enxerga copa. O chão onde essas famílias vivem há séculos é invisível."
  - "Precisamos do laser — múltiplos retornos atravessando as folhas até o solo."
- **Sucesso:**
  - "Pela primeira vez, o igarapé e cada grota aparecem no mapa. Isso muda vidas."
- **Falha:**
  - "Sem pontos de solo, o cartório não aceita. Precisamos tentar de novo."

---

## 3. Final da campanha (REQ-CNT-008)

Quando os 7 contratos reais tiverem `status = COMPLETED`, o jogo exibe, uma única vez, ao entrar no `OFFICE`:
1. uma sequência de 4 cartões (`DialogueBox`) com a **carta do avô** encontrada na caderneta e a inauguração do Grande Museu da Terra;
2. o desbloqueio do cosmético `CHAR_GRANDPA_HAT`;
3. o toast "Museu da Terra inaugurado!".

Texto canônico da carta:

> "Neto, se você está lendo isto, é porque terminou o que eu comecei com uma trena e um pombo. O mundo muda depressa — mas agora ele está guardado. Continue medindo. — Vô"

---

## 4. Ordem de desbloqueio esperada (teste de progressão)

`C00` → `C01` → `C05`, e `C06` (reputação ≥ 40) → `C02` (reputação ≥ 50) → `C04` (C05 concluído, reputação ≥ 55, 4x4 para chegar) → `C03` (C04 + C02 concluídos, reputação ≥ 65, 4x4).

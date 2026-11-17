# Conteúdo — Side-Quests: Fendas Dimensionais (Ala Secreta do Multiverso)

> Dados normativos para `src/data/contracts/rifts.ts`. **Leia antes a [constitution §6](../constitution.md).** São paródias com nomes paródicos, descrições textuais e motivos visuais genéricos desenhados proceduralmente. A coluna "Referência" existe **só nesta spec**, para orientar o tom. Ela nunca vai para `src/`.
>
> **Requisitos cobertos:** REQ-CNT-002, REQ-CNT-003, REQ-CNT-004, REQ-CNT-006, REQ-CNT-007, REQ-WLD-004, REQ-FLT-020, REQ-FLT-024.

---

## 1. Regras gerais das Fendas

- **Descoberta:**
  - Quando a `UnlockCondition` de uma fenda é satisfeita pela primeira vez, ela entra em `world.discoveredRifts`.
  - O jogo toca `RIFT_OPEN` e mostra o toast `rift` "Anomalia dimensional detectada: <título>".
  - A aba **Fendas Dimensionais** do mapa passa a aparecer.
- **Marcador no mapa:** é um portal animado (anel violeta pulsante com partículas) visível só na aba Fendas. Ao aceitar o contrato, a transição para o `FIELD_SETUP` tem um efeito de "distorção", com shader procedural de ondas no canvas, desligado por `reduceFlashes`.
- **Interferência:** todas as fendas têm `EM_INTERFERENCE`. Atlas é imune.
- **Execução do voo:** toda fenda tem o requisito comum `CRITICAL · MIN_EXECUTION(0,5)` ([contracts-real §2](contracts-real.md)), além dos da ficha.
- **Aparência dentro da fenda:**
  - céu com gradiente violeta-ciano;
  - partículas flutuantes;
  - HUD com moldura `rift` (violet-500).
- **Museu:** cada fenda concluída vira um **diorama** no anel do Multiverso (slot 0–10).
- **Retratos dos clientes:** `EmblemBadge` abstrato, nunca desenho do personagem.

---

## 2. Tabela-resumo

| id | Título | Cliente (paródia) | Referência (só specs) | Desbloqueio | Pagamento | XP | Marcador | Slot |
| :--- | :--- | :--- | :--- | :--- | :-: | :-: | :-: | :-: |
| R01 | Colinas Verdes dos Espinhos | Sonisvaldo | Sonic | C01 | R$ 25.000 | 500 | `a` | 0 |
| R02 | Reino dos Encanamentos | Seu Márcio Bross | Mario | C01 | R$ 30.000 | 600 | `b` | 1 |
| R03 | Planalto dos Guerreiros | Guko | Dragon Ball | C04 | R$ 45.000 | 900 | `c` | 2 |
| R04 | Bosque das Fadas Perdidas | Lino | Zelda | C03 | R$ 80.000 | 1400 | `d` | 3 |
| R05 | Mina dos Blocos Cúbicos | Estêvão | Minecraft | C04 | R$ 50.000 | 1000 | `e` | 4 |
| R06 | Pântano Cinzento | Geraldo de Rívia | The Witcher | C06 | R$ 60.000 | 1100 | `f` | 5 |
| R07 | Base Polar das Sombras | Cobrinha Sólida | Metal Gear Solid | C06 | R$ 70.000 | 1200 | `g` | 6 |
| R08 | Bairro dos Santos | Carlinhos Joilson (CJ) | GTA San Andreas | C05 | R$ 28.000 | 700 | `h` | 7 |
| R09 | Savana das Gramas Altas | Ailton da Rocha | Pokémon | C02 | R$ 40.000 | 800 | `i` | 8 |
| R10 | Trincheira da Estrela de Ferro | Lorde Válter | Star Wars | C03 + 5 fendas | R$ 150.000 | 2000 | `j` | 9 |
| R11 | Tumbas dos Desfiladeiros | Dona Laura da Silva | Tomb Raider | C05 | R$ 65.000 | 1100 | `k` | 10 |

**Valores comuns às fendas:**
- reputação +5;
- o veículo mínimo é FOOT_BIKE, salvo indicação;
- a renda do museu está em cada bloco.

---

## R01 — Colinas Verdes dos Espinhos

| Campo | Valor |
| :--- | :--- |
| Cliente | **Sonisvaldo**, ouriço marrom hiperativo de tênis vermelhos gastos que fala rápido demais. Retrato: `CIRCLE` / `Zap` / #2563eb / #ef4444 / "SV" |
| Objetivo | Ortofoto da pista com **GSD < 3 cm** para achar buracos antes que um cientista bigodudo construa fábricas de robôs |
| Bioma / seed | `RIFT_GREEN_HILLS` / 9101. Colinas onduladas com textura quadriculada verde-clara/verde-escura, **arcos de pedra** (`STONE_ARCH`, vãos de 12 m, altura de 20–30 m), **anéis dourados flutuantes** (`RING`, 40 unidades, 10–40 m de altura), palmeiras estilizadas genéricas, cachoeiras |
| AOI | 200 × 400 m · teto 100 m · relevo 35 m |
| Iluminação / vento | `SUN_HIGH` / 3, 2, 90° |
| Regras | `EM_INTERFERENCE`, `COLLECTIBLE_RINGS` |
| Requisitos | `CRITICAL · MAX_GSD_CM(3)` · `CRITICAL · MIN_COVERAGE_GREEN(0,80)` · `MAJOR · MIN_GCP(4)` · `MAJOR · ACCURACY_PEC(B, 1:1000)` |
| Recomendado | ATLAS (imune) ou DRONE_T1 |
| Souvenir / museu | `SV_GOLD_RING` / R$ 80/min |
| Plano de referência | ATLAS · CAM_PIGEON · H 55 · p 70 · q 60 · v 9 · `SUN_HIGH`. GCPs: (30,30), (370,30), (30,170), (370,170), (200,100). **Esperado:** GSD 2,31 cm · 8 linhas · 473,4 s |

**Diálogos:**
- **Briefing:**
  - "E aí, agrimensor! Rápido, rápido, rápido!"
  - "Tem buraco na pista e um doutor de bigode quer asfaltar tudo com fábrica de robô!"
  - "Preciso de 3 cm de GSD — nem um pixel a mais!"
- **Sucesso:**
  - "UAU! Mapa mais rápido que eu! Fica com um anel, tenho uns mil."
- **Falha:**
  - "Muito lento, muito borrado! Tenta de novo — mais rápido!"

---

## R02 — Reino dos Encanamentos

| Campo | Valor |
| :--- | :--- |
| Cliente | **Seu Márcio Bross**, encanador aposentado e gordinho, de macacão azul e boné com a letra "M" bordada. Retrato: `CIRCLE` / `Wrench` / #dc2626 / #1d4ed8 / "MB" |
| Objetivo | Cadastro planialtimétrico de bueiros contra infestações de tartarugas voadoras e plantas carnívoras |
| Bioma / seed | `RIFT_PIPES` / 9202. Campo gramado com **canos verdes gigantes** (`PIPE`, cilindros de 15–40 m de altura e 6–10 m de diâmetro), **plataformas de tijolos flutuantes** (`BRICK_PLATFORM`, 20–50 m), **cascos voadores** (`MOVING_HAZARD`, esferas verdes/vermelhas oscilando), morrinhos arredondados com "olhos" (dois círculos pretos) |
| AOI | 240 × 300 m · teto 120 m · relevo 20 m |
| Iluminação / vento | `SUN_HIGH`, `OVERCAST` / 2, 1, 0° |
| Regras | `EM_INTERFERENCE`, `MOVING_HAZARDS` |
| Requisitos | `CRITICAL · ACCURACY_PEC(A, 1:1000, Eq 1 m)` · `CRITICAL · MIN_COVERAGE_GREEN(0,80)` · `MAJOR · MAX_GSD_CM(3)` · `MAJOR · MIN_GCP(5)` · `MINOR · MIN_CP(2)` |
| Recomendado | DRONE_T1 ou ATLAS |
| Souvenir / museu | `SV_GREEN_PIPE` / R$ 90/min |
| Plano de referência | DRONE_T1 · CAM_20MP_RS · H 100 · p 75 · q 70 · v 8 · `OVERCAST`. GCPs: (30,30), (270,30), (30,210), (270,210), (150,120). CPs: (90,80), (210,160). **Esperado:** GSD 2,74 cm · 7 linhas · 386,8 s |

**Diálogos:**
- **Briefing:**
  - "Mamma… quer dizer, minha nossa! Os bueiros tão tudo entupido de casco!"
  - "Preciso da cota de cada tampa, classe A!"
  - "Cuidado com os canos — alguns são bem altos."
- **Sucesso:**
  - "Uhuu! Agora sei onde cada cano vai dar. Leva um de lembrança!"
- **Falha:**
  - "Ih, rapaz… esse mapa tá mais torto que cano velho."

---

## R03 — Planalto dos Guerreiros

| Campo | Valor |
| :--- | :--- |
| Cliente | **Guko**, lutador faminto de quimono laranja e cabelo espetado, que sempre pergunta se tem comida. Retrato: `HEXAGON` / `Flame` / #f97316 / #1d4ed8 / "GK" |
| Objetivo | Cálculo volumétrico da terra vaporizada nas crateras pós-torneio, para prestar contas à prefeitura |
| Bioma / seed | `RIFT_CRATERS` / 9303. Planalto rochoso com **crateras esféricas** (6–10, raios de 15–45 m, profundidade = 0,4·r), **colunas de energia residual** (`ENERGY_BEAM`, ciano/amarelo, 80 m de altura), rochas flutuantes pequenas (decorativas, não sólidas) |
| AOI | 300 × 400 m · teto 120 m · relevo 60 m |
| Iluminação / vento | `SUN_HIGH`, `GOLDEN_HOUR` / 4, 6, 90° (rajadas "de energia") |
| Regras | `EM_INTERFERENCE`, `ENERGY_BEAMS`, `STEEP_RELIEF` |
| Requisitos | `CRITICAL · MAX_VOLUME_ERROR_PCT(3)` · `CRITICAL · MIN_COVERAGE_GREEN(0,85)` · `MAJOR · ACCURACY_ASPRS(8 cm H, 10 cm V)` · `MAJOR · MIN_GCP(5)` |
| Recomendado | DRONE_T2 + CAM_45MP_FF + LENS_24 + TF |
| Souvenir / museu | `SV_STAR_SPHERE` / R$ 110/min |
| Plano de referência | DRONE_T2 · CAM_45MP_FF · LENS_24 · H 90 · p 75 · q 65 · v 10 · `TERRAIN_FOLLOWING` · `SUN_HIGH`. GCPs: (30,30), (370,30), (30,270), (370,270), (200,150). **Esperado:** GSD 1,64 cm · 8 linhas · 442,0 s |

**Diálogos:**
- **Briefing:**
  - "Oi! Eu sou o Guko! A prefeitura quer saber quanto chão sumiu no torneio…"
  - "Foi sem querer, juro."
  - "Você mede rapidinho? Depois tem almoço?"
- **Sucesso:**
  - "Uau, você é forte em matemática! Toma, achei essa esfera com 4 estrelas."
- **Falha:**
  - "Hmm, esse número tá esquisito. Vamos treinar mais?"

---

## R04 — Bosque das Fadas Perdidas

| Campo | Valor |
| :--- | :--- |
| Cliente | **Lino**, arqueólogo mudo de túnica verde que só se comunica gritando *"HYAAAH!"*. Retrato: `DIAMOND` / `Triangle` / #16a34a / #facc15 / "LN" |
| Objetivo | Varredura LiDAR sob névoa mágica e copas densas para revelar o **Templo do Triângulo Geodésico Dourado** soterrado |
| Bioma / seed | `RIFT_FAIRY_FOREST` / 9404. Floresta antiga (dossel de 0,95), troncos gigantes, cogumelos luminosos, **névoa violeta densa**, vaga-lumes (partículas). Templo soterrado em (300, 200), r = 30 m: um relevo sutil de 3 m que só aparece no MDT |
| AOI | 400 × 600 m · teto 150 m · relevo 30 m |
| Iluminação / vento | `MAGIC_FOG` / 1, 1, 0° |
| Regras | `EM_INTERFERENCE`, `MAGIC_FOG`, `DENSE_CANOPY`, `FEATURE_TARGETS` |
| Alvos | `TEMPLE` (300, 200), r = 30, needs `LIDAR` |
| Requisitos | `CRITICAL · SENSOR_KIND(LIDAR)` · `CRITICAL · FEATURE_CAPTURED(TEMPLE)` · `MAJOR · MIN_GROUND_DENSITY(10)` · `MINOR · MIN_LIDAR_DENSITY(120)` |
| Recomendado | DRONE_T2 + POD_LIDAR (lento e baixo) |
| Souvenir / museu | `SV_TRIANGLE` / R$ 160/min |
| Plano de referência | DRONE_T2 · POD_LIDAR (primário LIDAR) · H 80 · q 50 · v 10 · `MAGIC_FOG`. GCPs: nenhum exigido. **Esperado:** faixa de 112,03 m · 9 linhas · 682,8 s · 428 pts/m² |

**Diálogos:**
- **Briefing:**
  - "HYAAAH!" *(Lino aponta para a névoa, depois para o seu scanner, e faz um triângulo com as mãos.)*
  - *(Ele desenha no chão: copas → laser → chão → templo.)*
- **Sucesso:**
  - "HYAAAAAAH!!!" *(Lino faz uma dança de vitória e entrega um fragmento dourado.)*
- **Falha:**
  - "…hyah." *(Lino parece decepcionado.)*

---

## R05 — Mina dos Blocos Cúbicos

| Campo | Valor |
| :--- | :--- |
| Cliente | **Estêvão**, minerador de camisa ciano que não pisca e anda em ângulos retos. Retrato: `HEXAGON` / `Box` / #06b6d4 / #4d7c0f / "ES" |
| Objetivo | Nuvem de pontos 3D de taludes em degraus cúbicos para identificar deformações e prevenir vazamento de lava |
| Bioma / seed | `RIFT_CUBES` / 9505. Terreno **quantizado** em degraus de 4 m (elevação = `floor(h/4)·4`), blocos cúbicos soltos (`CUBE_BLOCK`, 4 × 4 × 4 m), **poças de lava** (`LAVA`) nas cotas baixas, árvores cúbicas. Paleta em "texturas" de 4 × 4 pixels por quad |
| AOI | 240 × 320 m · teto 120 m · relevo 80 m |
| Iluminação / vento | `SUN_HIGH`, `OVERCAST` / 2, 2, 0° |
| Regras | `EM_INTERFERENCE`, `LAVA_THERMALS`, `STEEP_RELIEF` |
| Requisitos | `CRITICAL · MIN_COVERAGE_GREEN(0,85)` · `MAJOR · MIN_FORWARD_OVERLAP(80)` · `MAJOR · ACCURACY_ASPRS(6 cm H, 8 cm V)` · `MAJOR · FLIGHT_MODE(TERRAIN_FOLLOWING)` · `MAJOR · MIN_GCP(5)` |
| Recomendado | DRONE_T2 + CAM_45MP_FF + LENS_24 + TF |
| Souvenir / museu | `SV_CUBE_ORE` / R$ 120/min |
| Plano de referência | DRONE_T2 · CAM_45MP_FF · LENS_24 · H 80 · p 80 · q 70 · v 8 · `TERRAIN_FOLLOWING` · `OVERCAST`. GCPs: (20,20), (300,20), (20,220), (300,220), (160,120). **Esperado:** GSD 1,46 cm · 8 linhas · 452,4 s |

**Diálogos:**
- **Briefing:**
  - "…" *(Estêvão vira 90° e olha para você.)*
  - "Talude. Degrau. Lava. Mapa."
  - *(Ele vira mais 90°.)*
- **Sucesso:**
  - "Mapa. Bom." *(Ele entrega um bloco perfeitamente cúbico.)*
- **Falha:**
  - "Mapa. Ruim." *(Ele coloca um bloco de terra na sua frente, em protesto.)*

---

## R06 — Pântano Cinzento

| Campo | Valor |
| :--- | :--- |
| Cliente | **Geraldo de Rívia**, caçador de pragas grisalho com duas espadas: uma de aço e uma de teodolito. Fala pouco, com voz rouca. Retrato: `SHIELD` / `Sword` / #94a3b8 / #0f172a / "GR" |
| Objetivo | Mapeamento termográfico para achar as tocas das criaturas no brejo sem sujar as botas |
| Bioma / seed | `RIFT_GREY_SWAMP` / 9606. Brejo (`SWAMP`), árvores mortas cinzentas, poças, névoa leve rente ao solo, ruínas de pedra. **3 tocas quentes**: no render termal aparecem como manchas brilhantes, e no RGB não aparecem |
| AOI | 200 × 300 m · teto 120 m · relevo 8 m |
| Iluminação / vento | `OVERCAST`, `GOLDEN_HOUR` / 3, 2, 0° |
| Regras | `EM_INTERFERENCE`, `FEATURE_TARGETS` |
| Alvos | `DEN_A` (80, 60), `DEN_B` (220, 150), `DEN_C` (150, 40); todos r = 8, needs `PHOTO` **com sensor THERMAL** |
| Requisitos | `CRITICAL · SENSOR_KIND(THERMAL)` · `CRITICAL · FEATURE_CAPTURED(DEN_A)` · `MAJOR · FEATURE_CAPTURED(DEN_B)` · `MAJOR · FEATURE_CAPTURED(DEN_C)` · `MAJOR · MIN_COVERAGE_GREEN(0,70)` · `MINOR · MAX_GSD_CM(14)` |
| Recomendado | DRONE_T2 + CAM_THERMAL · **Picape 4x4** |
| Veículo mínimo | **PICKUP_4X4** |
| Souvenir / museu | `SV_THEODOLITE_SWORD` / R$ 130/min |
| Plano de referência | DRONE_T2 · CAM_THERMAL · H 100 · p 75 · q 65 · v 8 · `OVERCAST`. **Esperado:** GSD 13,08 cm · 8 linhas · 426,6 s |

**Diálogos:**
- **Briefing:**
  - "Hm."
  - "Criaturas no brejo. Tocas quentes. Não quero sujar as botas."
  - "Câmera térmica. Você tem uma?"
- **Sucesso:**
  - "Hm. Bom trabalho." *(Ele te entrega uma miniatura da espada-teodolito.)*
- **Falha:**
  - "Ventos uivam… e seu mapa também."

---

## R07 — Base Polar das Sombras

| Campo | Valor |
| :--- | :--- |
| Cliente | **Cobrinha Sólida**, agente de bandana que conversa com você de dentro de uma caixa de papelão. Retrato: `SHIELD` / `Package` / #57534e / #a16207 / "CS" |
| Objetivo | Reconhecimento aéreo **furtivo** sob nevasca para modelar uma arma bípede gigante estacionada no pátio |
| Bioma / seed | `RIFT_POLAR_BASE` / 9707. Planície nevada (`SNOW`), hangares, cercas, torres de vigia, **holofotes** (`SEARCHLIGHT`, 4 cones de r = 15 m girando, período de 6–9 s), **andador bípede gigante** (`GIANT_WALKER`, 25 m, parado no centro), nevasca |
| AOI | 240 × 300 m · teto 120 m · relevo 15 m |
| Iluminação / vento | `BLIZZARD` / 7, 4, 90° |
| Regras | `EM_INTERFERENCE`, `BLIZZARD_DRAIN`, `SEARCHLIGHTS`, `FEATURE_TARGETS` |
| Alvos | `WALKER` (150, 120), r = 15, needs `PHOTO` |
| Requisitos | `CRITICAL · NOT_DETECTED` · `CRITICAL · FEATURE_CAPTURED(WALKER)` · `MAJOR · MIN_COVERAGE_GREEN(0,70)` · `MINOR · MAX_GSD_CM(3)` |
| Recomendado | ATLAS (imune e discreto: detecção em 3 s) ou DRONE_T2 |
| Souvenir / museu | `SV_CARDBOARD_BOX` / R$ 140/min |
| Plano de referência | DRONE_T2 · CAM_45MP_FF · LENS_24 · H 110 · p 75 · q 65 · v 9 · `BLIZZARD`. **Esperado:** GSD 2,01 cm · 6 linhas · 307,0 s (dreno 2× → 614 s de bateria) |

**Diálogos:**
- **Briefing:**
  - "Agrimensor… está me ouvindo? Estou na caixa."
  - "Tem uma arma bípede gigante no pátio. Preciso do modelo 3D."
  - "Fique fora dos holofotes. E a nevasca drena bateria duas vezes mais rápido."
- **Sucesso:**
  - "Missão cumprida. Pode ficar com a caixa — tenho outras."
- **Falha:**
  - "!" *(Som de alarme.)* "Fomos detectados… recue."

---

## R08 — Bairro dos Santos

| Campo | Valor |
| :--- | :--- |
| Cliente | **Carlinhos Joilson (CJ)**, de regata branca e bicicleta BMX, que reclama: *"Ah droga, lá vou eu mapear de novo."* Retrato: `CIRCLE` / `Bike` / #16a34a / #f8fafc / "CJ" |
| Objetivo | Regularização Fundiária Urbana (REURB) de vielas e becos |
| Bioma / seed | `RIFT_SANTOS_HOOD` / 9808. Casas baixas coladas (6–12 m), vielas estreitas (4–6 m), lajes, emaranhado de fiação baixa, palmeiras, quadra de basquete, céu alaranjado |
| AOI | 240 × 300 m · teto 120 m · relevo 20 m |
| Iluminação / vento | `SUN_HIGH`, `GOLDEN_HOUR`, `OVERCAST` / 3, 2, 0° |
| Regras | `EM_INTERFERENCE`, `LOW_WIRES` |
| Requisitos | `CRITICAL · ACCURACY_PEC(A, 1:1000)` · `CRITICAL · MIN_COVERAGE_GREEN(0,85)` · `MAJOR · MAX_GSD_CM(2)` · `MAJOR · MIN_FORWARD_OVERLAP(80)` · `MAJOR · MIN_SIDE_OVERLAP(70)` · `MAJOR · MIN_GCP(5)` · `MINOR · MIN_CP(3)` |
| Recomendado | DRONE_T2 + CAM_45MP_FF + LENS_35 |
| Souvenir / museu | `SV_BMX` / R$ 85/min |
| Plano de referência | DRONE_T2 · CAM_45MP_FF · LENS_35 · H 80 · p 80 · q 70 · v 8 · `SUN_HIGH`. GCPs: (20,20), (280,20), (20,220), (280,220), (150,120). CPs: (80,60), (220,180), (150,30). **Esperado:** GSD 1,00 cm · 11 linhas · 575,8 s |

**Diálogos:**
- **Briefing:**
  - "Ah droga, lá vou eu mapear de novo."
  - "A prefeitura quer regularizar o bairro todo, cada viela, cada laje."
  - "E cuidado com os fios, mano."
- **Sucesso:**
  - "Respeito. Agora a família tem escritura. Fica com essa BMX de miniatura."
- **Falha:**
  - "Tudo que a gente tinha que fazer era seguir o maldito plano de voo!"

---

## R09 — Savana das Gramas Altas

| Campo | Valor |
| :--- | :--- |
| Cliente | **Ailton da Rocha**, treinador de boné virado para trás e mochila gigante, que sonha em catalogar todas as espécies. Retrato: `CIRCLE` / `Backpack` / #ef4444 / #f8fafc / "AR" |
| Objetivo | Mapa multiespectral (NDVI) para identificar corredores de espécies raras sem pisar em cobras elétricas |
| Bioma / seed | `RIFT_TALL_GRASS` / 9909. Savana com **manchas de grama alta** (NDVI alto) e trilhas de terra, árvores isoladas, lago. **Criaturas elétricas** escondidas: no voo, faíscas amarelas sobem do capim nos picos de `ELECTRIC_CREATURES` |
| AOI | 400 × 800 m · teto 150 m · relevo 20 m |
| Iluminação / vento | `SUN_HIGH`, `OVERCAST` / 4, 3, 0° |
| Regras | `EM_INTERFERENCE`, `ELECTRIC_CREATURES`, `HOMOGENEOUS_TEXTURE` |
| Requisitos | `CRITICAL · SENSOR_KIND(MULTISPECTRAL)` · `CRITICAL · MIN_COVERAGE_GREEN(0,75)` · `MAJOR · MAX_GSD_CM(12)` · `MAJOR · MIN_FORWARD_OVERLAP(80)` |
| Recomendado | DRONE_T2 ou VTOL_T3 + CAM_MS5 |
| Souvenir / museu | `SV_CAP` / R$ 100/min |
| Plano de referência | DRONE_T2 · CAM_MS5 · H 120 · p 80 · q 65 · v 12 · `SUN_HIGH`. **Esperado:** GSD 7,53 cm · 9 linhas · 725,2 s |

**Diálogos:**
- **Briefing:**
  - "Eu vou mapear todas! Quer dizer… você vai."
  - "Os corredores de espécies raras ficam no capim alto."
  - "Se pisar lá, leva choque. Melhor voar."
- **Sucesso:**
  - "Incrível! Esse NDVI é super efetivo! Fica com meu boné reserva."
- **Falha:**
  - "Não foi muito efetivo…"

---

## R10 — Trincheira da Estrela de Ferro

| Campo | Valor |
| :--- | :--- |
| Cliente | **Lorde Válter**, executivo de armadura preta com respiração ruidosa (*"kshhh… kuuuh…"*). Retrato: `SHIELD` / `Orbit` / #0f172a / #ef4444 / "LV" |
| Objetivo | Inspeção LiDAR de alta densidade (> 100 pts/m²) dentro de uma trincheira metálica para checar uma **escotilha de exaustão de 2 m** |
| Bioma / seed | `RIFT_IRON_TRENCH` / 9010. Superfície metálica (`METAL`) com painéis cinza em grade, **trincheira** ao longo de `u` (50 m de largura, 40 m de profundidade), torres nas bordas (`TOWER`, 20 m), luzes de navegação piscando. Escotilha no fundo em (860, 60) |
| AOI | 120 × 900 m · teto 120 m · relevo 40 m |
| Iluminação / vento | `SUN_HIGH` (luz artificial fria) / 0, 0, 0° |
| Regras | `EM_INTERFERENCE`, `NARROW_TRENCH`, `FEATURE_TARGETS` |
| Alvos | `EXHAUST_PORT` (860, 60), r = 2, needs `LIDAR` |
| Requisitos | `CRITICAL · SENSOR_KIND(LIDAR)` · `CRITICAL · MIN_LIDAR_DENSITY(100)` · `CRITICAL · FEATURE_CAPTURED(EXHAUST_PORT)` |
| Recomendado | DRONE_T2 + POD_LIDAR, voando baixo e devagar |
| Souvenir / museu | `SV_EXHAUST_PORT` / R$ 200/min |
| Desbloqueio | `ALL[CONTRACT_DONE(C03), RIFTS_DONE(5)]` |
| Plano de referência | DRONE_T2 · POD_LIDAR (primário LIDAR) · H 60 · q 50 · v 8 · `SUN_HIGH`. **Esperado:** faixa de 84,02 m · 4 linhas · 524,8 s · 714 pts/m² |

**Diálogos:**
- **Briefing:**
  - "*kshhh… kuuuh…* Sua falta de pontos de controle é perturbadora."
  - "Inspecione a escotilha de exaustão. Dois metros. Densidade acima de cem."
- **Sucesso:**
  - "*kshhh…* Impressionante. Muito impressionante." *(Ele entrega uma miniatura da escotilha.)*
- **Falha:**
  - "Eu acho sua falta de densidade… perturbadora."

---

## R11 — Tumbas dos Desfiladeiros

| Campo | Valor |
| :--- | :--- |
| Cliente | **Dona Laura da Silva**, aristocrata aventureira de trança, com pistolas de tinta para marcar pontos de apoio em qualquer parede. Retrato: `DIAMOND` / `Crosshair` / #0d9488 / #78350f / "LS" |
| Objetivo | Fotogrametria **oblíqua (45°/60°)** de templos esculpidos em falésias verticais |
| Bioma / seed | `RIFT_CLIFF_TOMBS` / 9111. Cânion com **paredões verticais** de 60–100 m, **fachadas de templos** esculpidas na rocha (`CLIFF_TEMPLE`, 3 unidades), pontes de corda (`WIRE` entre as bordas), rio no fundo |
| AOI | 240 × 400 m · teto 120 m · relevo 100 m |
| Iluminação / vento | `SUN_HIGH`, `GOLDEN_HOUR`, `OVERCAST` / 5, 4, 90° (rajadas do cânion) |
| Regras | `EM_INTERFERENCE`, `VERTICAL_CLIFFS`, `FEATURE_TARGETS`, `PAINT_MARKERS` |
| Alvos | `TEMPLE_FACADE` (200, 60), r = 20, needs `PHOTO` |
| Requisitos | `CRITICAL · FLIGHT_MODE(OBLIQUE)` · `CRITICAL · FEATURE_CAPTURED(TEMPLE_FACADE)` · `MAJOR · MIN_COVERAGE_GREEN(0,75)` · `MAJOR · ACCURACY_ASPRS(6 cm H, 8 cm V)` · `MAJOR · MIN_GCP(5)` |
| Recomendado | DRONE_T2 + CAM_45MP_FF + LENS_24, oblíqua de 45° |
| Souvenir / museu | `SV_PAINT_PISTOL` / R$ 130/min |
| Plano de referência | DRONE_T2 · CAM_45MP_FF · LENS_24 · H 70 · p 80 · q 70 · v 6 · `OBLIQUE` 45° · `OVERCAST`. GCPs: (30,30), (370,30), (30,210), (370,210), (200,120). **Esperado:** GSD 1,28 cm · 9 linhas · 775,9 s |

**Diálogos:**
- **Briefing:**
  - "Querido, esses templos estão esculpidos na rocha há milênios."
  - "Câmera inclinada, por favor — fachadas não se fotografam de cima."
  - "Os pontos de apoio? Deixe comigo." *(Ela gira as pistolas de tinta.)*
- **Sucesso:**
  - "Esplêndido! Cada relevo, cada inscrição. Fique com uma das minhas pistolas."
- **Falha:**
  - "Lamentável. Os templos merecem mais que isso, querido."

---

## 3. Validação automática (REQ-CNT-006)

O script `scripts/check-forbidden-terms.mjs` faz `grep` case-insensitive em `src/` e falha se encontrar qualquer um destes termos:

> `sonic`, `mario`, `luigi`, `bowser`, `dragon ball`, `goku`, `kamehameha`, `zelda`, `link`(palavra inteira, exceto em `<Link`/`link` de CSS), `hyrule`, `triforce`, `minecraft`, `steve`, `creeper`, `witcher`, `geralt`, `metal gear`, `snake`(palavra inteira), `gta`, `san andreas`, `carl johnson`, `pokémon`, `pokemon`, `pikachu`, `ash`(palavra inteira), `star wars`, `vader`, `death star`, `tomb raider`, `lara croft`.

Os termos `link` e `snake` são verificados como palavra inteira em strings visíveis (`src/data/**`). A lista pode ser expandida.

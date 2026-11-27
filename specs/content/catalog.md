# Conteúdo — Catálogo de Itens, Habilidades e Balanceamento

> Valores **normativos** a implementar em `src/data/catalog/*.ts`, `src/data/skills.ts`, `src/data/cosmetics.ts`, `src/data/souvenirs.ts` e `src/data/fieldEvents.ts`. Preços em R$ (armazenados em centavos). Specs técnicas inspiradas em equipamentos reais, com nomes genéricos.
>
> **Requisitos cobertos:** REQ-PRG-002 a REQ-PRG-005, REQ-PRG-007, REQ-PRG-008, REQ-PRG-010, REQ-PRG-013, REQ-WLD-002, REQ-WLD-006, REQ-FLD-002, REQ-FLD-003.

---

## 1. Câmeras (`CameraSensor`)

| id | Nome | Tipo | Sensor (mm) | Imagem (px) | Pixel (µm) | Obturador | Focal | Crop | Penal. | Preço | Aeronaves |
| :--- | :--- | :--- | :--- | :--- | :-: | :--- | :--- | :-: | :-: | :-: | :--- |
| `CAM_PIGEON` | Câmera de Peito do Avô | RGB | 6,17 × 4,55 | 3264 × 2448 | 1,890 | MECHANICAL | fixa 4,5 mm | 5,64 | 1,30 | — (inicial) | ATLAS |
| `CAM_20MP_RS` | RGB 20 MP 1" Rolling Shutter | RGB | 13,2 × 8,8 | 5472 × 3648 | 2,412 | ROLLING (readout 30 ms) | fixa 8,8 mm (≈ 24 mm eq.) | 2,73 | 1,00 | incluída no Drone T1 | DRONE_T1 |
| `CAM_45MP_FF` | RGB 45 MP Full Frame Global | RGB | 35,9 × 24,0 | 8192 × 5460 | 4,382 | GLOBAL | intercambiável (24/35 mm) | 1,00 | 1,00 | R$ 38.000 (incluída no combo T2) | DRONE_T2, VTOL_T3 |
| `CAM_MS5` | Multiespectral 5 Bandas | MULTISPECTRAL (B, G, R, RE, NIR) | 7,12 × 5,33 | 2064 × 1544 | 3,450 | GLOBAL | fixa 5,5 mm | 4,87 | 1,10 | R$ 32.000 | DRONE_T2, VTOL_T3 |
| `CAM_THERMAL` | Termal Radiométrica 640 | THERMAL | 10,88 × 8,704 | 640 × 512 | 17,0 | GLOBAL | fixa 13 mm | 3,11 | 1,50 | R$ 26.000 | DRONE_T2 |
| `CAM_POD_RGB` | RGB 20 MP 4/3 do Pod | RGB | 17,3 × 13,0 | 5280 × 3956 | 3,277 | MECHANICAL | fixa 12,3 mm | 2,00 | 1,00 | incluída no Pod LiDAR | (via POD_LIDAR) |

**Lentes (`Lens`).** Aplicam-se só a câmeras `INTERCHANGEABLE`.

| id | Nome | Focal equivalente | Preço |
| :--- | :--- | :-: | :-: |
| `LENS_35` | Lente 35 mm | 35 mm | R$ 6.000 (incluída no combo T2) |
| `LENS_24` | Lente 24 mm Grande-Angular | 24 mm | R$ 6.000 |

---

## 2. Pod LiDAR (`LidarPayload`, Tier 4)

| id | Nome | PRR | FOV | Retornos | σ alcance | Varredura (visual) | RGB | Preço | Aeronaves | Exige |
| :--- | :--- | :-: | :-: | :-: | :-: | :-: | :--- | :-: | :--- | :--- |
| `POD_LIDAR` | Pod LiDAR "Vaga-lume" | 240 kHz | 70° | 5 | 0,03 m | 2 Hz | `CAM_POD_RGB` | R$ 150.000 | DRONE_T2, VTOL_T3 | possuir VTOL_T3 |

Inclui uma IMU tática (já embutida no modelo de ruído de [domain-math §4.3](../design/domain-math.md)).

---

## 3. Aeronaves (`Aircraft`)

| Campo | `ATLAS` | `DRONE_T1` | `DRONE_T2` | `VTOL_T3` |
| :--- | :-: | :-: | :-: | :-: |
| Nome | Pombo Atlas | Drone Amador "Faísca" | Multirrotor Pro RTK "Condor" | Asa Fixa VTOL "Albatroz" |
| Tier | 0 | 1 | 2 | 3 |
| Tipo | BIRD | MULTIROTOR | MULTIROTOR | FIXED_WING_VTOL |
| vMin / vCruise / vMax (m/s) | 4 / 10 / 16 | 1 / 8 / 15 | 1 / 10 / 18 | 14 / 20 / 28 |
| Aceleração (m/s²) | 3 | 4 | 5 | 3 |
| Vel. lateral máx (m/s) | 6 | 8 | 9 | — (v²/R) |
| Subida (m/s) | 5 | 6 | 7 | 6 |
| H AGL mín–máx (m) | 20–120 | 20–120 | 20–120 | 60–300 |
| Autonomia | 600 s (10 milhos × 60 s) | 720 s (12 min) | 2100 s (35 min) | 5400 s (90 min) |
| Energia | CORN | BATTERY | BATTERY | BATTERY |
| Baterias reserva/missão | — (estoque de milho) | 2 | 3 | 1 |
| RTK | não | não | **sim** | **sim** |
| Vento tolerado (m/s) | 8 | 8 | 12 | 14 |
| driftFactor | 0,5 | 0,8 | 0,6 | 0,7 |
| Raio de curva (m) | 0 | 0 | 0 | 80 |
| Casco | 3 | 3 | 4 | 4 |
| Raio de colisão (m) | 0,5 | 0,4 | 0,8 | 1,5 |
| Gimbal oblíquo | não | **sim** | **sim** | não |
| Terrain Following | não | não | **sim** | **sim** |
| Imune a EM | **sim** | não | não | não |
| Sensores | CAM_PIGEON | CAM_20MP_RS | CAM_45MP_FF, CAM_MS5, CAM_THERMAL, POD_LIDAR | CAM_45MP_FF, CAM_MS5, POD_LIDAR |
| Preço | — (inicial) | R$ 6.000 | R$ 70.000 (**combo**) | R$ 120.000 |
| Exige possuir | — | — | DRONE_T1 | DRONE_T2 |
| Custo de reparo após queda | 0 % ("Atlas descansa") | 15 % | 12 % | 10 % |

- **Subida e teto do Atlas ([ADR-035](../decisions.md)):** as razões de subida cresceram (Atlas 3 → 5, T1 4 → 6, T2 5 → 7, VTOL 4 → 6 m/s), para a aeronave responder às rajadas e correntes verticais, e o Atlas sobe até 120 m (eram 80 m): no C01 ele voa acima dos prédios.
- **Combo Condor (T2):** a compra adiciona `DRONE_T2`, `CAM_45MP_FF`, `LENS_35` e `GNSS_RTK_KIT`. Itens já possuídos são ignorados, sem reembolso.
- **RTK efetivo:** a aeronave precisa de `rtk = true` **e** o jogador precisa possuir o `GNSS_RTK_KIT`. Sem o kit, o RTK fica `NONE`.

---

## 4. Equipamento de campo (`FieldEquipment`)

| id | Nome | σ base | Máx. pontos (GCP + CP) | Correção RTK | Preço |
| :--- | :--- | :-: | :-: | :-: | :-: |
| `TOTAL_STATION` | Estação Total do Avô | 0,010 m | 8 | não | — (inicial) |
| `GNSS_RTK_KIT` | Kit GNSS RTK Base + Rover | 0,015 m (z × 1,5) | 20 (GCP ≤ 12, CP ≤ 8) | **sim** | R$ 15.000 (incluído no combo T2) |

Quando o jogador possui os dois, o Field Setup usa o `GNSS_RTK_KIT` para os limites de pontos, e o jogador escolhe o instrumento de medição dos GCPs num toggle: a Estação Total é mais precisa, e o GNSS permite mais pontos.

---

## 5. Veículos (`Vehicle`) — velocidade em tiles/s por tipo de tile

| Tile | `FOOT_BIKE` | `COMPACT_CAR` | `PICKUP_4X4` | `LAB_VAN` |
| :--- | :-: | :-: | :-: | :-: |
| ROAD_PAVED | 6 | 12 | 10 | 10 |
| ROAD_DIRT | 5 | 7 | 9 | 6 |
| TRAIL | 4 | — | 7 | — |
| GRASS | 3 | — | 6 | — |
| FOREST | 2 | — | 3 | — |
| SAND | 2,5 | — | 5 | — |
| HILL | 2 | — | 5 | — |
| HILL_STEEP | — | — | 3 | — |
| SWAMP | — | — | 3 | — |
| SNOW | 1,5 | — | 4 | — |
| URBAN | 5 | 9 | 7 | 8 |
| BRIDGE | 6 | 12 | 10 | 10 |
| WATER, MOUNTAIN, BUILDING | — | — | — | — |

| Campo | `FOOT_BIKE` | `COMPACT_CAR` | `PICKUP_4X4` | `LAB_VAN` |
| :--- | :-: | :-: | :-: | :-: |
| Nome | A Pé / Bicicleta | Carro Compacto | Picape 4x4 Off-Road | Van Laboratório Móvel |
| Preço | — (inicial) | R$ 18.000 | R$ 55.000 | R$ 90.000 |
| Rede de acesso p/ GCP | ROADS_TRAILS | ROADS | OFFROAD | ROADS |
| Alcance a partir da rede (m) | 150 | 150 | 400 | 150 |
| Declividade máx. (%) | 30 | 30 | 60 | 30 |
| Brejo | não | não | **sim** | não |
| Processa em campo | não | não | não | **sim** (fator 2,5) |

**Acessibilidade de GCP no Field Setup.** É a **união** sobre os veículos possuídos. O ponto é inválido em qualquer um destes casos:
1. água;
2. telhado (`ROOF`);
3. dossel > 0,6 (sem visada aérea do alvo);
4. fora do alcance de todos os veículos possuídos, considerando rede, distância, declividade e brejo.

A regra `PAINT_MARKERS` (R11) ignora o item 4.

---

## 6. Hardware de processamento (`Hardware`)

| id | Nome | speedFactor | Preço |
| :--- | :--- | :-: | :-: |
| `OLD_LAPTOP` | Notebook Velho Lento | 1,0 | — (inicial) |
| `GAMER_PC` | PC Gamer | 2,5 | R$ 9.000 |
| `MULTI_GPU_WS` | Workstation Multi-GPU | 6,0 | R$ 35.000 |
| `CLOUD` | Servidores em Nuvem | 15,0 | R$ 80.000 |

O hardware é **substituído** na compra, porque só existe um ativo. A compra exige possuir o anterior da lista.

---

## 7. Equipe (`StaffRole`)

| id | Nome | Contratação | Custo por missão processada | Bônus de pagamento (por pessoa) | Bônus de velocidade (por pessoa) | Máx. |
| :--- | :--- | :-: | :-: | :-: | :-: | :-: |
| `INTERN` | Estagiário(a) | R$ 1.500 | R$ 500 | +6 % | +5 % | 3 |
| `JUNIOR_ENG` | Engenheiro(a) Júnior | R$ 6.000 | R$ 1.800 | +15 % | +10 % | 2 |

Demitir não tem custo nem reembolso.

---

## 8. Milho e Atlas

| Item | Valor |
| :--- | :--- |
| Preço do milho | R$ 5 por unidade (pacotes de 10 e 50) |
| Capacidade do papo | 10 unidades (= 600 s de voo) |
| Calibração da câmera de Atlas | Grátis. Vale 3 voos. Reduz a penalidade da câmera de 1,30 para 1,15 |
| Distração (REQ-FLT-015) | Chance de 0,15 por linha. Desvio-alvo de ±20 m por 2–3 s. Anula-se se o jogador segurar o lado oposto com intensidade > 0,7 por 0,5 s |

---

## 9. Árvore de habilidades (`SkillNode`)

Custo: rank 1 = 1 ponto, rank 2 = 1, rank 3 = 2, rank 4 = 2. São 6 pontos por ramo e 18 no total. Os pré-requisitos são lineares dentro do ramo.

| id | Ramo | Nome | Efeitos (`Modifier`) |
| :--- | :--- | :--- | :--- |
| `PIL_1` | Pilotagem & Campo | Mãos Firmes | `windDrift` × 0,8 |
| `PIL_2` | Pilotagem & Campo | Fôlego Extra | `endurance` × 1,15 |
| `PIL_3` | Pilotagem & Campo | Pé na Estrada | `overworldSpeed` × 1,2 |
| `PIL_4` | Pilotagem & Campo | Ás das Correntes | `windDrift` × 0,75 ; `thermalEffect` × 0,5 |
| `ENG_1` | Engenharia & Sensores | Olho de SIFT | `rmseGlobal` × 0,9 ; `texturePenalty` × 0,5 |
| `ENG_2` | Engenharia & Sensores | Filtro de Ruído LiDAR | `lidarNoise` × 0,7 |
| `ENG_3` | Engenharia & Sensores | Correção de Rolling Shutter | `rollingShutterPenalty` × 0 |
| `ENG_4` | Engenharia & Sensores | Mestre do Bundle | `rmseGlobal` × 0,85 |
| `GES_1` | Gestão & Curadoria | Negociador | `contractPayment` × 1,25 |
| `GES_2` | Gestão & Curadoria | Curador | `museumVisitors` × 1,5 |
| `GES_3` | Gestão & Curadoria | Rede de Fornecedores | `shopPrice` × 0,85 |
| `GES_4` | Gestão & Curadoria | Marca Forte | `reputationGain` × 1,5 ; `rivalChance` × 0,5 |

`applyModifiers(skills)` começa com todos os valores em 1. `mul` multiplica e `add` soma.

---

## 10. Cosméticos (`Cosmetic`)

| id | Slot | Nome | Preço | Desbloqueio | Cores (primária/secundária) |
| :--- | :--- | :--- | :-: | :--- | :--- |
| `CHAR_VEST` | CHARACTER | Colete Laranja Clássico | inicial | — | #f97316 / #1e293b |
| `CHAR_LABCOAT` | CHARACTER | Jaleco de Campo | R$ 800 | — | #e2e8f0 / #0e7490 |
| `CHAR_UNIFORM` | CHARACTER | Uniforme GeoSurvey | R$ 1.500 | nível 3 | #0891b2 / #f8fafc |
| `CHAR_RAINCOAT` | CHARACTER | Capa de Chuva Amarela | R$ 1.000 | — | #facc15 / #1e293b |
| `CHAR_GRANDPA_HAT` | CHARACTER | Chapéu do Avô | — | final da campanha (REQ-CNT-008) | #92400e / #fde68a |
| `CHAR_MULTIVERSE` | CHARACTER | Traje Multiverso | — | 6 fendas concluídas | #8b5cf6 / #22d3ee |
| `PAINT_GREY` | DRONE_PAINT | Cinza Padrão | inicial | — | #64748b / #0f172a |
| `PAINT_RADAR` | DRONE_PAINT | Ciano Radar | R$ 600 | — | #22d3ee / #0f172a |
| `PAINT_AMBER` | DRONE_PAINT | Âmbar Alerta | R$ 600 | — | #fbbf24 / #1e293b |
| `PAINT_EMERALD` | DRONE_PAINT | Verde Esmeralda | R$ 600 | — | #34d399 / #022c22 |
| `PAINT_CAMO` | DRONE_PAINT | Camuflagem | R$ 1.200 | C03 concluído | #4d7c0f / #365314 |
| `PAINT_HOLO` | DRONE_PAINT | Holográfico | — | 11 fendas concluídas | #a78bfa / #22d3ee |
| `ATLAS_NONE` | ATLAS_ACCESSORY | Sem acessório | inicial | — | — |
| `ATLAS_GOGGLES` | ATLAS_ACCESSORY | Óculos de Aviador | R$ 300 | — | #78350f / #fde68a |
| `ATLAS_SCARF` | ATLAS_ACCESSORY | Cachecol Vermelho | R$ 300 | — | #dc2626 / #fecaca |
| `ATLAS_GPS_PACK` | ATLAS_ACCESSORY | Mochilinha GPS | R$ 700 | GNSS_RTK_KIT possuído | #0f172a / #22d3ee |
| `ATLAS_LAUREL` | ATLAS_ACCESSORY | Coroa de Louros | — | C03 concluído | #65a30d / #fef08a |

**Emblema inicial:** `{ shape: 'SHIELD', icon: 'Compass', primary: '#22d3ee', secondary: '#0f172a', initials: 'GS' }`.

**Paleta permitida no editor:** as cores dos tokens de [ui-style §1](../design/ui-style.md), mais `#f97316`, `#facc15`, `#e2e8f0` e `#8b5cf6`.

---

## 11. Souvenirs (`Souvenir`) — 18 itens

| id | Contrato | Nome | Ícone lucide | Cor |
| :--- | :--- | :--- | :--- | :--- |
| `SV_NOTEBOOK` | C00 | Caderneta de Campo do Avô | `NotebookPen` | #fde68a |
| `SV_CITY_KEY` | C01 | Chave da Cidade | `KeyRound` | #fbbf24 |
| `SV_CORN_GOLD` | C02 | Espiga Dourada | `Wheat` | #facc15 |
| `SV_BRAZIL_NUT` | C03 | Semente de Castanheira | `Sprout` | #65a30d |
| `SV_ORE_NUGGET` | C04 | Pepita de Minério | `Gem` | #f97316 |
| `SV_TILE` | C05 | Azulejo Português | `Grid3x3` | #3b82f6 |
| `SV_BOTTLE_MAP` | C06 | Garrafa com Mapa | `Wine` | #22d3ee |
| `SV_GOLD_RING` | R01 | Anel Dourado | `CircleDot` | #facc15 |
| `SV_GREEN_PIPE` | R02 | Cano Verde em Miniatura | `Cylinder` | #22c55e |
| `SV_STAR_SPHERE` | R03 | Esfera Laranja de 4 Estrelas | `Sparkle` | #fb923c |
| `SV_TRIANGLE` | R04 | Fragmento do Triângulo Geodésico | `Triangle` | #fde047 |
| `SV_CUBE_ORE` | R05 | Bloco de Minério Cúbico | `Box` | #38bdf8 |
| `SV_THEODOLITE_SWORD` | R06 | Espada-Teodolito em Miniatura | `Sword` | #cbd5e1 |
| `SV_CARDBOARD_BOX` | R07 | Caixa de Papelão | `Package` | #a16207 |
| `SV_BMX` | R08 | BMX em Miniatura | `Bike` | #ef4444 |
| `SV_CAP` | R09 | Boné Virado para Trás | `HardHat` | #ef4444 |
| `SV_EXHAUST_PORT` | R10 | Escotilha de Exaustão (miniatura) | `CircleDashed` | #94a3b8 |
| `SV_PAINT_PISTOL` | R11 | Pistola de Tinta Marcadora | `Paintbrush` | #ec4899 |

Cada souvenir tem um texto `story` de 1 a 2 frases, escrito pelo implementador no tom do cliente. Esses textos ficam em `src/data/souvenirs.ts`.

---

## 12. Eventos de campo (`fieldEvents.ts`)

| id | Peso | Condição | Efeito | Interação |
| :--- | :-: | :--- | :--- | :--- |
| `FLAT_TIRE` | 2 | Veículo com rodas | Parado até reparar | "Trocar pneu" (mash de `INTERACT` 10×) **ou** "Chamar guincho" (R$ 150) |
| `CATTLE` | 2 | Veículo com rodas | Bloqueio de 3 s | `INTERACT` = buzinar (−1 s por toque, mínimo 0) |
| `LOST_BENCHMARK` | 2 | — | +50 XP, +R$ 100, som `COLLECT` | Toast + diálogo curto sobre o marco geodésico |
| `SUSPICIOUS_OWNER` | 2 | — | Diálogo com 2 escolhas | "Mostrar autorização" (reputação ≥ 40: +1 reputação; < 40: −1) **ou** "Pagar um café" (−R$ 50, +1 reputação) |
| `SUDDEN_RAIN` | 1 | — | −30 % de velocidade por 15 s e partículas de chuva | — |
| `ATLAS_FINDS_CORN` | 1 | — | +3 de milho no estoque, som `PIGEON_COO` | Toast |

---

## 13. Balanceamento-alvo (referência para testes de simulação de campanha)

- **Tempo de jogo** para concluir os 7 contratos reais: ~3 a 5 h. Para concluir tudo, incluindo as 11 fendas: ~8 a 10 h.
- **Duração de uma missão de referência**: 3 a 13 min a ×1, ou 2 a 6 min usando `TIME_WARP`.
- O teste de "campanha simulada" (T071) deve provar que, seguindo a ordem C00 → C01 → R01 → R02 → C05 → C06 → R07 → R08 → R11 → C02 → R09 → C04 → R03 → R05 → C03, com score fixo de 0,8, sem renda passiva e sem equipe, o jogador consegue comprar **os itens do plano de referência** de cada contrato antes de aceitá-lo. Se faltar dinheiro, o teste indica quanto falta, e o balanceamento deve ser ajustado com ADR.
- Simulação manual feita na conversão (qualityFactor 0,92):

  | Etapa | Saldo após o contrato |
  | :--- | :-: |
  | C00 | R$ 7.300 |
  | C01 (−T1) | R$ 12.340 |
  | R01 | R$ 35.340 |
  | R02 | R$ 62.940 |
  | C05 | R$ 79.500 |
  | C06 (−combo T2) | R$ 29.740 |
  | R07 | R$ 94.140 |
  | R08 | R$ 119.900 |
  | R11 | R$ 179.700 |
  | C02 (−T3 −MS5) | R$ 59.900 |
  | R09 | R$ 96.700 |
  | C04 (−4x4) | R$ 92.300 |
  | R03 | R$ 133.700 |
  | R05 | R$ 179.700 |
  | C03 (−Pod) | R$ 112.500 |

  A campanha é viável nessa ordem.

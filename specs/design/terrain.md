# Design — Terreno Procedural e Biomas

> Como o `TerrainSampler` ([architecture §5](architecture.md)) é gerado para cada contrato. O mesmo terreno alimenta o Field Setup, o voo 2.5D, a cobertura, os produtos (rasters e nuvem) e a mesa holográfica.
>
> **Requisitos cobertos:** REQ-CORE-006, REQ-FLD-001, REQ-FLT-002, REQ-FLT-011, REQ-CNT-004.

---

## 1. Ruído e utilitários (`world/terrain/noise.ts`)

```ts
valueNoise2D(seed: number): (x: number, y: number) => number   // [-1, 1], interpolação smoothstep, grade inteira com hash
fbm(noise, x, y, { octaves, lacunarity = 2, gain = 0.5 }): number
ridged(noise, x, y, octaves): number                            // 1 − |n| acumulado
domainWarp(noise, x, y, amount): [number, number]
```
- O hash da grade é `hash2(ix, iy, seed)`, de inteiros 32 bits (`Math.imul`), **sem** `Math.random`.
- **Desempenho:** `elevation(u,v)` deve custar < 2 µs por chamada. Como o voo amostra cerca de 3.000 pontos por frame, use no máximo 5 oitavas.

---

## 2. Receita de bioma (`world/terrain/biomes/<id>.ts`)

```ts
export interface BiomeRecipe {
  id: BiomeId;
  palette: BiomePalette;                     // cores por LandCover + céu (topo/horizonte) + névoa + água
  baseElevation(u: number, v: number, n: NoiseKit): number;     // relevo de solo nu
  landCover(u: number, v: number, elev: number, n: NoiseKit): LandCover;
  canopy(u: number, v: number, cover: LandCover, n: NoiseKit): number;
  ndvi(u: number, v: number, cover: LandCover, n: NoiseKit): number;
  roads(aoi, rng): Polyline[];               // rede viária (para acessibilidade e render)
  placeObjects(ctx: PlacementCtx, rng): WorldObject[];
  features?(aoi): FeatureTarget[];
  zones?(objects, aoi, rng): SpecialZone[];
  guaranteedAccessible?: AoiPoint[];         // pontos garantidamente acessíveis (clareiras, praia), usados no plano de referência
}
```

`createTerrain(contract)` monta o sampler:
1. Cria o `rng` com a seed do contrato.
2. Gera estradas, objetos, zonas e features **uma vez** e os guarda ordenados por `u`.
3. Expõe as funções de amostragem:
   - `elevation` é a receita base mais os modificadores: crateras, cavas, trincheira e quantização.
   - `surface = max(elevation, topo do objeto/copa sob o ponto)`, consultado por um *spatial hash* de 16 m.
   - `distanceToRoad`: um raster de distâncias de 4 m de resolução, pré-computado por *chamfer distance*.
   - `slopePct`: diferenças finitas de 2 m.
4. Memoiza o resultado por `contract.id`.

---

## 3. Biomas — parâmetros

| Bioma | Relevo (receita) | Cobertura | Objetos principais | Zonas/Features |
| :--- | :--- | :--- | :--- | :--- |
| `RURAL_TUTORIAL` | `fbm` 3 oitavas, escala 120 m, amplitude 15 m | GRASS; pomar (FOREST, dossel 0,5) num retângulo; açude (WATER) com r = 18 m em (60, 120); estrada de terra diagonal | Casa sede (BUILDING 12 × 10 × 6), 25 árvores, cerca (POLE baixo, não sólido) | — |
| `URBAN_VERTICAL` | Plano, com variação de 10 m | URBAN/ROAD em grade de 70 m; ROOF sob os prédios; praça GRASS central | Prédios por quadra (2–6), altura `10 + 80·r³`, 20 % > 60 m garantidos | `RTK_CANYON` calculado |
| `AGRI_PLATEAU` | `fbm` 2 oitavas, escala 600 m, amplitude 30 m | CROP em talhões de 150–300 m, com NDVI = 0,55–0,85 menos manchas de estresse (`fbm`, até −0,4); estradas internas ROAD | 3 pivôs (círculos de CROP com estrutura POLE radial, não sólidos), silos | — |
| `AMAZON` | `fbm` 4 oitavas, escala 200 m, amplitude 40 m; igarapé escavado 4 m ao longo de uma senoide | FOREST (dossel 0,9–0,98); 7 clareiras GRASS fixas; WATER no igarapé | ~1 árvore a cada 12 m² renderizada como LOD (copas aglutinadas a cada 15 m), altura 25–45 m | Clareiras como `guaranteedAccessible` |
| `OPEN_PIT_MINE` | Cava: `elev = −150·clamp(1 − d/R)` quantizada em bancadas de 15 m com bermas de 8 m (R = 220 m, centro na AOI); bordas com `ridged` | BENCH/ROCK; rampas ROAD em espiral | Pilhas cônicas (r = 30–50, h = 20–35, via relevo), torres de britagem (BUILDING 15 × 15 × 30) | GCPs nas bermas como `guaranteedAccessible` |
| `COLONIAL_CENTER` | Ladeira: plano inclinado de 25 m + `fbm` leve | ROAD (pedra) e ROOF | Casarões em fileira (8–10 m), igreja (BUILDING 30 × 20 × 18 + 2 TOWER de 35 m), postes e fios a 8–14 m | — |
| `COASTAL_ESTUARY` | Dunas: `fbm` em v ∈ [0,170], amplitude 20 m; v > 170 → mar (−2 m) com canal sinuoso cortando a terra | SAND, GRASS (restinga), FOREST (mangue, dossel 0,7), WATER | Farol (TOWER 25 m), barcos (não sólidos) | `WATER`; faixa v ∈ [0,170] garantida como terra |
| `RIFT_GREEN_HILLS` | Senoides cruzadas, amplitude 35 m, comprimento de onda de 120 m | GRASS (xadrez de 8 m em duas cores) | STONE_ARCH ×6, RING ×40 (alinhados em arcos sobre as linhas), palmeiras | — |
| `RIFT_PIPES` | `fbm` suave, 20 m; morrinhos semiesféricos | GRASS | PIPE ×14, BRICK_PLATFORM ×10, MOVING_HAZARD ×8 | — |
| `RIFT_CRATERS` | Planalto `ridged` com 60 m de amplitude, mais crateras `−0,4r·(1 − (d/r)²)` | ROCK, SAND | ENERGY_BEAM ×6 | — |
| `RIFT_FAIRY_FOREST` | `fbm` de 30 m, mais o templo: platô de +3 m sob o solo (só no MDT), r = 30 em (300, 200) | FOREST (dossel 0,95) | Troncos gigantes, cogumelos (decorativos) | Feature `TEMPLE`; zona `FOG` com densidade 0,9 |
| `RIFT_CUBES` | `floor(fbm·80/4)·4` | GRASS no topo, ROCK nas paredes, LAVA abaixo da cota 8 | CUBE_BLOCK ×30, árvores cúbicas | `THERMAL` sobre a lava |
| `RIFT_GREY_SWAMP` | Plano com `fbm` de 8 m | SWAMP, WATER (poças) | Árvores mortas, ruínas | Features `DEN_A/B/C` (térmicas) |
| `RIFT_POLAR_BASE` | Plano, `fbm` de 15 m | SNOW, ROOF (hangares) | Hangares, cercas, torres de vigia, `GIANT_WALKER` em (150, 120) | `SEARCHLIGHT` ×4; feature `WALKER` |
| `RIFT_SANTOS_HOOD` | Ondulado, 20 m | URBAN denso, ROAD (vielas de 4–6 m) | Casas de 6–12 m coladas, postes e fios, palmeiras, quadra | — |
| `RIFT_TALL_GRASS` | `fbm` de 20 m | GRASS (NDVI alto nas manchas de capim), ROAD (trilhas), WATER (lago) | Árvores isoladas | Picos `ELECTRIC_CREATURES` (no voo) |
| `RIFT_IRON_TRENCH` | Plano metálico, mais a trincheira: `elev = −40` para \|v − 60\| < 25, com paredes verticais | METAL | TOWER ×12 nas bordas | Feature `EXHAUST_PORT` |
| `RIFT_CLIFF_TOMBS` | Cânion: `elev = 100·smoothstep(25, 35, \|v − 120\| − 60)`, quase vertical; rio no fundo | ROCK, SAND, WATER | CLIFF_TEMPLE ×3, pontes WIRE | Feature `TEMPLE_FACADE` |

**Paletas:**
- Cada bioma define as cores em RGB por `LandCover`, o gradiente de céu e a cor de névoa.
- O voo multiplica pelo hillshade.
- O satélite do Field Setup usa a cor plana mais o hillshade e as sombras de objetos conforme a iluminação.
- Fendas usam saturação aumentada.

---

## 4. Objetos e colisão

| Kind | Forma de colisão | Render 2.5D | Render top-down |
| :--- | :--- | :--- | :--- |
| BUILDING, CUBE_BLOCK, BRICK_PLATFORM, TOWER, CLIFF_TEMPLE, GIANT_WALKER | AABB (rotacionada por `rotationRad`) com `baseM`..`baseM+heightM` | Caixa com 3 faces visíveis (topo + frente + lateral), sombreamento por face | Retângulo do telhado com sombra |
| TREE | Cilindro do tronco (r = 0,6) + esfera ou cone da copa (r = largura/2) | Tronco (retângulo) + copa (elipse/triângulo) | Círculo da copa |
| PIPE | Cilindro vertical | Retângulo com borda superior elíptica (aba) | Círculo com anel |
| POLE | Cilindro fino (r = 0,3) | Linha vertical | Ponto |
| WIRE | Segmento 3D com raio de 0,5 m | Linha entre os topos dos postes, com catenária leve | Linha fina |
| STONE_ARCH | Duas colunas + viga (3 AABBs). O vão é livre | Arco poligonal | Duas manchas |
| RING | Não sólido; coleta se \|pos − centro\| < 3 m | Elipse dourada (anel de 2 px de espessura × escala) | Círculo dourado |
| ENERGY_BEAM | Cilindro, só quando ligado | Retângulo luminoso translúcido, pulsando | Ponto brilhante |
| MOVING_HAZARD | Esfera | Círculo com sombra no chão | Círculo |
| SEARCHLIGHT | Não sólido (zona) | Cone luminoso no chão (elipse) | Círculo amarelo translúcido |
| GCP_TARGET | Não sólido | Quadrado xadrez no chão, projetado | Quadrado xadrez |

Os objetos são gerados uma vez. Os móveis e os que piscam calculam o estado a partir de `t` (função pura de tempo), o que mantém o determinismo.

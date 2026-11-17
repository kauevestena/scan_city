# Design — Matemática do Domínio

> Especificação **normativa** de todas as fórmulas e modelos do jogo. Cada função listada deve existir em `src/domain/` com a assinatura indicada e ser testada com os *golden values* da §14 (tolerância relativa de 1e-3, salvo indicação).
>
> **Requisitos cobertos:** REQ-FLD-007, REQ-FLT-001, REQ-FLT-007, REQ-FLT-008, REQ-FLT-009, REQ-FLT-012, REQ-FLT-013, REQ-FLT-014, REQ-FLT-016, REQ-FLT-017, REQ-FLT-025 a REQ-FLT-028, REQ-PRC-002 a REQ-PRC-007, REQ-PRC-009, REQ-PRC-013, REQ-PRC-014, REQ-PRG-006, REQ-PRG-009, REQ-LAB-005.

**Convenções:**
- Entradas e saídas em SI: m, s, rad, m/s, Hz.
- Percentuais (`p`, `q`) entram como **número de 0 a 100**.
- `GSD` é retornado em **m/px**, e a UI converte para cm/px.
- Funções puras, sem estado global.

---

## 1. Geometria do sensor

```ts
pixelPitchM(sensor: CameraSensor): number            // = sensorWidthMm / imageWidthPx / 1000
realFocalM(sensor: CameraSensor, lens?: Lens): number // FIXED → fixedFocalMm/1000 ; INTERCHANGEABLE → (lens.equivFocalMm / sensor.cropFactor)/1000
verticalFovRad(sensor, focalM): number               // 2·atan(sensorHeightMm/1000 / (2·focalM))
horizontalFovRad(sensor, focalM): number             // 2·atan(sensorWidthMm/1000 / (2·focalM))
```

**Orientação:** o lado **largo** do sensor (`sensorWidthMm`) fica **transversal** à linha de voo, e o lado curto fica ao longo dela. Esse é o padrão em drones de mapeamento.

---

## 2. Fotogrametria (fórmulas do spec original)

### 2.1 GSD
$$GSD = \frac{H \cdot s_{pixel}}{f}$$
```ts
gsd(heightM: number, pixelPitchM: number, focalM: number): number   // m/px
```

### 2.2 Pegada no solo
$$W_g = \frac{H \cdot W_{sensor}}{f}, \quad H_g = \frac{H \cdot H_{sensor}}{f}$$
```ts
footprint(heightM, sensorWidthM, sensorHeightM, focalM): { widthM: number; heightM: number }
```

### 2.3 Base aérea e espaçamento
$$B = H_g\left(1 - \frac{p}{100}\right), \quad S = W_g\left(1 - \frac{q}{100}\right)$$
```ts
airBase(footprintHeightM, forwardOverlapPct): number
lineSpacing(footprintWidthM, sideOverlapPct): number
```

### 2.4 Lente equivalente (ADR-005)
`f_real = f_equivalente / cropFactor`. No full-frame (crop 1,0), 24 mm e 35 mm são focais reais. Câmeras `FIXED` ignoram a lente escolhida.

### 2.5 Intervalo de disparo
$$\Delta t = \frac{B}{v_{voo}}$$
```ts
shotInterval(baseM, speedMs): number
```

### 2.6 Linhas, fotos e tempo de voo
```ts
planLineCount(acrossM, spacingM): number            // ceil(acrossM / spacingM) + 1   (mínimo 2)
linePositions(acrossM, spacingM, n): number[]       // centradas: v_k = v0 + k·S, v0 = (acrossM − (n−1)·S)/2
photosPerLine(alongM, baseM): number                // floor(alongM / B) + 3   (janela da câmera: AOI ± 1 base)
leadM(aircraft): number                             // max(30, turnRadiusM)
turnTimeS(aircraft, spacingM, speedMs): number
//   turnRadiusM == 0 → spacingM / speedMs + 3
//   senão           → (π·R + |spacingM − 2R|) / speedMs
flightTimeS(nLines, lineLengthM, speedMs, turnS): number   // nLines·lineLengthM/v + (nLines−1)·turnS + 20 (decolagem+pouso)
batteriesNeeded(flightTimeS, enduranceS): number           // ceil(flightTimeS / (0,8·enduranceS))   (reserva de 20 %)
```
- **Malha cruzada:** gera um segundo conjunto de linhas perpendiculares sobre a mesma AOI, trocando `along` e `across`. O total de linhas é a soma dos dois conjuntos.
- **Modo oblíquo:** `B` e `S` usam a pegada **nadiral** (conservador). A pegada oblíqua (§2.8) só é usada na cobertura.
- **LiDAR como sensor primário:** a largura usada para `S` é a **faixa LiDAR** (§4.1) no lugar de `W_g`, e `q` é aplicado sobre ela.

### 2.7 Exposição, motion blur e rolling shutter

| Iluminação (`LightingId`) | t_exp (s) | Elevação solar | Tipo de sombra |
| :--- | :--- | :--- | :--- |
| `SUN_HIGH` | 1/2000 | 70° | curta e dura |
| `OVERCAST` | 1/800 | — | sem sombra (difusa) |
| `GOLDEN_HOUR` | 1/250 | 8° | longa |
| `BLIZZARD` | 1/500 | — | difusa |
| `MAGIC_FOG` | 1/400 | — | difusa |

```ts
exposureTimeS(lighting): number
motionBlurPx(speedMs, exposureS, gsdM): number          // v·t_exp / GSD
rollingShutterSkewPx(speedMs, readoutS, gsdM): number   // v·t_readout / GSD  (0 se GLOBAL/MECHANICAL)
blurClass(px): 'OK' | 'WARN' | 'BLURRED'                // < 0,5 | 0,5..1,0 | > 1,0
```

### 2.8 Pegada oblíqua
Com inclinação θ a partir do nadir e FOV vertical α_v:
$$d_{near} = H\tan(\theta - \alpha_v/2), \quad d_{far} = H\tan(\theta + \alpha_v/2), \quad W_c = \frac{H}{\cos\theta}\cdot\frac{W_{sensor}}{f}$$
```ts
obliqueFootprint(heightM, tiltRad, sensorWidthM, focalM, vFovRad): { nearM; farM; lengthM; centerOffsetM; widthCenterM }
```
- `θ + α_v/2` é limitado a 85°.
- Para cobertura, a pegada oblíqua é aproximada por um retângulo de comprimento `far − near` e largura `W_c`, deslocado à frente por `(near + far)/2`.
- O **GSD oblíquo** no centro é `GSD_nadir / cos²θ`.

### 2.9 Sobreposição real em voo
Os disparos são **por tempo** (ADR-004). Entre dois disparos consecutivos *i−1* e *i* da mesma linha:
$$p_{real} = 1 - \frac{d(i-1, i)}{H_g(AGL_i)}$$
```ts
realForwardOverlap(distanceM, footprintHeightM): number    // fração (pode ser negativa → buraco)
realSideOverlap(crossTrackErrorM, spacingM, footprintWidthM): number // 1 − (S + |e|)/W_g
```
Voar mais rápido que o planejado aumenta `d`. Voar mais baixo reduz `H_g`. As duas coisas reduzem `p_real`.

---

## 3. Estereoscopia (Laboratório)

```ts
photoBaseM(B, f, H): number                       // b = B·f/H  (no plano-imagem)
parallaxDiffM(B, f, H, h): number                 // Δp = B·f·h / (H·(H−h))
heightFromParallax(H, b, dp): number              // h = H·Δp / (b + Δp)
baseHeightRatio(B, H): number                     // B/H
depthPrecisionM(H, B, f, sigmaPxM): number        // σ_Z = H² / (B·f) · σ_px    (σ_px em metros no sensor)
```
A identidade `heightFromParallax(H, photoBaseM(...), parallaxDiffM(...)) === h` deve valer com tolerância de 1e-9.

---

## 4. LiDAR

### 4.1 Faixa e densidade
$$swath = 2H\tan(FOV/2), \qquad \rho = \frac{PRR}{v \cdot swath}$$
```ts
lidarSwathM(heightM, fovRad): number
lidarDensity(prrHz, speedMs, heightM, fovRad): number             // pts/m² por passada
lidarDensityWithOverlap(prrHz, speedMs, heightM, fovRad, sideOverlapPct): number   // ρ / (1 − q/100)
```

### 4.2 Penetração no dossel
Seja `c` a cobertura de dossel (0..1) e `n` o número máximo de retornos:
$$P_{solo}(c, n) = (1 - c) + c \cdot 0{,}02 \cdot (n - 1)$$
```ts
groundReturnProbability(canopy, maxReturns): number
groundDensity(density, canopy, maxReturns): number                // ρ·P_solo
photoGroundVisibility(canopy): number                             // (1 − c)²  (o solo precisa aparecer em 2 fotos)
```

### 4.3 Ruído LiDAR
```ts
lidarRmseZ(rangeAccuracyM, aglM, imuScore, lidarNoiseMod, rtkFixFraction, emFactor): number
//  = rangeAccuracyM · (1 + aglM/200) · (1 − 0,12·imuScore) · lidarNoiseMod · (rtkFixFraction ≥ 0,5 ? 1 : 1,8) · emFactor
lidarRmseXY(aglM, rtkFixFraction, emFactor): number
//  = (0,02 + aglM/5500) · (rtkFixFraction ≥ 0,5 ? 1 : 2,5) · emFactor        (por eixo)
```

### 4.4 Acúmulo na grade (simulação)
A cada passo de simulação com o LiDAR ativo, a faixa varrida (comprimento `v·dt` × largura `swath`) adiciona `ρ × área de interseção` pulsos a cada célula da grade 64 × 64 que ela intercepta. Para cada célula:
- `ground += pulses · P_solo(canopy(cell), maxReturns)`, com `canopy = 1` sobre telhados (`ROOF`);
- `firstAbove += pulses · c`.

---

## 5. Dinâmica de voo (puro, sem render)

```ts
crabAngleRad(crossWindMs, airspeedMs): number            // asin(clamp(w/v, −1, 1))
windAt(tS, wind: Contract['wind'], noise): number         // vento de fundo: w(t) = mean + gust·(0,6·sin(2πt/7) + 0,4·n1(t/3))
driftVelocityMs(windMs, driftFactor, windDriftMod): number   // empurrão do vento na aeronave: w·driftFactor·mod (nos dois eixos)
thermalLiftMs(zones, u, v, lighting, thermalMod): number  // Σ lift·(1 − d/r)·mod · (SUN_HIGH ? 1 : 0,5)
shadowLengthM(objectHeightM, lighting): number            // h / tan(elevSolar); 0 se difusa
terrainFollowTargetAlt(sampler, u, v, speedMs, aglTargetM, dir): number
//   = max(elevation ao longo dos próximos 2 s de trajeto, amostrado a cada 5 m) + aglTargetM
stepAircraft(state: AircraftState, input: FlightInput, env: FlightEnv, dtS): AircraftState
```

**`stepAircraft`** (todos os limites vêm de `Aircraft`). O ambiente (`FlightEnv`) traz três empurrões do vento, já multiplicados por `driftFactor`, pelo modificador de deriva e pelo fator de `STRONG_WIND`: `meanAlongMs` (o vento médio ao longo da linha; positivo de cauda), `gustAlongMs` e `gustLateralMs` (§5.1).
- **Velocidade no solo:** `v` é a velocidade no solo comandada. `v += clamp(target − v, ±accelMs2·dt)`, onde `target` vem de `MOVE_Y`: −1 → `lo`, 0 → `cruise`, +1 → `hi`, com `lo = max(0,5, vMin + meanAlong)`, `hi = max(lo, vMax + meanAlong)` e `cruise = clamp(v_plano, lo, hi)`. A aeronave mantém a velocidade no solo do plano contra o vento médio enquanto a velocidade no ar couber em `[vMin, vMax]`.
- **Avanço:** `gs = max(0,5, v + gustAlong)` e `s += gs·dt`. `gs` (a velocidade no solo de fato) é a que vai para as fotos, para o blur e para a densidade LiDAR. A velocidade no ar, usada na energia (§7), é `v − meanAlong`.
- **Lateral:** `x += (vLat + gustLateral)·dt`. O vento médio transversal é compensado pela aeronave (o *crab*), sem deriva.
  - Multirrotor e ave: `vLat = MOVE_X · lateralSpeedMaxMs`.
  - Asa fixa: `vLat` limitado por `aLat ≤ v²/R`.
- **Vertical:**
  - Sem TF: `vz = (ALT_UP − ALT_DOWN)·climbRateMs + thermal`.
  - Com TF: o AGL-alvo é ajustado pelos gatilhos, e a altitude persegue `terrainFollowTargetAlt` limitada a `climbRateMs`.
- **Limites:** `alt` é limitada a `[elev + 2, elev + min(hMaxM, ceilingM)]`. Colidir com o terreno ainda é possível se a subida for insuficiente diante de um relevo abrupto.

### 5.1 Rajadas e entrada de faixa (`gusts.ts`, [ADR-030](../decisions.md))

```ts
interface Gust { startS: number; rampS: number; holdS: number; peakMs: number; angleRad: number }
//   tempos em segundos desde o início da linha; ângulo em relação ao sentido da linha
//   (0 = de cauda, +π/2 = empurra para a direita)
gustCount(lineDurationS): number                         // clamp(round(T/20), 1, 3)
windRelativeRad(directionDeg, dir, right): number        // θ₀: para onde o vento sopra, em relação à linha
planGusts(rng, wind, windRelRad, lineDurationS, leadInS): Gust[]
gustEnvelope(gust, tS): number                           // 0..1: sobe em rampS, patamar de holdS, desce em rampS
gustPushAt(gusts, tS): { lateralMs: number; alongMs: number }   // Σ peak·env·(sen θ, cos θ)
gustWarningAt(gusts, tS): { gust: Gust; inS: number } | null    // rajada avisada (inS > 0) ou em curso (inS ≤ 0)
maxCorrectableM(aircraft, speedMs, timeS): number
entryOffsetM(rng, spacingM, maxCorrectableM): number     // com sinal
```

**Agenda de rajadas** (por passada de linha, com a seed da missão):
- `T = lengthM / v_plano` e `t_in = aoiStartS / v_plano`. Há `n = gustCount(T)` rajadas.
- A janela de início `[t_in + 1, T − 4]` é dividida em `n` partes iguais, e cada rajada começa num instante uniforme na primeira metade da sua parte: uma rajada (até 3,5 s) e o aviso da seguinte nunca se cruzam. Se a janela tiver menos de `10·n` s, `n` cai até caber (mínimo 1); com janela vazia, a rajada única começa em `t_in + 1`.
- `rampS = 0,5`, `holdS = U(1,5, 2,5)` e `peakMs = max(2, gustMs)·U(0,8, 1,3)`: todo contrato tem rajada de pelo menos 2 m/s.
- **Direção:** `θ₀ = windRelativeRad(...)` é o ângulo, em relação à linha, do sentido para onde o vento sopra (`directionDeg + 180°`). Com vento médio ≥ 1 m/s, `θ = θ₀ + U(−50°, +50°)`; sem vento, `θ = U(−180°, 180°)`. Se `|sen θ| < 0,5`, `θ` é levado ao ângulo mais próximo com `|sen θ| = 0,5`, mantendo os sinais (com `sen θ = 0`, o lado é sorteado): toda rajada tem pelo menos metade da força na transversal.
- **Aviso:** `GUST_WARN_S = 1,5` s antes do início.

**Entrada de faixa:**
- `maxCorrectableM`: o deslocamento lateral que a aeronave faz, parando no fim, em `timeS`. Multirrotor e ave: `lateralSpeedMaxMs·t`. Asa fixa, com `a = v²/R` e `vmax = v·sen 30°`: `a·t²/4` se `t ≤ 2·vmax/a`; senão `vmax·(t − vmax/a)`.
- `entryOffsetM = ±min(U(0,30, 0,40)·S, 0,9·maxCorrectable)`, com o lado sorteado, e `timeS = t_in`.

---

## 6. Modelo de acurácia

### 6.1 Entradas
- `GSD_eff`: média dos GSDs (pelo AGL de cada foto) das fotos **válidas** (não rejeitadas na execução, não borradas, fora de névoa e sem invalidação especular).
- `φ` (fração RTK FIX): `(nFIX + 0,5·nFLOAT)/nShots`. É 0 se a aeronave não tiver RTK ou se o jogador não possuir o `GNSS_RTK_KIT`.

### 6.2 Base
$$RMSE_{xy}^{base} = GSD_{eff}\,(1{,}0\,\varphi + 1{,}5\,(1-\varphi)), \qquad RMSE_{z}^{base} = GSD_{eff}\,(1{,}5\,\varphi + 2{,}5\,(1-\varphi))$$

### 6.3 Multiplicadores (`accuracyMultipliers(ctx) → Array<{key,label,xy,z}>`)

| Chave | Condição | xy | z |
| :--- | :--- | :-: | :-: |
| `gcpCount` | n ≥ 5 | 1,00 | 1,00 |
| | n = 4 | 1,25 | 1,35 |
| | n = 3 | 1,60 | 1,90 |
| | n ≤ 2 e φ ≥ 0,8 | 2,00 | 2,50 |
| | n ≤ 2 e φ < 0,8 | 4,00 | 6,00 |
| `gcpGeometry` (só n ≥ 3) | cobertura do casco `h` e colinearidade `c` | `1 + 1,5·max(0, 0,4−h)/0,4` | `c < 0,05 ? 3,0 : 1 + max(0, 0,3−c)/0,3` |
| `rollingShutter` | câmera ROLLING; `k̄` = skew médio (px) | φ < 0,5: `min(1,8, 1 + 0,04k̄)`; senão `min(1,4, 1 + 0,02k̄)`. Aplicar mod: `1 + (m−1)·rollingShutterPenalty` | igual |
| `lighting` | `GOLDEN_HOUR` / `BLIZZARD` / `MAGIC_FOG` (fotos RGB) | 1,25 / 1,20 / 1,30 | 1,30 / 1,25 / 1,40 |
| `texture` | regra `HOMOGENEOUS_TEXTURE` | `1 + 0,6·(p<80 ? 1 : 0,4)·texturePenalty` | igual |
| `specular` | `SPECULAR_WATER` e `SUN_HIGH` | 1,15 | 1,30 |
| `overlap` | média de fotos/célula `m̄` < 5 | `1 + 0,12·(5 − m̄)` | igual |
| `holes` | fração vermelha `r` > 0,10 | `1 + r` | `1 + r` |
| `blur` | fração borrada `f_b` | `1 + 0,5·f_b` | igual |
| `em` | `EM_INTERFERENCE` e aeronave não imune | 1,20 | 1,20 |
| `camera` | `sensor.qualityPenalty` (Atlas calibrado: `1 + (q−1)·0,5`) | q | q |
| `execution` | execução `E` da missão (§10.3) | `1 + 0,5·(1 − E)` | igual |
| `imu` | `imuScore` s (mini-game) | `1 − 0,08s` | `1 − 0,12s` |
| `skills` | `rmseGlobal` (modificador) | mod | mod |

$$RMSE^{model}_{axis} = RMSE^{base} \cdot \prod m$$

### 6.4 Precisão dos pontos de apoio
$$\sigma_{gcp} = \sigma_{base}\,(1 + 2\,(1 - levelScore)), \quad levelScore_{padrão} = 0{,}5$$
Se o equipamento for `GNSS_RTK_KIT`, então `σ_gcp,z = 1,5·σ_gcp`; caso contrário, `σ_gcp,z = σ_gcp`.

$$RMSE^{alvo}_{axis} = \sqrt{(RMSE^{model}_{axis})^2 + \sigma_{gcp,axis}^2}$$

### 6.5 Geração determinística de resíduos
```ts
generateResiduals(points: GroundPoint[], target: {x,y,z}, rng): Residual[]
```
1. Para cada CP, sorteie `d = σ·N(0,1)` por eixo.
2. Reescale cada eixo para que o RMSE dos CPs seja **exatamente** o alvo (com 1 CP, o módulo é igual ao alvo e o sinal vem do sorteio).
3. Os GCPs usam o alvo `0,55 ×` (o ajuste os "puxa"), com o mesmo procedimento.

```ts
rmse(values: number[]): number                 // √(Σv²/n)
rmseSet(residuals): RmseSet                    // x, y, z, r = √(x²+y²)
```
**Sem CPs:** a acurácia de requisito usa `RMSE_gcp × 1,8` (estimativa conservadora), e o relatório marca "não verificável".

### 6.6 Métricas de geometria dos GCPs (`geometry.ts`)
```ts
convexHull(points: AoiPoint[]): AoiPoint[]            // monotone chain
polygonArea(poly): number
hullCoverage(points, aoi): number                     // área(casco)/área(AOI), 0..1
collinearityIndex(points): number                     // λmin/λmax da matriz de covariância 2×2 (0 = colinear); n<3 → 0
```

### 6.7 Acurácia LiDAR
Em missões em que o requisito exige `SENSOR_KIND = LIDAR`, a acurácia é avaliada com `lidarRmseXY/Z` (§4.3), aplicando `em`, `execution` e `skills`, mais o σ dos GCPs (§6.4).

---

## 7. Energia

```ts
drainPerSecond(ctx): number      // fração do total por segundo
//  = (1 / (enduranceS · enduranceMod)) · fSpeed · fWind · fClimb · fWeather
//  fSpeed   = 1 + 0,5·((v − vCruise)/vCruise)²
//  fWind    = 1 + 0,03·|w|
//  fClimb   = subindo ? 1,3 : 1
//  fWeather = BLIZZARD_DRAIN ? 2 : 1
rthRequired(remaining, distanceHomeM, vCruise, drainAtCruise): boolean
//  tempoVolta = distanceHomeM / vCruise + 15
//  true se remaining < max(0,20, 1,2 · tempoVolta · drainAtCruise)
```
- **Atlas:** a energia é `crop/10` (fração do papo). Cada unidade equivale a 60 s com fatores = 1.
- **Nova surtida:** consome 1 bateria reserva (ou enche o papo a partir do estoque). Recomeça na primeira linha incompleta.

---

## 8. Normas cartográficas (`standards.ts`)

### 8.1 PEC-PCD (ET-CQDG)

**Planimetria** (mm na escala × denominador M):

| Classe | PEC (mm) | EP (mm) |
| :-: | :-: | :-: |
| A | 0,28 | 0,17 |
| B | 0,50 | 0,30 |
| C | 0,80 | 0,50 |
| D | 1,00 | 0,60 |

**Altimetria** (fração da equidistância Eq):

| Classe | PEC | EP |
| :-: | :-: | :-: |
| A | 0,27 | 1/6 |
| B | 1/2 | 1/3 |
| C | 3/5 | 2/5 |
| D | 3/4 | 1/2 |

```ts
pecPlanimetricLimits(cls, scaleDenominator): { pecM; epM }
pecAltimetricLimits(cls, contourIntervalM): { pecM; epM }
classifyPec(residuals, scaleDenominator, contourIntervalM?): PecResult
// classe atingida = melhor classe (A→D) com RMSE ≤ EP **e** ≥ 90 % dos pontos com erro ≤ PEC;
// planimetria usa o erro resultante √(dx²+dy²) e RMSE_r; altimetria usa |dz| e RMSE_z. Nenhuma → 'FORA'.
```

### 8.2 ASPRS (2023)
```ts
classifyAsprs(rmse: RmseSet, horizontalCm, verticalCm): AsprsResult
// passH = RMSE_r·100 ≤ horizontalCm ; passV = RMSE_z·100 ≤ verticalCm
```

---

## 9. Cobertura e mapa de calor (`coverage.ts`)

```ts
createCoverageGrid(aoi, cols = 64, rows = 64): CoverageGrid
footprintPolygon(shot: Shot, aircraftKind, sensor, focalM): AoiPoint[]
//   retângulo H_g(AGL) × W_g(AGL) centrado em (u,v), rotacionado pela direção da linha;
//   asa fixa: + crabRad; oblíqua: §2.8 (deslocado à frente)
accumulateShot(grid, polygon, weight = 1): void   // +weight para cada célula cujo centro esteja dentro do polígono
isShotValid(shot, rules): boolean         // grade ≠ REJECTED && !blurred && !(inFog && RGB) && !(overWater && SPECULAR_WATER && SUN_HIGH)
shotWeight(shot): number                  // 0,5 se grade = WEAK; senão 1 (foto sem nota vale 1)
summarizeCoverage(grid, excludedCells): CoverageResult
// excluídas: células de água (landCover WATER) — sempre; classes: verde ≥ 5, amarelo ≥ 3 e < 5, vermelho < 3
// (as contagens são fracionárias por causa do peso das fotos fracas)
```

---

## 10. Avaliação da missão (`requirements.ts`, `mission.ts`)

```ts
predictRequirements(plan: FlightPlan, contract, groundPoints, inventory): RequirementResult[]  // antes do voo
evaluateRequirements(mission, report, contract): RequirementResult[]                         // após processamento
evaluateMission(mission, contract, ctx): QualityReport
```

| `check.type` | Previsão (plano) | Avaliação (dados reais) |
| :--- | :--- | :--- |
| `MAX_GSD_CM` | `stats.gsdM` (nadiral) | `GSD_eff` (nadiral pelo AGL, mesmo em oblíqua) |
| `MIN_FORWARD_OVERLAP` / `MIN_SIDE_OVERLAP` | p/q do plano | mediana de `p_real` / q estimado médio |
| `MIN_COVERAGE_GREEN` | "—" (aviso informativo) | `coverage.green` |
| `SENSOR_KIND`, `MIN_AIRCRAFT_TIER`, `AIRCRAFT_KIND`, `FLIGHT_MODE` | parâmetros do plano | idem |
| `ACCURACY_PEC` / `ACCURACY_ASPRS` | estimativa com §6 sobre o plano (fotos ideais) | §8 sobre os resíduos |
| `MIN_GCP` / `MIN_CP` | contagem | contagem |
| `MIN_LIDAR_DENSITY` / `MIN_GROUND_DENSITY` | §4 | média sobre as células válidas da grade |
| `MAX_VOLUME_ERROR_PCT` | — | §11 |
| `MAX_BLUR_FRACTION` | blur previsto > 1 px ⇒ ✗ | fração de fotos borradas |
| `NOT_DETECTED` | — | `!events.detected` |
| `FEATURE_CAPTURED` | — | `featureId ∈ events.featuresCaptured` |
| `MIN_EXECUTION` | "—" (aviso informativo) | execução `E` da missão (§10.3) ≥ valor |

### 10.1 Pontuação de qualidade (0..1)

$$score = \left(0{,}4\,acc + 0{,}3\,cov + 0{,}2\,gsd + 0{,}1\,clean\right)\cdot\left(0{,}4 + 0{,}6\,E\right)$$

- `acc = clamp(0,5 + (tol/rmse − 1), 0, 1)`, onde `tol` é o EP (PEC) ou a classe ASPRS. Com várias exigências, usa-se o mínimo. Sem exigência, vale 1.
- `cov = clamp(green + 0,5·yellow, 0, 1)`.
- `gsd = clamp(0,5 + (req/GSD_eff − 1), 0, 1)`. Sem exigência, vale 1.
- `clean = clamp(1 − 0,25·collisions − 0,5·blurFraction, 0, 1)`.
- `E` é a execução do voo (§10.3). Com `E = 1` a nota é a de antes da execução existir.

### 10.2 Aprovação
- **Reprovação crítica** (`critical = true`) acontece se:
  - algum requisito `CRITICAL` falhar; ou
  - não houver dados, ou seja, todas as surtidas terminaram em `CRASH`/`ENERGY_DEPLETED` sem nenhum disparo ou pulso salvo.
- `approved = !critical`.

### 10.3 Execução do voo (`corridor.ts`, `execution.ts`, [ADR-029](../decisions.md))

```ts
type ShotGrade = 'PERFECT' | 'GOOD' | 'WEAK' | 'REJECTED'      // Perfeita, Boa, Fraca, Rejeitada
GRADE_WEIGHT = { PERFECT: 1, GOOD: 0.8, WEAK: 0.4, REJECTED: 0 }

// corridor.ts
gatePositions(line, baseM): number[]                  // s_k = aoiStartS − B + k·B, enquanto s_k ≤ aoiEndS + B
corridorProfile(elevationAlong, lengthM, opts): CorridorProfile   // altitude do corredor numa grade de 5 m
corridorAltAt(profile, s): number                     // interpolação linear
plannedSamples(line, baseM): number                   // portais com s_k ≥ aoiStartS

// execution.ts
gradeAxis(value, limits: [number, number, number]): ShotGrade
gradeSample(input: { crossTrackM, spacingM, altM, corridorAltM, heightM, advanceRatio, blurred }): { grade, lateral, vertical, advance }
worstGrade(...grades): ShotGrade
passScore(counts: [nP, nG, nW, nR]): number           // (nP + 0,8·nG + 0,4·nW) / n; 0 sem amostras
passAccepted(pass): boolean                           // complete && passScore ≥ 0,5
gradeLetter(score): 'S' | 'A' | 'B' | 'C' | 'D'       // ≥ 0,95 / ≥ 0,85 / ≥ 0,70 / ≥ 0,50 / abaixo
missionExecution(passes: LinePass[], planned: number[]): number   // E, 0..1
```

**Altitude do corredor** (ao longo do eixo da linha, `x = 0`):
1. `T(s) = max(elev(s'), s' ∈ [s, s + 2·v_plano], a cada 5 m) + H`: a regra do Terrain Following com AGL-alvo `H`.
2. Rampa máxima `m = 0,7·climbRateMs / v_plano`. `A(s) = max_{s'} (T(s') − m·|s' − s|)`: o envelope superior de `T` com inclinação limitada (duas varreduras, para frente e para trás), sempre ≥ `T`.
3. `corridorAlt(s) = min(A(s), elev(s) + min(hMaxM, ceilingM))`.

**Portal:** retângulo centrado em `x = 0` e na altitude do corredor em `s_k`, com meia largura `0,10·S` e meia altura `0,10·H`.

**Nota da amostra** (a pior dos três eixos; `blurred` ⇒ `REJECTED`):

| Eixo | Medida | Perfeita | Boa | Fraca | Rejeitada |
| :--- | :--- | :-: | :-: | :-: | :-: |
| Faixa | `\|x\| / S` | ≤ 0,05 | ≤ 0,10 | ≤ 0,25 | > 0,25 |
| Altura | `\|alt − corridorAlt(s)\| / H` | ≤ 0,05 | ≤ 0,10 | ≤ 0,20 | > 0,20 |
| Avanço | foto: `d / B`, com `d` a distância à foto automática anterior da passada (na primeira, `gs / v_plano`); LiDAR: `gs / v_plano` | ≤ 1,05 | ≤ 1,15 | ≤ 1,30 | > 1,30 |

- **Quem recebe nota:** toda foto automática; com o LiDAR ativo, uma amostra a cada portal cruzado. A foto manual recebe nota só pela altura e pelo avanço instantâneo (`gs / v_plano`); o enquadramento lateral é livre.
- **Quem entra na contagem da passada:** as amostras automáticas com `s ≥ aoiStartS` (a margem de entrada fica de fora). As fotos manuais não entram.
- **Peso nos dados:** foto `REJECTED` é inválida (§9); `WEAK` pesa 0,5 na cobertura. Os pulsos LiDAR de cada sub-passo acumulam com peso 1, 0,5 ou 0 conforme a nota do instante.

**Passada e missão:**
- `LinePass = { lineIndex, pass, sortie, counts, complete }`; `complete` é a regra de linha completa de [survey-flight §3](../features/survey-flight.md).
- A linha fica **concluída** quando uma passada é aceita (`passAccepted`).
- `E = Σ_L best_L·n_L / Σ_L n_L`, sobre todas as linhas **planejadas**, com `n_L = plannedSamples(L)` e `best_L` o maior `passScore·f` entre as passadas da linha, onde `f = 1` na passada completa e `min(1, n/n_L)` na incompleta. Linha sem passada vale 0.
- Missão sem `linePasses` (save anterior à execução ou missão sintética) vale `E = 1`.

---

## 11. Volumetria (`volumetrics.ts`)

```ts
referenceVolumeM3(sampler, aoi, refPlaneM, resolution = 256): { cutM3; fillM3 }   // integração em grade
measuredVolumeM3(reference, rmseZ, meanDepthM, redFraction, rng): number
//  ε = −0,5·redFraction + N(0, 0,5·rmseZ/meanDepthM)  ;  medido = (cut + fill)·(1 + ε)
volumeErrorPct(reference, measured): number
```
O plano de referência é a média da elevação na borda da AOI.

---

## 12. Economia e progressão

### 12.1 Pagamento (`economy.ts`)
$$total = \max\left(0,\ \mathrm{round}\left(base \cdot r \cdot Q \cdot R \cdot G \cdot E\right) - staffCost - penalties\right)$$

| Símbolo | Definição |
| :-: | :--- |
| `r` | replayFactor: 1 na primeira aprovação, 0,4 em repetição |
| `Q` | qualityFactor: crítico → 0,10; senão `(0,6 + 0,4·score) · Π(MAJOR falho ×0,85, MINOR falho ×0,95) + (classe atingida melhor que a exigida ? 0,10 : 0) + bônus de pilotagem (E ≥ 0,90 ? 0,10 : E ≥ 0,80 ? 0,05 : 0)`. O bônus só vale em missão com dado de execução |
| `R` | rivalFactor (1 ou 0,85) |
| `G` | modificador `contractPayment` (1,25 com GES_1) |
| `E` | `1 + Σ paymentBonus·qtd` (equipe) |
| `staffCost` | `Σ costPerContract·qtd` (cobrado em toda missão processada) |
| `penalties` | `Σ preço·repairCostPct` por queda de aeronave |

- **XP:**
  - aprovado: `round(xp·r·(0,5 + 0,5·score))`;
  - crítico: `round(0,1·xp)`.
- **Reputação:**
  - aprovado: `round(reward·(0,5 + score)·reputationGain)`;
  - crítico: `−10`.
- **Preço na loja:** `round(preço·shopPrice)`.

### 12.2 Níveis (`progression.ts`)
```ts
xpToNext(level): number        // round(100 · level^1,5)
addXp(player, amount): player  // pode subir vários níveis; +1 skillPoint por nível
```

### 12.3 Museu (`museum.ts`)
```ts
sectorIncomePerMin(contract, qualityScore): CentsBRL       // round(incomePerMinBRL · (0,5 + 0,5·score))
museumIncomePerMin(sectors, featured, visitorsMod): CentsBRL // Σ income·(destaque ? 2 : 1)·visitorsMod
visitorsPerHour(incomePerMin): number                        // incomePerMin(R$) · 6
offlineIncome(incomePerMin, elapsedMs): CentsBRL             // min(elapsed, 2 h) em minutos × incomePerMin
```

### 12.4 Processamento
```ts
processingBaseTimeS(nPhotos, nPulses): number    // 6 + 0,08·nPhotos + 0,12·(nPulses/1e6)
processingSpeed(hardware, staff, inField, van): number // (inField ? max(hwFactor, van.fieldSpeedFactor) : hwFactor) · (1 + Σ processingSpeedBonus·qtd)
STAGE_WEIGHTS = [0,15, 0,20, 0,20, 0,25, 0,10, 0,10]
lensCalibration(sensor, focalM, seed, qualityProduct): LensCalibration
// fPx = focalM/pixelPitch·(1 + 0,002n), cx = W/2 + 8n, cy = H/2 + 8n,
// k1 = K1_BASE[sensor] + 0,002n, k2 = K2_BASE[sensor] + 0,0005n, p1 = 0,0002n, p2 = 0,0002n,
// reprojErrorPx = 0,35 + 0,15·(qualityProduct − 1)   (n ~ N(0,1) seedado)
```

| Sensor | K1_BASE | K2_BASE |
| :--- | :-: | :-: |
| CAM_PIGEON | −0,120 | 0,030 |
| CAM_20MP_RS | −0,012 | 0,004 |
| CAM_45MP_FF | −0,004 | 0,001 |
| CAM_MS5 | −0,020 | 0,006 |
| CAM_THERMAL | −0,050 | 0,012 |
| CAM_POD_RGB | −0,010 | 0,003 |

---

## 13. Eventos aleatórios (`fieldEvents.ts`, `rival.ts`)

```ts
rollFieldEvent(rng, tile, vehicle, nowS, lastEventS): FieldEventId | null
// só em ROAD_DIRT, TRAIL, GRASS, HILL, SWAMP, SAND; p = 0,015 por tile percorrido; cooldown de 20 s
// pesos: FLAT_TIRE 2 (só veículos com rodas: COMPACT_CAR, PICKUP_4X4, LAB_VAN), CATTLE 2 (idem),
//        LOST_BENCHMARK 2, SUSPICIOUS_OWNER 2, SUDDEN_RAIN 1, ATLAS_FINDS_CORN 1
rollCounterOffer(rng, rivalChanceMod): boolean   // p = 0,20 · rivalChanceMod
```

---

## 14. Golden values (testes obrigatórios)

| # | Função | Entrada | Saída esperada |
| :-: | :--- | :--- | :--- |
| G1 | `pixelPitchM` | 45 MP FF (35,9 mm / 8192 px) | 4,3823 µm |
| G2 | `gsd` | H = 100 m, pitch 4,3823 µm, f = 35 mm | **1,2521 cm/px** |
| G3 | `footprint` | idem, sensor 35,9 × 24,0 mm | W_g = 102,571 m; H_g = 68,571 m |
| G4 | `airBase` / `lineSpacing` | p = 80 %, q = 70 % | B = 13,714 m; S = 30,771 m |
| G5 | `shotInterval` | B = 13,714 m, v = 10 m/s | Δt = 1,3714 s |
| G6 | `gsd`/`footprint` | 20 MP 1" (13,2 × 8,8 mm, 5472 px), f = 8,8 mm, H = 100 m | GSD 2,7412 cm; W_g 150 m; H_g 100 m |
| G7 | `airBase`/`lineSpacing`/`shotInterval` | G6 com p = 75 %, q = 65 %, v = 8 m/s | B 25 m; S 52,5 m; Δt 3,125 s |
| G8 | `lidarSwathM` / `lidarDensity` | PRR 240 kHz, FOV 70°, H = 80 m, v = 10 m/s | swath 112,033 m; **214,22 pts/m²** |
| G9 | `lidarDensityWithOverlap` | PRR 240 k, FOV 70°, H = 120 m, v = 18 m/s, q = 50 % | swath 168,050 m; 158,68 pts/m² |
| G10 | `motionBlurPx` | v = 15 m/s, t = 1/250 s, GSD 1,2521 cm | 4,7908 px |
| G11 | `rollingShutterSkewPx` | v = 8 m/s, readout 30 ms, GSD 2,7412 cm | 8,7552 px |
| G12 | `crabAngleRad` | w = 4 m/s, v = 12 m/s | 19,4712° |
| G13 | `obliqueFootprint` | FF, f = 35 mm, H = 60 m, θ = 45° | α_v 37,849°; near 29,362 m; far 122,609 m; W_c 87,035 m |
| G14 | `heightFromParallax` | B = 30, H = 100, f = 35 mm, h = 20 | b = 10,5 mm; Δp = 2,625 mm; h = 20,000 m |
| G15 | `depthPrecisionM` | H = 100, B = 30, f = 35 mm, σ = 0,5 px × 4,3823 µm | 2,0868 cm |
| G16 | `groundReturnProbability` | c = 0,97, n = 5 / n = 1 | 0,1076 / 0,0300 |
| G17 | `shadowLengthM` | h = 20 m, GOLDEN_HOUR / SUN_HIGH | 142,307 m / 7,279 m |
| G18 | `pecPlanimetricLimits` | A, 1:1000 / A, 1:500 / B, 1:500 | EP 0,17, PEC 0,28 / EP 0,085, PEC 0,14 / EP 0,15, PEC 0,25 (m) |
| G19 | `xpToNext` | níveis 1..5 | 100, 283, 520, 800, 1118 |
| G20 | `computePayment` | base R$ 12.000, score 0,8, sem falhas, R = 1, G = 1,25, 1 estagiário | R$ 14.128,00 |
| G21 | `processingBaseTimeS` | 300 fotos, 0 pulsos, notebook (1,0) | 30,0 s |
| G22 | `referenceVolumeM3` | cava cônica r = 100 m, prof. 50 m, grade 256² | 523.599 m³ (±0,5 %) |
| G23 | plano C00 (referência) | Atlas, CAM_PIGEON, H 60, p 70, q 60, v 10, AOI 240 × 160 | GSD 2,5204 cm; W_g 82,267; H_g 60,667; B 18,2; S 32,907; Δt 1,82 s; 6 linhas; 16 fotos/linha; 96 fotos; voo 231,45 s; 1 "bateria" |
| G24 | `sectorIncomePerMin` | income R$ 10/min, score 0,8 | R$ 9,00/min (com GES_2: R$ 13,50) |
| G25 | `classifyPec` | 5 CPs com resultantes [0,10; 0,12; 0,08; 0,15; 0,11] m, 1:1000 | RMSE_r = 0,1144 m → classe **A** |
| G26 | `gradeSample` (faixa) | S = 30 m, altura e avanço perfeitos, `x` = 1,4 / 2,9 / 7,4 / 7,6 m | Perfeita / Boa / Fraca / Rejeitada |
| G27 | `passScore` / `gradeLetter` | contagem [10, 5, 3, 2] | 0,76 → **B** |
| G28 | `missionExecution` | 2 linhas de 16 amostras; linha 0 com passada completa de nota 0,9; linha 1 sem passada | E = 0,45 |
| G29 | `gustCount` | T = 12 / 30 / 75 s | 1 / 2 / 3 |
| G30 | `maxCorrectableM` | multirrotor (lateral 8 m/s), t = 3 s; asa fixa (v = 22 m/s, R = 80 m), t = 80/22 s | 24 m; 20,0 m |
| G31 | nota com execução | base 0,9; E = 1 / 0,65 | 0,900 / 0,711 |
| G32 | `corridorProfile` | relevo plano a 100 m com degrau de +30 m em s = 200 m; H = 60, v = 10, subida 3 m/s | 160 m em s ≤ 37 m; 173,2 m em s = 100 m; 190 m em s ≥ 180 m |

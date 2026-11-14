# Feature — `SURVEY_FLIGHT`: Motor de Voo 2.5D (Pseudo-3D estilo arcade)

## 1. Objetivo
Executar o plano de voo num Canvas 2D a 60 FPS, com forte ilusão de profundidade:
- relevo visível em perspectiva cônica;
- obstáculos que crescem do horizonte até a câmera;
- sensores operando em tempo real (câmera RGB com pegada luminosa e LiDAR com leque de feixes);
- clima, vento e energia como desafios.

Cada linha de voo é uma corrida para frente. As consequências técnicas (GSD, sobreposição, blur, RTK) são medidas a cada disparo.

## 2. Requisitos cobertos
REQ-FLT-001 a REQ-FLT-024, REQ-AUD-002 (sons do voo), REQ-NFR-001, REQ-NFR-007, REQ-CORE-003, REQ-CORE-008.

## 3. Fluxo e estados internos (`FlightPhase`)

```
TAKEOFF (2,5 s) ──▶ RUN(line i) ──fim da linha──▶ TURN (animação) ──▶ RUN(line i+1) … ──última──▶ LANDING (2 s) ──▶ POST_FLIGHT
     RUN ──RTH (confirmado)──▶ RETURNING (3 s) ──▶ POST_FLIGHT
     RUN ──casco = 0 | colisão com terreno | energia = 0──▶ CRASHED (2 s, câmera treme) ──▶ POST_FLIGHT
POST_FLIGHT ──"Nova surtida"──▶ TAKEOFF (na 1ª linha incompleta)
POST_FLIGHT ──"Processar agora" (Van) ──▶ goTo(PROCESSING_RESULTS)    ──"Levar dados"/"Abandonar"──▶ goTo(WORLD_MAP)
```

- **Linha completa:** a aeronave passou de `aoiEndS + B` ao longo da linha com dados registrados, ou seja, ≥ 1 disparo ou pulso na janela da AOI.
- **Linha incompleta:** foi interrompida antes disso. Linhas incompletas ficam disponíveis para uma nova surtida.
- **Surtida que termina em CRASH ou ENERGY_DEPLETED:** os **shots e pulsos dessa surtida são descartados**. Os dados das surtidas anteriores ficam.

## 4. Layout do HUD (React sobreposto ao canvas)

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ✈ Condor RTK  ·  📷 RGB 45MP [Tab]  ·  RTK: FIX        LINHA 3/9  ▕████████░░░░▏ 62 %        🔋 74 % 18:32 │
│                                                        desvio  ◀──────●──▶  +2,1 m                ♥♥♥♡ │
│                                                                                                       │
│                         [ ⚠ OVERLAP INSUFICIENTE 58 % ]                                               │
│                                                                                                       │
│                              (canvas 2.5D: céu, relevo, objetos, aeronave)                            │
│                                                                                                       │
│ ALT 412 m  AGL 98 m  ▲Q ▼E        GSD 1,79 cm/px ✓      FOTOS 143 / 243        LiDAR 158 pts/m²  ┌────┐ │
│ VEL 10,4 m/s  [W/S]  ×2 [T]       p 74 %  q 66 %         BLUR 0,4 px ✓          solo 17 pts/m²   │mini│ │
│ VENTO → 6,2 m/s  CRAB 12°                                                                         └────┘ │
└──────────────────────────────── dicas: [Espaço] foto manual · [R] RTH · [Esc] pausa ─────────────────┘
```

O HUD lê o `FlightHudSnapshot` (§6), publicado a 10 Hz. Alertas centrais: no máximo 2, ordenados por prioridade (§5.17).

## 5. Regras e algoritmos

### 5.1 Câmera e projeção (`engines/flight/projection.ts`)
| Constante | Valor |
| :--- | :--- |
| FOV horizontal | 70° → `focalPx = (W/2) / tan(35°)` |
| `cameraOffset` (distância atrás da aeronave) | 30 m |
| `camUp` (altura da câmera acima da aeronave) | 12 m |
| `HorizonX` | `W/2` |
| `HorizonY` | `0,35·H_tela` em cruzeiro (na decolagem, anima de `0,62·H` até `0,35·H`) |
| `zNear` / `zFar` | 1 m / 1200 m (Média: 900; Baixa: 700) |

Para um ponto com coordenadas do *run* `(X, Z)` (§5.2) e altura `Y` acima do solo:

$$scale = \frac{focalPx}{Z + cameraOffset}$$
$$X_s = HorizonX + (X - camX)\cdot scale$$
$$Y_s = HorizonY + \big(camAlt - (Elev(X,Z) + Y)\big)\cdot scale$$

- `Z` é a distância **à frente da aeronave**, que fica em `Z = 0`.
- `camAlt = alt_aeronave + camUp`.
- `camX` segue o X da aeronave com suavização de 0,1 por frame.
- Isso implementa a fórmula do spec original com a convenção de sinal explícita: o `Y` do original é medido para baixo a partir da câmera.
- Assinaturas:
  - `project(X, Y, Z, cam): { x: number; y: number; scale: number } | null`, que retorna `null` se `Z + cameraOffset < zNear`;
  - `unprojectGround(xs, ys, cam, sampler)`, para testes e picking, por busca binária em Z.

### 5.2 Do frame da AOI para o frame do *run*
Para a linha `L` com direção `d ∈ {+1, −1}` e eixo da linha `axis` (u em `ALONG_LENGTH`, v em `ALONG_WIDTH`):
- `Z_world(s) = s`, a distância ao longo da linha desde `L.start`;
- `X = deslocamento transversal` em relação ao eixo da linha, positivo à direita do sentido de voo;
- `aoiPoint(s, X) = L.start + s·dir + X·right`.

`Elev(X, Z)` passa a ser `sampler.elevation(aoiPoint(sAeronave + Z, X))`. Pontos fora da AOI + margem usam a elevação do bioma estendida, porque o ruído continua; a margem visual é infinita.

### 5.3 Terreno em faixas (`terrainRenderer.ts`)

| Qualidade | Linhas (N) | Colunas (M) | zFar |
| :--- | :-: | :-: | :-: |
| Alta | 72 | 48 | 1200 |
| Média | 56 | 36 | 900 |
| Baixa | 40 | 28 | 700 |

1. **Distâncias das faixas:** `Z_i = zNear + (zFar − zNear)·(i/N)^2,2`, para i = 0..N, mais denso perto.
2. **Malha:** para cada faixa i, M+1 amostras em X, entre `camX − halfW(Z_i)` e `camX + halfW(Z_i)`, com `halfW(Z) = (W/2 + 40)/scale(Z)`. Guarda `elev`, a cor de superfície e o normal.
   - Normal por diferenças finitas com passo `max(2, ΔX)`.
   - `shade = ambient + diffuse·max(0, n·L)`, com `L` vindo do sol da iluminação (azimute 135°, e a elevação da tabela de [domain-math §2.7](../design/domain-math.md); difusa: ambient 0,75, diffuse 0,25).
3. **Pintura de longe para perto:** `i = N−1 … 0`. Para cada quad `(i, j)`, monta um polígono de 4 vértices projetados e preenche com `cor = mix(landCoverColor·shade, fogColor, fogFactor(Z))`.
   - `fogFactor = 1 − exp(−Z/zFog)`, com `zFog` = 900 m (limpo), 350 m (`BLIZZARD`) ou 220 m (`MAGIC_FOG`).
   - Quads totalmente acima de `y = 0` ou abaixo de `H_tela` são descartados.
4. **Curvas de nível:**
   - Intervalo: 5 m (relevo < 50 m), 10 m (< 150 m) ou 25 m (acima).
   - Em cada quad, se `floor(e/I)` diferir entre vértices adjacentes, desenha o segmento interpolado da isolinha (marching squares simplificado em 4 arestas). A cor é escura a 25 % de alfa, e a cada 5 curvas (mestra) a 45 %.
5. **Intercalação com objetos:** após pintar a faixa `i`, desenha os objetos com `Z ∈ [Z_i, Z_{i+1})`, ordenados de longe para perto. Isso produz a oclusão natural: morros pintados depois encobrem objetos atrás.
6. **Água:**
   - Cor da paleta com ondulação senoidal no brilho.
   - Sob `SPECULAR_WATER` + `SUN_HIGH`: uma faixa de brilho especular (elipse branca, aditiva) na posição refletida do sol.
7. **API para testes:** `buildDrawList(state): DrawCommand[]`. A renderização apenas executa a lista, o que torna a ordem testável sem pixels.

### 5.4 Objetos (`objectRenderer.ts`)
- **Culling:** `sampler.objectsInRange(s − 50, s + zFar)` **e** `|X − camX| < halfW(Z) + largura`.
- **Render por *kind*:** conforme [terrain §4](../design/terrain.md). A face voltada à câmera usa `shade` × 0,85, o topo usa ×1,0 e a lateral ×0,7.
- **Sombras projetadas:** só com sol, ou seja, `SUN_HIGH` e `GOLDEN_HOUR`. É um polígono escuro (alfa 0,3) no chão, deslocado na direção oposta ao sol, com comprimento `shadowLengthM(h, lighting)`.
- **Alvos GCP/CP** da missão: desenhados no chão como quadrados xadrez de 1 m (CP como triângulo), visíveis quando `scale > 0,5`.
- **Escala mínima:** objetos com projeção < 1 px são omitidos.

### 5.5 Céu, partículas e clima
- **Céu:** gradiente da paleta do bioma (topo → horizonte). Com `GOLDEN_HOUR`, o horizonte fica laranja e o sol aparece como disco no horizonte. Nas fendas, o céu é violeta-ciano com "estrelas" piscantes.
- **Partículas** (no máximo 300):
  - neve (`BLIZZARD`): queda diagonal com o vento;
  - vaga-lumes (`MAGIC_FOG`);
  - chuva (evento herdado: nenhum no voo);
  - poeira na mina;
  - faíscas (`ELECTRIC_CREATURES`).
- **Screen shake:** em colisões, por 0,3 s com amplitude de 8 px, desligado com `reduceFlashes`.

### 5.6 Aeronave
- **Física:** `stepAircraft` ([domain-math §5](../design/domain-math.md)).
- **Input** (contexto `FLIGHT`):
  - `MOVE_Y` → velocidade-alvo;
  - `MOVE_X` → lateral;
  - `ALT_UP`/`ALT_DOWN` → vertical ou AGL-alvo (com TF).
- **Sprite** (desenhado em `Z = 0`, sempre por cima do terreno da faixa 0, com sombra no chão projetada verticalmente cujo tamanho diminui com o AGL), com cores da pintura do drone ou acessório do Atlas:
  - **Atlas:** corpo oval, asas batendo (frequência ∝ v), cabeça com bico; o acessório é desenhado por cima (óculos, cachecol, mochilinha).
  - **Multirrotor:** "X" com 4 discos de hélice borrados, que rodam.
  - **VTOL:** fuselagem, asa longa, cauda em V.
  - **Inclinação visual:** *bank* = `MOVE_X × 20°`, e *pitch* conforme a velocidade.
- **Status RTK:**
  - `FIX` se a aeronave tem RTK, o jogador possui o kit e não está em `RTK_CANYON`;
  - `FLOAT` dentro do `RTK_CANYON`;
  - `NONE` se não tem RTK.

### 5.7 Linhas, corredor e curvas
- O *run* começa em `s = 0` (início do lead-in), com `X = 0` e a altitude do plano: H sobre a cota média da AOI, ou o AGL-alvo com TF.
- **Indicador de desvio:** `e = X`. "FORA DA FAIXA" quando `|e| > 0,25·S`.
- **Fim da linha:** quando `s ≥ lineLength`. Entra em `TURN`:
  - duração = `turnTimeS` do plano, limitada à apresentação de 2,5 s;
  - a energia correspondente ao `turnTimeS` real é consumida;
  - animação de fade com minimapa ampliado mostrando a curva;
  - o próximo *run* começa com o X atual relativo à nova linha = 0. A curva automática alinha.
- **Ordem das linhas:** primárias em zigue-zague, depois as cruzadas, se houver.

### 5.8 Câmera RGB (`sensors/camera.ts`)
- **Disparo automático:** um temporizador acumula `dt`. Quando `acc ≥ Δt_plano`, dispara, desde que `s ∈ [aoiStartS − B, aoiEndS + B]`, e faz `acc −= Δt`.
- **Disparo manual:** `FIRE`, com cooldown de 0,3 s. Funciona em qualquer `s` do *run*.
- **Registro do `Shot`:**
  - posição AOI `(u, v)`;
  - AGL (`alt − elevation(u,v)`);
  - velocidade, rumo da linha e crab (asa fixa);
  - tilt (0, 45 ou 60);
  - `footprintW/H` pelo AGL;
  - `blurPx = motionBlurPx(v, exposure, gsd(AGL))` e `blurred = blurPx > 1`;
  - `skewPx`;
  - iluminação e RTK;
  - `overWater`: a fração de água sob a pegada, amostrada numa grade de 5 × 5, é > 0,5;
  - `inFog = MAGIC_FOG`.
- **Visual:**
  - os 4 cantos da pegada no chão (ou a pegada oblíqua) são projetados e preenchidos com trapézio `cyan-300` em alfa 0,35, com fade de 0,6 s e contorno 1 px;
  - **flash**: overlay branco de alfa 0,18 por 80 ms, desligado com `reduceFlashes`;
  - som `SHUTTER`;
  - o contador "FOTOS" pulsa.
- **Rolling shutter:** se `MOVE_X ≠ 0` ou houver curva, desenha o trapézio cisalhado pelo skew. É o efeito gelatina visual.
- **Sobreposição real:** `p_real = realForwardOverlap(dist(shot_{i−1}, shot_i), H_g(AGL_i))`, calculada só entre disparos consecutivos da mesma linha. O HUD mostra a média móvel dos 3 últimos.
- **Alertas:**
  - "OVERLAP INSUFICIENTE X %" se `p_real < max(60, MIN_FORWARD_OVERLAP)`;
  - "MOTION BLUR" se `blurred`;
  - "POUCA LUZ: REDUZA A VELOCIDADE" se `GOLDEN_HOUR` e `blurPx > 0,5`.

### 5.9 LiDAR (`sensors/lidar.ts`)
- **Ângulo de varredura:** `θ(t) = (FOV/2)·sin(2π·scanFrequencyHz·t)`.
- **Visual por frame:**
  - 24 feixes partindo da aeronave em ângulos `θ(t − k·δ)`, com `k` de 0 a 23 e `δ = 1/(24·60)`, formando um leque com rastro;
  - cada feixe faz um *raymarch* contra o terreno e os objetos (passo de 2 m, até 2× o AGL) e acha o 1º impacto;
  - em célula com dossel `c`, sorteia (RNG visual, não usado nos dados) se o feixe continua até o solo com `P_solo` e desenha os pontos intermediários;
  - linha do feixe em `cyan-400` com alfa 0,5 e ponto de impacto de 2 px: **ciano** no 1º retorno acima do solo, **verde** (`emerald-400`) no último retorno no solo;
  - os pontos de impacto persistem 1,5 s com fade, formando a "nuvem viva".
- **Dados:** o acúmulo analítico na grade 64 × 64 ([domain-math §4.4](../design/domain-math.md)) vale para toda a faixa sob a aeronave a cada sub-passo.
- **Amostras para o visualizador:** 8 por frame (posição real dos impactos), até 50.000 em memória.
- **HUD:**
  - `lidarDensity(PRR, v, AGL, FOV)`;
  - `groundDensity` pelo dossel sob a aeronave.
- **Som:** `LIDAR_HUM` contínuo, com `setParam('rate', scanFrequencyHz)`.

### 5.10 Alternância de sensor
- Só existe com o `POD_LIDAR` como carga.
- `TOGGLE_SENSOR` alterna `activeSensor` entre `'RGB'` (com `CAM_POD_RGB`) e `'LIDAR'`, com cooldown de 0,5 s.
- O sensor inicial é o `primarySensor` do plano.
- Com RGB ativo, não há acúmulo LiDAR. Com LiDAR ativo, não há disparos automáticos. O disparo manual também fica desativado e mostra a dica "Ative a câmera [Tab]".

### 5.11 Colisão, dano e queda
- `checkCollision(aircraftPos, radius, objects, t)` é puro e cobre as formas de [terrain §4](../design/terrain.md).
- **Objeto sólido:**
  - −1 de casco, `CRASH` (som), shake;
  - a velocidade cai a 30 %;
  - 1,5 s de invulnerabilidade, com a aeronave piscando (exceto com `reduceFlashes`, em que fica translúcida);
  - `events.collisions++`.
- **Terreno:** `alt < elevation + radius` → queda imediata.
- **Casco = 0** → queda.
- **Queda (`CRASHED`):** animação de 2 s em que a aeronave gira e cai, mais fumaça. Depois `POST_FLIGHT`, com o motivo e os dados da surtida descartados.
- **Atlas:** em vez de queda, "Atlas se assustou e voltou para casa". O efeito na missão é o mesmo, mas sem custo de reparo.

### 5.12 Energia, RTH e surtidas
- O dreno por sub-passo vem de `drainPerSecond` ([domain-math §7](../design/domain-math.md)).
- **Alerta RTH:** se `rthRequired`, aparece "RTH RECOMENDADO" e toca `RTH_BEEP` a cada 1,5 s.
- **Energia = 0 no ar:** `ENERGY_DEPLETED`, que equivale a uma queda.
- **`RTH`:** abre uma confirmação inline no HUD, "Retornar à base? [R] confirmar / [Esc] cancelar", com timeout de 3 s. Confirmado:
  1. fase `RETURNING`;
  2. a aeronave sobe e faz a curva;
  3. a surtida termina como `RTH`, com os dados mantidos;
  4. a linha corrente fica marcada como incompleta.
- **Pós-voo** (`PostFlightDialog`, modal):
  - resumo: linhas completas / total, fotos, pulsos, tempo, energia restante, colisões e alertas;
  - botões:
    - "Nova surtida" (visível se houver linhas incompletas **e**, para multirrotor e asa fixa, `spareBatteries` restantes nesta missão, ou, para o Atlas, estoque de milho > 0, que enche o papo);
    - "Processar agora" (Van Lab possuída e dados > 0);
    - "Levar dados ao escritório" (dados > 0);
    - "Abandonar missão" (com confirmação; descarta tudo).
  - Se não houver dados, só "Abandonar" e "Tentar de novo" (volta ao `FIELD_SETUP` com o plano mantido). **Exceção:** essa transição `SURVEY_FLIGHT → FIELD_SETUP` **não** está na tabela T1–T15. Ela foi adicionada como **T16** em [architecture §2](../design/architecture.md) (ver ADR-011).

### 5.13 Ambiente especial
| Elemento | Implementação |
| :--- | :--- |
| Vento | `windAt(t)` é perpendicular à linha (componente cruzada) mais uma componente frontal (ignorada na deriva, mas afeta o dreno). Deriva = `driftVelocityMs`. O HUD mostra a seta de vento e o `crabAngleRad`. Acima da tolerância, a deriva dobra (`STRONG_WIND`) |
| Térmicas | `thermalLiftMs`. Visual: distorção sutil (onda) no ar sobre a zona |
| EM | `EM_INTERFERENCE`: soma `ruído(t)·0,8 m/s` lateral e 3° de rumo. Glitch de scanlines no HUD. Atlas fica imune |
| RTK canyon | `rtkStatusAt(u, v)`, com toast na mudança de estado |
| Holofotes | Cones animados. Tempo dentro do cone acumulado (1,5 s; Atlas 3 s) → `detected` |
| Anéis | Coleta ao passar a < 3 m do centro → `ringsCollected++` e `COLLECT` |
| Features | Avaliadas no fim de cada surtida (dados): `PHOTO` → ≥ 3 shots válidos com o centro dentro da pegada (para `DEN_*`, o sensor tem de ser THERMAL); `LIDAR` → pulsos/m² da célula ≥ 50 |
| Criaturas elétricas | Picos seedados a cada 8–12 s: empurrão lateral de 3 m/s por 2 s e faíscas |
| Névoa / neve | Ver §5.3 (`zFog`), §5.5 e [contracts-real §1](../content/contracts-real.md) |

### 5.14 Aceleração de tempo (`TIME_WARP`, REQ-FLT-023)
- O ciclo é ×1 → ×2 → ×4 → ×1. O debug com autopilot permite ×8.
- `timeScale` é aplicado ao `GameLoop` (sub-passos).
- **Volta automática a ×1** quando:
  - há objeto sólido a < 150 m à frente com `|X − Xobj| < 15 m`;
  - há alerta ativo de prioridade ≥ 2;
  - a fase é diferente de `RUN`;
  - há holofote a < 100 m.
- **Indicador** no HUD "×2"/"×4" em âmbar.

### 5.15 Atlas
- **Energia** em milho: o HUD mostra 🌽 × n e a barra do papo.
- **Distração:** ao iniciar cada linha, com probabilidade de 0,15 (RNG da missão), escolhe um instante aleatório da linha e um lado. Depois:
  1. aviso de 1 s, "Atlas avistou sementes!";
  2. força lateral de 4 m/s em direção ao lado por 2–3 s;
  3. se o jogador segurar `MOVE_X` oposto com intensidade > 0,7 por 0,5 s, a distração termina antes.
- **Decolagem** com `PIGEON_COO`.

### 5.16 Autopilot (debug)
- Com `?debug=1&autopilot=1`, um controlador PD substitui o input:
  - X → 0;
  - velocidade → a do plano;
  - altitude → a do plano. Com TF, o AGL-alvo; sem TF, sobe +5 m/s se houver objeto à frente mais alto que `alt − 5`.
- O autopilot confirma "Levar dados" ou "Processar agora" automaticamente no pós-voo, para o E2E.

### 5.17 Prioridade dos alertas
1. Queda iminente: AGL < 5 m e caindo, ou casco = 1 (crítico).
2. RTH recomendado / energia baixa (crítico).
3. Detectado (crítico).
4. Vento acima do limite (aviso).
5. Overlap insuficiente (aviso).
6. Motion blur (aviso).
7. Fora da faixa (aviso).
8. RTK FLOAT (info).
9. Atlas distraído (info).

### 5.18 Performance
- O orçamento é de ≤ 12 ms/frame em Alta no perfil de referência.
- **Otimizações obrigatórias:**
  - elevação por faixa calculada uma vez por frame, sem recálculo por objeto;
  - normais vindas da mesma grade;
  - `Path2D` reutilizado;
  - `fillStyle` com cache de strings por cor quantizada (64 níveis);
  - objetos fora do frustum descartados antes da ordenação.
- **Contador interno de tempo por etapa** (terreno, objetos, HUD), exibido no painel `F9`.

## 6. Integração

```ts
interface FlightHudSnapshot {
  phase: FlightPhase; lineIndex: number; nLines: number; lineProgress: number; crossTrackM: number; outOfLane: boolean;
  altM: number; aglM: number; speedMs: number; windCrossMs: number; crabDeg: number; timeScale: number;
  energy: number; energyUnit: 'BATTERY' | 'CORN'; cornLeft?: number; timeLeftS: number; rthAlert: boolean;
  hull: number; hullMax: number; rtk: RtkStatus; activeSensor: 'RGB' | 'LIDAR';
  gsdCm: number; gsdOk: boolean; pRealPct: number | null; qEstPct: number; photos: number; photosPlanned: number; blurPx: number;
  lidarDensity?: number; groundDensity?: number; alerts: FlightAlert[]; detectedProgress?: number; rings?: number;
  minimap: { lines: Array<[AoiPoint, AoiPoint]>; shots: AoiPoint[]; pos: AoiPoint; heading: number };
}
```

- **Eventos → store:** `onShot` → `mission.appendShots` em lotes de 10, `onLidarBatch` → `mission.mergeLidar` a cada 0,5 s, `onSortieEnd` → `mission.endSortie(outcome)`. Este último descarta os dados da surtida em CRASH ou ENERGY_DEPLETED e registra `completedLines`.
- **Estatísticas:** `stats.photosTaken`, `stats.flightTimeS` e `stats.crashes` são atualizadas no fim da surtida.

## 7. Casos de borda
- Plano com uma única linha: TURN nunca ocorre.
- Pausa no meio do TURN ou do TAKEOFF: congela a animação.
- `dt` grande (aba em segundo plano): clamp de 50 ms. Nenhum disparo é "perdido em lote": o temporizador dispara no máximo uma vez por sub-passo.
- Energia acabando durante o TURN: queda, com os dados da surtida descartados.
- Alternar sensor sem o Pod: no-op, com a dica "Sem LiDAR a bordo".
- Asa fixa abaixo de vMin: a velocidade é limitada (*stall* não modelado) e o HUD mostra "VELOCIDADE MÍNIMA".
- Terrain Following sem suporte: o toggle nem aparece no plano.
- Malha cruzada com Atlas: indisponível, porque o pombo só segue rotas simples.

## 8. Critérios de aceite
- **Dado** o C00 com o plano de referência e autopilot, **quando** o voo terminar, **então** há 6 linhas completas e 96 ± 6 fotos, e o pós-voo oferece "Levar dados".
- **Dado** um objeto `BUILDING` de 30 m à frente e voo a AGL 20 m, **quando** a aeronave alcançar o objeto sem desviar, **então** o casco cai 1, toca `CRASH` e a velocidade cai a 30 %.
- **Dado** velocidade 30 % acima do plano, **quando** dois disparos consecutivos ocorrerem, **então** `p_real` fica abaixo do mínimo e aparece "OVERLAP INSUFICIENTE".
- **Dado** o Pod LiDAR e `TOGGLE_SENSOR`, **quando** alternar para LiDAR, **então** o leque aparece, o zumbido toca, a densidade exibida é igual a `lidarDensity()` e os disparos param.
- **Dado** energia insuficiente para voltar, **quando** `rthRequired` virar true, **então** o bip toca a cada 1,5 s e o alerta crítico aparece.
- **Dado** `reduceFlashes`, **quando** uma foto for disparada, **então** nenhum overlay branco é desenhado.
- **Dado** a qualidade Alta em 1280 × 720, **quando** voar 10 s no C01, **então** a média de FPS fica ≥ 55 no perfil de referência (verificação manual em T077).

## 9. Testes
- **Unitário (puro):** `project`, mapeamento AOI ↔ *run*, `stepAircraft` (limites, TF, asa fixa), temporizador de disparo, `realForwardOverlap` no fluxo, `checkCollision` (cada forma, fio, raio), sorteio da distração do Atlas, regra de volta do *time warp*, `rtkStatusAt`, detecção de holofote, coleta de anéis, avaliação de features, fim de surtida (descarte).
- **Draw list:** `buildDrawList` de uma cena com morro e objeto atrás confirma a ordem (objeto antes do quad que o oclui).
- **RTL:** HUD a partir de snapshots (alertas, Atlas, LiDAR) e `PostFlightDialog` (combinações de botões).
- **E2E:** `flight.spec.ts` cobre `?debug=1&screen=SURVEY_FLIGHT&autopilot=1` até o pós-voo, e testa pausa no meio (posição congelada).

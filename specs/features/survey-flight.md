# Feature — `SURVEY_FLIGHT`: Motor de Voo 2.5D (Pseudo-3D estilo arcade)

## 1. Objetivo
Executar o plano de voo num Canvas 2D a 60 FPS, com forte ilusão de profundidade:
- relevo visível em perspectiva cônica;
- obstáculos que crescem do horizonte até a câmera;
- sensores operando em tempo real (câmera RGB com pegada luminosa e LiDAR com leque de feixes);
- clima, vento e energia como desafios.

Cada linha de voo é uma corrida para frente, e **quem pilota é o jogador**: ele alinha a aeronave na entrada da faixa, segura o corredor contra as rajadas, acompanha o relevo quando não há Terrain Following e cuida da velocidade no solo. As consequências técnicas (GSD, sobreposição, blur, RTK) são medidas a cada disparo, e cada disparo recebe uma **nota de execução** que entra na avaliação da missão ([ADR-029](../decisions.md)). Um jogador que não toca nos controles é reprovado (REQ-NFR-010).

## 2. Requisitos cobertos
REQ-FLT-001 a REQ-FLT-029, REQ-AUD-002 (sons do voo), REQ-NFR-001, REQ-NFR-007, REQ-NFR-010, REQ-CORE-003, REQ-CORE-008.

## 3. Fluxo e estados internos (`FlightPhase`)

```
TAKEOFF (2,5 s) ──▶ RUN(line i) ──fim da linha──▶ TURN (animação) ──▶ RUN(line i+1) … ──última──▶ LANDING (2 s) ──▶ POST_FLIGHT
     RUN ──RTH (confirmado)──▶ RETURNING (3 s) ──▶ POST_FLIGHT
     RUN ──casco = 0 | colisão com terreno | energia = 0──▶ CRASHED (2 s, câmera treme) ──▶ POST_FLIGHT
     TURN ──última linha da fila, com linha recusada ainda não revoada nesta surtida──▶ RUN(revoo da linha recusada)
POST_FLIGHT ──"Nova surtida"──▶ TAKEOFF (na 1ª linha não concluída)
POST_FLIGHT ──"Processar agora" (Van) ──▶ goTo(PROCESSING_RESULTS)    ──"Levar dados"/"Abandonar"──▶ goTo(WORLD_MAP)
```

- **Passada completa:** a aeronave passou de `aoiEndS + B` ao longo da linha com dados registrados, ou seja, ≥ 1 disparo ou pulso na janela da AOI.
- **Linha concluída:** teve uma passada completa **e aceita** (nota da passada ≥ 0,5, §5.20). Só as linhas concluídas entram em `completedLines`.
- **Linha recusada:** a passada terminou com nota < 0,5. Ela vai para o fim da fila da surtida, uma vez por surtida (**revoo**). As fotos da passada recusada ficam na missão com a nota delas: as rejeitadas não contam, as outras contam.
- **Linha incompleta:** foi interrompida antes do fim. Linhas incompletas e recusadas ficam disponíveis para uma nova surtida.
- **Surtida que termina em CRASH ou ENERGY_DEPLETED:** os **shots e pulsos dessa surtida são descartados**. Os dados das surtidas anteriores ficam.

## 4. Layout do HUD (React sobreposto ao canvas)

```
┌───────────────────────────────────────────────────────────────────────────────────────────────────────┐
│ ✈ Condor RTK  ·  📷 RGB 45MP [Tab]  ·  RTK: FIX        LINHA 3/9  ▕████████░░░░▏ 62 %        🔋 74 % 18:32 │
│ EXECUÇÃO  A 88 %  ·  sequência ×7                      desvio  ◀──────●──▶  +2,1 m                ♥♥♥♡ │
│                                                                                                       │
│                         [ ⚠ RAJADA ▶ em 1,2 s ]                                                       │
│                                                                                                       │
│               (canvas 2.5D: céu, relevo, objetos, portais do corredor, aeronave)                      │
│                                                         PERFEITA                                      │
│ ALT 412 m  AGL 98 m  ▲ +4 m  ▲Q ▼E   GSD 1,79 cm/px ✓      FOTOS 143 / 243        LiDAR 158 pts/m²  ┌────┐ │
│ SOLO 10,4 m/s  alvo 10  [W/S]        p 74 %  q 66 %         BLUR 0,4 px ✓          solo 17 pts/m²   │mini│ │
│ VENTO → 6,2 m/s  CRAB 12°  🡆 biruta  CRUZEIRO ×4 [T]                                             └────┘ │
└──────────────────────────────── dicas: [Espaço] foto manual · [R] RTH · [Esc] pausa ─────────────────┘
```

O HUD lê o `FlightHudSnapshot` (§6), publicado a 10 Hz. Alertas centrais: no máximo 2, ordenados por prioridade (§5.17).

- **EXECUÇÃO:** a letra e a nota da passada em curso, e a sequência de amostras Boas ou Perfeitas seguidas (§5.21).
- **▲ +4 m / ▼ −3 m:** quanto falta subir ou descer para a altitude do corredor; some dentro de ±5 % de `H`.
- **SOLO / alvo:** a velocidade no solo e a do plano. Fica âmbar acima de 1,05× e rosa acima de 1,15×.
- **Biruta:** uma seta com a direção do vento em relação à aeronave; na rajada (aviso e sopro) a seta cresce, pisca e aponta para onde ela empurra.
- **CRUZEIRO ×N:** aparece com o tempo acelerado; "CRUZEIRO DESLIGADO" quando o jogador o desliga (§5.14).

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
  - `MOVE_Y` → velocidade no solo alvo (centro = a do plano);
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
- O *run* começa em `s = 0` (início do lead-in), na altitude em que a aeronave vinha. A decolagem leva a aeronave à altitude do corredor em `s = 0` (§5.19).
- **Entrada de faixa (REQ-FLT-028):** toda linha, inclusive a primeira e os revoos, começa com `X = entryOffsetM(...)` ([domain-math §5.1](../design/domain-math.md)): de 30 % a 40 % de `S` para um lado sorteado, limitado a 90 % do que a aeronave corrige até 2 s depois do início da AOI. O sorteio usa a seed `"<missão>:<surtida>:<linha>:<passada>:entry"`. O jogador tem o lead-in para alinhar: as fotos antes de `aoiStartS` não entram na nota da passada.
- **Indicador de desvio:** `e = X`. "FORA DA FAIXA" quando `|e| > 0,25·S` (o limite da nota Fraca).
- **Fim da linha:** quando `s ≥ lineLength`. Entra em `TURN`:
  - duração = `turnTimeS` do plano, limitada à apresentação de 2,5 s;
  - a energia correspondente ao `turnTimeS` real é consumida;
  - animação de fade com minimapa ampliado mostrando a curva e, por cima, o **boletim da linha** (§5.21);
  - o próximo *run* começa com o erro de entrada da nova linha.
- **Ordem das linhas:** primárias em zigue-zague, depois as cruzadas, se houver. Depois da última, as linhas recusadas nesta surtida, na ordem em que foram recusadas (cada uma no máximo uma vez por surtida).

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
  - `inFog = MAGIC_FOG`;
  - `grade`: a nota de execução (§5.20). A velocidade registrada é a velocidade no solo.
- **Visual:**
  - os 4 cantos da pegada no chão (ou a pegada oblíqua) são projetados e preenchidos com um trapézio na cor da nota (§5.21) em alfa 0,35, com fade de 0,6 s e contorno 1 px;
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
- **Dados:** o acúmulo analítico na grade 64 × 64 ([domain-math §4.4](../design/domain-math.md)) vale para toda a faixa sob a aeronave a cada sub-passo, com o peso da nota do instante (1; 0,5 se Fraca; 0 se Rejeitada, §5.20).
- **Amostras de execução:** com o LiDAR ativo, cada portal cruzado gera uma amostra com nota (o avanço é `gs / v_plano`).
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
  - resumo: linhas concluídas / total, fotos, pulsos, tempo, energia restante, colisões e alertas;
  - **execução:** a letra e a nota de cada linha voada na surtida (a melhor passada), com "revoar" nas recusadas, e a execução da missão até aqui;
  - botões:
    - "Nova surtida" (visível se houver linhas não concluídas, ou seja, incompletas ou recusadas, **e**, para multirrotor e asa fixa, `spareBatteries` restantes nesta missão, ou, para o Atlas, estoque de milho > 0, que enche o papo);
    - "Processar agora" (Van Lab possuída e dados > 0);
    - "Levar dados ao escritório" (dados > 0);
    - "Abandonar missão" (com confirmação; descarta tudo).
  - Se não houver dados, só "Abandonar" e "Tentar de novo" (volta ao `FIELD_SETUP` com o plano mantido). **Exceção:** essa transição `SURVEY_FLIGHT → FIELD_SETUP` **não** está na tabela T1–T15. Ela foi adicionada como **T16** em [architecture §2](../design/architecture.md) (ver ADR-011).

### 5.13 Ambiente especial
| Elemento | Implementação |
| :--- | :--- |
| Vento médio | `windAt(t)` (vento de fundo) é decomposto na transversal e ao longo da linha. A aeronave compensa a transversal (o *crab*; sem deriva constante) e mantém a velocidade no solo do plano dentro dos limites de velocidade no ar ([domain-math §5](../design/domain-math.md)). O HUD mostra a seta de vento, o `crabAngleRad` e a velocidade no solo; quando o limite corta a velocidade, o alerta "VENTO DE PROA: velocidade limitada" (ou "DE CAUDA") aparece. O vento segue afetando o dreno |
| Depuração | `?debug=1&calm=1` voa sem rajadas e sem erro de entrada; o corredor e as notas continuam valendo |
| Rajadas (REQ-FLT-013) | A cada passada, `planGusts` ([domain-math §5.1](../design/domain-math.md)) sorteia de 1 a 3 rajadas com a seed `"<missão>:<surtida>:<linha>:<passada>:gusts"`. O empurrão de cada uma, `driftVelocityMs(peak·env, driftFactor, windDrift)·driftMultiplier`, entra no `stepAircraft` como `gustLateralMs` e `gustAlongMs`. Acima da tolerância da aeronave o empurrão dobra (`STRONG_WIND`). **Aviso** de 1,5 s: alerta "RAJADA ◀" ou "RAJADA ▶" com a contagem, a biruta e riscos de vento no ar (partículas alongadas que cruzam a tela no sentido da rajada, até 40; sem piscar com `reduceFlashes`) |
| Térmicas | `thermalLiftMs`. Visual: distorção sutil (onda) no ar sobre a zona |
| EM | `EM_INTERFERENCE`: soma `ruído(t)·0,8 m/s` lateral e 3° de rumo. Glitch de scanlines no HUD. Atlas fica imune |
| RTK canyon | `rtkStatusAt(u, v)`, com toast na mudança de estado |
| Holofotes | Cones animados. Tempo dentro do cone acumulado (1,5 s; Atlas 3 s) → `detected` |
| Anéis | Coleta ao passar a < 3 m do centro → `ringsCollected++` e `COLLECT` |
| Features | Avaliadas no fim de cada surtida (dados): `PHOTO` → ≥ 3 shots válidos com o centro dentro da pegada (para `DEN_*`, o sensor tem de ser THERMAL); `LIDAR` → pulsos/m² da célula ≥ 50 |
| Criaturas elétricas | Picos seedados a cada 8–12 s: empurrão lateral de 3 m/s por 2 s e faíscas |
| Névoa / neve | Ver §5.3 (`zFog`), §5.5 e [contracts-real §1](../content/contracts-real.md) |

### 5.14 Cruzeiro automático (`TIME_WARP`, REQ-FLT-023, [ADR-031](../decisions.md))
- O tempo acelera **sozinho**. `timeScale` é aplicado ao `GameLoop` (sub-passos). O debug com autopilot continua em ×8.
- **Fator máximo da linha:** `cruiseMax = clamp(round(T/12), 2, 6)`, com `T = lengthM / v_plano` (linhas longas cruzam mais rápido).
- **Condições** (todas, por `CRUISE_ARM_S = 1` s seguido):
  - fase `RUN` e cruzeiro ligado;
  - a nota do instante (faixa, altura e avanço, §5.20) é Boa ou Perfeita;
  - nenhuma rajada avisada ou em curso (do aviso até o fim da rampa de descida);
  - não há objeto sólido a < 150 m à frente com `|X − Xobj| < 15 m`;
  - não há alerta crítico;
  - não há holofote a < 100 m;
  - o Atlas não está avisado nem distraído, e não há pico elétrico em curso nem nos próximos 1,5 s;
  - sem Terrain Following, o corredor não muda mais que `0,05·H` nos próximos `2·cruiseMax` s de trajeto.
- **Subida e queda:** cumpridas as condições, o fator sobe de 1 a `cruiseMax` a 4 por segundo (tempo real). Quando uma condição cai, o fator volta a 1 no mesmo passo e a contagem de 1 s recomeça.
- **`TIME_WARP`** liga e desliga o cruzeiro (começa ligado em cada surtida). Desligado, o voo fica em ×1.
- **Indicador** no HUD "CRUZEIRO ×N" em âmbar, ou "CRUZEIRO DESLIGADO".
- Funções puras (`cruise.ts`): `cruiseMaxFor(lineDurationS)`, `cruiseEligible(ctx)`, `stepCruise(state, eligible, dtRealS, max)` e `solidAheadOf(objects, x)`.

### 5.15 Atlas
- **Energia** em milho: o HUD mostra 🌽 × n e a barra do papo.
- **Distração:** ao iniciar cada linha, com probabilidade de 0,15 (RNG da missão), escolhe um instante aleatório da linha e um lado. Depois:
  1. aviso de 1 s, "Atlas avistou sementes!";
  2. força lateral de 4 m/s em direção ao lado por 2–3 s;
  3. se o jogador segurar `MOVE_X` oposto com intensidade > 0,7 por 0,5 s, a distração termina antes.
- **Decolagem** com `PIGEON_COO`.

### 5.16 Autopilot (debug)
- Com `?debug=1&autopilot=1`, um controlador PD substitui o input:
  - X → 0 (com o empurrão lateral da rajada em curso somado à velocidade lateral medida);
  - velocidade no solo → a do plano (compensa a parte de proa ou de cauda da rajada);
  - altitude → a do corredor (§5.19) um pouco à frente. Com TF, o AGL-alvo; sem TF, sobe +5 m/s se houver objeto à frente mais alto que `alt − 5`.
- É o piloto **bom** das metas de desafio (REQ-NFR-010): aprovado com execução ≥ 0,9 em todo contrato.
- O autopilot confirma "Levar dados" ou "Processar agora" automaticamente no pós-voo, para o E2E.

### 5.17 Prioridade dos alertas
1. Queda iminente: AGL < 5 m e caindo, ou casco = 1 (crítico).
2. RTH recomendado / energia baixa (crítico).
3. Detectado (crítico).
4. Rajada avisada ou em curso, com o lado (aviso); Atlas distraído (info). Os dois empurram a aeronave e pedem a correção agora.
5. Vento acima do limite (aviso).
6. Fora da faixa (aviso).
7. Fora da altura do corredor: `|alt − corridorAlt| > 0,10·H`, com "SUBA" ou "DESÇA" (aviso).
8. Overlap insuficiente (aviso).
9. Motion blur / pouca luz (aviso).
10. Velocidade limitada pelo vento (info); velocidade mínima da asa fixa (aviso).
11. RTK FLOAT (info).

`alerts()` devolve os 2 mais urgentes (o HUD); `alertList()`, todos os ativos (testes e cruzeiro).

### 5.18 Performance
- O orçamento é de ≤ 12 ms/frame em Alta no perfil de referência.
- **Otimizações obrigatórias:**
  - elevação por faixa calculada uma vez por frame, sem recálculo por objeto;
  - normais vindas da mesma grade;
  - `Path2D` reutilizado;
  - `fillStyle` com cache de strings por cor quantizada (64 níveis);
  - objetos fora do frustum descartados antes da ordenação.
- **Contador interno de tempo por etapa** (terreno, objetos, HUD), exibido no painel `F9`.
- **Quads vizinhos de mesma cor de uma faixa num polígono só** (`QuadStrip`, [ADR-033](../decisions.md)): um `fill` por trecho, com o avanço de 1 px na borda de perto e na ponta da direita; o brilho da água vem depois do último trecho da faixa.
- **Resolução adaptativa** ([ADR-033](../decisions.md)): a escala do buffer do canvas fica entre 0,75 e o teto da qualidade (Alta: o DPR; Média: 1,5; Baixa: 1), descendo um degrau quando a janela de 1,5 s fecha abaixo de 54 FPS (e só se a descida ajudar) e subindo depois de 3 s a 58 FPS ou mais. O `F9` mostra a escala.

### 5.19 Corredor e portais (REQ-FLT-025)
- **Perfil:** ao começar cada linha, o motor calcula `corridorProfile` ([domain-math §10.3](../design/domain-math.md)) com a elevação ao longo do eixo da linha, `H`, a velocidade do plano, a razão de subida da aeronave e o teto. O perfil não muda durante a passada.
- **Portais:** em `gatePositions(line, B)`. Cada portal é um retângulo de `0,20·S` × `0,20·H` centrado em `X = 0` e na altitude do corredor, com um losango central de `0,10·S` × `0,10·H` (a zona da nota Perfeita).
- **Desenho** (`corridorRenderer.ts`, depois do terreno e dos objetos, antes da aeronave):
  - só os portais com `0 < Z ≤ 400 m`, de longe para perto, no máximo 16;
  - contorno de 2 px em `cyan-300`, com alfa de 0,15 (longe) a 0,7 (perto); o próximo portal é o mais forte;
  - portal já cruzado some; no cruzamento, pisca na cor da nota do instante por 0,25 s (sem piscar com `reduceFlashes`);
  - entre portais vizinhos, duas linhas finas (alfa 0,12) ligam os cantos inferiores: o "trilho" do corredor;
  - nas fendas a cor é `violet-300`.
- **API para testes:** `buildCorridorDrawList(state): GateDraw[]`.
- **Decolagem:** a aeronave sobe até a altitude do corredor em `s = 0`, com ou sem TF.

### 5.20 Nota de execução no voo (REQ-FLT-026, REQ-FLT-027)
- **Nota do instante:** a cada sub-passo o motor calcula `gradeSample` ([domain-math §10.3](../design/domain-math.md)) com o estado da aeronave, usando `gs / v_plano` como avanço. Ela alimenta o HUD, o cruzeiro e o peso dos pulsos LiDAR.
- **Foto automática:** a nota usa o avanço real (`d / B` até a foto automática anterior da passada). Vai em `Shot.grade`.
- **Foto manual:** nota só pela altura e pelo avanço instantâneo. Não entra na contagem da passada.
- **Amostra LiDAR:** uma a cada portal cruzado com o LiDAR ativo.
- **Contagem da passada:** as amostras automáticas com `s ≥ aoiStartS`. No fim da linha (ou na interrupção) o motor fecha o `LinePass` e publica `onLinePass`.
- **Aceitação:** `passAccepted`. Linha aceita entra em `completedLines`; linha recusada vai para a fila de revoo da surtida (uma vez por surtida) e conta em `refly` no resultado.
- **Surtida perdida** (queda ou energia): as passadas dela são descartadas junto com as fotos.

### 5.21 Retorno imediato (REQ-FLT-029)
- **Cores das notas:** Perfeita `emerald-400`, Boa `cyan-300`, Fraca `amber-400`, Rejeitada `rose-500`.
- **Marca da amostra:** a cada amostra, o nome da nota ("PERFEITA", "BOA", "FRACA", "REJEITADA") aparece acima da aeronave, na cor da nota, sobe 24 px e some em 0,7 s. Na Fraca e na Rejeitada, o eixo que derrubou a nota vem junto ("FRACA · faixa", "REJEITADA · altura", "FRACA · avanço"). Com `reduceFlashes`, aparece sem movimento e some por alfa.
- **Sequência:** o número de amostras seguidas com nota Boa ou Perfeita. O HUD mostra "sequência ×N" a partir de 3.
- **Som** ([audio §4](../design/audio.md)): `GRADE` com o grau da escala subindo a cada Perfeita seguida, `GRADE` no mesmo grau na Boa e `GRADE_MISS` na Fraca e na Rejeitada, que zeram o grau.
- **Boletim da linha:** durante a curva (e no pouso depois da última linha), um cartão central mostra "LINHA 3 · A", a contagem por nota e, se a passada foi recusada, "REVOO NECESSÁRIO" em rosa. Toca `STAGE_DONE` (aceita) ou `DENIED` (recusada).
- **Dica do corredor:** enquanto a nota do instante for Rejeitada por mais de 1 s, o alerta do eixo ("FORA DA FAIXA", "SUBA", "DESÇA") fica visível (§5.17).

## 6. Integração

```ts
interface FlightHudSnapshot {
  phase: FlightPhase; lineIndex: number; nLines: number; lineProgress: number; crossTrackM: number; outOfLane: boolean;
  altM: number; aglM: number; speedMs: number; windCrossMs: number; crabDeg: number; timeScale: number;
  energy: number; energyUnit: 'BATTERY' | 'CORN'; cornLeft?: number; timeLeftS: number; rthAlert: boolean;
  hull: number; hullMax: number; rtk: RtkStatus; activeSensor: 'RGB' | 'LIDAR';
  gsdCm: number; gsdOk: boolean; pRealPct: number | null; qEstPct: number; photos: number; photosPlanned: number; blurPx: number;
  lidarDensity?: number; groundDensity?: number; alerts: FlightAlert[]; detectedProgress?: number; rings?: number;
  groundSpeedMs: number; planSpeedMs: number;                       // velocidade no solo e a do plano
  corridorDeltaM: number;                                           // altitude do corredor − altitude (positivo: subir)
  grade: ShotGrade; lastGrade?: { grade: ShotGrade; axis?: 'lateral' | 'vertical' | 'advance'; seq: number };
  streak: number; passScore: number | null; passLetter: string | null;
  gust: { side: -1 | 1; inS: number; active: boolean } | null;      // rajada avisada ou em curso
  windRelDeg: number;                                               // para a biruta: direção do vento em relação à aeronave
  cruise: { on: boolean; factor: number };
  lineReport: { lineNumber: number; letter: string; counts: [number, number, number, number]; accepted: boolean } | null;
  minimap: { lines: Array<[AoiPoint, AoiPoint]>; shots: AoiPoint[]; pos: AoiPoint; heading: number };
}
```

- **Eventos → store:** `onShot` → `mission.appendShots` em lotes de 10, `onLidarBatch` → `mission.mergeLidar` a cada 0,5 s, `onSortieEnd` → `mission.endSortie(outcome)`. Este último descarta os dados da surtida em CRASH ou ENERGY_DEPLETED e registra `completedLines` (as linhas aceitas) e `linePasses` (as passadas da surtida, que vêm no `SortieResult`).
- **Eventos de execução:** `onGrade(grade, streak)` (som e marca) e `onLinePass(pass, accepted)` (boletim).
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
- Linha mais curta que o lead-in mais 5 s: uma única rajada, logo depois da entrada.
- Passada sem nenhuma amostra na contagem (linha interrompida antes de `aoiStartS`): nota 0, incompleta; não gera boletim.
- Revoo recusado de novo: a linha fica recusada até uma nova surtida; a fila não cresce uma segunda vez.
- RTH durante um revoo: a passada fica incompleta e a nota dela vale proporcionalmente às amostras feitas.
- Missão de save antigo (sem `linePasses`): já estava voada e na fila de processamento; a execução dela vale 1.

## 8. Critérios de aceite
- **Dado** o C00 com o plano de referência e autopilot, **quando** o voo terminar, **então** há 6 linhas completas e 96 ± 6 fotos, e o pós-voo oferece "Levar dados".
- **Dado** um objeto `BUILDING` de 30 m à frente e voo a AGL 20 m, **quando** a aeronave alcançar o objeto sem desviar, **então** o casco cai 1, toca `CRASH` e a velocidade cai a 30 %.
- **Dado** velocidade 30 % acima do plano, **quando** dois disparos consecutivos ocorrerem, **então** `p_real` fica abaixo do mínimo e aparece "OVERLAP INSUFICIENTE".
- **Dado** o C00 com o plano de referência e **nenhum comando**, **quando** a surtida terminar, **então** nenhuma linha é aceita, a execução fica abaixo de 0,4 e o processamento reprova a missão.
- **Dado** uma linha recém-iniciada, **quando** o jogador não corrige o erro de entrada, **então** as fotos saem Rejeitadas ou Fracas pela faixa, o boletim mostra "REVOO NECESSÁRIO" e a linha volta ao fim da fila.
- **Dado** uma rajada sorteada para t = 12 s da linha, **quando** o voo chega a t = 10,5 s, **então** o alerta "RAJADA" aparece com o lado, o cruzeiro cai para ×1 e, a partir de t = 12 s, a aeronave é empurrada.
- **Dado** a aeronave estável no corredor por 1,5 s e nenhuma rajada avisada, **quando** o cruzeiro está ligado, **então** o tempo acelera até o fator da linha.
- **Dado** o Pod LiDAR e `TOGGLE_SENSOR`, **quando** alternar para LiDAR, **então** o leque aparece, o zumbido toca, a densidade exibida é igual a `lidarDensity()` e os disparos param.
- **Dado** energia insuficiente para voltar, **quando** `rthRequired` virar true, **então** o bip toca a cada 1,5 s e o alerta crítico aparece.
- **Dado** `reduceFlashes`, **quando** uma foto for disparada, **então** nenhum overlay branco é desenhado.
- **Dado** o primeiro voo do C00 (etapa 4 do tutorial), **quando** a primeira linha começa, **então** a dica do voo ganha embaixo "Alinhe já na entrada…"; depois, o primeiro aviso de rajada, a primeira seta de altura, a primeira nota, o primeiro cruzeiro acelerado e o primeiro boletim trazem cada um a sua dica, uma de cada vez (6 s cada; a da rajada entra na hora) e uma vez só.
- **Dado** a qualidade Alta em 1280 × 720, **quando** voar 10 s no C01, **então** a média de FPS fica ≥ 55 no perfil de referência (verificação manual em T077).

## 9. Testes
- **Unitário (puro):** `planGusts`, `gustPushAt`, `entryOffsetM`, `corridorProfile`, `gradeSample`, `passScore`, `missionExecution`, `cruiseEligible`, `stepCruise`, `project`, mapeamento AOI ↔ *run*, `stepAircraft` (limites, TF, asa fixa, velocidade no solo), temporizador de disparo, `realForwardOverlap` no fluxo, `checkCollision` (cada forma, fio, raio), sorteio da distração do Atlas, regra de volta do *time warp*, `rtkStatusAt`, detecção de holofote, coleta de anéis, avaliação de features, fim de surtida (descarte).
- **Draw list:** `buildDrawList` de uma cena com morro e objeto atrás confirma a ordem (objeto antes do quad que o oclui).
- **RTL:** HUD a partir de snapshots (alertas, Atlas, LiDAR), `PostFlightDialog` (combinações de botões) e as dicas do primeiro voo (`flightCoach`: qual dica cada snapshot pede, o tempo na tela e a urgente).
- **Pilotos simulados (REQ-NFR-010):** `challenge/challenge.{idle,align,pilots}.test.ts` voam cada contrato com o plano de referência como parado, distraído, mediano e bom, e confere as metas de [ADR-032](../decisions.md).
- **E2E:** `flight.spec.ts` cobre `?debug=1&screen=SURVEY_FLIGHT&autopilot=1` até o pós-voo, e testa pausa no meio (posição congelada). `flight-piloting.spec.ts` voa o C00 sem autopilot: pilotando só pelo teclado (`A`/`D`, `Q`/`E` e `W`/`S` segurados, lendo o HUD a 10 Hz) nenhuma linha fica para revoo e o relatório aprova; sem comando, a linha 1 fecha com "REVOO NECESSÁRIO" e o retorno à base mostra a execução abaixo de 40 %. O HUD expõe em `data-*` os números que mostra (fase, desvio da faixa, diferença para o corredor e a tolerância, razão da velocidade no solo).

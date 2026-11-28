# Feature — `FIELD_SETUP`: Planejamento Técnico e Mini-Games de Campo

## 1. Objetivo
Vista ortogonal "de satélite" da AOI, onde o jogador:
1. crava os GCPs e CPs respeitando a acessibilidade do veículo;
2. configura aeronave, sensor, lente, H, p, q, v, orientação, modos e iluminação, vendo as estatísticas e as linhas de voo ao vivo;
3. joga os mini-games opcionais de nivelamento e IMU;
4. revisa o checklist e decola.

## 2. Requisitos cobertos
REQ-FLD-001 a REQ-FLD-013, REQ-PRG-013 (milho do Atlas), REQ-INP-006.

## 3. Fluxo e estados internos (wizard)

```
[1 Pontos de Apoio] ⇄ [2 Plano de Voo] ⇄ [3 Calibração (opcional)] ⇄ [4 Checklist & Decolagem]
        ▲ abas livres: o jogador pode ir e voltar; a aba 4 mostra o resumo final.
        └─ "Cancelar" (UI_BACK na aba 1 ou botão) → ConfirmDialog → goTo(WORLD_MAP) + mission.discardActive()
```

O estado vive em `mission.active`:
- `plan.params` com padrões do contrato e do equipamento (§5.3);
- `groundPoints`;
- `minigames`;
- `fieldEquipmentId`.

Qualquer mudança recalcula `plan` via `buildFlightPlan(params, contract)`, que é memoizado.

## 4. Layout

```
┌─ Cabeçalho: contrato · cliente · [1 Pontos][2 Plano][3 Calibração][4 Checklist] · Cancelar ─────────────────────────────┐
├──────────────────────────────────────────────────────────────┬──────────────────────────────────────────────────────────┤
│                                                              │  PAINEL DA ABA (380 px)                                  │
│   CANVAS SATÉLITE (AOI + 20 % de margem)                     │  Aba 1: ferramenta [GCP|CP|Borracha] · instrumento       │
│   - hillshade, cobertura, estradas, objetos vistos de cima   │         contadores · cobertura do casco · colinearidade │
│   - máscara de acessibilidade (hachura vermelha)             │  Aba 2: aeronave · sensor · lente · sliders · modos     │
│   - GCPs (xadrez), CPs (triângulo), casco convexo            │         iluminação · ESTATÍSTICAS AO VIVO               │
│   - linhas de voo, setas, pontos de disparo, pegada exemplo  │  Aba 3: [Nivelar instrumento] [Calibrar IMU] + notas    │
│   - escala gráfica, norte, coordenadas do cursor (u,v,z)     │  Aba 4: checklist de requisitos + erros bloqueantes     │
│                                                              │         [ DECOLAR ▶ ]                                    │
└──────────────────────────────────────────────────────────────┴──────────────────────────────────────────────────────────┘
```

## 5. Regras e algoritmos

### 5.1 Canvas satélite (`engines/field/SatelliteRenderer.ts`)
- **Raster** gerado uma vez por contrato: 512 × 512 sobre a AOI + margem, em `ImageData`, com:
  - `cor(landCover) × hillshade(azimute 315°, elevação 45°)`;
  - as estradas;
  - os objetos vistos de cima (telhados, copas) com sombra conforme a iluminação **selecionada**, que é re-sombreada ao trocar.
- **Overlays** desenhados a cada frame:
  - contorno da AOI em tracejado ciano;
  - máscara de acessibilidade, numa grade de 64 × 64 com hachura `rose-500/40` nas células inválidas para os veículos possuídos;
  - GCPs, CPs e casco convexo;
  - linhas, setas, pontos de disparo e pegada de exemplo (retângulo `cyan-400/30` na primeira foto da linha 1);
  - escala gráfica e rosa dos ventos;
  - seta de vento (direção e intensidade).
- **Pan e zoom:** roda do mouse para zoom de 1× a 4×, arrastar com o botão direito ou do meio para mover, e analógico direito no gamepad.
- **Cursor de gamepad:** retícula movida pelo analógico esquerdo a 300 px/s. `INTERACT` coloca o ponto.

### 5.2 Aba 1 — Pontos de apoio (GCP/CP)
- **Ferramentas:** `GCP` (padrão), `CP`, `Borracha`. Teclado: `G`, `C`, `X`. Gamepad: `FIRE` alterna.
- **Clique válido:** cria um `GroundPoint`:
  - `elevM = sampler.elevation(u,v)`;
  - `sigmaM` calculado ao decolar (§5.4);
  - `id`: `GCP-01…`, `CP-01…`.
- **Arrastar** um ponto existente o move, revalidando a acessibilidade.
- **Clique inválido:** pisca vermelho, toca `DENIED` e mostra o motivo no tooltip (REQ-FLD-003), na ordem: Água → Telhado → Copa densa (sem visada) → Brejo → Declividade X % > Y % → Fora do alcance (Z m da via mais próxima > W m).
- **Instrumento:**
  - Possuindo os dois equipamentos, há um toggle "Estação Total (σ 1 cm, máx. 8)" / "GNSS RTK (σ 1,5 cm, máx. 20)".
  - Ao trocar para a Estação Total com mais de 8 pontos, aparece o aviso, e a troca é recusada até remover pontos.
- **Painel:**
  - nº de GCPs / mínimo do contrato e nº de CPs / mínimo;
  - `hullCoverage` (%) e `collinearityIndex`;
  - semáforo:
    - verde quando n ≥ mínimo, cobertura ≥ 40 % e c ≥ 0,3;
    - âmbar quando parcial;
    - vermelho quando n < 3 ou c < 0,05;
  - dica contextual, por exemplo: "Distribua nos 4 cantos e no centro" ou "Pontos quase alinhados: o Z vai sofrer".
- **"Sugestão automática"** (botão de tutorial, só no C00): posiciona 5 GCPs nos cantos (inset de 10 %) e no centro, usando `snapToAccessible`.

### 5.3 Aba 2 — Plano de voo
**Controles:**
- **Aeronave:** `Tabs` com as possuídas. Desabilitada com o motivo, se incompatível com `SENSOR_KIND`, `AIRCRAFT_KIND` ou `MIN_AIRCRAFT_TIER` **críticos**: ela aparece, mas com aviso.
- **Sensor/carga:** lista dos possuídos compatíveis com a aeronave. Com o Pod, aparece o seletor "Sensor primário para espaçamento: RGB | LiDAR".
- **Lente:** só para `INTERCHANGEABLE`, entre as possuídas.
- **Sliders:**
  - `H`: `[hMinM, min(hMaxM, ceilingM)]`, passo de 1 m;
  - `p`: 60–85, passo de 1;
  - `q`: 50–80, passo de 1;
  - `v`: `[vMinMs, vMaxMs]`, passo de 0,5.
  - Cada slider tem `warnRange` derivado dos requisitos. Por exemplo, a faixa de H que viola o GSD máximo aparece em âmbar.
- **Orientação:** "Ao longo do comprimento" (padrão) | "Ao longo da largura".
- **Modos:** toggles `Terrain Following`, `Malha cruzada` e `Oblíqua (45°/60°)`, habilitados conforme a aeronave (REQ-FLD-012).
- **Iluminação:** `Tabs` com `contract.lightingOptions`, cada uma com ícone (`Sun`, `Cloud`, `Sunset`, `Snowflake`, `CloudFog`) e tooltip das consequências.

**Padrões ao entrar:**
- aeronave = a primeira recomendada que o jogador possui, ou a de maior tier compatível;
- H = clamp(80, limites);
- p = 75, q = 65, v = vCruise;
- iluminação = a primeira opção.

**Estatísticas ao vivo** (REQ-FLD-007), em `Stat`s mono agrupados:
- **Geometria:**
  - focal real (mm);
  - pixel (µm);
  - **GSD (cm/px)** (status pelo requisito);
  - W_g × H_g (m);
  - B (m) e S (m);
  - Δt (s).
- **Missão:**
  - nº de linhas (primárias + cruzadas);
  - fotos por linha e total;
  - comprimento da linha (m);
  - tempo de curva (s);
  - **tempo de voo** (mm:ss);
  - **baterias necessárias** / disponíveis (1 + reservas), ou **milho necessário** / papo + estoque.
- **Qualidade prevista:**
  - blur previsto (px, com classe);
  - skew de rolling shutter (px);
  - RMSE previsto (xy, z, em cm), via `accuracy` com fotos ideais;
  - classe PEC prevista.
- **LiDAR** (com o Pod):
  - faixa (m);
  - densidade (pts/m²);
  - densidade de solo prevista, usando o dossel médio da AOI.

### 5.4 Aba 3 — Calibração (mini-games)
Os dois mini-games são opcionais. Cada um pode ser repetido; vale a melhor pontuação da sessão. Se o jogador decolar sem jogar, valem os padrões `levelScore = 0,5` e `imuScore = 0`.

**Controles durante o jogo** ([ADR-038](../decisions.md)): o mini-game aberto é a camada de input do topo, no contexto `MINIGAME`. O analógico esquerdo, o D-pad, `W A S D`, as setas e o mouse movem a bolha ou o cursor; o mapa de satélite fica parado e as abas não trocam. `Voltar` (`Esc`, `B`, `○`) interrompe o jogo sem pontuar, e a tela segue na aba. Quando o jogo termina ou é interrompido, o foco volta ao botão que o abriu. `M` e Menu/Options pausam.

**Nivelamento do instrumento (bolha), REQ-FLD-010:**
- **Canvas** de 360 × 360: vista de cima de um nível de bolha circular. O alvo central tem raio `r_t = 18 px`, e a bolha tem raio de 14 px.
- **Física da bolha:** `pos += vel·dt`, `vel += (drift(t) + kick + inputForce − 2,5·vel)·dt`, onde:
  - `drift(t)` = `valueNoise` 2D de amplitude 120 px/s², que muda lentamente;
  - `kick` = impulsos aleatórios de 250 px/s² a cada 1,5–3 s (vento);
  - `inputForce` = `MOVE` × 400 px/s², ou arrastar com o mouse.
  - A bolha fica limitada a um raio de 150 px.
- **Janela de 8 s:**
  - `score = (1/8)·∫ w(d) dt`, com `w(d) = 1` se `d ≤ r_t`, `max(0, 1 − (d − r_t)/60)` caso contrário;
  - "Travar nível": se a bolha ficar dentro do alvo por 3 s seguidos, o jogo termina antes com `score = max(score_parcial_extrapolado, 0,9)`.
- **Resultado:** `levelScore`. Exibe "Precisão do apoio: σ = X cm" (usando [domain-math §6.4](../design/domain-math.md)).
- Com o `GNSS_RTK_KIT` e uma aeronave RTK, o texto acrescenta "Base RTK nivelada: FIX mais estável".

**Calibração da IMU (lemniscata), REQ-FLD-011:**
- **Canvas** de 480 × 300 (coordenadas do jogo): curva de Bernoulli `x = a·cos t / (1 + sin² t)`, `y = a·sin t·cos t / (1 + sin² t)`, com `a = 200 px`. O desenho **escala e centra** para caber no canvas do painel, qualquer que seja a largura dele (antes ele saía do quadro num painel mais estreito que 480 px, [ADR-034](../decisions.md)); o ponteiro do mouse é convertido para as coordenadas do jogo. Ao abrir, a tela rola até o jogo caber inteiro. O nivelamento (360 × 360) escala do mesmo jeito.
- **Preparação** de 2 s: o guia espera no ponto de partida, com um anel que fecha sobre ele, e nada é amostrado; o cursor já se mexe. O texto mostra "Prepare-se: N".
- **Ponto-guia** percorre 2 voltas em 20 s depois da preparação. O cursor do jogador é o mouse, ou o analógico integrado (velocidade de 350 px/s).
- **Pontuação:** `imuScore = clamp(1 − mean(d)/60, 0, 1)`, onde `d` é a distância cursor–guia amostrada a 30 Hz (600 amostras).
- **Visual:** rastro do cursor em ciano e o do guia em âmbar, um halo âmbar translúcido de 20 px em volta do guia (a zona boa), mais a leitura de "deriva giroscópica" (°/h), que cai conforme a pontuação.

### 5.5 Aba 4 — Checklist e decolagem
- `predictRequirements(plan, contract, groundPoints, inventory)` mostra um `ChecklistItem` por requisito, com o valor previsto e a severidade.
- **Erros bloqueantes** (`validatePlan`), em lista vermelha:
  - sem aeronave;
  - sensor incompatível com a aeronave;
  - H fora dos limites;
  - `nLines < 1`;
  - Atlas sem milho (papo 0 e estoque 0).
- **Avisos** (âmbar): requisitos previstos ✗, baterias insuficientes ("O voo precisará de N surtidas") e vento acima da tolerância.
- **Dificuldade do voo** ([ADR-035](../decisions.md), [survey-flight §5.22](survey-flight.md)): um grupo de três opções (`role="radiogroup"`, cada uma um `radio` alcançável pelo foco), com o que muda e o efeito no pagamento: **Fácil** ("Mais lento e só vento horizontal; janela da curva folgada.", pagamento −20 %), **Média** ("Ritmo normal, com rajadas e correntes verticais de vez em quando.", pagamento normal, marcada por padrão) e **Difícil** ("Mais rápido, rajadas verticais frequentes e janela da curva curta.", pagamento +25 %). A escolha vai para `mission.difficulty` (`setFlightDifficulty`) e vale para todas as surtidas.
- **"DECOLAR ▶"** (glyph `INTERACT`), habilitado sem bloqueantes:
  1. calcula `sigmaM` dos pontos;
  2. muda `mission.status = 'IN_FLIGHT'`;
  3. ao decolar com Atlas, debita um voo de `atlasCalibrationFlights` se o valor for > 0, e grava `atlasCalibrated`;
  4. `goTo('SURVEY_FLIGHT', { missionId })`.

## 6. Integração
- **Domínio:** `photogrammetry.*`, `lidar.*`, `flightPlanner.buildFlightPlan`, `flightPlanner.validatePlan`, `requirements.predictRequirements`, `geometry.*`, `accuracy.estimateFromPlan`.
- **Terreno:** `createTerrain(contract)` para o raster, a acessibilidade e as elevações.
- **Acessibilidade:** `isAccessible(u, v, sampler, ownedVehicles, rules): { ok: boolean; reason?: AccessReason }` em `domain/` (pura, recebe o sampler por interface).

## 7. Casos de borda
- AOI menor que a pegada (`nLines` mínimo 2) → o plano ainda gera 2 linhas.
- Mudar a aeronave invalida sensor e lente → o jogo escolhe o primeiro compatível e mostra um toast.
- Tentar colocar mais pontos que o máximo → recusa com "Limite do instrumento (8)".
- `MAGIC_FOG`: as estatísticas RGB mostram o aviso "Fotos RGB inúteis na névoa: use LiDAR".
- Com Atlas, `H` máx. 120 ([ADR-035](../decisions.md); eram 80). Se o teto do contrato for menor, prevalece o teto.
- Asa fixa com `S < 2R`: o tempo de curva aumenta, conforme a fórmula. A tooltip explica "curva em gota".

## 8. Critérios de aceite
- **Dado** o C00 e o plano de referência, **quando** os parâmetros forem aplicados, **então** as estatísticas mostram GSD 2,52 cm, 6 linhas, 96 fotos e voo de 3:51 (G23).
- **Dado** só FOOT_BIKE, **quando** clicar num ponto a 300 m da estrada, **então** a colocação é recusada com "Fora do alcance".
- **Dado** 3 GCPs colineares, **quando** observar o painel, **então** a colinearidade é < 0,05, o semáforo fica vermelho e a dica fala do eixo Z.
- **Dado** o C05 com DRONE_T1 e o slider H em 55 m ou mais, **quando** observar, **então** o GSD previsto passa de 1,5 cm (1,508 cm a 55 m) e o requisito `MAX_GSD_CM` fica ✗. A faixa ≥ 55 m do slider aparece em âmbar.
- **Dado** o mini-game de bolha com a bolha mantida no centro, **quando** terminar, **então** `levelScore ≥ 0,9`.
- **Dado** um plano sem bloqueantes, **quando** apertar Decolar, **então** a tela vai para `SURVEY_FLIGHT` e `mission.status = 'IN_FLIGHT'`.
- **Dado** o checklist, **quando** o jogador escolher "Difícil", **então** a opção fica marcada, a missão grava `difficulty = 'HARD'` e o HUD do voo mostra "DIFÍCIL".

## 9. Testes
- **Unitário:** `isAccessible` (cada motivo, união de veículos, `PAINT_MARKERS`), `buildFlightPlan` (padrões, malha cruzada, LiDAR primário), `validatePlan`, `predictRequirements` (cada `check.type`), pontuação dos mini-games (funções puras: `scoreBubble(samples)` e `scoreLemniscate(samples)`).
- **RTL:** sliders com limites e faixas de aviso; troca de aeronave reseta o sensor; checklist.
- **E2E:** `field.spec.ts` cobre o C00: sugestão automática de GCPs → plano padrão → dificuldade difícil → decolar.

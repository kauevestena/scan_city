# Feature — `INFOGRAPHIC_LAB`: Laboratório de Infográficos e Simulações

## 1. Objetivo
Uma central educacional interativa com quatro painéis animados. Neles o jogador manipula sliders e observa diagramas que explicam os princípios físicos e matemáticos da fotogrametria e do LiDAR. Todos os números vêm de `src/domain/`, as mesmas funções usadas no jogo.

## 2. Requisitos cobertos
REQ-LAB-001 a REQ-LAB-005, REQ-INP-006.

## 3. Fluxo e estados internos
- `Tabs` com 4 painéis: `OPTICS`, `STEREO`, `CANOPY` e `SHUTTER`.
- O payload `panel?` abre direto um painel.
- Cada painel mantém os próprios valores dos sliders (estado local), e eles **não** são persistidos.
- O botão **"Usar valores do meu equipamento"** preenche os sliders com os da melhor câmera/aeronave possuída.
- `UI_BACK` → `goTo('OFFICE')`.

## 4. Layout (comum)

```
┌─ TopBar ──────────────────────────────────────────────────────────────────────────────────────────────┐
│ [1 Óptica & GSD] [2 Estereoscopia & Paralaxe] [3 LiDAR vs. Fotogrametria] [4 Global vs. Rolling]       │
├──────────────────────────────────────────────────────────────────────────┬────────────────────────────┤
│                                                                          │ SLIDERS                    │
│            canvas animado (diagrama em corte, 60 FPS)                    │ ───────────────            │
│                                                                          │ FÓRMULAS AO VIVO           │
│                                                                          │ GSD = H·s/f = 1,25 cm/px   │
│                                                                          │ ───────────────            │
│                                                                          │ "Você sabia?" (texto curto) │
└──────────────────────────────────────────────────────────────────────────┴────────────────────────────┘
```

As fórmulas aparecem em `font-mono`, com os valores substituídos ao vivo. Por exemplo: `GSD = (100 m × 4,38 µm) / 35 mm = 1,25 cm/px`.

## 5. Painéis

### 5.1 Óptica & GSD (REQ-LAB-001)
- **Sliders:**
  - H (20–300 m);
  - f (4–50 mm);
  - pixel (1,5–17 µm);
  - largura do sensor (6–36 mm);
  - preset de câmera, que preenche os três últimos.
- **Diagrama em corte transversal:**
  - Topo: sensor (retângulo) com pixels desenhados como uma grade, um deles destacado em âmbar.
  - Lente (elipse) a `f` (escala exagerada) abaixo do sensor.
  - Cone de raios até o solo a H, em escala vertical logarítmica com rótulos.
  - No solo: segmento `W_g` e o "pixel projetado" (GSD) destacado em âmbar, com uma lupa (*inset*) que mostra o pixel do solo sobre a textura da orto.
- **Animação:** raios de luz (pontos) percorrendo do solo ao sensor.
- **Leituras:** `gsd()`, `footprint()`, `horizontalFovRad()` e "Resolução para PEC-PCD A: escala máxima ≈ 1:(GSD·4000)". Isso é uma regra prática exibida como heurística, com nota.

### 5.2 Estereoscopia & Paralaxe (REQ-LAB-002)
- **Sliders:** B (5–100 m), H (50–300 m), h do prédio (0–0,8·H), f (fixa 35 mm, editável) e σ de correlação (0,1–1,0 px).
- **Diagrama:**
  - duas câmeras (C1 e C2) separadas por B na altura H;
  - um prédio de altura h entre elas;
  - raios de C1 e C2 até o **topo** (âmbar) e a **base** (ciano) do prédio;
  - os dois planos-imagem ampliados, acima, com as posições dos pontos e as cotas `b` (base fotográfica) e `Δp` (paralaxe diferencial).
- **Leituras:**
  - `photoBaseM`;
  - `parallaxDiffM` (em mm);
  - `heightFromParallax` (h reconstruído, que deve bater com o slider);
  - razão B/H com classificação (< 0,3 "fraca", 0,3–0,6 "boa", > 0,6 "forte, mas com oclusões");
  - `depthPrecisionM` (σ_Z em cm).
- **Animação:** o prédio "cresce" quando h muda, e os raios se reajustam com interpolação de 150 ms.

### 5.3 LiDAR vs. Fotogrametria no Dossel (REQ-LAB-003)
- **Sliders:** cobertura do dossel (0–98 %), nº máximo de retornos (1–5), PRR (50–500 kHz), H (40–300 m), v (5–25 m/s) e FOV (fixo 70°).
- **Diagrama em perfil (duas metades):**
  - **Esquerda, LiDAR:**
    - pulsos (traços verdes) descendo em leque;
    - cada pulso atravessa camadas de copa (manchas verdes com "buracos" proporcionais a 1 − cobertura);
    - marcas de retorno: 1º (ciano), intermediário (violeta), último no solo (emerald, só com a probabilidade `P_solo`);
    - embaixo, o perfil de MDT reconstruído (linha emerald) e o MDS (linha ciano).
  - **Direita, câmera RGB:** raios que param na copa. O MDS segue a copa, e o "MDT fotogramétrico" só existe nos buracos (fração `(1 − c)²`) e aparece pontilhado e interpolado.
- **Leituras:**
  - `lidarSwathM`;
  - `lidarDensity`;
  - `groundReturnProbability`;
  - `groundDensity`;
  - `photoGroundVisibility`;
  - veredito: "MDT confiável" se a densidade de solo for ≥ 4 pts/m²; senão, "insuficiente".

### 5.4 Global Shutter vs. Rolling Shutter (REQ-LAB-004)
- **Sliders:** velocidade v (0–25 m/s), tempo de leitura (5–60 ms), taxa de giro (0–90°/s), GSD (0,5–5 cm) e o toggle "Sensor Global".
- **Simulação:**
  - uma cena (prédio com janelas, poste vertical e grade de quadrados) se move horizontalmente sob a câmera;
  - a imagem é "capturada" linha a linha: uma linha de varredura ciano desce pela imagem ao longo de `t_readout` (desacelerado 20× para visualização), e cada linha da imagem é amostrada no instante em que a varredura passa;
  - o resultado é desenhado ao lado: o rolling mostra o poste inclinado, o prédio cisalhado e, com rotação, o efeito "gelatina" curvo; o global é idêntico à cena.
- **Leituras:**
  - `rollingShutterSkewPx(v, readout, GSD)`;
  - ângulo de cisalhamento `atan(skew·GSD / altura da imagem no solo)`;
  - penalidade de RMSE que o jogo aplicaria (`accuracyMultipliers` com φ = 0 e φ = 1), mostrando "com RTK" e "sem RTK".

## 6. Integração
- **Domínio (REQ-LAB-005):** importa exclusivamente de `@/domain/photogrammetry`, `@/domain/lidar` e `@/domain/accuracy`. É proibido reescrever as fórmulas no componente; isso é verificado por revisão e por um teste que faz *spy* nas funções do domínio.
- **Engines:** `engines/lab/opticsRenderer.ts`, `stereoRenderer.ts`, `canopyRenderer.ts` e `shutterRenderer.ts`, cada um com `render(ctx, params, t)`.

## 7. Casos de borda
- No painel 2, h → H gera uma divisão por quase zero. O slider de h é limitado a 0,8·H, ajustado automaticamente quando H muda.
- Com cobertura de 98 % e 1 retorno, a densidade de solo fica ≈ 0,02·ρ. O veredito fica vermelho, sem erro.
- Com v = 0, o skew é 0 e as duas imagens ficam iguais.

## 8. Critérios de aceite
- **Dado** H = 100 m, f = 35 mm e pixel de 4,38 µm, **quando** observar, **então** a leitura mostra GSD = 1,25 cm/px (G2).
- **Dado** B = 30, H = 100, h = 20 e f = 35 mm, **quando** observar, **então** b = 10,50 mm, Δp = 2,625 mm, h reconstruído = 20,00 m e σ_Z = 2,09 cm com 0,5 px (G14, G15).
- **Dado** cobertura de 97 % e 5 retornos, **quando** observar, **então** P_solo = 10,76 % (G16).
- **Dado** v = 8 m/s, readout de 30 ms e GSD 2,74 cm, **quando** observar, **então** o skew é 8,76 px (G11) e o poste aparece inclinado.

## 9. Testes
- **RTL:** cada painel renderiza as leituras corretas para os golden values (com o canvas mockado).
- **Unitário:** a função de amostragem por linha do simulador de shutter, `sampleRollingShutter(scene, t0, readout, v)`, que é pura.
- **E2E:** `lab.spec.ts` abre os 4 painéis e move um slider em cada.

# Feature — `PROCESSING_RESULTS`: Esteira SfM, Quality Report e Visualizador de Produtos

## 1. Objetivo
Transformar os dados da missão (fotos e pulsos) em produtos cartográficos com rigor técnico:
- animar a esteira de processamento, com velocidade definida pelo hardware;
- gerar o **Relatório de Qualidade** (resíduos, RMSE, PEC-PCD/ASPRS, mapa de calor, requisitos);
- pagar o contrato;
- exibir os produtos (Orto, MDS, MDT, Nuvem/TIN e NDVI);
- enviar o resultado ao Museu.

## 2. Requisitos cobertos
REQ-PRC-001 a REQ-PRC-014, REQ-PRG-001, REQ-PRG-006, REQ-PRG-010, REQ-PRG-011 (comparativo), REQ-PRG-012, REQ-CNT-005, REQ-CNT-007, REQ-AUD-002.

## 3. Fluxo e estados internos

```
LOADING (avalia a missão: evaluateMission, < 50 ms) ──▶ PIPELINE (animação, duração T) ──▶ REPORT
REPORT ──"Ver produtos"──▶ aba Produtos (mesma tela)
REPORT ──"Enviar à Mesa do Museu" (aprovado)──▶ goTo(HOLO_TABLE_VIEW, { focusSectorId })
REPORT ──"Concluir" (escritório) / "Voltar ao mapa" (em campo)──▶ goTo(OFFICE | WORLD_MAP)
```

- O **relatório é calculado no início** (`LOADING`), de forma determinística. A esteira é só apresentação, com duração calculada.
- As recompensas (dinheiro, XP, reputação, souvenir, desbloqueios, museu) são aplicadas **uma única vez**, ao entrar em `REPORT`, por uma ação idempotente `applyMissionResult(report)`.
- A missão sai de `pending` e vira `PROCESSED`.
- Sair durante o `PIPELINE` é impossível: a pausa só oferece "Continuar".

## 4. Layout

```
┌─ Cabeçalho: <contrato> · Processamento — Workstation: <hardware> ×<fator> [+ equipe] ─────────────────────────────────────┐
│ PIPELINE (enquanto processa):                                                                                            │
│  1 ✓ Extração de Features (SIFT/ORB)      ████████████ 100 %   ┌────────────────────────────────────────────────┐       │
│  2 ✓ Correspondência de Tie Points        ████████████ 100 %   │ VISUAL DA ETAPA ATUAL (canvas 640×360)          │       │
│  3 ▶ Ajustamento em Bloco (BBA) + Calib.  ██████░░░░░░  52 %   │  ex.: curva de convergência do erro de          │       │
│  4 · Densificação da Nuvem                                     │  reprojeção + k1 k2 p1 p2 "rodando"             │       │
│  5 · Geração de MDS/MDT                                        └────────────────────────────────────────────────┘       │
│  6 · Ortorretificação e Mosaico          [7 · Vetorização automática (equipe)]           tempo restante 00:14          │
├──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┤
│ RELATÓRIO (após concluir):  [Resumo] [Acurácia] [Cobertura] [Produtos] [Pagamento]                                      │
└──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

## 5. Regras e algoritmos

### 5.1 Duração
- `T = processingBaseTimeS(nPhotosVálidas, nPulsos) / processingSpeed(...)`, sem limite mínimo. Com hardware rápido e poucos dados, a esteira leva cerca de 1 s.
- **Divisão:** `STAGE_WEIGHTS` ([domain-math §12.4](../design/domain-math.md)). Com equipe, a etapa 7 soma 10 % de T.
- **Missões só LiDAR:** usam a esteira LiDAR (§5.3) com os mesmos pesos. Missões com RGB e LiDAR rodam as duas em sequência, com T dividido proporcionalmente aos dados.

### 5.2 Visuais da esteira SfM (canvas 640 × 360, `engines/raster/pipelineViz.ts`)
| Etapa | Visual |
| :--- | :--- |
| 1. Features | Grade de miniaturas (até 24 "fotos", recortes do raster de orto) com pontos amarelos surgindo. O contador "features/imagem" sobe até `≈ 8000·texturaFactor` |
| 2. Tie points | Pares de miniaturas lado a lado com linhas verdes ligando pontos homólogos. O contador de tie points cresce. Com `HOMOGENEOUS_TEXTURE`, 40 % menos linhas e aviso âmbar |
| 3. BBA + calibração | Gráfico do erro de reprojeção (px) por iteração, decaindo exponencialmente de 4 px até `lens.reprojErrorPx`. Tabela k₁, k₂, p₁, p₂, f, cx e cy com os valores interpolando até o final |
| 4. Densificação | Nuvem de pontos (`soft3d`) girando devagar, com densidade crescente |
| 5. MDS/MDT | Raster hipsométrico preenchido por varredura |
| 6. Orto/Mosaico | Mosaico de tiles da ortofoto aparecendo em ordem de linha de voo |
| 7. Vetorização | Contornos vetoriais (prédios, estradas) desenhados sobre a orto |

- Cada etapa concluída toca `STAGE_DONE`.
- Durante a esteira, o loop `PROCESSING` toca, com o volume do ventilador proporcional ao `speedFactor`.

### 5.3 Esteira LiDAR
1. Trajetória GNSS/IMU (SBET), com o gráfico da trajetória e o σ.
2. Georreferenciamento da nuvem.
3. Ajuste entre faixas, com histograma de discrepâncias diminuindo.
4. Classificação solo/vegetação, com pontos mudando de cor.
5. MDT/MDS.
6. Exportação (LAS), com barra de tamanho.

### 5.4 Aba Resumo
- Status grande: **APROVADO** (emerald) ou **REPROVADO** (rose).
- Classe atingida e score (0–100).
- **Execução do voo** (REQ-PRC-014, só em missão com dado de execução): a letra (S a D), a execução em % e a contagem por nota ("14 perfeitas · 3 boas · 1 fraca · 0 rejeitadas"), com a frase "A nota da missão é a nota técnica × (0,4 + 0,6 × execução)".
- Requisitos com `ChecklistItem` (valor medido, severidade, ✓ ou ✗). O requisito `MIN_EXECUTION` aparece como "Execução do voo ≥ N %".
- **Ficha técnica:**
  - aeronave, sensor e lente;
  - H médio (AGL), GSD efetivo;
  - p real (mediana) e q estimado;
  - nº de fotos (válidas / rejeitadas na execução / borradas / sobre água / névoa) e pulsos;
  - surtidas, colisões e duração.
- Diálogo final do cliente (sucesso ou falha), em `DialogueBox`.

### 5.5 Aba Acurácia (REQ-PRC-003 a REQ-PRC-006)
- **Tabela de resíduos** com as colunas: Ponto, Tipo, dX (cm), dY (cm), dZ (cm), |dXY| (cm). As linhas usam `font-mono`; os CPs ficam destacados.
- **RMSE GCP e RMSE CP:** X, Y, Z e resultante. Sem CPs, o texto diz "Acurácia não verificável — estimativa conservadora (GCP × 1,8)".
- **Multiplicadores aplicados** (lista com rótulos em pt-BR e o efeito xy/z): "Poucos GCPs (×1,60)", "Rolling shutter sem RTK (×1,35)" etc.
- **Calibração de lente:** f (px), cx, cy, k₁, k₂, p₁, p₂ e o erro de reprojeção.
- **PEC-PCD:**
  - escala, classe exigida e classe atingida;
  - EP e PEC da classe;
  - % de pontos ≤ PEC;
  - planimetria e altimetria separadas.
- **ASPRS:** RMSE_H e RMSE_V contra as classes exigidas.
- **LiDAR:** densidade média e densidade de solo.
- **Volumetria:** volume de referência, volume medido e erro em %.
- **Comparativo MegaMap** (REQ-PRG-011c): um card com o "Mapa MegaMap": a mesma orto deformada por uma distorção de barril e um deslocamento de 2–6 m, com "RMSE declarado: ± 1,5 m (sem pontos de controle)" e o selo "Reprovado PEC-PCD".

### 5.6 Aba Cobertura (REQ-PRC-007)
- Canvas com a orto em tons de cinza mais a grade 64 × 64:
  - verde (`emerald-400` a 55 %) com ≥ 5 fotos;
  - amarelo (`amber-400`) com 3–4;
  - vermelho (`rose-500`) com < 3;
  - hachura azul nas células excluídas (água).
- Legenda com os percentuais. Tooltip por célula com o nº de fotos.
- Toggle "Mostrar centros das fotos": pontos, com os borrados e os rejeitados na execução em vermelho e os fracos em âmbar.
- Em missões LiDAR, uma segunda camada mostra a densidade (pts/m², escala viridis-like com os tokens) e a densidade de solo.

### 5.7 Aba Produtos (REQ-PRC-008, `engines/raster/products.ts`)
Todos os rasters são 256 × 256 sobre a AOI, gerados do `TerrainSampler` e mascarados pela cobertura e pelos dados da missão.

| Produto | Geração | Disponibilidade |
| :--- | :--- | :--- |
| **Ortofoto RGB** | Cor da cobertura do solo mais objetos vistos de cima, com o hillshade da iluminação do voo. Células vermelhas ficam com ruído e borrão (*smear*). Células sem foto ficam em xadrez cinza ("sem dados"). Com `GOLDEN_HOUR`, sombras longas sobre a orto | Fotos RGB válidas > 0 |
| **MDS** | `surface(u,v)` com a rampa hipsométrica (azul → verde → amarelo → marrom → branco) × hillshade. Ruído proporcional ao RMSE_z | Fotos ou LiDAR |
| **MDT** | `elevation(u,v)`. Onde o dossel > 0,6 sem LiDAR, a área fica hachurada como "interpolado / sem dados de solo". Com LiDAR, a qualidade vem da densidade de solo da célula. Abaixo de 1 pt/m², aplica suavização | LiDAR, ou fotos com áreas abertas |
| **Nuvem / TIN** | `soft3d`: até 30.000 pontos amostrados do MDS com cor da orto (fotogrametria) **ou** amostras LiDAR coloridas por retorno (1º ciano, intermediário violeta, solo verde). O toggle TIN mostra a malha triangulada de 64 × 64 sobre o MDS em wireframe ciano. Controle orbital: arrastar com o mouse, analógico direito, zoom | Fotos ou LiDAR |
| **NDVI** | `ndvi(u,v)` com a rampa vermelho (−0,2) → amarelo (0,3) → verde (0,9). Legenda e histograma | Só `CAM_MS5` |

- **Abas indisponíveis** ficam desabilitadas, com o motivo como tooltip, por exemplo "NDVI requer câmera multiespectral".
- **Missão com features capturadas** (templo, escotilha, tocas): marcador com rótulo no produto, como o templo revelado no MDT.

### 5.8 Aba Pagamento (REQ-PRC-009, REQ-PRC-012)
- Linhas de `PaymentBreakdown`:
  - valor-base;
  - × replay;
  - × qualidade (score), com o bônus de pilotagem indicado ao lado quando houver ("inclui +0,10 de pilotagem");
  - × rival;
  - × Gestão (GES_1);
  - × equipe;
  - − custo da equipe;
  - − reparos;
  - + bônus de anéis (R01);
  - **TOTAL**.
- **Animação:** as linhas aparecem uma a uma a cada 250 ms. O total tem "contagem" rápida e `CASH_REGISTER`.
- **Recompensas:** + XP (barra animada, com `LEVEL_UP` se subir de nível), reputação (+ ou −), souvenir (card especial na 1ª aprovação) e desbloqueios novos (toasts).
- **Falha crítica:** "O cliente fechou com a MegaMap" e status `STOLEN` (exceto em replay).

### 5.9 Enviar ao Museu (REQ-PRC-010)
- O botão só fica habilitado se `approved`.
- `museum.upsertSector(contractId, report)` substitui o setor existente só se o score for maior.
- `contracts[id].bestMissionLines` e `bestAircraftId` são atualizados.
- `goTo('HOLO_TABLE_VIEW', { focusSectorId })`.

## 6. Integração
- **Domínio:** `mission.evaluateMission`, `coverage.*`, `accuracy.*`, `standards.*`, `volumetrics.*`, `economy.computePayment`, `progression.addXp`, `museum.sectorIncomePerMin`.
- **Engines:** `raster/products.ts` (geração em *chunks* via `requestIdleCallback`, ou fatias de 32 linhas por frame, para não travar), `raster/pipelineViz.ts` e `soft3d`.
- **Store:** `applyMissionResult(report)` atualiza `player`, `contracts`, `museum`, `souvenirs`, `mission` e `stats`, e dispara `refreshUnlocks`.

## 7. Casos de borda
- Missão com 0 fotos válidas mas com LiDAR: a esteira LiDAR roda sozinha, e as abas Orto e NDVI ficam indisponíveis.
- Missão só com dados de surtidas descartadas, o que não deveria chegar aqui (a guarda T9/T4 exige dados > 0). Se chegar, o relatório mostra "Sem dados" e é crítico.
- Replay com score menor que o anterior: pagamento de 40 %, e o museu não muda. O texto diz "Seu melhor resultado permanece no Museu".
- Recarregar a página durante o `PIPELINE`: a missão continua `PENDING_PROCESSING`, porque as recompensas só são aplicadas no `REPORT`, e o jogo volta ao `OFFICE`.
- Subir vários níveis de uma vez: um `LEVEL_UP` por nível, com 300 ms de intervalo.

## 8. Critérios de aceite
- **Dado** a missão C00 de referência com 5 GCPs e 2 CPs, **quando** processar no notebook, **então** a esteira leva `6 + 0,08·96 = 13,68 s`, o relatório mostra a classe PEC-PCD atingida (≥ C) e o status APROVADO.
- **Dado** 3 GCPs colineares, **quando** processar, **então** aparece o multiplicador "Geometria dos GCPs (Z ×3,00)", e o RMSE_z do relatório reflete esse multiplicador.
- **Dado** uma missão com 20 % das células vermelhas, **quando** abrir a orto, **então** essas áreas aparecem com ruído ou xadrez, e o multiplicador "Buracos de cobertura (×1,20)" está listado.
- **Dado** uma aprovação inédita, **quando** o relatório abrir, **então** o saldo aumenta exatamente `payment.totalBRL`, o souvenir entra em `souvenirs` e o toast aparece **uma vez**, mesmo que o componente re-renderize.
- **Dado** a câmera `CAM_20MP_RS`, **quando** abrir a aba Produtos, **então** NDVI está desabilitado com o motivo.
- **Dado** uma missão com execução 0,65, **quando** o relatório abrir, **então** o Resumo mostra "Execução do voo: C · 65 %", o multiplicador "Execução do voo (×1,18)" está listado e a nota é a nota técnica × 0,79.
- **Dado** uma missão com execução 0,30, **quando** processar, **então** o requisito "Execução do voo ≥ 50 %" falha e o relatório sai REPROVADO.

## 9. Testes
- **Unitário:** `evaluateMission` (golden de um cenário fixo completo), `applyMissionResult` idempotente, divisão de tempo das etapas, geração dos rasters (dimensões, determinismo, máscara de sem-dados).
- **RTL:** cada aba do relatório com um `QualityReport` de fixture; o botão Museu desabilitado em reprovado.
- **E2E:** `processing.spec.ts` cobre o fluxo completo a partir do autopilot do C00, até o museu.

# Feature — `HOLO_TABLE_VIEW`: Mesa Topográfica Holográfica (O Museu)

## 1. Objetivo
Inspecionar em tela cheia o **Grande Museu da Terra**: uma maquete holográfica 3D renderizada por software, que cresce a cada contrato. Tem:
- névoa cartográfica nos setores não mapeados;
- relevo esculpido, ortofoto e prédios nos setores mapeados;
- miniaturas animadas;
- três modos de exibição;
- a chave dimensional Terra ↔ Multiverso;
- a gestão das alas (renda e destaques).

## 2. Requisitos cobertos
REQ-HOL-001 a REQ-HOL-008, REQ-PRG-009, REQ-NFR-001.

## 3. Fluxo e estados internos
- `dimension: 'REAL' | 'RIFT'`: começa em REAL, ou na ala do setor focado.
- `mode: 'ORTHO' | 'HYPSO' | 'NEON'`: começa em ORTHO.
- `selectedSector: string | null`.
- `wingPanelOpen: boolean`.
- **Entrada com `focusSectorId`:**
  1. a câmera faz *fly-to* do setor em 1,2 s, com *ease-in-out*;
  2. o setor recém-mapeado faz uma animação de "esculpir": a altura cresce de 0 a 1 em 1,5 s, com partículas ciano;
  3. toca `STAGE_DONE`.
- **Saída:** "Voltar" ou `UI_BACK` → `goTo('OFFICE')`.

## 4. Layout

```
┌─ TopBar ─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [🌎 Terra Real | ✦ Multiverso] [Tab]          Modo: [1 Ortofoto] [2 Hipsometria] [3 LiDAR Neon]       │
├──────────────────────────────────────────────────────────────────────────────┬───────────────────────┤
│                                                                              │ ALAS DO MUSEU         │
│                  canvas soft3d (mesa circular com borda luminosa)            │ Terra Real  R$ 312/min│
│                    setores 4×2 (Terra) | anel de 11 dioramas (Multiverso)    │  ★ C01 Metrópole  A   │
│                                                                              │    C00 Sítio      C   │
│   [cartão do setor selecionado: nome · cliente · data · classe · nota ·     │    ░ C04 (névoa)      │
│    R$/min · visitantes/h · [★ Destacar]]                                     │ Multiverso  R$ 80/min │
│                                                                              │  ★ R01 Colinas    B   │
│  arrastar: orbitar · roda: zoom · clique: selecionar · [Voltar]             │ Visitantes: 1.872/h   │
└──────────────────────────────────────────────────────────────────────────────┴───────────────────────┘
```

## 5. Regras e algoritmos

### 5.1 Motor `soft3d` (`engines/soft3d/`)
- **Matemática:** `vec3` e `mat4` (look-at, perspectiva, multiplicação), funções puras e sem alocação no *hot path*. Os buffers são pré-alocados como `Float32Array`.
- **`OrbitCamera`:**
  - `yaw` livre;
  - `pitch` ∈ [10°, 80°];
  - `distance` ∈ [0,5×, 3×] do raio da mesa;
  - alvo = centro, ou o setor focado;
  - inércia de 0,9 por frame no arrasto.
- **Primitivas:**
  - quads coloridos com sombreamento *flat* (normal · luz);
  - linhas (wireframe);
  - pontos (2 px);
  - sprites simples (círculos e polígonos 2D em posições projetadas).
- **Ordenação:** *painter's algorithm* por profundidade média do quad (sort de índices num `Uint32Array`). Faces traseiras são descartadas (*backface culling*).
- **Picking:** `pickSector(xs, ys)` testa os retângulos projetados do topo de cada setor (polígono em 2D) e retorna o mais próximo da câmera.
- **Reuso:** o mesmo motor serve o visualizador de nuvem/TIN do processamento e o preview animado no escritório.

### 5.2 Construção da cena (`engines/holo/sceneBuilder.ts`, puro)
```ts
buildHoloScene(dimension, museumState, contracts, quality): HoloScene
```
- **Terra Real:** grade de 4 × 2 setores de 1 × 1 unidade, com espaço de 0,05, sobre uma base (mesa) de vidro escuro. As posições vêm de `contract.museum.slot`: (col, lin) de [contracts-real](../content/contracts-real.md). O slot (3, 1) é um oceano decorativo animado.
- **Multiverso:** 11 ilhas-diorama num anel de raio 3,5, flutuando com `sin(t + i)·0,05` de oscilação vertical, cada uma com uma borda luminosa violeta.
- **Setor mapeado:** heightmap amostrado do `TerrainSampler` do contrato.
  - Resolução: Alta 32 × 32, Média 24 × 24, Baixa 16 × 16.
  - Exagero vertical: `0,25·unidade / relevo`, normalizado por setor.
  - Prédios: os até 40 maiores objetos `BUILDING`/`TOWER`/`PIPE`/`CLIFF_TEMPLE`, extrudados.
  - A cor depende do modo (§5.3).
- **Setor em névoa:** bloco de "gesso" cinza (`slate-400`, *flat*) na altura base, com wireframe `cyan-700` de 8 × 8 linhas e um sprite "?" flutuante.
- **Diorama em névoa:** cubo em wireframe violeta girando lentamente.

### 5.3 Modos de exibição (REQ-HOL-006)
| Modo | Terreno | Prédios | Fundo |
| :--- | :--- | :--- | :--- |
| `ORTHO` | cor da cobertura × hillshade | cinza claro com topo da paleta | `slate-950` com grade de chão ciano a 10 % |
| `HYPSO` | rampa hipsométrica × hillshade e curvas de nível a cada 1/10 do relevo | branco translúcido | igual |
| `NEON` | sem preenchimento: **pontos** ciano (amostras do heightmap com jitter) e **wireframe TIN** ciano a 40 %, com glow (traço duplo, largo e de baixo alfa, mais fino e brilhante) | arestas emerald | preto puro |

### 5.4 Miniaturas animadas (REQ-HOL-004)
- Para cada setor mapeado com `bestMissionLines`, um sprite da aeronave (`bestAircraftId`: pombo, drone ou asa) percorre as linhas em zigue-zague, em loop.
- O ciclo completo dura 12 s.
- A altura do sprite é o topo do setor + 0,1. A interpolação é `trajectoryAt(lines, t) → {u, v, heading}`, uma função pura.

### 5.5 Gestão das alas (REQ-HOL-007)
- **Painel lateral** (toggle `W`/botão), uma seção por ala:
  - renda total da ala (`museumIncomePerMin` filtrado);
  - lista de setores com classe, nota, renda e ★ de destaque;
  - setores em névoa como "░ <título> — não mapeado".
- **Destaque:** clicar em ★ (1 por ala) chama `museum.setFeatured(wing, id)`. O setor destacado ganha um pedestal e um holofote, e o painel recalcula a renda e os visitantes.
- **Rodapé:** "Visitantes: X/h" (`visitorsPerHour`) e o total acumulado (`totalVisitors`, incrementado pelo `tickIncome`).

### 5.6 Controles
| Ação | Mouse / teclado | Gamepad |
| :--- | :--- | :--- |
| Orbitar | arrastar com o botão esquerdo / setas | analógico direito (`LOOK_X/Y`) |
| Zoom | roda / `+` `−` | `RT`/`LT` (`ZOOM`) |
| Selecionar setor | clique | analógico esquerdo move o foco entre setores (navegação espacial pelos centros projetados) + `INTERACT` |
| Modo | `1` `2` `3` | `FIRE` (cíclico) |
| Dimensão | `Tab` | `Y`/`△` (`TOGGLE_DIMENSION`) |
| Painel de alas | `W` | `UI_TAB_NEXT` |
| Voltar | `Esc`/`Backspace` | `B`/`○` |

### 5.7 Performance
- **Orçamento:** ≤ 10 ms/frame em Alta.
- **Cache:** a geometria dos setores (vértices em espaço de mundo) é construída uma vez por modo e dimensão. Por frame, só se transformam e projetam os vértices e se ordenam os quads (cerca de 7 × 32² ≈ 7.200 quads + prédios).
- Se o FPS médio cair abaixo de 50 por 3 s, a qualidade da mesa (não a global) cai um nível automaticamente, com toast.
- A medição do FPS é feita no `render` (o relógio real entre desenhos), não no `update`, e o anel do Multiverso usa uma resolução abaixo da grade Real (24, 16 e 12). Ver [ADR-023](../decisions.md).

## 6. Integração
- **Store:** `museum`, `contracts` (status, `bestMissionLines`, `bestAircraftId`), `settings.quality`.
- **Domínio:** `museum.museumIncomePerMin`, `museum.visitorsPerHour`.
- **Terreno:** `createTerrain(contract)`, com amostragem reduzida e memoização por `(contractId, resolução)`.

## 7. Casos de borda
- **Nenhum setor mapeado:** a mesa mostra só gesso e névoa, com o texto central "Conclua contratos para esculpir o Museu".
- **Multiverso sem fendas descobertas:** a aba aparece desabilitada com "Nenhuma anomalia registrada".
- **Contrato com score melhor no replay:** o setor é reconstruído, e o cache daquele setor é invalidado.
- **Zoom máximo com pitch de 80°:** o clamp evita atravessar a mesa.

## 8. Critérios de aceite
- **Dado** apenas C00 mapeado, **quando** abrir a mesa, **então** o slot (2, 1) mostra relevo colorido com a miniatura do Atlas voando em zigue-zague, e os outros 6 setores aparecem em gesso com "?".
- **Dado** o modo `NEON`, **quando** alternar com `3`, **então** o fundo fica preto e o setor mapeado é desenhado como pontos e wireframe ciano.
- **Dado** 2 setores REAL mapeados, **quando** destacar um deles, **então** a renda da ala aumenta exatamente na renda daquele setor (×2).
- **Dado** `Tab`, **quando** alternar para o Multiverso com R01 concluído, **então** aparece o anel de 11 dioramas: 1 esculpido e 10 em wireframe violeta.

## 9. Testes
- **Unitário:** `mat4`/`project` do `soft3d`, clamp da `OrbitCamera`, `buildHoloScene` (contagem de setores por estado), `pickSector`, `trajectoryAt`, cálculo da renda com destaque.
- **RTL:** painel de alas.
- **E2E:** `holo.spec.ts` cobre a chegada via "Enviar ao Museu", a troca de modo e a dimensão.

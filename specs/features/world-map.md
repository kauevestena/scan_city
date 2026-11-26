# Feature — `WORLD_MAP`: Mundo Aberto Top-Down 2D

## 1. Objetivo
Mapa de navegação top-down, com estilo de RPG clássico de 16 bits (visual original e procedural). O jogador **não voa** aqui. Ele anda a pé ou de bicicleta, ou dirige os veículos desbloqueados por rodovias, estradas de terra e trilhas, até os marcadores de contratos e fendas. No caminho, encontra eventos de campo.

## 2. Requisitos cobertos
REQ-WLD-001 a REQ-WLD-008, REQ-FLT-019 (retorno ao mapa), REQ-PRG-008 (skin e veículo visíveis), REQ-PRG-011 (marcador roubado), REQ-INP-001, REQ-INP-003.

## 3. Fluxo e estados internos

```
exploring ──perto de marcador + INTERACT──▶ briefing (modal) ──Aceitar──▶ [rival?] counterOffer (modal) ──▶ goTo(FIELD_SETUP)
                                                     └──Recusar/UI_BACK──▶ exploring
exploring ──evento sorteado──▶ fieldEvent (modal/overlay) ──▶ exploring
exploring ──porta da sede + INTERACT──▶ goTo(OFFICE)
exploring ──TOGGLE_DIMENSION──▶ alterna aba (Real/Fendas)
```

Ao entrar vindo do voo (`outcome = 'QUEUED'`), mostra o toast "Dados salvos. Leve-os à Workstation no escritório" e um marcador-seta para a sede no HUD.

## 4. Layout

```
┌─ TopBar ─────────────────────────────────────────────────────────────────────────────────────────────┐
│ [Contratos do Mundo Real | Fendas Dimensionais ✦]           Veículo: 🚲 A Pé/Bicicleta [V]   (mini) │
├──────────────────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                                      │
│                          canvas do mapa (câmera segue o avatar)                                      │
│                                                                                                      │
│                                         ◆ marcador     ✦ fenda (aba Fendas)                          │
│                                                                                                      │
│  [Prompt: (A) Ver contrato "Metrópole Vertical"]                                    ┌─ minimapa ─┐  │
│                                                                                     │  160×100   │  │
└─────────────────────────────────────────────────────────────────────────────────────└────────────┘──┘
```

## 5. Regras e algoritmos

### 5.1 Mapa e layout ASCII
- `src/data/overworld/map.ts` exporta `MAP_ROWS: string[]` com 100 linhas × 160 colunas.
- **Legenda:**

| Char | Tile | Char | Tile |
| :-: | :--- | :-: | :--- |
| `=` | ROAD_PAVED | `M` | MOUNTAIN |
| `-` | ROAD_DIRT | `u` | URBAN |
| `:` | TRAIL | `#` | BUILDING |
| `.` | GRASS | `H` | BRIDGE |
| `T` | FOREST | `*` | SNOW |
| `~` | WATER | `O` | Porta da sede (tile URBAN com interação) |
| `%` | SWAMP | `@` | Spawn inicial (GRASS) |
| `s` | SAND | `0`–`6` | Marcadores C00–C06 (o tile por baixo é ROAD_DIRT) |
| `^` | HILL | `a`–`k` | Fendas R01–R11 (tile GRASS por baixo) |
| `A` | HILL_STEEP | | |

- **Layout macro obrigatório.** As coordenadas são aproximadas, em tile (x, y), e o implementador desenha o ASCII respeitando:

| Região | Centro | Conteúdo | Acesso |
| :--- | :--- | :--- | :--- |
| Cidade natal + Sede `O` | (80, 72) | URBAN, ruas `=`, spawn `@` ao lado da porta | — |
| C00 Sítio do Avô `0` | (96, 78) | Pasto, estrada de terra | `-` a partir da cidade |
| C01 Metrópole `1` | (80, 18) | Bloco URBAN/BUILDING grande | Rodovia `=` norte |
| C05 Centro Histórico `5` | (30, 56) | Cidadezinha, ladeiras `^` | Rodovia `=` oeste |
| C06 Costa `6` | (148, 48) | Praia `s`, mar `~` a leste (x > 152), ponte `H` sobre o estuário | Rodovia `=` leste |
| C02 Planalto `2` | (26, 86) | Campos `.`, estradas de terra | `-` sudoeste |
| C04 Mina `4` | (18, 14) | Montanhas `M`, cinturão de `A` (HILL_STEEP) sem estrada | **Só 4x4** |
| C03 Amazônia `3` | (132, 14) | Floresta `T` densa, cinturão de `%` (SWAMP) | **Só 4x4** |
| Fendas a–k | a (112, 60), b (60, 80), c (44, 30), d (120, 26), e (32, 10), f (140, 30), g (64, 6), h (96, 26), i (60, 62), j (8, 48), k (40, 44) | Clareiras GRASS | Acessíveis a pé, exceto `f` (no brejo → 4x4) e `e` (atrás do cinturão `A` → 4x4) |

- **Teste obrigatório (BFS, `world/overworld/pathfinding.ts`):**
  - Do spawn, cada marcador é alcançável com o `minVehicle` do contrato e com todos os superiores em capacidade de terreno.
  - Marcadores com `minVehicle = PICKUP_4X4` **não** são alcançáveis com FOOT_BIKE, COMPACT_CAR nem LAB_VAN.
  - "Alcançável" significa chegar a um tile adjacente (distância ≤ 1).

### 5.2 Render (`engines/overworld/`)
- **Tile:** 32 px lógicos. Zoom de câmera 1,5× em 1280 × 720, o que mostra cerca de 27 × 14 tiles.
- **Camada estática** pré-renderizada em chunks de 16 × 16 tiles (`OffscreenCanvas` ou canvas oculto), com variações por hash do tile:
  - grama com tufos; floresta com 2–3 copas circulares sombreadas;
  - estrada asfaltada com faixa central tracejada; terra com sulcos; trilha pontilhada;
  - montanha com triângulos sombreados; encosta íngreme com hachuras diagonais;
  - brejo com poças e juncos; prédios com janelas;
  - ponte com tábuas.
- **Camada animada** a cada frame:
  - água com ondas (seno sobre o tempo);
  - marcadores ◆ pulsantes (cor por status: ciano disponível, cinza bloqueado, emerald concluído, rosa roubado com o ícone "MM");
  - portais das fendas (anel violeta girando com 8 partículas);
  - partículas de chuva (evento `SUDDEN_RAIN`);
  - **a sede** (`landmarks.ts`): um escritório pequeno de vidro por cima do quarteirão da porta `O` (3 tiles de largura, 2 de altura: a GeoSurvey é uma empresa pequena), com a faixa "GEOSURVEY", janelas acesas, a antena GNSS no telhado, o mastro com a luz vermelha piscando e a porta âmbar com um anel que pulsa. Com "Reduzir flashes e tremores", a luz fica acesa e o anel parado;
  - a seta da navegação GNSS (§5.6).
- **Avatar** por modo de locomoção, nas cores da skin:
  - A pé: círculo + corpo;
  - Bike: corpo + duas rodas;
  - Carro: retângulo com para-brisa;
  - Picape: retângulo maior com caçamba;
  - Van: retângulo longo com antena.
  - Há 4 direções e "bob" de caminhada.
- **Câmera:** lerp de 0,15 por frame em direção ao avatar, com clamp aos limites do mapa.
- **Minimapa** 160 × 100 px, em que 1 px = 1 tile, com cor média por tipo, marcadores, a sede (quadrado âmbar de 5 px com o miolo escuro, maior que os marcadores) e a posição do avatar; com a navegação GNSS ligada, uma linha tracejada do avatar até a próxima missão.

### 5.3 Movimento e colisão
- `vel = normalize(MOVE) · speedTilesS(mode, tileAt(center)) · overworldSpeedMod`. A diagonal é normalizada.
- **Colisão por eixo:** tenta mover em X. Se a caixa do avatar (0,6 × 0,6 tile) sobrepuser um tile intransponível para o modo, cancela X. Depois faz o mesmo com Y. Isso permite deslizar em paredes.
- **Bloqueio:** mostra uma dica contextual (throttle de 3 s) com o motivo do tipo de tile, por exemplo:
  - "Encosta íngreme — requer Picape 4x4";
  - "Brejo — requer Picape 4x4";
  - "Trilha — carros não passam; troque para A Pé [V]".
- **`CYCLE_VEHICLE`:** passa para o próximo modo possuído. Se o modo novo não puder ocupar o tile atual, recusa com a dica correspondente.
- **Estatística:** `stats.distanceTiles += |Δ|`. A posição é salva em `world.avatar` a cada 1 s e na saída.

### 5.4 Marcadores e briefing
- Raio de interação de 0,8 tile. O prompt usa `<InputGlyph action="INTERACT">`.
- **Na aba Real,** só os marcadores `0–6` ficam interativos. **Na aba Fendas,** só os `a–k` **descobertos**. Fendas não descobertas não aparecem.
- **Briefing modal (`lg`), em duas colunas:**
  - **Esquerda:** `EmblemBadge` do cliente, nome e papel; `DialogueBox` com as falas de briefing; objetivo.
  - **Direita:**
    - "Requisitos técnicos": `ChecklistItem` com severidade e valor;
    - "Condições": AOI, teto, relevo, iluminação possível, vento;
    - "Equipamento recomendado", com ✓ ou ✗ para o que o jogador possui;
    - pagamento-base (com o fator de replay, se aplicável), XP e souvenir (se for a primeira vez).
  - **Contrato bloqueado:** lista `UnlockCondition` pendentes (REQ-WLD-008), e o botão Aceitar fica desabilitado.
  - **Contrato roubado:** "O cliente fechou com a MegaMap. Conclua outro contrato para reconquistá-lo." Desabilitado.
  - **Contrato concluído:** "Repetir (40 % do pagamento, melhora a nota do Museu)".
- **Aceitar:**
  1. `rival.rollCounterOffer`. Se der true, abre o modal de contraproposta ([progression §8](progression.md)).
  2. `mission.startMission(contractId, rivalAdjustment)`.
  3. `goTo('FIELD_SETUP', …)`.

### 5.5 Eventos de campo
- A cada tile inteiro percorrido, chama `rollFieldEvent(rng, tile, vehicle, now, lastEventAt)` ([domain-math §13](../design/domain-math.md)), com o RNG seedado por `(seed global, stats.distanceTiles)`.
- Os efeitos estão em [catalog §12](../content/catalog.md).
- Eventos com escolha abrem um modal pequeno. Eventos passivos usam toast mais efeito, sem pausar.

### 5.6 Navegação GNSS (`world/overworld/navigation.ts`)
- **Destino:** a próxima missão da aba, `nextMissionMarker`: o primeiro marcador `AVAILABLE` ou `STOLEN` na ordem da campanha (`CONTRACTS`). Sem nenhum, não há seta e a leitura diz "Nenhuma missão disponível nesta aba".
- **Rumo:** `bearingTo(avatar, tile)`: a distância em tiles até o centro do tile, o ângulo na tela e o ponto cardeal de 8 (N, NE, L, SE, S, SO, O, NO). A menos de 1,5 tile, chegou: a seta some e a leitura diz "você chegou".
- **Na tela:** um chevron ciano a 30 px de mundo do avatar, apontando para o destino, que respira devagar (parado com "Reduzir flashes e tremores"); a linha no minimapa; e, embaixo do botão **GNSS** no canto de cima, a leitura "<contrato> · N tiles · <ponto cardeal>", atualizada a 4 Hz.
- **Liga e desliga:** `TOGGLE_GNSS` (`G`, `RB`/`R1`), o botão GNSS e o interruptor em Configurações. É o ajuste `settings.gnssNav` (começa ligado e é salvo com as configurações); trocar pelo atalho mostra a dica "Navegação GNSS ligada/desligada".

## 6. Integração
- **Store:** `world`, `contracts`, `inventory.vehicles`, `player.reputation`, `rival`, `mission`.
- **Domínio:** `progression.evaluateUnlock`, `fieldEvents.rollFieldEvent`, `rival.rollCounterOffer`.
- **Input:** contexto `OVERWORLD`, que vira `UI` com modal aberto.

## 7. Casos de borda
- Avatar salvo em tile inválido para o modo atual (save antigo) → força `FOOT_BIKE` e o tile caminhável mais próximo (BFS).
- Duas missões do mesmo contrato: a guarda T6 impede aceitar se já houver uma pendente.
- Aba Fendas antes da primeira descoberta → não renderiza. `TOGGLE_DIMENSION` mostra a dica "Nenhuma anomalia detectada ainda".
- Evento `FLAT_TIRE` enquanto a pé → nunca ocorre (o peso é zerado).
- Pausa durante um evento → o modal do evento fica abaixo do overlay de pausa, e os timers congelam.

## 8. Critérios de aceite
- **Dado** um novo jogo, **quando** o jogador anda até o marcador `0` e aperta `INTERACT`, **então** abre o briefing do C00 com 6 requisitos e o botão Aceitar habilitado.
- **Dado** só FOOT_BIKE, **quando** tentar entrar num tile `A`, **então** o avatar não entra e aparece "Encosta íngreme — requer Picape 4x4".
- **Dado** C01 concluído, **quando** a aba Fendas for aberta, **então** aparecem os portais `a` e `b`, e `RIFT_OPEN` toca na primeira abertura.
- **Dado** a picape possuída, **quando** apertar `V` duas vezes, **então** o modo passa por Picape e volta a A Pé (só os possuídos).
- **Dado** um novo jogo na porta da sede, **quando** o mapa abre, **então** a sede aparece com a faixa "GEOSURVEY" e a seta GNSS aponta para o C00, com a leitura do nome, da distância e do ponto cardeal; **quando** o jogador aperta `G`, a seta e a leitura somem.

## 9. Testes
- **Unitário:** parser do mapa (dimensões, legenda), BFS de alcance (tabela de marcadores × veículos), `speedAt`, colisão por eixo, avaliação de status dos marcadores, `nextMissionMarker`, `bearingTo`, a sede (`hqRect`, a faixa e a luz do mastro) e a seta GNSS e a linha no minimapa.
- **RTL:** BriefingModal (disponível, bloqueado, roubado, replay).
- **E2E:** `world.spec.ts` cobre andar até C00 (debug de teleporte `?debug=1` + tecla `F9` → "Teleportar para marcador"), aceitar e chegar ao FIELD_SETUP.

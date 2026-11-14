# Feature — Progressão RPG, Economia, Museu e Rival

> Sistema transversal: não é uma tela. Ele aparece no Escritório (loja, skills, equipe, carreira), no Mapa (desbloqueios, rival), no Processamento (pagamento, XP) e na Mesa (renda).

## 1. Objetivo
Dar ao jogador uma progressão clara e mensurável: dinheiro para equipamentos melhores, XP para habilidades, reputação para contratos maiores, souvenirs e museu como coleção, e a MegaMap como antagonista.

## 2. Requisitos cobertos
REQ-PRG-001 a REQ-PRG-013, REQ-CNT-003, REQ-CNT-005, REQ-CNT-008, REQ-CORE-009, REQ-UI-004.

## 3. Estado inicial (`createNewGame()`)

| Campo | Valor |
| :--- | :--- |
| Saldo | R$ 5.000,00 |
| Nível / XP / pontos | 1 / 0 / 0 |
| Reputação | 30 |
| Aeronaves | `ATLAS` |
| Sensores | `CAM_PIGEON` |
| Veículos | `FOOT_BIKE` (modo ativo) |
| Equipamento de campo | `TOTAL_STATION` |
| Hardware | `OLD_LAPTOP` |
| Milho | estoque 20, papo 10 |
| Calibração de Atlas | 0 voos |
| Cosméticos | `CHAR_VEST`, `PAINT_GREY`, `ATLAS_NONE` (equipados) |
| Emblema | o padrão de [catalog §10](../content/catalog.md) |
| Contratos | C00 `AVAILABLE`, todos os outros `LOCKED` |
| Avatar | no spawn `@` |
| Flags | `introSeen = false`, `finaleSeen = false`, `tutorialStep = 0` |

## 4. Economia (REQ-PRG-001)
- Dinheiro em centavos (inteiros).
- **`spend(amount, reason)`:** retorna `false` sem alterar o saldo se `amount > money`. Toca `DENIED` e mostra o toast "Saldo insuficiente (faltam R$ X)".
- **Débitos obrigatórios** (custo da equipe, reparos): são aplicados no cálculo do pagamento, que nunca fica negativo (`max(0, …)`). Se o pagamento não cobrir os custos, o restante é **perdoado**. Não existe dívida.
- **Histórico:** as últimas 50 transações `{ at, amount, reason }` ficam num buffer em memória, sem persistir, e aparecem na aba Perfil.

## 5. Loja (REQ-PRG-002 a REQ-PRG-004)
- `canBuy(item, state): { ok: boolean; reason?: string }` verifica, nesta ordem:
  1. já possuído;
  2. pré-requisito de tier ou de item (`requiresTier`, "Exige possuir VTOL_T3", hardware anterior);
  3. desbloqueio por condição (cosméticos);
  4. saldo, com o preço calculado por `round(preço·shopPrice)`.
- **Itens de pacote:** o combo T2 adiciona os itens faltantes ([catalog §3](../content/catalog.md)).
- **Hardware:** substitui o anterior.
- Cada compra registra a transação, toca `CASH_REGISTER` e mostra um toast `money`.

## 6. XP, níveis e habilidades (REQ-PRG-006, REQ-PRG-007)
- `addXp(state, n)`: em loop, enquanto `xp ≥ xpToNext(level)`, subtrai, sobe o nível e soma `skillPoints += 1`. Cada nível dispara `LEVEL_UP` e o toast "Nível N! +1 ponto de habilidade".
- **Fontes de XP:** contratos ([domain-math §12.1](../design/domain-math.md)) e o evento `LOST_BENCHMARK` (+50).
- **Desbloqueio de skill:** exige `skillPoints ≥ cost` e o pré-requisito (`requires`).
- `applyModifiers(skills)` gera o `ModifierSet`. Ele é memoizado por um seletor e consumido por:

| Chave | Consumidor |
| :--- | :--- |
| `windDrift` | `stepAircraft` / `driftVelocityMs` |
| `endurance` | `drainPerSecond` |
| `overworldSpeed` | movimento no mapa |
| `thermalEffect` | `thermalLiftMs` |
| `rmseGlobal` | multiplicador `skills` da acurácia |
| `texturePenalty` | multiplicador `texture` |
| `lidarNoise` | `lidarRmseZ` |
| `rollingShutterPenalty` | multiplicador `rollingShutter` |
| `contractPayment` | `computePayment` (G) |
| `museumVisitors` | `museumIncomePerMin` |
| `shopPrice` | `canBuy` / preços exibidos |
| `reputationGain` | ganho de reputação |
| `rivalChance` | `rollCounterOffer` |

## 7. Equipe (REQ-PRG-005)
- `hire(role)`: verifica o máximo e o saldo (custo de contratação).
- `fire(role)`: remove 1 pessoa, sem custo.
- **Efeitos:** bônus de pagamento e de velocidade de processamento por pessoa. O custo por missão processada é cobrado no pagamento.
- **Visual:** mesas e bonecos adicionais desenhados no escritório.

## 8. Rival MegaMap (REQ-PRG-011)
- **Contraproposta:** ao aceitar um contrato (não replay), `rollCounterOffer(rng, rivalChance)`. Se for true, abre um modal com o emblema da MegaMap (`HEXAGON`/`Map`/#e11d48/#0f172a/"MM") e a fala: *"A MegaMap ofereceu fazer por 30 % menos. Sem GCPs, mas 'com IA'."* As opções são:
  - **Igualar preço:** `rivalAdjustment = 0,85`.
  - **Apresentar portfólio técnico:**
    - se houver algum contrato `COMPLETED` com `bestClass` A (PEC) ou ASPRS aprovado com H ≤ 5 cm, o fator é 1,0 e a fala do cliente é "Seu histórico fala por si";
    - senão, o fator é 0,85, a reputação cai 2 e a fala é "Bonito, mas o preço da concorrência é menor".
  - Em ambos os casos, `rival.history` registra o evento.
- **Roubo:** numa falha crítica que não seja replay, o contrato vira `STOLEN` com `stolenAtCompletionCount = stats.contractsCompleted`. Ele volta a `AVAILABLE` quando `stats.contractsCompleted > stolenAtCompletionCount`, ou seja, depois de concluir **outro** contrato. `rival.score += 1` a cada roubo.
- **Presença:**
  - o painel Perfil mostra "MegaMap: N contratos roubados, M contrapropostas";
  - o marcador roubado no mapa fica rosa, com o ícone MM;
  - o relatório traz o comparativo ([processing-results §5.5](processing-results.md)).

## 9. Reputação (REQ-PRG-012)
- Fica entre 0 e 100, com clamp.
- Ganhos e perdas: contrato ([domain-math §12.1](../design/domain-math.md)), eventos de campo (±1) e portfólio (−2).
- Ganhos positivos são multiplicados por `reputationGain`. As perdas, não.
- **Faixas exibidas:** 0–29 "Desconhecida", 30–49 "Promissora", 50–69 "Respeitada", 70–89 "Referência", 90–100 "Lendária".

## 10. Museu e renda passiva (REQ-PRG-009)
- **`tickIncome(nowMs)`:** chamado a cada 10 s de jogo não pausado, por um timer global no `App`.
  - `ganho = incomePerMin × (Δt_min)`, com as frações de centavos acumuladas em `museum.carryCents`, um campo só em memória.
  - Também incrementa `totalVisitors` por `visitorsPerHour × Δt_h`.
- **Ao carregar o save:** aplica `offlineIncome` (máximo de 2 h) e mostra o toast "Enquanto você esteve fora, o Museu rendeu R$ X".
- **TopBar:** exibe a renda/min atual.

## 11. Souvenirs, coleção e final (REQ-PRG-010, REQ-CNT-008)
- **Na 1ª aprovação** de um contrato, `souvenirs.push(contract.souvenirId)`, com toast especial (ícone e cor do souvenir) e uma nova silhueta preenchida na estante.
- **Desbloqueios por coleção:**
  - 6 fendas → `CHAR_MULTIVERSE`;
  - 11 fendas → `PAINT_HOLO`;
  - C03 → `PAINT_CAMO` e `ATLAS_LAUREL` (disponíveis para compra ou equipados);
  - final → `CHAR_GRANDPA_HAT`.

## 12. Desbloqueio de contratos (REQ-CNT-003)
- `evaluateUnlock(cond, state): boolean` é recursivo para `ALL`/`ANY`.
- `refreshUnlocks()` roda após `applyMissionResult`, a compra de veículo (alguns usam `OWNS`) e a mudança de reputação.
  - Contratos `LOCKED` cujo `unlock` for satisfeito viram `AVAILABLE`, com toast "Novo contrato: <título>".
  - Fendas, além disso, vão para `discoveredRifts`, com `RIFT_OPEN`.
- **Replay** (REQ-CNT-005): um contrato `COMPLETED` pode ser aceito de novo. `isReplay = true` dá `replayFactor = 0,4`, sem souvenir, sem roubo em caso de falha e sem perda de reputação além de −3.

## 13. Novo jogo (REQ-CORE-009)
- Pausa → "Novo jogo" → `ConfirmDialog` ("Todo o progresso será perdido. Um backup será guardado.").
- Ao confirmar: grava o backup, `createNewGame()`, `goTo('OFFICE')` (com reset forçado da máquina de estados) e a intro.
- As configurações persistem.

## 14. Critérios de aceite
- **Dado** saldo de R$ 1.000, **quando** tentar comprar o PC Gamer (R$ 9.000), **então** a compra é recusada e o saldo não muda.
- **Dado** `GES_3`, **quando** abrir a Garagem, **então** o Drone T1 custa R$ 5.100.
- **Dado** XP 90 no nível 1, **quando** ganhar 300 XP, **então** o nível vai a 2 (sobra 290) e depois a 3 (sobra 7), com 2 pontos ganhos.
- **Dado** uma falha crítica no C05 (não replay), **quando** o relatório aplicar o resultado, **então** C05 vira `STOLEN`. Depois de aprovar R08, C05 volta a `AVAILABLE`.
- **Dado** C00 (score 0,8) e C01 (score 1,0) no museu, sem destaque, **quando** passar 1 min de jogo, **então** a renda creditada é R$ 9,00 + R$ 40,00 = R$ 49,00.

## 15. Testes
- **Unitário:** `canBuy` (todas as razões), combo T2, `addXp` (múltiplos níveis), `applyModifiers` (cumulativo PIL_1 + PIL_4 → `windDrift` 0,6), `rollCounterOffer` (seed), portfólio, roubo e retorno, `tickIncome` (acúmulo fracionário), `offlineIncome` (limite), `evaluateUnlock`, `createNewGame`.
- **Simulação de campanha** (T071): o roteiro de [catalog §13](../content/catalog.md) verifica a viabilidade financeira e a ordem dos desbloqueios.

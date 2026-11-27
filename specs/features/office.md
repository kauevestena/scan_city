# Feature — `OFFICE`: Sede da GeoSurvey (Hub Interativo)

## 1. Objetivo
Hub central do jogo. É uma sala desenhada em Canvas com hotspots interativos que dão acesso à loja, ao processamento, ao museu, ao laboratório, à equipe, à carreira e ao mundo.

## 2. Requisitos cobertos
REQ-OFF-001 a REQ-OFF-008, REQ-UI-003, REQ-CNT-008, REQ-PRG-008 (exibição do emblema), REQ-INP-006.

## 3. Fluxo e estados internos

```
OFFICE ──(intro não vista)──▶ IntroSequence ──▶ idle
idle ──hotspot──▶ painel lateral (Workstation | Garagem | Poleiro | Estante | Equipe | Carreira)
idle ──Porta──▶ goTo(WORLD_MAP)      idle ──Mesa──▶ goTo(HOLO_TABLE_VIEW)      idle ──Lab──▶ goTo(INFOGRAPHIC_LAB)
painel ──UI_BACK──▶ idle
(7 contratos reais concluídos e !finaleSeen) ──▶ FinaleSequence ──▶ idle
```

- `activePanel: OfficePanelId | null`, local ao componente.
- **Transição de entrada:** ao entrar no `OFFICE`, o jogo verifica nesta ordem:
  1. intro;
  2. final;
  3. missões pendentes (toast "Há N missão(ões) aguardando processamento na Workstation").

## 4. Layout

```
┌──────────────────────────── TopBar (emblema · R$ · nível/XP · reputação · museu R$/min · dimensão · ⏸) ───────────────────────────┐
│                                                                                                                                   │
│   ┌─────────────┐        ┌───────────┐                                   ┌─────────┐          ┌──────────────┐                   │
│   │ ESTANTE     │        │ QUADRO DE │      ┌────────────────────┐       │ POLEIRO │          │   PORTA      │                   │
│   │ RELÍQUIAS   │        │ CARREIRA  │      │  MESA HOLOGRÁFICA  │       │ (Atlas) │          │  (Mapa)      │                   │
│   └─────────────┘        └───────────┘      │  (preview animado) │       └─────────┘          │              │                   │
│                                             └────────────────────┘                            └──────────────┘                   │
│   ┌──────────────┐  ┌───────────────┐                              ┌──────────────┐  ┌─────────────────────────┐              │
│   │ WORKSTATION  │  │ MESA DA EQUIPE│                              │ LABORATÓRIO  │  │ GARAGEM (portão)        │              │
│   └──────────────┘  └───────────────┘                              └──────────────┘  └─────────────────────────┘              │
│                                                                              [painel lateral 380 px abre à direita →]          │
└───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────┘
```

- **Canvas da sala:** é desenhado em `engines/office/OfficeRenderer.ts`, numa resolução lógica de 1280 × 672 escalada ao container.
  - Paredes de tijolos, piso de tábua e luminárias.
  - Objetos simples com aparência de pixel art: `fillRect` e gradientes.
  - Partículas de poeira na luz e a mesa holográfica com um mini-render do museu (o `soft3d` em resolução baixa, a 15 FPS).
  - Atlas, de perfil no poleiro, pisca e bica de tempos em tempos. É o mesmo pombo do voo (T097): cabeça grande com o olho laranja e a sobrancelha franzida, topete em três pontas, pescoço iridescente, as barras escuras na asa dobrada, a cauda com a ponta escura e os pés no poleiro. Cada acessório tem o seu desenho (os óculos levantados na testa, o cachecol com as pontas balançando, a mochilinha com a antena e o LED, a coroa de louros).
  - O tamanho da frota visível na garagem cresce conforme as compras: um drone, uma picape, uma van.
  - Os souvenirs aparecem na estante como miniaturas dos objetos, com o mesmo desenho do exame (§5.1), em pé nas prateleiras. A estante fica guardada num bitmap, refeito só quando muda a coleção ou a escala do canvas: nada de gradiente novo a cada quadro.
- **Hotspots:** são `<button data-focusable>` absolutos sobre o canvas, posicionados por porcentagem a partir de `OFFICE_HOTSPOTS` em `src/data`. Cada um tem ícone lucide e rótulo, que fica visível no hover ou no foco.

## 5. Regras e painéis

| Hotspot | Ícone | Ação |
| :--- | :--- | :--- |
| Porta | `DoorOpen` | `goTo('WORLD_MAP')`. O avatar aparece na porta da sede |
| Mesa Holográfica | `Box` | `goTo('HOLO_TABLE_VIEW')` |
| Laboratório | `FlaskConical` | `goTo('INFOGRAPHIC_LAB')` |
| Workstation | `Monitor` | Painel com as abas **Fila de Processamento** e **Hardware**. A fila lista `pendingMissions` (contrato, data, nº de fotos/pulsos, tempo estimado) com o botão "Processar" (T4). Hardware mostra o atual e a compra do próximo da lista |
| Garagem | `Warehouse` | Painel com as abas **Aeronaves**, **Sensores & Lentes**, **Veículos**, **Equipamento de Campo** e **Pintura**. Cada item é um card: specs técnicas (tabela compacta mono), preço com o desconto `shopPrice`, estado (Possuído / Comprar / Bloqueado: "Requer <item>"). A compra usa `ConfirmDialog` e toca `CASH_REGISTER` |
| Poleiro do Atlas | `Bird` | Painel: estoque e papo de milho (gauge), "Comprar 10 (R$ 50)", "Comprar 50 (R$ 250)", "Alimentar" (enche o papo), "Calibrar câmera" (`atlasCalibrationFlights = 3`, animação de 2 s), acessórios (equipar). Clicar no Atlas dentro do canvas toca `PIGEON_COO` |
| Estante de Relíquias | `Library` | Grade 6 × 3 com os 18 souvenirs. Os obtidos mostram a miniatura desenhada do objeto; o escolhido mostra nome, história e o botão **Examinar** (§5.1). Os não obtidos mostram `?` e "Conclua <título do contrato>" (o título só aparece se o contrato estiver desbloqueado; senão, "???") |
| Mesa da Equipe | `Users` | Contratar e demitir por função: custo, bônus, quantidade atual / máxima |
| Quadro de Carreira | `Award` | Abas **Habilidades** (árvore de 3 colunas × 4 nós; nó disponível pulsa; desbloquear com `ConfirmDialog`), **Perfil** (nível, XP, reputação, estatísticas, rival MegaMap), **Visual** (skins do personagem, editor de emblema com pré-visualização ao vivo) |

### 5.1 Examinar um souvenir (REQ-OFF-008, [ADR-036](../decisions.md))

**Examinar** (na Estante, ou no card "Novo souvenir!" do relatório) abre o `SouvenirViewer`: um diálogo de tela cheia (`role="dialog"`, `aria-modal`) com o souvenir desenhado em Canvas sobre uma mesa de madeira escura, à luz quente de um abajur, com vinheta nas bordas.

- **Formas** (`Souvenir.form`, catalog §11):
  - `BOOK` (só a Caderneta de Campo do Avô): as faces são as páginas, em ordem (capa, contracapa interna da frente, páginas, contracapa interna de trás, contracapa). As vistas são: a capa fechada, no centro; as páginas duplas (a página ímpar à esquerda, a par à direita); a contracapa fechada. Com `P` páginas há `P/2 + 1` vistas.
  - `OBJECT` (os outros 17): uma face por vista, centrada; a primeira é o objeto, e as outras são o que se lê nele.
- **Virar:** a página gira em torno da lombada (a largura segue o cosseno do ângulo, com sombra na dobra e na página de baixo) em 520 ms; o caderno desliza meia página para o centro ao abrir e ao fechar. O objeto gira em torno do próprio centro em 420 ms (a face some de lado e a próxima aparece) e, parado, flutua 3 px num ciclo de 7 s. Com `prefers-reduced-motion`: esmaecimento de 160 ms e nada flutua. Cada virada toca `PAGE_TURN`; um pedido durante a virada é guardado e sai depois dela (no máximo um).
- **Controles** (camada de input modal, contexto `UI`):

| Ação | Teclado | Mouse | Controle |
| :--- | :--- | :--- | :--- |
| Face seguinte | `→`, `E`, `Enter`/`Espaço` sem botão focado | clique na metade direita do desenho, botão **Próxima** | D-pad/analógico para a direita, `RB`/`R1`, `A`/`✕` |
| Face anterior | `←`, `Q` | clique na metade esquerda, botão **Anterior** | D-pad/analógico para a esquerda, `LB`/`L1` |
| Fechar | `Esc`, `Backspace` | botão ✕ | `B`/`○` |

  Na primeira vista, "Anterior" fica desabilitado; na última, "Próxima". O `Tab` circula pelos botões sem sair do diálogo, e fechar devolve o foco a quem abriu.
- **Na tela, em DOM:** o nome e a origem ("Presente de <cliente> · <contrato>") no alto; embaixo, a história (`story`), o rótulo da vista (o da face, ou os das duas páginas: "Poligonal do sítio · Croqui do sítio") e o contador "n / N" (para o leitor de tela, "Vista n de N"); os botões com os glyphs do dispositivo ativo. O canvas tem `role="img"` com o rótulo da face, e o texto inteiro da vista fica numa região viva escondida (`sr-only`, `aria-live="polite"`).
- **Desenho** (`engines/souvenir`): cada face é desenhada uma vez num bitmap na resolução da tela (a seed é o id do souvenir e o índice da face) e a mesa também; a cada quadro só se compõem os bitmaps. O papel é envelhecido (bordas amareladas, manchas e, na caderneta, a pauta e a margem); o texto sai na letra à mão (ADR-036 §4), na tinta de cada bloco: grafite, tinta azul-escura ou vermelha.
- **Carta do Vô:** com `flags.finaleSeen`, a contracapa interna de trás mostra a carta dobrada (`FINALE_LETTER`); sem, um bolso de papel com um aviso.

**Introdução** (REQ-OFF-007). `DialogueBox` com 4 cartões; o falante é "Carta do Avô" (emblema `Mail`):
1. "Se você está lendo isto, a oficina agora é sua. Os instrumentos estão velhos, mas medem certo."
2. "O Atlas vai te ajudar. Ele nunca se perde — e adora milho."
3. "O mundo está mudando depressa. Meça tudo antes que desapareça. Monte um museu da Terra."
4. "Comece pelo sítio. O Zé Bento te espera. — Vô"

Depois: `flags.introSeen = true` e o tooltip da Porta pulsa por 6 s.

## 6. Integração
- **Store:** `player`, `inventory`, `staff`, `skills`, `museum` (para a renda da TopBar), `mission.pending`, `flags`.
- **Domínio:** `economy.priceWithDiscount`, `progression.xpToNext`, `modifiers.applyModifiers`, `economy.canBuy`.
- **Input:** contexto `UI` com `useFocusNavigation`. O foco inicial vai na Porta, ou na Workstation se houver missão pendente.

## 7. Casos de borda
- Compra sem saldo → `DENIED` + toast "Saldo insuficiente (faltam R$ X)".
- Comprar o combo T2 já possuindo `CAM_45MP_FF` → só adiciona os itens faltantes, sem reembolso, e o card avisa isso antes da compra.
- Demitir com 0 pessoas → botão desabilitado.
- Hardware é sempre o próximo da sequência. Os anteriores aparecem como "Substituído".
- Alimentar com estoque 0 → desabilitado, com a dica "Compre milho".
- **Invariante:** existe no máximo uma missão, ativa ou pendente, por contrato (guarda T6). Por isso, uma missão pendente nunca pertence a um contrato roubado, já que o roubo só acontece ao processar uma falha crítica.

## 8. Critérios de aceite
- **Dado** um novo jogo, **quando** a tela carregar, **então** aparece a intro de 4 cartões. Depois dela, o foco vai para a Porta.
- **Dado** R$ 7.300 e o Drone T1 não possuído, **quando** comprar o T1 na Garagem, **então** o saldo vai a R$ 1.300, o card passa a "Possuído", toca `CASH_REGISTER` e a garagem desenha o drone.
- **Dado** uma missão pendente, **quando** ativar Workstation → "Processar", **então** acontece `goTo('PROCESSING_RESULTS', { missionId, inField: false })`.
- **Dado** 2 pontos de skill, **quando** desbloquear `PIL_1`, **então** os pontos caem para 1 e `applyModifiers` retorna `windDrift = 0,8`.
- **Dado** só o teclado, **quando** navegar com as setas e Enter, **então** todos os 9 hotspots são alcançáveis e ativáveis.
- **Dado** a Caderneta de Campo do Avô obtida, **quando** escolher o nicho e ativar Examinar, **então** a caderneta aparece fechada; `→` a abre nas páginas 1 e 2 e segue até a contracapa; `Esc` fecha e o foco volta ao nicho. Depois do final, a contracapa interna de trás traz a carta do Vô.

## 9. Testes
- **RTL:** os painéis Garagem (compra, bloqueio, desconto), Poleiro (alimentar, calibrar), Estante (estados, Examinar), Equipe (limites) e Carreira (skill tree, editor de emblema); o `SouvenirViewer` (vistas do caderno, teclas, botões, cliques nas metades, foco, carta depois do final).
- **Unitário:** as faces dos 18 souvenirs (formas, páginas pares, textos sem nome de franquia), a quebra de linha da letra à mão e o desenho de cada face e de cada objeto.
- **Unitário:** `canBuy` com cadeias de tier; o combo T2.
- **E2E:** `office.spec.ts` cobre intro → porta, compra, navegação por teclado e o exame da caderneta (do nicho às páginas e de volta).

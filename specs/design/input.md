# Design — Sistema de Controles Unificado

> Teclado e mouse, mais a Web Gamepad API (Xbox e PS5). As ações abstratas são desacopladas dos dispositivos. Os glyphs se atualizam em tempo real.
>
> **Requisitos cobertos:** REQ-INP-001 a REQ-INP-006, REQ-FLT-004, REQ-FLT-010, REQ-FLT-023, REQ-WLD-002, REQ-WLD-004.

---

## 1. Ações abstratas (`src/input/actions.ts`)

```ts
export type AxisAction = 'MOVE_X' | 'MOVE_Y' | 'ALT_UP' | 'ALT_DOWN' | 'TURN_LEFT' | 'TURN_RIGHT' | 'LOOK_X' | 'LOOK_Y' | 'ZOOM';
export type ButtonAction =
  | 'INTERACT' | 'FIRE' | 'TOGGLE_SENSOR' | 'RTH' | 'PAUSE'
  | 'TOGGLE_DIMENSION' | 'CYCLE_VEHICLE' | 'TIME_WARP' | 'TOGGLE_GNSS'
  | 'UI_UP' | 'UI_DOWN' | 'UI_LEFT' | 'UI_RIGHT' | 'UI_CONFIRM' | 'UI_BACK' | 'UI_TAB_PREV' | 'UI_TAB_NEXT'
  | 'DISMISS_HINT'
  | 'MODE_1' | 'MODE_2' | 'MODE_3';
```

- `MOVE_X`, `MOVE_Y`, `LOOK_X`, `LOOK_Y` e `ZOOM` variam de −1 a 1.
- `ALT_UP`, `ALT_DOWN`, `TURN_LEFT` e `TURN_RIGHT` variam de 0 a 1.
- Convenção: `MOVE_Y = +1` é **para cima/frente** (W, seta ↑, analógico para cima).

---

## 2. Tabela de bindings

As linhas marcadas **[ADIÇÃO]** não constam no spec original. Elas foram introduzidas para suportar funcionalidades especificadas aqui (ver [decisions.md](../decisions.md), ADR-010).

| Ação | Contexto | Teclado & Mouse | Xbox (`standard`) | PS5 (`standard`) |
| :--- | :--- | :--- | :--- | :--- |
| `MOVE_X/Y` | Mapa: mover avatar/veículo | `W A S D` / setas | Analógico esq. (eixos 0/1) / D-pad (12–15) | idem |
| `INTERACT` | Interagir / entrar no contrato / confirmar | `Espaço` ou `Enter` | `A` (botão 0) | `✕` Cruz (0) |
| `MOVE_Y` | Voo: velocidade | `W` / `S` | Analógico esq. vertical | idem |
| `MOVE_X` | Voo: deriva lateral | `A` / `D` | Analógico esq. horizontal | idem |
| `ALT_UP` | Voo: subir H | `Q` | `RT` (botão 7, analógico) | `R2` (7) |
| `ALT_DOWN` | Voo: descer H | `E` | `LT` (botão 6, analógico) | `L2` (6) |
| `TURN_LEFT` / `TURN_RIGHT` **[ADIÇÃO]** | Voo: a tecla da curva de cada lado na manobra de troca de faixa ([survey-flight §5.7](../features/survey-flight.md), [ADR-035](../decisions.md)). A manobra: `W`+`A`+`Q` (esquerda) ou `W`+`E`+`D` (direita) juntas, ou a sequência `A` → `Q` → `W` / `D` → `E` → `W`; no controle, o analógico para a frente e para o lado com o gatilho do lado | `Q` / `E` (as de cima de `A` e `D`) | `LT` / `RT` (6 / 7) | `L2` / `R2` |
| `FIRE` | Disparo manual / ação de mini-game / ciclo de modo da mesa | `Espaço` | `X` (botão 2) | `□` Quadrado (2) |
| `TOGGLE_SENSOR` | Voo: RGB ↔ LiDAR | `1` / `2` / `Tab` | `Y` (botão 3) | `△` Triângulo (3) |
| `RTH` | Voo: retorno à base | `R` | `B` (botão 1) | `○` Círculo (1) |
| `PAUSE` | Pausar / menu | `Esc` ou `M` | `Menu` (botão 9) | `Options` (9) |
| `TOGGLE_DIMENSION` **[ADIÇÃO]** | Mapa e mesa: Real ↔ Fendas | `Tab` | `Y` (3) | `△` (3) |
| `CYCLE_VEHICLE` **[ADIÇÃO]** | Mapa: trocar o modo de locomoção | `V` | `LB` (4) | `L1` (4) |
| `TOGGLE_GNSS` **[ADIÇÃO]** | Mapa: liga e desliga a navegação GNSS até a próxima missão ([world-map §5.6](../features/world-map.md)) | `G` | `RB` (5) | `R1` (5) |
| `TIME_WARP` **[ADIÇÃO]** | Voo: liga e desliga o cruzeiro automático ([ADR-031](../decisions.md)) | `T` | `RB` (5) | `R1` (5) |
| `LOOK_X/Y` **[ADIÇÃO]** | Mesa/nuvem 3D: orbitar | arrastar com o mouse / setas | Analógico dir. (eixos 2/3) | idem |
| `ZOOM` **[ADIÇÃO]** | Mesa/nuvem 3D: zoom | roda do mouse / `+` `−` | `RT`/`LT` | `R2`/`L2` |
| `MODE_1..3` **[ADIÇÃO]** | Mesa: modo de exibição | `1` `2` `3` | — (usar `FIRE`, cíclico) | — |
| `UI_UP/DOWN/LEFT/RIGHT` | Navegar foco; no exame de souvenir, `UI_LEFT/RIGHT` viram a face (office §5.1) | setas / `Tab`, `Shift+Tab` | D-pad / analógico esq. (com repetição) | idem |
| `UI_CONFIRM` | Confirmar | `Enter` / `Espaço` / clique | `A` (0) | `✕` (0) |
| `UI_BACK` | Voltar / fechar | `Esc` / `Backspace` | `B` (1) | `○` (1) |
| `UI_TAB_PREV/NEXT` | Trocar aba; virar a face no exame de souvenir (office §5.1) | `Q` / `E` (só em painéis com abas e no exame) | `LB`/`RB` (4/5) | `L1`/`R1` |
| `DISMISS_HINT` **[ADIÇÃO]** | Dispensar a dica do tutorial (mapa, campo, voo, relatório) | `H` | `View` (8) | `Create` (8) |

**Resolução de conflitos por contexto.** O `InputManager` recebe um `InputContext` ativo:
- `'OVERWORLD'`
- `'FLIGHT'`
- `'FIELD'`
- `'UI'` (há um modal/painel aberto)
- `'HOLO'`
- `'HOLO_PANEL'` (a mesa com o painel de alas aberto: as setas navegam pelos botões do painel em vez de orbitar, o `Tab` fica livre para o foco nativo, `W`/`RB` fecham e o analógico direito segue orbitando)
- `'MINIGAME'`

Nos contextos de jogo (`OVERWORLD`, `FLIGHT`, `HOLO`) o `Tab` e as setas têm outro uso, então os botões do DOM dessas telas (a barra superior, as abas, "Entendi" da dica) não são alcançáveis pelo foco: cada um tem uma tecla equivalente (`M`/`Esc` pausa, `Tab` troca a dimensão, `1 2 3` os modos, `W` o painel de alas, `H` a dica). Nada fica só no mouse (REQ-NFR-007).

Cada contexto lê somente as ações pertinentes. Por exemplo, no voo `Tab` é `TOGGLE_SENSOR`, e no mapa `Tab` é `TOGGLE_DIMENSION`. Quando um modal está aberto, o contexto vira `'UI'`, e o jogo por trás não recebe input.

---

## 3. `InputManager` (`src/input/InputManager.ts`)

```ts
class InputManager {
  static get(): InputManager;                    // singleton
  attach(target: Window): void;                  // keydown/keyup/blur/mouse/wheel/gamepadconnected/disconnected
  detach(): void;
  setContext(ctx: InputContext): void;
  poll(): void;                                  // 1× por frame; lê navigator.getGamepads()
  axis(a: AxisAction): number;
  down(a: ButtonAction): boolean;                // mantido
  pressed(a: ButtonAction): boolean;             // borda de subida neste frame
  released(a: ButtonAction): boolean;
  readonly mouse: { x: number; y: number; dx: number; dy: number; wheel: number; buttons: number };
  readonly activeDevice: 'KEYBOARD' | 'XBOX' | 'PLAYSTATION' | 'GENERIC';
  subscribe(fn: (dev) => void): () => void;      // para glyphs
}
```

**Regras:**
- **Deadzone radial** de 0,15 no analógico esquerdo e no direito: `mag < 0,15 → 0`; senão, reescala `(mag − 0,15)/(1 − 0,15)` mantendo a direção.
- **Gatilhos:** deadzone linear de 0,05. `ALT_UP` lê `buttons[7].value` e `ALT_DOWN` lê `buttons[6].value`.
- **Teclado + gamepad:** os eixos somam e passam por clamp (−1..1). Os botões usam OR.
- **Dispositivo ativo:** muda para o último dispositivo que gerou input significativo, ou seja, tecla, clique, movimento do mouse > 4 px, botão, ou eixo > 0,5.
- **Perda de foco** (`blur`): limpa todas as teclas pressionadas.
- **Repetição de navegação de UI:** D-pad ou analógico mantido gera `UI_*` a cada 180 ms, depois de um atraso inicial de 350 ms.
- **`preventDefault`** nas teclas do jogo (setas, espaço, Tab) quando o foco não estiver num `<input>`. Enter e Espaço sobre um botão ou link focado ficam com a ativação nativa do navegador.
- **Um `poll()` por frame:** o driver de input do `App` e os `GameLoop`s chamam `poll(timeMs)` com o tempo do rAF; a segunda chamada no mesmo frame é ignorada, para que as bordas (`pressed`/`released`) não se percam (ADR-022).

### 3.2 Camadas de UI e ações discretas (ADR-022)
- A tela define o **contexto base** (`setContext`, via `useInputContext`). Painéis e modais empilham **camadas** (`pushLayer`, via `useFocusNavigation`); o contexto efetivo é o da camada do topo. Camadas **modais** ficam sempre acima das demais.
- A UI recebe **ações discretas** (`ActionEvent`): as do teclado, na hora do `keydown`; as do gamepad, no `poll`. Só a camada do topo recebe; o que ela não tratar vai aos ouvintes globais (`onAction`). `PAUSE` vai sempre aos ouvintes globais.
- **`Esc` = voltar ou pausar:** nos contextos com `UI_BACK`, o `Esc` é `UI_BACK`; se a camada do topo não tiver para onde voltar, vira `PAUSE`. Nos contextos sem `UI_BACK` (voo, mapa), o `Esc` é `PAUSE` direto. O `B`/`○` do controle é só `UI_BACK` (ou `RTH` no voo); a pausa no controle é sempre `Menu`/`Options`.
- A pausa não abre por cima de um modal (há uma camada modal ativa); com o jogo pausado, `PAUSE` retoma.
- **`UI_CONFIRM` do teclado** não chama `click()`: Enter/Espaço já ativam o botão focado nativamente. O do gamepad clica no elemento focado.
- **Foco do gamepad:** o `InputDriver` marca `data-input-device="GAMEPAD"` na raiz, e o anel de foco aparece também no foco programático (variante `pad:` do Tailwind), que o `:focus-visible` não cobre.

### 3.1 Detecção da família do controle (`gamepad.ts`)
```ts
detectFamily(id: string): 'XBOX' | 'PLAYSTATION' | 'GENERIC'
// minúsculas; contém '045e' | 'xbox' | 'xinput' → XBOX  (testado primeiro, ver ADR-022)
// contém '054c' | 'dualsense' | 'dualshock' | 'wireless controller' | 'playstation' → PLAYSTATION
// senão GENERIC (usa glyphs Xbox)
```
- A ordem importa: o id do controle Xbox no Chrome ("Xbox **Wireless Controller** …") contém o termo que identifica o DualShock 4 ("Wireless Controller").
- Se `gamepad.mapping !== 'standard'`, o sistema exibe o toast "Controle com mapeamento não padrão — botões podem variar" e usa os mesmos índices.

---

## 4. Glyphs (`InputGlyph.tsx`)

```tsx
<InputGlyph action="INTERACT" />          // renderiza o glyph conforme activeDevice
<InputGlyph action="ALT_UP" label="Subir" />
```

| Ação | Teclado | Xbox | PlayStation |
| :--- | :--- | :--- | :--- |
| INTERACT | `Espaço` | `A` (verde) | `✕` (azul) |
| FIRE | `Espaço` | `X` (azul) | `□` (rosa) |
| TOGGLE_SENSOR | `Tab` | `Y` (amarelo) | `△` (verde) |
| RTH | `R` | `B` (vermelho) | `○` (vermelho) |
| PAUSE | `Esc` | `≡ Menu` | `Options` |
| ALT_UP / ALT_DOWN | `Q` / `E` | `RT` / `LT` | `R2` / `L2` |
| TURN_LEFT / TURN_RIGHT | `Q` / `E` | `LT` / `RT` | `L2` / `R2` |
| TIME_WARP | `T` | `RB` | `R1` |
| CYCLE_VEHICLE | `V` | `LB` | `L1` |
| TOGGLE_GNSS | `G` | `RB` | `R1` |
| TOGGLE_DIMENSION | `Tab` | `Y` | `△` |
| MOVE | `WASD` | `L` (analógico) | `L` |

Os glyphs são desenhados com Tailwind: caixa arredondada para teclas, círculo colorido para botões de face e pílula para gatilhos. Não há imagens.

---

## 5. Navegação de UI (`useFocusNavigation.ts`)

```ts
useFocusNavigation(containerRef, { initialFocus?: string; onBack?: () => void; wrap?: boolean })
```
- Os elementos focáveis levam `data-focusable` (e `data-focus-id`).
- **`UI_UP/DOWN/LEFT/RIGHT`** escolhe o vizinho mais próximo na direção pedida. A distância usa os centros dos `getBoundingClientRect()`, com peso 1 na direção primária e 2 na ortogonal, e só entram candidatos num cone de ±60°.
- **`UI_CONFIRM`** dispara `click()` no elemento focado.
- **`UI_BACK`** chama `onBack`.
- O foco visível usa a classe `ring-2 ring-cyan-400 ring-offset-2 ring-offset-slate-950`.
- **Sliders focados:** `UI_LEFT/RIGHT` ajusta o valor em 1 passo, e mantido acelera até 10 passos.
- **Modais:** o foco fica preso dentro do modal (*focus trap*). Ao fechar, volta ao elemento que abriu o modal.

---

## 6. Testes exigidos

- Mock de `navigator.getGamepads` com objetos `{ id, mapping: 'standard', buttons: [{pressed, value}], axes: [] }`.
- Casos obrigatórios:
  1. Deadzone (0,1 → 0; 0,575 → 0,5).
  2. Gatilho analógico.
  3. Borda de `pressed`.
  4. Troca de dispositivo ativo.
  5. `detectFamily` para 6 IDs reais, como `"Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)"` e `"DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)"`.
  6. Contexto `UI` bloqueando as ações de jogo.

import { clamp } from '@/lib/math';
import {
  UI_NAV_ACTIONS,
  type AxisAction,
  type ButtonAction,
  type InputContext,
  type InputDevice,
  type PadFamily,
} from './actions';
import { BINDINGS, buttonActionsForKey, isAxisKey } from './bindings';
import {
  detectFamily,
  radialDeadzone,
  STICK_DIR,
  STICK_PRESS_THRESHOLD,
  triggerDeadzone,
} from './gamepad';

/** Ação discreta entregue à UI (teclado: na hora; gamepad: no `poll`). */
export interface ActionEvent {
  action: ButtonAction;
  device: InputDevice;
  repeat: boolean;
  /** Quantas repetições seguidas já ocorreram (0 no toque inicial). */
  repeatCount: number;
}

/** Devolva `true` se a ação foi tratada. */
export type ActionHandler = (event: ActionEvent) => boolean | void;

export interface InputLayer {
  context: InputContext;
  /** Camadas modais ficam acima das demais e impedem a pausa por cima delas. */
  modal: boolean;
  handler?: ActionHandler;
}

export interface GamepadConnection {
  connected: boolean;
  index: number;
  id: string;
  family: PadFamily;
  standard: boolean;
}

export interface MouseState {
  x: number;
  y: number;
  /** Deslocamento e roda acumulados no último frame (`poll`). */
  dx: number;
  dy: number;
  /** −1 (para cima), 0 ou +1 (para baixo). */
  wheel: number;
  buttons: number;
}

/** Atraso inicial e intervalo da repetição de navegação de UI pelo gamepad (input §3). */
export const UI_REPEAT_DELAY_MS = 350;
export const UI_REPEAT_INTERVAL_MS = 180;
/** Deslocamento do mouse que torna o teclado/mouse o dispositivo ativo. */
export const MOUSE_SIGNIFICANT_PX = 4;

const KEY_TO_CODE: Record<string, string> = {
  ' ': 'Space',
  Spacebar: 'Space',
  Esc: 'Escape',
  Escape: 'Escape',
  Enter: 'Enter',
  Tab: 'Tab',
  Backspace: 'Backspace',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  '+': 'Equal',
  '=': 'Equal',
  '-': 'Minus',
};

/** `KeyboardEvent.code`, ou um equivalente derivado de `key` quando `code` vier vazio. */
export function keyCode(e: Pick<KeyboardEvent, 'code' | 'key'>): string {
  if (e.code) return e.code;
  const mapped = KEY_TO_CODE[e.key];
  if (mapped) return mapped;
  if (/^[a-z]$/i.test(e.key)) return `Key${e.key.toUpperCase()}`;
  if (/^\d$/.test(e.key)) return `Digit${e.key}`;
  return '';
}

function isTyping(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable;
}

const ACTIVATION_KEYS = new Set(['Enter', 'NumpadEnter', 'Space']);

/** Elementos que o navegador ativa sozinho com Enter/Espaço. */
function isNativelyActivated(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === 'BUTTON' ||
    target.tagName === 'SUMMARY' ||
    (target.tagName === 'A' && target.hasAttribute('href'))
  );
}

interface PadSnapshot {
  down: Set<number>;
  /** Analógicos após a deadzone radial: [lx, ly, rx, ry]. */
  sticks: [number, number, number, number];
  /** Gatilhos após a deadzone linear, por índice de botão. */
  triggers: Map<number, number>;
}

const EMPTY_PAD: PadSnapshot = { down: new Set(), sticks: [0, 0, 0, 0], triggers: new Map() };

interface NavRepeat {
  next: number;
  count: number;
}

/**
 * Entrada unificada de teclado, mouse e gamepad (input §3). Singleton.
 * Os engines leem `axis`/`down`/`pressed`/`released` uma vez por frame, depois de `poll()`;
 * a UI recebe ações discretas pela pilha de camadas (`pushLayer`).
 */
export class InputManager {
  private static instance: InputManager | null = null;

  static get(): InputManager {
    InputManager.instance ??= new InputManager();
    return InputManager.instance;
  }

  /** Só para testes: descarta o singleton (desanexando-o) e cria outro. */
  static resetForTests(): InputManager {
    InputManager.instance?.detach();
    InputManager.instance = new InputManager();
    return InputManager.instance;
  }

  private target: Window | null = null;
  private baseContext: InputContext = 'UI';
  private layers: InputLayer[] = [];
  private readonly actionListeners = new Set<(e: ActionEvent) => void>();
  private readonly deviceListeners = new Set<(device: InputDevice) => void>();
  private readonly connectionListeners = new Set<(c: GamepadConnection) => void>();
  private device: InputDevice = 'KEYBOARD';

  // Teclado: teclas mantidas e bordas acumuladas até o próximo poll.
  private readonly held = new Set<string>();
  private readonly latchedDown = new Set<string>();
  private readonly latchedUp = new Set<string>();
  private frameKeysPressed = new Set<string>();
  private frameKeysReleased = new Set<string>();
  private readonly keyRepeats = new Map<string, number>();

  // Mouse.
  private readonly mouseState: MouseState = { x: 0, y: 0, dx: 0, dy: 0, wheel: 0, buttons: 0 };
  private accDx = 0;
  private accDy = 0;
  private accWheel = 0;
  private mouseTravel = 0;
  private lastMouse: { x: number; y: number } | null = null;

  // Gamepad.
  private pad: PadSnapshot = EMPTY_PAD;
  private padPrevDown = new Set<number>();
  private framePadPressed = new Set<number>();
  private framePadReleased = new Set<number>();
  private readonly padPrevByIndex = new Map<number, Set<number>>();
  private readonly navRepeat = new Map<ButtonAction, NavRepeat>();
  private readonly connections = new Map<number, GamepadConnection>();
  private lastPollMs: number | null = null;

  // --- ciclo de vida -------------------------------------------------------

  attach(target: Window): void {
    if (this.target === target) return;
    this.detach();
    this.target = target;
    target.addEventListener('keydown', this.onKeyDown);
    target.addEventListener('keyup', this.onKeyUp);
    target.addEventListener('blur', this.onBlur);
    target.addEventListener('mousemove', this.onMouseMove);
    target.addEventListener('mousedown', this.onMouseDown);
    target.addEventListener('mouseup', this.onMouseUp);
    target.addEventListener('wheel', this.onWheel, { passive: true });
    target.addEventListener('gamepadconnected', this.onGamepadConnected);
    target.addEventListener('gamepaddisconnected', this.onGamepadDisconnected);
  }

  detach(): void {
    const t = this.target;
    if (!t) return;
    t.removeEventListener('keydown', this.onKeyDown);
    t.removeEventListener('keyup', this.onKeyUp);
    t.removeEventListener('blur', this.onBlur);
    t.removeEventListener('mousemove', this.onMouseMove);
    t.removeEventListener('mousedown', this.onMouseDown);
    t.removeEventListener('mouseup', this.onMouseUp);
    t.removeEventListener('wheel', this.onWheel);
    t.removeEventListener('gamepadconnected', this.onGamepadConnected);
    t.removeEventListener('gamepaddisconnected', this.onGamepadDisconnected);
    this.target = null;
    this.clearHeld();
  }

  // --- contexto e camadas ----------------------------------------------------

  /** Contexto da tela (base da pilha). */
  setContext(ctx: InputContext): void {
    this.baseContext = ctx;
  }

  get screenContext(): InputContext {
    return this.baseContext;
  }

  /** Contexto efetivo: o da camada do topo ou, sem camadas, o da tela. */
  get context(): InputContext {
    return this.topLayer()?.context ?? this.baseContext;
  }

  /** Empilha uma camada de UI (painel ou modal). Devolve a função que a remove. */
  pushLayer(layer: InputLayer): () => void {
    const entry = { ...layer };
    this.layers.push(entry);
    return () => {
      const i = this.layers.indexOf(entry);
      if (i >= 0) this.layers.splice(i, 1);
    };
  }

  get hasModalLayer(): boolean {
    return this.layers.some((l) => l.modal);
  }

  private topLayer(): InputLayer | undefined {
    // Modais ficam sempre acima: um modal filho monta antes do painel pai.
    for (let i = this.layers.length - 1; i >= 0; i--) {
      const layer = this.layers[i] as InputLayer;
      if (layer.modal) return layer;
    }
    return this.layers.at(-1);
  }

  /** Ouvintes globais: recebem `PAUSE` e as ações que nenhuma camada tratou. */
  onAction(listener: (e: ActionEvent) => void): () => void {
    this.actionListeners.add(listener);
    return () => this.actionListeners.delete(listener);
  }

  onConnection(listener: (c: GamepadConnection) => void): () => void {
    this.connectionListeners.add(listener);
    return () => this.connectionListeners.delete(listener);
  }

  // --- dispositivo ativo -----------------------------------------------------

  get activeDevice(): InputDevice {
    return this.device;
  }

  subscribe(fn: (device: InputDevice) => void): () => void {
    this.deviceListeners.add(fn);
    return () => this.deviceListeners.delete(fn);
  }

  get gamepads(): readonly GamepadConnection[] {
    return [...this.connections.values()].filter((c) => c.connected);
  }

  private setDevice(device: InputDevice): void {
    if (device === this.device) return;
    this.device = device;
    if (device !== 'KEYBOARD') this.mouseTravel = 0;
    this.deviceListeners.forEach((fn) => fn(device));
  }

  // --- consultas por frame ---------------------------------------------------

  get mouse(): Readonly<MouseState> {
    return this.mouseState;
  }

  axis(a: AxisAction): number {
    const b = BINDINGS[this.context].axes[a];
    if (!b) return 0;
    let v = 0;
    if (b.keysPos?.some((k) => this.held.has(k))) v += 1;
    if (b.keysNeg?.some((k) => this.held.has(k))) v -= 1;
    if (b.stick) v += this.pad.sticks[b.stick.axis] * (b.stick.invert ? -1 : 1);
    if (b.padPos?.some((i) => this.pad.down.has(i))) v += 1;
    if (b.padNeg?.some((i) => this.pad.down.has(i))) v -= 1;
    if (b.triggerPos !== undefined) v += this.pad.triggers.get(b.triggerPos) ?? 0;
    if (b.triggerNeg !== undefined) v -= this.pad.triggers.get(b.triggerNeg) ?? 0;
    return a === 'ALT_UP' || a === 'ALT_DOWN' ? clamp(v, 0, 1) : clamp(v, -1, 1);
  }

  down(a: ButtonAction): boolean {
    const b = BINDINGS[this.context].buttons[a];
    return !!b && (b.keys.some((k) => this.held.has(k)) || b.pad.some((i) => this.pad.down.has(i)));
  }

  /** Borda de subida neste frame (inclui toques mais curtos que um frame). */
  pressed(a: ButtonAction): boolean {
    const b = BINDINGS[this.context].buttons[a];
    return (
      !!b &&
      (b.keys.some((k) => this.frameKeysPressed.has(k)) ||
        b.pad.some((i) => this.framePadPressed.has(i)))
    );
  }

  released(a: ButtonAction): boolean {
    const b = BINDINGS[this.context].buttons[a];
    return (
      !!b &&
      (b.keys.some((k) => this.frameKeysReleased.has(k)) ||
        b.pad.some((i) => this.framePadReleased.has(i)))
    );
  }

  // --- poll -------------------------------------------------------------------

  /**
   * Fecha o frame de input: bordas do teclado, deltas do mouse e leitura dos gamepads.
   * Chamadas repetidas com o mesmo `timeMs` (vários loops no mesmo frame) são ignoradas.
   */
  poll(timeMs: number = performance.now()): void {
    if (timeMs === this.lastPollMs) return;
    this.lastPollMs = timeMs;

    this.frameKeysPressed = new Set(this.latchedDown);
    this.frameKeysReleased = new Set(this.latchedUp);
    this.latchedDown.clear();
    this.latchedUp.clear();

    this.mouseState.dx = this.accDx;
    this.mouseState.dy = this.accDy;
    this.mouseState.wheel = Math.sign(this.accWheel);
    this.accDx = 0;
    this.accDy = 0;
    this.accWheel = 0;

    this.readGamepads();
    this.dispatchPadActions(timeMs);
  }

  private readGamepads(): void {
    const list = typeof navigator.getGamepads === 'function' ? navigator.getGamepads() : [];
    const pads = Array.from(list ?? []).filter((p): p is Gamepad => p !== null && p.connected);

    const down = new Set<number>();
    const sticks: [number, number, number, number] = [0, 0, 0, 0];
    const triggers = new Map<number, number>();

    for (const pad of pads) {
      this.ensureConnection(pad);
      const padDown = new Set<number>();
      pad.buttons.forEach((b, i) => {
        if (b.pressed || b.value > STICK_PRESS_THRESHOLD) padDown.add(i);
        if (b.value > 0) triggers.set(i, Math.max(triggers.get(i) ?? 0, triggerDeadzone(b.value)));
      });
      const [lx, ly] = radialDeadzone(pad.axes[0] ?? 0, pad.axes[1] ?? 0);
      const [rx, ry] = radialDeadzone(pad.axes[2] ?? 0, pad.axes[3] ?? 0);
      if (ly < -STICK_PRESS_THRESHOLD) padDown.add(STICK_DIR.UP);
      if (ly > STICK_PRESS_THRESHOLD) padDown.add(STICK_DIR.DOWN);
      if (lx < -STICK_PRESS_THRESHOLD) padDown.add(STICK_DIR.LEFT);
      if (lx > STICK_PRESS_THRESHOLD) padDown.add(STICK_DIR.RIGHT);

      // Input significativo: botão novo ou eixo além de 0,5.
      const prev = this.padPrevByIndex.get(pad.index) ?? new Set<number>();
      const newPress = [...padDown].some((i) => !prev.has(i));
      const bigAxis = pad.axes.some((v) => Math.abs(v) > STICK_PRESS_THRESHOLD);
      if (newPress || bigAxis) this.setDevice(detectFamily(pad.id));
      this.padPrevByIndex.set(pad.index, padDown);

      padDown.forEach((i) => down.add(i));
      const values = [lx, ly, rx, ry];
      values.forEach((v, i) => {
        if (Math.abs(v) > Math.abs(sticks[i] as number)) sticks[i] = v;
      });
    }

    this.framePadPressed = new Set([...down].filter((i) => !this.padPrevDown.has(i)));
    this.framePadReleased = new Set([...this.padPrevDown].filter((i) => !down.has(i)));
    this.padPrevDown = down;
    this.pad = { down, sticks, triggers };
  }

  private dispatchPadActions(timeMs: number): void {
    const buttons = BINDINGS[this.context].buttons;
    const device = this.device === 'KEYBOARD' ? 'GENERIC' : this.device;
    for (const action of Object.keys(buttons) as ButtonAction[]) {
      const pad = buttons[action]?.pad ?? [];
      const isNav = UI_NAV_ACTIONS.includes(action);
      if (pad.some((i) => this.framePadPressed.has(i))) {
        this.dispatch({ action, device, repeat: false, repeatCount: 0 });
        if (isNav) this.navRepeat.set(action, { next: timeMs + UI_REPEAT_DELAY_MS, count: 0 });
        continue;
      }
      if (!isNav) continue;
      const repeat = this.navRepeat.get(action);
      if (!pad.some((i) => this.pad.down.has(i))) {
        this.navRepeat.delete(action);
      } else if (repeat && timeMs >= repeat.next) {
        repeat.count += 1;
        repeat.next = timeMs + UI_REPEAT_INTERVAL_MS;
        this.dispatch({ action, device, repeat: true, repeatCount: repeat.count });
      }
    }
  }

  private dispatch(event: ActionEvent): boolean {
    let handled = false;
    if (event.action !== 'PAUSE') handled = this.topLayer()?.handler?.(event) === true;
    if (!handled) this.actionListeners.forEach((fn) => fn(event));
    return handled;
  }

  // --- eventos do DOM ---------------------------------------------------------

  private readonly onKeyDown = (e: KeyboardEvent): void => {
    if (isTyping(e.target)) return;
    const code = keyCode(e);
    if (!code) return;
    this.setDevice('KEYBOARD');
    if (!this.held.has(code)) this.latchedDown.add(code);
    this.held.add(code);
    const repeatCount = e.repeat ? (this.keyRepeats.get(code) ?? 0) + 1 : 0;
    this.keyRepeats.set(code, repeatCount);

    const ctx = this.context;
    const actions = buttonActionsForKey(ctx, code);
    const bound = actions.length > 0 || isAxisKey(ctx, code);
    const native = ACTIVATION_KEYS.has(code) && isNativelyActivated(e.target);
    if (bound && !native) e.preventDefault();

    for (const action of actions) {
      if (e.repeat && !UI_NAV_ACTIONS.includes(action)) continue;
      const event = { action, device: 'KEYBOARD' as const, repeat: e.repeat, repeatCount };
      const handled = this.dispatch(event);
      // Esc volta; se não houver para onde voltar, pausa.
      if (!handled && action === 'UI_BACK' && code === 'Escape' && !e.repeat) {
        this.dispatch({ ...event, action: 'PAUSE' });
      }
    }
  };

  private readonly onKeyUp = (e: KeyboardEvent): void => {
    const code = keyCode(e);
    if (!code) return;
    if (this.held.delete(code)) this.latchedUp.add(code);
    this.keyRepeats.delete(code);
  };

  private readonly onBlur = (): void => {
    this.clearHeld();
  };

  private clearHeld(): void {
    this.held.forEach((code) => this.latchedUp.add(code));
    this.held.clear();
    this.keyRepeats.clear();
    this.mouseState.buttons = 0;
  }

  private readonly onMouseMove = (e: MouseEvent): void => {
    const last = this.lastMouse;
    this.lastMouse = { x: e.clientX, y: e.clientY };
    this.mouseState.x = e.clientX;
    this.mouseState.y = e.clientY;
    if (!last) return;
    const dx = e.clientX - last.x;
    const dy = e.clientY - last.y;
    this.accDx += dx;
    this.accDy += dy;
    this.mouseTravel += Math.abs(dx) + Math.abs(dy);
    if (this.mouseTravel > MOUSE_SIGNIFICANT_PX) this.setDevice('KEYBOARD');
  };

  private readonly onMouseDown = (e: MouseEvent): void => {
    this.mouseState.buttons = e.buttons;
    this.setDevice('KEYBOARD');
  };

  private readonly onMouseUp = (e: MouseEvent): void => {
    this.mouseState.buttons = e.buttons;
  };

  private readonly onWheel = (e: WheelEvent): void => {
    this.accWheel += e.deltaY;
  };

  private ensureConnection(pad: Gamepad): GamepadConnection {
    const known = this.connections.get(pad.index);
    if (known?.connected && known.id === pad.id) return known;
    const connection: GamepadConnection = {
      connected: true,
      index: pad.index,
      id: pad.id,
      family: detectFamily(pad.id),
      standard: pad.mapping === 'standard',
    };
    this.connections.set(pad.index, connection);
    this.connectionListeners.forEach((fn) => fn(connection));
    return connection;
  }

  private readonly onGamepadConnected = (e: Event): void => {
    const pad = (e as GamepadEvent).gamepad;
    if (pad) this.ensureConnection(pad);
  };

  private readonly onGamepadDisconnected = (e: Event): void => {
    const pad = (e as GamepadEvent).gamepad;
    if (!pad) return;
    const known = this.connections.get(pad.index);
    if (!known) return;
    const connection = { ...known, connected: false };
    this.connections.set(pad.index, connection);
    this.padPrevByIndex.delete(pad.index);
    this.connectionListeners.forEach((fn) => fn(connection));
  };
}

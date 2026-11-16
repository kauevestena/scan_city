import type { AxisAction, ButtonAction, InputContext } from './actions';
import { PAD, STICK_DIR } from './gamepad';

/** Teclas usam `KeyboardEvent.code` (independe do layout, como o ABNT2). */
export interface ButtonBinding {
  keys: readonly string[];
  /** Botões do gamepad, incluindo as direções virtuais `STICK_DIR`. */
  pad: readonly number[];
}

export interface AxisBinding {
  keysNeg?: readonly string[];
  keysPos?: readonly string[];
  /** Eixo do analógico (0/1 esquerdo, 2/3 direito); `invert` para "cima = +1". */
  stick?: { axis: 0 | 1 | 2 | 3; invert?: boolean };
  padNeg?: readonly number[];
  padPos?: readonly number[];
  /** Gatilhos analógicos (`buttons[i].value`). */
  triggerPos?: number;
  triggerNeg?: number;
}

export interface ContextBindings {
  buttons: Partial<Record<ButtonAction, ButtonBinding>>;
  axes: Partial<Record<AxisAction, AxisBinding>>;
}

const ENTER = ['Enter', 'NumpadEnter'];
const ZOOM_IN_KEYS = ['Equal', 'NumpadAdd'];
const ZOOM_OUT_KEYS = ['Minus', 'NumpadSubtract'];

const MOVE_WASD_ARROWS: ContextBindings['axes'] = {
  MOVE_X: {
    keysNeg: ['KeyA', 'ArrowLeft'],
    keysPos: ['KeyD', 'ArrowRight'],
    stick: { axis: 0 },
    padNeg: [PAD.DPAD_LEFT],
    padPos: [PAD.DPAD_RIGHT],
  },
  MOVE_Y: {
    keysNeg: ['KeyS', 'ArrowDown'],
    keysPos: ['KeyW', 'ArrowUp'],
    stick: { axis: 1, invert: true },
    padNeg: [PAD.DPAD_DOWN],
    padPos: [PAD.DPAD_UP],
  },
};

const ZOOM: AxisBinding = {
  keysPos: ZOOM_IN_KEYS,
  keysNeg: ZOOM_OUT_KEYS,
  triggerPos: PAD.RT,
  triggerNeg: PAD.LT,
};

/** Navegação de foco: setas, D-pad e analógico esquerdo. */
const UI_NAV: ContextBindings['buttons'] = {
  UI_UP: { keys: ['ArrowUp'], pad: [PAD.DPAD_UP, STICK_DIR.UP] },
  UI_DOWN: { keys: ['ArrowDown'], pad: [PAD.DPAD_DOWN, STICK_DIR.DOWN] },
  UI_LEFT: { keys: ['ArrowLeft'], pad: [PAD.DPAD_LEFT, STICK_DIR.LEFT] },
  UI_RIGHT: { keys: ['ArrowRight'], pad: [PAD.DPAD_RIGHT, STICK_DIR.RIGHT] },
};

const UI_COMMON: ContextBindings['buttons'] = {
  UI_CONFIRM: { keys: [...ENTER, 'Space'], pad: [PAD.A] },
  UI_BACK: { keys: ['Escape', 'Backspace'], pad: [PAD.B] },
  UI_TAB_PREV: { keys: ['KeyQ'], pad: [PAD.LB] },
  UI_TAB_NEXT: { keys: ['KeyE'], pad: [PAD.RB] },
};

/** `Esc` pausa direto nos contextos sem `UI_BACK`; nos demais, pausa se nada voltar. */
const PAUSE_DIRECT: ButtonBinding = { keys: ['Escape', 'KeyM'], pad: [PAD.MENU] };
const PAUSE_M: ButtonBinding = { keys: ['KeyM'], pad: [PAD.MENU] };

/** Tabela de bindings por contexto (input §2). */
export const BINDINGS: Record<InputContext, ContextBindings> = {
  OVERWORLD: {
    buttons: {
      INTERACT: { keys: ['Space', ...ENTER], pad: [PAD.A] },
      TOGGLE_DIMENSION: { keys: ['Tab'], pad: [PAD.Y] },
      CYCLE_VEHICLE: { keys: ['KeyV'], pad: [PAD.LB] },
      PAUSE: PAUSE_DIRECT,
    },
    axes: MOVE_WASD_ARROWS,
  },
  FLIGHT: {
    buttons: {
      FIRE: { keys: ['Space'], pad: [PAD.X] },
      TOGGLE_SENSOR: { keys: ['Digit1', 'Digit2', 'Tab'], pad: [PAD.Y] },
      RTH: { keys: ['KeyR'], pad: [PAD.B] },
      TIME_WARP: { keys: ['KeyT'], pad: [PAD.RB] },
      PAUSE: PAUSE_DIRECT,
    },
    axes: {
      MOVE_X: { keysNeg: ['KeyA'], keysPos: ['KeyD'], stick: { axis: 0 } },
      MOVE_Y: { keysNeg: ['KeyS'], keysPos: ['KeyW'], stick: { axis: 1, invert: true } },
      ALT_UP: { keysPos: ['KeyQ'], triggerPos: PAD.RT },
      ALT_DOWN: { keysPos: ['KeyE'], triggerPos: PAD.LT },
    },
  },
  FIELD: {
    // Assistente com abas e sliders; WASD e o analógico movem o mapa de satélite.
    buttons: {
      UI_UP: { keys: ['ArrowUp'], pad: [PAD.DPAD_UP] },
      UI_DOWN: { keys: ['ArrowDown'], pad: [PAD.DPAD_DOWN] },
      UI_LEFT: { keys: ['ArrowLeft'], pad: [PAD.DPAD_LEFT] },
      UI_RIGHT: { keys: ['ArrowRight'], pad: [PAD.DPAD_RIGHT] },
      ...UI_COMMON,
      PAUSE: PAUSE_M,
    },
    axes: {
      MOVE_X: { keysNeg: ['KeyA'], keysPos: ['KeyD'], stick: { axis: 0 } },
      MOVE_Y: { keysNeg: ['KeyS'], keysPos: ['KeyW'], stick: { axis: 1, invert: true } },
      ZOOM,
    },
  },
  UI: {
    buttons: { ...UI_NAV, ...UI_COMMON, PAUSE: PAUSE_M },
    // Só o analógico direito e o zoom: o visualizador de nuvem 3D do relatório orbita com eles.
    // As setas seguem na navegação de foco.
    axes: {
      LOOK_X: { stick: { axis: 2 } },
      LOOK_Y: { stick: { axis: 3, invert: true } },
      ZOOM,
    },
  },
  HOLO: {
    buttons: {
      TOGGLE_DIMENSION: { keys: ['Tab'], pad: [PAD.Y] },
      FIRE: { keys: ['Space'], pad: [PAD.X] },
      MODE_1: { keys: ['Digit1'], pad: [] },
      MODE_2: { keys: ['Digit2'], pad: [] },
      MODE_3: { keys: ['Digit3'], pad: [] },
      // Painel de alas: `W` (holo-table §5.6). As setas orbitam; a seleção de setor e a
      // navegação do painel ficam no analógico esquerdo e no D-pad.
      UI_TAB_NEXT: { keys: ['KeyW'], pad: [PAD.RB] },
      UI_UP: { keys: [], pad: [PAD.DPAD_UP, STICK_DIR.UP] },
      UI_DOWN: { keys: [], pad: [PAD.DPAD_DOWN, STICK_DIR.DOWN] },
      UI_LEFT: { keys: [], pad: [PAD.DPAD_LEFT, STICK_DIR.LEFT] },
      UI_RIGHT: { keys: [], pad: [PAD.DPAD_RIGHT, STICK_DIR.RIGHT] },
      UI_CONFIRM: { keys: ENTER, pad: [PAD.A] },
      UI_BACK: { keys: ['Escape', 'Backspace'], pad: [PAD.B] },
      PAUSE: PAUSE_M,
    },
    axes: {
      LOOK_X: { keysNeg: ['ArrowLeft'], keysPos: ['ArrowRight'], stick: { axis: 2 } },
      LOOK_Y: { keysNeg: ['ArrowDown'], keysPos: ['ArrowUp'], stick: { axis: 3, invert: true } },
      ZOOM,
    },
  },
  MINIGAME: {
    buttons: {
      FIRE: { keys: ['Space'], pad: [PAD.X, PAD.A] },
      UI_BACK: { keys: ['Escape'], pad: [PAD.B] },
      PAUSE: PAUSE_M,
    },
    axes: MOVE_WASD_ARROWS,
  },
};

/** Ações de botão ligadas à tecla `code` no contexto. */
export function buttonActionsForKey(ctx: InputContext, code: string): ButtonAction[] {
  const out: ButtonAction[] = [];
  const buttons = BINDINGS[ctx].buttons;
  for (const action of Object.keys(buttons) as ButtonAction[]) {
    if (buttons[action]?.keys.includes(code)) out.push(action);
  }
  return out;
}

/** A tecla participa de algum eixo do contexto? */
export function isAxisKey(ctx: InputContext, code: string): boolean {
  return Object.values(BINDINGS[ctx].axes).some(
    (b) => b.keysNeg?.includes(code) === true || b.keysPos?.includes(code) === true,
  );
}

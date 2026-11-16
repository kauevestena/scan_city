// input §1 — Ações abstratas, desacopladas dos dispositivos.

export type AxisAction = 'MOVE_X' | 'MOVE_Y' | 'ALT_UP' | 'ALT_DOWN' | 'LOOK_X' | 'LOOK_Y' | 'ZOOM';

export type ButtonAction =
  | 'INTERACT'
  | 'FIRE'
  | 'TOGGLE_SENSOR'
  | 'RTH'
  | 'PAUSE'
  | 'TOGGLE_DIMENSION'
  | 'CYCLE_VEHICLE'
  | 'TIME_WARP'
  | 'UI_UP'
  | 'UI_DOWN'
  | 'UI_LEFT'
  | 'UI_RIGHT'
  | 'UI_CONFIRM'
  | 'UI_BACK'
  | 'UI_TAB_PREV'
  | 'UI_TAB_NEXT'
  | 'DISMISS_HINT'
  | 'MODE_1'
  | 'MODE_2'
  | 'MODE_3';

/** Contexto ativo: cada um lê só as ações pertinentes (input §2). */
export type InputContext =
  'OVERWORLD' | 'FLIGHT' | 'FIELD' | 'UI' | 'HOLO' | 'HOLO_PANEL' | 'MINIGAME';

export type PadFamily = 'XBOX' | 'PLAYSTATION' | 'GENERIC';
export type InputDevice = 'KEYBOARD' | PadFamily;

/** Ações de navegação de UI que repetem enquanto mantidas. */
export const UI_NAV_ACTIONS: readonly ButtonAction[] = ['UI_UP', 'UI_DOWN', 'UI_LEFT', 'UI_RIGHT'];

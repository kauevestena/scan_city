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
  | 'MODE_1'
  | 'MODE_2'
  | 'MODE_3';

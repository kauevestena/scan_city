import { STRINGS } from '@/data/strings';
import type { ButtonAction, InputDevice } from './actions';

/** Ações com glyph: botões, mais os grupos de eixos exibidos ao jogador. */
export type GlyphAction =
  ButtonAction | 'MOVE' | 'LOOK' | 'ZOOM' | 'ALT_UP' | 'ALT_DOWN' | 'TURN_LEFT' | 'TURN_RIGHT';

export type GlyphShape = 'key' | 'face' | 'pill' | 'stick' | 'dpad';
export type GlyphTone = 'green' | 'red' | 'blue' | 'yellow' | 'pink';

export interface GlyphSpec {
  label: string;
  shape: GlyphShape;
  tone?: GlyphTone;
}

type GlyphFamily = 'KEYBOARD' | 'XBOX' | 'PLAYSTATION';
type GlyphTable = Record<GlyphAction, GlyphSpec>;

const K = STRINGS.input.keys;
const key = (label: string): GlyphSpec => ({ label, shape: 'key' });
const face = (label: string, tone: GlyphTone): GlyphSpec => ({ label, shape: 'face', tone });
const pill = (label: string): GlyphSpec => ({ label, shape: 'pill' });
const dpad = (label: string): GlyphSpec => ({ label, shape: 'dpad' });
const stick = (label: string): GlyphSpec => ({ label, shape: 'stick' });

/** input §4: os mesmos ícones em Xbox e PS5 mudam só de símbolo e cor. */
const KEYBOARD: GlyphTable = {
  INTERACT: key(K.space),
  FIRE: key(K.space),
  TOGGLE_SENSOR: key('Tab'),
  RTH: key('R'),
  PAUSE: key('Esc'),
  TOGGLE_DIMENSION: key('Tab'),
  CYCLE_VEHICLE: key('V'),
  TIME_WARP: key('T'),
  TOGGLE_GNSS: key('G'),
  UI_UP: key('↑'),
  UI_DOWN: key('↓'),
  UI_LEFT: key('←'),
  UI_RIGHT: key('→'),
  UI_CONFIRM: key('Enter'),
  UI_BACK: key('Esc'),
  UI_TAB_PREV: key('Q'),
  UI_TAB_NEXT: key('E'),
  DISMISS_HINT: key('H'),
  MODE_1: key('1'),
  MODE_2: key('2'),
  MODE_3: key('3'),
  MOVE: key('WASD'),
  LOOK: key(K.arrows),
  ZOOM: key(K.wheel),
  ALT_UP: key('Q'),
  ALT_DOWN: key('E'),
  TURN_LEFT: key('Q'),
  TURN_RIGHT: key('E'),
};

const XBOX: GlyphTable = {
  INTERACT: face('A', 'green'),
  FIRE: face('X', 'blue'),
  TOGGLE_SENSOR: face('Y', 'yellow'),
  RTH: face('B', 'red'),
  PAUSE: pill('≡ Menu'),
  TOGGLE_DIMENSION: face('Y', 'yellow'),
  CYCLE_VEHICLE: pill('LB'),
  TIME_WARP: pill('RB'),
  TOGGLE_GNSS: pill('RB'),
  UI_UP: dpad('↑'),
  UI_DOWN: dpad('↓'),
  UI_LEFT: dpad('←'),
  UI_RIGHT: dpad('→'),
  UI_CONFIRM: face('A', 'green'),
  UI_BACK: face('B', 'red'),
  UI_TAB_PREV: pill('LB'),
  UI_TAB_NEXT: pill('RB'),
  DISMISS_HINT: pill('⧉ View'),
  MODE_1: face('X', 'blue'),
  MODE_2: face('X', 'blue'),
  MODE_3: face('X', 'blue'),
  MOVE: stick('L'),
  LOOK: stick('R'),
  ZOOM: pill('RT/LT'),
  ALT_UP: pill('RT'),
  ALT_DOWN: pill('LT'),
  TURN_LEFT: pill('LT'),
  TURN_RIGHT: pill('RT'),
};

const PLAYSTATION: GlyphTable = {
  INTERACT: face('✕', 'blue'),
  FIRE: face('□', 'pink'),
  TOGGLE_SENSOR: face('△', 'green'),
  RTH: face('○', 'red'),
  PAUSE: pill('Options'),
  TOGGLE_DIMENSION: face('△', 'green'),
  CYCLE_VEHICLE: pill('L1'),
  TIME_WARP: pill('R1'),
  TOGGLE_GNSS: pill('R1'),
  UI_UP: dpad('↑'),
  UI_DOWN: dpad('↓'),
  UI_LEFT: dpad('←'),
  UI_RIGHT: dpad('→'),
  UI_CONFIRM: face('✕', 'blue'),
  UI_BACK: face('○', 'red'),
  UI_TAB_PREV: pill('L1'),
  UI_TAB_NEXT: pill('R1'),
  DISMISS_HINT: pill('Create'),
  MODE_1: face('□', 'pink'),
  MODE_2: face('□', 'pink'),
  MODE_3: face('□', 'pink'),
  MOVE: stick('L'),
  LOOK: stick('R'),
  ZOOM: pill('R2/L2'),
  ALT_UP: pill('R2'),
  ALT_DOWN: pill('L2'),
  TURN_LEFT: pill('L2'),
  TURN_RIGHT: pill('R2'),
};

const TABLES: Record<GlyphFamily, GlyphTable> = { KEYBOARD, XBOX, PLAYSTATION };

/** Controles genéricos usam os glyphs do Xbox (OQ-003). */
export function glyphFor(action: GlyphAction, device: InputDevice): GlyphSpec {
  const family: GlyphFamily = device === 'GENERIC' ? 'XBOX' : device;
  return TABLES[family][action];
}

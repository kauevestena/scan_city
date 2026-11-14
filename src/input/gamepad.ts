import type { PadFamily } from './actions';

/** Índices do layout `standard` da Gamepad API. */
export const PAD = {
  A: 0,
  B: 1,
  X: 2,
  Y: 3,
  LB: 4,
  RB: 5,
  LT: 6,
  RT: 7,
  VIEW: 8,
  MENU: 9,
  L3: 10,
  R3: 11,
  DPAD_UP: 12,
  DPAD_DOWN: 13,
  DPAD_LEFT: 14,
  DPAD_RIGHT: 15,
} as const;

/**
 * Direções do analógico esquerdo tratadas como botões virtuais (navegação de UI).
 * Ficam fora da faixa de índices reais.
 */
export const STICK_DIR = { UP: 100, DOWN: 101, LEFT: 102, RIGHT: 103 } as const;

export const STICK_DEADZONE = 0.15;
export const TRIGGER_DEADZONE = 0.05;
/** Inclinação do analógico que conta como "direção pressionada" e como input significativo. */
export const STICK_PRESS_THRESHOLD = 0.5;

/**
 * Família do controle pelo `Gamepad.id` (input §3.1). O Xbox é testado primeiro:
 * "Xbox Wireless Controller" contém "wireless controller", que também identifica o PS4.
 */
export function detectFamily(id: string): PadFamily {
  const s = id.toLowerCase();
  if (s.includes('045e') || s.includes('xbox') || s.includes('xinput')) return 'XBOX';
  if (
    s.includes('054c') ||
    s.includes('dualsense') ||
    s.includes('dualshock') ||
    s.includes('wireless controller') ||
    s.includes('playstation')
  ) {
    return 'PLAYSTATION';
  }
  return 'GENERIC';
}

/**
 * Deadzone radial: magnitude abaixo de `dz` vira 0; acima, é reescalada para
 * `(mag − dz)/(1 − dz)`, mantendo a direção.
 */
export function radialDeadzone(x: number, y: number, dz = STICK_DEADZONE): [number, number] {
  const mag = Math.hypot(x, y);
  if (mag < dz) return [0, 0];
  const scaled = Math.min(1, (mag - dz) / (1 - dz));
  return [(x / mag) * scaled, (y / mag) * scaled];
}

/** Deadzone linear dos gatilhos analógicos, com reescala para 0..1. */
export function triggerDeadzone(value: number, dz = TRIGGER_DEADZONE): number {
  if (value < dz) return 0;
  return Math.min(1, (value - dz) / (1 - dz));
}

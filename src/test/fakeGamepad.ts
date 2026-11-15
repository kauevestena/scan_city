/** Gamepad falso no formato da Gamepad API, com `navigator.getGamepads` mockado. */
export interface FakePad {
  id: string;
  index: number;
  connected: boolean;
  mapping: string;
  axes: number[];
  buttons: Array<{ pressed: boolean; value: number }>;
}

export function createPad(id: string, index = 0, mapping = 'standard'): FakePad {
  return {
    id,
    index,
    connected: true,
    mapping,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, value: 0 })),
  };
}

export function setButton(pad: FakePad, index: number, value: number | boolean): void {
  const v = typeof value === 'boolean' ? (value ? 1 : 0) : value;
  pad.buttons[index] = { pressed: v > 0.5, value: v };
}

export function installGamepads(pads: FakePad[]): () => void {
  Object.defineProperty(navigator, 'getGamepads', {
    value: () => pads,
    configurable: true,
  });
  return () => {
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
  };
}

export const XBOX_ID = 'Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)';
export const DUALSENSE_ID =
  'DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)';

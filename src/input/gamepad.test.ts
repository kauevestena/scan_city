import { detectFamily, radialDeadzone, triggerDeadzone } from './gamepad';

describe('detectFamily', () => {
  it.each([
    ['Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)', 'XBOX'],
    ['045e-02fd-Xbox Wireless Controller', 'XBOX'],
    ['Xbox 360 Controller (XInput STANDARD GAMEPAD)', 'XBOX'],
    ['DualSense Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 0ce6)', 'PLAYSTATION'],
    ['054c-0ce6-Wireless Controller', 'PLAYSTATION'],
    ['Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)', 'PLAYSTATION'],
    ['Sony PLAYSTATION(R)3 Controller', 'PLAYSTATION'],
    ['DUALSHOCK 4 Wireless Controller', 'PLAYSTATION'],
    ['Pro Controller (STANDARD GAMEPAD Vendor: 057e Product: 2009)', 'GENERIC'],
    ['8BitDo SN30 Pro (Vendor: 2dc8 Product: 6001)', 'GENERIC'],
  ])('%s → %s', (id, family) => {
    expect(detectFamily(id)).toBe(family);
  });
});

describe('deadzones', () => {
  it('radial de 0,15: 0,1 → 0 e 0,575 → 0,5, mantendo a direção', () => {
    expect(radialDeadzone(0.1, 0)).toEqual([0, 0]);
    expect(radialDeadzone(0.06, 0.08)).toEqual([0, 0]);
    const [x, y] = radialDeadzone(0.575, 0);
    expect(x).toBeCloseTo(0.5, 12);
    expect(y).toBe(0);
    const [dx, dy] = radialDeadzone(0.345, -0.46);
    expect(Math.hypot(dx, dy)).toBeCloseTo(0.5, 12);
    expect(dx / dy).toBeCloseTo(0.345 / -0.46, 12);
    expect(radialDeadzone(1, 1)[0]).toBeCloseTo(Math.SQRT1_2, 12);
  });

  it('linear de 0,05 nos gatilhos, reescalada para 0..1', () => {
    expect(triggerDeadzone(0.04)).toBe(0);
    expect(triggerDeadzone(0.05)).toBe(0);
    expect(triggerDeadzone(0.525)).toBeCloseTo(0.5, 12);
    expect(triggerDeadzone(1)).toBe(1);
  });
});

import { drainPerSecond, rthRequired } from './energy';

const base = {
  enduranceS: 720,
  enduranceMod: 1,
  speedMs: 8,
  vCruiseMs: 8,
  windMs: 0,
  climbing: false,
  blizzard: false,
};

describe('energia (domain-math §7)', () => {
  it('no cruzeiro, sem vento, drena 1/endurance por segundo', () => {
    expect(drainPerSecond(base)).toBeCloseTo(1 / 720, 15);
  });

  it('BLIZZARD_DRAIN dobra o dreno', () => {
    expect(drainPerSecond({ ...base, blizzard: true })).toBeCloseTo(2 / 720, 15);
  });

  it('fatores de velocidade, vento, subida e o modificador de autonomia', () => {
    const fast = drainPerSecond({ ...base, speedMs: 16 });
    expect(fast).toBeCloseTo((1 / 720) * 1.5, 15);
    expect(drainPerSecond({ ...base, windMs: -10 })).toBeCloseTo((1 / 720) * 1.3, 15);
    expect(drainPerSecond({ ...base, climbing: true })).toBeCloseTo((1 / 720) * 1.3, 15);
    expect(drainPerSecond({ ...base, enduranceMod: 1.15 })).toBeCloseTo(1 / (720 * 1.15), 15);
  });

  it('rthRequired dispara no limiar max(0,20; 1,2 · tempo de volta · dreno)', () => {
    const drain = 1 / 720;
    // Volta curta: o limiar é o piso de 20 %.
    expect(rthRequired(0.2001, 100, 8, drain)).toBe(false);
    expect(rthRequired(0.1999, 100, 8, drain)).toBe(true);
    // Volta longa: tempo = 2000/8 + 15 = 265 s → limiar 1,2 · 265/720 = 0,44167.
    const threshold = (1.2 * (2000 / 8 + 15)) / 720;
    expect(rthRequired(threshold + 1e-6, 2000, 8, drain)).toBe(false);
    expect(rthRequired(threshold - 1e-6, 2000, 8, drain)).toBe(true);
  });
});

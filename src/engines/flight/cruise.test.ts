import {
  CRUISE_ARM_S,
  cruiseEligible,
  cruiseMaxFor,
  initialCruise,
  solidAheadOf,
  stepCruise,
  type CruiseContext,
} from './cruise';

const OK: CruiseContext = {
  phase: 'RUN',
  on: true,
  steady: true,
  gust: false,
  solidAhead: false,
  criticalAlert: false,
  searchlightM: Infinity,
  atlasDistracted: false,
  spikeSoon: false,
  corridorChange: 0,
};

describe('cruzeiro automático (survey-flight §5.14)', () => {
  it('fator máximo pela duração real da linha: ×3 numa de 30 s, ×4 numa de 75 s, entre ×2 e ×4', () => {
    expect(cruiseMaxFor(30)).toBe(3);
    expect(cruiseMaxFor(75)).toBe(4);
    expect(cruiseMaxFor(5)).toBe(2);
    expect(cruiseMaxFor(600)).toBe(4);
  });

  it('cada condição, sozinha, impede o cruzeiro', () => {
    expect(cruiseEligible(OK)).toBe(true);
    const off: Array<Partial<CruiseContext>> = [
      { phase: 'TURN' },
      { on: false },
      { steady: false },
      { gust: true },
      { solidAhead: true },
      { criticalAlert: true },
      { searchlightM: 99 },
      { atlasDistracted: true },
      { spikeSoon: true },
      { corridorChange: 0.06 },
    ];
    for (const o of off) expect(cruiseEligible({ ...OK, ...o }), JSON.stringify(o)).toBe(false);
    expect(cruiseEligible({ ...OK, searchlightM: 100, corridorChange: 0.05 })).toBe(true);
  });

  it('1 s estável antes de acelerar; sobe a 4 por segundo até o máximo; cai a 1 no mesmo passo', () => {
    let s = initialCruise();
    const dt = 1 / 60;
    for (let t = 0; t < CRUISE_ARM_S - 0.05; t += dt) s = stepCruise(s, true, dt, 3);
    expect(s.factor).toBe(1);
    for (let t = 0; t < 0.3; t += dt) s = stepCruise(s, true, dt, 3);
    expect(s.factor).toBeGreaterThan(1.9);
    expect(s.factor).toBeLessThan(2.3);
    for (let t = 0; t < 3; t += dt) s = stepCruise(s, true, dt, 3);
    expect(s.factor).toBe(3);
    s = stepCruise(s, false, dt, 3);
    expect(s).toEqual({ factor: 1, steadyS: 0 });
  });

  it('objeto sólido à frente: até 150 m e a menos de 15 m de lado', () => {
    const objs = [
      { solid: true, X: 10, Z: 100 },
      { solid: true, X: 40, Z: 50 },
      { solid: false, X: 0, Z: 20 },
      { solid: true, X: 0, Z: 200 },
      { solid: true, X: 0, Z: -5 },
    ];
    expect(solidAheadOf(objs, 0)).toBe(true);
    expect(solidAheadOf(objs.slice(1), 0)).toBe(false);
  });
});

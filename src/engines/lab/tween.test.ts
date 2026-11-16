import { approach, TWEEN_S } from './tween';

describe('approach (interpolação de 150 ms)', () => {
  it('em 150 ms percorre ~95 % do caminho', () => {
    let v = 0;
    for (let k = 0; k < 10; k++) v = approach(v, 100, TWEEN_S / 10);
    expect(v).toBeGreaterThan(94.9);
    expect(v).toBeLessThan(95.2);
  });

  it('não depende de como o tempo é dividido em quadros', () => {
    const once = approach(0, 100, 0.15);
    let steps = 0;
    for (let k = 0; k < 150; k++) steps = approach(steps, 100, 0.001);
    expect(steps).toBeCloseTo(once, 6);
  });

  it('chega exatamente ao alvo e fica nele; dt nulo ou negativo não mexe', () => {
    let v = 3;
    for (let k = 0; k < 200; k++) v = approach(v, 10, 1 / 60);
    expect(v).toBe(10);
    expect(approach(5, 9, 0)).toBe(5);
    expect(approach(5, 9, -1)).toBe(5);
    expect(approach(5, 9, Number.NaN)).toBe(5);
  });

  it('desce e sobe, e respeita uma duração diferente', () => {
    expect(approach(10, 0, 0.05)).toBeLessThan(10);
    expect(approach(0, 10, 0.05)).toBeGreaterThan(0);
    expect(approach(0, 10, 0.05, 1)).toBeLessThan(approach(0, 10, 0.05, 0.15));
  });
});

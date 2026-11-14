import { mulberry32 } from '@/lib/rng';
import {
  cornLeft,
  cornUsed,
  cropEnergy,
  DISTRACTION_FORCE_MS,
  DISTRACTION_WARNING_S,
  initialDistraction,
  isDistracted,
  planDistraction,
  stepDistraction,
  type DistractionPlan,
} from './atlas';

describe('planDistraction (p = 0,15 por linha, seedado)', () => {
  it('~15 % das linhas, com instante dentro da linha, lado e força de 2–3 s', () => {
    let n = 0;
    const total = 4000;
    for (let i = 0; i < total; i++) {
      const plan = planDistraction(mulberry32(i), 60);
      if (!plan) continue;
      n++;
      expect(plan.atS).toBeGreaterThanOrEqual(0);
      expect(plan.atS).toBeLessThanOrEqual(60 - DISTRACTION_WARNING_S - 3);
      expect([-1, 1]).toContain(plan.side);
      expect(plan.forceS).toBeGreaterThanOrEqual(2);
      expect(plan.forceS).toBeLessThanOrEqual(3);
    }
    expect(n / total).toBeGreaterThan(0.12);
    expect(n / total).toBeLessThan(0.18);
    expect(planDistraction(mulberry32(5), 60)).toEqual(planDistraction(mulberry32(5), 60));
  });
});

describe('stepDistraction: aviso → força lateral → fim', () => {
  const plan: DistractionPlan = { atS: 5, side: 1, forceS: 2.5 };
  const run = (moveX: (t: number) => number, until = 12) => {
    let state = initialDistraction();
    const log: Array<{ t: number; phase: string; lateral: number }> = [];
    for (let t = 0; t < until; t += 0.05) {
      const r = stepDistraction(state, plan, t, 0.05, moveX(t));
      state = r.state;
      log.push({ t, phase: state.phase, lateral: r.lateralMs });
    }
    return log;
  };

  it('aviso de 1 s sem força; depois 4 m/s para o lado sorteado por forceS', () => {
    const log = run(() => 0);
    expect(log.find((l) => l.t < 4.9)?.phase).toBe('IDLE');
    const warn = log.filter((l) => l.phase === 'WARNING');
    expect(warn.length).toBeGreaterThan(15);
    expect(warn.every((l) => l.lateral === 0)).toBe(true);
    const push = log.filter((l) => l.lateral !== 0);
    expect(push.every((l) => l.lateral === DISTRACTION_FORCE_MS)).toBe(true);
    expect(push.length * 0.05).toBeCloseTo(2.5, 0);
    expect(log.at(-1)?.phase).toBe('DONE');
    expect(isDistracted({ phase: 'WARNING', t: 0, counterS: 0 })).toBe(true);
    expect(isDistracted({ phase: 'DONE', t: 0, counterS: 0 })).toBe(false);
  });

  it('contrabalançar (> 0,7 no lado oposto por 0,5 s) encerra antes', () => {
    const log = run((t) => (t > 6.5 ? -0.8 : 0));
    const push = log.filter((l) => l.lateral !== 0);
    // Começa a empurrar em 6 s, e o contrabalanço (a partir de 6,5 s) acaba com ele em ~7,0 s.
    expect(push.length * 0.05).toBeLessThan(1.4);
    expect(log.at(-1)?.phase).toBe('DONE');
  });

  it('intensidade fraca ou lado errado não cancela; sem plano, nada acontece', () => {
    expect(
      run((t) => (t > 6.5 ? -0.5 : 0)).filter((l) => l.lateral !== 0).length * 0.05,
    ).toBeCloseTo(2.5, 0);
    expect(
      run((t) => (t > 6.5 ? 0.9 : 0)).filter((l) => l.lateral !== 0).length * 0.05,
    ).toBeCloseTo(2.5, 0);
    expect(stepDistraction(initialDistraction(), null, 99, 1, 0).lateralMs).toBe(0);
  });
});

describe('milho (REQ-PRG-013): 10 unidades = 600 s', () => {
  it('energia inicial pelo papo, consumo arredondado para cima e HUD', () => {
    expect(cropEnergy(10)).toBe(1);
    expect(cropEnergy(4)).toBe(0.4);
    expect(cropEnergy(-1)).toBeCloseTo(0, 9);
    expect(cornUsed(1, 0.3)).toBe(7);
    expect(cornUsed(1, 0.96)).toBe(1);
    expect(cornUsed(0.5, 0.5)).toBe(0);
    expect(cornLeft(0.74)).toBe(8);
    expect(cornLeft(0)).toBeCloseTo(0, 9);
    // 1 unidade dá 60 s: 600 s de voo consomem as 10.
    expect(cornUsed(1, 1 - 60 / 600)).toBe(1);
  });
});

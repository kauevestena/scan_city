import { getAircraft } from '@/data/catalog';
import { CONTRACTS } from '@/data/contracts';
import { mulberry32 } from '@/lib/rng';
import {
  COUNTER_INPUT,
  COUNTER_LATE_LIMIT_S,
  COUNTER_PUSH_FACTOR,
  COUNTER_WINDOW_S,
  ENTRY_OFFSET_FRACTION,
  GUST_BEFORE_END_S,
  GUST_HOLD_S,
  GUST_MIN_LATERAL,
  GUST_EXTRA_MS,
  GUST_MIN_PEAK_MS,
  GUST_PEAK_FACTOR,
  GUST_RAMP_S,
  GUST_WARN_S,
  counterWeight,
  entryOffsetM,
  gustCount,
  gustSide,
  initialCounter,
  judgeCounter,
  stepCounter,
  type CounterState,
  gustDurationS,
  gustEnvelope,
  gustPushAt,
  gustWarningAt,
  maxCorrectableM,
  planGusts,
  windRelativeRad,
  type Gust,
} from './gusts';

const DEG = Math.PI / 180;
const WIND = { meanMs: 4, gustMs: 3, directionDeg: 90 };

describe('golden values', () => {
  it('G29 — rajadas por linha: 1 em 7 s, 5 em 35 s, 9 em 63 s (o máximo)', () => {
    expect(gustCount(7)).toBe(1);
    expect(gustCount(35)).toBe(5);
    expect(gustCount(63)).toBe(9);
    expect(gustCount(0)).toBe(1);
    expect(gustCount(600)).toBe(9);
  });

  it('G30 — o que a aeronave corrige no lead-in: 24 m (multirrotor) e 20,0 m (asa fixa)', () => {
    expect(maxCorrectableM({ lateralSpeedMaxMs: 8, turnRadiusM: 0 }, 10, 3)).toBe(24);
    expect(maxCorrectableM({ lateralSpeedMaxMs: 0, turnRadiusM: 80 }, 22, 80 / 22)).toBeCloseTo(
      20.0,
      1,
    );
  });
});

describe('windRelativeRad', () => {
  const east = { dir: { u: 1, v: 0 }, right: { u: 0, v: 1 } };

  it('vento de leste numa linha para leste é de proa; numa para oeste, de cauda', () => {
    // Vem do leste (90°) e sopra para oeste (−u).
    expect(Math.abs(windRelativeRad(90, east.dir, east.right))).toBeCloseTo(Math.PI, 9);
    expect(windRelativeRad(90, { u: -1, v: 0 }, { u: 0, v: -1 })).toBeCloseTo(0, 9);
  });

  it('vento de norte numa linha para leste empurra para a direita (+v, sul)', () => {
    expect(windRelativeRad(0, east.dir, east.right)).toBeCloseTo(Math.PI / 2, 9);
    expect(windRelativeRad(180, east.dir, east.right)).toBeCloseTo(-Math.PI / 2, 9);
  });
});

describe('planGusts', () => {
  it('a mesma seed dá a mesma agenda; outra seed, outra agenda', () => {
    const a = planGusts(mulberry32(7), WIND, 0.3, 42, 3);
    const b = planGusts(mulberry32(7), WIND, 0.3, 42, 3);
    const c = planGusts(mulberry32(8), WIND, 0.3, 42, 3);
    expect(a).toEqual(b);
    expect(a).not.toEqual(c);
  });

  it('quantidade pela duração, dentro da janela, em ordem e sem sobreposição', () => {
    for (let seed = 1; seed <= 200; seed++) {
      for (const [duration, leadIn] of [
        [30, 3],
        [35, 5],
        [42, 3],
        [64, 4.4],
        [75, 3.6],
        [120, 3.75],
      ] as const) {
        const gusts = planGusts(mulberry32(seed), WIND, 1, duration, leadIn);
        expect(gusts).toHaveLength(gustCount(duration));
        let previousEnd = -Infinity;
        for (const g of gusts) {
          expect(g.startS).toBeGreaterThanOrEqual(leadIn + 1);
          expect(g.startS).toBeLessThanOrEqual(duration - GUST_BEFORE_END_S);
          // O aviso da rajada seguinte só começa depois de a anterior ter acabado.
          expect(g.startS - GUST_WARN_S).toBeGreaterThanOrEqual(previousEnd);
          previousEnd = g.startS + gustDurationS(g);
          expect(g.rampS).toBe(GUST_RAMP_S);
          expect(g.holdS).toBeGreaterThanOrEqual(GUST_HOLD_S[0]);
          expect(g.holdS).toBeLessThan(GUST_HOLD_S[1]);
        }
      }
    }
  });

  it('linha curta: a quantidade cai até caber; com janela vazia, uma rajada logo após a entrada', () => {
    // 16 s de linha com 3 s de lead-in: janela de 8 s, só cabe uma (cada uma pede 5 s).
    expect(gustCount(16)).toBe(2);
    expect(planGusts(mulberry32(3), WIND, 0, 16, 3)).toHaveLength(1);
    const tight = planGusts(mulberry32(3), WIND, 0, 6, 3);
    expect(tight).toHaveLength(1);
    expect(tight[0]?.startS).toBe(4);
  });

  it('força de pico: max(5, rajada + 3) × [0,8, 1,3), também em contrato sem vento', () => {
    for (const wind of [WIND, { meanMs: 0, gustMs: 0, directionDeg: 0 }]) {
      const base = Math.max(GUST_MIN_PEAK_MS, wind.gustMs + GUST_EXTRA_MS);
      for (let seed = 1; seed <= 100; seed++) {
        for (const g of planGusts(mulberry32(seed), wind, 0, 75, 3)) {
          expect(g.peakMs).toBeGreaterThanOrEqual(base * GUST_PEAK_FACTOR[0]);
          expect(g.peakMs).toBeLessThan(base * GUST_PEAK_FACTOR[1]);
        }
      }
    }
  });

  it('toda rajada tem pelo menos 70 % da força na transversal, com vento paralelo ou não', () => {
    const laterals: number[] = [];
    for (const rel of [0, Math.PI, Math.PI / 2, 0.2, -2.9]) {
      for (let seed = 1; seed <= 150; seed++) {
        for (const g of planGusts(mulberry32(seed), WIND, rel, 75, 3)) {
          expect(Math.abs(Math.sin(g.angleRad))).toBeGreaterThanOrEqual(GUST_MIN_LATERAL - 1e-9);
          if (rel === 0) {
            // Vento de cauda: a rajada continua empurrando para a frente e cai nos dois lados.
            expect(Math.cos(g.angleRad)).toBeGreaterThan(0);
            laterals.push(Math.sign(Math.sin(g.angleRad)));
          }
          if (rel === Math.PI) expect(Math.cos(g.angleRad)).toBeLessThan(0);
        }
      }
    }
    expect(laterals).toContain(1);
    expect(laterals).toContain(-1);
  });

  it('com vento médio, a direção fica a ±50° dele (antes do mínimo lateral); sem vento, qualquer uma', () => {
    for (let seed = 1; seed <= 100; seed++) {
      for (const g of planGusts(mulberry32(seed), WIND, Math.PI / 2, 75, 3)) {
        expect(Math.abs(g.angleRad - Math.PI / 2)).toBeLessThanOrEqual(50 * DEG + 1e-9);
      }
    }
    // Sem vento, as rajadas de uma passada vêm de uma direção sorteada para ela: o comprimento
    // médio do vetor resultante das direções fica alto (com direções ao acaso seria ~0,33).
    let coherence = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const g = planGusts(mulberry32(seed), { meanMs: 0, gustMs: 0, directionDeg: 0 }, 0, 63, 3);
      const sx = g.reduce((a, x) => a + Math.cos(x.angleRad), 0);
      const sy = g.reduce((a, x) => a + Math.sin(x.angleRad), 0);
      coherence += Math.hypot(sx, sy) / g.length / 200;
    }
    expect(coherence).toBeGreaterThan(0.75);
    const calm = { meanMs: 0, gustMs: 0, directionDeg: 0 };
    const quadrants = new Set<string>();
    for (let seed = 1; seed <= 200; seed++) {
      for (const g of planGusts(mulberry32(seed), calm, 0, 75, 3)) {
        quadrants.add(`${Math.sign(Math.sin(g.angleRad))}/${Math.sign(Math.cos(g.angleRad))}`);
      }
    }
    expect(quadrants.size).toBe(4);
  });

  it('todo contrato tem rajada com pico ≥ 5 m/s × 0,8', () => {
    for (const c of CONTRACTS) {
      const gusts = planGusts(mulberry32(c.seed), c.wind, 0.5, 60, 3);
      expect(gusts.length).toBeGreaterThanOrEqual(1);
      for (const g of gusts) expect(g.peakMs).toBeGreaterThanOrEqual(GUST_MIN_PEAK_MS * 0.8);
    }
  });
});

describe('envelope, empurrão e aviso', () => {
  const gust: Gust = { startS: 10, rampS: 0.5, holdS: 2, peakMs: 4, angleRad: Math.PI / 6 };

  it('o envelope sobe em 0,5 s, fica em 1 no patamar e desce em 0,5 s', () => {
    expect(gustDurationS(gust)).toBe(3);
    expect(gustEnvelope(gust, 9.9)).toBe(0);
    expect(gustEnvelope(gust, 10)).toBe(0);
    expect(gustEnvelope(gust, 10.25)).toBeCloseTo(0.5, 9);
    expect(gustEnvelope(gust, 10.5)).toBe(1);
    expect(gustEnvelope(gust, 12.5)).toBe(1);
    expect(gustEnvelope(gust, 12.75)).toBeCloseTo(0.5, 9);
    expect(gustEnvelope(gust, 13)).toBe(0);
  });

  it('o empurrão é pico · envelope · (sen θ, cos θ) e soma as rajadas', () => {
    expect(gustPushAt([gust], 5)).toEqual({ lateralMs: 0, alongMs: 0, verticalMs: 0 });
    const push = gustPushAt([gust], 11);
    expect(push.lateralMs).toBeCloseTo(2, 9);
    expect(push.alongMs).toBeCloseTo(4 * Math.cos(Math.PI / 6), 9);
    const two = gustPushAt([gust, { ...gust, angleRad: -Math.PI / 6 }], 11);
    expect(two.lateralMs).toBeCloseTo(0, 9);
    expect(two.alongMs).toBeCloseTo(8 * Math.cos(Math.PI / 6), 9);
  });

  it('os pesos do contragolpe reduzem só a rajada cortada', () => {
    const other: Gust = { ...gust, angleRad: -Math.PI / 6 };
    const cut = gustPushAt([gust, other], 11, [COUNTER_PUSH_FACTOR, 1]);
    expect(cut.lateralMs).toBeCloseTo(2 * COUNTER_PUSH_FACTOR - 2, 9);
    expect(gustPushAt([gust], 11, [])).toEqual(gustPushAt([gust], 11));
  });

  it('o aviso vale de 1,5 s antes até o fim do sopro', () => {
    const later: Gust = { ...gust, startS: 30 };
    expect(gustWarningAt([gust, later], 8.4)).toBeNull();
    const warned = gustWarningAt([gust, later], 8.5);
    expect(warned?.gust).toBe(gust);
    expect(warned?.inS).toBeCloseTo(1.5, 9);
    expect(gustWarningAt([gust, later], 11)?.inS).toBeCloseTo(-1, 9);
    expect(gustWarningAt([gust, later], 13)).toBeNull();
    expect(gustWarningAt([gust, later], 29)?.gust).toBe(later);
    expect(gustWarningAt([], 10)).toBeNull();
  });
});

describe('contragolpe', () => {
  const gust: Gust = { startS: 10, rampS: 0.25, holdS: 1.5, peakMs: 5, angleRad: Math.PI / 2 };
  const DT = 1 / 60;

  /** Roda o julgamento do aviso ao limite com o comando `countering(t)`. */
  function run(countering: (t: number) => boolean): CounterState {
    let st = initialCounter();
    for (let t = 7; t <= gust.startS + COUNTER_LATE_LIMIT_S + 0.1 && !st.result; t += DT) {
      st = stepCounter(st, gust, t, countering(t));
    }
    return st;
  }

  it('lado da rajada pelo seno do ângulo', () => {
    expect(gustSide(gust)).toBe(1);
    expect(gustSide({ ...gust, angleRad: -2 })).toBe(-1);
  });

  it('a janela: cedo antes de −0,3 s, no tempo até +0,2 s, tarde depois', () => {
    expect(judgeCounter(COUNTER_WINDOW_S[0] - 0.01)).toBe('EARLY');
    expect(judgeCounter(COUNTER_WINDOW_S[0])).toBe('PERFECT');
    expect(judgeCounter(0)).toBe('PERFECT');
    expect(judgeCounter(COUNTER_WINDOW_S[1])).toBe('PERFECT');
    expect(judgeCounter(COUNTER_WINDOW_S[1] + 0.01)).toBe('LATE');
  });

  it('o começo do comando é o que conta: no tempo, cedo, tarde e sem reação', () => {
    expect(run((t) => t >= 9.9).result).toBe('PERFECT');
    expect(run((t) => t >= 9).result).toBe('EARLY');
    expect(run((t) => t >= 10.5).result).toBe('LATE');
    expect(run(() => false).result).toBe('MISS');
  });

  it('segurar desde antes da frente não vale; soltar e tocar de novo no tempo vale', () => {
    expect(run(() => true).result).toBe('EARLY');
    expect(run((t) => t < 9.5 || t >= 9.95).result).toBe('PERFECT');
  });

  it('julgada, não muda mais', () => {
    const done: CounterState = { ...initialCounter(), result: 'LATE' };
    expect(stepCounter(done, gust, 10, true)).toBe(done);
  });

  it('só a rajada cortada no tempo perde força', () => {
    expect(counterWeight('PERFECT')).toBe(COUNTER_PUSH_FACTOR);
    for (const r of ['EARLY', 'LATE', 'MISS', null] as const) expect(counterWeight(r)).toBe(1);
    expect(COUNTER_INPUT).toBeGreaterThan(0);
  });
});

describe('entrada de faixa', () => {
  it('maxCorrectableM: multirrotor direto; asa fixa acelera, cruza e freia', () => {
    const atlas = getAircraft('ATLAS');
    expect(maxCorrectableM(atlas, 10, 3)).toBe(atlas.lateralSpeedMaxMs * 3);
    expect(maxCorrectableM(atlas, 10, -1)).toBe(0);
    const vtol = getAircraft('VTOL_T3');
    // Tempo curto: só acelera e freia (a·t²/4). Tempo longo: chega a v·sen 30°.
    const a = (20 * 20) / vtol.turnRadiusM;
    expect(maxCorrectableM(vtol, 20, 2)).toBeCloseTo((a * 4) / 4, 9);
    expect(maxCorrectableM(vtol, 20, 10)).toBeCloseTo(10 * (10 - 10 / a), 9);
    expect(maxCorrectableM({ lateralSpeedMaxMs: 0, turnRadiusM: 80 }, 0, 5)).toBe(0);
  });

  it('entryOffsetM: de 30 % a 40 % de S, para os dois lados, determinístico', () => {
    const sides = new Set<number>();
    for (let seed = 1; seed <= 200; seed++) {
      const e = entryOffsetM(mulberry32(seed), 30, 1000);
      expect(Math.abs(e)).toBeGreaterThanOrEqual(30 * ENTRY_OFFSET_FRACTION[0]);
      expect(Math.abs(e)).toBeLessThan(30 * ENTRY_OFFSET_FRACTION[1]);
      sides.add(Math.sign(e));
      expect(entryOffsetM(mulberry32(seed), 30, 1000)).toBe(e);
    }
    expect(sides).toEqual(new Set([1, -1]));
  });

  it('entryOffsetM: limitado a 90 % do que a aeronave corrige', () => {
    for (let seed = 1; seed <= 50; seed++) {
      expect(Math.abs(entryOffsetM(mulberry32(seed), 90, 20))).toBeCloseTo(18, 9);
      expect(Math.abs(entryOffsetM(mulberry32(seed), 90, 0))).toBe(0);
    }
  });
});

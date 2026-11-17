import {
  CORRIDOR_STEP_M,
  corridorAltAt,
  corridorChangeAhead,
  corridorProfile,
  gatePositions,
  plannedSamples,
  type CorridorOptions,
} from './corridor';

const OPTS: CorridorOptions = { heightM: 60, speedMs: 10, climbRateMs: 3, ceilingAglM: 1000 };

describe('portais', () => {
  it('ficam a cada base, de aoiStart − B até aoiEnd + B', () => {
    // C00 (G23): AOI de 240 m com lead-in de 30 m e B = 18,2 m → 16 portais por linha.
    const gates = gatePositions({ aoiStartS: 30, aoiEndS: 270 }, 18.2);
    expect(gates).toHaveLength(16);
    expect(gates[0]).toBeCloseTo(11.8, 9);
    expect(gates[1]).toBeCloseTo(30, 9);
    expect(gates.at(-1)).toBeCloseTo(11.8 + 15 * 18.2, 9);
    expect(gates.at(-1) as number).toBeLessThanOrEqual(270 + 18.2);
    for (let i = 1; i < gates.length; i++) {
      expect((gates[i] as number) - (gates[i - 1] as number)).toBeCloseTo(18.2, 9);
    }
  });

  it('as amostras planejadas são os portais a partir do início da AOI', () => {
    expect(plannedSamples({ aoiStartS: 30, aoiEndS: 270 }, 18.2)).toBe(15);
    expect(plannedSamples({ aoiStartS: 80, aoiEndS: 1580 }, 38.8)).toBe(
      gatePositions({ aoiStartS: 80, aoiEndS: 1580 }, 38.8).length - 1,
    );
  });

  it('base maior que o lead-in: o portal antes do começo da linha não existe', () => {
    const gates = gatePositions({ aoiStartS: 30, aoiEndS: 130 }, 40);
    expect(gates[0]).toBe(30);
    expect(gates).toEqual([30, 70, 110, 150]);
    expect(gatePositions({ aoiStartS: 30, aoiEndS: 130 }, 0)).toEqual([]);
    expect(plannedSamples({ aoiStartS: 30, aoiEndS: 130 }, 0)).toBe(0);
  });
});

describe('altitude do corredor', () => {
  it('terreno plano: relevo + H em toda a linha', () => {
    const p = corridorProfile(() => 100, 300, OPTS);
    expect(p.stepM).toBe(CORRIDOR_STEP_M);
    expect(p.alts).toHaveLength(61);
    for (const a of p.alts) expect(a).toBe(160);
    expect(corridorAltAt(p, 123.4)).toBe(160);
    expect(corridorAltAt(p, -50)).toBe(160);
    expect(corridorAltAt(p, 9999)).toBe(160);
    expect(corridorChangeAhead(p, 50, 100)).toBe(0);
  });

  it('G32 — degrau de +30 m em s = 200: sobe antes, com a rampa de 70 % da razão de subida', () => {
    const step = (s: number) => (s >= 200 ? 130 : 100);
    const p = corridorProfile(step, 400, OPTS);
    // Rampa: 0,7 · 3 / 10 = 0,21 m por metro.
    expect(corridorAltAt(p, 35)).toBe(160);
    expect(corridorAltAt(p, 100)).toBeCloseTo(173.2, 6);
    expect(corridorAltAt(p, 180)).toBe(190);
    expect(corridorAltAt(p, 300)).toBe(190);
    expect(corridorChangeAhead(p, 100, 80)).toBeCloseTo(16.8, 6);
    expect(corridorChangeAhead(p, 300, 50)).toBe(0);
  });

  it('nunca fica abaixo de relevo + H nem sobe ou desce mais que a rampa (sem teto)', () => {
    const hills = (s: number) => 50 + 25 * Math.sin(s / 37) + 12 * Math.sin(s / 11 + 1);
    for (const opts of [OPTS, { ...OPTS, speedMs: 22, climbRateMs: 4 }, { ...OPTS, speedMs: 6 }]) {
      const p = corridorProfile(hills, 600, opts);
      const rise = ((0.7 * opts.climbRateMs) / opts.speedMs) * CORRIDOR_STEP_M;
      for (let i = 0; i < p.alts.length; i++) {
        const a = p.alts[i] as number;
        expect(a).toBeGreaterThanOrEqual(hills(i * CORRIDOR_STEP_M) + opts.heightM - 1e-9);
        if (i > 0) expect(Math.abs(a - (p.alts[i - 1] as number))).toBeLessThanOrEqual(rise + 1e-9);
      }
    }
  });

  it('descida: a antecipação de 2 s não segura a altitude; a rampa, sim', () => {
    const drop = (s: number) => (s >= 100 ? 0 : 40);
    const p = corridorProfile(drop, 300, OPTS);
    expect(corridorAltAt(p, 50)).toBe(100);
    expect(corridorAltAt(p, 95)).toBe(100);
    // Depois da borda desce 0,21 m por metro, até relevo + H.
    expect(corridorAltAt(p, 150)).toBeCloseTo(100 - 0.21 * 55, 6);
    expect(corridorAltAt(p, 295)).toBe(60);
  });

  it('o teto acima do terreno limita o corredor', () => {
    const step = (s: number) => (s >= 200 ? 130 : 100);
    const p = corridorProfile(step, 400, { ...OPTS, ceilingAglM: 65 });
    // Antes do degrau a subida antecipada bate no teto (100 + 65).
    expect(corridorAltAt(p, 150)).toBe(165);
    expect(corridorAltAt(p, 250)).toBe(190);
  });

  it('linha de comprimento zero e velocidade zero não quebram', () => {
    expect(corridorProfile(() => 10, 0, OPTS).alts).toEqual([70]);
    const p = corridorProfile(() => 10, 20, { ...OPTS, speedMs: 0 });
    expect(p.alts.every((a) => a === 70)).toBe(true);
  });
});

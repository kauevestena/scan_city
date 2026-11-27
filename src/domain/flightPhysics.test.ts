import { getAircraft } from '@/data/catalog';
import { degToRad, radToDeg } from '@/lib/math';
import { mulberry32 } from '@/lib/rng';
import type { SpecialZone } from '@/types';
import {
  MIN_GROUND_SPEED_MS,
  crabAngleRad,
  driftVelocityMs,
  groundSpeedLimits,
  initialAircraftState,
  shadowLengthM,
  stepAircraft,
  terrainFollowTargetAlt,
  thermalLiftMs,
  windAt,
  type AircraftState,
  type FlightEnv,
  type FlightInput,
} from './flightPhysics';

const close = (a: number, e: number, rel = 1e-3) =>
  expect(Math.abs(a - e) / Math.abs(e)).toBeLessThanOrEqual(rel);

const IDLE: FlightInput = { moveX: 0, moveY: 0, altUp: 0, altDown: 0 };

function env(overrides: Partial<FlightEnv> = {}): FlightEnv {
  return {
    aircraft: getAircraft('DRONE_T2'),
    planSpeedMs: 10,
    ceilingM: 120,
    elevationM: 0,
    meanAlongMs: 0,
    gustAlongMs: 0,
    gustLateralMs: 0,
    thermalLiftMs: 0,
    terrainFollowing: false,
    ...overrides,
  };
}

describe('golden values', () => {
  it('G12 — crab com vento cruzado de 4 m/s a 12 m/s = 19,4712°', () => {
    close(radToDeg(crabAngleRad(4, 12)), 19.4712);
    expect(crabAngleRad(30, 10)).toBeCloseTo(Math.PI / 2, 12);
    expect(crabAngleRad(-30, 10)).toBeCloseTo(-Math.PI / 2, 12);
  });

  it('G17 — sombra de 20 m: 142,307 m (GOLDEN_HOUR) e 7,279 m (SUN_HIGH); 0 com luz difusa', () => {
    close(shadowLengthM(20, 'GOLDEN_HOUR'), 142.307);
    close(shadowLengthM(20, 'SUN_HIGH'), 7.279);
    expect(shadowLengthM(20, 'OVERCAST')).toBe(0);
    expect(shadowLengthM(20, 'MAGIC_FOG')).toBe(0);
  });
});

describe('vento, deriva e térmicas', () => {
  it('windAt oscila em torno da média com rajada', () => {
    const wind = { meanMs: 4, gustMs: 3, directionDeg: 90 };
    expect(windAt(0, wind, () => 0)).toBe(4);
    close(
      windAt(7 / 4, wind, () => 0),
      4 + 3 * 0.6,
    );
    close(
      windAt(3, wind, (x) => (x === 1 ? 1 : 0)),
      4 + 3 * (0.6 * Math.sin((2 * Math.PI * 3) / 7) + 0.4),
    );
  });

  it('deriva = vento · driftFactor · modificador', () => {
    expect(driftVelocityMs(5, 0.6, 0.8)).toBeCloseTo(2.4, 12);
  });

  it('térmicas somam lift decrescente com a distância; metade sem sol a pino', () => {
    const zones: SpecialZone[] = [
      { kind: 'THERMAL', u: 0, v: 0, radiusM: 100, liftMs: 2 },
      { kind: 'THERMAL', u: 50, v: 0, radiusM: 100, liftMs: 1 },
      { kind: 'RTK_CANYON', uMin: 0, uMax: 10, vMin: 0, vMax: 10 },
    ];
    close(thermalLiftMs(zones, 25, 0, 'SUN_HIGH', 1), 2 * 0.75 + 1 * 0.75);
    close(thermalLiftMs(zones, 25, 0, 'OVERCAST', 1), (2 * 0.75 + 1 * 0.75) / 2);
    close(thermalLiftMs(zones, 25, 0, 'SUN_HIGH', 0.5), (2 * 0.75 + 1 * 0.75) / 2);
    expect(thermalLiftMs(zones, 500, 0, 'SUN_HIGH', 1)).toBe(0);
  });
});

describe('stepAircraft', () => {
  it('a velocidade nunca sai de [vMin, vMax] em 1.000 passos aleatórios', () => {
    for (const id of ['ATLAS', 'DRONE_T1', 'DRONE_T2', 'VTOL_T3'] as const) {
      const aircraft = getAircraft(id);
      const rng = mulberry32(99);
      let state = initialAircraftState(aircraft.vCruiseMs, 60);
      for (let i = 0; i < 1000; i++) {
        const input = {
          moveX: rng.range(-1, 1),
          moveY: rng.pick([-1, 1, rng.range(-1, 1)]),
          altUp: rng.next(),
          altDown: rng.next(),
        };
        state = stepAircraft(
          state,
          input,
          env({ aircraft, planSpeedMs: aircraft.vCruiseMs }),
          rng.range(0, 0.05),
        );
        expect(state.v).toBeGreaterThanOrEqual(aircraft.vMinMs);
        expect(state.v).toBeLessThanOrEqual(aircraft.vMaxMs);
      }
    }
  });

  it('MOVE_Y: −1 → vMin, 0 → plano, +1 → vMax, com aceleração limitada', () => {
    const aircraft = getAircraft('DRONE_T2');
    const run = (moveY: number, steps: number) => {
      let s = initialAircraftState(10, 60);
      for (let i = 0; i < steps; i++) s = stepAircraft(s, { ...IDLE, moveY }, env(), 1 / 60);
      return s;
    };
    expect(run(1, 1).v).toBeCloseTo(10 + aircraft.accelMs2 / 60, 9);
    expect(run(1, 600).v).toBe(aircraft.vMaxMs);
    expect(run(-1, 600).v).toBe(aircraft.vMinMs);
    expect(run(0, 600).v).toBe(10);
    expect(run(0.5, 600).v).toBe(14);
  });

  it('avança ao longo da linha e desloca na lateral com o input e a rajada', () => {
    let s = initialAircraftState(10, 60);
    s = stepAircraft(s, { ...IDLE, moveX: 1 }, env({ gustLateralMs: 3 }), 0.5);
    const t2 = getAircraft('DRONE_T2');
    expect(s.s).toBeCloseTo(5, 9);
    expect(s.vLat).toBeCloseTo(t2.lateralSpeedMaxMs, 9);
    expect(s.drift).toBe(3);
    expect(s.x).toBeCloseTo(0.5 * (t2.lateralSpeedMaxMs + 3), 9);
  });

  it('sem rajada e sem comando, o vento médio não deriva a aeronave', () => {
    let s = initialAircraftState(10, 60);
    for (let i = 0; i < 600; i++) s = stepAircraft(s, IDLE, env({ meanAlongMs: -3 }), 1 / 60);
    expect(s.x).toBe(0);
    expect(s.drift).toBe(0);
    // A velocidade no solo do plano é mantida contra o vento de proa.
    expect(s.v).toBe(10);
    expect(s.gs).toBe(10);
    expect(s.s).toBeCloseTo(100, 6);
  });

  it('rajada de cauda: a velocidade no solo passa da do plano e a aeronave avança mais', () => {
    let s = initialAircraftState(10, 60);
    s = stepAircraft(s, IDLE, env({ gustAlongMs: 2.5 }), 1);
    expect(s.v).toBe(10);
    expect(s.gs).toBe(12.5);
    expect(s.s).toBe(12.5);
    // De proa, a velocidade no solo cai, mas nunca abaixo do mínimo.
    s = stepAircraft(initialAircraftState(10, 60), IDLE, env({ gustAlongMs: -4 }), 1);
    expect(s.gs).toBe(6);
    s = stepAircraft(initialAircraftState(10, 60), IDLE, env({ gustAlongMs: -40 }), 1);
    expect(s.gs).toBe(MIN_GROUND_SPEED_MS);
  });

  it('limites da velocidade no solo: os da velocidade no ar deslocados pelo vento médio', () => {
    const t2 = getAircraft('DRONE_T2');
    expect(groundSpeedLimits(t2, 0)).toEqual({ lo: t2.vMinMs, hi: t2.vMaxMs });
    expect(groundSpeedLimits(t2, 5)).toEqual({ lo: t2.vMinMs + 5, hi: t2.vMaxMs + 5 });
    // Vento de proa forte: o piso é o mínimo absoluto e o teto cai.
    expect(groundSpeedLimits(t2, -10.8)).toEqual({ lo: MIN_GROUND_SPEED_MS, hi: t2.vMaxMs - 10.8 });
    expect(groundSpeedLimits(t2, -100)).toEqual({
      lo: MIN_GROUND_SPEED_MS,
      hi: MIN_GROUND_SPEED_MS,
    });
  });

  it('vento médio de proa maior que a folga: a velocidade no solo fica limitada abaixo da do plano', () => {
    const t2 = getAircraft('DRONE_T2');
    let s = initialAircraftState(12, 60);
    const e = env({ planSpeedMs: 12, meanAlongMs: -10.8 });
    for (let i = 0; i < 600; i++) s = stepAircraft(s, IDLE, e, 1 / 60);
    expect(s.v).toBeCloseTo(t2.vMaxMs - 10.8, 9);
    // Acelerar não adianta: a velocidade no ar já está no máximo.
    for (let i = 0; i < 600; i++) s = stepAircraft(s, { ...IDLE, moveY: 1 }, e, 1 / 60);
    expect(s.v).toBeCloseTo(t2.vMaxMs - 10.8, 9);
    // De cauda, a asa fixa não consegue ir mais devagar que vMin + vento.
    const vtol = getAircraft('VTOL_T3');
    let w = initialAircraftState(20, 100);
    const tail = env({ aircraft: vtol, planSpeedMs: 16, ceilingM: 300, meanAlongMs: 6 });
    for (let i = 0; i < 600; i++) w = stepAircraft(w, IDLE, tail, 1 / 60);
    expect(w.v).toBe(vtol.vMinMs + 6);
  });

  it('asa fixa com MOVE_X = 1 respeita aLat ≤ v²/R', () => {
    const vtol = getAircraft('VTOL_T3');
    let s = initialAircraftState(20, 100);
    const e = env({ aircraft: vtol, planSpeedMs: 20, ceilingM: 300 });
    const dt = 1 / 60;
    for (let i = 0; i < 240; i++) {
      const next = stepAircraft(s, { ...IDLE, moveX: 1 }, e, dt);
      const aLat = Math.abs(next.vLat - s.vLat) / dt;
      expect(aLat).toBeLessThanOrEqual((s.v * s.v) / vtol.turnRadiusM + 1e-9);
      s = next;
    }
    expect(s.vLat).toBeGreaterThan(0);
    expect(s.vLat).toBeLessThanOrEqual(20 * Math.sin(degToRad(30)) + 1e-9);
  });

  it('vertical sem TF: subida pelos gatilhos mais térmica, dentro dos limites', () => {
    const t2 = getAircraft('DRONE_T2');
    let s = initialAircraftState(10, 60);
    s = stepAircraft(s, { ...IDLE, altUp: 1 }, env({ thermalLiftMs: 1 }), 1);
    expect(s.alt).toBeCloseTo(60 + t2.climbRateMs + 1, 9);
    expect(s.climbing).toBe(true);
    for (let i = 0; i < 100; i++)
      s = stepAircraft(s, { ...IDLE, altUp: 1 }, env({ ceilingM: 90 }), 1);
    expect(s.alt).toBe(90);
    for (let i = 0; i < 100; i++)
      s = stepAircraft(s, { ...IDLE, altDown: 1 }, env({ elevationM: 10 }), 1);
    expect(s.alt).toBe(12);
    expect(s.climbing).toBe(false);
  });

  it('o piso de 2 m só barra a descida: um relevo que sobe rápido demais ainda alcança a aeronave', () => {
    const s0 = initialAircraftState(10, 30);
    const s1 = stepAircraft(s0, IDLE, env({ elevationM: 40 }), 1 / 60);
    expect(s1.alt).toBe(30);
    expect(s1.alt - 40).toBeLessThan(0);
  });

  it('TF sobre uma rampa de 30 % mantém o AGL dentro de ±15 %', () => {
    const t2 = getAircraft('DRONE_T2');
    const ramp = (s: number) => 0.3 * Math.max(0, s - 100);
    let state = initialAircraftState(10, 60);
    state = { ...state, aglTargetM: 60 };
    const dt = 1 / 60;
    let worst = 0;
    for (let i = 0; i < 60 * 60; i++) {
      const e = env({
        aircraft: t2,
        terrainFollowing: true,
        elevationM: ramp(state.s),
        elevationAhead: (d) => ramp(state.s + d),
      });
      state = stepAircraft(state, IDLE, e, dt);
      const agl = state.alt - ramp(state.s);
      worst = Math.max(worst, Math.abs(agl - 60) / 60);
    }
    expect(state.s).toBeGreaterThan(500);
    expect(worst).toBeLessThanOrEqual(0.15);
  });

  it('com TF, os gatilhos ajustam o AGL-alvo dentro de [hMin, min(hMax, teto)]', () => {
    const t2 = getAircraft('DRONE_T2');
    let s = { ...initialAircraftState(10, 60), aglTargetM: 60 };
    const e = env({ terrainFollowing: true, elevationAhead: () => 0, ceilingM: 100 });
    s = stepAircraft(s, { ...IDLE, altUp: 1 }, e, 1);
    expect(s.aglTargetM).toBe(60 + t2.climbRateMs);
    for (let i = 0; i < 50; i++) s = stepAircraft(s, { ...IDLE, altUp: 1 }, e, 1);
    expect(s.aglTargetM).toBe(100);
    for (let i = 0; i < 50; i++) s = stepAircraft(s, { ...IDLE, altDown: 1 }, e, 1);
    expect(s.aglTargetM).toBe(t2.hMinM);
  });
});

describe('terrainFollowTargetAlt', () => {
  it('é o máximo da elevação nos próximos 2 s (a cada 5 m) mais o AGL-alvo', () => {
    const samples: number[] = [];
    const target = terrainFollowTargetAlt(
      (d) => {
        samples.push(d);
        return d === 15 ? 40 : 10;
      },
      10,
      60,
    );
    expect(target).toBe(100);
    expect(samples).toEqual([0, 5, 10, 15, 20]);
  });
});

describe('initialAircraftState', () => {
  it('começa no início do run, alinhada', () => {
    const s: AircraftState = initialAircraftState(10, 60);
    expect(s).toMatchObject({ s: 0, x: 0, alt: 60, v: 10, gs: 10, vLat: 0, vz: 0, aglTargetM: 60 });
  });
});

describe('empurrão vertical: rajada vertical e corrente (ADR-035)', () => {
  const start = (): AircraftState => ({ ...initialAircraftState(10, 60), aglTargetM: 60 });

  it('sem TF, sobe ou desce por cima do comando; o comando segue sendo o de antes', () => {
    const down = stepAircraft(start(), IDLE, env({ gustVerticalMs: -3 }), 1);
    expect(down.alt).toBeCloseTo(57, 9);
    expect(down.vDrift).toBe(-3);
    expect(down.vz).toBe(0);
    expect(down.climbing).toBe(false);
    // Subindo no máximo contra a descendente: a razão de subida menos o empurrão.
    const climb = getAircraft('DRONE_T2').climbRateMs;
    const up = stepAircraft(start(), { ...IDLE, altUp: 1 }, env({ gustVerticalMs: -3 }), 1);
    expect(up.alt).toBeCloseTo(60 + climb - 3, 9);
    expect(up.vz).toBe(climb);
  });

  it('o piso barra a descida empurrada, e o teto, a subida', () => {
    const low = { ...start(), alt: 2.5 };
    expect(stepAircraft(low, IDLE, env({ gustVerticalMs: -3 }), 1).alt).toBe(2);
    const high = { ...start(), alt: 119 };
    expect(stepAircraft(high, IDLE, env({ gustVerticalMs: 5 }), 1).alt).toBe(120);
  });

  it('com TF, o laço de altura do TF corrige o que a corrente tira do lugar', () => {
    let s: AircraftState = start();
    const tf = env({ terrainFollowing: true, elevationAhead: () => 0, gustVerticalMs: -2 });
    for (let k = 0; k < 600; k++) s = stepAircraft(s, IDLE, tf, 1 / 60);
    // Em regime, o erro é o empurrão sobre o ganho do TF (2/s): 1 m abaixo do alvo.
    expect(s.alt).toBeCloseTo(59, 1);
  });
});

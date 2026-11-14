import { getAircraft } from '@/data/catalog';
import { degToRad, radToDeg } from '@/lib/math';
import { mulberry32 } from '@/lib/rng';
import type { SpecialZone } from '@/types';
import {
  crabAngleRad,
  driftVelocityMs,
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
    crossWindMs: 0,
    windDriftMod: 1,
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

  it('avança ao longo da linha e desloca na lateral com o input e a deriva', () => {
    let s = initialAircraftState(10, 60);
    s = stepAircraft(s, { ...IDLE, moveX: 1 }, env({ crossWindMs: 5 }), 0.5);
    const t2 = getAircraft('DRONE_T2');
    expect(s.s).toBeCloseTo(5, 9);
    expect(s.vLat).toBeCloseTo(t2.lateralSpeedMaxMs, 9);
    expect(s.drift).toBeCloseTo(5 * t2.driftFactor, 9);
    expect(s.x).toBeCloseTo(0.5 * (t2.lateralSpeedMaxMs + 3), 9);
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
    expect(s).toMatchObject({ s: 0, x: 0, alt: 60, v: 10, vLat: 0, vz: 0, aglTargetM: 60 });
  });
});

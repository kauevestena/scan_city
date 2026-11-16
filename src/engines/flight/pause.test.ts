/**
 * REQ-CORE-003 — Pausa: no voo, a posição da aeronave e a bateria não mudam durante 5 s de pausa
 * (relógio simulado: um `requestAnimationFrame` falso, e o `session.paused` da store dirigindo o
 * laço pelo mesmo `useGameLoop` das telas).
 */
import { act, renderHook } from '@testing-library/react';
import { CATALOG } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { useGameLoop } from '@/engines/useGameLoop';
import { useGameStore } from '@/state/store';
import { createFakeRaf } from '@/test/fakeRaf';
import { resetGameStore } from '@/test/resetStore';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { MissionData } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FlightEngine } from './FlightEngine';

const FRAME_MS = 1000 / 60;

function flightEngine(): FlightEngine {
  const mission: MissionData = {
    id: 'C00-1',
    contractId: 'C00',
    createdAt: 0,
    rivalAdjustment: 1,
    isReplay: false,
    plan: buildFlightPlan(referenceParams(C00), C00, CATALOG),
    groundPoints: [{ id: 'GCP-01', kind: 'GCP', u: 25, v: 20, elevM: 0, sigmaM: 0.02 }],
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: [],
    completedLines: [],
    shots: [],
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
    status: 'IN_FLIGHT',
  };
  let now = 0;
  return new FlightEngine({
    mission,
    contract: C00,
    terrain: createTerrain(C00),
    catalog: CATALOG,
    input: { axis: () => 0 },
    mods: neutralModifiers(),
    ownsRtkKit: false,
    autopilot: true,
    quality: () => 'LOW',
    reduceFlashes: () => false,
    colors: { primary: '#64748b', secondary: '#0f172a' },
    sortie: 0,
    shotOffset: 0,
    now: () => (now += 200),
  });
}

beforeEach(() => resetGameStore());

describe('REQ-CORE-003 — a pausa congela o voo', () => {
  it('a posição, a bateria, a surtida e as fotos não mudam em 5 s de pausa; ao retomar, voltam a andar', () => {
    const engine = flightEngine();
    const fake = createFakeRaf();
    renderHook(() => useGameLoop(() => engine, [], { raf: fake.raf, caf: fake.caf }));
    let t = 0;
    const run = (seconds: number) => {
      for (let k = 0; k < Math.round(seconds * 60); k++) {
        t += FRAME_MS;
        act(() => fake.frame(t));
      }
    };

    run(4);
    const before = {
      pos: { ...engine.pos() },
      energy: engine.energy,
      photos: engine.shots.length,
      phase: engine.phase,
    };
    // O voo está andando: saiu do ponto de partida e gastou bateria.
    expect(before.energy).toBeLessThan(1);
    expect(before.phase).toBe('RUN');

    act(() => useGameStore.getState().setPaused(true));
    run(5);
    expect(engine.pos()).toEqual(before.pos);
    expect(engine.energy).toBe(before.energy);
    expect(engine.shots.length).toBe(before.photos);
    expect(engine.phase).toBe(before.phase);

    // Retomar: o mesmo estado, e o voo continua de onde parou.
    act(() => useGameStore.getState().setPaused(false));
    run(2);
    expect(engine.energy).toBeLessThan(before.energy);
    expect(engine.pos()).not.toEqual(before.pos);
  });

  it('o laço segue desenhando durante a pausa (a tela não congela, só a simulação)', () => {
    const engine = flightEngine();
    const render = vi.spyOn(engine, 'render');
    const fake = createFakeRaf();
    renderHook(() => useGameLoop(() => engine, [], { raf: fake.raf, caf: fake.caf }));
    act(() => useGameStore.getState().setPaused(true));
    const before = render.mock.calls.length;
    for (let k = 1; k <= 30; k++) act(() => fake.frame(k * FRAME_MS));
    expect(render.mock.calls.length - before).toBe(30);
  });
});

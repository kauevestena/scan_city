import { CATALOG, getAircraft } from '@/data/catalog';
import { C02 } from '@/data/contracts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { turnTimeS } from '@/domain/photogrammetry';
import { referenceParams } from '@/domain/referencePlan';
import type { MissionData } from '@/types';
import { turnExtraS } from '@/test/turnTiming';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FlightEngine, type SortieResult } from './FlightEngine';

const plan = buildFlightPlan(referenceParams(C02), C02, CATALOG);

function mission(): MissionData {
  return {
    id: 'C02-1',
    contractId: 'C02',
    createdAt: 0,
    rivalAdjustment: 1,
    isReplay: false,
    plan,
    groundPoints: [],
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: [],
    completedLines: [],
    shots: [],
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
    status: 'IN_FLIGHT',
  };
}

describe('asa fixa no C02: as curvas levam o tempo da fórmula', () => {
  it('turnTimeS = (π·R + |espaçamento − 2R|) / v, com R = 80 m e o espaçamento das linhas', () => {
    const { turnRadiusM } = getAircraft('VTOL_T3');
    expect(turnRadiusM).toBe(80);
    const { spacingM } = plan.stats;
    // As linhas (90,6 m) são mais próximas que o diâmetro da curva (160 m): curva em gota.
    expect(spacingM).toBeLessThan(2 * turnRadiusM);
    const expected = (Math.PI * 80 + Math.abs(spacingM - 160)) / 22;
    expect(turnTimeS({ turnRadiusM }, spacingM, 22)).toBeCloseTo(expected, 12);
    expect(plan.stats.turnTimeS).toBeCloseTo(expected, 9);
    // 8 linhas de 1.660 m a 22 m/s, 7 curvas e 20 s de decolagem e pouso: o tempo do plano.
    expect(plan.stats.flightTimeS).toBeCloseTo((8 * 1660) / 22 + 7 * expected + 20, 1);
  });

  it('o motor voa as 8 linhas com autopilot e a surtida dura linhas + curvas (+ 4,5 s de decolagem e pouso)', () => {
    const results: SortieResult[] = [];
    let now = 0;
    const e = new FlightEngine({
      mission: mission(),
      contract: C02,
      terrain: createTerrain(C02),
      catalog: CATALOG,
      input: { axis: () => 0 },
      mods: neutralModifiers(),
      ownsRtkKit: true,
      autopilot: true,
      quality: () => 'LOW',
      reduceFlashes: () => false,
      colors: { primary: '#64748b', secondary: '#0f172a' },
      sortie: 0,
      shotOffset: 0,
      onShots: () => undefined,
      onSortieEnd: (r) => results.push(r),
      onPhase: () => undefined,
      onHud: () => undefined,
      onShutter: () => undefined,
      now: () => (now += 200),
    });
    for (let t = 0; t < 900 && e.phase !== 'POST_FLIGHT'; t += 1 / 60) e.update(1 / 60);
    const result = results[0];
    expect(result?.outcome).toBe('COMPLETED');
    expect(result?.completedLines).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
    const { turnTimeS: turn, lineLengthM } = plan.stats;
    // Em cada uma das 7 curvas, a aproximação do portal da curva e a manobra no centro da janela
    // (ADR-035).
    expect(result?.durationS).toBeCloseTo(
      (8 * lineLengthM) / 22 + 7 * turn + 4.5 + 7 * turnExtraS(plan),
      0,
    );
    // Duas centenas de fotos ± 6 %: 41 por linha.
    expect(Math.abs((result?.photos ?? 0) - plan.stats.totalPhotos)).toBeLessThanOrEqual(
      plan.stats.totalPhotos * 0.06,
    );
  });
});

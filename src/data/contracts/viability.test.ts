/**
 * Teste de viabilidade (contracts-real §2): o plano de referência de cada contrato
 * gera o plano esperado e, com os pontos encaixados no acessível mais próximo,
 * nenhum requisito previsível falha.
 */
import { CATALOG, getAircraft, getVehicle } from '@/data/catalog';
import { snapToAccessible } from '@/domain/accessibility';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { predictRequirements } from '@/domain/requirements';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { Contract, GroundPoint } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import { CONTRACTS } from '.';

/** Dossel mais comum da AOI (a mata, nos biomas de floresta): a base da densidade de solo prevista. */
function typicalCanopy(c: Contract): number {
  const terrain = createTerrain(c);
  const samples: number[] = [];
  for (let u = 0; u <= c.aoi.lengthM; u += 10) {
    for (let v = 0; v <= c.aoi.widthM; v += 10) samples.push(terrain.canopy(u, v));
  }
  return samples.sort((a, b) => a - b)[Math.floor(samples.length / 2)] as number;
}

describe.each(CONTRACTS.map((c) => [c.id, c] as const))('viabilidade de %s', (_id, c: Contract) => {
  const ref = c.referencePlan;
  const plan = buildFlightPlan(referenceParams(c), c, CATALOG, { meanCanopy: typicalCanopy(c) });

  it('o planejador reproduz o esperado (GSD ±1 %, nº de linhas, tempo ±2 %)', () => {
    expect(Math.abs(plan.stats.gsdM * 100 - ref.expected.gsdCm) / ref.expected.gsdCm).toBeLessThan(
      0.01,
    );
    expect(plan.stats.nLines).toBe(ref.expected.nLines);
    expect(
      Math.abs(plan.stats.flightTimeS - ref.expected.flightTimeS) / ref.expected.flightTimeS,
    ).toBeLessThan(0.02);
  });

  it('GCPs/CPs encaixam a ≤ 30 m e nenhum requisito previsível falha', () => {
    const terrain = createTerrain(c);
    const vehicles = [getVehicle(c.minVehicle), getVehicle(c.recommended.vehicle)];
    const rules = { paintMarkers: c.specialRules.includes('PAINT_MARKERS') };
    const points: GroundPoint[] = [];
    for (const [kind, list] of [
      ['GCP', ref.gcps],
      ['CP', ref.cps],
    ] as const) {
      list.forEach((p, i) => {
        const snapped = snapToAccessible(p, terrain, vehicles, rules, 30);
        expect(snapped, `${kind} ${i + 1} em (${p.u}, ${p.v})`).not.toBeNull();
        if (!snapped) return;
        points.push({
          id: `${kind}${i + 1}`,
          kind,
          u: snapped.u,
          v: snapped.v,
          elevM: terrain.elevation(snapped.u, snapped.v),
          sigmaM: 0.01,
        });
      });
    }
    const results = predictRequirements(plan, c, points, {
      catalog: CATALOG,
      // O T2 é vendido em combo com o kit GNSS: o plano que usa uma aeronave RTK conta com ele.
      ownsRtkKit: getAircraft(ref.aircraftId).rtk,
      fieldEquipmentId: 'TOTAL_STATION',
    });
    expect(results.filter((r) => !r.pass).map((r) => `${r.id}: ${r.valueText}`)).toEqual([]);
  });
});

// Os contratos de LiDAR esperam também a faixa varrida e as densidades de pontos.
describe.each(
  CONTRACTS.filter((c) => c.referencePlan.expected.lidar !== undefined).map(
    (c) => [c.id, c] as const,
  ),
)('viabilidade de LiDAR de %s', (_id, c: Contract) => {
  const lidar = c.referencePlan.expected.lidar as NonNullable<
    Contract['referencePlan']['expected']['lidar']
  >;
  const plan = buildFlightPlan(referenceParams(c), c, CATALOG, { meanCanopy: typicalCanopy(c) });
  const within = (got: number | undefined, want: number, tol: number) =>
    Math.abs((got ?? NaN) - want) / want < tol;

  it('faixa e densidade total batem com a spec (±1 %) e a de solo, sob o dossel típico, (±10 %)', () => {
    expect(within(plan.stats.lidarSwathM, lidar.swathM, 0.01)).toBe(true);
    expect(within(plan.stats.lidarDensity, lidar.density, 0.01)).toBe(true);
    expect(within(plan.stats.groundDensity, lidar.groundDensity, 0.1)).toBe(true);
  });
});

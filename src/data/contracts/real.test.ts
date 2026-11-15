/** Fichas dos contratos do Mundo Real conferidas contra a spec (contracts-real). */
import { getAircraft, getSensor } from '@/data/catalog';
import { meanAoiElevation } from '@/engines/flight/FlightEngine';
import { createTerrain } from '@/world/terrain/createTerrain';
import { C01, museumSlotCoords } from '.';

describe('C01 — Metrópole Vertical', () => {
  it('conforme a ficha: AOI, teto, vento, regra, requisitos, recompensa e museu', () => {
    expect(C01.title).toBe('Metrópole Vertical');
    expect(C01.client.name).toBe('Prefeito Dr. Aurélio Bastos');
    expect(C01.client.portrait).toMatchObject({
      shape: 'SHIELD',
      icon: 'Landmark',
      initials: 'AB',
    });
    expect([C01.biome, C01.seed]).toEqual(['URBAN_VERTICAL', 2002]);
    expect(C01.aoi).toEqual({ widthM: 240, lengthM: 360 });
    expect([C01.ceilingM, C01.terrainReliefM]).toEqual([120, 10]);
    expect(C01.lightingOptions).toEqual(['SUN_HIGH', 'OVERCAST', 'GOLDEN_HOUR']);
    expect(C01.wind).toEqual({ meanMs: 4, gustMs: 3, directionDeg: 90 });
    expect(C01.specialRules).toEqual(['URBAN_CANYON_RTK_LOSS']);
    expect(
      C01.requirements.map((r) => [
        r.severity,
        r.check.type,
        'value' in r.check ? r.check.value : '',
      ]),
    ).toEqual([
      ['CRITICAL', 'MIN_SIDE_OVERLAP', 80],
      ['CRITICAL', 'MIN_COVERAGE_GREEN', 0.8],
      ['CRITICAL', 'ACCURACY_PEC', ''],
      ['MAJOR', 'MIN_FORWARD_OVERLAP', 80],
      ['MAJOR', 'MAX_GSD_CM', 3.5],
      ['MAJOR', 'MIN_GCP', 5],
      ['MINOR', 'MIN_CP', 2],
    ]);
    expect(C01.requirements[2]?.check).toEqual({
      type: 'ACCURACY_PEC',
      cls: 'A',
      scaleDenominator: 1000,
    });
    expect(C01.recommended).toMatchObject({
      aircraft: ['DRONE_T1'],
      sensors: ['CAM_20MP_RS'],
      vehicle: 'COMPACT_CAR',
    });
    expect(C01.minVehicle).toBe('FOOT_BIKE');
    expect([C01.basePaymentBRL, C01.xp, C01.reputationReward]).toEqual([1_200_000, 400, 8]);
    expect(C01.souvenirId).toBe('SV_CITY_KEY');
    expect(museumSlotCoords(C01.museum.slot)).toEqual({ col: 1, lin: 0 });
    expect(C01.museum.incomePerMinBRL).toBe(4_000);
    expect(C01.unlock).toEqual({ type: 'CONTRACT_DONE', contractId: 'C00' });
    expect(C01.overworldMarker).toBe('1');
    expect(C01.dialogs.briefing).toHaveLength(3);
    expect(C01.dialogs.success).toHaveLength(2);
    expect(C01.dialogs.failure).toHaveLength(2);
  });

  it('o plano de referência usa o T1 com a câmera de 20 MP, dentro do teto e das regras do drone', () => {
    const ref = C01.referencePlan;
    expect([ref.aircraftId, ref.sensorId]).toEqual(['DRONE_T1', 'CAM_20MP_RS']);
    expect(getAircraft(ref.aircraftId).compatibleSensors).toContain(getSensor(ref.sensorId).id);
    expect(ref.heightM).toBeLessThanOrEqual(C01.ceilingM);
    expect(ref.heightM).toBeLessThanOrEqual(getAircraft(ref.aircraftId).hMaxM);
    expect(ref.expected).toEqual({ gsdCm: 3.02, nLines: 10, flightTimeS: 493.7 });
  });

  it('o briefing avisa a altura máxima, e ela é a do prédio mais alto da AOI gerada', () => {
    const terrain = createTerrain(C01);
    const tallest = Math.max(
      ...terrain.objects
        .filter(
          (o) =>
            o.kind === 'BUILDING' &&
            o.u >= 0 &&
            o.u <= C01.aoi.lengthM &&
            o.v >= 0 &&
            o.v <= C01.aoi.widthM,
        )
        .map((o) => o.heightM),
    );
    expect(tallest).toBe(90);
    expect(C01.recommended.notes).toContain(`${tallest} m`);
    expect(C01.recommended.notes).toMatch(/acima dos prédios mais altos/);
  });

  it('o plano de referência passa acima do prédio mais alto, com folga, e abaixo do teto', () => {
    const terrain = createTerrain(C01);
    const planAltM = meanAoiElevation(terrain) + C01.referencePlan.heightM;
    // O topo mais alto da cena (cota do chão + altura do prédio) e a folga do plano sobre ele.
    let top = 0;
    for (const o of terrain.objects) top = Math.max(top, terrain.elevation(o.u, o.v) + o.heightM);
    expect(planAltM - top).toBeGreaterThanOrEqual(10);
    expect(C01.referencePlan.heightM).toBeLessThanOrEqual(C01.ceilingM);
  });
});

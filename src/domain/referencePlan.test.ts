import { CATALOG, getVehicle } from '@/data/catalog';
import { C00, C01, C04 } from '@/data/contracts';
import { createTerrain } from '@/world/terrain/createTerrain';
import { isAccessible } from './accessibility';
import { referenceParams, referencePoints, syntheticMission } from './referencePlan';

describe('referenceParams', () => {
  it('traduz o plano de referência do contrato em parâmetros de plano', () => {
    expect(referenceParams(C00)).toMatchObject({
      aircraftId: 'ATLAS',
      sensorId: 'CAM_PIGEON',
      primarySensor: 'RGB',
      heightM: 60,
      forwardOverlapPct: 70,
      sideOverlapPct: 60,
      speedMs: 10,
      crossGrid: false,
      terrainFollowing: false,
    });
    const mine = referenceParams(C04);
    expect(mine).toMatchObject({ terrainFollowing: true, lensId: 'LENS_24', lighting: 'OVERCAST' });
    expect(mine.obliqueDeg).toBeUndefined();
  });
});

describe('referencePoints', () => {
  it('sem encaixe, mantém as posições do plano; com encaixe, vão para terra acessível', () => {
    const terrain = createTerrain(C01);
    const plain = referencePoints(C01, terrain);
    expect(plain.map((p) => [p.u, p.v])).toEqual(
      [...C01.referencePlan.gcps, ...C01.referencePlan.cps].map((p) => [p.u, p.v]),
    );
    expect(plain.map((p) => p.id)).toEqual(['GCP1', 'GCP2', 'GCP3', 'GCP4', 'GCP5', 'CP1', 'CP2']);
    const foot = [getVehicle('FOOT_BIKE')];
    const rules = { paintMarkers: false };
    const snapped = referencePoints(C01, terrain, { vehicles: foot, rules });
    for (const p of snapped)
      expect(isAccessible(p.u, p.v, terrain, foot, rules).ok, p.id).toBe(true);
    // Pelo menos um ponto de referência caía em telhado e andou.
    expect(snapped.some((p, i) => p.u !== plain[i]?.u || p.v !== plain[i]?.v)).toBe(true);
    expect(snapped.every((p) => p.sigmaM === 0.01 && p.elevM === terrain.elevation(p.u, p.v))).toBe(
      true,
    );
  });
});

describe('syntheticMission', () => {
  it('sem TF: altitude constante (o AGL acompanha o relevo); com TF: AGL de H em toda foto', () => {
    const flat = syntheticMission(C01, createTerrain(C01), CATALOG);
    const alts = new Set(flat.shots.map((s) => Math.round(s.altM * 1000)));
    expect(alts.size).toBe(1);
    const agls = flat.shots.map((s) => s.aglM);
    expect(Math.max(...agls) - Math.min(...agls)).toBeGreaterThan(1);

    const terrain = createTerrain(C04);
    const tf = syntheticMission(C04, terrain, CATALOG);
    expect(tf.plan.params.terrainFollowing).toBe(true);
    for (const s of tf.shots) {
      expect(s.aglM).toBeCloseTo(80, 9);
      expect(s.altM).toBeCloseTo(terrain.elevation(s.u, s.v) + 80, 9);
    }
    // A altitude acompanha a cava: de ~80 m (fundo) a ~230 m (borda).
    const heights = tf.shots.map((s) => s.altM);
    expect(Math.max(...heights) - Math.min(...heights)).toBeGreaterThan(100);
    expect(tf.status).toBe('PENDING_PROCESSING');
    expect(tf.completedLines).toHaveLength(tf.plan.stats.nLines);
  });

  it('aceita sobrescritas (id, pontos de apoio)', () => {
    const terrain = createTerrain(C01);
    const m = syntheticMission(C01, terrain, CATALOG, { id: 'X', groundPoints: [] });
    expect(m.id).toBe('X');
    expect(m.groundPoints).toEqual([]);
  });
});

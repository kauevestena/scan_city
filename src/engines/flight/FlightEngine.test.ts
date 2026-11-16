import { CATALOG } from '@/data/catalog';
import { C00 } from '@/data/contracts';
import { buildFlightPlan } from '@/domain/flightPlanner';
import { neutralModifiers } from '@/domain/modifiers';
import { FLIGHT_STAGE, PERF, setPerfEnabled } from '@/engines/perf';
import { referenceParams } from '@/test/fixtures/syntheticMission';
import type { MissionData, Shot, WorldObject } from '@/types';
import { makeObject } from '@/world/terrain/objects';
import { createTerrain } from '@/world/terrain/createTerrain';
import { FlightEngine, meanAoiElevation, SHOT_BATCH, type SortieResult } from './FlightEngine';
import type { FlightHudSnapshot, FlightPhase } from './hudPublisher';

function mission(over: Partial<MissionData> = {}): MissionData {
  return {
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
    ...over,
  };
}

function engine(over: Partial<ConstructorParameters<typeof FlightEngine>[0]> = {}) {
  const batches: Shot[][] = [];
  const results: SortieResult[] = [];
  const phases: FlightPhase[] = [];
  const huds: FlightHudSnapshot[] = [];
  let shutters = 0;
  let now = 0;
  const e = new FlightEngine({
    mission: mission(),
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
    onShots: (b) => batches.push([...b]),
    onSortieEnd: (r) => results.push(r),
    onPhase: (p) => phases.push(p),
    onHud: (h) => huds.push(h),
    onShutter: () => shutters++,
    now: () => (now += 200),
    ...over,
  });
  return { e, batches, results, phases, huds, shutters: () => shutters };
}

/** Roda até o pós-voo (ou `maxS` de simulação), em sub-passos de 1/60 s. */
function fly(e: FlightEngine, maxS = 900) {
  for (let t = 0; t < maxS && e.phase !== 'POST_FLIGHT'; t += 1 / 60) e.update(1 / 60);
}

describe('FlightEngine — C00 com o plano de referência e autopilot (critério 1)', () => {
  it('6 linhas completas, 96 ± 6 fotos, e a surtida termina COMPLETED', () => {
    const { e, batches, results, phases, shutters } = engine();
    fly(e);
    expect(e.phase).toBe('POST_FLIGHT');
    const result = results[0];
    expect(result?.outcome).toBe('COMPLETED');
    expect(result?.completedLines).toEqual([0, 1, 2, 3, 4, 5]);
    expect(Math.abs((result?.photos ?? 0) - 96)).toBeLessThanOrEqual(6);
    expect(shutters()).toBe(result?.photos);
    // Lotes de 10 ao store, com o resto no fim da surtida.
    expect(batches.slice(0, -1).every((b) => b.length === SHOT_BATCH)).toBe(true);
    expect(batches.flat()).toHaveLength(result?.photos ?? -1);
    expect(phases[0]).toBe('RUN');
    expect(phases.filter((p) => p === 'TURN')).toHaveLength(5);
    expect(phases.slice(-2)).toEqual(['LANDING', 'POST_FLIGHT']);
    // Linhas (6 × 300 m a 10 m/s) + 5 curvas de 6,29 s + decolagem (2,5 s) e pouso (2 s). O
    // tempo de voo do plano (231,5 s) reserva 20 s para decolagem e pouso.
    expect(result?.durationS).toBeCloseTo(180 + 5 * 6.2907 + 4.5, 0);
    expect(e.energy).toBeGreaterThan(0);
  });

  it('os disparos: altitude H sobre a cota média, sobreposição perto da do plano, sem blur', () => {
    const { e } = engine();
    fly(e);
    const shots = e.shots;
    const alt = meanAoiElevation(createTerrain(C00)) + 60;
    for (const s of shots) {
      expect(s.altM).toBeCloseTo(alt, 0);
      expect(s.blurred).toBe(false);
      expect(s.sortie).toBe(0);
      expect(s.manual).toBe(false);
    }
    // Disparos consecutivos da mesma linha: ~70 % de sobreposição (p do plano).
    const line0 = shots.filter((s) => s.lineIndex === 0);
    const d = Math.hypot(
      (line0[1]?.u ?? 0) - (line0[0]?.u ?? 0),
      (line0[1]?.v ?? 0) - (line0[0]?.v ?? 0),
    );
    expect(1 - d / (line0[1]?.footprintHM ?? 1)).toBeCloseTo(0.7, 1);
    expect(shots.map((s) => s.i)).toEqual(shots.map((_, k) => k));
  });
});

describe('FlightEngine — controles, alertas e HUD', () => {
  it('decola em 2,5 s (sem disparos) e o HUD publica o snapshot', () => {
    const { e, huds } = engine();
    for (let t = 0; t < 2.4; t += 1 / 60) e.update(1 / 60);
    expect(e.phase).toBe('TAKEOFF');
    expect(e.shots).toHaveLength(0);
    e.render();
    const h = huds.at(-1);
    expect(h).toMatchObject({
      phase: 'TAKEOFF',
      lineIndex: 1,
      nLines: 6,
      energyUnit: 'CORN',
      photosPlanned: 96,
      activeSensor: 'RGB',
    });
    expect(h?.minimap.lines).toHaveLength(6);
  });

  it('disparo manual com cooldown de 0,3 s, só no RUN', () => {
    const { e } = engine();
    expect(e.manualShot()).toBe(false);
    for (let t = 0; t < 3; t += 1 / 60) e.update(1 / 60);
    expect(e.manualShot()).toBe(true);
    expect(e.manualShot()).toBe(false);
    for (let t = 0; t < 0.35; t += 1 / 60) e.update(1 / 60);
    expect(e.manualShot()).toBe(true);
    expect(e.shots.filter((s) => s.manual)).toHaveLength(2);
  });

  it('30 % acima da velocidade do plano: overlap real abaixo do mínimo e alerta', () => {
    const { e } = engine({ autopilot: false, input: { axis: (a) => (a === 'MOVE_Y' ? 1 : 0) } });
    for (let t = 0; t < 20; t += 1 / 60) e.update(1 / 60);
    // Com o Atlas no máximo (16 m/s > 13 m/s), a base cresce além do previsto.
    expect(e.pRealPct()).not.toBeNull();
    expect(e.pRealPct() ?? 100).toBeLessThan(65);
    expect(e.alerts().map((a) => a.id)).toContain('OVERLAP');
  });

  it('fora da faixa quando |X| > 0,25·S; abortar encerra a surtida', () => {
    const { e, results } = engine({
      autopilot: false,
      input: { axis: (a) => (a === 'MOVE_X' ? 1 : 0) },
    });
    for (let t = 0; t < 6; t += 1 / 60) e.update(1 / 60);
    expect(e.alerts().map((a) => a.id)).toContain('OUT_OF_LANE');
    e.abort();
    expect(results[0]?.outcome).toBe('ABORTED');
    expect(e.phase).toBe('POST_FLIGHT');
    e.update(1);
    expect(results).toHaveLength(1);
  });

  it('energia esgotada: queda de 2 s e depois ENERGY_DEPLETED', () => {
    const { e, results, phases } = engine();
    e.energy = 0.0001;
    for (let t = 0; t < 1; t += 1 / 60) e.update(1 / 60);
    expect(e.phase).toBe('CRASHED');
    expect(results).toHaveLength(0);
    for (let t = 0; t < 2.1; t += 1 / 60) e.update(1 / 60);
    expect(results[0]?.outcome).toBe('ENERGY_DEPLETED');
    expect(phases).toContain('CRASHED');
  });

  it('linhas já concluídas ficam de fora numa nova surtida', () => {
    const { e, results } = engine({
      mission: mission({ completedLines: [0, 1, 2, 3, 4] }),
      sortie: 1,
      shotOffset: 80,
    });
    fly(e);
    expect(results[0]?.completedLines).toEqual([5]);
    expect(e.shots[0]?.i).toBe(80);
    expect(e.shots[0]?.sortie).toBe(1);
  });

  it('render desenha céu, terreno e aeronave; com reduceFlashes, sem flash', () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const { e } = engine({ reduceFlashes: () => true });
    e.attach({ ctx, width: 1280, height: 720, dpr: 1 });
    for (let t = 0; t < 4; t += 1 / 60) e.update(1 / 60);
    e.manualShot();
    const before = (ctx.fillRect as unknown as { mock: { calls: unknown[][] } }).mock.calls.length;
    e.render();
    const calls = (ctx.fillRect as unknown as { mock: { calls: unknown[][] } }).mock.calls.slice(
      before,
    );
    expect(calls.some((c) => c[2] === 1280 && c[3] === 720)).toBe(false);
  });
});

/** Terreno do C00 com um único objeto no caminho da linha 1 (v ≈ −2,2 m). */
function terrainWith(...objects: WorldObject[]) {
  const base = createTerrain(C00);
  return { ...base, objects, objectsInRange: () => objects } as typeof base;
}
const wall = (over: Partial<WorldObject> = {}): WorldObject =>
  makeObject(() => 1, {
    kind: 'BUILDING',
    u: 60,
    v: -2.2,
    widthM: 10,
    depthM: 10,
    heightM: 200,
    color: [1, 2, 3],
    ...over,
  });

describe('FlightEngine — colisão, dano e queda (§5.11)', () => {
  it('prédio no caminho: casco −1, CRASH, velocidade a 30 %, 1,5 s de invulnerabilidade', () => {
    let crashes = 0;
    const { e } = engine({ terrain: terrainWith(wall()), onCollision: () => crashes++ });
    let vAtHit = 0;
    for (let t = 0; t < 30 && e.collisions === 0; t += 1 / 60) {
      e.update(1 / 60);
      vAtHit = e.ac.v;
    }
    expect(e.collisions).toBe(1);
    expect(crashes).toBe(1);
    expect(e.hull).toBe(e.aircraft.hull - 1);
    expect(vAtHit).toBeCloseTo(3, 0);
    // Atravessando o prédio durante a invulnerabilidade: não perde mais casco.
    for (let t = 0; t < 1.4; t += 1 / 60) e.update(1 / 60);
    expect(e.collisions).toBe(1);
    expect(e.snapshot().hull).toBe(e.aircraft.hull - 1);
  });

  it('casco zerado: queda e a surtida termina CRASH (Atlas: "voltou para casa")', () => {
    const { e, results, huds } = engine({ terrain: terrainWith(wall()) });
    e.hull = 1;
    for (let t = 0; t < 40 && e.phase !== 'CRASHED'; t += 1 / 60) e.update(1 / 60);
    expect(e.phase).toBe('CRASHED');
    for (let t = 0; t < 2.1; t += 1 / 60) e.update(1 / 60);
    expect(results[0]).toMatchObject({ outcome: 'CRASH', atlas: true, collisions: 1 });
    expect(huds.at(-1)?.hull).toBe(0);
  });

  it('terreno acima da aeronave: queda imediata', () => {
    const base = createTerrain(C00);
    // Um paredão de 500 m a partir de u = 50: a aeronave (H = 60 m) bate no relevo.
    const hill = { ...base, elevation: (u: number) => (u > 50 ? 500 : 0) } as typeof base;
    const { e } = engine({ terrain: hill });
    for (let t = 0; t < 20 && e.phase !== 'CRASHED'; t += 1 / 60) e.update(1 / 60);
    expect(e.phase).toBe('CRASHED');
    expect(e.hull).toBe(0);
  });

  it('objeto não sólido não bate; o render de fio, feixe e perigo não quebra', () => {
    const wire = makeObject(() => 2, {
      kind: 'WIRE',
      u: 40,
      v: -2.2,
      u2: 80,
      v2: -2.2,
      widthM: 0.1,
      depthM: 0.1,
      heightM: 5,
      baseM: 60,
      color: [0, 0, 0],
    });
    const beam = makeObject(() => 3, {
      kind: 'ENERGY_BEAM',
      u: 50,
      v: 10,
      widthM: 3,
      depthM: 3,
      heightM: 40,
      color: [9, 9, 9],
      activePeriod: { onS: 2, offS: 3, phase: 0 },
    });
    const hazard = makeObject(() => 4, {
      kind: 'MOVING_HAZARD',
      u: 50,
      v: 30,
      widthM: 6,
      depthM: 6,
      heightM: 6,
      baseM: 30,
      color: [9, 9, 9],
      motion: { axis: 'u', amplitudeM: 10, periodS: 4, phase: 0 },
    });
    const { e } = engine({ terrain: terrainWith(wall({ solid: false }), wire, beam, hazard) });
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    e.attach({ ctx, width: 1280, height: 720, dpr: 1 });
    for (let t = 0; t < 6; t += 1 / 60) {
      e.update(1 / 60);
      if (Math.round(t * 60) % 30 === 0) e.render();
    }
    expect(e.collisions).toBe(0);
  });
});

describe('FlightEngine — contador de tempo por etapa (survey-flight §5.18)', () => {
  afterEach(() => setPerfEnabled(false));

  it('desligado não mede; ligado, cada render fecha um quadro com as etapas do voo', () => {
    const { e } = engine();
    const ctx = document.createElement('canvas').getContext('2d') as CanvasRenderingContext2D;
    e.attach({ ctx, width: 1280, height: 720, dpr: 1 });
    e.update(1 / 60);
    e.render();
    expect(PERF.flight.frameCount).toBe(0);

    setPerfEnabled(true);
    for (let k = 0; k < 3; k++) {
      e.update(1 / 60);
      e.render();
    }
    expect(PERF.flight.frameCount).toBe(3);
    const readings = PERF.flight.readings();
    expect(readings).toHaveLength(Object.keys(FLIGHT_STAGE).length);
    expect(readings.every((r) => Number.isFinite(r.ms) && r.ms >= 0)).toBe(true);
    // O terreno (amostragem e quads) é o grosso do quadro e sempre passa pelas duas etapas.
    expect(readings[FLIGHT_STAGE.GRID]?.ms).toBeGreaterThan(0);
    expect(readings[FLIGHT_STAGE.TERRAIN]?.ms).toBeGreaterThan(0);
    expect(PERF.flight.totalMs).toBeGreaterThan(0);
  });

  it('sem superfície (o render só publica o HUD) nenhum quadro é fechado', () => {
    const { e } = engine();
    setPerfEnabled(true);
    e.update(1 / 60);
    e.render();
    expect(PERF.flight.frameCount).toBe(0);
  });
});

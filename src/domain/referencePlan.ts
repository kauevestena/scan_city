import type { Catalog } from '@/data/catalog';
import { snapToAccessible, type AccessRules } from './accessibility';
import { buildFlightPlan } from './flightPlanner';
import {
  exposureTimeS,
  footprint,
  gsd,
  motionBlurPx,
  pixelPitchM,
  rollingShutterSkewPx,
} from './photogrammetry';
import { planEquipment } from './requirements';
import type { Contract, GroundPoint, MissionData, PlanParams, Shot, Vehicle } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';

/** Parâmetros do plano de referência do contrato. */
export function referenceParams(contract: Contract): PlanParams {
  const r = contract.referencePlan;
  const params: PlanParams = {
    aircraftId: r.aircraftId,
    sensorId: r.sensorId,
    primarySensor: r.sensorId === 'POD_LIDAR' ? 'LIDAR' : 'RGB',
    heightM: r.heightM,
    forwardOverlapPct: r.forwardOverlapPct,
    sideOverlapPct: r.sideOverlapPct,
    speedMs: r.speedMs,
    orientation: 'ALONG_LENGTH',
    crossGrid: r.modes.includes('CROSS_GRID'),
    terrainFollowing: r.modes.includes('TERRAIN_FOLLOWING'),
    lighting: r.lighting,
  };
  if (r.lensId) params.lensId = r.lensId;
  if (r.obliqueDeg) params.obliqueDeg = r.obliqueDeg;
  return params;
}

/** Encaixe dos pontos de referência no ponto acessível mais próximo (≤ 30 m). */
export interface ReferenceSnap {
  vehicles: readonly Pick<Vehicle, 'gcpNetwork' | 'gcpReachM' | 'maxSlopePct' | 'allowSwamp'>[];
  rules: AccessRules;
}

/**
 * Pontos de apoio do plano de referência, com σ de 1 cm. Com `snap`, cada ponto vai para o ponto
 * acessível mais próximo (fora de telhado, água e dossel), como o jogador faria no campo.
 */
export function referencePoints(
  contract: Contract,
  terrain: TerrainSampler,
  snap?: ReferenceSnap,
): GroundPoint[] {
  const r = contract.referencePlan;
  const point = (
    kind: GroundPoint['kind'],
    i: number,
    p: { u: number; v: number },
  ): GroundPoint => {
    const at = (snap && snapToAccessible(p, terrain, snap.vehicles, snap.rules, 30)) || p;
    return {
      id: `${kind}${i + 1}`,
      kind,
      u: at.u,
      v: at.v,
      elevM: terrain.elevation(at.u, at.v),
      sigmaM: 0.01,
    };
  };
  return [...r.gcps.map((p, i) => point('GCP', i, p)), ...r.cps.map((p, i) => point('CP', i, p))];
}

/**
 * Missão "perfeita" do plano de referência: fotos disparadas a cada base, na janela da
 * câmera (AOI ± 1 base), a altitude constante sobre a cota média da AOI (ou, com Terrain
 * Following, a H de AGL sobre o terreno de cada foto), sem ruído.
 */
export function syntheticMission(
  contract: Contract,
  terrain: TerrainSampler,
  catalog: Catalog,
  overrides: Partial<MissionData> = {},
): MissionData {
  const plan = buildFlightPlan(referenceParams(contract), contract, catalog);
  const { camera, focalM } = planEquipment(plan, catalog);
  const pitch = pixelPitchM(camera);
  const exposure = exposureTimeS(plan.params.lighting);
  let elevSum = 0;
  let n = 0;
  for (let u = 0; u <= contract.aoi.lengthM; u += 10) {
    for (let v = 0; v <= contract.aoi.widthM; v += 10) {
      elevSum += terrain.elevation(u, v);
      n++;
    }
  }
  const altM = elevSum / n + plan.params.heightM;
  const tf = plan.params.terrainFollowing;
  const v = plan.params.speedMs;
  const shots: Shot[] = [];
  let t = 0;
  for (const line of plan.lines) {
    const dirU =
      (line.end.u - line.start.u) /
      Math.hypot(line.end.u - line.start.u, line.end.v - line.start.v);
    const dirV =
      (line.end.v - line.start.v) /
      Math.hypot(line.end.u - line.start.u, line.end.v - line.start.v);
    for (
      let s = line.aoiStartS - plan.stats.baseM;
      s <= line.aoiEndS + plan.stats.baseM + 1e-9;
      s += plan.stats.baseM
    ) {
      const u = line.start.u + dirU * s;
      const vv = line.start.v + dirV * s;
      // Com Terrain Following o AGL é o do plano em cada foto; sem ele, a altitude é constante.
      const ground = terrain.elevation(u, vv);
      const shotAltM = tf ? ground + plan.params.heightM : altM;
      const agl = shotAltM - ground;
      const g = gsd(agl, pitch, focalM);
      const fp = footprint(agl, camera.sensorWidthMm / 1000, camera.sensorHeightMm / 1000, focalM);
      const blurPx = motionBlurPx(v, exposure, g);
      shots.push({
        i: shots.length,
        t: (t += plan.stats.intervalS),
        sortie: 0,
        lineIndex: line.index,
        u,
        v: vv,
        aglM: agl,
        altM: shotAltM,
        speedMs: v,
        headingRad: Math.atan2(dirV, dirU),
        crabRad: 0,
        tiltDeg: plan.params.obliqueDeg ?? 0,
        footprintWM: fp.widthM,
        footprintHM: fp.heightM,
        blurPx,
        skewPx: rollingShutterSkewPx(
          v,
          camera.shutter === 'ROLLING' ? camera.readoutS : undefined,
          g,
        ),
        blurred: blurPx > 1,
        lighting: plan.params.lighting,
        rtk: 'NONE',
        manual: false,
        overWater: false,
        inFog: false,
      });
    }
  }
  return {
    id: `${contract.id}-synthetic`,
    contractId: contract.id,
    createdAt: 0,
    rivalAdjustment: 1,
    isReplay: false,
    plan,
    groundPoints: overrides.groundPoints ?? referencePoints(contract, terrain),
    fieldEquipmentId: 'TOTAL_STATION',
    minigames: {},
    atlasCalibrated: false,
    sorties: [{ index: 0, outcome: 'COMPLETED', durationS: plan.stats.flightTimeS }],
    completedLines: plan.lines.map((l) => l.index),
    shots,
    events: { collisions: 0, crashes: 0, detected: false, featuresCaptured: [], ringsCollected: 0 },
    status: 'PENDING_PROCESSING',
    ...overrides,
  };
}

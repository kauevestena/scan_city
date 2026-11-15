/**
 * Planejador de voo — domain-math §2.6 e field-setup §5.3/§5.5.
 * Gera as linhas (zigue-zague, lead-in/out, malha cruzada) e as estatísticas do plano.
 */
import { STRINGS } from '@/data/strings';
import type { Catalog } from '@/data/catalog';
import { formatNumber } from '@/lib/format';
import { clamp } from '@/lib/math';
import type {
  Aircraft,
  CameraSensor,
  Contract,
  FlightLine,
  FlightPlan,
  LidarPayload,
  PlanParams,
  PlanStats,
  PlanValidation,
  SaveGame,
} from '@/types';
import { groundDensity, lidarDensityWithOverlap, lidarSwathM } from './lidar';
import {
  airBase,
  batteriesNeeded,
  exposureTimeS,
  flightTimeS,
  footprint,
  gsd,
  leadM,
  linePositions,
  lineSpacing,
  motionBlurPx,
  photosPerLine,
  pixelPitchM,
  planLineCount,
  realFocalM,
  rollingShutterSkewPx,
  shotInterval,
  turnTimeS,
} from './photogrammetry';

const DEG = Math.PI / 180;

/** Recorte do contrato de que o planejador precisa. */
export type PlannerContract = Pick<
  Contract,
  'aoi' | 'ceilingM' | 'wind' | 'lightingOptions' | 'recommended' | 'requirements'
>;

export type PlanInventory = Pick<
  SaveGame['inventory'],
  'aircraft' | 'sensors' | 'lenses' | 'payloads' | 'corn'
>;

export interface PlanOptions {
  /** Modificador `endurance` das skills (baterias necessárias). */
  enduranceMod?: number;
  /** Dossel médio da AOI, para a densidade de solo prevista. */
  meanCanopy?: number;
}

function find<T extends { id: string }>(
  items: readonly T[],
  id: string | undefined,
): T | undefined {
  return items.find((item) => item.id === id);
}

/** Câmera que faz as fotos: a própria, ou a RGB embutida no Pod LiDAR. */
function photoSensor(
  params: PlanParams,
  catalog: Catalog,
): { camera: CameraSensor; pod?: LidarPayload } {
  const pod = find(catalog.payloads, params.sensorId);
  const cameraId = pod ? pod.rgbSensorId : params.sensorId;
  const camera = find(catalog.sensors, cameraId);
  if (!camera) throw new RangeError(`Sensor desconhecido: ${params.sensorId}`);
  return pod ? { camera, pod } : { camera };
}

function buildLines(
  pass: FlightLine['pass'],
  alongM: number,
  acrossM: number,
  spacingM: number,
  lead: number,
  alongAxis: 'u' | 'v',
  firstIndex: number,
): FlightLine[] {
  const n = planLineCount(acrossM, spacingM);
  return linePositions(acrossM, spacingM, n).map((pos, k) => {
    const index = firstIndex + k;
    const direction: 1 | -1 = index % 2 === 0 ? 1 : -1;
    const a = alongAxis === 'u' ? { u: -lead, v: pos } : { u: pos, v: -lead };
    const b = alongAxis === 'u' ? { u: alongM + lead, v: pos } : { u: pos, v: alongM + lead };
    return {
      index,
      pass,
      start: direction === 1 ? a : b,
      end: direction === 1 ? b : a,
      aoiStartS: lead,
      aoiEndS: lead + alongM,
      direction,
    };
  });
}

/** Plano completo a partir dos parâmetros escolhidos no Field Setup. */
export function buildFlightPlan(
  params: PlanParams,
  contract: Pick<Contract, 'aoi'> & Partial<PlannerContract>,
  catalog: Catalog,
  opts: PlanOptions = {},
): FlightPlan {
  const aircraft = find(catalog.aircraft, params.aircraftId);
  if (!aircraft) throw new RangeError(`Aeronave desconhecida: ${params.aircraftId}`);
  const { camera, pod } = photoSensor(params, catalog);
  const lens = find(catalog.lenses, params.lensId);

  const focalM = realFocalM(camera, lens);
  const pitchM = pixelPitchM(camera);
  const H = params.heightM;
  const gsdM = gsd(H, pitchM, focalM);
  const fp = footprint(H, camera.sensorWidthMm / 1000, camera.sensorHeightMm / 1000, focalM);
  const baseM = airBase(fp.heightM, params.forwardOverlapPct);

  const swathM = pod ? lidarSwathM(H, pod.fovDeg * DEG) : undefined;
  const spacingM =
    pod && params.primarySensor === 'LIDAR' && swathM !== undefined
      ? lineSpacing(swathM, params.sideOverlapPct)
      : lineSpacing(fp.widthM, params.sideOverlapPct);

  const alongLength = params.orientation === 'ALONG_LENGTH';
  const alongM = alongLength ? contract.aoi.lengthM : contract.aoi.widthM;
  const acrossM = alongLength ? contract.aoi.widthM : contract.aoi.lengthM;
  const lead = leadM(aircraft);

  const lines = buildLines('PRIMARY', alongM, acrossM, spacingM, lead, alongLength ? 'u' : 'v', 0);
  if (params.crossGrid) {
    lines.push(
      ...buildLines(
        'CROSS',
        acrossM,
        alongM,
        spacingM,
        lead,
        alongLength ? 'v' : 'u',
        lines.length,
      ),
    );
  }

  const v = params.speedMs;
  const turnS = turnTimeS(aircraft, spacingM, v);
  const totalLengthM = lines.reduce((sum, l) => sum + (l.aoiEndS - l.aoiStartS) + 2 * lead, 0);
  const totalPhotos = lines.reduce(
    (sum, l) => sum + photosPerLine(l.aoiEndS - l.aoiStartS, baseM),
    0,
  );
  // Mesma fórmula de flightTimeS, com o comprimento somado de linhas de dois tamanhos.
  const flightS = flightTimeS(lines.length, totalLengthM / lines.length, v, turnS);

  const stats: PlanStats = {
    focalM,
    pixelPitchM: pitchM,
    gsdM,
    footprintWM: fp.widthM,
    footprintHM: fp.heightM,
    baseM,
    spacingM,
    intervalS: shotInterval(baseM, v),
    nLines: lines.length,
    photosPerLine: photosPerLine(alongM, baseM),
    totalPhotos,
    lineLengthM: alongM + 2 * lead,
    turnTimeS: turnS,
    flightTimeS: flightS,
    batteriesNeeded: batteriesNeeded(flightS, aircraft.enduranceS * (opts.enduranceMod ?? 1)),
    blurPx: motionBlurPx(v, exposureTimeS(params.lighting), gsdM),
    skewPx: rollingShutterSkewPx(
      v,
      camera.shutter === 'ROLLING' ? camera.readoutS : undefined,
      gsdM,
    ),
  };

  if (pod && swathM !== undefined) {
    // Densidade média = PRR/(v·S): a sobreposição efetiva entre faixas é 1 − S/faixa.
    const effectiveOverlapPct = (1 - spacingM / swathM) * 100;
    const density = lidarDensityWithOverlap(pod.prrHz, v, H, pod.fovDeg * DEG, effectiveOverlapPct);
    stats.lidarSwathM = swathM;
    stats.lidarDensity = density;
    stats.groundDensity = groundDensity(density, opts.meanCanopy ?? 0, pod.maxReturns);
  }

  return { params, lines, stats };
}

/** Energia disponível por missão, em surtidas: baterias (1 + reservas) ou papos de milho. */
function availableSorties(aircraft: Aircraft, inventory: PlanInventory): number {
  if (aircraft.energyUnit === 'CORN') {
    const units = inventory.corn.crop + inventory.corn.stock;
    return Math.floor(units / 10) + (units % 10 > 0 ? 1 : 0);
  }
  return 1 + aircraft.spareBatteries;
}

/** Bloqueios e avisos para decolar (field-setup §5.5). */
export function validatePlan(
  plan: FlightPlan,
  inventory: PlanInventory,
  contract: Pick<Contract, 'ceilingM' | 'wind'>,
  catalog: Pick<Catalog, 'aircraft'>,
): PlanValidation {
  const blocking: string[] = [];
  const warnings: string[] = [];
  const { params, stats } = plan;
  const aircraft = find(catalog.aircraft, params.aircraftId);

  if (!aircraft || !inventory.aircraft.includes(aircraft.id)) {
    blocking.push(STRINGS.plan.noAircraft);
    return { blocking, warnings };
  }

  const ownsSensor =
    params.sensorId === 'POD_LIDAR'
      ? inventory.payloads.includes('POD_LIDAR')
      : inventory.sensors.includes(params.sensorId);
  if (!aircraft.compatibleSensors.includes(params.sensorId) || !ownsSensor) {
    blocking.push(STRINGS.plan.sensorIncompatible(params.sensorId, aircraft.id));
  }

  const maxH = Math.min(aircraft.hMaxM, contract.ceilingM);
  if (params.heightM < aircraft.hMinM || params.heightM > maxH) {
    blocking.push(STRINGS.plan.heightOutOfRange(aircraft.hMinM, maxH));
  }

  if (plan.lines.length < 1 || stats.nLines < 1) blocking.push(STRINGS.plan.noLines);

  if (aircraft.energyUnit === 'CORN' && inventory.corn.crop + inventory.corn.stock <= 0) {
    blocking.push(STRINGS.plan.noCorn);
  }

  const needed = stats.batteriesNeeded;
  if (needed > 1) warnings.push(STRINGS.plan.sorties(needed));
  const available = availableSorties(aircraft, inventory);
  if (needed > available && blocking.length === 0) {
    warnings.push(STRINGS.plan.notEnoughEnergy(needed, available));
  }

  const peakWind = contract.wind.meanMs + contract.wind.gustMs;
  if (peakWind > aircraft.windToleranceMs) {
    warnings.push(
      STRINGS.plan.windAboveTolerance(
        formatNumber(peakWind, 1),
        formatNumber(aircraft.windToleranceMs, 1),
      ),
    );
  }

  return { blocking, warnings };
}

/** A aeronave atende aos requisitos críticos de tipo, tier e sensor? */
function meetsCritical(
  aircraft: Aircraft,
  contract: PlannerContract,
  owned: (sensorId: string) => boolean,
  catalog: Catalog,
): boolean {
  return contract.requirements.every((r) => {
    if (r.severity !== 'CRITICAL') return true;
    const check = r.check;
    if (check.type === 'AIRCRAFT_KIND') return aircraft.kind === check.value;
    if (check.type === 'MIN_AIRCRAFT_TIER') return aircraft.tier >= check.value;
    if (check.type === 'SENSOR_KIND') {
      return aircraft.compatibleSensors.some((id) => {
        if (!owned(id)) return false;
        if (id === 'POD_LIDAR') return check.value === 'LIDAR' || check.value === 'RGB';
        return find(catalog.sensors, id)?.kind === check.value;
      });
    }
    return true;
  });
}

/**
 * A aeronave atende aos requisitos **críticos** de tipo, tier e sensor do contrato com o
 * equipamento possuído? Na aba 2, a que não atende aparece desabilitada com o motivo.
 */
export function aircraftMeetsCritical(
  aircraft: Aircraft,
  contract: PlannerContract,
  inventory: PlanInventory,
  catalog: Catalog,
): boolean {
  const owned = (sensorId: string) =>
    sensorId === 'POD_LIDAR'
      ? inventory.payloads.includes('POD_LIDAR')
      : inventory.sensors.includes(sensorId);
  return meetsCritical(aircraft, contract, owned, catalog);
}

/** Parâmetros iniciais da aba "Plano de voo" (field-setup §5.3, "Padrões ao entrar"). */
export function defaultPlanParams(
  contract: PlannerContract,
  inventory: PlanInventory,
  catalog: Catalog,
): PlanParams {
  const owned = (sensorId: string) =>
    sensorId === 'POD_LIDAR'
      ? inventory.payloads.includes('POD_LIDAR')
      : inventory.sensors.includes(sensorId);
  const ownedAircraft = catalog.aircraft.filter((a) => inventory.aircraft.includes(a.id));
  const byTier = [...ownedAircraft].sort((a, b) => b.tier - a.tier);

  const aircraft =
    contract.recommended.aircraft
      .map((id) => ownedAircraft.find((a) => a.id === id))
      .find((a): a is Aircraft => a !== undefined) ??
    byTier.find((a) => meetsCritical(a, contract, owned, catalog)) ??
    (byTier[0] as Aircraft);

  const wantsLidar = contract.requirements.some(
    (r) => r.severity === 'CRITICAL' && r.check.type === 'SENSOR_KIND' && r.check.value === 'LIDAR',
  );
  const compatible = aircraft.compatibleSensors.filter(owned);
  const sensorId =
    (wantsLidar && compatible.includes('POD_LIDAR') ? 'POD_LIDAR' : undefined) ??
    contract.recommended.sensors.find((id) => compatible.includes(id)) ??
    compatible.find((id) => id !== 'POD_LIDAR') ??
    (compatible[0] as string);

  const camera = find(catalog.sensors, sensorId);
  const lensId =
    camera?.lensMount === 'INTERCHANGEABLE'
      ? catalog.lenses.find((l) => inventory.lenses.includes(l.id))?.id
      : undefined;

  const params: PlanParams = {
    aircraftId: aircraft.id,
    sensorId,
    primarySensor: sensorId === 'POD_LIDAR' ? 'LIDAR' : 'RGB',
    heightM: clamp(80, aircraft.hMinM, Math.min(aircraft.hMaxM, contract.ceilingM)),
    forwardOverlapPct: 75,
    sideOverlapPct: 65,
    speedMs: aircraft.vCruiseMs,
    orientation: 'ALONG_LENGTH',
    crossGrid: false,
    terrainFollowing: false,
    lighting: contract.lightingOptions[0] ?? 'SUN_HIGH',
  };
  return lensId ? { ...params, lensId } : params;
}

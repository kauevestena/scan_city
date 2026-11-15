/**
 * Edição dos parâmetros do plano no Field Setup (field-setup §5.3, §7): trocar a aeronave
 * ou o sensor mantém o plano coerente com o equipamento possuído.
 */
import { clamp } from '@/lib/math';
import type { Catalog } from '@/data/catalog';
import type { Aircraft, Lens, PlanParams } from '@/types';
import type { PlanInventory, PlannerContract } from './flightPlanner';

export interface ModeSupport {
  crossGrid: boolean;
  terrainFollowing: boolean;
  oblique: boolean;
}

/** Modos especiais que a aeronave aceita (REQ-FLD-012): malha cruzada em todas, exceto Atlas. */
export function modeSupport(
  aircraft: Pick<Aircraft, 'kind' | 'terrainFollowing' | 'gimbalTilt'>,
): ModeSupport {
  return {
    crossGrid: aircraft.kind !== 'BIRD',
    terrainFollowing: aircraft.terrainFollowing,
    oblique: aircraft.gimbalTilt,
  };
}

/** Limites dos sliders da aba 2 (REQ-FLD-006). */
export function planLimits(aircraft: Aircraft, contract: Pick<PlannerContract, 'ceilingM'>) {
  return {
    heightM: { min: aircraft.hMinM, max: Math.min(aircraft.hMaxM, contract.ceilingM) },
    forwardOverlapPct: { min: 60, max: 85 },
    sideOverlapPct: { min: 50, max: 80 },
    speedMs: { min: aircraft.vMinMs, max: aircraft.vMaxMs },
  };
}

function ownsSensor(inventory: PlanInventory, sensorId: string): boolean {
  return sensorId === 'POD_LIDAR'
    ? inventory.payloads.includes('POD_LIDAR')
    : inventory.sensors.includes(sensorId);
}

/** Sensores possuídos e compatíveis com a aeronave, na ordem do catálogo da aeronave. */
export function compatibleOwnedSensors(aircraft: Aircraft, inventory: PlanInventory): string[] {
  return aircraft.compatibleSensors.filter((id) => ownsSensor(inventory, id));
}

/** Lentes possuídas, se a câmera aceitar lentes intercambiáveis. */
export function ownedLenses(
  sensorId: string,
  inventory: PlanInventory,
  catalog: Catalog,
): Array<Lens['id']> {
  const camera = catalog.sensors.find((s) => s.id === sensorId);
  if (camera?.lensMount !== 'INTERCHANGEABLE') return [];
  return catalog.lenses.filter((l) => inventory.lenses.includes(l.id)).map((l) => l.id);
}

/** Troca o sensor: ajusta a lente e o sensor primário do espaçamento. */
export function withSensor(
  params: PlanParams,
  sensorId: string,
  inventory: PlanInventory,
  catalog: Catalog,
): PlanParams {
  const lenses = ownedLenses(sensorId, inventory, catalog);
  const lensId = params.lensId && lenses.includes(params.lensId) ? params.lensId : lenses[0];
  const next: PlanParams = {
    ...params,
    sensorId,
    primarySensor: sensorId === 'POD_LIDAR' ? 'LIDAR' : 'RGB',
  };
  delete next.lensId;
  return lensId ? { ...next, lensId } : next;
}

export interface AircraftChange {
  params: PlanParams;
  /** O sensor anterior não servia na aeronave nova e foi trocado (toast). */
  sensorChanged: boolean;
}

/**
 * Troca a aeronave: mantém o sensor se for compatível e possuído; senão, escolhe o
 * recomendado ou o primeiro compatível. H e v voltam aos limites (v = cruzeiro) e os modos
 * que a aeronave não aceita são desligados.
 */
export function withAircraft(
  params: PlanParams,
  aircraftId: string,
  contract: PlannerContract,
  inventory: PlanInventory,
  catalog: Catalog,
): AircraftChange {
  const aircraft = catalog.aircraft.find((a) => a.id === aircraftId);
  if (!aircraft) throw new RangeError(`Aeronave desconhecida: ${aircraftId}`);
  const compatible = compatibleOwnedSensors(aircraft, inventory);
  const keep = compatible.includes(params.sensorId);
  const sensorId = keep
    ? params.sensorId
    : (contract.recommended.sensors.find((id) => compatible.includes(id)) ??
      compatible.find((id) => id !== 'POD_LIDAR') ??
      compatible[0] ??
      params.sensorId);
  const limits = planLimits(aircraft, contract);
  const modes = modeSupport(aircraft);
  const next: PlanParams = {
    ...withSensor(params, sensorId, inventory, catalog),
    aircraftId: aircraft.id,
    heightM: clamp(params.heightM, limits.heightM.min, limits.heightM.max),
    speedMs: aircraft.vCruiseMs,
    crossGrid: params.crossGrid && modes.crossGrid,
    terrainFollowing: params.terrainFollowing && modes.terrainFollowing,
  };
  if (!modes.oblique) delete next.obliqueDeg;
  return { params: next, sensorChanged: !keep && sensorId !== params.sensorId };
}

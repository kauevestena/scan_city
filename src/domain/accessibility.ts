/**
 * Acessibilidade dos pontos de apoio (catalog §5, field-setup §6). Um ponto é inválido se:
 * 1. está na água; 2. está num telhado; 3. o dossel passa de 0,6 (sem visada aérea do alvo);
 * 4. nenhum veículo possuído alcança o ponto (rede, distância, declividade e brejo).
 * A regra `PAINT_MARKERS` (R11) ignora os itens 3 e 4: só água e telhado continuam inválidos
 * (contracts-real §1).
 */
import type { AoiPoint, Vehicle } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';

export type AccessReason = 'WATER' | 'ROOF' | 'CANOPY' | 'OUT_OF_REACH' | 'TOO_STEEP' | 'SWAMP';

export interface AccessResult {
  ok: boolean;
  reason?: AccessReason;
}

export interface AccessRules {
  /** Regra especial `PAINT_MARKERS`: marca pontos em qualquer parede. */
  paintMarkers: boolean;
}

export type AccessTerrain = Pick<
  TerrainSampler,
  'landCover' | 'canopy' | 'slopePct' | 'distanceToRoad' | 'distanceToTrack'
>;

export const MAX_GCP_CANOPY = 0.6;

type VehicleReach = Pick<Vehicle, 'gcpNetwork' | 'gcpReachM' | 'maxSlopePct' | 'allowSwamp'>;

/** Motivo pelo qual um veículo não alcança o ponto, ou `null` se alcança. */
function vehicleBlock(
  vehicle: VehicleReach,
  terrain: AccessTerrain,
  u: number,
  v: number,
  swamp: boolean,
): AccessReason | null {
  const distance =
    vehicle.gcpNetwork === 'ROADS' ? terrain.distanceToRoad(u, v) : terrain.distanceToTrack(u, v);
  if (distance > vehicle.gcpReachM) return 'OUT_OF_REACH';
  if (terrain.slopePct(u, v) > vehicle.maxSlopePct) return 'TOO_STEEP';
  if (swamp && !vehicle.allowSwamp) return 'SWAMP';
  return null;
}

export function isAccessible(
  u: number,
  v: number,
  terrain: AccessTerrain,
  vehicles: readonly VehicleReach[],
  rules: AccessRules,
): AccessResult {
  const cover = terrain.landCover(u, v);
  if (cover === 'WATER') return { ok: false, reason: 'WATER' };
  if (cover === 'ROOF') return { ok: false, reason: 'ROOF' };
  if (rules.paintMarkers) return { ok: true };
  if (terrain.canopy(u, v) > MAX_GCP_CANOPY) return { ok: false, reason: 'CANOPY' };

  // União sobre os veículos: basta um alcançar. O motivo mais próximo de dar certo é o relatado.
  const swamp = cover === 'SWAMP';
  const reasons = vehicles.map((vehicle) => vehicleBlock(vehicle, terrain, u, v, swamp));
  if (reasons.some((r) => r === null)) return { ok: true };
  const order: AccessReason[] = ['SWAMP', 'TOO_STEEP', 'OUT_OF_REACH'];
  return { ok: false, reason: order.find((r) => reasons.includes(r)) ?? 'OUT_OF_REACH' };
}

/** Passo radial da busca do ponto acessível mais próximo. */
const SNAP_STEP_M = 2;

/**
 * Ponto acessível mais próximo de `p`, num raio de até `maxR` (anéis de 2 m, 16 direções
 * por anel, ampliadas com o raio); `null` se não houver.
 */
export function snapToAccessible(
  p: AoiPoint,
  terrain: AccessTerrain,
  vehicles: readonly VehicleReach[],
  rules: AccessRules,
  maxR = 30,
): AoiPoint | null {
  if (isAccessible(p.u, p.v, terrain, vehicles, rules).ok) return p;
  for (let r = SNAP_STEP_M; r <= maxR + 1e-9; r += SNAP_STEP_M) {
    const steps = Math.max(16, Math.ceil((2 * Math.PI * r) / SNAP_STEP_M));
    for (let k = 0; k < steps; k++) {
      const a = (2 * Math.PI * k) / steps;
      const q = { u: p.u + r * Math.cos(a), v: p.v + r * Math.sin(a) };
      if (isAccessible(q.u, q.v, terrain, vehicles, rules).ok) return q;
    }
  }
  return null;
}

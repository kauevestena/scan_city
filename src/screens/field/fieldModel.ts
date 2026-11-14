/** Regras da aba "Pontos de apoio" (field-setup §5.2), sem React. */
import { getFieldEquipment, POINT_LIMITS } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { isAccessible, snapToAccessible, type AccessRules } from '@/domain/accessibility';
import { collinearityIndex, hullCoverage } from '@/domain/geometry';
import { formatNumber } from '@/lib/format';
import type { AoiPoint, Contract, FieldEquipmentId, GroundPoint, Vehicle } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';

const F = STRINGS.field;

export type PointTool = 'GCP' | 'CP' | 'ERASER';
export type Light = 'GREEN' | 'AMBER' | 'RED';

/** Mínimo de GCPs/CPs exigido pelo contrato (0 se não houver requisito). */
export function minimumPoints(
  contract: Pick<Contract, 'requirements'>,
  kind: GroundPoint['kind'],
): number {
  const type = kind === 'GCP' ? 'MIN_GCP' : 'MIN_CP';
  let min = 0;
  for (const r of contract.requirements) {
    if (r.check.type === type) min = Math.max(min, r.check.value);
  }
  return min;
}

export interface Distribution {
  gcps: number;
  cps: number;
  minGcp: number;
  minCp: number;
  /** Fração da AOI coberta pelo casco convexo dos GCPs. */
  coverage: number;
  /** λmin/λmax dos GCPs. */
  collinearity: number;
  light: Light;
  hint: string;
}

/** Indicador de distribuição (REQ-FLD-004): contadores, métricas, semáforo e dica. */
export function distribution(
  points: readonly GroundPoint[],
  contract: Pick<Contract, 'requirements' | 'aoi'>,
): Distribution {
  const gcpPoints = points.filter((p) => p.kind === 'GCP');
  const gcps = gcpPoints.length;
  const minGcp = Math.max(3, minimumPoints(contract, 'GCP'));
  const coverage = gcps >= 3 ? hullCoverage(gcpPoints, contract.aoi) : 0;
  const collinearity = gcps >= 3 ? collinearityIndex(gcpPoints) : 0;
  let light: Light;
  if (gcps < 3 || collinearity < 0.05) light = 'RED';
  else if (gcps >= minGcp && coverage >= 0.4 && collinearity >= 0.3) light = 'GREEN';
  else light = 'AMBER';
  let hint: string;
  if (gcps < 3) hint = F.hints.fewPoints;
  else if (collinearity < 0.3) hint = F.hints.collinear;
  else if (light !== 'GREEN') hint = F.hints.spread;
  else hint = F.hints.good;
  return {
    gcps,
    cps: points.length - gcps,
    minGcp,
    minCp: minimumPoints(contract, 'CP'),
    coverage,
    collinearity,
    light,
    hint,
  };
}

/**
 * Motivo da recusa de um ponto (REQ-FLD-003), já com os números: declividade e limite,
 * ou distância à via e alcance do melhor veículo. `null` se o ponto é válido.
 */
export function accessRefusal(
  u: number,
  v: number,
  terrain: TerrainSampler,
  vehicles: readonly Vehicle[],
  rules: AccessRules,
): string | null {
  const result = isAccessible(u, v, terrain, vehicles, rules);
  if (result.ok) return null;
  switch (result.reason) {
    case 'WATER':
    case 'ROOF':
    case 'CANOPY':
    case 'SWAMP':
      return F.access[result.reason];
    case 'TOO_STEEP': {
      const max = Math.max(...vehicles.map((x) => x.maxSlopePct));
      return F.access.TOO_STEEP(formatNumber(terrain.slopePct(u, v), 0), formatNumber(max, 0));
    }
    default: {
      const reach = Math.max(...vehicles.map((x) => x.gcpReachM));
      const trails = vehicles.some((x) => x.gcpNetwork !== 'ROADS');
      const distance = trails ? terrain.distanceToTrack(u, v) : terrain.distanceToRoad(u, v);
      return F.access.OUT_OF_REACH(formatNumber(distance, 0), formatNumber(reach, 0));
    }
  }
}

/** Próximo id livre: `GCP-01…`, `CP-01…`. */
export function nextPointId(points: readonly GroundPoint[], kind: GroundPoint['kind']): string {
  const used = new Set(points.map((p) => p.id));
  for (let n = 1; ; n++) {
    const id = `${kind}-${String(n).padStart(2, '0')}`;
    if (!used.has(id)) return id;
  }
}

/** Limites de pontos: o total e, opcionalmente, o de cada tipo. */
export interface PointLimits {
  maxPoints: number;
  gcp?: number;
  cp?: number;
}

/**
 * Limites do Field Setup (catalog §4): com o kit GNSS entre os equipamentos possuídos,
 * valem os dele (20 pontos, GCP ≤ 12, CP ≤ 8), seja qual for o instrumento de medição.
 */
export function pointLimits(owned: readonly FieldEquipmentId[]): Required<PointLimits> {
  const id: FieldEquipmentId = owned.includes('GNSS_RTK_KIT') ? 'GNSS_RTK_KIT' : 'TOTAL_STATION';
  return { maxPoints: getFieldEquipment(id).maxPoints, ...POINT_LIMITS[id] };
}

export type PlaceResult = { ok: true; points: GroundPoint[] } | { ok: false; reason: string };

/** Coloca um ponto (com o limite do instrumento e a acessibilidade). */
export function placePoint(
  points: readonly GroundPoint[],
  kind: GroundPoint['kind'],
  at: AoiPoint,
  terrain: TerrainSampler,
  vehicles: readonly Vehicle[],
  rules: AccessRules,
  limits: PointLimits,
): PlaceResult {
  if (points.length >= limits.maxPoints) return { ok: false, reason: F.limit(limits.maxPoints) };
  const perKind = kind === 'GCP' ? limits.gcp : limits.cp;
  if (perKind !== undefined && points.filter((p) => p.kind === kind).length >= perKind)
    return { ok: false, reason: F.limit(perKind) };
  const refusal = accessRefusal(at.u, at.v, terrain, vehicles, rules);
  if (refusal) return { ok: false, reason: refusal };
  const point: GroundPoint = {
    id: nextPointId(points, kind),
    kind,
    u: at.u,
    v: at.v,
    elevM: terrain.elevation(at.u, at.v),
    // O σ é calculado na decolagem (field-setup §5.4).
    sigmaM: 0,
  };
  return { ok: true, points: [...points, point] };
}

/** Move um ponto, revalidando a acessibilidade. */
export function movePoint(
  points: readonly GroundPoint[],
  id: string,
  to: AoiPoint,
  terrain: TerrainSampler,
  vehicles: readonly Vehicle[],
  rules: AccessRules,
): PlaceResult {
  const refusal = accessRefusal(to.u, to.v, terrain, vehicles, rules);
  if (refusal) return { ok: false, reason: refusal };
  return {
    ok: true,
    points: points.map((p) =>
      p.id === id ? { ...p, u: to.u, v: to.v, elevM: terrain.elevation(to.u, to.v) } : p,
    ),
  };
}

export function removePoint(points: readonly GroundPoint[], id: string): GroundPoint[] {
  return points.filter((p) => p.id !== id);
}

/**
 * Sugestão automática (só no C00): 5 GCPs nos cantos (recuo de 10 %) e no centro,
 * encaixados no ponto acessível mais próximo. Os CPs ficam; os GCPs são trocados.
 */
export function suggestGcps(
  points: readonly GroundPoint[],
  contract: Pick<Contract, 'aoi'>,
  terrain: TerrainSampler,
  vehicles: readonly Vehicle[],
  rules: AccessRules,
  limits: PointLimits,
): GroundPoint[] {
  const { lengthM, widthM } = contract.aoi;
  const iu = lengthM * 0.1;
  const iv = widthM * 0.1;
  const targets: AoiPoint[] = [
    { u: iu, v: iv },
    { u: lengthM - iu, v: iv },
    { u: lengthM - iu, v: widthM - iv },
    { u: iu, v: widthM - iv },
    { u: lengthM / 2, v: widthM / 2 },
  ];
  let next: GroundPoint[] = points.filter((p) => p.kind === 'CP');
  for (const target of targets) {
    if (next.length >= limits.maxPoints) break;
    const snapped = snapToAccessible(target, terrain, vehicles, rules);
    if (!snapped) continue;
    const placed = placePoint(next, 'GCP', snapped, terrain, vehicles, rules, limits);
    if (placed.ok) next = placed.points;
  }
  return next;
}

/** Faixa do slider de H em que o GSD passa do máximo do contrato (âmbar). */
export function heightWarnRange(
  contract: Pick<Contract, 'requirements'>,
  stats: { focalM: number; pixelPitchM: number },
  maxH: number,
): [number, number] | undefined {
  let maxGsdCm = Infinity;
  for (const r of contract.requirements) {
    if (r.check.type === 'MAX_GSD_CM') maxGsdCm = Math.min(maxGsdCm, r.check.value);
  }
  if (!Number.isFinite(maxGsdCm)) return undefined;
  const hCrit = ((maxGsdCm / 100) * stats.focalM) / stats.pixelPitchM;
  return hCrit < maxH ? [hCrit, maxH] : undefined;
}

/** Faixa abaixo do mínimo de sobreposição exigido (âmbar). */
export function overlapWarnRange(
  contract: Pick<Contract, 'requirements'>,
  type: 'MIN_FORWARD_OVERLAP' | 'MIN_SIDE_OVERLAP',
  min: number,
): [number, number] | undefined {
  let need = -Infinity;
  for (const r of contract.requirements) {
    if (r.check.type === type) need = Math.max(need, r.check.value);
  }
  return need > min ? [min, need - 1] : undefined;
}

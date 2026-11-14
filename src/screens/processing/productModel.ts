/** Modelo da aba Produtos (processing-results §5.7): disponibilidade e entradas dos rasters. */
import { CATALOG } from '@/data/catalog';
import { STRINGS } from '@/data/strings';
import { isShotValid } from '@/domain/coverage';
import { planEquipment } from '@/domain/requirements';
import {
  CANOPY_BLOCKS_GROUND,
  type ProductInputs,
  type ProductKind,
} from '@/engines/raster/products';
import { hashString } from '@/lib/rng';
import type { Contract, MissionData, QualityReport } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';

const U = STRINGS.processing.products.unavailable;

export interface ProductAvailability {
  available: boolean;
  /** Motivo, quando indisponível (tooltip da aba). */
  reason?: string;
}

const yes: ProductAvailability = { available: true };
const no = (reason: string): ProductAvailability => ({ available: false, reason });

/** Fotos que contam: sem borrão, névoa (RGB) nem reflexo na água. */
export function validPhotoCount(mission: MissionData, contract: Contract): number {
  const { camera } = planEquipment(mission.plan, CATALOG);
  const rules = {
    sensorKind: camera.kind,
    specularWater: contract.specialRules.includes('SPECULAR_WATER'),
  };
  return mission.shots.filter((s) => isShotValid(s, rules)).length;
}

/** A missão tem pulsos LiDAR registrados? */
export function hasLidarData(mission: MissionData): boolean {
  return (
    (mission.lidar?.grid.pulses.some((p) => p > 0) ?? false) ||
    (mission.lidar?.samples.length ?? 0) > 0
  );
}

/** Alguma célula coberta tem dossel abaixo do limite (solo visível para fotogrametria)? */
function hasOpenGround(
  report: QualityReport,
  contract: Contract,
  terrain: TerrainSampler,
): boolean {
  const { cols, rows, counts } = report.coverage;
  const excluded = new Set(report.coverage.excludedCells);
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const k = j * cols + i;
      if (excluded.has(k) || (counts[k] ?? 0) === 0) continue;
      const u = ((i + 0.5) / cols) * contract.aoi.lengthM;
      const v = ((j + 0.5) / rows) * contract.aoi.widthM;
      if (terrain.canopy(u, v) <= CANOPY_BLOCKS_GROUND) return true;
    }
  }
  return false;
}

/** Disponibilidade dos quatro rasters, com o motivo das abas bloqueadas. */
export function productAvailability(
  mission: MissionData,
  report: QualityReport,
  contract: Contract,
  terrain: TerrainSampler,
): Record<ProductKind, ProductAvailability> {
  const { camera } = planEquipment(mission.plan, CATALOG);
  const photos = validPhotoCount(mission, contract);
  const lidar = hasLidarData(mission);
  const rgbLike = camera.kind === 'RGB' || camera.kind === 'MULTISPECTRAL';
  return {
    ORTHO: photos > 0 && rgbLike ? yes : no(U.ORTHO),
    DSM: photos > 0 || lidar ? yes : no(U.DSM),
    DTM: lidar || (photos > 0 && hasOpenGround(report, contract, terrain)) ? yes : no(U.DTM),
    NDVI: camera.kind !== 'MULTISPECTRAL' ? no(U.NDVI) : photos > 0 ? yes : no(U.NDVI_NO_PHOTOS),
  };
}

/** Entradas dos rasters: cobertura e RMSE do relatório, iluminação e LiDAR da missão. */
export function productInputs(
  mission: MissionData,
  report: QualityReport,
  terrain: TerrainSampler,
): ProductInputs {
  const grid = mission.lidar?.grid;
  const base: ProductInputs = {
    terrain,
    coverage: report.coverage,
    lighting: mission.plan.params.lighting,
    // Sem CPs, vale o RMSE dos GCPs (processing-results: "não verificável").
    rmseZM: (report.rmse.cp ?? report.rmse.gcp).z,
    seed: hashString(mission.id),
  };
  return grid ? { ...base, lidarGroundDensity: grid.ground.map((g) => g / grid.cellAreaM2) } : base;
}

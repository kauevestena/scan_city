import { CATALOG } from '@/data/catalog';
import {
  referenceParams,
  referencePoints,
  syntheticMission as build,
} from '@/domain/referencePlan';
import type { Contract, MissionData } from '@/types';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';

export { referenceParams, referencePoints };

/**
 * Missão "perfeita" do plano de referência: fotos disparadas a cada base, na janela da
 * câmera (AOI ± 1 base), a altitude constante sobre a cota média da AOI, sem ruído.
 */
export function syntheticMission(
  contract: Contract,
  terrain: TerrainSampler,
  overrides: Partial<MissionData> = {},
): MissionData {
  return build(contract, terrain, CATALOG, overrides);
}

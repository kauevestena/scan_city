import { useMemo } from 'react';
import { CATALOG, getAircraft, getFieldEquipment, getVehicle } from '@/data/catalog';
import { getContract } from '@/data/contracts';
import type { PredictContext } from '@/domain/requirements';
import { meanCanopy } from '@/engines/field/satellite';
import { selectModifiers } from '@/state/selectors';
import { useGameStore } from '@/state/store';
import type { Contract, FieldEquipment, MissionData, Vehicle } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';
import type { TerrainSampler } from '@/world/terrain/TerrainSampler';

export interface FieldContext {
  mission: MissionData;
  contract: Contract;
  /** O mesmo sampler memoizado do voo (REQ-FLD-001). */
  terrain: TerrainSampler;
  vehicles: Vehicle[];
  rules: { paintMarkers: boolean };
  equipment: FieldEquipment;
  predict: PredictContext;
  meanCanopy: number;
}

/** Dados derivados da missão em planejamento, compartilhados pelas abas. */
export function useFieldContext(mission: MissionData): FieldContext {
  const inventory = useGameStore((s) => s.inventory);
  const mods = useGameStore(selectModifiers);
  const contract = getContract(mission.contractId);
  const terrain = createTerrain(contract);
  const vehicles = useMemo(() => inventory.vehicles.map(getVehicle), [inventory.vehicles]);
  const atlas = getAircraft(mission.plan.params.aircraftId).energyUnit === 'CORN';
  return {
    mission,
    contract,
    terrain,
    vehicles,
    rules: { paintMarkers: contract.specialRules.includes('PAINT_MARKERS') },
    equipment: getFieldEquipment(mission.fieldEquipmentId),
    predict: {
      catalog: CATALOG,
      ownsRtkKit: inventory.fieldEquipment.includes('GNSS_RTK_KIT'),
      fieldEquipmentId: mission.fieldEquipmentId,
      levelScore: mission.minigames.levelScore,
      imuScore: mission.minigames.imuScore,
      atlasCalibrated: atlas && inventory.atlasCalibrationFlights > 0,
      mods,
    },
    meanCanopy: meanCanopy(terrain),
  };
}

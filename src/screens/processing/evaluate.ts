/** LOADING (processing-results §3): avalia a missão com o estado atual, de forma determinística. */
import { CATALOG, getHardware, getVehicle } from '@/data/catalog';
import { getContract } from '@/data/contracts';
import { computePayment, computeRewards } from '@/domain/economy';
import { evaluateMission } from '@/domain/mission';
import { hashString, mulberry32 } from '@/lib/rng';
import { selectModifiers } from '@/state/selectors';
import type { GameData } from '@/state/types';
import type { MissionData, QualityReport } from '@/types';
import { createTerrain } from '@/world/terrain/createTerrain';

/** A missão do payload: na fila (escritório) ou a ativa (em campo, com a Van). */
export function findMissionToProcess(state: GameData, missionId: string): MissionData | null {
  return (
    state.mission.pending.find((m) => m.id === missionId) ??
    (state.mission.active?.id === missionId ? state.mission.active : null)
  );
}

/** Relatório da missão; o RNG é seedado pelo id, então recarregar dá o mesmo resultado. */
export function evaluateForState(
  state: GameData,
  mission: MissionData,
  inField: boolean,
): QualityReport {
  const contract = getContract(mission.contractId);
  const progress = state.contracts[contract.id];
  const ownsVan = state.inventory.vehicles.includes('LAB_VAN');
  return evaluateMission(mission, contract, {
    catalog: CATALOG,
    terrain: createTerrain(contract),
    ownsRtkKit: state.inventory.fieldEquipment.includes('GNSS_RTK_KIT'),
    modifiers: selectModifiers(state),
    staff: state.staff,
    hardware: getHardware(state.inventory.hardware),
    inField,
    ...(ownsVan ? { van: getVehicle('LAB_VAN') } : {}),
    firstApproval: (progress?.completions ?? 0) === 0,
    rng: mulberry32(hashString(mission.id)),
    deps: { computePayment, computeRewards },
  });
}

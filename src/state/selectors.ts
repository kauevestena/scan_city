import { museumIncomePerMin } from '@/domain/museum';
import { applyModifiers } from '@/domain/modifiers';
import type { ContractStatus, MissionData, ModifierSet, ScreenId, VehicleId } from '@/types';
import type { GameData } from './types';

export const selectScreen = (s: GameData): ScreenId => s.session.screen;
export const selectPaused = (s: GameData): boolean => s.session.paused;
export const selectMoney = (s: GameData): number => s.player.money;

export const selectOwnsVehicle =
  (id: VehicleId) =>
  (s: GameData): boolean =>
    s.inventory.vehicles.includes(id);

export const selectPendingMission =
  (missionId: string) =>
  (s: GameData): MissionData | undefined =>
    s.mission.pending.find((m) => m.id === missionId);

let lastContracts: GameData['contracts'] | null = null;
let lastStatus: ContractStatus | null = null;
let lastIds: string[] = [];

/** Ids dos contratos em um status, memoizado pela identidade de `contracts`. */
export const selectContractIdsByStatus =
  (status: ContractStatus) =>
  (s: GameData): string[] => {
    if (s.contracts !== lastContracts || status !== lastStatus) {
      lastContracts = s.contracts;
      lastStatus = status;
      lastIds = Object.keys(s.contracts)
        .filter((id) => s.contracts[id]?.status === status)
        .sort();
    }
    return lastIds;
  };

let lastSkills: readonly string[] | null = null;
let lastModifiers: ModifierSet | null = null;

/** Modificadores das habilidades, memoizados pela identidade de `skills`. */
export const selectModifiers = (s: GameData): ModifierSet => {
  if (s.skills !== lastSkills || lastModifiers === null) {
    lastSkills = s.skills;
    lastModifiers = applyModifiers(s.skills);
  }
  return lastModifiers;
};

/** Renda do museu em centavos por minuto (pode ser fracionária). */
export const selectMuseumIncome = (s: GameData): number =>
  museumIncomePerMin(s.museum.sectors, s.museum.featured, selectModifiers(s).museumVisitors);

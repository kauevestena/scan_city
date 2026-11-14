/** Surtidas (survey-flight §5.12): quando há "Nova surtida" e como o Atlas se alimenta. */
import type { Aircraft, MissionData, SaveGame } from '@/types';

/** Unidades de milho no papo cheio (1 unidade = 60 s de voo do Atlas). */
export const CROP_CAPACITY = 10;

export type SortieInventory = Pick<SaveGame['inventory'], 'corn'>;

/** Baterias restantes nesta missão: `1 + reservas − surtidas já voadas` (não vale para o Atlas). */
export function batteriesLeft(
  mission: Pick<MissionData, 'sorties'>,
  aircraft: Pick<Aircraft, 'spareBatteries'>,
): number {
  return 1 + aircraft.spareBatteries - mission.sorties.length;
}

/**
 * "Nova surtida" aparece se houver linhas incompletas e energia reserva: baterias
 * restantes (multirrotor e asa fixa) ou estoque de milho > 0 (Atlas, que enche o papo).
 */
export function canStartNewSortie(
  mission: Pick<MissionData, 'sorties' | 'completedLines' | 'plan'>,
  aircraft: Pick<Aircraft, 'energyUnit' | 'spareBatteries'>,
  inventory: SortieInventory,
): boolean {
  const incomplete = mission.plan.lines.some((l) => !mission.completedLines.includes(l.index));
  if (!incomplete) return false;
  return aircraft.energyUnit === 'CORN'
    ? inventory.corn.stock > 0
    : batteriesLeft(mission, aircraft) > 0;
}

/** Alimenta o Atlas: o papo enche com o estoque (até 10 unidades). */
export function feedCrop(corn: SortieInventory['corn']): SortieInventory['corn'] {
  const moved = Math.min(CROP_CAPACITY - corn.crop, corn.stock);
  return { stock: corn.stock - moved, crop: corn.crop + moved };
}

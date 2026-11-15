/** XP, níveis, desbloqueios e reputação — domain-math §12.2, progression §6, §9 e §12. */
import { CAMPAIGN_FINALE } from '@/data/cosmetics';
import { STRINGS } from '@/data/strings';
import { clamp } from '@/lib/math';
import type { SaveGame, SkillNode, UnlockCondition } from '@/types';

/** XP para passar do nível `level` ao próximo: round(100 · level^1,5). */
export function xpToNext(level: number): number {
  return Math.round(100 * level ** 1.5);
}

export interface LevelState {
  xp: number;
  level: number;
  skillPoints: number;
}

/** Soma XP e sobe quantos níveis couberem; +1 ponto de habilidade por nível. */
export function addXp<T extends LevelState>(
  player: T,
  amount: number,
): T & { levelsGained: number } {
  let { xp, level, skillPoints } = player;
  xp += Math.max(0, amount);
  let levelsGained = 0;
  while (xp >= xpToNext(level)) {
    xp -= xpToNext(level);
    level += 1;
    skillPoints += 1;
    levelsGained += 1;
  }
  return { ...player, xp, level, skillPoints, levelsGained };
}

/** Pode adquirir a habilidade? Pontos suficientes e pré-requisito adquirido. */
export function canUnlockSkill(
  node: SkillNode,
  skillPoints: number,
  owned: readonly string[],
): boolean {
  if (owned.includes(node.id)) return false;
  if (node.requires && !owned.includes(node.requires)) return false;
  return skillPoints >= node.cost;
}

/** O que `evaluateUnlock` precisa saber do jogador. */
export interface UnlockState {
  completedContracts: ReadonlySet<string>;
  level: number;
  reputation: number;
  ownedItems: ReadonlySet<string>;
  riftsDone: number;
}

/** Monta o estado de desbloqueio a partir do save. */
export function unlockStateFrom(
  save: Pick<SaveGame, 'contracts' | 'player' | 'inventory'>,
): UnlockState {
  const completed = Object.entries(save.contracts)
    .filter(([, p]) => p.status === 'COMPLETED' || p.completions > 0)
    .map(([id]) => id);
  const inv = save.inventory;
  return {
    completedContracts: new Set(completed),
    level: save.player.level,
    reputation: save.player.reputation,
    ownedItems: new Set([
      ...inv.aircraft,
      ...inv.sensors,
      ...inv.lenses,
      ...inv.payloads,
      ...inv.vehicles,
      ...inv.fieldEquipment,
      inv.hardware,
      ...inv.cosmetics,
    ]),
    riftsDone: completed.filter((id) => id.startsWith('R')).length,
  };
}

/**
 * O final da campanha (REQ-CNT-008) é devido quando a introdução já foi vista, o final ainda não
 * e os 7 contratos reais estão concluídos: ele aparece uma única vez, ao entrar no escritório.
 */
export function finaleDue(
  save: Pick<SaveGame, 'contracts' | 'player' | 'inventory' | 'flags'>,
): boolean {
  return (
    save.flags.introSeen &&
    !save.flags.finaleSeen &&
    evaluateUnlock(CAMPAIGN_FINALE, unlockStateFrom(save))
  );
}

/** Avalia uma condição de desbloqueio (recursiva em `ALL`/`ANY`). */
export function evaluateUnlock(cond: UnlockCondition, state: UnlockState): boolean {
  switch (cond.type) {
    case 'ALWAYS':
      return true;
    case 'CONTRACT_DONE':
      return state.completedContracts.has(cond.contractId);
    case 'REPUTATION':
      return state.reputation >= cond.min;
    case 'LEVEL':
      return state.level >= cond.min;
    case 'OWNS':
      return state.ownedItems.has(cond.itemId);
    case 'RIFTS_DONE':
      return state.riftsDone >= cond.count;
    case 'ALL':
      return cond.of.every((c) => evaluateUnlock(c, state));
    case 'ANY':
      return cond.of.some((c) => evaluateUnlock(c, state));
  }
}

/** Texto pt-BR de uma condição (ex.: "concluir o contrato C03 e reputação 65"). */
export function describeUnlock(
  cond: UnlockCondition,
  itemName: (id: string) => string = (id) => id,
): string {
  const U = STRINGS.unlock;
  switch (cond.type) {
    case 'ALWAYS':
      return U.always;
    case 'CONTRACT_DONE':
      return U.contract(cond.contractId);
    case 'REPUTATION':
      return U.reputation(cond.min);
    case 'LEVEL':
      return U.level(cond.min);
    case 'OWNS':
      return U.owns(itemName(cond.itemId));
    case 'RIFTS_DONE':
      return U.rifts(cond.count);
    case 'ALL':
      return U.all(cond.of.map((c) => describeUnlock(c, itemName)));
    case 'ANY':
      return U.any(cond.of.map((c) => describeUnlock(c, itemName)));
  }
}

/** Ganhos positivos de reputação são multiplicados por `reputationGain`; perdas, não. */
export function scaleReputationGain(delta: number, reputationGainMod: number): number {
  return delta > 0 ? Math.round(delta * reputationGainMod) : delta;
}

/** Reputação fica entre 0 e 100. */
export function applyReputation(current: number, delta: number): number {
  return clamp(current + delta, 0, 100);
}

/** Faixa exibida: 0–29, 30–49, 50–69, 70–89, 90–100. */
export function reputationBand(reputation: number): string {
  const bands = STRINGS.progression.reputationBands;
  const index =
    reputation >= 90 ? 4 : reputation >= 70 ? 3 : reputation >= 50 ? 2 : reputation >= 30 ? 1 : 0;
  return bands[index] as string;
}

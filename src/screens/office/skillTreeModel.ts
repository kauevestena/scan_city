/** Modelo da árvore de habilidades (office §5, progression §6): estado e motivo de cada nó. */
import { SKILL_BRANCH_NAMES, SKILLS } from '@/data/skills';
import { STRINGS } from '@/data/strings';
import { canUnlockSkill } from '@/domain/progression';
import type { SkillBranch, SkillNode } from '@/types';

const C = STRINGS.office.career;

export const SKILL_BRANCHES: readonly SkillBranch[] = ['PILOT', 'ENGINEERING', 'MANAGEMENT'];

export type SkillState = 'ACQUIRED' | 'AVAILABLE' | 'LOCKED';

export interface SkillView {
  node: SkillNode;
  state: SkillState;
  /** Por que está bloqueado ("Requer <nó>" ou "Faltam N pontos"). */
  reason?: string;
}

/** Os 4 nós de um ramo, em ordem de rank. */
export function branchNodes(branch: SkillBranch): SkillNode[] {
  return SKILLS.filter((n) => n.branch === branch).sort((a, b) => a.rank - b.rank);
}

/** Estado do nó: adquirido, disponível (pontos e pré-requisito) ou bloqueado, com o motivo. */
export function skillView(
  node: SkillNode,
  skillPoints: number,
  owned: readonly string[],
): SkillView {
  if (owned.includes(node.id)) return { node, state: 'ACQUIRED' };
  if (canUnlockSkill(node, skillPoints, owned)) return { node, state: 'AVAILABLE' };
  if (node.requires && !owned.includes(node.requires)) {
    const previous = SKILLS.find((n) => n.id === node.requires);
    return { node, state: 'LOCKED', reason: C.needsPrevious(previous?.name ?? node.requires) };
  }
  return { node, state: 'LOCKED', reason: C.needsPoints(node.cost - skillPoints) };
}

export { SKILL_BRANCH_NAMES };

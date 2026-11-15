/** Modificadores das habilidades (progression §6, catalog §9). */
import { SKILLS } from '@/data/skills';
import type { ModifierKey, ModifierSet, SkillNode } from '@/types';

export const MODIFIER_KEYS: readonly ModifierKey[] = [
  'windDrift',
  'endurance',
  'overworldSpeed',
  'thermalEffect',
  'rmseGlobal',
  'texturePenalty',
  'lidarNoise',
  'rollingShutterPenalty',
  'contractPayment',
  'museumVisitors',
  'shopPrice',
  'reputationGain',
  'rivalChance',
];

/** Conjunto neutro: todos os multiplicadores em 1. */
export function neutralModifiers(): ModifierSet {
  return Object.fromEntries(MODIFIER_KEYS.map((k) => [k, 1])) as ModifierSet;
}

/** Modificadores das habilidades adquiridas: começa em 1; `mul` multiplica e `add` soma. */
export function applyModifiers(
  skillIds: readonly string[],
  nodes: readonly SkillNode[] = SKILLS,
): ModifierSet {
  const set = neutralModifiers();
  for (const id of skillIds) {
    const node = nodes.find((n) => n.id === id);
    if (!node) continue;
    for (const effect of node.effects) {
      set[effect.key] =
        effect.op === 'mul' ? set[effect.key] * effect.value : set[effect.key] + effect.value;
    }
  }
  return set;
}

/** Modificadores das habilidades (progression §6). */
import type { ModifierKey, ModifierSet } from '@/types';

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

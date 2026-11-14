// data-model §3 — Progressão
import type { CentsBRL } from './basics';

export type ModifierKey =
  | 'windDrift'
  | 'endurance'
  | 'overworldSpeed'
  | 'thermalEffect'
  | 'rmseGlobal'
  | 'texturePenalty'
  | 'lidarNoise'
  | 'rollingShutterPenalty'
  | 'contractPayment'
  | 'museumVisitors'
  | 'shopPrice'
  | 'reputationGain'
  | 'rivalChance';

export interface Modifier {
  key: ModifierKey;
  op: 'mul' | 'add';
  value: number;
}
/** Multiplicadores finais (base 1). */
export type ModifierSet = Record<ModifierKey, number>;

export type SkillBranch = 'PILOT' | 'ENGINEERING' | 'MANAGEMENT';
export interface SkillNode {
  /** 'PIL_1' … 'GES_4'. */
  id: string;
  branch: SkillBranch;
  rank: 1 | 2 | 3 | 4;
  name: string;
  description: string;
  /** Pontos. */
  cost: number;
  /** Nó anterior do ramo. */
  requires?: string;
  effects: readonly Modifier[];
}

export type CosmeticSlot = 'CHARACTER' | 'DRONE_PAINT' | 'ATLAS_ACCESSORY';
export interface Cosmetic {
  id: string;
  slot: CosmeticSlot;
  name: string;
  /** 0 = só por desbloqueio. */
  priceBRL: CentsBRL;
  unlock?: UnlockCondition;
  /** Hex (exceção permitida: dados de cosmético). */
  colors: { primary: string; secondary: string };
}

export type EmblemShape = 'SHIELD' | 'CIRCLE' | 'HEXAGON' | 'DIAMOND';
export type EmblemIcon =
  'Compass' | 'Map' | 'Mountain' | 'Plane' | 'Bird' | 'Satellite' | 'Ruler' | 'Globe';
export interface Emblem {
  shape: EmblemShape;
  icon: EmblemIcon;
  primary: string;
  secondary: string;
  /** ≤ 4 caracteres. */
  initials: string;
}

export interface Souvenir {
  id: string;
  contractId: string;
  name: string;
  story: string;
  /** Nome lucide. */
  icon: string;
  color: string;
}

export type UnlockCondition =
  | { type: 'ALWAYS' }
  | { type: 'CONTRACT_DONE'; contractId: string }
  | { type: 'REPUTATION'; min: number }
  | { type: 'LEVEL'; min: number }
  | { type: 'OWNS'; itemId: string }
  | { type: 'RIFTS_DONE'; count: number }
  | { type: 'ALL'; of: readonly UnlockCondition[] }
  | { type: 'ANY'; of: readonly UnlockCondition[] };

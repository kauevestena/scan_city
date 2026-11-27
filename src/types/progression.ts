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

/** Como se examina um souvenir (office §5.1, ADR-036): um objeto que se vira ou um caderno. */
export type SouvenirForm = 'OBJECT' | 'BOOK';

/**
 * Onde a face é desenhada: o próprio souvenir (`OBJECT`, a capa e a contracapa do caderno) ou um
 * papel ou uma placa com texto.
 */
export type SouvenirSurface =
  'OBJECT' | 'COVER' | 'BACK_COVER' | 'PAGE' | 'TAG' | 'NOTE' | 'CARD' | 'LABEL' | 'PLAQUE' | 'MAP';

/** Tinta de um bloco: à mão (grafite, caneta azul-escura, caneta vermelha), impressa ou gravada. */
export type SouvenirInk = 'PENCIL' | 'INK' | 'RED' | 'PRINT' | 'ENGRAVED';

/** Pauta da página da caderneta. */
export type SouvenirPaper = 'RULED' | 'GRID' | 'PLAIN';

/** Esboços desenhados no papel (engines/souvenir/sketches.ts). */
export type SouvenirSketchId =
  | 'SITE_SURVEY'
  | 'ATLAS'
  | 'TOTAL_STATION'
  | 'GSD'
  | 'MUSEUM'
  | 'IPE_FLOWER'
  | 'COAST_1890'
  | 'TRIANGULATION';

/** Marcas do uso: manchas de café, digital, pena, grão de milho, fita adesiva, dobra. */
export type SouvenirDecor =
  'COFFEE_RING' | 'COFFEE_DROPS' | 'THUMBPRINT' | 'FEATHER' | 'CORN_KERNEL' | 'TAPE' | 'FOLD';

/**
 * Um bloco de conteúdo de uma face, em px lógicos da superfície (a página tem 400 × 580). No
 * texto, `~~riscado~~` e `__sublinhado__`.
 */
export type SouvenirBlock =
  | { type: 'TITLE'; text: string; ink?: SouvenirInk }
  | {
      type: 'TEXT';
      text: string;
      ink?: SouvenirInk;
      size?: 'SM' | 'MD' | 'LG';
      align?: 'LEFT' | 'CENTER' | 'RIGHT';
    }
  | { type: 'LIST'; items: readonly string[]; ordered?: boolean; ink?: SouvenirInk }
  | {
      type: 'TABLE';
      columns: readonly string[];
      rows: readonly (readonly string[])[];
      /** Frações da largura útil; somam 1. */
      widths: readonly number[];
      ink?: SouvenirInk;
    }
  /** Rótulo impresso e valor à mão, como numa ficha. */
  | {
      type: 'FIELDS';
      rows: readonly (readonly [label: string, value: string])[];
      ink?: SouvenirInk;
    }
  /** `labels`: os rótulos dos pontos do esboço, na ordem dele. */
  | { type: 'SKETCH'; sketch: SouvenirSketchId; height: number; labels?: readonly string[] }
  | { type: 'SIGNATURE'; text: string; ink?: SouvenirInk }
  | { type: 'STAMP'; text: string }
  | { type: 'GAP'; size: number };

export interface SouvenirFace {
  /** Rótulo curto ("Capa", "Etiqueta", "Verso"): rodapé do exame e leitor de tela. */
  label: string;
  surface: SouvenirSurface;
  blocks: readonly SouvenirBlock[];
  paper?: SouvenirPaper;
  decor?: readonly SouvenirDecor[];
  /** Versões excludentes da mesma face: a contracapa antes e depois do final. */
  when?: 'BEFORE_FINALE' | 'AFTER_FINALE';
}

export interface Souvenir {
  id: string;
  contractId: string;
  name: string;
  story: string;
  /** Nome lucide: só quando o navegador não tem Canvas 2D (ADR-027). */
  icon: string;
  color: string;
  form: SouvenirForm;
  /** A primeira é o objeto (`OBJECT`) ou a capa (`COVER`); as outras, o que se lê nele. */
  faces: readonly SouvenirFace[];
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

// data-model §1 — Básicos

export type Vec2 = { x: number; y: number };
export type Vec3 = { x: number; y: number; z: number };
/** Metros, no frame da AOI (architecture §5). */
export type AoiPoint = { u: number; v: number };
/** Centavos inteiros. */
export type CentsBRL = number;
/** Componentes 0..255. */
export type Rgb = readonly [number, number, number];

export type ScreenId =
  | 'OFFICE'
  | 'WORLD_MAP'
  | 'FIELD_SETUP'
  | 'SURVEY_FLIGHT'
  | 'PROCESSING_RESULTS'
  | 'HOLO_TABLE_VIEW'
  | 'INFOGRAPHIC_LAB';
export type Dimension = 'REAL' | 'RIFT';

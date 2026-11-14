import type { Lens } from '@/types';
import { brl } from './money';

/** catalog §1 — Lentes (focal equivalente, ADR-005). Só para câmeras `INTERCHANGEABLE`. */
export const LENSES: readonly Lens[] = [
  { id: 'LENS_35', name: 'Lente 35 mm', equivFocalMm: 35, priceBRL: brl(6_000) },
  { id: 'LENS_24', name: 'Lente 24 mm Grande-Angular', equivFocalMm: 24, priceBRL: brl(6_000) },
];

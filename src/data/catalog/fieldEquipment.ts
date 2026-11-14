import type { FieldEquipment, FieldEquipmentId } from '@/types';
import { brl } from './money';

/** catalog §4 — Equipamento de campo (ADR-019). */
export const FIELD_EQUIPMENT: readonly FieldEquipment[] = [
  {
    id: 'TOTAL_STATION',
    name: 'Estação Total do Avô',
    sigmaBaseM: 0.01,
    maxPoints: 8,
    providesRtkCorrections: false,
    priceBRL: 0,
  },
  {
    id: 'GNSS_RTK_KIT',
    name: 'Kit GNSS RTK Base + Rover',
    sigmaBaseM: 0.015,
    maxPoints: 20,
    providesRtkCorrections: true,
    priceBRL: brl(15_000),
  },
];

/** Limites por tipo de ponto; o total é `maxPoints`. */
export const POINT_LIMITS: Record<FieldEquipmentId, { gcp: number; cp: number }> = {
  TOTAL_STATION: { gcp: 8, cp: 8 },
  GNSS_RTK_KIT: { gcp: 12, cp: 8 },
};

/** O GNSS mede a altitude com σ 1,5 × o planimétrico (catalog §4: "z × 1,5"). */
export const SIGMA_Z_FACTOR: Record<FieldEquipmentId, number> = {
  TOTAL_STATION: 1,
  GNSS_RTK_KIT: 1.5,
};

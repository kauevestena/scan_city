import type { StaffRole } from '@/types';
import { brl } from './money';

/** catalog §7 — Equipe. Demitir não tem custo nem reembolso. */
export const STAFF: readonly StaffRole[] = [
  {
    id: 'INTERN',
    name: 'Estagiário(a)',
    hireCostBRL: brl(1_500),
    costPerContractBRL: brl(500),
    paymentBonus: 0.06,
    processingSpeedBonus: 0.05,
    maxCount: 3,
  },
  {
    id: 'JUNIOR_ENG',
    name: 'Engenheiro(a) Júnior',
    hireCostBRL: brl(6_000),
    costPerContractBRL: brl(1_800),
    paymentBonus: 0.15,
    processingSpeedBonus: 0.1,
    maxCount: 2,
  },
];

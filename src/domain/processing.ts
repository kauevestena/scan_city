/** Processamento — domain-math §12.4 (tempo da esteira SfM). */
import type { Hardware, StaffRole, StaffRoleId, Vehicle } from '@/types';

/** Peso de cada uma das 6 etapas da esteira no tempo total. */
export const STAGE_WEIGHTS = [0.15, 0.2, 0.2, 0.25, 0.1, 0.1] as const;

/** Tempo-base em segundos: 6 + 0,08·fotos + 0,12·(pulsos/10⁶). */
export function processingBaseTimeS(nPhotos: number, nPulses: number): number {
  return 6 + 0.08 * nPhotos + 0.12 * (nPulses / 1e6);
}

/** Fator de velocidade: hardware (ou Van em campo) × (1 + bônus da equipe). */
export function processingSpeed(
  hardware: Pick<Hardware, 'speedFactor'>,
  staff: Partial<Record<StaffRoleId, number>>,
  roles: readonly Pick<StaffRole, 'id' | 'processingSpeedBonus'>[],
  inField: boolean,
  van?: Pick<Vehicle, 'fieldSpeedFactor'>,
): number {
  const machine = inField
    ? Math.max(hardware.speedFactor, van?.fieldSpeedFactor ?? hardware.speedFactor)
    : hardware.speedFactor;
  const bonus = roles.reduce((s, r) => s + r.processingSpeedBonus * (staff[r.id] ?? 0), 0);
  return machine * (1 + bonus);
}

export function processingTimeS(baseS: number, speed: number): number {
  return baseS / speed;
}

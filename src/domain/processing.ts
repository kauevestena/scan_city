/** Processamento — domain-math §12.4 (tempo da esteira SfM). */
import type { Rng } from '@/lib/rng';
import type {
  CameraSensor,
  Hardware,
  LensCalibration,
  StaffRole,
  StaffRoleId,
  Vehicle,
} from '@/types';

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

/** Distorção radial de base por câmera (domain-math §12.4). */
export const LENS_DISTORTION_BASE: Readonly<Record<string, { k1: number; k2: number }>> = {
  CAM_PIGEON: { k1: -0.12, k2: 0.03 },
  CAM_20MP_RS: { k1: -0.012, k2: 0.004 },
  CAM_45MP_FF: { k1: -0.004, k2: 0.001 },
  CAM_MS5: { k1: -0.02, k2: 0.006 },
  CAM_THERMAL: { k1: -0.05, k2: 0.012 },
  CAM_POD_RGB: { k1: -0.01, k2: 0.003 },
};

/**
 * Calibração da lente estimada no ajustamento (§12.4): parâmetros em torno dos nominais com
 * ruído normal seedado, e erro de reprojeção que cresce com o produto dos multiplicadores.
 */
export function lensCalibration(
  sensor: Pick<CameraSensor, 'id' | 'imageWidthPx' | 'imageHeightPx' | 'sensorWidthMm'>,
  focalM: number,
  rng: Pick<Rng, 'normal'>,
  qualityProduct: number,
): LensCalibration {
  const pitch = sensor.sensorWidthMm / sensor.imageWidthPx / 1000;
  const base = LENS_DISTORTION_BASE[sensor.id] ?? { k1: 0, k2: 0 };
  return {
    fPx: (focalM / pitch) * (1 + 0.002 * rng.normal()),
    cxPx: sensor.imageWidthPx / 2 + 8 * rng.normal(),
    cyPx: sensor.imageHeightPx / 2 + 8 * rng.normal(),
    k1: base.k1 + 0.002 * rng.normal(),
    k2: base.k2 + 0.0005 * rng.normal(),
    p1: 0.0002 * rng.normal(),
    p2: 0.0002 * rng.normal(),
    reprojErrorPx: 0.35 + 0.15 * (qualityProduct - 1),
  };
}

/**
 * Alvos especiais (`FEATURE_TARGETS`, contracts-real §1): `PHOTO` exige ≥ 3 fotos válidas
 * cobrindo o centro; `LIDAR`, ≥ 50 pulsos/m² na célula do centro. Um alvo com `sensorKind` (as
 * tocas `DEN_*`, que só a câmera termal enxerga) só é capturado por fotos desse sensor.
 */
import type { AircraftKind, CameraSensor, FeatureTarget, MissionData } from '@/types';
import { footprintPolygon, isShotValid, type ShotRules } from './coverage';
import { pointInPolygon } from './geometry';

export const FEATURE_MIN_PHOTOS = 3;
export const FEATURE_MIN_PULSES_M2 = 50;

export interface FeatureContext {
  aoi: { widthM: number; lengthM: number };
  aircraftKind: AircraftKind;
  sensor: CameraSensor;
  focalM: number;
  rules: ShotRules;
}

/** Ids dos alvos capturados pelos dados da missão. */
export function capturedFeatures(
  mission: Pick<MissionData, 'shots' | 'lidar'>,
  terrain: { features: readonly FeatureTarget[] },
  ctx: FeatureContext,
): string[] {
  const out: string[] = [];
  for (const feature of terrain.features) {
    const center = { u: feature.u, v: feature.v };
    if (feature.needs === 'PHOTO') {
      // As fotos de outro sensor passam em branco pelo alvo: ele não aparece para essa câmera.
      if (feature.sensorKind !== undefined && feature.sensorKind !== ctx.sensor.kind) continue;
      let photos = 0;
      for (const shot of mission.shots) {
        if (!isShotValid(shot, ctx.rules)) continue;
        if (
          pointInPolygon(center, footprintPolygon(shot, ctx.aircraftKind, ctx.sensor, ctx.focalM))
        )
          photos++;
        if (photos >= FEATURE_MIN_PHOTOS) break;
      }
      if (photos >= FEATURE_MIN_PHOTOS) out.push(feature.id);
      continue;
    }
    const grid = mission.lidar?.grid;
    if (!grid) continue;
    const col = Math.floor((feature.u / ctx.aoi.lengthM) * grid.cols);
    const row = Math.floor((feature.v / ctx.aoi.widthM) * grid.rows);
    if (col < 0 || row < 0 || col >= grid.cols || row >= grid.rows) continue;
    const pulses = grid.pulses[row * grid.cols + col] ?? 0;
    if (pulses / grid.cellAreaM2 >= FEATURE_MIN_PULSES_M2) out.push(feature.id);
  }
  return out;
}

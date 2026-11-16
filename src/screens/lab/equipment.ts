/**
 * Presets de câmera e "Usar valores do meu equipamento" (infographic-lab §3): preenche os sliders
 * com a melhor câmera e a melhor aeronave que o jogador possui. Tudo vem do catálogo e do domínio.
 */
import { AIRCRAFT, LENSES, SENSORS } from '@/data/catalog';
import { airBase, footprint, pixelPitchM, realFocalM } from '@/domain/photogrammetry';
import type { CameraSensor, Lens, SaveGame } from '@/types';
import type { OpticsInput, StereoInput } from './readings';

export interface CameraPreset {
  id: string;
  label: string;
  sensorWidthMm: number;
  pixelUm: number;
  focalMm: number;
}

function presetOf(sensor: CameraSensor, lens?: Lens): CameraPreset {
  return {
    id: lens ? `${sensor.id}:${lens.id}` : sensor.id,
    label: lens ? `${sensor.name} · ${lens.name}` : sensor.name,
    sensorWidthMm: sensor.sensorWidthMm,
    pixelUm: pixelPitchM(sensor) * 1e6,
    focalMm: realFocalM(sensor, lens) * 1000,
  };
}

/** Uma entrada por câmera; as de lente intercambiável ganham uma por lente. */
export const CAMERA_PRESETS: readonly CameraPreset[] = SENSORS.flatMap((sensor) =>
  sensor.lensMount === 'FIXED' ? [presetOf(sensor)] : LENSES.map((lens) => presetOf(sensor, lens)),
);

/** A altura de trabalho do laboratório com o equipamento: até 100 m, dentro do teto da aeronave. */
export const WORKING_HEIGHT_M = 100;
/** Sobreposição longitudinal para a base do par estereoscópico. */
export const STEREO_OVERLAP_PCT = 70;

export interface EquipmentValues {
  optics: OpticsInput;
  stereo: Pick<StereoInput, 'baseM' | 'heightM' | 'focalMm'>;
  /** Nomes do que foi usado, para a confirmação na tela. */
  cameraLabel: string;
  aircraftName: string;
}

const owned = <T extends { id: string }>(list: readonly T[], ids: readonly string[]): T[] =>
  list.filter((x) => ids.includes(x.id));

/**
 * A melhor câmera possuída (a de maior resolução; a intercambiável usa a lente de maior focal
 * que o jogador tem) e a melhor aeronave (a de maior teto). Sem lente comprada, usa a de 35 mm.
 */
export function equipmentValues(
  inv: Pick<SaveGame['inventory'], 'aircraft' | 'sensors' | 'lenses'>,
): EquipmentValues {
  const sensors = owned(SENSORS, inv.sensors).filter((s) => s.kind === 'RGB');
  const sensor = [...sensors].sort((a, b) => b.imageWidthPx - a.imageWidthPx)[0] ?? SENSORS[0];
  if (!sensor) throw new RangeError('Catálogo sem câmeras');
  const lens =
    sensor.lensMount === 'INTERCHANGEABLE'
      ? ([...owned(LENSES, inv.lenses)].sort((a, b) => b.equivFocalMm - a.equivFocalMm)[0] ??
        LENSES[0])
      : undefined;
  const preset = presetOf(sensor, lens);
  const aircraft = [...owned(AIRCRAFT, inv.aircraft)].sort((a, b) => b.hMaxM - a.hMaxM)[0];
  const heightM = Math.min(WORKING_HEIGHT_M, aircraft?.hMaxM ?? WORKING_HEIGHT_M);
  const focalM = realFocalM(sensor, lens);
  const fp = footprint(heightM, sensor.sensorWidthMm / 1000, sensor.sensorHeightMm / 1000, focalM);
  return {
    optics: {
      heightM,
      focalMm: preset.focalMm,
      pixelUm: preset.pixelUm,
      sensorWidthMm: preset.sensorWidthMm,
    },
    stereo: {
      baseM: airBase(fp.heightM, STEREO_OVERLAP_PCT),
      heightM,
      focalMm: preset.focalMm,
    },
    cameraLabel: preset.label,
    aircraftName: aircraft?.name ?? '',
  };
}

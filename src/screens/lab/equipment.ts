/**
 * Presets de câmera e "Usar valores do meu equipamento" (infographic-lab §3): preenche os sliders
 * com a melhor câmera e a melhor aeronave que o jogador possui. Tudo vem do catálogo e do domínio.
 */
import { AIRCRAFT, LENSES, PAYLOADS, SENSORS } from '@/data/catalog';
import { airBase, footprint, gsd, pixelPitchM, realFocalM } from '@/domain/photogrammetry';
import type { CameraSensor, Lens, SaveGame } from '@/types';
import { clamp } from '@/lib/math';
import type { CanopyInput, OpticsInput, ShutterInput, StereoInput } from './readings';

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
  /** Dossel: o pod possuído (PRR e retornos) e a aeronave (altura e velocidade). */
  canopy: Pick<CanopyInput, 'heightM' | 'speedMs'> &
    Partial<Pick<CanopyInput, 'prrKHz' | 'maxReturns'>>;
  /** Shutter: o obturador da câmera (leitura, se for rolling), a velocidade da aeronave e o GSD. */
  shutter: Pick<ShutterInput, 'speedMs' | 'gsdCm' | 'global'> &
    Partial<Pick<ShutterInput, 'readoutMs'>>;
  /** Nomes do que foi usado, para a confirmação na tela. */
  cameraLabel: string;
  aircraftName: string;
  /** O Pod LiDAR, quando o jogador o possui. */
  payloadName: string | null;
}

/** Faixas dos sliders de dossel e shutter que o equipamento precisa respeitar. */
const CANOPY_HEIGHT_M = { min: 40, max: 300 } as const;
const SPEED_MS = { min: 5, max: 25 } as const;
const SHUTTER_READOUT_MS = { min: 5, max: 60 } as const;
const SHUTTER_GSD_CM = { min: 0.5, max: 5 } as const;

const owned = <T extends { id: string }>(list: readonly T[], ids: readonly string[]): T[] =>
  list.filter((x) => ids.includes(x.id));

/**
 * A melhor câmera possuída (a de maior resolução; a intercambiável usa a lente de maior focal
 * que o jogador tem) e a melhor aeronave (a de maior teto). Sem lente comprada, usa a de 35 mm.
 */
export function equipmentValues(
  inv: Pick<SaveGame['inventory'], 'aircraft' | 'sensors' | 'lenses'> &
    Partial<Pick<SaveGame['inventory'], 'payloads'>>,
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
  const speedMs = clamp(aircraft?.vCruiseMs ?? 10, SPEED_MS.min, SPEED_MS.max);
  const pod = owned(PAYLOADS, inv.payloads ?? [])[0];
  const gsdCm = gsd(heightM, pixelPitchM(sensor), focalM) * 100;
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
    canopy: {
      heightM: clamp(heightM, CANOPY_HEIGHT_M.min, CANOPY_HEIGHT_M.max),
      speedMs,
      ...(pod ? { prrKHz: pod.prrHz / 1000, maxReturns: pod.maxReturns } : {}),
    },
    shutter: {
      speedMs,
      gsdCm: clamp(gsdCm, SHUTTER_GSD_CM.min, SHUTTER_GSD_CM.max),
      // Só o sensor de leitura por linha distorce; o mecânico e o global não.
      global: sensor.shutter !== 'ROLLING',
      ...(sensor.readoutS
        ? {
            readoutMs: clamp(
              sensor.readoutS * 1000,
              SHUTTER_READOUT_MS.min,
              SHUTTER_READOUT_MS.max,
            ),
          }
        : {}),
    },
    cameraLabel: preset.label,
    aircraftName: aircraft?.name ?? '',
    payloadName: pod?.name ?? null,
  };
}

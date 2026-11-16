import { AIRCRAFT, getAircraft, LENSES, SENSORS } from '@/data/catalog';
import { airBase, footprint } from '@/domain/photogrammetry';
import { CAMERA_PRESETS, equipmentValues, STEREO_OVERLAP_PCT, WORKING_HEIGHT_M } from './equipment';

const inventory = (patch: Partial<Parameters<typeof equipmentValues>[0]> = {}) => ({
  aircraft: ['ATLAS' as const],
  sensors: ['CAM_PIGEON'],
  lenses: [] as Array<'LENS_24' | 'LENS_35'>,
  ...patch,
});

describe('presets de câmera', () => {
  it('uma entrada por câmera; as de lente intercambiável ganham uma por lente', () => {
    const fixed = SENSORS.filter((s) => s.lensMount === 'FIXED').length;
    const interchangeable = SENSORS.filter((s) => s.lensMount === 'INTERCHANGEABLE').length;
    expect(CAMERA_PRESETS).toHaveLength(fixed + interchangeable * LENSES.length);
    expect(new Set(CAMERA_PRESETS.map((p) => p.id)).size).toBe(CAMERA_PRESETS.length);
  });

  it('o full frame com a lente de 35 mm é o da G2: pixel 4,38 µm, focal 35 mm, sensor 35,9 mm', () => {
    const p = CAMERA_PRESETS.find((x) => x.id === 'CAM_45MP_FF:LENS_35');
    expect(p?.pixelUm).toBeCloseTo(4.3823, 3);
    expect(p?.focalMm).toBeCloseTo(35, 9);
    expect(p?.sensorWidthMm).toBe(35.9);
    expect(p?.label).toContain('Lente 35 mm');
  });

  it('todos cabem nas faixas dos sliders (pixel 1,5–17 µm, f 4–50 mm, sensor 6–36 mm)', () => {
    for (const p of CAMERA_PRESETS) {
      expect(p.pixelUm).toBeGreaterThanOrEqual(1.5);
      expect(p.pixelUm).toBeLessThanOrEqual(17);
      expect(p.focalMm).toBeGreaterThanOrEqual(4);
      expect(p.focalMm).toBeLessThanOrEqual(50);
      expect(p.sensorWidthMm).toBeGreaterThanOrEqual(6);
      expect(p.sensorWidthMm).toBeLessThanOrEqual(36);
    }
  });
});

describe('"Usar valores do meu equipamento"', () => {
  it('jogador inicial: a câmera de peito do Atlas, a no máximo o teto do Atlas', () => {
    const eq = equipmentValues(inventory());
    expect(eq.cameraLabel).toBe('Câmera de Peito do Avô');
    expect(eq.optics.focalMm).toBeCloseTo(4.5, 9);
    expect(eq.optics.sensorWidthMm).toBe(6.17);
    expect(eq.optics.pixelUm).toBeCloseTo(1.89, 2);
    expect(eq.optics.heightM).toBe(Math.min(WORKING_HEIGHT_M, 80));
    expect(eq.aircraftName).toBe(getAircraft('ATLAS').name);
  });

  it('com tudo: o full frame com a lente de maior focal e a aeronave de maior teto', () => {
    const eq = equipmentValues({
      aircraft: AIRCRAFT.map((a) => a.id),
      sensors: SENSORS.map((s) => s.id),
      lenses: LENSES.map((l) => l.id),
    });
    expect(eq.cameraLabel).toContain('Full Frame');
    expect(eq.cameraLabel).toContain('Lente 35 mm');
    expect(eq.optics.focalMm).toBeCloseTo(35, 9);
    expect(eq.optics.heightM).toBe(WORKING_HEIGHT_M);
    expect(eq.stereo.focalMm).toBeCloseTo(35, 9);
  });

  it('só a lente de 24 mm: usa essa; sem nenhuma lente comprada, cai na primeira do catálogo', () => {
    const base = { aircraft: ['DRONE_T2' as const], sensors: ['CAM_45MP_FF'] };
    expect(equipmentValues({ ...base, lenses: ['LENS_24'] }).optics.focalMm).toBeCloseTo(24, 9);
    expect(equipmentValues({ ...base, lenses: [] }).optics.focalMm).toBeCloseTo(
      LENSES[0]?.equivFocalMm ?? NaN,
      9,
    );
  });

  it('a base estereoscópica é a base aérea de 70 % de sobreposição, pelo domínio', () => {
    const eq = equipmentValues({
      aircraft: ['DRONE_T2'],
      sensors: ['CAM_45MP_FF'],
      lenses: ['LENS_35'],
    });
    const fp = footprint(100, 35.9 / 1000, 24 / 1000, 0.035);
    expect(eq.stereo.baseM).toBeCloseTo(airBase(fp.heightM, STEREO_OVERLAP_PCT), 9);
    expect(eq.stereo.heightM).toBe(100);
  });

  it('a altura respeita o teto da aeronave (Atlas: 80 m)', () => {
    expect(equipmentValues(inventory()).stereo.heightM).toBe(80);
  });
});

import { AIRCRAFT, getAircraft, LENSES, PAYLOADS, SENSORS } from '@/data/catalog';
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
    expect(eq.optics.heightM).toBe(Math.min(WORKING_HEIGHT_M, getAircraft('ATLAS').hMaxM));
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

  it('a altura fica na de trabalho do laboratório (100 m), abaixo do teto do Atlas (120 m)', () => {
    expect(getAircraft('ATLAS').hMaxM).toBe(120);
    expect(equipmentValues(inventory()).stereo.heightM).toBe(WORKING_HEIGHT_M);
  });
});

describe('"Usar valores do meu equipamento": dossel e shutter', () => {
  it('sem o Pod, o dossel usa só a aeronave: a altura e a velocidade de cruzeiro', () => {
    const eq = equipmentValues(inventory());
    expect(eq.payloadName).toBeNull();
    expect(eq.canopy.prrKHz).toBeUndefined();
    expect(eq.canopy.maxReturns).toBeUndefined();
    expect(eq.canopy.heightM).toBe(100);
    expect(eq.canopy.speedMs).toBe(10);
  });

  it('com o Pod, o dossel usa o PRR e os retornos dele', () => {
    const eq = equipmentValues({
      aircraft: ['DRONE_T2'],
      sensors: ['CAM_45MP_FF'],
      lenses: ['LENS_35'],
      payloads: PAYLOADS.map((p) => p.id),
    });
    expect(eq.payloadName).toBe(PAYLOADS[0]?.name);
    expect(eq.canopy.prrKHz).toBe(240);
    expect(eq.canopy.maxReturns).toBe(5);
    expect(eq.canopy.speedMs).toBe(getAircraft('DRONE_T2').vCruiseMs);
  });

  it('a câmera de peito é mecânica: sensor global e sem leitura; o GSD sai do domínio', () => {
    const eq = equipmentValues(inventory());
    expect(eq.shutter.global).toBe(true);
    expect(eq.shutter.readoutMs).toBeUndefined();
    // 100 m · 1,89 µm / 4,5 mm = 4,20 cm, dentro da faixa do slider (0,5 a 5 cm).
    expect(eq.shutter.gsdCm).toBeCloseTo(4.2, 1);
    expect(eq.shutter.speedMs).toBe(10);
  });

  it('a câmera de 20 MP é rolling, lida em 30 ms: GSD de 2,74 cm a 100 m (G6)', () => {
    const eq = equipmentValues({
      aircraft: ['DRONE_T1'],
      sensors: ['CAM_20MP_RS'],
      lenses: [],
    });
    expect(eq.shutter.global).toBe(false);
    expect(eq.shutter.readoutMs).toBe(30);
    expect(eq.shutter.gsdCm).toBeCloseTo(2.74, 2);
  });

  it('o full frame com obturador global não distorce', () => {
    const eq = equipmentValues({
      aircraft: ['DRONE_T2'],
      sensors: ['CAM_45MP_FF'],
      lenses: ['LENS_35'],
    });
    expect(eq.shutter.global).toBe(true);
    expect(eq.shutter.readoutMs).toBeUndefined();
  });

  it('as velocidades e o GSD respeitam as faixas dos sliders em qualquer equipamento', () => {
    const everything = equipmentValues({
      aircraft: AIRCRAFT.map((a) => a.id),
      sensors: SENSORS.map((s) => s.id),
      lenses: LENSES.map((l) => l.id),
      payloads: PAYLOADS.map((p) => p.id),
    });
    expect(everything.canopy.speedMs).toBeGreaterThanOrEqual(5);
    expect(everything.canopy.speedMs).toBeLessThanOrEqual(25);
    expect(everything.canopy.heightM).toBeGreaterThanOrEqual(40);
    expect(everything.shutter.gsdCm).toBeGreaterThanOrEqual(0.5);
    expect(everything.shutter.gsdCm).toBeLessThanOrEqual(5);
  });
});

/**
 * REQ-LAB-005: todos os números do laboratório saem das funções de `@/domain`. Um teste de *spy*:
 * as funções do domínio são chamadas com as entradas dos sliders e, trocando o resultado delas, a
 * tela mostra o resultado trocado (não há fórmula reescrita no componente).
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { accuracyMultipliers } from '@/domain/accuracy';
import {
  groundDensity,
  groundReturnProbability,
  isDtmReliable,
  lidarDensity,
  lidarSwathM,
  photoGroundVisibility,
} from '@/domain/lidar';
import {
  footprint,
  gsd,
  horizontalFovRad,
  pecMaxScaleDenominator,
  rollingShutterShearRad,
  rollingShutterSkewPx,
} from '@/domain/photogrammetry';
import {
  baseHeightClass,
  baseHeightRatio,
  depthPrecisionM,
  heightFromParallax,
  parallaxDiffM,
  photoBaseM,
} from '@/domain/stereo';
import { degToRad } from '@/lib/math';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { InfographicLabScreen } from './InfographicLabScreen';

vi.mock('@/domain/photogrammetry', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/domain/photogrammetry')>();
  return {
    ...mod,
    gsd: vi.fn(mod.gsd),
    footprint: vi.fn(mod.footprint),
    horizontalFovRad: vi.fn(mod.horizontalFovRad),
    pecMaxScaleDenominator: vi.fn(mod.pecMaxScaleDenominator),
    rollingShutterSkewPx: vi.fn(mod.rollingShutterSkewPx),
    rollingShutterShearRad: vi.fn(mod.rollingShutterShearRad),
  };
});
vi.mock('@/domain/lidar', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/domain/lidar')>();
  return {
    ...mod,
    lidarSwathM: vi.fn(mod.lidarSwathM),
    lidarDensity: vi.fn(mod.lidarDensity),
    groundReturnProbability: vi.fn(mod.groundReturnProbability),
    groundDensity: vi.fn(mod.groundDensity),
    photoGroundVisibility: vi.fn(mod.photoGroundVisibility),
    isDtmReliable: vi.fn(mod.isDtmReliable),
  };
});
vi.mock('@/domain/accuracy', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/domain/accuracy')>();
  return { ...mod, accuracyMultipliers: vi.fn(mod.accuracyMultipliers) };
});
vi.mock('@/domain/stereo', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/domain/stereo')>();
  return {
    ...mod,
    photoBaseM: vi.fn(mod.photoBaseM),
    parallaxDiffM: vi.fn(mod.parallaxDiffM),
    heightFromParallax: vi.fn(mod.heightFromParallax),
    baseHeightRatio: vi.fn(mod.baseHeightRatio),
    baseHeightClass: vi.fn(mod.baseHeightClass),
    depthPrecisionM: vi.fn(mod.depthPrecisionM),
  };
});

const originals = {
  photogrammetry:
    await vi.importActual<typeof import('@/domain/photogrammetry')>('@/domain/photogrammetry'),
  stereo: await vi.importActual<typeof import('@/domain/stereo')>('@/domain/stereo'),
  lidar: await vi.importActual<typeof import('@/domain/lidar')>('@/domain/lidar'),
  accuracy: await vi.importActual<typeof import('@/domain/accuracy')>('@/domain/accuracy'),
};

function open(panel: 'OPTICS' | 'STEREO' | 'CANOPY' | 'SHUTTER') {
  act(() => {
    useGameStore.setState((s) => ({
      session: { ...s.session, screen: 'INFOGRAPHIC_LAB', payload: { panel } },
    }));
  });
  return render(<InfographicLabScreen />);
}

const value = (testId: string) => screen.getByTestId(testId).textContent;

beforeEach(() => {
  resetGameStore();
  vi.mocked(gsd).mockImplementation(originals.photogrammetry.gsd);
  vi.mocked(photoBaseM).mockImplementation(originals.stereo.photoBaseM);
  vi.mocked(parallaxDiffM).mockImplementation(originals.stereo.parallaxDiffM);
  vi.mocked(heightFromParallax).mockImplementation(originals.stereo.heightFromParallax);
  vi.mocked(depthPrecisionM).mockImplementation(originals.stereo.depthPrecisionM);
  vi.mocked(baseHeightClass).mockImplementation(originals.stereo.baseHeightClass);
  vi.mocked(lidarSwathM).mockImplementation(originals.lidar.lidarSwathM);
  vi.mocked(lidarDensity).mockImplementation(originals.lidar.lidarDensity);
  vi.mocked(groundReturnProbability).mockImplementation(originals.lidar.groundReturnProbability);
  vi.mocked(groundDensity).mockImplementation(originals.lidar.groundDensity);
  vi.mocked(photoGroundVisibility).mockImplementation(originals.lidar.photoGroundVisibility);
  vi.mocked(isDtmReliable).mockImplementation(originals.lidar.isDtmReliable);
  vi.mocked(rollingShutterSkewPx).mockImplementation(originals.photogrammetry.rollingShutterSkewPx);
  vi.mocked(rollingShutterShearRad).mockImplementation(
    originals.photogrammetry.rollingShutterShearRad,
  );
  vi.mocked(accuracyMultipliers).mockImplementation(originals.accuracy.accuracyMultipliers);
  vi.clearAllMocks();
});

describe('REQ-LAB-005 — o laboratório usa o domínio', () => {
  it('óptica: chama gsd, footprint, horizontalFovRad e a escala PEC com as entradas dos sliders', () => {
    open('OPTICS');
    // H 100 m, pixel 4,38 µm, f 35 mm.
    expect(gsd).toHaveBeenCalledWith(100, expect.closeTo(4.38e-6, 12), 0.035);
    // Sensor de 36 mm por 24 mm (3:2): largura e altura em metros.
    expect(footprint).toHaveBeenCalledWith(
      100,
      expect.closeTo(0.036, 12),
      expect.closeTo(0.024, 12),
      0.035,
    );
    expect(horizontalFovRad).toHaveBeenCalledWith(
      expect.objectContaining({ sensorWidthMm: 36 }),
      0.035,
    );
    const gsdM = vi.mocked(gsd).mock.results[0]?.value as number;
    expect(pecMaxScaleDenominator).toHaveBeenCalledWith(gsdM);
  });

  it('óptica: o GSD exibido é o que `gsd()` devolve (trocando o retorno, a tela troca)', () => {
    vi.mocked(gsd).mockReturnValue(0.0777);
    open('OPTICS');
    expect(value('reading-gsd')).toBe('7,77 cm/px');
    expect(screen.getByTestId('formula-0')).toHaveTextContent('= 7,77 cm/px');
    // E a escala máxima acompanha o GSD do domínio (7,77 cm · 4000 ≈ 1:311).
    expect(value('reading-scale')).toBe('≈ 1:311');
  });

  it('óptica: a leitura acompanha os sliders pela chamada ao domínio', () => {
    open('OPTICS');
    vi.mocked(gsd).mockClear();
    fireEvent.keyDown(screen.getByRole('slider', { name: 'Altura H' }), { key: 'ArrowRight' });
    expect(gsd).toHaveBeenCalledWith(101, expect.closeTo(4.38e-6, 12), 0.035);
  });

  it('estereoscopia: chama as funções de paralaxe com B, f, H e h dos sliders', () => {
    open('STEREO');
    expect(photoBaseM).toHaveBeenCalledWith(30, 0.035, 100);
    expect(parallaxDiffM).toHaveBeenCalledWith(30, 0.035, 100, 20);
    const b = vi.mocked(photoBaseM).mock.results[0]?.value as number;
    const dp = vi.mocked(parallaxDiffM).mock.results[0]?.value as number;
    expect(heightFromParallax).toHaveBeenCalledWith(100, b, dp);
    expect(baseHeightRatio).toHaveBeenCalledWith(30, 100);
    // σ_Z com 0,5 px de 4,38 µm de lado.
    expect(depthPrecisionM).toHaveBeenCalledWith(
      100,
      30,
      0.035,
      expect.closeTo(0.5 * 4.3823e-6, 10),
    );
  });

  it('estereoscopia: b, Δp, h, B/H e σ_Z exibidos são os que o domínio devolve', () => {
    vi.mocked(photoBaseM).mockReturnValue(0.123);
    vi.mocked(parallaxDiffM).mockReturnValue(0.0456);
    vi.mocked(heightFromParallax).mockReturnValue(12.34);
    vi.mocked(depthPrecisionM).mockReturnValue(0.0567);
    vi.mocked(baseHeightClass).mockReturnValue('STRONG');
    open('STEREO');
    expect(value('reading-b')).toBe('123,00 mm');
    expect(value('reading-dp')).toBe('45,600 mm');
    expect(value('reading-h')).toBe('12,34 m');
    expect(value('reading-sigma-z')).toBe('5,67 cm');
    expect(value('reading-ratio')).toBe('0,30 · forte, mas com oclusões');
  });

  it('dossel: chama o LiDAR do domínio com PRR, v, H, o FOV de 70° e a cobertura dos sliders', () => {
    open('CANOPY');
    // PRR 240 kHz, v 12 m/s, H 100 m e FOV de 70°.
    expect(lidarDensity).toHaveBeenCalledWith(240_000, 12, 100, expect.closeTo(degToRad(70), 12));
    expect(lidarSwathM).toHaveBeenCalledWith(100, expect.closeTo(degToRad(70), 12));
    expect(groundReturnProbability).toHaveBeenCalledWith(0.7, 3);
    expect(photoGroundVisibility).toHaveBeenCalledWith(0.7);
    const density = vi.mocked(lidarDensity).mock.results[0]?.value as number;
    expect(groundDensity).toHaveBeenCalledWith(density, 0.7, 3);
    const ground = vi.mocked(groundDensity).mock.results[0]?.value as number;
    expect(isDtmReliable).toHaveBeenCalledWith(ground);
  });

  it('dossel: P_solo, densidades, faixa, visibilidade e veredito exibidos são os do domínio', () => {
    vi.mocked(groundReturnProbability).mockImplementation((c) => (c === 1 ? 0.04 : 0.5));
    vi.mocked(groundDensity).mockReturnValue(77.7);
    vi.mocked(lidarDensity).mockReturnValue(200);
    vi.mocked(lidarSwathM).mockReturnValue(123.4);
    vi.mocked(photoGroundVisibility).mockReturnValue(0.2);
    vi.mocked(isDtmReliable).mockReturnValue(false);
    open('CANOPY');
    expect(value('reading-p-ground')).toBe('50,00 %');
    expect(value('reading-ground-density')).toBe('77,7 pts/m²');
    expect(value('reading-density')).toBe('200,0 pts/m²');
    expect(value('reading-swath')).toBe('123,4 m');
    expect(value('reading-photo-visibility')).toBe('20,00 %');
    expect(value('reading-verdict')).toBe('MDT insuficiente');
  });

  it('shutter: chama rollingShutterSkewPx(v, leitura, GSD) e o ângulo de cisalhamento do domínio', () => {
    open('SHUTTER');
    expect(rollingShutterSkewPx).toHaveBeenCalledWith(8, 0.03, expect.closeTo(0.0274, 12));
    const skew = vi.mocked(rollingShutterSkewPx).mock.results[0]?.value as number;
    // Imagem de 160 linhas de 2,74 cm: 4,384 m de altura no solo.
    expect(rollingShutterShearRad).toHaveBeenCalledWith(
      skew,
      expect.closeTo(0.0274, 12),
      expect.closeTo(160 * 0.0274, 9),
    );
    // A penalidade de RMSE vem de `accuracyMultipliers`, com φ = 0 e φ = 1.
    const phis = vi.mocked(accuracyMultipliers).mock.calls.map(([ctx]) => ctx.phi);
    expect(phis).toContain(0);
    expect(phis).toContain(1);
    expect(
      vi.mocked(accuracyMultipliers).mock.calls.every(([ctx]) => ctx.meanSkewPx === skew),
    ).toBe(true);
  });

  it('shutter: skew, ângulo e penalidades exibidos são os do domínio', () => {
    vi.mocked(rollingShutterSkewPx).mockReturnValue(12.34);
    vi.mocked(rollingShutterShearRad).mockReturnValue(0.1);
    vi.mocked(accuracyMultipliers).mockReturnValue([
      { key: 'rollingShutter', label: 'Rolling shutter', xy: 1.7, z: 1.7 },
    ]);
    open('SHUTTER');
    expect(value('reading-skew')).toBe('12,34 px');
    expect(value('reading-shear')).toBe('5,73°');
    expect(value('reading-rmse-no-rtk')).toBe('× 1,70');
    expect(value('reading-rmse-rtk')).toBe('× 1,70');
  });

  it('shutter: com o sensor global o domínio recebe leitura indefinida (sem rolling)', () => {
    open('SHUTTER');
    vi.mocked(rollingShutterSkewPx).mockClear();
    fireEvent.click(screen.getByTestId('shutter-global'));
    expect(rollingShutterSkewPx).toHaveBeenCalledWith(8, undefined, expect.closeTo(0.0274, 12));
  });
});

/**
 * REQ-LAB-005: todos os números do laboratório saem das funções de `@/domain`. Um teste de *spy*:
 * as funções do domínio são chamadas com as entradas dos sliders e, trocando o resultado delas, a
 * tela mostra o resultado trocado (não há fórmula reescrita no componente).
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { footprint, gsd, horizontalFovRad, pecMaxScaleDenominator } from '@/domain/photogrammetry';
import {
  baseHeightClass,
  baseHeightRatio,
  depthPrecisionM,
  heightFromParallax,
  parallaxDiffM,
  photoBaseM,
} from '@/domain/stereo';
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
  };
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
};

function open(panel: 'OPTICS' | 'STEREO') {
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
});

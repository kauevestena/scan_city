import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { useGameStore } from '@/state/store';
import { createFakeRaf } from '@/test/fakeRaf';
import { resetGameStore } from '@/test/resetStore';
import { currentDpr, setupCanvas } from './canvas';
import { WINDOW_MS } from './renderScale';
import {
  renderScaleOf,
  resetRememberedScales,
  useCanvas,
  type AdaptiveResolution,
} from './useCanvas';

function setDpr(value: number) {
  Object.defineProperty(window, 'devicePixelRatio', { value, configurable: true });
}

afterEach(() => {
  setDpr(1);
  vi.unstubAllGlobals();
});

describe('setupCanvas', () => {
  it('em DPR 2, o buffer tem o dobro da largura CSS e o contexto é escalado', () => {
    const canvas = document.createElement('canvas');
    const surface = setupCanvas(canvas, 640, 360, 2);
    expect(canvas.width).toBe(1280);
    expect(canvas.height).toBe(720);
    expect(surface).toMatchObject({ width: 640, height: 360, dpr: 2 });
    expect(surface?.ctx.getTransform()).toMatchObject({ a: 2, d: 2, e: 0, f: 0 });
  });

  it('arredonda tamanhos fracionários e nunca cria um buffer vazio', () => {
    const canvas = document.createElement('canvas');
    expect(setupCanvas(canvas, 300.7, 150.2, 1.5)).toMatchObject({ width: 300, height: 150 });
    expect(canvas.width).toBe(450);
    expect(canvas.height).toBe(225);
    setupCanvas(canvas, 0, 0, 1);
    expect(canvas.width).toBe(1);
    expect(canvas.height).toBe(1);
  });

  it('usa o devicePixelRatio da janela por padrão', () => {
    setDpr(3);
    expect(currentDpr()).toBe(3);
    const canvas = document.createElement('canvas');
    setupCanvas(canvas, 100, 50);
    expect(canvas.width).toBe(300);
    setDpr(0);
    expect(currentDpr()).toBe(1);
  });

  it('devolve null se o contexto 2D não existir', () => {
    // Canvas falso: espionar `getContext` alteraria o mock global do vitest-canvas-mock.
    const canvas = { width: 0, height: 0, getContext: () => null } as unknown as HTMLCanvasElement;
    expect(setupCanvas(canvas, 10, 10, 1)).toBeNull();
    expect(canvas.width).toBe(10);
  });
});

describe('useCanvas', () => {
  let hostSize = { width: 800, height: 450 };
  let resizeCallbacks: Array<() => void> = [];
  let disconnected = 0;

  class FakeResizeObserver {
    private readonly cb: () => void;
    constructor(cb: () => void) {
      this.cb = cb;
    }
    observe() {
      resizeCallbacks.push(this.cb);
    }
    disconnect() {
      disconnected++;
    }
  }

  function Probe({ adaptive }: { adaptive?: AdaptiveResolution }) {
    const ref = useRef<HTMLCanvasElement>(null);
    const surface = useCanvas(ref, adaptive);
    return (
      <div
        ref={(el) => {
          if (!el) return;
          Object.defineProperty(el, 'clientWidth', {
            get: () => hostSize.width,
            configurable: true,
          });
          Object.defineProperty(el, 'clientHeight', {
            get: () => hostSize.height,
            configurable: true,
          });
        }}
      >
        <canvas ref={ref} data-testid="canvas" />
        <output>
          {surface ? `${surface.width}x${surface.height}@${surface.dpr}` : 'sem medida'}
        </output>
      </div>
    );
  }

  beforeEach(() => {
    hostSize = { width: 800, height: 450 };
    resizeCallbacks = [];
    disconnected = 0;
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
  });

  it('mede o pai, aplica o DPR e reage ao redimensionamento', () => {
    setDpr(2);
    const { unmount } = render(<Probe />);
    const canvas = screen.getByTestId<HTMLCanvasElement>('canvas');
    expect(screen.getByRole('status')).toHaveTextContent('800x450@2');
    expect(canvas.width).toBe(1600);
    expect(canvas.height).toBe(900);

    hostSize = { width: 1024, height: 576 };
    act(() => resizeCallbacks.forEach((cb) => cb()));
    expect(screen.getByRole('status')).toHaveTextContent('1024x576@2');
    expect(canvas.width).toBe(2048);

    setDpr(1);
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('1024x576@1');
    expect(canvas.width).toBe(1024);

    unmount();
    expect(disconnected).toBe(1);
  });

  describe('resolução adaptativa (ADR-033)', () => {
    const FLIGHT: AdaptiveResolution = { kind: 'flight', floor: 0.75 };
    let raf: ReturnType<typeof createFakeRaf>;
    let now = 0;
    /** Quadros de `frameMs` por `durationMs`, pelo rAF falso. */
    const frames = (frameMs: number, durationMs: number) =>
      act(() => {
        for (let t = 0; t < durationMs; t += frameMs) raf.frame((now += frameMs));
      });

    beforeEach(() => {
      resetGameStore();
      resetRememberedScales();
      raf = createFakeRaf();
      now = 0;
      vi.stubGlobal('requestAnimationFrame', raf.raf);
      vi.stubGlobal('cancelAnimationFrame', raf.caf);
    });

    it('começa no DPR da tela (Alta), desce quando o quadro fica lento e o canvas marca a escala', () => {
      setDpr(2);
      const { unmount } = render(<Probe adaptive={FLIGHT} />);
      const canvas = screen.getByTestId<HTMLCanvasElement>('canvas');
      expect(canvas.width).toBe(1600);
      expect(canvas.dataset.renderScale).toBe('2.00');
      // 30 FPS por uma janela: um degrau (2 → 1,6), e o buffer encolhe; o tamanho lógico fica.
      frames(1000 / 30, WINDOW_MS + 40);
      expect(canvas.dataset.renderScale).toBe('1.60');
      expect(canvas.width).toBe(1280);
      expect(screen.getByRole('status')).toHaveTextContent('800x450@1.6');
      // O painel F9 lê a escala em uso.
      expect(renderScaleOf('flight')).toBeCloseTo(1.6, 9);
      expect(renderScaleOf('holo')).toBeNull();
      unmount();
      // Desmontar para o laço do governador.
      expect(raf.pending).toBe(0);
    });

    it('a escala que se segurou é lembrada: a próxima visita já começa nela', () => {
      setDpr(2);
      const first = render(<Probe adaptive={FLIGHT} />);
      frames(1000 / 30, WINDOW_MS + 40);
      first.unmount();
      render(<Probe adaptive={FLIGHT} />);
      expect(screen.getByTestId<HTMLCanvasElement>('canvas').dataset.renderScale).toBe('1.60');
    });

    it('a qualidade limita o teto: Baixa fica em 1 px de buffer por px de CSS', () => {
      setDpr(2);
      act(() => useGameStore.getState().setSetting('quality', 'LOW'));
      render(<Probe adaptive={FLIGHT} />);
      const canvas = screen.getByTestId<HTMLCanvasElement>('canvas');
      expect(canvas.width).toBe(800);
      expect(canvas.dataset.renderScale).toBe('1.00');
      act(() => useGameStore.getState().setSetting('quality', 'HIGH'));
      expect(canvas.width).toBe(1600);
    });

    it('sem a opção, nada muda: DPR inteiro e sem data-render-scale', () => {
      setDpr(2);
      render(<Probe />);
      const canvas = screen.getByTestId<HTMLCanvasElement>('canvas');
      frames(1000 / 20, 3000);
      expect(canvas.width).toBe(1600);
      expect(canvas.dataset.renderScale).toBeUndefined();
    });
  });

  it('funciona sem ResizeObserver (só com o evento resize)', () => {
    vi.stubGlobal('ResizeObserver', undefined);
    render(<Probe />);
    expect(screen.getByRole('status')).toHaveTextContent('800x450@1');
    hostSize = { width: 400, height: 300 };
    act(() => {
      window.dispatchEvent(new Event('resize'));
    });
    expect(screen.getByRole('status')).toHaveTextContent('400x300@1');
  });
});

import { act, render, screen } from '@testing-library/react';
import { useRef } from 'react';
import { currentDpr, setupCanvas } from './canvas';
import { useCanvas } from './useCanvas';

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

  function Probe() {
    const ref = useRef<HTMLCanvasElement>(null);
    const surface = useCanvas(ref);
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

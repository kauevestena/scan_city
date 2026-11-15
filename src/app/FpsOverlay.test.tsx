import { act, render, screen } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { DebugCanvasDemo } from './DebugCanvasDemo';
import { resetDebugFlagsCache } from './debugFlags';
import { FpsOverlay } from './FpsOverlay';

let frame: ((timeMs: number) => void) | null = null;

beforeEach(() => {
  resetGameStore();
  frame = null;
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
    frame = cb;
    return 1;
  });
  vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
    frame = null;
  });
});
afterEach(() => {
  vi.restoreAllMocks();
  window.history.replaceState(null, '', '/');
  resetDebugFlagsCache();
});

const step = (timeMs: number) => act(() => frame?.(timeMs));

describe('FpsOverlay', () => {
  it('fica oculto sem debug e sem a configuração showFps', () => {
    render(<FpsOverlay />);
    expect(screen.queryByTestId('fps-overlay')).not.toBeInTheDocument();
  });

  it('aparece com settings.showFps e mede a cadência dos frames', () => {
    useGameStore.getState().setSetting('showFps', true);
    const { unmount } = render(<FpsOverlay />);
    for (let i = 0; i <= 90; i++) step((i * 1000) / 60);
    const overlay = screen.getByTestId('fps-overlay');
    expect(overlay).toHaveTextContent('60 FPS');
    expect(overlay.className).toContain('text-emerald-400');

    for (let i = 1; i <= 60; i++) step(1500 + i * 50);
    expect(overlay).toHaveTextContent('20 FPS');
    expect(overlay.className).toContain('text-rose-500');
    unmount();
    expect(frame).toBeNull();
  });

  it('aparece com ?debug=1', () => {
    window.history.replaceState(null, '', '/?debug=1');
    resetDebugFlagsCache();
    render(<FpsOverlay />);
    expect(screen.getByTestId('fps-overlay')).toBeInTheDocument();
  });
});

describe('DebugCanvasDemo', () => {
  it('desenha o quadrado girando no canvas', () => {
    render(<DebugCanvasDemo />);
    const canvas = screen.getByTestId<HTMLCanvasElement>('debug-canvas');
    const ctx = canvas.getContext('2d') as CanvasRenderingContext2D;
    const rotate = vi.spyOn(ctx, 'rotate');
    step(0);
    step(1000);
    expect(rotate).toHaveBeenCalledTimes(2);
    // 0,05 s (clamp) a 0,25 volta/s.
    expect(rotate.mock.calls[1]?.[0]).toBeCloseTo(0.05 * 0.25 * 2 * Math.PI, 9);
    expect(ctx.strokeRect).toHaveBeenCalled();
  });
});

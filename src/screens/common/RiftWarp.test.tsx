import { render, screen, waitFor } from '@testing-library/react';
import { RIFT_WARP_MS, RiftWarp, warpOffset } from './RiftWarp';

describe('warpOffset', () => {
  it('começa e termina sem deslocamento, e é máximo no meio da transição', () => {
    for (const y of [0, 37, 200, 359]) {
      expect(warpOffset(y, 360, 0)).toBeCloseTo(0, 9);
      expect(warpOffset(y, 360, 1)).toBeCloseTo(0, 9);
    }
    let peak = 0;
    for (let y = 0; y < 360; y += 3) peak = Math.max(peak, Math.abs(warpOffset(y, 360, 0.5)));
    expect(peak).toBeGreaterThan(10);
    expect(peak).toBeLessThanOrEqual(34);
  });

  it('é determinístico e limita t a 0–1', () => {
    expect(warpOffset(100, 360, 0.3)).toBe(warpOffset(100, 360, 0.3));
    expect(warpOffset(100, 360, -5)).toBeCloseTo(0, 9);
    expect(warpOffset(100, 360, 7)).toBeCloseTo(0, 9);
  });
});

describe('RiftWarp', () => {
  it('cobre a tela e chama onDone uma vez, ao fim dos 700 ms', async () => {
    const onDone = vi.fn();
    const start = performance.now();
    render(<RiftWarp onDone={onDone} />);
    expect(screen.getByTestId('rift-warp')).toHaveAttribute('aria-hidden', 'true');
    expect(onDone).not.toHaveBeenCalled();
    await waitFor(() => expect(onDone).toHaveBeenCalledTimes(1), { timeout: 3000 });
    expect(performance.now() - start).toBeGreaterThanOrEqual(RIFT_WARP_MS - 50);
  });

  it('com reduceFlashes não desenha nada e segue na hora', () => {
    const onDone = vi.fn();
    const { container } = render(<RiftWarp onDone={onDone} reduceFlashes />);
    expect(container).toBeEmptyDOMElement();
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it('desmontar no meio cancela a animação: onDone não vem', async () => {
    const onDone = vi.fn();
    const { unmount } = render(<RiftWarp onDone={onDone} />);
    unmount();
    await new Promise((r) => setTimeout(r, RIFT_WARP_MS + 100));
    expect(onDone).not.toHaveBeenCalled();
  });
});

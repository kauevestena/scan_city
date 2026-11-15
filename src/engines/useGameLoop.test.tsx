import { act, render } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import { createFakeRaf } from '@/test/fakeRaf';
import { resetGameStore } from '@/test/resetStore';
import type { Simulation } from './loop';
import { useGameLoop } from './useGameLoop';

let fake = createFakeRaf();
let updates = 0;
let renders = 0;

function Harness({ enabled = true, version = 0 }: { enabled?: boolean; version?: number }) {
  useGameLoop(
    (): Simulation | null =>
      enabled
        ? {
            update: () => {
              updates++;
            },
            render: () => {
              renders++;
            },
          }
        : null,
    [enabled, version],
    { raf: fake.raf, caf: fake.caf },
  );
  return null;
}

beforeEach(() => {
  resetGameStore();
  fake = createFakeRaf();
  updates = 0;
  renders = 0;
});

describe('useGameLoop', () => {
  it('roda a simulação e para ao desmontar', () => {
    const { unmount } = render(<Harness />);
    fake.frame(0);
    fake.frame(16);
    expect(updates).toBe(1);
    expect(renders).toBe(2);
    unmount();
    expect(fake.pending).toBe(0);
  });

  it('congela com session.paused e retoma do mesmo ponto', () => {
    render(<Harness />);
    fake.frame(0);
    fake.frame(16);
    act(() => useGameStore.getState().setPaused(true));
    // 5 s de pausa: nenhum update, mas a tela continua sendo desenhada.
    for (let t = 32; t <= 5024; t += 16) fake.frame(t);
    expect(updates).toBe(1);
    expect(renders).toBeGreaterThan(300);
    act(() => useGameStore.getState().setPaused(false));
    fake.frame(5040);
    expect(updates).toBe(2);
  });

  it('já nasce pausado se o jogo estiver pausado', () => {
    useGameStore.getState().setPaused(true);
    render(<Harness />);
    fake.frame(0);
    fake.frame(16);
    expect(updates).toBe(0);
    expect(renders).toBe(2);
  });

  it('sem simulação não há loop; ao mudar as dependências, recria', () => {
    const { rerender } = render(<Harness enabled={false} />);
    expect(fake.pending).toBe(0);
    rerender(<Harness enabled />);
    expect(fake.pending).toBe(1);
    fake.frame(0);
    fake.frame(16);
    expect(updates).toBe(1);
    rerender(<Harness enabled version={1} />);
    // Loop novo: o primeiro frame só desenha.
    fake.frame(32);
    expect(updates).toBe(1);
    expect(fake.pending).toBe(1);
  });
});

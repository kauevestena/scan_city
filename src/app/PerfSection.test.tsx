import { act, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FLIGHT_STAGE, PERF, setPerfEnabled } from '@/engines/perf';
import { activeSections, PerfSection } from './PerfSection';

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  setPerfEnabled(false);
});

/** Um quadro do voo com tempos conhecidos: HUD 3 ms, cena 2 ms, terreno 5 ms (total 10 ms). */
function feedFlightFrame(): void {
  vi.spyOn(performance, 'now')
    .mockReturnValueOnce(1000)
    .mockReturnValueOnce(1003)
    .mockReturnValueOnce(1005)
    .mockReturnValueOnce(1010);
  PERF.flight.enter(FLIGHT_STAGE.HUD);
  PERF.flight.enter(FLIGHT_STAGE.SCENE);
  PERF.flight.enter(FLIGHT_STAGE.TERRAIN);
  PERF.flight.endFrame();
}

describe('activeSections', () => {
  it('só entra a tela que ganhou quadros desde a leitura anterior', () => {
    setPerfEnabled(true);
    const seen = new Map<string, number>();
    expect(activeSections(seen)).toEqual([]);
    feedFlightFrame();
    const first = activeSections(seen);
    expect(first.map((s) => s.key)).toEqual(['flight']);
    expect(first[0]?.totalMs).toBeCloseTo(10, 6);
    expect(first[0]?.budgetMs).toBe(12);
    // Sem quadros novos (a tela mudou), a seção some em vez de mostrar números velhos.
    expect(activeSections(seen)).toEqual([]);
  });
});

describe('PerfSection', () => {
  it('liga os contadores ao abrir, mostra os tempos por etapa e desliga ao fechar', () => {
    vi.useFakeTimers();
    const { unmount } = render(<PerfSection />);
    expect(PERF.flight.enabled).toBe(true);
    expect(screen.getByText(/Sem quadros/)).toBeInTheDocument();

    act(() => {
      feedFlightFrame();
      vi.advanceTimersByTime(300);
    });
    const flight = document.querySelector('[data-perf="flight"]') as HTMLElement;
    expect(flight).not.toBeNull();
    expect(flight.textContent).toContain('Voo');
    // Total e orçamento (≤ 12 ms em Alta, survey-flight §5.18).
    expect(flight.textContent).toContain('10,00 ms / 12,0 ms');
    expect(flight.textContent).toContain('HUD (publicação)');
    expect(flight.textContent).toContain('3,00 ms');
    expect(flight.textContent).toContain('terreno (quads e curvas)');
    expect(flight.textContent).toContain('5,00 ms');
    expect(screen.queryByText(/Sem quadros/)).toBeNull();

    unmount();
    expect(PERF.flight.enabled).toBe(false);
  });

  it('acima do orçamento o total fica em vermelho', () => {
    vi.useFakeTimers();
    render(<PerfSection />);
    vi.spyOn(performance, 'now').mockReturnValueOnce(0).mockReturnValueOnce(14);
    act(() => {
      PERF.flight.enter(FLIGHT_STAGE.TERRAIN);
      PERF.flight.endFrame();
      vi.advanceTimersByTime(300);
    });
    const total = document.querySelector('[data-perf="flight"] p span:last-child') as HTMLElement;
    expect(total.textContent).toBe('14,00 ms / 12,0 ms');
    expect(total.className).toContain('text-rose-500');
  });
});

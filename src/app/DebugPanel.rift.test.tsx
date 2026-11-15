/**
 * Painel de depuração (T059): os botões de teleporte seguem a aba do mapa — contratos do Mundo
 * Real na aba Real, fendas descobertas na aba Fendas (R01 e R02 do catálogo).
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { DebugPanel } from './DebugPanel';

const get = () => useGameStore.getState();
const teleports = () =>
  [...document.querySelectorAll('[data-teleport]')].map((el) => el.getAttribute('data-teleport'));

beforeEach(() => {
  resetGameStore();
  act(() => get().goTo('WORLD_MAP'));
});

describe('DebugPanel — teleporte por dimensão', () => {
  it('aba Real: Sede e os contratos do Mundo Real, sem fendas', () => {
    render(<DebugPanel />);
    const ids = teleports();
    expect(ids).toContain('HQ');
    expect(ids).toContain('C00');
    expect(ids).not.toContain('R01');
  });

  it('aba Fendas: as fendas descobertas e nenhum contrato do Mundo Real', () => {
    act(() => {
      get().discoverRift('R01');
      get().discoverRift('R02');
      get().setDimensionTab('RIFT');
    });
    render(<DebugPanel />);
    expect(teleports()).toEqual(['HQ', 'R01', 'R02']);
  });

  it('a aba Fendas sem descobertas continua mostrando o Mundo Real', () => {
    act(() => get().setDimensionTab('RIFT'));
    render(<DebugPanel />);
    expect(teleports()).toContain('C00');
    expect(teleports()).not.toContain('R01');
  });

  it('clicar numa fenda leva o avatar ao centro do marcador dela', () => {
    act(() => {
      get().discoverRift('R01');
      get().setDimensionTab('RIFT');
    });
    render(<DebugPanel />);
    fireEvent.click(document.querySelector('[data-teleport="R01"]') as Element);
    const m = WORLD_MAP.markers.find((mk) => mk.char === 'a') as { x: number; y: number };
    expect(get().world.avatar).toMatchObject({ x: m.x + 0.5, y: m.y + 0.5 });
    expect(screen.getByTestId('debug-state')).toBeInTheDocument();
  });
});

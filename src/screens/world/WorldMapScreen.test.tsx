import { act, fireEvent, render, screen } from '@testing-library/react';
import { InputManager } from '@/input/InputManager';
import { DEFAULT_SPAWN } from '@/state/slices/worldSlice';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { AVATAR_SAVE_MS, WorldMapScreen } from './WorldMapScreen';

const get = () => useGameStore.getState();
const DOOR = { x: WORLD_MAP.door.x + 0.5, y: WORLD_MAP.door.y + 0.5 };

/** Deixa o rAF do jsdom (≈ 60 FPS) rodar alguns frames. */
const frames = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

beforeEach(() => {
  resetGameStore();
  act(() => get().goTo('WORLD_MAP'));
});

describe('WorldMapScreen', () => {
  it('novo jogo: o avatar nasce no spawn, com a aba Real, o veículo e o minimapa', () => {
    expect(get().world.avatar).toMatchObject(DEFAULT_SPAWN);
    render(<WorldMapScreen />);
    expect(InputManager.get().screenContext).toBe('OVERWORLD');
    expect(screen.getByRole('tab', { name: 'Contratos do Mundo Real' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(screen.queryByRole('tab', { name: 'Fendas Dimensionais' })).not.toBeInTheDocument();
    expect(screen.getByTestId('world-vehicle')).toHaveTextContent('Veículo: A Pé / Bicicleta');
    expect(screen.getByRole('img', { name: 'Minimapa' })).toHaveAttribute('width', '160');
    // No spawn, a porta fica a 1 tile: fora do raio de interação.
    expect(screen.queryByTestId('world-prompt')).not.toBeInTheDocument();
  });

  it('na porta, mostra o prompt e INTERACT volta ao escritório salvando a posição', async () => {
    act(() => get().setAvatar({ ...DOOR, facing: 'E' }));
    render(<WorldMapScreen />);
    await frames(60);
    expect(screen.getByTestId('world-prompt')).toHaveTextContent('Entrar na sede');
    expect(
      screen.getByTestId('world-prompt').querySelector('[data-glyph-action="INTERACT"]'),
    ).not.toBeNull();
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(get().session.screen).toBe('OFFICE');
    expect(get().world.avatar).toMatchObject({ ...DOOR, facing: 'E' });
  });

  it('longe da porta, INTERACT não faz nada', () => {
    render(<WorldMapScreen />);
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(get().session.screen).toBe('WORLD_MAP');
  });

  it('pausado, INTERACT na porta não sai do mapa', () => {
    act(() => {
      get().setAvatar({ ...DOOR });
      get().setPaused(true);
    });
    render(<WorldMapScreen />);
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(get().session.screen).toBe('WORLD_MAP');
  });

  it('andar contra um prédio mostra a dica; a posição e a distância são gravadas', async () => {
    const { unmount } = render(<WorldMapScreen />);
    // Ao norte do spawn há um prédio.
    fireEvent.keyDown(window, { code: 'ArrowUp', key: 'ArrowUp' });
    expect(await screen.findByTestId('world-hint')).toHaveTextContent('Prédio — contorne pela rua');
    fireEvent.keyUp(window, { code: 'ArrowUp', key: 'ArrowUp' });
    // Para leste, pela calçada até a porta.
    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });
    await frames(120);
    fireEvent.keyUp(window, { code: 'KeyD', key: 'd' });
    await frames(AVATAR_SAVE_MS + 50);
    const saved = get().world.avatar;
    expect(saved.x).toBeGreaterThan(DEFAULT_SPAWN.x);
    expect(saved.facing).toBe('E');
    expect(get().stats.distanceTiles).toBeGreaterThan(0);
    unmount();
    expect(InputManager.get().screenContext).toBe('UI');
  });
});

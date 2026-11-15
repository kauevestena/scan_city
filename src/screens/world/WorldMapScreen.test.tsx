import { act, fireEvent, render, screen, within } from '@testing-library/react';
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

  it('no marcador do C00: prompt, INTERACT abre o briefing ao soltar a tecla, Esc fecha', async () => {
    render(<WorldMapScreen />);
    const c00 = WORLD_MAP.markers.find((m) => m.char === '0') as { x: number; y: number };
    // Teleporte (como o do painel de depuração): a store muda o avatar por fora do engine.
    act(() => get().setAvatar({ x: c00.x + 0.5, y: c00.y + 0.5 }));
    await frames(60);
    const prompt = screen.getByTestId('world-prompt');
    expect(prompt).toHaveTextContent('Ver contrato "Sítio do Avô"');
    expect(prompt).toHaveAttribute('data-target', 'C00');

    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    const dialog = screen.getByRole('dialog', { name: 'Sítio do Avô' });
    expect(InputManager.get().context).toBe('UI');
    expect(within(dialog).getAllByRole('listitem').length).toBeGreaterThanOrEqual(6);
    expect(within(dialog).getByRole('button', { name: 'Aceitar' })).toBeEnabled();

    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(get().session.paused).toBe(false);
    expect(InputManager.get().context).toBe('OVERWORLD');
  });

  it('pelo gamepad, o briefing abre na hora; Aceitar vai ao FIELD_SETUP', async () => {
    const c00 = WORLD_MAP.markers.find((m) => m.char === '0') as { x: number; y: number };
    act(() => get().setAvatar({ x: c00.x + 0.5, y: c00.y + 0.5 }));
    render(<WorldMapScreen />);
    const pad = {
      id: 'Xbox Wireless Controller',
      index: 0,
      connected: true,
      mapping: 'standard',
      axes: [0, 0, 0, 0],
      buttons: Array.from({ length: 17 }, (_, i) => ({ pressed: i === 0, value: i === 0 ? 1 : 0 })),
    };
    Object.defineProperty(navigator, 'getGamepads', { value: () => [pad], configurable: true });
    act(() => InputManager.get().poll(1));
    Object.defineProperty(navigator, 'getGamepads', { value: () => [], configurable: true });
    const dialog = screen.getByRole('dialog', { name: 'Sítio do Avô' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Aceitar' }));
    expect(get().session.screen).toBe('FIELD_SETUP');
    expect(get().mission.active?.contractId).toBe('C00');
  });

  describe('V (CYCLE_VEHICLE)', () => {
    const press = () => {
      fireEvent.keyDown(window, { code: 'KeyV', key: 'v' });
      fireEvent.keyUp(window, { code: 'KeyV', key: 'v' });
    };
    const vehicle = () => screen.getByTestId('world-vehicle').textContent;

    it('critério 4: com a picape, V passa por Picape e volta a A Pé (só os possuídos)', () => {
      act(() =>
        useGameStore.setState((s) => ({
          inventory: { ...s.inventory, vehicles: ['FOOT_BIKE', 'PICKUP_4X4'] },
        })),
      );
      render(<WorldMapScreen />);
      expect(vehicle()).toBe('Veículo: A Pé / Bicicleta');
      press();
      expect(vehicle()).toBe('Veículo: Picape 4x4 Off-Road');
      press();
      expect(vehicle()).toBe('Veículo: A Pé / Bicicleta');
    });

    it('só A Pé: V não muda nada', () => {
      render(<WorldMapScreen />);
      press();
      expect(get().world.vehicleMode).toBe('FOOT_BIKE');
      expect(screen.queryByTestId('world-hint')).not.toBeInTheDocument();
    });

    it('recusa o modo que não cabe no tile e mostra a dica; o modo não muda', () => {
      // Numa trilha o carro não passa.
      const i = WORLD_MAP.tiles.indexOf('TRAIL');
      expect(i).toBeGreaterThanOrEqual(0);
      const x = (i % WORLD_MAP.width) + 0.5;
      const y = Math.floor(i / WORLD_MAP.width) + 0.5;
      act(() =>
        useGameStore.setState((s) => ({
          inventory: { ...s.inventory, vehicles: ['FOOT_BIKE', 'COMPACT_CAR'] },
        })),
      );
      render(<WorldMapScreen />);
      act(() => get().setAvatar({ x, y }));
      press();
      expect(get().world.vehicleMode).toBe('FOOT_BIKE');
      expect(screen.getByTestId('world-hint')).toHaveTextContent(/carros não passam/);
    });

    it('pausado, V não troca', () => {
      act(() =>
        useGameStore.setState((s) => ({
          inventory: { ...s.inventory, vehicles: ['FOOT_BIKE', 'PICKUP_4X4'] },
        })),
      );
      render(<WorldMapScreen />);
      act(() => get().setPaused(true));
      press();
      expect(get().world.vehicleMode).toBe('FOOT_BIKE');
    });
  });
});

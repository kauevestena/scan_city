import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { TIRE_REPAIR_TAPS, TOW_COST } from '@/data/fieldEvents';
import { InputManager } from '@/input/InputManager';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { WORLD_MAP } from '@/world/overworld/tiles';
import { createFieldEventRuntime } from './fieldEventDeps';
import { CattleBanner, FieldEventModal } from './FieldEventModal';
import { WorldMapScreen } from './WorldMapScreen';

const get = () => useGameStore.getState();
const toasts = () => get().session.toasts.map((t) => t.title);
const frames = (ms: number) => act(() => new Promise<void>((r) => setTimeout(r, ms)));

beforeEach(() => {
  resetGameStore();
  act(() => get().goTo('WORLD_MAP'));
});

function mount() {
  const runtime = createFieldEventRuntime();
  render(
    <>
      <CattleBanner runtime={runtime} />
      <FieldEventModal runtime={runtime} />
    </>,
  );
  return runtime;
}

describe('FieldEventModal — pneu furado', () => {
  it('mostra as duas escolhas; "Trocar pneu" vira o mash de INTERACT com a barra de progresso', () => {
    const runtime = mount();
    act(() => void runtime.trigger('FLAT_TIRE'));
    const dialog = screen.getByRole('dialog', { name: 'Pneu furado!' });
    expect(
      within(dialog).getByRole('button', { name: /Chamar guincho \(R\$\s150,00\)/ }),
    ).toBeEnabled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Trocar pneu' }));
    expect(screen.getByTestId('tire-repair')).toHaveTextContent(`0 / ${TIRE_REPAIR_TAPS}`);
    for (let i = 0; i < TIRE_REPAIR_TAPS; i++) act(() => void runtime.interact());
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toasts()).toContain('Pneu trocado. Boa viagem!');
  });

  it('guincho debita R$ 150; sem saldo, o botão fica desabilitado', () => {
    const runtime = mount();
    const before = get().player.money;
    act(() => void runtime.trigger('FLAT_TIRE'));
    fireEvent.click(screen.getByRole('button', { name: /Chamar guincho/ }));
    expect(get().player.money).toBe(before - TOW_COST);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    act(() => useGameStore.setState((s) => ({ player: { ...s.player, money: 100 } })));
    act(() => void runtime.trigger('FLAT_TIRE'));
    expect(screen.getByRole('button', { name: /Chamar guincho/ })).toBeDisabled();
  });
});

describe('FieldEventModal — marco, proprietário, gado', () => {
  it('marco geodésico: +50 XP, +R$ 100 e diálogo curto', () => {
    const runtime = mount();
    const { xp, money } = get().player;
    act(() => void runtime.trigger('LOST_BENCHMARK'));
    expect(get().player.xp).toBe(xp + 50);
    expect(get().player.money).toBe(money + 10_000);
    const dialog = screen.getByRole('dialog', { name: 'Marco geodésico perdido' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Anotar coordenadas' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(toasts().some((t) => t.includes('+50 XP'))).toBe(true);
  });

  it('proprietário: mostrar autorização (rep 30 < 40 → −1); café custa R$ 50 e dá +1', () => {
    const runtime = mount();
    act(() => void runtime.trigger('SUSPICIOUS_OWNER'));
    fireEvent.click(screen.getByRole('button', { name: 'Mostrar autorização' }));
    expect(get().player.reputation).toBe(29);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

    const money = get().player.money;
    act(() => void runtime.trigger('SUSPICIOUS_OWNER'));
    fireEvent.click(screen.getByRole('button', { name: /Pagar um café/ }));
    expect(get().player.reputation).toBe(30);
    expect(get().player.money).toBe(money - 5_000);
  });

  it('gado: o banner mostra a contagem e a buzina tira 1 s', () => {
    const runtime = mount();
    act(() => void runtime.trigger('CATTLE'));
    expect(screen.getByTestId('cattle-banner')).toHaveTextContent('3,0 s');
    act(() => void runtime.interact());
    expect(screen.getByTestId('cattle-banner')).toHaveTextContent('2,0 s');
    act(() => runtime.update(2.5));
    expect(screen.queryByTestId('cattle-banner')).not.toBeInTheDocument();
  });

  it('chuva e milho do Atlas são só toast: nenhum modal', () => {
    const runtime = mount();
    const corn = get().inventory.corn.stock;
    act(() => {
      runtime.trigger('SUDDEN_RAIN');
      runtime.trigger('ATLAS_FINDS_CORN');
    });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(get().inventory.corn.stock).toBe(corn + 3);
    expect(toasts()).toEqual(
      expect.arrayContaining([
        'Chuva repentina! Velocidade −30 % por 15 s',
        'Atlas achou milho! +3 no estoque',
      ]),
    );
  });
});

describe('WorldMapScreen com eventos', () => {
  const DOOR = { x: WORLD_MAP.door.x + 0.5, y: WORLD_MAP.door.y + 0.5 };

  it('pausa congela o timer do gado; sem pausa, ele corre', async () => {
    const runtime = createFieldEventRuntime();
    render(<WorldMapScreen eventRuntime={runtime} />);
    act(() => void runtime.trigger('CATTLE'));
    await frames(300);
    const running = runtime.state;
    expect(running).toMatchObject({ id: 'CATTLE' });
    expect((running as { remainingS: number }).remainingS).toBeLessThan(3);

    act(() => get().setPaused(true));
    await frames(50);
    const frozen = (runtime.state as { remainingS: number }).remainingS;
    await frames(500);
    expect((runtime.state as { remainingS: number }).remainingS).toBe(frozen);
    // Pausado, a buzina também não vale.
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    expect((runtime.state as { remainingS: number }).remainingS).toBe(frozen);
  });

  it('INTERACT no gado é buzina, não abre a porta da sede', () => {
    const runtime = createFieldEventRuntime();
    act(() => get().setAvatar({ ...DOOR }));
    render(<WorldMapScreen eventRuntime={runtime} />);
    act(() => void runtime.trigger('CATTLE'));
    fireEvent.keyDown(window, { code: 'Space', key: ' ' });
    fireEvent.keyUp(window, { code: 'Space', key: ' ' });
    expect(get().session.screen).toBe('WORLD_MAP');
    expect((runtime.state as { remainingS: number }).remainingS).toBe(2);
    expect(InputManager.get().screenContext).toBe('OVERWORLD');
  });

  it('com o pneu furado, o avatar não sai do lugar mesmo com a tecla de movimento', async () => {
    const runtime = createFieldEventRuntime();
    render(<WorldMapScreen eventRuntime={runtime} />);
    act(() => void runtime.trigger('FLAT_TIRE'));
    const { x, y } = get().world.avatar;
    fireEvent.keyDown(window, { code: 'KeyD', key: 'd' });
    await frames(300);
    fireEvent.keyUp(window, { code: 'KeyD', key: 'd' });
    expect(get().world.avatar).toMatchObject({ x, y });
  });
});

import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AudioEngine } from '@/audio/AudioEngine';
import { brl } from '@/data/catalog/money';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { CALIBRATION_MS, PerchPanel } from './PerchPanel';
import { OfficeScreen } from './OfficeScreen';

const get = () => useGameStore.getState();
const setCorn = (stock: number, crop: number) =>
  act(() =>
    useGameStore.setState((s) => ({
      inventory: { ...s.inventory, corn: { stock, crop } },
    })),
  );
const setMoney = (cents: number) =>
  act(() => useGameStore.setState((s) => ({ player: { ...s.player, money: cents } })));
const btn = (name: RegExp | string) => screen.getByRole('button', { name });

beforeEach(() => {
  resetGameStore();
});

describe('PerchPanel — milho e papo', () => {
  beforeEach(() => {
    render(<PerchPanel onClose={() => undefined} />);
  });

  it('gauge do papo e do estoque (inicial: papo 10/10, estoque 20)', () => {
    expect(screen.getByTestId('crop-value')).toHaveTextContent('Papo: 10 / 10');
    expect(screen.getByTestId('stock-value')).toHaveTextContent('Estoque: 20');
  });

  it('comprar 10 custa R$ 50 e comprar 50, R$ 250 (R$ 5 a unidade)', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setMoney(brl(1_000));
    expect(screen.getByRole('button', { name: /Comprar 10 \(R\$\s50,00\)/ })).toBeInTheDocument();
    fireEvent.click(btn(/Comprar 10/));
    expect(get().inventory.corn.stock).toBe(30);
    expect(get().player.money).toBe(brl(950));
    fireEvent.click(btn(/Comprar 50/));
    expect(get().inventory.corn.stock).toBe(80);
    expect(get().player.money).toBe(brl(700));
    expect(play).toHaveBeenCalledWith('CASH_REGISTER');
    expect(screen.getByTestId('stock-value')).toHaveTextContent('Estoque: 80');
  });

  it('sem saldo: DENIED e o estoque não muda', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setMoney(brl(20));
    fireEvent.click(btn(/Comprar 10/));
    expect(get().inventory.corn.stock).toBe(20);
    expect(get().player.money).toBe(brl(20));
    expect(play).toHaveBeenCalledWith('DENIED');
  });

  it('alimentar enche o papo com o estoque, até 10, e arrulha', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setCorn(20, 4);
    fireEvent.click(btn('Alimentar'));
    expect(get().inventory.corn).toEqual({ stock: 14, crop: 10 });
    expect(play).toHaveBeenCalledWith('PIGEON_COO');
    expect(screen.getByTestId('crop-value')).toHaveTextContent('Papo: 10 / 10');
  });

  it('com estoque menor que o espaço, passa só o que há', () => {
    setCorn(3, 4);
    fireEvent.click(btn('Alimentar'));
    expect(get().inventory.corn).toEqual({ stock: 0, crop: 7 });
  });

  it('papo cheio: Alimentar desabilitado com a dica; estoque 0: "Compre milho"', () => {
    expect(btn('Alimentar')).toBeDisabled();
    expect(screen.getByTestId('feed-hint')).toHaveTextContent('O papo já está cheio');
    setCorn(0, 3);
    expect(btn('Alimentar')).toBeDisabled();
    expect(screen.getByTestId('feed-hint')).toHaveTextContent('Compre milho');
    expect(get().feedAtlas()).toBe(0);
    expect(get().inventory.corn).toEqual({ stock: 0, crop: 3 });
  });
});

describe('PerchPanel — calibrar a câmera', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    render(<PerchPanel onClose={() => undefined} />);
  });
  afterEach(() => vi.useRealTimers());

  it('2 s de animação e depois a calibração vale 3 voos (grátis)', () => {
    const money = get().player.money;
    expect(screen.getByTestId('calibration-status')).toHaveTextContent('nenhuma');
    fireEvent.click(btn('Calibrar câmera'));
    expect(btn('Calibrando…')).toBeDisabled();
    act(() => vi.advanceTimersByTime(CALIBRATION_MS - 300));
    expect(get().inventory.atlasCalibrationFlights).toBe(0);
    act(() => vi.advanceTimersByTime(400));
    expect(get().inventory.atlasCalibrationFlights).toBe(3);
    expect(screen.getByTestId('calibration-status')).toHaveTextContent('3 voos restantes');
    expect(get().player.money).toBe(money);
    expect(btn('Calibrar câmera')).toBeEnabled();
    expect(get().session.toasts.at(-1)?.title).toBe('Câmera do Atlas calibrada para 3 voos');
  });

  it('recalibrar enche de volta para 3, sem passar disso', () => {
    act(() =>
      useGameStore.setState((s) => ({ inventory: { ...s.inventory, atlasCalibrationFlights: 1 } })),
    );
    fireEvent.click(btn('Calibrar câmera'));
    act(() => vi.advanceTimersByTime(CALIBRATION_MS + 200));
    expect(get().inventory.atlasCalibrationFlights).toBe(3);
  });
});

describe('PerchPanel — acessórios', () => {
  beforeEach(() => {
    render(<PerchPanel onClose={() => undefined} />);
  });
  const card = (id: string) => screen.getByTestId(`shop-item-${id}`);

  it('lista os acessórios: o "sem acessório" equipado, os pagos à venda e os bloqueados com o motivo', () => {
    expect(card('ATLAS_NONE')).toHaveAttribute('data-state', 'OWNED');
    expect(within(card('ATLAS_NONE')).getByRole('button', { name: 'Equipado' })).toBeDisabled();
    expect(card('ATLAS_GOGGLES')).toHaveAttribute('data-state', 'BUY');
    expect(card('ATLAS_GPS_PACK')).toHaveAttribute('data-state', 'LOCKED');
    expect(within(card('ATLAS_GPS_PACK')).getByTestId('locked-reason')).toHaveTextContent(
      /Kit GNSS RTK/,
    );
    expect(card('ATLAS_LAUREL')).toHaveAttribute('data-state', 'LOCKED');
  });

  it('comprar e equipar o óculos de aviador', () => {
    setMoney(brl(1_000));
    fireEvent.click(within(card('ATLAS_GOGGLES')).getByRole('button', { name: 'Comprar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Comprar' }));
    expect(get().inventory.cosmetics).toContain('ATLAS_GOGGLES');
    expect(get().player.money).toBe(brl(700));
    fireEvent.click(within(card('ATLAS_GOGGLES')).getByRole('button', { name: 'Equipar' }));
    expect(get().inventory.equipped.atlasAccessory).toBe('ATLAS_GOGGLES');
    expect(within(card('ATLAS_GOGGLES')).getByRole('button', { name: 'Equipado' })).toBeDisabled();
    // Volta a "sem acessório".
    fireEvent.click(within(card('ATLAS_NONE')).getByRole('button', { name: 'Equipar' }));
    expect(get().inventory.equipped.atlasAccessory).toBe('ATLAS_NONE');
  });

  it('a mochila GPS destrava ao possuir o kit GNSS RTK', () => {
    act(() =>
      useGameStore.setState((s) => ({
        inventory: { ...s.inventory, fieldEquipment: ['TOTAL_STATION', 'GNSS_RTK_KIT'] },
      })),
    );
    expect(card('ATLAS_GPS_PACK')).toHaveAttribute('data-state', 'BUY');
  });
});

describe('Poleiro no escritório', () => {
  it('o hotspot abre o painel e o Atlas arrulha (PIGEON_COO) ao clicar', () => {
    get().setFlags({ introSeen: true });
    const play = vi.spyOn(AudioEngine.get(), 'play');
    render(<OfficeScreen />);
    fireEvent.click(screen.getByRole('button', { name: /Poleiro/ }));
    expect(screen.getByTestId('perch-panel')).toBeInTheDocument();
    expect(play).toHaveBeenCalledWith('PIGEON_COO');
    fireEvent.keyDown(window, { code: 'Escape' });
    expect(screen.queryByTestId('perch-panel')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Poleiro/ })).toHaveFocus();
  });
});

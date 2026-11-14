import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { AudioEngine } from '@/audio/AudioEngine';
import { brl } from '@/data/catalog/money';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { GaragePanel } from './GaragePanel';
import { WorkstationPanel } from './WorkstationPanel';

const get = () => useGameStore.getState();
const setMoney = (cents: number) =>
  act(() => useGameStore.setState((s) => ({ player: { ...s.player, money: cents } })));
const own = (patch: Partial<ReturnType<typeof get>['inventory']>) =>
  act(() => useGameStore.setState((s) => ({ inventory: { ...s.inventory, ...patch } })));
const card = (id: string) => screen.getByTestId(`shop-item-${id}`);
const tab = (name: RegExp | string) => fireEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => {
  resetGameStore();
  render(<GaragePanel onClose={() => undefined} />);
});

describe('GaragePanel — abas e cards', () => {
  it('cinco abas; a primeira lista as aeronaves com o estado de cada card', () => {
    const names = within(screen.getByRole('tablist'))
      .getAllByRole('tab')
      .map((t) => t.textContent);
    expect(names).toEqual([
      'Aeronaves',
      'Sensores & Lentes',
      'Veículos',
      'Equipamento de Campo',
      'Pintura',
    ]);
    expect(card('ATLAS')).toHaveAttribute('data-state', 'OWNED');
    expect(card('ATLAS')).toHaveTextContent('Possuído');
    expect(card('DRONE_T1')).toHaveAttribute('data-state', 'BUY');
    expect(card('DRONE_T2')).toHaveAttribute('data-state', 'LOCKED');
    expect(card('VTOL_T3')).toHaveAttribute('data-state', 'LOCKED');
  });

  it('bloqueado mostra "Requer <item>" e não tem botão de compra', () => {
    expect(within(card('DRONE_T2')).getByTestId('locked-reason')).toHaveTextContent(
      'Bloqueado: Requer Drone Amador "Faísca"',
    );
    expect(within(card('DRONE_T2')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(card('DRONE_T1')).getByRole('button', { name: 'Comprar' })).toBeInTheDocument();
  });

  it('cada card traz a tabela de especificações técnicas', () => {
    const t1 = within(card('DRONE_T1'));
    expect(t1.getByText('Autonomia')).toBeInTheDocument();
    expect(t1.getByText('Multirrotor')).toBeInTheDocument();
    expect(t1.getByText('Altura (AGL)')).toBeInTheDocument();
    expect(within(card('ATLAS')).getByText('10 unidades de milho')).toBeInTheDocument();
  });

  it('Sensores & Lentes: câmeras, lentes e o pod LiDAR; o pod exige o VTOL T3', () => {
    tab('Sensores & Lentes');
    expect(card('CAM_PIGEON')).toHaveAttribute('data-state', 'OWNED');
    expect(card('CAM_45MP_FF')).toHaveAttribute('data-state', 'BUY');
    expect(card('LENS_24')).toBeInTheDocument();
    expect(card('POD_LIDAR')).toHaveAttribute('data-state', 'LOCKED');
    expect(within(card('POD_LIDAR')).getByText('Pulsos/s')).toBeInTheDocument();
  });

  it('Veículos e Equipamento de Campo, com as especificações de cada um', () => {
    tab('Veículos');
    expect(card('FOOT_BIKE')).toHaveAttribute('data-state', 'OWNED');
    expect(within(card('LAB_VAN')).getByText('Sim (×2,5)')).toBeInTheDocument();
    expect(within(card('PICKUP_4X4')).getByText('Brejo').nextSibling).toHaveTextContent('Sim');
    tab('Equipamento de Campo');
    expect(card('TOTAL_STATION')).toHaveAttribute('data-state', 'OWNED');
    expect(within(card('GNSS_RTK_KIT')).getByText('Pontos (GCP + CP)')).toBeInTheDocument();
  });
});

describe('GaragePanel — compra', () => {
  it('critério 2: R$ 7.300 e o T1 → confirma, o saldo vai a R$ 1.300, o card vira "Possuído" e toca CASH_REGISTER', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setMoney(brl(7_300));
    fireEvent.click(within(card('DRONE_T1')).getByRole('button', { name: 'Comprar' }));
    // A compra pede confirmação, com o preço.
    const dialog = screen.getByRole('dialog', { name: /Comprar Drone Amador/ });
    expect(dialog).toHaveTextContent('R$');
    expect(get().player.money).toBe(brl(7_300));
    fireEvent.click(within(dialog).getByRole('button', { name: 'Comprar' }));
    expect(get().player.money).toBe(brl(1_300));
    expect(play).toHaveBeenCalledWith('CASH_REGISTER');
    expect(card('DRONE_T1')).toHaveAttribute('data-state', 'OWNED');
    // O T2 destrava (T1 possuído).
    expect(card('DRONE_T2')).not.toHaveAttribute('data-state', 'LOCKED');
  });

  it('cancelar a confirmação não compra nada', () => {
    setMoney(brl(7_300));
    fireEvent.click(within(card('DRONE_T1')).getByRole('button', { name: 'Comprar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancelar' }));
    expect(get().player.money).toBe(brl(7_300));
    expect(card('DRONE_T1')).toHaveAttribute('data-state', 'BUY');
  });

  it('sem saldo: sem diálogo, DENIED e o toast diz quanto falta', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setMoney(brl(5_000));
    fireEvent.click(within(card('DRONE_T1')).getByRole('button', { name: 'Comprar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(play).toHaveBeenCalledWith('DENIED');
    expect(get().session.toasts.at(-1)?.title).toMatch(/Saldo insuficiente/);
    expect(get().player.money).toBe(brl(5_000));
  });

  it('desconto shopPrice (GES_3): o preço mostra o valor com 15 % a menos e o original riscado', () => {
    act(() => useGameStore.setState({ skills: ['GES_3'] }));
    const price = within(screen.getByTestId('price-DRONE_T1'));
    expect(price.getByText(/5\.100/)).toBeInTheDocument();
    expect(price.getByText(/de .*6\.000/)).toBeInTheDocument();
    setMoney(brl(5_200));
    fireEvent.click(within(card('DRONE_T1')).getByRole('button', { name: 'Comprar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Comprar' }));
    expect(get().player.money).toBe(brl(100));
  });

  it('combo T2: o card avisa os itens do combo; já tendo a câmera, só adiciona o que falta', () => {
    own({ aircraft: ['ATLAS', 'DRONE_T1'] });
    setMoney(brl(200_000));
    expect(card('DRONE_T2')).toHaveTextContent('inclui a câmera de 45 MP');
    own({ sensors: ['CAM_PIGEON', 'CAM_45MP_FF'], lenses: ['LENS_35'] });
    expect(card('DRONE_T2')).toHaveTextContent('Você já possui:');
    expect(card('DRONE_T2')).toHaveTextContent('sem reembolso');
    fireEvent.click(within(card('DRONE_T2')).getByRole('button', { name: 'Comprar' }));
    const dialog = screen.getByRole('dialog');
    // Só o kit GNSS falta.
    expect(dialog).toHaveTextContent('itens que faltam (Kit GNSS RTK Base + Rover)');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Comprar' }));
    expect(get().inventory.fieldEquipment).toContain('GNSS_RTK_KIT');
    expect(get().inventory.sensors.filter((s) => s === 'CAM_45MP_FF')).toHaveLength(1);
  });
});

describe('GaragePanel — pintura', () => {
  it('compra a tinta, depois equipa; a equipada fica marcada', () => {
    tab('Pintura');
    const ids = screen
      .getAllByTestId(/^shop-item-/)
      .map((el) => el.getAttribute('data-testid')?.replace('shop-item-', '') as string);
    expect(ids).toContain('PAINT_GREY');
    expect(card('PAINT_GREY')).toHaveAttribute('data-state', 'OWNED');
    expect(within(card('PAINT_GREY')).getByRole('button', { name: 'Equipado' })).toBeDisabled();
    const other = ids.find((id) => id !== 'PAINT_GREY') as string;
    const price = card(other).textContent;
    expect(price).toContain('R$');
    setMoney(brl(1_000_000));
    fireEvent.click(within(card(other)).getByRole('button', { name: 'Comprar' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Comprar' }));
    expect(get().inventory.cosmetics).toContain(other);
    fireEvent.click(within(card(other)).getByRole('button', { name: 'Equipar' }));
    expect(get().inventory.equipped.dronePaint).toBe(other);
    expect(within(card(other)).getByRole('button', { name: 'Equipado' })).toBeDisabled();
  });
});

describe('Workstation — aba Hardware', () => {
  it('sequencial: atual, próximo com compra e os seguintes sem botão; o anterior vira "Substituído"', () => {
    render(<WorkstationPanel onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hardware' }));
    const hw = (id: string) => screen.getByTestId(`hardware-${id}`);
    expect(hw('OLD_LAPTOP')).toHaveAttribute('data-state', 'CURRENT');
    expect(hw('GAMER_PC')).toHaveAttribute('data-state', 'NEXT');
    expect(hw('MULTI_GPU_WS')).toHaveAttribute('data-state', 'LOCKED');
    expect(within(hw('MULTI_GPU_WS')).queryByRole('button')).not.toBeInTheDocument();
    expect(within(hw('CLOUD')).queryByRole('button')).not.toBeInTheDocument();

    setMoney(brl(10_000));
    fireEvent.click(within(hw('GAMER_PC')).getByRole('button', { name: /Comprar/ }));
    expect(get().inventory.hardware).toBe('GAMER_PC');
    expect(get().player.money).toBe(brl(1_000));
    expect(hw('OLD_LAPTOP')).toHaveAttribute('data-state', 'REPLACED');
    expect(hw('OLD_LAPTOP')).toHaveTextContent('Substituído');
    expect(hw('GAMER_PC')).toHaveAttribute('data-state', 'CURRENT');
    expect(hw('MULTI_GPU_WS')).toHaveAttribute('data-state', 'NEXT');
  });

  it('sem saldo para o próximo: DENIED e o hardware não muda', () => {
    render(<WorkstationPanel onClose={() => undefined} />);
    fireEvent.click(screen.getByRole('tab', { name: 'Hardware' }));
    setMoney(brl(100));
    fireEvent.click(
      within(screen.getByTestId('hardware-GAMER_PC')).getByRole('button', { name: /Comprar/ }),
    );
    expect(get().inventory.hardware).toBe('OLD_LAPTOP');
    expect(get().session.toasts.at(-1)?.title).toMatch(/Saldo insuficiente/);
  });
});

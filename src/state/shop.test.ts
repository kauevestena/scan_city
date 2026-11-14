import { AudioEngine } from '@/audio/AudioEngine';
import { brl } from '@/data/catalog/money';
import { canBuy, shopItem } from '@/domain/economy';
import { unlockStateFrom } from '@/domain/progression';
import { resetGameStore } from '@/test/resetStore';
import { useGameStore } from './store';

const get = () => useGameStore.getState();
const setMoney = (cents: number) =>
  useGameStore.setState((s) => ({ player: { ...s.player, money: cents } }));
const own = (patch: Partial<ReturnType<typeof get>['inventory']>) =>
  useGameStore.setState((s) => ({ inventory: { ...s.inventory, ...patch } }));
const toasts = () => get().session.toasts.map((t) => t.title);

beforeEach(() => resetGameStore());

describe('buyItem — critério 2 de office §8', () => {
  it('R$ 7.300 e o Drone T1: o saldo vai a R$ 1.300, o item entra e toca CASH_REGISTER', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setMoney(brl(7_300));
    expect(get().inventory.aircraft).not.toContain('DRONE_T1');
    expect(get().buyItem('DRONE_T1')).toBe(true);
    expect(get().player.money).toBe(brl(1_300));
    expect(get().inventory.aircraft).toContain('DRONE_T1');
    expect(play).toHaveBeenCalledWith('CASH_REGISTER');
    expect(toasts()).toContain('Comprado: Drone Amador "Faísca"');
    expect(get().session.transactions.at(-1)).toMatchObject({ amount: -brl(6_000) });
  });

  it('sem saldo: DENIED, toast com o que falta e nada muda', () => {
    const play = vi.spyOn(AudioEngine.get(), 'play');
    setMoney(brl(5_000));
    expect(get().buyItem('DRONE_T1')).toBe(false);
    expect(get().player.money).toBe(brl(5_000));
    expect(get().inventory.aircraft).not.toContain('DRONE_T1');
    expect(play).toHaveBeenCalledWith('DENIED');
    expect(play).not.toHaveBeenCalledWith('CASH_REGISTER');
    expect(toasts().some((t) => t.startsWith('Saldo insuficiente'))).toBe(true);
  });

  it('já possuído: recusa sem cobrar', () => {
    setMoney(brl(10_000));
    expect(get().buyItem('ATLAS')).toBe(false);
    expect(get().player.money).toBe(brl(10_000));
    expect(toasts()).toContain('Você já possui este item');
  });
});

describe('cadeias de tier e pré-requisitos', () => {
  const check = (id: string) => {
    const s = get();
    return canBuy(shopItem(id), {
      money: s.player.money,
      inventory: s.inventory,
      unlock: unlockStateFrom(s),
      shopPriceMod: 1,
    });
  };

  it('T2 exige o T1; T3 exige o T2; o pod exige o T3', () => {
    setMoney(brl(1_000_000));
    expect(check('DRONE_T2')).toEqual({
      ok: false,
      reason: 'Exige possuir Drone Amador "Faísca"',
    });
    expect(check('VTOL_T3').ok).toBe(false);
    expect(check('POD_LIDAR').ok).toBe(false);
    own({ aircraft: ['ATLAS', 'DRONE_T1'] });
    expect(check('DRONE_T2').ok).toBe(true);
    expect(get().buyItem('VTOL_T3')).toBe(false);
  });

  it('hardware é sempre o próximo da sequência; os anteriores contam como possuídos', () => {
    setMoney(brl(1_000_000));
    expect(check('MULTI_GPU_WS').reason).toBe('Exige possuir PC Gamer');
    expect(get().buyItem('CLOUD')).toBe(false);
    expect(get().buyItem('GAMER_PC')).toBe(true);
    expect(get().inventory.hardware).toBe('GAMER_PC');
    // O notebook (o anterior) agora é "possuído" e não pode ser recomprado.
    expect(get().buyItem('OLD_LAPTOP')).toBe(false);
    expect(get().buyItem('MULTI_GPU_WS')).toBe(true);
    expect(get().inventory.hardware).toBe('MULTI_GPU_WS');
  });
});

describe('combo T2 (ADR-015)', () => {
  it('sem nada: entrega T2 + câmera 45 MP + lente 35 + kit GNSS RTK', () => {
    own({ aircraft: ['ATLAS', 'DRONE_T1'] });
    setMoney(brl(1_000_000));
    expect(get().buyItem('DRONE_T2')).toBe(true);
    const inv = get().inventory;
    expect(inv.aircraft).toContain('DRONE_T2');
    expect(inv.sensors).toContain('CAM_45MP_FF');
    expect(inv.lenses).toContain('LENS_35');
    expect(inv.fieldEquipment).toContain('GNSS_RTK_KIT');
    expect(get().player.money).toBe(brl(1_000_000) - brl(70_000));
  });

  it('já com a câmera: só adiciona os itens que faltam, sem reembolso (mesmo preço)', () => {
    own({
      aircraft: ['ATLAS', 'DRONE_T1'],
      sensors: ['CAM_PIGEON', 'CAM_45MP_FF'],
      lenses: ['LENS_35'],
    });
    setMoney(brl(1_000_000));
    expect(get().buyItem('DRONE_T2')).toBe(true);
    const inv = get().inventory;
    // Sem duplicatas.
    expect(inv.sensors.filter((s) => s === 'CAM_45MP_FF')).toHaveLength(1);
    expect(inv.lenses.filter((l) => l === 'LENS_35')).toHaveLength(1);
    expect(inv.fieldEquipment).toContain('GNSS_RTK_KIT');
    expect(get().player.money).toBe(brl(1_000_000) - brl(70_000));
  });
});

describe('desconto shopPrice (GES_3)', () => {
  it('a habilidade tira 15 % do preço cobrado e conta no canBuy', () => {
    useGameStore.setState({ skills: ['GES_3'] });
    setMoney(brl(5_200));
    // T1: R$ 6.000 × 0,85 = R$ 5.100: cabe nos R$ 5.200.
    expect(get().buyItem('DRONE_T1')).toBe(true);
    expect(get().player.money).toBe(brl(100));
  });

  it('sem a habilidade, os mesmos R$ 5.200 não bastam', () => {
    setMoney(brl(5_200));
    expect(get().buyItem('DRONE_T1')).toBe(false);
  });
});

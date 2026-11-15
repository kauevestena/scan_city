import { FINALE_REWARD } from '@/data/office';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';

const get = () => useGameStore.getState();

beforeEach(() => resetGameStore());

describe('completeFinale (REQ-CNT-008)', () => {
  it('marca o final como visto, entrega o chapéu do avô e mostra o toast; o chapéu não é equipado sozinho', () => {
    expect(FINALE_REWARD).toBe('CHAR_GRANDPA_HAT');
    expect(get().inventory.cosmetics).not.toContain(FINALE_REWARD);
    get().completeFinale();
    expect(get().flags.finaleSeen).toBe(true);
    expect(get().inventory.cosmetics).toContain(FINALE_REWARD);
    expect(get().inventory.equipped.character).toBe('CHAR_VEST');
    const toasts = get().session.toasts.filter((t) => t.title === 'Museu da Terra inaugurado!');
    expect(toasts).toHaveLength(1);
    expect(toasts[0]?.type).toBe('success');
  });

  it('só vale uma vez: repetir não duplica o chapéu nem o toast', () => {
    get().completeFinale();
    get().completeFinale();
    expect(get().inventory.cosmetics.filter((c) => c === FINALE_REWARD)).toHaveLength(1);
    expect(
      get().session.toasts.filter((t) => t.title === 'Museu da Terra inaugurado!'),
    ).toHaveLength(1);
  });

  it('se o chapéu já foi comprado (grátis, pelo desbloqueio), o inventário não muda', () => {
    useGameStore.setState((s) => ({
      inventory: { ...s.inventory, cosmetics: [...s.inventory.cosmetics, FINALE_REWARD] },
    }));
    const before = get().inventory;
    get().completeFinale();
    expect(get().inventory).toBe(before);
    expect(get().flags.finaleSeen).toBe(true);
  });
});

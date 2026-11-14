import {
  BENCHMARK_REWARD,
  BENCHMARK_XP,
  CATTLE_BLOCK_S,
  FOUND_CORN,
  HONK_RELIEF_S,
  OWNER_COFFEE_COST,
  RAIN_DURATION_S,
  TIRE_REPAIR_TAPS,
  TOW_COST,
} from '@/data/fieldEvents';
import {
  FieldEventRuntime,
  type FieldEventDeps,
  type FieldEventMessages,
} from './fieldEventRuntime';

const MESSAGES: FieldEventMessages = {
  tireFixed: 'pneu',
  towed: 'guincho',
  cattleCleared: 'liberou',
  benchmark: 'marco',
  ownerShowGood: 'bom',
  ownerShowBad: 'ruim',
  ownerCoffee: 'café',
  rain: 'chuva',
  corn: 'milho',
  reasons: { tow: 'tow', coffee: 'coffee', benchmark: 'benchmark' },
};

function setup(over: { reputation?: number; money?: number } = {}) {
  const log: string[] = [];
  const bank = { money: over.money ?? 100_000 };
  const deps: FieldEventDeps = {
    reputation: () => over.reputation ?? 30,
    earn: (c, r) => {
      bank.money += c;
      log.push(`earn ${c} ${r}`);
    },
    spend: (c, r) => {
      if (c > bank.money) return false;
      bank.money -= c;
      log.push(`spend ${c} ${r}`);
      return true;
    },
    grantXp: (n) => log.push(`xp ${n}`),
    changeReputation: (d) => log.push(`rep ${d}`),
    addCorn: (n) => log.push(`corn ${n}`),
    sfx: (id) => log.push(`sfx ${id}`),
    notify: (k, t) => log.push(`toast ${k} ${t}`),
  };
  return { rt: new FieldEventRuntime(deps, MESSAGES), log, bank };
}

describe('FLAT_TIRE — pneu furado', () => {
  it('para o avatar até reparar; 10 toques de INTERACT trocam o pneu', () => {
    const { rt, log } = setup();
    rt.trigger('FLAT_TIRE');
    expect(rt.state).toEqual({ id: 'FLAT_TIRE', phase: 'CHOICE' });
    expect(rt.blocking).toBe(true);
    // Na escolha, INTERACT não conta (os botões respondem).
    expect(rt.interact()).toBe(false);
    rt.chooseTire('REPAIR');
    for (let i = 1; i < TIRE_REPAIR_TAPS; i++) {
      expect(rt.interact()).toBe(true);
      expect(rt.state).toEqual({ id: 'FLAT_TIRE', phase: 'REPAIR', taps: i });
      expect(rt.blocking).toBe(true);
    }
    expect(rt.interact()).toBe(true);
    expect(rt.state).toBeNull();
    expect(rt.blocking).toBe(false);
    expect(log).toContain('toast success pneu');
  });

  it('guincho: custa R$ 150 e libera; sem saldo, segue parado e nada é cobrado', () => {
    const rich = setup();
    rich.rt.trigger('FLAT_TIRE');
    rich.rt.chooseTire('TOW');
    expect(rich.rt.state).toBeNull();
    expect(rich.log).toContain(`spend ${TOW_COST} tow`);
    expect(TOW_COST).toBe(15_000);

    const poor = setup({ money: TOW_COST - 1 });
    poor.rt.trigger('FLAT_TIRE');
    poor.rt.chooseTire('TOW');
    expect(poor.rt.state).toEqual({ id: 'FLAT_TIRE', phase: 'CHOICE' });
    expect(poor.log.some((l) => l.startsWith('spend'))).toBe(false);
  });

  it('o tempo não destrava o pneu (não há timer)', () => {
    const { rt } = setup();
    rt.trigger('FLAT_TIRE');
    rt.update(60);
    expect(rt.state).toEqual({ id: 'FLAT_TIRE', phase: 'CHOICE' });
  });
});

describe('CATTLE — gado na pista', () => {
  it('bloqueia por 3 s e libera sozinho', () => {
    const { rt, log } = setup();
    rt.trigger('CATTLE');
    expect(rt.blocking).toBe(true);
    expect(rt.state).toEqual({ id: 'CATTLE', remainingS: CATTLE_BLOCK_S });
    rt.update(1);
    expect(rt.state).toEqual({ id: 'CATTLE', remainingS: 2 });
    rt.update(1.95);
    expect(rt.state).toMatchObject({ id: 'CATTLE' });
    rt.update(0.1);
    expect(rt.state).toBeNull();
    expect(rt.blocking).toBe(false);
    expect(log).toContain('toast info liberou');
  });

  it('cada buzina (INTERACT) tira 1 s, com mínimo 0', () => {
    const { rt } = setup();
    rt.trigger('CATTLE');
    expect(rt.interact()).toBe(true);
    expect(rt.state).toEqual({ id: 'CATTLE', remainingS: CATTLE_BLOCK_S - HONK_RELIEF_S });
    rt.interact();
    expect(rt.state).toEqual({ id: 'CATTLE', remainingS: 1 });
    rt.interact();
    expect(rt.state).toBeNull();
    expect(rt.interact()).toBe(false);
  });

  it('só republica quando o décimo de segundo mostrado muda', () => {
    const { rt } = setup();
    rt.trigger('CATTLE');
    let notified = 0;
    rt.subscribe(() => notified++);
    for (let i = 0; i < 30; i++) rt.update(1 / 60);
    // 0,5 s a 60 Hz: 5 décimos, não 30 notificações.
    expect(notified).toBeLessThanOrEqual(6);
    expect(notified).toBeGreaterThanOrEqual(4);
  });
});

describe('LOST_BENCHMARK, SUSPICIOUS_OWNER, SUDDEN_RAIN, ATLAS_FINDS_CORN', () => {
  it('marco geodésico: +50 XP, +R$ 100, COLLECT, toast e um diálogo curto', () => {
    const { rt, log, bank } = setup({ money: 0 });
    rt.trigger('LOST_BENCHMARK');
    expect(bank.money).toBe(BENCHMARK_REWARD);
    expect(BENCHMARK_REWARD).toBe(10_000);
    expect(log).toEqual(
      expect.arrayContaining([`xp ${BENCHMARK_XP}`, 'sfx COLLECT', 'toast success marco']),
    );
    expect(rt.state).toEqual({ id: 'LOST_BENCHMARK' });
    rt.acknowledge();
    expect(rt.state).toBeNull();
  });

  it('proprietário: autorização com reputação ≥ 40 dá +1; abaixo, −1', () => {
    const good = setup({ reputation: 40 });
    good.rt.trigger('SUSPICIOUS_OWNER');
    good.rt.chooseOwner('SHOW');
    expect(good.log).toContain('rep 1');
    expect(good.rt.state).toBeNull();
    const bad = setup({ reputation: 39 });
    bad.rt.trigger('SUSPICIOUS_OWNER');
    bad.rt.chooseOwner('SHOW');
    expect(bad.log).toContain('rep -1');
  });

  it('proprietário: o café custa R$ 50 e dá +1; sem saldo, a escolha não vale', () => {
    const ok = setup();
    ok.rt.trigger('SUSPICIOUS_OWNER');
    ok.rt.chooseOwner('COFFEE');
    expect(ok.log).toEqual(expect.arrayContaining([`spend ${OWNER_COFFEE_COST} coffee`, 'rep 1']));
    expect(OWNER_COFFEE_COST).toBe(5_000);
    const poor = setup({ money: 100 });
    poor.rt.trigger('SUSPICIOUS_OWNER');
    poor.rt.chooseOwner('COFFEE');
    expect(poor.rt.state).toEqual({ id: 'SUSPICIOUS_OWNER' });
    expect(poor.log.some((l) => l.startsWith('rep'))).toBe(false);
  });

  it('chuva: −30 % de velocidade por 15 s, sem bloquear nem abrir modal', () => {
    const { rt, log } = setup();
    expect(rt.speedFactor).toBe(1);
    rt.trigger('SUDDEN_RAIN');
    expect(rt.state).toBeNull();
    expect(rt.blocking).toBe(false);
    expect(rt.rainActive).toBe(true);
    expect(rt.speedFactor).toBeCloseTo(0.7, 12);
    expect(log).toContain('toast warn chuva');
    rt.update(RAIN_DURATION_S - 0.5);
    expect(rt.rainActive).toBe(true);
    rt.update(0.6);
    expect(rt.rainActive).toBe(false);
    expect(rt.speedFactor).toBe(1);
  });

  it('Atlas acha milho: +3 no estoque, PIGEON_COO e toast, sem modal', () => {
    const { rt, log } = setup();
    rt.trigger('ATLAS_FINDS_CORN');
    expect(log).toEqual(
      expect.arrayContaining([`corn ${FOUND_CORN}`, 'sfx PIGEON_COO', 'toast success milho']),
    );
    expect(FOUND_CORN).toBe(3);
    expect(rt.state).toBeNull();
  });

  it('um evento por vez: durante um modal, outro sorteio é ignorado', () => {
    const { rt } = setup();
    expect(rt.trigger('SUSPICIOUS_OWNER')).toBe(true);
    expect(rt.trigger('CATTLE')).toBe(false);
    expect(rt.state).toEqual({ id: 'SUSPICIOUS_OWNER' });
  });
});

/**
 * Estado de um evento de campo em curso (world-map §5.5, catalog §12). Sem React nem store:
 * os efeitos saem por `deps`. Os timers andam em `update(dt)`, que o `GameLoop` deixa de chamar
 * com o jogo pausado — assim a pausa congela o evento.
 */
import {
  BENCHMARK_REWARD,
  BENCHMARK_XP,
  CATTLE_BLOCK_S,
  FOUND_CORN,
  HONK_RELIEF_S,
  OWNER_COFFEE_COST,
  OWNER_REPUTATION_THRESHOLD,
  RAIN_DURATION_S,
  RAIN_SPEED_FACTOR,
  TIRE_REPAIR_TAPS,
  TOW_COST,
} from '@/data/fieldEvents';
import type { FieldEventId } from '@/domain/fieldEvents';
import type { CentsBRL } from '@/types';

/** Estado visível do evento ativo (`null` = nada em curso). */
export type FieldEventState =
  | { id: 'FLAT_TIRE'; phase: 'CHOICE' }
  | { id: 'FLAT_TIRE'; phase: 'REPAIR'; taps: number }
  | { id: 'CATTLE'; remainingS: number }
  | { id: 'LOST_BENCHMARK' }
  | { id: 'SUSPICIOUS_OWNER' };

export type FlatTireChoice = 'REPAIR' | 'TOW';
export type OwnerChoice = 'SHOW' | 'COFFEE';

export interface FieldEventDeps {
  reputation(): number;
  earn(cents: CentsBRL, reason: string): void;
  /** Debita se houver saldo; `false` (e aviso de saldo) se não. */
  spend(cents: CentsBRL, reason: string): boolean;
  grantXp(amount: number): void;
  changeReputation(delta: number): void;
  addCorn(amount: number): void;
  sfx(id: 'COLLECT' | 'PIGEON_COO' | 'RTH_BEEP' | 'ALERT'): void;
  /** Mensagem passiva (toast). */
  notify(kind: 'info' | 'success' | 'warn', text: string): void;
}

/** Mensagens que o runtime emite; o texto vem de `STRINGS` (injetado, para não acoplar). */
export interface FieldEventMessages {
  tireFixed: string;
  towed: string;
  cattleCleared: string;
  benchmark: string;
  ownerShowGood: string;
  ownerShowBad: string;
  ownerCoffee: string;
  rain: string;
  corn: string;
  reasons: { tow: string; coffee: string; benchmark: string };
}

export class FieldEventRuntime {
  private current: FieldEventState | null = null;
  private rainLeftS = 0;
  private cattleLeftS = 0;
  private readonly listeners = new Set<() => void>();
  /** Última exibição do gado, em décimos de segundo (só notifica ao mudar). */
  private shownTenths = 0;

  constructor(
    private readonly deps: FieldEventDeps,
    private readonly messages: FieldEventMessages,
  ) {}

  get state(): FieldEventState | null {
    return this.current;
  }

  get rainActive(): boolean {
    return this.rainLeftS > 0;
  }

  /** O avatar não anda enquanto um evento exige atenção. */
  get blocking(): boolean {
    return this.current !== null;
  }

  /** Fator de velocidade vigente (chuva: −30 %). */
  get speedFactor(): number {
    return this.rainLeftS > 0 ? RAIN_SPEED_FACTOR : 1;
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  };

  private set(next: FieldEventState | null): void {
    this.current = next;
    this.listeners.forEach((fn) => fn());
  }

  /** Dispara um evento sorteado; ignora se já há um em curso. Devolve se foi aceito. */
  trigger(id: FieldEventId): boolean {
    if (this.current) return false;
    if (id === 'SUDDEN_RAIN') {
      this.rainLeftS = RAIN_DURATION_S;
      this.deps.notify('warn', this.messages.rain);
      this.listeners.forEach((fn) => fn());
    } else if (id === 'ATLAS_FINDS_CORN') {
      this.deps.addCorn(FOUND_CORN);
      this.deps.sfx('PIGEON_COO');
      this.deps.notify('success', this.messages.corn);
    } else if (id === 'FLAT_TIRE') {
      this.deps.sfx('ALERT');
      this.set({ id, phase: 'CHOICE' });
    } else if (id === 'CATTLE') {
      this.cattleLeftS = CATTLE_BLOCK_S;
      this.shownTenths = Math.ceil(CATTLE_BLOCK_S * 10);
      this.set({ id, remainingS: this.shownTenths / 10 });
    } else if (id === 'LOST_BENCHMARK') {
      // Os efeitos entram na hora; o diálogo só conta o achado.
      this.deps.grantXp(BENCHMARK_XP);
      this.deps.earn(BENCHMARK_REWARD, this.messages.reasons.benchmark);
      this.deps.sfx('COLLECT');
      this.deps.notify('success', this.messages.benchmark);
      this.set({ id });
    } else if (id === 'SUSPICIOUS_OWNER') {
      this.set({ id: 'SUSPICIOUS_OWNER' });
    }
    return true;
  }

  /** Avança os timers (gado e chuva). Não é chamado com o jogo pausado. */
  update(dtS: number): void {
    if (this.rainLeftS > 0) {
      const was = this.rainLeftS;
      this.rainLeftS = Math.max(0, this.rainLeftS - dtS);
      if (was > 0 && this.rainLeftS === 0) this.listeners.forEach((fn) => fn());
    }
    if (this.current?.id === 'CATTLE') this.advanceCattle(this.cattleLeftS - dtS);
  }

  /** O gado só republica o estado quando o décimo de segundo mostrado muda. */
  private advanceCattle(leftS: number): void {
    this.cattleLeftS = Math.max(0, leftS);
    if (this.cattleLeftS <= 0) {
      this.deps.notify('info', this.messages.cattleCleared);
      this.set(null);
      return;
    }
    const tenths = Math.ceil(this.cattleLeftS * 10 - 1e-9);
    if (tenths !== this.shownTenths) {
      this.shownTenths = tenths;
      this.set({ id: 'CATTLE', remainingS: tenths / 10 });
    }
  }

  /**
   * `INTERACT` (ou confirmar): buzina o gado ou troca o pneu. Devolve `true` se o toque foi
   * consumido pelo evento (o mapa não deve tratá-lo como interação com porta/marcador).
   */
  interact(): boolean {
    const cur = this.current;
    if (!cur) return false;
    if (cur.id === 'CATTLE') {
      this.deps.sfx('RTH_BEEP');
      this.advanceCattle(this.cattleLeftS - HONK_RELIEF_S);
      return true;
    }
    if (cur.id === 'FLAT_TIRE' && cur.phase === 'REPAIR') {
      const taps = cur.taps + 1;
      if (taps >= TIRE_REPAIR_TAPS) {
        this.deps.notify('success', this.messages.tireFixed);
        this.set(null);
      } else {
        this.set({ id: 'FLAT_TIRE', phase: 'REPAIR', taps });
      }
      return true;
    }
    return false;
  }

  /** Escolha do pneu furado: trocar (mash de `INTERACT`) ou chamar o guincho. */
  chooseTire(choice: FlatTireChoice): void {
    const cur = this.current;
    if (cur?.id !== 'FLAT_TIRE' || cur.phase !== 'CHOICE') return;
    if (choice === 'REPAIR') {
      this.set({ id: 'FLAT_TIRE', phase: 'REPAIR', taps: 0 });
    } else if (this.deps.spend(TOW_COST, this.messages.reasons.tow)) {
      this.deps.notify('info', this.messages.towed);
      this.set(null);
    }
  }

  /** Escolha do proprietário desconfiado. */
  chooseOwner(choice: OwnerChoice): void {
    if (this.current?.id !== 'SUSPICIOUS_OWNER') return;
    if (choice === 'SHOW') {
      const good = this.deps.reputation() >= OWNER_REPUTATION_THRESHOLD;
      this.deps.changeReputation(good ? 1 : -1);
      this.deps.notify(
        good ? 'success' : 'warn',
        good ? this.messages.ownerShowGood : this.messages.ownerShowBad,
      );
    } else {
      if (!this.deps.spend(OWNER_COFFEE_COST, this.messages.reasons.coffee)) return;
      this.deps.changeReputation(1);
      this.deps.notify('success', this.messages.ownerCoffee);
    }
    this.set(null);
  }

  /** Fecha o diálogo do marco geodésico. */
  acknowledge(): void {
    if (this.current?.id === 'LOST_BENCHMARK') this.set(null);
  }
}

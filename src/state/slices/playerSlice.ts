import type { StateCreator } from 'zustand';
import { AudioEngine } from '@/audio/AudioEngine';
import { STRINGS } from '@/data/strings';
import { formatBRL } from '@/lib/format';
import { clamp } from '@/lib/math';
import type { SaveGame } from '@/types';
import type { GameStore, PlayerActions, SessionState, Transaction } from '../types';

export const MAX_TRANSACTIONS = 50;

/** progression §3 */
export function initialPlayer(): SaveGame['player'] {
  return {
    name: STRINGS.player.defaultName,
    money: 500_000,
    xp: 0,
    level: 1,
    skillPoints: 0,
    reputation: 30,
  };
}

export function initialStaff(): SaveGame['staff'] {
  return { INTERN: 0, JUNIOR_ENG: 0 };
}

export function initialStats(): SaveGame['stats'] {
  return { contractsCompleted: 0, photosTaken: 0, flightTimeS: 0, crashes: 0, distanceTiles: 0 };
}

export function initialFlags(): SaveGame['flags'] {
  return { introSeen: false, finaleSeen: false, tutorialStep: 0 };
}

function withTransaction(session: SessionState, amount: number, reason: string): SessionState {
  const entry: Transaction = { at: Date.now(), amount, reason };
  return { ...session, transactions: [...session.transactions, entry].slice(-MAX_TRANSACTIONS) };
}

type PlayerSlice = Pick<
  GameStore,
  'player' | 'skills' | 'staff' | 'stats' | 'flags' | 'souvenirs'
> &
  PlayerActions;

export const createPlayerSlice: StateCreator<GameStore, [], [], PlayerSlice> = (set, get) => ({
  player: initialPlayer(),
  skills: [],
  staff: initialStaff(),
  stats: initialStats(),
  flags: initialFlags(),
  souvenirs: [],

  earn: (amount, reason) => {
    const cents = Math.max(0, Math.round(amount));
    set((s) => ({
      player: { ...s.player, money: s.player.money + cents },
      session: withTransaction(s.session, cents, reason),
    }));
  },

  spend: (amount, reason) => {
    const cents = Math.max(0, Math.round(amount));
    const { money } = get().player;
    if (cents > money) {
      AudioEngine.get().play('DENIED');
      get().pushToast({
        type: 'error',
        title: STRINGS.economy.insufficientFunds(formatBRL(cents - money)),
      });
      return false;
    }
    set((s) => ({
      player: { ...s.player, money: s.player.money - cents },
      session: withTransaction(s.session, -cents, reason),
    }));
    return true;
  },

  changeReputation: (delta) =>
    set((s) => ({
      player: { ...s.player, reputation: clamp(s.player.reputation + delta, 0, 100) },
    })),
});

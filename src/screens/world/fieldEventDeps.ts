/** Liga o runtime dos eventos de campo à store, ao áudio e aos textos (world-map §5.5). */
import { AudioEngine } from '@/audio/AudioEngine';
import { BENCHMARK_REWARD, BENCHMARK_XP, FOUND_CORN } from '@/data/fieldEvents';
import { STRINGS } from '@/data/strings';
import { FieldEventRuntime } from '@/engines/overworld/fieldEventRuntime';
import { formatBRL } from '@/lib/format';
import { useGameStore } from '@/state/store';

const E = STRINGS.world.events;

export function createFieldEventRuntime(): FieldEventRuntime {
  const get = useGameStore.getState;
  return new FieldEventRuntime(
    {
      reputation: () => get().player.reputation,
      earn: (cents, reason) => get().earn(cents, reason),
      spend: (cents, reason) => get().spend(cents, reason),
      grantXp: (amount) => get().grantXp(amount),
      changeReputation: (delta) => get().changeReputation(delta),
      addCorn: (amount) => get().addCorn(amount),
      sfx: (id) => AudioEngine.get().play(id),
      notify: (type, title) => get().pushToast({ type, title }),
    },
    {
      tireFixed: E.FLAT_TIRE.fixed,
      towed: E.FLAT_TIRE.towed,
      cattleCleared: E.CATTLE.cleared,
      benchmark: E.LOST_BENCHMARK.reward(BENCHMARK_XP, formatBRL(BENCHMARK_REWARD)),
      ownerShowGood: E.SUSPICIOUS_OWNER.showGood,
      ownerShowBad: E.SUSPICIOUS_OWNER.showBad,
      ownerCoffee: E.SUSPICIOUS_OWNER.coffeeGood,
      rain: E.SUDDEN_RAIN.toast,
      corn: E.ATLAS_FINDS_CORN.toast(FOUND_CORN),
      reasons: {
        tow: E.FLAT_TIRE.title,
        coffee: E.SUSPICIOUS_OWNER.title,
        benchmark: E.LOST_BENCHMARK.title,
      },
    },
  );
}

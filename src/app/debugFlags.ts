import { SCREEN_IDS } from '@/state/machine';
import type { ScreenId } from '@/types';

/** Flags de depuração da query string (architecture §7). */
export interface DebugFlags {
  /** `debug=1`: libera todos os demais parâmetros. */
  debug: boolean;
  /** Sobrescreve a seed global (eventos e rival). */
  seed: number | null;
  screen: ScreenId | 'UIKIT' | 'SOUNDBOARD' | null;
  /** Contrato usado pelos payloads de teste. */
  contract: string | null;
  autopilot: boolean;
  unlockAll: boolean;
  /** Saldo inicial em reais. */
  money: number | null;
  skipIntro: boolean;
}

export const NO_DEBUG: DebugFlags = {
  debug: false,
  seed: null,
  screen: null,
  contract: null,
  autopilot: false,
  unlockAll: false,
  money: null,
  skipIntro: false,
};

const DEBUG_SCREENS: readonly string[] = [...SCREEN_IDS, 'UIKIT', 'SOUNDBOARD'];

function numberParam(params: URLSearchParams, key: string): number | null {
  const raw = params.get(key);
  if (raw === null || raw.trim() === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

/** Sem `debug=1`, todos os parâmetros são ignorados (REQ-CORE-007). */
export function parseDebugFlags(search: string): DebugFlags {
  const params = new URLSearchParams(search);
  if (params.get('debug') !== '1') return NO_DEBUG;
  const screen = params.get('screen');
  const contract = params.get('contract');
  return {
    debug: true,
    seed: numberParam(params, 'seed'),
    screen:
      screen !== null && DEBUG_SCREENS.includes(screen) ? (screen as DebugFlags['screen']) : null,
    contract: contract !== null && contract !== '' ? contract : null,
    autopilot: params.get('autopilot') === '1',
    unlockAll: params.get('unlockAll') === '1',
    money: numberParam(params, 'money'),
    skipIntro: params.get('skipIntro') === '1',
  };
}

let cached: DebugFlags | null = null;

/** Flags da URL atual, lidas uma vez. */
export function getDebugFlags(): DebugFlags {
  cached ??= parseDebugFlags(window.location.search);
  return cached;
}

/** Só para testes: força a releitura da URL. */
export function resetDebugFlagsCache(): void {
  cached = null;
}

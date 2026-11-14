/** Junta classes, ignorando valores vazios. */
export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

/** Foco visível padrão (input §5). */
/**
 * Foco visível padrão (input §5). Com o gamepad ativo (`data-input-device="GAMEPAD"` na
 * raiz), o foco programático também mostra o anel, já que `:focus-visible` não o cobre.
 */
export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-cyan-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950 pad:focus:ring-2 pad:focus:ring-cyan-400 pad:focus:ring-offset-2 pad:focus:ring-offset-slate-950';

export type StatusTone = 'ok' | 'warn' | 'danger' | 'neutral';

export const TONE_TEXT: Record<StatusTone, string> = {
  ok: 'text-emerald-400',
  warn: 'text-amber-400',
  danger: 'text-rose-500',
  neutral: 'text-cyan-300',
};

export const TONE_BG: Record<StatusTone, string> = {
  ok: 'bg-emerald-400',
  warn: 'bg-amber-400',
  danger: 'bg-rose-500',
  neutral: 'bg-cyan-400',
};

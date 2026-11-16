import { Lightbulb, X } from 'lucide-react';
import { useEffect } from 'react';
import { STRINGS } from '@/data/strings';
import type { ButtonAction } from '@/input/actions';
import { InputGlyph } from '@/input/InputGlyph';
import { InputManager } from '@/input/InputManager';
import { useGameStore } from '@/state/store';
import { cx, FOCUS_RING } from '@/ui';

const T = STRINGS.tutorial;
export const TUTORIAL_STEPS = T.steps.length;

/** Avança o tutorial se ele estiver exatamente na etapa `step` (cada dica aparece uma vez). */
export function completeTutorialStep(step: number): void {
  const { flags, setFlags } = useGameStore.getState();
  if (flags.tutorialStep === step) setFlags({ tutorialStep: step + 1 });
}

/**
 * Dica do tutorial dirigido (contracts-real, C00): contextual e não bloqueante. Aparece
 * só na etapa corrente; "Entendi" (ou a ação da dica) avança `flags.tutorialStep`. O botão
 * não é alcançável pelo foco nas telas de jogo (o `Tab` e as setas têm outro uso), então a
 * ação `DISMISS_HINT` (`H`, `View` no gamepad) faz o mesmo (REQ-NFR-007, REQ-INP-006).
 */
export function TutorialHint({ step, className }: { step: number; className?: string }) {
  const current = useGameStore((s) => s.flags.tutorialStep);
  const hint = T.steps[step];
  const shown = current === step && hint !== undefined;
  useEffect(() => {
    if (!shown) return;
    return InputManager.get().onAction((e) => {
      if (e.action === 'DISMISS_HINT' && !useGameStore.getState().session.paused) {
        completeTutorialStep(step);
      }
    });
  }, [shown, step]);
  if (!shown || !hint) return null;
  return (
    <div
      role="note"
      aria-label={T.label}
      data-testid="tutorial-hint"
      data-step={step}
      className={cx(
        'pointer-events-auto flex items-center gap-3 rounded-lg border border-amber-400/70 bg-slate-950/90 px-3 py-2 text-sm text-amber-100 shadow-lg',
        className,
      )}
    >
      <Lightbulb size={18} className="shrink-0 text-amber-300" aria-hidden />
      <span className="flex items-center gap-1.5">
        {hint.before}
        {hint.action && <InputGlyph action={hint.action as ButtonAction} />}
        {hint.after}
      </span>
      <InputGlyph action="DISMISS_HINT" />
      <button
        type="button"
        aria-label={T.dismiss}
        onClick={() => completeTutorialStep(step)}
        className={cx('rounded p-1 text-amber-200 hover:bg-amber-400/10', FOCUS_RING)}
      >
        <X size={16} aria-hidden />
      </button>
    </div>
  );
}

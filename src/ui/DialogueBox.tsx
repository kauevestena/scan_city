import { ChevronDown } from 'lucide-react';
import { useEffect, useState } from 'react';
import { STRINGS } from '@/data/strings';
import type { PortraitSpec } from '@/types';
import { cx, FOCUS_RING } from './classes';
import { EmblemBadge } from './EmblemBadge';

export interface DialogueBoxProps {
  speaker: PortraitSpec & { name: string };
  lines: readonly string[];
  onDone: () => void;
}

export const DIALOGUE_CHARS_PER_S = 40;

/**
 * Caixa de diálogo com máquina de escrever (40 car/s).
 * Um clique (ou Enter/Espaço) completa a linha atual; o seguinte avança; no fim, chama `onDone`.
 */
export function DialogueBox({ speaker, lines, onDone }: DialogueBoxProps) {
  const [cursor, setCursor] = useState({ line: 0, chars: 0 });
  const text = lines[cursor.line] ?? '';
  const complete = cursor.chars >= text.length;

  useEffect(() => {
    if (complete) return;
    const timer = window.setInterval(() => {
      setCursor((c) => ({ ...c, chars: c.chars + 1 }));
    }, 1000 / DIALOGUE_CHARS_PER_S);
    return () => window.clearInterval(timer);
  }, [complete, cursor.line]);

  const advance = () => {
    if (!complete) setCursor((c) => ({ ...c, chars: text.length }));
    else if (cursor.line < lines.length - 1) setCursor({ line: cursor.line + 1, chars: 0 });
    else onDone();
  };

  return (
    <button
      type="button"
      data-focusable
      onClick={advance}
      aria-label={STRINGS.ui.dialogueNext}
      className={cx(
        'flex w-full items-start gap-4 rounded-lg border border-slate-700 bg-slate-900/95 p-4 text-left',
        FOCUS_RING,
      )}
    >
      <EmblemBadge emblem={speaker} size={56} title={speaker.name} />
      <span className="flex min-h-16 min-w-0 flex-1 flex-col gap-1">
        <span className="text-xs font-semibold tracking-widest text-cyan-400 uppercase">
          {speaker.name}
        </span>
        <span className="text-sm text-slate-100" data-testid="dialogue-text" aria-live="polite">
          {text.slice(0, cursor.chars)}
        </span>
      </span>
      <ChevronDown
        size={20}
        strokeWidth={1.75}
        aria-hidden
        className={cx('shrink-0 self-end text-cyan-400', complete ? 'opacity-100' : 'opacity-0')}
      />
    </button>
  );
}

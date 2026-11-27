import { X } from 'lucide-react';
import { useId, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { STRINGS } from '@/data/strings';
import { useFocusNavigation } from '@/input/useFocusNavigation';
import { cx, FOCUS_RING } from './classes';
import { useDialogFocus } from './useDialogFocus';

export type ModalSize = 'sm' | 'md' | 'lg' | 'xl';

export interface ModalProps {
  open: boolean;
  title: string;
  onClose?: () => void;
  size?: ModalSize;
  /** Permite fechar com Esc, com o botão ✕ e clicando fora. */
  dismissable?: boolean;
  footer?: ReactNode;
  children: ReactNode;
}

const SIZE: Record<ModalSize, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-3xl',
  xl: 'max-w-5xl',
};

export { focusableElements } from './useDialogFocus';

export function Modal({
  open,
  title,
  onClose,
  size = 'md',
  dismissable = true,
  footer,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // Camada modal de input: contexto UI, setas/D-pad navegam, UI_BACK (Esc, B/○) fecha.
  useFocusNavigation(dialogRef, {
    modal: true,
    wrap: true,
    active: open,
    onBack: dismissable ? onClose : undefined,
  });

  // `aria-modal`: o foco entra ao abrir, não escapa (nem com Tab, nem com um controle de trás que
  // se foca sozinho) e volta a quem abriu ao fechar (a armadilha é compartilhada com o exame dos
  // souvenirs, ADR-036).
  const onKeyDown = useDialogFocus(dialogRef, open);

  if (!open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-6"
      data-testid="modal-overlay"
      onMouseDown={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose?.();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={onKeyDown}
        className={cx(
          'flex max-h-full w-full flex-col rounded-lg border border-slate-700 bg-slate-900 shadow-[0_0_24px_rgba(34,211,238,0.15)] outline-none',
          SIZE[size],
        )}
      >
        <header className="flex items-center justify-between gap-4 border-b border-slate-800 px-5 py-3">
          <h2
            id={titleId}
            className="text-sm font-semibold tracking-widest text-cyan-400 uppercase"
          >
            {title}
          </h2>
          {dismissable && onClose && (
            <button
              type="button"
              data-focusable
              data-modal-close
              aria-label={STRINGS.ui.close}
              onClick={onClose}
              className={cx(
                'flex h-8 w-8 items-center justify-center rounded-md text-slate-400 hover:bg-slate-800 hover:text-slate-100',
                FOCUS_RING,
              )}
            >
              <X size={16} strokeWidth={1.75} aria-hidden />
            </button>
          )}
        </header>
        <div className="overflow-y-auto px-5 py-4 text-sm text-slate-100">{children}</div>
        {footer && (
          <footer className="flex justify-end gap-2 border-t border-slate-800 px-5 py-3">
            {footer}
          </footer>
        )}
      </div>
    </div>,
    document.body,
  );
}

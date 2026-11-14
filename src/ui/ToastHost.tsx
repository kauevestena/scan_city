import { useEffect } from 'react';
import { STRINGS } from '@/data/strings';
import { Toast, type ToastData } from './Toast';
import { useGameStore } from '@/state/store';

export const TOAST_MAX_VISIBLE = 4;
export const TOAST_DURATION_MS = 4000;

function TimedToast({ toast, onDismiss }: { toast: ToastData; onDismiss: (id: string) => void }) {
  const { id } = toast;
  // O relógio de 4 s começa quando o toast fica visível (os excedentes aguardam na fila).
  useEffect(() => {
    const timer = window.setTimeout(() => onDismiss(id), TOAST_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [id, onDismiss]);
  return <Toast {...toast} onDismiss={() => onDismiss(id)} />;
}

/** Pilha de toasts no canto superior direito: até 4 visíveis, 4 s cada (REQ-UI-004). */
export function ToastHost() {
  const toasts = useGameStore((s) => s.session.toasts);
  const dismissToast = useGameStore((s) => s.dismissToast);
  return (
    <div
      aria-label={STRINGS.ui.notifications}
      className="pointer-events-none fixed top-14 right-4 z-[60] flex flex-col gap-2"
    >
      {toasts.slice(0, TOAST_MAX_VISIBLE).map((toast) => (
        <TimedToast key={toast.id} toast={toast} onDismiss={dismissToast} />
      ))}
    </div>
  );
}

import { useCallback, useEffect, type KeyboardEvent, type RefObject } from 'react';

const FOCUSABLE =
  '[data-focusable]:not([disabled]):not([aria-disabled="true"]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled])';

export function focusableElements(root: HTMLElement): HTMLElement[] {
  return Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.tabIndex >= 0 || el.getAttribute('role') === 'tab',
  );
}

/** Onde o foco entra no diálogo: o primeiro controle que não seja o ✕ de fechar (ou o próprio). */
function entryPoint(dialog: HTMLElement): HTMLElement {
  return (
    dialog.querySelector<HTMLElement>('[data-dialog-initial]:not([disabled])') ??
    focusableElements(dialog).find((el) => !el.hasAttribute('data-modal-close')) ??
    dialog
  );
}

/** Diálogos abertos, do mais antigo ao mais novo: só o do topo segura o foco. */
const openDialogs: HTMLElement[] = [];

/**
 * A armadilha de foco de um diálogo modal (`aria-modal`, REQ-INP-006): o foco entra ao abrir (no
 * `[data-dialog-initial]` ou no primeiro controle), não sai com o `Tab` nem com algo que se foque
 * sozinho atrás, e volta a quem abriu ao fechar. Devolve o `onKeyDown` do diálogo (o `Tab`).
 */
export function useDialogFocus(
  dialogRef: RefObject<HTMLElement | null>,
  open: boolean,
): (e: KeyboardEvent<HTMLElement>) => void {
  // O guarda vem antes do efeito de entrada: ao fechar, ele sai antes de o foco ser devolvido.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!open || !dialog) return;
    openDialogs.push(dialog);
    const onFocusIn = (e: FocusEvent) => {
      if (openDialogs[openDialogs.length - 1] !== dialog) return;
      if (e.target instanceof Node && dialog.contains(e.target)) return;
      entryPoint(dialog).focus();
    };
    document.addEventListener('focusin', onFocusIn);
    return () => {
      document.removeEventListener('focusin', onFocusIn);
      const at = openDialogs.indexOf(dialog);
      if (at >= 0) openDialogs.splice(at, 1);
    };
  }, [dialogRef, open]);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    if (dialog) entryPoint(dialog).focus();
    return () => {
      previous?.focus();
    };
  }, [dialogRef, open]);

  // Tab e Shift+Tab ficam presos no diálogo; o Esc chega como UI_BACK pelo InputManager.
  return useCallback(
    (e: KeyboardEvent<HTMLElement>) => {
      if (e.key !== 'Tab') return;
      const dialog = dialogRef.current;
      if (!dialog) return;
      const items = focusableElements(dialog);
      e.preventDefault();
      if (items.length === 0) {
        dialog.focus();
        return;
      }
      const index = items.indexOf(document.activeElement as HTMLElement);
      const next = e.shiftKey
        ? index <= 0
          ? items.length - 1
          : index - 1
        : index < 0 || index === items.length - 1
          ? 0
          : index + 1;
      items[next]?.focus();
    },
    [dialogRef],
  );
}

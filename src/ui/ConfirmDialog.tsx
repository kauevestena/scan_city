import { STRINGS } from '@/data/strings';
import { Button } from './Button';
import { Modal } from './Modal';

export interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/** Confirmação in-app; substitui `window.confirm` (REQ-CORE-009). */
export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel = STRINGS.ui.cancel,
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      open
      title={title}
      size="sm"
      onClose={onCancel}
      footer={
        <>
          <Button variant="ghost" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-slate-300">{message}</p>
    </Modal>
  );
}

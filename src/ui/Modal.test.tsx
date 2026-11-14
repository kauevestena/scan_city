import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { Button } from './Button';
import { ConfirmDialog } from './ConfirmDialog';
import { Modal } from './Modal';

function Harness({ dismissable = true }: { dismissable?: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Abrir</Button>
      <Modal
        open={open}
        title="Briefing"
        dismissable={dismissable}
        onClose={() => setOpen(false)}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Recusar</Button>
            <Button onClick={() => setOpen(false)}>Aceitar</Button>
          </>
        }
      >
        <p>Conteúdo</p>
      </Modal>
    </>
  );
}

describe('Modal', () => {
  it('não renderiza nada fechado', () => {
    render(<Harness />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('Esc fecha quando dismissable e devolve o foco a quem abriu', () => {
    render(<Harness />);
    const opener = screen.getByRole('button', { name: 'Abrir' });
    opener.focus();
    fireEvent.click(opener);
    const dialog = screen.getByRole('dialog', { name: 'Briefing' });
    expect(screen.getByRole('button', { name: 'Recusar' })).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(opener).toHaveFocus();
  });

  it('Esc e clique fora não fecham quando não dismissable', () => {
    render(<Harness dismissable={false} />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    fireEvent.mouseDown(screen.getByTestId('modal-overlay'));
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Fechar' })).not.toBeInTheDocument();
  });

  it('clique fora fecha quando dismissable', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    fireEvent.mouseDown(screen.getByTestId('modal-overlay'));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('prende o foco: Tab e Shift+Tab ciclam entre os focáveis do modal', () => {
    render(<Harness />);
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog');
    const close = screen.getByRole('button', { name: 'Fechar' });
    const refuse = screen.getByRole('button', { name: 'Recusar' });
    const accept = screen.getByRole('button', { name: 'Aceitar' });

    expect(refuse).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(accept).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(close).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(accept).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(close).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Abrir' })).not.toHaveFocus();
  });

  it('sem focáveis, o foco fica no próprio diálogo', () => {
    render(
      <Modal open title="Aviso" dismissable={false}>
        <p>Só texto</p>
      </Modal>,
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(dialog).toHaveFocus();
  });
});

describe('ConfirmDialog', () => {
  it('confirma, cancela e fecha com Esc', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(
      <ConfirmDialog
        title="Novo jogo"
        message="Todo o progresso será perdido."
        confirmLabel="Recomeçar"
        danger
        onConfirm={onConfirm}
        onCancel={onCancel}
      />,
    );
    expect(screen.getByText('Todo o progresso será perdido.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Recomeçar' }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(2);
  });
});

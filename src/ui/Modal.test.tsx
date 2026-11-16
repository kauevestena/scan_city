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

  it('o foco não fica fora do modal: o que o leva para fora (ou para o corpo, com Tab) o traz de volta', () => {
    render(
      <>
        <button type="button">Fundo</button>
        <Harness />
      </>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const dialog = screen.getByRole('dialog', { name: 'Briefing' });
    expect(screen.getByRole('button', { name: 'Recusar' })).toHaveFocus();
    // Um controle de trás que se foca sozinho volta ao primeiro controle do modal.
    screen.getByRole('button', { name: 'Fundo' }).focus();
    expect(dialog).toContainElement(document.activeElement as HTMLElement);
    expect(screen.getByRole('button', { name: 'Recusar' })).toHaveFocus();
  });

  it('com modais empilhados só o do topo segura o foco; ao fechar o de cima, o de baixo volta a valer', () => {
    function Stack() {
      const [outer, setOuter] = useState(true);
      const [inner, setInner] = useState(false);
      return (
        <>
          <button type="button">Fundo</button>
          <Modal open={outer} title="Externo" onClose={() => setOuter(false)}>
            <Button onClick={() => setInner(true)}>Confirmar…</Button>
          </Modal>
          <Modal open={inner} title="Interno" onClose={() => setInner(false)}>
            <Button onClick={() => setInner(false)}>Sim</Button>
          </Modal>
        </>
      );
    }
    render(<Stack />);
    const outer = screen.getByRole('dialog', { name: 'Externo' });
    fireEvent.click(screen.getByRole('button', { name: 'Confirmar…' }));
    const inner = screen.getByRole('dialog', { name: 'Interno' });
    expect(screen.getByRole('button', { name: 'Sim' })).toHaveFocus();
    // Fora de tudo: o foco volta ao do topo, não ao externo.
    screen.getByRole('button', { name: 'Fundo' }).focus();
    expect(inner).toContainElement(document.activeElement as HTMLElement);
    // O interno fecha: o foco volta a quem o abriu, dentro do externo.
    fireEvent.click(screen.getByRole('button', { name: 'Sim' }));
    expect(screen.queryByRole('dialog', { name: 'Interno' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Confirmar…' })).toHaveFocus();
    screen.getByRole('button', { name: 'Fundo' }).focus();
    expect(outer).toContainElement(document.activeElement as HTMLElement);
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

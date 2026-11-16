import { render } from '@testing-library/react';
import { Sparkles } from 'lucide-react';
import { Toast, type ToastType } from './Toast';

const TYPES: readonly ToastType[] = ['info', 'success', 'warn', 'error', 'money', 'rift'];

/** O ícone (o primeiro svg, o do tipo) de um toast. */
function iconOf(type: ToastType, icon?: typeof Sparkles): string {
  const { container, unmount } = render(<Toast type={type} title="Aviso" icon={icon} />);
  const svg = container.querySelector('svg');
  // Só as classes do ícone (`lucide lucide-info`), sem a cor do tipo.
  const name = (svg?.getAttribute('class') ?? '')
    .split(' ')
    .filter((c) => c.startsWith('lucide'))
    .join(' ');
  unmount();
  return name;
}

describe('Toast: ícone por tipo (REQ-UI-004)', () => {
  it('cada tipo tem o seu ícone, decorativo (aria-hidden)', () => {
    const icons = TYPES.map((type) => iconOf(type));
    for (const icon of icons) expect(icon).toContain('lucide');
    expect(new Set(icons).size).toBe(TYPES.length);
    const { container } = render(<Toast type="money" title="Pagamento" />);
    expect(container.querySelector('svg')).toHaveAttribute('aria-hidden', 'true');
  });

  it('um ícone próprio da mensagem tem prioridade sobre o do tipo', () => {
    expect(iconOf('info', Sparkles)).toBe(iconOf('rift'));
  });

  it('erros e avisos são alertas (leitor de tela); o resto, status', () => {
    for (const type of TYPES) {
      const { container, unmount } = render(<Toast type={type} title="Aviso" />);
      const role = container.firstElementChild?.getAttribute('role');
      expect(role).toBe(type === 'error' || type === 'warn' ? 'alert' : 'status');
      unmount();
    }
  });

  it('cada tipo tem a sua cor de borda (o ícone e a borda seguem a paleta)', () => {
    const borders = TYPES.map((type) => {
      const { container, unmount } = render(<Toast type={type} title="Aviso" />);
      const cls = container.firstElementChild?.className ?? '';
      unmount();
      return /border-(cyan|emerald|amber|rose|lime|violet)-\d+\/60/.exec(cls)?.[0];
    });
    expect(borders.every(Boolean)).toBe(true);
    expect(new Set(borders).size).toBe(TYPES.length);
  });
});

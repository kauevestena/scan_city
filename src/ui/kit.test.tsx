import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { Camera } from 'lucide-react';
import { Button } from './Button';
import { ChecklistItem } from './ChecklistItem';
import { cx } from './classes';
import { EmblemBadge } from './EmblemBadge';
import { Gauge, gaugeTone } from './Gauge';
import { FALLBACK_ICON, hasIcon, iconByName, registerIcons } from './iconRegistry';
import { MoneyText } from './MoneyText';
import { Panel } from './Panel';
import { ProgressBar } from './ProgressBar';
import { Stat } from './Stat';
import { nextEnabledTab, Tabs } from './Tabs';
import { Tooltip } from './Tooltip';

const plain = (s: string | null) => (s ?? '').replace(/\s/g, ' ');

describe('Button', () => {
  it('é focável, dispara onClick e expõe o glyph', () => {
    const onClick = vi.fn();
    render(
      <Button variant="primary" icon={Camera} glyph="INTERACT" onClick={onClick}>
        Decolar
      </Button>,
    );
    const button = screen.getByRole('button', { name: 'Decolar' });
    expect(button).toHaveAttribute('data-focusable');
    expect(button).toHaveAttribute('data-glyph', 'INTERACT');
    fireEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('loading e disabled bloqueiam o clique', () => {
    const onClick = vi.fn();
    render(
      <>
        <Button loading onClick={onClick}>
          A
        </Button>
        <Button disabled onClick={onClick}>
          B
        </Button>
      </>,
    );
    const [a, b] = screen.getAllByRole('button');
    expect(a).toBeDisabled();
    expect(a).toHaveAttribute('aria-busy', 'true');
    expect(b).toBeDisabled();
    fireEvent.click(a as HTMLElement);
    fireEvent.click(b as HTMLElement);
    expect(onClick).not.toHaveBeenCalled();
  });
});

describe('Panel', () => {
  it('renderiza título, ações e variante', () => {
    render(
      <Panel title="Plano de voo" variant="rift" actions={<button>x</button>}>
        corpo
      </Panel>,
    );
    expect(screen.getByRole('heading', { name: 'Plano de voo' })).toBeInTheDocument();
    expect(screen.getByText('corpo').closest('section')).toHaveAttribute('data-variant', 'rift');
  });

  it('sem título não tem cabeçalho', () => {
    const { container } = render(<Panel>só corpo</Panel>);
    expect(container.querySelector('header')).toBeNull();
  });
});

describe('Tabs', () => {
  const tabs = [
    { id: 'a', label: 'Pontos' },
    { id: 'b', label: 'Calibração', disabled: true, reason: 'Exige o kit GNSS' },
    { id: 'c', label: 'Plano' },
  ] as const;

  it('troca de aba por clique e ignora abas desabilitadas', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} value="a" onChange={onChange} />);
    expect(screen.getByRole('tab', { name: 'Pontos' })).toHaveAttribute('aria-selected', 'true');
    fireEvent.click(screen.getByRole('tab', { name: 'Calibração' }));
    fireEvent.click(screen.getByRole('tab', { name: 'Pontos' }));
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('tab', { name: 'Plano' }));
    expect(onChange).toHaveBeenCalledWith('c');
  });

  it('setas pulam a aba desabilitada, com volta', () => {
    const onChange = vi.fn();
    render(<Tabs tabs={tabs} value="a" onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowLeft' });
    expect(onChange).toHaveBeenLastCalledWith('c');
    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'Enter' });
    expect(onChange).toHaveBeenCalledTimes(2);
    expect(nextEnabledTab(tabs, 'c', 1)).toBe('a');
    expect(nextEnabledTab([{ id: 'x', label: 'X' }], 'x', 1)).toBe('x');
  });

  it('a seta leva o foco junto com a seleção (abas com tabindex móvel); Home e End vão às pontas', () => {
    function Controlled() {
      const [value, setValue] = useState<'a' | 'b' | 'c'>('a');
      return <Tabs tabs={tabs} value={value} onChange={setValue} />;
    }
    render(<Controlled />);
    const [a, , c] = [
      screen.getByRole('tab', { name: 'Pontos' }),
      screen.getByRole('tab', { name: 'Calibração' }),
      screen.getByRole('tab', { name: 'Plano' }),
    ];
    a.focus();
    fireEvent.keyDown(a, { key: 'ArrowRight' });
    // A desabilitada é pulada: a seleção e o foco vão à "Plano".
    expect(c).toHaveAttribute('aria-selected', 'true');
    expect(c).toHaveFocus();
    expect(c).toHaveAttribute('tabindex', '0');
    expect(a).toHaveAttribute('tabindex', '-1');
    fireEvent.keyDown(c, { key: 'Home' });
    expect(a).toHaveAttribute('aria-selected', 'true');
    expect(a).toHaveFocus();
    fireEvent.keyDown(a, { key: 'End' });
    expect(c).toHaveAttribute('aria-selected', 'true');
    expect(c).toHaveFocus();
  });

  it('aba desabilitada mostra o motivo no hover', () => {
    render(<Tabs tabs={tabs} value="a" onChange={vi.fn()} />);
    fireEvent.mouseEnter(
      screen.getByRole('tab', { name: 'Calibração' }).parentElement as HTMLElement,
    );
    expect(screen.getByRole('tooltip')).toHaveTextContent('Exige o kit GNSS');
  });
});

describe('Tooltip', () => {
  it('abre no hover e no foco, fecha ao sair', () => {
    render(
      <Tooltip content="Dica">
        <button>alvo</button>
      </Tooltip>,
    );
    const target = screen.getByRole('button', { name: 'alvo' });
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.mouseEnter(target);
    expect(screen.getByRole('tooltip')).toHaveTextContent('Dica');
    fireEvent.mouseLeave(target);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    fireEvent.focus(target);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
    fireEvent.blur(target);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  });
});

describe('Stat, Gauge e ProgressBar', () => {
  it('Stat mostra valor, unidade, dica e cor por status', () => {
    render(<Stat label="GSD" value="2,7" unit="cm/px" status="warn" hint="Máx.: 3 cm" />);
    expect(screen.getByText('GSD')).toBeInTheDocument();
    expect(screen.getByText('2,7').className).toContain('text-amber-400');
    expect(screen.getByText('cm/px')).toBeInTheDocument();
    expect(screen.getByText('Máx.: 3 cm')).toBeInTheDocument();
  });

  it('gaugeTone: baixo-é-ruim e alto-é-ruim', () => {
    const lowBad = { warn: 0.4, danger: 0.2 };
    expect(gaugeTone(0.1, lowBad)).toBe('danger');
    expect(gaugeTone(0.3, lowBad)).toBe('warn');
    expect(gaugeTone(0.9, lowBad)).toBe('ok');
    const highBad = { warn: 0.5, danger: 0.8 };
    expect(gaugeTone(0.9, highBad)).toBe('danger');
    expect(gaugeTone(0.6, highBad)).toBe('warn');
    expect(gaugeTone(0.1, highBad)).toBe('ok');
    expect(gaugeTone(0.5)).toBe('neutral');
  });

  it('Gauge em barra e em arco expõe o valor', () => {
    render(
      <>
        <Gauge value={0.82} label="Bateria" thresholds={{ warn: 0.4, danger: 0.2 }} />
        <Gauge value={1.7} label="Reputação" variant="arc" valueText="64" />
      </>,
    );
    const bar = screen.getByRole('meter', { name: 'Bateria' });
    expect(bar).toHaveAttribute('aria-valuenow', '0.82');
    expect(bar).toHaveAttribute('data-tone', 'ok');
    expect(plain(bar.textContent)).toContain('82 %');
    const arc = screen.getByRole('meter', { name: 'Reputação' });
    expect(arc).toHaveAttribute('aria-valuenow', '1');
    expect(arc).toHaveTextContent('64');
  });

  it('ProgressBar limita o valor e aplica listras animadas', () => {
    render(<ProgressBar value={1.4} label="Nuvem densa" striped animated />);
    expect(screen.getByRole('progressbar', { name: 'Nuvem densa' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
    const fill = screen.getByTestId('progress-fill');
    expect(fill.style.width).toBe('100%');
    expect(fill.className).toContain('animate-stripes');
  });
});

describe('ChecklistItem', () => {
  it('mostra status, severidade e detalhe', () => {
    render(
      <ul>
        <ChecklistItem status="fail" label="Mínimo de 3 GCPs" severity="MAJOR" detail="2 de 3" />
        <ChecklistItem status="pass" label="GSD" />
        <ChecklistItem status="warn" label="Vento" severity="MINOR" />
        <ChecklistItem status="pending" label="Cobertura" severity="CRITICAL" />
      </ul>,
    );
    const items = screen.getAllByRole('listitem');
    expect(items.map((li) => li.getAttribute('data-status'))).toEqual([
      'fail',
      'pass',
      'warn',
      'pending',
    ]);
    expect(items[0]).toHaveTextContent('Não atendido');
    expect(items[0]).toHaveTextContent('Importante');
    expect(items[0]).toHaveTextContent('2 de 3');
    expect(items[3]).toHaveTextContent('Crítico');
  });
});

describe('MoneyText', () => {
  it('formata em BRL com cor por sinal', () => {
    render(
      <>
        <MoneyText cents={1234567} />
        <MoneyText cents={150000} signed />
        <MoneyText cents={-90000} signed />
      </>,
    );
    const positive = screen.getByText((_, el) => plain(el?.textContent ?? null) === 'R$ 12.345,67');
    expect(positive.className).toContain('text-lime-300');
    expect(
      screen.getByText((_, el) => plain(el?.textContent ?? null) === '+R$ 1.500,00'),
    ).toBeInTheDocument();
    const negative = screen.getByText((_, el) => plain(el?.textContent ?? null) === '-R$ 900,00');
    expect(negative.className).toContain('text-rose-500');
  });
});

describe('EmblemBadge e registro de ícones', () => {
  const emblem = {
    shape: 'HEXAGON',
    icon: 'Map',
    primary: 'red',
    secondary: 'black',
    initials: 'MM',
  } as const;

  it('desenha a forma, o ícone e as iniciais', () => {
    render(<EmblemBadge emblem={emblem} size={64} />);
    const badge = screen.getByRole('img', { name: 'MM' });
    expect(badge).toHaveAttribute('data-shape', 'HEXAGON');
    expect(badge.querySelector('path')).toHaveAttribute('fill', 'black');
    expect(badge).toHaveTextContent('MM');
  });

  it('omite as iniciais em tamanhos pequenos', () => {
    render(<EmblemBadge emblem={emblem} size={24} title="MegaMap" />);
    expect(screen.getByRole('img', { name: 'MegaMap' })).not.toHaveTextContent('MM');
  });

  it('nomes desconhecidos usam o ícone de reserva até serem registrados', () => {
    expect(hasIcon('Compass')).toBe(true);
    expect(hasIcon('Camera')).toBe(false);
    expect(iconByName('Camera')).toBe(FALLBACK_ICON);
    registerIcons({ Camera });
    expect(iconByName('Camera')).toBe(Camera);
  });
});

describe('cx', () => {
  it('ignora valores vazios', () => {
    expect(cx('a', false, null, undefined, '', 'b')).toBe('a b');
  });
});

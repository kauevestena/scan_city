import { act, fireEvent, render, screen, within } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { InfographicLabScreen } from './InfographicLabScreen';

const get = () => useGameStore.getState();

function open(payload?: { panel?: string }) {
  act(() => {
    useGameStore.setState((s) => ({
      session: { ...s.session, screen: 'INFOGRAPHIC_LAB', payload },
    }));
  });
  return render(<InfographicLabScreen />);
}

const value = (testId: string) => screen.getByTestId(testId).textContent;
const slider = (name: string) => screen.getByRole('slider', { name });
const press = (el: HTMLElement, key: string, times = 1) => {
  for (let k = 0; k < times; k++) fireEvent.keyDown(el, { key });
};

beforeEach(() => resetGameStore());

describe('InfographicLabScreen — Óptica & GSD (REQ-LAB-001)', () => {
  it('abre na óptica com os valores da G2: GSD 1,25 cm/px (H 100 m, f 35 mm, pixel 4,38 µm)', () => {
    open();
    expect(screen.getByTestId('lab-screen')).toHaveAttribute('data-panel', 'OPTICS');
    expect(screen.getByRole('tab', { name: '1 Óptica & GSD' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(value('reading-gsd')).toBe('1,25 cm/px');
    expect(value('reading-wg')).toBe('102,9 m');
    expect(value('reading-scale')).toBe('≈ 1:50');
    expect(slider('Altura H')).toHaveAttribute('aria-valuenow', '100');
    expect(slider('Focal f')).toHaveAttribute('aria-valuenow', '35');
    expect(slider('Pixel s')).toHaveAttribute('aria-valuenow', '4.38');
    // Fórmula ao vivo, com os valores substituídos.
    expect(screen.getByTestId('formula-0')).toHaveTextContent(
      'GSD = (H × s) / f = (100 m × 4,38 µm) / 35,0 mm = 1,25 cm/px',
    );
    expect(screen.getByTestId('lab-tip')).toHaveTextContent('Você sabia?');
  });

  it('mover os sliders atualiza as leituras e as fórmulas na hora', () => {
    open();
    const h = slider('Altura H');
    press(h, 'ArrowRight');
    expect(h).toHaveAttribute('aria-valuenow', '101');
    expect(value('reading-gsd')).toBe('1,26 cm/px');
    press(h, 'PageUp'); // +10 m
    expect(value('reading-gsd')).toBe('1,39 cm/px');
    expect(screen.getByTestId('formula-0')).toHaveTextContent('(111 m × 4,38 µm)');
    press(slider('Focal f'), 'ArrowRight', 2); // +1 mm
    expect(slider('Focal f')).toHaveAttribute('aria-valuenow', '36');
    expect(value('reading-gsd')).toBe('1,35 cm/px');
    press(h, 'Home');
    expect(h).toHaveAttribute('aria-valuenow', '20');
    expect(value('reading-gsd')).toBe('0,24 cm/px');
  });

  it('um preset de câmera preenche focal, pixel e largura do sensor', () => {
    open();
    const select = screen.getByLabelText('Preset de câmera');
    fireEvent.change(select, { target: { value: 'CAM_45MP_FF:LENS_24' } });
    expect(slider('Focal f')).toHaveAttribute('aria-valuenow', '24');
    expect(slider('Pixel s')).toHaveAttribute('aria-valuenow', '4.38');
    expect(slider('Largura do sensor L')).toHaveAttribute('aria-valuenow', '35.9');
    expect(select).toHaveValue('CAM_45MP_FF:LENS_24');
    // Mexer num slider tira do preset ("Personalizado").
    press(slider('Focal f'), 'ArrowRight');
    expect(select).toHaveValue('');
    fireEvent.change(select, { target: { value: 'CAM_PIGEON' } });
    expect(slider('Focal f')).toHaveAttribute('aria-valuenow', '4.5');
    expect(slider('Pixel s')).toHaveAttribute('aria-valuenow', '1.89');
  });

  it('"Usar valores do meu equipamento" preenche com a câmera do Atlas e a altura dele', () => {
    open();
    fireEvent.click(screen.getByTestId('use-equipment'));
    expect(screen.getByTestId('equipment-note')).toHaveTextContent(
      'Equipamento: Câmera de Peito do Avô em Pombo Atlas',
    );
    expect(slider('Altura H')).toHaveAttribute('aria-valuenow', '80');
    expect(slider('Focal f')).toHaveAttribute('aria-valuenow', '4.5');
    expect(slider('Pixel s')).toHaveAttribute('aria-valuenow', '1.89');
    expect(slider('Largura do sensor L')).toHaveAttribute('aria-valuenow', '6.2');
    // 80 m · 1,89 µm / 4,5 mm = 3,36 cm/px.
    expect(value('reading-gsd')).toBe('3,36 cm/px');
  });

  it('com o equipamento do jogo cheio, usa o full frame com a lente de 35 mm', () => {
    useGameStore.setState((s) => ({
      inventory: {
        ...s.inventory,
        aircraft: ['ATLAS', 'DRONE_T2'],
        sensors: [...s.inventory.sensors, 'CAM_45MP_FF'],
        lenses: ['LENS_35'],
      },
    }));
    open();
    fireEvent.click(screen.getByTestId('use-equipment'));
    expect(screen.getByTestId('equipment-note')).toHaveTextContent('Full Frame');
    expect(slider('Altura H')).toHaveAttribute('aria-valuenow', '100');
    expect(slider('Focal f')).toHaveAttribute('aria-valuenow', '35');
    expect(value('reading-gsd')).toBe('1,25 cm/px');
  });
});

describe('InfographicLabScreen — Estereoscopia & Paralaxe (REQ-LAB-002)', () => {
  it('o payload abre o painel: B 30, H 100, h 20, f 35 mm → b 10,50 mm, Δp 2,625 mm, h 20,00 m, σ_Z 2,09 cm', () => {
    open({ panel: 'STEREO' });
    expect(screen.getByTestId('lab-screen')).toHaveAttribute('data-panel', 'STEREO');
    expect(screen.getByRole('tab', { name: '2 Estereoscopia & Paralaxe' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    expect(value('reading-b')).toBe('10,50 mm');
    expect(value('reading-dp')).toBe('2,625 mm');
    expect(value('reading-h')).toBe('20,00 m');
    expect(value('reading-sigma-z')).toBe('2,09 cm');
    expect(value('reading-ratio')).toBe('0,30 · boa');
    expect(screen.getByTestId('formula-1')).toHaveTextContent(
      'Δp = B·f·h / (H·(H − h)) = 2,625 mm',
    );
  });

  it('um painel desconhecido no payload cai no primeiro', () => {
    open({ panel: 'XYZ' });
    expect(screen.getByTestId('lab-screen')).toHaveAttribute('data-panel', 'OPTICS');
  });

  it('o h reconstruído acompanha o slider e a razão B/H é classificada', () => {
    open({ panel: 'STEREO' });
    press(slider('Prédio h'), 'PageUp'); // +5 m
    expect(value('reading-h')).toBe('25,00 m');
    press(slider('Base B'), 'PageDown', 2); // −20 m → 10 m
    expect(value('reading-ratio')).toBe('0,10 · fraca');
    press(slider('Base B'), 'End');
    expect(value('reading-ratio')).toBe('1,00 · forte, mas com oclusões');
    expect(value('reading-h')).toBe('25,00 m');
  });

  it('h nunca passa de 0,8·H: o slider se ajusta quando H muda', () => {
    open({ panel: 'STEREO' });
    const h = slider('Prédio h');
    expect(h).toHaveAttribute('aria-valuemax', '80');
    press(h, 'End');
    expect(h).toHaveAttribute('aria-valuenow', '80');
    press(slider('Altura H'), 'Home'); // H = 50
    expect(h).toHaveAttribute('aria-valuemax', '40');
    expect(h).toHaveAttribute('aria-valuenow', '40');
    expect(value('reading-h')).toBe('40,00 m');
    // Sem divisão por quase zero: h = 0,8·H dá leituras finitas.
    expect(
      Number.isFinite(
        Number(
          value('reading-dp')
            ?.replace(/[^\d,]/g, '')
            .replace(',', '.'),
        ),
      ),
    ).toBe(true);
  });

  it('"Usar valores do meu equipamento": a base do par de 70 % de sobreposição, no teto do Atlas', () => {
    open({ panel: 'STEREO' });
    fireEvent.click(screen.getByTestId('use-equipment'));
    expect(slider('Altura H')).toHaveAttribute('aria-valuenow', '80');
    expect(slider('Focal f')).toHaveAttribute('aria-valuenow', '10');
    expect(screen.getByTestId('equipment-note')).toHaveTextContent('Câmera de Peito do Avô');
  });
});

describe('InfographicLabScreen — navegação', () => {
  it('as abas trocam de painel e cada um guarda os próprios sliders', () => {
    open();
    press(slider('Altura H'), 'PageUp');
    fireEvent.click(screen.getByRole('tab', { name: '2 Estereoscopia & Paralaxe' }));
    expect(screen.getByTestId('stereo-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('optics-panel')).not.toBeInTheDocument();
    press(slider('Base B'), 'PageUp');
    fireEvent.click(screen.getByRole('tab', { name: '1 Óptica & GSD' }));
    expect(slider('Altura H')).toHaveAttribute('aria-valuenow', '110');
    fireEvent.click(screen.getByRole('tab', { name: '2 Estereoscopia & Paralaxe' }));
    expect(slider('Base B')).toHaveAttribute('aria-valuenow', '40');
  });

  it('Q e E (ou LB e RB) trocam de aba, com volta', () => {
    open();
    const lab = screen.getByTestId('lab-screen');
    fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });
    expect(lab).toHaveAttribute('data-panel', 'STEREO');
    fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });
    expect(lab).toHaveAttribute('data-panel', 'OPTICS');
    fireEvent.keyDown(window, { key: 'q', code: 'KeyQ' });
    expect(lab).toHaveAttribute('data-panel', 'STEREO');
  });

  it('Esc e o botão Voltar levam ao escritório (T15), sem pausar', () => {
    open();
    fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(get().session.screen).toBe('OFFICE');
    expect(get().session.paused).toBe(false);
    act(() => {
      get().goTo('INFOGRAPHIC_LAB');
    });
    fireEvent.click(
      within(screen.getByTestId('lab-screen')).getByRole('button', { name: /Voltar/ }),
    );
    expect(get().session.screen).toBe('OFFICE');
  });

  it('o diagrama tem nome acessível por painel', () => {
    open();
    expect(screen.getByRole('img')).toHaveAccessibleName(/sensor, lente, cone de raios/);
    fireEvent.click(screen.getByRole('tab', { name: '2 Estereoscopia & Paralaxe' }));
    expect(screen.getByRole('img')).toHaveAccessibleName(/duas câmeras/);
  });
});

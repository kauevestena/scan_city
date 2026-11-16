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
    for (const panel of ['STEREO', 'CANOPY', 'SHUTTER', 'OPTICS']) {
      fireEvent.keyDown(window, { key: 'e', code: 'KeyE' });
      expect(lab).toHaveAttribute('data-panel', panel);
    }
    fireEvent.keyDown(window, { key: 'q', code: 'KeyQ' });
    expect(lab).toHaveAttribute('data-panel', 'SHUTTER');
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

describe('InfographicLabScreen — LiDAR vs. Fotogrametria no Dossel (REQ-LAB-003)', () => {
  it('G16 — cobertura de 97 % e 5 retornos: P_solo = 10,76 %', () => {
    open({ panel: 'CANOPY' });
    expect(screen.getByTestId('lab-screen')).toHaveAttribute('data-panel', 'CANOPY');
    expect(screen.getByRole('tab', { name: '3 LiDAR vs. Fotogrametria' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
    press(slider('Cobertura do dossel'), 'PageUp', 3); // 70 → 100, preso em 98
    expect(slider('Cobertura do dossel')).toHaveAttribute('aria-valuenow', '98');
    press(slider('Cobertura do dossel'), 'ArrowLeft'); // 97
    press(slider('Nº máximo de retornos'), 'End');
    expect(slider('Cobertura do dossel')).toHaveAttribute('aria-valuenow', '97');
    expect(slider('Nº máximo de retornos')).toHaveAttribute('aria-valuenow', '5');
    expect(value('reading-p-ground')).toBe('10,76 %');
    expect(screen.getByTestId('formula-0')).toHaveTextContent('= 10,76 %');
    // Só 0,09 % do solo aparece em duas fotos: (1 − 0,97)².
    expect(value('reading-photo-visibility')).toBe('0,09 %');
  });

  it('a densidade de solo e o veredito do MDT (≥ 4 pts/m²: confiável)', () => {
    open({ panel: 'CANOPY' });
    // Abertura: 70 %, 3 retornos, 240 kHz, 100 m e 12 m/s.
    expect(value('reading-verdict')).toBe('MDT confiável');
    expect(value('reading-swath')).toBe('140,0 m');
    expect(value('reading-density')).toBe('142,8 pts/m²');
    expect(value('reading-ground-density')).toMatch(/pts\/m²$/);
    // 98 % de dossel, 1 retorno, o pulso mais ralo (50 kHz) e o mais rápido: ~0,02·ρ de solo.
    press(slider('Cobertura do dossel'), 'End');
    press(slider('Nº máximo de retornos'), 'Home');
    press(slider('PRR do pulso'), 'Home');
    press(slider('Velocidade v'), 'End');
    press(slider('Altura H'), 'End');
    expect(value('reading-p-ground')).toBe('2,00 %');
    expect(value('reading-verdict')).toBe('MDT insuficiente');
    expect(value('reading-ground-density')).toBe('0,1 pts/m²');
  });

  it('o FOV é fixo em 70° e as leituras vêm dos sliders', () => {
    open({ panel: 'CANOPY' });
    expect(screen.getByText('FOV (fixo): 70°')).toBeInTheDocument();
    press(slider('Altura H'), 'ArrowRight');
    expect(slider('Altura H')).toHaveAttribute('aria-valuenow', '105');
    expect(value('reading-swath')).toBe('147,0 m');
  });

  it('"Usar valores do meu equipamento": sem o Pod, usa só a aeronave e avisa', () => {
    open({ panel: 'CANOPY' });
    fireEvent.click(screen.getByTestId('use-equipment'));
    expect(screen.getByTestId('equipment-note')).toHaveTextContent(
      'Equipamento: sem Pod LiDAR (só a aeronave) em Pombo Atlas',
    );
    expect(slider('Altura H')).toHaveAttribute('aria-valuenow', '80');
    expect(slider('PRR do pulso')).toHaveAttribute('aria-valuenow', '240');
    expect(slider('Velocidade v')).toHaveAttribute('aria-valuenow', '10');
  });

  it('com o Pod, usa o PRR e os retornos dele', () => {
    useGameStore.setState((s) => ({
      inventory: { ...s.inventory, payloads: ['POD_LIDAR'], aircraft: ['ATLAS', 'DRONE_T2'] },
    }));
    open({ panel: 'CANOPY' });
    press(slider('PRR do pulso'), 'Home');
    press(slider('Nº máximo de retornos'), 'Home');
    fireEvent.click(screen.getByTestId('use-equipment'));
    expect(screen.getByTestId('equipment-note')).toHaveTextContent('Pod LiDAR "Vaga-lume"');
    expect(slider('PRR do pulso')).toHaveAttribute('aria-valuenow', '240');
    expect(slider('Nº máximo de retornos')).toHaveAttribute('aria-valuenow', '5');
  });
});

describe('InfographicLabScreen — Global vs. Rolling Shutter (REQ-LAB-004)', () => {
  it('G11 — v 8 m/s, leitura de 30 ms e GSD de 2,74 cm: skew de 8,76 px', () => {
    open({ panel: 'SHUTTER' });
    expect(screen.getByTestId('lab-screen')).toHaveAttribute('data-panel', 'SHUTTER');
    expect(value('reading-skew')).toBe('8,76 px');
    expect(screen.getByTestId('formula-0')).toHaveTextContent('= 8,76 px');
    // Ângulo de cisalhamento: atan(skew · GSD / altura da imagem no solo), em 160 linhas.
    expect(value('reading-shear')).toBe('3,13°');
    expect(value('reading-ground-height')).toBe('4,4 m');
  });

  it('o jogo penaliza o RMSE: × 1,35 sem RTK e × 1,18 com RTK', () => {
    open({ panel: 'SHUTTER' });
    expect(value('reading-rmse-no-rtk')).toBe('× 1,35');
    expect(value('reading-rmse-rtk')).toBe('× 1,18');
  });

  it('o sensor global não tem skew nem penalidade; o interruptor volta ao rolling', () => {
    open({ panel: 'SHUTTER' });
    const toggle = screen.getByTestId('shutter-global');
    expect(toggle).toHaveAttribute('aria-pressed', 'false');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('aria-pressed', 'true');
    expect(value('reading-skew')).toBe('0,00 px');
    expect(value('reading-shear')).toBe('0,00°');
    expect(value('reading-rmse-no-rtk')).toBe('× 1,00');
    expect(value('reading-rmse-rtk')).toBe('× 1,00');
    expect(slider('Tempo de leitura')).toHaveAttribute('aria-disabled', 'true');
    fireEvent.click(toggle);
    expect(value('reading-skew')).toBe('8,76 px');
  });

  it('v = 0 zera o skew; mais velocidade e leitura mais lenta crescem o skew', () => {
    open({ panel: 'SHUTTER' });
    press(slider('Velocidade v'), 'Home');
    expect(value('reading-skew')).toBe('0,00 px');
    expect(value('reading-rmse-no-rtk')).toBe('× 1,00');
    press(slider('Velocidade v'), 'End');
    press(slider('Tempo de leitura'), 'End');
    // 25 m/s · 60 ms / 2,74 cm = 54,74 px; o teto do multiplicador é 1,8 (sem RTK) e 1,4 (com RTK).
    expect(value('reading-skew')).toBe('54,74 px');
    expect(value('reading-rmse-no-rtk')).toBe('× 1,80');
    expect(value('reading-rmse-rtk')).toBe('× 1,40');
  });

  it('"Usar valores do meu equipamento": a câmera de peito do Atlas é mecânica (sem rolling)', () => {
    open({ panel: 'SHUTTER' });
    fireEvent.click(screen.getByTestId('use-equipment'));
    expect(screen.getByTestId('equipment-note')).toHaveTextContent('Câmera de Peito do Avô');
    expect(screen.getByTestId('shutter-global')).toHaveAttribute('aria-pressed', 'true');
    expect(value('reading-skew')).toBe('0,00 px');
  });

  it('com o drone T1 (20 MP, rolling de 30 ms), usa a leitura dele e dá o skew da G6', () => {
    useGameStore.setState((s) => ({
      inventory: {
        ...s.inventory,
        aircraft: ['ATLAS', 'DRONE_T1'],
        sensors: [...s.inventory.sensors, 'CAM_20MP_RS'],
      },
    }));
    open({ panel: 'SHUTTER' });
    fireEvent.click(screen.getByTestId('use-equipment'));
    expect(screen.getByTestId('shutter-global')).toHaveAttribute('aria-pressed', 'false');
    expect(slider('Tempo de leitura')).toHaveAttribute('aria-valuenow', '30');
    // GSD a 100 m com 8,8 mm e 2,41 µm de pixel: 2,74 cm.
    expect(slider('GSD')).toHaveAttribute('aria-valuenow', '2.74');
  });
});

describe('InfographicLabScreen — quatro painéis', () => {
  it('cada painel guarda os próprios sliders ao trocar de aba', () => {
    open();
    press(slider('Altura H'), 'PageUp');
    fireEvent.click(screen.getByRole('tab', { name: '3 LiDAR vs. Fotogrametria' }));
    press(slider('Cobertura do dossel'), 'PageDown');
    fireEvent.click(screen.getByRole('tab', { name: '4 Global vs. Rolling' }));
    press(slider('Taxa de giro'), 'PageUp');
    fireEvent.click(screen.getByRole('tab', { name: '3 LiDAR vs. Fotogrametria' }));
    expect(slider('Cobertura do dossel')).toHaveAttribute('aria-valuenow', '60');
    fireEvent.click(screen.getByRole('tab', { name: '4 Global vs. Rolling' }));
    expect(slider('Taxa de giro')).toHaveAttribute('aria-valuenow', '10');
    fireEvent.click(screen.getByRole('tab', { name: '1 Óptica & GSD' }));
    expect(slider('Altura H')).toHaveAttribute('aria-valuenow', '110');
  });

  it('o payload abre qualquer um dos quatro', () => {
    for (const panel of ['OPTICS', 'STEREO', 'CANOPY', 'SHUTTER']) {
      const { unmount } = open({ panel });
      expect(screen.getByTestId('lab-screen')).toHaveAttribute('data-panel', panel);
      unmount();
    }
  });
});

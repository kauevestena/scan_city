/** Briefing dos contratos reais com os dados do catálogo (T053+): regras, avisos e liberação. */
import { fireEvent, render, screen, within } from '@testing-library/react';
import { useGameStore } from '@/state/store';
import { resetGameStore } from '@/test/resetStore';
import { BriefingModal } from './BriefingModal';

const get = () => useGameStore.getState();

function open(contractId = 'C01', title = 'Metrópole Vertical') {
  const view = render(<BriefingModal contractId={contractId} onClose={vi.fn()} />);
  return {
    d: within(screen.getByRole('dialog', { name: title })),
    unmount: view.unmount,
  };
}

beforeEach(() => {
  resetGameStore();
  get().goTo('WORLD_MAP');
});

describe('BriefingModal — C01 Metrópole Vertical', () => {
  it('o cliente, a regra de cânion de RTK e o aviso da altura máxima aparecem', () => {
    const { d } = open();
    expect(d.getAllByText('Prefeito Dr. Aurélio Bastos').length).toBeGreaterThan(0);
    expect(d.getByText('Prefeitura de Vila Nova')).toBeInTheDocument();
    const rules = within(d.getByTestId('briefing-rules')).getAllByRole('listitem');
    expect(rules.map((li) => li.getAttribute('data-rule'))).toEqual(['URBAN_CANYON_RTK_LOSS']);
    expect(rules[0]).toHaveTextContent('Cânions urbanos');
    expect(rules[0]).toHaveTextContent('o RTK cai para FLOAT');
    // A nota do cliente avisa da altura do prédio mais alto.
    expect(d.getByText('Voe acima dos prédios mais altos (65 m)!')).toBeInTheDocument();
    expect(d.getByText('240 × 360 m')).toBeInTheDocument();
    expect(d.getByText('Sol alto, Nublado, Hora dourada')).toBeInTheDocument();
    expect(d.getByTestId('briefing-payment').textContent?.replace(/\s/g, ' ')).toBe('R$ 12.000,00');
    expect(d.getByTestId('briefing-souvenir')).toHaveTextContent(/Chave da Cidade/);
  });

  it('7 requisitos da ficha (mais o de execução), os críticos primeiro (sobreposição lateral, cobertura e PEC classe A)', () => {
    const { d } = open();
    const reqs = within(d.getByTestId('briefing-requirements')).getAllByRole('listitem');
    expect(reqs).toHaveLength(8);
    expect(reqs[0]).toHaveTextContent('Sobreposição lateral ≥ 80 %');
    expect(reqs[1]).toHaveTextContent('Cobertura verde ≥ 80 %');
    expect(reqs[2]).toHaveTextContent('PEC-PCD classe A (1:1.000)');
  });

  it('bloqueado até concluir o C00; depois, aceita e abre o campo com o contrato certo', () => {
    const locked = open();
    expect(locked.d.getByTestId('briefing')).toHaveAttribute('data-status', 'LOCKED');
    expect(locked.d.getByRole('button', { name: 'Aceitar' })).toBeDisabled();
    expect(within(locked.d.getByTestId('briefing-unlock')).getAllByRole('listitem')).toHaveLength(
      1,
    );
    locked.unmount();

    // O aceite sorteia a contraproposta da MegaMap pela seed do teste e pelos contratos já
    // concluídos: com C00 concluído (salt 1), a seed 4 não recebe oferta no C01.
    useGameStore.setState((s) => ({
      stats: { ...s.stats, contractsCompleted: 1 },
      contracts: {
        ...s.contracts,
        C00: { status: 'COMPLETED', completions: 1, bestScore: 0.8 },
        C01: { status: 'AVAILABLE', completions: 0, bestScore: 0 },
      },
    }));
    const open2 = open();
    expect(open2.d.getByTestId('briefing')).toHaveAttribute('data-status', 'AVAILABLE');
    fireEvent.click(open2.d.getByRole('button', { name: 'Aceitar' }));
    expect(get().session.screen).toBe('FIELD_SETUP');
    expect(get().mission.active).toMatchObject({ contractId: 'C01', status: 'PLANNING' });
  });
});

describe('BriefingModal — C05 Centro Histórico Colonial', () => {
  it('a regra de fios baixos, a nota do AGL e os requisitos de voo oblíquo e malha cruzada', () => {
    const { d } = open('C05', 'Centro Histórico Colonial');
    expect(d.getAllByText('Arq.ª Helena Vasconcelos').length).toBeGreaterThan(0);
    const rules = within(d.getByTestId('briefing-rules')).getAllByRole('listitem');
    expect(rules.map((li) => li.getAttribute('data-rule'))).toEqual(['LOW_WIRES']);
    expect(rules[0]).toHaveTextContent('Fios baixos');
    expect(d.getByText('Fiação a 8–14 m: mantenha o AGL acima de 20 m.')).toBeInTheDocument();
    const reqs = within(d.getByTestId('briefing-requirements')).getAllByRole('listitem');
    expect(reqs).toHaveLength(8);
    expect(reqs[0]).toHaveTextContent('Voo oblíquo');
    expect(reqs[1]).toHaveTextContent('Cobertura verde ≥ 85 %');
    expect(reqs[2]).toHaveTextContent('PEC-PCD classe A (1:500, eq. 0,5 m)');
    expect(reqs[3]).toHaveTextContent('Voo em malha cruzada');
    expect(d.getByText('150 × 150 m')).toBeInTheDocument();
    expect(d.getByTestId('briefing-payment').textContent?.replace(/\s/g, ' ')).toBe('R$ 18.000,00');
    expect(d.getByTestId('briefing-souvenir')).toHaveTextContent(/Azulejo Português/);
  });

  it('bloqueado até concluir o C01', () => {
    const { d } = open('C05', 'Centro Histórico Colonial');
    expect(d.getByTestId('briefing')).toHaveAttribute('data-status', 'LOCKED');
    expect(d.getByRole('button', { name: 'Aceitar' })).toBeDisabled();
    expect(within(d.getByTestId('briefing-unlock')).getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('BriefingModal — C06 Zona Costeira e Estuário', () => {
  it('as duas regras (água especular e vento forte), o vento cruzado e o requisito de nível 2', () => {
    const { d } = open('C06', 'Zona Costeira e Estuário');
    expect(d.getAllByText('Comandante Iara Moreira').length).toBeGreaterThan(0);
    const rules = within(d.getByTestId('briefing-rules')).getAllByRole('listitem');
    expect(rules.map((li) => li.getAttribute('data-rule'))).toEqual([
      'SPECULAR_WATER',
      'STRONG_WIND',
    ]);
    expect(rules[0]).toHaveTextContent('Água especular');
    expect(rules[1]).toHaveTextContent('Vento forte');
    expect(d.getByText('9 m/s, rajadas de +4 m/s, de 90°')).toBeInTheDocument();
    expect(d.getByText('300 × 800 m')).toBeInTheDocument();
    const reqs = within(d.getByTestId('briefing-requirements')).getAllByRole('listitem');
    expect(reqs).toHaveLength(7);
    expect(reqs[0]).toHaveTextContent('Aeronave de nível ≥ 2');
    expect(reqs[2]).toHaveTextContent('ASPRS: 7 cm (H) e 10 cm (V)');
    expect(d.getByText('Água não tem tie points: GCPs só na faixa de areia.')).toBeInTheDocument();
    expect(d.getByTestId('briefing-souvenir')).toHaveTextContent(/Garrafa com Mapa/);
  });

  it('bloqueado até concluir o C01 e atingir reputação 40', () => {
    const { d } = open('C06', 'Zona Costeira e Estuário');
    expect(d.getByTestId('briefing')).toHaveAttribute('data-status', 'LOCKED');
    expect(d.getByRole('button', { name: 'Aceitar' })).toBeDisabled();
    expect(within(d.getByTestId('briefing-unlock')).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('BriefingModal — C02 Planalto Agrícola', () => {
  it('a regra de textura homogênea, o teto especial e a asa fixa multiespectral', () => {
    const { d } = open('C02', 'Planalto Agrícola');
    expect(d.getAllByText('Seu Valdemar Prado').length).toBeGreaterThan(0);
    const rules = within(d.getByTestId('briefing-rules')).getAllByRole('listitem');
    expect(rules.map((li) => li.getAttribute('data-rule'))).toEqual(['HOMOGENEOUS_TEXTURE']);
    expect(rules[0]).toHaveTextContent('Textura homogênea');
    expect(
      d.getByText('Textura homogênea: use p ≥ 80 % para o SIFT não se perder.'),
    ).toBeInTheDocument();
    expect(d.getByText('600 × 1500 m')).toBeInTheDocument();
    const reqs = within(d.getByTestId('briefing-requirements')).getAllByRole('listitem');
    expect(reqs).toHaveLength(8);
    expect(reqs[0]).toHaveTextContent('Sensor multiespectral');
    expect(reqs[1]).toHaveTextContent('Aeronave de asa fixa (VTOL)');
    expect(d.getByTestId('briefing-payment').textContent?.replace(/\s/g, ' ')).toBe('R$ 35.000,00');
    expect(d.getByTestId('briefing-souvenir')).toHaveTextContent(/Espiga Dourada/);
  });

  it('bloqueado até concluir o C06 e atingir reputação 50', () => {
    const { d } = open('C02', 'Planalto Agrícola');
    expect(d.getByTestId('briefing')).toHaveAttribute('data-status', 'LOCKED');
    expect(d.getByRole('button', { name: 'Aceitar' })).toBeDisabled();
    expect(within(d.getByTestId('briefing-unlock')).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('BriefingModal — C04 Mina a Céu Aberto', () => {
  it('relevo íngreme, Terrain Following e erro de volume; recomenda a picape 4x4', () => {
    const { d } = open('C04', 'Mina a Céu Aberto');
    expect(d.getAllByText('Eng.ª Rosa Lima').length).toBeGreaterThan(0);
    const rules = within(d.getByTestId('briefing-rules')).getAllByRole('listitem');
    expect(rules.map((li) => li.getAttribute('data-rule'))).toEqual(['STEEP_RELIEF']);
    expect(rules[0]).toHaveTextContent('Relevo acidentado');
    expect(d.getByText('320 × 480 m')).toBeInTheDocument();
    const reqs = within(d.getByTestId('briefing-requirements')).getAllByRole('listitem');
    expect(reqs).toHaveLength(7);
    expect(reqs[0]).toHaveTextContent('Voo com Terrain Following');
    expect(reqs[1]).toHaveTextContent('Erro de volume ≤ 2 %');
    expect(d.getByTestId('briefing-payment').textContent?.replace(/\s/g, ' ')).toBe('R$ 55.000,00');
    expect(d.getByTestId('briefing-souvenir')).toHaveTextContent(/Pepita/);
    expect(
      within(d.getByTestId('briefing-recommended')).getAllByLabelText('Não possuído').length,
    ).toBeGreaterThan(0);
  });

  it('bloqueado até concluir o C05 e atingir reputação 55', () => {
    const { d } = open('C04', 'Mina a Céu Aberto');
    expect(d.getByTestId('briefing')).toHaveAttribute('data-status', 'LOCKED');
    expect(d.getByRole('button', { name: 'Aceitar' })).toBeDisabled();
    expect(within(d.getByTestId('briefing-unlock')).getAllByRole('listitem')).toHaveLength(2);
  });
});

describe('BriefingModal — C03 Floresta Amazônica', () => {
  it('dossel denso, requisitos de LiDAR e de solo, e a picape 4x4 recomendada', () => {
    const { d } = open('C03', 'Floresta Amazônica');
    expect(d.getAllByText('Dra. Jaci Tupinambá').length).toBeGreaterThan(0);
    const rules = within(d.getByTestId('briefing-rules')).getAllByRole('listitem');
    expect(rules.map((li) => li.getAttribute('data-rule'))).toEqual(['DENSE_CANOPY']);
    expect(rules[0]).toHaveTextContent('Dossel denso');
    expect(d.getByText('500 × 1000 m')).toBeInTheDocument();
    expect(d.getByText('Nublado, Sol alto')).toBeInTheDocument();
    const reqs = within(d.getByTestId('briefing-requirements')).getAllByRole('listitem');
    expect(reqs).toHaveLength(7);
    expect(reqs[0]).toHaveTextContent('Sensor LiDAR');
    expect(reqs[1]).toHaveTextContent('Densidade de solo ≥ 8 pts/m²');
    expect(d.getByTestId('briefing-payment').textContent?.replace(/\s/g, ' ')).toBe('R$ 90.000,00');
    expect(d.getByTestId('briefing-souvenir')).toHaveTextContent(/Castanheira/);
  });

  it('bloqueado até concluir o C04 e o C02 e atingir reputação 65', () => {
    const { d } = open('C03', 'Floresta Amazônica');
    expect(d.getByTestId('briefing')).toHaveAttribute('data-status', 'LOCKED');
    expect(d.getByRole('button', { name: 'Aceitar' })).toBeDisabled();
    expect(within(d.getByTestId('briefing-unlock')).getAllByRole('listitem')).toHaveLength(3);
  });
});

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
    expect(d.getByText('Voe acima dos prédios mais altos (90 m)!')).toBeInTheDocument();
    expect(d.getByText('240 × 360 m')).toBeInTheDocument();
    expect(d.getByText('Sol alto, Nublado, Hora dourada')).toBeInTheDocument();
    expect(d.getByTestId('briefing-payment').textContent?.replace(/\s/g, ' ')).toBe('R$ 12.000,00');
    expect(d.getByTestId('briefing-souvenir')).toHaveTextContent(/Chave da Cidade/);
  });

  it('7 requisitos, os críticos primeiro (sobreposição lateral, cobertura e PEC classe A)', () => {
    const { d } = open();
    const reqs = within(d.getByTestId('briefing-requirements')).getAllByRole('listitem');
    expect(reqs).toHaveLength(7);
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
    expect(reqs).toHaveLength(7);
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

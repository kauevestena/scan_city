import { useState } from 'react';
import { MEGAMAP } from '@/data/rival';
import { STRINGS } from '@/data/strings';
import { MATCH_PRICE_FACTOR, portfolioOutcome } from '@/domain/rival';
import { useGameStore } from '@/state/store';
import type { PortraitSpec } from '@/types';
import { Button, EmblemBadge, Modal } from '@/ui';

const R = STRINGS.rival;

export interface CounterOfferModalProps {
  contractId: string;
  /** Retrato e nome do cliente, para a resposta ao portfólio. */
  client: PortraitSpec & { name: string };
  /** O jogador decidiu: segue para o campo com o fator de pagamento. */
  onResolve: (rivalAdjustment: number) => void;
}

/**
 * Contraproposta da MegaMap (progression §8): igualar o preço (×0,85) ou apresentar o portfólio
 * (mantém o preço com um contrato classe A; senão ×0,85 e −2 de reputação). Não pode ser
 * dispensado: é preciso escolher.
 */
export function CounterOfferModal({ contractId, client, onResolve }: CounterOfferModalProps) {
  const [result, setResult] = useState<{ convinced: boolean; adjustment: number } | null>(null);

  const match = () => {
    useGameStore.getState().recordCounterOffer(contractId);
    onResolve(MATCH_PRICE_FACTOR);
  };
  const portfolio = () => {
    const { contracts, recordCounterOffer, changeReputation } = useGameStore.getState();
    const outcome = portfolioOutcome(contracts);
    recordCounterOffer(contractId);
    if (outcome.reputationDelta !== 0) changeReputation(outcome.reputationDelta);
    setResult({ convinced: outcome.convinced, adjustment: outcome.rivalAdjustment });
  };

  return (
    <Modal open title={R.title} size="md" dismissable={false}>
      <div className="flex flex-col gap-4" data-testid="counter-offer">
        {result === null ? (
          <>
            <div className="flex items-start gap-4">
              <EmblemBadge emblem={MEGAMAP} size={56} title={MEGAMAP.name} />
              <p className="text-slate-200 italic" data-testid="counter-offer-line">
                {R.offer}
              </p>
            </div>
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1">
                <Button onClick={match} data-testid="counter-match">
                  {R.matchPrice}
                </Button>
                <p className="text-xs text-slate-400">{R.matchPriceHint}</p>
              </div>
              <div className="flex flex-col gap-1">
                <Button variant="primary" onClick={portfolio} data-testid="counter-portfolio">
                  {R.portfolio}
                </Button>
                <p className="text-xs text-slate-400">{R.portfolioHint}</p>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="flex items-start gap-4">
              <EmblemBadge emblem={client} size={56} title={client.name} />
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-400">{client.name}</span>
                <p className="text-slate-100 italic" data-testid="counter-reply">
                  {result.convinced ? R.convinced : R.notConvinced}
                </p>
              </div>
            </div>
            <p
              className={result.convinced ? 'text-sm text-emerald-300' : 'text-sm text-amber-300'}
              data-testid="counter-result"
            >
              {result.convinced ? R.resultKept : R.resultCut}
            </p>
            <Button
              variant="primary"
              onClick={() => onResolve(result.adjustment)}
              data-testid="counter-proceed"
            >
              {R.proceed}
            </Button>
          </>
        )}
      </div>
    </Modal>
  );
}

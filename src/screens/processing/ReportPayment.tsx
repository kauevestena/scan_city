import { Award, Search } from 'lucide-react';
import { useEffect, useState } from 'react';
import { AudioEngine } from '@/audio/AudioEngine';
import { SOUVENIRS } from '@/data/souvenirs';
import { STRINGS } from '@/data/strings';
import { formatBRL, formatNumber } from '@/lib/format';
import { SouvenirThumb } from '@/screens/office/SouvenirThumb';
import { SouvenirViewer } from '@/screens/office/SouvenirViewer';
import type { QualityReport } from '@/types';
import { Button, MoneyText } from '@/ui';

const P = STRINGS.processing;
/** Uma linha do pagamento a cada 250 ms (§5.8). */
export const PAYMENT_ROW_MS = 250;

/**
 * Linhas do `PaymentBreakdown`; as neutras (×1, R$ 0) ficam de fora. O bônus de pilotagem
 * (parte do fator de qualidade) aparece ao lado dele.
 */
export function paymentRows(p: QualityReport['payment'], pilotBonus = 0): Array<[string, string]> {
  const R = P.paymentRows;
  const factor = (v: number) => `×${formatNumber(v, 2)}`;
  const rows: Array<[string, string]> = [[R.base, formatBRL(p.baseBRL)]];
  if (p.replayFactor !== 1) rows.push([R.replay, factor(p.replayFactor)]);
  rows.push([
    R.quality,
    pilotBonus > 0
      ? `${factor(p.qualityFactor)} (${P.execution.pilotBonus(formatNumber(pilotBonus, 2))})`
      : factor(p.qualityFactor),
  ]);
  if (p.rivalFactor !== 1) rows.push([R.rival, factor(p.rivalFactor)]);
  if (p.managementBonus !== 1) rows.push([R.management, factor(p.managementBonus)]);
  // A dificuldade escolhida antes do voo (ADR-035): a fácil paga menos e a difícil, mais.
  if ((p.difficultyFactor ?? 1) !== 1) rows.push([R.difficulty, factor(p.difficultyFactor ?? 1)]);
  if (p.staffBonus !== 1) rows.push([R.staff, factor(p.staffBonus)]);
  if (p.staffCostBRL > 0) rows.push([R.staffCost, `− ${formatBRL(p.staffCostBRL)}`]);
  if (p.penaltiesBRL > 0) rows.push([R.penalties, `− ${formatBRL(p.penaltiesBRL)}`]);
  if (p.ringBonusBRL) rows.push([R.rings, `+ ${formatBRL(p.ringBonusBRL)}`]);
  return rows;
}

/** Aba Pagamento: linhas animadas, total com CASH_REGISTER e recompensas. */
export function ReportPayment({ report, stolen }: { report: QualityReport; stolen: boolean }) {
  const rows = paymentRows(report.payment, report.execution?.pilotBonus ?? 0);
  const [shown, setShown] = useState(0);
  const [examining, setExamining] = useState(false);
  const souvenir = SOUVENIRS.find((s) => s.id === report.souvenirAwarded);

  useEffect(() => {
    if (shown > rows.length) return;
    const timer = window.setTimeout(() => {
      setShown((n) => n + 1);
      if (shown === rows.length && report.payment.totalBRL > 0)
        AudioEngine.get().play('CASH_REGISTER');
    }, PAYMENT_ROW_MS);
    return () => window.clearTimeout(timer);
  }, [shown, rows.length, report.payment.totalBRL]);

  return (
    <div className="grid gap-6 lg:grid-cols-2" data-testid="report-payment">
      <table className="h-fit text-sm text-slate-100">
        <tbody>
          {rows.slice(0, shown).map(([k, v]) => (
            <tr key={k}>
              <th className="py-1 pr-6 text-left font-normal text-slate-400">{k}</th>
              <td className="py-1 text-right font-mono tabular-nums">{v}</td>
            </tr>
          ))}
          {shown > rows.length && (
            <tr className="border-t border-slate-700">
              <th className="py-2 pr-6 text-left text-slate-200">{P.paymentRows.total}</th>
              <td className="py-2 text-right" data-testid="payment-total">
                <MoneyText cents={report.payment.totalBRL} className="text-lg" />
              </td>
            </tr>
          )}
        </tbody>
      </table>
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold tracking-widest text-slate-400 uppercase">
          {P.rewards}
        </h3>
        <p className="font-mono text-cyan-300">{P.xp(report.xp)}</p>
        <p className={report.reputationDelta >= 0 ? 'text-emerald-300' : 'text-rose-300'}>
          {P.reputation(report.reputationDelta)}
        </p>
        {souvenir && (
          <div
            className="flex items-center gap-3 rounded-lg border border-amber-400/60 bg-amber-400/10 p-3"
            data-testid="souvenir-card"
          >
            <SouvenirThumb souvenir={souvenir} size={56} />
            <div className="flex min-w-0 flex-col items-start gap-1.5">
              <p className="flex items-center gap-1.5 text-xs tracking-widest text-amber-300 uppercase">
                <Award size={14} aria-hidden /> {P.souvenirTitle}
              </p>
              <p className="text-sm text-slate-100">{souvenir.name}</p>
              {/* Examinar na hora (office §5.1): a caderneta abre aqui mesmo, ao ser entregue. */}
              <Button
                size="sm"
                icon={Search}
                data-testid="souvenir-examine"
                onClick={() => setExamining(true)}
              >
                {STRINGS.office.shelf.examine}
              </Button>
            </div>
          </div>
        )}
        {souvenir && examining && (
          <SouvenirViewer souvenir={souvenir} onClose={() => setExamining(false)} />
        )}
        {stolen && <p className="text-rose-300">{P.stolen}</p>}
      </section>
    </div>
  );
}

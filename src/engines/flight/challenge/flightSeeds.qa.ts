/// <reference types="node" />
/**
 * `npm run qa:flight` (ADR-032): os quatro pilotos simulados em todos os contratos, com
 * várias sementes (`QA_SEEDS`, padrão 3). Imprime a tabela e confere as mesmas metas do
 * `verify`, agora em todas as sementes. `QA_DIFFICULTY` (padrão `MEDIUM`, a das metas) voa em
 * outra dificuldade (ADR-035): na fácil e na difícil só valem as metas do parado e do bom (o
 * mediano e o distraído são medidos para a calibração, sem meta).
 */
import { CONTRACTS } from '@/data/contracts';
import { flyMission, type FlownMission } from '@/test/flyMission';
import type { PilotKind } from '@/test/pilots';
import type { FlightDifficulty } from '@/types';
import { CHALLENGE } from './challenge';

const SEEDS = Number(process.env.QA_SEEDS ?? 3);
const DIFFICULTY = (process.env.QA_DIFFICULTY ?? 'MEDIUM') as FlightDifficulty;
/** As metas do mediano e do distraído são da dificuldade média. */
const GOALS = DIFFICULTY === 'MEDIUM';
const PILOTS: PilotKind[] = ['IDLE', 'ALIGN', 'MEDIUM', 'GOOD'];

const fmt = (n: number) => n.toFixed(2).replace('.', ',');
const min = (rows: FlownMission[]) => Math.min(...rows.map((r) => r.execution));
const max = (rows: FlownMission[]) => Math.max(...rows.map((r) => r.execution));

it(`os pilotos simulados com ${SEEDS} sementes (${DIFFICULTY})`, () => {
  const out: string[] = [
    '| Contrato | Parado (E) | Distraído (E) | Mediano (E · nota) | Bom (E · nota) | Surtida do mediano: jogo → real (min) |',
    '| :-- | :-: | :-: | :-: | :-: | :-: |',
  ];
  const all = new Map<PilotKind, FlownMission[]>(PILOTS.map((p) => [p, []]));
  let alignRejected = 0;
  let alignRuns = 0;
  const problems: string[] = [];
  const check = (ok: boolean, what: string) => {
    if (!ok) problems.push(what);
  };
  for (const c of CONTRACTS) {
    const by = new Map<PilotKind, FlownMission[]>();
    for (const p of PILOTS) {
      const runs = Array.from({ length: SEEDS }, (_, i) => flyMission(c, p, i + 1, DIFFICULTY));
      by.set(p, runs);
      all.get(p)?.push(...runs);
    }
    const idle = by.get('IDLE') ?? [];
    const align = by.get('ALIGN') ?? [];
    const medium = by.get('MEDIUM') ?? [];
    const good = by.get('GOOD') ?? [];
    for (let i = 0; i < SEEDS; i++) {
      const a = align[i] as FlownMission;
      const m = medium[i] as FlownMission;
      alignRuns++;
      if (!a.report.approved) alignRejected++;
      check(
        !GOALS || a.execution <= m.execution - CHALLENGE.alignGap,
        `${c.id} semente ${i + 1}: distraído ${fmt(a.execution)} perto do mediano ${fmt(m.execution)}`,
      );
    }
    idle.forEach((r, i) => {
      check(!r.report.approved, `${c.id} semente ${i + 1}: parado aprovado`);
      check(
        r.execution < CHALLENGE.idleMaxExecution,
        `${c.id} semente ${i + 1}: parado com ${fmt(r.execution)}`,
      );
    });
    medium.forEach((r, i) => {
      check(!GOALS || r.report.approved, `${c.id} semente ${i + 1}: mediano reprovado`);
      check(
        !GOALS || r.execution >= CHALLENGE.mediumMinExecution,
        `${c.id} semente ${i + 1}: mediano com ${fmt(r.execution)}`,
      );
    });
    good.forEach((r, i) => {
      check(r.report.approved, `${c.id} semente ${i + 1}: bom reprovado`);
      check(
        r.execution >= CHALLENGE.goodMinExecution,
        `${c.id} semente ${i + 1}: bom com ${fmt(r.execution)}`,
      );
      check(r.refused === 0, `${c.id} semente ${i + 1}: bom com ${r.refused} linha(s) recusada(s)`);
    });
    const score = (rows: FlownMission[]) =>
      fmt(rows.reduce((s, r) => s + r.report.qualityScore, 0) / rows.length);
    const minutes = medium.flatMap((r) => r.sortieS).map((s) => s / 60);
    const wall = medium.flatMap((r) => r.wallS).map((s) => s / 60);
    const span = (xs: number[]) =>
      Math.min(...xs) === Math.max(...xs)
        ? fmt(xs[0] as number)
        : `${fmt(Math.min(...xs))}–${fmt(Math.max(...xs))}`;
    out.push(
      `| ${c.id} | ${fmt(min(idle))}–${fmt(max(idle))} | ${fmt(min(align))}–${fmt(max(align))} | ${fmt(min(medium))}–${fmt(max(medium))} · ${score(medium)} | ${fmt(min(good))}–${fmt(max(good))} · ${score(good)} | ${span(minutes)} → ${span(wall)} |`,
    );
  }
  out.push('');
  for (const p of PILOTS) {
    const rows = all.get(p) ?? [];
    const approved = rows.filter((r) => r.report.approved).length;
    out.push(
      `${p}: ${approved}/${rows.length} aprovadas · E de ${fmt(min(rows))} a ${fmt(max(rows))}`,
    );
  }
  out.push(`Distraído reprovado em ${alignRejected} de ${alignRuns} missões.`);
  check(
    !GOALS || alignRejected / alignRuns >= CHALLENGE.alignMinRejected / CONTRACTS.length,
    `distraído reprovado em só ${alignRejected} de ${alignRuns}`,
  );
  if (problems.length > 0) out.push('', 'Fora das metas:', ...problems.map((p) => `- ${p}`));
  process.stdout.write(`\n${out.join('\n')}\n`);
  expect(problems).toEqual([]);
});

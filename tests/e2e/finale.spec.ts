import { expect, test } from '@playwright/test';

/**
 * Final da campanha (REQ-CNT-008): com os 7 contratos reais concluídos, ao entrar no escritório
 * aparece, uma única vez, a carta do avô em 4 cartões; ao fim saem o toast "Museu da Terra
 * inaugurado!" e o Chapéu do Avô no guarda-roupa. O save com a campanha pronta nasce do próprio
 * jogo (a base), com os contratos reais trocados por concluídos, e vai para um contexto novo.
 */
const REAL = ['C00', 'C01', 'C02', 'C03', 'C04', 'C05', 'C06'];

test('os 7 contratos reais concluídos: o final aparece uma vez, com a carta do avô, o toast e o chapéu', async ({
  browser,
}) => {
  // 1) A base: um save de verdade de um jogo novo.
  const first = await browser.newContext();
  const base = await first.newPage();
  await base.goto('/?debug=1&skipIntro=1');
  await expect(base.getByTestId('office-screen')).toBeVisible();
  await base.goto('/'); // sair da página grava o save (beforeunload)
  await expect(base.getByTestId('office-screen')).toBeVisible();
  const raw = await base.evaluate(() => localStorage.getItem('scan-city-save'));
  await first.close();
  expect(raw).not.toBeNull();
  const save = JSON.parse(raw as string) as {
    contracts: Record<string, unknown>;
    flags: { introSeen: boolean; finaleSeen: boolean };
  };
  for (const id of REAL)
    save.contracts[id] = { status: 'COMPLETED', completions: 1, bestScore: 0.9 };
  save.flags.introSeen = true;
  save.flags.finaleSeen = false;

  // 2) Um contexto novo, já com a campanha concluída.
  const context = await browser.newContext();
  await context.addInitScript(
    ([key, value]) => {
      if (!localStorage.getItem(key as string))
        localStorage.setItem(key as string, value as string);
    },
    ['scan-city-save', JSON.stringify(save)],
  );
  const page = await context.newPage();
  await page.goto('/');
  const finale = page.getByRole('dialog', { name: 'Museu da Terra' });
  await expect(finale).toBeVisible();
  const next = finale.getByRole('button', { name: 'Avançar diálogo' });
  const text = finale.getByTestId('dialogue-text');
  // Os 4 cartões: espera a máquina de escrever terminar a linha (o fim do texto aparece) e avança.
  const wait = { timeout: 15_000 };
  await expect(text).toContainText('A letra é do Vô.', wait);
  await next.click();
  await expect(text).toContainText('Neto, se você está lendo isto', wait);
  await expect(text).toContainText('Continue medindo. — Vô', wait);
  await next.click();
  await expect(text).toContainText('cada setor que você mapeou.', wait);
  await next.click();
  await expect(text).toContainText('Agora ele é seu.', wait);
  await next.click();
  await expect(finale).toBeHidden();
  await expect(page.getByText('Museu da Terra inaugurado!')).toBeVisible();

  // O final vai para o save e não volta ao reabrir o jogo; o chapéu é do jogador.
  await page.goto('/');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await expect(page.getByRole('dialog', { name: 'Museu da Terra' })).toBeHidden();
  const saved = await page.evaluate(
    () =>
      JSON.parse(localStorage.getItem('scan-city-save') ?? '{}') as {
        flags: { finaleSeen: boolean };
        inventory: { cosmetics: string[] };
      },
  );
  expect(saved.flags.finaleSeen).toBe(true);
  expect(saved.inventory.cosmetics).toContain('CHAR_GRANDPA_HAT');
  await context.close();
});

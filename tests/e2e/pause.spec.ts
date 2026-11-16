import { expect, test, type Page } from '@playwright/test';

const PAUSE_TITLE = 'Jogo pausado';

const settingsKey = (page: Page) =>
  page.evaluate(
    () => JSON.parse(localStorage.getItem('scan-city-settings') ?? '{}') as Record<string, unknown>,
  );

test('o menu de pausa traz as opções; as configurações mudam na hora e sobrevivem ao reload', async ({
  page,
}) => {
  await page.goto('/?debug=1&skipIntro=1&money=4242');
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: PAUSE_TITLE });
  for (const name of ['Continuar', 'Configurações', 'Controles', 'Salvar agora', 'Novo jogo']) {
    await expect(menu.getByRole('button', { name })).toBeVisible();
  }
  // No escritório não há missão para abandonar nem para onde sair.
  await expect(menu.getByRole('button', { name: 'Abandonar missão' })).toHaveCount(0);
  await expect(menu.getByRole('button', { name: 'Sair para o escritório' })).toHaveCount(0);

  await menu.getByRole('button', { name: 'Configurações' }).click();
  const settings = page.getByRole('dialog', { name: 'Configurações' });
  const master = settings.getByRole('slider', { name: 'Volume geral' });
  await master.focus();
  await page.keyboard.press('End');
  await expect(master).toHaveAttribute('aria-valuenow', '100');
  await settings.getByTestId('setting-muted').click();
  await settings.getByTestId('setting-quality-LOW').click();
  await settings.getByTestId('setting-reduce-flashes').click();
  await settings.getByTestId('setting-show-fps').click();
  await expect(page.getByTestId('fps-overlay')).toBeVisible();
  // Gravadas à parte do save, na hora.
  await expect
    .poll(() => settingsKey(page))
    .toMatchObject({
      masterVolume: 1,
      muted: true,
      quality: 'LOW',
      reduceFlashes: true,
      showFps: true,
    });

  // Recarregar: tudo continua como foi deixado.
  await page.reload();
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  await page
    .getByRole('dialog', { name: PAUSE_TITLE })
    .getByRole('button', { name: 'Configurações' })
    .click();
  const again = page.getByRole('dialog', { name: 'Configurações' });
  await expect(again.getByRole('slider', { name: 'Volume geral' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
  await expect(again.getByTestId('setting-muted')).toHaveAttribute('aria-checked', 'true');
  await expect(again.getByTestId('setting-quality-LOW')).toHaveAttribute('aria-pressed', 'true');
  await expect(again.getByTestId('setting-reduce-flashes')).toHaveAttribute('aria-checked', 'true');

  // Esc volta ao menu (não retoma); de lá, os controles e o Salvar agora.
  await page.keyboard.press('Escape');
  const back = page.getByRole('dialog', { name: PAUSE_TITLE });
  await expect(back).toBeVisible();
  await back.getByRole('button', { name: 'Controles' }).click();
  const controls = page.getByTestId('controls-panel');
  await expect(controls).toContainText('Mover');
  await expect(controls).toContainText('Esc');
  await page.getByTestId('pause-back').click();
  await page.getByTestId('pause-save').click();
  await expect(page.getByText('Jogo salvo')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('scan-city-save')))
    .toContain('"money":424200');
  await page.keyboard.press('Escape');
  await expect(back).toBeHidden();
});

test('novo jogo: confirmação in-app, backup do save, recomeço com a intro e configurações mantidas', async ({
  page,
}) => {
  // Nenhum `window.confirm` (REQ-CORE-009): qualquer diálogo nativo reprova o teste.
  const native: string[] = [];
  page.on('dialog', (d) => {
    native.push(d.message());
    void d.dismiss();
  });
  await page.goto('/?debug=1&skipIntro=1&money=12345');
  await expect(page.getByTestId('top-bar')).toContainText('12.345,00');
  await page.keyboard.press('Escape');
  await page
    .getByRole('dialog', { name: PAUSE_TITLE })
    .getByRole('button', { name: 'Configurações' })
    .click();
  await page.getByTestId('setting-quality-LOW').click();
  await page.getByTestId('pause-back').click();

  // Cancelar não apaga nada.
  await page.getByTestId('pause-new-game').click();
  const confirm = page.getByRole('dialog', { name: 'Começar um novo jogo?' });
  await expect(confirm).toContainText('Todo o progresso será perdido. Um backup será guardado.');
  await confirm.getByRole('button', { name: 'Cancelar' }).click();
  await expect(confirm).toBeHidden();
  await expect(page.getByTestId('top-bar')).toContainText('12.345,00');

  await page.getByTestId('pause-new-game').click();
  await page
    .getByRole('dialog', { name: 'Começar um novo jogo?' })
    .getByRole('button', { name: 'Apagar e recomeçar' })
    .click();
  // De volta ao escritório, com o estado inicial e a intro.
  await expect(page.getByRole('dialog', { name: PAUSE_TITLE })).toBeHidden();
  await expect(page.getByRole('dialog', { name: 'Uma carta na mesa' })).toBeVisible();
  await expect(page.getByTestId('top-bar')).toContainText('5.000,00');
  // O save anterior foi para o backup, e as configurações sobrevivem.
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('scan-city-save-backup')))
    .toContain('"money":1234500');
  expect(await settingsKey(page)).toMatchObject({ quality: 'LOW' });
  expect(native).toEqual([]);
});

test('abandonar missão no planejamento e no voo, e sair para o escritório', async ({ page }) => {
  // Planejamento (T7): o M pausa; o Esc, aqui, abre a confirmação de cancelar.
  await page.goto('/?debug=1&skipIntro=1&screen=FIELD_SETUP');
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
  await page.keyboard.press('m');
  const menu = page.getByRole('dialog', { name: PAUSE_TITLE });
  await expect(menu.getByRole('button', { name: 'Sair para o escritório' })).toHaveCount(0);
  await menu.getByRole('button', { name: 'Abandonar missão' }).click();
  const field = page.getByRole('dialog', { name: 'Abandonar o planejamento?' });
  await field.getByRole('button', { name: 'Cancelar' }).click();
  await expect(page.getByTestId('field-setup-screen')).toBeVisible();
  await menu.getByRole('button', { name: 'Abandonar missão' }).click();
  await page
    .getByRole('dialog', { name: 'Abandonar o planejamento?' })
    .getByRole('button', { name: 'Abandonar' })
    .click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
  await expect(menu).toBeHidden();

  // Mapa: de lá, "Sair para o escritório" (T5).
  await page.keyboard.press('m');
  await menu.getByRole('button', { name: 'Sair para o escritório' }).click();
  await expect(page.getByTestId('office-screen')).toBeVisible();
  await expect(menu).toBeHidden();

  // Voo (T10): descarta a missão e volta ao mapa.
  await page.goto('/?debug=1&skipIntro=1&screen=SURVEY_FLIGHT');
  await expect(page.getByTestId('survey-flight-screen')).toBeVisible();
  await page.keyboard.press('Escape');
  await menu.getByRole('button', { name: 'Abandonar missão' }).click();
  const flight = page.getByRole('dialog', { name: 'Abandonar a missão?' });
  await expect(flight).toContainText('Todos os dados desta missão serão descartados.');
  await flight.getByRole('button', { name: 'Abandonar' }).click();
  await expect(page.getByTestId('world-map-screen')).toBeVisible();
});

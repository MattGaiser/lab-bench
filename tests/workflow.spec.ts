import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { exampleLab } from '../src/domain';

test('author, preview the fault, export, import and undo a complete lab', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Lab details' }).click();
  await page.getByLabel('Exercise title').fill('Pump holding circuit');
  await page.getByLabel('Learning objective').fill('Explain the holding circuit.');
  await page.getByRole('tab', { name: 'Fault setup' }).click();
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pump holding circuit' })).toBeVisible();
  await expect(page.getByText('W3 / OPEN')).toHaveCount(0);
  await page.getByRole('button', { name: 'Turn supply on' }).click();
  await page.getByRole('button', { name: 'W3 Holding branch', exact: true }).press('Enter');
  await expect(page.getByRole('button', { name: 'Inspect isolated conductor' })).toBeDisabled();
  const start = page.getByRole('button', { name: 'Hold START' });
  await start.focus();
  await page.keyboard.down('Space');
  await expect(page.getByRole('status').filter({ hasText: 'K1 energized' })).toBeVisible();
  await page.keyboard.up('Space');
  await expect(page.getByRole('status').filter({ hasText: 'K1 de-energized' })).toBeVisible();
  await page.getByRole('button', { name: 'Isolate supply' }).click();
  await page.getByRole('button', { name: 'Inspect isolated conductor' }).click();
  await expect(page.getByRole('status').filter({ hasText: 'Open conductor' })).toBeVisible();
  await page
    .getByLabel('Your explanation')
    .fill('The open holding branch prevents K1 from remaining energized.');
  await page.getByRole('button', { name: 'Check diagnosis' }).click();
  await expect(page.getByText('Fault located.')).toBeVisible();
  await page.getByRole('button', { name: 'Back to authoring' }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export lab', exact: true }).click();
  const download = await downloadPromise;
  const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
  expect(exported).toMatchObject({
    title: 'Pump holding circuit',
    fault: 'hold',
    objective: 'Explain the holding circuit.',
  });
  await page.getByRole('button', { name: 'Load sample exercise' }).click();
  await page.getByLabel('Import lab file').setInputFiles({
    name: 'pump.lab.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exported)),
  });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Pump holding circuit');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(exampleLab().title);
});

test('draft reload, invalid import, preflight failure and recovery preserve user work', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('tab', { name: 'Lab details' }).click();
  await page.getByLabel('Exercise title').fill('Persisted draft');
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Persisted draft');
  await page
    .getByLabel('Import lab file')
    .setInputFiles({ name: 'bad.json', mimeType: 'application/json', buffer: Buffer.from('null') });
  await expect(page.getByRole('alert')).toContainText('Your draft is unchanged');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Persisted draft');
  await page.getByRole('button', { name: 'Remove fault' }).click();
  await page.getByRole('button', { name: 'Export lab', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'A few things to finish.' })).toBeVisible();
  await page.getByRole('button', { name: /Choose one open conductor/ }).click();
  await page.getByRole('button', { name: 'Place open fault here' }).click();
  await expect(page.getByText('Ready to preview')).toBeVisible();
});

test('keyboard and drag layout changes can be undone as a single operation', async ({ page }) => {
  await page.goto('/');
  const start = page.locator('[data-component="start"]');
  const before = await start.getAttribute('transform');
  await start.focus();
  await page.keyboard.press('ArrowRight');
  await expect(start).not.toHaveAttribute('transform', before!);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(start).toHaveAttribute('transform', before!);
  await page.getByRole('button', { name: 'Zoom in' }).click();
  const box = (await start.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2 + 15, { steps: 8 });
  await page.mouse.up();
  await expect(start).not.toHaveAttribute('transform', before!);
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(start).toHaveAttribute('transform', before!);
});

test('corrupt storage remains available for recovery until explicitly replaced', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.evaluate(() => localStorage.setItem('lab-bench:draft:v1', '{bad'));
  await page.reload();
  await expect(page.getByRole('alert')).toContainText('saved draft could not be read');
  await expect
    .poll(() => page.evaluate(() => localStorage.getItem('lab-bench:draft:v1')))
    .toBe('{bad');
  await page.getByRole('button', { name: 'Replace stored draft with this copy' }).click();
  await expect(page.getByText('Saved on this device')).toBeVisible();
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('lab-bench:draft:v1')))!),
  ).toEqual(exampleLab());
});

test('storage failures stay visible and the unsaved draft can be downloaded', async ({ page }) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException('Quota exceeded', 'QuotaExceededError');
    };
  });
  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText('Browser storage is unavailable');
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download this draft' }).click();
  const result = await downloading;
  expect(JSON.parse(await readFile((await result.path())!, 'utf8'))).toEqual(exampleLab());
});

test('another tab cannot silently replace the current draft', async ({ context, page }) => {
  await page.goto('/');
  await expect(page.getByText('Saved on this device')).toBeVisible();
  const other = await context.newPage();
  await other.goto('/');
  await expect(other.getByText('Saved on this device')).toBeVisible();
  await page.getByRole('tab', { name: 'Lab details' }).click();
  await page.getByLabel('Exercise title').fill('First tab update');
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await expect(other.getByRole('alert')).toContainText('Another tab changed');
  await other.getByRole('tab', { name: 'Lab details' }).click();
  await other.getByLabel('Exercise title').fill('Second tab edit');
  await other.getByLabel('Exercise title').blur();
  await other.getByRole('button', { name: 'Load saved draft' }).click();
  await expect(other.getByRole('heading', { level: 1 })).toHaveText('First tab update');
});

test('delayed import cannot overwrite edits made while the file is being read', async ({
  page,
}) => {
  await page.goto('/');
  await page.evaluate(() => {
    const read = File.prototype.text;
    File.prototype.text = async function () {
      await new Promise((resolve) => setTimeout(resolve, 800));
      return read.call(this);
    };
  });
  await page.getByRole('tab', { name: 'Lab details' }).click();
  await page.getByLabel('Import lab file').setInputFiles({
    name: 'sample.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exampleLab())),
  });
  await page.getByLabel('Exercise title').fill('Newer edit');
  await expect(page.getByRole('alert')).toContainText(
    'draft changed while the file was being read',
  );
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Newer edit');
});

test('no serious accessibility issues in authoring, preview and the about dialog', async ({
  page,
}) => {
  await page.goto('/');
  for (const tab of ['Fault setup', 'Lab details', 'Review']) {
    await page.getByRole('tab', { name: tab }).click();
    const report = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa'])
      .analyze();
    expect(report.violations).toEqual([]);
  }
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).first().click();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'About Lab Bench' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('small-screen authoring and apprentice preview fit the viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  await page.getByRole('tab', { name: 'Lab details' }).click();
  await page.getByLabel('Exercise title').fill('Mobile authored exercise');
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Mobile authored exercise' })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { CONTACT_FAULTS, exampleLab } from '../src/domain';
import type { ContactFault } from '../src/domain';
import { contactLessons } from '../src/lessons';

const cases: {
  fault: ContactFault;
  width: number;
  on: boolean;
  start: boolean;
  stop: boolean;
  released: boolean;
}[] = [
  { fault: 'start-stuck-open', width: 1440, on: false, start: false, stop: false, released: false },
  { fault: 'start-stuck-closed', width: 390, on: true, start: true, stop: false, released: true },
  { fault: 'stop-stuck-closed', width: 320, on: false, start: true, stop: true, released: true },
];

for (const c of cases) {
  test(`${c.fault}: author, operate, inspect, diagnose, export and reload`, async ({ page }) => {
    await page.setViewportSize({ width: c.width, height: 900 });
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#editor');
    await page.getByLabel('Fault type').selectOption(c.fault);
    await expect(page.locator('.selected-wire-card')).toContainText(CONTACT_FAULTS[c.fault].label);
    await expect(page.locator('.component.faulted')).toHaveCount(1);
    await expect(page.getByText('Saved on this device')).toBeVisible();
    await page.reload();
    await expect(page.getByLabel('Fault type')).toHaveValue(c.fault);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(exampleLab().title);
    // Changing the mechanism must preserve an instructor's authored content.
    await page.getByRole('button', { name: 'Use suggested lesson text' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(contactLessons[c.fault].title);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(exampleLab().title);
    await expect(page.getByLabel('Fault type')).toHaveValue(c.fault);
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(contactLessons[c.fault].title);
    const authorAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(authorAxe.violations).toEqual([]);
    await page.locator('#preview-main').click();
    await expect(page.locator('.component.faulted')).toHaveCount(0);
    const coil = page.locator('.coil-state');
    const expectCoil = (on: boolean) =>
      expect(coil).toHaveText(`K1 ${on ? 'energized' : 'de-energized'}`);
    await expectCoil(false);
    await page.getByRole('button', { name: 'Turn supply on' }).click();
    await expectCoil(c.on);
    const start = page.getByRole('button', { name: 'Hold START' });
    await start.focus();
    await page.keyboard.down('Space');
    await expectCoil(c.start);
    await page.keyboard.up('Space');
    await expectCoil(c.start);
    const stop = page.getByRole('button', { name: 'Hold STOP' });
    await stop.focus();
    await page.keyboard.down('Enter');
    await expectCoil(c.stop);
    await page.keyboard.up('Enter');
    await expectCoil(c.released);
    await page.locator('.observations > summary').click();
    await expect(page.locator('.observations')).toContainText(
      `STOP held → K1 ${c.stop ? 'stays energized' : 'de-energized'}.`,
    );
    const target = CONTACT_FAULTS[c.fault].target;
    await page.getByLabel('Item to inspect').selectOption(target);
    await expect(page.getByRole('button', { name: 'Operate isolated contact' })).toBeDisabled();
    await page.getByRole('button', { name: 'Isolate supply' }).click();
    await expectCoil(false);
    await page.getByLabel('Item to inspect').selectOption('supply');
    await page.getByRole('button', { name: 'Inspect isolated conductor' }).click();
    await expect(page.locator('.inspection-result')).toHaveText('Intact conductor');
    await page.getByLabel('Item to inspect').selectOption('contact-aux');
    await page.getByRole('button', { name: 'Operate isolated contact' }).click();
    await expect(page.locator('.inspection-result')).toHaveText(
      'Contact opens and closes normally',
    );
    const contact = page.getByRole('button', {
      name: c.fault.startsWith('start') ? 'START contact' : 'STOP contact',
      exact: true,
    });
    await contact.focus();
    await page.keyboard.press('Tab');
    await page.keyboard.press('Shift+Tab');
    await expect(contact).toBeFocused();
    await page.keyboard.press('Enter');
    await expect(page.getByLabel('Item to inspect')).toHaveValue(target);
    await expect(contact).toHaveAttribute('aria-pressed', 'true');
    await expect(contact.locator('.component-box')).toHaveCSS('stroke-dasharray', '5px, 3px');
    await page.keyboard.press('Tab');
    await expect(contact.locator('.component-box')).toHaveCSS('stroke-dasharray', 'none');
    await page.getByRole('button', { name: 'Operate isolated contact' }).click();
    await expect(page.locator('.inspection-result')).toContainText(
      c.fault.endsWith('open') ? 'Stuck open' : 'Stuck closed',
    );
    await page
      .getByLabel('Your explanation')
      .fill('The contact cannot change state, so the control circuit cannot respond normally.');
    await expect(page.getByRole('button', { name: 'Check diagnosis' })).toBeDisabled();
    const condition = CONTACT_FAULTS[c.fault].condition;
    await page
      .getByRole('combobox', { name: 'Contact fault', exact: true })
      .selectOption(condition === 'stuck-open' ? 'stuck-closed' : 'stuck-open');
    await page.getByRole('button', { name: 'Check diagnosis' }).click();
    await expect(page.locator('.feedback.wrong')).toBeVisible();
    await page
      .getByRole('combobox', { name: 'Contact fault', exact: true })
      .selectOption(condition);
    await page.getByRole('button', { name: 'Check diagnosis' }).click();
    await expect(page.getByText('Fault located.')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      c.width,
    );
    const previewAxe = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(previewAxe.violations).toEqual([]);
    await page.getByRole('button', { name: 'Back to authoring' }).click();
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export lab', exact: true }).click();
    const download = await downloadPromise;
    const exported = JSON.parse(await readFile((await download.path())!, 'utf8'));
    expect(exported).toMatchObject({
      schemaVersion: 2,
      fault: c.fault,
      ...contactLessons[c.fault],
    });
    await page.getByRole('button', { name: 'Load sample exercise' }).click();
    await page.getByLabel('Import lab file').setInputFiles({
      name: 'contact.lab.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(exported)),
    });
    await page.getByRole('tab', { name: 'Fault setup' }).click();
    await expect(page.getByLabel('Fault type')).toHaveValue(c.fault);
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(page.getByLabel('Fault type')).toHaveValue('open-wire');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(page.getByLabel('Fault type')).toHaveValue(c.fault);
    expect(errors).toEqual([]);
  });

  test(`AI proposal for ${c.fault} applies the matching fault`, async ({ page }) => {
    await page.route('**/api/assistant/status', (route) =>
      route.fulfill({ json: { available: true } }),
    );
    await page.route('**/api/scenario', (route) =>
      route.fulfill({
        json: {
          message: 'Review your exercise.',
          lab: { ...exampleLab(), fault: c.fault, title: CONTACT_FAULTS[c.fault].label },
        },
      }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await page.getByRole('radio', { name: /Describe my own lesson/ }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Use this example' }).click();
    await page.getByRole('button', { name: 'Draft my lab' }).click();
    await expect(page.locator('.answer-fact')).toContainText(CONTACT_FAULTS[c.fault].label);
    await page.getByRole('button', { name: 'Use this lab' }).click();
    await page.getByRole('tab', { name: 'Fault setup' }).click();
    await expect(page.getByLabel('Fault type')).toHaveValue(c.fault);
    await page.locator('#preview-main').click();
    await page.getByRole('button', { name: 'Turn supply on' }).click();
    await expect(page.locator('.coil-state')).toHaveText(
      `K1 ${c.on ? 'energized' : 'de-energized'}`,
    );
  });
}

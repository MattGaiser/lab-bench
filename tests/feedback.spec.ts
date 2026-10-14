import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { exampleLab } from '../src/domain';
import { contactLessons } from '../src/lessons';

for (const width of [1440, 320]) {
  test(`suggested lesson reports changes, repeated use and undo at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#editor');
    const region = page.locator('.action-feedback');
    await expect(region).toHaveAttribute('role', 'status');
    await expect(region).toHaveAttribute('aria-live', 'polite');
    await page.getByLabel('Fault type').selectOption('stop-stuck-closed');
    const apply = page.getByRole('button', { name: 'Use suggested lesson text' });
    await apply.focus();
    await page.keyboard.press('Enter');
    const applied = page.getByRole('button', { name: 'Suggested text applied', exact: true });
    await expect(applied).toBeFocused();
    await expect(region).toContainText(
      'Lesson text updated: title, objective, instructions, and hints.',
    );
    const toast = page.locator('.toast');
    await expect(toast).toBeVisible();
    const bounds = (await toast.boundingBox())!;
    expect(bounds.x).toBeGreaterThanOrEqual(0);
    expect(bounds.x + bounds.width).toBeLessThanOrEqual(width);
    expect(bounds.y).toBeGreaterThanOrEqual(0);
    expect(bounds.y + bounds.height).toBeLessThan(900);
    await page.keyboard.press('Enter');
    await expect(region).toContainText('Suggested lesson text is already applied.');
    await page.getByRole('button', { name: 'Undo', exact: true }).click();
    await expect(region).toContainText('Last edit undone.');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(exampleLab().title);
    await expect(apply).toBeVisible();
    await expect(page.getByLabel('Fault type')).toHaveValue('stop-stuck-closed');
    await page.getByRole('button', { name: 'Redo', exact: true }).click();
    await expect(region).toContainText('Last edit restored.');
    await expect(applied).toBeVisible();
    const lesson = contactLessons['stop-stuck-closed'];
    await page.getByRole('tab', { name: 'Lab details' }).click();
    await page.locator('#details-basic > summary').click();
    await expect(page.getByLabel('Exercise title')).toHaveValue(lesson.title);
    await page.locator('#details-brief > summary').click();
    await expect(page.getByLabel('Learning objective')).toHaveValue(lesson.objective);
    await expect(page.getByLabel('Apprentice instructions')).toHaveValue(lesson.briefing);
    await page.locator('#details-hints > summary').click();
    await expect(page.getByRole('textbox', { name: 'Hint 1', exact: true })).toHaveValue(
      lesson.hints[0],
    );
    await expect(page.getByRole('textbox', { name: 'Hint 2', exact: true })).toHaveValue(
      lesson.hints[1],
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  });
}

test('notifications pause for keyboard focus and return to the action on dismissal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.clock.install();
  await page.goto('/#editor');
  const reset = page.getByRole('button', { name: 'Reset view', exact: true });
  await reset.focus();
  await page.keyboard.press('Enter');
  const dismiss = page.getByRole('button', { name: 'Dismiss notification' });
  await dismiss.focus();
  await page.clock.runFor(8000);
  await expect(dismiss).toBeFocused();
  await expect(page.locator('.toast')).toContainText('Already at the default view (100%).');
  await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(reset).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toBeVisible();
  await page.clock.runFor(8000);
  await expect(page.locator('.toast')).toHaveCount(0);
  await expect(reset).toBeFocused();
  // Identical actions after expiration must produce feedback again.
  await page.keyboard.press('Enter');
  await expect(page.locator('.toast')).toContainText('Already at the default view (100%).');
});

test('fault and hint actions report their result and keyboard history works', async ({ page }) => {
  await page.goto('/#editor');
  const toast = page.locator('.toast');
  await page.getByRole('button', { name: 'Remove fault', exact: true }).click();
  await expect(toast).toContainText('Fault removed.');
  await page.getByRole('button', { name: 'Place open fault here' }).click();
  await expect(toast).toContainText('Fault set: W3');
  await page.getByRole('tab', { name: 'Lab details' }).click();
  await page.locator('#details-hints > summary').click();
  await page.getByRole('button', { name: 'Add a hint' }).click();
  await expect(toast).toContainText('Hint 3 added.');
  await expect(page.getByRole('textbox', { name: 'Hint 3', exact: true })).toBeFocused();
  await page.getByRole('button', { name: 'Remove hint 3' }).click();
  await expect(toast).toContainText('Hint 3 removed.');
  await expect(page.getByRole('button', { name: 'Add a hint' })).toBeFocused();
  await page.keyboard.press('Control+z');
  await expect(toast).toContainText('Last edit undone.');
  await expect(page.getByRole('textbox', { name: 'Hint 3', exact: true })).toBeVisible();
  await page.getByRole('tab', { name: 'Lab details' }).focus();
  await page.keyboard.press('Control+Shift+z');
  await expect(toast).toContainText('Last edit restored.');
  await expect(page.getByRole('textbox', { name: 'Hint 3', exact: true })).toHaveCount(0);
});

test('mobile movement and reset report changes including horizontal scroll', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 900 });
  await page.goto('/#editor');
  await page.locator('.canvas-movement > summary').click();
  await page.getByRole('button', { name: 'Pan right', exact: true }).click();
  await expect(page.locator('.toast')).toHaveText('Circuit view panned right.');
  await page.getByRole('combobox', { name: 'Move', exact: true }).selectOption('start');
  await page.getByRole('button', { name: 'Move START left', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('START moved left.');
  await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
  await expect(page.getByRole('status', { name: 'Canvas zoom' })).toHaveText('120%');
  await page.getByRole('button', { name: 'Reset zoom and pan' }).click();
  await expect(page.locator('.toast')).toContainText('Default view restored at 100%.');
  const viewport = page.locator('.diagram-viewport');
  await viewport.evaluate((node) => {
    node.scrollLeft = 200;
  });
  expect(await viewport.evaluate((node) => node.scrollLeft)).toBeGreaterThan(0);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Default view restored at 100%.');
  expect(await viewport.evaluate((node) => node.scrollLeft)).toBe(0);
  await page.getByRole('button', { name: 'Reset view', exact: true }).click();
  await expect(page.locator('.toast')).toContainText('Already at the default view (100%).');
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll('body *')]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .map((element) => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }));
    for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
  });
  await page.addStyleTag({
    content:
      '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; }',
  });
  const bounds = (await page.locator('.toast').boundingBox())!;
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(320);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(320);
});

test('repeated inspections and diagnoses respond, and clearing observations confirms', async ({
  page,
}) => {
  await page.goto('/#editor');
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal hint 1 of 2' }).click();
  await expect(page.getByRole('log', { name: 'Revealed hints' })).toContainText(
    exampleLab().hints[0],
  );
  await page.getByLabel('Item to inspect').selectOption('hold');
  const inspect = page.getByRole('button', { name: 'Inspect isolated conductor' });
  await inspect.click();
  await expect(page.locator('.inspection-result')).toHaveText('Open conductor');
  await inspect.click();
  await expect(page.locator('.toast')).toContainText('checked again: Open conductor.');
  await page
    .getByLabel('Your explanation')
    .fill('The holding branch is broken, so K1 drops out when START is released.');
  const check = page.getByRole('button', { name: 'Check diagnosis' });
  await check.click();
  await expect(page.locator('.feedback.correct')).toBeVisible();
  await check.click();
  await expect(page.locator('.toast')).toContainText(
    'Diagnosis checked again: the selected fault matches.',
  );
  await page.getByLabel('Item to inspect').selectOption('supply');
  await check.click();
  await expect(page.locator('.feedback.wrong')).toBeVisible();
  await check.click();
  await expect(page.locator('.toast')).toContainText(
    'the selected item or condition does not match the fault.',
  );
  await page.locator('.observations > summary').click();
  const clear = page.getByRole('button', { name: 'Clear observations' });
  await expect(clear).toBeDisabled();
  await page.getByRole('button', { name: 'Turn supply on' }).click();
  await clear.click();
  await expect(page.locator('.toast')).toContainText('Observation log cleared.');
  await expect(clear).toBeDisabled();
  await expect(page.locator('.observations > summary')).toContainText('0 events');
});

test('retry saving reports failure, then confirms a successful recovery', async ({ page }) => {
  await page.addInitScript(() => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = function (key, value) {
      if (!document.documentElement.hasAttribute('data-storage-restored'))
        throw new DOMException('Quota exceeded', 'QuotaExceededError');
      original.call(this, key, value);
    };
  });
  await page.goto('/#editor');
  const retry = page.getByRole('button', { name: 'Retry saving' });
  await retry.click();
  await expect(page.locator('.toast[role="alert"]')).toContainText('Saving failed.');
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await page.evaluate(() => document.documentElement.setAttribute('data-storage-restored', ''));
  await retry.click();
  await expect(page.locator('.toast')).toContainText('Draft saved on this device.');
  await expect(page.getByText('Saved on this device', { exact: true })).toBeVisible();
  expect(
    JSON.parse((await page.evaluate(() => localStorage.getItem('lab-bench:draft:v1')))!).title,
  ).toBe(exampleLab().title);
});

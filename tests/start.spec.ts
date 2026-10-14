import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { exampleLab } from '../src/domain';

test('welcome gives working entry points without needing AI', async ({ page }) => {
  await page.goto('/');
  await expect(
    page.getByRole('heading', { name: 'What will they figure out today?' }),
  ).toBeVisible();
  await expect(page.getByText('AI is unavailable on this server')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('lab-bench:draft:v1'))).toBeNull();
  await page.getByRole('button', { name: 'Open sample editor' }).click();
  await expect(page.getByLabel('Exercise title')).toHaveValue(exampleLab().title);
  await page.getByLabel('Exercise title').fill('My current draft');
  await page.getByRole('button', { name: 'Start a lab', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('lab-bench:draft:v1') ?? '{}').title),
    )
    .toBe('My current draft');
  await page.reload();
  await page.getByRole('button', { name: /Resume current draft/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My current draft');
});

test('walkthrough visits the real tools, can go back or skip, and preserves a draft', async ({
  page,
}) => {
  const draft = { ...exampleLab(), title: 'Keep this draft', fault: 'supply' };
  await page.addInitScript(
    (lab) => localStorage.setItem('lab-bench:draft:v1', JSON.stringify(lab)),
    draft,
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Take the 2-minute tour' }).click();
  const dialog = page.getByRole('dialog', { name: 'Start with what they should learn.' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading')).toBeFocused();
  await expect(page.getByRole('tab', { name: 'Lab details', includeHidden: true })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  const headings = [
    'This is your teaching bench.',
    'Choose what goes wrong.',
    'Try it from their side.',
    'Check it, then make it reusable.',
  ];
  for (const title of headings) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('dialog').getByRole('heading')).toHaveText(title);
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.locator('.control-station')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Keep this draft');
  await expect(page.getByRole('button', { name: 'Show me around' })).toBeFocused();
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('lab-bench:draft:v1')!).fault),
  ).toBe('supply');
  await page.getByRole('button', { name: 'Show me around' }).click();
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Keep this draft');
});

test('AI proposal is reviewable, refinable, applied atomically and undoable', async ({ page }) => {
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  let calls = 0;
  await page.route('**/api/scenario', async (route) => {
    const input = route.request().postDataJSON();
    calls++;
    if (calls === 2) expect(input.previous.title).toBe('AI pump exercise');
    await route.fulfill({
      json: {
        message: 'A scenario for your group.',
        lab: {
          ...exampleLab(),
          title: calls === 1 ? 'AI pump exercise' : 'Short pump exercise',
          durationMinutes: calls === 1 ? 15 : 10,
        },
      },
    });
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'The motor won’t stay on', exact: true }).click();
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByRole('region', { name: 'Scenario proposal' })).toBeFocused();
  await expect(page.getByRole('heading', { name: 'AI pump exercise' })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('lab-bench:draft:v1'))).toBeNull();
  await page.getByRole('button', { name: 'Take the 2-minute tour' }).click();
  await page.getByRole('button', { name: 'Skip tour' }).click();
  await page.getByRole('link', { name: 'Lab Bench authoring' }).click();
  await expect(page.getByRole('heading', { name: 'AI pump exercise' })).toBeVisible();
  await page.getByLabel('What would you like to change?').fill('Make it 10 minutes');
  await page.getByRole('button', { name: 'Revise scenario' }).click();
  await expect(page.getByRole('heading', { name: 'Short pump exercise' })).toBeVisible();
  await page.getByRole('button', { name: 'Use this lab' }).click();
  await expect(page.getByLabel('Exercise title')).toHaveValue('Short pump exercise');
  await expect(page.getByLabel('Suggested duration')).toHaveValue('10');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Exercise title')).toHaveValue(exampleLab().title);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await expect(page.getByLabel('Exercise title')).toHaveValue('Short pump exercise');
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Short pump exercise');
});

test('AI guidance, invalid responses, retry and cancel leave the draft untouched', async ({
  page,
}) => {
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  let mode = 'unsupported';
  await page.route('**/api/scenario', async (route) => {
    if (mode === 'invalid')
      expect(route.request().postDataJSON().context).toEqual([
        { role: 'user', content: 'A plumbing lab' },
        {
          role: 'assistant',
          content: 'Only start/stop circuits are supported. Would you like a holding-circuit lab?',
        },
      ]);
    if (mode === 'unsupported')
      await route.fulfill({
        json: {
          message: 'Only start/stop circuits are supported. Would you like a holding-circuit lab?',
          lab: null,
        },
      });
    else if (mode === 'invalid')
      await route.fulfill({
        json: { message: 'Invalid', lab: { ...exampleLab(), fault: 'invalid' } },
      });
    else if (mode === 'error')
      await route.fulfill({ status: 502, json: { error: 'Service is unavailable.' } });
    else {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.fulfill({ json: { message: 'Ready', lab: exampleLab() } });
    }
  });
  await page.goto('/');
  await page.getByLabel('What should your apprentices learn?').fill('A plumbing lab');
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByText(/Only start\/stop circuits are supported/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Use this lab' })).toHaveCount(0);
  mode = 'invalid';
  await page.getByLabel('What would you like to change?').fill('A motor lab');
  await page.getByRole('button', { name: 'Revise scenario' }).click();
  await expect(page.getByRole('alert')).toContainText('Your current lab is unchanged');
  mode = 'error';
  await page.getByRole('button', { name: 'Revise scenario' }).click();
  await expect(page.getByRole('alert')).toContainText('Service is unavailable');
  mode = 'delayed';
  await page.getByRole('button', { name: 'Revise scenario' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Revise scenario' })).toBeEnabled();
  expect(await page.evaluate(() => localStorage.getItem('lab-bench:draft:v1'))).toBeNull();
});

test('welcome, proposal and walkthrough fit small screens and pass accessibility checks', async ({
  page,
}) => {
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  await page.route('**/api/scenario', (route) =>
    route.fulfill({ json: { message: 'Ready for review.', lab: exampleLab() } }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth))
    .toBe(true);
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'The motor won’t stay on', exact: true }).click();
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByRole('button', { name: 'Use this lab' })).toBeVisible();
  expect(
    (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
      .violations,
  ).toEqual([]);
  await page.getByRole('button', { name: 'Take the 2-minute tour' }).click();
  for (let i = 0; i < 5; i++) {
    const card = page.locator('.tour-card');
    const box = await card.boundingBox();
    expect(box!.x).toBeGreaterThanOrEqual(0);
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    expect(
      (await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze())
        .violations,
    ).toEqual([]);
    await page
      .getByRole('button', { name: i === 4 ? 'Start building' : 'Next', exact: true })
      .click();
  }
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

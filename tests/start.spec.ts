import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { exampleLab } from '../src/domain';

async function chooseAI(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('radio', { name: /Describe my own lesson/ }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
}

test('one-card entry, sample and resume work without AI', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let’s walk the bench.');
  await expect(page.getByRole('textbox')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Open sample editor' })).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('lab-bench:draft:v1'))).toBeNull();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('button', { name: 'Open sample editor' }).click();
  await page.locator('#details-basic > summary').click();
  await page.getByLabel('Exercise title').fill('My current draft');
  await page.getByRole('button', { name: 'Home', exact: true }).click();
  await expect
    .poll(() =>
      page.evaluate(() => JSON.parse(localStorage.getItem('lab-bench:draft:v1') ?? '{}').title),
    )
    .toBe('My current draft');
  await page.reload();
  await page.getByRole('button', { name: 'Resume current draft' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('My current draft');
});

test('paginated guide can go back, finish and replay without changing the draft', async ({
  page,
}) => {
  const draft = { ...exampleLab(), title: 'Keep this draft', fault: 'supply' };
  await page.addInitScript(
    (lab) => localStorage.setItem('lab-bench:draft:v1', JSON.stringify(lab)),
    draft,
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Let’s begin' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(
    'Write the apprentice’s instructions.',
  );
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await page.getByRole('button', { name: 'Back', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let’s walk the bench.');
  await page.getByRole('button', { name: 'Let’s begin' }).click();
  for (const title of [
    'Choose one open conductor.',
    'Test the lab as an apprentice.',
    'Export a reusable lab file.',
  ]) {
    await page.getByRole('button', { name: 'Next', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
  }
  await page.getByRole('button', { name: 'Create a lab', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How would you like to start?');
  expect(
    await page.evaluate(() => JSON.parse(localStorage.getItem('lab-bench:draft:v1')!).fault),
  ).toBe('supply');
  await page.getByRole('button', { name: 'Resume current draft' }).click();
  await page.getByRole('button', { name: 'Show me around' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Let’s walk the bench.');
  await page.getByRole('button', { name: 'Resume current draft' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Keep this draft');
});

test('AI has separate composition and review cards, preserves proposals and applies atomically', async ({
  page,
}) => {
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  let calls = 0;
  await page.route('**/api/scenario', async (route) => {
    calls++;
    if (calls === 2) expect(route.request().postDataJSON().previous.title).toBe('AI pump exercise');
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
  await chooseAI(page);
  await page.getByRole('button', { name: 'Use this example' }).click();
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI pump exercise');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  await expect(page.getByRole('textbox')).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem('lab-bench:draft:v1'))).toBeNull();
  await page.getByRole('button', { name: 'Walk me through it again' }).click();
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('AI pump exercise');
  await page.getByRole('button', { name: 'Make a change' }).click();
  await page.getByLabel('What would you like to change?').fill('Make it 10 minutes');
  await page.getByRole('button', { name: 'Revise scenario' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Short pump exercise');
  await page.getByRole('button', { name: 'Use this lab' }).click();
  await expect(page.getByLabel('Suggested duration')).toHaveValue('10');
  await page.getByRole('button', { name: 'Undo', exact: true }).click();
  await expect(page.getByLabel('Exercise title')).toHaveValue(exampleLab().title);
  await page.getByRole('button', { name: 'Redo', exact: true }).click();
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Short pump exercise');
});

test('AI guidance, errors, back navigation and cancellation preserve user work', async ({
  page,
}) => {
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  let mode = 'unsupported';
  let calls = 0;
  await page.route('**/api/scenario', async (route) => {
    calls++;
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
      await new Promise((resolve) => setTimeout(resolve, 900));
      await route.fulfill({ json: { message: 'Ready', lab: exampleLab() } });
    }
  });
  await chooseAI(page);
  await page.getByLabel('What should your apprentices learn?').fill('A plumbing lab');
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByText(/Only start\/stop circuits are supported/)).toBeVisible();
  mode = 'invalid';
  await page.getByLabel('How would you like to continue?').fill('A motor lab');
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByRole('alert')).toContainText('Your current lab is unchanged');
  mode = 'error';
  await page.getByRole('button', { name: 'Send reply' }).click();
  await expect(page.getByRole('alert')).toContainText('Service is unavailable');
  mode = 'delayed';
  await page.getByRole('button', { name: 'Send reply' }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(page.getByRole('button', { name: 'Send reply' })).toBeEnabled();
  await page.getByRole('button', { name: 'Send reply' }).click();
  await page.getByRole('button', { name: 'Back to choices', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('How would you like to start?');
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await expect(page.getByLabel('How would you like to continue?')).toHaveValue('A motor lab');
  expect(await page.evaluate(() => localStorage.getItem('lab-bench:draft:v1'))).toBeNull();
  expect(calls).toBe(5);
});

test('every card fits a phone and passes accessibility checks', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  await page.route('**/api/scenario', (route) =>
    route.fulfill({ json: { message: 'Ready for review.', lab: exampleLab() } }),
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const accessible = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze()
      ).violations,
    ).toEqual([]);
  };
  for (let i = 0; i < 5; i++) {
    const next = page.getByRole('button', {
      name: i === 0 ? 'Let’s begin' : i === 4 ? 'Create a lab' : 'Next',
      exact: true,
    });
    const box = await next.boundingBox();
    expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    await accessible();
    await next.click();
  }
  await accessible();
  await page.getByRole('radio', { name: /Describe my own lesson/ }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await accessible();
  await page.getByRole('button', { name: 'Use this example' }).click();
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByRole('button', { name: 'Use this lab' })).toBeVisible();
  await accessible();
});

test('mobile editor and preview put their first action in the initial viewport', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('button', { name: 'Open sample editor' }).click();
  const next = await page.getByRole('button', { name: 'Next: choose a fault' }).boundingBox();
  expect(next!.y + next!.height).toBeLessThan(844);
  await page.getByRole('button', { name: 'Next: choose a fault' }).click();
  await expect(page.getByRole('tab', { name: 'Fault setup' })).toBeFocused();
  await page.getByRole('button', { name: 'W1 Supply conductor', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.getByRole('tab', { name: 'Fault setup' })).toBeFocused();
  await expect(page.getByLabel('Selected conductor')).toHaveValue('supply');
  await page.getByRole('button', { name: 'Next: review lab' }).click();
  await expect(page.getByRole('tab', { name: 'Review' })).toBeFocused();
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).first().click();
  const start = await page.getByRole('button', { name: 'Hold START' }).boundingBox();
  expect(start!.y + start!.height).toBeLessThan(844);
  const controls = await page.locator('.control-station').boundingBox();
  const circuit = await page.locator('.circuit-panel').boundingBox();
  expect(controls!.y).toBeLessThan(circuit!.y);
  await expect(page.getByText('Scroll sideways to explore the circuit')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reset zoom and pan' })).toBeVisible();
});

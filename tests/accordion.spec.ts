import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { exampleLab } from '../src/domain';

for (const width of [1440, 390]) {
  test(`authoring accordions preserve edits and keep Next visible at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await page.getByRole('button', { name: 'Open sample editor' }).click();
    const next = page.getByRole('button', { name: 'Next: choose a fault' });
    const nextFits = async () => {
      const box = await next.boundingBox();
      expect(box!.y).toBeGreaterThanOrEqual(0);
      expect(box!.y + box!.height).toBeLessThanOrEqual(844);
    };
    await nextFits();
    const titleSection = page.locator('#details-basic > summary');
    await titleSection.focus();
    await page.keyboard.press('Enter');
    await page.getByLabel('Exercise title').fill('A saved accordion draft');
    await page.locator('#details-brief > summary').click();
    await expect(page.getByLabel('Exercise title')).toBeHidden();
    await page.getByLabel('Learning objective').fill('Explain why the holding path matters.');
    await nextFits();
    await page.locator('#details-hints > summary').click();
    await expect(page.getByLabel('Learning objective')).toBeHidden();
    await page
      .getByRole('textbox', { name: 'Hint 1', exact: true })
      .fill('Trace the holding path.');
    await nextFits();
    await page.locator('#details-basic > summary').click();
    await expect(page.getByLabel('Exercise title')).toHaveValue('A saved accordion draft');
    await next.click();
    await page.getByRole('button', { name: 'Next: review lab' }).click();
    await page.getByRole('tab', { name: 'Lab details' }).click();
    await page.locator('#details-hints > summary').click();
    await expect(page.getByRole('textbox', { name: 'Hint 1', exact: true })).toHaveValue(
      'Trace the holding path.',
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

for (const width of [1440, 390]) {
  test(`long AI briefs leave the next accordion header unobscured at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.route('**/api/assistant/status', (route) =>
      route.fulfill({ json: { available: true } }),
    );
    await page.route('**/api/scenario', (route) =>
      route.fulfill({
        json: {
          message: 'Review the proposed instructions.',
          lab: {
            ...exampleLab(),
            briefing:
              'Observe the pump while holding START. Release the button and compare the result. '.repeat(
                20,
              ),
          },
        },
      }),
    );
    await page.goto('/');
    await page.getByRole('button', { name: 'Skip intro' }).click();
    await page.getByRole('radio', { name: /Describe my own lesson/ }).check();
    await page.getByRole('button', { name: 'Continue', exact: true }).click();
    await page.getByRole('button', { name: 'Use this example' }).click();
    await page.getByRole('button', { name: 'Draft my lab' }).click();
    await page.locator('.proposal-brief > summary').focus();
    await page.keyboard.press('Enter');
    await page.keyboard.press('Tab');
    const hints = page.locator('.proposal-hints > summary');
    await expect(hints).toBeFocused();
    await expect
      .poll(() =>
        hints.evaluate((summary) => {
          const bounds = summary.getBoundingClientRect();
          const footer = document.querySelector('.flow-review-actions')!.getBoundingClientRect();
          return (
            bounds.top >= 0 &&
            bounds.bottom <= footer.top &&
            summary.contains(
              document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
            )
          );
        }),
      )
      .toBe(true);
  });
}

test('review issues open and focus the correct collapsed field', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/#editor');
  await page.getByRole('tab', { name: 'Lab details' }).click();
  await page.locator('#details-brief > summary').click();
  await page.getByLabel('Learning objective').fill('');
  await page.locator('#details-hints > summary').click();
  await page.getByRole('button', { name: 'Add a hint' }).click();
  await page.getByRole('button', { name: 'Next: choose a fault' }).click();
  await page.getByRole('button', { name: 'Next: review lab' }).click();
  await page.getByRole('button', { name: /Set a learning objective/ }).click();
  await expect(page.getByLabel('Learning objective')).toBeFocused();
  await expect(page.getByLabel('Learning objective')).toBeVisible();
  await page.getByLabel('Learning objective').fill('Explain the holding contact.');
  await page.getByRole('tab', { name: 'Review' }).click();
  await page.getByRole('button', { name: /Finish any hints you added/ }).click();
  await expect(page.getByRole('textbox', { name: 'Hint 3', exact: true })).toBeFocused();
  await expect(page.getByRole('textbox', { name: 'Hint 3', exact: true })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'Hint 3', exact: true })
    .fill('Compare START with the holding contact.');
  await page.getByRole('tab', { name: 'Review' }).click();
  await expect(page.getByRole('heading', { name: 'Ready for a practice run.' })).toBeVisible();
});

test('collapsing preview details preserves revealed hints and observations', async ({ page }) => {
  await page.goto('/#editor');
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
  await page.getByRole('button', { name: 'Reveal hint 1 of 2' }).click();
  await page.locator('.preview-brief > summary').click();
  await expect(
    page.getByText('What should keep K1 energized after START is released?'),
  ).toBeHidden();
  await page.getByRole('button', { name: 'Turn supply on' }).click();
  await page.locator('.observations > summary').click();
  await expect(page.locator('.observations li')).toContainText(['Supply on.']);
  await page.locator('.observations > summary').click();
  await page.locator('.preview-brief > summary').click();
  await expect(
    page.getByText('What should keep K1 energized after START is released?'),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Reveal hint 2 of 2' })).toBeEnabled();
});

for (const viewport of [
  { width: 1440, height: 844 },
  { width: 844, height: 390 },
]) {
  test(`keyboard-focused instructions stay above the sticky footer at ${viewport.width}x${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto('/#editor');
    await page.getByRole('tab', { name: 'Lab details' }).click();
    await page.locator('#details-brief > summary').click();
    await page.getByLabel('Learning objective').focus();
    await page.keyboard.press('Tab');
    const instructions = page.getByLabel('Apprentice instructions');
    await expect(instructions).toBeFocused();
    await expect
      .poll(() =>
        instructions.evaluate((field) => {
          const bounds = field.getBoundingClientRect();
          const footer = document.querySelector('.inspector-footer')!.getBoundingClientRect();
          return (
            bounds.top >= 0 &&
            bounds.bottom <= footer.top &&
            document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2) ===
              field
          );
        }),
      )
      .toBe(true);
  });
}

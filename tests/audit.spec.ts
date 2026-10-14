import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile } from 'node:fs/promises';
import { COMPONENTS, WIRES, componentInfo, exampleLab, wireInfo } from '../src/domain';

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    (await page.viewportSize())!.width,
  );
}
async function accessible(page: Page) {
  const report = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(report.violations).toEqual([]);
}

for (const fault of WIRES) {
  test(`${wireInfo[fault].tag}: controls, all inspections, diagnosis and observations`, async ({
    page,
  }) => {
    const errors: string[] = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto('/#editor');
    await page.getByLabel('Selected conductor').selectOption(fault);
    if (fault !== 'hold') await page.getByRole('button', { name: 'Place open fault here' }).click();
    await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
    const start = page.getByRole('button', { name: 'Hold START' });
    const stop = page.getByRole('button', { name: 'Hold STOP' });
    const coil = page.locator('.coil-state');
    await start.focus();
    await page.keyboard.down('Space');
    await expect(coil).toHaveText('K1 de-energized');
    await page.keyboard.up('Space');
    await page.getByRole('button', { name: 'Turn supply on' }).click();
    await start.focus();
    await page.keyboard.down('Enter');
    await expect(coil).toHaveText(fault === 'hold' ? 'K1 energized' : 'K1 de-energized');
    await page.keyboard.up('Enter');
    await expect(coil).toHaveText('K1 de-energized');
    // Exercise overlapping input events without changing focus and releasing START.
    await page.keyboard.down('Enter');
    await stop.dispatchEvent('keydown', { key: ' ', repeat: false });
    await expect(coil).toHaveText('K1 de-energized');
    await stop.dispatchEvent('keyup', { key: ' ' });
    await page.keyboard.up('Enter');
    await expect(start).toHaveAttribute('aria-pressed', 'false');
    await expect(stop).toHaveAttribute('aria-pressed', 'false');
    await page.getByLabel('Item to inspect').selectOption(fault);
    await expect(page.getByRole('button', { name: 'Inspect isolated conductor' })).toBeDisabled();
    await page.getByRole('button', { name: 'Isolate supply' }).click();
    for (const wire of WIRES) {
      await page.getByLabel('Item to inspect').selectOption(wire);
      await page.getByRole('button', { name: 'Inspect isolated conductor' }).click();
      await expect(page.locator('.inspection-result')).toContainText(
        wire === fault ? 'Open conductor' : 'Intact conductor',
      );
    }
    await page.getByLabel('Your explanation').fill('   ');
    await expect(page.getByRole('button', { name: 'Check diagnosis' })).toBeDisabled();
    await page.getByLabel('Your explanation').fill('The open conductor interrupts the path to K1.');
    await page.getByLabel('Item to inspect').selectOption(WIRES.find((wire) => wire !== fault)!);
    await page.getByRole('button', { name: 'Check diagnosis' }).click();
    await expect(page.locator('.feedback.wrong')).toContainText('Compare your observations');
    await page.getByLabel('Item to inspect').selectOption(fault);
    await expect(page.locator('.feedback')).toHaveCount(0);
    await page.getByRole('button', { name: 'Check diagnosis' }).click();
    await expect(page.getByText('Fault located.')).toBeVisible();
    await page.getByRole('button', { name: 'Reveal hint 1 of 2' }).click();
    await page.getByRole('button', { name: 'Reveal hint 2 of 2' }).click();
    await expect(page.getByRole('button', { name: 'All hints revealed' })).toBeDisabled();
    await page.locator('.observations > summary').click();
    await expect(page.locator('.observations li')).toHaveCount(6);
    await page.getByRole('button', { name: 'Clear observations' }).click();
    await expect(page.locator('.observations li')).toHaveCount(0);
    expect(errors).toEqual([]);
  });
}

for (const width of [320, 1440]) {
  test(`click-only layout and view controls at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/#editor');
    await page.locator('.canvas-movement > summary').click();
    for (const id of COMPONENTS) {
      await page.getByRole('combobox', { name: 'Move', exact: true }).selectOption(id);
      const component = page.locator(`[data-component="${id}"]`);
      const before = await component.getAttribute('transform');
      await page
        .getByRole('button', { name: `Move ${componentInfo[id].label} left`, exact: true })
        .click();
      await expect(component).not.toHaveAttribute('transform', before!);
      await page.getByRole('button', { name: 'Undo', exact: true }).click();
      await expect(component).toHaveAttribute('transform', before!);
      await page.getByRole('button', { name: 'Redo', exact: true }).click();
      await expect(component).not.toHaveAttribute('transform', before!);
      await page
        .getByRole('button', { name: `Move ${componentInfo[id].label} right`, exact: true })
        .click();
      await expect(component).toHaveAttribute('transform', before!);
      await page
        .getByRole('button', { name: `Move ${componentInfo[id].label} up`, exact: true })
        .click();
      await page
        .getByRole('button', { name: `Move ${componentInfo[id].label} down`, exact: true })
        .click();
      await expect(component).toHaveAttribute('transform', before!);
    }
    await page.getByRole('combobox', { name: 'Move', exact: true }).selectOption('view');
    const board = page.locator('.circuit-svg > g');
    for (const direction of ['left', 'up', 'down', 'right']) {
      await page.getByRole('button', { name: `Pan ${direction}`, exact: true }).click();
    }
    await expect(board).toHaveAttribute(
      'transform',
      'translate(460 260) scale(1) translate(-460 -260)',
    );
    for (let i = 0; i < 10; i++)
      await page.getByRole('button', { name: 'Pan left', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pan left', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Reset view', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Pan left', exact: true })).toBeEnabled();
    for (let i = 0; i < 4; i++)
      await page.getByRole('button', { name: 'Zoom in', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Zoom in', exact: true })).toBeDisabled();
    for (const item of await page.locator('[data-wire], [data-component]').all()) {
      await item.focus();
      await expect
        .poll(() =>
          item.evaluate((element) => {
            const box = element.getBoundingClientRect();
            const view = element.closest('.diagram-viewport')!.getBoundingClientRect();
            return (
              box.right > view.left &&
              box.left < view.right &&
              box.bottom > view.top &&
              box.top < view.bottom
            );
          }),
        )
        .toBe(true);
    }
    await page.getByRole('button', { name: 'Zoom out', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Zoom out', exact: true })).toBeDisabled();
    await page.getByRole('button', { name: 'Reset zoom and pan', exact: true }).click();
    await expect(page.locator('.zoom-label')).toHaveText('100%');
    await noOverflow(page);
  });
}

test('zoomed partial component drag keeps scale; canceled pan restores the original view', async ({
  page,
}) => {
  await page.goto('/#editor');
  for (let i = 0; i < 4; i++) await page.getByRole('button', { name: 'Zoom in' }).click();
  const coil = page.locator('[data-component="coil"]');
  const box = (await coil.boundingBox())!;
  await page.mouse.move(box.x + 8, box.y + box.height / 2);
  await page.mouse.down();
  await expect(page.locator('.zoom-label')).toHaveText('180%');
  await page.mouse.move(box.x + 28, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up();
  await expect(coil).toHaveAttribute('transform', 'translate(720 260)');
  await page.getByRole('button', { name: 'Reset zoom and pan' }).click();
  await page.getByRole('button', { name: 'Pan tool' }).click();
  const svg = page.locator('.circuit-svg');
  const view = (await svg.boundingBox())!;
  const board = page.locator('.circuit-svg > g');
  const initial = await board.getAttribute('transform');
  await page.mouse.move(view.x + 100, view.y + 60);
  await page.mouse.down();
  await page.mouse.move(view.x + 180, view.y + 90);
  await expect(board).not.toHaveAttribute('transform', initial!);
  await page.keyboard.press('Escape');
  await page.mouse.up();
  await expect(board).toHaveAttribute('transform', initial!);
  await page.getByRole('button', { name: 'Select tool' }).click();
  await expect(page.getByRole('button', { name: 'Select tool' })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
});

test('keyboard entry, tabs, hint limits and component activation retain useful focus', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip intro' }).press('Enter');
  await page.getByRole('button', { name: 'Open sample editor' }).press('Enter');
  await expect(page.getByRole('heading', { level: 1 })).toBeFocused();
  const details = page.getByRole('tab', { name: 'Lab details' });
  await details.focus();
  await page.keyboard.press('ArrowRight');
  await expect(page.getByRole('tab', { name: 'Fault setup' })).toBeFocused();
  await page.keyboard.press('End');
  await expect(page.getByRole('tab', { name: 'Review' })).toBeFocused();
  await page.keyboard.press('Home');
  await expect(details).toBeFocused();
  await page.locator('#details-hints > summary').press('Enter');
  await page.getByRole('button', { name: 'Add a hint' }).press('Enter');
  await expect(page.getByRole('textbox', { name: 'Hint 3', exact: true })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Add a hint' })).toBeDisabled();
  await page.getByRole('textbox', { name: 'Hint 3', exact: true }).fill('Follow the holding path.');
  for (const i of [3, 2, 1]) {
    await page.getByRole('button', { name: `Remove hint ${i}` }).press('Enter');
    await expect(page.getByRole('button', { name: 'Add a hint' })).toBeFocused();
  }
  await page.locator('#details-basic > summary').press('Space');
  for (const minutes of ['5', '60']) {
    await page.getByLabel('Suggested duration').selectOption(minutes);
    await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
    await expect(page.locator('.duration')).toContainText(minutes);
    await expect(page.getByRole('button', { name: /Reveal hint/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Back to authoring' }).click();
    await page.locator('#details-basic > summary').click();
  }
  await page.locator('[data-component="start"]').press('Enter');
  await expect(page.getByRole('combobox', { name: 'Move', exact: true })).toBeFocused();
  await expect(page.getByRole('combobox', { name: 'Move', exact: true })).toHaveValue('start');
});

test('all About exits restore focus and the brand link resumes the same draft', async ({
  page,
}) => {
  await page.goto('/#editor');
  for (const exit of ['Escape', 'Close about dialog', 'Back to the workbench']) {
    const trigger = page.getByRole('button', { name: 'About Lab Bench', exact: true });
    await trigger.click();
    await expect(page.getByRole('button', { name: 'Close about dialog' })).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Back to the workbench' })).toBeFocused();
    // Native dialogs may include browser chrome in the Tab cycle; background controls stay inert.
    await page
      .getByRole('link', { name: 'Lab Bench authoring' })
      .evaluate((el) => (el as HTMLElement).focus());
    await expect(page.getByRole('button', { name: 'Back to the workbench' })).toBeFocused();
    if (exit === 'Escape') await page.keyboard.press('Escape');
    else await page.getByRole('button', { name: exit, exact: true }).click();
    await expect(trigger).toBeFocused();
  }
  await page.getByRole('button', { name: 'About this work sample' }).click();
  await page.getByRole('button', { name: 'Close about dialog' }).click();
  await expect(page.getByRole('button', { name: 'About this work sample' })).toBeFocused();
  await page.getByRole('link', { name: 'Lab Bench authoring' }).click();
  await page.getByRole('button', { name: 'Resume current draft' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(exampleLab().title);
});

test('native file choosers open from both entry points and repeated imports round-trip', async ({
  page,
}) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByText('Import a saved lab file', { exact: true }).click();
  const fixture = {
    ...exampleLab(),
    title: '<script>not executable</script>',
    durationMinutes: 22,
  };
  fixture.positions.start.x = 455.5;
  const upload = {
    name: 'audit.lab.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(fixture)),
  };
  for (const name of ['Import a lab file', 'Import']) {
    const chooser = page.waitForEvent('filechooser');
    await page.getByRole('button', { name, exact: true }).click();
    await (await chooser).setFiles(upload);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(fixture.title);
    await expect(page.locator('h1 script')).toHaveCount(0);
  }
  const downloading = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Export lab file', exact: true }).click();
  const download = await downloading;
  expect(JSON.parse(await readFile((await download.path())!, 'utf8'))).toEqual(fixture);
  await page.getByRole('button', { name: 'Dismiss notification' }).click();
  await expect(page.locator('.toast')).toHaveCount(0);
});

test('320px reflow and WCAG 2.2 checks cover entry, AI, expanded forms and preview', async ({
  page,
}) => {
  test.setTimeout(120000);
  await page.setViewportSize({ width: 320, height: 800 });
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  await page.route('**/api/scenario', (route) =>
    route.fulfill({ json: { message: 'Review your exercise.', lab: exampleLab() } }),
  );
  await page.goto('/');
  for (let i = 0; i < 5; i++) {
    await noOverflow(page);
    await accessible(page);
    await page
      .getByRole('button', {
        name: i === 0 ? /Let.s begin/ : i === 4 ? 'Create a lab' : 'Next',
        exact: true,
      })
      .click();
  }
  await noOverflow(page);
  await accessible(page);
  await page.getByRole('radio', { name: /Describe my own lesson/ }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Use this example' }).click();
  await noOverflow(page);
  await accessible(page);
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByRole('button', { name: 'Use this lab' })).toBeVisible();
  await noOverflow(page);
  await accessible(page);
  await page.getByRole('button', { name: 'Use this lab' }).click();
  for (const id of ['basic', 'brief', 'hints']) {
    await page.locator(`#details-${id} > summary`).click();
    await noOverflow(page);
    await accessible(page);
  }
  await page.getByRole('tab', { name: 'Fault setup' }).click();
  await page.getByText('About this conductor', { exact: true }).click();
  await page.getByText('Expected circuit response', { exact: true }).click();
  await page.locator('.canvas-movement > summary').click();
  await noOverflow(page);
  await accessible(page);
  await page.getByRole('button', { name: 'Apprentice preview', exact: true }).click();
  await page.locator('.canvas-movement > summary').click();
  await page.getByRole('button', { name: 'Pan right', exact: true }).click();
  await noOverflow(page);
  await accessible(page);
  await page.getByRole('button', { name: 'About Lab Bench' }).click();
  await noOverflow(page);
  await accessible(page);
});

test('enlarged and spaced text keeps both AI review actions readable and usable', async ({
  page,
}) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  await page.route('**/api/scenario', (route) =>
    route.fulfill({ json: { message: 'Review the draft.', lab: exampleLab() } }),
  );
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('radio', { name: /Describe my own lesson/ }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Use this example' }).click();
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(exampleLab().title);
  await page.evaluate(() => {
    const sizes = [...document.querySelectorAll('body *')]
      .filter((element): element is HTMLElement => element instanceof HTMLElement)
      .map((element) => ({ element, size: parseFloat(getComputedStyle(element).fontSize) }));
    for (const { element, size } of sizes) element.style.fontSize = `${size * 2}px`;
  });
  await page.addStyleTag({
    content:
      '* { line-height: 1.5 !important; letter-spacing: .12em !important; word-spacing: .16em !important; } p { margin-bottom: 2em !important; }',
  });
  for (const name of ['Make a change', 'Use this lab']) {
    const button = page.getByRole('button', { name, exact: true });
    await button.focus();
    const fits = await button.evaluate((element) => {
      const button = element.getBoundingClientRect();
      const card = element.closest('.flow-card')!.getBoundingClientRect();
      const range = document.createRange();
      const text = [...element.childNodes].find(
        (node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim(),
      )!;
      range.selectNodeContents(text);
      return [...range.getClientRects()].every(
        (line) =>
          line.left >= card.left &&
          line.right <= card.right &&
          line.top >= button.top &&
          line.bottom <= button.bottom,
      );
    });
    expect(fits).toBe(true);
  }
  await page.getByRole('button', { name: 'Make a change', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Revise the proposed lab.');
  await page.getByRole('button', { name: 'Back to review' }).click();
  await page.getByRole('button', { name: 'Use this lab', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(exampleLab().title);
});

test('a late canceled AI response cannot replace a newer proposal', async ({ page }) => {
  await page.route('**/api/assistant/status', (route) =>
    route.fulfill({ json: { available: true } }),
  );
  let releaseOld!: () => void;
  let oldFinished!: () => void;
  const oldReleased = new Promise<void>((resolve) => {
    releaseOld = resolve;
  });
  const oldDone = new Promise<void>((resolve) => {
    oldFinished = resolve;
  });
  let calls = 0;
  await page.route('**/api/scenario', async (route) => {
    const old = ++calls === 1;
    if (old) await oldReleased;
    await route.fulfill({
      json: {
        message: 'Ready.',
        lab: { ...exampleLab(), title: old ? 'Canceled proposal' : 'Newer proposal' },
      },
    });
    if (old) oldFinished();
  });
  await page.goto('/');
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await page.getByRole('radio', { name: /Describe my own lesson/ }).check();
  await page.getByRole('button', { name: 'Continue', exact: true }).click();
  await page.getByRole('button', { name: 'Use this example' }).click();
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect.poll(() => calls).toBe(1);
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await page.getByRole('button', { name: 'Draft my lab' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Newer proposal');
  releaseOld();
  await oldDone;
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Newer proposal');
  await page.getByRole('button', { name: 'Use this lab' }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Newer proposal');
  expect(calls).toBe(2);
});

test('focus indicators stay distinct on selected faults and hovered components', async ({
  page,
}) => {
  await page.goto('/#editor');
  await page.keyboard.press('Tab');
  const fault = page.locator('[data-wire="hold"]');
  await fault.focus();
  expect(
    await fault.locator('.wire-halo').evaluate((element) => getComputedStyle(element).stroke),
  ).toBe('rgb(59, 130, 115)');
  const start = page.locator('[data-component="start"]');
  await start.hover();
  await start.focus();
  expect(
    await start.locator('.component-box').evaluate((element) => getComputedStyle(element).stroke),
  ).toBe('rgb(49, 121, 94)');
});

test('save announcements and unload protection agree with the persisted draft at every transition', async ({
  page,
}) => {
  await page.goto('/#editor');
  await expect(page.getByText('Saved on this device')).toBeVisible();
  await page.getByRole('tab', { name: 'Lab details' }).click();
  await page.locator('#details-basic > summary').click();
  await page.evaluate(() => {
    const status = document.querySelector('.save-state')!;
    const records: { saved: boolean; warned: boolean; matches: boolean }[] = [];
    new MutationObserver(() => {
      const saved = status.textContent?.trim() === 'Saved on this device';
      const event = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(event);
      records.push({
        saved,
        warned: event.defaultPrevented,
        matches:
          JSON.parse(localStorage.getItem('lab-bench:draft:v1')!).title ===
          document.querySelector('main.author-page h1')!.textContent,
      });
      status.setAttribute('data-audit', JSON.stringify(records));
    }).observe(status, { childList: true, subtree: true, characterData: true });
  });
  for (const title of ['Saved first edit', 'Saved second edit', 'Saved final edit']) {
    await page.getByLabel('Exercise title').fill(title);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
    await expect(page.getByText('Saved on this device')).toBeVisible();
  }
  const records = JSON.parse((await page.locator('.save-state').getAttribute('data-audit'))!) as {
    saved: boolean;
    warned: boolean;
    matches: boolean;
  }[];
  expect(records.filter((entry) => entry.saved)).toHaveLength(3);
  expect(records.filter((entry) => !entry.saved)).toHaveLength(3);
  for (const record of records) {
    expect(record.warned).toBe(!record.saved);
    if (record.saved) expect(record.matches).toBe(true);
  }
  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Saved final edit');
});

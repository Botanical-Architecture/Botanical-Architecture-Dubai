const { test, expect } = require('@playwright/test');

async function openPopupViaSlider(page) {
  await page.goto('/');
  await page.locator('#slider').evaluate((el) => {
    el.value = 3;
    el.dispatchEvent(new Event('input'));
  });
  await expect(page.locator('#popup')).toBeVisible();
}

function decodeMailto(href) {
  const url = new URL(href);
  const params = new URLSearchParams(url.search);
  return {
    to: url.pathname,
    subject: params.get('subject'),
    body: params.get('body'),
  };
}

test('popup is hidden on load and stays hidden without any slider interaction', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#popup')).toBeHidden();

  // give any stray async trigger a chance to fire before asserting it didn't
  await page.waitForTimeout(500);
  await expect(page.locator('#popup')).toBeHidden();
});

test('the first slider interaction opens the popup on the proposal step', async ({ page }) => {
  await openPopupViaSlider(page);
  await expect(page.locator('#popup-step-1')).toBeVisible();
  await expect(page.locator('#popup-step-2')).toBeHidden();
});

test('closing the auto-triggered popup does not bring it back on further slider moves', async ({ page }) => {
  await openPopupViaSlider(page);
  await page.locator('#popup-close').click();
  await expect(page.locator('#popup')).toBeHidden();

  await page.locator('#slider').evaluate((el) => {
    el.value = 6;
    el.dispatchEvent(new Event('input'));
  });

  await expect(page.locator('#popup')).toBeHidden();
});

test('the "Start a Proposal" button in Contact opens the popup regardless of slider state', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#popup')).toBeHidden();

  await page.locator('#contact-start-proposal').click();

  await expect(page.locator('#popup')).toBeVisible();
  await expect(page.locator('#popup-step-1')).toBeVisible();
});

test('the popup can be dragged by its handle away from its default corner', async ({ page }) => {
  await openPopupViaSlider(page);

  const before = await page.locator('#popup').boundingBox();

  const handle = page.locator('#popup-drag-handle');
  const handleBox = await handle.boundingBox();

  await page.mouse.move(handleBox.x + handleBox.width / 2, handleBox.y + handleBox.height / 2);
  await page.mouse.down();
  await page.mouse.move(200, 200, { steps: 10 });
  await page.mouse.up();

  const after = await page.locator('#popup').boundingBox();

  expect(after.x).not.toBeCloseTo(before.x, 0);
  expect(after.y).not.toBeCloseTo(before.y, 0);
});

test('submitting an empty proposal alerts and keeps step 1 open', async ({ page }) => {
  await openPopupViaSlider(page);

  let alertMessage = null;
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  await page.locator('#popup-next').click();

  expect(alertMessage).toBe("Tell us a little about your proposal");
  await expect(page.locator('#popup-step-1')).toBeVisible();
  await expect(page.locator('#popup-step-2')).toBeHidden();
});

test('a filled-in proposal advances to the budget step, and Back returns to step 1', async ({ page }) => {
  await openPopupViaSlider(page);

  await page.locator('#proposal').fill('A courtyard entrance with layered greenery.');
  await page.locator('#popup-next').click();

  await expect(page.locator('#popup-step-1')).toBeHidden();
  await expect(page.locator('#popup-step-2')).toBeVisible();

  await page.locator('#popup-back').click();

  await expect(page.locator('#popup-step-1')).toBeVisible();
  await expect(page.locator('#popup-step-2')).toBeHidden();
});

test('submitting an empty budget alerts and keeps step 2 open', async ({ page }) => {
  await openPopupViaSlider(page);

  await page.locator('#proposal').fill('A courtyard entrance with layered greenery.');
  await page.locator('#popup-next').click();

  let alertMessage = null;
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  await page.locator('#popup-send').click();

  expect(alertMessage).toBe('Enter an estimated budget');
  await expect(page.locator('#popup-step-2')).toBeVisible();
});

test('clicking a budget chip fills the budget field', async ({ page }) => {
  await openPopupViaSlider(page);

  await page.locator('#proposal').fill('A courtyard entrance with layered greenery.');
  await page.locator('#popup-next').click();

  await page.locator('.budget-chip', { hasText: 'AED 20,000' }).click();

  await expect(page.locator('#budget')).toHaveValue('AED 20,000');
});

test('sending a complete proposal builds a mailto to botanical.dubai@gmail.com and closes the popup', async ({ page }) => {
  await openPopupViaSlider(page);

  await page.locator('#proposal').fill('A courtyard entrance with layered greenery.');
  await page.locator('#popup-next').click();

  await page.locator('#budget').fill('AED 20,000');
  await page.locator('#popup-send').click();

  await expect(page.locator('#popup')).toBeHidden();

  const href = await page.locator('#mailto-link').getAttribute('href');
  const mail = decodeMailto(href);

  expect(mail.to).toBe('botanical.dubai@gmail.com');
  expect(mail.subject).toContain('Proposal Request');
  expect(mail.body).toContain('A courtyard entrance with layered greenery.');
  expect(mail.body).toContain('AED 20,000');
});

test('close button dismisses the popup without sending anything', async ({ page }) => {
  await openPopupViaSlider(page);

  await page.locator('#popup-close').click();

  await expect(page.locator('#popup')).toBeHidden();
  expect(await page.locator('#mailto-link').getAttribute('href')).toBe('#');
});

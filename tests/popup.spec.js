const { test, expect } = require('@playwright/test');

async function openPopup(page) {
  await page.clock.install();
  await page.goto('/');
  await page.clock.fastForward(10000);
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

test('popup is hidden on load and stays hidden before the 10s delay', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('#popup')).toBeHidden();

  await page.clock.fastForward(9000);
  await expect(page.locator('#popup')).toBeHidden();
});

test('popup appears automatically after 10 seconds, starting on the proposal step', async ({ page }) => {
  await openPopup(page);
  await expect(page.locator('#popup-step-1')).toBeVisible();
  await expect(page.locator('#popup-step-2')).toBeHidden();
});

test('the "Start a Proposal" button in Contact opens the popup immediately', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#popup')).toBeHidden();

  await page.locator('#contact-start-proposal').click();

  await expect(page.locator('#popup')).toBeVisible();
  await expect(page.locator('#popup-step-1')).toBeVisible();
});

test('submitting an empty proposal alerts and keeps step 1 open', async ({ page }) => {
  await openPopup(page);

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
  await openPopup(page);

  await page.locator('#proposal').fill('A courtyard entrance with layered greenery.');
  await page.locator('#popup-next').click();

  await expect(page.locator('#popup-step-1')).toBeHidden();
  await expect(page.locator('#popup-step-2')).toBeVisible();

  await page.locator('#popup-back').click();

  await expect(page.locator('#popup-step-1')).toBeVisible();
  await expect(page.locator('#popup-step-2')).toBeHidden();
});

test('submitting an empty budget alerts and keeps step 2 open', async ({ page }) => {
  await openPopup(page);

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
  await openPopup(page);

  await page.locator('#proposal').fill('A courtyard entrance with layered greenery.');
  await page.locator('#popup-next').click();

  await page.locator('.budget-chip', { hasText: 'AED 20,000' }).click();

  await expect(page.locator('#budget')).toHaveValue('AED 20,000');
});

test('sending a complete proposal builds a mailto to botanical.dubai@gmail.com and closes the popup', async ({ page }) => {
  await openPopup(page);

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
  await openPopup(page);

  await page.locator('#popup-close').click();

  await expect(page.locator('#popup')).toBeHidden();
  expect(await page.locator('#mailto-link').getAttribute('href')).toBe('#');
});

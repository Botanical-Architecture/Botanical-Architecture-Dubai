const { test, expect } = require('@playwright/test');

async function openPopup(page) {
  await page.clock.install();
  await page.goto('/');
  await page.clock.fastForward(10000);
  await expect(page.locator('#popup')).toBeVisible();
}

test('popup is hidden on load and stays hidden before the 10s delay', async ({ page }) => {
  await page.clock.install();
  await page.goto('/');
  await expect(page.locator('#popup')).toBeHidden();

  await page.clock.fastForward(9000);
  await expect(page.locator('#popup')).toBeHidden();
});

test('popup appears automatically after 10 seconds', async ({ page }) => {
  await openPopup(page);
});

test('submitting an empty email alerts and keeps the popup open without saving', async ({ page }) => {
  await openPopup(page);

  let alertMessage = null;
  page.once('dialog', async (dialog) => {
    alertMessage = dialog.message();
    await dialog.accept();
  });

  await page.locator('#popup-continue').click();

  expect(alertMessage).toBe('Enter email');
  await expect(page.locator('#popup')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem('email'))).toBeNull();
});

test('submitting a valid email saves it and hides the popup', async ({ page }) => {
  await openPopup(page);

  await page.locator('#email').fill('client@example.com');
  await page.locator('#popup-continue').click();

  await expect(page.locator('#popup')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('email'))).toBe('client@example.com');
});

test('close button dismisses the popup without saving an email', async ({ page }) => {
  await openPopup(page);

  await page.locator('#popup-close').click();

  await expect(page.locator('#popup')).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem('email'))).toBeNull();
});

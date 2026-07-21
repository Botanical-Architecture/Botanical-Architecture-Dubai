const { test, expect } = require('@playwright/test');

test('nav wordmark and links point at in-page anchors, not separate pages', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('nav .wordmark')).toHaveAttribute('href', '#top');
  await expect(page.locator('nav .links a', { hasText: 'Work' })).toHaveAttribute('href', '#work');
  await expect(page.locator('nav .links a', { hasText: 'About' })).toHaveAttribute('href', '#about');
  await expect(page.locator('nav .links a', { hasText: 'Contact' })).toHaveAttribute('href', '#contact');
});

test('every nav anchor target exists exactly once on the page', async ({ page }) => {
  await page.goto('/');

  for (const id of ['top', 'work', 'about', 'contact']) {
    await expect(page.locator(`#${id}`)).toHaveCount(1);
  }
});

test('clicking a nav link scrolls the matching section into view', async ({ page }) => {
  await page.goto('/');

  await page.locator('nav .links a', { hasText: 'Contact' }).click();
  await expect(page).toHaveURL(/#contact$/);

  // `scroll-behavior: smooth` animates the scroll, so poll until it settles
  // instead of checking the position immediately after the click.
  await page.waitForFunction(() => {
    const rect = document.getElementById('contact').getBoundingClientRect();
    return rect.top < window.innerHeight && rect.bottom > 0;
  });
});

test('contact section links to the real inbox and Instagram handle', async ({ page }) => {
  await page.goto('/');

  await expect(page.locator('.contact-card a.direct', { hasText: 'botanical.dubai@gmail.com' }))
    .toHaveAttribute('href', 'mailto:botanical.dubai@gmail.com');

  await expect(page.locator('.contact-card a.direct', { hasText: '@botanical.dubai' }))
    .toHaveAttribute('href', 'https://www.instagram.com/botanical.dubai');
});

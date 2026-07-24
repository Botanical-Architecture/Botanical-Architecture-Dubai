const { test, expect } = require('@playwright/test');

// The old budget/proposal enquiry popup has been removed in favour of
// no-friction WhatsApp links. These tests assert the new behaviour: the popup
// DOM is gone, and every former trigger is now an <a> pointing at wa.me with
// the correct per-project/per-service prefilled (URL-encoded) message.

const WA_NUMBER = '971523145576';

test('the old enquiry popup no longer exists in the DOM', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#popup')).toHaveCount(0);
  await expect(page.locator('#popup-step-1')).toHaveCount(0);
  await expect(page.locator('#budget-chips')).toHaveCount(0);
  await expect(page.locator('#proposal')).toHaveCount(0);
  await expect(page.locator('#mailto-link')).toHaveCount(0);
  await expect(page.locator('#contact-start-proposal')).toHaveCount(0);
});

test('interacting with the slider no longer opens any popup', async ({ page }) => {
  await page.goto('/');
  await page.locator('#slider').evaluate((el) => {
    el.value = 3;
    el.dispatchEvent(new Event('input'));
  });
  await page.waitForTimeout(300);
  await expect(page.locator('#popup')).toHaveCount(0);
});

// Each former trigger, keyed by the link's visible text, with the exact
// decoded message its WhatsApp href must carry.
const links = [
  // Work projects
  { text: 'Enquire about the Terrarium Study →', message: "Hi! I'm interested in the Terrarium Study project." },
  { text: 'Enquire about RAIR Essential Oils →', message: "Hi! I'm interested in the RAIR Essential Oils project." },
  { text: 'Enquire about the Botanical Bar →', message: "Hi! I'm interested in the Botanical Bar project." },
  { text: 'Enquire about Tablescape Design →', message: "Hi! I'm interested in the Tablescape Design project." },
  { text: 'Enquire about Private Commissions →', message: "Hi! I'm interested in the Private Commissions project." },
  // Services
  { text: 'Start with Living Installations →', message: "Hi! I'd like to start with Living Installations." },
  { text: 'Plan an Event Activation →', message: "Hi! I'd like to start with Event Activations." },
  { text: 'Book a Workshop →', message: "Hi! I'd like to start with Workshops." },
  { text: 'Design a Table-scape →', message: "Hi! I'd like to start with Table-scapes." },
  { text: 'Ask about Gifting →', message: "Hi! I'd like to start with Gifting." },
  // Contact generic CTA
  { text: 'Start a Proposal', message: "Hi! I'd like to know more about your installations." },
];

for (const { text, message } of links) {
  test(`"${text}" is a WhatsApp link with the correct prefilled message`, async ({ page }) => {
    await page.goto('/');
    const link = page.getByRole('link', { name: text, exact: true });
    await expect(link).toHaveCount(1);

    const href = await link.getAttribute('href');
    const url = new URL(href);

    expect(url.host).toBe('wa.me');
    expect(url.pathname).toBe('/' + WA_NUMBER);
    // URLSearchParams decodes %20/%21/%27 back to the human-readable message.
    expect(new URLSearchParams(url.search).get('text')).toBe(message);

    // Opens WhatsApp safely in a new tab.
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });
}

test('every enquire link opens in a new tab with a wa.me href', async ({ page }) => {
  await page.goto('/');
  const enquireLinks = page.locator('a.enquire-btn');
  const count = await enquireLinks.count();
  expect(count).toBe(10); // 5 Work + 5 Services
  for (let i = 0; i < count; i++) {
    const href = await enquireLinks.nth(i).getAttribute('href');
    expect(href).toContain(`wa.me/${WA_NUMBER}?text=`);
  }
});

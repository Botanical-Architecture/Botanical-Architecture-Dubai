const { test, expect } = require('@playwright/test');

const LEVELS = {
  1: ['AED 2,000', 'Single structural lines forming spatial gesture.'],
  2: ['AED 5,000', 'Lines begin to connect and define structure.'],
  3: ['AED 10,000', 'Early spatial network emerges.'],
  4: ['AED 15,000', 'Structure stabilises into composed system.'],
  5: ['AED 20,000', 'Layering increases spatial density.'],
  6: ['AED 25,000', 'Complex interconnected network forms.'],
  7: ['AED 35,000', 'Dense immersive spatial structure.'],
  8: ['AED 50,000+', 'Full architectural system of interconnected space.'],
};

test.beforeEach(async ({ page }) => {
  // Count CanvasRenderingContext2D.stroke() calls so we can verify draw()
  // renders the expected number of line segments per slider level.
  await page.addInitScript(() => {
    window.__strokeCount = 0;
    const original = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      window.__strokeCount += 1;
      return original.apply(this, args);
    };
  });
  await page.goto('/');
});

test('slider attributes constrain input to the 8 defined levels', async ({ page }) => {
  const slider = page.locator('#slider');
  await expect(slider).toHaveAttribute('min', '1');
  await expect(slider).toHaveAttribute('max', '8');
  await expect(slider).toHaveAttribute('value', '1');
});

test('initial render shows level 1 without any interaction', async ({ page }) => {
  await expect(page.locator('#title')).toHaveText(LEVELS[1][0]);
  await expect(page.locator('#desc')).toHaveText(LEVELS[1][1]);
  expect(await page.evaluate(() => window.__strokeCount)).toBe(10);
});

for (const [level, [price, description]] of Object.entries(LEVELS)) {
  test(`slider level ${level} shows "${price}" and draws ${level * 10} line segments`, async ({ page }) => {
    await page.evaluate((v) => {
      window.__strokeCount = 0;
      const slider = document.getElementById('slider');
      slider.value = v;
      slider.dispatchEvent(new Event('input'));
    }, level);

    await expect(page.locator('#title')).toHaveText(price);
    await expect(page.locator('#desc')).toHaveText(description);
    expect(await page.evaluate(() => window.__strokeCount)).toBe(Number(level) * 10);
  });
}

test('moving the slider clears the previous drawing before redrawing', async ({ page }) => {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.__clearSpy = 0;
    const ctx = canvas.getContext('2d');
    const original = ctx.clearRect.bind(ctx);
    ctx.clearRect = (...args) => {
      canvas.__clearSpy += 1;
      return original(...args);
    };
  });

  await page.evaluate(() => {
    const slider = document.getElementById('slider');
    slider.value = 5;
    slider.dispatchEvent(new Event('input'));
  });

  expect(await page.evaluate(() => document.getElementById('canvas').__clearSpy)).toBe(1);
});

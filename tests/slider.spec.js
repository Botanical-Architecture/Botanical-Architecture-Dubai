const { test, expect } = require('@playwright/test');

const LEVELS = {
  1: ['AED 2,000', 'One leaf, precisely placed.'],
  2: ['AED 5,000', 'A second leaf joins it.'],
  3: ['AED 10,000', 'A small plant takes shape.'],
  4: ['AED 15,000', 'A pair of plants begin a dialogue.'],
  5: ['AED 20,000', 'A grouping of plants, with first blooms.'],
  6: ['AED 25,000', 'A fuller, richer grouping in bloom.'],
  7: ['AED 35,000', 'One grand statement plant, in full colour.'],
  8: ['AED 50,000+', 'Two grand statement plants, a complete installation.'],
};

// Mirrors the `plantConfig` table in index.html: how many potted plants are
// drawn, how many leaves and blooms each plant gets, at every slider level.
const PLANT_CONFIG = {
  1: { plants: 1, leaves: 1, blooms: 0 },
  2: { plants: 1, leaves: 2, blooms: 0 },
  3: { plants: 1, leaves: 3, blooms: 1 },
  4: { plants: 2, leaves: 3, blooms: 1 },
  5: { plants: 3, leaves: 4, blooms: 2 },
  6: { plants: 3, leaves: 5, blooms: 2 },
  7: { plants: 1, leaves: 8, blooms: 3 },
  8: { plants: 2, leaves: 8, blooms: 3 },
};

// Each plant draws: 1 pot fill + 1 stem stroke, plus per leaf (1 fill + 1
// vein stroke) and per bloom (2 fills: outer + center).
function expectedFills(level) {
  const c = PLANT_CONFIG[level];
  return c.plants * (1 + c.leaves + c.blooms * 2);
}
function expectedStrokes(level) {
  const c = PLANT_CONFIG[level];
  return c.plants * (1 + c.leaves);
}

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.__strokeCount = 0;
    window.__fillCount = 0;
    const originalStroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      window.__strokeCount += 1;
      return originalStroke.apply(this, args);
    };
    const originalFill = CanvasRenderingContext2D.prototype.fill;
    CanvasRenderingContext2D.prototype.fill = function (...args) {
      window.__fillCount += 1;
      return originalFill.apply(this, args);
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

test('initial render shows level 1 as a single leaf, one plant, no blooms', async ({ page }) => {
  await expect(page.locator('#title')).toHaveText(LEVELS[1][0]);
  await expect(page.locator('#desc')).toHaveText(LEVELS[1][1]);
  expect(await page.evaluate(() => window.__strokeCount)).toBe(expectedStrokes(1));
  expect(await page.evaluate(() => window.__fillCount)).toBe(expectedFills(1));
});

for (const [level, [price, description]] of Object.entries(LEVELS)) {
  const n = Number(level);
  const c = PLANT_CONFIG[n];
  test(`slider level ${level} shows "${price}" with ${c.plants} plant(s) of ${c.leaves} leaves and ${c.blooms} bloom(s) each`, async ({ page }) => {
    await page.evaluate((v) => {
      window.__strokeCount = 0;
      window.__fillCount = 0;
      const slider = document.getElementById('slider');
      slider.value = v;
      slider.dispatchEvent(new Event('input'));
    }, level);

    await expect(page.locator('#title')).toHaveText(price);
    await expect(page.locator('#desc')).toHaveText(description);
    expect(await page.evaluate(() => window.__strokeCount)).toBe(expectedStrokes(n));
    expect(await page.evaluate(() => window.__fillCount)).toBe(expectedFills(n));
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

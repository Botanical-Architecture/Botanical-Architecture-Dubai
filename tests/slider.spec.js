const { test, expect } = require('@playwright/test');

const LEVELS = {
  1: ['AED 2,000', 'One statement plant, precisely placed.'],
  2: ['AED 5,000', 'A pair of plants begin a quiet dialogue.'],
  3: ['AED 10,000', 'The grouping grows, and first blooms appear.'],
  4: ['AED 15,000', 'A fuller planting with layered colour.'],
  5: ['AED 20,000', 'Dense planting as blooms multiply.'],
  6: ['AED 25,000', 'A rich, layered botanical scene.'],
  7: ['AED 35,000', 'Immersive planting in full colour.'],
  8: ['AED 50,000+', 'A complete living installation, in full bloom.'],
};

// draw(level) renders: 1 pot fill + `level` leaf stems (stroke) + `level`
// leaf blobs (fill) + max(0, level - 2) coloured blooms (fill) layered on
// the last leaves — i.e. planting density and colour both grow with level.
function expectedStrokes(level) {
  return level;
}
function expectedFills(level) {
  return 1 + level + Math.max(0, level - 2);
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

test('initial render shows level 1 with a single leaf and no blooms', async ({ page }) => {
  await expect(page.locator('#title')).toHaveText(LEVELS[1][0]);
  await expect(page.locator('#desc')).toHaveText(LEVELS[1][1]);
  expect(await page.evaluate(() => window.__strokeCount)).toBe(expectedStrokes(1));
  expect(await page.evaluate(() => window.__fillCount)).toBe(expectedFills(1));
});

for (const [level, [price, description]] of Object.entries(LEVELS)) {
  const n = Number(level);
  test(`slider level ${level} shows "${price}" with ${n} plant(s) and ${Math.max(0, n - 2)} bloom(s)`, async ({ page }) => {
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

test('higher budgets draw strictly more plants and blooms than lower ones', async ({ page }) => {
  const counts = [];
  for (const level of [1, 4, 8]) {
    const result = await page.evaluate((v) => {
      window.__strokeCount = 0;
      window.__fillCount = 0;
      const slider = document.getElementById('slider');
      slider.value = v;
      slider.dispatchEvent(new Event('input'));
      return { strokes: window.__strokeCount, fills: window.__fillCount };
    }, level);
    counts.push(result);
  }

  expect(counts[0].strokes).toBeLessThan(counts[1].strokes);
  expect(counts[1].strokes).toBeLessThan(counts[2].strokes);
  expect(counts[0].fills).toBeLessThan(counts[1].fills);
  expect(counts[1].fills).toBeLessThan(counts[2].fills);
});

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

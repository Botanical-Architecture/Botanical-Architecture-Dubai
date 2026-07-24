const { test, expect } = require('@playwright/test');

// Price + description for each of the 8 Design Scope tiers, verbatim from the
// `data` object in script.js.
const LEVELS = {
  1: ['AED 2,000', 'A hands-on botanical workshop, tailored to your group.'],
  2: ['AED 5,000', 'A styled botanical activation for your event or brand moment.'],
  3: ['AED 10,000', 'Your first living installation, designed for your space.'],
  4: ['AED 15,000', 'A living scheme designed for your shop.'],
  5: ['AED 20,000', 'A fuller shop scheme, in first bloom.'],
  6: ['AED 25,000', 'Semi-permanent architectural planting, scoped per brief.'],
  7: ['AED 35,000', 'One statement installation, with a maintenance retainer.'],
  8: ['AED 50,000+', 'A complete installation for retail, F&B or hospitality.'],
};

// Exact canvas draw-call counts per tier for the current "abstract faceted
// bloom" composition in script.js (facetConfig + drawFacetComposition). This
// is a deterministic regression-lock: the composition uses a seeded PRNG and a
// static per-tier facetConfig, so counts are fixed frame-to-frame. The model
// is fills = 1 (faceted base) + facets*2 (two triangles per leaf facet) +
// blooms*3 (three polygon rings per bloom); strokes = facets (one crease line
// per facet) + blooms (one outline per bloom). Values below were measured by
// wrapping CanvasRenderingContext2D.prototype.fill/stroke in a real browser.
const DRAW_COUNTS = {
  1: { fills: 7, strokes: 3 },
  2: { fills: 14, strokes: 6 },
  3: { fills: 18, strokes: 8 },
  4: { fills: 25, strokes: 11 },
  5: { fills: 31, strokes: 14 },
  6: { fills: 40, strokes: 18 },
  7: { fills: 49, strokes: 22 },
  8: { fills: 60, strokes: 27 },
};

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

test('initial render draws the level 1 faceted composition', async ({ page }) => {
  await expect(page.locator('#title')).toHaveText(LEVELS[1][0]);
  await expect(page.locator('#desc')).toHaveText(LEVELS[1][1]);
  expect(await page.evaluate(() => window.__strokeCount)).toBe(DRAW_COUNTS[1].strokes);
  expect(await page.evaluate(() => window.__fillCount)).toBe(DRAW_COUNTS[1].fills);
});

for (const [level, [price, description]] of Object.entries(LEVELS)) {
  const n = Number(level);
  const counts = DRAW_COUNTS[n];
  test(`slider level ${level} shows "${price}" and draws ${counts.fills} fills / ${counts.strokes} strokes`, async ({ page }) => {
    await page.evaluate((v) => {
      window.__strokeCount = 0;
      window.__fillCount = 0;
      const slider = document.getElementById('slider');
      slider.value = v;
      slider.dispatchEvent(new Event('input'));
    }, level);

    await expect(page.locator('#title')).toHaveText(price);
    await expect(page.locator('#desc')).toHaveText(description);
    expect(await page.evaluate(() => window.__strokeCount)).toBe(counts.strokes);
    expect(await page.evaluate(() => window.__fillCount)).toBe(counts.fills);
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

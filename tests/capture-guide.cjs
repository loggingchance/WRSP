const { chromium } = require('playwright');
const path = require('node:path');

// Refresh guide illustrations from the real application, using demonstration data.
(async () => {
  const browser = await chromium.launch({ channel: process.env.WRSP_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 1800 }, deviceScaleFactor: 2, serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(process.env.WRSP_URL || 'http://127.0.0.1:4184');
    await page.waitForFunction(() => document.querySelector('#planId').value);
    await page.addStyleTag({ content: 'html { scroll-behavior: auto !important; } .app-header, .bottom-nav, .toast, .sticky-actions { visibility: hidden !important; }' });
    await page.evaluate(async () => {
      const plan = samplePlan();
      planToForm(plan);
      routeTo('create');
      await savePlan();
      centerSiteMap(44.0338, -72.3186, 15);
    });
    await page.locator('#siteMap').scrollIntoViewIfNeeded();
    await page.waitForFunction(() => {
      const tiles = [...document.querySelectorAll('#mapTiles img')];
      return tiles.length && tiles.every(img => img.complete && img.naturalWidth > 0);
    }, null, { timeout: 45000 });
    const map = page.locator('#planForm .map-picker').first();
    const mapPath = path.join(__dirname, '../assets/help-site-pin.png');
    const mapBounds = await map.boundingBox();
    await map.screenshot({ path: mapPath, animations: 'disabled' });
    await page.evaluate(async () => { await openPlan(currentPlanId); await openShareChoice(); });
    await page.waitForFunction(() => preparedShare?.email);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
    const share = page.locator('.share-choice-card');
    await share.screenshot({ path: path.join(__dirname, '../assets/help-sharing.png'), animations: 'disabled' });
    console.log(JSON.stringify({ map: mapBounds, share: await share.boundingBox() }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

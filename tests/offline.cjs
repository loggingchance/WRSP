const { chromium } = require('playwright');
const assert = require('node:assert/strict');

(async () => {
  const browser = await chromium.launch({ channel: process.env.WRSP_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    const url = process.env.WRSP_URL || 'http://127.0.0.1:4173';
    await page.goto(url);
    await page.waitForFunction(() => navigator.serviceWorker.controller);
    await page.waitForFunction(() => document.querySelector('#planId').value);
    const cached = await page.evaluate(async () => {
      const cache = await caches.open('wrsp-v37');
      return Promise.all(['app.js?v=0.8.0', 'field-plan.js?v=0.8.0', 'styles.css?v=0.8.0'].map(async name => Boolean(await cache.match(new URL(name, location.href)))));
    });
    assert.ok(cached.every(Boolean), 'All matching versioned assets cached');
    const id = await page.evaluate(async () => {
      const plan = samplePlan();
      planToForm(plan);
      await savePlan();
      return plan.id;
    });
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#planId').value);
    const result = await page.evaluate(async id => {
      const plan = await storeGet(PLAN_STORE, id);
      planToForm(plan);
      document.querySelector('#equipmentOther').value = 'Spare radio battery';
      await savePlan();
      const saved = await storeGet(PLAN_STORE, id);
      const pdf = await planPdfBlob(saved);
      await openShareChoice(id);
      return { other: saved.equipment.other, size: pdf.size, pages: planPdfPages(saved).length, ready: Boolean(preparedShare), hazards: selectedFields('hazardChecks') };
    }, id);
    assert.equal(result.other, 'Spare radio battery');
    assert.ok(result.size > 1000);
    assert.equal(result.pages, 1);
    assert.equal(result.ready, true);
    assert.ok(result.hazards.includes('Active tree felling'));
    console.log('Offline reload, edit/save, checkbox retention, one-page PDF and email preparation passed.');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

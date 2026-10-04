const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const output = process.env.WRSP_TEST_OUTPUT || path.join(os.tmpdir(), 'wrsp-guide');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.WRSP_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.WRSP_URL || 'http://127.0.0.1:4184');
    await page.waitForFunction(() => navigator.serviceWorker.controller && document.querySelector('#planId').value);
    await page.locator('.bottom-nav [data-route=more]').click();
    const moreHelp = page.locator('#moreView [data-route=help]');
    await moreHelp.click();
    assert.equal(await page.locator('#helpTitle').evaluate(el => el === document.activeElement), true);
    assert.equal(await page.locator('#helpView details').count(), 8);
    assert.equal(await page.locator('#helpView details[open]').count(), 1);
    assert.equal(await page.locator('#helpView input, #helpView textarea').count(), 0);
    assert.equal(await page.locator('.bottom-nav [data-route=more]').getAttribute('class'), 'active');
    const summary = page.locator('#guideSharing summary');
    await summary.focus();
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#guideSharing').evaluate(el => el.open), true);
    await page.keyboard.press('Space');
    assert.equal(await page.locator('#guideSharing').evaluate(el => el.open), false);
    await page.locator('#closeQuickGuide').click();
    assert.equal(await moreHelp.evaluate(el => el === document.activeElement), true);
    await page.locator('.bottom-nav [data-route=create]').click();
    await page.locator('#title').fill('Unfinished guide test plan');
    await page.locator('#phoneDirections').fill('Keep these directions while reading help.');
    const id = await page.inputValue('#planId');
    await page.locator('#createView [data-route=help]').click();
    await page.locator('#closeQuickGuide').click();
    assert.equal(await page.inputValue('#planId'), id);
    assert.equal(await page.inputValue('#title'), 'Unfinished guide test plan');
    assert.equal(await page.inputValue('#phoneDirections'), 'Keep these directions while reading help.');
    await page.locator('#createView [data-route=help]').click();
    for (const [label, view] of [
      ['Open Plan Editor', 'create'], ['Open Saved Plans', 'saved'],
      ['Home Screen Instructions', 'install'], ['Check Offline Readiness', 'pwa'], ['Send Feedback', 'feedback'],
    ]) {
      await page.locator('#helpView details').evaluateAll(elements => elements.forEach(el => { el.open = true; }));
      await page.locator('#helpView').getByRole('button', { name: label, exact: true }).click();
      assert.equal(await page.locator(`#${view}View`).isVisible(), true);
      await page.locator('.bottom-nav [data-route=more]').click();
      await moreHelp.click();
    }
    for (const width of [320, 390, 1365]) {
      await page.setViewportSize({ width, height: 900 });
      await page.locator('#helpView details').evaluateAll(elements => elements.forEach((el, index) => { el.open = index === 0; }));
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
      await page.screenshot({ path: path.join(output, `guide-${width}.png`), fullPage: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.locator('#helpView details').evaluateAll(elements => elements.forEach(el => { el.open = true; }));
      for (const img of await page.locator('#helpView img').all()) {
        await img.scrollIntoViewIfNeeded();
        await img.evaluate(img => img.decode());
        assert.ok(await img.evaluate(img => img.naturalWidth > 0 && img.getBoundingClientRect().right <= innerWidth));
      }
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    const externalLinks = await page.locator('#helpView a[href^="https:"]').evaluateAll(links => links.every(link => link.target === '_blank' && link.rel.includes('noopener')));
    assert.equal(externalLinks, true);
    await context.setOffline(true);
    await page.reload();
    await page.waitForFunction(() => document.querySelector('#planId').value);
    await page.locator('.bottom-nav [data-route=more]').click();
    await moreHelp.click();
    await page.locator('#helpView details').evaluateAll(elements => elements.forEach(el => { el.open = true; }));
    for (const img of await page.locator('#helpView img').all()) {
      await img.scrollIntoViewIfNeeded();
      await img.evaluate(img => img.decode());
    }
    assert.match(await page.locator('#helpView').innerText(), /Good things are never really finished/);
    assert.deepEqual(errors, []);
    console.log('Quick Guide passed: entry points, keyboard accordions, focus return, editor preservation, all internal destinations, 320/390/1365px layout, and cached screenshots/text after offline reload.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

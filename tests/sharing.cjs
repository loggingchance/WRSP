const { chromium, webkit } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const output = process.env.WRSP_TEST_OUTPUT || path.join(os.tmpdir(), 'wrsp-sharing');
  await fs.mkdir(output, { recursive: true });
  const browser = process.env.WRSP_ENGINE === 'webkit'
    ? await webkit.launch({ headless: true })
    : await chromium.launch({ channel: process.env.WRSP_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.WRSP_URL || 'http://127.0.0.1:4183');
    await page.waitForFunction(() => document.querySelector('#planId').value);
    await page.evaluate(async () => {
      const plan = samplePlan();
      plan.title = 'September phone regression';
      plan.location.lat = '';
      plan.location.lng = '';
      plan.access.phoneDirections = '';
      plan.medical.hospitalVerified = false;
      plan.contacts.people = [{ name: 'Off-site Forester', role: 'Forester', phone: '802-555-0102' }];
      planToForm(plan);
      await savePlan();
      await openPlan(currentPlanId);
      window.openedLinks = [];
      window.open = (...args) => window.openedLinks.push(args);
      window.shareCalls = [];
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => {
        window.shareCalls.push({ ...data, activated: navigator.userActivation.isActive });
        if (window.shareMode === 'cancel') throw new DOMException('User canceled', 'AbortError');
        if (window.shareMode === 'reject') throw new DOMException('Share blocked', 'NotAllowedError');
        if (window.shareMode === 'pending') await new Promise(resolve => { window.finishShare = resolve; });
      } });
    });
    await page.locator('#shareCurrentPlan').click();
    await page.waitForFunction(() => preparedShare?.email && !shareInProgress);
    assert.equal(await page.locator('#shareReview, #shareChoicePanel input[type=checkbox]').count(), 0);
    assert.match(await page.locator('#shareChoiceWarnings').innerText(), /Written responder directions are missing/);
    for (const id of ['shareChoicePng', 'shareChoicePdf', 'shareChoiceEmailDraft']) assert.equal(await page.locator(`#${id}`).isEnabled(), true);
    await page.locator('#shareChoicePdf').click();
    await page.waitForFunction(() => !shareInProgress);
    await page.locator('#shareChoicePng').click();
    await page.waitForFunction(() => !shareInProgress);
    const shares = await page.evaluate(() => shareCalls.map(data => ({ activated: data.activated, type: data.files[0].type, size: data.files[0].size, text: data.text })));
    assert.deepEqual(shares.map(data => data.type), ['application/pdf', 'image/jpeg']);
    assert.ok(shares.every(data => data.activated && data.size > 1000), 'Actual button taps retain native-share user activation');
    assert.equal(shares[0].text, shares[1].text);
    assert.match(shares[0].text, /Off-site Forester/);
    assert.match(shares[0].text, /Directions from known intersection: Not entered/);
    assert.equal(await page.evaluate(() => planPdfPages(preparedShare.plan).length), 1);
    const draftDownload = page.waitForEvent('download');
    await page.locator('#shareChoiceEmailDraft').click();
    const draft = await draftDownload;
    assert.ok(draft.suggestedFilename().endsWith('.eml'));
    await draft.saveAs(path.join(output, 'partial-plan.eml'));
    const completeText = await page.evaluate(() => planShareText(preparedShare.plan));
    const mailBody = new URL(await page.locator('#shareEmailTextOnly').getAttribute('href')).searchParams.get('body');
    assert.equal(mailBody, completeText, 'Fallback email includes the entire plan without truncation');
    assert.equal(new URL(await page.locator('#shareMessageTextOnly').getAttribute('href')).searchParams.get('body'), completeText);
    for (const width of [320, 390, 1365]) {
      await page.setViewportSize({ width, height: 844 });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: path.join(output, `sharing-${width}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });
    let downloads = 0;
    const trackDownload = () => downloads++;
    page.on('download', trackDownload);
    await page.evaluate(() => { window.shareMode = 'cancel'; });
    await page.locator('#shareChoicePdf').click();
    await page.waitForFunction(() => !shareInProgress);
    assert.equal(await page.locator('#shareChoiceStatus').innerText(), 'Sharing canceled.');
    assert.equal(await page.locator('#shareFallback').isVisible(), false);
    assert.equal(downloads, 0, 'Cancel must not force a download');
    await page.evaluate(() => { window.shareMode = 'pending'; });
    await page.locator('#shareChoicePdf').click();
    await page.waitForFunction(() => typeof window.finishShare === 'function');
    assert.equal(await page.locator('#shareChoicePng').isDisabled(), true);
    assert.equal(await page.locator('#shareChoicePdf').isDisabled(), true);
    await page.evaluate(() => { window.finishShare(); window.shareMode = 'reject'; });
    await page.waitForFunction(() => !shareInProgress);
    const fallbackDownload = page.waitForEvent('download');
    await page.locator('#shareChoicePdf').click();
    assert.ok((await fallbackDownload).suggestedFilename().endsWith('.eml'));
    await page.waitForFunction(() => !shareInProgress);
    assert.equal(await page.locator('#shareEmailTextOnly').isVisible(), true);
    assert.equal(await page.locator('#shareMessageTextOnly').isVisible(), false);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => { throw new Error('Sharing disabled'); } });
    });
    const imageDownload = page.waitForEvent('download');
    await page.locator('#shareChoicePng').click();
    assert.ok((await imageDownload).suggestedFilename().endsWith('.jpg'));
    await page.waitForFunction(() => !shareInProgress);
    assert.equal(await page.locator('#shareMessageTextOnly').isVisible(), true);
    page.off('download', trackDownload);

    // A failed optional email-draft encoder must not block native PDF/image sharing.
    await page.evaluate(async () => {
      window.originalEmailFile = planEmailFile;
      planEmailFile = async () => { throw new Error('Draft encoding failed'); };
      await openShareChoice();
    });
    assert.equal(await page.locator('#shareChoicePdf').isEnabled(), true);
    assert.equal(await page.locator('#shareChoicePng').isEnabled(), true);
    assert.equal(await page.locator('#shareChoiceEmailDraft').isEnabled(), false);
    assert.equal(await page.locator('#retrySharePreparation').isVisible(), true);
    await page.evaluate(() => { planEmailFile = window.originalEmailFile; });
    await page.locator('#retrySharePreparation').click();
    await page.waitForFunction(() => preparedShare?.email);

    // Old landmark coordinates survive loading/saving; editing the name clears a stale pin.
    await page.locator('#editSharePlan').click();
    await page.locator('#knownLandmark').waitFor({ state: 'visible' });
    await page.evaluate(() => {
      document.querySelector('#knownLandmarkLat').value = '44.1';
      document.querySelector('#knownLandmarkLng').value = '-72.6';
      planToForm(formToPlan());
    });
    assert.equal(await page.inputValue('#knownLandmarkLat'), '44.1');
    assert.equal(await page.locator('#findStartingLandmark, #openDirectionsToSitePin, #landmarkMap').count(), 0);
    await page.locator('#knownLandmark').fill('Intersection of County Road and Route 12');
    await page.locator('#phoneDirections').fill('From the intersection, take County Road for one mile. Meet at the yellow gate.');
    assert.equal(await page.inputValue('#knownLandmarkLat'), '');
    assert.equal(await page.inputValue('#knownLandmarkLng'), '');
    assert.deepEqual(await page.evaluate(() => window.openedLinks), []);
    await page.locator('#planForm summary').filter({ hasText: 'People & Contact Information' }).click();
    assert.equal(await page.locator('#contactName1').inputValue(), 'Off-site Forester');
    await page.evaluate(async () => { await savePlan(); await openPlan(currentPlanId); });
    await page.locator('#shareCurrentPlan').click();
    await page.waitForFunction(() => preparedShare?.email);
    assert.match(await page.evaluate(() => planShareText(preparedShare.plan)), /take County Road for one mile/);
    assert.match(await page.evaluate(() => planEmailHtml(preparedShare.plan)), /Off-site Forester/);
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, engine: process.env.WRSP_ENGINE || 'chromium', checks: 'missing fields do not block; whole plan + real PDF/JPEG files; tap activation; draft download; cancel; concurrent tap guard; rejected/throwing native sharing; recovery; untruncated fallback text; manual directions; saved landmark preservation; off-site contacts; responsive screenshots', output }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

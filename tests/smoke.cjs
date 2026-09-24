const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const output = process.env.WRSP_TEST_OUTPUT || path.join(os.tmpdir(), 'wrsp-smoke');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.WRSP_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, geolocation: { latitude: 43.4, longitude: -74.2 }, permissions: ['geolocation'], serviceWorkers: 'block' });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(process.env.WRSP_URL || 'http://127.0.0.1:4173');
    await page.waitForFunction(() => document.querySelector('#planId').value);
    await page.evaluate(() => routeTo('create'));
    await page.waitForFunction(() => siteMapState.zoom === 17);
    assert.equal(await page.inputValue('#lat'), '', 'GPS centers map without claiming a confirmed pin');
    await page.locator('#siteMap').click({ position: { x: 140, y: 110 } });
    assert.ok(await page.inputValue('#lat'));
    assert.equal(await page.evaluate(() => landingZoneMapState.zoom), 17);
    assert.equal(await page.locator('#landmarkMap, #findStartingLandmark, #openDirectionsToSitePin').count(), 0);
    await page.locator('#knownLandmark').fill('Town hall');
    await page.locator('#phoneDirections').fill('From the town hall, take Test Road north.');
    let requests = 0;
    await page.route('https://photon.komoot.io/reverse?**', route => {
      requests++;
      return route.fulfill({ json: { features: [{ properties: { street: 'Test Road', city: 'Test Town', county: 'Test County', state: 'New York' } }] } });
    });
    await page.locator('#suggestAddressFromPin').click();
    await page.waitForFunction(() => pendingAddressSuggestion?.town === 'Test Town');
    await page.locator('#useSuggestedAddress').click();
    assert.equal(await page.inputValue('#roadAddress'), 'Test Road');
    assert.equal(await page.inputValue('#hospital'), '', 'Address changes must not fabricate a hospital');
    await page.locator('#suggestAddressFromPin').click();
    await page.waitForFunction(() => !addressLookupBusy);
    assert.equal(requests, 1, 'Repeated lookup uses cache');
    if (process.env.WRSP_LIVE_LOOKUP) {
      await page.unroute('https://photon.komoot.io/reverse?**');
      const live = await page.evaluate(async () => {
        addressLookupCache.clear();
        setSiteCoordinates(43.4, -74.2);
        await suggestAddressFromPin();
        return { suggestion: pendingAddressSuggestion, status: document.querySelector('#addressSuggestionStatus').textContent };
      });
      assert.ok(live.suggestion?.town, live.status);
      console.log('Live road lookup:', live.suggestion.display);
      await page.waitForFunction(() => Array.from(document.querySelectorAll('#mapTiles img')).some(image => image.naturalWidth > 0));
    }
    await page.evaluate(() => {
      const legacy = emptyPlan();
      legacy.contacts.primaryContact = 'Legacy person - 555-0100';
      legacy.sar.verifiedAgency = 'Campus security';
      legacy.sar.verifiedPhone = '555-0123';
      planToForm(legacy);
      const migrated = formToPlan();
      if (!migrated.contacts.people[0].name.includes('Legacy person') || !migrated.sar.contacts.includes('555-0123')) throw new Error('Legacy data lost');
      const plan = emptyPlan();
      plan.title = 'Timber Harvest Safety Plan';
      plan.location = { lat: '43.400000', lng: '-74.200000', roadAddress: 'Test Road', town: 'Test Town', state: 'NY' };
      plan.access.phoneDirections = 'From the town hall, take Test Road north. Turn at the marked gate.';
      plan.access.knownLandmark = 'Town hall';
      plan.access.knownLandmarkLat = '43.390000';
      plan.access.knownLandmarkLng = '-74.210000';
      plan.access.meetingPoint = 'Marked gate';
      plan.access.routeNotes = 'No heavy trucks across the bridge.';
      plan.access.landingZoneDescription = 'Open field east of the gate';
      plan.access.landingZoneLat = '43.401000';
      plan.access.landingZoneLng = '-74.200000';
      plan.contacts.people = [{ name: 'Test Person', role: 'Site lead', phone: '555-0100' }];
      planToForm(plan);
    });
    await page.getByText('People & Contact Information', { exact: true }).click();
    await page.locator('.people-grid').screenshot({ path: path.join(output, 'people-mobile.png') });
    await page.locator('#contactName2').fill('Second Person');
    await page.locator('#contactRole2').fill('Equipment operator');
    await page.locator('#contactPhone2').fill('555-0101');
    assert.equal(await page.evaluate(() => essentialStatus().total), 4);
    await page.evaluate(async () => { await savePlan(); await openPlan(currentPlanId); });
    assert.ok((await page.locator('#planOutput').innerText()).includes('Second Person'));
    await page.evaluate(async () => { planToForm(await activePlan()); routeTo('create'); });
    assert.equal(await page.inputValue('#contactPhone2'), '555-0101');
    await page.evaluate(() => document.querySelectorAll('#planForm details').forEach(el => { el.open = true; }));
    const geometry = await page.evaluate(() => {
      const below = (field, map) => document.querySelector(field).getBoundingClientRect().top > document.querySelector(map).getBoundingClientRect().bottom;
      return { site: below('#lat', '#siteMap'), lz: below('#landingZoneLat', '#landingZoneMap'), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.deepEqual(geometry, { site: true, lz: true, overflow: false });
    await page.screenshot({ path: path.join(output, 'form-mobile.png'), fullPage: true });
    await page.setViewportSize({ width: 320, height: 740 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.locator('#hazardChecks').screenshot({ path: path.join(output, 'hazards-small-phone.png') });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.locator('#responderVerificationScript, #responderLookupChecklist, #findEr, #findStateWoodsAgency').count(), 0);
    await page.evaluate(async () => { await openPlan(currentPlanId); await openShareChoice(); });
    await page.waitForFunction(() => preparedShare);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.lastShare = data; } });
    });
    assert.equal(await page.locator('#shareChoicePdf').isDisabled(), false);
    assert.equal(await page.locator('#shareReview').count(), 0);
    await page.locator('#shareChoicePdf').click();
    const shared = await page.evaluate(() => ({ text: window.lastShare.text, name: window.lastShare.files[0].name, type: window.lastShare.files[0].type }));
    assert.ok(shared.text.includes('Second Person'));
    assert.ok(shared.text.includes('No heavy trucks'));
    assert.equal(shared.type, 'application/pdf');
    await page.locator('#shareChoicePng').click();
    const imageShare = await page.evaluate(() => ({ text: window.lastShare.text, name: window.lastShare.files[0].name, type: window.lastShare.files[0].type, size: window.lastShare.files[0].size }));
    assert.equal(imageShare.text, shared.text, 'Texted image includes the same full plan body as email');
    assert.ok(imageShare.text.includes('https://www.google.com/maps?q=43.400000,-74.200000'));
    assert.ok(imageShare.text.includes('From the town hall, take Test Road north. Turn at the marked gate.'));
    assert.equal(imageShare.type, 'image/jpeg');
    assert.ok(imageShare.name.endsWith('.jpg') && imageShare.size > 1000);
    await page.evaluate(async () => sharePlanPng(preparedShare.plan));
    assert.equal(await page.evaluate(() => window.lastShare.text), shared.text, 'Alternate image-sharing path also includes full text');
    const artifacts = await page.evaluate(async () => ({
      email: await preparedShare.email.text(),
      pdf: Array.from(new Uint8Array(await preparedShare.pdf.arrayBuffer())),
      html: planEmailHtml(preparedShare.plan),
      pdfPages: planPdfPages(preparedShare.plan).length,
      escaped: planEmailHtml({ ...preparedShare.plan, title: '<script>alert(1)</script>' }).includes('&lt;script&gt;'),
      metrics: planPdfPages(preparedShare.plan)[0].fieldMetrics,
      longPlan: (() => { try { planPdfPages({ ...preparedShare.plan, hazards: 'Long hazard note. '.repeat(900) }); return ''; } catch (error) { return error.name; } })(),
    }));
    assert.equal(artifacts.pdfPages, 1);
    assert.equal(artifacts.longPlan, 'PlanFitError');
    assert.ok(artifacts.metrics.bodyFontPt >= 12 && artifacts.metrics.bodyFontPt <= 13);
    assert.ok(artifacts.metrics.bottom <= artifacts.metrics.limit);
    assert.ok(artifacts.html.includes('tel:5550100'));
    assert.ok(artifacts.html.includes('MEET RESPONDERS HERE'));
    assert.ok(artifacts.escaped);
    await fs.writeFile(path.join(output, 'plan.eml'), artifacts.email);
    await fs.writeFile(path.join(output, 'plan.pdf'), Buffer.from(artifacts.pdf));
    await fs.writeFile(path.join(output, 'email.html'), artifacts.html);
    await page.evaluate(() => { Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => false }); });
    const download = page.waitForEvent('download');
    await page.locator('#shareChoicePdf').click();
    assert.ok((await download).suggestedFilename().endsWith('.eml'));
    await page.evaluate(() => closeShareChoice());
    await page.setViewportSize({ width: 1365, height: 960 });
    await page.screenshot({ path: path.join(output, 'plan-desktop.png'), fullPage: true });
    await page.locator('#duplicateCurrentPlan').click();
    await page.locator('#copiedPlanNotice').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#copiedPlanNotice').isVisible(), true);
    assert.equal(await page.locator('#hospitalVerified').isChecked(), false);
    await page.evaluate(() => document.querySelectorAll('#planForm details').forEach(el => { el.open = true; }));
    await page.locator('#hazardChecks input').first().check();
    await page.locator('#accessChecks input').first().check();
    await page.locator('#equipmentChecks input').first().check();
    await page.locator('#equipmentLocation').fill("Supervisor's pickup");
    await page.locator('#landingZoneSize').fill('200 x 180 ft');
    await page.locator('#planCompany').fill('Test Logging');
    await page.locator('#hospital').fill('Example ER');
    await page.locator('#hospitalVerified').check();
    await page.locator('#hospitalTown').fill('Example town');
    assert.equal(await page.locator('#hospitalVerified').isChecked(), false);
    await page.locator('#hospitalDirectionsUrl').fill('https://www.google.com/maps/dir/?api=1&destination=Example+Hospital');
    await page.locator('#hospitalVerified').check();
    await page.evaluate(async () => { await savePlan(); planToForm(await activePlan()); });
    assert.equal(await page.locator('#hazardChecks input').first().isChecked(), true);
    assert.equal(await page.locator('#equipmentChecks input').first().isChecked(), true);
    assert.equal(await page.locator('#accessChecks input').first().isChecked(), true);
    assert.equal(await page.inputValue('#landingZoneSize'), '200 x 180 ft');
    await page.locator('#rememberPlanSetup').click();
    await page.waitForFunction(async () => (await storeGet(SETTINGS_STORE, RECURRING_PROFILE_KEY))?.value?.company === 'Test Logging');
    const reused = await page.evaluate(async () => newPlanWithDefaults());
    assert.equal(reused.company, 'Test Logging');
    assert.equal(reused.contacts.people.length, 2);
    assert.equal(reused.equipment.items[0], 'First aid kit');
    assert.equal(reused.location.lat, '');
    assert.equal(reused.access.phoneDirections, '');
    await page.evaluate(async () => { await openPlan(currentPlanId); await openShareChoice(); });
    await page.waitForFunction(() => preparedShare);
    assert.equal(await page.locator('#shareChoicePdf').isDisabled(), false, 'Ready without a checklist on every send');
    assert.equal(await page.evaluate(() => planPdfPages(preparedShare.plan)[0].links.some(link => link.url.includes('destination=Example+Hospital'))), true);
    assert.ok(await page.evaluate(() => planEmailHtml(preparedShare.plan).includes('Open hospital directions')));
    await page.evaluate(async () => {
      closeShareChoice();
      const plan = await activePlan();
      plan.hazards = 'Long hazard note. '.repeat(900);
      await storePut(PLAN_STORE, plan);
      await openShareChoice();
    });
    assert.equal(await page.locator('#shareChoicePdf').isDisabled(), true);
    assert.ok((await page.locator('#shareChoiceStatus').innerText()).includes('All text remains saved'));
    await page.locator('#editSharePlan').click();
    await page.waitForFunction(() => document.querySelector('#hazards').value.length > 1000);
    assert.equal((await page.inputValue('#hazards')).length, 'Long hazard note. '.repeat(900).length);
    const example = await page.evaluate(async () => {
      const plan = samplePlan();
      return { pdf: Array.from(new Uint8Array(await (await planPdfBlob(plan)).arrayBuffer())), html: planEmailHtml(plan), metrics: planPdfPages(plan)[0].fieldMetrics };
    });
    assert.ok(example.metrics.bottom <= example.metrics.limit);
    assert.ok(example.pdf.length > 1000);
    await fs.writeFile(path.join(output, 'example.pdf'), Buffer.from(example.pdf));
    await fs.writeFile(path.join(output, 'example-email.html'), example.html);
    const emailPage = await context.newPage();
    await emailPage.setViewportSize({ width: 390, height: 844 });
    await emailPage.setContent(example.html);
    assert.equal(await emailPage.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    assert.equal(await emailPage.locator('h1').count(), 1);
    assert.ok(await emailPage.locator('a[href^="tel:"]').count() >= 6);
    await emailPage.screenshot({ path: path.join(output, 'email-mobile.png'), fullPage: true });
    await emailPage.close();
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: 'site pins, manual directions, address/cache, contact migration/save/reuse, duplication, hospital confirmation, field checkboxes, responsive layout, single-page 12-13pt PDF/overflow, no send checklist, email body/PDF/fallback, image sharing with identical full plan text', output }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

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
    await page.locator('#landmarkMap').click({ position: { x: 120, y: 100 } });
    assert.ok(await page.inputValue('#knownLandmarkLat'));
    await page.evaluate(() => { window.open = (...args) => { window.openedLink = args; }; });
    await page.locator('#openDirectionsToSitePin').click();
    const link = await page.evaluate(() => window.openedLink);
    assert.equal(link[1], '_blank');
    const directions = new URL(link[0]);
    assert.equal(directions.searchParams.get('origin'), `${await page.inputValue('#knownLandmarkLat')},${await page.inputValue('#knownLandmarkLng')}`);
    assert.equal(directions.searchParams.get('destination'), `${await page.inputValue('#lat')},${await page.inputValue('#lng')}`);
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
    await page.getByText('People / Emergency Numbers', { exact: true }).click();
    await page.locator('.people-grid').screenshot({ path: path.join(output, 'people-mobile.png') });
    await page.locator('#contactName2').fill('Second Person');
    await page.locator('#contactRole2').fill('Equipment operator');
    await page.locator('#contactPhone2').fill('555-0101');
    assert.equal(await page.evaluate(() => essentialStatus().total), 4);
    await page.evaluate(async () => { await savePlan(); await openPlan(currentPlanId); });
    assert.equal(await page.locator('#planOutput .people-table tbody tr').count(), 2);
    await page.evaluate(async () => { planToForm(await activePlan()); routeTo('create'); });
    assert.equal(await page.inputValue('#contactPhone2'), '555-0101');
    await page.evaluate(() => document.querySelectorAll('#planForm details').forEach(el => { el.open = true; }));
    const geometry = await page.evaluate(() => {
      const below = (field, map) => document.querySelector(field).getBoundingClientRect().top > document.querySelector(map).getBoundingClientRect().bottom;
      return { site: below('#lat', '#siteMap'), lz: below('#landingZoneLat', '#landingZoneMap'), overflow: document.documentElement.scrollWidth > innerWidth };
    });
    assert.deepEqual(geometry, { site: true, lz: true, overflow: false });
    await page.screenshot({ path: path.join(output, 'form-mobile.png'), fullPage: true });
    assert.equal(await page.locator('#responderVerificationScript, #responderLookupChecklist, #findEr, #findStateWoodsAgency').count(), 0);
    await page.evaluate(async () => { await openPlan(currentPlanId); await openShareChoice(); });
    await page.waitForFunction(() => preparedShare);
    await page.evaluate(() => {
      Object.defineProperty(navigator, 'canShare', { configurable: true, value: () => true });
      Object.defineProperty(navigator, 'share', { configurable: true, value: async data => { window.lastShare = data; } });
    });
    await page.locator('#shareChoicePdf').click();
    const shared = await page.evaluate(() => ({ text: window.lastShare.text, name: window.lastShare.files[0].name, type: window.lastShare.files[0].type }));
    assert.ok(shared.text.includes('Second Person'));
    assert.ok(shared.text.includes('No heavy trucks'));
    assert.equal(shared.type, 'application/pdf');
    const artifacts = await page.evaluate(async () => ({
      email: await preparedShare.email.text(),
      pdf: Array.from(new Uint8Array(await preparedShare.pdf.arrayBuffer())),
      html: planEmailHtml(preparedShare.plan),
      pdfPages: planPdfPages(preparedShare.plan).length,
      escaped: planEmailHtml({ ...preparedShare.plan, title: '<script>alert(1)</script>' }).includes('&lt;script&gt;'),
      longPages: planPdfPages({ ...preparedShare.plan, hazards: 'Long hazard note. '.repeat(900) }).length,
    }));
    assert.equal(artifacts.pdfPages, 1);
    assert.ok(artifacts.longPages > 1);
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
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ passed: true, checks: 'map centering/pins, route endpoints/new tab, address/cache, contact migration/save, optional emergency numbers, responsive layout, PDF pagination, email body/PDF/fallback', output }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

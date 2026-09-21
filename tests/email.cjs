const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const output = process.env.WRSP_TEST_OUTPUT || path.join(os.tmpdir(), 'wrsp-email');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.WRSP_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const app = await context.newPage();
    await app.goto(process.env.WRSP_URL || 'http://127.0.0.1:4173');
    await app.waitForFunction(() => document.querySelector('#planId').value);
    const artifact = await app.evaluate(async () => {
      const plan = samplePlan();
      plan.title = 'Maple Ridge Test Harvest - DEMONSTRATION ONLY';
      plan.location = { lat: '44.1486', lng: '-72.6408', roadAddress: 'Test gate on Cox Brook Road', town: 'Northfield', state: 'Vermont' };
      plan.access.knownLandmark = 'VT Routes 12 and 64, Northfield';
      plan.access.phoneDirections = 'From the intersection of VT Routes 12 and 64, travel south on VT Route 12 for 1.6 miles. Turn left onto Cox Brook Road and continue 1.2 miles. Meet at the red gate after the bridge. Follow the haul road 0.6 mile to the landing.';
      plan.access.meetingPoint = 'Red gate at road';
      plan.medical = { hospital: 'Example ER (demonstration only) 802-555-0110', hospitalTown: 'Example town', hospitalAddress: 'Test address', hospitalDriveTime: '20 minutes', hospitalDirectionsUrl: 'https://www.google.com/maps/dir/?api=1&destination=Example+ER', hospitalVerified: true };
      plan.sar.contacts = 'Emergency: 911. Crew radio contact: 802-555-0111';
      plan.contacts.people[0].phone = '+1 802-555-0101 / 802-555-0121';
      const html = planEmailHtml(plan);
      const pdf = new File([await planPdfBlob(plan)], 'wrsp-email-test.pdf', { type: 'application/pdf' });
      return { html, text: planShareText(plan), eml: await (await planEmailFile(plan, pdf)).text(), pdf: Array.from(new Uint8Array(await pdf.arrayBuffer())), directions: plan.access.phoneDirections, escaped: planEmailHtml({ ...plan, title: '<img src=x onerror=alert(1)>' }), unnumbered: planEmailHtml({ ...plan, emergencyProcedure: 'Call 911. Use the procedure at gate 1.2.' }) };
    });
    assert.ok(artifact.escaped.includes('&lt;img'));
    assert.ok(!artifact.escaped.includes('<img'));
    assert.ok(!artifact.unnumbered.includes('<ol'));
    await fs.writeFile(path.join(output, 'email.html'), artifact.html);
    await fs.writeFile(path.join(output, 'plan.eml'), artifact.eml);
    await fs.writeFile(path.join(output, 'plan.pdf'), Buffer.from(artifact.pdf));
    const preview = await context.newPage();
    for (const width of [320, 390, 1000]) {
      await preview.setViewportSize({ width, height: 900 });
      await preview.setContent(artifact.html);
      assert.equal(await preview.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      assert.equal(await preview.locator('h1').count(), 1);
      assert.equal(await preview.locator('table:not([role="presentation"])').count(), 0);
      assert.equal(await preview.locator('body > table').getAttribute('lang'), 'en');
      const headings = await preview.locator('h2').allTextContents();
      assert.deepEqual(headings, ['CALL 911', 'Directions for Responders', 'Access / Gate Information', 'Contacts', 'Medical / Hospital', 'Helicopter Landing Zone', 'Hazards', 'Emergency Equipment', 'Emergency Actions']);
      assert.ok((await preview.locator('body').innerText()).includes(artifact.directions));
      const map = preview.getByRole('link', { name: 'Open site in Google Maps', exact: true });
      assert.equal(await map.getAttribute('href'), 'https://www.google.com/maps?q=44.1486,-72.6408');
      assert.equal(await map.getAttribute('target'), '_blank');
      assert.equal(await preview.getByRole('link', { name: 'Open hospital directions' }).getAttribute('href'), 'https://www.google.com/maps/dir/?api=1&destination=Example+ER');
      for (const phone of ['+18025550101', '8025550121', '8025550110', '8025550111', '911']) assert.ok(await preview.locator(`a[href="tel:${phone}"]`).count());
      assert.equal(await preview.locator('ol li').count(), 6);
      const columns = await preview.locator('.wrsp-column').evaluateAll(elements => elements.map(element => ({ x: element.getBoundingClientRect().x, y: element.getBoundingClientRect().y })));
      if (width < 620) assert.ok(columns[1].y > columns[0].y, 'Columns stack on phones');
      else assert.equal(columns[1].y, columns[0].y, 'Columns align on desktop');
      await preview.screenshot({ path: path.join(output, `email-${width}.png`), fullPage: true });
    }
    // Clients that drop media queries still get a readable narrow layout.
    await preview.setViewportSize({ width: 320, height: 900 });
    await preview.locator('style').evaluateAll(elements => elements.forEach(element => element.remove()));
    assert.equal(await preview.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    console.log(JSON.stringify({ passed: true, output, checks: 'HTML hierarchy, compact responsive columns, map/phone/hospital links, full directions, numbered actions, escaping; delivered Gmail verification is separate' }));
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

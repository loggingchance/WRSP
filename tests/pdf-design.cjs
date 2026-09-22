const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const output = process.env.WRSP_TEST_OUTPUT || path.join(os.tmpdir(), 'wrsp-pdf-design');
  await fs.mkdir(output, { recursive: true });
  const browser = await chromium.launch({ channel: process.env.WRSP_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const page = await context.newPage();
    await page.goto(process.env.WRSP_URL || 'http://127.0.0.1:4173');
    await page.waitForFunction(() => document.querySelector('#planId').value);
    const results = await page.evaluate(async () => {
      const base = samplePlan();
      base.title = 'Pine Brook Timber Harvest';
      base.company = 'Example Forestry';
      base.creator = 'Demonstration only';
      base.medical = { hospital: 'Example Regional ER', hospitalTown: 'Randolph', hospitalDriveTime: '25 minutes', hospitalDirectionsUrl: 'https://www.google.com/maps?q=Example+Hospital', hospitalVerified: true };
      base.access.landingZoneLat = '43.9291';
      base.access.landingZoneLng = '-72.6579';
      base.access.knownLandmark = 'VT Routes 12 and 66, Randolph';
      base.access.phoneDirections = 'From Routes 12 and 66 in Randolph, travel west on Route 66 for 2.3 miles. Turn right onto Pine Brook Road and continue 1.1 miles. Meet at the blue gate beyond the concrete bridge. Follow the haul road 0.5 mile to the landing.';
      const roleOnly = structuredClone(base);
      roleOnly.contacts.people = [{ role: 'Site lead', name: '', phone: '' }];
      const roleText = planPdfPages(roleOnly)[0].pdfLayout.text.map(run => run.text).join(' ');
      if (!roleText.includes('Site lead:') || !roleText.includes('Not entered')) throw new Error('Role-only contact must remain visible');
      const plans = {};
      plans.short = structuredClone(base);
      plans.short.title = 'East Lot';
      plans.short.contacts.people = base.contacts.people.slice(0, 2);
      plans.short.access.phoneDirections = 'From town hall, follow Pine Brook Road for 1.1 miles. Meet at the blue gate on the left.';
      plans.short.access.landingZoneDescription = '';
      plans.short.access.landingZoneSize = '';
      plans.short.access.landingZoneLat = '';
      plans.short.access.landingZoneLng = '';
      plans.short.access.landingZoneNotes = '';
      plans.average = structuredClone(base);
      plans['long-directions'] = structuredClone(base);
      plans['long-directions'].access.phoneDirections += ' Stay on the main gravel road at both forks. The first fork has an unmarked skid trail to the left; do not take it. Pass the old stone wall, cross the culvert, and continue uphill to the landing. A crew member in high-visibility clothing will meet responders and guide them to the injured person. Keep the entrance clear for additional vehicles.';
      plans['several-contacts'] = structuredClone(base);
      plans['several-contacts'].contacts.people.push(
        { name: 'Casey Thompson', role: 'Truck contact', phone: '802-555-0118' },
        { name: 'Jamie Williams', role: 'First aid', phone: '802-555-0119' },
        { name: 'Chris Adams', role: 'Equipment', phone: '802-555-0120' },
      );
      plans['multiple-hazards'] = structuredClone(base);
      plans['multiple-hazards'].hazardChecks = FIELD_OPTIONS.hazardChecks.slice();
      plans['multiple-hazards'].hazards = 'Stay clear of the flagged unstable slope above the west landing.';
      plans['detailed-access'] = structuredClone(base);
      plans['detailed-access'].access.gateNotes = 'Locked blue gate. Combination 2468. Crew lead carries the spare key. Do not block the gate or the roadside turnout.';
      plans['detailed-access'].access.constraints = ['Narrow bridge', 'Weight restriction', 'Limited turnaround', 'Steep haul road'];
      plans['detailed-access'].access.routeNotes = 'Bridge posted at 10 tons. Heavy vehicles must stage on Pine Brook Road; crew will guide responders around the bridge using the west access trail.';
      plans['detailed-access'].access.phoneServiceNotes = 'Cell coverage at gate only. Use radio channel 3 between the gate and landing. Supervisor carries a satellite communicator.';
      const output = [];
      for (const [name, plan] of Object.entries(plans)) {
        try {
          const canvas = planPdfPages(plan)[0];
          const pdf = await planPdfBlob(plan);
          output.push({ name, pdf: Array.from(new Uint8Array(await pdf.arrayBuffer())), png: canvas.toDataURL('image/png').split(',')[1], metrics: canvas.fieldMetrics, layout: canvas.pdfLayout, links: canvas.links, directions: plan.access.phoneDirections, people: plan.contacts.people });
        } catch (error) { output.push({ name, error: error.message }); }
      }
      return output;
    });
    for (const result of results) {
      console.log(JSON.stringify({ name: result.name, error: result.error, metrics: result.metrics }));
      if (result.error) continue;
      await fs.writeFile(path.join(output, result.name + '.pdf'), Buffer.from(result.pdf));
      await fs.writeFile(path.join(output, result.name + '.png'), Buffer.from(result.png, 'base64'));
      await fs.writeFile(path.join(output, result.name + '.json'), JSON.stringify({ metrics: result.metrics, layout: result.layout, links: result.links }, null, 2));
    }
    assert.ok(results.every(result => !result.error), 'All six representative plans must fit');
    for (const result of results) {
      assert.ok(result.metrics.bodyFontPt >= 12 && result.metrics.bodyFontPt <= 13);
      assert.equal(result.metrics.marginPt, 36);
      assert.ok(result.metrics.overflow <= 0);
      assert.ok(result.layout.blocks.some(block => block.title === 'Directions for Responders' && block.width === 540));
      const actions = result.layout.blocks.find(block => block.title === 'Emergency Actions');
      assert.ok(actions.y + actions.height > 730, 'Actions use lower page');
      const drawn = result.layout.text.map(run => run.text).join(' ').replace(/\s+/g, ' ');
      for (const word of result.directions.split(/\s+/)) assert.ok(drawn.includes(word), 'Directions word retained: ' + word);
      for (const person of result.people) assert.ok(drawn.includes(person.name), 'Contact retained: ' + person.name);
      for (const run of result.layout.text) {
        assert.ok(run.x >= 35.9 && run.x + run.width <= 576.1 && run.y >= 35.9 && run.y + run.height <= 756.6, 'Text within half-inch margins: ' + run.text);
      }
      for (let i = 0; i < result.layout.blocks.length; i++) {
        const a = result.layout.blocks[i];
        for (const b of result.layout.blocks.slice(i + 1)) {
          const overlap = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x) > 0.1 &&
            Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y) > 0.1;
          assert.equal(overlap, false, 'No overlap: ' + a.title + ' / ' + b.title);
        }
      }
      assert.ok(result.links.some(link => link.url === 'https://www.google.com/maps?q=44.033800,-72.318600'));
    }
    console.log('Six PDF designs passed fit, hierarchy, margins, content, and no-overlap checks.');
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

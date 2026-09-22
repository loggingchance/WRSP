const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');

(async () => {
  const output = process.env.WRSP_TEST_OUTPUT || path.join(os.tmpdir(), 'wrsp-pdf-links');
  await fs.mkdir(output, { recursive: true });
  const pdfjsRoot = path.dirname(require.resolve('pdfjs-dist/package.json'));
  const browser = await chromium.launch({ channel: process.env.WRSP_BROWSER || 'msedge', headless: true });
  try {
    const context = await browser.newContext({ serviceWorkers: 'block' });
    const modules = { 'pdf.mjs': 'build/pdf.mjs', 'pdf.worker.mjs': 'build/pdf.worker.mjs', 'pdf_viewer.mjs': 'web/pdf_viewer.mjs', 'pdf_viewer.css': 'web/pdf_viewer.css' };
    await context.route('**/__pdfjs/*', async route => {
      const name = new URL(route.request().url()).pathname.split('/').pop();
      if (!modules[name]) return route.abort();
      await route.fulfill({ path: path.join(pdfjsRoot, modules[name]), contentType: name.endsWith('.css') ? 'text/css' : 'text/javascript' });
    });
    const page = await context.newPage();
    const base = process.env.WRSP_URL || 'http://127.0.0.1:4173';
    await page.goto(base);
    await page.waitForFunction(() => document.querySelector('#planId').value);
    const result = await page.evaluate(async () => {
      const pdfjs = await import('/__pdfjs/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/__pdfjs/pdf.worker.mjs';
      const plan = samplePlan();
      plan.location.lat = '44.1486';
      plan.location.lng = '-72.6408';
      const directions = plan.access.phoneDirections;
      const rows = fieldPlanData(plan).emergency.rows;
      const gpsIndex = rows.findIndex(row => row.label === 'GPS');
      const canvas = planPdfPages(plan)[0];
      const bytes = new Uint8Array(await (await planPdfBlob(plan)).arrayBuffer());
      const pdf = await pdfjs.getDocument({ data: bytes.slice() }).promise;
      const annotations = await (await pdf.getPage(1)).getAnnotations();
      const checks = [];
      for (const [lat, lng, expected] of [
        ['', '', ''], [null, '-72.6408', ''], ['44.1486', '', ''], [' ', '-72.6408', ''],
        ['91', '-72.6408', ''], ['44.1486', '-181', ''], ['NaN', '2', ''],
        [0, 0, 'https://www.google.com/maps?q=0,0'],
        ['-44.1486', '72.6408', 'https://www.google.com/maps?q=-44.1486,72.6408'],
      ]) {
        const variant = { ...plan, location: { ...plan.location, lat, lng } };
        const file = await pdfjs.getDocument({ data: new Uint8Array(await (await planPdfBlob(variant)).arrayBuffer()) }).promise;
        const links = (await (await file.getPage(1)).getAnnotations()).map(link => link.url);
        const html = planEmailHtml(variant);
        checks.push({ expected, url: fieldMapUrl(lat, lng), pages: file.numPages, labeled: html.includes('Open site in Google Maps'), linked: expected ? links.includes(expected) : !links.includes('https://www.google.com/maps?q=44.1486,-72.6408') });
        await file.destroy();
      }
      const dense = { ...plan, hazards: 'Avoid the marked unstable slope. '.repeat(12) };
      const denseCanvas = planPdfPages(dense)[0];
      return { bytes: Array.from(bytes), html: planEmailHtml(plan), annotations, pages: pdf.numPages, metrics: canvas.fieldMetrics, denseMetrics: denseCanvas.fieldMetrics, checks, nextRow: rows[gpsIndex + 1], directions: rows.find(row => row.kind === 'directions').text, originalDirections: directions };
    });
    const expected = 'https://www.google.com/maps?q=44.1486,-72.6408';
    const siteLinks = result.annotations.filter(link => link.url === expected);
    assert.equal(result.pages, 1);
    assert.equal(siteLinks.length, 1, 'Exactly one explicit site-map annotation');
    assert.equal(result.nextRow.text, 'Open site in Google Maps');
    assert.equal(result.nextRow.url, expected);
    assert.equal(result.directions, result.originalDirections, 'Written directions are unchanged');
    assert.ok(result.metrics.bodyFontPt >= 12 && result.metrics.bodyFontPt <= 13);
    assert.ok(result.metrics.keyFontPt > 12, 'Spare room enlarges key items');
    assert.ok(result.denseMetrics.bottom <= result.denseMetrics.limit);
    assert.ok(result.denseMetrics.bodyFontPt >= 12, 'Dense plans retain readable body size');
    for (const check of result.checks) {
      assert.equal(check.url, check.expected);
      assert.equal(check.pages, 1);
      assert.equal(check.labeled, Boolean(check.expected));
      assert.ok(check.linked);
    }
    for (const link of result.annotations) {
      const [left, bottom, right, top] = link.rect;
      assert.ok(left >= 0 && bottom >= 0 && right <= 612 && top <= 792 && right > left && top > bottom, 'Valid PDF hyperlink bounds');
    }
    await fs.writeFile(path.join(output, 'site-link.pdf'), Buffer.from(result.bytes));
    await fs.writeFile(path.join(output, 'site-link-email.html'), result.html);

    // Render the exported PDF, including its real annotation layer, then click it.
    const viewer = await context.newPage();
    await viewer.goto(base);
    await viewer.setContent('<link rel="stylesheet" href="/__pdfjs/pdf_viewer.css"><div class="pdfViewer" style="--scale-factor:1;--user-unit:1;--total-scale-factor:1"><div class="page" style="width:612px;height:792px"><canvas></canvas><div class="annotationLayer"></div></div></div>');
    await viewer.evaluate(async bytes => {
      const pdfjs = await import('/__pdfjs/pdf.mjs');
      pdfjs.GlobalWorkerOptions.workerSrc = '/__pdfjs/pdf.worker.mjs';
      const { PDFLinkService } = await import('/__pdfjs/pdf_viewer.mjs');
      const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
      const page = await pdf.getPage(1);
      const viewport = page.getViewport({ scale: 1 });
      const canvas = document.querySelector('canvas');
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
      const linkService = new PDFLinkService({ externalLinkTarget: 2 });
      const layer = new pdfjs.AnnotationLayer({ div: document.querySelector('.annotationLayer'), page, viewport: viewport.clone({ dontFlip: true }), linkService });
      await layer.render({ annotations: await page.getAnnotations(), linkService, renderForms: false });
    }, result.bytes);
    const link = viewer.locator(`a[href="${expected}"]`);
    await link.waitFor({ state: 'visible' });
    await viewer.screenshot({ path: path.join(output, 'site-link-viewer.png'), fullPage: true });
    if (!process.env.WRSP_LIVE_MAP) await context.route('https://www.google.com/maps?**', route => route.fulfill({ body: 'Map destination reached.' }));
    const popupPromise = viewer.waitForEvent('popup');
    await link.click();
    const popup = await popupPromise;
    await popup.waitForLoadState('domcontentloaded');
    assert.equal(new URL(popup.url()).hostname, 'www.google.com');
    assert.ok(popup.url().includes('44.1486') && popup.url().includes('-72.6408'));
    console.log(JSON.stringify({ passed: true, url: popup.url(), title: await popup.title(), checks: 'one-page PDF, actual URI annotation and viewer click, coordinate edge cases, directions retained, larger key text, readable 12-13pt body' }));
    await popup.close();

    const email = await context.newPage();
    await email.setContent(result.html);
    assert.equal(await email.getByRole('link', { name: 'Open site in Google Maps', exact: true }).getAttribute('href'), expected);
    assert.ok((await email.locator('p').filter({ hasText: /^GPS:/ }).evaluate(el => el.nextElementSibling.textContent)).includes('Open site in Google Maps'));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

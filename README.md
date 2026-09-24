# WRSP

Woods-Ready Safety Plan is an offline-first mobile web app for creating, saving, importing, and sharing site-specific logging safety plans.

## Run locally

Serve the folder with any static web server, then open the local URL in a browser.

```powershell
python -m http.server 4173
```

If Python is not available, use the bundled helper:

```powershell
node work/dev-server.js 4173
```

The app can also be opened directly from `index.html` for UI review, but full PWA install/offline testing requires HTTP/HTTPS.

## GitHub Pages deployment

WRSP is designed for static GitHub Pages deployment. Publish the project root as the Pages site so these files are served at the web root:

- `index.html`
- `app.js`
- `field-plan.js`
- `pdf-plan.js`
- `email-template.js`
- `styles.css`
- `manifest.webmanifest`
- `service-worker.js`
- `assets/`

After deployment, open the hosted URL and check **More -> PWA Status** inside the app.

## Offline/PWA test

1. Open the hosted WRSP site on a phone.
2. Create or open a sample plan and save it.
3. Use Add to Home Screen or Install app.
4. Close the browser.
5. Turn on airplane mode.
6. Reopen WRSP from the home-screen icon.
7. Confirm saved plans open and can be edited/saved.
8. Confirm maps/search/QR image generation resume when service returns.

The app uses IndexedDB for local plans and a service worker for offline app-shell caching.

## Version-one scope

- Create and auto-save job safety plans.
- Capture or manually enter GPS coordinates.
- Store plans locally on the device.
- Open, edit, duplicate, delete, export, import, print, and share plans.
- Share current static GPS location.
- Maintain a preparedness profile for trusted contacts.
- Record user-entered medical and emergency numbers, with suggested search terms.
- Include install instructions and acknowledgements.

## Email and PDF sharing

Email Plan + PDF passes the complete plain-text plan and an attached PDF to the device share sheet. Choose an email app there. Native share targets decide which fields they accept; Web Share does not provide an HTML-body field.

Text Plan + Image passes the same complete plain-text plan, including the automatic site Google Maps URL, together with the formatted JPG in a single share request. The image uses the PDF layout; its links are not interactive, but the accompanying text includes the URLs. Messaging apps decide which fields they accept and may compress the image. If browser file sharing is unavailable, WRSP downloads the attachment and offers a clearly labeled text-only email or Messages link. Text-only links do not attach files.

Download Formatted Email Draft creates an unsent `.eml` message with both plain-text and styled HTML bodies, plus the same PDF attachment. Open it in a compatible mail client to address and send; some clients open EML as a message to forward rather than an editable draft. Unsupported file sharing falls back to this draft instead of silently omitting the email body. No email is sent by WRSP itself.

PDFs use exactly one letter-size page with half-inch margins, 12-13pt body text, 14-15pt section headings, a 21pt site title, and an 18pt CALL 911 heading. Location and written directions occupy separate full-width panels. Supporting sections are balanced across two columns, with bold labels and regular-weight values; numbered emergency actions occupy the bottom of the page. Red, blue, green, teal, and amber distinguish emergency, directions, contacts/actions, medical, and hazards while retaining grayscale contrast. Phone numbers and map links are clickable. Layout spacing and grouping tighten before body size changes; body text never drops below 12pt. If content still exceeds the page, export stops with a fit message identifying the largest sections. Saved text is never truncated or split across pages. Save / Print PDF and shared plan images use the same design.

The PDF and HTML email place **Open site in Google Maps** immediately below the site GPS coordinates, generated as `https://www.google.com/maps?q=LATITUDE,LONGITUDE`. Invalid or missing coordinates produce no site link. Written directions remain complete in a separate primary block. Link annotation bounds match the actual underlined text.

The HTML email template has a compact emergency header, a separate Directions for Responders panel, responsive supporting sections, clickable phone/hospital links, and numbered emergency actions. The optional MIME draft includes this HTML as the preferred alternative with plain-text fallback and an identical PDF attachment. By product decision, WRSP remains a web app sending through the user's own mail app: no centralized sending service and no copy/paste requirement. Normal email sharing therefore retains the phone's plain-text limitations; the PDF is the consistently formatted version. HTML draft delivery in Gmail is not claimed or verified.

Sharing always includes the full entered plan; there are no send-confirmation or inclusion checkboxes. Missing coordinates, missing written directions, and unconfirmed hospital details produce visible warnings without blocking sharing. Hospital editing clears its confirmation. Copy This Plan preserves reusable content but marks the copy for location review and clears hospital confirmation. Attachments are prepared before the send-button tap so native sharing retains user activation. Canceling does not force a download; failed preparation offers a retry.

The known starting point / landmark and written responder directions are manual fields, with no landmark map or external route-search buttons. Existing saved landmark coordinates remain preserved unless the landmark name changes. People & Contact Information includes on-site and off-site contacts in the same name, role, and phone grid.

Hazards, access constraints, and equipment use checkboxes plus custom notes. Remember people and routine details stores a local profile for new plans; saved/recent people can also be added individually. Emergency text is available independently for quick copying. PDF QR codes and live hosted plan links remain optional future work.

Generation and manual directions entry work offline; map tiles and road suggestions require a connection. Address suggestions use the [Photon public service](https://github.com/komoot/photon#demo-server) on explicit user request with a session cache, or a user's optional Geoapify key. Availability and map coverage are not guaranteed; manual address entry remains available.

## Regression checks

With a local server running and Playwright available, run `node tests/smoke.cjs`. The default browser is Edge; set `WRSP_BROWSER` to another installed Playwright channel when needed. `WRSP_URL` overrides the default `http://127.0.0.1:4173`, and `WRSP_TEST_OUTPUT` chooses the screenshot/export directory. Set `WRSP_LIVE_LOOKUP=1` to also exercise the public address service in the browser.

Run `node tests/offline.cjs` to verify the versioned app assets are cached and that plans can be reopened, edited, saved, and prepared for sharing without a connection.

Run `node tests/sharing.cjs` for incomplete-plan sharing, full text/PDF/JPEG payloads, real-tap user activation, cancellation, rejected sharing, draft download/retry, manual directions, legacy landmark preservation, and mobile layouts. Set `WRSP_ENGINE=webkit` when Playwright WebKit is installed. Native sharing is mocked to inspect the handoff; these tests do not establish delivery by an actual iPhone Mail or Messages app.

Run `node tests/pdf-links.cjs` with Playwright and `pdfjs-dist` available to inspect the exported PDF and click its real annotation layer. Set `WRSP_LIVE_MAP=1` to navigate to Google Maps; the default intercepts the destination for a deterministic offline-capable click test.

Run `node tests/pdf-design.cjs` to generate short, average, long-directions, eight-contact, all-hazard, and detailed-access plans. It checks readable sizes, half-inch margins, full-width directions, retained content, bottom-page actions, and non-overlapping blocks. Render the generated PDFs with Poppler for visual inspection in color and grayscale before release.

Run `node tests/email.cjs` for 320px/390px/desktop email layout, content, and link checks. Then run `python tests/email-mime.py <WRSP_TEST_OUTPUT>` with `pypdf` available to verify MIME alternatives and the actual attached PDF bytes. These local checks do not claim successful delivery or rendering inside Gmail.

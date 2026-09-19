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

Download Formatted Email Draft creates an unsent `.eml` message with both plain-text and styled HTML bodies, plus the same PDF attachment. Open it in a compatible mail client to address and send; some clients open EML as a message to forward rather than an editable draft. Unsupported file sharing falls back to this draft instead of silently omitting the email body. No email is sent by WRSP itself.

PDFs use letter-size pages and include a clickable Google Maps directions link. Generation works offline; map tiles, directions, and road suggestions require a connection. Address suggestions use the [Photon public service](https://github.com/komoot/photon#demo-server) on explicit user request with a session cache, or a user's optional Geoapify key. Availability and map coverage are not guaranteed; manual address entry remains available.

## Regression checks

With a local server running and Playwright available, run `node tests/smoke.cjs`. The default browser is Edge; set `WRSP_BROWSER` to another installed Playwright channel when needed. `WRSP_URL` overrides the default `http://127.0.0.1:4173`, and `WRSP_TEST_OUTPUT` chooses the screenshot/export directory. Set `WRSP_LIVE_LOOKUP=1` to also exercise the public address service in the browser.

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
- Launch online medical-care map searches with 911/EMS warnings.
- Include install instructions and acknowledgements.

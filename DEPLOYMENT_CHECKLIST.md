# WRSP Deployment Checklist

Goal: publish WRSP at a real web address so phone install/offline testing can happen.

## Recommended path: GitHub Pages

1. Create a GitHub repository named `WRSP` or similar.
2. Add the WRSP project files at the repository root:
   - `index.html`
   - `app.js`
   - `styles.css`
   - `manifest.webmanifest`
   - `service-worker.js`
   - `assets/`
   - `.nojekyll`
3. In GitHub, open the repository settings.
4. Go to Pages.
5. Set the source to deploy from the `main` branch and root folder.
6. Wait for GitHub to publish the site.
7. Open the published URL on a phone.
8. In WRSP, open More -> PWA Status.
9. Confirm the app is not running from `file:///`.
10. Create or open a sample plan and save it.
11. Add WRSP to the phone home screen.
12. Turn on airplane mode.
13. Reopen WRSP from the home-screen icon.
14. Confirm saved plans open and can be edited/saved offline.

## What must pass

- Hosted URL loads WRSP.
- PWA Status shows hosted/web address, secure context, and service worker support.
- Saved plans persist after closing and reopening.
- Offline mode opens the app shell after first load.
- Existing saved plans open offline.
- Plan edits can be saved offline.
- Online-only tools such as maps, lookup, QR image generation, and feedback email resume when service returns.

## Notes

- Opening `index.html` directly is only a UI preview.
- Full install/offline behavior requires HTTP/HTTPS.
- GitHub Pages is the simplest durable test host for this static app.

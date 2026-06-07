# WRSP Project Tracker

Last updated: June 7, 2026

## Current product direction

WRSP exists to build a site-specific logging safety plan and share it. The core flow is:

1. Create plan.
2. Select/confirm site location.
3. Record read-aloud 911 directions from a known landmark.
4. Add job contacts, local woods emergency contacts, medical information, and possible helicopter landing zone information.
5. Save, view, share, print, export, or import the plan.

## Completed so far

- Static single-page WRSP app created with `index.html`, `app.js`, `styles.css`, manifest, service worker, icons, and WRSP header image.
- Offline-first structure added with IndexedDB local plan storage and service worker cache.
- Home screen refocused around Create -> Complete -> Share.
- Latest saved plan appears on Home with Open and Share.
- Create flow converted to accordion sections with essentials progress.
- Site map picker added for selecting coordinates by map tap/pan/zoom.
- GPS capture fills coordinates and centers the map.
- Read-aloud directions to 911 added as a first-class field.
- Local woods emergency contact helper improved with state-agency-aware searches.
- Contact readiness tightened: primary job contact and local woods emergency contacts are separate essentials.
- Contact fields offer "Choose from contacts" using the browser Contact Picker API when supported by the user's phone/browser.
- Possible helicopter landing zone fields added, including optional LZ coordinates and hazard notes.
- Saved plans can open, edit, delete, and share inline.
- Plan view has a sticky Share Plan button.
- Plan view now includes a Full Plan / Responder View switch.
- Responder View prioritizes GPS, map link, read-aloud directions, access, contacts, medical, hazards, and possible helicopter landing zone information.
- Print now switches to Responder View and uses a compact print stylesheet for a field-ready responder sheet.
- Export now creates/share-downloads an importable `.wrsp.json` file.
- Import now accepts a selected WRSP export file, with pasted export text retained as a fallback.
- Plan view can generate an import QR code/link for small and medium plans; large plans should use file export.
- Medical facility workflow now lets users save hospital/ER, urgent care, trauma/major hospital details, directions links, and medical notes into the current plan.
- Feedback workflow added so users can send suggestions, bugs, missing resources, and error information by email draft, with optional basic app/browser info.
- Sample plan added so users can open a field-ready example.
- Default plan setup added for reusable creator, company, state, contact, woods emergency contact, and medical notes.
- New plans start with saved defaults when available.
- PWA Status screen added with service worker, hosting, connection, install-mode, and offline test checklist.
- README updated with GitHub Pages deployment and offline/PWA test steps.
- GitHub Pages deployment checklist added in `DEPLOYMENT_CHECKLIST.md`; `.nojekyll` added for static hosting.
- GitHub connector authorized for the `loggingchance` account.
- Online repository `loggingchance/WRSP` created and visible to Codex.
- First online WRSP commit created through the connector with `README.md`.
- First full WRSP app publish completed to `loggingchance/WRSP` from the authenticated Windows session.
- Lightweight `assets/wrsp-header.svg` added as a connector-friendly header asset while preserving the original PNG locally.
- Shared plan text leads with map link and read-aloud directions.
- Preparedness profile and sharing exist.
- Medical lookup exists through online map searches with urgent-care warnings.
- About / Resources expanded with real links and an Other Apps and Tools section.
- Safety Share launcher added for iPhone Messages, Find My, Google Maps, SMS fallback, copy/share safety message, static backup pin, and user confirmation timestamp.

## User feedback captured

- Do not default the app to New York or any one state.
- Users should not have to type latitude/longitude; map selection should capture coordinates.
- Local woods emergency contacts should be helped/suggested based on site location, not a blank jargon field.
- Plans need phone-ready directions from a known landmark such as a town, village, fire station, or highway intersection.
- Plans should record possible helicopter landing zone coordinates and hazards.
- About/Resources must include real links and related app links.
- About/Resources should follow the original required acknowledgements and should not mention The Northern Logger magazine.
- Before calling the app finished, show and review WRSP in a phone-sized preview window so the user can see the mobile layout.
- Share My Location should become Safety Share: a launch-and-guidance feature for the phone's built-in live location sharing tools.
- Safety Share must clearly state that WRSP does not automatically start live tracking and does not build custom real-time tracking in this phase.

## Next priorities

1. Enable GitHub Pages for the repository and test the hosted URL.
2. Test the hosted PWA on an actual phone, including offline use and Add to Home Screen.
3. Test Safety Share on iPhone, Android, and unknown/desktop fallback paths.
4. Improve agency/contact lookup beyond web search where feasible.
5. Final mobile QA: show the app in a phone-sized preview window and check touch layout, text wrapping, sticky buttons, map picker, print sheet, and plan/responder views.

## GitHub automation status

- Working: Codex can authenticate to GitHub through the connector as `loggingchance`.
- Working: Codex can inspect repositories and create/update ordinary GitHub objects through the connector.
- Working: `loggingchance/WRSP` exists online and is visible to Codex.
- Working: First full WRSP static app publish is online.
- Blocked: This thread's connector toolset does not expose repository creation or bulk project upload.
- Blocked: Shell-based `git push` from the sandbox cannot authenticate with the user's Windows GitHub session.
- Blocked: The local `C:\Users\steve\Documents\GitHub\WRSP\.git` folder has a Windows deny rule for the sandbox identity, so Codex cannot stage/commit there directly.
- Bridge path: Use GitHub Desktop or the authenticated Windows command prompt once for the first full publish; after files are online, Codex can continue managing smaller repo changes through the GitHub connector.

## Open GitHub issues

- [#1 Complete first full WRSP publish and GitHub Pages setup](https://github.com/loggingchance/WRSP/issues/1)
- [#2 Improve location-based emergency contact lookup beyond generic web search](https://github.com/loggingchance/WRSP/issues/2)
- [#3 Add Safety Share launcher for built-in phone live location sharing](https://github.com/loggingchance/WRSP/issues/3)

## Current implementation notes

- Static deployment only; no framework or backend.
- Safety Share phase one uses native phone live-location tools such as iPhone Messages, Find My, and Google Maps. WRSP launches or guides those tools and records the user's confirmation; it does not do custom background tracking.
- Deployment prep files: `.nojekyll` and `DEPLOYMENT_CHECKLIST.md`.
- Local data is stored in IndexedDB under `wrsp-db`.
- Service worker cache is currently `wrsp-v5`.
- Opening by `file:///` works for UI preview, but full PWA behavior requires HTTP/HTTPS.
- Phone contact import depends on browser Contact Picker API support and may not work from desktop/file preview.
- QR code image generation currently depends on online access to the QR image service; import links are most useful from a hosted WRSP URL rather than `file:///` preview.
- Medical lookup currently opens map searches and lets users save facility details manually; automatic facility selection would require a places/search API.
- Feedback is sent through a user-reviewed `mailto:` draft to steve@northeastforests.com; no feedback is collected silently.

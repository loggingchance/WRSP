# WRSP Project Tracker

Last updated: June 29, 2026

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
- Provided WRSP header PNG is now the active home banner image, with the SVG retained only as a lightweight fallback asset.
- Shared plan text leads with map link and read-aloud directions.
- Preparedness profile and sharing exist.
- Medical lookup exists through online map searches with urgent-care warnings.
- About / Resources expanded with real links and an Other Apps and Tools section.
- Safety Share launcher added for iPhone Messages, Find My, Google Maps, SMS fallback, copy/share safety message, static backup pin, and user confirmation timestamp.
- Local emergency contact lookup improved with a verification checklist and dedicated fields for verified agency/dispatch, phone, person/role, and source/date.
- Home screen tightened for phone testing: primary Create Safety Plan action is above the fold, with saved plans and pinned-location sharing secondary.
- "Share My Location" renamed to "Share Pinned Location" so it is clearly distinct from Safety Share live-location handoff.
- Dial 911 action added to the emergency screen and responder view.
- Plan share text shortened into a responder-readable message instead of a long field dump.
- Share This App workflow added with hosted WRSP link and home-screen instruction text.
- My Medical Card added as a local-only, user-shared record for allergies, medications, conditions, emergency contacts, physician, insurance/air-medical notes, and directives.
- Open Graph / rich preview metadata added for shared WRSP app links.
- PWA status now shows the app version and includes an update check; service worker cache moved to `wrsp-v7`.
- Sample PDF safety plan reviewed; WRSP now includes phone-service notes in the plan data, responder view, and share text.
- Plan action labels changed from technical export language toward field language: Backup File and Print / Save PDF.
- Responder View reshaped into a one-page safety sheet modeled on the sample PDF: Phones, Site Location, State & Emergency Numbers, People, Directions, Access/Hazards, and Potential Helicopter Landing Site.
- Import screen wording changed from export/file-format language to backup-file language.
- Create form directions now separate the responder-known starting point from the site-specific woods access instructions.
- Shared plan links now use `#plan=` and open a read-only responder safety sheet first, instead of immediately importing a backup into local storage.
- QR codes and Safety Share plan links now point to the read-only shared-plan view.
- Physical address / road descriptions can be opened directly in maps from the location section.
- Location entry now makes the distinction explicit: address/road notes describe the site, while exact coordinates come from phone GPS, manual coordinates, or a dropped map pin.
- Map picker now has a center crosshair, Drop Pin at Map Center, Clear Pin, and Center controls.
- Responder/contact lookup now includes a generated verification script, copy-script button, verified-today stamp, and one-tap append of verified agency/person/phone/source into saved local woods emergency contact notes.
- Northeastern Loggers' Association is now visible as the provider in the sticky app header and first-screen home hero, not only in the About section.
- About section replaced with the definitive June 11 HTML mockup content, fitted into WRSP cards and colors.
- Home screen now has an obvious Install / Save App callout, plus an install page button that uses the browser install prompt when available and falls back to phone/desktop instructions.
- Header now includes small Install and Update buttons under the connection status for saved-home-screen users.
- Home screen now has a prominent Update WRSP button beside Install / Save App, and the update flow attempts to activate a waiting service worker and reload the app.
- Social preview support added: root `og-image.png` plus Open Graph and Twitter/X metadata pointing to the absolute GitHub Pages image URL.
- Contact labels changed from primary/supervisor language to logger, crew member(s), forester, landowner(s), and other contact/role.
- Forester label no longer says "plan preparer."
- Site and helicopter landing coordinates are read-only fields populated by GPS/map actions rather than manual entry fields.
- Site map now opens/recenters at a closer zoom and uses a taller picker to make phone pin placement easier.
- Helicopter landing zone now has its own GPS/map picker with pan, zoom, drop pin, clear pin, and use-site-point actions.
- Site location wording now prioritizes nearest public road/address instead of manual coordinate entry.
- Medical lookup now has explicit Find ER, Find Urgent Care, and Find Trauma Center actions that prepare the correct save type, generate a directions/search link, and require the user to confirm facility details before saving them into the current plan.
- Plan view now includes a PNG export/share option for a formatted responder safety plan image.
- Save Plan / Keep Editing controls no longer float over the phone screen.
- Home and About now state that WRSP does not collect user, work, medical, or other data.
- Plan sharing now sends a formatted responder-plan link instead of a plain text plan dump; Print / Save PDF remains the PDF path.
- Responder print view now shows the map URL as the visible link text so emailed PDFs have a better chance of preserving a clickable site-location link.
- Forester contact added to the plan form, reusable defaults, sample plan, full plan view, responder view, and responder share text.
- Read-aloud directions helper added: users can search for a responder-known starting landmark and build a draft from route, gate, meeting point, and site coordinates.
- Medical Card now has explicit sharing actions for family/trusted contacts and EMS/medical responders, with different message context.
- Medical Card now has Print / Save PDF, PNG, and QR/share-link options, with a dedicated card preview.
- Service worker cache moved to `wrsp-v19` so saved-home-screen users can receive this update.
- Publish script now includes the local preview server helper, and the preview server serves PNG header images with the correct type.
- Search/discovery support added: descriptive SEO title, meta description, keywords, author, robots, canonical URL, SoftwareApplication JSON-LD, manifest discovery fields, root sitemap, and root robots file.
- Service worker cache moved to `wrsp-v20` so saved-home-screen users can receive the SEO/manifest update.

## User feedback captured

- Do not default the app to New York or any one state.
- Users should not have to type latitude/longitude; map selection should capture coordinates.
- Local woods emergency contacts should be helped/suggested based on site location, not a blank jargon field.
- Plans need phone-ready directions from a known landmark such as a town, village, fire station, or highway intersection.
- Plans should record possible helicopter landing zone coordinates and hazards.
- About/Resources must include real links and related app links.
- About should follow the definitive June 11 HTML mockup wording and content.
- Before calling the app finished, show and review WRSP in a phone-sized preview window so the user can see the mobile layout.
- Share My Location should become Safety Share: a launch-and-guidance feature for the phone's built-in live location sharing tools.
- Safety Share must clearly state that WRSP does not automatically start live tracking and does not build custom real-time tracking in this phase.
- Corrections on June 9 emphasized that plan sharing must be readable and plan-oriented, not JSON-oriented.
- Mobile UI/UX brief emphasized one main phone action: create and distribute a one-page safety plan.
- The app needs an obvious "Share this app" button and clearer install/home-screen support.
- The app needs an obvious up-front way to save/install WRSP on a phone home screen or desktop.
- June 15 evaluation: phone map needs better zoom/location workflow; manual lat/long is unacceptable; LZ should be map-selected; contact roles need logger/crew/forester/landowner/other; plan and medical shares should be formatted PDF/PNG/link; facility selection should populate medical fields; header needs install/update; app needs clear privacy statement.
- The app needs a local-only medical card / KIWY-style feature that shares only when the user chooses.
- The sample safety plan format confirms the one-page plan should include phones/service, emergency numbers, people, read-aloud access directions, gate/meet-responder instructions, and helicopter landing coordinates.
- Foresters involved in the job often write the plan and must be captured as named contacts alongside crew, landowner, and agency contacts.
- The Northeastern Loggers' Association must be visibly acknowledged in the app header/first screen, not hidden deep in resources.
- WRSP needs basic search discoverability through SEO metadata, social preview metadata, sitemap, robots file, and Search Console submission after deployment.

## Next priorities

1. Enable/test GitHub Pages and test the hosted PWA on an actual phone, including offline use, Add to Home Screen, update behavior, and Safety Share.
2. Final mobile QA: show the app in a phone-sized preview window and check touch layout, text wrapping, sticky buttons, map picker, print sheet, and plan/responder views.
3. Future data enhancement: replace/augment web search with a maintained agency/contact directory or vetted API if one becomes available.

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
- Service worker cache is currently `wrsp-v20`.
- Opening by `file:///` works for UI preview, but full PWA behavior requires HTTP/HTTPS.
- Phone contact import depends on browser Contact Picker API support and may not work from desktop/file preview.
- QR code image generation currently depends on online access to the QR image service; import links are most useful from a hosted WRSP URL rather than `file:///` preview.
- Medical lookup currently opens map searches and lets users save facility details manually; automatic facility selection would require a places/search API.
- Feedback is sent through a user-reviewed `mailto:` draft to steve@northeastforests.com; no feedback is collected silently.
- After the SEO update is deployed, submit `https://loggingchance.github.io/WRSP/` manually in Google Search Console using URL Inspection. Google may require site ownership verification through a DNS TXT record or Google-provided meta tag.

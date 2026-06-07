const DB_NAME = "wrsp-db";
const DB_VERSION = 1;
const PLAN_STORE = "plans";
const SETTINGS_STORE = "settings";
const PREPAREDNESS_KEY = "preparedness";
const DEFAULTS_KEY = "defaults";
const FEEDBACK_EMAIL = "steve@northeastforests.com";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let db;
let currentPlanId = null;
let currentPlanMode = "full";
let emergencyCoords = null;
let autoSaveTimer = null;
let siteMapState = {
  centerLat: 39.5,
  centerLng: -98.35,
  zoom: 4,
  dragging: false,
  dragStart: null,
  startCenter: null,
  moved: 0,
};

const STATE_WOODS_AGENCIES = {
  AL: "Alabama Forestry Commission",
  AK: "Alaska Division of Forestry and Fire Protection",
  AZ: "Arizona Department of Forestry and Fire Management",
  AR: "Arkansas Department of Agriculture Forestry Division",
  CA: "CAL FIRE",
  CO: "Colorado State Forest Service",
  CT: "Connecticut DEEP Forestry",
  DE: "Delaware Forest Service",
  FL: "Florida Forest Service",
  GA: "Georgia Forestry Commission",
  HI: "Hawaii Division of Forestry and Wildlife",
  ID: "Idaho Department of Lands",
  IL: "Illinois Department of Natural Resources Forestry",
  IN: "Indiana DNR Forestry",
  IA: "Iowa DNR Forestry",
  KS: "Kansas Forest Service",
  KY: "Kentucky Division of Forestry",
  LA: "Louisiana Department of Agriculture and Forestry",
  ME: "Maine Forest Service",
  MD: "Maryland Forest Service",
  MA: "Massachusetts DCR Bureau of Forestry",
  MI: "Michigan DNR Forest Resources Division",
  MN: "Minnesota DNR Forestry",
  MS: "Mississippi Forestry Commission",
  MO: "Missouri Department of Conservation Forestry",
  MT: "Montana DNRC Forestry",
  NE: "Nebraska Forest Service",
  NV: "Nevada Division of Forestry",
  NH: "New Hampshire Forest Rangers",
  NJ: "New Jersey Forest Fire Service",
  NM: "New Mexico Forestry Division",
  NY: "New York DEC Forest Rangers",
  NC: "North Carolina Forest Service",
  ND: "North Dakota Forest Service",
  OH: "Ohio DNR Forestry",
  OK: "Oklahoma Forestry Services",
  OR: "Oregon Department of Forestry",
  PA: "Pennsylvania DCNR Bureau of Forestry",
  RI: "Rhode Island DEM Forestry",
  SC: "South Carolina Forestry Commission",
  SD: "South Dakota Wildland Fire",
  TN: "Tennessee Division of Forestry",
  TX: "Texas A&M Forest Service",
  UT: "Utah Division of Forestry Fire and State Lands",
  VT: "Vermont Department of Forests Parks and Recreation",
  VA: "Virginia Department of Forestry",
  WA: "Washington DNR Wildfire",
  WV: "West Virginia Division of Forestry",
  WI: "Wisconsin DNR Forestry",
  WY: "Wyoming State Forestry Division",
  DC: "District emergency management and fire/rescue",
};

const STATE_NAME_TO_CODE = {
  alabama: "AL",
  alaska: "AK",
  arizona: "AZ",
  arkansas: "AR",
  california: "CA",
  colorado: "CO",
  connecticut: "CT",
  delaware: "DE",
  florida: "FL",
  georgia: "GA",
  hawaii: "HI",
  idaho: "ID",
  illinois: "IL",
  indiana: "IN",
  iowa: "IA",
  kansas: "KS",
  kentucky: "KY",
  louisiana: "LA",
  maine: "ME",
  maryland: "MD",
  massachusetts: "MA",
  michigan: "MI",
  minnesota: "MN",
  mississippi: "MS",
  missouri: "MO",
  montana: "MT",
  nebraska: "NE",
  nevada: "NV",
  "new hampshire": "NH",
  "new jersey": "NJ",
  "new mexico": "NM",
  "new york": "NY",
  "north carolina": "NC",
  "north dakota": "ND",
  ohio: "OH",
  oklahoma: "OK",
  oregon: "OR",
  pennsylvania: "PA",
  "rhode island": "RI",
  "south carolina": "SC",
  "south dakota": "SD",
  tennessee: "TN",
  texas: "TX",
  utah: "UT",
  vermont: "VT",
  virginia: "VA",
  washington: "WA",
  "west virginia": "WV",
  wisconsin: "WI",
  wyoming: "WY",
  "district of columbia": "DC",
};

const emptyPlan = () => ({
  id: crypto.randomUUID(),
  schemaVersion: 1,
  title: "",
  status: "draft",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  creator: "",
  location: {
    lat: "",
    lng: "",
    accuracy: "",
    capturedAt: "",
    manualOverride: false,
    roadAddress: "",
    town: "",
    county: "",
    state: "",
  },
  access: {
    knownLandmark: "",
    phoneDirections: "",
    routeNotes: "",
    gateNotes: "",
    meetingPoint: "",
    alternateMeetingPoint: "",
    landingZoneDescription: "",
    landingZoneLat: "",
    landingZoneLng: "",
    landingZoneNotes: "",
  },
  contacts: {
    primaryContact: "",
    supervisor: "",
    landowner: "",
    truckingContact: "",
  },
  medical: {
    hospital: "",
    hospitalDirectionsUrl: "",
    urgentCare: "",
    urgentCareDirectionsUrl: "",
    traumaCenter: "",
    traumaDirectionsUrl: "",
    notes: "",
  },
  sar: {
    contacts: "",
  },
  hazards: "",
  importedFrom: "",
});

function samplePlan() {
  const now = new Date().toISOString();
  return {
    ...emptyPlan(),
    id: crypto.randomUUID(),
    title: "Sample WRSP Plan - Ridge Road Timber Sale",
    status: "complete",
    createdAt: now,
    updatedAt: now,
    creator: "Sample crew lead",
    location: {
      lat: "43.983210",
      lng: "-74.128440",
      accuracy: "",
      capturedAt: now,
      manualOverride: true,
      roadAddress: "Ridge Road landing, 2.4 miles north of Mill Creek Road",
      town: "Sample Town",
      county: "Sample County",
      state: "State",
    },
    access: {
      knownLandmark: "Intersection of State Route 8 and County Route 14 in Sample Town",
      phoneDirections: "From the Route 8 / County Route 14 intersection, travel north on County Route 14 for 3.2 miles. Turn right on Ridge Road. Continue 2.4 miles to the locked green gate. The emergency meeting point is the wide landing immediately beyond the gate.",
      routeNotes: "Ridge Road is passable by pickups and ambulances in dry conditions. Lowboy trucks should turn around at the landing only.",
      gateNotes: "Green gate with combination lock. Combination held by crew lead and landowner.",
      meetingPoint: "Wide gravel landing just inside the green gate on Ridge Road.",
      alternateMeetingPoint: "County Route 14 pull-off at Ridge Road entrance.",
      landingZoneDescription: "Open hay field south of the Ridge Road gate, approximately 0.3 mile from landing.",
      landingZoneLat: "43.980900",
      landingZoneLng: "-74.131200",
      landingZoneNotes: "Check for overhead wires along field edge. Soft ground after rain. EMS/dispatch determines air medical use.",
    },
    contacts: {
      primaryContact: "Crew lead - 555-0101",
      supervisor: "Supervisor - 555-0102",
      landowner: "Landowner - 555-0103",
      truckingContact: "Trucking coordinator - 555-0104",
    },
    medical: {
      hospital: "Sample Memorial Hospital ER, 100 Main Street, Sample City, 555-0200",
      hospitalDirectionsUrl: "",
      urgentCare: "Sample Urgent Care, 22 Clinic Road, Sample City, 555-0201",
      urgentCareDirectionsUrl: "",
      traumaCenter: "Regional Trauma Center, 400 Hospital Drive, Regional City, 555-0202",
      traumaDirectionsUrl: "",
      notes: "Use urgent care only for non-life-threatening issues. For serious injury or uncertain severity, call 911 and request EMS.",
    },
    sar: {
      contacts: "County dispatch / sheriff search and rescue: 555-0300. State forestry/ranger district office: 555-0301.",
    },
    hazards: "Steep skid trail above landing, active equipment, narrow bridge on Ridge Road, limited cell service past gate.",
  };
}

function openDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PLAN_STORE)) {
        database.createObjectStore(PLAN_STORE, { keyPath: "id" });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storePut(storeName, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).put(value);
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}

function storeDelete(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readwrite");
    tx.objectStore(storeName).delete(key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

function storeGet(storeName, key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).get(key);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function storeAll(storeName) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(storeName, "readonly");
    const request = tx.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function routeTo(route) {
  $$(".view").forEach((view) => view.classList.remove("active"));
  $(`#${route}View`)?.classList.add("active");
  $$(".bottom-nav button").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  if (route === "home") renderContinuePlan();
  if (route === "saved") renderSavedPlans();
  if (route === "create") window.setTimeout(renderSiteMap, 50);
  if (route === "medical") prefillMedicalOrigin();
  if (route === "preparedness") loadPreparedness();
  if (route === "defaults") loadDefaultsForm();
  if (route === "pwa") updatePwaStatus();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function toast(message) {
  const el = $("#toast");
  el.textContent = message;
  el.classList.add("active");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => el.classList.remove("active"), 2600);
}

function updateConnectionBadge() {
  const badge = $("#connectionBadge");
  const online = navigator.onLine;
  badge.textContent = online ? "Online" : "Offline";
  badge.className = `status-badge ${online ? "online" : "offline"}`;
}

async function updatePwaStatus() {
  const list = $("#pwaStatusList");
  if (!list) return;
  const isFile = window.location.protocol === "file:";
  const isSecure = window.isSecureContext || ["http:", "https:"].includes(window.location.protocol) && window.location.hostname === "127.0.0.1";
  const hasServiceWorker = "serviceWorker" in navigator;
  let registrations = [];
  if (hasServiceWorker && !isFile) {
    try {
      registrations = await navigator.serviceWorker.getRegistrations();
    } catch {
      registrations = [];
    }
  }
  const checks = [
    {
      label: "Opened from hosted/web address",
      ok: !isFile,
      detail: isFile ? "Local file preview. Use GitHub Pages or a local server for PWA testing." : window.location.origin,
    },
    {
      label: "Secure browser context",
      ok: Boolean(isSecure),
      detail: isSecure ? "OK for service worker/install testing." : "Needs HTTPS or localhost/127.0.0.1.",
    },
    {
      label: "Service worker support",
      ok: hasServiceWorker,
      detail: hasServiceWorker ? "Browser supports offline app-shell caching." : "This browser does not support service workers.",
    },
    {
      label: "Service worker registered",
      ok: registrations.length > 0 || Boolean(navigator.serviceWorker?.controller),
      detail: isFile ? "Cannot register from file preview." : `${registrations.length} registration(s) found.`,
    },
    {
      label: "Current connection",
      ok: navigator.onLine,
      detail: navigator.onLine ? "Online: maps/search/sharing should be available." : "Offline: saved plans should remain available after hosted PWA load.",
    },
    {
      label: "Install mode",
      ok: window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true,
      detail: (window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true) ? "Running as installed app." : "Running in browser tab.",
    },
  ];
  list.innerHTML = checks.map((check) => `
    <div class="status-row ${check.ok ? "ok" : "warn"}">
      <strong>${escapeHtml(check.label)}</strong>
      <span>${check.ok ? "OK" : "Check"}</span>
      <p>${escapeHtml(check.detail)}</p>
    </div>
  `).join("");
}

function formToPlan() {
  const id = $("#planId").value || crypto.randomUUID();
  const now = new Date().toISOString();
  return {
    ...emptyPlan(),
    id,
    title: $("#title").value.trim(),
    status: $("#status").value,
    createdAt: $("#planForm").dataset.createdAt || now,
    updatedAt: now,
    creator: $("#creator").value.trim(),
    location: {
      lat: $("#lat").value.trim(),
      lng: $("#lng").value.trim(),
      accuracy: $("#planForm").dataset.accuracy || "",
      capturedAt: $("#planForm").dataset.capturedAt || "",
      manualOverride: Boolean($("#lat").value || $("#lng").value),
      roadAddress: $("#roadAddress").value.trim(),
      town: $("#town").value.trim(),
      county: $("#county").value.trim(),
      state: $("#state").value.trim(),
    },
    access: {
      knownLandmark: $("#knownLandmark").value.trim(),
      phoneDirections: $("#phoneDirections").value.trim(),
      routeNotes: $("#routeNotes").value.trim(),
      gateNotes: $("#gateNotes").value.trim(),
      meetingPoint: $("#meetingPoint").value.trim(),
      alternateMeetingPoint: $("#alternateMeetingPoint").value.trim(),
      landingZoneDescription: $("#landingZoneDescription").value.trim(),
      landingZoneLat: $("#landingZoneLat").value.trim(),
      landingZoneLng: $("#landingZoneLng").value.trim(),
      landingZoneNotes: $("#landingZoneNotes").value.trim(),
    },
    contacts: {
      primaryContact: $("#primaryContact").value.trim(),
      supervisor: $("#supervisor").value.trim(),
      landowner: $("#landowner").value.trim(),
      truckingContact: $("#truckingContact").value.trim(),
    },
    medical: {
      hospital: $("#hospital").value.trim(),
      hospitalDirectionsUrl: $("#hospitalDirectionsUrl").value.trim(),
      urgentCare: $("#urgentCare").value.trim(),
      urgentCareDirectionsUrl: $("#urgentCareDirectionsUrl").value.trim(),
      traumaCenter: $("#traumaCenter").value.trim(),
      traumaDirectionsUrl: $("#traumaDirectionsUrl").value.trim(),
      notes: $("#medicalNotes").value.trim(),
    },
    sar: {
      contacts: $("#sarContacts").value.trim(),
    },
    hazards: $("#hazards").value.trim(),
  };
}

function planToForm(plan) {
  currentPlanId = plan.id;
  $("#planId").value = plan.id;
  $("#planForm").dataset.createdAt = plan.createdAt;
  $("#planForm").dataset.accuracy = plan.location?.accuracy || "";
  $("#planForm").dataset.capturedAt = plan.location?.capturedAt || "";
  $("#title").value = plan.title || "";
  $("#status").value = plan.status || "draft";
  $("#creator").value = plan.creator || "";
  $("#lat").value = plan.location?.lat || "";
  $("#lng").value = plan.location?.lng || "";
  $("#roadAddress").value = plan.location?.roadAddress || "";
  $("#town").value = plan.location?.town || "";
  $("#county").value = plan.location?.county || "";
  $("#state").value = plan.location?.state || "";
  $("#knownLandmark").value = plan.access?.knownLandmark || "";
  $("#phoneDirections").value = plan.access?.phoneDirections || "";
  $("#routeNotes").value = plan.access?.routeNotes || "";
  $("#gateNotes").value = plan.access?.gateNotes || "";
  $("#meetingPoint").value = plan.access?.meetingPoint || "";
  $("#alternateMeetingPoint").value = plan.access?.alternateMeetingPoint || "";
  $("#landingZoneDescription").value = plan.access?.landingZoneDescription || "";
  $("#landingZoneLat").value = plan.access?.landingZoneLat || "";
  $("#landingZoneLng").value = plan.access?.landingZoneLng || "";
  $("#landingZoneNotes").value = plan.access?.landingZoneNotes || "";
  $("#primaryContact").value = plan.contacts?.primaryContact || "";
  $("#supervisor").value = plan.contacts?.supervisor || "";
  $("#landowner").value = plan.contacts?.landowner || "";
  $("#truckingContact").value = plan.contacts?.truckingContact || "";
  $("#hospital").value = plan.medical?.hospital || "";
  $("#hospitalDirectionsUrl").value = plan.medical?.hospitalDirectionsUrl || "";
  $("#urgentCare").value = plan.medical?.urgentCare || "";
  $("#urgentCareDirectionsUrl").value = plan.medical?.urgentCareDirectionsUrl || "";
  $("#traumaCenter").value = plan.medical?.traumaCenter || "";
  $("#traumaDirectionsUrl").value = plan.medical?.traumaDirectionsUrl || "";
  $("#medicalNotes").value = plan.medical?.notes || "";
  $("#sarContacts").value = plan.sar?.contacts || "";
  $("#hazards").value = plan.hazards || "";
  updateGpsStatus(plan);
  updateWoodsContactSuggestion();
  updateEssentialProgress();
  const lat = parseFloat(plan.location?.lat);
  const lng = parseFloat(plan.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) centerSiteMap(lat, lng, Math.max(siteMapState.zoom, 13));
}

async function loadDefaults() {
  const record = await storeGet(SETTINGS_STORE, DEFAULTS_KEY);
  return record?.value || {};
}

function defaultsFromForm() {
  return {
    creator: $("#defaultCreator").value.trim(),
    company: $("#defaultCompany").value.trim(),
    state: $("#defaultState").value.trim(),
    primaryContact: $("#defaultPrimaryContact").value.trim(),
    supervisor: $("#defaultSupervisor").value.trim(),
    truckingContact: $("#defaultTruckingContact").value.trim(),
    sarContacts: $("#defaultSarContacts").value.trim(),
    medicalNotes: $("#defaultMedicalNotes").value.trim(),
  };
}

async function loadDefaultsForm() {
  const defaults = await loadDefaults();
  $("#defaultCreator").value = defaults.creator || "";
  $("#defaultCompany").value = defaults.company || "";
  $("#defaultState").value = defaults.state || "";
  $("#defaultPrimaryContact").value = defaults.primaryContact || "";
  $("#defaultSupervisor").value = defaults.supervisor || "";
  $("#defaultTruckingContact").value = defaults.truckingContact || "";
  $("#defaultSarContacts").value = defaults.sarContacts || "";
  $("#defaultMedicalNotes").value = defaults.medicalNotes || "";
}

function applyDefaultsToPlanObject(plan, defaults) {
  plan.creator ||= defaults.creator || "";
  plan.location = plan.location || {};
  plan.location.state ||= defaults.state || "";
  plan.contacts = plan.contacts || {};
  plan.contacts.primaryContact ||= defaults.primaryContact || "";
  plan.contacts.supervisor ||= defaults.supervisor || "";
  plan.contacts.truckingContact ||= defaults.truckingContact || "";
  plan.sar = plan.sar || {};
  plan.sar.contacts ||= defaults.sarContacts || "";
  plan.medical = plan.medical || {};
  plan.medical.notes ||= defaults.medicalNotes || "";
  return plan;
}

async function newPlanWithDefaults() {
  return applyDefaultsToPlanObject(emptyPlan(), await loadDefaults());
}

function updateGpsStatus(plan = formToPlan()) {
  const loc = plan.location || {};
  const status = $("#gpsStatus");
  if (loc.lat && loc.lng) {
    status.textContent = `GPS set: ${loc.lat}, ${loc.lng}${loc.accuracy ? `, accuracy ${Math.round(loc.accuracy)} meters` : ""}`;
  } else {
    status.textContent = "GPS has not been captured for this plan.";
  }
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lngToTileX(lng, zoom) {
  return ((lng + 180) / 360) * 2 ** zoom * 256;
}

function latToTileY(lat, zoom) {
  const rad = lat * Math.PI / 180;
  return ((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** zoom * 256;
}

function tileXToLng(x, zoom) {
  return x / (2 ** zoom * 256) * 360 - 180;
}

function tileYToLat(y, zoom) {
  const n = Math.PI - 2 * Math.PI * y / (2 ** zoom * 256);
  return (180 / Math.PI) * Math.atan(0.5 * (Math.exp(n) - Math.exp(-n)));
}

function renderSiteMap() {
  const map = $("#siteMap");
  const tiles = $("#mapTiles");
  const marker = $("#mapMarker");
  if (!map || !tiles || !marker) return;

  const width = map.clientWidth || 360;
  const height = map.clientHeight || 260;
  const zoom = siteMapState.zoom;
  const centerX = lngToTileX(siteMapState.centerLng, zoom);
  const centerY = latToTileY(siteMapState.centerLat, zoom);
  const startTileX = Math.floor((centerX - width / 2) / 256) - 1;
  const endTileX = Math.floor((centerX + width / 2) / 256) + 1;
  const startTileY = Math.floor((centerY - height / 2) / 256) - 1;
  const endTileY = Math.floor((centerY + height / 2) / 256) + 1;
  const maxTile = 2 ** zoom;
  const imgs = [];

  for (let x = startTileX; x <= endTileX; x += 1) {
    for (let y = startTileY; y <= endTileY; y += 1) {
      if (y < 0 || y >= maxTile) continue;
      const wrappedX = ((x % maxTile) + maxTile) % maxTile;
      const left = x * 256 - centerX + width / 2;
      const top = y * 256 - centerY + height / 2;
      imgs.push(`<img src="https://tile.openstreetmap.org/${zoom}/${wrappedX}/${y}.png" alt="" style="left:${left}px;top:${top}px">`);
    }
  }
  tiles.innerHTML = imgs.join("");

  const lat = parseFloat($("#lat").value);
  const lng = parseFloat($("#lng").value);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    marker.hidden = false;
    marker.style.left = `${lngToTileX(lng, zoom) - centerX + width / 2}px`;
    marker.style.top = `${latToTileY(lat, zoom) - centerY + height / 2}px`;
  } else {
    marker.hidden = true;
  }
}

function centerSiteMap(lat, lng, zoom = siteMapState.zoom) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  siteMapState.centerLat = clamp(lat, -85, 85);
  siteMapState.centerLng = lng;
  siteMapState.zoom = clamp(zoom, 3, 19);
  renderSiteMap();
}

function setSiteCoordinates(lat, lng, center = true) {
  const safeLat = clamp(lat, -85, 85);
  const safeLng = ((lng + 180) % 360 + 360) % 360 - 180;
  $("#lat").value = safeLat.toFixed(6);
  $("#lng").value = safeLng.toFixed(6);
  $("#planForm").dataset.accuracy = "";
  $("#planForm").dataset.capturedAt = new Date().toISOString();
  updateGpsStatus();
  updateEssentialProgress();
  if (center) centerSiteMap(safeLat, safeLng);
  scheduleAutoSave();
}

function pointToLatLng(clientX, clientY) {
  const map = $("#siteMap");
  const rect = map.getBoundingClientRect();
  const zoom = siteMapState.zoom;
  const centerX = lngToTileX(siteMapState.centerLng, zoom);
  const centerY = latToTileY(siteMapState.centerLat, zoom);
  const worldX = centerX + (clientX - rect.left) - rect.width / 2;
  const worldY = centerY + (clientY - rect.top) - rect.height / 2;
  return {
    lat: tileYToLat(worldY, zoom),
    lng: tileXToLng(worldX, zoom),
  };
}

async function savePlan(plan = formToPlan(), quiet = false) {
  if (!plan.title) plan.title = "Untitled WRSP Plan";
  await storePut(PLAN_STORE, plan);
  currentPlanId = plan.id;
  $("#planId").value = plan.id;
  $("#planForm").dataset.createdAt = plan.createdAt;
  await updatePlanCount();
  await renderContinuePlan();
  if (!quiet) toast("Plan saved on this phone.");
  return plan;
}

function scheduleAutoSave() {
  window.clearTimeout(autoSaveTimer);
  autoSaveTimer = window.setTimeout(async () => {
    const plan = formToPlan();
    if (plan.title || plan.location.lat || plan.access.meetingPoint || plan.contacts.primaryContact) {
      await savePlan(plan, true);
    }
  }, 900);
}

function essentialStatus(plan = formToPlan()) {
  const loc = plan.location || {};
  const hasLocation = Boolean((loc.lat && loc.lng) || loc.roadAddress || loc.town || loc.county);
  const checks = [
    { label: "job/site name", done: Boolean(plan.title) },
    { label: "GPS or location", done: hasLocation },
    { label: "known starting landmark", done: Boolean(plan.access?.knownLandmark) },
    { label: "read-aloud 911 directions", done: Boolean(plan.access?.phoneDirections) },
    { label: "primary job contact", done: Boolean(plan.contacts?.primaryContact || plan.contacts?.supervisor) },
    { label: "local woods emergency contact", done: Boolean(plan.sar?.contacts) },
  ];
  return { checks, done: checks.filter((check) => check.done).length, total: checks.length };
}

function updateEssentialProgress() {
  const progressText = $("#essentialProgressText");
  const progressBar = $("#essentialProgressBar");
  if (!progressText || !progressBar) return;
  const status = essentialStatus();
  progressText.textContent = `${status.done} of ${status.total} plan essentials added`;
  progressBar.style.width = `${(status.done / status.total) * 100}%`;
}

function completenessHint(plan) {
  const status = essentialStatus(plan);
  if (status.done === status.total) {
    return `<p class="complete-hint ready">Field-ready essentials are in place.</p>`;
  }
  const missing = status.checks.find((check) => !check.done);
  return `<button class="complete-hint needs-work" id="completePlanHint">Add ${escapeHtml(missing.label)} to make this plan more field-ready</button>`;
}

async function renderSavedPlans() {
  const plans = await storeAll(PLAN_STORE);
  const list = $("#savedPlansList");
  if (!plans.length) {
    list.innerHTML = `<div class="card"><p class="helper">No saved plans yet. Create a job safety plan to start the local library.</p></div>`;
    return;
  }
  plans.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  list.innerHTML = plans.map((plan) => {
    const location = [plan.location?.town, plan.location?.county, plan.location?.state].filter(Boolean).join(", ");
    return `
      <article class="plan-card">
        <div>
          <h3>${escapeHtml(plan.title || "Untitled WRSP Plan")}</h3>
          <p>${escapeHtml(location || plan.location?.roadAddress || "Location not named")}</p>
          <p><span class="status-pill ${escapeHtml(plan.status || "draft")}">${escapeHtml(plan.status || "draft")}</span> Updated ${formatDate(plan.updatedAt)}</p>
        </div>
        <div class="action-row">
          <button class="primary-action" data-open-plan="${plan.id}">Open</button>
          <button class="primary-action share-inline" data-share-plan="${plan.id}">Share</button>
          <button class="secondary-action quiet-action" data-edit-plan="${plan.id}">Edit</button>
          <button class="secondary-action quiet-action" data-delete-plan="${plan.id}">Delete</button>
        </div>
      </article>`;
  }).join("");
}

async function updatePlanCount() {
  const plans = await storeAll(PLAN_STORE);
  $("#planCount").textContent = `${plans.length} stored`;
}

async function renderContinuePlan() {
  const card = $("#continuePlanCard");
  if (!card) return;
  const plans = await storeAll(PLAN_STORE);
  if (!plans.length) {
    card.hidden = true;
    card.innerHTML = "";
    return;
  }
  plans.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const plan = plans[0];
  const location = [plan.location?.town, plan.location?.county, plan.location?.state].filter(Boolean).join(", ");
  card.hidden = false;
  card.innerHTML = `
    <div>
      <p class="eyebrow">Continue</p>
      <h3>${escapeHtml(plan.title || "Untitled WRSP Plan")}</h3>
      <p>${escapeHtml(location || plan.location?.roadAddress || "Location not named")} - Updated ${formatDate(plan.updatedAt)}</p>
    </div>
    <div class="action-row">
      <button class="primary-action" data-open-plan="${plan.id}">Open</button>
      <button class="primary-action share-inline" data-share-plan="${plan.id}">Share</button>
    </div>`;
}

async function openPlan(id) {
  const plan = await storeGet(PLAN_STORE, id);
  if (!plan) return;
  currentPlanId = id;
  $("#planViewTitle").textContent = plan.title || "WRSP Plan";
  renderCurrentPlan(plan);
  routeTo("plan");
}

function renderCurrentPlan(plan) {
  $("#planOutput").innerHTML = currentPlanMode === "responder" ? renderResponderPlanHtml(plan) : renderPlanHtml(plan);
  $("#fullPlanMode")?.classList.toggle("active", currentPlanMode === "full");
  $("#responderPlanMode")?.classList.toggle("active", currentPlanMode === "responder");
}

function renderPlanHtml(plan) {
  const loc = plan.location || {};
  const mapsLink = loc.lat && loc.lng ? `https://maps.google.com/?q=${encodeURIComponent(`${loc.lat},${loc.lng}`)}` : "";
  const emergencyDirections = buildEmergencyDirections(plan);
  const sections = [
    ["Location", [
      ["GPS", loc.lat && loc.lng ? `${loc.lat}, ${loc.lng}` : "Not set"],
      ["Maps link", mapsLink ? `<a href="${mapsLink}" target="_blank" rel="noopener">Open coordinates in maps</a>` : "Not set"],
      ["Nearest road / address", loc.roadAddress],
      ["Town / county / state", [loc.town, loc.county, loc.state].filter(Boolean).join(", ")],
    ]],
    ["Access", [
      ["Known starting landmark", plan.access?.knownLandmark],
      ["Read-aloud directions", plan.access?.phoneDirections],
      ["Best access route", plan.access?.routeNotes],
      ["Gate / lock / key notes", plan.access?.gateNotes],
      ["Emergency meeting point", plan.access?.meetingPoint],
      ["Alternate meeting point", plan.access?.alternateMeetingPoint],
      ["Possible helicopter landing zone", plan.access?.landingZoneDescription],
      ["Landing zone GPS", plan.access?.landingZoneLat && plan.access?.landingZoneLng ? `${plan.access.landingZoneLat}, ${plan.access.landingZoneLng}` : ""],
      ["Landing zone hazards / notes", plan.access?.landingZoneNotes],
    ]],
    ["Contacts", [
      ["Primary contact", plan.contacts?.primaryContact],
      ["Crew / supervisor", plan.contacts?.supervisor],
      ["Landowner", plan.contacts?.landowner],
      ["Trucking contact", plan.contacts?.truckingContact],
      ["Local woods emergency contacts", plan.sar?.contacts],
    ]],
    ["Medical and hazards", [
      ["Nearest hospital / ER", plan.medical?.hospital],
      ["Hospital / ER directions", plan.medical?.hospitalDirectionsUrl ? `<a href="${escapeHtml(plan.medical.hospitalDirectionsUrl)}" target="_blank" rel="noopener">Open hospital / ER directions</a>` : ""],
      ["Nearest urgent care", plan.medical?.urgentCare],
      ["Urgent care directions", plan.medical?.urgentCareDirectionsUrl ? `<a href="${escapeHtml(plan.medical.urgentCareDirectionsUrl)}" target="_blank" rel="noopener">Open urgent care directions</a>` : ""],
      ["Trauma center / major hospital", plan.medical?.traumaCenter],
      ["Trauma / major hospital directions", plan.medical?.traumaDirectionsUrl ? `<a href="${escapeHtml(plan.medical.traumaDirectionsUrl)}" target="_blank" rel="noopener">Open trauma center directions</a>` : ""],
      ["Medical notes", plan.medical?.notes],
      ["Hazard notes", plan.hazards],
    ]],
  ];
  return `
    <h2>${escapeHtml(plan.title || "WRSP Plan")}</h2>
    ${completenessHint(plan)}
    <p class="warning">WRSP does not contact 911. For serious injury or uncertain severity, call 911 and request EMS.</p>
    <div class="read-aloud">
      <h3>Read to 911 / dispatch</h3>
      <p>${escapeHtml(emergencyDirections)}</p>
    </div>
    <p><strong>Status:</strong> ${escapeHtml(plan.status || "draft")} · <strong>Updated:</strong> ${formatDate(plan.updatedAt)}</p>
    ${sections.map(([title, rows]) => `
      <h3>${title}</h3>
      <dl>${rows.map(([label, value]) => `
        <div>
          <dt>${escapeHtml(label)}</dt>
          <dd>${value ? allowMapLink(value) : "Not entered"}</dd>
        </div>`).join("")}</dl>
    `).join("")}`;
}

function renderResponderPlanHtml(plan) {
  const loc = plan.location || {};
  const access = plan.access || {};
  const mapsLink = loc.lat && loc.lng ? `https://maps.google.com/?q=${encodeURIComponent(`${loc.lat},${loc.lng}`)}` : "";
  const rows = [
    ["GPS coordinates", loc.lat && loc.lng ? `${loc.lat}, ${loc.lng}` : "Not entered"],
    ["Map link", mapsLink ? `<a href="${mapsLink}" target="_blank" rel="noopener">Open site in maps</a>` : "Not entered"],
    ["Read-aloud directions", buildEmergencyDirections(plan)],
    ["Known starting landmark", access.knownLandmark],
    ["Emergency meeting point", access.meetingPoint],
    ["Gate / lock / key notes", access.gateNotes],
    ["Best access / truck route", access.routeNotes],
    ["Primary job contact", plan.contacts?.primaryContact],
    ["Crew / supervisor", plan.contacts?.supervisor],
    ["Local woods emergency contacts", plan.sar?.contacts],
    ["Nearest hospital / ER", plan.medical?.hospital],
    ["Hospital / ER directions", plan.medical?.hospitalDirectionsUrl ? `<a href="${escapeHtml(plan.medical.hospitalDirectionsUrl)}" target="_blank" rel="noopener">Open hospital / ER directions</a>` : ""],
    ["Nearest urgent care", plan.medical?.urgentCare],
    ["Trauma center / major hospital", plan.medical?.traumaCenter],
    ["Trauma / major hospital directions", plan.medical?.traumaDirectionsUrl ? `<a href="${escapeHtml(plan.medical.traumaDirectionsUrl)}" target="_blank" rel="noopener">Open trauma center directions</a>` : ""],
    ["Medical notes", plan.medical?.notes],
    ["Possible helicopter landing zone", access.landingZoneDescription],
    ["Landing zone GPS", access.landingZoneLat && access.landingZoneLng ? `${access.landingZoneLat}, ${access.landingZoneLng}` : ""],
    ["Landing zone hazards / notes", access.landingZoneNotes],
    ["Hazards at or near site", plan.hazards],
  ];
  return `
    <h2>${escapeHtml(plan.title || "WRSP Responder View")}</h2>
    ${completenessHint(plan)}
    <p class="warning strong">WRSP does not contact 911. For serious injury or uncertain severity, call 911 and request EMS.</p>
    <div class="read-aloud">
      <h3>Read to 911 / dispatch</h3>
      <p>${escapeHtml(buildEmergencyDirections(plan))}</p>
    </div>
    <div class="responder-grid">
      ${rows.map(([label, value]) => `
        <section>
          <h3>${escapeHtml(label)}</h3>
          <p>${value ? allowMapLink(value) : "Not entered"}</p>
        </section>
      `).join("")}
    </div>`;
}

function buildEmergencyDirections(plan) {
  const loc = plan.location || {};
  const access = plan.access || {};
  const parts = [];
  parts.push(`The emergency is at ${plan.title || "a logging site"}.`);
  if (loc.lat && loc.lng) parts.push(`GPS coordinates are ${loc.lat}, ${loc.lng}.`);
  if (access.knownLandmark) parts.push(`Start from ${access.knownLandmark}.`);
  if (access.phoneDirections) parts.push(access.phoneDirections);
  if (access.meetingPoint) parts.push(`The emergency meeting point is ${access.meetingPoint}.`);
  if (access.gateNotes) parts.push(`Gate, lock, or access notes: ${access.gateNotes}.`);
  if (access.routeNotes) parts.push(`Additional access notes: ${access.routeNotes}.`);
  if (access.landingZoneDescription || (access.landingZoneLat && access.landingZoneLng)) {
    parts.push(`Possible helicopter landing zone: ${access.landingZoneDescription || "description not entered"}${access.landingZoneLat && access.landingZoneLng ? `; GPS ${access.landingZoneLat}, ${access.landingZoneLng}` : ""}.`);
  }
  if (access.landingZoneNotes) parts.push(`Landing zone hazards or notes: ${access.landingZoneNotes}.`);
  if (plan.sar?.contacts) parts.push(`Local woods emergency contacts or agency notes: ${plan.sar.contacts}.`);
  if (!access.knownLandmark && !access.phoneDirections) {
    parts.push("Directions from a known town, village, highway intersection, or other responder-friendly landmark have not been entered yet.");
  }
  return parts.join(" ");
}

function planShareText(plan) {
  const loc = plan.location || {};
  const mapsLink = loc.lat && loc.lng ? `https://maps.google.com/?q=${encodeURIComponent(`${loc.lat},${loc.lng}`)}` : "No GPS set";
  return [
    `WRSP Safety Plan: ${plan.title || "Untitled"}`,
    `Maps: ${mapsLink}`,
    `Read to 911 / dispatch: ${buildEmergencyDirections(plan)}`,
    `GPS: ${loc.lat && loc.lng ? `${loc.lat}, ${loc.lng}` : "Not set"}`,
    `Status: ${plan.status || "draft"}`,
    `Access: ${plan.access?.routeNotes || "Not entered"}`,
    `Meeting point: ${plan.access?.meetingPoint || "Not entered"}`,
    `Possible helicopter landing zone: ${plan.access?.landingZoneDescription || "Not entered"}`,
    `Landing zone GPS: ${plan.access?.landingZoneLat && plan.access?.landingZoneLng ? `${plan.access.landingZoneLat}, ${plan.access.landingZoneLng}` : "Not entered"}`,
    `Landing zone notes: ${plan.access?.landingZoneNotes || "Not entered"}`,
    `Primary contact: ${plan.contacts?.primaryContact || "Not entered"}`,
    `Crew/supervisor: ${plan.contacts?.supervisor || "Not entered"}`,
    `Local woods emergency contacts: ${plan.sar?.contacts || "Not entered"}`,
    `Hospital/ER: ${plan.medical?.hospital || "Not entered"}`,
    `Hospital/ER directions: ${plan.medical?.hospitalDirectionsUrl || "Not entered"}`,
    `Urgent care: ${plan.medical?.urgentCare || "Not entered"}`,
    `Urgent care directions: ${plan.medical?.urgentCareDirectionsUrl || "Not entered"}`,
    `Trauma center/major hospital: ${plan.medical?.traumaCenter || "Not entered"}`,
    `Trauma center directions: ${plan.medical?.traumaDirectionsUrl || "Not entered"}`,
    `Medical notes: ${plan.medical?.notes || "Not entered"}`,
    `Hazards: ${plan.hazards || "Not entered"}`,
    "For serious injury or uncertain severity, call 911 and request EMS.",
  ].join("\n");
}

async function shareText(title, text) {
  if (navigator.share) {
    await navigator.share({ title, text });
    return;
  }
  await navigator.clipboard.writeText(text);
  toast("Sharing is not available here, so the text was copied.");
}

function exportPackage(plan) {
  return JSON.stringify({
    type: "WRSP_PLAN_EXPORT",
    exportedAt: new Date().toISOString(),
    payload: plan,
  }, null, 2);
}

function compactExportPackage(plan) {
  return JSON.stringify({
    type: "WRSP_PLAN_EXPORT",
    exportedAt: new Date().toISOString(),
    payload: plan,
  });
}

function importUrlForPlan(plan) {
  const baseUrl = window.location.href.split("#")[0];
  return `${baseUrl}#import=${encodeURIComponent(compactExportPackage(plan))}`;
}

function showPlanQr(plan) {
  const panel = $("#qrPanel");
  const image = $("#qrImage");
  const linkBox = $("#qrImportLink");
  const help = $("#qrHelp");
  const importUrl = importUrlForPlan(plan);
  panel.hidden = false;
  linkBox.value = importUrl;
  if (importUrl.length > 2200) {
    image.removeAttribute("src");
    image.hidden = true;
    help.textContent = "This plan is too large for a reliable QR code. Use Export to share the .wrsp.json file instead.";
    return;
  }
  image.hidden = false;
  image.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(importUrl)}`;
  help.textContent = "Scan this code to open/import the plan. Best used from the hosted WRSP app, not the local file preview.";
}

function safeFileName(value = "wrsp-plan") {
  const cleaned = value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  return cleaned || "wrsp-plan";
}

function downloadPlanExport(plan) {
  const blob = new Blob([exportPackage(plan)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${safeFileName(plan.title)}.wrsp.json`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function sharePlanExportFile(plan) {
  const fileName = `${safeFileName(plan.title)}.wrsp.json`;
  const file = new File([exportPackage(plan)], fileName, { type: "application/json" });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({
      title: `WRSP export: ${plan.title || "Safety Plan"}`,
      text: "WRSP importable safety plan export.",
      files: [file],
    });
    return true;
  }
  return false;
}

function parsePlanExport(raw) {
  const parsed = JSON.parse(raw);
  return parsed.type === "WRSP_PLAN_EXPORT" ? parsed.payload : parsed;
}

async function saveImportedPlanFromPayload(payload) {
  const imported = {
    ...emptyPlan(),
    ...payload,
    id: crypto.randomUUID(),
    title: `${payload.title || "Imported WRSP Plan"} copy`,
    importedFrom: payload.id || "shared export",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await savePlan(imported, true);
  await openPlan(imported.id);
  return imported;
}

async function importFromUrlHash() {
  if (!window.location.hash.startsWith("#import=")) return;
  try {
    const raw = decodeURIComponent(window.location.hash.slice("#import=".length));
    const payload = parsePlanExport(raw);
    await saveImportedPlanFromPayload(payload);
    history.replaceState(null, "", window.location.pathname + window.location.search);
    toast("Shared WRSP plan imported.");
  } catch (error) {
    toast(`Import link failed: ${error.message}`);
  }
}

function getCurrentPosition() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error("Geolocation is not available in this browser."));
      return;
    }
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      enableHighAccuracy: true,
      timeout: 12000,
      maximumAge: 10000,
    });
  });
}

async function capturePlanGps() {
  $("#gpsStatus").textContent = "Capturing GPS...";
  try {
    const position = await getCurrentPosition();
    $("#planForm").dataset.accuracy = String(position.coords.accuracy || "");
    $("#planForm").dataset.capturedAt = new Date(position.timestamp).toISOString();
    $("#lat").value = position.coords.latitude.toFixed(6);
    $("#lng").value = position.coords.longitude.toFixed(6);
    updateGpsStatus();
    updateEssentialProgress();
    centerSiteMap(position.coords.latitude, position.coords.longitude, 15);
    scheduleAutoSave();
  } catch (error) {
    $("#gpsStatus").textContent = `GPS unavailable: ${error.message}`;
  }
}

async function refreshEmergencyGps() {
  $("#emergencyGps").textContent = "Capturing GPS...";
  try {
    const position = await getCurrentPosition();
    emergencyCoords = {
      lat: position.coords.latitude.toFixed(6),
      lng: position.coords.longitude.toFixed(6),
      accuracy: Math.round(position.coords.accuracy || 0),
    };
    $("#emergencyGps").textContent = `${emergencyCoords.lat}, ${emergencyCoords.lng} · accuracy about ${emergencyCoords.accuracy} meters`;
  } catch (error) {
    $("#emergencyGps").textContent = `GPS unavailable: ${error.message}`;
  }
}

function locationShareText() {
  if (!emergencyCoords) return "";
  const coords = `${emergencyCoords.lat},${emergencyCoords.lng}`;
  return `My current WRSP location is ${emergencyCoords.lat}, ${emergencyCoords.lng}. Map: https://maps.google.com/?q=${coords}`;
}

function mapSearch(query) {
  const origin = $("#medicalSearchOrigin").value.trim();
  const fullQuery = origin ? `${query} near ${origin}` : `${query} near me`;
  openMapsSearch(fullQuery);
}

async function saveMedicalFacilityToCurrentPlan() {
  if (!currentPlanId) {
    $("#medicalSaveStatus").textContent = "Open or create a plan first, then save facility information.";
    return;
  }
  const plan = await storeGet(PLAN_STORE, currentPlanId);
  const type = $("#medicalFacilityType").value;
  const details = $("#medicalFacilityDetails").value.trim();
  const directionsUrl = $("#medicalFacilityDirectionsUrl").value.trim();
  plan.medical = plan.medical || {};
  if (type === "hospital") {
    plan.medical.hospital = details;
    plan.medical.hospitalDirectionsUrl = directionsUrl;
  }
  if (type === "urgentCare") {
    plan.medical.urgentCare = details;
    plan.medical.urgentCareDirectionsUrl = directionsUrl;
  }
  if (type === "traumaCenter") {
    plan.medical.traumaCenter = details;
    plan.medical.traumaDirectionsUrl = directionsUrl;
  }
  plan.updatedAt = new Date().toISOString();
  await storePut(PLAN_STORE, plan);
  planToForm(plan);
  $("#medicalSaveStatus").textContent = "Saved to the current plan.";
  await renderContinuePlan();
}

async function prefillMedicalOrigin() {
  const input = $("#medicalSearchOrigin");
  if (!input || input.value.trim() || !currentPlanId) return;
  const plan = await storeGet(PLAN_STORE, currentPlanId);
  const loc = plan?.location || {};
  if (loc.lat && loc.lng) {
    input.value = `${loc.lat}, ${loc.lng}`;
    return;
  }
  input.value = [loc.town, loc.county, loc.state].filter(Boolean).join(", ");
}

function openMapsSearch(query) {
  window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`, "_blank", "noopener");
}

function openWebSearch(query) {
  window.open(`https://www.google.com/search?q=${encodeURIComponent(query)}`, "_blank", "noopener");
}

function stateCodeFromInput(value = "") {
  const cleaned = value.trim().toLowerCase();
  if (!cleaned) return "";
  const upper = cleaned.toUpperCase();
  if (STATE_WOODS_AGENCIES[upper]) return upper;
  return STATE_NAME_TO_CODE[cleaned] || "";
}

function stateAgencyForPlan(plan = formToPlan()) {
  const code = stateCodeFromInput(plan.location?.state || "");
  return {
    code,
    agency: code ? STATE_WOODS_AGENCIES[code] : "",
  };
}

function planSearchOrigin() {
  const plan = formToPlan();
  const loc = plan.location || {};
  const named = [loc.county && `${loc.county} County`, loc.town, loc.state].filter(Boolean).join(", ");
  return named || loc.roadAddress || "";
}

function updateWoodsContactSuggestion() {
  const plan = formToPlan();
  const origin = planSearchOrigin();
  const { agency } = stateAgencyForPlan(plan);
  const suggestion = $("#woodsContactSuggestion");
  if (!origin && !agency) {
    suggestion.textContent = "Enter the site state plus county or town first. WRSP will suggest the likely woods agency and build targeted searches.";
    return;
  }
  if (agency) {
    suggestion.textContent = `Likely state starting point: ${agency}. Use the buttons to look for the correct district, county contact, dispatch number, ranger, warden, or local responder for ${origin || "this site"}.`;
    return;
  }
  suggestion.textContent = `Use the buttons to search for local responder contacts for ${origin}. Add the state for a better state-agency suggestion.`;
}

function localResponderSearch(kind) {
  const plan = formToPlan();
  const origin = planSearchOrigin();
  const { agency } = stateAgencyForPlan(plan);
  if (!origin && !agency) {
    toast("Add state plus county or town first.");
    return;
  }
  const loc = plan.location || {};
  const county = loc.county ? `${loc.county} County` : "";
  const state = loc.state || "";
  const place = [county, loc.town, state].filter(Boolean).join(" ");
  const queries = {
    stateWoods: `${agency || "state forestry forest ranger game warden"} ${place} district contact phone dispatch`,
    sheriffSar: `${place} sheriff dispatch search and rescue emergency phone`,
    fireRescue: `${place} fire rescue district non emergency dispatch logging woods access`,
    emergencyManagement: `${place} emergency management contact phone`,
  };
  openWebSearch(queries[kind]);
}

function formatPickedContact(contact) {
  const name = Array.isArray(contact.name) ? contact.name[0] : contact.name;
  const tel = Array.isArray(contact.tel) ? contact.tel[0] : contact.tel;
  const email = Array.isArray(contact.email) ? contact.email[0] : contact.email;
  return [name, tel, email].filter(Boolean).join(" - ");
}

async function chooseContactForField(fieldId) {
  const target = $(`#${fieldId}`);
  if (!target) return;
  if (!("contacts" in navigator) || !navigator.contacts?.select) {
    toast("This browser does not allow WRSP to pick from phone contacts. Type or paste the contact instead.");
    return;
  }
  try {
    const contacts = await navigator.contacts.select(["name", "tel", "email"], { multiple: false });
    if (!contacts?.length) return;
    const formatted = formatPickedContact(contacts[0]);
    if (!formatted) {
      toast("No usable contact details were selected.");
      return;
    }
    target.value = formatted;
    updateEssentialProgress();
    scheduleAutoSave();
    toast("Contact added to this plan.");
  } catch (error) {
    if (error.name !== "AbortError") toast("Contact picker was not available.");
  }
}

async function loadPreparedness() {
  const record = await storeGet(SETTINGS_STORE, PREPAREDNESS_KEY);
  const profile = record?.value || {};
  ["companyInfo", "trustedContacts", "emergencyContacts", "insuranceInfo", "airMedicalNotes", "firstAidChecklist", "equipmentChecklist", "regularWorkAreas"].forEach((id) => {
    $(`#${id}`).value = profile[id] || "";
  });
}

function preparednessText() {
  return [
    "WRSP Preparedness Profile",
    `Company: ${$("#companyInfo").value || "Not entered"}`,
    `Trusted contacts: ${$("#trustedContacts").value || "Not entered"}`,
    `Emergency contacts: ${$("#emergencyContacts").value || "Not entered"}`,
    `Insurance: ${$("#insuranceInfo").value || "Not entered"}`,
    `Air medical notes: ${$("#airMedicalNotes").value || "Not entered"}`,
    `First aid / trauma kit: ${$("#firstAidChecklist").value || "Not entered"}`,
    `Fire extinguisher / spill kit: ${$("#equipmentChecklist").value || "Not entered"}`,
    `Regular work areas: ${$("#regularWorkAreas").value || "Not entered"}`,
    "Share this preparedness information before an emergency with someone you trust. In an emergency, call 911 first unless local procedures say otherwise.",
  ].join("\n");
}

function feedbackText() {
  const type = $("#feedbackType").value;
  const message = $("#feedbackMessage").value.trim();
  const contact = $("#feedbackContact").value.trim();
  const lines = [
    `WRSP Feedback Type: ${type}`,
    "",
    "Message:",
    message || "(No message entered)",
  ];
  if (contact) {
    lines.push("", `Reply contact: ${contact}`);
  }
  if ($("#feedbackIncludeInfo").checked) {
    lines.push(
      "",
      "Basic app/browser info:",
      `URL: ${window.location.href}`,
      `Online: ${navigator.onLine ? "yes" : "no"}`,
      `User agent: ${navigator.userAgent}`,
      `Screen: ${window.innerWidth} x ${window.innerHeight}`,
      `Time: ${new Date().toISOString()}`
    );
  }
  return lines.join("\n");
}

function openFeedbackEmail() {
  const body = feedbackText();
  const subject = `WRSP ${$("#feedbackType").value}`;
  window.location.href = `mailto:${FEEDBACK_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;",
  }[char]));
}

function allowMapLink(value) {
  const text = String(value);
  if (text.startsWith("<a ")) return text;
  return escapeHtml(text);
}

function formatDate(value) {
  if (!value) return "unknown";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function bindEvents() {
  $$("[data-route]").forEach((button) => button.addEventListener("click", async () => {
    if (button.dataset.route === "create" && !$("#planId").value) {
      planToForm(await newPlanWithDefaults());
    }
    routeTo(button.dataset.route);
  }));
  $("#planForm").addEventListener("input", () => {
    scheduleAutoSave();
    updateEssentialProgress();
  });
  ["state", "county", "town", "roadAddress"].forEach((id) => {
    $(`#${id}`).addEventListener("input", updateWoodsContactSuggestion);
  });
  ["lat", "lng"].forEach((id) => {
    $(`#${id}`).addEventListener("change", () => {
      const lat = parseFloat($("#lat").value);
      const lng = parseFloat($("#lng").value);
      if (Number.isFinite(lat) && Number.isFinite(lng)) centerSiteMap(lat, lng, Math.max(siteMapState.zoom, 13));
    });
  });
  $("#planForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await savePlan();
    await openPlan(currentPlanId);
  });
  $("#newBlankPlan").addEventListener("click", async () => {
    planToForm(await newPlanWithDefaults());
    routeTo("create");
    toast("New plan ready.");
  });
  $("#openSamplePlan").addEventListener("click", async () => {
    const plan = samplePlan();
    await savePlan(plan, true);
    await openPlan(plan.id);
    toast("Sample plan opened.");
  });
  $("#openSamplePlanMore").addEventListener("click", async () => {
    const plan = samplePlan();
    await savePlan(plan, true);
    await openPlan(plan.id);
    toast("Sample plan opened.");
  });
  $("#captureGps").addEventListener("click", capturePlanGps);
  $$(".contact-picker").forEach((button) => {
    button.addEventListener("click", () => chooseContactForField(button.dataset.contactTarget));
  });
  $("#useSiteForLandingZone").addEventListener("click", () => {
    const lat = $("#lat").value.trim();
    const lng = $("#lng").value.trim();
    if (!lat || !lng) {
      toast("Select the site point first.");
      return;
    }
    $("#landingZoneLat").value = lat;
    $("#landingZoneLng").value = lng;
    scheduleAutoSave();
    toast("Landing zone coordinates copied from site point.");
  });
  $("#mapZoomIn").addEventListener("click", () => {
    siteMapState.zoom = clamp(siteMapState.zoom + 1, 3, 19);
    renderSiteMap();
  });
  $("#mapZoomOut").addEventListener("click", () => {
    siteMapState.zoom = clamp(siteMapState.zoom - 1, 3, 19);
    renderSiteMap();
  });
  $("#siteMap").addEventListener("pointerdown", (event) => {
    const map = $("#siteMap");
    map.setPointerCapture(event.pointerId);
    siteMapState.dragging = true;
    siteMapState.moved = 0;
    siteMapState.dragStart = { x: event.clientX, y: event.clientY };
    siteMapState.startCenter = {
      x: lngToTileX(siteMapState.centerLng, siteMapState.zoom),
      y: latToTileY(siteMapState.centerLat, siteMapState.zoom),
    };
  });
  $("#siteMap").addEventListener("pointermove", (event) => {
    if (!siteMapState.dragging) return;
    const dx = event.clientX - siteMapState.dragStart.x;
    const dy = event.clientY - siteMapState.dragStart.y;
    siteMapState.moved = Math.max(siteMapState.moved, Math.abs(dx), Math.abs(dy));
    const centerX = siteMapState.startCenter.x - dx;
    const centerY = siteMapState.startCenter.y - dy;
    siteMapState.centerLng = tileXToLng(centerX, siteMapState.zoom);
    siteMapState.centerLat = clamp(tileYToLat(centerY, siteMapState.zoom), -85, 85);
    renderSiteMap();
  });
  $("#siteMap").addEventListener("pointerup", (event) => {
    const map = $("#siteMap");
    if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
    const wasTap = siteMapState.moved < 8;
    siteMapState.dragging = false;
    if (wasTap) {
      const picked = pointToLatLng(event.clientX, event.clientY);
      setSiteCoordinates(picked.lat, picked.lng, false);
      renderSiteMap();
    }
  });
  window.addEventListener("resize", renderSiteMap);
  $("#previewPlan").addEventListener("click", async () => {
    await savePlan(formToPlan(), true);
    toast("Draft saved. Keep editing when ready.");
  });
  $("#savedPlansList").addEventListener("click", async (event) => {
    const openId = event.target.dataset.openPlan;
    const shareId = event.target.dataset.sharePlan;
    const editId = event.target.dataset.editPlan;
    const deleteId = event.target.dataset.deletePlan;
    if (openId) await openPlan(openId);
    if (shareId) {
      const plan = await storeGet(PLAN_STORE, shareId);
      await shareText(`WRSP: ${plan.title}`, planShareText(plan));
    }
    if (editId) {
      const plan = await storeGet(PLAN_STORE, editId);
      planToForm(plan);
      routeTo("create");
    }
    if (deleteId && confirm("Delete this plan from this phone?")) {
      await storeDelete(PLAN_STORE, deleteId);
      await renderSavedPlans();
      await updatePlanCount();
    }
  });
  $("#continuePlanCard").addEventListener("click", async (event) => {
    const openId = event.target.dataset.openPlan;
    const shareId = event.target.dataset.sharePlan;
    if (openId) await openPlan(openId);
    if (shareId) {
      const plan = await storeGet(PLAN_STORE, shareId);
      await shareText(`WRSP: ${plan.title}`, planShareText(plan));
    }
  });
  $("#editCurrentPlan").addEventListener("click", async () => {
    if (!currentPlanId) return;
    const plan = await storeGet(PLAN_STORE, currentPlanId);
    planToForm(plan);
    routeTo("create");
  });
  $("#fullPlanMode").addEventListener("click", async () => {
    currentPlanMode = "full";
    if (currentPlanId) renderCurrentPlan(await storeGet(PLAN_STORE, currentPlanId));
  });
  $("#responderPlanMode").addEventListener("click", async () => {
    currentPlanMode = "responder";
    if (currentPlanId) renderCurrentPlan(await storeGet(PLAN_STORE, currentPlanId));
  });
  $("#planOutput").addEventListener("click", async (event) => {
    if (event.target.id !== "completePlanHint" || !currentPlanId) return;
    const plan = await storeGet(PLAN_STORE, currentPlanId);
    planToForm(plan);
    routeTo("create");
  });
  $("#shareCurrentPlan").addEventListener("click", async () => {
    const plan = await storeGet(PLAN_STORE, currentPlanId);
    await shareText(`WRSP: ${plan.title}`, planShareText(plan));
  });
  $("#qrCurrentPlan").addEventListener("click", async () => {
    if (!currentPlanId) return;
    showPlanQr(await storeGet(PLAN_STORE, currentPlanId));
  });
  $("#copyQrLink").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#qrImportLink").value);
    toast("Import link copied.");
  });
  $("#exportCurrentPlan").addEventListener("click", async () => {
    const plan = await storeGet(PLAN_STORE, currentPlanId);
    try {
      if (await sharePlanExportFile(plan)) {
        toast("WRSP export shared.");
        return;
      }
    } catch {
      // Fall through to download when file sharing is unavailable or canceled.
    }
    downloadPlanExport(plan);
    toast("WRSP export file downloaded.");
  });
  $("#duplicateCurrentPlan").addEventListener("click", async () => {
    const plan = await storeGet(PLAN_STORE, currentPlanId);
    const copy = {
      ...structuredClone(plan),
      id: crypto.randomUUID(),
      title: `${plan.title || "WRSP Plan"} copy`,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await savePlan(copy);
    await openPlan(copy.id);
  });
  $("#printCurrentPlan").addEventListener("click", async () => {
    if (currentPlanId) {
      currentPlanMode = "responder";
      renderCurrentPlan(await storeGet(PLAN_STORE, currentPlanId));
    }
    window.print();
  });
  $("#refreshEmergencyGps").addEventListener("click", refreshEmergencyGps);
  $("#shareLocation").addEventListener("click", async () => {
    if (!emergencyCoords) await refreshEmergencyGps();
    if (emergencyCoords) await shareText("WRSP current location", locationShareText());
  });
  $("#copyLocation").addEventListener("click", async () => {
    if (!emergencyCoords) await refreshEmergencyGps();
    if (emergencyCoords) {
      await navigator.clipboard.writeText(`${emergencyCoords.lat}, ${emergencyCoords.lng}`);
      toast("GPS copied.");
    }
  });
  $("#openMaps").addEventListener("click", async () => {
    if (!emergencyCoords) await refreshEmergencyGps();
    if (emergencyCoords) window.open(`https://maps.google.com/?q=${emergencyCoords.lat},${emergencyCoords.lng}`, "_blank", "noopener");
  });
  $("#medicalUseGps").addEventListener("click", async () => {
    const position = await getCurrentPosition();
    $("#medicalSearchOrigin").value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
  });
  $("#refreshPwaStatus").addEventListener("click", updatePwaStatus);
  $("#saveMedicalFacilityToPlan").addEventListener("click", saveMedicalFacilityToCurrentPlan);
  $("#findEr").addEventListener("click", () => mapSearch("emergency room hospital"));
  $("#findUrgentCare").addEventListener("click", () => mapSearch("urgent care"));
  $("#findTrauma").addEventListener("click", () => mapSearch("trauma center hospital"));
  $("#findStateWoodsAgency").addEventListener("click", () => localResponderSearch("stateWoods"));
  $("#findFireRescue").addEventListener("click", () => localResponderSearch("fireRescue"));
  $("#findSheriffSar").addEventListener("click", () => localResponderSearch("sheriffSar"));
  $("#findEmergencyManagement").addEventListener("click", () => localResponderSearch("emergencyManagement"));
  $("#preparednessForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const value = {};
    ["companyInfo", "trustedContacts", "emergencyContacts", "insuranceInfo", "airMedicalNotes", "firstAidChecklist", "equipmentChecklist", "regularWorkAreas"].forEach((id) => {
      value[id] = $(`#${id}`).value.trim();
    });
    await storePut(SETTINGS_STORE, { key: PREPAREDNESS_KEY, value });
    toast("Preparedness saved on this phone.");
  });
  $("#sharePreparedness").addEventListener("click", async () => shareText("WRSP preparedness", preparednessText()));
  $("#defaultsForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    await storePut(SETTINGS_STORE, { key: DEFAULTS_KEY, value: defaultsFromForm() });
    $("#defaultsStatus").textContent = "Defaults saved on this phone.";
  });
  $("#applyDefaultsToPlan").addEventListener("click", async () => {
    const plan = applyDefaultsToPlanObject(formToPlan(), await loadDefaults());
    planToForm(plan);
    scheduleAutoSave();
    $("#defaultsStatus").textContent = "Defaults applied to the current plan.";
  });
  $("#feedbackForm").addEventListener("submit", (event) => {
    event.preventDefault();
    if (!$("#feedbackMessage").value.trim()) {
      $("#feedbackStatus").textContent = "Add a short message before sending feedback.";
      return;
    }
    openFeedbackEmail();
    $("#feedbackStatus").textContent = "Email draft opened. Review it before sending.";
  });
  $("#copyFeedback").addEventListener("click", async () => {
    await navigator.clipboard.writeText(feedbackText());
    $("#feedbackStatus").textContent = "Feedback text copied.";
  });
  $("#importFilePlan").addEventListener("click", async () => {
    try {
      const file = $("#importFile").files?.[0];
      if (!file) {
        $("#importStatus").textContent = "Choose a WRSP export file first.";
        return;
      }
      const payload = parsePlanExport(await file.text());
      await saveImportedPlanFromPayload(payload);
      $("#importStatus").textContent = "Imported and saved as a new local plan.";
    } catch (error) {
      $("#importStatus").textContent = `Import failed: ${error.message}`;
    }
  });
  $("#importPlan").addEventListener("click", async () => {
    try {
      const payload = parsePlanExport($("#importText").value);
      await saveImportedPlanFromPayload(payload);
      $("#importStatus").textContent = "Imported and saved as a new local plan.";
    } catch (error) {
      $("#importStatus").textContent = `Import failed: ${error.message}`;
    }
  });
  window.addEventListener("online", updateConnectionBadge);
  window.addEventListener("offline", updateConnectionBadge);
  window.addEventListener("online", updatePwaStatus);
  window.addEventListener("offline", updatePwaStatus);
}

async function initServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      await navigator.serviceWorker.register("service-worker.js");
      await updatePwaStatus();
    } catch (error) {
      console.warn("Service worker registration failed", error);
    }
  }
}

async function init() {
  db = await openDb();
  bindEvents();
  updateConnectionBadge();
  await updatePlanCount();
  planToForm(await newPlanWithDefaults());
  await renderContinuePlan();
  updateEssentialProgress();
  await importFromUrlHash();
  await initServiceWorker();
}

init();

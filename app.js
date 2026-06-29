const DB_NAME = "wrsp-db";
const DB_VERSION = 1;
const PLAN_STORE = "plans";
const SETTINGS_STORE = "settings";
const PREPAREDNESS_KEY = "preparedness";
const DEFAULTS_KEY = "defaults";
const SAFETY_SHARE_KEY = "safetyShare";
const MEDICAL_CARD_KEY = "medicalCard";
const APP_VERSION = "WRSP v0.7.4 - June 29, 2026";
const FEEDBACK_EMAIL = "steve@northeastforests.com";

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => Array.from(document.querySelectorAll(selector));

let db;
let currentPlanId = null;
let currentPlanMode = "full";
let sharedPlanPreview = null;
let sharedMedicalCardPreview = null;
let emergencyCoords = null;
let autoSaveTimer = null;
let deferredInstallPrompt = null;
let updateReloading = false;
let siteMapState = {
  centerLat: 39.5,
  centerLng: -98.35,
  zoom: 4,
  dragging: false,
  dragStart: null,
  startCenter: null,
  moved: 0,
};
let landingZoneMapState = {
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

function getDeviceType() {
  const ua = navigator.userAgent || navigator.vendor || window.opera || "";
  if (/iPad|iPhone|iPod/.test(ua)) return "ios";
  if (/android/i.test(ua)) return "android";
  return "other";
}

const liveLocationLauncherOptions = {
  ios: [
    {
      id: "ios-messages",
      platform: "iPhone",
      label: "Open iPhone Messages",
      href: "sms:{phone}",
      instructions: "Open your trusted contact, tap +, choose Location, then Share and select a time limit.",
    },
    {
      id: "ios-findmy",
      platform: "iPhone",
      label: "Open Find My",
      href: "findmy://",
      instructions: "Tap People, tap +, choose Share My Location, select your trusted contact, and choose a duration.",
      fallback: "If Find My does not open, open the Find My app manually.",
    },
  ],
  android: [
    {
      id: "android-google-maps",
      platform: "Android",
      label: "Open Google Maps",
      href: "https://www.google.com/maps",
      instructions: "Tap your profile picture, choose Location sharing, tap New share, choose a duration, and select your trusted contact.",
    },
    {
      id: "android-sms",
      platform: "Android",
      label: "Text Trusted Contact",
      href: "sms:{phone}?body={encodedMessage}",
      instructions: "Send this text, then use Google Maps Location Sharing to share live location.",
    },
  ],
  other: [
    {
      id: "other-google-maps",
      platform: "Other",
      label: "Open Google Maps",
      href: "https://www.google.com/maps",
      instructions: "Use Google Maps Location Sharing if available, or send the WRSP Safety Page instead.",
    },
  ],
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
    source: "",
    manualOverride: false,
    roadAddress: "",
    town: "",
    county: "",
    state: "",
  },
  access: {
    knownLandmark: "",
    phoneDirections: "",
    phoneServiceNotes: "",
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
    foresterContact: "",
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
    verifiedAgency: "",
    verifiedPhone: "",
    verifiedPerson: "",
    verifiedSource: "",
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
      source: "map pin",
      manualOverride: true,
      roadAddress: "Ridge Road landing, 2.4 miles north of Mill Creek Road",
      town: "Sample Town",
      county: "Sample County",
      state: "State",
    },
    access: {
      knownLandmark: "Intersection of State Route 8 and County Route 14 in Sample Town",
      phoneDirections: "From the Route 8 / County Route 14 intersection, travel north on County Route 14 for 3.2 miles. Turn right on Ridge Road. Continue 2.4 miles to the locked green gate. The emergency meeting point is the wide landing immediately beyond the gate.",
      phoneServiceNotes: "Mobile phone service is available near the landing and weak beyond the green gate.",
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
      primaryContact: "Logger - 555-0101",
      supervisor: "Crew members - 555-0102",
      foresterContact: "Forester - 555-0105",
      landowner: "Landowners - 555-0103",
      truckingContact: "Truck coordinator - 555-0104",
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
      verifiedAgency: "Sample County Dispatch",
      verifiedPhone: "555-0300",
      verifiedPerson: "Dispatcher / SAR coordinator",
      verifiedSource: "Sample verification note",
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
  if (route === "create") {
    window.setTimeout(() => {
      renderSiteMap();
      renderLandingZoneMap();
    }, 50);
  }
  if (route === "medical") prefillMedicalOrigin();
  if (route === "medicalCard") {
    if (sharedMedicalCardPreview) {
      medicalCardToForm(sharedMedicalCardPreview);
      renderMedicalCardOutput(sharedMedicalCardPreview);
    } else {
      loadMedicalCard();
    }
  }
  if (route === "safetyShare") updateSafetyShareScreen();
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
  badge.textContent = online ? "Connected" : "Offline";
  badge.className = `status-badge ${online ? "online" : "offline"}`;
}

async function updatePwaStatus() {
  const list = $("#pwaStatusList");
  const version = $("#appVersionLabel");
  if (version) version.textContent = APP_VERSION;
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
      source: $("#planForm").dataset.locationSource || "",
      manualOverride: Boolean($("#lat").value || $("#lng").value),
      roadAddress: $("#roadAddress").value.trim(),
      town: $("#town").value.trim(),
      county: $("#county").value.trim(),
      state: $("#state").value.trim(),
    },
    access: {
      knownLandmark: $("#knownLandmark").value.trim(),
      phoneDirections: $("#phoneDirections").value.trim(),
      phoneServiceNotes: $("#phoneServiceNotes").value.trim(),
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
      foresterContact: $("#foresterContact").value.trim(),
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
      verifiedAgency: $("#verifiedResponderAgency").value.trim(),
      verifiedPhone: $("#verifiedResponderPhone").value.trim(),
      verifiedPerson: $("#verifiedResponderPerson").value.trim(),
      verifiedSource: $("#verifiedResponderSource").value.trim(),
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
  $("#planForm").dataset.locationSource = plan.location?.source || "";
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
  $("#phoneServiceNotes").value = plan.access?.phoneServiceNotes || "";
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
  $("#foresterContact").value = plan.contacts?.foresterContact || "";
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
  $("#verifiedResponderAgency").value = plan.sar?.verifiedAgency || "";
  $("#verifiedResponderPhone").value = plan.sar?.verifiedPhone || "";
  $("#verifiedResponderPerson").value = plan.sar?.verifiedPerson || "";
  $("#verifiedResponderSource").value = plan.sar?.verifiedSource || "";
  $("#hazards").value = plan.hazards || "";
  updateGpsStatus(plan);
  updateWoodsContactSuggestion();
  updateEssentialProgress();
  const lat = parseFloat(plan.location?.lat);
  const lng = parseFloat(plan.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) centerSiteMap(lat, lng, Math.max(siteMapState.zoom, 17));
  const lzLat = parseFloat(plan.access?.landingZoneLat);
  const lzLng = parseFloat(plan.access?.landingZoneLng);
  if (Number.isFinite(lzLat) && Number.isFinite(lzLng)) {
    centerLandingZoneMap(lzLat, lzLng, Math.max(landingZoneMapState.zoom, 17));
  } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
    centerLandingZoneMap(lat, lng, Math.max(landingZoneMapState.zoom, 15));
  } else {
    renderLandingZoneMap();
  }
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
    foresterContact: $("#defaultForesterContact").value.trim(),
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
  $("#defaultForesterContact").value = defaults.foresterContact || "";
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
  plan.contacts.foresterContact ||= defaults.foresterContact || "";
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
    const source = loc.source || $("#planForm").dataset.locationSource || "coordinates";
    status.textContent = `Exact coordinates set from ${source}: ${loc.lat}, ${loc.lng}${loc.accuracy ? `, accuracy about ${Math.round(loc.accuracy)} meters` : ""}`;
  } else {
    status.textContent = "Exact coordinates have not been set. Use phone GPS or drop a map pin.";
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

function renderCoordinateMap({ state, mapSelector, tilesSelector, markerSelector, latSelector, lngSelector }) {
  const map = $(mapSelector);
  const tiles = $(tilesSelector);
  const marker = $(markerSelector);
  if (!map || !tiles || !marker) return;

  const width = map.clientWidth || 360;
  const height = map.clientHeight || 260;
  const zoom = state.zoom;
  const centerX = lngToTileX(state.centerLng, zoom);
  const centerY = latToTileY(state.centerLat, zoom);
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

  const lat = parseFloat($(latSelector).value);
  const lng = parseFloat($(lngSelector).value);
  if (Number.isFinite(lat) && Number.isFinite(lng)) {
    marker.hidden = false;
    marker.style.left = `${lngToTileX(lng, zoom) - centerX + width / 2}px`;
    marker.style.top = `${latToTileY(lat, zoom) - centerY + height / 2}px`;
  } else {
    marker.hidden = true;
  }
}

function renderSiteMap() {
  renderCoordinateMap({
    state: siteMapState,
    mapSelector: "#siteMap",
    tilesSelector: "#mapTiles",
    markerSelector: "#mapMarker",
    latSelector: "#lat",
    lngSelector: "#lng",
  });
}

function renderLandingZoneMap() {
  renderCoordinateMap({
    state: landingZoneMapState,
    mapSelector: "#landingZoneMap",
    tilesSelector: "#landingZoneMapTiles",
    markerSelector: "#landingZoneMapMarker",
    latSelector: "#landingZoneLat",
    lngSelector: "#landingZoneLng",
  });
}

function centerSiteMap(lat, lng, zoom = siteMapState.zoom) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  siteMapState.centerLat = clamp(lat, -85, 85);
  siteMapState.centerLng = lng;
  siteMapState.zoom = clamp(zoom, 3, 19);
  renderSiteMap();
}

function centerLandingZoneMap(lat, lng, zoom = landingZoneMapState.zoom) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
  landingZoneMapState.centerLat = clamp(lat, -85, 85);
  landingZoneMapState.centerLng = lng;
  landingZoneMapState.zoom = clamp(zoom, 3, 19);
  renderLandingZoneMap();
}

function setSiteCoordinates(lat, lng, center = true) {
  const safeLat = clamp(lat, -85, 85);
  const safeLng = ((lng + 180) % 360 + 360) % 360 - 180;
  $("#lat").value = safeLat.toFixed(6);
  $("#lng").value = safeLng.toFixed(6);
  $("#planForm").dataset.accuracy = "";
  $("#planForm").dataset.capturedAt = new Date().toISOString();
  $("#planForm").dataset.locationSource = "map pin";
  updateGpsStatus();
  updateEssentialProgress();
  if (center) centerSiteMap(safeLat, safeLng);
  scheduleAutoSave();
}

function setLandingZoneCoordinates(lat, lng, center = true) {
  const safeLat = clamp(lat, -85, 85);
  const safeLng = ((lng + 180) % 360 + 360) % 360 - 180;
  $("#landingZoneLat").value = safeLat.toFixed(6);
  $("#landingZoneLng").value = safeLng.toFixed(6);
  if (center) centerLandingZoneMap(safeLat, safeLng, Math.max(landingZoneMapState.zoom, 17));
  renderLandingZoneMap();
  scheduleAutoSave();
}

function clearSiteCoordinates() {
  $("#lat").value = "";
  $("#lng").value = "";
  $("#planForm").dataset.accuracy = "";
  $("#planForm").dataset.capturedAt = "";
  $("#planForm").dataset.locationSource = "";
  updateGpsStatus();
  updateEssentialProgress();
  renderSiteMap();
  scheduleAutoSave();
}

function clearLandingZoneCoordinates() {
  $("#landingZoneLat").value = "";
  $("#landingZoneLng").value = "";
  renderLandingZoneMap();
  scheduleAutoSave();
}

function pointToLatLngFromMap(mapSelector, state, clientX, clientY) {
  const map = $(mapSelector);
  const rect = map.getBoundingClientRect();
  const zoom = state.zoom;
  const centerX = lngToTileX(state.centerLng, zoom);
  const centerY = latToTileY(state.centerLat, zoom);
  const worldX = centerX + (clientX - rect.left) - rect.width / 2;
  const worldY = centerY + (clientY - rect.top) - rect.height / 2;
  return {
    lat: tileYToLat(worldY, zoom),
    lng: tileXToLng(worldX, zoom),
  };
}

function pointToLatLng(clientX, clientY) {
  return pointToLatLngFromMap("#siteMap", siteMapState, clientX, clientY);
}

async function savePlan(plan = formToPlan(), quiet = false) {
  if (!plan.title) plan.title = "Untitled WRSP Plan";
  await storePut(PLAN_STORE, plan);
  currentPlanId = plan.id;
  sharedPlanPreview = null;
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
    { label: "logger, crew, or forester contact", done: Boolean(plan.contacts?.primaryContact || plan.contacts?.supervisor || plan.contacts?.foresterContact) },
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
          <button class="primary-action share-inline" data-share-plan="${plan.id}">Share Link</button>
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
      <button class="primary-action share-inline" data-share-plan="${plan.id}">Share Link</button>
    </div>`;
}

async function openPlan(id) {
  const plan = await storeGet(PLAN_STORE, id);
  if (!plan) return;
  currentPlanId = id;
  sharedPlanPreview = null;
  $("#planViewTitle").textContent = plan.title || "WRSP Plan";
  renderCurrentPlan(plan);
  routeTo("plan");
}

async function activePlan() {
  if (sharedPlanPreview) return sharedPlanPreview;
  if (!currentPlanId) return null;
  return storeGet(PLAN_STORE, currentPlanId);
}

function renderCurrentPlan(plan) {
  $("#planOutput").innerHTML = currentPlanMode === "responder" ? renderResponderPlanHtml(plan) : renderPlanHtml(plan);
  $("#fullPlanMode")?.classList.toggle("active", currentPlanMode === "full");
  $("#responderPlanMode")?.classList.toggle("active", currentPlanMode === "responder");
}

function responderLine(label, value) {
  return value ? `<p><strong>${escapeHtml(label)}:</strong> ${allowMapLink(value)}</p>` : "";
}

function responderList(items) {
  const filtered = items.filter(([, value]) => value);
  if (!filtered.length) return `<p>Not entered</p>`;
  return filtered.map(([label, value]) => responderLine(label, value)).join("");
}

function renderPlanHtml(plan) {
  const loc = plan.location || {};
  const mapsLink = loc.lat && loc.lng ? `https://maps.google.com/?q=${encodeURIComponent(`${loc.lat},${loc.lng}`)}` : "";
  const emergencyDirections = buildEmergencyDirections(plan);
  const sections = [
    ["Location", [
      ["GPS", loc.lat && loc.lng ? `${loc.lat}, ${loc.lng}` : "Not set"],
      ["Maps link", mapsLink ? `<a href="${mapsLink}" target="_blank" rel="noopener">Open coordinates in maps</a>` : "Not set"],
      ["Nearest public road / address", loc.roadAddress],
      ["Town / county / state", [loc.town, loc.county, loc.state].filter(Boolean).join(", ")],
      ["Phone service", plan.access?.phoneServiceNotes],
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
      ["Logger", plan.contacts?.primaryContact],
      ["Crew member(s)", plan.contacts?.supervisor],
      ["Forester", plan.contacts?.foresterContact],
      ["Landowner(s)", plan.contacts?.landowner],
      ["Other contact / role", plan.contacts?.truckingContact],
      ["Verified agency / dispatch", plan.sar?.verifiedAgency],
      ["Verified agency phone", plan.sar?.verifiedPhone],
      ["Verified person / role", plan.sar?.verifiedPerson],
      ["Verified source / date", plan.sar?.verifiedSource],
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
  const siteAddress = [loc.roadAddress, loc.town, loc.county, loc.state].filter(Boolean).join(", ");
  const lzGps = access.landingZoneLat && access.landingZoneLng ? `${access.landingZoneLat}, ${access.landingZoneLng}` : "";
  return `
    <div class="safety-sheet">
      <header class="safety-sheet-head">
        <div>
          <h2>${escapeHtml(plan.title || "WRSP Safety Plan")}</h2>
          <p>${escapeHtml(siteAddress || "Site address/location not entered")}</p>
          <strong>Safety Plan & Important Information</strong>
          <p>Updated ${formatDate(plan.updatedAt)}</p>
        </div>
        <a class="primary-action link-action emergency-dial" href="tel:911">Dial 911</a>
      </header>
    ${completenessHint(plan)}
      <section class="sheet-section phones-section">
        <h3>Phones</h3>
        <p class="warning strong">WRSP does not contact 911. Dial 911 for emergencies.</p>
        ${responderLine("Phone service", access.phoneServiceNotes || "Not entered")}
        <p>Keep this plan on your phone and text or email it to responders after you have spoken with them.</p>
      </section>
      <section class="sheet-section">
        <h3>Site Location</h3>
        ${responderLine("GPS", loc.lat && loc.lng ? `<a href="${mapsLink}" target="_blank" rel="noopener">${loc.lat}, ${loc.lng}</a>` : "Not entered")}
        ${mapsLink ? responderLine("Map link", `<a href="${mapsLink}" target="_blank" rel="noopener">${mapsLink}</a>`) : responderLine("Map link", "Not entered")}
      </section>
      <section class="sheet-section">
        <h3>State & Emergency Numbers</h3>
        ${responderList([
          ["Verified agency / dispatch", plan.sar?.verifiedAgency],
          ["Verified agency phone", plan.sar?.verifiedPhone],
          ["Verified person / role", plan.sar?.verifiedPerson],
          ["Verified source / date", plan.sar?.verifiedSource],
          ["Local woods emergency contacts", plan.sar?.contacts],
          ["Hospital / ER", plan.medical?.hospital],
          ["Hospital directions", plan.medical?.hospitalDirectionsUrl ? `<a href="${escapeHtml(plan.medical.hospitalDirectionsUrl)}" target="_blank" rel="noopener">Open hospital directions</a>` : ""],
          ["Trauma / major hospital", plan.medical?.traumaCenter],
          ["Trauma directions", plan.medical?.traumaDirectionsUrl ? `<a href="${escapeHtml(plan.medical.traumaDirectionsUrl)}" target="_blank" rel="noopener">Open trauma directions</a>` : ""],
        ])}
      </section>
      <section class="sheet-section">
        <h3>People</h3>
        ${responderList([
          ["Logger", plan.contacts?.primaryContact],
          ["Crew member(s)", plan.contacts?.supervisor],
          ["Forester", plan.contacts?.foresterContact],
          ["Landowner(s)", plan.contacts?.landowner],
          ["Other contact / role", plan.contacts?.truckingContact],
        ])}
      </section>
      <section class="sheet-section directions-section">
        <h3>Directions to Job Site for Emergency Vehicles</h3>
        <p>${escapeHtml(buildEmergencyDirections(plan))}</p>
      </section>
      <section class="sheet-section">
        <h3>Access and Hazards</h3>
        ${responderList([
          ["Emergency meeting point", access.meetingPoint],
          ["Gate / lock / key notes", access.gateNotes],
          ["Best access / truck route", access.routeNotes],
          ["Alternate meeting point", access.alternateMeetingPoint],
          ["Hazards at or near site", plan.hazards],
          ["Medical notes", plan.medical?.notes],
        ])}
      </section>
      <section class="sheet-section">
        <h3>Potential Helicopter Landing Site</h3>
        ${responderList([
          ["Landing zone", access.landingZoneDescription],
          ["Lat/Long", lzGps],
          ["Hazards / notes", access.landingZoneNotes],
        ])}
      </section>
    </div>`;
}

function buildEmergencyDirections(plan) {
  const loc = plan.location || {};
  const access = plan.access || {};
  const parts = [];
  parts.push(`The emergency is at ${plan.title || "a logging site"}.`);
  if (loc.lat && loc.lng) parts.push(`GPS coordinates are ${loc.lat}, ${loc.lng}.`);
  if (access.phoneServiceNotes) parts.push(`Phone service notes: ${access.phoneServiceNotes}.`);
  if (access.knownLandmark) parts.push(`Start from ${access.knownLandmark}.`);
  if (access.phoneDirections) parts.push(access.phoneDirections);
  if (access.meetingPoint) parts.push(`The emergency meeting point is ${access.meetingPoint}.`);
  if (access.gateNotes) parts.push(`Gate, lock, or access notes: ${access.gateNotes}.`);
  if (access.routeNotes) parts.push(`Additional access notes: ${access.routeNotes}.`);
  if (access.landingZoneDescription || (access.landingZoneLat && access.landingZoneLng)) {
    parts.push(`Possible helicopter landing zone: ${access.landingZoneDescription || "description not entered"}${access.landingZoneLat && access.landingZoneLng ? `; GPS ${access.landingZoneLat}, ${access.landingZoneLng}` : ""}.`);
  }
  if (access.landingZoneNotes) parts.push(`Landing zone hazards or notes: ${access.landingZoneNotes}.`);
  if (plan.sar?.verifiedAgency || plan.sar?.verifiedPhone || plan.sar?.verifiedPerson) {
    parts.push(`Verified emergency contact: ${[plan.sar?.verifiedAgency, plan.sar?.verifiedPerson, plan.sar?.verifiedPhone].filter(Boolean).join(", ")}.`);
  }
  if (plan.sar?.contacts) parts.push(`Local woods emergency contacts or agency notes: ${plan.sar.contacts}.`);
  if (!access.knownLandmark && !access.phoneDirections) {
    parts.push("Directions from a known town, village, highway intersection, or other responder-friendly landmark have not been entered yet.");
  }
  return parts.join(" ");
}

function planShareText(plan) {
  const loc = plan.location || {};
  const mapsLink = loc.lat && loc.lng ? `https://maps.google.com/?q=${encodeURIComponent(`${loc.lat},${loc.lng}`)}` : "No GPS set";
  const hospital = plan.medical?.hospital || plan.medical?.traumaCenter || "Not entered";
  const agency = [plan.sar?.verifiedAgency, plan.sar?.verifiedPerson, plan.sar?.verifiedPhone].filter(Boolean).join(", ") || plan.sar?.contacts || "Not entered";
  const lz = plan.access?.landingZoneLat && plan.access?.landingZoneLng
    ? `${plan.access.landingZoneLat}, ${plan.access.landingZoneLng}`
    : (plan.access?.landingZoneDescription || "Not entered");
  return [
    `WRSP Safety Plan: ${plan.title || "Untitled"}`,
    `GPS: ${loc.lat && loc.lng ? `${loc.lat}, ${loc.lng}` : "Not set"}`,
    `Map: ${mapsLink}`,
    `Read to 911: ${buildEmergencyDirections(plan)}`,
    `Phone service: ${plan.access?.phoneServiceNotes || "Not entered"}`,
    `Logger: ${plan.contacts?.primaryContact || "Not entered"}`,
    `Forester: ${plan.contacts?.foresterContact || "Not entered"}`,
    `Meeting point: ${plan.access?.meetingPoint || "Not entered"}`,
    `Hospital/medical: ${hospital}`,
    `Woods emergency contact: ${agency}`,
    `Possible helicopter LZ: ${lz}`,
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
  return `${baseUrl}#plan=${encodeURIComponent(compactExportPackage(plan))}`;
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
    help.textContent = "This plan is too large for a reliable QR code. Use Backup File to share the plan backup instead.";
    return;
  }
  image.hidden = false;
  image.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(importUrl)}`;
  help.textContent = "Scan this code to open a read-only responder plan. Best used from the hosted WRSP app, not the local file preview.";
}

function planLinkShareText(plan) {
  return [
    `WRSP Safety Plan: ${plan.title || "Untitled"}`,
    "Open this link for the formatted responder safety plan. From the browser, use Print / Save PDF if a PDF copy is needed.",
    importUrlForPlan(plan),
  ].join("\n");
}

function planPngRows(plan) {
  const loc = plan.location || {};
  const access = plan.access || {};
  const mapsLink = loc.lat && loc.lng ? `https://maps.google.com/?q=${loc.lat},${loc.lng}` : "";
  const lzGps = access.landingZoneLat && access.landingZoneLng ? `${access.landingZoneLat}, ${access.landingZoneLng}` : "";
  return [
    ["PHONE / 911", `Dial 911 for emergencies. Phone service: ${access.phoneServiceNotes || "Not entered"}`],
    ["SITE LOCATION", [
      loc.lat && loc.lng ? `GPS: ${loc.lat}, ${loc.lng}` : "GPS: Not entered",
      mapsLink ? `Map: ${mapsLink}` : "",
      [loc.roadAddress, loc.town, loc.county, loc.state].filter(Boolean).join(", "),
    ].filter(Boolean).join("\n")],
    ["PEOPLE", [
      plan.contacts?.primaryContact && `Logger: ${plan.contacts.primaryContact}`,
      plan.contacts?.supervisor && `Crew: ${plan.contacts.supervisor}`,
      plan.contacts?.foresterContact && `Forester: ${plan.contacts.foresterContact}`,
      plan.contacts?.landowner && `Landowner(s): ${plan.contacts.landowner}`,
      plan.contacts?.truckingContact && `Other: ${plan.contacts.truckingContact}`,
    ].filter(Boolean).join("\n") || "Not entered"],
    ["DIRECTIONS TO JOB SITE", buildEmergencyDirections(plan)],
    ["STATE & EMERGENCY NUMBERS", [
      plan.sar?.verifiedAgency,
      plan.sar?.verifiedPhone,
      plan.sar?.verifiedPerson,
      plan.sar?.contacts,
    ].filter(Boolean).join("\n") || "Not entered"],
    ["MEDICAL", [
      plan.medical?.hospital && `Hospital / ER: ${plan.medical.hospital}`,
      plan.medical?.hospitalDirectionsUrl && `Hospital map: ${plan.medical.hospitalDirectionsUrl}`,
      plan.medical?.urgentCare && `Urgent care: ${plan.medical.urgentCare}`,
      plan.medical?.traumaCenter && `Trauma / major hospital: ${plan.medical.traumaCenter}`,
      plan.medical?.notes,
    ].filter(Boolean).join("\n") || "Not entered"],
    ["ACCESS / HAZARDS", [
      access.gateNotes && `Gate: ${access.gateNotes}`,
      access.meetingPoint && `Meeting point: ${access.meetingPoint}`,
      plan.hazards && `Hazards: ${plan.hazards}`,
    ].filter(Boolean).join("\n") || "Not entered"],
    ["POTENTIAL HELICOPTER LANDING SITE", [
      access.landingZoneDescription,
      lzGps && `GPS: ${lzGps}`,
      access.landingZoneNotes && `Hazards/notes: ${access.landingZoneNotes}`,
    ].filter(Boolean).join("\n") || "Not entered"],
  ];
}

function drawCanvasBlock(ctx, label, value, x, y, width) {
  ctx.fillStyle = "#123c2c";
  ctx.font = "800 26px Arial";
  ctx.fillText(label, x, y);
  y += 34;
  ctx.fillStyle = "#1d2520";
  ctx.font = "24px Arial";
  y = wrapCanvasText(ctx, value || "Not entered", x, y, width, 30);
  return y + 18;
}

function planCanvas(plan) {
  const canvas = document.createElement("canvas");
  canvas.width = 1400;
  canvas.height = 2200;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f5ee";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#123c2c";
  ctx.fillRect(0, 0, canvas.width, 190);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 50px Arial";
  ctx.fillText(plan.title || "WRSP Safety Plan", 70, 78);
  ctx.font = "700 30px Arial";
  ctx.fillText("Safety Plan & Important Information", 70, 128);
  ctx.font = "24px Arial";
  ctx.fillText(`Updated ${formatDate(plan.updatedAt)}`, 70, 162);
  ctx.fillStyle = "#d4631f";
  ctx.fillRect(0, 190, canvas.width, 10);
  let y = 255;
  planPngRows(plan).forEach(([label, value]) => {
    y = drawCanvasBlock(ctx, label, value, 70, y, 1260);
    ctx.fillStyle = "#d8ded5";
    ctx.fillRect(70, y - 8, 1260, 2);
    y += 16;
  });
  ctx.fillStyle = "#70310e";
  ctx.font = "700 24px Arial";
  wrapCanvasText(ctx, "WRSP does not contact 911. For serious injury or uncertain severity, call 911 and request EMS.", 70, 2130, 1260, 30);
  return canvas;
}

async function sharePlanPng(plan) {
  const canvas = planCanvas(plan);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], `${safeFileName(plan.title || "wrsp-plan")}.png`, { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ title: `WRSP: ${plan.title}`, text: "WRSP responder safety plan image", files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("WRSP plan PNG downloaded.");
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
      title: `WRSP backup: ${plan.title || "Safety Plan"}`,
      text: "WRSP plan backup file.",
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
    importedFrom: payload.id || "shared backup",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  await savePlan(imported, true);
  await openPlan(imported.id);
  return imported;
}

async function importFromUrlHash() {
  if (window.location.hash.startsWith("#medical=")) {
    try {
      const raw = decodeURIComponent(window.location.hash.slice("#medical=".length));
      const parsed = JSON.parse(raw);
      const card = parsed.type === "WRSP_MEDICAL_CARD" ? parsed.payload : parsed;
      sharedMedicalCardPreview = card;
      routeTo("medicalCard");
      $("#medicalCardStatus").textContent = "Shared medical card opened. It has not been saved on this phone unless you tap Save.";
      toast("Shared WRSP medical card opened.");
    } catch (error) {
      toast(`Medical card link failed: ${error.message}`);
    }
    return;
  }
  if (window.location.hash.startsWith("#plan=")) {
    try {
      const raw = decodeURIComponent(window.location.hash.slice("#plan=".length));
      const payload = parsePlanExport(raw);
      sharedPlanPreview = {
        ...emptyPlan(),
        ...payload,
        updatedAt: payload.updatedAt || new Date().toISOString(),
      };
      currentPlanId = null;
      currentPlanMode = "responder";
      $("#planViewTitle").textContent = sharedPlanPreview.title || "Shared WRSP Plan";
      renderCurrentPlan(sharedPlanPreview);
      routeTo("plan");
      toast("Shared WRSP plan opened.");
    } catch (error) {
      toast(`Shared plan link failed: ${error.message}`);
    }
    return;
  }
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
    $("#planForm").dataset.locationSource = "phone GPS";
    $("#lat").value = position.coords.latitude.toFixed(6);
    $("#lng").value = position.coords.longitude.toFixed(6);
    updateGpsStatus();
    updateEssentialProgress();
    centerSiteMap(position.coords.latitude, position.coords.longitude, 17);
    scheduleAutoSave();
  } catch (error) {
    $("#gpsStatus").textContent = `GPS unavailable: ${error.message}`;
  }
}

async function captureLandingZoneGps() {
  try {
    const position = await getCurrentPosition();
    setLandingZoneCoordinates(position.coords.latitude, position.coords.longitude, true);
    toast("Landing zone GPS captured.");
  } catch (error) {
    toast(`LZ GPS unavailable: ${error.message}`);
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

function safetyShareOptionsForDevice() {
  const type = getDeviceType();
  if (type === "ios") return liveLocationLauncherOptions.ios;
  if (type === "android") return liveLocationLauncherOptions.android;
  return [
    ...liveLocationLauncherOptions.ios,
    ...liveLocationLauncherOptions.android,
    ...liveLocationLauncherOptions.other,
  ];
}

function cleanPhone(value = "") {
  return value.replace(/[^\d+]/g, "");
}

function safetyShareCheckInText() {
  const value = $("#safetyShareCheckIn")?.value;
  if (!value) return "the planned check-in time";
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function datetimeLocalValue(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    "-",
    pad(date.getMonth() + 1),
    "-",
    pad(date.getDate()),
    "T",
    pad(date.getHours()),
    ":",
    pad(date.getMinutes()),
  ].join("");
}

async function safetyShareUrl() {
  if (currentPlanId) {
    const plan = await storeGet(PLAN_STORE, currentPlanId);
    if (plan) return importUrlForPlan(plan);
  }
  return window.location.href.split("#")[0];
}

function safetyShareStaticLocationText() {
  const manual = $("#safetyShareStartLocation")?.value.trim();
  if (manual) return manual;
  if (emergencyCoords) {
    return `${emergencyCoords.lat}, ${emergencyCoords.lng} https://maps.google.com/?q=${emergencyCoords.lat},${emergencyCoords.lng}`;
  }
  const plan = formToPlan();
  const loc = plan.location || {};
  if (loc.lat && loc.lng) {
    return `${loc.lat}, ${loc.lng} https://maps.google.com/?q=${loc.lat},${loc.lng}`;
  }
  return "";
}

async function buildSafetyShareMessage() {
  const checkIn = safetyShareCheckInText();
  const pageUrl = await safetyShareUrl();
  const locationText = safetyShareStaticLocationText();
  const notes = $("#safetyShareNotes")?.value.trim();
  return [
    `I am starting a WRSP Safety Share until ${checkIn}.`,
    `Safety page: ${pageUrl}.`,
    "I am also starting live location sharing from my phone.",
    `If you do not hear from me by ${checkIn}, check this page and my shared phone location.`,
    locationText ? `Starting location backup: ${locationText}.` : "",
    notes ? `Notes: ${notes}` : "",
  ].filter(Boolean).join(" ");
}

function buildLauncherHref(option, message) {
  const phone = cleanPhone($("#safetyShareContactPhone")?.value || "");
  return option.href
    .replace("{phone}", encodeURIComponent(phone))
    .replace("{encodedMessage}", encodeURIComponent(message));
}

async function updateSafetyShareMessage() {
  const messageBox = $("#safetyShareMessage");
  if (!messageBox) return "";
  const message = await buildSafetyShareMessage();
  messageBox.value = message;
  return message;
}

async function renderLiveLocationOptions() {
  const list = $("#liveLocationOptions");
  const select = $("#safetyShareSelectedMethod");
  if (!list || !select) return;
  const message = await updateSafetyShareMessage();
  const options = safetyShareOptionsForDevice();
  select.innerHTML = options.map((option) => `<option value="${option.id}">${escapeHtml(option.label)}</option>`).join("");
  list.innerHTML = options.map((option) => `
    <div class="launcher-option">
      <div>
        <p class="eyebrow">${escapeHtml(option.platform)}</p>
        <h4>${escapeHtml(option.label)}</h4>
        <p>${escapeHtml(option.instructions)}</p>
        ${option.fallback ? `<p class="helper">${escapeHtml(option.fallback)}</p>` : ""}
      </div>
      <button type="button" class="primary-action" data-launch-location="${option.id}">${escapeHtml(option.label)}</button>
    </div>
  `).join("");
  list.querySelectorAll("[data-launch-location]").forEach((button) => {
    button.addEventListener("click", () => launchLiveLocationOption(button.dataset.launchLocation, message));
  });
}

async function updateSafetyShareScreen() {
  const checkIn = $("#safetyShareCheckIn");
  if (checkIn && !checkIn.value) {
    const defaultTime = new Date(Date.now() + 60 * 60 * 1000);
    defaultTime.setSeconds(0, 0);
    checkIn.value = datetimeLocalValue(defaultTime);
  }
  const saved = await storeGet(SETTINGS_STORE, SAFETY_SHARE_KEY);
  const value = saved?.value;
  if (value?.trustedContactName && !$("#safetyShareContactName").value) $("#safetyShareContactName").value = value.trustedContactName;
  if (value?.trustedContactPhone && !$("#safetyShareContactPhone").value) $("#safetyShareContactPhone").value = value.trustedContactPhone;
  if (value?.notes && !$("#safetyShareConfirmNotes").value) $("#safetyShareConfirmNotes").value = value.notes;
  await renderLiveLocationOptions();
  renderSafetyShareStatus(value);
}

function renderSafetyShareStatus(value) {
  const status = $("#safetyShareStatus");
  if (!status) return;
  if (!value?.userConfirmedStartedAt) {
    status.textContent = "Live location sharing is not confirmed in WRSP yet.";
    return;
  }
  status.textContent = `Confirmed ${formatDate(value.userConfirmedStartedAt)} by ${value.selectedMethod || "selected method"}. WRSP did not start tracking automatically; this records your confirmation.`;
}

async function launchLiveLocationOption(optionId, message) {
  const option = safetyShareOptionsForDevice().find((item) => item.id === optionId);
  if (!option) return;
  $("#safetyShareSelectedMethod").value = option.id;
  const record = {
    ...((await storeGet(SETTINGS_STORE, SAFETY_SHARE_KEY))?.value || {}),
    selectedMethod: option.id,
    launchedAt: new Date().toISOString(),
    userConfirmedStartedAt: null,
    trustedContactName: $("#safetyShareContactName").value.trim(),
    trustedContactPhone: $("#safetyShareContactPhone").value.trim(),
    notes: $("#safetyShareConfirmNotes").value.trim() || null,
  };
  await storePut(SETTINGS_STORE, { key: SAFETY_SHARE_KEY, value: record });
  renderSafetyShareStatus(record);
  const href = buildLauncherHref(option, message || await buildSafetyShareMessage());
  window.location.href = href;
}

async function textTrustedContact() {
  const phone = cleanPhone($("#safetyShareContactPhone").value);
  if (!phone) {
    toast("Enter or choose a trusted contact phone first.");
    return;
  }
  const message = await updateSafetyShareMessage();
  window.location.href = `sms:${encodeURIComponent(phone)}?body=${encodeURIComponent(message)}`;
}

async function sendSafetyPage() {
  const message = await updateSafetyShareMessage();
  await shareText("WRSP Safety Share", message);
}

function appShareUrl() {
  if (window.location.protocol === "file:") return "https://loggingchance.github.io/WRSP/";
  return window.location.href.split("#")[0];
}

function appShareText() {
  return [
    "WRSP - Woods-Ready Safety Plan",
    "Create and share a site-specific logging safety plan with GPS, read-aloud 911 directions, contacts, medical information, hazards, and access notes.",
    appShareUrl(),
    "On a phone: open the link, then use Add to Home Screen or Install app.",
  ].join("\n");
}

async function shareAppLink() {
  await shareText("WRSP - Woods-Ready Safety Plan", appShareText());
}

function isInstalledDisplayMode() {
  return window.matchMedia?.("(display-mode: standalone)").matches || navigator.standalone === true;
}

async function installOrShowInstructions() {
  if (isInstalledDisplayMode()) {
    toast("WRSP is already running like an installed app.");
    routeTo("install");
    return;
  }
  if (deferredInstallPrompt) {
    const promptEvent = deferredInstallPrompt;
    deferredInstallPrompt = null;
    promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice?.outcome === "accepted") {
      toast("WRSP install started.");
      return;
    }
    toast("Install was not completed.");
    routeTo("install");
    return;
  }
  routeTo("install");
  toast("Use the steps shown for this phone or browser.");
}

async function checkForAppUpdate() {
  if (!("serviceWorker" in navigator)) {
    toast("This browser does not support app updates.");
    return;
  }
  const registrations = await navigator.serviceWorker.getRegistrations();
  if (!registrations.length) {
    toast("WRSP is checking for offline/install support. Try again after opening from the hosted site.");
    return;
  }
  let updateFound = false;
  await Promise.all(registrations.map(async (registration) => {
    await registration.update();
    const waiting = registration.waiting;
    const installing = registration.installing;
    if (waiting) {
      updateFound = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
    } else if (installing) {
      updateFound = true;
      installing.addEventListener("statechange", () => {
        if (installing.state === "installed" && registration.waiting) {
          registration.waiting.postMessage({ type: "SKIP_WAITING" });
        }
      });
    }
  }));
  if (updateFound) {
    toast("Updating WRSP. The app will reload if the browser allows it.");
    window.setTimeout(() => {
      if (!updateReloading) window.location.reload();
    }, 1800);
    return;
  }
  toast("WRSP checked for updates. You appear to have the latest available version.");
}

async function confirmLiveLocationStarted() {
  const existing = (await storeGet(SETTINGS_STORE, SAFETY_SHARE_KEY))?.value || {};
  const record = {
    ...existing,
    selectedMethod: $("#safetyShareSelectedMethod").value,
    launchedAt: existing.launchedAt || new Date().toISOString(),
    userConfirmedStartedAt: new Date().toISOString(),
    trustedContactName: $("#safetyShareContactName").value.trim(),
    trustedContactPhone: $("#safetyShareContactPhone").value.trim(),
    notes: $("#safetyShareConfirmNotes").value.trim() || null,
  };
  await storePut(SETTINGS_STORE, { key: SAFETY_SHARE_KEY, value: record });
  renderSafetyShareStatus(record);
  toast("Safety Share confirmation saved on this phone.");
}

function mapSearch(query) {
  const origin = $("#medicalSearchOrigin").value.trim();
  const fullQuery = origin ? `${query} near ${origin}` : `${query} near me`;
  openMapsSearch(fullQuery);
}

const MEDICAL_FACILITY_CONFIG = {
  hospital: {
    query: "emergency room hospital",
    label: "Hospital / ER",
    placeholder: "Facility name, address, phone for the confirmed ER or hospital",
  },
  urgentCare: {
    query: "urgent care",
    label: "Urgent care",
    placeholder: "Facility name, address, phone for the confirmed urgent care",
  },
  traumaCenter: {
    query: "trauma center hospital",
    label: "Trauma center / major hospital",
    placeholder: "Facility name, address, phone for the confirmed trauma center or major hospital",
  },
};

function medicalSearchQueryForType(type) {
  const origin = $("#medicalSearchOrigin").value.trim();
  const config = MEDICAL_FACILITY_CONFIG[type] || MEDICAL_FACILITY_CONFIG.hospital;
  return origin ? `${config.query} near ${origin}` : `${config.query} near me`;
}

function medicalSearchUrlForType(type) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(medicalSearchQueryForType(type))}`;
}

function prepareMedicalFacility(type, openSearch = true) {
  const config = MEDICAL_FACILITY_CONFIG[type] || MEDICAL_FACILITY_CONFIG.hospital;
  $("#medicalFacilityType").value = type;
  $("#medicalFacilityDetails").placeholder = config.placeholder;
  $("#medicalFacilityDirectionsUrl").value = medicalSearchUrlForType(type);
  $("#medicalSaveStatus").textContent = `${config.label}: confirm the correct facility in maps, then enter the name/address/phone and save to the current plan.`;
  if (openSearch) openMapsSearch(medicalSearchQueryForType(type));
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
  const config = MEDICAL_FACILITY_CONFIG[type] || MEDICAL_FACILITY_CONFIG.hospital;
  if (!details) {
    $("#medicalSaveStatus").textContent = `Enter the confirmed ${config.label} name, address, and phone before saving.`;
    return;
  }
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
  $("#medicalSaveStatus").textContent = `${config.label} saved to the current plan.`;
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
  input.value = [loc.roadAddress, loc.town, loc.county, loc.state].filter(Boolean).join(", ");
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

function planAddressSearchText() {
  const loc = formToPlan().location || {};
  return [loc.roadAddress, loc.town, loc.county, loc.state].filter(Boolean).join(", ");
}

function startingLandmarkSearchText() {
  const plan = formToPlan();
  const loc = plan.location || {};
  if (loc.lat && loc.lng) {
    return `nearest town village fire station or state highway intersection near ${loc.lat}, ${loc.lng}`;
  }
  const place = [loc.roadAddress, loc.town, loc.county, loc.state].filter(Boolean).join(", ");
  return place ? `nearest town village fire station or state highway intersection near ${place}` : "";
}

function buildPhoneDirectionsDraft() {
  const plan = formToPlan();
  const access = plan.access || {};
  const loc = plan.location || {};
  const parts = [];
  const start = access.knownLandmark || [loc.roadAddress, loc.town, loc.county, loc.state].filter(Boolean).join(", ");
  if (start) parts.push(`From ${start}, proceed to the job site.`);
  if (access.routeNotes) parts.push(access.routeNotes);
  if (access.gateNotes) parts.push(`Gate, lock, or access notes: ${access.gateNotes}`);
  if (access.meetingPoint) parts.push(`Meet emergency vehicles at ${access.meetingPoint}.`);
  if (access.alternateMeetingPoint) parts.push(`Alternate meeting point: ${access.alternateMeetingPoint}.`);
  if (loc.lat && loc.lng) parts.push(`Exact site coordinates: ${loc.lat}, ${loc.lng}.`);
  parts.push("Have someone meet responders at the access point and flag a visible route to the injured person.");
  return parts.join(" ");
}

function updateWoodsContactSuggestion() {
  const plan = formToPlan();
  const origin = planSearchOrigin();
  const { agency } = stateAgencyForPlan(plan);
  const suggestion = $("#woodsContactSuggestion");
  if (!origin && !agency) {
    suggestion.textContent = "Enter the site state plus county or town first. WRSP will suggest the likely woods agency and build targeted searches.";
    renderResponderLookupChecklist(plan, agency, origin);
    renderResponderVerificationScript(plan, agency, origin);
    return;
  }
  if (agency) {
    suggestion.textContent = `Likely state starting point: ${agency}. Use the buttons to look for the correct district, county contact, dispatch number, ranger, warden, or local responder for ${origin || "this site"}.`;
    renderResponderLookupChecklist(plan, agency, origin);
    renderResponderVerificationScript(plan, agency, origin);
    return;
  }
  suggestion.textContent = `Use the buttons to search for local responder contacts for ${origin}. Add the state for a better state-agency suggestion.`;
  renderResponderLookupChecklist(plan, agency, origin);
  renderResponderVerificationScript(plan, agency, origin);
}

function renderResponderLookupChecklist(plan = formToPlan(), agency = "", origin = "") {
  const checklist = $("#responderLookupChecklist");
  if (!checklist) return;
  const loc = plan.location || {};
  const county = loc.county ? `${loc.county} County` : "the county";
  const state = loc.state || "the state";
  const items = [
    agency ? `Start with ${agency}; look for the district office, ranger, warden, forestry/fire dispatch, or duty officer covering ${origin || state}.` : `Add the state so WRSP can suggest the state forestry/ranger/warden agency.`,
    `Verify the 24-hour dispatch path for ${county}, not only an office number.`,
    `Confirm which local fire/rescue department covers the landing, gate, or woods road access point.`,
    `Record a person or role, phone number, and source/date after calling or checking the official page.`,
  ];
  checklist.innerHTML = `
    <strong>What to verify</strong>
    <ul>${items.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>
  `;
}

function responderVerificationText(plan = formToPlan(), agency = stateAgencyForPlan(plan).agency, origin = planSearchOrigin()) {
  const loc = plan.location || {};
  const site = plan.title || "this logging site";
  const place = origin || [loc.roadAddress, loc.town, loc.county, loc.state].filter(Boolean).join(", ") || "the site location";
  const coords = loc.lat && loc.lng ? `${loc.lat}, ${loc.lng}` : "coordinates not set yet";
  return [
    `I am preparing a Woods-Ready Safety Plan for ${site}.`,
    `Location: ${place}. Coordinates: ${coords}.`,
    agency ? `Likely state forestry/ranger starting point: ${agency}.` : "I still need to identify the state forestry/ranger/warden starting point.",
    "Can you confirm the correct 24-hour dispatch path or emergency contact for a logging/woods emergency at this site?",
    "Can you confirm the local fire/rescue coverage for the access road, gate, landing, or meeting point?",
    "What agency, role/person, phone number, and source/date should I record in the plan?",
  ].join("\n");
}

function renderResponderVerificationScript(plan = formToPlan(), agency = "", origin = "") {
  const script = $("#responderVerificationScript");
  if (!script) return;
  script.textContent = responderVerificationText(plan, agency, origin);
}

function verifiedResponderSummary() {
  return [
    $("#verifiedResponderAgency").value.trim(),
    $("#verifiedResponderPhone").value.trim(),
    $("#verifiedResponderPerson").value.trim(),
    $("#verifiedResponderSource").value.trim(),
  ].filter(Boolean).join(" - ");
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
    stateWoods: `${agency || `${state} state forestry forest ranger game warden`} ${place} district duty officer dispatch phone`,
    sheriffSar: `${place} county sheriff dispatch search rescue 24 hour non emergency phone`,
    fireRescue: `${place} fire rescue department district dispatch woods road emergency access`,
    emergencyManagement: `${place} emergency management office dispatch contact phone`,
  };
  openWebSearch(queries[kind]);
}

function formatPickedContact(contact) {
  const name = Array.isArray(contact.name) ? contact.name[0] : contact.name;
  const tel = Array.isArray(contact.tel) ? contact.tel[0] : contact.tel;
  const email = Array.isArray(contact.email) ? contact.email[0] : contact.email;
  return [name, tel, email].filter(Boolean).join(" - ");
}

function contactParts(contact) {
  return {
    name: Array.isArray(contact.name) ? contact.name[0] : contact.name,
    tel: Array.isArray(contact.tel) ? contact.tel[0] : contact.tel,
    email: Array.isArray(contact.email) ? contact.email[0] : contact.email,
  };
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
    if (fieldId === "safetyShareContactPhone") {
      const picked = contactParts(contacts[0]);
      $("#safetyShareContactName").value = picked.name || "";
      $("#safetyShareContactPhone").value = picked.tel || picked.email || "";
      await updateSafetyShareMessage();
      await renderLiveLocationOptions();
      toast("Trusted contact added to Safety Share.");
      return;
    }
    if (fieldId === "medCardEmergencyContacts") {
      const formatted = formatPickedContact(contacts[0]);
      target.value = formatted;
      await saveMedicalCard();
      toast("Emergency contact added to the medical card.");
      return;
    }
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

async function loadMedicalCard() {
  const record = await storeGet(SETTINGS_STORE, MEDICAL_CARD_KEY);
  const card = record?.value || {};
  medicalCardToForm(card);
  renderMedicalCardOutput(card);
}

function medicalCardToForm(card = {}) {
  [
    "medCardName",
    "medCardDob",
    "medCardBloodType",
    "medCardPhysician",
    "medCardAllergies",
    "medCardMeds",
    "medCardConditions",
    "medCardEmergencyContacts",
    "medCardInsurance",
    "medCardDirectives",
  ].forEach((id) => {
    const input = $(`#${id}`);
    if (input) input.value = card[id] || "";
  });
}

function medicalCardFromForm() {
  const value = {};
  [
    "medCardName",
    "medCardDob",
    "medCardBloodType",
    "medCardPhysician",
    "medCardAllergies",
    "medCardMeds",
    "medCardConditions",
    "medCardEmergencyContacts",
    "medCardInsurance",
    "medCardDirectives",
  ].forEach((id) => {
    value[id] = $(`#${id}`)?.value.trim() || "";
  });
  return value;
}

async function saveMedicalCard() {
  await storePut(SETTINGS_STORE, { key: MEDICAL_CARD_KEY, value: medicalCardFromForm() });
  renderMedicalCardOutput();
  $("#medicalCardStatus").textContent = "Medical card saved on this phone only.";
}

function medicalCardText(audience = "trusted") {
  const card = medicalCardFromForm();
  const intro = audience === "ems"
    ? "Emergency medical information shared by the user for EMS/medical responders."
    : "Medical information shared by the user with a family member or trusted contact.";
  return [
    "WRSP Medical Card",
    intro,
    `Name: ${card.medCardName || "Not entered"}`,
    `DOB: ${card.medCardDob || "Not entered"}`,
    `Blood type: ${card.medCardBloodType || "Not entered"}`,
    `Allergies: ${card.medCardAllergies || "Not entered"}`,
    `Medications: ${card.medCardMeds || "Not entered"}`,
    `Conditions: ${card.medCardConditions || "Not entered"}`,
    `Emergency contacts: ${card.medCardEmergencyContacts || "Not entered"}`,
    `Physician: ${card.medCardPhysician || "Not entered"}`,
    `Insurance / air medical: ${card.medCardInsurance || "Not entered"}`,
    `Advance directives / notes: ${card.medCardDirectives || "Not entered"}`,
    audience === "ems"
      ? "In an emergency, follow EMS protocols and confirm details with the patient or emergency contact when possible."
      : "In an emergency, call 911 and give this information to EMS if the user cannot speak for themselves.",
  ].join("\n");
}

async function shareMedicalCardText(audience = "trusted") {
  await saveMedicalCard();
  const title = audience === "ems" ? "WRSP Medical Card for EMS" : "WRSP Medical Card";
  await shareText(title, medicalCardText(audience));
}

function medicalCardRows(card = medicalCardFromForm()) {
  return [
    ["Name", card.medCardName],
    ["DOB", card.medCardDob],
    ["Blood type", card.medCardBloodType],
    ["Allergies", card.medCardAllergies],
    ["Medications", card.medCardMeds],
    ["Conditions", card.medCardConditions],
    ["Emergency contacts", card.medCardEmergencyContacts],
    ["Physician", card.medCardPhysician],
    ["Insurance / air medical", card.medCardInsurance],
    ["Advance directives / notes", card.medCardDirectives],
  ];
}

function renderMedicalCardHtml(card = medicalCardFromForm()) {
  const rows = medicalCardRows(card)
    .map(([label, value]) => `<div class="medical-card-row"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(value || "Not entered")}</span></div>`)
    .join("");
  return `
    <article class="medical-card-sheet">
      <div class="medical-card-head">
        <p class="eyebrow">WRSP Medical Card</p>
        <h2>${escapeHtml(card.medCardName || "Medical Card")}</h2>
        <p>Shared by the user. In an emergency, call 911 and give this information to EMS if the user cannot speak for themselves.</p>
      </div>
      <div class="medical-card-grid">${rows}</div>
    </article>`;
}

function renderMedicalCardOutput(card = medicalCardFromForm()) {
  const output = $("#medicalCardOutput");
  if (output) output.innerHTML = renderMedicalCardHtml(card);
}

function compactMedicalCardPackage(card = medicalCardFromForm()) {
  return JSON.stringify({
    type: "WRSP_MEDICAL_CARD",
    exportedAt: new Date().toISOString(),
    payload: card,
  });
}

function medicalCardShareUrl(card = medicalCardFromForm()) {
  const baseUrl = window.location.href.split("#")[0];
  return `${baseUrl}#medical=${encodeURIComponent(compactMedicalCardPackage(card))}`;
}

function showMedicalCardQr() {
  const card = medicalCardFromForm();
  const panel = $("#medicalQrPanel");
  const image = $("#medicalQrImage");
  const linkBox = $("#medicalQrLink");
  const help = $("#medicalQrHelp");
  const url = medicalCardShareUrl(card);
  panel.hidden = false;
  linkBox.value = url;
  if (url.length > 2200) {
    image.removeAttribute("src");
    image.hidden = true;
    help.textContent = "This medical card is too large for a reliable QR code. Use PNG, PDF, or text sharing instead.";
    return;
  }
  image.hidden = false;
  image.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(url)}`;
  help.textContent = "Scan this code to open the shared medical card. Use only with someone the user chooses to share with.";
}

function wrapCanvasText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = String(text || "Not entered").split(/\s+/);
  let line = "";
  let currentY = y;
  words.forEach((word) => {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  });
  if (line) {
    ctx.fillText(line, x, currentY);
    currentY += lineHeight;
  }
  return currentY;
}

function medicalCardCanvas(card = medicalCardFromForm()) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#f7f5ee";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#123c2c";
  ctx.fillRect(0, 0, canvas.width, 170);
  ctx.fillStyle = "#ffffff";
  ctx.font = "800 52px Arial";
  ctx.fillText("WRSP Medical Card", 70, 78);
  ctx.font = "700 34px Arial";
  ctx.fillText(card.medCardName || "Medical Card", 70, 130);
  ctx.fillStyle = "#d4631f";
  ctx.fillRect(0, 170, canvas.width, 10);
  let y = 235;
  medicalCardRows(card).forEach(([label, value]) => {
    ctx.fillStyle = "#123c2c";
    ctx.font = "800 27px Arial";
    ctx.fillText(label, 70, y);
    y += 34;
    ctx.fillStyle = "#1d2520";
    ctx.font = "26px Arial";
    y = wrapCanvasText(ctx, value || "Not entered", 70, y, 1060, 34) + 16;
  });
  ctx.fillStyle = "#70310e";
  ctx.font = "700 24px Arial";
  wrapCanvasText(ctx, "Shared by the user. In an emergency, call 911 and give this information to EMS if the user cannot speak for themselves.", 70, 1510, 1060, 30);
  return canvas;
}

async function shareMedicalCardPng() {
  await saveMedicalCard();
  const canvas = medicalCardCanvas();
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
  const file = new File([blob], "wrsp-medical-card.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ title: "WRSP Medical Card", text: "WRSP Medical Card image", files: [file] });
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "wrsp-medical-card.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  toast("Medical card PNG downloaded.");
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
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        $("#planForm").dataset.locationSource = "manual coordinates";
        $("#planForm").dataset.accuracy = "";
        $("#planForm").dataset.capturedAt = new Date().toISOString();
        updateGpsStatus();
        centerSiteMap(lat, lng, Math.max(siteMapState.zoom, 17));
        scheduleAutoSave();
      }
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
  $("#openAddressInMaps").addEventListener("click", () => {
    const query = planAddressSearchText();
    if (!query) {
      toast("Enter a road, address, town, county, or state first.");
      return;
    }
    openMapsSearch(query);
  });
  $("#findStartingLandmark").addEventListener("click", () => {
    const query = startingLandmarkSearchText();
    if (!query) {
      toast("Enter a site address or select the site point first.");
      return;
    }
    openMapsSearch(query);
  });
  $("#buildPhoneDirections").addEventListener("click", () => {
    const draft = buildPhoneDirectionsDraft();
    $("#phoneDirections").value = draft;
    scheduleAutoSave();
    updateEssentialProgress();
    toast("Read-aloud directions draft built.");
  });
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
    centerLandingZoneMap(parseFloat(lat), parseFloat(lng), Math.max(landingZoneMapState.zoom, 17));
    scheduleAutoSave();
    toast("Landing zone coordinates copied from site point.");
  });
  $("#captureLandingZoneGps").addEventListener("click", captureLandingZoneGps);
  $("#landingZoneMapZoomIn").addEventListener("click", () => {
    landingZoneMapState.zoom = clamp(landingZoneMapState.zoom + 1, 3, 19);
    renderLandingZoneMap();
  });
  $("#landingZoneMapZoomOut").addEventListener("click", () => {
    landingZoneMapState.zoom = clamp(landingZoneMapState.zoom - 1, 3, 19);
    renderLandingZoneMap();
  });
  $("#landingZoneMapRecenter").addEventListener("click", () => {
    const lat = parseFloat($("#landingZoneLat").value);
    const lng = parseFloat($("#landingZoneLng").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      const siteLat = parseFloat($("#lat").value);
      const siteLng = parseFloat($("#lng").value);
      if (Number.isFinite(siteLat) && Number.isFinite(siteLng)) {
        centerLandingZoneMap(siteLat, siteLng, Math.max(landingZoneMapState.zoom, 15));
        toast("LZ map centered on site point. Drop the LZ pin where the helicopter could land.");
        return;
      }
      toast("Set the LZ point or site point first, then center the map.");
      return;
    }
    centerLandingZoneMap(lat, lng, Math.max(landingZoneMapState.zoom, 17));
  });
  $("#dropLandingZonePinAtCenter").addEventListener("click", () => {
    setLandingZoneCoordinates(landingZoneMapState.centerLat, landingZoneMapState.centerLng, false);
    renderLandingZoneMap();
    toast("Landing zone pin dropped at map center.");
  });
  $("#clearLandingZonePin").addEventListener("click", () => {
    clearLandingZoneCoordinates();
    toast("Landing zone pin cleared.");
  });
  $("#mapZoomIn").addEventListener("click", () => {
    siteMapState.zoom = clamp(siteMapState.zoom + 1, 3, 19);
    renderSiteMap();
  });
  $("#mapZoomOut").addEventListener("click", () => {
    siteMapState.zoom = clamp(siteMapState.zoom - 1, 3, 19);
    renderSiteMap();
  });
  $("#mapRecenter").addEventListener("click", () => {
    const lat = parseFloat($("#lat").value);
    const lng = parseFloat($("#lng").value);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      toast("Set exact coordinates first, then center the map.");
      return;
    }
    centerSiteMap(lat, lng, Math.max(siteMapState.zoom, 17));
  });
  $("#dropPinAtCenter").addEventListener("click", () => {
    setSiteCoordinates(siteMapState.centerLat, siteMapState.centerLng, false);
    renderSiteMap();
    toast("Pin dropped at map center.");
  });
  $("#clearSitePin").addEventListener("click", () => {
    clearSiteCoordinates();
    toast("Site pin cleared.");
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
  $("#landingZoneMap").addEventListener("pointerdown", (event) => {
    const map = $("#landingZoneMap");
    map.setPointerCapture(event.pointerId);
    landingZoneMapState.dragging = true;
    landingZoneMapState.moved = 0;
    landingZoneMapState.dragStart = { x: event.clientX, y: event.clientY };
    landingZoneMapState.startCenter = {
      x: lngToTileX(landingZoneMapState.centerLng, landingZoneMapState.zoom),
      y: latToTileY(landingZoneMapState.centerLat, landingZoneMapState.zoom),
    };
  });
  $("#landingZoneMap").addEventListener("pointermove", (event) => {
    if (!landingZoneMapState.dragging) return;
    const dx = event.clientX - landingZoneMapState.dragStart.x;
    const dy = event.clientY - landingZoneMapState.dragStart.y;
    landingZoneMapState.moved = Math.max(landingZoneMapState.moved, Math.abs(dx), Math.abs(dy));
    const centerX = landingZoneMapState.startCenter.x - dx;
    const centerY = landingZoneMapState.startCenter.y - dy;
    landingZoneMapState.centerLng = tileXToLng(centerX, landingZoneMapState.zoom);
    landingZoneMapState.centerLat = clamp(tileYToLat(centerY, landingZoneMapState.zoom), -85, 85);
    renderLandingZoneMap();
  });
  $("#landingZoneMap").addEventListener("pointerup", (event) => {
    const map = $("#landingZoneMap");
    if (map.hasPointerCapture(event.pointerId)) map.releasePointerCapture(event.pointerId);
    const wasTap = landingZoneMapState.moved < 8;
    landingZoneMapState.dragging = false;
    if (wasTap) {
      const picked = pointToLatLngFromMap("#landingZoneMap", landingZoneMapState, event.clientX, event.clientY);
      setLandingZoneCoordinates(picked.lat, picked.lng, false);
      renderLandingZoneMap();
    }
  });
  window.addEventListener("resize", () => {
    renderSiteMap();
    renderLandingZoneMap();
  });
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
      await shareText(`WRSP: ${plan.title}`, planLinkShareText(plan));
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
      await shareText(`WRSP: ${plan.title}`, planLinkShareText(plan));
    }
  });
  $("#editCurrentPlan").addEventListener("click", async () => {
    const plan = await activePlan();
    if (!plan) return;
    planToForm(plan);
    routeTo("create");
  });
  $("#fullPlanMode").addEventListener("click", async () => {
    currentPlanMode = "full";
    const plan = await activePlan();
    if (plan) renderCurrentPlan(plan);
  });
  $("#responderPlanMode").addEventListener("click", async () => {
    currentPlanMode = "responder";
    const plan = await activePlan();
    if (plan) renderCurrentPlan(plan);
  });
  $("#planOutput").addEventListener("click", async (event) => {
    if (event.target.id !== "completePlanHint") return;
    const plan = await activePlan();
    if (!plan) return;
    planToForm(plan);
    routeTo("create");
  });
  $("#shareCurrentPlan").addEventListener("click", async () => {
    const plan = await activePlan();
    if (!plan) return;
    await shareText(`WRSP: ${plan.title}`, planLinkShareText(plan));
  });
  $("#qrCurrentPlan").addEventListener("click", async () => {
    const plan = await activePlan();
    if (plan) showPlanQr(plan);
  });
  $("#sharePlanPng").addEventListener("click", async () => {
    const plan = await activePlan();
    if (!plan) return;
    await sharePlanPng(plan);
  });
  $("#copyQrLink").addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#qrImportLink").value);
    toast("Plan link copied.");
  });
  $("#exportCurrentPlan").addEventListener("click", async () => {
    const plan = await activePlan();
    if (!plan) return;
    try {
      if (await sharePlanExportFile(plan)) {
        toast("WRSP backup shared.");
        return;
      }
    } catch {
      // Fall through to download when file sharing is unavailable or canceled.
    }
    downloadPlanExport(plan);
    toast("WRSP backup file downloaded.");
  });
  $("#duplicateCurrentPlan").addEventListener("click", async () => {
    const plan = await activePlan();
    if (!plan) return;
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
    const plan = await activePlan();
    if (plan) {
      currentPlanMode = "responder";
      renderCurrentPlan(plan);
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
  $("#shareApp")?.addEventListener("click", shareAppLink);
  $("#installAppHeader")?.addEventListener("click", installOrShowInstructions);
  $("#installAppHome")?.addEventListener("click", installOrShowInstructions);
  $("#installAppPage")?.addEventListener("click", installOrShowInstructions);
  $("#copyAppLink")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText(appShareUrl());
    toast("WRSP app link copied.");
  });
  $("#updateAppHeader")?.addEventListener("click", checkForAppUpdate);
  $("#updateAppHome")?.addEventListener("click", checkForAppUpdate);
  $("#checkForUpdate")?.addEventListener("click", checkForAppUpdate);
  ["safetyShareContactName", "safetyShareContactPhone", "safetyShareCheckIn", "safetyShareStartLocation", "safetyShareNotes"].forEach((id) => {
    $(`#${id}`)?.addEventListener("input", async () => {
      await updateSafetyShareMessage();
      await renderLiveLocationOptions();
    });
  });
  $("#safetyShareUseGps").addEventListener("click", async () => {
    await refreshEmergencyGps();
    if (emergencyCoords) {
      $("#safetyShareStartLocation").value = `${emergencyCoords.lat}, ${emergencyCoords.lng}`;
      await updateSafetyShareMessage();
      await renderLiveLocationOptions();
    }
  });
  $("#textTrustedContact").addEventListener("click", textTrustedContact);
  $("#sendSafetyPage").addEventListener("click", sendSafetyPage);
  $("#copySafetyShareMessage").addEventListener("click", async () => {
    await navigator.clipboard.writeText(await updateSafetyShareMessage());
    toast("Safety Share message copied.");
  });
  $("#confirmLiveLocationStarted").addEventListener("click", confirmLiveLocationStarted);
  $("#medicalUseGps").addEventListener("click", async () => {
    const position = await getCurrentPosition();
    $("#medicalSearchOrigin").value = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
  });
  $("#refreshPwaStatus").addEventListener("click", updatePwaStatus);
  $("#saveMedicalFacilityToPlan").addEventListener("click", saveMedicalFacilityToCurrentPlan);
  $("#findEr").addEventListener("click", () => prepareMedicalFacility("hospital"));
  $("#findUrgentCare").addEventListener("click", () => prepareMedicalFacility("urgentCare"));
  $("#findTrauma").addEventListener("click", () => prepareMedicalFacility("traumaCenter"));
  $("#medicalFacilityType").addEventListener("change", () => prepareMedicalFacility($("#medicalFacilityType").value, false));
  $("#openFacilityDirectionsSearch").addEventListener("click", () => {
    const type = $("#medicalFacilityType").value;
    const url = $("#medicalFacilityDirectionsUrl").value.trim();
    if (url) {
      window.open(url, "_blank", "noopener");
      return;
    }
    openMapsSearch(medicalSearchQueryForType(type));
  });
  $("#findStateWoodsAgency").addEventListener("click", () => localResponderSearch("stateWoods"));
  $("#findFireRescue").addEventListener("click", () => localResponderSearch("fireRescue"));
  $("#findSheriffSar").addEventListener("click", () => localResponderSearch("sheriffSar"));
  $("#findEmergencyManagement").addEventListener("click", () => localResponderSearch("emergencyManagement"));
  $("#copyResponderVerificationScript").addEventListener("click", async () => {
    await navigator.clipboard.writeText(responderVerificationText());
    toast("Responder verification script copied.");
  });
  $("#stampResponderVerificationDate").addEventListener("click", () => {
    const today = new Date().toLocaleDateString();
    const current = $("#verifiedResponderSource").value.trim();
    $("#verifiedResponderSource").value = current ? `${current}; verified ${today}` : `Verified ${today}`;
    scheduleAutoSave();
    toast("Verification date added.");
  });
  $("#appendVerifiedResponderContact").addEventListener("click", () => {
    const summary = verifiedResponderSummary();
    if (!summary) {
      toast("Add verified agency, phone, person, or source first.");
      return;
    }
    const notes = $("#sarContacts");
    notes.value = [notes.value.trim(), summary].filter(Boolean).join("\n");
    scheduleAutoSave();
    toast("Verified contact added to saved notes.");
  });
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
  $("#medicalCardForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    sharedMedicalCardPreview = null;
    await saveMedicalCard();
  });
  $("#medicalCardForm")?.addEventListener("input", () => {
    sharedMedicalCardPreview = null;
    renderMedicalCardOutput();
  });
  $("#shareMedicalCardTrusted")?.addEventListener("click", () => shareMedicalCardText("trusted"));
  $("#shareMedicalCardEms")?.addEventListener("click", () => shareMedicalCardText("ems"));
  $("#copyMedicalCard")?.addEventListener("click", async () => {
    await saveMedicalCard();
    await navigator.clipboard.writeText(medicalCardText("trusted"));
    $("#medicalCardStatus").textContent = "Medical card text copied.";
  });
  $("#printMedicalCard")?.addEventListener("click", async () => {
    await saveMedicalCard();
    document.body.dataset.printMode = "medical";
    window.print();
    window.setTimeout(() => {
      delete document.body.dataset.printMode;
    }, 800);
  });
  $("#shareMedicalCardPng")?.addEventListener("click", shareMedicalCardPng);
  $("#qrMedicalCard")?.addEventListener("click", async () => {
    await saveMedicalCard();
    showMedicalCardQr();
  });
  $("#copyMedicalQrLink")?.addEventListener("click", async () => {
    await navigator.clipboard.writeText($("#medicalQrLink").value);
    toast("Medical card link copied.");
  });
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
        $("#importStatus").textContent = "Choose a WRSP backup file first.";
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
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    toast("WRSP can be installed on this device.");
  });
  window.addEventListener("appinstalled", () => {
    deferredInstallPrompt = null;
    toast("WRSP installed.");
    updatePwaStatus();
  });
  navigator.serviceWorker?.addEventListener("controllerchange", () => {
    if (updateReloading) return;
    updateReloading = true;
    window.location.reload();
  });
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

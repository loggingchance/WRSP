const DB_NAME = "wrsp-db";
const DB_VERSION = 1;
const PLAN_STORE = "plans";
const SETTINGS_STORE = "settings";
const PREPAREDNESS_KEY = "preparedness";
const DEFAULTS_KEY = "defaults";
const SAFETY_SHARE_KEY = "safetyShare";
const MEDICAL_CARD_KEY = "medicalCard";
const APP_VERSION = "WRSP v0.8.3 - September 24, 2026";
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
let addressLookupBusy = false;
const addressLookupCache = new Map();
let preparedShare = null;
let shareInProgress = false;
let sharePreparationId = 0;
let pendingSharePlanId = null;
let pendingAddressSuggestion = null;
let siteMapState = {
  centerLat: 39.5,
  centerLng: -98.35,
  zoom: 10,
  dragging: false,
  dragStart: null,
  startCenter: null,
  moved: 0,
};
let landingZoneMapState = {
  centerLat: 39.5,
  centerLng: -98.35,
  zoom: 10,
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
  schemaVersion: 2,
  company: "",
  hazardChecks: [],
  equipment: { items: [], other: "", location: "" },
  emergencyProcedure: DEFAULT_EMERGENCY_PROCEDURE,
  copiedFrom: "",
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
    knownLandmarkLat: "",
    knownLandmarkLng: "",
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
    people: [],
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
  const plan = emptyPlan();
  plan.title = "EXAMPLE - Maple Hollow Timber Harvest";
  plan.creator = "Example only; replace before field use";
  plan.company = "Example Forestry";
  plan.importedFrom = "built-in-field-example";
  plan.location = { ...plan.location, lat: "44.033800", lng: "-72.318600", roadAddress: "742 Maple Hollow Road", town: "West Topsham", county: "Orange", state: "VT", source: "example" };
  plan.access = {
    ...plan.access,
    knownLandmark: "VT Routes 12 and 25, West Topsham",
    phoneDirections: "From Routes 12 and 25, travel east on Route 25 for 3.4 miles. Turn left onto Maple Hill Road. Continue 1.2 miles to the yellow gate on the right.",
    meetingPoint: "Yellow gate; a crew member will meet responders.",
    gateNotes: "Key in supervisor's pickup.",
    constraints: ["Narrow bridge", "Limited turnaround"],
    phoneServiceNotes: "Radio channel 3; cell service at gate.",
    landingZoneDescription: "Main landing",
    landingZoneSize: "200 x 180 ft",
    landingZoneNotes: "Wires along west edge.",
  };
  plan.contacts.people = [
    { name: "Alex Morgan", role: "Site lead", phone: "802-555-0101" },
    { name: "Jordan Lee", role: "Forester", phone: "802-555-0102" },
    { name: "Casey Reed", role: "Crew", phone: "802-555-0103" },
    { name: "Taylor Smith", role: "Landowner", phone: "802-555-0104" },
    { name: "Robin Davis", role: "Dispatcher", phone: "802-555-0105" },
  ];
  plan.hazardChecks = ["Active tree felling", "Log truck traffic", "Steep terrain"];
  plan.equipment = { items: ["First aid kit", "Fire extinguisher", "Radio"], other: "", location: "Supervisor's pickup" };
  plan.medical.notes = "Enter the checked hospital / ER for the actual job.";
  return plan;
}

async function ensureCompleteExamplePlan() {
  const plans = await storeAll(PLAN_STORE);
  const exists = plans.some((plan) => plan.importedFrom === "built-in-field-example");
  if (exists) return;
  await storePut(PLAN_STORE, samplePlan());
}

async function openCompleteExamplePlan() {
  await ensureCompleteExamplePlan();
  const plans = await storeAll(PLAN_STORE);
  const plan = plans.find((item) => item.importedFrom === "built-in-field-example");
  if (!plan) return;
  await openPlan(plan.id);
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
    centerNewSiteMap();
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

function contactRowsFromForm() {
  return $$("#planPeopleGrid [id^=\"contactName\"]").map((input) => Number(input.id.replace("contactName", ""))).map((index) => ({
    name: $(`#contactName${index}`)?.value.trim() || "",
    role: $(`#contactRole${index}`)?.value.trim() || "",
    phone: $(`#contactPhone${index}`)?.value.trim() || "",
  })).filter((person) => person.name || person.role || person.phone);
}

function formatContactRow(person = {}) {
  const nameRole = [person.name, person.role && `(${person.role})`].filter(Boolean).join(" ");
  return [nameRole, person.phone].filter(Boolean).join(" - ");
}

function contactRowsForPlan(plan = {}) {
  const contacts = plan.contacts || {};
  if (Array.isArray(contacts.people) && contacts.people.length) {
    return contacts.people.map((person) => ({
      name: person.name || "",
      role: person.role || "",
      phone: person.phone || "",
    }));
  }
  const legacyRows = [
    ["", "Logger / crew lead", contacts.primaryContact],
    ["", "Crew", contacts.supervisor],
    ["", "Forester", contacts.foresterContact],
    ["", "Landowner", contacts.landowner],
    ["", "Other", contacts.truckingContact],
  ];
  return legacyRows
    .filter(([, , value]) => value)
    .map(([, role, value]) => ({ name: value, role, phone: "" }));
}

function formToPlan() {
  const id = $("#planId").value || crypto.randomUUID();
  const now = new Date().toISOString();
  const people = contactRowsFromForm();
  return {
    ...emptyPlan(),
    id,
    title: $("#title").value.trim(),
    company: $("#planCompany").value.trim(),
    importedFrom: $("#planForm").dataset.importedFrom || "",
    copiedFrom: $("#planForm").dataset.copiedFrom || "",
    hazardChecks: selectedFields("hazardChecks"),
    equipment: { items: selectedFields("equipmentChecks"), other: $("#equipmentOther").value.trim(), location: $("#equipmentLocation").value.trim() },
    emergencyProcedure: $("#emergencyProcedure").value.trim() || DEFAULT_EMERGENCY_PROCEDURE,
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
      constraints: selectedFields("accessChecks"),
      landingZoneSize: $("#landingZoneSize").value.trim(),
      knownLandmark: $("#knownLandmark").value.trim(),
      knownLandmarkLat: $("#knownLandmarkLat").value.trim(),
      knownLandmarkLng: $("#knownLandmarkLng").value.trim(),
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
      people,
      primaryContact: formatContactRow(people[0]),
      supervisor: formatContactRow(people[1]),
      foresterContact: formatContactRow(people[2]),
      landowner: formatContactRow(people[3]),
      truckingContact: formatContactRow(people[4]),
    },
    medical: {
      hospital: $("#hospital").value.trim(),
      hospitalTown: $("#hospitalTown").value.trim(),
      hospitalAddress: $("#hospitalAddress").value.trim(),
      hospitalDriveTime: $("#hospitalDriveTime").value.trim(),
      hospitalVerified: $("#hospitalVerified").checked,
      hospitalDirectionsUrl: $("#hospitalDirectionsUrl").value.trim(),
      urgentCare: $("#urgentCare")?.value.trim() || "",
      urgentCareDirectionsUrl: $("#urgentCareDirectionsUrl")?.value.trim() || "",
      traumaCenter: $("#traumaCenter")?.value.trim() || "",
      traumaDirectionsUrl: $("#traumaDirectionsUrl")?.value.trim() || "",
      notes: $("#medicalNotes").value.trim(),
    },
    sar: {
      contacts: $("#sarContacts").value.trim(),
      verifiedAgency: "",
      verifiedPhone: "",
      verifiedPerson: "",
      verifiedSource: "",
    },
    hazards: $("#hazards").value.trim(),
  };
}

function planReadiness(plan = formToPlan()) {
  const loc = plan.location || {};
  const access = plan.access || {};
  const hasLocation = Boolean((loc.lat && loc.lng) || loc.roadAddress || loc.town || loc.county);
  const hasDirections = Boolean(access.phoneDirections);
  const hasJobContact = contactRowsForPlan(plan).some((person) => person.name || person.phone);
  const usableChecks = [
    { label: "site name", done: Boolean(plan.title) },
    { label: "site location", done: hasLocation },
    { label: "written responder directions", done: hasDirections },
    { label: "job contact", done: hasJobContact },
  ];
  const completeChecks = [
    { label: "exact GPS/map pin", done: Boolean(loc.lat && loc.lng) },
    { label: "read-aloud 911 directions", done: Boolean(access.phoneDirections) },
    { label: "job contact", done: hasJobContact },
    { label: "meeting/access notes", done: Boolean(access.meetingPoint || access.routeNotes || access.gateNotes) },
  ];
  const usableDone = usableChecks.filter((check) => check.done).length;
  const completeDone = completeChecks.filter((check) => check.done).length;
  if (completeDone === completeChecks.length) {
    return { value: "complete", label: "Complete", checks: completeChecks, missing: [] };
  }
  if (usableDone >= 4) {
    return { value: "usable", label: "Usable", checks: usableChecks, missing: completeChecks.filter((check) => !check.done) };
  }
  return { value: "draft", label: "Draft", checks: usableChecks, missing: usableChecks.filter((check) => !check.done) };
}

function syncReadinessStatus(plan = formToPlan()) {
  const readiness = planReadiness(plan);
  const statusField = $("#status");
  const guidance = $("#readinessGuidance");
  if (statusField) statusField.value = readiness.value;
  if (guidance) {
    if (readiness.value === "complete") {
      guidance.textContent = "Complete: key field items are in place and ready to share.";
    } else if (readiness.value === "usable") {
      const next = readiness.missing[0]?.label || "remaining details";
      guidance.textContent = `Usable: better than no plan. Add ${next} to move closer to complete.`;
    } else {
      const next = readiness.missing[0]?.label || "more details";
      guidance.textContent = `Draft: save it anyway. Add ${next} to make it usable.`;
    }
  }
  return readiness;
}

function planToForm(plan) {
  window.clearTimeout(autoSaveTimer);
  currentPlanId = plan.id;
  $("#planForm").dataset.importedFrom = plan.importedFrom || "";
  $("#planId").value = plan.id;
  $("#planForm").dataset.createdAt = plan.createdAt;
  $("#planForm").dataset.accuracy = plan.location?.accuracy || "";
  $("#planForm").dataset.capturedAt = plan.location?.capturedAt || "";
  $("#planForm").dataset.locationSource = plan.location?.source || "";
  $("#title").value = plan.title || "";
  $("#planCompany").value = plan.company || "";
  $("#planForm").dataset.copiedFrom = plan.copiedFrom || "";
  $("#copiedPlanNotice").hidden = !plan.copiedFrom;
  fieldCheckboxes("hazardChecks", plan.hazardChecks || []);
  fieldCheckboxes("accessChecks", plan.access?.constraints || []);
  fieldCheckboxes("equipmentChecks", plan.equipment?.items || []);
  $("#equipmentOther").value = plan.equipment?.other || "";
  $("#equipmentLocation").value = plan.equipment?.location || "";
  $("#emergencyProcedure").value = plan.emergencyProcedure || DEFAULT_EMERGENCY_PROCEDURE;
  $("#landingZoneSize").value = plan.access?.landingZoneSize || "";
  $("#hospitalTown").value = plan.medical?.hospitalTown || "";
  $("#hospitalAddress").value = plan.medical?.hospitalAddress || "";
  $("#hospitalDriveTime").value = plan.medical?.hospitalDriveTime || "";
  $("#hospitalVerified").checked = Boolean(plan.medical?.hospitalVerified);
  refreshRecentPeople();

  $("#status").value = plan.status || "draft";
  $("#creator").value = plan.creator || "";
  $("#lat").value = plan.location?.lat || "";
  $("#lng").value = plan.location?.lng || "";
  $("#roadAddress").value = plan.location?.roadAddress || "";
  $("#town").value = plan.location?.town || "";
  $("#county").value = plan.location?.county || "";
  $("#state").value = plan.location?.state || "";
  $("#knownLandmark").value = plan.access?.knownLandmark || "";
  $("#knownLandmarkLat").value = plan.access?.knownLandmarkLat || "";
  $("#knownLandmarkLng").value = plan.access?.knownLandmarkLng || "";
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
  renderPeopleFields(contactRowsForPlan(plan));
  $("#hospital").value = plan.medical?.hospital || "";
  $("#hospitalDirectionsUrl").value = plan.medical?.hospitalDirectionsUrl || "";
  if ($("#urgentCare")) $("#urgentCare").value = plan.medical?.urgentCare || "";
  if ($("#urgentCareDirectionsUrl")) $("#urgentCareDirectionsUrl").value = plan.medical?.urgentCareDirectionsUrl || "";
  if ($("#traumaCenter")) $("#traumaCenter").value = plan.medical?.traumaCenter || "";
  if ($("#traumaDirectionsUrl")) $("#traumaDirectionsUrl").value = plan.medical?.traumaDirectionsUrl || "";
  $("#medicalNotes").value = plan.medical?.notes || "";
  $("#sarContacts").value = emergencyNotes(plan);
  $("#hazards").value = plan.hazards || "";
  syncReadinessStatus(plan);
  updateGpsStatus(plan);
  updateEssentialProgress();
  const lat = parseFloat(plan.location?.lat);
  const lng = parseFloat(plan.location?.lng);
  if (Number.isFinite(lat) && Number.isFinite(lng)) centerSiteMap(lat, lng, Math.max(siteMapState.zoom, 17));
  const lzLat = parseFloat(plan.access?.landingZoneLat);
  const lzLng = parseFloat(plan.access?.landingZoneLng);
  if (Number.isFinite(lzLat) && Number.isFinite(lzLng)) {
    centerLandingZoneMap(lzLat, lzLng, Math.max(landingZoneMapState.zoom, 17));
  } else if (Number.isFinite(lat) && Number.isFinite(lng)) {
    centerLandingZoneMap(lat, lng, Math.max(landingZoneMapState.zoom, 17));
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
    supervisor: $("#defaultSupervisor").value.trim(),
    foresterContact: $("#defaultForesterContact").value.trim(),
    landowner: $("#defaultLandowner").value.trim(),
    truckingContact: $("#defaultTruckingContact").value.trim(),
    sarContacts: $("#defaultSarContacts").value.trim(),
    medicalNotes: $("#defaultMedicalNotes").value.trim(),
    geoapifyKey: $("#defaultGeoapifyKey").value.trim(),
  };
}

async function loadDefaultsForm() {
  const defaults = await loadDefaults();
  $("#defaultCreator").value = defaults.creator || "";
  $("#defaultCompany").value = defaults.company || "";
  $("#defaultState").value = defaults.state || "";
  $("#defaultPrimaryContact").value = defaults.primaryContact || "";
  $("#defaultSupervisor").value = defaults.supervisor || "";
  $("#defaultForesterContact").value = defaults.foresterContact || "";
  $("#defaultLandowner").value = defaults.landowner || "";
  $("#defaultTruckingContact").value = defaults.truckingContact || "";
  $("#defaultSarContacts").value = defaults.sarContacts || "";
  $("#defaultMedicalNotes").value = defaults.medicalNotes || "";
  $("#defaultGeoapifyKey").value = defaults.geoapifyKey || "";
}

function applyDefaultsToPlanObject(plan, defaults) {
  plan.creator ||= defaults.creator || "";
  plan.company ||= defaults.company || "";
  plan.location = plan.location || {};
  plan.location.state ||= defaults.state || "";
  plan.contacts = plan.contacts || {};
  plan.contacts.primaryContact ||= defaults.primaryContact || "";
  plan.contacts.supervisor ||= defaults.supervisor || "";
  plan.contacts.foresterContact ||= defaults.foresterContact || "";
  plan.contacts.landowner ||= defaults.landowner || "";
  plan.contacts.truckingContact ||= defaults.truckingContact || "";
  plan.sar = plan.sar || {};
  plan.sar.contacts ||= defaults.sarContacts || "";
  plan.medical = plan.medical || {};
  plan.medical.notes ||= defaults.medicalNotes || "";
  return plan;
}

async function newPlanWithDefaults() {
  const plan = applyDefaultsToPlanObject(emptyPlan(), await loadDefaults());
  const profile = (await storeGet(SETTINGS_STORE, RECURRING_PROFILE_KEY))?.value;
  if (profile) {
    plan.contacts.people = structuredClone(profile.people || []);
    plan.creator = profile.creator || plan.creator;
    plan.company = profile.company || plan.company;
    plan.emergencyProcedure = profile.emergencyProcedure || DEFAULT_EMERGENCY_PROCEDURE;
    plan.equipment = structuredClone(profile.equipment || plan.equipment);
    plan.sar.contacts = profile.sarContacts || plan.sar.contacts;
  }
  return plan;
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

async function centerNewSiteMap() {
  if ($("#lat").value || $("#lng").value || siteMapState.locating) return;
  const original = [siteMapState.centerLat, siteMapState.centerLng, siteMapState.zoom].join(",");
  const planId = $("#planId").value;
  siteMapState.locating = true;
  try {
    const position = await getCurrentPosition();
    if (planId !== $("#planId").value || $("#lat").value || $("#lng").value ||
      original !== [siteMapState.centerLat, siteMapState.centerLng, siteMapState.zoom].join(",")) return;
    centerSiteMap(position.coords.latitude, position.coords.longitude, 17);
    centerNearbyMaps(position.coords.latitude, position.coords.longitude);
  } catch {
    // Location is optional; the map and manual fields remain available.
  } finally {
    siteMapState.locating = false;
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
  pendingAddressSuggestion = null;
  $("#addressSuggestionPanel").hidden = true;
  $("#lat").value = safeLat.toFixed(6);
  $("#lng").value = safeLng.toFixed(6);
  $("#planForm").dataset.accuracy = "";
  $("#planForm").dataset.capturedAt = new Date().toISOString();
  $("#planForm").dataset.locationSource = "map pin";
  updateGpsStatus();
  updateEssentialProgress();
  if (center) centerSiteMap(safeLat, safeLng, Math.max(siteMapState.zoom, 17));
  centerNearbyMaps(safeLat, safeLng);
  scheduleAutoSave();
}

function centerNearbyMaps(lat, lng) {
  if (!$("#landingZoneLat").value && !$("#landingZoneLng").value) centerLandingZoneMap(lat, lng, 17);
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
  pendingAddressSuggestion = null;
  $("#addressSuggestionPanel").hidden = true;
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

function clearLandmarkCoordinates() {
  $("#knownLandmarkLat").value = "";
  $("#knownLandmarkLng").value = "";
  scheduleAutoSave();
}

function cleanCountyName(value = "") {
  return value.replace(/\s+County$/i, "").trim();
}

function addressFromGeoapifyProperties(properties = {}) {
  const road = properties.address_line1
    || [properties.housenumber, properties.street].filter(Boolean).join(" ")
    || properties.name
    || properties.formatted
    || "";
  const town = properties.city
    || properties.town
    || properties.village
    || properties.hamlet
    || properties.district
    || properties.municipality
    || properties.suburb
    || "";
  const county = cleanCountyName(properties.county || "");
  const state = properties.state_code || properties.state || "";
  const display = [road, town, county && `${county} County`, state].filter(Boolean).join(", ");
  return { roadAddress: road, town, county, state, display };
}

function setAddressSuggestionStatus(message) {
  const panel = $("#addressSuggestionPanel");
  const status = $("#addressSuggestionStatus");
  if (panel) panel.hidden = false;
  if (status) status.textContent = message;
}

async function suggestAddressFromPin() {
  if (addressLookupBusy) return;
  const lat = parseFloat($("#lat").value);
  const lng = parseFloat($("#lng").value);
  const text = $("#addressSuggestionText");
  pendingAddressSuggestion = null;
  text.textContent = "";
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    setAddressSuggestionStatus("Drop a site pin or enter valid coordinates first.");
    return;
  }
  const key = `${lat.toFixed(6)},${lng.toFixed(6)}`;
  addressLookupBusy = true;
  $("#suggestAddressFromPin").disabled = true;
  setAddressSuggestionStatus("Looking up the nearest road and town...");
  try {
    let suggestion = addressLookupCache.get(key);
    if (!suggestion) {
      const defaults = await loadDefaults();
      const apiKey = defaults.geoapifyKey || "";
      const nearbyRoad = new URLSearchParams({ lat, lon: lng, lang: "en", limit: "1", layer: "street", radius: "10" });
      ["path", "footway", "cycleway", "steps", "bridleway", "track", "pedestrian"].forEach((kind) => nearbyRoad.append("osm_tag", `!highway:${kind}`));
      const url = apiKey
        ? `https://api.geoapify.com/v1/geocode/reverse?lat=${lat}&lon=${lng}&format=geojson&apiKey=${encodeURIComponent(apiKey)}`
        : `https://photon.komoot.io/reverse?${nearbyRoad}`;
      const response = await fetch(url, { headers: { Accept: "application/json" }, signal: AbortSignal.timeout(12000) });
      if (!response.ok) throw new Error("Address lookup unavailable");
      const data = await response.json();
      const properties = data.features?.[0]?.properties;
      if (!properties) throw new Error("No nearby address found");
      suggestion = addressFromGeoapifyProperties(properties);
      if (!suggestion.display) throw new Error("No usable address fields");
      addressLookupCache.set(key, suggestion);
    }
    if (parseFloat($("#lat").value) !== lat || parseFloat($("#lng").value) !== lng) return;
    pendingAddressSuggestion = suggestion;
    text.textContent = suggestion.display;
    setAddressSuggestionStatus("Nearby road / place, not a street address assigned to this pin. Check before using.");
  } catch {
    if (parseFloat($("#lat").value) === lat && parseFloat($("#lng").value) === lng) {
      setAddressSuggestionStatus("Address lookup unavailable. Check your connection, open the pin in Google Maps, or enter the road and town below.");
    }
  } finally {
    addressLookupBusy = false;
    $("#suggestAddressFromPin").disabled = false;
  }
}

function openSitePinInGoogleMaps() {
  const lat = parseFloat($("#lat").value);
  const lng = parseFloat($("#lng").value);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
    toast("Drop a site pin or enter coordinates first.");
    return;
  }
  openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${lat.toFixed(6)},${lng.toFixed(6)}`)}`);
}

function usePendingAddressSuggestion(editAfterUse = false) {
  if (!pendingAddressSuggestion) {
    setAddressSuggestionStatus("No address suggestion is ready yet.");
    return;
  }
  const suggestion = pendingAddressSuggestion;
  if (suggestion.roadAddress) $("#roadAddress").value = suggestion.roadAddress;
  if (suggestion.town) $("#town").value = suggestion.town;
  if (suggestion.county) $("#county").value = suggestion.county;
  if (suggestion.state) $("#state").value = suggestion.state;
  syncReadinessStatus();
  updateEssentialProgress();
  scheduleAutoSave();
  setAddressSuggestionStatus(editAfterUse ? "Suggestion copied into the form. Edit the road, town, county, or state before relying on it." : "Suggestion copied into the form.");
  if (editAfterUse) $("#roadAddress").focus();
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
  window.clearTimeout(autoSaveTimer);
  if (!plan.title) plan.title = "Untitled WRSP Plan";
  plan.status = planReadiness(plan).value;
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
  const readiness = planReadiness(plan);
  const checks = [
    { label: "site name", done: readiness.checks.find((check) => check.label === "site name")?.done || readiness.value === "complete" },
    { label: "site location", done: readiness.checks.find((check) => check.label === "site location")?.done || readiness.value === "complete" },
    { label: "written responder directions", done: readiness.checks.find((check) => check.label === "written responder directions")?.done || readiness.value === "complete" },
    { label: "job contact", done: readiness.checks.find((check) => check.label === "job contact")?.done || readiness.value === "complete" },
  ];
  return { checks, done: checks.filter((check) => check.done).length, total: checks.length };
}

function updateEssentialProgress() {
  const progressText = $("#essentialProgressText");
  const progressBar = $("#essentialProgressBar");
  const checklist = $("#minimumPlanChecklist");
  if (!progressText || !progressBar) return;
  const status = essentialStatus();
  progressText.textContent = `${status.done} of ${status.total} plan essentials added`;
  progressBar.style.width = `${(status.done / status.total) * 100}%`;
  if (checklist) {
    checklist.innerHTML = status.checks.map((check) => `
      <li class="${check.done ? "done" : ""}">
        <span aria-hidden="true">${check.done ? "OK" : "Add"}</span>
        ${escapeHtml(check.label)}
      </li>
    `).join("");
  }
}

function shareReadinessHtml(plan) {
  const status = essentialStatus(plan);
  const label = planReadiness(plan).label;
  return `
    <strong>Before you share: ${escapeHtml(label)}</strong>
    <ul class="minimum-checklist compact">
      ${status.checks.map((check) => `
        <li class="${check.done ? "done" : ""}">
          <span aria-hidden="true">${check.done ? "OK" : "Add"}</span>
          ${escapeHtml(check.label)}
        </li>
      `).join("")}
    </ul>
    <p class="helper">WRSP will still let you share a partial plan. Add missing items when you can.</p>
  `;
}

function completenessHint(plan) {
  const readiness = planReadiness(plan);
  if (readiness.value === "complete") {
    return `<p class="complete-hint ready">Complete: key field items are in place.</p>`;
  }
  if (readiness.value === "usable") {
    const next = readiness.missing[0]?.label || "remaining details";
    return `<button class="complete-hint ready" id="completePlanHint">Usable: better than no plan. Add ${escapeHtml(next)} when you can.</button>`;
  }
  const missing = readiness.missing[0];
  return `<button class="complete-hint needs-work" id="completePlanHint">Draft: add ${escapeHtml(missing?.label || "more details")} to make this plan usable</button>`;
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
    const readiness = planReadiness(plan);
    return `
      <article class="plan-card">
        <div>
          <h3>${escapeHtml(plan.title || "Untitled WRSP Plan")}</h3>
          <p>${escapeHtml(location || plan.location?.roadAddress || "Location not named")}</p>
          <p><span class="status-pill ${escapeHtml(readiness.value)}">${escapeHtml(readiness.label)}</span> Updated ${formatDate(plan.updatedAt)}</p>
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
  const readiness = planReadiness(plan);
  card.hidden = false;
  card.innerHTML = `
    <div>
      <p class="eyebrow">Continue</p>
      <h3>${escapeHtml(plan.title || "Untitled WRSP Plan")}</h3>
      <p>${escapeHtml(location || plan.location?.roadAddress || "Location not named")} - ${escapeHtml(readiness.label)} - Updated ${formatDate(plan.updatedAt)}</p>
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

async function planForSharing() {
  if (pendingSharePlanId) return storeGet(PLAN_STORE, pendingSharePlanId);
  return activePlan();
}

async function openShareChoice(planId = null) {
  pendingSharePlanId = planId;
  preparedShare = null;
  const requestId = ++sharePreparationId;
  setShareChoiceStatus("Preparing plan...");
  $("#shareChoicePanel").hidden = false;
  $("#shareChoiceReadiness").textContent = "";
  $("#shareChoiceWarnings").hidden = true;
  $("#shareFallback").hidden = true;
  $("#retrySharePreparation").hidden = true;
  ["shareChoicePng", "shareChoicePdf", "shareChoiceEmailDraft"].forEach((id) => { $(`#${id}`).disabled = true; });
  try {
    const plan = await planForSharing();
    if (requestId !== sharePreparationId) return;
    if (!plan) throw new Error("Open a saved plan first.");
    $("#shareChoiceReadiness").textContent = "The full plan is included every time.";
    const warnings = [];
    if (!validFieldCoordinates(plan.location?.lat, plan.location?.lng)) warnings.push("Site coordinates are missing or invalid.");
    if (!plan.access?.phoneDirections?.trim()) warnings.push("Written responder directions are missing.");
    if (plan.medical?.hospital && !plan.medical?.hospitalVerified) warnings.push("Hospital / ER details have not been confirmed.");
    $("#shareChoiceWarnings").textContent = warnings.join(" ") + (warnings.length ? " You can still send the information entered, or edit the plan." : "");
    $("#shareChoiceWarnings").hidden = !warnings.length;
    const body = encodeURIComponent(planShareText(plan));
    $("#shareEmailTextOnly").href = `mailto:?subject=${encodeURIComponent(`WRSP: ${plan.title || "Safety Plan"}`)}&body=${body}`;
    const appleMobile = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    $("#shareMessageTextOnly").href = `sms:${appleMobile ? "&" : "?"}body=${body}`;
    // Prepare attachments before the next tap; native sharing needs that tap's activation.
    const pages = planPdfPages(plan);
    const files = { plan };
    const failures = [];
    try { files.pdf = new File([await planPdfBlob(plan, pages)], `${safeFileName(plan.title)}.pdf`, { type: "application/pdf" }); }
    catch (error) { failures.push(`PDF: ${error.message}`); }
    try {
      const imageBlob = await new Promise(resolve => pages[0].toBlob(resolve, "image/jpeg", 0.82));
      if (!imageBlob) throw new Error("Could not prepare the plan image.");
      files.image = new File([imageBlob], `${safeFileName(plan.title)}.jpg`, { type: "image/jpeg" });
    } catch (error) { failures.push(`Image: ${error.message}`); }
    if (files.pdf) {
      try { files.email = await planEmailFile(plan, files.pdf); }
      catch (error) { failures.push(`Email draft: ${error.message}`); }
    }
    if (requestId !== sharePreparationId) return;
    preparedShare = files;
    syncShareButtons();
    $("#retrySharePreparation").hidden = !failures.length;
    setShareChoiceStatus(failures.join(" "));
  } catch (error) {
    if (requestId === sharePreparationId) {
      $("#retrySharePreparation").hidden = false;
      setShareChoiceStatus(`Could not prepare the attachment: ${error.message}`);
    }
  }
}

function closeShareChoice() {
  sharePreparationId += 1;
  $("#shareChoicePanel").hidden = true;
}

async function shareChosenPlan(format) {
  if (shareInProgress) return;
  if (!preparedShare) { setShareChoiceStatus("The plan is not ready yet. Wait for preparation or choose Prepare Plan Again."); return; }
  const { plan, pdf, image, email } = preparedShare;
  const file = format === "pdf" ? pdf : format === "email-draft" ? email : image;
  if (!file) { setShareChoiceStatus("This attachment is not ready. Choose Prepare Plan Again."); return; }
  const requestId = sharePreparationId;
  shareInProgress = true;
  syncShareButtons();
  $("#shareFallback").hidden = true;
  try {
    if (format === "email-draft") {
      await fallbackDownloadFile(email, "Email draft downloaded with the formatted plan and PDF attached. Open the downloaded .eml file in a compatible email app to address and send.");
    } else {
      // No asynchronous work before this call: preserve the user's tap for iOS.
      const sent = await shareFileAttachment(file, `WRSP: ${plan.title}`, format === "pdf"
        ? "PDF downloaded. This browser could not open file sharing."
        : "Image downloaded. This browser could not open file sharing.", planShareText(plan), format === "pdf" ? email : null);
      if (!sent && requestId === sharePreparationId && !$("#shareChoiceStatus").textContent.includes("canceled")) {
        $("#shareFallback").hidden = false;
        $("#shareEmailTextOnly").hidden = format !== "pdf";
        $("#shareMessageTextOnly").hidden = format === "pdf";
      }
    }
  } catch (error) {
    if (requestId === sharePreparationId) setShareChoiceStatus(`Could not open sharing: ${error.message}. Try again or download the formatted email draft.`);
  } finally {
    shareInProgress = false;
    syncShareButtons();
  }
}

function renderCurrentPlan(plan) {
  $("#planOutput").innerHTML = currentPlanMode === "responder" ? renderResponderPlanHtml(plan) : renderPlanHtml(plan);
  try {
    planPdfPages(plan);
    $("#shareReadinessCard").textContent = "One-page plan ready for review.";
  } catch (error) {
    $("#shareReadinessCard").textContent = error.message;
  }
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
  return renderFieldPlanHtml(plan);
}

function renderResponderPlanHtml(plan) {
  return renderFieldPlanHtml(plan);
}

function buildEmergencyDirections(plan) {
  return fieldPlanData(plan).emergency.rows.map(row => `${row.label}: ${row.text}`).join("\n");
}

function emergencyNotes(plan) {
  const sar = plan.sar || {};
  const oldContact = [sar.verifiedAgency, sar.verifiedPhone, sar.verifiedPerson, sar.verifiedSource].filter(Boolean).join(" - ");
  return [sar.contacts, oldContact && !sar.contacts?.includes(oldContact) ? oldContact : ""].filter(Boolean).join("\n");
}

function planDirectionsUrl(plan) {
  const loc = plan.location || {};
  if (!loc.lat || !loc.lng) return "";
  const access = plan.access || {};
  const params = new URLSearchParams({ api: "1", destination: `${loc.lat},${loc.lng}`, travelmode: "driving" });
  const origin = access.knownLandmarkLat && access.knownLandmarkLng
    ? `${access.knownLandmarkLat},${access.knownLandmarkLng}`
    : access.knownLandmark;
  if (origin) params.set("origin", origin);
  return `https://www.google.com/maps/dir/?${params}`;
}

function peopleTableHtml(plan) {
  const people = contactRowsForPlan(plan);
  if (!people.length) return "<p>Not entered</p>";
  return `<table class="people-table" style="border-collapse:collapse;width:100%;text-align:left">
    <thead><tr>${["Name", "Role", "Contact number"].map((label) => `<th scope="col" style="padding:8px;border-bottom:2px solid #38564a">${label}</th>`).join("")}</tr></thead>
    <tbody>${people.map((person) => `<tr>${[person.name, person.role, person.phone].map((value) => `<td style="padding:8px;border-bottom:1px solid #d8ded5;overflow-wrap:anywhere">${escapeHtml(value || "")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
}

function planShareText(plan) { return fieldPlanText(plan); }

function planEmailHtml(plan) { return fieldPlanEmailHtml(plan); }

async function shareText(title, text) {
  if (navigator.share) {
    await navigator.share({ title, text });
    return;
  }
  await navigator.clipboard.writeText(text);
  toast("Sharing is not available here, so the text was copied.");
}

function setShareChoiceStatus(message) {
  const status = $("#shareChoiceStatus");
  if (status) status.textContent = message || "";
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
  if (importUrl.length > 2200) {
    linkBox.value = "Plan is too large for a reliable QR/backup link. Use Text Image, PDF / Print, or Backup File.";
    image.removeAttribute("src");
    image.hidden = true;
    help.textContent = "This plan is too large for a reliable QR backup link. Use Text Image for texting, PDF / Print for email/AirDrop/Files, or Backup File if someone needs an editable WRSP backup.";
    return;
  }
  linkBox.value = importUrl;
  image.hidden = false;
  image.src = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(importUrl)}`;
  help.textContent = "Scan this code only when someone needs to open the WRSP backup link. For normal offline sharing, use Text Image or PDF / Print.";
}

function planPngRows(plan) {
  const data = fieldPlanData(plan);
  return [data.emergency, ...data.left, ...data.right, data.actions].map(section => [section.title, section.rows.map(row => `${row.label ? row.label + ": " : ""}${row.text}${row.url ? "\n" + row.url : ""}`).join("\n")]);
}

function canvasTextLines(ctx, text, maxWidth) {
  const lines = [];
  for (const paragraph of String(text || " ").split("\n")) {
    let line = "";
    for (const word of paragraph.split(/\s+/)) {
      if (line && ctx.measureText(`${line} ${word}`).width > maxWidth) {
        lines.push(line);
        line = "";
      }
      for (const char of (line ? " " : "") + word) {
        if (line && ctx.measureText(line + char).width > maxWidth) {
          lines.push(line);
          line = "";
        }
        line += char;
      }
    }
    lines.push(line);
  }
  return lines;
}

function wrappedLineCount(ctx, text, maxWidth) {
  return canvasTextLines(ctx, text, maxWidth).length;
}

function canvasSectionHeight(ctx, value, width) {
  ctx.font = "32px Arial";
  const lines = String(value || "Not entered").split("\n").reduce((total, part) => total + wrappedLineCount(ctx, part, width), 0);
  return 112 + Math.max(1, lines) * 39;
}

function roundRect(ctx, x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawCanvasBlock(ctx, label, value, x, y, width) {
  const innerX = x + 24;
  const innerWidth = width - 48;
  const height = canvasSectionHeight(ctx, value, innerWidth);
  ctx.fillStyle = "#ffffff";
  roundRect(ctx, x, y, width, height, 14);
  ctx.fill();
  ctx.strokeStyle = "#d8ded5";
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = "#123c2c";
  ctx.font = "900 31px Arial";
  ctx.fillText(label, innerX, y + 45);
  ctx.fillStyle = "#1d2520";
  ctx.font = "32px Arial";
  let textY = y + 88;
  String(value || "Not entered").split("\n").forEach((part) => {
    textY = wrapCanvasText(ctx, part || " ", innerX, textY, innerWidth, 39);
  });
  return y + height + 18;
}

function planCanvas(plan) { return fieldPlanPdfPages(plan)[0]; }

async function fallbackDownloadFile(file, message) {
  const blob = file instanceof Blob ? file : new Blob([file]);
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = file.name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 60000);
  setShareChoiceStatus(message);
  toast(message);
}

async function shareFileAttachment(file, title, fallbackMessage, text = "", emailFallback = null) {
  if (navigator.share) {
    try {
      const canShareFile = !navigator.canShare || navigator.canShare({ files: [file] });
      if (canShareFile) {
        await navigator.share({ title, ...(text ? { text } : {}), files: [file] });
        setShareChoiceStatus("File sent to the phone share sheet. Choose Messages, Mail, AirDrop, or another app.");
        return true;
      } else {
        setShareChoiceStatus("This browser will not attach this file through the share sheet.");
      }
    } catch (error) {
        if (error.name === "AbortError") {
          setShareChoiceStatus("Sharing canceled.");
          return false;
        }
        setShareChoiceStatus(`The phone would not attach this file: ${error.message}`);
    }
  } else {
    setShareChoiceStatus("This browser does not support file sharing from WRSP.");
  }
  await fallbackDownloadFile(emailFallback || file, emailFallback
    ? "Email draft saved with the complete plan and PDF attached. Open it in your email app to address and send."
    : fallbackMessage);
  return false;
}

async function sharePlanPng(plan) {
  const canvas = planCanvas(plan);
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
  const file = new File([blob], `${safeFileName(plan.title || "wrsp-plan")}.jpg`, { type: "image/jpeg" });
  await shareFileAttachment(
    file,
    `WRSP: ${plan.title}`,
    "Image saved. This browser could not share the image and plan text together.",
    planShareText(plan)
  );
}

function pdfEscape(value = "") {
  return String(value).replace(/[\\()]/g, "\\$&");
}

async function canvasJpegBytes(canvas) {
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.88));
  return new Uint8Array(await blob.arrayBuffer());
}

function planPdfPages(plan) { return fieldPlanPdfPages(plan); }

async function planPdfBlob(plan, pages = planPdfPages(plan)) {
  const encoder = new TextEncoder();
  const chunks = [];
  const offsets = [0];
  let length = 0;
  const append = (value) => {
    const bytes = typeof value === "string" ? encoder.encode(value) : value;
    chunks.push(bytes);
    length += bytes.length;
  };
  const object = (id, body) => {
    offsets[id] = length;
    append(`${id} 0 obj\n${body}\nendobj\n`);
  };
  append("%PDF-1.4\n");
  object(1, "<< /Type /Catalog /Pages 2 0 R >>");
  object(2, `<< /Type /Pages /Kids [${pages.map((_, index) => `${3 + index * 3} 0 R`).join(" ")}] /Count ${pages.length} >>`);
  for (let index = 0; index < pages.length; index += 1) {
    const canvas = pages[index];
    const id = 3 + index * 3;
    const jpeg = await canvasJpegBytes(canvas);
    const content = "q\n612 0 0 792 0 0 cm\n/Im0 Do\nQ\n";
    const links = canvas.links.map(({ url, rect }) => `<< /Type /Annot /Subtype /Link /Rect [${rect.join(" ")}] /Border [0 0 0] /A << /S /URI /URI (${pdfEscape(url)}) >> >>`).join(" ");
    object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /XObject << /Im0 ${id + 2} 0 R >> >> /Contents ${id + 1} 0 R /Annots [${links}] >>`);
    object(id + 1, `<< /Length ${encoder.encode(content).length} >>\nstream\n${content}endstream`);
    offsets[id + 2] = length;
    append(`${id + 2} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${canvas.width} /Height ${canvas.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    append(jpeg);
    append("\nendstream\nendobj\n");
  }
  const xrefAt = length;
  const size = 3 + pages.length * 3;
  append(`xref\n0 ${size}\n0000000000 65535 f \n`);
  for (let id = 1; id < size; id += 1) append(`${String(offsets[id]).padStart(10, "0")} 00000 n \n`);
  append(`trailer\n<< /Size ${size} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF`);
  return new Blob(chunks, { type: "application/pdf" });
}

function mimeBase64(bytes) {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary).match(/.{1,76}/g)?.join("\r\n") || "";
}

async function planEmailFile(plan, pdf) {
  const mixed = `wrsp-mixed-${crypto.randomUUID()}`;
  const alternative = `wrsp-alt-${crypto.randomUUID()}`;
  const encode = (value) => mimeBase64(new TextEncoder().encode(value));
  // RFC 2047 encoded words are limited to 75 characters, including their wrapper.
  const subject = Array.from(`WRSP: ${plan.title || "Safety Plan"}`).reduce((parts, char) => {
    if (!parts.length || new TextEncoder().encode(parts[parts.length - 1] + char).length > 42) parts.push(char);
    else parts[parts.length - 1] += char;
    return parts;
  }, []).map((part) => `=?UTF-8?B?${encode(part)}?=`).join("\r\n ");
  const message = [
    `Subject: ${subject}`,
    `Date: ${new Date().toUTCString()}`,
    "MIME-Version: 1.0",
    "X-Unsent: 1",
    `Content-Type: multipart/mixed; boundary="${mixed}"`,
    "",
    `--${mixed}`,
    `Content-Type: multipart/alternative; boundary="${alternative}"`,
    "",
    `--${alternative}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encode(planShareText(plan)),
    `--${alternative}`,
    'Content-Type: text/html; charset="UTF-8"',
    "Content-Transfer-Encoding: base64",
    "",
    encode(planEmailHtml(plan)),
    `--${alternative}--`,
    `--${mixed}`,
    `Content-Type: application/pdf; name="${pdf.name}"`,
    `Content-Disposition: attachment; filename="${pdf.name}"`,
    "Content-Transfer-Encoding: base64",
    "",
    mimeBase64(new Uint8Array(await pdf.arrayBuffer())),
    `--${mixed}--`,
    "",
  ].join("\r\n");
  return new File([message], `${safeFileName(plan.title)}.eml`, { type: "message/rfc822" });
}

async function sharePlanPdf(plan) {
  const file = new File([await planPdfBlob(plan)], `${safeFileName(plan.title)}.pdf`, { type: "application/pdf" });
  await shareFileAttachment(file, `WRSP: ${plan.title}`, "", planShareText(plan), await planEmailFile(plan, file));
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
    centerLandingZoneMap(position.coords.latitude, position.coords.longitude, Math.max(landingZoneMapState.zoom, 17));
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
  if (/^https?:/i.test(href)) openExternalUrl(href);
  else window.location.href = href;
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
  if (window.location.protocol === "file:") return "https://wrsp.lumbermen.org/";
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
};

function medicalPlaceFromPlan(plan = formToPlan()) {
  const loc = plan.location || {};
  return [loc.town, loc.county && `${loc.county} County`, loc.state].filter(Boolean).join(", ");
}

function medicalLookupUrl(query, place) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${query} near ${place}`)}`;
}

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
    plan.medical.hospitalVerified = false;
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

function openExternalUrl(url) {
  try {
    const target = new URL(url);
    if (!["https:", "http:"].includes(target.protocol)) throw new Error("Unsupported link");
    window.open(target.href, "_blank", "noopener,noreferrer");
  } catch {
    toast("Enter a complete web link beginning with https://.");
  }
}

function openMapsSearch(query) {
  openExternalUrl(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`);
}

function openWebSearch(query) {
  openExternalUrl(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
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

function buildPhoneDirectionsDraft() {
  const plan = formToPlan();
  const access = plan.access || {};
  const loc = plan.location || {};
  const parts = [];
  const landmarkCoords = access.knownLandmarkLat && access.knownLandmarkLng ? ` (${access.knownLandmarkLat}, ${access.knownLandmarkLng})` : "";
  const start = access.knownLandmark
    ? `${access.knownLandmark}${landmarkCoords}`
    : landmarkCoords.trim() || [loc.roadAddress, loc.town, loc.county, loc.state].filter(Boolean).join(", ");
  if (start) parts.push(`From ${start}, proceed to the job site.`);
  if (access.routeNotes) parts.push(access.routeNotes);
  if (access.gateNotes) parts.push(`Gate, lock, or access notes: ${access.gateNotes}`);
  if (access.meetingPoint) parts.push(`Meet emergency vehicles at ${access.meetingPoint}.`);
  if (access.alternateMeetingPoint) parts.push(`Alternate meeting point: ${access.alternateMeetingPoint}.`);
  if (loc.lat && loc.lng) parts.push(`Exact site coordinates: ${loc.lat}, ${loc.lng}.`);
  parts.push("Have someone meet responders at the access point and flag a visible route to the injured person.");
  return parts.join(" ");
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

function contactPickerAvailable() {
  return Boolean(window.isSecureContext && navigator.contacts?.select);
}

function updateContactPickerButtons() {
  const supported = contactPickerAvailable();
  $$(".contact-picker").forEach((button) => {
    button.classList.toggle("unavailable", !supported);
    button.hidden = !supported;
    if (!supported) {
      button.textContent = "Type or paste contact";
      button.title = "This browser does not allow WRSP to read phone contacts.";
    } else {
      button.textContent = "Choose from contacts";
      button.title = "Choose a contact from this device, if the browser permits it.";
    }
  });
}

async function chooseContactForField(fieldId) {
  const target = $(`#${fieldId}`);
  if (!target) return;
  if (!contactPickerAvailable()) {
    toast("This browser blocks phone contact picking. Open Contacts, copy the name/number, then paste it here.");
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
  for (const line of canvasTextLines(ctx, text, maxWidth)) {
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  return y;
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
    syncReadinessStatus();
    scheduleAutoSave();
    updateEssentialProgress();
  });
  ["lat", "lng"].forEach((id) => {
    $(`#${id}`).addEventListener("input", () => {
      const lat = parseFloat($("#lat").value);
      const lng = parseFloat($("#lng").value);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        $("#planForm").dataset.locationSource = "manual coordinates";
        $("#planForm").dataset.accuracy = "";
        $("#planForm").dataset.capturedAt = new Date().toISOString();
        updateGpsStatus();
        centerSiteMap(lat, lng, Math.max(siteMapState.zoom, 17));
        centerNearbyMaps(lat, lng);
        scheduleAutoSave();
      }
    });
  });
  ["landingZoneLat", "landingZoneLng"].forEach((id) => {
    $(`#${id}`).addEventListener("input", () => {
      const lat = parseFloat($("#landingZoneLat").value);
      const lng = parseFloat($("#landingZoneLng").value);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        centerLandingZoneMap(lat, lng, Math.max(landingZoneMapState.zoom, 17));
        scheduleAutoSave();
      }
    });
  });
  $("#knownLandmark").addEventListener("input", clearLandmarkCoordinates);
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
    await openCompleteExamplePlan();
    toast("Complete example plan opened.");
  });
  $("#openSamplePlanMore").addEventListener("click", async () => {
    await openCompleteExamplePlan();
    toast("Complete example plan opened.");
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
        centerLandingZoneMap(siteLat, siteLng, Math.max(landingZoneMapState.zoom, 17));
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
  $("#suggestAddressFromPin").addEventListener("click", suggestAddressFromPin);
  $("#openPinInGoogleMaps").addEventListener("click", openSitePinInGoogleMaps);
  $("#useSuggestedAddress").addEventListener("click", () => usePendingAddressSuggestion(false));
  $("#editSuggestedAddress").addEventListener("click", () => usePendingAddressSuggestion(true));
  $("#ignoreSuggestedAddress").addEventListener("click", () => {
    pendingAddressSuggestion = null;
    $("#addressSuggestionPanel").hidden = true;
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
    toast("Saved what you have. Keep editing when ready.");
  });
  $("#loadCompleteExamplePlan")?.addEventListener("click", openCompleteExamplePlan);
  $("#savedPlansList").addEventListener("click", async (event) => {
    const openId = event.target.dataset.openPlan;
    const shareId = event.target.dataset.sharePlan;
    const editId = event.target.dataset.editPlan;
    const deleteId = event.target.dataset.deletePlan;
    if (openId) await openPlan(openId);
    if (shareId) {
      openShareChoice(shareId);
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
      openShareChoice(shareId);
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
    pendingSharePlanId = null;
    openShareChoice(null);
  });
  $("#sharePlanOptions").addEventListener("click", () => {
    pendingSharePlanId = null;
    openShareChoice(null);
  });
  $("#qrCurrentPlan").addEventListener("click", async () => {
    const plan = await activePlan();
    if (plan) showPlanQr(plan);
  });
  $("#sharePlanPng")?.addEventListener("click", async () => {
    const plan = await activePlan();
    if (!plan) return;
    await sharePlanPng(plan);
  });
  $("#sharePlanPdf")?.addEventListener("click", async () => {
    const plan = await activePlan();
    if (!plan) return;
    await sharePlanPdf(plan);
  });
  $("#shareChoicePng").addEventListener("click", () => shareChosenPlan("png"));
  $("#shareChoicePdf").addEventListener("click", () => shareChosenPlan("pdf"));
  $("#shareChoiceEmailDraft").addEventListener("click", () => shareChosenPlan("email-draft"));
  $("#retrySharePreparation").addEventListener("click", () => openShareChoice(pendingSharePlanId));
  $("#closeShareChoice").addEventListener("click", closeShareChoice);
  $("#shareChoicePanel").addEventListener("click", (event) => {
    if (event.target.id === "shareChoicePanel") closeShareChoice();
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
      copiedFrom: plan.id,
      medical: { ...plan.medical, hospitalVerified: false },
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await savePlan(copy);
    planToForm(copy);
    routeTo("create");
  });
  $("#printCurrentPlan").addEventListener("click", async () => {
    const plan = await activePlan();
    if (!plan) return;
    try {
      const file = new File([await planPdfBlob(plan)], `${safeFileName(plan.title)}.pdf`, { type: "application/pdf" });
      await fallbackDownloadFile(file, "One-page PDF saved. Open it to print.");
    } catch (error) {
      await openShareChoice();
      setShareChoiceStatus(error.message);
    }
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
  $("#openFacilityDirectionsSearch").addEventListener("click", () => {
    const url = $("#medicalFacilityDirectionsUrl").value.trim();
    if (url) {
      openExternalUrl(url);
      return;
    }
    toast("Paste a directions link first.");
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
  bindFieldEvents();
  updateContactPickerButtons();
  updateConnectionBadge();
  await ensureCompleteExamplePlan();
  await updatePlanCount();
  planToForm(await newPlanWithDefaults());
  await renderContinuePlan();
  updateEssentialProgress();
  await importFromUrlHash();
  await initServiceWorker();
}

init();

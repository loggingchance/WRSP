const FIELD_OPTIONS = {
  accessChecks: ['Locked gate', 'Seasonal road', 'Narrow bridge', 'Mud', 'Snow / ice', 'Low clearance', 'Steep haul road', 'Limited turnaround', 'Weight restriction', 'Soft shoulders'],
  hazardChecks: ['Active tree felling', 'Skidding / forwarding', 'Log truck traffic', 'Chainsaw work', 'Mechanized harvesting equipment', 'Steep terrain', 'Ice / snow', 'Mud / soft ground', 'Overhead limbs', 'Hung-up trees', 'Limited visibility', 'Narrow haul roads', 'Fuel storage', 'Stream crossings', 'Limited cell service'],
  equipmentChecks: ['First aid kit', 'Trauma kit', 'Fire extinguisher', 'Spill kit', 'AED', 'Radio', 'Satellite communicator', 'Emergency blanket', 'Chainsaw trauma supplies'],
};
const DEFAULT_EMERGENCY_PROCEDURE = '1. Stop work and secure the scene. 2. Call 911 and read the directions above. 3. Send someone to the meeting point. 4. Keep access clear. 5. Provide first aid within your training. 6. Follow responder instructions.';
const RECURRING_PROFILE_KEY = 'recurringPlanProfile';

function fieldCheckboxes(id, values = []) {
  const options = [...new Set([...FIELD_OPTIONS[id], ...values])];
  document.getElementById(id).innerHTML = options.map(value => `<label><input type="checkbox" value="${escapeHtml(value)}" ${values.includes(value) ? 'checked' : ''}><span>${escapeHtml(value)}</span></label>`).join('');
}

function selectedFields(id) {
  return Array.from(document.querySelectorAll(`#${id} input:checked`), input => input.value);
}

function renderPeopleFields(people = [], count = Math.max(5, people.length)) {
  document.getElementById('planPeopleGrid').innerHTML = '<strong>Name</strong><strong>Role</strong><strong>Contact number</strong>' + Array.from({ length: count }, (_, index) => {
    const person = people[index] || {};
    return [['Name', 'name'], ['Role', 'role'], ['Phone', 'phone']].map(([label, key]) => `<input id="contact${label}${index + 1}" aria-label="${label} ${index + 1}" placeholder="${label}" value="${escapeHtml(person[key] || '')}" ${key === 'phone' ? 'inputmode="tel"' : ''}>`).join('');
  }).join('');
}

function validFieldCoordinates(lat, lng) {
  return String(lat ?? '').trim() !== '' && String(lng ?? '').trim() !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lng)) <= 180;
}

function fieldMapUrl(lat, lng) {
  return validFieldCoordinates(lat, lng) ? `https://www.google.com/maps?q=${String(lat).trim()},${String(lng).trim()}` : '';
}

function safeFieldUrl(value) {
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) ? url.href : '';
  } catch { return ''; }
}

function fieldPhoneUrl(value) {
  const phone = String(value || '').match(/\+?\d[\d(). -]{5,}\d/);
  return phone ? `tel:${phone[0].replace(/[^+\d]/g, '')}` : '';
}

function fieldLinkedText(value) {
  return String(value || '').split(/(\+?\d[\d(). -]{5,}\d)/g).map((part, index) => index % 2
    ? `<a href="${fieldPhoneUrl(part)}" style="color:#123c2c;text-decoration:underline">${escapeHtml(part)}</a>`
    : escapeHtml(part)).join('').replace(/\n/g, '<br>');
}

function fieldPlanData(plan) {
  const loc = plan.location || {};
  const access = plan.access || {};
  const medical = plan.medical || {};
  const equipment = plan.equipment || {};
  const join = values => values.filter(Boolean).join('; ');
  const row = (label, text, url = '') => ({ label, text: String(text || ''), url });
  const section = (title, rows) => ({ title, rows: rows.filter(item => item.text) });
  const map = fieldMapUrl(loc.lat, loc.lng);
  const startPin = validFieldCoordinates(access.knownLandmarkLat, access.knownLandmarkLng) ? `${access.knownLandmarkLat}, ${access.knownLandmarkLng}` : '';
  const lzPin = access.landingZoneLat || access.landingZoneLng ? `${access.landingZoneLat || '?'}, ${access.landingZoneLng || '?'}` : '';
  const links = [row('', 'Driving directions', map ? planDirectionsUrl(plan) : '')].filter(link => link.url);
  const emergency = section('CALL 911', [
    row('Site location', join([loc.roadAddress, [loc.town, loc.county, loc.state].filter(Boolean).join(', ')])),
    row('GPS', map ? `${String(loc.lat).trim()}, ${String(loc.lng).trim()}` : 'Not entered'),
    row('', map ? 'Open site in Google Maps' : '', map),
    row('Start from', join([access.knownLandmark, startPin]), fieldMapUrl(access.knownLandmarkLat, access.knownLandmarkLng)),
    { ...row('Directions from known intersection', access.phoneDirections || 'Not entered'), kind: 'directions' },
    row('MEET RESPONDERS HERE', access.meetingPoint || 'Not entered'),
    row('Gate / access', access.gateNotes),
  ]);
  const people = section('People', contactRowsForPlan(plan).map(person => row('', join([person.name, person.role, person.phone]), fieldPhoneUrl(person.phone))));
  if (!people.rows.length) people.rows.push(row('', 'Not entered'));
  const hospitalUrl = safeFieldUrl(medical.hospitalDirectionsUrl);
  const medicalRows = [row('', medical.hospital), row('Town / address', join([medical.hospitalTown, medical.hospitalAddress])), row('Approx. drive time', medical.hospitalDriveTime), row('', hospitalUrl ? 'Hospital directions' : medical.hospitalDirectionsUrl, hospitalUrl), row('Notes', medical.notes), row('Urgent care', medical.urgentCare), row('', medical.urgentCareDirectionsUrl ? 'Urgent care directions' : '', safeFieldUrl(medical.urgentCareDirectionsUrl)), row('Trauma center', medical.traumaCenter), row('', medical.traumaDirectionsUrl ? 'Trauma center directions' : '', safeFieldUrl(medical.traumaDirectionsUrl))];
  const landing = section('Helicopter landing zone', [row('', access.landingZoneDescription), row('Size', access.landingZoneSize), row('GPS', lzPin, fieldMapUrl(access.landingZoneLat, access.landingZoneLng)), row('Obstructions / notes', access.landingZoneNotes)]);
  if (landing.rows.length) landing.rows.push(row('', 'EMS / dispatch determines air-medical response.'));
  return {
    title: plan.title || 'WRSP Safety Plan',
    meta: join([plan.company, plan.creator, `Updated ${formatDate(plan.updatedAt)}`]),
    emergency, links,
    left: [people, section('Emergency numbers', [row('', emergencyNotes(plan))]), section('Hospital / ER', medicalRows)].filter(item => item.rows.length),
    right: [section('Access / hazards', [row('Phone / radio', access.phoneServiceNotes), row('Access', join([...(access.constraints || []), access.routeNotes])), row('Alternate meeting point', access.alternateMeetingPoint), row('Hazards', join([...(plan.hazardChecks || []), plan.hazards]))]), section('Emergency equipment', [row('', join([...(equipment.items || []), equipment.other])), row('Location', equipment.location)]), landing].filter(item => item.rows.length),
    actions: section('Emergency actions', [row('', plan.emergencyProcedure || DEFAULT_EMERGENCY_PROCEDURE)]),
  };
}

function fieldPlanText(plan) {
  const data = fieldPlanData(plan);
  const sections = [data.emergency, ...data.left, ...data.right, data.actions];
  return [data.title, data.meta, ...sections.map(section => `${section.title}\n${section.rows.map(row => `${row.label ? row.label + ': ' : ''}${row.text}${row.url ? '\n' + row.url : ''}`).join('\n')}`), data.links.map(link => `${link.text}: ${link.url}`).join('\n')].filter(Boolean).join('\n\n');
}

function fieldRowHtml(row) {
  const body = row.url ? `<a href="${escapeHtml(row.url)}" ${row.url.startsWith('http') ? 'target="_blank" rel="noopener"' : ''} style="color:#123c2c;text-decoration:underline">${escapeHtml(row.text)}</a>` : row.label === 'GPS' ? escapeHtml(row.text) : fieldLinkedText(row.text);
  return `<p style="margin:5px 0;overflow-wrap:anywhere">${row.label ? `<strong>${escapeHtml(row.label)}: </strong>${row.kind === 'directions' ? '<br>' : ''}` : ''}${body}</p>`;
}

function fieldSectionHtml(section) {
  return `<section class="field-section"><h3 style="font-size:20px;color:#123c2c;border-bottom:1px solid #bdcbc3;margin:18px 0 8px;padding-bottom:5px">${escapeHtml(section.title)}</h3>${section.rows.map(fieldRowHtml).join('')}</section>`;
}

function renderFieldPlanHtml(plan, email = false) {
  const data = fieldPlanData(plan);
  const heading = email ? 'h1' : 'h2';
  const hospitalUnverified = plan.medical?.hospital && !plan.medical?.hospitalVerified;
  return `<article class="field-plan" lang="en" dir="ltr" style="color:#202923;font:16px/1.45 Arial,sans-serif">
    <${heading} style="font-size:28px;color:#123c2c;margin:0 0 8px;overflow-wrap:anywhere">${escapeHtml(data.title)}</${heading}>
    <p style="margin:0 0 14px">${escapeHtml(data.meta)}</p>
    ${!email && plan.copiedFrom ? '<p class="notice">Copied plan: check this job\'s location, directions, contacts, and access before sharing.</p>' : ''}
    <section class="field-emergency" style="border-left:5px solid #a12d1c;background:#f6f8f6;padding:12px 16px">
      <h${email ? '2' : '3'} style="font-size:26px;margin:0 0 8px"><a href="tel:911" style="color:#922b1b">CALL 911</a></h${email ? '2' : '3'}>
      ${data.emergency.rows.map(fieldRowHtml).join('')}
      <p>${data.links.map(link => `<a href="${escapeHtml(link.url)}" target="_blank" rel="noopener" style="color:#123c2c;margin-right:16px">${escapeHtml(link.text)}</a>`).join(' ')}</p>
    </section>
    ${!email && hospitalUnverified ? '<p class="notice">Hospital / ER details still need your confirmation.</p>' : ''}
    <div class="field-columns" ${email ? 'style="display:block"' : ''}><div>${data.left.map(fieldSectionHtml).join('')}</div><div>${data.right.map(fieldSectionHtml).join('')}</div></div>
    ${fieldSectionHtml(data.actions)}
  </article>`;
}

function fieldPlanEmailHtml(plan) {
  return WRSPEmail.render(fieldPlanData(plan));
}

function fieldPlanPdfPages(plan) {
  const data = fieldPlanData(plan);
  // Spend spare space on the emergency essentials, never on smaller body text.
  for (const layout of [
    { keyPx: 32, directionsPx: 28, sectionGap: 22 },
    { keyPx: 28, directionsPx: 26, sectionGap: 16 },
    { keyPx: 24, directionsPx: 24, sectionGap: 8 },
  ]) {
    const canvas = fieldPlanPdfCanvas(data, layout);
    if (canvas.fieldMetrics.bottom <= canvas.fieldMetrics.limit) return [canvas];
    if (layout.keyPx === 24) {
      const largest = [...canvas.sectionSizes].sort((a, b) => b.height - a.height).slice(0, 2).map(item => item.title === 'CALL 911' ? 'written directions / location' : item.title.toLowerCase()).join(' and ');
      const error = new Error(`This plan needs about ${Math.ceil((canvas.fieldMetrics.bottom - canvas.fieldMetrics.limit) / 28)} fewer lines to fit one page at 12pt. Shorten ${largest}. All text remains saved.`);
      error.name = 'PlanFitError';
      throw error;
    }
  }
}

function fieldPlanPdfCanvas(data, layout) {
  const canvas = document.createElement('canvas');
  canvas.width = 1224;
  canvas.height = 1584;
  canvas.links = [];
  const ctx = canvas.getContext('2d');
  const margin = 48;
  const width = canvas.width - margin * 2;
  const lineHeight = 28;
  const font = '24px Arial'; // 12pt on a 612pt letter page, at 2x resolution.
  const sizes = [];
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  const text = (value, x, y, maxWidth, options = {}) => {
    ctx.font = options.font || font;
    ctx.fillStyle = options.color || '#202923';
    const lines = canvasTextLines(ctx, value, maxWidth);
    const leading = options.leading || lineHeight;
    lines.forEach(line => {
      ctx.fillText(line, x, y);
      if (options.url && line) {
        const metrics = ctx.measureText(line);
        const ascent = metrics.actualBoundingBoxAscent;
        const descent = metrics.actualBoundingBoxDescent;
        ctx.fillRect(x, y + 3, metrics.width, 1);
        canvas.links.push({ url: options.url, rect: [x / 2, (canvas.height - y - Math.max(descent, 4)) / 2, (x + metrics.width) / 2, (canvas.height - y + ascent + 2) / 2] });
      }
      y += leading;
    });
    return y;
  };
  const rowStyle = (row, emergency) => {
    const key = emergency && ['Site location', 'GPS', 'MEET RESPONDERS HERE'].includes(row.label);
    const size = row.kind === 'directions' ? layout.directionsPx : key ? layout.keyPx : 24;
    return { font: `${key ? 'bold ' : ''}${size}px Arial`, leading: size + 4, url: row.url, color: row.url ? '#123c2c' : '#202923' };
  };
  const rowText = row => `${row.label ? row.label + ': ' : ''}${row.text}`;
  const rowHeight = (row, emergency, maxWidth) => {
    const style = rowStyle(row, emergency);
    ctx.font = style.font;
    let height = canvasTextLines(ctx, row.kind === 'directions' ? row.text : rowText(row), maxWidth).length * style.leading;
    if (row.kind === 'directions') {
      ctx.font = `bold ${layout.directionsPx}px Arial`;
      height += canvasTextLines(ctx, `${row.label}:`, maxWidth).length * style.leading + 6;
    }
    return height + 3;
  };
  const section = (item, x, y, maxWidth, heading = true) => {
    const start = y;
    if (heading) {
      y = text(item.title, x, y, maxWidth, { font: 'bold 32px Arial', leading: 36, color: '#123c2c' });
      ctx.fillStyle = '#bdcbc3';
      ctx.fillRect(x, y - 23, maxWidth, 1);
      y += 5;
    }
    for (const row of item.rows) {
      const style = rowStyle(row, !heading);
      if (row.kind === 'directions') {
        y += 6;
        y = text(`${row.label}:`, x, y, maxWidth, { ...style, font: `bold ${layout.directionsPx}px Arial` });
      }
      y = text(row.kind === 'directions' ? row.text : rowText(row), x, y, maxWidth, style);
      y += 3;
    }
    sizes.push({ title: item.title, height: y - start });
    return y + layout.sectionGap;
  };
  let y = text(data.title, margin, 84, width, { font: 'bold 56px Arial', leading: 60, color: '#123c2c' });
  y = text(data.meta, margin, y, width) + 16;
  const emergencyTop = y - 23;
  // Measure the emergency block first so its fill sits behind all of the text.
  const emergencyHeight = 77 + data.emergency.rows.reduce((sum, row) => sum + rowHeight(row, true, width - 32), 0) + (data.links.length ? 32 : 0);
  ctx.fillStyle = '#f0f5f2';
  ctx.fillRect(margin - 8, emergencyTop, width + 16, emergencyHeight);
  ctx.fillStyle = '#a12d1c';
  ctx.fillRect(margin - 8, emergencyTop, 6, emergencyHeight);
  y = text('CALL 911', margin + 12, y + 18, width - 32, { font: 'bold 48px Arial', leading: 60, color: '#922b1b', url: 'tel:911' });
  y = section(data.emergency, margin + 12, y, width - 32, false) - layout.sectionGap;
  for (let i = 0; i < data.links.length; i += 1) {
    text(data.links[i].text, margin + 12 + i * 280, y, 270, { url: data.links[i].url, color: '#123c2c' });
  }
  if (data.links.length) y += 32;
  y += layout.sectionGap + 10;
  const columnGap = 36;
  const columnWidth = (width - columnGap) / 2;
  let leftY = y;
  let rightY = y;
  data.left.forEach(item => { leftY = section(item, margin, leftY, columnWidth); });
  data.right.forEach(item => { rightY = section(item, margin + columnWidth + columnGap, rightY, columnWidth); });
  y = Math.max(leftY, rightY) + 4;
  y = section(data.actions, margin, y, width);
  canvas.fieldMetrics = { bodyFontPt: 12, headingFontPt: 16, keyFontPt: layout.keyPx / 2, directionsFontPt: layout.directionsPx / 2, bottom: y, limit: canvas.height - 36 };
  canvas.sectionSizes = sizes;
  return canvas;
}

function emergencyText(plan) {
  const loc = plan.location || {};
  const access = plan.access || {};
  const person = contactRowsForPlan(plan)[0];
  return [plan.title, loc.roadAddress, validFieldCoordinates(loc.lat, loc.lng) && `GPS ${loc.lat}, ${loc.lng}`, access.meetingPoint && `Meet responders: ${access.meetingPoint}`, access.phoneDirections, person && `Site contact: ${formatContactRow(person)}`].filter(Boolean).join('. ');
}

let recentFieldPeople = [];
async function refreshRecentPeople() {
  const plans = (await storeAll(PLAN_STORE)).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  const profile = (await storeGet(SETTINGS_STORE, RECURRING_PROFILE_KEY))?.value;
  const seen = new Set();
  recentFieldPeople = [...(profile?.people || []), ...plans.filter(plan => !plan.importedFrom?.startsWith('built-in')).flatMap(contactRowsForPlan)].filter(person => {
    const key = JSON.stringify([person.name, person.role, person.phone]);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 40);
  document.getElementById('recentPeople').innerHTML = '<option value="">Add a saved / recent person</option>' + recentFieldPeople.map((person, index) => `<option value="${index}">${escapeHtml(formatContactRow(person))}</option>`).join('');
}

function syncShareReview() {
  const checked = Array.from(document.querySelectorAll('#shareReview input')).every(input => input.checked);
  ['shareChoicePng', 'shareChoicePdf', 'shareChoiceEmailDraft'].forEach(id => { document.getElementById(id).disabled = !preparedShare || !checked; });
}

function bindFieldEvents() {
  document.getElementById('recentPeople').addEventListener('change', event => {
    if (event.target.value === '') return;
    const people = contactRowsFromForm();
    const selected = recentFieldPeople[Number(event.target.value)];
    if (!people.some(person => JSON.stringify(person) === JSON.stringify(selected))) people.push(selected);
    renderPeopleFields(people);
    event.target.value = '';
    scheduleAutoSave();
    updateEssentialProgress();
  });
  document.getElementById('addPersonRow').addEventListener('click', () => {
    renderPeopleFields(contactRowsFromForm(), document.querySelectorAll('#planPeopleGrid [id^="contactName"]').length + 1);
  });
  document.getElementById('rememberPlanSetup').addEventListener('click', async () => {
    const plan = formToPlan();
    await storePut(SETTINGS_STORE, { key: RECURRING_PROFILE_KEY, value: { people: plan.contacts.people, creator: plan.creator, company: plan.company, emergencyProcedure: plan.emergencyProcedure, equipment: plan.equipment, sarContacts: plan.sar.contacts } });
    toast('People, company, equipment, emergency numbers, and procedure saved for new plans.');
    await refreshRecentPeople();
  });
  ['hospital', 'hospitalTown', 'hospitalAddress', 'hospitalDriveTime', 'hospitalDirectionsUrl'].forEach(id => document.getElementById(id).addEventListener('input', () => { document.getElementById('hospitalVerified').checked = false; }));
  document.getElementById('shareReview').addEventListener('change', syncShareReview);
  document.getElementById('editSharePlan').addEventListener('click', async () => {
    const plan = await planForSharing();
    closeShareChoice();
    if (plan) { planToForm(plan); routeTo('create'); }
  });
  document.getElementById('copyEmergencyText').addEventListener('click', async () => {
    const plan = await activePlan();
    if (!plan) return;
    try { await navigator.clipboard.writeText(emergencyText(plan)); toast('Emergency text copied.'); }
    catch { document.getElementById('emergencyTextOutput').hidden = false; document.getElementById('emergencyTextOutput').value = emergencyText(plan); }
  });
}

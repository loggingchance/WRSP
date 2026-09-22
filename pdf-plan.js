function fieldPdfSteps(value) {
  const text = String(value || '');
  const markers = Array.from(text.matchAll(/(?:^|\s)(\d+)[.)]\s+/g));
  if (markers.length < 2 || text.slice(0, markers[0].index).trim() || markers.some((match, index) => Number(match[1]) !== index + 1)) return [text];
  return markers.map((match, index) => text.slice(match.index + match[0].length, markers[index + 1]?.index).trim());
}

function fieldPdfContent(plan) {
  const data = fieldPlanData(plan);
  const rows = data.emergency.rows;
  const find = label => rows.find(row => row.label === label);
  const group = (title, items) => ({ title, rows: items.filter(row => row && row.text) });
  const access = data.right.find(section => section.title === 'Access / hazards')?.rows || [];
  const medical = data.left.find(section => section.title === 'Hospital / ER')?.rows || [];
  const lz = data.right.find(section => section.title === 'Helicopter landing zone')?.rows || [];
  const people = contactRowsForPlan(plan).map(person => ({
    label: person.role || 'Contact',
    text: [person.name, person.phone].filter(Boolean).join(' - ') || 'Not entered',
  }));
  if (!people.length) people.push({ text: 'Not entered' });
  const hazardItems = (plan.hazardChecks || []).map(text => ({ text, bullet: true }));
  if (plan.hazards) hazardItems.push({ text: plan.hazards });
  const blocks = [
    { ...group('Contacts', people), side: 'left' },
    { ...group('Medical / Hospital', [
      ...medical.map(row => ({ ...row, text: row.text === 'Hospital directions' ? 'Open hospital directions' : row.text })),
      plan.medical?.hospital && !plan.medical?.hospitalVerified ? { text: 'Hospital details require confirmation.', note: true } : null,
    ]), preferred: 'left' },
    { ...group('Emergency Contacts', data.left.find(section => section.title === 'Emergency numbers')?.rows || []), preferred: 'left' },
    { ...group('Access / Communications', [
      find('Gate / access'),
      ...access.filter(row => row.label !== 'Hazards'),
    ]), side: 'right' },
    { ...group('Possible Landing Zone', lz.map(row => ({ ...row, note: row.text === 'EMS / dispatch determines air-medical response.' }))), side: 'right' },
    { ...group('Hazards', hazardItems), preferred: 'right' },
    { ...group('Emergency Equipment', data.right.find(section => section.title === 'Emergency equipment')?.rows || []), preferred: 'right' },
  ].filter(section => section.rows.length);
  return {
    title: data.title,
    meta: data.meta,
    emergency: group('CALL 911', [
      find('Site location') && { ...find('Site location'), label: 'Site' },
      find('GPS'),
      rows.find(row => row.text === 'Open site in Google Maps'),
      { ...find('MEET RESPONDERS HERE'), label: 'Meet responders' },
    ]),
    directions: group('Directions for Responders', [
      find('Start from'),
      { text: rows.find(row => row.kind === 'directions')?.text || 'Not entered' },
    ]),
    drivingUrl: data.links[0]?.url || '',
    blocks,
    steps: fieldPdfSteps(data.actions.rows[0].text),
  };
}

function renderFieldPdf(plan) {
  const data = fieldPdfContent(plan);
  // Tighten space and balance columns before using the smaller 12pt body option.
  const layouts = [
    { body: 13, leading: 16, heading: 15, pad: 10, gap: 12, rowGap: 3, actionColumns: 1 },
    { body: 13, leading: 16, heading: 15, pad: 8, gap: 9, rowGap: 2, actionColumns: 2 },
    { body: 13, leading: 15, heading: 14, pad: 6, gap: 6, rowGap: 1, actionColumns: 2 },
    { body: 12.5, leading: 14.5, heading: 14, pad: 6, gap: 6, rowGap: 1, actionColumns: 2 },
    { body: 12, leading: 14, heading: 14, pad: 5, gap: 5, rowGap: 1, actionColumns: 2 },
    { body: 12, leading: 14, heading: 14, pad: 4, gap: 4, rowGap: 0, actionColumns: 2 },
  ];
  let result;
  for (const layout of layouts) {
    result = layoutFieldPdf(data, layout);
    if (result.fieldMetrics.overflow <= 0) return [result];
  }
  const largest = result.sectionSizes.slice().sort((a, b) => b.height - a.height).slice(0, 2).map(section => section.title.toLowerCase()).join(' and ');
  const error = new Error('This plan needs about ' + Math.ceil(result.fieldMetrics.overflow / 14) + ' fewer lines to fit one page at 12pt. Shorten ' + largest + '. All text remains saved.');
  error.name = 'PlanFitError';
  throw error;
}

function layoutFieldPdf(data, style) {
  const pageWidth = 612;
  const pageHeight = 792;
  const margin = 36;
  const width = pageWidth - margin * 2;
  const canvas = document.createElement('canvas');
  canvas.width = pageWidth * 2;
  canvas.height = pageHeight * 2;
  canvas.links = [];
  canvas.pdfLayout = { blocks: [], text: [] };
  const ctx = canvas.getContext('2d');
  ctx.scale(2, 2);
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, pageWidth, pageHeight);
  const ink = '#202b29';
  const green = '#244b40';
  const linkColor = '#174f78';
  const rule = '#bbc9c2';
  const themes = {
    'Directions for Responders': { fill: '#245b7c', text: '#ffffff' },
    'Contacts': { fill: '#276044', text: '#ffffff' },
    'Medical / Hospital': { fill: '#176b70', text: '#ffffff' },
    'Emergency Contacts': { fill: '#a23e31', text: '#ffffff' },
    'Access / Communications': { fill: '#e6edf0', text: '#254c5c' },
    'Possible Landing Zone': { fill: '#e2f0ee', text: '#18545a' },
    'Hazards': { fill: '#f3d08a', text: '#493407' },
    'Emergency Equipment': { fill: '#e4eee5', text: '#244b40' },
  };
  const font = (size, bold) => (bold ? 'bold ' : '') + size + 'px Arial';
  const measure = (text, size, bold) => {
    ctx.font = font(size, bold);
    return ctx.measureText(text).width;
  };
  const runsForRow = row => {
    const runs = row.label ? [{ text: row.label + ': ', bold: true }] : [];
    if (row.url) runs.push({ text: row.text, url: row.url });
    else if (row.label === 'GPS') runs.push({ text: row.text });
    else String(row.text || '').split(/(\+?\d[\d(). -]{5,}\d|\b911\b)/g).forEach((text, index) => runs.push({ text, url: index % 2 ? 'tel:' + text.replace(/[^+\d]/g, '') : '' }));
    return runs;
  };
  // One rich-text wrapping pass is shared by measurement and drawing.
  const linesFor = (runs, maxWidth, size) => {
    const lines = [];
    let line = [];
    let used = 0;
    const flush = () => { lines.push(line); line = []; used = 0; };
    const add = (text, run) => {
      const last = line[line.length - 1];
      if (last && last.bold === run.bold && last.url === run.url) last.text += text;
      else line.push({ ...run, text });
      used += measure(text, size, run.bold);
    };
    for (const run of runs) {
      for (const token of String(run.text || '').split(/(\n|[^\S\n]+)/)) {
        if (!token) continue;
        if (token === '\n') { flush(); continue; }
        if (/^\s+$/.test(token)) {
          if (used && used + measure(' ', size, run.bold) <= maxWidth) add(' ', run);
          continue;
        }
        if (used && used + measure(token, size, run.bold) > maxWidth) flush();
        if (measure(token, size, run.bold) <= maxWidth) add(token, run);
        else for (const char of token) {
          if (used && used + measure(char, size, run.bold) > maxWidth) flush();
          add(char, run);
        }
      }
    }
    if (line.length || !lines.length) flush();
    return lines;
  };
  const drawLines = (lines, x, top, size, leading, color = ink) => {
    lines.forEach((line, index) => {
      let offset = x;
      const baseline = top + index * leading + size;
      for (const run of line) {
        ctx.font = font(size, run.bold);
        ctx.fillStyle = run.color || (run.url ? linkColor : color);
        ctx.fillText(run.text, offset, baseline);
        const metrics = ctx.measureText(run.text);
        canvas.pdfLayout.text.push({ text: run.text, x: offset, y: top + index * leading, width: metrics.width, height: leading, size, bold: Boolean(run.bold) });
        if (run.url && run.text.trim()) {
          ctx.fillRect(offset, baseline + 1.5, metrics.width, 0.45);
          canvas.links.push({ url: run.url, rect: [offset, pageHeight - baseline - Math.max(metrics.actualBoundingBoxDescent, 2), offset + metrics.width, pageHeight - baseline + metrics.actualBoundingBoxAscent + 1] });
        }
        offset += metrics.width;
      }
    });
    return lines.length * leading;
  };
  const preparedRows = (rows, innerWidth) => {
    const packed = [];
    // Pack short hazard items together without turning the list into prose.
    for (const row of rows) {
      const previous = packed[packed.length - 1];
      if (row.bullet && previous?.bullet && measure(previous.text + '   \u2022 ' + row.text, style.body, false) <= innerWidth) previous.text += '   \u2022 ' + row.text;
      else packed.push(row.bullet ? { ...row, text: '\u2022 ' + row.text } : row);
    }
    return packed.map(row => {
      const size = row.note ? 9.5 : style.body;
      const leading = row.note ? 12 : style.leading;
      const lines = linesFor(runsForRow(row), innerWidth, size);
      return { row, size, leading, lines, height: lines.length * leading };
    });
  };
  const preparePanel = (section, panelWidth, emergency = false) => {
    const innerWidth = panelWidth - style.pad * 2;
    const headingSize = emergency ? 18 : style.heading;
    const theme = themes[section.title] || { fill: '#e4eee5', text: green };
    const headingLines = linesFor([{ text: section.title, bold: true, url: emergency ? 'tel:911' : '', color: emergency ? '#a12e24' : theme.text }], innerWidth, headingSize);
    const headingHeight = headingLines.length * (headingSize + 3);
    const rows = preparedRows(section.rows, innerWidth);
    const height = style.pad * 2 + headingHeight + 5 + rows.reduce((sum, row) => sum + row.height, 0) + Math.max(0, rows.length - 1) * style.rowGap;
    return { section, width: panelWidth, height, headingSize, headingLines, headingHeight, rows, emergency, theme };
  };
  const drawPanel = (panel, x, y, allocatedHeight = panel.height) => {
    const extra = Math.max(0, allocatedHeight - panel.height);
    const inset = Math.min(4, extra / 4);
    const rowExtra = panel.rows.length > 1 ? Math.min(4, Math.max(0, extra - inset * 2) / (panel.rows.length - 1)) : 0;
    ctx.fillStyle = panel.emergency ? '#fff1ed' : '#ffffff';
    ctx.fillRect(x, y, panel.width, allocatedHeight);
    ctx.strokeStyle = rule;
    ctx.lineWidth = 0.5;
    ctx.strokeRect(x + 0.25, y + 0.25, panel.width - 0.5, allocatedHeight - 0.5);
    if (panel.emergency) {
      ctx.fillStyle = '#b73a2c';
      ctx.fillRect(x, y, 3, allocatedHeight);
    } else {
      ctx.fillStyle = panel.theme.fill;
      ctx.fillRect(x + 0.5, y + 0.5, panel.width - 1, style.pad + panel.headingHeight + 3 + inset);
    }
    let rowY = y + style.pad + inset;
    drawLines(panel.headingLines, x + style.pad, rowY, panel.headingSize, panel.headingSize + 3, panel.emergency ? '#873529' : green);
    rowY += panel.headingHeight + 5;
    for (const row of panel.rows) {
      drawLines(row.lines, x + style.pad, rowY, row.size, row.leading);
      rowY += row.height + style.rowGap + rowExtra;
    }
    canvas.pdfLayout.blocks.push({ title: panel.section.title, x, y, width: panel.width, height: allocatedHeight });
  };
  const titleLines = linesFor([{ text: data.title, bold: true }], width, 21);
  const metaLines = linesFor([{ text: data.meta }], width, 9.5);
  const headerHeight = titleLines.length * 24 + 4 + 15 + 3 + metaLines.length * 12;
  const emergency = preparePanel(data.emergency, width, true);
  const directions = preparePanel(data.directions, width);
  // Secondary route link shares the heading area when it fits, otherwise its own row.
  const routeLabel = 'Driving directions';
  const routeWidth = measure(routeLabel, 10, false);
  const headingWidth = measure(data.directions.title, style.heading, true);
  const routeInHeading = data.drivingUrl && headingWidth + routeWidth + style.pad * 2 + 12 <= width;
  if (data.drivingUrl && !routeInHeading) {
    const row = preparedRows([{ text: routeLabel, url: data.drivingUrl }], width - style.pad * 2)[0];
    directions.rows.push(row);
    directions.height += row.height + style.rowGap;
  }
  const gutter = 14;
  const columnWidth = (width - gutter) / 2;
  const panels = data.blocks.map(section => preparePanel(section, columnWidth));
  const flex = panels.filter(panel => !panel.section.side);
  let columns;
  let best = Infinity;
  for (let mask = 0; mask < (1 << flex.length); mask++) {
    const candidate = [[], []];
    let preferenceCost = 0;
    for (const panel of panels) {
      const side = panel.section.side || ((mask & (1 << flex.indexOf(panel))) ? 'left' : 'right');
      candidate[side === 'left' ? 0 : 1].push(panel);
      if (panel.section.preferred && panel.section.preferred !== side) preferenceCost += 5;
    }
    const heights = candidate.map(items => items.reduce((sum, panel) => sum + panel.height, 0) + Math.max(0, items.length - 1) * style.gap);
    const score = Math.max(...heights) + Math.abs(heights[0] - heights[1]) * 0.15 + preferenceCost;
    if (score < best) { best = score; columns = { panels: candidate, heights }; }
  }
  const actionWidth = style.actionColumns === 1 ? width - style.pad * 2 : (width - style.pad * 2 - gutter) / 2;
  const steps = data.steps.map((text, index) => preparedRows([{ label: String(index + 1) + '.', text }], actionWidth)[0]);
  // Number labels have a period, not the colon used by ordinary fields.
  steps.forEach((step, index) => { step.lines = linesFor([{ text: String(index + 1) + '. ', bold: true }, { text: data.steps[index] }], actionWidth, style.body); step.height = step.lines.length * style.leading; });
  let actionSplit = steps.length;
  let actionHeights = [steps.reduce((sum, step) => sum + step.height + style.rowGap, 0) - style.rowGap, 0];
  if (style.actionColumns === 2 && steps.length > 1) {
    let bestHeight = Infinity;
    for (let split = 1; split < steps.length; split++) {
      const heights = [steps.slice(0, split), steps.slice(split)].map(items => items.reduce((sum, step) => sum + step.height + style.rowGap, 0) - style.rowGap);
      if (Math.max(...heights) < bestHeight) { bestHeight = Math.max(...heights); actionSplit = split; actionHeights = heights; }
    }
  }
  const actionHeight = style.pad * 2 + style.heading + 8 + Math.max(...actionHeights);
  const footerHeight = 13;
  const available = pageHeight - margin * 2 - footerHeight;
  const natural = headerHeight + emergency.height + directions.height + Math.max(...columns.heights) + actionHeight + style.gap * 4;
  const overflow = natural - available;
  const spare = Math.max(0, -overflow);
  // Grow meaningful blocks and inter-section spacing; anchor actions near the foot.
  const outerGap = style.gap + Math.min(8, spare / 12);
  const emergencyExtra = Math.min(16, spare / 8);
  const directionsExtra = Math.min(18, spare / 8);
  const top = margin + headerHeight + outerGap;
  const middleTop = top + emergency.height + emergencyExtra + outerGap + directions.height + directionsExtra + outerGap;
  const actionsY = pageHeight - margin - footerHeight - actionHeight;
  const middleHeight = Math.max(...columns.heights, actionsY - outerGap - middleTop);

  let y = margin;
  y += drawLines(titleLines, margin, y, 21, 24, green) + 4;
  y += drawLines([[{ text: 'Emergency Safety Plan' }]], margin, y, 12, 15) + 3;
  drawLines(metaLines, margin, y, 9.5, 12, '#53615b');
  drawPanel(emergency, margin, top, emergency.height + emergencyExtra);
  const directionsY = top + emergency.height + emergencyExtra + outerGap;
  drawPanel(directions, margin, directionsY, directions.height + directionsExtra);
  if (routeInHeading) drawLines([[{ text: routeLabel, url: data.drivingUrl, color: '#ffffff' }]], margin + width - style.pad - routeWidth, directionsY + style.pad + Math.min(4, directionsExtra / 4) + 3, 10, 12);
  columns.panels.forEach((items, side) => {
    let panelY = middleTop;
    const extra = Math.max(0, middleHeight - columns.heights[side]);
    const totalHeight = items.reduce((sum, panel) => sum + panel.height, 0);
    for (const panel of items) {
      const allocated = panel.height + extra * panel.height / Math.max(1, totalHeight);
      drawPanel(panel, margin + side * (columnWidth + gutter), panelY, allocated);
      panelY += allocated + style.gap;
    }
  });
  ctx.fillStyle = '#eef5ef';
  ctx.fillRect(margin, actionsY, width, actionHeight);
  ctx.strokeStyle = rule;
  ctx.lineWidth = 0.5;
  ctx.strokeRect(margin + 0.25, actionsY + 0.25, width - 0.5, actionHeight - 0.5);
  ctx.fillStyle = '#276044';
  ctx.fillRect(margin + 0.5, actionsY + 0.5, width - 1, style.pad + style.heading + 4);
  drawLines([[{ text: 'Emergency Actions', bold: true }]], margin + style.pad, actionsY + style.pad, style.heading, style.heading + 3, '#ffffff');
  const actionTop = actionsY + style.pad + style.heading + 8;
  [steps.slice(0, actionSplit), steps.slice(actionSplit)].forEach((items, side) => {
    let stepY = actionTop;
    for (const step of items) {
      drawLines(step.lines, margin + style.pad + side * (actionWidth + gutter), stepY, style.body, style.leading);
      stepY += step.height + style.rowGap;
    }
  });
  canvas.pdfLayout.blocks.push({ title: 'Emergency Actions', x: margin, y: actionsY, width, height: actionHeight });
  drawLines([[{ text: 'Field copy | Confirm location, contacts and access before use.' }]], margin, pageHeight - margin - 12, 9.5, 12, '#53615b');
  canvas.sectionSizes = [emergency, directions, ...panels].map(panel => ({ title: panel.section.title, height: panel.height }));
  canvas.fieldMetrics = {
    bodyFontPt: style.body, headingFontPt: style.heading, keyFontPt: 18, directionsFontPt: style.body,
    bottom: (pageHeight - margin) * 2, limit: (pageHeight - margin) * 2, overflow,
    marginPt: margin, actionColumns: style.actionColumns, columnHeights: columns.heights,
  };
  return canvas;
}

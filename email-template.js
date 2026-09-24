(() => {
  const escape = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
  const phonePattern = /(\+?\d[\d(). -]{5,}\d|\b911\b)/g;
  const linkedPhones = value => String(value || '').split(phonePattern).map((part, index) => index % 2
    ? `<a href="tel:${part.replace(/[^+\d]/g, '')}" style="color:#174c37;text-decoration:underline">${escape(part)}</a>`
    : escape(part)).join('').replace(/\n/g, '<br>');
  const safeUrl = value => {
    try { const url = new URL(value); return ['http:', 'https:', 'tel:'].includes(url.protocol) ? url.href : ''; }
    catch { return ''; }
  };
  const rowHtml = row => {
    const url = safeUrl(row.url);
    const content = url && !url.startsWith('tel:')
      ? `<a href="${escape(url)}" target="_blank" rel="noopener" style="color:#174c37;text-decoration:underline">${escape(row.text)}</a>`
      : row.label === 'GPS' ? escape(row.text) : linkedPhones(row.text);
    return `<p style="margin:3px 0;overflow-wrap:anywhere;word-break:break-word">${row.label ? `<strong>${escape(row.label)}: </strong>` : ''}${content}</p>`;
  };
  const sectionHtml = (title, rows) => !rows.length ? '' : `<div style="margin:0 0 14px"><h2 style="font-size:18px;line-height:1.3;color:#174c37;border-bottom:1px solid #c6d2ca;margin:0 0 6px;padding:0 0 4px">${escape(title)}</h2>${rows.map(rowHtml).join('')}</div>`;

  function procedureHtml(value) {
    const text = String(value || '');
    const markers = Array.from(text.matchAll(/(?:^|\s)(\d+)[.)]\s+/g));
    const numbered = markers.length > 1 && !text.slice(0, markers[0].index).trim() && markers.every((match, index) => Number(match[1]) === index + 1);
    if (!numbered) return rowHtml({ text });
    return `<ol style="margin:4px 0 0;padding-left:22px">${markers.map((match, index) => `<li style="margin:0 0 3px;padding-left:2px">${linkedPhones(text.slice(match.index + match[0].length, markers[index + 1]?.index).trim())}</li>`).join('')}</ol>`;
  }

  function render(data) {
    const emergency = data.emergency.rows.filter(row => ['Site location', 'GPS', 'MEET RESPONDERS HERE'].includes(row.label) || row.text === 'Open site in Google Maps');
    const start = data.emergency.rows.filter(row => row.label === 'Start from');
    const directions = data.emergency.rows.find(row => row.kind === 'directions');
    const accessHazards = data.right.find(section => section.title === 'Access / hazards')?.rows || [];
    const access = [...data.emergency.rows.filter(row => row.label === 'Gate / access'), ...accessHazards.filter(row => row.label !== 'Hazards')];
    const contacts = data.left.filter(section => ['People', 'People & Contact Information', 'Emergency numbers'].includes(section.title)).flatMap(section => section.rows);
    const medical = (data.left.find(section => section.title === 'Hospital / ER')?.rows || []).map(row => row.text === 'Hospital directions' ? { ...row, text: 'Open hospital directions' } : row);
    const landing = data.right.find(section => section.title === 'Helicopter landing zone')?.rows || [];
    const hazards = accessHazards.filter(row => row.label === 'Hazards').map(row => ({ ...row, label: '' }));
    const equipment = data.right.find(section => section.title === 'Emergency equipment')?.rows || [];
    const column = html => `<div class="wrsp-column" style="display:inline-block;vertical-align:top;width:100%;max-width:304px;box-sizing:border-box;padding:0 8px;font:16px/1.4 Arial,Helvetica,sans-serif;text-align:left">${html}</div>`;
    return `<!doctype html><html lang="en" dir="ltr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escape(data.title)}</title><style>@media screen and (max-width:620px){.wrsp-column{max-width:100%!important}.wrsp-shell{padding:12px!important}}</style></head>
<body style="margin:0;padding:0;background:#fff;color:#202923"><table role="presentation" lang="en" dir="ltr" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;margin:0 auto;table-layout:fixed"><tr><td class="wrsp-shell" style="padding:16px;font:16px/1.4 Arial,Helvetica,sans-serif;overflow-wrap:anywhere;word-break:break-word">
<h1 style="font-size:26px;line-height:1.15;color:#174c37;margin:0 0 4px">${escape(data.title)}</h1>
<p style="font-size:16px;margin:0 0 4px">Emergency Safety Plan</p>
<p style="font-size:14px;color:#505a53;margin:0 0 12px">${linkedPhones(data.meta)}</p>
<div style="border-left:4px solid #a12d1c;background:#f0f5f2;padding:10px 12px;margin:0 0 12px"><h2 style="font-size:24px;line-height:1.2;margin:0 0 6px"><a href="tel:911" style="color:#922b1b;text-decoration:underline">CALL 911</a></h2>${emergency.map(rowHtml).join('')}</div>
<div style="border:1px solid #c6d2ca;padding:10px 12px;margin:0 0 14px"><h2 style="font-size:18px;line-height:1.3;color:#174c37;margin:0 0 6px">Directions for Responders</h2>${start.map(rowHtml).join('')}${rowHtml({ text: directions?.text || 'Not entered' })}${data.links.map(rowHtml).join('')}</div>
<div style="font-size:0;text-align:left;margin:0 -8px">${column(sectionHtml('Access / Gate Information', access) + sectionHtml('Contacts', contacts) + sectionHtml('Medical / Hospital', medical))}${column(sectionHtml('Helicopter Landing Zone', landing) + sectionHtml('Hazards', hazards) + sectionHtml('Emergency Equipment', equipment))}</div>
<div style="border-top:1px solid #c6d2ca;padding-top:8px"><h2 style="font-size:18px;line-height:1.3;color:#174c37;margin:0 0 6px">Emergency Actions</h2>${data.actions.rows.map(row => procedureHtml(row.text)).join('')}</div>
</td></tr></table></body></html>`;
  }

  globalThis.WRSPEmail = Object.freeze({ render });
})();

/* =========================================================
   Plyndi — Owner dashboard for client submissions
   The page itself holds no data. Everything is fetched from
   /api/client/admin/*, which only answers requests that carry a
   valid Cloudflare Access login (checked server-side).
   ========================================================= */
import { STEPS, LISTS, FILE_CATEGORIES, isFilled } from './client-schema.js';
import { api, h, formatBytes, formatDate, safeUrl } from './client-api.js';

const STATUSES = ['New', 'Reviewing', 'In Progress', 'Approved', 'Completed'];
const $ = id => document.getElementById(id);
let submissions = [];
let invites = [];
let detail = null;

init();

async function init() {
  STATUSES.forEach(s => $('ad-filter').append(h('option', { value: s }, s)));
  STATUSES.forEach(s => $('ad-d-status').append(h('option', { value: s }, s)));
  $('ad-search').addEventListener('input', drawRows);
  $('ad-filter').addEventListener('change', drawRows);
  $('ad-refresh').addEventListener('click', loadList);
  $('ad-export-all').addEventListener('click', exportAllCsv);
  $('tab-subs').addEventListener('click', () => tab('subs'));
  $('tab-links').addEventListener('click', () => tab('links'));
  $('ad-invite-form').addEventListener('submit', createInvite);
  $('ad-back').addEventListener('click', e => { e.preventDefault(); history.pushState(null, '', location.pathname); route(); });
  window.addEventListener('popstate', route);

  try {
    const me = await api('/admin/me');
    $('ad-user').textContent = 'Signed in as ' + me.email;
  } catch (e) { return fatal(e); }
  route();
}

function fatal(e) {
  const box = $('ad-alert');
  const msg = e.status === 401 || e.status === 403
    ? 'You need to be signed in with an allowed account. Reload the page to sign in through Cloudflare Access.'
    : e.status === 503 ? e.message + ' See the setup guide (Cloudflare Access + Worker variables).' : e.message;
  box.replaceChildren(h('p', { class: 'cs-error-title' }, 'Admin unavailable'), h('p', null, msg));
  box.hidden = false;
  $('ad-list-view').hidden = true; $('ad-detail-view').hidden = true;
}
function flash(msg, isError) {
  const box = $('ad-alert');
  box.replaceChildren(h('p', { class: isError ? 'cs-error-title' : 'ad-ok' }, msg));
  box.classList.toggle('is-ok', !isError);
  box.hidden = false;
  clearTimeout(flash.t); flash.t = setTimeout(() => { box.hidden = true; }, 5000);
}

function route() {
  const id = new URLSearchParams(location.search).get('id');
  if (id) { $('ad-list-view').hidden = true; $('ad-detail-view').hidden = false; loadDetail(id); }
  else { $('ad-detail-view').hidden = true; $('ad-list-view').hidden = false; loadList(); }
}

function tab(which) {
  $('tab-subs').setAttribute('aria-selected', String(which === 'subs'));
  $('tab-links').setAttribute('aria-selected', String(which === 'links'));
  $('ad-subs').hidden = which !== 'subs';
  $('ad-links').hidden = which !== 'links';
  if (which === 'links') loadInvites();
}

/* ---------------- Submissions list ---------------- */
async function loadList() {
  $('ad-rows').replaceChildren(h('tr', null, h('td', { colspan: 6, class: 'ad-empty' }, 'Loading…')));
  try { submissions = (await api('/admin/submissions')).submissions || []; drawRows(); }
  catch (e) { if ([401, 403, 503].includes(e.status)) return fatal(e); flash(e.message, true); }
}

function drawRows() {
  const q = $('ad-search').value.trim().toLowerCase();
  const st = $('ad-filter').value;
  const rows = submissions.filter(s => (!st || s.status === st) &&
    (!q || [s.company_name, s.email, s.ref, s.client_name].some(v => String(v || '').toLowerCase().includes(q))));
  if (!rows.length) {
    $('ad-rows').replaceChildren(h('tr', null, h('td', { colspan: 6, class: 'ad-empty' }, submissions.length ? 'No submissions match.' : 'No submissions yet. Create a client link and send it to your client.')));
    return;
  }
  $('ad-rows').replaceChildren(...rows.map(s => h('tr', null,
    h('td', { 'data-label': 'Submission' }, h('strong', null, s.ref), h('span', { class: 'ad-sub' }, `Rev ${s.revision_number} · ${s.file_count} file${s.file_count === 1 ? '' : 's'}`)),
    h('td', { 'data-label': 'Company' }, s.company_name, h('span', { class: 'ad-sub' }, s.client_name)),
    h('td', { 'data-label': 'Email' }, s.email ? h('a', { href: 'mailto:' + s.email }, s.email) : '—'),
    h('td', { 'data-label': 'Submitted' }, formatDate(s.submitted_at)),
    h('td', { 'data-label': 'Status' }, statusSelect(s)),
    h('td', { class: 'ad-actions' },
      h('a', { class: 'cs-link-btn', href: `/client-preview?id=${encodeURIComponent(s.public_token)}`, target: '_blank', rel: 'noopener noreferrer' }, 'Preview'),
      h('a', { class: 'btn btn-primary ad-btn-sm', href: `?id=${encodeURIComponent(s.public_token)}`, onclick: e => { e.preventDefault(); history.pushState(null, '', `?id=${encodeURIComponent(s.public_token)}`); route(); } }, 'View Details')))));
}

function statusSelect(s) {
  const sel = h('select', { class: 'ad-status is-' + slug(s.status), 'aria-label': `Status for ${s.ref}` }, STATUSES.map(x => h('option', { value: x, selected: x === s.status }, x)));
  sel.addEventListener('change', async () => {
    const prev = s.status;
    try { await setStatus(s.public_token, sel.value); s.status = sel.value; sel.className = 'ad-status is-' + slug(sel.value); flash(`${s.ref} marked as ${sel.value}.`); }
    catch (e) { sel.value = prev; flash(e.message, true); }
  });
  return sel;
}
const slug = s => String(s).toLowerCase().replace(/\s+/g, '-');
function setStatus(token, status, owner_notes) {
  return api(`/admin/submissions/${encodeURIComponent(token)}`, { method: 'PATCH', body: { status, owner_notes } });
}

/* ---------------- Detail ---------------- */
async function loadDetail(token) {
  $('ad-d-body').replaceChildren(h('p', null, 'Loading…'));
  $('ad-d-title').textContent = '';
  try { detail = await api(`/admin/submissions/${encodeURIComponent(token)}`); }
  catch (e) { if ([401, 403, 503].includes(e.status)) return fatal(e); $('ad-d-body').replaceChildren(h('p', null, e.message)); return; }
  const p = detail.project;
  $('ad-d-ref').textContent = `${p.ref} · Revision ${p.revision_number}`;
  $('ad-d-title').textContent = p.company_name;
  $('ad-d-meta').textContent = `Submitted ${formatDate(p.submitted_at)} · via link “${detail.invite.client_name}”${detail.invite.active ? '' : ' (closed)'}`;
  $('ad-d-status').value = p.status;
  $('ad-d-status').onchange = async () => { try { await setStatus(p.public_token, $('ad-d-status').value); p.status = $('ad-d-status').value; flash('Status updated.'); } catch (e) { flash(e.message, true); } };
  $('ad-d-reviewed').onclick = async () => { try { await setStatus(p.public_token, 'Reviewing'); p.status = 'Reviewing'; $('ad-d-status').value = 'Reviewing'; flash('Marked as Reviewing.'); } catch (e) { flash(e.message, true); } };
  $('ad-d-preview').href = `/client-preview?id=${encodeURIComponent(p.public_token)}`;
  $('ad-d-json').onclick = () => download(`${p.ref}.json`, JSON.stringify(exportShape(detail), null, 2), 'application/json');
  $('ad-d-csv').onclick = () => download(`${p.ref}.csv`, detailCsv(detail), 'text/csv');
  $('ad-d-notes').value = p.owner_notes || '';
  $('ad-d-notes-save').onclick = async () => {
    try { await setStatus(p.public_token, p.status, $('ad-d-notes').value); $('ad-d-notes-status').textContent = 'Saved ' + new Date().toLocaleTimeString(); }
    catch (e) { flash(e.message, true); }
  };
  renderDetailBody(detail);
}

function renderDetailBody(d) {
  const p = d.project;
  const files = d.files || [];
  const byId = new Map(files.map(f => [f.id, f]));
  const out = [];

  if ((d.revisions || []).length > 1) {
    out.push(h('section', { class: 'cs-review-card' }, h('h3', null, 'Revisions'),
      h('ul', { class: 'ad-revs' }, d.revisions.map(r => h('li', null,
        r.public_token === p.public_token ? h('strong', null, `Rev ${r.revision_number} · ${r.ref} (this one)`) :
          h('a', { href: `?id=${encodeURIComponent(r.public_token)}`, onclick: e => { e.preventDefault(); history.pushState(null, '', `?id=${encodeURIComponent(r.public_token)}`); route(); } }, `Rev ${r.revision_number} · ${r.ref}`),
        ' — ', formatDate(r.submitted_at))))));
  }

  STEPS.forEach(step => {
    const dl = h('dl', { class: 'cs-dl' });
    let any = false;
    const seen = new Set();
    step.items.forEach(item => {
      if (item.key) {
        const v = p[item.key];
        if (!isFilled(v)) return;
        any = true;
        dl.append(h('dt', null, item.label), h('dd', null, valueNode(item, v)));
      } else if (item.files && !seen.has(item.files)) {
        seen.add(item.files);
        const fs = files.filter(f => f.category === item.files);
        if (!fs.length) return;
        any = true;
        dl.append(h('dt', null, FILE_CATEGORIES[item.files].label), h('dd', null, fileList(fs)));
      } else if (item.list) {
        const def = LISTS[item.list];
        const rows = (d.lists && d.lists[item.list]) || [];
        rows.forEach((row, i) => {
          any = true;
          const inner = h('dl', { class: 'cs-dl ad-subdl' });
          def.fields.forEach(f => {
            if (f.type === 'file') {
              const fs = (row[f.key] || []).map(id => byId.get(id)).filter(Boolean);
              if (fs.length) inner.append(h('dt', null, f.label), h('dd', null, fileList(fs)));
            } else if (isFilled(row[f.key])) inner.append(h('dt', null, f.label), h('dd', null, valueNode(f, row[f.key])));
          });
          dl.append(h('dt', { class: 'ad-item-dt' }, `${def.itemLabel} ${i + 1}`), h('dd', null, inner));
        });
      }
    });
    if (!any) dl.append(h('dd', { class: 'cs-muted' }, 'Nothing provided.'));
    out.push(h('section', { class: 'cs-review-card' }, h('div', { class: 'cs-review-head' }, h('h3', null, step.review)), dl));
  });
  $('ad-d-body').replaceChildren(...out);
}

function valueNode(f, v) {
  if (Array.isArray(v)) return v.join(', ');
  if (f.type === 'url') { const u = safeUrl(v); return u ? h('a', { href: u, target: '_blank', rel: 'noopener noreferrer' }, v) : v; }
  if (f.type === 'email') return h('a', { href: 'mailto:' + v }, v);
  if (f.type === 'color') return h('span', { class: 'ad-swatch-wrap' }, h('span', { class: 'ad-swatch', style: { background: /^#[0-9a-f]{6}$/i.test(v) ? v : 'transparent' } }), v);
  return v;
}
function fileList(fs) {
  return h('ul', { class: 'ad-files' }, fs.map(f => h('li', null,
    (f.type || '').startsWith('image/') && f.url ? h('a', { href: f.url, target: '_blank', rel: 'noopener noreferrer' }, h('img', { src: f.url, alt: '', class: 'cs-thumb', loading: 'lazy' })) : h('span', { class: 'cs-file-icon' }, (f.type || '').includes('pdf') ? 'PDF' : 'FILE'),
    h('span', { class: 'cs-file-meta' }, h('span', { class: 'cs-file-name' }, f.name), h('span', { class: 'cs-file-size' }, formatBytes(f.size))),
    f.download_url ? h('a', { class: 'cs-link-btn', href: f.download_url, rel: 'noopener noreferrer' }, 'Download') : null)));
}

/* ---------------- Export ---------------- */
function exportShape(d) {
  const files = (d.files || []).map(({ id, category, name, type, size }) => ({ id, category, name, type, size }));
  return { exported_at: new Date().toISOString(), project: d.project, lists: d.lists, files, revisions: d.revisions };
}
function csvCell(v) {
  let s = Array.isArray(v) ? v.join('; ') : (v === null || v === undefined ? '' : String(v));
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s;           // spreadsheet formula-injection guard
  return '"' + s.replace(/"/g, '""') + '"';
}
function detailCsv(d) {
  const rows = [['Section', 'Item', 'Field', 'Value']];
  const p = d.project;
  rows.push(['Submission', '', 'Reference', p.ref], ['Submission', '', 'Status', p.status], ['Submission', '', 'Submitted at', p.submitted_at], ['Submission', '', 'Revision', p.revision_number]);
  const byId = new Map((d.files || []).map(f => [f.id, f]));
  STEPS.forEach(step => step.items.forEach(item => {
    if (item.key && isFilled(p[item.key])) rows.push([step.review, '', item.label, p[item.key]]);
    if (item.list) (d.lists[item.list] || []).forEach((row, i) => LISTS[item.list].fields.forEach(f => {
      const v = f.type === 'file' ? (row[f.key] || []).map(id => byId.get(id)?.name).filter(Boolean) : row[f.key];
      if (isFilled(v)) rows.push([step.review, `${LISTS[item.list].itemLabel} ${i + 1}`, f.label, v]);
    }));
  }));
  (d.files || []).forEach(f => rows.push(['Files', FILE_CATEGORIES[f.category]?.label || f.category, f.name, formatBytes(f.size)]));
  return '﻿' + rows.map(r => r.map(csvCell).join(',')).join('\r\n');
}
function exportAllCsv() {
  const head = ['Reference', 'Company', 'Client link', 'Email', 'Country', 'Status', 'Submitted at', 'Revision', 'Files', 'Preview URL'];
  const rows = submissions.map(s => [s.ref, s.company_name, s.client_name, s.email, s.country, s.status, s.submitted_at, s.revision_number, s.file_count, `${location.origin}/client-preview?id=${s.public_token}`]);
  download(`client-submissions-${new Date().toISOString().slice(0, 10)}.csv`, '﻿' + [head, ...rows].map(r => r.map(csvCell).join(',')).join('\r\n'), 'text/csv');
}
function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type: type + ';charset=utf-8' }));
  const a = h('a', { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/* ---------------- Client links (invites) ---------------- */
const inviteUrl = t => `${location.origin}/client-form?invite=${encodeURIComponent(t)}`;

async function loadInvites() {
  try { invites = (await api('/admin/invites')).invites || []; drawInvites(); }
  catch (e) { flash(e.message, true); }
}
function drawInvites() {
  if (!invites.length) { $('inv-rows').replaceChildren(h('tr', null, h('td', { colspan: 5, class: 'ad-empty' }, 'No client links yet.'))); return; }
  $('inv-rows').replaceChildren(...invites.map(inv => h('tr', null,
    h('td', { 'data-label': 'Client' }, h('strong', null, inv.client_name), inv.notes ? h('span', { class: 'ad-sub' }, inv.notes) : null),
    h('td', { 'data-label': 'Created' }, formatDate(inv.created_at)),
    h('td', { 'data-label': 'Submissions' }, String(inv.submissions)),
    h('td', { 'data-label': 'Status' }, h('span', { class: 'ad-pill ' + (inv.active ? 'is-on' : 'is-off') }, inv.active ? 'Active' : 'Closed')),
    h('td', { class: 'ad-actions' },
      h('button', { type: 'button', class: 'cs-link-btn', onclick: () => copy(inviteUrl(inv.token)) }, 'Copy link'),
      h('button', { type: 'button', class: 'cs-link-btn' + (inv.active ? ' cs-danger' : ''), onclick: () => toggleInvite(inv) }, inv.active ? 'Close link' : 'Re-open')))));
}
async function toggleInvite(inv) {
  try { await api(`/admin/invites/${inv.id}`, { method: 'PATCH', body: { active: !inv.active } }); inv.active = !inv.active; drawInvites(); flash(inv.active ? 'Link re-opened.' : 'Link closed — the client can no longer submit or upload.'); }
  catch (e) { flash(e.message, true); }
}
async function createInvite(e) {
  e.preventDefault();
  const name = $('inv-name').value.trim();
  if (!name) { $('inv-name').focus(); return; }
  $('inv-create').disabled = true;
  try {
    const inv = await api('/admin/invites', { method: 'POST', body: { client_name: name, notes: $('inv-notes').value } });
    const url = inviteUrl(inv.token);
    const res = $('inv-result');
    res.hidden = false;
    res.replaceChildren(h('p', null, h('strong', null, 'Link created for ' + inv.client_name + '. '), 'Send this private link to your client:'),
      h('div', { class: 'ad-copy-row' }, h('input', { readonly: true, value: url, 'aria-label': 'Client form link', onfocus: ev => ev.target.select() }),
        h('button', { type: 'button', class: 'btn btn-primary', onclick: () => copy(url) }, 'Copy')));
    $('inv-name').value = ''; $('inv-notes').value = '';
    loadInvites();
  } catch (err) { flash(err.message, true); }
  finally { $('inv-create').disabled = false; }
}
async function copy(text) {
  try { await navigator.clipboard.writeText(text); flash('Link copied to clipboard.'); }
  catch (_) { window.prompt('Copy this link:', text); }
}

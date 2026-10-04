/* =========================================================
   Plyndi — Client Project Form (multi-step)
   ---------------------------------------------------------
   • Text answers autosave to this browser (localStorage) — small JSON only.
   • Files upload straight to private cloud storage via short-lived
     signed URLs from the API; only file names/ids are kept locally.
   • Nothing is saved to the server until the client presses Submit.
   ========================================================= */
import * as schema from './client-schema.js';
import { api, ApiError, putFileWithProgress, guessMime, h, formatBytes, storageSafe, submissionToState } from './client-api.js';

const { STEPS, LISTS, GROUPS, FILE_CATEGORIES, UPLOAD_LIMITS, emptyState, isFilled, isVisible, validateField, validateAll } = schema;
const REVIEW_INDEX = STEPS.length;              // the step after the last form step

const $ = id => document.getElementById(id);
const params = new URLSearchParams(location.search);
const inviteToken = params.get('invite') || params.get('k') || '';
const DRAFT_KEY = 'plyndi-client-draft:' + inviteToken.slice(0, 16);

let state = emptyState();
let current = 0;
let maxVisited = 0;
let draftId = '';
let revisionOf = null;
let touched = new Set();
let submitting = false;
const uploads = new Map();     // localKey -> {xhr, category, name}
const thumbs = new Map();      // file id -> object/signed URL for image thumbnails (memory only)

/* ---------------- Boot ---------------- */
init();

async function init() {
  $('cs-retry').addEventListener('click', () => location.reload());
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(inviteToken)) return blocked();

  let invite;
  try {
    invite = await api('/invite?token=' + encodeURIComponent(inviteToken));
  } catch (e) {
    if (e.status === 403) return blocked('This link is not valid', e.message);
    return blocked('We could not open the form', e.message, true);
  }
  $('cs-client-label').textContent = 'Project information · ' + invite.client_name;

  loadDraft();

  // Coming back from the preview: "Edit information" / "Submit another revision"
  const editId = params.get('edit');
  if (editId) {
    try {
      const data = await api('/preview?id=' + encodeURIComponent(editId));
      state = submissionToState(data, schema);
      for (const list of Object.values(state.lists)) list.forEach(row => Object.values(row).forEach(v => Array.isArray(v) && v.forEach(f => f && f.url && thumbs.set(f.id, f.url))));
      for (const arr of Object.values(state.files)) arr.forEach(f => f.url && thumbs.set(f.id, f.url));
      revisionOf = editId;
      maxVisited = REVIEW_INDEX;
      current = params.get('mode') === 'revision' ? 0 : REVIEW_INDEX;
      saveDraft(true);
      history.replaceState(null, '', location.pathname + '?invite=' + encodeURIComponent(inviteToken));
    } catch (e) {
      console.warn('Could not load submission for editing', e);
    }
  }
  if (!draftId) draftId = randomId();

  if (revisionOf) {
    const b = $('cs-revision-banner');
    b.hidden = false;
    b.textContent = 'You are editing a previous submission. Submitting will create a new revision — the earlier one is kept.';
  }

  $('cs-loading').hidden = true;
  $('cs-app').hidden = false;
  wireNav();
  render();
  if (storageSafe.get(DRAFT_KEY)) setSaveStatus('saved');   // answers were restored from this device
}

function blocked(title, msg, canRetry) {
  $('cs-loading').hidden = true;
  $('cs-blocked').hidden = false;
  if (title) $('cs-blocked-title').textContent = title;
  if (msg) $('cs-blocked-msg').textContent = msg;
  $('cs-retry').hidden = !canRetry;
}

/* ---------------- Draft persistence (text only) ---------------- */
function loadDraft() {
  const d = storageSafe.get(DRAFT_KEY);
  if (!d || !d.state || d.invite !== inviteToken) return;
  state = Object.assign(emptyState(), d.state);
  state.lists = Object.assign(emptyState().lists, d.state.lists || {});
  current = Math.min(d.step || 0, REVIEW_INDEX);
  maxVisited = Math.min(Math.max(d.maxVisited || 0, current), REVIEW_INDEX);
  draftId = d.draftId || '';
  revisionOf = d.revisionOf || null;
}

let saveTimer = null;
function scheduleSave() {
  clearTimeout(saveTimer);
  setSaveStatus('saving');
  saveTimer = setTimeout(() => saveDraft(false), 500);
}
function saveDraft(silent) {
  const clean = JSON.parse(JSON.stringify(state, (k, v) => (k === 'url' ? undefined : v)));
  const ok = storageSafe.set(DRAFT_KEY, { invite: inviteToken, state: clean, step: current, maxVisited, draftId, revisionOf, savedAt: new Date().toISOString() });
  if (!silent) setSaveStatus(ok ? 'saved' : 'failed');
  return ok;
}
function setSaveStatus(kind) {
  const el = $('cs-save-status');
  if (!el) return;
  el.dataset.state = kind;
  el.textContent = kind === 'saving' ? 'Saving…'
    : kind === 'saved' ? '✓ Saved automatically'
    : 'Autosave unavailable in this browser — please finish in one sitting.';
}

/* ---------------- Navigation ---------------- */
function wireNav() {
  $('cs-form').addEventListener('submit', e => { e.preventDefault(); next(); });
  $('cs-back').addEventListener('click', () => go(current - 1));
  window.addEventListener('beforeunload', e => { if (uploads.size) { e.preventDefault(); e.returnValue = ''; } });
}

function next() {
  if (current === REVIEW_INDEX) return confirmSubmit();
  const errs = stepErrors(current);
  if (errs.length) return showErrors(errs);
  go(current + 1);
}

function go(i, focusKey) {
  if (i < 0 || i > REVIEW_INDEX) return;
  current = i;
  maxVisited = Math.max(maxVisited, i);
  touched = new Set();
  clearTimeout(saveTimer);
  saveDraft(false);
  render();
  window.scrollTo({ top: document.querySelector('.cs-stepper').offsetTop - 80, behavior: 'smooth' });
  if (focusKey) {
    const el = document.querySelector(`[data-key="${CSS.escape(focusKey)}"]`);
    if (el) { el.focus(); return; }
  }
  $('cs-step-title').focus({ preventScroll: true });
}

/* ---------------- Rendering ---------------- */
function render() {
  renderStepper();
  const isReview = current === REVIEW_INDEX;
  const step = STEPS[current];
  $('cs-step-count').textContent = isReview ? `Final step · Review` : `Step ${current + 1} of ${STEPS.length} · ${step.group}`;
  $('cs-step-title').textContent = isReview ? 'Review your information' : step.title;
  $('cs-step-intro').textContent = isReview ? 'Check everything below. Use “Edit” to change any section, then submit.' : (step.intro || '');
  $('cs-step-intro').hidden = !$('cs-step-intro').textContent;
  const notice = $('cs-step-notice');
  notice.hidden = isReview || !step.notice;
  notice.textContent = (!isReview && step.notice) || '';
  hideErrors();

  const body = $('cs-step-body');
  body.replaceChildren(isReview ? renderReview() : renderStep(step));

  $('cs-back').hidden = current === 0;
  const nextBtn = $('cs-next');
  nextBtn.innerHTML = '';
  nextBtn.append(isReview ? 'Submit Project Information' : (current === STEPS.length - 1 ? 'Review answers →' : 'Next →'));
  nextBtn.classList.toggle('btn-gold', isReview);
  updateSubmitState();
}

function renderStepper() {
  const list = $('cs-stepper-list');
  const currentGroup = submitting ? 'Submit' : (current === REVIEW_INDEX ? 'Review' : STEPS[current].group);
  const groupFirstStep = g => g === 'Review' ? REVIEW_INDEX : STEPS.findIndex(s => s.group === g);
  const curIdx = GROUPS.indexOf(currentGroup);
  list.replaceChildren(...GROUPS.map((g, gi) => {
    const target = groupFirstStep(g);
    const reachable = g !== 'Submit' && target >= 0 && target <= maxVisited && !submitting;
    const status = gi < curIdx ? 'done' : gi === curIdx ? 'current' : 'todo';
    const label = [h('span', { class: 'cs-pill-num', 'aria-hidden': 'true' }, status === 'done' ? '✓' : String(gi + 1)), h('span', { class: 'cs-pill-label' }, g)];
    return h('li', { class: `cs-pill is-${status}` },
      reachable && status !== 'current'
        ? h('button', { type: 'button', onclick: () => tryJump(target), 'aria-label': `${g}${status === 'done' ? ' (completed)' : ''}` }, label)
        : h('span', { 'aria-current': status === 'current' ? 'step' : null }, label));
  }));
  const pct = submitting ? 100 : Math.round((current / REVIEW_INDEX) * 100);
  $('cs-progress-bar').style.width = Math.max(4, pct) + '%';
  const active = list.querySelector('.is-current');
  if (active && list.scrollWidth > list.clientWidth) active.scrollIntoView({ block: 'nearest', inline: 'center' });
}

function tryJump(target) {
  if (target > current) {
    const errs = stepErrors(current);
    if (errs.length) return showErrors(errs);
  }
  go(target);
}

function renderStep(step) {
  const frag = h('div', { class: 'cs-grid' });
  for (const item of step.items) {
    if (item.heading) { frag.append(h('h3', { class: 'cs-subhead' }, item.heading)); continue; }
    if (item.list) { frag.append(renderList(item.list)); continue; }
    if (item.files) {
      frag.append(renderUploader({
        category: item.files, help: item.help, compact: item.compact, requiredIf: item.requiredIf,
        get: () => state.files[item.files] || [],
        set: arr => { state.files[item.files] = arr; }
      }));
      continue;
    }
    frag.append(renderField(item, state.fields, item.key, () => { refreshConditionals(step); }));
  }
  return frag;
}

function refreshConditionals(step) {
  for (const item of step.items) {
    if (item.files && item.requiredIf && state.fields[item.requiredIf.key] !== item.requiredIf.equals) setFieldError('files.' + item.files, '');
    if (!item.showIf) continue;
    const wrap = document.querySelector(`[data-wrap="${item.key}"]`);
    if (wrap) wrap.hidden = !isVisible(item, state.fields);
  }
}

/* One input of any type. `bag` is the object holding the value (state.fields or a list row). */
function renderField(f, bag, dataKey, onChange) {
  const id = 'f-' + dataKey.replace(/[^\w-]/g, '-');
  const errId = id + '-err', helpId = id + '-help';
  const describedBy = [f.help ? helpId : null, errId].filter(Boolean).join(' ');
  const wrap = h('div', { class: 'cs-field' + (f.half ? ' is-half' : ''), 'data-wrap': f.key });
  if (f.showIf && !isVisible(f, state.fields)) wrap.hidden = true;

  const label = h('label', { for: id }, f.label, f.required ? h('span', { class: 'cs-req', 'aria-hidden': 'true' }, ' *') : null);
  const err = h('p', { class: 'cs-error', id: errId, hidden: true });
  const help = f.help ? h('p', { class: 'cs-help', id: helpId }, f.help) : null;

  const commit = v => {
    if (Array.isArray(v) ? v.length : isFilled(v)) bag[f.key] = v; else delete bag[f.key];
    scheduleSave();
    if (touched.has(dataKey)) checkOne(f, bag, dataKey);
    onChange && onChange();
    updateSubmitState();
  };
  const blur = el => () => {
    touched.add(dataKey);
    if (f.type === 'url' && el.value && !/^https?:\/\//i.test(el.value.trim()) && /\./.test(el.value)) { el.value = 'https://' + el.value.trim(); commit(el.value); }
    checkOne(f, bag, dataKey);
  };
  const common = { id, 'data-key': dataKey, 'aria-describedby': describedBy, 'aria-required': f.required ? 'true' : null };
  const val = bag[f.key];

  let control;
  switch (f.type) {
    case 'textarea': {
      control = h('textarea', { ...common, rows: f.rows || 4, placeholder: f.placeholder, maxlength: 20000 });
      control.value = val || '';
      control.addEventListener('input', () => commit(control.value));
      control.addEventListener('blur', blur(control));
      break;
    }
    case 'select': {
      control = h('select', common, h('option', { value: '' }, 'Choose…'), f.options.map(o => h('option', { value: o, selected: val === o }, o)));
      control.addEventListener('change', () => { touched.add(dataKey); commit(control.value); });
      break;
    }
    case 'radio':
    case 'checkboxes': {
      const multi = f.type === 'checkboxes';
      const legendId = id + '-legend';
      control = h('fieldset', { class: 'cs-choices', 'data-key': dataKey, 'aria-describedby': describedBy, tabindex: -1, 'aria-labelledby': legendId },
        f.options.map((o, oi) => {
          const oid = `${id}-${oi}`;
          const input = h('input', { type: multi ? 'checkbox' : 'radio', id: oid, name: id, value: o,
            checked: multi ? (Array.isArray(val) && val.includes(o)) : val === o });
          input.addEventListener('change', () => {
            touched.add(dataKey);
            if (multi) commit([...control.querySelectorAll('input:checked')].map(i => i.value));
            else commit(input.value);
          });
          return h('label', { class: 'cs-choice', for: oid }, input, h('span', null, o));
        }));
      // for fieldsets the visible label is a legend-like element
      wrap.append(h('p', { class: 'cs-label', id: legendId }, f.label, f.required ? h('span', { class: 'cs-req', 'aria-hidden': 'true' }, ' *') : null), help || '', control, err);
      return wrap;
    }
    case 'color': {
      const text = h('input', { ...common, type: 'text', placeholder: '#20C1C4', maxlength: 7, inputmode: 'text', autocomplete: 'off', class: 'cs-color-text' });
      const picker = h('input', { type: 'color', 'aria-label': f.label + ' picker', value: /^#[0-9a-f]{6}$/i.test(val || '') ? val : '#20c1c4', class: 'cs-color-picker' });
      const clear = h('button', { type: 'button', class: 'cs-link-btn', hidden: !val }, 'Clear');
      text.value = val || '';
      picker.addEventListener('input', () => { text.value = picker.value.toUpperCase(); clear.hidden = false; commit(text.value); });
      text.addEventListener('input', () => {
        let v = text.value.trim(); if (v && v[0] !== '#') v = '#' + v;
        if (/^#[0-9a-f]{6}$/i.test(v)) picker.value = v;
        clear.hidden = !v; commit(v);
      });
      text.addEventListener('blur', blur(text));
      clear.addEventListener('click', () => { text.value = ''; clear.hidden = true; commit(''); text.focus(); });
      control = h('div', { class: 'cs-color' }, picker, text, clear);
      break;
    }
    default: {
      const type = { email: 'email', tel: 'tel', url: 'url' }[f.type] || 'text';
      control = h('input', {
        ...common, type, placeholder: f.placeholder || (f.type === 'url' ? 'https://' : null),
        inputmode: f.inputmode || (f.type === 'year' ? 'numeric' : null),
        maxlength: f.type === 'year' ? 4 : (f.max || 2000),
        autocomplete: { email: 'email', tel: 'tel', company_name: 'organization', office_address: 'street-address', country: 'country-name', city: 'address-level2' }[f.type === 'email' || f.type === 'tel' ? f.type : f.key] || 'off'
      });
      control.value = val || '';
      control.addEventListener('input', () => commit(control.value));
      control.addEventListener('blur', blur(control));
    }
  }
  wrap.append(label, help || '', control, err);
  return wrap;
}

function checkOne(f, bag, dataKey) {
  const msg = validateField(f, bag[f.key]);
  setFieldError(dataKey, msg);
  return msg;
}
function setFieldError(dataKey, msg) {
  const el = document.querySelector(`[data-key="${CSS.escape(dataKey)}"]`);
  if (!el) return;
  const wrap = el.closest('.cs-field');
  const err = wrap && wrap.querySelector('.cs-error');
  if (err) { err.textContent = msg || ''; err.hidden = !msg; }
  if (wrap) wrap.classList.toggle('has-error', !!msg);
  if (el.matches('input,textarea,select')) el.setAttribute('aria-invalid', msg ? 'true' : 'false');
}

/* ---------------- Repeaters (services, tours, …) ---------------- */
function renderList(listKey) {
  const def = LISTS[listKey];
  const container = h('div', { class: 'cs-list', 'data-list': listKey });
  const rows = state.lists[listKey];

  const draw = (focusIndex) => {
    container.replaceChildren();
    if (!rows.length) {
      container.append(h('div', { class: 'cs-empty' },
        h('p', null, `No ${def.itemLabel.toLowerCase()}s added yet.`),
        h('p', { class: 'cs-help' }, 'This section is optional — skip it if it does not apply, or add as many as you like.')));
    }
    rows.forEach((row, idx) => {
      const titleText = () => `${def.itemLabel} ${idx + 1}` + (row[def.titleKey] ? ` — ${row[def.titleKey]}` : '');
      const title = h('h3', { class: 'cs-item-title', id: `${listKey}-${idx}-title` }, titleText());
      const removeBtn = h('button', { type: 'button', class: 'cs-link-btn cs-danger', 'aria-label': `Remove ${def.itemLabel.toLowerCase()} ${idx + 1}` }, 'Remove');
      let armed = false, armTimer;
      removeBtn.addEventListener('click', () => {
        const hasContent = Object.values(row).some(v => Array.isArray(v) ? v.length : isFilled(v));
        if (hasContent && !armed) {
          armed = true; removeBtn.textContent = 'Click again to remove';
          armTimer = setTimeout(() => { armed = false; removeBtn.textContent = 'Remove'; }, 4000);
          return;
        }
        clearTimeout(armTimer);
        def.fields.filter(f => f.type === 'file').forEach(f => (row[f.key] || []).forEach(ref => deleteRemote(ref.id)));
        rows.splice(idx, 1);
        scheduleSave(); updateSubmitState();
        draw(Math.max(0, idx - 1));
      });

      const grid = h('div', { class: 'cs-grid' });
      def.fields.forEach(f => {
        const dataKey = `${listKey}.${idx}.${f.key}`;
        if (f.type === 'file') {
          grid.append(renderUploader({
            category: f.category, label: f.label, compact: true,
            get: () => row[f.key] || [], set: arr => { row[f.key] = arr; }
          }));
        } else {
          grid.append(renderField(f, row, dataKey, () => { if (f.key === def.titleKey) title.textContent = titleText(); }));
        }
      });
      container.append(h('section', { class: 'cs-item', 'aria-labelledby': title.id },
        h('div', { class: 'cs-item-head' }, title, removeBtn), grid));
    });
    const add = h('button', { type: 'button', class: 'btn btn-outline cs-add' }, rows.length ? def.addLabel : `+ Add ${def.itemLabel}`);
    add.addEventListener('click', () => {
      rows.push({});
      scheduleSave();
      draw(rows.length - 1);
      const first = container.querySelectorAll('.cs-item')[rows.length - 1]?.querySelector('input,textarea');
      if (first) first.focus();
    });
    container.append(add);
    if (focusIndex !== undefined && !rows.length) add.focus();
  };
  draw();
  return container;
}

/* ---------------- Uploads ---------------- */
function renderUploader({ category, label, help, compact, requiredIf, get, set }) {
  const cat = FILE_CATEGORIES[category];
  const inputId = `up-${category}-${Math.random().toString(36).slice(2, 7)}`;
  const listEl = h('ul', { class: 'cs-files', 'aria-live': 'polite' });
  const input = h('input', { type: 'file', id: inputId, accept: cat.accept, multiple: cat.multiple, class: 'cs-file-input' });
  const zone = h('div', { class: 'cs-drop' + (compact ? ' is-compact' : '') },
    h('p', { class: 'cs-drop-text' },
      h('label', { for: inputId, class: 'cs-drop-btn' }, cat.multiple ? 'Choose files' : 'Choose file'),
      h('span', null, ' or drag & drop here')),
    h('p', { class: 'cs-help' }, `${help ? help + ' ' : ''}Max ${UPLOAD_LIMITS.maxFileBytes / 1048576} MB per file.`),
    input);
  const errEl = h('p', { class: 'cs-error', hidden: true });
  const wrap = h('div', { class: 'cs-field cs-upload', 'data-upload': category, 'data-key': requiredIf ? 'files.' + category : null, tabindex: requiredIf ? -1 : null },
    h('p', { class: 'cs-label' }, label || cat.label), zone, listEl, errEl);

  const drawList = () => {
    listEl.replaceChildren(...get().map(ref => fileRow(ref, () => {
      set(get().filter(r => r.id !== ref.id));
      deleteRemote(ref.id);
      scheduleSave(); drawList(); updateSubmitState();
    })));
    zone.hidden = !cat.multiple && get().length > 0;
    if (requiredIf && get().length) setFieldError('files.' + category, '');
  };

  const handleFiles = files => {
    let list = [...files];
    if (!cat.multiple) {
      list = list.slice(0, 1);
      get().forEach(r => deleteRemote(r.id));
      set([]);
    }
    list.forEach(file => uploadOne(file, category, listEl, ref => { set([...get(), ref]); scheduleSave(); drawList(); }));
    drawList();
  };
  input.addEventListener('change', () => { handleFiles(input.files); input.value = ''; });
  ['dragenter', 'dragover'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.remove('is-over'); }));
  zone.addEventListener('drop', e => { if (e.dataTransfer?.files?.length) handleFiles(e.dataTransfer.files); });

  drawList();
  return wrap;
}

function fileRow(ref, onRemove) {
  const isImg = (ref.type || '').startsWith('image/');
  const thumb = thumbs.get(ref.id);
  return h('li', { class: 'cs-file is-done' },
    isImg && thumb ? h('img', { src: thumb, alt: '', class: 'cs-thumb', loading: 'lazy' }) : h('span', { class: 'cs-file-icon', 'aria-hidden': 'true' }, fileIcon(ref)),
    h('span', { class: 'cs-file-meta' }, h('span', { class: 'cs-file-name' }, ref.name), h('span', { class: 'cs-file-size' }, `${formatBytes(ref.size)} · Uploaded ✓`)),
    h('button', { type: 'button', class: 'cs-link-btn cs-danger', onclick: onRemove, 'aria-label': `Remove ${ref.name}` }, 'Remove'));
}
function fileIcon(ref) {
  const t = ref.type || '';
  return t.startsWith('video/') ? '▶' : t === 'application/pdf' ? 'PDF' : t.startsWith('image/') ? '▣' : 'DOC';
}

async function uploadOne(file, category, listEl, onDone) {
  const key = randomId();
  const bar = h('span', { class: 'cs-bar-fill' });
  const status = h('span', { class: 'cs-file-size' }, `${formatBytes(file.size)} · Preparing…`);
  const cancel = h('button', { type: 'button', class: 'cs-link-btn cs-danger' }, 'Cancel');
  const row = h('li', { class: 'cs-file is-uploading' },
    h('span', { class: 'cs-file-icon', 'aria-hidden': 'true' }, '↑'),
    h('span', { class: 'cs-file-meta' }, h('span', { class: 'cs-file-name' }, file.name), status,
      h('span', { class: 'cs-bar', role: 'progressbar', 'aria-label': `Uploading ${file.name}`, 'aria-valuemin': 0, 'aria-valuemax': 100, 'aria-valuenow': 0 }, bar)),
    cancel);
  const pending = h('ul', { class: 'cs-files-pending' }, row);
  listEl.after(pending);
  uploads.set(key, { category });
  updateSubmitState();

  const fail = msg => {
    row.className = 'cs-file is-error';
    status.textContent = msg;
    cancel.textContent = 'Dismiss';
    cancel.onclick = () => pending.remove();
    uploads.delete(key); updateSubmitState();
  };
  let cancelled = false, fileId = null;
  cancel.onclick = () => {
    cancelled = true;
    const u = uploads.get(key); if (u && u.xhr) u.xhr.abort();
    if (fileId) deleteRemote(fileId);
    pending.remove(); uploads.delete(key); updateSubmitState();
  };

  if (file.size > UPLOAD_LIMITS.maxFileBytes) return fail(`Too large (${formatBytes(file.size)}). Max ${UPLOAD_LIMITS.maxFileBytes / 1048576} MB — please share a link instead.`);
  if (!file.size) return fail('This file is empty.');
  try {
    const r = await api('/uploads', { method: 'POST', body: { invite: inviteToken, draft_id: draftId, category, name: file.name, size: file.size, type: guessMime(file) } });
    if (cancelled) { deleteRemote(r.id); return; }
    fileId = r.id;
    status.textContent = `${formatBytes(file.size)} · Uploading 0%`;
    const p = putFileWithProgress(r.upload_url, file, frac => {
      const pct = Math.round(frac * 100);
      bar.style.width = pct + '%';
      bar.parentElement.setAttribute('aria-valuenow', pct);
      status.textContent = `${formatBytes(file.size)} · Uploading ${pct}%`;
    });
    uploads.get(key).xhr = putFileWithProgress.lastXhr;
    await p;
    if (cancelled) return;
    status.textContent = `${formatBytes(file.size)} · Finishing…`;
    await api(`/uploads/${r.id}/complete`, { method: 'POST', body: { invite: inviteToken } });
    if (cancelled) return;
    if ((file.type || '').startsWith('image/')) thumbs.set(r.id, URL.createObjectURL(file));
    uploads.delete(key);
    pending.remove();
    onDone({ id: r.id, name: file.name, size: file.size, type: guessMime(file) });
    updateSubmitState();
  } catch (e) {
    if (cancelled) return;
    if (fileId) deleteRemote(fileId);
    fail(e.message || 'Upload failed.');
  }
}

function deleteRemote(id) {
  if (!id) return;
  thumbs.delete(id);
  api(`/uploads/${id}`, { method: 'DELETE', body: { invite: inviteToken } }).catch(e => console.warn('delete failed', e.message));
}

/* ---------------- Validation & errors ---------------- */
function stepErrors(i) {
  return validateAll(state).filter(e => e.stepIndex === i);
}
function showErrors(errs) {
  const box = $('cs-error-summary');
  box.replaceChildren(
    h('p', { class: 'cs-error-title' }, errs.length === 1 ? 'Please fix 1 thing before continuing:' : `Please fix ${errs.length} things before continuing:`),
    h('ul', null, errs.map(e => h('li', null, h('a', { href: '#', onclick: ev => { ev.preventDefault(); jumpToError(e); } }, e.message)))));
  box.hidden = false;
  errs.forEach(e => { touched.add(e.key); setFieldError(e.key, e.message); });
  box.focus();
}
function hideErrors() { const b = $('cs-error-summary'); b.hidden = true; b.replaceChildren(); }
function jumpToError(e) {
  if (e.stepIndex !== current) { go(e.stepIndex, e.key); setTimeout(() => setFieldError(e.key, e.message), 0); return; }
  const el = document.querySelector(`[data-key="${CSS.escape(e.key)}"]`);
  if (el) { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }
}

function updateSubmitState() {
  if (current !== REVIEW_INDEX) { $('cs-next').disabled = false; return; }
  const blocking = validateAll(state).length > 0 || uploads.size > 0 || submitting;
  $('cs-next').disabled = blocking;
  const reason = $('cs-submit-reason');
  if (reason) {
    reason.textContent = uploads.size ? 'Please wait for uploads to finish.' :
      validateAll(state).length ? 'Complete the required items above to enable submission.' : '';
  }
}

/* ---------------- Review ---------------- */
function renderReview() {
  const wrap = h('div', { class: 'cs-review' });
  const errors = validateAll(state);
  if (errors.length) {
    wrap.append(h('div', { class: 'cs-review-missing', role: 'status' },
      h('p', { class: 'cs-error-title' }, 'Required information still missing:'),
      h('ul', null, errors.map(e => h('li', null, h('a', { href: '#', onclick: ev => { ev.preventDefault(); jumpToError(e); } }, `${STEPS[e.stepIndex].title}: ${e.message}`))))));
  }

  STEPS.forEach((step, i) => {
    const card = h('section', { class: 'cs-review-card', 'aria-labelledby': `rv-${step.id}` });
    const editBtn = h('button', { type: 'button', class: 'btn cs-btn-ghost cs-edit', onclick: () => go(i), 'aria-label': `Edit ${step.review}` }, 'Edit');
    card.append(h('div', { class: 'cs-review-head' }, h('h3', { id: `rv-${step.id}` }, step.review), editBtn));
    const dl = h('dl', { class: 'cs-dl' });
    let any = false;
    const seenFiles = new Set();
    for (const item of step.items) {
      if (item.key) {
        if (!isVisible(item, state.fields)) continue;
        const v = state.fields[item.key];
        if (!isFilled(v) && !item.required) continue;
        any = true;
        dl.append(h('dt', null, item.label), h('dd', { class: isFilled(v) ? '' : 'is-missing' }, isFilled(v) ? (Array.isArray(v) ? v.join(', ') : v) : 'Required — not provided'));
      } else if (item.files && !seenFiles.has(item.files)) {
        seenFiles.add(item.files);
        const files = state.files[item.files] || [];
        if (!files.length) continue;
        any = true;
        dl.append(h('dt', null, FILE_CATEGORIES[item.files].label), h('dd', null, files.map(f => f.name).join(', ')));
      } else if (item.list) {
        const def = LISTS[item.list];
        const rows = state.lists[item.list];
        if (!rows.length) continue;
        any = true;
        rows.forEach((row, ri) => {
          const parts = def.fields.filter(f => f.type === 'file' ? (row[f.key] || []).length : isFilled(row[f.key]));
          dl.append(h('dt', null, `${def.itemLabel} ${ri + 1}`),
            h('dd', null, h('ul', { class: 'cs-review-sub' }, parts.map(f => h('li', null, h('strong', null, f.label + ': '),
              f.type === 'file' ? row[f.key].map(x => x.name).join(', ') : truncate(row[f.key], 220))))));
        });
      }
    }
    if (!any) dl.append(h('dd', { class: 'cs-muted' }, 'Nothing added — that’s fine if it doesn’t apply.'));
    card.append(dl);
    wrap.append(card);
  });
  wrap.append(h('p', { class: 'cs-help cs-submit-reason', id: 'cs-submit-reason', 'aria-live': 'polite' }));
  return wrap;
}
function truncate(s, n) { s = String(s); return s.length > n ? s.slice(0, n - 1) + '…' : s; }

/* ---------------- Submit ---------------- */
function confirmSubmit() {
  const errs = validateAll(state);
  if (errs.length) return showErrors(errs);
  if (uploads.size) return showErrors([{ stepIndex: current, key: '_uploads', message: 'Please wait for uploads to finish.' }]);
  const dlg = $('cs-confirm');
  if (typeof dlg.showModal !== 'function') { if (window.confirm('Are you sure you want to submit your information?')) doSubmit(); return; }
  dlg.returnValue = '';
  dlg.showModal();
  dlg.addEventListener('close', () => { if (dlg.returnValue === 'confirm') doSubmit(); }, { once: true });
}

async function doSubmit() {
  submitting = true;
  const btn = $('cs-next');
  btn.disabled = true;
  btn.replaceChildren(h('span', { class: 'cs-spinner is-small', 'aria-hidden': 'true' }), ' Submitting…');
  $('cs-back').disabled = true;
  renderStepper();
  try {
    const res = await api('/submit', { method: 'POST', body: { invite: inviteToken, revision_of: revisionOf, state } });
    // Keep the answers (minus the revision marker) so "Back to form" still works; record the submission.
    revisionOf = res.id;
    saveDraft(true);
    storageSafe.set('plyndi-client-last:' + inviteToken.slice(0, 16), { id: res.id, ref: res.ref, at: res.submitted_at });
    btn.replaceChildren('Submitted ✓ — opening your preview…');
    location.assign(res.preview_url + '&new=1');
  } catch (e) {
    submitting = false;
    $('cs-back').disabled = false;
    render();
    if (e instanceof ApiError && e.status === 422 && e.data.errors) return showErrors(e.data.errors);
    const box = $('cs-error-summary');
    box.replaceChildren(h('p', { class: 'cs-error-title' }, 'Your information was not submitted.'), h('p', null, e.message || 'Please try again.'),
      h('p', { class: 'cs-help' }, 'Your answers are still saved on this device.'));
    box.hidden = false; box.focus();
  }
}

function randomId() {
  const b = crypto.getRandomValues(new Uint8Array(12));
  return [...b].map(x => x.toString(16).padStart(2, '0')).join('');
}

/* Plyndi client system — tiny API + DOM helpers shared by the form, preview and admin pages.
   No keys or secrets here: the browser only ever talks to /api/client/* on plyndi.com. */

export const API_BASE = '/api/client';

export class ApiError extends Error {
  constructor(status, message, data) { super(message); this.status = status; this.data = data || {}; }
}

export async function api(path, { method = 'GET', body, signal } = {}) {
  let res;
  try {
    res = await fetch(API_BASE + path, {
      method,
      headers: body !== undefined ? { 'Content-Type': 'application/json' } : {},
      body: body !== undefined ? JSON.stringify(body) : undefined,
      credentials: 'same-origin',
      signal
    });
  } catch (e) {
    if (e.name === 'AbortError') throw e;
    throw new ApiError(0, 'We could not reach the server. Please check your connection and try again.');
  }
  let data = null;
  const text = await res.text();
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = null; }
  if (!res.ok) {
    const msg = (data && data.error) || (res.status === 404 ? 'Not found.' : `Request failed (${res.status}).`);
    throw new ApiError(res.status, msg, data);
  }
  return data;
}

/* Upload one file straight to private storage with a signed URL (shows real progress). */
export function putFileWithProgress(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = e => { if (e.lengthComputable) onProgress(e.loaded / e.total); };
    xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new ApiError(xhr.status, uploadErrorMessage(xhr)));
    xhr.onerror = () => reject(new ApiError(0, 'Upload failed — check your connection and try again.'));
    xhr.onabort = () => reject(new ApiError(0, 'Upload cancelled.'));
    const fd = new FormData();
    fd.append('cacheControl', '3600');
    fd.append('', withMimeType(file), file.name);
    xhr.send(fd);
    putFileWithProgress.lastXhr = xhr;
  });
}
function uploadErrorMessage(xhr) {
  try {
    const d = JSON.parse(xhr.responseText);
    if (/mime/i.test(d.message || d.error || '')) return 'This file type is not accepted.';
    if (/size|large/i.test(d.message || d.error || '')) return 'This file is too large.';
  } catch (_) {}
  return `Upload failed (${xhr.status}). Please try again.`;
}

const EXT_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', svg: 'image/svg+xml',
  avif: 'image/avif', heic: 'image/heic', pdf: 'application/pdf', doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint', pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain', mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm', zip: 'application/zip'
};
export function guessMime(file) {
  if (file.type) return file.type;
  const ext = (file.name.split('.').pop() || '').toLowerCase();
  return EXT_MIME[ext] || '';
}
function withMimeType(file) {
  const type = guessMime(file);
  return (file.type || !type) ? file : new Blob([file], { type });
}

/* Safe DOM builder: text is always set with textContent, never innerHTML. */
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  if (attrs) for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'text') el.textContent = v;
    else if (k === 'dataset') Object.assign(el.dataset, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (v === true) el.setAttribute(k, '');
    else el.setAttribute(k, String(v));
  }
  for (const c of children.flat(Infinity)) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/* Only allow http(s) links into href attributes (blocks javascript: etc.). */
export function safeUrl(v) {
  if (!v) return null;
  let s = String(v).trim();
  if (!/^https?:\/\//i.test(s)) {
    if (/^[\w-]+(\.[\w-]+)+(\/|$)/.test(s)) s = 'https://' + s; else return null;
  }
  try { const u = new URL(s); return (u.protocol === 'http:' || u.protocol === 'https:') ? u.href : null; } catch (_) { return null; }
}

export function formatBytes(n) {
  if (!Number.isFinite(n)) return '';
  if (n < 1024) return n + ' B';
  if (n < 1048576) return (n / 1024).toFixed(0) + ' KB';
  return (n / 1048576).toFixed(1) + ' MB';
}

export function formatDate(iso) {
  if (!iso) return '';
  try { return new Date(iso).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }); }
  catch (_) { return iso; }
}

export const storageSafe = {
  get(k) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : null; } catch (_) { return null; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch (_) { return false; } },
  remove(k) { try { localStorage.removeItem(k); } catch (_) {} }
};

/* Turn a saved submission (preview/admin API shape) back into form state — used by "Edit information". */
export function submissionToState(data, schema) {
  const { FIELD_KEYS, LISTS, emptyState } = schema;
  const state = emptyState();
  const p = data.project || {};
  for (const k of FIELD_KEYS) {
    const v = p[k];
    if (v === null || v === undefined || (Array.isArray(v) && !v.length)) continue;
    state.fields[k] = v;
  }
  const byId = new Map((data.files || []).map(f => [f.id, f]));
  const ref = id => { const f = byId.get(id); return f ? { id: f.id, name: f.name, size: f.size, type: f.type, url: f.url } : null; };
  const listCats = new Set();
  for (const [listKey, def] of Object.entries(LISTS)) {
    def.fields.filter(f => f.type === 'file').forEach(f => listCats.add(f.category));
    state.lists[listKey] = (data.lists?.[listKey] || []).map(row => {
      const out = {};
      for (const f of def.fields) {
        if (f.type === 'file') out[f.key] = (row[f.key] || []).map(ref).filter(Boolean);
        else if (row[f.key] !== null && row[f.key] !== undefined) out[f.key] = row[f.key];
      }
      return out;
    });
  }
  for (const f of (data.files || [])) {
    if (listCats.has(f.category)) continue;
    (state.files[f.category] ||= []).push({ id: f.id, name: f.name, size: f.size, type: f.type, url: f.url });
  }
  return state;
}

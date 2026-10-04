/* =========================================================
   Plyndi — Client Project API (Cloudflare Worker)
   ---------------------------------------------------------
   Runs on the route  plyndi.com/api/client/*  (and www.).
   Everything else on plyndi.com is untouched and keeps being
   served by the existing site exactly as before.

   Secrets (set with `wrangler secret put NAME`, never in code):
     SUPABASE_URL               https://<project-ref>.supabase.co
     SUPABASE_SERVICE_ROLE_KEY  service_role / secret key (server only!)
     RESEND_API_KEY             optional — owner email notifications
   Vars (wrangler.toml):
     SITE_ORIGINS, ACCESS_TEAM_DOMAIN, ACCESS_AUD, ADMIN_EMAILS,
     OWNER_EMAIL, NOTIFY_FROM, STORAGE_BUCKET
   ========================================================= */

import {
  FIELD_KEYS, ARRAY_FIELD_KEYS, LISTS, FILE_CATEGORIES, STEPS, UPLOAD_LIMITS, validateAll
} from './client-schema.js';

const API = '/api/client';
const MAX_JSON_BYTES = 1_000_000;
const MAX_TEXT = 20_000;
const MAX_LIST_ITEMS = 200;
const SIGNED_URL_TTL = 60 * 60;          // preview image links live 1 hour
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{32,128}$/;
const STATUSES = ['New', 'Reviewing', 'In Progress', 'Approved', 'Completed'];

/* Which categories are allowed for top-level uploads vs. inside list items */
const TOP_LEVEL_CATEGORIES = [...new Set(STEPS.flatMap(s => s.items.filter(i => i.files).map(i => i.files)))];
const LIST_FILE_FIELDS = Object.fromEntries(Object.entries(LISTS).map(([k, l]) => [k, l.fields.filter(f => f.type === 'file')]));
const LIST_FIELD_KEYS = Object.fromEntries(Object.entries(LISTS).map(([k, l]) => [k, l.fields.map(f => f.key)]));

class HttpError extends Error {
  constructor(status, message, extra) { super(message); this.status = status; this.extra = extra; }
}

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith(API + '/')) return fetch(request); // not ours — pass through

    try {
      await rateLimit(request, env, url);
      if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(request.method)) checkOrigin(request, env);
      const res = await route(request, env, ctx, url);
      return withSecurityHeaders(res);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error('Unhandled error', err && err.stack || err);
      return withSecurityHeaders(json({
        error: status === 500 ? 'Something went wrong on our side. Please try again in a moment.' : err.message,
        ...(err.extra || {})
      }, status));
    }
  }
};

/* ---------------- Routing ---------------- */
async function route(request, env, ctx, url) {
  const path = url.pathname.slice(API.length);   // e.g. /invite
  const m = request.method;
  let p;

  // ----- Client (invite-gated) -----
  if (m === 'GET' && path === '/invite') return getInvite(env, url.searchParams.get('token'));
  if (m === 'POST' && path === '/uploads') return createUpload(request, env);
  if ((p = path.match(/^\/uploads\/([0-9a-f-]{36})\/complete$/)) && m === 'POST') return completeUpload(request, env, p[1]);
  if ((p = path.match(/^\/uploads\/([0-9a-f-]{36})$/)) && m === 'DELETE') return deleteUpload(request, env, p[1]);
  if (m === 'POST' && path === '/submit') return submit(request, env, ctx);
  if (m === 'GET' && path === '/preview') return preview(env, url.searchParams.get('id'));
  if (m === 'POST' && path === '/inquiry') return createInquiry(request, env, ctx);

  // ----- Owner / admin (Cloudflare Access) -----
  if (path.startsWith('/admin/')) {
    const admin = await requireAdmin(request, env, url);
    const ap = path.slice('/admin'.length);
    if (m === 'GET' && ap === '/me') return json({ email: admin.email });
    if (m === 'GET' && ap === '/submissions') return json({ submissions: await rpc(env, 'cp_list_projects', {}) });
    if ((p = ap.match(/^\/submissions\/([A-Za-z0-9_-]{32,128})$/))) {
      if (m === 'GET') return adminGetSubmission(env, p[1]);
      if (m === 'PATCH') return adminUpdateSubmission(request, env, p[1]);
    }
    if (ap === '/inquiries' && m === 'GET') return json({ inquiries: await rpc(env, 'cp_list_inquiries', {}) });
    if ((p = ap.match(/^\/inquiries\/([0-9a-f-]{36})$/)) && m === 'PATCH') return adminUpdateInquiry(request, env, p[1]);
    if ((p = ap.match(/^\/inquiries\/([0-9a-f-]{36})\/invite$/)) && m === 'POST') return adminInviteFromInquiry(request, env, url, p[1]);
    if (ap === '/invites' && m === 'GET') return json({ invites: await rpc(env, 'cp_list_invites', {}) });
    if (ap === '/invites' && m === 'POST') return adminCreateInvite(request, env);
    if ((p = ap.match(/^\/invites\/([0-9a-f-]{36})$/)) && m === 'PATCH') {
      const body = await readJson(request);
      const row = await rpc(env, 'cp_set_invite_active', { p_id: p[1], p_active: !!body.active });
      if (!row) throw new HttpError(404, 'Invite not found.');
      return json(row);
    }
  }
  throw new HttpError(404, 'Not found.');
}

/* ---------------- Client endpoints ---------------- */
async function getInvite(env, token) {
  const invite = await loadInvite(env, token);
  return json({ client_name: invite.client_name, upload_limits: UPLOAD_LIMITS });
}

async function createUpload(request, env) {
  const b = await readJson(request);
  const invite = await loadInvite(env, b.invite);
  const cat = FILE_CATEGORIES[b.category];
  if (!cat) throw new HttpError(400, 'Unknown upload category.');
  const name = String(b.name || '').slice(0, 200);
  const size = Number(b.size);
  const type = String(b.type || '').slice(0, 120);
  if (!name) throw new HttpError(400, 'File name missing.');
  if (!Number.isFinite(size) || size <= 0) throw new HttpError(400, 'This file looks empty.');
  if (size > UPLOAD_LIMITS.maxFileBytes) throw new HttpError(413, `“${name}” is larger than ${UPLOAD_LIMITS.maxFileBytes / 1048576} MB. Please compress it or share a link instead.`);
  if (!acceptsFile(cat.accept, name, type)) throw new HttpError(415, `“${name}” is not an accepted file type for ${cat.label}.`);
  const draft = /^[A-Za-z0-9_-]{8,64}$/.test(b.draft_id || '') ? b.draft_id : 'draft';

  const path = `${invite.id}/${draft}/${randomHex(8)}-${safeFileName(name)}`;
  let row;
  try {
    row = await rpc(env, 'cp_register_upload', {
      p_invite_token: b.invite, p_draft_id: draft, p_category: b.category, p_name: name, p_size: size,
      p_mime: type || null, p_path: path,
      p_max_files: UPLOAD_LIMITS.maxFilesPerInvite, p_max_bytes: UPLOAD_LIMITS.maxBytesPerInvite
    });
  } catch (e) {
    if (/quota_files/.test(e.message)) throw new HttpError(429, 'You have reached the maximum number of uploads for this project. Please contact us to raise it.');
    if (/quota_bytes/.test(e.message)) throw new HttpError(429, 'You have reached the total upload size for this project. Please share large files as links instead.');
    throw e;
  }
  const signed = await storage(env, 'POST', `/object/upload/sign/${bucket(env)}/${encodePath(path)}`, {});
  if (!signed || !signed.url) throw new Error('Signed upload URL missing');
  return json({ id: row.id, upload_url: `${env.SUPABASE_URL}/storage/v1${signed.url}` }, 201);
}

async function completeUpload(request, env, id) {
  const b = await readJson(request);
  if (!TOKEN_RE.test(b.invite || '')) throw new HttpError(403, 'This form link is not valid.');
  const row = await rpc(env, 'cp_mark_uploaded', { p_invite_token: b.invite, p_file_id: id });
  if (!row) throw new HttpError(404, 'Upload not found.');
  // Confirm the object really exists in storage
  const head = await fetch(`${env.SUPABASE_URL}/storage/v1/object/${bucket(env)}/${encodePath(row.path)}`,
    { method: 'HEAD', headers: sbHeaders(env) });
  if (head.status === 404 || head.status === 400) {
    await rpc(env, 'cp_delete_pending_upload', { p_invite_token: b.invite, p_file_id: id });
    throw new HttpError(409, 'The upload did not finish. Please try that file again.');
  }
  return json({ id, status: 'uploaded' });
}

async function deleteUpload(request, env, id) {
  const b = await readJson(request);
  if (!TOKEN_RE.test(b.invite || '')) throw new HttpError(403, 'This form link is not valid.');
  const row = await rpc(env, 'cp_delete_pending_upload', { p_invite_token: b.invite, p_file_id: id });
  // null = already part of a submitted revision: keep it (that revision still uses it); just detach in the form.
  if (row && row.path) {
    await storage(env, 'DELETE', `/object/${bucket(env)}`, { prefixes: [row.path] }).catch(e => console.warn('storage delete', e.message));
  }
  return json({ id, deleted: !!row });
}

async function submit(request, env, ctx) {
  const b = await readJson(request);
  const invite = await loadInvite(env, b.invite);
  const state = b.state;
  if (!state || typeof state !== 'object') throw new HttpError(400, 'Form data missing.');

  const clean = sanitizeState(state);
  const errors = validateAll(clean.forValidation);
  if (errors.length) throw new HttpError(422, 'Some required information is missing or invalid.', { errors });

  const publicToken = randomToken(32);
  const revisionOf = TOKEN_RE.test(b.revision_of || '') ? b.revision_of : null;
  let result;
  try {
    result = await rpc(env, 'cp_submit_project', {
      p_invite_token: b.invite, p_public_token: publicToken, p_revision_of: revisionOf,
      p_payload: clean.payload
    });
  } catch (e) {
    if (/invalid_invite/.test(e.message)) throw new HttpError(403, 'This form link is no longer active.');
    if (/missing_company_name/.test(e.message)) throw new HttpError(422, 'Company name is required.');
    throw e;
  }

  ctx.waitUntil(notifyOwner(env, request, result, invite).catch(e => console.error('notify failed', e.message)));

  return json({
    ref: result.ref,
    id: result.public_token,
    submitted_at: result.submitted_at,
    revision_number: result.revision_number,
    preview_url: `/client-preview?id=${encodeURIComponent(result.public_token)}`
  }, 201);
}

async function preview(env, id) {
  if (!TOKEN_RE.test(id || '')) throw new HttpError(404, 'Preview not found.');
  const data = await rpc(env, 'cp_get_project', { p_public_token: id });
  if (!data) throw new HttpError(404, 'Preview not found.');
  const files = await signFiles(env, data.files, false);
  const project = { ...data.project };
  delete project.id; delete project.owner_notes; delete project.revision_of;
  return json({
    project, lists: data.lists, files,
    invite: data.invite.active ? data.invite.token : null,   // lets the client open "Edit information"
    revisions: data.revisions
  });
}

/* ---------------- Admin endpoints ---------------- */
async function adminGetSubmission(env, token) {
  const data = await rpc(env, 'cp_get_project', { p_public_token: token });
  if (!data) throw new HttpError(404, 'Submission not found.');
  data.files = await signFiles(env, data.files, true);
  return json(data);
}

async function adminUpdateSubmission(request, env, token) {
  const b = await readJson(request);
  if (b.status && !STATUSES.includes(b.status)) throw new HttpError(400, 'Unknown status.');
  const row = await rpc(env, 'cp_set_status', {
    p_public_token: token, p_status: b.status,
    p_notes: typeof b.owner_notes === 'string' ? b.owner_notes.slice(0, MAX_TEXT) : null
  });
  if (!row) throw new HttpError(404, 'Submission not found.');
  return json(row);
}

async function adminCreateInvite(request, env) {
  const b = await readJson(request);
  const name = String(b.client_name || '').trim().slice(0, 200);
  if (!name) throw new HttpError(400, 'Client name is required.');
  const row = await rpc(env, 'cp_create_invite', {
    p_token: randomToken(24), p_client_name: name, p_notes: String(b.notes || '').slice(0, 2000)
  });
  return json(row, 201);
}

/* ---------------- Sanitising the submitted form ---------------- */
function cleanText(v) {
  if (v === undefined || v === null) return null;
  const s = String(v).replace(/\u0000/g, '').trim();
  return s ? s.slice(0, MAX_TEXT) : null;
}
function fileIds(refs) {
  if (!Array.isArray(refs)) return [];
  return [...new Set(refs.map(r => (r && typeof r === 'object') ? r.id : r).filter(id => UUID_RE.test(String(id || ''))))].slice(0, 100);
}

function sanitizeState(state) {
  const inFields = (state.fields && typeof state.fields === 'object') ? state.fields : {};
  const fields = {};
  for (const key of FIELD_KEYS) {
    if (!(key in inFields)) continue;
    if (ARRAY_FIELD_KEYS.includes(key)) {
      const arr = Array.isArray(inFields[key]) ? inFields[key] : [];
      fields[key] = [...new Set(arr.map(cleanText).filter(Boolean))].slice(0, 50);
    } else {
      const v = cleanText(inFields[key]);
      if (v !== null) fields[key] = v;
    }
  }
  if (fields.primary_color && !/^#[0-9a-f]{6}$/i.test(fields.primary_color)) delete fields.primary_color;
  if (fields.secondary_color && !/^#[0-9a-f]{6}$/i.test(fields.secondary_color)) delete fields.secondary_color;

  const files = [];
  const pushFiles = (category, ids) => ids.forEach((file_id, position) => files.push({ file_id, category, position }));

  const inFiles = (state.files && typeof state.files === 'object') ? state.files : {};
  const topFiles = {};
  for (const cat of TOP_LEVEL_CATEGORIES) { topFiles[cat] = fileIds(inFiles[cat]); pushFiles(cat, topFiles[cat]); }

  const lists = {};
  const inLists = (state.lists && typeof state.lists === 'object') ? state.lists : {};
  for (const [listKey, def] of Object.entries(LISTS)) {
    const rows = Array.isArray(inLists[listKey]) ? inLists[listKey].slice(0, MAX_LIST_ITEMS) : [];
    lists[listKey] = rows
      .filter(r => r && typeof r === 'object')
      .map(r => {
        const out = {};
        for (const k of LIST_FIELD_KEYS[listKey]) {
          const f = def.fields.find(x => x.key === k);
          if (f.type === 'file') {
            const ids = fileIds(r[k]);
            out[k] = ids;
            pushFiles(f.category, ids);
          } else {
            const v = cleanText(r[k]);
            if (v !== null) out[k] = v;
          }
        }
        return out;
      })
      // drop completely empty rows (e.g. an "Add service" click with nothing typed)
      .filter(out => Object.entries(out).some(([, v]) => Array.isArray(v) ? v.length : v));
  }

  // Validation runs on the same shape the browser validated
  const forValidation = { fields, lists, files: topFiles };
  return { payload: { fields, lists, files: dedupeFiles(files) }, forValidation };
}
function dedupeFiles(files) {
  const seen = new Set();
  return files.filter(f => { const k = f.file_id + '|' + f.category; if (seen.has(k)) return false; seen.add(k); return true; });
}

/* ---------------- Supabase helpers ---------------- */
function bucket(env) { return env.STORAGE_BUCKET || 'client-uploads'; }
function sbHeaders(env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) throw new HttpError(503, 'The project form is not configured yet. Please contact Plyndi.');
  return { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` };
}

async function rpc(env, fn, args) {
  const res = await fetch(`${env.SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { ...sbHeaders(env), 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify(args)
  });
  const text = await res.text();
  if (!res.ok) {
    let msg = text;
    try { msg = JSON.parse(text).message || text; } catch (_) {}
    throw new Error(`rpc ${fn} failed (${res.status}): ${msg}`);
  }
  return text ? JSON.parse(text) : null;
}

async function storage(env, method, path, body) {
  const res = await fetch(`${env.SUPABASE_URL}/storage/v1${path}`, {
    method,
    headers: { ...sbHeaders(env), 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`storage ${method} ${path} failed (${res.status}): ${text}`);
  return text ? JSON.parse(text) : null;
}

async function signFiles(env, files, forAdmin) {
  if (!files || !files.length) return [];
  const paths = [...new Set(files.map(f => f.path))];
  const signed = await storage(env, 'POST', `/object/sign/${bucket(env)}`, { expiresIn: SIGNED_URL_TTL, paths });
  const byPath = new Map((signed || []).map(s => [s.path, s.signedURL ? `${env.SUPABASE_URL}/storage/v1${s.signedURL}` : null]));
  return files.map(f => {
    const url = byPath.get(f.path) || null;
    const out = { id: f.id, category: f.category, position: f.position, name: f.name, type: f.type, size: f.size, url };
    if (forAdmin && url) out.download_url = url + (url.includes('?') ? '&' : '?') + 'download=' + encodeURIComponent(f.name);
    return out;
  });
}

async function loadInvite(env, token) {
  if (!TOKEN_RE.test(token || '')) throw new HttpError(403, 'This form link is not valid. Please use the private link Plyndi sent you.');
  const invite = await rpc(env, 'cp_get_invite', { p_token: token });
  if (!invite) throw new HttpError(403, 'This form link is not valid or has been closed. Please contact Plyndi for a new link.');
  return invite;
}

/* ---------------- Owner notification (Resend) ---------------- */
async function notifyOwner(env, request, result, invite) {
  if (!env.RESEND_API_KEY || !env.OWNER_EMAIL) { console.log('Notification skipped: RESEND_API_KEY / OWNER_EMAIL not set'); return; }
  const origin = new URL(request.url).origin;
  const adminUrl = `${origin}/admin/client-submissions?id=${encodeURIComponent(result.public_token)}`;
  const previewUrl = `${origin}/client-preview?id=${encodeURIComponent(result.public_token)}`;
  const e = escapeHtml;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#14211F;max-width:560px">
      <h2 style="color:#0E3B3D;margin:0 0 12px">New client project submission</h2>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:4px 12px 4px 0;color:#3B4B48">Reference</td><td><strong>${e(result.ref)}</strong> (revision ${e(result.revision_number)})</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#3B4B48">Company</td><td>${e(result.company_name)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#3B4B48">Client link</td><td>${e(invite.client_name)}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#3B4B48">Email</td><td>${e(result.email || '—')}</td></tr>
        <tr><td style="padding:4px 12px 4px 0;color:#3B4B48">Submitted</td><td>${e(new Date(result.submitted_at).toUTCString())}</td></tr>
      </table>
      <p style="margin:20px 0">
        <a href="${e(adminUrl)}" style="background:#0E3B3D;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Review submission</a>
        &nbsp; <a href="${e(previewUrl)}" style="color:#0E3B3D">Open preview</a>
      </p>
      <p style="font-size:12px;color:#3B4B48">Client details are only visible in your admin dashboard (protected by Cloudflare Access).</p>
    </div>`;
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.NOTIFY_FROM || 'Plyndi Client Forms <forms@plyndi.com>',
      to: env.OWNER_EMAIL.split(',').map(s => s.trim()).filter(Boolean),
      subject: `New project info: ${result.company_name} (${result.ref})`,
      html
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
}

/* ---------------- Admin auth: Cloudflare Access JWT ---------------- */
let jwksCache = { at: 0, keys: null, domain: null };

async function requireAdmin(request, env, url) {
  // Local development only (never true in production: the var is unset and the host is not localhost)
  if (env.DEV_INSECURE_ADMIN === 'true' && ['localhost', '127.0.0.1'].includes(url.hostname)) return { email: 'dev@localhost' };

  if (!env.ACCESS_TEAM_DOMAIN || !env.ACCESS_AUD) throw new HttpError(503, 'Admin access is not configured (Cloudflare Access).');
  const jwt = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!jwt) throw new HttpError(401, 'Please sign in through Cloudflare Access.');
  const claims = await verifyAccessJwt(jwt, env);
  if (!claims) throw new HttpError(403, 'Your session is not valid. Please sign in again.');
  const allow = (env.ADMIN_EMAILS || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (allow.length && !allow.includes(String(claims.email || '').toLowerCase())) throw new HttpError(403, 'This account is not allowed.');
  return { email: claims.email };
}

export async function verifyAccessJwt(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  let header, payload;
  try { header = JSON.parse(b64urlDecodeText(parts[0])); payload = JSON.parse(b64urlDecodeText(parts[1])); } catch (_) { return null; }
  if (header.alg !== 'RS256') return null;
  const domain = env.ACCESS_TEAM_DOMAIN.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const now = Math.floor(Date.now() / 1000);
  if (payload.iss !== `https://${domain}`) return null;
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (!payload.exp || payload.exp < now) return null;
  if (payload.nbf && payload.nbf > now + 60) return null;

  if (!jwksCache.keys || jwksCache.domain !== domain || Date.now() - jwksCache.at > 3600_000) {
    const r = await fetch(`https://${domain}/cdn-cgi/access/certs`);
    if (!r.ok) return null;
    jwksCache = { at: Date.now(), keys: (await r.json()).keys || [], domain };
  }
  const jwk = jwksCache.keys.find(k => k.kid === header.kid);
  if (!jwk) return null;
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64urlDecode(parts[2]),
    new TextEncoder().encode(parts[0] + '.' + parts[1]));
  return ok ? payload : null;
}

/* ---------------- Request hygiene ---------------- */
function checkOrigin(request, env) {
  const origin = request.headers.get('Origin');
  const allowed = (env.SITE_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean);
  const self = new URL(request.url).origin;
  if (!origin || (origin !== self && !allowed.includes(origin))) throw new HttpError(403, 'Request blocked (origin).');
  const ct = request.headers.get('Content-Type') || '';
  if (!ct.includes('application/json')) throw new HttpError(415, 'Expected JSON.');
}

async function rateLimit(request, env, url) {
  const ip = request.headers.get('CF-Connecting-IP') || 'unknown';
  // Stricter limit for the public inquiry form (it can trigger emails)
  if (url.pathname === API + '/inquiry' && env.INQUIRY_LIMITER) {
    const { success } = await env.INQUIRY_LIMITER.limit({ key: `${ip}:inquiry` });
    if (!success) throw new HttpError(429, 'Too many requests — please wait a minute and try again.');
  }
  if (!env.RATE_LIMITER) return;
  const bucketKey = url.pathname.startsWith(API + '/admin') ? 'admin' : (url.pathname.includes('/uploads') ? 'upload' : 'form');
  const { success } = await env.RATE_LIMITER.limit({ key: `${ip}:${bucketKey}` });
  if (!success) throw new HttpError(429, 'Too many requests — please wait a minute and try again.');
}

async function readJson(request) {
  const len = Number(request.headers.get('Content-Length') || 0);
  if (len > MAX_JSON_BYTES) throw new HttpError(413, 'Form data is too large.');
  const text = await request.text();
  if (text.length > MAX_JSON_BYTES) throw new HttpError(413, 'Form data is too large.');
  try { return text ? JSON.parse(text) : {}; } catch (_) { throw new HttpError(400, 'Invalid JSON.'); }
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json; charset=utf-8' } });
}
function withSecurityHeaders(res) {
  const h = new Headers(res.headers);
  h.set('Cache-Control', 'no-store');
  h.set('X-Robots-Tag', 'noindex, nofollow');
  h.set('X-Content-Type-Options', 'nosniff');
  h.set('Referrer-Policy', 'no-referrer');
  return new Response(res.body, { status: res.status, headers: h });
}

/* ---------------- Small utilities ---------------- */
function acceptsFile(accept, name, type) {
  const tokens = accept.split(',').map(s => s.trim().toLowerCase());
  const lower = name.toLowerCase();
  const t = (type || '').toLowerCase();
  return tokens.some(tok => tok.startsWith('.') ? lower.endsWith(tok) : (t && (tok === t || (tok.endsWith('/*') && t.startsWith(tok.slice(0, -1))))))
    || (!t && tokens.some(tok => tok.includes('/') && extOf(lower) && tok.endsWith('/' + extOf(lower).replace('jpg', 'jpeg'))));
}
function extOf(n) { const i = n.lastIndexOf('.'); return i > 0 ? n.slice(i + 1) : ''; }
function safeFileName(name) {
  const ext = extOf(name).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 10);
  const base = name.replace(/\.[^.]*$/, '').normalize('NFKD').replace(/[^A-Za-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'file';
  return ext ? `${base}.${ext}` : base;
}
function encodePath(p) { return p.split('/').map(encodeURIComponent).join('/'); }
function randomHex(bytes) { return [...crypto.getRandomValues(new Uint8Array(bytes))].map(b => b.toString(16).padStart(2, '0')).join(''); }
function randomToken(bytes) {
  const b = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function b64urlDecode(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), c => c.charCodeAt(0));
}
function b64urlDecodeText(s) { return new TextDecoder().decode(b64urlDecode(s)); }
function escapeHtml(v) {
  return String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/* ---------------- Public project inquiries (Services pages) ---------------- */
const INQUIRY_SERVICES = { website: 'Website Development' };
const INQUIRY_STATUSES = ['New', 'Invited', 'Declined'];
const INQUIRY_EMAIL_RE = /^[^\s@<>()[\]\\,;:"]+@[^\s@<>()[\]\\,;:"]+\.[a-z]{2,}$/i;

async function createInquiry(request, env, ctx) {
  const b = await readJson(request);
  if (b.company_website) return json({ ok: true }, 201);           // honeypot filled → bot; pretend success
  const email = String(b.email || '').trim().toLowerCase();
  if (email.length > 254 || !INQUIRY_EMAIL_RE.test(email)) throw new HttpError(422, 'Please enter a valid email address, e.g. name@company.com.');
  const service = Object.prototype.hasOwnProperty.call(INQUIRY_SERVICES, b.service) ? b.service : null;
  if (!service) throw new HttpError(400, 'Unknown service.');
  const result = await rpc(env, 'cp_create_inquiry', {
    p_email: email, p_service: service, p_source_page: String(b.source_page || '').slice(0, 300)
  });
  if (!result.duplicate) {
    ctx.waitUntil(Promise.allSettled([
      sendEmail(env, {
        to: [email],
        subject: 'We’ve received your request — Plyndi',
        html: inquiryConfirmationHtml(INQUIRY_SERVICES[service])
      }),
      env.OWNER_EMAIL ? sendEmail(env, {
        to: env.OWNER_EMAIL.split(',').map(s => s.trim()).filter(Boolean),
        subject: `New ${INQUIRY_SERVICES[service]} inquiry: ${email}`,
        html: inquiryOwnerHtml(email, INQUIRY_SERVICES[service], new URL(request.url).origin),
        reply_to: email
      }) : null
    ]).then(r => r.forEach(x => x.status === 'rejected' && console.error('inquiry email failed', x.reason && x.reason.message))));
  }
  return json({ ok: true, confirmation_email: !result.duplicate && !!env.RESEND_API_KEY }, 201);
}

async function adminUpdateInquiry(request, env, id) {
  const b = await readJson(request);
  if (b.status && !INQUIRY_STATUSES.includes(b.status)) throw new HttpError(400, 'Unknown status.');
  const row = await rpc(env, 'cp_update_inquiry', {
    p_id: id, p_status: b.status || null, p_invite_id: null,
    p_notes: typeof b.owner_notes === 'string' ? b.owner_notes.slice(0, MAX_TEXT) : null
  });
  if (!row) throw new HttpError(404, 'Inquiry not found.');
  return json(row);
}

// Turn a reviewed inquiry into a private client-form link (the existing invite system).
async function adminInviteFromInquiry(request, env, url, id) {
  const b = await readJson(request);
  const inq = await rpc(env, 'cp_get_inquiry', { p_id: id });
  if (!inq) throw new HttpError(404, 'Inquiry not found.');
  const name = String(b.client_name || '').trim().slice(0, 200) || inq.email;
  const invite = await rpc(env, 'cp_create_invite', {
    p_token: randomToken(24), p_client_name: name, p_notes: `From website inquiry (${inq.email})`
  });
  await rpc(env, 'cp_update_inquiry', { p_id: id, p_status: 'Invited', p_invite_id: invite.id, p_notes: null });
  const siteOrigin = (env.SITE_ORIGINS || '').split(',')[0].trim() || url.origin;   // public site, e.g. https://plyndi.com
  const link = `${siteOrigin}/client-form?invite=${encodeURIComponent(invite.token)}`;
  let emailed = false;
  if (b.send_email) {
    emailed = await sendEmail(env, { to: [inq.email], subject: 'Your Plyndi project form', html: inviteEmailHtml(name, link) })
      .catch(e => { console.error('invite email failed', e.message); return false; });
  }
  return json({ invite, link, emailed, email_configured: !!env.RESEND_API_KEY }, 201);
}

/* ---------------- Email (Resend) ---------------- */
async function sendEmail(env, { to, subject, html, reply_to }) {
  if (!env.RESEND_API_KEY) { console.log('Email skipped (RESEND_API_KEY not set):', subject); return false; }
  const res = await fetch(env.RESEND_API_URL || 'https://api.resend.com/emails', {   // RESEND_API_URL: local testing only
    method: 'POST',
    headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: env.NOTIFY_FROM || 'Plyndi <forms@plyndi.com>',
      to, subject, html,
      reply_to: reply_to || (env.OWNER_EMAIL ? env.OWNER_EMAIL.split(',')[0].trim() : undefined)
    })
  });
  if (!res.ok) throw new Error(`Resend ${res.status}: ${await res.text()}`);
  return true;
}

function emailShell(inner) {
  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#14211F;max-width:560px;margin:0 auto;padding:8px 4px;line-height:1.55">
    <p style="font-size:20px;font-weight:bold;color:#0E3B3D;margin:0 0 18px">Plyndi</p>${inner}
    <p style="font-size:12px;color:#3B4B48;margin-top:28px;border-top:1px solid #e5e1d6;padding-top:12px">Plyndi · Taipei · <a href="https://plyndi.com" style="color:#0E3B3D">plyndi.com</a></p></div>`;
}
function inquiryConfirmationHtml(serviceLabel) {
  const e = escapeHtml;
  return emailShell(`
    <h1 style="font-size:20px;color:#0E3B3D;margin:0 0 12px">Thank you — we’ve received your request.</h1>
    <p>Thanks for your interest in Plyndi ${e(serviceLabel)}. We’ll review your request and send you a personalized project form within 24 hours.</p>
    <p>The project form lets you share your business details, design preferences and the features you need. We’ll use it to understand your project and prepare a proposal.</p>
    <p>Have something to add in the meantime? Just reply to this email.</p>
    <p style="font-size:12px;color:#3B4B48">You’re receiving this because this email address was entered on plyndi.com. If that wasn’t you, you can ignore this message.</p>`);
}
function inquiryOwnerHtml(email, serviceLabel, origin) {
  const e = escapeHtml;
  return emailShell(`
    <h1 style="font-size:18px;color:#0E3B3D;margin:0 0 12px">New ${e(serviceLabel)} inquiry</h1>
    <p><strong>${e(email)}</strong> asked for a project form.</p>
    <p><a href="${e(origin)}/admin/client-submissions#inquiries" style="background:#0E3B3D;color:#fff;padding:10px 18px;border-radius:6px;text-decoration:none;font-weight:bold">Review in admin</a></p>`);
}
function inviteEmailHtml(name, link) {
  const e = escapeHtml;
  return emailShell(`
    <h1 style="font-size:20px;color:#0E3B3D;margin:0 0 12px">Your project form is ready</h1>
    <p>Hi ${e(name)},</p>
    <p>Thanks for your patience. Here is your personal Plyndi project form. It takes about 20–40 minutes, saves automatically on your device, and you can upload your logo, photos and documents as you go.</p>
    <p style="margin:22px 0"><a href="${e(link)}" style="background:#0E3B3D;color:#fff;padding:12px 22px;border-radius:6px;text-decoration:none;font-weight:bold">Open my project form</a></p>
    <p style="font-size:13px;color:#3B4B48">This link is private to your project — please don’t share it publicly. When you submit, you’ll immediately see a first preview of your website.</p>`);
}

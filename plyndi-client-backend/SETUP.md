# Plyndi Client Project System — Setup Guide

A private, multi-step project information form for your web-design clients, a live
website preview generated from their answers, and an owner dashboard — added to
plyndi.com **without changing any existing page**.

```
Client opens private link ─► /client-form?invite=…      (static page on your site)
           uploads files ─► signed URL ─► Supabase Storage (private bucket)
                  submit ─► /api/client/submit           (new Cloudflare Worker)
                                 └► Supabase Postgres (structured tables) + email to you
       preview ─► /client-preview?id=<random 256-bit id>
           you ─► /admin/client-submissions             (behind Cloudflare Access login)
```

No API keys, passwords or client data are ever in HTML/CSS/JS. The browser only talks
to `/api/client/*`; the Worker holds the database key as an encrypted secret.

---

## 1. What's in this folder

| Path (in your plyndi-website folder) | What it is | Notes |
|---|---|---|
| `client-form.html` | Multi-step client form | Website root (next to `index.html`) |
| `client-preview.html` | Generated website preview | Website root |
| `admin/client-submissions.html` | Owner dashboard | `admin/` folder in website root |
| `assets/client-system/client-schema.js` | All form steps/fields (edit questions here) | `assets/client-system/` |
| `assets/client-system/client-form.js` | Form logic: steps, validation, autosave, uploads, submit | `assets/client-system/` |
| `assets/client-system/client-preview.js` | Travel-agency template filled with client data | `assets/client-system/` |
| `assets/client-system/admin.js` | Dashboard logic: list, details, status, export, client links | `assets/client-system/` |
| `assets/client-system/client-api.js` | Shared fetch/upload/DOM helpers | `assets/client-system/` |
| `assets/client-system/client-system.css` | Form + admin styles (uses your `style.css` variables) | `assets/client-system/` |
| `assets/client-system/client-preview.css` | Preview template styles | `assets/client-system/` |
| `plyndi-client-backend/supabase/schema.sql` | Database tables, security, storage bucket | Run once in Supabase |
| `plyndi-client-backend/worker/` | The API Worker (`src/index.js`, `wrangler.toml`) | Deploy with Wrangler — **not** part of the website files |

**Existing files changed: none.** Everything is new. The new pages reuse your `/style.css`,
`/assets/logo.png` and favicons, so the form and dashboard match the Plyndi look.

## 2. Site files — already in place

The site files are already in your `plyndi-website` folder root (`client-form.html`,
`client-preview.html`, `admin/`, `assets/client-system/`). Deploy the site the same way you
always do. Cloudflare serves `client-form.html` at `/client-form` automatically.

> This backend folder (`plyndi-client-backend/`) is listed in `.assetsignore`, so `wrangler deploy`
> of the site skips it. If you upload the site by dragging the folder into the Cloudflare
> dashboard instead, leave `plyndi-client-backend/` out of the upload (it contains no secrets,
> but it doesn't belong on the public site).

## 3. Supabase (database + file storage) — free plan is fine

1. Create a project at <https://supabase.com> (region: *Northeast Asia (Tokyo)* or *Southeast Asia (Singapore)*).
2. **SQL Editor → New query →** paste all of `plyndi-client-backend/supabase/schema.sql` **→ Run**.
   It creates the tables (`client_invites`, `client_projects`, `services`, `tour_examples`,
   `destinations`, `team_members`, `reviews`, `faqs`, `uploaded_files`, `submission_files`),
   turns on Row Level Security with no public access, and creates the private
   `client-uploads` bucket (50 MB per file).
3. **Project Settings → API Keys**: copy the **Project URL** and the **service_role / secret** key.
   This key bypasses all security — it only ever goes into the Worker secret below.

> Free Supabase projects pause after about a week with no activity. Open the dashboard
> occasionally, or upgrade, while you are collecting client forms.

## 4. Deploy the API Worker

```bash
cd plyndi-client-backend/worker
npm install
npx wrangler login                     # same Cloudflare account that owns plyndi.com
npx wrangler secret put SUPABASE_URL               # paste https://xxxx.supabase.co
npx wrangler secret put SUPABASE_SERVICE_ROLE_KEY  # paste the service_role / secret key
npx wrangler deploy
```

The Worker is attached only to `plyndi.com/api/client/*` and `www.plyndi.com/api/client/*`
(see `routes` in `wrangler.toml`). Every other URL keeps going to your existing site.

## 5. Protect the admin area with Cloudflare Access (free up to 50 users)

1. Cloudflare dashboard → **Zero Trust** (pick the free plan if asked).
2. **Access → Applications → Add an application → Self-hosted**.
   - Name: `Plyndi Admin`
   - Add these four public hostnames/paths:
     `plyndi.com` path `admin`, `www.plyndi.com` path `admin`,
     `plyndi.com` path `api/client/admin`, `www.plyndi.com` path `api/client/admin`
   - Policy: **Allow** → Include → **Emails** → your email address.
   - Login method: **One-time PIN** (emails you a code) is simplest.
3. Open the application → **Overview** → copy the **Application Audience (AUD) Tag**.
4. **Settings → Custom Pages** (or Team) → copy your **team domain**, e.g. `plyndi.cloudflareaccess.com`.
5. In `plyndi-client-backend/worker/wrangler.toml` set:
   ```toml
   ACCESS_TEAM_DOMAIN = "plyndi.cloudflareaccess.com"
   ACCESS_AUD = "<the AUD tag>"
   ADMIN_EMAILS = "you@example.com"     # optional second lock
   ```
   then run `npx wrangler deploy` again.

The Worker verifies the signed Access token on every admin request (signature, audience,
issuer, expiry). If Access is not configured, the admin API refuses everything.

## 6. Email notifications (optional, recommended) — Resend

1. Sign up at <https://resend.com> → **Domains → Add** `plyndi.com` → add the DNS records it
   shows in Cloudflare DNS → wait for “Verified”.
2. **API Keys → Create** → then `npx wrangler secret put RESEND_API_KEY`.
3. `OWNER_EMAIL` (who gets notified) and `NOTIFY_FROM` are in `wrangler.toml`. Redeploy.

Without a key, submissions still save; only the email is skipped. The email contains the
company name, reference and links — the full details stay behind your admin login.

## 7. Use it

1. Go to `https://plyndi.com/admin/client-submissions` → sign in → **Client links** →
   enter e.g. `WanderAsia` → **Create link** → copy and send it to the client.
2. The client fills in the form (answers autosave in their browser), uploads files, reviews,
   and submits. They land on `/client-preview?id=…` immediately.
3. You get an email; the dashboard shows the submission with status **New**. Open it to see
   everything, change status (New → Reviewing → In Progress → Approved → Completed), add
   private notes, open the preview, download files, and **Export JSON / CSV**.
4. Closing a link (Client links → **Close link**) stops further submissions and uploads.

## 8. Configuration reference

| Name | Type | Where | Required |
|---|---|---|---|
| `SUPABASE_URL` | secret | `wrangler secret put` | yes |
| `SUPABASE_SERVICE_ROLE_KEY` | secret | `wrangler secret put` | yes |
| `RESEND_API_KEY` | secret | `wrangler secret put` | for email |
| `ACCESS_TEAM_DOMAIN`, `ACCESS_AUD` | var | `wrangler.toml` | for admin |
| `ADMIN_EMAILS` | var | `wrangler.toml` | optional |
| `OWNER_EMAIL`, `NOTIFY_FROM` | var | `wrangler.toml` | for email |
| `SITE_ORIGINS` | var | `wrangler.toml` | yes (already set) |
| `STORAGE_BUCKET` | var | `wrangler.toml` | yes (already set) |
| `RATE_LIMITER` | binding | `wrangler.toml` | yes (already set, 60 req/min per IP) |

## 9. Changing the questions

Edit `assets/client-system/client-schema.js` (labels, options, required fields, steps),
then run `npm run sync-schema` in `plyndi-client-backend/worker` and redeploy the Worker, so the server
accepts the same fields. A brand-new single field also needs a matching column in
`client_projects` (`alter table public.client_projects add column my_field text;`).

## 10. Security summary

- Database and bucket are private (RLS on, no policies, functions executable only by `service_role`).
- Form access requires a random 24-byte invite token; preview links use a random 32-byte id.
- Uploads: type and size checked server-side, per-link quotas (400 files / 3 GB), short-lived signed URLs.
- Server-side validation and field whitelisting; clients cannot set status, ids or tokens.
- Same-origin check on every write (CSRF), per-IP rate limiting, `no-store` + `noindex` headers,
  all pages `noindex` + `no-referrer`.
- All client text is rendered with `textContent`; links are restricted to `http(s)`; CSV export
  guards against spreadsheet formula injection.
- Suggested: mention client project data in `privacy.html` (what you collect and why).

## 11. Local testing (optional)

`plyndi-client-backend/worker/.dev.vars.example` → copy to `.dev.vars`, fill in a **test** Supabase project,
then `npx wrangler dev --local-upstream localhost:8787`. `DEV_INSECURE_ADMIN=true` skips Access
**only** on localhost and only in `.dev.vars` (never deployed).

## 12. Services pages + "Start Your Project" inquiries (added 5 Oct 2026)

Public flow: `/services` → `/services/websites` → **Start Your Project** → visitor leaves an email →
saved as an *inquiry* (table `project_inquiries`) → confirmation email to the visitor + notification to
`OWNER_EMAIL` → you review it in **Admin → Inquiries** → **Create client link** (optionally emails the
private link) → the client fills in the existing private project form.

The public pages never show a client-form link. Private links are still only created by you.

To turn it on after pulling these changes:
1. Supabase → SQL Editor → paste the whole `supabase/schema.sql` again → Run (safe to re-run; it only adds what's missing).
2. `cd plyndi-client-backend/worker && npx wrangler deploy` (new endpoints + a stricter 5/min rate limit on the inquiry form).
3. Push the website (`git push`).
4. Emails need Resend (section 6). Without `RESEND_API_KEY`, inquiries are still saved and shown in the admin,
   but no confirmation/notification/invite emails are sent.

Adding a future service: copy one `<article class="svc-card">` in `services/index.html`
(instructions are in the comment above the cards). Coming-soon cards get `is-soon` and no button.

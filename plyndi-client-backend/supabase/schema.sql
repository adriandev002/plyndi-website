-- =========================================================
-- Plyndi — Client Project Information System
-- Supabase / PostgreSQL schema
-- ---------------------------------------------------------
-- Run this ONCE in Supabase: Dashboard -> SQL Editor -> New query
-- -> paste the whole file -> Run. Safe to re-run (idempotent).
--
-- Security model
--   * Row Level Security is ON for every table with NO policies,
--     so the public "anon" / "publishable" key can read NOTHING.
--   * Every function below is callable only by the service_role,
--     which only the Cloudflare Worker holds (as an encrypted secret).
--   * Browsers never talk to the database directly.
-- =========================================================

create extension if not exists pgcrypto;

-- ---------- Invites: one private form link per client ----------
create table if not exists public.client_invites (
  id           uuid primary key default gen_random_uuid(),
  token        text not null unique check (length(token) >= 32),
  client_name  text not null,
  notes        text,
  active       boolean not null default true,
  created_at   timestamptz not null default now(),
  project_type text not null default 'website' check (project_type in ('website','app'))
);

-- ---------- Main submission row ----------
create table if not exists public.client_projects (
  id              uuid primary key default gen_random_uuid(),
  public_token    text not null unique check (length(public_token) >= 32),  -- preview link id
  ref             text not null unique,                                     -- human friendly, e.g. CP-261004-7KQ2
  invite_id       uuid not null references public.client_invites(id) on delete restrict,
  revision_of     uuid references public.client_projects(id) on delete set null,
  revision_number int  not null default 1,
  status          text not null default 'New'
                  check (status in ('New','Reviewing','In Progress','Approved','Completed')),
  project_type    text not null default 'website' check (project_type in ('website','app')),  -- copied from the link
  submitted_at    timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  owner_notes     text,

  -- Step 1 — Company
  company_name text not null, official_name text, tagline text, company_description text,
  year_established text, years_experience text, founder_background text, mission text, vision text,
  company_values text, office_address text, country text, city text, phone text, email text,
  whatsapp text, line_id text, business_hours text, google_maps_url text, facebook_url text,
  instagram_url text, tiktok_url text, youtube_url text, other_social text,
  -- Step 2 — Brand
  logo_status text, brand_colors text, primary_color text, secondary_color text, font_style text,
  design_styles text[] not null default '{}', design_style_other text,
  websites_like text, websites_dislike text, design_notes text,
  -- Step 3 — Business
  business_type text, company_introduction text, target_customers text, customer_age_range text,
  customer_countries text, customer_languages text, main_destinations text, selling_points text,
  differentiator text, why_choose_us text, competitors text, competitor_urls text,
  important_services text, profitable_services text, promote_services text,
  -- Step 6 — Booking & payment
  booking_method text, payment_methods text[] not null default '{}', payment_method_other text,
  current_booking_system text, current_payment_gateway text, deposit_required text, deposit_details text,
  booking_cancellation_policy text, booking_refund_policy text, confirmation_method text,
  special_booking_requirements text,
  -- Step 11 — Media (links; the files themselves are in uploaded_files)
  video_links text,
  -- Step 12 — Website requirements
  website_languages text[] not null default '{}', website_language_other text,
  website_features text[] not null default '{}', website_feature_other text, additional_requirements text,
  -- Step 13 — Legal
  privacy_policy text, terms_conditions text, legal_cancellation_policy text, legal_refund_policy text,
  cookie_policy text, liability_disclaimer text, travel_insurance text,
  -- Step 14 — Final
  main_goal text, visitor_first_action text, most_important_feature text, success_definition text,
  anything_else text
);
-- Added later: safe to re-run on an existing database
alter table public.client_projects add column if not exists logo_status text;
-- App projects (Oct 2026) — see migrations/2026-10-app-projects.sql
alter table public.client_invites  add column if not exists project_type text not null default 'website' check (project_type in ('website','app'));
alter table public.client_projects add column if not exists project_type text not null default 'website' check (project_type in ('website','app'));
create index if not exists client_projects_type_idx on public.client_projects (project_type);

create index if not exists client_projects_submitted_idx on public.client_projects (submitted_at desc);
create index if not exists client_projects_invite_idx on public.client_projects (invite_id);

-- ---------- Uploaded files (owned by the invite, so revisions can reuse them) ----------
create table if not exists public.uploaded_files (
  id            uuid primary key default gen_random_uuid(),
  invite_id     uuid not null references public.client_invites(id) on delete cascade,
  draft_id      text not null,
  category      text not null,
  original_name text not null,
  mime_type     text,
  size_bytes    bigint not null check (size_bytes >= 0),
  storage_path  text not null unique,
  status        text not null default 'pending' check (status in ('pending','uploaded')),
  created_at    timestamptz not null default now()
);
create index if not exists uploaded_files_invite_idx on public.uploaded_files (invite_id);

-- Which files belong to which submission, and where they were used
create table if not exists public.submission_files (
  project_id uuid not null references public.client_projects(id) on delete cascade,
  file_id    uuid not null references public.uploaded_files(id) on delete restrict,
  category   text not null,
  position   int  not null default 0,
  primary key (project_id, file_id, category)
);

-- ---------- Repeatable sections ----------
create table if not exists public.services (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  position int not null,
  name text, short_description text, detailed_description text, starting_price text, duration text,
  additional_info text, image_file_ids uuid[] not null default '{}'
);
create table if not exists public.tour_examples (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  position int not null,
  tour_name text, short_description text, full_description text, destination text, category text,
  price text, sale_price text, duration text, available_dates text, departure_time text,
  meeting_point text, end_point text, max_participants text, min_participants text, itinerary text,
  included text, excluded text, what_to_bring text, age_restrictions text, accessibility text,
  cancellation_policy text, refund_policy text, weather_policy text,
  image_file_ids uuid[] not null default '{}'
);
create table if not exists public.destinations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  position int not null,
  name text, description text, main_attractions text, recommended_activities text,
  best_time_to_visit text, travel_tips text, image_file_ids uuid[] not null default '{}'
);
create table if not exists public.team_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  position int not null,
  name text, "position_title" text, languages text, experience text, biography text,
  special_knowledge text, photo_file_ids uuid[] not null default '{}'
);
create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  position int not null,
  platform text, review_text text, customer_name text, review_url text,
  photo_file_ids uuid[] not null default '{}'
);
create table if not exists public.faqs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.client_projects(id) on delete cascade,
  position int not null,
  question text, answer text
);
create index if not exists services_project_idx      on public.services (project_id);
create index if not exists tour_examples_project_idx on public.tour_examples (project_id);
create index if not exists destinations_project_idx  on public.destinations (project_id);
create index if not exists team_members_project_idx  on public.team_members (project_id);
create index if not exists reviews_project_idx       on public.reviews (project_id);
create index if not exists faqs_project_idx          on public.faqs (project_id);

-- ---------- App projects: app-specific answers (one row per app submission) ----------
-- Contact details, brand colours, fonts and styles are stored in
-- client_projects (same columns as the website form).
create table if not exists public.app_project_details (
  project_id uuid primary key references public.client_projects(id) on delete cascade,
  -- Contact & company
  contact_name text, preferred_language text,
  -- App idea
  app_name text, app_summary text, problem_solved text, target_users text, competitor_apps text,
  -- Platforms
  platforms text[] not null default '{}', build_type text, existing_store_links text, existing_tech text,
  offline_needed text,
  -- Features
  features jsonb not null default '[]'::jsonb,            -- [{name, description, priority}]
  login_methods text[] not null default '{}', user_roles text,
  app_capabilities text[] not null default '{}', payment_details text, ai_features text,
  app_languages text[] not null default '{}', app_language_other text,
  integrations jsonb not null default '[]'::jsonb,        -- [{name, purpose, url}]
  -- Admin & data
  admin_dashboard text, admin_manages text, data_import text, analytics_needs text,
  -- Design
  app_fonts text, app_tone text,
  design_references jsonb not null default '[]'::jsonb,   -- [{url, notes}]
  -- Content & launch
  content_provider text, apple_developer_account text, google_play_account text, privacy_policy_status text,
  -- Budget & timeline
  budget_range text, target_launch text, deadline_reason text, maintenance text,
  constraint app_project_details_lists_are_arrays check (
    jsonb_typeof(features) = 'array' and jsonb_typeof(integrations) = 'array'
    and jsonb_typeof(design_references) = 'array')
);

-- ---------- Lock everything down ----------
do $$
declare t text;
begin
  foreach t in array array['client_invites','client_projects','uploaded_files','submission_files',
                           'services','tour_examples','destinations','team_members','reviews','faqs',
                           'app_project_details']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
    -- Only the Worker's role (service_role) may read/write. Granted explicitly, so this works
    -- even when "Automatically expose new tables" is switched off in Supabase.
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant select, insert, update, delete on table public.%I to service_role', t);
    end if;
  end loop;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant usage on schema public to service_role;
  end if;
end $$;

-- =========================================================
-- Functions (called by the Worker through /rest/v1/rpc/<name>)
-- =========================================================

-- Look up an active invite by its token
create or replace function public.cp_get_invite(p_token text)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'client_name', client_name, 'project_type', project_type)
  from public.client_invites where token = p_token and active;
$$;

-- New optional 4th argument. The old 3-argument version is dropped first so
-- PostgREST never sees two candidates (calls without p_project_type still work).
drop function if exists public.cp_create_invite(text, text, text);
create or replace function public.cp_create_invite(p_token text, p_client_name text, p_notes text default null,
                                                   p_project_type text default 'website')
returns jsonb language sql as $$
  insert into public.client_invites (token, client_name, notes, project_type)
  values (p_token, p_client_name, nullif(p_notes, ''), coalesce(nullif(p_project_type, ''), 'website'))
  returning to_jsonb(client_invites.*);
$$;

create or replace function public.cp_list_invites()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(x order by x.created_at desc), '[]'::jsonb) from (
    select i.*, (select count(*) from public.client_projects p where p.invite_id = i.id) as submissions
    from public.client_invites i
  ) x;
$$;

create or replace function public.cp_set_invite_active(p_id uuid, p_active boolean)
returns jsonb language sql as $$
  update public.client_invites set active = p_active where id = p_id
  returning jsonb_build_object('id', id, 'active', active);
$$;

-- Reserve a storage path for an upload (enforces per-invite quotas)
create or replace function public.cp_register_upload(
  p_invite_token text, p_draft_id text, p_category text, p_name text,
  p_size bigint, p_mime text, p_path text, p_max_files int, p_max_bytes bigint)
returns jsonb language plpgsql as $$
declare v_invite uuid; v_count int; v_bytes bigint; v_row public.uploaded_files;
begin
  select id into v_invite from public.client_invites where token = p_invite_token and active;
  if v_invite is null then raise exception 'invalid_invite' using errcode = 'P0001'; end if;
  select count(*), coalesce(sum(size_bytes), 0) into v_count, v_bytes
    from public.uploaded_files where invite_id = v_invite;
  if v_count >= p_max_files then raise exception 'quota_files' using errcode = 'P0001'; end if;
  if v_bytes + p_size > p_max_bytes then raise exception 'quota_bytes' using errcode = 'P0001'; end if;
  insert into public.uploaded_files (invite_id, draft_id, category, original_name, mime_type, size_bytes, storage_path)
  values (v_invite, p_draft_id, p_category, p_name, p_mime, p_size, p_path)
  returning * into v_row;
  return jsonb_build_object('id', v_row.id, 'path', v_row.storage_path);
end $$;

create or replace function public.cp_mark_uploaded(p_invite_token text, p_file_id uuid)
returns jsonb language sql as $$
  update public.uploaded_files f set status = 'uploaded'
  from public.client_invites i
  where f.id = p_file_id and f.invite_id = i.id and i.token = p_invite_token
  returning jsonb_build_object('id', f.id, 'path', f.storage_path, 'status', f.status);
$$;

-- Delete a file that has NOT been used in any submission yet. Returns its path (for storage delete).
create or replace function public.cp_delete_pending_upload(p_invite_token text, p_file_id uuid)
returns jsonb language sql as $$
  delete from public.uploaded_files f
  using public.client_invites i
  where f.id = p_file_id and f.invite_id = i.id and i.token = p_invite_token
    and not exists (select 1 from public.submission_files s where s.file_id = f.id)
  returning jsonb_build_object('id', f.id, 'path', f.storage_path);
$$;

-- Save a whole submission in ONE transaction.
-- p_payload = { fields:{column:value}, lists:{services:[…],…}, files:[{file_id,category,position}],
--               app:{column:value, features:[…], integrations:[…], design_references:[…]} }   (app links only)
-- The Worker has already whitelisted keys; jsonb_populate_record ignores anything unknown anyway,
-- and system columns (id, status, tokens, project_type…) are always overwritten below.
create or replace function public.cp_submit_project(
  p_invite_token text, p_public_token text, p_revision_of text, p_payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_invite uuid; v_type text; v_rev_of uuid; v_rev int := 1; v_id uuid := gen_random_uuid();
  v_ref text; v_rec public.client_projects; v_app public.app_project_details; f jsonb;
  v_fields jsonb := coalesce(p_payload->'fields', '{}'::jsonb);
begin
  select id, project_type into v_invite, v_type from public.client_invites where token = p_invite_token and active;
  if v_invite is null then raise exception 'invalid_invite' using errcode = 'P0001'; end if;
  if coalesce(trim(v_fields->>'company_name'), '') = '' then
    raise exception 'missing_company_name' using errcode = 'P0001';
  end if;

  if p_revision_of is not null and p_revision_of <> '' then
    select id into v_rev_of from public.client_projects
     where public_token = p_revision_of and invite_id = v_invite;
    if v_rev_of is not null then
      select coalesce(max(revision_number), 0) + 1 into v_rev
        from public.client_projects where invite_id = v_invite;
    end if;
  end if;

  v_ref := 'CP-' || to_char(now() at time zone 'Asia/Taipei', 'YYMMDD') || '-'
           || upper(substr(encode(gen_random_bytes(4), 'hex'), 1, 5));

  v_rec := jsonb_populate_record(null::public.client_projects, v_fields);
  v_rec.id := v_id; v_rec.public_token := p_public_token; v_rec.ref := v_ref;
  v_rec.invite_id := v_invite; v_rec.revision_of := v_rev_of; v_rec.revision_number := v_rev;
  v_rec.status := 'New'; v_rec.submitted_at := now(); v_rec.updated_at := now(); v_rec.owner_notes := null;
  v_rec.project_type := v_type;                                -- from the link, never from the client
  v_rec.design_styles := coalesce(v_rec.design_styles, '{}');
  v_rec.payment_methods := coalesce(v_rec.payment_methods, '{}');
  v_rec.website_languages := coalesce(v_rec.website_languages, '{}');
  v_rec.website_features := coalesce(v_rec.website_features, '{}');
  insert into public.client_projects select v_rec.*;

  insert into public.services (project_id, position, name, short_description, detailed_description,
                               starting_price, duration, additional_info, image_file_ids)
  select v_id, ord - 1, r.name, r.short_description, r.detailed_description, r.starting_price, r.duration,
         r.additional_info, coalesce(r.image_file_ids, '{}')
  from jsonb_array_elements(coalesce(p_payload->'lists'->'services', '[]')) with ordinality e(j, ord),
       jsonb_populate_record(null::public.services, e.j) r;

  insert into public.tour_examples (project_id, position, tour_name, short_description, full_description,
      destination, category, price, sale_price, duration, available_dates, departure_time, meeting_point,
      end_point, max_participants, min_participants, itinerary, included, excluded, what_to_bring,
      age_restrictions, accessibility, cancellation_policy, refund_policy, weather_policy, image_file_ids)
  select v_id, ord - 1, r.tour_name, r.short_description, r.full_description, r.destination, r.category,
         r.price, r.sale_price, r.duration, r.available_dates, r.departure_time, r.meeting_point, r.end_point,
         r.max_participants, r.min_participants, r.itinerary, r.included, r.excluded, r.what_to_bring,
         r.age_restrictions, r.accessibility, r.cancellation_policy, r.refund_policy, r.weather_policy,
         coalesce(r.image_file_ids, '{}')
  from jsonb_array_elements(coalesce(p_payload->'lists'->'tours', '[]')) with ordinality e(j, ord),
       jsonb_populate_record(null::public.tour_examples, e.j) r;

  insert into public.destinations (project_id, position, name, description, main_attractions,
                                   recommended_activities, best_time_to_visit, travel_tips, image_file_ids)
  select v_id, ord - 1, r.name, r.description, r.main_attractions, r.recommended_activities,
         r.best_time_to_visit, r.travel_tips, coalesce(r.image_file_ids, '{}')
  from jsonb_array_elements(coalesce(p_payload->'lists'->'destinations', '[]')) with ordinality e(j, ord),
       jsonb_populate_record(null::public.destinations, e.j) r;

  insert into public.team_members (project_id, position, name, position_title, languages, experience,
                                   biography, special_knowledge, photo_file_ids)
  select v_id, ord - 1, e.j->>'name', e.j->>'position', e.j->>'languages', e.j->>'experience',
         e.j->>'biography', e.j->>'special_knowledge',
         coalesce((select array_agg(x::uuid) from jsonb_array_elements_text(coalesce(e.j->'photo_file_ids','[]')) x), '{}')
  from jsonb_array_elements(coalesce(p_payload->'lists'->'team', '[]')) with ordinality e(j, ord);

  insert into public.reviews (project_id, position, platform, review_text, customer_name, review_url, photo_file_ids)
  select v_id, ord - 1, r.platform, r.review_text, r.customer_name, r.review_url, coalesce(r.photo_file_ids, '{}')
  from jsonb_array_elements(coalesce(p_payload->'lists'->'reviews', '[]')) with ordinality e(j, ord),
       jsonb_populate_record(null::public.reviews, e.j) r;

  insert into public.faqs (project_id, position, question, answer)
  select v_id, ord - 1, r.question, r.answer
  from jsonb_array_elements(coalesce(p_payload->'lists'->'faqs', '[]')) with ordinality e(j, ord),
       jsonb_populate_record(null::public.faqs, e.j) r;

  -- App answers (app links only)
  if v_type = 'app' then
    v_app := jsonb_populate_record(null::public.app_project_details, coalesce(p_payload->'app', '{}'::jsonb));
    v_app.project_id := v_id;
    v_app.platforms := coalesce(v_app.platforms, '{}');
    v_app.login_methods := coalesce(v_app.login_methods, '{}');
    v_app.app_capabilities := coalesce(v_app.app_capabilities, '{}');
    v_app.app_languages := coalesce(v_app.app_languages, '{}');
    v_app.features := case when jsonb_typeof(v_app.features) = 'array' then v_app.features else '[]'::jsonb end;
    v_app.integrations := case when jsonb_typeof(v_app.integrations) = 'array' then v_app.integrations else '[]'::jsonb end;
    v_app.design_references := case when jsonb_typeof(v_app.design_references) = 'array' then v_app.design_references else '[]'::jsonb end;
    insert into public.app_project_details select v_app.*;
  end if;

  -- Link files — only files that belong to THIS invite and finished uploading are accepted.
  for f in select * from jsonb_array_elements(coalesce(p_payload->'files', '[]')) loop
    insert into public.submission_files (project_id, file_id, category, position)
    select v_id, u.id, f->>'category', coalesce((f->>'position')::int, 0)
    from public.uploaded_files u
    where u.id = (f->>'file_id')::uuid and u.invite_id = v_invite and u.status = 'uploaded'
    on conflict do nothing;
  end loop;

  return jsonb_build_object('id', v_id, 'ref', v_ref, 'public_token', p_public_token,
                            'submitted_at', now(), 'revision_number', v_rev,
                            'company_name', v_rec.company_name, 'email', v_rec.email,
                            'project_type', v_type, 'app_name', v_app.app_name);
end $$;

-- Full submission as JSON (preview + admin detail). Returns null if not found.
-- 'app' is null for website submissions.
-- 'app' is null for website submissions.
create or replace function public.cp_get_project(p_public_token text)
returns jsonb language sql stable as $$
  select jsonb_build_object(
    'project', to_jsonb(p) - 'invite_id',
    'invite', jsonb_build_object('client_name', i.client_name, 'token', i.token, 'active', i.active),
    'lists', jsonb_build_object(
      'services',     (select coalesce(jsonb_agg(to_jsonb(s) - 'project_id' - 'id' order by s.position), '[]') from public.services s where s.project_id = p.id),
      'tours',        (select coalesce(jsonb_agg(to_jsonb(s) - 'project_id' - 'id' order by s.position), '[]') from public.tour_examples s where s.project_id = p.id),
      'destinations', (select coalesce(jsonb_agg(to_jsonb(s) - 'project_id' - 'id' order by s.position), '[]') from public.destinations s where s.project_id = p.id),
      'team',         (select coalesce(jsonb_agg((to_jsonb(s) - 'project_id' - 'id' - 'position_title') || jsonb_build_object('position', s.position_title, '_order', s.position) order by s.position), '[]') from public.team_members s where s.project_id = p.id),
      'reviews',      (select coalesce(jsonb_agg(to_jsonb(s) - 'project_id' - 'id' order by s.position), '[]') from public.reviews s where s.project_id = p.id),
      'faqs',         (select coalesce(jsonb_agg(to_jsonb(s) - 'project_id' - 'id' order by s.position), '[]') from public.faqs s where s.project_id = p.id)
    ),
    'app', (select to_jsonb(a) - 'project_id' from public.app_project_details a where a.project_id = p.id),
    'files', (select coalesce(jsonb_agg(jsonb_build_object(
                 'id', u.id, 'category', sf.category, 'position', sf.position, 'name', u.original_name,
                 'type', u.mime_type, 'size', u.size_bytes, 'path', u.storage_path) order by sf.category, sf.position), '[]')
              from public.submission_files sf join public.uploaded_files u on u.id = sf.file_id
              where sf.project_id = p.id),
    'revisions', (select coalesce(jsonb_agg(jsonb_build_object('ref', r.ref, 'public_token', r.public_token,
                    'revision_number', r.revision_number, 'submitted_at', r.submitted_at) order by r.submitted_at), '[]')
                  from public.client_projects r where r.invite_id = p.invite_id)
  )
  from public.client_projects p join public.client_invites i on i.id = p.invite_id
  where p.public_token = p_public_token;
$$;

create or replace function public.cp_list_projects()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'ref', p.ref, 'public_token', p.public_token, 'company_name', p.company_name,
    'email', p.email, 'country', p.country, 'status', p.status, 'submitted_at', p.submitted_at,
    'revision_number', p.revision_number, 'client_name', i.client_name,
    'file_count', (select count(*) from public.submission_files s where s.project_id = p.id),
    'project_type', p.project_type, 'app_name', a.app_name, 'platforms', a.platforms,
    'budget_range', a.budget_range, 'target_launch', a.target_launch
  ) order by p.submitted_at desc), '[]'::jsonb)
  from public.client_projects p join public.client_invites i on i.id = p.invite_id
  left join public.app_project_details a on a.project_id = p.id;
$$;

create or replace function public.cp_set_status(p_public_token text, p_status text, p_notes text default null)
returns jsonb language sql as $$
  update public.client_projects
     set status = p_status, updated_at = now(), owner_notes = coalesce(p_notes, owner_notes)
   where public_token = p_public_token
  returning jsonb_build_object('ref', ref, 'status', status, 'updated_at', updated_at);
$$;

-- =========================================================
-- Public project inquiries (Services → Website Development → "Start Your Project")
-- A visitor leaves only an email. Plyndi reviews it, then creates a
-- private client-form link (client_invites) from the admin dashboard.
-- =========================================================
create table if not exists public.project_inquiries (
  id          uuid primary key default gen_random_uuid(),
  email       text not null check (length(email) between 3 and 254),
  service     text not null default 'website',
  source_page text,
  status      text not null default 'New' check (status in ('New','Invited','Declined')),
  invite_id   uuid references public.client_invites(id) on delete set null,
  owner_notes text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists project_inquiries_created_idx on public.project_inquiries (created_at desc);
create index if not exists project_inquiries_email_idx on public.project_inquiries (lower(email), service);

alter table public.project_inquiries enable row level security;
revoke all on table public.project_inquiries from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.project_inquiries from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on table public.project_inquiries to service_role;
  end if;
end $$;

-- Save an inquiry. The same email asking for the same service within 24 hours is
-- treated as a duplicate (no new row, no second confirmation email).
create or replace function public.cp_create_inquiry(p_email text, p_service text, p_source_page text)
returns jsonb language plpgsql as $$
declare v_id uuid;
begin
  select id into v_id from public.project_inquiries
   where lower(email) = lower(p_email) and service = p_service and created_at > now() - interval '24 hours'
   order by created_at desc limit 1;
  if v_id is not null then
    return jsonb_build_object('id', v_id, 'duplicate', true);
  end if;
  insert into public.project_inquiries (email, service, source_page)
  values (lower(trim(p_email)), p_service, left(p_source_page, 300))
  returning id into v_id;
  return jsonb_build_object('id', v_id, 'duplicate', false);
end $$;

create or replace function public.cp_list_inquiries()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', q.id, 'email', q.email, 'service', q.service, 'source_page', q.source_page,
    'status', q.status, 'owner_notes', q.owner_notes, 'created_at', q.created_at,
    'invite_id', q.invite_id, 'invite_token', i.token, 'invite_active', i.active
  ) order by q.created_at desc), '[]'::jsonb)
  from public.project_inquiries q left join public.client_invites i on i.id = q.invite_id;
$$;

create or replace function public.cp_get_inquiry(p_id uuid)
returns jsonb language sql stable as $$
  select to_jsonb(q) from public.project_inquiries q where q.id = p_id;
$$;

create or replace function public.cp_update_inquiry(p_id uuid, p_status text, p_invite_id uuid default null, p_notes text default null)
returns jsonb language sql as $$
  update public.project_inquiries
     set status = coalesce(p_status, status),
         invite_id = coalesce(p_invite_id, invite_id),
         owner_notes = coalesce(p_notes, owner_notes),
         updated_at = now()
   where id = p_id
  returning to_jsonb(project_inquiries.*);
$$;

-- Only the service role (the Worker) may call these functions.
do $$
declare fn text;
begin
  for fn in select p.oid::regprocedure::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.proname like 'cp\_%'
  loop
    execute format('revoke all on function %s from public', fn);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function %s from anon, authenticated', fn);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function %s to service_role', fn);
    end if;
  end loop;
end $$;

-- =========================================================
-- Storage: private bucket for client uploads
-- (no storage policies = nobody but the service role can read/write;
--  browsers upload with short-lived signed upload URLs from the Worker)
-- =========================================================
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('client-uploads', 'client-uploads', false, 52428800, array[
      'image/jpeg','image/png','image/webp','image/gif','image/svg+xml','image/avif','image/heic',
      'application/pdf','application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/plain','video/mp4','video/quicktime','video/webm','application/zip','application/x-zip-compressed'])
    on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit,
                                   allowed_mime_types = excluded.allowed_mime_types;
  end if;
end $$;

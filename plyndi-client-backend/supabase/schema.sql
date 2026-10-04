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
  created_at   timestamptz not null default now()
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
  brand_colors text, primary_color text, secondary_color text, font_style text,
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

-- ---------- Lock everything down ----------
do $$
declare t text;
begin
  foreach t in array array['client_invites','client_projects','uploaded_files','submission_files',
                           'services','tour_examples','destinations','team_members','reviews','faqs']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on table public.%I from public', t);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on table public.%I from anon, authenticated', t);
    end if;
  end loop;
end $$;

-- =========================================================
-- Functions (called by the Worker through /rest/v1/rpc/<name>)
-- =========================================================

-- Look up an active invite by its token
create or replace function public.cp_get_invite(p_token text)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'client_name', client_name)
  from public.client_invites where token = p_token and active;
$$;

create or replace function public.cp_create_invite(p_token text, p_client_name text, p_notes text default null)
returns jsonb language sql as $$
  insert into public.client_invites (token, client_name, notes)
  values (p_token, p_client_name, nullif(p_notes, ''))
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
-- p_payload = { fields:{column:value}, lists:{services:[…],…}, files:[{file_id,category,position}] }
-- The Worker has already whitelisted keys; jsonb_populate_record ignores anything unknown anyway,
-- and system columns (id, status, tokens…) are always overwritten below.
create or replace function public.cp_submit_project(
  p_invite_token text, p_public_token text, p_revision_of text, p_payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_invite uuid; v_rev_of uuid; v_rev int := 1; v_id uuid := gen_random_uuid();
  v_ref text; v_rec public.client_projects; f jsonb;
  v_fields jsonb := coalesce(p_payload->'fields', '{}'::jsonb);
begin
  select id into v_invite from public.client_invites where token = p_invite_token and active;
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
                            'company_name', v_rec.company_name, 'email', v_rec.email);
end $$;

-- Full submission as JSON (preview + admin detail). Returns null if not found.
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
    'file_count', (select count(*) from public.submission_files s where s.project_id = p.id)
  ) order by p.submitted_at desc), '[]'::jsonb)
  from public.client_projects p join public.client_invites i on i.id = p.invite_id;
$$;

create or replace function public.cp_set_status(p_public_token text, p_status text, p_notes text default null)
returns jsonb language sql as $$
  update public.client_projects
     set status = p_status, updated_at = now(), owner_notes = coalesce(p_notes, owner_notes)
   where public_token = p_public_token
  returning jsonb_build_object('ref', ref, 'status', status, 'updated_at', updated_at);
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

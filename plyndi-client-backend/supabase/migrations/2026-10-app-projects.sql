-- =========================================================
-- Plyndi — Client Project System: app projects (October 2026)
-- ---------------------------------------------------------
-- Adds a project type (website | app) to client links and
-- submissions, and a table for app-specific answers.
--
-- Run ONCE in Supabase: SQL Editor -> New query -> paste this
-- whole file -> Run. Safe to re-run (idempotent).
--
-- Order: run this BEFORE deploying the new Worker. The current
-- Worker keeps working after this migration (every existing link
-- and submission becomes 'website', and all function signatures
-- it calls still match).
--
-- schema.sql already contains the same changes for fresh installs.
-- =========================================================

begin;

-- ---------- 1. Project type on links and submissions ----------
-- Existing rows get 'website'. The type of a submission is copied from
-- its link by cp_submit_project — never taken from client input.
alter table public.client_invites
  add column if not exists project_type text not null default 'website'
  check (project_type in ('website','app'));
alter table public.client_projects
  add column if not exists project_type text not null default 'website'
  check (project_type in ('website','app'));
create index if not exists client_projects_type_idx on public.client_projects (project_type);

-- ---------- 2. App-specific answers (one row per app submission) ----------
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

-- Same lock-down as every other table: RLS on, no policies, service_role only.
alter table public.app_project_details enable row level security;
revoke all on table public.app_project_details from public;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'anon') then
    revoke all on table public.app_project_details from anon, authenticated;
  end if;
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    grant select, insert, update, delete on table public.app_project_details to service_role;
  end if;
end $$;

-- ---------- 3. Functions ----------
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

-- ---------- 4. Only the service role (the Worker) may call cp_* functions ----------
-- Re-applied because cp_create_invite was re-created (new functions are executable by PUBLIC by default).
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

commit;

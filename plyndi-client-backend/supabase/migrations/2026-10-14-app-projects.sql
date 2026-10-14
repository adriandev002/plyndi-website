-- =========================================================
-- Plyndi client system — App projects (2026-10-14)
-- Run ONCE in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Safe to re-run. Existing links and submissions stay "website".
-- Run this BEFORE deploying the new Worker.
-- =========================================================

-- Which question set a private link uses
alter table public.client_invites  add column if not exists project_type text not null default 'website';
alter table public.client_projects add column if not exists project_type text not null default 'website';
-- App answers that have no website column: { fields: {...}, lists: { app_features: [...] } }
alter table public.client_projects add column if not exists app_details jsonb not null default '{}'::jsonb;

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'client_invites_project_type_check') then
    alter table public.client_invites add constraint client_invites_project_type_check check (project_type in ('website','app'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'client_projects_project_type_check') then
    alter table public.client_projects add constraint client_projects_project_type_check check (project_type in ('website','app'));
  end if;
end $$;

create or replace function public.cp_get_invite(p_token text)
returns jsonb language sql stable as $$
  select jsonb_build_object('id', id, 'client_name', client_name, 'project_type', project_type)
  from public.client_invites where token = p_token and active;
$$;

-- New optional argument. Drop the old 3-argument version first so the API never sees two versions.
drop function if exists public.cp_create_invite(text, text, text);
create or replace function public.cp_create_invite(p_token text, p_client_name text, p_notes text default null,
                                                   p_project_type text default 'website')
returns jsonb language sql as $$
  insert into public.client_invites (token, client_name, notes, project_type)
  values (p_token, p_client_name, nullif(p_notes, ''), coalesce(p_project_type, 'website'))
  returning to_jsonb(client_invites.*);
$$;

-- Same as before, plus: the type always comes from the invite (never from the client),
-- and app answers are stored in app_details.
create or replace function public.cp_submit_project(
  p_invite_token text, p_public_token text, p_revision_of text, p_payload jsonb)
returns jsonb language plpgsql as $$
declare
  v_invite uuid; v_type text; v_rev_of uuid; v_rev int := 1; v_id uuid := gen_random_uuid();
  v_ref text; v_rec public.client_projects; f jsonb;
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
  v_rec.project_type := coalesce(v_type, 'website');
  v_rec.app_details := case when v_type = 'app' and jsonb_typeof(p_payload->'app_details') = 'object'
                            then p_payload->'app_details' else '{}'::jsonb end;
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

  for f in select * from jsonb_array_elements(coalesce(p_payload->'files', '[]')) loop
    insert into public.submission_files (project_id, file_id, category, position)
    select v_id, u.id, f->>'category', coalesce((f->>'position')::int, 0)
    from public.uploaded_files u
    where u.id = (f->>'file_id')::uuid and u.invite_id = v_invite and u.status = 'uploaded'
    on conflict do nothing;
  end loop;

  return jsonb_build_object('id', v_id, 'ref', v_ref, 'public_token', p_public_token,
                            'submitted_at', now(), 'revision_number', v_rev, 'project_type', v_rec.project_type,
                            'company_name', v_rec.company_name, 'email', v_rec.email);
end $$;

create or replace function public.cp_list_projects()
returns jsonb language sql stable as $$
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', p.id, 'ref', p.ref, 'public_token', p.public_token, 'company_name', p.company_name,
    'email', p.email, 'country', p.country, 'status', p.status, 'submitted_at', p.submitted_at,
    'revision_number', p.revision_number, 'client_name', i.client_name, 'project_type', p.project_type,
    'file_count', (select count(*) from public.submission_files s where s.project_id = p.id)
  ) order by p.submitted_at desc), '[]'::jsonb)
  from public.client_projects p join public.client_invites i on i.id = p.invite_id;
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

-- Make the API pick up the new function signature right away
notify pgrst, 'reload schema';

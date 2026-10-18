-- =========================================================
-- Plyndi client system — CMS projects (2026-10-18)
-- Run ONCE in Supabase -> SQL Editor -> New query -> paste -> Run.
-- Needs 2026-10-14-app-projects.sql to have been run first.
-- Safe to re-run. Existing links and submissions are not changed.
-- Run this BEFORE deploying the new Worker.
-- =========================================================

-- 1. Allow "cms" as a link / submission type
alter table public.client_invites  drop constraint if exists client_invites_project_type_check;
alter table public.client_invites  add constraint client_invites_project_type_check  check (project_type in ('website','app','cms'));
alter table public.client_projects drop constraint if exists client_projects_project_type_check;
alter table public.client_projects add constraint client_projects_project_type_check check (project_type in ('website','app','cms'));

-- 2. Keep CMS answers too (they live in app_details, like app answers).
--    The submit function is replaced with the same code, except that one condition:
--    app_details is now kept for every type except 'website'.
do $$
declare v_def text;
begin
  select pg_get_functiondef('public.cp_submit_project(text,text,text,jsonb)'::regprocedure) into v_def;
  if position('when v_type = ''app'' and' in v_def) > 0 then
    execute replace(v_def, 'when v_type = ''app'' and', 'when v_type <> ''website'' and');
  elsif position('when v_type <> ''website'' and' in v_def) = 0 then
    raise exception 'cp_submit_project does not look as expected. Run 2026-10-14-app-projects.sql first.';
  end if;
end $$;

-- 3. Let clients upload spreadsheets (Excel, CSV) with their existing content
do $$ begin
  if exists (select 1 from information_schema.tables where table_schema = 'storage' and table_name = 'buckets') then
    update storage.buckets
       set allowed_mime_types = (select array_agg(distinct m) from unnest(coalesce(allowed_mime_types, '{}') || array[
             'text/csv', 'application/vnd.ms-excel',
             'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet']) m)
     where id = 'client-uploads';
  end if;
end $$;

-- The replaced function keeps its permissions (only the Worker's service role may call it).
notify pgrst, 'reload schema';

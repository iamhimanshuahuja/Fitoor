-- v11: pre-launch hardening (21 Nov 2026)
-- 1) Helper functions: only signed-in users may call them directly (Postgres grants EXECUTE to PUBLIC by default).
--    coach_lookup (signup page) and recipe_view (public recipe pages) stay callable by visitors on purpose.
do $$
declare f text;
begin
  foreach f in array array[
    'public.is_super()', 'public.is_staff()', 'public.is_admin()', 'public.my_coach_id()', 'public.my_features()',
    'public.coaches(uuid)', 'public.coaches_path(text)', 'public.has_feature(uuid, text)', 'public.is_super_user(uuid)'
  ] loop
    if to_regprocedure(f) is not null then
      execute format('revoke execute on function %s from public, anon', f);
      execute format('grant execute on function %s to authenticated, service_role', f);
    end if;
  end loop;
end $$;

-- 2) Storage limits
--    recipes (public): dish photos only, max 3 MB (the app compresses to ~200 KB WebP)
update storage.buckets set file_size_limit = 3145728, allowed_mime_types = array['image/webp','image/jpeg','image/png','image/heic','image/heif']
  where id = 'recipes';
--    media stays private with its 5 MB limit; file types are not restricted so lab photos/PDFs from any phone still upload.

select 'v11 ok' as status,
  has_function_privilege('anon', 'public.is_super_user(uuid)', 'execute') as anon_is_super_user,
  has_function_privilege('anon', 'public.coach_lookup(text)', 'execute') as anon_coach_lookup,
  has_function_privilege('authenticated', 'public.has_feature(uuid, text)', 'execute') as auth_has_feature;

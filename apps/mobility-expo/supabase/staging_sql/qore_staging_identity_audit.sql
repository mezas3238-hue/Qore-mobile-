-- G232 external Supabase STAGING, read-only security verification.
SELECT
 t.tablename,
 c.relrowsecurity AS rls_enabled,
 has_table_privilege('anon', format('public.%I', t.tablename), 'SELECT') AS anon_select,
 has_table_privilege('authenticated', format('public.%I', t.tablename), 'INSERT') AS auth_insert,
 has_table_privilege('authenticated', format('public.%I', t.tablename), 'UPDATE') AS auth_update,
 has_table_privilege('authenticated', format('public.%I', t.tablename), 'DELETE') AS auth_delete
FROM pg_catalog.pg_tables t
JOIN pg_catalog.pg_class c ON c.oid = format('public.%I', t.tablename)::regclass
WHERE t.schemaname='public'
ORDER BY t.tablename;

SELECT tablename, policyname, cmd, roles, qual, with_check
 FROM pg_catalog.pg_policies
 WHERE schemaname='public'
 ORDER BY tablename, policyname;

SELECT
 (SELECT count(*) FROM auth.users) AS auth_users,
 (SELECT count(*) FROM public.profiles) AS profiles,
 (SELECT count(*) FROM public.user_roles) AS assigned_roles,
 (SELECT count(*) FROM public.driver_locations) AS driver_locations;

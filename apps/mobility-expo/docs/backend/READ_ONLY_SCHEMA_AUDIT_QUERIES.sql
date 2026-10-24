-- SOLO SELECT de metadatos. NO muestra valores de cuentas ni PII.
-- Ejecutar por separado, en STAGING y con cuenta auditora autorizada.
-- NO EJECUTAR en entorno productivo desde dispositivos ni app cliente.

-- 1) Policies aplicadas
select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check
from pg_catalog.pg_policies
where schemaname='public'
order by tablename,policyname;

-- 2) RPC y grants aplicados
select p.proname, pg_get_function_identity_arguments(p.oid) as arguments,
p.prosecdef as security_definer, p.proconfig as settings, p.proacl::text as grants
from pg_catalog.pg_proc p
join pg_catalog.pg_namespace n on n.oid=p.pronamespace
where n.nspname='public'
order by p.proname;

-- 3) Privilegios de esquemas (investigar CREATE por roles no confiables)
select n.nspname, n.nspacl::text
from pg_catalog.pg_namespace n
where n.nspname in ('public','storage');

-- 4) Estructura técnica; sin filas de usuarios
select table_name,column_name,data_type,is_nullable
from information_schema.columns
where table_schema='public'
order by table_name,ordinal_position;

-- 5) Índices y restricciones
select tablename,indexname,indexdef
from pg_catalog.pg_indexes where schemaname='public'
order by tablename,indexname;

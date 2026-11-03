-- =========================================================
-- Acceso limitado de Logística (migración jur_13_acceso_logistica). Solo agrega.
-- Un registro de jur_coordinadores con logistica = true entra por la puerta Admin
-- con su propio código y SOLO ve la pestaña Logística.
-- =========================================================
alter table public.jur_coordinadores add column if not exists logistica boolean not null default false;

-- Admin o líder de logística
create or replace function public.jur_exigir_logistica(p_codigo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if jur_es_admin(p_codigo) then return; end if;
  if exists (select 1 from jur_coordinadores where codigo = jur_norm(p_codigo) and logistica) then return; end if;
  perform pg_sleep(0.4);
  raise exception 'Este código no tiene acceso a Logística' using errcode = '28000';
end $$;
revoke all on function public.jur_exigir_logistica(text) from public, anon, authenticated;

-- Las 8 funciones de Logística (jur_admin_logistica y jur_admin_log_*) cambian su candado:
-- mismo cuerpo, pero jur_exigir_admin(p_codigo) → jur_exigir_logistica(p_codigo)
do $$
declare f record; def text;
begin
  for f in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and (p.proname like 'jur\_admin\_log\_%' or p.proname = 'jur_admin_logistica') loop
    def := pg_get_functiondef(f.oid);
    if position('jur_exigir_admin(p_codigo)' in def) = 0 then raise exception 'Función sin candado esperado: %', f.oid::regprocedure; end if;
    execute replace(def, 'jur_exigir_admin(p_codigo)', 'jur_exigir_logistica(p_codigo)');
  end loop;
end $$;

-- jur_coord_datos y jur_admin_coordinadores devuelven también "logistica".
-- jur_admin_coordinador se reemplazó (drop function + create) para aceptar p_logistica:
--   jur_admin_coordinador(p_codigo, p_id, p_nombre, p_concursos, p_borrar, p_codigo_fijo, p_logistica)
--   y exige al menos un concurso o Logística.
-- (Cuerpo completo aplicado en Supabase; igual al de 11_coordinadores.sql con esos cambios.)

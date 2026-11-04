-- =========================================================
-- Operador de proyección (migración jur_23_proyeccion). Solo agrega y ajusta reglas.
-- Un acceso limitado con permisos.proyeccion = "ver" usa el «Panel de Proyección»:
--   · lee entregas y presentaciones de los concursos y maneja su tiempo oficial (no crea ni borra equipos)
--   · ve los archivos de equipos y ponentes para proyectarlos
--   · maneja la trivia de las charlas: iniciar, detener y confirmar el podio (no borrar ni anular)
--   · recibe los datos de la Copa solo para la ceremonia de premiación
-- También guarda en la base el programa de la inauguración (jur_programa) para que el admin
-- lo arme en su laptop y salga igual en la del proyector.
-- =========================================================
create table if not exists public.jur_programa (
  clave text primary key,
  datos jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);
alter table public.jur_programa enable row level security;

-- Concursos: el operador puede ver y manejar el tiempo, igual que un coordinador de sala de ese concurso
create or replace function public.jur_exigir_vista_sala(p_codigo text, p_concurso text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if jur_permiso(p_codigo, 'proyeccion', 'ver') then return; end if;
  perform jur_exigir_sala(p_codigo, p_concurso);
end $$;
revoke all on function public.jur_exigir_vista_sala(text, text) from public, anon, authenticated;

do $$
declare r record; def text; nuevo text;
begin
  for r in select * from (values
    ('jur_admin_entregas', 'perform jur_exigir_sala(p_codigo, p_concurso);', 'perform jur_exigir_vista_sala(p_codigo, p_concurso);'),
    ('jur_admin_presentaciones', 'perform jur_exigir_sala(p_codigo, p_concurso);', 'perform jur_exigir_vista_sala(p_codigo, p_concurso);'),
    ('jur_admin_tiempo', 'perform jur_exigir_sala(p_codigo, p_concurso);', 'perform jur_exigir_vista_sala(p_codigo, p_concurso);'),
    ('jur_admin_quiz', 'perform jur_exigir_permiso(p_codigo, ''charlas'', ''ver'');',
       'if not jur_permiso(p_codigo, ''proyeccion'', ''ver'') then perform jur_exigir_permiso(p_codigo, ''charlas'', ''ver''); end if;'),
    ('jur_admin_charla', 'perform jur_exigir_permiso(p_codigo, ''charlas'', ''editar'');',
       'if not (jur_permiso(p_codigo, ''proyeccion'', ''ver'') and p_accion in (''iniciar'', ''detener'', ''confirmar'')) then perform jur_exigir_permiso(p_codigo, ''charlas'', ''editar''); end if;'),
    ('jur_admin_ponentes', 'perform jur_exigir_permiso(p_codigo, ''charlas'', ''ver'');',
       'if not jur_permiso(p_codigo, ''proyeccion'', ''ver'') then perform jur_exigir_permiso(p_codigo, ''charlas'', ''ver''); end if;'),
    ('jur_pres_autorizar_lectura', 'if jur_es_admin(p_codigo) then ok := true;', 'if jur_es_admin(p_codigo) or jur_permiso(p_codigo, ''proyeccion'', ''ver'') then ok := true;'),
    ('jur_ponencia_autorizar_lectura', 'or jur_permiso(p_codigo, ''charlas'', ''ver''))', 'or jur_permiso(p_codigo, ''charlas'', ''ver'') or jur_permiso(p_codigo, ''proyeccion'', ''ver''))'),
    ('jur_admin_datos', 'or coalesce(p->>''copa'', '''') in (''ver'', ''editar'');', 'or coalesce(p->>''copa'', '''') in (''ver'', ''editar'') or coalesce(p->>''proyeccion'', '''') in (''ver'', ''editar'');'),
    ('jur_admin_coordinador', '''delegaciones'', ''logistica'')', '''delegaciones'', ''logistica'', ''proyeccion'')')
  ) as t(fn, viejo, nuevo_txt) loop
    select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = r.fn;
    if def is null then raise exception 'No existe %', r.fn; end if;
    if position(r.nuevo_txt in def) > 0 then continue; end if; -- ya aplicado
    if position(r.viejo in def) = 0 then raise exception 'No se encontró el texto a cambiar en %', r.fn; end if;
    nuevo := replace(def, r.viejo, r.nuevo_txt);
    execute nuevo;
  end loop;
end $$;

-- Programa de la inauguración (y otros que se agreguen): lo lee el admin, un acceso con Charlas o el operador
create or replace function public.jur_programa_leer(p_codigo text, p_clave text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not (jur_permiso(p_codigo, 'proyeccion', 'ver') or jur_permiso(p_codigo, 'charlas', 'ver')) then
    perform pg_sleep(0.4); raise exception 'No tienes acceso a este programa' using errcode = '28000';
  end if;
  return (select json_build_object('datos', datos, 'actualizado', actualizado) from jur_programa where clave = p_clave);
end $$;

create or replace function public.jur_admin_programa(p_codigo text, p_clave text, p_datos jsonb) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_permiso(p_codigo, 'charlas', 'editar');
  if p_clave not in ('inauguracion') then raise exception 'Programa no válido'; end if;
  if length(p_datos::text) > 60000 then raise exception 'El programa es muy largo'; end if;
  insert into jur_programa (clave, datos, actualizado) values (p_clave, coalesce(p_datos, '{}'::jsonb), now())
  on conflict (clave) do update set datos = excluded.datos, actualizado = now();
  return json_build_object('ok', true);
end $$;

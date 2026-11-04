-- =========================================================
-- Accesos limitados personalizables (migración jur_20_accesos_permisos). Solo agrega y ajusta reglas.
-- Cada acceso (jur_coordinadores) tiene `permisos`: { pestaña: "ver" | "editar" } para
-- vivo, resultados, copa, jurados, talleristas, charlas, delegaciones y logistica.
-- Entregas sigue igual: `concursos` = concursos cuyas entregas maneja (coordinador de sala).
-- Ver = mira la pestaña sin cambiar nada (sin códigos de jurados/talleristas).
-- Editar = puede crear, cambiar y borrar en esa pestaña (y ve los códigos).
-- Las funciones de la base lo exigen: aunque alguien fuerce un botón, el servidor lo rechaza.
-- =========================================================
alter table public.jur_coordinadores add column if not exists permisos jsonb not null default '{}'::jsonb;
-- Los líderes de logística que ya existen pasan a tener «Logística: editar»
update public.jur_coordinadores set permisos = permisos || '{"logistica":"editar"}'::jsonb
where logistica and coalesce(permisos->>'logistica', '') = '';

create or replace function public.jur_permiso(p_codigo text, p_area text, p_nivel text default 'ver') returns boolean
language plpgsql stable security definer set search_path = public as $$
declare v text;
begin
  if jur_es_admin(p_codigo) then return true; end if;
  select permisos->>p_area into v from jur_coordinadores where codigo = jur_norm(p_codigo);
  return coalesce(v = 'editar' or (p_nivel = 'ver' and v = 'ver'), false);
end $$;

create or replace function public.jur_exigir_permiso(p_codigo text, p_area text, p_nivel text default 'editar') returns void
language plpgsql security definer set search_path = public as $$
declare msg text := 'Tu acceso es solo para ver: no puedes hacer cambios aquí';
begin
  if jur_permiso(p_codigo, p_area, p_nivel) then return; end if;
  if p_nivel = 'ver' then msg := 'Tu acceso no incluye esta pestaña'; end if;
  if not exists (select 1 from jur_coordinadores where codigo = jur_norm(p_codigo)) then msg := 'Código de administrador incorrecto'; end if;
  perform pg_sleep(0.4);
  raise exception '%', msg using errcode = '28000';
end $$;

-- Logística: «editar» para guardar/borrar; «ver» para leer
create or replace function public.jur_exigir_logistica(p_codigo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_permiso(p_codigo, 'logistica', 'editar');
end $$;

-- Cambia la validación de cada función de admin por la del permiso que corresponde
do $$
declare r record; def text; nuevo text;
begin
  for r in select * from (values
    ('jur_admin_ajuste', 'resultados', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_borrar_calificaciones', 'resultados', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_manual', 'resultados', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_conocimientos', 'resultados', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_conoc_exportar', 'resultados', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_conoc_reiniciar', 'resultados', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_concurso', 'vivo', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_jurado', 'jurados', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_tallerista', 'talleristas', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_taller', 'talleristas', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_taller_borrar', 'talleristas', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_charla', 'charlas', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_preguntas', 'charlas', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_asistentes', 'charlas', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_quiz', 'charlas', 'ver', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_delegacion', 'delegaciones', 'editar', 'perform jur_exigir_admin(p_codigo);'),
    ('jur_admin_logistica', 'logistica', 'ver', 'perform jur_exigir_logistica(p_codigo);'),
    ('jur_admin_log_archivo', 'logistica', 'ver', 'perform jur_exigir_logistica(p_codigo);')
  ) as t(fn, area, nivel, viejo) loop
    select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = r.fn;
    if def is null then raise exception 'No existe %', r.fn; end if;
    nuevo := replace(def, r.viejo, format('perform jur_exigir_permiso(p_codigo, %L, %L);', r.area, r.nivel));
    if nuevo = def and position('jur_exigir_permiso' in def) = 0 then raise exception 'No se encontró la validación en %', r.fn; end if;
    execute nuevo;
  end loop;
end $$;

-- Datos del panel: el admin ve todo; un acceso limitado solo lo de sus pestañas (sin códigos si solo puede ver)
create or replace function public.jur_admin_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare adm boolean := jur_es_admin(p_codigo); k jur_coordinadores; p jsonb := '{}'; cc text[] := '{}';
  ver_res boolean; ver_jur boolean; ed_jur boolean; ver_tal boolean; ed_tal boolean;
begin
  if not adm then
    select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
    if not found then perform pg_sleep(0.4); raise exception 'Código de administrador incorrecto' using errcode = '28000'; end if;
    p := k.permisos; cc := k.concursos;
  end if;
  ver_res := adm or coalesce(p->>'vivo', '') in ('ver', 'editar') or coalesce(p->>'resultados', '') in ('ver', 'editar') or coalesce(p->>'copa', '') in ('ver', 'editar');
  ver_jur := adm or coalesce(p->>'jurados', '') in ('ver', 'editar'); ed_jur := adm or p->>'jurados' = 'editar';
  ver_tal := adm or coalesce(p->>'talleristas', '') in ('ver', 'editar'); ed_tal := adm or p->>'talleristas' = 'editar';
  return json_build_object(
    'concursos', (select json_agg(json_build_object('id', id, 'abierto', abierto)) from jur_concursos),
    'delegaciones', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'siglas', siglas) order by nombre) from jur_delegaciones), '[]'),
    'jurados', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'codigo', case when ed_jur then codigo end, 'concursos', concursos,
        'foto', foto, 'descripcion', descripcion) order by creado) from jur_jurados where ver_jur or ver_res or concursos && cc), '[]'),
    'calificaciones', coalesce((select json_agg(json_build_object('id', id, 'concurso_id', concurso_id, 'subprueba', subprueba,
        'delegacion_id', delegacion_id, 'jurado_id', jurado_id, 'datos', datos, 'total', total, 'comentario', comentario,
        'actualizado', actualizado) order by actualizado desc) from jur_calificaciones where ver_res or concurso_id = any(cc)), '[]'),
    'ajustes', coalesce((select json_agg(json_build_object('concurso_id', concurso_id, 'delegacion_id', delegacion_id,
        'retraso', retraso, 'walkover', walkover, 'descalificado', descalificado, 'valor', valor, 'nota', nota,
        'datos', datos, 'actualizado', actualizado)) from jur_ajustes where ver_res or concurso_id = any(cc)), '[]'),
    'borrados', coalesce((select json_agg(json_build_object('id', id, 'concurso_id', concurso_id, 'subprueba', subprueba,
        'delegacion', delegacion, 'jurado', jurado, 'total', total, 'motivo', motivo, 'borrado', borrado) order by borrado desc) from jur_borrados where ver_res), '[]'),
    'talleres', (select json_agg(json_build_object('id', id, 'abierto', abierto)) from jur_talleres),
    'talleristas', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'codigo', case when ed_tal then codigo end, 'talleres', talleres,
        'foto', foto, 'descripcion', descripcion) order by creado) from jur_talleristas where ver_tal), '[]'),
    'ganadores_talleres', coalesce((select json_agg(json_build_object('taller_id', taller_id, 'integrantes', integrantes,
        'tallerista', tallerista, 'actualizado', actualizado)) from jur_taller_ganadores where ver_tal or ver_res), '[]'),
    'charlas', (select json_agg(json_build_object('id', c.id, 'fase', jur_quiz_fase(c), 'seg', c.seg_pregunta, 'confirmado', c.confirmado,
        'ganador_nombre', c.ganador_nombre, 'ganador_delegacion', c.ganador_delegacion, 'podio', c.podio,
        'preguntas', (select count(*) from jur_preguntas q where q.charla_id = c.id),
        'jugadores', (select count(*) from jur_quiz_jugadores j where j.charla_id = c.id)) order by c.id) from jur_charlas c),
    'asistentes', json_build_object('total', (select count(*) from jur_asistentes),
        'sin_delegacion', (select count(*) from jur_asistentes where delegacion_id is null))
  );
end $$;

create or replace function public.jur_coord_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores;
begin
  select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
  if not found then perform pg_sleep(0.4); raise exception 'Código de coordinador incorrecto' using errcode = '28000'; end if;
  return json_build_object(
    'coordinador', json_build_object('id', k.id, 'nombre', k.nombre, 'concursos', k.concursos, 'logistica', k.logistica, 'permisos', k.permisos),
    'delegaciones', coalesce((select json_agg(json_build_object('id', d.id, 'nombre', d.nombre, 'siglas', d.siglas) order by d.nombre) from jur_delegaciones d), '[]'),
    'jurados', coalesce((select json_agg(json_build_object('id', j.id, 'nombre', j.nombre, 'concursos', j.concursos)) from jur_jurados j where j.concursos && k.concursos), '[]'),
    'calificaciones', coalesce((select json_agg(json_build_object('id', c.id, 'concurso_id', c.concurso_id, 'subprueba', c.subprueba, 'delegacion_id', c.delegacion_id,
        'jurado_id', c.jurado_id, 'datos', c.datos, 'total', c.total, 'comentario', c.comentario, 'actualizado', c.actualizado))
      from jur_calificaciones c where c.concurso_id = any(k.concursos)), '[]'),
    'ajustes', coalesce((select json_agg(to_json(a)) from jur_ajustes a where a.concurso_id = any(k.concursos)), '[]'));
end $$;

create or replace function public.jur_admin_coordinadores(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return coalesce((select json_agg(json_build_object('id', k.id, 'nombre', k.nombre, 'codigo', k.codigo, 'concursos', k.concursos,
    'logistica', k.logistica, 'permisos', k.permisos) order by k.nombre) from jur_coordinadores k), '[]');
end $$;

-- Crear / editar / quitar un acceso (solo el admin). Reemplaza la versión de 7 parámetros.
drop function if exists public.jur_admin_coordinador(text, uuid, text, text[], boolean, text, boolean);
create or replace function public.jur_admin_coordinador(p_codigo text, p_id uuid, p_nombre text, p_concursos text[],
  p_borrar boolean default false, p_codigo_fijo text default null, p_permisos jsonb default '{}'::jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; fijo text := nullif(jur_norm(p_codigo_fijo), ''); cc text[] := coalesce(p_concursos, '{}');
  pp jsonb := '{}'::jsonb; r record;
begin
  perform jur_exigir_admin(p_codigo);
  if p_borrar then delete from jur_coordinadores where id = p_id; return null; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe el nombre'; end if;
  for r in select key, value from jsonb_each_text(coalesce(p_permisos, '{}'::jsonb)) loop
    if r.key not in ('vivo', 'resultados', 'copa', 'jurados', 'talleristas', 'charlas', 'delegaciones', 'logistica') then raise exception 'Pestaña no válida: %', r.key; end if;
    if r.value in ('ver', 'editar') then pp := pp || jsonb_build_object(r.key, r.value);
    elsif r.value not in ('', 'no') then raise exception 'Permiso no válido: %', r.value; end if;
  end loop;
  if coalesce(array_length(cc, 1), 0) = 0 and pp = '{}'::jsonb then raise exception 'Elige al menos una pestaña o un concurso de Entregas'; end if;
  if exists (select 1 from unnest(cc) x where not exists (select 1 from jur_concursos c where c.id = x)) then raise exception 'Concurso no válido'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otro jurado, tallerista, equipo o coordinador'; end if;
  end if;
  if p_id is null then
    insert into jur_coordinadores (nombre, codigo, concursos, logistica, permisos)
      values (left(trim(p_nombre), 120), coalesce(fijo, jur_nuevo_codigo()), cc, coalesce(pp->>'logistica', '') = 'editar', pp) returning * into k;
  else
    update jur_coordinadores set nombre = left(trim(p_nombre), 120), concursos = cc, permisos = pp,
      logistica = coalesce(pp->>'logistica', '') = 'editar', codigo = coalesce(fijo, codigo) where id = p_id returning * into k;
    if not found then raise exception 'Ese acceso ya no existe'; end if;
  end if;
  return json_build_object('id', k.id, 'codigo', k.codigo);
end $$;

revoke all on function public.jur_permiso(text, text, text), public.jur_exigir_permiso(text, text, text), public.jur_exigir_logistica(text) from public, anon, authenticated;

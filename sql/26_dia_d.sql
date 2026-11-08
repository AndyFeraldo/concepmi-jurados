-- Migración jur_26_dia_d (aplicada en Supabase)
-- Día D: quién hace qué, dónde y a qué hora el día del evento. Las personas son los
-- accesos limitados (jur_coordinadores); un «voluntario» es un acceso con permisos {diad: ver}
-- que solo ve su guía personal. Solo agrega tablas, columnas y funciones.

alter table public.jur_coordinadores add column if not exists area text;
alter table public.jur_coordinadores add column if not exists telefono text;

create table if not exists public.jur_diad_tareas (
  id uuid primary key default gen_random_uuid(),
  dia text not null default 'd1' check (dia in ('d1', 'd2')),
  hora_ini text not null default '',
  hora_fin text not null default '',
  bloque text not null default '',
  rol text not null default '',
  tipo text not null default 'general' check (tipo in ('academico', 'cultural', 'general', 'escenario')),
  concurso_id text,
  lugar text not null default '',
  llegar_min int not null default 10 check (llegar_min between 0 and 240),
  indicaciones text not null default '',
  personas uuid[] not null default '{}',
  orden int not null default 0,
  actualizado timestamptz not null default now()
);
create table if not exists public.jur_diad_config (clave text primary key, datos jsonb not null default '{}'::jsonb, actualizado timestamptz not null default now());
alter table public.jur_diad_tareas enable row level security;
alter table public.jur_diad_config enable row level security;
revoke all on public.jur_diad_tareas, public.jur_diad_config from anon, authenticated;

-- Permiso «diad» (voluntario: solo su guía) en los accesos limitados
do $m$ begin
  execute replace(pg_get_functiondef('public.jur_admin_coordinador(text,uuid,text,text[],boolean,text,jsonb)'::regprocedure),
    $a$'logistica', 'proyeccion') then$a$, $a$'logistica', 'proyeccion', 'diad') then$a$);
end $m$;

-- Una tarea en JSON (con solo las personas que siguen existiendo)
create or replace function public.jur_diad_tarea_json(t public.jur_diad_tareas) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', t.id, 'dia', t.dia, 'hora_ini', t.hora_ini, 'hora_fin', t.hora_fin, 'bloque', t.bloque, 'rol', t.rol,
    'tipo', t.tipo, 'concurso_id', t.concurso_id, 'lugar', t.lugar, 'llegar_min', t.llegar_min, 'indicaciones', t.indicaciones, 'orden', t.orden,
    'personas', coalesce((select json_agg(k.id order by k.nombre) from jur_coordinadores k where k.id = any(t.personas)), '[]'));
$$;
revoke all on function public.jur_diad_tarea_json(public.jur_diad_tareas) from public, anon, authenticated;

-- Admin: todo el Día D
create or replace function public.jur_admin_diad(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return json_build_object(
    'tareas', coalesce((select json_agg(jur_diad_tarea_json(t) order by t.dia, t.orden, t.hora_ini) from jur_diad_tareas t), '[]'),
    'personas', coalesce((select json_agg(json_build_object('id', k.id, 'nombre', k.nombre, 'codigo', k.codigo, 'concursos', k.concursos,
      'logistica', k.logistica, 'permisos', k.permisos, 'area', k.area, 'telefono', k.telefono) order by k.nombre) from jur_coordinadores k), '[]'),
    'config', coalesce((select datos from jur_diad_config where clave = 'general'), '{}'::jsonb));
end $$;

-- Admin: crear, editar o borrar una tarea
create or replace function public.jur_admin_diad_tarea(p_codigo text, p_id uuid, p_datos jsonb, p_borrar boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare t jur_diad_tareas; d jsonb := coalesce(p_datos, '{}'::jsonb); pp uuid[]; v_tipo text; v_dia text;
begin
  perform jur_exigir_admin(p_codigo);
  if p_borrar then delete from jur_diad_tareas where id = p_id; return null; end if;
  if length(trim(coalesce(d->>'rol', ''))) < 2 and length(trim(coalesce(d->>'bloque', ''))) < 2 then raise exception 'Escribe el momento o la función'; end if;
  v_tipo := coalesce(nullif(d->>'tipo', ''), 'general'); v_dia := coalesce(nullif(d->>'dia', ''), 'd1');
  if v_tipo not in ('academico', 'cultural', 'general', 'escenario') then raise exception 'Tipo no válido'; end if;
  if v_dia not in ('d1', 'd2') then raise exception 'Día no válido'; end if;
  if d->>'concurso_id' is not null and d->>'concurso_id' <> '' and not exists (select 1 from jur_concursos where id = d->>'concurso_id') then raise exception 'Concurso no válido'; end if;
  select coalesce(array_agg(k.id), '{}') into pp from jur_coordinadores k
    where k.id in (select x::uuid from jsonb_array_elements_text(coalesce(d->'personas', '[]'::jsonb)) x);
  if p_id is null then
    insert into jur_diad_tareas (dia, hora_ini, hora_fin, bloque, rol, tipo, concurso_id, lugar, llegar_min, indicaciones, personas, orden)
    values (v_dia, left(coalesce(d->>'hora_ini', ''), 20), left(coalesce(d->>'hora_fin', ''), 20), left(trim(coalesce(d->>'bloque', '')), 160),
      left(trim(coalesce(d->>'rol', '')), 160), v_tipo, nullif(d->>'concurso_id', ''), left(trim(coalesce(d->>'lugar', '')), 160),
      least(greatest(coalesce((d->>'llegar_min')::int, 10), 0), 240), left(coalesce(d->>'indicaciones', ''), 3000), pp,
      coalesce((d->>'orden')::int, (select coalesce(max(orden), 0) + 1 from jur_diad_tareas)))
    returning * into t;
  else
    update jur_diad_tareas set dia = v_dia, hora_ini = left(coalesce(d->>'hora_ini', ''), 20), hora_fin = left(coalesce(d->>'hora_fin', ''), 20),
      bloque = left(trim(coalesce(d->>'bloque', '')), 160), rol = left(trim(coalesce(d->>'rol', '')), 160), tipo = v_tipo,
      concurso_id = nullif(d->>'concurso_id', ''), lugar = left(trim(coalesce(d->>'lugar', '')), 160),
      llegar_min = least(greatest(coalesce((d->>'llegar_min')::int, 10), 0), 240), indicaciones = left(coalesce(d->>'indicaciones', ''), 3000),
      personas = pp, orden = coalesce((d->>'orden')::int, orden), actualizado = now()
    where id = p_id returning * into t;
    if not found then raise exception 'Esa tarea ya no existe'; end if;
  end if;
  return jur_diad_tarea_json(t);
end $$;

-- Admin: cargar varias tareas de una vez (cronograma sugerido)
create or replace function public.jur_admin_diad_cargar(p_codigo text, p_lista jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare x jsonb; n int := 0;
begin
  perform jur_exigir_admin(p_codigo);
  if jsonb_typeof(p_lista) <> 'array' or jsonb_array_length(p_lista) > 120 then raise exception 'Lista no válida'; end if;
  for x in select * from jsonb_array_elements(p_lista) loop
    perform jur_admin_diad_tarea(p_codigo, null, x || jsonb_build_object('orden', n + 1 + (select coalesce(max(orden), 0) from jur_diad_tareas)));
    n := n + 1;
  end loop;
  return n;
end $$;

-- Admin: datos generales (punto de encuentro, contacto de emergencia, mensaje, recomendaciones)
create or replace function public.jur_admin_diad_config(p_codigo text, p_datos jsonb) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  if length(coalesce(p_datos, '{}'::jsonb)::text) > 20000 then raise exception 'Demasiado texto'; end if;
  insert into jur_diad_config (clave, datos, actualizado) values ('general', coalesce(p_datos, '{}'::jsonb), now())
  on conflict (clave) do update set datos = excluded.datos, actualizado = now();
  return coalesce(p_datos, '{}'::jsonb)::json;
end $$;

-- Admin: área y teléfono de una persona
create or replace function public.jur_admin_diad_persona(p_codigo text, p_id uuid, p_area text, p_telefono text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  update jur_coordinadores set area = nullif(left(trim(coalesce(p_area, '')), 60), ''), telefono = nullif(left(trim(coalesce(p_telefono, '')), 30), '') where id = p_id;
  if not found then raise exception 'Esa persona ya no existe'; end if;
  return json_build_object('ok', true);
end $$;

-- Persona con su código: su guía del Día D (sus tareas, compañeros con teléfono y datos generales)
create or replace function public.jur_diad_mio(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores;
begin
  select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
  if not found then perform pg_sleep(0.4); raise exception 'Código incorrecto' using errcode = '28000'; end if;
  return json_build_object(
    'yo', json_build_object('id', k.id, 'nombre', k.nombre, 'area', k.area, 'concursos', k.concursos, 'permisos', k.permisos),
    'tareas', coalesce((select json_agg(json_build_object('id', t.id, 'dia', t.dia, 'hora_ini', t.hora_ini, 'hora_fin', t.hora_fin, 'bloque', t.bloque,
        'rol', t.rol, 'tipo', t.tipo, 'concurso_id', t.concurso_id, 'lugar', t.lugar, 'llegar_min', t.llegar_min, 'indicaciones', t.indicaciones,
        'equipo', coalesce((select json_agg(json_build_object('nombre', o.nombre, 'area', o.area, 'telefono', o.telefono) order by o.nombre)
                            from jur_coordinadores o where o.id = any(t.personas) and o.id <> k.id), '[]'))
      order by t.dia, t.orden, t.hora_ini) from jur_diad_tareas t where k.id = any(t.personas)), '[]'),
    'agenda', coalesce((select json_agg(json_build_object('dia', a.dia, 'hora_ini', a.hora_ini, 'hora_fin', a.hora_fin, 'bloque', a.bloque, 'lugar', a.lugar) order by a.dia, a.o)
      from (select dia, hora_ini, hora_fin, bloque, max(lugar) lugar, min(orden) o from jur_diad_tareas where bloque <> '' group by dia, hora_ini, hora_fin, bloque) a), '[]'),
    'config', coalesce((select datos from jur_diad_config where clave = 'general'), '{}'::jsonb));
end $$;

revoke all on function public.jur_admin_diad(text), public.jur_admin_diad_tarea(text, uuid, jsonb, boolean), public.jur_admin_diad_cargar(text, jsonb),
  public.jur_admin_diad_config(text, jsonb), public.jur_admin_diad_persona(text, uuid, text, text), public.jur_diad_mio(text) from public;
grant execute on function public.jur_admin_diad(text), public.jur_admin_diad_tarea(text, uuid, jsonb, boolean), public.jur_admin_diad_cargar(text, jsonb),
  public.jur_admin_diad_config(text, jsonb), public.jur_admin_diad_persona(text, uuid, text, text), public.jur_diad_mio(text) to anon, authenticated;

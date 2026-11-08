-- Migración jur_27_dia_d_voluntarios (aplicada en Supabase)
-- Día D: mini base de datos de voluntarios (importada de Excel) con su disponibilidad por día y hora.
-- Los voluntarios siguen siendo accesos limitados (jur_coordinadores con permisos {diad: ver}).
-- Solo agrega columnas y funciones.

alter table public.jur_coordinadores add column if not exists nombres text;
alter table public.jur_coordinadores add column if not exists paterno text;
alter table public.jur_coordinadores add column if not exists materno text;
-- disponibilidad: {"d1": [[inicio, fin], ...], "d2": [...]} en minutos desde medianoche (510 = 8:30 a. m.)
alter table public.jur_coordinadores add column if not exists disponibilidad jsonb not null default '{}'::jsonb;

-- Código nuevo que no use nadie (jurados, talleristas, equipos, accesos ni ponentes)
create or replace function public.jur_codigo_libre() returns text
language plpgsql security definer set search_path = public as $$
declare c text;
begin
  loop c := jur_nuevo_codigo(); exit when not jur_codigo_usado(c) and not jur_es_admin(c); end loop;
  return c;
end $$;
revoke all on function public.jur_codigo_libre() from public, anon, authenticated;

-- Disponibilidad válida: solo d1/d2, tramos [inicio, fin] con 0 <= inicio < fin <= 1440
create or replace function public.jur_diad_disp_limpia(p jsonb) returns jsonb
language sql immutable set search_path = public as $$
  select coalesce(jsonb_object_agg(d, tramos), '{}'::jsonb) from (
    select d, coalesce((select jsonb_agg(jsonb_build_array((x->>0)::int, (x->>1)::int) order by (x->>0)::int)
                        from jsonb_array_elements(coalesce(p->d, '[]'::jsonb)) x
                        where jsonb_typeof(x) = 'array' and case when (x->>0) ~ '^\d{1,4}$' and (x->>1) ~ '^\d{1,4}$'
                          then (x->>1)::int <= 1440 and (x->>0)::int < (x->>1)::int else false end), '[]'::jsonb) tramos
    from unnest(array['d1', 'd2']) d where p ? d) s;
$$;
revoke all on function public.jur_diad_disp_limpia(jsonb) from public, anon, authenticated;

-- Admin: todo el Día D (ahora con nombres, apellidos y disponibilidad de cada persona)
create or replace function public.jur_admin_diad(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return json_build_object(
    'tareas', coalesce((select json_agg(jur_diad_tarea_json(t) order by t.dia, t.orden, t.hora_ini) from jur_diad_tareas t), '[]'),
    'personas', coalesce((select json_agg(json_build_object('id', k.id, 'nombre', k.nombre, 'codigo', k.codigo, 'concursos', k.concursos,
      'logistica', k.logistica, 'permisos', k.permisos, 'area', k.area, 'telefono', k.telefono, 'nombres', k.nombres, 'paterno', k.paterno,
      'materno', k.materno, 'disponibilidad', k.disponibilidad) order by k.nombre) from jur_coordinadores k), '[]'),
    'config', coalesce((select datos from jur_diad_config where clave = 'general'), '{}'::jsonb));
end $$;

-- Admin: crear o editar un voluntario (solo cambia los campos que vienen)
create or replace function public.jur_admin_diad_voluntario(p_codigo text, p_id uuid, p_datos jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; d jsonb := coalesce(p_datos, '{}'::jsonb); v_nombre text; fijo text := nullif(jur_norm(d->>'codigo'), '');
begin
  perform jur_exigir_admin(p_codigo);
  if d ? 'nombres' or d ? 'paterno' or d ? 'materno' then
    v_nombre := left(trim(regexp_replace(concat_ws(' ', nullif(trim(d->>'nombres'), ''), nullif(trim(d->>'paterno'), ''), nullif(trim(d->>'materno'), '')), '\s+', ' ', 'g')), 120);
    if length(coalesce(v_nombre, '')) < 2 then raise exception 'Escribe el nombre'; end if;
  end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otra persona'; end if;
  end if;
  if p_id is null then
    if v_nombre is null then raise exception 'Escribe el nombre'; end if;
    insert into jur_coordinadores (nombre, codigo, concursos, logistica, permisos) values (v_nombre, coalesce(fijo, jur_codigo_libre()), '{}', false, '{"diad": "ver"}'::jsonb)
      returning * into k;
  else
    select * into k from jur_coordinadores where id = p_id;
    if not found then raise exception 'Esa persona ya no existe'; end if;
  end if;
  update jur_coordinadores set
    nombre = coalesce(v_nombre, nombre),
    nombres = case when d ? 'nombres' then nullif(left(trim(d->>'nombres'), 80), '') else nombres end,
    paterno = case when d ? 'paterno' then nullif(left(trim(d->>'paterno'), 60), '') else paterno end,
    materno = case when d ? 'materno' then nullif(left(trim(d->>'materno'), 60), '') else materno end,
    area = case when d ? 'area' then nullif(left(trim(d->>'area'), 60), '') else area end,
    telefono = case when d ? 'telefono' then nullif(left(trim(d->>'telefono'), 30), '') else telefono end,
    disponibilidad = case when d ? 'disponibilidad' then disponibilidad || jur_diad_disp_limpia(d->'disponibilidad') else disponibilidad end,
    codigo = coalesce(fijo, codigo)
  where id = k.id returning * into k;
  return json_build_object('id', k.id, 'nombre', k.nombre, 'codigo', k.codigo, 'concursos', k.concursos, 'logistica', k.logistica, 'permisos', k.permisos,
    'area', k.area, 'telefono', k.telefono, 'nombres', k.nombres, 'paterno', k.paterno, 'materno', k.materno, 'disponibilidad', k.disponibilidad);
end $$;

-- Admin: importar voluntarios del Excel. Si el nombre completo ya existe, actualiza sus datos; si no, lo crea con su código.
create or replace function public.jur_admin_diad_importar(p_codigo text, p_lista jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare x jsonb; v_nombre text; v_id uuid; nuevos int := 0; actualizados int := 0;
begin
  perform jur_exigir_admin(p_codigo);
  if jsonb_typeof(p_lista) <> 'array' or jsonb_array_length(p_lista) > 400 then raise exception 'Lista no válida (máximo 400 personas)'; end if;
  for x in select * from jsonb_array_elements(p_lista) loop
    v_nombre := left(trim(regexp_replace(concat_ws(' ', nullif(trim(x->>'nombres'), ''), nullif(trim(x->>'paterno'), ''), nullif(trim(x->>'materno'), '')), '\s+', ' ', 'g')), 120);
    continue when length(coalesce(v_nombre, '')) < 2;
    select id into v_id from jur_coordinadores where lower(nombre) = lower(v_nombre) limit 1;
    if v_id is null then
      insert into jur_coordinadores (nombre, codigo, concursos, logistica, permisos) values (v_nombre, jur_codigo_libre(), '{}', false, '{"diad": "ver"}'::jsonb) returning id into v_id;
      nuevos := nuevos + 1;
    else
      actualizados := actualizados + 1;
    end if;
    update jur_coordinadores set nombres = coalesce(nullif(left(trim(x->>'nombres'), 80), ''), nombres),
      paterno = coalesce(nullif(left(trim(x->>'paterno'), 60), ''), paterno), materno = coalesce(nullif(left(trim(x->>'materno'), 60), ''), materno),
      area = coalesce(nullif(left(trim(x->>'area'), 60), ''), area), telefono = coalesce(nullif(left(trim(x->>'telefono'), 30), ''), telefono)
    where id = v_id;
  end loop;
  return json_build_object('nuevos', nuevos, 'actualizados', actualizados);
end $$;

revoke all on function public.jur_admin_diad_voluntario(text, uuid, jsonb), public.jur_admin_diad_importar(text, jsonb) from public;
grant execute on function public.jur_admin_diad_voluntario(text, uuid, jsonb), public.jur_admin_diad_importar(text, jsonb) to anon, authenticated;

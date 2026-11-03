-- =========================================================
-- Coordinadores de sala (migración jur_11_coordinadores). Solo agrega una tabla y funciones.
-- Un coordinador entra con su propio código y SOLO maneja las Entregas de sus concursos
-- (códigos de equipo, tiempo, proyección, reabrir). No ve ni toca nada más del admin.
-- =========================================================
create table if not exists public.jur_coordinadores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  concursos text[] not null default '{}',
  creado timestamptz not null default now()
);
alter table public.jur_coordinadores enable row level security;
revoke all on public.jur_coordinadores from anon, authenticated;

-- Los códigos siguen siendo únicos entre jurados, talleristas, equipos y coordinadores
create or replace function public.jur_codigo_usado(p text, p_excepto uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jur_jurados where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_talleristas where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_equipos where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_coordinadores where codigo = p and id is distinct from p_excepto);
$$;

create or replace function public.jur_entrar(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados; t jur_talleristas; e jur_equipos; k jur_coordinadores;
begin
  if jur_es_admin(p_codigo) then return json_build_object('rol', 'admin'); end if;
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'jurado', 'nombre', j.nombre); end if;
  select * into t from jur_talleristas where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'tallerista', 'nombre', t.nombre); end if;
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'equipo', 'nombre', e.nombre); end if;
  select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'coordinador', 'nombre', k.nombre); end if;
  perform pg_sleep(0.4);
  return null;
end $$;

-- Admin, o coordinador asignado a ese concurso
create or replace function public.jur_exigir_sala(p_codigo text, p_concurso text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if jur_es_admin(p_codigo) then return; end if;
  if exists (select 1 from jur_coordinadores where codigo = jur_norm(p_codigo) and p_concurso = any(concursos)) then return; end if;
  perform pg_sleep(0.4);
  raise exception 'Este código no puede manejar las entregas de este concurso' using errcode = '28000';
end $$;

-- ---------- Las funciones de Entregas ahora aceptan admin o coordinador del concurso ----------
create or replace function public.jur_admin_entregas(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_sala(p_codigo, p_concurso);
  return json_build_object('tiempo', jur_tiempo_json(p_concurso),
    'equipos', coalesce((select json_agg(json_build_object('id', e.id, 'codigo', e.codigo, 'entrega', jur_entrega_json(e)) order by d.nombre)
      from jur_equipos e join jur_delegaciones d on d.id = e.delegacion_id where e.concurso_id = p_concurso), '[]'));
end $$;

create or replace function public.jur_admin_equipo(p_codigo text, p_id uuid, p_concurso text, p_delegacion uuid, p_nombre text, p_lider text,
  p_borrar boolean default false, p_nuevo_codigo boolean default false, p_codigo_fijo text default null) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; previo jur_equipos; fijo text := nullif(jur_norm(p_codigo_fijo), '');
begin
  if p_id is not null then
    select * into previo from jur_equipos where id = p_id;
    if not found then raise exception 'Ese equipo ya no existe'; end if;
    perform jur_exigir_sala(p_codigo, previo.concurso_id);
  end if;
  perform jur_exigir_sala(p_codigo, p_concurso);
  if p_borrar then delete from jur_equipos where id = p_id; return null; end if;
  if not exists (select 1 from jur_concursos where id = p_concurso) then raise exception 'Concurso no válido'; end if;
  if not exists (select 1 from jur_delegaciones where id = p_delegacion) then raise exception 'Elige la delegación'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otro jurado, tallerista, equipo o coordinador'; end if;
  end if;
  if exists (select 1 from jur_equipos where concurso_id = p_concurso and delegacion_id = p_delegacion and id is distinct from p_id) then
    raise exception 'Esa delegación ya tiene un equipo en este concurso';
  end if;
  if p_id is null then
    insert into jur_equipos (concurso_id, delegacion_id, nombre, lider, codigo)
    values (p_concurso, p_delegacion, left(trim(coalesce(p_nombre, '')), 120), left(trim(coalesce(p_lider, '')), 120), coalesce(fijo, jur_nuevo_codigo()))
    returning * into e;
  else
    update jur_equipos set delegacion_id = p_delegacion, nombre = left(trim(coalesce(p_nombre, '')), 120), lider = left(trim(coalesce(p_lider, '')), 120),
      codigo = case when fijo is not null then fijo when p_nuevo_codigo then jur_nuevo_codigo() else codigo end
    where id = p_id returning * into e;
  end if;
  return json_build_object('id', e.id, 'codigo', e.codigo);
end $$;

create or replace function public.jur_admin_tiempo(p_codigo text, p_concurso text, p_accion text, p_minutos int default 35) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_sala(p_codigo, p_concurso);
  if p_accion = 'iniciar' then
    insert into jur_concurso_tiempo (concurso_id, inicio, fin) values (p_concurso, now(), now() + make_interval(mins => p_minutos))
    on conflict (concurso_id) do update set inicio = now(), fin = now() + make_interval(mins => p_minutos);
  elsif p_accion = 'extender' then
    update jur_concurso_tiempo set fin = greatest(fin, now()) + make_interval(mins => p_minutos) where concurso_id = p_concurso;
  elsif p_accion = 'detener' then
    update jur_concurso_tiempo set fin = now() where concurso_id = p_concurso;
  elsif p_accion = 'reiniciar' then
    update jur_concurso_tiempo set inicio = null, fin = null where concurso_id = p_concurso;
  else raise exception 'Acción no válida';
  end if;
end $$;

create or replace function public.jur_admin_entrega_reabrir(p_codigo text, p_equipo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_concurso text;
begin
  select concurso_id into v_concurso from jur_equipos where id = p_equipo;
  if v_concurso is null then raise exception 'Ese equipo ya no existe'; end if;
  perform jur_exigir_sala(p_codigo, v_concurso);
  update jur_entregas set estado = 'borrador', enviado = null, tarde = false, actualizado = now() where equipo_id = p_equipo;
end $$;

-- ---------- Datos del coordinador: solo lo de sus concursos (sin códigos de jurados) ----------
create or replace function public.jur_coord_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores;
begin
  select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
  if not found then perform pg_sleep(0.4); raise exception 'Código de coordinador incorrecto' using errcode = '28000'; end if;
  return json_build_object(
    'coordinador', json_build_object('id', k.id, 'nombre', k.nombre, 'concursos', k.concursos),
    'delegaciones', coalesce((select json_agg(json_build_object('id', d.id, 'nombre', d.nombre, 'siglas', d.siglas) order by d.nombre) from jur_delegaciones d), '[]'),
    'jurados', coalesce((select json_agg(json_build_object('id', j.id, 'nombre', j.nombre, 'concursos', j.concursos)) from jur_jurados j where j.concursos && k.concursos), '[]'),
    'calificaciones', coalesce((select json_agg(json_build_object('id', c.id, 'concurso_id', c.concurso_id, 'subprueba', c.subprueba, 'delegacion_id', c.delegacion_id,
        'jurado_id', c.jurado_id, 'datos', c.datos, 'total', c.total, 'comentario', c.comentario, 'actualizado', c.actualizado))
      from jur_calificaciones c where c.concurso_id = any(k.concursos)), '[]'),
    'ajustes', coalesce((select json_agg(to_json(a)) from jur_ajustes a where a.concurso_id = any(k.concursos)), '[]'));
end $$;

-- ---------- Admin: crear, editar y quitar coordinadores ----------
create or replace function public.jur_admin_coordinadores(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return coalesce((select json_agg(json_build_object('id', k.id, 'nombre', k.nombre, 'codigo', k.codigo, 'concursos', k.concursos) order by k.nombre) from jur_coordinadores k), '[]');
end $$;

create or replace function public.jur_admin_coordinador(p_codigo text, p_id uuid, p_nombre text, p_concursos text[],
  p_borrar boolean default false, p_codigo_fijo text default null) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; fijo text := nullif(jur_norm(p_codigo_fijo), '');
begin
  perform jur_exigir_admin(p_codigo);
  if p_borrar then delete from jur_coordinadores where id = p_id; return null; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe el nombre del coordinador'; end if;
  if coalesce(array_length(p_concursos, 1), 0) = 0 then raise exception 'Elige al menos un concurso'; end if;
  if exists (select 1 from unnest(p_concursos) x where not exists (select 1 from jur_concursos c where c.id = x)) then raise exception 'Concurso no válido'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otro jurado, tallerista, equipo o coordinador'; end if;
  end if;
  if p_id is null then
    insert into jur_coordinadores (nombre, codigo, concursos) values (left(trim(p_nombre), 120), coalesce(fijo, jur_nuevo_codigo()), p_concursos) returning * into k;
  else
    update jur_coordinadores set nombre = left(trim(p_nombre), 120), concursos = p_concursos, codigo = coalesce(fijo, codigo) where id = p_id returning * into k;
    if not found then raise exception 'Ese coordinador ya no existe'; end if;
  end if;
  return json_build_object('id', k.id, 'codigo', k.codigo);
end $$;

revoke all on function public.jur_exigir_sala(text, text) from public, anon, authenticated;
grant execute on function public.jur_coord_datos(text), public.jur_admin_coordinadores(text),
  public.jur_admin_coordinador(text, uuid, text, text[], boolean, text) to anon, authenticated;

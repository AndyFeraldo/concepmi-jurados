-- =========================================================
-- Talleres y talleristas (migración jur_05_talleres)
-- Solo agrega tablas y funciones. No borra datos existentes.
-- Cada integrante del equipo ganador suma 40 pts a su delegación
-- (una vez por delegación y por taller). El cálculo está en js/calculo.js.
-- =========================================================

create table if not exists public.jur_talleres (
  id text primary key,
  nombre text not null,
  abierto boolean not null default true
);
insert into public.jur_talleres (id, nombre) values
  ('t1', 'Taller I · IA Generativa & Prompt Engineering'),
  ('t2', 'Taller II · Frameworks Ágiles & Gestión Orientada al Valor'),
  ('t3', 'Taller III · Clínica de CV & Empleabilidad 4.0'),
  ('t4', 'Taller IV · Power Skills & Pitch Ejecutivo')
on conflict (id) do nothing;

create table if not exists public.jur_talleristas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  talleres text[] not null default '{}',
  descripcion text not null default '',
  foto text not null default '',
  creado timestamptz not null default now()
);

-- Un equipo ganador por taller: [{ "nombre": "...", "delegacion": "uuid" }, ...]
create table if not exists public.jur_taller_ganadores (
  taller_id text primary key references public.jur_talleres(id),
  integrantes jsonb not null default '[]',
  tallerista text not null default '',
  actualizado timestamptz not null default now()
);

alter table public.jur_talleres enable row level security;
alter table public.jur_talleristas enable row level security;
alter table public.jur_taller_ganadores enable row level security;
revoke all on public.jur_talleres, public.jur_talleristas, public.jur_taller_ganadores from anon, authenticated;

-- ¿El código ya lo usa alguien (jurado o tallerista)?
create or replace function public.jur_codigo_usado(p text, p_excepto uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jur_jurados where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_talleristas where codigo = p and id is distinct from p_excepto);
$$;

create or replace function public.jur_nuevo_codigo() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(a, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(a)), 1);
    end loop;
    exit when not jur_codigo_usado(c);
  end loop;
  return c;
end $$;

create or replace function public.jur_entrar(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados; t jur_talleristas;
begin
  if jur_es_admin(p_codigo) then return json_build_object('rol', 'admin'); end if;
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'jurado', 'nombre', j.nombre); end if;
  select * into t from jur_talleristas where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'tallerista', 'nombre', t.nombre); end if;
  perform pg_sleep(0.4);
  return null;
end $$;

-- Jurados: el código fijo tampoco puede ser de un tallerista
create or replace function public.jur_admin_jurado(p_codigo text, p_id uuid, p_nombre text, p_concursos text[], p_descripcion text default '',
  p_foto text default null, p_borrar boolean default false, p_nuevo_codigo boolean default false, p_codigo_fijo text default null)
returns json language plpgsql security definer set search_path = public as $$
declare j jur_jurados; fijo text := nullif(jur_norm(p_codigo_fijo), '');
begin
  perform jur_exigir_admin(p_codigo);
  if p_borrar then delete from jur_jurados where id = p_id; return null; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre completo del jurado'; end if;
  if coalesce(array_length(p_concursos, 1), 0) = 0 then raise exception 'Elige al menos un concurso'; end if;
  if exists (select 1 from unnest(p_concursos) c where c not in (select id from jur_concursos)) then raise exception 'Concurso no válido'; end if;
  if p_foto is not null and length(p_foto) > 450000 then raise exception 'La foto es muy pesada'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otro jurado o tallerista'; end if;
  end if;
  if p_id is null then
    insert into jur_jurados (nombre, codigo, concursos, descripcion, foto)
    values (trim(p_nombre), coalesce(fijo, jur_nuevo_codigo()), p_concursos, left(coalesce(p_descripcion, ''), 400), coalesce(p_foto, ''))
    returning * into j;
  else
    update jur_jurados set nombre = trim(p_nombre), concursos = p_concursos, descripcion = left(coalesce(p_descripcion, ''), 400),
      foto = coalesce(p_foto, foto),
      codigo = case when fijo is not null then fijo when p_nuevo_codigo then jur_nuevo_codigo() else codigo end
    where id = p_id returning * into j;
  end if;
  return json_build_object('id', j.id, 'codigo', j.codigo);
end $$;

create or replace function public.jur_admin_tallerista(p_codigo text, p_id uuid, p_nombre text, p_talleres text[], p_descripcion text default '',
  p_foto text default null, p_borrar boolean default false, p_nuevo_codigo boolean default false, p_codigo_fijo text default null)
returns json language plpgsql security definer set search_path = public as $$
declare t jur_talleristas; fijo text := nullif(jur_norm(p_codigo_fijo), '');
begin
  perform jur_exigir_admin(p_codigo);
  if p_borrar then delete from jur_talleristas where id = p_id; return null; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre completo del tallerista'; end if;
  if coalesce(array_length(p_talleres, 1), 0) = 0 then raise exception 'Elige al menos un taller'; end if;
  if exists (select 1 from unnest(p_talleres) x where x not in (select id from jur_talleres)) then raise exception 'Taller no válido'; end if;
  if p_foto is not null and length(p_foto) > 450000 then raise exception 'La foto es muy pesada'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otro jurado o tallerista'; end if;
  end if;
  if p_id is null then
    insert into jur_talleristas (nombre, codigo, talleres, descripcion, foto)
    values (trim(p_nombre), coalesce(fijo, jur_nuevo_codigo()), p_talleres, left(coalesce(p_descripcion, ''), 400), coalesce(p_foto, ''))
    returning * into t;
  else
    update jur_talleristas set nombre = trim(p_nombre), talleres = p_talleres, descripcion = left(coalesce(p_descripcion, ''), 400),
      foto = coalesce(p_foto, foto),
      codigo = case when fijo is not null then fijo when p_nuevo_codigo then jur_nuevo_codigo() else codigo end
    where id = p_id returning * into t;
  end if;
  return json_build_object('id', t.id, 'codigo', t.codigo);
end $$;

create or replace function public.jur_admin_clave(p_codigo text, p_nueva text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform jur_exigir_admin(p_codigo);
  if length(jur_norm(p_nueva)) < 6 then raise exception 'El código debe tener al menos 6 caracteres'; end if;
  if jur_codigo_usado(jur_norm(p_nueva)) then raise exception 'Ese código ya lo usa un jurado o tallerista'; end if;
  update jur_config set valor = extensions.crypt(jur_norm(p_nueva), extensions.gen_salt('bf')) where clave = 'admin';
end $$;

create or replace function public.jur_datos_tallerista(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare t jur_talleristas;
begin
  select * into t from jur_talleristas where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de tallerista incorrecto' using errcode = '28000'; end if;
  return json_build_object(
    'tallerista', json_build_object('id', t.id, 'nombre', t.nombre, 'talleres', t.talleres, 'foto', t.foto, 'descripcion', t.descripcion),
    'delegaciones', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'siglas', siglas) order by nombre) from jur_delegaciones), '[]'),
    'abiertos', (select json_object_agg(id, abierto) from jur_talleres),
    'ganadores', coalesce((select json_agg(json_build_object('taller_id', taller_id, 'integrantes', integrantes, 'tallerista', tallerista, 'actualizado', actualizado))
       from jur_taller_ganadores where taller_id = any(t.talleres)), '[]'));
end $$;

-- Guarda (o reemplaza) el equipo ganador de un taller. Lista vacía = quitar ganadores.
create or replace function public.jur_taller_registrar(p_codigo text, p_taller text, p_integrantes jsonb)
returns void language plpgsql security definer set search_path = public as $$
declare t jur_talleristas; x jsonb; limpio jsonb := '[]'; n int;
begin
  select * into t from jur_talleristas where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de tallerista incorrecto' using errcode = '28000'; end if;
  if not (p_taller = any(t.talleres)) then raise exception 'No estás asignado a este taller'; end if;
  if not coalesce((select abierto from jur_talleres where id = p_taller), false) then raise exception 'El registro de este taller ya está cerrado'; end if;
  if jsonb_typeof(p_integrantes) is distinct from 'array' then raise exception 'Lista de integrantes no válida'; end if;
  n := jsonb_array_length(p_integrantes);
  if n > 15 then raise exception 'Máximo 15 integrantes por equipo'; end if;
  for x in select * from jsonb_array_elements(p_integrantes) loop
    if coalesce(trim(x->>'nombre'), '') = '' then raise exception 'Escribe el nombre y apellido de cada integrante'; end if;
    if not exists (select 1 from jur_delegaciones where id::text = x->>'delegacion') then raise exception 'Elige la delegación de cada integrante'; end if;
    limpio := limpio || jsonb_build_array(jsonb_build_object('nombre', left(trim(x->>'nombre'), 120), 'delegacion', x->>'delegacion'));
  end loop;
  insert into jur_taller_ganadores (taller_id, integrantes, tallerista, actualizado) values (p_taller, limpio, t.nombre, now())
  on conflict (taller_id) do update set integrantes = excluded.integrantes, tallerista = excluded.tallerista, actualizado = now();
end $$;

create or replace function public.jur_admin_taller(p_codigo text, p_taller text, p_abierto boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  update jur_talleres set abierto = p_abierto where id = p_taller;
end $$;

create or replace function public.jur_admin_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return json_build_object(
    'concursos', (select json_agg(json_build_object('id', id, 'abierto', abierto)) from jur_concursos),
    'delegaciones', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'siglas', siglas) order by nombre) from jur_delegaciones), '[]'),
    'jurados', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'codigo', codigo, 'concursos', concursos,
        'foto', foto, 'descripcion', descripcion) order by creado) from jur_jurados), '[]'),
    'calificaciones', coalesce((select json_agg(json_build_object('id', id, 'concurso_id', concurso_id, 'subprueba', subprueba,
        'delegacion_id', delegacion_id, 'jurado_id', jurado_id, 'datos', datos, 'total', total, 'comentario', comentario,
        'actualizado', actualizado) order by actualizado desc) from jur_calificaciones), '[]'),
    'ajustes', coalesce((select json_agg(json_build_object('concurso_id', concurso_id, 'delegacion_id', delegacion_id,
        'retraso', retraso, 'walkover', walkover, 'descalificado', descalificado, 'valor', valor, 'nota', nota,
        'datos', datos, 'actualizado', actualizado)) from jur_ajustes), '[]'),
    'borrados', coalesce((select json_agg(json_build_object('id', id, 'concurso_id', concurso_id, 'subprueba', subprueba,
        'delegacion', delegacion, 'jurado', jurado, 'total', total, 'motivo', motivo, 'borrado', borrado) order by borrado desc) from jur_borrados), '[]'),
    'talleres', (select json_agg(json_build_object('id', id, 'abierto', abierto)) from jur_talleres),
    'talleristas', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'codigo', codigo, 'talleres', talleres,
        'foto', foto, 'descripcion', descripcion) order by creado) from jur_talleristas), '[]'),
    'ganadores_talleres', coalesce((select json_agg(json_build_object('taller_id', taller_id, 'integrantes', integrantes,
        'tallerista', tallerista, 'actualizado', actualizado)) from jur_taller_ganadores), '[]')
  );
end $$;

revoke all on function public.jur_codigo_usado(text, uuid) from public, anon, authenticated;
grant execute on function public.jur_datos_tallerista(text), public.jur_taller_registrar(text, text, jsonb),
  public.jur_admin_tallerista(text, uuid, text, text[], text, text, boolean, boolean, text), public.jur_admin_taller(text, text, boolean)
  to anon, authenticated;

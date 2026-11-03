-- =========================================================
-- Concurso de Proyectos · presentaciones (migración jur_18_proyectos_presentaciones). Solo agrega.
-- Cada equipo sube su PPT y un PDF de respaldo antes de la fecha límite (23/11/2026 23:59, hora de Lima).
-- Los archivos van a un espacio privado de Storage («jur-presentaciones»); nadie los lee sin pasar por la
-- función Edge «jur-presentaciones», que entrega enlaces temporales solo a: el propio equipo, el admin,
-- el coordinador del concurso y los jurados asignados a ese concurso.
-- =========================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('jur-presentaciones', 'jur-presentaciones', false, 52428800,
  array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation', 'application/vnd.ms-powerpoint', 'application/octet-stream'])
on conflict (id) do nothing;

create table if not exists public.jur_presentaciones (
  equipo_id uuid primary key references public.jur_equipos(id) on delete cascade,
  ppt_path text, ppt_nombre text, ppt_tamano bigint, ppt_subido timestamptz,
  pdf_path text, pdf_nombre text, pdf_tamano bigint, pdf_subido timestamptz
);
create table if not exists public.jur_pres_config (
  concurso_id text primary key references public.jur_concursos(id),
  limite timestamptz not null default timestamptz '2026-11-23 23:59:59-05',
  abierto boolean not null default true
);
create table if not exists public.jur_sorteos (
  concurso_id text primary key references public.jur_concursos(id),
  orden uuid[] not null default '{}',          -- ids de delegaciones en orden de exposición
  creado timestamptz not null default now()
);
alter table public.jur_presentaciones enable row level security;
alter table public.jur_pres_config enable row level security;
alter table public.jur_sorteos enable row level security;
revoke all on public.jur_presentaciones, public.jur_pres_config, public.jur_sorteos from anon, authenticated;
insert into public.jur_pres_config (concurso_id) values ('proyectos') on conflict do nothing;

-- ¿Se puede subir ahora? (abierto y antes del límite)
create or replace function public.jur_pres_abierta(p_concurso text) returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select abierto and now() <= limite from jur_pres_config where concurso_id = p_concurso), false);
$$;

create or replace function public.jur_pres_json(e jur_equipos) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('equipo_id', e.id, 'delegacion_id', e.delegacion_id, 'nombre', e.nombre,
    'ppt', case when p.ppt_path is null then null else json_build_object('nombre', p.ppt_nombre, 'tamano', p.ppt_tamano, 'subido', p.ppt_subido) end,
    'pdf', case when p.pdf_path is null then null else json_build_object('nombre', p.pdf_nombre, 'tamano', p.pdf_tamano, 'subido', p.pdf_subido) end)
  from (select 1) uno left join jur_presentaciones p on p.equipo_id = e.id;
$$;
create or replace function public.jur_pres_config_json(p_concurso text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('limite', c.limite, 'abierto', c.abierto, 'ahora', now(), 'puede', jur_pres_abierta(p_concurso),
    'orden', coalesce((select to_json(s.orden) from jur_sorteos s where s.concurso_id = p_concurso), '[]'::json),
    'sorteado', (select s.creado from jur_sorteos s where s.concurso_id = p_concurso))
  from (select 1) uno left join jur_pres_config c on c.concurso_id = p_concurso;
$$;

-- ---------- Equipo: ve sus archivos y la fecha límite ----------
create or replace function public.jur_equipo_presentacion(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos;
begin
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de equipo incorrecto' using errcode = '28000'; end if;
  return json_build_object('presentacion', jur_pres_json(e), 'config', jur_pres_config_json(e.concurso_id));
end $$;

-- ---------- Admin / coordinador: estado de todos, fecha límite y sorteo ----------
create or replace function public.jur_admin_presentaciones(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_sala(p_codigo, p_concurso);
  return json_build_object('config', jur_pres_config_json(p_concurso),
    'equipos', coalesce((select json_agg(json_build_object('id', e.id, 'codigo', e.codigo, 'pres', jur_pres_json(e))) from jur_equipos e where e.concurso_id = p_concurso), '[]'));
end $$;

-- p_accion: limite (p_limite) | cerrar | abrir
create or replace function public.jur_admin_pres_config(p_codigo text, p_concurso text, p_accion text, p_limite timestamptz default null) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_sala(p_codigo, p_concurso);
  insert into jur_pres_config (concurso_id) values (p_concurso) on conflict do nothing;
  if p_accion = 'limite' then
    if p_limite is null then raise exception 'Elige la nueva fecha límite'; end if;
    update jur_pres_config set limite = p_limite, abierto = true where concurso_id = p_concurso;
  elsif p_accion = 'cerrar' then update jur_pres_config set abierto = false where concurso_id = p_concurso;
  elsif p_accion = 'abrir' then update jur_pres_config set abierto = true where concurso_id = p_concurso;
  else raise exception 'Acción no válida'; end if;
end $$;

-- Guarda el orden de exposición (lo sortea la pantalla del admin)
create or replace function public.jur_admin_sorteo(p_codigo text, p_concurso text, p_orden uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_sala(p_codigo, p_concurso);
  if exists (select 1 from unnest(p_orden) x where not exists (select 1 from jur_delegaciones d where d.id = x)) then raise exception 'Delegación no válida en el orden'; end if;
  insert into jur_sorteos (concurso_id, orden, creado) values (p_concurso, coalesce(p_orden, '{}'), now())
  on conflict (concurso_id) do update set orden = excluded.orden, creado = now();
end $$;

-- ---------- Jurado: estado de las presentaciones de su concurso ----------
create or replace function public.jur_jurado_presentaciones(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados;
begin
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de jurado incorrecto' using errcode = '28000'; end if;
  if not (p_concurso = any(j.concursos)) then raise exception 'No estás asignado a este concurso'; end if;
  return json_build_object('config', jur_pres_config_json(p_concurso),
    'equipos', coalesce((select json_agg(jur_pres_json(e)) from jur_equipos e where e.concurso_id = p_concurso), '[]'));
end $$;

-- ---------- Solo para la función Edge (service_role): autorizar subida, confirmar y leer ----------
create or replace function public.jur_pres_autorizar_subida(p_codigo text, p_tipo text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de equipo incorrecto' using errcode = '28000'; end if;
  if not exists (select 1 from jur_pres_config where concurso_id = e.concurso_id) then raise exception 'Este concurso no recibe presentaciones'; end if;
  if not jur_pres_abierta(e.concurso_id) then raise exception 'La entrega de presentaciones ya está cerrada. Pide al organizador que la reabra.'; end if;
  if p_tipo = 'ppt' and coalesce(ext, '') not in ('pptx', 'ppt') then raise exception 'El archivo de PowerPoint debe ser .pptx o .ppt'; end if;
  if p_tipo = 'pdf' and coalesce(ext, '') <> 'pdf' then raise exception 'El respaldo debe ser un archivo .pdf'; end if;
  if p_tipo not in ('ppt', 'pdf') then raise exception 'Tipo de archivo no válido'; end if;
  if coalesce(p_tamano, 0) <= 0 or p_tamano > 52428800 then raise exception 'El archivo debe pesar como máximo 50 MB'; end if;
  return json_build_object('path', e.concurso_id || '/' || e.id || '/' || p_tipo || '-' || extract(epoch from clock_timestamp())::bigint || '.' || ext);
end $$;

create or replace function public.jur_pres_confirmar(p_codigo text, p_tipo text, p_path text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; viejo text;
begin
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de equipo incorrecto' using errcode = '28000'; end if;
  if p_path not like e.concurso_id || '/' || e.id || '/' || p_tipo || '-%' then raise exception 'Archivo no válido'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'jur-presentaciones' and o.name = p_path) then raise exception 'El archivo no llegó completo. Vuelve a subirlo.'; end if;
  insert into jur_presentaciones (equipo_id) values (e.id) on conflict do nothing;
  if p_tipo = 'ppt' then
    select ppt_path into viejo from jur_presentaciones where equipo_id = e.id;
    update jur_presentaciones set ppt_path = p_path, ppt_nombre = left(p_nombre, 200), ppt_tamano = p_tamano, ppt_subido = now() where equipo_id = e.id;
  else
    select pdf_path into viejo from jur_presentaciones where equipo_id = e.id;
    update jur_presentaciones set pdf_path = p_path, pdf_nombre = left(p_nombre, 200), pdf_tamano = p_tamano, pdf_subido = now() where equipo_id = e.id;
  end if;
  return json_build_object('anterior', viejo);
end $$;

-- Quién puede leer: el propio equipo, admin, coordinador del concurso o jurado asignado
create or replace function public.jur_pres_autorizar_lectura(p_codigo text, p_equipo uuid, p_tipo text) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; p jur_presentaciones; ok boolean := false;
begin
  select * into e from jur_equipos where id = p_equipo;
  if not found then raise exception 'Ese equipo ya no existe'; end if;
  if jur_es_admin(p_codigo) then ok := true;
  elsif exists (select 1 from jur_coordinadores where codigo = jur_norm(p_codigo) and e.concurso_id = any(concursos)) then ok := true;
  elsif exists (select 1 from jur_jurados where codigo = jur_norm(p_codigo) and e.concurso_id = any(concursos)) then ok := true;
  elsif e.codigo = jur_norm(p_codigo) then ok := true;
  end if;
  if not ok then perform pg_sleep(0.4); raise exception 'No tienes permiso para ver esta presentación' using errcode = '28000'; end if;
  select * into p from jur_presentaciones where equipo_id = e.id;
  if p_tipo = 'ppt' and p.ppt_path is not null then return json_build_object('path', p.ppt_path, 'nombre', p.ppt_nombre); end if;
  if p_tipo = 'pdf' and p.pdf_path is not null then return json_build_object('path', p.pdf_path, 'nombre', p.pdf_nombre); end if;
  raise exception 'Este equipo aún no subió ese archivo';
end $$;

revoke all on function public.jur_pres_abierta(text), public.jur_pres_json(jur_equipos), public.jur_pres_config_json(text),
  public.jur_pres_autorizar_subida(text, text, text, bigint), public.jur_pres_confirmar(text, text, text, text, bigint),
  public.jur_pres_autorizar_lectura(text, uuid, text) from public, anon, authenticated;
grant execute on function public.jur_pres_autorizar_subida(text, text, text, bigint), public.jur_pres_confirmar(text, text, text, text, bigint),
  public.jur_pres_autorizar_lectura(text, uuid, text) to service_role;
grant execute on function public.jur_equipo_presentacion(text), public.jur_admin_presentaciones(text, text),
  public.jur_admin_pres_config(text, text, text, timestamptz), public.jur_admin_sorteo(text, text, uuid[]),
  public.jur_jurado_presentaciones(text, text) to anon, authenticated;

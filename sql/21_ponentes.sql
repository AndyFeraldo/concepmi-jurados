-- =========================================================
-- Ponentes de las charlas magistrales (migración jur_21_ponentes). Solo agrega.
-- Cada ponente tiene su código (puerta «Ponente»), foto, descripción, charla(s) asignada(s),
-- título de su ponencia y sus archivos: PDF (se proyecta), PPT (respaldo) y video opcional,
-- guardados en el espacio privado «jur-presentaciones» bajo ponencias/<id>/.
-- El admin (o un acceso con Charlas) los ve; solo con Charlas «editar» los crea o cambia.
-- =========================================================
create table if not exists public.jur_ponentes (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  charlas text[] not null default '{}',
  descripcion text not null default '',
  foto text not null default '',
  titulo text not null default '',
  video_despues text not null default '',
  pdf_path text, pdf_nombre text, pdf_tamano bigint, pdf_subido timestamptz,
  ppt_path text, ppt_nombre text, ppt_tamano bigint, ppt_subido timestamptz,
  video_path text, video_nombre text, video_tamano bigint, video_subido timestamptz,
  creado timestamptz not null default now()
);
alter table public.jur_ponentes enable row level security;

create or replace function public.jur_codigo_usado(p text, p_excepto uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jur_jurados where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_talleristas where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_equipos where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_coordinadores where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_ponentes where codigo = p and id is distinct from p_excepto);
$$;

create or replace function public.jur_entrar(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados; t jur_talleristas; e jur_equipos; k jur_coordinadores; o jur_ponentes;
begin
  if jur_es_admin(p_codigo) then return json_build_object('rol', 'admin'); end if;
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'jurado', 'nombre', j.nombre); end if;
  select * into t from jur_talleristas where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'tallerista', 'nombre', t.nombre); end if;
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'equipo', 'nombre', e.nombre); end if;
  select * into o from jur_ponentes where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'ponente', 'nombre', o.nombre); end if;
  select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'coordinador', 'nombre', k.nombre); end if;
  perform pg_sleep(0.4);
  return null;
end $$;

create or replace function public.jur_ponente_json(o jur_ponentes, con_codigo boolean default false) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', o.id, 'nombre', o.nombre, 'codigo', case when con_codigo then o.codigo end, 'charlas', o.charlas,
    'descripcion', o.descripcion, 'foto', o.foto, 'titulo', o.titulo, 'video_despues', o.video_despues,
    'pdf', case when o.pdf_path is null then null else json_build_object('nombre', o.pdf_nombre, 'tamano', o.pdf_tamano, 'subido', o.pdf_subido) end,
    'ppt', case when o.ppt_path is null then null else json_build_object('nombre', o.ppt_nombre, 'tamano', o.ppt_tamano, 'subido', o.ppt_subido) end,
    'video', case when o.video_path is null then null else json_build_object('nombre', o.video_nombre, 'tamano', o.video_tamano, 'subido', o.video_subido) end);
$$;

-- El ponente entra con su código
create or replace function public.jur_ponente_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare o jur_ponentes;
begin
  select * into o from jur_ponentes where codigo = jur_norm(p_codigo);
  if not found then perform pg_sleep(0.4); raise exception 'Código de ponente incorrecto' using errcode = '28000'; end if;
  return json_build_object('ponente', jur_ponente_json(o, false));
end $$;

create or replace function public.jur_ponente_guardar(p_codigo text, p_titulo text, p_video_despues text) returns json
language plpgsql security definer set search_path = public as $$
declare o jur_ponentes;
begin
  update jur_ponentes set titulo = left(trim(coalesce(p_titulo, '')), 160), video_despues = left(regexp_replace(coalesce(p_video_despues, ''), '\D', '', 'g'), 3)
  where codigo = jur_norm(p_codigo) returning * into o;
  if not found then perform pg_sleep(0.4); raise exception 'Código de ponente incorrecto' using errcode = '28000'; end if;
  return json_build_object('ok', true);
end $$;

-- Admin: lista y edición
create or replace function public.jur_admin_ponentes(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare ed boolean;
begin
  perform jur_exigir_permiso(p_codigo, 'charlas', 'ver');
  ed := jur_permiso(p_codigo, 'charlas', 'editar');
  return coalesce((select json_agg(jur_ponente_json(o, ed) order by o.creado) from jur_ponentes o), '[]');
end $$;

create or replace function public.jur_admin_ponente(p_codigo text, p_id uuid, p_nombre text, p_charlas text[], p_descripcion text default '',
  p_foto text default null, p_borrar boolean default false, p_nuevo_codigo boolean default false, p_codigo_fijo text default null, p_titulo text default null) returns json
language plpgsql security definer set search_path = public as $$
declare o jur_ponentes; fijo text := nullif(jur_norm(p_codigo_fijo), '');
begin
  perform jur_exigir_permiso(p_codigo, 'charlas', 'editar');
  if p_borrar then delete from jur_ponentes where id = p_id; return null; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre completo del ponente'; end if;
  if coalesce(array_length(p_charlas, 1), 0) = 0 then raise exception 'Elige al menos una charla'; end if;
  if exists (select 1 from unnest(p_charlas) x where x not in (select id from jur_charlas)) then raise exception 'Charla no válida'; end if;
  if p_foto is not null and length(p_foto) > 450000 then raise exception 'La foto es muy pesada'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otra persona'; end if;
  end if;
  if p_id is null then
    insert into jur_ponentes (nombre, codigo, charlas, descripcion, foto, titulo)
    values (trim(p_nombre), coalesce(fijo, jur_nuevo_codigo()), p_charlas, left(coalesce(p_descripcion, ''), 400), coalesce(p_foto, ''), left(trim(coalesce(p_titulo, '')), 160))
    returning * into o;
  else
    update jur_ponentes set nombre = trim(p_nombre), charlas = p_charlas, descripcion = left(coalesce(p_descripcion, ''), 400),
      foto = coalesce(p_foto, foto), titulo = coalesce(left(trim(p_titulo), 160), titulo),
      codigo = case when fijo is not null then fijo when p_nuevo_codigo then jur_nuevo_codigo() else codigo end
    where id = p_id returning * into o;
    if not found then raise exception 'Ese ponente ya no existe'; end if;
  end if;
  return json_build_object('id', o.id, 'codigo', o.codigo);
end $$;

-- Archivos (los llama solo la función Edge con service_role)
-- Sube el propio ponente; el admin (Charlas editar) también puede subir por él indicando p_ponente.
create or replace function public.jur_ponencia_quien(p_codigo text, p_ponente uuid) returns jur_ponentes
language plpgsql security definer set search_path = public as $$
declare o jur_ponentes;
begin
  select * into o from jur_ponentes where codigo = jur_norm(p_codigo);
  if found then return o; end if;
  if p_ponente is not null and jur_permiso(p_codigo, 'charlas', 'editar') then
    select * into o from jur_ponentes where id = p_ponente;
    if found then return o; end if;
    raise exception 'Ese ponente ya no existe';
  end if;
  perform pg_sleep(0.4); raise exception 'Código de ponente incorrecto' using errcode = '28000';
end $$;

create or replace function public.jur_ponencia_autorizar_subida(p_codigo text, p_tipo text, p_nombre text, p_tamano bigint, p_ponente uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare o jur_ponentes := jur_ponencia_quien(p_codigo, p_ponente); ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  if p_tipo not in ('ppt', 'pdf', 'video') then raise exception 'Tipo de archivo no válido'; end if;
  if p_tipo = 'ppt' and coalesce(ext, '') not in ('pptx', 'ppt') then raise exception 'El archivo de PowerPoint debe ser .pptx o .ppt'; end if;
  if p_tipo = 'pdf' and coalesce(ext, '') <> 'pdf' then raise exception 'La presentación debe ser un archivo .pdf'; end if;
  if p_tipo = 'video' and coalesce(ext, '') not in ('mp4', 'mov', 'webm', 'm4v') then raise exception 'El video debe ser .mp4 (también se acepta .mov o .webm)'; end if;
  if coalesce(p_tamano, 0) <= 0 or p_tamano > 52428800 then raise exception 'El archivo debe pesar como máximo 50 MB'; end if;
  return json_build_object('path', 'ponencias/' || o.id || '/' || p_tipo || '-' || extract(epoch from clock_timestamp())::bigint || '.' || ext);
end $$;

create or replace function public.jur_ponencia_confirmar(p_codigo text, p_tipo text, p_path text, p_nombre text, p_tamano bigint, p_ponente uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare o jur_ponentes := jur_ponencia_quien(p_codigo, p_ponente); viejo text;
begin
  if p_tipo not in ('ppt', 'pdf', 'video') then raise exception 'Tipo de archivo no válido'; end if;
  if p_path not like 'ponencias/' || o.id || '/' || p_tipo || '-%' then raise exception 'Archivo no válido'; end if;
  if not exists (select 1 from storage.objects s where s.bucket_id = 'jur-presentaciones' and s.name = p_path) then raise exception 'El archivo no llegó completo. Vuelve a subirlo.'; end if;
  if p_tipo = 'ppt' then viejo := o.ppt_path;
    update jur_ponentes set ppt_path = p_path, ppt_nombre = left(p_nombre, 200), ppt_tamano = p_tamano, ppt_subido = now() where id = o.id;
  elsif p_tipo = 'pdf' then viejo := o.pdf_path;
    update jur_ponentes set pdf_path = p_path, pdf_nombre = left(p_nombre, 200), pdf_tamano = p_tamano, pdf_subido = now() where id = o.id;
  else viejo := o.video_path;
    update jur_ponentes set video_path = p_path, video_nombre = left(p_nombre, 200), video_tamano = p_tamano, video_subido = now() where id = o.id;
  end if;
  return json_build_object('anterior', viejo);
end $$;

create or replace function public.jur_ponencia_autorizar_lectura(p_codigo text, p_ponente uuid, p_tipo text) returns json
language plpgsql security definer set search_path = public as $$
declare o jur_ponentes;
begin
  select * into o from jur_ponentes where id = p_ponente;
  if not found then raise exception 'Ese ponente ya no existe'; end if;
  if not (o.codigo = jur_norm(p_codigo) or jur_permiso(p_codigo, 'charlas', 'ver')) then
    perform pg_sleep(0.4); raise exception 'No tienes permiso para ver esta presentación' using errcode = '28000';
  end if;
  if p_tipo = 'ppt' and o.ppt_path is not null then return json_build_object('path', o.ppt_path, 'nombre', o.ppt_nombre); end if;
  if p_tipo = 'pdf' and o.pdf_path is not null then return json_build_object('path', o.pdf_path, 'nombre', o.pdf_nombre); end if;
  if p_tipo = 'video' and o.video_path is not null then return json_build_object('path', o.video_path, 'nombre', o.video_nombre); end if;
  raise exception 'Aún no se subió ese archivo';
end $$;

revoke all on function public.jur_ponente_json(jur_ponentes, boolean), public.jur_ponencia_quien(text, uuid),
  public.jur_ponencia_autorizar_subida(text, text, text, bigint, uuid), public.jur_ponencia_confirmar(text, text, text, text, bigint, uuid),
  public.jur_ponencia_autorizar_lectura(text, uuid, text) from public, anon, authenticated;
grant execute on function public.jur_ponencia_autorizar_subida(text, text, text, bigint, uuid), public.jur_ponencia_confirmar(text, text, text, text, bigint, uuid),
  public.jur_ponencia_autorizar_lectura(text, uuid, text) to service_role;

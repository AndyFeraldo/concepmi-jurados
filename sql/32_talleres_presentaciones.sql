-- =========================================================
-- Migración jur_32_talleres_presentaciones (solo agrega).
-- Cada taller (t1–t4) guarda la presentación de su tallerista: PDF (se proyecta), PPT de respaldo,
-- video opcional, título y «video después de la diapositiva N». Los archivos van al espacio privado
-- «jur-presentaciones» bajo talleres/<taller>/ y se suben/leen con la función Edge (taller: true).
-- Quién puede:
--   subir / quitar: el tallerista asignado a ese taller, el admin y accesos con Talleristas «editar»
--   ver / proyectar: los anteriores + accesos con Talleristas «ver» (coordinador de talleres) y Proyección
-- No toca jurados, delegaciones, calificaciones, ajustes ni ganadores.
-- =========================================================
alter table public.jur_talleres
  add column if not exists titulo text not null default '',
  add column if not exists video_despues text not null default '',
  add column if not exists pdf_path text, add column if not exists pdf_nombre text, add column if not exists pdf_tamano bigint, add column if not exists pdf_subido timestamptz,
  add column if not exists ppt_path text, add column if not exists ppt_nombre text, add column if not exists ppt_tamano bigint, add column if not exists ppt_subido timestamptz,
  add column if not exists video_path text, add column if not exists video_nombre text, add column if not exists video_tamano bigint, add column if not exists video_subido timestamptz;

-- ¿Este código puede ver (p_editar = false) o cambiar (true) la presentación de este taller?
create or replace function public.jur_taller_puede(p_codigo text, p_taller text, p_editar boolean) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jur_talleristas where codigo = jur_norm(p_codigo) and p_taller = any(talleres))
      or jur_permiso(p_codigo, 'talleristas', case when p_editar then 'editar' else 'ver' end)
      or (not p_editar and jur_permiso(p_codigo, 'proyeccion', 'ver'));
$$;

create or replace function public.jur_taller_pres_json(t jur_talleres) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('id', t.id, 'abierto', t.abierto, 'titulo', t.titulo, 'video_despues', t.video_despues,
    'pdf', case when t.pdf_path is null then null else json_build_object('nombre', t.pdf_nombre, 'tamano', t.pdf_tamano, 'subido', t.pdf_subido) end,
    'ppt', case when t.ppt_path is null then null else json_build_object('nombre', t.ppt_nombre, 'tamano', t.ppt_tamano, 'subido', t.ppt_subido) end,
    'video', case when t.video_path is null then null else json_build_object('nombre', t.video_nombre, 'tamano', t.video_tamano, 'subido', t.video_subido) end,
    'talleristas', coalesce((select json_agg(json_build_object('nombre', x.nombre, 'foto', x.foto) order by x.creado) from jur_talleristas x where t.id = any(x.talleres)), '[]'));
$$;

-- Presentaciones de los talleres que este código puede ver (el tallerista, solo las suyas)
create or replace function public.jur_talleres_presentaciones(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare r json;
begin
  select json_agg(jur_taller_pres_json(t) order by t.id) into r from jur_talleres t where jur_taller_puede(p_codigo, t.id, false);
  if r is null then perform pg_sleep(0.4); raise exception 'No tienes acceso a las presentaciones de los talleres' using errcode = '28000'; end if;
  return r;
end $$;

create or replace function public.jur_taller_guardar(p_codigo text, p_taller text, p_titulo text, p_video_despues text) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not jur_taller_puede(p_codigo, p_taller, true) then perform pg_sleep(0.4); raise exception 'No puedes cambiar la presentación de este taller' using errcode = '28000'; end if;
  update jur_talleres set titulo = left(trim(coalesce(p_titulo, '')), 160), video_despues = left(regexp_replace(coalesce(p_video_despues, ''), '\D', '', 'g'), 3) where id = p_taller;
  if not found then raise exception 'Ese taller no existe'; end if;
  return json_build_object('ok', true);
end $$;

-- Archivos (solo la función Edge, con service_role)
create or replace function public.jur_taller_autorizar_subida(p_codigo text, p_taller text, p_tipo text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  if not jur_taller_puede(p_codigo, p_taller, true) then perform pg_sleep(0.4); raise exception 'No puedes subir archivos a este taller' using errcode = '28000'; end if;
  if not exists (select 1 from jur_talleres where id = p_taller) then raise exception 'Ese taller no existe'; end if;
  if p_tipo not in ('ppt', 'pdf', 'video') then raise exception 'Tipo de archivo no válido'; end if;
  if p_tipo = 'ppt' and coalesce(ext, '') not in ('pptx', 'ppt') then raise exception 'El archivo de PowerPoint debe ser .pptx o .ppt'; end if;
  if p_tipo = 'pdf' and coalesce(ext, '') <> 'pdf' then raise exception 'La presentación debe ser un archivo .pdf'; end if;
  if p_tipo = 'video' and coalesce(ext, '') not in ('mp4', 'mov', 'webm', 'm4v') then raise exception 'El video debe ser .mp4 (también se acepta .mov o .webm)'; end if;
  if coalesce(p_tamano, 0) <= 0 or p_tamano > 52428800 then raise exception 'El archivo debe pesar como máximo 50 MB'; end if;
  return json_build_object('path', 'talleres/' || p_taller || '/' || p_tipo || '-' || extract(epoch from clock_timestamp())::bigint || '.' || ext);
end $$;

create or replace function public.jur_taller_confirmar(p_codigo text, p_taller text, p_tipo text, p_path text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare t jur_talleres; viejo text;
begin
  if not jur_taller_puede(p_codigo, p_taller, true) then perform pg_sleep(0.4); raise exception 'No puedes subir archivos a este taller' using errcode = '28000'; end if;
  select * into t from jur_talleres where id = p_taller;
  if not found then raise exception 'Ese taller no existe'; end if;
  if p_tipo not in ('ppt', 'pdf', 'video') then raise exception 'Tipo de archivo no válido'; end if;
  if p_path not like 'talleres/' || p_taller || '/' || p_tipo || '-%' then raise exception 'Archivo no válido'; end if;
  if not exists (select 1 from storage.objects s where s.bucket_id = 'jur-presentaciones' and s.name = p_path) then raise exception 'El archivo no llegó completo. Vuelve a subirlo.'; end if;
  if p_tipo = 'ppt' then viejo := t.ppt_path;
    update jur_talleres set ppt_path = p_path, ppt_nombre = left(p_nombre, 200), ppt_tamano = p_tamano, ppt_subido = now() where id = t.id;
  elsif p_tipo = 'pdf' then viejo := t.pdf_path;
    update jur_talleres set pdf_path = p_path, pdf_nombre = left(p_nombre, 200), pdf_tamano = p_tamano, pdf_subido = now() where id = t.id;
  else viejo := t.video_path;
    update jur_talleres set video_path = p_path, video_nombre = left(p_nombre, 200), video_tamano = p_tamano, video_subido = now() where id = t.id;
  end if;
  return json_build_object('anterior', viejo);
end $$;

create or replace function public.jur_taller_autorizar_lectura(p_codigo text, p_taller text, p_tipo text) returns json
language plpgsql security definer set search_path = public as $$
declare t jur_talleres;
begin
  if not jur_taller_puede(p_codigo, p_taller, false) then perform pg_sleep(0.4); raise exception 'No tienes permiso para ver esta presentación' using errcode = '28000'; end if;
  select * into t from jur_talleres where id = p_taller;
  if not found then raise exception 'Ese taller no existe'; end if;
  if p_tipo = 'ppt' and t.ppt_path is not null then return json_build_object('path', t.ppt_path, 'nombre', t.ppt_nombre); end if;
  if p_tipo = 'pdf' and t.pdf_path is not null then return json_build_object('path', t.pdf_path, 'nombre', t.pdf_nombre); end if;
  if p_tipo = 'video' and t.video_path is not null then return json_build_object('path', t.video_path, 'nombre', t.video_nombre); end if;
  raise exception 'Aún no se subió ese archivo';
end $$;

create or replace function public.jur_taller_quitar(p_codigo text, p_taller text, p_tipos text[]) returns json
language plpgsql security definer set search_path = public as $$
declare t jur_talleres; quitados text[] := '{}';
begin
  if not jur_taller_puede(p_codigo, p_taller, true) then perform pg_sleep(0.4); raise exception 'No puedes quitar archivos de este taller' using errcode = '28000'; end if;
  select * into t from jur_talleres where id = p_taller;
  if not found then raise exception 'Ese taller no existe'; end if;
  if coalesce(array_length(p_tipos, 1), 0) = 0 or exists (select 1 from unnest(p_tipos) x where x not in ('pdf', 'ppt', 'video')) then raise exception 'Elige qué archivos quitar'; end if;
  if 'pdf' = any(p_tipos) and t.pdf_path is not null then quitados := quitados || t.pdf_path; end if;
  if 'ppt' = any(p_tipos) and t.ppt_path is not null then quitados := quitados || t.ppt_path; end if;
  if 'video' = any(p_tipos) and t.video_path is not null then quitados := quitados || t.video_path; end if;
  update jur_talleres set
    pdf_path = case when 'pdf' = any(p_tipos) then null else pdf_path end, pdf_nombre = case when 'pdf' = any(p_tipos) then null else pdf_nombre end,
    pdf_tamano = case when 'pdf' = any(p_tipos) then null else pdf_tamano end, pdf_subido = case when 'pdf' = any(p_tipos) then null else pdf_subido end,
    ppt_path = case when 'ppt' = any(p_tipos) then null else ppt_path end, ppt_nombre = case when 'ppt' = any(p_tipos) then null else ppt_nombre end,
    ppt_tamano = case when 'ppt' = any(p_tipos) then null else ppt_tamano end, ppt_subido = case when 'ppt' = any(p_tipos) then null else ppt_subido end,
    video_path = case when 'video' = any(p_tipos) then null else video_path end, video_nombre = case when 'video' = any(p_tipos) then null else video_nombre end,
    video_tamano = case when 'video' = any(p_tipos) then null else video_tamano end, video_subido = case when 'video' = any(p_tipos) then null else video_subido end
  where id = t.id;
  return json_build_object('paths', to_json(quitados));
end $$;

revoke all on function public.jur_taller_puede(text, text, boolean), public.jur_taller_pres_json(jur_talleres),
  public.jur_taller_autorizar_subida(text, text, text, text, bigint), public.jur_taller_confirmar(text, text, text, text, text, bigint),
  public.jur_taller_autorizar_lectura(text, text, text), public.jur_taller_quitar(text, text, text[]) from public, anon, authenticated;
grant execute on function public.jur_taller_autorizar_subida(text, text, text, text, bigint), public.jur_taller_confirmar(text, text, text, text, text, bigint),
  public.jur_taller_autorizar_lectura(text, text, text), public.jur_taller_quitar(text, text, text[]) to service_role;
revoke all on function public.jur_talleres_presentaciones(text), public.jur_taller_guardar(text, text, text, text) from public;
grant execute on function public.jur_talleres_presentaciones(text), public.jur_taller_guardar(text, text, text, text) to anon, authenticated;

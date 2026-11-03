-- =========================================================
-- Concurso de Proyectos · video opcional (migración jur_19_proyectos_video). Solo agrega.
-- El equipo puede subir un video (MP4/MOV/WEBM, máx. 50 MB) que se reproduce dentro de la
-- pantalla del concurso después de la diapositiva que indique (jur_entregas.datos.videoDespues).
-- =========================================================
alter table public.jur_presentaciones
  add column if not exists video_path text, add column if not exists video_nombre text,
  add column if not exists video_tamano bigint, add column if not exists video_subido timestamptz;

update storage.buckets set allowed_mime_types = array['application/pdf', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint', 'application/octet-stream', 'video/mp4', 'video/quicktime', 'video/webm']
where id = 'jur-presentaciones';

create or replace function public.jur_pres_json(e jur_equipos) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('equipo_id', e.id, 'delegacion_id', e.delegacion_id, 'nombre', e.nombre,
    'ppt', case when p.ppt_path is null then null else json_build_object('nombre', p.ppt_nombre, 'tamano', p.ppt_tamano, 'subido', p.ppt_subido) end,
    'pdf', case when p.pdf_path is null then null else json_build_object('nombre', p.pdf_nombre, 'tamano', p.pdf_tamano, 'subido', p.pdf_subido) end,
    'video', case when p.video_path is null then null else json_build_object('nombre', p.video_nombre, 'tamano', p.video_tamano, 'subido', p.video_subido) end)
  from (select 1) uno left join jur_presentaciones p on p.equipo_id = e.id;
$$;

create or replace function public.jur_pres_autorizar_subida(p_codigo text, p_tipo text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de equipo incorrecto' using errcode = '28000'; end if;
  if not exists (select 1 from jur_pres_config where concurso_id = e.concurso_id) then raise exception 'Este concurso no recibe presentaciones'; end if;
  if not jur_pres_abierta(e.concurso_id) then raise exception 'La entrega de presentaciones ya está cerrada. Pide al organizador que la reabra.'; end if;
  if p_tipo not in ('ppt', 'pdf', 'video') then raise exception 'Tipo de archivo no válido'; end if;
  if p_tipo = 'ppt' and coalesce(ext, '') not in ('pptx', 'ppt') then raise exception 'El archivo de PowerPoint debe ser .pptx o .ppt'; end if;
  if p_tipo = 'pdf' and coalesce(ext, '') <> 'pdf' then raise exception 'El respaldo debe ser un archivo .pdf'; end if;
  if p_tipo = 'video' and coalesce(ext, '') not in ('mp4', 'mov', 'webm', 'm4v') then raise exception 'El video debe ser .mp4 (también se acepta .mov o .webm)'; end if;
  if coalesce(p_tamano, 0) <= 0 or p_tamano > 52428800 then raise exception 'El archivo debe pesar como máximo 50 MB'; end if;
  return json_build_object('path', e.concurso_id || '/' || e.id || '/' || p_tipo || '-' || extract(epoch from clock_timestamp())::bigint || '.' || ext);
end $$;

create or replace function public.jur_pres_confirmar(p_codigo text, p_tipo text, p_path text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; viejo text;
begin
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de equipo incorrecto' using errcode = '28000'; end if;
  if p_tipo not in ('ppt', 'pdf', 'video') then raise exception 'Tipo de archivo no válido'; end if;
  if p_path not like e.concurso_id || '/' || e.id || '/' || p_tipo || '-%' then raise exception 'Archivo no válido'; end if;
  if not exists (select 1 from storage.objects o where o.bucket_id = 'jur-presentaciones' and o.name = p_path) then raise exception 'El archivo no llegó completo. Vuelve a subirlo.'; end if;
  insert into jur_presentaciones (equipo_id) values (e.id) on conflict do nothing;
  if p_tipo = 'ppt' then
    select ppt_path into viejo from jur_presentaciones where equipo_id = e.id;
    update jur_presentaciones set ppt_path = p_path, ppt_nombre = left(p_nombre, 200), ppt_tamano = p_tamano, ppt_subido = now() where equipo_id = e.id;
  elsif p_tipo = 'pdf' then
    select pdf_path into viejo from jur_presentaciones where equipo_id = e.id;
    update jur_presentaciones set pdf_path = p_path, pdf_nombre = left(p_nombre, 200), pdf_tamano = p_tamano, pdf_subido = now() where equipo_id = e.id;
  else
    select video_path into viejo from jur_presentaciones where equipo_id = e.id;
    update jur_presentaciones set video_path = p_path, video_nombre = left(p_nombre, 200), video_tamano = p_tamano, video_subido = now() where equipo_id = e.id;
  end if;
  return json_build_object('anterior', viejo);
end $$;

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
  if p_tipo = 'video' and p.video_path is not null then return json_build_object('path', p.video_path, 'nombre', p.video_nombre); end if;
  raise exception 'Este equipo aún no subió ese archivo';
end $$;

revoke all on function public.jur_pres_json(jur_equipos), public.jur_pres_autorizar_subida(text, text, text, bigint),
  public.jur_pres_confirmar(text, text, text, text, bigint), public.jur_pres_autorizar_lectura(text, uuid, text) from public, anon, authenticated;
grant execute on function public.jur_pres_autorizar_subida(text, text, text, bigint), public.jur_pres_confirmar(text, text, text, text, bigint),
  public.jur_pres_autorizar_lectura(text, uuid, text) to service_role;

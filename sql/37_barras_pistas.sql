-- =========================================================
-- jur_37_barras_pistas · Concurso de Barras: la pista (MP3) de cada delegación y el orden del sorteo,
-- guardados en la plataforma para usarlos desde cualquier laptop (admin, escenario, proyección).
-- Solo AGREGA: 2 tablas nuevas, funciones nuevas y tipos de audio en el espacio privado. No toca datos.
-- Permisos: los del Show en vivo (jur_show_exigir): subir / quitar / sortear = admin o Show «editar»;
-- escuchar / proyectar = además Show «ver» y Proyección.
-- Archivos en Storage «jur-presentaciones/barras/<delegacion>/», con enlaces temporales de la función Edge
-- (barras: true), igual que los PDF del Show.
-- =========================================================

create table if not exists public.jur_barras_pistas (
  delegacion_id uuid primary key references public.jur_delegaciones(id) on delete cascade,
  path text not null,
  nombre text not null default '',
  tamano bigint not null default 0,
  duracion numeric not null default 0,
  subido timestamptz not null default now()
);
create table if not exists public.jur_barras_orden (
  id int primary key default 1 check (id = 1),
  orden uuid[] not null default '{}',
  fecha timestamptz not null default now()
);
alter table public.jur_barras_pistas enable row level security;
alter table public.jur_barras_orden enable row level security;

-- El espacio privado acepta también audio (antes: PDF, PowerPoint, video y octet-stream)
update storage.buckets
   set allowed_mime_types = (select array_agg(distinct t) from unnest(coalesce(allowed_mime_types, '{}') ||
       array['audio/mpeg', 'audio/mp3', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/wav', 'audio/x-wav', 'audio/ogg']) t)
 where id = 'jur-presentaciones';

-- Datos para la pestaña y la proyección (sin datos personales)
create or replace function public.jur_barras_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_show_exigir(p_codigo, 'ver');
  return json_build_object(
    'nivel', jur_show_nivel(p_codigo),
    'pistas', coalesce((select json_agg(json_build_object('delegacion_id', delegacion_id, 'nombre', nombre, 'tamano', tamano,
                 'duracion', duracion, 'subido', subido)) from jur_barras_pistas), '[]'),
    'orden', (select json_build_object('ids', orden, 'fecha', fecha) from jur_barras_orden where id = 1 and cardinality(orden) > 0));
end $$;

-- Guardar (p_ids) o quitar (null) el orden del sorteo
create or replace function public.jur_admin_barras_orden(p_codigo text, p_ids uuid[]) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_show_exigir(p_codigo, 'editar');
  insert into jur_barras_orden (id, orden, fecha) values (1, coalesce(p_ids, '{}'), now())
  on conflict (id) do update set orden = excluded.orden, fecha = now();
  return json_build_object('ok', true);
end $$;

-- Solo para la función Edge (service_role)
create or replace function public.jur_barras_autorizar_subida(p_codigo text, p_delegacion uuid, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  perform jur_show_exigir(p_codigo, 'editar');
  if not exists (select 1 from jur_delegaciones where id = p_delegacion) then raise exception 'Delegación no válida'; end if;
  if coalesce(ext, '') not in ('mp3', 'm4a', 'aac', 'wav', 'ogg') then raise exception 'Sube la pista en MP3 (también vale M4A, WAV u OGG)'; end if;
  if coalesce(p_tamano, 0) <= 0 or p_tamano > 41943040 then raise exception 'La pista debe pesar como máximo 40 MB'; end if;
  return json_build_object('path', 'barras/' || p_delegacion || '/pista-' || extract(epoch from clock_timestamp())::bigint || '.' || ext);
end $$;

create or replace function public.jur_barras_confirmar(p_codigo text, p_delegacion uuid, p_path text, p_nombre text, p_tamano bigint, p_duracion numeric) returns json
language plpgsql security definer set search_path = public as $$
declare viejo text;
begin
  perform jur_show_exigir(p_codigo, 'editar');
  if p_path !~ ('^barras/' || p_delegacion || '/pista-[0-9]+\.(mp3|m4a|aac|wav|ogg)$') then raise exception 'Archivo no válido'; end if;
  select path into viejo from jur_barras_pistas where delegacion_id = p_delegacion;
  insert into jur_barras_pistas (delegacion_id, path, nombre, tamano, duracion, subido)
  values (p_delegacion, p_path, left(coalesce(p_nombre, ''), 200), coalesce(p_tamano, 0), greatest(coalesce(p_duracion, 0), 0), now())
  on conflict (delegacion_id) do update set path = excluded.path, nombre = excluded.nombre, tamano = excluded.tamano,
    duracion = excluded.duracion, subido = now();
  return json_build_object('ok', true, 'anterior', viejo);
end $$;

create or replace function public.jur_barras_autorizar_lectura(p_codigo text, p_delegacion uuid) returns json
language plpgsql security definer set search_path = public as $$
declare x jur_barras_pistas;
begin
  perform jur_show_exigir(p_codigo, 'ver');
  select * into x from jur_barras_pistas where delegacion_id = p_delegacion;
  if not found then raise exception 'Esa delegación aún no tiene pista'; end if;
  return json_build_object('path', x.path, 'nombre', x.nombre);
end $$;

create or replace function public.jur_barras_quitar(p_codigo text, p_delegacion uuid) returns json
language plpgsql security definer set search_path = public as $$
declare viejo text;
begin
  perform jur_show_exigir(p_codigo, 'editar');
  delete from jur_barras_pistas where delegacion_id = p_delegacion returning path into viejo;
  return json_build_object('ok', true, 'paths', case when viejo is null then '[]'::json else json_build_array(viejo) end);
end $$;

revoke all on function public.jur_barras_datos(text), public.jur_admin_barras_orden(text, uuid[]),
  public.jur_barras_autorizar_subida(text, uuid, text, bigint), public.jur_barras_confirmar(text, uuid, text, text, bigint, numeric),
  public.jur_barras_autorizar_lectura(text, uuid), public.jur_barras_quitar(text, uuid) from public, anon, authenticated;
grant execute on function public.jur_barras_datos(text), public.jur_admin_barras_orden(text, uuid[]) to anon, authenticated;
grant execute on function public.jur_barras_autorizar_subida(text, uuid, text, bigint), public.jur_barras_confirmar(text, uuid, text, text, bigint, numeric),
  public.jur_barras_autorizar_lectura(text, uuid), public.jur_barras_quitar(text, uuid) to service_role;

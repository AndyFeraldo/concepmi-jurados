-- =========================================================
-- Migración jur_35_show_en_vivo (solo agrega). Show en vivo del 24/11, 5:00–6:30 p. m. (auditorio,
-- en paralelo con IATHON, Amateur I y II).
--   1 · Networking: muro en vivo por QR (el asistente entra con su DNI y su comentario sale en pantalla
--       con su nombre y delegación) + ruleta de delegaciones con retos.
--   2 · Comentar los casos: el admin sube un PDF por concurso (Amateur I, II, IATHON) y se proyecta.
--   3 · Transmisión en vivo: enlace (TikTok / YouTube / Instagram) para mostrar en pantalla.
--   4 · Sorteo de becas: sponsors (nombre + logo), premios (tipo, cantidad, sponsor) y sorteo AL AZAR en
--       la base entre los inscritos (jur_asistentes, el Excel de confirmados) por su código.
-- Permiso nuevo «show» en los accesos limitados (ver / editar). Proyección (operador del auditorio)
-- puede proyectar, sortear, anular y abrir o cerrar el muro.
-- No toca jurados, delegaciones, calificaciones, ajustes ni asistentes.
-- =========================================================

create table if not exists public.jur_show (
  clave text primary key,
  datos jsonb not null default '{}'::jsonb,
  actualizado timestamptz not null default now()
);
insert into public.jur_show (clave, datos) values ('general', '{}'::jsonb) on conflict do nothing;

create table if not exists public.jur_show_sponsors (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  logo text not null default '',
  orden int not null default 0,
  creado timestamptz not null default now()
);
create table if not exists public.jur_show_premios (
  id uuid primary key default gen_random_uuid(),
  tipo text not null default 'beca' check (tipo in ('beca', 'semibeca', 'cuarto', 'descuento', 'otro')),
  titulo text not null default '',
  detalle text not null default '',
  sponsor_id uuid references public.jur_show_sponsors(id) on delete set null,
  cantidad int not null default 1 check (cantidad between 1 and 100),
  orden int not null default 0,
  creado timestamptz not null default now()
);
create table if not exists public.jur_show_ganadores (
  id uuid primary key default gen_random_uuid(),
  premio_id uuid not null references public.jur_show_premios(id) on delete cascade,
  dni text not null,
  codigo text not null default '',
  nombre text not null,
  delegacion_id uuid,
  delegacion_texto text not null default '',
  anulado boolean not null default false,
  motivo text not null default '',
  creado timestamptz not null default now()
);
create table if not exists public.jur_show_archivos (
  concurso_id text primary key check (concurso_id in ('amateur-1', 'amateur-2', 'iathon')),
  path text not null, nombre text not null, tamano bigint not null default 0,
  subido timestamptz not null default now()
);
create table if not exists public.jur_show_mensajes (
  id uuid primary key default gen_random_uuid(),
  dni text not null,
  nombre text not null,
  delegacion_id uuid,
  delegacion_texto text not null default '',
  texto text not null,
  oculto boolean not null default false,
  creado timestamptz not null default now()
);
create index if not exists jur_show_mensajes_creado on public.jur_show_mensajes (creado desc);
alter table public.jur_show enable row level security;
alter table public.jur_show_sponsors enable row level security;
alter table public.jur_show_premios enable row level security;
alter table public.jur_show_ganadores enable row level security;
alter table public.jur_show_archivos enable row level security;
alter table public.jur_show_mensajes enable row level security;
revoke all on public.jur_show, public.jur_show_sponsors, public.jur_show_premios, public.jur_show_ganadores,
  public.jur_show_archivos, public.jur_show_mensajes from anon, authenticated;

-- Pestaña nueva «show» en los accesos limitados
do $m$
declare f text;
begin
  f := pg_get_functiondef('public.jur_admin_coordinador(text, uuid, text, text[], boolean, text, jsonb)'::regprocedure);
  if f not like '%''show''%' then
    f := replace(f, $a$'diad', 'casos')$a$, $a$'diad', 'casos', 'show')$a$);
    if f not like '%''show''%' then raise exception 'No se pudo ajustar jur_admin_coordinador'; end if;
    execute f;
  end if;
end $m$;

-- Quién puede: ver = Show «ver» o Proyección; operar (sortear, anular, muro) = Show «editar» o Proyección;
-- editar (sponsors, premios, archivos, enlace) = Show «editar» (el admin siempre)
create or replace function public.jur_show_nivel(p_codigo text) returns text
language sql stable security definer set search_path = public as $$
  select case when jur_permiso(p_codigo, 'show', 'editar') then 'editar'
              when jur_permiso(p_codigo, 'proyeccion', 'ver') then 'operar'
              when jur_permiso(p_codigo, 'show', 'ver') then 'ver' else '' end;
$$;
create or replace function public.jur_show_exigir(p_codigo text, p_que text) returns void
language plpgsql stable security definer set search_path = public as $$
declare n text := jur_show_nivel(p_codigo);
begin
  if n = '' then perform pg_sleep(0.4); raise exception 'Tu acceso no incluye el Show en vivo' using errcode = '28000'; end if;
  if p_que = 'editar' and n <> 'editar' then raise exception 'Tu acceso al Show en vivo es solo para ver'; end if;
  if p_que = 'operar' and n not in ('editar', 'operar') then raise exception 'Tu acceso al Show en vivo es solo para ver'; end if;
end $$;

-- Todo lo del show (sin datos personales salvo los ganadores)
create or replace function public.jur_show_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_show_exigir(p_codigo, 'ver');
  return json_build_object(
    'nivel', jur_show_nivel(p_codigo),
    'config', coalesce((select datos from jur_show where clave = 'general'), '{}'::jsonb),
    'sponsors', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'logo', logo, 'orden', orden) order by orden, creado) from jur_show_sponsors), '[]'),
    'premios', coalesce((select json_agg(json_build_object('id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'detalle', p.detalle, 'sponsor_id', p.sponsor_id,
        'cantidad', p.cantidad, 'orden', p.orden, 'sorteados', (select count(*) from jur_show_ganadores g where g.premio_id = p.id and not g.anulado)) order by p.orden, p.creado) from jur_show_premios p), '[]'),
    'ganadores', coalesce((select json_agg(json_build_object('id', g.id, 'premio_id', g.premio_id, 'codigo', g.codigo, 'nombre', g.nombre,
        'delegacion', coalesce(d.siglas, nullif(g.delegacion_texto, ''), '—'), 'delegacion_nombre', coalesce(d.nombre, g.delegacion_texto), 'anulado', g.anulado, 'motivo', g.motivo, 'creado', g.creado) order by g.creado)
      from jur_show_ganadores g left join jur_delegaciones d on d.id = g.delegacion_id), '[]'),
    'archivos', coalesce((select json_object_agg(concurso_id, json_build_object('nombre', nombre, 'tamano', tamano, 'subido', subido)) from jur_show_archivos), '{}'::json),
    'participantes', (select count(*) from jur_asistentes where coalesce(codigo, '') <> ''),
    'mensajes', (select count(*) from jur_show_mensajes where not oculto));
end $$;

-- Lista de códigos para la animación de la ruleta (nombre y delegación solo se muestran al final)
create or replace function public.jur_show_participantes(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_show_exigir(p_codigo, 'ver');
  return coalesce((select json_agg(a.codigo order by random()) from jur_asistentes a where coalesce(a.codigo, '') <> ''), '[]');
end $$;

create or replace function public.jur_admin_show_config(p_codigo text, p_datos jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare d jsonb := coalesce((select datos from jur_show where clave = 'general'), '{}'::jsonb); x jsonb := coalesce(p_datos, '{}'::jsonb); r jsonb := '[]'::jsonb; t text;
begin
  -- abrir/cerrar el muro y su pregunta: también Proyección; el resto: Show «editar»
  if exists (select 1 from jsonb_object_keys(x) k where k not in ('muro_abierto', 'muro_pregunta')) then perform jur_show_exigir(p_codigo, 'editar');
  else perform jur_show_exigir(p_codigo, 'operar'); end if;
  if x ? 'link' then d := d || jsonb_build_object('link', left(trim(coalesce(x->>'link', '')), 500)); end if;
  if x ? 'link_titulo' then d := d || jsonb_build_object('link_titulo', left(trim(coalesce(x->>'link_titulo', '')), 120)); end if;
  if x ? 'muro_abierto' then d := d || jsonb_build_object('muro_abierto', coalesce((x->>'muro_abierto')::boolean, false)); end if;
  if x ? 'muro_pregunta' then d := d || jsonb_build_object('muro_pregunta', left(trim(coalesce(x->>'muro_pregunta', '')), 200)); end if;
  if x ? 'retos' and jsonb_typeof(x->'retos') = 'array' then
    for t in select left(trim(v), 200) from jsonb_array_elements_text(x->'retos') v where trim(v) <> '' limit 40 loop r := r || to_jsonb(t); end loop;
    d := d || jsonb_build_object('retos', r);
  end if;
  update jur_show set datos = d, actualizado = now() where clave = 'general';
  return d;
end $$;

create or replace function public.jur_admin_show_sponsor(p_codigo text, p_id uuid, p_nombre text, p_logo text default null, p_borrar boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare s jur_show_sponsors;
begin
  perform jur_show_exigir(p_codigo, 'editar');
  if p_borrar then delete from jur_show_sponsors where id = p_id; return null; end if;
  if length(trim(coalesce(p_nombre, ''))) < 2 then raise exception 'Escribe el nombre del sponsor'; end if;
  if p_logo is not null and length(p_logo) > 900000 then raise exception 'El logo es muy pesado (máx. ~600 KB)'; end if;
  if p_logo is not null and p_logo <> '' and p_logo !~ '^data:image/(png|jpeg|webp|svg\+xml);base64,' then raise exception 'El logo debe ser una imagen PNG, JPG, WEBP o SVG'; end if;
  if p_id is null then
    insert into jur_show_sponsors (nombre, logo, orden) values (left(trim(p_nombre), 80), coalesce(p_logo, ''), (select coalesce(max(orden), 0) + 1 from jur_show_sponsors)) returning * into s;
  else
    update jur_show_sponsors set nombre = left(trim(p_nombre), 80), logo = coalesce(p_logo, logo) where id = p_id returning * into s;
    if not found then raise exception 'Ese sponsor ya no existe'; end if;
  end if;
  return json_build_object('id', s.id);
end $$;

create or replace function public.jur_admin_show_premio(p_codigo text, p_id uuid, p_tipo text, p_titulo text, p_detalle text, p_sponsor uuid, p_cantidad int, p_borrar boolean default false) returns json
language plpgsql security definer set search_path = public as $$
declare p jur_show_premios;
begin
  perform jur_show_exigir(p_codigo, 'editar');
  if p_borrar then delete from jur_show_premios where id = p_id; return null; end if;
  if p_tipo not in ('beca', 'semibeca', 'cuarto', 'descuento', 'otro') then raise exception 'Tipo de premio no válido'; end if;
  if coalesce(p_cantidad, 0) < 1 or p_cantidad > 100 then raise exception 'La cantidad va de 1 a 100'; end if;
  if p_sponsor is not null and not exists (select 1 from jur_show_sponsors where id = p_sponsor) then raise exception 'Ese sponsor ya no existe'; end if;
  if p_id is null then
    insert into jur_show_premios (tipo, titulo, detalle, sponsor_id, cantidad, orden)
    values (p_tipo, left(trim(coalesce(p_titulo, '')), 160), left(trim(coalesce(p_detalle, '')), 160), p_sponsor, p_cantidad, (select coalesce(max(orden), 0) + 1 from jur_show_premios)) returning * into p;
  else
    if p_cantidad < (select count(*) from jur_show_ganadores where premio_id = p_id and not anulado) then raise exception 'Ya se sortearon más premios que esa cantidad'; end if;
    update jur_show_premios set tipo = p_tipo, titulo = left(trim(coalesce(p_titulo, '')), 160), detalle = left(trim(coalesce(p_detalle, '')), 160), sponsor_id = p_sponsor, cantidad = p_cantidad
    where id = p_id returning * into p;
    if not found then raise exception 'Ese premio ya no existe'; end if;
  end if;
  return json_build_object('id', p.id);
end $$;

-- EL SORTEO: elige al azar en la base, entre los inscritos con código que aún no ganaron nada
create or replace function public.jur_show_sortear(p_codigo text, p_premio uuid) returns json
language plpgsql security definer set search_path = public as $$
declare p jur_show_premios; a jur_asistentes; g jur_show_ganadores; d jur_delegaciones;
begin
  perform jur_show_exigir(p_codigo, 'operar');
  select * into p from jur_show_premios where id = p_premio for update;
  if not found then raise exception 'Ese premio ya no existe'; end if;
  if (select count(*) from jur_show_ganadores where premio_id = p.id and not anulado) >= p.cantidad then raise exception 'Ya se sortearon todos los premios de este tipo'; end if;
  select * into a from jur_asistentes x
  where coalesce(x.codigo, '') <> '' and not exists (select 1 from jur_show_ganadores g2 where g2.dni = x.dni and not g2.anulado)
    and not exists (select 1 from jur_show_ganadores g3 where g3.dni = x.dni and g3.premio_id = p.id)
  order by random() limit 1;
  if not found then raise exception 'Ya no quedan participantes sin premio'; end if;
  insert into jur_show_ganadores (premio_id, dni, codigo, nombre, delegacion_id, delegacion_texto)
  values (p.id, a.dni, a.codigo, a.nombre, a.delegacion_id, coalesce(a.delegacion_texto, '')) returning * into g;
  select * into d from jur_delegaciones where id = a.delegacion_id;
  return json_build_object('id', g.id, 'premio_id', p.id, 'codigo', g.codigo, 'nombre', g.nombre,
    'delegacion', coalesce(d.siglas, nullif(g.delegacion_texto, ''), '—'), 'delegacion_nombre', coalesce(d.nombre, g.delegacion_texto));
end $$;

-- «No está en el auditorio»: se anula y se puede volver a sortear ese premio
create or replace function public.jur_show_anular(p_codigo text, p_ganador uuid, p_motivo text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_show_exigir(p_codigo, 'operar');
  update jur_show_ganadores set anulado = true, motivo = left(trim(coalesce(nullif(p_motivo, ''), 'No estaba presente')), 200) where id = p_ganador;
  if not found then raise exception 'Ese ganador ya no existe'; end if;
end $$;

-- Limpiar las pruebas: sorteos o muro
create or replace function public.jur_admin_show_limpiar(p_codigo text, p_que text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_show_exigir(p_codigo, 'editar');
  if p_que = 'sorteos' then delete from jur_show_ganadores where true;
  elsif p_que = 'muro' then delete from jur_show_mensajes where true;
  else raise exception 'Opción no válida'; end if;
end $$;

-- ---------- Muro en vivo (los asistentes entran por el QR con su DNI) ----------
create or replace function public.jur_show_muro_info() returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('abierto', coalesce((datos->>'muro_abierto')::boolean, false), 'pregunta', coalesce(datos->>'muro_pregunta', ''))
  from jur_show where clave = 'general';
$$;
create or replace function public.jur_show_muro_enviar(p_dni text, p_texto text) returns json
language plpgsql security definer set search_path = public as $$
declare a jur_asistentes; t text := left(regexp_replace(trim(coalesce(p_texto, '')), '\s+', ' ', 'g'), 140); d jur_delegaciones;
begin
  if not coalesce((select (datos->>'muro_abierto')::boolean from jur_show where clave = 'general'), false) then raise exception 'El muro está cerrado por ahora'; end if;
  select * into a from jur_asistentes where dni = jur_norm_dni(p_dni);
  if not found then perform pg_sleep(0.5); raise exception 'No encontramos tu DNI en la lista de inscritos'; end if;
  if length(t) < 2 then raise exception 'Escribe tu comentario'; end if;
  if exists (select 1 from jur_show_mensajes where dni = a.dni and creado > now() - interval '20 seconds') then raise exception 'Espera unos segundos antes de enviar otro'; end if;
  if (select count(*) from jur_show_mensajes where dni = a.dni) >= 10 then raise exception 'Ya enviaste 10 comentarios: ¡gracias por participar!'; end if;
  insert into jur_show_mensajes (dni, nombre, delegacion_id, delegacion_texto, texto) values (a.dni, a.nombre, a.delegacion_id, coalesce(a.delegacion_texto, ''), t);
  select * into d from jur_delegaciones where id = a.delegacion_id;
  return json_build_object('nombre', a.nombre, 'delegacion', coalesce(d.siglas, a.delegacion_texto, ''));
end $$;
create or replace function public.jur_show_muro(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_show_exigir(p_codigo, 'ver');
  return json_build_object('info', jur_show_muro_info(),
    'mensajes', coalesce((select json_agg(x order by x.creado desc) from (select m.id, m.nombre, coalesce(d.siglas, nullif(m.delegacion_texto, ''), '—') delegacion, m.texto, m.oculto, m.creado
        from jur_show_mensajes m left join jur_delegaciones d on d.id = m.delegacion_id order by m.creado desc limit 120) x), '[]'),
    'ranking', coalesce((select json_agg(r order by r.mensajes desc, r.personas desc) from (select coalesce(d.siglas, nullif(m.delegacion_texto, ''), '—') delegacion,
        count(*) mensajes, count(distinct m.dni) personas from jur_show_mensajes m left join jur_delegaciones d on d.id = m.delegacion_id where not m.oculto
        group by 1) r), '[]'));
end $$;
create or replace function public.jur_admin_show_mensaje(p_codigo text, p_id uuid, p_oculto boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_show_exigir(p_codigo, 'operar');
  update jur_show_mensajes set oculto = coalesce(p_oculto, true) where id = p_id;
end $$;

-- ---------- Archivos de los casos (los llama solo la función Edge con service_role) ----------
create or replace function public.jur_show_autorizar_subida(p_codigo text, p_concurso text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  perform jur_show_exigir(p_codigo, 'editar');
  if p_concurso not in ('amateur-1', 'amateur-2', 'iathon') then raise exception 'Concurso no válido'; end if;
  if coalesce(ext, '') <> 'pdf' then raise exception 'Sube el caso en PDF (es lo que se proyecta)'; end if;
  if coalesce(p_tamano, 0) <= 0 or p_tamano > 52428800 then raise exception 'El archivo debe pesar como máximo 50 MB'; end if;
  return json_build_object('path', 'show/' || p_concurso || '/caso-' || extract(epoch from clock_timestamp())::bigint || '.pdf');
end $$;
create or replace function public.jur_show_confirmar(p_codigo text, p_concurso text, p_path text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare viejo text;
begin
  perform jur_show_exigir(p_codigo, 'editar');
  if p_path not like 'show/' || p_concurso || '/caso-%' then raise exception 'Archivo no válido'; end if;
  if not exists (select 1 from storage.objects s where s.bucket_id = 'jur-presentaciones' and s.name = p_path) then raise exception 'El archivo no llegó completo. Vuelve a subirlo.'; end if;
  select path into viejo from jur_show_archivos where concurso_id = p_concurso;
  insert into jur_show_archivos (concurso_id, path, nombre, tamano, subido) values (p_concurso, p_path, left(p_nombre, 200), p_tamano, now())
  on conflict (concurso_id) do update set path = excluded.path, nombre = excluded.nombre, tamano = excluded.tamano, subido = now();
  return json_build_object('anterior', viejo);
end $$;
create or replace function public.jur_show_autorizar_lectura(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
declare x jur_show_archivos;
begin
  perform jur_show_exigir(p_codigo, 'ver');
  select * into x from jur_show_archivos where concurso_id = p_concurso;
  if not found then raise exception 'Aún no se subió ese caso'; end if;
  return json_build_object('path', x.path, 'nombre', x.nombre);
end $$;
create or replace function public.jur_show_quitar(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
declare viejo text;
begin
  perform jur_show_exigir(p_codigo, 'editar');
  delete from jur_show_archivos where concurso_id = p_concurso returning path into viejo;
  return json_build_object('paths', case when viejo is null then '[]'::json else json_build_array(viejo) end);
end $$;

revoke all on function public.jur_show_nivel(text), public.jur_show_exigir(text, text),
  public.jur_show_autorizar_subida(text, text, text, bigint), public.jur_show_confirmar(text, text, text, text, bigint),
  public.jur_show_autorizar_lectura(text, text), public.jur_show_quitar(text, text) from public, anon, authenticated;
grant execute on function public.jur_show_autorizar_subida(text, text, text, bigint), public.jur_show_confirmar(text, text, text, text, bigint),
  public.jur_show_autorizar_lectura(text, text), public.jur_show_quitar(text, text) to service_role;
revoke all on function public.jur_show_datos(text), public.jur_show_participantes(text), public.jur_admin_show_config(text, jsonb),
  public.jur_admin_show_sponsor(text, uuid, text, text, boolean), public.jur_admin_show_premio(text, uuid, text, text, text, uuid, int, boolean),
  public.jur_show_sortear(text, uuid), public.jur_show_anular(text, uuid, text), public.jur_admin_show_limpiar(text, text),
  public.jur_show_muro_info(), public.jur_show_muro_enviar(text, text), public.jur_show_muro(text), public.jur_admin_show_mensaje(text, uuid, boolean) from public;
grant execute on function public.jur_show_datos(text), public.jur_show_participantes(text), public.jur_admin_show_config(text, jsonb),
  public.jur_admin_show_sponsor(text, uuid, text, text, boolean), public.jur_admin_show_premio(text, uuid, text, text, text, uuid, int, boolean),
  public.jur_show_sortear(text, uuid), public.jur_show_anular(text, uuid, text), public.jur_admin_show_limpiar(text, text),
  public.jur_show_muro_info(), public.jur_show_muro_enviar(text, text), public.jur_show_muro(text), public.jur_admin_show_mensaje(text, uuid, boolean) to anon, authenticated;

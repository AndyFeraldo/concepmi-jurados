-- =========================================================
-- Entregables de concursos (migración jur_10_entregables). Solo agrega tablas y funciones.
-- Cada equipo entra con su código, llena su entregable en línea (Amateur II: matriz de riesgos),
-- se guarda solo y al final lo envía. Jurados y admin lo ven en vivo y se proyecta.
-- =========================================================
create table if not exists public.jur_equipos (
  id uuid primary key default gen_random_uuid(),
  concurso_id text not null references public.jur_concursos(id),
  delegacion_id uuid not null references public.jur_delegaciones(id),
  nombre text not null default '',
  lider text not null default '',
  codigo text not null unique,
  creado timestamptz not null default now(),
  unique (concurso_id, delegacion_id)
);

create table if not exists public.jur_entregas (
  equipo_id uuid primary key references public.jur_equipos(id) on delete cascade,
  datos jsonb not null default '{}',
  estado text not null default 'borrador' check (estado in ('borrador', 'enviado')),
  enviado timestamptz,
  tarde boolean not null default false,
  actualizado timestamptz not null default now()
);

-- Tiempo oficial de llenado por concurso
create table if not exists public.jur_concurso_tiempo (
  concurso_id text primary key references public.jur_concursos(id),
  inicio timestamptz,
  fin timestamptz
);

alter table public.jur_equipos enable row level security;
alter table public.jur_entregas enable row level security;
alter table public.jur_concurso_tiempo enable row level security;
revoke all on public.jur_equipos, public.jur_entregas, public.jur_concurso_tiempo from anon, authenticated;

-- Los códigos son únicos entre jurados, talleristas y equipos
create or replace function public.jur_codigo_usado(p text, p_excepto uuid default null) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from jur_jurados where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_talleristas where codigo = p and id is distinct from p_excepto)
      or exists (select 1 from jur_equipos where codigo = p and id is distinct from p_excepto);
$$;

create or replace function public.jur_entrar(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados; t jur_talleristas; e jur_equipos;
begin
  if jur_es_admin(p_codigo) then return json_build_object('rol', 'admin'); end if;
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'jurado', 'nombre', j.nombre); end if;
  select * into t from jur_talleristas where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'tallerista', 'nombre', t.nombre); end if;
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'equipo', 'nombre', e.nombre); end if;
  perform pg_sleep(0.4);
  return null;
end $$;

create or replace function public.jur_entrega_json(e jur_equipos) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('equipo_id', e.id, 'concurso_id', e.concurso_id, 'delegacion_id', e.delegacion_id, 'nombre', e.nombre, 'lider', e.lider,
    'datos', coalesce(x.datos, '{}'::jsonb), 'estado', coalesce(x.estado, 'borrador'), 'enviado', x.enviado, 'tarde', coalesce(x.tarde, false), 'actualizado', x.actualizado)
  from (select 1) uno left join jur_entregas x on x.equipo_id = e.id;
$$;

create or replace function public.jur_tiempo_json(p_concurso text) returns json
language sql stable security definer set search_path = public as $$
  select json_build_object('inicio', t.inicio, 'fin', t.fin, 'ahora', now()) from (select 1) uno left join jur_concurso_tiempo t on t.concurso_id = p_concurso;
$$;

-- ---------- Equipo ----------
create or replace function public.jur_equipo_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos;
begin
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de equipo incorrecto' using errcode = '28000'; end if;
  return json_build_object('entrega', jur_entrega_json(e), 'tiempo', jur_tiempo_json(e.concurso_id),
    'delegacion', (select json_build_object('id', d.id, 'nombre', d.nombre, 'siglas', d.siglas) from jur_delegaciones d where d.id = e.delegacion_id));
end $$;

-- Guarda el borrador. Se puede editar antes de que empiece el tiempo y hasta que termine (con 1 minuto de gracia).
create or replace function public.jur_equipo_guardar(p_codigo text, p_datos jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; x jur_entregas; t jur_concurso_tiempo;
begin
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de equipo incorrecto' using errcode = '28000'; end if;
  select * into x from jur_entregas where equipo_id = e.id;
  if x.estado = 'enviado' then raise exception 'Tu equipo ya envió el entregable. Pide al organizador que lo reabra si necesitas corregir.'; end if;
  select * into t from jur_concurso_tiempo where concurso_id = e.concurso_id;
  if t.fin is not null and now() > t.fin + interval '1 minute' then raise exception 'Se acabó el tiempo. Ya no se pueden hacer cambios; envía tu entregable.'; end if;
  if length(p_datos::text) > 200000 then raise exception 'El entregable es demasiado largo'; end if;
  insert into jur_entregas (equipo_id, datos, actualizado) values (e.id, p_datos, now())
  on conflict (equipo_id) do update set datos = excluded.datos, actualizado = now();
  return json_build_object('actualizado', now());
end $$;

create or replace function public.jur_equipo_enviar(p_codigo text, p_datos jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; x jur_entregas; t jur_concurso_tiempo; v_tarde boolean;
begin
  select * into e from jur_equipos where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de equipo incorrecto' using errcode = '28000'; end if;
  select * into x from jur_entregas where equipo_id = e.id;
  if x.estado = 'enviado' then raise exception 'Tu equipo ya envió el entregable'; end if;
  select * into t from jur_concurso_tiempo where concurso_id = e.concurso_id;
  v_tarde := t.fin is not null and now() > t.fin + interval '1 minute';
  insert into jur_entregas (equipo_id, datos, estado, enviado, tarde, actualizado)
  values (e.id, case when v_tarde then coalesce(x.datos, '{}') else coalesce(p_datos, '{}') end, 'enviado', now(), v_tarde, now())
  on conflict (equipo_id) do update set datos = excluded.datos, estado = 'enviado', enviado = now(), tarde = excluded.tarde, actualizado = now();
  return json_build_object('enviado', now(), 'tarde', v_tarde);
end $$;

-- ---------- Jurado: ve las entregas de los concursos que tiene asignados ----------
create or replace function public.jur_jurado_entregas(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados;
begin
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de jurado incorrecto' using errcode = '28000'; end if;
  if not (p_concurso = any(j.concursos)) then raise exception 'No estás asignado a este concurso'; end if;
  return json_build_object('tiempo', jur_tiempo_json(p_concurso),
    'entregas', coalesce((select json_agg(jur_entrega_json(e) order by d.nombre) from jur_equipos e join jur_delegaciones d on d.id = e.delegacion_id where e.concurso_id = p_concurso), '[]'));
end $$;

-- ---------- Admin ----------
create or replace function public.jur_admin_entregas(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return json_build_object('tiempo', jur_tiempo_json(p_concurso),
    'equipos', coalesce((select json_agg(json_build_object('id', e.id, 'codigo', e.codigo, 'entrega', jur_entrega_json(e)) order by d.nombre)
      from jur_equipos e join jur_delegaciones d on d.id = e.delegacion_id where e.concurso_id = p_concurso), '[]'));
end $$;

create or replace function public.jur_admin_equipo(p_codigo text, p_id uuid, p_concurso text, p_delegacion uuid, p_nombre text, p_lider text,
  p_borrar boolean default false, p_nuevo_codigo boolean default false, p_codigo_fijo text default null) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; fijo text := nullif(jur_norm(p_codigo_fijo), '');
begin
  perform jur_exigir_admin(p_codigo);
  if p_borrar then delete from jur_equipos where id = p_id; return null; end if;
  if not exists (select 1 from jur_concursos where id = p_concurso) then raise exception 'Concurso no válido'; end if;
  if not exists (select 1 from jur_delegaciones where id = p_delegacion) then raise exception 'Elige la delegación'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otro jurado, tallerista o equipo'; end if;
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

-- p_accion: iniciar (p_minutos) | extender (p_minutos) | detener | reiniciar
create or replace function public.jur_admin_tiempo(p_codigo text, p_concurso text, p_accion text, p_minutos int default 35) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
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

-- Reabre una entrega enviada para que el equipo corrija (queda como borrador)
create or replace function public.jur_admin_entrega_reabrir(p_codigo text, p_equipo uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  update jur_entregas set estado = 'borrador', enviado = null, tarde = false, actualizado = now() where equipo_id = p_equipo;
end $$;

revoke all on function public.jur_entrega_json(jur_equipos), public.jur_tiempo_json(text) from public, anon, authenticated;
grant execute on function public.jur_equipo_datos(text), public.jur_equipo_guardar(text, jsonb), public.jur_equipo_enviar(text, jsonb),
  public.jur_jurado_entregas(text, text), public.jur_admin_entregas(text, text),
  public.jur_admin_equipo(text, uuid, text, uuid, text, text, boolean, boolean, text), public.jur_admin_tiempo(text, text, text, int),
  public.jur_admin_entrega_reabrir(text, uuid) to anon, authenticated;

-- Migración jur_28_casos_confidenciales (aplicada en Supabase)
-- Casos oficiales de Amateur I, Amateur II e IATHON: los suben las encargadas (accesos con permiso «casos»,
-- p. ej. la presidenta). Equipos, jurados y coordinadores los abren recién cuando empieza el concurso («Iniciar
-- tiempo»). El admin puede abrirlos para verificar, pero si lo hace antes queda registrado y lo ven las encargadas.
-- La encargada crea su propio código privado: el admin deja de verlo y no puede cambiarlo.
-- Cada apertura queda registrada. Solo agrega tablas, columnas y funciones.

alter table public.jur_coordinadores add column if not exists codigo_propio boolean not null default false;

create table if not exists public.jur_casos (
  concurso_id text primary key references public.jur_concursos(id),
  path text not null, nombre text not null, tipo text not null check (tipo in ('pdf', 'word')),
  tamano bigint not null default 0, subido_por uuid, subido_por_nombre text, subido timestamptz not null default now()
);
create table if not exists public.jur_casos_vistas (
  id bigint generated always as identity primary key, concurso_id text not null, rol text not null, quien text not null, antes boolean not null default false, momento timestamptz not null default now()
);
alter table public.jur_casos enable row level security;
alter table public.jur_casos_vistas enable row level security;
revoke all on public.jur_casos, public.jur_casos_vistas from anon, authenticated;

-- 1) Permiso «casos» (solo «editar») y una sola persona puede tenerlo
-- 2) Si la persona eligió su propio código, el admin no lo ve ni lo puede cambiar
do $m$
declare f text;
begin
  f := pg_get_functiondef('public.jur_admin_coordinador(text,uuid,text,text[],boolean,text,jsonb)'::regprocedure);
  f := replace(f, $a$'proyeccion', 'diad') then$a$, $a$'proyeccion', 'diad', 'casos') then$a$);
  f := replace(f, $a$  if fijo is not null then$a$, $a$  if fijo is not null and exists (select 1 from jur_coordinadores where id = p_id and codigo_propio) then
    raise exception 'Esta persona eligió su propio código privado: solo ella puede cambiarlo'; end if;
  if fijo is not null then$a$);
  f := replace(f, $a$'codigo', k.codigo$a$, $a$'codigo', case when k.codigo_propio then null else k.codigo end$a$);
  execute f;
  f := pg_get_functiondef('public.jur_admin_coordinadores(text)'::regprocedure);
  f := replace(f, $a$'codigo', k.codigo$a$, $a$'codigo', case when k.codigo_propio then null else k.codigo end, 'codigo_propio', k.codigo_propio$a$);
  execute f;
  f := pg_get_functiondef('public.jur_admin_diad(text)'::regprocedure);
  f := replace(f, $a$'codigo', k.codigo$a$, $a$'codigo', case when k.codigo_propio then null else k.codigo end$a$);
  execute f;
  f := pg_get_functiondef('public.jur_admin_diad_voluntario(text,uuid,jsonb)'::regprocedure);
  f := replace(f, $a$  if fijo is not null then$a$, $a$  if fijo is not null and exists (select 1 from jur_coordinadores where id = p_id and codigo_propio) then
    raise exception 'Esta persona eligió su propio código privado: solo ella puede cambiarlo'; end if;
  if fijo is not null then$a$);
  f := replace(f, $a$'codigo', k.codigo$a$, $a$'codigo', case when k.codigo_propio then null else k.codigo end$a$);
  execute f;
  if pg_get_functiondef('public.jur_admin_coordinador(text,uuid,text,text[],boolean,text,jsonb)'::regprocedure) not like '%codigo_propio%' or
     pg_get_functiondef('public.jur_admin_coordinador(text,uuid,text,text[],boolean,text,jsonb)'::regprocedure) not like '%''casos''%' or
     pg_get_functiondef('public.jur_admin_coordinadores(text)'::regprocedure) not like '%codigo_propio%' or
     pg_get_functiondef('public.jur_admin_diad(text)'::regprocedure) not like '%codigo_propio%' or
     pg_get_functiondef('public.jur_admin_diad_voluntario(text,uuid,jsonb)'::regprocedure) not like '%eligió su propio código%' or
     pg_get_functiondef('public.jur_admin_diad_voluntario(text,uuid,jsonb)'::regprocedure) not like '%when k.codigo_propio then null%' then
    raise exception 'No se pudieron ajustar las funciones de accesos';
  end if;
end $m$;

-- La encargada de casos (con su código privado). Si no, error.
create or replace function public.jur_casos_encargada(p_codigo text) returns public.jur_coordinadores
language plpgsql stable security definer set search_path = public as $$
declare k jur_coordinadores;
begin
  select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
  if not found or coalesce(k.permisos->>'casos', '') <> 'editar' then raise exception 'Este código no puede manejar los casos confidenciales' using errcode = '28000'; end if;
  if not k.codigo_propio then raise exception 'Primero crea tu código privado'; end if;
  return k;
end $$;
revoke all on function public.jur_casos_encargada(text) from public, anon, authenticated;

-- La encargada cambia su propio código (y desde entonces el admin ya no lo ve)
create or replace function public.jur_coord_cambiar_codigo(p_codigo text, p_nuevo text) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; n text := jur_norm(p_nuevo);
begin
  select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
  if not found or coalesce(k.permisos->>'casos', '') <> 'editar' then raise exception 'Este código no puede cambiarse aquí' using errcode = '28000'; end if;
  if n !~ '^[A-Z0-9-]{8,16}$' then raise exception 'Tu código privado debe tener de 8 a 16 letras o números'; end if;
  if n = k.codigo then raise exception 'Elige un código distinto al que te dieron'; end if;
  if jur_es_admin(n) or jur_codigo_usado(n, k.id) then raise exception 'Ese código no se puede usar; elige otro'; end if;
  update jur_coordinadores set codigo = n, codigo_propio = true where id = k.id;
  return json_build_object('ok', true);
end $$;

-- Estado de los casos según quién pregunta
create or replace function public.jur_casos_estado(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; e jur_equipos; j jur_jurados; v_rol text; v_concursos text[] := array['amateur-1', 'amateur-2', 'iathon'];
begin
  if jur_es_admin(p_codigo) then v_rol := 'admin';
  else
    select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
    if found then v_rol := case when coalesce(k.permisos->>'casos', '') = 'editar' then 'encargada' else 'coordinador' end;
    else
      select * into e from jur_equipos where codigo = jur_norm(p_codigo);
      if found then v_rol := 'equipo'; v_concursos := array[e.concurso_id];
      else
        select * into j from jur_jurados where codigo = jur_norm(p_codigo);
        if found then v_rol := 'jurado'; v_concursos := array(select unnest(j.concursos) intersect select unnest(array['amateur-1', 'amateur-2', 'iathon']));
        else raise exception 'Código incorrecto' using errcode = '28000'; end if;
      end if;
    end if;
  end if;
  return json_build_object('rol', v_rol, 'codigo_propio', coalesce(k.codigo_propio, false),
    'encargadas', coalesce((select json_agg(nombre order by nombre) from jur_coordinadores where permisos->>'casos' = 'editar'), '[]'),
    'concursos', (select json_agg(json_build_object(
      'concurso_id', c,
      'subido', x.concurso_id is not null,
      'liberado', t.inicio is not null,
      'fecha', x.subido, 'tipo', x.tipo, 'tamano', x.tamano, 'subido_por', x.subido_por_nombre,
      -- el nombre del archivo solo lo ve la encargada que lo subió, o todos una vez liberado
      'nombre', case when x.concurso_id is not null and (t.inicio is not null or v_rol = 'admin' or (v_rol = 'encargada' and k.codigo_propio)) then x.nombre end,
      'vistas', case when v_rol in ('admin', 'encargada') then coalesce((select json_agg(json_build_object('rol', w.rol, 'quien', w.quien, 'antes', w.antes, 'momento', w.momento) order by w.momento)
                    from jur_casos_vistas w where w.concurso_id = c), '[]') end)
      order by c) from unnest(v_concursos) c left join jur_casos x on x.concurso_id = c left join jur_concurso_tiempo t on t.concurso_id = c));
end $$;

-- (solo la función Edge) Autorizar subida: encargada, antes de que empiece el concurso
create or replace function public.jur_casos_autorizar_subida(p_codigo text, p_concurso text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  k := jur_casos_encargada(p_codigo);
  if p_concurso not in ('amateur-1', 'amateur-2', 'iathon') then raise exception 'Concurso no válido'; end if;
  if exists (select 1 from jur_concurso_tiempo where concurso_id = p_concurso and inicio is not null) then raise exception 'Ese concurso ya empezó: el caso ya no se puede cambiar'; end if;
  if ext not in ('pdf', 'doc', 'docx') then raise exception 'El caso debe ser un PDF o un Word (.pdf, .docx o .doc)'; end if;
  if coalesce(p_tamano, 0) <= 0 or p_tamano > 26214400 then raise exception 'El archivo debe pesar como máximo 25 MB'; end if;
  return json_build_object('path', 'casos/' || p_concurso || '/' || gen_random_uuid() || '.' || ext);
end $$;

-- (solo la función Edge) Confirmar la subida y devolver el archivo anterior para borrarlo
create or replace function public.jur_casos_confirmar(p_codigo text, p_concurso text, p_path text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; ant text; ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  k := jur_casos_encargada(p_codigo);
  if p_path !~ ('^casos/' || p_concurso || '/[0-9a-f-]+\.(pdf|docx?)$') then raise exception 'Archivo no válido'; end if;
  if exists (select 1 from jur_concurso_tiempo where concurso_id = p_concurso and inicio is not null) then raise exception 'Ese concurso ya empezó: el caso ya no se puede cambiar'; end if;
  select path into ant from jur_casos where concurso_id = p_concurso;
  insert into jur_casos (concurso_id, path, nombre, tipo, tamano, subido_por, subido_por_nombre, subido)
  values (p_concurso, p_path, left(p_nombre, 200), case when ext = 'pdf' then 'pdf' else 'word' end, p_tamano, k.id, k.nombre, now())
  on conflict (concurso_id) do update set path = excluded.path, nombre = excluded.nombre, tipo = excluded.tipo, tamano = excluded.tamano,
    subido_por = excluded.subido_por, subido_por_nombre = excluded.subido_por_nombre, subido = now();
  return json_build_object('anterior', ant);
end $$;

-- (solo la función Edge) ¿Quién puede abrir el caso? Las encargadas (con código privado) y el admin, siempre
-- (si el admin lo abre antes del concurso queda marcado «antes»); desde que empieza el concurso, también el equipo,
-- los jurados y los coordinadores de ese concurso. Cada apertura queda registrada.
create or replace function public.jur_casos_autorizar_lectura(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
declare x jur_casos; libre boolean; k jur_coordinadores; e jur_equipos; j jur_jurados; v_rol text; v_quien text;
begin
  select * into x from jur_casos where concurso_id = p_concurso;
  if not found then raise exception 'Todavía no hay un caso para este concurso'; end if;
  libre := exists (select 1 from jur_concurso_tiempo where concurso_id = p_concurso and inicio is not null);
  if jur_es_admin(p_codigo) then v_rol := 'admin'; v_quien := 'Administrador';
  else
    select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
    if found then
      if k.codigo_propio and coalesce(k.permisos->>'casos', '') = 'editar' then v_rol := 'encargada'; v_quien := k.nombre;
      elsif p_concurso = any(k.concursos) or coalesce(k.permisos->>'proyeccion', '') <> '' then v_rol := 'coordinador'; v_quien := k.nombre;
      else raise exception 'Este código no puede abrir este caso'; end if;
    else
      select * into e from jur_equipos where codigo = jur_norm(p_codigo);
      if found and e.concurso_id = p_concurso then v_rol := 'equipo'; v_quien := coalesce((select coalesce(nullif(d.siglas, ''), d.nombre) from jur_delegaciones d where d.id = e.delegacion_id), 'Equipo');
      else
        select * into j from jur_jurados where codigo = jur_norm(p_codigo);
        if found and p_concurso = any(j.concursos) then v_rol := 'jurado'; v_quien := j.nombre;
        else raise exception 'Este código no puede abrir este caso' using errcode = '28000'; end if;
      end if;
    end if;
  end if;
  if v_rol not in ('encargada', 'admin') and not libre then raise exception 'Por confidencialidad, el caso se abre recién cuando empieza el concurso'; end if;
  insert into jur_casos_vistas (concurso_id, rol, quien, antes) values (p_concurso, v_rol, left(v_quien, 120), not libre);
  return json_build_object('path', x.path, 'nombre', x.nombre, 'tipo', x.tipo);
end $$;

-- (solo la función Edge) Quitar el caso: solo la encargada que lo subió y antes de que empiece
create or replace function public.jur_casos_quitar(p_codigo text, p_concurso text) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; x jur_casos;
begin
  k := jur_casos_encargada(p_codigo);
  select * into x from jur_casos where concurso_id = p_concurso;
  if not found then return json_build_object('paths', '[]'::json); end if;
  if exists (select 1 from jur_concurso_tiempo where concurso_id = p_concurso and inicio is not null) then raise exception 'Ese concurso ya empezó: el caso ya no se puede quitar'; end if;
  delete from jur_casos where concurso_id = p_concurso;
  return json_build_object('paths', json_build_array(x.path));
end $$;

revoke all on function public.jur_casos_autorizar_subida(text, text, text, bigint), public.jur_casos_confirmar(text, text, text, text, bigint),
  public.jur_casos_autorizar_lectura(text, text), public.jur_casos_quitar(text, text) from public, anon, authenticated;
grant execute on function public.jur_casos_autorizar_subida(text, text, text, bigint), public.jur_casos_confirmar(text, text, text, text, bigint),
  public.jur_casos_autorizar_lectura(text, text), public.jur_casos_quitar(text, text) to service_role;
revoke all on function public.jur_coord_cambiar_codigo(text, text), public.jur_casos_estado(text) from public;
grant execute on function public.jur_coord_cambiar_codigo(text, text), public.jur_casos_estado(text) to anon, authenticated;

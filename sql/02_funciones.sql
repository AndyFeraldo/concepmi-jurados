alter table public.jur_jurados add column if not exists descripcion text not null default '';
alter table public.jur_jurados add column if not exists foto text not null default '';

-- =========================================================
-- Funciones del Panel de Jurados (todas validan el código)
-- =========================================================

create or replace function public.jur_norm(p text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p,''), '\s', '', 'g')) $$;

create or replace function public.jur_es_admin(p_codigo text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from jur_config where clave = 'admin'
                 and valor = extensions.crypt(jur_norm(p_codigo), valor));
$$;

create or replace function public.jur_exigir_admin(p_codigo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not jur_es_admin(p_codigo) then
    perform pg_sleep(0.4);
    raise exception 'Código de administrador incorrecto' using errcode = '28000';
  end if;
end $$;

create or replace function public.jur_nuevo_codigo() returns text
language plpgsql security definer set search_path = public, extensions as $$
declare a text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; c text;
begin
  loop
    c := '';
    for i in 1..6 loop
      c := c || substr(a, 1 + (get_byte(extensions.gen_random_bytes(1), 0) % length(a)), 1);
    end loop;
    exit when not exists (select 1 from jur_jurados where codigo = c);
  end loop;
  return c;
end $$;

-- ---------- Entrada ----------
create or replace function public.jur_entrar(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados;
begin
  if jur_es_admin(p_codigo) then return json_build_object('rol', 'admin'); end if;
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if found then return json_build_object('rol', 'jurado', 'nombre', j.nombre); end if;
  perform pg_sleep(0.4);
  return null;
end $$;

-- ---------- Jurado ----------
create or replace function public.jur_datos_jurado(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados;
begin
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de jurado incorrecto' using errcode = '28000'; end if;
  return json_build_object(
    'jurado', json_build_object('id', j.id, 'nombre', j.nombre, 'concursos', j.concursos, 'foto', j.foto, 'descripcion', j.descripcion),
    'delegaciones', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'siglas', siglas) order by nombre) from jur_delegaciones), '[]'),
    'abiertos', (select json_object_agg(id, abierto) from jur_concursos),
    'calificaciones', coalesce((select json_agg(json_build_object('id', id, 'concurso_id', concurso_id, 'subprueba', subprueba,
        'delegacion_id', delegacion_id, 'datos', datos, 'total', total, 'comentario', comentario, 'actualizado', actualizado))
      from jur_calificaciones where jurado_id = j.id), '[]')
  );
end $$;

create or replace function public.jur_calificar(p_codigo text, p_concurso text, p_subprueba text,
  p_delegacion uuid, p_datos jsonb, p_comentario text default '') returns json
language plpgsql security definer set search_path = public as $$
declare
  j jur_jurados; v numeric; t numeric := 0; n int := 0; k record; d jsonb := '{}'::jsonb; r jur_calificaciones;
begin
  select * into j from jur_jurados where codigo = jur_norm(p_codigo);
  if not found then raise exception 'Código de jurado incorrecto' using errcode = '28000'; end if;
  if not (p_concurso = any(j.concursos)) then raise exception 'No estás asignado a este concurso'; end if;
  if not exists (select 1 from jur_concursos where id = p_concurso and abierto) then
    raise exception 'La calificación de este concurso ya está cerrada'; end if;
  if not exists (select 1 from jur_delegaciones where id = p_delegacion) then raise exception 'Delegación no encontrada'; end if;

  if p_concurso = 'gymkana' then
    if p_subprueba = 'sacos' then
      v := (p_datos->>'conteo')::numeric;
      if v is null or v <> trunc(v) or v < 0 or v > 16 then raise exception 'Los checks van de 0 a 16'; end if;
      d := jsonb_build_object('conteo', v); t := v;
    elsif p_subprueba in ('baileton', 'liga', 'globos') then
      v := (p_datos->>'puesto')::numeric;
      n := 7;
      if p_subprueba = 'baileton' then n := 5; elsif p_subprueba = 'liga' then n := 4; end if;
      if v is null or v <> trunc(v) or v < 1 or v > n then raise exception 'Puesto no válido'; end if;
      d := jsonb_build_object('puesto', v); t := v;
    elsif p_subprueba = 'pentatlon' then
      v := (p_datos->>'segundos')::numeric;
      n := coalesce((p_datos->>'estaciones')::int, 5);
      if v is null or v < 0 or v > 300 then raise exception 'El tiempo va de 0:00 a 5:00'; end if;
      if v < 300 then n := 5; end if;
      if n < 0 or n > 5 then raise exception 'Las estaciones van de 0 a 5'; end if;
      d := jsonb_build_object('segundos', round(v, 2), 'estaciones', n); t := round(v, 2);
    else
      raise exception 'Minijuego no válido';
    end if;
  else
    if not exists (select 1 from jur_criterios where concurso_id = p_concurso and subprueba = p_subprueba) then
      raise exception 'Este concurso no se califica con rúbrica'; end if;
    for k in select * from jur_criterios where concurso_id = p_concurso and subprueba = p_subprueba loop
      v := (p_datos->>k.criterio_id)::numeric;
      if v is null then raise exception 'Falta calificar un criterio'; end if;
      if v < 0 or v > k.max or v * 2 <> trunc(v * 2) then raise exception 'Puntaje fuera de rango en un criterio'; end if;
      if k.niveles is not null and not (v = any(k.niveles)) then raise exception 'Nivel de desempeño no válido'; end if;
      d := d || jsonb_build_object(k.criterio_id, v); t := t + v;
    end loop;
  end if;

  insert into jur_calificaciones (concurso_id, subprueba, delegacion_id, jurado_id, datos, total, comentario)
  values (p_concurso, p_subprueba, p_delegacion, j.id, d, t, left(coalesce(p_comentario, ''), 600))
  on conflict (concurso_id, subprueba, delegacion_id, jurado_id)
  do update set datos = excluded.datos, total = excluded.total, comentario = excluded.comentario, actualizado = now()
  returning * into r;
  return json_build_object('id', r.id, 'total', r.total, 'actualizado', r.actualizado);
end $$;

-- ---------- Administrador ----------
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
        'retraso', retraso, 'walkover', walkover, 'descalificado', descalificado, 'valor', valor, 'nota', nota)) from jur_ajustes), '[]')
  );
end $$;

create or replace function public.jur_admin_delegacion(p_codigo text, p_id uuid, p_nombre text, p_siglas text, p_borrar boolean default false)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  if p_borrar then delete from jur_delegaciones where id = p_id; return; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre de la delegación'; end if;
  if p_id is null then
    insert into jur_delegaciones (nombre, siglas) values (trim(p_nombre), upper(trim(coalesce(p_siglas, ''))));
  else
    update jur_delegaciones set nombre = trim(p_nombre), siglas = upper(trim(coalesce(p_siglas, ''))) where id = p_id;
  end if;
end $$;

drop function if exists public.jur_admin_jurado(text, uuid, text, text[], boolean, boolean);
create or replace function public.jur_admin_jurado(p_codigo text, p_id uuid, p_nombre text, p_concursos text[],
  p_descripcion text default '', p_foto text default null, p_borrar boolean default false, p_nuevo_codigo boolean default false)
returns json language plpgsql security definer set search_path = public as $$
declare j jur_jurados;
begin
  perform jur_exigir_admin(p_codigo);
  if p_borrar then delete from jur_jurados where id = p_id; return null; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre completo del jurado'; end if;
  if coalesce(array_length(p_concursos, 1), 0) = 0 then raise exception 'Elige al menos un concurso'; end if;
  if exists (select 1 from unnest(p_concursos) c where c not in (select id from jur_concursos)) then
    raise exception 'Concurso no válido'; end if;
  if p_foto is not null and length(p_foto) > 450000 then raise exception 'La foto es muy pesada'; end if;
  if p_id is null then
    insert into jur_jurados (nombre, codigo, concursos, descripcion, foto)
    values (trim(p_nombre), jur_nuevo_codigo(), p_concursos, left(coalesce(p_descripcion, ''), 400), coalesce(p_foto, ''))
    returning * into j;
  else
    update jur_jurados set nombre = trim(p_nombre), concursos = p_concursos, descripcion = left(coalesce(p_descripcion, ''), 400),
      foto = coalesce(p_foto, foto),
      codigo = case when p_nuevo_codigo then jur_nuevo_codigo() else codigo end
    where id = p_id returning * into j;
  end if;
  return json_build_object('id', j.id, 'codigo', j.codigo);
end $$;

create or replace function public.jur_admin_ajuste(p_codigo text, p_concurso text, p_delegacion uuid,
  p_retraso boolean, p_walkover boolean, p_descalificado boolean, p_valor numeric, p_nota text default '')
returns void language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  if p_valor is not null then
    if p_concurso = 'conocimientos' and (p_valor < 0 or p_valor > 70 or p_valor <> trunc(p_valor)) then
      raise exception 'Conocimientos: puntos enteros de 0 a 70'; end if;
    if p_concurso = 'talent' and (p_valor < 1 or p_valor > 99 or p_valor <> trunc(p_valor)) then
      raise exception 'Talent Show: el puesto debe ser un número entero desde 1'; end if;
    if p_concurso not in ('conocimientos', 'talent') then raise exception 'Este concurso no admite puntaje manual'; end if;
  end if;
  insert into jur_ajustes (concurso_id, delegacion_id, retraso, walkover, descalificado, valor, nota)
  values (p_concurso, p_delegacion, coalesce(p_retraso, false), coalesce(p_walkover, false), coalesce(p_descalificado, false), p_valor, coalesce(p_nota, ''))
  on conflict (concurso_id, delegacion_id) do update set retraso = excluded.retraso, walkover = excluded.walkover,
    descalificado = excluded.descalificado, valor = excluded.valor, nota = excluded.nota, actualizado = now();
end $$;

create or replace function public.jur_admin_concurso(p_codigo text, p_concurso text, p_abierto boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  update jur_concursos set abierto = p_abierto where id = p_concurso;
end $$;

create or replace function public.jur_admin_borrar_calificacion(p_codigo text, p_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  delete from jur_calificaciones where id = p_id;
end $$;

create or replace function public.jur_admin_clave(p_codigo text, p_nueva text)
returns void language plpgsql security definer set search_path = public, extensions as $$
begin
  perform jur_exigir_admin(p_codigo);
  if length(jur_norm(p_nueva)) < 6 then raise exception 'El código debe tener al menos 6 caracteres'; end if;
  if exists (select 1 from jur_jurados where codigo = jur_norm(p_nueva)) then raise exception 'Ese código ya lo usa un jurado'; end if;
  update jur_config set valor = extensions.crypt(jur_norm(p_nueva), extensions.gen_salt('bf')) where clave = 'admin';
end $$;

-- Permisos: solo estas funciones son públicas
revoke all on function public.jur_es_admin(text), public.jur_exigir_admin(text), public.jur_nuevo_codigo() from public, anon, authenticated;
grant execute on function public.jur_entrar(text), public.jur_datos_jurado(text),
  public.jur_calificar(text, text, text, uuid, jsonb, text), public.jur_admin_datos(text),
  public.jur_admin_delegacion(text, uuid, text, text, boolean), public.jur_admin_jurado(text, uuid, text, text[], text, text, boolean, boolean),
  public.jur_admin_ajuste(text, text, uuid, boolean, boolean, boolean, numeric, text), public.jur_admin_concurso(text, text, boolean),
  public.jur_admin_borrar_calificacion(text, uuid), public.jur_admin_clave(text, text) to anon, authenticated;

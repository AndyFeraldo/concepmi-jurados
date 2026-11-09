-- Migración jur_29_casos_resolucion (aplicada en Supabase)
-- Cada concurso con caso confidencial tiene 2 archivos: «caso» (lo ven equipos, jurados y coordinadores
-- desde «Iniciar tiempo») y «solucion» = resolución de referencia (solo jurados de ese concurso desde
-- «Iniciar tiempo»). La encargada y el admin pueden abrir ambos siempre (queda registrado).
-- jur_casos estaba vacía: se cambia su llave a (concurso_id, parte). Las funciones de la función Edge
-- reciben ahora p_parte (las versiones viejas se quitan).

alter table public.jur_casos add column if not exists parte text not null default 'caso';
alter table public.jur_casos drop constraint if exists jur_casos_parte_check;
alter table public.jur_casos add constraint jur_casos_parte_check check (parte in ('caso', 'solucion'));
alter table public.jur_casos drop constraint if exists jur_casos_pkey;
alter table public.jur_casos add primary key (concurso_id, parte);
alter table public.jur_casos_vistas add column if not exists parte text not null default 'caso';

drop function if exists public.jur_casos_autorizar_subida(text, text, text, bigint);
drop function if exists public.jur_casos_confirmar(text, text, text, text, bigint);
drop function if exists public.jur_casos_autorizar_lectura(text, text);
drop function if exists public.jur_casos_quitar(text, text);

create or replace function public.jur_casos_parte(p text) returns text
language sql immutable as $$ select case when p in ('caso', 'solucion') then p else null end $$;

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
      'liberado', exists (select 1 from jur_concurso_tiempo t where t.concurso_id = c and t.inicio is not null),
      'partes', (select json_object_agg(pt, (select case when x.concurso_id is null then null else json_build_object(
            'fecha', x.subido, 'tipo', x.tipo, 'tamano', x.tamano, 'subido_por', x.subido_por_nombre,
            'nombre', case when v_rol = 'admin' or (v_rol = 'encargada' and k.codigo_propio)
                             or exists (select 1 from jur_concurso_tiempo t where t.concurso_id = c and t.inicio is not null) then x.nombre end,
            'vistas', case when v_rol in ('admin', 'encargada') then coalesce((select json_agg(json_build_object('rol', w.rol, 'quien', w.quien, 'antes', w.antes, 'momento', w.momento) order by w.momento)
                        from jur_casos_vistas w where w.concurso_id = c and w.parte = pt), '[]') end) end
            from (select 1) uno left join jur_casos x on x.concurso_id = c and x.parte = pt))
        -- la resolución no existe para equipos ni coordinadores
        from unnest(case when v_rol in ('equipo', 'coordinador') then array['caso'] else array['caso', 'solucion'] end) pt))
      order by c) from unnest(v_concursos) c));
end $$;

create or replace function public.jur_casos_autorizar_subida(p_codigo text, p_concurso text, p_parte text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  k := jur_casos_encargada(p_codigo);
  if jur_casos_parte(p_parte) is null then raise exception 'Archivo no válido'; end if;
  if p_concurso not in ('amateur-1', 'amateur-2', 'iathon') then raise exception 'Concurso no válido'; end if;
  if exists (select 1 from jur_concurso_tiempo where concurso_id = p_concurso and inicio is not null) then raise exception 'Ese concurso ya empezó: el archivo ya no se puede cambiar'; end if;
  if ext not in ('pdf', 'doc', 'docx') then raise exception 'Debe ser un PDF o un Word (.pdf, .docx o .doc)'; end if;
  if coalesce(p_tamano, 0) <= 0 or p_tamano > 26214400 then raise exception 'El archivo debe pesar como máximo 25 MB'; end if;
  return json_build_object('path', 'casos/' || p_concurso || '/' || p_parte || '-' || gen_random_uuid() || '.' || ext);
end $$;

create or replace function public.jur_casos_confirmar(p_codigo text, p_concurso text, p_parte text, p_path text, p_nombre text, p_tamano bigint) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; ant text; ext text := lower(substring(coalesce(p_nombre, '') from '\.([A-Za-z0-9]+)$'));
begin
  k := jur_casos_encargada(p_codigo);
  if jur_casos_parte(p_parte) is null then raise exception 'Archivo no válido'; end if;
  if p_path !~ ('^casos/' || p_concurso || '/' || p_parte || '-[0-9a-f-]+\.(pdf|docx?)$') then raise exception 'Archivo no válido'; end if;
  if exists (select 1 from jur_concurso_tiempo where concurso_id = p_concurso and inicio is not null) then raise exception 'Ese concurso ya empezó: el archivo ya no se puede cambiar'; end if;
  select path into ant from jur_casos where concurso_id = p_concurso and parte = p_parte;
  insert into jur_casos (concurso_id, parte, path, nombre, tipo, tamano, subido_por, subido_por_nombre, subido)
  values (p_concurso, p_parte, p_path, left(p_nombre, 200), case when ext = 'pdf' then 'pdf' else 'word' end, p_tamano, k.id, k.nombre, now())
  on conflict (concurso_id, parte) do update set path = excluded.path, nombre = excluded.nombre, tipo = excluded.tipo, tamano = excluded.tamano,
    subido_por = excluded.subido_por, subido_por_nombre = excluded.subido_por_nombre, subido = now();
  return json_build_object('anterior', ant);
end $$;

-- Caso: encargada y admin siempre; equipo, jurados y coordinadores de ese concurso desde «Iniciar tiempo».
-- Resolución: encargada y admin siempre; SOLO jurados de ese concurso desde «Iniciar tiempo». Todo queda registrado.
create or replace function public.jur_casos_autorizar_lectura(p_codigo text, p_concurso text, p_parte text) returns json
language plpgsql security definer set search_path = public as $$
declare x jur_casos; libre boolean; k jur_coordinadores; e jur_equipos; j jur_jurados; v_rol text; v_quien text;
begin
  if jur_casos_parte(p_parte) is null then raise exception 'Archivo no válido'; end if;
  select * into x from jur_casos where concurso_id = p_concurso and parte = p_parte;
  if not found then raise exception '%', case when p_parte = 'caso' then 'Todavía no hay un caso para este concurso' else 'Todavía no hay una resolución para este concurso' end; end if;
  libre := exists (select 1 from jur_concurso_tiempo where concurso_id = p_concurso and inicio is not null);
  if jur_es_admin(p_codigo) then v_rol := 'admin'; v_quien := 'Administrador';
  else
    select * into k from jur_coordinadores where codigo = jur_norm(p_codigo);
    if found then
      if k.codigo_propio and coalesce(k.permisos->>'casos', '') = 'editar' then v_rol := 'encargada'; v_quien := k.nombre;
      elsif p_parte = 'caso' and (p_concurso = any(k.concursos) or coalesce(k.permisos->>'proyeccion', '') <> '') then v_rol := 'coordinador'; v_quien := k.nombre;
      else raise exception 'Este código no puede abrir este archivo'; end if;
    else
      select * into e from jur_equipos where codigo = jur_norm(p_codigo);
      if found and e.concurso_id = p_concurso and p_parte = 'caso' then v_rol := 'equipo'; v_quien := coalesce((select coalesce(nullif(d.siglas, ''), d.nombre) from jur_delegaciones d where d.id = e.delegacion_id), 'Equipo');
      else
        select * into j from jur_jurados where codigo = jur_norm(p_codigo);
        if found and p_concurso = any(j.concursos) then v_rol := 'jurado'; v_quien := j.nombre;
        else raise exception 'Este código no puede abrir este archivo' using errcode = '28000'; end if;
      end if;
    end if;
  end if;
  if v_rol not in ('encargada', 'admin') and not libre then raise exception 'Por confidencialidad, se abre recién cuando empieza el concurso'; end if;
  insert into jur_casos_vistas (concurso_id, parte, rol, quien, antes) values (p_concurso, p_parte, v_rol, left(v_quien, 120), not libre);
  return json_build_object('path', x.path, 'nombre', x.nombre, 'tipo', x.tipo);
end $$;

create or replace function public.jur_casos_quitar(p_codigo text, p_concurso text, p_parte text) returns json
language plpgsql security definer set search_path = public as $$
declare k jur_coordinadores; x jur_casos;
begin
  k := jur_casos_encargada(p_codigo);
  select * into x from jur_casos where concurso_id = p_concurso and parte = p_parte;
  if not found then return json_build_object('paths', '[]'::json); end if;
  if exists (select 1 from jur_concurso_tiempo where concurso_id = p_concurso and inicio is not null) then raise exception 'Ese concurso ya empezó: el archivo ya no se puede quitar'; end if;
  delete from jur_casos where concurso_id = p_concurso and parte = p_parte;
  return json_build_object('paths', json_build_array(x.path));
end $$;

revoke all on function public.jur_casos_autorizar_subida(text, text, text, text, bigint), public.jur_casos_confirmar(text, text, text, text, text, bigint),
  public.jur_casos_autorizar_lectura(text, text, text), public.jur_casos_quitar(text, text, text) from public, anon, authenticated;
grant execute on function public.jur_casos_autorizar_subida(text, text, text, text, bigint), public.jur_casos_confirmar(text, text, text, text, text, bigint),
  public.jur_casos_autorizar_lectura(text, text, text), public.jur_casos_quitar(text, text, text) to service_role;

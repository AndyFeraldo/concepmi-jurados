-- =========================================================
-- jur_38_asistentes_contacto · Celular y correo de los inscritos, para contactar a los ganadores del
-- sorteo de becas. Solo AGREGA: 2 columnas en jur_asistentes y ajusta 2 funciones.
--   · jur_admin_asistentes: guarda celular y correo si el Excel los trae (si no, conserva los que había).
--   · jur_show_datos: cada ganador trae celular y correo (cruzado por DNI) SOLO para Show «editar» / admin.
-- =========================================================
alter table public.jur_asistentes add column if not exists telefono text not null default '';
alter table public.jur_asistentes add column if not exists correo text not null default '';

create or replace function public.jur_admin_asistentes(p_codigo text, p_filas jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare x jsonb; n int := 0; d text; del uuid;
begin
  perform jur_exigir_permiso(p_codigo, 'charlas', 'editar');
  if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Lista no válida'; end if;
  for x in select * from jsonb_array_elements(p_filas) loop
    d := jur_norm_dni(x->>'dni');
    if d = '' or coalesce(trim(x->>'nombre'), '') = '' then continue; end if;
    del := null;
    if coalesce(x->>'delegacion_id', '') <> '' then select id into del from jur_delegaciones where id::text = x->>'delegacion_id'; end if;
    insert into jur_asistentes (dni, codigo, nombre, delegacion_id, delegacion_texto, telefono, correo, actualizado)
    values (d, left(coalesce(x->>'codigo', ''), 40), left(trim(x->>'nombre'), 160), del, left(coalesce(x->>'delegacion_texto', ''), 160),
            left(trim(coalesce(x->>'telefono', '')), 40), left(lower(trim(coalesce(x->>'correo', ''))), 160), now())
    on conflict (dni) do update set codigo = excluded.codigo, nombre = excluded.nombre, delegacion_id = excluded.delegacion_id,
      delegacion_texto = excluded.delegacion_texto,
      telefono = coalesce(nullif(excluded.telefono, ''), jur_asistentes.telefono),
      correo = coalesce(nullif(excluded.correo, ''), jur_asistentes.correo), actualizado = now();
    n := n + 1;
  end loop;
  return json_build_object('importados', n, 'total', (select count(*) from jur_asistentes),
    'sin_delegacion', (select count(*) from jur_asistentes where delegacion_id is null),
    'con_contacto', (select count(*) from jur_asistentes where telefono <> '' or correo <> ''));
end $$;

create or replace function public.jur_show_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
declare ed boolean;
begin
  perform jur_show_exigir(p_codigo, 'ver');
  ed := jur_show_nivel(p_codigo) = 'editar';
  return json_build_object(
    'nivel', jur_show_nivel(p_codigo),
    'config', coalesce((select datos from jur_show where clave = 'general'), '{}'::jsonb),
    'sponsors', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'logo', logo, 'orden', orden) order by orden, creado) from jur_show_sponsors), '[]'),
    'premios', coalesce((select json_agg(json_build_object('id', p.id, 'tipo', p.tipo, 'titulo', p.titulo, 'detalle', p.detalle, 'sponsor_id', p.sponsor_id,
        'cantidad', p.cantidad, 'orden', p.orden, 'sorteados', (select count(*) from jur_show_ganadores g where g.premio_id = p.id and not g.anulado)) order by p.orden, p.creado) from jur_show_premios p), '[]'),
    'ganadores', coalesce((select json_agg(json_build_object('id', g.id, 'premio_id', g.premio_id, 'codigo', g.codigo, 'nombre', g.nombre,
        'delegacion', coalesce(d.siglas, nullif(g.delegacion_texto, ''), '—'), 'delegacion_nombre', coalesce(d.nombre, g.delegacion_texto), 'anulado', g.anulado, 'motivo', g.motivo, 'creado', g.creado,
        'dni', case when ed then g.dni end, 'telefono', case when ed then a.telefono end, 'correo', case when ed then a.correo end) order by g.creado)
      from jur_show_ganadores g left join jur_delegaciones d on d.id = g.delegacion_id left join jur_asistentes a on a.dni = g.dni), '[]'),
    'archivos', coalesce((select json_object_agg(concurso_id, json_build_object('nombre', nombre, 'tamano', tamano, 'subido', subido)) from jur_show_archivos), '{}'::json),
    'participantes', (select count(*) from jur_asistentes where coalesce(codigo, '') <> ''),
    'mensajes', (select count(*) from jur_show_mensajes where not oculto));
end $$;

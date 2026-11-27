-- =========================================================
-- jur_39_show_becas_organizadores · Becas para el EQUIPO ORGANIZADOR (voluntarios y líderes).
-- Solo AGREGA: 4 columnas en jur_show_ganadores, 1 función nueva y ajusta jur_show_datos.
--   · tipo  = 'inscrito' (sorteo de siempre) | 'organizador'
--   · modo  = 'sorteo' | 'elegido' (el admin lo eligió a mano)
--   · area, telefono = datos del voluntario (no está en jur_asistentes)
--   · jur_show_asignar_org: guarda de una vez uno o varios voluntarios como ganadores de un premio
--     (la lista viene de Certificados → Equipo organizador + Día D). Solo admin / Show «editar».
-- =========================================================
alter table public.jur_show_ganadores add column if not exists tipo text not null default 'inscrito';
alter table public.jur_show_ganadores add column if not exists modo text not null default 'sorteo';
alter table public.jur_show_ganadores add column if not exists area text not null default '';
alter table public.jur_show_ganadores add column if not exists telefono text not null default '';

create or replace function public.jur_show_asignar_org(p_codigo text, p_premio uuid, p_personas jsonb, p_modo text default 'sorteo') returns json
language plpgsql security definer set search_path = public as $$
declare p jur_show_premios; x jsonb; v_clave text; v_nombre text; n int := 0; libres int;
begin
  perform jur_show_exigir(p_codigo, 'editar');
  if jsonb_typeof(p_personas) is distinct from 'array' or jsonb_array_length(p_personas) = 0 then raise exception 'Elige al menos una persona'; end if;
  select * into p from jur_show_premios where id = p_premio for update;
  if not found then raise exception 'Ese premio ya no existe'; end if;
  libres := p.cantidad - (select count(*) from jur_show_ganadores where premio_id = p.id and not anulado);
  if jsonb_array_length(p_personas) > libres then raise exception 'Solo quedan % cupos en este premio', greatest(libres, 0); end if;
  for x in select * from jsonb_array_elements(p_personas) loop
    v_nombre := left(trim(regexp_replace(coalesce(x->>'nombre', ''), '\s+', ' ', 'g')), 160);
    v_clave := 'org:' || left(lower(coalesce(nullif(trim(x->>'clave'), ''), v_nombre)), 150);
    if length(v_nombre) < 2 then raise exception 'Falta el nombre de una persona'; end if;
    if exists (select 1 from jur_show_ganadores where premio_id = p.id and dni = v_clave and not anulado) then
      raise exception '% ya tiene este mismo premio', v_nombre; end if;
    insert into jur_show_ganadores (premio_id, dni, codigo, nombre, delegacion_id, delegacion_texto, tipo, modo, area, telefono)
    values (p.id, v_clave, '', v_nombre, null, 'Equipo organizador', 'organizador',
            case when p_modo = 'elegido' then 'elegido' else 'sorteo' end,
            left(coalesce(x->>'area', ''), 60), left(trim(coalesce(x->>'telefono', '')), 40));
    n := n + 1;
  end loop;
  return json_build_object('guardados', n);
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
        'tipo', g.tipo, 'modo', g.modo, 'area', g.area,
        'dni', case when ed then g.dni end, 'telefono', case when ed then coalesce(nullif(a.telefono, ''), nullif(g.telefono, '')) end, 'correo', case when ed then a.correo end) order by g.creado)
      from jur_show_ganadores g left join jur_delegaciones d on d.id = g.delegacion_id left join jur_asistentes a on a.dni = g.dni), '[]'),
    'archivos', coalesce((select json_object_agg(concurso_id, json_build_object('nombre', nombre, 'tamano', tamano, 'subido', subido)) from jur_show_archivos), '{}'::json),
    'participantes', (select count(*) from jur_asistentes where coalesce(codigo, '') <> ''),
    'mensajes', (select count(*) from jur_show_mensajes where not oculto));
end $$;

revoke all on function public.jur_show_asignar_org(text, uuid, jsonb, text) from public;
grant execute on function public.jur_show_asignar_org(text, uuid, jsonb, text) to anon, authenticated;

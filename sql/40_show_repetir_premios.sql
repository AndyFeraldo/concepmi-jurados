-- =========================================================
-- jur_40_show_repetir_premios · Una persona puede ganar MÁS DE UN premio del sorteo de becas,
-- pero nunca dos veces el mismo premio (tampoco vuelve a salir en un premio donde fue anulada).
-- Solo ajusta jur_show_sortear (no borra nada).
-- =========================================================
create or replace function public.jur_show_sortear(p_codigo text, p_premio uuid) returns json
language plpgsql security definer set search_path = public as $$
declare p jur_show_premios; a jur_asistentes; g jur_show_ganadores; d jur_delegaciones;
begin
  perform jur_show_exigir(p_codigo, 'operar');
  select * into p from jur_show_premios where id = p_premio for update;
  if not found then raise exception 'Ese premio ya no existe'; end if;
  if (select count(*) from jur_show_ganadores where premio_id = p.id and not anulado) >= p.cantidad then raise exception 'Ya se sortearon todos los premios de este tipo'; end if;
  select * into a from jur_asistentes x
  where coalesce(x.codigo, '') <> ''
    and not exists (select 1 from jur_show_ganadores g3 where g3.dni = x.dni and g3.premio_id = p.id)
  order by random() limit 1;
  if not found then raise exception 'Ya no quedan participantes que no tengan este premio'; end if;
  insert into jur_show_ganadores (premio_id, dni, codigo, nombre, delegacion_id, delegacion_texto)
  values (p.id, a.dni, a.codigo, a.nombre, a.delegacion_id, coalesce(a.delegacion_texto, '')) returning * into g;
  select * into d from jur_delegaciones where id = a.delegacion_id;
  return json_build_object('id', g.id, 'premio_id', p.id, 'codigo', g.codigo, 'nombre', g.nombre,
    'delegacion', coalesce(d.siglas, nullif(g.delegacion_texto, ''), '—'), 'delegacion_nombre', coalesce(d.nombre, g.delegacion_texto));
end $$;

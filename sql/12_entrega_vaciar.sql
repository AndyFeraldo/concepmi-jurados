-- =========================================================
-- Borrar la respuesta de un equipo (migración jur_12_entrega_vaciar). Para pruebas.
-- Deja la entrega en blanco y como borrador. NO toca el equipo, su código,
-- delegaciones ni calificaciones. Admin o coordinador del concurso.
-- =========================================================
create or replace function public.jur_admin_entrega_vaciar(p_codigo text, p_equipo uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_concurso text;
begin
  select concurso_id into v_concurso from jur_equipos where id = p_equipo;
  if v_concurso is null then raise exception 'Ese equipo ya no existe'; end if;
  perform jur_exigir_sala(p_codigo, v_concurso);
  update jur_entregas set datos = '{}', estado = 'borrador', enviado = null, tarde = false, actualizado = now() where equipo_id = p_equipo;
end $$;
grant execute on function public.jur_admin_entrega_vaciar(text, uuid) to anon, authenticated;

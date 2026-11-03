-- =========================================================
-- Vínculo con el sistema del Concurso de Conocimientos (migración jur_15_conocimientos_vinculo).
-- Solo LECTURA de su tabla public.enfrentamientos: el panel nunca escribe ni borra en ella.
-- =========================================================
-- 1) Lista pública de delegaciones (siglas y nombre) para el desplegable del moderador del concurso.
create or replace function public.jur_delegaciones_lista() returns json
language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(json_build_object('siglas', coalesce(nullif(trim(siglas), ''), nombre), 'nombre', nombre) order by coalesce(nullif(trim(siglas), ''), nombre)), '[]')
  from jur_delegaciones;
$$;
grant execute on function public.jur_delegaciones_lista() to anon, authenticated;

-- 2) Enfrentamientos terminados y no anulados, para «Traer resultados del concurso» (solo admin, con confirmación).
create or replace function public.jur_admin_conocimientos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return coalesce((select json_agg(json_build_object('id', e.id, 'creado', e.creado, 'nombre_a', e.nombre_a, 'nombre_b', e.nombre_b,
      'puntaje_a', e.puntaje_a, 'puntaje_b', e.puntaje_b, 'ganador', e.ganador, 'correctas_a', e.correctas_a, 'correctas_b', e.correctas_b) order by e.creado)
    from public.enfrentamientos e where not coalesce(e.anulado, false)), '[]');
end $$;
grant execute on function public.jur_admin_conocimientos(text) to anon, authenticated;

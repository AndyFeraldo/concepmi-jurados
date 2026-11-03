-- =========================================================
-- Borrar ganadores de un taller (migración jur_14_taller_borrar_ganadores). Para pruebas.
-- Solo admin. Borra el registro de jur_taller_ganadores de ese taller; no toca
-- talleres, talleristas, sus códigos ni calificaciones.
-- =========================================================
create or replace function public.jur_admin_taller_borrar(p_codigo text, p_taller text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  if not exists (select 1 from jur_talleres where id = p_taller) then raise exception 'Taller no válido'; end if;
  delete from jur_taller_ganadores where taller_id = p_taller;
end $$;
grant execute on function public.jur_admin_taller_borrar(text, text) to anon, authenticated;

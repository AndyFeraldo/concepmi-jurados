-- =========================================================
-- Reiniciar historial de exportaciones de Conocimientos (migración jur_17_conoc_exportaciones_reiniciar). Para pruebas.
-- Solo admin. Borra únicamente las marcas de jur_conoc_exportaciones; no toca enfrentamientos, ajustes ni la Copa.
-- =========================================================
create or replace function public.jur_admin_conoc_reiniciar(p_codigo text) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  delete from jur_conoc_exportaciones where true;
end $$;
grant execute on function public.jur_admin_conoc_reiniciar(text) to anon, authenticated;

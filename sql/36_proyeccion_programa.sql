-- Migración jur_36_proyeccion_programa (solo ajusta una regla).
-- El operador de Proyección (acceso con permiso «proyeccion») puede EDITAR el programa de la inauguración
-- desde su Panel de Proyección (antes solo Charlas «editar»). No toca datos.
create or replace function public.jur_admin_programa(p_codigo text, p_clave text, p_datos jsonb) returns json
language plpgsql security definer set search_path = public as $$
begin
  if not jur_permiso(p_codigo, 'proyeccion', 'ver') then perform jur_exigir_permiso(p_codigo, 'charlas', 'editar'); end if;
  if p_clave not in ('inauguracion') then raise exception 'Programa no válido'; end if;
  if length(p_datos::text) > 60000 then raise exception 'El programa es muy largo'; end if;
  insert into jur_programa (clave, datos, actualizado) values (p_clave, coalesce(p_datos, '{}'::jsonb), now())
  on conflict (clave) do update set datos = excluded.datos, actualizado = now();
  return json_build_object('ok', true);
end $$;

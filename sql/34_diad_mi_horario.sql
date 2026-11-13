-- =========================================================
-- Migración jur_34_diad_mi_horario (solo ajusta una función).
-- La guía del voluntario (jur_diad_mio) devuelve también SU disponibilidad (la que el admin marcó en
-- Día D → Voluntarios), para mostrarle «Tu horario disponible». Solo la de la propia persona; no la de otros.
-- =========================================================
do $m$
declare f text;
begin
  f := pg_get_functiondef('public.jur_diad_mio(text)'::regprocedure);
  if f not like '%''disponibilidad''%' then
    f := replace(f, $a$'concursos', k.concursos, 'permisos', k.permisos)$a$, $a$'concursos', k.concursos, 'permisos', k.permisos, 'disponibilidad', k.disponibilidad)$a$);
    if f not like '%''disponibilidad''%' then raise exception 'No se pudo ajustar jur_diad_mio'; end if;
    execute f;
  end if;
end $m$;

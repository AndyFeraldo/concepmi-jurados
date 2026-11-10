-- Migración jur_30_iathon_sin_resolucion (aplicada en Supabase)
-- IATHON no lleva resolución (la solución la crean los equipos con IA): solo el caso.
do $m$
declare f text;
begin
  f := pg_get_functiondef('public.jur_casos_estado(text)'::regprocedure);
  f := replace(f, $a$case when v_rol in ('equipo', 'coordinador') then array['caso']$a$, $a$case when v_rol in ('equipo', 'coordinador') or c = 'iathon' then array['caso']$a$);
  if f not like '%or c = ''iathon''%' then raise exception 'No se pudo ajustar jur_casos_estado'; end if;
  execute f;
  f := pg_get_functiondef('public.jur_casos_autorizar_subida(text,text,text,text,bigint)'::regprocedure);
  f := replace(f, $a$  if p_concurso not in ('amateur-1', 'amateur-2', 'iathon') then raise exception 'Concurso no válido'; end if;$a$,
    $a$  if p_concurso not in ('amateur-1', 'amateur-2', 'iathon') then raise exception 'Concurso no válido'; end if;
  if p_concurso = 'iathon' and p_parte = 'solucion' then raise exception 'IATHON no lleva resolución: solo el caso'; end if;$a$);
  if f not like '%IATHON no lleva resolución%' then raise exception 'No se pudo ajustar la subida'; end if;
  execute f;
end $m$;

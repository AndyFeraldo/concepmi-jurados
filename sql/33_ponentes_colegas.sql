-- =========================================================
-- Migración jur_33_ponentes_colegas (solo agrega / ajusta funciones).
-- 1) LinkedIn de los ponentes (columna nueva; lo escribe el propio ponente o el admin con Charlas «editar»).
-- 2) «Colegas»: el ponente también puede ver a sus colegas (los otros ponentes, jurados y talleristas) y
--    jurados y talleristas ven ahora también a los ponentes. Nunca se envían códigos.
-- No toca jurados, delegaciones, calificaciones ni ajustes.
-- =========================================================
alter table public.jur_ponentes add column if not exists linkedin text not null default '';

-- jur_ponente_json devuelve también el LinkedIn
do $m$
declare f text;
begin
  f := pg_get_functiondef('public.jur_ponente_json(jur_ponentes, boolean)'::regprocedure);
  if f not like '%''linkedin''%' then
    f := replace(f, $a$'video_despues', o.video_despues,$a$, $a$'video_despues', o.video_despues, 'linkedin', o.linkedin,$a$);
    if f not like '%''linkedin''%' then raise exception 'No se pudo ajustar jur_ponente_json'; end if;
    execute f;
  end if;
end $m$;

-- Guardar el LinkedIn: el ponente el suyo (p_id null) o el admin / Charlas «editar» el de cualquiera
create or replace function public.jur_ponente_linkedin(p_codigo text, p_linkedin text, p_id uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare v text := left(trim(coalesce(p_linkedin, '')), 300);
begin
  if v <> '' and v !~* '^(https?://)?([a-z0-9-]+\.)*linkedin\.com/' then raise exception 'Pega el enlace de tu perfil de LinkedIn (linkedin.com/in/…)'; end if;
  if v <> '' and v !~* '^https?://' then v := 'https://' || v; end if;
  if p_id is null then
    update jur_ponentes set linkedin = v where codigo = jur_norm(p_codigo);
    if not found then perform pg_sleep(0.4); raise exception 'Código de ponente incorrecto' using errcode = '28000'; end if;
  else
    perform jur_exigir_permiso(p_codigo, 'charlas', 'editar');
    update jur_ponentes set linkedin = v where id = p_id;
    if not found then raise exception 'Ese ponente ya no existe'; end if;
  end if;
  return json_build_object('linkedin', v);
end $$;
revoke all on function public.jur_ponente_linkedin(text, text, uuid) from public;
grant execute on function public.jur_ponente_linkedin(text, text, uuid) to anon, authenticated;

-- Colegas: acepta jurado, tallerista, ponente o admin; devuelve también los ponentes
create or replace function public.jur_colegas(p_codigo text) returns json
language plpgsql stable security definer set search_path = public as $$
declare yo uuid; rol text;
begin
  select id into yo from jur_jurados where codigo = jur_norm(p_codigo); if found then rol := 'jurado'; end if;
  if rol is null then select id into yo from jur_talleristas where codigo = jur_norm(p_codigo); if found then rol := 'tallerista'; end if; end if;
  if rol is null then select id into yo from jur_ponentes where codigo = jur_norm(p_codigo); if found then rol := 'ponente'; end if; end if;
  if rol is null and not jur_es_admin(p_codigo) then perform pg_sleep(0.4); raise exception 'Código incorrecto' using errcode = '28000'; end if;
  return json_build_object('yo', yo, 'rol', rol,
    'jurados', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'foto', foto, 'descripcion', descripcion, 'concursos', concursos, 'linkedin', linkedin) order by nombre) from jur_jurados), '[]'),
    'talleristas', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'foto', foto, 'descripcion', descripcion, 'talleres', talleres, 'linkedin', linkedin) order by nombre) from jur_talleristas), '[]'),
    'ponentes', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'foto', foto, 'descripcion', descripcion, 'charlas', charlas, 'linkedin', linkedin) order by creado) from jur_ponentes), '[]'));
end $$;

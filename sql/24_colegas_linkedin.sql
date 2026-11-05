-- =========================================================
-- Colegas y LinkedIn (migración jur_24_colegas_linkedin). Solo agrega.
-- · Columna `linkedin` en jurados y talleristas (el admin la llena al crear o editar).
-- · jur_colegas(código): un jurado o tallerista ve a todos los jurados y talleristas
--   (foto, nombre, descripción, concursos/talleres y LinkedIn), nunca sus códigos.
-- =========================================================
alter table public.jur_jurados add column if not exists linkedin text not null default '';
alter table public.jur_talleristas add column if not exists linkedin text not null default '';

-- Crear / editar jurado y tallerista con LinkedIn (p_linkedin null = no cambiar)
drop function if exists public.jur_admin_jurado(text, uuid, text, text[], text, text, boolean, boolean, text);
create or replace function public.jur_admin_jurado(p_codigo text, p_id uuid, p_nombre text, p_concursos text[], p_descripcion text default '',
  p_foto text default null, p_borrar boolean default false, p_nuevo_codigo boolean default false, p_codigo_fijo text default null, p_linkedin text default null) returns json
language plpgsql security definer set search_path = public as $$
declare j jur_jurados; fijo text := nullif(jur_norm(p_codigo_fijo), ''); li text := nullif(trim(coalesce(p_linkedin, '')), '');
begin
  perform jur_exigir_permiso(p_codigo, 'jurados', 'editar');
  if p_borrar then delete from jur_jurados where id = p_id; return null; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre completo del jurado'; end if;
  if coalesce(array_length(p_concursos, 1), 0) = 0 then raise exception 'Elige al menos un concurso'; end if;
  if exists (select 1 from unnest(p_concursos) c where c not in (select id from jur_concursos)) then raise exception 'Concurso no válido'; end if;
  if p_foto is not null and length(p_foto) > 450000 then raise exception 'La foto es muy pesada'; end if;
  if li is not null and (li !~* '^https?://' or length(li) > 300) then raise exception 'El enlace de LinkedIn no es válido'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otro jurado o tallerista'; end if;
  end if;
  if p_id is null then
    insert into jur_jurados (nombre, codigo, concursos, descripcion, foto, linkedin)
    values (trim(p_nombre), coalesce(fijo, jur_nuevo_codigo()), p_concursos, left(coalesce(p_descripcion, ''), 400), coalesce(p_foto, ''), coalesce(li, ''))
    returning * into j;
  else
    update jur_jurados set nombre = trim(p_nombre), concursos = p_concursos, descripcion = left(coalesce(p_descripcion, ''), 400),
      foto = coalesce(p_foto, foto), linkedin = case when p_linkedin is null then linkedin else coalesce(li, '') end,
      codigo = case when fijo is not null then fijo when p_nuevo_codigo then jur_nuevo_codigo() else codigo end
    where id = p_id returning * into j;
  end if;
  return json_build_object('id', j.id, 'codigo', j.codigo);
end $$;

drop function if exists public.jur_admin_tallerista(text, uuid, text, text[], text, text, boolean, boolean, text);
create or replace function public.jur_admin_tallerista(p_codigo text, p_id uuid, p_nombre text, p_talleres text[], p_descripcion text default '',
  p_foto text default null, p_borrar boolean default false, p_nuevo_codigo boolean default false, p_codigo_fijo text default null, p_linkedin text default null) returns json
language plpgsql security definer set search_path = public as $$
declare t jur_talleristas; fijo text := nullif(jur_norm(p_codigo_fijo), ''); li text := nullif(trim(coalesce(p_linkedin, '')), '');
begin
  perform jur_exigir_permiso(p_codigo, 'talleristas', 'editar');
  if p_borrar then delete from jur_talleristas where id = p_id; return null; end if;
  if coalesce(trim(p_nombre), '') = '' then raise exception 'Escribe el nombre completo del tallerista'; end if;
  if coalesce(array_length(p_talleres, 1), 0) = 0 then raise exception 'Elige al menos un taller'; end if;
  if exists (select 1 from unnest(p_talleres) x where x not in (select id from jur_talleres)) then raise exception 'Taller no válido'; end if;
  if p_foto is not null and length(p_foto) > 450000 then raise exception 'La foto es muy pesada'; end if;
  if li is not null and (li !~* '^https?://' or length(li) > 300) then raise exception 'El enlace de LinkedIn no es válido'; end if;
  if fijo is not null then
    if fijo !~ '^[A-Z0-9-]{4,16}$' then raise exception 'El código debe tener de 4 a 16 letras o números'; end if;
    if jur_es_admin(fijo) then raise exception 'Ese código no se puede usar'; end if;
    if jur_codigo_usado(fijo, p_id) then raise exception 'Ese código ya lo tiene otro jurado o tallerista'; end if;
  end if;
  if p_id is null then
    insert into jur_talleristas (nombre, codigo, talleres, descripcion, foto, linkedin)
    values (trim(p_nombre), coalesce(fijo, jur_nuevo_codigo()), p_talleres, left(coalesce(p_descripcion, ''), 400), coalesce(p_foto, ''), coalesce(li, ''))
    returning * into t;
  else
    update jur_talleristas set nombre = trim(p_nombre), talleres = p_talleres, descripcion = left(coalesce(p_descripcion, ''), 400),
      foto = coalesce(p_foto, foto), linkedin = case when p_linkedin is null then linkedin else coalesce(li, '') end,
      codigo = case when fijo is not null then fijo when p_nuevo_codigo then jur_nuevo_codigo() else codigo end
    where id = p_id returning * into t;
  end if;
  return json_build_object('id', t.id, 'codigo', t.codigo);
end $$;

-- El panel del admin también recibe el LinkedIn (jurados y talleristas)
do $$
declare def text;
begin
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'jur_admin_datos';
  if position('''linkedin''' in def) = 0 then
    if position('''foto'', foto, ''descripcion'', descripcion)' in def) = 0 then raise exception 'No se encontró el texto a cambiar en jur_admin_datos'; end if;
    execute replace(def, '''foto'', foto, ''descripcion'', descripcion)', '''foto'', foto, ''descripcion'', descripcion, ''linkedin'', linkedin)');
  end if;
end $$;

-- Colegas: lo ve un jurado o un tallerista con su propio código (o el admin)
create or replace function public.jur_colegas(p_codigo text) returns json
language plpgsql stable security definer set search_path = public as $$
declare yo uuid; rol text;
begin
  select id into yo from jur_jurados where codigo = jur_norm(p_codigo); if found then rol := 'jurado'; end if;
  if rol is null then select id into yo from jur_talleristas where codigo = jur_norm(p_codigo); if found then rol := 'tallerista'; end if; end if;
  if rol is null and not jur_es_admin(p_codigo) then perform pg_sleep(0.4); raise exception 'Código incorrecto' using errcode = '28000'; end if;
  return json_build_object('yo', yo, 'rol', rol,
    'jurados', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'foto', foto, 'descripcion', descripcion, 'concursos', concursos, 'linkedin', linkedin) order by nombre) from jur_jurados), '[]'),
    'talleristas', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'foto', foto, 'descripcion', descripcion, 'talleres', talleres, 'linkedin', linkedin) order by nombre) from jur_talleristas), '[]'));
end $$;

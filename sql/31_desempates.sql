-- Migración jur_31_desempates (aplicada en Supabase)
-- Desempate de los concursos con rúbrica, en este orden (lo calcula js/calculo.js):
--   1) promedio exacto sin redondear, 2) criterios de mayor puntaje, 3) quién envió primero su entregable,
--   4) decisión del jurado en sala (la registra el admin aquí, con motivo).
-- Solo agrega una tabla, una función y dos datos a jur_admin_datos (envios y desempates).

create table if not exists public.jur_desempates (
  concurso_id text not null references public.jur_concursos(id),
  delegacion_id uuid not null references public.jur_delegaciones(id) on delete cascade,
  orden int not null check (orden between 1 and 30),
  motivo text not null,
  actualizado timestamptz not null default now(),
  primary key (concurso_id, delegacion_id)
);
alter table public.jur_desempates enable row level security;
revoke all on public.jur_desempates from anon, authenticated;

-- Admin (o acceso con Resultados = editar): guardar o quitar (p_orden null) la decisión de desempate de una delegación
create or replace function public.jur_admin_desempate(p_codigo text, p_concurso text, p_delegacion uuid, p_orden int, p_motivo text default '') returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_permiso(p_codigo, 'resultados', 'editar');
  if p_orden is null then
    delete from jur_desempates where concurso_id = p_concurso and delegacion_id = p_delegacion;
    return;
  end if;
  if length(trim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escribe el motivo de la decisión (queda registrado)'; end if;
  insert into jur_desempates (concurso_id, delegacion_id, orden, motivo) values (p_concurso, p_delegacion, p_orden, left(trim(p_motivo), 300))
  on conflict (concurso_id, delegacion_id) do update set orden = excluded.orden, motivo = excluded.motivo, actualizado = now();
end $$;
revoke all on function public.jur_admin_desempate(text, text, uuid, int, text) from public;
grant execute on function public.jur_admin_desempate(text, text, uuid, int, text) to anon, authenticated;

do $m$
declare f text;
begin
  f := pg_get_functiondef('public.jur_admin_datos(text)'::regprocedure);
  f := replace(f, $a$    'borrados', coalesce($a$, $a$    'desempates', coalesce((select json_agg(json_build_object('concurso_id', concurso_id, 'delegacion_id', delegacion_id, 'orden', orden, 'motivo', motivo))
        from jur_desempates where ver_res or concurso_id = any(cc)), '[]'),
    'envios', coalesce((select json_agg(json_build_object('concurso_id', e.concurso_id, 'delegacion_id', e.delegacion_id, 'enviado', x.enviado))
        from jur_equipos e join jur_entregas x on x.equipo_id = e.id where x.estado = 'enviado' and x.enviado is not null and (ver_res or e.concurso_id = any(cc))), '[]'),
    'borrados', coalesce($a$);
  if f not like '%''envios''%' then raise exception 'No se pudo ajustar jur_admin_datos'; end if;
  execute f;
end $m$;

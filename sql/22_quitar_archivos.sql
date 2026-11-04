-- =========================================================
-- Quitar archivos subidos (migración jur_22_quitar_archivos). Solo agrega funciones.
-- Botón «Quitar archivos» del admin: deja en blanco el PDF, el PPT y/o el video de un equipo
-- del Concurso de Proyectos (o de un ponente) sin borrar al equipo, su código ni sus datos.
-- Las llama solo la función Edge (service_role), que después borra esos archivos del espacio privado.
-- =========================================================
create or replace function public.jur_pres_quitar(p_codigo text, p_equipo uuid, p_tipos text[]) returns json
language plpgsql security definer set search_path = public as $$
declare e jur_equipos; p jur_presentaciones; quitados text[] := '{}';
begin
  select * into e from jur_equipos where id = p_equipo;
  if not found then raise exception 'Ese equipo ya no existe'; end if;
  perform jur_exigir_sala(p_codigo, e.concurso_id);
  if coalesce(array_length(p_tipos, 1), 0) = 0 or exists (select 1 from unnest(p_tipos) x where x not in ('pdf', 'ppt', 'video')) then raise exception 'Elige qué archivos quitar'; end if;
  select * into p from jur_presentaciones where equipo_id = e.id;
  if not found then return json_build_object('paths', '[]'::json); end if;
  if 'pdf' = any(p_tipos) and p.pdf_path is not null then quitados := quitados || p.pdf_path; end if;
  if 'ppt' = any(p_tipos) and p.ppt_path is not null then quitados := quitados || p.ppt_path; end if;
  if 'video' = any(p_tipos) and p.video_path is not null then quitados := quitados || p.video_path; end if;
  update jur_presentaciones set
    pdf_path = case when 'pdf' = any(p_tipos) then null else pdf_path end, pdf_nombre = case when 'pdf' = any(p_tipos) then null else pdf_nombre end,
    pdf_tamano = case when 'pdf' = any(p_tipos) then null else pdf_tamano end, pdf_subido = case when 'pdf' = any(p_tipos) then null else pdf_subido end,
    ppt_path = case when 'ppt' = any(p_tipos) then null else ppt_path end, ppt_nombre = case when 'ppt' = any(p_tipos) then null else ppt_nombre end,
    ppt_tamano = case when 'ppt' = any(p_tipos) then null else ppt_tamano end, ppt_subido = case when 'ppt' = any(p_tipos) then null else ppt_subido end,
    video_path = case when 'video' = any(p_tipos) then null else video_path end, video_nombre = case when 'video' = any(p_tipos) then null else video_nombre end,
    video_tamano = case when 'video' = any(p_tipos) then null else video_tamano end, video_subido = case when 'video' = any(p_tipos) then null else video_subido end
  where equipo_id = e.id;
  return json_build_object('paths', to_json(quitados));
end $$;

create or replace function public.jur_ponencia_quitar(p_codigo text, p_ponente uuid, p_tipos text[]) returns json
language plpgsql security definer set search_path = public as $$
declare o jur_ponentes; quitados text[] := '{}';
begin
  perform jur_exigir_permiso(p_codigo, 'charlas', 'editar');
  select * into o from jur_ponentes where id = p_ponente;
  if not found then raise exception 'Ese ponente ya no existe'; end if;
  if coalesce(array_length(p_tipos, 1), 0) = 0 or exists (select 1 from unnest(p_tipos) x where x not in ('pdf', 'ppt', 'video')) then raise exception 'Elige qué archivos quitar'; end if;
  if 'pdf' = any(p_tipos) and o.pdf_path is not null then quitados := quitados || o.pdf_path; end if;
  if 'ppt' = any(p_tipos) and o.ppt_path is not null then quitados := quitados || o.ppt_path; end if;
  if 'video' = any(p_tipos) and o.video_path is not null then quitados := quitados || o.video_path; end if;
  update jur_ponentes set
    pdf_path = case when 'pdf' = any(p_tipos) then null else pdf_path end, pdf_nombre = case when 'pdf' = any(p_tipos) then null else pdf_nombre end,
    pdf_tamano = case when 'pdf' = any(p_tipos) then null else pdf_tamano end, pdf_subido = case when 'pdf' = any(p_tipos) then null else pdf_subido end,
    ppt_path = case when 'ppt' = any(p_tipos) then null else ppt_path end, ppt_nombre = case when 'ppt' = any(p_tipos) then null else ppt_nombre end,
    ppt_tamano = case when 'ppt' = any(p_tipos) then null else ppt_tamano end, ppt_subido = case when 'ppt' = any(p_tipos) then null else ppt_subido end,
    video_path = case when 'video' = any(p_tipos) then null else video_path end, video_nombre = case when 'video' = any(p_tipos) then null else video_nombre end,
    video_tamano = case when 'video' = any(p_tipos) then null else video_tamano end, video_subido = case when 'video' = any(p_tipos) then null else video_subido end
  where id = o.id;
  return json_build_object('paths', to_json(quitados));
end $$;

revoke all on function public.jur_pres_quitar(text, uuid, text[]), public.jur_ponencia_quitar(text, uuid, text[]) from public, anon, authenticated;
grant execute on function public.jur_pres_quitar(text, uuid, text[]), public.jur_ponencia_quitar(text, uuid, text[]) to service_role;

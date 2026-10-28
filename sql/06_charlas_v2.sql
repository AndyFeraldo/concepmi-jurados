-- =========================================================
-- Trivia v2 (migración jur_07_charlas_v2). Solo agrega columnas y ajusta funciones.
-- - 15 s por pregunta; si todos respondieron, pasa a la siguiente (pausa de 3 s
--   en la que se muestra la respuesta correcta).
-- - La pregunta en curso se guarda en jur_charlas.pregunta / pregunta_inicio y avanza
--   sola con jur_quiz_avanzar (la llama cualquiera que consulte el estado).
-- - Podio: 1.° +20, 2.° +10, 3.° +5 para su delegación (jur_charlas.podio).
-- - Admin: detener (parada de emergencia) y borrar resultado.
-- =========================================================
alter table public.jur_charlas add column if not exists pregunta int not null default 0;
alter table public.jur_charlas add column if not exists pregunta_inicio timestamptz;
alter table public.jur_charlas add column if not exists podio jsonb not null default '[]';
alter table public.jur_charlas alter column seg_pregunta set default 15;
update public.jur_charlas set seg_pregunta = 15;
-- Trivias jugadas con la versión anterior: quedan como terminadas y se conserva su ganador (+20)
update public.jur_charlas c set pregunta = (select count(*) from jur_preguntas p where p.charla_id = c.id), pregunta_inicio = c.inicio
  where c.estado = 'jugando' and c.pregunta_inicio is null;
update public.jur_charlas set podio = jsonb_build_array(jsonb_build_object('puesto', 1, 'dni', ganador_dni, 'nombre', ganador_nombre, 'delegacion_id', ganador_delegacion, 'pts', 20))
  where confirmado is not null and podio = '[]'::jsonb;

-- Pausa entre preguntas (segundos)
create or replace function public.jur_quiz_pausa() returns int language sql immutable as $$ select 3 $$;

-- Avanza la pregunta si se acabó el tiempo (+1,5 s de gracia) o si todos respondieron
create or replace function public.jur_quiz_avanzar(p_charla text) returns void
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; n int; jug int; resp int; fin timestamptz; sig timestamptz;
begin
  select count(*) into n from jur_preguntas where charla_id = p_charla;
  for i in 1..60 loop
    select * into c from jur_charlas where id = p_charla;
    if not found or c.estado <> 'jugando' or c.pregunta >= n or now() < c.pregunta_inicio then return; end if;
    fin := c.pregunta_inicio + make_interval(secs => c.seg_pregunta);
    if now() >= fin + interval '1.5 seconds' then
      sig := fin + make_interval(secs => jur_quiz_pausa());
    else
      select count(*) into jug from jur_quiz_jugadores where charla_id = p_charla;
      select count(*) into resp from jur_quiz_respuestas where charla_id = p_charla and orden = c.pregunta;
      if jug = 0 or resp < jug then return; end if;
      sig := now() + make_interval(secs => jur_quiz_pausa());
    end if;
    update jur_charlas set pregunta = pregunta + 1, pregunta_inicio = sig where id = p_charla and pregunta = c.pregunta;
  end loop;
end $$;

-- espera | cuenta (antes de la 1.a) | jugando | pausa (entre preguntas) | terminada
create or replace function public.jur_quiz_fase(c jur_charlas) returns text
language plpgsql stable security definer set search_path = public as $$
declare n int;
begin
  if c.estado = 'espera' then return 'espera'; end if;
  if now() < c.pregunta_inicio then
    if c.pregunta = 0 then return 'cuenta'; end if;
    return 'pausa';
  end if;
  select count(*) into n from jur_preguntas where charla_id = c.id;
  if c.pregunta >= n then return 'terminada'; end if;
  return 'jugando';
end $$;

create or replace function public.jur_quiz_estado(p_charla text, p_dni text default null, p_token uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; d text := jur_norm_dni(p_dni); unido boolean; fase text; ant jur_quiz_respuestas;
begin
  perform jur_quiz_avanzar(p_charla);
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  fase := jur_quiz_fase(c);
  unido := exists (select 1 from jur_quiz_jugadores where charla_id = c.id and dni = d and token = p_token);
  if unido and fase in ('pausa', 'terminada') and c.pregunta > 0 then
    select * into ant from jur_quiz_respuestas where charla_id = c.id and dni = d and orden = c.pregunta - 1;
  end if;
  return json_build_object('fase', fase, 'ahora', now(), 'seg', c.seg_pregunta, 'pregunta', c.pregunta,
    'inicio', c.pregunta_inicio, 'fin', c.pregunta_inicio + make_interval(secs => c.seg_pregunta),
    'preguntas', (select count(*) from jur_preguntas where charla_id = c.id),
    'jugadores', (select count(*) from jur_quiz_jugadores where charla_id = c.id),
    'unido', unido,
    'respondida', unido and exists (select 1 from jur_quiz_respuestas where charla_id = c.id and dni = d and orden = c.pregunta),
    'anterior', case when ant.orden is null then null else ant.correcta end);
end $$;

create or replace function public.jur_quiz_unirse(p_charla text, p_dni text) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; a jur_asistentes; t uuid;
begin
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  if c.estado <> 'espera' then raise exception 'La trivia ya empezó. Espera la siguiente charla.'; end if;
  select * into a from jur_asistentes where dni = jur_norm_dni(p_dni);
  if not found then perform pg_sleep(0.5); raise exception 'No encontramos ese DNI en la lista de inscritos'; end if;
  if a.delegacion_id is null then raise exception 'Tu delegación aún no está registrada. Acércate al equipo organizador.'; end if;
  if exists (select 1 from jur_quiz_jugadores where charla_id = p_charla and dni = a.dni) then
    raise exception 'Este DNI ya está en la sala desde otro celular';
  end if;
  insert into jur_quiz_jugadores (charla_id, dni, nombre, delegacion_id) values (p_charla, a.dni, a.nombre, a.delegacion_id) returning token into t;
  return json_build_object('token', t);
end $$;

create or replace function public.jur_quiz_pregunta(p_charla text, p_dni text, p_token uuid, p_orden int) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; q jur_preguntas; d text := jur_norm_dni(p_dni);
begin
  if not exists (select 1 from jur_quiz_jugadores where charla_id = p_charla and dni = d and token = p_token) then
    raise exception 'No estás en la sala de esta charla';
  end if;
  perform jur_quiz_avanzar(p_charla);
  select * into c from jur_charlas where id = p_charla;
  if c.estado <> 'jugando' or p_orden <> c.pregunta or now() < c.pregunta_inicio then raise exception 'Esa pregunta no está disponible'; end if;
  select * into q from jur_preguntas where charla_id = p_charla and orden = p_orden;
  if not found then return null; end if;
  return json_build_object('orden', q.orden, 'texto', q.texto, 'opciones', q.opciones,
    'fin', c.pregunta_inicio + make_interval(secs => c.seg_pregunta), 'ahora', now(),
    'respondida', exists (select 1 from jur_quiz_respuestas where charla_id = p_charla and dni = d and orden = p_orden));
end $$;

create or replace function public.jur_quiz_responder(p_charla text, p_dni text, p_token uuid, p_orden int, p_opcion int) returns void
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; q jur_preguntas; d text := jur_norm_dni(p_dni); ms int;
begin
  if not exists (select 1 from jur_quiz_jugadores where charla_id = p_charla and dni = d and token = p_token) then
    raise exception 'No estás en la sala de esta charla';
  end if;
  perform jur_quiz_avanzar(p_charla);
  select * into c from jur_charlas where id = p_charla;
  if c.estado <> 'jugando' or p_orden <> c.pregunta then raise exception 'Se acabó el tiempo de esta pregunta'; end if;
  select * into q from jur_preguntas where charla_id = p_charla and orden = p_orden;
  if not found then raise exception 'Pregunta no válida'; end if;
  ms := floor(extract(epoch from (now() - c.pregunta_inicio)) * 1000);
  if ms < 0 or ms > c.seg_pregunta * 1000 + 1500 then raise exception 'Se acabó el tiempo de esta pregunta'; end if;
  insert into jur_quiz_respuestas (charla_id, dni, orden, opcion, correcta, ms)
  values (p_charla, d, p_orden, p_opcion, p_opcion = q.correcta, least(ms, c.seg_pregunta * 1000))
  on conflict do nothing;
  perform jur_quiz_avanzar(p_charla);
end $$;

create or replace function public.jur_quiz_resultado(p_charla text, p_dni text, p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; r record; d text := jur_norm_dni(p_dni); mio jsonb;
begin
  if not exists (select 1 from jur_quiz_jugadores where charla_id = p_charla and dni = d and token = p_token) then
    raise exception 'No estás en la sala de esta charla';
  end if;
  perform jur_quiz_avanzar(p_charla);
  select * into c from jur_charlas where id = p_charla;
  if jur_quiz_fase(c) <> 'terminada' then raise exception 'La trivia aún no termina'; end if;
  select * into r from jur_quiz_ranking(p_charla) x where x.dni = d;
  select x into mio from jsonb_array_elements(c.podio) x where x->>'dni' = d;
  return json_build_object('aciertos', r.aciertos, 'puesto', r.puesto, 'tiempo_ms', r.tiempo_ms,
    'preguntas', (select count(*) from jur_preguntas where charla_id = p_charla),
    'jugadores', (select count(*) from jur_quiz_jugadores where charla_id = p_charla),
    'confirmado', c.confirmado is not null, 'ganador', c.ganador_nombre, 'pts', coalesce((mio->>'pts')::int, 0));
end $$;

create or replace function public.jur_admin_quiz(p_codigo text, p_charla text) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas;
begin
  perform jur_exigir_admin(p_codigo);
  perform jur_quiz_avanzar(p_charla);
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  return json_build_object('fase', jur_quiz_fase(c), 'ahora', now(), 'seg', c.seg_pregunta, 'pausa', jur_quiz_pausa(),
    'pregunta', c.pregunta, 'inicio', c.pregunta_inicio, 'fin', c.pregunta_inicio + make_interval(secs => c.seg_pregunta),
    'confirmado', c.confirmado, 'ganador_dni', c.ganador_dni, 'ganador_nombre', c.ganador_nombre, 'ganador_delegacion', c.ganador_delegacion, 'podio', c.podio,
    'preguntas', coalesce((select json_agg(json_build_object('orden', orden, 'texto', texto, 'opciones', opciones, 'correcta', correcta) order by orden)
       from jur_preguntas where charla_id = c.id), '[]'),
    'respuestas', coalesce((select json_agg(json_build_object('orden', orden, 'n', n, 'bien', b)) from
       (select orden, count(*) n, count(*) filter (where correcta) b from jur_quiz_respuestas where charla_id = c.id group by orden) x), '[]'),
    'ranking', coalesce((select json_agg(json_build_object('dni', dni, 'nombre', nombre, 'delegacion_id', delegacion_id, 'aciertos', aciertos,
       'respondidas', respondidas, 'tiempo_ms', tiempo_ms, 'puesto', puesto) order by puesto) from jur_quiz_ranking(c.id)), '[]'));
end $$;

-- p_accion: iniciar | detener | reiniciar | confirmar | anular | borrar
create or replace function public.jur_admin_charla(p_codigo text, p_charla text, p_accion text) returns void
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; fase text; pod jsonb; uno jsonb;
begin
  perform jur_exigir_admin(p_codigo);
  perform jur_quiz_avanzar(p_charla);
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  fase := jur_quiz_fase(c);
  if p_accion = 'iniciar' then
    if c.estado <> 'espera' then raise exception 'La trivia ya se inició'; end if;
    if not exists (select 1 from jur_preguntas where charla_id = p_charla) then raise exception 'Primero carga las preguntas'; end if;
    update jur_charlas set estado = 'jugando', pregunta = 0, inicio = now() + interval '5 seconds', pregunta_inicio = now() + interval '5 seconds' where id = p_charla;
  elsif p_accion = 'detener' then
    -- Parada de emergencia: se anulan las respuestas y los jugadores vuelven a la sala de espera
    if c.confirmado is not null then raise exception 'Primero anula el resultado confirmado'; end if;
    delete from jur_quiz_respuestas where charla_id = p_charla;
    update jur_charlas set estado = 'espera', pregunta = 0, inicio = null, pregunta_inicio = null where id = p_charla;
  elsif p_accion in ('reiniciar', 'borrar') then
    if p_accion = 'reiniciar' and c.confirmado is not null then raise exception 'Primero anula el resultado confirmado'; end if;
    delete from jur_quiz_jugadores where charla_id = p_charla;
    update jur_charlas set estado = 'espera', pregunta = 0, inicio = null, pregunta_inicio = null, podio = '[]',
      ganador_dni = null, ganador_nombre = null, ganador_delegacion = null, confirmado = null where id = p_charla;
  elsif p_accion = 'confirmar' then
    if fase <> 'terminada' then raise exception 'Espera a que termine la última pregunta'; end if;
    select coalesce(jsonb_agg(jsonb_build_object('puesto', puesto, 'dni', dni, 'nombre', nombre, 'delegacion_id', delegacion_id,
        'aciertos', aciertos, 'tiempo_ms', tiempo_ms, 'pts', (array[20, 10, 5])[puesto]) order by puesto), '[]')
      into pod from jur_quiz_ranking(p_charla) where puesto <= 3;
    if jsonb_array_length(pod) = 0 then raise exception 'Nadie participó en esta trivia'; end if;
    uno := pod->0;
    update jur_charlas set podio = pod, ganador_dni = uno->>'dni', ganador_nombre = uno->>'nombre',
      ganador_delegacion = (uno->>'delegacion_id')::uuid, confirmado = now() where id = p_charla;
  elsif p_accion = 'anular' then
    update jur_charlas set podio = '[]', ganador_dni = null, ganador_nombre = null, ganador_delegacion = null, confirmado = null where id = p_charla;
  else
    raise exception 'Acción no válida';
  end if;
end $$;


create or replace function public.jur_admin_datos(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return json_build_object(
    'concursos', (select json_agg(json_build_object('id', id, 'abierto', abierto)) from jur_concursos),
    'delegaciones', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'siglas', siglas) order by nombre) from jur_delegaciones), '[]'),
    'jurados', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'codigo', codigo, 'concursos', concursos,
        'foto', foto, 'descripcion', descripcion) order by creado) from jur_jurados), '[]'),
    'calificaciones', coalesce((select json_agg(json_build_object('id', id, 'concurso_id', concurso_id, 'subprueba', subprueba,
        'delegacion_id', delegacion_id, 'jurado_id', jurado_id, 'datos', datos, 'total', total, 'comentario', comentario,
        'actualizado', actualizado) order by actualizado desc) from jur_calificaciones), '[]'),
    'ajustes', coalesce((select json_agg(json_build_object('concurso_id', concurso_id, 'delegacion_id', delegacion_id,
        'retraso', retraso, 'walkover', walkover, 'descalificado', descalificado, 'valor', valor, 'nota', nota,
        'datos', datos, 'actualizado', actualizado)) from jur_ajustes), '[]'),
    'borrados', coalesce((select json_agg(json_build_object('id', id, 'concurso_id', concurso_id, 'subprueba', subprueba,
        'delegacion', delegacion, 'jurado', jurado, 'total', total, 'motivo', motivo, 'borrado', borrado) order by borrado desc) from jur_borrados), '[]'),
    'talleres', (select json_agg(json_build_object('id', id, 'abierto', abierto)) from jur_talleres),
    'talleristas', coalesce((select json_agg(json_build_object('id', id, 'nombre', nombre, 'codigo', codigo, 'talleres', talleres,
        'foto', foto, 'descripcion', descripcion) order by creado) from jur_talleristas), '[]'),
    'ganadores_talleres', coalesce((select json_agg(json_build_object('taller_id', taller_id, 'integrantes', integrantes,
        'tallerista', tallerista, 'actualizado', actualizado)) from jur_taller_ganadores), '[]'),
    'charlas', (select json_agg(json_build_object('id', c.id, 'fase', jur_quiz_fase(c), 'seg', c.seg_pregunta, 'confirmado', c.confirmado,
        'ganador_nombre', c.ganador_nombre, 'ganador_delegacion', c.ganador_delegacion, 'podio', c.podio,
        'preguntas', (select count(*) from jur_preguntas p where p.charla_id = c.id),
        'jugadores', (select count(*) from jur_quiz_jugadores j where j.charla_id = c.id)) order by c.id) from jur_charlas c),
    'asistentes', json_build_object('total', (select count(*) from jur_asistentes),
        'sin_delegacion', (select count(*) from jur_asistentes where delegacion_id is null))
  );
end $$;

revoke all on function public.jur_quiz_avanzar(text) from public, anon, authenticated;

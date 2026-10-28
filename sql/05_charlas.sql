-- =========================================================
-- Charlas principales: trivia tipo Kahoot (migración jur_06_charlas)
-- Solo agrega tablas y funciones. No borra datos existentes.
-- El asistente entra por QR con su DNI (lista importada del Excel de
-- inscritos), espera en sala, el admin inicia y cada pregunta dura 20 s.
-- Gana quien tenga más aciertos; empate: menor tiempo total.
-- El admin confirma al ganador: +20 pts a su delegación (js/charlas.js).
-- Las respuestas correctas viven solo aquí, nunca en la página.
-- =========================================================

create table if not exists public.jur_charlas (
  id text primary key,
  nombre text not null,
  estado text not null default 'espera' check (estado in ('espera', 'jugando')),
  inicio timestamptz,
  seg_pregunta int not null default 20,
  ganador_dni text,
  ganador_nombre text,
  ganador_delegacion uuid references public.jur_delegaciones(id) on delete set null,
  confirmado timestamptz
);
insert into public.jur_charlas (id, nombre) values
  ('c1', 'Charla Principal I · Gestión de Proyectos'),
  ('c2', 'Charla Principal II · Networking y Liderazgo'),
  ('c3', 'Charla Principal III · IA y Herramientas Tecnológicas')
on conflict (id) do nothing;

create table if not exists public.jur_preguntas (
  charla_id text not null references public.jur_charlas(id),
  orden int not null,
  texto text not null,
  opciones text[] not null,
  correcta int not null,
  primary key (charla_id, orden)
);

-- Inscritos (hoja CONFIRMADOS del Excel de inscripción)
create table if not exists public.jur_asistentes (
  dni text primary key,
  codigo text not null default '',
  nombre text not null,
  delegacion_id uuid references public.jur_delegaciones(id) on delete set null,
  delegacion_texto text not null default '',
  actualizado timestamptz not null default now()
);

create table if not exists public.jur_quiz_jugadores (
  charla_id text not null references public.jur_charlas(id),
  dni text not null,
  token uuid not null default gen_random_uuid(),
  nombre text not null,
  delegacion_id uuid,
  unido timestamptz not null default now(),
  primary key (charla_id, dni)
);

create table if not exists public.jur_quiz_respuestas (
  charla_id text not null,
  dni text not null,
  orden int not null,
  opcion int not null,
  correcta boolean not null,
  ms int not null,
  primary key (charla_id, dni, orden),
  foreign key (charla_id, dni) references public.jur_quiz_jugadores(charla_id, dni) on delete cascade
);

alter table public.jur_charlas enable row level security;
alter table public.jur_preguntas enable row level security;
alter table public.jur_asistentes enable row level security;
alter table public.jur_quiz_jugadores enable row level security;
alter table public.jur_quiz_respuestas enable row level security;
revoke all on public.jur_charlas, public.jur_preguntas, public.jur_asistentes, public.jur_quiz_jugadores, public.jur_quiz_respuestas from anon, authenticated;

create or replace function public.jur_norm_dni(p text) returns text
language sql immutable as $$ select upper(regexp_replace(coalesce(p, ''), '[^0-9A-Za-z]', '', 'g')) $$;

-- Estado real: "terminada" cuando ya pasó el tiempo de la última pregunta
create or replace function public.jur_quiz_fase(c jur_charlas) returns text
language plpgsql stable security definer set search_path = public as $$
declare n int; fin timestamptz;
begin
  if c.estado = 'espera' then return 'espera'; end if;
  select count(*) into n from jur_preguntas where charla_id = c.id;
  fin := c.inicio + make_interval(secs => n * c.seg_pregunta);
  if now() < c.inicio then return 'cuenta'; end if;
  if now() >= fin then return 'terminada'; end if;
  return 'jugando';
end $$;

-- Ranking: más aciertos; empate = menor tiempo total (sin responder cuenta 20 s)
create or replace function public.jur_quiz_ranking(p_charla text)
returns table (dni text, nombre text, delegacion_id uuid, aciertos int, respondidas int, tiempo_ms bigint, puesto int)
language sql stable security definer set search_path = public as $$
  with c as (select seg_pregunta s, (select count(*) from jur_preguntas where charla_id = p_charla) n from jur_charlas where id = p_charla),
  r as (select dni, count(*) filter (where correcta)::int ac, count(*)::int re, coalesce(sum(ms), 0)::bigint ms
        from jur_quiz_respuestas where charla_id = p_charla group by dni)
  select j.dni, j.nombre, j.delegacion_id, coalesce(r.ac, 0), coalesce(r.re, 0),
    coalesce(r.ms, 0) + (c.n - coalesce(r.re, 0)) * c.s * 1000,
    (row_number() over (order by coalesce(r.ac, 0) desc, coalesce(r.ms, 0) + (c.n - coalesce(r.re, 0)) * c.s * 1000 asc, j.unido asc))::int
  from jur_quiz_jugadores j cross join c left join r on r.dni = j.dni
  where j.charla_id = p_charla
  order by 7;
$$;

-- ---------- Asistente (público, entra por QR) ----------
create or replace function public.jur_quiz_buscar(p_dni text) returns json
language plpgsql security definer set search_path = public as $$
declare a jur_asistentes;
begin
  select * into a from jur_asistentes where dni = jur_norm_dni(p_dni);
  if not found then perform pg_sleep(0.5); return null; end if;
  return json_build_object('nombre', a.nombre, 'codigo', a.codigo, 'delegacion',
    (select json_build_object('id', d.id, 'nombre', d.nombre, 'siglas', d.siglas) from jur_delegaciones d where d.id = a.delegacion_id));
end $$;

create or replace function public.jur_quiz_estado(p_charla text, p_dni text default null, p_token uuid default null) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas;
begin
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  return json_build_object('fase', jur_quiz_fase(c), 'inicio', c.inicio, 'ahora', now(), 'seg', c.seg_pregunta,
    'preguntas', (select count(*) from jur_preguntas where charla_id = c.id),
    'jugadores', (select count(*) from jur_quiz_jugadores where charla_id = c.id),
    'unido', exists (select 1 from jur_quiz_jugadores where charla_id = c.id and dni = jur_norm_dni(p_dni) and token = p_token));
end $$;

create or replace function public.jur_quiz_unirse(p_charla text, p_dni text) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; a jur_asistentes; t uuid;
begin
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  if jur_quiz_fase(c) <> 'espera' then raise exception 'La trivia ya empezó. Espera la siguiente charla.'; end if;
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
declare c jur_charlas; q jur_preguntas; ini timestamptz; fase text;
begin
  if not exists (select 1 from jur_quiz_jugadores where charla_id = p_charla and dni = jur_norm_dni(p_dni) and token = p_token) then
    raise exception 'No estás en la sala de esta charla';
  end if;
  select * into c from jur_charlas where id = p_charla;
  fase := jur_quiz_fase(c);
  if fase not in ('jugando', 'terminada') then raise exception 'La trivia aún no empieza'; end if;
  ini := c.inicio + make_interval(secs => p_orden * c.seg_pregunta);
  if now() < ini then raise exception 'Esa pregunta aún no está disponible'; end if;
  select * into q from jur_preguntas where charla_id = p_charla and orden = p_orden;
  if not found then return null; end if;
  return json_build_object('orden', q.orden, 'texto', q.texto, 'opciones', q.opciones,
    'fin', ini + make_interval(secs => c.seg_pregunta), 'ahora', now(),
    'respondida', exists (select 1 from jur_quiz_respuestas where charla_id = p_charla and dni = jur_norm_dni(p_dni) and orden = p_orden));
end $$;

create or replace function public.jur_quiz_responder(p_charla text, p_dni text, p_token uuid, p_orden int, p_opcion int) returns void
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; q jur_preguntas; ini timestamptz; d text := jur_norm_dni(p_dni); ms int;
begin
  if not exists (select 1 from jur_quiz_jugadores where charla_id = p_charla and dni = d and token = p_token) then
    raise exception 'No estás en la sala de esta charla';
  end if;
  select * into c from jur_charlas where id = p_charla;
  if c.estado <> 'jugando' then raise exception 'La trivia no está en curso'; end if;
  select * into q from jur_preguntas where charla_id = p_charla and orden = p_orden;
  if not found then raise exception 'Pregunta no válida'; end if;
  ini := c.inicio + make_interval(secs => p_orden * c.seg_pregunta);
  ms := floor(extract(epoch from (now() - ini)) * 1000);
  -- 1,5 s de gracia por la demora de internet
  if ms < 0 or ms > c.seg_pregunta * 1000 + 1500 then raise exception 'Se acabó el tiempo de esta pregunta'; end if;
  insert into jur_quiz_respuestas (charla_id, dni, orden, opcion, correcta, ms)
  values (p_charla, d, p_orden, p_opcion, p_opcion = q.correcta, least(ms, c.seg_pregunta * 1000))
  on conflict do nothing;
end $$;

create or replace function public.jur_quiz_resultado(p_charla text, p_dni text, p_token uuid) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; r record;
begin
  if not exists (select 1 from jur_quiz_jugadores where charla_id = p_charla and dni = jur_norm_dni(p_dni) and token = p_token) then
    raise exception 'No estás en la sala de esta charla';
  end if;
  select * into c from jur_charlas where id = p_charla;
  if jur_quiz_fase(c) <> 'terminada' then raise exception 'La trivia aún no termina'; end if;
  select * into r from jur_quiz_ranking(p_charla) x where x.dni = jur_norm_dni(p_dni);
  return json_build_object('aciertos', r.aciertos, 'puesto', r.puesto, 'tiempo_ms', r.tiempo_ms,
    'preguntas', (select count(*) from jur_preguntas where charla_id = p_charla),
    'jugadores', (select count(*) from jur_quiz_jugadores where charla_id = p_charla),
    'confirmado', c.confirmado is not null, 'ganador', c.ganador_nombre);
end $$;

-- ---------- Admin ----------
create or replace function public.jur_admin_quiz(p_codigo text, p_charla text) returns json
language plpgsql security definer set search_path = public as $$
declare c jur_charlas;
begin
  perform jur_exigir_admin(p_codigo);
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  return json_build_object('fase', jur_quiz_fase(c), 'inicio', c.inicio, 'ahora', now(), 'seg', c.seg_pregunta,
    'confirmado', c.confirmado, 'ganador_dni', c.ganador_dni, 'ganador_nombre', c.ganador_nombre, 'ganador_delegacion', c.ganador_delegacion,
    'preguntas', coalesce((select json_agg(json_build_object('orden', orden, 'texto', texto, 'opciones', opciones, 'correcta', correcta) order by orden)
       from jur_preguntas where charla_id = c.id), '[]'),
    'respuestas', coalesce((select json_agg(json_build_object('orden', orden, 'n', n, 'bien', b)) from
       (select orden, count(*) n, count(*) filter (where correcta) b from jur_quiz_respuestas where charla_id = c.id group by orden) x), '[]'),
    'ranking', coalesce((select json_agg(json_build_object('dni', dni, 'nombre', nombre, 'delegacion_id', delegacion_id, 'aciertos', aciertos,
       'respondidas', respondidas, 'tiempo_ms', tiempo_ms, 'puesto', puesto) order by puesto) from jur_quiz_ranking(c.id)), '[]'));
end $$;

-- p_accion: iniciar | reiniciar | confirmar | anular
create or replace function public.jur_admin_charla(p_codigo text, p_charla text, p_accion text) returns void
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; r record; fase text;
begin
  perform jur_exigir_admin(p_codigo);
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  fase := jur_quiz_fase(c);
  if p_accion = 'iniciar' then
    if fase <> 'espera' then raise exception 'La trivia ya se inició'; end if;
    if not exists (select 1 from jur_preguntas where charla_id = p_charla) then raise exception 'Primero carga las preguntas'; end if;
    update jur_charlas set estado = 'jugando', inicio = now() + interval '5 seconds' where id = p_charla;
  elsif p_accion = 'reiniciar' then
    if c.confirmado is not null then raise exception 'Primero anula al ganador confirmado'; end if;
    delete from jur_quiz_jugadores where charla_id = p_charla;
    update jur_charlas set estado = 'espera', inicio = null, ganador_dni = null, ganador_nombre = null, ganador_delegacion = null where id = p_charla;
  elsif p_accion = 'confirmar' then
    if fase <> 'terminada' then raise exception 'Espera a que termine la última pregunta'; end if;
    select * into r from jur_quiz_ranking(p_charla) limit 1;
    if not found then raise exception 'Nadie participó en esta trivia'; end if;
    update jur_charlas set ganador_dni = r.dni, ganador_nombre = r.nombre, ganador_delegacion = r.delegacion_id, confirmado = now() where id = p_charla;
  elsif p_accion = 'anular' then
    update jur_charlas set ganador_dni = null, ganador_nombre = null, ganador_delegacion = null, confirmado = null where id = p_charla;
  else
    raise exception 'Acción no válida';
  end if;
end $$;

-- Reemplaza las preguntas de una charla: [{texto, opciones:[4], correcta:0-3}]
create or replace function public.jur_admin_preguntas(p_codigo text, p_charla text, p_preguntas jsonb) returns int
language plpgsql security definer set search_path = public as $$
declare c jur_charlas; x jsonb; i int := 0; ops text[];
begin
  perform jur_exigir_admin(p_codigo);
  select * into c from jur_charlas where id = p_charla;
  if not found then raise exception 'Charla no encontrada'; end if;
  if c.estado <> 'espera' then raise exception 'Reinicia la trivia antes de cambiar las preguntas'; end if;
  if jsonb_typeof(p_preguntas) is distinct from 'array' or jsonb_array_length(p_preguntas) = 0 then raise exception 'No hay preguntas'; end if;
  if jsonb_array_length(p_preguntas) > 30 then raise exception 'Máximo 30 preguntas por charla'; end if;
  delete from jur_preguntas where charla_id = p_charla;
  for x in select * from jsonb_array_elements(p_preguntas) loop
    ops := array(select jsonb_array_elements_text(x->'opciones'));
    if coalesce(trim(x->>'texto'), '') = '' then raise exception 'La pregunta % no tiene texto', i + 1; end if;
    if array_length(ops, 1) is null or array_length(ops, 1) < 2 or array_length(ops, 1) > 4 then raise exception 'La pregunta % debe tener de 2 a 4 opciones', i + 1; end if;
    if (x->>'correcta')::int < 0 or (x->>'correcta')::int >= array_length(ops, 1) then raise exception 'La pregunta % no tiene una respuesta correcta válida', i + 1; end if;
    insert into jur_preguntas (charla_id, orden, texto, opciones, correcta) values (p_charla, i, left(trim(x->>'texto'), 300), ops, (x->>'correcta')::int);
    i := i + 1;
  end loop;
  return i;
end $$;

-- Importa o actualiza inscritos: [{dni, codigo, nombre, delegacion_id, delegacion_texto}]
create or replace function public.jur_admin_asistentes(p_codigo text, p_filas jsonb) returns json
language plpgsql security definer set search_path = public as $$
declare x jsonb; n int := 0; d text; del uuid;
begin
  perform jur_exigir_admin(p_codigo);
  if jsonb_typeof(p_filas) is distinct from 'array' then raise exception 'Lista no válida'; end if;
  for x in select * from jsonb_array_elements(p_filas) loop
    d := jur_norm_dni(x->>'dni');
    if d = '' or coalesce(trim(x->>'nombre'), '') = '' then continue; end if;
    del := null;
    if coalesce(x->>'delegacion_id', '') <> '' then select id into del from jur_delegaciones where id::text = x->>'delegacion_id'; end if;
    insert into jur_asistentes (dni, codigo, nombre, delegacion_id, delegacion_texto, actualizado)
    values (d, left(coalesce(x->>'codigo', ''), 40), left(trim(x->>'nombre'), 160), del, left(coalesce(x->>'delegacion_texto', ''), 160), now())
    on conflict (dni) do update set codigo = excluded.codigo, nombre = excluded.nombre, delegacion_id = excluded.delegacion_id,
      delegacion_texto = excluded.delegacion_texto, actualizado = now();
    n := n + 1;
  end loop;
  return json_build_object('importados', n, 'total', (select count(*) from jur_asistentes),
    'sin_delegacion', (select count(*) from jur_asistentes where delegacion_id is null));
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
    'charlas', (select json_agg(json_build_object('id', c.id, 'fase', jur_quiz_fase(c), 'confirmado', c.confirmado,
        'ganador_nombre', c.ganador_nombre, 'ganador_delegacion', c.ganador_delegacion,
        'preguntas', (select count(*) from jur_preguntas p where p.charla_id = c.id),
        'jugadores', (select count(*) from jur_quiz_jugadores j where j.charla_id = c.id)) order by c.id) from jur_charlas c),
    'asistentes', json_build_object('total', (select count(*) from jur_asistentes),
        'sin_delegacion', (select count(*) from jur_asistentes where delegacion_id is null))
  );
end $$;

revoke all on function public.jur_quiz_fase(jur_charlas), public.jur_quiz_ranking(text) from public, anon, authenticated;
grant execute on function public.jur_quiz_buscar(text), public.jur_quiz_estado(text, text, uuid), public.jur_quiz_unirse(text, text),
  public.jur_quiz_pregunta(text, text, uuid, int), public.jur_quiz_responder(text, text, uuid, int, int), public.jur_quiz_resultado(text, text, uuid),
  public.jur_admin_quiz(text, text), public.jur_admin_charla(text, text, text), public.jur_admin_preguntas(text, text, jsonb),
  public.jur_admin_asistentes(text, jsonb) to anon, authenticated;

-- Preguntas de prueba (se reemplazan con las del PPT de cada ponente)
insert into public.jur_preguntas (charla_id, orden, texto, opciones, correcta) values
  ('c1', 0, 'En la 8.ª edición de la Guía PMBOK, ¿qué toma más fuerza frente a los procesos rígidos?', array['La gestión exclusivamente predictiva', 'Eliminar al patrocinador', 'Solo los diagramas de Gantt', 'Los principios y la entrega de valor'], 3),
  ('c1', 1, '¿Qué es un enfoque híbrido en proyectos?', array['Combinar prácticas predictivas y ágiles según el proyecto', 'Cambiar de gerente cada mes', 'Usar únicamente Scrum', 'Trabajar sin planificación'], 0),
  ('c1', 2, 'En Scrum, ¿quién es responsable de maximizar el valor del producto?', array['El Product Owner', 'El Scrum Master', 'El cliente final', 'El equipo de calidad'], 0),
  ('c1', 3, 'Gestionar el valor en un proyecto significa principalmente…', array['Cumplir solo con el cronograma', 'Gastar todo el presupuesto', 'Entregar beneficios reales a los interesados', 'Tener el menor número de reuniones'], 2),
  ('c1', 4, '¿Qué artefacto ágil ordena y prioriza el trabajo pendiente del producto?', array['La matriz RACI', 'El registro de lecciones aprendidas', 'El acta de constitución', 'El Product Backlog'], 3),
  ('c1', 5, '¿Qué documento autoriza formalmente el inicio de un proyecto?', array['El Product Backlog', 'El informe de cierre', 'El acta de constitución', 'El plan de calidad'], 2),
  ('c1', 6, 'En un tablero Kanban, limitar el trabajo en curso (WIP) ayuda a…', array['Dejar de medir el avance', 'Aumentar la multitarea', 'Mejorar el flujo y reducir cuellos de botella', 'Eliminar las entregas'], 2),
  ('c1', 7, '¿Cuál es la triple restricción clásica de un proyecto?', array['Alcance, tiempo y costo', 'Personas, procesos y tecnología', 'Calidad, riesgo y motivación', 'Clientes, ventas y marketing'], 0),
  ('c2', 0, 'El liderazgo transformacional se caracteriza por…', array['Controlar cada tarea del equipo', 'Inspirar y desarrollar a las personas hacia una visión', 'Motivar solo con dinero', 'Evitar cualquier cambio'], 1),
  ('c2', 1, 'Una red de contactos de alto valor se construye principalmente…', array['Yendo a eventos sin hablar con nadie', 'Agregando a cualquiera en LinkedIn', 'Aportando valor y cuidando relaciones genuinas', 'Pidiendo favores sin dar nada'], 2),
  ('c2', 2, 'La marca personal es…', array['Tu cargo actual', 'La percepción que otros tienen de tu valor profesional', 'El logo de tus redes sociales', 'Tu número de seguidores'], 1),
  ('c2', 3, '¿Qué es un «elevator pitch»?', array['Una carta de recomendación', 'Un discurso de 30 minutos', 'Una presentación breve de quién eres y qué aportas', 'Un currículum impreso'], 2),
  ('c2', 4, 'Después de un evento, hacer seguimiento a un contacto sirve para…', array['Convertir el contacto en una relación', 'Nada, no es necesario', 'Venderle algo de inmediato', 'Cumplir un requisito'], 0),
  ('c2', 5, 'Según el Triángulo del Talento del PMI, ¿qué habilidades son clave para liderar?', array['Saber programar', 'Memorizar la Guía PMBOK', 'Solo el dominio técnico', 'Las power skills, como la comunicación'], 3),
  ('c2', 6, 'La escucha activa implica…', array['Interrumpir para opinar', 'Revisar el celular mientras hablan', 'Esperar tu turno para hablar', 'Comprender y confirmar lo que dice la otra persona'], 3),
  ('c2', 7, 'Un líder que delega bien…', array['Da autonomía con objetivos claros y seguimiento', 'Se desentiende del resultado', 'Delega solo lo que no le gusta', 'Prefiere hacerlo todo él mismo'], 0),
  ('c3', 0, '¿Qué hace la IA generativa?', array['Crea contenido nuevo: texto, imágenes o código', 'Solo almacena datos', 'Reemplaza a internet', 'Repara computadoras'], 0),
  ('c3', 1, 'Un «prompt» es…', array['Un tipo de virus', 'Un lenguaje de programación', 'Una hoja de cálculo', 'La instrucción que le das a un modelo de IA'], 3),
  ('c3', 2, '¿Qué práctica mejora la respuesta de una IA?', array['Hacer la pregunta lo más corta posible', 'Escribir todo en mayúsculas', 'Darle contexto, un rol y el formato esperado', 'Escribir una sola palabra'], 2),
  ('c3', 3, 'La automatización de procesos (RPA) sirve para…', array['Contratar personal', 'Ejecutar tareas repetitivas sin intervención manual', 'Diseñar logotipos', 'Eliminar la planificación'], 1),
  ('c3', 4, 'Una «alucinación» de la IA es…', array['Un error de la pantalla', 'Un modo creativo oficial', 'Una respuesta falsa presentada como cierta', 'Un virus informático'], 2),
  ('c3', 5, '¿Qué herramienta se usa para crear dashboards de datos?', array['Power BI', 'Bloc de notas', 'Paint', 'WinRAR'], 0),
  ('c3', 6, 'En gestión de proyectos, la IA puede ayudar a…', array['Analizar riesgos y generar reportes más rápido', 'Reemplazar al patrocinador', 'Evitar toda comunicación', 'Eliminar a los interesados'], 0),
  ('c3', 7, 'Antes de compartir datos con una IA pública debes…', array['Proteger la información confidencial', 'Compartir todo para mejores resultados', 'Nada, siempre es seguro', 'Desactivar el antivirus'], 0)
on conflict (charla_id, orden) do nothing;

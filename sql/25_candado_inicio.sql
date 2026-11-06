-- Migración jur_25_candado_inicio (aplicada en Supabase)
-- Candado: un equipo no puede guardar ni enviar su entregable hasta que el organizador
-- pulse «Iniciar tiempo» en Entregas. Proyectos queda fuera (suben sus archivos antes).
do $t$
declare d text;
begin
  foreach d in array array['jur_equipo_guardar(text,jsonb)','jur_equipo_enviar(text,jsonb)'] loop
    execute replace(pg_get_functiondef(d::regprocedure),
      '  select * into t from jur_concurso_tiempo where concurso_id = e.concurso_id;',
      '  select * into t from jur_concurso_tiempo where concurso_id = e.concurso_id;
  if e.concurso_id <> ''proyectos'' and t.inicio is null then raise exception ''El tiempo aún no inicia. Espera a que el organizador dé la señal de inicio.''; end if;');
  end loop;
end $t$;

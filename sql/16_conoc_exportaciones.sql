-- =========================================================
-- Historial de exportaciones Conocimientos → Copa (migración jur_16_conoc_exportaciones). Solo agrega.
-- jur_conoc_exportaciones guarda cada vez que el admin confirma «Traer resultados del concurso»:
-- qué enfrentamientos (ids de public.enfrentamientos) y un detalle por delegación. Solo es una marca visual.
-- =========================================================
create table if not exists public.jur_conoc_exportaciones (
  id uuid primary key default gen_random_uuid(),
  creado timestamptz not null default now(),
  enfrentamientos uuid[] not null default '{}',
  detalle jsonb not null default '[]'
);
alter table public.jur_conoc_exportaciones enable row level security;
revoke all on public.jur_conoc_exportaciones from anon, authenticated;
-- Funciones: jur_admin_conoc_exportar(p_codigo, p_enfrentamientos, p_detalle) (solo admin);
-- jur_admin_conocimientos(p_codigo) ahora devuelve { enfrentamientos (con 'exportado'), historial };
-- jur_conoc_exportados() pública: [{ id, exportado }] para la marca en la página del concurso.
-- (Cuerpos completos aplicados en Supabase.)

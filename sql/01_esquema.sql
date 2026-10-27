-- =========================================================
-- Panel de Jurados · VI CONCEPMI 2026
-- Tablas con prefijo jur_ (no tocan las del Concurso de Conocimientos).
-- Nadie lee las tablas directamente: todo pasa por funciones que
-- validan el código de jurado o de administrador.
-- =========================================================

create table if not exists public.jur_config (clave text primary key, valor text not null);

create table if not exists public.jur_concursos (
  id text primary key,
  nombre text not null,
  abierto boolean not null default true
);

create table if not exists public.jur_criterios (
  concurso_id text not null references public.jur_concursos(id) on delete cascade,
  subprueba text not null,
  criterio_id text not null,
  max numeric not null,
  niveles numeric[],
  primary key (concurso_id, subprueba, criterio_id)
);

create table if not exists public.jur_delegaciones (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  siglas text not null default '',
  creado timestamptz not null default now()
);

create table if not exists public.jur_jurados (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  codigo text not null unique,
  concursos text[] not null default '{}',
  creado timestamptz not null default now()
);

create table if not exists public.jur_calificaciones (
  id uuid primary key default gen_random_uuid(),
  concurso_id text not null references public.jur_concursos(id) on delete cascade,
  subprueba text not null,
  delegacion_id uuid not null references public.jur_delegaciones(id) on delete cascade,
  jurado_id uuid not null references public.jur_jurados(id) on delete cascade,
  datos jsonb not null,
  total numeric not null,
  comentario text not null default '',
  creado timestamptz not null default now(),
  actualizado timestamptz not null default now(),
  unique (concurso_id, subprueba, delegacion_id, jurado_id)
);

create table if not exists public.jur_ajustes (
  concurso_id text not null references public.jur_concursos(id) on delete cascade,
  delegacion_id uuid not null references public.jur_delegaciones(id) on delete cascade,
  retraso boolean not null default false,
  walkover boolean not null default false,
  descalificado boolean not null default false,
  valor numeric,
  nota text not null default '',
  actualizado timestamptz not null default now(),
  primary key (concurso_id, delegacion_id)
);

alter table public.jur_config enable row level security;
alter table public.jur_concursos enable row level security;
alter table public.jur_criterios enable row level security;
alter table public.jur_delegaciones enable row level security;
alter table public.jur_jurados enable row level security;
alter table public.jur_calificaciones enable row level security;
alter table public.jur_ajustes enable row level security;
revoke all on public.jur_config, public.jur_concursos, public.jur_criterios, public.jur_delegaciones,
  public.jur_jurados, public.jur_calificaciones, public.jur_ajustes from anon, authenticated;

-- Concursos
insert into public.jur_concursos (id, nombre) values
 ('proyectos','Concurso Nacional de Proyectos'),('iathon','IATHON'),('amateur-1','Amateur I'),
 ('amateur-2','Amateur II'),('conocimientos','Concurso Nacional de Conocimientos'),
 ('gymkana','Gran Gymkana'),('barras','Concurso de Barras'),('talent','Talent Show')
on conflict (id) do update set nombre = excluded.nombre;

-- Máximos por criterio (generado desde js/concursos.js)
delete from public.jur_criterios;
insert into public.jur_criterios (concurso_id, subprueba, criterio_id, max, niveles) values
('proyectos','virtual','v1',3,null),
('proyectos','virtual','v2',3,null),
('proyectos','virtual','v3',3,null),
('proyectos','virtual','v4',6,null),
('proyectos','virtual','v5',2,null),
('proyectos','virtual','v6',3,null),
('proyectos','virtual','v7',1,null),
('proyectos','virtual','v8',1,null),
('proyectos','virtual','v9',3,null),
('proyectos','virtual','v10',2,null),
('proyectos','virtual','v11',3,null),
('proyectos','virtual','v12',3,null),
('proyectos','virtual','v13',5,null),
('proyectos','virtual','v14',2,null),
('proyectos','presencial','p1',7.5,null),
('proyectos','presencial','p2',7.5,null),
('proyectos','presencial','p3',10,null),
('proyectos','presencial','p4',5,null),
('proyectos','presencial','p5',5,null),
('proyectos','presencial','p6',10,null),
('proyectos','presencial','p7',12,null),
('proyectos','presencial','p8',3,null),
('iathon','unica','c1',10,null),
('iathon','unica','c2',10,null),
('iathon','unica','c3',10,null),
('iathon','unica','c4',20,null),
('iathon','unica','c5',20,null),
('amateur-1','unica','c1',15,'{15,12,9,6,3}'),
('amateur-1','unica','c2',10,'{10,8,6,4,2}'),
('amateur-1','unica','c3',8,'{8,6,5,3,2}'),
('amateur-1','unica','c4',10,'{10,8,6,4,2}'),
('amateur-1','unica','c5',10,'{10,8,6,4,2}'),
('amateur-1','unica','c6',7,'{7,6,4,3,1}'),
('amateur-2','unica','c1',10,null),
('amateur-2','unica','c2',15,null),
('amateur-2','unica','c3',10,null),
('amateur-2','unica','c4',8,null),
('amateur-2','unica','c5',10,null),
('amateur-2','unica','c6',7,null),
('barras','unica','c1',20,'{20,15,10,5}'),
('barras','unica','c2',20,'{20,15,10,5}'),
('barras','unica','c3',20,'{20,15,10,5}'),
('barras','unica','c4',20,'{20,15,10,5}'),
('barras','unica','c5',20,'{20,10,5}');

-- PENDIENTE: aún no aplicado en Supabase (esperando aprobación del usuario).
-- =========================================================
-- Logística del evento (migración jur_08_logistica). Solo agrega tablas y funciones.
-- Presupuesto vs real por categoría, proveedores, fondos entregados (caja a rendir) y gastos.
-- Solo el admin lee y escribe (todo pasa por funciones que validan el código).
-- =========================================================
create table if not exists public.jur_log_config (
  id int primary key default 1 check (id = 1),
  tc numeric not null default 3.4,           -- tipo de cambio USD → S/
  contingencia numeric not null default 0.1  -- % de contingencia sobre el subtotal
);
insert into public.jur_log_config (id) values (1) on conflict do nothing;

create table if not exists public.jur_log_categorias (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  orden int not null default 0,
  creado timestamptz not null default now()
);

create table if not exists public.jur_log_proveedores (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  rubro text not null default '',
  ruc text not null default '',
  contacto text not null default '',
  telefono text not null default '',
  email text not null default '',
  direccion text not null default '',
  web text not null default '',
  notas text not null default '',
  creado timestamptz not null default now()
);

create table if not exists public.jur_log_items (
  id uuid primary key default gen_random_uuid(),
  categoria_id uuid not null references public.jur_log_categorias(id),
  descripcion text not null,
  para text not null default '',
  tipo text not null default 'CV' check (tipo in ('CV', 'CF')),
  cantidad numeric not null default 1,
  cu numeric not null default 0,               -- costo unitario presupuestado (S/)
  acordado numeric,                            -- monto total acordado con el proveedor (S/)
  estado text not null default 'pendiente' check (estado in ('pendiente', 'cotizando', 'aprobado', 'comprado', 'entregado', 'cancelado')),
  proveedor_id uuid references public.jur_log_proveedores(id) on delete set null,
  adelanto boolean not null default false,
  adelanto_monto numeric,
  adelanto_fecha date,
  entrega_fecha date,
  entrega_lugar text not null default '',
  medio_pago text not null default '',
  responsable text not null default '',
  enlace text not null default '',             -- cotización / factura (Drive)
  notas text not null default '',
  orden int not null default 0,
  actualizado timestamptz not null default now()
);

create table if not exists public.jur_log_fondos (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  responsable text not null default '',
  monto numeric not null default 0,
  fecha date,
  notas text not null default '',
  creado timestamptz not null default now()
);

create table if not exists public.jur_log_gastos (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.jur_log_items(id) on delete set null,
  fondo_id uuid references public.jur_log_fondos(id) on delete set null,
  fecha date,
  concepto text not null default '',
  monto numeric not null,
  moneda text not null default 'PEN' check (moneda in ('PEN', 'USD')),
  tc numeric,
  monto_pen numeric not null,
  comprobante text not null default '',
  a_nombre_pmi boolean not null default false,
  notas text not null default '',
  creado timestamptz not null default now()
);

alter table public.jur_log_config enable row level security;
alter table public.jur_log_categorias enable row level security;
alter table public.jur_log_proveedores enable row level security;
alter table public.jur_log_items enable row level security;
alter table public.jur_log_fondos enable row level security;
alter table public.jur_log_gastos enable row level security;
revoke all on public.jur_log_config, public.jur_log_categorias, public.jur_log_proveedores, public.jur_log_items, public.jur_log_fondos, public.jur_log_gastos from anon, authenticated;

create or replace function public.jur_log_num(p jsonb, k text) returns numeric
language sql immutable as $$ select nullif(trim(coalesce(p->>k, '')), '')::numeric $$;
create or replace function public.jur_log_fecha(p jsonb, k text) returns date
language sql immutable as $$ select nullif(trim(coalesce(p->>k, '')), '')::date $$;
create or replace function public.jur_log_txt(p jsonb, k text, n int default 500) returns text
language sql immutable as $$ select left(trim(coalesce(p->>k, '')), n) $$;

create or replace function public.jur_admin_logistica(p_codigo text) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return json_build_object(
    'config', (select row_to_json(c) from jur_log_config c where id = 1),
    'categorias', coalesce((select json_agg(row_to_json(x) order by x.orden, x.creado) from jur_log_categorias x), '[]'),
    'items', coalesce((select json_agg(row_to_json(x) order by x.orden, x.descripcion) from jur_log_items x), '[]'),
    'proveedores', coalesce((select json_agg(row_to_json(x) order by x.nombre) from jur_log_proveedores x), '[]'),
    'fondos', coalesce((select json_agg(row_to_json(x) order by x.creado) from jur_log_fondos x), '[]'),
    'gastos', coalesce((select json_agg(row_to_json(x) order by x.fecha desc nulls last, x.creado desc) from jur_log_gastos x), '[]'));
end $$;

-- Crea o actualiza una fila. p_tabla: categoria | item | proveedor | fondo | gasto. Devuelve el id.
create or replace function public.jur_admin_log_guardar(p_codigo text, p_tabla text, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p_datos->>'id', '')::uuid; v_tc numeric; v_moneda text; v_monto numeric;
begin
  perform jur_exigir_admin(p_codigo);
  if p_tabla = 'categoria' then
    if jur_log_txt(p_datos, 'nombre') = '' then raise exception 'Escribe el nombre de la categoría'; end if;
    insert into jur_log_categorias (id, nombre, orden) values (coalesce(v_id, gen_random_uuid()), jur_log_txt(p_datos, 'nombre', 120),
      coalesce(jur_log_num(p_datos, 'orden')::int, (select coalesce(max(orden), 0) + 1 from jur_log_categorias)))
    on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden returning id into v_id;
  elsif p_tabla = 'item' then
    if jur_log_txt(p_datos, 'descripcion') = '' then raise exception 'Escribe la descripción del ítem'; end if;
    if not exists (select 1 from jur_log_categorias where id = nullif(p_datos->>'categoria_id', '')::uuid) then raise exception 'Elige la categoría'; end if;
    insert into jur_log_items (id, categoria_id, descripcion, para, tipo, cantidad, cu, acordado, estado, proveedor_id, adelanto, adelanto_monto, adelanto_fecha,
      entrega_fecha, entrega_lugar, medio_pago, responsable, enlace, notas, orden, actualizado)
    values (coalesce(v_id, gen_random_uuid()), (p_datos->>'categoria_id')::uuid, jur_log_txt(p_datos, 'descripcion', 300), jur_log_txt(p_datos, 'para', 300),
      coalesce(nullif(p_datos->>'tipo', ''), 'CV'), coalesce(jur_log_num(p_datos, 'cantidad'), 1), coalesce(jur_log_num(p_datos, 'cu'), 0), jur_log_num(p_datos, 'acordado'),
      coalesce(nullif(p_datos->>'estado', ''), 'pendiente'), nullif(p_datos->>'proveedor_id', '')::uuid, coalesce((p_datos->>'adelanto')::boolean, false),
      jur_log_num(p_datos, 'adelanto_monto'), jur_log_fecha(p_datos, 'adelanto_fecha'), jur_log_fecha(p_datos, 'entrega_fecha'), jur_log_txt(p_datos, 'entrega_lugar'),
      jur_log_txt(p_datos, 'medio_pago'), jur_log_txt(p_datos, 'responsable'), jur_log_txt(p_datos, 'enlace', 1000), jur_log_txt(p_datos, 'notas', 2000),
      coalesce(jur_log_num(p_datos, 'orden')::int, 999), now())
    on conflict (id) do update set categoria_id = excluded.categoria_id, descripcion = excluded.descripcion, para = excluded.para, tipo = excluded.tipo,
      cantidad = excluded.cantidad, cu = excluded.cu, acordado = excluded.acordado, estado = excluded.estado, proveedor_id = excluded.proveedor_id,
      adelanto = excluded.adelanto, adelanto_monto = excluded.adelanto_monto, adelanto_fecha = excluded.adelanto_fecha, entrega_fecha = excluded.entrega_fecha,
      entrega_lugar = excluded.entrega_lugar, medio_pago = excluded.medio_pago, responsable = excluded.responsable, enlace = excluded.enlace,
      notas = excluded.notas, orden = excluded.orden, actualizado = now()
    returning id into v_id;
  elsif p_tabla = 'proveedor' then
    if jur_log_txt(p_datos, 'nombre') = '' then raise exception 'Escribe el nombre del proveedor'; end if;
    insert into jur_log_proveedores (id, nombre, rubro, ruc, contacto, telefono, email, direccion, web, notas)
    values (coalesce(v_id, gen_random_uuid()), jur_log_txt(p_datos, 'nombre', 160), jur_log_txt(p_datos, 'rubro', 120), jur_log_txt(p_datos, 'ruc', 20),
      jur_log_txt(p_datos, 'contacto', 120), jur_log_txt(p_datos, 'telefono', 40), jur_log_txt(p_datos, 'email', 120), jur_log_txt(p_datos, 'direccion'),
      jur_log_txt(p_datos, 'web', 300), jur_log_txt(p_datos, 'notas', 2000))
    on conflict (id) do update set nombre = excluded.nombre, rubro = excluded.rubro, ruc = excluded.ruc, contacto = excluded.contacto, telefono = excluded.telefono,
      email = excluded.email, direccion = excluded.direccion, web = excluded.web, notas = excluded.notas
    returning id into v_id;
  elsif p_tabla = 'fondo' then
    if jur_log_txt(p_datos, 'nombre') = '' then raise exception 'Escribe el nombre del fondo'; end if;
    insert into jur_log_fondos (id, nombre, responsable, monto, fecha, notas)
    values (coalesce(v_id, gen_random_uuid()), jur_log_txt(p_datos, 'nombre', 160), jur_log_txt(p_datos, 'responsable', 160), coalesce(jur_log_num(p_datos, 'monto'), 0),
      jur_log_fecha(p_datos, 'fecha'), jur_log_txt(p_datos, 'notas', 2000))
    on conflict (id) do update set nombre = excluded.nombre, responsable = excluded.responsable, monto = excluded.monto, fecha = excluded.fecha, notas = excluded.notas
    returning id into v_id;
  elsif p_tabla = 'gasto' then
    v_monto := jur_log_num(p_datos, 'monto');
    if v_monto is null or v_monto <= 0 then raise exception 'Escribe el monto del gasto'; end if;
    v_moneda := coalesce(nullif(p_datos->>'moneda', ''), 'PEN');
    v_tc := coalesce(jur_log_num(p_datos, 'tc'), (select tc from jur_log_config where id = 1));
    insert into jur_log_gastos (id, item_id, fondo_id, fecha, concepto, monto, moneda, tc, monto_pen, comprobante, a_nombre_pmi, notas)
    values (coalesce(v_id, gen_random_uuid()), nullif(p_datos->>'item_id', '')::uuid, nullif(p_datos->>'fondo_id', '')::uuid, jur_log_fecha(p_datos, 'fecha'),
      jur_log_txt(p_datos, 'concepto', 300), v_monto, v_moneda, case when v_moneda = 'USD' then v_tc end,
      round(v_monto * case when v_moneda = 'USD' then v_tc else 1 end, 2), jur_log_txt(p_datos, 'comprobante', 120),
      coalesce((p_datos->>'a_nombre_pmi')::boolean, false), jur_log_txt(p_datos, 'notas', 2000))
    on conflict (id) do update set item_id = excluded.item_id, fondo_id = excluded.fondo_id, fecha = excluded.fecha, concepto = excluded.concepto, monto = excluded.monto,
      moneda = excluded.moneda, tc = excluded.tc, monto_pen = excluded.monto_pen, comprobante = excluded.comprobante, a_nombre_pmi = excluded.a_nombre_pmi, notas = excluded.notas
    returning id into v_id;
  else
    raise exception 'Tabla no válida';
  end if;
  return v_id;
end $$;

-- Elimina una fila. Una categoría solo se elimina vacía; al eliminar un ítem, proveedor o fondo, sus gastos se conservan.
create or replace function public.jur_admin_log_borrar(p_codigo text, p_tabla text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  if p_tabla = 'categoria' then
    if exists (select 1 from jur_log_items where categoria_id = p_id) then raise exception 'Primero mueve o elimina los ítems de esta categoría'; end if;
    delete from jur_log_categorias where id = p_id;
  elsif p_tabla = 'item' then delete from jur_log_items where id = p_id;
  elsif p_tabla = 'proveedor' then delete from jur_log_proveedores where id = p_id;
  elsif p_tabla = 'fondo' then delete from jur_log_fondos where id = p_id;
  elsif p_tabla = 'gasto' then delete from jur_log_gastos where id = p_id;
  else raise exception 'Tabla no válida';
  end if;
end $$;

create or replace function public.jur_admin_log_config(p_codigo text, p_tc numeric, p_contingencia numeric) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  if p_tc is null or p_tc <= 0 then raise exception 'El tipo de cambio debe ser mayor que 0'; end if;
  if p_contingencia is null or p_contingencia < 0 or p_contingencia > 0.5 then raise exception 'La contingencia va de 0 % a 50 %'; end if;
  update jur_log_config set tc = p_tc, contingencia = p_contingencia where id = 1;
end $$;

revoke all on function public.jur_log_num(jsonb, text), public.jur_log_fecha(jsonb, text), public.jur_log_txt(jsonb, text, int) from public, anon, authenticated;
grant execute on function public.jur_admin_logistica(text), public.jur_admin_log_guardar(text, text, jsonb),
  public.jur_admin_log_borrar(text, text, uuid), public.jur_admin_log_config(text, numeric, numeric) to anon, authenticated;

-- =========================================================
-- Logística v2 (migración jur_09_logistica_v2). Solo agrega tablas/funciones y ajusta datos de logística.
-- - Historial de cambios del presupuesto (agregado / modificado / eliminado), se registra solo.
-- - Orden manual de categorías e ítems.
-- - Comprobantes adjuntos (imágenes o PDF) guardados en la base, solo accesibles por el admin.
-- =========================================================
create table if not exists public.jur_log_historial (
  id uuid primary key default gen_random_uuid(),
  fecha timestamptz not null default now(),
  accion text not null,           -- agregado | modificado | eliminado | categoria_agregada | categoria_renombrada | categoria_eliminada
  categoria text not null default '',
  descripcion text not null default '',
  antes numeric,
  despues numeric,
  detalle text not null default ''
);

create table if not exists public.jur_log_archivos (
  id uuid primary key default gen_random_uuid(),
  gasto_id uuid references public.jur_log_gastos(id) on delete cascade,
  item_id uuid references public.jur_log_items(id) on delete set null,
  nombre text not null,
  tipo text not null default '',
  tamano int not null default 0,
  datos text not null,            -- archivo en base64
  creado timestamptz not null default now()
);

alter table public.jur_log_historial enable row level security;
alter table public.jur_log_archivos enable row level security;
revoke all on public.jur_log_historial, public.jur_log_archivos from anon, authenticated;

-- Reconstrucción de lo que ya cambió antes de existir el historial
update public.jur_log_items set pres_original = 9, orden = 1
  where id = '2ae4e755-d17d-4a82-bbd7-8661b995220b' and pres_original is null;  -- constancia borrada y creada de nuevo, igual a la original
-- (Aquí se registraron en el historial dos cambios previos del presupuesto; esos datos se retiraron del repositorio público.)

create or replace function public.jur_log_hist(p_accion text, p_cat text, p_desc text, p_antes numeric, p_despues numeric, p_detalle text default '')
returns void language sql security definer set search_path = public as $$
  insert into jur_log_historial (accion, categoria, descripcion, antes, despues, detalle) values (p_accion, coalesce(p_cat, ''), coalesce(p_desc, ''), p_antes, p_despues, coalesce(p_detalle, ''));
$$;

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
    'gastos', coalesce((select json_agg(row_to_json(x) order by x.fecha desc nulls last, x.creado desc) from jur_log_gastos x), '[]'),
    'archivos', coalesce((select json_agg(json_build_object('id', id, 'gasto_id', gasto_id, 'item_id', item_id, 'nombre', nombre, 'tipo', tipo, 'tamano', tamano, 'creado', creado) order by creado) from jur_log_archivos), '[]'),
    'historial', coalesce((select json_agg(row_to_json(x) order by x.fecha desc) from (select * from jur_log_historial order by fecha desc limit 300) x), '[]'));
end $$;

create or replace function public.jur_admin_log_guardar(p_codigo text, p_tabla text, p_datos jsonb) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_id uuid := nullif(p_datos->>'id', '')::uuid; v_tc numeric; v_moneda text; v_monto numeric;
  viejo jur_log_items; vcat jur_log_categorias; nuevo_pres numeric; cat_nueva text; cat_vieja text;
begin
  perform jur_exigir_admin(p_codigo);
  if p_tabla = 'categoria' then
    if jur_log_txt(p_datos, 'nombre') = '' then raise exception 'Escribe el nombre de la categoría'; end if;
    select * into vcat from jur_log_categorias where id = v_id;
    insert into jur_log_categorias (id, nombre, orden) values (coalesce(v_id, gen_random_uuid()), jur_log_txt(p_datos, 'nombre', 120),
      coalesce(jur_log_num(p_datos, 'orden')::int, (select coalesce(max(orden), 0) + 1 from jur_log_categorias)))
    on conflict (id) do update set nombre = excluded.nombre, orden = excluded.orden returning id into v_id;
    if vcat.id is null then perform jur_log_hist('categoria_agregada', jur_log_txt(p_datos, 'nombre', 120), '', null, null);
    elsif vcat.nombre <> jur_log_txt(p_datos, 'nombre', 120) then perform jur_log_hist('categoria_renombrada', jur_log_txt(p_datos, 'nombre', 120), '', null, null, 'Antes: ' || vcat.nombre);
    end if;
  elsif p_tabla = 'item' then
    if jur_log_txt(p_datos, 'descripcion') = '' then raise exception 'Escribe la descripción del ítem'; end if;
    if not exists (select 1 from jur_log_categorias where id = nullif(p_datos->>'categoria_id', '')::uuid) then raise exception 'Elige la categoría'; end if;
    select * into viejo from jur_log_items where id = v_id;
    insert into jur_log_items (id, categoria_id, descripcion, para, tipo, cantidad, cu, acordado, estado, proveedor_id, adelanto, adelanto_monto, adelanto_fecha,
      entrega_fecha, entrega_lugar, medio_pago, responsable, enlace, notas, orden, actualizado)
    values (coalesce(v_id, gen_random_uuid()), (p_datos->>'categoria_id')::uuid, jur_log_txt(p_datos, 'descripcion', 300), jur_log_txt(p_datos, 'para', 300),
      coalesce(nullif(p_datos->>'tipo', ''), 'CV'), coalesce(jur_log_num(p_datos, 'cantidad'), 1), coalesce(jur_log_num(p_datos, 'cu'), 0), jur_log_num(p_datos, 'acordado'),
      coalesce(nullif(p_datos->>'estado', ''), 'pendiente'), nullif(p_datos->>'proveedor_id', '')::uuid, coalesce((p_datos->>'adelanto')::boolean, false),
      jur_log_num(p_datos, 'adelanto_monto'), jur_log_fecha(p_datos, 'adelanto_fecha'), jur_log_fecha(p_datos, 'entrega_fecha'), jur_log_txt(p_datos, 'entrega_lugar'),
      jur_log_txt(p_datos, 'medio_pago'), jur_log_txt(p_datos, 'responsable'), jur_log_txt(p_datos, 'enlace', 1000), jur_log_txt(p_datos, 'notas', 2000),
      coalesce(jur_log_num(p_datos, 'orden')::int, (select coalesce(max(orden), 0) + 1 from jur_log_items where categoria_id = (p_datos->>'categoria_id')::uuid)), now())
    on conflict (id) do update set categoria_id = excluded.categoria_id, descripcion = excluded.descripcion, para = excluded.para, tipo = excluded.tipo,
      cantidad = excluded.cantidad, cu = excluded.cu, acordado = excluded.acordado, estado = excluded.estado, proveedor_id = excluded.proveedor_id,
      adelanto = excluded.adelanto, adelanto_monto = excluded.adelanto_monto, adelanto_fecha = excluded.adelanto_fecha, entrega_fecha = excluded.entrega_fecha,
      entrega_lugar = excluded.entrega_lugar, medio_pago = excluded.medio_pago, responsable = excluded.responsable, enlace = excluded.enlace,
      notas = excluded.notas, orden = excluded.orden, actualizado = now()
    returning id into v_id;
    nuevo_pres := coalesce(jur_log_num(p_datos, 'cantidad'), 1) * coalesce(jur_log_num(p_datos, 'cu'), 0);
    select nombre into cat_nueva from jur_log_categorias where id = (p_datos->>'categoria_id')::uuid;
    if viejo.id is null then
      perform jur_log_hist('agregado', cat_nueva, jur_log_txt(p_datos, 'descripcion', 300), null, nuevo_pres);
    else
      select nombre into cat_vieja from jur_log_categorias where id = viejo.categoria_id;
      if viejo.cantidad * viejo.cu <> nuevo_pres or viejo.categoria_id <> (p_datos->>'categoria_id')::uuid then
        perform jur_log_hist('modificado', cat_nueva, jur_log_txt(p_datos, 'descripcion', 300), viejo.cantidad * viejo.cu, nuevo_pres,
          case when viejo.categoria_id <> (p_datos->>'categoria_id')::uuid then 'Movido desde ' || cat_vieja else
            'Cantidad ' || trim(to_char(viejo.cantidad, 'FM999999990.##')) || ' → ' || trim(to_char(coalesce(jur_log_num(p_datos, 'cantidad'), 1), 'FM999999990.##')) ||
            ' · C/U S/ ' || trim(to_char(viejo.cu, 'FM999999990.00')) || ' → S/ ' || trim(to_char(coalesce(jur_log_num(p_datos, 'cu'), 0), 'FM999999990.00')) end);
      end if;
    end if;
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

create or replace function public.jur_admin_log_borrar(p_codigo text, p_tabla text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare it jur_log_items; ct jur_log_categorias;
begin
  perform jur_exigir_admin(p_codigo);
  if p_tabla = 'categoria' then
    if exists (select 1 from jur_log_items where categoria_id = p_id) then raise exception 'Primero mueve o elimina los ítems de esta categoría'; end if;
    select * into ct from jur_log_categorias where id = p_id;
    delete from jur_log_categorias where id = p_id;
    if ct.id is not null then perform jur_log_hist('categoria_eliminada', ct.nombre, '', null, null); end if;
  elsif p_tabla = 'item' then
    select * into it from jur_log_items where id = p_id;
    delete from jur_log_items where id = p_id;
    if it.id is not null then
      perform jur_log_hist('eliminado', (select nombre from jur_log_categorias where id = it.categoria_id), it.descripcion, it.cantidad * it.cu, null, it.para);
    end if;
  elsif p_tabla = 'proveedor' then delete from jur_log_proveedores where id = p_id;
  elsif p_tabla = 'fondo' then delete from jur_log_fondos where id = p_id;
  elsif p_tabla = 'gasto' then delete from jur_log_gastos where id = p_id;
  else raise exception 'Tabla no válida';
  end if;
end $$;

-- Guarda el orden: p_ids en el orden deseado (categorías, o ítems de una misma categoría)
create or replace function public.jur_admin_log_orden(p_codigo text, p_tabla text, p_ids uuid[]) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  if p_tabla = 'categoria' then
    update jur_log_categorias c set orden = x.n from unnest(p_ids) with ordinality as x(id, n) where c.id = x.id;
  elsif p_tabla = 'item' then
    update jur_log_items i set orden = x.n from unnest(p_ids) with ordinality as x(id, n) where i.id = x.id;
  else raise exception 'Tabla no válida';
  end if;
end $$;

-- Comprobantes (máx. ~5 MB por archivo)
create or replace function public.jur_admin_log_archivo_subir(p_codigo text, p_gasto uuid, p_item uuid, p_nombre text, p_tipo text, p_datos text) returns uuid
language plpgsql security definer set search_path = public as $$
declare v uuid;
begin
  perform jur_exigir_admin(p_codigo);
  if p_gasto is null and p_item is null then raise exception 'El archivo debe pertenecer a un gasto o a un ítem'; end if;
  if coalesce(length(p_datos), 0) = 0 then raise exception 'El archivo está vacío'; end if;
  if length(p_datos) > 7000000 then raise exception 'El archivo pesa más de 5 MB. Comprime la imagen o el PDF.'; end if;
  insert into jur_log_archivos (gasto_id, item_id, nombre, tipo, tamano, datos)
  values (p_gasto, p_item, left(coalesce(nullif(trim(p_nombre), ''), 'comprobante'), 200), left(coalesce(p_tipo, ''), 100), floor(length(p_datos) * 3 / 4), p_datos)
  returning id into v;
  return v;
end $$;

create or replace function public.jur_admin_log_archivo(p_codigo text, p_id uuid) returns json
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  return (select json_build_object('id', id, 'nombre', nombre, 'tipo', tipo, 'datos', datos) from jur_log_archivos where id = p_id);
end $$;

create or replace function public.jur_admin_log_archivo_borrar(p_codigo text, p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform jur_exigir_admin(p_codigo);
  delete from jur_log_archivos where id = p_id;
end $$;

revoke all on function public.jur_log_hist(text, text, text, numeric, numeric, text) from public, anon, authenticated;
grant execute on function public.jur_admin_log_orden(text, text, uuid[]), public.jur_admin_log_archivo_subir(text, uuid, uuid, text, text, text),
  public.jur_admin_log_archivo(text, uuid), public.jur_admin_log_archivo_borrar(text, uuid) to anon, authenticated;

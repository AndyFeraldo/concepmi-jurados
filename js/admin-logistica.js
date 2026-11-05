// =========================================================
// Admin · Logística del evento
// Resumen para gerencia, presupuesto vs real por categoría (con orden manual),
// compras con un clic, gastos con comprobantes adjuntos, proveedores e historial.
// Presupuesto = el actual (cantidad × C/U); el aprobado original queda como referencia.
// Real de un ítem = costo real registrado; si no hay, lo pagado.
// =========================================================
import { api } from "./api.js?v=202611050110";
import { $, $$, esc, I, aviso, modal, confirmar } from "./ui.js?v=202611050110";

export const ESTADOS = {
  pendiente: ["Pendiente", ""], cotizando: ["Cotizando", "chip--celeste"], aprobado: ["Aprobado", "chip--ambar"],
  comprado: ["Comprado", "chip--verde"], entregado: ["Entregado", "chip--verde"], cancelado: ["Cancelado", "chip--rojo"],
};
const ESTADOS_FORM = ["pendiente", "cotizando", "comprado", "entregado", "cancelado"];
const COMPRADO = ["comprado", "entregado"];
const LIMITE_ESPECIAL = 700; // compras > S/ 700: gestión especial y aprobación de Directiva
const MAX_ARCHIVO = 5 * 1024 * 1024;
const soles = (n) => (n == null || isNaN(n) ? "—" : `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const firma = (n) => `${n > 0.005 ? "+" : n < -0.005 ? "−" : ""}${soles(Math.abs(n))}`;
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return String(v ?? "").trim() === "" || isNaN(n) ? null : n; };
const dos = (n) => String(n).padStart(2, "0");
const hoyISO = () => { const d = new Date(); return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`; };
// Fechas siempre en día/mes/año
const fecha = (iso) => { if (!iso) return "Sin fecha"; const [a, m, d] = String(iso).slice(0, 10).split("-"); return `${d}/${m}/${a}`; };
const fechaHora = (ts) => { const d = new Date(ts); return `${dos(d.getDate())}/${dos(d.getMonth() + 1)}/${d.getFullYear()} ${dos(d.getHours())}:${dos(d.getMinutes())}`; };
function isoDe(txt) { // "dd/mm/aaaa" → "aaaa-mm-dd" ('' si vacío, null si inválido)
  const t = String(txt || "").trim(); if (!t) return "";
  const m = t.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{4})$/); if (!m) return null;
  const [d, mo, a] = [Number(m[1]), Number(m[2]), Number(m[3])], f = new Date(a, mo - 1, d);
  return f.getFullYear() === a && f.getMonth() === mo - 1 && f.getDate() === d ? `${a}-${dos(mo)}-${dos(d)}` : null;
}
const campoFecha = (name, iso, titulo) => `<label class="campo"><span>${titulo}</span><input name="${name}" data-fecha inputmode="numeric" maxlength="10" placeholder="dd/mm/aaaa" value="${iso ? fecha(iso) : ""}"></label>`;
function mascaraFechas(raiz) {
  $$("[data-fecha]", raiz).forEach((el) => (el.oninput = () => {
    const d = el.value.replace(/\D/g, "").slice(0, 8);
    el.value = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
  }));
}
function leerFechas(f, nombres) {
  const r = {};
  for (const n of nombres) { const v = isoDe(f[n].value); if (v === null) throw new Error(`La fecha "${f[n].value}" no es válida. Usa día/mes/año, por ejemplo 24/11/2026.`); r[n] = v; }
  return r;
}
const telLimpio = (t) => String(t || "").replace(/\D/g, "");
const whatsapp = (t) => { const d = telLimpio(t); return d ? `https://wa.me/${d.length === 9 ? `51${d}` : d}` : ""; };
const kb = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const ACCION = { agregado: ["Agregado", "chip--celeste"], modificado: ["Modificado", "chip--ambar"], eliminado: ["Eliminado", "chip--rojo"],
  categoria_agregada: ["Categoría nueva", "chip--celeste"], categoria_renombrada: ["Categoría renombrada", "chip--ambar"], categoria_eliminada: ["Categoría eliminada", "chip--rojo"] };

// ctx = { codigo(): string }
export function crearLogistica(ctx) {
  let L = null, cargando = null, sub = "resumen", filtro = "", abiertas = new Set(), soloCambios = false;

  async function cargar() {
    cargando ||= api.adminLogistica(ctx.codigo()).then((d) => { L = d; L.archivos ||= []; L.historial ||= []; }).finally(() => { cargando = null; });
    return cargando;
  }

  // ---------- Cálculos ----------
  const gastosDe = (id) => L.gastos.filter((g) => g.item_id === id);
  const archivosDe = (campo, id) => L.archivos.filter((a) => a[campo] === id);
  const pres = (it) => Number(it.cantidad) * Number(it.cu);
  const pagado = (it) => gastosDe(it.id).reduce((s, g) => s + Number(g.monto_pen), 0);
  function real(it) {
    if (it.acordado != null) return Number(it.acordado);
    const p = pagado(it);
    return p > 0 || it.estado === "cancelado" ? p : null;
  }
  const cambio = (it) => (it.pres_original == null ? "nuevo" : Math.abs(pres(it) - Number(it.pres_original)) > 0.005 ? "modificado" : "");
  const itemsDe = (cid) => L.items.filter((i) => i.categoria_id === cid).sort((a, b) => a.orden - b.orden || a.descripcion.localeCompare(b.descripcion));
  const cats = () => [...L.categorias].sort((a, b) => a.orden - b.orden);
  const prov = (id) => L.proveedores.find((p) => p.id === id);
  const cat = (id) => L.categorias.find((c) => c.id === id);
  const item = (id) => L.items.find((i) => i.id === id);
  const fondo = (id) => L.fondos.find((f) => f.id === id);
  function totales(items) {
    let p = 0, r = 0, pg = 0, porPagar = 0, comprados = 0, cancelados = 0, orig = 0, pendienteMonto = 0, dif = 0;
    for (const it of items) {
      const re = real(it), pa = pagado(it);
      if (it.estado !== "cancelado") p += pres(it);
      if (it.pres_original != null) orig += Number(it.pres_original);
      if (re != null) { r += re; dif += re - (it.estado === "cancelado" ? 0 : pres(it)); } // solo compara lo que ya tiene costo real
      pg += pa; porPagar += Math.max(0, (re ?? 0) - pa);
      if (COMPRADO.includes(it.estado)) comprados++;
      else if (it.estado === "cancelado") cancelados++;
      else pendienteMonto += pres(it);
    }
    return { pres: p, real: r, pagado: pg, porPagar, comprados, cancelados, n: items.length, orig, pendienteMonto, dif };
  }
  const gastadoFondo = (id) => L.gastos.filter((g) => g.fondo_id === id).reduce((s, g) => s + Number(g.monto_pen), 0);
  const base = () => (L.config.linea_base == null ? null : Number(L.config.linea_base));
  const cont = () => Number(L.config.contingencia);

  // ---------- Vista principal ----------
  async function vista(v) {
    if (!L) {
      v.innerHTML = `<div class="cargando" style="min-height:30vh"><div class="giro"></div>Cargando logística…</div>`;
      try { await cargar(); }
      catch (e) {
        v.innerHTML = `<div class="vacio"><b>No se pudo cargar la logística</b>${esc(/function|does not exist|schema cache/i.test(e.message) ? "La base de datos de logística todavía no está activada." : e.message)}</div>`;
        return;
      }
      if (!document.body.contains(v)) return;
    }
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Logística</h1><p>Presupuesto, compras, pagos y comprobantes del VI CONCEPMI.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--mini" data-ajustes>${I.lapiz}Ajustes</button>
          <button class="btn btn--mini" data-reporte>${I.tabla}Reporte para gerencia</button>
          <button class="btn btn--mini btn--naranja" data-xls>${I.descargar}Exportar a Excel</button></div></div>
      <div class="pestanas" role="tablist">
        ${[["resumen", "Resumen", "vivo"], ["presupuesto", "Presupuesto vs real", "tabla"], ["gastos", "Gastos y comprobantes", "copa"], ["proveedores", "Proveedores", "personas"], ["historial", "Historial de cambios", "reloj"]]
          .map(([id, t, ic]) => `<button class="pestana" role="tab" data-sub="${id}" aria-selected="${sub === id}">${I[ic]}${t}</button>`).join("")}
      </div>
      <div data-cuerpo></div>`;
    $$("[data-sub]", v).forEach((b) => (b.onclick = () => { sub = b.dataset.sub; vista(v); }));
    $("[data-ajustes]", v).onclick = () => ajustes(v);
    $("[data-reporte]", v).onclick = reporte;
    $("[data-xls]", v).onclick = () => { try { exportar(); aviso("Excel de logística generado"); } catch (e) { aviso(e.message, "error"); } };
    ({ resumen, presupuesto, gastos, proveedores, historial })[sub]($("[data-cuerpo]", v), v);
  }
  const repintar = async (v, recargar = true) => { if (recargar) { try { await cargar(); } catch (e) { aviso(e.message, "error"); } } vista(v); };

  // ---------- Resumen (mini dashboard) ----------
  function alertas() {
    const en14 = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
    const proximos = [];
    for (const i of L.items) {
      if (i.estado === "cancelado") continue;
      if (i.entrega_fecha && i.entrega_fecha <= en14 && i.estado !== "entregado") proximos.push({ f: i.entrega_fecha, t: `Entrega: ${i.descripcion}`, i });
      if (i.adelanto && i.adelanto_monto && i.adelanto_fecha && pagado(i) < Number(i.adelanto_monto) && i.adelanto_fecha <= en14) proximos.push({ f: i.adelanto_fecha, t: `Adelanto ${soles(i.adelanto_monto)}: ${i.descripcion}`, i });
    }
    return proximos.sort((a, b) => a.f.localeCompare(b.f));
  }

  function resumen(c, v) {
    const T = totales(L.items), k = cont(), b = base();
    const activos = L.items.filter((i) => i.estado !== "cancelado");
    const avance = activos.length ? Math.round((T.comprados / activos.length) * 100) : 0;
    const saldoFondos = L.fondos.reduce((s, f) => s + Number(f.monto) - gastadoFondo(f.id), 0);
    const proximos = alertas(), hoy = hoyISO();
    const faltan = activos.filter((i) => !COMPRADO.includes(i.estado)).sort((a, b2) => pres(b2) - pres(a));
    const desvios = L.items.filter((i) => real(i) != null && real(i) - pres(i) > 0.005).sort((a, b2) => (real(b2) - pres(b2)) - (real(a) - pres(a))).slice(0, 5);
    const sinComp = L.gastos.filter((g) => !archivosDe("gasto_id", g.id).length);
    const especiales = activos.filter((i) => Math.max(pres(i), real(i) ?? 0) > LIMITE_ESPECIAL && !COMPRADO.includes(i.estado));
    const filas = cats().map((ct) => ({ ct, t: totales(itemsDe(ct.id)) }));
    const maxV = Math.max(1, ...filas.map((f) => f.t.pres + Math.max(0, f.t.dif)));
    const estados = [["Comprado o entregado", T.comprados, "est-ok"], ["Cotizando", L.items.filter((i) => i.estado === "cotizando").length, "est-cot"],
      ["Pendiente", L.items.filter((i) => ["pendiente", "aprobado"].includes(i.estado)).length, "est-pen"], ["Cancelado", T.cancelados, "est-can"]];
    const hist = L.historial.slice(0, 5);
    c.innerHTML = `
      <div class="kpis log-kpis">
        <div class="kpi"><b>${soles(T.pres * (1 + k))}</b><span>Presupuesto actual (con ${Math.round(k * 100)} % de contingencia)</span></div>
        <div class="kpi"><b>${soles(T.real)}</b><span>Costo real registrado</span></div>
        <div class="kpi"><b>${soles(T.pagado)}</b><span>Pagado · ${soles(T.porPagar)} por pagar</span></div>
        <div class="kpi"><b>${avance} %</b><span>Compras hechas (${T.comprados} de ${activos.length} ítems)</span><div class="progreso" style="margin-top:8px"><i style="width:${avance}%"></i></div></div>
        <div class="kpi"><b>${soles(saldoFondos)}</b><span>Saldo en fondos a rendir</span></div>
      </div>
      <div class="log-dash">
        <section class="tarjeta log-panel log-panel--ancho">
          <h3>Presupuesto vs real por categoría</h3>
          <div class="log-leyenda"><span><i class="lg-pres"></i>Presupuesto actual</span><span><i class="lg-real"></i>Costo real</span><span><i class="lg-exc"></i>Excedido</span></div>
          <div class="log-barras">${filas.map(({ ct, t }) => {
            const exc = Math.max(0, t.dif), wp = (t.pres / maxV) * 100, wr = (Math.min(t.real - exc, t.pres) / maxV) * 100, we = (exc / maxV) * 100;
            return `<div class="log-barra-fila" title="${esc(ct.nombre)}: presupuesto ${soles(t.pres)} · real ${soles(t.real)}">
              <span class="log-barra-nom">${esc(ct.nombre)}</span>
              <div class="log-barra-pista"><i class="lb-pres" style="width:${wp}%"></i><i class="lb-real" style="width:${wr}%"></i>${we ? `<i class="lb-exc" style="left:${wp}%;width:${we}%"></i>` : ""}</div>
              <span class="log-barra-val">${t.real ? `<b>${soles(t.real)}</b> / ` : ""}${soles(t.pres)}${t.dif > 0.005 ? ` <b class="log-mal">⚠ ${firma(t.dif)}</b>` : ""}</span></div>`; }).join("")}</div>
        </section>
        <section class="tarjeta log-panel">
          <h3>Estado de las compras</h3>
          <div class="log-apilada">${estados.filter((e) => e[1]).map(([t, n, cl]) => `<i class="${cl}" style="flex:${n}" title="${t}: ${n}"></i>`).join("")}</div>
          <ul class="log-lista log-lista--estados">${estados.map(([t, n, cl]) => `<li><i class="log-punto ${cl}"></i><span>${t}</span><b>${n}</b><small>${L.items.length ? Math.round((n / L.items.length) * 100) : 0} %</small></li>`).join("")}</ul>
          <p class="ayuda">Falta comprar por <b>${soles(T.pendienteMonto)}</b> del presupuesto.</p>
        </section>
        <section class="tarjeta log-panel">
          <h3>Presupuesto original aprobado</h3>
          ${b == null ? `<p class="ayuda">Sin línea base registrada.</p>` : `
          <div class="log-comp"><span><small>Aprobado</small><b>${soles(b * (1 + k))}</b></span><span><small>Actual</small><b>${soles(T.pres * (1 + k))}</b></span>
            <span><small>Diferencia</small><b class="${T.pres - b > 0 ? "log-mal" : "log-bien"}">${firma((T.pres - b) * (1 + k))}</b></span></div>
          <p class="ayuda">Montos con contingencia. ${T.pres < b ? "El presupuesto actual es menor que el aprobado." : T.pres > b ? "El presupuesto actual supera al aprobado." : "Sin cambios."}</p>`}
          <h4 class="log-sub">Últimos cambios</h4>
          ${hist.length ? `<ul class="log-lista">${hist.map((h) => `<li><span class="chip ${ACCION[h.accion]?.[1] || ""} log-tag">${ACCION[h.accion]?.[0] || h.accion}</span><span>${esc(h.descripcion || h.categoria)}<small class="tenue"> · ${esc(h.categoria)}</small></span><b>${h.antes != null || h.despues != null ? firma((h.despues ?? 0) - (h.antes ?? 0)) : ""}</b></li>`).join("")}</ul>
            <button class="btn btn--mini" data-verhist>Ver historial completo</button>` : `<p class="ayuda">Sin cambios todavía.</p>`}
        </section>
        <section class="tarjeta log-panel">
          <h3>Próximos vencimientos (14 días)</h3>
          ${proximos.length ? `<ul class="log-lista">${proximos.map((p) => `<li data-item="${p.i.id}" class="log-clic"><b class="${p.f < hoy ? "log-mal" : ""}">${fecha(p.f)}</b><span>${esc(p.t)}</span></li>`).join("")}</ul>`
            : `<p class="ayuda">No hay entregas ni adelantos en los próximos 14 días. Registra las fechas en cada ítem para verlas aquí.</p>`}
        </section>
        <section class="tarjeta log-panel">
          <h3>Lo que falta comprar <small class="tenue">(mayor monto primero)</small></h3>
          ${faltan.length ? `<ul class="log-lista">${faltan.slice(0, 8).map((i) => `<li data-item="${i.id}" class="log-clic"><span>${esc(i.descripcion)}<small class="tenue"> · ${esc(cat(i.categoria_id)?.nombre || "")}</small></span><b>${soles(pres(i))}</b></li>`).join("")}</ul>
            ${faltan.length > 8 ? `<p class="ayuda">y ${faltan.length - 8} ítems más.</p>` : ""}` : `<p class="ayuda">¡Todo comprado! 🎉</p>`}
        </section>
        <section class="tarjeta log-panel">
          <h3>Puntos de atención</h3>
          <ul class="log-lista">
            <li><i class="log-punto ${desvios.length ? "est-mal" : "est-ok"}"></i><span>${desvios.length ? `${desvios.length} ítem${desvios.length === 1 ? "" : "s"} costaron más de lo presupuestado` : "Ningún ítem supera su presupuesto"}</span></li>
            ${desvios.map((i) => `<li data-item="${i.id}" class="log-clic log-sangria"><span>${esc(i.descripcion)}</span><b class="log-mal">${firma(real(i) - pres(i))}</b></li>`).join("")}
            <li><i class="log-punto ${sinComp.length ? "est-cot" : "est-ok"}"></i><span>${sinComp.length ? `${sinComp.length} gasto${sinComp.length === 1 ? "" : "s"} sin comprobante adjunto` : "Todos los gastos tienen comprobante"}</span>${sinComp.length ? `<button class="btn btn--mini" data-vergastos>Ver</button>` : ""}</li>
            <li><i class="log-punto ${especiales.length ? "est-cot" : "est-ok"}"></i><span>${especiales.length ? `${especiales.length} compra${especiales.length === 1 ? "" : "s"} mayor${especiales.length === 1 ? "" : "es"} a S/ ${LIMITE_ESPECIAL} por gestionar (aprobación de la Directiva): ${especiales.map((i) => esc(i.descripcion)).join(", ")}` : `No hay compras mayores a S/ ${LIMITE_ESPECIAL} pendientes`}</span></li>
          </ul>
        </section>
      </div>`;
    $$("[data-item]", c).forEach((el) => (el.onclick = () => formItem(item(el.dataset.item), null, v)));
    $("[data-verhist]", c)?.addEventListener("click", () => { sub = "historial"; vista(v); });
    $("[data-vergastos]", c)?.addEventListener("click", () => { sub = "gastos"; vista(v); });
  }

  // ---------- Presupuesto vs real ----------
  async function mover(tabla, lista, id, paso, v) {
    const ids = lista.map((x) => x.id), i = ids.indexOf(id), j = i + paso;
    if (i < 0 || j < 0 || j >= ids.length) return;
    [ids[i], ids[j]] = [ids[j], ids[i]];
    const fuente = tabla === "categoria" ? L.categorias : L.items;
    ids.forEach((x, n) => { const r = fuente.find((y) => y.id === x); if (r) r.orden = n + 1; });
    vista(v);
    try { await api.adminLogOrden(ctx.codigo(), tabla, ids); } catch (e) { aviso(e.message, "error"); repintar(v); }
  }

  function presupuesto(c, v) {
    const T = totales(L.items), k = cont(), b = base();
    const f = filtro.trim().toLowerCase();
    const coincide = (it) => (!soloCambios || cambio(it)) && (!f || `${it.descripcion} ${it.para} ${prov(it.proveedor_id)?.nombre || ""}`.toLowerCase().includes(f));
    const eliminados = L.historial.filter((h) => h.accion === "eliminado");
    const lista = cats();
    c.innerHTML = `
      <div class="log-2col">
      <div>
      <div class="log-barra"><input class="log-buscar" data-buscar placeholder="Buscar ítem, para qué es o proveedor…" value="${esc(filtro)}">
        <label class="check" style="padding:.45em .8em"><input type="checkbox" data-cambios ${soloCambios ? "checked" : ""}><span>Solo cambios</span></label>
        <button class="btn btn--mini" data-todas>${abiertas.size ? "Contraer todo" : "Expandir todo"}</button>
        <button class="btn btn--mini btn--naranja" data-nuevacat>${I.mas}Nueva categoría</button></div>
      <p class="ayuda" style="margin:-4px 0 10px">Marca la casilla <b>✓</b> cuando compres algo: te pedirá cuánto costó y, si quieres, el comprobante. Usa las flechas ▲▼ para ordenar.</p>
      ${lista.map((ct, ci) => {
        const its = itemsDe(ct.id), vis = its.filter(coincide), t = totales(its);
        if ((f || soloCambios) && !vis.length) return "";
        const abierta = f || soloCambios || abiertas.has(ct.id);
        const dif = t.dif;
        return `<section class="log-cat ${abierta ? "log-cat--abierta" : ""}">
          <header class="log-cat__cab" data-abrir="${ct.id}">
            <span class="log-cat__flecha">${I.flecha}</span>
            <h3>${esc(ct.nombre)} <small>${t.n} ítem${t.n === 1 ? "" : "s"} · ${t.comprados} comprado${t.comprados === 1 ? "" : "s"}</small></h3>
            <div class="log-cat__tot"><span><small>Presupuesto</small><b>${soles(t.pres)}</b></span><span><small>Real</small><b>${t.real ? soles(t.real) : "—"}</b></span>
              <span><small>Diferencia</small><b class="${t.real ? (dif > 0.005 ? "log-mal" : "log-bien") : ""}">${t.real ? firma(dif) : "—"}</b></span></div>
            <span class="log-orden"><button class="btn btn--mini btn--icono" data-subcat="${ct.id}" ${ci === 0 ? "disabled" : ""} title="Subir categoría" aria-label="Subir categoría">▲</button><button class="btn btn--mini btn--icono" data-bajcat="${ct.id}" ${ci === lista.length - 1 ? "disabled" : ""} title="Bajar categoría" aria-label="Bajar categoría">▼</button></span>
          </header>
          ${abierta ? `<div class="tabla-envoltura"><table class="tabla log-tabla"><thead><tr><th title="Comprado">✓</th><th>Descripción</th><th class="num">Cant.</th><th class="num">C/U</th><th class="num">Presupuesto</th><th class="num">Costo real</th><th class="num">Diferencia</th><th>Proveedor</th><th></th></tr></thead>
            <tbody>${vis.map((it) => {
              const re = real(it), d = re == null ? null : re - pres(it), pa = pagado(it), ok = COMPRADO.includes(it.estado), canc = it.estado === "cancelado";
              const nAdj = archivosDe("item_id", it.id).length + gastosDe(it.id).reduce((s, g) => s + archivosDe("gasto_id", g.id).length, 0);
              const pos = its.indexOf(it);
              return `<tr class="log-fila ${canc ? "log-fila--cancelado" : ""} ${ok ? "log-fila--ok" : ""}" data-item="${it.id}" tabindex="0">
                <td class="log-check-celda"><label class="log-check" title="${ok ? "Comprado (clic para desmarcar)" : "Marcar como comprado"}"><input type="checkbox" data-comprar="${it.id}" ${ok ? "checked" : ""} ${canc ? "disabled" : ""}><span></span></label></td>
                <td><b>${esc(it.descripcion)}</b>${cambio(it) === "nuevo" ? ` <span class="chip chip--celeste log-tag">Nuevo</span>` : cambio(it) === "modificado" ? ` <span class="chip chip--ambar log-tag">Modificado</span>` : ""}${canc ? ` <span class="chip chip--rojo log-tag">Cancelado</span>` : it.estado === "cotizando" ? ` <span class="chip chip--celeste log-tag">Cotizando</span>` : it.estado === "entregado" ? ` <span class="chip chip--verde log-tag">Entregado</span>` : ""}${nAdj ? ` <span class="log-adj" title="${nAdj} archivo(s) adjunto(s)">📎${nAdj}</span>` : ""}
                  ${it.para ? `<br><small class="tenue">${esc(it.para)}</small>` : ""}${it.notas ? `<br><small class="log-nota">${esc(it.notas)}</small>` : ""}</td>
                <td class="num">${Number(it.cantidad).toLocaleString("es-PE")}</td><td class="num">${soles(it.cu)}</td>
                <td class="num">${soles(pres(it))}${cambio(it) === "modificado" ? `<br><small class="log-antes">antes ${soles(it.pres_original)}</small>` : ""}</td>
                <td class="num">${re == null ? `<span class="tenue">—</span>` : `<b>${soles(re)}</b>`}${pa > 0 && it.acordado != null && pa < Number(it.acordado) ? `<br><small class="tenue">pagado ${soles(pa)}</small>` : ""}</td>
                <td class="num ${d == null ? "" : d > 0.005 ? "log-mal" : "log-bien"}">${d == null ? "—" : firma(d)}</td>
                <td>${esc(prov(it.proveedor_id)?.nombre || "")}</td>
                <td class="log-orden"><button class="btn btn--mini btn--icono" data-subit="${it.id}" ${pos === 0 ? "disabled" : ""} title="Subir" aria-label="Subir ítem">▲</button><button class="btn btn--mini btn--icono" data-bajit="${it.id}" ${pos === its.length - 1 ? "disabled" : ""} title="Bajar" aria-label="Bajar ítem">▼</button></td></tr>`; }).join("")}
              <tr class="log-subtotal"><td></td><td colspan="3">Subtotal ${esc(ct.nombre)}</td><td class="num">${soles(t.pres)}</td><td class="num">${t.real ? soles(t.real) : "—"}</td><td class="num">${t.real ? firma(dif) : "—"}</td><td colspan="2"></td></tr>
            </tbody></table></div>
            <div class="log-cat__acc"><button class="btn btn--mini btn--naranja" data-nuevo="${ct.id}">${I.mas}Agregar ítem a ${esc(ct.nombre)}</button>
              <button class="btn btn--mini" data-rencat="${ct.id}">${I.lapiz}Renombrar</button>
              ${its.length ? "" : `<button class="btn btn--mini btn--peligro" data-borcat="${ct.id}">${I.basura}Eliminar categoría</button>`}</div>` : ""}
        </section>`; }).join("")}
      <div class="tabla-envoltura" style="margin-top:16px"><table class="tabla log-resumen">
        <thead><tr><th></th><th class="num">Presupuesto actual</th><th class="num">Costo real</th></tr></thead><tbody>
        <tr><td>Subtotal general</td><td class="num">${soles(T.pres)}</td><td class="num">${soles(T.real)}${T.real ? `<br><small class="${T.dif > 0.005 ? "log-mal" : "log-bien"}">${firma(T.dif)} en lo ya comprado</small>` : ""}</td></tr>
        <tr><td>Contingencia ${Math.round(k * 100)} %</td><td class="num">${soles(T.pres * k)}</td><td class="num tenue">—</td></tr>
        <tr class="log-total"><td>TOTAL ESTIMADO</td><td class="num">${soles(T.pres * (1 + k))}</td><td class="num">${soles(T.real)}</td></tr>
      </tbody></table></div>
      </div>
      <aside class="log-lado">
        <section class="tarjeta log-panel">
          <h3>Presupuesto original aprobado</h3>
          ${b == null ? `<p class="ayuda">Sin línea base.</p>` : `
          <div class="log-comp log-comp--col"><span><small>Aprobado (subtotal)</small><b>${soles(b)}</b></span><span><small>Actual (subtotal)</small><b>${soles(T.pres)}</b></span>
            <span><small>Diferencia</small><b class="${T.pres - b > 0 ? "log-mal" : "log-bien"}">${firma(T.pres - b)}</b></span>
            <span><small>Total aprobado con contingencia</small><b>${soles(b * (1 + k))}</b></span></div>`}
          <h4 class="log-sub">Eliminado del presupuesto</h4>
          ${eliminados.length ? `<ul class="log-lista">${eliminados.slice(0, 12).map((h) => `<li><span>${esc(h.descripcion)}<small class="tenue"> · ${esc(h.categoria)} · ${fecha(String(h.fecha).slice(0, 10))}</small></span><b class="log-bien">${firma(-(h.antes ?? 0))}</b></li>`).join("")}</ul>` : `<p class="ayuda">Nada eliminado.</p>`}
          <button class="btn btn--mini" data-verhist>${I.reloj}Ver historial de cambios</button>
        </section>
      </aside>
      </div>`;
    $("[data-cambios]", c).onchange = (e) => { soloCambios = e.target.checked; presupuesto(c, v); };
    $("[data-verhist]", c).onclick = () => { sub = "historial"; vista(v); };
    const bus = $("[data-buscar]", c);
    bus.oninput = () => { filtro = bus.value; const pos = bus.selectionStart; presupuesto(c, v); const b2 = $("[data-buscar]", c); b2.focus(); b2.setSelectionRange(pos, pos); };
    $("[data-todas]", c).onclick = () => { abiertas = abiertas.size ? new Set() : new Set(L.categorias.map((x) => x.id)); presupuesto(c, v); };
    $$("[data-abrir]", c).forEach((h) => (h.onclick = (e) => { if (e.target.closest(".log-orden")) return; const id = h.dataset.abrir; abiertas.has(id) ? abiertas.delete(id) : abiertas.add(id); presupuesto(c, v); }));
    $$("[data-subcat]", c).forEach((b2) => (b2.onclick = () => mover("categoria", cats(), b2.dataset.subcat, -1, v)));
    $$("[data-bajcat]", c).forEach((b2) => (b2.onclick = () => mover("categoria", cats(), b2.dataset.bajcat, 1, v)));
    $$("[data-subit]", c).forEach((b2) => (b2.onclick = (e) => { e.stopPropagation(); const it = item(b2.dataset.subit); mover("item", itemsDe(it.categoria_id), it.id, -1, v); }));
    $$("[data-bajit]", c).forEach((b2) => (b2.onclick = (e) => { e.stopPropagation(); const it = item(b2.dataset.bajit); mover("item", itemsDe(it.categoria_id), it.id, 1, v); }));
    $$(".log-check", c).forEach((l) => (l.onclick = (e) => e.stopPropagation()));
    $$("[data-comprar]", c).forEach((cb) => (cb.onchange = async () => {
      const it = item(cb.dataset.comprar);
      cb.checked = COMPRADO.includes(it.estado); // el estado cambia solo si se confirma
      if (COMPRADO.includes(it.estado)) {
        if (!(await confirmar("¿Desmarcar como comprado?", `<b>${esc(it.descripcion)}</b> volverá a <b>Pendiente</b>. Su costo real y sus pagos se conservan.`, { boton: "Volver a pendiente" }))) return;
        try { await api.adminLogGuardar(ctx.codigo(), "item", { ...it, estado: "pendiente" }); aviso("Marcado como pendiente"); repintar(v); } catch (ex) { aviso(ex.message, "error"); }
      } else comprar(it, v);
    }));
    $$("[data-item]", c).forEach((r) => { r.onclick = (e) => { if (e.target.closest(".log-orden, .log-check")) return; formItem(item(r.dataset.item), null, v); }; r.onkeydown = (e) => { if (e.key === "Enter") r.click(); }; });
    $$("[data-nuevo]", c).forEach((b2) => (b2.onclick = () => formItem(null, b2.dataset.nuevo, v)));
    $$("[data-rencat]", c).forEach((b2) => (b2.onclick = () => formCategoria(cat(b2.dataset.rencat), v)));
    $$("[data-borcat]", c).forEach((b2) => (b2.onclick = async () => {
      if (!(await confirmar("¿Eliminar categoría?", `Se eliminará <b>${esc(cat(b2.dataset.borcat).nombre)}</b> (no tiene ítems).`, { boton: "Eliminar", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "categoria", b2.dataset.borcat); aviso("Categoría eliminada"); repintar(v); } catch (e) { aviso(e.message, "error"); }
    }));
    $("[data-nuevacat]", c).onclick = () => formCategoria(null, v);
  }

  // ---------- Compra con un clic ----------
  function comprar(it, v) {
    const pa = pagado(it), sugerido = it.acordado ?? (pa || pres(it));
    const m = modal(`<h2>Marcar como comprado</h2>
      <p style="margin:0;color:var(--niebla)"><b>${esc(it.descripcion)}</b> · presupuesto ${soles(pres(it))}</p>
      <form class="form log-form">
        <label class="campo"><span>¿Cuánto costó en total? (S/)</span><input name="costo" inputmode="decimal" required value="${esc(Math.round(sugerido * 100) / 100)}" autofocus></label>
        <p class="ayuda" data-dif></p>
        ${pa > 0 ? `<p class="ayuda">Ya hay pagos registrados por ${soles(pa)}.</p>` : ""}
        <label class="check"><input type="checkbox" name="pago" ${pa > 0 ? "" : "checked"}><span>Registrar el pago ahora</span></label>
        <div class="log-grid" data-pago>
          <label class="campo"><span>Pagado con</span><select name="fondo_id"><option value="">Otro / tesorería del PMI</option>${L.fondos.map((fo) => `<option value="${fo.id}">${esc(fo.nombre)} (saldo ${soles(Number(fo.monto) - gastadoFondo(fo.id))})</option>`).join("")}</select></label>
          ${campoFecha("fecha", hoyISO(), "Fecha del pago")}
          <label class="campo"><span>N.° de boleta / factura</span><input name="comprobante" maxlength="120" placeholder="Opcional"></label>
          <label class="check"><input type="checkbox" name="a_nombre_pmi"><span>A nombre de PMI Lima</span></label>
          <label class="campo log-ancho"><span>Adjuntar comprobante (foto o PDF)</span><input type="file" name="archivos" accept="image/*,application/pdf" multiple></label>
        </div>
        <p class="error" aria-live="polite"></p>
        <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Marcar como comprado</button></div>
      </form>`, { ancho: true });
    const f = $("form", m.el);
    mascaraFechas(m.el);
    const dif = () => { const cst = num(f.costo.value); $("[data-dif]", m.el).innerHTML = cst == null ? "" : `Diferencia con el presupuesto: <b class="${cst - pres(it) > 0.005 ? "log-mal" : "log-bien"}">${firma(cst - pres(it))}</b>`; };
    f.costo.oninput = dif; dif();
    const ver = () => { $("[data-pago]", m.el).hidden = !f.pago.checked; }; f.pago.onchange = ver; ver();
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = $(".error", f), btn = $("button:not([type=button])", f);
      const cst = num(f.costo.value);
      if (cst == null || cst < 0) { err.textContent = "Escribe cuánto costó (puede ser 0)."; return; }
      btn.disabled = true;
      try {
        const fechas = f.pago.checked ? leerFechas(f, ["fecha"]) : {};
        const archivos = f.pago.checked ? await prepararArchivos(f.archivos.files) : [];
        await api.adminLogGuardar(ctx.codigo(), "item", { ...it, estado: "comprado", acordado: cst });
        if (f.pago.checked && cst - pa > 0.005) {
          const gid = await api.adminLogGuardar(ctx.codigo(), "gasto", { fecha: fechas.fecha, concepto: it.descripcion, item_id: it.id, monto: Math.round((cst - pa) * 100) / 100, moneda: "PEN",
            fondo_id: f.fondo_id.value, comprobante: f.comprobante.value, a_nombre_pmi: f.a_nombre_pmi.checked });
          for (const a of archivos) await api.adminLogArchivoSubir(ctx.codigo(), { gasto: gid, ...a });
        }
        m.cerrar(); aviso("¡Marcado como comprado!"); abiertas.add(it.categoria_id); repintar(v);
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
  }

  function formCategoria(ct, v) {
    const m = modal(`<h2>${ct ? "Renombrar categoría" : "Nueva categoría"}</h2><form class="form">
      <label class="campo"><span>Nombre</span><input name="nombre" maxlength="120" required value="${esc(ct?.nombre || "")}" placeholder="Ej. Decoración, Audio y video, Seguridad"></label>
      <p class="error"></p><div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("form", m.el).onsubmit = async (e) => {
      e.preventDefault();
      try {
        const id = await api.adminLogGuardar(ctx.codigo(), "categoria", { id: ct?.id, nombre: e.target.nombre.value, orden: ct?.orden });
        abiertas.add(id); m.cerrar(); aviso("Categoría guardada"); repintar(v);
      } catch (ex) { $(".error", m.el).textContent = ex.message; }
    };
  }

  // ---------- Archivos (comprobantes y cotizaciones) ----------
  async function prepararArchivos(files) {
    const r = [];
    for (const file of [...(files || [])]) {
      let blob = file, tipo = file.type || "application/octet-stream", nombre = file.name;
      if (/^image\//.test(tipo) && file.size > 700 * 1024) { blob = await reducirImagen(file); tipo = "image/jpeg"; nombre = nombre.replace(/\.[^.]+$/, "") + ".jpg"; }
      if (blob.size > MAX_ARCHIVO) throw new Error(`"${file.name}" pesa ${kb(blob.size)}. El máximo es 5 MB: comprime el archivo o toma una foto más liviana.`);
      r.push({ nombre, tipo, datos: await aBase64(blob) });
    }
    return r;
  }
  const aBase64 = (blob) => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(String(fr.result).split(",")[1] || ""); fr.onerror = () => rej(new Error("No se pudo leer el archivo")); fr.readAsDataURL(blob); });
  function reducirImagen(file) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const esc2 = Math.min(1, 1800 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
        cv.width = Math.round(img.width * esc2); cv.height = Math.round(img.height * esc2);
        cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
        cv.toBlob((b) => (b ? res(b) : rej(new Error("No se pudo comprimir la imagen"))), "image/jpeg", 0.82);
      };
      img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen")); };
      img.src = url;
    });
  }
  async function blobDe(a) {
    const r = await api.adminLogArchivo(ctx.codigo(), a.id);
    const bin = atob(r.datos), u = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i);
    return new Blob([u], { type: r.tipo || "application/octet-stream" });
  }
  async function descargar(a, ver = false) {
    try {
      const url = URL.createObjectURL(await blobDe(a));
      if (ver) window.open(url, "_blank", "noopener");
      else { const l = document.createElement("a"); l.href = url; l.download = a.nombre; document.body.append(l); l.click(); l.remove(); }
      setTimeout(() => URL.revokeObjectURL(url), 60000);
    } catch (e) { aviso(e.message, "error"); }
  }
  function cargarZip() {
    if (window.JSZip) return Promise.resolve(window.JSZip);
    return new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/jszip.min.js"; s.onload = () => res(window.JSZip); s.onerror = () => rej(new Error("No se pudo cargar el compresor ZIP")); document.head.append(s); });
  }
  async function descargarTodo(btn) {
    const lista = L.archivos.filter((a) => a.gasto_id || a.item_id);
    if (!lista.length) return aviso("Todavía no hay archivos adjuntos", "error");
    btn.disabled = true; const txt = btn.innerHTML;
    try {
      const JSZip = await cargarZip(), zip = new JSZip(), usados = new Set();
      for (const [n, a] of lista.entries()) {
        btn.textContent = `Preparando ${n + 1} de ${lista.length}…`;
        const g = L.gastos.find((x) => x.id === a.gasto_id), it = item(a.item_id || g?.item_id);
        const carpeta = a.gasto_id ? "Comprobantes de pago" : "Cotizaciones e ítems";
        const pref = [g?.fecha || "", (g?.concepto || it?.descripcion || "").slice(0, 40)].filter(Boolean).join("_");
        const limpio = (t) => t.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/ñ/gi, "n").replace(/[^\w.\- ]+/g, "-");
        let nombre = `${carpeta}/${pref ? `${limpio(pref)}_` : ""}${limpio(a.nombre)}`, k = 2;
        while (usados.has(nombre)) nombre = nombre.replace(/(\.[^.]+)?$/, `-${k++}$1`);
        usados.add(nombre); zip.file(nombre, await blobDe(a));
      }
      const blob = await zip.generateAsync({ type: "blob" }), url = URL.createObjectURL(blob), l = document.createElement("a");
      l.href = url; l.download = `CONCEPMI-VI-comprobantes-${hoyISO()}.zip`; document.body.append(l); l.click(); l.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000);
      aviso(`${lista.length} archivos descargados en un ZIP`);
    } catch (e) { aviso(e.message, "error"); }
    finally { btn.disabled = false; btn.innerHTML = txt; }
  }
  function bloqueAdjuntos(archivos) {
    return `<div class="log-adjuntos">${archivos.map((a) => `<div class="log-adjunto"><span>${/pdf/.test(a.tipo) ? "📄" : /image/.test(a.tipo) ? "🖼️" : "📎"} ${esc(a.nombre)} <small class="tenue">${kb(a.tamano)}</small></span>
        <button type="button" class="btn btn--mini" data-veradj="${a.id}">Ver</button><button type="button" class="btn btn--mini" data-bajadj="${a.id}" title="Descargar" aria-label="Descargar">${I.descargar}</button>
        <button type="button" class="btn btn--mini btn--icono btn--peligro" data-boradj="${a.id}" title="Quitar archivo" aria-label="Quitar archivo">${I.basura}</button></div>`).join("") || `<p class="ayuda" style="margin:0">Sin archivos adjuntos.</p>`}</div>
      <label class="campo"><span>Adjuntar archivos (fotos o PDF, máx. 5 MB c/u)</span><input type="file" name="archivos" accept="image/*,application/pdf" multiple></label>`;
  }
  function conectarAdjuntos(raiz, alCambiar) {
    const a = (id) => L.archivos.find((x) => x.id === id);
    $$("[data-veradj]", raiz).forEach((b) => (b.onclick = () => descargar(a(b.dataset.veradj), true)));
    $$("[data-bajadj]", raiz).forEach((b) => (b.onclick = () => descargar(a(b.dataset.bajadj))));
    $$("[data-boradj]", raiz).forEach((b) => (b.onclick = async () => {
      if (!(await confirmar("¿Quitar este archivo?", `Se eliminará <b>${esc(a(b.dataset.boradj).nombre)}</b>.`, { boton: "Quitar", peligro: true }))) return;
      try { await api.adminLogArchivoBorrar(ctx.codigo(), b.dataset.boradj); await cargar(); aviso("Archivo eliminado"); alCambiar(); } catch (e) { aviso(e.message, "error"); }
    }));
  }

  // ---------- Detalle de un ítem ----------
  function formItem(it, categoriaId, v) {
    const n = !it;
    it ||= { categoria_id: categoriaId, tipo: "CV", cantidad: 1, cu: 0, estado: "pendiente" };
    const pagos = it.id ? gastosDe(it.id) : [];
    const opProv = (sel) => `<option value="">— Sin proveedor —</option>${L.proveedores.map((p) => `<option value="${p.id}" ${p.id === sel ? "selected" : ""}>${esc(p.nombre)}${p.rubro ? ` · ${esc(p.rubro)}` : ""}</option>`).join("")}`;
    const m = modal(`
      <h2>${n ? "Nuevo ítem" : esc(it.descripcion)}</h2>
      <form class="form log-form">
        <fieldset><legend>1. Presupuesto</legend>
          <div class="log-grid">
            <label class="campo log-ancho"><span>Descripción</span><input name="descripcion" maxlength="300" required value="${esc(it.descripcion || "")}" placeholder="Ej. Medallas oro 1er puesto"></label>
            <label class="campo log-ancho"><span>¿Para qué es? (proyecto / evento)</span><input name="para" maxlength="300" value="${esc(it.para || "")}" placeholder="Ej. Concurso de Proyectos"></label>
            <label class="campo"><span>Categoría</span><select name="categoria_id">${cats().map((c) => `<option value="${c.id}" ${c.id === it.categoria_id ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select></label>
            <label class="campo"><span>Tipo de costo</span><select name="tipo"><option value="CV" ${it.tipo === "CV" ? "selected" : ""}>CV · Variable</option><option value="CF" ${it.tipo === "CF" ? "selected" : ""}>CF · Fijo</option></select></label>
            <label class="campo"><span>Cantidad</span><input name="cantidad" inputmode="decimal" value="${esc(it.cantidad)}"></label>
            <label class="campo"><span>Costo unitario presupuestado (S/)</span><input name="cu" inputmode="decimal" value="${esc(it.cu)}"></label>
          </div>
          <p class="ayuda">Presupuesto del ítem: <b data-totpres>${soles(pres(it))}</b>${it.pres_original != null && cambio(it) ? ` · aprobado originalmente: ${soles(it.pres_original)}` : ""}</p>
        </fieldset>
        <fieldset><legend>2. Compra</legend>
          <div class="log-estados" role="radiogroup" aria-label="Estado">${ESTADOS_FORM.map((k) => `<label class="log-estado"><input type="radio" name="estado" value="${k}" ${(it.estado === "aprobado" ? "pendiente" : it.estado) === k ? "checked" : ""}><span>${ESTADOS[k][0]}</span></label>`).join("")}</div>
          <div class="log-grid">
            <label class="campo"><span>Costo real total (S/)</span><input name="acordado" inputmode="decimal" value="${esc(it.acordado ?? "")}" placeholder="Lo que realmente cuesta"></label>
            <label class="campo"><span>Proveedor</span><div style="display:flex;gap:8px"><select name="proveedor_id" style="flex:1">${opProv(it.proveedor_id)}</select><button type="button" class="btn btn--mini" data-nuevoprov title="Nuevo proveedor" aria-label="Nuevo proveedor">${I.mas}</button></div></label>
            <label class="campo"><span>Medio de pago</span><input name="medio_pago" maxlength="120" list="medios" value="${esc(it.medio_pago || "")}" placeholder="Yape, transferencia…"></label>
            <label class="campo"><span>Responsable</span><input name="responsable" maxlength="120" value="${esc(it.responsable || "")}" placeholder="Quién lo gestiona"></label>
          </div>
          <datalist id="medios"><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option></datalist>
        </fieldset>
        <fieldset><legend>3. Adelanto y entrega</legend>
          <div class="log-grid">
            <label class="check log-ancho"><input type="checkbox" name="adelanto" ${it.adelanto ? "checked" : ""}><span>El proveedor pide adelanto</span></label>
            <label class="campo"><span>Monto del adelanto (S/)</span><input name="adelanto_monto" inputmode="decimal" value="${esc(it.adelanto_monto ?? "")}"></label>
            ${campoFecha("adelanto_fecha", it.adelanto_fecha, "Pagar adelanto hasta")}
            ${campoFecha("entrega_fecha", it.entrega_fecha, "Fecha de entrega")}
            <label class="campo"><span>Lugar de entrega / recojo</span><input name="entrega_lugar" maxlength="300" value="${esc(it.entrega_lugar || "")}" placeholder="Ej. Delivery a la UNMSM"></label>
          </div>
        </fieldset>
        <fieldset><legend>4. Cotizaciones, documentos y notas</legend>
          ${n ? `<p class="ayuda" style="margin:0">Guarda el ítem para poder adjuntar cotizaciones.</p>` : bloqueAdjuntos(archivosDe("item_id", it.id))}
          <label class="campo"><span>Enlace (Drive u otro)</span><input name="enlace" maxlength="1000" value="${esc(it.enlace || "")}" placeholder="https://drive.google.com/…"></label>
          ${it.enlace ? `<p class="ayuda"><a href="${esc(it.enlace)}" target="_blank" rel="noopener">Abrir enlace ↗</a></p>` : ""}
          <label class="campo"><span>Notas</span><textarea name="notas" maxlength="2000" placeholder="Condiciones, garantía, lo que se acordó…">${esc(it.notas || "")}</textarea></label>
        </fieldset>
        ${n ? "" : `<fieldset><legend>5. Pagos registrados</legend>
          ${pagos.length ? `<table class="tabla-mini"><tbody>${pagos.map((g) => `<tr><td>${fecha(g.fecha)}</td><td>${esc(g.concepto)}${archivosDe("gasto_id", g.id).length ? ` 📎${archivosDe("gasto_id", g.id).length}` : ""}</td><td>${esc(fondo(g.fondo_id)?.nombre || "Otro / tesorería")}</td><td class="num"><b>${soles(g.monto_pen)}</b></td></tr>`).join("")}</tbody></table>
            <p class="ayuda">Total pagado: <b>${soles(pagado(it))}</b>${real(it) != null ? ` · Por pagar: <b>${soles(Math.max(0, real(it) - pagado(it)))}</b>` : ""}</p>` : `<p class="ayuda">Aún no hay pagos para este ítem.</p>`}
          <button type="button" class="btn btn--mini" data-pago>${I.mas}Registrar pago</button></fieldset>`}
        <p class="error" aria-live="polite"></p>
        <div class="modal__acciones" style="margin-top:0">
          ${n ? "" : `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Eliminar</button>`}
          <button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div>
      </form>`, { ancho: true });
    const f = $("form", m.el);
    mascaraFechas(m.el);
    const totPres = () => { $("[data-totpres]", m.el).textContent = soles((num(f.cantidad.value) || 0) * (num(f.cu.value) || 0)); };
    f.cantidad.oninput = totPres; f.cu.oninput = totPres;
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    const datos = () => ({ id: it.id, categoria_id: f.categoria_id.value, descripcion: f.descripcion.value, para: f.para.value, tipo: f.tipo.value,
      cantidad: num(f.cantidad.value) ?? 1, cu: num(f.cu.value) ?? 0, acordado: num(f.acordado.value), estado: f.estado.value, proveedor_id: f.proveedor_id.value,
      medio_pago: f.medio_pago.value, responsable: f.responsable.value, adelanto: f.adelanto.checked, adelanto_monto: num(f.adelanto_monto.value),
      ...leerFechas(f, ["adelanto_fecha", "entrega_fecha"]), entrega_lugar: f.entrega_lugar.value, enlace: f.enlace.value, notas: f.notas.value, orden: it.orden });
    async function guardar() {
      const d = datos();
      const archivos = f.archivos?.files.length ? await prepararArchivos(f.archivos.files) : [];
      const id = await api.adminLogGuardar(ctx.codigo(), "item", d);
      for (const a of archivos) await api.adminLogArchivoSubir(ctx.codigo(), { item: id, ...a });
      abiertas.add(f.categoria_id.value);
      return id;
    }
    if (!n) conectarAdjuntos(m.el, () => { m.cerrar(); formItem(item(it.id), null, v); });
    $("[data-nuevoprov]", m.el).onclick = () => formProveedor(null, null, async (p) => { await cargar(); f.proveedor_id.innerHTML = opProv(p); });
    $("[data-pago]", m.el)?.addEventListener("click", async () => {
      try { await guardar(); await cargar(); m.cerrar(); formGasto(null, { item_id: it.id }, v, () => formItem(item(it.id), null, v)); }
      catch (ex) { $(".error", m.el).textContent = ex.message; }
    });
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar este ítem?", `Se eliminará <b>${esc(it.descripcion)}</b> del presupuesto y quedará registrado en el historial de cambios. Sus pagos se conservan en Gastos.<br><br>Si solo ya no se va a comprar, también puedes marcarlo como <b>Cancelado</b>.`, { boton: "Eliminar ítem", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "item", it.id); m.cerrar(); aviso("Ítem eliminado"); repintar(v); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button:not([type=button])", f); btn.disabled = true;
      try { await guardar(); m.cerrar(); aviso("Ítem guardado"); repintar(v); }
      catch (ex) { $(".error", m.el).textContent = ex.message; btn.disabled = false; }
    };
  }

  // ---------- Gastos y comprobantes ----------
  function gastos(c, v) {
    const total = L.gastos.reduce((s, g) => s + Number(g.monto_pen), 0);
    const sinComp = L.gastos.filter((g) => !archivosDe("gasto_id", g.id).length).length;
    c.innerHTML = `
      <h2 class="seccion-titulo" style="margin-top:0">Fondos entregados (a rendir)</h2>
      <p class="ayuda" style="margin-top:-6px">Dinero que se le dio a una persona para gastos del evento. Cada gasto pagado con ese dinero se descuenta del saldo.</p>
      <div class="log-fondos">${L.fondos.map((fo) => {
        const g = gastadoFondo(fo.id), s = Number(fo.monto) - g, pct = fo.monto > 0 ? Math.min(100, (g / fo.monto) * 100) : 0;
        return `<article class="tarjeta log-fondo">
          <div class="log-fondo__cab"><div><h3>${esc(fo.nombre)}</h3><p>${esc(fo.responsable)}${fo.fecha ? ` · entregado el ${fecha(fo.fecha)}` : ""}</p></div>
            <button class="btn btn--mini btn--icono" data-edfondo="${fo.id}" title="Editar fondo" aria-label="Editar fondo">${I.lapiz}</button></div>
          <div class="log-fondo__nums"><span><small>Entregado</small><b>${soles(fo.monto)}</b></span><span><small>Gastado</small><b>${soles(g)}</b></span>
            <span><small>Saldo</small><b class="${s < 0 ? "log-mal" : "log-bien"}">${soles(s)}</b></span></div>
          <div class="progreso"><i style="width:${pct}%"></i></div>
          ${fo.notas ? `<p class="ayuda">${esc(fo.notas)}</p>` : ""}
          <button class="btn btn--mini btn--naranja" data-gastofondo="${fo.id}">${I.mas}Registrar gasto de este fondo</button>
        </article>`; }).join("") || `<div class="vacio"><b>No hay fondos registrados</b></div>`}</div>
      <button class="btn btn--mini" data-nuevofondo style="margin-top:10px">${I.mas}Nuevo fondo</button>
      <div class="cabeza"><div><h1 style="font-size:1.5rem">Todos los gastos</h1><p>${L.gastos.length} gasto${L.gastos.length === 1 ? "" : "s"} · total ${soles(total)} · ${L.archivos.length} archivo${L.archivos.length === 1 ? "" : "s"} adjunto${L.archivos.length === 1 ? "" : "s"}${sinComp ? ` · <b class="log-mal">${sinComp} sin comprobante</b>` : ""}</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-zip ${L.archivos.length ? "" : "disabled"}>${I.descargar}Descargar todos los comprobantes (ZIP)</button>
          <button class="btn btn--naranja" data-nuevogasto>${I.mas}Registrar gasto</button></div></div>
      ${L.gastos.length ? `<div class="tabla-envoltura"><table class="tabla log-tabla"><thead><tr><th>Fecha</th><th>Concepto</th><th>Ítem del presupuesto</th><th>Pagado con</th><th class="num">Monto</th><th>Comprobante</th></tr></thead>
        <tbody>${L.gastos.map((g) => { const it = item(g.item_id), adj = archivosDe("gasto_id", g.id);
          return `<tr class="log-fila" data-gasto="${g.id}" tabindex="0"><td style="white-space:nowrap">${fecha(g.fecha)}</td><td><b>${esc(g.concepto)}</b>${g.notas ? `<br><small class="tenue">${esc(g.notas)}</small>` : ""}</td>
            <td>${it ? `${esc(it.descripcion)}<br><small class="tenue">${esc(cat(it.categoria_id)?.nombre || "")}</small>` : `<span class="tenue">Sin ítem</span>`}</td>
            <td>${esc(fondo(g.fondo_id)?.nombre || "Otro / tesorería")}</td>
            <td class="num"><b>${soles(g.monto_pen)}</b>${g.moneda === "USD" ? `<br><small class="tenue">USD ${Number(g.monto).toFixed(2)} × ${g.tc}</small>` : ""}</td>
            <td>${g.comprobante ? `${esc(g.comprobante)}<br>` : ""}${adj.map((a) => `<button class="btn btn--mini log-adjbtn" data-bajadj="${a.id}" title="Descargar ${esc(a.nombre)}">📎 ${esc(a.nombre.length > 18 ? `${a.nombre.slice(0, 16)}…` : a.nombre)}</button>`).join(" ") || `<span class="chip chip--ambar log-tag">Falta adjuntar</span>`}
              ${g.a_nombre_pmi ? `<br><small class="chip chip--verde log-tag">a nombre de PMI Lima</small>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="vacio"><b>Aún no hay gastos</b>Registra el primero con el botón de arriba.</div>`}
      <p class="ayuda" style="margin-top:12px">📁 Los comprobantes se guardan en la base de datos del panel (Supabase), protegidos con tu código de admin. Te recomendamos descargar el ZIP cada cierto tiempo y guardarlo también en el Drive del proyecto.</p>`;
    $$("[data-edfondo]", c).forEach((b) => (b.onclick = () => formFondo(fondo(b.dataset.edfondo), v)));
    $$("[data-gastofondo]", c).forEach((b) => (b.onclick = () => formGasto(null, { fondo_id: b.dataset.gastofondo }, v)));
    $("[data-nuevofondo]", c).onclick = () => formFondo(null, v);
    $("[data-nuevogasto]", c).onclick = () => formGasto(null, {}, v);
    $("[data-zip]", c).onclick = (e) => descargarTodo(e.currentTarget);
    $$("[data-bajadj]", c).forEach((b) => (b.onclick = (e) => { e.stopPropagation(); descargar(L.archivos.find((a) => a.id === b.dataset.bajadj)); }));
    $$("[data-gasto]", c).forEach((r) => { r.onclick = () => formGasto(L.gastos.find((g) => g.id === r.dataset.gasto), {}, v); r.onkeydown = (e) => { if (e.key === "Enter") r.click(); }; });
  }

  function formGasto(g, pre, v, despues) {
    const n = !g;
    g ||= { fecha: hoyISO(), moneda: "PEN", tc: L.config.tc, ...pre };
    const opItems = cats().map((ct) => `<optgroup label="${esc(ct.nombre)}">${itemsDe(ct.id).map((i) => `<option value="${i.id}" ${i.id === g.item_id ? "selected" : ""}>${esc(i.descripcion)}</option>`).join("")}</optgroup>`).join("");
    const m = modal(`<h2>${n ? "Registrar gasto" : "Editar gasto"}</h2>
      <form class="form log-form"><div class="log-grid">
        ${campoFecha("fecha", g.fecha, "Fecha")}
        <label class="campo"><span>Concepto</span><input name="concepto" maxlength="300" required value="${esc(g.concepto || "")}" placeholder="Ej. Copias e impresiones"></label>
        <label class="campo log-ancho"><span>Ítem del presupuesto</span><select name="item_id"><option value="">— Sin ítem (gasto no presupuestado) —</option>${opItems}</select></label>
        <label class="campo"><span>Monto</span><input name="monto" inputmode="decimal" required value="${esc(g.monto ?? "")}"></label>
        <label class="campo"><span>Moneda</span><select name="moneda"><option value="PEN" ${g.moneda === "PEN" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${g.moneda === "USD" ? "selected" : ""}>Dólares (USD)</option></select></label>
        <label class="campo" data-tcbox><span>Tipo de cambio</span><input name="tc" inputmode="decimal" value="${esc(g.tc ?? L.config.tc)}"></label>
        <label class="campo"><span>Pagado con</span><select name="fondo_id"><option value="">Otro / tesorería del PMI</option>${L.fondos.map((fo) => `<option value="${fo.id}" ${fo.id === g.fondo_id ? "selected" : ""}>${esc(fo.nombre)}</option>`).join("")}</select></label>
      </div>
      <fieldset><legend>Comprobante</legend>
        <div class="log-grid">
          <label class="campo"><span>N.° de boleta / factura</span><input name="comprobante" maxlength="120" value="${esc(g.comprobante || "")}" placeholder="Ej. B001-2345"></label>
          <label class="check"><input type="checkbox" name="a_nombre_pmi" ${g.a_nombre_pmi ? "checked" : ""}><span>A nombre de PMI Lima, Perú</span></label>
        </div>
        ${bloqueAdjuntos(n ? [] : archivosDe("gasto_id", g.id))}
      </fieldset>
      <label class="campo"><span>Notas</span><textarea name="notas" maxlength="2000">${esc(g.notas || "")}</textarea></label>
      <p class="ayuda" data-equiv></p>
      <p class="error" aria-live="polite"></p>
      <div class="modal__acciones" style="margin-top:0">${n ? "" : `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Eliminar</button>`}
        <button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar gasto</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    mascaraFechas(m.el);
    const eq = () => {
      const usd = f.moneda.value === "USD"; $("[data-tcbox]", m.el).hidden = !usd;
      const mo = num(f.monto.value) || 0, tc = num(f.tc.value) || 0;
      $("[data-equiv]", m.el).textContent = usd && mo ? `Equivale a ${soles(Math.round(mo * tc * 100) / 100)}` : "";
    };
    f.moneda.onchange = eq; f.monto.oninput = eq; f.tc.oninput = eq; eq();
    if (!n) conectarAdjuntos(m.el, () => { m.cerrar(); vista(v); formGasto(L.gastos.find((x) => x.id === g.id), {}, v, despues); });
    $("[data-cancelar]", m.el).onclick = () => { m.cerrar(); despues?.(); };
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar este gasto?", `Se eliminará <b>${esc(g.concepto)}</b> (${soles(g.monto_pen)}) y sus archivos adjuntos.`, { boton: "Eliminar gasto", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "gasto", g.id); m.cerrar(); aviso("Gasto eliminado"); await repintar(v); despues?.(); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button:not([type=button])", f); btn.disabled = true;
      try {
        const fechas = leerFechas(f, ["fecha"]);
        const archivos = await prepararArchivos(f.archivos.files);
        const gid = await api.adminLogGuardar(ctx.codigo(), "gasto", { id: g.id, ...fechas, concepto: f.concepto.value, item_id: f.item_id.value, monto: num(f.monto.value),
          moneda: f.moneda.value, tc: f.moneda.value === "USD" ? num(f.tc.value) : null, fondo_id: f.fondo_id.value, comprobante: f.comprobante.value,
          a_nombre_pmi: f.a_nombre_pmi.checked, notas: f.notas.value });
        for (const a of archivos) await api.adminLogArchivoSubir(ctx.codigo(), { gasto: gid, ...a });
        // Si se paga un ítem pendiente, queda como comprado
        const it = item(f.item_id.value);
        if (n && it && ["pendiente", "cotizando", "aprobado"].includes(it.estado)) await api.adminLogGuardar(ctx.codigo(), "item", { ...it, estado: "comprado" });
        m.cerrar(); aviso("Gasto guardado"); await repintar(v); despues?.();
      } catch (ex) { $(".error", m.el).textContent = ex.message; btn.disabled = false; }
    };
  }

  function formFondo(fo, v) {
    const n = !fo; fo ||= {};
    const m = modal(`<h2>${n ? "Nuevo fondo" : "Editar fondo"}</h2><form class="form"><div class="log-grid">
      <label class="campo log-ancho"><span>Nombre</span><input name="nombre" maxlength="160" required value="${esc(fo.nombre || "")}" placeholder="Ej. Fondo de transporte y marketing"></label>
      <label class="campo"><span>Responsable / a quién se entregó</span><input name="responsable" maxlength="160" value="${esc(fo.responsable || "")}"></label>
      <label class="campo"><span>Monto entregado (S/)</span><input name="monto" inputmode="decimal" value="${esc(fo.monto ?? "")}"></label>
      ${campoFecha("fecha", fo.fecha, "Fecha de entrega")}
      <label class="campo log-ancho"><span>Notas</span><textarea name="notas" maxlength="2000">${esc(fo.notas || "")}</textarea></label></div>
      <p class="error"></p><div class="modal__acciones" style="margin-top:0">${n ? "" : `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Eliminar</button>`}
        <button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    mascaraFechas(m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar este fondo?", "Sus gastos se conservan, pero quedarán como “Otro / tesorería”.", { boton: "Eliminar fondo", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "fondo", fo.id); m.cerrar(); aviso("Fondo eliminado"); repintar(v); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api.adminLogGuardar(ctx.codigo(), "fondo", { id: fo.id, nombre: f.nombre.value, responsable: f.responsable.value, monto: num(f.monto.value) ?? 0, ...leerFechas(f, ["fecha"]), notas: f.notas.value }); m.cerrar(); aviso("Fondo guardado"); repintar(v); }
      catch (ex) { $(".error", m.el).textContent = ex.message; }
    };
  }

  // ---------- Proveedores ----------
  function proveedores(c, v) {
    c.innerHTML = `
      <div class="log-barra"><p class="ayuda" style="margin:0;flex:1">Directorio de contactos. Asigna el proveedor a cada ítem desde su detalle.</p><button class="btn btn--naranja" data-nuevoprov>${I.mas}Nuevo proveedor</button></div>
      <div class="jurados">${L.proveedores.map((p) => {
        const its = L.items.filter((i) => i.proveedor_id === p.id), t = totales(its);
        return `<article class="jurado">
          <div class="jurado__cab"><span class="avatar">${esc(p.nombre.slice(0, 2).toUpperCase())}</span><div><h4>${esc(p.nombre)}</h4><p>${esc(p.rubro || "Sin rubro")}${p.ruc ? ` · RUC ${esc(p.ruc)}` : ""}</p></div></div>
          <div class="log-contacto">
            ${p.contacto ? `<span>${I.personas}${esc(p.contacto)}</span>` : ""}
            ${p.telefono ? `<span>📞 <a href="tel:${esc(telLimpio(p.telefono))}">${esc(p.telefono)}</a> · <a href="${esc(whatsapp(p.telefono))}" target="_blank" rel="noopener">WhatsApp ↗</a></span>` : ""}
            ${p.email ? `<span>✉️ <a href="mailto:${esc(p.email)}">${esc(p.email)}</a></span>` : ""}
            ${p.direccion ? `<span>📍 <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(p.direccion)}" target="_blank" rel="noopener">${esc(p.direccion)}</a></span>` : ""}
            ${p.web ? `<span>🔗 <a href="${esc(/^https?:/.test(p.web) ? p.web : `https://${p.web}`)}" target="_blank" rel="noopener">${esc(p.web)}</a></span>` : ""}
          </div>
          ${p.notas ? `<p>${esc(p.notas)}</p>` : ""}
          <div class="jurado__chips">${its.map((i) => `<span class="chip">${esc(i.descripcion)}</span>`).join("") || `<span class="tenue" style="font-size:.85rem">Sin ítems asignados</span>`}</div>
          ${its.length ? `<p class="ayuda" style="margin:0">Presupuesto ${soles(t.pres)} · Real ${soles(t.real)} · Pagado ${soles(t.pagado)}</p>` : ""}
          <div class="jurado__acc"><button class="btn btn--mini" data-edprov="${p.id}">${I.lapiz}Editar</button></div>
        </article>`; }).join("") || `<div class="vacio"><b>Aún no hay proveedores</b>Agrega el primero con el botón de arriba.</div>`}</div>`;
    $("[data-nuevoprov]", c).onclick = () => formProveedor(null, v);
    $$("[data-edprov]", c).forEach((b) => (b.onclick = () => formProveedor(prov(b.dataset.edprov), v)));
  }

  function formProveedor(p, v, alGuardar) {
    const n = !p; p ||= {};
    const campo = (k, t, ph = "", ancho = false) => `<label class="campo ${ancho ? "log-ancho" : ""}"><span>${t}</span><input name="${k}" value="${esc(p[k] || "")}" placeholder="${esc(ph)}"></label>`;
    const m = modal(`<h2>${n ? "Nuevo proveedor" : "Editar proveedor"}</h2><form class="form"><div class="log-grid">
      ${campo("nombre", "Nombre o razón social", "Ej. Imprenta Gráfica Lima SAC", true)}
      ${campo("rubro", "Rubro", "Ej. Impresiones, catering, merch")}${campo("ruc", "RUC", "20XXXXXXXXX")}
      ${campo("contacto", "Persona de contacto")}${campo("telefono", "Teléfono / WhatsApp", "987 654 321")}
      ${campo("email", "Correo")}${campo("web", "Web o red social")}
      ${campo("direccion", "Dirección", "Av. …, distrito", true)}
      <label class="campo log-ancho"><span>Notas</span><textarea name="notas" maxlength="2000" placeholder="Horario, condiciones, si da factura, tiempos de entrega…">${esc(p.notas || "")}</textarea></label></div>
      <p class="error"></p><div class="modal__acciones" style="margin-top:0">${n ? "" : `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Eliminar</button>`}
        <button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar este proveedor?", "Los ítems que lo tenían asignado quedarán sin proveedor.", { boton: "Eliminar", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "proveedor", p.id); m.cerrar(); aviso("Proveedor eliminado"); repintar(v); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(["nombre", "rubro", "ruc", "contacto", "telefono", "email", "web", "direccion", "notas"].map((k) => [k, f[k].value]));
      try {
        const id = await api.adminLogGuardar(ctx.codigo(), "proveedor", { id: p.id, ...d });
        m.cerrar(); aviso("Proveedor guardado");
        if (alGuardar) await alGuardar(id); else repintar(v);
      } catch (ex) { $(".error", m.el).textContent = ex.message; }
    };
  }

  // ---------- Historial ----------
  function historial(c) {
    const T = totales(L.items), b = base();
    c.innerHTML = `
      ${b != null ? `<div class="log-comp" style="margin-bottom:14px"><span><small>Presupuesto aprobado (subtotal)</small><b>${soles(b)}</b></span><span><small>Presupuesto actual (subtotal)</small><b>${soles(T.pres)}</b></span>
        <span><small>Diferencia acumulada</small><b class="${T.pres - b > 0 ? "log-mal" : "log-bien"}">${firma(T.pres - b)}</b></span></div>` : ""}
      ${L.historial.length ? `<div class="tabla-envoltura"><table class="tabla log-tabla"><thead><tr><th>Fecha</th><th>Cambio</th><th>Categoría</th><th>Ítem</th><th class="num">Antes</th><th class="num">Después</th><th class="num">Efecto</th><th>Detalle</th></tr></thead>
        <tbody>${L.historial.map((h) => `<tr><td style="white-space:nowrap">${fechaHora(h.fecha)}</td><td><span class="chip ${ACCION[h.accion]?.[1] || ""} log-tag">${ACCION[h.accion]?.[0] || esc(h.accion)}</span></td>
          <td>${esc(h.categoria)}</td><td>${esc(h.descripcion)}</td><td class="num">${h.antes == null ? "—" : soles(h.antes)}</td><td class="num">${h.despues == null ? "—" : soles(h.despues)}</td>
          <td class="num ${((h.despues ?? 0) - (h.antes ?? 0)) > 0 ? "log-mal" : "log-bien"}">${h.antes == null && h.despues == null ? "" : firma((h.despues ?? 0) - (h.antes ?? 0))}</td><td><small class="tenue">${esc(h.detalle)}</small></td></tr>`).join("")}</tbody></table></div>`
      : `<div class="vacio"><b>Sin cambios registrados</b>Cada vez que agregues, modifiques o elimines un ítem del presupuesto quedará anotado aquí.</div>`}`;
  }

  function ajustes(v) {
    const m = modal(`<h2>Ajustes de logística</h2><form class="form">
      <label class="campo"><span>Tipo de cambio USD → S/</span><input name="tc" inputmode="decimal" value="${esc(L.config.tc)}"></label>
      <label class="campo"><span>Contingencia (%)</span><input name="cont" inputmode="decimal" value="${esc(Math.round(Number(L.config.contingencia) * 1000) / 10)}"></label>
      <p class="ayuda">El tipo de cambio se propone al registrar gastos en dólares. La contingencia se suma al subtotal del presupuesto.</p>
      <p class="error"></p><div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("form", m.el).onsubmit = async (e) => {
      e.preventDefault();
      try { await api.adminLogConfig(ctx.codigo(), num(e.target.tc.value), (num(e.target.cont.value) ?? 0) / 100); m.cerrar(); aviso("Ajustes guardados"); repintar(v); }
      catch (ex) { $(".error", m.el).textContent = ex.message; }
    };
  }

  // ---------- Reporte para gerencia (página aparte, lista para imprimir o guardar en PDF) ----------
  function reporte() {
    const T = totales(L.items), k = cont(), b = base();
    const activos = L.items.filter((i) => i.estado !== "cancelado"), avance = activos.length ? Math.round((T.comprados / activos.length) * 100) : 0;
    const filas = cats().map((ct) => ({ ct, t: totales(itemsDe(ct.id)) })), maxV = Math.max(1, ...filas.map((f) => f.t.pres + Math.max(0, f.t.dif)));
    const eliminados = L.historial.filter((h) => h.accion === "eliminado");
    const faltan = activos.filter((i) => !COMPRADO.includes(i.estado)).sort((a, b2) => pres(b2) - pres(a)).slice(0, 10);
    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Reporte de logística · VI CONCEPMI 2026</title>
      <style>body{font-family:Poppins,Segoe UI,Arial,sans-serif;color:#1d1b29;background:#fff;margin:28px;font-size:12.5px}h1{margin:0;font-size:22px}h2{font-size:15px;margin:22px 0 8px;border-bottom:2px solid #6E2BE6;padding-bottom:4px}
      .sub{color:#555;margin:2px 0 16px}.kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:10px}.kpi{border:1px solid #ddd;border-radius:10px;padding:10px}.kpi b{display:block;font-size:17px}.kpi span{color:#555;font-size:11px}
      .tabla{overflow-x:auto}table{width:100%;border-collapse:collapse}td,th{padding:5px 6px;border-bottom:1px solid #e5e5e5;text-align:left}th{background:#f4f2fb}.n{text-align:right;white-space:nowrap}.mal{color:#c22}.bien{color:#0a7a0a}
      .pista{position:relative;height:12px;background:#ecebf3;border-radius:4px;overflow:hidden;min-width:120px}.pista i{position:absolute;top:0;bottom:0;left:0;border-radius:4px}.p{background:#c9c6d9}.r{background:#2a78d6}.e{background:#d03b3b}
      .ley span{margin-right:14px}.ley i{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:4px;vertical-align:-1px}@media print{body{margin:12mm}.noimp{display:none}}</style></head><body>
      <button class="noimp" onclick="print()" style="float:right;padding:8px 14px;border-radius:8px;border:0;background:#FF6A1F;color:#fff;font-weight:700;cursor:pointer">Imprimir / Guardar PDF</button>
      <h1>Reporte de logística · VI CONCEPMI 2026</h1><p class="sub">PMI Lima Perú Chapter Student Club · generado el ${fechaHora(new Date())}</p>
      <div class="kpis"><div class="kpi"><b>${soles(T.pres * (1 + k))}</b><span>Presupuesto actual (con ${Math.round(k * 100)} % contingencia)</span></div>
        <div class="kpi"><b>${b == null ? "—" : soles(b * (1 + k))}</b><span>Presupuesto aprobado original</span></div>
        <div class="kpi"><b>${soles(T.real)}</b><span>Costo real registrado</span></div><div class="kpi"><b>${soles(T.pagado)}</b><span>Pagado · ${soles(T.porPagar)} por pagar</span></div>
        <div class="kpi"><b>${avance} %</b><span>Compras hechas (${T.comprados} de ${activos.length})</span></div></div>
      <h2>Presupuesto vs real por categoría</h2><p class="ley"><span><i class="p"></i>Presupuesto</span><span><i class="r"></i>Real</span><span><i class="e"></i>Excedido</span></p>
      <div class="tabla"><table><thead><tr><th>Categoría</th><th class="n">Presupuesto</th><th class="n">Real</th><th class="n">Diferencia</th><th>Comprados</th><th></th></tr></thead><tbody>
      ${filas.map(({ ct, t }) => `<tr><td>${esc(ct.nombre)}</td><td class="n">${soles(t.pres)}</td><td class="n">${t.real ? soles(t.real) : "—"}</td><td class="n ${t.dif > 0.005 ? "mal" : "bien"}">${t.real ? firma(t.dif) : "—"}</td>
        <td>${t.comprados}/${t.n - t.cancelados}</td><td><div class="pista"><i class="p" style="width:${(t.pres / maxV) * 100}%"></i><i class="r" style="width:${(Math.min(t.real - Math.max(0, t.dif), t.pres) / maxV) * 100}%"></i>${t.dif > 0.005 ? `<i class="e" style="left:${(t.pres / maxV) * 100}%;width:${(t.dif / maxV) * 100}%"></i>` : ""}</div></td></tr>`).join("")}
      <tr><th>Subtotal</th><th class="n">${soles(T.pres)}</th><th class="n">${soles(T.real)}</th><th class="n">${firma(T.dif)}</th><th></th><th></th></tr>
      <tr><td>Contingencia ${Math.round(k * 100)} %</td><td class="n">${soles(T.pres * k)}</td><td></td><td></td><td></td><td></td></tr>
      <tr><th>TOTAL</th><th class="n">${soles(T.pres * (1 + k))}</th><th class="n">${soles(T.real)}</th><th></th><th></th><th></th></tr></tbody></table></div>
      ${b != null ? `<h2>Cambios frente al presupuesto aprobado</h2><p>Subtotal aprobado ${soles(b)} → actual ${soles(T.pres)} (<b class="${T.pres - b > 0 ? "mal" : "bien"}">${firma(T.pres - b)}</b>).</p>
        ${eliminados.length ? `<div class="tabla"><table><thead><tr><th>Eliminado</th><th>Categoría</th><th class="n">Monto</th><th>Fecha</th></tr></thead><tbody>${eliminados.map((h) => `<tr><td>${esc(h.descripcion)}</td><td>${esc(h.categoria)}</td><td class="n bien">${firma(-(h.antes ?? 0))}</td><td>${fechaHora(h.fecha)}</td></tr>`).join("")}</tbody></table></div>` : ""}` : ""}
      <h2>Lo que falta comprar (mayor monto)</h2>${faltan.length ? `<div class="tabla"><table><thead><tr><th>Ítem</th><th>Categoría</th><th class="n">Presupuesto</th><th>Entrega</th></tr></thead><tbody>${faltan.map((i) => `<tr><td>${esc(i.descripcion)}</td><td>${esc(cat(i.categoria_id)?.nombre || "")}</td><td class="n">${soles(pres(i))}</td><td>${i.entrega_fecha ? fecha(i.entrega_fecha) : "—"}</td></tr>`).join("")}</tbody></table></div>` : "<p>Todo comprado.</p>"}
      <h2>Fondos a rendir</h2><div class="tabla"><table><thead><tr><th>Fondo</th><th>Responsable</th><th class="n">Entregado</th><th class="n">Gastado</th><th class="n">Saldo</th></tr></thead><tbody>${L.fondos.map((fo) => `<tr><td>${esc(fo.nombre)}</td><td>${esc(fo.responsable)}</td><td class="n">${soles(fo.monto)}</td><td class="n">${soles(gastadoFondo(fo.id))}</td><td class="n">${soles(Number(fo.monto) - gastadoFondo(fo.id))}</td></tr>`).join("")}</tbody></table></div>
      </body></html>`;
    const w = window.open("", "_blank");
    if (!w) return aviso("Tu navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.", "error");
    w.document.write(html); w.document.close();
  }

  // ---------- Excel ----------
  function exportar() {
    const X = window.XLSX; if (!X) throw new Error("No se pudo cargar el generador de Excel");
    const wb = X.utils.book_new(), k = cont();
    const filas = [];
    for (const ct of cats()) {
      const its = itemsDe(ct.id), t = totales(its);
      for (const it of its) {
        const re = real(it), p = prov(it.proveedor_id);
        filas.push({ Categoría: ct.nombre, Descripción: it.descripcion, "Para": it.para, Tipo: it.tipo, Cantidad: Number(it.cantidad), "C/U (S/)": Number(it.cu),
          "Presupuesto (S/)": pres(it), "Aprobado original (S/)": it.pres_original ?? "Nuevo", "Costo real (S/)": re ?? "", "Pagado (S/)": pagado(it), "Diferencia (S/)": re == null ? "" : re - pres(it),
          Estado: ESTADOS[it.estado]?.[0] || it.estado, Proveedor: p?.nombre || "", Teléfono: p?.telefono || "", "Pide adelanto": it.adelanto ? "Sí" : "",
          "Monto adelanto": it.adelanto_monto ?? "", "Fecha adelanto": it.adelanto_fecha ? fecha(it.adelanto_fecha) : "", "Fecha entrega": it.entrega_fecha ? fecha(it.entrega_fecha) : "", "Lugar entrega": it.entrega_lugar,
          "Medio de pago": it.medio_pago, Responsable: it.responsable, Documento: it.enlace, Notas: it.notas });
      }
      filas.push({ Categoría: `SUBTOTAL ${ct.nombre.toUpperCase()}`, "Presupuesto (S/)": t.pres, "Costo real (S/)": t.real, "Pagado (S/)": t.pagado, "Diferencia (S/)": t.dif });
    }
    const T = totales(L.items);
    filas.push({ Categoría: "SUBTOTAL GENERAL", "Presupuesto (S/)": T.pres, "Aprobado original (S/)": base() ?? "", "Costo real (S/)": T.real, "Pagado (S/)": T.pagado });
    filas.push({ Categoría: `CONTINGENCIA ${Math.round(k * 100)} %`, "Presupuesto (S/)": T.pres * k });
    filas.push({ Categoría: "TOTAL ESTIMADO", "Presupuesto (S/)": T.pres * (1 + k), "Aprobado original (S/)": base() == null ? "" : base() * (1 + k) });
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(filas), "Presupuesto vs real");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(L.gastos.length ? L.gastos.map((g) => ({ Fecha: g.fecha ? fecha(g.fecha) : "", Concepto: g.concepto, Ítem: item(g.item_id)?.descripcion || "",
      Categoría: cat(item(g.item_id)?.categoria_id)?.nombre || "", "Pagado con": fondo(g.fondo_id)?.nombre || "Otro / tesorería", Monto: Number(g.monto), Moneda: g.moneda, TC: g.tc ?? "",
      "Monto (S/)": Number(g.monto_pen), Comprobante: g.comprobante, "Archivos adjuntos": archivosDe("gasto_id", g.id).map((a) => a.nombre).join(", "), "A nombre de PMI": g.a_nombre_pmi ? "Sí" : "", Notas: g.notas })) : [{ Aviso: "Sin gastos" }]), "Gastos");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(L.fondos.length ? L.fondos.map((fo) => ({ Fondo: fo.nombre, Responsable: fo.responsable, "Entregado (S/)": Number(fo.monto),
      "Gastado (S/)": gastadoFondo(fo.id), "Saldo (S/)": Number(fo.monto) - gastadoFondo(fo.id), Fecha: fo.fecha ? fecha(fo.fecha) : "", Notas: fo.notas })) : [{ Aviso: "Sin fondos" }]), "Fondos");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(L.proveedores.length ? L.proveedores.map((p) => ({ Proveedor: p.nombre, Rubro: p.rubro, RUC: p.ruc, Contacto: p.contacto,
      Teléfono: p.telefono, Correo: p.email, Dirección: p.direccion, Web: p.web, Notas: p.notas })) : [{ Aviso: "Sin proveedores" }]), "Proveedores");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(L.historial.length ? L.historial.map((h) => ({ Fecha: fechaHora(h.fecha), Cambio: ACCION[h.accion]?.[0] || h.accion, Categoría: h.categoria,
      Ítem: h.descripcion, "Antes (S/)": h.antes ?? "", "Después (S/)": h.despues ?? "", Detalle: h.detalle })) : [{ Aviso: "Sin cambios" }]), "Historial de cambios");
    X.writeFile(wb, `CONCEPMI-VI-logistica-${hoyISO()}.xlsx`);
  }

  return { vista, olvidar: () => { L = null; } };
}

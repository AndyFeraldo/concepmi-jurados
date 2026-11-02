// =========================================================
// Admin · Logística del evento
// Presupuesto vs real por categoría, detalle de cada compra,
// gastos y fondos a rendir, y directorio de proveedores.
// Real de un ítem = monto acordado con el proveedor; si no hay, lo pagado.
// =========================================================
import { api } from "./api.js?v=202611022137";
import { $, $$, esc, I, aviso, modal, confirmar } from "./ui.js?v=202611022137";

export const ESTADOS = {
  pendiente: ["Pendiente", ""], cotizando: ["Cotizando", "chip--celeste"], aprobado: ["Aprobado", "chip--ambar"],
  comprado: ["Comprado", "chip--verde"], entregado: ["Entregado", "chip--verde"], cancelado: ["Cancelado", "chip--rojo"],
};
const LIMITE_ESPECIAL = 700; // compras > S/ 700: gestión especial y aprobación de Directiva
const soles = (n) => (n == null || isNaN(n) ? "—" : `S/ ${Number(n).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`);
const num = (v) => { const n = Number(String(v ?? "").replace(",", ".")); return String(v ?? "").trim() === "" || isNaN(n) ? null : n; };
const fecha = (f) => (f ? new Date(`${f}T12:00:00`).toLocaleDateString("es-PE", { day: "numeric", month: "short", year: "numeric" }) : "Sin fecha");
const hoyISO = () => new Date().toISOString().slice(0, 10);
const telLimpio = (t) => String(t || "").replace(/\D/g, "");
const whatsapp = (t) => { const d = telLimpio(t); return d ? `https://wa.me/${d.length === 9 ? `51${d}` : d}` : ""; };

// ctx = { codigo(): string }
export function crearLogistica(ctx) {
  let L = null, cargando = null, sub = "presupuesto", filtro = "", abiertas = new Set(), soloCambios = false;

  async function cargar() {
    cargando ||= api.adminLogistica(ctx.codigo()).then((d) => { L = d; }).finally(() => { cargando = null; });
    return cargando;
  }

  // ---------- Cálculos ----------
  const gastosDe = (id) => L.gastos.filter((g) => g.item_id === id);
  const pres = (it) => Number(it.cantidad) * Number(it.cu);
  const pagado = (it) => gastosDe(it.id).reduce((s, g) => s + Number(g.monto_pen), 0);
  function real(it) {
    if (it.acordado != null) return Number(it.acordado);
    const p = pagado(it);
    return p > 0 || it.estado === "cancelado" ? p : null;
  }
  const itemsDe = (cid) => L.items.filter((i) => i.categoria_id === cid).sort((a, b) => a.orden - b.orden);
  const prov = (id) => L.proveedores.find((p) => p.id === id);
  const cat = (id) => L.categorias.find((c) => c.id === id);
  const item = (id) => L.items.find((i) => i.id === id);
  const fondo = (id) => L.fondos.find((f) => f.id === id);
  // Cambio frente al presupuesto aprobado original: "nuevo" (no estaba) o "modificado" (cambió cantidad o costo)
  const cambio = (it) => (it.pres_original == null ? "nuevo" : Math.abs(pres(it) - Number(it.pres_original)) > 0.005 ? "modificado" : "");
  function totales(items) {
    let p = 0, r = 0, pg = 0, porPagar = 0, listos = 0, orig = 0;
    for (const it of items) {
      p += pres(it); const re = real(it); const pa = pagado(it);
      if (it.pres_original != null) orig += Number(it.pres_original);
      if (re != null) r += re;
      pg += pa; porPagar += Math.max(0, (re ?? 0) - pa);
      if (["comprado", "entregado", "cancelado"].includes(it.estado)) listos++;
    }
    return { pres: p, real: r, pagado: pg, porPagar, listos, n: items.length, orig };
  }
  const gastadoFondo = (id) => L.gastos.filter((g) => g.fondo_id === id).reduce((s, g) => s + Number(g.monto_pen), 0);

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
    const T = totales(L.items);
    const cont = Number(L.config.contingencia);
    const hoy = hoyISO(), en7 = new Date(Date.now() + 7 * 864e5).toISOString().slice(0, 10);
    const especiales = L.items.filter((i) => i.estado !== "cancelado" && Math.max(pres(i), real(i) ?? 0) > LIMITE_ESPECIAL);
    const proximas = L.items.filter((i) => i.entrega_fecha && i.entrega_fecha >= hoy && i.entrega_fecha <= en7 && i.estado !== "entregado");
    const adelantos = L.items.filter((i) => i.adelanto && i.adelanto_monto && pagado(i) < Number(i.adelanto_monto) && i.estado !== "cancelado");
    const base = L.config.linea_base == null ? null : Number(L.config.linea_base);
    const nuevos = L.items.filter((i) => cambio(i) === "nuevo"), modif = L.items.filter((i) => cambio(i) === "modificado");
    const montoNuevos = nuevos.reduce((s, i) => s + pres(i), 0), montoModif = modif.reduce((s, i) => s + pres(i) - Number(i.pres_original), 0);
    const montoElim = base == null ? 0 : base - T.orig; // lo que estaba aprobado y se eliminó
    const varTotal = base == null ? 0 : T.pres - base;
    const firma = (n) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${soles(Math.abs(n))}`;
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Logística</h1><p>Presupuesto vs gasto real del VI CONCEPMI. Haz clic en cualquier ítem para registrar el proveedor, el adelanto, la entrega y los pagos.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--mini" data-ajustes>${I.lapiz}Ajustes (TC y contingencia)</button><button class="btn btn--mini btn--naranja" data-xls>${I.descargar}Exportar logística</button></div></div>
      <div class="kpis">
        <div class="kpi"><b>${soles(T.pres * (1 + cont))}</b><span>Presupuesto actual (incluye ${Math.round(cont * 100)} % de contingencia)${base != null ? ` · aprobado: ${soles(base * (1 + cont))}` : ""}</span></div>
        <div class="kpi"><b>${soles(T.real)}</b><span>Real comprometido · ${soles(T.pres - T.real)} libres del subtotal</span></div>
        <div class="kpi"><b>${soles(T.pagado)}</b><span>Pagado · ${soles(T.porPagar)} por pagar</span></div>
        <div class="kpi"><b>${T.listos}/${T.n}</b><span>Ítems resueltos (comprado, entregado o cancelado)</span></div>
      </div>
      ${base != null && (nuevos.length || modif.length || Math.abs(montoElim) > 0.005) ? `<div class="log-cambios">
        <div><b>Cambios frente al presupuesto aprobado</b> (subtotal aprobado ${soles(base)} → actual ${soles(T.pres)}: <b class="${varTotal > 0 ? "log-mal" : "log-bien"}">${firma(varTotal)}</b>)</div>
        <div class="reparto" style="margin:6px 0 0">
          ${nuevos.length ? `<span class="chip chip--celeste">${nuevos.length} ítem${nuevos.length === 1 ? "" : "s"} nuevo${nuevos.length === 1 ? "" : "s"} · ${firma(montoNuevos)}</span>` : ""}
          ${modif.length ? `<span class="chip chip--ambar">${modif.length} modificado${modif.length === 1 ? "" : "s"} · ${firma(montoModif)}</span>` : ""}
          ${Math.abs(montoElim) > 0.005 ? `<span class="chip chip--rojo">Eliminados del aprobado · ${firma(-montoElim)}</span>` : ""}
        </div></div>` : ""}
      ${especiales.length || proximas.length || adelantos.length ? `<div class="log-alertas">
        ${proximas.length ? `<div class="cerrado" style="background:rgba(31,203,234,.1);border-color:rgba(31,203,234,.45);color:#8FE6F6">${I.reloj}<span><b>Entregas en los próximos 7 días:</b> ${proximas.map((i) => `${esc(i.descripcion)} (${fecha(i.entrega_fecha)})`).join(" · ")}</span></div>` : ""}
        ${adelantos.length ? `<div class="cerrado" style="background:rgba(255,194,61,.1);border-color:rgba(255,194,61,.45);color:#FFE3A6">${I.alerta}<span><b>Adelantos por pagar:</b> ${adelantos.map((i) => `${esc(i.descripcion)} (${soles(i.adelanto_monto)}${i.adelanto_fecha ? ` hasta ${fecha(i.adelanto_fecha)}` : ""})`).join(" · ")}</span></div>` : ""}
        ${especiales.length ? `<div class="cerrado" style="background:rgba(169,139,255,.1);border-color:rgba(169,139,255,.45);color:#D9CCFF">${I.info}<span><b>Compras mayores a S/ ${LIMITE_ESPECIAL}</b> (requieren gestión especial y aprobación de la Directiva): ${especiales.map((i) => esc(i.descripcion)).join(" · ")}</span></div>` : ""}
      </div>` : ""}
      <div class="pestanas" role="tablist" style="margin-top:16px">
        ${[["presupuesto", "Presupuesto vs real", "tabla"], ["gastos", "Gastos y fondos", "copa"], ["proveedores", "Proveedores", "personas"]].map(([id, t, ic]) => `<button class="pestana" role="tab" data-sub="${id}" aria-selected="${sub === id}">${I[ic]}${t}</button>`).join("")}
      </div>
      <div data-cuerpo></div>`;
    $$("[data-sub]", v).forEach((b) => (b.onclick = () => { sub = b.dataset.sub; vista(v); }));
    $("[data-ajustes]", v).onclick = () => ajustes(v);
    $("[data-xls]", v).onclick = () => { try { exportar(); aviso("Excel de logística generado"); } catch (e) { aviso(e.message, "error"); } };
    const c = $("[data-cuerpo]", v);
    ({ presupuesto, gastos, proveedores })[sub](c, v);
  }
  const repintar = async (v, recargar = true) => { if (recargar) { try { await cargar(); } catch (e) { aviso(e.message, "error"); } } vista(v); };

  // ---------- Presupuesto vs real ----------
  function presupuesto(c, v) {
    const T = totales(L.items), cont = Number(L.config.contingencia), base = L.config.linea_base == null ? null : Number(L.config.linea_base);
    const f = filtro.trim().toLowerCase();
    const coincide = (it) => (!soloCambios || cambio(it)) && (!f || `${it.descripcion} ${it.para} ${prov(it.proveedor_id)?.nombre || ""}`.toLowerCase().includes(f));
    c.innerHTML = `
      <div class="log-barra"><input class="log-buscar" data-buscar placeholder="Buscar ítem, para qué es o proveedor…" value="${esc(filtro)}">
        <label class="check" style="padding:.45em .8em"><input type="checkbox" data-cambios ${soloCambios ? "checked" : ""}><span>Solo cambios</span></label>
        <button class="btn btn--mini" data-todas>${abiertas.size ? "Contraer todo" : "Expandir todo"}</button>
        <button class="btn btn--mini btn--naranja" data-nuevacat>${I.mas}Nueva categoría</button></div>
      ${L.categorias.map((ct) => {
        const its = itemsDe(ct.id), vis = its.filter(coincide), t = totales(its);
        if ((f || soloCambios) && !vis.length) return "";
        const abierta = f || soloCambios || abiertas.has(ct.id);
        const cambioCat = Math.abs(t.pres - t.orig) > 0.005;
        const dif = t.real - t.pres;
        return `<section class="log-cat ${abierta ? "log-cat--abierta" : ""}">
          <header class="log-cat__cab" data-abrir="${ct.id}">
            <span class="log-cat__flecha">${I.flecha}</span>
            <h3>${esc(ct.nombre)} <small>${t.n} ítem${t.n === 1 ? "" : "s"} · ${t.listos} resuelto${t.listos === 1 ? "" : "s"}</small></h3>
            <div class="log-cat__tot"><span><small>Presupuestado</small><b>${soles(t.pres)}</b>${cambioCat ? `<small class="log-antes">aprobado ${soles(t.orig)}</small>` : ""}</span><span><small>Real</small><b>${t.real ? soles(t.real) : "—"}</b></span>
              <span><small>Diferencia</small><b class="${t.real ? (dif > 0 ? "log-mal" : "log-bien") : ""}">${t.real ? `${dif > 0 ? "+" : ""}${soles(dif)}` : "—"}</b></span></div>
          </header>
          ${abierta ? `<div class="tabla-envoltura"><table class="tabla log-tabla"><thead><tr><th>Descripción</th><th>Tipo</th><th class="num">Cant.</th><th class="num">C/U</th><th class="num">Presupuestado</th><th class="num">Real</th><th class="num">Diferencia</th><th>Estado</th><th>Proveedor</th></tr></thead>
            <tbody>${vis.map((it) => {
              const re = real(it), d = re == null ? null : re - pres(it), pa = pagado(it), [et, ec] = ESTADOS[it.estado] || ESTADOS.pendiente;
              return `<tr class="log-fila ${it.estado === "cancelado" ? "log-fila--cancelado" : ""}" data-item="${it.id}" tabindex="0">
                <td><b>${esc(it.descripcion)}</b>${cambio(it) === "nuevo" ? ` <span class="chip chip--celeste log-tag">Nuevo</span>` : cambio(it) === "modificado" ? ` <span class="chip chip--ambar log-tag">Modificado</span>` : ""}${it.para ? `<br><small class="tenue">${esc(it.para)}</small>` : ""}${it.notas ? `<br><small class="log-nota">${esc(it.notas)}</small>` : ""}</td>
                <td>${esc(it.tipo)}</td><td class="num">${Number(it.cantidad).toLocaleString("es-PE")}</td><td class="num">${soles(it.cu)}</td>
                <td class="num">${soles(pres(it))}${cambio(it) === "modificado" ? `<br><small class="log-antes">antes ${soles(it.pres_original)}</small>` : ""}</td>
                <td class="num">${re == null ? `<span class="tenue">—</span>` : `<b>${soles(re)}</b>`}${pa > 0 && it.acordado != null ? `<br><small class="tenue">pagado ${soles(pa)}</small>` : ""}</td>
                <td class="num ${d == null ? "" : d > 0 ? "log-mal" : "log-bien"}">${d == null ? "—" : `${d > 0 ? "+" : ""}${soles(d)}`}</td>
                <td><span class="chip ${ec}">${et}</span>${it.adelanto ? `<br><small class="tenue">pide adelanto</small>` : ""}</td>
                <td>${esc(prov(it.proveedor_id)?.nombre || "")}</td></tr>`; }).join("")}
              <tr class="log-subtotal"><td colspan="4">Subtotal ${esc(ct.nombre)}</td><td class="num">${soles(t.pres)}</td><td class="num">${t.real ? soles(t.real) : "—"}</td><td class="num">${t.real ? `${dif > 0 ? "+" : ""}${soles(dif)}` : "—"}</td><td colspan="2"></td></tr>
            </tbody></table></div>
            <div class="log-cat__acc"><button class="btn btn--mini btn--naranja" data-nuevo="${ct.id}">${I.mas}Agregar ítem a ${esc(ct.nombre)}</button>
              <button class="btn btn--mini" data-rencat="${ct.id}">${I.lapiz}Renombrar</button>
              ${its.length ? "" : `<button class="btn btn--mini btn--peligro" data-borcat="${ct.id}">${I.basura}Eliminar categoría</button>`}</div>` : ""}
        </section>`; }).join("")}
      <div class="tabla-envoltura" style="margin-top:16px"><table class="tabla log-resumen"><tbody>
        <tr><td>Subtotal general</td><td class="num tenue">${soles(base)}</td><td class="num">${soles(T.pres)}</td><td class="num">${soles(T.real)}</td></tr>
        <tr><td>Contingencia ${Math.round(cont * 100)} %</td><td class="num tenue">${base == null ? "—" : soles(base * cont)}</td><td class="num">${soles(T.pres * cont)}</td><td class="num tenue">—</td></tr>
        <tr class="log-total"><td>TOTAL ESTIMADO</td><td class="num">${base == null ? "—" : soles(base * (1 + cont))}</td><td class="num">${soles(T.pres * (1 + cont))}</td><td class="num">${soles(T.real)}</td></tr>
      </tbody><thead><tr><th></th><th class="num">Aprobado (original)</th><th class="num">Presupuesto actual</th><th class="num">Real</th></tr></thead></table></div>`;
    $("[data-cambios]", c).onchange = (e) => { soloCambios = e.target.checked; presupuesto(c, v); };
    const bus = $("[data-buscar]", c);
    bus.oninput = () => { filtro = bus.value; const pos = bus.selectionStart; presupuesto(c, v); const b2 = $("[data-buscar]", c); b2.focus(); b2.setSelectionRange(pos, pos); };
    $("[data-todas]", c).onclick = () => { abiertas = abiertas.size ? new Set() : new Set(L.categorias.map((x) => x.id)); presupuesto(c, v); };
    $$("[data-abrir]", c).forEach((h) => (h.onclick = () => { const id = h.dataset.abrir; abiertas.has(id) ? abiertas.delete(id) : abiertas.add(id); presupuesto(c, v); }));
    $$("[data-item]", c).forEach((r) => { r.onclick = () => formItem(item(r.dataset.item), null, v); r.onkeydown = (e) => { if (e.key === "Enter") r.click(); }; });
    $$("[data-nuevo]", c).forEach((b) => (b.onclick = () => formItem(null, b.dataset.nuevo, v)));
    $$("[data-rencat]", c).forEach((b) => (b.onclick = () => formCategoria(cat(b.dataset.rencat), v)));
    $$("[data-borcat]", c).forEach((b) => (b.onclick = async () => {
      if (!(await confirmar("¿Eliminar categoría?", `Se eliminará <b>${esc(cat(b.dataset.borcat).nombre)}</b> (no tiene ítems).`, { boton: "Eliminar", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "categoria", b.dataset.borcat); aviso("Categoría eliminada"); repintar(v); } catch (e) { aviso(e.message, "error"); }
    }));
    $("[data-nuevacat]", c).onclick = () => formCategoria(null, v);
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

  // ---------- Detalle de un ítem ----------
  function formItem(it, categoriaId, v) {
    const n = !it;
    it ||= { categoria_id: categoriaId, tipo: "CV", cantidad: 1, cu: 0, estado: "pendiente", orden: itemsDe(categoriaId).length + 1 };
    const pagos = it.id ? gastosDe(it.id) : [];
    const opProv = `<option value="">— Sin proveedor —</option>${L.proveedores.map((p) => `<option value="${p.id}" ${p.id === it.proveedor_id ? "selected" : ""}>${esc(p.nombre)}${p.rubro ? ` · ${esc(p.rubro)}` : ""}</option>`).join("")}`;
    const m = modal(`
      <h2>${n ? "Nuevo ítem" : esc(it.descripcion)}</h2>
      <form class="form log-form">
        <fieldset><legend>1. Presupuesto</legend>
          <div class="log-grid">
            <label class="campo log-ancho"><span>Descripción</span><input name="descripcion" maxlength="300" required value="${esc(it.descripcion || "")}" placeholder="Ej. Medallas oro 1er puesto"></label>
            <label class="campo log-ancho"><span>¿Para qué es? (proyecto / evento)</span><input name="para" maxlength="300" value="${esc(it.para || "")}" placeholder="Ej. Concurso de Proyectos"></label>
            <label class="campo"><span>Categoría</span><select name="categoria_id">${L.categorias.map((c) => `<option value="${c.id}" ${c.id === it.categoria_id ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select></label>
            <label class="campo"><span>Tipo de costo</span><select name="tipo"><option value="CV" ${it.tipo === "CV" ? "selected" : ""}>CV · Variable</option><option value="CF" ${it.tipo === "CF" ? "selected" : ""}>CF · Fijo</option></select></label>
            <label class="campo"><span>Cantidad</span><input name="cantidad" inputmode="decimal" value="${esc(it.cantidad)}"></label>
            <label class="campo"><span>Costo unitario presupuestado (S/)</span><input name="cu" inputmode="decimal" value="${esc(it.cu)}"></label>
          </div>
          <p class="ayuda">Total presupuestado: <b data-totpres>${soles(pres(it))}</b></p>
        </fieldset>
        <fieldset><legend>2. Compra real</legend>
          <div class="log-grid">
            <label class="campo"><span>Estado</span><select name="estado">${Object.entries(ESTADOS).map(([k, [t]]) => `<option value="${k}" ${k === it.estado ? "selected" : ""}>${t}</option>`).join("")}</select></label>
            <label class="campo"><span>Monto total acordado (S/)</span><input name="acordado" inputmode="decimal" value="${esc(it.acordado ?? "")}" placeholder="Lo que cotizó o cobra el proveedor"></label>
            <label class="campo log-ancho"><span>Proveedor</span><div style="display:flex;gap:8px"><select name="proveedor_id" style="flex:1">${opProv}</select><button type="button" class="btn btn--mini" data-nuevoprov>${I.mas}Nuevo</button></div></label>
            <label class="campo"><span>Medio de pago</span><input name="medio_pago" maxlength="120" list="medios" value="${esc(it.medio_pago || "")}" placeholder="Yape, transferencia, efectivo…"></label>
            <label class="campo"><span>Responsable</span><input name="responsable" maxlength="120" value="${esc(it.responsable || "")}" placeholder="Quién lo gestiona"></label>
          </div>
          <datalist id="medios"><option>Yape</option><option>Plin</option><option>Transferencia</option><option>Efectivo</option><option>Tarjeta</option></datalist>
        </fieldset>
        <fieldset><legend>3. Adelanto y entrega</legend>
          <div class="log-grid">
            <label class="check log-ancho"><input type="checkbox" name="adelanto" ${it.adelanto ? "checked" : ""}><span>El proveedor pide adelanto</span></label>
            <label class="campo"><span>Monto del adelanto (S/)</span><input name="adelanto_monto" inputmode="decimal" value="${esc(it.adelanto_monto ?? "")}"></label>
            <label class="campo"><span>Pagar adelanto hasta</span><input type="date" name="adelanto_fecha" value="${esc(it.adelanto_fecha || "")}"></label>
            <label class="campo"><span>Fecha de entrega</span><input type="date" name="entrega_fecha" value="${esc(it.entrega_fecha || "")}"></label>
            <label class="campo"><span>Lugar de entrega / recojo</span><input name="entrega_lugar" maxlength="300" value="${esc(it.entrega_lugar || "")}" placeholder="Ej. Recojo en tienda / delivery a la UNMSM"></label>
          </div>
        </fieldset>
        <fieldset><legend>4. Documentos y notas</legend>
          <label class="campo"><span>Enlace a cotización o factura (Drive)</span><input name="enlace" maxlength="1000" value="${esc(it.enlace || "")}" placeholder="https://drive.google.com/…"></label>
          ${it.enlace ? `<p class="ayuda"><a href="${esc(it.enlace)}" target="_blank" rel="noopener">Abrir documento ↗</a></p>` : ""}
          <label class="campo"><span>Notas</span><textarea name="notas" maxlength="2000" placeholder="Condiciones, garantía, lo que se acordó…">${esc(it.notas || "")}</textarea></label>
        </fieldset>
        ${n ? "" : `<fieldset><legend>5. Pagos registrados</legend>
          ${pagos.length ? `<table class="tabla-mini"><tbody>${pagos.map((g) => `<tr><td>${fecha(g.fecha)}</td><td>${esc(g.concepto)}</td><td>${esc(fondo(g.fondo_id)?.nombre || "")}</td><td class="num"><b>${soles(g.monto_pen)}</b>${g.moneda === "USD" ? `<br><small class="tenue">USD ${g.monto}</small>` : ""}</td></tr>`).join("")}</tbody></table>
            <p class="ayuda">Total pagado: <b>${soles(pagado(it))}</b>${real(it) != null ? ` · Por pagar: <b>${soles(Math.max(0, real(it) - pagado(it)))}</b>` : ""}</p>` : `<p class="ayuda">Aún no hay pagos para este ítem.</p>`}
          <button type="button" class="btn btn--mini" data-pago>${I.mas}Registrar pago</button></fieldset>`}
        <p class="error" aria-live="polite"></p>
        <div class="modal__acciones" style="margin-top:0">
          ${n ? "" : `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Eliminar</button>`}
          <button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div>
      </form>`, { ancho: true });
    const f = $("form", m.el);
    const totPres = () => { $("[data-totpres]", m.el).textContent = soles((num(f.cantidad.value) || 0) * (num(f.cu.value) || 0)); };
    f.cantidad.oninput = totPres; f.cu.oninput = totPres;
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    const datos = () => ({ id: it.id, categoria_id: f.categoria_id.value, descripcion: f.descripcion.value, para: f.para.value, tipo: f.tipo.value,
      cantidad: num(f.cantidad.value) ?? 1, cu: num(f.cu.value) ?? 0, acordado: num(f.acordado.value), estado: f.estado.value, proveedor_id: f.proveedor_id.value,
      medio_pago: f.medio_pago.value, responsable: f.responsable.value, adelanto: f.adelanto.checked, adelanto_monto: num(f.adelanto_monto.value),
      adelanto_fecha: f.adelanto_fecha.value, entrega_fecha: f.entrega_fecha.value, entrega_lugar: f.entrega_lugar.value, enlace: f.enlace.value, notas: f.notas.value, orden: it.orden });
    async function guardar() {
      const id = await api.adminLogGuardar(ctx.codigo(), "item", datos());
      abiertas.add(f.categoria_id.value);
      return id;
    }
    $("[data-nuevoprov]", m.el).onclick = () => formProveedor(null, null, async (p) => {
      await cargar();
      f.proveedor_id.innerHTML = `<option value="">— Sin proveedor —</option>${L.proveedores.map((x) => `<option value="${x.id}" ${x.id === p ? "selected" : ""}>${esc(x.nombre)}</option>`).join("")}`;
    });
    $("[data-pago]", m.el)?.addEventListener("click", async () => {
      try { await guardar(); await cargar(); m.cerrar(); formGasto(null, { item_id: it.id }, v, () => formItem(item(it.id), null, v)); }
      catch (ex) { $(".error", m.el).textContent = ex.message; }
    });
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar este ítem?", `Se eliminará <b>${esc(it.descripcion)}</b> del presupuesto. Sus pagos registrados se conservan en Gastos.<br><br>Si solo ya no se va a comprar, es mejor ponerlo en estado <b>Cancelado</b>: así queda registrado en el historial.`, { boton: "Eliminar ítem", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "item", it.id); m.cerrar(); aviso("Ítem eliminado"); repintar(v); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button:not([type=button])", f); btn.disabled = true;
      try { await guardar(); m.cerrar(); aviso("Ítem guardado"); repintar(v); }
      catch (ex) { $(".error", m.el).textContent = ex.message; btn.disabled = false; }
    };
  }

  // ---------- Gastos y fondos ----------
  function gastos(c, v) {
    const total = L.gastos.reduce((s, g) => s + Number(g.monto_pen), 0);
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
      <div class="cabeza"><div><h1 style="font-size:1.5rem">Todos los gastos</h1><p>${L.gastos.length} gasto${L.gastos.length === 1 ? "" : "s"} · total ${soles(total)}</p></div>
        <button class="btn btn--naranja" data-nuevogasto>${I.mas}Registrar gasto</button></div>
      ${L.gastos.length ? `<div class="tabla-envoltura"><table class="tabla log-tabla"><thead><tr><th>Fecha</th><th>Concepto</th><th>Ítem del presupuesto</th><th>Pagado con</th><th class="num">Monto</th><th>Comprobante</th></tr></thead>
        <tbody>${L.gastos.map((g) => { const it = item(g.item_id);
          return `<tr class="log-fila" data-gasto="${g.id}" tabindex="0"><td style="white-space:nowrap">${fecha(g.fecha)}</td><td><b>${esc(g.concepto)}</b>${g.notas ? `<br><small class="tenue">${esc(g.notas)}</small>` : ""}</td>
            <td>${it ? `${esc(it.descripcion)}<br><small class="tenue">${esc(cat(it.categoria_id)?.nombre || "")}</small>` : `<span class="tenue">Sin ítem</span>`}</td>
            <td>${esc(fondo(g.fondo_id)?.nombre || "Otro / tesorería")}</td>
            <td class="num"><b>${soles(g.monto_pen)}</b>${g.moneda === "USD" ? `<br><small class="tenue">USD ${Number(g.monto).toFixed(2)} × ${g.tc}</small>` : ""}</td>
            <td>${esc(g.comprobante || "—")}${g.a_nombre_pmi ? `<br><small class="chip chip--verde">a nombre de PMI Lima</small>` : ""}</td></tr>`; }).join("")}</tbody></table></div>`
      : `<div class="vacio"><b>Aún no hay gastos</b>Registra el primero con el botón de arriba.</div>`}`;
    $$("[data-edfondo]", c).forEach((b) => (b.onclick = () => formFondo(fondo(b.dataset.edfondo), v)));
    $$("[data-gastofondo]", c).forEach((b) => (b.onclick = () => formGasto(null, { fondo_id: b.dataset.gastofondo }, v)));
    $("[data-nuevofondo]", c).onclick = () => formFondo(null, v);
    $("[data-nuevogasto]", c).onclick = () => formGasto(null, {}, v);
    $$("[data-gasto]", c).forEach((r) => { r.onclick = () => formGasto(L.gastos.find((g) => g.id === r.dataset.gasto), {}, v); r.onkeydown = (e) => { if (e.key === "Enter") r.click(); }; });
  }

  function formGasto(g, pre, v, despues) {
    const n = !g;
    g ||= { fecha: hoyISO(), moneda: "PEN", tc: L.config.tc, ...pre };
    const opItems = L.categorias.map((ct) => `<optgroup label="${esc(ct.nombre)}">${itemsDe(ct.id).map((i) => `<option value="${i.id}" ${i.id === g.item_id ? "selected" : ""}>${esc(i.descripcion)}</option>`).join("")}</optgroup>`).join("");
    const m = modal(`<h2>${n ? "Registrar gasto" : "Editar gasto"}</h2>
      <form class="form log-form"><div class="log-grid">
        <label class="campo"><span>Fecha</span><input type="date" name="fecha" value="${esc(g.fecha || "")}"></label>
        <label class="campo"><span>Concepto</span><input name="concepto" maxlength="300" required value="${esc(g.concepto || "")}" placeholder="Ej. Copias e impresiones"></label>
        <label class="campo log-ancho"><span>Ítem del presupuesto</span><select name="item_id"><option value="">— Sin ítem (gasto no presupuestado) —</option>${opItems}</select></label>
        <label class="campo"><span>Monto</span><input name="monto" inputmode="decimal" required value="${esc(g.monto ?? "")}"></label>
        <label class="campo"><span>Moneda</span><select name="moneda"><option value="PEN" ${g.moneda === "PEN" ? "selected" : ""}>Soles (S/)</option><option value="USD" ${g.moneda === "USD" ? "selected" : ""}>Dólares (USD)</option></select></label>
        <label class="campo" data-tcbox><span>Tipo de cambio</span><input name="tc" inputmode="decimal" value="${esc(g.tc ?? L.config.tc)}"></label>
        <label class="campo"><span>Pagado con</span><select name="fondo_id"><option value="">Otro / tesorería del PMI</option>${L.fondos.map((fo) => `<option value="${fo.id}" ${fo.id === g.fondo_id ? "selected" : ""}>${esc(fo.nombre)}</option>`).join("")}</select></label>
        <label class="campo"><span>Comprobante (boleta / factura N.°)</span><input name="comprobante" maxlength="120" value="${esc(g.comprobante || "")}" placeholder="Ej. B001-2345"></label>
        <label class="check"><input type="checkbox" name="a_nombre_pmi" ${g.a_nombre_pmi ? "checked" : ""}><span>Comprobante a nombre de PMI Lima, Perú</span></label>
        <label class="campo log-ancho"><span>Notas</span><textarea name="notas" maxlength="2000">${esc(g.notas || "")}</textarea></label>
      </div>
      <p class="ayuda" data-equiv></p>
      <p class="error" aria-live="polite"></p>
      <div class="modal__acciones" style="margin-top:0">${n ? "" : `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Eliminar</button>`}
        <button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar gasto</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    const eq = () => {
      const usd = f.moneda.value === "USD"; $("[data-tcbox]", m.el).hidden = !usd;
      const mo = num(f.monto.value) || 0, tc = num(f.tc.value) || 0;
      $("[data-equiv]", m.el).textContent = usd && mo ? `Equivale a ${soles(Math.round(mo * tc * 100) / 100)}` : "";
    };
    f.moneda.onchange = eq; f.monto.oninput = eq; f.tc.oninput = eq; eq();
    const cerrar = () => { m.cerrar(); despues?.(); };
    $("[data-cancelar]", m.el).onclick = cerrar;
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar este gasto?", `Se eliminará <b>${esc(g.concepto)}</b> (${soles(g.monto_pen)}).`, { boton: "Eliminar gasto", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "gasto", g.id); m.cerrar(); aviso("Gasto eliminado"); await repintar(v); despues?.(); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const btn = $("button:not([type=button])", f); btn.disabled = true;
      try {
        await api.adminLogGuardar(ctx.codigo(), "gasto", { id: g.id, fecha: f.fecha.value, concepto: f.concepto.value, item_id: f.item_id.value, monto: num(f.monto.value),
          moneda: f.moneda.value, tc: f.moneda.value === "USD" ? num(f.tc.value) : null, fondo_id: f.fondo_id.value, comprobante: f.comprobante.value,
          a_nombre_pmi: f.a_nombre_pmi.checked, notas: f.notas.value });
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
      <label class="campo"><span>Fecha de entrega</span><input type="date" name="fecha" value="${esc(fo.fecha || "")}"></label>
      <label class="campo log-ancho"><span>Notas</span><textarea name="notas" maxlength="2000">${esc(fo.notas || "")}</textarea></label></div>
      <p class="error"></p><div class="modal__acciones" style="margin-top:0">${n ? "" : `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Eliminar</button>`}
        <button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar este fondo?", "Sus gastos se conservan, pero quedarán como “Otro / tesorería”.", { boton: "Eliminar fondo", peligro: true }))) return;
      try { await api.adminLogBorrar(ctx.codigo(), "fondo", fo.id); m.cerrar(); aviso("Fondo eliminado"); repintar(v); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api.adminLogGuardar(ctx.codigo(), "fondo", { id: fo.id, nombre: f.nombre.value, responsable: f.responsable.value, monto: num(f.monto.value) ?? 0, fecha: f.fecha.value, notas: f.notas.value }); m.cerrar(); aviso("Fondo guardado"); repintar(v); }
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
          ${its.length ? `<p class="ayuda" style="margin:0">Presupuestado ${soles(t.pres)} · Real ${soles(t.real)} · Pagado ${soles(t.pagado)}</p>` : ""}
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

  function ajustes(v) {
    const m = modal(`<h2>Ajustes de logística</h2><form class="form">
      <label class="campo"><span>Tipo de cambio USD → S/</span><input name="tc" inputmode="decimal" value="${esc(L.config.tc)}"></label>
      <label class="campo"><span>Contingencia (%)</span><input name="cont" inputmode="decimal" value="${esc(Math.round(Number(L.config.contingencia) * 1000) / 10)}"></label>
      <p class="ayuda">El tipo de cambio se propone al registrar gastos en dólares. La contingencia se suma al subtotal presupuestado.</p>
      <p class="error"></p><div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("form", m.el).onsubmit = async (e) => {
      e.preventDefault();
      try { await api.adminLogConfig(ctx.codigo(), num(e.target.tc.value), (num(e.target.cont.value) ?? 0) / 100); m.cerrar(); aviso("Ajustes guardados"); repintar(v); }
      catch (ex) { $(".error", m.el).textContent = ex.message; }
    };
  }

  // ---------- Excel ----------
  function exportar() {
    const X = window.XLSX; if (!X) throw new Error("No se pudo cargar el generador de Excel");
    const wb = X.utils.book_new(), cont = Number(L.config.contingencia);
    const filas = [];
    for (const ct of L.categorias) {
      const its = itemsDe(ct.id), t = totales(its);
      for (const it of its) {
        const re = real(it), p = prov(it.proveedor_id);
        filas.push({ Categoría: ct.nombre, Descripción: it.descripcion, "Para": it.para, Tipo: it.tipo, Cantidad: Number(it.cantidad), "C/U (S/)": Number(it.cu),
          "Aprobado original (S/)": it.pres_original ?? "Nuevo", "Presupuestado (S/)": pres(it), "Real (S/)": re ?? "", "Pagado (S/)": pagado(it), "Diferencia (S/)": re == null ? "" : re - pres(it),
          Estado: ESTADOS[it.estado]?.[0] || it.estado, Proveedor: p?.nombre || "", Teléfono: p?.telefono || "", "Pide adelanto": it.adelanto ? "Sí" : "",
          "Monto adelanto": it.adelanto_monto ?? "", "Fecha adelanto": it.adelanto_fecha || "", "Fecha entrega": it.entrega_fecha || "", "Lugar entrega": it.entrega_lugar,
          "Medio de pago": it.medio_pago, Responsable: it.responsable, Documento: it.enlace, Notas: it.notas });
      }
      filas.push({ Categoría: `SUBTOTAL ${ct.nombre.toUpperCase()}`, "Presupuestado (S/)": t.pres, "Real (S/)": t.real, "Pagado (S/)": t.pagado, "Diferencia (S/)": t.real - t.pres });
    }
    const T = totales(L.items);
    filas.push({ Categoría: "SUBTOTAL GENERAL", "Presupuestado (S/)": T.pres, "Real (S/)": T.real, "Pagado (S/)": T.pagado });
    filas.push({ Categoría: `CONTINGENCIA ${Math.round(cont * 100)} %`, "Presupuestado (S/)": T.pres * cont });
    filas.push({ Categoría: "TOTAL ESTIMADO", "Presupuestado (S/)": T.pres * (1 + cont) });
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(filas), "Presupuesto vs real");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(L.gastos.length ? L.gastos.map((g) => ({ Fecha: g.fecha || "", Concepto: g.concepto, Ítem: item(g.item_id)?.descripcion || "",
      Categoría: cat(item(g.item_id)?.categoria_id)?.nombre || "", "Pagado con": fondo(g.fondo_id)?.nombre || "Otro / tesorería", Monto: Number(g.monto), Moneda: g.moneda, TC: g.tc ?? "",
      "Monto (S/)": Number(g.monto_pen), Comprobante: g.comprobante, "A nombre de PMI": g.a_nombre_pmi ? "Sí" : "", Notas: g.notas })) : [{ Aviso: "Sin gastos" }]), "Gastos");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(L.fondos.length ? L.fondos.map((fo) => ({ Fondo: fo.nombre, Responsable: fo.responsable, "Entregado (S/)": Number(fo.monto),
      "Gastado (S/)": gastadoFondo(fo.id), "Saldo (S/)": Number(fo.monto) - gastadoFondo(fo.id), Fecha: fo.fecha || "", Notas: fo.notas })) : [{ Aviso: "Sin fondos" }]), "Fondos");
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(L.proveedores.length ? L.proveedores.map((p) => ({ Proveedor: p.nombre, Rubro: p.rubro, RUC: p.ruc, Contacto: p.contacto,
      Teléfono: p.telefono, Correo: p.email, Dirección: p.direccion, Web: p.web, Notas: p.notas })) : [{ Aviso: "Sin proveedores" }]), "Proveedores");
    X.writeFile(wb, `CONCEPMI-VI-logistica-${hoyISO()}.xlsx`);
  }

  return { vista, olvidar: () => { L = null; } };
}

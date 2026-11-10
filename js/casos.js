// =========================================================
// CASOS CONFIDENCIALES (Amateur I, Amateur II e IATHON) · 2 archivos por concurso:
//  · «caso»: lo que resuelven los equipos. Lo ven equipos, jurados y coordinadores desde «Iniciar tiempo».
//  · «solucion» (resolución): solo para los JURADOS de ese concurso, también desde «Iniciar tiempo».
//  · La encargada (permiso «casos», p. ej. la presidenta) crea su código privado y sube los archivos;
//    puede reemplazarlos hasta «Iniciar tiempo».
//  · El admin ve el estado y puede abrirlos para verificar, pero queda registrado («antes del concurso»).
// La base de datos decide todo (jur_casos_*); esto es solo la pantalla.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611101614";
import { porId } from "./concursos.js?v=202611101614";
import { $, $$, esc, I, aviso, confirmar } from "./ui.js?v=202611101614";
import { sesion } from "./app.js?v=202611101614";

export const CONCURSOS_CASO = ["iathon", "amateur-1", "amateur-2"];
export const PARTES = {
  caso: { txt: "Caso", largo: "Caso oficial", quien: "Lo resuelven los equipos · lo ven equipos y jurados" },
  solucion: { txt: "Resolución", largo: "Resolución del caso", quien: "Solo para los jurados" },
};
const nom = (c) => porId(c)?.nombre || c;
const peso = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fecha = (iso) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ROLES = { admin: "Administrador", encargada: "Encargada", equipo: "Equipo", jurado: "Jurado", coordinador: "Coordinador" };
const lista = (c) => Object.keys(c.partes || {}).map((pt) => ({ pt, x: c.partes[pt] }));

// Abre (o descarga) un archivo. La ventana se abre antes de pedir el enlace para que el navegador no la bloquee.
export async function abrirCaso(codigo, concurso, { parte = "caso", descargar = false } = {}) {
  const w = descargar ? null : window.open("", "_blank");
  try {
    const r = await api.casoUrl(codigo, concurso, parte, descargar);
    if (descargar) { const a = document.createElement("a"); a.href = r.url; a.download = r.nombre || "caso"; document.body.append(a); a.click(); a.remove(); }
    else if (w) w.location.href = r.url; else location.href = r.url;
  } catch (e) { w?.close(); aviso(e.message, "error"); }
}

const htmlRegistro = (vistas) => (vistas || []).length
  ? `<details class="cs-reg"><summary>Registro de aperturas (${vistas.length})${vistas.some((x) => x.antes && x.rol === "admin") ? ` · <b class="dd-pc">⚠ el admin lo abrió antes del concurso</b>` : ""}</summary><ul>${vistas.slice().reverse().map((x) => `<li class="${x.antes && x.rol !== "encargada" ? "cs-reg--antes" : ""}"><b>${esc(x.quien)}</b> <small>${esc(ROLES[x.rol] || x.rol)}</small> · ${esc(fecha(x.momento))}${x.antes ? " · <i>antes del concurso</i>" : ""}</li>`).join("")}</ul></details>`
  : `<p class="cs-reg-vacio">Nadie lo ha abierto todavía.</p>`;

// ---------------- Panel de la encargada ----------------
export function crearCasos(ctx) {
  async function vista(v) {
    v.innerHTML = `<div class="cargando"><div class="giro"></div>Cargando casos…</div>`;
    let E;
    try { E = await api.casosEstado(ctx.codigo()); } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`; return; }
    if (!E.codigo_propio) return pintarCodigo(v);
    const total = E.concursos.reduce((n, c) => n + lista(c).length, 0), listos = E.concursos.reduce((n, c) => n + lista(c).filter((p) => p.x).length, 0);
    v.innerHTML = `<div class="cabeza" style="margin-top:0"><div><h1>${I.candado} Casos confidenciales</h1>
        <p>Sube el <b>Caso</b> de cada concurso (PDF o Word, máx. 25 MB), que resuelven los equipos, y en <b>Amateur I y II</b> también la <b>Resolución</b>, que <b>solo ven los jurados</b> (IATHON no lleva resolución: la solución la crean los equipos). <b>Nadie más los puede abrir</b> hasta que se pulse <b>«Iniciar tiempo»</b> el día del concurso. Si el administrador los abre antes para verificar, quedará en el registro.</p></div>
        <span class="chip ${listos === total ? "chip--verde" : "chip--ambar"}" style="font-size:.9rem">${listos} de ${total} archivos subidos</span></div>
      <div class="cs-grid">${E.concursos.map(tarjeta).join("")}</div>
      <p class="ayuda">Encargadas con este permiso: ${esc((E.encargadas || []).join(", "))}. Tu código es privado: guárdalo bien; el administrador no lo ve.</p>`;
    $$("[data-subir]", v).forEach((inp) => (inp.onchange = () => subir(inp, v)));
    $$("[data-ver]", v).forEach((b) => { const [c, pt] = b.dataset.ver.split("|"); b.onclick = () => abrirCaso(ctx.codigo(), c, { parte: pt }); });
    $$("[data-quitar]", v).forEach((b) => (b.onclick = async () => {
      const [c, pt] = b.dataset.quitar.split("|");
      if (!(await confirmar(`¿Quitar ${pt === "caso" ? "el caso" : "la resolución"} de ${nom(c)}?`, "Se borra el archivo. Puedes subir otro después.", { boton: "Quitar", peligro: true }))) return;
      try { await api.casoQuitar(ctx.codigo(), c, pt); aviso("Archivo quitado"); vista(v); } catch (e) { aviso(e.message, "error"); }
    }));
  }
  const bloque = (c, pt, x) => `<div class="cs-parte ${x ? "cs-parte--ok" : ""}">
      <div class="cs-parte__cab"><b>${PARTES[pt].largo}</b><small>${PARTES[pt].quien}</small>${x ? `<span class="chip chip--verde">${I.check} Subido</span>` : `<span class="chip chip--ambar">Falta</span>`}</div>
      ${x ? `<div class="cs-arch"><span class="cs-ico ${pt === "solucion" ? "cs-ico--sol" : ""}">${x.tipo === "pdf" ? "PDF" : "DOC"}</span><div><b>${esc(x.nombre || PARTES[pt].largo)}</b><small>${esc(peso(x.tamano))} · ${esc(fecha(x.fecha))}${x.subido_por ? ` · ${esc(x.subido_por)}` : ""}</small></div></div>` : ""}
      <div class="cs-acc">
        ${c.liberado ? "" : `<label class="btn btn--mini ${x ? "" : "btn--naranja"}" style="cursor:pointer">${I.descargar}${x ? "Reemplazar" : `Subir ${PARTES[pt].txt.toLowerCase()}`}<input type="file" hidden accept=".pdf,.doc,.docx" data-subir="${c.concurso_id}|${pt}"></label>`}
        ${x ? `<button class="btn btn--mini" data-ver="${c.concurso_id}|${pt}">${I.libro}Ver</button>` : ""}
        ${x && !c.liberado ? `<button class="btn btn--peligro btn--mini" data-quitar="${c.concurso_id}|${pt}">${I.basura}Quitar</button>` : ""}
      </div>
      <div class="cs-barra" data-barra="${c.concurso_id}|${pt}" hidden><i></i></div>
      ${x ? htmlRegistro(x.vistas) : ""}
    </div>`;
  const tarjeta = (c) => { const ps = lista(c), ok = ps.filter((p) => p.x).length;
    return `<section class="tarjeta cs-card ${ok === ps.length ? "cs-card--ok" : ""}">
      <div class="cs-card__cab"><b>${esc(nom(c.concurso_id))}</b>${c.liberado ? `<span class="chip chip--verde">Liberado · el concurso empezó</span>` : `<span class="chip ${ok === ps.length ? "chip--verde" : "chip--ambar"}">${ok} de ${ps.length}</span>`}</div>
      ${ps.map((p) => bloque(c, p.pt, p.x)).join("")}
    </section>`; };
  async function subir(inp, v) {
    const f = inp.files?.[0], [c, pt] = inp.dataset.subir.split("|"); if (!f) return;
    if (!/\.(pdf|docx?)$/i.test(f.name)) return aviso("Debe ser un PDF o un Word (.pdf, .docx o .doc)", "error");
    if (f.size > 26214400) return aviso("El archivo debe pesar como máximo 25 MB", "error");
    const barra = $(`[data-barra="${c}|${pt}"]`, v); barra.hidden = false;
    try { await api.casoSubir(ctx.codigo(), c, pt, f, (p) => ($("i", barra).style.width = `${Math.round(p * 100)}%`)); aviso(`${PARTES[pt].largo} de ${nom(c)} subido`); vista(v); }
    catch (e) { barra.hidden = true; aviso(e.message, "error"); }
  }
  function pintarCodigo(v) {
    v.innerHTML = `<section class="tarjeta cs-privado">
      <div class="cs-privado__ico">${I.llave}</div>
      <h1>Primero crea tu código privado</h1>
      <p>Tú vas a subir los <b>casos confidenciales</b> y sus <b>resoluciones</b>. Para que <b>nadie más</b> (ni el administrador, que conoce tu código actual) pueda entrar con tu usuario, crea ahora un código que solo tú sepas. Desde ese momento entrarás con el nuevo código y el administrador ya no podrá verlo ni cambiarlo.</p>
      <form class="form" style="max-width:420px;margin:0 auto">
        <label class="campo"><span>Nuevo código (8 a 16 letras o números)</span><input name="a" type="password" autocomplete="new-password" maxlength="16" required style="font-family:var(--neon);letter-spacing:.15em;text-transform:uppercase"></label>
        <label class="campo"><span>Repítelo</span><input name="b" type="password" autocomplete="new-password" maxlength="16" required style="font-family:var(--neon);letter-spacing:.15em;text-transform:uppercase"></label>
        <label class="check" style="margin:0"><input type="checkbox" data-mostrar><span>Mostrar lo que escribo</span></label>
        <p class="error"></p>
        <button class="btn btn--naranja">${I.check}Guardar mi código privado</button></form></section>`;
    const f = $("form", v);
    $("[data-mostrar]", v).onchange = (e) => { f.a.type = f.b.type = e.target.checked ? "text" : "password"; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const a = f.a.value.replace(/\s/g, "").toUpperCase(), b = f.b.value.replace(/\s/g, "").toUpperCase();
      if (a !== b) { $(".error", f).textContent = "Los dos códigos no coinciden"; return; }
      try {
        await api.coordCambiarCodigo(ctx.codigo(), a);
        const s = sesion.leer(); if (s) sesion.guardar({ ...s, codigo: a });
        ctx.cambiarCodigo?.(a);
        aviso("Listo: desde ahora entra con tu nuevo código. Anótalo en un lugar seguro.");
        vista(v);
      } catch (ex) { $(".error", f).textContent = ex.message; }
    };
  }
  return { vista };
}

// ---------------- Alerta en Entregas (admin y coordinadores) ----------------
let cache = null, cacheT = 0;
export async function alertaCasos(v, codigo, esAdmin) {
  const ancla = $(".en-top", v); if (!ancla || $(".cs-alerta", v)) return;
  const caja = document.createElement("div"); caja.className = "cs-alerta"; ancla.before(caja);
  try { if (!cache || Date.now() - cacheT > 30000) { cache = await api.casosEstado(codigo); cacheT = Date.now(); } } catch { caja.remove(); return; }
  const E = cache, todos = E.concursos.flatMap((c) => lista(c).map((p) => ({ c, ...p }))), faltan = todos.filter((p) => !p.x);
  const encargadas = (E.encargadas || []).join(", ");
  caja.classList.add(faltan.length ? "cs-alerta--falta" : "cs-alerta--ok");
  caja.innerHTML = `<div class="cs-alerta__txt">${I.candado}<div>${!encargadas ? `<b>Casos confidenciales: aún no hay encargada.</b> Dale el permiso «Casos confidenciales» a la presidenta en Accesos limitados.`
      : faltan.length ? `<b>Casos confidenciales: faltan ${faltan.length} de ${todos.length} archivos</b> (${esc(faltan.map((p) => `${PARTES[p.pt].txt} de ${nom(p.c.concurso_id)}`).join(", "))}). Encargada: ${esc(encargadas)}.`
      : `<b>✓ La encargada ya subió los ${todos.length} archivos</b> (casos${esAdmin ? " y resoluciones de Amateur I y II" : ""}). Se abren solos al «Iniciar tiempo».`}</div></div>
    <div class="cs-alerta__lista">${E.concursos.map((c) => `<div class="cs-mini ${lista(c).every((p) => p.x) ? "cs-mini--ok" : ""}"><b>${esc(nom(c.concurso_id))}${c.liberado ? " · liberado" : ""}</b>
      ${lista(c).map(({ pt, x }) => `<div class="cs-mini__fila"><span>${x ? "✓" : "✗"} ${PARTES[pt].txt}</span>
        <small>${x ? `${esc(x.tipo === "pdf" ? "PDF" : "Word")} · ${esc(peso(x.tamano))} · ${esc(fecha(x.fecha))}${esAdmin && x.nombre ? ` · «${esc(x.nombre)}»` : ""}` : "Falta subir"}</small>
        ${esAdmin && x ? `<button class="btn btn--mini" data-cs-ver="${c.concurso_id}|${pt}">${I.libro}Verificar</button>${htmlRegistro(x.vistas)}` : ""}</div>`).join("")}</div>`).join("")}</div>`;
  $$("[data-cs-ver]", caja).forEach((b) => (b.onclick = async () => {
    const [cid, pt] = b.dataset.csVer.split("|"), c = E.concursos.find((x) => x.concurso_id === cid);
    if (!c.liberado && !(await confirmar(`¿Abrir ${pt === "caso" ? "el caso" : "la resolución"} antes del concurso?`, `Puedes abrirlo para verificar que sea el archivo correcto, pero <b>quedará registrado</b> («Administrador · antes del concurso») y la encargada lo verá en su panel.`, { boton: "Abrir y registrar" }))) return;
    cache = null; abrirCaso(codigo, cid, { parte: pt });
  }));
}

// ---------------- Tarjeta del equipo (solo el caso) ----------------
export async function htmlCasoEquipo(codigo, concurso) {
  if (!CONCURSOS_CASO.includes(concurso)) return "";
  let E; try { E = await api.casosEstado(codigo); } catch { return ""; }
  const c = E.concursos.find((x) => x.concurso_id === concurso), x = c?.partes?.caso; if (!x) return "";
  if (!c.liberado) return `<div class="cs-equipo cs-equipo--bloq">${I.candado}<div><b>Caso oficial</b><small>Aparecerá aquí en cuanto el organizador dé la señal de inicio.</small></div></div>`;
  return `<div class="cs-equipo"><span class="cs-ico">${x.tipo === "pdf" ? "PDF" : "DOC"}</span><div><b>Caso oficial · ${esc(nom(concurso))}</b><small>${esc(x.nombre || "")} · ${esc(peso(x.tamano))}</small></div>
    <div class="cs-acc">${x.tipo === "pdf" ? `<button class="btn btn--naranja" data-caso-ver="${concurso}">${I.libro}Ver caso</button>` : ""}<button class="btn ${x.tipo === "pdf" ? "" : "btn--naranja"}" data-caso-bajar="${concurso}">${I.descargar}Descargar</button></div></div>`;
}
export function enlazarCaso(caja, codigo) {
  $$("[data-caso-ver]", caja).forEach((b) => (b.onclick = () => abrirCaso(codigo, b.dataset.casoVer)));
  $$("[data-caso-bajar]", caja).forEach((b) => (b.onclick = () => abrirCaso(codigo, b.dataset.casoBajar, { descargar: true })));
}
export const casosDemo = ES_DEMO;

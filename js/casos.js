// =========================================================
// CASOS CONFIDENCIALES (Amateur I, Amateur II e IATHON)
//  · La encargada (acceso con permiso «casos», p. ej. la presidenta) crea su código privado y sube
//    el caso oficial (PDF o Word) de cada concurso. Lo puede reemplazar hasta «Iniciar tiempo».
//  · Equipos, jurados y coordinadores lo abren recién cuando empieza el concurso.
//  · El admin ve el estado y puede abrirlo para verificar, pero queda registrado («antes del concurso»).
// La base de datos decide todo (jur_casos_*); esto es solo la pantalla.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611091504";
import { porId } from "./concursos.js?v=202611091504";
import { $, $$, esc, I, aviso, confirmar } from "./ui.js?v=202611091504";
import { sesion } from "./app.js?v=202611091504";

export const CONCURSOS_CASO = ["iathon", "amateur-1", "amateur-2"];
const nom = (c) => porId(c)?.nombre || c;
const peso = (b) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
const fecha = (iso) => new Date(iso).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
const ROLES = { admin: "Administrador", encargada: "Encargada", equipo: "Equipo", jurado: "Jurado", coordinador: "Coordinador" };

// Abre (o descarga) el caso. La ventana se abre antes de pedir el enlace para que el navegador no la bloquee.
export async function abrirCaso(codigo, concurso, { descargar = false } = {}) {
  const w = descargar ? null : window.open("", "_blank");
  try {
    const r = await api.casoUrl(codigo, concurso, descargar);
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
    v.innerHTML = `<div class="cabeza" style="margin-top:0"><div><h1>${I.candado} Casos confidenciales</h1>
        <p>Sube el <b>caso oficial</b> de cada concurso (PDF o Word, máx. 25 MB). <b>Nadie más lo puede abrir</b> hasta que se pulse <b>«Iniciar tiempo»</b> el día del concurso; en ese momento les aparece a los equipos, jurados y coordinadores de ese concurso. Si el administrador lo abre antes para verificar, quedará en el registro.</p></div></div>
      <div class="cs-grid">${E.concursos.map((c) => tarjeta(c)).join("")}</div>
      <p class="ayuda">Encargadas con este permiso: ${esc((E.encargadas || []).join(", "))}. Tu código es privado: guárdalo bien; el administrador no lo ve.</p>`;
    $$("[data-subir]", v).forEach((inp) => (inp.onchange = () => subir(inp, v)));
    $$("[data-ver]", v).forEach((b) => (b.onclick = () => abrirCaso(ctx.codigo(), b.dataset.ver)));
    $$("[data-quitar]", v).forEach((b) => (b.onclick = async () => {
      if (!(await confirmar(`¿Quitar el caso de ${nom(b.dataset.quitar)}?`, "Se borra el archivo. Puedes subir otro después.", { boton: "Quitar", peligro: true }))) return;
      try { await api.casoQuitar(ctx.codigo(), b.dataset.quitar); aviso("Caso quitado"); vista(v); } catch (e) { aviso(e.message, "error"); }
    }));
  }
  const tarjeta = (c) => `<section class="tarjeta cs-card ${c.subido ? "cs-card--ok" : ""}">
      <div class="cs-card__cab"><b>${esc(nom(c.concurso_id))}</b>${c.liberado ? `<span class="chip chip--verde">Liberado · el concurso empezó</span>` : c.subido ? `<span class="chip chip--verde">${I.check} Subido</span>` : `<span class="chip chip--ambar">Falta subir</span>`}</div>
      ${c.subido ? `<div class="cs-arch"><span class="cs-ico">${c.tipo === "pdf" ? "PDF" : "DOC"}</span><div><b>${esc(c.nombre || "Caso oficial")}</b><small>${esc(peso(c.tamano))} · subido el ${esc(fecha(c.fecha))}${c.subido_por ? ` por ${esc(c.subido_por)}` : ""}</small></div></div>` : `<p class="tenue" style="margin:0">Aún no hay caso para este concurso.</p>`}
      <div class="cs-acc">
        ${c.liberado ? "" : `<label class="btn ${c.subido ? "" : "btn--naranja"}" style="cursor:pointer">${I.descargar}${c.subido ? "Reemplazar" : "Subir caso"}<input type="file" hidden accept=".pdf,.doc,.docx" data-subir="${c.concurso_id}"></label>`}
        ${c.subido ? `<button class="btn" data-ver="${c.concurso_id}">${I.libro}Ver</button>` : ""}
        ${c.subido && !c.liberado ? `<button class="btn btn--peligro btn--mini" data-quitar="${c.concurso_id}">${I.basura}Quitar</button>` : ""}
      </div>
      <div class="cs-barra" data-barra="${c.concurso_id}" hidden><i></i></div>
      ${c.subido ? htmlRegistro(c.vistas) : ""}
    </section>`;
  async function subir(inp, v) {
    const f = inp.files?.[0], c = inp.dataset.subir; if (!f) return;
    if (!/\.(pdf|docx?)$/i.test(f.name)) return aviso("El caso debe ser un PDF o un Word (.pdf, .docx o .doc)", "error");
    if (f.size > 26214400) return aviso("El archivo debe pesar como máximo 25 MB", "error");
    const barra = $(`[data-barra="${c}"]`, v); barra.hidden = false;
    try { await api.casoSubir(ctx.codigo(), c, f, (p) => ($("i", barra).style.width = `${Math.round(p * 100)}%`)); aviso(`Caso de ${nom(c)} subido`); vista(v); }
    catch (e) { barra.hidden = true; aviso(e.message, "error"); }
  }
  function pintarCodigo(v) {
    v.innerHTML = `<section class="tarjeta cs-privado">
      <div class="cs-privado__ico">${I.llave}</div>
      <h1>Primero crea tu código privado</h1>
      <p>Tú vas a subir los <b>casos confidenciales</b>. Para que <b>nadie más</b> (ni el administrador, que conoce tu código actual) pueda entrar con tu usuario, crea ahora un código que solo tú sepas. Desde ese momento entrarás con el nuevo código y el administrador ya no podrá verlo ni cambiarlo.</p>
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
  const E = cache, subidos = E.concursos.filter((c) => c.subido), faltan = E.concursos.filter((c) => !c.subido);
  const encargadas = (E.encargadas || []).join(", ");
  caja.classList.add(faltan.length ? "cs-alerta--falta" : "cs-alerta--ok");
  caja.innerHTML = `<div class="cs-alerta__txt">${I.candado}<div>${!encargadas ? `<b>Casos confidenciales: aún no hay encargada.</b> Dale el permiso «Casos confidenciales» a la presidenta en Accesos limitados.`
      : faltan.length ? `<b>Casos confidenciales: faltan ${faltan.length} de 3</b> (${esc(faltan.map((c) => nom(c.concurso_id)).join(", "))}). Encargada: ${esc(encargadas)}.`
      : `<b>✓ La encargada ya subió los 3 casos</b> (${esc(subidos.map((c) => nom(c.concurso_id)).join(", "))}). Se abren solos al «Iniciar tiempo».`}</div></div>
    <div class="cs-alerta__lista">${E.concursos.map((c) => `<div class="cs-mini ${c.subido ? "cs-mini--ok" : ""}"><b>${c.subido ? "✓" : "✗"} ${esc(nom(c.concurso_id))}</b>
      <small>${c.subido ? `${esc(c.tipo === "pdf" ? "PDF" : "Word")} · ${esc(peso(c.tamano))} · ${esc(fecha(c.fecha))}${esAdmin && c.nombre ? ` · «${esc(c.nombre)}»` : ""}${c.liberado ? " · liberado" : ""}` : "Falta subir"}</small>
      ${esAdmin && c.subido ? `<button class="btn btn--mini" data-cs-ver="${c.concurso_id}">${I.libro}Verificar</button>${htmlRegistro(c.vistas)}` : ""}</div>`).join("")}</div>`;
  $$("[data-cs-ver]", caja).forEach((b) => (b.onclick = async () => {
    const c = E.concursos.find((x) => x.concurso_id === b.dataset.csVer);
    if (!c.liberado && !(await confirmar("¿Abrir el caso antes del concurso?", `Puedes abrirlo para verificar que sea el archivo correcto, pero <b>quedará registrado</b> («Administrador · antes del concurso») y la encargada lo verá en su panel.`, { boton: "Abrir y registrar" }))) return;
    cache = null; abrirCaso(codigo, c.concurso_id);
  }));
}

// ---------------- Tarjeta del equipo / jurado ----------------
export async function htmlCasoEquipo(codigo, concurso) {
  if (!CONCURSOS_CASO.includes(concurso)) return "";
  let E; try { E = await api.casosEstado(codigo); } catch { return ""; }
  const c = E.concursos.find((x) => x.concurso_id === concurso); if (!c?.subido) return "";
  if (!c.liberado) return `<div class="cs-equipo cs-equipo--bloq">${I.candado}<div><b>Caso oficial</b><small>Aparecerá aquí en cuanto el organizador dé la señal de inicio.</small></div></div>`;
  return `<div class="cs-equipo"><span class="cs-ico">${c.tipo === "pdf" ? "PDF" : "DOC"}</span><div><b>Caso oficial · ${esc(nom(concurso))}</b><small>${esc(c.nombre || "")} · ${esc(peso(c.tamano))}</small></div>
    <div class="cs-acc">${c.tipo === "pdf" ? `<button class="btn btn--naranja" data-caso-ver="${concurso}">${I.libro}Ver caso</button>` : ""}<button class="btn ${c.tipo === "pdf" ? "" : "btn--naranja"}" data-caso-bajar="${concurso}">${I.descargar}Descargar</button></div></div>`;
}
export function enlazarCaso(caja, codigo) {
  $$("[data-caso-ver]", caja).forEach((b) => (b.onclick = () => abrirCaso(codigo, b.dataset.casoVer)));
  $$("[data-caso-bajar]", caja).forEach((b) => (b.onclick = () => abrirCaso(codigo, b.dataset.casoBajar, { descargar: true })));
}
export const casosDemo = ES_DEMO;

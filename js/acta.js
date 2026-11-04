// =========================================================
// Amateur I · Acta de constitución del proyecto (bases oficiales, punto 3.2):
// 10 secciones + firmas. Aquí está la estructura, el editor del equipo,
// el control de lo que falta y la vista de solo lectura (proyector y PDF).
// Datos: { lider, general:{}, proposito:{}, objetivos:[], requisitos:[], alcance:{}, riesgos:[],
//          hitos:[], presupuesto:[], interesados:[], gobernanza:{}, firmas:{ sponsor:{nombre,img}, director:{nombre,img} } }
// =========================================================
import { $, $$, esc, I } from "./ui.js?v=202611040040";

export const SECCIONES = [
  { id: "general", n: 1, titulo: "Información general", tipo: "campos", req: ["nombre", "sponsor", "director"], campos: [
    { k: "nombre", l: "Nombre del proyecto", ph: "Nombre corto y claro" },
    { k: "sponsor", l: "Patrocinador (Sponsor)", ph: "Persona u organización que financia y respalda" },
    { k: "director", l: "Director del proyecto asignado", ph: "Nombre y cargo" },
    { k: "fecha", l: "Fecha", ph: "dd/mm/aaaa" } ] },
  { id: "proposito", n: 2, titulo: "Propósito y justificación", tipo: "campos", req: ["problema", "justificacion"], campos: [
    { k: "problema", l: "Problemática nacional y su causa raíz", area: 3, ph: "¿Qué problema de la realidad nacional atiende y cuál es su causa raíz?" },
    { k: "justificacion", l: "Justificación y valor que genera", area: 3, ph: "Razones sociales / comerciales y el valor social o económico del proyecto" } ] },
  { id: "objetivos", n: 3, titulo: "Objetivos SMART y criterios de éxito", tipo: "lista", ini: 3, max: 8, req: ["objetivo", "indicador"], item: "objetivo", campos: [
    { k: "objetivo", l: "Objetivo SMART", area: 2, ph: "Específico, medible, alcanzable, relevante y con plazo", ancho: 2 },
    { k: "indicador", l: "Indicador / criterio de éxito", ph: "Ej. % de beneficiarios atendidos" },
    { k: "meta", l: "Meta", ph: "Ej. 80 %" },
    { k: "plazo", l: "Plazo", ph: "Ej. diciembre 2027" } ] },
  { id: "requisitos", n: 4, titulo: "Requisitos de alto nivel", tipo: "lista", ini: 3, max: 10, req: ["tipo", "requisito"], item: "requisito", campos: [
    { k: "tipo", l: "Tipo", sel: ["Técnico", "Funcional", "Calidad"] },
    { k: "requisito", l: "Requisito indispensable para la aprobación", area: 2, ancho: 3 } ] },
  { id: "alcance", n: 5, titulo: "Límites del proyecto (alcance preliminar)", tipo: "campos", req: ["incluye", "excluye"], campos: [
    { k: "incluye", l: "Incluye", area: 4, ph: "Lo que SÍ forma parte del proyecto" },
    { k: "excluye", l: "Excluye explícitamente", area: 4, ph: "Lo que NO forma parte del proyecto" } ] },
  { id: "riesgos", n: 6, titulo: "Riesgos de alto nivel", tipo: "lista", ini: 3, max: 10, req: ["tipo", "riesgo"], item: "riesgo", campos: [
    { k: "tipo", l: "Tipo", sel: ["Amenaza", "Oportunidad"] },
    { k: "riesgo", l: "Riesgo (amenaza u oportunidad inicial)", area: 2, ancho: 3 } ] },
  { id: "hitos", n: 7, titulo: "Cronograma de hitos principales", tipo: "lista", ini: 4, max: 12, req: ["hito", "fecha"], item: "hito", campos: [
    { k: "hito", l: "Hito", ph: "Ej. Aprobación del acta" },
    { k: "entregable", l: "Entregable clave", ph: "Ej. Acta firmada" },
    { k: "fecha", l: "Fecha", ph: "Ej. 15/03/2027 o Mes 2" } ] },
  { id: "presupuesto", n: 8, titulo: "Presupuesto estimado de alto nivel", tipo: "lista", ini: 4, max: 15, req: ["concepto", "monto"], item: "rubro", total: "monto", campos: [
    { k: "concepto", l: "Concepto / recurso", ancho: 2, ph: "Ej. Personal, equipos, materiales, contingencia" },
    { k: "monto", l: "Monto (S/)", num: true, ph: "0" } ] },
  { id: "interesados", n: 9, titulo: "Lista de interesados (stakeholders)", tipo: "lista", ini: 4, max: 15, req: ["nombre", "tipo", "rol"], item: "interesado", campos: [
    { k: "nombre", l: "Interesado (actor)", ph: "Ej. Municipalidad de…" },
    { k: "tipo", l: "Interno / externo", sel: ["Interno", "Externo"] },
    { k: "rol", l: "Rol en el proyecto", ph: "Ej. Financia, aprueba, usuario" },
    { k: "impacto", l: "Impacto", sel: ["Alto", "Medio", "Bajo"] } ] },
  { id: "gobernanza", n: 10, titulo: "Requisitos de aprobación y gobernanza", tipo: "campos", req: ["aprobacion", "autoridad"], campos: [
    { k: "aprobacion", l: "Criterios de aprobación (cuándo el proyecto se da por finalizado)", area: 3 },
    { k: "autoridad", l: "Nivel de autoridad del director del proyecto", area: 3, ph: "Decisiones que puede tomar: presupuesto, personal, cambios…" } ] },
  { id: "firmas", n: null, titulo: "Firmas de responsables", tipo: "firmas", campos: [
    { k: "sponsor", l: "Sponsor" }, { k: "director", l: "Director del proyecto" } ] },
];
const lleno = (v) => String(v ?? "").trim() !== "";
const usada = (f) => Object.values(f || {}).some(lleno);
const numero = (v) => { const x = Number(String(v ?? "").replace(/[^\d.,-]/g, "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
const soles = (x) => `S/ ${Number(x || 0).toLocaleString("es-PE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

// Completa la estructura (filas iniciales, objetos vacíos) sin perder lo escrito
export function normalizarActa(d = {}) {
  const o = { ...d, lider: d.lider || "" };
  for (const s of SECCIONES) {
    if (s.tipo === "campos") o[s.id] = { ...(d[s.id] || {}) };
    else if (s.tipo === "lista") { o[s.id] = Array.isArray(d[s.id]) ? d[s.id].map((f) => ({ ...f })) : []; while (o[s.id].length < s.ini) o[s.id].push({}); }
    else o[s.id] = { sponsor: { ...(d.firmas?.sponsor || {}) }, director: { ...(d.firmas?.director || {}) } };
  }
  return o;
}
// Lo que se guarda: sin filas vacías de sobra, pero con todo lo escrito
export function limpiarActa(d) {
  const o = normalizarActa(d);
  for (const s of SECCIONES) if (s.tipo === "lista") { const us = o[s.id].filter(usada); o[s.id] = us.length ? o[s.id] : []; }
  return o;
}

export function estadoSeccion(s, d) {
  const v = d?.[s.id];
  if (s.tipo === "campos") { const ok = s.req.every((k) => lleno(v?.[k])); return ok ? "completa" : s.campos.some((c) => lleno(v?.[c.k])) ? "parcial" : "vacia"; }
  if (s.tipo === "lista") { const us = (v || []).filter(usada); if (!us.length) return "vacia"; return us.every((f) => s.req.every((k) => lleno(f[k]))) ? "completa" : "parcial"; }
  const f = v || {}; const n = ["sponsor", "director"].filter((k) => f[k]?.img && lleno(f[k]?.nombre)).length;
  return n === 2 ? "completa" : n || lleno(f.sponsor?.nombre) || lleno(f.director?.nombre) || f.sponsor?.img || f.director?.img ? "parcial" : "vacia";
}

export function resumenActa(d) {
  const est = SECCIONES.map((s) => [s, estadoSeccion(s, d)]);
  return {
    proyecto: d?.general?.nombre || "", total: SECCIONES.length,
    completas: est.filter(([, e]) => e === "completa").length,
    faltan: est.filter(([, e]) => e !== "completa").map(([s]) => (s.n ? `${s.n}. ${s.titulo}` : s.titulo)),
    riesgos: (d?.riesgos || []).filter(usada).length,
    presupuesto: (d?.presupuesto || []).filter(usada).reduce((a, f) => a + numero(f.monto), 0),
    firmas: ["sponsor", "director"].filter((k) => d?.firmas?.[k]?.img).length,
    vacia: est.every(([, e]) => e === "vacia"),
  };
}

export function chipsActa(d) {
  const r = resumenActa(d);
  return `<span class="chip ${r.completas === r.total ? "chip--verde" : ""}">${r.completas}/${r.total} secciones completas</span>
    ${r.riesgos ? `<span class="chip">${r.riesgos} riesgo${r.riesgos === 1 ? "" : "s"}</span>` : ""}${r.presupuesto ? `<span class="chip">${soles(r.presupuesto)}</span>` : ""}
    <span class="chip ${r.firmas === 2 ? "chip--verde" : r.firmas ? "chip--ambar" : ""}">Firmas ${r.firmas}/2</span>`;
}

// ---------------- Editor del equipo ----------------
const ETQ = { completa: ["Completa", "chip--verde"], parcial: ["Incompleta", "chip--ambar"], vacia: ["Sin llenar", ""] };
const chipEstado = (s, d) => { const [t, c] = ETQ[estadoSeccion(s, d)]; return `<span class="chip ${c}" data-estado="${s.id}">${t}</span>`; };

function control(c, valor, ruta, dis) {
  const base = `data-a="${ruta}" ${dis}`;
  if (c.sel) return `<select ${base}><option value="">Elige…</option>${c.sel.map((x) => `<option ${x === valor ? "selected" : ""}>${x}</option>`).join("")}</select>`;
  if (c.area) return `<textarea ${base} rows="${c.area}" maxlength="2000" placeholder="${esc(c.ph || "")}">${esc(valor)}</textarea>`;
  return `<input ${base} maxlength="${c.num ? 14 : 300}" ${c.num ? 'inputmode="decimal"' : ""} value="${esc(valor)}" placeholder="${esc(c.ph || "")}">`;
}

export function editorActa(d, bl) {
  const dis = bl ? "disabled" : "";
  return `<div class="acta-ed">${SECCIONES.map((s) => {
    const cab = `<header class="acta-ed__cab"><span class="acta-ed__n">${s.n ?? "✍"}</span><h3>${esc(s.titulo)}</h3>${chipEstado(s, d)}</header>`;
    if (s.tipo === "campos") return `<section class="tarjeta acta-ed__sec" data-sec="${s.id}">${cab}<div class="acta-ed__campos">${s.campos.map((c) =>
      `<label class="campo ${c.area ? "acta-ed__ancho" : ""}"><span>${esc(c.l)}${s.req.includes(c.k) ? "" : " <small>(opcional)</small>"}</span>${control(c, d[s.id][c.k] || "", `${s.id}.${c.k}`, dis)}</label>`).join("")}</div></section>`;
    if (s.tipo === "lista") {
      const cols = s.campos.reduce((a, c) => a + (c.ancho || 1), 0);
      return `<section class="tarjeta acta-ed__sec" data-sec="${s.id}">${cab}
        <div class="acta-ed__filas">${d[s.id].map((f, i) => `<div class="acta-ed__fila" style="--cols:${cols}">
          <span class="acta-ed__i">${i + 1}</span>
          ${s.campos.map((c) => `<label class="campo" style="grid-column:span ${c.ancho || 1}"><span>${esc(c.l)}</span>${control(c, f[c.k] || "", `${s.id}.${i}.${c.k}`, dis)}</label>`).join("")}
          ${bl ? "" : `<button class="btn btn--mini btn--icono btn--peligro" data-aquitar="${s.id}.${i}" title="Quitar" aria-label="Quitar ${esc(s.item)} ${i + 1}">${I.basura}</button>`}
        </div>`).join("")}</div>
        <div class="acta-ed__pie">${bl ? "" : `<button class="btn btn--mini" data-amas="${s.id}" ${d[s.id].length >= s.max ? "disabled" : ""}>${I.mas}Agregar ${esc(s.item)}</button>`}
          ${s.total ? `<span class="acta-ed__total">Total estimado: <b data-total="${s.id}">${soles(d[s.id].reduce((a, f) => a + numero(f[s.total]), 0))}</b></span>` : ""}</div></section>`;
    }
    return `<section class="tarjeta acta-ed__sec" data-sec="firmas">${cab}
      <p class="ayuda" style="margin:0 0 10px">Los miembros designados del equipo firman como Sponsor y Director del proyecto. Firmen con el dedo o el mouse dentro del recuadro blanco.</p>
      <div class="acta-firmas">${s.campos.map((c) => `<div class="acta-firma">
        <div class="acta-firma__papel"><canvas data-firma="${c.k}" width="480" height="150" aria-label="Firma del ${esc(c.l)}"></canvas>${bl ? "" : `<button class="btn btn--mini" data-fborrar="${c.k}">Borrar firma</button>`}</div>
        <label class="campo"><span>${esc(c.l)} · nombre de quien firma</span><input data-a="firmas.${c.k}.nombre" maxlength="120" value="${esc(d.firmas[c.k].nombre || "")}" ${dis}></label>
      </div>`).join("")}</div></section>`;
  }).join("")}</div>`;
}

// Conecta el editor: cambio() guarda; repintar() vuelve a dibujar todo (al agregar/quitar filas)
export function enlazarActa(raiz, d, { cambio, repintar, bl }) {
  const set = (ruta, v) => { const p = ruta.split("."); let o = d; for (let i = 0; i < p.length - 1; i++) o = o[p[i]]; o[p.at(-1)] = v; };
  const refrescarSec = (id) => {
    const s = SECCIONES.find((x) => x.id === id), el = $(`[data-estado="${id}"]`, raiz);
    if (el) { const [t, c] = ETQ[estadoSeccion(s, d)]; el.textContent = t; el.className = `chip ${c}`; }
    if (s.total) { const t = $(`[data-total="${id}"]`, raiz); if (t) t.textContent = soles(d[id].reduce((a, f) => a + numero(f[s.total]), 0)); }
  };
  $$("[data-a]", raiz).forEach((el) => {
    el[el.tagName === "SELECT" ? "onchange" : "oninput"] = () => { set(el.dataset.a, el.value); refrescarSec(el.dataset.a.split(".")[0]); cambio(); };
  });
  $$("[data-amas]", raiz).forEach((b) => (b.onclick = () => { d[b.dataset.amas].push({}); cambio(); repintar(`[data-sec="${b.dataset.amas}"] .acta-ed__fila:last-child`); }));
  $$("[data-aquitar]", raiz).forEach((b) => (b.onclick = () => {
    const [id, i] = b.dataset.aquitar.split("."); d[id].splice(Number(i), 1);
    if (!d[id].length) d[id].push({}); cambio(); repintar(`[data-sec="${id}"]`);
  }));
  // Firmas: se dibujan en un lienzo blanco y se guardan como imagen
  $$("[data-firma]", raiz).forEach((cv) => {
    const k = cv.dataset.firma, ctx = cv.getContext("2d");
    const fondo = () => { ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height); ctx.strokeStyle = "#c9c4dc"; ctx.beginPath(); ctx.moveTo(24, cv.height - 30); ctx.lineTo(cv.width - 24, cv.height - 30); ctx.stroke(); };
    fondo();
    if (d.firmas[k].img) { const im = new Image(); im.onload = () => ctx.drawImage(im, 0, 0, cv.width, cv.height); im.src = d.firmas[k].img; }
    if (bl) return;
    let trazando = false, ultimo = null, dibujo = false;
    const pos = (e) => { const r = cv.getBoundingClientRect(); return [(e.clientX - r.left) * (cv.width / r.width), (e.clientY - r.top) * (cv.height / r.height)]; };
    cv.style.touchAction = "none";
    cv.onpointerdown = (e) => { trazando = true; ultimo = pos(e); cv.setPointerCapture(e.pointerId); };
    cv.onpointermove = (e) => {
      if (!trazando) return; const p = pos(e);
      ctx.strokeStyle = "#1d1b29"; ctx.lineWidth = 2.6; ctx.lineCap = "round"; ctx.lineJoin = "round";
      ctx.beginPath(); ctx.moveTo(...ultimo); ctx.lineTo(...p); ctx.stroke(); ultimo = p; dibujo = true;
    };
    const fin = () => { if (!trazando) return; trazando = false; if (dibujo) { d.firmas[k].img = cv.toDataURL("image/png"); refrescarSec("firmas"); cambio(); } dibujo = false; };
    cv.onpointerup = fin; cv.onpointercancel = fin; cv.onpointerleave = fin;
    const borrar = $(`[data-fborrar="${k}"]`, raiz);
    if (borrar) borrar.onclick = () => { fondo(); d.firmas[k].img = ""; refrescarSec("firmas"); cambio(); };
  });
}

// ---------------- Vista de solo lectura (proyector y PDF) ----------------
export function vistaActa(d0) {
  const d = normalizarActa(d0 || {});
  const r = resumenActa(d);
  if (r.vacia) return `<div class="vacio"><b>Todavía no hay nada escrito en el acta</b></div>`;
  const val = (v) => (lleno(v) ? esc(v).replace(/\n/g, "<br>") : `<i class="acta-v__vacio">—</i>`);
  return `<div class="acta-v">${SECCIONES.map((s) => {
    const est = estadoSeccion(s, d);
    const cab = `<h4><span>${s.n ?? "✍"}</span>${esc(s.titulo)}${est === "completa" ? "" : ` <em class="acta-v__falta">${est === "vacia" ? "sin llenar" : "incompleta"}</em>`}</h4>`;
    if (s.tipo === "campos") return `<section class="acta-v__sec acta-v__sec--${s.id}">${cab}<dl>${s.campos.map((c) => `<div><dt>${esc(c.l)}</dt><dd>${val(d[s.id][c.k])}</dd></div>`).join("")}</dl></section>`;
    if (s.tipo === "lista") {
      const filas = d[s.id].filter(usada);
      return `<section class="acta-v__sec acta-v__sec--${s.id}">${cab}${filas.length ? `<table><thead><tr><th>#</th>${s.campos.map((c) => `<th>${esc(c.l)}</th>`).join("")}</tr></thead><tbody>
        ${filas.map((f, i) => `<tr><td>${i + 1}</td>${s.campos.map((c) => `<td class="${c.num ? "n" : ""}">${c.num && lleno(f[c.k]) ? soles(numero(f[c.k])) : val(f[c.k])}</td>`).join("")}</tr>`).join("")}
        ${s.total ? `<tr class="acta-v__tot"><td></td><td>Total estimado</td><td class="n">${soles(filas.reduce((a, f) => a + numero(f[s.total]), 0))}</td></tr>` : ""}</tbody></table>` : `<p class="acta-v__vacio">Sin datos</p>`}</section>`;
    }
    return `<section class="acta-v__sec acta-v__sec--firmas">${cab}<div class="acta-v__firmas">${s.campos.map((c) => `<figure>
      ${d.firmas[c.k].img ? `<img src="${d.firmas[c.k].img}" alt="Firma del ${esc(c.l)}">` : `<div class="acta-v__sinfirma">Sin firma</div>`}
      <figcaption><b>${esc(d.firmas[c.k].nombre || "—")}</b><span>${esc(c.l)}</span></figcaption></figure>`).join("")}</div></section>`;
  }).join("")}</div>`;
}

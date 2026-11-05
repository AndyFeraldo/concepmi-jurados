// =========================================================
// IATHON · Ficha del MVP (bases oficiales, punto 3.2): el equipo registra su solución,
// el PROMPT MAESTRO y el LINK de su MVP funcional. En la exposición el proyector muestra
// la ficha con el link + QR y puede abrir el MVP dentro de la pantalla o en otra pestaña.
// Datos: { lider, solucion:{}, valor:{}, prompt:{}, mvp:{} }
// =========================================================
import { $, $$, esc, I } from "./ui.js?v=202611050052";

const IAS = ["ChatGPT", "Claude", "Gemini", "Perplexity", "Copilot", "DeepSeek", "Otra"];
export const SECCIONES_MVP = [
  { id: "solucion", n: 1, titulo: "Problema y solución", req: ["nombre", "problema"], campos: [
    { k: "nombre", l: "Nombre de la solución / MVP", ph: "Ej. AquaAlerta" },
    { k: "problema", l: "Problema de interés nacional y su causa raíz", area: 3, ph: "¿Qué problema del caso resuelven y cuál es su causa raíz?" } ] },
  { id: "valor", n: 2, titulo: "Propuesta de valor, viabilidad e innovación", req: ["propuesta"], campos: [
    { k: "propuesta", l: "Propuesta de valor", area: 3, ph: "¿Qué hace la solución y por qué resuelve la causa raíz?" },
    { k: "publico", l: "Usuarios o público objetivo", ph: "Ej. municipios rurales, familias…" },
    { k: "viabilidad", l: "Viabilidad e impacto", area: 2, ph: "Cómo se implementa, escala y se sostiene; a cuántas personas impacta" },
    { k: "innovacion", l: "Innovación y diferenciación", area: 2, ph: "Qué la hace distinta de lo que ya existe en el mercado" } ] },
  { id: "prompt", n: 3, titulo: "Prompt maestro", req: ["ia", "texto"], campos: [
    { k: "ia", l: "IA usada para generar el prompt maestro", sel: IAS },
    { k: "texto", l: "Prompt maestro (pégalo completo)", area: 8, max: 20000, ph: "El prompt optimizado que la IA redactó para construir el MVP" } ] },
  { id: "mvp", n: 4, titulo: "MVP funcional", req: ["link", "herramienta"], campos: [
    { k: "herramienta", l: "Herramienta o plataforma con la que construyeron el MVP", ph: "Ej. Lovable, v0, Bolt, Replit, Glide, Figma…" },
    { k: "link", l: "Link público del MVP (lo abren el proyector y los jurados)", url: true, ph: "https://…" },
    { k: "acceso", l: "Usuario y clave de prueba (si el MVP los pide)", ph: "Ej. demo@correo.com / 1234" },
    { k: "pasos", l: "Cómo probarlo (guía rápida para el jurado)", area: 2, ph: "Ej. 1) Entra como ciudadano 2) Reporta una fuga…" },
    { k: "presentacion", l: "Link de la presentación o pitch (opcional)", url: true, ph: "https://… (Canva, Google Slides…)" } ] },
];

const lleno = (v) => String(v ?? "").trim() !== "";
export const linkValido = (u) => /^https?:\/\/[^\s.]+\.[^\s]{2,}/i.test(String(u || "").trim());
const okCampo = (c, v) => lleno(v) && (!c.url || linkValido(v));

export function normalizarMvp(d = {}) {
  const o = { ...d, lider: d.lider || "" };
  for (const s of SECCIONES_MVP) o[s.id] = { ...(d[s.id] || {}) };
  return o;
}
export const limpiarMvp = (d) => normalizarMvp(d);

export function estadoSeccionMvp(s, d) {
  const v = d?.[s.id] || {};
  const ok = s.req.every((k) => okCampo(s.campos.find((c) => c.k === k), v[k]));
  return ok ? "completa" : s.campos.some((c) => lleno(v[c.k])) ? "parcial" : "vacia";
}
export function resumenMvp(d) {
  const est = SECCIONES_MVP.map((s) => [s, estadoSeccionMvp(s, d)]);
  const link = d?.mvp?.link || "";
  return {
    proyecto: d?.solucion?.nombre || "", total: SECCIONES_MVP.length,
    completas: est.filter(([, e]) => e === "completa").length,
    faltan: [...est.filter(([, e]) => e !== "completa").map(([s]) => `${s.n}. ${s.titulo}`), ...(lleno(link) && !linkValido(link) ? ["el link del MVP no es válido (debe empezar con https://)"] : [])],
    vacia: est.every(([, e]) => e === "vacia"), link, linkOk: linkValido(link),
  };
}
export function chipsMvp(d) {
  const r = resumenMvp(d);
  return `<span class="chip ${r.completas === r.total ? "chip--verde" : ""}">${r.completas}/${r.total} secciones completas</span>
    <span class="chip ${r.linkOk ? "chip--verde" : r.link ? "chip--rojo" : "chip--ambar"}">${r.linkOk ? "Link del MVP listo" : r.link ? "Link no válido" : "Sin link del MVP"}</span>`;
}
export const textoResumenMvp = (r) => `${r.completas} de ${r.total} secciones completas${r.linkOk ? " · link del MVP listo" : ` · <b style="color:#FFD98A">${r.link ? "revisa el link del MVP" : "falta el link del MVP"}</b>`}`;

// ---------------- Editor del equipo ----------------
const ETQ = { completa: ["Completa", "chip--verde"], parcial: ["Incompleta", "chip--ambar"], vacia: ["Sin llenar", ""] };
function control(c, valor, ruta, dis) {
  const base = `data-m="${ruta}" ${dis}`;
  if (c.sel) return `<select ${base}><option value="">Elige…</option>${c.sel.map((x) => `<option ${x === valor ? "selected" : ""}>${x}</option>`).join("")}</select>`;
  if (c.area) return `<textarea ${base} rows="${c.area}" maxlength="${c.max || 2000}" placeholder="${esc(c.ph || "")}">${esc(valor)}</textarea>`;
  return `<input ${base} ${c.url ? 'type="url" inputmode="url" autocapitalize="off" spellcheck="false"' : ""} maxlength="${c.url ? 600 : 300}" value="${esc(valor)}" placeholder="${esc(c.ph || "")}">`;
}
export function editorMvp(d, bl) {
  const dis = bl ? "disabled" : "";
  return `<div class="mvp-ed">${SECCIONES_MVP.map((s) => { const [t, cl] = ETQ[estadoSeccionMvp(s, d)];
    return `<section class="tarjeta acta-ed__sec" data-sec="${s.id}">
      <header class="acta-ed__cab"><span class="acta-ed__n">${s.n}</span><h3>${esc(s.titulo)}</h3><span class="chip ${cl}" data-estado="${s.id}">${t}</span></header>
      <div class="acta-ed__campos">${s.campos.map((c) => `<label class="campo ${c.area || c.url ? "acta-ed__ancho" : ""}"><span>${esc(c.l)}${s.req.includes(c.k) ? "" : " <small>(opcional)</small>"}</span>
        ${c.url ? `<div class="mvp-link">${control(c, d[s.id][c.k] || "", `${s.id}.${c.k}`, dis)}<a class="btn btn--mini" data-probar="${s.id}.${c.k}" target="_blank" rel="noopener" href="#">${I.flecha}Probar</a></div><small class="mvp-aviso" data-aviso="${s.id}.${c.k}"></small>`
          : control(c, d[s.id][c.k] || "", `${s.id}.${c.k}`, dis)}</label>`).join("")}</div>
      ${s.id === "mvp" ? `<p class="ayuda" style="margin:0">El link debe ser <b>público</b> (que abra sin pedir permiso). Pruébenlo con el botón <b>Probar</b>. Si su herramienta da un link de «vista previa» y otro de «publicar», usen el de publicar.</p>` : ""}
    </section>`; }).join("")}</div>`;
}
export function enlazarMvp(raiz, d, { cambio }) {
  const refrescar = (id) => { const s = SECCIONES_MVP.find((x) => x.id === id), el = $(`[data-estado="${id}"]`, raiz); if (el) { const [t, c] = ETQ[estadoSeccionMvp(s, d)]; el.textContent = t; el.className = `chip ${c}`; } };
  const avisoLink = (ruta) => {
    const [id, k] = ruta.split("."), v = String(d[id][k] || "").trim(), a = $(`[data-aviso="${ruta}"]`, raiz), p = $(`[data-probar="${ruta}"]`, raiz);
    if (p) { p.href = linkValido(v) ? v : "#"; p.classList.toggle("deshabilitado", !linkValido(v)); }
    if (a) a.innerHTML = !v ? "" : linkValido(v) ? `<span style="color:#8FF2C0">✓ Link válido</span>` : `<span style="color:#FFD98A">Debe empezar con https:// (copia el link completo desde el navegador)</span>`;
  };
  $$("[data-m]", raiz).forEach((el) => {
    el[el.tagName === "SELECT" ? "onchange" : "oninput"] = () => {
      const [id, k] = el.dataset.m.split("."); d[id][k] = el.value; refrescar(id);
      if (el.type === "url") avisoLink(el.dataset.m);
      cambio();
    };
  });
  $$("[data-probar]", raiz).forEach((p) => { avisoLink(p.dataset.probar); p.addEventListener("click", (e) => { if (p.getAttribute("href") === "#") e.preventDefault(); }); });
}

// ---------------- Vista de solo lectura (visor, proyector y PDF) ----------------
function qrSvg(texto) {
  try { if (!window.qrcode) return ""; const q = window.qrcode(0, "M"); q.addData(texto); q.make(); return q.createSvgTag({ cellSize: 6, margin: 1, scalable: true }); } catch { return ""; }
}
// opciones.embed: en el proyector agrega el botón para mostrar el MVP dentro de la pantalla
export function vistaMvp(d0, { embed = false } = {}) {
  const d = normalizarMvp(d0 || {}), r = resumenMvp(d);
  if (r.vacia) return `<div class="vacio"><b>Todavía no hay nada escrito en la ficha del MVP</b></div>`;
  const val = (v) => (lleno(v) ? esc(v).replace(/\n/g, "<br>") : `<i class="acta-v__vacio">—</i>`);
  const link = r.linkOk ? d.mvp.link.trim() : "";
  const pres = linkValido(d.mvp.presentacion) ? d.mvp.presentacion.trim() : "";
  return `<div class="mvp-v">
    <section class="mvp-v__link">
      <div class="mvp-v__qr">${link ? qrSvg(link) : ""}</div>
      <div class="mvp-v__dato"><small>MVP · ${esc(d.mvp.herramienta || "herramienta no indicada")}</small>
        <b>${esc(d.solucion.nombre || "Solución sin nombre")}</b>
        ${link ? `<a class="mvp-v__url" href="${esc(link)}" target="_blank" rel="noopener">${esc(link)}</a>` : `<span class="acta-v__falta">Sin link válido del MVP</span>`}
        ${d.mvp.acceso ? `<span class="mvp-v__acceso">Acceso de prueba: <b>${esc(d.mvp.acceso)}</b></span>` : ""}
        <div class="mvp-v__acc">${link ? `<a class="btn btn--naranja" href="${esc(link)}" target="_blank" rel="noopener">${I.flecha}Abrir MVP en otra pestaña</a>` : ""}
          ${link && embed ? `<button class="btn" data-mvp-embed="${esc(link)}">${I.vivo}Mostrar MVP aquí</button>` : ""}
          ${pres ? `<a class="btn" href="${esc(pres)}" target="_blank" rel="noopener">${I.pizarra}Presentación</a>` : ""}</div>
      </div>
    </section>
    ${embed ? `<div class="mvp-v__marco" data-mvp-marco hidden></div>` : ""}
    <div class="acta-v">${SECCIONES_MVP.filter((s) => s.id !== "mvp").map((s) => { const est = estadoSeccionMvp(s, d);
      return `<section class="acta-v__sec ${s.id === "prompt" ? "acta-v__sec--general" : ""}"><h4><span>${s.n}</span>${esc(s.titulo)}${est === "completa" ? "" : ` <em class="acta-v__falta">${est === "vacia" ? "sin llenar" : "incompleta"}</em>`}</h4>
        ${s.id === "prompt" ? `<p class="mvp-v__ia">IA: <b>${esc(d.prompt.ia || "—")}</b></p><pre class="mvp-v__prompt">${esc(d.prompt.texto || "—")}</pre>`
          : `<dl>${s.campos.map((c) => `<div><dt>${esc(c.l)}</dt><dd>${val(d[s.id][c.k])}</dd></div>`).join("")}</dl>`}</section>`; }).join("")}
      ${d.mvp.pasos ? `<section class="acta-v__sec acta-v__sec--general"><h4><span>4</span>Cómo probar el MVP</h4><p style="margin:0">${val(d.mvp.pasos)}</p></section>` : ""}
    </div></div>`;
}

// En el proyector: «Mostrar MVP aquí» abre el MVP dentro de la pantalla (si la página lo permite)
export function conectarEmbed(raiz) {
  $$("[data-mvp-embed]", raiz).forEach((b) => (b.onclick = () => {
    const marco = $("[data-mvp-marco]", raiz); if (!marco) return;
    if (!marco.hidden) { marco.hidden = true; marco.innerHTML = ""; b.innerHTML = `${I.vivo}Mostrar MVP aquí`; return; }
    marco.hidden = false; b.innerHTML = `${I.cerrar}Ocultar MVP`;
    marco.innerHTML = `<iframe src="${esc(b.dataset.mvpEmbed)}" title="MVP del equipo" allow="clipboard-write; fullscreen; microphone; camera" referrerpolicy="no-referrer"></iframe>
      <p class="mvp-v__nota">¿Se ve en blanco o dice «rechazó la conexión»? Algunas plataformas no permiten mostrarse dentro de otra página: usa <b>Abrir MVP en otra pestaña</b>.</p>`;
    marco.scrollIntoView({ behavior: "smooth", block: "start" });
  }));
}

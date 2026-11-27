// Becas para el EQUIPO ORGANIZADOR (Show en vivo → 4 · Premios).
// La lista sale de Certificados → Equipo organizador (guardada en este navegador) + los voluntarios del Día D
// (base de datos, solo admin). Se juntan sin repetir nombres. Dos formas:
//   · sortearOrg: elige al azar N personas (pueden repetir premios distintos, nunca el mismo premio).
//   · elegirOrg: el admin marca a quién darle el premio (ventana con buscador).
// Ambas guardan con jur_show_asignar_org (modo «sorteo» o «elegido»).
import { api } from "./api.js?v=202611271626";
import { $, $$, esc, I, aviso, modal, lanzarConfeti } from "./ui.js?v=202611271626";
import { AREAS_ORG } from "./certificados.js?v=202611271626";

const CERT = "concepmi-certificados-v2";
const limpio = (s) => String(s || "").trim().replace(/\s+/g, " ");
export const claveOrg = (nombre) => limpio(nombre).toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const areaTxt = (id) => AREAS_ORG.find((a) => a.id === id)?.corto || AREAS_ORG.find((a) => a.id === id)?.id || id || "";
const normArea = (t) => { const x = claveOrg(t); if (!x) return ""; const a = AREAS_ORG.find((a) => claveOrg(a.id) === x || claveOrg(a.txt) === x || claveOrg(a.corto) === x); return a ? a.id : limpio(t); };

// Lista de candidatos: [{ clave, nombre, area, cargo, telefono, fuentes: ["Certificados", "Día D"] }]
export async function candidatosOrg(codigo) {
  const mapa = new Map();
  const poner = (nombre, datos, fuente) => {
    const n = limpio(nombre); if (n.length < 2) return; const k = claveOrg(n);
    const o = mapa.get(k) || { clave: k, nombre: n, area: "", cargo: "", telefono: "", fuentes: [] };
    o.area ||= datos.area || ""; o.cargo ||= datos.cargo || ""; o.telefono ||= datos.telefono || "";
    if (!o.fuentes.includes(fuente)) o.fuentes.push(fuente); mapa.set(k, o);
  };
  try {
    const g = JSON.parse(localStorage.getItem(CERT)) || {};
    (g.organizadores || []).forEach((o) => poner([o.nombre, o.apellido, o.materno].filter(Boolean).join(" "), { area: normArea(o.area), cargo: o.cargo || "voluntario" }, "Certificados"));
  } catch { /* sin lista en este navegador */ }
  let diad = false;
  try {
    const d = await api.adminDiad(codigo); diad = true;
    (d.personas || []).forEach((k) => poner(limpio([k.nombres, k.paterno, k.materno].filter(Boolean).join(" ")) || k.nombre, { area: normArea(k.area), telefono: k.telefono || "" }, "Día D"));
  } catch { /* el Día D es solo del admin */ }
  return { lista: [...mapa.values()].sort((a, b) => a.nombre.localeCompare(b.nombre, "es")), diad };
}

// Quién del equipo ya ganó algo (para no repetir en el sorteo y avisar al elegir)
const yaGanaron = (S) => {
  const m = new Map();
  S.ganadores.filter((g) => !g.anulado && g.tipo === "organizador").forEach((g) => {
    const p = S.premios.find((x) => x.id === g.premio_id); const k = String(g.dni || "").replace(/^org:/, "") || claveOrg(g.nombre);
    m.set(k, [...(m.get(k) || []), { premio_id: g.premio_id, txt: p?.detalle || p?.titulo || "" }]);
  });
  return m;
};
const nomPremio = (S, p) => `${p.detalle || p.titulo || ""}${S.sponsors.find((s) => s.id === p.sponsor_id) ? ` · ${S.sponsors.find((s) => s.id === p.sponsor_id).nombre}` : ""}`;
const azar = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const r = new Uint32Array(1); crypto.getRandomValues(r); const j = r[0] % (i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const envio = (x) => ({ clave: x.clave, nombre: x.nombre, area: areaTxt(x.area), telefono: x.telefono });
const vacio = (diad) => `<div class="vacio"><b>No hay personas del equipo organizador</b>Carga la lista en <b>Certificados → Equipo organizador</b> (en esta misma computadora)${diad ? " o registra voluntarios en <b>Día D → Voluntarios</b>" : ""}.</div>`;

// 🎲 Sorteo al azar entre el equipo organizador
export async function sortearOrg({ codigo, S, premio, alTerminar }) {
  const p = S.premios.find((x) => x.id === premio); if (!p) return;
  const faltan = p.cantidad - p.sorteados; if (faltan <= 0) return;
  const { lista, diad } = await candidatosOrg(codigo); const ya = yaGanaron(S);
  const libres = lista.filter((x) => !(ya.get(x.clave) || []).some((y) => y.premio_id === p.id));
  const areas = [...new Set(libres.map((x) => x.area).filter(Boolean))];
  const m = modal(`<h2>🎲 Sortear para el equipo organizador</h2>
    <p class="ayuda" style="margin:0 0 10px">Premio: <b>${esc(nomPremio(S, p))}</b> · quedan <b>${faltan}</b> cupo${faltan === 1 ? "" : "s"}.</p>
    ${lista.length ? `<div class="sh-org-resumen"><b>${libres.length}</b> de ${lista.length} personas participan <small class="tenue">(se puede ganar más de un premio; solo no entran quienes ya tienen este mismo)</small></div>
    <form class="form">
      <label class="campo"><span>¿Cuántos ganadores?</span><input name="n" type="number" min="1" max="${Math.min(faltan, libres.length) || 1}" value="${Math.min(faltan, libres.length) || 1}"></label>
      ${areas.length > 1 ? `<label class="campo"><span>Solo de un área (opcional)</span><select name="area"><option value="">Todas las áreas</option>${areas.map((a) => `<option value="${esc(a)}">${esc(areaTxt(a))}</option>`).join("")}</select></label>` : ""}
      <label class="sh-org-check"><input type="checkbox" name="lider" checked> Incluir a los líderes</label>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja" ${libres.length ? "" : "disabled"}>🎲 Sortear</button></div></form>` : vacio(diad) + `<div class="modal__acciones"><button class="btn" data-cancelar>Cerrar</button></div>`}`);
  $("[data-cancelar]", m.el).onclick = m.cerrar;
  const f = $("form", m.el); if (!f) return;
  f.onsubmit = async (e) => {
    e.preventDefault();
    const pool = libres.filter((x) => (!f.area?.value || x.area === f.area.value) && (f.lider.checked || x.cargo !== "lider"));
    const n = Math.min(Number(f.n.value) || 0, faltan);
    if (n < 1) return ($(".error", f).textContent = "Elige al menos 1");
    if (pool.length < n) return ($(".error", f).textContent = `Solo hay ${pool.length} persona${pool.length === 1 ? "" : "s"} con esos filtros`);
    const elegidos = azar(pool).slice(0, n); $("button.btn--naranja", f).disabled = true;
    try {
      await api.showAsignarOrg(codigo, p.id, elegidos.map(envio), "sorteo");
      m.cerrar(); lanzarConfeti();
      const mm = modal(`<h2>🎉 ¡Ganadores del equipo organizador!</h2><p class="ayuda" style="margin:0 0 8px">${esc(nomPremio(S, p))}</p>
        <ol class="sh-org-ganadores">${elegidos.map((x) => `<li><b>${esc(x.nombre)}</b>${x.area ? ` <small class="tenue">· ${esc(areaTxt(x.area))}</small>` : ""}</li>`).join("")}</ol>
        <div class="modal__acciones"><button class="btn btn--naranja" data-ok>${I.check}Listo</button></div>`);
      $("[data-ok]", mm.el).onclick = mm.cerrar;
      await alTerminar?.();
    } catch (ex) { $(".error", f).textContent = ex.message; $("button.btn--naranja", f).disabled = false; }
  };
}

// ✋ Elegir a mano a quién darle el premio
export async function elegirOrg({ codigo, S, premio, alTerminar }) {
  const p = S.premios.find((x) => x.id === premio); if (!p) return;
  const faltan = p.cantidad - p.sorteados; if (faltan <= 0) return;
  const { lista, diad } = await candidatosOrg(codigo); const ya = yaGanaron(S);
  const marcados = new Set(); let busca = "";
  const m = modal(`<h2>✋ Elegir del equipo organizador</h2>
    <p class="ayuda" style="margin:0 0 10px">Premio: <b>${esc(nomPremio(S, p))}</b> · puedes elegir hasta <b>${faltan}</b> persona${faltan === 1 ? "" : "s"}.</p>
    ${lista.length ? `<input class="log-buscar" data-org-buscar placeholder="Buscar por nombre o área…" style="width:100%;margin-bottom:8px">
    <div class="sh-org-lista" data-org-lista></div>
    <p class="error"></p>
    <div class="modal__acciones"><span class="tenue" data-org-cuenta style="margin-right:auto"></span><button class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja" data-org-dar disabled>🎁 Dar premio</button></div>`
      : vacio(diad) + `<div class="modal__acciones"><button class="btn" data-cancelar>Cerrar</button></div>`}`, { ancho: true });
  $("[data-cancelar]", m.el).onclick = m.cerrar;
  if (!lista.length) return;
  const caja = $("[data-org-lista]", m.el);
  const pintar = () => {
    const q = claveOrg(busca);
    const vis = lista.filter((x) => !q || x.clave.includes(q) || claveOrg(areaTxt(x.area)).includes(q));
    caja.innerHTML = vis.map((x) => { const g = ya.get(x.clave) || [], mismo = g.some((y) => y.premio_id === p.id), lleno = !marcados.has(x.clave) && marcados.size >= faltan;
      return `<label class="sh-org-fila ${marcados.has(x.clave) ? "sh-org-fila--si" : ""} ${mismo ? "sh-org-fila--no" : ""}">
        <input type="checkbox" data-org="${esc(x.clave)}" ${marcados.has(x.clave) ? "checked" : ""} ${mismo || lleno ? "disabled" : ""}>
        <span><b>${esc(x.nombre)}</b><small>${[x.area ? areaTxt(x.area) : "", x.cargo === "lider" ? "Líder" : "", x.fuentes.join(" + ")].filter(Boolean).map(esc).join(" · ")}</small></span>
        ${mismo ? `<span class="chip">ya tiene este premio</span>` : g.length ? `<span class="chip chip--ambar" title="${esc(g.map((y) => y.txt).join(", "))}">ya ganó ${g.length}</span>` : ""}</label>`; }).join("") || `<p class="tenue" style="padding:10px">Nadie coincide con «${esc(busca)}».</p>`;
    $$("[data-org]", caja).forEach((c) => (c.onchange = () => { c.checked ? marcados.add(c.dataset.org) : marcados.delete(c.dataset.org); pintar(); }));
    $("[data-org-cuenta]", m.el).textContent = `${marcados.size} de ${faltan} elegido${faltan === 1 ? "" : "s"}`;
    $("[data-org-dar]", m.el).disabled = !marcados.size;
  };
  $("[data-org-buscar]", m.el).oninput = (e) => { busca = e.target.value; pintar(); };
  pintar();
  $("[data-org-dar]", m.el).onclick = async (e) => {
    const elegidos = lista.filter((x) => marcados.has(x.clave)); e.target.disabled = true;
    try {
      await api.showAsignarOrg(codigo, p.id, elegidos.map(envio), "elegido");
      m.cerrar(); lanzarConfeti();
      aviso(`🎁 Premio entregado a ${elegidos.length === 1 ? elegidos[0].nombre : `${elegidos.length} personas del equipo`}`, "ok");
      await alTerminar?.();
    } catch (ex) { $(".error", m.el).textContent = ex.message; e.target.disabled = false; }
  };
}

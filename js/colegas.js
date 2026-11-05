// =========================================================
// COLEGAS: en el panel del jurado y del tallerista, quiénes son los demás jurados y
// talleristas (foto, nombre, descripción y LinkedIn), primero los de su propio concurso
// o taller y luego el resto, agrupados por concurso / evento cultural / taller.
// =========================================================
import { api } from "./api.js?v=202611051441";
import { CONCURSOS } from "./concursos.js?v=202611051441";
import { TALLERES } from "./talleres.js?v=202611051441";
import { $$, esc, I, avatar } from "./ui.js?v=202611051441";

// Normaliza «linkedin.com/in/maria» → «https://linkedin.com/in/maria»
export const enlaceLinkedin = (u) => { const t = String(u || "").trim(); if (!t) return ""; return /^https?:\/\//i.test(t) ? t : `https://${t.replace(/^\/+/, "")}`; };
const ICONO_IN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28zM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13zM7.12 20.45H3.56V9h3.56v11.45zM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0z"/></svg>`;

function tarjeta(p, yo) {
  const li = enlaceLinkedin(p.linkedin);
  return `<article class="colega ${p.id === yo ? "colega--yo" : ""}">
    <div class="colega__cab">${avatar(p.nombre, p.foto)}<div><b>${esc(p.nombre)}</b>${p.id === yo ? `<span class="chip chip--ambar">Tú</span>` : ""}</div></div>
    ${p.descripcion ? `<p class="colega__desc">${esc(p.descripcion)}</p>` : ""}
    ${li ? `<a class="btn btn--mini colega__in" href="${esc(li)}" target="_blank" rel="noopener noreferrer">${ICONO_IN}Ver LinkedIn</a>` : `<span class="colega__sin">Sin LinkedIn registrado</span>`}
  </article>`;
}

// grupos: [{ titulo, sub, personas, propio }]
function htmlGrupos(grupos, yo) {
  return grupos.filter((g) => g.personas.length).map((g) => `<section class="colegas__grupo ${g.propio ? "colegas__grupo--propio" : ""}">
    <h3>${g.propio ? `${I.copa} ` : ""}${esc(g.titulo)} <small>${esc(g.sub)} · ${g.personas.length}</small></h3>
    <div class="colegas__grid">${g.personas.map((p) => tarjeta(p, yo)).join("")}</div></section>`).join("")
    || `<div class="vacio"><b>Aún no hay colegas registrados</b>El organizador los irá agregando.</div>`;
}

// quien: { rol: "jurado" | "tallerista", concursos?: [...], talleres?: [...] }
export async function pintarColegas(caja, codigo, quien) {
  caja.innerHTML = `<div class="cargando" style="min-height:120px"><div class="giro"></div>Cargando colegas…</div>`;
  let d;
  try { d = await api.colegas(codigo); } catch (e) { caja.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`; return; }
  const porConcurso = (c) => d.jurados.filter((j) => j.concursos.includes(c.id));
  const porTaller = (t) => d.talleristas.filter((x) => x.talleres.includes(t.id));
  const conJurado = CONCURSOS.filter((c) => c.jurados > 0);
  const mios = quien.rol === "jurado" ? conJurado.filter((c) => quien.concursos.includes(c.id)) : [];
  const misTalleres = quien.rol === "tallerista" ? TALLERES.filter((t) => quien.talleres.includes(t.id)) : [];
  const grupoC = (c, propio) => ({ titulo: c.nombre, sub: propio ? "Tu concurso" : c.tipo === "academico" ? "Concurso académico" : "Evento cultural", personas: porConcurso(c), propio });
  const grupoT = (t, propio) => ({ titulo: `Taller ${t.num} · ${t.nombre}`, sub: propio ? "Tu taller" : "Taller", personas: porTaller(t), propio });
  const otros = conJurado.filter((c) => !mios.includes(c));
  const grupos = [
    ...mios.map((c) => grupoC(c, true)), ...misTalleres.map((t) => grupoT(t, true)),
    ...otros.filter((c) => c.tipo === "academico").map((c) => grupoC(c, false)),
    ...otros.filter((c) => c.tipo !== "academico").map((c) => grupoC(c, false)),
    ...TALLERES.filter((t) => !misTalleres.includes(t)).map((t) => grupoT(t, false)),
  ];
  const n = new Set([...d.jurados.map((x) => x.id), ...d.talleristas.map((x) => x.id)]).size;
  caja.innerHTML = `<p class="ayuda" style="margin:0 0 12px">${n} jurados y talleristas del VI CONCEPMI. Arriba, los de ${quien.rol === "jurado" ? "tu concurso" : "tu taller"}. Pulsa «Ver LinkedIn» para conectar con ellos.</p>${htmlGrupos(grupos, d.yo)}`;
  $$(".colega__in", caja).forEach((a) => a.addEventListener("click", (e) => e.stopPropagation()));
}

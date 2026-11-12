// =========================================================
// «Mi acceso»: pantalla de inicio de quien entra con un acceso limitado. Le explica, en tarjetas,
// todo lo que el administrador le habilitó (qué puede EDITAR, qué puede solo VER) y lo lleva ahí.
//   destinos: { areaId | "entregas" | "proyeccion" | "casos" | "guia": función que abre esa parte }
// =========================================================
import { AREAS, nivel } from "./permisos.js?v=202611120128";
import { ENTREGABLES } from "./entregables.js?v=202611120128";
import { porId } from "./concursos.js?v=202611120128";
import { $$, esc, I } from "./ui.js?v=202611120128";

const ICONO = { vivo: "vivo", resultados: "tabla", copa: "copa", jurados: "personas", talleristas: "pizarra", charlas: "vivo", delegaciones: "bandera", logistica: "caja", proyeccion: "pizarra", casos: "candado", diad: "reloj" };
// Lo que encuentra en cada pestaña, dicho en simple
const QUE_HAY = {
  vivo: "El avance de cada concurso en tiempo real y las últimas calificaciones.",
  resultados: "Las tablas de resultados de cada concurso, con el detalle por jurado.",
  copa: "La tabla general de la Copa CONCEPMI, la ceremonia de premiación y el Excel.",
  jurados: "Quiénes son los jurados: foto, perfil, LinkedIn y a qué concursos van. También los que faltan por concurso.",
  talleristas: "Los 4 talleres: sus talleristas, si ya subieron su presentación (PDF) y el botón Proyectar; también los equipos ganadores.",
  charlas: "Las 3 charlas magistrales, sus ponentes (pestaña Ponentes), las trivias, preguntas y podios.",
  delegaciones: "La lista de delegaciones (universidades) participantes.",
  logistica: "El presupuesto, los gastos, comprobantes, proveedores y el reporte.",
};

export function htmlMiAcceso(k) {
  const concursos = (k.concursos || []).filter((x) => ENTREGABLES[x]);
  const areas = AREAS.filter((a) => !a.unico && !a.guia && !a.aparte);
  const con = areas.filter((a) => nivel(k, a.id)), sin = areas.filter((a) => !nivel(k, a.id));
  const edita = con.filter((a) => nivel(k, a.id) === "editar"), ve = con.filter((a) => nivel(k, a.id) === "ver");
  const tarjeta = (dest, ico, titulo, chip, clsChip, texto, extra = "") => `<button class="ma-card ma-card--${clsChip}" data-ma="${dest}">
      <span class="ma-card__ico">${I[ico] || ""}</span>
      <span class="ma-card__txt"><b>${esc(titulo)}</b><span class="chip chip--${clsChip === "edita" ? "ambar" : clsChip === "ve" ? "celeste" : "verde"}">${chip}</span><small>${texto}</small>${extra}</span>
      <span class="ma-card__ir">Abrir ${I.flecha}</span></button>`;
  const deArea = (a) => { const ed = nivel(k, a.id) === "editar";
    return tarjeta(a.id, ICONO[a.id], a.txt, ed ? "✏️ Puedes editar" : "👁 Solo ver", ed ? "edita" : "ve", esc(QUE_HAY[a.id] || a.ver),
      `<small class="ma-card__puede">${ed ? `<b>Puedes:</b> ${esc(a.editar || a.ver)}.` : "<b>No puedes hacer cambios</b> aquí; los botones de editar están ocultos."}</small>`); };
  const especiales = [
    ...concursos.map((c) => tarjeta(`entregas:${c}`, "lapiz", `Entregas · ${porId(c)?.nombre || c}`, "✏️ Coordinas la sala", "edita",
      "Los equipos de este concurso, sus códigos, el tiempo oficial («Iniciar tiempo») y la pantalla para proyectar.", `<small class="ma-card__puede"><b>Puedes:</b> crear equipos, iniciar y detener el tiempo, reabrir entregas y proyectar. No aplicas sanciones.</small>`)),
    nivel(k, "casos") ? tarjeta("casos", "candado", "Casos confidenciales", "🔒 Solo tú", "edita", "Subes el caso oficial (y la resolución) de Amateur I, Amateur II e IATHON.", `<small class="ma-card__puede">Nadie más los abre antes de «Iniciar tiempo».</small>`) : "",
    nivel(k, "proyeccion") ? tarjeta("proyeccion", "pizarra", "Panel de Proyección", "▶ Proyectar", "extra", "Para la laptop del auditorio: ceremonias, charlas, trivia y concursos en pantalla grande.", `<small class="ma-card__puede">Se abre aparte; con «Volver a mi panel» regresas aquí.</small>`) : "",
    tarjeta("guia", "reloj", "Mi Día D", "📋 Tu guía", "extra", "Qué te toca el 24 y 26 de noviembre: a qué hora llegar, dónde, con quién y qué hacer."),
  ].filter(Boolean);
  return `<div class="ma">
    <section class="ma-hola tarjeta"><div><small>Tu acceso al Panel Maestro · VI CONCEPMI 2026</small><h1>Hola, ${esc((k.nombre || "").split(/[\s-]+/)[0] || "equipo")} 👋</h1>
      <p>Esto es <b>todo lo que el organizador te habilitó</b>. Toca una tarjeta para abrirla, o usa las pestañas de arriba.</p></div>
      <div class="ma-resumen"><div><b>${edita.length + concursos.length + (nivel(k, "casos") ? 1 : 0)}</b><span>puedes editar</span></div><div><b>${ve.length}</b><span>solo ver</span></div></div></section>
    ${edita.length ? `<h2 class="ma-tit ma-tit--edita">✏️ Aquí puedes ver y hacer cambios</h2><div class="ma-grid">${edita.map(deArea).join("")}</div>` : ""}
    ${ve.length ? `<h2 class="ma-tit ma-tit--ve">👁 Aquí puedes mirar (sin cambiar nada)</h2><div class="ma-grid">${ve.map(deArea).join("")}</div>` : ""}
    <h2 class="ma-tit">${concursos.length || nivel(k, "casos") || nivel(k, "proyeccion") ? "⭐ Tus funciones especiales" : "📋 Tu guía del evento"}</h2><div class="ma-grid">${especiales.join("")}</div>
    ${sin.length ? `<p class="ma-sin">${I.candado}<span><b>No tienes acceso a:</b> ${esc(sin.map((a) => a.txt).join(", "))}${concursos.length ? "" : ", Entregas"}. Si lo necesitas, pídeselo al organizador.</span></p>` : ""}
  </div>`;
}
export function enlazarMiAcceso(caja, destinos) {
  $$("[data-ma]", caja).forEach((b) => (b.onclick = () => { const [d, extra] = b.dataset.ma.split(":"); destinos[d]?.(extra); }));
}
export function crearMiAcceso(k, destinos) { return { vista: (v) => { v.innerHTML = htmlMiAcceso(k); enlazarMiAcceso(v, destinos); window.scrollTo(0, 0); } }; }

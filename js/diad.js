// =========================================================
// DÍA D: quién hace qué, dónde y a qué hora el día del evento.
//  · Pestaña «Día D» del admin: cronograma de tareas por día y momento (inauguración,
//    charlas, talleres, concursos, escenario…), personas asignadas, datos generales.
//  · Las personas son los ACCESOS LIMITADOS (los mismos de Entregas → Accesos limitados).
//    Si alguien no está, se crea aquí como «voluntario» (permiso diad = solo su guía).
//  · Guía personal: cada persona entra con su código (botón «Voluntarios» de la portada o
//    su panel) y ve qué le toca, a qué hora llegar, dónde, con quién y qué hacer.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611120159";
import { CONCURSOS, porId } from "./concursos.js?v=202611120159";
import { TALLERES } from "./talleres.js?v=202611120159";
import { CHARLAS } from "./charlas.js?v=202611120159";
import { ENTREGABLES } from "./entregables.js?v=202611120159";
import { importarExcel } from "./certificados.js?v=202611120159";
import { AREAS, nivel } from "./permisos.js?v=202611120159";
import { $, $$, esc, I, IMG, aviso, modal, confirmar } from "./ui.js?v=202611120159";

export const DIAS = {
  d1: { txt: "Día 1 · Martes 24 de noviembre", num: "Día 1", largo: "Martes 24 de noviembre", corto: "Mar 24/11", fecha: "2026-11-24" },
  d2: { txt: "Día 2 · Jueves 26 de noviembre", num: "Día 2", largo: "Jueves 26 de noviembre", corto: "Jue 26/11", fecha: "2026-11-26" },
};
export const TIPOS = {
  academico: { txt: "Académico", cls: "dd-t--a" },
  cultural: { txt: "Cultural", cls: "dd-t--c" },
  escenario: { txt: "Escenario", cls: "dd-t--e" },
  general: { txt: "General", cls: "dd-t--g" },
};
export const AREAS_ORG = ["DP", "PMO", "Ventas", "RRPP", "Marketing", "Logística", "TI"];

// Indicaciones sugeridas por función (se pueden editar en cada tarea)
const GUIAS = {
  "Coordinador de sala": "Abre el Panel Maestro con tu código (botón Admin o Voluntarios) → pestaña Entregas de tu concurso. Antes de empezar: revisa que cada delegación tenga su código impreso, que haya internet y que la laptop del proyector esté lista. Reparte los códigos, pulsa «Iniciar tiempo» SOLO cuando el organizador dé la señal y vigila que cada equipo use una sola laptop. Al terminar, confirma que todos enviaron y avisa al organizador.",
  "Apoyo de sala": "Ayuda al coordinador de sala: recibe a las delegaciones, ubícalas en su sitio, reparte materiales y lleva el control de asistencia. Ante cualquier problema técnico, avisa de inmediato al coordinador.",
  "Control de tiempo y turnos": "Lleva el orden de turnos (sorteo oficial) y avisa al siguiente equipo con 2 minutos de anticipación. Muestra los carteles de tiempo (1 min / tiempo) al expositor.",
  "Apoyo a jurados": "Recibe a los jurados, ubícalos en su mesa, verifica que puedan entrar al Panel Maestro con su código y llévales agua. Si alguno no puede calificar, avisa al coordinador.",
  "Micrófonos": "Ten listos los micrófonos (con pilas de repuesto) antes de empezar. Entrega el micrófono a cada persona que habla y recógelo al terminar. En la ronda de preguntas, lleva el micrófono al público.",
  "Apoyo al ponente": "Recibe al ponente en la entrada, acompáñalo al auditorio, verifica con Proyección que su presentación esté cargada, ofrécele agua y avísale los tiempos (10 min, 5 min, final).",
  "Protocolo y recepción de invitados": "Recibe a las autoridades e invitados especiales, guíalos a sus asientos reservados (primera fila) y avisa al maestro de ceremonias cuando estén ubicados.",
  "Coordinador de escenario": "Coordina todo lo que pasa en el escenario: orden del programa, quién sube y baja, micrófonos y señales con Proyección. Ten el programa impreso a la mano.",
  "Proyección (laptop del auditorio)": "Abre el Panel Maestro con tu código de Proyección en la laptop del auditorio. Prueba el proyector, el sonido y el puntero 20 minutos antes. Sigue las señales del coordinador de escenario.",
  "Registro y acreditación": "Ubícate en la mesa de registro, verifica el DNI o el código de cada asistente, entrega credencial y merch, y orienta hacia el auditorio.",
  "Apoyo de taller": "Recibe a los asistentes del taller, controla el aforo (máx. 40), ayuda al tallerista con materiales y recuérdale registrar al equipo ganador en el Panel Maestro al final.",
  "Trivia: QR y apoyo al público": "Al final de la charla, ayuda al público a escanear el QR y entrar con su DNI. Resuelve dudas de conexión. No reveles respuestas.",
  "Jueza / juez de estación": "Ubícate en tu estación, explica las reglas a cada delegación, controla tiempos y anota resultados para el coordinador de la Gymkana.",
  "Fotos y redes": "Toma fotos y videos de los momentos clave (premiaciones, autoridades, delegaciones) y compártelos con Marketing.",
  "Entrega de premios": "Ten ordenados medallas, placas y certificados por concurso y puesto. Entrégalos al presentador en el orden del programa.",
};
export const FUNCIONES = Object.keys(GUIAS);

// Cronograma sugerido (agenda oficial del VI CONCEPMI). Los salones de los concursos quedan «por confirmar».
const T = (dia, hora_ini, hora_fin, bloque, rol, tipo, extra = {}) => ({ dia, hora_ini, hora_fin, bloque, rol, tipo, lugar: "", llegar_min: 10, indicaciones: GUIAS[rol] || "", ...extra });
export function sugeridas() {
  const A = "Auditorio Principal";
  return [
    T("d1", "8:30", "9:30", "Registro y acreditación", "Registro y acreditación", "general", { lugar: "Explanada principal / Hall", llegar_min: 30 }),
    T("d1", "9:30", "10:15", "Ceremonia de apertura + charla de inauguración PMI", "Coordinador de escenario", "escenario", { lugar: A, llegar_min: 30 }),
    T("d1", "9:30", "10:15", "Ceremonia de apertura + charla de inauguración PMI", "Micrófonos", "escenario", { lugar: A, llegar_min: 20 }),
    T("d1", "9:30", "10:15", "Ceremonia de apertura + charla de inauguración PMI", "Protocolo y recepción de invitados", "escenario", { lugar: A, llegar_min: 30 }),
    T("d1", "9:30", "10:15", "Ceremonia de apertura + charla de inauguración PMI", "Proyección (laptop del auditorio)", "escenario", { lugar: A, llegar_min: 30 }),
    ...CHARLAS.map((c, i) => {
      const [ini, fin] = c.hora.replace(/\s*(a|p)\.\s*m\./g, "").split(/\s*–\s*/);
      const dia = c.dia.includes("24") ? "d1" : "d2", bloque = `Charla Principal ${["I", "II", "III"][i] || i + 1} · ${c.ponente}`;
      return [T(dia, ini, fin, bloque, "Apoyo al ponente", "escenario", { lugar: A, llegar_min: 20 }), T(dia, ini, fin, bloque, "Micrófonos", "escenario", { lugar: A }),
        T(dia, ini, fin, bloque, "Trivia: QR y apoyo al público", "general", { lugar: A })];
    }).flat(),
    ...TALLERES.map((t) => T("d1", "11:30", "1:00", `Taller ${t.num} · ${t.nombre}`, "Apoyo de taller", "general", { lugar: t.lugar })),
    T("d1", "3:00", "5:00", "Concurso Nacional de Proyectos", "Coordinador de sala", "academico", { concurso_id: "proyectos", lugar: A, llegar_min: 30 }),
    T("d1", "3:00", "5:00", "Concurso Nacional de Proyectos", "Control de tiempo y turnos", "academico", { concurso_id: "proyectos", lugar: A }),
    T("d1", "3:00", "5:00", "Concurso Nacional de Proyectos", "Apoyo a jurados", "academico", { concurso_id: "proyectos", lugar: A }),
    ...["amateur-1", "amateur-2", "iathon"].map((id) => [
      T("d1", "5:00", "6:30", porId(id)?.nombre || id, "Coordinador de sala", "academico", { concurso_id: id, llegar_min: 20 }),
      T("d1", "5:00", "6:30", porId(id)?.nombre || id, "Apoyo de sala", "academico", { concurso_id: id }),
    ]).flat(),
    T("d1", "5:00", "6:30", "Show en vivo", "Coordinador de escenario", "escenario", { lugar: A }),
    T("d1", "6:30", "7:30", "Concurso de Barras + cierre del día 1", "Coordinador de sala", "cultural", { concurso_id: "barras", lugar: A }),
    T("d1", "6:30", "7:30", "Concurso de Barras + cierre del día 1", "Micrófonos", "escenario", { lugar: A }),
    T("d2", "8:30", "9:30", "Registro y coffee break", "Registro y acreditación", "general", { lugar: "Explanada principal / Hall", llegar_min: 30 }),
    T("d2", "9:30", "1:00", "Gran Gymkana + resultados del Talent Show", "Coordinador de sala", "cultural", { concurso_id: "gymkana", lugar: "Cancha de Calentamiento UNMSM", llegar_min: 30 }),
    T("d2", "9:30", "1:00", "Gran Gymkana + resultados del Talent Show", "Jueza / juez de estación", "cultural", { concurso_id: "gymkana", lugar: "Cancha de Calentamiento UNMSM", llegar_min: 20 }),
    T("d2", "9:30", "1:00", "Gran Gymkana + resultados del Talent Show", "Micrófonos", "escenario", { lugar: "Cancha de Calentamiento UNMSM" }),
    T("d2", "3:45", "5:45", "Concurso Nacional de Conocimientos", "Coordinador de sala", "academico", { concurso_id: "conocimientos", lugar: A, llegar_min: 20 }),
    T("d2", "3:45", "5:45", "Concurso Nacional de Conocimientos", "Apoyo de sala", "academico", { concurso_id: "conocimientos", lugar: A }),
    T("d2", "7:00", "8:30", "Ceremonia de cierre y premiación oficial", "Coordinador de escenario", "escenario", { lugar: A, llegar_min: 30 }),
    T("d2", "7:00", "8:30", "Ceremonia de cierre y premiación oficial", "Entrega de premios", "escenario", { lugar: A, llegar_min: 30 }),
    T("d2", "7:00", "8:30", "Ceremonia de cierre y premiación oficial", "Proyección (laptop del auditorio)", "escenario", { lugar: A, llegar_min: 30 }),
    T("d2", "7:00", "8:30", "Ceremonia de cierre y premiación oficial", "Fotos y redes", "general", { lugar: A }),
  ];
}
const RECOMENDACIONES = ["Llega con tiempo: la hora de llegada ya incluye los minutos de anticipación.", "Lleva tu celular cargado (y un cargador) y ten abierto este Panel con tu código.",
  "Usa tu credencial y el polo/lanyard del equipo organizador todo el día.", "Si no puedes llegar o surge un problema, avisa de inmediato al contacto de emergencia.",
  "Nunca compartas tu código ni los códigos de los equipos o jurados."];

// ---------------- Horas ----------------
// «9:30», «1:00» → minutos desde medianoche (el evento va de 8 a. m. a 9 p. m.: 1–7 = tarde)
export function minutos(h) {
  const m = String(h || "").match(/(\d{1,2})(?::(\d{2}))?/); if (!m) return 9999;
  let hh = +m[1]; const mm = +(m[2] || 0); if (hh < 8) hh += 12; return hh * 60 + mm;
}
export function hora(min) {
  if (min == null || min >= 9999) return "";
  const h = Math.floor(min / 60), m = min % 60, h12 = ((h + 11) % 12) + 1;
  return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : h === 12 && m === 0 ? "m." : "p. m."}`;
}
const rango = (t) => (t.hora_ini ? `${hora(minutos(t.hora_ini))}${t.hora_fin ? ` – ${hora(minutos(t.hora_fin))}` : ""}` : "Hora por definir");
const llegada = (t) => (t.hora_ini ? hora(minutos(t.hora_ini) - (t.llegar_min ?? 10)) : "");
const ordenT = (a, b) => (a.dia === b.dia ? minutos(a.hora_ini) - minutos(b.hora_ini) || (a.orden || 0) - (b.orden || 0) : a.dia < b.dia ? -1 : 1);
const cruza = (a, b) => a.dia === b.dia && a.id !== b.id && minutos(a.hora_ini) < (minutos(b.hora_fin) || minutos(b.hora_ini) + 60) && minutos(b.hora_ini) < (minutos(a.hora_fin) || minutos(a.hora_ini) + 60);
const tel = (x) => String(x || "").replace(/[^\d+]/g, "");
const wa = (x) => { const d = tel(x).replace(/^\+/, ""); return d ? `https://wa.me/${d.length === 9 ? "51" + d : d}` : ""; };
const tipoChip = (t) => `<span class="dd-t ${TIPOS[t]?.cls || ""}">${esc(TIPOS[t]?.txt || t)}</span>`;
const esVoluntario = (k) => !k.concursos?.length && !AREAS.some((a) => !a.guia && nivel(k, a.id));
const URL_PANEL = () => location.origin + location.pathname;

// ---------------- Guía personal (la ve la persona y el admin en «Ver guía») ----------------
export function htmlGuia(g, { vistaAdmin = false } = {}) {
  const yo = g.yo || {}, cfg = g.config || {}, tareas = [...(g.tareas || [])].sort(ordenT);
  const ahora = Date.now();
  const cuando = (t) => Date.parse(`${DIAS[t.dia]?.fecha}T00:00:00-05:00`) + minutos(t.hora_ini) * 60000;
  const prox = tareas.find((t) => cuando(t) + ((minutos(t.hora_fin) - minutos(t.hora_ini)) || 60) * 60000 > ahora);
  const tarjeta = (t) => {
    const c = t.concurso_id ? porId(t.concurso_id) : null, conEntregas = c && ENTREGABLES[t.concurso_id] && (yo.concursos || []).includes(t.concurso_id);
    return `<article class="dd-g ${t === prox ? "dd-g--prox" : ""}">
      <div class="dd-g__hora"><small>Llega a las</small><b>${esc(llegada(t) || "—")}</b><span>${esc(rango(t))}</span>${t === prox ? `<em>Próxima</em>` : ""}</div>
      <div class="dd-g__cuerpo">
        <div class="dd-g__cab">${tipoChip(t.tipo)}${c ? `<span class="chip">${esc(c.nombre)}</span>` : ""}</div>
        <h3>${esc(t.rol || t.bloque)}</h3>
        ${t.rol && t.bloque ? `<p class="dd-g__bloque">${esc(t.bloque)}</p>` : ""}
        <p class="dd-g__lugar">${t.lugar ? `📍 <b>${esc(t.lugar)}</b>` : `📍 <span class="dd-pc">Salón por confirmar</span> <small>te avisaremos</small>`}</p>
        <p class="dd-g__llegar">⏰ Llega <b>${t.llegar_min ?? 10} min antes</b> del inicio.</p>
        ${t.indicaciones ? `<div class="dd-g__que"><b>Qué tienes que hacer</b><p>${esc(t.indicaciones).replace(/\n/g, "<br>")}</p></div>` : ""}
        ${conEntregas ? `<p class="dd-g__panel">${I.lapiz} En tu panel abre la pestaña <b>Entregas</b> de ${esc(c.nombre)}: ahí están los códigos de los equipos y el tiempo oficial.</p>` : ""}
        ${(t.equipo || []).length ? `<div class="dd-g__eq"><b>Con quién</b>${t.equipo.map((o) => `<span class="dd-per">${esc(o.nombre)}${o.area ? ` <small>${esc(o.area)}</small>` : ""}${o.telefono ? ` <a href="${esc(wa(o.telefono))}" target="_blank" rel="noopener">${esc(o.telefono)}</a>` : ""}</span>`).join("")}</div>` : ""}
      </div></article>`;
  };
  const dias = Object.keys(DIAS).filter((d) => tareas.some((t) => t.dia === d));
  const encuentro = [cfg.encuentro_d1 && `<b>${DIAS.d1.corto}:</b> ${esc(cfg.encuentro_d1)}${cfg.llegada_d1 ? ` · ${esc(cfg.llegada_d1)}` : ""}`, cfg.encuentro_d2 && `<b>${DIAS.d2.corto}:</b> ${esc(cfg.encuentro_d2)}${cfg.llegada_d2 ? ` · ${esc(cfg.llegada_d2)}` : ""}`].filter(Boolean);
  const recos = String(cfg.recomendaciones ?? RECOMENDACIONES.join("\n")).split("\n").map((x) => x.trim()).filter(Boolean);
  return `<div class="dd-guia">
    <section class="dd-hola tarjeta">
      <div><small>Tu guía del Día D · VI CONCEPMI 2026</small><h2>Hola, ${esc((yo.nombre || "").split(" ")[0] || "equipo")} 👋</h2>
        <p>${tareas.length ? `Tienes <b>${tareas.length} ${tareas.length === 1 ? "tarea asignada" : "tareas asignadas"}</b>. Aquí está qué te toca, dónde y a qué hora llegar.` : "Aún no tienes tareas asignadas. El organizador te avisará; vuelve a abrir esta página más tarde."}</p>
        ${yo.area ? `<span class="chip chip--celeste">Área: ${esc(yo.area)}</span>` : ""}</div>
      ${prox ? `<div class="dd-hola__prox"><small>Tu próxima tarea</small><b>${esc(prox.rol || prox.bloque)}</b><span>${esc(DIAS[prox.dia]?.corto)} · llega ${esc(llegada(prox))}</span><span>${esc(prox.lugar || "Salón por confirmar")}</span></div>` : ""}
    </section>
    ${cfg.mensaje ? `<div class="dd-msg">${I.info}<p>${esc(cfg.mensaje).replace(/\n/g, "<br>")}</p></div>` : ""}
    ${encuentro.length || cfg.contacto_nombre || cfg.contacto_tel ? `<div class="dd-datos">
      ${encuentro.length ? `<div class="tarjeta"><small>Punto de encuentro del equipo</small><p>${encuentro.join("<br>")}</p></div>` : ""}
      ${cfg.contacto_nombre || cfg.contacto_tel ? `<div class="tarjeta"><small>Contacto de emergencia</small><p><b>${esc(cfg.contacto_nombre || "")}</b>${cfg.contacto_tel ? ` · <a href="tel:${esc(tel(cfg.contacto_tel))}">${esc(cfg.contacto_tel)}</a> · <a href="${esc(wa(cfg.contacto_tel))}" target="_blank" rel="noopener">WhatsApp</a>` : ""}</p></div>` : ""}
    </div>` : ""}
    ${dias.map((d) => `<h2 class="dd-dia">${esc(DIAS[d].txt)}</h2>${tareas.filter((t) => t.dia === d).map(tarjeta).join("")}`).join("")}
    ${recos.length ? `<section class="tarjeta dd-recos"><b>Recomendaciones para todos</b><ul>${recos.map((x) => `<li>${esc(x)}</li>`).join("")}</ul></section>` : ""}
    ${(g.agenda || []).length ? `<details class="tarjeta dd-agenda"><summary>Programa completo del evento</summary>${Object.keys(DIAS).map((d) => {
      const it = g.agenda.filter((a) => a.dia === d).sort((a, b) => minutos(a.hora_ini) - minutos(b.hora_ini)); if (!it.length) return "";
      return `<h4>${esc(DIAS[d].txt)}</h4><ul>${it.map((a) => `<li><b>${esc(rango(a))}</b> · ${esc(a.bloque)}${a.lugar ? ` <small>· ${esc(a.lugar)}</small>` : ""}</li>`).join("")}</ul>`;
    }).join("")}</details>` : ""}
    ${vistaAdmin ? "" : `<p class="ayuda" style="text-align:center">¿Algo no cuadra? Escribe al organizador. Esta guía se actualiza sola cuando el organizador cambia algo.</p>`}
  </div>`;
}

// La guía de una persona armada desde los datos del admin (vista previa y mensaje de WhatsApp)
function guiaDe(D, k) {
  const tareas = D.tareas.filter((t) => t.personas.includes(k.id)).map((t) => ({ ...t, equipo: t.personas.filter((x) => x !== k.id).map((x) => D.personas.find((p) => p.id === x)).filter(Boolean) }));
  const vistos = new Set(), agenda = [];
  [...D.tareas].sort(ordenT).forEach((t) => { const c = t.dia + t.hora_ini + t.bloque; if (t.bloque && !vistos.has(c)) { vistos.add(c); agenda.push(t); } });
  return { yo: k, tareas, agenda, config: D.config };
}
function mensajeWhatsApp(D, k) {
  const g = guiaDe(D, k);
  return [`Hola ${k.nombre.split(" ")[0]} 👋 Eres parte del equipo del *VI CONCEPMI 2026*.`, "",
    k.codigo ? `Tu código: *${k.codigo}*` : "Entra con tu código privado.", `Entra a ${URL_PANEL()} → botón *Voluntarios · Día D* y escribe tu código para ver tu guía completa (qué hacer, dónde y con quién).`, "",
    g.tareas.length ? "*Tus tareas:*" : "Aún no tienes tareas asignadas; te avisaremos.",
    ...g.tareas.sort(ordenT).map((t) => `• ${DIAS[t.dia].corto} · llega ${llegada(t)} · ${t.rol || t.bloque}${t.rol && t.bloque ? ` (${t.bloque})` : ""} · ${t.lugar || "salón por confirmar"}`),
    "", "No compartas tu código con nadie. ¡Gracias por sumarte!"].join("\n");
}
async function copiar(txt, ok = "Copiado") { try { await navigator.clipboard.writeText(txt); aviso(ok); } catch { modal(`<h2>Copia este texto</h2><textarea style="width:100%;min-height:240px">${esc(txt)}</textarea>`); } }

// ---------------- Vista de la persona (su código) ----------------
export async function pintarGuia(caja, codigo) {
  caja.innerHTML = `<div class="cargando" style="min-height:160px"><div class="giro"></div>Cargando tu guía…</div>`;
  try { const g = await api.diadMio(codigo); caja.innerHTML = htmlGuia(g) + `<div class="dd-pie"><button class="btn" data-imprimir>${I.descargar}Imprimir / guardar PDF</button></div>`; $("[data-imprimir]", caja).onclick = () => window.print(); }
  catch (e) { caja.innerHTML = `<div class="vacio"><b>No se pudo cargar tu guía</b>${esc(e.message)}</div>`; }
}
export function crearGuia(ctx) { return { vista: (v) => pintarGuia(v, ctx.codigo()) }; }

// Página completa para quien solo tiene la guía (voluntario)
export function vistaGuia(app, codigo, k, salir) {
  app.innerHTML = `<div class="fondo fondo--sobrio"></div>
    <header class="barra"><img class="logo" src="${IMG.logo}" alt="CONCEPMI"><span class="sep"></span>
      <div><div class="barra__titulo">Mi Día D</div><div class="barra__sub">${esc(k.nombre)} · VI CONCEPMI 2026</div></div>
      <div class="der"><button class="btn btn--mini" data-recargar title="Actualizar">${I.girar}<span>Actualizar</span></button><button class="btn btn--mini btn--icono" data-salir title="Salir" aria-label="Salir">${I.salir}</button></div></header>
    <main class="contenedor" style="max-width:900px"><section id="vista"></section></main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
  $("[data-salir]", app).onclick = salir;
  $("[data-recargar]", app).onclick = () => pintarGuia($("#vista", app), codigo);
  pintarGuia($("#vista", app), codigo);
}

// ---------------- Pestaña «Día D» del admin ----------------
// Disponibilidad de cada persona: { d1: [[inicio, fin], …], d2: […] } en minutos (510 = 8:30 a. m.)
const OPC_HORA = Array.from({ length: 30 }, (_, i) => 420 + i * 30); // 7:00 a. m. → 9:30 p. m.
const DIA_COMPLETO = { d1: [480, 1170], d2: [480, 1230] }; // horario del evento cada día
const dispDe = (k, d) => (Array.isArray(k?.disponibilidad?.[d]) ? k.disponibilidad[d] : []);
const tieneHorario = (k) => Object.keys(DIAS).some((d) => dispDe(k, d).length);
const txtRangos = (arr) => arr.map(([a, b]) => `${hora(a)} – ${hora(b)}`).join(" y ");
const rangoT = (t) => { const a = minutos(t.hora_ini); return [a, minutos(t.hora_fin) < 9999 ? minutos(t.hora_fin) : a + 60]; };
// ¿Puede la persona en [a, b] del día d? «total», «parte», «no» (marcó horario pero no ese día/hora) o «sin» (no tiene horario)
function cobertura(k, d, a, b) {
  if (!tieneHorario(k)) return "sin";
  const r = dispDe(k, d);
  if (r.some(([x, y]) => x <= a && y >= b)) return "total";
  if (r.some(([x, y]) => x < b && y > a)) return "parte";
  return "no";
}
const normTxt = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
// «Relaciones Públicas» → «RRPP», «Tecnologías de la información» → «TI»…
function areaCorta(s) {
  const n = normTxt(s); if (!n) return "";
  const m = [[/^dp$|direcci/, "DP"], [/pmo/, "PMO"], [/venta/, "Ventas"], [/rrpp|relaciones/, "RRPP"], [/marketing|mkt|mercadeo/, "Marketing"], [/logist/, "Logística"], [/^ti$|tecnolog|sistemas|informat/, "TI"]].find(([r]) => r.test(n));
  return m ? m[1] : String(s).trim();
}
const selHora = (val, attrs) => `<select ${attrs}>${OPC_HORA.map((m) => `<option value="${m}" ${m === val ? "selected" : ""}>${hora(m)}</option>`).join("")}</select>`;

export function crearDiaD(ctx) {
  let D = null, sub = "cronograma", diaSel = "d1", filtroTipo = "", soloSin = false;
  let busca = "", filtroArea = "", filtroVol = "todos";
  let disp = { dia: "d1", a: 510, b: 690 }; // «¿Quién está disponible?»: Mar 24, 8:30 – 11:30
  const cod = () => ctx.codigo();
  async function cargar() { D = await api.adminDiad(cod()); D.tareas.forEach((t) => (t.personas ||= [])); D.personas.forEach((k) => (k.disponibilidad ||= {})); }
  const persona = (id) => D.personas.find((p) => p.id === id);
  const tareasDe = (k) => D.tareas.filter((t) => t.personas.includes(k.id)).sort(ordenT);
  const ocupadoEn = (k, t) => D.tareas.filter((o) => o.id !== t.id && o.personas.includes(k.id) && cruza(o, t));
  const ocupadoRango = (k, d, a, b) => D.tareas.filter((o) => o.dia === d && o.personas.includes(k.id) && rangoT(o)[0] < b && rangoT(o)[1] > a);

  async function vista(v) {
    if (!D) { v.innerHTML = `<div class="cargando"><div class="giro"></div>Cargando el Día D…</div>`; try { await cargar(); } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`; return; } }
    pintar(v);
  }
  function pintar(v) {
    const asignadas = new Set(D.tareas.flatMap((t) => t.personas)), sinNadie = D.tareas.filter((t) => !t.personas.length).length;
    const vols = D.personas.length, conHorario = D.personas.filter(tieneHorario).length;
    v.innerHTML = `<div class="cabeza" style="margin-top:0"><div><h1>Día D</h1><p>Organiza a tu equipo el <b>24 y 26 de noviembre</b>: carga a tus voluntarios desde Excel, marca qué días y horas puede cada uno y asígnalos a cada momento del cronograma. Cada uno entra con su código por el botón <b>Voluntarios · Día D</b> de la portada y ve su guía.</p></div></div>
      <div class="kpis">
        <div class="kpi"><b>${vols}</b><span>voluntarios y staff</span></div>
        <div class="kpi ${vols && conHorario < vols ? "kpi--alerta" : ""}"><b>${conHorario}</b><span>con horario marcado</span></div>
        <div class="kpi"><b>${asignadas.size}</b><span>con alguna tarea</span></div>
        <div class="kpi"><b>${D.tareas.length}</b><span>funciones en el cronograma</span></div>
        <div class="kpi ${sinNadie ? "kpi--alerta" : ""}"><b>${sinNadie}</b><span>funciones sin nadie</span></div>
      </div>
      <div class="pestanas pestanas--sub dd-subs" role="tablist">
        <button class="pestana" data-sub="cronograma" aria-selected="${sub === "cronograma"}">${I.reloj}Cronograma<small>Qué pasa cada día y quién va</small></button>
        <button class="pestana" data-sub="voluntarios" aria-selected="${sub === "voluntarios"}">${I.personas}Voluntarios (${vols})<small>Excel, áreas y horarios</small></button>
        <button class="pestana" data-sub="disponibles" aria-selected="${sub === "disponibles"}">${I.check}¿Quién está disponible?<small>Busca por día y hora</small></button>
        <button class="pestana" data-sub="general" aria-selected="${sub === "general"}">${I.info}Datos generales<small>Encuentro y emergencia</small></button></div>
      <div data-cuerpo></div>`;
    $$("[data-sub]", v).forEach((b) => (b.onclick = () => { sub = b.dataset.sub; pintar(v); }));
    const c = $("[data-cuerpo]", v);
    ({ cronograma: pintarCronograma, voluntarios: pintarVoluntarios, disponibles: pintarDisponibles, general: pintarGeneral })[sub](c, v);
  }

  // ======================= Cronograma (un día a la vez) =======================
  function pintarCronograma(c, v) {
    const resumen = (d) => { const ts = D.tareas.filter((t) => t.dia === d); const mom = new Set(ts.map((t) => t.hora_ini + t.bloque)).size, sin = ts.filter((t) => !t.personas.length).length;
      return ts.length ? `${mom} momentos · ${ts.length} funciones${sin ? ` · <b class="dd-pc">${sin} sin asignar</b>` : " · ✓ todo asignado"}` : "Sin tareas aún"; };
    let lista = D.tareas.filter((t) => t.dia === diaSel).sort(ordenT);
    if (filtroTipo) lista = lista.filter((t) => t.tipo === filtroTipo);
    if (soloSin) lista = lista.filter((t) => !t.personas.length);
    const grupos = []; lista.forEach((t) => { const k = `${t.hora_ini}|${t.bloque}`; let g = grupos.find((x) => x.k === k); if (!g) grupos.push((g = { k, t, items: [] })); g.items.push(t); });
    c.innerHTML = `<div class="dd-dias" role="tablist">${Object.entries(DIAS).map(([d, x]) => `<button class="dd-diabtn ${diaSel === d ? "activo" : ""}" role="tab" aria-selected="${diaSel === d}" data-dia="${d}">
        <small>${x.num}</small><b>${x.largo}</b><span>${resumen(d)}</span></button>`).join("")}</div>
      <div class="dd-barra">
        <div class="dd-filtros"><div class="segm"><button type="button" data-ft="" class="${!filtroTipo ? "activo" : ""}">Todo</button>${Object.entries(TIPOS).map(([k, t]) => `<button type="button" data-ft="${k}" class="${filtroTipo === k ? "activo" : ""}">${t.txt}</button>`).join("")}</div>
          <label class="chip" style="cursor:pointer"><input type="checkbox" data-sin ${soloSin ? "checked" : ""}> Solo sin asignar</label></div>
        <div class="dd-barra__acc">${D.tareas.length ? "" : `<button class="btn btn--mini btn--naranja" data-sugeridas>${I.mas}Cargar cronograma sugerido</button>`}
          <button class="btn btn--mini" data-nueva>${I.mas}Nueva tarea</button><button class="btn btn--mini" data-plan>${I.descargar}Imprimir plan</button></div>
      </div>
      ${!D.tareas.length ? `<div class="vacio"><b>Aún no hay tareas</b>Pulsa <b>Cargar cronograma sugerido</b>: trae la agenda oficial de los 2 días (registro, inauguración, charlas, talleres, concursos, Gymkana y premiación) con las funciones típicas. Luego asignas voluntarios y corriges lo que quieras.</div>`
        : grupos.length ? grupos.map((g) => htmlMomento(g)).join("") : `<div class="vacio"><b>Nada en ${esc(DIAS[diaSel].corto)} con ese filtro</b></div>`}`;
    $$("[data-dia]", c).forEach((b) => (b.onclick = () => { diaSel = b.dataset.dia; pintarCronograma(c, v); }));
    $$("[data-ft]", c).forEach((b) => (b.onclick = () => { filtroTipo = b.dataset.ft; pintarCronograma(c, v); }));
    $("[data-sin]", c).onchange = (e) => { soloSin = e.target.checked; pintarCronograma(c, v); };
    $("[data-nueva]", c).onclick = () => formTarea(null, v);
    $("[data-plan]", c).onclick = () => imprimirPlan();
    $("[data-sugeridas]", c)?.addEventListener("click", () => cargarSugeridas(v));
    enlazarTareas(c, v);
  }
  function htmlMomento(g) {
    const lugares = [...new Set(g.items.map((t) => t.lugar).filter(Boolean))];
    const [a, b] = rangoT(g.t), libres = D.personas.filter((k) => cobertura(k, g.t.dia, a, b) === "total" && !ocupadoRango(k, g.t.dia, a, b).length).length;
    return `<section class="dd-momento tarjeta">
      <div class="dd-momento__cab"><span class="dd-momento__hora">${esc(rango(g.t))}</span><b>${esc(g.t.bloque || "Sin momento")}</b>
        <span class="dd-momento__lugar">${lugares.length ? `📍 ${esc(lugares.join(" · "))}` : `<span class="dd-pc">📍 Lugar por confirmar</span>`}</span>
        <span class="chip ${libres ? "chip--verde" : ""}" title="Voluntarios que marcaron que pueden a esta hora y aún no tienen otra tarea">${libres} disponibles</span>
        <button class="btn btn--mini" data-mas-rol="${esc(g.items[0].id)}" title="Agregar otra función en este momento">${I.mas}Función</button></div>
      ${g.items.map((t) => {
        const choques = t.personas.filter((pid) => { const k = persona(pid); return k && ocupadoEn(k, t).length; });
        return `<div class="dd-tarea ${t.personas.length ? "" : "dd-tarea--vacia"}">
        <div class="dd-tarea__info"><b>${esc(t.rol || "Función")}</b>
          <div class="dd-tarea__meta">${tipoChip(t.tipo)}${t.concurso_id ? `<span class="chip">${esc(porId(t.concurso_id)?.nombre || t.concurso_id)}</span>` : ""}<small>llegar ${t.llegar_min ?? 10} min antes · ${esc(llegada(t))}</small>${t.lugar && lugares.length > 1 ? `<small>· ${esc(t.lugar)}</small>` : ""}</div></div>
        <div class="dd-tarea__gente">${t.personas.map((pid) => { const k = persona(pid); if (!k) return ""; const cv = cobertura(k, t.dia, ...rangoT(t)), mal = choques.includes(pid) || cv === "no" || cv === "parte";
          return `<span class="dd-per ${mal ? "dd-per--choque" : ""}" title="${choques.includes(pid) ? "Tiene otra tarea a la misma hora" : cv === "no" ? "Marcó que no puede a esta hora" : cv === "parte" ? "Solo puede una parte de este horario" : esc(k.area || "")}">${esc(k.nombre)}${mal ? " ⚠" : ""}<button data-quitar="${t.id}|${pid}" aria-label="Quitar a ${esc(k.nombre)}">×</button></span>`; }).join("") || `<span class="dd-pc">Nadie asignado</span>`}</div>
        <div class="dd-tarea__acc"><button class="btn btn--mini btn--naranja" data-asignar="${t.id}">${I.personas}Asignar</button><button class="btn btn--mini btn--icono" data-editar="${t.id}" title="Editar tarea" aria-label="Editar tarea">${I.lapiz}</button></div>
      </div>`; }).join("")}</section>`;
  }
  function enlazarTareas(c, v) {
    $$("[data-asignar]", c).forEach((b) => (b.onclick = () => asignar(D.tareas.find((t) => t.id === b.dataset.asignar), v)));
    $$("[data-editar]", c).forEach((b) => (b.onclick = () => formTarea(D.tareas.find((t) => t.id === b.dataset.editar), v)));
    $$("[data-mas-rol]", c).forEach((b) => (b.onclick = () => { const t = D.tareas.find((x) => x.id === b.dataset.masRol); formTarea({ ...t, id: null, rol: "", personas: [], indicaciones: "" }, v); }));
    $$("[data-quitar]", c).forEach((b) => (b.onclick = async () => {
      const [tid, pid] = b.dataset.quitar.split("|"), t = D.tareas.find((x) => x.id === tid);
      await guardarTarea({ ...t, personas: t.personas.filter((x) => x !== pid) }); pintar(v);
    }));
  }
  async function guardarTarea(t) {
    const datos = { dia: t.dia, hora_ini: t.hora_ini, hora_fin: t.hora_fin, bloque: t.bloque, rol: t.rol, tipo: t.tipo, concurso_id: t.concurso_id || null, lugar: t.lugar, llegar_min: +t.llegar_min || 0, indicaciones: t.indicaciones, personas: t.personas, ...(t.orden ? { orden: t.orden } : {}) };
    try { const r = await api.adminDiadTarea(cod(), { id: t.id || null, datos }); r.personas ||= []; const i = D.tareas.findIndex((x) => x.id === r.id); if (i >= 0) D.tareas[i] = r; else D.tareas.push(r); return r; }
    catch (e) { aviso(e.message, "error"); throw e; }
  }
  async function cargarSugeridas(v) {
    if (!(await confirmar("¿Cargar el cronograma sugerido?", `Se agregan ${sugeridas().length} funciones con la agenda oficial de los 2 días (registro, inauguración, charlas, talleres, concursos, Gymkana y premiación). Después asignas voluntarios, cambias lugares o borras lo que no uses.`, { boton: "Cargar" }))) return;
    try { const n = await api.adminDiadCargar(cod(), sugeridas()); await cargar(); pintar(v); aviso(`${n} funciones cargadas`); } catch (e) { aviso(e.message, "error"); }
  }

  function formTarea(t, v) {
    const n = t || { dia: diaSel, hora_ini: "", hora_fin: "", bloque: "", rol: "", tipo: "general", concurso_id: "", lugar: "", llegar_min: 10, indicaciones: "", personas: [] };
    const bloques = [...new Set(D.tareas.map((x) => x.bloque).filter(Boolean))], lugares = [...new Set([...D.tareas.map((x) => x.lugar), ...TALLERES.map((x) => x.lugar), "Auditorio Principal"].filter(Boolean))];
    const m = modal(`<h2>${n.id ? "Editar tarea" : "Nueva tarea"}</h2><form class="form dd-form">
      <div class="dd-fila3">
        <label class="campo"><span>Día</span><select name="dia">${Object.entries(DIAS).map(([k, d]) => `<option value="${k}" ${n.dia === k ? "selected" : ""}>${d.corto}</option>`).join("")}</select></label>
        <label class="campo"><span>Desde</span><input name="hora_ini" value="${esc(n.hora_ini)}" placeholder="3:00" maxlength="10"></label>
        <label class="campo"><span>Hasta</span><input name="hora_fin" value="${esc(n.hora_fin)}" placeholder="5:00" maxlength="10"></label></div>
      <label class="campo"><span>Momento del programa</span><input name="bloque" list="dd-bloques" value="${esc(n.bloque)}" maxlength="160" placeholder="Ej. Concurso Nacional de Conocimientos"><datalist id="dd-bloques">${bloques.map((b) => `<option value="${esc(b)}">`).join("")}</datalist></label>
      <label class="campo"><span>Función (qué hace la persona)</span><input name="rol" list="dd-roles" value="${esc(n.rol)}" maxlength="160" placeholder="Ej. Coordinador de sala, Micrófonos…"><datalist id="dd-roles">${FUNCIONES.map((b) => `<option value="${esc(b)}">`).join("")}</datalist></label>
      <div class="dd-fila3">
        <label class="campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}" ${n.tipo === k ? "selected" : ""}>${x.txt}</option>`).join("")}</select></label>
        <label class="campo"><span>Concurso (opcional)</span><select name="concurso_id"><option value="">—</option>${CONCURSOS.map((c) => `<option value="${c.id}" ${n.concurso_id === c.id ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select></label>
        <label class="campo"><span>Llegar antes (min)</span><input name="llegar_min" type="number" min="0" max="240" value="${n.llegar_min ?? 10}"></label></div>
      <label class="campo"><span>Lugar / salón</span><input name="lugar" list="dd-lugares" value="${esc(n.lugar)}" maxlength="160" placeholder="Vacío = «por confirmar»"><datalist id="dd-lugares">${lugares.map((b) => `<option value="${esc(b)}">`).join("")}</datalist></label>
      <label class="campo"><span>Qué tiene que hacer (indicaciones)</span><textarea name="indicaciones" rows="5" maxlength="3000">${esc(n.indicaciones)}</textarea></label>
      <button type="button" class="btn btn--mini" data-guia-sug style="justify-self:start">${I.libro}Usar indicaciones sugeridas para esta función</button>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0">${n.id ? `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Borrar tarea</button>` : ""}<button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-guia-sug]", m.el).onclick = () => { const g = GUIAS[f.rol.value.trim()]; if (g) f.indicaciones.value = g; else aviso("No hay indicaciones sugeridas para esa función; escríbelas tú", "error"); };
    f.rol.onchange = () => { if (!f.indicaciones.value.trim() && GUIAS[f.rol.value.trim()]) f.indicaciones.value = GUIAS[f.rol.value.trim()]; };
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Borrar esta tarea?", "Las personas asignadas dejarán de verla en su guía. No se borra a nadie.", { boton: "Borrar", peligro: true }))) return;
      try { await api.adminDiadTarea(cod(), { id: n.id, borrar: true }); D.tareas = D.tareas.filter((x) => x.id !== n.id); m.cerrar(); pintar(v); aviso("Tarea borrada"); } catch (e) { aviso(e.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const x = { ...n, dia: f.dia.value, hora_ini: f.hora_ini.value.trim(), hora_fin: f.hora_fin.value.trim(), bloque: f.bloque.value.trim(), rol: f.rol.value.trim(), tipo: f.tipo.value, concurso_id: f.concurso_id.value, lugar: f.lugar.value.trim(), llegar_min: +f.llegar_min.value || 0, indicaciones: f.indicaciones.value.trim() };
      if (!x.rol && !x.bloque) { $(".error", f).textContent = "Escribe el momento o la función"; return; }
      try { await guardarTarea(x); diaSel = x.dia; m.cerrar(); pintar(v); aviso(n.id ? "Tarea guardada" : "Tarea creada"); } catch (ex) { $(".error", f).textContent = ex.message; }
    };
  }

  // ======================= Asignar (ordenado por disponibilidad) =======================
  function asignar(t, v) {
    const sel = new Set(t.personas);
    const c = t.concurso_id && ENTREGABLES[t.concurso_id] ? porId(t.concurso_id) : null, esSala = c && /coordinador/i.test(t.rol);
    const conHora = !!t.hora_ini, [a, b] = rangoT(t);
    const grupoDe = (k) => {
      if (!conHora) return "todos";
      const cv = cobertura(k, t.dia, a, b), oc = ocupadoEn(k, t).length;
      if (oc && cv !== "no") return "ocupado";
      return cv === "total" ? "ok" : cv === "parte" ? "parte" : cv === "sin" ? "sin" : "no";
    };
    const GR = [["ok", "✅ Pueden a esta hora", "Marcaron que pueden en todo el horario y no tienen otra tarea."], ["parte", "🟡 Pueden solo una parte del horario", "Llegan tarde o se van antes."],
      ["ocupado", "⛔ Ya tienen otra tarea a esta hora", "Si los eliges, tendrán dos tareas a la vez."], ["sin", "⚪ Aún sin horario marcado", "Márcalo en la sub-pestaña Voluntarios."], ["todos", "Personas", ""]];
    const tarjeta = (k) => {
      const d = dispDe(k, t.dia), oc = ocupadoEn(k, t), n = tareasDe(k).filter((o) => o.id !== t.id).length;
      return `<button type="button" class="dd-op ${sel.has(k.id) ? "dd-op--si" : ""}" data-op="${k.id}" data-txt="${esc(normTxt(k.nombre + " " + (k.area || "")))}">
        <span class="dd-op__chk">${I.check}</span>
        <span class="dd-op__txt"><b>${esc(k.nombre)}</b>${k.area ? ` <span class="chip">${esc(k.area)}</span>` : ""}
          <small>${d.length ? `Puede ${esc(DIAS[t.dia].corto)}: ${esc(txtRangos(d))}` : tieneHorario(k) ? `No marcó ${esc(DIAS[t.dia].corto)}` : "Sin horario marcado"}</small>
          <small>${oc.length ? `<b class="dd-pc">Ocupado: ${esc(oc.map((o) => `${o.rol || o.bloque} (${rango(o)})`).join(", "))}</b>` : `${n} ${n === 1 ? "tarea" : "tareas"} en total`}</small></span></button>`;
    };
    const pintarLista = () => {
      const gs = {}; D.personas.forEach((k) => (gs[grupoDe(k)] ||= []).push(k));
      Object.values(gs).forEach((l) => l.sort((x, y) => tareasDe(x).length - tareasDe(y).length || x.nombre.localeCompare(y.nombre)));
      return GR.filter(([g]) => gs[g]?.length).map(([g, tit, ayuda]) => `<section class="dd-grupo dd-grupo--${g}"><h4>${tit} <small>(${gs[g].length})</small></h4>${ayuda ? `<p>${ayuda}</p>` : ""}<div class="dd-ops">${gs[g].map(tarjeta).join("")}</div></section>`).join("")
        + (gs.no?.length ? `<details class="dd-grupo dd-grupo--no"><summary>🚫 No pueden a esta hora (${gs.no.length}) · ver de todas formas</summary><div class="dd-ops">${gs.no.map(tarjeta).join("")}</div></details>` : "")
        || `<div class="vacio" style="padding:14px"><b>Aún no hay voluntarios</b>Impórtalos de Excel en la sub-pestaña Voluntarios o créalos abajo.</div>`;
    };
    const elegidos = () => [...sel].map((id) => persona(id)).filter(Boolean).map((k) => `<span class="dd-per">${esc(k.nombre)}<button type="button" data-des="${k.id}" aria-label="Quitar">×</button></span>`).join("") || `<span class="tenue">Nadie todavía: toca a las personas de abajo.</span>`;
    const m = modal(`<h2>Asignar voluntarios</h2>
      <div class="dd-asig-cab"><b>${esc(t.rol || "Función")}</b>${t.bloque && t.bloque !== t.rol ? `<span>${esc(t.bloque)}</span>` : ""}<span class="chip chip--celeste">${esc(DIAS[t.dia].corto)} · ${esc(rango(t))}</span>${t.lugar ? `<span class="chip">📍 ${esc(t.lugar)}</span>` : ""}</div>
      <div class="dd-elegidos"><small>Elegidos</small><div data-elegidos>${elegidos()}</div></div>
      <input class="dd-buscar" type="search" placeholder="Buscar por nombre o área…" data-buscar>
      <div class="dd-lista-elegir" data-lista>${pintarLista()}</div>
      ${esSala ? `<label class="chip chip--ambar" style="cursor:pointer;margin-top:10px"><input type="checkbox" data-dar-entregas checked> Darles acceso a <b>Entregas · ${esc(c.nombre)}</b> (códigos de equipo y tiempo oficial)</label>` : ""}
      <details class="dd-nueva"><summary>${I.mas} ¿No está en la lista? Crear voluntario nuevo</summary>
        <form class="form" data-nueva-per>
          <div class="dd-fila3"><label class="campo"><span>Nombres</span><input name="nombres" maxlength="80" required></label>
          <label class="campo"><span>Apellido paterno</span><input name="paterno" maxlength="60"></label>
          <label class="campo"><span>Apellido materno</span><input name="materno" maxlength="60"></label></div>
          <div class="dd-fila2"><label class="campo"><span>Área</span><select name="area"><option value="">—</option>${AREAS_ORG.map((x) => `<option>${x}</option>`).join("")}<option value="Otra">Otra</option></select></label>
          <label class="campo"><span>Celular (opcional)</span><input name="tel" maxlength="30" inputmode="tel" placeholder="9XX XXX XXX"></label></div>
          <label class="check" style="margin:0"><input type="checkbox" name="puede" checked><span>Puede en este horario (${esc(DIAS[t.dia].corto)} ${esc(rango(t))})</span></label>
          <button class="btn">${I.mas}Crear y elegir</button><p class="error"></p></form></details>
      <div class="modal__acciones"><button type="button" class="btn" data-cancelar>Cancelar</button><button type="button" class="btn btn--naranja" data-ok>${I.check}Guardar asignación</button></div>`, { ancho: true });
    const lista = $("[data-lista]", m.el), eleg = $("[data-elegidos]", m.el);
    const filtrar = () => { const q = normTxt($("[data-buscar]", m.el).value); $$(".dd-op", lista).forEach((el) => (el.hidden = q && !el.dataset.txt.includes(q))); };
    const enlazar = () => {
      $$("[data-op]", lista).forEach((el) => (el.onclick = () => { const id = el.dataset.op; if (sel.has(id)) sel.delete(id); else sel.add(id); el.classList.toggle("dd-op--si", sel.has(id)); eleg.innerHTML = elegidos(); enlazarEleg(); }));
      filtrar();
    };
    const enlazarEleg = () => $$("[data-des]", eleg).forEach((x) => (x.onclick = () => { sel.delete(x.dataset.des); eleg.innerHTML = elegidos(); enlazarEleg(); $$(`[data-op="${x.dataset.des}"]`, lista).forEach((el) => el.classList.remove("dd-op--si")); }));
    enlazar(); enlazarEleg();
    $("[data-buscar]", m.el).oninput = filtrar;
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    const fn = $("[data-nueva-per]", m.el);
    fn.onsubmit = async (e) => {
      e.preventDefault(); const bt = $("button", fn); bt.disabled = true;
      try {
        const datos = { nombres: fn.nombres.value.trim(), paterno: fn.paterno.value.trim(), materno: fn.materno.value.trim(), area: fn.area.value, telefono: fn.tel.value.trim() };
        if (fn.puede.checked && conHora) datos.disponibilidad = { [t.dia]: [[a, b]] };
        const r = await api.adminDiadVoluntario(cod(), null, datos);
        await cargar(); sel.add(r.id); lista.innerHTML = pintarLista(); enlazar(); eleg.innerHTML = elegidos(); enlazarEleg(); fn.reset(); $(".error", fn).textContent = "";
        aviso(`Creado · código ${r.codigo}`);
      } catch (ex) { $(".error", fn).textContent = ex.message; } finally { bt.disabled = false; }
    };
    $("[data-ok]", m.el).onclick = async () => {
      try {
        const nuevo = D.tareas.find((x) => x.id === t.id) || t;
        await guardarTarea({ ...nuevo, personas: [...sel] });
        if (esSala && $("[data-dar-entregas]", m.el)?.checked) {
          for (const pid of sel) {
            const k = persona(pid); if (!k || (k.concursos || []).includes(t.concurso_id)) continue;
            await api.adminCoordinador(cod(), { id: k.id, nombre: k.nombre, concursos: [...(k.concursos || []), t.concurso_id], permisos: k.permisos || {} });
            k.concursos = [...(k.concursos || []), t.concurso_id];
          }
        }
        m.cerrar(); pintar(v); aviso("Asignación guardada");
      } catch (e) { aviso(e.message, "error"); }
    };
  }

  // ======================= Voluntarios (Excel, áreas y horarios) =======================
  function pintarVoluntarios(c, v) {
    const areas = [...new Set(D.personas.map((k) => k.area).filter(Boolean))].sort();
    let lista = [...D.personas];
    const q = normTxt(busca);
    if (q) lista = lista.filter((k) => normTxt(`${k.nombre} ${k.area || ""} ${k.codigo}`).includes(q));
    if (filtroArea) lista = lista.filter((k) => (k.area || "") === filtroArea);
    if (filtroVol === "sinhorario") lista = lista.filter((k) => !tieneHorario(k));
    if (filtroVol === "sintarea") lista = lista.filter((k) => !tareasDe(k).length);
    if (filtroVol === "d1" || filtroVol === "d2") lista = lista.filter((k) => dispDe(k, filtroVol).length);
    c.innerHTML = `<div class="dd-barra">
        <div class="dd-filtros"><input type="search" class="dd-buscar" style="margin:0;max-width:240px" placeholder="Buscar nombre, área o código…" value="${esc(busca)}" data-vbusca>
          <select data-varea><option value="">Todas las áreas</option>${areas.map((x) => `<option ${x === filtroArea ? "selected" : ""}>${esc(x)}</option>`).join("")}</select>
          <select data-vfiltro>${[["todos", "Todos"], ["d1", `Pueden ${DIAS.d1.corto}`], ["d2", `Pueden ${DIAS.d2.corto}`], ["sinhorario", "Sin horario marcado"], ["sintarea", "Sin tarea asignada"]].map(([k, t]) => `<option value="${k}" ${filtroVol === k ? "selected" : ""}>${t}</option>`).join("")}</select></div>
        <div class="dd-barra__acc"><button class="btn btn--mini btn--naranja" data-importar>${I.descargar}Importar Excel</button><button class="btn btn--mini" data-per-nueva>${I.mas}Nuevo voluntario</button><button class="btn btn--mini" data-ir-accesos title="Cambiar permisos del panel">${I.llave}Permisos</button></div>
      </div>
      <p class="ayuda" style="margin:0 0 10px">Marca en cada persona <b>qué días puede</b> y <b>de qué hora a qué hora</b> (puedes poner más de un horario por día). <b>Se guarda solo.</b> Así, al asignar, te salen primero los que pueden.</p>
      ${D.personas.length ? `<div class="tabla-envoltura"><table class="tabla dd-vtabla"><thead><tr><th>Voluntario</th><th>${DIAS.d1.num} · ${DIAS.d1.corto}</th><th>${DIAS.d2.num} · ${DIAS.d2.corto}</th><th>Tareas</th><th></th></tr></thead><tbody>
        ${lista.map((k) => { const ts = tareasDe(k); return `<tr data-fila="${k.id}">
          <td class="dd-vnom"><b>${esc(k.nombre)}</b><div>${k.area ? `<span class="chip">${esc(k.area)}</span>` : `<span class="dd-pc" style="font-size:.75rem">Sin área</span>`}${esVoluntario(k) ? "" : ` <span class="chip chip--celeste" title="Tiene pestañas del panel o Entregas">Panel</span>`}</div>
            <small class="tenue">${k.telefono ? `${esc(k.telefono)} · ` : ""}${k.codigo ? `código <code>${esc(k.codigo)}</code>` : "🔒 código privado"}</small><small class="dd-ok" data-estado></small></td>
          ${Object.keys(DIAS).map((d) => `<td><div class="dd-disp" data-disp="${k.id}|${d}">${htmlDisp(k, d)}</div></td>`).join("")}
          <td>${ts.length ? ts.map((t) => `<div class="dd-mini"><b>${esc(DIAS[t.dia].corto)} ${esc(hora(minutos(t.hora_ini)))}</b> ${esc(t.rol || t.bloque)}</div>`).join("") : `<span class="dd-pc" style="font-size:.8rem">Sin tarea</span>`}</td>
          <td class="dd-vacc"><button class="btn btn--mini btn--icono" data-ver-guia="${k.id}" title="Ver su guía" aria-label="Ver su guía">${I.libro}</button><button class="btn btn--mini btn--icono" data-wa="${k.id}" title="Copiar mensaje de WhatsApp con su código y sus tareas" aria-label="WhatsApp">${I.copiar}</button><button class="btn btn--mini btn--icono" data-per-editar="${k.id}" title="Editar datos" aria-label="Editar">${I.lapiz}</button></td></tr>`; }).join("") || `<tr><td colspan="5"><div class="vacio">Nadie con ese filtro</div></td></tr>`}
      </tbody></table></div>` : `<div class="vacio"><b>Aún no hay voluntarios</b>Pulsa <b>Importar Excel</b>: se detectan solas las columnas de nombres, apellido paterno, apellido materno, área y celular. Cada voluntario recibe su código para ver su guía.</div>`}`;
    const vb = $("[data-vbusca]", c); vb.oninput = () => { busca = vb.value; const pos = vb.selectionStart; pintarVoluntarios(c, v); const nb = $("[data-vbusca]", c); nb.focus(); nb.setSelectionRange(pos, pos); };
    $("[data-varea]", c).onchange = (e) => { filtroArea = e.target.value; pintarVoluntarios(c, v); };
    $("[data-vfiltro]", c).onchange = (e) => { filtroVol = e.target.value; pintarVoluntarios(c, v); };
    $("[data-importar]", c).onclick = () => importar(v);
    $("[data-per-nueva]", c).onclick = () => formPersona(null, v);
    $("[data-ir-accesos]", c).onclick = () => ctx.irA?.("entregas");
    $$("[data-ver-guia]", c).forEach((b) => (b.onclick = () => { const k = persona(b.dataset.verGuia); const mm = modal(`<p class="ayuda" style="margin:0 0 8px">Así ve <b>${esc(k.nombre)}</b> su guía al entrar con su código.</p>${htmlGuia(guiaDe(D, k), { vistaAdmin: true })}<div class="modal__acciones"><button class="btn" data-x>Cerrar</button></div>`, { ancho: true }); $("[data-x]", mm.el).onclick = mm.cerrar; }));
    $$("[data-wa]", c).forEach((b) => (b.onclick = () => copiar(mensajeWhatsApp(D, persona(b.dataset.wa)), "Mensaje copiado: pégalo en WhatsApp")));
    $$("[data-per-editar]", c).forEach((b) => (b.onclick = () => formPersona(persona(b.dataset.perEditar), v)));
    $$("[data-disp]", c).forEach((el) => enlazarDisp(el));
  }
  function htmlDisp(k, d) {
    const r = dispDe(k, d);
    if (!r.length) return `<button type="button" class="dd-disp__no" data-dadd>No puede · <b>＋ Marcar</b></button>`;
    return `${r.map(([a, b], i) => `<div class="dd-rango">${selHora(a, `data-r="${i}|0" aria-label="Desde"`)}<span>a</span>${selHora(b, `data-r="${i}|1" aria-label="Hasta"`)}<button type="button" data-rdel="${i}" title="Quitar este horario" aria-label="Quitar este horario">×</button></div>`).join("")}
      <div class="dd-disp__mas"><button type="button" data-rmas>+ otro horario</button><button type="button" data-rtodo>Todo el día</button></div>`;
  }
  const timers = {};
  function enlazarDisp(el) {
    const [id, d] = el.dataset.disp.split("|"), k = persona(id);
    const fijar = (arr) => {
      arr = arr.map(([a, b]) => [Math.min(a, b), Math.max(a, b)]).filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
      k.disponibilidad = { ...k.disponibilidad, [d]: arr }; el.innerHTML = htmlDisp(k, d); enlazarDisp(el);
      const est = $(`[data-fila="${id}"] [data-estado]`); if (est) est.textContent = "Guardando…";
      clearTimeout(timers[id + d]);
      timers[id + d] = setTimeout(async () => {
        try { await api.adminDiadVoluntario(cod(), id, { disponibilidad: { [d]: k.disponibilidad[d] } }); if (est) est.textContent = "✓ Guardado"; }
        catch (e) { if (est) est.textContent = ""; aviso(e.message, "error"); }
      }, 500);
    };
    const r = () => dispDe(k, d).map((x) => [...x]);
    $("[data-dadd]", el)?.addEventListener("click", () => fijar([DIA_COMPLETO[d]]));
    $("[data-rtodo]", el)?.addEventListener("click", () => fijar([DIA_COMPLETO[d]]));
    $("[data-rmas]", el)?.addEventListener("click", () => { const x = r(), fin = x.length ? x[x.length - 1][1] : DIA_COMPLETO[d][0]; const a = Math.min(fin + 60, 1230); fijar([...x, [a, Math.min(a + 120, 1260)]]); });
    $$("[data-rdel]", el).forEach((b) => (b.onclick = () => { const x = r(); x.splice(+b.dataset.rdel, 1); fijar(x); }));
    $$("[data-r]", el).forEach((s) => (s.onchange = () => {
      const [i, j] = s.dataset.r.split("|").map(Number), x = r(); x[i][j] = +s.value;
      if (x[i][0] >= x[i][1]) { if (j === 0) x[i][1] = Math.min(x[i][0] + 60, 1290); else x[i][0] = Math.max(x[i][1] - 60, 420); }
      fijar(x);
    }));
  }
  function importar(v) {
    importarExcel({
      titulo: "Importar voluntarios", unBoton: "Importar voluntarios",
      ayuda: "Sube el Excel de tu equipo. Se detectan solas las columnas de <b>nombres</b>, <b>apellido paterno</b>, <b>apellido materno</b>, <b>área</b> y <b>celular</b> (puedes cambiarlas). Si alguien ya está (mismo nombre completo), solo se actualizan sus datos; los nuevos reciben su código.",
      campos: [
        { id: "nombre", txt: "Nombres", claves: /^nombres?\b|nombre completo|^apellidos? y nombres?/, requerido: true, nombre: true },
        { id: "paterno", txt: "Apellido paterno", claves: /paterno|primer apellido|^apellidos?$/, nombre: true },
        { id: "materno", txt: "Apellido materno", claves: /materno|segundo apellido/, nombre: true },
        { id: "area", txt: "Área", claves: /^area|comite|direccion|departamento|^equipo/ },
        { id: "telefono", txt: "Celular", claves: /celular|telefono|^tel\b|whats|movil/ },
      ],
      alImportar: async (lista) => {
        const datos = lista.map((x) => ({ nombres: x.nombre, paterno: x.paterno || "", materno: x.materno || "", area: areaCorta(x.area), telefono: x.telefono || "" }));
        try { const r = await api.adminDiadImportar(cod(), datos); await cargar(); sub = "voluntarios"; pintar(v); aviso(`${r.nuevos} voluntarios nuevos · ${r.actualizados} actualizados`); }
        catch (e) { aviso(e.message, "error"); }
      },
    });
  }
  function formPersona(k, v) {
    const nombres = k ? (k.nombres ?? (k.paterno || k.materno ? "" : k.nombre)) : "";
    const ops = [...AREAS_ORG, "Otra"]; if (k?.area && !ops.includes(k.area)) ops.push(k.area);
    const m = modal(`<h2>${k ? "Editar voluntario" : "Nuevo voluntario"}</h2><form class="form">
      <div class="dd-fila3"><label class="campo"><span>Nombres</span><input name="nombres" maxlength="80" required value="${esc(nombres)}"></label>
        <label class="campo"><span>Apellido paterno</span><input name="paterno" maxlength="60" value="${esc(k?.paterno || "")}"></label>
        <label class="campo"><span>Apellido materno</span><input name="materno" maxlength="60" value="${esc(k?.materno || "")}"></label></div>
      <div class="dd-fila3"><label class="campo"><span>Área</span><select name="area"><option value="">—</option>${ops.map((a) => `<option ${k?.area === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label>
        <label class="campo"><span>Celular</span><input name="tel" maxlength="30" inputmode="tel" value="${esc(k?.telefono || "")}"></label>
        <label class="campo"><span>Código ${k ? "" : "(opcional)"}</span><input name="cod" maxlength="16" autocomplete="off" value="${esc(k?.codigo || "")}" placeholder="Automático" style="font-family:var(--neon);letter-spacing:.12em;text-transform:uppercase"></label></div>
      <p class="ayuda" style="margin:0">${k && !esVoluntario(k) ? "Sus permisos del panel se cambian en Entregas → Accesos limitados." : "Entra por el botón <b>Voluntarios · Día D</b> de la portada y solo ve su guía. Su horario se marca en la tabla de Voluntarios."}</p>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0">${k ? `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Quitar</button>` : ""}<button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar(`¿Quitar a ${k.nombre}?`, "Su código dejará de funcionar y saldrá de sus tareas del Día D. No se borra nada de lo que hizo.", { boton: "Quitar", peligro: true }))) return;
      try { await api.adminCoordinador(cod(), { id: k.id, borrar: true }); await cargar(); m.cerrar(); pintar(v); aviso("Voluntario quitado"); } catch (e) { aviso(e.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const c = f.cod.value.replace(/\s/g, "").toUpperCase();
      try {
        const r = await api.adminDiadVoluntario(cod(), k?.id || null, { nombres: f.nombres.value.trim(), paterno: f.paterno.value.trim(), materno: f.materno.value.trim(), area: f.area.value, telefono: f.tel.value.trim(), ...(c && c !== k?.codigo ? { codigo: c } : {}) });
        await cargar(); m.cerrar(); pintar(v); aviso(k ? "Guardado" : `Voluntario creado · código ${r.codigo}`);
      } catch (ex) { $(".error", f).textContent = ex.message; }
    };
  }

  // ======================= ¿Quién está disponible? =======================
  function pintarDisponibles(c, v) {
    const { dia, a, b } = disp;
    const momentos = []; D.tareas.filter((t) => t.dia === dia && t.hora_ini).sort(ordenT).forEach((t) => { if (!momentos.some((x) => x.hora_ini === t.hora_ini && x.bloque === t.bloque)) momentos.push(t); });
    const gs = { total: [], parte: [], no: [], sin: [] };
    D.personas.forEach((k) => gs[cobertura(k, dia, a, b)].push(k));
    Object.values(gs).forEach((l) => l.sort((x, y) => ocupadoRango(x, dia, a, b).length - ocupadoRango(y, dia, a, b).length || x.nombre.localeCompare(y.nombre)));
    const tarj = (k) => { const oc = ocupadoRango(k, dia, a, b), r = dispDe(k, dia);
      return `<div class="dd-pcard ${oc.length ? "dd-pcard--oc" : ""}"><b>${esc(k.nombre)}</b>${k.area ? ` <span class="chip">${esc(k.area)}</span>` : ""}
        <small>${r.length ? `Puede: ${esc(txtRangos(r))}` : tieneHorario(k) ? `No marcó ${esc(DIAS[dia].corto)}` : "Sin horario marcado"}</small>
        <small>${oc.length ? `<b class="dd-pc">Ya asignado: ${esc(oc.map((o) => `${o.rol || o.bloque} (${rango(o)})`).join(", "))}</b>` : `<span class="dd-ok">Libre en este rango</span>`}</small></div>`; };
    const dentro = D.tareas.filter((t) => t.dia === dia && t.hora_ini && rangoT(t)[0] < b && rangoT(t)[1] > a).sort(ordenT);
    c.innerHTML = `<section class="tarjeta dd-busca">
        <div class="dd-dias dd-dias--mini">${Object.entries(DIAS).map(([d, x]) => `<button class="dd-diabtn ${dia === d ? "activo" : ""}" data-bdia="${d}"><small>${x.num}</small><b>${x.largo}</b></button>`).join("")}</div>
        <div class="dd-busca__horas"><label class="campo"><span>Desde</span>${selHora(a, "data-ba")}</label><label class="campo"><span>Hasta</span>${selHora(b, "data-bb")}</label>
          <button class="btn btn--mini" data-btodo>Todo el día</button></div>
        ${momentos.length ? `<div class="dd-busca__mom"><small>O elige un momento del cronograma:</small>${momentos.map((t) => { const [x, y] = rangoT(t); return `<button class="chip ${x === a && y === b ? "chip--ambar" : ""}" data-bmom="${x}|${y}">${esc(hora(x))} · ${esc(t.bloque)}</button>`; }).join("")}</div>` : ""}
      </section>
      <h3 class="dd-res-tit">${esc(DIAS[dia].txt)} · de ${esc(hora(a))} a ${esc(hora(b))}</h3>
      <div class="dd-res">
        <section class="dd-res__col dd-res__col--ok"><h4>✅ Pueden todo el rango <small>(${gs.total.length})</small></h4>${gs.total.map(tarj).join("") || `<p class="tenue">Nadie marcó todo este rango.</p>`}</section>
        <section class="dd-res__col dd-res__col--parte"><h4>🟡 Pueden una parte <small>(${gs.parte.length})</small></h4>${gs.parte.map(tarj).join("") || `<p class="tenue">Nadie.</p>`}</section>
      </div>
      ${gs.no.length || gs.sin.length ? `<details class="tarjeta dd-res__otros"><summary>No pueden en este rango (${gs.no.length}) · Sin horario marcado (${gs.sin.length})</summary>
        ${gs.no.length ? `<h4>🚫 No pueden</h4><div class="dd-res__mini">${gs.no.map(tarj).join("")}</div>` : ""}
        ${gs.sin.length ? `<h4>⚪ Sin horario marcado</h4><p class="tenue">Márcalo en la sub-pestaña Voluntarios.</p><div class="dd-res__mini">${gs.sin.map(tarj).join("")}</div>` : ""}</details>` : ""}
      <h3 class="dd-res-tit">Funciones del cronograma en este rango <small>(${dentro.length})</small></h3>
      ${dentro.length ? `<div class="tarjeta" style="padding:0;overflow:hidden">${dentro.map((t) => `<div class="dd-tarea ${t.personas.length ? "" : "dd-tarea--vacia"}">
        <div class="dd-tarea__info"><b>${esc(t.rol || "Función")}</b><div class="dd-tarea__meta"><small>${esc(rango(t))} · ${esc(t.bloque)}</small>${tipoChip(t.tipo)}</div></div>
        <div class="dd-tarea__gente">${t.personas.map((pid) => persona(pid)).filter(Boolean).map((k) => `<span class="dd-per">${esc(k.nombre)}</span>`).join("") || `<span class="dd-pc">Nadie asignado</span>`}</div>
        <div class="dd-tarea__acc"><button class="btn btn--mini btn--naranja" data-asignar="${t.id}">${I.personas}Asignar</button></div></div>`).join("")}</div>` : `<div class="vacio">No hay funciones del cronograma en este rango.</div>`}`;
    $$("[data-bdia]", c).forEach((x) => (x.onclick = () => { disp.dia = x.dataset.bdia; pintarDisponibles(c, v); }));
    $("[data-ba]", c).onchange = (e) => { disp.a = +e.target.value; if (disp.b <= disp.a) disp.b = Math.min(disp.a + 60, 1290); pintarDisponibles(c, v); };
    $("[data-bb]", c).onchange = (e) => { disp.b = +e.target.value; if (disp.b <= disp.a) disp.a = Math.max(disp.b - 60, 420); pintarDisponibles(c, v); };
    $("[data-btodo]", c).onclick = () => { [disp.a, disp.b] = DIA_COMPLETO[disp.dia]; pintarDisponibles(c, v); };
    $$("[data-bmom]", c).forEach((x) => (x.onclick = () => { [disp.a, disp.b] = x.dataset.bmom.split("|").map(Number); pintarDisponibles(c, v); }));
    $$("[data-asignar]", c).forEach((x) => (x.onclick = () => asignar(D.tareas.find((t) => t.id === x.dataset.asignar), v)));
  }

  // ======================= Datos generales =======================
  function pintarGeneral(c, v) {
    const g = D.config || {};
    c.innerHTML = `<form class="tarjeta form dd-general">
      <p class="ayuda" style="margin:0">Esto sale arriba en la guía de <b>todas</b> las personas.</p>
      <div class="dd-fila2"><label class="campo"><span>Punto de encuentro · ${DIAS.d1.corto}</span><input name="encuentro_d1" maxlength="160" value="${esc(g.encuentro_d1 || "")}" placeholder="Ej. Hall del auditorio"></label>
        <label class="campo"><span>Hora de llegada del equipo · ${DIAS.d1.corto}</span><input name="llegada_d1" maxlength="40" value="${esc(g.llegada_d1 || "")}" placeholder="Ej. 7:30 a. m."></label></div>
      <div class="dd-fila2"><label class="campo"><span>Punto de encuentro · ${DIAS.d2.corto}</span><input name="encuentro_d2" maxlength="160" value="${esc(g.encuentro_d2 || "")}"></label>
        <label class="campo"><span>Hora de llegada del equipo · ${DIAS.d2.corto}</span><input name="llegada_d2" maxlength="40" value="${esc(g.llegada_d2 || "")}"></label></div>
      <div class="dd-fila2"><label class="campo"><span>Contacto de emergencia (nombre)</span><input name="contacto_nombre" maxlength="80" value="${esc(g.contacto_nombre || "")}" placeholder="Ej. Andy · Director"></label>
        <label class="campo"><span>Celular del contacto</span><input name="contacto_tel" maxlength="30" inputmode="tel" value="${esc(g.contacto_tel || "")}"></label></div>
      <label class="campo"><span>Mensaje para todos (opcional)</span><textarea name="mensaje" rows="3" maxlength="1500" placeholder="Ej. Polo negro del equipo y credencial visible todo el día.">${esc(g.mensaje || "")}</textarea></label>
      <label class="campo"><span>Recomendaciones (una por línea)</span><textarea name="recomendaciones" rows="6" maxlength="3000">${esc(g.recomendaciones ?? RECOMENDACIONES.join("\n"))}</textarea></label>
      <div class="acciones"><button class="btn btn--naranja">${I.check}Guardar datos generales</button></div></form>`;
    const f = $("form", c);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const datos = Object.fromEntries(["encuentro_d1", "llegada_d1", "encuentro_d2", "llegada_d2", "contacto_nombre", "contacto_tel", "mensaje", "recomendaciones"].map((x) => [x, f[x].value.trim()]));
      try { D.config = await api.adminDiadConfig(cod(), datos); aviso("Datos generales guardados"); } catch (ex) { aviso(ex.message, "error"); }
    };
  }

  // ======================= Plan completo imprimible =======================
  function imprimirPlan() {
    const w = window.open("", "_blank"); if (!w) return aviso("Permite las ventanas emergentes para imprimir", "error");
    const filas = (d) => [...D.tareas].filter((t) => t.dia === d).sort(ordenT).map((t) => `<tr><td><b>${esc(rango(t))}</b><br><small>llegar ${esc(llegada(t))}</small></td><td>${esc(t.bloque)}</td><td><b>${esc(t.rol)}</b><br><small>${esc(TIPOS[t.tipo]?.txt || "")}${t.concurso_id ? " · " + esc(porId(t.concurso_id)?.nombre || "") : ""}</small></td><td>${esc(t.lugar || "Por confirmar")}</td><td>${t.personas.map((p) => persona(p)).filter(Boolean).map((k) => `${esc(k.nombre)}${k.telefono ? ` <small>${esc(k.telefono)}</small>` : ""}`).join("<br>") || "<i>Sin asignar</i>"}</td></tr>`).join("");
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plan del Día D · VI CONCEPMI</title><style>
      body{font-family:Poppins,Arial,sans-serif;color:#22163f;margin:18px;font-size:11px} h1{margin:0;color:#3b1395} h2{color:#6e2be6;margin:18px 0 6px}
      table{width:100%;border-collapse:collapse} th{background:#f1ecfd;text-align:left;padding:5px} td{border-bottom:1px solid #e4dcfa;padding:5px;vertical-align:top} small{color:#6a5a90} tr{page-break-inside:avoid}
      @page{size:A4 landscape;margin:10mm}</style></head><body><h1>Plan del Día D · VI CONCEPMI 2026</h1><p>${D.tareas.length} funciones · generado el ${new Date().toLocaleString("es-PE")}</p>
      ${Object.keys(DIAS).map((d) => `<h2>${DIAS[d].txt}</h2><table><thead><tr><th>Hora</th><th>Momento</th><th>Función</th><th>Lugar</th><th>Personas</th></tr></thead><tbody>${filas(d) || `<tr><td colspan=5>Sin tareas</td></tr>`}</tbody></table>`).join("")}
      <script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  }

  return { vista, recargar: async () => { D = null; } };
}

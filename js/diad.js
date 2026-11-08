// =========================================================
// DÍA D: quién hace qué, dónde y a qué hora el día del evento.
//  · Pestaña «Día D» del admin: cronograma de tareas por día y momento (inauguración,
//    charlas, talleres, concursos, escenario…), personas asignadas, datos generales.
//  · Las personas son los ACCESOS LIMITADOS (los mismos de Entregas → Accesos limitados).
//    Si alguien no está, se crea aquí como «voluntario» (permiso diad = solo su guía).
//  · Guía personal: cada persona entra con su código (botón «Voluntarios» de la portada o
//    su panel) y ve qué le toca, a qué hora llegar, dónde, con quién y qué hacer.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611080205";
import { CONCURSOS, porId } from "./concursos.js?v=202611080205";
import { TALLERES } from "./talleres.js?v=202611080205";
import { CHARLAS } from "./charlas.js?v=202611080205";
import { ENTREGABLES } from "./entregables.js?v=202611080205";
import { AREAS, nivel } from "./permisos.js?v=202611080205";
import { $, $$, esc, I, IMG, aviso, modal, confirmar } from "./ui.js?v=202611080205";

export const DIAS = {
  d1: { txt: "Día 1 · Martes 24 de noviembre", corto: "Mar 24/11", fecha: "2026-11-24" },
  d2: { txt: "Día 2 · Jueves 26 de noviembre", corto: "Jue 26/11", fecha: "2026-11-26" },
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
    `Tu código: *${k.codigo}*`, `Entra a ${URL_PANEL()} → botón *Voluntarios · Día D* y escribe tu código para ver tu guía completa (qué hacer, dónde y con quién).`, "",
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
export function crearDiaD(ctx) {
  let D = null, sub = "cronograma", filtroDia = "todos", filtroTipo = "", soloSin = false;
  const cod = () => ctx.codigo();
  async function cargar() { D = await api.adminDiad(cod()); D.tareas.forEach((t) => (t.personas ||= [])); }
  const persona = (id) => D.personas.find((p) => p.id === id);
  const tareasDe = (k) => D.tareas.filter((t) => t.personas.includes(k.id)).sort(ordenT);

  async function vista(v) {
    if (!D) { v.innerHTML = `<div class="cargando"><div class="giro"></div>Cargando el Día D…</div>`; try { await cargar(); } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`; return; } }
    pintar(v);
  }
  function pintar(v) {
    const asignadas = new Set(D.tareas.flatMap((t) => t.personas)), sinNadie = D.tareas.filter((t) => !t.personas.length).length;
    const sinLugar = D.tareas.filter((t) => !t.lugar).length, sinTarea = D.personas.filter((k) => !asignadas.has(k.id)).length;
    v.innerHTML = `<div class="cabeza" style="margin-top:0"><div><h1>Día D</h1><p>Quién hace qué, dónde y a qué hora el <b>24 y 26 de noviembre</b>. Las personas son las mismas de <b>Entregas → Accesos limitados</b>; si alguien no está, créalo aquí como voluntario. Cada uno entra con su código por el botón <b>Voluntarios · Día D</b> de la portada y ve su guía.</p></div>
      <div class="acciones">${D.tareas.length ? "" : `<button class="btn btn--naranja" data-sugeridas>${I.mas}Cargar cronograma sugerido</button>`}<button class="btn ${D.tareas.length ? "btn--naranja" : ""}" data-nueva>${I.mas}Nueva tarea</button><button class="btn" data-plan>${I.descargar}Imprimir plan</button></div></div>
      <div class="kpis">
        <div class="kpi"><b>${D.tareas.length}</b><span>tareas en el cronograma</span></div>
        <div class="kpi"><b>${asignadas.size}</b><span>personas con tarea</span></div>
        <div class="kpi ${sinNadie ? "kpi--alerta" : ""}"><b>${sinNadie}</b><span>tareas sin nadie asignado</span></div>
        <div class="kpi"><b>${sinLugar}</b><span>con lugar por confirmar</span></div>
        <div class="kpi"><b>${sinTarea}</b><span>personas sin tarea</span></div>
      </div>
      <div class="pestanas pestanas--sub" role="tablist">
        <button class="pestana" data-sub="cronograma" aria-selected="${sub === "cronograma"}">${I.reloj}Cronograma y tareas</button>
        <button class="pestana" data-sub="personas" aria-selected="${sub === "personas"}">${I.personas}Personas (${D.personas.length})</button>
        <button class="pestana" data-sub="general" aria-selected="${sub === "general"}">${I.info}Datos generales</button></div>
      <div data-cuerpo></div>`;
    $$("[data-sub]", v).forEach((b) => (b.onclick = () => { sub = b.dataset.sub; pintar(v); }));
    $("[data-nueva]", v).onclick = () => formTarea(null, v);
    $("[data-plan]", v).onclick = () => imprimirPlan();
    $("[data-sugeridas]", v)?.addEventListener("click", () => cargarSugeridas(v));
    const c = $("[data-cuerpo]", v);
    if (sub === "cronograma") pintarCronograma(c, v); else if (sub === "personas") pintarPersonas(c, v); else pintarGeneral(c, v);
  }

  // ----- Cronograma -----
  function pintarCronograma(c, v) {
    let lista = [...D.tareas].sort(ordenT);
    if (filtroDia !== "todos") lista = lista.filter((t) => t.dia === filtroDia);
    if (filtroTipo) lista = lista.filter((t) => t.tipo === filtroTipo);
    if (soloSin) lista = lista.filter((t) => !t.personas.length);
    const filtros = `<div class="dd-filtros">
      <div class="segm">${[["todos", "Los 2 días"], ["d1", DIAS.d1.corto], ["d2", DIAS.d2.corto]].map(([k, t]) => `<button type="button" data-fd="${k}" class="${filtroDia === k ? "activo" : ""}">${t}</button>`).join("")}</div>
      <div class="segm"><button type="button" data-ft="" class="${!filtroTipo ? "activo" : ""}">Todo</button>${Object.entries(TIPOS).map(([k, t]) => `<button type="button" data-ft="${k}" class="${filtroTipo === k ? "activo" : ""}">${t.txt}</button>`).join("")}</div>
      <label class="chip" style="cursor:pointer"><input type="checkbox" data-sin ${soloSin ? "checked" : ""}> Solo sin asignar</label></div>`;
    if (!D.tareas.length) {
      c.innerHTML = `<div class="vacio"><b>Aún no hay tareas</b>Pulsa <b>Cargar cronograma sugerido</b>: trae la agenda oficial (registro, inauguración, charlas, talleres, concursos, Gymkana y premiación) con las funciones típicas (coordinador de sala, micrófonos, apoyo al ponente…). Luego solo asignas personas y corriges lo que quieras.</div>`;
      return;
    }
    const grupos = []; lista.forEach((t) => { const k = `${t.dia}|${t.hora_ini}|${t.bloque}`; let g = grupos.find((x) => x.k === k); if (!g) grupos.push((g = { k, t, items: [] })); g.items.push(t); });
    let diaPrev = "";
    c.innerHTML = filtros + (grupos.length ? grupos.map((g) => {
      const cab = g.t.dia !== diaPrev ? `<h2 class="dd-dia">${esc(DIAS[g.t.dia].txt)}</h2>` : ""; diaPrev = g.t.dia;
      const lugares = [...new Set(g.items.map((t) => t.lugar).filter(Boolean))];
      return `${cab}<section class="dd-momento tarjeta">
        <div class="dd-momento__cab"><span class="dd-momento__hora">${esc(rango(g.t))}</span><b>${esc(g.t.bloque || "Sin momento")}</b>
          <span class="dd-momento__lugar">${lugares.length ? `📍 ${esc(lugares.join(" · "))}` : `<span class="dd-pc">📍 Lugar por confirmar</span>`}</span>
          <button class="btn btn--mini" data-mas-rol="${esc(g.items[0].id)}" title="Agregar otra función en este momento">${I.mas}Función</button></div>
        ${g.items.map((t) => {
          const choques = t.personas.filter((pid) => D.tareas.some((o) => o.personas.includes(pid) && cruza(o, t)));
          return `<div class="dd-tarea ${t.personas.length ? "" : "dd-tarea--vacia"}">
          <div class="dd-tarea__info"><b>${esc(t.rol || "Función")}</b>
            <div class="dd-tarea__meta">${tipoChip(t.tipo)}${t.concurso_id ? `<span class="chip">${esc(porId(t.concurso_id)?.nombre || t.concurso_id)}</span>` : ""}<small>llegar ${t.llegar_min ?? 10} min antes · ${esc(llegada(t))}</small>${t.lugar && lugares.length > 1 ? `<small>· ${esc(t.lugar)}</small>` : ""}</div></div>
          <div class="dd-tarea__gente">${t.personas.map((pid) => { const k = persona(pid); return k ? `<span class="dd-per ${choques.includes(pid) ? "dd-per--choque" : ""}" title="${choques.includes(pid) ? "Tiene otra tarea a la misma hora" : esc(k.area || "")}">${esc(k.nombre)}${choques.includes(pid) ? " ⚠" : ""}<button data-quitar="${t.id}|${pid}" aria-label="Quitar a ${esc(k.nombre)}">×</button></span>` : ""; }).join("") || `<span class="dd-pc">Nadie asignado</span>`}</div>
          <div class="dd-tarea__acc"><button class="btn btn--mini btn--naranja" data-asignar="${t.id}">${I.personas}Asignar</button><button class="btn btn--mini btn--icono" data-editar="${t.id}" title="Editar tarea" aria-label="Editar tarea">${I.lapiz}</button></div>
        </div>`; }).join("")}</section>`;
    }).join("") : `<div class="vacio"><b>Nada con ese filtro</b></div>`);
    $$("[data-fd]", c).forEach((b) => (b.onclick = () => { filtroDia = b.dataset.fd; pintarCronograma(c, v); }));
    $$("[data-ft]", c).forEach((b) => (b.onclick = () => { filtroTipo = b.dataset.ft; pintarCronograma(c, v); }));
    $("[data-sin]", c).onchange = (e) => { soloSin = e.target.checked; pintarCronograma(c, v); };
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
    if (!(await confirmar("¿Cargar el cronograma sugerido?", `Se agregan ${sugeridas().length} tareas con la agenda oficial del evento (registro, inauguración, charlas, talleres, concursos, Gymkana y premiación). Después asignas personas, cambias lugares o borras lo que no uses.`, { boton: "Cargar" }))) return;
    try { const n = await api.adminDiadCargar(cod(), sugeridas()); await cargar(); pintar(v); aviso(`${n} tareas cargadas`); } catch (e) { aviso(e.message, "error"); }
  }

  function formTarea(t, v) {
    const n = t || { dia: "d1", hora_ini: "", hora_fin: "", bloque: "", rol: "", tipo: "general", concurso_id: "", lugar: "", llegar_min: 10, indicaciones: "", personas: [] };
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
      try { await guardarTarea(x); m.cerrar(); pintar(v); aviso(n.id ? "Tarea guardada" : "Tarea creada"); } catch (ex) { $(".error", f).textContent = ex.message; }
    };
  }

  // ----- Asignar personas (de Accesos limitados o nuevas) -----
  function asignar(t, v) {
    const sel = new Set(t.personas);
    const c = t.concurso_id && ENTREGABLES[t.concurso_id] ? porId(t.concurso_id) : null, esSala = c && /coordinador/i.test(t.rol);
    const fila = (k) => {
      const otras = tareasDe(k).filter((o) => o.id !== t.id), choque = otras.find((o) => cruza(o, t));
      return `<label class="dd-elegir ${sel.has(k.id) ? "dd-elegir--si" : ""}" data-nombre="${esc((k.nombre + " " + (k.area || "")).toLowerCase())}">
        <input type="checkbox" value="${k.id}" ${sel.has(k.id) ? "checked" : ""}>
        <span><b>${esc(k.nombre)}</b> ${k.area ? `<small class="chip">${esc(k.area)}</small>` : ""} ${esVoluntario(k) ? `<small class="chip chip--verde">Voluntario</small>` : `<small class="chip chip--celeste">Acceso con panel</small>`}
        <small class="tenue">${otras.length ? `${otras.length} ${otras.length === 1 ? "tarea" : "tareas"} más` : "Sin otras tareas"}${choque ? ` · <b style="color:#FFD98A">⚠ choca con «${esc(choque.rol || choque.bloque)}» (${esc(rango(choque))})</b>` : ""}</small></span></label>`;
    };
    const m = modal(`<h2>Asignar personas</h2>
      <p class="ayuda" style="margin-top:-6px"><b>${esc(t.rol || "Función")}</b> · ${esc(t.bloque)} · ${esc(DIAS[t.dia].corto)} ${esc(rango(t))}</p>
      <input class="dd-buscar" type="search" placeholder="Buscar por nombre o área…" data-buscar>
      <div class="dd-lista-elegir">${D.personas.map(fila).join("") || `<div class="vacio" style="padding:14px"><b>Aún no hay personas</b>Créalas abajo.</div>`}</div>
      ${esSala ? `<label class="chip chip--ambar" style="cursor:pointer;margin-top:10px"><input type="checkbox" data-dar-entregas checked> Darles acceso a <b>Entregas · ${esc(c.nombre)}</b> (códigos de equipo y tiempo oficial)</label>` : ""}
      <details class="dd-nueva" ${D.personas.length ? "" : "open"}><summary>${I.mas} ¿No está en la lista? Crear persona nueva</summary>
        <form class="form" data-nueva-per>
          <div class="dd-fila3"><label class="campo"><span>Nombre y apellido</span><input name="nombre" maxlength="120" required></label>
          <label class="campo"><span>Área</span><select name="area"><option value="">—</option>${AREAS_ORG.map((a) => `<option>${a}</option>`).join("")}<option value="Otra">Otra</option></select></label>
          <label class="campo"><span>Celular (opcional)</span><input name="tel" maxlength="30" inputmode="tel" placeholder="9XX XXX XXX"></label></div>
          <label class="campo"><span>Código (opcional)</span><input name="cod" maxlength="16" autocomplete="off" placeholder="Vacío = se genera uno automático" style="font-family:var(--neon);letter-spacing:.15em;text-transform:uppercase"></label>
          <p class="ayuda" style="margin:0">Se crea como <b>voluntario</b> (solo ve su guía del Día D) y aparece también en Entregas → Accesos limitados.</p>
          <button class="btn">${I.mas}Crear y marcar</button><p class="error"></p></form></details>
      <div class="modal__acciones"><button type="button" class="btn" data-cancelar>Cancelar</button><button type="button" class="btn btn--naranja" data-ok>${I.check}Guardar asignación</button></div>`, { ancho: true });
    const lista = $(".dd-lista-elegir", m.el);
    const enlazar = () => $$("input[type=checkbox]", lista).forEach((x) => (x.onchange = () => { if (x.checked) sel.add(x.value); else sel.delete(x.value); x.closest(".dd-elegir").classList.toggle("dd-elegir--si", x.checked); }));
    enlazar();
    $("[data-buscar]", m.el).oninput = (e) => { const q = e.target.value.toLowerCase().trim(); $$(".dd-elegir", lista).forEach((el) => (el.hidden = q && !el.dataset.nombre.includes(q))); };
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    const fn = $("[data-nueva-per]", m.el);
    fn.onsubmit = async (e) => {
      e.preventDefault(); const b = $("button", fn); b.disabled = true;
      try {
        const codigoFijo = fn.cod.value.replace(/\s/g, "").toUpperCase() || null;
        const r = await api.adminCoordinador(cod(), { nombre: fn.nombre.value.trim(), concursos: [], permisos: { diad: "ver" }, codigoFijo });
        if (fn.area.value || fn.tel.value.trim()) await api.adminDiadPersona(cod(), r.id, fn.area.value, fn.tel.value.trim());
        await cargar(); sel.add(r.id);
        lista.innerHTML = D.personas.map(fila).join(""); enlazar(); fn.reset(); $(".error", fn).textContent = "";
        aviso(`Creado · código ${r.codigo}`);
      } catch (ex) { $(".error", fn).textContent = ex.message; } finally { b.disabled = false; }
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

  // ----- Personas -----
  function pintarPersonas(c, v) {
    const chips = (k) => [esVoluntario(k) ? `<span class="chip chip--verde">Voluntario · solo guía</span>` : "", ...AREAS.filter((a) => !a.guia && nivel(k, a.id)).map((a) => `<span class="chip chip--celeste">${esc(a.txt)}</span>`),
      ...(k.concursos || []).map((x) => `<span class="chip chip--ambar">Entregas · ${esc(porId(x)?.nombre || x)}</span>`)].join(" ");
    c.innerHTML = `<div class="acciones" style="margin-bottom:12px"><button class="btn btn--naranja" data-per-nueva>${I.mas}Nuevo voluntario</button><button class="btn" data-ir-accesos>${I.llave}Cambiar permisos (Entregas → Accesos limitados)</button></div>
      ${D.personas.length ? `<div class="tabla-envoltura"><table class="tabla dd-tabla"><thead><tr><th>Persona</th><th>Código</th><th>Acceso</th><th>Tareas del Día D</th><th></th></tr></thead><tbody>
      ${D.personas.map((k) => { const ts = tareasDe(k); return `<tr>
        <td><b>${esc(k.nombre)}</b><br><small class="tenue">${esc(k.area || "Sin área")}${k.telefono ? ` · ${esc(k.telefono)}` : ""}</small></td>
        <td style="white-space:nowrap"><code class="en-codigo">${esc(k.codigo)}</code> <button class="btn btn--mini btn--icono" data-cop="${esc(k.codigo)}" title="Copiar código" aria-label="Copiar código">${I.copiar}</button></td>
        <td><div class="reparto" style="margin:0">${chips(k)}</div></td>
        <td>${ts.length ? ts.map((t) => `<div class="dd-mini"><b>${esc(DIAS[t.dia].corto)} ${esc(hora(minutos(t.hora_ini)))}</b> ${esc(t.rol || t.bloque)}</div>`).join("") : `<span class="dd-pc">Sin tarea</span>`}</td>
        <td style="white-space:nowrap"><button class="btn btn--mini" data-ver-guia="${k.id}">${I.libro}Ver guía</button> <button class="btn btn--mini" data-wa="${k.id}" title="Copiar mensaje con su código y sus tareas para WhatsApp">${I.copiar}WhatsApp</button> <button class="btn btn--mini btn--icono" data-per-editar="${k.id}" title="Editar" aria-label="Editar">${I.lapiz}</button></td></tr>`; }).join("")}
      </tbody></table></div>` : `<div class="vacio"><b>Aún no hay personas</b>Crea voluntarios aquí o accesos en Entregas → Accesos limitados.</div>`}
      <p class="ayuda" style="margin-top:8px"><b>Voluntario</b> = solo ve su guía del Día D. Quien tiene <b>acceso con panel</b> (coordinador de sala, logística, proyección…) ve su guía en la pestaña <b>Mi Día D</b> de su panel. El botón <b>WhatsApp</b> copia un mensaje listo con su código, el link y sus tareas.</p>`;
    $("[data-per-nueva]", c).onclick = () => formPersona(null, v);
    $("[data-ir-accesos]", c).onclick = () => ctx.irA?.("entregas");
    $$("[data-cop]", c).forEach((b) => (b.onclick = () => copiar(b.dataset.cop, "Código copiado")));
    $$("[data-ver-guia]", c).forEach((b) => (b.onclick = () => { const k = persona(b.dataset.verGuia); const mm = modal(`<p class="ayuda" style="margin:0 0 8px">Así ve <b>${esc(k.nombre)}</b> su guía al entrar con su código.</p>${htmlGuia(guiaDe(D, k), { vistaAdmin: true })}<div class="modal__acciones"><button class="btn" data-x>Cerrar</button></div>`, { ancho: true }); $("[data-x]", mm.el).onclick = mm.cerrar; }));
    $$("[data-wa]", c).forEach((b) => (b.onclick = () => copiar(mensajeWhatsApp(D, persona(b.dataset.wa)), "Mensaje copiado: pégalo en WhatsApp")));
    $$("[data-per-editar]", c).forEach((b) => (b.onclick = () => formPersona(persona(b.dataset.perEditar), v)));
  }
  function formPersona(k, v) {
    const m = modal(`<h2>${k ? "Editar persona" : "Nuevo voluntario"}</h2><form class="form">
      <label class="campo"><span>Nombre y apellido</span><input name="nombre" maxlength="120" required value="${esc(k?.nombre || "")}"></label>
      <div class="dd-fila3"><label class="campo"><span>Área</span><select name="area"><option value="">—</option>${[...AREAS_ORG, "Otra"].map((a) => `<option ${k?.area === a ? "selected" : ""}>${a}</option>`).join("")}${k?.area && ![...AREAS_ORG, "Otra"].includes(k.area) ? `<option selected>${esc(k.area)}</option>` : ""}</select></label>
      <label class="campo"><span>Celular</span><input name="tel" maxlength="30" inputmode="tel" value="${esc(k?.telefono || "")}"></label>
      <label class="campo"><span>Código ${k ? "" : "(opcional)"}</span><input name="cod" maxlength="16" autocomplete="off" value="${esc(k?.codigo || "")}" placeholder="Automático" style="font-family:var(--neon);letter-spacing:.12em;text-transform:uppercase"></label></div>
      ${k && !esVoluntario(k) ? `<p class="ayuda" style="margin:0">Sus permisos del panel se cambian en Entregas → Accesos limitados.</p>` : `<p class="ayuda" style="margin:0">Entra por el botón <b>Voluntarios · Día D</b> de la portada y solo ve su guía.</p>`}
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0">${k ? `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Quitar acceso</button>` : ""}<button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`);
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar(`¿Quitar el acceso de ${k.nombre}?`, "Su código dejará de funcionar y saldrá de sus tareas del Día D. No se borra nada de lo que hizo.", { boton: "Quitar acceso", peligro: true }))) return;
      try { await api.adminCoordinador(cod(), { id: k.id, borrar: true }); await cargar(); m.cerrar(); pintar(v); aviso("Acceso quitado"); } catch (e) { aviso(e.message, "error"); }
    });
    f.onsubmit = async (e) => {
      e.preventDefault();
      const c = f.cod.value.replace(/\s/g, "").toUpperCase();
      try {
        const r = await api.adminCoordinador(cod(), { id: k?.id || null, nombre: f.nombre.value.trim(), concursos: k?.concursos || [], permisos: k ? (k.permisos && Object.keys(k.permisos).length ? k.permisos : { diad: "ver" }) : { diad: "ver" }, codigoFijo: c && c !== k?.codigo ? c : null });
        await api.adminDiadPersona(cod(), r.id, f.area.value, f.tel.value.trim());
        await cargar(); m.cerrar(); pintar(v); aviso(k ? "Guardado" : `Voluntario creado · código ${r.codigo}`);
      } catch (ex) { $(".error", f).textContent = ex.message; }
    };
  }

  // ----- Datos generales -----
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

  // ----- Plan completo imprimible -----
  function imprimirPlan() {
    const w = window.open("", "_blank"); if (!w) return aviso("Permite las ventanas emergentes para imprimir", "error");
    const filas = (d) => [...D.tareas].filter((t) => t.dia === d).sort(ordenT).map((t) => `<tr><td><b>${esc(rango(t))}</b><br><small>llegar ${esc(llegada(t))}</small></td><td>${esc(t.bloque)}</td><td><b>${esc(t.rol)}</b><br><small>${esc(TIPOS[t.tipo]?.txt || "")}${t.concurso_id ? " · " + esc(porId(t.concurso_id)?.nombre || "") : ""}</small></td><td>${esc(t.lugar || "Por confirmar")}</td><td>${t.personas.map((p) => persona(p)).filter(Boolean).map((k) => `${esc(k.nombre)}${k.telefono ? ` <small>${esc(k.telefono)}</small>` : ""}`).join("<br>") || "<i>Sin asignar</i>"}</td></tr>`).join("");
    w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Plan del Día D · VI CONCEPMI</title><style>
      body{font-family:Poppins,Arial,sans-serif;color:#22163f;margin:18px;font-size:11px} h1{margin:0;color:#3b1395} h2{color:#6e2be6;margin:18px 0 6px}
      table{width:100%;border-collapse:collapse} th{background:#f1ecfd;text-align:left;padding:5px} td{border-bottom:1px solid #e4dcfa;padding:5px;vertical-align:top} small{color:#6a5a90} tr{page-break-inside:avoid}
      @page{size:A4 landscape;margin:10mm}</style></head><body><h1>Plan del Día D · VI CONCEPMI 2026</h1><p>${D.tareas.length} tareas · generado el ${new Date().toLocaleString("es-PE")}</p>
      ${Object.keys(DIAS).map((d) => `<h2>${DIAS[d].txt}</h2><table><thead><tr><th>Hora</th><th>Momento</th><th>Función</th><th>Lugar</th><th>Personas</th></tr></thead><tbody>${filas(d) || `<tr><td colspan=5>Sin tareas</td></tr>`}</tbody></table>`).join("")}
      <script>setTimeout(()=>print(),300)<\/script></body></html>`);
    w.document.close();
  }

  return { vista, recargar: async () => { D = null; } };
}

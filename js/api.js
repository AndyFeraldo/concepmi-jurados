// =========================================================
// Conexión a la base de datos.
// En GitHub Pages usa Supabase. En la vista previa (DEMO) usa
// datos de ejemplo guardados solo en tu navegador.
// =========================================================
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js?v=202610280411";
import { CONCURSOS, porId } from "./concursos.js?v=202610280411";
import { TALLERES } from "./talleres.js?v=202610280411";
import { CHARLAS, SEG_PREGUNTA, SEG_PAUSA, PUNTOS_PODIO } from "./charlas.js?v=202610280411";

const DEMO = typeof window !== "undefined" && window.__CONCEPMI_DEMO__ === true;

// ---------------- Real (Supabase) ----------------
let cliente = null;
async function rpc(fn, args) {
  if (!cliente) cliente = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
  const { data, error } = await cliente.rpc(fn, args);
  if (error) throw new Error(error.message || "No se pudo conectar con la base de datos");
  return data;
}

const real = {
  entrar: (codigo) => rpc("jur_entrar", { p_codigo: codigo }),
  datosJurado: (codigo) => rpc("jur_datos_jurado", { p_codigo: codigo }),
  calificar: (codigo, concurso, subprueba, delegacion, datos, comentario = "") =>
    rpc("jur_calificar", { p_codigo: codigo, p_concurso: concurso, p_subprueba: subprueba, p_delegacion: delegacion, p_datos: datos, p_comentario: comentario }),
  adminDatos: (codigo) => rpc("jur_admin_datos", { p_codigo: codigo }),
  adminDelegacion: (codigo, id, nombre, siglas, borrar = false) =>
    rpc("jur_admin_delegacion", { p_codigo: codigo, p_id: id, p_nombre: nombre, p_siglas: siglas, p_borrar: borrar }),
  adminJurado: (codigo, { id = null, nombre = "", concursos = [], descripcion = "", foto = null, borrar = false, nuevoCodigo = false, codigoFijo = null }) =>
    rpc("jur_admin_jurado", { p_codigo: codigo, p_id: id, p_nombre: nombre, p_concursos: concursos, p_descripcion: descripcion, p_foto: foto, p_borrar: borrar, p_nuevo_codigo: nuevoCodigo, p_codigo_fijo: codigoFijo }),
  adminAjuste: (codigo, concurso, delegacion, a) =>
    rpc("jur_admin_ajuste", { p_codigo: codigo, p_concurso: concurso, p_delegacion: delegacion, p_retraso: !!a.retraso, p_walkover: !!a.walkover,
      p_descalificado: !!a.descalificado, p_valor: a.valor ?? null, p_nota: a.nota || "" }),
  adminConcurso: (codigo, concurso, abierto) => rpc("jur_admin_concurso", { p_codigo: codigo, p_concurso: concurso, p_abierto: abierto }),
  adminBorrarCalificaciones: (codigo, ids, motivo) => rpc("jur_admin_borrar_calificaciones", { p_codigo: codigo, p_ids: ids, p_motivo: motivo }),
  adminManual: (codigo, concurso, delegacion, datos, noPresento = false, borrar = false) =>
    rpc("jur_admin_manual", { p_codigo: codigo, p_concurso: concurso, p_delegacion: delegacion, p_datos: datos, p_no_presento: noPresento, p_borrar: borrar }),
  adminClave: (codigo, nueva) => rpc("jur_admin_clave", { p_codigo: codigo, p_nueva: nueva }),
  datosTallerista: (codigo) => rpc("jur_datos_tallerista", { p_codigo: codigo }),
  registrarTaller: (codigo, taller, integrantes) => rpc("jur_taller_registrar", { p_codigo: codigo, p_taller: taller, p_integrantes: integrantes }),
  adminTallerista: (codigo, { id = null, nombre = "", talleres = [], descripcion = "", foto = null, borrar = false, nuevoCodigo = false, codigoFijo = null }) =>
    rpc("jur_admin_tallerista", { p_codigo: codigo, p_id: id, p_nombre: nombre, p_talleres: talleres, p_descripcion: descripcion, p_foto: foto, p_borrar: borrar, p_nuevo_codigo: nuevoCodigo, p_codigo_fijo: codigoFijo }),
  adminTaller: (codigo, taller, abierto) => rpc("jur_admin_taller", { p_codigo: codigo, p_taller: taller, p_abierto: abierto }),
  // Trivia de charlas
  quizBuscar: (dni) => rpc("jur_quiz_buscar", { p_dni: dni }),
  quizEstado: (charla, dni = null, token = null) => rpc("jur_quiz_estado", { p_charla: charla, p_dni: dni, p_token: token }),
  quizUnirse: (charla, dni) => rpc("jur_quiz_unirse", { p_charla: charla, p_dni: dni }),
  quizPregunta: (charla, dni, token, orden) => rpc("jur_quiz_pregunta", { p_charla: charla, p_dni: dni, p_token: token, p_orden: orden }),
  quizResponder: (charla, dni, token, orden, opcion) => rpc("jur_quiz_responder", { p_charla: charla, p_dni: dni, p_token: token, p_orden: orden, p_opcion: opcion }),
  quizResultado: (charla, dni, token) => rpc("jur_quiz_resultado", { p_charla: charla, p_dni: dni, p_token: token }),
  adminQuiz: (codigo, charla) => rpc("jur_admin_quiz", { p_codigo: codigo, p_charla: charla }),
  adminCharla: (codigo, charla, accion) => rpc("jur_admin_charla", { p_codigo: codigo, p_charla: charla, p_accion: accion }),
  adminPreguntas: (codigo, charla, preguntas) => rpc("jur_admin_preguntas", { p_codigo: codigo, p_charla: charla, p_preguntas: preguntas }),
  adminAsistentes: (codigo, filas) => rpc("jur_admin_asistentes", { p_codigo: codigo, p_filas: filas }),
};

// ---------------- Vista previa (datos de ejemplo) ----------------
const CLAVE_DEMO = "concepmi-jurados-demo-v3";
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
const norm = (s) => String(s || "").replace(/\s/g, "").toUpperCase();
const espera = (ms = 250) => new Promise((r) => setTimeout(r, ms));
function semilla() {
  const ds = [["Universidad Nacional de Ingeniería", "UNI"], ["Universidad Nacional Mayor de San Marcos", "UNMSM"], ["Universidad de Lima", "ULIMA"],
    ["Pontificia Universidad Católica del Perú", "PUCP"], ["Universidad Nacional de Trujillo", "UNT"], ["Universidad de Ingeniería y Tecnología", "UTEC"]]
    .map(([nombre, siglas]) => ({ id: uid(), nombre, siglas }));
  const js = [
    { id: uid(), nombre: "María Fernanda Quispe", codigo: "JUR001", concursos: ["barras", "amateur-1"], descripcion: "PMP®, gerente de proyectos en el sector minero.", foto: "" },
    { id: uid(), nombre: "Carlos Alberto Ramírez", codigo: "JUR002", concursos: ["barras", "iathon", "proyectos"], descripcion: "Especialista en IA aplicada y mentor de startups.", foto: "" },
    { id: uid(), nombre: "Lucía Torres Vega", codigo: "JUR003", concursos: ["gymkana", "barras"], descripcion: "Coordinadora de actividades culturales del Student Club.", foto: "" },
  ];
  const cal = [];
  const add = (j, c, sp, d, datos) => cal.push({ id: uid(), concurso_id: c, subprueba: sp, delegacion_id: ds[d].id, jurado_id: js[j].id, datos,
    total: Object.values(datos).reduce((s, v) => s + Number(v), 0), comentario: "", actualizado: new Date(Date.now() - (cal.length + 1) * 95000).toISOString() });
  const niveles = [[20, 15, 20, 15, 20], [15, 15, 15, 20, 20], [20, 20, 15, 10, 10], [10, 15, 10, 15, 20]];
  niveles.forEach((n, d) => [0, 1].forEach((j) => add(j, "barras", "unica", d, { c1: n[0], c2: n[1], c3: n[2] - (j && d === 2 ? 5 : 0), c4: n[3], c5: n[4] })));
  add(0, "amateur-1", "unica", 0, { c1: 15, c2: 8, c3: 6, c4: 8, c5: 8, c6: 6 });
  add(0, "amateur-1", "unica", 2, { c1: 12, c2: 8, c3: 8, c4: 6, c5: 10, c6: 7 });
  const g = (d, sp, datos) => cal.push({ id: uid(), concurso_id: "gymkana", subprueba: sp, delegacion_id: ds[d].id, jurado_id: js[2].id, datos,
    total: datos.conteo ?? datos.segundos, comentario: "", actualizado: new Date(Date.now() - (cal.length + 1) * 60000).toISOString() });
  const rondas = [[1, 3, 6, 9], [4, 5, 12], [7, 8], [10, 13, 15], [2], [11, 14, 16]];
  rondas.forEach((r, d) => g(d, "sacos", { conteo: r.length, rondas: r }));
  [212, 187, 300, 241, 300, 199].forEach((s, d) => g(d, "pentatlon", { segundos: s, estaciones: s === 300 ? (d === 2 ? 4 : 3) : 5 }));
  return { admin: "ADMIN1", delegaciones: ds, jurados: js, calificaciones: cal,
    ajustes: [
      { concurso_id: "conocimientos", delegacion_id: ds[0].id, valor: 50, datos: { e1: { puntos: 31, rival: ds[2].id }, e2: { puntos: 19, rival: ds[3].id } } },
      { concurso_id: "conocimientos", delegacion_id: ds[3].id, valor: 44, datos: { e1: { puntos: 32, rival: ds[1].id }, e2: { puntos: 12, rival: ds[0].id } } },
      { concurso_id: "talent", delegacion_id: ds[2].id, valor: 4120, datos: { tiktok: 3250, instagram: 870, desempate: 0 } },
      { concurso_id: "talent", delegacion_id: ds[0].id, valor: 2890, datos: { tiktok: 2100, instagram: 790, desempate: 0 } },
    ].map((a) => ({ retraso: false, walkover: false, descalificado: false, nota: "", actualizado: new Date().toISOString(), ...a })),
    borrados: [],
    abiertos: Object.fromEntries(CONCURSOS.map((c) => [c.id, true])),
    talleristas: [{ id: uid(), nombre: "Ana Lucía Paredes", codigo: "TAL001", talleres: ["t1", "t2"], descripcion: "Agile coach y docente de IA aplicada.", foto: "" }],
    ganadores: [],
    talleresAbiertos: Object.fromEntries(TALLERES.map((t) => [t.id, true])),
    asistentes: ds.flatMap((d, i) => [1, 2].map((k) => ({ dni: `7000000${i}${k}`, codigo: `C${i}${k}`, nombre: `Asistente ${k} ${d.siglas}`, delegacion_id: d.id, delegacion_texto: d.siglas }))),
    charlas: {}, preguntas: preguntasDemo(), jugadores: [], respuestas: [] };
}
function preguntasDemo() {
  const base = [["¿Qué documento autoriza el inicio de un proyecto?", ["El acta de constitución", "El informe de cierre", "El backlog", "El plan de calidad"], 0],
    ["En Scrum, ¿quién maximiza el valor del producto?", ["El Scrum Master", "El Product Owner", "El cliente", "El equipo de QA"], 1],
    ["¿Cuál es la triple restricción?", ["Personas, procesos y tecnología", "Calidad, riesgo y moral", "Alcance, tiempo y costo", "Ventas y marketing"], 2]];
  return Object.fromEntries(CHARLAS.map((c) => [c.id, base.map(([texto, opciones, correcta]) => ({ texto, opciones, correcta }))]));
}
let mem = null;
function db() {
  if (mem) return mem;
  try { const s = localStorage.getItem(CLAVE_DEMO); if (s) mem = JSON.parse(s); } catch { /* sin almacenamiento */ }
  if (!mem) { mem = semilla(); try { localStorage.setItem(CLAVE_DEMO, JSON.stringify(mem)); } catch { /* sin almacenamiento */ } }
  mem.asistentes ||= []; mem.charlas ||= {}; mem.preguntas ||= preguntasDemo(); mem.jugadores ||= []; mem.respuestas ||= [];
  mem.talleristas ||= []; mem.ganadores ||= []; mem.talleresAbiertos ||= Object.fromEntries(TALLERES.map((t) => [t.id, true]));
  // Recupera jurados registrados en versiones anteriores de la vista previa
  for (const vieja of ["concepmi-jurados-demo-v1", "concepmi-jurados-demo-v2"]) {
    try {
      const o = JSON.parse(localStorage.getItem(vieja) || "null");
      for (const j of o?.jurados || []) if (!mem.jurados.some((x) => x.codigo === j.codigo)) mem.jurados.push({ ...j, recuperado: true });
    } catch { /* nada que recuperar */ }
  }
  return mem;
}
function guardar() { try { localStorage.setItem(CLAVE_DEMO, JSON.stringify(mem)); } catch { /* sin almacenamiento */ } }
const exigirAdmin = (c) => { if (norm(c) !== db().admin) throw new Error("Código de administrador incorrecto"); };
const juradoDe = (c) => { const j = db().jurados.find((x) => x.codigo === norm(c)); if (!j) throw new Error("Código de jurado incorrecto"); return j; };
const codigoUsado = (c, excepto = null) => [...db().jurados, ...db().talleristas].some((x) => x.codigo === c && x.id !== excepto);
const nuevoCodigo = () => { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c; do { c = Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join(""); } while (codigoUsado(c)); return c; };
const talleristaDe = (c) => { const t = db().talleristas.find((x) => x.codigo === norm(c)); if (!t) throw new Error("Código de tallerista incorrecto"); return t; };

const quizC = (id) => (db().charlas[id] ||= {});
const PAUSA = SEG_PAUSA * 1000, SEG = SEG_PREGUNTA * 1000;
function quizAvanzar(id) {
  const d = db(), c = quizC(id), n = d.preguntas[id].length;
  for (let k = 0; k < 60 && c.estado === "jugando" && (c.pregunta || 0) < n; k++) {
    const ini = Date.parse(c.pregunta_inicio); if (Date.now() < ini) break;
    const fin = ini + SEG;
    if (Date.now() >= fin + 1500) { c.pregunta++; c.pregunta_inicio = new Date(fin + PAUSA).toISOString(); continue; }
    const jug = d.jugadores.filter((j) => j.charla_id === id).length;
    const resp = d.respuestas.filter((r) => r.charla_id === id && r.orden === c.pregunta).length;
    if (!jug || resp < jug) break;
    c.pregunta++; c.pregunta_inicio = new Date(Date.now() + PAUSA).toISOString();
  }
  guardar();
}
function quizFase(id) {
  const c = quizC(id); if (c.estado !== "jugando") return "espera";
  if (Date.now() < Date.parse(c.pregunta_inicio)) return c.pregunta ? "pausa" : "cuenta";
  if ((c.pregunta || 0) >= db().preguntas[id].length) return "terminada";
  return "jugando";
}
function quizJugador(charla, dni, token) {
  const j = db().jugadores.find((x) => x.charla_id === charla && x.dni === norm(dni) && x.token === token);
  if (!j) throw new Error("No estás en la sala de esta charla"); return j;
}
function quizRanking(charla) {
  const d = db(); const n = d.preguntas[charla].length;
  return d.jugadores.filter((j) => j.charla_id === charla).map((j) => {
    const rs = d.respuestas.filter((r) => r.charla_id === charla && r.dni === j.dni);
    return { dni: j.dni, nombre: j.nombre, delegacion_id: j.delegacion_id, unido: j.unido, aciertos: rs.filter((r) => r.correcta).length, respondidas: rs.length,
      tiempo_ms: rs.reduce((s, r) => s + r.ms, 0) + (n - rs.length) * SEG };
  }).sort((a, b) => b.aciertos - a.aciertos || a.tiempo_ms - b.tiempo_ms || a.unido - b.unido).map((x, i) => ({ ...x, puesto: i + 1 }));
}

const demo = {
  async entrar(codigo) { await espera(400); if (norm(codigo) === db().admin) return { rol: "admin" }; const j = db().jurados.find((x) => x.codigo === norm(codigo)); if (j) return { rol: "jurado", nombre: j.nombre };
    const t = db().talleristas.find((x) => x.codigo === norm(codigo)); return t ? { rol: "tallerista", nombre: t.nombre } : null; },
  async datosJurado(codigo) { await espera(); const j = juradoDe(codigo); const d = db();
    return { jurado: { ...j }, delegaciones: d.delegaciones, abiertos: d.abiertos, calificaciones: d.calificaciones.filter((x) => x.jurado_id === j.id) }; },
  async calificar(codigo, concurso, subprueba, delegacion, datos, comentario = "") {
    await espera(450); const j = juradoDe(codigo); const d = db();
    if (!j.concursos.includes(concurso)) throw new Error("No estás asignado a este concurso");
    if (!d.abiertos[concurso]) throw new Error("La calificación de este concurso ya está cerrada");
    const c = porId(concurso); let total = 0;
    if (c.modo === "rubrica") {
      const sp = c.subpruebas.find((s) => s.id === subprueba);
      for (const k of sp.criterios) { const v = Number(datos[k.id]); if (isNaN(v) || v < 0 || v > k.max) throw new Error("Puntaje fuera de rango en un criterio"); if (k.niveles && !k.niveles.some((n) => n.pts === v)) throw new Error("Nivel de desempeño no válido"); total += v; }
    } else if (concurso === "gymkana" && subprueba === "baileton") {
      for (const k of c.subpruebas.find((s) => s.id === "baileton").criterios) { const v = Number(datos[k.id]); if (!k.niveles.some((n) => n.pts === v)) throw new Error("Nivel de desempeño no válido"); total += v; }
    } else if (subprueba === "pentatlon") {
      if (!(datos.segundos > 0 && datos.segundos <= 300)) throw new Error("El tiempo va de 0:01 a 5:00");
      if (!(datos.estaciones >= 1 && datos.estaciones <= 5)) throw new Error("La estación va de 1 a 5");
      total = datos.segundos;
    } else total = Number(datos.conteo ?? datos.puesto ?? 0);
    let r = d.calificaciones.find((x) => x.concurso_id === concurso && x.subprueba === subprueba && x.delegacion_id === delegacion && x.jurado_id === j.id);
    if (!r) { r = { id: uid(), concurso_id: concurso, subprueba, delegacion_id: delegacion, jurado_id: j.id }; d.calificaciones.unshift(r); }
    Object.assign(r, { datos, total, comentario, actualizado: new Date().toISOString() });
    guardar(); return { id: r.id, total };
  },
  async adminDatos(codigo) { await espera(150); exigirAdmin(codigo); const d = db();
    return { concursos: CONCURSOS.map((c) => ({ id: c.id, abierto: d.abiertos[c.id] })), delegaciones: [...d.delegaciones].sort((a, b) => a.nombre.localeCompare(b.nombre)),
      jurados: d.jurados, calificaciones: [...d.calificaciones].sort((a, b) => new Date(b.actualizado) - new Date(a.actualizado)), ajustes: d.ajustes, borrados: d.borrados || [],
      talleres: TALLERES.map((t) => ({ id: t.id, abierto: d.talleresAbiertos[t.id] })), talleristas: d.talleristas, ganadores_talleres: d.ganadores,
      charlas: CHARLAS.map((c) => { const x = quizC(c.id); return { id: c.id, fase: quizFase(c.id), confirmado: x.confirmado || null, ganador_nombre: x.ganador_nombre || null, podio: x.podio || [],
        ganador_delegacion: x.ganador_delegacion || null, preguntas: d.preguntas[c.id].length, jugadores: d.jugadores.filter((j) => j.charla_id === c.id).length }; }),
      asistentes: { total: d.asistentes.length, sin_delegacion: d.asistentes.filter((a) => !a.delegacion_id).length } }; },
  async adminDelegacion(codigo, id, nombre, siglas, borrar = false) { await espera(); exigirAdmin(codigo); const d = db();
    if (borrar) { d.delegaciones = d.delegaciones.filter((x) => x.id !== id); d.calificaciones = d.calificaciones.filter((x) => x.delegacion_id !== id); }
    else if (!String(nombre).trim()) throw new Error("Escribe el nombre de la delegación");
    else if (id) Object.assign(d.delegaciones.find((x) => x.id === id), { nombre: nombre.trim(), siglas: siglas.trim().toUpperCase() });
    else d.delegaciones.push({ id: uid(), nombre: nombre.trim(), siglas: siglas.trim().toUpperCase() });
    guardar(); },
  async adminJurado(codigo, { id = null, nombre = "", concursos = [], descripcion = "", foto = null, borrar = false, nuevoCodigo: regen = false, codigoFijo = null }) {
    await espera(); exigirAdmin(codigo); const d = db();
    if (borrar) { d.jurados = d.jurados.filter((x) => x.id !== id); d.calificaciones = d.calificaciones.filter((x) => x.jurado_id !== id); guardar(); return null; }
    if (!String(nombre).trim()) throw new Error("Escribe el nombre completo del jurado");
    if (!concursos.length) throw new Error("Elige al menos un concurso");
    const fijo = norm(codigoFijo);
    if (fijo) {
      if (!/^[A-Z0-9-]{4,16}$/.test(fijo)) throw new Error("El código debe tener de 4 a 16 letras o números");
      if (fijo === d.admin) throw new Error("Ese código no se puede usar");
      if (codigoUsado(fijo, id)) throw new Error("Ese código ya lo tiene otro jurado o tallerista");
    }
    let j = id ? d.jurados.find((x) => x.id === id) : null;
    if (!j) { j = { id: uid(), codigo: nuevoCodigo(), foto: "" }; d.jurados.push(j); }
    Object.assign(j, { nombre: nombre.trim(), concursos, descripcion });
    if (foto != null) j.foto = foto;
    if (regen) j.codigo = nuevoCodigo();
    if (fijo) j.codigo = fijo;
    guardar(); return { id: j.id, codigo: j.codigo }; },
  async adminAjuste(codigo, concurso, delegacion, a) { await espera(); exigirAdmin(codigo); const d = db();
    let r = d.ajustes.find((x) => x.concurso_id === concurso && x.delegacion_id === delegacion);
    if (!r) { r = { concurso_id: concurso, delegacion_id: delegacion }; d.ajustes.push(r); }
    Object.assign(r, { retraso: !!a.retraso, walkover: !!a.walkover, descalificado: !!a.descalificado, valor: a.valor ?? null, nota: a.nota || "" }); guardar(); },
  async adminConcurso(codigo, concurso, abierto) { await espera(); exigirAdmin(codigo); db().abiertos[concurso] = abierto; guardar(); },
  async adminBorrarCalificaciones(codigo, ids, motivo) {
    await espera(); exigirAdmin(codigo); const d = db();
    if (String(motivo || "").trim().length < 4) throw new Error("Escribe el motivo del borrado");
    d.borrados = d.borrados || [];
    for (const x of d.calificaciones.filter((y) => ids.includes(y.id))) {
      d.borrados.unshift({ id: uid(), concurso_id: x.concurso_id, subprueba: x.subprueba, delegacion: d.delegaciones.find((z) => z.id === x.delegacion_id)?.nombre || "—",
        jurado: d.jurados.find((z) => z.id === x.jurado_id)?.nombre || "—", total: x.total, motivo: motivo.trim(), borrado: new Date().toISOString() });
    }
    const n = d.calificaciones.length; d.calificaciones = d.calificaciones.filter((y) => !ids.includes(y.id)); guardar(); return n - d.calificaciones.length;
  },
  async adminManual(codigo, concurso, delegacion, datos, noPresento = false, borrar = false) {
    await espera(); exigirAdmin(codigo); const d = db();
    if (borrar) { d.ajustes = d.ajustes.filter((a) => !(a.concurso_id === concurso && a.delegacion_id === delegacion)); guardar(); return; }
    let valor = null, limpio = {};
    if (!noPresento) {
      if (concurso === "conocimientos") {
        valor = 0;
        for (const e of ["e1", "e2"]) { const x = datos[e]; if (!x) continue;
          if (!(Number.isInteger(x.puntos) && x.puntos >= 0 && x.puntos <= 35)) throw new Error("Los puntos de cada enfrentamiento van de 0 a 35 (enteros)");
          limpio[e] = { puntos: x.puntos, rival: x.rival || "" }; valor += x.puntos; }
        if (!Object.keys(limpio).length) throw new Error("Registra los puntos de al menos un enfrentamiento");
      } else {
        if (!(datos.tiktok >= 0) || !(datos.instagram >= 0)) throw new Error("Escribe los likes de TikTok e Instagram (números desde 0)");
        limpio = { tiktok: datos.tiktok, instagram: datos.instagram, desempate: datos.desempate || 0 }; valor = datos.tiktok + datos.instagram;
      }
    }
    let r = d.ajustes.find((a) => a.concurso_id === concurso && a.delegacion_id === delegacion);
    if (!r) { r = { concurso_id: concurso, delegacion_id: delegacion, retraso: false, descalificado: false, nota: "" }; d.ajustes.push(r); }
    Object.assign(r, { walkover: !!noPresento, valor, datos: limpio, actualizado: new Date().toISOString() }); guardar();
  },
  async adminClave(codigo, nueva) { await espera(); exigirAdmin(codigo); if (norm(nueva).length < 6) throw new Error("El código debe tener al menos 6 caracteres"); db().admin = norm(nueva); guardar(); },
  async datosTallerista(codigo) { await espera(); const t = talleristaDe(codigo); const d = db();
    return { tallerista: { ...t }, delegaciones: [...d.delegaciones].sort((a, b) => a.nombre.localeCompare(b.nombre)), abiertos: d.talleresAbiertos,
      ganadores: d.ganadores.filter((g) => t.talleres.includes(g.taller_id)) }; },
  async registrarTaller(codigo, taller, integrantes) {
    await espera(450); const t = talleristaDe(codigo); const d = db();
    if (!t.talleres.includes(taller)) throw new Error("No estás asignado a este taller");
    if (!d.talleresAbiertos[taller]) throw new Error("El registro de este taller ya está cerrado");
    if (integrantes.length > 15) throw new Error("Máximo 15 integrantes por equipo");
    for (const x of integrantes) {
      if (!String(x.nombre || "").trim()) throw new Error("Escribe el nombre y apellido de cada integrante");
      if (!d.delegaciones.some((z) => z.id === x.delegacion)) throw new Error("Elige la delegación de cada integrante");
    }
    d.ganadores = d.ganadores.filter((g) => g.taller_id !== taller);
    d.ganadores.push({ taller_id: taller, integrantes: integrantes.map((x) => ({ nombre: x.nombre.trim(), delegacion: x.delegacion })), tallerista: t.nombre, actualizado: new Date().toISOString() });
    guardar(); },
  async adminTallerista(codigo, { id = null, nombre = "", talleres = [], descripcion = "", foto = null, borrar = false, nuevoCodigo: regen = false, codigoFijo = null }) {
    await espera(); exigirAdmin(codigo); const d = db();
    if (borrar) { d.talleristas = d.talleristas.filter((x) => x.id !== id); guardar(); return null; }
    if (!String(nombre).trim()) throw new Error("Escribe el nombre completo del tallerista");
    if (!talleres.length) throw new Error("Elige al menos un taller");
    const fijo = norm(codigoFijo);
    if (fijo) {
      if (!/^[A-Z0-9-]{4,16}$/.test(fijo)) throw new Error("El código debe tener de 4 a 16 letras o números");
      if (fijo === d.admin) throw new Error("Ese código no se puede usar");
      if (codigoUsado(fijo, id)) throw new Error("Ese código ya lo tiene otro jurado o tallerista");
    }
    let t = id ? d.talleristas.find((x) => x.id === id) : null;
    if (!t) { t = { id: uid(), codigo: nuevoCodigo(), foto: "" }; d.talleristas.push(t); }
    Object.assign(t, { nombre: nombre.trim(), talleres, descripcion });
    if (foto != null) t.foto = foto;
    if (regen) t.codigo = nuevoCodigo();
    if (fijo) t.codigo = fijo;
    guardar(); return { id: t.id, codigo: t.codigo }; },
  async adminTaller(codigo, taller, abierto) { await espera(); exigirAdmin(codigo); db().talleresAbiertos[taller] = abierto; guardar(); },
  // ---- Trivia (vista previa: el tiempo lo lleva este navegador) ----
  async quizBuscar(dni) { await espera(); const a = db().asistentes.find((x) => x.dni === norm(dni)); if (!a) return null;
    const d = db().delegaciones.find((x) => x.id === a.delegacion_id); return { nombre: a.nombre, codigo: a.codigo, delegacion: d ? { id: d.id, nombre: d.nombre, siglas: d.siglas } : null }; },
  async quizEstado(charla, dni = null, token = null) { await espera(80); quizAvanzar(charla); const d = db(); const c = quizC(charla); const f = quizFase(charla);
    const unido = d.jugadores.some((j) => j.charla_id === charla && j.dni === norm(dni) && j.token === token);
    const ant = unido && ["pausa", "terminada"].includes(f) && c.pregunta > 0 ? d.respuestas.find((r) => r.charla_id === charla && r.dni === norm(dni) && r.orden === c.pregunta - 1) : null;
    return { fase: f, ahora: new Date().toISOString(), seg: SEG_PREGUNTA, pregunta: c.pregunta || 0, inicio: c.pregunta_inicio || null,
      fin: c.pregunta_inicio ? new Date(Date.parse(c.pregunta_inicio) + SEG).toISOString() : null, preguntas: d.preguntas[charla].length,
      jugadores: d.jugadores.filter((j) => j.charla_id === charla).length, unido,
      respondida: unido && d.respuestas.some((r) => r.charla_id === charla && r.dni === norm(dni) && r.orden === (c.pregunta || 0)), anterior: ant ? ant.correcta : null }; },
  async quizUnirse(charla, dni) { await espera(); const d = db();
    if (quizC(charla).estado === "jugando") throw new Error("La trivia ya empezó. Espera la siguiente charla.");
    const a = d.asistentes.find((x) => x.dni === norm(dni)); if (!a) throw new Error("No encontramos ese DNI en la lista de inscritos");
    if (!a.delegacion_id) throw new Error("Tu delegación aún no está registrada. Acércate al equipo organizador.");
    if (d.jugadores.some((j) => j.charla_id === charla && j.dni === a.dni)) throw new Error("Este DNI ya está en la sala desde otro celular");
    const token = uid(); d.jugadores.push({ charla_id: charla, dni: a.dni, token, nombre: a.nombre, delegacion_id: a.delegacion_id, unido: Date.now() }); guardar(); return { token }; },
  async quizPregunta(charla, dni, token, orden) { await espera(80); quizJugador(charla, dni, token); quizAvanzar(charla); const d = db(); const c = quizC(charla);
    if (quizFase(charla) !== "jugando" || orden !== c.pregunta) throw new Error("Esa pregunta no está disponible");
    const q = d.preguntas[charla][orden];
    return { orden, texto: q.texto, opciones: q.opciones, fin: new Date(Date.parse(c.pregunta_inicio) + SEG).toISOString(), ahora: new Date().toISOString(),
      respondida: d.respuestas.some((r) => r.charla_id === charla && r.dni === norm(dni) && r.orden === orden) }; },
  async quizResponder(charla, dni, token, orden, opcion) { await espera(80); quizJugador(charla, dni, token); quizAvanzar(charla); const d = db(); const c = quizC(charla);
    if (c.estado !== "jugando" || orden !== c.pregunta) throw new Error("Se acabó el tiempo de esta pregunta");
    const ms = Date.now() - Date.parse(c.pregunta_inicio);
    if (ms < 0 || ms > SEG + 1500) throw new Error("Se acabó el tiempo de esta pregunta");
    if (!d.respuestas.some((r) => r.charla_id === charla && r.dni === norm(dni) && r.orden === orden))
      d.respuestas.push({ charla_id: charla, dni: norm(dni), orden, opcion, correcta: opcion === d.preguntas[charla][orden].correcta, ms: Math.min(ms, SEG) });
    guardar(); quizAvanzar(charla); },
  async quizResultado(charla, dni, token) { await espera(); quizJugador(charla, dni, token); quizAvanzar(charla); const d = db(); const c = quizC(charla);
    if (quizFase(charla) !== "terminada") throw new Error("La trivia aún no termina");
    const r = quizRanking(charla).find((x) => x.dni === norm(dni)); const mio = (c.podio || []).find((p) => p.dni === norm(dni));
    return { aciertos: r.aciertos, puesto: r.puesto, tiempo_ms: r.tiempo_ms, preguntas: d.preguntas[charla].length, jugadores: d.jugadores.filter((j) => j.charla_id === charla).length,
      confirmado: !!c.confirmado, ganador: c.ganador_nombre || null, pts: mio?.pts || 0 }; },
  async adminQuiz(codigo, charla) { await espera(80); exigirAdmin(codigo); quizAvanzar(charla); const d = db(); const c = quizC(charla);
    const resp = d.respuestas.filter((r) => r.charla_id === charla);
    return { fase: quizFase(charla), ahora: new Date().toISOString(), seg: SEG_PREGUNTA, pausa: SEG_PAUSA, pregunta: c.pregunta || 0, inicio: c.pregunta_inicio || null,
      fin: c.pregunta_inicio ? new Date(Date.parse(c.pregunta_inicio) + SEG).toISOString() : null, confirmado: c.confirmado || null,
      ganador_dni: c.ganador_dni || null, ganador_nombre: c.ganador_nombre || null, ganador_delegacion: c.ganador_delegacion || null, podio: c.podio || [],
      preguntas: d.preguntas[charla].map((q, orden) => ({ orden, ...q })),
      respuestas: [...new Set(resp.map((r) => r.orden))].map((orden) => ({ orden, n: resp.filter((r) => r.orden === orden).length, bien: resp.filter((r) => r.orden === orden && r.correcta).length })),
      ranking: quizRanking(charla) }; },
  async adminCharla(codigo, charla, accion) { await espera(); exigirAdmin(codigo); quizAvanzar(charla); const d = db(); const c = quizC(charla); const fase = quizFase(charla);
    if (accion === "iniciar") { if (c.estado === "jugando") throw new Error("La trivia ya se inició");
      Object.assign(c, { estado: "jugando", pregunta: 0, pregunta_inicio: new Date(Date.now() + 5000).toISOString() }); }
    else if (accion === "detener") { if (c.confirmado) throw new Error("Primero anula el resultado confirmado");
      d.respuestas = d.respuestas.filter((r) => r.charla_id !== charla); Object.assign(c, { estado: "espera", pregunta: 0, pregunta_inicio: null }); }
    else if (accion === "reiniciar" || accion === "borrar") { if (accion === "reiniciar" && c.confirmado) throw new Error("Primero anula el resultado confirmado");
      d.jugadores = d.jugadores.filter((j) => j.charla_id !== charla); d.respuestas = d.respuestas.filter((r) => r.charla_id !== charla); d.charlas[charla] = {}; }
    else if (accion === "confirmar") { if (fase !== "terminada") throw new Error("Espera a que termine la última pregunta");
      const pod = quizRanking(charla).slice(0, 3).map((r) => ({ puesto: r.puesto, dni: r.dni, nombre: r.nombre, delegacion_id: r.delegacion_id, aciertos: r.aciertos, tiempo_ms: r.tiempo_ms, pts: PUNTOS_PODIO[r.puesto - 1] }));
      if (!pod.length) throw new Error("Nadie participó en esta trivia");
      Object.assign(c, { podio: pod, ganador_dni: pod[0].dni, ganador_nombre: pod[0].nombre, ganador_delegacion: pod[0].delegacion_id, confirmado: new Date().toISOString() }); }
    else if (accion === "anular") Object.assign(c, { podio: [], ganador_dni: null, ganador_nombre: null, ganador_delegacion: null, confirmado: null });
    guardar(); },
  async adminPreguntas(codigo, charla, preguntas) { await espera(); exigirAdmin(codigo);
    if (quizC(charla).estado === "jugando") throw new Error("Reinicia la trivia antes de cambiar las preguntas");
    db().preguntas[charla] = preguntas.map((q) => ({ texto: q.texto, opciones: q.opciones, correcta: q.correcta })); guardar(); return preguntas.length; },
  async adminAsistentes(codigo, filas) { await espera(); exigirAdmin(codigo); const d = db(); let n = 0;
    for (const f of filas) { const dni = norm(f.dni); if (!dni || !String(f.nombre || "").trim()) continue;
      d.asistentes = d.asistentes.filter((a) => a.dni !== dni);
      d.asistentes.push({ dni, codigo: f.codigo || "", nombre: f.nombre.trim(), delegacion_id: f.delegacion_id || null, delegacion_texto: f.delegacion_texto || "" }); n++; }
    guardar(); return { importados: n, total: d.asistentes.length, sin_delegacion: d.asistentes.filter((a) => !a.delegacion_id).length }; },
  reiniciar() { mem = semilla(); guardar(); },
};

// En la vista previa cada llamada relee lo guardado, para que varias pestañas (admin y celulares) compartan el juego
for (const k of Object.keys(demo)) { const f = demo[k]; demo[k] = (...a) => { mem = null; return f(...a); }; }

export const api = DEMO ? demo : real;
export const ES_DEMO = DEMO;

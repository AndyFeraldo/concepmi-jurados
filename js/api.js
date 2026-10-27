// =========================================================
// Conexión a la base de datos.
// En GitHub Pages usa Supabase. En la vista previa (DEMO) usa
// datos de ejemplo guardados solo en tu navegador.
// =========================================================
import { SUPABASE_URL, SUPABASE_KEY } from "./config.js";
import { CONCURSOS, porId } from "./concursos.js";

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
    abiertos: Object.fromEntries(CONCURSOS.map((c) => [c.id, true])) };
}
let mem = null;
function db() {
  if (mem) return mem;
  try { const s = localStorage.getItem(CLAVE_DEMO); if (s) mem = JSON.parse(s); } catch { /* sin almacenamiento */ }
  if (!mem) mem = semilla();
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
const nuevoCodigo = () => { const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; let c; do { c = Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join(""); } while (db().jurados.some((j) => j.codigo === c)); return c; };

const demo = {
  async entrar(codigo) { await espera(400); if (norm(codigo) === db().admin) return { rol: "admin" }; const j = db().jurados.find((x) => x.codigo === norm(codigo)); return j ? { rol: "jurado", nombre: j.nombre } : null; },
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
      jurados: d.jurados, calificaciones: [...d.calificaciones].sort((a, b) => new Date(b.actualizado) - new Date(a.actualizado)), ajustes: d.ajustes, borrados: d.borrados || [] }; },
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
      if (d.jurados.some((x) => x.codigo === fijo && x.id !== id)) throw new Error("Ese código ya lo tiene otro jurado");
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
  reiniciar() { mem = semilla(); guardar(); },
};

export const api = DEMO ? demo : real;
export const ES_DEMO = DEMO;

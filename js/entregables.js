// =========================================================
// Entregables en línea de los concursos (lo que llenan los equipos)
// Amateur I: Acta de constitución (tipo "acta", ver js/acta.js).
// Amateur II: Matriz de riesgos y oportunidades (bases oficiales, punto 3.2).
// Datos guardados: { lider, filas: [{ tipo, riesgo, p, i, estrategia, plan, dueno, trigger }] }
// El ID (A1, A2… / O1, O2…) y la severidad (P × I) se calculan, no se escriben.
// =========================================================
export const ENTREGABLES = {
  "iathon": {
    tipo: "mvp",
    titulo: "Ficha del MVP · prompt maestro y link",
    corto: "Ficha del MVP", nombre: "ficha", plural: "fichas",
    minutos: 60,
    exposicion: "2 min de pitch + 2 min de preguntas",
    ayuda: "Analicen el caso, elijan UNA solución por consenso, pidan a la IA de su preferencia un PROMPT MAESTRO y construyan su MVP con la herramienta que quieran. Aquí registran la solución, el prompt y el link público del MVP, que se proyectará en su exposición.",
  },
  "amateur-1": {
    tipo: "acta",
    titulo: "Acta de constitución del proyecto",
    corto: "Acta de constitución", nombre: "acta", plural: "actas",
    minutos: 35,
    exposicion: "2 min de pitch + 2 min de preguntas",
    ayuda: "Lean el expediente del caso, debatan y completen las 10 secciones del acta bajo el estándar PMI. Al final, el Sponsor y el Director del proyecto (miembros del equipo) firman.",
  },
  "amateur-2": {
    tipo: "matriz",
    titulo: "Matriz de riesgos y oportunidades",
    corto: "Matriz de riesgos", nombre: "matriz", plural: "matrices",
    minutos: 35, filasIniciales: 8, maxFilas: 20,
    exposicion: "2 min de exposición + 2 min de preguntas",
    ayuda: "Riesgo = Causa, Evento de riesgo y Efecto (ej.: «Debido a [causa], podría ocurrir [evento], lo que ocasionaría [efecto]»). Severidad = P × I.",
  },
};
export const tieneEntregable = (cid) => !!ENTREGABLES[cid];

export const TIPOS = ["Amenaza", "Oportunidad"];
export const ESTRATEGIAS = { Amenaza: ["Evitar", "Mitigar", "Transferir"], Oportunidad: ["Explotar", "Compartir", "Mejorar", "Aceptar"] };
export const NIVELES = [["Bajo", 1, 5, "sev-bajo"], ["Moderado", 6, 11, "sev-mod"], ["Alto", 12, 19, "sev-alto"], ["Crítico", 20, 25, "sev-crit"]];

export const filaVacia = () => ({ tipo: "", riesgo: "", p: "", i: "", estrategia: "", plan: "", dueno: "", trigger: "" });
export const severidad = (f) => (Number(f.p) && Number(f.i) ? Number(f.p) * Number(f.i) : null);
export const nivel = (s) => (s == null ? null : NIVELES.find(([, a, b]) => s >= a && s <= b) || null);
export const filaUsada = (f) => Object.values(f || {}).some((v) => String(v ?? "").trim());

// IDs por orden de aparición: A1, A2… para amenazas y O1, O2… para oportunidades
export function conIds(filas = []) {
  let a = 0, o = 0;
  return filas.map((f) => ({ ...f, id: f.tipo === "Amenaza" ? `A${++a}` : f.tipo === "Oportunidad" ? `O${++o}` : "—", sev: severidad(f) }));
}

// Qué le falta a cada fila (para avisar antes de enviar)
export function faltantes(f) {
  const r = [];
  if (!f.tipo) r.push("tipo"); if (!String(f.riesgo).trim()) r.push("riesgo"); if (!f.p) r.push("P"); if (!f.i) r.push("I");
  if (!f.estrategia) r.push("estrategia"); if (!String(f.plan).trim()) r.push("plan"); if (!String(f.dueno).trim()) r.push("dueño"); if (!String(f.trigger).trim()) r.push("disparador");
  return r;
}

export function resumenMatriz(datos) {
  const filas = conIds((datos?.filas || []).filter(filaUsada));
  return {
    filas, total: filas.length,
    amenazas: filas.filter((f) => f.tipo === "Amenaza").length, oportunidades: filas.filter((f) => f.tipo === "Oportunidad").length,
    criticos: filas.filter((f) => (f.sev ?? 0) >= 20).length, altos: filas.filter((f) => (f.sev ?? 0) >= 12 && f.sev < 20).length,
    incompletas: filas.filter((f) => faltantes(f).length).length,
  };
}

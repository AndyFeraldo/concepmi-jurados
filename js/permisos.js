// =========================================================
// Accesos limitados personalizables: qué pestañas ve cada acceso y si puede editar.
// permisos = { pestaña: "ver" | "editar" }. Entregas va aparte (concursos que coordina).
// La base de datos exige lo mismo (jur_exigir_permiso): esconder botones es solo comodidad.
// =========================================================
export const AREAS = [
  { id: "vivo", txt: "En vivo", ver: "Avance de cada concurso y últimas calificaciones", editar: "Abrir y cerrar la calificación de los concursos" },
  { id: "resultados", txt: "Resultados", ver: "Tablas de resultados de cada concurso", editar: "Sanciones, registro manual, borrar calificaciones y traer Conocimientos" },
  { id: "copa", txt: "Copa CONCEPMI", ver: "Tabla general, ceremonia de premiación y Excel", editar: null },
  { id: "jurados", txt: "Jurados", ver: "Perfiles, concursos asignados y jurados que faltan (sin códigos)", editar: "Crear, editar y borrar jurados y ver sus códigos" },
  { id: "talleristas", txt: "Talleristas", ver: "Perfiles, talleres y ganadores (sin códigos)", editar: "Crear talleristas, ver códigos, abrir/cerrar y borrar resultados" },
  { id: "charlas", txt: "Charlas", ver: "Estado de las trivias, preguntas y podios", editar: "Iniciar o detener la trivia, confirmar podio, cargar preguntas e inscritos" },
  { id: "delegaciones", txt: "Delegaciones", ver: "Lista de delegaciones", editar: "Crear, editar y borrar delegaciones" },
  { id: "logistica", txt: "Logística", ver: "Presupuesto, gastos, comprobantes y reporte", editar: "Registrar compras, pagos, proveedores y comprobantes" },
];
export const AREA = Object.fromEntries(AREAS.map((a) => [a.id, a]));

// Plantillas rápidas para el formulario
export const PLANTILLAS = [
  { id: "sala", txt: "Coordinador de sala", permisos: {}, entregas: true, ayuda: "Solo Entregas del concurso que elijas" },
  { id: "rrpp", txt: "Relaciones públicas", permisos: { jurados: "ver", talleristas: "ver", charlas: "ver" }, ayuda: "Ve jurados, talleristas y charlas" },
  { id: "logistica", txt: "Logística", permisos: { logistica: "editar" }, ayuda: "Maneja la pestaña Logística" },
  { id: "lectura", txt: "Solo lectura (todo)", permisos: Object.fromEntries(AREAS.map((a) => [a.id, "ver"])), ayuda: "Ve todo, no cambia nada" },
];

// Nivel de un acceso en una pestaña: "" (no la ve), "ver" o "editar". Sin acceso = administrador.
export function nivel(acceso, area) {
  if (!acceso) return "editar";
  const v = acceso.permisos?.[area];
  if (v === "ver" || v === "editar") return v;
  return area === "logistica" && acceso.logistica ? "editar" : "";
}
export const puede = (acceso, area, que = "editar") => { const v = nivel(acceso, area); return v === "editar" || (que === "ver" && v === "ver"); };
// ¿El acceso usa el panel completo (con pestañas del admin) o solo Entregas / Logística?
export const usaPanel = (acceso) => AREAS.some((a) => a.id !== "logistica" && nivel(acceso, a.id));

// Modo «solo ver»: una clase en <body> esconde los botones de cambios de esa pestaña (ver css «ro-»)
export function soloVer(area) {
  document.body.className = document.body.className.replace(/\bro(-[a-z]+)?\b/g, "").trim();
  if (area) document.body.classList.add("ro", `ro-${area}`);
}

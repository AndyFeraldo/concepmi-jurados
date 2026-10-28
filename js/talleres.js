// =========================================================
// Talleres del VI CONCEPMI (los 4 son en paralelo)
// Cada integrante del equipo ganador suma PUNTOS_TALLER a su
// delegación (una vez por delegación y por taller).
// =========================================================
export const PUNTOS_TALLER = 40;

export const TALLERES = [
  { id: "t1", num: "I", color: "celeste", nombre: "IA Generativa & Prompt Engineering",
    sub: "Aplicado a la Gestión de Proyectos según PMBOK", lugar: "Laboratorio de Cómputo" },
  { id: "t2", num: "II", color: "naranja", nombre: "Frameworks Ágiles & Gestión Orientada al Valor",
    sub: "Simulador de Sprint Real", lugar: "Aula de Aprendizaje Colaborativo 1" },
  { id: "t3", num: "III", color: "violeta", nombre: "Clínica de CV & Empleabilidad 4.0",
    sub: "Estrategias de Marca Personal para Destacar en el Mercado de Proyectos", lugar: "Aula de Aprendizaje Colaborativo 2" },
  { id: "t4", num: "IV", color: "turquesa", nombre: "Power Skills & Pitch Ejecutivo",
    sub: "Comunicación de Impacto y Negociación para Liderar Equipos", lugar: "Aula de Aprendizaje Colaborativo 2" },
];
export const HORA_TALLERES = "11:30 a. m. – 1:00 p. m.";
export const tallerPorId = (id) => TALLERES.find((t) => t.id === id);
export const maxCopaTalleres = TALLERES.length * PUNTOS_TALLER;

// Delegaciones (sin repetir) del equipo ganador de un taller
export function delegacionesGanadoras(ganador) {
  return [...new Set((ganador?.integrantes || []).map((x) => x.delegacion).filter(Boolean))];
}

// { [delegacion_id]: { [taller_id]: puntos } }
export function puntosTalleres(ganadores = []) {
  const r = {};
  for (const g of ganadores) for (const d of delegacionesGanadoras(g)) (r[d] ||= {})[g.taller_id] = PUNTOS_TALLER;
  return r;
}

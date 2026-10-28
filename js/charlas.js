// =========================================================
// Charlas principales y su trivia tipo Kahoot
// Podio de cada trivia (más aciertos; empate: menor tiempo): al confirmar,
// 1.° +20, 2.° +10 y 3.° +5 para su delegación.
// Cada pregunta dura SEG_PREGUNTA; si todos responden, pasa a la siguiente.
// =========================================================
export const PUNTOS_PODIO = [20, 10, 5];
export const PUNTOS_CHARLA = PUNTOS_PODIO[0];
export const SEG_PREGUNTA = 15;
export const SEG_PAUSA = 3;

export const CHARLAS = [
  { id: "c1", num: "I", color: "celeste", nombre: "Gestión de Proyectos", lema: "Conecta · Inspira · Potencia",
    ponente: "Ing. Alexis Rodríguez", dia: "Día 1 · 24/11", hora: "10:15 – 11:30 a. m.", pilares: ["Ágil / Híbrido", "Gestión del valor", "PMBOK 8.ª ed."] },
  { id: "c2", num: "II", color: "naranja", nombre: "Networking y Liderazgo", lema: "Método · Valor · Resultados",
    ponente: "Giovannie Escribens", dia: "Día 2 · 26/11", hora: "2:30 – 3:30 p. m.", pilares: ["Redes de alto valor", "Liderazgo transformacional", "Marca personal"] },
  { id: "c3", num: "III", color: "violeta", nombre: "IA y Herramientas Tecnológicas", lema: "Automatiza · Analiza · Lidera",
    ponente: "Aldo Mallma", dia: "Día 2 · 26/11", hora: "6:00 – 7:00 p. m.", pilares: ["IA generativa", "Automatización de procesos", "Datos y análisis"] },
];
export const charlaPorId = (id) => CHARLAS.find((c) => c.id === id);
export const maxCopaCharlas = CHARLAS.length * PUNTOS_CHARLA;

// { [delegacion_id]: { [charla_id]: puntos } } — solo podios confirmados.
// Si dos del podio son de la misma delegación, se suman.
export function puntosCharlas(charlas = []) {
  const r = {};
  for (const c of charlas) {
    if (!c.confirmado) continue;
    for (const p of c.podio || []) if (p.delegacion_id) { const d = (r[p.delegacion_id] ||= {}); d[c.id] = (d[c.id] || 0) + Number(p.pts || 0); }
  }
  return r;
}

// Enlace que abre el QR
export const enlaceCharla = (id) => `${location.origin}${location.pathname}?charla=${id}`;

// Orden estable de las opciones para cada celular (mismo orden si recarga)
export function barajar(n, semilla) {
  let h = 2166136261;
  for (const ch of String(semilla)) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  const rnd = () => { h = Math.imul(h ^ (h >>> 15), 2246822507); h = Math.imul(h ^ (h >>> 13), 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; };
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

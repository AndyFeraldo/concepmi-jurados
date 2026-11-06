// Presupuesto de EJEMPLO, solo para la vista previa (modo demo). Cifras inventadas.
// El presupuesto real vive en Supabase (tablas jur_log_*) y solo se ve con un código válido.
export const SEMILLA_LOGISTICA = [
  { nombre: "Premios y reconocimientos", items: [
    { descripcion: "Constancias impresas", para: "Concursos académicos", tipo: "CV", cantidad: 20, cu: 2, notas: "" },
    { descripcion: "Medallas", para: "Podios", tipo: "CV", cantidad: 10, cu: 5, notas: "" },
    { descripcion: "Placas de reconocimiento", para: "Ganadores", tipo: "CV", cantidad: 3, cu: 20, notas: "" },
  ] },
  { nombre: "Catering", items: [
    { descripcion: "Coffee break", para: "Asistentes", tipo: "CV", cantidad: 1, cu: 500, notas: "" },
    { descripcion: "Almuerzos voluntarios", para: "Día 1 y 2", tipo: "CV", cantidad: 30, cu: 10, notas: "" },
  ] },
  { nombre: "Merch para asistentes", items: [
    { descripcion: "Tote bags", para: "Asistentes", tipo: "CV", cantidad: 100, cu: 2, notas: "" },
    { descripcion: "Libretas y lapiceros", para: "Asistentes", tipo: "CV", cantidad: 100, cu: 3, notas: "" },
  ] },
  { nombre: "Logística de concursos", items: [
    { descripcion: "Impresiones para participantes", para: "Amateur I y II", tipo: "CV", cantidad: 60, cu: 0.5, notas: "" },
    { descripcion: "Papelería de contingencia", para: "Concursos académicos", tipo: "CV", cantidad: 1, cu: 30, notas: "" },
  ] },
  { nombre: "Marketing y difusión", items: [
    { descripcion: "Flyers impresos", para: "Difusión", tipo: "CV", cantidad: 100, cu: 0.5, notas: "" },
    { descripcion: "Herramienta digital (1 mes)", para: "Página del evento", tipo: "CV", cantidad: 1, cu: 0, notas: "Ejemplo de ítem agregado después" },
  ] },
  { nombre: "Sede del evento", items: [
    { descripcion: "Alquiler de equipos de sonido", para: "Auditorio", tipo: "CF", cantidad: 1, cu: 300, notas: "" },
  ] },
];

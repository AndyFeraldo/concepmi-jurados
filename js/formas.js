// =========================================================
// Registro de entregables tipo «formulario» (por secciones). Todos comparten el mismo
// motor de equipo (autoguardado, tiempo, enviar), visor, proyector y PDF.
//  · acta → Amateur I (js/acta.js)   · mvp → IATHON (js/mvp.js)
// La matriz de riesgos (Amateur II) es otro tipo y no pasa por aquí.
// =========================================================
import { normalizarActa, limpiarActa, editorActa, enlazarActa, resumenActa, chipsActa, vistaActa } from "./acta.js?v=202611040224";
import { normalizarMvp, limpiarMvp, editorMvp, enlazarMvp, resumenMvp, chipsMvp, vistaMvp, textoResumenMvp, conectarEmbed } from "./mvp.js?v=202611040224";
import { ENTREGABLES } from "./entregables.js?v=202611040224";

export const FORMAS = {
  acta: {
    normalizar: normalizarActa, limpiar: limpiarActa, editor: editorActa, enlazar: enlazarActa, raiz: ".acta-ed",
    resumen: resumenActa, chips: chipsActa, vista: (d) => vistaActa(d), conectar: () => {},
    proyecto: (d) => d?.general?.nombre || "", etiquetaProyecto: "Proyecto",
    guia: "Cada sección muestra si está <b>Completa</b>, <b>Incompleta</b> o <b>Sin llenar</b>. Usen <b>Agregar</b> para sumar filas en las tablas.",
    textoResumen: (r) => `${r.completas} de ${r.total} secciones completas${r.firmas < 2 ? ` · <b style="color:#FFD98A">faltan ${2 - r.firmas} firma${2 - r.firmas === 1 ? "" : "s"}</b>` : " · firmas listas"}`,
    resumenPdf: (r) => `${r.completas}/${r.total} completas · firmas ${r.firmas}/2`,
  },
  mvp: {
    normalizar: normalizarMvp, limpiar: limpiarMvp, editor: editorMvp, enlazar: enlazarMvp, raiz: ".mvp-ed",
    resumen: resumenMvp, chips: chipsMvp, vista: (d, o) => vistaMvp(d, o), conectar: conectarEmbed,
    proyecto: (d) => d?.solucion?.nombre || "", etiquetaProyecto: "Solución",
    guia: "Completen las 4 secciones. Lo más importante: el <b>prompt maestro</b> y el <b>link público de su MVP</b>, que se abrirá en el proyector durante su exposición y que los jurados podrán probar.",
    textoResumen: textoResumenMvp,
    resumenPdf: (r) => `${r.completas}/${r.total} completas · ${r.linkOk ? "link listo" : "sin link"}`,
  },
};
export const formaDe = (concurso) => FORMAS[ENTREGABLES[concurso]?.tipo] || null;
export const formaTipo = (tipo) => FORMAS[tipo] || null;

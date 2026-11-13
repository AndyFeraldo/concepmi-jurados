// =========================================================
// Presentaciones de los TALLERES: el tallerista sube su PDF (el que se proyecta), PPT de respaldo
// y video opcional; lo proyecta él mismo desde su panel, o el admin, el coordinador de talleres
// (acceso con Talleristas) o el operador de Proyección. Mismo sistema de archivos privados y la
// misma pantalla de proyección que las charlas (js/sala-proyectos.js).
// =========================================================
import { api } from "./api.js?v=202611131348";
import { TALLERES, tallerPorId, HORA_TALLERES } from "./talleres.js?v=202611131348";
import { abrirSalaProyectos } from "./sala-proyectos.js?v=202611131348";
import { quitarArchivos } from "./presentacion.js?v=202611131348";
import { htmlArchivos, conectarArchivos } from "./ponente.js?v=202611131348";
import { $, esc, I, aviso, modal } from "./ui.js?v=202611131348";

export const MIN_TALLER = { exp: 80, preg: 10 }; // 11:30 – 1:00 = 90 min
export const INFO_TALLER = {
  pdf: { t: "Presentación en PDF · ES LA QUE SE PROYECTA", d: "Exporta tu PowerPoint a PDF (Archivo → Exportar → PDF). En el aula se proyecta este PDF a pantalla completa y pasas las diapositivas con el puntero o las flechas. Las animaciones no se ven: si algo debe aparecer por partes, ponlo en diapositivas seguidas." },
  ppt: { d: "Tu archivo .pptx original, por si hace falta abrirlo en la laptop del aula." },
};
const listos = (p) => ["pdf", "ppt", "video"].filter((t) => p?.[t]).length;
export const nombresTalleristas = (p) => (p?.talleristas || []).map((x) => x.nombre).join(" y ");

// Un taller = un «turno» de la pantalla de proyección
export function itemsTalleres(pres) {
  return pres.map((p) => { const t = tallerPorId(p.id); const x = p.talleristas?.[0];
    return { taller: t, equipo_id: p.id, delegacion: { siglas: nombresTalleristas(p) || "Tallerista por confirmar", nombre: `Taller ${t.num} · ${t.nombre}` },
      proyecto: p.titulo || t.sub, foto: x?.foto || "", pres: { pdf: p.pdf, ppt: p.ppt, video: p.video }, videoDespues: p.video_despues || "", minutos: MIN_TALLER }; });
}
export function proyectarTalleres(codigo, pres, inicialId = null) {
  if (!pres?.length) return aviso("No hay talleres para proyectar", "error");
  const items = itemsTalleres(pres), k = inicialId ? items.findIndex((x) => x.equipo_id === inicialId) : -1;
  abrirSalaProyectos({ equipos: items, concurso: "Talleres · VI CONCEPMI 2026", inicial: k >= 0 ? k : null, clase: "sala--ponencias", minutos: MIN_TALLER,
    url: (id, tipo) => api.tallerUrl(codigo, id, tipo), abrir: (id, tipo) => abrirTallerArchivo(codigo, id, tipo),
    textos: { orden: `Talleres en paralelo · ${HORA_TALLERES}`, exp: "Taller", preg: "Cierre y ganadores", btnExp: "Taller", btnPreg: "Cierre",
      corto: (j) => `Taller ${items[j].taller.num}`, num: (j) => items[j].taller.num, detalle: (j) => `${HORA_TALLERES} · ${items[j].taller.lugar}`,
      portada: (j) => `Taller <b>${items[j].taller.num}</b> · ${esc(items[j].taller.lugar)}`, cab: (j) => `Taller ${items[j].taller.num} · ${items[j].taller.nombre}` } });
}
export async function abrirTallerArchivo(codigo, taller, tipo) {
  const v = tipo === "ppt" ? null : window.open("", "_blank");
  try {
    const u = await api.tallerUrl(codigo, taller, tipo, tipo === "ppt");
    if (v) v.location.href = u; else { const a = document.createElement("a"); a.href = u; a.download = ""; document.body.append(a); a.click(); a.remove(); }
  } catch (e) { v?.close(); aviso(e.message, "error"); }
}

// Chips de estado para tarjetas (admin, coordinador, proyección)
export const chipsTaller = (p) => ["pdf", "ppt", "video"].map((t) => `<span class="chip ${p?.[t] ? "chip--verde" : t === "video" ? "" : "chip--ambar"}">${t === "video" ? "Video" : t.toUpperCase()} ${p?.[t] ? "✓" : t === "video" ? "—" : "pendiente"}</span>`).join("");

// Ventana «Archivos del taller» (admin o Talleristas editar: puede subir por el tallerista y quitar)
export function archivosTaller(codigo, p, { editable = true, listo = async () => null } = {}) {
  const t = tallerPorId(p.id);
  const m = modal(`<h2>Taller ${t.num} · ${esc(t.nombre)}</h2><p class="ayuda" style="margin-top:0">${nombresTalleristas(p) ? `Tallerista: <b>${esc(nombresTalleristas(p))}</b>. ` : ""}${editable ? "Normalmente los sube el tallerista con su código; si te los envió, puedes subirlos tú aquí." : "Solo puedes ver y proyectar estos archivos."}</p>
    <div data-caja></div>
    <div class="modal__acciones"><button class="btn btn--peligro" data-quitar-arch style="margin-right:auto" hidden>${I.basura}Quitar archivos</button><button class="btn" data-cerrar>Cerrar</button><button class="btn btn--naranja" data-proy>${I.vivo}Proyectar</button></div>`, { ancho: true });
  const caja = $("[data-caja]", m.el);
  const pintar = () => { caja.innerHTML = htmlArchivos(p, { videoDespues: false, editable, info: INFO_TALLER });
    $("[data-quitar-arch]", m.el).hidden = !editable || !listos(p); $("[data-proy]", m.el).disabled = !p.pdf;
    conectarArchivos(caja, { subir: (tipo, f, pr) => api.tallerSubir(codigo, p.id, tipo, f, pr), ver: (tipo) => abrirTallerArchivo(codigo, p.id, tipo), listo: refrescar }); };
  const refrescar = async () => { const r = await listo(); if (r) p = r; pintar(); };
  $("[data-quitar-arch]", m.el).onclick = () => quitarArchivos({ titulo: `Taller ${t.num}`, archivos: p, quitar: (tipos) => api.tallerQuitar(codigo, p.id, tipos),
    nota: "El taller, el tallerista y su código se conservan; podrá volver a subirlos.", listo: refrescar });
  $("[data-proy]", m.el).onclick = () => { m.cerrar(); proyectarTalleres(codigo, [p]); };
  $("[data-cerrar]", m.el).onclick = m.cerrar;
  pintar();
}
export { TALLERES };

// =========================================================
// Pantalla del PONENTE (puerta «Ponente» de la portada): ve su charla (día, hora y tiempo)
// y sube su presentación en PDF (la que se proyecta), su PPT de respaldo y un video opcional.
// Mismo sistema de archivos privados del Concurso de Proyectos (función Edge jur-presentaciones).
// =========================================================
import { api } from "./api.js?v=202611121132";

import { $, $$, esc, I, aviso, lanzarConfeti } from "./ui.js?v=202611121132";
import { mb, fechaLima } from "./presentacion.js?v=202611121132";


const INFO = {
  pdf: { ico: "PDF", t: "Presentación en PDF · ES LA QUE SE PROYECTA", d: "Exporta tu PowerPoint a PDF (Archivo → Exportar → PDF). En el auditorio se proyecta este PDF a pantalla completa y pasas las diapositivas con el puntero. Las animaciones no se ven: si algo debe aparecer por partes, ponlo en diapositivas seguidas.", acepta: ".pdf,application/pdf", ver: "Ver mi PDF" },
  ppt: { ico: "PPT", t: "PowerPoint (respaldo)", d: "Tu archivo .pptx original, por si hace falta abrirlo en la laptop del auditorio.", acepta: ".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint", ver: "Descargar mi PPT" },
  video: { ico: "▶", t: "Video (opcional)", d: "Si usas un video, súbelo en .mp4 (máx. 50 MB, ideal 720p). Se reproduce dentro de la pantalla después de la diapositiva que indiques.", acepta: ".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm", ver: "Ver mi video" },
};

// Tarjetas de archivos. o = ponente; subir(tipo, archivo, progreso) y ver(tipo) los da quien llama.
export function htmlArchivos(o, { videoDespues = true, editable = true, info = {} } = {}) {
  return `<div class="pres-slots">${["pdf", "ppt", "video"].map((tipo) => {
    const f = o[tipo], k = { ...INFO[tipo], ...(info[tipo] || {}) }, opcional = tipo === "video";
    return `<article class="tarjeta pres-slot ${f ? "pres-slot--ok" : ""} ${tipo === "pdf" ? "pres-slot--clave" : ""}" data-slot="${tipo}">
      <div class="pres-slot__ico pres-slot__ico--${tipo}">${k.ico}</div>
      <div class="pres-slot__txt"><h3>${k.t} <span class="chip ${f ? "chip--verde" : opcional ? "" : "chip--ambar"}">${f ? "✓ Subido" : opcional ? "Opcional" : "Pendiente"}</span></h3>
        <p>${k.d}</p>
        ${tipo === "video" && f && videoDespues ? `<label class="campo pres-despues"><span>Mostrar el video después de la diapositiva N.º</span><input data-video-despues inputmode="numeric" maxlength="3" value="${esc(o.video_despues || "")}" placeholder="Ej. 4" ${editable ? "" : "disabled"}></label>` : ""}
        ${f ? `<p class="pres-slot__arch"><b>${esc(f.nombre)}</b> · ${mb(f.tamano)} · subido ${fechaLima(f.subido)}</p>` : ""}
        <div class="pres-barra" data-barra hidden><i></i><span>0 %</span></div>
        <div class="pres-slot__acc">
          ${editable ? `<label class="btn ${f || opcional ? "" : "btn--naranja"}">${I.descargar}<span>${f ? "Reemplazar archivo" : "Elegir archivo"}</span><input type="file" data-archivo="${tipo}" accept="${k.acepta}" hidden></label>` : ""}
          ${f ? `<button class="btn" data-ver="${tipo}">${I.vivo}${k.ver}</button>` : ""}
        </div></div></article>`; }).join("")}</div>`;
}
export function conectarArchivos(raiz, { subir, ver, listo }) {
  $$("[data-ver]", raiz).forEach((b) => (b.onclick = () => ver(b.dataset.ver)));
  $$("[data-archivo]", raiz).forEach((inp) => (inp.onchange = async () => {
    const f = inp.files?.[0]; if (!f) return;
    const tipo = inp.dataset.archivo, caja = $(`[data-slot="${tipo}"]`, raiz), barra = $("[data-barra]", caja);
    if (f.size > 52428800) return aviso(`«${f.name}» pesa ${mb(f.size)}. El máximo es 50 MB: comprime las imágenes o el video.`, "error");
    barra.hidden = false; $$("button, label.btn", caja).forEach((x) => x.classList.add("deshabilitado"));
    try {
      await subir(tipo, f, (p) => { $("i", barra).style.width = `${Math.round(p * 100)}%`; $("span", barra).textContent = `${Math.round(p * 100)} %`; });
      lanzarConfeti(); aviso(`${tipo === "ppt" ? "PowerPoint" : tipo === "pdf" ? "PDF" : "Video"} subido`); await listo();
    } catch (e) { aviso(e.message, "error"); barra.hidden = true; $$(".deshabilitado", caja).forEach((x) => x.classList.remove("deshabilitado")); }
  }));
}
export async function abrirPonencia(codigo, ponente, tipo) {
  const v = tipo === "ppt" ? null : window.open("", "_blank");
  try {
    const u = await api.ponenciaUrl(codigo, ponente, tipo, tipo === "ppt");
    if (v) v.location.href = u; else { const a = document.createElement("a"); a.href = u; a.download = ""; document.body.append(a); a.click(); a.remove(); }
  } catch (e) { v?.close(); aviso(e.message, "error"); }
}


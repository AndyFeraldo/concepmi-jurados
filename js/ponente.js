// =========================================================
// Pantalla del PONENTE (puerta «Ponente» de la portada): ve su charla (día, hora y tiempo)
// y sube su presentación en PDF (la que se proyecta), su PPT de respaldo y un video opcional.
// Mismo sistema de archivos privados del Concurso de Proyectos (función Edge jur-presentaciones).
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611041659";
import { CHARLAS } from "./charlas.js?v=202611041659";
import { $, $$, esc, I, IMG, aviso, avatar, lanzarConfeti } from "./ui.js?v=202611041659";
import { mb, fechaLima } from "./presentacion.js?v=202611041659";

const charlaDe = (id) => CHARLAS.find((c) => c.id === id);
const INFO = {
  pdf: { ico: "PDF", t: "Presentación en PDF · ES LA QUE SE PROYECTA", d: "Exporta tu PowerPoint a PDF (Archivo → Exportar → PDF). En el auditorio se proyecta este PDF a pantalla completa y pasas las diapositivas con el puntero. Las animaciones no se ven: si algo debe aparecer por partes, ponlo en diapositivas seguidas.", acepta: ".pdf,application/pdf", ver: "Ver mi PDF" },
  ppt: { ico: "PPT", t: "PowerPoint (respaldo)", d: "Tu archivo .pptx original, por si hace falta abrirlo en la laptop del auditorio.", acepta: ".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint", ver: "Descargar mi PPT" },
  video: { ico: "▶", t: "Video (opcional)", d: "Si usas un video, súbelo en .mp4 (máx. 50 MB, ideal 720p). Se reproduce dentro de la pantalla después de la diapositiva que indiques.", acepta: ".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm", ver: "Ver mi video" },
};

// Tarjetas de archivos. o = ponente; subir(tipo, archivo, progreso) y ver(tipo) los da quien llama.
export function htmlArchivos(o, { videoDespues = true, editable = true } = {}) {
  return `<div class="pres-slots">${["pdf", "ppt", "video"].map((tipo) => {
    const f = o[tipo], k = INFO[tipo], opcional = tipo === "video";
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

export async function vistaPonente(app, codigo, salir) {
  let o = null, guardarT = null;
  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo tu ponencia…</div>`;
  const cargar = async () => { o = (await api.ponenteDatos(codigo)).ponente; };
  try { await cargar(); } catch (e) { aviso(e.message, "error"); return salir(); }
  function pintar() {
    const cs = o.charlas.map(charlaDe).filter(Boolean);
    app.innerHTML = `<div class="fondo fondo--sobrio"></div>
      <header class="barra"><img class="logo" src="${IMG.logo}" alt="CONCEPMI"><span class="sep"></span>
        <div><div class="barra__titulo">Ponente · VI CONCEPMI 2026</div><div class="barra__sub">${esc(o.nombre)}</div></div>
        <div class="der"><button class="btn btn--mini" data-salir>${I.salir}<span>Salir</span></button></div></header>
      <main class="contenedor eq">
        <section class="tarjeta pon-cab">
          ${avatar(o.nombre, o.foto, "pon-cab__foto")}
          <div><small>Bienvenido(a)</small><h1>${esc(o.nombre)}</h1>${o.descripcion ? `<p>${esc(o.descripcion)}</p>` : ""}</div>
        </section>
        <div class="pon-charlas">${cs.map((c) => `<article class="tarjeta pon-charla c-${c.color}">
          <span class="concurso__tipo">Charla magistral ${c.num}</span><h3>${esc(c.nombre)}</h3>
          <p>${esc(c.dia)} · ${esc(c.hora)} · UNMSM</p>
          <div class="reparto"><span class="chip chip--celeste">${c.minPonencia || 45} min de ponencia</span><span class="chip">${c.minPreguntas || 10} min de preguntas</span><span class="chip">Luego: trivia con el público</span></div></article>`).join("")}</div>
        <section class="tarjeta eq-cab"><label class="campo"><span>Título de tu ponencia (sale en la pantalla del auditorio)</span><input data-titulo maxlength="160" value="${esc(o.titulo || "")}" placeholder="Ej. El PMBOK 8 en la práctica"></label></section>
        ${htmlArchivos(o)}
        <details class="eq-guia" open><summary>${I.info} Para que todo salga perfecto en el auditorio</summary>
          <ul class="pres-tips">
            <li><b>Lo que se proyecta es tu PDF</b>, a pantalla completa, con el logo del evento y un cronómetro discreto. Usa formato <b>16:9</b>.</li>
            <li>Pasas las diapositivas con el <b>puntero</b> (→ siguiente, ← anterior). Tecla B: pantalla negra.</li>
            <li>Si tienes un <b>video</b>, súbelo aparte e indica después de qué diapositiva va: se reproduce solo al llegar ahí.</li>
            <li>Al final de tu charla viene una <b>trivia</b> para el público: si nos compartes tus ideas clave, armamos las preguntas con tu contenido.</li>
          </ul></details>
        <p class="ayuda" data-guardado></p>
      </main>
      ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $("[data-salir]", app).onclick = () => { clearTimeout(guardarT); salir(); };
    const guardar = () => { clearTimeout(guardarT); $("[data-guardado]", app).textContent = "Guardando…";
      guardarT = setTimeout(async () => { try { await api.ponenteGuardar(codigo, o.titulo, o.video_despues); $("[data-guardado]", app).textContent = "✓ Guardado"; } catch (e) { $("[data-guardado]", app).textContent = e.message; } }, 800); };
    $("[data-titulo]", app).oninput = (e) => { o.titulo = e.target.value; guardar(); };
    const vd = $("[data-video-despues]", app); if (vd) vd.oninput = () => { vd.value = vd.value.replace(/\D/g, ""); o.video_despues = vd.value; guardar(); };
    conectarArchivos(app, { subir: (tipo, f, p) => api.ponenciaSubir(codigo, tipo, f, p), ver: (tipo) => abrirPonencia(codigo, o.id, tipo), listo: async () => { await cargar(); pintar(); } });
  }
  pintar();
}

// =========================================================
// Concurso de Proyectos · presentación final (bases 3.4 y tabla 3.2)
//  · Equipo: sube su PPT (.pptx) + PDF de respaldo antes del 23/11/2026 23:59 (hora de Lima).
//  · Admin/coordinador: fecha límite (aplazar, cerrar, reabrir), estado de archivos,
//    SORTEO del orden de exposición con animación + imagen para WhatsApp, ZIP numerado.
//  · Jurados: ven el PDF y descargan el PPT de cada equipo en su laptop.
//  · Proyector: tarjeta «Expone ahora / Sigue» con turno, archivos y cronómetro 5 + 3 min.
// Los archivos están en un espacio privado; se abren con enlaces temporales (api.presUrl).
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611040224";
import { ENTREGABLES } from "./entregables.js?v=202611040224";
import { porId } from "./concursos.js?v=202611040224";
import { $, $$, esc, I, IMG, aviso, modal, confirmar, lanzarConfeti, fondoAnimado } from "./ui.js?v=202611040224";

const LIMA = "America/Lima";
export const fechaLima = (t) => new Date(t).toLocaleString("es-PE", { timeZone: LIMA, weekday: "short", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
export const mb = (b) => (Number(b || 0) < 1048576 ? `${Math.max(1, Math.round(Number(b || 0) / 1024))} KB` : `${(Number(b) / 1048576).toFixed(Number(b) >= 10485760 ? 0 : 1)} MB`);
export function falta(ms) {
  if (ms <= 0) return "0 min";
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), ss = s % 60;
  return d ? `${d} d ${h} h ${m} min` : h ? `${h} h ${m} min` : `${m} min ${String(ss).padStart(2, "0")} s`;
}
const nomDel = (d) => (d ? d.siglas || d.nombre : "—");
const archivoZip = (pos, d, ext) => `${String(pos).padStart(2, "0")}_${(nomDel(d) || "EQUIPO").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toUpperCase()}.${ext}`;

// Ordena cualquier lista según el sorteo (ids de delegación); lo no sorteado va al final
export function ordenarPorSorteo(lista, orden = [], delId = (x) => x.delegacion_id) {
  const pos = new Map(orden.map((id, i) => [id, i]));
  return [...lista].sort((a, b) => (pos.get(delId(a)) ?? 999) - (pos.get(delId(b)) ?? 999));
}
export const estadoPres = (p) => (p?.ppt && p?.pdf ? ["Entregado", "chip--verde"] : p?.ppt || p?.pdf ? ["Incompleto", "chip--ambar"] : ["Sin entregar", ""]);
export const estadoPlazo = (c) => (!c ? ["—", ""] : !c.abierto ? ["Cerrada", "chip--rojo"] : Date.parse(c.ahora) > Date.parse(c.limite) ? ["Vencida", "chip--rojo"] : ["Abierta", "chip--verde"]);

// Abre un archivo (PDF en otra pestaña, PPT se descarga). La ventana se abre ANTES de esperar para que no la bloqueen.
export async function abrirArchivo(codigo, equipo, tipo) {
  const w = window.open("", "_blank");
  if (w) w.document.write(`<p style="font-family:sans-serif;padding:20px">Abriendo ${tipo === "pdf" ? "el PDF" : "el PowerPoint"}…</p>`);
  try {
    const url = await api.presUrl(codigo, equipo, tipo, tipo === "ppt");
    if (w) w.location.href = url; else location.href = url;
  } catch (e) { w?.close(); aviso(e.message, "error"); }
}

// ---------------- Pantalla del EQUIPO ----------------
export async function vistaPresentacion(app, codigo, salir) {
  let data, P, tic = null, sondeo = null, guardarT = null;
  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo tu presentación…</div>`;
  try { [data, P] = await Promise.all([api.equipoDatos(codigo), api.equipoPresentacion(codigo)]); }
  catch (e) { aviso(e.message, "error"); return salir(); }
  const c = porId(data.entrega.concurso_id), def = ENTREGABLES[data.entrega.concurso_id];
  const datos = { proyecto: "", lider: "", ...(data.entrega.datos || {}) };
  let desfase = Date.parse(P.config.ahora) - Date.now();
  const limpiar = () => { clearInterval(tic); clearInterval(sondeo); clearTimeout(guardarT); };

  const INFO = {
    ppt: { ico: "PPT", t: "Presentación en PowerPoint", d: "Formato .pptx (o .ppt). Queda como respaldo y lo revisan los jurados.", acepta: ".pptx,.ppt,application/vnd.openxmlformats-officedocument.presentationml.presentation,application/vnd.ms-powerpoint", ver: "Descargar mi PPT" },
    pdf: { ico: "PDF", t: "Presentación en PDF · ES LA QUE SE PROYECTA", d: "Exporten su PowerPoint a PDF (Archivo → Exportar → PDF). En el auditorio se proyecta este PDF y pasan las diapositivas con el puntero. Las animaciones no se ven: diseñen cada paso como una diapositiva.", acepta: ".pdf,application/pdf", ver: "Ver mi PDF" },
    video: { ico: "▶", t: "Video (opcional)", d: "Si su pitch incluye un video, súbanlo aquí en .mp4 (máx. 50 MB, ideal 720p y menos de 1 min). Se reproduce dentro de la pantalla, después de la diapositiva que indiquen.", acepta: ".mp4,.mov,.webm,.m4v,video/mp4,video/quicktime,video/webm", ver: "Ver mi video" },
  };
  function slot(tipo) {
    const f = P.presentacion[tipo], k = INFO[tipo], abierta = P.config.puede, opcional = tipo === "video";
    return `<article class="tarjeta pres-slot ${f ? "pres-slot--ok" : ""} ${tipo === "pdf" ? "pres-slot--clave" : ""}" data-slot="${tipo}">
      <div class="pres-slot__ico pres-slot__ico--${tipo}">${k.ico}</div>
      <div class="pres-slot__txt"><h3>${k.t} <span class="chip ${f ? "chip--verde" : opcional ? "" : "chip--ambar"}">${f ? "✓ Subido" : opcional ? "Opcional" : "Pendiente"}</span></h3>
        <p>${k.d}</p>
        ${tipo === "video" && f ? `<label class="campo pres-despues"><span>Mostrar el video después de la diapositiva N.º</span><input data-d="videoDespues" inputmode="numeric" maxlength="3" value="${esc(datos.videoDespues || "")}" placeholder="Ej. 4" ${abierta ? "" : "disabled"}></label>` : ""}
        ${f ? `<p class="pres-slot__arch"><b>${esc(f.nombre)}</b> · ${mb(f.tamano)} · subido ${fechaLima(f.subido)}</p>` : ""}
        <div class="pres-barra" data-barra hidden><i></i><span>0 %</span></div>
        <div class="pres-slot__acc">
          ${abierta ? `<label class="btn ${f || opcional ? "" : "btn--naranja"}">${I.descargar}<span>${f ? "Reemplazar archivo" : "Elegir archivo"}</span><input type="file" data-archivo="${tipo}" accept="${k.acepta}" hidden></label>` : ""}
          ${f ? `<button class="btn" data-ver="${tipo}">${I.vivo}${k.ver}</button>` : ""}
        </div></div></article>`;
  }

  function pintar() {
    const cfg = P.config, [et, ec] = estadoPlazo({ ...cfg, ahora: new Date(Date.now() + desfase).toISOString() });
    const pos = cfg.orden.indexOf(data.entrega.delegacion_id);
    app.innerHTML = `<div class="fondo fondo--sobrio"></div>
      <header class="barra"><img class="logo" src="${IMG.logo}" alt="CONCEPMI"><span class="sep"></span>
        <div><div class="barra__titulo">${esc(c?.nombre || "Concurso")}</div><div class="barra__sub">${esc(data.delegacion?.nombre || "")}</div></div>
        <div class="der"><button class="btn btn--mini" data-salir>${I.salir}<span>Salir</span></button></div></header>
      <main class="contenedor eq">
        <div class="cabeza" style="margin-top:0"><div><h1>${esc(def?.titulo || "Presentación final")}</h1><p>${esc(def?.ayuda || "")}</p></div></div>
        <section class="tarjeta pres-plazo ${ec === "chip--verde" ? "" : "pres-plazo--cerrado"}">
          <div><small>Fecha límite de entrega</small><b>${fechaLima(cfg.limite)}</b><span>hora de Lima</span></div>
          <div class="pres-plazo__cuenta"><span class="chip ${ec}">${et}</span><b data-cuenta></b></div>
          ${pos >= 0 ? `<div class="pres-plazo__turno"><small>Tu turno de exposición</small><b>${pos + 1}.º</b><span>de ${cfg.orden.length}</span></div>` : `<div class="pres-plazo__turno"><small>Orden de exposición</small><span>Se sortea un día antes y se envía por WhatsApp</span></div>`}
        </section>
        ${cfg.puede ? "" : `<div class="cerrado">${I.candado}<span><b>La entrega está cerrada.</b> Si necesitas cambiar un archivo, pide al organizador que la reabra o que aplace el plazo.</span></div>`}
        <section class="tarjeta eq-cab">
          <label class="campo"><span>Nombre del proyecto</span><input data-d="proyecto" maxlength="160" value="${esc(datos.proyecto)}" placeholder="Ej. AgroScan" ${cfg.puede ? "" : "disabled"}></label>
          <label class="campo"><span>Líder de equipo</span><input data-d="lider" maxlength="120" value="${esc(datos.lider)}" placeholder="Nombre y apellido" ${cfg.puede ? "" : "disabled"}></label>
        </section>
        <div class="pres-slots">${slot("pdf")}${slot("ppt")}${slot("video")}</div>
        <details class="eq-guia" open><summary>${I.info} Recomendaciones para que se vea perfecto en el auditorio</summary>
          <ul class="pres-tips">
            <li><b>Lo que se proyecta es su PDF</b>, a pantalla completa, y ustedes pasan las diapositivas con el puntero. Usen formato <b>16:9</b>.</li>
            <li>El PDF no muestra animaciones ni transiciones: si algo debe aparecer «por partes», háganlo en diapositivas seguidas.</li>
            <li>Si tienen un <b>video</b>, súbanlo aparte en .mp4 e indiquen después de qué diapositiva va: se reproduce solo al pasar con el puntero.</li>
            <li>El <b>PowerPoint</b> también es obligatorio: queda como respaldo y lo revisan los jurados.</li>
            <li>Tienen <b>5 min de pitch + 3 min de preguntas</b>. Los jurados verán su presentación también en sus laptops.</li>
          </ul></details>
        <p class="ayuda" data-guardado></p>
      </main>
      ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $("[data-salir]", app).onclick = () => { limpiar(); salir(); };
    $$("[data-d]", app).forEach((el) => (el.oninput = () => {
      if (el.dataset.d === "videoDespues") el.value = el.value.replace(/\D/g, "");
      datos[el.dataset.d] = el.value; clearTimeout(guardarT); $("[data-guardado]", app).textContent = "Guardando…";
      guardarT = setTimeout(async () => { try { await api.equipoGuardar(codigo, datos); $("[data-guardado]", app).textContent = "✓ Guardado"; } catch (e) { $("[data-guardado]", app).textContent = e.message; } }, 900);
    }));
    $$("[data-ver]", app).forEach((b) => (b.onclick = () => abrirArchivo(codigo, P.presentacion.equipo_id, b.dataset.ver)));
    $$("[data-archivo]", app).forEach((inp) => (inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      const tipo = inp.dataset.archivo, caja = $(`[data-slot="${tipo}"]`, app), barra = $("[data-barra]", caja);
      if (f.size > 52428800) return aviso(`«${f.name}» pesa ${mb(f.size)}. El máximo es 50 MB: comprime las imágenes o el video.`, "error");
      barra.hidden = false; $$("button, label.btn", caja).forEach((x) => x.classList.add("deshabilitado"));
      try {
        await api.presSubir(codigo, tipo, f, (p) => { $("i", barra).style.width = `${Math.round(p * 100)}%`; $("span", barra).textContent = `${Math.round(p * 100)} %`; });
        P = await api.equipoPresentacion(codigo); lanzarConfeti(); aviso(`${tipo === "ppt" ? "PowerPoint" : tipo === "pdf" ? "PDF" : "Video"} subido`); pintar();
      } catch (e) { aviso(e.message, "error"); barra.hidden = true; $$(".deshabilitado", caja).forEach((x) => x.classList.remove("deshabilitado")); }
    }));
    reloj();
  }
  function reloj() {
    const el = $("[data-cuenta]", app); if (!el) return;
    const r = Date.parse(P.config.limite) - (Date.now() + desfase);
    el.textContent = P.config.abierto && r > 0 ? `Quedan ${falta(r)}` : "";
  }
  pintar();
  tic = setInterval(() => { if (!document.body.contains($("[data-cuenta]", app))) return limpiar(); reloj(); }, 1000);
  sondeo = setInterval(async () => {
    try { const n = await api.equipoPresentacion(codigo); const cambio = JSON.stringify(n.config) !== JSON.stringify(P.config); P = n; desfase = Date.parse(n.config.ahora) - Date.now(); if (cambio && !document.activeElement?.matches("input")) pintar(); } catch { /* se reintenta */ }
  }, 30000);
}

// ---------------- ADMIN: panel de entrega (fecha límite) ----------------
export function panelPlazo(cfg) {
  const [t, cl] = estadoPlazo(cfg);
  return `<section class="tarjeta en-panel">
    <h3>Entrega de presentaciones</h3>
    <div class="pres-admin-plazo"><small>Fecha límite (hora de Lima)</small><b>${fechaLima(cfg.limite)}</b>
      <span><span class="chip ${cl}">${t}</span> <span data-pres-cuenta></span></span></div>
    <div class="en-acc">
      <button class="btn btn--naranja" data-pres-aplazar>${I.reloj}Aplazar / cambiar plazo</button>
      ${cfg.abierto ? `<button class="btn btn--peligro" data-pres-cerrar>${I.candado}Cerrar entrega</button>` : `<button class="btn" data-pres-abrir>${I.abierto}Reabrir entrega</button>`}
    </div>
    <p class="ayuda">Los equipos suben su <b>PPT</b> y un <b>PDF de respaldo</b> (máx. 50 MB c/u) con su código, por el botón <b>Equipo</b> de la portada. Después del plazo ya no pueden subir ni reemplazar, salvo que aplaces o reabras.</p>
  </section>`;
}
let relojPlazo = null;
export function conectarPlazo(v, { codigo, concurso, cfg, recargar }) {
  const cuenta = () => { const el = $("[data-pres-cuenta]", v); if (!el) return false; const r = Date.parse(cfg.limite) - Date.now(); el.textContent = cfg.abierto && r > 0 ? `· quedan ${falta(r)}` : ""; return true; };
  clearInterval(relojPlazo); cuenta(); relojPlazo = setInterval(() => { if (!cuenta()) clearInterval(relojPlazo); }, 1000);
  const accion = async (a, lim, msg) => { try { await api.adminPresConfig(codigo, concurso, a, lim); aviso(msg); await recargar(); } catch (e) { aviso(e.message, "error"); } };
  $("[data-pres-cerrar]", v)?.addEventListener("click", async () => { if (await confirmar("¿Cerrar la entrega ahora?", "Los equipos ya no podrán subir ni reemplazar archivos hasta que la reabras.", { boton: "Cerrar entrega", peligro: true })) accion("cerrar", null, "Entrega cerrada"); });
  $("[data-pres-abrir]", v)?.addEventListener("click", () => accion("abrir", null, "Entrega reabierta"));
  $("[data-pres-aplazar]", v)?.addEventListener("click", () => {
    const d = new Date(new Date(cfg.limite).toLocaleString("en-US", { timeZone: LIMA }));
    const dd = (n) => String(n).padStart(2, "0");
    const m = modal(`<h2>Aplazar o cambiar el plazo</h2><form class="form">
      <div class="reparto" style="margin:0"><button type="button" class="chip" data-mas="1">+1 hora</button><button type="button" class="chip" data-mas="12">+12 horas</button><button type="button" class="chip" data-mas="24">+1 día</button></div>
      <label class="campo"><span>Nueva fecha (dd/mm/aaaa)</span><input name="f" value="${dd(d.getDate())}/${dd(d.getMonth() + 1)}/${d.getFullYear()}" inputmode="numeric" maxlength="10"></label>
      <label class="campo"><span>Hora (24 h, Lima)</span><input name="h" value="${dd(d.getHours())}:${dd(d.getMinutes())}" inputmode="numeric" maxlength="5"></label>
      <p class="ayuda" style="margin:0">Al guardar, la entrega queda <b>abierta</b> hasta esa fecha y hora.</p><p class="error"></p>
      <div class="modal__acciones"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar plazo</button></div></form>`);
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $$("[data-mas]", m.el).forEach((b) => (b.onclick = () => {
      const [D, M, A] = f.f.value.split("/").map(Number), [H, Mi] = f.h.value.split(":").map(Number);
      const n = new Date(Date.UTC(A, M - 1, D, H + 5, Mi) + Number(b.dataset.mas) * 3600e3); // Lima = UTC−5
      const l = new Date(n.toLocaleString("en-US", { timeZone: LIMA }));
      f.f.value = `${dd(l.getDate())}/${dd(l.getMonth() + 1)}/${l.getFullYear()}`; f.h.value = `${dd(l.getHours())}:${dd(l.getMinutes())}`;
    }));
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const mf = f.f.value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/), mh = f.h.value.match(/^(\d{1,2}):(\d{2})$/);
      if (!mf || !mh) return ($(".error", f).textContent = "Revisa la fecha (dd/mm/aaaa) y la hora (hh:mm).");
      const iso = `${mf[3]}-${mf[2]}-${mf[1]}T${mh[1].padStart(2, "0")}:${mh[2]}:59-05:00`;
      if (isNaN(Date.parse(iso))) return ($(".error", f).textContent = "Esa fecha no existe.");
      m.cerrar(); accion("limite", iso, `Nuevo plazo: ${fechaLima(iso)}`);
    };
  });
}
export function celdaArchivos(p, puede) {
  const una = (t) => { const f = p?.[t]; return `<div class="pres-celda ${f ? "pres-celda--ok" : ""}"><b>${t === "video" ? "VID" : t.toUpperCase()}</b>${f ? `<span title="${esc(f.nombre)}">${esc(f.nombre)} · ${mb(f.tamano)}<br><small>${fechaLima(f.subido)}</small></span>
    <button class="btn btn--mini" data-pres-ver="${t}" data-eq="${p.equipo_id}">${t === "ppt" ? "Bajar" : "Ver"}</button>` : `<span class="tenue">${puede ? "pendiente" : "no entregó"}</span>`}</div>`; };
  return `<div class="pres-celdas">${una("pdf")}${una("ppt")}${p?.video ? una("video") : ""}</div>`;
}

// ---------------- Imagen del orden (para WhatsApp) ----------------
const cargarImg = (src) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.onerror = () => r(null); im.src = src; });
export async function imagenOrden(items, { concurso = "Concurso Nacional de Proyectos", fecha = "" } = {}) {
  await document.fonts?.ready;
  const W = 1080, H = Math.max(1350, 520 + items.length * 92 + 160), cv = document.createElement("canvas"); cv.width = W; cv.height = H;
  const g = cv.getContext("2d");
  const fondo = g.createLinearGradient(0, 0, W, H); fondo.addColorStop(0, "#3A1AA8"); fondo.addColorStop(0.55, "#170D56"); fondo.addColorStop(1, "#0B0630");
  g.fillStyle = fondo; g.fillRect(0, 0, W, H);
  [[160, 220, 360, "rgba(31,203,234,.22)"], [930, 420, 380, "rgba(110,43,230,.45)"], [540, H - 120, 420, "rgba(255,106,31,.18)"]].forEach(([x, y, r, c]) => {
    const rg = g.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, c); rg.addColorStop(1, "rgba(0,0,0,0)"); g.fillStyle = rg; g.fillRect(0, 0, W, H); });
  const [logo, club, wolf] = await Promise.all([cargarImg(IMG.logo), cargarImg(IMG.club), cargarImg(IMG.wolfito)]);
  if (logo) g.drawImage(logo, 70, 64, 330, 330 * logo.height / logo.width);
  if (club) g.drawImage(club, W - 70 - 200, 58, 200, 200 * club.height / club.width);
  g.textAlign = "center"; g.fillStyle = "#1FCBEA"; g.font = "600 28px Poppins, sans-serif"; g.fillText("ORDEN OFICIAL DE EXPOSICIÓN", W / 2, 205);
  g.fillStyle = "#fff"; g.font = "64px 'Russo One', Poppins, sans-serif"; g.fillText(concurso.replace("Concurso Nacional de ", "Concurso de "), W / 2, 285);
  g.fillStyle = "#E6DDFF"; g.font = "28px Poppins, sans-serif"; g.fillText(fecha || "VI CONCEPMI 2026 · Gran final presencial · 5 min pitch + 3 min preguntas", W / 2, 335);
  let y = 410;
  items.forEach((it, i) => {
    const x0 = 90, w = W - 180, h = 76, top = i < 3;
    g.fillStyle = top ? "rgba(255,194,61,.16)" : "rgba(14,8,56,.6)"; g.strokeStyle = top ? "rgba(255,194,61,.6)" : "rgba(169,139,255,.45)"; g.lineWidth = 2;
    g.beginPath(); g.roundRect(x0, y, w, h, 20); g.fill(); g.stroke();
    g.fillStyle = "#FF6A1F"; g.beginPath(); g.arc(x0 + 52, y + h / 2, 28, 0, Math.PI * 2); g.fill();
    g.fillStyle = "#fff"; g.textAlign = "center"; g.font = "30px 'Russo One', Poppins, sans-serif"; g.fillText(String(i + 1), x0 + 52, y + h / 2 + 11);
    g.textAlign = "left"; g.font = "34px 'Russo One', Poppins, sans-serif"; g.fillText(it.siglas || it.nombre, x0 + 104, y + 36);
    g.fillStyle = "#CBB8FF"; g.font = "22px Poppins, sans-serif"; g.fillText((it.nombre && it.nombre !== it.siglas ? it.nombre : "").slice(0, 60), x0 + 104, y + 63);
    if (it.hora) { g.textAlign = "right"; g.fillStyle = "#FFC23D"; g.font = "600 28px Poppins, sans-serif"; g.fillText(it.hora, x0 + w - 30, y + h / 2 + 10); }
    y += h + 16;
  });
  if (wolf) { const wh = 260; g.drawImage(wolf, W - 70 - wh * wolf.width / wolf.height, H - wh - 40, wh * wolf.width / wolf.height, wh); }
  g.textAlign = "left"; g.fillStyle = "#A9A3C7"; g.font = "22px Poppins, sans-serif";
  g.fillText(`Sorteo realizado el ${new Date().toLocaleString("es-PE", { timeZone: LIMA, day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}`, 90, H - 70);
  g.fillText("PMI Lima Perú Chapter Student Club · UNMSM", 90, H - 38);
  return cv;
}
export async function descargarImagen(items, opciones) {
  const cv = await imagenOrden(items, opciones);
  const a = document.createElement("a"); a.download = "orden-exposicion-concurso-proyectos.png"; a.href = cv.toDataURL("image/png"); a.click();
}
// Horario estimado de cada turno (bases: pitches desde las 15:15, 9 min por equipo)
export const horaTurno = (i, inicio = [15, 15], porEquipo = 9) => { const t = inicio[0] * 60 + inicio[1] + i * porEquipo; return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`; };

// ---------------- SORTEO animado ----------------
let ac = null;
const bip = (f, d = 0.08, v = 0.12) => { try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); const o = ac.createOscillator(), g = ac.createGain(), t = ac.currentTime; o.type = "triangle"; o.frequency.value = f; g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); o.connect(g).connect(ac.destination); o.start(t); o.stop(t + d + 0.02); } catch { /* sin sonido */ } };
function barajar(a) { const r = [...a], u = new Uint32Array(r.length); crypto.getRandomValues(u); for (let i = r.length - 1; i > 0; i--) { const j = u[i] % (i + 1); [r[i], r[j]] = [r[j], r[i]]; } return r; }

// delegaciones: [{id, siglas, nombre}] · guardar(ordenIds) → promesa · previo: ids ya sorteados
export function abrirSorteo({ delegaciones, guardar, previo = [], concurso = "Concurso Nacional de Proyectos" }) {
  const el = document.createElement("div"); el.className = "sorteo";
  let resultado = null, vivo = true;
  el.innerHTML = `${fondoAnimado(34)}
    <header class="gala__cab"><img src="${IMG.logo}" alt="CONCEPMI VI"><div><b>Sorteo oficial</b><span>${esc(concurso)} · orden de exposición</span></div><img class="gala__club" src="${IMG.club}" alt="PMI Lima Student Club"></header>
    <main class="sorteo__escena" data-escena></main>
    <nav class="sorteo__acc" data-acc></nav>`;
  document.body.append(el);
  const escena = $("[data-escena]", el), acc = $("[data-acc]", el);
  const cerrar = () => { vivo = false; document.removeEventListener("keydown", tecla); el.remove(); };
  const tecla = (e) => { if (e.key === "Escape") cerrar(); };
  document.addEventListener("keydown", tecla);

  function inicio() {
    escena.innerHTML = `<div class="sorteo__intro"><p class="gala__pre">VI CONCEPMI 2026</p><h1 class="gala__titulo">Sorteo del orden<br>de exposición</h1>
      <p class="gala__sub">${delegaciones.length} delegaciones · 5 min de pitch + 3 min de preguntas</p>
      <div class="sorteo__bolas">${delegaciones.map((d, i) => `<span class="sorteo__bola" style="--i:${i}">${esc(d.siglas || d.nombre)}</span>`).join("")}</div>
      ${previo.length ? `<p class="sorteo__aviso">${I.alerta} Ya hay un orden guardado. Si sorteas de nuevo y lo guardas, se reemplaza.</p>` : ""}</div>`;
    acc.innerHTML = `<button class="btn btn--naranja sorteo__btn" data-sortear>${I.girar}Sortear ahora</button>
      ${previo.length ? `<button class="btn" data-ver-previo>${I.tabla}Ver el orden guardado</button>` : ""}<button class="btn" data-cerrar>${I.cerrar}Cerrar</button>`;
    $("[data-sortear]", acc).onclick = sortear;
    $("[data-ver-previo]", acc)?.addEventListener("click", () => { resultado = previo.map((id) => delegaciones.find((d) => d.id === id)).filter(Boolean); final(true); });
    $("[data-cerrar]", acc).onclick = cerrar;
  }

  async function sortear() {
    acc.innerHTML = "";
    resultado = barajar(delegaciones);
    escena.innerHTML = `<div class="sorteo__juego"><div class="sorteo__tombola" data-tombola><span data-nombre>?</span></div>
      <ol class="sorteo__lista" data-lista>${resultado.map((_, i) => `<li data-pos="${i}"><b>${i + 1}</b><span>· · ·</span></li>`).join("")}</ol></div>`;
    const nombre = $("[data-nombre]", escena), tombola = $("[data-tombola]", escena), restantes = [...resultado];
    for (let i = 0; i < resultado.length && vivo; i++) {
      // la tómbola gira mostrando nombres al azar y frena en el elegido
      tombola.classList.add("sorteo__tombola--gira");
      const vueltas = 14 + Math.floor(Math.random() * 6);
      for (let k = 0; k < vueltas && vivo; k++) {
        const d = k === vueltas - 1 ? resultado[i] : restantes[Math.floor(Math.random() * restantes.length)];
        nombre.textContent = d.siglas || d.nombre; bip(420 + k * 30, 0.05, 0.08);
        await new Promise((r) => setTimeout(r, 40 + k * k * 1.6));
      }
      tombola.classList.remove("sorteo__tombola--gira"); tombola.classList.add("sorteo__tombola--sale");
      bip(880, 0.25, 0.16); bip(1320, 0.35, 0.12);
      const li = $(`[data-pos="${i}"]`, escena); li.classList.add("sorteo__li--ok");
      li.innerHTML = `<b>${i + 1}</b><span><strong>${esc(resultado[i].siglas || resultado[i].nombre)}</strong>${resultado[i].siglas && resultado[i].nombre !== resultado[i].siglas ? `<small>${esc(resultado[i].nombre)}</small>` : ""}</span><em>${horaTurno(i)}</em>`;
      restantes.splice(restantes.indexOf(resultado[i]), 1);
      await new Promise((r) => setTimeout(r, 650));
      tombola.classList.remove("sorteo__tombola--sale");
    }
    if (vivo) { lanzarConfeti(); final(false); }
  }

  function final(yaGuardado) {
    escena.innerHTML = `<div class="sorteo__final"><h2 class="gala__titulo gala__titulo--chico">Orden oficial de exposición</h2>
      <ol class="sorteo__lista sorteo__lista--final">${resultado.map((d, i) => `<li class="sorteo__li--ok" style="animation-delay:${i * 60}ms"><b>${i + 1}</b><span><strong>${esc(d.siglas || d.nombre)}</strong>${d.siglas && d.nombre !== d.siglas ? `<small>${esc(d.nombre)}</small>` : ""}</span><em>${horaTurno(i)}</em></li>`).join("")}</ol>
      <p class="ayuda" style="text-align:center">Horario estimado según las bases: pitches desde las 15:15, 9 min por equipo (5 + 3 + 1 de cambio).</p></div>`;
    acc.innerHTML = `${yaGuardado ? "" : `<button class="btn btn--naranja" data-guardar>${I.check}Confirmar y guardar este orden</button><button class="btn" data-otra>${I.girar}Volver a sortear</button>`}
      <button class="btn ${yaGuardado ? "btn--naranja" : ""}" data-img>${I.descargar}Descargar imagen para WhatsApp</button><button class="btn" data-cerrar>${I.cerrar}Cerrar</button>`;
    $("[data-guardar]", acc)?.addEventListener("click", async (ev) => {
      ev.currentTarget.disabled = true;
      try { await guardar(resultado.map((d) => d.id)); aviso("Orden de exposición guardado"); previo = resultado.map((d) => d.id); final(true); }
      catch (e) { aviso(e.message, "error"); ev.currentTarget.disabled = false; }
    });
    $("[data-otra]", acc)?.addEventListener("click", sortear);
    $("[data-img]", acc).onclick = () => descargarImagen(resultado.map((d, i) => ({ ...d, hora: horaTurno(i) })), { concurso });
    $("[data-cerrar]", acc).onclick = cerrar;
  }
  inicio();
  return { cerrar };
}

// ---------------- ZIP con todas las presentaciones, numeradas por el sorteo ----------------
const cargarJSZip = () => window.JSZip ? Promise.resolve(window.JSZip) : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/jszip.min.js"; s.onload = () => res(window.JSZip); s.onerror = () => rej(new Error("No se pudo cargar el compresor ZIP")); document.head.append(s); });
// items: [{ pos, delegacion, pres }] ya en orden · url(equipo, tipo) → enlace temporal
export async function descargarZip(items, url) {
  const m = modal(`<h2>Preparando el ZIP</h2><p data-prog>Cargando…</p><div class="pres-barra"><i data-bar style="width:0%"></i><span data-pct>0 %</span></div><p class="ayuda">No cierres esta ventana. Los archivos se descargan uno por uno.</p>`);
  try {
    const JSZip = await cargarJSZip(); const zip = new JSZip(); const faltan = [];
    const tareas = items.flatMap((it) => ["pdf", "ppt", ...(it.pres?.video ? ["video"] : [])].map((t) => ({ it, t })));
    let k = 0;
    for (const { it, t } of tareas) {
      k++; $("[data-prog]", m.el).textContent = `${k} de ${tareas.length} · ${nomDel(it.delegacion)} · ${t.toUpperCase()}`;
      const f = it.pres?.[t];
      if (!f) { if (t !== "video") faltan.push(`${nomDel(it.delegacion)} (${t.toUpperCase()})`); continue; }
      const ext = (f.nombre.split(".").pop() || t).toLowerCase();
      const r = await fetch(await url(it.pres.equipo_id, t)); if (!r.ok) throw new Error(`No se pudo bajar el ${t.toUpperCase()} de ${nomDel(it.delegacion)}`);
      zip.file(`${t === "pdf" ? "PDF (se proyecta)/" : t === "video" ? "Videos/" : "PowerPoint (respaldo)/"}${archivoZip(it.pos, it.delegacion, ext)}`, await r.blob());
      const p = Math.round((k / tareas.length) * 100); $("[data-bar]", m.el).style.width = `${p}%`; $("[data-pct]", m.el).textContent = `${p} %`;
    }
    zip.file("LEEME.txt", `Presentaciones del Concurso de Proyectos · VI CONCEPMI 2026\nNumeradas según el orden del sorteo.\nEn la pantalla del concurso se proyecta el PDF; el PowerPoint y los videos quedan de respaldo.\nCopia esta carpeta a la laptop del proyector y a una USB.\n${faltan.length ? `\nFaltan: ${faltan.join(", ")}\n` : ""}`);
    $("[data-prog]", m.el).textContent = "Comprimiendo…";
    const blob = await zip.generateAsync({ type: "blob" });
    const a = document.createElement("a"); a.download = "presentaciones-concurso-proyectos.zip"; a.href = URL.createObjectURL(blob); a.click();
    m.cerrar(); aviso(faltan.length ? `ZIP listo · faltan ${faltan.length} archivo(s)` : "ZIP listo con todas las presentaciones");
  } catch (e) { m.cerrar(); aviso(e.message, "error"); }
}

// ---------------- PROYECTOR: tarjeta «Expone ahora / Sigue» ----------------
// lista: entregas ya ordenadas por sorteo · i: índice del que expone · info(e) → { pres, delegacion }
export function htmlExpoPres(lista, i, { nombre, info }) {
  const e = lista[i], sig = lista[i + 1], d = info(e);
  const proy = e?.datos?.proyecto || "";
  return `<div class="pres-expo">
    <div class="pres-expo__turno"><small>Turno</small><b>${String(i + 1).padStart(2, "0")}</b><span>de ${lista.length}</span></div>
    <div class="pres-expo__info">
      ${proy ? `<p class="pres-expo__proy">${I.copa}<span>${esc(proy)}</span></p>` : ""}
      <div class="pres-expo__archivos">
        ${["ppt", "pdf"].map((t) => { const f = d.pres?.[t]; return `<div class="pres-expo__arch ${f ? "" : "pres-expo__arch--no"}"><b>${t.toUpperCase()}</b><span>${f ? esc(archivoZip(i + 1, d.delegacion, (f.nombre.split(".").pop() || t).toLowerCase())) : "No entregó"}</span>
          ${f ? `<button class="btn btn--mini" data-pres-abrir="${t}" data-eq="${d.pres.equipo_id}">${t === "pdf" ? "Abrir PDF" : "Bajar PPT"}</button>` : ""}</div>`; }).join("")}
      </div>
    </div>
    <div class="pres-expo__sigue">${sig ? `<small>Sigue</small><b>${esc(nombre(sig))}</b><span>Turno ${i + 2}</span>` : `<small>Último turno</small><b>¡Gran final!</b><span>Luego: deliberación del jurado</span>`}</div>
    <div class="pres-expo__ruta">${lista.map((x, k) => `<span class="${k < i ? "hecho" : k === i ? "ahora" : ""}" title="${esc(nombre(x))}">${k + 1}</span>`).join("")}</div>
  </div>`;
}
export const conectarExpoPres = (raiz, abrir) => $$("[data-pres-abrir]", raiz).forEach((b) => (b.onclick = () => abrir(b.dataset.eq, b.dataset.presAbrir)));

// Pantalla del Concurso de Proyectos para la laptop del proyector.
// Muestra el PDF de cada delegación DENTRO de la pantalla (sin botones de descarga) y se avanza con el
// puntero/clicker: → / PageDown / Espacio = siguiente, ← / PageUp = anterior, B o . = pantalla negra.
// Si el equipo subió un video, se intercala como una «diapositiva» después de la que indicó y se reproduce solo.
// El cronómetro (5 min de pitch + 3 de preguntas) queda listo y solo empieza al pulsar Iniciar (o la tecla T).
import { $, $$, esc, I, IMG, fondoAnimado, confirmar, aviso } from "./ui.js?v=202611091504";

const PDFJS = new URL("../vendor/pdfjs/pdf.min.mjs", import.meta.url).href;
const WORKER = new URL("../vendor/pdfjs/pdf.worker.min.mjs", import.meta.url).href;
let pdfjs = null;
async function cargarPdfjs() {
  if (!pdfjs) { pdfjs = await import(PDFJS); pdfjs.GlobalWorkerOptions.workerSrc = WORKER; }
  return pdfjs;
}

// Sonidos sintetizados (sin archivos)
let audio = null;
const preparar = () => { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* sin sonido */ } };
function pitido(frec = 988, dur = 0.16, cuando = 0) {
  if (!audio) return;
  try {
    const t = audio.currentTime + cuando, o = audio.createOscillator(), g = audio.createGain();
    o.type = "square"; o.frequency.value = frec;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.22, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* sin sonido */ }
}
const alarma = () => { for (let k = 0; k < 3; k++) pitido(988, 0.16, k * 0.28); pitido(1318, 0.5, 0.9); };
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
const dos = (n) => String(n).padStart(2, "0");

// equipos: [{ equipo_id, delegacion:{nombre, siglas}, proyecto, lider, pres:{pdf, ppt, video}, videoDespues }] ya en el orden del sorteo
// url(equipo, tipo) → promesa con un enlace temporal · abrir(equipo, tipo) → descarga de respaldo
// Sirve también para las CHARLAS MAGISTRALES: textos cambia los rótulos y cada elemento puede traer
// sus propios minutos ({ exp, preg }) y su foto (ponente).
export function abrirSalaProyectos({ equipos, url, abrir, concurso = "Concurso Nacional de Proyectos", minutos = { exp: 5, preg: 3 }, alCerrar, textos = {}, clase = "", inicial = null }) {
  const N = equipos.length;
  const T = { orden: "Orden oficial de presentación", exp: "Exposición", preg: "Ronda de preguntas", btnExp: "Pitch", btnPreg: "Preguntas",
    corto: (k) => `Turno ${dos(k + 1)}`, portada: (k) => `Turno <b>${dos(k + 1)}</b> de ${dos(N)}`, cab: (k) => `Turno ${dos(k + 1)} de ${dos(N)}`, ...textos };
  const FASES = { exp: { min: minutos.exp, txt: T.exp }, preg: { min: minutos.preg, txt: T.preg } };
  const minDe = (f, k = i) => Number(equipos[k]?.minutos?.[f]) || FASES[f].min;
  const docs = new Map(); // equipo_id → { estado:"cargando"|"ok"|"error"|"sin", pdf, paginas, error }
  let i = Math.min(Math.max(inicial ?? 0, 0), Math.max(N - 1, 0)), modo = inicial == null ? "orden" : "portada", diapo = 0, negro = false;
  let fase = "exp", restante = minDe("exp") * 60, corriendo = false, fin = 0, avisado = false, sonado = false;
  let tarea = null, ocultarT = null, reloj = null, cerrado = false;

  const el = document.createElement("div");
  el.className = `sala ${clase}`;
  el.innerHTML = `${fondoAnimado(26)}
    <div class="sala__vista" data-vista></div>
    <div class="sala__negro" data-negro hidden></div>
    <nav class="sala__ctrl" data-ctrl>
      <div class="sala__grupo">
        <button class="btn btn--mini" data-eq="-1" title="Equipo anterior">◀</button>
        <select data-equipo aria-label="Delegación que expone">${equipos.map((e, k) => `<option value="${k}">${T.corto(k, e)} · ${esc(e.delegacion?.siglas || e.delegacion?.nombre || "—")}</option>`).join("")}</select>
        <button class="btn btn--mini" data-eq="1" title="Siguiente equipo">▶</button>
      </div>
      <div class="sala__grupo">
        <button class="btn btn--mini" data-ir="orden">Orden</button>
        <button class="btn btn--mini" data-ir="portada">Portada del turno</button>
        <button class="btn btn--mini" data-ir="diapos">Diapositivas</button>
      </div>
      <div class="sala__grupo">
        <button class="btn btn--mini btn--naranja" data-iniciar>${I.vivo}Iniciar</button>
        <button class="btn btn--mini" data-fase="exp">${T.btnExp} ${minDe("exp")}:00</button>
        <button class="btn btn--mini" data-fase="preg">${T.btnPreg} ${minDe("preg")}:00</button>
        <button class="btn btn--mini" data-reset title="Volver a poner el tiempo completo">↺</button>
      </div>
      <div class="sala__grupo">
        <button class="btn btn--mini" data-negro-btn title="Tecla B">Pantalla negra</button>
        <button class="btn btn--mini" data-ppt title="Descarga el PowerPoint de respaldo">PPT respaldo</button>
        <button class="btn btn--mini" data-full>Pantalla completa</button>
        <button class="btn btn--mini btn--peligro" data-salir>Salir</button>
      </div>
      <p class="sala__ayuda">Puntero: <b>→</b>/<b>PageDown</b> siguiente · <b>←</b>/<b>PageUp</b> anterior · <b>B</b> negro · <b>T</b> iniciar/pausar el tiempo</p>
    </nav>`;
  document.body.appendChild(el);
  document.body.style.overflow = "hidden";
  const vista = $("[data-vista]", el);

  // ---------- Carga de los PDF (primero el turno actual, luego el resto) ----------
  async function cargarDoc(k) {
    const e = equipos[k]; if (!e) return null;
    const ya = docs.get(e.equipo_id); if (ya) return ya.promesa || ya;
    if (!e.pres?.pdf) { const r = { estado: "sin" }; docs.set(e.equipo_id, r); return r; }
    const r = { estado: "cargando" }; docs.set(e.equipo_id, r);
    r.promesa = (async () => {
      try {
        const lib = await cargarPdfjs();
        const u = await url(e.equipo_id, "pdf");
        const datos = await (await fetch(u)).arrayBuffer();
        r.pdf = await lib.getDocument({ data: datos }).promise;
        r.paginas = r.pdf.numPages; r.estado = "ok";
      } catch (ex) { r.estado = "error"; r.error = ex?.message || "No se pudo abrir el PDF"; }
      delete r.promesa;
      if (!cerrado && equipos[i]?.equipo_id === e.equipo_id) pintar();
      return r;
    })();
    return r.promesa;
  }
  (async () => { await cargarDoc(0); for (let k = 1; k < N && !cerrado; k++) await cargarDoc(k); })();

  // Lista de «diapositivas» del turno: páginas del PDF + el video (si hay) después de la que indicó el equipo
  function diapositivas(k = i) {
    const e = equipos[k], d = docs.get(e?.equipo_id), n = d?.estado === "ok" ? d.paginas : 0;
    const lista = Array.from({ length: n }, (_, p) => ({ t: "pag", n: p + 1 }));
    if (e?.pres?.video) {
      const tras = Math.min(Math.max(parseInt(e.videoDespues, 10) || n, 0), n);
      lista.splice(tras, 0, { t: "video" });
    }
    return lista;
  }

  // ---------- Cronómetro ----------
  const seg = () => (corriendo ? Math.max(0, Math.ceil((fin - Date.now()) / 1000)) : restante);
  function ponerFase(f) { fase = f; restante = minDe(f) * 60; corriendo = false; avisado = sonado = false; pintarReloj(); pintarBotones(); }
  function alternar() {
    preparar();
    if (corriendo) { restante = seg(); corriendo = false; }
    else { if (restante <= 0) restante = minDe(fase) * 60, sonado = avisado = false; fin = Date.now() + restante * 1000; corriendo = true; pitido(660, 0.1); }
    pintarReloj(); pintarBotones();
  }
  function pintarReloj() {
    const s = seg(), total = minDe(fase) * 60;
    if (s === 60 && corriendo && !avisado) { avisado = true; pitido(880, 0.12); }
    if (s === 0 && corriendo && !sonado) { sonado = true; corriendo = false; restante = 0; alarma(); pintarBotones(); }
    const cls = s === 0 ? "sala-t--fin" : s <= 60 ? "sala-t--alerta" : !corriendo ? "sala-t--espera" : "";
    $$("[data-reloj]", el).forEach((r) => { r.className = `sala-t ${r.dataset.reloj === "grande" ? "sala-t--grande" : ""} ${cls}`; $("b", r).textContent = mmss(s); $("small", r).textContent = s === 0 ? "¡Tiempo!" : `${FASES[fase].txt}${corriendo ? "" : " · en pausa"}`; });
    $$("[data-barra]", el).forEach((b) => (b.style.transform = `scaleX(${total ? s / total : 0})`));
    $$("[data-barra]", el).forEach((b) => (b.className = `sala__barra ${cls}`));
  }
  const htmlReloj = (grande = false) => `<div class="sala-t ${grande ? "sala-t--grande" : ""}" data-reloj="${grande ? "grande" : ""}"><small></small><b>${mmss(seg())}</b></div>`;

  // ---------- Pantallas ----------
  const nombreDe = (e) => e?.delegacion?.nombre || "—", siglaDe = (e) => e?.delegacion?.siglas || nombreDe(e);
  function pintar() {
    if (tarea) { try { tarea.cancel(); } catch { /* nada */ } tarea = null; }
    const v = $("video", vista); if (v) v.pause();
    const e = equipos[i];
    if (modo === "orden" || !e) {
      vista.innerHTML = `<main class="sala-orden">
        <img class="sala-orden__logo" src="${IMG.logo}" alt="VI CONCEPMI">
        <h1 class="sala-orden__tit">${esc(concurso)}</h1>
        <p class="sala-orden__sub">${esc(T.orden)}</p>
        <ol class="sala-orden__lista">${equipos.map((x, k) => `<li class="${k === i ? "ahora" : ""}" style="--i:${k}"><b>${T.num ? T.num(k, x) : dos(k + 1)}</b><span>${esc(siglaDe(x))}${T.detalle ? `<small>${esc(T.detalle(k, x))}</small>` : ""}</span></li>`).join("") || "<li>Aún no hay equipos</li>"}</ol>
      </main>`;
    } else if (modo === "portada") {
      const d = docs.get(e.equipo_id);
      const estado = !e.pres?.pdf ? `<span class="sala-chip sala-chip--no">Sin PDF${e.pres?.ppt ? " · usar PPT de respaldo" : ""}</span>`
        : d?.estado === "ok" ? `<span class="sala-chip">✓ Presentación lista · ${d.paginas} diapositivas${e.pres.video ? " + video" : ""}</span>`
        : d?.estado === "error" ? `<span class="sala-chip sala-chip--no">No se pudo abrir el PDF</span>` : `<span class="sala-chip">Preparando presentación…</span>`;
      vista.innerHTML = `<main class="sala-portada">
        <header class="sala-portada__cab"><img src="${IMG.logo}" alt="VI CONCEPMI"><span>${esc(concurso)}</span></header>
        <div class="sala-portada__cuerpo">
          ${e.foto ? `<img class="sala-portada__foto" src="${esc(e.foto)}" alt="">` : ""}
          <p class="sala-portada__turno">${T.portada(i, e)}</p>
          <h1 class="sala-portada__sigla">${esc(siglaDe(e))}</h1>
          ${e.delegacion?.siglas ? `<p class="sala-portada__nombre">${esc(nombreDe(e))}</p>` : ""}
          ${e.proyecto ? `<p class="sala-portada__proy">«${esc(e.proyecto)}»</p>` : ""}
          ${htmlReloj(true)}
          ${estado}
        </div>
        <img class="sala-portada__lobo" src="${IMG.wolfito}" alt="">
      </main>`;
    } else {
      const lista = diapositivas(), d = docs.get(e.equipo_id);
      diapo = Math.min(Math.max(diapo, 0), Math.max(lista.length - 1, 0));
      const it = lista[diapo];
      vista.innerHTML = `<div class="sala-show">
        <header class="sala-show__cab">
          <img src="${IMG.logo}" alt="VI CONCEPMI">
          <div class="sala-show__quien"><small>${T.cab(i, e)}</small><b>${esc(siglaDe(e))}</b>${e.proyecto ? `<span>${esc(e.proyecto)}</span>` : ""}</div>
          ${htmlReloj()}
        </header>
        <div class="sala-show__lienzo" data-lienzo>
          ${!it ? `<div class="sala-show__msg">${!e.pres?.pdf ? `<b>${esc(siglaDe(e))} no subió su PDF</b><span>Usa «PPT respaldo» en la barra de abajo.</span>` : d?.estado === "error" ? `<b>No se pudo abrir el PDF</b><span>${esc(d.error || "")}</span>` : `<b>Preparando la presentación…</b>`}</div>`
            : it.t === "video" ? `<video data-video playsinline preload="auto"></video>` : `<canvas data-canvas></canvas>`}
        </div>
        ${it ? `<span class="sala-show__num">${it.t === "video" ? "Video" : `Diapositiva ${it.n} / ${d.paginas}`}</span>` : ""}
      </div>`;
      if (it?.t === "pag") dibujar(d.pdf, it.n);
      if (it?.t === "video") ponerVideo(e);
    }
    $$("[data-barra]", el).forEach((b) => b.remove());
    if (modo !== "orden") el.insertAdjacentHTML("beforeend", `<div class="sala__barra" data-barra></div>`);
    pintarReloj(); pintarBotones();
  }

  async function dibujar(pdf, n) {
    const cv = $("[data-canvas]", vista), caja = $("[data-lienzo]", vista); if (!cv || !caja) return;
    try {
      const pag = await pdf.getPage(n);
      const base = pag.getViewport({ scale: 1 });
      const esc1 = Math.min(caja.clientWidth / base.width, caja.clientHeight / base.height);
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const vp = pag.getViewport({ scale: esc1 * dpr });
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      cv.style.width = `${Math.floor(vp.width / dpr)}px`; cv.style.height = `${Math.floor(vp.height / dpr)}px`;
      tarea = pag.render({ canvasContext: cv.getContext("2d"), viewport: vp });
      await tarea.promise; tarea = null;
      if (n < pdf.numPages) pdf.getPage(n + 1).catch(() => {}); // deja lista la siguiente
    } catch (ex) { if (ex?.name !== "RenderingCancelledException") console.warn(ex); }
  }

  const videos = new Map(); // equipo_id → url
  async function ponerVideo(e) {
    const v = $("[data-video]", vista); if (!v) return;
    try {
      if (!videos.has(e.equipo_id)) videos.set(e.equipo_id, await url(e.equipo_id, "video"));
      if (!v.isConnected) return;
      v.src = videos.get(e.equipo_id); v.controls = false;
      await v.play().catch(() => { v.controls = true; });
    } catch (ex) { const c = $("[data-lienzo]", vista); if (c) c.innerHTML = `<div class="sala-show__msg"><b>No se pudo cargar el video</b><span>${esc(ex.message || "")}</span></div>`; }
  }

  function pintarBotones() {
    const b = $("[data-iniciar]", el); if (b) b.innerHTML = `${I.vivo}${corriendo ? "Pausar" : seg() === 0 ? "Reiniciar" : restante < minDe(fase) * 60 ? "Continuar" : "Iniciar"}`;
    $$("[data-fase]", el).forEach((x) => { x.classList.toggle("activo", x.dataset.fase === fase); x.textContent = `${x.dataset.fase === "exp" ? T.btnExp : T.btnPreg} ${minDe(x.dataset.fase)}:00`; });
    $$("[data-ir]", el).forEach((x) => x.classList.toggle("activo", x.dataset.ir === (modo === "slides" ? "diapos" : modo)));
    $("[data-equipo]", el).value = String(i);
    $("[data-ppt]", el).disabled = !equipos[i]?.pres?.ppt;
    $("[data-negro-btn]", el).classList.toggle("activo", negro);
  }

  // ---------- Navegación ----------
  function irEquipo(k) {
    if (k < 0 || k >= N) return;
    i = k; modo = "portada"; diapo = 0; ponerFase("exp"); cargarDoc(i); pintar();
  }
  function siguiente() {
    if (negro) return ponerNegro(false);
    if (modo === "orden") { modo = "portada"; cargarDoc(i); return pintar(); }
    if (modo === "portada") { modo = "slides"; diapo = 0; return pintar(); }
    const lista = diapositivas(); if (diapo < lista.length - 1) { diapo++; pintar(); }
  }
  function anterior() {
    if (negro) return ponerNegro(false);
    if (modo === "slides") { if (diapo > 0) { diapo--; pintar(); } else { modo = "portada"; pintar(); } }
  }
  function ponerNegro(si) { negro = si; $("[data-negro]", el).hidden = !si; const v = $("video", vista); if (v && si) v.pause(); pintarBotones(); }

  function teclas(ev) {
    const k = ev.key;
    if (ev.target.closest?.("select, input, .modal") || document.querySelector(".modal")) return;
    if (["ArrowRight", "ArrowDown", "PageDown", " ", "Enter", "n", "N"].includes(k)) { ev.preventDefault(); preparar(); siguiente(); }
    else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace", "p", "P"].includes(k)) { ev.preventDefault(); anterior(); }
    else if (["b", "B", ".", "w", "W"].includes(k)) { ev.preventDefault(); ponerNegro(!negro); }
    else if (k === "t" || k === "T") { ev.preventDefault(); alternar(); }
    else if (k === "F5" || (k === "Escape" && !document.fullscreenElement)) { ev.preventDefault(); } // botones extra del puntero: no hacen nada
  }
  document.addEventListener("keydown", teclas, true);

  // Clic en la diapositiva: mitad derecha = siguiente, izquierda = anterior (como en PowerPoint)
  vista.addEventListener("click", (ev) => {
    if (modo !== "slides" || ev.target.closest("video[controls]")) return;
    const r = vista.getBoundingClientRect(); (ev.clientX - r.left > r.width * 0.3 ? siguiente : anterior)();
  });

  // Barra de control: aparece al mover el mouse y se esconde sola
  const mostrarCtrl = () => { el.classList.add("sala--ctrl"); clearTimeout(ocultarT); ocultarT = setTimeout(() => { if (!el.matches(":has(.sala__ctrl:hover), :has(select:focus)")) el.classList.remove("sala--ctrl"); }, 2600); };
  el.addEventListener("mousemove", mostrarCtrl);
  mostrarCtrl();
  $$("[data-eq]", el).forEach((b) => (b.onclick = () => irEquipo(i + Number(b.dataset.eq))));
  $("[data-equipo]", el).onchange = (ev) => { irEquipo(Number(ev.target.value)); ev.target.blur(); };
  $$("[data-ir]", el).forEach((b) => (b.onclick = () => { modo = b.dataset.ir === "diapos" ? "slides" : b.dataset.ir; if (modo !== "orden") cargarDoc(i); pintar(); }));
  $("[data-iniciar]", el).onclick = alternar;
  $$("[data-fase]", el).forEach((b) => (b.onclick = () => ponerFase(b.dataset.fase)));
  $("[data-reset]", el).onclick = () => ponerFase(fase);
  $("[data-negro-btn]", el).onclick = () => ponerNegro(!negro);
  $("[data-ppt]", el).onclick = () => equipos[i]?.pres?.ppt && abrir(equipos[i].equipo_id, "ppt");
  $("[data-full]", el).onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
  $("[data-salir]", el).onclick = async () => { if (await confirmar("¿Salir de la pantalla del concurso?", "El cronómetro se detiene.", { boton: "Salir" })) cerrar(); };
  let rT = null; const alRedimensionar = () => { clearTimeout(rT); rT = setTimeout(() => modo === "slides" && pintar(), 200); };
  window.addEventListener("resize", alRedimensionar);
  reloj = setInterval(() => corriendo && pintarReloj(), 250);

  function cerrar() {
    cerrado = true; clearInterval(reloj); clearTimeout(ocultarT);
    document.removeEventListener("keydown", teclas, true); window.removeEventListener("resize", alRedimensionar);
    const v = $("video", vista); if (v) { v.pause(); v.removeAttribute("src"); }
    for (const d of docs.values()) d.pdf?.destroy?.();
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    el.remove(); document.body.style.overflow = ""; alCerrar?.();
  }

  if (!N) aviso("Aún no hay equipos en este concurso", "error");
  pintar();
  document.documentElement.requestFullscreen?.().catch(() => {});
  return { cerrar };
}

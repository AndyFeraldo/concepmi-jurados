// =========================================================
// SHOW EN VIVO · martes 24/11, 5:00 – 6:30 p. m. (auditorio, en paralelo con IATHON, Amateur I y II)
// Pestaña del admin (y de accesos con permiso «show») desglosada en 4 puntos, y las pantallas
// a pantalla completa para el proyector:
//   1 · Networking (sin internet para el público): A) «¿Esto o aquello?» con aplausómetro (js/show-duelo.js;
//       reemplaza al Muro en vivo, que sigue en el código pero ya no se muestra)
//       y Ruleta de delegaciones con retos para el presentador.
//   2 · Comentamos los casos: PDF de Amateur I, II e IATHON en la pantalla del auditorio (PDF.js + puntero).
//   3 · Transmisión en vivo: enlace de TikTok / YouTube / Instagram en pantalla (o QR + ventana aparte).
//   4 · Sorteo de becas: sponsors con logo, premios (beca, media beca, cuarto, descuento) y la ruleta de
//       códigos; el ganador lo elige la base al azar entre los inscritos (Excel de confirmados).
// =========================================================
import { api } from "./api.js?v=202611252237";
import { abrirSalaProyectos } from "./sala-proyectos.js?v=202611252237";
import { $, $$, esc, I, IMG, aviso, modal, confirmar, lanzarConfeti, fondoAnimado, pantallaActiva } from "./ui.js?v=202611252237";
import { abrirDuelo, leerDuelos, guardarDuelos, DUELOS } from "./show-duelo.js?v=202611252237";

export const SHOW = { dia: "Martes 24 de noviembre", hora: "5:00 – 6:30 p. m.", lugar: "Auditorio" };
export const AGENDA = [
  { n: 1, id: "networking", t: "Dinámica de networking", h: "5:00 – 5:25", min: 25, ico: "🤝" },
  { n: 2, id: "casos", t: "Comentamos los casos", h: "5:25 – 5:55", min: 30, ico: "📄" },
  { n: 3, id: "transmision", t: "Transmisión en vivo", h: "5:55 – 6:10", min: 15, ico: "📡" },
  { n: 4, id: "sorteo", t: "Sorteo de becas", h: "6:10 – 6:30", min: 20, ico: "🎁" },
];
const CASOS = [
  { id: "amateur-1", nombre: "Amateur I", sub: "Acta de constitución" },
  { id: "amateur-2", nombre: "Amateur II", sub: "Matriz de riesgos" },
  { id: "iathon", nombre: "IATHON", sub: "MVP con inteligencia artificial" },
];
export const TIPOS = { beca: "Beca completa", semibeca: "Media beca", cuarto: "Cuarto de beca", descuento: "Descuento", otro: "Premio" };
const TITULO_SORTEO = { beca: "Sorteo de beca", semibeca: "Sorteo de media beca", cuarto: "Sorteo de cuarto de beca", descuento: "Sorteo de descuento", otro: "Sorteo" };
const MURO_PREG = "¿De qué delegación eres y qué te llevas del VI CONCEPMI?";
export const RETOS = [
  "Preséntate en 20 segundos: tu nombre, tu delegación y qué proyecto te gustaría liderar.",
  "Busca a alguien de otra delegación y cuéntale qué te llevas del CONCEPMI.",
  "¿Cuál es la habilidad más importante de un project manager? Defiéndela en 30 segundos.",
  "Recomienda un libro, curso o podcast de gestión de proyectos.",
  "Cuenta un proyecto que salió mal y qué aprendiste de él.",
  "Reto relámpago: di 3 herramientas o marcos ágiles en 10 segundos.",
  "Si tu delegación fuera un proyecto, ¿cuál sería su objetivo SMART?",
  "Saluda a la delegación de al lado con la porra de tu universidad.",
  "¿Qué le dirías a tu yo de primer ciclo sobre gestionar proyectos?",
  "Nombra a alguien de otra delegación que conociste hoy y qué estudia.",
];
const urlMuro = () => `${location.origin}${location.pathname}?show=muro`;

// ---------- utilidades ----------
function dibujarQR(cont, texto) {
  if (!cont) return;
  if (!window.qrcode) { cont.innerHTML = `<p>${esc(texto)}</p>`; return; }
  const qr = window.qrcode(0, "M"); qr.addData(texto); qr.make();
  cont.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
}
// Logo del sponsor: se reduce a 800 px (conserva la transparencia) para que la base no pese
function reducirLogo(file) {
  return new Promise((res, rej) => {
    if (file.type === "image/svg+xml") { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(new Error("No se pudo leer el logo")); fr.readAsDataURL(file); return; }
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const k = Math.min(1, 800 / Math.max(img.width, img.height)), cv = document.createElement("canvas");
      cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k); cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      let d = cv.toDataURL("image/webp", 0.9); if (!d.startsWith("data:image/webp")) d = cv.toDataURL("image/png"); res(d); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}
// Enlace de transmisión → cómo mostrarlo
export function analizarLink(u) {
  const s = String(u || "").trim(); if (!s) return { tipo: "vacio" };
  const yt = s.match(/(?:youtube\.com\/(?:watch\?v=|live\/|embed\/|shorts\/)|youtu\.be\/)([\w-]{6,})/i);
  if (yt) return { tipo: "youtube", red: "YouTube", embed: `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0` };
  const tkv = s.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/i);
  if (tkv) return { tipo: "tiktok-video", red: "TikTok", embed: `https://www.tiktok.com/embed/v2/${tkv[1]}` };
  if (/tiktok\.com/i.test(s)) return { tipo: "externo", red: "TikTok" };
  if (/instagram\.com/i.test(s)) return { tipo: "externo", red: "Instagram" };
  if (/facebook\.com|fb\.watch/i.test(s)) return { tipo: "externo", red: "Facebook" };
  return { tipo: "externo", red: "la transmisión" };
}
// Sonidos sintetizados (sin archivos)
let ctxAudio = null;
export function tono(f = 880, dur = 0.05, tipo = "square", vol = 0.05) {
  try { ctxAudio ||= new (window.AudioContext || window.webkitAudioContext)(); const o = ctxAudio.createOscillator(), g = ctxAudio.createGain();
    o.type = tipo; o.frequency.value = f; g.gain.value = vol; o.connect(g); g.connect(ctxAudio.destination); const t = ctxAudio.currentTime;
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur); o.start(t); o.stop(t + dur); } catch { /* sin audio */ }
}
export const fanfarria = () => [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => tono(f, 0.35, "triangle", 0.09), i * 140));

// Pantalla completa genérica: devuelve { el, cerrar }
export function pantalla(clase, html, { alCerrar, teclas } = {}) {
  const el = document.createElement("div");
  el.className = `sh-pant ${clase}`;
  el.innerHTML = `${fondoAnimado(26)}${html}
    <nav class="sh-ctrl" data-ctrl><button class="btn btn--mini" data-full>Pantalla completa</button><button class="btn btn--mini btn--peligro" data-cerrar-p>Salir</button></nav>`;
  document.body.append(el); document.body.classList.add("sala-abierta");
  let ocultar = null;
  const mover = () => { el.classList.add("sh-pant--ctrl"); clearTimeout(ocultar); ocultar = setTimeout(() => el.classList.remove("sh-pant--ctrl"), 2600); };
  const tecla = (e) => { if (e.target.closest?.("input, textarea, select")) return; if (e.key === "Escape") return cerrar(); teclas?.(e); };
  function cerrar() { pantallaActiva.cerrada(cerrar); document.removeEventListener("keydown", tecla); el.removeEventListener("mousemove", mover); clearTimeout(ocultar);
    if (document.fullscreenElement && !pantallaActiva.transicion) document.exitFullscreen().catch(() => {}); el.remove(); document.body.classList.remove("sala-abierta"); alCerrar?.(); }
  el.addEventListener("mousemove", mover); document.addEventListener("keydown", tecla); mover(); pantallaActiva.abrir(cerrar);
  $("[data-full]", el).onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
  $("[data-cerrar-p]", el).onclick = cerrar;
  document.documentElement.requestFullscreen?.().catch(() => {});
  return { el, cerrar };
}
const cab = (t, sub = "") => `<header class="sh-cab"><img src="${IMG.logo}" alt="CONCEPMI"><div><small>Show en vivo · VI CONCEPMI 2026</small><b>${t}</b>${sub ? `<span>${sub}</span>` : ""}</div></header>`;

// =================== 1a · MURO EN VIVO ===================
export function abrirMuro(codigo) {
  let sondeo = null, vistos = new Set();
  const p = pantalla("sh-muro", `${cab("Muro en vivo", "Comenta desde tu celular")}
    <div class="sh-muro__cuerpo">
      <aside class="sh-muro__lado"><p class="sh-muro__preg" data-preg></p>
        <div class="sh-qr" data-qr></div><p class="sh-muro__url">${esc(urlMuro().replace(/^https?:\/\//, ""))}</p>
        <ol class="sh-muro__pasos"><li>Escanea el QR</li><li>Entra con tu <b>DNI</b></li><li>¡Escribe y mira la pantalla!</li></ol>
        <div class="sh-muro__cerrado" data-cerrado hidden>${I.candado} El muro está cerrado</div></aside>
      <section class="sh-muro__msgs" data-msgs><p class="sh-muro__vacio">Esperando los primeros comentarios…</p></section>
    </div>
    <footer class="sh-muro__rank" data-rank></footer>`, { alCerrar: () => clearTimeout(sondeo) });
  dibujarQR($("[data-qr]", p.el), urlMuro());
  async function ciclo() {
    try {
      const r = await api.showMuro(codigo);
      $("[data-preg]", p.el).textContent = r.info.pregunta || MURO_PREG;
      $("[data-cerrado]", p.el).hidden = !!r.info.abierto;
      const ms = r.mensajes.filter((m) => !m.oculto).slice(0, 12);
      if (ms.length) $("[data-msgs]", p.el).innerHTML = ms.map((m, i) => `<article class="sh-msg ${vistos.has(m.id) ? "" : "sh-msg--nuevo"}" style="--i:${i}">
          <p>${esc(m.texto)}</p><footer><b>${esc(m.nombre.split(" ").slice(0, 2).join(" "))}</b><span class="chip chip--celeste">${esc(m.delegacion)}</span></footer></article>`).join("");
      if (ms.some((m) => !vistos.has(m.id)) && vistos.size) tono(1320, 0.12, "sine", 0.06);
      ms.forEach((m) => vistos.add(m.id));
      const max = Math.max(1, ...r.ranking.map((x) => x.mensajes));
      $("[data-rank]", p.el).innerHTML = r.ranking.length ? `<b>Delegaciones más participativas</b>${r.ranking.slice(0, 6).map((x, i) => `<div class="sh-rank"><span>${i === 0 ? "🏆 " : ""}${esc(x.delegacion)}</span><i style="--w:${(x.mensajes / max) * 100}%"></i><small>${x.mensajes}</small></div>`).join("")}` : "";
    } catch (e) { /* reintenta */ }
    if (document.body.contains(p.el)) sondeo = setTimeout(ciclo, 3000);
  }
  ciclo();
}

// =================== 1b · RULETA DE DELEGACIONES ===================
export function abrirRuleta(delegaciones, retos) {
  const dels = delegaciones.filter((d) => d.siglas || d.nombre);
  const lista = (retos?.length ? retos : RETOS);
  if (!dels.length) return aviso("Aún no hay delegaciones registradas", "error");
  let girando = false, crono = null;
  const p = pantalla("sh-ruleta", `${cab("Ruleta de delegaciones", "¿A qué delegación le toca?")}
    <div class="sh-ruleta__cuerpo">
      <div class="sh-ruleta__rodillo"><div class="sh-ruleta__ventana"><b data-del>?</b><small data-del-nom>Pulsa Espacio para girar</small></div></div>
      <article class="sh-reto" data-reto hidden><small>Reto para la delegación</small><p data-reto-txt></p><div class="sh-reto__crono" data-crono>0:30</div></article>
    </div>
    <p class="sh-ayuda">Espacio: girar · T: cronómetro de 30 s · Esc: salir</p>`, { alCerrar: () => clearInterval(crono), teclas: (e) => {
      if (e.key === " " || e.key === "Enter" || e.key === "PageDown" || e.key === "ArrowRight") { e.preventDefault(); girar(); }
      if (e.key === "t" || e.key === "T") cronometro();
    } });
  function cronometro() {
    clearInterval(crono); let s = 30; const c = $("[data-crono]", p.el); c.classList.remove("sh-reto__crono--fin"); c.textContent = "0:30";
    crono = setInterval(() => { s--; c.textContent = `0:${String(Math.max(s, 0)).padStart(2, "0")}`; if (s <= 5 && s > 0) tono(660, 0.08); if (s <= 0) { clearInterval(crono); c.classList.add("sh-reto__crono--fin"); tono(440, 0.6, "sawtooth", 0.08); } }, 1000);
  }
  function girar() {
    if (girando) return; girando = true; clearInterval(crono); $("[data-reto]", p.el).hidden = true;
    const fin = dels[Math.floor(Math.random() * dels.length)], reto = lista[Math.floor(Math.random() * lista.length)];
    let k = 0, paso = 50; const total = 26 + Math.floor(Math.random() * 6);
    const tic = () => {
      const d = k >= total ? fin : dels[(k + Math.floor(Math.random() * dels.length)) % dels.length];
      $("[data-del]", p.el).textContent = d.siglas || d.nombre; $("[data-del-nom]", p.el).textContent = d.siglas ? d.nombre : "";
      tono(900 + (k % 5) * 40, 0.03); k++;
      if (k <= total) { paso *= 1.065; setTimeout(tic, paso); return; }
      $(".sh-ruleta__ventana", p.el).classList.add("sh-ruleta__ventana--fin"); fanfarria(); lanzarConfeti();
      setTimeout(() => { $("[data-reto-txt]", p.el).textContent = reto; $("[data-reto]", p.el).hidden = false; $(".sh-ruleta__ventana", p.el).classList.remove("sh-ruleta__ventana--fin"); girando = false; }, 900);
    };
    tic();
  }
}

// =================== 2 · CASOS ===================
export function proyectarCasos(codigo, archivos) {
  const items = CASOS.map((c) => ({ equipo_id: c.id, delegacion: { siglas: c.nombre, nombre: `Caso de ${c.nombre} · ${c.sub}` }, proyecto: "Lo comentamos en vivo", pres: { pdf: archivos?.[c.id] || null },
    minutos: { exp: 8, preg: 2 } }));
  if (!items.some((x) => x.pres.pdf)) return aviso("Primero sube al menos un caso en PDF", "error");
  abrirSalaProyectos({ equipos: items, concurso: "Show en vivo · Comentamos los casos", clase: "sala--ponencias", minutos: { exp: 8, preg: 2 },
    url: (id) => api.showCasoUrl(codigo, id), abrir: async (id) => { try { window.open(await api.showCasoUrl(codigo, id), "_blank"); } catch (e) { aviso(e.message, "error"); } },
    textos: { orden: "Show en vivo · Los casos de hoy", exp: "Comentario del caso", preg: "Preguntas del público", btnExp: "Comentario", btnPreg: "Preguntas",
      corto: (k) => items[k].delegacion.siglas, num: (k) => String(k + 1), detalle: (k) => CASOS[k].sub,
      portada: (k) => `Caso <b>${k + 1}</b> de ${items.length}`, cab: (k) => `Caso · ${items[k].delegacion.siglas}` } });
}

// =================== 3 · TRANSMISIÓN ===================
export function abrirTransmision(config) {
  const link = config?.link || "", a = analizarLink(link);
  if (a.tipo === "vacio") return aviso("Primero pega el enlace de la transmisión", "error");
  const p = pantalla("sh-trans", `${cab(`<span class="sh-envivo">● EN VIVO</span> ${esc(config.link_titulo || "Transmisión en vivo")}`, `Desde ${esc(a.red)}`)}
    ${a.embed ? `<div class="sh-trans__marco"><iframe src="${esc(a.embed)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen title="Transmisión en vivo"></iframe></div>
      <aside class="sh-trans__qr"><div data-qr></div><small>Síguelo en tu celular</small></aside>`
    : `<div class="sh-trans__ext"><div class="sh-trans__pulso">● EN VIVO</div><h2>Estamos transmitiendo en ${esc(a.red)}</h2>
        <div class="sh-trans__qrgrande" data-qr></div><p>Escanea y síguenos desde tu celular</p>
        <button class="btn btn--naranja" data-abrir>${I.vivo}Abrir la transmisión en esta pantalla</button>
        <small>${esc(a.red)} no permite mostrar sus «lives» dentro de otra página: se abre en una ventana aparte. Luego pulsa <b>F11</b> para verla a pantalla completa.</small></div>`}`);
  dibujarQR($("[data-qr]", p.el), link);
  $("[data-abrir]", p.el)?.addEventListener("click", () => window.open(link, "concepmi-transmision", `popup,width=${screen.availWidth},height=${screen.availHeight},left=0,top=0`));
}

// =================== 4 · SORTEO DE BECAS ===================
export async function abrirSorteo(codigo, premioInicial = null, { alCerrar } = {}) {
  let S, codigos;
  try { [S, codigos] = await Promise.all([api.showDatos(codigo), api.showParticipantes(codigo)]); } catch (e) { return aviso(e.message, "error"); }
  if (!S.premios.length) return aviso("Primero agrega los premios del sorteo", "error");
  if (!codigos.length) return aviso("No hay inscritos con código: importa el Excel de confirmados", "error");
  let i = Math.max(0, S.premios.findIndex((p) => p.id === premioInicial)), girando = false, ultimo = null;
  const premio = () => S.premios[i], spon = (p) => S.sponsors.find((s) => s.id === p?.sponsor_id);
  const ganadoresDe = (p) => S.ganadores.filter((g) => g.premio_id === p.id && !g.anulado);
  const pant = pantalla("sh-sorteo", `<div class="sh-sorteo__vista" data-vista></div>
    <nav class="sh-sorteo__ctrl"><button class="btn btn--mini" data-pr="-1">◀ Premio</button><span data-cuenta></span><button class="btn btn--mini" data-pr="1">Premio ▶</button>
      <button class="btn btn--mini btn--naranja" data-sortear>🎲 Sortear (Espacio)</button><button class="btn btn--mini" data-ausente hidden>No está presente · volver a sortear</button></nav>`,
    { alCerrar, teclas: (e) => { if ([" ", "Enter", "PageDown"].includes(e.key)) { e.preventDefault(); sortear(); } if (e.key === "ArrowRight") mover(1); if (e.key === "ArrowLeft") mover(-1); } });
  const el = pant.el;
  function pintar(estado = "listo") {
    const p = premio(), s = spon(p), gs = ganadoresDe(p), quedan = p.cantidad - gs.length;
    $("[data-cuenta]", el).textContent = `Premio ${i + 1} de ${S.premios.length}`;
    $("[data-sortear]", el).disabled = quedan <= 0 || girando;
    $("[data-ausente]", el).hidden = !(ultimo && ultimo.premio_id === p.id && estado === "ganador");
    $("[data-vista]", el).innerHTML = `
      <section class="sh-sorteo__izq">
        <img class="sh-sorteo__logo" src="${IMG.logo}" alt="CONCEPMI">
        <small class="sh-sorteo__kicker">Show en vivo · Sorteo de becas</small>
        <h1>${esc(TITULO_SORTEO[p.tipo] || "Sorteo")}</h1>
        <p class="sh-sorteo__premio">${esc(p.titulo || TIPOS[p.tipo])}${p.detalle ? ` <span>· ${esc(p.detalle)}</span>` : ""}</p>
        <p class="sh-sorteo__quedan">${quedan > 0 ? `Quedan <b>${quedan}</b> de ${p.cantidad}` : `✓ Los ${p.cantidad} ya fueron sorteados`}</p>
        <div class="sh-slot ${estado === "ganador" ? "sh-slot--fin" : ""}"><small>Código ganador</small><b data-codigo>${estado === "ganador" && ultimo ? esc(ultimo.codigo) : "CVI ? ? ? ?"}</b></div>
        <div class="sh-ganador" data-ganador ${estado === "ganador" ? "" : "hidden"}>${ultimo ? `<small>¡Felicidades!</small><b>${esc(ultimo.nombre)}</b><span class="sh-ganador__del">${I.bandera} ${esc(ultimo.delegacion_nombre || ultimo.delegacion)}</span>` : ""}</div>
        ${gs.length ? `<div class="sh-sorteo__previos"><small>Ganadores de este premio</small>${gs.map((g) => `<span>${esc(g.nombre.split(" ").slice(0, 2).join(" "))} · ${esc(g.delegacion)}</span>`).join("")}</div>` : ""}
      </section>
      <section class="sh-sorteo__der">
        ${s ? `<div class="sh-sponsor"><div class="sh-sponsor__logo">${s.logo ? `<img src="${esc(s.logo)}" alt="${esc(s.nombre)}">` : `<b>${esc(s.nombre)}</b>`}</div>
          <small>Este premio es gracias a</small><b class="sh-sponsor__nombre">${esc(s.nombre)}</b></div>`
        : `<div class="sh-sponsor sh-sponsor--sin"><img src="${IMG.wolfito}" alt=""><b class="sh-sponsor__nombre">VI CONCEPMI 2026</b></div>`}
      </section>
      <footer class="sh-sorteo__pie">¡Gracias por ser parte del <b>VI CONCEPMI 2026</b>!</footer>`;
  }
  function mover(d) { if (girando) return; i = (i + d + S.premios.length) % S.premios.length; ultimo = null; pintar(); }
  async function sortear() {
    if (girando) return; const p = premio(); if (ganadoresDe(p).length >= p.cantidad) return;
    girando = true; pintar("girando"); $("[data-sortear]", el).disabled = true;
    let g; try { g = await api.showSortear(codigo, p.id); } catch (e) { aviso(e.message, "error"); girando = false; pintar(); return; }
    // Ruleta de códigos: rápido al inicio, luego más lento, y se detiene en el ganador
    const caja = $("[data-codigo]", el); let k = 0, paso = 45; const total = 40;
    const tic = () => {
      caja.textContent = k >= total ? g.codigo : codigos[(Math.random() * codigos.length) | 0];
      tono(700 + (k % 6) * 60, 0.03); k++;
      if (k <= total) { paso *= 1.055; setTimeout(tic, paso); return; }
      S.ganadores.push({ ...g, anulado: false }); ultimo = g; girando = false;
      fanfarria(); lanzarConfeti(); setTimeout(lanzarConfeti, 700);
      pintar("ganador");
    };
    tic();
  }
  $("[data-sortear]", el).onclick = sortear;
  $$("[data-pr]", el).forEach((b) => (b.onclick = () => mover(Number(b.dataset.pr))));
  $("[data-ausente]", el).onclick = async () => {
    if (!ultimo || !(await confirmar("¿No está presente?", `Se anula el premio de <b>${esc(ultimo.nombre)}</b> (${esc(ultimo.codigo)}) y se vuelve a sortear.`, { boton: "Anular y volver a sortear", peligro: true }))) return;
    try { await api.showAnular(codigo, ultimo.id, "No estaba presente"); const x = S.ganadores.find((y) => y.id === ultimo.id); if (x) x.anulado = true; ultimo = null; pintar(); sortear(); } catch (e) { aviso(e.message, "error"); }
  };
  pintar();
}

// =================== Pestaña del admin ===================
// ctx: { codigo(), data(), importarInscritos?: () => void }
export function crearShow(ctx) {
  let S = null, muroMsgs = null;
  const cod = () => ctx.codigo();
  async function cargar() { S = await api.showDatos(cod()); S.config ||= {}; }
  async function vista(v) {
    if (!S) { v.innerHTML = `<div class="cargando"><div class="giro"></div>Cargando el Show en vivo…</div>`; try { await cargar(); } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`; return; } }
    pintar(v);
  }
  const recargar = async (v) => { await cargar(); pintar(v); };
  function pintar(v) {
    const ed = S.nivel === "editar", op = ed || S.nivel === "operar", c = S.config;
    const sp = (id) => S.sponsors.find((s) => s.id === id), a = analizarLink(c.link);
    const sec = (x, cuerpo, extra = "") => `<section class="sh-sec tarjeta" id="sh-${x.id}"><div class="sh-sec__cab"><span class="sh-sec__n">${x.n}</span><div><h2>${x.ico} ${x.t}</h2><small>${x.h} p. m. · ${x.min} min</small></div>${extra}</div>${cuerpo}</section>`;
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Show en vivo</h1><p><b>${SHOW.dia} · ${SHOW.hora}</b> · ${SHOW.lugar}. Para las delegaciones que no compiten en ese momento (en paralelo con <b>IATHON, Amateur I y Amateur II</b>). El presentador anima; tú o el operador de Proyección lanzan cada pantalla.</p></div></div>
      <div class="sh-agenda">${AGENDA.map((x) => `<a href="#sh-${x.id}" class="sh-agenda__item" style="flex:${x.min}"><span>${x.n}</span><b>${x.t}</b><small>${x.h}</small></a>`).join("")}</div>
      ${sec(AGENDA[0], `
        <p class="ayuda">Dos dinámicas listas para proyectar, <b>sin internet para el público</b>: nadie usa su celular, todo pasa en la laptop del proyector.</p>
        <div class="sh-dos">
          <article class="sh-op"><h3>A · ¿Esto o aquello? · Aplausómetro 👏</h3>
            <p>En pantalla salen <b>dos opciones</b> (por ejemplo «Metodología ágil 🏃 vs Cascada 🌊»). El público elige bando y <b>aplaude</b>: el <b>micrófono de la laptop</b> mide 5 segundos a cada bando y llena su barra. Gana el que suena más (confeti 🎉) y el presentador <b>pasa el micro</b> a alguien de cada bando para que defienda su elección.</p>
            <ol class="sh-pasos"><li><b>A</b> (o ←): cuenta 3, 2, 1 y aplauden los de la izquierda.</li><li><b>B</b> (o →): aplauden los de la derecha.</li><li><b>Espacio</b>: ¡el ganador! Otra vez Espacio: siguiente duelo (N / P para saltar).</li></ol>
            <label class="campo"><span>Duelos (uno por línea: <b>opción A | opción B</b>)</span><textarea data-duelos rows="6">${esc(leerDuelos().join("\n"))}</textarea></label>
            <div class="sh-acc"><button class="btn btn--mini" data-duelos-guardar>${I.check}Guardar en esta laptop</button><button class="btn btn--mini" data-duelos-reset>Volver a los sugeridos</button><button class="btn btn--naranja" data-duelo>${I.vivo}Proyectar ¿Esto o aquello?</button></div>
            <p class="ayuda" style="margin:8px 0 0">La primera vez el navegador pide <b>permiso para el micrófono</b>: pulsa «Permitir». Si no hay micrófono, el presentador decide por oído con A / B. Los duelos se guardan solo en esta laptop: edítalos en la del proyector.</p>
          </article>
          <article class="sh-op"><h3>B · Ruleta de delegaciones</h3>
            <p>La ruleta gira entre las delegaciones y elige una al azar; sale un <b>reto</b> para que alguien de esa delegación pase al frente o responda desde su sitio (con cronómetro de 30 s). Ideal para que el presentador anime.</p>
            <label class="campo"><span>Retos (uno por línea)</span><textarea data-retos rows="6" ${ed ? "" : "disabled"}>${esc((c.retos?.length ? c.retos : RETOS).join("\n"))}</textarea></label>
            <div class="sh-acc">${ed ? `<button class="btn btn--mini" data-retos-guardar>${I.check}Guardar retos</button>` : ""}<button class="btn btn--naranja" data-ruleta>${I.vivo}Proyectar ruleta</button></div>
          </article>
        </div>
        <details class="sh-ideas"><summary>💡 Más ideas para el presentador (sin pantalla)</summary><ul>
          <li><b>Speed networking 3×3:</b> 3 rondas de 3 minutos; cada uno se voltea hacia alguien de otra delegación y se presentan con una pregunta (usa el cronómetro de la ruleta con la tecla T).</li>
          <li><b>Bingo humano:</b> busca a alguien que… «sea de otra ciudad», «haya liderado un proyecto», «use Scrum»… El primero en completar 3 gana un detalle.</li>
          <li><b>Batalla de porras:</b> cada delegación hace su porra; el público decide con aplausos quién gana.</li>
          <li><b>Levántate si…:</b> «…ya lideraste un proyecto», «…usas Scrum», «…dormiste menos de 5 horas por el CONCEPMI». Se paran y el presentador entrevista a uno.</li></ul></details>`)}
      ${sec(AGENDA[1], `
        <p class="ayuda">Sube el caso de cada concurso en <b>PDF</b> y proyéctalo para comentarlo en vivo (se pasa con el puntero, como en las charlas). Tiene cronómetro de 8 min de comentario + 2 de preguntas por caso.</p>
        <div class="sh-casos">${CASOS.map((x) => { const f = S.archivos[x.id]; return `<article class="sh-caso ${f ? "sh-caso--ok" : ""}"><small>${esc(x.sub)}</small><h3>${esc(x.nombre)}</h3>
          <p>${f ? `✓ <b>${esc(f.nombre)}</b> · ${(f.tamano / 1048576).toFixed(1)} MB` : "Aún no se sube"}</p>
          <div class="pres-barra" data-barra="${x.id}" hidden><i></i><span>0 %</span></div>
          <div class="sh-acc">${ed ? `<label class="btn btn--mini ${f ? "" : "btn--naranja"}">${I.descargar}${f ? "Reemplazar" : "Subir PDF"}<input type="file" accept=".pdf,application/pdf" data-caso="${x.id}" hidden></label>` : ""}
            ${f ? `<button class="btn btn--mini" data-ver-caso="${x.id}">${I.vivo}Ver</button>${ed ? `<button class="btn btn--mini btn--peligro" data-quitar-caso="${x.id}">${I.basura}</button>` : ""}` : ""}</div></article>`; }).join("")}</div>
        <div class="sh-acc"><button class="btn btn--naranja" data-casos-proy ${Object.keys(S.archivos).length ? "" : "disabled"}>${I.vivo}Proyectar los casos</button></div>`)}
      ${sec(AGENDA[2], `
        <p class="ayuda">Un voluntario transmite en vivo (por ejemplo, desde TikTok). Pega aquí el enlace y proyéctalo. <b>YouTube</b> (y los videos de TikTok) se ven dentro de la pantalla; los <b>lives de TikTok o Instagram</b> no se pueden incrustar: se muestra un QR gigante y un botón para abrirlo en una ventana aparte (luego F11).</p>
        <div class="sh-trans-form"><label class="campo"><span>Enlace de la transmisión</span><input data-link maxlength="500" value="${esc(c.link || "")}" placeholder="https://www.tiktok.com/@concepmi/live" ${ed ? "" : "disabled"}></label>
          <label class="campo"><span>Título en pantalla (opcional)</span><input data-link-tit maxlength="120" value="${esc(c.link_titulo || "")}" placeholder="Así se vive el CONCEPMI en las salas" ${ed ? "" : "disabled"}></label></div>
        <p class="ayuda" data-link-tipo>${a.tipo === "vacio" ? "" : a.embed ? `✓ ${esc(a.red)}: se verá dentro de la pantalla.` : `ℹ ${esc(a.red)}: se mostrará con QR y botón para abrirlo aparte.`}</p>
        <div class="sh-acc">${ed ? `<button class="btn btn--mini" data-link-guardar>${I.check}Guardar enlace</button>` : ""}<button class="btn btn--naranja" data-trans ${c.link ? "" : "disabled"}>${I.vivo}Proyectar transmisión</button></div>
        <details class="sh-ideas"><summary>💡 Recomendación para que se vea en el auditorio</summary><ul>
          <li>La opción más segura: que el voluntario transmita a la vez por <b>YouTube Live</b> (desde el celular, canal del CONCEPMI) y pegar ese enlace: se ve dentro de la pantalla, sin salir del panel.</li>
          <li>Si es solo TikTok Live: abre el live en la laptop del auditorio con el botón «Abrir la transmisión» y pulsa F11. Prueba antes que la laptop tenga sesión o acceso a TikTok.</li>
          <li>Con internet lento, baja la calidad en el celular que transmite.</li></ul></details>`)}
      ${sec(AGENDA[3], `
        <div class="sh-part"><div><b>${S.participantes}</b> inscritos con código participan del sorteo</div><small>Sale de la lista de confirmados (el mismo Excel de Charlas → Importar inscritos). El ganador lo elige la base de datos al azar por su <b>código</b>; luego se revela su nombre y delegación. Nadie gana dos premios.</small>
          ${ctx.importarInscritos ? `<button class="btn btn--mini" data-importar>${I.descargar}Importar Excel de confirmados</button>` : ""}</div>
        <h3 class="sh-sub">Sponsors (marcas aliadas)</h3>
        <div class="sh-sponsors">${S.sponsors.map((s) => `<article class="sh-sp"><div class="sh-sp__logo">${s.logo ? `<img src="${esc(s.logo)}" alt="">` : `<span>${esc(s.nombre.slice(0, 2).toUpperCase())}</span>`}</div><b>${esc(s.nombre)}</b>
            ${ed ? `<div class="sh-acc"><button class="btn btn--mini" data-sp-editar="${s.id}">${I.lapiz}</button><button class="btn btn--mini btn--peligro" data-sp-borrar="${s.id}">${I.basura}</button></div>` : ""}</article>`).join("")}
          ${ed ? `<button class="crear sh-sp sh-sp--nuevo" data-sp-nuevo>${I.mas}<span>Agregar sponsor</span></button>` : S.sponsors.length ? "" : `<p class="ayuda">Aún no hay sponsors.</p>`}</div>
        <h3 class="sh-sub">Premios a sortear <span class="chip">${S.premios.reduce((n, p) => n + p.cantidad, 0)} en total</span></h3>
        ${S.premios.length ? `<div class="tabla-envoltura"><table class="tabla sh-premios"><thead><tr><th>Tipo</th><th>Premio</th><th>Sponsor</th><th class="num">Cantidad</th><th class="num">Sorteados</th><th></th></tr></thead><tbody>
          ${S.premios.map((p) => `<tr><td><span class="chip chip--${p.tipo === "beca" ? "verde" : p.tipo === "descuento" ? "celeste" : "ambar"}">${esc(TIPOS[p.tipo])}</span></td><td><b>${esc(p.titulo || "—")}</b>${p.detalle ? `<br><small class="tenue">${esc(p.detalle)}</small>` : ""}</td>
            <td>${esc(sp(p.sponsor_id)?.nombre || "—")}</td><td class="num">${p.cantidad}</td><td class="num">${p.sorteados}/${p.cantidad}</td>
            <td><div class="sh-acc">${op ? `<button class="btn btn--mini btn--naranja" data-sortear="${p.id}" ${p.sorteados >= p.cantidad ? "disabled" : ""}>🎲 Sortear</button>` : ""}${ed ? `<button class="btn btn--mini" data-pr-editar="${p.id}">${I.lapiz}</button><button class="btn btn--mini btn--peligro" data-pr-borrar="${p.id}">${I.basura}</button>` : ""}</div></td></tr>`).join("")}</tbody></table></div>`
          : `<div class="vacio"><b>Aún no hay premios</b>Agrega cada premio: tipo (beca, media beca, cuarto, descuento), nombre, sponsor y cantidad.</div>`}
        <div class="sh-acc">${ed ? `<button class="btn" data-pr-nuevo>${I.mas}Agregar premio</button>` : ""}<button class="btn btn--naranja" data-sorteo ${S.premios.length && op ? "" : "disabled"}>${I.copa}Proyectar sorteo de becas</button></div>
        ${S.ganadores.length ? `<h3 class="sh-sub">Ganadores</h3><div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Premio</th><th>Código</th><th>Nombre</th><th>Delegación</th><th></th></tr></thead><tbody>
          ${S.ganadores.map((g) => { const p = S.premios.find((x) => x.id === g.premio_id); return `<tr class="${g.anulado ? "sh-anulado" : ""}"><td>${esc(TIPOS[p?.tipo] || "")}${p?.titulo ? ` · ${esc(p.titulo)}` : ""}</td><td><code>${esc(g.codigo)}</code></td><td><b>${esc(g.nombre)}</b></td><td>${esc(g.delegacion)}</td>
            <td>${g.anulado ? `<small class="tenue">Anulado · ${esc(g.motivo)}</small>` : op ? `<button class="btn btn--mini" data-anular="${g.id}">No estaba presente</button>` : ""}</td></tr>`; }).join("")}</tbody></table></div>
          ${ed ? `<button class="btn btn--mini btn--peligro" data-limpiar-sorteos style="margin-top:8px">${I.basura}Borrar todos los sorteos (pruebas)</button>` : ""}` : ""}`)}`;
    enlazar(v, ed, op);
  }

  function enlazar(v, ed, op) {
    const err = (e) => aviso(e.message, "error");
    // 1A · ¿Esto o aquello? (aplausómetro, sin internet)
    const duelosTxt = () => $("[data-duelos]", v).value.split("\n").map((x) => x.trim()).filter((x) => x.includes("|"));
    $("[data-duelos-guardar]", v).onclick = () => { const n = guardarDuelos($("[data-duelos]", v).value.split("\n")).length; aviso(n ? `${n} duelos guardados en esta laptop` : "Escribe cada duelo como «opción A | opción B»", n ? "ok" : "error"); };
    $("[data-duelos-reset]", v).onclick = () => { guardarDuelos([]); $("[data-duelos]", v).value = DUELOS.join("\n"); aviso("Se volvió a los duelos sugeridos"); };
    $("[data-duelo]", v).onclick = () => abrirDuelo(duelosTxt());
    $("[data-retos-guardar]", v)?.addEventListener("click", async () => { try { await api.showConfig(cod(), { retos: $("[data-retos]", v).value.split("\n") }); await recargar(v); aviso("Retos guardados"); } catch (e) { err(e); } });
    $("[data-ruleta]", v).onclick = () => abrirRuleta(ctx.data()?.delegaciones || [], $("[data-retos]", v).value.split("\n").map((x) => x.trim()).filter(Boolean));
    // 2 · Casos
    $$("[data-caso]", v).forEach((inp) => (inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; const b = $(`[data-barra="${inp.dataset.caso}"]`, v); b.hidden = false;
      try { await api.showCasoSubir(cod(), inp.dataset.caso, f, (p) => { $("i", b).style.width = `${Math.round(p * 100)}%`; $("span", b).textContent = `${Math.round(p * 100)} %`; }); lanzarConfeti(); aviso("Caso subido"); await recargar(v); } catch (e) { b.hidden = true; err(e); } }));
    $$("[data-ver-caso]", v).forEach((b) => (b.onclick = async () => { const w = window.open("", "_blank"); try { w.location.href = await api.showCasoUrl(cod(), b.dataset.verCaso); } catch (e) { w?.close(); err(e); } }));
    $$("[data-quitar-caso]", v).forEach((b) => (b.onclick = async () => { if (!(await confirmar("¿Quitar este caso?", "Se borra el PDF del show (no toca el caso oficial del concurso).", { boton: "Quitar", peligro: true }))) return; try { await api.showCasoQuitar(cod(), b.dataset.quitarCaso); await recargar(v); } catch (e) { err(e); } }));
    $("[data-casos-proy]", v).onclick = () => proyectarCasos(cod(), S.archivos);
    // 3 · Transmisión
    $("[data-link]", v).oninput = (e) => { const a = analizarLink(e.target.value); $("[data-link-tipo]", v).textContent = a.tipo === "vacio" ? "" : a.embed ? `✓ ${a.red}: se verá dentro de la pantalla.` : `ℹ ${a.red}: se mostrará con QR y botón para abrirlo aparte.`; };
    $("[data-link-guardar]", v)?.addEventListener("click", async () => { try { await api.showConfig(cod(), { link: $("[data-link]", v).value, link_titulo: $("[data-link-tit]", v).value }); await recargar(v); aviso("Enlace guardado"); } catch (e) { err(e); } });
    $("[data-trans]", v).onclick = () => abrirTransmision({ link: $("[data-link]", v).value || S.config.link, link_titulo: $("[data-link-tit]", v).value || S.config.link_titulo });
    // 4 · Sorteo
    $("[data-importar]", v)?.addEventListener("click", () => ctx.importarInscritos(() => recargar(v)));
    $("[data-sp-nuevo]", v)?.addEventListener("click", () => formSponsor(null, v));
    $$("[data-sp-editar]", v).forEach((b) => (b.onclick = () => formSponsor(S.sponsors.find((s) => s.id === b.dataset.spEditar), v)));
    $$("[data-sp-borrar]", v).forEach((b) => (b.onclick = async () => { const s = S.sponsors.find((x) => x.id === b.dataset.spBorrar);
      if (!(await confirmar("¿Quitar este sponsor?", `Se quita <b>${esc(s.nombre)}</b>. Sus premios quedan sin sponsor.`, { boton: "Quitar", peligro: true }))) return; try { await api.showSponsor(cod(), { id: s.id, borrar: true }); await recargar(v); } catch (e) { err(e); } }));
    $("[data-pr-nuevo]", v)?.addEventListener("click", () => formPremio(null, v));
    $$("[data-pr-editar]", v).forEach((b) => (b.onclick = () => formPremio(S.premios.find((p) => p.id === b.dataset.prEditar), v)));
    $$("[data-pr-borrar]", v).forEach((b) => (b.onclick = async () => { const p = S.premios.find((x) => x.id === b.dataset.prBorrar);
      if (!(await confirmar("¿Quitar este premio?", `Se quita <b>${esc(TIPOS[p.tipo])}${p.titulo ? ` · ${esc(p.titulo)}` : ""}</b>${p.sorteados ? " y sus ganadores" : ""}.`, { boton: "Quitar", peligro: true }))) return; try { await api.showPremio(cod(), { id: p.id, borrar: true }); await recargar(v); } catch (e) { err(e); } }));
    $$("[data-sortear]", v).forEach((b) => (b.onclick = () => abrirSorteo(cod(), b.dataset.sortear, { alCerrar: () => recargar(v).catch(() => {}) })));
    $("[data-sorteo]", v).onclick = () => abrirSorteo(cod(), null, { alCerrar: () => recargar(v).catch(() => {}) });
    $$("[data-anular]", v).forEach((b) => (b.onclick = async () => { if (!(await confirmar("¿No estaba presente?", "Se anula este premio y se puede volver a sortear.", { boton: "Anular", peligro: true }))) return; try { await api.showAnular(cod(), b.dataset.anular); await recargar(v); } catch (e) { err(e); } }));
    $("[data-limpiar-sorteos]", v)?.addEventListener("click", async () => { if (!(await confirmar("¿Borrar todos los sorteos?", "Se borran todos los ganadores (por ejemplo, los de las pruebas). Los premios y sponsors se quedan.", { boton: "Borrar sorteos", peligro: true }))) return; try { await api.showLimpiar(cod(), "sorteos"); await recargar(v); aviso("Sorteos borrados"); } catch (e) { err(e); } });
  }

  async function pintarModeracion(v, op) {
    const caja = $("[data-moderar] [data-msgs]", v);
    try { muroMsgs = (await api.showMuro(cod())).mensajes; } catch (e) { caja.innerHTML = `<p class="error">${esc(e.message)}</p>`; return; }
    caja.innerHTML = muroMsgs.length ? `<div class="sh-mod">${muroMsgs.map((m) => `<div class="sh-mod__fila ${m.oculto ? "sh-mod__fila--oculto" : ""}"><span><b>${esc(m.nombre)}</b> · ${esc(m.delegacion)}<br>${esc(m.texto)}</span>
      ${op ? `<button class="btn btn--mini" data-ocultar="${m.id}" data-o="${m.oculto ? 0 : 1}">${m.oculto ? "Mostrar" : "Ocultar"}</button>` : ""}</div>`).join("")}</div>` : `<p class="ayuda">Aún no hay comentarios.</p>`;
    $$("[data-ocultar]", caja).forEach((b) => (b.onclick = async () => { try { await api.showMensaje(cod(), b.dataset.ocultar, b.dataset.o === "1"); await pintarModeracion(v, op); } catch (e) { aviso(e.message, "error"); } }));
  }

  function formSponsor(s, v) {
    let logo = null;
    const m = modal(`<h2>${s ? "Editar sponsor" : "Nuevo sponsor"}</h2><form class="form">
      <label class="campo"><span>Nombre de la marca</span><input name="nombre" maxlength="80" required value="${esc(s?.nombre || "")}" placeholder="Ej. Gestiónate"></label>
      <div class="sh-sp-prev" data-prev>${s?.logo ? `<img src="${esc(s.logo)}" alt="">` : "<span>Sin logo</span>"}</div>
      <label class="btn" style="justify-self:start;cursor:pointer">${I.camara}Subir logo (PNG transparente, JPG, WEBP o SVG)<input type="file" name="logo" accept="image/png,image/jpeg,image/webp,image/svg+xml" hidden></label>
      <p class="ayuda" style="margin:0">Sale en grande al lado derecho de la pantalla del sorteo. Mejor si es PNG con fondo transparente.</p>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`);
    const f = $("form", m.el); $("[data-cancelar]", m.el).onclick = m.cerrar;
    f.logo.onchange = async () => { const a = f.logo.files?.[0]; if (!a) return; try { logo = await reducirLogo(a); $("[data-prev]", m.el).innerHTML = `<img src="${logo}" alt="">`; } catch (e) { $(".error", f).textContent = e.message; } };
    f.onsubmit = async (e) => { e.preventDefault(); try { await api.showSponsor(cod(), { id: s?.id || null, nombre: f.nombre.value, logo }); m.cerrar(); await recargar(v); aviso(s ? "Sponsor actualizado" : "Sponsor agregado"); } catch (ex) { $(".error", f).textContent = ex.message; } };
  }
  function formPremio(p, v) {
    const m = modal(`<h2>${p ? "Editar premio" : "Nuevo premio"}</h2><form class="form">
      <label class="campo"><span>Tipo</span><select name="tipo">${Object.entries(TIPOS).map(([k, t]) => `<option value="${k}" ${(p?.tipo || "beca") === k ? "selected" : ""}>${t}</option>`).join("")}</select></label>
      <label class="campo"><span>Premio (qué se gana)</span><input name="titulo" maxlength="160" value="${esc(p?.titulo || "")}" placeholder="Ej. Curso de preparación PMP" required></label>
      <label class="campo"><span>Detalle (opcional)</span><input name="detalle" maxlength="160" value="${esc(p?.detalle || "")}" placeholder="Ej. 50 % de descuento · válido hasta marzo"></label>
      <label class="campo"><span>Sponsor</span><select name="sponsor"><option value="">Sin sponsor (VI CONCEPMI)</option>${S.sponsors.map((s) => `<option value="${s.id}" ${p?.sponsor_id === s.id ? "selected" : ""}>${esc(s.nombre)}</option>`).join("")}</select></label>
      <label class="campo"><span>Cantidad (cuántos ganadores)</span><input name="cantidad" type="number" min="1" max="100" value="${p?.cantidad || 1}" required></label>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`);
    const f = $("form", m.el); $("[data-cancelar]", m.el).onclick = m.cerrar;
    f.onsubmit = async (e) => { e.preventDefault(); try { await api.showPremio(cod(), { id: p?.id || null, tipo: f.tipo.value, titulo: f.titulo.value, detalle: f.detalle.value, sponsor: f.sponsor.value || null, cantidad: Number(f.cantidad.value) }); m.cerrar(); await recargar(v); aviso(p ? "Premio actualizado" : "Premio agregado"); } catch (ex) { $(".error", f).textContent = ex.message; } };
  }
  return { vista };
}

// Botones del Show para el Panel de Proyección
export function htmlShowProyeccion() {
  const t = (attrs, ico, titulo, sub) => `<button class="pyc-tarjeta" ${attrs}><span class="pyc-tarjeta__ico">${ico}</span><span class="pyc-tarjeta__txt"><b>${titulo}</b><small>${sub}</small></span><span class="pyc-tarjeta__ir">${I.flecha}</span></button>`;
  return `<section class="pyc-grupo"><h2>${I.vivo} Show en vivo · martes 24/11 · ${SHOW.hora}</h2><div class="pyc-grid">
    ${t('data-sh="duelo"', "1A", "¿Esto o aquello? · Aplausómetro", "Dos bandos aplauden y el micrófono de la laptop mide cuál suena más")}
    ${t('data-sh="ruleta"', "1B", "Ruleta de delegaciones", "Elige una delegación al azar y le da un reto")}
    ${t('data-sh="casos"', "2", "Comentamos los casos", "PDF de Amateur I, II e IATHON con el puntero")}
    ${t('data-sh="trans"', "3", "Transmisión en vivo", "El live del voluntario en la pantalla")}
    ${t('data-sh="sorteo"', "4", "Sorteo de becas", "Ruleta de códigos, ganador y logo del sponsor")}
  </div></section>`;
}
export function enlazarShowProyeccion(raiz, codigo, delegaciones) {
  $$("[data-sh]", raiz).forEach((b) => (b.onclick = async () => {
    try {
      const k = b.dataset.sh;
      if (k === "duelo") return abrirDuelo(leerDuelos());
      if (k === "sorteo") return abrirSorteo(codigo);
      const S = await api.showDatos(codigo);
      if (k === "ruleta") return abrirRuleta(delegaciones, S.config?.retos);
      if (k === "casos") return proyectarCasos(codigo, S.archivos);
      if (k === "trans") return abrirTransmision(S.config);
    } catch (e) { aviso(e.message, "error"); }
  }));
}

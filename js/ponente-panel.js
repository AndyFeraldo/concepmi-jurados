// =========================================================
// Panel del PONENTE (puerta «Ponente» de la portada), decorado como el del jurado:
//   · Cabecera con su foto, saludo y anillo de lo que ya tiene listo (título, PDF, PPT).
//   · Su charla (día, hora, minutos) y cuánto falta.
//   · «Ensaya tu presentación»: abre la misma pantalla del auditorio (portada + su PDF + cronómetro)
//     para que vea exactamente cómo se verá. Vista previa de sus diapositivas (PDF.js).
//   · «Prueba tu clicker»: al pulsar el puntero o las flechas se ilumina la tecla detectada.
//   · Título, LinkedIn y archivos (PDF que se proyecta, PPT de respaldo, video opcional).
//   · A la derecha, sus colegas: los otros ponentes, jurados y talleristas con LinkedIn.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611121132";
import { CHARLAS } from "./charlas.js?v=202611121132";
import { $, $$, esc, I, IMG, aviso, avatar, fondoAnimado } from "./ui.js?v=202611121132";
import { htmlArchivos, conectarArchivos, abrirPonencia } from "./ponente.js?v=202611121132";
import { abrirSalaProyectos, cargarPdfjs } from "./sala-proyectos.js?v=202611121132";
import { pintarColegas } from "./colegas.js?v=202611121132";

const charlaDe = (id) => CHARLAS.find((c) => c.id === id);
const MAX_MINI = 12;
// Fecha de cada charla (para «faltan N días»); los días del evento son 24 y 26 de noviembre de 2026
const FECHA = { 24: "2026-11-24T09:00:00-05:00", 26: "2026-11-26T09:00:00-05:00" };
const faltan = (c) => { const dia = Number(String(c.dia).match(/\b(24|26)\b/)?.[1]); const f = FECHA[dia]; if (!f) return "";
  const d = Math.ceil((Date.parse(f) - Date.now()) / 86400000); return d > 1 ? `Faltan ${d} días` : d === 1 ? "¡Es mañana!" : d === 0 ? "¡Es hoy!" : ""; };

// Teclas del puntero (clicker): la mayoría envía PageDown / PageUp; también las flechas
const TECLAS = [
  { id: "sig", ico: "▶", t: "Siguiente diapositiva", k: ["→", "PageDown", "Espacio"], codes: ["ArrowRight", "PageDown", " ", "ArrowDown", "Enter"] },
  { id: "ant", ico: "◀", t: "Diapositiva anterior", k: ["←", "PageUp"], codes: ["ArrowLeft", "PageUp", "ArrowUp", "Backspace"] },
  { id: "negro", ico: "■", t: "Pantalla negra", k: ["B", "."], codes: ["b", "B", "."] },
  { id: "tiempo", ico: "⏱", t: "Iniciar / pausar el tiempo", k: ["T"], codes: ["t", "T"] },
];

export async function vistaPonente(app, codigo, salir) {
  let o = null, guardarT = null, alTeclado = null;
  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo tu ponencia…</div>`;
  const cargar = async () => { o = (await api.ponenteDatos(codigo)).ponente; };
  try { await cargar(); } catch (e) { aviso(e.message, "error"); return salir(); }
  const quitarTeclado = () => { if (alTeclado) document.removeEventListener("keydown", alTeclado); alTeclado = null; };

  // La misma pantalla del auditorio, solo con su(s) charla(s)
  function ensayar() {
    const cs = o.charlas.map(charlaDe).filter(Boolean);
    const items = cs.map((c) => ({ charla: c, equipo_id: o.id, delegacion: { siglas: o.nombre, nombre: `Charla magistral ${c.num} · ${c.nombre}` }, proyecto: o.titulo || "", foto: o.foto || "",
      pres: { pdf: o.pdf, ppt: o.ppt, video: o.video }, videoDespues: o.video_despues || "", minutos: { exp: c.minPonencia || 45, preg: c.minPreguntas || 10 } }));
    quitarTeclado();
    abrirSalaProyectos({ equipos: items, concurso: "Ensayo · Charla magistral", inicial: 0, clase: "sala--ponencias",
      url: (id, tipo) => api.ponenciaUrl(codigo, id, tipo), abrir: (id, tipo) => abrirPonencia(codigo, id, tipo),
      alCerrar: () => pintar(),
      textos: { orden: "Ensayo de tu ponencia", exp: "Ponencia", preg: "Preguntas del público", btnExp: "Ponencia", btnPreg: "Preguntas",
        corto: (k) => `Charla ${items[k].charla.num}`, num: (k) => items[k].charla.num, detalle: (k) => `${items[k].charla.dia} · ${items[k].charla.hora}`,
        portada: (k) => `Charla magistral <b>${items[k].charla.num}</b> · ${esc(items[k].charla.hora)}`, cab: (k) => `Charla ${items[k].charla.num} · ${items[k].charla.nombre}` } });
  }

  // Miniaturas de las diapositivas
  async function miniaturas(caja) {
    if (!o.pdf) return;
    try {
      const lib = await cargarPdfjs();
      const u = await api.ponenciaUrl(codigo, o.id, "pdf");
      const pdf = await lib.getDocument({ data: await (await fetch(u)).arrayBuffer() }).promise;
      if (!document.body.contains(caja)) return;
      const n = pdf.numPages, ver = Math.min(n, MAX_MINI);
      $("[data-paginas]", app).textContent = `${n} diapositiva${n === 1 ? "" : "s"}`;
      const p1 = await pdf.getPage(1), v1 = p1.getViewport({ scale: 1 }), formato = v1.width / v1.height;
      const aviso169 = Math.abs(formato - 16 / 9) > 0.08;
      caja.innerHTML = `${aviso169 ? `<p class="pp-aviso">${I.info} Tu PDF no está en formato 16:9 (pantalla ancha): en el auditorio se verá con franjas a los lados. Si puedes, cámbialo en PowerPoint → Diseño → Tamaño de diapositiva → Panorámica (16:9).</p>` : `<p class="pp-ok">${I.check} Formato 16:9: ocupará toda la pantalla del auditorio.</p>`}
        <div class="pp-minis">${Array.from({ length: ver }, (_, k) => `<figure class="pp-mini" style="--i:${k}"><canvas data-mini="${k + 1}"></canvas><figcaption>${k + 1}${o.video_despues && Number(o.video_despues) === k + 1 ? " · luego tu video ▶" : ""}</figcaption></figure>`).join("")}
        ${n > ver ? `<figure class="pp-mini pp-mini--mas"><b>+${n - ver}</b><small>diapositivas más</small></figure>` : ""}</div>`;
      for (let k = 1; k <= ver; k++) {
        const cv = $(`[data-mini="${k}"]`, caja); if (!cv) return;
        const pg = k === 1 ? p1 : await pdf.getPage(k), vp = pg.getViewport({ scale: 260 / pg.getViewport({ scale: 1 }).width });
        cv.width = vp.width; cv.height = vp.height;
        await pg.render({ canvasContext: cv.getContext("2d"), viewport: vp }).promise;
      }
    } catch (e) { if (document.body.contains(caja)) caja.innerHTML = `<p class="pp-aviso">${I.info} No se pudo mostrar la vista previa (${esc(e.message)}). Igual puedes tocar «Ensayar» para verla en pantalla completa.</p>`; }
  }

  function pintar() {
    clearTimeout(guardarT); quitarTeclado();
    const cs = o.charlas.map(charlaDe).filter(Boolean);
    const pasos = [!!o.titulo?.trim(), !!o.pdf, !!o.ppt], hechos = pasos.filter(Boolean).length, pct = Math.round((hechos / pasos.length) * 100);
    const h = new Date().getHours(), saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
    app.innerHTML = `${fondoAnimado(16)}
      <header class="barra"><img class="logo" src="${IMG.logo}" alt="CONCEPMI"><span class="sep"></span>
        <div><div class="barra__titulo">Panel de Ponentes</div><div class="barra__sub">Charlas magistrales · VI CONCEPMI 2026</div></div>
        <div class="der">${avatar(o.nombre, o.foto)}<button class="btn btn--mini" data-salir>${I.salir}<span>Salir</span></button></div></header>
      <main class="contenedor jur-entra">
        <section class="tarjeta bienvenida jur-hero">
          <span class="jur-hero__aura" aria-hidden="true"></span>
          <div class="jur-hero__foto">${avatar(o.nombre, o.foto)}</div>
          <div class="jur-hero__txt"><span class="jur-hero__sobre">Ponente oficial · VI CONCEPMI 2026</span>
            <h1>${saludo}, ${esc(o.nombre.replace(/^(ing|dr|dra|mg|lic|mba|pmp)\.?\s+/i, "").split(" ")[0])}</h1>
            <p>${o.descripcion ? esc(o.descripcion) : "Gracias por compartir tu experiencia en las charlas magistrales del VI CONCEPMI."}</p>
            <div class="jur-hero__chips">${cs.map((c) => `<span class="chip chip--celeste">Charla ${c.num} · ${esc(c.dia)} · ${esc(c.hora)}</span>`).join("")}<span class="chip">UNMSM</span></div></div>
          <div class="jur-anillo" style="--p:${pct}" title="Lo que ya tienes listo"><b>${pct}<small>%</small></b><span>${hechos} de ${pasos.length}<br>pasos listos</span></div>
        </section>
        <div class="jur-layout lado-colegas"><div class="lado-colegas__main">
          <h2 class="seccion-titulo">Tu charla</h2>
          <div class="pon-charlas">${cs.map((c, k) => `<article class="concurso concurso--vivo pon-charla c-${c.color}" style="--i:${k}">
            <span class="concurso__brillo" aria-hidden="true"></span>
            <span class="concurso__tipo">Charla magistral ${c.num}</span>${faltan(c) ? `<span class="concurso__estado es-abierto">${faltan(c)}</span>` : ""}
            <h3>${esc(c.nombre)}</h3>
            <p class="concurso__apodo">${o.titulo ? `«${esc(o.titulo)}»` : "Aún sin título de ponencia"}</p>
            <p class="concurso__apodo">${I.reloj.replace("<svg", '<svg style="width:1em;height:1em;vertical-align:-2px"')} ${esc(c.dia)} · ${esc(c.hora)} · Auditorio UNMSM</p>
            <div class="pp-linea">${[["Ponencia", c.minPonencia || 45, "pp-linea--pon"], ["Preguntas", c.minPreguntas || 10, "pp-linea--preg"], ["Trivia del público", 10, "pp-linea--triv"]].map(([t, m, cl]) => `<span class="${cl}" style="flex:${m}"><b>${m} min</b><small>${t}</small></span>`).join("")}</div>
          </article>`).join("")}</div>

          <section class="tarjeta tal-proyectar ${o.pdf ? "tal-proyectar--listo" : ""}">
            <div class="tal-proyectar__ico">${I.pizarra}</div>
            <div><h2>${o.pdf ? "Ensaya tu presentación tal como se verá en el auditorio" : "Sube tu PDF para ensayar tu presentación"}</h2>
              <p>${o.pdf ? "Se abre la misma pantalla que verá el público: portada con tu foto y tu título, luego tu PDF a pantalla completa con el logo del evento y un cronómetro discreto. Pruébalo con tu clicker o las flechas. Es solo un ensayo: no se proyecta a nadie." : "Cuando subas tu presentación en PDF aquí abajo, se activa este botón para que la veas en pantalla completa, igual que el día del evento."}</p></div>
            <button class="btn btn--naranja tal-proyectar__btn" data-ensayar ${o.pdf ? "" : "disabled"}>${I.vivo}Ensayar mi presentación</button>
          </section>

          ${o.pdf ? `<section class="tarjeta pp-previa"><div class="pp-previa__cab"><h2>${I.pizarra} Así se ven tus diapositivas</h2><span class="chip chip--verde" data-paginas>Cargando…</span></div>
            <div data-minis><div class="cargando" style="min-height:120px"><div class="giro"></div>Preparando la vista previa…</div></div></section>` : ""}

          <section class="tarjeta pp-clicker">
            <div class="pp-clicker__cab"><h2>🎯 Prueba tu clicker</h2><p>El día del evento te daremos un <b>puntero (clicker)</b>. Conéctalo a esta computadora o usa el teclado y pulsa sus botones: se iluminará lo que detectamos.</p></div>
            <div class="pp-teclas">${TECLAS.map((t) => `<div class="pp-tecla" data-tecla="${t.id}"><span class="pp-tecla__ico">${t.ico}</span><b>${t.t}</b><small>${t.k.map((x) => `<kbd>${x}</kbd>`).join(" ")}</small></div>`).join("")}</div>
            <p class="pp-clicker__estado" data-tecla-estado aria-live="polite">Esperando que pulses un botón…</p>
          </section>

          <section class="tarjeta eq-cab pp-datos">
            <label class="campo"><span>Título de tu ponencia (sale en la portada de la pantalla)</span><input data-titulo maxlength="160" value="${esc(o.titulo || "")}" placeholder="Ej. El PMBOK 8 en la práctica"></label>
            <label class="campo"><span>Tu LinkedIn (opcional · lo ven tus colegas ponentes, jurados y talleristas)</span><input data-linkedin maxlength="300" value="${esc(o.linkedin || "")}" placeholder="linkedin.com/in/tu-perfil"></label>
            <p class="ayuda" data-guardado style="margin:0"></p>
          </section>
          ${htmlArchivos(o)}
          <details class="eq-guia"><summary>${I.info} Para que todo salga perfecto en el auditorio</summary>
            <ul class="pres-tips">
              <li><b>Lo que se proyecta es tu PDF</b>, a pantalla completa, con el logo del evento y un cronómetro discreto. Usa formato <b>16:9</b>.</li>
              <li>Pasas las diapositivas con el <b>puntero</b> (→ siguiente, ← anterior). Tecla B: pantalla negra.</li>
              <li>Si tienes un <b>video</b>, súbelo aparte e indica después de qué diapositiva va: se reproduce solo al llegar ahí.</li>
              <li>Al final de tu charla viene una <b>trivia</b> para el público: si nos compartes tus ideas clave, armamos las preguntas con tu contenido.</li>
            </ul></details>
        </div>
        <aside class="cob-panel colegas-lado" data-colegas aria-label="Tus colegas"></aside></div>
      </main>
      ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $("[data-salir]", app).onclick = () => { clearTimeout(guardarT); quitarTeclado(); salir(); };
    pintarColegas($("[data-colegas]", app), codigo, { rol: "ponente", charlas: o.charlas }, { lado: true });
    $("[data-ensayar]", app).onclick = ensayar;
    if (o.pdf) miniaturas($("[data-minis]", app));

    // Guardado automático del título, el video y el LinkedIn
    const estado = (t) => { const g = $("[data-guardado]", app); if (g) g.textContent = t; };
    const guardar = () => { clearTimeout(guardarT); estado("Guardando…");
      guardarT = setTimeout(async () => { try { await api.ponenteGuardar(codigo, o.titulo, o.video_despues); estado("✓ Guardado"); } catch (e) { estado(e.message); } }, 800); };
    $("[data-titulo]", app).oninput = (e) => { o.titulo = e.target.value; guardar(); };
    $("[data-linkedin]", app).onchange = async (e) => { estado("Guardando…");
      try { const r = await api.ponenteLinkedin(codigo, e.target.value); o.linkedin = r.linkedin; e.target.value = r.linkedin; estado("✓ LinkedIn guardado"); pintarColegas($("[data-colegas]", app), codigo, { rol: "ponente", charlas: o.charlas }, { lado: true }); }
      catch (ex) { estado(ex.message); } };
    const vd = $("[data-video-despues]", app); if (vd) vd.oninput = () => { vd.value = vd.value.replace(/\D/g, ""); o.video_despues = vd.value; guardar(); };
    conectarArchivos(app, { subir: (tipo, f, p) => api.ponenciaSubir(codigo, tipo, f, p), ver: (tipo) => abrirPonencia(codigo, o.id, tipo), listo: async () => { await cargar(); pintar(); } });

    // Prueba del clicker
    let apagar = null;
    alTeclado = (e) => {
      if (e.target.closest?.("input, textarea, select")) return;
      const t = TECLAS.find((x) => x.codes.includes(e.key)); if (!t) return;
      e.preventDefault();
      $$("[data-tecla]", app).forEach((x) => x.classList.toggle("pp-tecla--on", x.dataset.tecla === t.id));
      const est = $("[data-tecla-estado]", app); if (est) { est.innerHTML = `✓ ¡Funciona! Detectamos: <b>${t.t}</b> (tecla ${esc(e.key === " " ? "Espacio" : e.key)})`; est.classList.add("pp-clicker__estado--ok"); }
      clearTimeout(apagar); apagar = setTimeout(() => $$("[data-tecla]", app).forEach((x) => x.classList.remove("pp-tecla--on")), 700);
    };
    document.addEventListener("keydown", alTeclado);
  }
  pintar();
}

// =========================================================
// Vista del TALLERISTA (puerta Tallerista de la portada). Por cada taller tiene dos partes:
//   1 · Presentación y proyección: sube su PDF (el que se proyecta), PPT de respaldo y video opcional,
//       y lo proyecta desde aquí (misma pantalla que las charlas, js/talleres-pres.js).
//   2 · Ganadores: registra al equipo ganador (nombre, apellido y delegación) → +40 pts por delegación.
// A la derecha, sus colegas (jurados y talleristas) con LinkedIn. Decoración igual que el panel del jurado.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611131348";
import { TALLERES, tallerPorId, PUNTOS_TALLER, HORA_TALLERES, delegacionesGanadoras } from "./talleres.js?v=202611131348";
import { $, $$, esc, avatar, I, IMG, aviso, fondoAnimado } from "./ui.js?v=202611131348";
import { salir } from "./app.js?v=202611131348";
import { pintarColegas } from "./colegas.js?v=202611131348";
import { htmlArchivos, conectarArchivos } from "./ponente.js?v=202611131348";
import { ganadoresTaller } from "./taller-ganadores.js?v=202611131348";
import { INFO_TALLER, MIN_TALLER, proyectarTalleres, abrirTallerArchivo } from "./talleres-pres.js?v=202611131348";



export async function vistaTallerista(app, codigo) {
  let data = null, pres = [], presError = "", guardarT = null;

  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Cargando tus talleres…</div>`;
  const cargarPres = async () => { try { pres = await api.talleresPres(codigo); presError = ""; } catch (e) { pres = []; presError = e.message; } };
  try { [data] = await Promise.all([api.datosTallerista(codigo), cargarPres()]); }
  catch (e) { aviso(e.message, "error"); return salir(); }

  const ganador = (tid) => data.ganadores.find((g) => g.taller_id === tid);
  const abierto = (tid) => data.abiertos?.[tid] !== false;
  const del = (id) => data.delegaciones.find((d) => d.id === id);
  const presDe = (tid) => pres.find((p) => p.id === tid) || { id: tid, titulo: "", video_despues: "", pdf: null, ppt: null, video: null, talleristas: [] };
  const mios = () => TALLERES.filter((x) => data.tallerista.talleres.includes(x.id));
  const hayGan = (tid) => !!ganador(tid)?.integrantes.length;

  function shell(contenido, { animado = false } = {}) {
    const t = data.tallerista;
    clearTimeout(guardarT);
    app.innerHTML = `${animado ? fondoAnimado(16) : `<div class="fondo fondo--sobrio"></div>`}
    <header class="barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">Panel de Talleristas</div><div class="barra__sub">Talleres · VI CONCEPMI 2026</div></div>
      <div class="der">
        ${avatar(t.nombre, t.foto)}
        <button class="btn btn--mini" data-salir>${I.salir}<span>Salir</span></button>
      </div>
    </header>
    <main class="contenedor jur-entra">${contenido}</main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $("[data-salir]", app).onclick = salir;
  }

  // ---------------- Inicio ----------------
  function inicio() {
    const t = data.tallerista, ts = mios();
    const hechos = ts.reduce((s, x) => s + (presDe(x.id).pdf ? 1 : 0) + (hayGan(x.id) ? 1 : 0), 0), meta = ts.length * 2;
    const pct = meta ? Math.round((hechos / meta) * 100) : 0;
    const h = new Date().getHours(), saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
    const paso = (ok, n, txt, sub) => `<div class="tal-paso ${ok ? "tal-paso--ok" : ""}"><span class="tal-paso__n">${ok ? "✓" : n}</span><span><b>${txt}</b><small>${sub}</small></span></div>`;
    const tarjetas = ts.map((x, k) => { const p = presDe(x.id), g = ganador(x.id), listo = !!p.pdf && hayGan(x.id);
      return `<article class="concurso concurso--vivo tal-card c-${x.color} ${listo ? "concurso--listo" : ""}" style="--i:${k}">
        <span class="concurso__brillo" aria-hidden="true"></span>
        <span class="concurso__tipo">Taller ${x.num} · ${esc(x.lugar)}</span>
        <span class="concurso__estado ${listo ? "es-listo" : abierto(x.id) ? "es-abierto" : "es-cerrado"}">${listo ? "✓ Todo listo" : abierto(x.id) ? "Abierto" : "Registro cerrado"}</span>
        <h3>${esc(x.nombre)}</h3>
        <p class="concurso__apodo">${esc(p.titulo || x.sub)}</p>
        <p class="concurso__apodo tal-hora">${I.reloj} ${HORA_TALLERES}</p>
        <div class="tal-pasos">
          ${paso(!!p.pdf, 1, "Tu presentación", p.pdf ? `PDF listo${p.ppt ? " · PPT de respaldo" : ""}${p.video ? " · video" : ""}` : "Sube tu PDF para proyectarlo")}
          ${paso(hayGan(x.id), 2, "Equipo ganador", hayGan(x.id) ? `${g.integrantes.length} integrantes · +${delegacionesGanadoras(g).length * PUNTOS_TALLER} pts` : "Regístralo al terminar el taller")}
        </div>
        <div class="tal-acc">
          <button class="btn btn--naranja" data-ir="pres:${x.id}">${I.pizarra}Presentación y proyección</button>
          <button class="btn" data-ir="gan:${x.id}">${I.copa}${hayGan(x.id) ? "Ver ganadores" : "Registrar ganadores"}</button>
          ${p.pdf ? `<button class="btn btn--mini tal-proy" data-proy="${x.id}" title="Abrir la pantalla de proyección">${I.vivo}Proyectar ahora</button>` : ""}
        </div>
      </article>`; }).join("");
    shell(`
      <section class="tarjeta bienvenida jur-hero">
        <span class="jur-hero__aura" aria-hidden="true"></span>
        <div class="jur-hero__foto">${avatar(t.nombre, t.foto)}</div>
        <div class="jur-hero__txt"><span class="jur-hero__sobre">Tallerista oficial · VI CONCEPMI 2026</span>
          <h1>${saludo}, ${esc(t.nombre.split(" ")[0])}</h1>
          <p>${t.descripcion ? esc(t.descripcion) : "Gracias por compartir tu experiencia en los talleres del VI CONCEPMI."}</p>
          <div class="jur-hero__chips"><span class="chip chip--celeste">${ts.length} ${ts.length === 1 ? "taller" : "talleres"}</span><span class="chip">${HORA_TALLERES}</span><span class="chip">+${PUNTOS_TALLER} pts a la delegación ganadora</span></div></div>
        <div class="jur-anillo" style="--p:${pct}" title="Lo que ya tienes listo"><b>${pct}<small>%</small></b><span>${hechos} de ${meta}<br>pasos listos</span></div>
      </section>
      <div class="jur-layout lado-colegas"><div class="lado-colegas__main">
      <h2 class="seccion-titulo">Tus talleres</h2>
      ${ts.length ? `<div class="rejilla">${tarjetas}</div>` : `<div class="vacio"><b>Aún no tienes talleres asignados</b>Pide al organizador que te asigne uno.</div>`}
      <h2 class="seccion-titulo">Cómo funciona</h2>
      <div class="tal-guia">
        <div style="--i:0"><span>1</span><b>Antes del taller</b><small>Sube tu presentación en <b>PDF</b> (y el PPT de respaldo). Si quieres mostrar un video, súbelo aparte.</small></div>
        <div style="--i:1"><span>2</span><b>En el aula</b><small>Toca <b>Proyectar</b>: sale tu PDF a pantalla completa con el logo y un cronómetro de ${MIN_TALLER.exp} + ${MIN_TALLER.preg} min. Avanzas con el puntero o las flechas.</small></div>
        <div style="--i:2"><span>3</span><b>Al terminar</b><small>Registra al <b>equipo ganador</b> con el <b>DNI</b> de cada uno (código CVI): sale su nombre y delegación para confirmar. Cada delegación de sus integrantes suma <b>${PUNTOS_TALLER} pts</b> a la Copa (una vez por delegación).</small></div>
      </div></div>
      <aside class="cob-panel colegas-lado" data-colegas aria-label="Tus colegas"></aside></div>`, { animado: true });
    pintarColegas($("[data-colegas]", app), codigo, { rol: "tallerista", talleres: t.talleres }, { lado: true });
    $$("[data-ir]", app).forEach((b) => (b.onclick = () => { const [parte, tid] = b.dataset.ir.split(":"); abrirTaller(tid, parte); window.scrollTo(0, 0); }));
    $$("[data-proy]", app).forEach((b) => (b.onclick = () => proyectarTalleres(codigo, pres.filter((p) => data.tallerista.talleres.includes(p.id)), b.dataset.proy)));
  }

  // ---------------- Un taller: pestañas Presentación / Ganadores ----------------
  function abrirTaller(tid, parte = "pres") {
    const x = tallerPorId(tid), p = presDe(tid);
    shell(`
      <button class="volver" data-volver>${I.atras} Mis talleres</button>
      <div class="cabeza c-${x.color}">
        <div><h1>Taller ${x.num} · ${esc(x.nombre)}</h1><p>${esc(x.sub)} · ${HORA_TALLERES} · ${esc(x.lugar)}</p></div>
      </div>
      <div class="tal-tabs" role="tablist">
        <button role="tab" class="tal-tab" data-tab="pres" aria-selected="${parte === "pres"}"><span class="tal-tab__n">${p.pdf ? "✓" : "1"}</span><span><b>Presentación y proyección</b><small>${p.pdf ? "PDF listo para proyectar" : "Sube tu PDF"}</small></span></button>
        <button role="tab" class="tal-tab" data-tab="gan" aria-selected="${parte === "gan"}"><span class="tal-tab__n">${hayGan(tid) ? "✓" : "2"}</span><span><b>Equipo ganador</b><small>${hayGan(tid) ? "Ganadores registrados" : "Solo con el DNI de cada integrante"}</small></span></button>
      </div>
      <div data-parte></div>`);
    $("[data-volver]", app).onclick = () => { inicio(); window.scrollTo(0, 0); };
    $$("[data-tab]", app).forEach((b) => (b.onclick = () => abrirTaller(tid, b.dataset.tab)));
    const caja = $("[data-parte]", app);
    if (parte === "gan") ganadoresTaller({ caja, codigo, tid, editable: abierto(tid), previo: ganador(tid), delegaciones: data.delegaciones,
      guardado: async () => { data = await api.datosTallerista(codigo); abrirTaller(tid, "gan"); } });
    else presentacion(tid, caja);
  }

  // ---------------- 1 · Presentación y proyección ----------------
  function presentacion(tid, caja) {
    const p = presDe(tid);
    if (presError) { caja.innerHTML = `<div class="vacio"><b>No se pudo abrir tu presentación</b>${esc(presError)}</div>`; return; }
    caja.innerHTML = `
      <section class="tarjeta tal-proyectar ${p.pdf ? "tal-proyectar--listo" : ""}">
        <div class="tal-proyectar__ico">${I.pizarra}</div>
        <div><h2>${p.pdf ? "Tu presentación está lista para proyectar" : "Primero sube tu presentación en PDF"}</h2>
          <p>${p.pdf ? `Abre la pantalla del aula: portada del taller con tu foto, tu PDF a pantalla completa y un cronómetro de <b>${MIN_TALLER.exp} min</b> de taller + <b>${MIN_TALLER.preg} min</b> de cierre. Avanza con el puntero (→ / ←), B = pantalla negra, T = iniciar el tiempo.` : "Cuando subas el PDF, aquí se activa el botón para proyectarlo desde la laptop del aula. El organizador y el coordinador de talleres también pueden proyectarlo."}</p></div>
        <button class="btn btn--naranja tal-proyectar__btn" data-proyectar ${p.pdf ? "" : "disabled"}>${I.vivo}Proyectar mi taller</button>
      </section>
      <section class="tarjeta eq-cab"><label class="campo"><span>Título de tu taller o presentación (sale en la portada de la pantalla)</span><input data-titulo maxlength="160" value="${esc(p.titulo || "")}" placeholder="${esc(tallerPorId(tid).sub)}"></label><p class="ayuda" data-guardado style="margin:6px 0 0"></p></section>
      ${htmlArchivos(p, { info: INFO_TALLER })}
      <details class="eq-guia"><summary>${I.info} Consejos para que todo salga perfecto</summary>
        <ul class="pres-tips">
          <li><b>Lo que se proyecta es tu PDF</b>: usa formato <b>16:9</b>. El PowerPoint queda solo de respaldo.</li>
          <li>Si usas un <b>video</b>, súbelo en .mp4 e indica después de qué diapositiva va: se reproduce solo al llegar ahí.</li>
          <li>Puedes <b>reemplazar</b> tus archivos cuantas veces quieras antes del taller.</li>
        </ul></details>`;
    const guardar = () => { clearTimeout(guardarT); const g = $("[data-guardado]", caja); g.textContent = "Guardando…";
      guardarT = setTimeout(async () => { try { await api.tallerGuardar(codigo, tid, p.titulo, p.video_despues); g.textContent = "✓ Guardado"; } catch (e) { g.textContent = e.message; } }, 800); };
    $("[data-titulo]", caja).oninput = (e) => { p.titulo = e.target.value; guardar(); };
    const vd = $("[data-video-despues]", caja); if (vd) vd.oninput = () => { vd.value = vd.value.replace(/\D/g, ""); p.video_despues = vd.value; guardar(); };
    $("[data-proyectar]", caja).onclick = () => proyectarTalleres(codigo, pres.filter((q) => data.tallerista.talleres.includes(q.id)), tid);
    conectarArchivos(caja, { subir: (tipo, f, pr) => api.tallerSubir(codigo, tid, tipo, f, pr), ver: (tipo) => abrirTallerArchivo(codigo, tid, tipo),
      listo: async () => { await cargarPres(); abrirTaller(tid, "pres"); } });
  }

  inicio();
}

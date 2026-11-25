// =========================================================
// PANEL DE PROYECCIÓN · laptop del auditorio (acceso limitado con permisos.proyeccion).
// Es un CRONOGRAMA en orden (Día 1 y Día 2): cada momento del auditorio tiene su botón «▶ Proyectar».
// Dentro de cada pantalla, al mover el mouse aparece arriba la barra «◀ Anterior · Siguiente ▶» que
// cierra la pantalla actual y abre el siguiente momento, sin volver al menú (el público no la ve:
// se esconde sola). La inauguración se puede editar desde aquí («✏ Editar programa»).
// La base de datos limita lo que puede hacer: proyectar, manejar la trivia (iniciar, detener,
// confirmar podio), el tiempo de los concursos, el show (sortear, abrir el muro) y el programa
// de la inauguración.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611252102";
import { CHARLAS } from "./charlas.js?v=202611252102";
import { ENTREGABLES } from "./entregables.js?v=202611252102";
import { porId } from "./concursos.js?v=202611252102";
import { copaGeneral } from "./calculo.js?v=202611252102";
import { crearCharlas } from "./admin-charlas.js?v=202611252102";
import { proyectarCharlas } from "./admin-ponentes.js?v=202611252102";
import { TALLERES } from "./talleres.js?v=202611252102";
import { proyectarTalleres } from "./talleres-pres.js?v=202611252102";
import { abrirRuleta, proyectarCasos, abrirTransmision, abrirSorteo, pantalla } from "./show.js?v=202611252102";
import { abrirDuelo, leerDuelos } from "./show-duelo.js?v=202611252102";
import { abrirGanadoresProyectos, abrirGanadores, abrirCierreDia1 } from "./cierre-dia1.js?v=202611252102";
import { abrirConcursoBarras } from "./barras.js?v=202611252102";
import { abrirCeremonia, cargarPrograma, crearInauguracion, leerPrograma } from "./inauguracion.js?v=202611252102";
import { abrirEscenario } from "./escenario.js?v=202611252102";
import { abrirSalaProyectos } from "./sala-proyectos.js?v=202611252102";
import { ordenarPorSorteo, abrirArchivo } from "./presentacion.js?v=202611252102";
import { $, $$, esc, I, IMG, aviso, modal, fondoAnimado, pantallaActiva } from "./ui.js?v=202611252102";
import { salir } from "./app.js?v=202611252102";

const URL_CONOCIMIENTOS = "https://andyferaldo.github.io/concepmi-vi/concurso-conocimientos/";
const DIAS = { d1: { corto: "Día 1", largo: "Martes 24 de noviembre", fecha: "2026-11-24" }, d2: { corto: "Día 2", largo: "Jueves 26 de noviembre", fecha: "2026-11-26" } };
// «3:00» → minutos del día (de 1 a 7 es de la tarde)
const aMin = (h) => { const [a, b] = String(h).split(":").map(Number); return ((a >= 1 && a <= 7 ? a + 12 : a) * 60) + (b || 0); };
const ampm = (h) => { const m = aMin(h), hh = Math.floor(m / 60); return `${((hh + 11) % 12) + 1}:${String(m % 60).padStart(2, "0")} ${hh < 12 ? "a. m." : "p. m."}`; };

export async function vistaProyeccion(app, codigo, acceso, { volver = null } = {}) {
  let data = null, pausado = false, actual = -1, diaSel = null;
  const recargar = async () => { if (pausado) return; try { data = await api.adminDatos(codigo); } catch { /* usa lo cargado */ } };
  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo el panel de proyección…</div>`;
  try { data = await api.adminDatos(codigo); } catch (e) { aviso(e.message, "error"); return salir(); }
  const charlasUI = crearCharlas({ codigo: () => codigo, data: () => data, recargar, pausar: (p) => { pausado = p; } });
  const del = (id) => data.delegaciones.find((d) => d.id === id);
  const nomDel = (id) => del(id)?.siglas || del(id)?.nombre || "—";
  const ponentes = () => api.adminPonentes(codigo);
  const show = () => api.showDatos(codigo);
  const ch = (k) => CHARLAS[k];

  // ---------------- Qué abre cada momento ----------------
  const abrirInauguracion = async () => { const P = await cargarPrograma(codigo); abrirCeremonia(P, { abrirCharla: () => irPaso(pasoId("c1")) }); };
  const ponencia = async (k) => proyectarCharlas(codigo, await ponentes(), k);
  const trivia = async (id) => { await recargar(); charlasUI.proyector(id); };
  const premiacion = async () => { await recargar(); const { abrirPremiacion } = await import("./premiacion.js?v=202611252102"); abrirPremiacion(copaGeneral(data)); };
  const ganadoresProyectos = async () => { await recargar(); let nombres = {};
    try { const E = await api.adminEntregas(codigo, "proyectos"); E.equipos.forEach((x) => { if (x.entrega.datos?.proyecto) nombres[x.entrega.delegacion_id] = x.entrega.datos.proyecto; }); } catch { /* sin nombres de proyecto */ }
    abrirGanadoresProyectos(data, nombres); };
  async function abrirConcurso(concurso) {
    const def = ENTREGABLES[concurso], c = porId(concurso);
    if (def.tipo === "presentacion") {
      const [E, P] = await Promise.all([api.adminEntregas(codigo, concurso), api.adminPresentaciones(codigo, concurso)]);
      const presDe = (eid) => P.equipos.find((x) => x.id === eid)?.pres || null;
      const eqs = ordenarPorSorteo(E.equipos, P.config.orden, (x) => x.entrega.delegacion_id);
      if (!eqs.length) return aviso("Este concurso aún no tiene equipos", "error");
      return abrirSalaProyectos({ concurso: c?.nombre || "Concurso Nacional de Proyectos", minutos: def.cortos,
        equipos: eqs.map((x) => ({ equipo_id: x.id, delegacion: del(x.entrega.delegacion_id), proyecto: x.entrega.datos?.proyecto || "", lider: x.entrega.datos?.lider || "",
          videoDespues: x.entrega.datos?.videoDespues || "", pres: presDe(x.id) })),
        url: (eq, tipo) => api.presUrl(codigo, eq, tipo), abrir: (eq, tipo) => abrirArchivo(codigo, eq, tipo) });
    }
    const cargar = async () => { const r = await api.adminEntregas(codigo, concurso); return { tiempo: r.tiempo, entregas: r.equipos.map((x) => x.entrega) }; };
    await cargar();
    abrirEscenario({ concurso, cargar, nombre: (e) => nomDel(e.delegacion_id), accion: (a, min) => api.adminTiempo(codigo, concurso, a, min) });
  }

  // ---------------- El cronograma del auditorio (en orden) ----------------
  // abrir = se proyecta (es un «paso» del botón Siguiente) · nota = solo informativo · extra = botones pequeños
  const AGENDA = [
    { dia: "d1", ini: "8:30", fin: "9:30", t: "Registro y acreditación", s: "En el hall. Sin proyección: puedes dejar la portada de la inauguración como pantalla de bienvenida.", nota: true },
    { id: "inaug", dia: "d1", ini: "9:30", fin: "10:15", t: "Ceremonia de inauguración", s: "Programa con reloj. → siguiente bloque · Z: «Freeze» mientras se prepara el ponente.", abrir: abrirInauguracion, editar: true },
    { id: "c1", dia: "d1", ini: "10:15", fin: "11:30", t: `Charla magistral I · ${ch(0).ponente}`, s: "Su presentación en PDF. El ponente pasa las diapositivas con el puntero.", abrir: () => ponencia(0) },
    { id: "c1t", dia: "d1", ini: "", fin: "", t: "Trivia de la Charla I", s: "Al final de la charla: QR, el público juega y sale el podio.", abrir: () => trivia(ch(0).id), sub: true },
    { dia: "d1", ini: "11:30", fin: "1:00", t: "Talleres (en las aulas)", s: "El auditorio descansa. Cada tallerista proyecta en su aula.", nota: true,
      extra: [{ txt: "Proyectar talleres aquí", fn: async () => proyectarTalleres(codigo, await api.talleresPres(codigo)) }] },
    { id: "proy", dia: "d1", ini: "3:00", fin: "5:00", t: "Concurso Nacional de Proyectos", s: "Orden del sorteo, el PDF de cada equipo y cronómetro de 5 + 3 min.", abrir: () => abrirConcurso("proyectos") },
    { id: "s1", dia: "d1", ini: "5:00", fin: "6:30", t: "Show en vivo · 1 · ¿Esto o aquello? (aplausómetro)", s: "A / B: mide los aplausos de cada bando · Espacio: ¡ganador! y siguiente duelo.", abrir: () => abrirDuelo(leerDuelos()) },
    { id: "s2", dia: "d1", t: "Show en vivo · 1 · Ruleta de delegaciones", s: "Espacio: girar · T: cronómetro de 30 s.", abrir: async () => abrirRuleta(data.delegaciones, (await show()).config?.retos), sub: true },
    { id: "s3", dia: "d1", t: "Show en vivo · 2 · Comentamos los casos", s: "PDF de Amateur I, II e IATHON.", abrir: async () => proyectarCasos(codigo, (await show()).archivos), sub: true },
    { id: "s4", dia: "d1", t: "Show en vivo · 3 · Transmisión en vivo", s: "El live del voluntario.", abrir: async () => abrirTransmision((await show()).config), sub: true },
    { id: "s5", dia: "d1", t: "Show en vivo · 4 · Sorteo de becas", s: "Espacio: sortear · → siguiente premio.", abrir: () => abrirSorteo(codigo), sub: true },
    { dia: "d1", ini: "5:00", fin: "6:30", t: "Amateur I, Amateur II e IATHON (en sus salones)", s: "Los coordinadores de sala los proyectan en su salón. Si te lo piden:", nota: true,
      extra: ["amateur-1", "amateur-2", "iathon"].map((id) => ({ txt: porId(id)?.nombre.replace("Concurso Nacional de ", "") || id, fn: () => abrirConcurso(id) })) },
    { id: "ganproy", dia: "d1", ini: "7:15", fin: "7:30", t: "Cierre del Día 1 · Ganadores del Concurso de Proyectos", s: "Espacio: 3.º → 2.º → 1.º con redoble y confeti, y el podio. Entrega de placas y certificados.", abrir: ganadoresProyectos },
    { id: "ganam1", dia: "d1", t: "Cierre del Día 1 · Ganadores de Amateur I", s: "Ya deliberaron los jurados. Espacio: 3.º → 2.º → 1.º y el podio.", abrir: async () => { await recargar(); abrirGanadores(data, "amateur-1"); }, sub: true },
    { id: "ganam2", dia: "d1", t: "Cierre del Día 1 · Ganadores de Amateur II", s: "Espacio: 3.º → 2.º → 1.º y el podio.", abrir: async () => { await recargar(); abrirGanadores(data, "amateur-2"); }, sub: true },
    { id: "ganiat", dia: "d1", t: "Cierre del Día 1 · Ganadores de IATHON", s: "Espacio: 3.º → 2.º → 1.º y el podio.", abrir: async () => { await recargar(); abrirGanadores(data, "iathon"); }, sub: true },
    { id: "cierre1", dia: "d1", t: "Cierre del Día 1 · Así va la Copa CONCEPMI", s: "Puntaje acumulado de todas las delegaciones. Espacio: «¡Nos vemos el jueves 26!».", abrir: async () => { await recargar(); abrirCierreDia1(data); }, sub: true },
    { dia: "d2", ini: "8:30", fin: "9:30", t: "Registro y coffee break", s: "Sin proyección.", nota: true },
    { dia: "d2", ini: "9:30", fin: "1:00", t: "Gran Gymkana (cancha)", s: "Fuera del auditorio.", nota: true },
    { id: "barras", dia: "d2", ini: "2:30", fin: "3:30", t: "Concurso de Barras", s: "En el orden del sorteo, con la pista de cada delegación: → siguiente · Espacio play / pausa · S stop. Las pistas se suben en Admin → Concurso de Barras, en ESTA laptop.", abrir: async () => { await recargar(); await abrirConcursoBarras(data.delegaciones); } },
    { id: "c2", dia: "d2", ini: "", fin: "", t: `Charla magistral II · ${ch(1).ponente}`, s: "Su presentación en PDF.", abrir: () => ponencia(1) },
    { id: "c2t", dia: "d2", t: "Trivia de la Charla II", s: "QR, el público juega y sale el podio.", abrir: () => trivia(ch(1).id), sub: true },
    { id: "conoc", dia: "d2", ini: "3:45", fin: "5:45", t: "Concurso Nacional de Conocimientos", s: "Se maneja en su propio sistema: se abre en otra pestaña.", abrir: () => { window.open(URL_CONOCIMIENTOS, "_blank", "noopener"); }, externo: true },
    { id: "c3", dia: "d2", ini: "6:00", fin: "7:00", t: `Charla magistral III · ${ch(2).ponente}`, s: "Su presentación en PDF.", abrir: () => ponencia(2) },
    { id: "c3t", dia: "d2", t: "Trivia de la Charla III", s: "QR, el público juega y sale el podio.", abrir: () => trivia(ch(2).id), sub: true },
    { id: "prem", dia: "d2", ini: "7:00", fin: "8:30", t: "Ceremonia de cierre y premiación", s: "Copa CONCEPMI: del último puesto al TOP 3 con los Wolfitos.", abrir: premiacion },
  ];
  const PASOS = AGENDA.filter((x) => x.abrir);
  const pasoId = (id) => PASOS.findIndex((p) => p.id === id);

  // Día y momento actual (en hora de Lima)
  const lima = () => { const s = new Date().toLocaleString("sv-SE", { timeZone: "America/Lima" }); return { fecha: s.slice(0, 10), min: Number(s.slice(11, 13)) * 60 + Number(s.slice(14, 16)) }; };
  const diaHoy = () => (lima().fecha >= DIAS.d2.fecha ? "d2" : "d1");
  const enCurso = (x) => { const l = lima(); return x.ini && l.fecha === DIAS[x.dia].fecha && l.min >= aMin(x.ini) && l.min < aMin(x.fin); };

  // ---------------- Barra «Siguiente» dentro de las pantallas ----------------
  const barra = document.createElement("div");
  barra.className = "pyc-cond"; barra.hidden = true;
  document.body.append(barra);
  let ocultarT = null;
  function pintarBarra() {
    const p = PASOS[actual], sig = PASOS[actual + 1], ant = PASOS[actual - 1];
    barra.innerHTML = `<button class="btn btn--mini" data-c-ant ${ant ? "" : "disabled"} title="${esc(ant?.t || "")}">◀ Anterior</button>
      <span class="pyc-cond__txt"><small>Paso ${actual + 1} de ${PASOS.length}</small><b>${esc(p?.t || "")}</b></span>
      ${sig ? `<button class="btn btn--mini btn--naranja" data-c-sig title="Cierra esta pantalla y abre la siguiente">Siguiente: ${esc(sig.t)} ▶</button>` : `<span class="pyc-cond__fin">✓ Último momento del cronograma</span>`}
      <button class="btn btn--mini" data-c-menu title="Cierra esta pantalla y vuelve al cronograma">☰ Cronograma</button>`;
    $("[data-c-ant]", barra).onclick = () => irPaso(actual - 1);
    $("[data-c-sig]", barra)?.addEventListener("click", () => irPaso(actual + 1));
    $("[data-c-menu]", barra).onclick = () => { pantallaActiva.cerrar(); barra.hidden = true; pintar(); };
  }
  const mostrarBarra = () => { if (!pantallaActiva.hay() || actual < 0) return; barra.classList.add("pyc-cond--ver"); clearTimeout(ocultarT); ocultarT = setTimeout(() => barra.classList.remove("pyc-cond--ver"), 2600); };
  const alAbrir = () => { if (actual >= 0) { pintarBarra(); barra.hidden = false; mostrarBarra(); } };
  const alCerrar = () => { barra.hidden = true; if (document.body.contains(app.firstElementChild)) pintar(); };
  window.addEventListener("pantalla-abierta", alAbrir);
  window.addEventListener("pantalla-cerrada", alCerrar);
  document.addEventListener("mousemove", mostrarBarra);
  const limpiar = () => { window.removeEventListener("pantalla-abierta", alAbrir); window.removeEventListener("pantalla-cerrada", alCerrar); document.removeEventListener("mousemove", mostrarBarra); barra.remove(); };

  const pantallaEspera = (titulo = "") => pantalla("pyc-espera", `<div class="pyc-espera"><img src="${IMG.logo}" alt="CONCEPMI"><small>VI CONCEPMI 2026 · Congreso de Estudiantes de Gestión de Proyectos</small>${titulo ? `<b>${esc(titulo)}</b>` : ""}</div>`);
  // Cambio de pantalla sin que el público vea el panel: un «telón» con el logo tapa todo mientras
  // se cierra la pantalla actual y carga la siguiente, y no se sale de pantalla completa.
  async function irPaso(i) {
    const p = PASOS[i]; if (!p) return;
    const telon = document.createElement("div");
    telon.className = "pyc-telon";
    telon.innerHTML = `<img src="${IMG.logo}" alt=""><span class="giro"></span>`;
    document.body.append(telon);
    pantallaActiva.transicion = true;
    pantallaActiva.cerrar(); barra.hidden = true;
    actual = i; diaSel = p.dia;
    try { await p.abrir(); } catch (e) { aviso(e.message, "error"); }
    pantallaActiva.transicion = false;
    // Si la pantalla no se pudo abrir (p. ej. falta subir un archivo) o es otra pestaña (Conocimientos), el público
    // ve una pantalla de espera con el logo, nunca el panel; la barra sigue arriba para pasar con «Siguiente».
    if (!pantallaActiva.hay()) pantallaEspera(p.externo ? "Concurso Nacional de Conocimientos" : "");
    const abierta = pantallaActiva.hay();
    // Quita el telón cuando la nueva pantalla ya está dibujada (con un fundido corto)
    setTimeout(() => { telon.classList.add("pyc-telon--fuera"); setTimeout(() => telon.remove(), 450); }, abierta ? 350 : 0);
  }

  // ---------------- Editar el programa de la inauguración ----------------
  function editarInauguracion() {
    const m = modal(`<div data-inau></div><div class="modal__acciones"><button class="btn" data-cerrar>Cerrar</button></div>`, { ancho: true });
    m.el.classList.add("pyc-modal-inau");
    crearInauguracion({ codigo: () => codigo, abrirCharla: () => { m.cerrar(); irPaso(pasoId("c1")); } }).vista($("[data-inau]", m.el));
    $("[data-cerrar]", m.el).onclick = m.cerrar;
    // «Proyectar ceremonia» del editor: cierra esta ventana y abre la ceremonia como paso del cronograma
    m.el.addEventListener("click", (e) => {
      if (!e.target.closest("[data-proyectar]")) return;
      e.stopPropagation(); e.preventDefault(); m.cerrar();
      pantallaActiva.cerrar(); actual = pasoId("inaug"); diaSel = "d1";
      abrirCeremonia(leerPrograma(), { abrirCharla: () => irPaso(pasoId("c1")) });
    }, true);
  }

  // ---------------- El panel ----------------
  function pintar() {
    diaSel ||= diaHoy();
    const lista = AGENDA.filter((x) => x.dia === diaSel);
    const sig = PASOS[actual + 1], ult = PASOS[actual];
    const fila = (x) => {
      const i = PASOS.indexOf(x), ahora = enCurso(x), hecho = i >= 0 && i < actual, esActual = i >= 0 && i === actual;
      return `<article class="pyc-paso ${x.nota ? "pyc-paso--nota" : ""} ${x.sub ? "pyc-paso--sub" : ""} ${ahora ? "pyc-paso--ahora" : ""} ${esActual ? "pyc-paso--actual" : ""} ${hecho ? "pyc-paso--hecho" : ""}">
        <div class="pyc-paso__hora">${x.ini ? `<b>${esc(ampm(x.ini))}</b><small>a ${esc(ampm(x.fin))}</small>` : `<small>${x.sub ? "luego" : ""}</small>`}</div>
        <div class="pyc-paso__txt"><b>${esc(x.t)}</b>${ahora ? ` <span class="chip chip--verde">● Ahora</span>` : ""}${esActual ? ` <span class="chip chip--celeste">Lo último que abriste</span>` : ""}<small>${esc(x.s || "")}</small>
          ${x.extra ? `<div class="pyc-paso__extra">${x.extra.map((e, k) => `<button class="btn btn--mini" data-extra="${AGENDA.indexOf(x)}:${k}">${I.vivo}${esc(e.txt)}</button>`).join("")}</div>` : ""}</div>
        <div class="pyc-paso__acc">${x.abrir ? `${x.editar ? `<button class="btn" data-editar-inau>${I.lapiz}Editar programa</button>` : ""}<button class="btn btn--naranja pyc-paso__proy" data-paso="${i}">${x.externo ? `${I.flecha}Abrir` : `▶ Proyectar`}</button>` : ""}</div>
      </article>`;
    };
    app.innerHTML = `${fondoAnimado(18)}
      <header class="barra pyc-barra">
        <img class="logo" src="${IMG.logo}" alt="CONCEPMI"><span class="sep"></span>
        <div><div class="barra__titulo">Panel de Proyección</div><div class="barra__sub">${esc(acceso.nombre)} · VI CONCEPMI 2026</div></div>
        <div class="der">${volver ? `<button class="btn btn--mini" data-volver>${I.atras}<span>Volver a mi panel</span></button>` : ""}<button class="btn btn--mini" data-full>${I.vivo}<span>Pantalla completa</span></button><button class="btn btn--mini btn--icono" data-salir title="Salir" aria-label="Salir">${I.salir}</button></div>
      </header>
      <main class="contenedor pyc">
        <section class="pyc-como tarjeta">
          <b>Cómo usarlo</b>
          <ol><li>Sigue el cronograma <b>de arriba hacia abajo</b> y toca <b>▶ Proyectar</b> en el momento que toca.</li>
            <li>Dentro de la pantalla, <b>mueve el mouse</b>: arriba aparece <b>«Siguiente ▶»</b> para pasar al siguiente momento sin salir. El público no la ve: se esconde sola.</li>
            <li>Si algo falla, toca <b>☰ Cronograma</b> (o Salir) y vuelve a proyectar.</li></ol>
        </section>
        ${sig && actual >= 0 && !pantallaActiva.hay() ? `<button class="pyc-seguir" data-paso="${actual + 1}"><small>Lo último: ${esc(ult?.t || "")}</small><b>▶ Continuar: ${esc(sig.t)}</b></button>` : ""}
        <div class="pyc-dias" role="tablist">${Object.entries(DIAS).map(([d, x]) => `<button role="tab" class="pyc-dia ${diaSel === d ? "activo" : ""}" aria-selected="${diaSel === d}" data-dia="${d}"><small>${x.corto}</small><b>${x.largo}</b></button>`).join("")}</div>
        <div class="pyc-agenda">${lista.map(fila).join("")}</div>
      </main>
      ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $("[data-salir]", app).onclick = () => { limpiar(); salir(); };
    if (volver) $("[data-volver]", app).onclick = () => { limpiar(); volver(); };
    $("[data-full]", app).onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
    $$("[data-dia]", app).forEach((b) => (b.onclick = () => { diaSel = b.dataset.dia; pintar(); }));
    $$("[data-paso]", app).forEach((b) => (b.onclick = async () => { b.disabled = true; await irPaso(Number(b.dataset.paso)); b.disabled = false; }));
    $("[data-editar-inau]", app)?.addEventListener("click", editarInauguracion);
    $$("[data-extra]", app).forEach((b) => (b.onclick = async () => { const [a, k] = b.dataset.extra.split(":").map(Number); actual = -1; try { await AGENDA[a].extra[k].fn(); } catch (e) { aviso(e.message, "error"); } }));
  }
  pintar();
}

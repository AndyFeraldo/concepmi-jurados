// =========================================================
// Vista del TALLERISTA (puerta Tallerista de la portada). Por cada taller tiene dos partes:
//   1 · Presentación y proyección: sube su PDF (el que se proyecta), PPT de respaldo y video opcional,
//       y lo proyecta desde aquí (misma pantalla que las charlas, js/talleres-pres.js).
//   2 · Ganadores: registra al equipo ganador (nombre, apellido y delegación) → +40 pts por delegación.
// A la derecha, sus colegas (jurados y talleristas) con LinkedIn. Decoración igual que el panel del jurado.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611120128";
import { TALLERES, tallerPorId, PUNTOS_TALLER, HORA_TALLERES, delegacionesGanadoras } from "./talleres.js?v=202611120128";
import { $, $$, esc, avatar, hace, I, IMG, aviso, confirmar, lanzarConfeti, fondoAnimado } from "./ui.js?v=202611120128";
import { salir } from "./app.js?v=202611120128";
import { pintarColegas } from "./colegas.js?v=202611120128";
import { htmlArchivos, conectarArchivos } from "./ponente.js?v=202611120128";
import { INFO_TALLER, MIN_TALLER, proyectarTalleres, abrirTallerArchivo } from "./talleres-pres.js?v=202611120128";

const INICIALES = 4;

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
        <div style="--i:2"><span>3</span><b>Al terminar</b><small>Registra al <b>equipo ganador</b>: cada delegación de sus integrantes suma <b>${PUNTOS_TALLER} pts</b> a la Copa (una vez por delegación).</small></div>
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
        <button role="tab" class="tal-tab" data-tab="gan" aria-selected="${parte === "gan"}"><span class="tal-tab__n">${hayGan(tid) ? "✓" : "2"}</span><span><b>Equipo ganador</b><small>${hayGan(tid) ? "Ganadores registrados" : "Nombre, apellido y delegación"}</small></span></button>
      </div>
      <div data-parte></div>`);
    $("[data-volver]", app).onclick = () => { inicio(); window.scrollTo(0, 0); };
    $$("[data-tab]", app).forEach((b) => (b.onclick = () => abrirTaller(tid, b.dataset.tab)));
    const caja = $("[data-parte]", app);
    if (parte === "gan") ganadores(tid, caja); else presentacion(tid, caja);
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

  // ---------------- 2 · Registro del equipo ganador ----------------
  function ganadores(tid, caja) {
    const editable = abierto(tid);
    const previo = ganador(tid);
    let filas = previo?.integrantes.length ? previo.integrantes.map((i) => ({ ...i })) : Array.from({ length: INICIALES }, () => ({ nombre: "", delegacion: "" }));

    caja.innerHTML = `
      ${editable ? "" : `<div class="cerrado">${I.candado}El organizador cerró este taller. Puedes ver a los ganadores, pero ya no cambiarlos.</div>`}
      ${previo?.integrantes.length ? `<p class="ayuda">Último registro: ${hace(previo.actualizado)}${previo.tallerista ? ` por ${esc(previo.tallerista)}` : ""}. Si guardas de nuevo, se reemplaza.</p>` : ""}
      ${data.delegaciones.length ? `
      <h2 class="seccion-titulo">Equipo ganador (1.er lugar)</h2>
      <p class="ayuda">Escribe el nombre y apellido de cada integrante y elige su delegación. Usa <b>+ Agregar integrante</b> si el equipo tiene más personas.</p>
      <div class="integrantes" id="integrantes"></div>
      ${editable ? `<button class="btn btn--mini" data-mas style="margin-top:10px">${I.mas}Agregar integrante</button>` : ""}
      <h2 class="seccion-titulo">Puntos que se suman a la Copa</h2>
      <div class="reparto" id="reparto"></div>
      <p class="error" aria-live="polite"></p>
      <div class="enviar">
        <div class="enviar__info"><span id="resumen"></span></div>
        ${editable && previo?.integrantes.length ? `<button class="btn btn--peligro" data-quitar>${I.basura}Quitar ganadores</button>` : ""}
        <button class="btn btn--naranja" data-guardar ${editable ? "" : "disabled"}>${I.copa}${previo?.integrantes.length ? "Actualizar ganadores" : "Registrar ganadores"}</button>
      </div>` : `<div class="vacio"><b>Todavía no hay delegaciones registradas</b>El organizador las agregará antes del taller.</div>`}`;
    if (!data.delegaciones.length) return;

    const opciones = (sel) => `<option value="">Delegación…</option>${data.delegaciones.map((d) => `<option value="${d.id}" ${d.id === sel ? "selected" : ""}>${esc(d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre)}</option>`).join("")}`;

    function pintarFilas() {
      $("#integrantes", caja).innerHTML = filas.map((f, i) => `<div class="integrante">
        <span class="integrante__n">${i + 1}</span>
        <input data-nombre="${i}" maxlength="120" placeholder="Nombre y apellido" value="${esc(f.nombre)}" ${editable ? "" : "disabled"} aria-label="Nombre y apellido del integrante ${i + 1}">
        <select data-del="${i}" ${editable ? "" : "disabled"} aria-label="Delegación del integrante ${i + 1}">${opciones(f.delegacion)}</select>
        ${editable ? `<button class="btn btn--mini btn--icono" data-menos="${i}" title="Quitar integrante" aria-label="Quitar integrante ${i + 1}">${I.cerrar}</button>` : "<span></span>"}
      </div>`).join("");
      $$("[data-nombre]", caja).forEach((el) => (el.oninput = () => { filas[el.dataset.nombre].nombre = el.value; }));
      $$("[data-del]", caja).forEach((el) => (el.onchange = () => { filas[el.dataset.del].delegacion = el.value; reparto(); }));
      $$("[data-menos]", caja).forEach((b) => (b.onclick = () => { filas.splice(Number(b.dataset.menos), 1); if (!filas.length) filas.push({ nombre: "", delegacion: "" }); pintarFilas(); }));
      reparto();
    }

    function reparto() {
      const ids = delegacionesGanadoras({ integrantes: filas });
      $("#reparto", caja).innerHTML = ids.length
        ? ids.map((id) => `<span class="chip chip--verde">+${PUNTOS_TALLER} · ${esc(del(id)?.siglas || del(id)?.nombre)}</span>`).join("")
        : `<span class="tenue" style="color:var(--tenue)">Elige la delegación de cada integrante para ver los puntos.</span>`;
      $("#resumen", caja).textContent = `${filas.length} integrante${filas.length === 1 ? "" : "s"} · ${ids.length} delegaci${ids.length === 1 ? "ón" : "ones"} · +${ids.length * PUNTOS_TALLER} pts en total`;
    }

    pintarFilas();
    $("[data-mas]", caja)?.addEventListener("click", () => {
      if (filas.length >= 15) return aviso("Máximo 15 integrantes por equipo", "error");
      filas.push({ nombre: "", delegacion: "" }); pintarFilas(); $(`[data-nombre="${filas.length - 1}"]`, caja)?.focus();
    });

    async function guardar(lista) {
      const err = $(".error", caja); err.textContent = "";
      try {
        await api.registrarTaller(codigo, tid, lista);
        data = await api.datosTallerista(codigo);
        return true;
      } catch (e) { err.textContent = e.message; aviso(e.message, "error"); return false; }
    }

    $("[data-guardar]", caja)?.addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      const err = $(".error", caja);
      const lista = filas.map((f) => ({ nombre: f.nombre.trim(), delegacion: f.delegacion })).filter((f) => f.nombre || f.delegacion);
      if (!lista.length) { err.textContent = "Escribe al menos un integrante."; return; }
      const falta = lista.findIndex((f) => !f.nombre || !f.delegacion);
      if (falta >= 0) { err.textContent = `Al integrante ${falta + 1} le falta ${lista[falta].nombre ? "la delegación" : "el nombre y apellido"}.`; return; }
      const ids = delegacionesGanadoras({ integrantes: lista });
      const ok = await confirmar("¿Registrar a los ganadores?", `Se sumarán <b>${PUNTOS_TALLER} puntos</b> a: <b>${ids.map((id) => esc(del(id)?.siglas || del(id)?.nombre)).join(", ")}</b>.`, { boton: "Registrar ganadores" });
      if (!ok) return;
      btn.disabled = true;
      if (await guardar(lista)) { lanzarConfeti(); aviso("Ganadores registrados"); abrirTaller(tid, "gan"); }
      else btn.disabled = false;
    });

    $("[data-quitar]", caja)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Quitar a los ganadores?", "Las delegaciones de este equipo dejarán de recibir los puntos del taller. Puedes registrarlos otra vez cuando quieras.", { boton: "Quitar ganadores", peligro: true }))) return;
      if (await guardar([])) { aviso("Ganadores quitados"); abrirTaller(tid, "gan"); }
    });
  }

  inicio();
}

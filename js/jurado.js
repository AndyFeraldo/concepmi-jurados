// =========================================================
// Vista del JURADO
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202610280251";
import { CONCURSOS, porId, NIVELES_RAPIDOS, sumaMax, tonoNivel } from "./concursos.js?v=202610280251";
import { rankingMinijuego, textoGymkana } from "./calculo.js?v=202610280251";
import { $, $$, esc, fmt, avatar, I, IMG, aviso, modal, confirmar, lanzarConfeti, mmss } from "./ui.js?v=202610280251";
import { salir } from "./app.js?v=202610280251";

export async function vistaJurado(app, codigo) {
  let data = null;
  let vista = { tipo: "inicio" };
  let form = null; // { cid, sub, did, valores, comentario }

  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Cargando tus concursos…</div>`;
  try { data = await api.datosJurado(codigo); }
  catch (e) { aviso(e.message, "error"); return salir(); }

  const mio = (cid, sub, did) => data.calificaciones.find((x) => x.concurso_id === cid && x.subprueba === sub && x.delegacion_id === did);
  const abierto = (cid) => data.abiertos?.[cid] !== false;

  function shell(contenido) {
    const j = data.jurado;
    app.innerHTML = `<div class="fondo fondo--sobrio"></div>
    <header class="barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">Panel de Jurados</div><div class="barra__sub">Calificación oficial</div></div>
      <div class="der">
        ${avatar(j.nombre, j.foto)}
        <button class="btn btn--mini" data-salir>${I.salir}<span>Salir</span></button>
      </div>
    </header>
    <main class="contenedor">${contenido}</main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $("[data-salir]", app).onclick = salir;
  }

  // ---------------- Inicio ----------------
  function inicio() {
    vista = { tipo: "inicio" };
    const j = data.jurado;
    const asignados = CONCURSOS.filter((c) => j.concursos.includes(c.id));
    const nd = data.delegaciones.length;
    const tarjetas = asignados.map((c) => {
      const subs = c.subpruebas.length;
      const hechas = data.calificaciones.filter((x) => x.concurso_id === c.id).length;
      const meta = nd * subs;
      const pct = meta ? Math.min(100, (hechas / meta) * 100) : 0;
      return `<button class="concurso c-${c.color}" data-cid="${c.id}">
        <span class="concurso__tipo">${c.tipo === "academico" ? "Concurso académico" : "Evento cultural"}${abierto(c.id) ? "" : " · cerrado"}</span>
        <h3>${esc(c.nombre)}</h3>
        <p class="concurso__apodo">${esc(c.apodo)}${c.modo === "gymkana" ? "" : ` · ${c.subpruebas.reduce((s, x) => s + x.max, 0)} pts de rúbrica`}</p>
        <div class="concurso__pie"><div class="progreso"><i style="width:${pct}%"></i></div><span class="concurso__cuenta">${hechas}/${meta}</span></div>
      </button>`;
    }).join("");
    const info = CONCURSOS.filter((c) => c.jurados === 0).map((c) => `
      <div class="concurso concurso--info"><span class="concurso__tipo" style="color:var(--ambar)">${I.info.replace("<svg", '<svg style="width:1em;height:1em;vertical-align:-2px"')} Lo registra el organizador</span>
        <h3>${esc(c.nombre)}</h3><p>${esc(c.nota)}</p></div>`).join("");
    shell(`
      <section class="tarjeta bienvenida">
        ${avatar(j.nombre, j.foto)}
        <div><h1>Hola, ${esc(j.nombre.split(" ")[0])}</h1>
          <p>${j.descripcion ? esc(j.descripcion) : "Gracias por ser parte del jurado del VI CONCEPMI."}</p></div>
      </section>
      <h2 class="seccion-titulo">Tus concursos</h2>
      ${asignados.length ? `<div class="rejilla">${tarjetas}</div>` : `<div class="vacio"><b>Aún no tienes concursos asignados</b>Pide al organizador que te asigne uno.</div>`}
      ${nd ? "" : `<div class="vacio" style="margin-top:14px"><b>Todavía no hay delegaciones registradas</b>El organizador las agregará antes del concurso.</div>`}
      <h2 class="seccion-titulo">Para tu información</h2>
      <div class="rejilla">${info}</div>`);
    $$("[data-cid]", app).forEach((b) => (b.onclick = () => { abrirConcurso(b.dataset.cid); window.scrollTo(0, 0); }));
  }

  // ---------------- Concurso ----------------
  function abrirConcurso(cid, sub, did) {
    const c = porId(cid);
    sub = sub || c.subpruebas[0].id;
    if (c.modo === "gymkana" && !c.subpruebas.find((x) => x.id === sub)?.criterios) return gymkana(c, sub);
    if (!did) {
      const pendiente = data.delegaciones.find((d) => !mio(cid, sub, d.id));
      did = (pendiente || data.delegaciones[0])?.id;
    }
    vista = { tipo: "concurso", cid, sub, did };
    const sp = c.subpruebas.find((s) => s.id === sub);
    const prev = did ? mio(cid, sub, did) : null;
    form = { cid, sub, did, valores: Object.fromEntries(sp.criterios.map((k) => [k.id, prev ? Number(prev.datos[k.id]) : null])), comentario: prev?.comentario || "" };
    const editable = abierto(cid);

    let grupoActual = null;
    const criterios = sp.criterios.map((k, i) => {
      let cab = "";
      if (k.grupo && k.grupo !== grupoActual) { grupoActual = k.grupo; cab = `<div class="grupo">${esc(k.grupo)}</div>`; }
      return cab + criterioHTML(k, i, editable);
    }).join("");

    shell(`
      <button class="volver" data-volver>${I.atras} Mis concursos</button>
      <div class="cabeza c-${c.color}">
        <div><h1>${esc(c.nombre)}</h1><p>${esc(c.apodo)} · ${esc(sp.nombre)}</p></div>
        <span class="chip ${editable ? "chip--verde" : "chip--rojo"}">${editable ? "Calificación abierta" : "Calificación cerrada"}</span>
      </div>
      ${editable ? "" : `<div class="cerrado">${I.candado}El organizador cerró este concurso. Puedes ver tus puntajes, pero ya no cambiarlos.</div>`}
      ${c.subpruebas.length > 1 ? `<div class="pestanas" role="tablist">${c.subpruebas.map((s) => {
        const n = data.calificaciones.filter((x) => x.concurso_id === cid && x.subprueba === s.id).length;
        return `<button class="pestana" role="tab" aria-selected="${s.id === sub}" data-sub="${s.id}">${c.modo === "gymkana" ? `${c.subpruebas.indexOf(s) + 1}. ${esc(s.corto)}` : esc(s.nombre)} <span class="n">${n}/${data.delegaciones.length}</span></button>`; }).join("")}</div>` : ""}
      ${data.delegaciones.length ? `
      ${selectorDeleg(cid, sub, did)}
      ${c.nota ? `<div class="nota">${esc(c.nota)}</div>` : ""}
      <div id="criterios">${criterios}</div>
      <label class="campo" style="margin-top:16px"><span>Comentario para el organizador (opcional)</span>
        <textarea id="comentario" maxlength="600" ${editable ? "" : "disabled"} placeholder="Observaciones, fortalezas o motivos de tu puntaje">${esc(form.comentario)}</textarea></label>
      <div class="enviar">
        <div class="enviar__total"><span id="total">0</span><small> / ${fmt(sumaMax(sp))}</small></div>
        <div class="enviar__info"><div class="progreso"><i id="barraTotal" style="width:0%"></i></div><span id="faltan"></span></div>
        <button class="btn btn--naranja" id="guardar" ${editable ? "" : "disabled"}>${I.check}${prev ? "Actualizar calificación" : "Guardar calificación"}</button>
      </div>` : `<div class="vacio"><b>Todavía no hay delegaciones registradas</b>El organizador las agregará antes del concurso.</div>`}
    `);
    $("[data-volver]", app).onclick = () => { inicio(); window.scrollTo(0, 0); };
    $$("[data-sub]", app).forEach((b) => (b.onclick = () => { abrirConcurso(cid, b.dataset.sub); window.scrollTo(0, 0); }));
    conectarSelector(cid, sub, did);
    if (!data.delegaciones.length) return;
    $("#comentario").oninput = (e) => (form.comentario = e.target.value);
    if (editable) conectarCriterios(sp);
    sp.criterios.forEach((k) => pintarCriterio(k));
    pintarTotal(sp);
    $("#guardar").onclick = () => guardar(c, sp);
  }

  function selectorDeleg(cid, sub, did) {
    const ds = data.delegaciones;
    const hechas = ds.filter((d) => mio(cid, sub, d.id)).length;
    const actual = ds.find((d) => d.id === did);
    const reg = actual ? mio(cid, sub, actual.id) : null;
    const pos = ds.findIndex((d) => d.id === did);
    return `<section class="selector">
      <div class="selector__top">
        <span class="selector__lbl">${I.bandera}Delegación a calificar</span>
        <span class="chip ${hechas === ds.length ? "chip--verde" : ""}">${hechas} de ${ds.length} calificadas</span>
      </div>
      <div class="selector__fila">
        <button class="selector__flecha" data-mover="-1" aria-label="Delegación anterior" ${pos <= 0 ? "disabled" : ""}>${I.atras}</button>
        <div class="selector__caja">
          <span class="selector__sig">${esc(actual?.siglas || (actual ? actual.nombre.slice(0, 3).toUpperCase() : "—"))}</span>
          <div class="selector__select">
            <label class="sr" for="selDeleg">Delegación</label>
            <select id="selDeleg">${ds.map((d) => `<option value="${d.id}" ${d.id === did ? "selected" : ""}>${mio(cid, sub, d.id) ? "✓ " : "○ "}${d.siglas ? `${esc(d.siglas)} · ` : ""}${esc(d.nombre)}</option>`).join("")}</select>
            <span class="selector__estado ${reg ? "ok" : ""}">${reg ? `${I.check}Calificada · ${fmt(reg.total)} pts` : `${I.reloj}Pendiente de calificar`}</span>
          </div>
          <svg class="selector__chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
        </div>
        <button class="selector__flecha" data-mover="1" aria-label="Delegación siguiente" ${pos >= ds.length - 1 ? "disabled" : ""}>${I.atras.replace("<svg", '<svg style="transform:rotate(180deg)"')}</button>
      </div>
      <div class="selector__puntos" aria-hidden="true">${ds.map((d) => `<i class="${mio(cid, sub, d.id) ? "hecho" : ""} ${d.id === did ? "actual" : ""}" title="${esc(d.siglas || d.nombre)}"></i>`).join("")}</div>
    </section>`;
  }

  function conectarSelector(cid, sub, did) {
    const sel = $("#selDeleg", app); if (!sel) return;
    const ir = (id) => {
      abrirConcurso(cid, sub, id);
      const el = $(".selector", app);
      if (el) window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - 80), behavior: "smooth" });
    };
    sel.onchange = () => ir(sel.value);
    $$("[data-mover]", app).forEach((b) => (b.onclick = () => {
      const ds = data.delegaciones; const i = ds.findIndex((d) => d.id === did) + Number(b.dataset.mover);
      if (ds[i]) ir(ds[i].id);
    }));
  }

  function criterioHTML(k, i, editable) {
    const dis = editable ? "" : "disabled";
    if (k.niveles) {
      return `<article class="criterio criterio--niveles" data-k="${k.id}">
        <div class="criterio__cab"><div><h4>${i + 1}. ${esc(k.nombre)}</h4><p class="criterio__desc">${esc(k.desc || "Elige el nivel de desempeño observado.")}</p></div>
          <div class="criterio__valor" data-v></div></div>
        <div class="niveles">${k.niveles.map((n, ni) => `<button class="nivel nivel--${tonoNivel(n.nombre)}" data-pts="${n.pts}" aria-pressed="false" ${dis}>
          <span class="nivel__nombre">${esc(n.nombre)}</span><span class="nivel__desc">${esc(n.desc)}</span><span class="nivel__pts">${n.pts}</span></button>`).join("")}</div>
      </article>`;
    }
    return `<article class="criterio" data-k="${k.id}">
      <div class="criterio__cab"><div><h4>${i + 1}. ${esc(k.nombre)}</h4><p class="criterio__desc">${esc(k.desc)}</p></div>
        <div class="criterio__valor" data-v></div></div>
      <div class="rapidos">${NIVELES_RAPIDOS.map((n) => { const v = Math.round(k.max * n.factor * 2) / 2;
        return `<button class="rapido" data-rapido="${v}" aria-pressed="false" ${dis}>${n.nombre} · ${fmt(v)}</button>`; }).join("")}</div>
      <div class="ajuste">
        <button class="paso" data-paso="-0.5" aria-label="Restar medio punto" ${dis}>−</button>
        <input type="range" min="0" max="${k.max}" step="0.5" value="0" aria-label="Puntaje de ${esc(k.nombre)}" ${dis}>
        <button class="paso" data-paso="0.5" aria-label="Sumar medio punto" ${dis}>+</button>
      </div>
    </article>`;
  }

  function conectarCriterios(sp) {
    for (const k of sp.criterios) {
      const el = $(`[data-k="${k.id}"]`, app);
      const poner = (v) => { form.valores[k.id] = Math.max(0, Math.min(k.max, Math.round(v * 2) / 2)); pintarCriterio(k); pintarTotal(sp); };
      $$(".nivel", el).forEach((b) => (b.onclick = () => poner(Number(b.dataset.pts))));
      $$("[data-rapido]", el).forEach((b) => (b.onclick = () => poner(Number(b.dataset.rapido))));
      $$("[data-paso]", el).forEach((b) => (b.onclick = () => poner((form.valores[k.id] ?? 0) + Number(b.dataset.paso))));
      const r = $("input[type=range]", el); if (r) r.oninput = () => poner(Number(r.value));
    }
  }

  function pintarCriterio(k) {
    const el = $(`[data-k="${k.id}"]`, app); if (!el) return;
    const v = form.valores[k.id];
    const vEl = $("[data-v]", el);
    vEl.classList.toggle("vacio-v", v == null);
    vEl.innerHTML = `${v == null ? "—" : fmt(v)}<small> / ${fmt(k.max)}</small>`;
    el.classList.toggle("criterio--listo", v != null);
    $$(".nivel", el).forEach((b) => b.setAttribute("aria-pressed", String(v != null && Number(b.dataset.pts) === v)));
    $$("[data-rapido]", el).forEach((b) => b.setAttribute("aria-pressed", String(v != null && Number(b.dataset.rapido) === v)));
    const r = $("input[type=range]", el); if (r) r.value = v ?? 0;
  }

  function pintarTotal(sp) {
    const vals = sp.criterios.map((k) => form.valores[k.id]);
    const total = vals.reduce((s, v) => s + (v || 0), 0);
    const faltan = vals.filter((v) => v == null).length;
    $("#total").textContent = fmt(total);
    $("#barraTotal").style.width = `${(total / sumaMax(sp)) * 100}%`;
    $("#faltan").textContent = faltan ? `Faltan ${faltan} ${faltan === 1 ? "criterio" : "criterios"} por calificar` : "Todos los criterios calificados";
  }

  async function guardar(c, sp) {
    const faltan = sp.criterios.filter((k) => form.valores[k.id] == null);
    if (faltan.length) {
      aviso(`Falta calificar: ${faltan.map((k) => k.nombre).join(", ")}`, "error");
      $(`[data-k="${faltan[0].id}"]`, app)?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
    const d = data.delegaciones.find((x) => x.id === form.did);
    const total = sp.criterios.reduce((s, k) => s + form.valores[k.id], 0);
    const ok = await confirmar("¿Confirmas tu calificación?",
      `<b>${esc(d.nombre)}</b> recibirá <b style="color:var(--oro)">${fmt(total)} de ${fmt(sumaMax(sp))} puntos</b> en ${esc(c.nombre)}${c.subpruebas.length > 1 ? ` (${esc(sp.nombre)})` : ""}. Podrás cambiarla mientras el concurso siga abierto.`,
      { boton: "Sí, guardar" });
    if (!ok) return;
    const btn = $("#guardar"); btn.disabled = true;
    try {
      const datos = Object.fromEntries(sp.criterios.map((k) => [k.id, form.valores[k.id]]));
      const r = await api.calificar(codigo, c.id, sp.id, form.did, datos, form.comentario);
      const prev = mio(c.id, sp.id, form.did);
      const reg = { id: r.id, concurso_id: c.id, subprueba: sp.id, delegacion_id: form.did, datos, total, comentario: form.comentario, actualizado: new Date().toISOString() };
      if (prev) Object.assign(prev, reg); else data.calificaciones.push(reg);
      lanzarConfeti();
      const sig = data.delegaciones.find((x) => !mio(c.id, sp.id, x.id));
      const m = modal(`<div class="exito"><div class="exito__icono">${I.check}</div><h2>Calificación guardada</h2>
        <p style="color:var(--niebla);margin:0">${esc(d.nombre)} · ${fmt(total)} pts</p></div>
        <div class="modal__acciones" style="justify-content:center">
          ${sig ? `<button class="btn btn--naranja" data-sig>Siguiente: ${esc(sig.siglas || sig.nombre)} ${I.flecha}</button>` : `<button class="btn btn--naranja" data-fin>Volver a mis concursos</button>`}
        </div>`);
      m.el.querySelector("[data-sig]")?.addEventListener("click", () => { m.cerrar(); abrirConcurso(c.id, sp.id, sig.id); window.scrollTo({ top: 0, behavior: "smooth" }); });
      m.el.querySelector("[data-fin]")?.addEventListener("click", () => { m.cerrar(); inicio(); });
      abrirConcurso(c.id, sp.id, form.did);
    } catch (e) { aviso(e.message, "error"); btn.disabled = false; }
  }

  // ---------------- Gymkana ----------------
  let reloj = null; // intervalo del cronómetro del Pentatlón
  const pararReloj = () => { if (reloj) { clearInterval(reloj); reloj = null; } };

  function cabeceraGym(c, sp, extra = "") {
    const editable = abierto(c.id);
    const n = (s) => new Set(data.calificaciones.filter((x) => x.concurso_id === c.id && x.subprueba === s.id).map((x) => x.delegacion_id)).size;
    return `
      <button class="volver" data-volver>${I.atras} Mis concursos</button>
      <div class="cabeza c-${c.color}">
        <div><h1>${esc(c.nombre)}</h1><p>5 minijuegos · ${c.maxCopa} pts en total</p></div>
        <span class="chip ${editable ? "chip--verde" : "chip--rojo"}">${editable ? "Registro abierto" : "Registro cerrado"}</span>
      </div>
      ${editable ? "" : `<div class="cerrado">${I.candado}El organizador cerró la Gymkana. Ya no se pueden cambiar resultados.</div>`}
      <div class="pestanas" role="tablist">${c.subpruebas.map((s, i) => `<button class="pestana" role="tab" aria-selected="${s.id === sp.id}" data-sub="${s.id}">${i + 1}. ${esc(s.corto)} <span class="n">${n(s)}/${data.delegaciones.length}</span></button>`).join("")}</div>
      <div class="gym-intro"><div><h3>${esc(sp.nombre)} <span class="chip chip--celeste">hasta ${sp.max} pts</span></h3><p>${esc(sp.reglas)}</p></div>${extra}</div>`;
  }
  function conectarCabeceraGym(c) {
    $("[data-volver]", app).onclick = () => { pararReloj(); inicio(); window.scrollTo(0, 0); };
    $$("[data-sub]", app).forEach((b) => (b.onclick = () => { pararReloj(); abrirConcurso(c.id, b.dataset.sub); window.scrollTo(0, 0); }));
  }

  function gymkana(c, sub) {
    pararReloj();
    vista = { tipo: "concurso", cid: c.id, sub };
    const sp = c.subpruebas.find((s) => s.id === sub);
    if (!data.delegaciones.length) {
      shell(cabeceraGym(c, sp) + `<div class="vacio"><b>Todavía no hay delegaciones registradas</b>El organizador las agregará antes de la Gymkana.</div>`);
      return conectarCabeceraGym(c);
    }
    if (sp.entrada === "tablero") return tablero(c, sp);
    if (sp.entrada === "tiempo") return pentatlon(c, sp);
    return eliminatoria(c, sp);
  }

  // Guarda varias delegaciones de un minijuego
  async function guardarVarios(c, sp, lista, btn) {
    const txt = btn.innerHTML; btn.disabled = true;
    let ok = 0;
    try {
      for (const { did, datos } of lista) {
        btn.innerHTML = `Guardando ${ok + 1} de ${lista.length}…`;
        const r = await api.calificar(codigo, c.id, sp.id, did, datos);
        const prev = mio(c.id, sp.id, did);
        const reg = { id: r.id, concurso_id: c.id, subprueba: sp.id, delegacion_id: did, datos, total: r.total, actualizado: new Date().toISOString() };
        if (prev) Object.assign(prev, reg); else data.calificaciones.push(reg);
        ok++;
      }
      lanzarConfeti(); aviso(`${sp.corto}: ${ok} resultado${ok === 1 ? "" : "s"} guardado${ok === 1 ? "" : "s"}`);
      return true;
    } catch (e) { aviso(`${e.message}${ok ? ` (se guardaron ${ok})` : ""}`, "error"); return false; }
    finally { btn.disabled = false; btn.innerHTML = txt; }
  }

  function tablaResultadoGym(sp, valores, nombreExtra) {
    const rk = rankingMinijuego(sp, valores);
    const filas = valores.map((v) => ({ v, r: rk.get(v.id), d: data.delegaciones.find((x) => x.id === v.id) }))
      .sort((a, b) => (a.r?.puesto ?? 999) - (b.r?.puesto ?? 999) || (b.r?.pts ?? 0) - (a.r?.pts ?? 0));
    if (!filas.length) return `<div class="vacio" style="padding:1.2em">La tabla aparecerá cuando registres resultados.</div>`;
    return `<div class="tabla-envoltura"><table class="tabla tabla--gym"><thead><tr><th>Posición</th><th>Delegación</th><th>${nombreExtra}</th><th class="num">Puntos Gymkana</th></tr></thead><tbody>
      ${filas.map(({ v, r, d }) => `<tr><td>${r?.puesto ? `<span class="medalla ${r.puesto <= 3 ? `medalla--${r.puesto}` : ""}">${r.puesto}</span>${r.empate ? ' <span class="chip chip--ambar">empate</span>' : ""}` : '<span class="chip">pendiente</span>'}</td>
        <td><b>${esc(d?.siglas || d?.nombre)}</b>${d?.siglas ? `<br><small class="tenue">${esc(d.nombre)}</small>` : ""}</td>
        <td>${esc(textoGymkana(sp, v.datos))}</td><td class="num grande">${r?.pendiente ? "—" : `${r?.pts ?? 0} pts`}</td></tr>`).join("")}
    </tbody></table></div>`;
  }
  const tablaPuntosHTML = (sp) => `<div class="pts-mini">${sp.tabla.map((p, i) => `<span><b>${p}</b>${esc(sp.tablaTxt[i])}</span>`).join("")}${sp.resto != null ? `<span><b>${sp.resto}</b>${esc(sp.tablaTxt[sp.tabla.length])}</span>` : ""}</div>`;

  // ----- 1. Carrera de sacos: tablero de rondas -----
  function tablero(c, sp) {
    const editable = abierto(c.id);
    const ds = data.delegaciones;
    const ganador = Array(sp.rondas).fill(null);
    for (const d of ds) for (const r of mio(c.id, sp.id, d.id)?.datos?.rondas || []) if (r >= 1 && r <= sp.rondas) ganador[r - 1] = d.id;
    let sucio = false;
    shell(cabeceraGym(c, sp, tablaPuntosHTML(sp)) + `
      <div class="tablero-env" data-tablero></div>
      <h2 class="seccion-titulo">Tabla final de la carrera de sacos</h2>
      <div data-resultado></div>
      <div class="enviar"><div class="enviar__info"><b data-estado></b><span>Se guarda el tablero completo de las ${sp.rondas} rondas.</span></div>
        <button class="btn btn--naranja" data-guardar ${editable ? "" : "disabled"}>${I.check}Guardar tablero</button></div>`);
    conectarCabeceraGym(c);
    const valores = () => ds.map((d) => { const rondas = ganador.map((g, i) => (g === d.id ? i + 1 : null)).filter(Boolean); return { id: d.id, datos: { conteo: rondas.length, rondas } }; });
    const pintar = () => {
      if (!$("[data-tablero]", app)) return;
      const actual = ganador.findIndex((g) => !g);
      $("[data-tablero]", app).innerHTML = `<table class="tablero">
        <thead><tr><th class="tablero__del">Delegación</th>${ganador.map((g, i) => `<th class="${i === actual ? "actual" : ""}">R${i + 1}</th>`).join("")}<th class="tablero__cont">Contador</th></tr></thead>
        <tbody>${ds.map((d) => { const n = ganador.filter((g) => g === d.id).length;
          return `<tr><th class="tablero__del">${esc(d.siglas || d.nombre)}</th>${ganador.map((g, i) => `<td class="${i === actual ? "actual" : ""}"><button class="celda" data-r="${i}" data-d="${d.id}" aria-pressed="${g === d.id}" aria-label="Ronda ${i + 1}: ${esc(d.siglas || d.nombre)}" ${editable ? "" : "disabled"}></button></td>`).join("")}<td class="tablero__cont"><b>${n}</b></td></tr>`; }).join("")}</tbody></table>`;
      $$(".celda", app).forEach((b) => (b.onclick = () => { const i = Number(b.dataset.r); ganador[i] = ganador[i] === b.dataset.d ? null : b.dataset.d; sucio = true; pintar(); }));
      $("[data-resultado]", app).innerHTML = tablaResultadoGym(sp, valores(), "Contador");
      const hechas = ganador.filter(Boolean).length;
      $("[data-estado]", app).textContent = `${hechas} de ${sp.rondas} rondas marcadas${sucio ? " · cambios sin guardar" : ""}`;
    };
    pintar();
    $("[data-guardar]", app).onclick = async (e) => {
      if (await guardarVarios(c, sp, valores().map((v) => ({ did: v.id, datos: v.datos })), e.currentTarget)) { sucio = false; pintar(); }
    };
  }

  // ----- 3. Pentatlón: cronómetro por delegación -----
  function pentatlon(c, sp) {
    const editable = abierto(c.id);
    const ds = data.delegaciones;
    const st = Object.fromEntries(ds.map((d) => { const x = mio(c.id, sp.id, d.id)?.datos;
      return [d.id, x ? { seg: Number(x.segundos), tope: Number(x.segundos) >= 300, est: x.segundos >= 300 ? x.estaciones : null, inicio: null } : { seg: null, tope: false, est: null, inicio: null }]; }));
    let sucio = false;
    shell(cabeceraGym(c, sp, tablaPuntosHTML(sp)) + `
      <div class="penta" data-penta></div>
      <h2 class="seccion-titulo">Tabla final del Pentatlón</h2>
      <div data-resultado></div>
      <div class="enviar"><div class="enviar__info"><b data-estado></b><span>Se guardan las delegaciones con tiempo registrado.</span></div>
        <button class="btn btn--naranja" data-guardar ${editable ? "" : "disabled"}>${I.check}Guardar resultados</button></div>`);
    conectarCabeceraGym(c);
    const dis = editable ? "" : "disabled";
    const valores = () => ds.filter((d) => { const x = st[d.id]; return x.tope ? x.est : x.seg > 0; })
      .map((d) => ({ id: d.id, datos: st[d.id].tope ? { segundos: 300, estaciones: st[d.id].est } : { segundos: Math.round(st[d.id].seg * 100) / 100, estaciones: 5 } }));
    const fmtT = (sg) => { if (sg == null) return ["", ""]; const m = Math.floor(sg / 60); return [String(m), (sg - m * 60).toFixed(1).padStart(4, "0")]; };
    const tarjeta = (d) => { const x = st[d.id]; const [m, sgs] = fmtT(x.tope ? 300 : x.seg);
      return `<article class="penta__item ${x.inicio ? "corriendo" : ""} ${(x.tope ? x.est : x.seg) ? "listo" : ""}" data-pd="${d.id}">
        <div class="penta__nombre"><b>${esc(d.siglas || d.nombre)}</b><small>${esc(d.siglas ? d.nombre : "")}</small></div>
        <div class="penta__reloj">
          <input class="penta__min" inputmode="numeric" value="${m}" placeholder="0" aria-label="Minutos" ${dis} ${x.tope || x.inicio ? "disabled" : ""}><span>:</span><input class="penta__seg" inputmode="decimal" value="${sgs}" placeholder="00.0" aria-label="Segundos" ${dis} ${x.tope || x.inicio ? "disabled" : ""}>
        </div>
        <div class="penta__botones">
          ${x.inicio ? `<button class="btn btn--peligro" data-parar ${dis}>■ Detener</button>` : `<button class="btn btn--primario" data-iniciar ${dis} ${x.tope ? "disabled" : ""}>▶ ${x.seg ? "Continuar" : "Iniciar"}</button>`}
          <button class="btn btn--mini" data-reiniciar ${dis} title="Borrar tiempo">↺</button>
        </div>
        <label class="penta__tope"><input type="checkbox" data-tope ${x.tope ? "checked" : ""} ${dis}> No terminó en 5:00</label>
        ${x.tope ? `<div class="penta__est"><span>¿En qué estación se quedó?</span><div>${[1, 2, 3, 4, 5].map((n) => `<button data-est="${n}" aria-pressed="${x.est === n}" ${dis}>${n}</button>`).join("")}</div></div>` : ""}
      </article>`; };
    const pintar = () => {
      if (!$("[data-penta]", app)) return;
      $("[data-penta]", app).innerHTML = ds.map(tarjeta).join("");
      $$("[data-pd]", app).forEach((el) => {
        const x = st[el.dataset.pd];
        const desdeInputs = () => { const m = Number($(".penta__min", el).value || 0), sg = Number(String($(".penta__seg", el).value || 0).replace(",", "."));
          x.seg = isNaN(m) || isNaN(sg) ? null : Math.min(300, m * 60 + Math.min(59.9, sg)); sucio = true; resumen(); };
        $(".penta__min", el).oninput = desdeInputs; $(".penta__seg", el).oninput = desdeInputs;
        $("[data-iniciar]", el)?.addEventListener("click", () => { x.inicio = Date.now() - (x.seg || 0) * 1000; x.tope = false; x.est = null; arrancar(); pintar(); });
        $("[data-parar]", el)?.addEventListener("click", () => { x.seg = Math.min(300, (Date.now() - x.inicio) / 1000); x.inicio = null; sucio = true; pintar(); });
        $("[data-reiniciar]", el).onclick = () => { Object.assign(x, { seg: null, tope: false, est: null, inicio: null }); sucio = true; pintar(); };
        $("[data-tope]", el).onchange = (e) => { x.tope = e.target.checked; x.inicio = null; if (!x.tope) x.est = null; sucio = true; pintar(); };
        $$("[data-est]", el).forEach((b) => (b.onclick = () => { x.est = Number(b.dataset.est); sucio = true; pintar(); }));
      });
      resumen();
    };
    const resumen = () => {
      if (!$("[data-penta]", app)) return;
      $("[data-resultado]", app).innerHTML = tablaResultadoGym(sp, valores(), "Registro");
      $("[data-estado]", app).textContent = `${valores().length} de ${ds.length} delegaciones con resultado${sucio ? " · cambios sin guardar" : ""}`;
    };
    function arrancar() {
      if (reloj) return;
      reloj = setInterval(() => {
        if (!$("[data-penta]", app)) return pararReloj();
        let alguno = false;
        for (const d of ds) { const x = st[d.id]; if (!x.inicio) continue; alguno = true;
          const sg = (Date.now() - x.inicio) / 1000;
          if (sg >= 300) { x.inicio = null; x.seg = 300; x.tope = true; x.est = null; sucio = true; aviso(`${d.siglas || d.nombre}: llegó a 5:00. Marca la estación en la que se quedó.`, "error"); pintar(); continue; }
          const el = $(`[data-pd="${d.id}"]`, app); if (!el) continue;
          const [m, s2] = fmtT(sg); $(".penta__min", el).value = m; $(".penta__seg", el).value = s2;
        }
        if (!alguno) pararReloj();
      }, 100);
    }
    pintar();
    $("[data-guardar]", app).onclick = async (e) => {
      if (ds.some((d) => st[d.id].inicio)) return aviso("Detén los cronómetros que siguen corriendo antes de guardar.", "error");
      const falta = ds.find((d) => st[d.id].tope && !st[d.id].est);
      if (falta) return aviso(`Marca la estación en la que se quedó ${falta.siglas || falta.nombre}.`, "error");
      const vs = valores(); if (!vs.length) return aviso("Registra al menos un tiempo.", "error");
      if (await guardarVarios(c, sp, vs.map((v) => ({ did: v.id, datos: v.datos })), e.currentTarget)) { sucio = false; resumen(); }
    };
  }

  // ----- 4 y 5. Ponte la liga y Tren de globos: series + Gran Final -----
  function eliminatoria(c, sp) {
    const editable = abierto(c.id);
    const ds = data.delegaciones;
    const LETRAS = "ABCDEFGHIJ";
    let series = [], orden = [], final = [], sucio = false;
    const guardados = ds.map((d) => ({ d, x: mio(c.id, sp.id, d.id)?.datos })).filter((y) => y.x?.serie);
    if (guardados.length) {
      const nS = Math.max(...guardados.map((y) => y.x.serie));
      series = Array.from({ length: nS }, () => Array(sp.tamSerie).fill(null));
      orden = Array.from({ length: nS }, () => []);
      for (const { d, x } of guardados) {
        const fila = series[x.serie - 1]; let k = (x.carril || 1) - 1; while (fila[k] && k < sp.tamSerie - 1) k++; fila[k] = d.id;
      }
      for (let i = 0; i < nS; i++) orden[i] = guardados.filter((y) => y.x.serie === i + 1 && y.x.lugarSerie).sort((a, b) => a.x.lugarSerie - b.x.lugarSerie).map((y) => y.d.id);
      final = guardados.filter((y) => y.x.fase === "final" && y.x.puesto).sort((a, b) => a.x.puesto - b.x.puesto).map((y) => y.d.id);
    } else armar([...ds].map((d) => d.id));
    function armar(ids) {
      const nS = Math.max(1, Math.ceil(ids.length / sp.tamSerie));
      series = Array.from({ length: nS }, () => Array(sp.tamSerie).fill(null));
      ids.forEach((id, i) => { series[i % nS][Math.floor(i / nS)] = id; });
      orden = Array.from({ length: nS }, () => []); final = [];
    }
    const finalistas = () => orden.flatMap((o) => o.slice(0, sp.clasifican));
    const nombre = (id) => { const d = ds.find((x) => x.id === id); return d ? d.siglas || d.nombre : "—"; };
    const valores = () => {
      const fin = new Set(finalistas()); const out = [];
      series.forEach((fila, si) => fila.forEach((id, ci) => { if (!id) return;
        const ls = orden[si].indexOf(id); const pf = final.indexOf(id);
        const fase = fin.has(id) ? (pf >= 0 ? "final" : "clasificado") : (orden[si].length >= Math.min(sp.clasifican, fila.filter(Boolean).length) ? "serie" : "pendiente");
        out.push({ id, datos: { fase, serie: si + 1, carril: ci + 1, lugarSerie: ls >= 0 ? ls + 1 : null, puesto: pf >= 0 ? pf + 1 : null } });
      }));
      return out;
    };
    const ptsFinal = (i) => (i < sp.tablaFinal.length ? sp.tablaFinal[i] : sp.eliminado);
    shell(cabeceraGym(c, sp, `<div class="pts-mini">${sp.tablaFinal.map((p, i) => `<span><b>${p}</b>${i + 1}.° final</span>`).join("")}<span><b>${sp.eliminado}</b>eliminados</span></div>`) + `
      <div class="paso-tit"><span>1</span><div><b>Series clasificatorias</b><small>Toca a las delegaciones en el orden en que llegan. ${sp.clasifican === 1 ? "La primera" : `Las ${sp.clasifican} primeras`} de cada serie pasa${sp.clasifican === 1 ? "" : "n"} a la Gran Final.</small></div>
        <button class="btn btn--mini" data-sorteo ${editable ? "" : "disabled"}>${I.girar}Sortear series</button></div>
      <div class="series" data-series></div>
      <div class="paso-tit"><span>2</span><div><b>Gran Final</b><small>Toca a las finalistas en el orden en que llegan a la meta.</small></div>
        <button class="btn btn--mini" data-reiniciar-final ${editable ? "" : "disabled"}>${I.girar}Reiniciar final</button></div>
      <div class="final" data-final></div>
      <div class="paso-tit"><span>3</span><div><b>Tabla final de ${esc(sp.corto)}</b><small>Se calcula sola con lo que marcaste.</small></div></div>
      <div data-resultado></div>
      <div class="enviar"><div class="enviar__info"><b data-estado></b><span>Puedes guardar al terminar las series y otra vez al terminar la final.</span></div>
        <button class="btn btn--naranja" data-guardar ${editable ? "" : "disabled"}>${I.check}Guardar resultados</button></div>`);
    conectarCabeceraGym(c);
    const dis = editable ? "" : "disabled";
    const pintar = () => {
      if (!$("[data-series]", app)) return;
      const fin = new Set(finalistas());
      $("[data-series]", app).innerHTML = series.map((fila, si) => `<section class="serie">
        <header><b>Serie ${si + 1}</b><span class="chip ${orden[si].length >= Math.min(sp.clasifican, fila.filter(Boolean).length) && fila.some(Boolean) ? "chip--verde" : ""}">${orden[si].length ? `${orden[si].length} llegada${orden[si].length === 1 ? "" : "s"}` : "Por correr"}</span></header>
        ${fila.map((id, ci) => { const k = orden[si].indexOf(id); const pasa = id && k >= 0 && k < sp.clasifican;
          return `<div class="carril ${pasa ? "pasa" : ""}">
            <span class="carril__letra">${LETRAS[ci]}</span>
            <select class="select" data-s="${si}" data-c="${ci}" ${dis} aria-label="Serie ${si + 1}, carril ${LETRAS[ci]}"><option value="">— vacío —</option>${ds.map((d) => `<option value="${d.id}" ${d.id === id ? "selected" : ""}>${esc(d.siglas || d.nombre)}</option>`).join("")}</select>
            <button class="carril__llegada" data-ll="${si}" data-id="${id || ""}" ${id && editable ? "" : "disabled"}>${k >= 0 ? `<b>${k + 1}.°</b>${pasa ? " Pasa a la final" : ""}` : "Marcar llegada"}</button>
          </div>`; }).join("")}
      </section>`).join("");
      const fs = [...fin];
      $("[data-final]", app).innerHTML = fs.length ? `<div class="final__lista">${fs.map((id) => { const k = final.indexOf(id);
        return `<button class="finalista ${k >= 0 ? "puesto" : ""}" data-f="${id}" ${dis}><span class="finalista__pos">${k >= 0 ? `${k + 1}.°` : "?"}</span><b>${esc(nombre(id))}</b><small>${k >= 0 ? `${ptsFinal(k)} pts` : "Tocar al llegar"}</small></button>`; }).join("")}</div>`
        : `<div class="vacio" style="padding:1.2em">Las finalistas aparecerán aquí cuando marques las llegadas de las series.</div>`;
      // eventos
      $$("select[data-s]", app).forEach((sel) => (sel.onchange = () => {
        const si = +sel.dataset.s, ci = +sel.dataset.c, nuevo = sel.value || null, viejo = series[si][ci];
        if (nuevo) series.forEach((f, a) => f.forEach((id, b) => { if (id === nuevo) series[a][b] = viejo; }));
        series[si][ci] = nuevo;
        orden = orden.map((o, a) => o.filter((id) => series[a].includes(id)));
        final = final.filter((id) => finalistas().includes(id)); sucio = true; pintar();
      }));
      $$("[data-ll]", app).forEach((b) => (b.onclick = () => {
        const si = +b.dataset.ll, id = b.dataset.id; const o = orden[si];
        if (o.includes(id)) orden[si] = o.filter((x) => x !== id); else o.push(id);
        final = final.filter((x) => finalistas().includes(x)); sucio = true; pintar();
      }));
      $$("[data-f]", app).forEach((b) => (b.onclick = () => { const id = b.dataset.f; final = final.includes(id) ? final.filter((x) => x !== id) : [...final, id]; sucio = true; pintar(); }));
      const vs = valores().filter((v) => v.datos.fase !== "pendiente");
      $("[data-resultado]", app).innerHTML = tablaResultadoGym(sp, vs, "Resultado");
      const enSeries = series.flat().filter(Boolean).length;
      $("[data-estado]", app).textContent = `${series.length} serie${series.length === 1 ? "" : "s"} · ${enSeries} delegaciones · final ${final.length}/${finalistas().length}${sucio ? " · cambios sin guardar" : ""}`;
    };
    pintar();
    $("[data-sorteo]", app).onclick = async () => {
      if ((orden.some((o) => o.length) || final.length) && !(await confirmar("¿Sortear de nuevo?", "Se borrarán las llegadas marcadas en esta pantalla (lo ya guardado no cambia hasta que vuelvas a guardar).", { boton: "Sortear" }))) return;
      const ids = ds.map((d) => d.id); for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
      armar(ids); sucio = true; pintar();
    };
    $("[data-reiniciar-final]", app).onclick = () => { final = []; sucio = true; pintar(); };
    $("[data-guardar]", app).onclick = async (e) => {
      const pend = valores().filter((v) => v.datos.fase === "pendiente");
      if (pend.length) return aviso(`Faltan llegadas en la serie ${pend[0].datos.serie}. Marca ${sp.clasifican === 1 ? "a la ganadora" : `a las ${sp.clasifican} primeras`} de cada serie.`, "error");
      const vs = valores(); if (!vs.length) return aviso("Coloca delegaciones en las series.", "error");
      if (await guardarVarios(c, sp, vs.map((v) => ({ did: v.id, datos: v.datos })), e.currentTarget)) { sucio = false; pintar(); }
    };
  }

  inicio();
}

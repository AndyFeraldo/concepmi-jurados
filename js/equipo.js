// =========================================================
// Vista del EQUIPO concursante: llena su entregable en línea.
// Se guarda solo (y una copia en este navegador por si falla internet);
// al final lo envía. Después de la hora límite ya no se puede editar.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611031255";
import { ENTREGABLES, TIPOS, ESTRATEGIAS, NIVELES, filaVacia, conIds, nivel, faltantes, filaUsada } from "./entregables.js?v=202611031255";
import { normalizarActa, limpiarActa, editorActa, enlazarActa, resumenActa } from "./acta.js?v=202611031255";
import { porId } from "./concursos.js?v=202611031255";
import { $, $$, esc, I, IMG, aviso, confirmar, lanzarConfeti } from "./ui.js?v=202611031255";
import { salir } from "./app.js?v=202611031255";

const GRACIA_MS = 60000; // 1 minuto de gracia, igual que el servidor

export async function vistaEquipo(app, codigo) {
  const CLAVE = `concepmi-entrega-${String(codigo).toUpperCase()}`;
  let data = null, datos = null, desfase = 0, guardando = false, pendiente = false, estadoGuardado = "", tic = null, sondeo = null, temporizador = null;

  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo tu entregable…</div>`;
  try { await cargar(); }
  catch (e) { aviso(e.message, "error"); return salir(); }

  async function cargar() {
    const t0 = Date.now();
    data = await api.equipoDatos(codigo);
    desfase = Date.parse(data.tiempo.ahora) - (t0 + Date.now()) / 2;
    const def = ENTREGABLES[data.entrega.concurso_id];
    const servidor = data.entrega.datos || {};
    let local = null; try { local = JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch { /* sin almacenamiento */ }
    // Si en este navegador quedó algo más nuevo sin guardar (se cayó internet), se recupera
    const usarLocal = local && data.entrega.estado !== "enviado" && (!data.entrega.actualizado || local.t > Date.parse(data.entrega.actualizado));
    datos = structuredClone(usarLocal ? local.datos : servidor);
    if (def?.tipo === "acta") datos = normalizarActa(datos);
    else { datos.filas ||= []; while (datos.filas.length < (def?.filasIniciales || 8)) datos.filas.push(filaVacia()); }
    if (usarLocal) { pendiente = true; setTimeout(guardar, 300); }
  }
  const ahora = () => Date.now() + desfase;
  const def = () => ENTREGABLES[data.entrega.concurso_id];
  const enviado = () => data.entrega.estado === "enviado";
  const fin = () => (data.tiempo.fin ? Date.parse(data.tiempo.fin) : null);
  const bloqueado = () => enviado() || (fin() != null && ahora() > fin() + GRACIA_MS);

  function guardarLocal() { try { localStorage.setItem(CLAVE, JSON.stringify({ t: Date.now(), datos })); } catch { /* sin almacenamiento */ } }
  function marcarCambio() {
    guardarLocal(); pendiente = true; pintarEstado("Cambios sin guardar…");
    clearTimeout(temporizador); temporizador = setTimeout(guardar, 1200);
  }
  async function guardar() {
    if (!pendiente || guardando || bloqueado()) return;
    guardando = true; pendiente = false; pintarEstado("Guardando…");
    try {
      const r = await api.equipoGuardar(codigo, limpio());
      data.entrega.actualizado = r.actualizado;
      pintarEstado(`✓ Guardado a las ${new Date().toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}`, "ok");
    } catch (e) {
      pendiente = true;
      pintarEstado(/conectar|fetch|network/i.test(e.message) ? "Sin conexión: tus cambios están a salvo en esta laptop y se guardarán al volver internet" : e.message, "error");
      if (/tiempo|envi/i.test(e.message)) { await refrescar(); pintar(); }
      else setTimeout(guardar, 4000);
    } finally { guardando = false; if (pendiente) { clearTimeout(temporizador); temporizador = setTimeout(guardar, 1500); } }
  }
  const esActa = () => def()?.tipo === "acta";
  const nom = () => def()?.nombre || "entregable"; // «matriz», «acta»
  const Nom = () => nom()[0].toUpperCase() + nom().slice(1);
  const limpio = () => (esActa() ? limpiarActa(datos) : { lider: datos.lider || "", filas: datos.filas.map((f) => ({ ...filaVacia(), ...f })) });
  function pintarEstado(t, tipo = "") { const el = $("[data-guardado]", app); if (el) { el.textContent = t; el.className = `eq-guardado eq-guardado--${tipo}`; } estadoGuardado = t; }

  async function refrescar() {
    try { const t0 = Date.now(); const d = await api.equipoDatos(codigo); desfase = Date.parse(d.tiempo.ahora) - (t0 + Date.now()) / 2; const cambioEstado = d.entrega.estado !== data.entrega.estado;
      const vaciada = !Object.keys(d.entrega.datos || {}).length && d.entrega.actualizado && d.entrega.actualizado !== data.entrega.actualizado && !pendiente && !guardando;
      if (vaciada) { try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } data.entrega.actualizado = d.entrega.actualizado; datos = structuredClone(d.entrega.datos); if (esActa()) datos = normalizarActa(datos); else { datos.filas = []; while (datos.filas.length < (def()?.filasIniciales || 8)) datos.filas.push(filaVacia()); } }
      data.tiempo = d.tiempo; data.entrega.estado = d.entrega.estado; data.entrega.enviado = d.entrega.enviado; data.entrega.tarde = d.entrega.tarde;
      if (cambioEstado || vaciada) { if (d.entrega.estado === "borrador") { datos = structuredClone(d.entrega.datos); if (esActa()) datos = normalizarActa(datos); else { datos.filas ||= []; while (datos.filas.length < (def()?.filasIniciales || 8)) datos.filas.push(filaVacia()); } } pintar(); }
    } catch { /* se reintenta */ }
  }

  // ---------------- Pantalla ----------------
  function pintar() {
    const c = porId(data.entrega.concurso_id), d = def(), bl = bloqueado();
    const filas = esActa() ? [] : conIds(datos.filas);
    app.innerHTML = `<div class="fondo fondo--sobrio"></div>
    <header class="barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI"><span class="sep"></span>
      <div><div class="barra__titulo">${esc(c?.nombre || "Concurso")}</div><div class="barra__sub">${esc(data.delegacion?.nombre || "")}</div></div>
      <div class="der"><span class="eq-reloj" data-reloj></span><button class="btn btn--mini" data-salir>${I.salir}<span>Salir</span></button></div>
    </header>
    <main class="contenedor eq">
      <div class="cabeza" style="margin-top:0"><div><h1>${esc(d?.titulo || "Entregable")}</h1>
        <p>${esc(data.delegacion?.siglas ? `${data.delegacion.siglas} · ${data.delegacion.nombre}` : data.delegacion?.nombre || "")}${data.entrega.nombre ? ` · ${esc(data.entrega.nombre)}` : ""}</p></div>
        <span class="eq-guardado" data-guardado>${esc(estadoGuardado)}</span></div>
      ${enviado() ? `<div class="cerrado" style="background:rgba(59,224,143,.12);border-color:rgba(59,224,143,.5);color:#8FF2C0">${I.check}<span><b>¡${Nom()} enviada${data.entrega.tarde ? " fuera de tiempo" : ""}!</b> a las ${new Date(data.entrega.enviado).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" })}. Los jurados ya la pueden ver. Si necesitas corregir algo, pide al organizador que la reabra.</span></div>`
        : bl ? `<div class="cerrado">${I.candado}<span><b>Se acabó el tiempo.</b> Ya no se pueden hacer cambios. Envía tu ${nom()} ahora; si la envías tarde se registra como entrega tardía.</span></div>` : ""}
      <div class="eq-aviso">⚠️ Usen <b>una sola laptop</b> por equipo. Todo se guarda solo cada pocos segundos.</div>
      <section class="tarjeta eq-cab">
        <label class="campo"><span>Delegación</span><input value="${esc(data.delegacion?.nombre || "")}" disabled></label>
        <label class="campo"><span>Líder de equipo</span><input data-lider maxlength="120" value="${esc(datos.lider || "")}" placeholder="Nombre y apellido" ${bl ? "disabled" : ""}></label>
      </section>
      ${esActa() ? `<details class="eq-guia" open><summary>${I.info} Guía rápida (cómo llenar el acta)</summary>
        <p>${esc(d?.ayuda || "")}</p>
        <p>Cada sección muestra si está <b>Completa</b>, <b>Incompleta</b> o <b>Sin llenar</b>. Usen <b>Agregar</b> para sumar filas en las tablas.</p>
      </details>${editorActa(datos, bl)}` : `<details class="eq-guia"><summary>${I.info} Guía rápida (cómo llenar la matriz)</summary>
        <p>${esc(d?.ayuda || "")}</p>
        <p><b>Estrategias</b> · Amenazas: ${ESTRATEGIAS.Amenaza.join(", ")} · Oportunidades: ${ESTRATEGIAS.Oportunidad.join(", ")}.</p>
        <p><b>Niveles de severidad:</b> ${NIVELES.map(([n, a, b, cl]) => `<span class="sev ${cl}">${n} ${a}–${b}</span>`).join(" ")}</p>
        <p>El <b>ID</b> (A1, A2… / O1, O2…) y la <b>severidad</b> se calculan solos.</p>
      </details>
      <div class="eq-filas">${filas.map((f, i) => fila(f, i, bl)).join("")}</div>
      ${bl ? "" : `<button class="btn" data-mas style="margin-top:10px" ${datos.filas.length >= (d?.maxFilas || 20) ? "disabled" : ""}>${I.mas}Agregar riesgo</button>`}`}
      <div class="enviar">
        <div class="enviar__info"><span data-resumen></span></div>
        <button class="btn btn--naranja" data-enviar ${enviado() ? "disabled" : ""}>${I.check}${enviado() ? `${Nom()} enviada` : `Enviar ${nom()} al jurado`}</button>
      </div>
    </main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $("[data-salir]", app).onclick = async () => { if (pendiente) await guardar(); limpiarTimers(); salir(); };
    const lid = $("[data-lider]", app); if (lid) lid.oninput = () => { datos.lider = lid.value; marcarCambio(); };
    if (esActa()) enlazarActa($(".acta-ed", app), datos, { bl, cambio: () => { marcarCambio(); resumen(); }, repintar: (sel) => { pintar(); $(sel, app)?.scrollIntoView({ block: "center" }); } });
    $$("[data-f]", app).forEach((el) => {
      const ev = el.tagName === "SELECT" ? "onchange" : "oninput";
      el[ev] = () => {
        const i = Number(el.dataset.i), k = el.dataset.f; datos.filas[i][k] = el.value;
        if (k === "tipo") { if (!(ESTRATEGIAS[el.value] || []).includes(datos.filas[i].estrategia)) datos.filas[i].estrategia = ""; marcarCambio(); repintarFila(i); return; }
        if (k === "p" || k === "i") { marcarCambio(); actualizarSev(i); return; }
        marcarCambio(); resumen();
      };
    });
    $$("[data-quitar]", app).forEach((b) => (b.onclick = async () => {
      const i = Number(b.dataset.quitar);
      if (filaUsada(datos.filas[i]) && !(await confirmar("¿Quitar este riesgo?", "Se borrará lo escrito en esta fila.", { boton: "Quitar", peligro: true }))) return;
      datos.filas.splice(i, 1); if (!datos.filas.length) datos.filas.push(filaVacia()); marcarCambio(); pintar();
    }));
    $("[data-mas]", app)?.addEventListener("click", () => { datos.filas.push(filaVacia()); marcarCambio(); pintar(); $$(".eq-fila", app).at(-1)?.scrollIntoView({ behavior: "smooth", block: "center" }); });
    $("[data-enviar]", app).onclick = enviar;
    resumen(); reloj(); pintarEstado(estadoGuardado);
  }

  function fila(f, i, bl) {
    const n = nivel(f.sev), dis = bl ? "disabled" : "";
    const opt = (lista, val, ph) => `<option value="">${ph}</option>${lista.map((x) => `<option ${String(x) === String(val) ? "selected" : ""}>${x}</option>`).join("")}`;
    return `<article class="tarjeta eq-fila" data-fila="${i}">
      <div class="eq-fila__cab">
        <b class="matriz-id ${f.tipo === "Oportunidad" ? "matriz-id--o" : ""}">${esc(f.id)}</b>
        <label class="campo"><span>Tipo</span><select data-f="tipo" data-i="${i}" ${dis}>${opt(TIPOS, f.tipo, "Elige…")}</select></label>
        <label class="campo eq-num"><span>P (1–5)</span><select data-f="p" data-i="${i}" ${dis}>${opt([1, 2, 3, 4, 5], f.p, "—")}</select></label>
        <label class="campo eq-num"><span>I (1–5)</span><select data-f="i" data-i="${i}" ${dis}>${opt([1, 2, 3, 4, 5], f.i, "—")}</select></label>
        <div class="eq-sev" data-sev="${i}">${f.sev == null ? `<small>Severidad</small><b>—</b>` : `<small>Severidad P × I</small><span class="sev ${n?.[3] || ""}"><b>${f.sev}</b> ${n?.[0] || ""}</span>`}</div>
        ${bl ? "" : `<button class="btn btn--mini btn--icono btn--peligro" data-quitar="${i}" title="Quitar riesgo" aria-label="Quitar riesgo ${esc(f.id)}">${I.basura}</button>`}
      </div>
      <label class="campo"><span>Riesgo · Causa, Evento y Efecto</span><textarea data-f="riesgo" data-i="${i}" rows="2" maxlength="1200" ${dis} placeholder="Debido a [causa], podría ocurrir [evento], lo que ocasionaría [efecto]">${esc(f.riesgo)}</textarea></label>
      <div class="eq-grid">
        <label class="campo"><span>Estrategia de respuesta</span><select data-f="estrategia" data-i="${i}" ${dis || (f.tipo ? "" : "disabled")}>${opt(ESTRATEGIAS[f.tipo] || [], f.estrategia, f.tipo ? "Elige…" : "Primero elige el tipo")}</select></label>
        <label class="campo"><span>Dueño del riesgo (rol o cargo)</span><input data-f="dueno" data-i="${i}" maxlength="200" value="${esc(f.dueno)}" ${dis} placeholder="Ej. Gerente de proyecto"></label>
      </div>
      <label class="campo"><span>Plan de mitigación / Acción concreta</span><textarea data-f="plan" data-i="${i}" rows="2" maxlength="1500" ${dis}>${esc(f.plan)}</textarea></label>
      <label class="campo"><span>Disparador (trigger) · evento o condición</span><textarea data-f="trigger" data-i="${i}" rows="2" maxlength="800" ${dis}>${esc(f.trigger)}</textarea></label>
    </article>`;
  }
  function repintarFila(i) {
    // al cambiar el tipo cambian el ID de todas las filas y las estrategias de esta
    const foco = document.activeElement?.dataset?.f; pintar();
    const el = $(`[data-f="${foco || "tipo"}"][data-i="${i}"]`, app); el?.focus();
  }
  function actualizarSev(i) {
    const f = conIds(datos.filas)[i], n = nivel(f.sev), el = $(`[data-sev="${i}"]`, app);
    if (el) el.innerHTML = f.sev == null ? `<small>Severidad</small><b>—</b>` : `<small>Severidad P × I</small><span class="sev ${n?.[3] || ""}"><b>${f.sev}</b> ${n?.[0] || ""}</span>`;
    resumen();
  }
  function resumen() {
    if (esActa()) {
      const r = resumenActa(datos), el = $("[data-resumen]", app);
      if (el) el.innerHTML = `${r.completas} de ${r.total} secciones completas${r.firmas < 2 ? ` · <b style="color:#FFD98A">faltan ${2 - r.firmas} firma${2 - r.firmas === 1 ? "" : "s"}</b>` : " · firmas listas"}`;
      return;
    }
    const usadas = datos.filas.filter(filaUsada), inc = usadas.filter((f) => faltantes(f).length).length;
    const el = $("[data-resumen]", app);
    if (el) el.innerHTML = `${usadas.length} riesgo${usadas.length === 1 ? "" : "s"} · ${usadas.filter((f) => f.tipo === "Amenaza").length} amenazas · ${usadas.filter((f) => f.tipo === "Oportunidad").length} oportunidades${inc ? ` · <b style="color:#FFD98A">${inc} incompleto${inc === 1 ? "" : "s"}</b>` : ""}`;
  }
  function reloj() {
    const el = $("[data-reloj]", app); if (!el) return;
    if (enviado()) { el.textContent = "Enviado"; el.className = "eq-reloj eq-reloj--ok"; return; }
    if (!fin()) { el.textContent = "El tiempo aún no inicia"; el.className = "eq-reloj"; return; }
    const s = Math.round((fin() - ahora()) / 1000);
    if (s <= 0) { el.textContent = "Tiempo terminado"; el.className = "eq-reloj eq-reloj--fin"; if (!bloqueado()) return; if (!$(".cerrado", app)) pintar(); return; }
    el.textContent = `⏱ ${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
    el.className = `eq-reloj ${s <= 300 ? "eq-reloj--fin" : ""}`;
  }

  async function enviar() {
    if (pendiente && !bloqueado()) await guardar();
    if (esActa()) {
      const r = resumenActa(datos);
      if (r.vacia) return aviso("Llenen el acta antes de enviarla", "error");
      const extra = r.faltan.length ? `<br><br>⚠️ Aún falta completar: <b>${r.faltan.map(esc).join(" · ")}</b>.` : "";
      if (!(await confirmar("¿Enviar el acta al jurado?", `Después de enviarla ya no podrán cambiarla.${extra}`, { boton: "Enviar acta" }))) return;
      return mandar();
    }
    const usadas = datos.filas.filter(filaUsada);
    const inc = usadas.filter((f) => faltantes(f).length);
    if (!usadas.length) return aviso("Escribe al menos un riesgo antes de enviar", "error");
    const extra = inc.length ? `<br><br>⚠️ Hay <b>${inc.length} riesgo${inc.length === 1 ? "" : "s"} incompleto${inc.length === 1 ? "" : "s"}</b> (${conIds(datos.filas).filter((f) => filaUsada(f) && faltantes(f).length).map((f) => `${f.id}: falta ${faltantes(f).join(", ")}`).join(" · ")}).` : "";
    if (!(await confirmar("¿Enviar la matriz al jurado?", `Después de enviarla ya no podrán cambiarla.${extra}`, { boton: "Enviar matriz" }))) return;
    return mandar();
  }
  async function mandar() {
    try {
      const r = await api.equipoEnviar(codigo, limpio());
      data.entrega.estado = "enviado"; data.entrega.enviado = r.enviado; data.entrega.tarde = r.tarde;
      try { localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
      lanzarConfeti(); aviso(r.tarde ? `${Nom()} enviada (fuera de tiempo)` : `¡${Nom()} enviada!`); pintar();
    } catch (e) { aviso(e.message, "error"); }
  }

  function limpiarTimers() { clearInterval(tic); clearInterval(sondeo); clearTimeout(temporizador); }
  pintar();
  tic = setInterval(() => { if (!document.body.contains($("[data-reloj]", app))) return limpiarTimers(); reloj(); }, 1000);
  sondeo = setInterval(refrescar, 10000);
  window.addEventListener("beforeunload", (e) => { if (pendiente && !bloqueado()) { guardarLocal(); e.preventDefault(); } });
  window.addEventListener("online", () => { if (pendiente) guardar(); });
}

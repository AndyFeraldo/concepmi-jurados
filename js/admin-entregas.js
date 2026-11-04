// =========================================================
// Admin / coordinador de sala · Entregas en línea (Amateur I: acta, Amateur II: matriz)
// Códigos de equipo, cronómetro oficial, estado en vivo, proyector,
// impresión y sanción por entrega tardía.
// =========================================================
import { api } from "./api.js?v=202611041659";
import { ENTREGABLES } from "./entregables.js?v=202611041659";
import { porId } from "./concursos.js?v=202611041659";
import { abrirVisor, imprimir, estadoEntrega, chipsEntrega, tieneDatos } from "./entrega-visor.js?v=202611041659";
import { abrirEscenario } from "./escenario.js?v=202611041659";
import { AREAS, PLANTILLAS, nivel } from "./permisos.js?v=202611041659";
import { abrirSalaProyectos } from "./sala-proyectos.js?v=202611041659";
import { panelPlazo, conectarPlazo, celdaArchivos, estadoPres, ordenarPorSorteo, abrirSorteo, descargarImagen, descargarZip, abrirArchivo, horaTurno, fechaLima } from "./presentacion.js?v=202611041659";
import { $, $$, esc, I, aviso, modal, confirmar, lanzarConfeti } from "./ui.js?v=202611041659";

const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

// ctx = { codigo(), data(), recargar(forzar), concursos?: [ids], coordinador?: true }
export function crearEntregas(ctx) {
  const lista = () => (ctx.concursos || Object.keys(ENTREGABLES)).filter((k) => ENTREGABLES[k]);
  const esAdmin = !ctx.coordinador;
  let concurso = lista()[0], E = null, P = null, coords = null, desfase = 0, temporizador = null, reloj = null;
  const del = (id) => ctx.data().delegaciones.find((d) => d.id === id);
  const nomDel = (id) => { const d = del(id); return d ? (d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre) : "Delegación eliminada"; };
  const ahora = () => Date.now() + desfase;

  async function cargar() {
    const t0 = Date.now();
    E = await api.adminEntregas(ctx.codigo(), concurso);
    P = ENTREGABLES[concurso]?.tipo === "presentacion" ? await api.adminPresentaciones(ctx.codigo(), concurso) : null;
    desfase = Date.parse(E.tiempo.ahora) - (t0 + Date.now()) / 2;
  }

  async function vista(v) {
    clearInterval(temporizador); clearInterval(reloj);
    if (!E) { v.innerHTML = `<div class="cargando" style="min-height:30vh"><div class="giro"></div>Cargando entregas…</div>`; try { await cargar(); } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`; return; } }
    pintar(v);
    // En vivo: se actualiza cada 4 s mientras esta pestaña está abierta
    temporizador = setInterval(async () => {
      if (!document.body.contains(v) || !$("[data-entregas]", v)) { clearInterval(temporizador); clearInterval(reloj); return; }
      if (document.hidden || document.querySelector(".velo, .proy, .escenario")) return;
      try { const firma = () => JSON.stringify(E.equipos.map((x) => [x.entrega.actualizado, x.entrega.estado])) + E.tiempo.fin + JSON.stringify(P?.equipos || "") + JSON.stringify(P?.config ? { ...P.config, ahora: 0 } : ""); const antes = firma(); await cargar(); if (antes !== firma()) pintar(v); } catch { /* se reintenta */ }
    }, 4000);
    reloj = setInterval(() => pintarReloj(v), 1000);
  }

  function pintarReloj(v) {
    const el = $("[data-cronometro]", v); if (!el || !E) return;
    const fin = E.tiempo.fin ? Date.parse(E.tiempo.fin) : null;
    if (!fin) { el.innerHTML = `<b>—:—</b><small>El tiempo no ha iniciado</small>`; el.className = "en-crono"; return; }
    const s = Math.round((fin - ahora()) / 1000);
    el.innerHTML = s > 0 ? `<b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</b><small>termina a las ${hora(E.tiempo.fin)}</small>` : `<b>0:00</b><small>Terminó a las ${hora(E.tiempo.fin)}</small>`;
    el.className = `en-crono ${s <= 0 ? "en-crono--fin" : s <= 300 ? "en-crono--alerta" : ""}`;
  }

  // Pestañas de concurso (Proyectos, IATHON, Amateur I, Amateur II…)
  const selectorConcurso = () => lista().length > 1
    ? `<div class="pestanas pestanas--sub" role="tablist" aria-label="Concurso">${lista().map((k) => `<button class="pestana" role="tab" data-concurso="${k}" aria-selected="${k === concurso}">${esc(porId(k)?.nombre.replace("Concurso Nacional de ", "") || k)}<small>${esc(ENTREGABLES[k].corto)}</small></button>`).join("")}</div>`
    : `<span class="chip chip--celeste">${esc(porId(concurso)?.nombre || concurso)}</span>`;
  const conectarSelector = (v) => $$("[data-concurso]", v).forEach((b) => (b.onclick = () => { if (b.dataset.concurso === concurso) return; concurso = b.dataset.concurso; E = null; P = null; vista(v); }));

  function pintar(v) {
    const def = ENTREGABLES[concurso], c = porId(concurso), pl = def.plural, Pl = pl[0].toUpperCase() + pl.slice(1), nm = def.nombre;
    if (def.tipo === "presentacion") return pintarPres(v);
    const eqs = E.equipos, enviados = eqs.filter((x) => x.entrega.estado === "enviado").length;
    const sinEquipo = ctx.data().delegaciones.filter((d) => !eqs.some((x) => x.entrega.delegacion_id === d.id));
    const ajuste = (did) => ctx.data().ajustes.find((a) => a.concurso_id === concurso && a.delegacion_id === did) || {};
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Entregas en línea</h1><p>Cada equipo entra con su código por el botón <b>Equipo</b> de la portada, llena su ${esc(def.corto.toLowerCase())} y la envía. Tú y los jurados la ven en vivo y la puedes proyectar.</p></div>
        </div>${selectorConcurso()}
      <div class="en-top">
        <section class="tarjeta en-panel">
          <h3>Tiempo oficial de llenado</h3>
          <div class="en-crono" data-cronometro></div>
          <div class="en-acc">
            <label class="campo" style="max-width:120px"><span>Minutos</span><input data-min inputmode="numeric" value="${def.minutos}"></label>
            <button class="btn btn--naranja" data-iniciar>${I.flecha}${E.tiempo.fin ? "Reiniciar tiempo" : "Iniciar tiempo"}</button>
            ${E.tiempo.fin ? `<button class="btn" data-mas5>+5 min</button><button class="btn btn--peligro" data-detener>Terminar ahora</button><button class="btn" data-quitar>Quitar tiempo</button>` : ""}
          </div>
          <p class="ayuda">Al terminar el tiempo (más 1 minuto de gracia) los equipos ya no pueden editar. Si envían después, queda marcado como <b>entrega tardía</b>.</p>
        </section>
        <section class="tarjeta en-panel">
          <h3>Avance</h3>
          <div class="kpis" style="margin:0"><div class="kpi"><b>${enviados}/${eqs.length}</b><span>${Pl} enviadas</span></div><div class="kpi"><b>${eqs.filter((x) => x.entrega.estado !== "enviado" && x.entrega.actualizado && tieneDatos(x.entrega)).length}</b><span>En borrador</span></div></div>
          <div class="en-proyectar">
            <div class="en-opcion"><button class="btn btn--naranja" data-escenario>${I.pizarra}Proyectar pantalla del concurso</button>
              <p><b>Para todo el concurso, en la laptop del proyector.</b> Mientras llenan: título y cronómetro oficial. En las exposiciones: la ${nm} de la delegación que expone con su cronómetro de 2 min (empieza solo cuando pulsas <b>Iniciar</b>). Los botones aparecen al mover el mouse.</p></div>
            <div class="en-opcion"><button class="btn" data-proyectar ${eqs.length ? "" : "disabled"}>${I.vivo}Ver ${pl}</button>
              <p><b>Solo para revisar.</b> Muestra la ${nm} de cada delegación en grande, sin cronómetro. Cámbiala con ◀ ▶.</p></div>
          </div>
          <div class="en-acc"><button class="btn btn--mini" data-imprimir ${eqs.length ? "" : "disabled"}>${I.descargar}Imprimir reportes / PDF</button>
            <span class="ayuda" style="margin:0">Una hoja por delegación con su ${nm}, lo que puso cada jurado y el puntaje final. Para enviar a los delegados.</span></div>
        </section>
      </div>
      <div class="cabeza"><div><h1 style="font-size:1.4rem">Equipos y códigos</h1><p>Un equipo por delegación. Entrega a cada equipo su código el día del concurso.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${sinEquipo.length ? `<button class="btn" data-todos>${I.mas}Crear equipos para las ${sinEquipo.length} delegaciones sin equipo</button>` : ""}<button class="btn btn--naranja" data-nuevo>${I.mas}Nuevo equipo</button></div></div>
      <div class="tabla-envoltura" data-entregas><table class="tabla"><thead><tr><th>Delegación</th><th>Código</th><th>Estado</th><th>Contenido</th><th>Última actividad</th><th></th></tr></thead><tbody>
        ${eqs.map((x) => { const e = x.entrega, [t, cl] = estadoEntrega(e), aj = ajuste(e.delegacion_id);
          return `<tr><td><b>${esc(nomDel(e.delegacion_id))}</b>${(e.datos?.lider || e.lider) ? `<br><small class="tenue">Líder: ${esc(e.datos?.lider || e.lider)}</small>` : ""}${e.nombre ? `<br><small class="tenue">${esc(e.nombre)}</small>` : ""}</td>
            <td><code class="en-codigo">${esc(x.codigo)}</code> <button class="btn btn--mini btn--icono" data-copiar="${esc(x.codigo)}" title="Copiar código" aria-label="Copiar código">${I.copiar}</button></td>
            <td><span class="chip ${cl}">${t}</span>${e.tarde ? `<br>${aj.retraso ? `<small class="chip chip--rojo log-tag">−10 % aplicado</small>` : esAdmin ? `<button class="btn btn--mini btn--peligro" data-sancion="${e.delegacion_id}">Aplicar −10 % por retraso</button>` : `<small class="tenue">El admin aplica el −10 %</small>`}` : ""}</td>
            <td><div class="reparto" style="margin:0">${chipsEntrega(concurso, e.datos)}</div></td>
            <td class="tenue" style="white-space:nowrap">${e.enviado ? `enviado ${hora(e.enviado)}` : e.actualizado && tieneDatos(e) ? `guardado ${hora(e.actualizado)}` : "—"}</td>
            <td style="white-space:nowrap"><button class="btn btn--mini" data-ver="${e.equipo_id}">${I.vivo}Ver</button>
              ${e.estado === "enviado" ? `<button class="btn btn--mini" data-reabrir="${e.equipo_id}" title="Permitir que el equipo vuelva a editar">${I.abierto}Reabrir</button>` : ""}
              ${tieneDatos(e) || e.estado === "enviado" ? `<button class="btn btn--mini btn--peligro" data-vaciar="${e.equipo_id}" title="Borrar lo que escribió este equipo">${I.basura}Borrar respuesta</button>` : ""}
              <button class="btn btn--mini btn--icono" data-editar="${x.id}" title="Editar equipo" aria-label="Editar equipo">${I.lapiz}</button></td></tr>`; }).join("") || `<tr><td colspan="6"><div class="vacio"><b>Aún no hay equipos</b>Usa «Crear equipos para las delegaciones» o «Nuevo equipo».</div></td></tr>`}
      </tbody></table></div>
      ${esAdmin ? `<div class="cabeza"><div><h1 style="font-size:1.4rem">Accesos limitados</h1><p>Personas de confianza con <b>su propio código</b> que entran por el botón <b>Admin</b> de la portada. Tú eliges, pestaña por pestaña, si <b>no la ve</b>, <b>solo la ve</b> o <b>puede editarla</b>, y de qué concursos maneja las Entregas. Ejemplos: coordinador de sala, líder de logística, relaciones públicas (ve jurados, talleristas y charlas).</p></div>
        <button class="btn btn--naranja" data-coord-nuevo>${I.mas}Nuevo acceso</button></div>
      <div data-coords>${pintarCoords()}</div>` : ""}`;
    pintarReloj(v);
    if (esAdmin && !coords) cargarCoords(v);
    const accion = async (a, min) => { try { await api.adminTiempo(ctx.codigo(), concurso, a, min); await cargar(); pintar(v); aviso(a === "iniciar" ? "¡Tiempo iniciado!" : a === "extender" ? "+5 minutos" : a === "detener" ? "Tiempo terminado" : "Tiempo quitado"); } catch (e) { aviso(e.message, "error"); } };
    conectarSelector(v);
    $("[data-iniciar]", v).onclick = async () => {
      const min = Math.max(1, Math.min(240, Number($("[data-min]", v).value) || def.minutos));
      if (E.tiempo.fin && !(await confirmar("¿Reiniciar el tiempo?", `El cronómetro vuelve a empezar con ${min} minutos para todos los equipos.`, { boton: "Reiniciar" }))) return;
      accion("iniciar", min);
    };
    $("[data-mas5]", v)?.addEventListener("click", () => accion("extender", 5));
    $("[data-detener]", v)?.addEventListener("click", async () => { if (await confirmar("¿Terminar el tiempo ahora?", "Los equipos tendrán 1 minuto de gracia y luego ya no podrán editar.", { boton: "Terminar ahora", peligro: true })) accion("detener"); });
    $("[data-quitar]", v)?.addEventListener("click", async () => { if (await confirmar("¿Quitar el tiempo?", "El cronómetro desaparece y los equipos podrán editar sin límite (útil para pruebas).", { boton: "Quitar tiempo" })) accion("reiniciar"); });
    const cargarVisor = async () => { const r = await api.adminEntregas(ctx.codigo(), concurso); return { tiempo: r.tiempo, entregas: r.equipos.map((x) => x.entrega) }; };
    const nombreE = (e) => nomDel(e.delegacion_id);
    // Calificaciones frescas para el reporte (si falla la recarga, usa las que ya tiene)
    const notas = async () => { try { await ctx.recargar(true); } catch { /* usa lo cargado */ } return ctx.data(); };
    $("[data-proyectar]", v).onclick = () => abrirVisor({ concurso, cargar: cargarVisor, nombre: nombreE, notas });
    $$("[data-ver]", v).forEach((b) => (b.onclick = () => abrirVisor({ concurso, cargar: cargarVisor, nombre: nombreE, inicial: b.dataset.ver, notas })));
    $("[data-imprimir]", v).onclick = async () => { const d = await notas(); imprimir(concurso, E.equipos.map((x) => x.entrega), nombreE, { notas: d }); };
    $("[data-escenario]", v).onclick = () => abrirEscenario({ concurso, cargar: cargarVisor, nombre: nombreE,
      accion: (a, min) => api.adminTiempo(ctx.codigo(), concurso, a, min),
      alCerrar: async () => { try { await cargar(); pintar(v); } catch { /* sigue */ } } });
    $$("[data-copiar]", v).forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copiar); aviso("Código copiado"); } catch { aviso(`Código: ${b.dataset.copiar}`); } }));
    $$("[data-reabrir]", v).forEach((b) => (b.onclick = async () => {
      if (!(await confirmar(`¿Reabrir esta ${nm}?`, "El equipo podrá volver a editarla y tendrá que enviarla otra vez.", { boton: "Reabrir" }))) return;
      try { await api.adminEntregaReabrir(ctx.codigo(), b.dataset.reabrir); await cargar(); pintar(v); aviso(`${nm[0].toUpperCase() + nm.slice(1)} reabierta`); } catch (e) { aviso(e.message, "error"); }
    }));
    $$("[data-vaciar]", v).forEach((b) => (b.onclick = () => borrarRespuesta(E.equipos.find((x) => x.entrega.equipo_id === b.dataset.vaciar), v)));
    $$("[data-sancion]", v).forEach((b) => (b.onclick = async () => {
      const did = b.dataset.sancion, a = ajuste(did);
      if (!(await confirmar("¿Aplicar sanción por retraso?", `Se descuenta el <b>10 %</b> de la fase escrita a <b>${esc(nomDel(did))}</b>, según las bases. Puedes quitarla desde Resultados.`, { boton: "Aplicar −10 %", peligro: true }))) return;
      try { await api.adminAjuste(ctx.codigo(), concurso, did, { ...a, retraso: true }); await ctx.recargar(true); pintar(v); aviso("Sanción aplicada"); } catch (e) { aviso(e.message, "error"); }
    }));
    $("[data-nuevo]", v).onclick = () => formEquipo(null, v);
    enlazarCoords(v);
    $$("[data-editar]", v).forEach((b) => (b.onclick = () => formEquipo(E.equipos.find((x) => x.id === b.dataset.editar), v)));
    $("[data-todos]", v)?.addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      let n = 0;
      for (const d of sinEquipo) { try { await api.adminEquipo(ctx.codigo(), { concurso, delegacion: d.id }); n++; } catch (ex) { aviso(`${d.nombre}: ${ex.message}`, "error"); } }
      await cargar(); pintar(v); lanzarConfeti(); aviso(`${n} equipos creados con su código`);
    });
  }

  // ---------------- Concurso de Proyectos: presentaciones (PPT + PDF), sorteo y ZIP ----------------
  function pintarPres(v) {
    const def = ENTREGABLES[concurso], c = porId(concurso), cfg = P.config;
    const presDe = (eid) => P.equipos.find((x) => x.id === eid)?.pres || null;
    const eqs = ordenarPorSorteo(E.equipos, cfg.orden, (x) => x.entrega.delegacion_id);
    const sinEquipo = ctx.data().delegaciones.filter((d) => !E.equipos.some((x) => x.entrega.delegacion_id === d.id));
    const nPpt = eqs.filter((x) => presDe(x.id)?.ppt).length, nPdf = eqs.filter((x) => presDe(x.id)?.pdf).length;
    const turno = (did) => cfg.orden.indexOf(did);
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Entregas en línea</h1><p><b>${esc(c?.nombre || "")}</b>: cada equipo entra con su código por el botón <b>Equipo</b> y sube su <b>PowerPoint</b> y un <b>PDF de respaldo</b>. Los jurados del concurso los ven en sus laptops; tú los proyectas y los descargas todos en un ZIP numerado por el sorteo.</p></div></div>
      ${selectorConcurso()}
      <div class="en-top">
        ${panelPlazo(cfg)}
        <section class="tarjeta en-panel">
          <h3>Avance y sorteo</h3>
          <div class="kpis" style="margin:0"><div class="kpi"><b>${nPpt}/${eqs.length}</b><span>PowerPoint subidos</span></div><div class="kpi"><b>${nPdf}/${eqs.length}</b><span>PDF de respaldo</span></div>
            <div class="kpi"><b>${cfg.orden.length ? "✓" : "—"}</b><span>${cfg.orden.length ? `Sorteo ${fechaLima(cfg.sorteado)}` : "Orden sin sortear"}</span></div></div>
          <div class="en-proyectar">
            <div class="en-opcion"><button class="btn btn--naranja" data-sorteo ${eqs.length > 1 ? "" : "disabled"}>${I.girar}${cfg.orden.length ? "Ver / repetir sorteo" : "Sorteo del orden"}</button>
              <p><b>Un día antes del concurso.</b> Sortea el orden de exposición con animación, guárdalo y descarga la <b>imagen para WhatsApp</b>.</p></div>
            <div class="en-opcion"><button class="btn btn--naranja" data-escenario>${I.pizarra}Proyectar pantalla del concurso</button>
              <p><b>En la laptop del proyector.</b> Muestra el <b>PDF de cada delegación dentro de la pantalla</b> (sin botones de descarga) y se pasa con el <b>puntero</b>. Si subieron video, se reproduce solo en la diapositiva que indicaron. Cronómetro de <b>5 min de pitch + 3 min de preguntas</b> que empieza al pulsar <b>Iniciar</b>.</p></div>
          </div>
          <div class="en-acc">
            <button class="btn btn--mini" data-zip ${nPpt + nPdf ? "" : "disabled"}>${I.descargar}Descargar todas (ZIP)</button>
            ${cfg.orden.length ? `<button class="btn btn--mini" data-img-orden>${I.descargar}Imagen del orden (WhatsApp)</button>` : ""}
            <button class="btn btn--mini" data-imprimir ${eqs.length ? "" : "disabled"}>${I.descargar}Reportes de calificación / PDF</button>
          </div>
        </section>
      </div>
      <div class="cabeza"><div><h1 style="font-size:1.4rem">Equipos, códigos y archivos</h1><p>Un equipo por delegación (bases: de 2 a 5 integrantes). ${cfg.orden.length ? "Ordenados según el sorteo." : "Cuando sortees, se ordenan por turno."}</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${sinEquipo.length ? `<button class="btn" data-todos>${I.mas}Crear equipos para las ${sinEquipo.length} delegaciones sin equipo</button>` : ""}<button class="btn btn--naranja" data-nuevo>${I.mas}Nuevo equipo</button></div></div>
      <div class="tabla-envoltura" data-entregas><table class="tabla"><thead><tr><th class="num">Turno</th><th>Delegación</th><th>Código</th><th>Archivos</th><th>Estado</th><th></th></tr></thead><tbody>
        ${eqs.map((x) => { const e = x.entrega, pr = presDe(x.id), [t, cl] = estadoPres(pr), tu = turno(e.delegacion_id);
          return `<tr><td class="num">${tu >= 0 ? `<b class="pres-turno">${tu + 1}</b><br><small class="tenue">${horaTurno(tu)}</small>` : '<span class="tenue">—</span>'}</td>
            <td><b>${esc(nomDel(e.delegacion_id))}</b>${e.datos?.proyecto ? `<br><small>${I.copa} ${esc(e.datos.proyecto)}</small>` : ""}${e.datos?.lider ? `<br><small class="tenue">Líder: ${esc(e.datos.lider)}</small>` : ""}</td>
            <td><code class="en-codigo">${esc(x.codigo)}</code> <button class="btn btn--mini btn--icono" data-copiar="${esc(x.codigo)}" title="Copiar código" aria-label="Copiar código">${I.copiar}</button></td>
            <td>${celdaArchivos(pr, cfg.puede)}</td>
            <td><span class="chip ${cl}">${t}</span></td>
            <td><button class="btn btn--mini btn--icono" data-editar="${x.id}" title="Editar equipo" aria-label="Editar equipo">${I.lapiz}</button></td></tr>`; }).join("") || `<tr><td colspan="6"><div class="vacio"><b>Aún no hay equipos</b>Usa «Crear equipos para las delegaciones» o «Nuevo equipo».</div></td></tr>`}
      </tbody></table></div>
      ${esAdmin ? `<div class="cabeza"><div><h1 style="font-size:1.4rem">Accesos limitados</h1><p>Coordinadores de sala y líder de logística con su propio código (entran por el botón <b>Admin</b>).</p></div>
        <button class="btn btn--naranja" data-coord-nuevo>${I.mas}Nuevo acceso</button></div><div data-coords>${pintarCoords()}</div>` : ""}`;
    if (esAdmin && !coords) cargarCoords(v);
    conectarSelector(v); enlazarCoords(v);
    conectarPlazo(v, { codigo: ctx.codigo(), concurso, cfg, recargar: async () => { await cargar(); pintar(v); } });
    const nombreE = (e) => nomDel(e.delegacion_id);
    const abrir = (eq, tipo) => abrirArchivo(ctx.codigo(), eq, tipo);
    $$("[data-pres-ver]", v).forEach((b) => (b.onclick = () => abrir(b.dataset.eq, b.dataset.presVer)));
    $$("[data-copiar]", v).forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copiar); aviso("Código copiado"); } catch { aviso(`Código: ${b.dataset.copiar}`); } }));
    $("[data-nuevo]", v).onclick = () => formEquipo(null, v);
    $$("[data-editar]", v).forEach((b) => (b.onclick = () => formEquipo(E.equipos.find((x) => x.id === b.dataset.editar), v)));
    $("[data-todos]", v)?.addEventListener("click", async (ev) => {
      ev.currentTarget.disabled = true; let n = 0;
      for (const d of sinEquipo) { try { await api.adminEquipo(ctx.codigo(), { concurso, delegacion: d.id }); n++; } catch (ex) { aviso(`${d.nombre}: ${ex.message}`, "error"); } }
      await cargar(); pintar(v); lanzarConfeti(); aviso(`${n} equipos creados con su código`);
    });
    const delegs = () => E.equipos.map((x) => del(x.entrega.delegacion_id)).filter(Boolean);
    $("[data-sorteo]", v).onclick = () => abrirSorteo({ delegaciones: delegs(), previo: cfg.orden.filter((id) => delegs().some((d) => d.id === id)), concurso: c?.nombre,
      guardar: async (orden) => { await api.adminSorteo(ctx.codigo(), concurso, orden); await cargar(); pintar(v); } });
    $("[data-img-orden]", v)?.addEventListener("click", () => descargarImagen(cfg.orden.map((id, i) => ({ ...(del(id) || { nombre: "—" }), hora: horaTurno(i) })), { concurso: c?.nombre }));
    $("[data-zip]", v).onclick = () => descargarZip(eqs.map((x, i) => ({ pos: turno(x.entrega.delegacion_id) >= 0 ? turno(x.entrega.delegacion_id) + 1 : i + 1, delegacion: del(x.entrega.delegacion_id), pres: presDe(x.id) })),
      (eq, tipo) => api.presUrl(ctx.codigo(), eq, tipo, true));
    const notas = async () => { try { await ctx.recargar(true); } catch { /* usa lo cargado */ } return ctx.data(); };
    $("[data-imprimir]", v).onclick = async () => { const d = await notas(); imprimir(concurso, eqs.map((x) => x.entrega), nombreE, { notas: d }); };
    // Pantalla del concurso: proyecta el PDF de cada delegación dentro de la pantalla y se avanza con el puntero
    $("[data-escenario]", v).onclick = () => abrirSalaProyectos({ concurso: c?.nombre || "Concurso Nacional de Proyectos", minutos: def.cortos,
      equipos: eqs.map((x) => ({ equipo_id: x.id, delegacion: del(x.entrega.delegacion_id), proyecto: x.entrega.datos?.proyecto || "", lider: x.entrega.datos?.lider || "",
        videoDespues: x.entrega.datos?.videoDespues || "", pres: presDe(x.id) })),
      url: (eq, tipo) => api.presUrl(ctx.codigo(), eq, tipo), abrir,
      alCerrar: async () => { try { await cargar(); pintar(v); } catch { /* sigue */ } } });
  }

  // ---------------- Borrar la respuesta de un equipo (para pruebas) ----------------
  function borrarRespuesta(x, v) {
    if (!x) return;
    const e = x.entrega, def = ENTREGABLES[concurso], nm = def.nombre, [est] = estadoEntrega(e);
    const m = modal(`<h2>Borrar respuesta</h2>
      <div class="en-borrar">
        <div><small>Delegación</small><b>${esc(nomDel(e.delegacion_id))}</b></div>
        <div><small>Concurso</small><b>${esc(porId(concurso)?.nombre || concurso)} · ${esc(def.corto)}</b></div>
        <div><small>Estado actual</small><b>${esc(est)}${e.enviado ? ` (${hora(e.enviado)})` : ""}</b></div>
        <div class="reparto" style="margin:0">${chipsEntrega(concurso, e.datos)}</div>
      </div>
      <p>Se borra <b>todo lo que escribió este equipo</b> en su ${nm} y queda como <b>Sin empezar</b>. El equipo y su código <b>${esc(x.codigo)}</b> se mantienen, así que puede volver a llenarla. Esto no se puede deshacer.</p>
      <p class="ayuda">Si el equipo tiene su pantalla abierta, se pondrá en blanco sola en unos segundos.</p>
      <p class="error"></p>
      <div class="modal__acciones"><button class="btn" data-cancelar>Cancelar</button><button class="btn btn--peligro" data-si>${I.basura}Borrar respuesta</button></div>`);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-si]", m.el).onclick = async (ev) => {
      ev.currentTarget.disabled = true;
      try { await api.adminEntregaVaciar(ctx.codigo(), e.equipo_id); m.cerrar(); await cargar(); pintar(v); aviso(`Respuesta de ${nomDel(e.delegacion_id)} borrada`); }
      catch (ex) { $(".error", m.el).textContent = ex.message; ev.currentTarget.disabled = false; }
    };
  }

  // ---------------- Coordinadores de sala (solo admin) ----------------
  async function cargarCoords(v) {
    try { coords = await api.adminCoordinadores(ctx.codigo()); } catch (e) { coords = []; aviso(e.message, "error"); }
    const caja = $("[data-coords]", v); if (caja) { caja.innerHTML = pintarCoords(); enlazarCoords(v); }
  }
  function pintarCoords() {
    if (!coords) return `<div class="cargando" style="min-height:80px"><div class="giro"></div></div>`;
    if (!coords.length) return `<div class="vacio"><b>Aún no hay accesos limitados</b>Crea uno para un coordinador de sala, tu líder de logística o alguien de confianza que solo deba mirar.</div>`;
    const chips = (k) => [...AREAS.filter((a) => nivel(k, a.id)).map((a) => `<span class="chip ${nivel(k, a.id) === "editar" ? "chip--ambar" : "chip--celeste"}">${esc(a.txt)} · ${nivel(k, a.id) === "editar" ? "edita" : "ve"}</span>`),
      ...k.concursos.map((x) => `<span class="chip chip--ambar">Entregas · ${esc(porId(x)?.nombre || x)}</span>`)].join(" ") || `<span class="tenue">Nada asignado</span>`;
    return `<div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Nombre</th><th>Código</th><th>Permisos</th><th></th></tr></thead><tbody>
      ${coords.map((k) => `<tr><td><b>${esc(k.nombre)}</b></td><td style="white-space:nowrap"><code class="en-codigo">${esc(k.codigo)}</code> <button class="btn btn--mini btn--icono" data-copiar-coord="${esc(k.codigo)}" title="Copiar código" aria-label="Copiar código">${I.copiar}</button></td>
        <td><div class="reparto" style="margin:0">${chips(k)}</div></td>
        <td><button class="btn btn--mini btn--icono" data-coord-editar="${k.id}" title="Editar acceso" aria-label="Editar acceso">${I.lapiz}</button></td></tr>`).join("")}</tbody></table></div>
      <p class="ayuda" style="margin-top:8px"><b>Ve</b> = mira la pestaña sin poder cambiar nada (y sin ver códigos de jurados ni talleristas). <b>Edita</b> = puede crear, cambiar y borrar en esa pestaña.</p>`;
  }
  function enlazarCoords(v) {
    if (!esAdmin) return;
    const nuevo = $("[data-coord-nuevo]", v); if (nuevo) nuevo.onclick = () => formCoord(null, v);
    $$("[data-coord-editar]", v).forEach((b) => (b.onclick = () => formCoord(coords.find((k) => k.id === b.dataset.coordEditar), v)));
    $$("[data-copiar-coord]", v).forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copiarCoord); aviso("Código copiado"); } catch { aviso(`Código: ${b.dataset.copiarCoord}`); } }));
  }
  function formCoord(k, v) {
    const per = { ...(k?.permisos || {}) }; if (k?.logistica && !per.logistica) per.logistica = "editar";
    let sala = new Set(k?.concursos || []);
    const fila = (a) => `<div class="perm-fila" data-area="${a.id}">
        <div class="perm-fila__txt"><b>${esc(a.txt)}</b><small data-desc>${esc(per[a.id] === "editar" ? a.editar || a.ver : a.ver)}</small></div>
        <div class="segm perm-segm" role="radiogroup" aria-label="${esc(a.txt)}">
          <button type="button" data-nv="" class="${!per[a.id] ? "activo" : ""}">No ve</button>
          <button type="button" data-nv="ver" class="${per[a.id] === "ver" ? "activo" : ""}">Ve</button>
          ${a.editar ? `<button type="button" data-nv="editar" class="${per[a.id] === "editar" ? "activo" : ""}">Edita</button>` : ""}
        </div></div>`;
    const m = modal(`<h2>${k ? "Editar acceso" : "Nuevo acceso limitado"}</h2><form class="form">
      <label class="campo"><span>Nombre</span><input name="nombre" maxlength="120" required value="${esc(k?.nombre || "")}" placeholder="Ej. Coordinador de Relaciones Públicas"></label>
      <div class="campo"><span>Empezar desde una plantilla (opcional)</span><div class="reparto" style="margin:4px 0 0">${PLANTILLAS.map((t) => `<button type="button" class="btn btn--mini" data-plantilla="${t.id}" title="${esc(t.ayuda)}">${esc(t.txt)}</button>`).join("")}</div></div>
      <div class="campo"><span>Pestañas del panel</span><div class="perm-lista">${AREAS.map(fila).join("")}</div></div>
      <fieldset class="campo"><span>Entregas · coordinador de sala de</span><div class="reparto" style="margin:4px 0 0">${Object.keys(ENTREGABLES).map((x) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="cc" value="${x}" ${sala.has(x) ? "checked" : ""}> ${esc(porId(x)?.nombre || x)}</label>`).join("")}</div>
        <small class="tenue">Maneja los equipos, códigos, tiempo oficial y pantalla del concurso que marques (no aplica sanciones).</small></fieldset>
      <p class="perm-resumen" data-resumen></p>
      <label class="campo"><span>Código de acceso ${k ? "" : "(opcional)"}</span><input name="cod" maxlength="16" autocomplete="off" value="${esc(k?.codigo || "")}" placeholder="Vacío = se genera uno automático" style="font-family:var(--neon);letter-spacing:.15em;text-transform:uppercase"></label>
      <p class="ayuda" style="margin:0">Entra por el botón <b>Admin</b> de la portada con este código. Nunca puede crear otros accesos ni cambiar tu código.</p>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0">${k ? `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Quitar acceso</button>` : ""}<button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    const resumen = () => {
      const ve = AREAS.filter((a) => per[a.id] === "ver").map((a) => a.txt), ed = AREAS.filter((a) => per[a.id] === "editar").map((a) => a.txt);
      const cc = $$("[name=cc]", f).filter((x) => x.checked).map((x) => porId(x.value)?.nombre || x.value);
      $("[data-resumen]", f).innerHTML = !ve.length && !ed.length && !cc.length ? "Elige al menos una pestaña o un concurso."
        : [ve.length && `<b>Solo mira:</b> ${esc(ve.join(", "))}`, ed.length && `<b>Puede editar:</b> ${esc(ed.join(", "))}`, cc.length && `<b>Entregas de:</b> ${esc(cc.join(", "))}`].filter(Boolean).join("<br>");
    };
    const pintarFila = (id) => { const a = AREAS.find((x) => x.id === id), el = $(`[data-area="${id}"]`, f);
      $$("[data-nv]", el).forEach((b) => b.classList.toggle("activo", b.dataset.nv === (per[id] || "")));
      $("[data-desc]", el).textContent = per[id] === "editar" ? a.editar || a.ver : a.ver; };
    $$("[data-area]", f).forEach((el) => $$("[data-nv]", el).forEach((b) => (b.onclick = () => { const id = el.dataset.area; if (b.dataset.nv) per[id] = b.dataset.nv; else delete per[id]; pintarFila(id); resumen(); })));
    $$("[name=cc]", f).forEach((x) => (x.onchange = resumen));
    $$("[data-plantilla]", f).forEach((b) => (b.onclick = () => {
      const t = PLANTILLAS.find((x) => x.id === b.dataset.plantilla);
      Object.keys(per).forEach((x) => delete per[x]); Object.assign(per, t.permisos); AREAS.forEach((a) => pintarFila(a.id));
      if (!t.entregas) $$("[name=cc]", f).forEach((x) => (x.checked = false)); else if (!$$("[name=cc]", f).some((x) => x.checked)) aviso("Marca abajo el concurso de Entregas que coordina");
      if (!f.nombre.value.trim() && t.id !== "lectura") f.nombre.placeholder = t.txt;
      resumen();
    }));
    resumen();
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Quitar este acceso?", "Su código dejará de funcionar. No se borra nada de lo que hizo (equipos, entregas ni logística).", { boton: "Quitar acceso", peligro: true }))) return;
      try { await api.adminCoordinador(ctx.codigo(), { id: k.id, borrar: true }); m.cerrar(); coords = null; await cargarCoords(v); aviso("Acceso quitado"); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const cod = f.cod.value.replace(/\s/g, "").toUpperCase();
      const concursos = $$("[name=cc]", f).filter((x) => x.checked).map((x) => x.value);
      try {
        const r = await api.adminCoordinador(ctx.codigo(), { id: k?.id || null, nombre: f.nombre.value, concursos, permisos: { ...per }, codigoFijo: cod && cod !== k?.codigo ? cod : null });
        m.cerrar(); coords = null; await cargarCoords(v); aviso(k ? "Acceso guardado" : `Acceso creado · código ${r.codigo}`);
      } catch (ex) { $(".error", f).textContent = ex.message; }
    };
  }

  function formEquipo(x, v) {
    const e = x?.entrega || {};
    const usadas = new Set(E.equipos.filter((y) => y !== x).map((y) => y.entrega.delegacion_id));
    const m = modal(`<h2>${x ? "Editar equipo" : "Nuevo equipo"}</h2><form class="form">
      <label class="campo"><span>Delegación</span><select name="del" required><option value="">Elige…</option>${ctx.data().delegaciones.filter((d) => !usadas.has(d.id)).map((d) => `<option value="${d.id}" ${d.id === e.delegacion_id ? "selected" : ""}>${esc(d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre)}</option>`).join("")}</select></label>
      <label class="campo"><span>Nombre del equipo (opcional)</span><input name="nombre" maxlength="120" value="${esc(e.nombre || "")}"></label>
      <label class="campo"><span>Código de acceso ${x ? "" : "(opcional)"}</span><input name="cod" maxlength="16" autocomplete="off" value="${esc(x?.codigo || "")}" placeholder="Vacío = se genera uno automático" style="font-family:var(--neon);letter-spacing:.15em;text-transform:uppercase"></label>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0">${x ? `<button type="button" class="btn btn--peligro" data-borrar style="margin-right:auto">${I.basura}Eliminar</button>` : ""}<button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`);
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-borrar]", m.el)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Eliminar este equipo?", `Se borrará el equipo, su código y su ${ENTREGABLES[concurso].nombre}. Esto no se puede deshacer.`, { boton: "Eliminar", peligro: true }))) return;
      try { await api.adminEquipo(ctx.codigo(), { id: x.id, concurso, delegacion: e.delegacion_id, borrar: true }); m.cerrar(); await cargar(); pintar(v); aviso("Equipo eliminado"); } catch (ex) { aviso(ex.message, "error"); }
    });
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const cod = f.cod.value.replace(/\s/g, "").toUpperCase();
      try {
        await api.adminEquipo(ctx.codigo(), { id: x?.id || null, concurso, delegacion: f.del.value, nombre: f.nombre.value, lider: e.lider || "", codigoFijo: cod && cod !== x?.codigo ? cod : null });
        m.cerrar(); await cargar(); pintar(v); aviso("Equipo guardado");
      } catch (ex) { $(".error", f).textContent = ex.message; }
    };
  }

  return { vista };
}

// =========================================================
// Admin · Entregas en línea de los concursos (Amateur II por ahora)
// Códigos de equipo, cronómetro oficial, estado en vivo, proyector,
// impresión y sanción por entrega tardía.
// =========================================================
import { api } from "./api.js?v=202611030644";
import { ENTREGABLES } from "./entregables.js?v=202611030644";
import { porId } from "./concursos.js?v=202611030644";
import { abrirVisor, imprimir, estadoEntrega, resumenChips } from "./entrega-visor.js?v=202611030644";
import { abrirEscenario } from "./escenario.js?v=202611030644";
import { $, $$, esc, I, aviso, modal, confirmar, lanzarConfeti } from "./ui.js?v=202611030644";

const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "");

// ctx = { codigo(), data(), recargar(forzar) }
export function crearEntregas(ctx) {
  let concurso = Object.keys(ENTREGABLES)[0], E = null, desfase = 0, temporizador = null, reloj = null;
  const del = (id) => ctx.data().delegaciones.find((d) => d.id === id);
  const nomDel = (id) => { const d = del(id); return d ? (d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre) : "Delegación eliminada"; };
  const ahora = () => Date.now() + desfase;

  async function cargar() {
    const t0 = Date.now();
    E = await api.adminEntregas(ctx.codigo(), concurso);
    desfase = Date.parse(E.tiempo.ahora) - (t0 + Date.now()) / 2;
  }

  async function vista(v) {
    clearInterval(temporizador); clearInterval(reloj);
    if (!E) { v.innerHTML = `<div class="cargando" style="min-height:30vh"><div class="giro"></div>Cargando entregas…</div>`; try { await cargar(); } catch (e) { v.innerHTML = `<div class="vacio"><b>No se pudo cargar</b>${esc(e.message)}</div>`; return; } }
    pintar(v);
    // En vivo: se actualiza cada 4 s mientras esta pestaña está abierta
    temporizador = setInterval(async () => {
      if (!document.body.contains(v) || !$("[data-entregas]", v)) { clearInterval(temporizador); clearInterval(reloj); return; }
      if (document.querySelector(".velo, .proy, .escenario")) return;
      try { const antes = JSON.stringify(E.equipos.map((x) => [x.entrega.actualizado, x.entrega.estado])) + E.tiempo.fin; await cargar(); if (antes !== JSON.stringify(E.equipos.map((x) => [x.entrega.actualizado, x.entrega.estado])) + E.tiempo.fin) pintar(v); } catch { /* se reintenta */ }
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

  function pintar(v) {
    const def = ENTREGABLES[concurso], c = porId(concurso);
    const eqs = E.equipos, enviados = eqs.filter((x) => x.entrega.estado === "enviado").length;
    const sinEquipo = ctx.data().delegaciones.filter((d) => !eqs.some((x) => x.entrega.delegacion_id === d.id));
    const ajuste = (did) => ctx.data().ajustes.find((a) => a.concurso_id === concurso && a.delegacion_id === did) || {};
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Entregas en línea</h1><p>Cada equipo entra con su código por el botón <b>Equipo</b> de la portada, llena su ${esc(def.corto.toLowerCase())} y la envía. Tú y los jurados la ven en vivo y la puedes proyectar.</p></div>
        ${Object.keys(ENTREGABLES).length > 1 ? `<select data-concurso>${Object.keys(ENTREGABLES).map((k) => `<option value="${k}" ${k === concurso ? "selected" : ""}>${esc(porId(k)?.nombre || k)}</option>`).join("")}</select>` : `<span class="chip chip--celeste">${esc(c?.nombre || concurso)}</span>`}</div>
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
          <div class="kpis" style="margin:0"><div class="kpi"><b>${enviados}/${eqs.length}</b><span>Matrices enviadas</span></div><div class="kpi"><b>${eqs.filter((x) => x.entrega.estado !== "enviado" && x.entrega.actualizado).length}</b><span>En borrador</span></div></div>
          <div class="en-proyectar">
            <div class="en-opcion"><button class="btn btn--naranja" data-escenario>${I.pizarra}Proyectar pantalla del concurso</button>
              <p><b>Mientras llenan la matriz.</b> Pantalla completa con el título del concurso y el cronómetro en vivo. Manejas el tiempo desde ahí moviendo el mouse (o desde esta pestaña).</p></div>
            <div class="en-opcion"><button class="btn" data-proyectar ${eqs.length ? "" : "disabled"}>${I.vivo}Proyectar matrices</button>
              <p><b>Cuando los equipos van a exponer.</b> Muestra la matriz de cada delegación para que el público y los jurados la sigan. Cámbiala con ◀ ▶.</p></div>
          </div>
          <div class="en-acc"><button class="btn btn--mini" data-imprimir ${eqs.length ? "" : "disabled"}>${I.descargar}Imprimir reportes / PDF</button>
            <span class="ayuda" style="margin:0">Una hoja por delegación con su matriz, lo que puso cada jurado y el puntaje final. Para enviar a los delegados.</span></div>
        </section>
      </div>
      <div class="cabeza"><div><h1 style="font-size:1.4rem">Equipos y códigos</h1><p>Un equipo por delegación. Entrega a cada equipo su código el día del concurso.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">${sinEquipo.length ? `<button class="btn" data-todos>${I.mas}Crear equipos para las ${sinEquipo.length} delegaciones sin equipo</button>` : ""}<button class="btn btn--naranja" data-nuevo>${I.mas}Nuevo equipo</button></div></div>
      <div class="tabla-envoltura" data-entregas><table class="tabla"><thead><tr><th>Delegación</th><th>Código</th><th>Estado</th><th>Contenido</th><th>Última actividad</th><th></th></tr></thead><tbody>
        ${eqs.map((x) => { const e = x.entrega, [t, cl] = estadoEntrega(e), aj = ajuste(e.delegacion_id);
          return `<tr><td><b>${esc(nomDel(e.delegacion_id))}</b>${(e.datos?.lider || e.lider) ? `<br><small class="tenue">Líder: ${esc(e.datos?.lider || e.lider)}</small>` : ""}${e.nombre ? `<br><small class="tenue">${esc(e.nombre)}</small>` : ""}</td>
            <td><code class="en-codigo">${esc(x.codigo)}</code> <button class="btn btn--mini btn--icono" data-copiar="${esc(x.codigo)}" title="Copiar código" aria-label="Copiar código">${I.copiar}</button></td>
            <td><span class="chip ${cl}">${t}</span>${e.tarde ? `<br>${aj.retraso ? `<small class="chip chip--rojo log-tag">−10 % aplicado</small>` : `<button class="btn btn--mini btn--peligro" data-sancion="${e.delegacion_id}">Aplicar −10 % por retraso</button>`}` : ""}</td>
            <td><div class="reparto" style="margin:0">${resumenChips(e.datos)}</div></td>
            <td class="tenue" style="white-space:nowrap">${e.enviado ? `enviado ${hora(e.enviado)}` : e.actualizado ? `guardado ${hora(e.actualizado)}` : "—"}</td>
            <td style="white-space:nowrap"><button class="btn btn--mini" data-ver="${e.equipo_id}">${I.vivo}Ver</button>
              ${e.estado === "enviado" ? `<button class="btn btn--mini" data-reabrir="${e.equipo_id}" title="Permitir que el equipo vuelva a editar">${I.abierto}Reabrir</button>` : ""}
              <button class="btn btn--mini btn--icono" data-editar="${x.id}" title="Editar equipo" aria-label="Editar equipo">${I.lapiz}</button></td></tr>`; }).join("") || `<tr><td colspan="6"><div class="vacio"><b>Aún no hay equipos</b>Usa «Crear equipos para las delegaciones» o «Nuevo equipo».</div></td></tr>`}
      </tbody></table></div>`;
    pintarReloj(v);
    const accion = async (a, min) => { try { await api.adminTiempo(ctx.codigo(), concurso, a, min); await cargar(); pintar(v); aviso(a === "iniciar" ? "¡Tiempo iniciado!" : a === "extender" ? "+5 minutos" : a === "detener" ? "Tiempo terminado" : "Tiempo quitado"); } catch (e) { aviso(e.message, "error"); } };
    $("[data-concurso]", v)?.addEventListener("change", async (e) => { concurso = e.target.value; E = null; vista(v); });
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
    $("[data-escenario]", v).onclick = () => abrirEscenario({ concurso, cargar: cargarVisor,
      accion: (a, min) => api.adminTiempo(ctx.codigo(), concurso, a, min),
      alCerrar: async () => { try { await cargar(); pintar(v); } catch { /* sigue */ } } });
    $$("[data-copiar]", v).forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copiar); aviso("Código copiado"); } catch { aviso(`Código: ${b.dataset.copiar}`); } }));
    $$("[data-reabrir]", v).forEach((b) => (b.onclick = async () => {
      if (!(await confirmar("¿Reabrir esta matriz?", "El equipo podrá volver a editarla y tendrá que enviarla otra vez.", { boton: "Reabrir" }))) return;
      try { await api.adminEntregaReabrir(ctx.codigo(), b.dataset.reabrir); await cargar(); pintar(v); aviso("Matriz reabierta"); } catch (e) { aviso(e.message, "error"); }
    }));
    $$("[data-sancion]", v).forEach((b) => (b.onclick = async () => {
      const did = b.dataset.sancion, a = ajuste(did);
      if (!(await confirmar("¿Aplicar sanción por retraso?", `Se descuenta el <b>10 %</b> de la fase escrita a <b>${esc(nomDel(did))}</b>, según las bases. Puedes quitarla desde Resultados.`, { boton: "Aplicar −10 %", peligro: true }))) return;
      try { await api.adminAjuste(ctx.codigo(), concurso, did, { ...a, retraso: true }); await ctx.recargar(true); pintar(v); aviso("Sanción aplicada"); } catch (e) { aviso(e.message, "error"); }
    }));
    $("[data-nuevo]", v).onclick = () => formEquipo(null, v);
    $$("[data-editar]", v).forEach((b) => (b.onclick = () => formEquipo(E.equipos.find((x) => x.id === b.dataset.editar), v)));
    $("[data-todos]", v)?.addEventListener("click", async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      let n = 0;
      for (const d of sinEquipo) { try { await api.adminEquipo(ctx.codigo(), { concurso, delegacion: d.id }); n++; } catch (ex) { aviso(`${d.nombre}: ${ex.message}`, "error"); } }
      await cargar(); pintar(v); lanzarConfeti(); aviso(`${n} equipos creados con su código`);
    });
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
      if (!(await confirmar("¿Eliminar este equipo?", "Se borrará el equipo, su código y su matriz. Esto no se puede deshacer.", { boton: "Eliminar", peligro: true }))) return;
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

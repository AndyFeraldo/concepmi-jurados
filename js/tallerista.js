// =========================================================
// Vista del TALLERISTA: registra al equipo ganador de su taller
// =========================================================
import { api, ES_DEMO } from "./api.js";
import { TALLERES, tallerPorId, PUNTOS_TALLER, HORA_TALLERES, delegacionesGanadoras } from "./talleres.js";
import { $, $$, esc, avatar, hace, I, IMG, aviso, confirmar, lanzarConfeti } from "./ui.js";
import { salir } from "./app.js";

const INICIALES = 4;

export async function vistaTallerista(app, codigo) {
  let data = null;

  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Cargando tus talleres…</div>`;
  try { data = await api.datosTallerista(codigo); }
  catch (e) { aviso(e.message, "error"); return salir(); }

  const ganador = (tid) => data.ganadores.find((g) => g.taller_id === tid);
  const abierto = (tid) => data.abiertos?.[tid] !== false;
  const del = (id) => data.delegaciones.find((d) => d.id === id);

  function shell(contenido) {
    const t = data.tallerista;
    app.innerHTML = `<div class="fondo fondo--sobrio"></div>
    <header class="barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">Talleristas</div><div class="barra__sub">Registro de ganadores</div></div>
      <div class="der">
        ${avatar(t.nombre, t.foto)}
        <button class="btn btn--mini" data-salir>${I.salir}<span>Salir</span></button>
      </div>
    </header>
    <main class="contenedor">${contenido}</main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $("[data-salir]", app).onclick = salir;
  }

  // ---------------- Inicio ----------------
  function inicio() {
    const t = data.tallerista;
    const mios = TALLERES.filter((x) => t.talleres.includes(x.id));
    shell(`
      <section class="tarjeta bienvenida">
        ${avatar(t.nombre, t.foto)}
        <div><h1>Hola, ${esc(t.nombre.split(" ")[0])}</h1>
          <p>${t.descripcion ? esc(t.descripcion) : "Gracias por ser parte de los talleres del VI CONCEPMI."}</p></div>
      </section>
      <h2 class="seccion-titulo">Tus talleres</h2>
      ${mios.length ? `<div class="rejilla">${mios.map((x) => {
        const g = ganador(x.id);
        return `<button class="concurso c-${x.color}" data-tid="${x.id}">
          <span class="concurso__tipo">Taller ${x.num}${abierto(x.id) ? "" : " · cerrado"}</span>
          <h3>${esc(x.nombre)}</h3>
          <p class="concurso__apodo">${esc(x.sub)}</p>
          <p class="concurso__apodo">${I.reloj.replace("<svg", '<svg style="width:1em;height:1em;vertical-align:-2px"')} ${HORA_TALLERES} · ${esc(x.lugar)}</p>
          <div class="concurso__pie">${g?.integrantes.length ? `<span class="chip chip--verde">${I.check}Ganadores registrados</span>` : `<span class="chip chip--ambar">Pendiente</span>`}</div>
        </button>`; }).join("")}</div>`
      : `<div class="vacio"><b>Aún no tienes talleres asignados</b>Pide al organizador que te asigne uno.</div>`}
      <div class="nota" style="margin-top:18px">Cada integrante del equipo ganador suma <b>${PUNTOS_TALLER} puntos</b> a su delegación en la Copa CONCEPMI. Si dos integrantes son de la misma delegación, esa delegación recibe los ${PUNTOS_TALLER} puntos una sola vez.</div>`);
    $$("[data-tid]", app).forEach((b) => (b.onclick = () => { abrirTaller(b.dataset.tid); window.scrollTo(0, 0); }));
  }

  // ---------------- Registro del equipo ganador ----------------
  function abrirTaller(tid) {
    const x = tallerPorId(tid);
    const editable = abierto(tid);
    const previo = ganador(tid);
    let filas = previo?.integrantes.length ? previo.integrantes.map((i) => ({ ...i })) : Array.from({ length: INICIALES }, () => ({ nombre: "", delegacion: "" }));

    shell(`
      <button class="volver" data-volver>${I.atras} Mis talleres</button>
      <div class="cabeza c-${x.color}">
        <div><h1>Taller ${x.num} · ${esc(x.nombre)}</h1><p>${esc(x.sub)} · ${HORA_TALLERES} · ${esc(x.lugar)}</p></div>
        <span class="chip ${editable ? "chip--verde" : "chip--rojo"}">${editable ? "Registro abierto" : "Registro cerrado"}</span>
      </div>
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
      </div>` : `<div class="vacio"><b>Todavía no hay delegaciones registradas</b>El organizador las agregará antes del taller.</div>`}`);
    $("[data-volver]", app).onclick = () => { inicio(); window.scrollTo(0, 0); };
    if (!data.delegaciones.length) return;

    const opciones = (sel) => `<option value="">Delegación…</option>${data.delegaciones.map((d) => `<option value="${d.id}" ${d.id === sel ? "selected" : ""}>${esc(d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre)}</option>`).join("")}`;

    function pintarFilas() {
      $("#integrantes", app).innerHTML = filas.map((f, i) => `<div class="integrante">
        <span class="integrante__n">${i + 1}</span>
        <input data-nombre="${i}" maxlength="120" placeholder="Nombre y apellido" value="${esc(f.nombre)}" ${editable ? "" : "disabled"} aria-label="Nombre y apellido del integrante ${i + 1}">
        <select data-del="${i}" ${editable ? "" : "disabled"} aria-label="Delegación del integrante ${i + 1}">${opciones(f.delegacion)}</select>
        ${editable ? `<button class="btn btn--mini btn--icono" data-menos="${i}" title="Quitar integrante" aria-label="Quitar integrante ${i + 1}">${I.cerrar}</button>` : "<span></span>"}
      </div>`).join("");
      $$("[data-nombre]", app).forEach((el) => (el.oninput = () => { filas[el.dataset.nombre].nombre = el.value; }));
      $$("[data-del]", app).forEach((el) => (el.onchange = () => { filas[el.dataset.del].delegacion = el.value; reparto(); }));
      $$("[data-menos]", app).forEach((b) => (b.onclick = () => { filas.splice(Number(b.dataset.menos), 1); if (!filas.length) filas.push({ nombre: "", delegacion: "" }); pintarFilas(); }));
      reparto();
    }

    function reparto() {
      const ids = delegacionesGanadoras({ integrantes: filas });
      $("#reparto", app).innerHTML = ids.length
        ? ids.map((id) => `<span class="chip chip--verde">+${PUNTOS_TALLER} · ${esc(del(id)?.siglas || del(id)?.nombre)}</span>`).join("")
        : `<span class="tenue" style="color:var(--tenue)">Elige la delegación de cada integrante para ver los puntos.</span>`;
      $("#resumen", app).textContent = `${filas.length} integrante${filas.length === 1 ? "" : "s"} · ${ids.length} delegaci${ids.length === 1 ? "ón" : "ones"} · +${ids.length * PUNTOS_TALLER} pts en total`;
    }

    pintarFilas();
    $("[data-mas]", app)?.addEventListener("click", () => {
      if (filas.length >= 15) return aviso("Máximo 15 integrantes por equipo", "error");
      filas.push({ nombre: "", delegacion: "" }); pintarFilas(); $(`[data-nombre="${filas.length - 1}"]`, app)?.focus();
    });

    async function guardar(lista) {
      const err = $(".error", app); err.textContent = "";
      try {
        await api.registrarTaller(codigo, tid, lista);
        data = await api.datosTallerista(codigo);
        return true;
      } catch (e) { err.textContent = e.message; aviso(e.message, "error"); return false; }
    }

    $("[data-guardar]", app)?.addEventListener("click", async (ev) => {
      const btn = ev.currentTarget;
      const err = $(".error", app);
      const lista = filas.map((f) => ({ nombre: f.nombre.trim(), delegacion: f.delegacion })).filter((f) => f.nombre || f.delegacion);
      if (!lista.length) { err.textContent = "Escribe al menos un integrante."; return; }
      const falta = lista.findIndex((f) => !f.nombre || !f.delegacion);
      if (falta >= 0) { err.textContent = `Al integrante ${falta + 1} le falta ${lista[falta].nombre ? "la delegación" : "el nombre y apellido"}.`; return; }
      const ids = delegacionesGanadoras({ integrantes: lista });
      const ok = await confirmar("¿Registrar a los ganadores?", `Se sumarán <b>${PUNTOS_TALLER} puntos</b> a: <b>${ids.map((id) => esc(del(id)?.siglas || del(id)?.nombre)).join(", ")}</b>.`, { boton: "Registrar ganadores" });
      if (!ok) return;
      btn.disabled = true;
      if (await guardar(lista)) { lanzarConfeti(); aviso("Ganadores registrados"); abrirTaller(tid); }
      else btn.disabled = false;
    });

    $("[data-quitar]", app)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Quitar a los ganadores?", "Las delegaciones de este equipo dejarán de recibir los puntos del taller. Puedes registrarlos otra vez cuando quieras.", { boton: "Quitar ganadores", peligro: true }))) return;
      if (await guardar([])) { aviso("Ganadores quitados"); abrirTaller(tid); }
    });
  }

  const mios = TALLERES.filter((x) => data.tallerista.talleres.includes(x.id));
  if (mios.length === 1) abrirTaller(mios[0].id); else inicio();
}

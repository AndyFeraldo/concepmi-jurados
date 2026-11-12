// =========================================================
// Registro del EQUIPO GANADOR de un taller, por código del asistente.
// El tallerista escribe solo el DNI (el código es «CVI» + DNI, ya fijo en la casilla); se busca en los
// inscritos (jur_asistentes, el Excel de Charlas → Importar inscritos) con jur_quiz_buscar y sale su nombre
// y delegación para CONFIRMAR. La delegación es lo que suma los 40 pts en la Copa.
// Si alguien no aparece (o no tiene delegación), se puede agregar a mano como antes.
// =========================================================
import { api } from "./api.js?v=202611120159";
import { PUNTOS_TALLER, delegacionesGanadoras } from "./talleres.js?v=202611120159";
import { $, $$, esc, hace, I, aviso, confirmar, lanzarConfeti } from "./ui.js?v=202611120159";

const MAX = 15;
// «CVI12345678», «cvi 1234 5678» o «12345678» → «12345678»
export const limpiarDni = (s) => String(s || "").toUpperCase().replace(/[^0-9A-Z]/g, "").replace(/^CVI/, "");
const iniciales = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

// ctx: { caja, codigo, tid, editable, previo, delegaciones, guardado(): vuelve a pintar tras guardar }
export function ganadoresTaller({ caja, codigo, tid, editable, previo, delegaciones, guardado }) {
  const del = (id) => delegaciones.find((d) => d.id === id);
  const nomDel = (id) => del(id)?.siglas || del(id)?.nombre || "—";
  let filas = (previo?.integrantes || []).map((x) => ({ ...x }));
  let hallado = null; // persona encontrada, esperando confirmación

  caja.innerHTML = `
    ${editable ? "" : `<div class="cerrado">${I.candado}El organizador cerró este taller. Puedes ver a los ganadores, pero ya no cambiarlos.</div>`}
    ${previo?.integrantes.length ? `<p class="ayuda">Último registro: ${hace(previo.actualizado)}${previo.tallerista ? ` por ${esc(previo.tallerista)}` : ""}. Si guardas de nuevo, se reemplaza.</p>` : ""}
    ${editable ? `<section class="tarjeta tg-buscar">
      <div class="tg-buscar__cab"><span class="tg-buscar__ico">${I.personas}</span><div><h2>Agrega a cada integrante con su código</h2>
        <p>Pídele su <b>DNI</b> y escríbelo. Te mostramos su nombre y su delegación para que confirmes que es la persona.</p></div></div>
      <form class="tg-codigo" data-buscar autocomplete="off">
        <label class="tg-codigo__caja"><span class="tg-codigo__cvi">CVI</span><input name="dni" inputmode="numeric" maxlength="16" placeholder="DNI del participante" aria-label="DNI del participante (el código empieza con CVI)"></label>
        <button class="btn btn--naranja">${I.check}Buscar</button>
      </form>
      <div data-hallado aria-live="polite"></div>
      <details class="tg-manual"><summary>¿No aparece en la lista de inscritos? Agrégalo a mano</summary>
        <form class="tg-manual__form" data-manual autocomplete="off">
          <input name="nombre" maxlength="120" placeholder="Nombre y apellido" aria-label="Nombre y apellido">
          <select name="del" aria-label="Delegación"><option value="">Delegación…</option>${delegaciones.map((d) => `<option value="${d.id}">${esc(d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre)}</option>`).join("")}</select>
          <button class="btn">${I.mas}Agregar</button>
        </form></details>
    </section>` : ""}
    <h2 class="seccion-titulo">Equipo ganador (1.er lugar) <span class="chip" data-cuenta></span></h2>
    <div class="tg-lista" data-lista></div>
    <h2 class="seccion-titulo">Puntos que se suman a la Copa</h2>
    <div class="reparto" data-reparto></div>
    <p class="error" aria-live="polite"></p>
    <div class="enviar">
      <div class="enviar__info"><span data-resumen></span></div>
      ${editable && previo?.integrantes.length ? `<button class="btn btn--peligro" data-quitar>${I.basura}Quitar ganadores</button>` : ""}
      <button class="btn btn--naranja" data-guardar ${editable ? "" : "disabled"}>${I.copa}${previo?.integrantes.length ? "Actualizar ganadores" : "Registrar ganadores"}</button>
    </div>`;

  const err = $(".error", caja);
  function pintarLista() {
    $("[data-cuenta]", caja).textContent = `${filas.length} de ${MAX}`;
    $("[data-lista]", caja).innerHTML = filas.length ? filas.map((f, i) => `<div class="tg-miembro" style="--i:${i}">
        <span class="tg-miembro__ini">${esc(iniciales(f.nombre))}</span>
        <span class="tg-miembro__txt"><b>${esc(f.nombre)}</b><small>${f.codigo ? `CVI${esc(f.codigo)}` : f.manual ? "Agregado a mano" : "Registrado"}</small></span>
        <span class="chip chip--verde">${esc(nomDel(f.delegacion))}</span>
        ${editable ? `<button class="btn btn--mini btn--icono" data-menos="${i}" title="Quitar a ${esc(f.nombre)}" aria-label="Quitar a ${esc(f.nombre)}">${I.cerrar}</button>` : ""}
      </div>`).join("") : `<div class="vacio tg-vacio"><b>Aún no agregas integrantes</b>Escribe el DNI de cada uno arriba.</div>`;
    $$("[data-menos]", caja).forEach((b) => (b.onclick = () => { filas.splice(Number(b.dataset.menos), 1); pintarLista(); }));
    const ids = delegacionesGanadoras({ integrantes: filas });
    $("[data-reparto]", caja).innerHTML = ids.length ? ids.map((id) => `<span class="chip chip--verde">+${PUNTOS_TALLER} · ${esc(nomDel(id))}</span>`).join("")
      : `<span style="color:var(--tenue)">Cuando agregues integrantes verás aquí qué delegaciones suman puntos.</span>`;
    $("[data-resumen]", caja).textContent = `${filas.length} integrante${filas.length === 1 ? "" : "s"} · ${ids.length} delegaci${ids.length === 1 ? "ón" : "ones"} · +${ids.length * PUNTOS_TALLER} pts en total`;
  }

  function agregar(x) {
    if (filas.length >= MAX) return aviso(`Máximo ${MAX} integrantes por equipo`, "error"), false;
    if (x.codigo && filas.some((f) => f.codigo === x.codigo)) return aviso(`${x.nombre} ya está en el equipo`, "error"), false;
    if (!x.codigo && filas.some((f) => f.nombre.toLowerCase() === x.nombre.toLowerCase())) return aviso(`${x.nombre} ya está en el equipo`, "error"), false;
    filas.push(x); pintarLista(); aviso(`${x.nombre} agregado · ${nomDel(x.delegacion)}`); return true;
  }

  // Tarjeta «¿Es esta persona?»
  function pintarHallado() {
    const h = $("[data-hallado]", caja); if (!h) return;
    if (!hallado) { h.innerHTML = ""; return; }
    if (hallado.error) { h.innerHTML = `<div class="tg-hallado tg-hallado--no">${I.info}<div><b>${esc(hallado.error)}</b><small>Revisa el número con la persona. Si se inscribió de otra forma, usa «Agrégalo a mano» abajo.</small></div></div>`; return; }
    const sinDel = !hallado.delegacion;
    h.innerHTML = `<div class="tg-hallado">
      <span class="tg-hallado__ini">${esc(iniciales(hallado.nombre))}</span>
      <div class="tg-hallado__txt"><small>¿Es esta persona?</small><b>${esc(hallado.nombre)}</b>
        <span>Código <code>CVI${esc(hallado.dni)}</code></span>
        ${sinDel ? `<label class="tg-hallado__del"><span>No tiene delegación en la lista de inscritos. Elígela:</span><select data-del-hallado><option value="">Delegación…</option>${delegaciones.map((d) => `<option value="${d.id}">${esc(d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre)}</option>`).join("")}</select></label>`
          : `<span class="tg-hallado__deleg">${I.bandera} ${esc(hallado.delegacion.siglas ? `${hallado.delegacion.siglas} · ${hallado.delegacion.nombre}` : hallado.delegacion.nombre)}</span>`}
      </div>
      <div class="tg-hallado__acc"><button class="btn btn--naranja" data-si>${I.check}Sí, agregar</button><button class="btn" data-no>No es</button></div></div>`;
    $("[data-si]", h).onclick = () => {
      const delId = sinDel ? $("[data-del-hallado]", h).value : hallado.delegacion.id;
      if (!delId) return aviso("Elige su delegación", "error");
      if (agregar({ nombre: hallado.nombre, delegacion: delId, codigo: hallado.dni })) { hallado = null; pintarHallado(); const i = $("[data-buscar] [name=dni]", caja); i.value = ""; i.focus(); }
    };
    $("[data-no]", h).onclick = () => { hallado = null; pintarHallado(); $("[data-buscar] [name=dni]", caja).select(); };
    $("[data-si]", h).focus();
  }

  const fb = $("[data-buscar]", caja);
  if (fb) {
    const inp = fb.dni;
    inp.oninput = () => { const v = limpiarDni(inp.value); if (v !== inp.value) inp.value = v; };
    fb.onsubmit = async (e) => {
      e.preventDefault(); const dni = limpiarDni(inp.value);
      if (dni.length < 6) { hallado = { error: "Escribe el DNI completo (8 dígitos)" }; return pintarHallado(); }
      const b = $("button", fb); b.disabled = true;
      try {
        const a = await api.quizBuscar(dni);
        hallado = a ? { dni, nombre: a.nombre, delegacion: a.delegacion && del(a.delegacion.id) ? a.delegacion : null } : { error: `No encontramos el código CVI${dni} en la lista de inscritos` };
      } catch (ex) { hallado = { error: ex.message }; }
      b.disabled = false; pintarHallado();
    };
    const fm = $("[data-manual]", caja);
    fm.onsubmit = (e) => { e.preventDefault(); const n = fm.nombre.value.trim();
      if (!n) return aviso("Escribe el nombre y apellido", "error"); if (!fm.del.value) return aviso("Elige la delegación", "error");
      if (agregar({ nombre: n, delegacion: fm.del.value, manual: true })) { fm.reset(); fm.nombre.focus(); } };
  }
  pintarLista();

  async function guardar(lista) {
    err.textContent = "";
    try { await api.registrarTaller(codigo, tid, lista.map((f) => ({ nombre: f.nombre, delegacion: f.delegacion, ...(f.codigo ? { codigo: f.codigo } : {}) }))); await guardado(); return true; }
    catch (e) { err.textContent = e.message; aviso(e.message, "error"); return false; }
  }
  $("[data-guardar]", caja).onclick = async (ev) => {
    const btn = ev.currentTarget;
    if (!filas.length) { err.textContent = "Agrega al menos un integrante con su DNI."; return; }
    const ids = delegacionesGanadoras({ integrantes: filas });
    if (!(await confirmar("¿Registrar a los ganadores?", `<b>${filas.length}</b> integrante${filas.length === 1 ? "" : "s"}. Se sumarán <b>${PUNTOS_TALLER} puntos</b> a: <b>${ids.map((id) => esc(nomDel(id))).join(", ")}</b>.`, { boton: "Registrar ganadores" }))) return;
    btn.disabled = true;
    if (await guardar(filas)) { lanzarConfeti(); aviso("Ganadores registrados"); } else btn.disabled = false;
  };
  $("[data-quitar]", caja)?.addEventListener("click", async () => {
    if (!(await confirmar("¿Quitar a los ganadores?", "Las delegaciones de este equipo dejarán de recibir los puntos del taller. Puedes registrarlos otra vez cuando quieras.", { boton: "Quitar ganadores", peligro: true }))) return;
    if (await guardar([])) aviso("Ganadores quitados");
  });
  if (!delegaciones.length) caja.insertAdjacentHTML("afterbegin", `<div class="vacio"><b>Todavía no hay delegaciones registradas</b>El organizador las agregará antes del taller.</div>`);
}

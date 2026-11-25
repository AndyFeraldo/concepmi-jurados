// =========================================================
// Copa CONCEPMI → «Eliminar resultados» (para limpiar las PRUEBAS). Solo el administrador.
// No usa funciones nuevas de la base: reúne las que ya existen para cada fuente de puntos.
//   · Concursos con jurados (rúbricas y Gymkana): borra sus calificaciones con motivo
//     (jur_admin_borrar_calificaciones → quedan copiadas en el historial jur_borrados).
//   · Conocimientos y Talent Show: borra el registro manual de cada delegación (jur_admin_manual borrar);
//     en Conocimientos también reinicia las marcas «Exportado» (jur_admin_conoc_reiniciar).
//   · Sanciones (retraso, walkover, descalificado) y decisiones de desempate del concurso.
//   · Talleres: quita los ganadores (jur_admin_taller_borrar). Charlas: borra sala, respuestas y podio.
// No toca delegaciones, jurados, talleristas, ponentes, equipos, entregas ni códigos.
// =========================================================
import { api } from "./api.js?v=202611252237";
import { CONCURSOS } from "./concursos.js?v=202611252237";
import { TALLERES } from "./talleres.js?v=202611252237";
import { CHARLAS } from "./charlas.js?v=202611252237";
import { $, $$, esc, I, aviso, modal } from "./ui.js?v=202611252237";

const MANUAL = ["conocimientos", "talent"];

// Qué hay para borrar en cada fuente
function inventario(data) {
  const conc = CONCURSOS.map((c) => {
    const cal = data.calificaciones.filter((x) => x.concurso_id === c.id);
    const aj = (data.ajustes || []).filter((x) => x.concurso_id === c.id);
    const man = MANUAL.includes(c.id) ? aj : [];
    const san = MANUAL.includes(c.id) ? [] : aj.filter((x) => x.retraso || x.walkover || x.descalificado);
    const des = (data.desempates || []).filter((x) => x.concurso_id === c.id);
    const partes = [cal.length && `${cal.length} calificaci${cal.length === 1 ? "ón" : "ones"}`, man.length && `${man.length} resultado${man.length === 1 ? "" : "s"} registrado${man.length === 1 ? "" : "s"}`,
      san.length && `${san.length} sanci${san.length === 1 ? "ón" : "ones"}`, des.length && `${des.length} desempate${des.length === 1 ? "" : "s"}`].filter(Boolean);
    return { id: `c:${c.id}`, tipo: "concurso", c, cal, man, san, des, n: cal.length + man.length + san.length + des.length, txt: c.nombre, det: partes.join(" · ") };
  });
  const tal = TALLERES.map((t) => { const g = (data.ganadores_talleres || []).find((x) => x.taller_id === t.id && x.integrantes?.length);
    return { id: `t:${t.id}`, tipo: "taller", t, n: g ? 1 : 0, txt: `Taller ${t.num} · ${t.nombre}`, det: g ? `Ganadores: ${g.integrantes.length} integrantes` : "" }; });
  const cha = CHARLAS.map((c) => { const x = (data.charlas || []).find((y) => y.id === c.id) || {};
    const hay = !!x.confirmado || (x.podio || []).length || (x.fase && x.fase !== "espera" && x.fase !== "sala");
    return { id: `h:${c.id}`, tipo: "charla", ch: c, n: hay ? 1 : 0, txt: `Charla ${c.num} · ${c.nombre}`, det: hay ? (x.confirmado ? "Podio confirmado (suma a la Copa)" : "Trivia jugada sin confirmar") : "" }; });
  return { conc, tal, cha, todo: [...conc, ...tal, ...cha] };
}

export function abrirBorrarResultados({ codigo, data, recargar }) {
  const inv = inventario(data), conAlgo = inv.todo.filter((x) => x.n);
  if (!conAlgo.length) return aviso("No hay resultados que borrar: la Copa ya está en cero");
  const fila = (x) => `<label class="cb-fila ${x.n ? "" : "cb-fila--vacia"}"><input type="checkbox" value="${x.id}" ${x.n ? "checked" : "disabled"}>
    <span><b>${esc(x.txt)}</b><small>${x.n ? esc(x.det) : "Sin resultados"}</small></span></label>`;
  const grupo = (t, lista) => `<div class="cb-grupo"><div class="cb-grupo__cab"><b>${t}</b><button type="button" class="btn btn--mini" data-todos="${t}">Marcar todo</button></div>${lista.map(fila).join("")}</div>`;
  const m = modal(`<h2>${I.basura} Eliminar resultados</h2>
    <p class="ayuda" style="margin-top:-4px">Para limpiar <b>las pruebas</b>. Marca de dónde quieres quitar los puntos. <b>No se borran</b> delegaciones, jurados, talleristas, ponentes, equipos, entregas ni códigos.</p>
    <form class="form" data-f>
      <div class="cb-grupos">
        ${grupo("Concursos académicos", inv.conc.filter((x) => x.c.tipo === "academico"))}
        ${grupo("Eventos culturales", inv.conc.filter((x) => x.c.tipo !== "academico"))}
        ${grupo("Talleres", inv.tal)}
        ${grupo("Charlas (trivia)", inv.cha)}
      </div>
      <label class="campo"><span>Motivo (queda en el historial de borrados)</span><input name="motivo" maxlength="200" value="Limpieza de datos de prueba" required></label>
      <label class="campo"><span>Para confirmar, escribe <b>BORRAR</b></span><input name="ok" autocomplete="off" placeholder="BORRAR" style="font-family:var(--neon);letter-spacing:.15em;text-transform:uppercase"></label>
      <div class="cb-progreso" data-prog hidden><div class="pres-barra"><i></i><span>0 %</span></div><small data-paso></small></div>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--peligro" data-si>${I.basura}<span data-cuenta></span></button></div>
    </form>`, { ancho: true });
  const f = $("[data-f]", m.el), err = $(".error", f);
  const marcados = () => $$("input[type=checkbox]:checked", f).map((x) => inv.todo.find((y) => y.id === x.value)).filter(Boolean);
  const contar = () => { const n = marcados().length; $("[data-cuenta]", f).textContent = n ? `Eliminar resultados de ${n} ${n === 1 ? "parte" : "partes"}` : "Marca algo para borrar"; $("[data-si]", f).disabled = !n; };
  $$("input[type=checkbox]", f).forEach((x) => (x.onchange = contar));
  $$("[data-todos]", f).forEach((b) => (b.onclick = () => { const cajas = $$("input[type=checkbox]:not(:disabled)", b.closest(".cb-grupo")); const todas = cajas.every((x) => x.checked); cajas.forEach((x) => (x.checked = !todas)); contar(); }));
  $("[data-cancelar]", f).onclick = m.cerrar;
  contar();

  f.onsubmit = async (e) => {
    e.preventDefault(); err.textContent = "";
    const lista = marcados(), motivo = f.motivo.value.trim();
    if (!lista.length) return;
    if (motivo.length < 4) { err.textContent = "Escribe el motivo (mínimo 4 letras)"; return; }
    if (f.ok.value.trim().toUpperCase() !== "BORRAR") { err.textContent = "Escribe BORRAR para confirmar"; f.ok.focus(); return; }
    // Lista de pasos (una llamada a la base cada uno)
    const pasos = [];
    for (const x of lista) {
      if (x.tipo === "concurso") {
        if (x.cal.length) pasos.push([`${x.c.nombre}: calificaciones`, () => api.adminBorrarCalificaciones(codigo, x.cal.map((c) => c.id), motivo)]);
        for (const a of x.man) pasos.push([`${x.c.nombre}: resultado registrado`, () => api.adminManual(codigo, x.c.id, a.delegacion_id, {}, false, true)]);
        if (x.c.id === "conocimientos" && x.man.length) pasos.push(["Conocimientos: marcas «Exportado»", () => api.adminConocReiniciar(codigo)]);
        for (const a of x.san) pasos.push([`${x.c.nombre}: sanción`, () => api.adminAjuste(codigo, x.c.id, a.delegacion_id, { retraso: false, walkover: false, descalificado: false, valor: a.valor ?? null, nota: "" })]);
        for (const d of x.des) pasos.push([`${x.c.nombre}: desempate`, () => api.adminDesempate(codigo, x.c.id, d.delegacion_id, null)]);
      } else if (x.tipo === "taller") pasos.push([`${x.txt}: ganadores`, () => api.adminTallerBorrar(codigo, x.t.id)]);
      else pasos.push([`${x.txt}: trivia y podio`, () => api.adminCharla(codigo, x.ch.id, "borrar")]);
    }
    const prog = $("[data-prog]", f), barra = $(".pres-barra i", f), pct = $(".pres-barra span", f), paso = $("[data-paso]", f);
    prog.hidden = false; $$("button, input", f).forEach((x) => (x.disabled = true));
    const fallos = [];
    for (let k = 0; k < pasos.length; k++) {
      paso.textContent = pasos[k][0];
      try { await pasos[k][1](); } catch (ex) { fallos.push(`${pasos[k][0]}: ${ex.message}`); }
      const p = Math.round(((k + 1) / pasos.length) * 100); barra.style.width = `${p}%`; pct.textContent = `${p} %`;
    }
    await recargar(true);
    if (fallos.length) { paso.innerHTML = `<b style="color:#FF9C99">${fallos.length} no se pudo${fallos.length === 1 ? "" : "ron"} borrar:</b><br>${fallos.map(esc).join("<br>")}`; $("[data-cancelar]", f).disabled = false; $("[data-cancelar]", f).textContent = "Cerrar"; aviso("Algunos resultados no se borraron", "error"); }
    else { m.cerrar(); aviso(`Resultados eliminados (${pasos.length} ${pasos.length === 1 ? "paso" : "pasos"})`); }
  };
}

// =========================================================
// Panel de ADMINISTRADOR
// =========================================================
import { api, ES_DEMO } from "./api.js";
import { SEGUNDOS_REFRESCO } from "./config.js";
import { CONCURSOS, porId, SANCIONES } from "./concursos.js";
import { resultados, copaGeneral, maxCopaTotal, textoGymkana } from "./calculo.js";
import { exportarExcel } from "./excel.js";
import { CHARLAS, PUNTOS_CHARLA } from "./charlas.js";
import { crearCharlas } from "./admin-charlas.js";
import { TALLERES, tallerPorId, PUNTOS_TALLER, HORA_TALLERES, maxCopaTalleres, delegacionesGanadoras } from "./talleres.js";
import { $, $$, esc, fmt, avatar, hace, mmss, I, IMG, aviso, modal, confirmar, lanzarConfeti } from "./ui.js";
import { salir } from "./app.js";

const PESTANAS = [
  { id: "vivo", txt: "En vivo", icono: "vivo" },
  { id: "resultados", txt: "Resultados", icono: "tabla" },
  { id: "copa", txt: "Copa CONCEPMI", icono: "copa" },
  { id: "jurados", txt: "Jurados", icono: "personas" },
  { id: "talleristas", txt: "Talleristas", icono: "pizarra" },
  { id: "charlas", txt: "Charlas", icono: "vivo" },
  { id: "delegaciones", txt: "Delegaciones", icono: "bandera" },
];
const CON_JURADO = CONCURSOS.filter((c) => c.jurados > 0);

export async function vistaAdmin(app, codigo) {
  let data = null, firma = "";
  let pestana = "vivo", concursoSel = "proyectos";
  const vistos = new Set();
  let primera = true, temporizador = null, pausado = false;

  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo el panel…</div>`;
  try { data = await api.adminDatos(codigo); firma = JSON.stringify(data); }
  catch (e) { aviso(e.message, "error"); return salir(); }
  data.calificaciones.forEach((x) => vistos.add(x.id + x.actualizado));

  const charlasUI = crearCharlas({ codigo: () => codigo, data: () => data, recargar: (f) => recargar(f), pausar: (p) => { pausado = p; } });
  const jur = (id) => data.jurados.find((j) => j.id === id);
  const tal = (id) => data.talleristas.find((t) => t.id === id);
  const ganador = (tid) => data.ganadores_talleres.find((g) => g.taller_id === tid);
  const tallerAbierto = (tid) => data.talleres?.find((t) => t.id === tid)?.abierto !== false;
  const del = (id) => data.delegaciones.find((d) => d.id === id);
  const abierto = (cid) => data.concursos.find((c) => c.id === cid)?.abierto !== false;
  const ajuste = (cid, did) => data.ajustes.find((a) => a.concurso_id === cid && a.delegacion_id === did) || {};

  function marco() {
    app.innerHTML = `<div class="fondo fondo--sobrio"></div>
    <header class="barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">Panel de Administrador</div><div class="barra__sub">VI CONCEPMI 2026</div></div>
      <div class="der">
        <span class="en-vivo" title="Se actualiza cada ${SEGUNDOS_REFRESCO} s"><span class="punto punto--vivo"></span>EN VIVO</span>
        <button class="btn btn--mini btn--naranja" data-excel>${I.descargar}<span>Excel</span></button>
        <button class="btn btn--mini btn--icono" data-clave title="Cambiar mi código" aria-label="Cambiar mi código">${I.llave}</button>
        <button class="btn btn--mini btn--icono" data-salir title="Salir" aria-label="Salir">${I.salir}</button>
      </div>
    </header>
    <main class="contenedor">
      <div class="pestanas" role="tablist">${PESTANAS.map((p) => `<button class="pestana" role="tab" data-p="${p.id}" aria-selected="${p.id === pestana}">${I[p.icono]}${p.txt}</button>`).join("")}</div>
      <section id="vista"></section>
    </main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
    $$("[data-p]", app).forEach((b) => (b.onclick = () => { pestana = b.dataset.p; $$("[data-p]", app).forEach((x) => x.setAttribute("aria-selected", String(x === b))); pintar(); }));
    $("[data-salir]", app).onclick = () => { clearInterval(temporizador); salir(); };
    $("[data-excel]", app).onclick = () => { try { exportarExcel(data); aviso("Excel generado"); } catch (e) { aviso(e.message, "error"); } };
    $("[data-clave]", app).onclick = cambiarClave;
    pintar();
  }

  function pintar() {
    const v = $("#vista", app);
    if (!v) return;
    ({ vivo, resultados: vistaResultados, copa, jurados, talleristas, charlas: charlasUI.vista, delegaciones })[pestana](v);
  }

  async function recargar(forzar = false) {
    try {
      const nuevo = await api.adminDatos(codigo);
      const f = JSON.stringify(nuevo);
      if (pausado || (!forzar && f === firma)) return;
      data = nuevo; firma = f;
      const ocupado = document.querySelector(".velo") || (document.activeElement && /INPUT|TEXTAREA|SELECT/.test(document.activeElement.tagName) && $("#vista", app)?.contains(document.activeElement));
      if (forzar || !ocupado) pintar();
    } catch { /* se reintenta en el siguiente ciclo */ }
  }
  temporizador = setInterval(() => { if (!document.body.contains($("#vista", app))) return clearInterval(temporizador); recargar(); }, SEGUNDOS_REFRESCO * 1000);

  // Votos esperados por concurso
  function avance(c) {
    const nd = data.delegaciones.length;
    if (c.modo === "rubrica") {
      const nj = data.jurados.filter((j) => j.concursos.includes(c.id)).length;
      return { hechas: data.calificaciones.filter((x) => x.concurso_id === c.id).length, meta: nj * nd * c.subpruebas.length, txt: `${nj} jurado${nj === 1 ? "" : "s"}` };
    }
    if (c.modo === "gymkana") {
      const hechas = new Set(data.calificaciones.filter((x) => x.concurso_id === c.id).map((x) => x.subprueba + x.delegacion_id)).size;
      return { hechas, meta: nd * c.subpruebas.length, txt: "5 minijuegos" };
    }
    return { hechas: data.ajustes.filter((a) => a.concurso_id === c.id && (a.valor != null || a.walkover)).length, meta: nd, txt: "Registro manual" };
  }

  // ---------------- En vivo ----------------
  function vivo(v) {
    const ultimo = data.calificaciones[0];
    const feed = data.calificaciones.slice(0, 30).map((x) => {
      const j = jur(x.jurado_id), d = del(x.delegacion_id), c = porId(x.concurso_id);
      const sp = c?.subpruebas?.find((s) => s.id === x.subprueba);
      const clave = x.id + x.actualizado;
      const nuevo = !primera && !vistos.has(clave); vistos.add(clave);
      let pts = `${fmt(x.total)}<small>de ${fmt(sp?.max)}</small>`;
      if (c?.modo === "gymkana") {
        pts = sp.entrada === "rubrica" ? `${fmt(x.total)}<small>de 100</small>` : `<small style="font-size:.78rem;color:var(--niebla)">${esc(textoGymkana(sp, x.datos))}</small>`;
      }
      return `<div class="voto ${nuevo ? "voto--nuevo" : ""}">${avatar(j?.nombre, j?.foto)}
        <div class="voto__txt"><b>${esc(j?.nombre || "Jurado eliminado")}</b><span>${esc(d?.siglas || d?.nombre || "")} · ${esc(c?.nombre || x.concurso_id)}${c?.subpruebas?.length > 1 ? ` · ${esc(sp?.corto || sp?.id)}` : ""} · ${hace(x.actualizado)}</span></div>
        <div class="voto__pts">${pts}</div></div>`;
    }).join("");
    primera = false;
    v.innerHTML = `
      <div class="kpis">
        <div class="kpi"><b>${data.calificaciones.length}</b><span>Calificaciones recibidas</span></div>
        <div class="kpi"><b>${data.jurados.length}</b><span>Jurados con código</span></div>
        <div class="kpi"><b>${data.delegaciones.length}</b><span>Delegaciones</span></div>
        <div class="kpi"><b style="font-size:1.25rem;padding-top:.4em">${ultimo ? hace(ultimo.actualizado) : "—"}</b><span>Último voto</span></div>
      </div>
      <div class="vivo">
        <div><h2 class="seccion-titulo" style="margin-top:0">Avance por concurso</h2><div class="avance">${CONCURSOS.map((c) => {
          const a = avance(c); const pct = a.meta ? Math.min(100, (a.hechas / a.meta) * 100) : 0; const ab = abierto(c.id);
          return `<div class="avance__fila c-${c.color}"><div><h4>${esc(c.nombre)} <span class="tenue" style="font-weight:500;color:var(--tenue);font-size:.78rem">· ${a.txt}</span></h4>
            <div class="progreso"><i style="width:${pct}%"></i></div></div>
            <span class="cnt">${a.hechas}/${a.meta}</span>
            ${c.jurados > 0 ? `<button class="interruptor ${ab ? "interruptor--abierto" : "interruptor--cerrado"}" data-toggle="${c.id}" title="${ab ? "Cerrar la calificación" : "Reabrir la calificación"}">${ab ? I.abierto + "Abierto" : I.candado + "Cerrado"}</button>` : `<button class="interruptor interruptor--abierto" data-registrar="${c.id}">${I.lapiz}Registrar</button>`}
          </div>`; }).join("")}</div></div>
        <div><h2 class="seccion-titulo" style="margin-top:0">Últimas calificaciones</h2>
          ${feed ? `<div class="feed">${feed}</div>` : `<div class="vacio"><b>Aún no llegan votos</b>Crea los códigos de los jurados en la pestaña Jurados y compártelos.</div>`}</div>
      </div>`;
    $$("[data-registrar]", v).forEach((b) => (b.onclick = () => panelManual(porId(b.dataset.registrar))));
    $$("[data-toggle]", v).forEach((b) => (b.onclick = async () => {
      const cid = b.dataset.toggle; const ab = abierto(cid);
      if (ab && !(await confirmar("¿Cerrar la calificación?", `Los jurados de <b>${esc(porId(cid).nombre)}</b> ya no podrán guardar ni cambiar puntajes. Puedes reabrirla cuando quieras.`, { boton: "Cerrar calificación", peligro: true }))) return;
      try { await api.adminConcurso(codigo, cid, !ab); aviso(ab ? "Calificación cerrada" : "Calificación reabierta"); recargar(true); } catch (e) { aviso(e.message, "error"); }
    }));
  }

  // ---------------- Resultados ----------------
  function vistaResultados(v) {
    const c = porId(concursoSel);
    v.innerHTML = `
      <div class="pestanas" style="margin-bottom:14px">${CONCURSOS.map((x) => `<button class="pestana" data-c="${x.id}" aria-selected="${x.id === c.id}">${esc(x.nombre.replace("Concurso Nacional de ", "").replace("Concurso de ", ""))}</button>`).join("")}</div>
      <div class="cabeza" style="margin-top:0"><div><h1>${esc(c.nombre)}</h1><p>${esc(c.nota)}</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center"><span class="chip chip--celeste">Máximo ${c.maxCopa} pts para la Copa</span>
        ${c.jurados > 0 ? `<button class="btn btn--peligro" data-borrar-cal>${I.basura}Borrar calificaciones</button>` : `<button class="btn btn--naranja" data-panel>${I.lapiz}Registrar resultados</button>`}</div></div>
      <div id="res"></div>`;
    $$("[data-c]", v).forEach((b) => (b.onclick = () => { concursoSel = b.dataset.c; vistaResultados(v); }));
    $("[data-borrar-cal]", v)?.addEventListener("click", () => borrarCalificaciones({ cid: c.id }));
    $("[data-panel]", v)?.addEventListener("click", () => panelManual(c));
    const r = $("#res", v);
    if (!data.delegaciones.length) { r.innerHTML = `<div class="vacio"><b>Primero registra las delegaciones</b>Ve a la pestaña Delegaciones.</div>`; return; }
    if (c.modo === "rubrica") resRubrica(c, r);
    else if (c.modo === "gymkana") resGymkana(c, r);
    else resManual(c, r);
  }

  const medalla = (p) => (p ? `<span class="medalla ${p <= 3 ? `medalla--${p}` : ""}">${p}</span>` : `<span class="tenue">—</span>`);

  function selectSancion(c, did) {
    const a = ajuste(c.id, did);
    const actual = a.descalificado ? "descalificado" : a.walkover ? "walkover" : a.retraso ? "retraso" : "";
    return `<select class="mini-select" data-sancion="${did}" aria-label="Sanción">
      <option value="">Sin sanción</option>
      ${(c.sanciones || []).map((s) => `<option value="${s}" ${s === actual ? "selected" : ""}>${esc(SANCIONES[s].txt)}</option>`).join("")}</select>`;
  }
  function conectarSanciones(c, raiz) {
    $$("[data-sancion]", raiz).forEach((s) => (s.onchange = async () => {
      const a = ajuste(c.id, s.dataset.sancion);
      try {
        await api.adminAjuste(codigo, c.id, s.dataset.sancion, { ...a, retraso: s.value === "retraso", walkover: s.value === "walkover", descalificado: s.value === "descalificado" });
        aviso(s.value ? `Sanción aplicada: ${SANCIONES[s.value].txt}` : "Sanción retirada"); recargar(true);
      } catch (e) { aviso(e.message, "error"); }
    }));
  }

  function resRubrica(c, r) {
    const filas = resultados(c.id, data);
    const jurs = data.jurados.filter((j) => j.concursos.includes(c.id) || data.calificaciones.some((x) => x.concurso_id === c.id && x.jurado_id === j.id));
    const varias = c.subpruebas.length > 1;
    const sinVoto = data.delegaciones.filter((d) => !filas.some((f) => f.delegacion.id === d.id));
    const celdaJur = (f, j) => {
      const vs = c.subpruebas.map((sp) => f.califs.find((x) => x.jurado_id === j.id && x.subprueba === sp.id));
      if (!vs.some(Boolean)) return `<td class="num tenue">—</td>`;
      return `<td class="num">${vs.map((x) => (x ? fmt(x.total) : "·")).join(" + ")}</td>`;
    };
    r.innerHTML = `
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Puesto</th><th>Delegación</th>${jurs.map((j) => `<th class="num" title="${esc(j.nombre)}">${esc(j.nombre.split(" ")[0])}</th>`).join("")}
          <th class="num">Promedio${varias ? " (V + P)" : ""}</th><th>Sanción</th><th class="num">Rúbrica final</th><th class="num">Puntos Copa</th></tr></thead>
        <tbody>${filas.map((f) => `<tr>
          <td>${medalla(f.puesto)}${f.empate ? ' <span class="chip chip--ambar">empate</span>' : ""}</td>
          <td><b>${esc(f.delegacion.nombre)}</b></td>
          ${jurs.map((j) => celdaJur(f, j)).join("")}
          <td class="num">${c.subpruebas.map((sp) => fmt(f.porSub[sp.id]?.promedio, 2)).join(" + ")}${f.penal ? `<br><small class="tenue">−${fmt(f.penal, 2)} retraso</small>` : ""}</td>
          <td>${selectSancion(c, f.delegacion.id)}</td>
          <td class="num">${f.rubrica}</td>
          <td class="num grande">${f.copa}</td></tr>`).join("")}
          ${sinVoto.map((d) => `<tr><td><span class="tenue">—</span></td><td>${esc(d.nombre)}</td>${jurs.map(() => '<td class="num tenue">—</td>').join("")}<td class="num tenue">Sin votos</td><td>${selectSancion(c, d.id)}</td><td></td><td></td></tr>`).join("")}
        </tbody></table></div>
      ${c.conversion ? `<p class="ayuda" style="margin-top:10px">Conversión de puesto a Copa: ${c.conversion.txt.map((t, i) => `${t} = ${i < c.conversion.tabla.length ? c.conversion.tabla[i] : c.conversion.resto}`).join(" · ")}. Desempate automático por criterio 3, luego 1, luego 2.</p>` : ""}
      ${c.subpruebas.map((sp) => detalle(c, sp)).join("")}
      ${historialBorrados(c)}`;
    conectarSanciones(c, r);
    $$("[data-borrar]", r).forEach((b) => (b.onclick = () => {
      const x = data.calificaciones.find((y) => y.id === b.dataset.borrar);
      borrarCalificaciones({ cid: c.id, jid: x?.jurado_id, ids: [b.dataset.borrar] });
    }));
    $$("[data-coment]", r).forEach((b) => (b.onclick = () => {
      const x = data.calificaciones.find((y) => y.id === b.dataset.coment);
      const m = modal(`<h2>Comentario del jurado</h2><p style="color:var(--tenue);margin:0 0 10px">${esc(jur(x.jurado_id)?.nombre)} sobre ${esc(del(x.delegacion_id)?.nombre)}</p><p style="white-space:pre-wrap;margin:0">${esc(x.comentario)}</p><div class="modal__acciones"><button class="btn" data-ok>Cerrar</button></div>`);
      m.el.querySelector("[data-ok]").onclick = m.cerrar;
    }));
  }

  function detalle(c, sp) {
    const cs = data.calificaciones.filter((x) => x.concurso_id === c.id && x.subprueba === sp.id)
      .sort((a, b) => (del(a.delegacion_id)?.nombre || "").localeCompare(del(b.delegacion_id)?.nombre || "") || (jur(a.jurado_id)?.nombre || "").localeCompare(jur(b.jurado_id)?.nombre || ""));
    if (!cs.length) return "";
    return `<h2 class="seccion-titulo">Detalle por criterio${c.subpruebas.length > 1 ? ` · ${esc(sp.nombre)}` : ""}</h2>
      <div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th>Delegación</th><th>Jurado</th>${sp.criterios.map((k, i) => `<th class="num" title="${esc(k.nombre)}">C${i + 1}<br><small>${fmt(k.max)}</small></th>`).join("")}<th class="num">Total</th><th>Hora</th><th></th></tr></thead>
        <tbody>${cs.map((x) => `<tr><td>${esc(del(x.delegacion_id)?.siglas || del(x.delegacion_id)?.nombre)}</td><td>${esc(jur(x.jurado_id)?.nombre || "—")}</td>
          ${sp.criterios.map((k) => `<td class="num">${fmt(x.datos[k.id])}</td>`).join("")}
          <td class="num"><b>${fmt(x.total)}</b></td><td class="tenue" style="white-space:nowrap">${hace(x.actualizado)}</td>
          <td style="white-space:nowrap">${x.comentario ? `<button class="btn btn--mini btn--icono" data-coment="${x.id}" title="Ver comentario" aria-label="Ver comentario">${I.info}</button>` : ""}
            <button class="btn btn--mini btn--icono btn--peligro" data-borrar="${x.id}" title="Borrar calificación" aria-label="Borrar calificación">${I.basura}</button></td></tr>`).join("")}</tbody>
      </table></div>
      <p class="ayuda" style="margin-top:8px">${sp.criterios.map((k, i) => `C${i + 1} ${esc(k.nombre)}`).join(" · ")}</p>`;
  }

  function resGymkana(c, r) {
    const filas = resultados(c.id, data);
    const reg = (sp, d) => (d?.datos ? textoGymkana(sp, d.datos) : "");
    const sinDatos = data.delegaciones.filter((d) => !filas.some((f) => f.delegacion.id === d.id));
    r.innerHTML = `<div class="tabla-envoltura"><table class="tabla">
      <thead><tr><th>Puesto</th><th>Delegación</th>${c.subpruebas.map((sp) => `<th class="num">${esc(sp.corto)}<br><small>máx ${sp.max}</small></th>`).join("")}<th>Sanción</th><th class="num">Total Gymkana</th></tr></thead>
      <tbody>${filas.map((f) => `<tr><td>${medalla(f.puesto)}</td><td><b>${esc(f.delegacion.nombre)}</b></td>
        ${c.subpruebas.map((sp) => { const d = f.det[sp.id]; return `<td class="num">${d ? `<b>${d.pts}</b><br><small class="tenue">${esc(reg(sp, d))}${d.empate ? " · empate" : ""}</small>` : '<span class="tenue">—</span>'}</td>`; }).join("")}
        <td>${selectSancion(c, f.delegacion.id)}</td><td class="num grande">${f.copa}</td></tr>`).join("")}
        ${sinDatos.map((d) => `<tr><td><span class="tenue">—</span></td><td>${esc(d.nombre)}</td>${c.subpruebas.map(() => '<td class="num tenue">—</td>').join("")}<td>${selectSancion(c, d.id)}</td><td></td></tr>`).join("")}
      </tbody></table></div>
      <p class="ayuda" style="margin-top:10px">Si dos jurados registran la misma delegación en un minijuego, vale el último registro. Los empates comparten el promedio de puntos, redondeado.</p>
      ${historialBorrados(c)}`;
    conectarSanciones({ ...c, sanciones: ["walkover", "descalificado"] }, r);
  }

  function resManual(c, r) {
    r.innerHTML = `
      <button class="registro-cta" data-panel2>
        <span class="registro-cta__icono">${c.id === "talent" ? I.vivo : I.libro}</span>
        <span><b>${c.id === "talent" ? "Registrar likes del Talent Show" : "Registrar enfrentamientos de Conocimientos"}</b>
        <small>${c.id === "talent" ? "Elige la delegación, escribe sus likes de TikTok e Instagram y la tabla se ordena sola." : "Elige la delegación, registra sus 2 enfrentamientos y la tabla se llena al instante."}</small></span>
        ${I.flecha}
      </button>
      <div class="tabla-envoltura">${tablaManual(c)}</div>`;
    $("[data-panel2]", r).onclick = () => panelManual(c);
  }

  function tablaManual(c, { seleccion = null, clicable = false } = {}) {
    const filas = resultados(c.id, data);
    const pendientes = data.delegaciones.filter((d) => !filas.some((f) => f.delegacion.id === d.id));
    const nombre = (d) => `<b>${esc(d.siglas || d.nombre)}</b>${d.siglas ? `<br><small class="tenue">${esc(d.nombre)}</small>` : ""}`;
    const tr = (f, celdas) => `<tr ${clicable ? `data-fila="${f.delegacion.id}" class="fila-clic ${seleccion === f.delegacion.id ? "fila-sel" : ""}"` : ""}>${celdas}</tr>`;
    if (c.id === "conocimientos") {
      const vs = (e) => { if (!e?.rival) return ""; const r = del(e.rival); return ` vs ${esc(r ? r.siglas || r.nombre : e.rival)}`; };
      const enf = (e) => (e ? `<b>${e.puntos}</b><br><small class="tenue">pts${vs(e)}</small>` : '<span class="tenue">Pendiente</span>');
      return `<table class="tabla"><thead><tr><th>Puesto</th><th>Delegación</th><th class="num">Enfrentamiento 1</th><th class="num">Enfrentamiento 2</th><th class="num">Puntos Copa</th></tr></thead>
        <tbody>${filas.map((f) => tr(f, f.ajuste.walkover
          ? `<td><span class="tenue">—</span></td><td>${nombre(f.delegacion)}</td><td colspan="2"><span class="chip chip--rojo">No se presentó</span></td><td class="num grande">0</td>`
          : `<td>${medalla(f.puesto)}${f.empate ? ' <span class="chip chip--ambar" title="Desempate según el sistema del concurso">empate</span>' : ""}</td><td>${nombre(f.delegacion)}</td>
            <td class="num">${enf(f.datos.e1)}</td><td class="num">${enf(f.datos.e2)}</td><td class="num grande">${f.copa}</td>`)).join("")}
          ${pendientes.map((d) => `<tr ${clicable ? `data-fila="${d.id}" class="fila-clic ${seleccion === d.id ? "fila-sel" : ""}"` : ""}><td><span class="tenue">—</span></td><td>${nombre(d)}</td><td colspan="3" class="tenue">Sin registrar</td></tr>`).join("")}
        </tbody></table>`;
    }
    const n = (x) => Number(x || 0).toLocaleString("es-PE");
    return `<table class="tabla"><thead><tr><th>Puesto</th><th>Delegación</th><th class="num">TikTok</th><th class="num">Instagram</th><th class="num">Total likes</th><th class="num">Desempate</th><th class="num">Puntos Copa</th></tr></thead>
      <tbody>${filas.map((f) => tr(f, f.ajuste.walkover
        ? `<td><span class="tenue">—</span></td><td>${nombre(f.delegacion)}</td><td colspan="4"><span class="chip chip--rojo">No presentó video</span></td><td class="num grande">0</td>`
        : `<td>${medalla(f.puesto)}${f.empate ? ' <span class="chip chip--ambar">empate</span>' : ""}</td><td>${nombre(f.delegacion)}</td>
          <td class="num">${n(f.datos.tiktok)}</td><td class="num">${n(f.datos.instagram)}</td><td class="num"><b>${n(f.likes)}</b></td><td class="num tenue">${f.desempate ? n(f.desempate) : "—"}</td><td class="num grande">${f.copa}</td>`)).join("")}
        ${pendientes.map((d) => `<tr ${clicable ? `data-fila="${d.id}" class="fila-clic ${seleccion === d.id ? "fila-sel" : ""}"` : ""}><td><span class="tenue">—</span></td><td>${nombre(d)}</td><td colspan="5" class="tenue">Sin registrar</td></tr>`).join("")}
      </tbody></table>`;
  }

  // ---------------- Panel de registro manual ----------------
  function panelManual(c) {
    if (!data.delegaciones.length) return aviso("Primero registra las delegaciones", "error");
    const esConoc = c.id === "conocimientos";
    const registrado = (did) => { const a = ajuste(c.id, did); return a.valor != null || a.walkover; };
    let did = (data.delegaciones.find((d) => !registrado(d.id)) || data.delegaciones[0]).id;
    let st;
    const cargar = () => {
      const a = ajuste(c.id, did); const dt = a.datos || {};
      st = esConoc
        ? { e1: { puntos: dt.e1?.puntos ?? "", rival: dt.e1?.rival || "" }, e2: { puntos: dt.e2?.puntos ?? "", rival: dt.e2?.rival || "" }, nop: !!a.walkover }
        : { tiktok: dt.tiktok ?? "", instagram: dt.instagram ?? "", desempate: dt.desempate || "", nop: !!a.walkover };
    };
    cargar();
    const info = esConoc
      ? `<div class="reglas-mini"><b>Cómo se registra</b><span>Copia los puntos de cada enfrentamiento desde el sistema del Concurso de Conocimientos.</span><span>Cada enfrentamiento: hasta <b>35 pts</b> (20 de bono por victoria o 10 por 2.° lugar + hasta 15 correctas).</span><span>Total para la Copa: suma de los 2 enfrentamientos, máximo <b>70 pts</b>.</span><span>Si hay empate, se define en el sistema del concurso (correctas, victorias y Pregunta de Muerte Certera).</span></div>`
      : `<div class="reglas-mini"><b>Cómo se calcula</b><span>Puntaje = likes de TikTok + likes de Instagram, solo en las publicaciones oficiales del Student Club.</span><span>Cierre del conteo: <b>miércoles 25 de noviembre, 12:00 h</b>.</span><span>1.° 50 · 2.° 40 · 3.° 30 · 4.° 22 · 5.° 15 · 6.° en adelante 10 · no presentó 0.</span><span>Desempate: comentarios + compartidos + reproducciones.</span></div>`;
    const m = modal(`
      <div class="panel-m__cab"><div><h2>${esc(c.nombre)}</h2><p style="margin:0;color:var(--niebla)">${esConoc ? "Registro de enfrentamientos" : "Registro de likes"} · se guarda en la base de datos y se refleja en la Copa al instante</p></div>
        <button class="btn btn--mini btn--icono" data-cerrar aria-label="Cerrar">${I.cerrar}</button></div>
      <div class="panel-m">
        <form class="panel-m__form" novalidate>
          <label class="campo"><span>Delegación</span><select class="select select--grande" name="deleg"></select></label>
          <div data-cuerpo></div>
          <label class="check"><input type="checkbox" name="nop"><span>${esConoc ? "No se presentó al concurso (0 pts)" : "No presentó video en el plazo (0 pts)"}</span></label>
          <div class="panel-m__total"><span>${esConoc ? "Puntaje de la delegación" : "Total de likes"}</span><b data-total>0</b></div>
          <p class="error" aria-live="polite"></p>
          <div class="modal__acciones" style="margin-top:0;justify-content:space-between">
            <button type="button" class="btn btn--peligro btn--mini" data-quitar>${I.basura}Quitar registro</button>
            <button class="btn btn--naranja">${I.check}Guardar y seguir</button>
          </div>
          ${info}
        </form>
        <div class="panel-m__tabla"><div class="panel-m__tt"><b>Tabla en vivo</b><span class="chip" data-cuenta></span></div><div class="tabla-envoltura" data-tabla></div>
          <p class="ayuda" style="margin-top:8px">Toca una fila para editarla.</p></div>
      </div>`, { ancho: true });
    m.el.classList.add("modal--xl");
    const f = $("form", m.el), cuerpo = $("[data-cuerpo]", m.el), err = $(".error", f);
    $("[data-cerrar]", m.el).onclick = m.cerrar;

    const pintarSelect = () => {
      f.deleg.innerHTML = data.delegaciones.map((d) => `<option value="${d.id}" ${d.id === did ? "selected" : ""}>${registrado(d.id) ? "✓ " : "○ "}${d.siglas ? esc(d.siglas) + " · " : ""}${esc(d.nombre)}</option>`).join("");
      $("[data-cuenta]", m.el).textContent = `${data.delegaciones.filter((d) => registrado(d.id)).length} de ${data.delegaciones.length} registradas`;
      $("[data-quitar]", m.el).hidden = !registrado(did);
    };
    const pintarTabla = () => {
      $("[data-tabla]", m.el).innerHTML = tablaManual(c, { seleccion: did, clicable: true });
      $$("[data-fila]", m.el).forEach((tr) => (tr.onclick = () => { did = tr.dataset.fila; cargar(); todo(); }));
    };
    const calcular = () => {
      if (st.nop) return 0;
      if (esConoc) return ["e1", "e2"].reduce((s, e) => s + Number(st[e].puntos || 0), 0);
      return Number(st.tiktok || 0) + Number(st.instagram || 0);
    };
    const pintarTotal = () => { const t = calcular(); $("[data-total]", m.el).textContent = esConoc ? `${t} / 70` : t.toLocaleString("es-PE"); };
    const pintarCuerpo = () => {
      f.nop.checked = st.nop;
      if (esConoc) {
        const rivales = (e) => `<option value="">Elige el rival…</option>${data.delegaciones.filter((d) => d.id !== did).map((d) => `<option value="${d.id}" ${st[e].rival === d.id ? "selected" : ""}>${esc(d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre)}</option>`).join("")}`;
        cuerpo.innerHTML = ["e1", "e2"].map((e, i) => `<fieldset class="enf" data-e="${e}" ${st.nop ? "disabled" : ""}>
          <legend>Enfrentamiento ${i + 1}</legend>
          <div class="enf__vs"><span>vs</span><select class="select" data-rival aria-label="Rival del enfrentamiento ${i + 1}">${rivales(e)}</select></div>
          <div class="enf__fila">
            <div class="contador"><button type="button" class="paso" data-c="-1" aria-label="Restar">−</button>
              <input class="mini-input enf__pts-in" inputmode="numeric" maxlength="2" value="${st[e].puntos}" placeholder="—" aria-label="Puntos del enfrentamiento ${i + 1}">
              <button type="button" class="paso" data-c="1" aria-label="Sumar">+</button><span class="ayuda">pts de 35</span></div>
          </div>
        </fieldset>`).join("");
        $$(".enf", cuerpo).forEach((fs) => {
          const e = fs.dataset.e; const inp = $(".enf__pts-in", fs);
          const poner = (v) => { st[e].puntos = v === "" ? "" : Math.max(0, Math.min(35, Number(v))); inp.value = st[e].puntos; pintarTotal(); };
          inp.oninput = () => { const v = inp.value.replace(/[^\d]/g, ""); poner(v); };
          $$("[data-c]", fs).forEach((b) => (b.onclick = () => poner(Number(st[e].puntos || 0) + Number(b.dataset.c))));
          $("[data-rival]", fs).onchange = (ev) => (st[e].rival = ev.target.value);
        });
      } else {
        cuerpo.innerHTML = `<div class="likes" ${st.nop ? "hidden" : ""}>
          <label class="campo like like--tiktok"><span>Likes en TikTok</span><input name="tiktok" inputmode="numeric" value="${st.tiktok}" placeholder="0"></label>
          <label class="campo like like--ig"><span>Likes en Instagram</span><input name="instagram" inputmode="numeric" value="${st.instagram}" placeholder="0"></label>
          <label class="campo" style="grid-column:1 / -1"><span>Desempate (opcional): comentarios + compartidos + reproducciones</span><input name="desempate" inputmode="numeric" value="${st.desempate}" placeholder="Solo si hay empate exacto de likes"></label>
        </div>`;
        $$("input", cuerpo).forEach((inp) => (inp.oninput = () => { inp.value = inp.value.replace(/[^\d]/g, ""); st[inp.name] = inp.value; pintarTotal(); }));
      }
      pintarTotal();
    };
    const todo = () => { err.textContent = ""; pintarSelect(); pintarCuerpo(); pintarTabla(); };
    f.deleg.onchange = () => { did = f.deleg.value; cargar(); todo(); };
    f.nop.onchange = () => { st.nop = f.nop.checked; pintarCuerpo(); };
    $("[data-quitar]", m.el).onclick = async () => {
      if (!(await confirmar("¿Quitar este registro?", `Se borrará lo registrado para <b>${esc(del(did).nombre)}</b> en ${esc(c.nombre)}.`, { boton: "Quitar", peligro: true }))) return;
      try { await api.adminManual(codigo, c.id, did, {}, false, true); await recargar(true); cargar(); todo(); aviso("Registro quitado"); } catch (e) { aviso(e.message, "error"); }
    };
    f.onsubmit = async (e) => {
      e.preventDefault(); err.textContent = "";
      let datos = {};
      if (!st.nop) {
        if (esConoc) {
          for (const k of ["e1", "e2"]) if (st[k].puntos !== "") datos[k] = { puntos: Number(st[k].puntos), rival: st[k].rival || "" };
          if (!Object.keys(datos).length) { err.textContent = "Escribe los puntos de al menos un enfrentamiento."; return; }
        } else {
          if (st.tiktok === "" || st.instagram === "") { err.textContent = "Escribe los likes de TikTok y de Instagram (pon 0 si no tiene)."; return; }
          datos = { tiktok: Number(st.tiktok), instagram: Number(st.instagram), desempate: Number(st.desempate || 0) };
        }
      }
      const btn = $("button.btn--naranja", f); btn.disabled = true;
      try {
        await api.adminManual(codigo, c.id, did, datos, st.nop);
        await recargar(true);
        const nombreD = del(did).siglas || del(did).nombre;
        const sig = data.delegaciones.find((d) => !registrado(d.id));
        if (sig) did = sig.id;
        cargar(); todo();
        aviso(`${nombreD} guardada`);
        $(`[data-fila]`, m.el) && $(".fila-sel", m.el)?.scrollIntoView({ block: "nearest" });
      } catch (ex) { err.textContent = ex.message; }
      finally { btn.disabled = false; }
    };
    todo();
  }

  // ---------------- Borrar calificaciones con motivo ----------------
  function borrarCalificaciones({ cid, jid = null, ids = null } = {}) {
    const conCal = CONCURSOS.filter((c) => c.jurados > 0);
    let sel = { cid: cid && conCal.some((c) => c.id === cid) ? cid : conCal[0].id, jid, marcadas: new Set(ids || []) };
    const MOTIVOS = ["Error al digitar el puntaje", "Calificó a la delegación equivocada", "Lo pidió el jurado", "Conflicto de interés del jurado", "Jurado reemplazado"];
    const m = modal(`
      <h2>Borrar calificaciones</h2>
      <p style="margin:0;color:var(--niebla)">Elige el concurso, el jurado y las calificaciones. El motivo queda guardado en el historial.</p>
      <form class="form" novalidate>
        <div class="dos-col">
          <label class="campo"><span>Concurso</span><select class="select" name="con">${conCal.map((c) => `<option value="${c.id}" ${c.id === sel.cid ? "selected" : ""}>${esc(c.nombre)}</option>`).join("")}</select></label>
          <label class="campo"><span>Jurado</span><select class="select" name="jur"></select></label>
        </div>
        <div class="campo"><span>Calificaciones de ese jurado</span><div class="lista-borrar" data-lista></div></div>
        <div class="campo"><span>Motivo del borrado</span>
          <div class="rapidos" style="margin-top:0">${MOTIVOS.map((t) => `<button type="button" class="rapido" data-mot="${esc(t)}">${esc(t)}</button>`).join("")}</div>
          <textarea name="motivo" maxlength="400" placeholder="Explica brevemente por qué se borra" style="margin-top:8px"></textarea></div>
        <p class="error" aria-live="polite"></p>
        <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button>
          <button class="btn btn--peligro" data-ok>${I.basura}<span>Borrar</span></button></div>
      </form>`, { ancho: true });
    const f = $("form", m.el), lista = $("[data-lista]", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    const califs = () => data.calificaciones.filter((x) => x.concurso_id === sel.cid);
    const pintarJurados = () => {
      const js = data.jurados.filter((j) => califs().some((x) => x.jurado_id === j.id));
      if (!js.some((j) => j.id === sel.jid)) sel.jid = js[0]?.id || null;
      f.jur.innerHTML = js.length ? js.map((j) => `<option value="${j.id}" ${j.id === sel.jid ? "selected" : ""}>${esc(j.nombre)} (${califs().filter((x) => x.jurado_id === j.id).length})</option>`).join("") : `<option value="">Sin calificaciones en este concurso</option>`;
      f.jur.disabled = !js.length;
    };
    const pintarLista = () => {
      const c = porId(sel.cid);
      const xs = califs().filter((x) => x.jurado_id === sel.jid);
      for (const id of [...sel.marcadas]) if (!xs.some((x) => x.id === id)) sel.marcadas.delete(id);
      lista.innerHTML = xs.length ? `<label class="check check--todas"><input type="checkbox" data-todas ${xs.every((x) => sel.marcadas.has(x.id)) ? "checked" : ""}><span>Seleccionar todas (${xs.length})</span></label>
        ${xs.map((x) => { const sp = c.subpruebas.find((s) => s.id === x.subprueba); const d = del(x.delegacion_id);
          const val = c.modo === "gymkana" ? (sp.entrada === "rubrica" ? `${fmt(x.total)} / 100` : textoGymkana(sp, x.datos)) : `${fmt(x.total)} pts`;
          return `<label class="check"><input type="checkbox" value="${x.id}" ${sel.marcadas.has(x.id) ? "checked" : ""}><span><b>${esc(d?.siglas || d?.nombre || "—")}</b> · ${c.subpruebas.length > 1 ? esc(sp?.corto || sp?.nombre) + " · " : ""}${val}<small>${esc(d?.nombre || "")} · ${hace(x.actualizado)}</small></span></label>`; }).join("")}`
        : `<div class="vacio" style="padding:1.2em">Este jurado no tiene calificaciones en este concurso.</div>`;
      $("[data-todas]", lista)?.addEventListener("change", (e) => { xs.forEach((x) => (e.target.checked ? sel.marcadas.add(x.id) : sel.marcadas.delete(x.id))); pintarLista(); });
      $$("input[value]", lista).forEach((cb) => (cb.onchange = () => { cb.checked ? sel.marcadas.add(cb.value) : sel.marcadas.delete(cb.value); pintarLista(); }));
      const n = sel.marcadas.size;
      $("[data-ok] span", m.el).textContent = n ? `Borrar ${n} calificaci${n === 1 ? "ón" : "ones"}` : "Borrar";
      $("[data-ok]", m.el).disabled = !n;
    };
    f.con.onchange = () => { sel.cid = f.con.value; sel.marcadas.clear(); pintarJurados(); pintarLista(); };
    f.jur.onchange = () => { sel.jid = f.jur.value; sel.marcadas.clear(); pintarLista(); };
    $$("[data-mot]", m.el).forEach((b) => (b.onclick = () => { f.motivo.value = b.dataset.mot; $$("[data-mot]", m.el).forEach((x) => x.setAttribute("aria-pressed", String(x === b))); }));
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = $(".error", f);
      if (f.motivo.value.trim().length < 4) { err.textContent = "Escribe o elige el motivo del borrado."; f.motivo.focus(); return; }
      const idsB = [...sel.marcadas]; if (!idsB.length) return;
      const btn = $("[data-ok]", m.el); btn.disabled = true;
      try {
        const n = await api.adminBorrarCalificaciones(codigo, idsB, f.motivo.value.trim());
        m.cerrar(); aviso(`${n} calificaci${n === 1 ? "ón borrada" : "ones borradas"}`); recargar(true);
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
    pintarJurados(); pintarLista();
  }

  function historialBorrados(c) {
    const bs = (data.borrados || []).filter((b) => b.concurso_id === c.id);
    if (!bs.length) return "";
    return `<h2 class="seccion-titulo">Historial de calificaciones borradas</h2>
      <div class="tabla-envoltura"><table class="tabla"><thead><tr><th>Cuándo</th><th>Jurado</th><th>Delegación</th>${c.subpruebas?.length > 1 ? "<th>Fase</th>" : ""}<th class="num">Valor</th><th>Motivo</th></tr></thead>
      <tbody>${bs.map((b) => `<tr><td class="tenue" style="white-space:nowrap">${hace(b.borrado)}</td><td>${esc(b.jurado)}</td><td>${esc(b.delegacion)}</td>${c.subpruebas?.length > 1 ? `<td>${esc(c.subpruebas.find((s) => s.id === b.subprueba)?.corto || b.subprueba)}</td>` : ""}<td class="num">${fmt(b.total)}</td><td>${esc(b.motivo)}</td></tr>`).join("")}</tbody></table></div>`;
  }

  // ---------------- Copa ----------------
  function copa(v) {
    const filas = copaGeneral(data);
    const aca = CONCURSOS.filter((c) => c.tipo === "academico"), cul = CONCURSOS.filter((c) => c.tipo === "cultural");
    const top = filas.filter((f) => f.total > 0).slice(0, 3);
    const lugar = (f, n) => f ? `<div class="podio__lugar podio__lugar--${n}"><span class="medalla medalla--${n}">${n}</span><div class="podio__nombre">${esc(f.delegacion.nombre)}</div><div class="podio__pts">${f.total}</div><small class="tenue">puntos</small></div>` : `<div></div>`;
    const corto = (c) => c.nombre.replace("Concurso Nacional de ", "").replace("Concurso de ", "");
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Copa CONCEPMI VI</h1><p>Suma de puntos de los ${CONCURSOS.length} concursos (máximo ${maxCopaTotal} pts) de los ${TALLERES.length} talleres (${PUNTOS_TALLER} pts por taller ganado) y de las ${CHARLAS.length} charlas principales (${PUNTOS_CHARLA} pts para la delegación del ganador de cada trivia).</p></div></div>
      ${top.length ? `<div class="podio">${lugar(top[1], 2)}${lugar(top[0], 1)}${lugar(top[2], 3)}</div>` : ""}
      ${data.delegaciones.length ? `<div class="tabla-envoltura"><table class="tabla">
        <thead><tr><th rowspan="2">Puesto</th><th rowspan="2">Delegación</th><th colspan="${aca.length}" class="grupo-a" style="text-align:center">Académicos</th><th colspan="${cul.length}" class="grupo-c" style="text-align:center">Culturales</th><th colspan="${TALLERES.length}" class="grupo-a" style="text-align:center">Talleres</th><th colspan="${CHARLAS.length}" class="grupo-c" style="text-align:center">Charlas</th><th rowspan="2" class="num">Total</th></tr>
          <tr>${[...aca, ...cul].map((c) => `<th class="num">${esc(corto(c))}<br><small>${c.maxCopa}</small></th>`).join("")}${TALLERES.map((t) => `<th class="num" title="${esc(t.nombre)}">Taller ${t.num}<br><small>${PUNTOS_TALLER}</small></th>`).join("")}${CHARLAS.map((c) => `<th class="num" title="${esc(c.nombre)}">Charla ${c.num}<br><small>${PUNTOS_CHARLA}</small></th>`).join("")}</tr></thead>
        <tbody>${filas.map((f) => `<tr><td>${medalla(f.total > 0 ? f.puesto : null)}</td><td><b>${esc(f.delegacion.nombre)}</b></td>
          ${[...aca, ...cul, ...TALLERES, ...CHARLAS].map((c) => `<td class="num ${f.pts[c.id] == null ? "tenue" : ""}">${f.pts[c.id] ?? "—"}</td>`).join("")}
          <td class="num grande">${f.total}</td></tr>`).join("")}</tbody></table></div>
        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap"><button class="btn btn--naranja" data-excel2>${I.descargar}Exportar todo a Excel</button><button class="btn" data-fiesta>${I.copa}Celebrar al líder</button></div>`
      : `<div class="vacio"><b>Primero registra las delegaciones</b>Ve a la pestaña Delegaciones.</div>`}`;
    $("[data-excel2]", v)?.addEventListener("click", () => { try { exportarExcel(data); aviso("Excel generado"); } catch (e) { aviso(e.message, "error"); } });
    $("[data-fiesta]", v)?.addEventListener("click", lanzarConfeti);
  }

  // ---------------- Jurados ----------------
  function jurados(v) {
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Jurados</h1><p>Crea un código para cada jurado y elige en qué concursos puede calificar.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--mini" data-respaldo>${I.copiar}Copiar respaldo</button><button class="btn btn--mini" data-importar>${I.descargar}Importar respaldo</button></div></div>
      ${ES_DEMO ? `<div class="cerrado" style="background:rgba(255,194,61,.12);border-color:rgba(255,194,61,.5);color:#FFE3A6">${I.alerta}<span><b>Estás en la vista previa.</b> Los jurados que crees aquí se guardan solo en este navegador y sus códigos NO funcionan en la versión real. ${data.jurados.some((x) => x.recuperado) ? "Los marcados como <b>recuperado</b> los registraste antes: usa <b>Copiar respaldo</b> y pégalo en <b>Importar respaldo</b> de la versión publicada para crearlos con los mismos códigos." : ""}</span></div>` : ""}
      <div class="jurados">
        <button class="crear" data-crear>${I.mas}<span>Crear código de jurado</span></button>
        ${data.jurados.map((j) => {
          const n = data.calificaciones.filter((x) => x.jurado_id === j.id).length;
          return `<article class="jurado">
            <div class="jurado__cab">${avatar(j.nombre, j.foto)}<div><h4>${esc(j.nombre)}</h4><p>${n} calificaci${n === 1 ? "ón" : "ones"} enviada${n === 1 ? "" : "s"}${j.recuperado ? ' · <span class="chip chip--ambar">recuperado</span>' : ""}</p></div></div>
            ${j.descripcion ? `<p>${esc(j.descripcion)}</p>` : ""}
            <div class="jurado__chips">${j.concursos.map((cid) => `<span class="chip">${esc(porId(cid)?.nombre || cid)}</span>`).join("")}</div>
            <div class="jurado__codigo"><code>${esc(j.codigo)}</code><button class="btn btn--mini btn--icono" data-copiar="${esc(j.codigo)}" title="Copiar código" aria-label="Copiar código">${I.copiar}</button></div>
            <div class="jurado__acc">
              <button class="btn btn--mini" data-editar="${j.id}">${I.lapiz}Editar</button>
              <button class="btn btn--mini" data-regen="${j.id}">${I.girar}Nuevo código</button>
              <button class="btn btn--mini btn--peligro" data-quitar="${j.id}">${I.basura}Eliminar</button>
            </div></article>`; }).join("")}
      </div>`;
    $("[data-crear]", v).onclick = () => formPersona("jurado", null);
    $("[data-respaldo]", v).onclick = copiarRespaldo;
    $("[data-importar]", v).onclick = importarRespaldo;
    $$("[data-editar]", v).forEach((b) => (b.onclick = () => formPersona("jurado", jur(b.dataset.editar))));
    $$("[data-copiar]", v).forEach((b) => (b.onclick = () => copiar(b.dataset.copiar)));
    $$("[data-regen]", v).forEach((b) => (b.onclick = async () => {
      const j = jur(b.dataset.regen);
      if (!(await confirmar("¿Generar un código nuevo?", `El código actual de <b>${esc(j.nombre)}</b> dejará de funcionar. Sus calificaciones se conservan.`, { boton: "Generar nuevo código" }))) return;
      try { const r = await api.adminJurado(codigo, { ...j, nuevoCodigo: true, foto: null }); await recargar(true); mostrarCodigo(j.nombre, r.codigo, "Jurado"); } catch (e) { aviso(e.message, "error"); }
    }));
    $$("[data-quitar]", v).forEach((b) => (b.onclick = async () => {
      const j = jur(b.dataset.quitar);
      if (!(await confirmar("¿Eliminar este jurado?", `Se borrarán <b>${esc(j.nombre)}</b> y todas sus calificaciones. Esto no se puede deshacer.`, { boton: "Eliminar jurado", peligro: true }))) return;
      try { await api.adminJurado(codigo, { id: j.id, borrar: true }); aviso("Jurado eliminado"); recargar(true); } catch (e) { aviso(e.message, "error"); }
    }));
  }

  // ---------------- Talleristas y ganadores de talleres ----------------
  function talleristas(v) {
    const del2 = (id) => del(id)?.siglas || del(id)?.nombre || "Delegación eliminada";
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Talleres</h1><p>Los ${TALLERES.length} talleres son en paralelo (${HORA_TALLERES}). Cada integrante del equipo ganador suma ${PUNTOS_TALLER} pts a su delegación (una vez por delegación).</p></div></div>
      <div class="ganadores">${TALLERES.map((t) => {
        const g = ganador(t.id); const ids = delegacionesGanadoras(g); const ab = tallerAbierto(t.id);
        return `<article class="concurso concurso--info c-${t.color}">
          <span class="concurso__tipo">Taller ${t.num} · ${esc(t.lugar)}</span>
          <h3>${esc(t.nombre)}</h3>
          ${g?.integrantes.length ? `<ol>${g.integrantes.map((x) => `<li><b style="color:var(--blanco)">${esc(x.nombre)}</b> · ${esc(del2(x.delegacion))}</li>`).join("")}</ol>
            <div class="reparto">${ids.map((id) => `<span class="chip chip--verde">+${PUNTOS_TALLER} · ${esc(del2(id))}</span>`).join("")}</div>
            <p class="ayuda" style="margin:6px 0 0">Registrado ${hace(g.actualizado)}${g.tallerista ? ` por ${esc(g.tallerista)}` : ""}</p>`
          : `<p class="concurso__apodo">Aún no hay ganadores registrados.</p>`}
          <div style="margin-top:8px"><button class="interruptor ${ab ? "interruptor--abierto" : "interruptor--cerrado"}" data-taller="${t.id}" title="${ab ? "Cerrar el registro" : "Reabrir el registro"}">${ab ? I.abierto + "Abierto" : I.candado + "Cerrado"}</button></div>
        </article>`; }).join("")}</div>
      <div class="cabeza"><div><h1>Talleristas</h1><p>Crea un código para cada tallerista y elige qué talleres tiene habilitados.</p></div></div>
      <div class="jurados">
        <button class="crear" data-crear>${I.mas}<span>Crear código de tallerista</span></button>
        ${data.talleristas.map((t) => `<article class="jurado">
            <div class="jurado__cab">${avatar(t.nombre, t.foto)}<div><h4>${esc(t.nombre)}</h4><p>${t.talleres.length} taller${t.talleres.length === 1 ? "" : "es"}</p></div></div>
            ${t.descripcion ? `<p>${esc(t.descripcion)}</p>` : ""}
            <div class="jurado__chips">${t.talleres.map((id) => `<span class="chip">Taller ${esc(tallerPorId(id)?.num || id)} · ${esc(tallerPorId(id)?.nombre || "")}</span>`).join("")}</div>
            <div class="jurado__codigo"><code>${esc(t.codigo)}</code><button class="btn btn--mini btn--icono" data-copiar="${esc(t.codigo)}" title="Copiar código" aria-label="Copiar código">${I.copiar}</button></div>
            <div class="jurado__acc">
              <button class="btn btn--mini" data-editar="${t.id}">${I.lapiz}Editar</button>
              <button class="btn btn--mini" data-regen="${t.id}">${I.girar}Nuevo código</button>
              <button class="btn btn--mini btn--peligro" data-quitar="${t.id}">${I.basura}Eliminar</button>
            </div></article>`).join("")}
      </div>`;
    $("[data-crear]", v).onclick = () => formPersona("tallerista", null);
    $$("[data-editar]", v).forEach((b) => (b.onclick = () => formPersona("tallerista", tal(b.dataset.editar))));
    $$("[data-copiar]", v).forEach((b) => (b.onclick = () => copiar(b.dataset.copiar)));
    $$("[data-taller]", v).forEach((b) => (b.onclick = async () => {
      const tid = b.dataset.taller; const ab = tallerAbierto(tid);
      if (ab && !(await confirmar("¿Cerrar el registro?", `El tallerista del <b>Taller ${esc(tallerPorId(tid).num)}</b> ya no podrá cambiar a los ganadores. Puedes reabrirlo cuando quieras.`, { boton: "Cerrar registro", peligro: true }))) return;
      try { await api.adminTaller(codigo, tid, !ab); aviso(ab ? "Registro cerrado" : "Registro reabierto"); recargar(true); } catch (e) { aviso(e.message, "error"); }
    }));
    $$("[data-regen]", v).forEach((b) => (b.onclick = async () => {
      const t = tal(b.dataset.regen);
      if (!(await confirmar("¿Generar un código nuevo?", `El código actual de <b>${esc(t.nombre)}</b> dejará de funcionar. Los ganadores que registró se conservan.`, { boton: "Generar nuevo código" }))) return;
      try { const r = await api.adminTallerista(codigo, { ...t, nuevoCodigo: true, foto: null }); await recargar(true); mostrarCodigo(t.nombre, r.codigo, "Tallerista"); } catch (e) { aviso(e.message, "error"); }
    }));
    $$("[data-quitar]", v).forEach((b) => (b.onclick = async () => {
      const t = tal(b.dataset.quitar);
      if (!(await confirmar("¿Eliminar este tallerista?", `Se borrará <b>${esc(t.nombre)}</b> y su código dejará de funcionar. Los ganadores que registró se conservan.`, { boton: "Eliminar tallerista", peligro: true }))) return;
      try { await api.adminTallerista(codigo, { id: t.id, borrar: true }); aviso("Tallerista eliminado"); recargar(true); } catch (e) { aviso(e.message, "error"); }
    }));
  }

  function copiarRespaldo() {
    const txt = JSON.stringify({ tipo: "concepmi-jurados", version: 1, fecha: new Date().toISOString(),
      jurados: data.jurados.map((j) => ({ nombre: j.nombre, codigo: j.codigo, concursos: j.concursos, descripcion: j.descripcion || "", foto: j.foto || "" })) });
    const m = modal(`<h2>Respaldo de jurados</h2><p style="margin:0;color:var(--niebla)">Contiene nombre, código, concursos, descripción y foto de los ${data.jurados.length} jurados. Cópialo y guárdalo en un documento, o pégalo en <b>Importar respaldo</b> de otra versión del panel.</p>
      <textarea class="respaldo" readonly>${esc(txt)}</textarea>
      <div class="modal__acciones"><button class="btn" data-cerrar>Cerrar</button><button class="btn btn--naranja" data-copiar>${I.copiar}Copiar</button></div>`, { ancho: true });
    const ta = $("textarea", m.el); ta.focus(); ta.select();
    $("[data-cerrar]", m.el).onclick = m.cerrar;
    $("[data-copiar]", m.el).onclick = async () => {
      ta.select();
      try { await navigator.clipboard.writeText(txt); aviso("Respaldo copiado"); }
      catch { try { document.execCommand("copy"); aviso("Respaldo copiado"); } catch { aviso("Selecciona el texto y cópialo con Ctrl + C", "error"); } }
    };
  }

  function importarRespaldo() {
    const m = modal(`<h2>Importar respaldo de jurados</h2><p style="margin:0;color:var(--niebla)">Pega el texto de <b>Copiar respaldo</b>. Cada jurado se crea con <b>su mismo código</b>, nombre, foto, descripción y concursos. Los códigos que ya existen aquí se omiten.</p>
      <textarea class="respaldo" placeholder='{"tipo":"concepmi-jurados", ...}'></textarea><p class="error"></p>
      <div class="modal__acciones"><button class="btn" data-cerrar>Cancelar</button><button class="btn btn--naranja" data-ok>${I.check}Importar</button></div>`, { ancho: true });
    $("[data-cerrar]", m.el).onclick = m.cerrar;
    $("[data-ok]", m.el).onclick = async (ev) => {
      const err = $(".error", m.el); err.textContent = "";
      let o; try { o = JSON.parse($("textarea", m.el).value); } catch { err.textContent = "El texto no es un respaldo válido."; return; }
      const lista = Array.isArray(o?.jurados) ? o.jurados : null;
      if (!lista?.length) { err.textContent = "El respaldo no contiene jurados."; return; }
      ev.currentTarget.disabled = true;
      let creados = 0, omitidos = 0; const fallos = [];
      for (const j of lista) {
        if (data.jurados.some((x) => x.codigo === String(j.codigo).toUpperCase())) { omitidos++; continue; }
        try {
          await api.adminJurado(codigo, { nombre: j.nombre, concursos: (j.concursos || []).filter((c) => CON_JURADO.some((x) => x.id === c)), descripcion: j.descripcion || "", foto: j.foto || "", codigoFijo: j.codigo });
          creados++;
        } catch (e) { fallos.push(`${j.nombre}: ${e.message}`); }
      }
      await recargar(true); m.cerrar();
      aviso(`${creados} jurado${creados === 1 ? "" : "s"} importado${creados === 1 ? "" : "s"}${omitidos ? ` · ${omitidos} ya existían` : ""}`, fallos.length ? "error" : "ok");
      if (fallos.length) setTimeout(() => aviso(fallos.join(" · "), "error"), 400);
    };
  }

  // Formulario de jurado o tallerista (mismos campos; cambian las opciones)
  const PERSONA = {
    jurado: { titulo: "jurado", campo: "concursos", leyenda: "Concursos en los que puede calificar", falta: "Elige al menos un concurso.", boton: "Jurado",
      opciones: () => CON_JURADO.map((c) => ({ id: c.id, nombre: c.nombre, sub: `${c.tipo === "academico" ? "Académico" : "Cultural"} · ${c.modo === "gymkana" ? "registro de resultados" : `${c.jurados} jurados`}` })),
      nota: "Conocimientos y Talent Show los registras tú desde Resultados.", guardar: (o) => api.adminJurado(codigo, o) },
    tallerista: { titulo: "tallerista", campo: "talleres", leyenda: "Talleres que tiene habilitados", falta: "Elige al menos un taller.", boton: "Tallerista",
      opciones: () => TALLERES.map((t) => ({ id: t.id, nombre: `Taller ${t.num} · ${t.nombre}`, sub: `${HORA_TALLERES} · ${t.lugar}` })),
      nota: `El tallerista registra al equipo ganador: ${PUNTOS_TALLER} pts para cada delegación del equipo.`, guardar: (o) => api.adminTallerista(codigo, o) },
  };

  function formPersona(tipo, j) {
    const P = PERSONA[tipo];
    let foto = j?.foto || "";
    let fotoCambiada = false;
    const m = modal(`
      <h2>${j ? `Editar ${P.titulo}` : `Crear código de ${P.titulo}`}</h2>
      <p style="margin:0;color:var(--niebla)">${j ? "Los cambios se aplican al instante." : `Al guardar se genera un código único de 6 caracteres para este ${P.titulo}.`}</p>
      <form class="form">
        <div class="foto-sel"><span data-prev>${avatar(j?.nombre || "?", foto)}</span>
          <div style="display:grid;gap:6px"><label class="btn btn--mini" style="cursor:pointer">${I.camara}Subir foto<input type="file" accept="image/*" hidden data-foto></label>
            <button type="button" class="btn btn--mini" data-sinfoto ${foto ? "" : "hidden"}>Quitar foto</button>
            <p class="ayuda">JPG o PNG. Se recorta en cuadrado.</p></div></div>
        <label class="campo"><span>Nombre completo</span><input name="nombre" required maxlength="120" value="${esc(j?.nombre || "")}" placeholder="Ej. Ing. María Fernanda Quispe Rojas"></label>
        <label class="campo"><span>Código de acceso ${j ? "" : "(opcional)"}</span><input name="cod" maxlength="16" autocomplete="off" autocapitalize="characters" value="${esc(j?.codigo || "")}" placeholder="Vacío = se genera uno automático" style="font-family:var(--neon);letter-spacing:.15em;text-transform:uppercase">
          <span class="ayuda" style="font-weight:400">Úsalo para conservar un código que ya le enviaste al ${P.titulo} (4 a 16 letras o números).</span></label>
        <label class="campo"><span>Descripción breve</span><textarea name="desc" maxlength="400" placeholder="Cargo, especialidad o experiencia (se muestra al ${P.titulo} al entrar)">${esc(j?.descripcion || "")}</textarea></label>
        <fieldset style="border:0;padding:0;margin:0"><legend class="campo" style="margin-bottom:8px"><span>${P.leyenda}</span></legend>
          <div class="checks">${P.opciones().map((c) => `<label class="check"><input type="checkbox" value="${c.id}" ${j?.[P.campo].includes(c.id) ? "checked" : ""}><span>${esc(c.nombre)}<small>${esc(c.sub)}</small></span></label>`).join("")}</div>
          <p class="ayuda" style="margin-top:8px">${esc(P.nota)}</p></fieldset>
        <p class="error" aria-live="polite"></p>
        <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button>
          <button class="btn btn--naranja">${j ? `${I.check}Guardar cambios` : `${I.llave}Crear código`}</button></div>
      </form>`, { ancho: true });
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("[data-foto]", m.el).onchange = async (e) => {
      const file = e.target.files[0]; if (!file) return;
      try { foto = await reducirFoto(file); fotoCambiada = true; $("[data-prev]", m.el).innerHTML = avatar("", foto); $("[data-sinfoto]", m.el).hidden = false; }
      catch { aviso("No se pudo leer la imagen", "error"); }
    };
    $("[data-sinfoto]", m.el).onclick = () => { foto = ""; fotoCambiada = true; $("[data-prev]", m.el).innerHTML = avatar(f.nombre.value || "?", ""); $("[data-sinfoto]", m.el).hidden = true; };
    f.onsubmit = async (e) => {
      e.preventDefault();
      const elegidos = $$("input[type=checkbox]:checked", f).map((x) => x.value);
      const err = $(".error", f);
      if (!f.nombre.value.trim()) { err.textContent = `Escribe el nombre completo del ${P.titulo}.`; return; }
      if (!elegidos.length) { err.textContent = P.falta; return; }
      const btn = $("button:not([type=button])", f); btn.disabled = true;
      try {
        const cod = f.cod.value.replace(/\s/g, "").toUpperCase();
        const r = await P.guardar({ id: j?.id || null, nombre: f.nombre.value, descripcion: f.desc.value.trim(), [P.campo]: elegidos, foto: fotoCambiada || !j ? foto : null,
          codigoFijo: cod && cod !== j?.codigo ? cod : null });
        m.cerrar(); await recargar(true);
        if (!j || r.codigo !== j.codigo) mostrarCodigo(f.nombre.value.trim(), r.codigo, P.boton); else aviso(`${P.boton} actualizado`);
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
  }

  function mostrarCodigo(nombre, cod, boton = "Jurado") {
    lanzarConfeti();
    const m = modal(`<div style="text-align:center"><div class="exito__icono" style="background:linear-gradient(135deg,#FFC23D,#FF6A1F);box-shadow:0 0 40px rgba(255,194,61,.6)">${I.llave}</div>
      <h2>Código de ${esc(nombre)}</h2><p style="margin:0;color:var(--niebla)">Compártelo solo con esta persona. Con él entra por el botón ${esc(boton)}.</p>
      ${ES_DEMO ? `<p style="margin:10px 0 0;color:#FFD98A;font-size:.85rem"><b>Vista previa:</b> este código no funciona en la versión real. No lo envíes todavía.</p>` : ""}
      <div class="codigo-grande">${esc(cod)}</div></div>
      <div class="modal__acciones" style="justify-content:center"><button class="btn" data-copiar>${I.copiar}Copiar código</button><button class="btn btn--naranja" data-ok>Listo</button></div>`);
    $("[data-copiar]", m.el).onclick = () => copiar(cod);
    $("[data-ok]", m.el).onclick = m.cerrar;
  }

  async function copiar(t) {
    try { await navigator.clipboard.writeText(t); aviso("Código copiado"); }
    catch { aviso(`Código: ${t}`); }
  }

  // ---------------- Delegaciones ----------------
  function delegaciones(v) {
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Delegaciones</h1><p>Las universidades que compiten. Los jurados las verán en este orden alfabético.</p></div></div>
      <form class="del-form tarjeta" style="padding:16px">
        <label class="campo"><span>Nombre de la universidad o delegación</span><input name="nombre" maxlength="120" placeholder="Ej. Universidad Nacional de Ingeniería" required></label>
        <label class="campo"><span>Siglas</span><input name="siglas" maxlength="12" placeholder="UNI"></label>
        <button class="btn btn--naranja">${I.mas}Agregar</button>
      </form>
      <div class="lista-del">${data.delegaciones.map((d) => `<div class="del-fila">${d.siglas ? `<span class="sig">${esc(d.siglas)}</span>` : ""}<b>${esc(d.nombre)}</b>
        <button class="btn btn--mini btn--icono" data-ed="${d.id}" title="Editar" aria-label="Editar">${I.lapiz}</button>
        <button class="btn btn--mini btn--icono btn--peligro" data-bo="${d.id}" title="Eliminar" aria-label="Eliminar">${I.basura}</button></div>`).join("") || `<div class="vacio"><b>Aún no hay delegaciones</b>Agrega la primera con el formulario de arriba.</div>`}</div>`;
    const f = $("form", v);
    f.onsubmit = async (e) => {
      e.preventDefault();
      try { await api.adminDelegacion(codigo, null, f.nombre.value, f.siglas.value); aviso("Delegación agregada"); await recargar(true); $("input[name=nombre]", $("#vista", app))?.focus(); }
      catch (ex) { aviso(ex.message, "error"); }
    };
    $$("[data-ed]", v).forEach((b) => (b.onclick = () => {
      const d = del(b.dataset.ed);
      const m = modal(`<h2>Editar delegación</h2><form class="form">
        <label class="campo"><span>Nombre</span><input name="nombre" value="${esc(d.nombre)}" maxlength="120" required></label>
        <label class="campo"><span>Siglas</span><input name="siglas" value="${esc(d.siglas)}" maxlength="12"></label>
        <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">Guardar</button></div></form>`);
      $("[data-cancelar]", m.el).onclick = m.cerrar;
      $("form", m.el).onsubmit = async (e) => {
        e.preventDefault(); const ff = e.target;
        try { await api.adminDelegacion(codigo, d.id, ff.nombre.value, ff.siglas.value); m.cerrar(); aviso("Delegación actualizada"); recargar(true); }
        catch (ex) { aviso(ex.message, "error"); }
      };
    }));
    $$("[data-bo]", v).forEach((b) => (b.onclick = async () => {
      const d = del(b.dataset.bo);
      const n = data.calificaciones.filter((x) => x.delegacion_id === d.id).length;
      if (!(await confirmar("¿Eliminar delegación?", `Se borrará <b>${esc(d.nombre)}</b>${n ? ` y sus <b>${n} calificaciones</b>` : ""}. Esto no se puede deshacer.`, { boton: "Eliminar", peligro: true }))) return;
      try { await api.adminDelegacion(codigo, d.id, "", "", true); aviso("Delegación eliminada"); recargar(true); } catch (ex) { aviso(ex.message, "error"); }
    }));
  }

  // ---------------- Cambiar código de admin ----------------
  function cambiarClave() {
    const m = modal(`<h2>Cambiar mi código</h2><p style="margin:0;color:var(--niebla)">Mínimo 6 caracteres. Desde ahora entrarás con el nuevo código.</p>
      <form class="form"><label class="campo"><span>Nuevo código</span><input name="n1" autocomplete="new-password" required></label>
      <label class="campo"><span>Repite el nuevo código</span><input name="n2" autocomplete="new-password" required></label>
      <p class="error"></p><div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--primario">Cambiar código</button></div></form>`);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    $("form", m.el).onsubmit = async (e) => {
      e.preventDefault(); const f = e.target; const err = $(".error", f);
      if (f.n1.value.trim() !== f.n2.value.trim()) { err.textContent = "Los códigos no coinciden."; return; }
      try {
        await api.adminClave(codigo, f.n1.value.trim());
        codigo = f.n1.value.trim().replace(/\s/g, "").toUpperCase();
        try { sessionStorage.setItem("concepmi-jurados-sesion", JSON.stringify({ rol: "admin", codigo })); } catch { /* sin almacenamiento */ }
        m.cerrar(); aviso("Código actualizado");
      } catch (ex) { err.textContent = ex.message; }
    };
  }

  marco();
}

// Reduce la foto a 320×320 JPEG para que pese poco
function reducirFoto(file) {
  return new Promise((res, rej) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      const lado = 320, s = Math.min(img.width, img.height);
      const cv = document.createElement("canvas"); cv.width = cv.height = lado;
      cv.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, lado, lado);
      URL.revokeObjectURL(url);
      res(cv.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("imagen")); };
    img.src = url;
  });
}

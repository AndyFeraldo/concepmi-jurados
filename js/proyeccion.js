// =========================================================
// PANEL DE PROYECCIÓN · laptop del auditorio (acceso limitado con permisos.proyeccion).
// Un menú limpio, sin nada del admin, con todo lo que se proyecta: ceremonias, charlas
// (presentación del ponente y trivia), concursos del escenario y la premiación final.
// Al cerrar una pantalla se vuelve a este menú. La base de datos limita lo que puede hacer:
// leer y proyectar, manejar la trivia (iniciar, detener, confirmar podio) y el tiempo de los concursos.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611120159";
import { CHARLAS } from "./charlas.js?v=202611120159";
import { ENTREGABLES } from "./entregables.js?v=202611120159";
import { porId } from "./concursos.js?v=202611120159";
import { copaGeneral } from "./calculo.js?v=202611120159";
import { crearCharlas } from "./admin-charlas.js?v=202611120159";
import { proyectarCharlas } from "./admin-ponentes.js?v=202611120159";
import { TALLERES, HORA_TALLERES } from "./talleres.js?v=202611120159";
import { proyectarTalleres } from "./talleres-pres.js?v=202611120159";
import { abrirCeremonia, cargarPrograma } from "./inauguracion.js?v=202611120159";
import { abrirEscenario } from "./escenario.js?v=202611120159";
import { abrirSalaProyectos } from "./sala-proyectos.js?v=202611120159";
import { ordenarPorSorteo, abrirArchivo } from "./presentacion.js?v=202611120159";
import { $, $$, esc, I, IMG, aviso, fondoAnimado } from "./ui.js?v=202611120159";
import { salir } from "./app.js?v=202611120159";

export async function vistaProyeccion(app, codigo, acceso, { volver = null } = {}) {
  let data = null, pausado = false;
  const recargar = async () => { if (pausado) return; try { data = await api.adminDatos(codigo); } catch { /* usa lo cargado */ } };
  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo el panel de proyección…</div>`;
  try { data = await api.adminDatos(codigo); } catch (e) { aviso(e.message, "error"); return salir(); }
  const charlasUI = crearCharlas({ codigo: () => codigo, data: () => data, recargar, pausar: (p) => { pausado = p; } });
  const del = (id) => data.delegaciones.find((d) => d.id === id);
  const nomDel = (id) => del(id)?.siglas || del(id)?.nombre || "—";

  const conc = Object.keys(ENTREGABLES).map((id) => ({ id, c: porId(id), def: ENTREGABLES[id] }));
  const escenario = conc.filter((x) => x.def.tipo === "presentacion"), otros = conc.filter((x) => x.def.tipo !== "presentacion");
  const tarjeta = (attrs, ico, titulo, sub, extra = "") => `<button class="pyc-tarjeta" ${attrs}><span class="pyc-tarjeta__ico">${ico}</span><span class="pyc-tarjeta__txt"><b>${titulo}</b><small>${sub}</small></span>${extra}<span class="pyc-tarjeta__ir">${I.flecha}</span></button>`;

  app.innerHTML = `${fondoAnimado(18)}
    <header class="barra pyc-barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI"><span class="sep"></span>
      <div><div class="barra__titulo">Panel de Proyección</div><div class="barra__sub">${esc(acceso.nombre)} · VI CONCEPMI 2026</div></div>
      <div class="der">${volver ? `<button class="btn btn--mini btn--naranja" data-volver>${I.atras}<span>Volver a mi panel</span></button>` : ""}<button class="btn btn--mini" data-full>${I.vivo}<span>Pantalla completa</span></button><button class="btn btn--mini btn--icono" data-salir title="Salir" aria-label="Salir">${I.salir}</button></div>
    </header>
    <main class="contenedor pyc">
      <p class="pyc-ayuda">Elige qué proyectar. Cada pantalla se abre a pantalla completa y, al cerrarla, vuelves aquí. Los botones de control aparecen al mover el mouse.</p>
      <section class="pyc-grupo"><h2>${I.copa} Ceremonias</h2><div class="pyc-grid">
        ${tarjeta("data-inaug", "✦", "Ceremonia de inauguración", "9:30 – 10:15 · programa, reloj, Freeze y paso a la Charla I")}
        ${tarjeta("data-premiacion", "🏆", "Premiación final · Copa CONCEPMI", "Del último puesto al TOP 3 con los Wolfitos de bronce, plata y oro")}
      </div></section>
      <section class="pyc-grupo"><h2>${I.vivo} Charlas magistrales</h2><div class="pyc-charlas">
        ${CHARLAS.map((c, k) => `<article class="pyc-charla c-${c.color}">
          <div class="pyc-charla__cab"><span>Charla ${c.num}</span><b>${esc(c.nombre)}</b><small>${esc(c.ponente)} · ${esc(c.dia)} · ${esc(c.hora)}</small></div>
          <div class="pyc-charla__acc">
            <button class="btn btn--naranja" data-ponencia="${k}">${I.pizarra}1 · Presentación del ponente</button>
            <button class="btn" data-trivia="${c.id}">${I.vivo}2 · Trivia en el auditorio</button>
          </div></article>`).join("")}
      </div></section>
      <section class="pyc-grupo"><h2>${I.pizarra} Talleres (${esc(HORA_TALLERES)})</h2><div class="pyc-grid">
        ${TALLERES.map((t) => tarjeta(`data-taller-proy="${t.id}"`, t.num, `Taller ${t.num} · ${esc(t.nombre)}`, `${esc(t.lugar)} · presentación del tallerista en PDF`)).join("")}
      </div></section>
      <section class="pyc-grupo"><h2>${I.pizarra} Concursos en el escenario</h2><div class="pyc-grid">
        ${escenario.map((x) => tarjeta(`data-concurso="${x.id}"`, "▶", esc(x.c?.nombre || x.id), `Presentaciones en PDF con el puntero · ${x.def.cortos?.exp || 5} min + ${x.def.cortos?.preg || 3} min de preguntas`)).join("")}
      </div></section>
      <details class="pyc-grupo pyc-otros"><summary>${I.tabla} Otros concursos (se proyectan en su propio salón)</summary><div class="pyc-grid">
        ${otros.map((x) => tarjeta(`data-concurso="${x.id}"`, "⏱", esc(x.c?.nombre || x.id), `Pantalla del concurso: tiempo oficial y exposiciones de ${esc(x.def.plural || "los equipos")}`)).join("")}
      </div></details>
    </main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;

  $("[data-salir]", app).onclick = salir;
  if (volver) $("[data-volver]", app).onclick = volver;
  $("[data-full]", app).onclick = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
  const ocupado = (b, fn) => async () => { b.disabled = true; try { await fn(); } catch (e) { aviso(e.message, "error"); } b.disabled = false; };
  const ponentes = () => api.adminPonentes(codigo);

  $("[data-inaug]", app).onclick = ocupado($("[data-inaug]", app), async () => {
    const P = await cargarPrograma(codigo);
    abrirCeremonia(P, { abrirCharla: async (k = 0) => { try { proyectarCharlas(codigo, await ponentes(), k); } catch (e) { aviso(e.message, "error"); } } });
  });
  $("[data-premiacion]", app).onclick = ocupado($("[data-premiacion]", app), async () => {
    await recargar(); const { abrirPremiacion } = await import("./premiacion.js?v=202611120159"); abrirPremiacion(copaGeneral(data));
  });
  $$("[data-ponencia]", app).forEach((b) => (b.onclick = ocupado(b, async () => proyectarCharlas(codigo, await ponentes(), Number(b.dataset.ponencia)))));
  $$("[data-trivia]", app).forEach((b) => (b.onclick = ocupado(b, async () => { await recargar(); charlasUI.proyector(b.dataset.trivia); })));
  $$("[data-concurso]", app).forEach((b) => (b.onclick = ocupado(b, () => abrirConcurso(b.dataset.concurso))));
  $$("[data-taller-proy]", app).forEach((b) => (b.onclick = ocupado(b, async () => proyectarTalleres(codigo, await api.talleresPres(codigo), b.dataset.tallerProy))));

  async function abrirConcurso(concurso) {
    const def = ENTREGABLES[concurso], c = porId(concurso);
    const nombre = (e) => nomDel(e.delegacion_id);
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
    abrirEscenario({ concurso, cargar, nombre, accion: (a, min) => api.adminTiempo(codigo, concurso, a, min) });
  }
}

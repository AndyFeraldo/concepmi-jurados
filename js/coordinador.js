// =========================================================
// Vista del COORDINADOR DE SALA: solo la pestaña Entregas de sus concursos
// (códigos de equipo, tiempo oficial, pantalla del concurso, reabrir, reportes).
// No ve calificaciones sueltas, jurados (códigos), logística ni la Copa.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611030820";
import { crearEntregas } from "./admin-entregas.js?v=202611030820";
import { ENTREGABLES } from "./entregables.js?v=202611030820";
import { $, esc, I, IMG, aviso } from "./ui.js?v=202611030820";
import { salir } from "./app.js?v=202611030820";

export async function vistaCoordinador(app, codigo) {
  let data = null;
  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo tu sala…</div>`;
  try { data = await api.coordDatos(codigo); }
  catch (e) { aviso(e.message, "error"); return salir(); }

  const concursos = data.coordinador.concursos.filter((k) => ENTREGABLES[k]);
  const recargar = async () => { try { data = await api.coordDatos(codigo); } catch { /* sigue con lo cargado */ } };
  const ui = crearEntregas({ codigo: () => codigo, data: () => data, recargar, concursos, coordinador: true });

  app.innerHTML = `<div class="fondo fondo--sobrio"></div>
    <header class="barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">Coordinador de sala</div><div class="barra__sub">${esc(data.coordinador.nombre)} · VI CONCEPMI 2026</div></div>
      <div class="der">
        <span class="en-vivo"><span class="punto punto--vivo"></span>EN VIVO</span>
        <button class="btn btn--mini btn--icono" data-salir title="Salir" aria-label="Salir">${I.salir}</button>
      </div>
    </header>
    <main class="contenedor"><section id="vista"></section></main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
  $("[data-salir]", app).onclick = salir;
  if (!concursos.length) {
    $("#vista", app).innerHTML = `<div class="vacio"><b>No tienes concursos con entregas asignados</b>Pide al administrador que te asigne uno.</div>`;
    return;
  }
  ui.vista($("#vista", app));
  // Las calificaciones (para los reportes) se ponen al día cada 30 s
  const t = setInterval(() => { if (!document.body.contains($("#vista", app))) return clearInterval(t); if (!document.hidden) recargar(); }, 30000);
}

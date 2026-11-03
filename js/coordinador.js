// =========================================================
// Vista de un ACCESO LIMITADO (entra por la puerta Admin con su propio código):
//  · Coordinador de sala: solo Entregas de sus concursos (códigos de equipo, tiempo,
//    pantalla del concurso, reabrir, reportes), sin aplicar sanciones.
//  · Líder de logística: solo la pestaña Logística.
// No ve calificaciones sueltas, códigos de jurados, la Copa ni nada más.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611031800";
import { crearEntregas } from "./admin-entregas.js?v=202611031800";
import { crearLogistica } from "./admin-logistica.js?v=202611031800";
import { ENTREGABLES } from "./entregables.js?v=202611031800";
import { $, $$, esc, I, IMG, aviso } from "./ui.js?v=202611031800";
import { salir } from "./app.js?v=202611031800";

export async function vistaCoordinador(app, codigo) {
  let data = null;
  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo tu panel…</div>`;
  try { data = await api.coordDatos(codigo); }
  catch (e) { aviso(e.message, "error"); return salir(); }

  const k = data.coordinador;
  const concursos = k.concursos.filter((x) => ENTREGABLES[x]);
  const recargar = async () => { try { data = await api.coordDatos(codigo); } catch { /* sigue con lo cargado */ } };
  const pestanas = [];
  if (concursos.length) pestanas.push({ id: "entregas", txt: "Entregas", icono: "lapiz", ui: crearEntregas({ codigo: () => codigo, data: () => data, recargar, concursos, coordinador: true }) });
  if (k.logistica) pestanas.push({ id: "logistica", txt: "Logística", icono: "caja", ui: crearLogistica({ codigo: () => codigo }) });
  let actual = pestanas[0]?.id;
  const titulo = pestanas.length === 1 && actual === "logistica" ? "Logística" : concursos.length && !k.logistica ? "Coordinador de sala" : "Panel de acceso limitado";

  app.innerHTML = `<div class="fondo fondo--sobrio"></div>
    <header class="barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">${esc(titulo)}</div><div class="barra__sub">${esc(k.nombre)} · VI CONCEPMI 2026</div></div>
      <div class="der">
        <span class="en-vivo"><span class="punto punto--vivo"></span>EN VIVO</span>
        <button class="btn btn--mini btn--icono" data-salir title="Salir" aria-label="Salir">${I.salir}</button>
      </div>
    </header>
    <main class="contenedor">
      ${pestanas.length > 1 ? `<div class="pestanas" role="tablist">${pestanas.map((p) => `<button class="pestana" role="tab" data-p="${p.id}" aria-selected="${p.id === actual}">${I[p.icono]}${p.txt}</button>`).join("")}</div>` : ""}
      <section id="vista"></section>
    </main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
  $("[data-salir]", app).onclick = salir;
  if (!pestanas.length) {
    $("#vista", app).innerHTML = `<div class="vacio"><b>Tu acceso todavía no tiene nada asignado</b>Pide al administrador que te asigne un concurso o Logística.</div>`;
    return;
  }
  const pintar = () => pestanas.find((p) => p.id === actual).ui.vista($("#vista", app));
  $$("[data-p]", app).forEach((b) => (b.onclick = () => { actual = b.dataset.p; $$("[data-p]", app).forEach((x) => x.setAttribute("aria-selected", String(x === b))); pintar(); }));
  pintar();
  // Las calificaciones (para los reportes de Entregas) se ponen al día cada 30 s
  if (concursos.length) { const t = setInterval(() => { if (!document.body.contains($("#vista", app))) return clearInterval(t); if (!document.hidden) recargar(); }, 30000); }
}

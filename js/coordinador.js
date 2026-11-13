// =========================================================
// Vista de un ACCESO LIMITADO (entra por la puerta Admin con su propio código):
//  · Coordinador de sala: solo Entregas de sus concursos (códigos de equipo, tiempo,
//    pantalla del concurso, reabrir, reportes), sin aplicar sanciones.
//  · Líder de logística: solo la pestaña Logística.
// No ve calificaciones sueltas, códigos de jurados, la Copa ni nada más.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611131348";
import { crearEntregas } from "./admin-entregas.js?v=202611131348";
import { crearLogistica } from "./admin-logistica.js?v=202611131348";
import { ENTREGABLES } from "./entregables.js?v=202611131348";
import { $, $$, esc, I, IMG, aviso } from "./ui.js?v=202611131348";
import { vistaProyeccion } from "./proyeccion.js?v=202611131348";
import { crearCasos } from "./casos.js?v=202611131348";
import { crearGuia, vistaGuia } from "./diad.js?v=202611131348";
import { usaPanel, puede, soloVer, esProyeccion, soloGuia } from "./permisos.js?v=202611131348";
import { vistaAdmin } from "./admin.js?v=202611131348";
import { crearMiAcceso } from "./mi-acceso.js?v=202611131348";
import { salir, sesion } from "./app.js?v=202611131348";

export async function vistaCoordinador(app, codigo, puerta = "admin") {
  let data = null;
  app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="cargando"><div class="giro"></div>Abriendo tu panel…</div>`;
  try { data = await api.coordDatos(codigo); }
  catch (e) { aviso(e.message, "error"); return salir(); }

  const k = data.coordinador;
  // Con pestañas del admin (jurados, charlas, etc.) usa el panel completo, limitado a sus permisos
  if (soloGuia(k)) return vistaGuia(app, codigo, k, () => { soloVer(null); salir(); });
  const concursos = k.concursos.filter((x) => ENTREGABLES[x]);
  // Proyección ya no tapa lo demás: si además tiene pestañas, Entregas, Logística o Casos, entra a su panel
  // (con el botón «Proyección»). Solo va directo al Panel de Proyección si es lo único que tiene o entró por esa puerta.
  const conMas = usaPanel(k) || concursos.length > 0 || puede(k, "logistica", "ver") || puede(k, "casos");
  const abrirProyeccion = () => { const c = sesion.leer()?.codigo || codigo; soloVer(null);
    return vistaProyeccion(app, c, k, conMas ? { volver: () => vistaCoordinador(app, c, "admin") } : {}); };
  if (esProyeccion(k) && (puerta === "proyeccion" || !conMas)) return abrirProyeccion();
  if (usaPanel(k)) return vistaAdmin(app, codigo, k, { abrirProyeccion: esProyeccion(k) ? abrirProyeccion : null });
  const recargar = async () => { try { data = await api.coordDatos(codigo); } catch { /* sigue con lo cargado */ } };
  const pestanas = [];
  if (concursos.length) pestanas.push({ id: "entregas", txt: "Entregas", icono: "lapiz", ui: crearEntregas({ codigo: () => codigo, data: () => data, recargar, concursos, coordinador: true }) });
  if (puede(k, "logistica", "ver")) pestanas.push({ id: "logistica", txt: "Logística", icono: "caja", ui: crearLogistica({ codigo: () => codigo }) });
  pestanas.unshift({ id: "guia", txt: "Mi Día D", icono: "reloj", ui: crearGuia({ codigo: () => codigo }) });
  if (puede(k, "casos")) pestanas.unshift({ id: "casos", txt: "Casos confidenciales", icono: "candado", ui: crearCasos({ codigo: () => codigo, cambiarCodigo: (c) => { codigo = c; } }) });
  const ir = (id) => { if (!pestanas.some((p) => p.id === id)) return; actual = id; $$("[data-p]", app).forEach((x) => x.setAttribute("aria-selected", String(x.dataset.p === id))); pintar(); window.scrollTo(0, 0); };
  pestanas.unshift({ id: "inicio", txt: "Mi acceso", icono: "escudo", ui: crearMiAcceso(k, { entregas: () => ir("entregas"), logistica: () => ir("logistica"), casos: () => ir("casos"), guia: () => ir("guia"), proyeccion: abrirProyeccion }) });
  let actual = puede(k, "casos") ? "casos" : pestanas[0]?.id; // la encargada entra directo a sus casos (y a crear su código privado)
  const titulo = concursos.length && !puede(k, "logistica", "ver") ? "Coordinador de sala" : !concursos.length && puede(k, "logistica", "ver") ? (puede(k, "logistica") ? "Logística" : "Logística · solo lectura") : "Panel de acceso limitado";

  app.innerHTML = `<div class="fondo fondo--sobrio"></div>
    <header class="barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">${esc(titulo)}</div><div class="barra__sub">${esc(k.nombre)} · VI CONCEPMI 2026</div></div>
      <div class="der">
        <span class="en-vivo"><span class="punto punto--vivo"></span>EN VIVO</span>
        ${esProyeccion(k) ? `<button class="btn btn--mini btn--naranja" data-proy>${I.pizarra}<span>Proyección</span></button>` : ""}
        <button class="btn btn--mini btn--icono" data-salir title="Salir" aria-label="Salir">${I.salir}</button>
      </div>
    </header>
    <main class="contenedor">
      ${pestanas.length > 1 ? `<div class="pestanas" role="tablist">${pestanas.map((p) => `<button class="pestana" role="tab" data-p="${p.id}" aria-selected="${p.id === actual}">${I[p.icono]}${p.txt}</button>`).join("")}</div>` : ""}
      <section id="vista"></section>
    </main>
    ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
  $("[data-salir]", app).onclick = () => { soloVer(null); salir(); };
  if ($("[data-proy]", app)) $("[data-proy]", app).onclick = abrirProyeccion;
  if (!pestanas.length) {
    $("#vista", app).innerHTML = `<div class="vacio"><b>Tu acceso todavía no tiene nada asignado</b>Pide al administrador que te asigne un concurso o Logística.</div>`;
    return;
  }
  const pintar = () => { soloVer(actual === "logistica" && !puede(k, "logistica") ? "logistica" : null); pestanas.find((p) => p.id === actual).ui.vista($("#vista", app)); };
  $$("[data-p]", app).forEach((b) => (b.onclick = () => { actual = b.dataset.p; $$("[data-p]", app).forEach((x) => x.setAttribute("aria-selected", String(x === b))); pintar(); }));
  pintar();
  // Las calificaciones (para los reportes de Entregas) se ponen al día cada 30 s
  if (concursos.length) { const t = setInterval(() => { if (!document.body.contains($("#vista", app))) return clearInterval(t); if (!document.hidden) recargar(); }, 30000); }
}

// =========================================================
// Visor de entregables (solo lectura): tabla oficial de la matriz,
// pantalla completa para el proyector y versión imprimible.
// Lo usan el admin (pestaña Entregas) y los jurados.
// =========================================================
import { ENTREGABLES, resumenMatriz, nivel, NIVELES } from "./entregables.js?v=202611120159";
import { $, $$, esc, I, IMG } from "./ui.js?v=202611120159";
import { porId } from "./concursos.js?v=202611120159";
import { resultados } from "./calculo.js?v=202611120159";
import { formaDe } from "./formas.js?v=202611120159";

const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "");
export const tieneDatos = (e) => Object.keys(e?.datos || {}).length > 0;
export const estadoEntrega = (e) => (e.estado === "enviado" ? (e.tarde ? ["Enviado tarde", "chip--rojo"] : ["Enviado", "chip--verde"]) : e.actualizado && tieneDatos(e) ? ["En borrador", "chip--ambar"] : ["Sin empezar", ""]);

// Severidad de mayor a menor; las filas sin P o I van al final. Empates: amenazas primero y luego por número.
export function ordenar(filas, orden) {
  if (orden !== "sev") return filas;
  const num = (id) => Number(String(id).slice(1)) || 0;
  return filas.map((f, k) => ({ f, k })).sort((a, b) =>
    (a.f.sev == null) - (b.f.sev == null) || (b.f.sev ?? 0) - (a.f.sev ?? 0) ||
    (a.f.tipo === "Oportunidad") - (b.f.tipo === "Oportunidad") || num(a.f.id) - num(b.f.id) || a.k - b.k).map((x) => x.f);
}

export function tablaMatriz(datos, { orden = "id" } = {}) {
  const r = resumenMatriz(datos);
  const filas = ordenar(r.filas, orden);
  if (!filas.length) return `<div class="vacio"><b>Todavía no hay riesgos registrados</b></div>`;
  return `<div class="tabla-envoltura"><table class="tabla matriz-tabla"><thead><tr>
      <th>ID</th><th>Riesgo<br><small>Causa, Evento y Efecto</small></th><th>Tipo</th><th class="num">P</th><th class="num">I</th><th class="num">Severidad<br><small>P × I</small></th>
      <th>Estrategia</th><th>Plan de mitigación / Acción concreta</th><th>Dueño del riesgo</th><th>Disparador (trigger)</th></tr></thead>
    <tbody>${filas.map((f) => { const n = nivel(f.sev);
      return `<tr><td><b class="matriz-id ${f.tipo === "Oportunidad" ? "matriz-id--o" : ""}">${esc(f.id)}</b></td><td>${esc(f.riesgo)}</td><td>${esc(f.tipo)}</td>
        <td class="num">${esc(f.p)}</td><td class="num">${esc(f.i)}</td>
        <td class="num">${f.sev == null ? "—" : `<span class="sev ${n?.[3] || ""}"><b>${f.sev}</b> ${n ? n[0] : ""}</span>`}</td>
        <td>${esc(f.estrategia)}</td><td>${esc(f.plan)}</td><td>${esc(f.dueno)}</td><td>${esc(f.trigger)}</td></tr>`; }).join("")}</tbody></table></div>`;
}

export function resumenChips(datos) {
  const r = resumenMatriz(datos);
  return `<span class="chip">${r.total} riesgo${r.total === 1 ? "" : "s"}</span><span class="chip">${r.amenazas} amenaza${r.amenazas === 1 ? "" : "s"}</span><span class="chip">${r.oportunidades} oportunidad${r.oportunidades === 1 ? "" : "es"}</span>
    ${r.criticos ? `<span class="chip chip--rojo">${r.criticos} crítico${r.criticos === 1 ? "" : "s"}</span>` : ""}${r.incompletas ? `<span class="chip chip--ambar">${r.incompletas} incompleto${r.incompletas === 1 ? "" : "s"}</span>` : ""}`;
}

// ---- Funciones comunes a todos los tipos de entregable (matriz, acta) ----
export const esActa = (concurso) => !!formaDe(concurso); // formulario por secciones (acta, ficha MVP)
export const leyendaSev = () => `<p class="visor__ley">${NIVELES.map(([n, a, b, c]) => `<span class="sev ${c}">${n} ${a}–${b}</span>`).join(" ")}</p>`;
export const contenidoEntrega = (concurso, datos, { orden = "id", embed = false } = {}) => (esActa(concurso) ? formaDe(concurso).vista(datos, { embed }) : tablaMatriz(datos, { orden }) + leyendaSev());
export const chipsEntrega = (concurso, datos) => (esActa(concurso) ? formaDe(concurso).chips(datos) : resumenChips(datos));
export const conectarEntrega = (concurso, raiz) => formaDe(concurso)?.conectar(raiz);

// Pantalla completa con selector de equipos. cargar() → { tiempo, entregas: [...] }; nombre(e) → texto de la delegación
// notas() (opcional, solo admin) → data con calificaciones y jurados, para incluir los puntajes al imprimir
export function abrirVisor({ concurso, cargar, nombre, inicial = null, cadaMs = 5000, notas = null }) {
  const def = ENTREGABLES[concurso];
  const el = document.createElement("div");
  el.className = "proy visor";
  document.body.append(el);
  let lista = [], actual = inicial, orden = "id", vivo = true, ultimo = "";
  const cerrar = () => { vivo = false; clearInterval(t); document.removeEventListener("keydown", tecla); el.remove(); };
  function pintar() {
    const i = Math.max(0, lista.findIndex((e) => e.equipo_id === actual));
    const e = lista[i];
    const clave = JSON.stringify([actual, orden, e?.actualizado, e?.estado, lista.length]);
    if (clave === ultimo) return; ultimo = clave;
    const [txt, cls] = e ? estadoEntrega(e) : ["", ""];
    el.innerHTML = `
      <header class="proy__cab"><img class="logo" src="${IMG.logo}" alt="CONCEPMI">
        <div><div class="proy__tit">${esc(def?.titulo || "Entregable")}${e ? ` · ${esc(nombre(e))}` : ""}</div>
          ${e && esActa(concurso) && formaDe(concurso).proyecto(e.datos) ? `<div class="proy__sub">${formaDe(concurso).etiquetaProyecto}: <b>${esc(formaDe(concurso).proyecto(e.datos))}</b></div>` : ""}
          <div class="proy__sub">${e ? `${(e.datos?.lider || e.lider) ? `Líder: ${esc(e.datos?.lider || e.lider)} · ` : ""}<span class="chip ${cls}">${txt}</span>${e.enviado ? ` a las ${hora(e.enviado)}` : e.actualizado ? ` · guardado ${hora(e.actualizado)}` : ""}` : "Sin equipos"}</div></div>
        <div class="der">
          <select class="visor-sel" data-sel aria-label="Equipo">${lista.map((x) => `<option value="${x.equipo_id}" ${x.equipo_id === e?.equipo_id ? "selected" : ""}>${esc(nombre(x))} · ${estadoEntrega(x)[0]}</option>`).join("")}</select>
          <button class="btn btn--mini" data-ant title="Equipo anterior" aria-label="Equipo anterior">◀</button><button class="btn btn--mini" data-sig title="Equipo siguiente" aria-label="Equipo siguiente">▶</button>
          ${esActa(concurso) ? "" : `<div class="segm" role="group" aria-label="Orden de la matriz"><span>Orden</span><button class="${orden === "id" ? "activo" : ""}" data-orden="id" aria-pressed="${orden === "id"}">ID</button><button class="${orden === "sev" ? "activo" : ""}" data-orden="sev" aria-pressed="${orden === "sev"}">Severidad ▼</button></div>`}
          <button class="btn btn--mini" data-imp>${I.descargar}<span>Imprimir / PDF</span></button>
          <button class="btn btn--mini" data-cerrar>${I.cerrar}<span>Cerrar</span></button></div></header>
      <main class="visor__cuerpo">${e ? `<div class="reparto" style="margin:0 0 10px">${chipsEntrega(concurso, e.datos)}${orden === "sev" && !esActa(concurso) ? `<span class="chip chip--celeste">Ordenado por severidad: de mayor a menor</span>` : ""}</div>${contenidoEntrega(concurso, e.datos, { orden, embed: true })}` : `<div class="vacio"><b>Aún no hay equipos en este concurso</b></div>`}</main>`;
    $("[data-cerrar]", el).onclick = cerrar;
    if (e) conectarEntrega(concurso, el);
    $("[data-sel]", el)?.addEventListener("change", (ev) => { actual = ev.target.value; pintar(); });
    $("[data-ant]", el).onclick = () => mover(-1); $("[data-sig]", el).onclick = () => mover(1);
    $$("[data-orden]", el).forEach((b) => (b.onclick = () => { orden = b.dataset.orden; pintar(); }));
    $("[data-imp]", el).onclick = async () => imprimir(concurso, e ? [e] : [], nombre, { notas: notas ? await notas() : null, orden });
  }
  function mover(p) { if (!lista.length) return; const i = lista.findIndex((e) => e.equipo_id === actual); actual = lista[(i + p + lista.length) % lista.length].equipo_id; pintar(); }
  async function leer() {
    try { lista = (await cargar()).entregas || []; if (!lista.some((e) => e.equipo_id === actual)) actual = lista[0]?.equipo_id || null; pintar(); }
    catch (e) { el.innerHTML = `<div class="vacio" style="margin:40px"><b>No se pudo cargar</b>${esc(e.message)}</div>`; }
  }
  const tecla = (e) => { if (e.key === "Escape") cerrar(); if (e.key === "ArrowRight") mover(1); if (e.key === "ArrowLeft") mover(-1); };
  document.addEventListener("keydown", tecla);
  const t = setInterval(() => vivo && leer(), cadaMs);
  el.innerHTML = `<div class="cargando"><div class="giro"></div>Cargando entregas…</div>`;
  leer();
  return { cerrar };
}

// Reporte imprimible / PDF: una hoja por equipo con datos clave, la matriz y
// (si se pasa opts.notas = data del admin) lo que puso cada jurado y el puntaje final.
export function imprimir(concurso, entregas, nombre, { notas = null, orden = "id" } = {}) {
  const def = ENTREGABLES[concurso], c = porId(concurso);
  const w = window.open("", "_blank");
  if (!w) return alert("Tu navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.");
  const abs = (u) => new URL(u, location.href).href;
  const fecha = (ts) => (ts ? new Date(ts).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—");
  const res = notas ? resultados(concurso, notas) : [];
  const sp = c?.subpruebas?.[0];
  const n1 = (x) => (x == null ? "—" : Number(x).toLocaleString("es-PE", { maximumFractionDigits: 1 }));

  function bloqueNotas(e) {
    if (!notas || !sp) return "";
    const fila = res.find((f) => f.delegacion.id === e.delegacion_id);
    const cs = notas.calificaciones.filter((x) => x.concurso_id === concurso && x.subprueba === sp.id && x.delegacion_id === e.delegacion_id);
    const jur = (id) => notas.jurados.find((j) => j.id === id)?.nombre || "Jurado";
    if (!cs.length) return `<h2>Calificación del jurado</h2><p class="vacio">Aún no hay calificaciones registradas para esta delegación.</p>`;
    const total = sp.criterios.reduce((s, k) => s + k.max, 0);
    return `<h2>Calificación del jurado</h2>
      <table class="notas"><thead><tr><th>Criterio</th><th class="n">Máx.</th>${cs.map((x) => `<th class="n">${esc(jur(x.jurado_id))}</th>`).join("")}<th class="n prom">Promedio</th></tr></thead><tbody>
      ${sp.criterios.map((k) => `<tr><td>${esc(k.nombre)}</td><td class="n">${k.max}</td>${cs.map((x) => `<td class="n">${n1(x.datos?.[k.id])}</td>`).join("")}<td class="n prom">${n1(fila?.promCrit?.[k.id])}</td></tr>`).join("")}
      <tr class="tot"><td>Total</td><td class="n">${total}</td>${cs.map((x) => `<td class="n">${n1(x.total)}</td>`).join("")}<td class="n prom">${n1(fila?.bruto)}</td></tr></tbody></table>
      ${cs.some((x) => String(x.comentario || "").trim()) ? `<div class="coms">${cs.filter((x) => String(x.comentario || "").trim()).map((x) => `<p><b>${esc(jur(x.jurado_id))}:</b> ${esc(x.comentario)}</p>`).join("")}</div>` : ""}
      <p class="calc">Puntaje final = ${cs.length === 1 ? "puntaje del único jurado que calificó" : `promedio de los ${cs.length} jurados`} (${n1(fila?.bruto)})${fila?.penal ? ` − ${n1(fila.penal)} por entrega tardía (10 % de la fase escrita)` : ""}${fila?.ajuste?.walkover ? " · Walkover = 0" : fila?.ajuste?.descalificado ? " · Descalificado = 0" : ""}, redondeado a entero: <b>${fila?.rubrica ?? "—"} / ${total}</b>.</p>`;
  }

  function hoja(e) {
    const pres = def?.tipo === "presentacion", acta = esActa(concurso), F = formaDe(concurso), r = resumenMatriz(e.datos), ra = acta ? F.resumen(e.datos) : null, [est] = estadoEntrega(e);
    const fila = notas ? res.find((f) => f.delegacion.id === e.delegacion_id) : null;
    const total = sp ? sp.criterios.reduce((s, k) => s + k.max, 0) : 0;
    return `<section class="hoja">
      <header class="cab"><img src="${abs(IMG.logo)}" alt="CONCEPMI VI"><div><b>${esc(c?.nombre || "")} · ${esc(def?.titulo || "")}</b><span>VI CONCEPMI 2026 · Reporte oficial de entrega</span></div><img src="${abs(IMG.club)}" alt="PMI Lima Student Club" class="club"></header>
      <div class="datos">
        <div class="dato grande"><span>Delegación</span><b>${esc(nombre(e))}</b></div>
        <div class="dato"><span>Líder</span><b>${esc(e.datos?.lider || e.lider || "—")}</b></div>
        ${pres ? "" : `<div class="dato"><span>Hora de envío</span><b>${e.enviado ? fecha(e.enviado) : "No enviada"}</b></div>
        <div class="dato ${e.tarde ? "mal" : e.estado === "enviado" ? "bien" : ""}"><span>Estado</span><b>${e.estado === "enviado" ? (e.tarde ? "Entrega tardía" : "A tiempo") : esc(est)}</b></div>`}
        ${pres ? `<div class="dato"><span>Proyecto</span><b>${esc(e.datos?.proyecto || "—")}</b></div>` : acta ? `<div class="dato"><span>Secciones</span><b>${F.resumenPdf(ra)}</b></div>` : `<div class="dato"><span>Riesgos</span><b>${r.total} · ${r.amenazas} A / ${r.oportunidades} O</b></div>`}
        ${fila ? `<div class="dato final"><span>Puntaje final</span><b>${fila.rubrica} <small>/ ${total}</small></b>${fila.puesto ? `<em>${fila.puesto}.° lugar${fila.empate ? " (empate)" : ""}</em>` : ""}</div>` : ""}
      </div>
      ${pres ? "" : acta ? `<h2>${esc(def?.titulo || "")}${ra.proyecto ? ` · <small>${esc(ra.proyecto)}</small>` : ""}</h2>${F.vista(e.datos)}` : `<h2>Matriz de riesgos y oportunidades${orden === "sev" ? " <small>(ordenada por severidad)</small>" : ""}</h2>
      <table class="mat"><thead><tr><th>ID</th><th>Riesgo (causa, evento y efecto)</th><th>Tipo</th><th class="n">P</th><th class="n">I</th><th class="n">P×I</th><th>Estrategia</th><th>Plan / acción concreta</th><th>Dueño</th><th>Disparador</th></tr></thead>
      <tbody>${ordenar(r.filas, orden).map((f) => { const n = nivel(f.sev); return `<tr><td><b>${esc(f.id)}</b></td><td>${esc(f.riesgo)}</td><td>${esc(f.tipo)}</td><td class="n">${esc(f.p)}</td><td class="n">${esc(f.i)}</td>
        <td class="n">${f.sev == null ? "—" : `<span class="sev ${n?.[3] || ""}">${f.sev}</span>`}</td><td>${esc(f.estrategia)}</td><td>${esc(f.plan)}</td><td>${esc(f.dueno)}</td><td>${esc(f.trigger)}</td></tr>`; }).join("") || `<tr><td colspan="10">Sin riesgos registrados</td></tr>`}</tbody></table>
      <p class="ley">${NIVELES.map(([nn, a, b, cl]) => `<span class="sev ${cl}">${nn} ${a}–${b}</span>`).join(" ")}</p>`}
      ${bloqueNotas(e)}
      <footer class="pie">Generado el ${fecha(Date.now())} · Panel de Jurados VI CONCEPMI · Documento para los delegados de la delegación</footer>
    </section>`;
  }

  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(c?.nombre || "")} · ${esc(def?.titulo || "Entregables")} · VI CONCEPMI 2026</title>
    <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
    *{box-sizing:border-box}body{font-family:Poppins,"Segoe UI",Arial,sans-serif;color:#1d1b29;background:#eceaf3;margin:0;font-size:9.5px;line-height:1.35}
    .hoja{background:#fff;max-width:277mm;margin:14px auto;padding:9mm 10mm;box-shadow:0 4px 18px rgba(0,0,0,.12);page-break-after:always}.hoja:last-child{page-break-after:auto}
    .cab{display:flex;align-items:center;gap:12px;background:linear-gradient(100deg,#170D56,#3A1AA8 70%,#6E2BE6);color:#fff;border-radius:8px;padding:8px 12px}
    .cab img{height:26px}.cab .club{height:30px;margin-left:auto}.cab div{display:grid}.cab b{font-size:13px}.cab span{font-size:9px;opacity:.8;letter-spacing:.06em;text-transform:uppercase}
    .datos{display:grid;grid-template-columns:2fr 1.4fr 1.3fr 1fr 1fr 1.1fr;gap:6px;margin:8px 0}
    .dato{border:1px solid #ddd8ee;border-radius:7px;padding:5px 8px;display:grid;align-content:start}.dato span{font-size:8px;text-transform:uppercase;letter-spacing:.08em;color:#6b6585;font-weight:600}
    .dato b{font-size:11px}.dato.grande b{font-size:13px}.dato.bien{border-color:#0ca30c;background:#effaef}.dato.mal{border-color:#d03b3b;background:#fdf0f0}
    .dato.final{background:#FF6A1F;border-color:#FF6A1F;color:#fff}.dato.final span{color:#ffe3d3}.dato.final b{font-size:20px;line-height:1}.dato.final small{font-size:11px;opacity:.85}.dato.final em{font-style:normal;font-size:9px;font-weight:600}
    h2{font-size:11px;margin:10px 0 4px;color:#3A1AA8;text-transform:uppercase;letter-spacing:.06em}h2 small{text-transform:none;color:#6b6585;font-weight:400}
    table{width:100%;border-collapse:collapse}th,td{border:1px solid #d5d0e6;padding:3px 5px;vertical-align:top;text-align:left}th{background:#ece8fb;font-size:8.5px}
    .n{text-align:center;white-space:nowrap}.mat td:nth-child(2),.mat td:nth-child(8){min-width:120px}
    .sev{font-weight:700;padding:0 5px;border-radius:4px;white-space:nowrap}.sev-bajo{background:#d6f5d6}.sev-mod{background:#fff1c2}.sev-alto{background:#ffd9c7}.sev-crit{background:#f7c1c1}
    .ley{margin:4px 0 0;display:flex;gap:5px;font-size:8px}
    .notas{width:auto;min-width:60%}.notas .prom{background:#fff4ec;font-weight:700}.notas .tot td{font-weight:700;background:#f6f4fc}
    .coms{margin-top:5px;border-left:3px solid #6E2BE6;padding:2px 8px;background:#faf9fd}.coms p{margin:2px 0}
    .calc{margin:6px 0 0;font-size:10px}
    .acta-v{display:grid;grid-template-columns:repeat(2,1fr);gap:6px}.acta-v__sec{border:1px solid #ddd8ee;border-radius:7px;padding:5px 8px;page-break-inside:avoid}
    .acta-v__sec--general,.acta-v__sec--firmas,.acta-v__sec--objetivos,.acta-v__sec--interesados{grid-column:1/-1}
    .acta-v h4{margin:0 0 4px;font-size:10px;color:#3A1AA8;display:flex;gap:6px;align-items:center}.acta-v h4 span{background:#3A1AA8;color:#fff;border-radius:4px;padding:0 5px;font-size:9px}
    .acta-v__falta{font-style:normal;color:#d03b3b;font-weight:600;font-size:8.5px}.acta-v__vacio{color:#a09bb5}
    .acta-v dl{margin:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:3px 10px}.acta-v dt{font-size:8px;text-transform:uppercase;letter-spacing:.05em;color:#6b6585;font-weight:600}.acta-v dd{margin:0}
    .acta-v table td,.acta-v table th{padding:2px 4px}.acta-v__tot td{font-weight:700;background:#f6f4fc}
    .acta-v__firmas{display:flex;gap:30px;justify-content:center}.acta-v__firmas figure{margin:0;text-align:center}.acta-v__firmas img{height:56px;border-bottom:1px solid #1d1b29}
    .mvp-v{display:grid;gap:6px}.mvp-v__link{display:flex;gap:12px;align-items:center;border:1px solid #ddd8ee;border-radius:7px;padding:6px 10px}.mvp-v__qr svg{width:84px;height:84px}
    .mvp-v__dato{display:grid;gap:2px}.mvp-v__dato small{font-size:8px;text-transform:uppercase;color:#6b6585;font-weight:600}.mvp-v__dato b{font-size:13px}.mvp-v__url{color:#3A1AA8;word-break:break-all;font-weight:600}
    .mvp-v__acc,.mvp-v__marco{display:none}.mvp-v__prompt{white-space:pre-wrap;font-family:inherit;font-size:8.5px;margin:0;background:#faf9fd;padding:4px 6px;border-radius:4px}.mvp-v__ia{margin:0 0 3px}
    .acta-v__firmas figcaption{display:grid;font-size:9px}.acta-v__sinfirma{height:56px;width:170px;border-bottom:1px solid #1d1b29;color:#a09bb5;display:grid;place-items:end center}.vacio{color:#6b6585;font-style:italic}
    .pie{margin-top:10px;padding-top:5px;border-top:1px solid #e3dff0;color:#8a84a3;font-size:8px;text-align:center}
    tr,.datos,.coms{page-break-inside:avoid}
    .barra{position:sticky;top:0;background:#170D56;color:#fff;padding:8px 14px;display:flex;align-items:center;gap:10px;font-size:12px;z-index:2}
    .barra button{margin-left:auto;padding:7px 14px;border:0;border-radius:6px;background:#FF6A1F;color:#fff;font-weight:700;cursor:pointer;font:inherit;font-weight:700}
    @page{size:A4 landscape;margin:8mm}
    @media print{body{background:#fff}.barra{display:none}.hoja{box-shadow:none;margin:0;max-width:none;padding:0}*{-webkit-print-color-adjust:exact;print-color-adjust:exact}}
    </style></head><body>
    <div class="barra">${entregas.length} reporte${entregas.length === 1 ? "" : "s"} · una hoja por delegación. En «Destino» elige <b>Guardar como PDF</b>.<button onclick="print()">Imprimir / Guardar PDF</button></div>
    ${entregas.map(hoja).join("")}
    </body></html>`);
  w.document.close();
}

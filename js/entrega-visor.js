// =========================================================
// Visor de entregables (solo lectura): tabla oficial de la matriz,
// pantalla completa para el proyector y versión imprimible.
// Lo usan el admin (pestaña Entregas) y los jurados.
// =========================================================
import { ENTREGABLES, resumenMatriz, nivel, NIVELES } from "./entregables.js?v=202611030621";
import { $, $$, esc, I, IMG } from "./ui.js?v=202611030621";

const hora = (ts) => (ts ? new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" }) : "");
export const estadoEntrega = (e) => (e.estado === "enviado" ? (e.tarde ? ["Enviado tarde", "chip--rojo"] : ["Enviado", "chip--verde"]) : e.actualizado ? ["En borrador", "chip--ambar"] : ["Sin empezar", ""]);

export function tablaMatriz(datos, { orden = "id" } = {}) {
  const r = resumenMatriz(datos);
  const filas = orden === "sev" ? [...r.filas].sort((a, b) => (b.sev ?? 0) - (a.sev ?? 0)) : r.filas;
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

// Pantalla completa con selector de equipos. cargar() → { tiempo, entregas: [...] }; nombre(e) → texto de la delegación
export function abrirVisor({ concurso, cargar, nombre, inicial = null, cadaMs = 5000 }) {
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
          <div class="proy__sub">${e ? `${(e.datos?.lider || e.lider) ? `Líder: ${esc(e.datos?.lider || e.lider)} · ` : ""}<span class="chip ${cls}">${txt}</span>${e.enviado ? ` a las ${hora(e.enviado)}` : e.actualizado ? ` · guardado ${hora(e.actualizado)}` : ""}` : "Sin equipos"}</div></div>
        <div class="der">
          <select class="visor-sel" data-sel aria-label="Equipo">${lista.map((x) => `<option value="${x.equipo_id}" ${x.equipo_id === e?.equipo_id ? "selected" : ""}>${esc(nombre(x))} · ${estadoEntrega(x)[0]}</option>`).join("")}</select>
          <button class="btn btn--mini" data-ant title="Equipo anterior" aria-label="Equipo anterior">◀</button><button class="btn btn--mini" data-sig title="Equipo siguiente" aria-label="Equipo siguiente">▶</button>
          <button class="btn btn--mini" data-orden>${orden === "id" ? "Ordenar por severidad" : "Ordenar por ID"}</button>
          <button class="btn btn--mini" data-imp>${I.descargar}<span>Imprimir / PDF</span></button>
          <button class="btn btn--mini" data-cerrar>${I.cerrar}<span>Cerrar</span></button></div></header>
      <main class="visor__cuerpo">${e ? `<div class="reparto" style="margin:0 0 10px">${resumenChips(e.datos)}</div>${tablaMatriz(e.datos, { orden })}
        <p class="visor__ley">${NIVELES.map(([n, a, b, c]) => `<span class="sev ${c}">${n} ${a}–${b}</span>`).join(" ")}</p>` : `<div class="vacio"><b>Aún no hay equipos en este concurso</b></div>`}</main>`;
    $("[data-cerrar]", el).onclick = cerrar;
    $("[data-sel]", el)?.addEventListener("change", (ev) => { actual = ev.target.value; pintar(); });
    $("[data-ant]", el).onclick = () => mover(-1); $("[data-sig]", el).onclick = () => mover(1);
    $("[data-orden]", el).onclick = () => { orden = orden === "id" ? "sev" : "id"; pintar(); };
    $("[data-imp]", el).onclick = () => imprimir(concurso, e ? [e] : [], nombre);
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

// Página blanca lista para imprimir o guardar en PDF (una matriz por hoja)
export function imprimir(concurso, entregas, nombre) {
  const def = ENTREGABLES[concurso];
  const w = window.open("", "_blank");
  if (!w) return alert("Tu navegador bloqueó la ventana. Permite las ventanas emergentes para este sitio.");
  w.document.write(`<!doctype html><html lang="es"><head><meta charset="utf-8"><title>${esc(def?.titulo || "Entregables")} · VI CONCEPMI 2026</title>
    <style>body{font-family:Poppins,Segoe UI,Arial,sans-serif;color:#1d1b29;background:#fff;margin:16px;font-size:11px}h1{font-size:16px;margin:0}p{margin:2px 0 8px;color:#444}
    table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border:1px solid #bbb;padding:4px 5px;vertical-align:top;text-align:left}th{background:#ece8fb;font-size:10px}
    .n{text-align:center}.sev{font-weight:700;padding:1px 5px;border-radius:4px}.sev-bajo{background:#d6f5d6}.sev-mod{background:#fff1c2}.sev-alto{background:#ffd9c7}.sev-crit{background:#f7c1c1}
    .hoja{page-break-after:always}.hoja:last-child{page-break-after:auto}@page{size:A4 landscape;margin:10mm}.noimp{float:right;padding:6px 12px;border:0;border-radius:6px;background:#FF6A1F;color:#fff;font-weight:700}@media print{.noimp{display:none}}</style></head><body>
    <button class="noimp" onclick="print()">Imprimir / Guardar PDF</button>
    ${entregas.map((e) => { const r = resumenMatriz(e.datos); return `<section class="hoja"><h1>${esc(def?.titulo || "")} · VI CONCEPMI 2026</h1>
      <p><b>Delegación:</b> ${esc(nombre(e))} · <b>Líder:</b> ${esc(e.datos?.lider || e.lider || "—")} · <b>Estado:</b> ${esc(estadoEntrega(e)[0])}${e.enviado ? ` (${new Date(e.enviado).toLocaleString("es-PE")})` : ""} · ${r.total} riesgos (${r.amenazas} amenazas, ${r.oportunidades} oportunidades)</p>
      <table><thead><tr><th>ID</th><th>Riesgo (Causa, Evento y Efecto)</th><th>Tipo</th><th>P</th><th>I</th><th>P×I</th><th>Estrategia</th><th>Plan de mitigación / Acción concreta</th><th>Dueño</th><th>Disparador</th></tr></thead>
      <tbody>${r.filas.map((f) => { const n = nivel(f.sev); return `<tr><td><b>${esc(f.id)}</b></td><td>${esc(f.riesgo)}</td><td>${esc(f.tipo)}</td><td class="n">${esc(f.p)}</td><td class="n">${esc(f.i)}</td>
        <td class="n">${f.sev == null ? "" : `<span class="sev ${n?.[3] || ""}">${f.sev}</span>`}</td><td>${esc(f.estrategia)}</td><td>${esc(f.plan)}</td><td>${esc(f.dueno)}</td><td>${esc(f.trigger)}</td></tr>`; }).join("") || `<tr><td colspan="10">Sin riesgos registrados</td></tr>`}</tbody></table></section>`; }).join("")}
    </body></html>`);
  w.document.close();
}

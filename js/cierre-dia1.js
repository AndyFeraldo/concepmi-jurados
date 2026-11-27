// =========================================================
// Pantallas del final del Día 1 (martes 24/11) en el auditorio, después del Show en vivo:
//   1 · Concurso de Barras: pantalla de fondo (el operador pone la música) con las delegaciones de la
//       pestaña Delegaciones; ← → marca la que se presenta ahora.
//   2 · Ganadores de Proyectos, Amateur I, Amateur II e IATHON (en ese orden): revelación 3.º → 2.º → 1.º
//       (Espacio), con redoble y confeti. Los tres últimos compiten de 5:00 a 6:30 y se anuncian aquí.
//   3 · Cierre del Día 1: «Así va la Copa CONCEPMI» (puntaje acumulado de todas las delegaciones) y
//       después «¡Nos vemos el jueves 26!».
// Usa el mismo marco de pantalla completa del Show (`pantalla` de show.js), que registra la pantalla
// para la barra «Siguiente» del Panel de Proyección.
// =========================================================
import { resultados, copaGeneral } from "./calculo.js?v=202611271603";
import { pantalla, tono, fanfarria } from "./show.js?v=202611271603";
import { $, esc, IMG, aviso, lanzarConfeti } from "./ui.js?v=202611271603";

const cabeza = (kicker, titulo) => `<header class="cd-cab"><img src="${IMG.logo}" alt="CONCEPMI"><div><small>${kicker}</small><b>${titulo}</b></div></header>`;
const redoble = (ms = 1600) => { const fin = Date.now() + ms; const r = () => { if (Date.now() > fin) return; tono(120 + Math.random() * 40, 0.05, "triangle", 0.07); setTimeout(r, 70); }; r(); };

// =================== 1 · CONCURSO DE BARRAS ===================
export function abrirBarras(delegaciones) {
  const dels = (delegaciones || []).filter((d) => d.nombre).sort((a, b) => (a.siglas || a.nombre).localeCompare(b.siglas || b.nombre));
  if (!dels.length) return aviso("Aún no hay delegaciones registradas", "error");
  let i = -1;
  const p = pantalla("cd-barras", `
    <div class="cd-barras__fondo" aria-hidden="true">${Array.from({ length: 14 }, (_, k) => `<i style="--k:${k};--h:${35 + ((k * 37) % 55)}%"></i>`).join("")}</div>
    ${cabeza("VI CONCEPMI 2026 · Día 1", "¡Que suene tu delegación!")}
    <main class="cd-barras__centro">
      <small class="cd-barras__kicker">Concurso de</small>
      <h1 class="cd-barras__titulo">BARRAS</h1>
      <p class="cd-barras__ahora" data-ahora>Pon tu mejor porra · ¡que se escuche en todo San Marcos!</p>
      <div class="cd-barras__dels">${dels.map((d, k) => `<span class="cd-del" data-k="${k}" style="--i:${k}"><b>${esc(d.siglas || d.nombre)}</b>${d.siglas ? `<small>${esc(d.nombre)}</small>` : ""}</span>`).join("")}</div>
    </main>
    <p class="sh-ayuda">← → marca la delegación que se presenta · 0 quita la marca · Esc: salir</p>`,
    { teclas: (e) => { if (e.key === "ArrowRight" || e.key === "PageDown" || e.key === " ") { e.preventDefault(); marcar(i + 1); } if (e.key === "ArrowLeft" || e.key === "PageUp") marcar(i - 1); if (e.key === "0") marcar(-1); } });
  function marcar(k) {
    i = k < -1 ? -1 : k >= dels.length ? dels.length - 1 : k;
    p.el.querySelectorAll(".cd-del").forEach((x) => x.classList.toggle("cd-del--ahora", Number(x.dataset.k) === i));
    const d = dels[i];
    $("[data-ahora]", p.el).innerHTML = d ? `🎺 Ahora se presenta: <b>${esc(d.siglas || d.nombre)}</b>${d.siglas ? ` · ${esc(d.nombre)}` : ""}` : "Pon tu mejor porra · ¡que se escuche en todo San Marcos!";
    if (d) tono(880, 0.12, "sine", 0.06);
  }
  p.el.addEventListener("click", (e) => { const x = e.target.closest(".cd-del"); if (x) marcar(Number(x.dataset.k) === i ? -1 : Number(x.dataset.k)); });
}

// =================== 2 · GANADORES DE UN CONCURSO CON RÚBRICA (Proyectos, Amateur I, Amateur II, IATHON) ===================
// Los de las 5:00–6:30 (Amateur I, II e IATHON) se revelan aquí, cuando los jurados ya deliberaron.
const TITULOS = {
  proyectos: { corto: "Concurso Nacional de Proyectos", h1: "Concurso Nacional<br>de Proyectos" },
  "amateur-1": { corto: "Concurso Amateur I · Acta de constitución", h1: "Concurso<br>Amateur I" },
  "amateur-2": { corto: "Concurso Amateur II · Matriz de riesgos", h1: "Concurso<br>Amateur II" },
  iathon: { corto: "IATHON · Mini hackathon de IA", h1: "IATHON" },
};
// data = adminDatos; proyectos = { delegacion_id: nombre del proyecto } (opcional, solo Proyectos)
export const abrirGanadoresProyectos = (data, proyectos = {}) => abrirGanadores(data, "proyectos", proyectos);
export function abrirGanadores(data, concurso, proyectos = {}) {
  const T = TITULOS[concurso] || { corto: concurso, h1: concurso };
  const filas = resultados(concurso, data).filter((f) => f.puesto && f.puesto <= 3 && !f.ajuste?.walkover && !f.ajuste?.descalificado).sort((a, b) => a.puesto - b.puesto);
  if (!filas.length) return aviso(`${T.corto.split(" · ")[0]} aún no tiene calificaciones`, "error");
  const top = [3, 2, 1].map((n) => filas.find((f) => f.puesto === n)).filter(Boolean); // orden de revelación
  let paso = 0; // 0 portada · 1..n revela · n+1 podio
  const p = pantalla("cd-proy", `${cabeza("Cierre del Día 1 · Ganadores", T.corto)}<main class="cd-proy__vista" data-vista></main>
    <p class="sh-ayuda">Espacio / →: siguiente · ←: anterior · Esc: salir</p>`,
    { teclas: (e) => { if ([" ", "Enter", "ArrowRight", "PageDown"].includes(e.key)) { e.preventDefault(); ir(paso + 1); } if (["ArrowLeft", "PageUp"].includes(e.key)) ir(paso - 1); } });
  const nombre = (f) => f.delegacion.siglas || f.delegacion.nombre;
  const tarjeta = (f, grande = false) => `<article class="cd-lugar cd-lugar--${f.puesto} ${grande ? "cd-lugar--grande" : ""}">
      <span class="cd-lugar__medalla">${f.puesto}°</span><b>${esc(nombre(f))}</b>${f.delegacion.siglas ? `<small>${esc(f.delegacion.nombre)}</small>` : ""}
      ${proyectos[f.delegacion.id] ? `<em>«${esc(proyectos[f.delegacion.id])}»</em>` : ""}<span class="cd-lugar__pts">${f.rubrica} pts</span>${f.empate ? `<span class="chip chip--ambar">empate</span>` : ""}</article>`;
  function ir(k) {
    paso = Math.max(0, Math.min(top.length + 1, k));
    const v = $("[data-vista]", p.el);
    if (paso === 0) { v.innerHTML = `<div class="cd-portada"><small>Y los ganadores del</small><h1>${T.h1}</h1><p>son…</p></div>`; return; }
    if (paso <= top.length) {
      const f = top[paso - 1];
      v.innerHTML = `<div class="cd-revela"><small>${f.puesto === 1 ? "🥇 Primer lugar" : f.puesto === 2 ? "🥈 Segundo lugar" : "🥉 Tercer lugar"}</small><div data-suspenso class="cd-suspenso">🥁</div></div>`;
      redoble(f.puesto === 1 ? 2200 : 1300);
      setTimeout(() => { if (!document.body.contains(v)) return; v.innerHTML = `<div class="cd-revela">${tarjeta(f, true)}</div>`; fanfarria(); lanzarConfeti(); if (f.puesto === 1) { setTimeout(lanzarConfeti, 600); setTimeout(lanzarConfeti, 1200); } }, f.puesto === 1 ? 2300 : 1400);
      return;
    }
    const orden = [2, 1, 3].map((n) => filas.find((f) => f.puesto === n)).filter(Boolean);
    v.innerHTML = `<div class="cd-podio">${orden.map((f) => tarjeta(f)).join("")}</div><p class="cd-proy__nota">¡Felicitaciones a todos los equipos! Los puntos ya suman a la Copa CONCEPMI.</p>`;
    lanzarConfeti();
  }
  ir(0);
  return p;
}

// =================== 3 · CIERRE DEL DÍA 1 · ASÍ VA LA COPA ===================
export function abrirCierreDia1(data) {
  const filas = copaGeneral(data);
  if (!filas.length) return aviso("Aún no hay delegaciones registradas", "error");
  const max = Math.max(1, ...filas.map((f) => f.total));
  let fase = 0;
  const p = pantalla("cd-cierre", `${cabeza("Cierre del Día 1 · Martes 24 de noviembre", "Así va la Copa CONCEPMI")}<main class="cd-cierre__vista" data-vista></main>
    <p class="sh-ayuda">Espacio / →: «¡Nos vemos el jueves 26!» · ←: volver a la tabla · Esc: salir</p>`,
    { teclas: (e) => { if ([" ", "Enter", "ArrowRight", "PageDown"].includes(e.key)) { e.preventDefault(); ir(1); } if (["ArrowLeft", "PageUp"].includes(e.key)) ir(0); } });
  function ir(k) {
    fase = k; const v = $("[data-vista]", p.el);
    if (fase === 0) {
      const n = filas.length;
      v.innerHTML = `<div class="cd-tabla ${n > 11 ? "cd-tabla--densa" : ""}" style="--n:${n};--fs:${Math.min(2.8, 30 / n).toFixed(2)}vh">${filas.map((f, k) => `<div class="cd-fila ${f.puesto <= 3 && f.total > 0 ? `cd-fila--${f.puesto}` : ""}" style="--i:${n - k};--w:${(f.total / max) * 100}%">
          <span class="cd-fila__pos">${f.total > 0 ? f.puesto : "–"}</span>
          <span class="cd-fila__del"><b>${esc(f.delegacion.siglas || f.delegacion.nombre)}</b>${f.delegacion.siglas ? `<small>${esc(f.delegacion.nombre)}</small>` : ""}</span>
          <span class="cd-fila__barra"><i></i></span><span class="cd-fila__pts">${f.total}<small> pts</small></span></div>`).join("")}</div>
        <p class="cd-cierre__nota">Puntaje <b>parcial</b> del Día 1. El jueves 26 se suman la Gran Gymkana, el Talent Show, Conocimientos y las charlas II y III. ¡Todo puede cambiar!</p>`;
      tono(660, 0.2, "sine", 0.05);
      return;
    }
    v.innerHTML = `<div class="cd-adios"><img src="${IMG.wolfito}" alt=""><small>Gracias por vivir el Día 1 del VI CONCEPMI</small><h1>¡Nos vemos el<br><span>jueves 26 de noviembre!</span></h1>
      <p>Gran Gymkana · Charlas magistrales II y III · Concurso de Conocimientos · Ceremonia de premiación y Copa CONCEPMI</p></div>`;
    fanfarria(); lanzarConfeti(); setTimeout(lanzarConfeti, 800);
  }
  ir(0);
  return p;
}

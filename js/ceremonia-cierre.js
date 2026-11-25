// =========================================================
// CEREMONIA DE CIERRE (jueves 26/11, 7:00 – 8:30 p. m., auditorio). Pestaña propia del admin y paso del
// Panel de Proyección. Premia los 8 concursos, del menos al más importante:
//   culturales → Talent Show, Concurso de Barras, Gran Gymkana
//   académicos → Amateur I, Amateur II, IATHON, Conocimientos (penúltimo) y Proyectos (último, el de más puntos)
// Cada concurso: portada «Y los ganadores del … son…» → 3.º → 2.º → 1.º (redoble, fanfarria, confeti) →
// podio con la tabla de todas las delegaciones. Todo sale solo de los resultados (`resultados()` de
// calculo.js, los mismos de Resultados y la Copa). Se avanza con Espacio / → / PageDown (el puntero);
// ← / PageUp retrocede; los controles solo aparecen al mover el mouse.
// Al final: «¡Y ahora… la Copa CONCEPMI!» → Espacio abre la ceremonia de premiación de la Copa
// (premiacion.js, la misma de siempre).
// =========================================================
import { resultados, copaGeneral } from "./calculo.js?v=202611252237";
import { porId } from "./concursos.js?v=202611252237";
import { pantalla, tono, fanfarria } from "./show.js?v=202611252237";
import { $, esc, I, IMG, aviso, lanzarConfeti, pantallaActiva } from "./ui.js?v=202611252237";

export const ORDEN_CIERRE = ["talent", "barras", "gymkana", "amateur-1", "amateur-2", "iathon", "conocimientos", "proyectos"];
const NOMBRES = {
  talent: "Talent Show", barras: "Concurso de Barras", gymkana: "Gran Gymkana", "amateur-1": "Concurso Amateur I",
  "amateur-2": "Concurso Amateur II", iathon: "IATHON", conocimientos: "Concurso Nacional de Conocimientos", proyectos: "Concurso Nacional de Proyectos",
};
const ICONO = { talent: "🎤", barras: "🎺", gymkana: "🏃", "amateur-1": "📜", "amateur-2": "⚠️", iathon: "🤖", conocimientos: "🧠", proyectos: "🚀" };
export const nombreCierre = (cid) => NOMBRES[cid] || porId(cid)?.nombre || cid;
const sig = (d) => d.siglas || d.nombre;

// Lo que se muestra de cada delegación según el concurso
export function valorCierre(cid, f) {
  if (cid === "talent") return `${(f.likes || 0).toLocaleString("es-PE")} likes`;
  if (cid === "gymkana" || cid === "conocimientos") return `${f.copa ?? 0} pts`;
  return `${f.rubrica ?? Math.round(f.neto || 0)} pts`;
}
// Filas válidas (con puesto, sin walkover ni descalificación) ordenadas
export function filasCierre(cid, data) {
  return resultados(cid, data).filter((f) => f.puesto && !f.ajuste?.walkover && !f.ajuste?.descalificado).sort((a, b) => a.puesto - b.puesto);
}

const cab = (kicker, titulo) => `<header class="cd-cab"><img src="${IMG.logo}" alt="CONCEPMI"><div><small>${kicker}</small><b>${titulo}</b></div></header>`;
const redoble = (ms = 1600) => { const fin = Date.now() + ms; const r = () => { if (Date.now() > fin) return; tono(120 + Math.random() * 40, 0.05, "triangle", 0.07); setTimeout(r, 70); }; r(); };

// data = adminDatos · desde = id del concurso por el que empezar · proyectos = {delegacion_id: nombre del proyecto}
export function abrirCeremoniaCierre(data, { desde = null, proyectos = {} } = {}) {
  if (!data?.delegaciones?.length) return aviso("Aún no hay delegaciones registradas", "error");
  // Pasos: portada general → por concurso: portada, 3.º, 2.º, 1.º, podio → final (Copa)
  const pasos = [{ t: "inicio" }];
  ORDEN_CIERRE.forEach((cid, n) => {
    const filas = filasCierre(cid, data), top = [3, 2, 1].map((k) => filas.filter((f) => f.puesto === k)).filter((g) => g.length); // con empate, los del mismo puesto salen juntos
    pasos.push({ t: "portada", cid, n, filas, top });
    if (!filas.length) return;
    top.forEach((fs) => pasos.push({ t: "revela", cid, n, fs }));
    pasos.push({ t: "podio", cid, n, filas });
  });
  pasos.push({ t: "copa" });
  let i = desde ? Math.max(0, pasos.findIndex((p) => p.t === "portada" && p.cid === desde)) : 0;
  const p = pantalla("cd-proy cc-cierre", `${cab("VI CONCEPMI 2026 · Ceremonia de cierre", "Premiación de los concursos")}<main class="cd-proy__vista" data-vista></main>
    <nav class="cc-mapa" data-mapa></nav>
    <p class="sh-ayuda">Espacio / →: siguiente · ←: anterior · Esc: salir</p>`,
    { teclas: (e) => { if ([" ", "Enter", "ArrowRight", "PageDown"].includes(e.key)) { e.preventDefault(); ir(i + 1); } if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); ir(i - 1); } } });
  const v = $("[data-vista]", p.el);
  const tarjeta = (cid, f, grande = false) => `<article class="cd-lugar cd-lugar--${f.puesto} ${grande ? "cd-lugar--grande" : ""}">
      <span class="cd-lugar__medalla">${f.puesto}°</span><b>${esc(sig(f.delegacion))}</b>${f.delegacion.siglas ? `<small>${esc(f.delegacion.nombre)}</small>` : ""}
      ${cid === "proyectos" && proyectos[f.delegacion.id] ? `<em>«${esc(proyectos[f.delegacion.id])}»</em>` : ""}<span class="cd-lugar__pts">${esc(valorCierre(cid, f))}</span>${f.empate ? `<span class="chip chip--ambar">empate</span>` : ""}</article>`;
  const mapa = (cid) => { $("[data-mapa]", p.el).innerHTML = ORDEN_CIERRE.map((x, k) => `<span class="${x === cid ? "cc-mapa--ahora" : ORDEN_CIERRE.indexOf(cid) > k ? "cc-mapa--hecho" : ""}">${ICONO[x]}</span>`).join(""); };
  let espera = null;
  function ir(k) {
    if (k >= pasos.length) return;
    i = Math.max(0, k); clearTimeout(espera);
    const s = pasos[i];
    mapa(s.cid || (s.t === "copa" ? "fin" : ""));
    if (s.t === "inicio") {
      v.innerHTML = `<div class="cd-portada cc-inicio"><small>Ceremonia de cierre</small><h1>Y los ganadores<br>de los concursos…</h1>
        <ol class="cc-lista">${ORDEN_CIERRE.map((cid) => `<li>${ICONO[cid]} ${esc(nombreCierre(cid))}</li>`).join("")}</ol></div>`;
      return;
    }
    if (s.t === "portada") {
      const c = porId(s.cid);
      v.innerHTML = `<div class="cd-portada"><small>${c?.tipo === "academico" ? "Concurso académico" : "Evento cultural"} · ${s.n + 1} de ${ORDEN_CIERRE.length}</small>
        <span class="cc-icono">${ICONO[s.cid]}</span><h1>${esc(nombreCierre(s.cid))}</h1>
        <p>${s.filas.length ? "Y los ganadores son…" : "Resultados pendientes"}</p></div>`;
      tono(660, 0.2, "sine", 0.05); return;
    }
    if (s.t === "revela") {
      const fs = s.fs, n = fs[0].puesto;
      const titulo = `${esc(nombreCierre(s.cid))} · ${n === 1 ? "🥇 Primer lugar" : n === 2 ? "🥈 Segundo lugar" : "🥉 Tercer lugar"}${fs.length > 1 ? " · ¡Empate!" : ""}`;
      v.innerHTML = `<div class="cd-revela"><small>${titulo}</small><div class="cd-suspenso">🥁</div></div>`;
      redoble(n === 1 ? 2200 : 1300);
      espera = setTimeout(() => { if (!document.body.contains(v) || pasos[i] !== s) return;
        v.innerHTML = `<div class="cd-revela"><small>${titulo}</small><div class="cc-juntos">${fs.map((f) => tarjeta(s.cid, f, fs.length === 1)).join("")}</div></div>`;
        fanfarria(); lanzarConfeti(); if (n === 1) { setTimeout(lanzarConfeti, 600); setTimeout(lanzarConfeti, 1200); } }, n === 1 ? 2300 : 1400);
      return;
    }
    if (s.t === "podio") {
      const orden = [2, 1, 3].flatMap((n) => s.filas.filter((f) => f.puesto === n));
      const resto = s.filas.filter((f) => f.puesto > 3);
      v.innerHTML = `<div class="cc-podio"><small class="cc-podio__tit">${ICONO[s.cid]} ${esc(nombreCierre(s.cid))}</small><div class="cd-podio">${orden.map((f) => tarjeta(s.cid, f)).join("")}</div>
        ${resto.length ? `<div class="cc-resto">${resto.map((f) => `<span><em>${f.puesto}°</em><b>${esc(sig(f.delegacion))}</b><small>${esc(valorCierre(s.cid, f))}</small></span>`).join("")}</div>` : ""}
        <p class="cc-nota">¡Felicitaciones! 📸 Pasen al frente para recibir su reconocimiento y la foto de honor.</p></div>`;
      lanzarConfeti(); return;
    }
    // Final: la Copa CONCEPMI
    v.innerHTML = `<div class="cd-portada cc-copa"><small>Y ahora, el gran momento</small><span class="cc-icono">🏆</span><h1>Copa CONCEPMI</h1>
      <p>¿Qué delegación gana el VI CONCEPMI 2026?</p><button class="btn btn--naranja" data-copa>${I.copa}Comenzar la ceremonia de la Copa</button></div>`;
    $("[data-copa]", v).onclick = abrirCopa;
    fanfarria();
  }
  async function abrirCopa() {
    const { abrirPremiacion } = await import("./premiacion.js?v=202611252237");
    pantallaActiva.transicion = true; p.cerrar(); pantallaActiva.transicion = false;
    abrirPremiacion(copaGeneral(data));
  }
  // En el paso final, Espacio abre la Copa
  const teclaCopa = (e) => { if (pasos[i]?.t === "copa" && [" ", "Enter", "ArrowRight", "PageDown"].includes(e.key) && document.body.contains(p.el)) { e.preventDefault(); e.stopImmediatePropagation(); abrirCopa(); } };
  document.addEventListener("keydown", teclaCopa, true);
  const quitarTecla = new MutationObserver(() => { if (!document.body.contains(p.el)) { document.removeEventListener("keydown", teclaCopa, true); quitarTecla.disconnect(); } });
  quitarTecla.observe(document.body, { childList: true });
  ir(i);
  return p;
}

// =================== PESTAÑA DEL ADMIN ===================
export function crearCierre(ctx) {
  let visible = false;
  async function nombresProyectos() {
    const nombres = {};
    try { (await ctx.api.adminEntregas(ctx.codigo(), "proyectos")).equipos.forEach((x) => { if (x.entrega.datos?.proyecto) nombres[x.entrega.delegacion_id] = x.entrega.datos.proyecto; }); } catch { /* sin nombres */ }
    return nombres;
  }
  function vista(v) {
    const data = ctx.data();
    if (!data) { v.innerHTML = `<div class="cargando"><div class="giro"></div>Cargando…</div>`; setTimeout(() => document.body.contains(v) && vista(v), 600); return; }
    const tarjetas = ORDEN_CIERRE.map((cid, n) => {
      const filas = filasCierre(cid, data), c = porId(cid);
      const top = filas.filter((f) => f.puesto <= 3);
      return `<article class="tarjeta cc-card ${c?.tipo === "academico" ? "cc-card--acad" : ""}">
        <div class="cc-card__cab"><span class="cc-card__n">${n + 1}</span><div><b>${ICONO[cid]} ${esc(nombreCierre(cid))}</b><small>${c?.tipo === "academico" ? "Académico" : "Cultural"} · ${filas.length ? `${filas.length} delegaciones con resultado` : "⚠ aún sin resultados"}</small></div>
          <button class="btn btn--mini" data-desde="${cid}">${I.vivo}Desde aquí</button></div>
        <ol class="cc-card__top ${visible ? "" : "cc-oculto"}">${top.length ? top.map((f) => `<li><em>${f.puesto}°</em><b>${esc(sig(f.delegacion))}</b><span>${esc(valorCierre(cid, f))}</span>${f.empate ? `<span class="chip chip--ambar">empate</span>` : ""}</li>`).join("") : `<li class="cc-vacio">Sin resultados todavía</li>`}</ol></article>`;
    }).join("");
    const faltan = ORDEN_CIERRE.filter((cid) => !filasCierre(cid, data).length);
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>🏅 Ceremonia de cierre</h1><p><b>Jueves 26 · 7:00 – 8:30 p. m.</b> · Auditorio. Primero los ganadores de los 8 concursos (culturales y luego académicos; Conocimientos penúltimo y Proyectos al final) y después la <b>Copa CONCEPMI</b>. Los resultados salen solos de Resultados.</p></div></div>
      <div class="cc-acc">
        <button class="btn btn--naranja cc-grande" data-todo>${I.vivo}Proyectar ceremonia de cierre</button>
        <button class="btn cc-grande" data-copa>${I.copa}Copa CONCEPMI · ceremonia de premiación</button>
        <button class="btn btn--mini" data-ver>${visible ? `${I.candado}Ocultar ganadores` : `${I.abierto}Mostrar ganadores aquí`}</button>
      </div>
      ${faltan.length ? `<p class="cc-aviso">⚠ Aún sin resultados: <b>${faltan.map((x) => esc(nombreCierre(x))).join(", ")}</b>. En la proyección saldrán como «Resultados pendientes». Revisa que los jurados hayan calificado y que estén registrados Talent Show, Gymkana y Conocimientos.</p>` : `<p class="cc-ok">✓ Los 8 concursos ya tienen resultados.</p>`}
      <div class="cc-grid">${tarjetas}</div>
      <p class="ayuda">En la proyección: <b>Espacio / → / puntero</b> avanza (portada del concurso → 3.º → 2.º → 1.º → podio con la tabla completa), <b>←</b> retrocede, Esc sale. Al terminar Proyectos sale «Copa CONCEPMI»: Espacio abre la ceremonia de premiación de siempre.</p>`;
    $("[data-ver]", v).onclick = () => { visible = !visible; vista(v); };
    $("[data-todo]", v).onclick = async () => abrirCeremoniaCierre(ctx.data(), { proyectos: await nombresProyectos() });
    $("[data-copa]", v).onclick = async () => { const { abrirPremiacion } = await import("./premiacion.js?v=202611252237"); abrirPremiacion(copaGeneral(ctx.data())); };
    v.querySelectorAll("[data-desde]").forEach((b) => (b.onclick = async () => abrirCeremoniaCierre(ctx.data(), { desde: b.dataset.desde, proyectos: await nombresProyectos() })));
  }
  return { vista };
}

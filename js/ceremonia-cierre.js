// =========================================================
// CEREMONIA DE CIERRE (jueves 26/11, 7:00 – 8:30 p. m., auditorio). Pestaña propia del admin y paso del
// Panel de Proyección. Premia los 8 concursos, del menos al más importante:
//   culturales → Talent Show, Concurso de Barras, Gran Gymkana
//   académicos → Amateur I, Amateur II, IATHON, Conocimientos (penúltimo) y Proyectos (último, el de más puntos)
// Cada concurso: portada «Y los ganadores del … son…» → 3.º → 2.º → 1.º → podio con la tabla completa.
// Cada lugar tiene SUSPENSO largo para que el presentador haga juego (3.º 5 s, 2.º 6 s, 1.º 8 s): redoble que
// crece, cama musical de suspenso, nombres girando como tragamonedas y reflectores; luego destello, platillo,
// golpe grave, fanfarria, rayos girando, confeti y (en el 1.º) temblor de pantalla. Música de fiesta en las
// portadas y podios (hype.js, sintetizada, sin archivos). M = silenciar.
// Todo sale solo de `resultados()` de calculo.js. Espacio / → / PageDown avanza (no salta un suspenso en
// curso), ← / PageUp retrocede, Esc sale. Al final: «Copa CONCEPMI» → abre la ceremonia de premiación.
// =========================================================
import { resultados, copaGeneral } from "./calculo.js?v=202611271603";
import { porId } from "./concursos.js?v=202611271603";
import { pantalla } from "./show.js?v=202611271603";
import { hype } from "./hype.js?v=202611271603";
import { $, esc, I, IMG, aviso, lanzarConfeti, pantallaActiva } from "./ui.js?v=202611271603";

export const ORDEN_CIERRE = ["talent", "barras", "gymkana", "amateur-1", "amateur-2", "iathon", "conocimientos", "proyectos"];
const NOMBRES = {
  talent: "Talent Show", barras: "Concurso de Barras", gymkana: "Gran Gymkana", "amateur-1": "Concurso Amateur I",
  "amateur-2": "Concurso Amateur II", iathon: "IATHON", conocimientos: "Concurso Nacional de Conocimientos", proyectos: "Concurso Nacional de Proyectos",
};
const ICONO = { talent: "🎤", barras: "🎺", gymkana: "🏃", "amateur-1": "📜", "amateur-2": "⚠️", iathon: "🤖", conocimientos: "🧠", proyectos: "🚀" };
const SUSPENSO = { 3: 5000, 2: 6000, 1: 8000 }; // ms de redoble antes de revelar cada lugar
const LUGAR = { 1: "🥇 Primer lugar", 2: "🥈 Segundo lugar", 3: "🥉 Tercer lugar" };
const COLORES = { 1: ["#FFC23D", "#FFE08A", "#FF9F1C", "#FFFFFF"], 2: ["#E6E8EC", "#B8BEC8", "#FFFFFF", "#A98BFF"], 3: ["#CD7F32", "#E8A96B", "#FFD2A6", "#FF6A1F"] };
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
function confetiFuerte(colores, veces = 1) {
  const c = window.confetti; if (!c) return lanzarConfeti();
  for (let k = 0; k < veces; k++) setTimeout(() => { try {
    c({ particleCount: 160, spread: 100, startVelocity: 55, origin: { y: 0.6 }, colors: colores, zIndex: 200 });
    c({ particleCount: 70, angle: 60, spread: 65, origin: { x: 0, y: 0.8 }, colors: colores, zIndex: 200 });
    c({ particleCount: 70, angle: 120, spread: 65, origin: { x: 1, y: 0.8 }, colors: colores, zIndex: 200 });
  } catch { /* opcional */ } }, k * 650);
}

// data = adminDatos · desde = id del concurso por el que empezar · proyectos = {delegacion_id: nombre del proyecto}
export function abrirCeremoniaCierre(data, { desde = null, proyectos = {} } = {}) {
  if (!data?.delegaciones?.length) return aviso("Aún no hay delegaciones registradas", "error");
  const pasos = [{ t: "inicio" }];
  ORDEN_CIERRE.forEach((cid, n) => {
    const filas = filasCierre(cid, data), top = [3, 2, 1].map((k) => filas.filter((f) => f.puesto === k)).filter((g) => g.length); // empates: juntos
    pasos.push({ t: "portada", cid, n, filas });
    if (!filas.length) return;
    top.forEach((fs) => pasos.push({ t: "revela", cid, n, fs, filas }));
    pasos.push({ t: "podio", cid, n, filas });
  });
  pasos.push({ t: "copa" });
  let i = desde ? Math.max(0, pasos.findIndex((p) => p.t === "portada" && p.cid === desde)) : 0;
  let timers = [], enSuspenso = false;
  const limpiar = () => { timers.forEach(clearTimeout); timers = []; enSuspenso = false; };
  const luego = (ms, fn) => timers.push(setTimeout(fn, ms));

  const p = pantalla("cd-proy cc-cierre", `
    <div class="cc-focos" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="cc-rayos" aria-hidden="true"></div>
    ${cab("VI CONCEPMI 2026 · Ceremonia de cierre", "Premiación de los concursos")}
    <main class="cd-proy__vista" data-vista></main>
    <nav class="cc-mapa" data-mapa></nav>
    <div class="cc-flash" data-flash></div>
    <p class="sh-ayuda">Espacio / →: siguiente · ←: anterior · M: música on/off · Esc: salir</p>`, {
    alCerrar: () => { limpiar(); hype.parar(); },
    teclas: (e) => {
      if ([" ", "Enter", "ArrowRight", "PageDown"].includes(e.key)) { e.preventDefault(); if (!enSuspenso) ir(i + 1); }
      else if (["ArrowLeft", "PageUp"].includes(e.key)) { e.preventDefault(); ir(i - 1, true); }
      else if (e.key === "m" || e.key === "M") aviso(hype.silencio() ? "Música en silencio" : "Música activada");
    } });
  const v = $("[data-vista]", p.el);
  const tarjeta = (cid, f, grande = false) => `<article class="cd-lugar cd-lugar--${f.puesto} ${grande ? "cd-lugar--grande" : ""}">
      <span class="cd-lugar__medalla">${f.puesto}°</span><b>${esc(sig(f.delegacion))}</b>${f.delegacion.siglas ? `<small>${esc(f.delegacion.nombre)}</small>` : ""}
      ${cid === "proyectos" && proyectos[f.delegacion.id] ? `<em>«${esc(proyectos[f.delegacion.id])}»</em>` : ""}<span class="cd-lugar__pts">${esc(valorCierre(cid, f))}</span></article>`;
  const mapa = (cid) => { $("[data-mapa]", p.el).innerHTML = ORDEN_CIERRE.map((x, k) => `<span class="${x === cid ? "cc-mapa--ahora" : ORDEN_CIERRE.indexOf(cid) > k || cid === "fin" ? "cc-mapa--hecho" : ""}">${ICONO[x]}</span>`).join(""); };
  const estado = (clase) => { p.el.dataset.fase = clase; };
  const destello = () => { const f = $("[data-flash]", p.el); f.classList.remove("cc-flash--on"); void f.offsetWidth; f.classList.add("cc-flash--on"); };
  const temblor = () => { p.el.classList.remove("cc-tiembla"); void p.el.offsetWidth; p.el.classList.add("cc-tiembla"); };

  function ir(k, atras = false) {
    if (k >= pasos.length || k < 0) return;
    limpiar(); i = k;
    const s = pasos[i];
    mapa(s.cid || (s.t === "copa" ? "fin" : ""));
    p.el.classList.remove("cc-tiembla");
    if (s.t === "inicio") {
      estado("inicio"); hype.musica("fiesta", 0.4);
      v.innerHTML = `<div class="cd-portada cc-inicio"><img class="cc-logo" src="${IMG.logo}" alt="CONCEPMI"><small>Ceremonia de cierre · VI CONCEPMI 2026</small>
        <h1 class="cc-titulo">Y los ganadores<br>de los concursos…</h1>
        <ol class="cc-lista">${ORDEN_CIERRE.map((cid, n) => `<li style="--i:${n}">${ICONO[cid]} ${esc(nombreCierre(cid))}</li>`).join("")}</ol></div>`;
      return;
    }
    if (s.t === "portada") {
      const c = porId(s.cid);
      estado("portada"); hype.musica("fiesta", 0.35); hype.whoosh(); luego(350, hype.campana);
      v.innerHTML = `<div class="cd-portada cc-port"><small>${c?.tipo === "academico" ? "Concurso académico" : "Evento cultural"} · ${s.n + 1} de ${ORDEN_CIERRE.length}</small>
        <span class="cc-icono">${ICONO[s.cid]}</span><h1 class="cc-titulo">${esc(nombreCierre(s.cid))}</h1>
        <p>${s.filas.length ? "Y los ganadores son…" : "Resultados pendientes"}</p></div>`;
      return;
    }
    if (s.t === "revela") {
      const fs = s.fs, n = fs[0].puesto, dur = SUSPENSO[n];
      const titulo = `${esc(nombreCierre(s.cid))} · ${LUGAR[n]}${fs.length > 1 ? " · ¡Empate!" : ""}`;
      const revelado = () => `<div class="cd-revela cc-rev"><small>${titulo}</small><div class="cc-juntos">${fs.map((f) => tarjeta(s.cid, f, fs.length === 1)).join("")}</div>
          ${n === 1 ? `<p class="cc-campeon">¡${fs.length > 1 ? "CAMPEONES" : "CAMPEÓN"} DEL ${esc(nombreCierre(s.cid).toUpperCase())}!</p>` : ""}</div>`;
      if (atras) { estado(`revelado revelado-${n}`); hype.musica("gala", 0.35); v.innerHTML = revelado(); return; } // al retroceder: ya revelado, sin repetir el suspenso
      estado(`suspenso suspenso-${n}`); enSuspenso = true;
      hype.musica("suspenso"); hype.redoble(dur / 1000);
      v.innerHTML = `<div class="cc-susp cc-susp--${n}"><small>${titulo}</small>
        <div class="cc-tambor">🥁</div>
        <div class="cc-slot"><b data-slot>? ? ?</b></div>
        <div class="cc-reloj"><i style="animation-duration:${dur}ms"></i></div>
        <span class="cc-quien">${n === 1 ? "¿Quién se lleva el primer lugar?" : "¿Quién será…?"}</span></div>`;
      // Nombres girando: rápido al inicio, cada vez más lento
      const nombres = s.filas.map((f) => sig(f.delegacion));
      const slot = $("[data-slot]", v); let t = 0, vel = 70;
      const girar = () => { if (pasos[i] !== s) return; t += vel; if (t > dur - 650) { slot.textContent = "? ? ?"; slot.classList.add("cc-slot--fin"); return; }
        slot.textContent = nombres[Math.floor(Math.random() * nombres.length)]; vel = 70 + Math.pow(t / dur, 2.2) * 420; luego(vel, girar); };
      luego(500, girar);
      luego(dur, () => {
        if (pasos[i] !== s) return;
        enSuspenso = false; estado(`revelado revelado-${n}`);
        destello(); hype.platillo(); hype.impacto(); hype.fanfarria(n);
        if (n === 1) temblor();
        v.innerHTML = revelado();
        confetiFuerte(COLORES[n], n === 1 ? 4 : 2);
        luego(1800, () => pasos[i] === s && hype.musica(n === 1 ? "fiesta" : "gala", n === 1 ? 0.6 : 0.4));
      });
      return;
    }
    if (s.t === "podio") {
      estado("podio"); hype.musica("fiesta", 0.45);
      const orden = [2, 1, 3].flatMap((n) => s.filas.filter((f) => f.puesto === n));
      const resto = s.filas.filter((f) => f.puesto > 3);
      v.innerHTML = `<div class="cc-podio"><small class="cc-podio__tit">${ICONO[s.cid]} ${esc(nombreCierre(s.cid))}</small><div class="cd-podio">${orden.map((f) => tarjeta(s.cid, f)).join("")}</div>
        ${resto.length ? `<div class="cc-resto">${resto.map((f, k) => `<span style="--i:${k}"><em>${f.puesto}°</em><b>${esc(sig(f.delegacion))}</b><small>${esc(valorCierre(s.cid, f))}</small></span>`).join("")}</div>` : ""}
        <p class="cc-nota">¡Felicitaciones! 📸 Pasen al frente para recibir su reconocimiento y la foto de honor.</p></div>`;
      confetiFuerte(COLORES[1], 1); return;
    }
    // Final: la Copa CONCEPMI
    estado("copa"); hype.musica("gala", 0.5); destello(); hype.platillo(); hype.fanfarria(1);
    v.innerHTML = `<div class="cd-portada cc-copa"><small>Y ahora, el gran momento de la noche</small><span class="cc-icono">🏆</span><h1>Copa CONCEPMI</h1>
      <p>¿Qué delegación gana el VI CONCEPMI 2026?</p><button class="btn btn--naranja" data-copa>${I.copa}Comenzar la ceremonia de la Copa</button></div>`;
    $("[data-copa]", v).onclick = abrirCopa;
    confetiFuerte(COLORES[1], 1);
  }
  async function abrirCopa() {
    const { abrirPremiacion } = await import("./premiacion.js?v=202611271603");
    hype.parar();
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
      <p class="ayuda">En la proyección: <b>Espacio / → / puntero</b> avanza (portada del concurso → 3.º → 2.º → 1.º → podio con la tabla completa). Cada lugar tiene <b>suspenso con redoble</b> (3.º 5 s, 2.º 6 s, 1.º 8 s) para que el presentador haga juego; mientras suena el redoble, Espacio no lo salta. <b>←</b> retrocede, <b>M</b> silencia la música, Esc sale. Al terminar Proyectos sale «Copa CONCEPMI»: Espacio abre la ceremonia de premiación.</p>`;
    $("[data-ver]", v).onclick = () => { visible = !visible; vista(v); };
    $("[data-todo]", v).onclick = async () => abrirCeremoniaCierre(ctx.data(), { proyectos: await nombresProyectos() });
    $("[data-copa]", v).onclick = async () => { const { abrirPremiacion } = await import("./premiacion.js?v=202611271603"); abrirPremiacion(copaGeneral(ctx.data())); };
    v.querySelectorAll("[data-desde]").forEach((b) => (b.onclick = async () => abrirCeremoniaCierre(ctx.data(), { desde: b.dataset.desde, proyectos: await nombresProyectos() })));
  }
  return { vista };
}

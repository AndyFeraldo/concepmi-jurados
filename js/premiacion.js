// =========================================================
// Ceremonia de premiación final · Copa CONCEPMI VI (pantalla completa del auditorio)
//  1. Portada + cuenta regresiva
//  2. Tabla revelada desde el ÚLTIMO puesto hasta el 4.º (una delegación por paso)
//  3. TOP 3 con redoble: Wolfito de BRONCE (3.º), PLATA (2.º) y ORO (1.º)
//  4. Campeona: fanfarria, lluvia de confeti y Wolfitos bailando · podio final
// Avanza con Espacio / → / clic en «Siguiente», o en modo Automático.
// =========================================================
import { $, esc, I, IMG, fondoAnimado } from "./ui.js?v=202611032102";

const METAL = {
  3: { clase: "bronce", txt: "3.er LUGAR", medalla: "Medalla de bronce", colores: ["#CD7F32", "#E8A96B", "#8C4A1E", "#FFD2A6"] },
  2: { clase: "plata", txt: "2.º LUGAR", medalla: "Medalla de plata", colores: ["#E6E8EC", "#B8BEC8", "#FFFFFF", "#8E96A3"] },
  1: { clase: "oro", txt: "1.er LUGAR", medalla: "Medalla de oro", colores: ["#FFC23D", "#FFE08A", "#FF9F1C", "#FFFFFF", "#FF6A1F"] },
};

// ---------------- Sonido (sintetizado, sin archivos) ----------------
let ac = null;
const audio = () => { try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch { /* sin sonido */ } return ac; };
function tono(f, dur, { tipo = "triangle", vol = 0.22, cuando = 0, desliza = null } = {}) {
  const a = audio(); if (!a) return;
  try {
    const t = a.currentTime + cuando, o = a.createOscillator(), g = a.createGain();
    o.type = tipo; o.frequency.setValueAtTime(f, t); if (desliza) o.frequency.exponentialRampToValueAtTime(desliza, t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05);
  } catch { /* sin sonido */ }
}
function ruido(dur, { vol = 0.3, cuando = 0, filtro = 1800 } = {}) {
  const a = audio(); if (!a) return;
  try {
    const n = Math.floor(a.sampleRate * dur), buf = a.createBuffer(1, n, a.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = a.createBufferSource(), f = a.createBiquadFilter(), g = a.createGain(), t = a.currentTime + cuando;
    f.type = "bandpass"; f.frequency.value = filtro; g.gain.setValueAtTime(vol, t);
    s.buffer = buf; s.connect(f).connect(g).connect(a.destination); s.start(t);
  } catch { /* sin sonido */ }
}
const sonido = {
  tic: () => tono(880, 0.12, { tipo: "square", vol: 0.12 }),
  ya: () => { tono(1320, 0.4, { tipo: "square", vol: 0.15 }); },
  fila: () => { tono(520, 0.18, { desliza: 780, vol: 0.14 }); ruido(0.12, { vol: 0.08, filtro: 3000 }); },
  redoble: (seg) => { const pasos = Math.floor(seg * 22); for (let i = 0; i < pasos; i++) ruido(0.06, { vol: 0.05 + (i / pasos) * 0.22, cuando: i / 22, filtro: 900 }); },
  platillo: () => { ruido(1.6, { vol: 0.35, filtro: 6500 }); ruido(0.4, { vol: 0.3, filtro: 1200 }); },
  fanfarria: (alta = false) => {
    const base = alta ? [523, 659, 784, 1047] : [392, 494, 587, 784];
    base.forEach((f, i) => tono(f, 0.28, { tipo: "sawtooth", vol: 0.12, cuando: i * 0.16 }));
    tono(base[3], 1.1, { tipo: "sawtooth", vol: 0.14, cuando: 0.7 }); tono(base[1], 1.1, { tipo: "triangle", vol: 0.12, cuando: 0.7 });
  },
};

// ---------------- Confeti ----------------
function confeti(colores, fuerte = false) {
  const c = window.confetti; if (!c) return;
  try {
    c({ particleCount: fuerte ? 200 : 120, spread: fuerte ? 110 : 80, startVelocity: fuerte ? 58 : 45, origin: { y: 0.65 }, colors: colores, zIndex: 200 });
    c({ particleCount: 70, angle: 60, spread: 60, origin: { x: 0, y: 0.75 }, colors: colores, zIndex: 200 });
    c({ particleCount: 70, angle: 120, spread: 60, origin: { x: 1, y: 0.75 }, colors: colores, zIndex: 200 });
  } catch { /* opcional */ }
}

const nombreDel = (d) => d.siglas || d.nombre;
const subDel = (d) => (d.siglas && d.nombre !== d.siglas ? d.nombre : "");

// filas = copaGeneral(data): [{ delegacion, total, puesto }]
export function abrirPremiacion(filasCopa) {
  const filas = [...filasCopa].sort((a, b) => a.puesto - b.puesto || nombreDel(a.delegacion).localeCompare(nombreDel(b.delegacion)));
  const top = (n) => filas.filter((f) => f.puesto === n);
  // Si hay empate, varias delegaciones comparten un puesto del podio
  const resto = filas.filter((f) => f.puesto > 3);
  const pasos = [{ t: "portada" }, { t: "cuenta" }, ...[...resto].reverse().map((f) => ({ t: "fila", f })),
    { t: "intro-top" }, ...[3, 2, 1].filter((n) => top(n).length).map((n) => ({ t: "podio", n })), { t: "final" }];
  let i = 0, auto = false, temporizador = null, ocultar = null, revelados = new Set(), lluvia = null;

  const el = document.createElement("div");
  el.className = "gala";
  el.innerHTML = `${fondoAnimado(40)}<div class="gala__luces" aria-hidden="true"><i></i><i></i><i></i></div>
    <header class="gala__cab"><img src="${IMG.logo}" alt="CONCEPMI VI"><div><b>Copa CONCEPMI VI 2026</b><span>Ceremonia de premiación · Delegación Campeona</span></div><img class="gala__club" src="${IMG.club}" alt="PMI Lima Student Club"></header>
    <main class="gala__escena" data-escena></main>
    <div class="gala__bailarines" data-bailarines aria-hidden="true"></div>
    <nav class="gala__ctrl" data-ctrl>
      <span class="gala__paso" data-paso></span>
      <button class="btn btn--mini btn--naranja" data-sig>${I.flecha}<span>Siguiente</span></button>
      <button class="btn btn--mini" data-auto>Automático: no</button>
      <button class="btn btn--mini" data-reini>↺ Empezar de nuevo</button>
      <button class="btn btn--mini" data-full>Pantalla completa</button>
      <button class="btn btn--mini" data-cerrar>${I.cerrar}<span>Salir</span></button>
      <small>Espacio o → = siguiente · F = pantalla completa · Esc = salir</small>
    </nav>`;
  document.body.append(el);
  document.documentElement.requestFullscreen?.().catch(() => {});
  audio();
  const escena = $("[data-escena]", el);

  // ---------- Pantallas ----------
  function tablero() {
    // Del 4.º puesto hacia abajo; lo no revelado se muestra como «?»
    return `<div class="gala__tablero" style="--n:${resto.length}">${resto.map((f) => {
      const ok = revelados.has(f.delegacion.id);
      return `<div class="gala__fila ${ok ? "gala__fila--ok" : ""} ${ok && pasos[i]?.f === f ? "gala__fila--nueva" : ""}">
        <span class="gala__puesto">${f.puesto}.º</span>
        <span class="gala__del">${ok ? `<b>${esc(nombreDel(f.delegacion))}</b><small>${esc(subDel(f.delegacion))}</small>` : `<b class="gala__oculto">? ? ?</b>`}</span>
        <span class="gala__pts">${ok ? `<b data-cuenta="${f.total}">${pasos[i]?.f === f ? 0 : f.total}</b><small>pts</small>` : ""}</span></div>`; }).join("")}</div>`;
  }
  function wolfMetal(n, tam = "") {
    return `<div class="wolf-metal wolf-metal--${METAL[n].clase} ${tam}"><div class="wolf-metal__halo"></div>
      <img src="${IMG.wolfito}" alt="Wolfito de ${METAL[n].clase}"><div class="wolf-metal__brillo" style="--img:url('${new URL(IMG.wolfito, location.href).href}')"></div>
      <div class="wolf-metal__base"><span>${n}</span></div></div>`;
  }
  function contar(nodo, hasta, ms = 1400) {
    if (!nodo) return; const t0 = performance.now();
    const paso = (t) => { const p = Math.min(1, (t - t0) / ms); nodo.textContent = Math.round(hasta * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(paso); };
    requestAnimationFrame(paso);
  }
  function bailar(cuantos = 5) {
    const b = $("[data-bailarines]", el);
    b.innerHTML = Array.from({ length: cuantos }, (_, k) => `<img src="${IMG.wolfito}" alt="" style="--k:${k};--d:${(7 + Math.random() * 4).toFixed(1)}s;--y:${(Math.random() * 18).toFixed(0)}vh;animation-delay:${(-k * 1.6).toFixed(1)}s">`).join("");
    b.classList.add("gala__bailarines--on");
  }

  function pintar() {
    const p = pasos[i];
    clearInterval(lluvia); lluvia = null;
    el.dataset.fase = p.t; el.dataset.metal = p.n ? METAL[p.n].clase : "";
    $("[data-paso]", el).textContent = `Paso ${i + 1} de ${pasos.length}`;
    $("[data-bailarines]", el).classList.toggle("gala__bailarines--on", p.t === "final" || (p.t === "podio" && p.n === 1));
    if (p.t === "portada") {
      escena.innerHTML = `<div class="gala__portada"><p class="gala__pre">PMI LIMA STUDENT CLUB PRESENTA</p>
        <img class="gala__logo" src="${IMG.logo}" alt="CONCEPMI VI"><h1 class="gala__titulo">Ceremonia de premiación</h1>
        <p class="gala__sub">La delegación campeona del VI CONCEPMI 2026 se conoce esta noche</p>
        <div class="gala__trio">${wolfMetal(2, "wolf-metal--mini")}${wolfMetal(1, "wolf-metal--mini")}${wolfMetal(3, "wolf-metal--mini")}</div>
        <button class="btn btn--naranja gala__empezar" data-empezar>${I.copa}Comenzar la ceremonia</button></div>`;
      $("[data-empezar]", escena).onclick = siguiente;
    } else if (p.t === "cuenta") {
      escena.innerHTML = `<div class="gala__cuenta"><small>La tabla final empieza en</small><b data-num>5</b></div>`;
      let n = 5; sonido.tic();
      const t = setInterval(() => { n--; if (n <= 0) { clearInterval(t); sonido.ya(); if (pasos[i] === p) siguiente(); return; } const b = $("[data-num]", escena); if (b) { b.textContent = n; b.classList.remove("gala__pulso"); void b.offsetWidth; b.classList.add("gala__pulso"); } sonido.tic(); }, 1000);
      p.limpiar = () => clearInterval(t);
    } else if (p.t === "fila") {
      revelados.add(p.f.delegacion.id);
      escena.innerHTML = `<div class="gala__tabla"><h2 class="gala__h2">Tabla general · del último al 4.º puesto</h2>${tablero()}</div>`;
      sonido.fila(); contar($(".gala__fila--nueva [data-cuenta]", escena), p.f.total, 1100);
      $(".gala__fila--nueva", escena)?.scrollIntoView({ block: "center", behavior: "smooth" });
    } else if (p.t === "intro-top") {
      escena.innerHTML = `<div class="gala__intro-top"><small>Llegó el momento</small><h1>EL TOP 3</h1><p>Las tres delegaciones con más puntos del VI CONCEPMI 2026</p>
        <div class="gala__trio">${wolfMetal(3, "wolf-metal--mini")}${wolfMetal(2, "wolf-metal--mini")}${wolfMetal(1, "wolf-metal--mini")}</div></div>`;
      sonido.platillo();
    } else if (p.t === "podio") {
      const M = METAL[p.n], gana = top(p.n), redoble = p.n === 1 ? 4.2 : 3;
      escena.innerHTML = `<div class="gala__lugar gala__lugar--${M.clase}">
        <div class="gala__suspenso" data-suspenso><small>${M.txt}</small><b>🥁</b><span>Redoble de tambores…</span></div>
        <div class="gala__revela" data-revela hidden>
          ${wolfMetal(p.n, "wolf-metal--grande")}
          <div class="gala__ganador"><small>${M.txt} · ${M.medalla}</small>
            ${gana.map((f) => `<h1>${esc(nombreDel(f.delegacion))}</h1>${subDel(f.delegacion) ? `<p>${esc(subDel(f.delegacion))}</p>` : ""}`).join("")}
            ${gana.length > 1 ? `<p class="gala__empate">¡Empate! Comparten el ${p.n}.º lugar</p>` : ""}
            <div class="gala__puntos"><b data-cuenta="${gana[0].total}">0</b><span>puntos</span></div>
            ${p.n === 1 ? `<p class="gala__campeona">¡DELEGACIÓN CAMPEONA DEL VI CONCEPMI 2026!</p>` : ""}</div>
        </div></div>`;
      sonido.redoble(redoble);
      const t = setTimeout(() => {
        if (pasos[i] !== p) return;
        $("[data-suspenso]", escena).hidden = true; $("[data-revela]", escena).hidden = false;
        sonido.platillo(); sonido.fanfarria(p.n === 1);
        confeti(M.colores, p.n === 1);
        contar($("[data-cuenta]", escena), gana[0].total, 1600);
        if (p.n === 1) { bailar(6); lluvia = setInterval(() => confeti(M.colores), 2600); }
      }, redoble * 1000);
      p.limpiar = () => clearTimeout(t);
    } else if (p.t === "final") {
      const lug = (n) => { const g = top(n); if (!g.length) return `<div class="gala__pod gala__pod--vacio"></div>`;
        return `<div class="gala__pod gala__pod--${n}">${wolfMetal(n)}<b>${g.map((f) => esc(nombreDel(f.delegacion))).join(" · ")}</b><span>${g[0].total} pts</span><div class="gala__escalon">${n}</div></div>`; };
      escena.innerHTML = `<div class="gala__final"><h1 class="gala__titulo gala__titulo--chico">¡Felicitaciones a todas las delegaciones!</h1>
        <div class="gala__podio">${lug(2)}${lug(1)}${lug(3)}</div>
        <div class="gala__lista">${filas.map((f) => `<span class="${f.puesto <= 3 ? `gala__chip--${METAL[f.puesto].clase}` : ""}">${f.puesto}.º ${esc(nombreDel(f.delegacion))} · ${f.total}</span>`).join("")}</div></div>`;
      confeti(METAL[1].colores, true); sonido.fanfarria(true); bailar(7);
      lluvia = setInterval(() => confeti([...METAL[1].colores, "#1FCBEA", "#A98BFF"]), 3200);
    }
    $("[data-sig]", el).disabled = i >= pasos.length - 1;
    programarAuto();
  }

  // ---------- Navegación ----------
  function siguiente() { if (i >= pasos.length - 1) return; pasos[i].limpiar?.(); i++; pintar(); }
  function programarAuto() {
    clearTimeout(temporizador);
    if (!auto) return;
    const p = pasos[i], ms = { portada: 2500, cuenta: 0, fila: 2600, "intro-top": 4500, podio: p.n === 1 ? 14000 : 9500, final: 0 }[p.t];
    if (ms) temporizador = setTimeout(siguiente, ms);
  }
  const mostrar = () => { el.classList.add("gala--ctrl"); clearTimeout(ocultar); ocultar = setTimeout(() => el.classList.remove("gala--ctrl"), 3000); };
  el.addEventListener("mousemove", mostrar);
  $("[data-sig]", el).onclick = siguiente;
  $("[data-auto]", el).onclick = (ev) => { auto = !auto; ev.currentTarget.textContent = `Automático: ${auto ? "sí" : "no"}`; ev.currentTarget.classList.toggle("btn--naranja", auto); programarAuto(); };
  $("[data-reini]", el).onclick = () => { pasos[i].limpiar?.(); i = 0; revelados = new Set(); $("[data-bailarines]", el).innerHTML = ""; pintar(); };
  $("[data-full]", el).onclick = () => document.documentElement.requestFullscreen?.().catch(() => {});
  const cerrar = () => {
    pasos[i].limpiar?.(); clearTimeout(temporizador); clearInterval(lluvia); clearTimeout(ocultar);
    document.removeEventListener("keydown", tecla);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    el.remove();
  };
  $("[data-cerrar]", el).onclick = cerrar;
  const tecla = (e) => {
    if (document.activeElement?.tagName === "BUTTON") document.activeElement.blur();
    if (e.key === " " || e.key === "ArrowRight" || e.key === "Enter") { e.preventDefault(); siguiente(); }
    else if (e.key === "f" || e.key === "F") document.documentElement.requestFullscreen?.().catch(() => {});
    else if (e.key === "Escape" && !document.fullscreenElement) cerrar();
  };
  document.addEventListener("keydown", tecla);
  pintar();
  return { cerrar };
}

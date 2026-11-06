// =========================================================
// Ceremonia de INAUGURACIÓN (9:30 – 10:15 a. m.): pestaña del admin con el programa editable
// y pantalla para el proyector del auditorio (portada, bloque actual con quién habla,
// programa a un costado, reloj sutil con el ritmo frente al plan y el momento de
// «¡Queda inaugurado!» con fanfarria y confeti).
// El programa se guarda en este navegador (localStorage): ármalo en la laptop del proyector.
// =========================================================
import { api } from "./api.js?v=202611061316";
import { CHARLAS } from "./charlas.js?v=202611061316";
import { $, $$, esc, I, IMG, aviso, confirmar, fondoAnimado } from "./ui.js?v=202611061316";

const CLAVE = "concepmi-inauguracion-v1";
const TIPOS = {
  apertura: { txt: "Bienvenida", ico: "✦" },
  himno: { txt: "Momento solemne", ico: "♪" },
  palabras: { txt: "Palabras", ico: "❝" },
  charla: { txt: "Charla de inauguración", ico: "◆" },
  video: { txt: "Video", ico: "▶" },
  inaugura: { txt: "Apertura oficial", ico: "★" },
  general: { txt: "Programa", ico: "•" },
};
export const PROGRAMA_BASE = {
  inicio: "09:30", fin: "10:15", fecha: "Martes 24 de noviembre de 2026", lugar: "Universidad Nacional Mayor de San Marcos",
  bloques: [
    { tipo: "apertura", titulo: "Bienvenida y apertura de la ceremonia", quien: "Maestro(a) de ceremonias", cargo: "", min: 3 },
    { tipo: "himno", titulo: "Entonación del Himno Nacional del Perú", quien: "", cargo: "", min: 3 },
    { tipo: "palabras", titulo: "Palabras de bienvenida", quien: "Andy Fernández Aldoradín", cargo: "Director de Proyecto · CONCEPMI VI", min: 5 },
    { tipo: "palabras", titulo: "Palabras del PMI Lima Student Club", quien: "Saori Kikushima", cargo: "Presidenta · PMI Lima Student Club", min: 5 },
    { tipo: "palabras", titulo: "Palabras del PMI Lima, Perú Chapter", quien: "Hernan Ibarra", cargo: "Youth & Social Impact · PMI Lima", min: 5 },
    { tipo: "palabras", titulo: "Palabras de la universidad anfitriona", quien: "Autoridad de la UNMSM", cargo: "Universidad Nacional Mayor de San Marcos", min: 4 },
    { tipo: "charla", titulo: "Charla de inauguración PMI", quien: "Ponente invitado(a) del PMI", cargo: "PMI Lima, Perú Chapter", min: 15 },
    { tipo: "inaugura", titulo: "Declaración de apertura oficial y foto oficial", quien: "Directores y organizadores", cargo: "VI CONCEPMI 2026", min: 5 },
  ],
};
export const leerPrograma = () => { try { const x = JSON.parse(localStorage.getItem(CLAVE)); if (x?.bloques?.length) return x; } catch { /* nada */ } return structuredClone(PROGRAMA_BASE); };
const guardarPrograma = (p) => { try { localStorage.setItem(CLAVE, JSON.stringify(p)); } catch { /* sin almacenamiento */ } };
const aMin = (hhmm) => { const [h, m] = String(hhmm || "0:0").split(":").map(Number); return h * 60 + (m || 0); };
const hora = (min) => { const h = Math.floor(min / 60), m = Math.round(min % 60); const h12 = ((h + 11) % 12) + 1; return `${h12}:${String(m).padStart(2, "0")} ${h < 12 ? "a. m." : "p. m."}`; };
const reloj = (seg) => { seg = Math.max(0, Math.round(seg)); return `${Math.floor(seg / 60)}:${String(seg % 60).padStart(2, "0")}`; };
const total = (p) => p.bloques.reduce((s, b) => s + (Number(b.min) || 0), 0);

// ---------- Sonidos suaves (sin archivos) ----------
let ac = null;
const audio = () => { try { ac ||= new (window.AudioContext || window.webkitAudioContext)(); ac.resume?.(); } catch { /* sin sonido */ } return ac; };
function tono(f, dur, { tipo = "sine", vol = 0.16, cuando = 0 } = {}) {
  const a = audio(); if (!a) return;
  try { const t = a.currentTime + cuando, o = a.createOscillator(), g = a.createGain(); o.type = tipo; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.05); } catch { /* sin sonido */ }
}
const campana = () => { tono(880, 1.4, { vol: 0.09 }); tono(1320, 1.2, { vol: 0.05, cuando: 0.02 }); };
const fanfarria = () => { [523, 659, 784, 1047].forEach((f, i) => tono(f, 0.32, { tipo: "sawtooth", vol: 0.1, cuando: i * 0.17 })); tono(1047, 1.6, { tipo: "sawtooth", vol: 0.12, cuando: 0.75 }); tono(784, 1.6, { tipo: "triangle", vol: 0.1, cuando: 0.75 }); tono(523, 1.6, { tipo: "triangle", vol: 0.1, cuando: 0.75 }); };
function confeti() {
  const c = window.confetti; if (!c) return; const col = ["#FFD27A", "#FF7A00", "#1FCBEA", "#A98BFF", "#ffffff"];
  try { c({ particleCount: 220, spread: 120, startVelocity: 60, origin: { y: 0.6 }, colors: col, zIndex: 200 });
    [0, 1].forEach((x) => c({ particleCount: 90, angle: x ? 120 : 60, spread: 65, origin: { x, y: 0.7 }, colors: col, zIndex: 200 }));
    setTimeout(() => c({ particleCount: 160, spread: 160, startVelocity: 40, origin: { y: 0.3 }, colors: col, zIndex: 200 }), 900); } catch { /* opcional */ }
}

// ---------- Pestaña del admin: programa editable ----------
// ctx.abrirCharla(k): abre la pantalla de la charla magistral k (la usa el botón «Ir a la Charla I»)
// ctx.codigo(): para guardar el programa en la base y que la laptop del proyector lo vea igual
export async function cargarPrograma(codigo) {
  try { const r = await api.programaLeer(codigo, "inauguracion"); if (r?.datos?.bloques?.length) { guardarPrograma(r.datos); return r.datos; } } catch { /* usa la copia local */ }
  return leerPrograma();
}
export function crearInauguracion(ctx = {}) {
  let P = leerPrograma(), cargado = false, subirT = null;
  async function vista(v) {
    if (!cargado && ctx.codigo) { cargado = true; P = await cargarPrograma(ctx.codigo()); }
    const t = total(P), plan = aMin(P.fin) - aMin(P.inicio), dif = t - plan;
    let acum = aMin(P.inicio);
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Ceremonia de inauguración</h1><p>Programa de la apertura oficial (<b>${hora(aMin(P.inicio))} – ${hora(aMin(P.fin))}</b>) y la pantalla para el proyector del auditorio. Ajusta quién habla y cuántos minutos tiene cada uno; el total debe calzar con el horario.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--naranja" data-proyectar>${I.vivo}Proyectar ceremonia</button></div></div>
      <div class="inau-resumen ${dif === 0 ? "inau-resumen--ok" : "inau-resumen--mal"}">
        <b>${t} min</b> programados de <b>${plan} min</b> disponibles · ${dif === 0 ? "✓ Calza exacto con el horario" : dif > 0 ? `Sobran <b>${dif} min</b> de programa: quita minutos a algún bloque` : `Faltan <b>${-dif} min</b>: agrega minutos o un bloque`}
      </div>
      <div class="inau-datos tarjeta">
        <label class="campo"><span>Inicio</span><input data-g="inicio" value="${esc(P.inicio)}" maxlength="5" inputmode="numeric" placeholder="09:30"></label>
        <label class="campo"><span>Fin</span><input data-g="fin" value="${esc(P.fin)}" maxlength="5" inputmode="numeric" placeholder="10:15"></label>
        <label class="campo"><span>Fecha</span><input data-g="fecha" value="${esc(P.fecha)}" maxlength="60"></label>
        <label class="campo"><span>Lugar</span><input data-g="lugar" value="${esc(P.lugar)}" maxlength="80"></label>
      </div>
      <div class="inau-lista">${P.bloques.map((b, i) => { const ini = acum; acum += Number(b.min) || 0; return `
        <article class="tarjeta inau-bloque" data-i="${i}">
          <div class="inau-bloque__hora"><b>${hora(ini)}</b><small>${b.min} min</small></div>
          <div class="inau-bloque__campos">
            <label class="campo"><span>Tipo</span><select data-b="tipo">${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}" ${b.tipo === k ? "selected" : ""}>${x.txt}</option>`).join("")}</select></label>
            <label class="campo inau-ancho"><span>Bloque</span><input data-b="titulo" value="${esc(b.titulo)}" maxlength="90"></label>
            <label class="campo"><span>Quién</span><input data-b="quien" value="${esc(b.quien)}" maxlength="80" placeholder="(opcional)"></label>
            <label class="campo"><span>Cargo</span><input data-b="cargo" value="${esc(b.cargo)}" maxlength="90" placeholder="(opcional)"></label>
            <label class="campo inau-min"><span>Min</span><input data-b="min" type="number" min="1" max="45" value="${b.min}"></label>
          </div>
          <div class="inau-bloque__acc">
            <button class="btn btn--mini btn--icono" data-sube title="Subir" ${i ? "" : "disabled"}>▲</button>
            <button class="btn btn--mini btn--icono" data-baja title="Bajar" ${i < P.bloques.length - 1 ? "" : "disabled"}>▼</button>
            <button class="btn btn--mini btn--icono btn--peligro" data-quita title="Quitar">${I.basura}</button>
          </div></article>`; }).join("")}</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button class="btn" data-agrega>${I.mas}Agregar bloque</button><button class="btn" data-base>${I.girar}Volver al programa sugerido</button></div>
      <p class="ayuda">En el proyector: <b>→ / Espacio</b> pasa al siguiente bloque, <b>←</b> regresa, <b>R</b> muestra u oculta el reloj, <b>I</b> lanza «¡Queda inaugurado!», <b>Z</b> congela la pantalla («Freeze»: quieta, con «A continuación: Charla I») mientras el ponente se prepara y <b>C</b> abre la Charla I con su presentación. El reloj (sutil, en una esquina) cuenta el tiempo de cada bloque y dice si van <b>a tiempo</b> o con retraso respecto al plan. El programa se guarda en la nube: lo armas aquí y la laptop del proyector (acceso de Proyección) lo ve igual.</p>`;
    const cambia = () => { guardarPrograma(P); if (!ctx.codigo) return; clearTimeout(subirT);
      subirT = setTimeout(async () => { try { await api.adminPrograma(ctx.codigo(), "inauguracion", P); } catch (e) { aviso(`No se guardó en la nube: ${e.message}`, "error"); } }, 500); };
    $$("[data-g]", v).forEach((el) => (el.onchange = () => { P[el.dataset.g] = el.value.trim(); cambia(); vista(v); }));
    $$("[data-i]", v).forEach((art) => {
      const i = Number(art.dataset.i), b = P.bloques[i];
      $$("[data-b]", art).forEach((el) => (el.onchange = () => { b[el.dataset.b] = el.dataset.b === "min" ? Math.max(1, Math.min(45, Number(el.value) || 1)) : el.value.trim(); cambia(); vista(v); }));
      $("[data-sube]", art).onclick = () => { [P.bloques[i - 1], P.bloques[i]] = [P.bloques[i], P.bloques[i - 1]]; cambia(); vista(v); };
      $("[data-baja]", art).onclick = () => { [P.bloques[i + 1], P.bloques[i]] = [P.bloques[i], P.bloques[i + 1]]; cambia(); vista(v); };
      $("[data-quita]", art).onclick = async () => { if (await confirmar("¿Quitar este bloque?", esc(b.titulo), { boton: "Quitar", peligro: true })) { P.bloques.splice(i, 1); cambia(); vista(v); } };
    });
    $("[data-agrega]", v).onclick = () => { P.bloques.push({ tipo: "palabras", titulo: "Nuevo bloque", quien: "", cargo: "", min: 3 }); cambia(); vista(v); };
    $("[data-base]", v).onclick = async () => { if (await confirmar("¿Volver al programa sugerido?", "Se reemplaza lo que editaste.", { boton: "Volver" })) { P = structuredClone(PROGRAMA_BASE); cambia(); vista(v); } };
    $("[data-proyectar]", v).onclick = () => { if (!P.bloques.length) return aviso("Agrega al menos un bloque", "error"); abrirCeremonia(P, ctx); };
  }
  return { vista };
}

// ---------- Pantalla del proyector ----------
export function abrirCeremonia(P, ctx = {}) {
  const B = P.bloques, ini = aMin(P.inicio), fin = aMin(P.fin);
  const planIni = []; B.reduce((s, b, i) => { planIni[i] = s; return s + Number(b.min); }, 0); // minutos desde el inicio
  let i = -1, t0 = null, tBloque = null, verReloj = true, celebrando = false, congelado = false, ocultarT = null;
  const sig = CHARLAS[0];

  const el = document.createElement("div");
  el.className = "inau";
  el.innerHTML = `${fondoAnimado(34)}
    <div class="inau__aro" aria-hidden="true"></div>
    <header class="inau__cab"><img src="${IMG.club}" alt="PMI Lima Student Club"><span class="inau__sep"></span><img src="${IMG.logo}" alt="VI CONCEPMI"></header>
    <main class="inau__vista" data-vista></main>
    <aside class="inau__reloj" data-reloj></aside>
    <div class="inau__celebra" data-celebra hidden></div>
    <div class="inau__freeze" data-freeze hidden>
      <div class="inau-freeze">
        <div class="inau-freeze__logos"><img src="${IMG.club}" alt="PMI Lima Student Club"><span></span><img src="${IMG.logo}" alt="VI CONCEPMI"></div>
        <p class="inau-freeze__pre">A continuación</p>
        <h1>Charla magistral ${esc(sig?.num || "I")}</h1>
        <h2>${esc(sig?.nombre || "")}</h2>
        <p class="inau-freeze__quien">${esc(sig?.ponente || "")}</p>
        <p class="inau-freeze__hora">${esc(sig?.dia || "")} · ${esc(sig?.hora || "")}</p>
        <p class="inau-freeze__nota">En breve iniciamos · Gracias por acompañarnos</p>
      </div>
    </div>
    <nav class="inau__ctrl">
      <button class="btn btn--mini" data-ant>◀ Anterior</button>
      <button class="btn btn--mini btn--naranja" data-sig>Siguiente ▶</button>
      <button class="btn btn--mini" data-portada>Portada</button>
      <button class="btn btn--mini" data-ver-reloj>Reloj</button>
      <button class="btn btn--mini" data-inaugurar>★ ¡Queda inaugurado!</button>
      <button class="btn btn--mini" data-congelar title="Tecla Z">❄ Freeze · A continuación</button>
      ${ctx.abrirCharla ? `<button class="btn btn--mini btn--naranja" data-charla title="Tecla C">Ir a la Charla ${esc(sig?.num || "I")} ▶</button>` : ""}
      <button class="btn btn--mini" data-full>Pantalla completa</button>
      <button class="btn btn--mini btn--peligro" data-salir>Salir</button>
    </nav>`;
  document.body.append(el); document.body.style.overflow = "hidden";
  const vista = $("[data-vista]", el);

  const ahoraMin = () => { const d = new Date(); return d.getHours() * 60 + d.getMinutes() + d.getSeconds() / 60; };
  function pintar() {
    if (i < 0) {
      vista.innerHTML = `<section class="inau-portada">
        <p class="inau-portada__pre">VI Congreso Nacional de Comunidades Estudiantiles del PMI</p>
        <h1 class="inau-portada__tit"><span>Ceremonia de</span>Inauguración</h1>
        <div class="inau-portada__linea"><i></i><b>VI CONCEPMI 2026</b><i></i></div>
        <p class="inau-portada__dato">${esc(P.fecha)} · ${hora(ini)} – ${hora(fin)}</p>
        <p class="inau-portada__dato">${esc(P.lugar)}</p>
        <img class="inau-portada__lobo" src="${IMG.wolfito}" alt="">
      </section>`;
    } else {
      const b = B[i], k = TIPOS[b.tipo] || TIPOS.general;
      vista.innerHTML = `<section class="inau-bloq">
        <div class="inau-bloq__centro" style="--k:${i}">
          <p class="inau-bloq__tipo"><span>${k.ico}</span>${esc(k.txt)}</p>
          <h1 class="inau-bloq__tit">${esc(b.titulo)}</h1>
          ${b.quien ? `<div class="inau-bloq__quien"><b>${esc(b.quien)}</b>${b.cargo ? `<span>${esc(b.cargo)}</span>` : ""}</div>` : ""}
        </div>
        <ol class="inau-prog">${B.map((x, n) => `<li class="${n < i ? "hecho" : n === i ? "ahora" : ""}"><em>${hora(ini + planIni[n])}</em><span>${esc(x.titulo)}</span>${x.quien ? `<small>${esc(x.quien)}</small>` : ""}</li>`).join("")}</ol>
      </section>`;
    }
    pintarReloj(); pintarBotones();
  }
  function pintarReloj() {
    const r = $("[data-reloj]", el); r.hidden = !verReloj;
    const ya = ahoraMin(), d = new Date(), h = `${((d.getHours() + 11) % 12) + 1}:${String(d.getMinutes()).padStart(2, "0")}`;
    if (i < 0 || !t0) { const falta = (ini - ya) * 60; r.innerHTML = `<b>${h}</b><span>${falta > 0 && falta < 6 * 3600 ? `Empezamos en ${reloj(falta)}` : `${hora(ini)} – ${hora(fin)}`}</span>`; return; }
    const b = B[i], usado = (Date.now() - tBloque) / 1000, resta = b.min * 60 - usado;
    // ritmo: cuándo empezó este bloque frente a cuándo debía empezar
    const atraso = Math.round(((tBloque - t0) / 60000) - planIni[i] + Math.max(0, -resta / 60));
    const termina = ya + Math.max(0, resta / 60) + B.slice(i + 1).reduce((s, x) => s + Number(x.min), 0);
    const pct = Math.max(0, Math.min(1, usado / (b.min * 60)));
    r.className = `inau__reloj ${resta < 0 ? "inau__reloj--pasado" : resta < 60 ? "inau__reloj--ultimo" : ""}`;
    r.innerHTML = `<div class="inau__mini" style="--p:${pct}"><svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="16"/><circle class="v" cx="18" cy="18" r="16"/></svg><b>${resta >= 0 ? reloj(resta) : `+${reloj(-resta)}`}</b></div>
      <div><b>${h}</b><span>${atraso > 0 ? `${atraso} min de retraso` : atraso < 0 ? `${-atraso} min adelantados` : "Vamos a tiempo"} · fin ~${hora(termina)}</span></div>`;
  }
  function pintarBotones() { $("[data-ant]", el).disabled = i < 0; $("[data-sig]", el).textContent = i < 0 ? "Iniciar ceremonia ▶" : i >= B.length - 1 ? "Fin del programa" : "Siguiente ▶"; $("[data-sig]", el).disabled = i >= B.length - 1; }
  function ir(n) {
    if (n < -1 || n >= B.length || n === i) return;
    audio(); if (n >= 0 && !t0) t0 = Date.now();
    i = n; tBloque = Date.now(); if (n >= 0) campana(); pintar();
  }
  function inaugurar() {
    if (celebrando) { celebrando = false; $("[data-celebra]", el).hidden = true; return; }
    celebrando = true; const c = $("[data-celebra]", el); c.hidden = false;
    c.innerHTML = `<div class="inau-gran"><img src="${IMG.wolfito}" alt=""><p>Con gran orgullo</p><h1>¡Queda oficialmente<br>inaugurado el<br><b>VI CONCEPMI 2026</b>!</h1><span>Conecta · Inspira · Potencia</span></div>`;
    fanfarria(); confeti();
  }
  function congelar(si = !congelado) {
    congelado = si; $("[data-freeze]", el).hidden = !si; el.classList.toggle("inau--quieto", si);
    if (si && celebrando) { celebrando = false; $("[data-celebra]", el).hidden = true; }
    $("[data-congelar]", el).classList.toggle("activo", si);
  }
  function cerrar() { clearInterval(t); clearTimeout(ocultarT); document.removeEventListener("keydown", teclas, true); el.remove(); document.body.style.overflow = ""; }
  function irCharla() { if (!ctx.abrirCharla) return; cerrar(); ctx.abrirCharla(0); }
  function teclas(e) {
    if (document.querySelector(".modal")) return;
    const k = e.key;
    if (["ArrowRight", "PageDown", " ", "Enter"].includes(k)) { e.preventDefault(); if (congelado) return; if (celebrando) inaugurar(); else ir(i + 1); }
    else if (["ArrowLeft", "PageUp"].includes(k)) { e.preventDefault(); ir(i - 1); }
    else if (k === "r" || k === "R") { verReloj = !verReloj; pintarReloj(); }
    else if (k === "i" || k === "I") inaugurar();
    else if (k === "z" || k === "Z") congelar();
    else if (k === "c" || k === "C") irCharla();
    else if (k === "f" || k === "F") pantalla();
    else if (k === "F5" || (k === "Escape" && !document.fullscreenElement)) e.preventDefault();
  }
  const pantalla = () => (document.fullscreenElement ? document.exitFullscreen() : document.documentElement.requestFullscreen?.())?.catch?.(() => {});
  document.addEventListener("keydown", teclas, true);
  const mostrar = () => { el.classList.add("inau--ctrl"); clearTimeout(ocultarT); ocultarT = setTimeout(() => el.classList.remove("inau--ctrl"), 2600); };
  el.addEventListener("mousemove", mostrar);
  $("[data-ant]", el).onclick = () => ir(i - 1);
  $("[data-sig]", el).onclick = () => ir(i + 1);
  $("[data-portada]", el).onclick = () => { i = -1; pintar(); };
  $("[data-ver-reloj]", el).onclick = () => { verReloj = !verReloj; pintarReloj(); };
  $("[data-inaugurar]", el).onclick = inaugurar;
  $("[data-congelar]", el).onclick = () => congelar();
  $("[data-charla]", el)?.addEventListener("click", irCharla);
  $("[data-full]", el).onclick = pantalla;
  const t = setInterval(pintarReloj, 1000);
  $("[data-salir]", el).onclick = async () => { if (!(await confirmar("¿Salir de la ceremonia?", "Se cierra la pantalla del proyector.", { boton: "Salir" }))) return;
    cerrar(); if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
  pintar(); mostrar();
  document.documentElement.requestFullscreen?.().catch(() => {});
}

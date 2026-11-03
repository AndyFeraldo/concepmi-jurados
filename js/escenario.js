// =========================================================
// Pantalla del concurso para el proyector (pantalla completa). Dos momentos:
//  · Llenado: título del concurso, cronómetro oficial en vivo y avance de entregas.
//  · Exposiciones: la matriz / acta de la delegación que expone, con su cronómetro
//    de 2 min (exposición o preguntas) que SOLO empieza cuando se pulsa Iniciar.
// Los botones aparecen al mover el mouse (solo los ve quien maneja la laptop).
// =========================================================
import { ENTREGABLES } from "./entregables.js?v=202611031533";
import { porId } from "./concursos.js?v=202611031533";
import { contenidoEntrega, chipsEntrega, esActa } from "./entrega-visor.js?v=202611031533";
import { $, $$, esc, I, IMG, fondoAnimado, confirmar, aviso } from "./ui.js?v=202611031533";

const hora = (ts) => new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });
const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

// Tiempos de la fase oral (bases: 2 min de exposición + 2 min de preguntas)
const CORTOS = {
  exp: { min: 2, txt: "Exposición", ayuda: "Tiempo para exponer", fin: "Terminó el tiempo de exposición" },
  preg: { min: 2, txt: "Ronda de preguntas", ayuda: "Preguntas del jurado", fin: "Terminó la ronda de preguntas" },
};

// Sonidos con el propio navegador (sin archivos): «ti, ti, ti» al llegar a cero
let audio = null;
const preparar = () => { try { audio ||= new (window.AudioContext || window.webkitAudioContext)(); audio.resume?.(); } catch { /* sin sonido */ } };
function pitido(frec = 988, dur = 0.16, cuando = 0) {
  if (!audio) return;
  try {
    const t = audio.currentTime + cuando, o = audio.createOscillator(), g = audio.createGain();
    o.type = "square"; o.frequency.value = frec;
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.25, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(audio.destination); o.start(t); o.stop(t + dur + 0.02);
  } catch { /* sin sonido */ }
}
const alarma = () => { for (let k = 0; k < 3; k++) pitido(988, 0.16, k * 0.28); pitido(1318, 0.5, 0.9); };

// cargar() → { tiempo:{inicio, fin, ahora}, entregas:[...] } · accion(a, min) → promesa · nombre(e) → delegación
export function abrirEscenario({ concurso, cargar, accion, nombre, alCerrar }) {
  const def = ENTREGABLES[concurso], c = porId(concurso), nm = def?.nombre || "entregable", pl = def?.plural || "entregas";
  const el = document.createElement("div");
  el.className = "escenario";
  let T = { fin: null }, lista = [], desfase = 0, vivo = true, ocultar = null, ultimoSeg = null, previoLlenado = null;
  let modo = "llenado", actual = null, corto = null, orden = "id", claveCuerpo = "";
  preparar(); // el clic en «Proyectar pantalla» permite activar el sonido

  el.innerHTML = `${fondoAnimado(30)}
    <header class="portada__barra escenario__barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">VI CONCEPMI 2026</div><div class="barra__sub">Concurso ${esc(c?.nombre || "")}</div></div>
      <div class="der"><span class="en-vivo"><span class="punto punto--vivo"></span>EN VIVO</span><img class="club" src="${IMG.club}" alt="PMI Lima Perú Chapter Student Club"></div>
    </header>
    <main class="escena escenario__escena" data-portada>
      <div>
        <p class="escena__pre">PMI LIMA STUDENT CLUB PRESENTA</p>
        <img class="escena__logo escenario__logo" src="${IMG.logo}" alt="CONCEPMI VI" style="margin:0 auto">
        <h1 class="escena__titulo">Concurso ${esc(c?.nombre || "")}</h1>
        <p class="escena__sub">${esc(def?.titulo || c?.apodo || "")}</p>
        <div class="pildoras">
          <span class="pildora pildora--lila">${I.reloj}${def?.minutos || 35} min de llenado</span>
          ${def?.exposicion ? `<span class="pildora pildora--celeste">${I.personas}${esc(def.exposicion)}</span>` : ""}
          <span class="pildora pildora--oro">${I.copa}Hasta ${c?.maxCopa ?? 60} pts para la Copa</span>
        </div>
        <div class="escenario__reloj" data-reloj aria-live="polite"></div>
        <div class="escenario__avance" data-avance></div>
      </div>
    </main>
    <main class="escenario__expo" data-expo hidden>
      <div class="escenario__expo-cab">
        <div class="escenario__expo-quien"><small>Expone</small><b data-expo-nombre>—</b><span data-expo-sub></span></div>
        <div class="escenario__mini" data-mini aria-live="polite"></div>
      </div>
      <div class="escenario__cuerpo" data-expo-cuerpo></div>
    </main>
    <footer class="portada__pie" data-pie>VI Congreso Nacional de Conexiones Estudiantiles del <b>PMI</b> · 24 y 26 de noviembre · UNMSM</footer>
    <img class="wolfito" data-wolfito src="${IMG.wolfito}" alt="" aria-hidden="true">
    <div class="escenario__ctrl" data-ctrl>
      <span class="escenario__ctrl-t">Solo tú ves estos botones al mover el mouse · Atajos: Espacio = Iniciar/Pausar · ◀ ▶ = delegación</span>
      <div class="escenario__grupo" data-g-llenado><b>Llenado</b>
        <label>Min <input data-min inputmode="numeric" value="${def?.minutos || 35}"></label>
        <button class="btn btn--mini btn--naranja" data-iniciar>${I.flecha}<span>Iniciar</span></button>
        <button class="btn btn--mini" data-mas5>+5 min</button>
        <button class="btn btn--mini btn--peligro" data-detener>Terminar</button>
        <button class="btn btn--mini" data-llenado hidden>Volver a la portada del llenado</button></div>
      <div class="escenario__grupo"><b>Exposiciones</b>
        <select class="visor-sel" data-sel aria-label="Delegación que expone"></select>
        <button class="btn btn--mini" data-ant title="Delegación anterior" aria-label="Delegación anterior">◀</button><button class="btn btn--mini" data-sig title="Delegación siguiente" aria-label="Delegación siguiente">▶</button>
        <button class="btn btn--mini" data-corto="exp">${I.personas}<span>Exposición ${CORTOS.exp.min} min</span></button>
        <button class="btn btn--mini" data-corto="preg">${I.info}<span>Preguntas ${CORTOS.preg.min} min</span></button>
        <button class="btn btn--mini btn--naranja" data-arranca hidden>${I.flecha}<span>Iniciar</span></button>
        <button class="btn btn--mini" data-reset hidden title="Volver a 2:00">↺ 2:00</button>
        ${esActa(concurso) ? "" : `<button class="btn btn--mini" data-orden hidden>Orden: ID</button>`}</div>
      <div class="escenario__grupo">
        <button class="btn btn--mini" data-full>Pantalla completa</button>
        <button class="btn btn--mini" data-cerrar>${I.cerrar}<span>Salir</span></button></div>
    </div>`;
  document.body.append(el);

  const pantallaCompleta = () => document.documentElement.requestFullscreen?.().catch(() => {});
  pantallaCompleta();

  // ---------------- Momento 1: llenado ----------------
  function pintarLlenado() {
    const r = $("[data-reloj]", el);
    const fin = T.fin ? Date.parse(T.fin) : null;
    const s = fin ? Math.max(0, Math.round((fin - (Date.now() + desfase)) / 1000)) : null;
    // Suena al terminar el llenado solo si lo vimos llegar a cero en esta pantalla
    if (s === 0 && previoLlenado > 0 && previoLlenado <= 5) alarma();
    previoLlenado = s;
    $("[data-iniciar] span", el).textContent = fin ? "Reiniciar" : "Iniciar";
    $("[data-mas5]", el).hidden = $("[data-detener]", el).hidden = !fin;
    if (modo !== "llenado" || (s === ultimoSeg && r.dataset.clave === String(T.fin))) return;
    ultimoSeg = s; r.dataset.clave = String(T.fin);
    if (!fin) {
      r.className = "escenario__reloj escenario__reloj--espera";
      r.innerHTML = `<small>Prepárense</small><b>${def?.minutos || 35}:00</b><span>El tiempo de llenado empezará en un momento</span>`;
    } else if (s > 0) {
      r.className = `escenario__reloj ${s <= 60 ? "escenario__reloj--fin" : s <= 300 ? "escenario__reloj--alerta" : ""}`;
      r.innerHTML = `<small>Tiempo para llenar ${def?.tipo === "acta" ? "el acta" : "la matriz"}</small><b>${mmss(s)}</b><span>Termina a las ${hora(fin)}</span>`;
    } else {
      r.className = "escenario__reloj escenario__reloj--fin";
      r.innerHTML = `<small>Se acabó el tiempo</small><b>¡Tiempo!</b><span>Envíen su ${nm} ahora: después del minuto de gracia queda como entrega tardía</span>`;
    }
  }
  function pintarAvance() {
    const env = lista.filter((e) => e.estado === "enviado").length, n = lista.length;
    $("[data-avance]", el).innerHTML = n ? `<div class="escenario__barra-av"><i style="width:${(env / n) * 100}%"></i></div><span><b>${env}</b> de ${n} ${pl} enviadas</span>` : "";
  }

  // ---------------- Momento 2: exposiciones ----------------
  const restante = () => (corto.corriendo ? Math.max(0, Math.ceil((corto.fin - Date.now()) / 1000)) : corto.restante);
  function prepararCorto(tipo) { corto = { tipo, restante: CORTOS[tipo].min * 60, corriendo: false, sono: false, aviso30: false }; }
  function irAExpo(tipo) {
    if (!lista.length) return aviso(`Aún no hay equipos en este concurso`, "error");
    if (!actual || !lista.some((e) => e.equipo_id === actual)) actual = lista[0].equipo_id;
    modo = "expo"; prepararCorto(tipo); claveCuerpo = ""; aplicarModo(); pintarExpo(); pintarMini();
  }
  function aplicarModo() {
    const ex = modo === "expo";
    $("[data-portada]", el).hidden = ex; $("[data-expo]", el).hidden = !ex;
    $("[data-pie]", el).hidden = ex; $("[data-wolfito]", el).hidden = ex;
    el.classList.toggle("escenario--expo", ex);
    $("[data-llenado]", el).hidden = !ex;
    $("[data-arranca]", el).hidden = $("[data-reset]", el).hidden = !ex;
    const o = $("[data-orden]", el); if (o) o.hidden = !ex;
    $$("[data-corto]", el).forEach((b) => b.classList.toggle("btn--naranja", ex && corto?.tipo === b.dataset.corto));
    if (!ex) { ultimoSeg = null; $("[data-reloj]", el).dataset.clave = ""; pintarLlenado(); }
  }
  function pintarSelector() {
    const sel = $("[data-sel]", el);
    const html = lista.map((x) => `<option value="${x.equipo_id}" ${x.equipo_id === actual ? "selected" : ""}>${esc(nombre(x))}${x.estado === "enviado" ? "" : " · sin enviar"}</option>`).join("");
    if (sel.dataset.html !== html) { sel.innerHTML = html || `<option>Sin equipos</option>`; sel.dataset.html = html; }
  }
  function pintarExpo() {
    if (modo !== "expo") return;
    const e = lista.find((x) => x.equipo_id === actual);
    const clave = JSON.stringify([actual, orden, e?.actualizado, e?.estado]);
    if (clave === claveCuerpo) return; claveCuerpo = clave;
    $("[data-expo-nombre]", el).textContent = e ? nombre(e) : "—";
    const proyecto = esActa(concurso) && e?.datos?.general?.nombre ? `Proyecto: ${e.datos.general.nombre}` : "";
    $("[data-expo-sub]", el).innerHTML = e ? `${esc(def?.titulo || "")}${proyecto ? ` · <b>${esc(proyecto)}</b>` : ""}${e.estado === "enviado" ? "" : ` · <span class="chip chip--ambar">Aún no la envían</span>`}` : "";
    $("[data-expo-cuerpo]", el).innerHTML = e ? `<div class="reparto" style="margin:0 0 10px">${chipsEntrega(concurso, e.datos)}</div>${contenidoEntrega(concurso, e.datos, { orden })}` : `<div class="vacio"><b>Aún no hay equipos</b></div>`;
    const o = $("[data-orden]", el); if (o) o.textContent = orden === "id" ? "Orden: ID" : "Orden: severidad ▼";
  }
  function pintarMini() {
    if (modo !== "expo" || !corto) return;
    const m = $("[data-mini]", el), s = restante(), k = CORTOS[corto.tipo];
    const clave = `${corto.tipo}${s}${corto.corriendo}`;
    if (clave !== m.dataset.clave) {
      m.dataset.clave = clave;
      if (s === 0 && corto.corriendo && !corto.sono) { corto.sono = true; corto.corriendo = false; corto.restante = 0; alarma(); }
      if (s === 30 && corto.corriendo && !corto.aviso30) { corto.aviso30 = true; pitido(880, 0.12); }
      const listo = !corto.corriendo && s === k.min * 60;
      m.className = `escenario__mini ${s === 0 ? "escenario__mini--fin" : s <= 30 ? "escenario__mini--alerta" : ""} ${listo ? "escenario__mini--listo" : ""}`;
      m.innerHTML = `<small>${k.txt}</small><b>${s === 0 ? "¡Tiempo!" : mmss(s)}</b><span>${s === 0 ? k.fin : listo ? "Listos para empezar" : corto.corriendo ? k.ayuda : "En pausa"}</span>`;
    }
    const b = $("[data-arranca] span", el);
    b.textContent = corto.corriendo ? "Pausar" : restante() === CORTOS[corto.tipo].min * 60 ? "Iniciar" : restante() === 0 ? "Iniciar" : "Reanudar";
    $("[data-arranca]", el).classList.toggle("btn--naranja", !corto.corriendo);
  }
  function arrancar() {
    if (modo !== "expo" || !corto) return;
    preparar();
    if (corto.corriendo) { corto.restante = restante(); corto.corriendo = false; }
    else { if (corto.restante === 0) prepararCorto(corto.tipo); corto.fin = Date.now() + corto.restante * 1000; corto.corriendo = true; pitido(660, 0.1); }
    $("[data-mini]", el).dataset.clave = ""; pintarMini();
  }
  function mover(p) {
    if (!lista.length) return; const i = lista.findIndex((e) => e.equipo_id === actual);
    actual = lista[(i + p + lista.length) % lista.length].equipo_id;
    if (modo !== "expo") return irAExpo("exp");
    prepararCorto("exp"); aplicarModo(); pintarSelector(); pintarExpo(); $("[data-mini]", el).dataset.clave = ""; pintarMini();
  }

  async function leer() {
    try {
      const t0 = Date.now(); const r = await cargar(); const t1 = Date.now();
      T = r.tiempo || { fin: null }; lista = r.entregas || [];
      if (T.ahora) desfase = Date.parse(T.ahora) - (t0 + t1) / 2;
      if (!actual && lista.length) actual = lista[0].equipo_id;
      ultimoSeg = null; pintarLlenado(); pintarAvance(); pintarSelector(); pintarExpo();
    } catch { /* se reintenta en la siguiente vuelta */ }
  }

  // ---------------- Botones ----------------
  const mostrar = () => { el.classList.add("escenario--ctrl"); clearTimeout(ocultar); ocultar = setTimeout(() => el.classList.remove("escenario--ctrl"), 3500); };
  el.addEventListener("mousemove", mostrar);
  const volverLlenado = () => { modo = "llenado"; corto = null; aplicarModo(); };
  const hacer = async (a, min) => { preparar(); if (modo !== "llenado") volverLlenado(); try { await accion(a, min); await leer(); aviso(a === "iniciar" ? "¡Tiempo iniciado!" : a === "extender" ? "+5 minutos" : "Tiempo terminado"); } catch (e) { aviso(e.message, "error"); } };
  $("[data-iniciar]", el).onclick = async () => {
    const min = Math.max(1, Math.min(240, Number($("[data-min]", el).value) || def?.minutos || 35));
    if (T.fin && !(await confirmar("¿Reiniciar el tiempo de llenado?", `El cronómetro oficial vuelve a empezar con ${min} minutos para todos los equipos.`, { boton: "Reiniciar" }))) return;
    hacer("iniciar", min);
  };
  $("[data-mas5]", el).onclick = () => hacer("extender", 5);
  $("[data-detener]", el).onclick = async () => { if (await confirmar("¿Terminar el tiempo de llenado ahora?", "Los equipos tendrán 1 minuto de gracia y luego ya no podrán editar.", { boton: "Terminar ahora", peligro: true })) hacer("detener"); };
  $("[data-llenado]", el).onclick = volverLlenado;
  $("[data-full]", el).onclick = pantallaCompleta;
  // Exposición / Preguntas: muestra la entrega y deja el reloj LISTO en 2:00; empieza con Iniciar
  $$("[data-corto]", el).forEach((b) => (b.onclick = () => {
    preparar();
    if (modo !== "expo") return irAExpo(b.dataset.corto);
    prepararCorto(b.dataset.corto); aplicarModo(); $("[data-mini]", el).dataset.clave = ""; pintarMini();
  }));
  $("[data-arranca]", el).onclick = arrancar;
  $("[data-reset]", el).onclick = () => { if (corto) { prepararCorto(corto.tipo); $("[data-mini]", el).dataset.clave = ""; pintarMini(); } };
  $("[data-sel]", el).onchange = (ev) => { actual = ev.target.value; if (modo !== "expo") irAExpo("exp"); else mover(0); };
  $("[data-ant]", el).onclick = () => mover(-1);
  $("[data-sig]", el).onclick = () => mover(1);
  $("[data-orden]", el)?.addEventListener("click", () => { orden = orden === "id" ? "sev" : "id"; claveCuerpo = ""; pintarExpo(); });

  const cerrar = () => {
    vivo = false; clearInterval(t1); clearInterval(t2); clearTimeout(ocultar);
    document.removeEventListener("keydown", tecla);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    el.remove(); alCerrar?.();
  };
  $("[data-cerrar]", el).onclick = cerrar;
  // Atajos de teclado. En pantalla completa, Esc solo sale de ella (lo hace el navegador); un segundo Esc cierra
  const tecla = (e) => {
    if (document.querySelector(".velo") || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName || "")) return;
    if (document.activeElement?.tagName === "BUTTON") document.activeElement.blur();
    if (e.key === "Escape" && !document.fullscreenElement) cerrar();
    else if (e.key === "f" || e.key === "F") pantallaCompleta();
    else if (e.key === " " && modo === "expo") { e.preventDefault(); arrancar(); }
    else if (e.key === "ArrowRight") mover(1);
    else if (e.key === "ArrowLeft") mover(-1);
  };
  document.addEventListener("keydown", tecla);

  const t1 = setInterval(() => { if (!vivo) return; pintarLlenado(); pintarMini(); }, 250);
  const t2 = setInterval(() => vivo && leer(), 3000);
  pintarLlenado(); leer();
  return { cerrar };
}

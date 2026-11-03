// =========================================================
// Pantalla del concurso para el proyector (pantalla completa):
// fondo en movimiento, título del concurso, cronómetro oficial en vivo
// y avance de entregas. El admin maneja el tiempo con una barra
// discreta que solo aparece al mover el mouse.
// =========================================================
import { ENTREGABLES } from "./entregables.js?v=202611030730";
import { porId } from "./concursos.js?v=202611030730";
import { $, esc, I, IMG, fondoAnimado, confirmar, aviso } from "./ui.js?v=202611030730";

const hora = (ts) => new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

// Tiempos de la fase oral (bases Amateur II: 2 min de exposición + 2 min de preguntas)
const CORTOS = {
  exp: { min: 2, txt: "Exposición del equipo", ayuda: "Tiempo para exponer la matriz", fin: "Terminó el tiempo de exposición" },
  preg: { min: 2, txt: "Ronda de preguntas", ayuda: "Preguntas del jurado y respuestas del equipo", fin: "Terminó la ronda de preguntas" },
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

// cargar() → { tiempo:{inicio, fin, ahora}, entregas:[...] } · accion(a, min) → promesa
export function abrirEscenario({ concurso, cargar, accion, alCerrar }) {
  const def = ENTREGABLES[concurso], c = porId(concurso);
  const el = document.createElement("div");
  el.className = "escenario";
  let T = { fin: null }, lista = [], desfase = 0, vivo = true, ocultar = null, ultimoSeg = null, corto = null, previoLlenado = null;
  preparar(); // el clic en «Proyectar pantalla» permite activar el sonido

  el.innerHTML = `${fondoAnimado(30)}
    <header class="portada__barra escenario__barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">VI CONCEPMI 2026</div><div class="barra__sub">Concursos académicos</div></div>
      <div class="der"><span class="en-vivo"><span class="punto punto--vivo"></span>EN VIVO</span><img class="club" src="${IMG.club}" alt="PMI Lima Perú Chapter Student Club"></div>
    </header>
    <main class="escena escenario__escena">
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
    <footer class="portada__pie">VI Congreso Nacional de Conexiones Estudiantiles del <b>PMI</b> · 24 y 26 de noviembre · UNMSM</footer>
    <img class="wolfito" src="${IMG.wolfito}" alt="" aria-hidden="true">
    <div class="escenario__ctrl" data-ctrl>
      <span class="escenario__ctrl-t">Solo tú ves estos botones al mover el mouse</span>
      <div class="escenario__grupo"><b>Llenado</b>
        <label>Min <input data-min inputmode="numeric" value="${def?.minutos || 35}"></label>
        <button class="btn btn--mini btn--naranja" data-iniciar>${I.flecha}<span>Iniciar</span></button>
        <button class="btn btn--mini" data-mas5>+5 min</button>
        <button class="btn btn--mini btn--peligro" data-detener>Terminar</button></div>
      <div class="escenario__grupo"><b>Exposiciones</b>
        <button class="btn btn--mini btn--naranja" data-corto="exp">${I.personas}<span>Exposición ${CORTOS.exp.min} min</span></button>
        <button class="btn btn--mini btn--naranja" data-corto="preg">${I.info}<span>Preguntas ${CORTOS.preg.min} min</span></button>
        <button class="btn btn--mini" data-pausa hidden>Pausar</button>
        <button class="btn btn--mini" data-llenado hidden>Volver al llenado</button></div>
      <div class="escenario__grupo">
        <button class="btn btn--mini" data-full>Pantalla completa</button>
        <button class="btn btn--mini" data-cerrar>${I.cerrar}<span>Salir</span></button></div>
    </div>`;
  document.body.append(el);

  const pantallaCompleta = () => document.documentElement.requestFullscreen?.().catch(() => {});
  pantallaCompleta();

  // Cronómetro corto de exposición / preguntas: solo en esta pantalla (no cambia el tiempo oficial)
  const mmss = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  function restanteCorto() { return corto.pausa != null ? corto.pausa : Math.max(0, Math.ceil((corto.fin - Date.now()) / 1000)); }
  function pintarCorto(r) {
    const s = restanteCorto(), k = CORTOS[corto.tipo];
    const clave = `c${corto.tipo}${s}${corto.pausa != null}`;
    if (clave === r.dataset.clave) return; r.dataset.clave = clave;
    if (s === 0 && !corto.sono) { corto.sono = true; alarma(); }
    if (s === 30 && corto.pausa == null && !corto.aviso30) { corto.aviso30 = true; pitido(880, 0.12); }
    r.className = `escenario__reloj escenario__reloj--corto ${s === 0 ? "escenario__reloj--fin" : s <= 30 ? "escenario__reloj--alerta" : ""}`;
    r.innerHTML = s > 0
      ? `<small>${k.txt}</small><b>${mmss(s)}</b><span>${corto.pausa != null ? "En pausa" : k.ayuda}</span>`
      : `<small>${k.txt}</small><b>¡Tiempo!</b><span>${k.fin}</span>`;
    $("[data-pausa]", el).textContent = corto.pausa != null ? "Reanudar" : "Pausar";
    $("[data-pausa]", el).hidden = s === 0;
  }

  function pintarReloj() {
    const r = $("[data-reloj]", el);
    $("[data-avance]", el).hidden = !!corto;
    if (corto) return pintarCorto(r);
    const fin = T.fin ? Date.parse(T.fin) : null;
    const s = fin ? Math.max(0, Math.round((fin - (Date.now() + desfase)) / 1000)) : null;
    // Suena al terminar el llenado solo si lo vimos llegar a cero en esta pantalla
    if (s === 0 && previoLlenado > 0 && previoLlenado <= 5) alarma();
    previoLlenado = s;
    if (s === ultimoSeg && r.dataset.clave === String(T.fin)) return;
    ultimoSeg = s; r.dataset.clave = String(T.fin);
    if (!fin) {
      r.className = "escenario__reloj escenario__reloj--espera";
      r.innerHTML = `<small>Prepárense</small><b>${def?.minutos || 35}:00</b><span>El tiempo de llenado empezará en un momento</span>`;
    } else if (s > 0) {
      r.className = `escenario__reloj ${s <= 60 ? "escenario__reloj--fin" : s <= 300 ? "escenario__reloj--alerta" : ""}`;
      r.innerHTML = `<small>Tiempo para llenar la matriz</small><b>${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}</b><span>Termina a las ${hora(fin)}</span>`;
    } else {
      r.className = "escenario__reloj escenario__reloj--fin";
      r.innerHTML = `<small>Se acabó el tiempo</small><b>¡Tiempo!</b><span>Envíen su matriz ahora: después del minuto de gracia queda como entrega tardía</span>`;
    }
    $("[data-iniciar] span", el).textContent = fin ? "Reiniciar" : "Iniciar";
    $("[data-mas5]", el).hidden = $("[data-detener]", el).hidden = !fin;
  }

  function pintarAvance() {
    const env = lista.filter((e) => e.estado === "enviado").length, n = lista.length;
    $("[data-avance]", el).innerHTML = n ? `<div class="escenario__barra-av"><i style="width:${(env / n) * 100}%"></i></div><span><b>${env}</b> de ${n} matrices enviadas</span>` : "";
  }

  async function leer() {
    try {
      const t0 = Date.now(); const r = await cargar(); const t1 = Date.now();
      T = r.tiempo || { fin: null }; lista = r.entregas || [];
      if (T.ahora) desfase = Date.parse(T.ahora) - (t0 + t1) / 2;
      ultimoSeg = null; pintarReloj(); pintarAvance();
    } catch { /* se reintenta en la siguiente vuelta */ }
  }

  // Barra del admin: aparece al mover el mouse y se esconde a los 3 s
  const mostrar = () => { el.classList.add("escenario--ctrl"); clearTimeout(ocultar); ocultar = setTimeout(() => el.classList.remove("escenario--ctrl"), 3000); };
  el.addEventListener("mousemove", mostrar);
  const hacer = async (a, min) => { preparar(); if (corto) $("[data-llenado]", el).onclick(); try { await accion(a, min); await leer(); aviso(a === "iniciar" ? "¡Tiempo iniciado!" : a === "extender" ? "+5 minutos" : "Tiempo terminado"); } catch (e) { aviso(e.message, "error"); } };
  $("[data-iniciar]", el).onclick = async () => {
    const min = Math.max(1, Math.min(240, Number($("[data-min]", el).value) || def?.minutos || 35));
    if (T.fin && !(await confirmar("¿Reiniciar el tiempo?", `El cronómetro vuelve a empezar con ${min} minutos para todos los equipos.`, { boton: "Reiniciar" }))) return;
    hacer("iniciar", min);
  };
  $("[data-mas5]", el).onclick = () => hacer("extender", 5);
  $("[data-detener]", el).onclick = async () => { if (await confirmar("¿Terminar el tiempo ahora?", "Los equipos tendrán 1 minuto de gracia y luego ya no podrán editar.", { boton: "Terminar ahora", peligro: true })) hacer("detener"); };
  $("[data-full]", el).onclick = pantallaCompleta;
  el.querySelectorAll("[data-corto]").forEach((b) => (b.onclick = () => {
    preparar();
    const tipo = b.dataset.corto;
    corto = { tipo, fin: Date.now() + CORTOS[tipo].min * 60000, pausa: null, sono: false, aviso30: false };
    pitido(660, 0.1);
    $("[data-llenado]", el).hidden = false; pintarReloj();
  }));
  $("[data-pausa]", el).onclick = () => {
    if (!corto) return;
    if (corto.pausa != null) { corto.fin = Date.now() + corto.pausa * 1000; corto.pausa = null; }
    else corto.pausa = restanteCorto();
    pintarReloj();
  };
  $("[data-llenado]", el).onclick = () => {
    corto = null; ultimoSeg = null; $("[data-reloj]", el).dataset.clave = "";
    $("[data-llenado]", el).hidden = $("[data-pausa]", el).hidden = true; pintarReloj();
  };

  const cerrar = () => {
    vivo = false; clearInterval(t1); clearInterval(t2); clearTimeout(ocultar);
    document.removeEventListener("keydown", tecla);
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    el.remove(); alCerrar?.();
  };
  $("[data-cerrar]", el).onclick = cerrar;
  // En pantalla completa, Esc solo sale de ella (lo hace el navegador); un segundo Esc cierra
  const tecla = (e) => { if (document.querySelector(".velo")) return; if (e.key === "Escape" && !document.fullscreenElement) cerrar(); if (e.key === "f" || e.key === "F") pantallaCompleta(); };
  document.addEventListener("keydown", tecla);

  const t1 = setInterval(() => vivo && pintarReloj(), 250);
  const t2 = setInterval(() => vivo && leer(), 3000);
  pintarReloj(); leer();
  return { cerrar };
}

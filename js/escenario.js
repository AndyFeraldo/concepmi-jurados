// =========================================================
// Pantalla del concurso para el proyector (pantalla completa):
// fondo en movimiento, título del concurso, cronómetro oficial en vivo
// y avance de entregas. El admin maneja el tiempo con una barra
// discreta que solo aparece al mover el mouse.
// =========================================================
import { ENTREGABLES } from "./entregables.js?v=202611030644";
import { porId } from "./concursos.js?v=202611030644";
import { $, esc, I, IMG, fondoAnimado, confirmar, aviso } from "./ui.js?v=202611030644";

const hora = (ts) => new Date(ts).toLocaleTimeString("es-PE", { hour: "2-digit", minute: "2-digit" });

// cargar() → { tiempo:{inicio, fin, ahora}, entregas:[...] } · accion(a, min) → promesa
export function abrirEscenario({ concurso, cargar, accion, alCerrar }) {
  const def = ENTREGABLES[concurso], c = porId(concurso);
  const el = document.createElement("div");
  el.className = "escenario";
  let T = { fin: null }, lista = [], desfase = 0, vivo = true, ocultar = null, ultimoSeg = null;

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
      <label>Min <input data-min inputmode="numeric" value="${def?.minutos || 35}"></label>
      <button class="btn btn--mini btn--naranja" data-iniciar>${I.flecha}<span>Iniciar</span></button>
      <button class="btn btn--mini" data-mas5>+5 min</button>
      <button class="btn btn--mini btn--peligro" data-detener>Terminar</button>
      <button class="btn btn--mini" data-full>Pantalla completa</button>
      <button class="btn btn--mini" data-cerrar>${I.cerrar}<span>Salir</span></button>
    </div>`;
  document.body.append(el);

  const pantallaCompleta = () => document.documentElement.requestFullscreen?.().catch(() => {});
  pantallaCompleta();

  function pintarReloj() {
    const r = $("[data-reloj]", el);
    const fin = T.fin ? Date.parse(T.fin) : null;
    const s = fin ? Math.max(0, Math.round((fin - (Date.now() + desfase)) / 1000)) : null;
    if (s === ultimoSeg && r.dataset.fin === String(T.fin)) return;
    ultimoSeg = s; r.dataset.fin = String(T.fin);
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
  const hacer = async (a, min) => { try { await accion(a, min); await leer(); aviso(a === "iniciar" ? "¡Tiempo iniciado!" : a === "extender" ? "+5 minutos" : "Tiempo terminado"); } catch (e) { aviso(e.message, "error"); } };
  $("[data-iniciar]", el).onclick = async () => {
    const min = Math.max(1, Math.min(240, Number($("[data-min]", el).value) || def?.minutos || 35));
    if (T.fin && !(await confirmar("¿Reiniciar el tiempo?", `El cronómetro vuelve a empezar con ${min} minutos para todos los equipos.`, { boton: "Reiniciar" }))) return;
    hacer("iniciar", min);
  };
  $("[data-mas5]", el).onclick = () => hacer("extender", 5);
  $("[data-detener]", el).onclick = async () => { if (await confirmar("¿Terminar el tiempo ahora?", "Los equipos tendrán 1 minuto de gracia y luego ya no podrán editar.", { boton: "Terminar ahora", peligro: true })) hacer("detener"); };
  $("[data-full]", el).onclick = pantallaCompleta;

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

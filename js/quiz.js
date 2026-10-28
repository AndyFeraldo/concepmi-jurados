// =========================================================
// Trivia de la charla para los ASISTENTES (entran por el QR)
// El servidor manda: dice en qué pregunta vamos y cuándo termina.
// 15 s por pregunta; si todos respondieron, pasa a la siguiente.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202610280411";
import { charlaPorId, PUNTOS_PODIO, barajar } from "./charlas.js?v=202610280411";
import { $, $$, esc, I, IMG, lanzarConfeti } from "./ui.js?v=202610280411";

const COLORES = ["rojo", "azul", "oro", "verde"];
const FORMAS = ["▲", "◆", "●", "■"];
const AVISO_ORDEN = `<div class="aviso-orden">⚠️ <b>Las opciones y los colores salen en distinto orden en cada celular.</b> Lee el texto de la respuesta, no te guíes por el color ni la posición.</div>`;

export async function vistaQuiz(app, charlaId) {
  const ch = charlaPorId(charlaId);
  const CLAVE = `concepmi-quiz-${charlaId}`;
  if (!ch) { app.innerHTML = `<div class="quiz"><div class="quiz__caja"><h1>Charla no encontrada</h1><p>Vuelve a escanear el QR del auditorio.</p></div></div>`; return; }

  let yo = leer(); // { dni, token, nombre, delegacion }
  let desfase = 0; // reloj del servidor - reloj del celular
  let estado = null, pregunta = null, respondi = new Set(), resultado = null, ultimaPintada = "";
  let tic = null, sondeo = null;

  function leer() { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; } }
  function guardarYo(v) { yo = v; try { v ? localStorage.setItem(CLAVE, JSON.stringify(v)) : localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } }
  const ahora = () => Date.now() + desfase;
  const segHasta = (t) => Math.max(0, (Date.parse(t) - ahora()) / 1000);

  function marco(html) {
    app.innerHTML = `<div class="fondo fondo--sobrio"></div>
      <div class="quiz">
        <header class="quiz__cab"><img class="logo" src="${IMG.logo}" alt="CONCEPMI">
          <div><div class="quiz__pre">Charla Principal ${ch.num}</div><div class="quiz__tit">${esc(ch.nombre)}</div></div></header>
        <main class="quiz__caja">${html}</main>
        ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}
      </div>`;
  }

  // ---------------- Registro con DNI ----------------
  function registro() {
    marco(`
      <p class="quiz__ponente">${esc(ch.ponente)} · ${esc(ch.dia)}</p>
      <h1>¡Juega la trivia!</h1>
      <p>Responde las preguntas de la charla. El podio suma puntos para su delegación en la Copa CONCEPMI: <b>1.° +${PUNTOS_PODIO[0]}</b>, <b>2.° +${PUNTOS_PODIO[1]}</b> y <b>3.° +${PUNTOS_PODIO[2]}</b>.</p>
      <form class="form" data-buscar>
        <label class="campo"><span>Tu DNI</span><input name="dni" inputmode="numeric" autocomplete="off" maxlength="15" placeholder="Ej. 71234567" required></label>
        <p class="error" aria-live="polite"></p>
        <button class="btn btn--naranja btn--grande">Buscar mis datos ${I.flecha}</button>
      </form>
      ${ES_DEMO ? `<p class="ayuda">Vista previa: prueba con el DNI <b>700000001</b>.</p>` : ""}`);
    const f = $("[data-buscar]", app);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const err = $(".error", f); const btn = $("button", f); err.textContent = ""; btn.disabled = true;
      try {
        const a = await api.quizBuscar(f.dni.value);
        if (!a) { err.textContent = "No encontramos ese DNI en la lista de inscritos. Revisa el número."; return; }
        confirmarDatos(f.dni.value, a);
      } catch (ex) { err.textContent = ex.message || "No se pudo conectar. Revisa tu internet."; }
      finally { btn.disabled = false; }
    };
  }

  function confirmarDatos(dni, a) {
    marco(`
      <h1>¿Eres tú?</h1>
      <div class="quiz__ficha">
        <div><small>Nombre</small><b>${esc(a.nombre)}</b></div>
        ${a.codigo ? `<div><small>Código</small><b>${esc(a.codigo)}</b></div>` : ""}
        <div><small>Delegación</small><b>${a.delegacion ? esc(a.delegacion.siglas ? `${a.delegacion.siglas} · ${a.delegacion.nombre}` : a.delegacion.nombre) : "Sin delegación"}</b></div>
      </div>
      <p class="error" aria-live="polite">${a.delegacion ? "" : "Tu delegación aún no está registrada. Acércate al equipo organizador."}</p>
      <div class="quiz__acciones">
        <button class="btn" data-no>No soy yo</button>
        <button class="btn btn--naranja btn--grande" data-si ${a.delegacion ? "" : "disabled"}>Entrar a la sala ${I.flecha}</button>
      </div>`);
    $("[data-no]", app).onclick = registro;
    $("[data-si]", app).onclick = async (e) => {
      const btn = e.currentTarget; btn.disabled = true;
      try {
        const r = await api.quizUnirse(charlaId, dni);
        guardarYo({ dni, token: r.token, nombre: a.nombre, delegacion: a.delegacion });
        arrancar();
      } catch (ex) { $(".error", app).textContent = ex.message; btn.disabled = false; }
    };
  }

  // ---------------- Juego ----------------
  async function leerEstado() {
    const t0 = Date.now();
    const e = await api.quizEstado(charlaId, yo.dni, yo.token);
    desfase = Date.parse(e.ahora) - (t0 + Date.now()) / 2;
    return e;
  }

  async function arrancar() {
    clearInterval(tic); clearTimeout(sondeo);
    try { estado = await leerEstado(); }
    catch (ex) { marco(`<h1>Sin conexión</h1><p>${esc(ex.message)}</p><button class="btn btn--naranja" data-otra>Reintentar</button>`); $("[data-otra]", app).onclick = arrancar; return; }
    if (!estado.unido) { guardarYo(null); return registro(); }
    tic = setInterval(pintar, 250);
    sondear();
    pintar();
  }

  // Consulta al servidor cada segundo durante el juego (así se entera si todos ya respondieron)
  async function sondear() {
    try {
      const e = await leerEstado();
      if (!e.unido) { clearInterval(tic); guardarYo(null); return registro(); }
      if (e.fase === "espera" && estado?.fase !== "espera") { respondi = new Set(); resultado = null; pregunta = null; }
      estado = e;
      if (e.respondida) respondi.add(e.pregunta);
    } catch { /* se reintenta */ }
    sondeo = setTimeout(sondear, estado?.fase === "espera" ? 2000 : estado?.fase === "terminada" ? 4000 : 1000);
  }

  function pintar() {
    const f = estado?.fase;
    if (f === "espera") return pintarUna(`espera${estado.jugadores}`, () => marco(`
      <div class="quiz__espera"><div class="giro"></div></div>
      <h1>¡Estás en la sala, ${esc(yo.nombre.split(" ")[0])}!</h1>
      <p>Mira la pantalla del auditorio. La trivia empieza cuando el organizador la inicie.</p>
      <div class="quiz__ficha"><div><small>Delegación</small><b>${esc(yo.delegacion?.siglas || yo.delegacion?.nombre || "")}</b></div><div><small>En la sala</small><b>${estado.jugadores}</b></div></div>
      <p class="ayuda">${estado.preguntas} preguntas · ${estado.seg} segundos cada una · No cierres esta página.</p>
      ${AVISO_ORDEN}`));
    if (f === "cuenta") {
      const s = Math.max(1, Math.ceil(segHasta(estado.inicio)));
      return pintarUna(`cuenta${s}`, () => marco(`<p>¡Prepárate!</p><div class="quiz__cuenta">${s}</div>${AVISO_ORDEN}`));
    }
    if (f === "jugando") return jugando();
    if (f === "pausa") {
      const s = Math.max(1, Math.ceil(segHasta(estado.inicio)));
      const a = estado.anterior;
      return pintarUna(`pausa${estado.pregunta}${s}`, () => marco(`
        <div class="quiz__veredicto quiz__veredicto--${a === true ? "bien" : a === false ? "mal" : "nada"}">
          <span>${a === true ? "✓" : a === false ? "✕" : "⏱"}</span><b>${a === true ? "¡Correcto!" : a === false ? "Incorrecto" : "No respondiste a tiempo"}</b></div>
        <p>${estado.pregunta >= estado.preguntas ? "Resultados" : "Siguiente pregunta"} en <b>${s}</b>…</p>`));
    }
    if (f === "terminada") return terminada();
  }
  function pintarUna(clave, fn) { if (clave !== ultimaPintada) { ultimaPintada = clave; fn(); } }

  async function jugando() {
    const orden = estado.pregunta;
    const restante = segHasta(estado.fin);
    if (pregunta?.orden !== orden) {
      if (pregunta?.cargando === orden || Date.now() < (pregunta?.reintento || 0)) return;
      pregunta = { cargando: orden };
      try {
        const q = await api.quizPregunta(charlaId, yo.dni, yo.token, orden);
        pregunta = { ...q, orden };
        if (q?.respondida) respondi.add(orden);
      } catch { pregunta = { reintento: Date.now() + 1000 }; return; }
      ultimaPintada = "";
    }
    if (!pregunta?.texto) return;
    const ya = respondi.has(orden);
    pintarUna(`q${orden}${ya}`, () => {
      const orden2 = barajar(pregunta.opciones.length, `${yo.token}-${orden}`);
      marco(`
        <div class="quiz__barra"><span>Pregunta ${orden + 1} de ${estado.preguntas}</span><b data-seg>${Math.ceil(restante)}</b></div>
        <div class="progreso"><i data-tiempo style="width:${(restante / estado.seg) * 100}%"></i></div>
        <h2 class="quiz__pregunta">${esc(pregunta.texto)}</h2>
        ${ya ? `<div class="quiz__enviada">${I.check}<b>¡Respuesta enviada!</b><span>Espera a los demás o a que se acabe el tiempo.</span></div>`
          : `${AVISO_ORDEN}<div class="quiz__opciones">${orden2.map((i, k) => `<button class="opcion opcion--${COLORES[k]}" data-op="${i}"><span>${FORMAS[k]}</span>${esc(pregunta.opciones[i])}</button>`).join("")}</div>`}`);
      $$("[data-op]", app).forEach((b) => (b.onclick = async () => {
        $$("[data-op]", app).forEach((x) => (x.disabled = true)); b.classList.add("opcion--elegida");
        try { await api.quizResponder(charlaId, yo.dni, yo.token, orden, Number(b.dataset.op)); respondi.add(orden); ultimaPintada = ""; }
        catch (ex) {
          if (/tiempo/i.test(ex.message)) { respondi.add(orden); ultimaPintada = ""; }
          else { $$("[data-op]", app).forEach((x) => (x.disabled = false)); b.classList.remove("opcion--elegida"); }
        }
      }));
    });
    const seg = $("[data-seg]", app), barra = $("[data-tiempo]", app);
    if (seg) seg.textContent = Math.ceil(restante);
    if (barra) barra.style.width = `${(restante / estado.seg) * 100}%`;
  }

  // Pide el resultado al terminar y luego cada vez que llega un estado nuevo, hasta que el admin confirme
  let pedido = null, ultimoPedido = 0;
  async function terminada() {
    const toca = !resultado || (!resultado.confirmado && pedido !== estado.ahora);
    if (toca && Date.now() - ultimoPedido > 1500) {
      ultimoPedido = Date.now(); pedido = estado.ahora;
      try { resultado = await api.quizResultado(charlaId, yo.dni, yo.token); } catch { /* se reintenta */ }
    }
    if (!resultado) return pintarUna("fin-espera", () => marco(`<div class="quiz__espera"><div class="giro"></div></div><h1>¡Terminó la trivia!</h1><p>Calculando resultados…</p>`));
    const r = resultado;
    pintarUna(`fin${r.puesto}${r.confirmado}${r.pts}`, () => {
      const podio = r.confirmado && r.pts > 0;
      marco(`
        ${podio ? `<div class="quiz__medalla">${["🥇", "🥈", "🥉"][r.puesto - 1] || "🏆"}</div><h1>${r.puesto === 1 ? "¡Ganaste!" : `¡${r.puesto}.° lugar!`}</h1><p>Tu delegación <b>${esc(yo.delegacion?.siglas || yo.delegacion?.nombre || "")}</b> suma <b>+${r.pts} puntos</b> en la Copa CONCEPMI.</p>`
          : `<h1>¡Terminó la trivia!</h1><p>${r.confirmado ? `Ganó <b>${esc(r.ganador || "")}</b>. ¡Gracias por participar!` : "Mira la pantalla del auditorio para conocer el podio."}</p>`}
        <div class="quiz__ficha">
          <div><small>Aciertos</small><b>${r.aciertos} de ${r.preguntas}</b></div>
          <div><small>Tu puesto</small><b>${r.puesto} de ${r.jugadores}</b></div>
          <div><small>Tiempo total</small><b>${(r.tiempo_ms / 1000).toFixed(1)} s</b></div>
        </div>`);
      if (podio) lanzarConfeti();
    });
  }

  if (yo?.token) arrancar(); else registro();
}

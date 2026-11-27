// =========================================================
// Muro en vivo del Show (24/11) en el CELULAR del asistente (entra por el QR: ?show=muro).
// Escribe su DNI (de la lista de inscritos), ve su nombre y delegación, responde la pregunta y
// su comentario sale en la pantalla del auditorio. Máx. 140 caracteres, uno cada 20 s.
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202611271529";
import { $, esc, IMG, lanzarConfeti } from "./ui.js?v=202611271529";

const CLAVE = "concepmi-show-muro";
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)); } catch { return null; } };
const guardarYo = (v) => { try { v ? localStorage.setItem(CLAVE, JSON.stringify(v)) : localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ } };

export async function vistaMuro(app) {
  let yo = leer(), info = { abierto: false, pregunta: "" }, sondeo = null, espera = 0;
  const marco = (html) => {
    app.innerHTML = `<div class="fondo fondo--sobrio"></div><div class="quiz">
      <header class="quiz__cab"><img class="logo" src="${IMG.logo}" alt="CONCEPMI"><div><div class="quiz__pre">Show en vivo · VI CONCEPMI 2026</div><div class="quiz__tit">Muro de networking</div></div></header>
      <main class="quiz__caja">${html}</main>
      ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}</div>`;
  };
  async function cargarInfo() { try { info = await api.showMuroInfo(); } catch { /* reintenta */ } }

  function registro(error = "") {
    marco(`<h1>¡Súmate al muro!</h1><p>Escribe tu <b>DNI</b> (el de tu inscripción) y tu comentario saldrá en la pantalla del auditorio con tu nombre y delegación.</p>
      <form class="form" data-f autocomplete="off"><label class="campo"><span>DNI</span><input name="dni" inputmode="numeric" maxlength="12" required placeholder="Ej. 71234567"></label>
      <p class="error">${esc(error)}</p><button class="btn btn--naranja btn--grande">Entrar</button></form>`);
    const f = $("[data-f]", app);
    f.onsubmit = async (e) => { e.preventDefault(); const b = $("button", f); b.disabled = true;
      try { const a = await api.quizBuscar(f.dni.value); if (!a) throw new Error("No encontramos tu DNI en la lista de inscritos");
        yo = { dni: f.dni.value.replace(/\D/g, ""), nombre: a.nombre, delegacion: a.delegacion?.siglas || a.delegacion?.nombre || "" }; guardarYo(yo); escribir(); }
      catch (ex) { $(".error", f).textContent = ex.message; b.disabled = false; } };
  }

  function escribir(ok = "") {
    clearTimeout(sondeo);
    if (!info.abierto) {
      marco(`<p class="muro-yo"><b>${esc(yo.nombre)}</b>${yo.delegacion ? ` · ${esc(yo.delegacion)}` : ""}</p><div class="quiz__espera"><div class="giro"></div><h2>El muro aún está cerrado</h2><p>Se abre cuando el presentador lo indique. Deja esta página abierta.</p></div>
        <button class="btn btn--mini" data-otro>No soy yo</button>`);
      $("[data-otro]", app).onclick = () => { guardarYo(null); yo = null; registro(); };
      sondeo = setTimeout(async () => { await cargarInfo(); escribir(); }, 5000); return;
    }
    marco(`<p class="muro-yo"><b>${esc(yo.nombre)}</b>${yo.delegacion ? ` · <span class="chip chip--celeste">${esc(yo.delegacion)}</span>` : ""}</p>
      ${ok ? `<div class="muro-ok">✓ ${esc(ok)}</div>` : ""}
      <h2 class="muro-preg">${esc(info.pregunta || "¿De qué delegación eres y qué te llevas del VI CONCEPMI?")}</h2>
      <form class="form" data-f><label class="campo"><span>Tu comentario <small data-n>0/140</small></span><textarea name="t" rows="3" maxlength="140" required placeholder="Escribe aquí…"></textarea></label>
        <p class="error"></p><button class="btn btn--naranja btn--grande" data-enviar>Enviar a la pantalla</button></form>
      <button class="btn btn--mini" data-otro>No soy yo</button>`);
    const f = $("[data-f]", app), b = $("[data-enviar]", app);
    f.t.oninput = () => { $("[data-n]", app).textContent = `${f.t.value.length}/140`; };
    const bloquear = () => { const s = Math.ceil((espera - Date.now()) / 1000); if (s > 0) { b.disabled = true; b.textContent = `Puedes enviar otro en ${s} s`; setTimeout(bloquear, 1000); } else { b.disabled = false; b.textContent = "Enviar a la pantalla"; } };
    bloquear();
    f.onsubmit = async (e) => { e.preventDefault(); b.disabled = true;
      try { await api.showMuroEnviar(yo.dni, f.t.value); espera = Date.now() + 20000; lanzarConfeti(); escribir("¡Tu comentario ya está en la pantalla!"); }
      catch (ex) { $(".error", f).textContent = ex.message; b.disabled = false; if (/cerrado/i.test(ex.message)) { await cargarInfo(); escribir(); } } };
    $("[data-otro]", app).onclick = () => { guardarYo(null); yo = null; registro(); };
    sondeo = setTimeout(async function revisar() { await cargarInfo(); if (!info.abierto) return escribir(); const p = $(".muro-preg", app); if (p && info.pregunta) p.textContent = info.pregunta; sondeo = setTimeout(revisar, 8000); }, 8000);
  }

  marco(`<div class="cargando"><div class="giro"></div></div>`);
  await cargarInfo();
  if (yo?.dni) escribir(); else registro();
}

// =========================================================
// CONCURSO DE BARRAS (jueves 26/11, 2:30 – 3:30 p. m., auditorio). Pestaña propia del admin:
//   · Todas las delegaciones (pestaña Delegaciones) con su pista: el admin sube un MP3 por delegación.
//   · Sorteo rápido del orden de salida (pantalla completa) → «Confirmar orden».
//   · Proyectar: el fondo animado de BARRAS con las delegaciones en el orden del sorteo; → / ← pasa de
//     delegación y abajo sale el reproductor de su pista: ▶ Play · ⏸ Pausa · ⏹ Stop, con el tiempo de la
//     pista (cuenta regresiva) y una barra que avanza. Al terminar la última, «¡Gracias a todas las
//     delegaciones!».
// Las pistas y el orden se guardan SOLO en este navegador (IndexedDB / localStorage): no gastan el
// tráfico de Supabase (plan gratuito) y suenan aunque el auditorio no tenga internet. Por eso hay que
// subirlas en la MISMA laptop que va a proyectar.
// =========================================================
import { pantalla, tono, fanfarria } from "./show.js?v=202611252102";
import { $, $$, esc, I, IMG, aviso, confirmar, lanzarConfeti } from "./ui.js?v=202611252102";

const CLAVE_ORDEN = "concepmi-barras-orden-v1";
const DB = "concepmi-barras", TIENDA = "pistas";

// ---------- Almacenamiento local de las pistas (IndexedDB) ----------
function abrirDB() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore(TIENDA);
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error || new Error("No se pudo abrir el almacenamiento del navegador"));
  });
}
async function tx(modo, fn) {
  const db = await abrirDB();
  return new Promise((res, rej) => {
    const t = db.transaction(TIENDA, modo); fn(t.objectStore(TIENDA));
    const mal = () => { db.close(); rej(t.error || new Error("el navegador no dejó guardar (¿poco espacio?)")); };
    t.oncomplete = () => { db.close(); res(); }; t.onerror = mal; t.onabort = mal;
  });
}
export async function leerPistas() {
  try {
    const db = await abrirDB();
    return await new Promise((res) => {
      const out = {}, t = db.transaction(TIENDA, "readonly"), c = t.objectStore(TIENDA).openCursor();
      c.onsuccess = () => { const k = c.result; if (k) { out[k.key] = k.value; k.continue(); } };
      t.oncomplete = () => { db.close(); res(out); }; t.onerror = () => { db.close(); res({}); };
    });
  } catch { return {}; }
}
const guardarPista = (id, valor) => tx("readwrite", (s) => s.put(valor, id));
const quitarPista = (id) => tx("readwrite", (s) => s.delete(id));
const duracionDe = (blob) => new Promise((res) => {
  const a = new Audio(), u = URL.createObjectURL(blob);
  a.preload = "metadata"; a.onloadedmetadata = () => { const d = a.duration; URL.revokeObjectURL(u); res(Number.isFinite(d) ? d : 0); };
  a.onerror = () => { URL.revokeObjectURL(u); res(0); }; a.src = u;
});
export const mmss = (s) => { s = Math.max(0, Math.round(s || 0)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`; };

// ---------- Orden de salida ----------
export function leerOrden() { try { return JSON.parse(localStorage.getItem(CLAVE_ORDEN) || "null"); } catch { return null; } }
function guardarOrden(ids) { try { localStorage.setItem(CLAVE_ORDEN, JSON.stringify({ ids, fecha: new Date().toISOString() })); } catch { /* sin almacenamiento */ } }
function borrarOrden() { try { localStorage.removeItem(CLAVE_ORDEN); } catch { /* nada */ } }
const nombre = (d) => d.siglas || d.nombre;
// Delegaciones en el orden confirmado (las nuevas que no estaban en el sorteo van al final)
export function ordenar(delegaciones) {
  const dels = (delegaciones || []).filter((d) => d.nombre).sort((a, b) => nombre(a).localeCompare(nombre(b)));
  const o = leerOrden(); if (!o?.ids?.length) return { dels, sorteado: false };
  const pos = new Map(o.ids.map((id, k) => [id, k]));
  return { dels: dels.slice().sort((a, b) => (pos.get(a.id) ?? 999) - (pos.get(b.id) ?? 999)), sorteado: true, fecha: o.fecha };
}
const barajar = (xs) => { const a = xs.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fondoBarras = () => `<div class="cd-barras__fondo" aria-hidden="true">${Array.from({ length: 14 }, (_, k) => `<i style="--k:${k};--h:${35 + ((k * 37) % 55)}%"></i>`).join("")}</div>`;
const cab = (kicker, titulo) => `<header class="cd-cab"><img src="${IMG.logo}" alt="CONCEPMI"><div><small>${kicker}</small><b>${titulo}</b></div></header>`;

// =================== SORTEO RÁPIDO DEL ORDEN ===================
export function abrirSorteoBarras(delegaciones, { alConfirmar } = {}) {
  const dels = (delegaciones || []).filter((d) => d.nombre);
  if (dels.length < 2) return aviso("Necesitas al menos 2 delegaciones", "error");
  let orden = [], girando = false;
  const p = pantalla("cd-barras cb-sorteo", `${fondoBarras()}${cab("Concurso de Barras · Jueves 26", "Sorteo del orden de salida")}
    <main class="cb-sorteo__centro">
      <div class="cb-sorteo__rodillo"><small data-turno>¿Quién sale primero?</small><b data-nom>🎲</b></div>
      <ol class="cb-sorteo__lista" data-lista></ol>
      <div class="cb-sorteo__acc" data-acc hidden><button class="btn" data-otra>↺ Volver a sortear</button><button class="btn btn--naranja" data-ok>✓ Confirmar este orden</button></div>
    </main>
    <p class="sh-ayuda">Espacio: sortear · Enter: confirmar · Esc: salir</p>`, { teclas: (e) => {
      if (e.key === " " && !girando) { e.preventDefault(); sortear(); }
      if (e.key === "Enter" && orden.length === dels.length && !girando) confirmarOrden();
    } });
  const lista = $("[data-lista]", p.el), nom = $("[data-nom]", p.el), turno = $("[data-turno]", p.el);
  function sortear() {
    if (girando) return; girando = true; orden = barajar(dels); lista.innerHTML = ""; $("[data-acc]", p.el).hidden = true;
    let k = 0;
    const revelar = () => {
      if (!document.body.contains(p.el)) return;
      if (k >= orden.length) { girando = false; nom.textContent = "¡Listo!"; turno.textContent = "Este es el orden de salida"; $("[data-acc]", p.el).hidden = false; fanfarria(); lanzarConfeti(); return; }
      turno.textContent = `Turno ${k + 1} de ${orden.length}`;
      let n = 0; const vueltas = 7;
      const rodar = () => {
        const d = n < vueltas ? dels[Math.floor(Math.random() * dels.length)] : orden[k];
        nom.textContent = nombre(d); tono(700 + n * 40, 0.03); n++;
        if (n <= vueltas) return setTimeout(rodar, 45 + n * 8);
        const li = document.createElement("li"); li.innerHTML = `<span>${k + 1}</span><b>${esc(nombre(orden[k]))}</b>${orden[k].siglas ? `<small>${esc(orden[k].nombre)}</small>` : ""}`;
        lista.append(li); tono(1040, 0.12, "sine", 0.07); k++; setTimeout(revelar, 260);
      };
      rodar();
    };
    revelar();
  }
  function confirmarOrden() { guardarOrden(orden.map((d) => d.id)); aviso("Orden confirmado"); alConfirmar?.(); p.cerrar(); }
  $("[data-otra]", p.el).onclick = sortear; $("[data-ok]", p.el).onclick = confirmarOrden;
  sortear();
  return p;
}

// =================== PROYECCIÓN CON MÚSICA ===================
export async function abrirConcursoBarras(delegaciones) {
  const { dels } = ordenar(delegaciones);
  if (!dels.length) return aviso("Aún no hay delegaciones registradas", "error");
  const pistas = await leerPistas();
  let i = -1, audio = null, url = null, raf = null;
  const p = pantalla("cd-barras cb-show", `${fondoBarras()}${cab("VI CONCEPMI 2026 · Jueves 26 de noviembre", "¡Que suene tu delegación!")}
    <main class="cd-barras__centro">
      <small class="cd-barras__kicker">Concurso de</small>
      <h1 class="cd-barras__titulo">BARRAS</h1>
      <p class="cd-barras__ahora" data-ahora>Pon tu mejor porra · ¡que se escuche en todo San Marcos!</p>
      <div class="cd-barras__dels">${dels.map((d, k) => `<span class="cd-del" data-k="${k}" style="--i:${k}"><em class="cb-num">${k + 1}</em><b>${esc(nombre(d))}</b>${d.siglas ? `<small>${esc(d.nombre)}</small>` : ""}</span>`).join("")}</div>
      <section class="cb-player" data-player hidden>
        <div class="cb-player__info"><small data-turno></small><b data-del></b><span data-pista></span></div>
        <div class="cb-player__tiempo"><b data-resta>0:00</b><div class="cb-player__barra"><i data-avance></i></div></div>
        <div class="cb-player__btns"><button class="btn btn--naranja" data-play>▶ Play</button><button class="btn" data-pausa>⏸ Pausa</button><button class="btn btn--peligro" data-stop>⏹ Stop</button></div>
      </section>
    </main>
    <p class="sh-ayuda">→ / ←: siguiente / anterior delegación · Espacio: play / pausa · S: stop · Esc: salir</p>`, {
    alCerrar: () => soltar(),
    teclas: (e) => {
      if (e.key === "ArrowRight" || e.key === "PageDown") { e.preventDefault(); marcar(i + 1); }
      else if (e.key === "ArrowLeft" || e.key === "PageUp") { e.preventDefault(); marcar(i - 1); }
      else if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (i < 0) marcar(0); else alternar(); }
      else if (e.key === "s" || e.key === "S") parar();
    } });
  const el = (s) => $(s, p.el);
  function soltar() { cancelAnimationFrame(raf); if (audio) { audio.pause(); audio.src = ""; } if (url) URL.revokeObjectURL(url); audio = null; url = null; p.el.classList.remove("cb-show--sonando"); }
  function pintarTiempo() {
    const dur = audio?.duration || pistas[dels[i]?.id]?.duracion || 0, t = audio?.currentTime || 0;
    el("[data-resta]").textContent = mmss(dur - t);
    el("[data-avance]").style.width = `${dur ? Math.min(100, (t / dur) * 100) : 0}%`;
    if (audio && !audio.paused) raf = requestAnimationFrame(pintarTiempo);
  }
  function marcar(k) {
    soltar();
    if (k >= dels.length) { // fin del concurso
      i = dels.length; p.el.querySelectorAll(".cd-del").forEach((x) => x.classList.remove("cd-del--ahora"));
      el("[data-player]").hidden = true; el("[data-ahora]").innerHTML = "🎉 <b>¡Gracias a todas las delegaciones!</b> Los jurados ya califican.";
      fanfarria(); lanzarConfeti(); return;
    }
    i = Math.max(-1, k);
    p.el.querySelectorAll(".cd-del").forEach((x) => x.classList.toggle("cd-del--ahora", Number(x.dataset.k) === i));
    const d = dels[i];
    if (!d) { el("[data-player]").hidden = true; el("[data-ahora]").textContent = "Pon tu mejor porra · ¡que se escuche en todo San Marcos!"; return; }
    el("[data-ahora]").innerHTML = `🎺 Ahora se presenta: <b>${esc(nombre(d))}</b>${d.siglas ? ` · ${esc(d.nombre)}` : ""}`;
    const pista = pistas[d.id];
    el("[data-player]").hidden = false;
    el("[data-turno]").textContent = `Turno ${i + 1} de ${dels.length}`;
    el("[data-del]").textContent = nombre(d);
    el("[data-pista]").textContent = pista ? `🎵 ${pista.nombre}` : "Sin pista cargada · ¡a capela!";
    ["[data-play]", "[data-pausa]", "[data-stop]"].forEach((s) => (el(s).disabled = !pista));
    if (pista) { url = URL.createObjectURL(pista.blob); audio = new Audio(url); audio.preload = "auto";
      audio.onended = () => { p.el.classList.remove("cb-show--sonando"); pintarTiempo(); el("[data-resta]").textContent = "¡Tiempo!"; tono(440, 0.5, "sawtooth", 0.06); };
      audio.onloadedmetadata = pintarTiempo; }
    pintarTiempo(); tono(880, 0.12, "sine", 0.06);
  }
  function alternar() {
    if (!audio) return;
    if (audio.paused) { audio.play().then(() => { p.el.classList.add("cb-show--sonando"); pintarTiempo(); }).catch(() => aviso("No se pudo reproducir la pista", "error")); }
    else { audio.pause(); p.el.classList.remove("cb-show--sonando"); cancelAnimationFrame(raf); }
  }
  function parar() { if (!audio) return; audio.pause(); audio.currentTime = 0; p.el.classList.remove("cb-show--sonando"); cancelAnimationFrame(raf); pintarTiempo(); }
  el("[data-play]").onclick = () => { if (audio?.paused) alternar(); };
  el("[data-pausa]").onclick = () => { if (audio && !audio.paused) alternar(); };
  el("[data-stop]").onclick = parar;
  p.el.addEventListener("click", (e) => { const x = e.target.closest(".cd-del"); if (x) marcar(Number(x.dataset.k)); });
  return p;
}

// =================== PESTAÑA DEL ADMIN ===================
export function crearBarras(ctx) {
  async function vista(v) {
    const data = ctx.data();
    if (!data) { v.innerHTML = `<div class="cargando"><div class="giro"></div>Cargando…</div>`; setTimeout(() => document.body.contains(v) && vista(v), 600); return; }
    const { dels, sorteado, fecha } = ordenar(data.delegaciones);
    const pistas = await leerPistas();
    const conPista = dels.filter((d) => pistas[d.id]).length;
    const total = dels.reduce((s, d) => s + (pistas[d.id]?.duracion || 0), 0);
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>🎺 Concurso de Barras</h1><p><b>Jueves 26 de noviembre · 2:30 – 3:30 p. m.</b> · Auditorio principal. Sube la pista de cada delegación, sortea el orden y proyecta: cada delegación sale con su música y su tiempo.</p></div></div>
      <div class="cb-pasos">
        <article class="tarjeta cb-paso"><span class="cb-paso__n">1</span><div><b>Sube las pistas</b><small>${conPista} de ${dels.length} delegaciones con MP3 · ${mmss(total)} en total</small></div></article>
        <article class="tarjeta cb-paso"><span class="cb-paso__n">2</span><div><b>Sortea el orden</b><small>${sorteado ? `✓ Orden confirmado el ${new Date(fecha).toLocaleString("es-PE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}` : "Aún sin sortear (orden alfabético)"}</small></div><button class="btn ${sorteado ? "btn--mini" : "btn--naranja"}" data-sortear>🎲 ${sorteado ? "Volver a sortear" : "Sortear orden"}</button></article>
        <article class="tarjeta cb-paso"><span class="cb-paso__n">3</span><div><b>Proyecta</b><small>→ siguiente delegación · Espacio play / pausa · S stop</small></div><button class="btn btn--naranja" data-cb-proy>${I.vivo}Proyectar concurso</button></article>
      </div>
      <p class="aviso-info cb-local">💾 <b>Las pistas se guardan solo en esta laptop</b> (no se suben a internet, así no gastan datos y suenan aunque el auditorio no tenga señal). <b>Súbelas en la misma laptop que va a proyectar.</b></p>
      <section class="tarjeta"><div class="tabla-wrap"><table class="tabla cb-tabla"><thead><tr><th>Turno</th><th>Delegación</th><th>Pista (MP3)</th><th>Duración</th><th></th></tr></thead><tbody>
        ${dels.map((d, k) => { const p = pistas[d.id]; return `<tr>
          <td><span class="cb-turno">${sorteado ? k + 1 : "–"}</span></td>
          <td><b>${esc(nombre(d))}</b>${d.siglas ? `<br><small>${esc(d.nombre)}</small>` : ""}</td>
          <td>${p ? `<span class="chip chip--verde">🎵 ${esc(p.nombre)}</span>` : `<span class="chip chip--ambar">Sin pista</span>`}</td>
          <td><b>${p ? mmss(p.duracion) : "—"}</b></td>
          <td class="cb-acc"><label class="btn btn--mini">${I.subir || "⬆"}${p ? "Cambiar" : "Subir MP3"}<input type="file" accept="audio/*,.mp3,.m4a,.wav,.ogg" data-subir="${d.id}" hidden></label>
            ${p ? `<button class="btn btn--mini" data-oir="${d.id}">▶ Escuchar</button><button class="btn btn--mini btn--peligro" data-quitar="${d.id}">${I.basura}</button>` : ""}</td></tr>`; }).join("")}
      </tbody></table></div>
      ${dels.length ? "" : `<p class="ayuda">Aún no hay delegaciones: créalas en la pestaña Delegaciones.</p>`}
      ${sorteado ? `<p class="ayuda" style="margin-top:10px"><button class="btn btn--mini" data-reset-orden>Quitar el sorteo (volver al orden alfabético)</button></p>` : ""}</section>`;
    let prueba = null;
    $("[data-sortear]", v).onclick = () => abrirSorteoBarras(dels, { alConfirmar: () => vista(v) });
    $("[data-cb-proy]", v).onclick = () => { prueba?.pause(); abrirConcursoBarras(data.delegaciones); };
    $("[data-reset-orden]", v)?.addEventListener("click", async () => { if (!(await confirmar("¿Quitar el sorteo?", "Se vuelve al orden alfabético. Puedes sortear de nuevo cuando quieras.", { boton: "Quitar" }))) return; borrarOrden(); vista(v); });
    $$("[data-subir]", v).forEach((inp) => (inp.onchange = async () => {
      const f = inp.files?.[0]; if (!f) return;
      if (!/^audio\//.test(f.type) && !/\.(mp3|m4a|wav|ogg|aac)$/i.test(f.name)) return aviso("Debe ser un archivo de audio (MP3)", "error");
      if (f.size > 40 * 1024 * 1024) return aviso("La pista pesa más de 40 MB", "error");
      try { const dur = await duracionDe(f); await guardarPista(inp.dataset.subir, { blob: f, nombre: f.name, duracion: dur, subido: new Date().toISOString() });
        aviso(`Pista guardada · ${mmss(dur)}`); vista(v); } catch (e) { aviso(`No se pudo guardar: ${e.message}`, "error"); }
    }));
    $$("[data-oir]", v).forEach((b) => (b.onclick = () => {
      if (prueba && !prueba.paused) { prueba.pause(); b.textContent = "▶ Escuchar"; return; }
      const pz = pistas[b.dataset.oir]; if (!pz) return; prueba?.pause(); prueba = new Audio(URL.createObjectURL(pz.blob)); prueba.play(); b.textContent = "⏸ Parar";
      prueba.onended = () => (b.textContent = "▶ Escuchar");
    }));
    $$("[data-quitar]", v).forEach((b) => (b.onclick = async () => { if (!(await confirmar("¿Quitar esta pista?", "Se borra solo de esta laptop.", { boton: "Quitar", peligro: true }))) return; await quitarPista(b.dataset.quitar); vista(v); }));
  }
  return { vista };
}

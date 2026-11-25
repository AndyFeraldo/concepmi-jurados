// =========================================================
// SHOW EN VIVO · 1A «¿Esto o aquello?» con APLAUSÓMETRO (reemplaza al Muro en vivo: el auditorio no
// tiene internet para 200 celulares). Todo pasa en la laptop del proyector, sin internet:
//   · En pantalla, dos opciones (A a la izquierda, B a la derecha), p. ej. «Ágil 🏃 vs Cascada 🌊».
//   · A / ←: «¡Aplaudan los de A!» → el micrófono de la laptop mide 5 s y llena la barra. B / → igual.
//   · Espacio: revela al bando ganador (confeti) y sale «🎤 Pasa el micro: que alguien de cada bando
//     defienda su elección». Espacio otra vez: siguiente duelo. N / P: duelo siguiente / anterior.
//   · Sin micrófono (o si el navegador lo bloquea): el presentador decide por oído con A / B y Espacio.
// La lista de duelos se edita en la pestaña y se guarda en ESE navegador (localStorage), porque se
// usa en la misma laptop del proyector; si no hay lista guardada, se usan los sugeridos.
// =========================================================
import { $, esc, IMG, aviso, lanzarConfeti } from "./ui.js?v=202611252237";
import { pantalla, tono, fanfarria } from "./show.js?v=202611252237";

const CLAVE = "concepmi-duelos-v1";
export const DUELOS = [
  "Metodología ágil 🏃 | Cascada 🌊",
  "Planificar todo 🗓️ | Improvisar 🎲",
  "Entregar a tiempo ⏰ | Entregar perfecto ✨",
  "Una reunión de 1 hora 💬 | Un correo 📧",
  "Trabajo en equipo 👥 | Lo hago yo solo 🦸",
  "Líder que escucha 👂 | Líder que decide rápido ⚡",
  "Excel 📊 | Notion 📝",
  "Estudiar con música 🎧 | Silencio total 🤫",
  "Amanecida 🌙 | Madrugada 🌅",
  "Pollo a la brasa 🍗 | Chifa 🥡",
  "La IA hace el trabajo 🤖 | Lo hago a mano ✍️",
  "Playa 🏖️ | Sierra 🏔️",
];
export function leerDuelos() {
  try { const x = JSON.parse(localStorage.getItem(CLAVE) || "null"); if (Array.isArray(x) && x.length) return x; } catch { /* sin almacenamiento */ }
  return DUELOS.slice();
}
export function guardarDuelos(lineas) {
  const ok = lineas.map((l) => l.trim()).filter((l) => l.includes("|"));
  try { if (ok.length) localStorage.setItem(CLAVE, JSON.stringify(ok)); else localStorage.removeItem(CLAVE); } catch { /* sin almacenamiento */ }
  return ok;
}
const partir = (l) => { const [a, b] = l.split("|").map((x) => x.trim()); return { a: a || "Opción A", b: b || "Opción B" }; };

// ---------- Micrófono ----------
// Nivel 0–100 a partir del volumen (RMS en dB). Sin cancelación de eco ni control de ganancia,
// para que un auditorio que aplaude más fuerte de verdad marque más.
async function abrirMicro() {
  const flujo = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
  const ctx = new (window.AudioContext || window.webkitAudioContext)(); const an = ctx.createAnalyser(); an.fftSize = 2048;
  ctx.createMediaStreamSource(flujo).connect(an);
  const buf = new Float32Array(an.fftSize);
  const nivel = () => { an.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; const db = 20 * Math.log10(Math.sqrt(s / buf.length) || 1e-8); return Math.max(0, Math.min(100, ((db + 55) / 50) * 100)); };
  return { nivel, cerrar: () => { flujo.getTracks().forEach((t) => t.stop()); ctx.close().catch(() => {}); } };
}

export function abrirDuelo(lista = leerDuelos()) {
  const duelos = (lista.length ? lista : DUELOS).map(partir);
  let i = 0, micro = null, midiendo = false, fase = "listo"; // listo · revelado
  let pts = { a: null, b: null }, raf = null;
  const p = pantalla("sh-duelo", `<header class="sh-cab"><img src="${IMG.logo}" alt="CONCEPMI"><div><small>Show en vivo · VI CONCEPMI 2026</small><b>¿Esto o aquello?</b><span>Aplausómetro: ¡que se escuche tu bando!</span></div><span class="sh-duelo__n" data-n></span></header>
    <main class="sh-duelo__cuerpo">
      <section class="sh-bando sh-bando--a" data-bando="a"><span class="sh-bando__tecla">A</span><b data-txt="a"></b><div class="sh-medidor"><i data-barra="a"></i></div><span class="sh-bando__pts" data-pts="a">—</span></section>
      <div class="sh-vs">VS</div>
      <section class="sh-bando sh-bando--b" data-bando="b"><span class="sh-bando__tecla">B</span><b data-txt="b"></b><div class="sh-medidor"><i data-barra="b"></i></div><span class="sh-bando__pts" data-pts="b">—</span></section>
    </main>
    <div class="sh-duelo__msg" data-msg></div>
    <p class="sh-ayuda" data-ayuda></p>`, {
    alCerrar: () => { cancelAnimationFrame(raf); micro?.cerrar(); },
    teclas: (e) => {
      const k = e.key.toLowerCase();
      if (k === "a" || e.key === "ArrowLeft") medir("a");
      else if (k === "b" || e.key === "ArrowRight") medir("b");
      else if (e.key === " " || e.key === "Enter" || e.key === "PageDown") { e.preventDefault(); espacio(); }
      else if (k === "n") ir(i + 1);
      else if (k === "p" || e.key === "PageUp") ir(i - 1);
      else if (k === "r") ir(i);
    } });
  const msg = (html) => { $("[data-msg]", p.el).innerHTML = html; };
  const ayuda = () => { $("[data-ayuda]", p.el).textContent = micro
    ? "A / ←: miden los de la izquierda · B / →: los de la derecha · Espacio: ¡ganador! · N / P: otro duelo · Esc: salir"
    : "Sin micrófono: A / B elige el bando que sonó más · Espacio: siguiente · N / P: otro duelo · Esc: salir"; };

  // Intenta encender el micrófono al abrir; si no se puede, modo manual
  (async () => {
    try { micro = await abrirMicro(); } catch { micro = null; p.el.classList.add("sh-duelo--manual"); aviso("No se pudo usar el micrófono: decide por oído con A / B", "error"); }
    ayuda();
  })();

  function ir(k) {
    if (midiendo) return;
    i = (k + duelos.length) % duelos.length; fase = "listo"; pts = { a: null, b: null };
    const d = duelos[i];
    $("[data-txt=a]", p.el).textContent = d.a; $("[data-txt=b]", p.el).textContent = d.b;
    $("[data-n]", p.el).textContent = `Duelo ${i + 1} de ${duelos.length}`;
    ["a", "b"].forEach((x) => { $(`[data-barra=${x}]`, p.el).style.height = "100%"; $(`[data-pts=${x}]`, p.el).textContent = "—"; });
    p.el.querySelectorAll(".sh-bando").forEach((b) => b.classList.remove("sh-bando--gana", "sh-bando--pierde", "sh-bando--vivo"));
    msg(`¿Tú cuál eliges? <b>Aplaude por tu bando</b> 👏`); ayuda();
  }

  function medir(lado) {
    if (midiendo || fase === "revelado") return;
    if (!micro) { // modo manual: el presentador elige el ganador
      pts = lado === "a" ? { a: 1, b: 0 } : { a: 0, b: 1 }; revelar(); return;
    }
    midiendo = true; const bando = $(`[data-bando=${lado}]`, p.el), barra = $(`[data-barra=${lado}]`, p.el), num = $(`[data-pts=${lado}]`, p.el);
    bando.classList.add("sh-bando--vivo");
    let cuenta = 3;
    msg(`¡Prepárense los de <b>${esc(duelos[i][lado])}</b>! <span class="sh-duelo__cuenta">${cuenta}</span>`); tono(660, 0.12, "sine", 0.06);
    const t = setInterval(() => {
      cuenta--;
      if (cuenta > 0) { msg(`¡Prepárense los de <b>${esc(duelos[i][lado])}</b>! <span class="sh-duelo__cuenta">${cuenta}</span>`); tono(660, 0.12, "sine", 0.06); return; }
      clearInterval(t); tono(990, 0.25, "sine", 0.08); msg(`👏👏 <b>¡AHORA! ¡Aplaudan, griten!</b> 👏👏`);
      const inicio = performance.now(), DUR = 5000; let suma = 0, n = 0, maxv = 0;
      const paso = (ahora) => {
        const v = micro.nivel(); suma += v; n++; maxv = Math.max(maxv, v);
        barra.style.height = `${100 - v}%`;
        if (ahora - inicio < DUR && document.body.contains(p.el)) { raf = requestAnimationFrame(paso); return; }
        // Puntaje: 70 % el promedio (que aplaudan todo el rato) + 30 % el pico
        const final = Math.round(0.7 * (suma / Math.max(1, n)) + 0.3 * maxv);
        pts[lado] = final; barra.style.height = `${100 - final}%`; num.textContent = final;
        bando.classList.remove("sh-bando--vivo"); midiendo = false; tono(520, 0.2, "triangle", 0.07);
        msg(pts.a !== null && pts.b !== null ? `Espacio: <b>¡y el ganador es…!</b>` : `Ahora los de <b>${esc(duelos[i][lado === "a" ? "b" : "a"])}</b>: tecla ${lado === "a" ? "B" : "A"}`);
      };
      raf = requestAnimationFrame(paso);
    }, 800);
  }

  function revelar() {
    fase = "revelado";
    const gana = pts.a === pts.b ? null : pts.a > pts.b ? "a" : "b";
    p.el.querySelectorAll(".sh-bando").forEach((b) => b.classList.toggle("sh-bando--gana", b.dataset.bando === gana));
    p.el.querySelectorAll(".sh-bando").forEach((b) => b.classList.toggle("sh-bando--pierde", !!gana && b.dataset.bando !== gana));
    if (gana) { fanfarria(); lanzarConfeti(); msg(`🏆 ¡Gana <b>${esc(duelos[i][gana])}</b>! · 🎤 Pasa el micro: ¿por qué?`); }
    else msg(`🤝 ¡Empate! · 🎤 Pasa el micro a cada bando para desempatar`);
  }

  function espacio() {
    if (midiendo) return;
    if (fase === "revelado") return ir(i + 1);
    if (pts.a !== null && pts.b !== null) return revelar();
    if (!micro) return ir(i + 1);
    medir(pts.a === null ? "a" : "b");
  }

  ir(0);
  return p;
}

// =========================================================
// HYPE · motor de música y efectos para las ceremonias (todo sintetizado con Web Audio: sin archivos,
// sin derechos de autor, funciona sin internet).
//   hype.musica("fiesta" | "suspenso" | "gala" | null)  → base musical en bucle (cambia con fundido)
//   hype.redoble(seg)   → redoble de tambores que acelera y sube + «riser» (subida de tensión)
//   hype.platillo() · hype.impacto() · hype.fanfarria(n) · hype.whoosh() · hype.campana()
//   hype.silencio() alterna mudo (tecla M en las pantallas)
// =========================================================
let ac = null, master = null, bus = null, sfx = null, mudo = false;
function ctx() {
  try {
    if (!ac) {
      ac = new (window.AudioContext || window.webkitAudioContext)();
      const comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 4;
      master = ac.createGain(); master.gain.value = 0.9; master.connect(comp).connect(ac.destination);
      bus = ac.createGain(); bus.gain.value = 0; bus.connect(master);
      sfx = ac.createGain(); sfx.gain.value = 1; sfx.connect(master);
    }
    if (ac.state === "suspended") ac.resume();
  } catch { ac = null; }
  return ac;
}
// Desbloquea el audio con la primera tecla o clic (los navegadores lo exigen)
["keydown", "pointerdown"].forEach((ev) => window.addEventListener(ev, () => ctx(), { capture: true }));

// ---------- Instrumentos ----------
const ruidoBuf = () => { const a = ctx(), n = a.sampleRate, b = a.createBuffer(1, n, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1; return b; };
let RB = null;
function ruido(t, dur, { vol = 0.3, tipo = "bandpass", f = 1800, q = 0.8, destino = sfx, f2 = null } = {}) {
  const a = ctx(); if (!a) return; RB ||= ruidoBuf();
  const s = a.createBufferSource(), fl = a.createBiquadFilter(), g = a.createGain();
  s.buffer = RB; fl.type = tipo; fl.frequency.setValueAtTime(f, t); fl.Q.value = q; if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  s.connect(fl).connect(g).connect(destino); s.start(t, Math.random() * 0.5); s.stop(t + dur + 0.02);
}
function osc(t, f, dur, { tipo = "sine", vol = 0.3, ataque = 0.005, f2 = null, destino = sfx, filtro = null } = {}) {
  const a = ctx(); if (!a) return;
  const o = a.createOscillator(), g = a.createGain(); o.type = tipo; o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + dur);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + ataque); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let nodo = o; if (filtro) { const fl = a.createBiquadFilter(); fl.type = "lowpass"; fl.frequency.value = filtro; o.connect(fl); nodo = fl; }
  nodo.connect(g).connect(destino); o.start(t); o.stop(t + dur + 0.05);
}
const bombo = (t, vol = 0.9, d = bus) => osc(t, 140, 0.32, { f2: 42, vol, destino: d });
const caja = (t, vol = 0.35, d = bus) => { ruido(t, 0.16, { vol, f: 1900, destino: d }); osc(t, 200, 0.1, { tipo: "triangle", vol: vol * 0.5, destino: d }); };
const hat = (t, vol = 0.12, d = bus) => ruido(t, 0.045, { vol, tipo: "highpass", f: 8000, destino: d });

// ---------- Bucles musicales ----------
const NOTA = (n) => 440 * Math.pow(2, (n - 69) / 12);
const ACORDES = [[57, 60, 64], [53, 57, 60], [48, 52, 55], [55, 59, 62]]; // Am · F · C · G
const BAJO = [45, 41, 48, 43];
let modo = null, paso = 0, proximo = 0, reloj = null;
const SEMI = 60 / 124 / 4; // semicorchea a 124 bpm
function programar() {
  const a = ctx(); if (!a || !modo) return;
  while (proximo < a.currentTime + 0.12) {
    const t = proximo, s = paso % 16, compas = Math.floor(paso / 16) % 4;
    if (modo === "fiesta" || modo === "gala") {
      if (s % 4 === 0) bombo(t, modo === "gala" ? 0.7 : 0.9);
      if (s === 4 || s === 12) caja(t, 0.3);
      if (s % 4 === 2) hat(t, 0.11); if (modo === "fiesta" && s % 2 === 1) hat(t, 0.04);
      if (s % 2 === 0) osc(t, NOTA(BAJO[compas] + (s % 8 === 6 ? 12 : 0)), SEMI * 1.8, { tipo: "sawtooth", vol: 0.16, filtro: 520, destino: bus });
      if (s === 0) ACORDES[compas].forEach((n) => osc(t, NOTA(n), SEMI * 15, { tipo: "triangle", vol: 0.05, ataque: 0.25, destino: bus }));
      if (modo === "fiesta" && s % 4 === 3) osc(t, NOTA(ACORDES[compas][(s >> 2) % 3] + 12), SEMI * 1.2, { tipo: "square", vol: 0.025, filtro: 2400, destino: bus });
    } else if (modo === "suspenso") {
      if (s === 0 || s === 3) bombo(t, s === 0 ? 0.55 : 0.35); // latido
      if (s === 0) { osc(t, 55, SEMI * 16, { tipo: "sawtooth", vol: 0.08, ataque: 0.4, filtro: 220, destino: bus }); osc(t, 55 * 1.06, SEMI * 16, { tipo: "sawtooth", vol: 0.05, ataque: 0.4, filtro: 260, destino: bus }); }
      if (s % 2 === 0) osc(t, NOTA(compas % 2 ? 76 : 77), SEMI * 1.6, { tipo: "sine", vol: 0.018, destino: bus });
    }
    proximo += SEMI; paso++;
  }
}
function musica(nuevo, vol = null) {
  const a = ctx(); if (!a) return;
  const objetivo = mudo || !nuevo ? 0 : (vol ?? { fiesta: 0.55, gala: 0.5, suspenso: 0.75 }[nuevo] ?? 0.5);
  if (nuevo === modo) { bus.gain.setTargetAtTime(objetivo, a.currentTime, 0.3); return; }
  bus.gain.setTargetAtTime(0, a.currentTime, 0.12);
  setTimeout(() => {
    modo = nuevo; paso = 0; proximo = ctx().currentTime + 0.05;
    clearInterval(reloj); reloj = nuevo ? setInterval(programar, 25) : null;
    if (nuevo) bus.gain.setTargetAtTime(objetivo, ctx().currentTime, 0.35);
  }, 260);
}

// ---------- Efectos ----------
function redoble(seg = 5) {
  const a = ctx(); if (!a || mudo) return;
  const t0 = a.currentTime + 0.02; let t = t0, k = 0;
  while (t < t0 + seg) { const p = (t - t0) / seg; ruido(t, 0.07, { vol: 0.06 + p * 0.32, f: 1500 + p * 900, destino: sfx }); if (k % 3 === 0) osc(t, 95 + p * 30, 0.12, { tipo: "triangle", vol: 0.05 + p * 0.18 }); t += 0.075 - p * 0.045; k++; }
  ruido(t0, seg, { vol: 0.14, f: 300, f2: 7000, q: 2.5 }); // riser
  osc(t0, 110, seg, { tipo: "sawtooth", vol: 0.05, f2: 440, filtro: 1400, ataque: seg * 0.8 });
}
function platillo() { const a = ctx(); if (!a || mudo) return; const t = a.currentTime; ruido(t, 2.4, { vol: 0.5, tipo: "highpass", f: 5200 }); ruido(t, 0.5, { vol: 0.35, f: 1100 }); }
function impacto() { const a = ctx(); if (!a || mudo) return; const t = a.currentTime; osc(t, 90, 1.4, { f2: 28, vol: 1 }); ruido(t, 0.35, { vol: 0.4, tipo: "lowpass", f: 400 }); }
function fanfarria(n = 1) {
  const a = ctx(); if (!a || mudo) return; const t = a.currentTime + 0.05;
  const base = n === 1 ? [60, 64, 67, 72] : n === 2 ? [58, 62, 65, 70] : [55, 59, 62, 67];
  base.forEach((m, k) => [0, 0.004].forEach((d) => osc(t + k * 0.13, NOTA(m) * (1 + d), 0.32, { tipo: "sawtooth", vol: 0.07, filtro: 2600 })));
  [base[0] - 12, ...base].forEach((m) => [0, 0.005].forEach((d) => osc(t + 0.6, NOTA(m) * (1 + d), 1.8, { tipo: "sawtooth", vol: 0.06, ataque: 0.05, filtro: 3000 })));
}
function whoosh() { const a = ctx(); if (!a || mudo) return; ruido(a.currentTime, 0.7, { vol: 0.22, f: 400, f2: 5000, q: 1.5 }); }
function campana() { const a = ctx(); if (!a || mudo) return; const t = a.currentTime; [1, 2.76, 5.4].forEach((r, k) => osc(t, 660 * r, 1.6 - k * 0.4, { vol: 0.12 / (k + 1) })); }
function silencio() { mudo = !mudo; const a = ctx(); if (a) { bus.gain.setTargetAtTime(mudo ? 0 : 0.5, a.currentTime, 0.1); sfx.gain.setTargetAtTime(mudo ? 0 : 1, a.currentTime, 0.1); } return mudo; }
const parar = () => musica(null);

export const hype = { musica, redoble, platillo, impacto, fanfarria, whoosh, campana, silencio, parar, get mudo() { return mudo; } };

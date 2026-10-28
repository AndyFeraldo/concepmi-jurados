// Utilidades de interfaz
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
export const fmt = (n, dec = 1) => (n == null || isNaN(n) ? "—" : Number(n).toLocaleString("es-PE", { maximumFractionDigits: dec }));
export const iniciales = (n) => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
export const avatar = (nombre, foto, cls = "") => foto
  ? `<img class="avatar ${cls}" src="${esc(foto)}" alt="">`
  : `<span class="avatar ${cls}" aria-hidden="true">${esc(iniciales(nombre))}</span>`;
export function hace(fecha) {
  const s = Math.max(0, (Date.now() - new Date(fecha).getTime()) / 1000);
  if (s < 50) return "hace un momento";
  if (s < 3600) return `hace ${Math.round(s / 60)} min`;
  if (s < 86400) return `hace ${Math.round(s / 3600)} h`;
  return new Date(fecha).toLocaleDateString("es-PE", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
export const mmss = (seg) => { const s = Number(seg); if (isNaN(s)) return "—"; const m = Math.floor(s / 60); const r = s - m * 60; return `${m}:${r < 10 ? "0" : ""}${Number.isInteger(r) ? r : r.toFixed(1)}`; };

const P = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`;
export const I = {
  escudo: P('<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>'),
  mazo: P('<path d="m14 13-7.5 7.5a2.12 2.12 0 0 1-3-3L11 10"/><path d="m16 16 6-6"/><path d="m8 8 6-6"/><path d="m9 7 8 8"/><path d="m21 11-8-8"/>'),
  flecha: P('<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>'),
  atras: P('<path d="m15 18-6-6 6-6"/>'),
  check: P('<path d="M20 6 9 17l-5-5"/>'),
  salir: P('<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5"/><path d="M21 12H9"/>'),
  descargar: P('<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>'),
  mas: P('<path d="M12 5v14"/><path d="M5 12h14"/>'),
  basura: P('<path d="M3 6h18"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>'),
  lapiz: P('<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>'),
  girar: P('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  copiar: P('<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  copa: P('<path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"/><path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/>'),
  reloj: P('<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'),
  candado: P('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>'),
  abierto: P('<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>'),
  camara: P('<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>'),
  personas: P('<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>'),
  bandera: P('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
  vivo: P('<path d="M4.9 19.1C1 15.2 1 8.8 4.9 4.9"/><path d="M7.8 16.2c-2.3-2.3-2.3-6.1 0-8.5"/><circle cx="12" cy="12" r="2"/><path d="M16.2 7.8c2.3 2.3 2.3 6.1 0 8.5"/><path d="M19.1 4.9C23 8.8 23 15.1 19.1 19"/>'),
  tabla: P('<path d="M3 3h18v18H3z"/><path d="M3 9h18"/><path d="M3 15h18"/><path d="M9 3v18"/>'),
  info: P('<circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>'),
  alerta: P('<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>'),
  llave: P('<circle cx="7.5" cy="15.5" r="5.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3L22 7l-3-3"/>'),
  cerrar: P('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>'),
  pizarra: P('<path d="M2 3h20"/><path d="M21 3v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V3"/><path d="m7 21 5-5 5 5"/>'),
  libro: P('<path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20"/>'),
};

export function aviso(texto, tipo = "ok") {
  let cont = $(".avisos");
  if (!cont) { cont = document.createElement("div"); cont.className = "avisos"; cont.setAttribute("role", "status"); document.body.append(cont); }
  const el = document.createElement("div");
  el.className = `aviso aviso--${tipo}`;
  el.innerHTML = `${tipo === "ok" ? I.check : I.alerta}<span>${esc(texto)}</span>`;
  cont.append(el);
  setTimeout(() => { el.style.transition = "opacity .3s"; el.style.opacity = "0"; setTimeout(() => el.remove(), 320); }, tipo === "ok" ? 2600 : 4600);
}

// Modal genérico. contenido = HTML. Devuelve {el, cerrar}
export function modal(html, { ancho = false, alCerrar } = {}) {
  const velo = document.createElement("div");
  velo.className = "velo";
  velo.innerHTML = `<div class="modal ${ancho ? "modal--ancho" : ""}" role="dialog" aria-modal="true">${html}</div>`;
  const previo = document.activeElement;
  const cerrar = () => { velo.remove(); document.removeEventListener("keydown", tecla); alCerrar?.(); previo?.focus?.(); };
  const tecla = (e) => { if (e.key === "Escape") cerrar(); };
  velo.addEventListener("mousedown", (e) => { if (e.target === velo) cerrar(); });
  document.addEventListener("keydown", tecla);
  document.body.append(velo);
  setTimeout(() => velo.querySelector("[autofocus], input, button")?.focus(), 30);
  return { el: velo.querySelector(".modal"), cerrar };
}

export function confirmar(titulo, texto, { boton = "Confirmar", peligro = false } = {}) {
  return new Promise((res) => {
    const m = modal(`<h2>${esc(titulo)}</h2><p style="color:var(--niebla);margin:0">${texto}</p>
      <div class="modal__acciones"><button class="btn" data-no>Cancelar</button><button class="btn ${peligro ? "btn--peligro" : "btn--naranja"}" data-si>${esc(boton)}</button></div>`,
      { alCerrar: () => res(false) });
    m.el.querySelector("[data-no]").onclick = () => m.cerrar();
    m.el.querySelector("[data-si]").onclick = () => { res(true); m.cerrar(); };
  });
}

export const fondoAnimado = (chispas = 22) => `<div class="fondo"></div><div class="deco" aria-hidden="true">
  <div class="orbe orbe--1"></div><div class="orbe orbe--2"></div><div class="orbe orbe--3"></div>
  <div class="rayo"></div><div class="rayo"></div><div class="rayo"></div>
  ${Array.from({ length: chispas }, () => `<i class="chispa" style="left:${(Math.random() * 100).toFixed(1)}%;top:${(55 + Math.random() * 50).toFixed(1)}%;animation-delay:${(-Math.random() * 6).toFixed(2)}s;animation-duration:${(4 + Math.random() * 5).toFixed(2)}s"></i>`).join("")}
</div>`;

export function lanzarConfeti() {
  try { window.confetti?.({ particleCount: 110, spread: 75, origin: { y: 0.7 }, colors: ["#FF6A1F", "#1FCBEA", "#A98BFF", "#FFC23D", "#ffffff"] }); } catch { /* opcional */ }
}

export const IMG = (typeof window !== "undefined" && window.__CONCEPMI_IMG__) || { logo: "img/concepmi-vi-logo.png", wolfito: "img/wolfito-concepmi.png", club: "img/pmi-lima-student-club.png" };

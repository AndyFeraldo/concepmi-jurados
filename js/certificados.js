// =========================================================
// Pestaña CERTIFICADOS del admin: arma el certificado oficial (img/certificado-base.jpg)
// para jurados, talleristas, ponentes, equipo organizador y otras personas que agregues.
// Cambia el nombre y el texto según el rol (jurado de qué concurso, tallerista de qué taller…).
// Vista previa, PDF individual, ZIP con un PDF por persona o un solo PDF para imprimir.
// Todo se arma en el navegador: no se guarda nada en la base de datos
// (los «otros» y los textos editados quedan en este navegador).
// =========================================================
import { api } from "./api.js?v=202611040220";
import { porId } from "./concursos.js?v=202611040220";
import { CHARLAS } from "./charlas.js?v=202611040220";
import { tallerPorId } from "./talleres.js?v=202611040220";
import { $, $$, esc, I, aviso, modal, confirmar } from "./ui.js?v=202611040220";

const BASE = "img/certificado-base.jpg";
const ANCHO = 3000, ALTO = 2121, K = ANCHO / 2000; // el diseño original mide 2000 × 1414
const EVENTO = "en el VI Congreso Nacional de Comunidades Estudiantiles del PMI - VI CONCEPMI 2026, realizado los días 24 y 26 de noviembre de 2026 en la Universidad Nacional Mayor de San Marcos, Lima – Perú, aportando al desarrollo de los futuros líderes en gestión de proyectos del país.";
const TIPOS = {
  jurado: { txt: "Jurados", uno: "Jurado" },
  tallerista: { txt: "Talleristas", uno: "Tallerista" },
  ponente: { txt: "Ponentes", uno: "Ponente" },
  organizador: { txt: "Equipo organizador", uno: "Organizador" },
  otro: { txt: "Otros", uno: "Otro" },
};
const CLAVE = "concepmi-certificados-v1";
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
const escribir = (x) => { try { localStorage.setItem(CLAVE, JSON.stringify(x)); } catch { /* sin almacenamiento */ } };

// «A», «A y B», «A, B y C»
const unir = (l) => (l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}`);
const conArticulo = (n) => (/^Gran\b/.test(n) ? `la ${n}` : /^Concurso\b/.test(n) ? `el ${n}` : `el concurso ${n}`);
export const textoRol = (p) => {
  if (p.tipo === "jurado") return `como jurado en ${unir(p.items.map(conArticulo))}`;
  if (p.tipo === "tallerista") return p.items.length > 1 ? `como tallerista de los talleres ${unir(p.items.map((t) => `«${t}»`))}` : `como tallerista del taller «${p.items[0] || ""}»`;
  if (p.tipo === "ponente") return `como ponente de la charla magistral ${unir(p.items.map((t) => `«${t}»`))}`;
  if (p.tipo === "organizador") return "como parte del equipo organizador";
  return p.rol ? `como ${p.rol}` : "";
};
export const textoBase = (p) => `Por su valiosa participación${textoRol(p) ? ` ${textoRol(p)}` : ""} ${EVENTO}`;

// ---------- Dibujo en lienzo ----------
let fondo = null;
const cargarFondo = () => (fondo ||= new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => rej(new Error("No se pudo cargar la plantilla del certificado")); im.src = BASE; }));
const fuentes = () => Promise.all([document.fonts.load(`italic 700 ${Math.round(100 * K)}px "Playfair Display"`), document.fonts.load(`400 ${Math.round(32 * K)}px Poppins`)]).catch(() => {});

function lineas(ctx, texto, ancho) {
  const out = []; let l = "";
  for (const w of texto.split(/\s+/)) { const t = l ? `${l} ${w}` : w; if (ctx.measureText(t).width > ancho && l) { out.push(l); l = w; } else l = t; }
  if (l) out.push(l); return out;
}
export async function dibujar(p, lienzo = document.createElement("canvas")) {
  const [im] = await Promise.all([cargarFondo(), fuentes()]);
  lienzo.width = ANCHO; lienzo.height = ALTO;
  const ctx = lienzo.getContext("2d");
  ctx.drawImage(im, 0, 0, ANCHO, ALTO);
  ctx.textAlign = "center"; ctx.textBaseline = "alphabetic";
  // Nombre: cursiva morada sobre la línea, se achica si es muy largo
  let t = 104 * K; ctx.fillStyle = "#4A1AA6";
  do { ctx.font = `italic 700 ${t}px "Playfair Display", Georgia, serif`; t -= 4; } while (ctx.measureText(p.nombre).width > 1040 * K && t > 40 * K);
  ctx.fillText(p.nombre, 1017 * K, 652 * K);
  // Texto: hasta 5 líneas entre la línea del nombre y las firmas
  let f = 33 * K, ls;
  do { ctx.font = `400 ${f}px Poppins, sans-serif`; ls = lineas(ctx, p.texto, 1540 * K); f -= 1; } while (ls.length * f * 1.08 > 200 * K && f > 22 * K);
  f += 1; ctx.fillStyle = "#3A3A46";
  const alto = f * 1.07, y0 = 812 * K - ((ls.length - 1) * alto) / 2;
  ls.forEach((l, i) => ctx.fillText(l, 1009 * K, y0 + i * alto));
  return lienzo;
}
const jpeg = (cv) => new Promise((res) => cv.toBlob(async (b) => res(new Uint8Array(await b.arrayBuffer())), "image/jpeg", 0.9));

// ---------- PDF mínimo (una imagen JPEG por hoja A4 horizontal) ----------
export function pdfDeImagenes(imgs) {
  const enc = new TextEncoder(), partes = [], offs = []; let largo = 0;
  const pon = (x) => { const b = typeof x === "string" ? enc.encode(x) : x; partes.push(b); largo += b.length; };
  const obj = (n, cuerpo, flujo) => { offs[n] = largo; pon(`${n} 0 obj\n${cuerpo}`); if (flujo) { pon("stream\n"); pon(flujo); pon("\nendstream"); } pon("\nendobj\n"); };
  const W = 841.89, H = 595.28, n = imgs.length;
  pon("%PDF-1.4\n%\xE2\xE3\xCF\xD3\n");
  obj(1, "<< /Type /Catalog /Pages 2 0 R >>\n");
  obj(2, `<< /Type /Pages /Count ${n} /Kids [${imgs.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>\n`);
  imgs.forEach((im, i) => {
    const pg = 3 + i * 3, ct = pg + 1, ix = pg + 2, dib = enc.encode(`q ${W} 0 0 ${H} 0 0 cm /Im0 Do Q`);
    obj(pg, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /XObject << /Im0 ${ix} 0 R >> >> /Contents ${ct} 0 R >>\n`);
    obj(ct, `<< /Length ${dib.length} >>\n`, dib);
    obj(ix, `<< /Type /XObject /Subtype /Image /Width ${ANCHO} /Height ${ALTO} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${im.length} >>\n`, im);
  });
  const total = 3 + n * 3, xref = largo;
  pon(`xref\n0 ${total}\n0000000000 65535 f \n${Array.from({ length: total - 1 }, (_, k) => `${String(offs[k + 1]).padStart(10, "0")} 00000 n \n`).join("")}`);
  pon(`trailer\n<< /Size ${total} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`);
  return new Blob(partes, { type: "application/pdf" });
}
const bajar = (blob, nombre) => { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = nombre; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); };
const archivo = (p) => `Certificado - ${p.nombre.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[\\/:*?"<>|]+/g, "").trim()}.pdf`; // sin tildes en el nombre del archivo (algunos navegadores las rechazan)
const cargarJSZip = () => window.JSZip ? Promise.resolve(window.JSZip) : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/jszip.min.js"; s.onload = () => res(window.JSZip); s.onerror = () => rej(new Error("No se pudo cargar el compresor ZIP")); document.head.append(s); });

// ---------- Pestaña ----------
export function crearCertificados(ctx) {
  let filtro = "todos", busca = "", coords = null;
  const marcados = new Set(), quitados = new Set();
  const guardado = leer(); guardado.otros ||= []; guardado.editados ||= {};
  const guardar = () => escribir(guardado);

  function personas() {
    const d = ctx.data(), l = [];
    d.jurados.forEach((j) => { const items = j.concursos.map((c) => porId(c)?.nombre).filter(Boolean); if (items.length) l.push({ id: `j:${j.id}`, tipo: "jurado", nombre: j.nombre, items }); });
    d.talleristas.forEach((t) => { const items = (t.talleres || []).map((x) => tallerPorId(x)?.nombre).filter(Boolean); if (items.length) l.push({ id: `t:${t.id}`, tipo: "tallerista", nombre: t.nombre, items }); });
    const pon = new Map(); CHARLAS.forEach((c) => { if (!c.ponente) return; const x = pon.get(c.ponente) || { id: `p:${c.id}`, tipo: "ponente", nombre: c.ponente, items: [] }; x.items.push(c.nombre); pon.set(c.ponente, x); });
    l.push(...pon.values());
    (coords || []).forEach((k) => l.push({ id: `o:${k.id}`, tipo: "organizador", nombre: k.nombre, items: [] }));
    guardado.otros.forEach((o) => l.push({ ...o, tipo: "otro", items: [] }));
    return l.map((p) => { const e = guardado.editados[p.id] || {}; return { ...p, nombre: e.nombre || p.nombre, texto: e.texto || textoBase(p), editado: !!(e.nombre || e.texto) }; });
  }
  const visibles = () => personas().filter((p) => (filtro === "todos" || p.tipo === filtro) && (!busca || `${p.nombre} ${p.items.join(" ")} ${p.rol || ""}`.toLowerCase().includes(busca)));
  const elegidos = () => visibles().filter((p) => !quitados.has(p.id) && (p.tipo !== "organizador" || marcados.has(p.id)));

  async function vista(v) {
    if (!coords) { try { coords = await api.adminCoordinadores(ctx.codigo()); } catch { coords = []; } }
    pintar(v);
  }
  function pintar(v) {
    const todas = personas(), lista = visibles(), el = elegidos();
    const cuenta = (t) => todas.filter((p) => t === "todos" || p.tipo === t).length;
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Certificados</h1><p>El certificado oficial con el nombre y el texto de cada persona según su rol: <b>jurado</b> (de qué concurso), <b>tallerista</b> (de qué taller), <b>ponente</b> (de qué charla) y más. Revisa la lista, mira la vista previa y descarga.</p></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-otro>${I.mas}Agregar persona</button>
          <button class="btn" data-uno ${el.length ? "" : "disabled"}>${I.descargar}Un solo PDF (${el.length})</button>
          <button class="btn btn--naranja" data-zip ${el.length ? "" : "disabled"}>${I.descargar}Descargar PDFs (${el.length}) · ZIP</button></div></div>
      <div class="cert-barra">
        <div class="pestanas pestanas--sub" style="margin:0">${["todos", ...Object.keys(TIPOS)].map((t) => `<button class="pestana" data-f="${t}" aria-selected="${t === filtro}">${t === "todos" ? "Todos" : TIPOS[t].txt} <small>${cuenta(t)}</small></button>`).join("")}</div>
        <input class="log-buscar" data-buscar placeholder="Buscar por nombre, concurso o taller…" value="${esc(busca)}">
      </div>
      <div class="tabla-envoltura"><table class="tabla cert-tabla"><thead><tr><th style="width:36px"><input type="checkbox" data-todas ${lista.length && lista.every((p) => el.includes(p)) ? "checked" : ""} aria-label="Elegir todos"></th><th>Nombre</th><th>Rol</th><th>Texto del certificado</th><th></th></tr></thead><tbody>
        ${lista.map((p) => `<tr class="${el.includes(p) ? "" : "cert-fuera"}"><td><input type="checkbox" data-sel="${esc(p.id)}" ${el.some((x) => x.id === p.id) ? "checked" : ""} aria-label="Incluir"></td>
          <td><b>${esc(p.nombre)}</b>${p.editado ? ` <span class="chip chip--ambar log-tag">editado</span>` : ""}</td>
          <td><span class="chip cert-tipo cert-tipo--${p.tipo}">${TIPOS[p.tipo].uno}</span></td>
          <td class="cert-texto">${esc(textoRol(p) || p.texto.slice(0, 90) + "…")}</td>
          <td style="white-space:nowrap"><button class="btn btn--mini" data-ver="${esc(p.id)}">${I.vivo}Vista previa</button> <button class="btn btn--mini btn--icono" data-pdf="${esc(p.id)}" title="Descargar su PDF" aria-label="Descargar su PDF">${I.descargar}</button>
            ${p.tipo === "otro" ? `<button class="btn btn--mini btn--icono btn--peligro" data-borrar-otro="${esc(p.id)}" title="Quitar de la lista" aria-label="Quitar">${I.basura}</button>` : ""}</td></tr>`).join("")
          || `<tr><td colspan="5"><div class="vacio"><b>No hay personas aquí</b>Crea jurados o talleristas en sus pestañas, o usa «Agregar persona».</div></td></tr>`}
      </tbody></table></div>
      <p class="ayuda">Salen todos los <b>jurados</b> y <b>talleristas</b> creados, los <b>ponentes</b> de las 3 charlas y los <b>accesos limitados</b> (equipo organizador, desmarcados al inicio). Con «Agregar persona» sumas a quien quieras (voluntarios, auspiciadores…) con su propio rol. El nombre y el texto se pueden corregir en la vista previa.</p>`;
    const buscar = $("[data-buscar]", v);
    buscar.oninput = () => { busca = buscar.value.trim().toLowerCase(); pintar(v); const b = $("[data-buscar]", v); b.focus(); b.setSelectionRange(b.value.length, b.value.length); };
    $$("[data-f]", v).forEach((b) => (b.onclick = () => { filtro = b.dataset.f; pintar(v); }));
    const marcar = (p, si) => { if (p.tipo === "organizador") { if (si) marcados.add(p.id); else marcados.delete(p.id); } else if (si) quitados.delete(p.id); else quitados.add(p.id); };
    $$("[data-sel]", v).forEach((c) => (c.onchange = () => { marcar(lista.find((p) => p.id === c.dataset.sel), c.checked); pintar(v); }));
    $("[data-todas]", v).onchange = (e) => { lista.forEach((p) => marcar(p, e.target.checked)); pintar(v); };
    const por = (id) => personas().find((p) => p.id === id);
    $$("[data-ver]", v).forEach((b) => (b.onclick = () => previa(por(b.dataset.ver), v)));
    $$("[data-pdf]", v).forEach((b) => (b.onclick = async () => { const p = por(b.dataset.pdf); b.disabled = true; try { bajar(pdfDeImagenes([await jpeg(await dibujar(p))]), archivo(p)); } catch (e) { aviso(e.message, "error"); } b.disabled = false; }));
    $$("[data-borrar-otro]", v).forEach((b) => (b.onclick = async () => { if (!(await confirmar("¿Quitar a esta persona de la lista?", "Solo se quita de los certificados.", { boton: "Quitar", peligro: true }))) return;
      guardado.otros = guardado.otros.filter((o) => o.id !== b.dataset.borrarOtro); delete guardado.editados[b.dataset.borrarOtro]; guardar(); pintar(v); }));
    $("[data-otro]", v).onclick = () => formOtro(v);
    $("[data-zip]", v).onclick = () => generar(elegidos(), "zip");
    $("[data-uno]", v).onclick = () => generar(elegidos(), "uno");
  }

  function formOtro(v) {
    const m = modal(`<h2>Agregar persona</h2><form class="form">
      <label class="campo"><span>Nombre completo</span><input name="nombre" maxlength="80" required placeholder="Ej. María López Torres"></label>
      <label class="campo"><span>Su participación fue «como…»</span><input name="rol" maxlength="120" placeholder="Ej. voluntaria del área de logística"></label>
      <p class="ayuda" style="margin:0">Quedará: «Por su valiosa participación como <i>voluntaria del área de logística</i> en el VI Congreso…». Se guarda en este navegador.</p>
      <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Agregar</button></div></form>`);
    const f = $("form", m.el); $("[data-cancelar]", m.el).onclick = m.cerrar;
    f.onsubmit = (e) => { e.preventDefault(); const nombre = f.nombre.value.trim(); if (nombre.length < 2) return;
      guardado.otros.push({ id: `x:${Date.now().toString(36)}`, nombre, rol: f.rol.value.trim() }); guardar(); m.cerrar(); filtro = "otro"; pintar(v); aviso("Persona agregada"); };
  }

  function previa(p, v) {
    const m = modal(`<h2>Vista previa · ${esc(TIPOS[p.tipo].uno)}</h2>
      <div class="cert-previa"><canvas data-lienzo></canvas></div>
      <form class="form" style="margin-top:12px">
        <label class="campo"><span>Nombre en el certificado</span><input name="nombre" maxlength="80" value="${esc(p.nombre)}"></label>
        <label class="campo"><span>Texto</span><textarea name="texto" rows="4" maxlength="600">${esc(p.texto)}</textarea></label>
        <div class="modal__acciones" style="margin-top:0">${p.editado ? `<button type="button" class="btn" data-restaurar style="margin-right:auto">${I.girar}Volver al texto automático</button>` : ""}
          <button type="button" class="btn" data-cerrar>Cerrar</button><button type="button" class="btn" data-guardar>${I.check}Guardar cambios</button><button type="button" class="btn btn--naranja" data-pdf>${I.descargar}Descargar PDF</button></div></form>`, { ancho: true });
    const f = $("form", m.el), cv = $("[data-lienzo]", m.el);
    const actual = () => ({ ...p, nombre: f.nombre.value.trim() || p.nombre, texto: f.texto.value.trim() || textoBase(p) });
    let t = null; const redibujar = () => { clearTimeout(t); t = setTimeout(() => dibujar(actual(), cv).catch((e) => aviso(e.message, "error")), 150); };
    f.nombre.oninput = redibujar; f.texto.oninput = redibujar; dibujar(actual(), cv).catch((e) => aviso(e.message, "error"));
    $("[data-cerrar]", m.el).onclick = m.cerrar;
    $("[data-guardar]", m.el).onclick = () => {
      const a = actual(); delete guardado.editados[p.id];
      const auto = personas().find((x) => x.id === p.id); // sin cambios guardados = texto automático
      const e = {}; if (a.nombre !== auto.nombre) e.nombre = a.nombre; if (a.texto !== auto.texto) e.texto = a.texto;
      if (Object.keys(e).length) guardado.editados[p.id] = e; guardar(); m.cerrar(); pintar(v); aviso("Cambios guardados");
    };
    $("[data-restaurar]", m.el)?.addEventListener("click", () => { delete guardado.editados[p.id]; guardar(); m.cerrar(); pintar(v); aviso("Texto automático"); });
    $("[data-pdf]", m.el).onclick = async () => { try { bajar(pdfDeImagenes([await jpeg(await dibujar(actual()))]), archivo(actual())); } catch (e) { aviso(e.message, "error"); } };
  }

  async function generar(lista, modo) {
    if (!lista.length) return;
    const m = modal(`<h2>Generando certificados</h2><p data-prog>Preparando…</p><div class="progreso"><i data-barra style="width:0%"></i></div>`);
    try {
      const cv = document.createElement("canvas"), hojas = [];
      for (let i = 0; i < lista.length; i++) {
        $("[data-prog]", m.el).textContent = `${i + 1} de ${lista.length} · ${lista[i].nombre}`; $("[data-barra]", m.el).style.width = `${((i + 1) / lista.length) * 100}%`;
        hojas.push({ p: lista[i], img: await jpeg(await dibujar(lista[i], cv)) });
        await new Promise((r) => setTimeout(r, 0));
      }
      if (modo === "uno") bajar(pdfDeImagenes(hojas.map((h) => h.img)), `Certificados VI CONCEPMI 2026 (${lista.length}).pdf`);
      else {
        const JSZip = await cargarJSZip(), zip = new JSZip(), usados = new Set();
        for (const h of hojas) {
          let n = `${TIPOS[h.p.tipo].txt}/${archivo(h.p)}`; for (let k = 2; usados.has(n); k++) n = `${TIPOS[h.p.tipo].txt}/${archivo(h.p).replace(/\.pdf$/, ` (${k}).pdf`)}`;
          usados.add(n); zip.file(n, pdfDeImagenes([h.img]));
        }
        $("[data-prog]", m.el).textContent = "Comprimiendo…";
        bajar(await zip.generateAsync({ type: "blob" }), `Certificados VI CONCEPMI 2026.zip`);
      }
      m.cerrar(); aviso(`${lista.length} certificado${lista.length === 1 ? "" : "s"} listo${lista.length === 1 ? "" : "s"}`);
    } catch (e) { m.cerrar(); aviso(e.message, "error"); }
  }

  return { vista };
}

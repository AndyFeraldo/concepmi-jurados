// =========================================================
// Pestaña CERTIFICADOS del admin. Usa el certificado oficial con firmas (img/certificado-base.jpg,
// sin el nombre ni el texto) y escribe encima el nombre, el texto y la cinta («de participación»,
// «equipo organizador»…). Tres secciones:
//   1. Invitados: jurados, talleristas y ponentes (salen solos de la base de datos)
//   2. Equipo organizador: voluntarios cargados de un Excel, con su área (DP, PMO, Ventas, RRPP, Marketing, TI)
//   3. Participantes: inscritos cargados de un Excel
// En cada sección: texto y cinta personalizables, vista previa editable, PDF individual,
// ZIP con un PDF por persona o un solo PDF para imprimir. Las listas y los textos se guardan
// en este navegador (localStorage); la base de datos no se toca.
// =========================================================
import { api } from "./api.js?v=202611091738";
import { resultados } from "./calculo.js?v=202611091738";
import { porId, CONCURSOS } from "./concursos.js?v=202611091738";
import { CHARLAS } from "./charlas.js?v=202611091738";
import { tallerPorId } from "./talleres.js?v=202611091738";
import { $, $$, esc, I, aviso, modal, confirmar } from "./ui.js?v=202611091738";

const BASE = "img/certificado-base.jpg";
const ANCHO = 3000, ALTO = 2121, K = ANCHO / 2000; // el diseño original mide 2000 × 1414
const EVENTO = "en el VI Congreso Nacional de Comunidades Estudiantiles del PMI - VI CONCEPMI 2026, realizado los días 24 y 26 de noviembre de 2026 en la Universidad Nacional Mayor de San Marcos, Lima – Perú";
const CIERRE = ", aportando al desarrollo de los futuros líderes en gestión de proyectos del país.";
export const AREAS_ORG = [
  { id: "DP", txt: "Dirección de Proyecto" }, { id: "PMO", txt: "PMO" }, { id: "Ventas", txt: "Ventas" },
  { id: "RRPP", txt: "Relaciones Públicas" }, { id: "Marketing", txt: "Marketing" }, { id: "Logistica", corto: "Logística", txt: "Logística" }, { id: "TI", txt: "Tecnologías de la Información" },
];
const areaTxt = (id) => AREAS_ORG.find((a) => a.id === id)?.txt || id || "";
const SECCIONES = {
  invitados: { txt: "Invitados", sub: "Jurados, talleristas y ponentes", cinta: "de participación", carpeta: "Invitados",
    plantilla: `Por su valiosa participación {rol} ${EVENTO}${CIERRE}`, vars: "{rol} = «como jurado en …», «como tallerista del taller …» o «como ponente de la charla magistral …» · **texto** = negrita" },
  organizadores: { txt: "Equipo organizador", sub: "Voluntarios del VI CONCEPMI", cinta: "equipo organizador", carpeta: "Equipo organizador",
    plantilla: `Por su valioso compromiso y trabajo como parte del **equipo organizador**, en el área de **{area}**, ${EVENTO}${CIERRE}`, vars: "{area} = el área del voluntario (por ejemplo «Marketing») · **texto** = negrita" },
  participantes: { txt: "Participantes", sub: "Inscritos al congreso", cinta: "de participación", carpeta: "Participantes",
    plantilla: `Por su participación como **asistente**, en representación de la delegación **{delegacion}**, ${EVENTO}${CIERRE}`, vars: "{delegacion} = su universidad o delegación (si a alguien le falta, esa frase se quita sola) · **texto** = negrita" },
  ganadores: { txt: "Ganadores", sub: "Top 3 de cada concurso", cinta: "de reconocimiento", carpeta: "Ganadores",
    plantilla: `Por haber obtenido el **{puesto}** en **{concurso}**, {equipo} de la delegación **{delegacion}**, ${EVENTO}${CIERRE}`, vars: "{puesto} = primer, segundo o tercer lugar · {concurso} · {equipo} = «como líder del equipo» o «como integrante del equipo» · {delegacion} · **texto** = negrita" },
};
// Texto de participantes de la versión anterior (sin delegación): si no lo cambiaron, se usa el nuevo
const PLANT_PART_V1 = `Por su participación como asistente ${EVENTO}${CIERRE}`;
// Textos por defecto anteriores (sin negritas): si el admin no los cambió, se usan los nuevos
const PLANT_VIEJAS = [PLANT_PART_V1, `Por su participación como asistente, en representación de la delegación {delegacion}, ${EVENTO}${CIERRE}`,
  `Por su valioso compromiso y trabajo como parte del equipo organizador, en el área de {area}, ${EVENTO}${CIERRE}`,
  `Por haber obtenido el {puesto} en {concurso}, en representación de la delegación {delegacion}, ${EVENTO}${CIERRE}`];
const PUESTOS = { 1: "primer lugar", 2: "segundo lugar", 3: "tercer lugar" };
const MEDALLA = { 1: "🥇", 2: "🥈", 3: "🥉" };
const TIPOS_INV = { jurado: "Jurado", tallerista: "Tallerista", ponente: "Ponente", otro: "Otro" };

const CLAVE = "concepmi-certificados-v2";
const leer = () => { try { return JSON.parse(localStorage.getItem(CLAVE)) || {}; } catch { return {}; } };
const escribir = (x) => { try { localStorage.setItem(CLAVE, JSON.stringify(x)); } catch { aviso("No se pudo guardar en este navegador (lista muy grande)", "error"); } };
const uid = () => Math.random().toString(36).slice(2, 10);

// «A», «A y B», «A, B y C»
const unir = (l) => (l.length < 2 ? l.join("") : `${l.slice(0, -1).join(", ")} y ${l[l.length - 1]}`);
const conArticulo = (n) => (/^Gran\b/.test(n) ? `la ${n}` : /^Concurso\b/.test(n) ? `el ${n}` : `el concurso ${n}`);
export const textoRol = (p) => {
  if (p.tipo === "jurado") return `como **jurado** en **${unir(p.items.map(conArticulo))}**`;
  if (p.tipo === "tallerista") return p.items.length > 1 ? `como **tallerista** de los talleres **${unir(p.items.map((t) => `«${t}»`))}**` : `como **tallerista** del taller **«${p.items[0] || ""}»**`;
  if (p.tipo === "ponente") return `como **ponente** de la charla magistral **${unir(p.items.map((t) => `«${t}»`))}**`;
  return p.rol ? `como **${p.rol}**` : "";
};
// Rellena la plantilla de la sección con los datos de la persona
// Si falta el dato (sin área o sin universidad), se quita también la frase que lo acompaña («, en el área de …»)
const sinDato = (t, v) => t.replace(new RegExp(`,?\\s*(?:en representación de la delegación|en representación del|en representación de|de la delegación|en el área de|de la|del|de|por|en)?\\s*(?:\\*\\*)?\\{${v}\\}(?:\\*\\*)?`, "g"), "");
const llenar = (plantilla, p) => [["area", areaTxt(p.area)], ["delegacion", p.delegacion || ""], ["puesto", PUESTOS[p.puesto] || ""], ["concurso", p.concursoTxt || ""], ["equipo", p.puesto ? (p.lider ? "como **líder del equipo**" : "como integrante del equipo") : ""]]
  .reduce((t, [v, x]) => (x ? t.replace(new RegExp(`\\{${v}\\}`, "g"), x) : sinDato(t, v)), plantilla)
  .replace(/\{rol\}/g, textoRol(p))
  .replace(/\s+,/g, ",").replace(/\s{2,}/g, " ").replace(/\(\s*\)/g, "").trim();

// Nombre propio: «JUAN PÉREZ DE LA CRUZ» → «Juan Pérez de la Cruz»
const MINUS = new Set(["de", "del", "la", "las", "los", "y", "e", "da", "do", "dos", "van", "von"]);
export const nombrePropio = (s) => String(s || "").trim().replace(/\s+/g, " ").toLowerCase()
  .split(" ").map((w, i) => (i && MINUS.has(w) ? w : w.replace(/(^|[-'])(\p{L})/gu, (m, a, b) => a + b.toUpperCase()))).join(" ");

// ---------- Dibujo en lienzo ----------
let fondo = null;
const cargarFondo = () => (fondo ||= new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = () => { fondo = null; rej(new Error("No se pudo cargar la plantilla del certificado")); }; im.src = BASE; }));
const fuentes = () => Promise.all([document.fonts.load(`italic 700 ${Math.round(100 * K)}px "Playfair Display"`), document.fonts.load(`400 ${Math.round(32 * K)}px Poppins`), document.fonts.load(`600 ${Math.round(32 * K)}px Poppins`)]).catch(() => {});
// «Por haber obtenido el **primer lugar** en…» → palabras con negrita o sin ella
function palabras(texto) {
  const out = [];
  String(texto).split("**").forEach((trozo, i) => trozo.split(/\s+/).forEach((w, j, arr) => {
    if (!w) return;
    // signo pegado al cierre de la negrita («**Marketing**,»): va sin espacio
    const pegado = j === 0 && out.length && !/^\s/.test(trozo) && !/\s$/.test(String(texto).split("**")[i - 1] || " ");
    out.push({ w, b: i % 2 === 1, pegado });
  }));
  return out;
}
const fuenteDe = (b, f) => `${b ? 600 : 400} ${f}px Poppins, sans-serif`;
function lineasRicas(ctx, ps, ancho, f) {
  ctx.font = fuenteDe(false, f); const esp = ctx.measureText(" ").width;
  const out = []; let l = [], w = 0;
  for (const p of ps) {
    ctx.font = fuenteDe(p.b, f); const a = ctx.measureText(p.w).width, sep = l.length && !p.pegado ? esp : 0;
    if (l.length && w + sep + a > ancho) { out.push({ l, w }); l = []; w = 0; }
    l.push({ ...p, a, sep: l.length && !p.pegado ? esp : 0 }); w += (l.length > 1 ? l[l.length - 1].sep : 0) + a;
  }
  if (l.length) out.push({ l, w }); return out;
}
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
  // Cinta: la plantilla dice «de participación»; si es otra, se pinta encima
  const cinta = (p.cinta || "de participación").trim();
  if (cinta.toLowerCase() !== "de participación") {
    ctx.fillStyle = "#501CA6"; ctx.fillRect(826 * K, 389 * K, 384 * K, 62 * K);
    let c = 46 * K; ctx.fillStyle = "#fff";
    do { ctx.font = `400 ${c}px Poppins, sans-serif`; c -= 1; } while (ctx.measureText(cinta).width > 372 * K && c > 24 * K);
    ctx.fillText(cinta, 1017 * K, 436 * K);
  }
  // Nombre: cursiva morada sobre la línea, se achica si es muy largo
  let t = 104 * K; ctx.fillStyle = "#4A1AA6";
  do { ctx.font = `italic 700 ${t}px "Playfair Display", Georgia, serif`; t -= 4; } while (ctx.measureText(p.nombre).width > 1040 * K && t > 40 * K);
  ctx.fillText(p.nombre, 1017 * K, 652 * K);
  // Texto: entre la línea del nombre y las firmas (hasta 5 líneas, se achica si hace falta)
  const ps = palabras(p.texto);
  let f = 33 * K, ls;
  do { ls = lineasRicas(ctx, ps, 1540 * K, f); f -= 1; } while (ls.length * f * 1.07 > 150 * K && f > 20 * K);
  f += 1; ls = lineasRicas(ctx, ps, 1540 * K, f);
  const alto = f * 1.07, y0 = 788 * K - ((ls.length - 1) * alto) / 2;
  ctx.textAlign = "left";
  ls.forEach(({ l, w }, i) => {
    let x = 1009 * K - w / 2;
    l.forEach((t, k) => { if (k) x += t.sep; ctx.font = fuenteDe(t.b, f); ctx.fillStyle = t.b ? "#4A1AA6" : "#3A3A46"; ctx.fillText(t.w, x, y0 + i * alto); x += t.a; });
  });
  ctx.textAlign = "center";
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
const sinTildes = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const archivo = (p) => `Certificado - ${sinTildes(p.nombre).replace(/[\\/:*?"<>|]+/g, "").trim()}.pdf`; // sin tildes en el nombre del archivo (algunos navegadores las rechazan)
const cargarJSZip = () => window.JSZip ? Promise.resolve(window.JSZip) : new Promise((res, rej) => { const s = document.createElement("script"); s.src = "vendor/jszip.min.js"; s.onload = () => res(window.JSZip); s.onerror = () => rej(new Error("No se pudo cargar el compresor ZIP")); document.head.append(s); });

// ---------- Importar Excel (voluntarios o inscritos) ----------
// campos: [{ id, txt, claves: /regex de encabezados/, requerido }]
function leerLibro(file) {
  return new Promise((res, rej) => {
    if (!window.XLSX) return rej(new Error("El lector de Excel aún no cargó. Espera un segundo e inténtalo otra vez."));
    const fr = new FileReader();
    fr.onload = () => { try { res(window.XLSX.read(fr.result, { type: "array" })); } catch { rej(new Error("No se pudo leer el archivo. ¿Es un Excel (.xlsx) o CSV?")); } };
    fr.onerror = () => rej(new Error("No se pudo abrir el archivo")); fr.readAsArrayBuffer(file);
  });
}
export function importarExcel({ titulo, ayuda, campos, alImportar, unBoton = "" }) {
  let libro = null, hoja = "", filas = [], fila0 = 0, cols = {};
  const m = modal(`<h2>${esc(titulo)}</h2><p class="ayuda" style="margin-top:0">${ayuda}</p>
    <label class="btn btn--naranja" style="cursor:pointer;justify-self:start">${I.descargar}Elegir archivo Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-archivo></label>
    <div data-paso></div>`, { ancho: true });
  const paso = $("[data-paso]", m.el);
  const norm = (s) => sinTildes(String(s || "")).toLowerCase().trim();
  function detectar() {
    // fila de encabezados: la primera (de las 10 primeras) donde coincide algún campo
    fila0 = Math.max(0, filas.slice(0, 10).findIndex((f) => f.some((c) => campos.some((k) => k.claves.test(norm(c))))));
    const enc = filas[fila0] || [];
    cols = {}; campos.forEach((k) => { const i = enc.findIndex((c) => k.claves.test(norm(c)) && !Object.values(cols).includes(enc.indexOf(c))); cols[k.id] = i; });
  }
  // ¿La columna del nombre trae «Apellidos y Nombres»? (los apellidos van primero)
  const alReves = () => /^apellidos? y nombres?/.test(norm((filas[fila0] || [])[cols.nombre]));
  function pintar() {
    const enc = filas[fila0] || [], datos = filas.slice(fila0 + 1).filter((f) => f.some((c) => String(c).trim()));
    const sel = (k) => `<label class="campo"><span>${esc(k.txt)}${k.requerido ? "" : " (opcional)"}</span><select data-col="${k.id}"><option value="-1">${k.requerido ? "Elige la columna…" : "(no usar)"}</option>${enc.map((t, i) => `<option value="${i}" ${cols[k.id] === i ? "selected" : ""}>${esc(t || `Columna ${i + 1}`)}</option>`).join("")}</select></label>`;
    const val = (f, id) => (cols[id] >= 0 ? String(f[cols[id]] ?? "").trim() : "");
    const muestra = datos.slice(0, 4).map((f) => campos.map((k) => val(f, k.id)).filter(Boolean).join(" · ")).filter(Boolean);
    paso.innerHTML = `${libro.SheetNames.length > 1 ? `<label class="campo"><span>Hoja</span><select data-hoja>${libro.SheetNames.map((n) => `<option ${n === hoja ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>` : ""}
      <div class="cert-map">${campos.map(sel).join("")}</div>
      <label class="check" style="margin:6px 0"><input type="checkbox" data-propio checked><span>Corregir mayúsculas de los nombres<small>«JUAN PÉREZ» → «Juan Pérez»</small></span></label>
      ${alReves() ? `<label class="check" style="margin:6px 0"><input type="checkbox" data-invertir checked><span>Poner el nombre antes de los apellidos<small>«García Rojas Pedro» → «Pedro García Rojas» (toma las 2 primeras palabras como apellidos)</small></span></label>` : ""}
      <p class="ayuda" style="margin:4px 0"><b>${datos.length}</b> filas encontradas${muestra.length ? `. Ejemplo: ${muestra.map(esc).join(" | ")}` : ""}</p>
      <div class="modal__acciones" style="margin-top:6px"><button class="btn" data-cancelar>Cancelar</button>${unBoton ? `<button class="btn btn--naranja" data-agregar>${I.check}${esc(unBoton)}</button>` : `<button class="btn" data-agregar>Agregar a la lista</button><button class="btn btn--naranja" data-reemplazar>${I.check}Reemplazar la lista</button>`}</div>`;
    $("[data-hoja]", paso)?.addEventListener("change", (e) => { hoja = e.target.value; filas = window.XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, defval: "", raw: false }); detectar(); pintar(); });
    $$("[data-col]", paso).forEach((s) => (s.onchange = () => { cols[s.dataset.col] = Number(s.value); pintar(); }));
    $("[data-cancelar]", paso).onclick = m.cerrar;
    const hacer = (reemplazar) => {
      const falta = campos.find((k) => k.requerido && !(cols[k.id] >= 0));
      if (falta) return aviso(`Elige la columna de «${falta.txt}»`, "error");
      const propio = $("[data-propio]", paso).checked, invertir = $("[data-invertir]", paso)?.checked;
      const voltear = (v) => { const w = String(v).trim().split(/\s+/); return w.length >= 3 ? [...w.slice(2), ...w.slice(0, 2)].join(" ") : v; };
      const lista = datos.map((f) => Object.fromEntries(campos.map((k) => {
        if (k.id !== "nombre" && cols[k.id] === cols.nombre) return [k.id, ""]; // misma columna: no repetir
        let v = val(f, k.id); if (k.id === "nombre" && invertir) v = voltear(v);
        return [k.id, propio && k.nombre ? nombrePropio(v) : v]; }))).filter((x) => campos.some((k) => k.nombre && x[k.id]));
      if (!lista.length) return aviso("No se encontró ningún nombre en esa columna", "error");
      alImportar(lista, reemplazar); m.cerrar();
    };
    $("[data-agregar]", paso).onclick = () => hacer(false);
    $("[data-reemplazar]", paso)?.addEventListener("click", () => hacer(true));
  }
  $("[data-archivo]", m.el).onchange = async (e) => {
    const f = e.target.files?.[0]; if (!f) return;
    try {
      libro = await leerLibro(f);
      hoja = libro.SheetNames.find((n) => /confirm|inscrit|volunt|lista/i.test(n)) || libro.SheetNames[0];
      filas = window.XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, defval: "", raw: false });
      detectar(); pintar();
    } catch (ex) { aviso(ex.message, "error"); }
  };
}

// ---------- Pestaña ----------
export function crearCertificados(ctx) {
  let seccion = "invitados", filtro = "todos", busca = "", ponentes = null;
  const quitados = new Set();
  const g = leer();
  g.config ||= {}; g.editados ||= {}; g.otros ||= []; g.organizadores ||= []; g.participantes ||= []; g.ganadores ||= {};
  Object.values(g.config).forEach((c) => { if (PLANT_VIEJAS.includes(c?.plantilla)) delete c.plantilla; });
  const delDe = (id) => ctx.data().delegaciones.find((d) => d.id === id);
  // Migra los «otros» de la versión anterior (concepmi-certificados-v1)
  if (!g.migrado) { try { const v1 = JSON.parse(localStorage.getItem("concepmi-certificados-v1")); if (v1?.otros?.length) g.otros.push(...v1.otros); } catch { /* nada */ } g.migrado = true; }
  const guardar = () => escribir(g);
  const cfg = (s) => ({ cinta: SECCIONES[s].cinta, plantilla: SECCIONES[s].plantilla, ...(g.config[s] || {}) });

  function invitados() {
    const d = ctx.data(), l = [];
    d.jurados.forEach((j) => { const items = j.concursos.map((c) => porId(c)?.nombre).filter(Boolean); if (items.length) l.push({ id: `j:${j.id}`, tipo: "jurado", nombre: j.nombre, items }); });
    d.talleristas.forEach((t) => { const items = (t.talleres || []).map((x) => tallerPorId(x)?.nombre).filter(Boolean); if (items.length) l.push({ id: `t:${t.id}`, tipo: "tallerista", nombre: t.nombre, items }); });
    if (ponentes?.length) ponentes.forEach((o) => { const items = o.charlas.map((c) => CHARLAS.find((x) => x.id === c)?.nombre).filter(Boolean); if (items.length) l.push({ id: `p:${o.id}`, tipo: "ponente", nombre: o.nombre, items }); });
    else { const pon = new Map(); CHARLAS.forEach((c) => { if (!c.ponente) return; const x = pon.get(c.ponente) || { id: `p:${c.id}`, tipo: "ponente", nombre: c.ponente, items: [] }; x.items.push(c.nombre); pon.set(c.ponente, x); }); l.push(...pon.values()); }
    g.otros.forEach((o) => l.push({ ...o, tipo: "otro", items: [] }));
    return l;
  }
  // Personas de la sección con nombre, texto y cinta listos para dibujar
  function personas(s = seccion) {
    const c = cfg(s);
    const base = s === "invitados" ? invitados()
      : s === "organizadores" ? g.organizadores.map((o) => ({ ...o, id: `o:${o.id}`, oid: o.id, nombre: [o.nombre, o.apellido, o.materno].filter(Boolean).join(" ") }))
      : s === "ganadores" ? CONCURSOS.flatMap((c) => (g.ganadores[c.id] || []).flatMap((e) => e.nombres.map((n) => ({ id: `w:${n.id}`, tipo: c.tipo, nombre: n.n, lider: !!n.lider,
          puesto: e.puesto, concurso: c.id, concursoNombre: c.nombre, concursoTxt: conArticulo(c.nombre), delegacion: delDe(e.delegacion)?.nombre || "", wid: e.id, nid: n.id }))))
      : g.participantes.map((o) => ({ ...o, id: `a:${o.id}`, oid: o.id, nombre: [o.nombre, o.apellido, o.materno].filter(Boolean).join(" ") }));
    return base.map((p) => { const e = g.editados[p.id] || {}; return { ...p, seccion: s, nombre: e.nombre || p.nombre, texto: e.texto || llenar(c.plantilla, p), cinta: c.cinta, editado: !!(e.nombre || e.texto) }; });
  }
  const visibles = () => personas().filter((p) => (!["invitados", "ganadores"].includes(seccion) || filtro === "todos" || p.tipo === filtro)
    && (!busca || sinTildes(`${p.nombre} ${(p.items || []).join(" ")} ${p.area || ""} ${p.delegacion || ""} ${p.rol || ""} ${p.concursoNombre || ""}`).toLowerCase().includes(busca)));
  const elegidos = () => visibles().filter((p) => !quitados.has(p.id));

  async function vista(v) {
    if (!ponentes) { try { ponentes = await api.adminPonentes(ctx.codigo()); } catch { ponentes = []; } }
    pintar(v);
  }
  function pintar(v) {
    const S = SECCIONES[seccion], c = cfg(seccion), lista = visibles(), el = elegidos(), todas = personas();
    const n = (s) => personas(s).length;
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Certificados</h1><p>El certificado oficial con las firmas, el nombre de cada persona y el texto según su rol. Elige la sección, revisa la lista, mira la vista previa y descarga.</p></div></div>
      <div class="pestanas pestanas--sub cert-secciones">${Object.entries(SECCIONES).map(([k, x]) => `<button class="pestana" data-sec="${k}" aria-selected="${k === seccion}">${esc(x.txt)} <small>${esc(x.sub)} · ${n(k)}</small></button>`).join("")}</div>
      <section class="tarjeta cert-cfg">
        <div class="cert-cfg__cinta"><label class="campo"><span>Cinta del certificado</span><input data-cinta maxlength="28" value="${esc(c.cinta)}"></label>
          <div class="reparto" style="margin:0">${["de participación", "equipo organizador", "de reconocimiento"].map((t) => `<button class="btn btn--mini ${t === c.cinta ? "btn--naranja" : ""}" data-cinta-rapida="${t}">${t}</button>`).join("")}</div></div>
        <label class="campo"><span>Texto del certificado <small class="tenue">(variables: ${esc(S.vars)})</small></span><textarea data-plantilla rows="3" maxlength="700">${esc(c.plantilla)}</textarea></label>
        <div class="cert-cfg__acc"><button class="btn btn--mini" data-restaurar-cfg>${I.girar}Texto original</button><button class="btn btn--mini" data-muestra ${todas.length ? "" : "disabled"}>${I.vivo}Ver cómo queda</button></div>
      </section>
      ${seccion === "ganadores" ? editorGanadores() : ""}
      <div class="cert-barra">
        ${seccion === "invitados" ? `<div class="pestanas pestanas--sub" style="margin:0">${["todos", ...Object.keys(TIPOS_INV)].map((t) => `<button class="pestana" data-f="${t}" aria-selected="${t === filtro}">${t === "todos" ? "Todos" : TIPOS_INV[t] + "s"} <small>${todas.filter((p) => t === "todos" || p.tipo === t).length}</small></button>`).join("")}</div>` : ""}
        ${seccion === "ganadores" ? `<div class="pestanas pestanas--sub" style="margin:0">${[["todos", "Todos"], ["academico", "Académicos"], ["cultural", "Culturales"]].map(([t, x]) => `<button class="pestana" data-f="${t}" aria-selected="${t === filtro}">${x} <small>${todas.filter((p) => t === "todos" || p.tipo === t).length}</small></button>`).join("")}</div>` : ""}
        <input class="log-buscar" data-buscar placeholder="Buscar por nombre${seccion === "organizadores" ? " o área" : seccion === "participantes" ? " o delegación" : seccion === "ganadores" ? ", concurso o delegación" : ", concurso o taller"}…" value="${esc(busca)}">
        <div class="cert-barra__acc">
          ${seccion === "invitados" ? `<button class="btn" data-otro>${I.mas}Agregar persona</button>` : seccion === "ganadores" ? "" : `<button class="btn" data-importar>${I.descargar}Cargar Excel</button><button class="btn" data-nuevo>${I.mas}Agregar</button>${todas.length ? `<button class="btn btn--peligro" data-vaciar>${I.basura}Vaciar lista</button>` : ""}`}
          <button class="btn" data-uno ${el.length ? "" : "disabled"}>${I.descargar}Un solo PDF (${el.length})</button>
          <button class="btn btn--naranja" data-zip ${el.length ? "" : "disabled"}>${I.descargar}Descargar PDFs (${el.length}) · ZIP</button>
        </div>
      </div>
      <div class="tabla-envoltura"><table class="tabla cert-tabla"><thead><tr><th style="width:36px"><input type="checkbox" data-todas ${lista.length && lista.every((p) => !quitados.has(p.id)) ? "checked" : ""} aria-label="Elegir todos"></th>
        <th>Nombre</th><th>${seccion === "invitados" ? "Rol" : seccion === "organizadores" ? "Área" : seccion === "ganadores" ? "Puesto · concurso · delegación" : "Delegación"}</th>${seccion === "invitados" ? "<th>Texto del certificado</th>" : ""}<th></th></tr></thead><tbody>
        ${lista.slice(0, 400).map((p) => fila(p)).join("") || `<tr><td colspan="5"><div class="vacio"><b>${seccion === "invitados" ? "No hay personas aquí" : "La lista está vacía"}</b>${seccion === "invitados" ? "Crea jurados, talleristas o ponentes en sus pestañas, o usa «Agregar persona»." : seccion === "ganadores" ? "Arriba, en cada concurso, escribe los nombres de los integrantes de cada puesto (o usa «Traer top 3 de Resultados»)." : seccion === "organizadores" ? "Usa «Cargar Excel» con la lista de voluntarios (nombre, apellido y área) o «Agregar»." : "Usa «Cargar Excel» con la lista de inscritos (por ejemplo, la hoja CONFIRMADOS) o «Agregar»."}</div></td></tr>`}
      </tbody></table></div>
      ${lista.length > 400 ? `<p class="ayuda">Se muestran 400 de ${lista.length}. Usa el buscador para encontrar a alguien; la descarga incluye a todos los marcados.</p>` : ""}
      <p class="ayuda">${seccion === "invitados" ? "Los jurados, talleristas y ponentes salen solos de sus pestañas. Con «Agregar persona» sumas a quien quieras (auspiciadores, invitados…) con su propio rol." : "La lista se guarda en este navegador. "}El nombre y el texto de cada persona se pueden corregir en su vista previa.</p>`;

    function fila(p) {
      const fuera = quitados.has(p.id);
      const col = seccion === "invitados" ? `<td><span class="chip cert-tipo cert-tipo--${p.tipo}">${TIPOS_INV[p.tipo]}</span></td><td class="cert-texto">${esc(textoRol(p) || "—")}</td>`
        : seccion === "organizadores" ? `<td><select class="mini-select" data-area="${p.oid}"><option value="">Elige el área…</option>${AREAS_ORG.map((a) => `<option value="${a.id}" ${a.id === p.area ? "selected" : ""}>${a.corto ? esc(a.corto) : `${a.id} · ${esc(a.txt)}`}</option>`).join("")}</select></td>`
        : seccion === "ganadores" ? `<td class="cert-texto"><b>${MEDALLA[p.puesto] || ""} ${esc(PUESTOS[p.puesto] || "")}</b> · ${esc(p.concursoNombre)} · ${esc(p.delegacion || "sin delegación")}${p.lider ? ` <span class="chip chip--ambar log-tag">★ líder</span>` : ""}</td>`
        : `<td class="cert-texto">${esc(p.delegacion || "—")}</td>`;
      return `<tr class="${fuera ? "cert-fuera" : ""}"><td><input type="checkbox" data-sel="${esc(p.id)}" ${fuera ? "" : "checked"} aria-label="Incluir"></td>
        <td><b>${esc(p.nombre)}</b>${p.editado ? ` <span class="chip chip--ambar log-tag">editado</span>` : ""}${seccion === "organizadores" && !p.area ? ` <span class="chip chip--rojo log-tag">sin área</span>` : ""}</td>${col}
        <td style="white-space:nowrap"><button class="btn btn--mini" data-ver="${esc(p.id)}">${I.vivo}Vista previa</button> <button class="btn btn--mini btn--icono" data-pdf="${esc(p.id)}" title="Descargar su PDF" aria-label="Descargar su PDF">${I.descargar}</button>
          ${p.tipo === "otro" || seccion !== "invitados" ? `<button class="btn btn--mini btn--icono btn--peligro" data-borrar="${esc(p.id)}" title="Quitar de la lista" aria-label="Quitar">${I.basura}</button>` : ""}</td></tr>`;
    }

    const por = (id) => personas().find((p) => p.id === id);
    const repintar = () => pintar(v);
    $$("[data-sec]", v).forEach((b) => (b.onclick = () => { seccion = b.dataset.sec; filtro = "todos"; busca = ""; repintar(); }));
    $$("[data-f]", v).forEach((b) => (b.onclick = () => { filtro = b.dataset.f; repintar(); }));
    const buscar = $("[data-buscar]", v);
    buscar.oninput = () => { busca = sinTildes(buscar.value.trim()).toLowerCase(); repintar(); const b = $("[data-buscar]", v); b.focus(); b.setSelectionRange(b.value.length, b.value.length); };
    // Configuración de la sección
    const ponCfg = (x) => { g.config[seccion] = { ...(g.config[seccion] || {}), ...x }; guardar(); };
    $("[data-cinta]", v).onchange = (e) => { ponCfg({ cinta: e.target.value.trim() || SECCIONES[seccion].cinta }); repintar(); };
    $$("[data-cinta-rapida]", v).forEach((b) => (b.onclick = () => { ponCfg({ cinta: b.dataset.cintaRapida }); repintar(); }));
    $("[data-plantilla]", v).onchange = (e) => { ponCfg({ plantilla: e.target.value.trim() || SECCIONES[seccion].plantilla }); repintar(); };
    $("[data-restaurar-cfg]", v).onclick = () => { delete g.config[seccion]; guardar(); repintar(); aviso("Texto y cinta originales"); };
    $("[data-muestra]", v).onclick = () => { const p = el[0] || todas[0]; if (p) previa(p, v); };
    // Selección
    $$("[data-sel]", v).forEach((c) => (c.onchange = () => { if (c.checked) quitados.delete(c.dataset.sel); else quitados.add(c.dataset.sel); repintar(); }));
    $("[data-todas]", v).onchange = (e) => { lista.forEach((p) => (e.target.checked ? quitados.delete(p.id) : quitados.add(p.id))); repintar(); };
    // Filas
    $$("[data-area]", v).forEach((s) => (s.onchange = () => { const o = g.organizadores.find((x) => x.id === s.dataset.area); if (o) { o.area = s.value; guardar(); repintar(); } }));
    $$("[data-ver]", v).forEach((b) => (b.onclick = () => previa(por(b.dataset.ver), v)));
    $$("[data-pdf]", v).forEach((b) => (b.onclick = async () => { const p = por(b.dataset.pdf); b.disabled = true; try { bajar(pdfDeImagenes([await jpeg(await dibujar(p))]), archivo(p)); } catch (e) { aviso(e.message, "error"); } b.disabled = false; }));
    $$("[data-borrar]", v).forEach((b) => (b.onclick = () => {
      const id = b.dataset.borrar, [pre, oid] = [id.slice(0, 1), id.slice(2)];
      if (pre === "w") { const q = por(id); const e = (g.ganadores[q.concurso] || []).find((x) => x.id === q.wid); if (e) e.nombres = e.nombres.filter((n) => n.id !== q.nid); }
      else if (pre === "x") g.otros = g.otros.filter((o) => o.id !== id); else if (pre === "o") g.organizadores = g.organizadores.filter((o) => o.id !== oid); else g.participantes = g.participantes.filter((o) => o.id !== oid);
      delete g.editados[id]; guardar(); repintar();
    }));
    $("[data-otro]", v)?.addEventListener("click", () => formPersona(v));
    $("[data-nuevo]", v)?.addEventListener("click", () => formPersona(v));
    $("[data-importar]", v)?.addEventListener("click", () => importar(v));
    $("[data-vaciar]", v)?.addEventListener("click", async () => {
      if (!(await confirmar("¿Vaciar la lista?", `Se quitan las ${todas.length} personas de «${esc(S.txt)}» de este navegador. Puedes volver a cargar el Excel.`, { boton: "Vaciar", peligro: true }))) return;
      g[seccion] = []; Object.keys(g.editados).filter((k) => k.startsWith(seccion === "organizadores" ? "o:" : "a:")).forEach((k) => delete g.editados[k]); guardar(); repintar();
    });
    $("[data-zip]", v).onclick = () => generar(elegidos(), "zip");
    $("[data-uno]", v).onclick = () => generar(elegidos(), "uno");
    if (seccion === "ganadores") conectarGanadores(v, repintar);
  }

  // ---------- Ganadores: top 3 de cada concurso (académicos y culturales) ----------
  // g.ganadores[concurso] = [{ id, puesto: 1|2|3, delegacion: id, nombres: [{ id, n }] }]
  function editorGanadores() {
    const ds = [...ctx.data().delegaciones].sort((a, b) => (a.siglas || a.nombre).localeCompare(b.siglas || b.nombre));
    const tarjeta = (c) => {
      const es = (g.ganadores[c.id] || []).slice().sort((a, b) => a.puesto - b.puesto), np = es.reduce((x, e) => x + e.nombres.length, 0);
      return `<details class="cert-gan__c" ${es.length ? "open" : ""}><summary><b>${esc(c.nombre)}</b><span class="tenue">${es.length ? `${es.length} puesto${es.length === 1 ? "" : "s"} · ${np} persona${np === 1 ? "" : "s"}` : "sin ganadores aún"}</span></summary>
        ${es.map((e) => `<div class="cert-gan__fila" data-ge="${c.id}:${e.id}">
          <select class="mini-select" data-gp>${[1, 2, 3].map((k) => `<option value="${k}" ${k === e.puesto ? "selected" : ""}>${MEDALLA[k]} ${k}.º${es.some((x) => x !== e && x.puesto === k) ? " (cambiar)" : ""}</option>`).join("")}</select>
          <select class="mini-select" data-gd><option value="">Delegación…</option>${ds.map((d) => `<option value="${d.id}" ${d.id === e.delegacion ? "selected" : ""}>${esc(d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre)}</option>`).join("")}</select>
          <div class="cert-gan__nombres">${e.nombres.map((n) => `<span class="cert-gan__n ${n.lider ? "cert-gan__n--lider" : ""}"><button class="cert-gan__estrella" data-gl="${n.id}" title="${n.lider ? "Líder del equipo (clic para quitar)" : "Marcar como líder del equipo"}" aria-label="Líder del equipo">${n.lider ? "★" : "☆"}</button><input data-gn="${n.id}" value="${esc(n.n)}" aria-label="Nombre"><button class="btn btn--mini btn--icono" data-gx="${n.id}" title="Quitar a esta persona" aria-label="Quitar">×</button></span>`).join("")}
            <input class="cert-gan__nuevo" data-gadd placeholder="+ Nombre y apellidos (Enter)"></div>
          <button class="btn btn--mini btn--icono btn--peligro" data-gdel title="Quitar este puesto" aria-label="Quitar puesto">${I.basura}</button></div>`).join("")}
        ${es.length < 3 ? `<button class="btn btn--mini" data-gnuevo="${c.id}">${I.mas}Agregar ${es.length ? "puesto" : "1.er puesto"}</button>` : `<p class="ayuda" style="margin:4px 0 0">✓ Top 3 completo (1.º, 2.º y 3.º).</p>`}</details>`;
    };
    return `<section class="tarjeta cert-gan">
      <div class="cert-gan__cab"><div><h3>Ganadores por concurso</h3><p class="ayuda" style="margin:0">Por cada puesto elige la delegación y escribe a sus integrantes: cada uno recibe su certificado de reconocimiento. Con «Traer top 3» se llenan los puestos y las delegaciones desde Resultados.</p></div>
        <button class="btn btn--naranja" data-traer-top>${I.copa}Traer top 3 de Resultados</button></div>
      <h4 class="cob-grupo">Académicos</h4><div class="cert-gan__grid">${CONCURSOS.filter((c) => c.tipo === "academico").map(tarjeta).join("")}</div>
      <h4 class="cob-grupo">Culturales</h4><div class="cert-gan__grid">${CONCURSOS.filter((c) => c.tipo === "cultural").map(tarjeta).join("")}</div>
    </section>`;
  }
  function conectarGanadores(v, repintar) {
    const entrada = (el) => { const [cid, eid] = el.closest("[data-ge]").dataset.ge.split(":"); return (g.ganadores[cid] || []).find((e) => e.id === eid); };
    const listo = () => { guardar(); repintar(); };
    // Cambiar a un puesto ocupado intercambia los dos (siempre queda 1.º, 2.º y 3.º sin repetir)
    $$("[data-gp]", v).forEach((s) => (s.onchange = () => { const e = entrada(s), [cid] = s.closest("[data-ge]").dataset.ge.split(":"), k = Number(s.value);
      const otro = (g.ganadores[cid] || []).find((x) => x !== e && x.puesto === k); if (otro) otro.puesto = e.puesto; e.puesto = k; listo(); }));
    $$("[data-gl]", v).forEach((b) => (b.onclick = () => { const e = entrada(b), n = e.nombres.find((x) => x.id === b.dataset.gl); const era = n.lider; e.nombres.forEach((x) => (x.lider = false)); n.lider = !era; listo(); }));
    $$("[data-gd]", v).forEach((s) => (s.onchange = () => { entrada(s).delegacion = s.value; listo(); }));
    $$("[data-gn]", v).forEach((i) => (i.onchange = () => { const n = entrada(i).nombres.find((x) => x.id === i.dataset.gn); const t = i.value.trim(); if (t) n.n = t; else entrada(i).nombres = entrada(i).nombres.filter((x) => x !== n); listo(); }));
    $$("[data-gx]", v).forEach((b) => (b.onclick = () => { const e = entrada(b); e.nombres = e.nombres.filter((x) => x.id !== b.dataset.gx); listo(); }));
    $$("[data-gadd]", v).forEach((i) => (i.onkeydown = (ev) => {
      if (ev.key !== "Enter") return; ev.preventDefault(); const t = i.value.trim(); if (t.length < 2) return;
      const key = i.closest("[data-ge]").dataset.ge; entrada(i).nombres.push({ id: uid(), n: t === t.toUpperCase() ? nombrePropio(t) : t }); guardar(); repintar();
      $(`[data-ge="${key}"] [data-gadd]`, v)?.focus();
    }));
    $$("[data-gdel]", v).forEach((b) => (b.onclick = async () => { const e = entrada(b), [cid] = b.closest("[data-ge]").dataset.ge.split(":");
      if (e.nombres.length && !(await confirmar("¿Quitar este puesto?", `Se quitan también ${e.nombres.length} nombre${e.nombres.length === 1 ? "" : "s"}.`, { boton: "Quitar", peligro: true }))) return;
      g.ganadores[cid] = g.ganadores[cid].filter((x) => x !== e); listo(); }));
    $$("[data-gnuevo]", v).forEach((b) => (b.onclick = () => { const l = (g.ganadores[b.dataset.gnuevo] ||= []); if (l.length >= 3) return aviso("Solo hay 1.º, 2.º y 3.er lugar", "error");
      const usados = l.map((e) => e.puesto); l.push({ id: uid(), puesto: [1, 2, 3].find((k) => !usados.includes(k)), delegacion: "", nombres: [] }); listo(); }));
    $("[data-traer-top]", v).onclick = async () => {
      const data = ctx.data(), top = {};
      for (const c of CONCURSOS) { try { top[c.id] = resultados(c.id, data).filter((f) => f.puesto && f.puesto <= 3).slice(0, 3).map((f, k) => ({ puesto: k + 1, delegacion: f.delegacion.id, empate: f.puesto !== k + 1 })); } catch { top[c.id] = []; } }
      const empates = CONCURSOS.filter((c) => top[c.id].some((t) => t.empate)).map((c) => c.nombre);
      const n = Object.values(top).reduce((x, l) => x + l.length, 0);
      if (!n) return aviso("Aún no hay resultados con puestos en los concursos", "error");
      if (!(await confirmar("¿Traer el top 3 de Resultados?", `Se ponen los puestos y las delegaciones según los resultados actuales (${n} puestos). Los nombres que ya escribiste se conservan si su delegación sigue en el top 3.${empates.length ? `<br><br><b>Hay empate en ${esc(unir(empates))}:</b> se ordenan como salen en Resultados; revisa los puestos.` : ""}`, { boton: "Traer top 3" }))) return;
      for (const c of CONCURSOS) {
        if (!top[c.id].length) continue;
        const antes = g.ganadores[c.id] || [];
        g.ganadores[c.id] = top[c.id].map((t) => { const e = antes.find((x) => x.delegacion === t.delegacion); return { id: e?.id || uid(), puesto: t.puesto, delegacion: t.delegacion, nombres: e?.nombres || [] }; });
      }
      listo(); aviso("Top 3 traído: ahora escribe a los integrantes de cada puesto");
    };
  }

  function importar(v) {
    const org = seccion === "organizadores";
    importarExcel({
      titulo: org ? "Cargar voluntarios del equipo organizador" : "Cargar participantes inscritos",
      ayuda: org ? "Excel con <b>nombres</b>, <b>apellido paterno</b> y <b>apellido materno</b> (o el nombre completo en una columna) y, si lo tienes, el <b>área</b> (DP, PMO, Ventas, RRPP, Marketing, Logística o TI). Si no trae el área, la eliges después en la lista."
        : "El mismo Excel de inscritos que usas en Charlas (por ejemplo, la hoja CONFIRMADOS). Toma los <b>nombres</b>, el <b>apellido paterno</b> y el <b>apellido materno</b> (o el nombre completo) y, si quieres, la <b>delegación</b> o universidad.",
      campos: [
        { id: "nombre", txt: "Nombre(s) o nombre completo", claves: /^(nombres?|nombre completo|nombres y apellidos|apellidos y nombres|participante|voluntario|integrante)\b/, requerido: true, nombre: true },
        { id: "apellido", txt: "Apellido paterno (o los dos apellidos)", claves: /^(apellido paterno|ap\.? ?paterno|ap\.? ?pat\b|primer apellido|apellidos?$)/, nombre: true },
        { id: "materno", txt: "Apellido materno", claves: /^(apellido materno|ap\.? ?materno|ap\.? ?mat\b|segundo apellido)/, nombre: true },
        org ? { id: "area", txt: "Área", claves: /^(area|área|cargo|equipo|comite|comité)\b/ } : { id: "delegacion", txt: "Delegación o universidad", claves: /^(delegacion|universidad|institucion|casa de estudios|siglas)\b/ },
      ],
      alImportar: (filas, reemplazar) => {
        const lista = filas.map((f) => ({ id: uid(), nombre: f.nombre, apellido: f.apellido || "", materno: f.materno || "", ...(org ? { area: areaDe(f.area) } : { delegacion: f.delegacion || "" }) }));
        if (reemplazar) { g[seccion] = lista; Object.keys(g.editados).filter((k) => k.startsWith(org ? "o:" : "a:")).forEach((k) => delete g.editados[k]); }
        else g[seccion].push(...lista);
        guardar(); quitados.clear(); pintar(v); aviso(`${lista.length} persona${lista.length === 1 ? "" : "s"} cargada${lista.length === 1 ? "" : "s"}`);
      },
    });
  }
  // «Relaciones Públicas», «rrpp», «R.R.P.P.» → «RRPP»…
  function areaDe(t) {
    const x = sinTildes(String(t || "")).toLowerCase().replace(/[^a-z]/g, "");
    if (!x) return "";
    if (/^(dp|direcc|director)/.test(x)) return "DP";
    if (/pmo/.test(x)) return "PMO";
    if (/venta|comercial/.test(x)) return "Ventas";
    if (/rrpp|relacion|rpp/.test(x)) return "RRPP";
    if (/marketing|mkt|publicidad/.test(x)) return "Marketing";
    if (/logist/.test(x)) return "Logistica";
    if (/^ti$|tecnolog|sistemas|^it$/.test(x)) return "TI";
    return "";
  }

  function formPersona(v) {
    const inv = seccion === "invitados", org = seccion === "organizadores";
    const m = modal(`<h2>${inv ? "Agregar persona" : org ? "Agregar voluntario" : "Agregar participante"}</h2><form class="form">
      <label class="campo"><span>${inv ? "Nombre completo" : "Nombre(s)"}</span><input name="nombre" maxlength="80" required placeholder="Ej. María"></label>
      ${inv ? `<label class="campo"><span>Su participación fue «como…»</span><input name="rol" maxlength="120" placeholder="Ej. auspiciador oficial"></label>`
        : `<div class="cert-map" style="margin:0"><label class="campo"><span>Apellido paterno</span><input name="apellido" maxlength="60" placeholder="Ej. López"></label>
           <label class="campo"><span>Apellido materno</span><input name="materno" maxlength="60" placeholder="Ej. Torres"></label></div>
           ${org ? `<label class="campo"><span>Área</span><select name="area"><option value="">Elige…</option>${AREAS_ORG.map((a) => `<option value="${a.id}">${a.corto ? esc(a.corto) : `${a.id} · ${esc(a.txt)}`}</option>`).join("")}</select></label>`
             : `<label class="campo"><span>Delegación o universidad (opcional)</span><input name="delegacion" maxlength="120"></label>`}`}
      <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Agregar</button></div></form>`);
    const f = $("form", m.el); $("[data-cancelar]", m.el).onclick = m.cerrar;
    f.onsubmit = (e) => {
      e.preventDefault(); const nombre = f.nombre.value.trim(); if (nombre.length < 2) return;
      if (inv) g.otros.push({ id: `x:${uid()}`, nombre, rol: f.rol.value.trim() });
      else g[seccion].push({ id: uid(), nombre, apellido: f.apellido.value.trim(), materno: f.materno.value.trim(), ...(org ? { area: f.area.value } : { delegacion: f.delegacion.value.trim() }) });
      guardar(); m.cerrar(); if (inv) filtro = "otro"; pintar(v); aviso("Agregado");
    };
  }

  function previa(p, v) {
    const m = modal(`<h2>Vista previa · ${esc(SECCIONES[p.seccion].txt)}</h2>
      <div class="cert-previa"><canvas data-lienzo></canvas></div>
      <form class="form" style="margin-top:12px">
        <label class="campo"><span>Nombre en el certificado</span><input name="nombre" maxlength="80" value="${esc(p.nombre)}"></label>
        <label class="campo"><span>Texto (solo para esta persona)</span><textarea name="texto" rows="4" maxlength="700">${esc(p.texto)}</textarea></label>
        <div class="modal__acciones" style="margin-top:0">${p.editado ? `<button type="button" class="btn" data-restaurar style="margin-right:auto">${I.girar}Volver al texto automático</button>` : ""}
          <button type="button" class="btn" data-cerrar>Cerrar</button><button type="button" class="btn" data-guardar>${I.check}Guardar cambios</button><button type="button" class="btn btn--naranja" data-pdf>${I.descargar}Descargar PDF</button></div></form>`, { ancho: true });
    const f = $("form", m.el), cv = $("[data-lienzo]", m.el);
    const actual = () => ({ ...p, nombre: f.nombre.value.trim() || p.nombre, texto: f.texto.value.trim() || p.texto });
    let t = null; const redibujar = () => { clearTimeout(t); t = setTimeout(() => dibujar(actual(), cv).catch((e) => aviso(e.message, "error")), 150); };
    f.nombre.oninput = redibujar; f.texto.oninput = redibujar; dibujar(actual(), cv).catch((e) => aviso(e.message, "error"));
    $("[data-cerrar]", m.el).onclick = m.cerrar;
    $("[data-guardar]", m.el).onclick = () => {
      const a = actual(); delete g.editados[p.id];
      const auto = personas(p.seccion).find((x) => x.id === p.id) || p; // sin cambios guardados = texto automático
      const e = {}; if (a.nombre !== auto.nombre) e.nombre = a.nombre; if (a.texto !== auto.texto) e.texto = a.texto;
      if (Object.keys(e).length) g.editados[p.id] = e; guardar(); m.cerrar(); pintar(v); aviso("Cambios guardados");
    };
    $("[data-restaurar]", m.el)?.addEventListener("click", () => { delete g.editados[p.id]; guardar(); m.cerrar(); pintar(v); aviso("Texto automático"); });
    $("[data-pdf]", m.el).onclick = async () => { try { bajar(pdfDeImagenes([await jpeg(await dibujar(actual()))]), archivo(actual())); } catch (e) { aviso(e.message, "error"); } };
  }

  async function generar(lista, modo) {
    if (!lista.length) return;
    const sinArea = seccion === "organizadores" ? lista.filter((p) => !p.area).length : 0;
    if (sinArea && !(await confirmar("Hay voluntarios sin área", `${sinArea} de ${lista.length} no tienen área: su texto saldrá sin ella. ¿Generar igual?`, { boton: "Generar igual" }))) return;
    const m = modal(`<h2>Generando certificados</h2><p data-prog>Preparando…</p><div class="progreso"><i data-barra style="width:0%"></i></div>`);
    try {
      const cv = document.createElement("canvas"), hojas = [];
      for (let i = 0; i < lista.length; i++) {
        $("[data-prog]", m.el).textContent = `${i + 1} de ${lista.length} · ${lista[i].nombre}`; $("[data-barra]", m.el).style.width = `${((i + 1) / lista.length) * 100}%`;
        hojas.push({ p: lista[i], img: await jpeg(await dibujar(lista[i], cv)) });
        await new Promise((r) => setTimeout(r, 0));
      }
      const S = SECCIONES[seccion];
      if (modo === "uno") bajar(pdfDeImagenes(hojas.map((h) => h.img)), `Certificados ${S.carpeta} VI CONCEPMI 2026 (${lista.length}).pdf`);
      else {
        const JSZip = await cargarJSZip(), zip = new JSZip(), usados = new Set();
        for (const h of hojas) {
          const sub = seccion === "ganadores" ? `${sinTildes(h.p.concursoNombre)}/Puesto ${h.p.puesto}/` : seccion === "invitados" ? `${TIPOS_INV[h.p.tipo]}s/` : seccion === "organizadores" && h.p.area ? `${sinTildes(areaTxt(h.p.area))}/` : "";
          let n = `${S.carpeta}/${sub}${archivo(h.p)}`; for (let k = 2; usados.has(n); k++) n = `${S.carpeta}/${sub}${archivo(h.p).replace(/\.pdf$/, ` (${k}).pdf`)}`;
          usados.add(n); zip.file(n, pdfDeImagenes([h.img]));
        }
        $("[data-prog]", m.el).textContent = "Comprimiendo…";
        bajar(await zip.generateAsync({ type: "blob" }), `Certificados ${S.carpeta} VI CONCEPMI 2026.zip`);
      }
      m.cerrar(); aviso(`${lista.length} certificado${lista.length === 1 ? "" : "s"} listo${lista.length === 1 ? "" : "s"}`);
    } catch (e) { m.cerrar(); aviso(e.message, "error"); }
  }

  return { vista };
}

// =========================================================
// Pestaña PONENTES del admin: crea a los ponentes de las 3 charlas magistrales (nombre, foto,
// descripción, charla, código), ve qué archivos subieron y proyecta la ponencia en el auditorio
// con la misma pantalla del Concurso de Proyectos (PDF dentro, puntero, cronómetro).
// Permiso: el de la pestaña Charlas (ver / editar).
// =========================================================
import { api } from "./api.js?v=202611051441";
import { CHARLAS } from "./charlas.js?v=202611051441";
import { abrirSalaProyectos } from "./sala-proyectos.js?v=202611051441";
import { quitarArchivos } from "./presentacion.js?v=202611051441";
import { htmlArchivos, conectarArchivos, abrirPonencia } from "./ponente.js?v=202611051441";
import { $, $$, esc, I, aviso, modal, confirmar, avatar } from "./ui.js?v=202611051441";

const charlaDe = (id) => CHARLAS.find((c) => c.id === id);
function reducirFoto(file) {
  return new Promise((res, rej) => {
    const img = new Image(), url = URL.createObjectURL(file);
    img.onload = () => { const lado = 320, s = Math.min(img.width, img.height), cv = document.createElement("canvas"); cv.width = cv.height = lado;
      cv.getContext("2d").drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, lado, lado); URL.revokeObjectURL(url); res(cv.toDataURL("image/jpeg", 0.82)); };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

// Elementos para la pantalla del auditorio: una charla = un «turno»
export function itemsCharlas(ponentes) {
  return CHARLAS.map((c) => {
    const o = ponentes.find((x) => x.charlas.includes(c.id));
    return { charla: c, equipo_id: o?.id || `sin-${c.id}`, delegacion: { siglas: o?.nombre || c.ponente, nombre: `Charla magistral ${c.num} · ${c.nombre}` },
      proyecto: o?.titulo || "", foto: o?.foto || "", pres: o ? { pdf: o.pdf, ppt: o.ppt, video: o.video } : {}, videoDespues: o?.video_despues || "",
      minutos: { exp: c.minPonencia || 45, preg: c.minPreguntas || 10 } };
  });
}
export function proyectarCharlas(codigo, ponentes, inicial = null) {
  const items = itemsCharlas(ponentes);
  abrirSalaProyectos({ equipos: items, concurso: "Charlas magistrales", inicial, clase: "sala--ponencias",
    url: (id, tipo) => api.ponenciaUrl(codigo, id, tipo), abrir: (id, tipo) => abrirPonencia(codigo, id, tipo),
    textos: { orden: "VI CONCEPMI 2026 · Programa de charlas", exp: "Ponencia", preg: "Preguntas del público", btnExp: "Ponencia", btnPreg: "Preguntas",
      corto: (k) => `Charla ${items[k].charla.num}`, num: (k) => items[k].charla.num, detalle: (k) => `${items[k].charla.dia} · ${items[k].charla.hora}`,
      portada: (k) => `Charla magistral <b>${items[k].charla.num}</b> · ${esc(items[k].charla.hora)}`, cab: (k) => `Charla ${items[k].charla.num} · ${items[k].charla.nombre}` } });
}

export function crearPonentes(ctx) {
  let lista = null;
  const cargar = async () => { lista = await api.adminPonentes(ctx.codigo()); };
  async function vista(v) {
    if (!lista) { v.innerHTML = `<div class="cargando" style="min-height:160px"><div class="giro"></div></div>`; try { await cargar(); } catch (e) { lista = []; aviso(e.message, "error"); } }
    pintar(v);
  }
  const listos = (o) => ["pdf", "ppt", "video"].filter((t) => o[t]);
  function pintar(v) {
    const sin = CHARLAS.filter((c) => !lista.some((o) => o.charlas.includes(c.id)));
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Ponentes</h1><p>Crea a los ponentes de las ${CHARLAS.length} charlas magistrales. Cada uno entra con <b>su código</b> por la puerta <b>Ponente</b> de la portada y sube su presentación (<b>PDF</b> que se proyecta, PPT de respaldo y video opcional). Luego la proyectas aquí, con el logo del evento y un cronómetro discreto, y el ponente avanza con el puntero.</p></div>
        <button class="btn btn--naranja" data-proyectar ${lista.length ? "" : "disabled"}>${I.vivo}Proyectar charla (auditorio)</button></div>
      <div class="jur-layout"><div class="jurados">
        <button class="crear" data-crear>${I.mas}<span>Agregar ponente</span></button>
        ${lista.map((o) => `<article class="jurado">
          <div class="jurado__cab">${avatar(o.nombre, o.foto)}<div><h4>${esc(o.nombre)}</h4><p>${o.titulo ? `«${esc(o.titulo)}»` : "Sin título de ponencia"}</p></div></div>
          ${o.descripcion ? `<p>${esc(o.descripcion)}</p>` : ""}
          <div class="jurado__chips">${o.charlas.map((id) => `<span class="chip">Charla ${esc(charlaDe(id)?.num || id)} · ${esc(charlaDe(id)?.nombre || "")}</span>`).join("")}</div>
          <div class="jurado__chips">${["pdf", "ppt", "video"].map((t) => `<span class="chip ${o[t] ? "chip--verde" : t === "video" ? "" : "chip--ambar"}">${t === "video" ? "Video" : t.toUpperCase()} ${o[t] ? "✓" : t === "video" ? "—" : "pendiente"}</span>`).join("")}</div>
          ${o.codigo ? `<div class="jurado__codigo"><code>${esc(o.codigo)}</code><button class="btn btn--mini btn--icono" data-copiar="${esc(o.codigo)}" title="Copiar código" aria-label="Copiar código">${I.copiar}</button></div>` : ""}
          <div class="jurado__acc">
            <button class="btn btn--mini btn--naranja" data-proy="${o.id}">${I.vivo}Proyectar</button>
            <button class="btn btn--mini" data-archivos="${o.id}">${I.descargar}Archivos (${listos(o).length})</button>
            <button class="btn btn--mini" data-editar="${o.id}">${I.lapiz}Editar</button>
            <button class="btn btn--mini" data-regen="${o.id}">${I.girar}Nuevo código</button>
            <button class="btn btn--mini btn--peligro" data-quitar="${o.id}">${I.basura}Eliminar</button>
          </div></article>`).join("")}
      </div>
      <aside class="cob-panel" aria-label="Ponentes por charla">
        <div class="cob-resumen ${sin.length ? "" : "cob-resumen--ok"}"><b>${sin.length || "✓"}</b><span>${sin.length ? `charla${sin.length === 1 ? "" : "s"} sin ponente` : "Todas las charlas tienen ponente"}</span><small>${CHARLAS.length - sin.length} de ${CHARLAS.length} charlas · ${lista.filter((o) => o.pdf).length} PDF listo${lista.filter((o) => o.pdf).length === 1 ? "" : "s"}</small></div>
        <h4 class="cob-grupo">Charlas magistrales</h4>
        ${CHARLAS.map((c) => { const o = lista.find((x) => x.charlas.includes(c.id)); return `<div class="cob ${o ? "cob--ok" : "cob--falta"}">
          <div class="cob__cab"><b>Charla ${c.num} · ${esc(c.nombre)}</b><div class="cob__estado">${o ? `<span class="cob__num cob__num--ok">✓</span><span>${o.pdf ? "PDF listo" : "sin PDF"}</span>` : `<span class="cob__num cob__num--falta">1</span><span>falta</span>`}</div></div>
          <div class="cob__barra"><i style="width:${o ? (o.pdf ? 100 : 50) : 0}%"></i></div>
          <p>${esc(c.dia)} · ${esc(c.hora)}${o ? ` · ${esc(o.nombre)}` : ""}</p></div>`; }).join("")}
      </aside></div>`;
    const por = (id) => lista.find((o) => o.id === id);
    $("[data-crear]", v).onclick = () => form(null, v);
    $("[data-proyectar]", v).onclick = () => proyectarCharlas(ctx.codigo(), lista);
    $$("[data-proy]", v).forEach((b) => (b.onclick = () => { const o = por(b.dataset.proy), k = CHARLAS.findIndex((c) => o.charlas.includes(c.id)); proyectarCharlas(ctx.codigo(), lista, Math.max(k, 0)); }));
    $$("[data-editar]", v).forEach((b) => (b.onclick = () => form(por(b.dataset.editar), v)));
    $$("[data-archivos]", v).forEach((b) => (b.onclick = () => archivos(por(b.dataset.archivos), v)));
    $$("[data-copiar]", v).forEach((b) => (b.onclick = async () => { try { await navigator.clipboard.writeText(b.dataset.copiar); aviso("Código copiado"); } catch { aviso(`Código: ${b.dataset.copiar}`); } }));
    $$("[data-regen]", v).forEach((b) => (b.onclick = async () => { const o = por(b.dataset.regen);
      if (!(await confirmar("¿Generar un código nuevo?", `El código actual de <b>${esc(o.nombre)}</b> dejará de funcionar. Sus archivos se conservan.`, { boton: "Generar nuevo código" }))) return;
      try { const r = await api.adminPonente(ctx.codigo(), { ...o, foto: null, nuevoCodigo: true }); await cargar(); pintar(v); aviso(`Nuevo código: ${r.codigo}`); } catch (e) { aviso(e.message, "error"); } }));
    $$("[data-quitar]", v).forEach((b) => (b.onclick = async () => { const o = por(b.dataset.quitar);
      if (!(await confirmar("¿Eliminar este ponente?", `Se borrará <b>${esc(o.nombre)}</b> y su código dejará de funcionar.`, { boton: "Eliminar ponente", peligro: true }))) return;
      try { await api.adminPonente(ctx.codigo(), { id: o.id, borrar: true }); await cargar(); pintar(v); aviso("Ponente eliminado"); } catch (e) { aviso(e.message, "error"); } }));
  }

  function archivos(o, v) {
    const m = modal(`<h2>Archivos de ${esc(o.nombre)}</h2><p class="ayuda" style="margin-top:0">Normalmente los sube el ponente con su código. Si te los envió por correo, puedes subirlos tú aquí.</p><div data-caja>${htmlArchivos(o, { videoDespues: false })}</div>
      <div class="modal__acciones"><button class="btn btn--peligro" data-quitar-arch style="margin-right:auto" ${o.pdf || o.ppt || o.video ? "" : "hidden"}>${I.basura}Quitar archivos</button><button class="btn" data-cerrar>Cerrar</button></div>`, { ancho: true });
    const caja = $("[data-caja]", m.el);
    $("[data-quitar-arch]", m.el).onclick = () => quitarArchivos({ titulo: o.nombre, archivos: o, quitar: (tipos) => api.ponenciaQuitar(ctx.codigo(), o.id, tipos),
      nota: "El ponente y su código se conservan; podrá volver a subirlos.", listo: async () => { await cargar(); o = lista.find((x) => x.id === o.id) || o; caja.innerHTML = htmlArchivos(o, { videoDespues: false }); enlazar();
        $("[data-quitar-arch]", m.el).hidden = !(o.pdf || o.ppt || o.video); pintar(v); } });
    const enlazar = () => conectarArchivos(caja, { subir: (tipo, f, p) => api.ponenciaSubir(ctx.codigo(), tipo, f, p, o.id), ver: (tipo) => abrirPonencia(ctx.codigo(), o.id, tipo),
      listo: async () => { await cargar(); o = lista.find((x) => x.id === o.id) || o; caja.innerHTML = htmlArchivos(o, { videoDespues: false }); enlazar();
        $("[data-quitar-arch]", m.el).hidden = !(o.pdf || o.ppt || o.video); pintar(v); } });
    enlazar();
    $("[data-cerrar]", m.el).onclick = m.cerrar;
  }

  function form(o, v) {
    let foto = null;
    const m = modal(`<h2>${o ? "Editar ponente" : "Nuevo ponente"}</h2><form class="form">
      <div class="foto-sel"><span data-prev>${avatar(o?.nombre || "?", o?.foto)}</span>
        <div style="display:grid;gap:6px"><label class="btn btn--mini" style="cursor:pointer">${I.camara}Subir foto<input type="file" accept="image/*" hidden name="foto"></label><p class="ayuda">JPG o PNG. Sale en la portada de su charla.</p></div></div>
      <label class="campo"><span>Nombre completo</span><input name="nombre" maxlength="120" required value="${esc(o?.nombre || "")}" placeholder="Ej. Ing. Alexis Rodríguez"></label>
      <label class="campo"><span>Descripción breve (opcional)</span><textarea name="desc" rows="2" maxlength="400" placeholder="Ej. PMP, gerente de proyectos en…">${esc(o?.descripcion || "")}</textarea></label>
      <fieldset class="campo"><span>Charla(s)</span><div class="reparto" style="margin:4px 0 0">${CHARLAS.map((c) => `<label class="chip" style="cursor:pointer"><input type="checkbox" name="ch" value="${c.id}" ${o?.charlas.includes(c.id) || (!o && !lista.some((x) => x.charlas.includes(c.id)) && c.id === CHARLAS.find((y) => !lista.some((x) => x.charlas.includes(y.id)))?.id) ? "checked" : ""}> Charla ${c.num} · ${esc(c.nombre)}</label>`).join("")}</div></fieldset>
      <label class="campo"><span>Título de la ponencia (opcional; el ponente también lo puede escribir)</span><input name="titulo" maxlength="160" value="${esc(o?.titulo || "")}"></label>
      <label class="campo"><span>Código de acceso ${o ? "" : "(opcional)"}</span><input name="cod" maxlength="16" autocomplete="off" value="${esc(o?.codigo || "")}" placeholder="Vacío = se genera uno automático" style="font-family:var(--neon);letter-spacing:.15em;text-transform:uppercase"></label>
      <p class="error"></p>
      <div class="modal__acciones" style="margin-top:0"><button type="button" class="btn" data-cancelar>Cancelar</button><button class="btn btn--naranja">${I.check}Guardar</button></div></form>`, { ancho: true });
    const f = $("form", m.el);
    $("[data-cancelar]", m.el).onclick = m.cerrar;
    f.foto.onchange = async () => { const a = f.foto.files?.[0]; if (!a) return; try { foto = await reducirFoto(a); $("[data-prev]", m.el).innerHTML = avatar("", foto); } catch (e) { aviso(e.message, "error"); } };
    f.onsubmit = async (ev) => {
      ev.preventDefault();
      const cod = f.cod.value.replace(/\s/g, "").toUpperCase();
      try {
        const r = await api.adminPonente(ctx.codigo(), { id: o?.id || null, nombre: f.nombre.value, descripcion: f.desc.value, charlas: $$("[name=ch]", f).filter((x) => x.checked).map((x) => x.value),
          foto, titulo: f.titulo.value, codigoFijo: cod && cod !== o?.codigo ? cod : null });
        m.cerrar(); await cargar(); pintar(v); aviso(o ? "Ponente actualizado" : `Ponente creado · código ${r.codigo}`);
      } catch (ex) { $(".error", f).textContent = ex.message; }
    };
  }
  return { vista, lista: async () => { if (!lista) await cargar(); return lista; } };
}

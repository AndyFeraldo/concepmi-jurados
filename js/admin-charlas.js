// =========================================================
// Admin · Charlas principales: trivia, pantalla del auditorio,
// inscritos (Excel de inscripción) y preguntas (Excel)
// =========================================================
import { api } from "./api.js?v=202610280251";
import { CHARLAS, charlaPorId, PUNTOS_CHARLA, enlaceCharla } from "./charlas.js?v=202610280251";
import { $, $$, esc, I, IMG, aviso, modal, confirmar, lanzarConfeti } from "./ui.js?v=202610280251";

const COLORES = ["rojo", "azul", "oro", "verde"];
const FORMAS = ["▲", "◆", "●", "■"];
const LETRAS = ["A", "B", "C", "D"];
const sinTildes = (s) => String(s ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const FASE_TXT = { espera: ["Sala de espera", "chip--celeste"], cuenta: ["Empezando…", "chip--ambar"], jugando: ["En juego", "chip--ambar"], terminada: ["Terminada", "chip--verde"] };

// ctx = { codigo(): string, data(): datos del admin, recargar(forzar), pausar(bool) }
export function crearCharlas(ctx) {
  const del = (id) => ctx.data().delegaciones.find((d) => d.id === id);
  const nomDel = (id) => del(id)?.siglas || del(id)?.nombre || "—";
  const resumen = (id) => ctx.data().charlas?.find((c) => c.id === id) || {};

  // ---------------- Pestaña ----------------
  function vista(v) {
    const as = ctx.data().asistentes || { total: 0, sin_delegacion: 0 };
    v.innerHTML = `
      <div class="cabeza" style="margin-top:0"><div><h1>Charlas principales</h1><p>Al terminar cada charla, proyecta la pantalla del auditorio: los asistentes escanean el QR, entran con su DNI y juegan la trivia (20 s por pregunta). Al confirmar al ganador, su delegación suma <b>${PUNTOS_CHARLA} pts</b> en la Copa.</p></div></div>
      <div class="charlas">${CHARLAS.map((c) => {
        const r = resumen(c.id); const [txt, cls] = FASE_TXT[r.fase || "espera"];
        return `<article class="concurso concurso--info c-${c.color}">
          <span class="concurso__tipo">Charla Principal ${c.num} · ${esc(c.dia)} · ${esc(c.hora)}</span>
          <h3>${esc(c.nombre)}</h3>
          <p class="concurso__apodo">${esc(c.ponente)} · ${c.pilares.map(esc).join(" · ")}</p>
          <div class="jurado__chips" style="margin-top:8px"><span class="chip ${cls}">${txt}</span><span class="chip">${r.preguntas || 0} preguntas</span><span class="chip">${r.jugadores || 0} en la sala</span></div>
          ${r.confirmado ? `<p style="margin:10px 0 0"><span class="chip chip--verde">${I.copa}Ganador: ${esc(r.ganador_nombre)} · +${PUNTOS_CHARLA} ${esc(nomDel(r.ganador_delegacion))}</span></p>` : ""}
          <div class="charla__acc">
            <button class="btn btn--mini btn--naranja" data-proy="${c.id}">${I.vivo}Pantalla del auditorio</button>
            <button class="btn btn--mini" data-preg="${c.id}">${I.lapiz}Preguntas</button>
            <button class="btn btn--mini" data-enlace="${c.id}">${I.copiar}Copiar enlace</button>
          </div></article>`; }).join("")}</div>
      <div class="cabeza"><div><h1>Inscritos</h1><p>Lista para que los asistentes entren con su DNI. Sube el Excel de inscripción (hoja <b>CONFIRMADOS</b>). Si llegan más inscritos, vuelve a subirlo: se actualiza sin duplicar.</p></div></div>
      <div class="kpis">
        <div class="kpi"><b>${as.total}</b><span>Inscritos cargados</span></div>
        <div class="kpi"><b>${as.total - as.sin_delegacion}</b><span>Con delegación</span></div>
        <div class="kpi"><b style="${as.sin_delegacion ? "color:#FFD98A" : ""}">${as.sin_delegacion}</b><span>Sin delegación (no pueden jugar)</span></div>
      </div>
      <div style="margin-top:14px"><button class="btn btn--naranja" data-inscritos>${I.descargar}Importar inscritos (Excel)</button></div>`;
    $$("[data-proy]", v).forEach((b) => (b.onclick = () => proyector(b.dataset.proy)));
    $$("[data-preg]", v).forEach((b) => (b.onclick = () => preguntas(b.dataset.preg)));
    $$("[data-enlace]", v).forEach((b) => (b.onclick = async () => {
      const url = enlaceCharla(b.dataset.enlace);
      try { await navigator.clipboard.writeText(url); aviso("Enlace copiado"); } catch { aviso(url); }
    }));
    $("[data-inscritos]", v).onclick = importarInscritos;
  }

  // ---------------- Pantalla del auditorio ----------------
  function proyector(cid) {
    const c = charlaPorId(cid);
    const el = document.createElement("div");
    el.className = "proy";
    document.body.append(el);
    ctx.pausar(true);
    let q = null, desfase = 0, ultima = "", revelado = 0, vivo = true, ocupado = false;
    const ahora = () => Date.now() + desfase;
    const cerrar = () => { vivo = false; clearInterval(tic); el.remove(); ctx.pausar(false); ctx.recargar(true); };

    async function leer() {
      try { const t0 = Date.now(); q = await api.adminQuiz(ctx.codigo(), cid); desfase = Date.parse(q.ahora) - (t0 + Date.now()) / 2; }
      catch (e) { aviso(e.message, "error"); }
    }
    const fase = () => {
      if (!q || q.fase === "espera") return "espera";
      const ini = Date.parse(q.inicio), fin = ini + q.preguntas.length * q.seg * 1000;
      return ahora() < ini ? "cuenta" : ahora() >= fin ? "terminada" : "jugando";
    };

    function cuerpo(html, clave) {
      if (clave === ultima) return false;
      ultima = clave;
      el.innerHTML = `
        <header class="proy__cab"><img class="logo" src="${IMG.logo}" alt="CONCEPMI">
          <div><div class="proy__tit">Charla Principal ${c.num} · ${esc(c.nombre)}</div><div class="proy__sub">${esc(c.ponente)} · El 1.er lugar gana ${PUNTOS_CHARLA} pts para su delegación</div></div>
          <div class="der"><button class="btn btn--mini" data-cerrarproy title="Cerrar pantalla">${I.cerrar}<span>Cerrar</span></button></div></header>
        <main class="proy__cuerpo">${html}</main>`;
      $("[data-cerrarproy]", el).onclick = cerrar;
      return true;
    }

    function pintar() {
      if (!q) return;
      const f = fase();
      if (f === "espera") {
        const nombres = q.ranking.map((r) => r.nombre.split(" ")[0]);
        if (cuerpo(`
          <div class="proy__espera">
            <div class="proy__qr" data-qr></div>
            <div style="display:grid;gap:16px">
              <p class="proy__grande">¡Escanea y juega!</p>
              <p style="margin:0;font-size:1.2rem;color:var(--niebla)">Entra con tu DNI y espera en la sala. ${q.preguntas.length} preguntas · ${q.seg} segundos cada una.</p>
              <div class="proy__url">${esc(enlaceCharla(cid))}</div>
              <p class="proy__grande" style="font-size:2.4rem"><span style="color:var(--oro)">${q.ranking.length}</span> en la sala</p>
              <div class="proy__nombres">${nombres.slice(-40).map((n) => `<span>${esc(n)}</span>`).join("")}</div>
              <div class="proy__acc" style="justify-content:flex-start">
                <button class="btn btn--naranja btn--grande" style="width:auto" data-iniciar ${q.preguntas.length ? "" : "disabled"}>${I.flecha}Iniciar trivia</button>
                ${q.ranking.length ? `<button class="btn" data-reiniciar>${I.girar}Vaciar sala</button>` : ""}
              </div>
              ${q.preguntas.length ? "" : `<p class="error">Primero carga las preguntas de esta charla.</p>`}
            </div>
          </div>`, `espera${q.ranking.length}`)) {
          dibujarQR($("[data-qr]", el), enlaceCharla(cid));
          $("[data-iniciar]", el).onclick = () => accion("iniciar");
          $("[data-reiniciar]", el)?.addEventListener("click", reiniciar);
        }
        return;
      }
      if (f === "cuenta") {
        const s = Math.max(1, Math.ceil((Date.parse(q.inicio) - ahora()) / 1000));
        return void cuerpo(`<p class="proy__grande" style="text-align:center">¡Prepárense!</p><div class="proy__cuenta">${s}</div>`, `cuenta${s}`);
      }
      if (f === "jugando") {
        const orden = Math.floor((ahora() - Date.parse(q.inicio)) / (q.seg * 1000));
        const p = q.preguntas[orden];
        const fin = Date.parse(q.inicio) + (orden + 1) * q.seg * 1000;
        const resta = Math.max(0, (fin - ahora()) / 1000);
        const n = q.respuestas.find((r) => r.orden === orden)?.n || 0;
        const top = q.ranking.slice(0, 5);
        cuerpo(`
          <div class="proy__info"><span>Pregunta ${orden + 1} de ${q.preguntas.length}</span>
            <div class="proy__reloj" data-reloj style="--p:${(resta / q.seg) * 100}%"><span data-seg>${Math.ceil(resta)}</span></div>
            <span><b data-n style="color:var(--oro);font-size:1.6rem">${n}</b> de ${q.ranking.length} respondieron</span></div>
          <h2 class="proy__pregunta">${esc(p.texto)}</h2>
          <div class="proy__ops">${p.opciones.map((o, k) => `<div class="opcion opcion--${COLORES[k]}"><span>${FORMAS[k]}</span>${esc(o)}</div>`).join("")}</div>
          <p class="ayuda" style="text-align:center">En cada celular las opciones salen en otro orden: busquen el texto, no el color.</p>
          ${top.length ? `<div class="proy__top" data-top>${filasTop(top)}</div>` : ""}`, `q${orden}`);
        const seg = $("[data-seg]", el), reloj = $("[data-reloj]", el), nn = $("[data-n]", el), tp = $("[data-top]", el);
        if (seg) seg.textContent = Math.ceil(resta);
        if (reloj) reloj.style.setProperty("--p", `${(resta / q.seg) * 100}%`);
        if (nn) nn.textContent = n;
        if (tp) tp.innerHTML = filasTop(top);
        return;
      }
      // Terminada: revelación del podio
      const [g1, g2, g3] = q.ranking;
      const lugar = (r, k) => r ? `<div class="proy__lugar proy__lugar--${k} ${revelado >= 4 - k ? "visible" : ""}"><span class="medalla medalla--${k}">${k}</span>
        <h3>${esc(r.nombre)}</h3><p>${esc(nomDel(r.delegacion_id))}</p><p><b style="color:var(--blanco)">${r.aciertos}</b> aciertos · ${(r.tiempo_ms / 1000).toFixed(1)} s</p>
        ${k === 1 ? `<p style="font-family:var(--neon);color:var(--oro);font-size:1.6rem;margin-top:10px">+${PUNTOS_CHARLA} pts</p>` : ""}</div>` : `<div></div>`;
      const conf = q.confirmado;
      if (cuerpo(`
        <p class="proy__grande" style="text-align:center">${revelado >= 3 ? "¡Tenemos ganador!" : "¿Quién ganó?"}</p>
        ${q.ranking.length ? `<div class="proy__podio">${lugar(g2, 2)}${lugar(g1, 1)}${lugar(g3, 3)}</div>` : `<div class="vacio"><b>Nadie participó en esta trivia</b></div>`}
        <div class="proy__acc">
          ${q.ranking.length && revelado < 3 ? `<button class="btn btn--naranja btn--grande" style="width:auto" data-revelar>${I.copa}Revelar resultados</button>` : ""}
          ${revelado >= 3 && !conf ? `<button class="btn btn--naranja btn--grande" style="width:auto" data-confirmar>${I.check}Confirmar ganador · +${PUNTOS_CHARLA} pts a ${esc(nomDel(g1?.delegacion_id))}</button>` : ""}
          ${conf ? `<span class="chip chip--verde" style="font-size:1rem;padding:.6em 1.1em">${I.check}Ganador confirmado: ${esc(q.ganador_nombre)} · +${PUNTOS_CHARLA} pts a ${esc(nomDel(q.ganador_delegacion))}</span>
            <button class="btn" data-anular>Anular ganador</button>` : ""}
          ${!conf ? `<button class="btn" data-reiniciar>${I.girar}Reiniciar trivia</button>` : ""}
        </div>
        ${revelado >= 3 && q.ranking.length > 3 ? `<div class="proy__top">${filasTop(q.ranking.slice(3, 10))}</div>` : ""}`, `fin${revelado}${conf}${q.ranking.length}`)) {
        $("[data-revelar]", el)?.addEventListener("click", revelar);
        $("[data-confirmar]", el)?.addEventListener("click", () => accion("confirmar"));
        $("[data-anular]", el)?.addEventListener("click", async () => {
          if (await confirmar("¿Anular al ganador?", `Su delegación dejará de recibir los ${PUNTOS_CHARLA} pts de esta charla.`, { boton: "Anular", peligro: true })) accion("anular");
        });
        $("[data-reiniciar]", el)?.addEventListener("click", reiniciar);
      }
    }

    const filasTop = (lista) => lista.map((r) => `<div class="proy__fila"><span class="medalla ${r.puesto <= 3 ? `medalla--${r.puesto}` : ""}">${r.puesto}</span>
      <span><b>${esc(r.nombre)}</b> <small>· ${esc(nomDel(r.delegacion_id))}</small></span><span>${r.aciertos} ✓</span><small>${(r.tiempo_ms / 1000).toFixed(1)} s</small></div>`).join("");

    function revelar() {
      const pasos = Math.min(3, q.ranking.length);
      revelado = 3 - pasos; // con menos de 3 jugadores se salta los puestos vacíos
      const siguiente = () => {
        revelado++; ultima = ""; pintar();
        if (revelado < 3) setTimeout(siguiente, 1800);
        else lanzarConfeti();
      };
      siguiente();
    }

    async function accion(a) {
      if (ocupado) return; ocupado = true;
      try {
        await api.adminCharla(ctx.codigo(), cid, a);
        if (a === "confirmar") { lanzarConfeti(); aviso(`+${PUNTOS_CHARLA} pts sumados a la Copa`); }
        if (a === "iniciar") revelado = 0;
        await leer(); ultima = ""; pintar();
      } catch (e) { aviso(e.message, "error"); }
      finally { ocupado = false; }
    }
    async function reiniciar() {
      if (await confirmar("¿Reiniciar la trivia?", "Se vacía la sala y se borran las respuestas de esta charla. Úsalo solo para pruebas o si hubo un problema.", { boton: "Reiniciar", peligro: true })) { revelado = 0; accion("reiniciar"); }
    }

    let ultimaLectura = 0;
    const tic = setInterval(async () => {
      if (!vivo) return;
      const f = fase();
      const cada = f === "jugando" ? 1000 : f === "terminada" && q?.confirmado ? 5000 : 2000;
      if (Date.now() - ultimaLectura > cada && !ocupado) { ultimaLectura = Date.now(); await leer(); }
      pintar();
    }, 250);
    const tecla = (e) => { if (e.key === "Escape" && !document.querySelector(".velo")) { document.removeEventListener("keydown", tecla); cerrar(); } };
    document.addEventListener("keydown", tecla);
    leer().then(pintar);
  }

  // ---------------- Preguntas ----------------
  async function preguntas(cid) {
    const c = charlaPorId(cid);
    let q;
    try { q = await api.adminQuiz(ctx.codigo(), cid); } catch (e) { return aviso(e.message, "error"); }
    let nuevas = null;
    const lista = (ps) => ps.map((p, i) => `<div class="tarjeta" style="padding:12px 14px"><b>${i + 1}. ${esc(p.texto)}</b>
      <ol type="A">${p.opciones.map((o, k) => `<li class="${k === p.correcta ? "ok" : ""}">${esc(o)}${k === p.correcta ? " ✓" : ""}</li>`).join("")}</ol></div>`).join("");
    const m = modal(`
      <h2>Preguntas · Charla ${c.num}: ${esc(c.nombre)}</h2>
      <p style="margin:0;color:var(--niebla)">Descarga la plantilla, escribe las preguntas del PPT del ponente (una por fila) y súbela. Columnas: <b>Pregunta, Opción A, Opción B, Opción C, Opción D, Correcta</b> (A, B, C o D). Al subirla se reemplazan las preguntas actuales.</p>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn btn--mini" data-plantilla>${I.descargar}Descargar plantilla (con las preguntas actuales)</button>
        <label class="btn btn--mini btn--naranja" style="cursor:pointer">${I.mas}Subir Excel de preguntas<input type="file" accept=".xlsx,.xls,.csv" hidden data-archivo></label></div>
      <p class="error" aria-live="polite"></p>
      <h3 style="margin:4px 0 0" data-titulo>${q.preguntas.length} preguntas actuales</h3>
      <div class="preg-lista" data-lista>${lista(q.preguntas) || `<div class="vacio"><b>Aún no hay preguntas</b></div>`}</div>
      <div class="modal__acciones"><button class="btn" data-cerrar>Cerrar</button><button class="btn btn--naranja" data-guardar hidden>${I.check}Reemplazar preguntas</button></div>`, { ancho: true });
    $("[data-cerrar]", m.el).onclick = m.cerrar;
    $("[data-plantilla]", m.el).onclick = () => {
      const X = window.XLSX; if (!X) return aviso("No se pudo cargar el generador de Excel", "error");
      const filas = (q.preguntas.length ? q.preguntas : [{ texto: "Escribe aquí la pregunta", opciones: ["Respuesta 1", "Respuesta 2", "Respuesta 3", "Respuesta 4"], correcta: 0 }])
        .map((p) => ({ Pregunta: p.texto, "Opción A": p.opciones[0] || "", "Opción B": p.opciones[1] || "", "Opción C": p.opciones[2] || "", "Opción D": p.opciones[3] || "", Correcta: LETRAS[p.correcta] }));
      const wb = X.utils.book_new(); X.utils.book_append_sheet(wb, X.utils.json_to_sheet(filas), "Preguntas");
      X.writeFile(wb, `preguntas-charla-${c.num}.xlsx`);
    };
    $("[data-archivo]", m.el).onchange = async (e) => {
      const err = $(".error", m.el); err.textContent = "";
      const file = e.target.files[0]; if (!file) return;
      try {
        const filas = await leerExcel(file).then((wb) => window.XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" }));
        nuevas = leerPreguntas(filas);
        $("[data-titulo]", m.el).textContent = `Vista previa: ${nuevas.length} preguntas nuevas`;
        $("[data-lista]", m.el).innerHTML = lista(nuevas);
        $("[data-guardar]", m.el).hidden = false;
      } catch (ex) { err.textContent = ex.message; nuevas = null; $("[data-guardar]", m.el).hidden = true; }
      e.target.value = "";
    };
    $("[data-guardar]", m.el).onclick = async (ev) => {
      if (!nuevas) return;
      const btn = ev.currentTarget; btn.disabled = true;
      try { const n = await api.adminPreguntas(ctx.codigo(), cid, nuevas); aviso(`${n} preguntas guardadas`); m.cerrar(); ctx.recargar(true); }
      catch (ex) { $(".error", m.el).textContent = ex.message; btn.disabled = false; }
    };
  }

  function leerPreguntas(filas) {
    const cab = filas.findIndex((f) => f.some((x) => /pregunta/i.test(String(x))));
    const datos = filas.slice(cab + 1).filter((f) => f.some((x) => String(x).trim()));
    if (!datos.length) throw new Error("El Excel no tiene preguntas debajo de la fila de títulos.");
    if (datos.length > 30) throw new Error("Máximo 30 preguntas por charla.");
    return datos.map((f, i) => {
      const texto = String(f[0]).trim();
      const opciones = f.slice(1, 5).map((x) => String(x).trim()).filter(Boolean);
      const letra = String(f[5]).trim().toUpperCase();
      const correcta = LETRAS.indexOf(letra[0]);
      if (!texto) throw new Error(`Fila ${i + 1}: falta la pregunta.`);
      if (opciones.length < 2) throw new Error(`Fila ${i + 1}: escribe al menos 2 opciones.`);
      if (correcta < 0 || correcta >= opciones.length) throw new Error(`Fila ${i + 1}: en "Correcta" escribe A, B, C o D (una opción que exista).`);
      return { texto, opciones, correcta };
    });
  }

  // ---------------- Inscritos ----------------
  function importarInscritos() {
    let libro = null, hoja = null, filas = [], cab = 0, cols = {}, mapa = {};
    const m = modal(`
      <h2>Importar inscritos</h2>
      <p style="margin:0;color:var(--niebla)">En SharePoint abre el Excel de inscripción y elige <b>Archivo → Crear una copia → Descargar una copia</b>. Luego súbelo aquí. Se usa la hoja <b>CONFIRMADOS</b>.</p>
      <label class="btn btn--naranja" style="cursor:pointer;justify-self:start">${I.descargar}Elegir archivo Excel<input type="file" accept=".xlsx,.xls,.csv" hidden data-archivo></label>
      <p class="error" aria-live="polite"></p>
      <div data-paso2></div>
      <div class="modal__acciones"><button class="btn" data-cerrar>Cancelar</button><button class="btn btn--naranja" data-ok hidden>${I.check}Importar</button></div>`, { ancho: true });
    $("[data-cerrar]", m.el).onclick = m.cerrar;
    const err = $(".error", m.el);

    $("[data-archivo]", m.el).onchange = async (e) => {
      err.textContent = "";
      const file = e.target.files[0]; if (!file) return;
      try {
        libro = await leerExcel(file);
        hoja = libro.SheetNames.find((n) => /confirmad/i.test(n)) || libro.SheetNames[0];
        cargarHoja();
      } catch (ex) { err.textContent = ex.message; }
    };

    function cargarHoja() {
      filas = window.XLSX.utils.sheet_to_json(libro.Sheets[hoja], { header: 1, defval: "", raw: false });
      cab = Math.max(0, filas.findIndex((f) => f.some((x) => /dni|documento/i.test(String(x)))));
      const t = (filas[cab] || []).map((x) => sinTildes(x));
      const busca = (re, no) => t.findIndex((x) => re.test(x) && !(no && no.test(x)));
      cols = {
        dni: busca(/dni|documento|doc\./),
        nombre: busca(/nombres?\b|nombre completo|nombres y apellidos/, /delegaci|universidad|apellido(?!s y)/),
        apellido: busca(/apellidos?/, /nombres y apellidos/),
        codigo: busca(/codigo|cod\.|id inscri|n.? de inscri/),
        delegacion: busca(/delegaci|universidad|institucion|casa de estudio/),
      };
      if (cols.nombre >= 0 && cols.apellido === cols.nombre) cols.apellido = -1;
      pintarPaso2();
    }

    function filasDatos() {
      const dat = filas.slice(cab + 1).filter((f) => String(f[cols.dni] ?? "").trim());
      return dat.map((f) => ({
        dni: String(f[cols.dni] ?? "").replace(/\D/g, "") || String(f[cols.dni]).trim(),
        nombre: [cols.nombre >= 0 ? f[cols.nombre] : "", cols.apellido >= 0 ? f[cols.apellido] : ""].map((x) => String(x).trim()).filter(Boolean).join(" "),
        codigo: cols.codigo >= 0 ? String(f[cols.codigo]).trim() : "",
        delegacion_texto: cols.delegacion >= 0 ? String(f[cols.delegacion]).trim() : "",
      }));
    }

    function adivinar(txt) {
      const t = sinTildes(txt); if (!t) return "";
      const ds = ctx.data().delegaciones;
      const exacta = ds.find((d) => sinTildes(d.siglas) === t || sinTildes(d.nombre) === t);
      if (exacta) return exacta.id;
      const parcial = ds.find((d) => (d.siglas && new RegExp(`\\b${sinTildes(d.siglas)}\\b`).test(t)) || t.includes(sinTildes(d.nombre)) || sinTildes(d.nombre).includes(t));
      return parcial?.id || "";
    }

    function pintarPaso2() {
      const t = filas[cab] || [];
      const sel = (k, opcional) => `<select data-col="${k}"><option value="-1">${opcional ? "(no usar)" : "Elige la columna…"}</option>${t.map((x, i) => `<option value="${i}" ${cols[k] === i ? "selected" : ""}>${esc(x || `Columna ${i + 1}`)}</option>`).join("")}</select>`;
      const dat = cols.dni >= 0 ? filasDatos() : [];
      const textos = [...new Set(dat.map((x) => x.delegacion_texto))].filter(Boolean).sort();
      for (const x of textos) if (!(x in mapa)) mapa[x] = adivinar(x);
      const ds = ctx.data().delegaciones;
      $("[data-paso2]", m.el).innerHTML = `
        <label class="campo"><span>Hoja</span><select data-hoja>${libro.SheetNames.map((n) => `<option ${n === hoja ? "selected" : ""}>${esc(n)}</option>`).join("")}</select></label>
        <h3 style="margin:14px 0 6px">1. ¿Qué columna es cada dato?</h3>
        <table class="tabla-mini"><tbody>
          <tr><th>DNI</th><td>${sel("dni")}</td></tr>
          <tr><th>Nombres</th><td>${sel("nombre")}</td></tr>
          <tr><th>Apellidos</th><td>${sel("apellido", true)}</td></tr>
          <tr><th>Código</th><td>${sel("codigo", true)}</td></tr>
          <tr><th>Delegación / universidad</th><td>${sel("delegacion")}</td></tr>
        </tbody></table>
        ${dat.length ? `
        <h3 style="margin:14px 0 6px">2. ¿A qué delegación del panel corresponde cada universidad del Excel?</h3>
        ${ds.length ? "" : `<p class="error">Primero registra las delegaciones en la pestaña Delegaciones.</p>`}
        <table class="tabla-mini"><thead><tr><th>En el Excel</th><th>Inscritos</th><th>Delegación del panel</th></tr></thead><tbody>
          ${textos.map((x) => `<tr><td>${esc(x)}</td><td>${dat.filter((y) => y.delegacion_texto === x).length}</td><td><select data-mapa="${esc(x)}"><option value="">— Sin delegación (no podrá jugar) —</option>${ds.map((d) => `<option value="${d.id}" ${mapa[x] === d.id ? "selected" : ""}>${esc(d.siglas ? `${d.siglas} · ${d.nombre}` : d.nombre)}</option>`).join("")}</select></td></tr>`).join("")}
        </tbody></table>
        <h3 style="margin:14px 0 6px">3. Vista previa (${dat.length} inscritos)</h3>
        <table class="tabla-mini"><thead><tr><th>DNI</th><th>Nombre</th><th>Código</th><th>Delegación</th></tr></thead><tbody>
          ${dat.slice(0, 5).map((x) => `<tr><td>${esc(x.dni)}</td><td>${esc(x.nombre)}</td><td>${esc(x.codigo)}</td><td>${esc(nomDel(mapa[x.delegacion_texto]) )}</td></tr>`).join("")}
        </tbody></table>` : `<p class="ayuda" style="margin-top:10px">Elige la columna del DNI para continuar.</p>`}`;
      $("[data-hoja]", m.el).onchange = (e) => { hoja = e.target.value; mapa = {}; cargarHoja(); };
      $$("[data-col]", m.el).forEach((s) => (s.onchange = () => { cols[s.dataset.col] = Number(s.value); pintarPaso2(); }));
      $$("[data-mapa]", m.el).forEach((s) => (s.onchange = () => { mapa[s.dataset.mapa] = s.value; pintarPaso2(); }));
      const ok = $("[data-ok]", m.el);
      ok.hidden = !dat.length || cols.nombre < 0;
      ok.innerHTML = `${I.check}Importar ${dat.length} inscritos`;
    }

    $("[data-ok]", m.el).onclick = async (ev) => {
      const btn = ev.currentTarget; btn.disabled = true; err.textContent = "";
      const dat = filasDatos().map((x) => ({ ...x, delegacion_id: mapa[x.delegacion_texto] || null }));
      try {
        let r = null;
        for (let i = 0; i < dat.length; i += 300) r = await api.adminAsistentes(ctx.codigo(), dat.slice(i, i + 300));
        m.cerrar(); await ctx.recargar(true);
        aviso(`${dat.length} inscritos importados · ${r.total} en total${r.sin_delegacion ? ` · ${r.sin_delegacion} sin delegación` : ""}`, r.sin_delegacion ? "error" : "ok");
      } catch (ex) { err.textContent = ex.message; btn.disabled = false; }
    };
  }

  return { vista };
}

function leerExcel(file) {
  return new Promise((res, rej) => {
    if (!window.XLSX) return rej(new Error("No se pudo cargar el lector de Excel. Recarga la página."));
    const fr = new FileReader();
    fr.onload = () => { try { res(window.XLSX.read(fr.result, { type: "array" })); } catch { rej(new Error("No se pudo leer el archivo. ¿Es un Excel (.xlsx)?")); } };
    fr.onerror = () => rej(new Error("No se pudo leer el archivo."));
    fr.readAsArrayBuffer(file);
  });
}

function dibujarQR(cont, texto) {
  if (!cont) return;
  if (!window.qrcode) { cont.innerHTML = `<p style="color:#170D56;max-width:300px">No se pudo generar el QR. Usa el enlace.</p>`; return; }
  const qr = window.qrcode(0, "M");
  qr.addData(texto); qr.make();
  cont.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 0, scalable: true });
}

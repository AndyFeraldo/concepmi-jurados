// Exporta todo a un Excel con una hoja por concurso
import { CONCURSOS } from "./concursos.js?v=202610280251";
import { resultados, copaGeneral, textoGymkana } from "./calculo.js?v=202610280251";
import { mmss } from "./ui.js?v=202610280251";
import { TALLERES, PUNTOS_TALLER, tallerPorId } from "./talleres.js?v=202610280251";
import { CHARLAS, PUNTOS_CHARLA } from "./charlas.js?v=202610280251";

const sancion = (aj) => (aj?.descalificado ? "Descalificado" : aj?.walkover ? "Walkover" : aj?.retraso ? "Entrega tardía (−10 % escrita)" : "");
const r1 = (x) => (x == null ? "" : Math.round(x * 100) / 100);
const nombreHoja = (s) => s.replace(/[\\/?*[\]:]/g, "").slice(0, 31);

export function exportarExcel(data) {
  const X = window.XLSX;
  if (!X) throw new Error("No se pudo cargar el generador de Excel");
  const wb = X.utils.book_new();
  const jur = new Map(data.jurados.map((j) => [j.id, j]));
  const del = new Map(data.delegaciones.map((d) => [d.id, d]));

  // Copa general
  const copa = copaGeneral(data).map((f) => {
    const o = { Puesto: f.puesto, Delegación: f.delegacion.nombre, Siglas: f.delegacion.siglas };
    for (const c of CONCURSOS) o[`${c.nombre} (máx ${c.maxCopa})`] = f.pts[c.id] ?? "";
    for (const t of TALLERES) o[`Taller ${t.num} (${PUNTOS_TALLER})`] = f.pts[t.id] ?? "";
    for (const c of CHARLAS) o[`Charla ${c.num} (${PUNTOS_CHARLA})`] = f.pts[c.id] ?? "";
    o["TOTAL COPA"] = f.total;
    return o;
  });
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(copa), "Copa general");

  for (const c of CONCURSOS) {
    const filas = resultados(c.id, data);
    let hoja;
    if (c.modo === "rubrica") {
      hoja = filas.map((f) => {
        const o = { Puesto: f.puesto ?? "", Delegación: f.delegacion.nombre };
        for (const sp of c.subpruebas) {
          o[c.subpruebas.length > 1 ? `Promedio ${sp.id} (máx ${sp.max})` : `Promedio rúbrica (máx ${sp.max})`] = r1(f.porSub[sp.id]?.promedio);
          o[c.subpruebas.length > 1 ? `Votos ${sp.id}` : "Votos"] = f.porSub[sp.id]?.votos ?? 0;
        }
        o["Penalidad"] = r1(f.penal); o["Sanción"] = sancion(f.ajuste);
        o["Puntaje final (entero)"] = f.rubrica; o["Puntos Copa"] = f.copa;
        return o;
      });
      // detalle por jurado
      const det = [];
      for (const x of data.calificaciones.filter((x) => x.concurso_id === c.id)) {
        const sp = c.subpruebas.find((s) => s.id === x.subprueba);
        const o = { Delegación: del.get(x.delegacion_id)?.nombre, Jurado: jur.get(x.jurado_id)?.nombre, Fase: sp?.nombre };
        sp?.criterios.forEach((k, i) => (o[`${i + 1}. ${k.nombre} (${k.max})`] = x.datos[k.id]));
        o.Total = x.total; o.Comentario = x.comentario || ""; o["Última edición"] = new Date(x.actualizado).toLocaleString("es-PE");
        det.push(o);
      }
      if (det.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(det), nombreHoja(`${c.id} detalle`));
    } else if (c.modo === "gymkana") {
      hoja = filas.map((f) => {
        const o = { Puesto: f.puesto ?? "", Delegación: f.delegacion.nombre };
        for (const sp of c.subpruebas) {
          const d = f.det[sp.id];
          let reg = "";
          if (d?.datos) reg = textoGymkana(sp, d.datos);
          o[`${sp.corto} registro`] = reg; o[`${sp.corto} pts (máx ${sp.max})`] = d ? d.pts : "";
        }
        o["Sanción"] = sancion(f.ajuste); o["Total Gymkana"] = f.copa;
        return o;
      });
    } else {
      hoja = filas.map((f) => {
        if (c.id === "conocimientos") {
          const rv = (x) => (x?.rival ? del.get(x.rival)?.nombre || x.rival : "");
          return { Puesto: f.puesto ?? "", Delegación: f.delegacion.nombre, "Enf. 1 puntos": f.datos.e1?.puntos ?? "", "Enf. 1 vs": rv(f.datos.e1),
            "Enf. 2 puntos": f.datos.e2?.puntos ?? "", "Enf. 2 vs": rv(f.datos.e2), "No se presentó": f.ajuste.walkover ? "Sí" : "", "Puntos Copa": f.copa };
        }
        return { Puesto: f.puesto ?? "", Delegación: f.delegacion.nombre, "Likes TikTok": f.datos.tiktok ?? "", "Likes Instagram": f.datos.instagram ?? "",
          "Total likes": f.ajuste.walkover ? "" : f.likes, Desempate: f.desempate || "", "No presentó video": f.ajuste.walkover ? "Sí" : "", "Puntos Copa": f.copa };
      });
    }
    X.utils.book_append_sheet(wb, X.utils.json_to_sheet(hoja.length ? hoja : [{ Aviso: "Sin resultados todavía" }]), nombreHoja(c.nombre));
  }

  const gan = [];
  for (const g of data.ganadores_talleres || []) for (const x of g.integrantes) {
    const t = tallerPorId(g.taller_id);
    gan.push({ Taller: `Taller ${t?.num} · ${t?.nombre}`, Integrante: x.nombre, Delegación: del.get(x.delegacion)?.nombre || "", Tallerista: g.tallerista || "", Fecha: new Date(g.actualizado).toLocaleString("es-PE") });
  }
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(gan.length ? gan : [{ Aviso: "Sin ganadores todavía" }]), "Talleres");

  const ch = CHARLAS.map((c) => { const r = (data.charlas || []).find((x) => x.id === c.id) || {};
    return { Charla: `Charla ${c.num} · ${c.nombre}`, Ponente: c.ponente, Preguntas: r.preguntas ?? "", Participantes: r.jugadores ?? "",
      Ganador: r.confirmado ? r.ganador_nombre : "", Delegación: r.confirmado ? del.get(r.ganador_delegacion)?.nombre || "" : "", Puntos: r.confirmado ? PUNTOS_CHARLA : "" }; });
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(ch), "Charlas");

  const crudo = data.calificaciones.map((x) => ({ Concurso: x.concurso_id, Fase: x.subprueba, Delegación: del.get(x.delegacion_id)?.nombre,
    Jurado: jur.get(x.jurado_id)?.nombre, Total: x.total, Datos: JSON.stringify(x.datos), Comentario: x.comentario || "", Fecha: new Date(x.actualizado).toLocaleString("es-PE") }));
  X.utils.book_append_sheet(wb, X.utils.json_to_sheet(crudo.length ? crudo : [{ Aviso: "Sin votos todavía" }]), "Todos los votos");
  const borr = (data.borrados || []).map((b) => ({ Fecha: new Date(b.borrado).toLocaleString("es-PE"), Concurso: b.concurso_id, Fase: b.subprueba, Jurado: b.jurado, Delegación: b.delegacion, Valor: b.total, Motivo: b.motivo }));
  if (borr.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(borr), "Borrados");

  const js = data.jurados.map((j) => ({ Nombre: j.nombre, Código: j.codigo, Concursos: j.concursos.map((c) => CONCURSOS.find((x) => x.id === c)?.nombre || c).join(", "), Descripción: j.descripcion || "" }));
  if (js.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(js), "Jurados y códigos");
  const ts = (data.talleristas || []).map((t) => ({ Nombre: t.nombre, Código: t.codigo, Talleres: t.talleres.map((id) => `Taller ${tallerPorId(id)?.num || id}`).join(", "), Descripción: t.descripcion || "" }));
  if (ts.length) X.utils.book_append_sheet(wb, X.utils.json_to_sheet(ts), "Talleristas y códigos");
  const f = new Date();
  X.writeFile(wb, `CONCEPMI-VI-resultados-${f.toISOString().slice(0, 10)}-${String(f.getHours()).padStart(2, "0")}${String(f.getMinutes()).padStart(2, "0")}.xlsx`);
}

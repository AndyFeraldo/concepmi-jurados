// =========================================================
// Cálculo oficial de resultados · VI CONCEPMI 2026
// Regla general: promedio de jurados, redondeado a entero,
// sin superar nunca el máximo de las bases.
// =========================================================
import { CONCURSOS, porId } from "./concursos.js";
import { TALLERES, puntosTalleres } from "./talleres.js";

export const redondear = (x) => Math.round(Number(x) + 1e-9);
const prom = (a) => (a.length ? a.reduce((s, x) => s + Number(x), 0) / a.length : null);
const tope = (x, max) => Math.max(0, Math.min(max, x));

// Agrupa empates: devuelve puesto y puntos compartidos (promedio redondeado)
function asignarPorRanking(items, cmp, puntosDe) {
  const orden = [...items].sort(cmp);
  const out = new Map();
  let i = 0;
  while (i < orden.length) {
    let j = i;
    while (j + 1 < orden.length && cmp(orden[i], orden[j + 1]) === 0) j++;
    const pts = [];
    for (let p = i + 1; p <= j + 1; p++) pts.push(puntosDe(p));
    const comp = redondear(prom(pts));
    for (let k = i; k <= j; k++) out.set(orden[k].id, { puesto: i + 1, pts: comp, empate: j > i });
    i = j + 1;
  }
  return out;
}
const tablaTail = (tabla, resto) => (p) => (p <= tabla.length ? tabla[p - 1] : (resto ?? tabla[tabla.length - 1]));

const ajusteDe = (data, cid, did) => data.ajustes.find((a) => a.concurso_id === cid && a.delegacion_id === did) || {};
const anulado = (aj) => aj.walkover || aj.descalificado;

// ---------- Concurso con rúbrica ----------
function calcRubrica(c, data) {
  const califs = data.calificaciones.filter((x) => x.concurso_id === c.id);
  const filas = [];
  for (const d of data.delegaciones) {
    const mias = califs.filter((x) => x.delegacion_id === d.id);
    const aj = ajusteDe(data, c.id, d.id);
    if (!mias.length && !anulado(aj)) continue;
    const porSub = {};
    const promCrit = {};
    let bruto = 0;
    for (const sp of c.subpruebas) {
      const cs = mias.filter((x) => x.subprueba === sp.id);
      const p = prom(cs.map((x) => x.total));
      porSub[sp.id] = { promedio: p, votos: cs.length };
      if (p != null) bruto += p;
      for (const k of sp.criterios) promCrit[k.id] = prom(cs.map((x) => x.datos[k.id]).filter((v) => v != null));
    }
    let penal = 0;
    if (aj.retraso && c.retrasoGrupo) {
      const escrita = c.subpruebas.flatMap((s) => s.criterios).filter((k) => k.grupo === c.retrasoGrupo)
        .reduce((s, k) => s + (promCrit[k.id] || 0), 0);
      penal = escrita * 0.1;
    }
    const neto = anulado(aj) ? 0 : Math.max(0, bruto - penal);
    filas.push({ delegacion: d, califs: mias, porSub, promCrit, bruto, penal, neto, ajuste: aj,
      rubrica: anulado(aj) ? 0 : tope(redondear(neto), c.subpruebas.reduce((s, x) => s + x.max, 0)) });
  }
  // Ranking
  const validos = filas.filter((f) => !anulado(f.ajuste));
  let cmp = (a, b) => b.neto - a.neto;
  if (c.desempate) {
    cmp = (a, b) => {
      const d = b.neto - a.neto; if (Math.abs(d) > 1e-9) return d;
      for (const k of c.desempate) { const e = (b.promCrit[k] || 0) - (a.promCrit[k] || 0); if (Math.abs(e) > 1e-9) return e; }
      return 0;
    };
  }
  const puntos = c.conversion ? tablaTail(c.conversion.tabla, c.conversion.resto) : () => 0;
  const rk = asignarPorRanking(validos.map((f) => ({ ...f, id: f.delegacion.id })), cmp, puntos);
  for (const f of filas) {
    const r = rk.get(f.delegacion.id);
    f.puesto = r ? r.puesto : null;
    f.empate = r ? r.empate : false;
    f.copa = anulado(f.ajuste) ? 0 : c.conversion ? r.pts : tope(f.rubrica, c.maxCopa);
  }
  filas.sort((a, b) => (a.puesto ?? 999) - (b.puesto ?? 999));
  return filas;
}

// ---------- Gymkana ----------
// Valor de un minijuego para una delegación: último registro (o promedio de jurados en la rúbrica)
export function valorGymkana(data, sp, did) {
  const cs = data.calificaciones.filter((x) => x.concurso_id === "gymkana" && x.subprueba === sp.id && x.delegacion_id === did);
  if (!cs.length) return null;
  if (sp.entrada === "rubrica") return { datos: { total: prom(cs.map((x) => x.total)), votos: cs.length }, actualizado: cs[0].actualizado };
  return [...cs].sort((a, b) => new Date(b.actualizado) - new Date(a.actualizado))[0];
}

// valores: [{ id, datos }] → Map(id → { puesto, pts, empate, pendiente })
export function rankingMinijuego(sp, valores) {
  if (sp.entrada === "eliminatoria") {
    const m = new Map();
    const finales = valores.filter((v) => v.datos.fase === "final" && v.datos.puesto).sort((a, b) => a.datos.puesto - b.datos.puesto);
    finales.forEach((v) => m.set(v.id, { puesto: v.datos.puesto, pts: v.datos.puesto <= sp.tablaFinal.length ? sp.tablaFinal[v.datos.puesto - 1] : sp.eliminado }));
    const clasif = valores.filter((v) => v.datos.fase === "clasificado" || (v.datos.fase === "final" && !v.datos.puesto));
    clasif.forEach((v) => m.set(v.id, { puesto: null, pts: 0, pendiente: true }));
    const elim = valores.filter((v) => v.datos.fase === "serie");
    const pos = finales.length + clasif.length + 1;
    elim.forEach((v) => m.set(v.id, { puesto: pos, pts: sp.eliminado, empate: elim.length > 1 }));
    return m;
  }
  const puntos = tablaTail(sp.tabla, sp.resto);
  if (sp.entrada === "conteo" || sp.entrada === "tablero") return asignarPorRanking(valores, (a, b) => b.datos.conteo - a.datos.conteo, puntos);
  if (sp.entrada === "rubrica") return asignarPorRanking(valores, (a, b) => b.datos.total - a.datos.total, puntos);
  // tiempo: menor tiempo; entre los que no terminaron, más estaciones
  return asignarPorRanking(valores, (a, b) => {
    const t = a.datos.segundos - b.datos.segundos; if (Math.abs(t) > 1e-9) return t;
    return (b.datos.estaciones ?? 5) - (a.datos.estaciones ?? 5);
  }, puntos);
}

function calcGymkana(c, data) {
  const porSub = {};
  for (const sp of c.subpruebas) {
    const vals = data.delegaciones.map((d) => ({ id: d.id, reg: valorGymkana(data, sp, d.id) })).filter((x) => x.reg && !anulado(ajusteDe(data, c.id, x.id)));
    porSub[sp.id] = { rk: rankingMinijuego(sp, vals.map((x) => ({ id: x.id, datos: x.reg.datos }))), regs: new Map(vals.map((x) => [x.id, x.reg])) };
  }
  const filas = [];
  for (const d of data.delegaciones) {
    const aj = ajusteDe(data, c.id, d.id);
    const det = {};
    let total = 0, alguno = false;
    for (const sp of c.subpruebas) {
      const r = porSub[sp.id].rk.get(d.id);
      const reg = porSub[sp.id].regs.get(d.id);
      if (r) { alguno = true; total += r.pts; }
      det[sp.id] = r ? { ...r, datos: reg?.datos } : null;
    }
    if (!alguno && !anulado(aj)) continue;
    filas.push({ delegacion: d, det, ajuste: aj, bruto: total, copa: anulado(aj) ? 0 : tope(total, c.maxCopa) });
  }
  const rk = asignarPorRanking(filas.filter((f) => !anulado(f.ajuste)).map((f) => ({ id: f.delegacion.id, v: f.copa })), (a, b) => b.v - a.v, () => 0);
  for (const f of filas) { const r = rk.get(f.delegacion.id); f.puesto = r ? r.puesto : null; f.empate = r?.empate; }
  filas.sort((a, b) => (a.puesto ?? 999) - (b.puesto ?? 999));
  return filas;
}

// Texto corto del registro de un minijuego (para tablas, feed y Excel)
export function textoGymkana(sp, datos) {
  if (!datos) return "";
  if (sp.entrada === "conteo" || sp.entrada === "tablero") return `${datos.conteo} check${datos.conteo === 1 ? "" : "s"}`;
  if (sp.entrada === "rubrica") return `${Math.round((datos.total ?? 0) * 10) / 10} / 100${datos.votos > 1 ? ` (${datos.votos} jurados)` : ""}`;
  if (sp.entrada === "tiempo") {
    const s = Number(datos.segundos); const m = Math.floor(s / 60); const r = Math.round((s - m * 60) * 10) / 10;
    return s >= 300 ? `No terminó · estación ${datos.estaciones}` : `${m}:${r < 10 ? "0" : ""}${r}`;
  }
  if (datos.fase === "final" && datos.puesto) return `${datos.puesto}.° en la Gran Final`;
  if (datos.fase === "serie") return `Eliminado en la serie ${datos.serie}`;
  return `Clasificado a la final (serie ${datos.serie})`;
}

// ---------- Manuales ----------
function calcManual(c, data) {
  const filas = [];
  for (const d of data.delegaciones) {
    const aj = ajusteDe(data, c.id, d.id);
    if (aj.valor == null && !anulado(aj)) continue;
    const datos = aj.datos || {};
    const f = { delegacion: d, ajuste: aj, datos, valor: aj.valor };
    if (c.id === "conocimientos") {
      f.jugados = [datos.e1, datos.e2].filter(Boolean).length;
      f.copa = anulado(aj) ? 0 : tope(redondear(aj.valor || 0), c.maxCopa);
    } else {
      f.likes = Number(datos.tiktok || 0) + Number(datos.instagram || 0);
      f.desempate = Number(datos.desempate || 0);
    }
    filas.push(f);
  }
  const validos = filas.filter((f) => !anulado(f.ajuste)).map((f) => ({ ...f, id: f.delegacion.id }));
  let rk;
  if (c.id === "conocimientos") {
    rk = asignarPorRanking(validos, (a, b) => b.copa - a.copa, () => 0);
  } else {
    rk = asignarPorRanking(validos, (a, b) => (b.likes - a.likes) || (b.desempate - a.desempate), tablaTail(c.conversion.tabla, c.conversion.resto));
  }
  for (const f of filas) {
    const r = rk.get(f.delegacion.id);
    f.puesto = r ? r.puesto : null; f.empate = r ? r.empate : false;
    if (c.id !== "conocimientos") f.copa = anulado(f.ajuste) ? 0 : r.pts;
  }
  filas.sort((a, b) => (a.puesto ?? 999) - (b.puesto ?? 999));
  return filas;
}

export function resultados(cid, data) {
  const c = porId(cid);
  if (c.modo === "rubrica") return calcRubrica(c, data);
  if (c.modo === "gymkana") return calcGymkana(c, data);
  return calcManual(c, data);
}

export function copaGeneral(data) {
  const porConcurso = {};
  for (const c of CONCURSOS) porConcurso[c.id] = new Map(resultados(c.id, data).map((f) => [f.delegacion.id, f.copa]));
  const pt = puntosTalleres(data.ganadores_talleres);
  const filas = data.delegaciones.map((d) => {
    const pts = {}; let total = 0;
    for (const c of CONCURSOS) { const v = porConcurso[c.id].get(d.id); pts[c.id] = v ?? null; total += v || 0; }
    for (const t of TALLERES) { const v = pt[d.id]?.[t.id]; pts[t.id] = v ?? null; total += v || 0; }
    return { delegacion: d, pts, total };
  });
  const rk = asignarPorRanking(filas.map((f) => ({ id: f.delegacion.id, v: f.total })), (a, b) => b.v - a.v, () => 0);
  for (const f of filas) f.puesto = rk.get(f.delegacion.id).puesto;
  return filas.sort((a, b) => a.puesto - b.puesto);
}

export const maxCopaTotal = CONCURSOS.reduce((s, c) => s + c.maxCopa, 0);

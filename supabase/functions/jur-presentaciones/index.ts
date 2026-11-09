// =========================================================
// Función Edge «jur-presentaciones» (Concurso de Proyectos y ponencias de las charlas).
// Entrega enlaces TEMPORALES para subir y ver los PDF/PPT/videos del espacio privado
// «jur-presentaciones». Quién puede hacer qué lo decide la base de datos:
//   equipos  → jur_pres_autorizar_subida / jur_pres_confirmar / jur_pres_autorizar_lectura
//   ponentes → jur_ponencia_autorizar_subida / jur_ponencia_confirmar / jur_ponencia_autorizar_lectura
// Acciones (POST JSON). Con ponencia: true se usan las de ponentes (y `ponente` es su id):
//   { accion: "subir",     codigo, tipo: "ppt"|"pdf"|"video", nombre, tamano, ponencia?, ponente? } → { path, token }
//   { accion: "confirmar", codigo, tipo, path, nombre, tamano, ponencia?, ponente? }                → { ok }
//   { accion: "leer",      codigo, equipo | ponente, tipo, descargar?, ponencia? }                   → { url, nombre }
//   { accion: "quitar",    codigo, equipo | ponente, tipos: ["pdf","ppt","video"], ponencia? }        → { ok, quitados } (admin/coordinador)
// Casos confidenciales (caso: true, concurso = "amateur-1" | "amateur-2" | "iathon"):
//   subir / confirmar / quitar → solo la encargada (jur_casos_*); leer → encargada, admin y, desde que empieza
//   el concurso, su equipo, jurados y coordinadores (cada apertura queda registrada en la base).
// =========================================================
import { createClient } from "npm:@supabase/supabase-js@2.45.4";

const BUCKET = "jur-presentaciones";
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (cuerpo: unknown, status = 200) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { ...cors, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);
  const sb = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  let b: Record<string, unknown>;
  try { b = await req.json(); } catch { return json({ error: "Solicitud no válida" }, 400); }
  const rpc = async (fn: string, args: Record<string, unknown>) => {
    const { data, error } = await sb.rpc(fn, args);
    if (error) throw new Error(error.message);
    return data as Record<string, string>;
  };
  const pon = b.ponencia === true, ponente = (b.ponente as string) || null;
  try {
    if (b.caso === true) {
      const concurso = b.concurso as string;
      if (b.accion === "subir") {
        const r = await rpc("jur_casos_autorizar_subida", { p_codigo: b.codigo, p_concurso: concurso, p_nombre: b.nombre, p_tamano: b.tamano });
        const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(r.path);
        if (error) throw new Error(error.message);
        return json({ path: data.path, token: data.token });
      }
      if (b.accion === "confirmar") {
        const r = await rpc("jur_casos_confirmar", { p_codigo: b.codigo, p_concurso: concurso, p_path: b.path, p_nombre: b.nombre, p_tamano: b.tamano });
        if (r?.anterior && r.anterior !== b.path) await sb.storage.from(BUCKET).remove([r.anterior]);
        return json({ ok: true });
      }
      if (b.accion === "leer") {
        const r = await rpc("jur_casos_autorizar_lectura", { p_codigo: b.codigo, p_concurso: concurso });
        const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(r.path, 60 * 30, b.descargar ? { download: r.nombre } : undefined);
        if (error) throw new Error(error.message);
        return json({ url: data.signedUrl, nombre: r.nombre, tipo: r.tipo });
      }
      if (b.accion === "quitar") {
        const r = await rpc("jur_casos_quitar", { p_codigo: b.codigo, p_concurso: concurso });
        const paths = (r?.paths as unknown as string[]) || [];
        if (paths.length) await sb.storage.from(BUCKET).remove(paths);
        return json({ ok: true });
      }
      return json({ error: "Acción no válida" }, 400);
    }
    if (b.accion === "subir") {
      const r = pon
        ? await rpc("jur_ponencia_autorizar_subida", { p_codigo: b.codigo, p_tipo: b.tipo, p_nombre: b.nombre, p_tamano: b.tamano, p_ponente: ponente })
        : await rpc("jur_pres_autorizar_subida", { p_codigo: b.codigo, p_tipo: b.tipo, p_nombre: b.nombre, p_tamano: b.tamano });
      const { data, error } = await sb.storage.from(BUCKET).createSignedUploadUrl(r.path);
      if (error) throw new Error(error.message);
      return json({ path: data.path, token: data.token });
    }
    if (b.accion === "confirmar") {
      const r = pon
        ? await rpc("jur_ponencia_confirmar", { p_codigo: b.codigo, p_tipo: b.tipo, p_path: b.path, p_nombre: b.nombre, p_tamano: b.tamano, p_ponente: ponente })
        : await rpc("jur_pres_confirmar", { p_codigo: b.codigo, p_tipo: b.tipo, p_path: b.path, p_nombre: b.nombre, p_tamano: b.tamano });
      if (r?.anterior && r.anterior !== b.path) await sb.storage.from(BUCKET).remove([r.anterior]); // reemplaza la versión anterior
      return json({ ok: true });
    }
    if (b.accion === "leer") {
      const r = pon
        ? await rpc("jur_ponencia_autorizar_lectura", { p_codigo: b.codigo, p_ponente: ponente, p_tipo: b.tipo })
        : await rpc("jur_pres_autorizar_lectura", { p_codigo: b.codigo, p_equipo: b.equipo, p_tipo: b.tipo });
      const { data, error } = await sb.storage.from(BUCKET).createSignedUrl(r.path, 60 * 60 * 3, b.descargar ? { download: r.nombre } : undefined);
      if (error) throw new Error(error.message);
      return json({ url: data.signedUrl, nombre: r.nombre });
    }
    if (b.accion === "quitar") {
      const r = pon
        ? await rpc("jur_ponencia_quitar", { p_codigo: b.codigo, p_ponente: ponente, p_tipos: b.tipos })
        : await rpc("jur_pres_quitar", { p_codigo: b.codigo, p_equipo: b.equipo, p_tipos: b.tipos });
      const paths = (r?.paths as unknown as string[]) || [];
      if (paths.length) await sb.storage.from(BUCKET).remove(paths);
      return json({ ok: true, quitados: paths.length });
    }
    return json({ error: "Acción no válida" }, 400);
  } catch (e) {
    return json({ error: String((e as Error).message || e).replace(/^.*?ERROR:\s*/, "") }, 400);
  }
});

// =========================================================
// Panel de Jurados · VI CONCEPMI 2026 · arranque y portada
// =========================================================
import { api, ES_DEMO } from "./api.js?v=202610280251";
import { $, esc, I, IMG, modal, fondoAnimado } from "./ui.js?v=202610280251";
import { CONCURSOS } from "./concursos.js?v=202610280251";
import { vistaJurado } from "./jurado.js?v=202610280251";
import { vistaAdmin } from "./admin.js?v=202610280251";
import { vistaTallerista } from "./tallerista.js?v=202610280251";
import { vistaQuiz } from "./quiz.js?v=202610280251";

const app = $("#app");
const SESION = "concepmi-jurados-sesion";

export const sesion = {
  leer() { try { return JSON.parse(sessionStorage.getItem(SESION)); } catch { return null; } },
  guardar(s) { try { sessionStorage.setItem(SESION, JSON.stringify(s)); } catch { /* sin almacenamiento */ } },
  borrar() { try { sessionStorage.removeItem(SESION); } catch { /* sin almacenamiento */ } },
};

export function salir() { sesion.borrar(); portada(); }

function portada() {
  document.title = "Panel de Jurados · CONCEPMI VI 2026";
  const academicos = CONCURSOS.filter((c) => c.tipo === "academico").length;
  const culturales = CONCURSOS.filter((c) => c.tipo === "cultural").length;
  app.innerHTML = `
  ${fondoAnimado(26)}
  <div class="portada">
    <header class="portada__barra">
      <img class="logo" src="${IMG.logo}" alt="CONCEPMI">
      <span class="sep"></span>
      <div><div class="barra__titulo">Panel de Jurados</div><div class="barra__sub">VI CONCEPMI 2026 · Calificación oficial</div></div>
      <div class="der">
        <span class="en-vivo"><span class="punto punto--vivo"></span>EN VIVO</span>
        <img class="club" src="${IMG.club}" alt="PMI Lima Perú Chapter Student Club">
      </div>
    </header>
    <main class="escena">
      <div>
        <p class="escena__pre">PMI LIMA STUDENT CLUB PRESENTA</p>
        <img class="escena__logo" src="${IMG.logo}" alt="CONCEPMI VI" style="margin:0 auto">
        <h1 class="escena__titulo">Panel de Jurados</h1>
        <p class="escena__sub">Califica cada concurso con la rúbrica oficial de sus bases. Los puntajes llegan en vivo a la Copa CONCEPMI VI.</p>
        <div class="pildoras">
          <span class="pildora pildora--lila">${I.libro}${academicos} concursos académicos</span>
          <span class="pildora pildora--celeste">${I.bandera}${culturales} eventos culturales</span>
          <span class="pildora pildora--oro">${I.copa}Copa CONCEPMI VI</span>
        </div>
        <div class="puertas">
          <button class="puerta puerta--jurado" data-rol="jurado">
            <span class="puerta__icono">${I.mazo}</span>
            <span class="puerta__nombre">Jurado</span>
            <span class="puerta__txt">Ingresa con el código que te entregó el equipo organizador.</span>
            <span class="puerta__ir">Entrar a calificar ${I.flecha}</span>
          </button>
          <button class="puerta puerta--tallerista" data-rol="tallerista">
            <span class="puerta__icono">${I.pizarra}</span>
            <span class="puerta__nombre">Tallerista</span>
            <span class="puerta__txt">Registra al equipo ganador de tu taller y suma puntos a sus delegaciones.</span>
            <span class="puerta__ir">Registrar ganadores ${I.flecha}</span>
          </button>
          <button class="puerta puerta--admin" data-rol="admin">
            <span class="puerta__icono">${I.escudo}</span>
            <span class="puerta__nombre">Admin</span>
            <span class="puerta__txt">Resultados en vivo, jurados, talleristas, delegaciones y Excel.</span>
            <span class="puerta__ir">Abrir panel ${I.flecha}</span>
          </button>
        </div>
      </div>
    </main>
    <footer class="portada__pie">VI Congreso Nacional de Conexiones Estudiantiles del <b>PMI</b> · 24 y 26 de noviembre · UNMSM</footer>
    <img class="wolfito" src="${IMG.wolfito}" alt="">
  </div>
  ${ES_DEMO ? `<span class="demo-banda">VISTA PREVIA · nada de aquí se guarda en la nube</span>` : ""}`;
  app.querySelectorAll(".puerta").forEach((b) => (b.onclick = () => pedirCodigo(b.dataset.rol)));
}

const ROLES = {
  jurado: { titulo: "Acceso de jurado", icono: "mazo", fondo: "linear-gradient(135deg,#FF6A1F,#FF9A55)", btn: "btn--naranja", demo: "JUR001, JUR002 o JUR003", boton: "Jurado" },
  tallerista: { titulo: "Acceso de tallerista", icono: "pizarra", fondo: "linear-gradient(135deg,#A98BFF,#6E2BE6)", btn: "btn--naranja", demo: "TAL001", boton: "Tallerista" },
  admin: { titulo: "Acceso de administrador", icono: "escudo", fondo: "linear-gradient(135deg,#1FCBEA,#6E2BE6)", btn: "btn--primario", demo: "ADMIN1", boton: "Admin" },
};

function pedirCodigo(rol) {
  const esAdmin = rol === "admin";
  const R = ROLES[rol];
  const m = modal(`
    <div style="text-align:center">
      <div class="puerta__icono" style="margin:0 auto 12px;background:${R.fondo}">${I[R.icono]}</div>
      <h2>${R.titulo}</h2>
      <p style="margin:0;color:var(--niebla)">${esAdmin ? "Escribe tu código de administrador." : "Escribe el código de 6 caracteres que te entregaron."}</p>
      ${ES_DEMO ? `<p class="ayuda" style="margin-top:8px">Vista previa: prueba con <b>${R.demo}</b></p>` : ""}
    </div>
    <form>
      <label class="sr" for="cod">Código</label>
      <input id="cod" class="codigo-input" autocomplete="off" autocapitalize="characters" spellcheck="false" maxlength="24" autofocus>
      <p class="error" aria-live="polite"></p>
      <div class="modal__acciones" style="justify-content:stretch">
        <button type="button" class="btn" data-cancelar style="flex:1">Cancelar</button>
        <button class="btn ${R.btn}" style="flex:2">Entrar ${I.flecha}</button>
      </div>
    </form>`);
  const form = m.el.querySelector("form");
  const inp = m.el.querySelector("#cod");
  const err = m.el.querySelector(".error");
  m.el.querySelector("[data-cancelar]").onclick = () => m.cerrar();
  form.onsubmit = async (e) => {
    e.preventDefault();
    const codigo = inp.value.trim();
    if (!codigo) { inp.focus(); return; }
    const btn = form.querySelector("button:not([data-cancelar])");
    btn.disabled = true; err.textContent = "";
    try {
      const r = await api.entrar(codigo);
      if (!r || r.rol !== rol) {
        err.textContent = r ? `Ese código es de ${r.rol === "admin" ? "administrador" : r.rol}. Usa el botón ${ROLES[r.rol]?.boton || ""}.` : "Código incorrecto. Revisa e inténtalo otra vez.";
        inp.classList.remove("temblor"); void inp.offsetWidth; inp.classList.add("temblor"); inp.select();
        return;
      }
      sesion.guardar({ rol, codigo });
      m.cerrar();
      abrir();
    } catch (ex) {
      err.textContent = ex.message || "No se pudo conectar. Revisa tu internet.";
    } finally { btn.disabled = false; }
  };
}

function abrir() {
  // Asistentes que llegan por el QR de una charla
  const charla = new URLSearchParams(location.search).get("charla");
  if (charla) return vistaQuiz(app, charla);
  const s = sesion.leer();
  if (s?.rol === "jurado") return vistaJurado(app, s.codigo);
  if (s?.rol === "tallerista") return vistaTallerista(app, s.codigo);
  if (s?.rol === "admin") return vistaAdmin(app, s.codigo);
  portada();
}

abrir();

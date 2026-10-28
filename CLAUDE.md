# Panel de Jurados · VI CONCEPMI 2026

Contexto para Claude Code. El usuario (Andy, director del proyecto CONCEPMI VI, PMI Lima Perú
Chapter Student Club) **no sabe programar**: explica en español sencillo, sin jerga, y haz tú
los pasos técnicos (git, publicar, base de datos).

## Qué es
Página aparte de la landing del congreso para que los jurados califiquen los concursos y el
administrador vea resultados en vivo, la Copa CONCEPMI y exporte a Excel.
- Repositorio: `concepmi-jurados` (separado de la landing `concepmi-vi`; **no mezclarlos**).
- Publicación: GitHub Pages → `https://andyferaldo.github.io/concepmi-jurados/`
- Evento: 24 y 26 de noviembre de 2026, UNMSM.

## Flujo de trabajo
1. Hacer los cambios en esta carpeta.
2. Probar en local (`python -m http.server` o `server.ps1` de la landing) antes de publicar.
3. `git add`, `commit` con mensaje en español y `push` a `main`. GitHub Pages se actualiza solo en 1 o 2 minutos.

## Estructura
- `index.html`: entrada; carga `vendor/` (supabase, confetti, xlsx) y `js/app.js` (ES modules, sin build).
- `js/concursos.js`: **fuente única** de concursos, rúbricas, niveles y puntos. Viene de las bases oficiales (PDF en `concepmi-vi/public/bases`).
- `js/calculo.js`: promedios, redondeo, rankings, empates y Copa.
- `js/jurado.js`: vistas del jurado. `js/tallerista.js`: vista del tallerista. `js/admin.js`: panel de administrador (pestaña Talleristas incluida). `js/excel.js`: exportación.
- `js/talleres.js`: los 4 talleres (nombre, lugar, hora) y el cálculo de sus puntos.
- `js/api.js`: llamadas RPC a Supabase. También tiene un modo DEMO (`window.__CONCEPMI_DEMO__`) que solo se usaba en la vista previa de claude.ai; en GitHub nunca está activo.
- `js/config.js`: URL y clave anon de Supabase (pública por diseño).
- `css/estilos.css`: mismo sistema visual del Concurso de Conocimientos (Poppins + Russo One, morados, naranja, celeste, Wolfito).
- `sql/`: copia de referencia de lo aplicado en Supabase.

## Base de datos (Supabase)
- Proyecto **Concurso-Concepmi**, ref `sczjwiqdktjtulnmnngk`. Lo comparte con el sistema del Concurso de Conocimientos: **solo tocar tablas con prefijo `jur_`**.
- Tablas: `jur_config` (hash del código admin), `jur_concursos` (abierto/cerrado), `jur_criterios` (máximo y niveles válidos por criterio), `jur_delegaciones`, `jur_jurados` (nombre, código, concursos, descripción, foto en base64), `jur_calificaciones`, `jur_ajustes` (sanciones y registro manual de Conocimientos y Talent), `jur_borrados` (historial con motivo), `jur_talleres` (t1–t4, abierto/cerrado), `jur_talleristas` (como jurados, con `talleres`), `jur_taller_ganadores` (un equipo por taller: integrantes con nombre y delegación).
- RLS activado y sin políticas: **todo pasa por funciones `security definer`** que validan el código: `jur_entrar`, `jur_datos_jurado`, `jur_calificar`, `jur_admin_datos`, `jur_admin_delegacion`, `jur_admin_jurado` (acepta `p_codigo_fijo`), `jur_admin_ajuste`, `jur_admin_manual`, `jur_admin_concurso`, `jur_admin_borrar_calificaciones`, `jur_admin_clave`, `jur_datos_tallerista`, `jur_taller_registrar`, `jur_admin_tallerista`, `jur_admin_taller`. Los códigos son únicos entre jurados y talleristas (`jur_codigo_usado`).
- Si cambia un puntaje o nivel en `js/concursos.js`, hay que actualizar también `jur_criterios`; si no, la base rechaza el voto.
- En PL/pgSQL no uses `CASE ... THEN` dentro de una condición `IF` (rompe el parser); calcula antes en una variable.

### REGLA DE ORO: nunca borrar datos
Jurados, delegaciones y calificaciones son datos reales y los códigos ya se enviaron a los jurados.
Las migraciones solo agregan o ajustan reglas y funciones. Nunca uses `DROP TABLE`, `TRUNCATE` ni
`DELETE` sobre `jur_jurados`, `jur_delegaciones`, `jur_calificaciones` o `jur_ajustes`. Antes de
cualquier cambio de base de datos, explica qué hace y confirma con el usuario.

## Reglas de puntaje (acordadas con el usuario)
- El puntaje es el promedio de los jurados, **redondeado a entero** y sin pasar el máximo de las bases.
- Los jurados califican eligiendo **niveles con puntaje entero y una justificación escrita**, no con barras deslizantes:
  - 5 niveles: Excelente, Muy bueno, Bueno, Regular y Deficiente.
  - Los criterios de 1 a 3 pts tienen 2, 3 o 4 niveles.
  - Proyectos p1 y p2 valen 7,5 según las bases.
- Amateur I y II: retraso en la entrega = −10 % de la fase escrita. Walkover o descalificado = 0.
- Proyectos: 5 jurados, con fase virtual (40) y presencial (60).
- Barras: 4 niveles oficiales (Tabla 3.2). El total sobre 100 **solo ordena el ranking**, que se convierte a 50, 40, 30, 22, 15 y 10 pts. Desempate: criterio 3, luego 1, luego 2.
- Conocimientos: el admin registra los puntos de cada enfrentamiento (0 a 35) y el rival. La suma va a la Copa, con un máximo de 70. El desglose está en el otro sistema.
- Talent Show: el admin registra los likes de TikTok e Instagram. Se suman, se ordenan de mayor a menor y reciben 50, 40, 30, 22, 15 y 10 pts; no presentó = 0. Hay un campo opcional de desempate.
- Gran Gymkana (máximo 80 pts):
  - **Sacos**: tablero de 16 rondas, una ganadora por ronda. Recibe 16, 13, 10, 7 y 4 pts.
  - **Bailetón**: rúbrica de 4 criterios (35, 30, 20 y 15) sobre 100, con promedio de jurados. Recibe 16, 13, 10, 7, 7 y 4 pts.
  - **Pentatlón**: cronómetro con tope de 5:00. Si no terminó, se marca la estación en la que se quedó (1 a 5). Recibe 28, 22, 17, 12 y 7 pts.
  - **Ponte la Liga**: series de 4 y pasa el 1.° a la Gran Final. Recibe 10, 8 y 6 pts en la final y 4 los eliminados.
  - **Tren de Globos**: series de 5 y pasan 3 a la final de 6. Recibe 10, 8, 6, 5, 4 y 3 pts en la final y 2 los eliminados.
- Los empates comparten el promedio de puntos (redondeado).
- Talleres (4, en paralelo, 11:30 a. m. – 1:00 p. m.): el tallerista registra al equipo ganador (1.er lugar), con nombre, apellido y delegación de cada integrante (empieza con 4 filas y el botón + agrega más, hasta 15). Cada delegación del equipo recibe **40 pts** en la Copa, una sola vez aunque tenga dos integrantes. Si se registra de nuevo, se reemplaza. El admin puede cerrar el registro de cada taller.
- Borrar calificaciones: el admin elige concurso, jurado y calificaciones, y escribe un motivo obligatorio que queda en `jur_borrados`.

## Pendientes y decisiones abiertas
- Charlas principales: falta agregar su puntaje a la Copa (siguiente paso pedido por el usuario).
- Talleres: confirmar si una delegación con 2 integrantes en el equipo ganador recibe 40 o 80 pts (hoy recibe 40).
- Primera prueba real después de publicar: entrar como admin, crear una delegación y un jurado de prueba y calificar. La conexión navegador → Supabase no se pudo probar desde claude.ai.
- El usuario había registrado jurados en la vista previa de claude.ai, que no guarda en la nube. Para pasarlos a la base real se usa **Jurados → Importar respaldo**, que los crea con los mismos códigos ya enviados.
- Bailetón: hoy el puesto sale del puntaje de rúbrica. Falta definir si debe ordenar primero por etapa alcanzada (TOP 3, TOP 5, etapa 1).
- El código de administrador lo tiene el usuario. **No lo escribas en ningún archivo del repositorio**, porque es público.

// =========================================================
// Concursos y rúbricas oficiales · VI CONCEPMI 2026
// Fuente: bases oficiales en PDF (public/bases de la landing).
// Si cambian las bases, se edita SOLO este archivo
// (y se vuelve a generar el SQL de validación: ver LEEME.txt).
// =========================================================

// Niveles rápidos para criterios numéricos (el jurado puede ajustar fino después)
export const NIVELES_RAPIDOS = [
  { nombre: "Excelente", factor: 1 },
  { nombre: "Bueno", factor: 0.75 },
  { nombre: "Regular", factor: 0.5 },
  { nombre: "Deficiente", factor: 0.25 },
];

const F1_A1 = "Fase 1 · Exposición y defensa en vivo";
const F2_A1 = "Fase 2 · Revisión del acta impresa";
const F1_A2 = "Fase 1 · Exposición y defensa en vivo";
const F2_A2 = "Fase 2 · Revisión de la matriz impresa";

export const CONCURSOS = [
  // ---------------- ACADÉMICOS ----------------
  {
    id: "proyectos",
    nombre: "Concurso Nacional de Proyectos",
    apodo: "PMI Venture Builder",
    tipo: "academico",
    modo: "rubrica",
    maxCopa: 100,
    jurados: 5,
    color: "celeste",
    sanciones: ["walkover", "descalificado"],
    nota: "El puntaje final es el promedio de los jurados en cada fase (virtual + presencial), redondeado a entero.",
    subpruebas: [
      {
        id: "virtual", nombre: "Fase virtual · Dossier técnico", max: 40,
        criterios: [
          { id: "v1", grupo: "1. Caso de negocio, fit y validación de mercado", nombre: "Definición del problema y ODS", desc: "Claridad del problema y alineación con los ODS.", max: 3 , niveles: [
            { nombre: "Excelente", pts: 3, desc: "Problema claro, respaldado con datos, y ODS específico (con su meta) bien justificado." },
            { nombre: "Bueno", pts: 2, desc: "Problema claro; el ODS se menciona sin justificar bien la relación." },
            { nombre: "Regular", pts: 1, desc: "Problema general y ODS forzado." },
            { nombre: "Deficiente", pts: 0, desc: "Sin problema definido ni ODS." },
          ] },
          { id: "v2", grupo: "1. Caso de negocio, fit y validación de mercado", nombre: "Caso de negocio y propuesta de valor", desc: "Justificación de la oportunidad de mercado, deseabilidad para el usuario y propuesta diferenciadora.", max: 3 , niveles: [
            { nombre: "Excelente", pts: 3, desc: "Oportunidad de mercado sustentada, usuario bien definido y propuesta de valor diferenciada." },
            { nombre: "Bueno", pts: 2, desc: "Propuesta clara, pero la oportunidad está poco sustentada." },
            { nombre: "Regular", pts: 1, desc: "Propuesta genérica, sin diferenciación." },
            { nombre: "Deficiente", pts: 0, desc: "No presenta caso de negocio." },
          ] },
          { id: "v3", grupo: "1. Caso de negocio, fit y validación de mercado", nombre: "Tracción o validación de mercado", desc: "Con ventas: evidencia tangible con clientes reales (entrevistas, landing, cartas de interés, preventas). Sin ventas: sustento de la deseabilidad (investigación, competidores, encuestas, expertos, listas de espera).", max: 3 , niveles: [
            { nombre: "Excelente", pts: 3, desc: "Evidencia concreta: ventas, entrevistas, cartas de interés, lista de espera o encuestas con resultados." },
            { nombre: "Bueno", pts: 2, desc: "Alguna evidencia, pero limitada o poco representativa." },
            { nombre: "Regular", pts: 1, desc: "Solo supuestos apoyados en fuentes secundarias." },
            { nombre: "Deficiente", pts: 0, desc: "Sin evidencia de validación." },
          ] },
          { id: "v4", grupo: "2. Definición de alcance", nombre: "EDT, backlog o enfoque híbrido", desc: "A: EDT al 100 % con diccionario. B: backlog del MVP con épicas, historias y criterios de aceptación. C: EDT para infraestructura + backlog para el software.", max: 6 , niveles: [
            { nombre: "Excelente", pts: 6, desc: "Descomposición completa y coherente con el enfoque elegido: EDT al 100 % con diccionario, o backlog con épicas, historias y criterios de aceptación." },
            { nombre: "Muy bueno", pts: 5, desc: "Completa, con detalles menores faltantes (diccionario parcial o algunos criterios de aceptación)." },
            { nombre: "Bueno", pts: 4, desc: "Estructura básica: niveles incompletos o historias sin criterios de aceptación." },
            { nombre: "Regular", pts: 2, desc: "Lista de tareas sin estructura jerárquica o desconectada del MVP." },
            { nombre: "Deficiente", pts: 1, desc: "No presenta EDT ni backlog." },
          ] },
          { id: "v5", grupo: "2. Definición de alcance", nombre: "Límites del alcance", desc: "Declaración explícita de lo incluido y excluido (matriz IN-OUT).", max: 2 , niveles: [
            { nombre: "Excelente", pts: 2, desc: "Matriz IN-OUT explícita y coherente con el proyecto." },
            { nombre: "Regular", pts: 1, desc: "Solo indica lo que incluye o las exclusiones son vagas." },
            { nombre: "Deficiente", pts: 0, desc: "Sin delimitación del alcance." },
          ] },
          { id: "v6", grupo: "3. Plan de gestión de riesgos e incertidumbre", nombre: "Identificación y análisis de riesgos", desc: "Análisis cualitativo y cuantitativo de riesgos técnicos, ciberseguridad, adopción de mercado y normativa.", max: 3 , niveles: [
            { nombre: "Excelente", pts: 3, desc: "Riesgos técnicos, de ciberseguridad, de mercado y normativos con análisis cualitativo y cuantitativo." },
            { nombre: "Bueno", pts: 2, desc: "Riesgos variados, pero solo con análisis cualitativo." },
            { nombre: "Regular", pts: 1, desc: "Pocos riesgos y genéricos." },
            { nombre: "Deficiente", pts: 0, desc: "Sin identificación ni análisis de riesgos." },
          ] },
          { id: "v7", grupo: "3. Plan de gestión de riesgos e incertidumbre", nombre: "Planes de mitigación y contingencia", desc: "Estrategias concretas para riesgos de alto impacto y responsables asignados.", max: 1 , niveles: [
            { nombre: "Cumple", pts: 1, desc: "Presenta planes concretos con responsables para los riesgos de alto impacto." },
            { nombre: "No cumple", pts: 0, desc: "No presenta planes de mitigación o contingencia concretos." },
          ] },
          { id: "v8", grupo: "3. Plan de gestión de riesgos e incertidumbre", nombre: "Modelación de incertidumbre y pivotes", desc: "Flexibilidad del proyecto frente a escenarios de incertidumbre de mercado.", max: 1 , niveles: [
            { nombre: "Cumple", pts: 1, desc: "Plantea escenarios de incertidumbre y cómo pivotaría el proyecto." },
            { nombre: "No cumple", pts: 0, desc: "No aborda la incertidumbre ni posibles pivotes." },
          ] },
          { id: "v9", grupo: "4. Plan financiero y costos", nombre: "Estructura de costos", desc: "Desglose de CAPEX y OPEX usando la Estructura de Desglose de Costos (EDC).", max: 3 , niveles: [
            { nombre: "Excelente", pts: 3, desc: "CAPEX y OPEX desglosados con una EDC completa." },
            { nombre: "Bueno", pts: 2, desc: "Desglose con algunos vacíos." },
            { nombre: "Regular", pts: 1, desc: "Monto global con poco detalle." },
            { nombre: "Deficiente", pts: 0, desc: "Sin estructura de costos." },
          ] },
          { id: "v10", grupo: "4. Plan financiero y costos", nombre: "Sustento de reservas", desc: "Reserva de contingencia (10 %) y reserva de gestión (5 %) justificadas.", max: 2 , niveles: [
            { nombre: "Excelente", pts: 2, desc: "Reserva de contingencia (10 %) y de gestión (5 %) calculadas y justificadas." },
            { nombre: "Regular", pts: 1, desc: "Reservas presentes pero sin justificar o mal calculadas." },
            { nombre: "Deficiente", pts: 0, desc: "Sin reservas." },
          ] },
          { id: "v11", grupo: "4. Plan financiero y costos", nombre: "Unit economics y modelo de ingresos", desc: "Precio de venta, costo unitario, margen estimado y punto de equilibrio.", max: 3 , niveles: [
            { nombre: "Excelente", pts: 3, desc: "Precio, costo unitario, margen y punto de equilibrio calculados y coherentes entre sí." },
            { nombre: "Bueno", pts: 2, desc: "Falta uno de esos cuatro elementos." },
            { nombre: "Regular", pts: 1, desc: "Cálculos incompletos o incoherentes." },
            { nombre: "Deficiente", pts: 0, desc: "Sin modelo de ingresos." },
          ] },
          { id: "v12", grupo: "5. Video pitch resumen del MVP (máx. 3 min)", nombre: "Claridad del mensaje y storytelling", desc: "Comunicación fluida del problema, la solución y la propuesta de valor.", max: 3 , niveles: [
            { nombre: "Excelente", pts: 3, desc: "Comunica problema, solución y valor de forma fluida y memorable." },
            { nombre: "Bueno", pts: 2, desc: "Mensaje claro pero plano." },
            { nombre: "Regular", pts: 1, desc: "Confuso en algunas partes." },
            { nombre: "Deficiente", pts: 0, desc: "No se entiende la propuesta." },
          ] },
          { id: "v13", grupo: "5. Video pitch resumen del MVP (máx. 3 min)", nombre: "Demostración del prototipo o MVP", desc: "Muestra clara del diseño funcional, arquitectura, mockup o demo operativa.", max: 5 , niveles: [
            { nombre: "Excelente", pts: 5, desc: "Muestra una demo operativa o prototipo funcional del flujo principal." },
            { nombre: "Muy bueno", pts: 4, desc: "Prototipo interactivo con partes simuladas." },
            { nombre: "Bueno", pts: 3, desc: "Mockup navegable sin funcionalidad real." },
            { nombre: "Regular", pts: 2, desc: "Solo imágenes estáticas o diseño." },
            { nombre: "Deficiente", pts: 1, desc: "No muestra el prototipo." },
          ] },
          { id: "v14", grupo: "5. Video pitch resumen del MVP (máx. 3 min)", nombre: "Calidad audiovisual y tiempo", desc: "Producción, creatividad, edición y cumplimiento estricto de los 3 minutos.", max: 2 , niveles: [
            { nombre: "Excelente", pts: 2, desc: "Buena producción y edición, dentro de los 3 minutos." },
            { nombre: "Regular", pts: 1, desc: "Calidad aceptable o excede el tiempo por pocos segundos." },
            { nombre: "Deficiente", pts: 0, desc: "Calidad deficiente o excede claramente el tiempo." },
          ] },
        ],
      },
      {
        id: "presencial", nombre: "Fase presencial · Pitch, prototipo y preguntas", max: 60,
        criterios: [
          { id: "p1", grupo: "1. Propuesta de valor, mercado e innovación", nombre: "Originalidad y propuesta de valor", desc: "Claridad del problema, grado de innovación tecnológica y diferenciador frente a soluciones existentes.", max: 7.5 , niveles: [
            { nombre: "Excelente", pts: 7.5, desc: "Problema claro, alto grado de innovación y diferenciador evidente frente a soluciones existentes." },
            { nombre: "Muy bueno", pts: 6, desc: "Propuesta innovadora con diferenciación clara, algo menos sustentada." },
            { nombre: "Bueno", pts: 5, desc: "Innovación moderada; el diferenciador no es claro." },
            { nombre: "Regular", pts: 3, desc: "Propuesta poco original, parecida a lo que ya existe." },
            { nombre: "Deficiente", pts: 2, desc: "Sin propuesta de valor clara." },
          ] },
          { id: "p2", grupo: "1. Propuesta de valor, mercado e innovación", nombre: "Mercado objetivo y modelo de negocio", desc: "Sustento de TAM, SAM y SOM, estrategia comercial y viabilidad para generar ingresos y escalar.", max: 7.5 , niveles: [
            { nombre: "Excelente", pts: 7.5, desc: "TAM, SAM y SOM sustentados con fuentes, estrategia comercial clara y modelo de ingresos escalable." },
            { nombre: "Muy bueno", pts: 6, desc: "Mercado bien estimado; estrategia comercial algo general." },
            { nombre: "Bueno", pts: 5, desc: "Mercado estimado sin sustento; modelo de ingresos sin cifras." },
            { nombre: "Regular", pts: 3, desc: "Mercado mal definido o modelo poco viable." },
            { nombre: "Deficiente", pts: 2, desc: "Sin análisis de mercado ni modelo de negocio." },
          ] },
          { id: "p3", grupo: "2. Viabilidad de ejecución y plan de proyecto", nombre: "Hoja de ruta y plan de despliegue", desc: "Coherencia técnica del plan, hitos, cronograma estimado y presupuesto.", max: 10 , niveles: [
            { nombre: "Excelente", pts: 10, desc: "Plan coherente con hitos, cronograma y presupuesto alineados y realistas." },
            { nombre: "Muy bueno", pts: 8, desc: "Plan coherente con pequeñas brechas entre hitos y presupuesto." },
            { nombre: "Bueno", pts: 6, desc: "Hitos y presupuesto presentes pero poco detallados." },
            { nombre: "Regular", pts: 4, desc: "Plan incompleto o poco realista." },
            { nombre: "Deficiente", pts: 2, desc: "Sin hoja de ruta." },
          ] },
          { id: "p4", grupo: "2. Viabilidad de ejecución y plan de proyecto", nombre: "Gestión de riesgos e incertidumbre", desc: "Principales riesgos tecnológicos, de adopción o financieros y solidez del plan de mitigación.", max: 5 , niveles: [
            { nombre: "Excelente", pts: 5, desc: "Riesgos tecnológicos, de adopción y financieros identificados con un plan de mitigación sólido." },
            { nombre: "Muy bueno", pts: 4, desc: "Riesgos bien identificados; mitigación algo general." },
            { nombre: "Bueno", pts: 3, desc: "Riesgos genéricos con mitigación débil." },
            { nombre: "Regular", pts: 2, desc: "Menciona pocos riesgos y sin mitigación." },
            { nombre: "Deficiente", pts: 1, desc: "No aborda los riesgos." },
          ] },
          { id: "p5", grupo: "3. Pitch escénico, storytelling y demo del MVP", nombre: "Demostración visual del prototipo", desc: "Claridad, atractivo visual y operatividad de la muestra en vivo.", max: 5 , niveles: [
            { nombre: "Excelente", pts: 5, desc: "Demo en vivo clara, atractiva y operativa." },
            { nombre: "Muy bueno", pts: 4, desc: "Demo funcional con detalles visuales mejorables." },
            { nombre: "Bueno", pts: 3, desc: "Demo parcial o con fallas menores." },
            { nombre: "Regular", pts: 2, desc: "Solo maqueta o video, sin interacción." },
            { nombre: "Deficiente", pts: 1, desc: "No muestra el prototipo o falla." },
          ] },
          { id: "p6", grupo: "3. Pitch escénico, storytelling y demo del MVP", nombre: "Storytelling, dominio escénico y tiempo", desc: "Narrativa convincente, solidez de los oradores, profesionalismo y máximo 5 minutos.", max: 10 , niveles: [
            { nombre: "Excelente", pts: 10, desc: "Narrativa convincente, oradores seguros y profesionales, dentro de los 5 minutos." },
            { nombre: "Muy bueno", pts: 8, desc: "Buena narrativa y seguridad; leve exceso de tiempo o pausas." },
            { nombre: "Bueno", pts: 6, desc: "Exposición ordenada pero poco persuasiva o desbalanceada entre oradores." },
            { nombre: "Regular", pts: 4, desc: "Lectura, nervios evidentes o excede claramente el tiempo." },
            { nombre: "Deficiente", pts: 2, desc: "No logra transmitir la propuesta." },
          ] },
          { id: "p7", grupo: "4. Ronda de preguntas y defensa técnica", nombre: "Solidez y precisión de las respuestas", desc: "Fundamentación y seguridad ante objeciones comerciales, técnicas o financieras.", max: 12 , niveles: [
            { nombre: "Excelente", pts: 12, desc: "Respuestas precisas y fundamentadas ante objeciones comerciales, técnicas y financieras." },
            { nombre: "Muy bueno", pts: 10, desc: "Responde bien casi todas; una respuesta es débil." },
            { nombre: "Bueno", pts: 7, desc: "Respuestas correctas pero generales en varios temas." },
            { nombre: "Regular", pts: 5, desc: "Respuestas vagas o con errores." },
            { nombre: "Deficiente", pts: 2, desc: "No responde o se contradice." },
          ] },
          { id: "p8", grupo: "4. Ronda de preguntas y defensa técnica", nombre: "Dominio y trabajo multidisciplinario", desc: "Participación distribuida del equipo respondiendo según sus roles (Tech, PM, Finanzas, CEO).", max: 3 , niveles: [
            { nombre: "Excelente", pts: 3, desc: "Cada integrante responde según su rol (Tech, PM, Finanzas, CEO)." },
            { nombre: "Bueno", pts: 2, desc: "Responden varios, pero uno domina las respuestas." },
            { nombre: "Regular", pts: 1, desc: "Casi solo una persona responde." },
            { nombre: "Deficiente", pts: 0, desc: "Nadie asume las respuestas según su rol." },
          ] },
        ],
      },
    ],
  },
  {
    id: "iathon",
    nombre: "IATHON",
    apodo: "Mini hackathon de IA",
    tipo: "academico",
    modo: "rubrica",
    maxCopa: 70,
    jurados: 3,
    color: "turquesa",
    sanciones: ["walkover", "descalificado"],
    nota: "El puntaje final es el promedio de los 3 jurados, redondeado a entero.",
    subpruebas: [
      {
        id: "unica", nombre: "Rúbrica oficial IATHON", max: 70,
        criterios: [
          { id: "c1", nombre: "Identificación del problema y propuesta de valor", desc: "Claridad en la problemática nacional asignada y pertinencia de la solución para atacar la causa raíz.", max: 10 , niveles: [
            { nombre: "Excelente", pts: 10, desc: "Define con precisión el problema nacional asignado, su causa raíz y a quién afecta; la solución ataca directamente esa causa." },
            { nombre: "Muy bueno", pts: 8, desc: "Problema claro y solución pertinente; la causa raíz se menciona sin profundizar." },
            { nombre: "Bueno", pts: 6, desc: "Problema descrito en términos generales; la solución atiende síntomas más que la causa." },
            { nombre: "Regular", pts: 4, desc: "Problema confuso o distinto al asignado; la solución se relaciona poco con él." },
            { nombre: "Deficiente", pts: 2, desc: "No identifica el problema o la solución no tiene relación con él." },
          ] },
          { id: "c2", nombre: "Viabilidad de negocio e impacto", desc: "Potencial de implementación, escalabilidad, sostenibilidad y alcance del impacto social.", max: 10 , niveles: [
            { nombre: "Excelente", pts: 10, desc: "Explica cómo se implementaría, cómo escala, cómo se sostiene en el tiempo y estima a cuántas personas impacta." },
            { nombre: "Muy bueno", pts: 8, desc: "Viabilidad e impacto bien explicados; falta sustentar la sostenibilidad o la escala." },
            { nombre: "Bueno", pts: 6, desc: "La viabilidad es posible pero solo se describe; el impacto no se estima." },
            { nombre: "Regular", pts: 4, desc: "Implementación poco realista o impacto muy limitado." },
            { nombre: "Deficiente", pts: 2, desc: "No es viable o no explica su impacto." },
          ] },
          { id: "c3", nombre: "Innovación y diferenciación de mercado", desc: "Originalidad frente a las alternativas actuales y valor diferencial.", max: 10 , niveles: [
            { nombre: "Excelente", pts: 10, desc: "Propuesta original que se diferencia claramente de las alternativas actuales y lo demuestra comparándose con ellas." },
            { nombre: "Muy bueno", pts: 8, desc: "Propuesta original con diferenciación clara, aunque sin comparación detallada." },
            { nombre: "Bueno", pts: 6, desc: "Combina ideas conocidas con un aporte propio moderado." },
            { nombre: "Regular", pts: 4, desc: "Muy parecida a soluciones existentes; la diferencia es mínima." },
            { nombre: "Deficiente", pts: 2, desc: "Replica una solución existente sin aporte propio." },
          ] },
          { id: "c4", nombre: "Calidad técnica y usabilidad del MVP", desc: "Desarrollo visual (UI/UX), navegación intuitiva, estabilidad e interacción funcional en vivo, sin importar la herramienta.", max: 20 , niveles: [
            { nombre: "Excelente", pts: 20, desc: "MVP funcional en vivo, estable, con interfaz clara y navegación intuitiva; el flujo principal funciona de principio a fin." },
            { nombre: "Muy bueno", pts: 16, desc: "Funciona en vivo con fallas menores de diseño o navegación." },
            { nombre: "Bueno", pts: 12, desc: "Funciona parcialmente: hay partes simuladas o errores visibles." },
            { nombre: "Regular", pts: 8, desc: "Prototipo mayormente estático (maqueta) con poca interacción real." },
            { nombre: "Deficiente", pts: 4, desc: "No hay MVP funcional o falla durante la demostración." },
          ] },
          { id: "c5", nombre: "Pitch comercial y defensa ante el jurado", desc: "Storytelling, persuasión, manejo del tiempo y solvencia en la ronda de preguntas.", max: 20 , niveles: [
            { nombre: "Excelente", pts: 20, desc: "Pitch persuasivo con storytelling y dentro del tiempo; responde todas las preguntas con solvencia técnica y comercial." },
            { nombre: "Muy bueno", pts: 16, desc: "Pitch claro y convincente; una respuesta queda incompleta." },
            { nombre: "Bueno", pts: 12, desc: "Pitch ordenado pero poco persuasivo o con mal manejo del tiempo; respuestas generales." },
            { nombre: "Regular", pts: 8, desc: "Pitch desordenado o leído; respuestas vagas." },
            { nombre: "Deficiente", pts: 4, desc: "No logra comunicar la propuesta ni responder las preguntas." },
          ] },
        ],
      },
    ],
  },
  {
    id: "amateur-1",
    nombre: "Amateur I",
    apodo: "Acta de constitución",
    tipo: "academico",
    modo: "rubrica",
    maxCopa: 60,
    jurados: 3,
    color: "celeste",
    sanciones: ["retraso", "walkover", "descalificado"],
    retrasoGrupo: F2_A1,
    nota: "Elige un nivel por criterio: cada nivel tiene un puntaje entero y su descripción. Retraso en la entrega del acta: −10 % de la fase escrita.",
    subpruebas: [
      {
        id: "unica", nombre: "Rúbrica oficial Amateur I", max: 60,
        criterios: [
          { id: "c1", grupo: F1_A1, nombre: "Estructura oral y storytelling", desc: "Claridad del discurso, síntesis del caso, manejo del tiempo, impacto visual del acta y participación del equipo.", max: 15, niveles: [
            { nombre: "Excelente", pts: 15, desc: "Discurso claro y persuasivo con secuencia completa (problema → proyecto → valor → cierre). Sintetiza el caso sin omitir lo esencial, termina dentro del tiempo, el acta se ve limpia y legible, y todos los integrantes participan con roles definidos." },
            { nombre: "Muy bueno", pts: 12, desc: "Discurso claro y bien ordenado con pausas o repeticiones menores. Buena síntesis, respeta el tiempo con un margen mínimo, apoyo visual correcto y participa la mayoría del equipo." },
            { nombre: "Bueno", pts: 9, desc: "Se entiende la propuesta, pero la secuencia es irregular o se extiende en detalles. Usa el tiempo de forma desigual (corre al final o sobra mucho), apoyo visual básico y la exposición recae en 2 o 3 personas." },
            { nombre: "Regular", pts: 6, desc: "Discurso desordenado o leído; cuesta identificar el problema y el proyecto. Excede o se queda muy corto de tiempo, el apoyo visual distrae o no se ve, y solo exponen 1 o 2 integrantes." },
            { nombre: "Deficiente", pts: 3, desc: "No logra explicar el proyecto, improvisa de forma evidente y no usa el acta como apoyo. Expone una sola persona o el equipo se ve desorganizado." },
          ] },
          { id: "c2", grupo: F1_A1, nombre: "Ronda de preguntas", desc: "Dominio técnico de conceptos PMI, respuesta ante cuestionamientos, cohesión y fundamentación.", max: 10, niveles: [
            { nombre: "Excelente", pts: 10, desc: "Responde todas las preguntas con precisión, usa correctamente los términos PMI (alcance, interesados, supuestos, restricciones) y fundamenta con datos de su propia acta. El equipo se reparte las respuestas con naturalidad." },
            { nombre: "Muy bueno", pts: 8, desc: "Responde bien casi todas las preguntas; solo una queda incompleta. Buen uso de conceptos PMI y el equipo se muestra coordinado." },
            { nombre: "Bueno", pts: 6, desc: "Responde la mayoría, pero algunas respuestas son generales o sin sustento. Usa parcialmente los términos PMI y se notan dudas sobre quién debe responder." },
            { nombre: "Regular", pts: 4, desc: "Respuestas vagas, evasivas o con errores conceptuales, a veces contradictorias con lo escrito en el acta. Poca coordinación del equipo." },
            { nombre: "Deficiente", pts: 2, desc: "No responde o responde fuera de tema, desconoce conceptos básicos de gestión de proyectos y los integrantes se contradicen entre sí." },
          ] },
          { id: "c3", grupo: F2_A1, nombre: "Propósito, justificación y alineación estratégica", desc: "Coherencia entre el problema nacional, la justificación y el valor social o económico generado.", max: 8, niveles: [
            { nombre: "Excelente", pts: 8, desc: "Problema nacional real, bien delimitado y respaldado con datos o fuentes. La justificación es lógica y el valor social o económico es concreto y medible. Coherencia total entre problema, proyecto y beneficio." },
            { nombre: "Muy bueno", pts: 6, desc: "Problema claro y justificado con al menos un dato. El valor generado está identificado pero no cuantificado. Coherencia alta con pequeños vacíos." },
            { nombre: "Bueno", pts: 5, desc: "Problema pertinente pero general o sin datos que lo respalden. La justificación es solo descriptiva y el valor se menciona de forma genérica." },
            { nombre: "Regular", pts: 3, desc: "Problema difuso o poco vinculado a la realidad nacional. Justificación débil y el valor propuesto no se relaciona con el problema." },
            { nombre: "Deficiente", pts: 2, desc: "No se identifica el problema ni el propósito del proyecto, no hay justificación o el proyecto no responde al problema planteado." },
          ] },
          { id: "c4", grupo: F2_A1, nombre: "Objetivos SMART, criterios de éxito y alcance", desc: "Redacción técnica SMART y delimitación explícita de lo que incluye y excluye el alcance.", max: 10, niveles: [
            { nombre: "Excelente", pts: 10, desc: "Los objetivos cumplen los 5 componentes SMART (específico, medible con indicador y meta, alcanzable, relevante y con fecha). Criterios de éxito medibles y alcance con lo que incluye y lo que excluye de forma explícita." },
            { nombre: "Muy bueno", pts: 8, desc: "Objetivos SMART con un solo componente débil (por ejemplo, meta o fecha poco precisa). Criterios de éxito claros y alcance con inclusiones y exclusiones, aunque alguna es general." },
            { nombre: "Bueno", pts: 6, desc: "Objetivos entendibles a los que les faltan 2 componentes SMART (casi siempre la medición y el plazo). Criterios de éxito generales y alcance que solo indica lo que incluye." },
            { nombre: "Regular", pts: 4, desc: "Objetivos redactados como actividades o deseos, sin indicadores. Criterios de éxito ausentes o no medibles y alcance ambiguo." },
            { nombre: "Deficiente", pts: 2, desc: "No presenta objetivos, o no corresponden al proyecto. Sin criterios de éxito ni delimitación del alcance." },
          ] },
          { id: "c5", grupo: F2_A1, nombre: "Planificación base (riesgos, hitos y presupuesto)", desc: "Riesgos críticos de alto nivel, lógica del cronograma de hitos y coherencia presupuestal.", max: 10, niveles: [
            { nombre: "Excelente", pts: 10, desc: "Identifica al menos 3 riesgos de alto nivel propios del proyecto con su posible impacto, hitos en secuencia lógica y con fecha, y un presupuesto estimado desglosado y coherente con el alcance y los hitos." },
            { nombre: "Muy bueno", pts: 8, desc: "Riesgos pertinentes, hitos con fechas y presupuesto razonable con desglose general. Hay pequeñas inconsistencias entre los tres elementos." },
            { nombre: "Bueno", pts: 6, desc: "Riesgos genéricos (servirían para cualquier proyecto), hitos sin fechas o con secuencia discutible y presupuesto como monto global sin sustento." },
            { nombre: "Regular", pts: 4, desc: "Solo uno de los tres elementos está bien desarrollado; los otros están incompletos o confunden riesgos con problemas actuales." },
            { nombre: "Deficiente", pts: 2, desc: "Faltan dos o los tres elementos, o no guardan relación con el proyecto propuesto." },
          ] },
          { id: "c6", grupo: F2_A1, nombre: "Gobernanza, interesados y cierre formal", desc: "Interesados clave, autoridad del PM, criterios de aprobación y firmas de los responsables.", max: 7, niveles: [
            { nombre: "Excelente", pts: 7, desc: "Identifica a los interesados clave internos y externos con su rol o interés, define el nivel de autoridad del director del proyecto, fija criterios de aprobación claros e incluye las firmas del patrocinador y los responsables." },
            { nombre: "Muy bueno", pts: 6, desc: "Interesados y autoridad del director del proyecto bien definidos y criterios de aprobación presentes. Falta una firma o un detalle menor." },
            { nombre: "Bueno", pts: 4, desc: "Lista de interesados sin su rol, autoridad del director mencionada de forma general, criterios de aprobación vagos y firmas incompletas." },
            { nombre: "Regular", pts: 3, desc: "Interesados incompletos, sin autoridad del director del proyecto ni criterios de aprobación, y sin firmas." },
            { nombre: "Deficiente", pts: 1, desc: "No incluye la sección de gobernanza: sin interesados, sin autoridad definida, sin criterios de aprobación y sin firmas." },
          ] },
        ],
      },
    ],
  },
  {
    id: "amateur-2",
    nombre: "Amateur II",
    apodo: "Matriz de riesgos",
    tipo: "academico",
    modo: "rubrica",
    maxCopa: 60,
    jurados: 3,
    color: "naranja",
    sanciones: ["retraso", "walkover", "descalificado"],
    retrasoGrupo: F2_A2,
    nota: "Retraso en la entrega de la matriz: −10 % del puntaje de la fase escrita.",
    subpruebas: [
      {
        id: "unica", nombre: "Rúbrica oficial Amateur II", max: 60,
        criterios: [
          { id: "c1", grupo: F1_A2, nombre: "Estructura oral y criterio de priorización", desc: "Claridad al explicar por qué ciertos riesgos son críticos, manejo del tiempo y participación del equipo.", max: 10 , niveles: [
            { nombre: "Excelente", pts: 10, desc: "Explica con claridad por qué los riesgos priorizados son críticos (probabilidad × impacto), sigue un hilo lógico, termina dentro del tiempo y participan todos los integrantes." },
            { nombre: "Muy bueno", pts: 8, desc: "Explica la priorización con buen orden, aunque algún riesgo crítico queda sin sustento completo. Tiempo adecuado y participa la mayoría del equipo." },
            { nombre: "Bueno", pts: 6, desc: "Presenta los riesgos, pero justifica poco por qué unos son más críticos que otros. Uso desigual del tiempo y exponen 2 o 3 integrantes." },
            { nombre: "Regular", pts: 4, desc: "Lee la matriz sin explicar la priorización. Excede o se queda muy corto de tiempo y la participación es mínima." },
            { nombre: "Deficiente", pts: 2, desc: "No explica la priorización ni el caso. Desorden evidente o un solo expositor." },
          ] },
          { id: "c2", grupo: F1_A2, nombre: "Ronda de preguntas", desc: "Sustento de la viabilidad de las acciones, dominio de estrategias PMI y cohesión del equipo.", max: 15 , niveles: [
            { nombre: "Excelente", pts: 15, desc: "Sustenta la viabilidad de cada acción con argumentos y datos, domina las estrategias PMI (evitar, transferir, mitigar, aceptar, explotar, mejorar, compartir) y el equipo responde coordinado." },
            { nombre: "Muy bueno", pts: 12, desc: "Responde bien casi todas las preguntas; solo una queda incompleta. Buen dominio de las estrategias y equipo coordinado." },
            { nombre: "Bueno", pts: 9, desc: "Varias respuestas son generales o sin sustento y confunde alguna estrategia PMI." },
            { nombre: "Regular", pts: 6, desc: "Respuestas vagas, con errores conceptuales o contradictorias con su propia matriz." },
            { nombre: "Deficiente", pts: 3, desc: "No responde o desconoce las estrategias básicas de respuesta a riesgos." },
          ] },
          { id: "c3", grupo: F2_A2, nombre: "Sintaxis y redacción PMI (causa-riesgo-efecto)", desc: "Diferencia correcta entre causa, evento de riesgo y efecto, sin confundir problemas con riesgos.", max: 10 , niveles: [
            { nombre: "Excelente", pts: 10, desc: "Todos los riesgos siguen la estructura «Debido a <causa>, puede ocurrir <evento incierto>, lo que provocaría <efecto>» y ninguno es un problema que ya ocurrió." },
            { nombre: "Muy bueno", pts: 8, desc: "Casi todos los riesgos tienen la estructura completa; uno o dos con causa o efecto poco preciso." },
            { nombre: "Bueno", pts: 6, desc: "La mitad cumple la estructura; algunos riesgos están redactados como problemas actuales o sin efecto." },
            { nombre: "Regular", pts: 4, desc: "La mayoría no tiene estructura y mezcla causas, riesgos y efectos." },
            { nombre: "Deficiente", pts: 2, desc: "Presenta una lista de problemas o temas sueltos, no riesgos." },
          ] },
          { id: "c4", grupo: F2_A2, nombre: "Análisis cualitativo", desc: "Coherencia de probabilidad e impacto (1-5), cálculo correcto y equilibrio entre amenazas y oportunidades.", max: 8 , niveles: [
            { nombre: "Excelente", pts: 8, desc: "Probabilidad e impacto (1-5) coherentes con el caso, cálculo de severidad correcto y matriz equilibrada entre amenazas y oportunidades." },
            { nombre: "Muy bueno", pts: 6, desc: "Valoraciones coherentes con uno o dos casos discutibles, cálculo correcto pero pocas oportunidades identificadas." },
            { nombre: "Bueno", pts: 5, desc: "Algunas valoraciones arbitrarias o errores menores de cálculo; solo considera amenazas." },
            { nombre: "Regular", pts: 3, desc: "Valoraciones sin lógica o varios errores de cálculo." },
            { nombre: "Deficiente", pts: 2, desc: "No hay análisis de probabilidad e impacto o es totalmente incorrecto." },
          ] },
          { id: "c5", grupo: F2_A2, nombre: "Estrategias y acciones concretas de respuesta", desc: "Alineación entre la estrategia PMI elegida y el realismo de la acción propuesta.", max: 10 , niveles: [
            { nombre: "Excelente", pts: 10, desc: "Cada riesgo tiene la estrategia PMI correcta según su tipo (amenaza u oportunidad) y una acción concreta, realista y verificable." },
            { nombre: "Muy bueno", pts: 8, desc: "Estrategias bien elegidas; una o dos acciones quedan generales." },
            { nombre: "Bueno", pts: 6, desc: "Estrategias correctas pero acciones vagas («monitorear», «tener cuidado»)." },
            { nombre: "Regular", pts: 4, desc: "Estrategias mal elegidas (por ejemplo, explotar una amenaza) o acciones poco realistas." },
            { nombre: "Deficiente", pts: 2, desc: "No presenta estrategias ni acciones de respuesta." },
          ] },
          { id: "c6", grupo: F2_A2, nombre: "Dueño del riesgo y disparadores", desc: "Risk owner asignado por rol y condiciones claras que activan la respuesta.", max: 7 , niveles: [
            { nombre: "Excelente", pts: 7, desc: "Cada riesgo tiene un dueño asignado por rol y un disparador observable que indica cuándo activar la respuesta." },
            { nombre: "Muy bueno", pts: 6, desc: "Dueños y disparadores en casi todos los riesgos; alguno poco preciso." },
            { nombre: "Bueno", pts: 4, desc: "Dueños asignados, pero disparadores genéricos o ausentes en varios riesgos." },
            { nombre: "Regular", pts: 3, desc: "Dueños genéricos («el equipo») y muy pocos disparadores." },
            { nombre: "Deficiente", pts: 1, desc: "Sin dueños ni disparadores." },
          ] },
        ],
      },
    ],
  },
  {
    id: "conocimientos",
    nombre: "Concurso Nacional de Conocimientos",
    apodo: "Examen tipo CAPM",
    tipo: "academico",
    modo: "manual_puntos",
    maxCopa: 70,
    jurados: 0,
    color: "violeta",
    nota: "El organizador registra los puntos de los 2 enfrentamientos de cada delegación (máx. 35 cada uno) y contra quién jugó. Máximo 70 pts.",
  },

  // ---------------- CULTURALES ----------------
  {
    id: "gymkana",
    nombre: "Gran Gymkana",
    apodo: "5 minijuegos",
    tipo: "cultural",
    modo: "gymkana",
    maxCopa: 80,
    jurados: 1,
    color: "naranja",
    nota: "Cada minijuego asigna puntos según el puesto. Si dos delegaciones empatan, comparten el promedio de puntos (redondeado).",
    subpruebas: [
      {
        id: "sacos", nombre: "Carrera de sacos + cultura general", corto: "Sacos", max: 16, entrada: "tablero", rondas: 16,
        reglas: "Marca en el tablero qué delegación ganó cada ronda (solo 1 por ronda). El CONTADOR suma los checks y la tabla final se ordena sola.",
        tabla: [16, 13, 10, 7, 4], tablaTxt: ["1.°", "2.°", "3.°", "4.°", "5.° en adelante"],
      },
      {
        id: "baileton", nombre: "Bailetón de mascotas universitarias", corto: "Bailetón", max: 16, entrada: "rubrica",
        reglas: "Califica a cada mascota con la rúbrica oficial (Tabla 3.5). El puntaje sobre 100 ordena el ranking del Bailetón.",
        tabla: [16, 13, 10, 7, 7], resto: 4, tablaTxt: ["1.° (ganador del duelo final)", "2.°", "3.°", "4.°", "5.°", "6.° en adelante"],
        criterios: [
          { id: "b1", nombre: "Carisma y performance", desc: "Actitud de la mascota, gracia, comedia y dominio del traje. Peso 35 %.", max: 35, niveles: [
            { nombre: "Excelente", pts: 35, desc: "La mascota se adueña de la pista: actitud contagiosa, gestos y comedia que provocan la reacción del público, con dominio total del traje." },
            { nombre: "Muy bueno", pts: 28, desc: "Mucha actitud y gracia, con algún momento plano o una pequeña dificultad con el traje." },
            { nombre: "Bueno", pts: 21, desc: "Carisma correcto pero intermitente; pocas acciones llaman la atención." },
            { nombre: "Regular", pts: 14, desc: "Actitud tímida o poco expresiva; el traje limita sus movimientos." },
            { nombre: "Deficiente", pts: 7, desc: "Casi no transmite personalidad: se queda quieta, no interactúa o sale de escena." },
          ] },
          { id: "b2", nombre: "Versatilidad y ritmo", desc: "Adaptación a los cambios bruscos de género musical. Peso 30 %.", max: 30, niveles: [
            { nombre: "Excelente", pts: 30, desc: "Se adapta al instante a cada cambio de género musical y mantiene el ritmo en todos." },
            { nombre: "Muy bueno", pts: 24, desc: "Se adapta a casi todos los cambios, con un ligero retraso en alguno." },
            { nombre: "Bueno", pts: 18, desc: "Sigue el ritmo en los géneros conocidos, pero le cuestan los cambios bruscos." },
            { nombre: "Regular", pts: 12, desc: "Repite los mismos pasos sin importar la música." },
            { nombre: "Deficiente", pts: 6, desc: "No sigue el ritmo ni reacciona a los cambios de música." },
          ] },
          { id: "b3", nombre: "Resistencia física", desc: "Energía y baile fluido durante toda la maratón. Peso 20 %.", max: 20, niveles: [
            { nombre: "Excelente", pts: 20, desc: "Baila con la misma energía de principio a fin de la maratón." },
            { nombre: "Muy bueno", pts: 16, desc: "Baja levemente la energía al final, sin detenerse." },
            { nombre: "Bueno", pts: 12, desc: "Hace pausas cortas o baja notoriamente el ritmo en la segunda mitad." },
            { nombre: "Regular", pts: 8, desc: "Se detiene varias veces o baila a medias." },
            { nombre: "Deficiente", pts: 4, desc: "Abandona o deja de bailar gran parte del tiempo." },
          ] },
          { id: "b4", nombre: "Interacción y barra", desc: "Hacer cantar, saltar y gritar a su delegación. Peso 15 %.", max: 15, niveles: [
            { nombre: "Excelente", pts: 15, desc: "Hace cantar, saltar y gritar a toda su delegación de forma constante." },
            { nombre: "Muy bueno", pts: 12, desc: "Logra buena respuesta de su barra en la mayoría de momentos." },
            { nombre: "Bueno", pts: 9, desc: "Interactúa con su barra solo en algunos momentos." },
            { nombre: "Regular", pts: 6, desc: "Poca interacción: la barra reacciona por su cuenta." },
            { nombre: "Deficiente", pts: 3, desc: "No interactúa con su delegación." },
          ] },
        ],
      },
      {
        id: "pentatlon", nombre: "Pentatlón", corto: "Pentatlón", max: 28, entrada: "tiempo", topeSeg: 300,
        reglas: "Usa el cronómetro de cada delegación o escribe su tiempo. Si no terminó en 5:00, marca la estación en la que se quedó (1 a 5): desempata entre los que no terminaron.",
        tabla: [28, 22, 17, 12, 7], tablaTxt: ["1.°", "2.°", "3.°", "4.°", "5.° en adelante"],
      },
      {
        id: "liga", nombre: "Ponte la liga", corto: "Ponte la liga", max: 10, entrada: "eliminatoria", tamSerie: 4, clasifican: 1,
        reglas: "Series de hasta 4 delegaciones. El 1.° de cada serie pasa a la Gran Final; la llegada en la final define 1.°, 2.° y 3.°. Eliminados en series: 4 pts.",
        tablaFinal: [10, 8, 6], eliminado: 4,
      },
      {
        id: "globos", nombre: "Tren de globos", corto: "Tren de globos", max: 10, entrada: "eliminatoria", tamSerie: 5, clasifican: 3,
        reglas: "Series de hasta 5 delegaciones. Las 3 primeras en reventar su globo pasan a la Gran Final; el orden en la final define del 1.° al 6.°. Eliminados en series: 2 pts.",
        tablaFinal: [10, 8, 6, 5, 4, 3], eliminado: 2,
      },
    ],
  },
  {
    id: "barras",
    nombre: "Concurso de Barras",
    apodo: "Show de 2 a 4 minutos",
    tipo: "cultural",
    modo: "rubrica",
    maxCopa: 50,
    jurados: 3,
    color: "celeste",
    sanciones: ["walkover", "descalificado"],
    conversion: { tabla: [50, 40, 30, 22, 15], resto: 10, txt: ["1.°", "2.°", "3.°", "4.°", "5.°", "6.° al último"] },
    desempate: ["c3", "c1", "c2"],
    nota: "La rúbrica (100 pts) define el ranking; el puesto se convierte a puntos de la Copa: 50, 40, 30, 22, 15 y 10. Desempate: criterio 3, luego 1, luego 2.",
    subpruebas: [
      {
        id: "unica", nombre: "Rúbrica oficial · Tabla 3.2", max: 100,
        criterios: [
          { id: "c1", nombre: "Mascota universitaria e interacción", max: 20, niveles: [
            { nombre: "Excelente", pts: 20, desc: "Participa activamente toda la presentación, interactúa con la barra, pasos coordinados y lidera la vibra del equipo." },
            { nombre: "Bueno", pts: 15, desc: "Está presente pero su participación es intermitente o pasiva." },
            { nombre: "Regular", pts: 10, desc: "Solo entra al inicio o al final, o tiene mínima interacción." },
            { nombre: "Deficiente", pts: 5, desc: "No presentan mascota o su presencia interrumpe negativamente el show." },
          ] },
          { id: "c2", nombre: "Identidad de marca y recursos visuales", max: 20, niveles: [
            { nombre: "Excelente", pts: 20, desc: "Polos, banderolas, pancartas, globos y colores unificados de su universidad. Gran impacto visual." },
            { nombre: "Bueno", pts: 15, desc: "Polos y banderas, pero con menor unificación o impacto." },
            { nombre: "Regular", pts: 10, desc: "Pocos elementos representativos o desorganización visual." },
            { nombre: "Deficiente", pts: 5, desc: "Sin distinción clara de la universidad o vestimenta heterogénea." },
          ] },
          { id: "c3", nombre: "Cánticos, energía y coordinación", max: 20, niveles: [
            { nombre: "Excelente", pts: 20, desc: "Potencia vocal alta, cánticos originales de su universidad, ritmo constante y gran sincronización." },
            { nombre: "Bueno", pts: 15, desc: "Buena potencia y energía, con pequeñas fallas de ritmo o coordinación." },
            { nombre: "Regular", pts: 10, desc: "Cánticos genéricos, poca potencia o desincronización visible." },
            { nombre: "Deficiente", pts: 5, desc: "Grupo desorganizado y baja fuerza vocal." },
          ] },
          { id: "c4", nombre: "Creatividad, show y pista musical", max: 20, niveles: [
            { nombre: "Excelente", pts: 20, desc: "Puesta en escena dinámica, coreografía, dramatización, uso limpio de la pista MP3 y transiciones ágiles." },
            { nombre: "Bueno", pts: 15, desc: "Show vistoso pero tradicional, buen uso de la pista musical." },
            { nombre: "Regular", pts: 10, desc: "Propuesta simple o descoordinada con la música." },
            { nombre: "Deficiente", pts: 5, desc: "Sin propuesta artística o con fallas técnicas por falta de ensayo." },
          ] },
          { id: "c5", nombre: "Disciplina, tiempo y cuidado del auditorio", max: 20, niveles: [
            { nombre: "Excelente", pts: 20, desc: "Respeta el tiempo (2-4 min de show, 1-2 de transición), deja el escenario impecable y cumple las reglas." },
            { nombre: "Regular", pts: 10, desc: "Excede el tiempo reglamentario del show por unos segundos." },
            { nombre: "Deficiente", pts: 5, desc: "Exceso grave de tiempo o intento de usar materiales no permitidos." },
          ] },
        ],
      },
    ],
  },
  {
    id: "talent",
    nombre: "Talent Show",
    apodo: "Virtual · TikTok e Instagram",
    tipo: "cultural",
    modo: "manual_puesto",
    maxCopa: 50,
    jurados: 0,
    color: "turquesa",
    conversion: { tabla: [50, 40, 30, 22, 15], resto: 10, txt: ["1.°", "2.°", "3.°", "4.°", "5.°", "6.° al último"] },
    nota: "Lo llena el organizador con los likes de TikTok e Instagram de cada delegación. La suma ordena el ranking: 50, 40, 30, 22, 15 y 10 pts; no presentó = 0. No lo califican los jurados.",
  },
];

export const SANCIONES = {
  retraso: { txt: "Entrega tardía", desc: "−10 % del puntaje de la fase escrita" },
  walkover: { txt: "Walkover / no se presentó", desc: "0 puntos en el concurso" },
  descalificado: { txt: "Descalificado", desc: "0 puntos por falta grave" },
};

// Color de cada nivel según su nombre
export const tonoNivel = (nombre) => ({ "Excelente": 0, "Cumple": 0, "Muy bueno": 1, "Bueno": 2, "Regular": 3, "Deficiente": 4, "No cumple": 4 }[nombre] ?? 2);

export const porId = (id) => CONCURSOS.find((c) => c.id === id);
export const sumaMax = (sp) => sp.criterios.reduce((s, c) => s + c.max, 0);

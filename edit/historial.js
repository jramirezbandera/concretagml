// edit/historial.js — Deshacer/rehacer (undo/redo) del estado del modelo.
//
// Fundamento (SPEC §2 regla 4, dossier §4.2, MEJORES_PRACTICAS_GML líneas 607-608):
//   · El modelo/estado es un POJO PLANO (coords como [x,y], sin métodos ni
//     instancias de clase). Por eso `structuredClone` lo copia entero sin
//     perder nada: clona Map/Set/TypedArray/refs circulares, pero NO clonaría
//     funciones ni prototipos — que aquí no existen.
//   · Snapshot POR OPERACIÓN ACABADA (coalescing). No hay eventos DOM en este
//     nivel: el coalescing se modela dejando que EL LLAMANTE decida cuándo
//     hacer `commit` (uno por operación completa, no por cada micro-cambio).
//   · Historial lineal: al hacer `commit` tras uno o varios `undo`, la rama de
//     "redo" que quedaba por delante del presente se descarta.
//   · Pila ACOTADA (por defecto 100, configurable 50-100): al exceder el límite
//     se descarta el snapshot más antiguo.
//
// IMPORTANTE (SPEC §2 regla 4): el objeto `historial` NO forma parte del modelo
// serializable. Guarda clones del estado, pero es una estructura de control
// aparte; nunca se serializa a GML ni se persiste como parte de la parcela.
//
// API (funcional, el estado nunca se muta en sitio por este módulo salvo la
// propia pila del historial):
//   crearHistorial({ limite })                -> historial
//   commit(historial, estado)                 -> void
//   reiniciar(historial, estado)              -> void
//   reencuadrar(historial, fn)                -> void
//   undo(historial, estadoActual?)            -> estado | null
//   redo(historial, estadoActual?)            -> estado | null
//   puedeDeshacer(historial)                  -> boolean
//   puedeRehacer(historial)                   -> boolean
//
// Modelo interno: una sola `pila` de snapshots (clones) + un `indice` que apunta
// al PRESENTE dentro de la pila. `undo` mueve el índice atrás y devuelve el clon
// del snapshot en la nueva posición; `redo`, adelante. El presente vive dentro
// de la pila, así que `estadoActual` es un parámetro OPCIONAL de simetría con el
// store del llamante: la pila de snapshots es la autoridad para navegar (con
// coalescing, el presente ya coincide con el último `commit`).

/** @typedef {number} Limite */
/**
 * @typedef {Object} Historial
 * @property {number} limite  Máximo de snapshots retenidos (50-100).
 * @property {Array<any>} pila  Snapshots (clones) del estado, del más antiguo al más reciente.
 * @property {number} indice  Posición del PRESENTE dentro de `pila`; -1 si está vacía.
 */

const LIMITE_POR_DEFECTO = 100

/**
 * Crea un historial vacío.
 *
 * @param {{ limite?: number }} [opciones]  `limite`: tope de snapshots (por defecto 100).
 * @returns {Historial}
 */
export function crearHistorial({ limite = LIMITE_POR_DEFECTO } = {}) {
  // Saneo del límite (auditoría A6): NaN/Infinity/no-número caen al valor por
  // defecto — `Math.max(1, NaN)` es NaN y dejaría la pila SIN acotar en silencio.
  const lim = Number.isFinite(limite) ? Math.max(1, Math.floor(limite)) : LIMITE_POR_DEFECTO
  return { limite: lim, pila: [], indice: -1 }
}

/**
 * Registra el estado como nuevo punto presente (una operación acabada).
 *   · Clona el estado con `structuredClone` (el modelo es POJO plano).
 *   · Descarta la rama de redo (todo lo que hubiera por delante del presente).
 *   · Respeta el límite: al exceder, descarta el snapshot más antiguo.
 *
 * @param {Historial} historial
 * @param {any} estado  Estado POJO plano a guardar como presente.
 * @returns {void}
 */
export function commit(historial, estado) {
  // Historial lineal: un nuevo commit tras undo(s) borra la rama de redo.
  if (historial.indice < historial.pila.length - 1) {
    historial.pila.length = historial.indice + 1
  }
  historial.pila.push(structuredClone(estado))
  historial.indice = historial.pila.length - 1
  // Acotar la pila: descartar los más antiguos hasta respetar el límite.
  while (historial.pila.length > historial.limite) {
    historial.pila.shift()
    historial.indice--
  }
}

/**
 * Reinicia el historial: descarta TODA la historia y siembra `estado` como único
 * presente (`pila = [clon]`, `indice = 0`). Tras llamarla no se puede deshacer ni
 * rehacer nada.
 *
 * Es la operación de "documento nuevo": cargar una parcela del WFS, abrir un
 * fichero, empezar de cero. Sin ella la única forma de arrancar limpio sería
 * `commit` sobre el historial viejo, y entonces el primer undo del usuario le
 * devolvería la parcela ANTERIOR — un documento que ya no está abierto.
 *
 * Se siembra en vez de dejar la pila vacía porque el presente vive DENTRO de la
 * pila (ver el modelo interno de la cabecera): una pila vacía con `indice = -1`
 * dejaría el primer `undo` sin punto de retorno. Con la semilla, el estado
 * inicial es un destino legítimo al que volver en cuanto haya un `commit`.
 *
 * Notas de contrato:
 *   · El estado se guarda CLONADO (`structuredClone`), como en `commit`: mutar
 *     fuera el objeto sembrado no toca la pila.
 *   · `limite` NO se toca — es configuración del historial, no historia.
 *   · Se vacía la pila EN SITIO (`length = 0`) en vez de reasignar el array, para
 *     que quien tenga una referencia a `historial.pila` no se quede con la vieja.
 *
 * @param {Historial} historial
 * @param {any} estado  Estado POJO plano que pasa a ser el único presente.
 * @returns {void}
 */
export function reiniciar(historial, estado) {
  historial.pila.length = 0
  historial.pila.push(structuredClone(estado))
  historial.indice = 0
}

/**
 * Reencuadra el historial: reescribe TODOS los snapshots pasándolos por `fn`,
 * dejando el puntero de undo (`indice`) y la longitud de la pila intactos.
 *
 * Es la operación de "ha cambiado el fondo, no el documento". El caso que la
 * estrena es traer el parcelario oficial del Catastro SIN sustituir la medición
 * propia: el `estado.set` mete un POJO nuevo con `geometriaOficial` rellena, y si
 * la pila no se tocara, el primer Ctrl+Z devolvería a un snapshot ANTERIOR —sin
 * oficial— y el fondo desaparecería sin que nada lo explicara. La `geometriaOficial`
 * es propiedad del DOCUMENTO, no de un paso que el usuario haya dado, así que se
 * reescribe en toda la historia en vez de vivir solo en el presente.
 *
 * Notas de contrato:
 *   · **Atómico.** Se construye la pila nueva ENTERA antes de tocar nada, y se
 *     sustituye al final. Si `fn` lanza a mitad —o no es una función—, `historial`
 *     se queda exactamente como estaba: nunca hay una pila mixta, con unos
 *     snapshots reencuadrados y otros no. Ese fallo sería SILENCIOSO (la pila
 *     queda coherente en forma, incoherente en contenido) y por eso se paga la
 *     lista intermedia.
 *   · **NO clona lo que devuelve `fn`.** Si `fn` mete el mismo objeto en los N
 *     snapshots —el caso normal: una sola `geometriaOficial` para toda la pila—,
 *     los N COMPARTEN esa referencia en vez de guardar N copias profundas.
 *   · `indice` no se toca y `fn` se aplica 1 a 1, así que el presente sigue siendo
 *     el mismo paso y las capacidades de deshacer/rehacer no cambian.
 *   · La pila se rellena EN SITIO, por el mismo motivo que en `reiniciar`: quien
 *     tenga una referencia a `historial.pila` no se queda con la vieja.
 *
 * ── POR QUÉ COMPARTIR LA REFERENCIA ES SEGURO ───────────────────────────────
 * **Por la disciplina de clonar en las fronteras, NO por el `deepFreeze` de
 * `model/parcela.js`.** Esa era la justificación fácil y es FALSA: `structuredClone`
 * **no preserva `Object.freeze`** —medido en la fase 0 de F10, documentado en
 * `storage/expedientes.js` y con prueba en `test/storage/aceptacion-f10.test.js:221`—,
 * así que los snapshots de esta pila, que llegaron por `structuredClone`, ya vienen
 * DESCONGELADOS. El congelado no es aquí ninguna barrera.
 *
 * La barrera real es que **nadie muta las entradas de la pila en sitio**: `commit` y
 * `reiniciar` clonan a la ENTRADA, `undo` y `redo` clonan a la SALIDA. Lo que sale de
 * este módulo es siempre una copia fresca, y el llamante puede machacarla sin tocar
 * la historia. Mientras esa disciplina se mantenga, compartir un objeto entre N
 * snapshots no puede contaminar a ninguno. Si algún día un método devolviera un
 * snapshot sin clonar, esta decisión deja de ser segura — y hay que revisarla aquí.
 *
 * @param {Historial} historial
 * @param {(estado: any, indice: number) => any} fn  Recibe cada snapshot (el objeto
 *   REAL de la pila, no un clon) y devuelve el que lo sustituye. No debe mutar el
 *   que recibe: se espera un objeto nuevo (`{ ...estado, geometriaOficial }`).
 * @returns {void}
 */
export function reencuadrar(historial, fn) {
  // Pila nueva completa PRIMERO: si `fn` lanza, el `map` lanza y abajo no se llega.
  const nueva = historial.pila.map((estado, i) => fn(estado, i))
  // Un `fn` que no devuelve nada dejaría la pila llena de `undefined` y el fallo
  // saldría mucho después, en el undo del usuario. Se detecta aquí, aún atómico.
  const roto = nueva.findIndex((estado) => estado === null || typeof estado !== 'object')
  if (roto !== -1) {
    const devuelto = nueva[roto] === null ? 'null' : typeof nueva[roto]
    throw new TypeError(
      `reencuadrar: 'fn' debe devolver un estado (objeto); devolvió ${devuelto} en el snapshot ${roto}.`,
    )
  }
  // Sustitución al final y en sitio. `map` conserva la longitud, así que no hay
  // que recortar la pila ni recolocar `indice`.
  for (let i = 0; i < nueva.length; i++) historial.pila[i] = nueva[i]
}

/**
 * @param {Historial} historial
 * @returns {boolean}  true si hay un snapshot anterior al presente.
 */
export function puedeDeshacer(historial) {
  return historial.indice > 0
}

/**
 * @param {Historial} historial
 * @returns {boolean}  true si hay un snapshot posterior al presente (rama redo).
 */
export function puedeRehacer(historial) {
  return historial.indice < historial.pila.length - 1
}

/**
 * Deshace: retrocede al snapshot anterior y devuelve un CLON independiente.
 *
 * @param {Historial} historial
 * @param {any} [estadoActual]  Opcional (simetría con el store); no se usa para
 *   navegar: la pila de snapshots es la autoridad.
 * @returns {any | null}  Clon del estado anterior, o null si no hay.
 */
export function undo(historial, estadoActual) {
  if (!puedeDeshacer(historial)) return null
  historial.indice--
  return structuredClone(historial.pila[historial.indice])
}

/**
 * Rehace: avanza al snapshot siguiente y devuelve un CLON independiente.
 *
 * @param {Historial} historial
 * @param {any} [estadoActual]  Opcional (simetría con el store); no se usa para
 *   navegar: la pila de snapshots es la autoridad.
 * @returns {any | null}  Clon del estado siguiente, o null si no hay.
 */
export function redo(historial, estadoActual) {
  if (!puedeRehacer(historial)) return null
  historial.indice++
  return structuredClone(historial.pila[historial.indice])
}

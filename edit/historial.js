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

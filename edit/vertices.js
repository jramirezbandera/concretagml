// edit/vertices.js — F06 · Insertar y eliminar vértices de un recinto.
//
// Dos operaciones PURAS sobre la geometría EDITABLE (`recintos`), del mismo
// tamaño que una acción del usuario: un clic en un lado inserta un vértice, un
// clic en un vértice lo borra. Cada llamada es UNA operación acabada, que es
// justo la unidad que `edit/historial.js#commit` fotografía (coalescing: el
// llamante decide cuándo hacer commit, no este módulo).
//
// Lo que este módulo recibe y devuelve son `recintos`, NO la parcela entera, y
// eso es deliberado (SPEC §2 regla 2): `geometriaOficial` es el término de
// comparación del diagnóstico y se conserva intacta. La forma más segura de no
// tocarla es no verla — aquí no llega.
//
// Invariantes que se respetan sin excepción:
//   · Regla 4 — POJO plano, coordenadas `[x, y]` en UTM, anillos guardados
//     ABIERTOS (sin repetir el vértice de cierre). El lado de CIERRE es el que va
//     del último vértice al primero y NO está materializado: insertar en él
//     significa AÑADIR AL FINAL del anillo abierto, no meter nada delante.
//   · §4.3 — `recintos[0]` es el EXTERIOR y el resto HUECOS. Insertar o eliminar
//     no cambia el tipo de ningún recinto ni su orden: se clona la estructura
//     completa y solo se toca el array de vértices del recinto señalado.
//   · INMUTABILIDAD — se devuelve siempre una estructura NUEVA, con arrays de
//     vértices NUEVOS. No es cosmética: `commit` guarda el estado con
//     `structuredClone`, y si una operación mutara en sitio el presente y su
//     snapshot compartirían memoria y el undo dejaría de deshacer nada.
//
// Regla 1 — la distinción capital del proyecto, aplicada aquí:
//   · Dato del USUARIO que no se puede aceptar (querer bajar un anillo de 3 a 2
//     vértices) → se DEVUELVE DESCRITO, con un código de {@link MOTIVO_VERTICE},
//     para que la UI lo cuente. Nunca `throw`: el usuario pincha donde quiere.
//   · Contrato roto por el PROGRAMADOR (`recintos` que no es array, un índice
//     fuera de rango, un punto que no es un par de números finitos) → `throw`
//     nombrando el argumento y lo recibido. Eso es un bug, no un dato.
//
// API:
//   insertarVertice(recintos, {recinto, indice}, punto) -> recintos
//   eliminarVertice(recintos, {recinto, indice})        -> {recintos, motivo}
//
// `describir`, `exigirRecintos` y `exigirRef` vivían aquí duplicadas de
// `edit/offset.js` (nota de deuda T2.2); F06/T3.4 las unificó en
// `edit/_comun.js`, que documenta la única divergencia real que había entre las
// copias (la redacción de `exigirRef`) y por qué `exigirPunto`, en cambio, se
// queda en este fichero: solo lo llama este módulo.

import { describir, exigirRecintos, exigirRef } from './_comun.js'

/**
 * @typedef {import('../validation/_comun.js').RefVertice} RefVertice
 *   `{recinto, indice}`, con `indice` 0-based sobre el anillo ABIERTO. Se ALIASA
 *   el typedef de la validación en vez de re-declararlo: la UI de F03 resalta
 *   vértices con esa misma forma y las dos definiciones no pueden divergir si
 *   solo hay una.
 */

/**
 * @typedef {{vertices: Array<[number,number]>, tipo: string}} Recinto
 */

/**
 * Resultado de {@link eliminarVertice}. O hay geometría nueva y `motivo` es
 * `null`, o no la hay y `motivo` dice por qué — nunca las dos ni ninguna.
 *
 * @typedef {Object} ResultadoEliminar
 * @property {Recinto[]|null} recintos  Estructura NUEVA, o `null` si no se eliminó.
 * @property {string|null} motivo       Clave de {@link MOTIVO_VERTICE}; `null` si se eliminó.
 */

// ── Vocabulario público ──────────────────────────────────────────────────────

/**
 * Nº mínimo de vértices de un anillo. Tres es el suelo geométrico, no una
 * preferencia: con dos vértices no hay recinto, hay un segmento; con uno, un
 * punto. Coincide con lo que `validation/reglas-geometria.js` ya llama anillo
 * degenerado («menos de 3 vértices distintos» → ERROR con la corrección
 * «Definir al menos 3 vértices»), y por eso este módulo NO deja llegar hasta ahí:
 * es más honesto negarse a hacer la operación que hacerla y luego informar de que
 * la geometría quedó rota.
 */
export const MINIMO_VERTICES = 3

/**
 * Por qué no se ha podido hacer la operación. **Códigos estables: la UI puede
 * decidir con ellos sin analizar ningún texto** (mismo trato que
 * `MOTIVO_CATASTRO` en `services/catastro.js`).
 *
 * `insertarVertice` no tiene motivos y no es un olvido: insertar nunca degrada un
 * anillo — solo puede hacerlo crecer—, así que no hay ningún caso de usuario que
 * haya que rechazar. Un catálogo con un motivo que nadie emite es código muerto
 * que tranquiliza.
 *
 * @readonly
 */
export const MOTIVO_VERTICE = Object.freeze({
  /**
   * Eliminar ese vértice dejaría el anillo por debajo de {@link MINIMO_VERTICES}.
   * Es dato del USUARIO —pincha el vértice que quiere—, así que sale como estado
   * y con mensaje, no como excepción (regla 1).
   */
  MINIMO_TRES_VERTICES: 'MINIMO_TRES_VERTICES',
})

/**
 * Texto en español, presentable tal cual, para cada {@link MOTIVO_VERTICE}.
 * **Mapa explícito y TOTAL**, no una función con un `default`: un `default` es
 * exactamente lo que hace que un motivo nuevo herede un texto que nadie ha
 * escrito.
 *
 * Vive aquí y no en la UI para que ninguna pantalla tenga que redactar el motivo
 * a mano y para que dos pantallas no lo redacten distinto.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const MENSAJE_POR_MOTIVO = Object.freeze({
  [MOTIVO_VERTICE.MINIMO_TRES_VERTICES]:
    `No se ha eliminado el vértice: un recinto necesita al menos ${MINIMO_VERTICES} vértices. ` +
    `Con dos o menos deja de ser un recinto y pasa a ser un segmento. Si lo que quieres es ` +
    `quitar este recinto entero, elimina el recinto, no sus vértices.`,
})

/**
 * Guardián de carga: {@link MENSAJE_POR_MOTIVO} tiene que ser TOTAL sobre
 * {@link MOTIVO_VERTICE}. Si mañana se añade un motivo y aquí no se le escribe un
 * texto, el módulo **no se carga** en vez de dejar un renglón en blanco la primera
 * vez que ese motivo aparezca en pantalla. Ruidoso a propósito, y por la misma
 * razón que sus gemelos de `services/catastro.js` y `app/cableado-catastro.js`:
 * un módulo que no carga se arregla en cinco minutos; un mensaje vacío no lo ve
 * nadie hasta que lo ve un cliente.
 */
for (const motivo of Object.values(MOTIVO_VERTICE)) {
  /* c8 ignore next 6 -- solo se alcanza si el catálogo crece y los mensajes no */
  if (MENSAJE_POR_MOTIVO[motivo] === undefined) {
    throw new Error(
      `edit/vertices: falta el mensaje de MOTIVO_VERTICE.${motivo}. Un motivo nuevo tiene que ` +
        `llegar a la pantalla con un texto decidido por alguien, no con un renglón en blanco.`,
    )
  }
}

// ── Helpers internos ─────────────────────────────────────────────────────────

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * Contrato del llamante: `punto` es un par UTM `[x, y]` de números finitos.
 * @param {unknown} punto
 * @param {string} fn
 */
function exigirPunto(punto, fn) {
  if (
    !Array.isArray(punto) ||
    punto.length < 2 ||
    !esNumeroFinito(punto[0]) ||
    !esNumeroFinito(punto[1])
  ) {
    throw new TypeError(
      `${fn}: 'punto' debe ser un par UTM [x,y] de números finitos; recibido ${describir(punto)}.`,
    )
  }
}

/**
 * Copia PROFUNDA e independiente de los recintos. `structuredClone` porque el
 * modelo es POJO plano (regla 4) y es el mismo mecanismo con el que
 * `edit/historial.js` fotografía el estado: si algo no fuera clonable aquí,
 * tampoco tendría undo, y más vale enterarse en la operación que en el undo.
 *
 * Se clonan TODOS los recintos, no solo el editado: así ningún array de vértices
 * de la salida es el mismo objeto que uno de la entrada, y ningún llamante puede
 * mutar «un recinto que no ha tocado» y ver cómo cambia también el snapshot.
 *
 * @param {Recinto[]} recintos
 * @returns {Recinto[]}
 */
const clonarRecintos = (recintos) => structuredClone(recintos)

// ── Operaciones ──────────────────────────────────────────────────────────────

/**
 * Inserta un vértice EN UN LADO del anillo.
 *
 * El lado es el que va de `indice` a `indice + 1`, así que el vértice nuevo queda
 * en la posición `indice + 1`. Con `indice` = último vértice el lado es el de
 * CIERRE (v[n-1] → v[0]), que en un anillo ABIERTO no está materializado: el
 * vértice nuevo se añade AL FINAL, que es exactamente su sitio en el recorrido.
 *
 * No muta la entrada: devuelve una estructura NUEVA con arrays de vértices
 * nuevos. No cambia el tipo ni el orden de ningún recinto.
 *
 * @param {Recinto[]} recintos  Geometría EDITABLE (no la parcela, no la oficial).
 * @param {RefVertice} refVertice  `{recinto, indice}`: el vértice que ABRE el lado.
 * @param {[number, number]} punto  Coordenada UTM `[x, y]` del vértice nuevo.
 * @returns {Recinto[]}  Recintos nuevos con el vértice insertado.
 * @throws {TypeError}  Si `recintos`, la referencia o `punto` no cumplen la forma.
 * @throws {RangeError} Si `recinto` o `indice` se salen del rango real.
 */
export function insertarVertice(recintos, refVertice, punto) {
  const FN = 'insertarVertice'
  exigirRecintos(recintos, FN)
  const { recinto, indice } = exigirRef(recintos, refVertice, FN)
  exigirPunto(punto, FN)

  const salida = clonarRecintos(recintos)
  // `splice(indice + 1, 0, …)`: con indice = n-1 el destino es n, es decir el
  // final del array — el lado de cierre resuelto sin un caso especial.
  salida[recinto].vertices.splice(indice + 1, 0, [punto[0], punto[1]])
  return salida
}

/**
 * Elimina un vértice del anillo.
 *
 * **No lanza si el usuario pide lo imposible.** Si quitar ese vértice dejara el
 * anillo por debajo de {@link MINIMO_VERTICES}, se devuelve `recintos: null` y el
 * motivo {@link MOTIVO_VERTICE.MINIMO_TRES_VERTICES}, con su texto en
 * {@link MENSAJE_POR_MOTIVO}, para que la UI lo cuente (regla 1). El `throw` se
 * reserva para el contrato roto por el programador.
 *
 * No muta la entrada. No cambia el tipo ni el orden de ningún recinto: eliminar
 * el último vértice admisible de un anillo es imposible por construcción, así que
 * ningún recinto puede desaparecer por esta vía.
 *
 * @param {Recinto[]} recintos  Geometría EDITABLE.
 * @param {RefVertice} refVertice  `{recinto, indice}`: el vértice a eliminar.
 * @returns {ResultadoEliminar}
 * @throws {TypeError}  Si `recintos` o la referencia no cumplen la forma.
 * @throws {RangeError} Si `recinto` o `indice` se salen del rango real.
 */
export function eliminarVertice(recintos, refVertice) {
  const FN = 'eliminarVertice'
  exigirRecintos(recintos, FN)
  const { recinto, indice, vertices } = exigirRef(recintos, refVertice, FN)

  if (vertices.length - 1 < MINIMO_VERTICES) {
    return { recintos: null, motivo: MOTIVO_VERTICE.MINIMO_TRES_VERTICES }
  }

  const salida = clonarRecintos(recintos)
  salida[recinto].vertices.splice(indice, 1)
  return { recintos: salida, motivo: null }
}

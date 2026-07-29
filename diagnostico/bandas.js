// diagnostico/bandas.js — F07 · La comparación a TRES bandas (spec §10.2).
//
// «El problema real son tres superficies: registral, catastral y medida.» Es el
// cuadro que hoy se monta a mano en cada pericial, y monta MAL: con tres valores
// hay tres pares, y quien lo hace a mano suele escribir solo dos —el que le
// interesa— o cambia el orden de la resta a mitad de la tabla y el signo deja de
// significar nada. Aquí los tres pares salen SIEMPRE, en un orden FIJO y con el
// signo definido en un solo sitio.
//
// ── ESTE MÓDULO NO JUZGA (regla de oro 9, SPEC §2) ──────────────────────────
// No hay `ok`, no hay `dentroDeTolerancia`, no hay comparación con ninguna
// tolerancia y no hay color. Devuelve restas y cocientes. El margen oficial de
// identidad vive en `diagnostico/margen.js`, que lo ENUNCIA y tampoco compara;
// enfrentarlo con estas cifras es decisión del colegiado que firma, no de una
// función. Un solo booleano aquí convertiría la tabla en un veredicto y ése es
// justo el producto que la spec prohíbe: una discrepancia grande suele significar
// que la geometría CATASTRAL está mal, y eso es el motivo del expediente.
//
// ── LAS TRES DECISIONES QUE HEREDA DE `edit/metricas.js` ────────────────────
// Se dicen con las MISMAS palabras a propósito: son la misma doctrina y si un día
// cambia tiene que chocar en los dos sitios.
//
//   1. **`null` NO es 0.** `null` significa «no consta» y NUNCA «cero». Un par
//      con algún término `null` da `{absoluto: null, relativo: null}`, porque «no
//      hay con qué comparar» ≠ «no hay discrepancia» — dos afirmaciones opuestas
//      que se escribirían con el mismo número, y la falsa es la tranquilizadora.
//      La superficie registral es `null` mientras el usuario no la teclee (es un
//      dato de una escritura, no algo que se mida) y la catastral es `null` en
//      todo lo que no viene del WFS: un DXF, un TXT, un contorno dibujado a mano.
//   2. **`relativo` es una FRACCIÓN, no un porcentaje.** 0,05 significa 5 %; el
//      × 100 es de PRESENTACIÓN y no se hace aquí. Es la confusión clásica de este
//      campo y por eso está escrito en el nombre del contrato y en el JSDoc.
//   3. **Denominador cero ⇒ `relativo: null`, jamás `Infinity` ni `NaN`.** Con
//      `catastral: 0` (un dato declarado, raro pero un número) el `absoluto` SÍ es
//      calculable y se devuelve; lo que no está definido es el cociente. Un
//      `Infinity` colado en la tabla se pinta como «∞%» y un `NaN` como «NaN»:
//      un número que nadie ha calculado, presentado como si lo hubiera calculado
//      alguien. Exactamente el error silencioso que prohíbe la regla de oro 1.
//
// Módulo PURO: sin DOM, sin Leaflet, sin Turf, sin geometría, sin estado. No sabe
// de dónde salen los tres números ni qué unidad tienen —funciona igual con m² que
// con metros de perímetro—; lo único que sabe es que son tres y comparables.

import { exigirNumeroONulo, exigirOpciones } from './_comun.js'

/**
 * Las tres bandas, por su nombre. Es el vocabulario que viaja en `a` y `b` de
 * cada cruce y la clave con la que se lee `valores`, así que la capa de pintado
 * NO escribe `'catastral'` a mano en ningún sitio: un literal mal escrito en una
 * plantilla daría `undefined` sin quejarse.
 *
 * @type {Readonly<{MEDIDA: 'medida', CATASTRAL: 'catastral', REGISTRAL: 'registral'}>}
 */
export const CLAVE_BANDA = Object.freeze({
  MEDIDA: 'medida',
  CATASTRAL: 'catastral',
  REGISTRAL: 'registral',
})

/**
 * Los tres pares, EN ORDEN, y el orden es contrato (los tests lo fijan).
 *
 * No es alfabético ni casual: es el orden en que se leen las preguntas.
 *
 *   1. **medida ↔ catastral** — la pregunta que trae al usuario a esta app y la
 *      primera que mira: *¿mi medición cuadra con el parcelario vigente?* Es la
 *      única de las tres que enfrenta lo que hemos MEDIDO con lo que hay que
 *      rectificar, y la que gobierna todo el expediente.
 *   2. **medida ↔ registral** — la segunda: *¿y con lo que está inscrito?* Importa
 *      para la escritura, pero llega después y muchas veces no llega (la
 *      superficie registral la teclea el usuario y a menudo no la tiene a mano).
 *   3. **catastral ↔ registral** — la discrepancia entre las dos fuentes
 *      OFICIALES, en la que nuestra medición no participa. Va última porque es la
 *      que EXPLICA las otras dos cuando ambas salen grandes: si Catastro y
 *      Registro ya no coincidían entre ellos, el problema es anterior a nuestro
 *      levantamiento. Enterrarla o dejarla fuera —lo que suele pasar en el cuadro
 *      hecho a mano— es perder el dato que absuelve a la medición.
 *
 * Dentro de cada par, `b` es el término de REFERENCIA: el sustraendo del absoluto
 * y el denominador del relativo. El orden dentro del par tampoco es cosmético —
 * `medida − catastral` negativo significa «medimos MENOS de lo que dice el
 * Catastro»—, y la referencia es siempre la fuente ajena, nunca nuestra medición:
 * lo que se contrasta es la medición CONTRA lo publicado.
 */
const PARES = Object.freeze([
  Object.freeze([CLAVE_BANDA.MEDIDA, CLAVE_BANDA.CATASTRAL]),
  Object.freeze([CLAVE_BANDA.MEDIDA, CLAVE_BANDA.REGISTRAL]),
  Object.freeze([CLAVE_BANDA.CATASTRAL, CLAVE_BANDA.REGISTRAL]),
])

/**
 * Un cruce entre dos bandas.
 *
 * @typedef {Object} Cruce
 * @property {'medida'|'catastral'|'registral'} a  Banda minuendo.
 * @property {'medida'|'catastral'|'registral'} b  Banda sustraendo Y denominador
 *   del relativo: el término de REFERENCIA del par.
 * @property {number|null} absoluto  `valores[a] − valores[b]`, CON SIGNO, en la
 *   unidad de entrada. `null` si falta alguno de los dos («no hay con qué
 *   comparar», que no es «no hay discrepancia»).
 * @property {number|null} relativo  `absoluto / valores[b]`, **FRACCIÓN** (0,05 =
 *   5 %). `null` si falta algún término o si `valores[b]` es 0 — nunca `Infinity`
 *   ni `NaN`.
 */

/**
 * El cruce de dos bandas: la resta con signo y el cociente. Encapsula las tres
 * decisiones de la cabecera para que estén escritas UNA vez y no tres.
 *
 * @param {number|null} va  Minuendo.
 * @param {number|null} vb  Sustraendo y denominador (la referencia).
 * @returns {{absoluto: number|null, relativo: number|null}}
 */
function cruzar(va, vb) {
  if (va === null || vb === null) return { absoluto: null, relativo: null }

  const absoluto = va - vb
  return {
    absoluto,
    // `vb === 0` captura también `-0`. Sin este corte saldría ±Infinity (o NaN si
    // además `va` fuera 0), y ninguno de los dos es una medida.
    relativo: vb === 0 ? null : absoluto / vb,
  }
}

/**
 * Enfrenta las tres superficies y devuelve los TRES cruces (spec §10.2).
 *
 * ```js
 * bandas({ medida: 1535.87, catastral: 1536, registral: 1500 })
 * // → { valores: {medida: 1535.87, catastral: 1536, registral: 1500},
 * //     cruces: [ {a:'medida',    b:'catastral', absoluto:  -0.13, relativo: -0.0000846…},
 * //               {a:'medida',    b:'registral', absoluto:  35.87, relativo:  0.0239…},
 * //               {a:'catastral', b:'registral', absoluto:  36,    relativo:  0.024} ] }
 * ```
 *
 * Los tres pares salen SIEMPRE, aunque no haya con qué calcularlos: una fila
 * ausente se lee como «esto no hacía falta mirarlo» y una fila con `null` se lee
 * como «esto no se ha podido mirar». Solo la segunda es verdad.
 *
 * @param {Object} entrada  Las tres bandas. En la unidad que sea, la misma para
 *   las tres (el caso de §10.2 es m², pero nada aquí lo supone).
 * @param {number|null} entrada.medida  Lo que la app ha MEDIDO
 *   (`geo/area.js#superficie` sobre la geometría editada). **Sin valor por
 *   defecto a propósito**: omitirla es un bug del programador y lanza, mientras
 *   `medida: null` es una afirmación legítima («todavía no hay geometría»). Las
 *   dos cosas se escriben distinto porque son distintas.
 * @param {number|null} [entrada.catastral=null]  `cp:areaValue` del GML oficial.
 *   `null` = no consta (lo normal fuera del WFS).
 * @param {number|null} [entrada.registral=null]  La que teclea el usuario desde
 *   la escritura. `null` = no consta, que es el estado inicial y el más frecuente.
 * @returns {{valores: {medida: number|null, catastral: number|null, registral: number|null}, cruces: Cruce[]}}
 *   `valores` es la copia de lo recibido —para que la tabla no tenga que
 *   guardárselo aparte— y `cruces` los tres pares en el orden documentado en
 *   `PARES`. **Ni una clave de veredicto**: no hay `ok`, ni `dentroDeTolerancia`,
 *   ni `nivel`, ni `color` (regla de oro 9, y hay un test que lo afirma).
 * @throws {TypeError} Si `entrada` no es un objeto llano, o si alguna de las tres
 *   bandas no es un número finito ni `null` (incluido el olvido de `medida`).
 */
export function bandas(entrada) {
  exigirOpciones(entrada, 'bandas', 'un objeto {medida, catastral, registral}')

  const { medida, catastral = null, registral = null } = entrada
  exigirNumeroONulo(medida, 'bandas', 'medida')
  exigirNumeroONulo(catastral, 'bandas', 'catastral')
  exigirNumeroONulo(registral, 'bandas', 'registral')

  const valores = { medida, catastral, registral }

  return {
    valores,
    cruces: PARES.map(([a, b]) => ({ a, b, ...cruzar(valores[a], valores[b]) })),
  }
}

// edit/metricas.js — F06 · Retroalimentación numérica en vivo de la edición.
//
// Una sola función pura, {@link metricas}, que responde a la pregunta que el
// usuario tiene delante mientras arrastra un vértice: *cuánto mide esto ahora, y
// en qué se diferencia de lo que el Catastro dice que mide*. Se llama en cada
// fotograma del arrastre (criterio de aceptación 4 de F06) y devuelve NÚMEROS
// CRUDOS; pintarlos es de la capa de presentación.
//
// LO QUE ESTE MÓDULO NO HACE, y es lo más importante de su diseño:
//
//   · **No calcula nada por su cuenta.** La superficie sale de
//     `geo/area.js#superficie` (shoelace sobre UTM con traslación a origen
//     local, regla de oro 5) y los perímetros de `geo/metrica.js#perimetro`
//     (helpers euclídeos propios, regla de oro 6: `turf.area`, `turf.distance` y
//     `turf.length` están PROHIBIDAS sobre coordenadas métricas). Este fichero
//     compone y resta; la aritmética vive donde ya vivía. Una segunda
//     implementación del shoelace aquí sería una segunda verdad, y la que se
//     pinta en vivo no puede discrepar de la que se serializa en el GML.
//
//   · **No juzga (regla de oro 9).** No hay `ok`, ni `dentroDeTolerancia`, ni
//     semáforo, ni comparación contra los ±0,50 m urbana / ±2,00 m rústica ni
//     contra el 5% de superficie de SPEC §3. Esas tolerancias son **capa
//     informativa** y quien las interpreta y firma es el técnico colegiado. Aquí
//     salen cifras desnudas: la app MIDE y SEÑALA.
//
//   · **No redondea (regla de oro 11).** float64 completo. El redondeo es de
//     salida: `app/main.js` tiene ya sus `FORMATO_SUPERFICIE` (2 decimales, la
//     precisión con la que la app sabe medir) y `FORMATO_DECLARADO` (sin
//     decimales forzados, porque el Catastro publica un ENTERO). Redondear aquí
//     metería el criterio de presentación dentro del modelo y haría que dos
//     vistas distintas de la misma cifra no pudieran diferir cuando deben.
//
//   · **No cachea.** Es O(n) sobre ≤ 500 vértices —una pasada de sumas por
//     fotograma, nada— y un caché sería ESTADO. El estado es de quien llama
//     (el store de F03, el historial de F06), no de una función de medida.
//
//   · **No ve la parcela.** Recibe `recintos` (la geometría EDITABLE) y un
//     número. `geometriaOficial` no llega hasta aquí, y por eso no puede
//     tocarla (regla de oro 2, mismo criterio que `edit/vertices.js`).

import { superficie } from '../geo/area.js'
import { perimetro } from '../geo/metrica.js'
import { describir } from './_comun.js'

/**
 * @typedef {{vertices: Array<[number,number]>, tipo: string}} Recinto
 */

/**
 * Diferencia entre lo MEDIDO y lo DECLARADO. Ver {@link metricas} para el
 * porqué de que este objeto entero sea `null` cuando no hay nada declarado.
 *
 * @typedef {Object} DeltaCatastral
 * @property {number} absoluto  `superficie − superficieCatastral`, en m², **CON
 *   SIGNO**: negativo = medimos MENOS que lo inscrito, positivo = medimos más.
 *   El signo es información, no ruido — no se devuelve el valor absoluto.
 * @property {number|null} relativo  `absoluto / superficieCatastral`, **FRACCIÓN
 *   y no porcentaje** (0,05 significa 5%). `null` cuando la superficie declarada
 *   es 0 y el cociente no está definido.
 */

/**
 * Resultado de {@link metricas}.
 *
 * @typedef {Object} Metricas
 * @property {number} superficie  Superficie neta medida (exterior − huecos), m².
 * @property {{exterior: number, huecos: number, total: number}} perimetro  Metros,
 *   desglosado tal como lo devuelve `geo/metrica.js#perimetro`.
 * @property {number} nVertices  Vértices de TODOS los recintos, huecos incluidos.
 * @property {DeltaCatastral|null} deltaCatastral  `null` si no hay superficie
 *   catastral con la que comparar.
 */

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * Normaliza los recintos para que un POJO incompleto no tumbe el cálculo.
 *
 * El store admite cualquier POJO (una parcela a medio construir, un recinto
 * recién creado sin vértices) y esta función se llama en cada `mousemove`: que la
 * ficha reviente porque a un recinto le falta el array sería un fallo
 * desproporcionado respecto a la causa. Se sustituye el array ausente por `[]`,
 * que es lo que ese recinto mide de verdad: nada.
 *
 * **Lo que NO se normaliza es `tipo`**, y es deliberado: pasa tal cual para que
 * las guardas de invariante de `geo/area.js#superficie` y
 * `geo/metrica.js#perimetro` sigan disparando. Un `recintos[0]` que no es
 * EXTERIOR no es un dato incompleto, es un bug del programa (regla de oro 1) y
 * tiene que sonar.
 *
 * Los arrays de vértices se pasan POR REFERENCIA, no se copian: aquí solo se
 * lee, y clonar 500 pares de coordenadas por fotograma sería trabajo inútil.
 *
 * @param {unknown[]} recintos
 * @returns {Recinto[]}
 */
function sanearRecintos(recintos) {
  return recintos.map((r) => {
    const esObjeto = r !== null && typeof r === 'object'
    return {
      tipo: esObjeto ? r.tipo : undefined,
      vertices: esObjeto && Array.isArray(r.vertices) ? r.vertices : [],
    }
  })
}

/**
 * Métricas en vivo de una geometría en edición.
 *
 * ```js
 * metricas(recintos, { superficieCatastral = null } = {})
 *   → { superficie, perimetro: {exterior, huecos, total}, nVertices, deltaCatastral }
 * ```
 *
 * ### La asimetría que más confunde
 *
 * `superficie` **resta** los huecos (exterior − huecos: un patio no es suelo de
 * la parcela) mientras `perimetro.total` los **suma** (un patio añade lindero,
 * no lo quita). No es una incoherencia entre las dos cifras: es que un hueco
 * quita superficie y pone línea. Por eso `perimetro` llega desglosado en tres
 * números — la tolerancia oficial de identidad se refiere al EXTERIOR (SPEC §3),
 * y elegir en silencio cuál de los tres es «el perímetro» sería acertar la mitad
 * de las veces.
 *
 * ### Por qué `deltaCatastral` es `null` y no cero
 *
 * `superficieCatastral` es la superficie que el Catastro **DECLARA**
 * (`cp:areaValue`, un entero en m²), no una medición nuestra; `null` significa
 * «no lo sabemos» y NUNCA «cero» (ver el JSDoc de `model/parcela.js`). Es lo
 * normal en todo lo que no viene del WFS: un DXF, un TXT, un contorno dibujado a
 * mano. Si sin dato declarado esto devolviera `{absoluto: 0}`, la ficha diría
 * «no hay discrepancia» cuando lo cierto es **«no hay con qué comparar»** — dos
 * afirmaciones opuestas escritas con el mismo número, y la falsa es la
 * tranquilizadora. `null` obliga a la capa de pintado a decirlo («No consta»,
 * como ya hace `app/main.js`) en vez de a afirmar una coincidencia inventada.
 *
 * Cuando sí hay dato, la diferencia ES el dato: en la parcela real
 * 9398516VK3799G el Catastro declara 1536 m² mientras el shoelace de las
 * coordenadas que él mismo emite da 1535,87 m². Esos −0,13 m² son la prueba de
 * que la app mide de verdad en lugar de repetir lo que le dieron.
 *
 * ### `superficieCatastral: 0` — decisión explícita
 *
 * Cero es un dato declarado (raro, pero un número), así que `deltaCatastral`
 * **no** es `null`: el `absoluto` sí es calculable y se devuelve. Lo que no está
 * definido es el cociente, así que `relativo` vale `null`. **No se devuelve
 * `Infinity` ni `NaN`**: un `Infinity` colado en la ficha se pinta como «∞%» o
 * como «NaN», que es exactamente el error silencioso que prohíbe la regla de
 * oro 1 — un número que nadie ha calculado, presentado como si lo hubiera
 * calculado alguien.
 *
 * ### Errores
 *
 * Distinción de la regla de oro 1: aquí no hay ningún dato del USUARIO que
 * rechazar (un polígono degenerado se mide, y señalarlo es de F02), así que todo
 * lo que lanza es contrato roto por el PROGRAMADOR. Y el `TypeError` de
 * invariante de `geo/area.js#superficie` (recintos[0] que no es EXTERIOR) **se
 * deja subir sin capturar**, por el mismo razonamiento que
 * `app/main.js#actualizarFicha`: es un bug del programa y tiene que sonar, no
 * quedarse en un guion en el pie.
 *
 * @param {Recinto[]} recintos  Geometría EDITABLE. `recintos[0]` es el EXTERIOR
 *   y el resto HUECOS (invariante de `model/parcela.js`). Vacío ⇒ todo a 0.
 * @param {{superficieCatastral?: number|null}} [opciones]
 * @param {number|null} [opciones.superficieCatastral=null]  La superficie
 *   DECLARADA por el Catastro, en m². `null` = no consta.
 * @returns {Metricas}  Números crudos, sin redondear y sin juicio de valor.
 * @throws {TypeError} Si `recintos` no es un array, si `opciones` no es un
 *   objeto, o si `superficieCatastral` no es un número finito ni `null`.
 * @throws {TypeError} (propagado, no capturado) Si el invariante EXTERIOR/HUECO
 *   de los recintos llega roto: lo lanzan `geo/area.js` y `geo/metrica.js`.
 */
export function metricas(recintos, opciones = {}) {
  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `metricas: 'recintos' debe ser un array de recintos; recibido ${describir(recintos)}.`,
    )
  }
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    // Sin esta guarda, `metricas(recintos, 1536)` devolvería `deltaCatastral:
    // null` —la superficie declarada se perdería por el camino— y la ficha
    // diría «No consta» teniendo el dato delante. Error silencioso (regla 1).
    throw new TypeError(
      `metricas: las opciones deben ser un objeto {superficieCatastral}; recibido ${describir(opciones)}.`,
    )
  }

  const { superficieCatastral = null } = opciones
  if (superficieCatastral !== null && !esNumeroFinito(superficieCatastral)) {
    throw new TypeError(
      `metricas: 'superficieCatastral' debe ser número finito o null (null = no consta); ` +
        `recibido ${describir(superficieCatastral)}.`,
    )
  }

  const saneados = sanearRecintos(recintos)

  // Las dos cifras salen ÍNTEGRAS de `geo/`; aquí no se reimplementa ninguna.
  const superficieMedida = superficie(saneados)
  const perimetros = perimetro(saneados)

  let nVertices = 0
  for (const r of saneados) nVertices += r.vertices.length

  return {
    superficie: superficieMedida,
    perimetro: perimetros,
    nVertices,
    deltaCatastral: calcularDelta(superficieMedida, superficieCatastral),
  }
}

/**
 * `medida − declarada`, o `null` si no hay declarada. Ver {@link metricas} para
 * las dos decisiones que encapsula: `null` ≠ 0 (no hay con qué comparar ≠ no hay
 * discrepancia) y `relativo` como FRACCIÓN, nunca porcentaje — el × 100 es de
 * presentación, y es la confusión clásica de este campo.
 *
 * @param {number} medida  Superficie neta medida por la app, m².
 * @param {number|null} declarada  `cp:areaValue` del Catastro, m².
 * @returns {DeltaCatastral|null}
 */
function calcularDelta(medida, declarada) {
  if (declarada === null) return null

  const absoluto = medida - declarada
  return {
    absoluto,
    // `declarada === 0` captura también `-0`. Sin este corte saldría ±Infinity
    // (o NaN si además la medida fuera 0), y ninguno de los dos es una medida.
    relativo: declarada === 0 ? null : absoluto / declarada,
  }
}

// parsers/levantamiento.js — F18 · ¿EN QUÉ ORDEN SE UNEN LOS PUNTOS DE UN
// LEVANTAMIENTO? Y, SOBRE TODO, ¿CON QUÉ AUTORIDAD SE DICE ESE ORDEN?
//
// ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────
//
// El fichero real de un topógrafo no trae polilíneas: trae **puntos sueltos**.
// Cinco levantamientos del autor medidos el 2026-08-18 dan entre 26 y 88 `POINT`
// y **cero** entidades de anillo, así que hasta hoy `parsers/importar.js` los leía
// enteros, contaba sus puntos, tiraba las coordenadas y devolvía
// `SIN_GEOMETRIA` — la aplicación se comportaba como si el fichero estuviera
// vacío, y lo hacía en verde.
//
// El paso 9 de esta fase los puso como DIANAS del enganche y el 10 dio la
// herramienta para unirlos a mano. Esto es el atajo: **con 88 esquinas, pinchar
// una a una es media hora de trabajo que la aplicación puede ahorrar**, porque el
// orden ya está escrito en el fichero. Lo único que hay que decidir es DÓNDE lo
// lee y con cuánta confianza.
//
// ── LAS DOS AUTORIDADES, Y POR QUÉ NO VALEN LO MISMO ─────────────────────────
//
// 1. **LA NUMERACIÓN.** El software de topografía escribe, junto a cada punto, un
//    rótulo con su número (`1`, `2`, `3`…) en una capa de etiquetas propia. Ese
//    número ES el orden de toma del linde, y unir por él da el contorno que el
//    técnico caminó. Es la autoridad buena, y por eso se prefiere siempre.
//
//    ⭐ El hallazgo que la hace utilizable **sin geometría difusa** lo midió el
//    paso 7 sobre esos cinco ficheros: los rótulos de la capa de números casan
//    **1:1 y POR ORDEN** con los puntos de una capa, una vez fuera el punto del
//    origen. O sea que no hace falta emparejar por proximidad —«el texto más
//    cercano a este punto»—, que es exactamente el tipo de heurística que falla
//    en el fichero número seis y no se puede depurar.
//
// 2. **EL ORDEN DEL FICHERO.** Cuando no hay números utilizables, el orden de
//    `ENTITIES` sigue siendo el orden en que el aparato volcó los puntos, que en
//    un levantamiento normal es el recorrido del linde. Sirve, pero **no es lo
//    mismo** y no se puede presentar igual: por eso {@link ORDEN} viaja en la
//    propuesta y quien la enseñe TIENE que decir cuál de las dos usó. Una
//    propuesta que no dice de dónde saca su orden es una propuesta que el usuario
//    no puede revisar.
//
// ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
//   · **No decide nada.** Devuelve la propuesta y su procedencia; quien pregunta
//     al usuario es `app/dialogo-importacion.js` y quien la aplica, `importar.js`.
//   · **No emite detecciones.** No conoce `parsers/_comun.js#Deteccion`: mide y
//     contesta, como `parsers/topologia.js`.
//   · **No valida la geometría.** El anillo propuesto puede cruzarse consigo
//     mismo —un levantamiento con un punto mal numerado lo hace— y eso NO se
//     corrige aquí: es un hallazgo de `validation/`, que ya sabe decirlo y tiene
//     dónde. Corregirlo en silencio sería inventarse un linde.
//   · **No convierte husos ni proyecta.** Entran pares UTM y salen pares UTM.

// ── Constantes públicas ──────────────────────────────────────────────────────

/** De dónde sale el orden de la propuesta. Viaja con ella SIEMPRE. */
export const ORDEN = Object.freeze({
  /** De los rótulos numéricos de la capa de etiquetas. La autoridad buena. */
  NUMERACION: 'NUMERACION',
  /** Del orden de `ENTITIES`. Sirve, y hay que decir que es esto. */
  FICHERO: 'FICHERO',
})

/**
 * Por qué NO hay propuesta. `null` en la propuesta significa que sí la hay.
 *
 * Son los dos únicos casos, y ninguno es un error del fichero: un DXF de
 * polilíneas no tiene puntos, y dos puntos no son un recinto.
 */
export const SIN_PROPUESTA = Object.freeze({
  SIN_PUNTOS: 'SIN_PUNTOS',
  POCOS_PUNTOS: 'POCOS_PUNTOS',
})

/** Mínimo para que un anillo sea un anillo. El mismo que `edit/dibujo.js`. */
export const MINIMO_VERTICES = 3

// ── Helpers ──────────────────────────────────────────────────────────────────

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

/**
 * ¿Este texto es un número de punto? Un ENTERO sin signo, con los espacios
 * fuera.
 *
 * ⚠️ **Y decimales NO**, que es lo que separa la capa de números de la de cotas:
 * en el fichero real conviven `VER_NOPTO` con `1`, `2`, `3` y `VER_COTAS` con
 * `404.301`, `404.212`… Las dos son numéricas y las dos casan 1:1 con los puntos,
 * así que aceptar decimales elegiría la cota como numeración —y ordenaría el
 * linde por ALTURA, que es un contorno absurdo y perfectamente silencioso—.
 *
 * @param {string} texto
 * @returns {number|null}  El número, o `null` si no lo es.
 */
function numeroDePunto(texto) {
  if (typeof texto !== 'string') return null
  const limpio = texto.trim()
  if (!/^\d+$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isSafeInteger(n) ? n : null
}

/** Agrupa por capa conservando el orden de aparición. */
function porCapa(items) {
  const mapa = new Map()
  for (const it of items) {
    const capa = typeof it?.capa === 'string' ? it.capa : ''
    if (!mapa.has(capa)) mapa.set(capa, [])
    mapa.get(capa).push(it)
  }
  return mapa
}

/**
 * La capa de puntos con la que se trabaja: la que MÁS puntos tiene, y en un
 * empate la primera del fichero.
 *
 * ⚠️ **Elegir una es obligatorio, y no es un capricho.** El software escribe cada
 * punto DOS veces —una en la capa 2D y otra en la 3D con su cota—, así que unir
 * «todos los puntos» daría un anillo con cada vértice repetido y el doble de
 * lados. `parseDXF` los devuelve sin deduplicar a propósito («elegir capa es del
 * llamante»), y este es el llamante.
 *
 * @param {Map<string, object[]>} grupos
 * @returns {string|null}
 */
function capaConMasPuntos(grupos) {
  let mejor = null
  let cuantos = -1
  for (const [capa, lista] of grupos) {
    if (lista.length > cuantos) {
      mejor = capa
      cuantos = lista.length
    }
  }
  return mejor
}

/**
 * La capa de rótulos que sirve de NUMERACIÓN para estos puntos, o `null`.
 *
 * Tiene que cumplir las dos cosas a la vez, y las dos son estrictas:
 *   · **casar 1:1 en recuento** con los puntos elegidos (el hallazgo del paso 7);
 *   · que **todos** sus textos sean números de punto (ver {@link numeroDePunto}).
 *
 * ⛔ **Y que los números NO SE REPITAN.** Dos puntos con el número 7 no dan un
 * orden: dan dos órdenes distintos y uno se elige por cómo esté implementada la
 * ordenación, que es la definición de un resultado arbitrario. Ahí se declina y
 * la propuesta cae al orden del fichero — que es peor, pero es explicable.
 *
 * Si hay varias capas que cumplen, gana la primera del fichero: son
 * indistinguibles por lo que este módulo puede medir, y elegir la primera es al
 * menos estable entre ejecuciones.
 *
 * @param {Map<string, object[]>} grupos  Rótulos por capa.
 * @param {number} cuantosPuntos
 * @returns {{capa: string, numeros: number[]}|null}
 */
function capaDeNumeracion(grupos, cuantosPuntos) {
  for (const [capa, lista] of grupos) {
    if (lista.length !== cuantosPuntos) continue
    const numeros = lista.map((t) => numeroDePunto(t?.texto))
    if (numeros.some((n) => n === null)) continue
    if (new Set(numeros).size !== numeros.length) continue
    return { capa, numeros }
  }
  return null
}

// ── La propuesta ─────────────────────────────────────────────────────────────

/**
 * @typedef {object} Propuesta
 * @property {Array<[number,number]>|null} anillo  Anillo ABIERTO en UTM (sin
 *   vértice de cierre repetido, que es la convención del modelo §4.3), o `null`
 *   si no hay propuesta.
 * @property {string|null} motivo  Código de {@link SIN_PROPUESTA} cuando
 *   `anillo` es `null`; `null` cuando sí hay propuesta.
 * @property {'NUMERACION'|'FICHERO'} orden  De dónde sale el orden. **Hay que
 *   decírselo al usuario**: ver la cabecera.
 * @property {string|null} capa  La capa de puntos usada.
 * @property {Array<{capa: string, puntos: number}>} capasCandidatas  Las capas
 *   con puntos y CUÁNTOS tiene cada una, de más a menos poblada. Es lo que permite
 *   ofrecer «esta no, la otra» sin volver a parsear — y el recuento hace falta para
 *   poder escribirlo: «los 88 de VER_P2D» dice algo, «VER_P2D» no dice nada a quien
 *   no conoce las capas de su propio CAD.
 * @property {string|null} capaNumeros  La capa de rótulos que dio la numeración,
 *   o `null` si el orden es del fichero.
 * @property {number[]|null} numeros  Los números usados, YA EN EL ORDEN del
 *   anillo. `null` con orden de fichero. Sirve para decir «del 1 al 88».
 * @property {number} descartados  Puntos que no llegaron al anillo por caer
 *   encima del anterior. Se cuenta para poder decirlo, no para esconderlo.
 */

/**
 * Propone el anillo que une los puntos de un levantamiento.
 *
 * ── EL RECORRIDO, EN ORDEN ──────────────────────────────────────────────────
 *   1. Se eligen los puntos de UNA capa (ver {@link capaConMasPuntos}).
 *   2. Se busca su numeración (ver {@link capaDeNumeracion}). Si la hay, el
 *      anillo va ordenado por número ASCENDENTE; si no, en el orden del fichero.
 *   3. Se quitan los repetidos CONSECUTIVOS —incluido el que cierra el anillo
 *      volviendo al primero, que muchos aparatos vuelcan— porque un lado de
 *      longitud cero no es un lado. Se CUENTAN en `descartados`.
 *   4. Con menos de {@link MINIMO_VERTICES} vértices no hay propuesta.
 *
 * No muta la entrada y no devuelve nada de ella: cada par del anillo es nuevo.
 *
 * @param {object} [args]
 * @param {Array<{capa?: string, x: number, y: number}>} [args.puntos=[]]  Los de
 *   `parsers/dxf.js#puntos`, TAL CUAL (con su capa; sin deduplicar).
 * @param {Array<{capa?: string, texto?: string}>} [args.rotulos=[]]  Los de
 *   `parsers/dxf.js#rotulos`, tal cual.
 * @param {string|null} [args.capa=null]  Fuerza la capa de puntos. `null` = la
 *   elige este módulo. Es lo que el usuario contesta cuando hay varias.
 * @returns {Propuesta}
 * @throws {TypeError}  Si `puntos` o `rotulos` no son arrays (contrato del
 *   programador: adivinar aquí sería devolver «no hay propuesta» sobre un
 *   fichero que sí la tenía, y en silencio).
 */
export function propuestaDePuntos({ puntos = [], rotulos = [], capa = null } = {}) {
  const FN = 'propuestaDePuntos'
  if (!Array.isArray(puntos)) {
    throw new TypeError(`${FN}: 'puntos' debe ser un array (los de parseDXF); recibido ${typeof puntos}.`)
  }
  if (!Array.isArray(rotulos)) {
    throw new TypeError(
      `${FN}: 'rotulos' debe ser un array (los de parseDXF); recibido ${typeof rotulos}.`,
    )
  }
  if (capa !== null && typeof capa !== 'string') {
    throw new TypeError(`${FN}: 'capa' debe ser el nombre literal de una capa o null.`)
  }

  const vacia = {
    anillo: null,
    motivo: SIN_PROPUESTA.SIN_PUNTOS,
    orden: ORDEN.FICHERO,
    capa: null,
    capasCandidatas: [],
    capaNumeros: null,
    numeros: null,
    descartados: 0,
  }

  const utiles = puntos.filter((p) => p && esNumeroFinito(p.x) && esNumeroFinito(p.y))
  if (utiles.length === 0) return vacia

  const grupos = porCapa(utiles)
  const capasCandidatas = [...grupos.entries()]
    .sort((a, b) => b[1].length - a[1].length)
    .map(([nombre, lista]) => ({ capa: nombre, puntos: lista.length }))

  // Una capa pedida que no existe NO se corrige en silencio a otra: se contesta
  // que ahí no hay puntos, que es la verdad, y quien preguntó vuelve a preguntar.
  const elegida = capa === null ? capaConMasPuntos(grupos) : capa
  const mios = grupos.get(elegida) ?? []
  if (mios.length === 0) {
    return { ...vacia, capa: elegida, capasCandidatas }
  }

  const numeracion = capaDeNumeracion(porCapa(rotulos), mios.length)

  // El orden. Con numeración se ordena por número; sin ella se respeta el del
  // fichero. `sort` sobre una copia: la entrada no se toca.
  const conIndice = mios.map((p, i) => ({ p, n: numeracion === null ? i : numeracion.numeros[i] }))
  if (numeracion !== null) conIndice.sort((a, b) => a.n - b.n)

  // Repetidos CONSECUTIVOS fuera, y el cierre también: `[A,B,C,A]` es el anillo
  // `[A,B,C]` con el vértice de cierre escrito, y el modelo lo guarda ABIERTO.
  const anillo = []
  let descartados = 0
  const numeros = []
  for (const { p, n } of conIndice) {
    const ultimo = anillo.at(-1)
    if (ultimo !== undefined && ultimo[0] === p.x && ultimo[1] === p.y) {
      descartados += 1
      continue
    }
    anillo.push([p.x, p.y])
    numeros.push(n)
  }
  if (anillo.length > 1) {
    const primero = anillo[0]
    const ultimo = anillo.at(-1)
    if (primero[0] === ultimo[0] && primero[1] === ultimo[1]) {
      anillo.pop()
      numeros.pop()
      descartados += 1
    }
  }

  const orden = numeracion === null ? ORDEN.FICHERO : ORDEN.NUMERACION
  if (anillo.length < MINIMO_VERTICES) {
    return {
      anillo: null,
      motivo: SIN_PROPUESTA.POCOS_PUNTOS,
      orden,
      capa: elegida,
      capasCandidatas,
      capaNumeros: numeracion === null ? null : numeracion.capa,
      numeros: null,
      descartados,
    }
  }

  return {
    anillo,
    motivo: null,
    orden,
    capa: elegida,
    capasCandidatas,
    capaNumeros: numeracion === null ? null : numeracion.capa,
    numeros: numeracion === null ? null : numeros,
    descartados,
  }
}

export default propuestaDePuntos

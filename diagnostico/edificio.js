// diagnostico/edificio.js — F14 · EL CONTRASTE DE LA CONSTRUCCIÓN.
//
// Hermano de `diagnostico/parcela.js` y con su mismo oficio: **componer, no
// calcular**. Cada cifra sale del módulo que ya la sabe —
//
//   superficie   → `geo/area.js#superficie`         (shoelace sobre UTM, regla 5)
//   perímetro    → `geo/metrica.js#perimetro`       (euclídeo propio, regla 6)
//   centroide    → `geo/centroide.js#centroide`     (ponderado por área)
//   solape       → `diagnostico/topologia.js#solape`
//   invasión     → `diagnostico/topologia.js#invasiones`
//
// — y aquí solo se suma, se resta, se divide y se decide qué es `null`. Una
// segunda implementación de cualquiera de ellas sería una SEGUNDA VERDAD, y la que
// se pinta en el contraste no puede discrepar de la que se serializa en el GML.
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ LO ÚNICO QUE HAY QUE ENTENDER ANTES DE TOCAR ESTE FICHERO: **PIEZA A PIEZA**
// ═════════════════════════════════════════════════════════════════════════════
// La envolvente de un edificio son **N cuerpos disjuntos**, no uno: el edificio
// real de `9398516VK3799G` son DOS (5,2003 y 316,9279 m²), y el `Building` que
// publica el Catastro también trae DOS `gml:PolygonPatch`. `edificio/envolvente.js`
// lo devuelve ya así: `Array<Recinto[]>`, una lista de PIEZAS.
//
// La tentación es aplanarlo a un solo `Recinto[]` y llamar a los módulos de
// siempre. **MEDIDO en la fase 0 de F14, y los dos módulos de abajo discrepan:**
//
//   · `geo/area.js#superficie([EXTERIOR, EXTERIOR])`  → ⛔ **LANZA**
//     («recintos[1] debe ser HUECO»). Es la guarda que F12 puso después de pagar
//     el defecto de los «400 − 3.000 m²».
//   · `geo/poligono.js#coordsRegion([EXTERIOR, EXTERIOR])` → ⚠️ **NO lanza**:
//     mira la POSICIÓN y no el `tipo`, así que toma el segundo cuerpo por un
//     HUECO del primero. `solape` de la envolvente real consigo misma devuelve
//     entonces **5,2003 m² en vez de 322,1282**: un error mudo de 316,93 m², el
//     **98,4 %** del edificio.
//
// Por eso aquí NO se aplana nunca: se recorre `piezas` y se suma. Cuesta un bucle
// y ahorra la clase de error que este proyecto ya ha pagado dos veces.
//
// ═════════════════════════════════════════════════════════════════════════════
// LOS CUATRO SABORES DE «NO HAY», UNO MÁS QUE EN F07
// ═════════════════════════════════════════════════════════════════════════════
// `diagnostico/parcela.js` distingue tres. Aquí hace falta un cuarto, y es el que
// da sentido a la fase: **«se preguntó, y el Catastro dice que NO CONSTA»**.
//
//   1. **{@link REGISTRO}.NO_CONSULTADO** — nadie ha preguntado al `wfsBU`.
//   2. **{@link REGISTRO}.SIN_CONSTRUCCIONES** — se preguntó y **no hay nada
//      registrado**. Es el caso de la OBRA NUEVA, y es un RESULTADO, no un fallo:
//      el servicio contesta `200 OK` con una colección vacía (medido, F11 · M7).
//      La ficha de F14 §16.3 lo llama «la pantalla honesta» y pide que se diga con
//      claridad **en lugar de inventar una geometría de referencia**.
//   3. **{@link REGISTRO}.NO_SE_HA_PODIDO** — se intentó y falló (la red, el
//      servicio). No es lo mismo que «no consta», y tranquilizar con lo segundo
//      cuando ha pasado lo primero es la mentira cómoda de siempre.
//   4. **{@link REGISTRO}.CONSULTADO** — hay huella oficial con la que comparar.
//
// ⭐ **La pantalla honesta NO es un camino de código aparte.** Es el estado 2 de
// este mismo resultado: las secciones comparativas salen a `null` con su motivo en
// `omisiones`, y `registro.motivo` lleva la frase entera. Un solo camino, imposible
// de olvidar el día que alguien añada una sección.
//
// ═════════════════════════════════════════════════════════════════════════════
// LA FRONTERA DE LA REGLA DE ORO 9 PASA POR EL TIPO DE RETORNO
// ═════════════════════════════════════════════════════════════════════════════
// Si esta función no puede devolver un booleano de mérito, ninguna vista puede
// pintar un semáforo a partir de ella. No hay `ok`, ni `correcto`, ni `dentro`, ni
// `nivel`, ni `color`. La app MIDE y el colegiado interpreta y firma. La única
// excepción que la spec admite —la invasión a colindante, hecho topológico
// binario— sale como área y referencia catastral, y es la capa de pintado la que
// le pone el ámbar. Hay un guardián que recorre el objeto REAL, no una lista
// escrita a mano.
//
// ═════════════════════════════════════════════════════════════════════════════
// ESTE MÓDULO ES CIEGO A DE DÓNDE VINO EL DATO
// ═════════════════════════════════════════════════════════════════════════════
// Recibe piezas, caras, un estado de consulta, unos recintos de parcela y unas
// vecinas. No conoce Leaflet, ni el store, ni la red, ni `Edificio`, ni
// `EdificioCatastro`. Traducir en la frontera es del cableado — lo mismo que
// permitió a F08 reutilizar `diagnosticar` sin tocar una línea.
//
// ⚠️ **Y ojo con de dónde sale la huella oficial**, que la fase 0 lo midió:
// `edificio/entrada.js` **descarta** la envolvente del `Building` a propósito
// (detección `PATCHES_MULTIPLES`), porque su oficio es construir un MODELO y el
// modelo declara la envolvente DERIVADA. Quien tiene la huella publicada es
// **`gml/parse-bu.js#parsearGmlBu(...).edificio.anillos`**. Eso es del cableado;
// aquí llega ya en forma de piezas.
//
// Puro: sin DOM, sin red, sin reloj, sin Leaflet. Proyecto Vitest `node`.

import { superficie } from '../geo/area.js'
import { centroide } from '../geo/centroide.js'
import { distancia, perimetro } from '../geo/metrica.js'
import { OPERATIVOS } from '../config/operativos.js'
import { describir, exigirOpciones, exigirRecintos } from './_comun.js'
import { invasiones, solape } from './topologia.js'

/** @typedef {import('./_comun.js').Recinto} Recinto */
/** @typedef {import('./_comun.js').Vecina} Vecina */

/**
 * Una PIEZA de una construcción: un cuerpo disjunto, con su exterior y sus huecos.
 * Es la unidad con la que trabaja todo este módulo — ver la cabecera.
 *
 * @typedef {Recinto[]} Pieza
 */

// ── Vocabulario ──────────────────────────────────────────────────────────────

/**
 * En qué estado está la consulta de la construcción registrada. **Es el eje del
 * módulo**, no un detalle: de él depende si hay contraste o si lo que hay que
 * enseñar es la pantalla honesta. Ver la cabecera.
 *
 * Se exporta para que la vista NO escriba `'SIN_CONSTRUCCIONES'` a mano: un
 * literal mal escrito en una plantilla no se queja, simplemente no casa.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const REGISTRO = Object.freeze({
  /** Nadie ha preguntado al Catastro. El contraste es OPCIONAL y esto es su estado inicial. */
  NO_CONSULTADO: 'NO_CONSULTADO',
  /** Se preguntó y **no hay construcción registrada**. Obra nueva: la pantalla honesta. */
  SIN_CONSTRUCCIONES: 'SIN_CONSTRUCCIONES',
  /** Se intentó y no se pudo (red, servicio). **No** es «no consta». */
  NO_SE_HA_PODIDO: 'NO_SE_HA_PODIDO',
  /** Hay huella oficial publicada con la que comparar. */
  CONSULTADO: 'CONSULTADO',
})

/** Los estados admitidos, para la guarda y para los tests. */
const REGISTROS = Object.freeze(Object.values(REGISTRO))

/**
 * Claves de las secciones que pueden quedar sin medir. Vocabulario de
 * `omisiones[].que`, exportado por lo mismo que {@link REGISTRO}.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const OMISION_EDIFICIO = Object.freeze({
  SOLAPE: 'solape',
  DIFERENCIA: 'diferencia',
  CENTROIDES: 'centroides',
  EN_PARCELA: 'enParcela',
})

// ── Los motivos, en español presentable TAL CUAL ─────────────────────────────
//
// Se escriben aquí y no en la vista por la regla de oro 1: quien decide que algo
// no se puede medir es quien sabe por qué, y un código de motivo obligaría a la
// vista a mantener su propia tabla de traducciones que puede quedarse corta en
// silencio. Se exportan los que la vista necesita afirmar sin copiar el literal.

/**
 * ⭐ **La frase de la pantalla honesta.** Es el acierto de diseño que la ficha de
 * F14 pide conservar con todas las letras: se dice que no hay nada registrado **y**
 * se dice que eso no invalida nada, porque el técnico que lee «no consta» en una
 * herramienta de expediente teme haber hecho algo mal.
 */
export const MOTIVO_SIN_CONSTRUCCIONES =
  'No consta construcción registrada en el Catastro para esta parcela, así que no hay nada con ' +
  'lo que contrastar. No es un problema: el contraste es un paso opcional y el GML que se genera ' +
  'es plenamente válido sin él — es justo lo que se espera de una obra nueva.'

/** Nadie ha preguntado todavía. Dice qué falta y cómo conseguirlo. */
export const MOTIVO_NO_CONSULTADO =
  'Todavía no se ha consultado al Catastro si hay construcción registrada en esta parcela. ' +
  'Mientras no se consulte no hay con qué contrastar, y eso no es lo mismo que no haber nada.'

/** Se intentó y falló. **Nunca** se presenta como «no consta». */
export const MOTIVO_NO_SE_HA_PODIDO =
  'No se ha podido consultar la construcción registrada en el Catastro. No se sabe si hay alguna ' +
  'o no: el contraste queda sin hacer, y el GML se puede generar igual.'

/** No hay parcela declarada con la que comparar. */
export const MOTIVO_SIN_PARCELA =
  'No hay ninguna parcela cargada con la que comparar, así que no se puede medir cuánto de la ' +
  'construcción cae dentro de ella.'

/** Uno de los dos contornos no encierra superficie. */
export const MOTIVO_CENTROIDE_DEGENERADO =
  'Alguna de las dos huellas no encierra superficie, así que no tiene centroide que desplazar.'

/** No hay ni una pieza medible en la construcción propia. */
export const MOTIVO_SIN_HUELLA_PROPIA =
  'La construcción no tiene ninguna huella con volumen sobre rasante, así que no hay superficie ' +
  'que contrastar. Revisa las plantas de las partes.'

/** El motivo que le toca a cada estado del registro. */
const MOTIVO_REGISTRO = Object.freeze({
  [REGISTRO.NO_CONSULTADO]: MOTIVO_NO_CONSULTADO,
  [REGISTRO.SIN_CONSTRUCCIONES]: MOTIVO_SIN_CONSTRUCCIONES,
  [REGISTRO.NO_SE_HA_PODIDO]: MOTIVO_NO_SE_HA_PODIDO,
  [REGISTRO.CONSULTADO]: null,
})

// ── Helpers internos ─────────────────────────────────────────────────────────

/**
 * Contrato del llamante: una lista de PIEZAS, cada una un `Recinto[]`. LANZA.
 *
 * Se comprueban las dos capas —que es un array, y que cada elemento lo es— porque
 * el error que esta guarda existe para cazar es pasar un `Recinto[]` donde va un
 * `Array<Recinto[]>`, y eso NO revienta más abajo: `superficie` recibiría un
 * `Recinto` suelto y se quejaría de otra cosa tres módulos más allá.
 *
 * @param {unknown} piezas
 * @param {string} nombre  Nombre del argumento, para el mensaje.
 */
function exigirPiezas(piezas, nombre) {
  if (!Array.isArray(piezas)) {
    throw new TypeError(
      `contrastarEdificio: '${nombre}' debe ser un array de PIEZAS (Array<Recinto[]>, como el ` +
        `'recintos' de edificio/envolvente.js#envolventeDe); recibido ${describir(piezas)}.`,
    )
  }
  piezas.forEach((pieza, i) => {
    exigirRecintos(pieza, 'contrastarEdificio', `${nombre}[${i}]`)
    if (pieza.length === 0) {
      throw new TypeError(
        `contrastarEdificio: '${nombre}[${i}]' está vacía. Una pieza es un cuerpo con su ` +
          `exterior y sus huecos; una lista vacía no es una pieza, es la ausencia de una.`,
      )
    }
  })
}

/** ¿Tiene esta pieza superficie que medir? */
const piezaMedible = (pieza) => superficie(pieza) > OPERATIVOS.areaNulaM2

/**
 * Superficie de un conjunto de piezas, sumando pieza a pieza.
 *
 * ⛔ **NO se aplana** — ver la cabecera. `superficie` mide UNA región (un exterior
 * y sus huecos); N cuerpos disjuntos son N regiones y su superficie es la suma.
 *
 * @param {Pieza[]} piezas
 * @returns {number}
 */
const superficieDePiezas = (piezas) => piezas.reduce((total, pieza) => total + superficie(pieza), 0)

/**
 * Perímetros de un conjunto de piezas, sumados por papel.
 *
 * @param {Pieza[]} piezas
 * @returns {{exterior: number, huecos: number, total: number}}
 */
function perimetroDePiezas(piezas) {
  return piezas.reduce(
    (suma, pieza) => {
      const p = perimetro(pieza)
      return {
        exterior: suma.exterior + p.exterior,
        huecos: suma.huecos + p.huecos,
        total: suma.total + p.total,
      }
    },
    { exterior: 0, huecos: 0, total: 0 },
  )
}

/**
 * Centroide del conjunto, ponderado por el área de cada pieza.
 *
 * ⚠️ **Esto NO reimplementa el centroide**: `geo/centroide.js` lo calcula para cada
 * pieza —ponderado por área, restando huecos— y aquí solo se hace la media
 * ponderada de los N que devuelve, que es la composición que le corresponde a un
 * conjunto de cuerpos disjuntos. No hay función para esto en `geo/` porque hasta
 * F14 nadie tenía cuerpos disjuntos que componer.
 *
 * Las piezas sin superficie no cuentan ni arrastran: un cuerpo degenerado con peso
 * cero movería el centroide hacia un punto que no representa nada.
 *
 * @param {Pieza[]} piezas
 * @returns {[number, number]|null}  `null` si no hay ninguna pieza con área.
 */
function centroideDePiezas(piezas) {
  let peso = 0
  let sx = 0
  let sy = 0
  for (const pieza of piezas) {
    const area = superficie(pieza)
    if (!(area > OPERATIVOS.areaNulaM2)) continue
    const c = centroide(pieza)
    if (c === null) continue
    peso += area
    sx += c[0] * area
    sy += c[1] * area
  }
  return peso === 0 ? null : [sx / peso, sy / peso]
}

/**
 * Superficie común entre dos conjuntos de piezas, **todas contra todas**.
 *
 * Dos cuerpos disjuntos del edificio pueden solapar con caras distintas de la
 * huella oficial, así que la pregunta «cuánto tienen en común los dos conjuntos»
 * no se responde emparejando piezas por índice: se cruzan.
 *
 * @param {Pieza[]} unas
 * @param {Pieza[]} otras
 * @returns {{area: number, piezas: Array<Recinto[]>, nPiezas: number, saltados: object[]}}
 */
function solapeDeConjuntos(unas, otras) {
  let area = 0
  const trozos = []
  const saltados = []
  for (const a of unas) {
    for (const b of otras) {
      const s = solape(a, b)
      area += s.area
      trozos.push(...s.piezas)
      saltados.push(...s.saltados)
    }
  }
  return { area, piezas: trozos, nPiezas: trozos.length, saltados }
}

/**
 * Clave de deduplicación de un recinto saltado. Mismo criterio que
 * `diagnostico/parcela.js`: cruzar N×M piezas reporta el mismo cuerpo degenerado
 * una vez por cruce, y N copias de la misma frase no son N datos.
 */
const claveSaltado = (s) => `${s.donde}|${s.indice}|${s.motivo}`

/** Quita los saltados repetidos conservando el primero de cada clase. */
function deduplicar(lista) {
  const vistos = new Set()
  const unicos = []
  for (const s of lista) {
    const clave = claveSaltado(s)
    if (vistos.has(clave)) continue
    vistos.add(clave)
    unicos.push(s)
  }
  return unicos
}

// ── El orquestador ───────────────────────────────────────────────────────────

/**
 * Contraste de una construcción medida contra la registrada en el Catastro
 * (ficha F14 §16.3, plan §16.3).
 *
 * ```js
 * const env = envolventeDe(edificio.partes)          // edificio/envolvente.js
 * const contraste = contrastarEdificio({
 *   envolvente: env.recintos,                        // Array<Recinto[]> — las PIEZAS
 *   huellaOficial: caras,                            // gml/parse-bu.js → .edificio.anillos
 *   registro: REGISTRO.CONSULTADO,
 *   parcelaContexto: parcela.recintos,
 *   vecinas: [{refcat, recintos}],
 * })
 * ```
 *
 * ### Lo que mide, y lo que deja sin medir
 *
 *   · **Huella**: superficie y perímetro de lo medido y de lo publicado, y su
 *     diferencia. Siempre que haya con qué.
 *   · **Solape** y **diferencia simétrica** entre las dos huellas.
 *   · **Desplazamiento de centroides**, ponderado por área.
 *   · **Cuánto cae dentro de la parcela** declarada, y cuánto fuera.
 *   · **Invasión a colindantes**, la única sección con consecuencia fija.
 *
 * Lo que no se puede medir sale a `null` **con su entrada en `omisiones`**, que
 * dice CUÁL y POR QUÉ en español: la vista no tiene que adivinar si un `null` es
 * «no aplica» o «algo falló».
 *
 * @param {Object} entrada
 * @param {Pieza[]} entrada.envolvente  Las PIEZAS de la construcción medida, tal
 *   como las devuelve `edificio/envolvente.js#envolventeDe(...).recintos`.
 *   **Obligatorio** (`[]` es legítimo: una construcción sin volumen sobre rasante).
 * @param {Pieza[]|null} [entrada.huellaOficial=null]  Las CARAS de la huella
 *   publicada por el Catastro. `null` cuando no hay ninguna, sea cual sea el
 *   motivo — el motivo lo dice `registro`.
 * @param {string} [entrada.registro=REGISTRO.NO_CONSULTADO]  Clave de
 *   {@link REGISTRO}. ⚠️ **Es el dato que distingue «no hay» de «no se ha
 *   mirado»**, y por eso tiene guarda propia en vez de deducirse de
 *   `huellaOficial === null`: los tres estados sin huella se representarían igual.
 * @param {Recinto[]|null} [entrada.parcelaContexto=null]  Recintos de la parcela
 *   declarada. `null` = no consta, y entonces `enParcela` va a `null` con su motivo.
 * @param {Vecina[]|null} [entrada.vecinas=null]  `[{refcat, recintos}]`.
 *   **`null` = NO SE HA CONSULTADO** (→ `invasion.consultado: false`); `[]` = se
 *   consultó y no hay ninguna. Dos afirmaciones distintas, y la segunda tranquiliza.
 * @returns {{
 *   registro: {clave: string, motivo: string|null},
 *   huella: {medida: number, oficial: number|null, diferencia: number|null,
 *            nPiezasMedida: number, nCarasOficial: number|null,
 *            perimetroMedido: {exterior: number, huecos: number, total: number},
 *            perimetroOficial: {exterior: number, huecos: number, total: number}|null},
 *   solape: {area: number, relativo: number|null, piezas: Array<Recinto[]>, nPiezas: number}|null,
 *   diferencia: {area: number}|null,
 *   centroides: {medido: [number,number], oficial: [number,number], distancia: number}|null,
 *   enParcela: {superficieDentro: number, superficieFuera: number, relativo: number|null}|null,
 *   invasion: {consultado: boolean, invasiones: Array<Object>, descartadas: Array<Object>},
 *   omisiones: Array<{que: string, motivo: string}>,
 *   saltados: Array<Object>,
 * }}
 *   **Ni una clave de veredicto** (regla de oro 9), y hay un guardián que lo afirma
 *   recorriendo el objeto real.
 * @throws {TypeError} Contrato del programador: `entrada` que no es objeto,
 *   `envolvente`/`huellaOficial` que no son listas de piezas, `registro`
 *   desconocido, `vecinas` mal formadas.
 * @throws {TypeError} (propagado) Si el invariante EXTERIOR/HUECO llega roto: lo
 *   lanzan `geo/area.js`, `geo/metrica.js` y `geo/centroide.js`, y se deja subir
 *   porque es un bug del programa, no un dato del usuario. ⭐ Es justo la guarda que
 *   caza el aplanado de piezas descrito en la cabecera.
 */
export function contrastarEdificio(entrada) {
  exigirOpciones(entrada, 'contrastarEdificio', 'un objeto de entrada {envolvente, …}')

  const {
    envolvente,
    huellaOficial = null,
    registro = REGISTRO.NO_CONSULTADO,
    parcelaContexto = null,
    vecinas = null,
  } = entrada

  exigirPiezas(envolvente, 'envolvente')
  if (huellaOficial !== null) exigirPiezas(huellaOficial, 'huellaOficial')
  if (!REGISTROS.includes(registro)) {
    throw new TypeError(
      `contrastarEdificio: 'registro' desconocido: ${describir(registro)}. ` +
        `Los únicos son ${REGISTROS.join(', ')} (diagnostico/edificio.js#REGISTRO). ` +
        `No se deduce de 'huellaOficial === null' a propósito: los tres estados sin ` +
        `huella se representarían igual y significan cosas distintas.`,
    )
  }
  if (parcelaContexto !== null) {
    exigirRecintos(parcelaContexto, 'contrastarEdificio', 'parcelaContexto')
  }
  if (vecinas !== null && !Array.isArray(vecinas)) {
    throw new TypeError(
      `contrastarEdificio: 'vecinas' debe ser un array de {refcat, recintos} o null ` +
        `(null = no se ha consultado, [] = se consultó y no hay ninguna); ` +
        `recibido ${describir(vecinas)}.`,
    )
  }
  // ⚠️ Coherencia entre los dos ejes, comprobada y no supuesta. `CONSULTADO` sin
  // huella sería el estado que promete un contraste que no puede haber, y las
  // secciones saldrían a `null` sin que `registro` explicara por qué: exactamente
  // el silencio que los cuatro sabores existen para impedir.
  if (registro === REGISTRO.CONSULTADO && huellaOficial === null) {
    throw new TypeError(
      `contrastarEdificio: 'registro' es CONSULTADO pero 'huellaOficial' es null. ` +
        `Si se consultó y no había nada registrado, el estado es SIN_CONSTRUCCIONES; ` +
        `si la consulta falló, NO_SE_HA_PODIDO. Ver diagnostico/edificio.js#REGISTRO.`,
    )
  }

  /** @type {Array<{que: string, motivo: string}>} */
  const omisiones = []
  /** @type {object[]} */
  const saltados = []

  // Solo cuentan las piezas con superficie: una degenerada no aporta huella y
  // reventaría los cruces topológicos más abajo con un `saltados` por cada pareja.
  const piezas = envolvente.filter(piezaMedible)
  const caras = huellaOficial === null ? null : huellaOficial.filter(piezaMedible)
  const hayOficial = caras !== null && caras.length > 0

  // ── La huella: lo que siempre se puede medir ──────────────────────────────
  const areaMedida = superficieDePiezas(piezas)
  const areaOficial = hayOficial ? superficieDePiezas(caras) : null

  const huella = {
    medida: areaMedida,
    oficial: areaOficial,
    // Con signo implícito: positivo = medimos MÁS que lo registrado. Quien lo
    // presenta decide cómo rotularlo; aquí solo se resta.
    diferencia: areaOficial === null ? null : areaMedida - areaOficial,
    nPiezasMedida: piezas.length,
    nCarasOficial: caras === null ? null : caras.length,
    perimetroMedido: perimetroDePiezas(piezas),
    perimetroOficial: hayOficial ? perimetroDePiezas(caras) : null,
  }

  // ── El motivo de que no haya contraste, si no lo hay ──────────────────────
  //
  // Se escribe UNA vez y se reparte a todas las secciones que dependen de las dos
  // huellas: dos redacciones del mismo hecho es dos sitios que divergen.
  //
  // ⛔ **Son DOS causas independientes, y la primera versión de esto solo miraba
  // una.** Faltar la huella PROPIA y faltar la OFICIAL son cosas distintas y pueden
  // darse por separado; mirar solo la segunda dejaba las omisiones con
  // `motivo: null` cuando lo que faltaba era la primera — un hueco mudo dentro de
  // la estructura que existe justamente para que no haya huecos mudos (regla 1).
  // Lo cazó una prueba en la primera corrida.
  //
  // Cuando faltan las dos manda la PROPIA: es la única sobre la que el técnico
  // puede hacer algo, y decirle que el Catastro no contesta cuando además no ha
  // declarado ni una planta sería mandarle a arreglar lo que no le desbloquea nada.
  const motivoSinContraste =
    piezas.length === 0
      ? MOTIVO_SIN_HUELLA_PROPIA
      : hayOficial
        ? null
        : (MOTIVO_REGISTRO[registro] ?? MOTIVO_NO_CONSULTADO)

  // ── Solape y diferencia simétrica ─────────────────────────────────────────
  let seccionSolape = null
  let seccionDiferencia = null
  if (hayOficial && piezas.length > 0) {
    const s = solapeDeConjuntos(piezas, caras)
    saltados.push(...s.saltados)

    // El PORCENTAJE se calcula aquí y no en `topologia.js`, que se negó a hacerlo
    // a propósito: «sobre la mayor de las dos» exige saber cuál es la mayor, y eso
    // es una decisión de presentación. Aquí sí se tienen las dos medidas.
    const mayor = Math.max(areaMedida, areaOficial)
    seccionSolape = {
      area: s.area,
      // `mayor === 0` ⇒ null y no 0: dos huellas sin superficie no solapan «el
      // 0 %», es que la pregunta no tiene respuesta.
      relativo: mayor === 0 ? null : s.area / mayor,
      piezas: s.piezas,
      nPiezas: s.nPiezas,
    }
    // Diferencia simétrica SIN geometría booleana: |A| + |B| − 2·|A∩B|. Es exacta,
    // no una aproximación, y es la misma identidad que usa `diagnostico/parcela.js`.
    seccionDiferencia = { area: areaMedida + areaOficial - 2 * s.area }
  } else {
    omisiones.push({ que: OMISION_EDIFICIO.SOLAPE, motivo: motivoSinContraste })
    omisiones.push({ que: OMISION_EDIFICIO.DIFERENCIA, motivo: motivoSinContraste })
  }

  // ── Desplazamiento de centroides ──────────────────────────────────────────
  let seccionCentroides = null
  if (!hayOficial || piezas.length === 0) {
    omisiones.push({ que: OMISION_EDIFICIO.CENTROIDES, motivo: motivoSinContraste })
  } else {
    const cMedido = centroideDePiezas(piezas)
    const cOficial = centroideDePiezas(caras)
    if (cMedido === null || cOficial === null) {
      // Distinguirlo de «no hay oficial» importa: son dos causas distintas y la
      // vista dice cosas distintas de cada una.
      omisiones.push({
        que: OMISION_EDIFICIO.CENTROIDES,
        motivo: MOTIVO_CENTROIDE_DEGENERADO,
      })
    } else {
      seccionCentroides = {
        medido: cMedido,
        oficial: cOficial,
        // Euclídea propia (regla de oro 6: `turf.distance` es geodésica esférica
        // sobre grados y aquí las coordenadas son metros UTM).
        distancia: distancia(cMedido, cOficial),
      }
    }
  }

  // ── Cuánto cae dentro de la parcela declarada ─────────────────────────────
  //
  // ⚠️ **No es la misma pregunta que la de `validation/edificio.js`**, y por eso
  // no se reutiliza aquel cálculo ni se duplica éste. Allí se pregunta *qué PARTE
  // concreta se sale*, para poder resaltarla, y la respuesta es un hallazgo por
  // parte; aquí se pregunta *cuánta superficie del EDIFICIO queda fuera*, que es
  // una cifra del conjunto. Dos granularidades, dos capas, dos consumidores.
  let seccionEnParcela = null
  if (parcelaContexto === null || parcelaContexto.length === 0) {
    omisiones.push({ que: OMISION_EDIFICIO.EN_PARCELA, motivo: MOTIVO_SIN_PARCELA })
  } else if (piezas.length === 0) {
    omisiones.push({ que: OMISION_EDIFICIO.EN_PARCELA, motivo: MOTIVO_SIN_HUELLA_PROPIA })
  } else {
    const comun = solapeDeConjuntos(piezas, [parcelaContexto])
    saltados.push(...comun.saltados)
    // ⚠️ `superficieDentro` y no `dentro`, y no es cosmético: el guardián de la
    // regla 9 prohíbe las claves que empiezan por `dentro` —nacieron por
    // `dentroDeMargen`, que sí era un veredicto—. Éstas son SUPERFICIES en m², y
    // el nombre lo dice. Renombrar es más barato que abrirle una excepción al
    // guardián, que es como los guardianes empiezan a no proteger nada.
    seccionEnParcela = {
      superficieDentro: comun.area,
      // Se resta en vez de medirse aparte: `|A| − |A∩P|` es exacto y ahorra una
      // segunda booleana que podría discrepar de la primera por redondeo.
      superficieFuera: areaMedida - comun.area,
      relativo: areaMedida === 0 ? null : comun.area / areaMedida,
    }
  }

  // ── Invasión a colindantes ────────────────────────────────────────────────
  // La ÚNICA sección que no se omite nunca: existe siempre y dice si se consultó.
  // Por eso no lleva entrada en `omisiones` —el estado ya está dentro de ella—:
  // dos sitios afirmando lo mismo es dos sitios que pueden divergir.
  let seccionInvasion = { consultado: false, invasiones: [], descartadas: [] }
  if (vecinas !== null) {
    // Pieza a pieza, y las invasiones de una misma vecina se acumulan: dos cuerpos
    // del edificio que pisan la misma colindante son UNA invasión de esa vecina
    // con la superficie sumada, no dos entradas que el lector tiene que sumar.
    const porVecina = new Map()
    const descartadasPorVecina = new Map()
    for (const pieza of piezas) {
      const inv = invasiones(pieza, vecinas)
      saltados.push(...inv.saltados)
      for (const h of inv.invasiones) {
        const previa = porVecina.get(h.refcat)
        if (previa === undefined) porVecina.set(h.refcat, { ...h, piezas: [...h.piezas] })
        else {
          previa.area += h.area
          previa.piezas.push(...h.piezas)
        }
      }
      for (const d of inv.descartadas) {
        const previa = descartadasPorVecina.get(d.refcat)
        if (previa === undefined) descartadasPorVecina.set(d.refcat, { ...d })
        else {
          previa.area += d.area
          previa.nPiezas += d.nPiezas
          // El grosor que se conserva es el MAYOR de las astillas: es el que
          // decide si el umbral está bien puesto, y quedarse con el último sería
          // quedarse con el que dependa del orden de las piezas.
          previa.grosor = Math.max(previa.grosor, d.grosor)
        }
      }
    }
    seccionInvasion = {
      consultado: true,
      invasiones: [...porVecina.values()],
      descartadas: [...descartadasPorVecina.values()],
    }
  }

  return {
    // ⚠️ `clave` y no `estado`, por lo mismo que `superficieDentro`: el guardián de
    // la regla 9 prohíbe `estado`, y aquí no hay ningún mérito que declarar — es
    // literalmente la clave del vocabulario {@link REGISTRO}.
    registro: { clave: registro, motivo: MOTIVO_REGISTRO[registro] ?? null },
    huella,
    solape: seccionSolape,
    diferencia: seccionDiferencia,
    centroides: seccionCentroides,
    enParcela: seccionEnParcela,
    invasion: seccionInvasion,
    omisiones,
    saltados: deduplicar(saltados),
  }
}

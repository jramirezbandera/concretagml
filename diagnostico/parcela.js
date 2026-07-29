// diagnostico/parcela.js — F07 · EL ORQUESTADOR del diagnóstico de encaje.
//
// Es el único fichero que la spec de F07 nombraba, y su trabajo es **componer, no
// calcular**. Cada cifra sale del módulo que ya la sabe:
//
//   superficie      → `geo/area.js#superficie`        (shoelace sobre UTM, regla 5)
//   perímetros      → `geo/metrica.js#perimetro`      (euclídeo propio, regla 6)
//   centroides      → `geo/centroide.js#centroide`    (ponderado por área)
//   solape/invasión → `diagnostico/topologia.js`      (Turf topológico)
//   desviación      → `diagnostico/desviacion.js`     (máx de mínimos, por lado)
//   tres bandas     → `diagnostico/bandas.js`         (los tres pares cruzados)
//   margen oficial  → `diagnostico/margen.js`         (BOE, enuncia y no compara)
//
// Aquí solo se suma, se resta, se divide y se decide qué es `null`. Una segunda
// implementación de cualquiera de esas cifras sería una SEGUNDA VERDAD, y la que se
// pinta en el diagnóstico no puede discrepar de la que se serializa en el GML.
//
// ── LA FRONTERA DE LA REGLA DE ORO 9 PASA POR EL TIPO DE RETORNO ─────────────
// Si esta función no puede devolver un booleano de mérito, ninguna vista puede
// pintar un semáforo a partir de ella. No hay `ok`, ni `apta`, ni
// `dentroDeMargen`, ni `nivel`, ni `color`; `margen` viaja con su etiqueta
// («margen de identidad del Catastro») y sin comparar nada. La app MIDE y el
// colegiado interpreta y firma. La única excepción que la spec admite —la invasión
// a colindante, hecho topológico binario— sale como área y referencia catastral, y
// es la capa de pintado la que le pone el ámbar.
//
// ── ESTE MÓDULO ES CIEGO A DE DÓNDE VINO EL DATO ────────────────────────────
// Recibe `recintos`, `geometriaOficial`, tres números, una lista de vecinas y una
// clase de suelo. No conoce Leaflet, ni el store, ni la red, ni `ParcelaGml`. Es lo
// que permite que **F08 lo reutilice sin tocar una línea**: allí la geometría
// «oficial» vendrá de un GML que el usuario suelta encima, no del WFS, y a este
// fichero le da igual. Traducir en la frontera es del cableado (T4.3).
//
// ── `null` NO ES 0, Y AQUÍ HAY TRES SABORES DE «NO HAY» ─────────────────────
// La distinción es media razón de ser de F07 y se sostiene con tres formas
// distintas a propósito, porque significan tres cosas distintas:
//
//   1. **Una sección entera a `null` + su entrada en `omisiones`** — no se pudo
//      medir porque falta un término (sin `geometriaOficial` no hay solape ni
//      desviación). `omisiones` dice CUÁL y POR QUÉ, en español, para que la vista
//      no tenga que adivinar si un `null` es «no aplica» o «algo falló».
//   2. **`invasion.consultado: false`** — la sección existe pero nadie preguntó.
//      «No se ha consultado» y «no hay invasión» son afirmaciones opuestas y la
//      segunda tranquiliza; por eso `vecinas: null` (no se consultó) y `vecinas: []`
//      (se consultó y no hay ninguna) NO se representan igual.
//   3. **Un número a `null` dentro de una sección** — el dato concreto no consta
//      (`superficie.registral` mientras el usuario no la teclee).
//
// ── QUÉ NO HACE, Y CONVIENE QUE SIGA SIN HACERLO ────────────────────────────
//   · **No redondea** (regla 11). float64 completo; el redondeo es de salida.
//   · **No ordena** las invasiones por área: ordenar es de quien presenta.
//   · **No filtra la propia parcela** de entre las vecinas. Es del cableado, y
//      `diagnostico/topologia.js` tiene el test que documenta el síntoma del olvido
//      (una invasión del 100 % con la propia referencia catastral al lado).
//   · **No toca `geometriaOficial`** (regla de oro 2). F07 es su PRIMER lector en
//      todo el proyecto —hasta ahora era un campo que se guardaba y no se leía—, así
//      que es la primera fase que puede romper esa regla. Hay test.
//   · **No cachea.** Se llama una vez por operación (un `set` del store), nunca por
//      fotograma: `turf.intersect` en cada `mousemove` sería el fallo de rendimiento
//      evidente de esta fase. Un caché sería estado, y el estado es de quien llama.

import { superficie } from '../geo/area.js'
import { centroide } from '../geo/centroide.js'
import { distancia, perimetro } from '../geo/metrica.js'
import { bandas } from './bandas.js'
import { describir, exigirNumeroONulo, exigirOpciones, exigirRecintos } from './_comun.js'
import { desviacionPorLado } from './desviacion.js'
import { claseDeducidaDe, margen as margenDe } from './margen.js'
import { invasiones, solape } from './topologia.js'

/** @typedef {import('./_comun.js').Recinto} Recinto */
/** @typedef {import('./_comun.js').Vecina} Vecina */

/**
 * Claves de las secciones que pueden quedar sin medir. Es el vocabulario de
 * `omisiones[].que`, y está exportado para que la vista NO escriba `'solape'` a
 * mano: un literal mal escrito en una plantilla no se queja, simplemente no casa.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const OMISION = Object.freeze({
  SOLAPE: 'solape',
  DIFERENCIA: 'diferencia',
  CENTROIDES: 'centroides',
  DESVIACION: 'desviacion',
  MARGEN: 'margen',
})

/**
 * El motivo, en español presentable TAL CUAL, de cada omisión. Se escriben aquí y
 * no en la vista por la regla de oro 1: quien decide que algo no se puede medir es
 * quien sabe por qué, y un código de motivo obligaría a la vista a mantener su
 * propia tabla de traducciones que puede quedarse corta en silencio.
 */
const MOTIVO_SIN_OFICIAL =
  'No hay geometría oficial con la que contrastar: todavía no se ha traído la parcela del Catastro.'

const MOTIVO_CENTROIDE_DEGENERADO =
  'Alguno de los dos contornos no encierra superficie, así que no tiene centroide que desplazar.'

const MOTIVO_SIN_CLASE =
  'No se sabe si la parcela es urbana o rústica, y el margen de identidad es distinto en cada caso: hay que elegirlo.'

/**
 * Clave de deduplicación de un recinto saltado. Ver {@link diagnosticar} para por
 * qué se deduplica.
 */
const claveSaltado = (s) => `${s.donde}|${s.indice}|${s.motivo}`

/**
 * Perímetros de un contorno, o `null` si no hay contorno.
 *
 * `geo/metrica.js#perimetro` devuelve `{0,0,0}` ante una lista vacía, que es la
 * respuesta correcta para él —un conjunto vacío de recintos mide cero— pero la
 * equivocada aquí: un perímetro oficial de 0 m se leería como «el parcelario dice
 * que esta parcela no tiene lindero», cuando lo cierto es que no hay parcelario.
 *
 * @param {Recinto[]|null} recintos
 * @returns {{exterior: number, huecos: number, total: number}|null}
 */
const perimetroONulo = (recintos) => (recintos === null ? null : perimetro(recintos))

/**
 * Diagnóstico de encaje de una parcela contra el parcelario oficial (spec §10).
 *
 * ```js
 * diagnosticar({
 *   recintos,                       // la geometría EDITADA
 *   geometriaOficial,               // la del WFS, intacta (regla de oro 2)
 *   superficieCatastral: 1536,      // cp:areaValue, DECLARADO
 *   superficieRegistral: 1500,      // la que teclea el usuario
 *   vecinas: [{refcat, recintos}],  // null = no se ha consultado
 *   refcat: '9398516VK3799G',       // para proponer la clase de suelo
 * })
 * ```
 *
 * ### Las dos superficies del parcelario, que NO son la misma
 *
 * `superficie.catastral` es lo que el Catastro **DECLARA** (`cp:areaValue`, un
 * entero) y `superficie.oficial` es lo que **NUESTRA fórmula mide** sobre las
 * coordenadas que ese mismo servicio emite. En la parcela real 9398516VK3799G son
 * **1536 y 1535,865149996761**. Esos −0,13 m² no son un error de nadie: son la
 * prueba de que la app mide de verdad en lugar de repetir lo que le dieron, y están
 * anunciados desde `app/main.js` («que las dos cifras no coincidan ES el dato») y
 * desde `gml/parse.js` (que NO recalcula el `areaValue` al leerlo). Van las dos, con
 * nombres distintos, porque confundirlas sería atribuir al Catastro una medición
 * nuestra.
 *
 * La que entra en la tabla a tres bandas es la **declarada**: es la que consta en el
 * expediente y contra la que se rectifica.
 *
 * @param {Object} entrada
 * @param {Recinto[]} entrada.recintos  La geometría EDITADA (la del usuario).
 *   Obligatoria: sin ella no hay nada que diagnosticar.
 * @param {Recinto[]|null} [entrada.geometriaOficial=null]  El contorno oficial
 *   intacto. `null` = no consta (un DXF, un TXT, un contorno dibujado), y entonces
 *   cuatro secciones van a `null` con su motivo en `omisiones`.
 * @param {number|null} [entrada.superficieCatastral=null]  `cp:areaValue`
 *   DECLARADO, m². `null` = no consta.
 * @param {number|null} [entrada.superficieRegistral=null]  La de la escritura, m².
 *   La teclea el usuario; `null` = no consta, que es el estado inicial.
 * @param {Vecina[]|null} [entrada.vecinas=null]  `[{refcat, recintos}]`.
 *   **`null` = NO SE HA CONSULTADO** (→ `invasion.consultado: false`); `[]` = se
 *   consultó y no hay ninguna. Ver el punto 2 de la cabecera.
 * @param {'URBANA'|'RUSTICA'|null} [entrada.clase=null]  Clase de suelo ELEGIDA por
 *   una persona. Manda sobre `refcat` y sale con `deducida: false`.
 * @param {string|null} [entrada.refcat=null]  Referencia catastral normalizada, solo
 *   para **proponer** la clase cuando nadie la ha elegido (`deducida: true`). Si no
 *   hay ninguna de las dos, `margen` es `null` con su omisión: no existe «el margen
 *   por defecto», y elegir uno en silencio sería inventarse media norma.
 * @returns {{
 *   superficie: {medida: number, catastral: number|null, registral: number|null, oficial: number|null},
 *   perimetro: {medido: {exterior: number, huecos: number, total: number},
 *               oficial: {exterior: number, huecos: number, total: number}|null},
 *   bandas: ReturnType<typeof bandas>,
 *   solape: {area: number, relativo: number|null, piezas: Array<Recinto[]>, nPiezas: number}|null,
 *   diferencia: {area: number}|null,
 *   centroides: {medido: [number,number], oficial: [number,number], distancia: number}|null,
 *   desviacion: ReturnType<typeof import('./desviacion.js').desviacionPorLado>|null,
 *   invasion: {consultado: boolean, invasiones: Array<Object>, descartadas: Array<Object>},
 *   margen: {clase: string, deducida: boolean, criterio: string|null, perimetroM: number,
 *            superficieRelativo: number, etiqueta: string}|null,
 *   omisiones: Array<{que: string, motivo: string}>,
 *   saltados: Array<{donde: string, indice: number, nVertices: number, motivo: string}>,
 * }}
 *   **Ni una clave de veredicto** (regla de oro 9), y hay un guardián que lo afirma
 *   recorriendo el objeto real, no una lista escrita a mano.
 * @throws {TypeError} Contrato del programador: `entrada` que no es objeto,
 *   `recintos` que no es array, superficies que no son número finito ni `null`,
 *   `vecinas` mal formadas, `clase` desconocida.
 * @throws {TypeError} (propagado) Si el invariante EXTERIOR/HUECO llega roto: lo
 *   lanzan `geo/area.js` y `geo/metrica.js`, y se deja subir porque es un bug del
 *   programa, no un dato del usuario.
 */
export function diagnosticar(entrada) {
  exigirOpciones(entrada, 'diagnosticar', 'un objeto de entrada {recintos, …}')

  const {
    recintos,
    geometriaOficial = null,
    superficieCatastral = null,
    superficieRegistral = null,
    vecinas = null,
    clase = null,
    refcat = null,
  } = entrada

  exigirRecintos(recintos, 'diagnosticar')
  if (geometriaOficial !== null) {
    exigirRecintos(geometriaOficial, 'diagnosticar', 'geometriaOficial')
  }
  exigirNumeroONulo(superficieCatastral, 'diagnosticar', 'superficieCatastral')
  exigirNumeroONulo(superficieRegistral, 'diagnosticar', 'superficieRegistral')
  if (vecinas !== null && !Array.isArray(vecinas)) {
    throw new TypeError(
      `diagnosticar: 'vecinas' debe ser un array de {refcat, recintos} o null ` +
        `(null = no se ha consultado, [] = se consultó y no hay ninguna); ` +
        `recibido ${describir(vecinas)}.`,
    )
  }

  const omisiones = []
  const saltados = []
  const hayOficial = geometriaOficial !== null

  // ── Las dos medidas que siempre se pueden hacer ────────────────────────────
  const medida = superficie(recintos)
  const oficialMedida = hayOficial ? superficie(geometriaOficial) : null

  // ── Solape y diferencia simétrica ─────────────────────────────────────────
  let seccionSolape = null
  let seccionDiferencia = null
  if (hayOficial) {
    const s = solape(recintos, geometriaOficial)
    saltados.push(...s.saltados)

    // El PORCENTAJE se calcula aquí y no en `topologia.js`, que se negó a hacerlo a
    // propósito: «sobre la mayor de las dos» (spec §10.1) exige saber cuál es la
    // mayor, y eso es una decisión de presentación que un módulo topológico no
    // tiene por qué tomar. Aquí sí se tienen las dos superficies medidas.
    const mayor = Math.max(medida, oficialMedida)
    seccionSolape = {
      area: s.area,
      // `mayor === 0` ⇒ null y no 0 ni NaN: dos contornos sin superficie no solapan
      // «el 0 %», es que la pregunta no tiene respuesta.
      relativo: mayor === 0 ? null : s.area / mayor,
      piezas: s.piezas,
      nPiezas: s.nPiezas,
    }

    // Diferencia simétrica SIN geometría booleana: |A| + |B| − 2·|A∩B|. Es exacta,
    // no una aproximación, y ahorra `@turf/difference` — que no está en
    // `package.json` y habría sido la única dependencia nueva de F07. El DIBUJO de
    // esa misma región tampoco la necesita: el `fillRule:'evenodd'` por defecto de
    // Leaflet rellena la diferencia simétrica de dos anillos en un solo
    // `L.polygon` (verificado en `leaflet-src.js:8159`), y eso es de `viewer/`.
    seccionDiferencia = { area: medida + oficialMedida - 2 * s.area }
  } else {
    omisiones.push({ que: OMISION.SOLAPE, motivo: MOTIVO_SIN_OFICIAL })
    omisiones.push({ que: OMISION.DIFERENCIA, motivo: MOTIVO_SIN_OFICIAL })
  }

  // ── Desplazamiento de centroides ──────────────────────────────────────────
  let seccionCentroides = null
  if (!hayOficial) {
    omisiones.push({ que: OMISION.CENTROIDES, motivo: MOTIVO_SIN_OFICIAL })
  } else {
    const cMedido = centroide(recintos)
    const cOficial = centroide(geometriaOficial)
    if (cMedido === null || cOficial === null) {
      // `centroide` devuelve `null` cuando el contorno no encierra área, y ahí no
      // hay desplazamiento que medir. Distinguirlo de «no hay oficial» importa: son
      // dos causas distintas y la vista dice cosas distintas de cada una.
      omisiones.push({ que: OMISION.CENTROIDES, motivo: MOTIVO_CENTROIDE_DEGENERADO })
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

  // ── Desviación por lindero ────────────────────────────────────────────────
  // `desviacionPorLado` ya devuelve `maxima: null` sin oficial, así que podría
  // llamarse siempre; se corta antes para no recorrer los lados de la parcela
  // sabiendo que ninguna muestra tendrá contra qué medirse, y para que la sección
  // entera sea `null` —una `desviacion` con `porLado: []` se leería como «se midió
  // y no hay desviación», que es la mentira tranquilizadora de siempre.
  let seccionDesviacion = null
  if (hayOficial) {
    seccionDesviacion = desviacionPorLado(recintos, geometriaOficial)
  } else {
    omisiones.push({ que: OMISION.DESVIACION, motivo: MOTIVO_SIN_OFICIAL })
  }

  // ── Invasión a colindantes ────────────────────────────────────────────────
  // La ÚNICA sección que no se omite nunca: existe siempre y dice si se consultó.
  // Por eso no lleva entrada en `omisiones` —el estado ya está dentro de ella—: dos
  // sitios afirmando lo mismo es dos sitios que pueden divergir.
  let seccionInvasion = { consultado: false, invasiones: [], descartadas: [] }
  if (vecinas !== null) {
    const inv = invasiones(recintos, vecinas)
    saltados.push(...inv.saltados)
    seccionInvasion = {
      consultado: true,
      invasiones: inv.invasiones,
      // Las astillas de redondeo en linderos compartidos, con su área y su grosor.
      // Suben hasta aquí porque son la constancia de lo que se descartó (regla 1):
      // sobre la parcela real hay DOS, y con el umbral de área con el que nació esta
      // fase salían como invasión. Ver `config/operativos.js#grosorInvasionMinimoM`.
      descartadas: inv.descartadas,
    }
  }

  // ── Margen oficial de identidad (capa informativa, JAMÁS veredicto) ───────
  const seccionMargen = margenSeccion(clase, refcat, omisiones)

  return {
    superficie: {
      medida,
      catastral: superficieCatastral,
      registral: superficieRegistral,
      oficial: oficialMedida,
    },
    perimetro: {
      medido: perimetro(recintos),
      oficial: perimetroONulo(geometriaOficial),
    },
    // La tabla a tres bandas usa la superficie DECLARADA, no la que medimos sobre la
    // geometría oficial: es la que consta en el expediente y contra la que se
    // rectifica. Las dos están arriba, con nombres distintos, para que nadie las
    // confunda al leer el resultado.
    bandas: bandas({
      medida,
      catastral: superficieCatastral,
      registral: superficieRegistral,
    }),
    solape: seccionSolape,
    diferencia: seccionDiferencia,
    centroides: seccionCentroides,
    desviacion: seccionDesviacion,
    invasion: seccionInvasion,
    margen: seccionMargen,
    omisiones,
    // Deduplicado, y es una decisión: un recinto degenerado lo reporta CADA medición
    // que lo toca (el solape y la invasión de cada vecina), así que sin deduplicar la
    // misma frase saldría cinco veces. Cinco copias de «recintos[1] tiene 2
    // vértices» no son cinco datos, son ruido que esconde el sexto que sí importa.
    saltados: deduplicar(saltados),
  }
}

/**
 * Resuelve la clase de suelo y enuncia su margen, o deja la omisión escrita.
 *
 * El orden de precedencia —clase ELEGIDA > clase deducida > nada— y el
 * `deducida` que los distingue son el contrato con la vista: el `<select>` de la
 * fase 4 tiene que poder rotular «propuesto a partir de la referencia» y dejar de
 * hacerlo en cuanto una persona elige. Que la propuesta y la elección se
 * representen igual sería colar un criterio nuestro como si fuera un dato.
 *
 * @param {string|null} clase   La elegida por una persona, o `null`.
 * @param {string|null} refcat  La referencia, para proponer.
 * @param {Array<{que: string, motivo: string}>} omisiones  Se le empuja la omisión.
 * @returns {Object|null}
 */
function margenSeccion(clase, refcat, omisiones) {
  if (clase !== null) {
    // `margenDe` lanza si la clase no es una de las dos: es contrato del
    // programador (la resuelve la UI antes de llegar aquí) y se deja lanzar.
    return { clase, deducida: false, criterio: null, ...margenDe(clase) }
  }

  const propuesta = claseDeducidaDe(refcat)
  if (propuesta === null) {
    omisiones.push({ que: OMISION.MARGEN, motivo: MOTIVO_SIN_CLASE })
    return null
  }
  return {
    clase: propuesta.clase,
    deducida: true,
    criterio: propuesta.criterio,
    ...margenDe(propuesta.clase),
  }
}

/**
 * Quita los saltados repetidos conservando el primero de cada clase.
 *
 * @param {Array<{donde: string, indice: number, motivo: string}>} lista
 */
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

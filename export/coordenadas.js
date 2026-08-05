// export/coordenadas.js — F10 · T3.1. EL LISTADO DE COORDENADAS, para replanteo.
//
// La tercera salida de esta herramienta, después del GML (F04) y del PDF (F09), y la
// más humilde de las tres: un fichero de texto con los vértices numerados y sus
// coordenadas, que es lo que se lleva al campo quien va a clavar las estacas y lo que
// se pega en la libreta de una estación total o en una hoja de cálculo.
//
// La ficha de la fase lo mete en el «Alcance» —«**TXT** — listado de coordenadas»— y
// se olvida de él en los criterios de aceptación. Entra aquí como **criterio 5**, en
// vez de quedarse en tierra de nadie.
//
// ═══════════════════════════════════════════════════════════════════════════════
// ⛔ ESTE FICHERO NO LO PUEDE VOLVER A LEER NUESTRO PROPIO LECTOR. MEDIDO.
// ═══════════════════════════════════════════════════════════════════════════════
// La aplicación sabe LEER un TXT de coordenadas desde F01 (`parsers/txt.js`), así que
// la pregunta obvia es si lo que se escribe aquí se puede volver a soltar en la
// ventana. **No.** El listado de la parcela real, pasado por `parseTXT` el
// 2026-08-03, devuelve UN anillo de 18 vértices —la parcela tiene 15— y son estos:
//
//     [[3, 8], [9398516, 3799], [1, 439283.23], [2, 439268.76], … , [1, 535.87]]
//
// Cuatro averías distintas, y ninguna es un descuido de este módulo:
//
//   1. **La fecha es un vértice.** `03/08/2026 09:45 (UTC)` empieza por dos números,
//      así que la primera línea de la cabecera ya ensucia: sale `[3, 8]`.
//   2. **La referencia catastral es DOS números.** `9398516VK3799G` tokeniza como
//      `9398516` y `3799`, dos números en una línea, o sea otro vértice. Y no hay
//      manera de esquivarlo: el tokenizador no conoce las líneas de comentario, así
//      que anteponer `#` no cambia nada (comprobado).
//   3. **La columna del número de vértice se lee como la X.** `extraerPares` toma
//      «los DOS primeros números» de cada línea y su propia documentación lo dice:
//      «no interpreta columnas de índice de vértice». Así que el vértice 1 sale como
//      `[1, 439283.23]` — su número y su X, y la Y se pierde entera.
//   4. **El separador de millar parte los números del pie.** `1.535,87 m²` sale como
//      `1` y `535.87`. El decimoctavo vértice.
//
// ⭐ **Y lo que hace que esto se pueda declarar y no haya que arreglarlo**: el
// destrozo NO pasaría en silencio. `geo/huso.js#detectarHuso` devuelve `null` para
// los cuatro pares falsos, y `sanear` además grita `SWAP_XY` en uno y `GRADOS` en
// otro. La red de F01 caza el fichero en la puerta, ruidosamente, que es justo para
// lo que se escribió. Medido, no deducido.
//
// **Por qué el formato no se dobla para que encaje.** Se podría emitir dos columnas
// peladas, sin número de vértice y sin cabecera, y entonces sí volvería a entrar. Y
// sería un fichero peor: un listado de coordenadas sin la referencia catastral y sin
// el sistema de referencia es exactamente el fichero contra el que existe todo
// `geo/huso.js` —números sin huso, que hay que adivinar—, y sin numerar los vértices
// no sirve para replantear, que es para lo que se pide. Entre servir a la persona que
// firma y servir a nuestro propio parser, gana la persona. **Lo que no se hace es
// callarlo**: el fichero lo dice de sí mismo, en su cabecera, con la frase de
// {@link AVISO_NO_REIMPORTABLE}, y hay una prueba que fija la medida de arriba para
// que el día que alguien enseñe al parser a saltarse comentarios se entere aquí.
//
// (Es la misma asimetría que el DXF, y por eso está escrita en los dos sitios: F10
// enseña a esta aplicación a ESCRIBIR dos formatos que todavía no sabe abrir desde la
// interfaz.)
//
// ── LOS NÚMEROS VAN EN ESPAÑOL, Y LAS COORDENADAS SIN MILLARES ──────────────
// Coma decimal, separadores de `es-ES`. El defecto que F09 encontró en el PDF fue el
// contrario —un «129.9624» con punto inglés colado en un documento en castellano—, y
// aquí se leen quince filas seguidas de números.
//
// Las **coordenadas van sin separador de millar** (`439250,35`, no `439.250,35`) y
// las superficies y longitudes sí lo llevan. Es la misma divergencia deliberada, y
// por el mismo motivo, que `report/contraste-texto.js`: en una tabla de vértices un
// punto de millar y una coma decimal comparten columna y se confunden a la primera;
// en el pie, en cambio, las magnitudes se leen mejor agrupadas.
//
// ── POR QUÉ NO SE REUTILIZA `textoDeLongitud` ──────────────────────────────
// El plan pedía reutilizar el formateo de metros de `viewer/acotaciones.js#textoDeLongitud`
// «si sirve, y si no sirve decir por qué». **No sirve**: aquel módulo importa Leaflet
// en su primera línea, y `export/` es puro y sale por el barrel raíz —importarlo
// rompería la suite `node` entera, que no tiene `window`—. Lo que se duplica son tres
// líneas de `Intl.NumberFormat` con los mismos parámetros; lo que se evitaría duplicar
// no es un criterio, es una llamada a la biblioteca estándar. Mismo razonamiento que
// el «CERO IMPORTS» de `report/contraste-texto.js`. Que las dos no diverjan lo vigila
// un test que lee el TEXTO de `viewer/acotaciones.js` —sin importarlo, y por eso puede
// vivir en el proyecto `node`—, igual que el guardián del reloj de F08.
//
// ── LA SUPERFICIE SE MIDE SOBRE LAS COORDENADAS QUE SE IMPRIMEN ────────────
// Y no sobre las del modelo. Es una decisión, y es la misma que ya tomó
// `gml/anillos.js`: allí conviven `superficieModelo` (float64 completo, término de
// comparación) y `superficieRedondeada` (sobre lo que de verdad se escribe), y lo que
// se publica es la segunda. Aquí pesa todavía más, porque **este fichero ES las
// coordenadas**: si el pie dijera un número que no sale de la tabla de arriba, quien
// vuelva a medir sobre las cifras impresas encontraría una discrepancia dentro de un
// mismo documento, que es peor que unos centímetros cuadrados de diferencia con el
// modelo. Lo dice el propio texto, en el pie, con todas las letras.
//
// ⚠️ Con la parcela del WFS **las dos cifras salen idénticas**, y conviene saber por
// qué antes de dar por vacua la decisión: el Catastro publica sus coordenadas ya con
// dos decimales, así que ahí redondear no mueve nada (medido: 1535,865149996761 m²
// por los dos caminos). La diferencia aparece en cuanto la geometría pasa por el
// editor de F06 o por un fichero con más decimales, que es el caso normal de un
// levantamiento. Su prueba usa las dos geometrías por eso.
//
// ── REGLA DE ORO 9, QUE AQUÍ ES FÁCIL DE CUMPLIR Y FÁCIL DE ROMPER ─────────
// «La aplicación mide; el colegiado interpreta y firma.» Este documento no dice si la
// parcela está bien, ni si cierra, ni si la superficie cuadra con nada: enumera
// vértices y suma. Ni «correcto», ni «cumple», ni «✓». Hay un guardián de vocabulario
// sobre la cadena generada, igual que en `report/contraste-texto.js`.
//
// ── EL RELOJ NO SE LEE AQUÍ ────────────────────────────────────────────────
// `fecha` entra por parámetro, como en todo `gml/` y todo `report/`, y por lo mismo:
// un fichero descargado es un snapshot y su prueba tiene que valer igual dentro de un
// año. Se rinde por componentes UTC, no con un formateador dependiente del entorno.

import { superficie } from '../geo/area.js'
import { perimetro } from '../geo/metrica.js'
import { DECIMALES_COORD, redondearAnillo } from '../gml/anillos.js'
import { SEVERIDAD, TIPO_EXPORT, crearDeteccionExport, resumirDetecciones } from './_comun.js'

// ── Medidas del papel ────────────────────────────────────────────────────────

/** Ancho útil de línea. Texto plano en monoespaciada: se alinea con espacios. */
const ANCHO = 72

/** Ancho de la columna de rótulos de la cabecera (incluye los puntos de relleno). */
const ANCHO_ROTULO = 30

/**
 * Terminador de línea. **`\n`, no CRLF**, al contrario que el DXF: aquel es un
 * formato de intercambio que abre un programa que no controlamos y cuyos ejemplares
 * reales son CRLF (medido en T0.2); esto es texto plano, lo abre un bloc de notas y
 * el repo entero —GML incluido— emite `\n`. Sin excepción no hay que declarar nada
 * en `.gitattributes`.
 */
const NL = '\n'

/**
 * Lo que se escribe donde falta un dato. **No es un guion**: un `—` se lee como
 * «cero» o como «nada que reseñar», y aquí significa que el dato no consta. Mismo
 * texto, a propósito, que `report/contraste-texto.js` y que el cajón del diagnóstico.
 */
const NO_CONSTA = 'No consta'

/**
 * La frase con la que el fichero avisa de que no se puede volver a soltar en la
 * aplicación. Se exporta para que la interfaz pueda decir lo mismo junto al botón
 * —sin reescribirlo peor— y para que el test la afirme sin copiarla.
 *
 * @readonly
 */
export const AVISO_NO_REIMPORTABLE =
  'Este listado está pensado para leerlo una persona o para pasarlo a un equipo de ' +
  'campo. NO se puede volver a cargar en esta aplicación: la primera columna es el ' +
  'número de vértice, no una coordenada, y un lector de dos columnas la tomaría por ' +
  'la X. Para volver a abrir el trabajo aquí, usa el fichero de proyecto.'

// ── F18 · Reconocer NUESTRO PROPIO listado cuando vuelve por la puerta ────────
//
// F18 cablea la entrada de `.txt` como medición de la parcela, y con ella abre un
// camino que hasta hoy no existía: **soltar aquí el listado que esta misma
// aplicación acaba de exportar**. Es el gesto más natural del mundo y hay que
// atenderlo, porque el fichero NO es reimportable — lo dice él mismo unas líneas
// más arriba, y la primera columna es el número de vértice.
//
// ⭐ **LO QUE PASA HOY, MEDIDO EL 2026-08-06 y no inferido.** Un listado de 15
// vértices entra por `importar()` y salen **18 pares** —la cifra que F10 dejó
// anotada, reproducida—, pero **la parcela NO se construye**: sale
// `bloqueos: ['HUSO_NO_RESUELTO']` y `construida: false` en las tres variantes
// probadas (con y sin `refcat`/`srs`, y con `huso: 30` forzado). Los pares
// parásitos que el lector recoge de la cabecera y del pie —el «2» de «2
// decimales», la fecha, la columna «Nº»— caen fuera del huso y envenenan la
// comprobación.
//
// ⛔ **Así que el defecto NO es una parcela falsa: es un DIAGNÓSTICO FALSO.** El
// usuario recibe «no se ha podido resolver el huso», que es plausible, es lo que
// dice el catálogo de bloqueos, y **es mentira**: no hay ningún huso que arreglar,
// lo que hay es un fichero que no se puede reabrir. Un error correcto en la forma
// y equivocado en el fondo manda al usuario a perseguir algo que no existe, y eso
// es peor que no decir nada (regla de oro 1).
//
// Y la protección de hoy es **incidental, no diseñada**: descansa en que unos
// números sueltos rompan la comprobación del huso. Nada en la suite la defiende
// y nadie la escribió a propósito. Esto sí.
//
// ── POR QUÉ SE COLAPSAN LOS ESPACIOS, Y NO ES COSMÉTICA ─────────────────────
// El aviso NO viaja literal en el fichero: se emite con `parrafo()`, que lo
// **envuelve a 70 columnas**. Medido: `texto.includes(AVISO_NO_REIMPORTABLE)`
// devuelve **`false`** sobre un listado real. Un detector escrito contra la
// constante «tal cual» habría salido verde en su test —comparándose consigo
// mismo— y no habría reconocido ni uno solo de los ficheros de verdad.
//
// Se compara contra {@link AVISO_NO_REIMPORTABLE} y no contra una copia, que es
// la regla de esta casa: dos redacciones del mismo hecho divergen, y la que se
// queda vieja siempre es la nueva.

/**
 * Cuántos caracteres de cabecera se miran. El aviso vive SIEMPRE en la cabecera,
 * antes de la primera tabla de vértices, y no se recorre el fichero entero porque
 * este detector se ejecuta sobre **todo** lo que se suelta en la aplicación,
 * incluido un DXF de varios MB.
 *
 * ⭐ **2000 sería suficiente, medido**: en el peor caso razonable —expediente de
 * 150 caracteres y 400 vértices— el aviso termina en el offset **1195**. Se toma
 * el doble porque el margen no cuesta nada y la cabecera puede crecer.
 */
const VENTANA_CABECERA = 4000

/** Todo blanco consecutivo —saltos de línea incluidos— pasa a UN espacio. */
const colapsarBlancos = (texto) => texto.replace(/\s+/g, ' ').trim()

/**
 * ¿Este texto es el LISTADO DE COORDENADAS que exporta {@link serializarCoordenadasTxt}?
 *
 * Se reconoce por el aviso que el propio listado lleva impreso, comparado sobre el
 * texto con los blancos colapsados: ver el bloque de arriba para las dos cosas que
 * hay medidas detrás de esa decisión.
 *
 * **No es una heurística de formato** —no cuenta columnas ni busca cabeceras de
 * tabla—: busca una frase que este módulo escribe y que ningún volcado de un CAD
 * va a contener. Un TXT de coordenadas del técnico, un LIST de AutoCAD o un DXF
 * dan `false`.
 *
 * @param {string} texto  El fichero ya decodificado a texto.
 * @returns {boolean} `true` si es un listado de replanteo emitido por esta app.
 */
export function esListadoDeReplanteo(texto) {
  if (typeof texto !== 'string' || texto === '') return false
  return colapsarBlancos(texto.slice(0, VENTANA_CABECERA)).includes(
    colapsarBlancos(AVISO_NO_REIMPORTABLE),
  )
}

// ── Formato de números, en español ───────────────────────────────────────────

const nf = (decimales, agrupar = true) =>
  new Intl.NumberFormat('es-ES', {
    minimumFractionDigits: decimales,
    maximumFractionDigits: decimales,
    useGrouping: agrupar,
  })

/** Superficies y longitudes: 2 decimales, agrupadas. */
const FORMATO_2 = nf(2)
/** Cuentas enteras (número de vértices, de recintos). */
const FORMATO_0 = nf(0)
/** Coordenadas: {@link DECIMALES_COORD} decimales y **sin agrupar**. */
const FORMATO_COORD = nf(DECIMALES_COORD, false)

const esNumero = (v) => typeof v === 'number' && Number.isFinite(v)

const m2 = (v) => (esNumero(v) ? `${FORMATO_2.format(v)} m²` : NO_CONSTA)
const metros = (v) => (esNumero(v) ? `${FORMATO_2.format(v)} m` : NO_CONSTA)
const cuenta = (v) => (esNumero(v) ? FORMATO_0.format(v) : NO_CONSTA)
const coordenada = (v) => (esNumero(v) ? FORMATO_COORD.format(v) : NO_CONSTA)

/** Un string no vacío, o `null`. Evita que un `''` pase por dato. */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null)

/** Rótulo de un recinto: el 0 es el exterior; los huecos se numeran desde 1. */
const rotuloRecinto = (i) => (i === 0 ? 'Contorno exterior' : `Hueco ${i}`)

/**
 * Singular o plural según la cuenta, para no escribir «1 vértice(s)»: un paréntesis
 * de cortesía en un documento con pretensión de constancia se lee como descuido.
 */
const plural = (n, singular, pluralizado) => `${cuenta(n)} ${n === 1 ? singular : pluralizado}`

// ── Composición del papel ────────────────────────────────────────────────────

/** Una regla horizontal de ancho completo. */
const regla = (caracter) => caracter.repeat(ANCHO)

/**
 * Parte un texto en líneas de como mucho `ancho` columnas sin cortar palabras. Una
 * palabra más larga que el ancho se deja sobresalir: partir una referencia catastral
 * por la mitad la vuelve ilegible, y prefiero una línea larga a un dato roto.
 *
 * @param {string} texto
 * @param {number} ancho
 * @returns {string[]}
 */
function envolver(texto, ancho) {
  const palabras = String(texto)
    .split(/\s+/)
    .filter((p) => p !== '')
  if (palabras.length === 0) return ['']
  const lineas = []
  let actual = palabras[0]
  for (let i = 1; i < palabras.length; i++) {
    if (actual.length + 1 + palabras[i].length <= ancho) {
      actual += ` ${palabras[i]}`
    } else {
      lineas.push(actual)
      actual = palabras[i]
    }
  }
  lineas.push(actual)
  return lineas
}

/** Un párrafo con sangría, envuelto al ancho útil. */
const parrafo = (texto, sangria = 2) =>
  envolver(texto, ANCHO - sangria).map((l) => ' '.repeat(sangria) + l)

/** Una línea `Rótulo ......... valor`, con el valor colgado a la altura de su columna. */
function campo(rotulo, valor, sangria = 2) {
  const prefijo = `${' '.repeat(sangria) + rotulo} `.padEnd(sangria + ANCHO_ROTULO, '.')
  const cuelgue = ' '.repeat(prefijo.length + 1)
  return envolver(valor, ANCHO - prefijo.length - 1).map((l, i) =>
    i === 0 ? `${prefijo} ${l}` : cuelgue + l,
  )
}

/**
 * Una tabla alineada con espacios y **sin una sola tubería de Markdown**: este
 * fichero se abre en un bloc de notas, no lo renderiza nadie. Todas las columnas van
 * a la derecha porque las tres son números, y un número se compara por su última
 * cifra.
 *
 * @param {string[]} cabeceras
 * @param {Array<Array<string>>} filas
 * @param {number} sangria
 * @returns {string[]}
 */
function tabla(cabeceras, filas, sangria) {
  const anchos = cabeceras.map((c, i) =>
    Math.max(c.length, ...filas.map((f) => String(f[i] ?? '').length)),
  )
  const componer = (celdas) =>
    (
      ' '.repeat(sangria) + celdas.map((c, i) => String(c ?? '').padStart(anchos[i])).join('   ')
    ).trimEnd()
  const cabecera = componer(cabeceras)
  return [cabecera, ' '.repeat(sangria) + '-'.repeat(cabecera.length - sangria), ...filas.map(componer)]
}

/**
 * Fecha → `dd/mm/aaaa hh:mm (UTC)`, por COMPONENTES UTC.
 *
 * Ni se consulta el reloj ni se usa un formateador dependiente del entorno: el mismo
 * instante tiene que producir el mismo texto en CI y en el equipo de quien firma
 * (mismos componentes que `gml/_comun.js#dateTimeCatastro` y `report/contraste-texto.js`).
 * Lleva el `(UTC)` escrito porque una hora sin zona, en un documento que pretende dejar
 * constancia, no significa nada.
 *
 * @param {Date} fecha
 * @returns {string}
 */
function fechaLarga(fecha) {
  const dos = (n) => String(n).padStart(2, '0')
  return (
    `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()} ` +
    `${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())} (UTC)`
  )
}

// ── Preparación de la geometría ──────────────────────────────────────────────

/**
 * Redondea un anillo a la precisión de salida y quita los vértices que se funden con
 * el anterior al hacerlo, contando cuántos.
 *
 * Es la MISMA operación que `export/dxf.js#prepararAnillo` y está escrita dos veces a
 * propósito: son ocho líneas, y sacarlas a `export/_comun.js` obligaría a las dos
 * salidas a compartir una decisión que no tiene por qué ser la misma para siempre —el
 * DXF cierra la polilínea con `70=1` y aquí el anillo se imprime abierto—. Lo que sí
 * comparten, y no se duplica, es {@link DECIMALES_COORD}.
 *
 * @param {Array<[number, number]>} anillo  Anillo ABIERTO en UTM.
 * @returns {{vertices: Array<[number, number]>, colapsados: number}}
 */
function prepararAnillo(anillo) {
  const redondeado = redondearAnillo(anillo)
  const vertices = []
  let colapsados = 0
  for (const v of redondeado) {
    const anterior = vertices[vertices.length - 1]
    if (anterior && anterior[0] === v[0] && anterior[1] === v[1]) {
      colapsados += 1
      continue
    }
    vertices.push(v)
  }
  while (
    vertices.length > 1 &&
    vertices[0][0] === vertices[vertices.length - 1][0] &&
    vertices[0][1] === vertices[vertices.length - 1][1]
  ) {
    vertices.pop()
    colapsados += 1
  }
  return { vertices, colapsados }
}

/**
 * ¿Es esto una lista de recintos del modelo? Se pide exactamente lo que este módulo
 * usa, y ni un campo más: duck typing, igual que `export/dxf.js`.
 *
 * @param {*} v
 * @returns {boolean}
 */
function esListaDeRecintos(v) {
  return Array.isArray(v) && v.every((r) => r && typeof r === 'object' && Array.isArray(r.vertices))
}

// ── Typedefs ─────────────────────────────────────────────────────────────────

/** @typedef {import('./_comun.js').DeteccionExport} DeteccionExport */

/**
 * @typedef {Object} ResultadoCoordenadas
 * @property {string} texto  El listado completo, con `\n` y sin salto final.
 * @property {DeteccionExport[]} detecciones  Lo que hubo que decidir por el camino.
 * @property {{total: number, porTipo: Record<string, number>, porSeveridad: Record<string, number>}} resumen
 * @property {number} nVertices  Vértices realmente escritos, ya redondeados y sin los
 *   que se fundieron. Es la cifra que la interfaz puede enseñar sin releer el texto.
 */

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * Serializa la geometría de una parcela como listado de coordenadas en texto plano
 * (contrato E del plan de F10, ampliado al medirlo).
 *
 * ```js
 * const { texto, detecciones } = serializarCoordenadasTxt({
 *   recintos: parcela.recintos,
 *   refcat: parcela.refcat,
 *   srs: expediente.srs,
 *   fecha,                  // INYECTADA: la pone el cableado; aquí no se lee el reloj
 * })
 * ```
 *
 * **Devuelve un objeto y no una cadena**, al contrario que el contrato E escrito antes
 * de la fase 0. El motivo es el mismo por el que `serializarParcelaDxf` hizo lo propio
 * en T2.2: `export/_comun.js` declara `COLAPSO_POR_REDONDEO` y `ANILLO_DESCARTADO`
 * como **comunes a las tres salidas**, y un listado que devolviera solo texto sería la
 * única de las tres incapaz de contar lo que notó — dos vértices fundidos al redondear
 * son dos estacas en el mismo sitio, que es justo lo que hay que decirle a quien va a
 * replantear (regla de oro 1). El texto sale en `.texto`.
 *
 * **No lanza por un dato malo del usuario**: un recinto degenerado, una parcela sin
 * geometría, un hueco que se queda sin vértices salen por `detecciones`. El `throw` se
 * reserva al contrato roto por el programador (SPEC §2.1) y a las coordenadas fuera
 * del rango publicable, que las rechaza `gml/anillos.js#redondearCoord` con su motivo.
 *
 * @param {object} opciones
 * @param {Array<{vertices: Array<[number, number]>, tipo?: string}>} [opciones.recintos=[]]
 *   Los recintos del modelo. `recintos[0]` es el EXTERIOR y el resto huecos.
 * @param {string|null} [opciones.refcat=null]  Referencia catastral. `null` es un caso
 *   legítimo (parcela de un DXF, de un TXT o dibujada) y se escribe como tal.
 * @param {string|null} [opciones.srs=null]  Sistema de referencia, p. ej. `EPSG:25830`.
 *   **Se escribe siempre**, y cuando falta se dice: un listado de coordenadas sin huso
 *   es el fichero contra el que existe todo `geo/huso.js`.
 * @param {Date} opciones.fecha  Instante que se estampa en la cabecera. **Obligatorio
 *   y por parámetro**: ver la cabecera del fichero.
 * @param {string|null} [opciones.nombre=null]  Rótulo del expediente, si lo hay.
 * @returns {ResultadoCoordenadas}
 * @throws {TypeError}   `opciones` que no es objeto, recintos con otra forma, `fecha`
 *   que no es una fecha, `refcat`/`srs`/`nombre` que no son texto ni `null`.
 * @throws {RangeError}  `fecha` inválida, o lo que lance `redondearCoord`.
 */
export function serializarCoordenadasTxt(opciones = {}) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `serializarCoordenadasTxt: se esperaba un objeto de opciones; recibido ${JSON.stringify(opciones)}.`,
    )
  }
  const { recintos = [], refcat = null, srs = null, fecha, nombre = null } = opciones

  if (!esListaDeRecintos(recintos)) {
    throw new TypeError(
      `serializarCoordenadasTxt: 'recintos' debe ser un array de recintos del modelo ` +
        `({vertices: [[x,y], …]}); recibido ${JSON.stringify(recintos)}.`,
    )
  }
  for (const [clave, valor] of [
    ['refcat', refcat],
    ['srs', srs],
    ['nombre', nombre],
  ]) {
    if (valor !== null && typeof valor !== 'string') {
      throw new TypeError(
        `serializarCoordenadasTxt: '${clave}' debe ser un texto o null; recibido ${typeof valor}.`,
      )
    }
  }
  if (!(fecha instanceof Date)) {
    throw new TypeError(
      `serializarCoordenadasTxt: 'fecha' debe ser una fecha; recibido ${typeof fecha}. ` +
        'El listado no consulta el reloj: la fecha entra por parámetro.',
    )
  }
  if (!Number.isFinite(fecha.getTime())) {
    throw new RangeError("serializarCoordenadasTxt: 'fecha' es inválida (tiempo no finito).")
  }

  /** @type {DeteccionExport[]} */
  const detecciones = []

  // ── Preparar la geometría ANTES de escribir nada ──────────────────────────
  // Se redondea primero y se mide después, sobre lo redondeado: ver la cabecera.
  const preparados = recintos.map((r, i) => {
    const { vertices, colapsados } = prepararAnillo(r.vertices)
    if (colapsados > 0) {
      detecciones.push(
        crearDeteccionExport(
          TIPO_EXPORT.COLAPSO_POR_REDONDEO,
          `En el ${rotuloRecinto(i).toLowerCase()} se han fundido ${plural(colapsados, 'vértice', 'vértices')} ` +
            `al redondear a ${DECIMALES_COORD} decimales: caían en el mismo punto que el vértice ` +
            'anterior, y dos estacas en el mismo sitio no se pueden replantear. El listado lleva ' +
            `${plural(vertices.length, 'vértice', 'vértices')}.`,
          SEVERIDAD.AVISO,
          { recinto: i, colapsados, vertices: vertices.length },
        ),
      )
    }
    if (vertices.length < 3) {
      detecciones.push(
        crearDeteccionExport(
          TIPO_EXPORT.ANILLO_DESCARTADO,
          `El ${rotuloRecinto(i).toLowerCase()} se queda con ${plural(vertices.length, 'vértice', 'vértices')} ` +
            'y no forma un anillo, así que no aporta superficie ni perímetro. Sus vértices sí se ' +
            'listan: están en el fichero, y decidir qué hacer con ellos es de quien firma.',
          SEVERIDAD.AVISO,
          { recinto: i, vertices: vertices.length },
        ),
      )
    }
    return { indice: i, vertices, tipo: i === 0 ? 'EXTERIOR' : 'HUECO' }
  })

  if (preparados.length === 0) {
    detecciones.push(
      crearDeteccionExport(
        TIPO_EXPORT.CAPA_VACIA,
        'La parcela no tiene geometría, así que el listado sale sin un solo vértice. No es un ' +
          'fallo del fichero: es lo que hay que replantear.',
        SEVERIDAD.AVISO,
        { recintos: 0 },
      ),
    )
  }

  // Las medidas van sobre las coordenadas YA REDONDEADAS —las que se imprimen— y solo
  // sobre los anillos que de verdad lo son: `geo/area.js` y `geo/metrica.js` devuelven
  // 0 para menos de 3 vértices, pero exigen el invariante EXTERIOR/HUECO, así que los
  // degenerados se quedan fuera para no romperlo cuando el exterior es el degenerado.
  const medibles = preparados.filter((p) => p.vertices.length >= 3)
  const hayExterior = medibles.length > 0 && medibles[0].indice === 0
  const paraMedir = hayExterior ? medibles.map((p) => ({ vertices: p.vertices, tipo: p.tipo })) : []
  const superficieNeta = paraMedir.length > 0 ? superficie(paraMedir) : null
  const per = paraMedir.length > 0 ? perimetro(paraMedir) : null

  const nVertices = preparados.reduce((s, p) => s + p.vertices.length, 0)

  // ── Cabecera ──────────────────────────────────────────────────────────────
  const lineas = [
    regla('='),
    'LISTADO DE COORDENADAS DE VÉRTICES',
    regla('='),
    '',
    ...campo('Fecha del listado', fechaLarga(fecha)),
    ...campo('Referencia catastral', textoONulo(refcat) ?? NO_CONSTA),
    ...campo('Sistema de referencia', textoONulo(srs) ?? NO_CONSTA),
  ]
  if (textoONulo(nombre) !== null) lineas.push(...campo('Expediente', nombre))
  lineas.push(
    ...campo('Recintos', plural(preparados.length, 'recinto', 'recintos')),
    ...campo('Vértices', plural(nVertices, 'vértice', 'vértices')),
    '',
    ...parrafo(
      `Coordenadas UTM en metros —Este (X) y Norte (Y)—, con ${cuenta(DECIMALES_COORD)} decimales y ` +
        'coma decimal. Los anillos van ABIERTOS: el último vértice no repite el primero, aunque el ' +
        'lado que los une exista y se mida.',
    ),
    '',
    ...parrafo(AVISO_NO_REIMPORTABLE),
    '',
  )

  // ── Los vértices, recinto a recinto ───────────────────────────────────────
  if (preparados.length === 0) {
    lineas.push(regla('-'), '  No consta la geometría de la parcela.', '')
  }
  for (const p of preparados) {
    lineas.push(
      regla('-'),
      `${rotuloRecinto(p.indice).toUpperCase()} — ${plural(p.vertices.length, 'vértice', 'vértices')}`,
      regla('-'),
      '',
    )
    if (p.vertices.length === 0) {
      lineas.push('  Este recinto no tiene vértices.', '')
      continue
    }
    lineas.push(
      ...tabla(
        ['Nº', 'X (m)', 'Y (m)'],
        p.vertices.map((v, k) => [String(k + 1), coordenada(v[0]), coordenada(v[1])]),
        2,
      ),
      '',
    )
  }

  // ── Pie: las medidas ──────────────────────────────────────────────────────
  lineas.push(
    regla('-'),
    'MEDIDAS',
    regla('-'),
    '',
    ...campo('Superficie', m2(superficieNeta)),
    ...campo('Perímetro exterior', metros(per?.exterior ?? null)),
    ...campo('Perímetro de los huecos', metros(per?.huecos ?? null)),
    ...campo('Longitud total de lindero', metros(per?.total ?? null)),
    '',
    ...parrafo(
      'La superficie es la neta: el contorno exterior menos los huecos. La longitud total, en ' +
        'cambio, los SUMA — un hueco añade lindero, no lo quita.',
    ),
    '',
    ...parrafo(
      'Las cuatro medidas están tomadas sobre las coordenadas de este listado, ya redondeadas, y ' +
        'no sobre las del modelo interno: así, quien vuelva a medir sobre las cifras impresas ' +
        'obtiene lo mismo que pone aquí.',
    ),
    '',
  )

  // ── Lo que hubo que decidir ───────────────────────────────────────────────
  if (detecciones.length > 0) {
    lineas.push(regla('-'), 'AL PREPARAR ESTE LISTADO', regla('-'), '')
    for (const d of detecciones) {
      lineas.push(...parrafo(`[${d.severidad}] ${d.mensaje}`, 2), '')
    }
  }

  lineas.push(
    ...parrafo(
      'Este listado enumera y suma; no dice si la parcela está bien ni si sus medidas encajan con ' +
        'ninguna otra. Esa lectura es de quien firma.',
    ),
    '',
    regla('='),
  )

  return {
    texto: lineas.join(NL),
    detecciones,
    resumen: resumirDetecciones(detecciones),
    nVertices,
  }
}

export default serializarCoordenadasTxt

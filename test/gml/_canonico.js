/* -------------------------------------------------------------------------- *
 * test/gml/_canonico.js — F04 · T4.1 · La forma canónica de un árbol XML        *
 *                                                                               *
 * Lo usa `aceptacion-f04.test.js` para comparar el GML que emitimos contra el   *
 * GML real del Catastro «ignorando espacios» (AC1 de la spec de F04).           *
 *                                                                               *
 * ── POR QUÉ NO ES UN `*.test.js` ────────────────────────────────────────────  *
 * No tiene sufijo `.test.js` a propósito: la guarda de partición de             *
 * `test/contrato.test.js` recorre el repo entero exigiendo que TODO fichero     *
 * `*.test.js` lo ejecute exactamente un proyecto de Vitest, y este módulo no    *
 * es una suite, es una herramienta. Con el sufijo aparecería como un fichero    *
 * de test que no declara ni un `it`.                                            *
 *                                                                               *
 * ── LA REGLA QUE GOBIERNA ESTE FICHERO ──────────────────────────────────────  *
 * NO IMPORTA NADA DE `gml/`. Ni el lector (`gml/xml.js`), ni la tabla de        *
 * namespaces (`gml/_comun.js#NS`), ni una constante. El motivo no es purismo:   *
 * si el lector y el escritor de la casa compartieran un error de concepto —leen *
 * mal y escriben igual de mal—, un round-trip que usara los dos lados saldría   *
 * VERDE. Por eso quien parsea es jsdom (lo hace el llamante) y quien normaliza  *
 * es esto, y esto no sabe nada del proyecto. Es el mismo razonamiento por el    *
 * que `proj4` audita a `geo/utm.js` en `test/geo/utm-control.factory.test.js`.  *
 *                                                                               *
 * Corolario práctico: aquí no hay ni una URI de namespace escrita. Los          *
 * namespaces salen del DOM (`namespaceURI`) y se comparan tal cual; las dos     *
 * normalizaciones que dependen de un nombre —`xsi:schemaLocation` y             *
 * `gml:posList`/`gml:pos`— se activan por NOMBRE LOCAL, que no puede debilitar  *
 * la comparación: el namespace del mismo nodo ya se compara aparte y exacto.    *
 *                                                                               *
 * ── LO ÚNICO QUE SE NORMALIZA, Y POR QUÉ ────────────────────────────────────  *
 * Que la lista quepa en siete filas es el diseño, no una casualidad. Todo lo    *
 * que no esté aquí se compara EXACTO: nombres cualificados, `gml:id`,           *
 * `srsName`, `count`, `srsDimension`, `uom`, `nilReason`, `xsi:nil`,            *
 * `numberMatched`, y el ORDEN de los hijos.                                     *
 *                                                                               *
 *  1. Texto que es solo whitespace → se descarta. El AC1 dice «ignorando        *
 *     espacios»; cubre la indentación irregular del fixture (su `PolygonPatch`  *
 *     y su `exterior` están desalineados) y el espacio suelto que el fixture    *
 *     deja tras `<gml:Point …>`.                                                *
 *  2. Comentarios e instrucciones de proceso → se descartan. El fixture trae    *
 *     los dos comentarios del WFS; nosotros ponemos el nuestro.                 *
 *  3. Orden de los atributos → se ordenan por `ns#local`. XML no define orden   *
 *     de atributos, así que compararlo sería comparar una no-propiedad.         *
 *  4. `xsi:schemaLocation` → los runs de whitespace pasan a un espacio. El      *
 *     fixture lo trae en una línea; la constante de la plantilla puede partirlo *
 *     en dos literales y unirlos con un salto.                                  *
 *  5. `gml:posList` y `gml:pos` → `number[]`, comparados NUMÉRICAMENTE. Es      *
 *     IMPRESCINDIBLE: el fixture es inconsistente consigo mismo y recorta los   *
 *     ceros no significativos — `439283.23`, `4479647.8` y `4479678` conviven   *
 *     en la MISMA lista. Para `xsd:double` los tres son el mismo número que su  *
 *     forma con dos decimales. Sin esta fila el AC1 es literalmente imposible.  *
 *  6. `<x/>` == `<x></x>`. Mismo infoset. Nuestro serializador autocierra       *
 *     `cp:endLifespanVersion` y el fixture no.                                  *
 *  7. La declaración XML no entra: no es parte del árbol. Se compara aparte     *
 *     porque ahí los dos ficheros SÍ difieren y debe verse — el fixture declara *
 *     `ISO-8859-1` y sus bytes son UTF-8 (miente sobre sí mismo); nosotros      *
 *     declaramos UTF-8 y escribimos UTF-8.                                      *
 *                                                                               *
 * Las declaraciones `xmlns:*` NO se descartan. Entran en `atr` como cualquier   *
 * otro atributo, con la clave `{http://www.w3.org/2000/xmlns/}#prefijo` (y      *
 * `#xmlns` la del namespace por defecto): al estar ordenadas y no poder         *
 * repetirse un prefijo en el mismo elemento, compararlas así ES compararlas     *
 * como el conjunto `{prefijo → URI}`, que es exactamente lo que vigilan los     *
 * overrides O3 (raíz en WFS 2.0) y O4 (`Identifier` en base 3.3 sin prefijo).   *
 * -------------------------------------------------------------------------- */

/** `nodeType` de los nodos que este módulo mira. Los demás se descartan. */
const ELEMENTO = 1
const TEXTO = 3
const CDATA = 4

/**
 * Nombres LOCALES cuyo contenido textual es una lista de números y no un texto.
 * Ver la fila 5 de la cabecera. Se comparan como `number[]` porque el fixture y
 * nosotros escribimos el mismo número con distintos caracteres.
 */
const LISTAS_DE_NUMEROS = new Set(['posList', 'pos'])

/**
 * Nombres LOCALES de atributos cuyo whitespace interno no es significativo.
 * `xsi:schemaLocation` es una lista de pares «namespace xsd» separados por
 * whitespace (XMLSchema-instance §2.6.3): un salto de línea y un espacio dicen
 * lo mismo.
 */
const ATRIBUTOS_LISTA = new Set(['schemaLocation'])

/** Compara claves como strings, sin depender del locale (`localeCompare` no). */
const porClave = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)

/** Clave de comparación de un atributo: su namespace y su nombre local. */
const claveAtributo = (atributo) => `${atributo.namespaceURI ?? ''}#${atributo.localName}`

/**
 * Valor canónico de un atributo: exacto, salvo los de tipo lista (fila 4).
 *
 * @param {Attr} atributo
 * @returns {string}
 */
function valorAtributo(atributo) {
  if (!ATRIBUTOS_LISTA.has(atributo.localName)) return atributo.value
  return atributo.value.trim().replace(/\s+/g, ' ')
}

/**
 * Los números de un `posList`/`pos` (fila 5).
 *
 * LANZA ante un token que no es un número finito en vez de dejar pasar un `NaN`:
 * `toEqual` considera IGUALES dos `NaN`, así que dos listas ilegibles y
 * distintas se compararían iguales y el round-trip saldría verde afirmando algo
 * falso. Es justo el fallo silencioso que esta suite existe para impedir.
 *
 * @param {string} crudo  Contenido textual del elemento.
 * @param {string} donde  Nombre local del elemento, para el mensaje.
 * @returns {number[]}
 * @throws {TypeError}
 */
function numerosDe(crudo, donde) {
  const recortado = crudo.trim()
  if (recortado === '') return []
  return recortado.split(/\s+/).map((token) => {
    const n = Number(token)
    if (!Number.isFinite(n)) {
      throw new TypeError(
        `canonico: el <${donde}> contiene el token ${JSON.stringify(token)}, que no es un ` +
          'número finito. No se convierte en NaN a la ligera: `toEqual` da dos NaN por ' +
          'iguales y la comparación pasaría en verde sin comparar nada.',
      )
    }
    return n
  })
}

/**
 * Contenido textual canónico de un elemento: la concatenación de sus nodos de
 * texto y CDATA, con la fila 1 (whitespace puro → nada) y la fila 5 (listas de
 * números) aplicadas.
 *
 * El texto que NO es whitespace puro se conserva EXACTO, sin recortar: en
 * `xsd:string` un `<cp:label> 16</cp:label>` no dice lo mismo que
 * `<cp:label>16</cp:label>`, y esconder esa diferencia sería normalizar de más.
 *
 * @param {Element} nodo
 * @returns {string|number[]}
 */
function textoCanonico(nodo) {
  const crudo = [...nodo.childNodes]
    .filter((n) => n.nodeType === TEXTO || n.nodeType === CDATA)
    .map((n) => n.data)
    .join('')
  if (LISTAS_DE_NUMEROS.has(nodo.localName)) return numerosDe(crudo, nodo.localName)
  return crudo.trim() === '' ? '' : crudo
}

/**
 * Forma canónica de un elemento del DOM y de todo lo que cuelga de él.
 *
 * @param {Element} nodo  Elemento de un documento parseado con jsdom (o con
 *   cualquier DOM: aquí solo se usan `namespaceURI`, `localName`, `attributes`
 *   y `childNodes`).
 * @returns {{ns: string|null, local: string, atr: Array<[string, string]>,
 *   hijos: Array<object>, texto: string|number[]}}
 * @throws {TypeError}  Si no se le pasa un elemento (contrato del programador).
 */
export function canonico(nodo) {
  if (nodo === null || typeof nodo !== 'object' || nodo.nodeType !== ELEMENTO) {
    throw new TypeError(
      `canonico: se esperaba un ELEMENTO del DOM (nodeType ${ELEMENTO}); recibido ` +
        `${nodo === null ? 'null' : `nodeType ${nodo?.nodeType}`}. Pásale el ` +
        '`documentElement`, no el documento.',
    )
  }

  const atr = [...nodo.attributes].map((a) => [claveAtributo(a), valorAtributo(a)])
  atr.sort(porClave)

  return {
    ns: nodo.namespaceURI ?? null,
    local: nodo.localName,
    atr,
    hijos: [...nodo.childNodes].filter((n) => n.nodeType === ELEMENTO).map(canonico),
    texto: textoCanonico(nodo),
  }
}

export default canonico

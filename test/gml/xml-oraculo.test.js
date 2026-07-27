/* -------------------------------------------------------------------------- *
 * test/gml/xml-oraculo.test.js — F04 · T1.1 · ORÁCULO EXTERNO del lector XML   *
 *                                                                              *
 * Esta es la prueba que de verdad sostiene `gml/xml.js`. Un parser XML escrito  *
 * a mano acierta el 95% de los casos y falla el 5% que importa —el atributo sin *
 * prefijo, el default namespace redeclarado a media profundidad, la            *
 * normalización de valores de atributo—, y esos fallos no los ve ningún test    *
 * que el propio autor del parser se invente: los inventaría con el mismo modelo *
 * mental equivocado que le hizo escribir el bug.                                *
 *                                                                              *
 * Así que aquí no se afirma NADA sobre lo que el árbol «debería» contener. Se   *
 * parsean los MISMOS ficheros con DOS motores independientes —`gml/xml.js` y el *
 * `DOMParser` de jsdom— se canonicalizan los dos árboles a la misma estructura  *
 * JS y se exige `toEqual`. Es exactamente el patrón de                          *
 * `test/geo/utm-control.factory.test.js`, que contrasta el motor UTM propio     *
 * contra proj4: un oráculo externo, escrito por otra gente, con otro modelo     *
 * mental, que no comparte ni una línea de código con lo que se está probando.   *
 *                                                                              *
 * El corpus son TODOS los `.gml` de `test/fixtures/gml/`, recorridos con        *
 * `readdirSync` y no enumerados a mano: el día que se añada un GML real nuevo   *
 * (rústica, con islas, otro huso) entra solo en el oráculo. Y son ficheros      *
 * REALES, no inventados: dos generadores distintos (el WFS del Catastro y       *
 * chapulincatastral), dos versiones de INSPIRE (cp 4.0 y cp 3.0), CDATA,        *
 * entidades en valores de atributo, CRLF, encoding declarado que no casa con    *
 * los bytes, y un edificio de 13 partes.                                        *
 *                                                                              *
 * Proyecto Vitest `node`: SIN sufijo `.dom`, y ahí `DOMParser` global NO existe *
 * (Node 22 no lo expone). jsdom se importa como LIBRERÍA (`import { JSDOM }`),  *
 * que sí funciona en `node` — es la razón de que el oráculo sea jsdom-como-     *
 * librería y no el entorno jsdom de Vitest.                                     *
 * -------------------------------------------------------------------------- */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

import { parsearXml, NS_XMLNS, SIN_NAMESPACE } from '../../gml/xml.js'

// `import.meta.dirname`, nunca `new URL(..., import.meta.url)` (convención del
// repo, anotada en la Fase 4 de F03).
const DIR_FIXTURES = join(import.meta.dirname, '..', 'fixtures', 'gml')

/** Los GML reales del repo, DERIVADOS del disco. Cero nombres escritos a mano. */
const FIXTURES = readdirSync(DIR_FIXTURES)
  .filter((f) => f.toLowerCase().endsWith('.gml'))
  .sort()
  .map((nombre) => ({ nombre, texto: readFileSync(join(DIR_FIXTURES, nombre), 'utf8') }))

// El oráculo. `new JSDOM('')` fabrica una ventana de la que se toma la CLASE
// DOMParser; se instancia una sola vez y se reutiliza para todos los ficheros.
const DOMParserJsdom = new JSDOM('').window.DOMParser
const oraculo = new DOMParserJsdom()

// Constantes del DOM usadas por nombre, para que se lea qué es cada nodeType.
const NODO_ELEMENTO = 1
const NODO_TEXTO = 3
const NODO_CDATA = 4

/** URI del `<parsererror>` con el que jsdom señala un documento mal formado. */
const NS_PARSERERROR = 'http://www.mozilla.org/newlayout/xml/parsererror.xml'

/** Orden total y estable de atributos: por namespace y luego por nombre local. */
function compararAtributos(a, b) {
  return a[0] === b[0] ? (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0) : a[0] < b[0] ? -1 : 1
}

/**
 * Forma canónica de un elemento leído por `gml/xml.js`.
 *
 * Se comparan namespace, nombre local, atributos (con su namespace resuelto),
 * texto directo CRUDO —sin recortar: el espacio en blanco es parte de lo que hay
 * que reproducir igual— e hijos-elemento en orden. Los atributos se ORDENAN
 * porque el orden de documento no es información del infoset y jsdom no
 * garantiza conservarlo.
 */
function canonicoPropio(nodo) {
  return {
    ns: nodo.ns,
    local: nodo.local,
    atributos: nodo.atributos.map((a) => [a.ns, a.local, a.valor]).sort(compararAtributos),
    texto: nodo.texto,
    hijos: nodo.hijos.map(canonicoPropio),
  }
}

/**
 * La MISMA forma canónica, calculada desde el DOM de jsdom.
 *
 * Detalles que hacen comparables los dos lados, y que son justo donde se
 * concentran los errores de un parser casero:
 *   · Las declaraciones de namespace (`xmlns`, `xmlns:p`) SÍ son atributos en el
 *     DOM, con `namespaceURI` = NS_XMLNS. `gml/xml.js` no las expone como
 *     atributos (su efecto ya está en el `ns` resuelto), así que aquí se filtran.
 *   · `namespaceURI` es `null` cuando no hay namespace —incluido el caso del
 *     atributo SIN PREFIJO bajo un default namespace, que es LA trampa— y este
 *     módulo lo representa como `''`. `?? SIN_NAMESPACE` traduce lo uno a lo otro
 *     sin tocar el fondo del asunto.
 *   · El texto directo son los hijos de tipo TEXTO y CDATA; se concatenan porque
 *     el DOM puede partirlos en varios nodos donde nosotros llevamos un string.
 */
function canonicoDom(el) {
  const atributos = []
  for (const a of el.attributes) {
    if (a.namespaceURI === NS_XMLNS) continue
    atributos.push([a.namespaceURI ?? SIN_NAMESPACE, a.localName, a.value])
  }
  atributos.sort(compararAtributos)
  let texto = ''
  const hijos = []
  for (const n of el.childNodes) {
    if (n.nodeType === NODO_TEXTO || n.nodeType === NODO_CDATA) texto += n.nodeValue
    else if (n.nodeType === NODO_ELEMENTO) hijos.push(canonicoDom(n))
  }
  return { ns: el.namespaceURI ?? SIN_NAMESPACE, local: el.localName, atributos, texto, hijos }
}

/** ¿Ha detectado jsdom un documento mal formado? */
function jsdomFallo(doc) {
  return doc.documentElement.namespaceURI === NS_PARSERERROR
}

/** Recorre en profundidad un árbol canónico y devuelve todos sus nodos. */
function aplanar(canon, acc = []) {
  acc.push(canon)
  for (const h of canon.hijos) aplanar(h, acc)
  return acc
}

describe('oráculo · el corpus de contraste existe y son GML reales', () => {
  it('hay ficheros .gml en test/fixtures/gml/ (guarda anti-corpus-vacío)', () => {
    // Sin esto, borrar los fixtures dejaría este oráculo entero en verde sin
    // haber parseado nada. No se afirma un número (sería una lista a mano con
    // otro nombre): se afirma que el corpus no está vacío.
    expect(FIXTURES.length, `no hay ningún .gml en ${DIR_FIXTURES}`).toBeGreaterThan(0)
  })

  it('jsdom parsea TODOS los fixtures sin error: sirven como verdad-terreno', () => {
    // Si un fixture fuera inválido, el `toEqual` de más abajo podría pasar
    // comparando dos formas de fallar. Aquí se certifica que el oráculo los
    // considera bien formados ANTES de usarlos para juzgar a nadie.
    const malos = FIXTURES.filter((f) => jsdomFallo(oraculo.parseFromString(f.texto, 'text/xml')))
    expect(malos.map((f) => f.nombre)).toEqual([])
  })
})

describe('oráculo · gml/xml.js contra el DOMParser de jsdom, fixture a fixture', () => {
  for (const { nombre, texto } of FIXTURES) {
    it(`${nombre}: mismo árbol que jsdom (ns, atributos, texto e hijos)`, () => {
      const propio = parsearXml(texto)
      // Un fixture real y bien formado no puede producir ni un error: si sale
      // alguno, el mensaje lo dice con línea y columna, que es justo lo que se
      // necesita para arreglarlo.
      expect(propio.errores, `errores de gml/xml.js al leer ${nombre}`).toEqual([])
      expect(propio.raiz).not.toBeNull()

      const doc = oraculo.parseFromString(texto, 'text/xml')
      expect(jsdomFallo(doc)).toBe(false)

      expect(canonicoPropio(propio.raiz)).toEqual(canonicoDom(doc.documentElement))
    })

    it(`${nombre}: la declaración XML coincide con lo que el fichero dice de sí mismo`, () => {
      // jsdom no expone las pseudo-atributos de la declaración (`xmlDeclaration`
      // no existe en su API), así que aquí el contraste es contra el TEXTO
      // crudo del fichero, que también es una fuente independiente del parser.
      const { declaracion } = parsearXml(texto)
      const cabecera = texto.slice(0, texto.indexOf('?>') + 2)
      expect(declaracion).not.toBeNull()
      expect(cabecera).toContain(`version="${declaracion.version}"`)
      expect(cabecera).toContain(`encoding="${declaracion.encoding}"`)
    })
  }
})

// ── Que el oráculo no sea VACUO ───────────────────────────────────────────────
// Un `toEqual` entre dos árboles pasa trivialmente si los ficheros no contienen
// las construcciones difíciles. Estas medidas se toman sobre el corpus REAL (y
// desde el lado del ORÁCULO o desde el texto crudo, nunca desde `gml/xml.js`)
// para certificar que lo comparado arriba incluye de verdad los casos que
// tumban a un parser casero. Si un día dejan de cumplirse, no se borran: se
// añade el fixture que las recupere.
describe('oráculo · el corpus ejercita de verdad las construcciones difíciles', () => {
  /** Todos los nodos canónicos de todos los fixtures, según JSDOM. */
  const NODOS_ORACULO = FIXTURES.flatMap((f) =>
    aplanar(canonicoDom(oraculo.parseFromString(f.texto, 'text/xml').documentElement)),
  )

  it('algún fixture REDECLARA el namespace por defecto a media profundidad', () => {
    // Es el caso de `<Identifier xmlns="…/base/3.3">` dentro de un documento
    // cuyo default es wfs 2.0: si el ámbito no se apila bien, `localId` y
    // `namespace` acaban en el namespace del padre y el parseo de F04 falla.
    //
    // La medida se toma sobre el ORÁCULO, no sobre el texto: un elemento SIN
    // PREFIJO (`prefix === null`) cuyo namespace no es el del elemento raíz solo
    // puede haber llegado ahí por una redeclaración del default.
    const redeclaran = FIXTURES.filter((f) => {
      const raiz = oraculo.parseFromString(f.texto, 'text/xml').documentElement
      const pila = [raiz]
      while (pila.length > 0) {
        const el = pila.pop()
        if (el !== raiz && el.prefix === null && el.namespaceURI !== raiz.namespaceURI) return true
        for (const h of el.childNodes) if (h.nodeType === NODO_ELEMENTO) pila.push(h)
      }
      return false
    })
    expect(
      redeclaran.map((f) => f.nombre).length,
      'ningún fixture redeclara el xmlns por defecto: el oráculo no prueba el apilado de ámbitos',
    ).toBeGreaterThan(0)
  })

  it('algún fixture lleva atributos SIN PREFIJO bajo un default namespace', () => {
    // La trampa: `srsName`, `count`, `srsDimension`, `uom`, `nilReason`. jsdom
    // les da `namespaceURI === null` aunque el elemento herede un default.
    const sinNs = NODOS_ORACULO.filter((n) =>
      n.atributos.some(([ns]) => ns === SIN_NAMESPACE),
    )
    expect(sinNs.length, 'ningún atributo sin namespace en el corpus').toBeGreaterThan(0)
    // …y que además CONVIVAN con atributos que sí lo tienen (`gml:id`, `xsi:nil`),
    // que es lo que hace discriminante la comparación.
    const conNs = NODOS_ORACULO.filter((n) =>
      n.atributos.some(([ns]) => ns !== SIN_NAMESPACE),
    )
    expect(conNs.length, 'ningún atributo CON namespace en el corpus').toBeGreaterThan(0)
  })

  it('algún fixture lleva CDATA y algún fixture lleva entidades', () => {
    const conCdata = FIXTURES.filter((f) => f.texto.includes('<![CDATA['))
    const conEntidad = FIXTURES.filter((f) => /&[a-zA-Z#][^;]*;/.test(f.texto))
    expect(conCdata.map((f) => f.nombre).length, 'ningún fixture con CDATA').toBeGreaterThan(0)
    expect(
      conEntidad.map((f) => f.nombre).length,
      'ningún fixture con entidades',
    ).toBeGreaterThan(0)
  })

  it('algún fixture lleva comentarios (que NINGUNO de los dos motores cuenta como hijo)', () => {
    const conComentario = FIXTURES.filter((f) => f.texto.includes('<!--'))
    expect(conComentario.length, 'ningún fixture con comentarios').toBeGreaterThan(0)
  })

  it('el corpus tiene profundidad y volumen suficientes para discriminar', () => {
    // Un árbol de tres nodos coincidiría por casualidad. Se mide el total de
    // elementos comparados según el oráculo.
    expect(NODOS_ORACULO.length, 'el corpus tiene muy pocos elementos').toBeGreaterThan(100)
  })
})

// ── Documentos MAL FORMADOS: los dos motores tienen que verlo ─────────────────
// jsdom devuelve un documento cuya raíz es `<parsererror>`; `gml/xml.js`
// devuelve `errores` no vacío y NO lanza. Lo que se contrasta es el veredicto
// (bien formado / mal formado), no el mensaje: cada motor redacta el suyo.
describe('oráculo · XML mal formado detectado por LOS DOS motores', () => {
  const MAL_FORMADOS = [
    ['etiqueta de cierre que no casa', '<a><b></c></a>'],
    ['elemento sin cerrar', '<a><b></a>'],
    ['prefijo no declarado', '<a><p:b/></a>'],
    ['atributo repetido', '<a b="1" b="2"/>'],
    ['entidad desconocida', '<a>&noexiste;</a>'],
    ['valor de atributo sin comillas', '<a b=1/>'],
    ['contenido tras el elemento raíz', '<a/><b/>'],
  ]

  for (const [caso, xml] of MAL_FORMADOS) {
    it(`${caso}: jsdom da <parsererror> y gml/xml.js da errores (sin lanzar)`, () => {
      const doc = oraculo.parseFromString(xml, 'text/xml')
      expect(jsdomFallo(doc), `jsdom aceptó: ${xml}`).toBe(true)
      const propio = parsearXml(xml)
      expect(propio.errores.length, `gml/xml.js aceptó: ${xml}`).toBeGreaterThan(0)
      // Cada error trae localización utilizable: es lo que verá el usuario de F08.
      for (const e of propio.errores) {
        expect(typeof e.mensaje).toBe('string')
        expect(e.mensaje.length).toBeGreaterThan(0)
        expect(e.linea).toBeGreaterThanOrEqual(1)
        expect(e.columna).toBeGreaterThanOrEqual(1)
      }
    })
  }

  it('un fixture REAL al que se le rompe una etiqueta pasa de válido a inválido', () => {
    // Mutación derivada del corpus, no un XML de juguete: se le quita la última
    // «>» al primer fixture y se comprueba que los dos motores cambian de
    // veredicto. Demuestra que el corpus se está leyendo de verdad y que la
    // detección no depende de que el documento sea pequeño.
    const { texto } = FIXTURES[0]
    const roto = texto.slice(0, texto.lastIndexOf('>'))
    expect(jsdomFallo(oraculo.parseFromString(texto, 'text/xml'))).toBe(false)
    expect(jsdomFallo(oraculo.parseFromString(roto, 'text/xml'))).toBe(true)
    expect(parsearXml(texto).errores).toEqual([])
    expect(parsearXml(roto).errores.length).toBeGreaterThan(0)
  })
})

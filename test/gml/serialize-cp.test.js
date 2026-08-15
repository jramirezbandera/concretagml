/* -------------------------------------------------------------------------- *
 * test/gml/serialize-cp.test.js — F04 · T3.2 · El serializador a CP 4.0        *
 *                                                                              *
 * Este es el test de UNIDAD del serializador; el de ida y vuelta (parse →       *
 * serialize contra snapshot) es otra tarea. Lo que aquí se comprueba es lo que  *
 * hace RECHAZAR un GML en la Sede, y por eso ninguna cifra ni ninguna cadena de *
 * las que se afirman está escrita a mano: TODAS se leen de un fichero real      *
 * (regla de oro 8).                                                             *
 *                                                                              *
 * ⚠️ CUÁL fichero real, que es lo que se corrigió el 2026-07-27. Hay DOS, y     *
 * cada uno manda sobre su perfil:                                               *
 *   · `cp_ejemplo_explicativo.gml` — la PLANTILLA OFICIAL del Catastro. Manda   *
 *     sobre `PERFIL.ENTREGA`: raíz, contenedor, schemaLocation y srsName del    *
 *     fichero que se SUBE. Es el perfil por defecto y el que usa la app.        *
 *   · `cp_parcela_9398516VK3799G.gml` — el GML del WFS. Manda sobre los NÚMEROS  *
 *     (posList, count, areaValue, ids) y sobre `PERFIL.WFS`, el sobre de la     *
 *     DESCARGA. La mayor parte de este fichero sigue apoyándose en él, porque   *
 *     el interior del `cp:CadastralParcel` es idéntico en los dos perfiles.     *
 *                                                                              *
 * Hasta esa fecha TODO salía del segundo, incluida la parte del sobre, y por    *
 * eso el fichero que producía la app era rechazado por el IVG con la suite en   *
 * verde. Un test derivado del fichero equivocado no avisa: confirma.            *
 *                                                                              *
 * `UTM_1.gml` entra como CONTRAEJEMPLO de DIALECTO —CP 3.0 de otro generador—   *
 * y aporta el patrón del alta de particular: `label` y                          *
 * `nationalCadastralReference` VACÍOS. Los dos GML de edificio sirven para que  *
 * la comprobación de elementos proscritos no sea vacua: ahí SÍ hay `boundedBy`. *
 *                                                                              *
 * EL XML SE LEE CON jsdom, NO CON `gml/xml.js`. Es deliberado: `gml/xml.js` es  *
 * el escritor de este mismo módulo, y juzgar la salida con el lector de la casa *
 * haría que un error de concepto compartido por los dos pasara desapercibido.   *
 * Por el mismo motivo el signo de la orientación lo dicta                       *
 * `@turf/boolean-clockwise` (devDependency, oráculo externo) y no `geo/area.js`. *
 *                                                                              *
 * Los polígonos SINTÉTICOS (el hueco, el triángulo que colapsa) se DERIVAN del  *
 * anillo real: el hueco es el propio contorno encogido hacia su punto de        *
 * referencia, y el triángulo arranca en el primer vértice del fixture. El       *
 * fixture es un caso feliz —convexo, ya horario, sin huecos, sin colapsos— y    *
 * las trampas que este módulo desactiva no aparecen en él.                      *
 *                                                                              *
 * Proyecto Vitest `node`: cadenas y funciones puras (jsdom se usa como lector   *
 * de XML, no como entorno de la app).                                           *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import booleanClockwise from '@turf/boolean-clockwise'

import {
  DECLARACION_XML,
  NIL_REASON_BEGIN_LIFESPAN,
  NIL_REASON_END_LIFESPAN,
  RE_DATETIME_CATASTRO,
  SRS_DIMENSION,
  UOM_AREA,
  ordenarSegunXsd,
  serializarParcelaCp,
} from '../../gml/serialize-cp.js'
import {
  NS,
  ORDEN_CADASTRAL_PARCEL,
  ELEMENTOS_PROSCRITOS_CP40,
  PERFIL,
  PERFILES,
  SEVERIDAD,
  TIPO_GML,
} from '../../gml/_comun.js'
import { NAMESPACE_INSPIRE_DEFECTO } from '../../gml/ids.js'
import { DECIMALES_COORD } from '../../gml/anillos.js'
import { TIPO_RECINTO } from '../../model/parcela.js'

// ═════════════════════════════════════════════════════════════════════════════
// 0 · Lectura de los fixtures y utilidades de DOM (jsdom, no gml/xml.js)
// ═════════════════════════════════════════════════════════════════════════════

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_FIXTURES = join(RAIZ, 'test', 'fixtures', 'gml')

/**
 * Lee un GML decodificándolo con el encoding que el propio fichero DECLARA: los
 * del WFS declaran ISO-8859-1 (aunque sus bytes sean UTF-8) y leerlos como UTF-8
 * llenaría de U+FFFD los comentarios acentuados del Catastro.
 */
function leerGml(nombre) {
  const bytes = readFileSync(join(DIR_FIXTURES, nombre))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

/** Documento XML a partir de un texto. Falla si jsdom no lo pudo parsear. */
function parsear(texto, que) {
  const doc = new JSDOM(texto, { contentType: 'text/xml' }).window.document
  const error = [...doc.querySelectorAll('*')].find((e) => e.localName === 'parsererror')
  expect(error, `${que}: jsdom no pudo parsear el XML`).toBeUndefined()
  return doc
}

const docFixture = (nombre) => parsear(leerGml(nombre), nombre)

/** Todos los elementos con ese `localName`, sea cual sea su namespace. */
const porNombre = (doc, local) =>
  [...doc.querySelectorAll('*')].filter((e) => e.localName === local)

/** El ÚNICO elemento con ese `localName`. Falla si hay cero o más de uno. */
function unico(doc, local) {
  const encontrados = porNombre(doc, local)
  expect(encontrados, `se esperaba UN solo <${local}>`).toHaveLength(1)
  return encontrados[0]
}

/** Nombres de los atributos de un elemento, EN ORDEN de documento. */
const nombresAtributos = (el) => [...el.attributes].map((a) => a.name)

/** Nombres locales de los hijos-elemento, en orden. */
const hijosDe = (el) => [...el.children].map((c) => c.localName)

/** Los `srsName` del documento, en orden, con el elemento que los lleva. */
const srsNames = (doc) =>
  [...doc.querySelectorAll('*')]
    .filter((e) => e.hasAttribute('srsName'))
    .map((e) => ({ local: e.localName, srsName: e.getAttribute('srsName') }))

/** El `gml:id` del único elemento con ese `localName`. */
const idDe = (doc, local) => unico(doc, local).getAttributeNS(NS.gml, 'id')

/** Pares `[x, y]` de un texto de `posList`/`pos`. */
function pares(texto) {
  const numeros = texto.trim().split(/\s+/)
  expect(numeros.length % 2, `posList con un nº impar de valores: ${numeros.length}`).toBe(0)
  const salida = []
  for (let i = 0; i < numeros.length; i += 2) {
    salida.push([Number(numeros[i]), Number(numeros[i + 1])])
  }
  return salida
}

/** Los tokens sueltos de un `posList` (para juzgar su FORMA, no su valor). */
const tokens = (texto) => texto.trim().split(/\s+/)

const NOMBRE_CP40 = 'cp_parcela_9398516VK3799G.gml'
const NOMBRE_ENTREGA = 'cp_ejemplo_explicativo.gml'
const NOMBRE_UTM1 = 'UTM_1.gml'
const NOMBRE_BU = 'bu_building_9398516VK3799G.gml'

const CP40 = docFixture(NOMBRE_CP40)
/** La plantilla OFICIAL del Catastro: manda sobre el sobre de ENTREGA. */
const PLANTILLA = docFixture(NOMBRE_ENTREGA)
const UTM1 = docFixture(NOMBRE_UTM1)
const BU = docFixture(NOMBRE_BU)

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La verdad-terreno, leída del GML real del Catastro
// ═════════════════════════════════════════════════════════════════════════════

const PARCELA_CP40 = unico(CP40, 'CadastralParcel')

/** `posList` del contorno exterior, ya en pares. Viene CERRADO en el fichero. */
const POSLIST_CP40 = pares(unico(CP40, 'posList').textContent)

/** El anillo ABIERTO que guarda el modelo (regla de oro 4): sin el cierre. */
const ANILLO = POSLIST_CP40.slice(0, -1)

/** `count` declarado en el fixture: son PARES, no números. */
const COUNT_CP40 = Number(unico(CP40, 'posList').getAttribute('count'))

/** Identidad INSPIRE del dato oficial, leída de su propio `inspireId`. */
const REFCAT = unico(CP40, 'localId').textContent.trim()
const NAMESPACE_CATASTRO = unico(CP40, 'namespace').textContent.trim()

/** Los tres literales de tiempo y los dos textos libres del fixture. */
const BEGIN_CP40 = unico(CP40, 'beginLifespanVersion').textContent.trim()
const TIMESTAMP_CP40 = CP40.documentElement.getAttribute('timeStamp')
const LABEL_CP40 = unico(CP40, 'label').textContent
const NCR_CP40 = unico(CP40, 'nationalCadastralReference').textContent

/** `areaValue` y su unidad. */
const AREA_CP40 = Number(unico(CP40, 'areaValue').textContent.trim())
const UOM_CP40 = unico(CP40, 'areaValue').getAttribute('uom')

/** El `srsName` canónico (URI OGC, override O2) y el SRS corto que lo produce. */
const SRSNAME_CP40 = unico(CP40, 'MultiSurface').getAttribute('srsName')
const CODIGO_EPSG = Number(/(\d+)$/.exec(SRSNAME_CP40)[1])
const SRS = `EPSG:${CODIGO_EPSG}`

/** Punto de referencia del fixture. */
const PUNTO_CP40 = pares(unico(CP40, 'pos').textContent)[0]

/** Las dos formas de `srsName` que la salida NO puede contener nunca. */
const SRSNAME_URN = unico(UTM1, 'MultiSurface').getAttribute('srsName')

/** Identidad del alta de un particular (CP 3.0), con su otro namespace. */
const REFCAT_UTM1 = unico(UTM1, 'localId').textContent.trim()
const NAMESPACE_LOCAL = unico(UTM1, 'namespace').textContent.trim()

/** Recintos de entrada equivalentes al fixture (un solo exterior). */
const RECINTOS = [{ vertices: ANILLO, tipo: TIPO_RECINTO.EXTERIOR }]

/**
 * Opciones que reproducen el fixture del WFS. Todo sale del fichero.
 *
 * ⚠️ `perfil: PERFIL.WFS` es EXPLÍCITO y no es un detalle: lo que estas opciones
 * reproducen es la DESCARGA, y el defecto del serializador es la ENTREGA. Antes
 * del 2026-07-27 no había perfiles y estas mismas opciones describían «el»
 * fichero, en singular — que era justo el error de concepto.
 */
const OPCIONES_FIXTURE = Object.freeze({
  recintos: RECINTOS,
  srs: SRS,
  refcat: REFCAT,
  perfil: PERFIL.WFS,
  namespaceInspire: NAMESPACE_CATASTRO,
  beginLifespanVersion: BEGIN_CP40,
  timeStamp: TIMESTAMP_CP40,
  label: LABEL_CP40,
  nationalCadastralReference: NCR_CP40,
  puntoReferencia: PUNTO_CP40,
})

/** Serializa y devuelve `{...resultado, doc}` con la salida ya parseada. */
function serializar(extra = {}) {
  const resultado = serializarParcelaCp({ ...OPCIONES_FIXTURE, ...extra })
  expect(resultado.xml, `no se emitió XML: ${JSON.stringify(resultado.resumen.bloqueos)}`)
    .not.toBeNull()
  return { ...resultado, doc: parsear(resultado.xml, 'salida del serializador') }
}

describe('gml/serialize-cp · la verdad-terreno se ha leído de verdad', () => {
  it('el fixture aporta los datos que este test da por buenos', () => {
    // Guarda anti-vacuidad: si el fixture dejara de traer algo, el resto de este
    // fichero pasaría en verde afirmando `undefined === undefined`.
    expect(POSLIST_CP40.length).toBeGreaterThan(3)
    expect(COUNT_CP40).toBe(POSLIST_CP40.length)
    expect(REFCAT).toMatch(/^\S+$/)
    expect(NAMESPACE_CATASTRO).toMatch(/^\S+$/)
    expect(BEGIN_CP40).toMatch(RE_DATETIME_CATASTRO)
    expect(TIMESTAMP_CP40).toMatch(RE_DATETIME_CATASTRO)
    expect(Number.isInteger(AREA_CP40)).toBe(true)
    expect(SRSNAME_CP40).toMatch(/^https?:\/\//)
    expect(SRSNAME_URN).toMatch(/^urn:/)
    expect(PUNTO_CP40).toHaveLength(2)
  })

  it('el anillo del fixture viene CERRADO y el modelo lo guarda ABIERTO', () => {
    expect(POSLIST_CP40.at(-1)).toEqual(POSLIST_CP40[0])
    expect(ANILLO).toHaveLength(POSLIST_CP40.length - 1)
    expect(ANILLO.at(-1)).not.toEqual(ANILLO[0])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Contra el fixture: raíz, namespaces, orden, srsName, ids, count, área
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · el documento que produce ES el del Catastro', () => {
  const { doc, xml, detecciones, resumen } = serializar()

  it('con el dato oficial no hay nada que contar: cero detecciones', () => {
    expect(detecciones).toEqual([])
    expect(resumen.bloqueos).toEqual([])
    expect(resumen.emitido).toBe(true)
  })

  it('O3 · la raíz es FeatureCollection en WFS 2.0 con <member>, nunca la del 3.0', () => {
    const raizFixture = CP40.documentElement
    const raiz = doc.documentElement

    expect(raiz.localName).toBe(raizFixture.localName)
    expect(raiz.namespaceURI).toBe(raizFixture.namespaceURI)
    // Sin prefijo: el `xmlns` por defecto es el de WFS 2.0.
    expect(raiz.prefix).toBeNull()
    expect(raizFixture.prefix).toBeNull()

    expect(hijosDe(raiz)).toEqual(hijosDe(raizFixture))
    const miembro = unico(doc, 'member')
    expect(miembro.namespaceURI).toBe(unico(CP40, 'member').namespaceURI)

    // Y el CONTRAEJEMPLO: el 3.0 usa otra raíz y otro contenedor. Ninguno de los
    // dos nombres puede aparecer en nuestra salida.
    expect(UTM1.documentElement.prefix).toBe('gml')
    expect(porNombre(UTM1, 'featureMember')).toHaveLength(1)
    expect(porNombre(doc, 'featureMember')).toHaveLength(0)
    expect(xml).not.toContain('featureMember')
    expect(xml).not.toContain('gml:FeatureCollection')
  })

  it('declara los MISMOS namespaces que el fixture y en el mismo orden', () => {
    // Se compara la lista de nombres de atributo de la raíz entera: eso ata a la
    // vez qué se declara (los cinco prefijos + el default + schemaLocation) y en
    // qué orden, que es como está en el fichero real.
    expect(nombresAtributos(doc.documentElement)).toEqual(
      nombresAtributos(CP40.documentElement),
    )
    for (const nombre of nombresAtributos(CP40.documentElement)) {
      expect(doc.documentElement.getAttribute(nombre), nombre).toBe(
        CP40.documentElement.getAttribute(nombre),
      )
    }
  })

  it('numberMatched y numberReturned SÍ se emiten (el XSD de WFS los exige)', () => {
    // La plantilla del dossier los omite; el fichero real los trae. Manda el
    // fichero (regla de oro 8).
    for (const attr of ['numberMatched', 'numberReturned']) {
      expect(CP40.documentElement.getAttribute(attr), `el fixture trae ${attr}`).not.toBeNull()
      expect(doc.documentElement.getAttribute(attr)).toBe(
        CP40.documentElement.getAttribute(attr),
      )
    }
    expect(resumen.numberMatched).toBe(Number(CP40.documentElement.getAttribute('numberMatched')))
    expect(resumen.numberReturned).toBe(
      Number(CP40.documentElement.getAttribute('numberReturned')),
    )
  })

  it('O5 · los ocho hijos de cp:CadastralParcel van en el orden del XSD', () => {
    const orden = hijosDe(unico(doc, 'CadastralParcel'))
    expect(orden).toEqual(hijosDe(PARCELA_CP40))
    // …y ese orden es el que declara `ORDEN_CADASTRAL_PARCEL`, que es lo que la
    // función de colocación usa. Las dos mitades atadas al mismo fichero.
    expect(orden).toEqual([...ORDEN_CADASTRAL_PARCEL])
  })

  it('O2 · los TRES srsName son la URI OGC, repetida e idéntica', () => {
    const nuestros = srsNames(doc)
    expect(nuestros).toEqual(srsNames(CP40))
    expect(nuestros).toHaveLength(3)
    expect(nuestros.map((s) => s.local).sort()).toEqual(['MultiSurface', 'Point', 'Surface'])
    for (const s of nuestros) expect(s.srsName).toBe(SRSNAME_CP40)
    expect(resumen.srsName).toBe(SRSNAME_CP40)
  })

  it('los CUATRO gml:id son los del fichero, carácter a carácter', () => {
    for (const local of ['CadastralParcel', 'MultiSurface', 'Surface', 'Point']) {
      expect(idDe(doc, local), local).toBe(idDe(CP40, local))
    }
    // Incluida la ASIMETRÍA del Catastro: el MultiSurface NO se numera y el
    // Surface SÍ (`.1`). Se comprueba sobre el fichero, no sobre el módulo.
    expect(/\.\d+$/.test(idDe(CP40, 'MultiSurface'))).toBe(false)
    expect(/\.\d+$/.test(idDe(CP40, 'Surface'))).toBe(true)
    expect(/\.\d+$/.test(idDe(doc, 'MultiSurface'))).toBe(false)
    expect(/\.\d+$/.test(idDe(doc, 'Surface'))).toBe(true)
  })

  it('ningún gml:id empieza por dígito (regla de oro 10)', () => {
    for (const el of [...doc.querySelectorAll('*')]) {
      const id = el.getAttributeNS(NS.gml, 'id')
      if (id !== null) expect(/^[A-Za-z_]/.test(id), id).toBe(true)
    }
  })

  it('O6 · areaValue es el entero del fixture, con su uom', () => {
    const nuestro = unico(doc, 'areaValue')
    expect(Number(nuestro.textContent.trim())).toBe(AREA_CP40)
    expect(nuestro.getAttribute('uom')).toBe(UOM_CP40)
    expect(UOM_AREA).toBe(UOM_CP40)
    expect(resumen.areaValue).toBe(AREA_CP40)
  })

  it('O4 · el inspireId lleva Identifier en base 3.3 y SIN prefijo base:', () => {
    const nuestro = unico(doc, 'Identifier')
    const suyo = unico(CP40, 'Identifier')
    expect(nuestro.namespaceURI).toBe(suyo.namespaceURI)
    expect(nuestro.namespaceURI).toBe(NS.base33)
    expect(nuestro.prefix).toBeNull()
    expect(unico(doc, 'localId').textContent).toBe(REFCAT)
    expect(unico(doc, 'namespace').textContent).toBe(NAMESPACE_CATASTRO)

    // CONTRAEJEMPLO: en el 3.0 el Identifier SÍ va prefijado (`base:`), y ese
    // prefijo es uno de los errores de rechazo. No puede salir de aquí.
    expect(unico(UTM1, 'Identifier').prefix).toBe('base')
    expect(xml).not.toContain('base:')
  })

  it('cp:endLifespanVersion va nil, con el nilReason del fichero real', () => {
    const nuestro = unico(doc, 'endLifespanVersion')
    const suyo = unico(CP40, 'endLifespanVersion')
    expect(nombresAtributos(nuestro)).toEqual(nombresAtributos(suyo))
    expect(nuestro.getAttributeNS(NS.xsi, 'nil')).toBe(suyo.getAttributeNS(NS.xsi, 'nil'))
    expect(nuestro.getAttribute('nilReason')).toBe(suyo.getAttribute('nilReason'))
    expect(NIL_REASON_END_LIFESPAN).toBe(suyo.getAttribute('nilReason'))
    expect(nuestro.textContent).toBe('')
  })

  it('el referencePoint aportado se conserva y sale como gml:pos', () => {
    expect(pares(unico(doc, 'pos').textContent)).toEqual([PUNTO_CP40])
    expect(resumen.puntoReferencia.punto).toEqual(PUNTO_CP40)
  })

  it('declara UTF-8, a diferencia del fixture (que declara ISO-8859-1 y miente)', () => {
    const declarado = (t) => /encoding="([^"]+)"/i.exec(t)[1]
    expect(xml.startsWith(DECLARACION_XML)).toBe(true)
    expect(declarado(xml).toLowerCase()).toBe('utf-8')
    // El testigo de por qué NO se copia el prólogo del fixture: sus bytes son
    // UTF-8 y su declaración dice otra cosa.
    expect(declarado(readFileSync(join(DIR_FIXTURES, NOMBRE_CP40), 'latin1')).toLowerCase())
      .not.toBe('utf-8')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · El posList: 2 decimales, cerrado y `count` en PARES
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · gml:posList', () => {
  const { doc } = serializar()
  const posList = unico(doc, 'posList')

  it('reproduce los mismos VÉRTICES que el fixture, en el mismo orden', () => {
    expect(pares(posList.textContent)).toEqual(POSLIST_CP40)
  })

  it('está CERRADO: el primer par se repite al final', () => {
    const p = pares(posList.textContent)
    expect(p.at(-1)).toEqual(p[0])
    // Y el anillo de ENTRADA no lo estaba: el cierre lo pone el serializador
    // (regla de oro 4, el modelo vive abierto).
    expect(ANILLO.at(-1)).not.toEqual(ANILLO[0])
    expect(p).toHaveLength(ANILLO.length + 1)
  })

  it('count es el nº de PARES (no de números): el del fixture', () => {
    const p = pares(posList.textContent)
    expect(Number(posList.getAttribute('count'))).toBe(COUNT_CP40)
    expect(Number(posList.getAttribute('count'))).toBe(p.length)
    // La trampa, escrita: hay el DOBLE de números que de pares.
    expect(tokens(posList.textContent)).toHaveLength(p.length * 2)
    expect(Number(posList.getAttribute('count'))).not.toBe(tokens(posList.textContent).length)
  })

  it('todos los valores llevan exactamente 2 decimales y punto decimal', () => {
    const RE = new RegExp(`^-?\\d+\\.\\d{${DECIMALES_COORD}}$`)
    for (const t of tokens(posList.textContent)) expect(t, t).toMatch(RE)
    expect(posList.textContent).not.toContain(',')
  })

  it('srsDimension es 2 y los ejes NO se invierten: el primer valor es el Este', () => {
    expect(posList.getAttribute('srsDimension')).toBe(
      unico(CP40, 'posList').getAttribute('srsDimension'),
    )
    expect(posList.getAttribute('srsDimension')).toBe(SRS_DIMENSION)
    // El Este ronda 10⁵ y el Norte 10⁶ en la Península: si estuvieran invertidos
    // se vería aquí sin necesidad de reproyectar nada.
    const [este, norte] = pares(posList.textContent)[0]
    expect(este).toBe(ANILLO[0][0])
    expect(norte).toBe(ANILLO[0][1])
    expect(norte).toBeGreaterThan(este)
  })

  it('el gml:pos del referencePoint usa el mismo formato', () => {
    const RE = new RegExp(`^-?\\d+\\.\\d{${DECIMALES_COORD}}$`)
    for (const t of tokens(unico(doc, 'pos').textContent)) expect(t, t).toMatch(RE)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Huecos: gml:interior en el MISMO PolygonPatch, un solo surfaceMember
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Encoge el anillo real hacia su punto de referencia. Sirve como hueco DERIVADO
 * del fixture (el fichero del Catastro no tiene ninguno) y garantiza que cae
 * dentro del contorno sin inventarse coordenadas.
 */
const encoger = (anillo, factor, [cx, cy]) =>
  anillo.map(([x, y]) => [cx + (x - cx) * factor, cy + (y - cy) * factor])

describe('gml/serialize-cp · parcela con hueco', () => {
  const HUECO = encoger(ANILLO, 0.3, PUNTO_CP40)
  const { doc, resumen } = serializar({
    recintos: [
      { vertices: ANILLO, tipo: TIPO_RECINTO.EXTERIOR },
      { vertices: HUECO, tipo: TIPO_RECINTO.HUECO },
    ],
    // El punto de referencia del fixture cae DENTRO del hueco, así que se
    // descarta y se recalcula: es justo el caso que `puntoInterior` cubre.
    puntoReferencia: null,
  })

  it('hay UN solo surfaceMember y UN solo PolygonPatch', () => {
    expect(porNombre(doc, 'surfaceMember')).toHaveLength(1)
    expect(porNombre(doc, 'Surface')).toHaveLength(1)
    expect(porNombre(doc, 'PolygonPatch')).toHaveLength(1)
    // Nunca MultiPolygon con varias caras: es rechazo directo del IVG.
    expect(porNombre(doc, 'MultiPolygon')).toHaveLength(0)
    expect(porNombre(doc, 'Polygon')).toHaveLength(0)
  })

  it('el hueco es gml:interior DEL MISMO PolygonPatch que el exterior', () => {
    const patch = unico(doc, 'PolygonPatch')
    expect(hijosDe(patch)).toEqual(['exterior', 'interior'])
    // Es decir: el `interior` cuelga del mismo patch, no de otra superficie.
    expect(unico(doc, 'interior').parentElement).toBe(patch)
    expect(unico(doc, 'exterior').parentElement).toBe(patch)
  })

  it('cada anillo tiene su LinearRing con su posList cerrado y su count', () => {
    const listas = porNombre(doc, 'posList')
    expect(listas).toHaveLength(2)
    listas.forEach((lista, i) => {
      const p = pares(lista.textContent)
      expect(p.at(-1), `anillo ${i}`).toEqual(p[0])
      expect(Number(lista.getAttribute('count')), `anillo ${i}`).toBe(p.length)
      expect(p, `anillo ${i}`).toHaveLength(resumen.nVertices[i] + 1)
    })
  })

  it('el hueco se orienta ANTIHORARIO y el exterior HORARIO (override O1)', () => {
    // El signo lo dicta `@turf/boolean-clockwise`, oráculo EXTERNO: si lo dictara
    // `geo/area.js` estaríamos comprobando el módulo contra sí mismo.
    const [exterior, interior] = porNombre(doc, 'posList').map((l) => pares(l.textContent))
    expect(booleanClockwise(exterior)).toBe(true)
    expect(booleanClockwise(interior)).toBe(false)
  })

  it('la superficie publicada descuenta el hueco', () => {
    const soloExterior = serializar().resumen.areaValue
    expect(resumen.areaValue).toBeLessThan(soloExterior)
    expect(resumen.nAnillos).toBe(2)
  })

  it('el punto aportado caía en el hueco: se descarta con detección y se recalcula', () => {
    const resultado = serializarParcelaCp({
      ...OPCIONES_FIXTURE,
      recintos: [
        { vertices: ANILLO, tipo: TIPO_RECINTO.EXTERIOR },
        { vertices: HUECO, tipo: TIPO_RECINTO.HUECO },
      ],
      puntoReferencia: PUNTO_CP40,
    })
    expect(resultado.resumen.puntoReferencia.punto).not.toEqual(PUNTO_CP40)
    expect(resultado.detecciones.map((d) => d.tipo)).toContain(
      TIPO_GML.PUNTO_REFERENCIA_RECALCULADO,
    )

    // Y —esto es lo que de verdad importa— el que va ESCRITO en el fichero es el
    // recalculado, no el que aportó el llamante. Comprobarlo solo en el
    // `resumen` dejaría pasar un serializador que informa de una cosa y escribe
    // otra, que es la peor variante posible del error silencioso.
    const emitido = pares(unico(parsear(resultado.xml, 'con hueco'), 'pos').textContent)[0]
    expect(emitido).toEqual(resultado.resumen.puntoReferencia.punto)
    expect(emitido).not.toEqual(PUNTO_CP40)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Override O1: exterior antihorario de entrada → salida horaria
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · orientación (override O1)', () => {
  it('el exterior del FIXTURE ya es horario: el caso feliz no invierte nada', () => {
    expect(booleanClockwise(POSLIST_CP40)).toBe(true)
    const { resumen, detecciones } = serializar()
    expect(resumen.invertidos).toEqual([false])
    expect(detecciones.map((d) => d.tipo)).not.toContain(TIPO_GML.ORIENTACION_NORMALIZADA)
  })

  it('un exterior ANTIHORARIO se normaliza, y se DICE', () => {
    // La entrada es el anillo real recorrido al revés: sigue siendo la misma
    // parcela, con el mismo primer vértice.
    const alReves = [ANILLO[0], ...ANILLO.slice(1).reverse()]
    const { doc, resumen, detecciones } = serializar({
      recintos: [{ vertices: alReves, tipo: TIPO_RECINTO.EXTERIOR }],
    })

    // 1) La entrada era antihoraria (oráculo externo, sobre el anillo cerrado).
    expect(booleanClockwise([...alReves, alReves[0]])).toBe(false)

    // 2) La salida es horaria…
    const emitido = pares(unico(doc, 'posList').textContent)
    expect(booleanClockwise(emitido)).toBe(true)

    // 3) …y coincide con la del fixture: invertir dos veces vuelve al original.
    expect(emitido).toEqual(POSLIST_CP40)

    // 4) El cambio no fue silencioso (regla de oro 1).
    expect(resumen.invertidos).toEqual([true])
    expect(resumen.orientacionOriginal).toEqual([1])
    const normalizacion = detecciones.filter(
      (d) => d.tipo === TIPO_GML.ORIENTACION_NORMALIZADA,
    )
    expect(normalizacion).toHaveLength(1)
    expect(normalizacion[0].severidad).toBe(SEVERIDAD.INFO)

    // 5) Y el área publicada no cambia por darle la vuelta al anillo.
    expect(resumen.areaValue).toBe(AREA_CP40)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · El alta de un particular: sin RC oficial, con label vacío
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · alta de particular (patrón de UTM_1.gml)', () => {
  // La identidad es la del alta real de `UTM_1.gml`; el `nationalCadastralReference`
  // y el `label` van vacíos porque la parcela todavía NO está inscrita.
  const { doc, xml, resumen } = serializar({
    refcat: REFCAT_UTM1,
    namespaceInspire: undefined, // → el de por defecto
    label: undefined,
    nationalCadastralReference: undefined,
  })

  it('el fixture del particular confirma el patrón: los dos campos VACÍOS', () => {
    // Testigo primero: es el fichero real quien dice que esto vale.
    expect(unico(UTM1, 'label').textContent).toBe('')
    expect(unico(UTM1, 'nationalCadastralReference').textContent).toBe('')
    expect(unico(UTM1, 'localId').textContent.trim()).not.toBe('')
  })

  it('emite <cp:label/> y <cp:nationalCadastralReference/> vacíos, y el GML SALE', () => {
    expect(resumen.emitido).toBe(true)
    expect(unico(doc, 'label').textContent).toBe('')
    expect(unico(doc, 'nationalCadastralReference').textContent).toBe('')
    expect(xml).toContain('<cp:label/>')
    expect(xml).toContain('<cp:nationalCadastralReference/>')
    // Vacío NO es ausente: los dos elementos están, que es lo que el XSD exige.
    expect(hijosDe(unico(doc, 'CadastralParcel'))).toEqual([...ORDEN_CADASTRAL_PARCEL])
  })

  it('el namespace por defecto es el del particular, no el del Catastro', () => {
    expect(NAMESPACE_INSPIRE_DEFECTO).toBe(NAMESPACE_LOCAL)
    expect(resumen.namespaceInspire).toBe(NAMESPACE_LOCAL)
    expect(unico(doc, 'namespace').textContent).toBe(NAMESPACE_LOCAL)
    expect(unico(doc, 'localId').textContent).toBe(REFCAT_UTM1)
    // El gml:id de la parcela es el mismo que el del alta real.
    expect(idDe(doc, 'CadastralParcel')).toBe(idDe(UTM1, 'CadastralParcel'))
  })

  it('la identidad NO se copia al campo de inscripción: son cosas distintas', () => {
    // Si `nationalCadastralReference` se rellenara por defecto con `refcat`, el
    // fichero afirmaría que la parcela ya está inscrita. Esta es la comprobación
    // de que no ocurre.
    expect(resumen.localId).toBe(REFCAT_UTM1)
    expect(unico(doc, 'nationalCadastralReference').textContent).not.toBe(REFCAT_UTM1)
  })

  it('sin timeStamp, la raíz no lo lleva (pero sí el resto de sus atributos)', () => {
    const { doc: sinStamp, resumen: r } = serializar({ timeStamp: undefined })
    expect(sinStamp.documentElement.hasAttribute('timeStamp')).toBe(false)
    expect(r.timeStamp).toBeNull()
    expect(nombresAtributos(sinStamp.documentElement)).toEqual(
      nombresAtributos(CP40.documentElement).filter((n) => n !== 'timeStamp'),
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Contrato: lo que rompe el PROGRAMADOR lanza (SPEC §2.1)
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · contrato de las fechas', () => {
  it('sin beginLifespanVersion lanza TypeError: no hay valor por defecto honesto', () => {
    const sinFecha = { ...OPCIONES_FIXTURE }
    delete sinFecha.beginLifespanVersion
    expect(() => serializarParcelaCp(sinFecha)).toThrow(TypeError)
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, beginLifespanVersion: null }))
      .toThrow(TypeError)
  })

  it('con un formato que no es el del Catastro, también lanza', () => {
    // Todas estas son fechas legítimas para `xsd:dateTime` (o casi), y ninguna es
    // la forma que traen los GML del Catastro. Se derivan de la del fixture.
    const malas = [
      BEGIN_CP40.slice(0, 10), // solo la fecha
      `${BEGIN_CP40}Z`, // con zona
      `${BEGIN_CP40}.000`, // con fracción de segundo
      BEGIN_CP40.replace('T', ' '), // con espacio en vez de T
      ` ${BEGIN_CP40}`, // con espacio delante
    ]
    for (const mala of malas) {
      expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, beginLifespanVersion: mala }), mala)
        .toThrow(TypeError)
    }
    // …y la del fixture sí pasa, para que el detector no sea vacuo.
    expect(RE_DATETIME_CATASTRO.test(BEGIN_CP40)).toBe(true)
  })

  it('el timeStamp es opcional pero, si se aporta, se valida igual', () => {
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, timeStamp: `${TIMESTAMP_CP40}Z` }))
      .toThrow(TypeError)
    expect(serializarParcelaCp({ ...OPCIONES_FIXTURE, timeStamp: null }).xml).not.toBeNull()
  })
})

describe('gml/serialize-cp · contrato del resto de opciones', () => {
  it('exige una identidad: sin refcat no se serializa nada', () => {
    const sinRef = { ...OPCIONES_FIXTURE }
    delete sinRef.refcat
    expect(() => serializarParcelaCp(sinRef)).toThrow(TypeError)
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, refcat: '  ' })).toThrow(RangeError)
    // El mensaje señala la salida para el alta sin RC —pasar el `idLocal` del
    // modelo—, que es justo la duda que trae a alguien hasta este error.
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, refcat: '' })).toThrow(/idLocal/)
  })

  it('el localId sale de refcat, NO del campo de inscripción', () => {
    // Si `<localId>` se rellenara con `nationalCadastralReference`, un alta de
    // particular —que lo lleva vacío— perdería su identidad entera.
    const { doc } = serializar({ refcat: REFCAT_UTM1, nationalCadastralReference: '' })
    expect(unico(doc, 'localId').textContent).toBe(REFCAT_UTM1)
    expect(unico(doc, 'localId').textContent).not.toBe('')
  })

  it('rechaza un SRS no soportado (Canarias sigue diferida, override O13)', () => {
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, srs: 'EPSG:32628' }))
      .toThrow(RangeError)
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, srs: SRSNAME_CP40 }))
      .toThrow(RangeError)
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, srs: 25830 })).toThrow(TypeError)
  })

  it('exige texto en label y nationalCadastralReference', () => {
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, label: 16 })).toThrow(TypeError)
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, nationalCadastralReference: null }))
      .toThrow(TypeError)
  })

  it('rechaza un comentario que rompería el XML, en vez de recortarlo', () => {
    for (const malo of ['con -- dentro', 'termina en -', ['bien', 'mal --']]) {
      expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, comentario: malo })).toThrow(
        TypeError,
      )
    }
    const { xml } = serializarParcelaCp({ ...OPCIONES_FIXTURE, comentario: ['uno', 'dos'] })
    expect(xml).toContain('<!--uno-->')
    expect(xml).toContain('<!--dos-->')
    expect(parsear(xml, 'con comentarios').documentElement.localName).toBe('FeatureCollection')
  })

  it('⛔ un carácter de control en refcat o label LANZA: ningún escapado lo salvaría', () => {
    // XML 1.0 §2.2 prohíbe los controles C0 (salvo \t \n \r) INCLUSO como
    // referencia numérica. Antes de la barrera de `gml/xml.js`, estos dos casos
    // producían `xml !== null`, cero detecciones ERROR y un documento MAL
    // FORMADO que jsdom rechaza entero — el fallo mudo que la regla de oro 1
    // prohíbe. Se lanza (estilo `redondearCoord` ante 1e21) en vez de sanear:
    // sanear un `gml:id`/`localId` cambiaría la IDENTIDAD de la parcela.
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, refcat: 'ABC\u000BDEF' })).toThrow(
      RangeError,
    )
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, refcat: 'ABC\u000BDEF' })).toThrow(
      /U\+000B/,
    )
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, label: 'finca\u0001' })).toThrow(
      RangeError,
    )
    // Y el texto normal, acentos incluidos, sigue saliendo como siempre.
    expect(serializarParcelaCp({ ...OPCIONES_FIXTURE, label: 'camino de la peña' }).xml).toContain(
      'camino de la peña',
    )
  })

  it('lanza si no le dan un objeto de opciones', () => {
    for (const malo of [null, 'x', 42, [OPCIONES_FIXTURE]]) {
      expect(() => serializarParcelaCp(malo)).toThrow(TypeError)
    }
  })

  it('exige el invariante del modelo: recintos[0] EXTERIOR y el resto HUECO', () => {
    expect(() => serializarParcelaCp({ ...OPCIONES_FIXTURE, recintos: [] })).toThrow(TypeError)
    expect(() =>
      serializarParcelaCp({
        ...OPCIONES_FIXTURE,
        recintos: [{ vertices: ANILLO, tipo: TIPO_RECINTO.HUECO }],
      }),
    ).toThrow(TypeError)
  })

  it('es puro: dos llamadas iguales producen el MISMO documento', () => {
    const a = serializarParcelaCp(OPCIONES_FIXTURE)
    const b = serializarParcelaCp(OPCIONES_FIXTURE)
    expect(a.xml).toBe(b.xml)
    expect(a.resumen).toEqual(b.resumen)
    // Y no toca la entrada: los recintos originales siguen abiertos e intactos.
    expect(RECINTOS[0].vertices).toEqual(ANILLO)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Un GML que sabemos malo NO sale del módulo
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · bloqueo por detección de severidad ERROR', () => {
  // Triángulo cuyos vértices 1 y 2 están a 5 mm: legales para F02 (que trabaja
  // sin redondear) y el mismo punto tras `toFixed(2)`. Al cerrar quedan 3
  // posiciones, y un `gml:LinearRing` con menos de 4 es rechazo directo. Arranca
  // en el primer vértice del fixture para no inventarse una magnitud UTM.
  const [X0, Y0] = ANILLO[0]
  const TRIANGULO = [
    [X0, Y0],
    [X0 + 10, Y0],
    [X0 + 10.004, Y0 + 0.003],
  ]

  const { xml, detecciones, resumen } = serializarParcelaCp({
    ...OPCIONES_FIXTURE,
    recintos: [{ vertices: TRIANGULO, tipo: TIPO_RECINTO.EXTERIOR }],
    puntoReferencia: null,
  })

  it('no devuelve XML: un fichero que sabemos malo no se entrega', () => {
    expect(xml).toBeNull()
    expect(resumen.emitido).toBe(false)
  })

  it('resumen.bloqueos dice por qué, y no está vacío', () => {
    expect(resumen.bloqueos.length).toBeGreaterThan(0)
    expect(resumen.bloqueos).toContain(TIPO_GML.COLAPSO_POR_REDONDEO)
    // Los bloqueos son EXACTAMENTE los tipos de las detecciones ERROR.
    const conError = [
      ...new Set(
        detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR).map((d) => d.tipo),
      ),
    ]
    expect(resumen.bloqueos).toEqual(conError)
  })

  it('el diagnóstico sigue completo aunque no haya fichero', () => {
    // Bloquear no es callar: el usuario tiene que poder ver qué pasó y con qué
    // vértices (regla de oro 1).
    const colapso = detecciones.find((d) => d.tipo === TIPO_GML.COLAPSO_POR_REDONDEO)
    expect(colapso.severidad).toBe(SEVERIDAD.ERROR)
    expect(colapso.datos.vertices).toEqual([1, 2])
    expect(colapso.datos.posicionesAlCerrar).toBeLessThan(4)
    expect(resumen.detecciones.porSeveridad.ERROR).toBeGreaterThan(0)
    expect(resumen.detecciones.total).toBe(detecciones.length)
  })

  it('el mismo triángulo SIN el colapso sí se emite (el caso no es vacuo)', () => {
    const sano = [
      [X0, Y0],
      [X0 + 10, Y0],
      [X0 + 10, Y0 + 10],
    ]
    const r = serializarParcelaCp({
      ...OPCIONES_FIXTURE,
      recintos: [{ vertices: sano, tipo: TIPO_RECINTO.EXTERIOR }],
      puntoReferencia: null,
    })
    expect(r.xml).not.toBeNull()
    expect(r.resumen.bloqueos).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · ordenarSegunXsd: el orden como invariante, no como convención
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · ordenarSegunXsd', () => {
  /** NodoSalida mínimo (no se usa `elem` para no atar el test a su validación). */
  const nodo = (nombre) => ({ nombre, atributos: [], contenido: null })

  /** Los ocho hijos del fixture, con su prefijo `cp:`, DESORDENADOS a propósito. */
  const DESORDEN = [...ORDEN_CADASTRAL_PARCEL].reverse().map((l) => nodo(`cp:${l}`))

  it('coloca los hijos en el orden del XSD, sea cual sea el de entrada', () => {
    const ordenados = ordenarSegunXsd(DESORDEN, ORDEN_CADASTRAL_PARCEL)
    expect(ordenados.map((n) => n.nombre)).toEqual(
      hijosDe(PARCELA_CP40).map((l) => `cp:${l}`),
    )
    expect(ordenados).toHaveLength(DESORDEN.length)
  })

  it('LANZA ante un nombre que no está en la secuencia', () => {
    // Ese es el punto: sin el throw, un hijo mal nombrado se caería de la salida
    // en silencio y el GML saldría incompleto pero bien formado.
    for (const proscrito of ELEMENTOS_PROSCRITOS_CP40) {
      expect(
        () => ordenarSegunXsd([...DESORDEN, nodo(`gml:${proscrito.local}`)], ORDEN_CADASTRAL_PARCEL),
        proscrito.local,
      ).toThrow(RangeError)
    }
    expect(() => ordenarSegunXsd([nodo('cp:AreaValue')], ORDEN_CADASTRAL_PARCEL))
      .toThrow(RangeError)
    expect(() => ordenarSegunXsd([nodo('areaValue')], ORDEN_CADASTRAL_PARCEL)).not.toThrow()
  })

  it('respeta el nombre LOCAL: el prefijo no cuenta para ordenar', () => {
    const conYSin = ordenarSegunXsd(
      [nodo(`cp:${ORDEN_CADASTRAL_PARCEL.at(-1)}`), nodo(ORDEN_CADASTRAL_PARCEL[0])],
      ORDEN_CADASTRAL_PARCEL,
    )
    expect(conYSin.map((n) => n.nombre)).toEqual([
      ORDEN_CADASTRAL_PARCEL[0],
      `cp:${ORDEN_CADASTRAL_PARCEL.at(-1)}`,
    ])
  })

  it('lanza TypeError si los argumentos no tienen la forma debida', () => {
    expect(() => ordenarSegunXsd(nodo('cp:label'), ORDEN_CADASTRAL_PARCEL)).toThrow(TypeError)
    expect(() => ordenarSegunXsd([], [])).toThrow(TypeError)
    expect(() => ordenarSegunXsd(['cp:label'], ORDEN_CADASTRAL_PARCEL)).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · Lo que NUNCA puede aparecer en la salida
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · elementos y formas proscritos', () => {
  const { xml, doc } = serializar()
  const locales = new Set([...doc.querySelectorAll('*')].map((e) => e.localName))

  it('ninguno de los ELEMENTOS_PROSCRITOS_CP40 aparece en la salida', () => {
    for (const { local } of ELEMENTOS_PROSCRITOS_CP40) {
      expect(locales.has(local), `${local} no debe emitirse`).toBe(false)
      expect(xml, local).not.toContain(`:${local}`)
    }
  })

  it('la comprobación no es vacua: el GML de edificio SÍ trae boundedBy/Envelope', () => {
    // Si `ELEMENTOS_PROSCRITOS_CP40` se vaciara o cambiara de forma, el test de
    // arriba pasaría en verde sin comprobar nada. Este es su testigo.
    const enEdificio = new Set([...BU.querySelectorAll('*')].map((e) => e.localName))
    const vistos = ELEMENTOS_PROSCRITOS_CP40.filter((p) => enEdificio.has(p.local))
    expect(vistos.length).toBeGreaterThan(0)
    // …y tampoco están en el fixture 4.0, que es de donde sale la lista.
    const enCp40 = new Set([...CP40.querySelectorAll('*')].map((e) => e.localName))
    for (const { local } of ELEMENTOS_PROSCRITOS_CP40) expect(enCp40.has(local)).toBe(false)
  })

  it('la URN del srsName no aparece: es la del 3.0 y produce rechazo', () => {
    expect(SRSNAME_URN).toContain('urn:')
    expect(xml).not.toContain(SRSNAME_URN)
    expect(xml).not.toContain('urn:ogc:def:crs')
    expect(xml).not.toContain('urn:x-ogc:def:crs')
  })

  it('la forma CORTA EPSG:nnnnn tampoco aparece', () => {
    expect(SRS).toBe(`EPSG:${CODIGO_EPSG}`)
    expect(xml).not.toContain(SRS)
    // Y sin embargo el código SÍ está, dentro de la URI: la comprobación de
    // arriba distingue la forma, no el número.
    expect(xml).toContain(String(CODIGO_EPSG))
    expect(xml).toContain(SRSNAME_CP40)
  })

  it('no hay una sola declaración de namespace de más ni de menos', () => {
    const declaracionesDe = (documento) =>
      [...documento.querySelectorAll('*')].flatMap((e) =>
        nombresAtributos(e).filter((n) => n === 'xmlns' || n.startsWith('xmlns:')),
      )
    expect(declaracionesDe(doc)).toEqual(declaracionesDe(CP40))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 11 · Guardas del módulo
// ═════════════════════════════════════════════════════════════════════════════

describe('gml/serialize-cp · guardas', () => {
  const FUENTE = readFileSync(join(RAIZ, 'gml', 'serialize-cp.js'), 'utf8')

  it('no lee la marca de tiempo del sistema: el GML es función pura de su entrada', () => {
    // Se comprueba sobre el TEXTO del módulo, así que las llamadas no deben
    // aparecer ni siquiera dentro de un comentario. Sin esto, el test de ida y
    // vuelta (snapshot de un GML entero) no podría afirmar nada.
    const INSTANCIA_FECHA = /\bnew\s+Date\b/
    const RELOJ = /\bDate\s*\.\s*now\b/
    expect(INSTANCIA_FECHA.test(FUENTE), 'instancia una fecha propia').toBe(false)
    expect(RELOJ.test(FUENTE), 'consulta el reloj del sistema').toBe(false)
    // Los detectores no son vacuos.
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date.now()')).toBe(true)
  })

  it('no concatena XML a mano: los elementos salen de elem/render', () => {
    // Lo ÚNICO que este módulo escribe literalmente es el prólogo (declaración y
    // comentarios), que no son elementos. Toda etiqueta construida a mano
    // necesita cerrarse —`</…>` o `/>`—, así que la ausencia de esas dos
    // secuencias en el CÓDIGO (los comentarios sí las usan para explicarse) es la
    // señal de que el árbol lo construye `gml/xml.js` y no una plantilla.
    const codigo = FUENTE.split('\n')
      .filter((l) => !l.trimStart().startsWith('//') && !l.trimStart().startsWith('*'))
      .join('\n')
    expect(codigo).toContain(DECLARACION_XML) // el prólogo sí está…
    expect(/<\//.test(codigo), 'hay una etiqueta de cierre escrita a mano').toBe(false)
    expect(/\/>/.test(codigo), 'hay una etiqueta autocerrada escrita a mano').toBe(false)
    // …y los detectores no son vacuos: sobre la cabecera, que sí las cita, saltan.
    expect(/<\//.test(FUENTE) && /\/>/.test(FUENTE)).toBe(true)
    expect(/from '\.\/xml\.js'/.test(FUENTE)).toBe(true)
  })

  it('la aritmética no vive aquí: el área y la orientación son de gml/anillos.js', () => {
    expect(/from '\.\/anillos\.js'/.test(FUENTE)).toBe(true)
    // Ni shoelace ni orientaciones propias: si apareciera un `Math.abs` sobre un
    // sumatorio, sería una segunda fuente de verdad para la superficie.
    expect(/from '\.\.\/geo\/area\.js'/.test(FUENTE)).toBe(false)
    expect(/booleanClockwise/.test(FUENTE)).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · EL SOBRE DE ENTREGA — derivado de la plantilla OFICIAL del Catastro
//
// Esta sección es la que faltaba, y su ausencia costó un rechazo del IVG. Todo
// lo que afirma sale de `cp_ejemplo_explicativo.gml` leído con jsdom: ni una
// cadena escrita a mano. Cada guardián lleva su MITAD ANTI-VACUIDAD, porque un
// guardián sin prueba de que dispara es una promesa.
// ═════════════════════════════════════════════════════════════════════════════

/** Opciones mínimas de una ENTREGA. El perfil se deja al DEFECTO a propósito. */
const OPCIONES_ENTREGA = Object.freeze({
  recintos: RECINTOS,
  srs: SRS,
  refcat: REFCAT,
  namespaceInspire: NAMESPACE_CATASTRO,
})

/** Serializa una entrega y devuelve `{...resultado, doc}`. */
function entregar(extra = {}) {
  const r = serializarParcelaCp({ ...OPCIONES_ENTREGA, ...extra })
  expect(r.xml, `no se emitió XML: ${JSON.stringify(r.resumen.bloqueos)}`).not.toBeNull()
  return { ...r, doc: parsear(r.xml, 'entrega') }
}

describe('gml/serialize-cp · el DEFECTO es la entrega, no la descarga', () => {
  it('sin `perfil`, sale el sobre que la Sede admite', () => {
    // Si alguien invirtiera el defecto, la app volvería a producir el fichero
    // rechazado sin que ninguna otra prueba de este repo cambiase de color.
    const { doc, resumen } = entregar()
    expect(resumen.perfil).toBe(PERFIL.ENTREGA)
    expect(resumen.subibleALaSede).toBe(true)
    expect(doc.documentElement.namespaceURI).toBe(PLANTILLA.documentElement.namespaceURI)
  })

  it('el perfil WFS se declara NO subible, aunque su XML sea perfectamente válido', () => {
    const r = serializarParcelaCp(OPCIONES_FIXTURE)
    expect(r.xml).not.toBeNull()
    expect(r.resumen.subibleALaSede).toBe(false)
  })

  it('un perfil inventado LANZA, no cae en un defecto silencioso', () => {
    expect(() => serializarParcelaCp({ ...OPCIONES_ENTREGA, perfil: 'CP_5_0' })).toThrow(RangeError)
  })
})

describe('gml/serialize-cp · ENTREGA · la raíz es la de la plantilla oficial', () => {
  const { doc, xml } = entregar()
  const raizNuestra = doc.documentElement
  const raizPlantilla = PLANTILLA.documentElement

  it('mismo namespace, mismo nombre local y mismo prefijo que la plantilla', () => {
    expect(raizNuestra.namespaceURI).toBe(raizPlantilla.namespaceURI)
    expect(raizNuestra.localName).toBe(raizPlantilla.localName)
    expect(raizNuestra.prefix).toBe(raizPlantilla.prefix)
  })

  it('⚠️ NO es la raíz de WFS: ahí murió el fichero del 2026-07-27', () => {
    // Anti-vacuidad por contraste: el otro perfil SÍ la lleva, así que esta
    // afirmación distingue de verdad y no es un «no contiene» trivial.
    expect(raizNuestra.namespaceURI).not.toBe(NS.wfs)
    expect(xml).not.toContain(NS.wfs)
    expect(serializarParcelaCp(OPCIONES_FIXTURE).xml).toContain(NS.wfs)
  })

  it('el contenedor es `gml:featureMember`, como en la plantilla', () => {
    const nuestro = raizNuestra.firstElementChild
    const suyo = raizPlantilla.firstElementChild
    expect(nuestro.namespaceURI).toBe(suyo.namespaceURI)
    expect(nuestro.localName).toBe(suyo.localName)
  })

  it('el `xsi:schemaLocation` cita SOLO cp/4.0, igual que la plantilla', () => {
    const normal = (s) => s.replace(/\s+/g, ' ').trim()
    expect(normal(raizNuestra.getAttributeNS(NS.xsi, 'schemaLocation'))).toBe(
      normal(raizPlantilla.getAttributeNS(NS.xsi, 'schemaLocation')),
    )
    // Y el contraste con el otro perfil, que sí cita el esquema del servicio.
    const wfs = parsear(serializarParcelaCp(OPCIONES_FIXTURE).xml, 'wfs')
    expect(wfs.documentElement.getAttributeNS(NS.xsi, 'schemaLocation')).toContain(NS.wfs)
  })

  it('declara los MISMOS prefijos que la plantilla, y en su mismo orden', () => {
    const prefijos = (el) =>
      [...el.attributes].filter((a) => a.name.startsWith('xmlns:')).map((a) => a.name)
    expect(prefijos(raizNuestra)).toEqual(prefijos(raizPlantilla))
  })

  it('no declara ningún `xmlns` por defecto: la raíz va prefijada', () => {
    expect(raizNuestra.hasAttribute('xmlns')).toBe(false)
    expect(raizPlantilla.hasAttribute('xmlns')).toBe(false)
  })

  it('no lleva timeStamp/numberMatched/numberReturned: no es respuesta de nadie', () => {
    for (const attr of ['timeStamp', 'numberMatched', 'numberReturned']) {
      expect(raizNuestra.hasAttribute(attr), attr).toBe(false)
      expect(raizPlantilla.hasAttribute(attr), attr).toBe(false)
    }
  })

  it('pasar `timeStamp` a una entrega LANZA, en vez de ignorarlo en silencio', () => {
    // Quien lo pasa cree que va a salir en el fichero. Descubrir que no al
    // subirlo a la Sede es el modo de fallo que este módulo persigue.
    expect(() => serializarParcelaCp({ ...OPCIONES_ENTREGA, timeStamp: TIMESTAMP_CP40 })).toThrow(
      TypeError,
    )
  })
})

describe('gml/serialize-cp · ENTREGA · el gml:id de la raíz (xs:ID es único)', () => {
  it('es el namespace INSPIRE, como en la plantilla, y NO el de la parcela', () => {
    const { doc } = entregar()
    const raiz = doc.documentElement
    expect(raiz.getAttributeNS(NS.gml, 'id')).toBe(NAMESPACE_CATASTRO)
    expect(raiz.getAttributeNS(NS.gml, 'id')).toBe(
      PLANTILLA.documentElement.getAttributeNS(NS.gml, 'id'),
    )
    expect(raiz.getAttributeNS(NS.gml, 'id')).not.toBe(idDe(doc, 'CadastralParcel'))
  })

  it('TODOS los gml:id del documento son distintos entre sí', () => {
    // `xs:ID` es único en TODO el documento. Repetirlo invalida el fichero
    // entero, y es exactamente lo que hace `UTM_1.gml` (ver PROCEDENCIA.md):
    // por eso ese fichero no sirve de plantilla por mucho que sea un alta real.
    const { doc } = entregar()
    // `querySelectorAll('*')` YA incluye el elemento raíz: añadirlo aparte lo
    // contaría dos veces y haría fallar esta comprobación por un duplicado que
    // no existe (y, peor, haría pasar la mitad anti-vacuidad de abajo sin que el
    // fichero repitiera nada).
    const idsDe = (documento) =>
      [...documento.querySelectorAll('*')]
        .map((e) => e.getAttributeNS(NS.gml, 'id'))
        .filter((v) => v !== null)

    const ids = idsDe(doc)
    expect(ids.length).toBeGreaterThan(3)
    expect(new Set(ids).size).toBe(ids.length)
    // La mitad anti-vacuidad, sobre el fichero real que SÍ los repite.
    const idsUtm1 = idsDe(UTM1)
    expect(new Set(idsUtm1).size).toBeLessThan(idsUtm1.length)
  })

  it('con namespace vacío la raíz sigue siendo única (y lo dice con ID_SANEADO)', () => {
    const { doc, detecciones } = entregar({ namespaceInspire: '' })
    const raiz = doc.documentElement.getAttributeNS(NS.gml, 'id')
    expect(raiz).not.toBe(idDe(doc, 'CadastralParcel'))
    expect(detecciones.some((d) => d.tipo === TIPO_GML.ID_SANEADO)).toBe(true)
  })
})

describe('gml/serialize-cp · ENTREGA · srsName en URN (corrección de O2)', () => {
  it('los tres srsName son la URN, y son la MISMA cadena que la de la plantilla', () => {
    const { doc } = entregar()
    const deLaPlantilla = srsNames(PLANTILLA)[0].srsName
    const nuestros = srsNames(doc)
    expect(nuestros.length).toBeGreaterThan(1)
    for (const { local, srsName } of nuestros) {
      expect(srsName, local).toBe(deLaPlantilla)
    }
  })

  it('⚠️ NO es la URI de la descarga, y la diferencia está medida', () => {
    const { xml } = entregar()
    expect(xml).not.toContain(SRSNAME_CP40)
    // Anti-vacuidad: el otro perfil sí la emite, luego la afirmación separa.
    expect(serializarParcelaCp(OPCIONES_FIXTURE).xml).toContain(SRSNAME_CP40)
  })
})

describe('gml/serialize-cp · ENTREGA · los hijos son los de la plantilla', () => {
  it('mismo juego de hijos de cp:CadastralParcel, y en el mismo orden', () => {
    const { doc } = entregar()
    expect(hijosDe(unico(doc, 'CadastralParcel'))).toEqual(
      hijosDe(unico(PLANTILLA, 'CadastralParcel')),
    )
  })

  it('sin `endLifespanVersion` ni `referencePoint`: la plantilla no los trae', () => {
    const { doc, resumen } = entregar()
    const locales = hijosDe(unico(doc, 'CadastralParcel'))
    expect(locales).not.toContain('endLifespanVersion')
    expect(locales).not.toContain('referencePoint')
    // …pero el punto SE CALCULA igual y sale en el resumen, que es donde la UI
    // lo necesita. No emitirlo no es lo mismo que no saberlo.
    expect(resumen.puntoReferencia.punto).not.toBeNull()
    expect(resumen.referencePointEmitido).toBe(false)
    // Anti-vacuidad: el perfil WFS sí los emite, así que la ausencia distingue.
    const wfs = parsear(serializarParcelaCp(OPCIONES_FIXTURE).xml, 'wfs')
    expect(hijosDe(unico(wfs, 'CadastralParcel'))).toContain('referencePoint')
    expect(hijosDe(unico(wfs, 'CadastralParcel'))).toContain('endLifespanVersion')
  })

  it('el orden sigue siendo el del XSD, aunque haya menos hijos', () => {
    const { doc } = entregar()
    const locales = hijosDe(unico(doc, 'CadastralParcel'))
    expect(locales).toEqual(ORDEN_CADASTRAL_PARCEL.filter((n) => locales.includes(n)))
  })

  it('el `inspireId` usa prefijo `base:` sobre base 3.3, como la plantilla', () => {
    // ⚠️ Corrección de O4: el prefijo no es información en XML; lo que cuenta es
    // el namespace. La plantilla oficial escribe `base:` y valida contra el XSD.
    const { doc } = entregar()
    const nuestro = unico(doc, 'Identifier')
    const suyo = unico(PLANTILLA, 'Identifier')
    expect(nuestro.namespaceURI).toBe(NS.base33)
    expect(nuestro.prefix).toBe(suyo.prefix)
    for (const local of ['localId', 'namespace']) {
      expect(unico(doc, local).namespaceURI, local).toBe(NS.base33)
      expect(unico(doc, local).prefix, local).toBe(unico(PLANTILLA, local).prefix)
    }
  })
})

describe('gml/serialize-cp · ENTREGA · beginLifespanVersion con xsi:nil', () => {
  it('sin fecha sale con `xsi:nil` y el `nilReason` de la plantilla, LETRA a LETRA', () => {
    const { doc } = entregar()
    const nuestro = unico(doc, 'beginLifespanVersion')
    const suyo = unico(PLANTILLA, 'beginLifespanVersion')
    expect(nuestro.getAttributeNS(NS.xsi, 'nil')).toBe(suyo.getAttributeNS(NS.xsi, 'nil'))
    expect(nuestro.getAttribute('nilReason')).toBe(suyo.getAttribute('nilReason'))
    expect(nuestro.getAttribute('nilReason')).toBe(NIL_REASON_BEGIN_LIFESPAN)
    expect(nuestro.textContent).toBe('')
  })

  it('es OPCIONAL en la entrega, pero OBLIGATORIA en la descarga del WFS', () => {
    // La asimetría es deliberada y dice algo del mundo: el WFS reproduce un dato
    // del Catastro, que sí sabe desde cuándo rige; un alta todavía no lo sabe.
    expect(serializarParcelaCp(OPCIONES_ENTREGA).xml).not.toBeNull()
    const sinFecha = { ...OPCIONES_FIXTURE }
    delete sinFecha.beginLifespanVersion
    expect(() => serializarParcelaCp(sinFecha)).toThrow(TypeError)
  })

  it('si SE aporta una fecha en la entrega, se emite y se sigue validando', () => {
    const { doc } = entregar({ beginLifespanVersion: BEGIN_CP40 })
    const el = unico(doc, 'beginLifespanVersion')
    expect(el.textContent).toBe(BEGIN_CP40)
    expect(el.hasAttributeNS(NS.xsi, 'nil')).toBe(false)
    expect(() =>
      serializarParcelaCp({ ...OPCIONES_ENTREGA, beginLifespanVersion: 'ayer' }),
    ).toThrow(TypeError)
  })

  it('el resumen distingue «con fecha» de «nil», sin obligar a mirar el XML', () => {
    expect(serializarParcelaCp(OPCIONES_ENTREGA).resumen.beginLifespanVersion).toBeNull()
    expect(
      serializarParcelaCp({ ...OPCIONES_ENTREGA, beginLifespanVersion: BEGIN_CP40 }).resumen
        .beginLifespanVersion,
    ).toBe(BEGIN_CP40)
  })
})

describe('gml/serialize-cp · ENTREGA · el interior NO cambia entre perfiles', () => {
  // El fallo del 2026-07-27 fue del SOBRE. Esta sección fija que lo de dentro
  // —la geometría y los números, que es donde vive el riesgo de verdad— es
  // idéntico en los dos, para que nadie «arregle» un perfil tocando el otro.
  const entrega = entregar()
  const wfs = parsear(serializarParcelaCp(OPCIONES_FIXTURE).xml, 'wfs')

  it('el `posList` es el MISMO texto en los dos perfiles', () => {
    expect(unico(entrega.doc, 'posList').textContent).toBe(unico(wfs, 'posList').textContent)
  })

  it('el `areaValue` y su `uom` son los mismos, y los del fixture', () => {
    expect(unico(entrega.doc, 'areaValue').textContent).toBe(String(AREA_CP40))
    expect(unico(entrega.doc, 'areaValue').textContent).toBe(unico(wfs, 'areaValue').textContent)
    expect(unico(entrega.doc, 'areaValue').getAttribute('uom')).toBe(UOM_AREA)
  })

  it('los `gml:id` de parcela, MultiSurface y Surface son los mismos', () => {
    for (const local of ['CadastralParcel', 'MultiSurface', 'Surface']) {
      expect(idDe(entrega.doc, local), local).toBe(idDe(wfs, local))
    }
  })

  it('el `count` del posList es el mismo, y son PARES', () => {
    const c = unico(entrega.doc, 'posList').getAttribute('count')
    expect(Number(c)).toBe(COUNT_CP40)
    expect(Number(c)).toBe(pares(unico(entrega.doc, 'posList').textContent).length)
    expect(unico(entrega.doc, 'posList').getAttribute('srsDimension')).toBe(SRS_DIMENSION)
  })

  it('ninguno de los elementos proscritos aparece en la entrega', () => {
    const locales = new Set([...entrega.doc.querySelectorAll('*')].map((e) => e.localName))
    for (const { local } of ELEMENTOS_PROSCRITOS_CP40) {
      expect(locales.has(local), local).toBe(false)
    }
    // Anti-vacuidad, sobre el GML de edificio, que SÍ los trae.
    const localesBu = new Set([...BU.querySelectorAll('*')].map((e) => e.localName))
    expect(localesBu.has('boundedBy')).toBe(true)
  })
})

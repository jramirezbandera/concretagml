/* -------------------------------------------------------------------------- *
 * test/gml/comun.test.js — F04 · Vocabulario compartido de `gml/`              *
 *                                                                              *
 * `gml/_comun.js` es una pared de constantes, y una constante inventada no se   *
 * nota: el GML sale, valida en local y lo rechaza la Sede. Por eso este fichero *
 * no comprueba «que las constantes valen lo que valen» (sería tautológico):     *
 * ATA CADA UNA a los GML reales de `test/fixtures/gml/`, que son la fuente de   *
 * verdad del proyecto (regla de oro 8). Los ficheros se leen del disco aquí, en *
 * el test, que sí puede tocar `test/`.                                          *
 *                                                                              *
 * Los cuatro fixtures y para qué sirve cada uno:                                *
 *   · `cp_parcela_9398516VK3799G.gml` — CP 4.0 del WFS. De aquí salen NS,       *
 *     SCHEMA_LOCATION, ORDEN_CADASTRAL_PARCEL y el srsName canónico.            *
 *   · `UTM_1.gml` — CP 3.0 de otro generador: el CONTRAEJEMPLO (raíz            *
 *     `gml:FeatureCollection`, srsName en URN, `base:` en el inspireId).        *
 *   · `bu_building_*.gml` / `bu_buildingpart_*.gml` — edificio: tercer dialecto *
 *     y única prueba de que la lista de elementos proscritos no es vacua.       *
 *                                                                              *
 * El XML se parsea con jsdom (ya es devDependency) y NO con `gml/xml.js`: ese   *
 * módulo se está escribiendo en paralelo, y además un test que se apoyara en el *
 * parser del propio módulo dejaría de ser una comprobación independiente.       *
 *                                                                              *
 * Proyecto Vitest `node`: constantes y funciones puras, sin DOM de aplicación.  *
 * -------------------------------------------------------------------------- */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

import {
  NS,
  SCHEMA_LOCATION,
  ORDEN_CADASTRAL_PARCEL,
  ELEMENTOS_PROSCRITOS_CP40,
  DIALECTO,
  DIALECTOS,
  DIALECTO_DESCONOCIDO,
  clasificarDialecto,
  SEVERIDAD,
  TIPO_GML,
  crearDeteccionGml,
  SRS_SOPORTADOS,
  PREFIJO_SRSNAME_URI,
  FORMA_SRSNAME,
  srsNameUri,
  srsCorto,
  normalizarSrsName,
  dateTimeCatastro,
} from '../../gml/_comun.js'
import {
  SEVERIDAD as SEVERIDAD_PARSERS,
  TIPO_DETECCION,
  crearDeteccion,
} from '../../parsers/_comun.js'
import { SRS_VALIDOS } from '../../model/parcela.js'

// ── Lectura de los fixtures ──────────────────────────────────────────────────
// `import.meta.dirname`, no `new URL(..., import.meta.url)` (convención del repo).

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_FIXTURES = join(RAIZ, 'test', 'fixtures', 'gml')

/**
 * Lee un GML decodificándolo con el encoding que el propio fichero DECLARA. No
 * es adorno: los GML del WFS vienen en ISO-8859-1 (por eso `gml/_comun.js` tiene
 * un `TIPO_GML.ENCODING_DECLARADO`), y leerlos como UTF-8 llenaría de U+FFFD los
 * comentarios acentuados del Catastro.
 */
function leerGml(nombre) {
  const bytes = readFileSync(join(DIR_FIXTURES, nombre))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  const encoding = m ? m[1] : 'utf-8'
  return { encoding, texto: new TextDecoder(encoding).decode(bytes) }
}

/** Datos estructurales de un fixture: raíz, contenedor de miembros y feature. */
function analizar(nombre) {
  const { encoding, texto } = leerGml(nombre)
  const doc = new JSDOM(texto, { contentType: 'text/xml' }).window.document
  const raiz = doc.documentElement
  const contenedor = raiz.firstElementChild
  const feature = contenedor?.firstElementChild ?? null
  return { nombre, encoding, texto, doc, raiz, contenedor, feature }
}

/** Todos los elementos del documento (para buscar por `localName`). */
const todos = (a) => [...a.doc.querySelectorAll('*')]

/** El dialecto que `gml/_comun.js` asigna a un fixture ya analizado. */
const dialectoDe = (a) =>
  clasificarDialecto({
    ns: a.raiz.namespaceURI,
    local: a.raiz.localName,
    featureNs: a.feature?.namespaceURI ?? null,
  })

// Verdad-terreno: lo que HAY en el disco, recorrido con readdirSync. Nada de
// enumerar los ficheros a mano: si mañana entra un fixture nuevo (rústica, con
// islas — el feature F04 los pide), estas comprobaciones lo incluyen solas.
const FIXTURES = readdirSync(DIR_FIXTURES)
  .filter((n) => n.toLowerCase().endsWith('.gml'))
  .sort()
const ANALISIS = FIXTURES.map(analizar)

// Los dos ficheros que se nombran a propósito, porque cada uno encarna una
// afirmación concreta de la spec (el 4.0 es lo que emitimos; el 3.0 es lo que la
// Sede rechaza). Se localizan por nombre y se comprueba que existen.
const CP40 = ANALISIS.find((a) => a.nombre === 'cp_parcela_9398516VK3799G.gml')
const CP30 = ANALISIS.find((a) => a.nombre === 'UTM_1.gml')

/** Los `srsName` de un fixture, en orden de aparición. */
const srsNamesDe = (a) =>
  todos(a)
    .filter((e) => e.hasAttribute('srsName'))
    .map((e) => e.getAttribute('srsName'))

describe('gml/_comun · el arnés de fixtures no miente', () => {
  it('encuentra en el disco los cuatro GML reales, y los dos que se nombran', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(4)
    expect(CP40, 'falta el GML CP 4.0 del WFS: es LA fuente de verdad de F04').toBeDefined()
    expect(CP30, 'falta UTM_1.gml: es el contraejemplo en CP 3.0').toBeDefined()
  })

  it('los cuatro son XML bien formado y tienen raíz, contenedor y feature', () => {
    for (const a of ANALISIS) {
      expect(a.doc.querySelector('parsererror'), `${a.nombre} no parsea`).toBeNull()
      expect(a.raiz, a.nombre).not.toBeNull()
      expect(a.feature, `${a.nombre}: sin elemento de feature`).not.toBeNull()
    }
  })

  it('el GML del WFS declara ISO-8859-1 (de ahí TIPO_GML.ENCODING_DECLARADO)', () => {
    // F04 emite UTF-8 con el encoding declarado == bytes reales; el fichero de
    // entrada NO tiene por qué venir así, y esa diferencia se cuenta al usuario.
    expect(CP40.encoding.toLowerCase()).toBe('iso-8859-1')
    expect(TIPO_GML.ENCODING_DECLARADO).toBe('ENCODING_DECLARADO')
  })
})

// ── NS ────────────────────────────────────────────────────────────────────────

describe('gml/_comun · NS — los namespaces salen del GML real', () => {
  it('Object.values(NS) es EXACTAMENTE el juego de xmlns declarados en el fixture', () => {
    // Se barre el TEXTO entero, no solo la raíz: base 3.3 se declara dentro, como
    // `xmlns` por defecto del `<Identifier>` del inspireId (override O4).
    const declarados = [
      ...new Set([...CP40.texto.matchAll(/\bxmlns(?::[\w.-]+)?="([^"]+)"/g)].map((m) => m[1])),
    ].sort()
    expect(declarados).toEqual([...Object.values(NS)].sort())
  })

  it('la raíz vive en el namespace WFS 2.0, no en el de GML (override O3)', () => {
    expect(CP40.raiz.namespaceURI).toBe(NS.wfs)
    expect(CP40.raiz.localName).toBe('FeatureCollection')
    expect(CP40.contenedor.localName).toBe('member')
    // Y el contraejemplo: el 3.0 es justo lo prohibido.
    expect(CP30.raiz.namespaceURI).toBe(NS.gml)
    expect(CP30.contenedor.localName).toBe('featureMember')
  })

  it('el `Identifier` del inspireId va en base 3.3 y SIN prefijo (override O4)', () => {
    const ident = todos(CP40).find((e) => e.localName === 'Identifier')
    expect(ident.namespaceURI).toBe(NS.base33)
    expect(ident.prefix).toBeNull()
    // El contraejemplo, en el mismo sitio del 3.0: prefijo `base:` y otro ns.
    const ident30 = todos(CP30).find((e) => e.localName === 'Identifier')
    expect(ident30.prefix).toBe('base')
    expect(ident30.namespaceURI).not.toBe(NS.base33)
  })

  it('NS está congelado (no se le puede añadir un namespace en caliente)', () => {
    expect(Object.isFrozen(NS)).toBe(true)
  })
})

describe('gml/_comun · SCHEMA_LOCATION', () => {
  it('es literalmente el xsi:schemaLocation de la raíz del fixture', () => {
    expect(CP40.raiz.getAttributeNS(NS.xsi, 'schemaLocation')).toBe(SCHEMA_LOCATION)
  })

  it('son pares `namespace xsd` y los namespaces citados están en NS', () => {
    const piezas = SCHEMA_LOCATION.split(/\s+/)
    expect(piezas.length % 2).toBe(0)
    const namespaces = piezas.filter((_, i) => i % 2 === 0)
    expect(namespaces).toEqual([NS.wfs, NS.cp])
  })
})

// ── Orden XSD y elementos proscritos ─────────────────────────────────────────

describe('gml/_comun · ORDEN_CADASTRAL_PARCEL (override O5)', () => {
  it('coincide con el orden REAL de los hijos de cp:CadastralParcel en el fixture', () => {
    // Si esto falla no se «arregla» la constante mirando el enunciado: se mira
    // el fichero del WFS, que es quien manda (regla de oro 8).
    const hijos = [...CP40.feature.children].map((e) => e.localName)
    expect([...ORDEN_CADASTRAL_PARCEL]).toEqual(hijos)
  })

  it('los hijos van todos en el namespace `cp` de la 4.0', () => {
    for (const hijo of CP40.feature.children) {
      expect(hijo.namespaceURI, hijo.localName).toBe(NS.cp)
    }
  })

  it('sin repetidos', () => {
    expect(new Set(ORDEN_CADASTRAL_PARCEL).size).toBe(ORDEN_CADASTRAL_PARCEL.length)
  })

  it('el CP 3.0 trae menos hijos, pero ninguno fuera de este orden relativo', () => {
    // Sostiene que la constante es el orden CANÓNICO y no un accidente de un
    // fichero: un generador distinto, de otra versión, encaja en la misma
    // secuencia (con huecos). Lo que cambia entre 3.0 y 4.0 es otra cosa.
    const hijos30 = [...CP30.feature.children].map((e) => e.localName)
    expect(hijos30.length).toBeLessThan(ORDEN_CADASTRAL_PARCEL.length)
    expect(hijos30).toEqual(ORDEN_CADASTRAL_PARCEL.filter((n) => hijos30.includes(n)))
  })
})

describe('gml/_comun · ELEMENTOS_PROSCRITOS_CP40', () => {
  it('cada entrada lleva su motivo escrito al lado (es la única lista a mano)', () => {
    for (const e of ELEMENTOS_PROSCRITOS_CP40) {
      expect(typeof e.local, JSON.stringify(e)).toBe('string')
      expect(e.local.length).toBeGreaterThan(0)
      expect(e.motivo.length, `«${e.local}» sin motivo`).toBeGreaterThan(20)
    }
  })

  it('NINGUNO aparece en el GML 4.0 del WFS', () => {
    const locales = new Set(todos(CP40).map((e) => e.localName))
    const presentes = ELEMENTOS_PROSCRITOS_CP40.filter((e) => locales.has(e.local))
    expect(presentes.map((e) => e.local)).toEqual([])
  })

  it('y `boundedBy`/`Envelope` SÍ aparecen en el GML de edificio (la lista no es vacua)', () => {
    // Sin esta mitad, la comprobación de arriba pasaría con una lista de
    // elementos inventados que no existen en ningún GML. El de edificio es 3.0 y
    // los trae, así que demuestra que son elementos REALES que se dejan fuera a
    // propósito, no nombres al azar.
    const bu = ANALISIS.filter((a) => dialectoDe(a).id === DIALECTO.BU)
    expect(bu.length).toBeGreaterThan(0)
    const localesBu = new Set(bu.flatMap((a) => todos(a).map((e) => e.localName)))
    expect(localesBu.has('boundedBy')).toBe(true)
    expect(localesBu.has('Envelope')).toBe(true)
  })

  it('ninguno se cuela en ORDEN_CADASTRAL_PARCEL (emitir y proscribir a la vez)', () => {
    const chocan = ELEMENTOS_PROSCRITOS_CP40.filter((e) =>
      ORDEN_CADASTRAL_PARCEL.includes(e.local),
    )
    expect(chocan.map((e) => e.local)).toEqual([])
  })
})

// ── Dialectos ─────────────────────────────────────────────────────────────────

describe('gml/_comun · DIALECTOS — clasifica los cuatro fixtures del disco', () => {
  it('ninguno de los ficheros reales queda en DESCONOCIDO', () => {
    const perdidos = ANALISIS.filter((a) => dialectoDe(a).id === DIALECTO.DESCONOCIDO)
    expect(perdidos.map((a) => a.nombre)).toEqual([])
  })

  it('cada entrada declarada la ejerce al menos un fixture (nada inventado)', () => {
    // La otra dirección de la comprobación anterior: no basta con que la tabla
    // cubra el disco, es que además no puede tener filas que no correspondan a
    // ningún GML real que este repo tenga delante.
    const vistos = new Set(ANALISIS.map((a) => dialectoDe(a).id))
    expect(vistos).toEqual(new Set(DIALECTOS.map((d) => d.id)))
  })

  it('exactamente UN fixture es de dialecto soportado, y es el de raíz WFS 2.0', () => {
    const soportados = ANALISIS.filter((a) => dialectoDe(a).soportado).map((a) => a.nombre)
    const raizWfs = ANALISIS.filter((a) => a.raiz.namespaceURI === NS.wfs).map((a) => a.nombre)
    expect(soportados).toEqual(raizWfs)
    expect(soportados).toHaveLength(1)
  })

  it('el GML del WFS es CP_4_0 y soportado; UTM_1 es CP_3_0 y NO soportado', () => {
    const d40 = dialectoDe(CP40)
    expect(d40.id).toBe(DIALECTO.CP_4_0)
    expect(d40.soportado).toBe(true)
    expect(d40.tema).toBe('PARCELA')

    const d30 = dialectoDe(CP30)
    expect(d30.id).toBe(DIALECTO.CP_3_0)
    expect(d30.soportado).toBe(false)
    expect(d30.tema).toBe('PARCELA')
    // El motivo va al mensaje que ve el usuario: tiene que decir QUÉ ha abierto.
    expect(d30.motivo).toMatch(/3\.0/)
  })

  it('el GML de edificio se reconoce como OTRO TEMA, no como parcela mal hecha', () => {
    const bu = ANALISIS.filter((a) => dialectoDe(a).id === DIALECTO.BU)
    expect(bu.length).toBeGreaterThan(0)
    for (const a of bu) {
      expect(dialectoDe(a).tema, a.nombre).toBe('EDIFICIO')
      expect(dialectoDe(a).soportado, a.nombre).toBe(false)
    }
  })

  it('la RAÍZ SOLA no distingue el 3.0 del edificio: lo dice el disco', () => {
    // Hallazgo que obligó a que la tabla lleve `featureNs`: hay ficheros con
    // raíz idéntica y dialecto distinto. Si algún día dejara de ser cierto,
    // este test cae y se puede simplificar la tabla a conciencia.
    const porRaiz = new Map()
    for (const a of ANALISIS) {
      const clave = `${a.raiz.namespaceURI}|${a.raiz.localName}`
      if (!porRaiz.has(clave)) porRaiz.set(clave, new Set())
      porRaiz.get(clave).add(dialectoDe(a).id)
    }
    const ambiguas = [...porRaiz.entries()].filter(([, ids]) => ids.size > 1)
    expect(ambiguas.length).toBeGreaterThan(0)
  })

  it('sin `featureNs`: la raíz WFS 2.0 basta; la raíz gml:FeatureCollection no', () => {
    expect(clasificarDialecto({ ns: NS.wfs, local: 'FeatureCollection' }).id).toBe(DIALECTO.CP_4_0)
    // Aquí caben 3.0 y edificio: afirmar uno sería inventárselo (regla de oro 1).
    // El llamante conserva lo que necesita: `soportado === false`.
    const d = clasificarDialecto({ ns: NS.gml, local: 'FeatureCollection' })
    expect(d.id).toBe(DIALECTO.DESCONOCIDO)
    expect(d.soportado).toBe(false)
  })

  it('una raíz ajena (o sin namespace) cae en DESCONOCIDO, no lanza', () => {
    expect(clasificarDialecto({ ns: null, local: 'FeatureCollection' })).toBe(DIALECTO_DESCONOCIDO)
    expect(clasificarDialecto({ ns: NS.wfs, local: 'html' })).toBe(DIALECTO_DESCONOCIDO)
    expect(
      clasificarDialecto({ ns: NS.wfs, local: 'FeatureCollection', featureNs: 'urn:otra:cosa' }),
    ).toBe(DIALECTO_DESCONOCIDO)
    expect(DIALECTO_DESCONOCIDO.soportado).toBe(false)
  })

  it('argumentos con el tipo roto → TypeError (contrato del programador)', () => {
    expect(() => clasificarDialecto({ ns: NS.wfs })).toThrow(TypeError)
    expect(() => clasificarDialecto({ ns: 42, local: 'FeatureCollection' })).toThrow(TypeError)
    expect(() =>
      clasificarDialecto({ ns: NS.wfs, local: 'FeatureCollection', featureNs: 7 }),
    ).toThrow(TypeError)
  })

  it('la tabla y sus entradas están congeladas', () => {
    expect(Object.isFrozen(DIALECTOS)).toBe(true)
    for (const d of DIALECTOS) expect(Object.isFrozen(d), d.id).toBe(true)
  })
})

// ── Vocabulario de detecciones ────────────────────────────────────────────────

describe('gml/_comun · SEVERIDAD — duplicada a propósito, y sin poder divergir', () => {
  // Por qué se duplica en vez de importarse de `parsers/_comun.js`: importarla
  // arrastraría ese módulo entero al grafo del serializador de GML — con su
  // `TIPO_DETECCION` (ARCO_DISCRETIZADO, SEPARADOR_DECIMAL…) y su tokenizador
  // LIST/TXT—, que no pinta nada leyendo o escribiendo XML. Es la misma fórmula
  // que `geo/huso.js#HUSOS_VALIDOS` frente a `model/parcela.js#SRS_VALIDOS`:
  // duplicar a conciencia y poner un test-guarda que prohíba la divergencia.
  it('tiene los MISMOS tres valores que la de parsers/ (toEqual)', () => {
    expect(SEVERIDAD).toEqual(SEVERIDAD_PARSERS)
  })

  it('…y NO es el mismo objeto: la duplicación es real, el test no es tautológico', () => {
    expect(SEVERIDAD).not.toBe(SEVERIDAD_PARSERS)
    expect(Object.isFrozen(SEVERIDAD)).toBe(true)
  })
})

describe('gml/_comun · TIPO_GML', () => {
  it('clave === valor en todas las entradas, y todas en SCREAMING_SNAKE', () => {
    for (const [clave, valor] of Object.entries(TIPO_GML)) {
      expect(valor, clave).toBe(clave)
      expect(clave).toMatch(/^[A-Z][A-Z0-9_]*$/)
    }
    expect(Object.isFrozen(TIPO_GML)).toBe(true)
  })

  it('es un léxico SEPARADO del de los parsers de CAD (no se solapan)', () => {
    const comunes = Object.values(TIPO_GML).filter((t) =>
      Object.values(TIPO_DETECCION).includes(t),
    )
    expect(comunes).toEqual([])
  })
})

describe('gml/_comun · crearDeteccionGml — misma FORMA que parsers/#crearDeteccion', () => {
  it('produce las mismas claves, en el mismo orden, que la de parsers/', () => {
    // El motivo de existir de esta simetría: la UI de F03/F08 pinta detecciones
    // de CAD y de GML con el MISMO componente, sin adaptador de por medio.
    const cad = crearDeteccion(TIPO_DETECCION.CIERRE, 'texto', 'AVISO', { n: 1 })
    const gml = crearDeteccionGml(TIPO_GML.ANILLO_NO_CERRADO, 'texto', SEVERIDAD.AVISO, { n: 1 })
    expect(Object.keys(gml)).toEqual(Object.keys(cad))
    expect({ ...gml, tipo: null }).toEqual({ ...cad, tipo: null })
  })

  it('sin `datos` la clave NO aparece (contrato `datos?`), igual que en parsers/', () => {
    const cad = crearDeteccion(TIPO_DETECCION.CIERRE, 'texto', 'AVISO')
    const gml = crearDeteccionGml(TIPO_GML.ANILLO_NO_CERRADO, 'texto', SEVERIDAD.AVISO)
    expect(gml).not.toHaveProperty('datos')
    expect(Object.keys(gml)).toEqual(Object.keys(cad))
  })

  it('tipo o severidad fuera de catálogo → RangeError (regla de oro 1)', () => {
    expect(() => crearDeteccionGml('INVENTADO', 'texto', SEVERIDAD.INFO)).toThrow(RangeError)
    expect(() => crearDeteccionGml(TIPO_GML.ID_SANEADO, 'texto', 'GRAVE')).toThrow(RangeError)
  })

  it('un tipo de los parsers de CAD NO cuela en gml/ (los léxicos no se mezclan)', () => {
    expect(() =>
      crearDeteccionGml(TIPO_DETECCION.ARCO_DISCRETIZADO, 'texto', SEVERIDAD.INFO),
    ).toThrow(RangeError)
  })

  it('mensaje vacío o `datos` que no es objeto plano → TypeError', () => {
    expect(() => crearDeteccionGml(TIPO_GML.ID_SANEADO, '', SEVERIDAD.INFO)).toThrow(TypeError)
    expect(() => crearDeteccionGml(TIPO_GML.ID_SANEADO, 42, SEVERIDAD.INFO)).toThrow(TypeError)
    for (const datos of [[1], null, 'x', 7]) {
      expect(
        () => crearDeteccionGml(TIPO_GML.ID_SANEADO, 'x', SEVERIDAD.INFO, datos),
        JSON.stringify(datos),
      ).toThrow(TypeError)
    }
  })
})

// ── srsName ───────────────────────────────────────────────────────────────────

describe('gml/_comun · srsNameUri — el srsName canónico (override O2)', () => {
  const srsNamesCp40 = srsNamesDe(CP40)
  const SRSNAME_FIXTURE = srsNamesCp40[0]

  it('el fixture repite el MISMO srsName en MultiSurface, Surface y el Point', () => {
    expect(srsNamesCp40).toHaveLength(3)
    expect(new Set(srsNamesCp40).size).toBe(1)
    const donde = todos(CP40)
      .filter((e) => e.hasAttribute('srsName'))
      .map((e) => e.localName)
    expect(donde).toEqual(['MultiSurface', 'Surface', 'Point'])
  })

  it('para el huso 30 produce EXACTAMENTE el srsName que trae el fixture', () => {
    // La cadena NO está escrita a mano en ningún sitio del test: sale del fichero.
    expect(srsNameUri('EPSG:25830')).toBe(SRSNAME_FIXTURE)
    expect(SRSNAME_FIXTURE.startsWith(PREFIJO_SRSNAME_URI)).toBe(true)
  })

  it('los tres husos válidos siguen el patrón del fixture cambiando solo el código', () => {
    for (const srs of SRS_SOPORTADOS) {
      const codigo = srs.slice('EPSG:'.length)
      expect(srsNameUri(srs)).toBe(SRSNAME_FIXTURE.replace(/\d+$/, codigo))
    }
  })

  it('NO es la URN del 3.0 ni la forma corta del modelo', () => {
    // Las tres formas conviven en este repo y confundirlas es un rechazo: el
    // GML 3.0 del disco usa URN y el modelo usa la corta.
    const urnDel30 = srsNamesDe(CP30)[0]
    expect(srsNameUri('EPSG:25830')).not.toBe(urnDel30)
    expect(srsNameUri('EPSG:25830')).not.toBe('EPSG:25830')
  })

  it('SRS fuera de los tres válidos → RangeError (Canarias DIFERIDA, O13)', () => {
    expect(() => srsNameUri('EPSG:32628')).toThrow(RangeError)
    expect(() => srsNameUri('EPSG:4326')).toThrow(RangeError)
    expect(() => srsNameUri('')).toThrow(RangeError)
  })

  it('no-string → TypeError', () => {
    expect(() => srsNameUri(25830)).toThrow(TypeError)
    expect(() => srsNameUri(null)).toThrow(TypeError)
  })
})

describe('gml/_comun · SRS_SOPORTADOS no puede divergir de model/parcela.js#SRS_VALIDOS', () => {
  // Mismo dominio visto desde otra rama del código; se duplica para no arrastrar
  // `model/` al serializador, con la misma guarda que usa `geo/huso.js`.
  it('mismos valores (toEqual) y objetos distintos (not.toBe)', () => {
    expect([...SRS_SOPORTADOS]).toEqual([...SRS_VALIDOS])
    expect(SRS_SOPORTADOS).not.toBe(SRS_VALIDOS)
  })
})

describe('gml/_comun · srsCorto — la vuelta a la forma que consume geo/huso.js', () => {
  it('ida y vuelta para los tres husos: corta → URI → código → corta', () => {
    for (const srs of SRS_SOPORTADOS) {
      const { codigo } = normalizarSrsName(srsNameUri(srs))
      expect(srsCorto(codigo)).toBe(srs)
    }
  })

  it('código no soportado → RangeError; no-entero → TypeError', () => {
    expect(() => srsCorto(32628)).toThrow(RangeError)
    expect(() => srsCorto('25830')).toThrow(TypeError)
    expect(() => srsCorto(25830.5)).toThrow(TypeError)
  })
})

describe('gml/_comun · normalizarSrsName — clasifica los srsName REALES del disco', () => {
  it('URI del CP 4.0: forma URI, código 25830, COHERENTE', () => {
    const r = normalizarSrsName(srsNamesDe(CP40)[0])
    expect(r.forma).toBe(FORMA_SRSNAME.URI)
    expect(r.codigo).toBe(25830)
    expect(r.coherente).toBe(true)
    expect(r.valor).toBe(srsNamesDe(CP40)[0])
  })

  it('URN del CP 3.0 (`urn:ogc:def:crs:EPSG::25830`): forma URN, código sí, NO coherente', () => {
    const crudo = srsNamesDe(CP30)[0]
    expect(crudo).toMatch(/^urn:/) // el fichero del disco, no una cadena inventada
    const r = normalizarSrsName(crudo)
    expect(r.forma).toBe(FORMA_SRSNAME.URN)
    expect(r.codigo).toBe(25830)
    // El dato se aprovecha (el huso es legible) pero la forma es la del 3.0: el
    // llamante emite SRS_FORMA_INESPERADA en vez de tragárselo.
    expect(r.coherente).toBe(false)
  })

  it('el GML de edificio usa la MISMA URN (override O10: asimetría deliberada)', () => {
    const bu = ANALISIS.filter((a) => dialectoDe(a).id === DIALECTO.BU)
    const urns = bu.flatMap(srsNamesDe)
    expect(urns.length).toBeGreaterThan(0)
    for (const u of urns) {
      expect(normalizarSrsName(u).forma, u).toBe(FORMA_SRSNAME.URN)
      expect(normalizarSrsName(u).coherente, u).toBe(false)
    }
  })

  it('forma CORTA `EPSG:25830` (la del modelo): se reconoce y no es coherente', () => {
    const r = normalizarSrsName(SRS_SOPORTADOS[1])
    expect(r.forma).toBe(FORMA_SRSNAME.CORTA)
    expect(r.codigo).toBe(25830)
    expect(r.coherente).toBe(false)
  })

  it('forma heredada de GML 2/3.0 (`epsg.xml#25830`): se reconoce para poder nombrarla', () => {
    // No sale de ningún fixture de este repo (es de GML antiguo): se reconoce
    // para que el mensaje diga qué es, en vez de «formato desconocido».
    const r = normalizarSrsName('http://www.opengis.net/gml/srs/epsg.xml#25830')
    expect(r.forma).toBe(FORMA_SRSNAME.GML_SRS)
    expect(r.codigo).toBe(25830)
    expect(r.coherente).toBe(false)
  })

  it('una URI con otra versión de registro es URI pero NO coherente', () => {
    const r = normalizarSrsName('http://www.opengis.net/def/crs/EPSG/9.9.1/25830')
    expect(r.forma).toBe(FORMA_SRSNAME.URI)
    expect(r.codigo).toBe(25830)
    expect(r.coherente).toBe(false)
  })

  it('un EPSG soportado en URI canónica es lo ÚNICO coherente, para los tres husos', () => {
    for (const srs of SRS_SOPORTADOS) {
      expect(normalizarSrsName(srsNameUri(srs)).coherente, srs).toBe(true)
    }
    // Canarias en URI canónica: forma buena, SRS diferido → no coherente (O13).
    const canarias = normalizarSrsName(`${PREFIJO_SRSNAME_URI}32628`)
    expect(canarias.forma).toBe(FORMA_SRSNAME.URI)
    expect(canarias.codigo).toBe(32628)
    expect(canarias.coherente).toBe(false)
  })

  it('basura → DESCONOCIDA con código null, sin lanzar (es dato del usuario)', () => {
    for (const malo of ['', 'WGS84', 'EPSG:', 'urn:ogc:def:crs:OGC:1.3:CRS84']) {
      const r = normalizarSrsName(malo)
      expect(r.forma, malo).toBe(FORMA_SRSNAME.DESCONOCIDA)
      expect(r.codigo, malo).toBeNull()
      expect(r.coherente, malo).toBe(false)
    }
  })

  it('recorta espacios alrededor', () => {
    const r = normalizarSrsName(`  ${srsNameUri('EPSG:25831')}\n`)
    expect(r.valor).toBe(srsNameUri('EPSG:25831'))
    expect(r.coherente).toBe(true)
  })

  it('no-string → TypeError, y el mensaje manda a SRS_AUSENTE', () => {
    // La ausencia del atributo (el DOM devuelve `null`) es otro suceso y tiene
    // su propia detección: no puede colarse como «forma desconocida».
    expect(() => normalizarSrsName(null)).toThrow(TypeError)
    expect(() => normalizarSrsName(null)).toThrow(/SRS_AUSENTE/)
    expect(() => normalizarSrsName(undefined)).toThrow(TypeError)
  })
})

// ── Fechas ────────────────────────────────────────────────────────────────────

describe('gml/_comun · dateTimeCatastro', () => {
  it('reproduce el formato EXACTO del `beginLifespanVersion` del fixture', () => {
    const delFixture = todos(CP40).find((e) => e.localName === 'beginLifespanVersion').textContent
    expect(delFixture).toBe('2005-11-21T00:00:00') // lo que hay en el fichero
    expect(dateTimeCatastro(new Date(Date.UTC(2005, 10, 21, 0, 0, 0)))).toBe(delFixture)
  })

  it('y el del `timeStamp` de la raíz, que lleva hora distinta de medianoche', () => {
    const stamp = CP40.raiz.getAttribute('timeStamp')
    expect(dateTimeCatastro(new Date(Date.UTC(2026, 6, 24, 12, 28, 45)))).toBe(stamp)
  })

  it('el patrón es el mismo en TODOS los dateTime de los fixtures (sin zona ni fracción)', () => {
    // Derivado del disco: se barren las HOJAS cuyo texto parece un dateTime (las
    // hojas, y no cualquier elemento, porque el `textContent` de un padre
    // concatena el de sus hijos) y se comprueba que ninguna lleva `Z`, offset ni
    // milisegundos — justo lo que este formateador se niega a emitir.
    const textos = ANALISIS.flatMap((a) =>
      todos(a)
        .filter((e) => e.children.length === 0)
        .map((e) => e.textContent.trim())
        .filter((t) => /^\d{4}-\d{2}-\d{2}T/.test(t)),
    )
    expect(textos.length).toBeGreaterThan(0)
    for (const t of textos) expect(t, t).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  })

  it('rellena con ceros a la izquierda mes, día y hora', () => {
    expect(dateTimeCatastro(new Date(Date.UTC(2026, 0, 2, 3, 4, 5)))).toBe('2026-01-02T03:04:05')
  })

  it('no-fecha → TypeError; fecha inválida → RangeError', () => {
    expect(() => dateTimeCatastro('2005-11-21')).toThrow(TypeError)
    expect(() => dateTimeCatastro(1132531200000)).toThrow(TypeError)
    expect(() => dateTimeCatastro(new Date('vaya'))).toThrow(RangeError)
  })

  it('gml/_comun.js NO lee el reloj: ni instancia fechas ni pide la marca actual', () => {
    // La reproducibilidad del test de ida y vuelta de F04 (un GML entero contra
    // snapshot) depende de que `gml/` sea función pura de sus entradas. Se
    // comprueba sobre el TEXTO del módulo, que es donde se ve.
    const fuente = readFileSync(join(RAIZ, 'gml', '_comun.js'), 'utf8')
    const INSTANCIA_FECHA = /\bnew\s+Date\b/
    const RELOJ = /\bDate\s*\.\s*now\b/
    expect(INSTANCIA_FECHA.test(fuente), 'gml/_comun.js instancia una fecha propia').toBe(false)
    expect(RELOJ.test(fuente), 'gml/_comun.js consulta el reloj del sistema').toBe(false)
    // …y los detectores no son vacuos: este mismo fichero de test sí las usa.
    const esteTest = readFileSync(import.meta.filename, 'utf8')
    expect(INSTANCIA_FECHA.test(esteTest)).toBe(true)
  })
})

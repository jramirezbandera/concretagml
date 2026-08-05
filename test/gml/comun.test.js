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
 * ⚠️ ESTE FICHERO SE CORRIGIÓ EL 2026-07-27, y el motivo importa más que los    *
 * cambios: sus afirmaciones estaban BIEN COMPROBADAS contra el fixture          *
 * EQUIVOCADO. Ataban todo a `cp_parcela_9398516VK3799G.gml`, que es la DESCARGA *
 * del WFS, cuando lo que la app produce es una ENTREGA. Todo salía verde y la   *
 * Sede rechazaba el fichero. Un test derivado de la fuente correcta es una      *
 * garantía; derivado de la fuente equivocada es una garantía de estar mal.      *
 *                                                                              *
 * Los cinco fixtures y para qué sirve cada uno:                                 *
 *   · `cp_ejemplo_explicativo.gml` — LA PLANTILLA OFICIAL del Catastro. De aquí *
 *     sale el perfil de ENTREGA: raíz, contenedor, schemaLocation y srsName en  *
 *     URN. Es la fuente de verdad de lo que se SUBE.                            *
 *   · `cp_parcela_9398516VK3799G.gml` — CP 4.0 del WFS. De aquí siguen saliendo *
 *     ORDEN_CADASTRAL_PARCEL y el perfil de DESCARGA. NO el sobre de entrega.   *
 *   · `UTM_1.gml` — CP 3.0 de otro generador: el CONTRAEJEMPLO de dialecto.     *
 *   · `bu_building_*.gml` / `bu_buildingpart_*.gml` — edificio: cuarto dialecto *
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
  SCHEMA_LOCATION_ENTREGA,
  SCHEMA_LOCATION_WFS,
  ORDEN_CADASTRAL_PARCEL,
  ELEMENTOS_PROSCRITOS_CP40,
  DIALECTO,
  DIALECTOS,
  DIALECTO_DESCONOCIDO,
  PERFIL,
  PERFILES,
  clasificarDialecto,
  esCp40,
  perfilPorId,
  SEVERIDAD,
  TIPO_GML,
  crearDeteccionGml,
  SRS_SOPORTADOS,
  PREFIJO_SRSNAME_URI,
  PREFIJO_SRSNAME_URN,
  FORMA_SRSNAME,
  srsNameUri,
  srsNameUrn,
  srsNamePorForma,
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
/** La plantilla oficial: fuente de verdad del sobre que se SUBE a la Sede. */
const ENTREGA = ANALISIS.find((a) => a.nombre === 'cp_ejemplo_explicativo.gml')

/**
 * Los dos fixtures de CP 4.0, emparejados con el perfil que cada uno define. Se
 * recorre esta tabla en vez de escribir dos bloques gemelos: así, el día que
 * entre un tercer perfil, la única forma de que sus pruebas no existan es que
 * nadie añada su fixture — y eso lo caza la comprobación de que la tabla cubre
 * TODOS los perfiles declarados, que está justo debajo.
 */
const PAREJAS_PERFIL = [
  { perfil: PERFILES[PERFIL.ENTREGA], analisis: () => ENTREGA },
  { perfil: PERFILES[PERFIL.WFS], analisis: () => CP40 },
]

/** Los `srsName` de un fixture, en orden de aparición. */
const srsNamesDe = (a) =>
  todos(a)
    .filter((e) => e.hasAttribute('srsName'))
    .map((e) => e.getAttribute('srsName'))

describe('gml/_comun · el arnés de fixtures no miente', () => {
  it('encuentra en el disco los cinco GML reales, y los tres que se nombran', () => {
    expect(FIXTURES.length).toBeGreaterThanOrEqual(5)
    expect(
      ENTREGA,
      'falta cp_ejemplo_explicativo.gml: es la plantilla OFICIAL y la fuente de verdad ' +
        'del fichero que se sube a la Sede. Sin él, F04 vuelve a derivarlo todo de la ' +
        'descarga del WFS, que es lo que provocó el rechazo del 2026-07-27.',
    ).toBeDefined()
    expect(CP40, 'falta el GML CP 4.0 del WFS: es la fuente de verdad de los números').toBeDefined()
    expect(CP30, 'falta UTM_1.gml: es el contraejemplo en CP 3.0').toBeDefined()
  })

  it('la tabla PAREJAS_PERFIL cubre TODOS los perfiles declarados', () => {
    // Anti-vacuidad de la tabla de arriba: si mañana aparece un perfil nuevo sin
    // su fixture, esto cae y nadie puede añadirlo sin atarlo a un fichero real.
    expect(PAREJAS_PERFIL.map((p) => p.perfil.id).sort()).toEqual(Object.keys(PERFILES).sort())
    for (const { perfil, analisis } of PAREJAS_PERFIL) {
      expect(analisis(), `el perfil ${perfil.id} no tiene fixture en el disco`).toBeDefined()
      expect(analisis().nombre, `el perfil ${perfil.id} apunta a otro fichero`).toBe(perfil.fixture)
    }
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

/** Todos los `xmlns` declarados en el TEXTO de un fixture, sin repetir. */
const xmlnsDe = (a) => [
  ...new Set([...a.texto.matchAll(/\bxmlns(?::[\w.-]+)?="([^"]+)"/g)].map((m) => m[1])),
]

describe('gml/_comun · NS — los namespaces salen de los GML reales', () => {
  it('Object.values(NS) es EXACTAMENTE la UNIÓN de los xmlns de los dos fixtures 4.0', () => {
    // Unión, no uno de los dos: cada perfil declara su juego y `NS` tiene que
    // cubrir ambos. Se barre el TEXTO entero, no solo la raíz, porque base 3.3
    // se declara dentro del `inspireId` en los dos ficheros.
    const declarados = [...new Set([...xmlnsDe(CP40), ...xmlnsDe(ENTREGA)])].sort()
    expect(declarados).toEqual([...Object.values(NS)].sort())
  })

  it('cada fixture 4.0 declara EXACTAMENTE los prefijos de su perfil, y en su orden', () => {
    // Deriva el orden del propio fichero. Es lo que impide que `prefijosRaiz` se
    // «ordene alfabéticamente para que quede bonito» y deje de reproducirlo.
    for (const { perfil, analisis } of PAREJAS_PERFIL) {
      const a = analisis()
      const enLaRaiz = [...a.raiz.attributes]
        .filter((at) => at.name.startsWith('xmlns:'))
        .map((at) => at.name.slice('xmlns:'.length))
      expect(enLaRaiz, `${a.nombre}: prefijos de la raíz`).toEqual([...perfil.prefijosRaiz])
    }
  })

  it('las DOS raíces 4.0 son distintas, y esa diferencia es el fallo del 2026-07-27', () => {
    // La entrega va en GML 3.2 con `gml:featureMember`…
    expect(ENTREGA.raiz.namespaceURI).toBe(NS.gml)
    expect(ENTREGA.raiz.localName).toBe('FeatureCollection')
    expect(ENTREGA.contenedor.localName).toBe('featureMember')
    // …y la descarga del WFS en el namespace de WFS 2.0 con `member`.
    expect(CP40.raiz.namespaceURI).toBe(NS.wfs)
    expect(CP40.raiz.localName).toBe('FeatureCollection')
    expect(CP40.contenedor.localName).toBe('member')
    // Anti-vacuidad: si alguien «unificase» los dos perfiles, esto cae.
    expect(ENTREGA.raiz.namespaceURI).not.toBe(CP40.raiz.namespaceURI)
  })

  it('la raíz de la ENTREGA lleva gml:id, y NO es el de la parcela (xs:ID es único)', () => {
    const idRaiz = ENTREGA.raiz.getAttributeNS(NS.gml, 'id')
    expect(idRaiz).toBeTruthy()
    expect(idRaiz).toBe('ES.SDGC.CP')
    expect(idRaiz).not.toBe(ENTREGA.feature.getAttributeNS(NS.gml, 'id'))
    // El contraejemplo real: UTM_1.gml SÍ los repite, y por eso no vale de
    // plantilla. Ver test/fixtures/gml/PROCEDENCIA.md.
    expect(CP30.raiz.getAttributeNS(NS.gml, 'id')).toBe(
      CP30.feature.getAttributeNS(NS.gml, 'id'),
    )
  })

  it('el `Identifier` va en base 3.3 en los DOS fixtures 4.0, con prefijo o sin él', () => {
    // ⚠️ Lo que se comprueba es el NAMESPACE, no el prefijo. El override O4 decía
    // que `base:` «produce rechazo en 4.0»; la plantilla OFICIAL usa `base:` y
    // valida contra el XSD. En XML el prefijo no es información.
    for (const a of [CP40, ENTREGA]) {
      const ident = todos(a).find((e) => e.localName === 'Identifier')
      expect(ident.namespaceURI, `${a.nombre}: ns del Identifier`).toBe(NS.base33)
    }
    expect(todos(CP40).find((e) => e.localName === 'Identifier').prefix).toBeNull()
    expect(todos(ENTREGA).find((e) => e.localName === 'Identifier').prefix).toBe('base')

    // El contraejemplo de verdad es la VERSIÓN, y está en el 3.0: base 3.2.
    const ident30 = todos(CP30).find((e) => e.localName === 'Identifier')
    expect(ident30.namespaceURI).not.toBe(NS.base33)
  })

  it('NS está congelado (no se le puede añadir un namespace en caliente)', () => {
    expect(Object.isFrozen(NS)).toBe(true)
  })
})

describe('gml/_comun · schemaLocation — uno por perfil', () => {
  it('cada uno es literalmente el xsi:schemaLocation de la raíz de SU fixture', () => {
    for (const { perfil, analisis } of PAREJAS_PERFIL) {
      const enElFichero = analisis().raiz.getAttributeNS(NS.xsi, 'schemaLocation')
      // El de la plantilla viene con espacios de sobra entre los dos trozos del
      // par; se normalizan los runs de blancos, que es lo mismo que hace la
      // canonicalización del round-trip y lo que XSD-list define.
      expect(enElFichero.replace(/\s+/g, ' ').trim(), perfil.id).toBe(perfil.schemaLocation)
    }
  })

  it('la ENTREGA cita SOLO cp/4.0; el WFS cita ADEMÁS su propio esquema', () => {
    const namespacesDe = (sl) => sl.split(/\s+/).filter((_, i) => i % 2 === 0)
    expect(namespacesDe(SCHEMA_LOCATION_ENTREGA)).toEqual([NS.cp])
    expect(namespacesDe(SCHEMA_LOCATION_WFS)).toEqual([NS.wfs, NS.cp])
  })

  it('los dos son pares `namespace xsd` completos', () => {
    for (const sl of [SCHEMA_LOCATION_ENTREGA, SCHEMA_LOCATION_WFS]) {
      expect(sl.split(/\s+/).length % 2).toBe(0)
    }
  })

  it('⚠️ el WFS declara el esquema que el IVG NO carga: ahí murió el fichero', () => {
    // Esta es la afirmación que el proyecto no tenía escrita en ninguna parte, y
    // por eso se pudo emitir el sobre equivocado durante toda F04.
    expect(SCHEMA_LOCATION_WFS).toContain(NS.wfs)
    expect(SCHEMA_LOCATION_ENTREGA).not.toContain(NS.wfs)
  })
})

describe('gml/_comun · PERFILES — cada campo atado a su fichero real', () => {
  it('perfilPorId devuelve el perfil, y LANZA con uno inventado', () => {
    expect(perfilPorId(PERFIL.ENTREGA).id).toBe(PERFIL.ENTREGA)
    expect(perfilPorId(PERFIL.WFS).id).toBe(PERFIL.WFS)
    expect(() => perfilPorId('CP_5_0')).toThrow(RangeError)
    // Sin valor por defecto silencioso: `undefined` no cae en ENTREGA.
    expect(() => perfilPorId(undefined)).toThrow(RangeError)
    // Y no se cuela por la cadena de prototipos.
    expect(() => perfilPorId('toString')).toThrow(RangeError)
  })

  it('la raíz y el contenedor de cada perfil son los del fichero', () => {
    for (const { perfil, analisis } of PAREJAS_PERFIL) {
      const a = analisis()
      expect(perfil.raiz.split(':').pop(), a.nombre).toBe(a.raiz.localName)
      expect(perfil.raizNs, a.nombre).toBe(a.raiz.namespaceURI)
      expect(perfil.miembro.split(':').pop(), a.nombre).toBe(a.contenedor.localName)
    }
  })

  it('`raizLlevaGmlId` y `atributosWfs` describen lo que el fichero trae', () => {
    for (const { perfil, analisis } of PAREJAS_PERFIL) {
      const raiz = analisis().raiz
      expect(perfil.raizLlevaGmlId, `${perfil.id}: gml:id en la raíz`).toBe(
        raiz.hasAttributeNS(NS.gml, 'id'),
      )
      expect(perfil.atributosWfs, `${perfil.id}: numberReturned`).toBe(
        raiz.hasAttribute('numberReturned'),
      )
    }
  })

  it('`emiteEndLifespan` y `emiteReferencePoint` describen lo que el fichero trae', () => {
    for (const { perfil, analisis } of PAREJAS_PERFIL) {
      const locales = [...analisis().feature.children].map((e) => e.localName)
      expect(perfil.emiteEndLifespan, `${perfil.id}: endLifespanVersion`).toBe(
        locales.includes('endLifespanVersion'),
      )
      expect(perfil.emiteReferencePoint, `${perfil.id}: referencePoint`).toBe(
        locales.includes('referencePoint'),
      )
    }
  })

  it('`formaSrsName` es la forma que el fichero usa DE VERDAD, y son distintas', () => {
    for (const { perfil, analisis } of PAREJAS_PERFIL) {
      for (const valor of srsNamesDe(analisis())) {
        expect(normalizarSrsName(valor).forma, `${perfil.id}: ${valor}`).toBe(perfil.formaSrsName)
      }
    }
    // Anti-vacuidad: si las dos formas fueran la misma, el bucle de arriba
    // pasaría sin comprobar nada interesante.
    expect(PERFILES[PERFIL.ENTREGA].formaSrsName).not.toBe(PERFILES[PERFIL.WFS].formaSrsName)
  })

  it('PERFILES y todos sus campos de array están congelados', () => {
    expect(Object.isFrozen(PERFILES)).toBe(true)
    for (const perfil of Object.values(PERFILES)) {
      expect(Object.isFrozen(perfil)).toBe(true)
      expect(Object.isFrozen(perfil.prefijosRaiz)).toBe(true)
    }
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

  it('los soportados son EXACTAMENTE los que traen el feature en cp/4.0', () => {
    // El discriminante es el namespace del FEATURE, no la raíz. Hasta el
    // 2026-07-27 esta prueba decía «y es el de raíz WFS 2.0», que ataba el
    // soporte al sobre y dejaba fuera la plantilla oficial del propio Catastro.
    const soportados = ANALISIS.filter((a) => dialectoDe(a).soportado).map((a) => a.nombre).sort()
    const featureEnCp40 = ANALISIS.filter((a) => a.feature?.namespaceURI === NS.cp)
      .map((a) => a.nombre)
      .sort()
    expect(soportados).toEqual(featureEnCp40)
    // Eran DOS hasta el 2026-08-05. El tercero es `cp_parcela_7136910UF1473N.gml`,
    // la geometría oficial del expediente de oro de F17 (`PROCEDENCIA.md`), que es
    // otra descarga del mismo WFS: mismo dialecto, otra parcela. Se cuentan por
    // nombre y no solo por cantidad, porque el número solo dice cuántos hay y lo
    // que importa aquí es CUÁLES.
    expect(soportados).toEqual([
      'cp_ejemplo_explicativo.gml',
      'cp_parcela_7136910UF1473N.gml',
      'cp_parcela_9398516VK3799G.gml',
    ])
  })

  it('los dos CP 4.0 son soportados y se distinguen por el SOBRE, no por el contenido', () => {
    const dEntrega = dialectoDe(ENTREGA)
    const dWfs = dialectoDe(CP40)
    for (const [d, esperado] of [
      [dEntrega, DIALECTO.CP_4_0_ENTREGA],
      [dWfs, DIALECTO.CP_4_0_WFS],
    ]) {
      expect(d.id).toBe(esperado)
      expect(d.soportado).toBe(true)
      expect(d.tema).toBe('PARCELA')
      expect(esCp40(d.id)).toBe(true)
    }
    // Mismo feature, distinta raíz: eso es exactamente la distinción.
    expect(dEntrega.featureNs).toBe(dWfs.featureNs)
    expect(dEntrega.raiz).not.toEqual(dWfs.raiz)
    // Y `esCp40` no dice que sí a cualquier cosa.
    expect(esCp40(DIALECTO.CP_3_0)).toBe(false)
    expect(esCp40(DIALECTO.BU)).toBe(false)
    expect(esCp40(DIALECTO.DESCONOCIDO)).toBe(false)
  })

  it('UTM_1 es CP_3_0 y NO soportado, y el motivo dice qué es', () => {
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
    expect(clasificarDialecto({ ns: NS.wfs, local: 'FeatureCollection' }).id).toBe(
      DIALECTO.CP_4_0_WFS,
    )
    // Aquí caben tres (entrega 4.0, 3.0 y edificio): afirmar uno sería
    // inventárselo (regla de oro 1). El llamante conserva lo que necesita:
    // `soportado === false`, que es lo que le hace parar.
    const d = clasificarDialecto({ ns: NS.gml, local: 'FeatureCollection' })
    expect(d.id).toBe(DIALECTO.DESCONOCIDO)
    expect(d.soportado).toBe(false)
  })

  it('con `featureNs`, la raíz gml:FeatureCollection sí se resuelve, y en los tres casos', () => {
    const conFeature = (featureNs) =>
      clasificarDialecto({ ns: NS.gml, local: 'FeatureCollection', featureNs }).id
    expect(conFeature(NS.cp)).toBe(DIALECTO.CP_4_0_ENTREGA)
    expect(conFeature('urn:x-inspire:specification:gmlas:CadastralParcels:3.0')).toBe(
      DIALECTO.CP_3_0,
    )
    expect(conFeature('http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0')).toBe(DIALECTO.BU)
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

  it('NO es la URN ni la forma corta del modelo: son tres cadenas distintas', () => {
    expect(srsNameUri('EPSG:25830')).not.toBe(srsNameUrn('EPSG:25830'))
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

describe('gml/_comun · srsNameUrn — la forma de la ENTREGA (corrección de O2)', () => {
  // ⚠️ El dossier decía «URI OGC, NUNCA la URN (que es del 3.0, rechazado)».
  // Falso por partida doble: la URN también es 4.0 —la usa la plantilla oficial
  // del Catastro— y es la que hay que emitir para SUBIR.
  const URN_PLANTILLA = () => srsNamesDe(ENTREGA)[0]

  it('para el huso 30 produce EXACTAMENTE el srsName de la plantilla OFICIAL', () => {
    expect(srsNameUrn('EPSG:25830')).toBe(URN_PLANTILLA())
    expect(URN_PLANTILLA().startsWith(PREFIJO_SRSNAME_URN)).toBe(true)
  })

  it('los tres husos siguen el patrón de la plantilla cambiando solo el código', () => {
    for (const srs of SRS_SOPORTADOS) {
      const codigo = srs.slice('EPSG:'.length)
      expect(srsNameUrn(srs)).toBe(URN_PLANTILLA().replace(/\d+$/, codigo))
    }
  })

  it('el `EPSG::` lleva DOS dos puntos (versión de registro vacía), y no es errata', () => {
    // Se afirma sobre el fichero real, no sobre la constante: si alguien
    // «arreglara» el doble dos puntos, la plantilla dejaría de reproducirse.
    expect(URN_PLANTILLA()).toContain('EPSG::')
    expect(URN_PLANTILLA()).not.toContain('EPSG:0:')
  })

  it('mismas guardas que srsNameUri: RangeError y TypeError', () => {
    expect(() => srsNameUrn('EPSG:32628')).toThrow(RangeError)
    expect(() => srsNameUrn('')).toThrow(RangeError)
    expect(() => srsNameUrn(25830)).toThrow(TypeError)
  })
})

describe('gml/_comun · srsNamePorForma — el despachador por perfil', () => {
  it('URI y URN coinciden con sus dos funciones, para los tres husos', () => {
    for (const srs of SRS_SOPORTADOS) {
      expect(srsNamePorForma(srs, FORMA_SRSNAME.URI)).toBe(srsNameUri(srs))
      expect(srsNamePorForma(srs, FORMA_SRSNAME.URN)).toBe(srsNameUrn(srs))
    }
  })

  it('cada perfil, aplicado a su fixture, reproduce el srsName del fichero', () => {
    // Cierra el círculo: perfil → forma → cadena → el fichero real. Si alguien
    // cambiara `formaSrsName` de un perfil, esto cae señalando cuál.
    for (const { perfil, analisis } of PAREJAS_PERFIL) {
      const delFichero = srsNamesDe(analisis())[0]
      expect(srsNamePorForma('EPSG:25830', perfil.formaSrsName), perfil.id).toBe(delFichero)
    }
  })

  it('las formas que solo se LEEN no se pueden emitir → RangeError', () => {
    expect(() => srsNamePorForma('EPSG:25830', FORMA_SRSNAME.CORTA)).toThrow(RangeError)
    expect(() => srsNamePorForma('EPSG:25830', FORMA_SRSNAME.GML_SRS)).toThrow(RangeError)
    expect(() => srsNamePorForma('EPSG:25830', FORMA_SRSNAME.DESCONOCIDA)).toThrow(RangeError)
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
  it('URI de la descarga del WFS: forma URI, código 25830, coherente CONTRA URI', () => {
    const crudo = srsNamesDe(CP40)[0]
    const r = normalizarSrsName(crudo, { formaCanonica: FORMA_SRSNAME.URI })
    expect(r.forma).toBe(FORMA_SRSNAME.URI)
    expect(r.codigo).toBe(25830)
    expect(r.coherente).toBe(true)
    expect(r.formaCanonica).toBe(FORMA_SRSNAME.URI)
    expect(r.valor).toBe(crudo)
    // …y NO coherente contra la URN, que es la forma del otro perfil. Que
    // `coherente` dependa de contra qué se pregunta es justo la corrección.
    expect(normalizarSrsName(crudo, { formaCanonica: FORMA_SRSNAME.URN }).coherente).toBe(false)
  })

  it('URN de la plantilla OFICIAL: coherente contra URN, que es el defecto', () => {
    const crudo = srsNamesDe(ENTREGA)[0]
    expect(crudo).toMatch(/^urn:/) // del fichero del disco, no una cadena inventada
    const r = normalizarSrsName(crudo)
    expect(r.forma).toBe(FORMA_SRSNAME.URN)
    expect(r.codigo).toBe(25830)
    expect(r.formaCanonica).toBe(FORMA_SRSNAME.URN)
    expect(r.coherente).toBe(true)
  })

  it('la URN del CP 3.0 y la del edificio son la MISMA cadena que la de la entrega', () => {
    // Hallazgo que hay que dejar escrito: la forma del srsName NO distingue
    // dialectos. Quien quiera saber si un fichero es 4.0 mira el namespace del
    // feature, no la forma de esta cadena. Suponer lo contrario fue parte de que
    // el dossier llamara «del 3.0, rechazada» a una forma perfectamente 4.0.
    const dePlantilla = srsNamesDe(ENTREGA)[0]
    expect(srsNamesDe(CP30)[0]).toBe(dePlantilla)
    const bu = ANALISIS.filter((a) => dialectoDe(a).id === DIALECTO.BU)
    const urns = bu.flatMap(srsNamesDe)
    expect(urns.length).toBeGreaterThan(0)
    for (const u of urns) expect(normalizarSrsName(u).forma, u).toBe(FORMA_SRSNAME.URN)
  })

  it('forma CORTA `EPSG:25830` (la del modelo): se reconoce y no es coherente con ninguna', () => {
    const r = normalizarSrsName(SRS_SOPORTADOS[1])
    expect(r.forma).toBe(FORMA_SRSNAME.CORTA)
    expect(r.codigo).toBe(25830)
    expect(r.coherente).toBe(false)
    expect(normalizarSrsName(SRS_SOPORTADOS[1], { formaCanonica: 'URI' }).coherente).toBe(false)
  })

  it('una `formaCanonica` que no es URI ni URN → RangeError', () => {
    expect(() => normalizarSrsName('EPSG:25830', { formaCanonica: 'CORTA' })).toThrow(RangeError)
    expect(() => normalizarSrsName('EPSG:25830', { formaCanonica: null })).toThrow(RangeError)
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

  it('un EPSG soportado en su forma canónica es coherente, para los tres husos', () => {
    for (const srs of SRS_SOPORTADOS) {
      expect(normalizarSrsName(srsNameUrn(srs)).coherente, srs).toBe(true)
      expect(
        normalizarSrsName(srsNameUri(srs), { formaCanonica: FORMA_SRSNAME.URI }).coherente,
        srs,
      ).toBe(true)
    }
    // Canarias en forma canónica: forma buena, SRS diferido → no coherente (O13).
    for (const prefijo of [PREFIJO_SRSNAME_URI, PREFIJO_SRSNAME_URN]) {
      const canarias = normalizarSrsName(`${prefijo}32628`, {
        formaCanonica: prefijo === PREFIJO_SRSNAME_URI ? FORMA_SRSNAME.URI : FORMA_SRSNAME.URN,
      })
      expect(canarias.codigo, prefijo).toBe(32628)
      expect(canarias.coherente, prefijo).toBe(false)
    }
  })

  it('basura → DESCONOCIDA con código null, sin lanzar (es dato del usuario)', () => {
    for (const malo of ['', 'WGS84', 'EPSG:', 'urn:ogc:def:crs:OGC:1.3:CRS84']) {
      const r = normalizarSrsName(malo)
      expect(r.forma, malo).toBe(FORMA_SRSNAME.DESCONOCIDA)
      expect(r.codigo, malo).toBeNull()
      expect(r.coherente, malo).toBe(false)
    }
  })

  it('recorta espacios alrededor, en las dos formas', () => {
    for (const [forma, canonico] of [
      [FORMA_SRSNAME.URN, srsNameUrn('EPSG:25831')],
      [FORMA_SRSNAME.URI, srsNameUri('EPSG:25831')],
    ]) {
      const r = normalizarSrsName(`  ${canonico}\n`, { formaCanonica: forma })
      expect(r.valor, forma).toBe(canonico)
      expect(r.coherente, forma).toBe(true)
    }
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

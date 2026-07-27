/* -------------------------------------------------------------------------- *
 * test/gml/ids.test.js — F04 · Los `gml:id` del GML de parcela                 *
 *                                                                              *
 * `gml/ids.js` compone cadenas, y una cadena compuesta «casi bien» es el peor   *
 * de los fallos posibles en este proyecto: el GML sale, valida contra el XSD y  *
 * deja de ser el del Catastro. Por eso aquí no se comprueba que el módulo       *
 * devuelva lo que el módulo dice, sino que los cuatro identificadores que       *
 * genera son EXACTAMENTE los cuatro `gml:id` que hay escritos en               *
 * `test/fixtures/gml/cp_parcela_9398516VK3799G.gml` — leídos del disco, en este *
 * fichero, que sí puede tocar `test/` (regla de oro 8).                         *
 *                                                                              *
 * De los fixtures sale TODO lo que aquí se afirma: los cuatro ids, el namespace *
 * INSPIRE de cada uno (`ES.SDGC.CP` en el oficial, `ES.LOCAL.CP` en el alta de  *
 * un particular) y las referencias catastrales con las que se prueba, que son   *
 * reales y de dos longitudes distintas (14 de parcela y 20 con cargo e          *
 * inmueble). No hay ni una lista escrita a mano.                                *
 *                                                                              *
 * ⚠️ LA ASIMETRÍA, que es la razón de ser de la mitad de este fichero: en el    *
 * GML real el `MultiSurface` NO va numerado y el `Surface` SÍ lleva un `.1`.    *
 * Es tan fácil «corregirla» al escribir el serializador que aquí se ata con el  *
 * fichero delante, en los dos sentidos: que el fixture es así, y que el módulo  *
 * lo reproduce.                                                                 *
 *                                                                              *
 * HALLAZGO anotado abajo: `UTM_1.gml` —CP 3.0 de otro generador— tampoco numera *
 * su `Surface`. No se sigue a ese: el que manda es el 4.0 del Catastro.         *
 *                                                                              *
 * El XML se parsea con jsdom (ya es devDependency) y NO con `gml/xml.js`: ese   *
 * módulo se escribe en paralelo, y un test que se apoyara en el parser del      *
 * propio proyecto dejaría de ser una comprobación independiente. Por el mismo   *
 * motivo, la validez de cada id como nombre XML se juzga con un ORÁCULO ajeno   *
 * al módulo: `document.createElement(nombre)`, que lanza si el nombre no es un  *
 * Name válido de XML.                                                           *
 *                                                                              *
 * Proyecto Vitest `node`: cadenas y funciones puras, sin DOM de aplicación.     *
 * -------------------------------------------------------------------------- */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

import {
  NAMESPACE_INSPIRE_DEFECTO,
  NAMESPACE_INSPIRE_CATASTRO,
  PREFIJO_ID,
  SEPARADOR_ID,
  SUFIJO_MULTISURFACE,
  BASE_NUMERACION_SURFACE,
  CARACTER_SUSTITUTO,
  MOTIVO_SANEADO,
  toXmlId,
  idsDeParcela,
} from '../../gml/ids.js'
import { NS, TIPO_GML, SEVERIDAD } from '../../gml/_comun.js'

// ── Lectura de los fixtures ──────────────────────────────────────────────────
// `import.meta.dirname`, no `new URL(..., import.meta.url)` (convención del repo).

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_FIXTURES = join(RAIZ, 'test', 'fixtures', 'gml')

/**
 * Lee un GML decodificándolo con el encoding que el propio fichero DECLARA: los
 * del WFS vienen en ISO-8859-1 y leerlos como UTF-8 llenaría de U+FFFD los
 * comentarios acentuados del Catastro.
 */
function leerGml(nombre) {
  const bytes = readFileSync(join(DIR_FIXTURES, nombre))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

/** Documento XML de un fixture, por nombre de fichero. */
const docDe = (nombre) =>
  new JSDOM(leerGml(nombre), { contentType: 'text/xml' }).window.document

/** Todos los elementos de un documento con un `localName` dado. */
const porNombre = (doc, local) =>
  [...doc.querySelectorAll('*')].filter((el) => el.localName === local)

/**
 * El `gml:id` del único elemento con ese `localName`. Se exige que sea único: si
 * un fixture futuro trajera dos, este helper avisa en vez de coger uno al azar.
 */
function idDe(doc, local) {
  const encontrados = porNombre(doc, local)
    .map((el) => el.getAttributeNS(NS.gml, 'id'))
    .filter((id) => typeof id === 'string' && id.length > 0)
  expect(encontrados, `se esperaba UN solo ${local} con gml:id`).toHaveLength(1)
  return encontrados[0]
}

/** Texto de los elementos con ese `localName`, sea cual sea su namespace. */
const textosDe = (doc, local) =>
  porNombre(doc, local)
    .map((el) => el.textContent.trim())
    .filter((t) => t.length > 0)

const NOMBRE_CP40 = 'cp_parcela_9398516VK3799G.gml'
const NOMBRE_UTM1 = 'UTM_1.gml'

const CP40 = docDe(NOMBRE_CP40)
const UTM1 = docDe(NOMBRE_UTM1)

// ── Verdad-terreno: lo que HAY escrito en el GML del Catastro ────────────────

/** Los cuatro `gml:id` del fixture 4.0, cada uno buscado por su elemento. */
const ID_FIXTURE = Object.freeze({
  parcela: idDe(CP40, 'CadastralParcel'),
  multiSurface: idDe(CP40, 'MultiSurface'),
  surface: idDe(CP40, 'Surface'),
  puntoReferencia: idDe(CP40, 'Point'),
})

/** La identidad INSPIRE del fixture 4.0: de su `inspireId`, no de la memoria. */
const NS_FIXTURE = textosDe(CP40, 'namespace')[0]
const REFCAT_FIXTURE = textosDe(CP40, 'localId')[0]

/** La del alta de un particular (CP 3.0), que usa el OTRO namespace. */
const NS_UTM1 = textosDe(UTM1, 'namespace')[0]
const REFCAT_UTM1 = textosDe(UTM1, 'localId')[0]

/** Todas las referencias catastrales REALES que hay en los fixtures del disco. */
const FIXTURES = readdirSync(DIR_FIXTURES)
  .filter((n) => n.toLowerCase().endsWith('.gml'))
  .sort()
const REFCATS = [...new Set(FIXTURES.flatMap((n) => textosDe(docDe(n), 'localId')))].sort()
const NAMESPACES = [...new Set(FIXTURES.flatMap((n) => textosDe(docDe(n), 'namespace')))].sort()

// ── Oráculo independiente de validez ─────────────────────────────────────────

/** Documento vacío que solo se usa como validador de nombres XML. */
const ORACULO = new JSDOM('<a/>', { contentType: 'text/xml' }).window.document

/**
 * ¿Es `id` un NCName válido? Se responde SIN mirar el módulo: se le pide al
 * parser de XML de jsdom que cree un elemento con ese nombre (lanza
 * `InvalidCharacterError` si no es un Name de XML) y, como un Name sí admite los
 * dos puntos y un NCName no, se comprueba además que no los lleva.
 */
function esNcName(id) {
  if (typeof id !== 'string' || id.includes(':')) return false
  try {
    ORACULO.createElement(id)
    return true
  } catch {
    return false
  }
}

describe('test/gml/ids · el oráculo de nombres XML no es complaciente', () => {
  it('acepta los ids del fixture y rechaza la referencia catastral desnuda', () => {
    // Si esto fallara, todas las comprobaciones que usan `esNcName` serían humo.
    for (const id of Object.values(ID_FIXTURE)) expect(esNcName(id)).toBe(true)
    expect(esNcName(REFCAT_FIXTURE)).toBe(false) // empieza por dígito
    expect(esNcName('')).toBe(false)
    expect(esNcName(`${PREFIJO_ID.surface}${ID_FIXTURE.parcela}:1`)).toBe(false) // dos puntos
  })
})

// ── toXmlId ──────────────────────────────────────────────────────────────────

describe('gml/ids · toXmlId — de cualquier cadena a un NCName', () => {
  it('no toca lo que ya es un NCName: los cuatro ids del fixture salen idénticos', () => {
    for (const [clave, id] of Object.entries(ID_FIXTURE)) {
      const salida = toXmlId(id)
      expect(salida.id, clave).toBe(id)
      // Caso normal del round-trip: nada que contar, lista VACÍA.
      expect(salida.detecciones, clave).toEqual([])
    }
  })

  it('salva la RC desnuda, que es el error de rechazo «gml:id por dígito»', () => {
    // Las referencias son las REALES de los fixtures, no inventadas.
    const porDigito = REFCATS.filter((rc) => /^\d/.test(rc))
    expect(porDigito.length, 'ninguna referencia del disco empieza por dígito').toBeGreaterThan(0)

    for (const rc of porDigito) {
      const { id, detecciones } = toXmlId(rc)
      expect(id, rc).toBe(`${CARACTER_SUSTITUTO}${rc}`)
      expect(esNcName(id), rc).toBe(true)
      expect(detecciones, rc).toHaveLength(1)
      expect(detecciones[0].tipo).toBe(TIPO_GML.ID_SANEADO)
      expect(detecciones[0].datos.motivos).toContain(MOTIVO_SANEADO.PREFIJADO)
    }
  })

  it('sustituye lo que un NCName no admite: espacios, dos puntos, barras…', () => {
    const limpio = ID_FIXTURE.parcela
    const sucio = `${limpio.slice(0, 4)} ${limpio.slice(4)}:1/2`
    const { id, detecciones } = toXmlId(sucio)

    expect(esNcName(id)).toBe(true)
    expect(id).not.toContain(' ')
    expect(id).not.toContain(':')
    expect(id).not.toContain('/')
    expect(detecciones[0].datos.motivos).toContain(MOTIVO_SANEADO.SUSTITUIDO)
  })

  it('conserva el punto y el guion, que un NCName SÍ admite (el fixture los usa)', () => {
    // El id del fixture está lleno de puntos: si el saneado los tocara, el
    // round-trip se rompería sin que nadie lo notara hasta la Sede.
    expect(ID_FIXTURE.parcela).toContain(SEPARADOR_ID)
    expect(toXmlId(`${ID_FIXTURE.parcela}-b`).detecciones).toEqual([])
  })

  it('recorta los espacios de los extremos y lo dice', () => {
    const { id, detecciones } = toXmlId(`  ${ID_FIXTURE.parcela}\n`)
    expect(id).toBe(ID_FIXTURE.parcela)
    expect(detecciones).toHaveLength(1)
    expect(detecciones[0].datos.motivos).toContain(MOTIVO_SANEADO.RECORTADO)
  })

  it('nunca devuelve un id vacío: un xsd:ID vacío no identifica nada', () => {
    for (const nada of ['', '   ', '\t\n']) {
      const { id, detecciones } = toXmlId(nada)
      expect(id).toBe(CARACTER_SUSTITUTO)
      expect(esNcName(id)).toBe(true)
      expect(detecciones[0].datos.motivos).toContain(MOTIVO_SANEADO.VACIO)
    }
  })

  it('la detección es una DeteccionGml de tipo ID_SANEADO, con el antes y el después', () => {
    const bruto = ` ${REFCAT_FIXTURE}`
    const { id, detecciones } = toXmlId(bruto)
    expect(detecciones).toHaveLength(1)
    const det = detecciones[0]
    expect(det.tipo).toBe(TIPO_GML.ID_SANEADO)
    expect(det.severidad).toBe(SEVERIDAD.AVISO)
    expect(det.mensaje).toContain(bruto.trim())
    expect(det.mensaje).toContain(id)
    expect(det.datos).toEqual({
      bruto,
      id,
      motivos: [MOTIVO_SANEADO.RECORTADO, MOTIVO_SANEADO.PREFIJADO],
    })
  })

  it('lanza TypeError si no le dan un string (contrato roto por el programador)', () => {
    for (const malo of [null, undefined, 42, {}, ['a']]) {
      expect(() => toXmlId(malo)).toThrow(TypeError)
    }
  })
})

// ── idsDeParcela: el fixture, clavado ────────────────────────────────────────

describe('gml/ids · idsDeParcela — los cuatro ids del GML real', () => {
  const { ids, detecciones } = idsDeParcela({
    namespaceInspire: NS_FIXTURE,
    refcat: REFCAT_FIXTURE,
    nSurfaces: 1,
  })

  it('reproduce los CUATRO gml:id del fixture, carácter a carácter', () => {
    // La definición de «hecho» de esta tarea. Los valores de la derecha se han
    // leído del fichero del Catastro; si esto falla no se «arregla» el test:
    // se corrige el módulo (regla de oro 8).
    expect(ids.parcela).toBe(ID_FIXTURE.parcela)
    expect(ids.multiSurface).toBe(ID_FIXTURE.multiSurface)
    expect(ids.surfaces).toEqual([ID_FIXTURE.surface])
    expect(ids.puntoReferencia).toBe(ID_FIXTURE.puntoReferencia)
  })

  it('no tiene nada que contar: con la identidad del Catastro no se sanea nada', () => {
    expect(detecciones).toEqual([])
  })

  it('la base es «<namespace>.<refcat>», los dos leídos del inspireId del fixture', () => {
    expect(ids.parcela).toBe(`${NS_FIXTURE}${SEPARADOR_ID}${REFCAT_FIXTURE}`)
    expect(NS_FIXTURE).toBe(NAMESPACE_INSPIRE_CATASTRO)
  })

  it('⚠️ ASIMETRÍA: el fixture NO numera el MultiSurface y SÍ numera el Surface', () => {
    // Primero, el testigo: que el fichero real es así de asimétrico.
    expect(ID_FIXTURE.multiSurface).toBe(`${PREFIJO_ID.multiSurface}${ID_FIXTURE.parcela}`)
    expect(ID_FIXTURE.surface).toBe(
      `${PREFIJO_ID.surface}${ID_FIXTURE.parcela}${SEPARADOR_ID}${BASE_NUMERACION_SURFACE}`,
    )
    expect(new RegExp(`\\${SEPARADOR_ID}\\d+$`).test(ID_FIXTURE.multiSurface)).toBe(false)
    expect(new RegExp(`\\${SEPARADOR_ID}\\d+$`).test(ID_FIXTURE.surface)).toBe(true)
    // Y después, que el módulo la reproduce en vez de «arreglarla».
    expect(SUFIJO_MULTISURFACE).toBe('')
    expect(ids.multiSurface.endsWith(ids.parcela)).toBe(true)
    const mismaBase = ids.multiSurface.replace(PREFIJO_ID.multiSurface, PREFIJO_ID.surface)
    expect(ids.surfaces[0]).toBe(`${mismaBase}${SEPARADOR_ID}1`)
  })

  it('los prefijos de tipo son los del fichero, no unos parecidos', () => {
    // Se derivan quitándole al id su base: lo que sobra ES el prefijo.
    const prefijoDe = (id) => id.slice(0, id.indexOf(ID_FIXTURE.parcela))
    expect(prefijoDe(ID_FIXTURE.multiSurface)).toBe(PREFIJO_ID.multiSurface)
    expect(prefijoDe(ID_FIXTURE.surface)).toBe(PREFIJO_ID.surface)
    expect(prefijoDe(ID_FIXTURE.puntoReferencia)).toBe(PREFIJO_ID.puntoReferencia)
  })

  it('HALLAZGO: el generador del particular NO numera su Surface; se sigue al Catastro', () => {
    // `UTM_1.gml` es CP 3.0 y otro generador: su `Surface` no lleva el `.1`. Se
    // deja constancia para que nadie «unifique» los dos criterios: el dialecto
    // que este proyecto emite es el 4.0 del WFS, y ahí el `.1` está.
    const surfaceUtm1 = idDe(UTM1, 'Surface')
    expect(new RegExp(`\\${SEPARADOR_ID}\\d+$`).test(surfaceUtm1)).toBe(false)
    expect(new RegExp(`\\${SEPARADOR_ID}\\d+$`).test(ID_FIXTURE.surface)).toBe(true)
  })
})

describe('gml/ids · idsDeParcela — namespace INSPIRE', () => {
  it('por defecto usa el del alta de un particular, que es el de UTM_1.gml', () => {
    expect(NAMESPACE_INSPIRE_DEFECTO).toBe(NS_UTM1)
    const { ids } = idsDeParcela({ refcat: REFCAT_UTM1 })
    expect(ids.parcela).toBe(idDe(UTM1, 'CadastralParcel'))
  })

  it('reproduce también los ids del alta de particular (namespace ES.LOCAL.CP)', () => {
    const { ids, detecciones } = idsDeParcela({
      namespaceInspire: NS_UTM1,
      refcat: REFCAT_UTM1,
    })
    expect(ids.multiSurface).toBe(idDe(UTM1, 'MultiSurface'))
    expect(detecciones).toEqual([])
    // La referencia del particular trae cargo e inmueble: 20 caracteres frente a
    // los 14 de la parcela del WFS. La composición es la misma.
    expect(REFCAT_UTM1.length).toBeGreaterThan(REFCAT_FIXTURE.length)
  })

  it('sin namespace, la base sería la RC desnuda: se salva y se DICE (regla de oro 10)', () => {
    const { ids, detecciones } = idsDeParcela({ namespaceInspire: '', refcat: REFCAT_FIXTURE })

    // 1) El id de la parcela ya no empieza por dígito…
    expect(/^[A-Za-z_]/.test(ids.parcela)).toBe(true)
    expect(esNcName(ids.parcela)).toBe(true)
    expect(ids.parcela).toContain(REFCAT_FIXTURE) // …y sigue identificando a la parcela.

    // 2) …y el cambio no fue silencioso.
    expect(detecciones).toHaveLength(1)
    expect(detecciones[0].tipo).toBe(TIPO_GML.ID_SANEADO)
    expect(detecciones[0].datos.motivos).toContain(MOTIVO_SANEADO.PREFIJADO)

    // 3) Los otros tres no necesitan saneado: su prefijo de tipo ya es una letra.
    //    Por eso la detección es UNA y no cuatro.
    expect(ids.multiSurface).toBe(`${PREFIJO_ID.multiSurface}${REFCAT_FIXTURE}`)
    expect(ids.puntoReferencia).toBe(`${PREFIJO_ID.puntoReferencia}${REFCAT_FIXTURE}`)
  })
})

describe('gml/ids · idsDeParcela — invariantes de xsd:ID', () => {
  /** Todas las combinaciones reales del disco: cada namespace × cada referencia. */
  const CASOS = NAMESPACES.flatMap((ns) =>
    REFCATS.map((refcat) => ({ namespaceInspire: ns, refcat })),
  ).concat(REFCATS.map((refcat) => ({ namespaceInspire: '', refcat })))

  it('hay casos que probar, y salen de los fixtures', () => {
    expect(NAMESPACES.length).toBeGreaterThanOrEqual(2)
    expect(REFCATS.length).toBeGreaterThanOrEqual(2)
    expect(CASOS.length).toBe(NAMESPACES.length * REFCATS.length + REFCATS.length)
  })

  it('NINGÚN id generado empieza por dígito, para ninguna entrada real', () => {
    for (const caso of CASOS) {
      const { ids } = idsDeParcela({ ...caso, nSurfaces: 3 })
      for (const id of [ids.parcela, ids.multiSurface, ...ids.surfaces, ids.puntoReferencia]) {
        expect(/^\d/.test(id), `${JSON.stringify(caso)} → ${id}`).toBe(false)
        expect(/^[A-Za-z_]/.test(id), `${JSON.stringify(caso)} → ${id}`).toBe(true)
      }
    }
  })

  it('todos los ids son NCName válidos según el oráculo, no según el módulo', () => {
    for (const caso of CASOS) {
      const { ids } = idsDeParcela({ ...caso, nSurfaces: 2 })
      for (const id of [ids.parcela, ids.multiSurface, ...ids.surfaces, ids.puntoReferencia]) {
        expect(esNcName(id), `${JSON.stringify(caso)} → ${id}`).toBe(true)
      }
    }
  })

  it('los ids de un mismo documento son ÚNICOS entre sí (xsd:ID lo exige)', () => {
    for (const caso of CASOS) {
      for (const nSurfaces of [1, 2, 5]) {
        const { ids } = idsDeParcela({ ...caso, nSurfaces })
        const todos = [ids.parcela, ids.multiSurface, ...ids.surfaces, ids.puntoReferencia]
        expect(new Set(todos).size, `${JSON.stringify(caso)} ×${nSurfaces}`).toBe(todos.length)
      }
    }
  })
})

describe('gml/ids · idsDeParcela — numeración de las superficies', () => {
  it('hoy hay UNA sola: la parcela es un exterior con huecos, no varias caras', () => {
    const { ids } = idsDeParcela({ namespaceInspire: NS_FIXTURE, refcat: REFCAT_FIXTURE })
    expect(ids.surfaces).toHaveLength(1)
    expect(ids.surfaces[0]).toBe(ID_FIXTURE.surface)
  })

  it('la numeración empieza en 1 y es correlativa (definida para F08, no usada hoy)', () => {
    const n = 4
    const { ids, detecciones } = idsDeParcela({
      namespaceInspire: NS_FIXTURE,
      refcat: REFCAT_FIXTURE,
      nSurfaces: n,
    })
    expect(ids.surfaces).toHaveLength(n)
    expect(ids.surfaces[0]).toBe(ID_FIXTURE.surface) // la primera SIGUE siendo la del fixture
    ids.surfaces.forEach((id, i) => {
      expect(id).toBe(
        `${PREFIJO_ID.surface}${ids.parcela}${SEPARADOR_ID}${BASE_NUMERACION_SURFACE + i}`,
      )
    })
    expect(detecciones).toEqual([])
  })
})

describe('gml/ids · idsDeParcela — contrato', () => {
  it('lanza TypeError si el namespace, la referencia o nSurfaces no son del tipo debido', () => {
    expect(() => idsDeParcela({ namespaceInspire: 1, refcat: REFCAT_FIXTURE })).toThrow(TypeError)
    expect(() => idsDeParcela({ refcat: null })).toThrow(TypeError)
    expect(() => idsDeParcela({})).toThrow(TypeError)
    expect(() => idsDeParcela()).toThrow(TypeError)
    expect(() => idsDeParcela({ refcat: REFCAT_FIXTURE, nSurfaces: 1.5 })).toThrow(TypeError)
    expect(() => idsDeParcela({ refcat: REFCAT_FIXTURE, nSurfaces: '1' })).toThrow(TypeError)
  })

  it('lanza RangeError sin referencia catastral: la identidad no se inventa aquí', () => {
    expect(() => idsDeParcela({ refcat: '' })).toThrow(RangeError)
    expect(() => idsDeParcela({ refcat: '   ' })).toThrow(RangeError)
  })

  it('lanza RangeError con menos de una superficie', () => {
    expect(() => idsDeParcela({ refcat: REFCAT_FIXTURE, nSurfaces: 0 })).toThrow(RangeError)
    expect(() => idsDeParcela({ refcat: REFCAT_FIXTURE, nSurfaces: -1 })).toThrow(RangeError)
  })

  it('es puro: dos llamadas iguales dan lo mismo, y el resultado no se comparte', () => {
    const args = { namespaceInspire: NS_FIXTURE, refcat: REFCAT_FIXTURE }
    const a = idsDeParcela(args)
    const b = idsDeParcela(args)
    expect(a.ids).toEqual(b.ids)
    expect(a.ids).not.toBe(b.ids)
    expect(a.ids.surfaces).not.toBe(b.ids.surfaces)
  })
})

describe('gml/ids · el módulo no lee el reloj', () => {
  it('gml/ids.js ni instancia fechas ni pide la marca actual', () => {
    // Misma vigilancia que en `gml/_comun.js`: el snapshot del GML generado tiene
    // que salir igual en cada ejecución, así que `gml/` es función pura de sus
    // entradas. Se comprueba sobre el TEXTO del módulo, que es donde se ve.
    const fuente = readFileSync(join(RAIZ, 'gml', 'ids.js'), 'utf8')
    const INSTANCIA_FECHA = /\bnew\s+Date\b/
    const RELOJ = /\bDate\s*\.\s*now\b/
    expect(INSTANCIA_FECHA.test(fuente), 'gml/ids.js instancia una fecha propia').toBe(false)
    expect(RELOJ.test(fuente), 'gml/ids.js consulta el reloj del sistema').toBe(false)
    // …y los detectores no son vacuos: reconocen las dos formas prohibidas.
    expect(INSTANCIA_FECHA.test('const x = new Date()')).toBe(true)
    expect(RELOJ.test('const t = Date.now()')).toBe(true)
  })
})

/* -------------------------------------------------------------------------- *
 * test/services/catastro-wfs.test.js — F05 · T1B. El dialecto del WFS de       *
 * parcelas del Catastro.                                                       *
 *                                                                              *
 * `services/_catastro-wfs.js` es puro (no hace red), así que TODO lo que este   *
 * fichero afirma sale de ficheros reales del disco: los cinco XML de            *
 * `test/fixtures/catastro/` —respuestas del servicio, capturadas con `curl` el  *
 * 2026-07-27, con su SHA-256 en `PROCEDENCIA.md`—, los GML de                   *
 * `test/fixtures/gml/`, y el propio `PROCEDENCIA.md`, del que se extraen las    *
 * **URL literales que se midieron**. Ni una lista escrita a mano: los           *
 * `exceptionCode`, los textos del CDATA, el número de miembros, el             *
 * `numberMatched`, el catálogo de *stored queries* y hasta los argumentos con   *
 * los que se llama a los constructores de URL se LEEN de los ficheros.          *
 *                                                                              *
 * Las cinco trampas que este fichero existe para clavar:                        *
 *   1. El `ExceptionReport` llega con el namespace POR DEFECTO, sin prefijo: un *
 *      olfateo de `<ows:ExceptionReport` no lo vería jamás.                     *
 *   2. La RegExp solo ELIGE LECTOR. Si el olfato dice «excepción» y el parseo   *
 *      no lo confirma, el resultado es ILEGIBLE, nunca una excepción asumida.   *
 *   3. NO existe la «colección vacía»: una caja sin parcelas y una referencia   *
 *      inexistente devuelven el MISMO `exceptionCode`. Se afirma explícitamente *
 *      leyendo el código de los DOS ficheros, para que quede escrito que no se  *
 *      distinguen — y que está prohibido ramificar sobre el CDATA.              *
 *   4. `numberMatched`/`numberReturned` MIENTEN los dos: 10 miembros, 539       *
 *      declarados. Las dos cifras, leídas del mismo fichero.                    *
 *   5. `GetParcelsByBBox` NO EXISTE. Se comprueba contra el catálogo que        *
 *      publica el propio servicio.                                             *
 *                                                                              *
 * ⚠️ ENCODING: los XML de `catastro/` declaran `ISO-8859-1` y sus bytes son     *
 * UTF-8 (mentira heredada del servicio, documentada en `PROCEDENCIA.md`). Se    *
 * leen SIEMPRE como UTF-8 ignorando la declaración, y hay un test que lo deja   *
 * escrito para que nadie «arregle» los fixtures.                               *
 *                                                                              *
 * Proyecto Vitest `node` (sin sufijo `.dom`): aquí no hay DOM, ni red, ni       *
 * Leaflet. `DOMParser` tampoco existe: el lector XML es el propio del proyecto. *
 * -------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'

import {
  CATASTRO_WFS_CP,
  CODIGO_CAJON_DE_SASTRE,
  CONSULTAS_ALMACENADAS,
  COUNT_BBOX_DEFECTO,
  NS_OWS_1_1,
  TIPO_PARCELA_WFS,
  TIPO_RESPUESTA_WFS,
  esExceptionReport,
  leerColeccion,
  leerExceptionReport,
  srsWfs,
  urlBbox,
  urlGetNeighbourParcel,
  urlGetParcel,
} from '../../services/_catastro-wfs.js'
import { HUSOS_VALIDOS, srsPorHuso } from '../../geo/huso.js'
import { TIPO_GML } from '../../gml/_comun.js'

// ── Arnés: los ficheros del disco, leídos como UTF-8 ─────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_CATASTRO = join(RAIZ, 'test', 'fixtures', 'catastro')
const DIR_GML = join(RAIZ, 'test', 'fixtures', 'gml')
const FUENTE_MODULO = join(RAIZ, 'services', '_catastro-wfs.js')

/** UTF-8 SIEMPRE, ignorando la declaración del prólogo (ver cabecera). */
const leer = (dir, nombre) => readFileSync(join(dir, nombre), 'utf8')

const EXC_RC_INEXISTENTE = leer(DIR_CATASTRO, 'wfs-exceptionreport-rc-inexistente.xml')
const EXC_BBOX_VACIO = leer(DIR_CATASTRO, 'wfs-bbox-vacio-mar.xml')
const BBOX_COUNT10 = leer(DIR_CATASTRO, 'wfs-bbox-count10.xml')
const VECINDAD = leer(DIR_CATASTRO, 'wfs-neighbour-9398516VK3799G.xml')
const CATALOGO_XML = leer(DIR_CATASTRO, 'wfs-describestoredqueries.xml')
const PROCEDENCIA = leer(DIR_CATASTRO, 'PROCEDENCIA.md')

const GML_PARCELA = leer(DIR_GML, 'cp_parcela_9398516VK3799G.gml')
const GML_EDIFICIO = leer(DIR_GML, 'bu_building_9398516VK3799G.gml')

// ── Oráculos independientes: RegExp sobre el TEXTO CRUDO ─────────────────────
// No se usa el lector XML del proyecto para extraer la verdad-terreno: sería el
// mismo código que está bajo prueba. Un barrido de texto sobre ficheros de 300 B
// a 26 kB es suficiente y no comparte ni una línea con el módulo.

/** Todas las apariciones del grupo 1 de un patrón global. */
const todas = (texto, re) => [...texto.matchAll(re)].map((m) => m[1])

/** El primer `exceptionCode` del documento. */
const codigoDe = (texto) => /exceptionCode="([^"]+)"/.exec(texto)[1]

/** El primer contenido de CDATA del documento, íntegro. */
const cdataDe = (texto) => /<!\[CDATA\[([\s\S]*?)\]\]>/.exec(texto)[1]

/** Cuántos `<member>` trae el documento. Es EL número: contar es contar. */
const miembrosDe = (texto) => (texto.match(/<member>/g) ?? []).length

/** Un atributo de la raíz WFS, tal cual. */
const atributoRaiz = (texto, nombre) =>
  new RegExp(`${nombre}="([^"]*)"`).exec(texto)?.[1] ?? null

/**
 * Las referencias catastrales que trae el documento, en orden. El `<` inicial no
 * es decorativo: sin él, el patrón casaría también la etiqueta de CIERRE y
 * devolvería el sangrado de la línea siguiente entre cada referencia.
 */
const refcatsDe = (texto) => todas(texto, /<cp:nationalCadastralReference>([^<]*)</g)

// ── Las URL que SE MIDIERON, extraídas de PROCEDENCIA.md ─────────────────────
// `PROCEDENCIA.md` es la documentación de la captura: cada fixture lleva anotada
// la URL exacta con la que se pidió, entre comillas invertidas. De ahí salen los
// ARGUMENTOS con los que se llama a los constructores de este módulo y el
// resultado que tienen que reproducir. No hay ninguna URL tecleada en este test.

/** Query string de una URL como objeto plano `{nombre: valor}`. */
const parametros = (u) => Object.fromEntries(new URL(u).searchParams)

/** `'EPSG::25830'` (query string) → `'EPSG:25830'` (forma corta del modelo). */
const aFormaCorta = (srsPeticion) => srsPeticion.replace('::', ':')

const URLS_MEDIDAS = todas(PROCEDENCIA, /`(https:\/\/[^`\s]+)`/g).filter((u) =>
  u.startsWith(`${CATASTRO_WFS_CP}?`),
)

const MEDIDAS = URLS_MEDIDAS.map((u) => ({ url: u, p: parametros(u) }))
const MEDIDA_PARCELA = MEDIDAS.find((m) => m.p.STOREDQUERIE_ID === CONSULTAS_ALMACENADAS.PARCELA)
const MEDIDA_VECINDAD = MEDIDAS.find((m) => m.p.STOREDQUERIE_ID === CONSULTAS_ALMACENADAS.VECINDAD)
const MEDIDAS_BBOX = MEDIDAS.filter((m) => 'bbox' in m.p)

/** `'439000,4479400,439600,4480000,EPSG::25830'` → `{bbox, srs}` de este módulo. */
function desmontarBbox(valor) {
  const trozos = valor.split(',')
  const [minX, minY, maxX, maxY] = trozos.slice(0, 4).map(Number)
  return { bbox: { minX, minY, maxX, maxY }, srs: aFormaCorta(trozos[4]) }
}

// ── El catálogo de *stored queries*, dicho por el servicio ───────────────────

const IDS_CATALOGO = todas(CATALOGO_XML, /<StoredQueryDescription\s+id="([^"]+)"/g)

// ─────────────────────────────────────────────────────────────────────────────

describe('services/_catastro-wfs · el arnés lee ficheros de verdad (anti-vacuidad)', () => {
  it('los fixtures del Catastro están todos, y son los que documenta PROCEDENCIA.md', () => {
    const enDisco = readdirSync(DIR_CATASTRO)
      .filter((n) => n.toLowerCase().endsWith('.xml'))
      .sort()
    expect(enDisco.length, 'no hay fixtures XML del WFS que mirar').toBeGreaterThan(0)
    for (const nombre of enDisco) {
      expect(PROCEDENCIA, `${nombre} no tiene procedencia documentada`).toContain(nombre)
    }
  })

  it('los XML declaran ISO-8859-1 y sus bytes son UTF-8 (la mentira del servicio)', () => {
    // Si alguien «arregla» el fixture, este test cae y se entera. La declaración
    // se lee tal cual; los acentos se comprueban decodificando como UTF-8, que es
    // lo que hace `leer` y lo contrario de lo que el prólogo pide.
    expect(/encoding="ISO-8859-1"/i.test(VECINDAD)).toBe(true)
    expect(VECINDAD).toContain('precisión')
    expect(VECINDAD).toContain('cartografía')
  })

  it('de PROCEDENCIA.md se extraen las URL medidas de las tres peticiones que este módulo construye', () => {
    expect(URLS_MEDIDAS.length, 'no se ha extraído ninguna URL del WFS').toBeGreaterThan(0)
    expect(MEDIDA_PARCELA, 'falta la URL medida de GetParcel').toBeDefined()
    expect(MEDIDA_VECINDAD, 'falta la URL medida de GetNeighbourParcel').toBeDefined()
    expect(MEDIDAS_BBOX.length, 'falta alguna URL medida con bbox').toBeGreaterThan(0)
  })
})

describe('services/_catastro-wfs · constantes del servicio', () => {
  it('CATASTRO_WFS_CP es el prefijo de TODAS las URL medidas (punto único de contingencia CORS)', () => {
    expect(CATASTRO_WFS_CP).toBe('https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx')
    for (const { url } of MEDIDAS) expect(url.startsWith(`${CATASTRO_WFS_CP}?`)).toBe(true)
  })

  it('CONSULTAS_ALMACENADAS es un SUBCONJUNTO del catálogo que publica el servicio', () => {
    expect(IDS_CATALOGO.length, 'no se ha leído ninguna stored query del fixture').toBeGreaterThan(0)
    const usadas = Object.values(CONSULTAS_ALMACENADAS)
    expect(usadas.length, 'el módulo no declara ninguna consulta almacenada').toBeGreaterThan(0)
    for (const id of usadas) {
      expect(IDS_CATALOGO, `la stored query «${id}» no existe en el servicio`).toContain(id)
    }
  })

  it('⛔ «GetParcelsByBBox» NO EXISTE en el catálogo del servicio (anti-vacuidad del test anterior)', () => {
    // Sin esta mitad, un módulo que no usara NINGUNA consulta pasaría el subconjunto.
    // La spec de F05 nombra `getParcelsByBBox` en una enumeración donde las demás
    // sí tienen su stored query: la simetría invita a buscar un id que no existe.
    expect(IDS_CATALOGO).not.toContain('GetParcelsByBBox')
    expect(Object.values(CONSULTAS_ALMACENADAS)).not.toContain('GetParcelsByBBox')
  })

  it('CONSULTAS_ALMACENADAS y TIPO_RESPUESTA_WFS están congelados', () => {
    expect(Object.isFrozen(CONSULTAS_ALMACENADAS)).toBe(true)
    expect(Object.isFrozen(TIPO_RESPUESTA_WFS)).toBe(true)
  })

  it('COUNT_BBOX_DEFECTO es el `count` con el que se midió, y coincide con los miembros del fixture', () => {
    // Doble amarre: el parámetro de la URL medida y los `<member>` que trajo.
    const countMedido = Number(MEDIDAS_BBOX.find((m) => 'count' in m.p).p.count)
    expect(COUNT_BBOX_DEFECTO).toBe(countMedido)
    expect(COUNT_BBOX_DEFECTO).toBe(miembrosDe(BBOX_COUNT10))
  })
})

describe('services/_catastro-wfs · srsWfs — el DOBLE dos puntos, y la validación delegada', () => {
  it('traduce la forma corta del modelo a la del query string, para los tres husos', () => {
    for (const zona of HUSOS_VALIDOS) {
      const corto = srsPorHuso(zona) // 'EPSG:258xx'
      expect(srsWfs(corto)).toBe(`EPSG::${corto.slice('EPSG:'.length)}`)
    }
  })

  it('lo que devuelve es EXACTAMENTE el `srsname` de cada petición medida', () => {
    // `DescribeStoredQueries` no lleva `srsname` (no consulta geometría): se
    // recorren solo las que sí lo traían, y se exige que hubiera alguna.
    const conSrs = MEDIDAS.filter((m) => 'srsname' in m.p)
    expect(conSrs.length, 'ninguna petición medida traía srsname').toBeGreaterThan(0)
    for (const { p } of conSrs) {
      expect(srsWfs(aFormaCorta(p.srsname))).toBe(p.srsname)
    }
  })

  it('NO acepta la forma del query string como entrada (no es idempotente a propósito)', () => {
    expect(() => srsWfs('EPSG::25830')).toThrow(RangeError)
  })

  it('DELEGA la validación en geo/huso.js#husoPorSrs (no duplica la lista de husos)', () => {
    // El mensaje lo firma `husoPorSrs`: si algún día alguien copiara aquí la lista
    // de husos soportados, este test caería y habría dos verdades que sincronizar.
    expect(() => srsWfs('EPSG:32628')).toThrow(/husoPorSrs/)
    expect(() => srsWfs('EPSG:32628')).toThrow(RangeError) // Canarias, DIFERIDA (O13)
    expect(() => srsWfs(25830)).toThrow(TypeError)
    expect(() => srsWfs(null)).toThrow(TypeError)
  })
})

describe('services/_catastro-wfs · las URL reproducen las peticiones MEDIDAS', () => {
  it('urlGetParcel reproduce la petición GetParcel medida, parámetro a parámetro', () => {
    const { p, url: medida } = MEDIDA_PARCELA
    const generada = urlGetParcel(p.refcat, aFormaCorta(p.srsname))
    expect(parametros(generada)).toEqual(p)
    expect(new URL(generada).origin + new URL(generada).pathname).toBe(
      new URL(medida).origin + new URL(medida).pathname,
    )
  })

  it('urlGetNeighbourParcel reproduce la petición GetNeighbourParcel medida', () => {
    const { p } = MEDIDA_VECINDAD
    expect(parametros(urlGetNeighbourParcel(p.refcat, aFormaCorta(p.srsname)))).toEqual(p)
  })

  it('urlBbox reproduce TODAS las peticiones con bbox medidas (la buena y la del mar)', () => {
    expect(MEDIDAS_BBOX.length).toBeGreaterThan(1)
    for (const { p } of MEDIDAS_BBOX) {
      const { bbox, srs } = desmontarBbox(p.bbox)
      expect(parametros(urlBbox(bbox, srs, { count: Number(p.count) }))).toEqual(p)
    }
  })

  it('el BBOX NO es una stored query: sin STOREDQUERIE_ID, con typenames y bbox', () => {
    const { p } = MEDIDAS_BBOX[0]
    const { bbox, srs } = desmontarBbox(p.bbox)
    const q = new URL(urlBbox(bbox, srs)).searchParams
    expect(q.get('STOREDQUERIE_ID')).toBeNull()
    expect(q.get('typenames')).toBe(TIPO_PARCELA_WFS)
    expect(q.get('bbox')).toBe(`${bbox.minX},${bbox.minY},${bbox.maxX},${bbox.maxY},${srsWfs(srs)}`)
    // El SRS va DOS veces y en la misma forma: suelto y como 5º componente del bbox.
    expect(q.get('srsname')).toBe(srsWfs(srs))
    expect(q.get('count')).toBe(String(COUNT_BBOX_DEFECTO))
  })

  it('las stored queries SÍ llevan STOREDQUERIE_ID, y su valor está en el catálogo del servicio', () => {
    const srs = srsPorHuso(HUSOS_VALIDOS[0])
    for (const u of [urlGetParcel('9398516VK3799G', srs), urlGetNeighbourParcel('9398516VK3799G', srs)]) {
      const id = new URL(u).searchParams.get('STOREDQUERIE_ID')
      expect(id).not.toBeNull()
      expect(IDS_CATALOGO).toContain(id)
    }
  })

  it('el refcat va percent-encoded: un valor hostil no puede añadir parámetros', () => {
    const q = new URL(urlGetParcel('A&count=999', 'EPSG:25830')).searchParams
    expect(q.get('refcat')).toBe('A&count=999')
    expect(q.get('count')).toBeNull()
    expect([...q.keys()]).toEqual(['service', 'version', 'request', 'STOREDQUERIE_ID', 'refcat', 'srsname'])
  })

  it('un refcat legítimo sobrevive intacto a la codificación', () => {
    const refcat = refcatsDe(GML_PARCELA)[0]
    expect(new URL(urlGetParcel(refcat, 'EPSG:25830')).searchParams.get('refcat')).toBe(refcat)
  })
})

describe('services/_catastro-wfs · contrato roto por el PROGRAMADOR → excepción', () => {
  it('un refcat que no es string no vacío lanza TypeError', () => {
    for (const malo of [undefined, null, 42, {}, [], '']) {
      expect(() => urlGetParcel(malo, 'EPSG:25830')).toThrow(TypeError)
      expect(() => urlGetNeighbourParcel(malo, 'EPSG:25830')).toThrow(TypeError)
    }
  })

  it('un srs inválido lanza, en las tres funciones de URL', () => {
    const bbox = { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    expect(() => urlGetParcel('X', 'EPSG:4326')).toThrow(RangeError)
    expect(() => urlGetNeighbourParcel('X', 'EPSG:4326')).toThrow(RangeError)
    expect(() => urlBbox(bbox, 'EPSG:4326')).toThrow(RangeError)
    expect(() => urlGetParcel('X')).toThrow(TypeError) // srs OBLIGATORIO: el huso no se adivina
  })

  it('un BBOX degenerado o invertido lanza RangeError, y uno no numérico TypeError', () => {
    const srs = 'EPSG:25830'
    const base = { minX: 439000, minY: 4479400, maxX: 439600, maxY: 4480000 }
    expect(() => urlBbox({ ...base, maxX: base.minX }, srs)).toThrow(RangeError) // degenerado en X
    expect(() => urlBbox({ ...base, maxY: base.minY }, srs)).toThrow(RangeError) // degenerado en Y
    expect(() => urlBbox({ ...base, minX: base.maxX + 1 }, srs)).toThrow(RangeError) // invertido
    expect(() => urlBbox({ ...base, minY: Number.NaN }, srs)).toThrow(TypeError)
    expect(() => urlBbox([439000, 4479400, 439600, 4480000], srs)).toThrow(TypeError)
    expect(() => urlBbox(null, srs)).toThrow(TypeError)
  })

  it('un count que no es entero ≥ 1 lanza', () => {
    const bbox = { minX: 0, minY: 0, maxX: 1, maxY: 1 }
    expect(() => urlBbox(bbox, 'EPSG:25830', { count: 0 })).toThrow(RangeError)
    expect(() => urlBbox(bbox, 'EPSG:25830', { count: 2.5 })).toThrow(RangeError)
    expect(() => urlBbox(bbox, 'EPSG:25830', { count: '10' })).toThrow(TypeError)
  })

  it('un cuerpo que no es string lanza TypeError en los tres lectores', () => {
    for (const fn of [esExceptionReport, leerExceptionReport, leerColeccion]) {
      expect(() => fn(undefined)).toThrow(TypeError)
      expect(() => fn(Buffer.from('x'))).toThrow(TypeError)
    }
  })
})

describe('services/_catastro-wfs · esExceptionReport — la trampa del namespace por defecto', () => {
  it('reconoce el `<ExceptionReport>` SIN prefijo, que es como lo manda el servicio', () => {
    // La prueba de que la trampa existe: el fixture NO contiene `<ows:` por
    // ninguna parte, y sí declara el namespace de OWS 1.1 como default.
    expect(EXC_RC_INEXISTENTE).not.toContain('<ows:')
    expect(EXC_RC_INEXISTENTE).toContain(`xmlns="${NS_OWS_1_1}"`)
    expect(esExceptionReport(EXC_RC_INEXISTENTE)).toBe(true)
    expect(esExceptionReport(EXC_BBOX_VACIO)).toBe(true)
  })

  it('reconocería también la forma con prefijo (que el servicio no usa hoy)', () => {
    const conPrefijo = EXC_RC_INEXISTENTE.replace(/<(\/?)ExceptionReport/g, '<$1ows:ExceptionReport')
      .replace('xmlns=', 'xmlns:ows=')
    expect(esExceptionReport(conPrefijo)).toBe(true)
  })

  it('no dispara sobre las respuestas buenas', () => {
    for (const cuerpo of [GML_PARCELA, VECINDAD, BBOX_COUNT10, CATALOGO_XML, '']) {
      expect(esExceptionReport(cuerpo)).toBe(false)
    }
  })

  it('no guarda estado entre llamadas (la RegExp no lleva bandera `g`)', () => {
    expect(esExceptionReport(EXC_RC_INEXISTENTE)).toBe(true)
    expect(esExceptionReport(EXC_RC_INEXISTENTE)).toBe(true)
    expect(esExceptionReport(EXC_RC_INEXISTENTE)).toBe(true)
  })
})

describe('services/_catastro-wfs · la RegExp solo ELIGE LECTOR, nunca interpreta', () => {
  it('olfato positivo + raíz que NO es un ExceptionReport de OWS 1.1 → ILEGIBLE, no excepción asumida', () => {
    // Mismo documento, otro namespace: sigue oliendo a excepción y ya no lo es.
    const otroNs = EXC_RC_INEXISTENTE.replace(NS_OWS_1_1, 'http://www.opengis.net/ows/2.0')
    expect(esExceptionReport(otroNs)).toBe(true)
    const r = leerColeccion(otroNs)
    expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE)
    expect(r.tipo).not.toBe(TIPO_RESPUESTA_WFS.NO_ENCONTRADO)
    expect(r.motivo).toMatch(/ExceptionReport/)
  })

  it('un GML legítimo con la cadena dentro de un COMENTARIO sale ILEGIBLE, no como parcelas', () => {
    // Una RegExp no puede decidir sobre XML, y este es el precio elegido: un falso
    // positivo del olfato produce un resultado VISIBLE y arreglable, jamás una
    // excepción inventada ni una colección silenciosamente vacía.
    const conCebo = GML_PARCELA.replace('<!--Parcela', '<!--<ExceptionReport > Parcela')
    expect(esExceptionReport(conCebo)).toBe(true)
    const r = leerColeccion(conCebo)
    expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE)
    expect(r).not.toHaveProperty('parcelas')
    // Y el original, sin cebo, se lee como lo que es: el cebo es lo único que cambia.
    expect(leerColeccion(GML_PARCELA).tipo).toBe(TIPO_RESPUESTA_WFS.PARCELAS)
  })

  it('un ExceptionReport sin ninguna `Exception` dentro no se da por leído', () => {
    const vacio = EXC_RC_INEXISTENTE.replace(/<Exception [\s\S]*<\/Exception>/, '')
    const r = leerExceptionReport(vacio)
    expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE)
  })
})

describe('services/_catastro-wfs · NO existe la «colección vacía» (la trampa central)', () => {
  const rcInexistente = leerColeccion(EXC_RC_INEXISTENTE)
  const bboxVacio = leerColeccion(EXC_BBOX_VACIO)

  it('la referencia inexistente se lee con su código y su texto ÍNTEGROS', () => {
    expect(rcInexistente.tipo).toBe(TIPO_RESPUESTA_WFS.NO_ENCONTRADO)
    expect(rcInexistente.codigo).toBe(codigoDe(EXC_RC_INEXISTENTE))
    expect(rcInexistente.detalle).toBe(cdataDe(EXC_RC_INEXISTENTE))
    expect(rcInexistente.version).toBe(atributoRaiz(EXC_RC_INEXISTENTE, 'version'))
    expect(rcInexistente.excepciones).toHaveLength(1)
    expect(rcInexistente.erroresXml).toEqual([])
  })

  it('la caja vacía en el mar toma EXACTAMENTE EL MISMO camino', () => {
    expect(bboxVacio.tipo).toBe(TIPO_RESPUESTA_WFS.NO_ENCONTRADO)
    expect(bboxVacio.codigo).toBe(codigoDe(EXC_BBOX_VACIO))
    expect(bboxVacio.detalle).toBe(cdataDe(EXC_BBOX_VACIO))
  })

  it('⚠️ los DOS ficheros declaran el MISMO exceptionCode: el código NO clasifica', () => {
    // Escrito a propósito como una afirmación explícita, leyendo el código de los
    // dos ficheros: «esa referencia no existe» y «no hay nada en esta caja» son
    // indistinguibles para cualquier cliente que mire el `exceptionCode`.
    expect(codigoDe(EXC_RC_INEXISTENTE)).toBe(codigoDe(EXC_BBOX_VACIO))
    expect(codigoDe(EXC_RC_INEXISTENTE)).toBe(CODIGO_CAJON_DE_SASTRE)
    expect(rcInexistente.tipo).toBe(bboxVacio.tipo)
    expect(rcInexistente.codigo).toBe(bboxVacio.codigo)
  })

  it('…y lo ÚNICO que los distingue es el texto libre, que se arrastra sin analizar', () => {
    expect(cdataDe(EXC_RC_INEXISTENTE)).not.toBe(cdataDe(EXC_BBOX_VACIO))
    expect(rcInexistente.detalle).not.toBe(bboxVacio.detalle)
    // Incluida la errata del servicio, transcrita tal cual: «founded», no «found».
    expect(bboxVacio.detalle).toBe(cdataDe(EXC_BBOX_VACIO))
  })

  it('el módulo NO contiene ningún fragmento del texto del CDATA (prohibido ramificar sobre él)', () => {
    // Guardián derivado, no una lista a mano: se trocean los dos mensajes reales
    // en ventanas de cuatro palabras y se exige que NINGUNA aparezca en la fuente
    // del módulo. Quien ramifique sobre el CDATA pegará un trozo del mensaje, y
    // eso es exactamente lo que se rompería el día que el Catastro corrija su
    // errata o traduzca el aviso — y se rompería en verde.
    const fuente = readFileSync(FUENTE_MODULO, 'utf8')
    const ventanas = (frase) => {
      const palabras = frase.trim().split(/\s+/)
      return palabras.slice(0, Math.max(0, palabras.length - 3)).map((_, i) =>
        palabras.slice(i, i + 4).join(' '),
      )
    }
    const sospechosas = [
      ...ventanas(cdataDe(EXC_RC_INEXISTENTE)),
      ...ventanas(cdataDe(EXC_BBOX_VACIO)),
    ]
    expect(sospechosas.length, 'no se han derivado fragmentos que buscar').toBeGreaterThan(4)
    expect(sospechosas.filter((f) => fuente.includes(f))).toEqual([])
  })

  it('un exceptionCode DISTINTO no se disfraza de «no encontrado»', () => {
    const otro = EXC_RC_INEXISTENTE.replace(CODIGO_CAJON_DE_SASTRE, 'NoApplicableCode')
    const r = leerColeccion(otro)
    expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.EXCEPCION)
    expect(r.codigo).toBe('NoApplicableCode')
    expect(r.detalle).toBe(cdataDe(EXC_RC_INEXISTENTE)) // el texto no ha cambiado
  })
})

describe('services/_catastro-wfs · leerColeccion sobre las respuestas BUENAS', () => {
  it('el GetParcel bueno devuelve UNA parcela, y su refcat es el pedido', () => {
    const refcat = refcatsDe(GML_PARCELA)[0]
    const r = leerColeccion(GML_PARCELA)
    expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.PARCELAS)
    expect(r.nMiembros).toBe(miembrosDe(GML_PARCELA))
    expect(r.parcelas).toHaveLength(r.nMiembros)
    expect(r.parcelas.map((p) => p.refcat)).toEqual([refcat])
    // Y es el mismo valor que viaja en la URL de ida: pedido y devuelto casan.
    expect(new URL(urlGetParcel(refcat, 'EPSG:25830')).searchParams.get('refcat')).toBe(refcat)
    expect(r.parcelas[0].srs).toBe('EPSG:25830')
    expect(r.parcelas[0].recintos.length).toBeGreaterThan(0)
  })

  it('la vecindad trae los miembros que trae el fichero, y entre ellos el consultado', () => {
    const consultado = MEDIDA_VECINDAD.p.refcat
    const r = leerColeccion(VECINDAD)
    expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.PARCELAS)
    expect(r.nMiembros).toBe(miembrosDe(VECINDAD))
    expect(r.parcelas.map((p) => p.refcat)).toEqual(refcatsDe(VECINDAD))
    expect(r.parcelas.map((p) => p.refcat)).toContain(consultado)
  })

  it('…y este módulo NO separa la propia parcela: la devuelve entre las demás', () => {
    // Por qué importa que no se separe aquí: la propia parcela no viene la
    // primera (está la 2ª de 5 en el fichero medido), así que descartarla por
    // índice sería un error. Filtrar por referencia catastral es trabajo de
    // `services/catastro.js`, que es quien sabe qué se pidió.
    const consultado = MEDIDA_VECINDAD.p.refcat
    const r = leerColeccion(VECINDAD)
    const posicion = r.parcelas.findIndex((p) => p.refcat === consultado)
    expect(posicion).toBeGreaterThan(0)
    expect(r.parcelas).toHaveLength(r.nMiembros)
  })
})

describe('services/_catastro-wfs · los DOS atributos de conteo mienten', () => {
  const r = leerColeccion(BBOX_COUNT10)
  const contados = miembrosDe(BBOX_COUNT10)
  const declaradoMatched = atributoRaiz(BBOX_COUNT10, 'numberMatched')
  const declaradoReturned = atributoRaiz(BBOX_COUNT10, 'numberReturned')

  it('los miembros CONTADOS difieren del numberMatched DECLARADO (las dos cifras, del fichero)', () => {
    expect(r.nMiembros).toBe(contados)
    expect(r.declarado.numberMatched).toBe(declaradoMatched)
    expect(Number(declaradoMatched)).not.toBe(contados)
  })

  it('numberReturned también miente: dice el total, no lo que trae ESTA respuesta', () => {
    expect(r.declarado.numberReturned).toBe(declaradoReturned)
    expect(Number(declaradoReturned)).not.toBe(contados)
    // Y los dos declaran lo mismo, que es justo lo que delata el fallo del servicio.
    expect(declaradoReturned).toBe(declaradoMatched)
  })

  it('lo declarado se expone bajo una clave que dice que es DECLARADO, no contado', () => {
    expect(Object.keys(r)).toContain('declarado')
    expect(Object.keys(r)).toContain('nMiembros')
    expect(r.declarado).toEqual({
      timeStamp: atributoRaiz(BBOX_COUNT10, 'timeStamp'),
      numberMatched: declaradoMatched,
      numberReturned: declaradoReturned,
    })
    // El conteo bueno no vive dentro de `declarado`: no es algo que el servicio diga.
    expect(r.declarado).not.toHaveProperty('nMiembros')
  })

  it('en la vecindad los conteos SÍ cuadran: la mentira aparece con `count`, no siempre', () => {
    const v = leerColeccion(VECINDAD)
    expect(Number(v.declarado.numberMatched)).toBe(v.nMiembros)
  })
})

describe('services/_catastro-wfs · lo que NO es una colección de parcelas', () => {
  it('un GML de EDIFICIO sale como NO SOPORTADO, no como colección ni como raíz inesperada', () => {
    const r = leerColeccion(GML_EDIFICIO)
    expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.NO_SOPORTADO)
    expect(r.tipo).not.toBe(TIPO_RESPUESTA_WFS.PARCELAS)
    expect(r).not.toHaveProperty('parcelas')
    expect(r.dialecto).toBe('BU')
    expect(r.motivo).toMatch(/BU/)
    // Y NO se disfraza de «raíz inesperada»: la raíz se reconoció perfectamente,
    // lo que pasa es que el fichero habla de otra cosa (su lector es F13).
    const tipos = r.detecciones.map((d) => d.tipo)
    expect(tipos).toContain(TIPO_GML.DIALECTO_OTRO_TEMA)
    expect(tipos).not.toContain(TIPO_GML.RAIZ_INESPERADA)
  })

  it('la respuesta de DescribeStoredQueries no es una colección: sale ILEGIBLE con su motivo', () => {
    const r = leerColeccion(CATALOGO_XML)
    expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE)
    expect(r.motivo).toContain('DescribeStoredQueriesResponse')
  })

  it('un cuerpo vacío o basura sale ILEGIBLE, nunca en excepción', () => {
    for (const cuerpo of ['', '   ', 'no soy XML', '<a><b/></a>']) {
      const r = leerColeccion(cuerpo)
      expect(r.tipo).toBe(TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE)
      expect(typeof r.motivo).toBe('string')
      expect(r.motivo.length).toBeGreaterThan(0)
    }
  })

  it('TODO fixture XML del Catastro se clasifica sin lanzar, y con un tipo del vocabulario', () => {
    const tipos = Object.values(TIPO_RESPUESTA_WFS)
    for (const nombre of readdirSync(DIR_CATASTRO).filter((n) => n.toLowerCase().endsWith('.xml'))) {
      const r = leerColeccion(leer(DIR_CATASTRO, nombre))
      expect(tipos, `${nombre} salió con un tipo desconocido: ${r.tipo}`).toContain(r.tipo)
    }
  })
})

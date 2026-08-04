/* -------------------------------------------------------------------------- *
 * test/services/catastro-bu.test.js — F11 · T1.4. El dialecto del WFS de       *
 * EDIFICIOS del Catastro (`wfsBU.aspx`).                                       *
 *                                                                              *
 * `services/_catastro-bu.js` es puro (no hace red), así que TODO lo que este    *
 * fichero afirma sale de ficheros reales del disco: los cinco de la tanda de    *
 * F11 en `test/fixtures/catastro/` —capturados con `curl` el 2026-08-03, con    *
 * su SHA-256 en `PROCEDENCIA.md`—, los dos GML de edificio de F00, los dos de   *
 * parcela, y el propio `PROCEDENCIA.md`, del que se extraen las **URL           *
 * literales que se midieron**. Ni una lista escrita a mano: el catálogo de      *
 * *stored queries*, los nombres de sus parámetros, el número de miembros, el    *
 * `gml:id` de la colección y los argumentos con los que se llama al constructor *
 * de URL se LEEN de los ficheros.                                              *
 *                                                                              *
 * ── LAS CINCO TRAMPAS QUE ESTE FICHERO EXISTE PARA CLAVAR ──────────────────── *
 *   1. ⛔ **El error NO llega con 200.** Llega 302 → 404 con HTML de ASP.NET, y *
 *      aquí `response.ok` SÍ clasifica — al revés que en el `wfsCP`. Se afirma  *
 *      además que **ese HTML no se intenta parsear como GML**, y se afirma de   *
 *      forma comprobable: el mismo cuerpo, parseado, produce errores de XML; la *
 *      clasificación devuelve `erroresXml: []`.                                 *
 *   2. ⛔ **La colección vacía EXISTE y es el caso NORMAL** — el punto de        *
 *      partida de la obra nueva, no un error. Con su **mitad anti-vacuidad**:   *
 *      la MISMA referencia catastral da 1 miembro con una consulta y 0 con      *
 *      otra, que es lo que prueba que el vacío significa «no hay nada de ese    *
 *      tipo» y no «esa parcela no existe».                                      *
 *   3. ⛔ **El GML de parcela de ENTREGA tiene la MISMA raíz y el MISMO          *
 *      contenedor** que el sobre de este servicio. Sin miembros que mirar, lo   *
 *      único que los separa es el `gml:id` de la colección: se comprueba con    *
 *      una entrega vacía DERIVADA del fixture real, que **no** puede salir como *
 *      «no hay nada construido».                                                *
 *   4. ⭐ **El catálogo tiene CINCO consultas y el módulo construye CUATRO**, y  *
 *      la que falta es exactamente la que el propio catálogo declara con        *
 *      parámetro `ID` en vez de `REFCAT`. Las dos mitades, leídas del fichero.  *
 *   5. ⚠️ **`STOREDQUERIE_ID`, sin la «S»**, y el `srsname` con **doble dos      *
 *      puntos**: las dos grafías se cotejan contra las URL medidas.             *
 *                                                                              *
 * ⚠️ ENCODING: los XML de `catastro/` declaran ISO-8859-1 y sus bytes son       *
 * UTF-8 (mentira heredada del servicio, documentada en `PROCEDENCIA.md`). Se    *
 * leen SIEMPRE como UTF-8 ignorando la declaración, y hay un test que lo deja   *
 * escrito para que nadie «arregle» los fixtures.                               *
 *                                                                              *
 * Proyecto Vitest `node` (sin sufijo `.dom`): aquí no hay DOM, ni red, ni       *
 * Leaflet. `DOMParser` tampoco existe: el lector XML es el propio del proyecto. *
 * -------------------------------------------------------------------------- */

import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import {
  CATASTRO_WFS_BU,
  CONSULTAS_BU,
  ESTADO_NO_LOCALIZADA,
  ID_COLECCION_BU,
  TIPO_RESPUESTA_BU,
  clasificarRespuestaBu,
  urlConsultaBu,
} from '../../services/_catastro-bu.js'
import { CATASTRO_WFS_CP, srsWfs } from '../../services/_catastro-wfs.js'
import { HUSOS_VALIDOS, srsPorHuso } from '../../geo/huso.js'
import { DIALECTO } from '../../gml/_comun.js'
import { parsearXml } from '../../gml/xml.js'

// ── Arnés: los ficheros del disco, leídos como UTF-8 ─────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_CATASTRO = join(RAIZ, 'test', 'fixtures', 'catastro')
const DIR_GML = join(RAIZ, 'test', 'fixtures', 'gml')

/** UTF-8 SIEMPRE, ignorando la declaración del prólogo (ver cabecera). */
const leer = (dir, nombre) => readFileSync(join(dir, nombre), 'utf8')

/** Nombres de los fixtures, en un solo sitio: se citan en varios sitios. */
const F = Object.freeze({
  CATALOGO: 'wfsbu-describestoredqueries.xml',
  TODAS_URBANA: 'wfsbu-allconstruction-9398516VK3799G.xml',
  TODAS_RUSTICA: 'wfsbu-allconstruction-13005A10900001.xml',
  VACIA: 'wfsbu-coleccion-vacia-13005A10900001.xml',
  ERROR_404: 'wfsbu-error-404-ovcerror.html',
})

const CATALOGO = leer(DIR_CATASTRO, F.CATALOGO)
const TODAS_URBANA = leer(DIR_CATASTRO, F.TODAS_URBANA)
const TODAS_RUSTICA = leer(DIR_CATASTRO, F.TODAS_RUSTICA)
const VACIA = leer(DIR_CATASTRO, F.VACIA)
const ERROR_404 = leer(DIR_CATASTRO, F.ERROR_404)
const PROCEDENCIA = leer(DIR_CATASTRO, 'PROCEDENCIA.md')

/** Los dos fixtures BU de F00: hasta F11 no tenían lector, y aquí lo estrenan. */
const BU_BUILDING = leer(DIR_GML, 'bu_building_9398516VK3799G.gml')
const BU_PARTES = leer(DIR_GML, 'bu_buildingpart_9398516VK3799G.gml')

/** Los dos sobres de PARCELA, que son las dos formas de equivocarse de servicio. */
const CP_ENTREGA = leer(DIR_GML, 'cp_ejemplo_explicativo.gml')
const CP_WFS = leer(DIR_GML, 'cp_parcela_9398516VK3799G.gml')

// ── Oráculos independientes: RegExp sobre el TEXTO CRUDO ─────────────────────
// No se usa el lector XML del proyecto para extraer la verdad-terreno cuando se
// puede evitar: sería el mismo código que está bajo prueba. Un barrido de texto
// sobre ficheros de 1,5 a 9,3 kB es suficiente y no comparte ni una línea con el
// módulo.

/** Todas las apariciones del grupo 1 de un patrón global. */
const todas = (texto, re) => [...texto.matchAll(re)].map((m) => m[1])

/**
 * Cuántos `gml:featureMember` trae el documento. Es EL número: contar es contar,
 * y en este servicio **no hay `numberMatched` ni `numberReturned`** que puedan
 * decir otra cosa. Solo casa la etiqueta de APERTURA (la de cierre lleva `/`).
 */
const miembrosDe = (texto) => (texto.match(/<gml:featureMember>/g) ?? []).length

/** El `gml:id` de la RAÍZ: el primero del documento, que va en la primera etiqueta. */
const idColeccionDe = (texto) => /<gml:FeatureCollection\s+gml:id="([^"]+)"/.exec(texto)?.[1] ?? null

/** Query string de una URL como objeto plano `{nombre: valor}`. */
const parametros = (u) => Object.fromEntries(new URL(u).searchParams)

/** `'EPSG::25830'` (query string) → `'EPSG:25830'` (forma corta del modelo). */
const aFormaCorta = (srsPeticion) => srsPeticion.replace('::', ':')

// ── El catálogo de *stored queries*, dicho por el servicio ───────────────────
// Se trocea por bloques para poder asociar cada `id` con SUS parámetros: es lo
// que permite afirmar que la consulta que este módulo NO construye es justo la
// que no se pide por referencia catastral.

/** @type {{id: string, parametros: string[]}[]} */
const CATALOGO_ENTRADAS = CATALOGO.split('<StoredQueryDescription')
  .slice(1)
  .map((bloque) => ({
    id: /^\s+id="([^"]+)"/.exec(bloque)?.[1] ?? '',
    parametros: todas(bloque, /<Parameter name="([^"]+)"/g),
  }))

const IDS_CATALOGO = CATALOGO_ENTRADAS.map((e) => e.id)

// ── Las URL que SE MIDIERON, extraídas de PROCEDENCIA.md ─────────────────────
// `PROCEDENCIA.md` es la documentación de la captura: cada fixture lleva anotada
// la URL exacta con la que se pidió, entre comillas invertidas. De ahí salen los
// ARGUMENTOS con los que se llama al constructor y el resultado que tiene que
// reproducir. No hay ninguna URL tecleada en este test.

const URLS_MEDIDAS_BU = todas(PROCEDENCIA, /`(https:\/\/[^`\s]+)`/g).filter((u) =>
  u.startsWith(`${CATASTRO_WFS_BU}?`),
)

const MEDIDAS_BU = URLS_MEDIDAS_BU.map((u) => ({ url: u, p: parametros(u) })).filter(
  (m) => 'STOREDQUERIE_ID' in m.p,
)

/** Las del ENDPOINT HERMANO, para cotejar la forma de la petición sin acoplarse. */
const MEDIDAS_CP = todas(PROCEDENCIA, /`(https:\/\/[^`\s]+)`/g)
  .filter((u) => u.startsWith(`${CATASTRO_WFS_CP}?`))
  .map((u) => parametros(u))
  .filter((p) => 'STOREDQUERIE_ID' in p)

// ─────────────────────────────────────────────────────────────────────────────

describe('services/_catastro-bu · el arnés lee ficheros de verdad (anti-vacuidad)', () => {
  it('los cinco fixtures de la tanda de F11 están en disco y documentados en PROCEDENCIA.md', () => {
    const enDisco = readdirSync(DIR_CATASTRO)
    for (const nombre of Object.values(F)) {
      expect(enDisco, `${nombre} no está en test/fixtures/catastro/`).toContain(nombre)
      expect(PROCEDENCIA, `${nombre} no tiene procedencia documentada`).toContain(nombre)
    }
    // Y uno de los cinco NO es XML: el error de este servicio llega en HTML.
    expect(F.ERROR_404.endsWith('.html')).toBe(true)
    expect(ERROR_404).toContain('<!DOCTYPE html>')
  })

  it('de PROCEDENCIA.md se extraen las URL medidas de ESTE endpoint, y son varias', () => {
    expect(URLS_MEDIDAS_BU.length, 'no se ha extraído ninguna URL del wfsBU').toBeGreaterThan(0)
    expect(MEDIDAS_BU.length, 'ninguna URL medida traía STOREDQUERIE_ID').toBeGreaterThan(1)
    expect(MEDIDAS_CP.length, 'no se han extraído URL del endpoint hermano').toBeGreaterThan(0)
  })

  it('los XML declaran ISO-8859-1 y sus bytes son UTF-8 (la mentira del servicio)', () => {
    // Si alguien «arregla» el fixture, este test cae y se entera. Y el catálogo
    // trae además DOBLE codificación en sus dos últimas descripciones, medida
    // byte a byte: se transcribe tal cual, no se corrige.
    expect(/encoding="ISO-8859-1"/i.test(VACIA)).toBe(true)
    expect(/encoding="iso-8859-1"/i.test(CATALOGO)).toBe(true)
    expect(CATALOGO, 'las tres primeras descripciones van en UTF-8 correcto').toContain('parámetros')
    expect(CATALOGO, 'las dos últimas vienen doblemente codificadas, y así se quedan').toContain(
      'parÃ¡metros',
    )
  })

  it('los oráculos de texto NO son vacuos: cuentan lo que hay', () => {
    expect(miembrosDe(TODAS_URBANA)).toBeGreaterThan(0)
    expect(miembrosDe(VACIA)).toBe(0)
    expect(idColeccionDe(TODAS_URBANA)).not.toBeNull()
    expect(IDS_CATALOGO.length, 'no se ha leído ninguna stored query del catálogo').toBe(5)
    expect(CATALOGO_ENTRADAS.every((e) => e.parametros.length === 2)).toBe(true)
  })
})

describe('services/_catastro-bu · constantes del servicio', () => {
  it('CATASTRO_WFS_BU es el prefijo de TODAS las URL medidas de este endpoint', () => {
    expect(CATASTRO_WFS_BU).toBe('https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx')
    for (const { url } of MEDIDAS_BU) expect(url.startsWith(`${CATASTRO_WFS_BU}?`)).toBe(true)
  })

  it('⛔ NO es el mismo endpoint que el de parcelas: son dos servicios distintos', () => {
    // No es una perogrullada: los dos cuelgan del mismo host, hablan WFS 2.0 y
    // aceptan los mismos parámetros — y se comportan al revés ante un error.
    expect(CATASTRO_WFS_BU).not.toBe(CATASTRO_WFS_CP)
    expect(new URL(CATASTRO_WFS_BU).host).toBe(new URL(CATASTRO_WFS_CP).host)
  })

  it('CONSULTAS_BU es un SUBCONJUNTO del catálogo que publica el servicio', () => {
    const usadas = Object.values(CONSULTAS_BU)
    expect(usadas.length, 'el módulo no declara ninguna consulta').toBe(4)
    for (const id of usadas) {
      expect(IDS_CATALOGO, `la stored query «${id}» no existe en el servicio`).toContain(id)
    }
  })

  it('⭐ el catálogo tiene CINCO y el dossier documenta TRES: GetAllConstructionByParcel está', () => {
    // La que no está en `MEJORES_PRACTICAS_GML.md` §2.1 y es la que ahorra una
    // petición de cada tres. Se lee del fichero del servicio, no de la memoria.
    expect(IDS_CATALOGO).toHaveLength(5)
    expect(IDS_CATALOGO).toContain(CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES)
    expect(IDS_CATALOGO).toContain(CONSULTAS_BU.PARTES)
  })

  it('⛔ la consulta que NO se construye es exactamente la que no se pide por REFCAT', () => {
    // La mitad anti-vacuidad del subconjunto: sin ella, un módulo que no
    // declarara NINGUNA consulta aprobaría el test anterior sin decir nada. Y de
    // paso deja escrito POR QUÉ falta: el catálogo declara sus parámetros, y los
    // de `GetFeatureById` son ID y SRSNAME, no REFCAT. Construirla con el
    // parámetro equivocado daría un 404 mudo, indistinguible de «no existe».
    const usadas = Object.values(CONSULTAS_BU)
    const fuera = CATALOGO_ENTRADAS.filter((e) => !usadas.includes(e.id))
    expect(fuera).toHaveLength(1)
    expect(fuera[0].parametros).not.toContain('REFCAT')
    expect(fuera[0].parametros).toContain('ID')
    for (const id of usadas) {
      const entrada = CATALOGO_ENTRADAS.find((e) => e.id === id)
      expect(entrada.parametros, `${id} no se pide por REFCAT`).toEqual(['REFCAT', 'SRSNAME'])
    }
  })

  it('⛔ `returnFeatureTypes` vale lo mismo en las CINCO: no sirve para saber qué llega', () => {
    // Error del propio servicio, medido: `GetBuildingPartByParcel` declara
    // `bu:Building` y devuelve `BuildingPart`. Se ancla aquí para que nadie
    // intente clasificar la respuesta por ese atributo — y se comprueba de paso
    // que el módulo no lo nombra siquiera.
    const tipos = new Set(todas(CATALOGO, /returnFeatureTypes="([^"]+)"/g))
    expect(tipos.size).toBe(1)
    const fuente = readFileSync(join(RAIZ, 'services', '_catastro-bu.js'), 'utf8')
    expect(fuente.includes(`returnFeatureTypes="${[...tipos][0]}"`)).toBe(false)
  })

  it('CONSULTAS_BU y TIPO_RESPUESTA_BU están congelados', () => {
    expect(Object.isFrozen(CONSULTAS_BU)).toBe(true)
    expect(Object.isFrozen(TIPO_RESPUESTA_BU)).toBe(true)
  })

  it('ID_COLECCION_BU es el gml:id de los CUATRO documentos BU, y NO el de la parcela', () => {
    for (const doc of [TODAS_URBANA, TODAS_RUSTICA, VACIA, BU_BUILDING, BU_PARTES]) {
      expect(idColeccionDe(doc)).toBe(ID_COLECCION_BU)
    }
    // La otra mitad, que es la que da valor a la constante: el sobre de ENTREGA
    // de una parcela tiene la MISMA raíz y el MISMO contenedor, y se distingue
    // justo aquí.
    expect(idColeccionDe(CP_ENTREGA)).not.toBe(ID_COLECCION_BU)
    expect(CP_ENTREGA).toContain('<gml:FeatureCollection')
    expect(CP_ENTREGA).toContain('<gml:featureMember>')
  })

  it('ESTADO_NO_LOCALIZADA es el 404 que documenta PROCEDENCIA.md, no un número elegido', () => {
    expect(ESTADO_NO_LOCALIZADA).toBe(404)
    expect(PROCEDENCIA).toContain('/OVCError.aspx')
    expect(ERROR_404).toContain(`HTTP ${ESTADO_NO_LOCALIZADA}`)
  })

  it('⛔ ninguna respuesta de este servicio declara numberMatched ni numberReturned', () => {
    // Hecho medido, y la razón de que `nMiembros` sea CONTADO: aquí no hay
    // ningún atributo del que fiarse — al revés que en el `wfsCP`, donde los dos
    // existen y los dos mintieron.
    for (const doc of [TODAS_URBANA, TODAS_RUSTICA, VACIA, BU_BUILDING, BU_PARTES]) {
      expect(doc).not.toContain('numberMatched')
      expect(doc).not.toContain('numberReturned')
    }
  })
})

describe('services/_catastro-bu · las URL reproducen las peticiones MEDIDAS', () => {
  it('urlConsultaBu reproduce TODAS las peticiones medidas, parámetro a parámetro', () => {
    expect(MEDIDAS_BU.length).toBeGreaterThan(1)
    for (const { p, url: medida } of MEDIDAS_BU) {
      const generada = urlConsultaBu(p.STOREDQUERIE_ID, p.refcat, aFormaCorta(p.srsname))
      expect(parametros(generada), `no reproduce ${medida}`).toEqual(p)
      expect(new URL(generada).origin + new URL(generada).pathname).toBe(
        new URL(medida).origin + new URL(medida).pathname,
      )
    }
  })

  it('las cuatro consultas producen la MISMA forma, y solo cambia el STOREDQUERIE_ID', () => {
    const { p } = MEDIDAS_BU[0]
    const srs = aFormaCorta(p.srsname)
    for (const id of Object.values(CONSULTAS_BU)) {
      const q = parametros(urlConsultaBu(id, p.refcat, srs))
      expect(q).toEqual({ ...p, STOREDQUERIE_ID: id })
      expect(Object.keys(q)).toEqual([
        'service',
        'version',
        'request',
        'STOREDQUERIE_ID',
        'refcat',
        'srsname',
      ])
    }
  })

  it('⚠️ el parámetro se llama STOREDQUERIE_ID, SIN la «S» de «QUERIES»', () => {
    // No es una errata nuestra: es el nombre con el que el servicio contestó. Se
    // comprueba contra la URL medida y contra la generada, y se afirma que la
    // grafía «correcta» NO aparece.
    const u = urlConsultaBu(CONSULTAS_BU.PARTES, 'X', 'EPSG:25830')
    expect(new URL(u).searchParams.get('STOREDQUERIE_ID')).toBe(CONSULTAS_BU.PARTES)
    expect(new URL(u).searchParams.get('STOREDQUERIES_ID')).toBeNull()
    for (const { url } of MEDIDAS_BU) expect(url).toContain('STOREDQUERIE_ID=')
  })

  it('el srsname lleva el DOBLE dos puntos, y es el mismo que el de la petición medida', () => {
    for (const { p } of MEDIDAS_BU) {
      expect(p.srsname).toContain('::')
      expect(srsWfs(aFormaCorta(p.srsname))).toBe(p.srsname)
    }
    for (const zona of HUSOS_VALIDOS) {
      const corto = srsPorHuso(zona)
      const q = parametros(urlConsultaBu(CONSULTAS_BU.PARTES, 'X', corto))
      expect(q.srsname).toBe(`EPSG::${corto.slice('EPSG:'.length)}`)
    }
  })

  it('la forma de la petición COINCIDE con la del endpoint hermano (coincidencia, no copia)', () => {
    // Las dos se midieron por separado, en dos tandas y con seis días de
    // diferencia. Que coincidan se AFIRMA aquí —donde una coincidencia se puede
    // comprobar— en vez de compartir la constante, que sería convertirla en un
    // acoplamiento: un cambio medido en un endpoint movería el otro sin que nadie
    // lo hubiera medido.
    const bu = MEDIDAS_BU[0].p
    for (const cp of MEDIDAS_CP) {
      expect(cp.version).toBe(bu.version)
      expect(cp.request).toBe(bu.request)
      expect(cp.service).toBe(bu.service)
    }
  })

  it('el refcat va percent-encoded: un valor hostil no puede añadir parámetros', () => {
    const q = new URL(urlConsultaBu(CONSULTAS_BU.PARTES, 'A&count=999', 'EPSG:25830')).searchParams
    expect(q.get('refcat')).toBe('A&count=999')
    expect(q.get('count')).toBeNull()
  })
})

describe('services/_catastro-bu · contrato roto por el PROGRAMADOR → excepción', () => {
  it('un refcat que no es string no vacío lanza TypeError', () => {
    for (const malo of [undefined, null, 42, {}, [], '']) {
      expect(() => urlConsultaBu(CONSULTAS_BU.PARTES, malo, 'EPSG:25830')).toThrow(TypeError)
    }
  })

  it('una consulta fuera de CONSULTAS_BU lanza, y el mensaje nombra la quinta y su porqué', () => {
    expect(() => urlConsultaBu('GetFeatureById', 'X', 'EPSG:25830')).toThrow(RangeError)
    expect(() => urlConsultaBu('GetFeatureById', 'X', 'EPSG:25830')).toThrow(/GetFeatureById/)
    expect(() => urlConsultaBu('GetParcel', 'X', 'EPSG:25830')).toThrow(RangeError)
    expect(() => urlConsultaBu(null, 'X', 'EPSG:25830')).toThrow(TypeError)
  })

  it('un srs inválido lanza, y la validación está DELEGADA en geo/huso.js', () => {
    // El mensaje lo firma `husoPorSrs`: si algún día alguien copiara aquí la
    // lista de husos soportados, habría dos verdades que sincronizar.
    expect(() => urlConsultaBu(CONSULTAS_BU.PARTES, 'X', 'EPSG:4326')).toThrow(RangeError)
    expect(() => urlConsultaBu(CONSULTAS_BU.PARTES, 'X', 'EPSG:32628')).toThrow(/husoPorSrs/)
    expect(() => urlConsultaBu(CONSULTAS_BU.PARTES, 'X')).toThrow(TypeError)
  })

  it('clasificarRespuestaBu exige un objeto {estado, cuerpo}', () => {
    for (const malo of [undefined, null, 200, 'ok', []]) {
      expect(() => clasificarRespuestaBu(malo)).toThrow(TypeError)
    }
  })

  it('⛔ `estado: null` LANZA: no llegó a haber respuesta, y eso no lo clasifica este módulo', () => {
    // `services/_red.js` deja `estado` en null cuando no hubo respuesta (sin red,
    // plazo agotado, cancelación). Confundir eso con una respuesta del servicio
    // es un bug del programador, no un dato raro: se ve.
    expect(() => clasificarRespuestaBu({ estado: null, cuerpo: null })).toThrow(TypeError)
    expect(() => clasificarRespuestaBu({ estado: '404', cuerpo: null })).toThrow(TypeError)
    expect(() => clasificarRespuestaBu({ estado: 200.5, cuerpo: '' })).toThrow(TypeError)
    expect(() => clasificarRespuestaBu({ estado: 200 })).not.toThrow()
  })

  it('un cuerpo que no es string ni null lanza TypeError', () => {
    expect(() => clasificarRespuestaBu({ estado: 200, cuerpo: Buffer.from('x') })).toThrow(TypeError)
    expect(() => clasificarRespuestaBu({ estado: 200, cuerpo: 42 })).toThrow(TypeError)
  })
})

describe('services/_catastro-bu · los TRES estados MEDIDOS', () => {
  it('200 + colección con miembros → CONSTRUCCIONES, con los miembros CONTADOS', () => {
    for (const [nombre, doc] of [
      [F.TODAS_URBANA, TODAS_URBANA],
      [F.TODAS_RUSTICA, TODAS_RUSTICA],
      ['bu_building (F00)', BU_BUILDING],
      ['bu_buildingpart (F00)', BU_PARTES],
    ]) {
      const r = clasificarRespuestaBu({ estado: 200, cuerpo: doc })
      expect(r.tipo, nombre).toBe(TIPO_RESPUESTA_BU.CONSTRUCCIONES)
      expect(r.nMiembros, nombre).toBe(miembrosDe(doc))
      expect(r.nMiembros, nombre).toBeGreaterThan(0)
      expect(r.idColeccion, nombre).toBe(ID_COLECCION_BU)
      expect(r.dialecto, nombre).toBe(DIALECTO.BU)
      expect(r.erroresXml, nombre).toEqual([])
      expect(r.motivo, nombre).toContain(String(r.nMiembros))
    }
  })

  it('las 13 partes del fixture de F00 se cuentan una a una, no se declaran', () => {
    // El número que este proyecto lleva citando desde F00, ahora afirmado por su
    // primer lector: 13 `BuildingPart`, y 1 `Building` + 1 `OtherConstruction`
    // (la piscina) en la respuesta viva de la misma parcela.
    expect(clasificarRespuestaBu({ estado: 200, cuerpo: BU_PARTES }).nMiembros).toBe(13)
    expect(clasificarRespuestaBu({ estado: 200, cuerpo: TODAS_URBANA }).nMiembros).toBe(2)
  })

  it('⛔ 200 + colección VACÍA → SIN_CONSTRUCCIONES: es un RESULTADO, no un error', () => {
    const r = clasificarRespuestaBu({ estado: 200, cuerpo: VACIA })
    expect(r.tipo).toBe(TIPO_RESPUESTA_BU.SIN_CONSTRUCCIONES)
    expect(r.nMiembros).toBe(0)
    expect(r.idColeccion).toBe(ID_COLECCION_BU)
    expect(r.erroresXml).toEqual([])
    // ⚠️ Y el dialecto sale `null`, no `BU`: sin miembros no hay ningún elemento
    // de feature del que deducirlo, y decir «BU» sería afirmar algo que este
    // documento no dice. Lo que sí lo identifica es el `gml:id`, que es otra cosa.
    expect(r.dialecto).toBeNull()
    // Y NO es ninguna de las formas de fallo: ni ilegible, ni no localizada.
    expect(r.tipo).not.toBe(TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE)
    expect(r.tipo).not.toBe(TIPO_RESPUESTA_BU.NO_LOCALIZADA)
    expect(r.estado).toBe(200)
  })

  it('⭐ la MISMA referencia catastral da 1 miembro con una consulta y 0 con otra', () => {
    // La mitad anti-vacuidad de la colección vacía, y el motivo por el que el
    // fixture de la rústica se conservó aunque no era la parcela que se buscaba:
    // sin esta pareja, el vacío sería ambiguo y podría leerse como «esa parcela
    // no existe». Con ella queda demostrado que significa «no hay nada DE ESE
    // TIPO». Las dos referencias se leen de las URL medidas, no se teclean.
    const deRefcat = (idConsulta) =>
      MEDIDAS_BU.filter((m) => m.p.STOREDQUERIE_ID === idConsulta).map((m) => m.p.refcat)
    const conTodas = deRefcat(CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES)
    const conOtras = deRefcat(CONSULTAS_BU.OTRAS_CONSTRUCCIONES)
    const comun = conTodas.filter((rc) => conOtras.includes(rc))
    expect(comun, 'no hay ninguna RC pedida con las dos consultas').toHaveLength(1)

    const conMiembros = clasificarRespuestaBu({ estado: 200, cuerpo: TODAS_RUSTICA })
    const vacia = clasificarRespuestaBu({ estado: 200, cuerpo: VACIA })
    // Los dos ficheros son de la MISMA parcela: se comprueba leyéndola de ellos.
    expect(TODAS_RUSTICA).toContain(comun[0])
    expect(PROCEDENCIA).toContain(`refcat=${comun[0]}`)
    expect(conMiembros.tipo).toBe(TIPO_RESPUESTA_BU.CONSTRUCCIONES)
    expect(conMiembros.nMiembros).toBe(1)
    expect(vacia.tipo).toBe(TIPO_RESPUESTA_BU.SIN_CONSTRUCCIONES)
    expect(vacia.nMiembros).toBe(0)
  })

  it('⛔ 404 → NO_LOCALIZADA, y el motivo dice que NO se sabe cuál de las dos causas fue', () => {
    const r = clasificarRespuestaBu({ estado: ESTADO_NO_LOCALIZADA, cuerpo: ERROR_404 })
    expect(r.tipo).toBe(TIPO_RESPUESTA_BU.NO_LOCALIZADA)
    expect(r.estado).toBe(404)
    // El 404 es MUDO: el motivo lo dice en vez de elegir una de las dos causas.
    expect(r.motivo).toMatch(/no existe/)
    expect(r.motivo).toMatch(/mal/)
  })
})

describe('services/_catastro-bu · ⛔ el HTML del 404 NO se intenta parsear como GML', () => {
  it('el cuerpo del 404, parseado de verdad, produce errores de XML (el oráculo)', () => {
    // Sin esta mitad, el test siguiente sería vacuo: un cuerpo que se parseara
    // limpiamente también daría `erroresXml: []`. Aquí queda medido que NO.
    const { raiz, errores } = parsearXml(ERROR_404)
    expect(raiz).toBeNull()
    expect(errores.length).toBeGreaterThan(0)
  })

  it('…y la clasificación devuelve erroresXml VACÍO: no ha llegado a parsearlo', () => {
    const r = clasificarRespuestaBu({ estado: 404, cuerpo: ERROR_404 })
    expect(r.erroresXml).toEqual([])
    expect(r.dialecto).toBeNull()
    expect(r.nMiembros).toBeNull()
    expect(r.idColeccion).toBeNull()
  })

  it('el resultado es IDÉNTICO sin cuerpo: el estado es lo único que ha clasificado', () => {
    // `services/_red.js` deja `texto: null` en todos sus caminos de fallo, así
    // que este es el caso real, no un extremo inventado.
    expect(clasificarRespuestaBu({ estado: 404, cuerpo: null })).toEqual(
      clasificarRespuestaBu({ estado: 404, cuerpo: ERROR_404 }),
    )
    expect(clasificarRespuestaBu({ estado: 404, cuerpo: 'cualquier cosa' }).tipo).toBe(
      TIPO_RESPUESTA_BU.NO_LOCALIZADA,
    )
  })

  it('⭐ el MISMO HTML con un 200 sale ILEGIBLE: es el estado lo que clasifica, no el cuerpo', () => {
    // La mitad contraria, y la que demuestra la inversión respecto del `wfsCP`:
    // allí el estado no dice nada y el cuerpo lo dice todo; aquí el estado manda.
    const r = clasificarRespuestaBu({ estado: 200, cuerpo: ERROR_404 })
    expect(r.tipo).toBe(TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE)
    expect(r.tipo).not.toBe(TIPO_RESPUESTA_BU.NO_LOCALIZADA)
    expect(r.erroresXml.length).toBeGreaterThan(0)
  })

  it('un estado que NO se ha medido nunca no se disfraza de «no existe»', () => {
    for (const estado of [403, 500, 503, 301]) {
      const r = clasificarRespuestaBu({ estado, cuerpo: ERROR_404 })
      expect(r.tipo, String(estado)).toBe(TIPO_RESPUESTA_BU.ESTADO_NO_MEDIDO)
      expect(r.estado, String(estado)).toBe(estado)
      expect(r.motivo, String(estado)).toContain(String(estado))
      expect(r.erroresXml, String(estado)).toEqual([])
    }
  })
})

describe('services/_catastro-bu · lo que NO es una colección de este servicio', () => {
  it('⛔ una colección de PARCELAS con miembros no cuela, aunque el sobre sea idéntico', () => {
    // `cp_ejemplo_explicativo.gml` tiene la MISMA raíz (`gml:FeatureCollection`
    // en GML 3.2) y el MISMO contenedor (`gml:featureMember`) que este servicio.
    // Lo único que lo delata es el namespace de su elemento de feature.
    const r = clasificarRespuestaBu({ estado: 200, cuerpo: CP_ENTREGA })
    expect(r.tipo).toBe(TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE)
    expect(r.dialecto).toBe(DIALECTO.CP_4_0_ENTREGA)
    expect(r.nMiembros).toBe(miembrosDe(CP_ENTREGA))
    expect(r.motivo).toContain('CadastralParcel')
  })

  it('⛔⛔ una colección de PARCELAS VACÍA tampoco: no se lee como «no hay nada construido»', () => {
    // La trampa peor de las dos, y la razón de que ID_COLECCION_BU exista: sin
    // miembros no hay namespace de feature que mirar, así que un módulo que solo
    // comprobara la raíz diría «esta parcela no tiene nada construido» sobre un
    // documento de otro tema. El caso se DERIVA del fixture real quitándole su
    // único miembro; no se fabrica un XML a mano.
    const entregaVacia = CP_ENTREGA.replace(/<gml:featureMember>[\s\S]*<\/gml:featureMember>/, '')
    expect(miembrosDe(entregaVacia)).toBe(0)
    expect(entregaVacia).toContain('<gml:FeatureCollection')

    const r = clasificarRespuestaBu({ estado: 200, cuerpo: entregaVacia })
    expect(r.tipo).toBe(TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE)
    expect(r.tipo).not.toBe(TIPO_RESPUESTA_BU.SIN_CONSTRUCCIONES)
    expect(r.nMiembros).toBe(0)
    expect(r.idColeccion).toBe(idColeccionDe(CP_ENTREGA))
    expect(r.motivo).toContain(idColeccionDe(CP_ENTREGA))

    // Y la mitad que impide que el guardián sea un «rechaza todo lo vacío»: la
    // colección vacía DE VERDAD sí pasa.
    expect(clasificarRespuestaBu({ estado: 200, cuerpo: VACIA }).tipo).toBe(
      TIPO_RESPUESTA_BU.SIN_CONSTRUCCIONES,
    )
  })

  it('el sobre del WFS de parcelas sale ILEGIBLE nombrando el otro servicio', () => {
    const r = clasificarRespuestaBu({ estado: 200, cuerpo: CP_WFS })
    expect(r.tipo).toBe(TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE)
    expect(r.motivo).toContain('FeatureCollection')
    expect(r.motivo).toContain('_catastro-wfs.js')
  })

  it('la respuesta de DescribeStoredQueries no es una colección: sale ILEGIBLE con su motivo', () => {
    const r = clasificarRespuestaBu({ estado: 200, cuerpo: CATALOGO })
    expect(r.tipo).toBe(TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE)
    expect(r.motivo).toContain('DescribeStoredQueriesResponse')
  })

  it('un cuerpo vacío, basura o ausente sale ILEGIBLE, y nunca lanza', () => {
    for (const cuerpo of ['', '   ', 'no soy XML', '<a><b/></a>', null]) {
      const r = clasificarRespuestaBu({ estado: 200, cuerpo })
      expect(r.tipo, JSON.stringify(cuerpo)).toBe(TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE)
      expect(typeof r.motivo).toBe('string')
      expect(r.motivo.length).toBeGreaterThan(0)
    }
  })

  it('una colección BU con un featureMember VACÍO se dice, no se cuenta como construcción', () => {
    const conHueco = VACIA.replace(
      '</gml:FeatureCollection>',
      '<gml:featureMember></gml:featureMember></gml:FeatureCollection>',
    )
    const r = clasificarRespuestaBu({ estado: 200, cuerpo: conHueco })
    expect(r.tipo).toBe(TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE)
    expect(r.nMiembros).toBe(1)
    expect(r.motivo).toContain('vacío')
  })
})

describe('services/_catastro-bu · la forma del resultado', () => {
  const CLAVES = ['tipo', 'estado', 'nMiembros', 'idColeccion', 'dialecto', 'motivo', 'erroresXml']

  it('TODOS los caminos devuelven las MISMAS siete claves, en el mismo orden', () => {
    const casos = [
      { estado: 200, cuerpo: TODAS_URBANA },
      { estado: 200, cuerpo: VACIA },
      { estado: 404, cuerpo: ERROR_404 },
      { estado: 500, cuerpo: null },
      { estado: 200, cuerpo: 'basura' },
      { estado: 200, cuerpo: CP_WFS },
      { estado: 200, cuerpo: null },
    ]
    for (const caso of casos) {
      const r = clasificarRespuestaBu(caso)
      expect(Object.keys(r), JSON.stringify(caso.estado)).toEqual(CLAVES)
      expect(Object.values(TIPO_RESPUESTA_BU)).toContain(r.tipo)
      expect(r.estado).toBe(caso.estado)
      expect(typeof r.motivo).toBe('string')
      expect(Array.isArray(r.erroresXml)).toBe(true)
    }
  })

  it('TODO fixture del Catastro se clasifica sin lanzar y con un tipo del vocabulario', () => {
    // Barrido por disco: un fixture nuevo entra solo. Se pasa con 200 a
    // propósito, que es el camino que sí lee el cuerpo.
    const tipos = Object.values(TIPO_RESPUESTA_BU)
    const ficheros = readdirSync(DIR_CATASTRO).filter((n) => /\.(?:xml|html|json)$/i.test(n))
    expect(ficheros.length).toBeGreaterThan(5)
    for (const nombre of ficheros) {
      const r = clasificarRespuestaBu({ estado: 200, cuerpo: leer(DIR_CATASTRO, nombre) })
      expect(tipos, `${nombre} salió con un tipo desconocido: ${r.tipo}`).toContain(r.tipo)
    }
  })

  it('el módulo es PURO: ni una llamada, ni un `await`, ni una decodificación a mano', () => {
    // Es la propiedad que permite probar el dialecto entero contra fixtures sin
    // tocar el servicio, y la que el override O8 exige (provocar el bloqueo cuesta
    // ~10 días de denegación). Se afirma sobre la fuente, que es donde se rompería.
    const fuente = readFileSync(join(RAIZ, 'services', '_catastro-bu.js'), 'utf8')
    const HACE_RED = /\bfetch\s*\(|\bawait\b|\bXMLHttpRequest\b/
    const DECODIFICA_A_MANO = /\bTextDecoder\b|['"`]\s*(?:iso-8859-1|latin1)\s*['"`]/i
    expect(HACE_RED.test(fuente)).toBe(false)
    expect(DECODIFICA_A_MANO.test(fuente)).toBe(false)
    // Los dos detectores disparan sobre fuente sintética: un guardián que no
    // puede fallar nunca es un test verde de adorno.
    expect(HACE_RED.test('const r = await fetch(url)')).toBe(true)
    expect(DECODIFICA_A_MANO.test("new TextDecoder('iso-8859-1').decode(b)")).toBe(true)
    // Y el módulo SÍ habla del encoding en un mensaje: la mención no es la
    // infracción, que es la lección que `test/services/contrato-catastro.test.js`
    // aprendió cuatro veces.
    expect(fuente).toContain('ISO-8859-1')
  })
})

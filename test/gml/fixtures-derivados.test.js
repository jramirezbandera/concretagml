/* -------------------------------------------------------------------------- *
 * test/gml/fixtures-derivados.test.js — F08 · T1.2                             *
 *                                                                              *
 * Los cuatro `.gml` de `test/fixtures/gml/derivados/` son SINTÉTICOS: los       *
 * fabricamos nosotros mutando los fixtures reales para provocar casos límite    *
 * que ningún fichero real cubre. Un fixture así vale exactamente lo que valga   *
 * su procedencia, y una procedencia que nadie ejecuta es prosa. Este fichero    *
 * la ejecuta, en dos direcciones:                                              *
 *                                                                              *
 *   1. QUE LA RECETA SEA LA RECETA. Cada derivado se RECONSTRUYE aquí desde su  *
 *      original aplicando las sustituciones que `derivados/PROCEDENCIA.md`      *
 *      declara, y se compara con el fichero del disco. Si alguien edita un      *
 *      derivado «un poquito» y no toca la ficha, sale rojo. Y los SHA-256 que   *
 *      publica la ficha se LEEN DE LA FICHA y se comprueban contra los bytes,   *
 *      así que el documento tampoco puede envejecer en silencio.               *
 *                                                                              *
 *   2. QUE CADA UNO CONTENGA EL CASO QUE PROMETE. Se pasan por `parsearGml` de  *
 *      verdad —y por `clasificarDialecto`, `superficie` y `reglasHuso`— y se    *
 *      afirma el caso concreto: 3 parcelas y VARIOS_MIEMBROS; huso declarado    *
 *      que sus propias coordenadas no pueden tener; SRS_NO_SOPORTADO de nivel   *
 *      ERROR; y un `areaValue` que su shoelace desmiente. Un fixture que no     *
 *      demuestra su caso es un fichero decorativo.                              *
 *                                                                              *
 * POR QUÉ ESTE TEST VIVE EN `test/gml/` Y NO EN `test/fixtures/gml/derivados/`: *
 * `test/` es un espejo del código, `test/fixtures/` es material. Y hay una      *
 * razón mecánica encima: SEIS tests barren `test/fixtures/gml/` con            *
 * `readdirSync(...)` filtrando por `.gml`, y el motivo de que los              *
 * derivados vivan en un subdirectorio es justamente quedar FUERA de esos        *
 * barridos. Meter código ejecutable dentro del árbol de material iría contra    *
 * esa misma separación. Aquí se citan por nombre, uno a uno, a propósito.       *
 *                                                                              *
 * Proyecto Vitest `node`.                                                       *
 * -------------------------------------------------------------------------- */

import { createHash } from 'node:crypto'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'
import intersect from '@turf/intersect'
import { featureCollection, polygon } from '@turf/helpers'

import { parsearGml } from '../../gml/parse.js'
import { DIALECTO, SEVERIDAD, TIPO_GML, clasificarDialecto } from '../../gml/_comun.js'
import { superficie } from '../../geo/area.js'
import { reglasHuso } from '../../validation/reglas-huso.js'
import { NIVEL } from '../../validation/_comun.js'

// ── Arnés ────────────────────────────────────────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')
const DIR_REALES = join(RAIZ, 'test', 'fixtures', 'gml')
const DIR_DERIVADOS = join(DIR_REALES, 'derivados')

/**
 * Lee un `.gml` NORMALIZANDO los finales de línea a LF.
 *
 * No es cosmética: en la máquina de desarrollo `cp_parcela_9398516VK3799G.gml`
 * está en el árbol de trabajo con CRLF —se extrajo antes de que existiera
 * `.gitattributes`, y `eol=lf` no reescribe lo ya extraído—, mientras que en un
 * clon limpio sale con LF. Comparar bytes sin normalizar haría que este test
 * dependiera de la historia del checkout de cada uno.
 */
const leerLf = (dir, nombre) => readFileSync(join(dir, nombre), 'utf8').replaceAll('\r\n', '\n')

const sha256 = (texto) => createHash('sha256').update(Buffer.from(texto, 'utf8')).digest('hex')

const PROCEDENCIA = readFileSync(join(DIR_DERIVADOS, 'PROCEDENCIA.md'), 'utf8')

const EJEMPLO = 'cp_ejemplo_explicativo.gml'
const DESCARGA = 'cp_parcela_9398516VK3799G.gml'

const DERIVADOS = Object.freeze([
  'cp_multiparcela_entrega.gml',
  'cp_huso_incoherente.gml',
  'cp_srs_no_soportado.gml',
  'cp_area_discrepante.gml',
])

/** El comentario de aviso que los cuatro llevan tras el prólogo (barrera 2). */
const aviso = (de, que) =>
  `<!-- FIXTURE SINTETICO — NO es una descarga real del Catastro. Derivado de ` +
  `${de}: ${que}. No vale como fuente de verdad de nada. Receta completa en ` +
  `test/fixtures/gml/derivados/PROCEDENCIA.md. -->\n`

/** Inserta el aviso justo detrás de la línea del prólogo XML. */
const conAviso = (texto, de, que) =>
  texto.replace(/^(<\?xml[^\n]*\n)/, (linea) => linea + aviso(de, que))

const AVISO_DESCARGA = `${DESCARGA} (descarga real del WFS)`

/**
 * Oráculo INDEPENDIENTE de `gml/parse.js`: extrae con jsdom los tres datos que
 * `clasificarDialecto` necesita (namespace y nombre de la raíz, y namespace del
 * elemento de feature). Se hace así y no leyendo `resultado.dialecto` porque la
 * exigencia es «que el fichero SE CLASIFIQUE como se pretende», y comprobarlo
 * con el mismo módulo que ya clasifica sería preguntarle al interesado.
 */
function datosDeClasificacion(texto) {
  const doc = new JSDOM(texto, { contentType: 'text/xml' }).window.document
  const raiz = doc.documentElement
  const feature = raiz.firstElementChild?.firstElementChild ?? null
  return {
    ns: raiz.namespaceURI,
    local: raiz.localName,
    featureNs: feature?.namespaceURI ?? null,
  }
}

/** Todas las detecciones de un tipo dado. */
const deTipo = (resultado, tipo) => resultado.detecciones.filter((d) => d.tipo === tipo)

/** Polígono turf cerrado a partir de un recinto abierto de `parsearGml`. */
const aPoligono = ({ vertices }) => polygon([[...vertices, vertices[0]]])

// ── 1 · La receta de PROCEDENCIA.md es ejecutable ────────────────────────────

describe('la receta de derivación de PROCEDENCIA.md reproduce los ficheros del disco', () => {
  it('la primera línea del documento dice que son SINTÉTICOS', () => {
    const primera = PROCEDENCIA.split('\n')[0]
    expect(primera).toMatch(/SINT[ÉE]TICOS/)
    expect(primera).toMatch(/NO descargados/i)
  })

  it('los cuatro derivados llevan el aviso de fichero sintético dentro del propio .gml', () => {
    for (const nombre of DERIVADOS) {
      const texto = leerLf(DIR_DERIVADOS, nombre)
      const lineas = texto.split('\n')
      expect(lineas[0], `${nombre}: la primera línea debe ser el prólogo XML`).toMatch(/^<\?xml/)
      expect(lineas[1], `${nombre}: la segunda línea debe ser el aviso de sintético`).toContain(
        'FIXTURE SINTETICO',
      )
      expect(lineas[1]).toContain('derivados/PROCEDENCIA.md')
    }
  })

  it('el directorio contiene EXACTAMENTE los cuatro derivados documentados', () => {
    const enDisco = readdirSync(DIR_DERIVADOS)
      .filter((n) => n.toLowerCase().endsWith('.gml'))
      .sort()
    expect(enDisco).toEqual([...DERIVADOS].sort())
  })

  it('`cp_multiparcela_entrega.gml` = la plantilla oficial con su featureMember x3', () => {
    const original = leerLf(DIR_REALES, EJEMPLO)
    const ini = original.indexOf('<gml:featureMember>')
    const fin = original.indexOf('</gml:featureMember>') + '</gml:featureMember>'.length
    expect(ini, 'el original debe traer un featureMember').toBeGreaterThan(-1)
    const bloque = original.slice(ini, fin)

    const miembros = [
      ['1A', 0],
      ['2B', 30],
      ['3C', 60],
    ].map(([sufijo, dx]) => {
      let b = bloque
        .replaceAll('ES.LOCAL.CP.1A', `ES.LOCAL.CP.${sufijo}`)
        .replaceAll('<base:localId>1A</base:localId>', `<base:localId>${sufijo}</base:localId>`)
      if (dx !== 0) {
        b = b.replace(/(<gml:posList srsDimension="2">)([^<]*)(<\/gml:posList>)/, (_, a, n, z) => {
          const desplazados = n
            .trim()
            .split(/\s+/)
            .map(Number)
            .map((v, i) => (i % 2 === 0 ? (v + dx).toFixed(2) : v.toFixed(2)))
          return a + desplazados.join(' ') + z
        })
      }
      return b
    })

    const esperado =
      conAviso(
        original.slice(0, ini),
        `${EJEMPLO} (plantilla oficial de ENTREGA)`,
        'su unico gml:featureMember repetido TRES veces con gml:id y localId distintos y la ' +
          'geometria desplazada +0/+30/+60 m en Este',
      ) +
      miembros.join('\n') +
      original.slice(fin)

    expect(leerLf(DIR_DERIVADOS, 'cp_multiparcela_entrega.gml')).toBe(esperado)
  })

  it('los tres derivados de la descarga son UNA sustitución de texto cada uno', () => {
    const original = leerLf(DIR_REALES, DESCARGA)
    const recetas = [
      [
        'cp_huso_incoherente.gml',
        original.replaceAll('EPSG/0/25830', 'EPSG/0/25829'),
        'srsName cambiado de EPSG:25830 a EPSG:25829 en los 3 sitios, sin tocar una sola coordenada',
      ],
      [
        'cp_srs_no_soportado.gml',
        original.replaceAll('EPSG/0/25830', 'EPSG/0/4326'),
        'srsName cambiado de EPSG:25830 a EPSG:4326 en los 3 sitios, sin tocar una sola coordenada',
      ],
      [
        'cp_area_discrepante.gml',
        original.replace(
          '<cp:areaValue uom="m2">1536</cp:areaValue>',
          '<cp:areaValue uom="m2">1576</cp:areaValue>',
        ),
        'cp:areaValue alterado de 1536 a 1576 m2, sin tocar una sola coordenada',
      ],
    ]
    for (const [nombre, mutado, que] of recetas) {
      expect(mutado, `${nombre}: la sustitución no cambió nada del original`).not.toBe(original)
      expect(leerLf(DIR_DERIVADOS, nombre)).toBe(conAviso(mutado, AVISO_DESCARGA, que))
    }
  })

  it('los SHA-256 que publica PROCEDENCIA.md son los de los bytes de verdad', () => {
    // Se leen DEL documento: si alguien cambia un fixture y no actualiza la
    // ficha (o al revés), esto sale rojo. Sin lista escrita a mano en el test.
    const filas = [...PROCEDENCIA.matchAll(/`([\w./-]+\.gml)`[^|\n]*\|\s*`([0-9a-f]{64})`/g)]
    expect(filas.length, 'PROCEDENCIA.md debe publicar 6 SHA-256 (2 originales + 4 derivados)')
      .toBe(6)

    for (const [, ruta, shaPublicado] of filas) {
      const nombre = ruta.replace(/^\.\.\//, '')
      const dir = ruta.startsWith('../') ? DIR_REALES : DIR_DERIVADOS
      expect(sha256(leerLf(dir, nombre)), `SHA-256 publicado para ${ruta}`).toBe(shaPublicado)
    }
  })

  it('los derivados quedan FUERA de los barridos de `test/fixtures/gml/`', () => {
    // Es la barrera nº 1 contra confundirlos con los reales, y la usan ocho
    // tests. Si algún día `derivados/` se aplanara sobre el directorio padre,
    // los fixtures sintéticos entrarían en las pruebas de los reales.
    const barrido = readdirSync(DIR_REALES).filter((n) => n.toLowerCase().endsWith('.gml'))
    for (const nombre of DERIVADOS) expect(barrido).not.toContain(nombre)
    // El inventario se escribe entero, y por eso esta prueba salió roja el
    // 2026-08-05 al entrar `cp_parcela_7136910UF1473N.gml` (F17): un fixture nuevo
    // no puede colarse en los barridos de nadie sin que alguien lo mire, que es la
    // mitad del trabajo de este fichero.
    expect(barrido.sort()).toEqual([
      'UTM_1.gml',
      'bu_building_9398516VK3799G.gml',
      'bu_buildingpart_9398516VK3799G.gml',
      EJEMPLO,
      'cp_parcela_7136910UF1473N.gml',
      DESCARGA,
    ])
  })
})

// ── 2 · Cada derivado contiene el caso que promete ───────────────────────────

describe('cp_multiparcela_entrega.gml · «un GML con varias parcelas ofrece elegir»', () => {
  const texto = leerLf(DIR_DERIVADOS, 'cp_multiparcela_entrega.gml')
  const resultado = parsearGml(texto)

  it('sigue clasificándose como CP 4.0 en sobre de ENTREGA', () => {
    // `clasificarDialecto` de verdad, sobre los datos que extrae jsdom: la raíz
    // sola NO clasifica (la comparten el 3.0 y los dos de edificio), así que lo
    // que se está atando aquí es el `featureNs`.
    const datos = datosDeClasificacion(texto)
    expect(datos.local).toBe('FeatureCollection')
    expect(datos.ns).toBe('http://www.opengis.net/gml/3.2')
    expect(datos.featureNs).toBe('http://inspire.ec.europa.eu/schemas/cp/4.0')
    expect(clasificarDialecto(datos).id).toBe(DIALECTO.CP_4_0_ENTREGA)
    expect(resultado.dialecto).toBe(DIALECTO.CP_4_0_ENTREGA)
    expect(resultado.soportado).toBe(true)
  })

  it('trae TRES parcelas y se detecta VARIOS_MIEMBROS', () => {
    expect(resultado.parcelas).toHaveLength(3)
    expect(resultado.resumen.nMiembros).toBe(3)

    const varios = deTipo(resultado, TIPO_GML.VARIOS_MIEMBROS)
    expect(varios).toHaveLength(1)
    expect(varios[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(varios[0].datos.miembros).toBe(3)
  })

  it('los `gml:id` son únicos en TODO el documento (`xs:ID`)', () => {
    // El defecto real de UTM_1.gml, que invalida el fichero entero contra
    // cualquier esquema GML 3.2. Un multiparcela con ids repetidos habría sido
    // un fixture inválido haciéndose pasar por el caso «varias parcelas».
    const ids = [...texto.matchAll(/gml:id="([^"]+)"/g)].map((m) => m[1])
    expect(ids.length).toBe(10) // 1 raíz + 3 x (parcela + MultiSurface + Surface)
    expect(new Set(ids).size).toBe(ids.length)
    expect(resultado.parcelas.map((p) => p.gmlId)).toEqual([
      'ES.LOCAL.CP.1A',
      'ES.LOCAL.CP.2B',
      'ES.LOCAL.CP.3C',
    ])
    expect(resultado.parcelas.map((p) => p.localId)).toEqual(['1A', '2B', '3C'])
  })

  it('las tres parcelas NO se solapan entre sí', () => {
    const polis = resultado.parcelas.map((p) => aPoligono(p.recintos[0]))
    for (let i = 0; i < polis.length; i++) {
      for (let j = i + 1; j < polis.length; j++) {
        expect(intersect(featureCollection([polis[i], polis[j]])), `parcelas ${i} y ${j}`).toBe(
          null,
        )
      }
    }
  })

  it('la geometría es una TRASLACIÓN: mismo área, Este desplazado, Norte intacto', () => {
    const [a, b, c] = resultado.parcelas
    expect(a.recintos[0].vertices[0]).toEqual([269218.83, 4805295.18])
    expect(b.recintos[0].vertices[0]).toEqual([269248.83, 4805295.18])
    expect(c.recintos[0].vertices[0]).toEqual([269278.83, 4805295.18])
    for (const p of resultado.parcelas) {
      expect(p.areaValue).toBe(236)
      expect(superficie(p.recintos)).toBeCloseTo(236.0456, 4)
      expect(p.srs).toBe('EPSG:25830')
    }
  })

  it('no se inventa ninguna referencia catastral: las tres vienen vacías', () => {
    // La plantilla oficial las deja en blanco a propósito (es un alta). Una
    // refcat plausible-pero-falsa sería el dato inventado que este directorio
    // existe para impedir.
    for (const p of resultado.parcelas) expect(p.refcat).toBe('')
  })

  it('no hay ni un bloqueo: el recorrido de F08 puede continuar', () => {
    expect(resultado.resumen.bloqueos).toEqual([])
  })
})

describe('cp_huso_incoherente.gml · coordenadas fuera del huso que el fichero DECLARA', () => {
  const texto = leerLf(DIR_DERIVADOS, 'cp_huso_incoherente.gml')
  const resultado = parsearGml(texto)
  const parcela = resultado.parcelas[0]

  it('sigue clasificándose como CP 4.0 en sobre de DESCARGA (WFS)', () => {
    const datos = datosDeClasificacion(texto)
    expect(clasificarDialecto(datos).id).toBe(DIALECTO.CP_4_0_WFS)
    expect(resultado.dialecto).toBe(DIALECTO.CP_4_0_WFS)
  })

  it('declara EPSG:25829 en los tres `srsName`', () => {
    // Los TRES: MultiSurface, Surface y el gml:Point del referencePoint. Si se
    // hubiera cambiado solo uno, `parse.js` habría emitido SRS_INCOHERENTE y el
    // fixture contendría otro caso distinto del que promete.
    expect([...texto.matchAll(/srsName="([^"]+)"/g)].map((m) => m[1])).toEqual([
      'http://www.opengis.net/def/crs/EPSG/0/25829',
      'http://www.opengis.net/def/crs/EPSG/0/25829',
      'http://www.opengis.net/def/crs/EPSG/0/25829',
    ])
    expect(parcela.srs).toBe('EPSG:25829')
  })

  it('las coordenadas siguen siendo las de la parcela real, en MADRID', () => {
    // El valor concreto, no «alguna coordenada»: la mitad del caso es que NO se
    // tocó ni un número. Desproyectado en huso 30 este vértice da
    // lon −3,7162° / lat 40,4655°, que es Madrid — y coincide con el `ldt` que
    // el OVC devuelve para esta misma referencia («CL SAN RESTITUTO 72(C)
    // MADRID»), en test/fixtures/catastro/PROCEDENCIA.md.
    expect(parcela.refcat).toBe('9398516VK3799G')
    expect(parcela.recintos[0].vertices).toHaveLength(15)
    expect(parcela.recintos[0].vertices[0]).toEqual([439283.23, 4479671.27])
    expect(parcela.areaValue).toBe(1536)
  })

  it('`reglasHuso` sí dispara con el huso declarado: los 15 vértices caen fuera', () => {
    const hallazgos = reglasHuso(parcela.recintos, { srs: parcela.srs })
    expect(hallazgos).toHaveLength(1)
    expect(hallazgos[0].nivel).toBe(NIVEL.ERROR)
    expect(hallazgos[0].mensaje).toContain('15 vértices caen fuera del huso 29')
  })

  it('y NO dispararía con 25830 ni con 25831 — por eso el fixture es 25829', () => {
    // La mitad anti-vacuidad, y la razón medida de una desviación del encargo:
    // relabelar a 25831 deja la desproyección en lon +2,28°, DENTRO del
    // BBOX_ESPANA de geo/huso.js, así que la regla no habría disparado y el
    // fixture no contendría su caso. Ver derivados/PROCEDENCIA.md.
    expect(reglasHuso(parcela.recintos, { srs: 'EPSG:25830' })).toEqual([])
    expect(reglasHuso(parcela.recintos, { srs: 'EPSG:25831' })).toEqual([])
  })

  it('`parsearGml` NO dice nada del huso: cotejarlo es del llamante (F08, C2)', () => {
    expect(resultado.resumen.bloqueos).toEqual([])
    expect(resultado.detecciones.map((d) => d.tipo)).toEqual([
      TIPO_GML.ENCODING_DECLARADO,
      TIPO_GML.CIERRE_RETIRADO,
    ])
  })
})

describe('cp_srs_no_soportado.gml · el SRS que parse.js rechaza con motivo propio', () => {
  const texto = leerLf(DIR_DERIVADOS, 'cp_srs_no_soportado.gml')
  const resultado = parsearGml(texto)

  it('sigue clasificándose como CP 4.0 en sobre de DESCARGA (WFS)', () => {
    expect(clasificarDialecto(datosDeClasificacion(texto)).id).toBe(DIALECTO.CP_4_0_WFS)
    expect(resultado.dialecto).toBe(DIALECTO.CP_4_0_WFS)
  })

  it('emite SRS_NO_SOPORTADO de severidad ERROR, con el código 4326 en los datos', () => {
    const hallados = deTipo(resultado, TIPO_GML.SRS_NO_SOPORTADO)
    expect(hallados).toHaveLength(1)
    expect(hallados[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(hallados[0].datos.codigo).toBe(4326)
    expect(hallados[0].datos.srsName).toBe('http://www.opengis.net/def/crs/EPSG/0/4326')
    expect(resultado.resumen.bloqueos).toEqual([TIPO_GML.SRS_NO_SOPORTADO])
  })

  it('el mensaje explica los ejes lat/lon invertidos, no dice «no vale» a secas', () => {
    // Regla de oro 1. El motivo está escrito en gml/parse.js#MOTIVOS_SRS_NO_SOPORTADO
    // y este fixture es lo que hace que se lea alguna vez.
    const [deteccion] = deTipo(resultado, TIPO_GML.SRS_NO_SOPORTADO)
    expect(deteccion.mensaje).toContain('LATITUD, LONGITUD')
    expect(deteccion.mensaje).toMatch(/Reproyecta/)
  })

  it('la parcela se lee igual; lo que queda a null es el `srs`', () => {
    expect(resultado.parcelas).toHaveLength(1)
    expect(resultado.parcelas[0].srs).toBe(null)
    expect(resultado.parcelas[0].recintos[0].vertices[0]).toEqual([439283.23, 4479671.27])
  })
})

describe('cp_area_discrepante.gml · el fichero declara lo que sus coordenadas no dan', () => {
  const texto = leerLf(DIR_DERIVADOS, 'cp_area_discrepante.gml')
  const resultado = parsearGml(texto)
  const parcela = resultado.parcelas[0]

  it('sigue clasificándose como CP 4.0 en sobre de DESCARGA (WFS)', () => {
    expect(clasificarDialecto(datosDeClasificacion(texto)).id).toBe(DIALECTO.CP_4_0_WFS)
    expect(resultado.dialecto).toBe(DIALECTO.CP_4_0_WFS)
  })

  it('`areaValue` = 1576 mientras la shoelace de sus coordenadas da 1535,87', () => {
    expect(parcela.areaValue).toBe(1576)
    expect(superficie(parcela.recintos)).toBeCloseTo(1535.87, 2)
  })

  it('la discrepancia es del 2,6 %: visible, y por debajo del 5 % oficial', () => {
    const medida = superficie(parcela.recintos)
    const desvio = (parcela.areaValue - medida) / medida
    expect(desvio).toBeGreaterThan(0.02)
    expect(desvio).toBeLessThan(0.05)
  })

  it('las coordenadas son las mismas que las del fixture real', () => {
    const real = parsearGml(leerLf(DIR_REALES, DESCARGA)).parcelas[0]
    expect(parcela.recintos).toEqual(real.recintos)
    expect(real.areaValue).toBe(1536) // el original declara 1536; el derivado, 1576
  })

  it('`parsearGml` NO emite AREA_DECLARADA_DISCREPANTE — ese hueco lo llena F08 (C1)', () => {
    // Anti-vacuidad al revés: se afirma la AUSENCIA, porque hoy ese tipo solo se
    // emite cuando el valor no es numérico. Si algún día parse.js empieza a
    // comparar de verdad, este test cae y hay que reescribir la ficha, no
    // borrar la línea.
    expect(deTipo(resultado, TIPO_GML.AREA_DECLARADA_DISCREPANTE)).toEqual([])
    expect(resultado.resumen.bloqueos).toEqual([])
  })
})

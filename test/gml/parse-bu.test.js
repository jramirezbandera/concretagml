/* -------------------------------------------------------------------------- *
 * test/gml/parse-bu.test.js — F11 · Lectura de un GML de EDIFICIO (T1.2)        *
 *                                                                              *
 * `gml/parse-bu.js` lee un fichero que este proyecto NO escribe, del dialecto   *
 * más traicionero que ha tocado: **dos namespaces hermanos** cuyos elementos se  *
 * llaman igual, **dos formas de geometría** distintas en el mismo servicio, y un *
 * `count` que cuenta un vértice de más. Los cuatro modos de fallo de este módulo *
 * son EN VERDE — un `null` donde había un 7, una piscina que no aparece, 53 de   *
 * 58 puntos que se quedan fuera— así que este fichero no comprueba «que el       *
 * lector devuelve lo que devuelve»:                                             *
 *                                                                              *
 *   · monta un ORÁCULO INDEPENDIENTE con jsdom sobre los CINCO ficheros reales   *
 *     (los dos BU de `test/fixtures/gml/` y los tres del `wfsBU` que la fase 0   *
 *     versionó en `test/fixtures/catastro/`) y coteja campo por campo;           *
 *   · cada número que se afirma —13 partes, `count` 36, 2513 m²— sale de LEER    *
 *     el fichero, jamás del enunciado de la tarea (regla de oro 8);              *
 *   · y los guardianes traen su MITAD ANTI-VACUIDAD: se demuestra que buscar en  *
 *     el namespace equivocado devuelve `null` en las trece partes, que hay un    *
 *     `Building` con UN patch y otro con DOS, y que un `Polygon` directo y un    *
 *     `Surface` con patches conviven en la misma respuesta del servicio.         *
 *                                                                              *
 * Los casos que ningún fixture cubre (SRS incoherente, anillo sin cerrar, dos    *
 * Building, geometría en el namespace que no es) no se teclean: se fabrican      *
 * MUTANDO el texto del fichero real, y {@link mutar} REVIENTA si la sustitución  *
 * no llegó a ocurrir — un caso de prueba que no muta nada es un test que pasa    *
 * sin mirar.                                                                     *
 *                                                                              *
 * Proyecto Vitest `node`: XML y POJOs, sin DOM de aplicación.                    *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import { JSDOM } from 'jsdom'

import {
  FEATURE_BU,
  ID_RAIZ_BU,
  MAX_ERRORES_XML_BU,
  NS_BU,
  bloqueosBu,
  parsearGmlBu,
  resumirDeteccionesBu,
} from '../../gml/parse-bu.js'
import { parsearGml } from '../../gml/parse.js'
import {
  DIALECTO,
  DIALECTOS,
  FORMA_SRSNAME,
  NS,
  SEVERIDAD,
  TIPO_GML,
  srsNameUri,
} from '../../gml/_comun.js'

// ── Arnés: los cinco ficheros del disco y un oráculo independiente ───────────

const RAIZ = join(import.meta.dirname, '..', '..')

/**
 * Lee un fichero decodificándolo con el encoding que él mismo DECLARA. Es el
 * trabajo que `gml/parse-bu.js` NO hace (recibe texto ya decodificado) y que
 * alguien tiene que hacer: los cinco BU declaran ISO-8859-1.
 */
function leer(rel) {
  const bytes = readFileSync(join(RAIZ, ...rel.split('/')))
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  const encoding = m ? m[1] : 'utf-8'
  return { encoding, texto: new TextDecoder(encoding).decode(bytes) }
}

/** Oráculo: el mismo documento visto por jsdom, que no es el lector bajo prueba. */
function analizar(rel) {
  const { encoding, texto } = leer(rel)
  const doc = new JSDOM(texto, { contentType: 'text/xml' }).window.document
  return { rel, nombre: rel.split('/').pop(), encoding, texto, doc, raiz: doc.documentElement }
}

const BUILDING = analizar('test/fixtures/gml/bu_building_9398516VK3799G.gml')
const PARTES = analizar('test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml')
const TODO = analizar('test/fixtures/catastro/wfsbu-allconstruction-9398516VK3799G.xml')
const TODO_RUSTICA = analizar('test/fixtures/catastro/wfsbu-allconstruction-13005A10900001.xml')
const VACIA = analizar('test/fixtures/catastro/wfsbu-coleccion-vacia-13005A10900001.xml')

const BU = [BUILDING, PARTES, TODO, TODO_RUSTICA, VACIA]

// Los tres GML de PARCELA del repo: el contraejemplo, y la mitad que demuestra
// que este lector no traga lo que no es suyo.
const CP = [
  analizar('test/fixtures/gml/cp_parcela_9398516VK3799G.gml'),
  analizar('test/fixtures/gml/cp_ejemplo_explicativo.gml'),
  analizar('test/fixtures/gml/UTM_1.gml'),
]

// ── Consultas del oráculo ────────────────────────────────────────────────────

/** Todos los elementos del documento del oráculo. */
const todos = (a) => [...a.doc.querySelectorAll('*')]

/** Los `gml:featureMember` del oráculo, y el feature de dentro de cada uno. */
const features = (a) =>
  todos(a)
    .filter((e) => e.localName === 'featureMember')
    .map((e) => e.firstElementChild)

/** Elementos `(ns, local)` dentro de un elemento del oráculo. */
const dentro = (elemento, ns, local) =>
  [...elemento.querySelectorAll('*')].filter((e) => e.namespaceURI === ns && e.localName === local)

/** Texto del primer `(ns, local)` dentro de un elemento del oráculo, o `null`. */
const textoDe = (elemento, ns, local) => dentro(elemento, ns, local)[0]?.textContent.trim() ?? null

/** Los `count` de los `gml:posList` de un feature del oráculo, en orden. */
const countsDe = (feature) =>
  dentro(feature, NS.gml, 'posList').map((e) => Number(e.getAttribute('count')))

/** Pares de coordenadas que trae realmente un `gml:posList` del oráculo. */
const paresDe = (feature) =>
  dentro(feature, NS.gml, 'posList').map((e) => e.textContent.trim().split(/\s+/).length / 2)

/** ¿Viene ese elemento con `xsi:nil="true"`? (y su `nilReason`). */
const nilDe = (feature, ns, local) => {
  const e = dentro(feature, ns, local)[0]
  if (e === undefined) return null
  return e.getAttributeNS(NS.xsi, 'nil') === 'true' ? (e.getAttributeNS('', 'nilReason') ?? '') : false
}

// ── Fábrica de ficheros DEFECTUOSOS a partir del fichero real ────────────────

/**
 * Sustituye en el texto real y EXIGE que la sustitución haya ocurrido.
 *
 * Sin esta comprobación, cambiar una coma en el fixture convertiría media docena
 * de casos de prueba en «parsear el fichero bueno» — y seguirían verdes. Es la
 * misma disciplina que ya usa `test/gml/parse.test.js`.
 */
function mutar(texto, de, a, veces = 1) {
  const partes = texto.split(de)
  expect(
    partes.length - 1,
    `mutar: el patrón ${JSON.stringify(String(de))} no aparece las ${veces} veces esperadas en ` +
      'el fixture. El fichero real ha cambiado y este caso de prueba ya no prueba nada.',
  ).toBe(veces)
  return partes.join(a)
}

/**
 * El PRIMER `gml:featureMember` completo de un documento, con su contenido.
 *
 * Existe porque los fixtures BU están en **CRLF** en el árbol de trabajo, así que
 * ningún patrón de mutación puede llevar un `\n` literal: se recorta el bloque
 * con una expresión regular (`[\s\S]` cruza los dos finales de línea) y se muta
 * dentro de él.
 */
const PRIMER_MIEMBRO = (texto) => /<gml:featureMember>[\s\S]*?<\/gml:featureMember>/.exec(texto)[0]

/** Los tipos de detección emitidos, en orden. */
const tipos = (r) => r.detecciones.map((d) => d.tipo)

/** Las detecciones de un tipo concreto. */
const deTipo = (r, tipo) => r.detecciones.filter((d) => d.tipo === tipo)

// ═════════════════════════════════════════════════════════════════════════════
// 0 · El arnés no es vacuo
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · el arnés lee los cinco ficheros reales', () => {
  it('los cinco existen, no están vacíos y declaran ISO-8859-1', () => {
    for (const a of BU) {
      expect(a.texto.length, `${a.nombre} está vacío`).toBeGreaterThan(1000)
      expect(a.encoding.toLowerCase(), a.nombre).toBe('iso-8859-1')
    }
  })

  it('los cinco traen la misma raíz `gml:FeatureCollection` con `gml:id="ES.SDGC.BU"`', () => {
    for (const a of BU) {
      expect(a.raiz.localName, a.nombre).toBe('FeatureCollection')
      expect(a.raiz.namespaceURI, a.nombre).toBe(NS.gml)
      expect(a.raiz.getAttributeNS(NS.gml, 'id'), a.nombre).toBe(ID_RAIZ_BU)
    }
  })

  it('el oráculo cuenta 1 · 13 · 2 · 1 · 0 miembros, y ésa es la verdad-terreno', () => {
    expect(BU.map((a) => features(a).length)).toEqual([1, 13, 2, 1, 0])
  })

  it('los tres tipos de construcción están repartidos como se midió', () => {
    const tipoDe = (a) => features(a).map((f) => f.localName)
    expect(tipoDe(BUILDING)).toEqual([FEATURE_BU.BUILDING])
    expect(tipoDe(PARTES)).toEqual(Array(13).fill(FEATURE_BU.BUILDING_PART))
    expect(tipoDe(TODO)).toEqual([FEATURE_BU.BUILDING, FEATURE_BU.OTHER_CONSTRUCTION])
    expect(tipoDe(TODO_RUSTICA)).toEqual([FEATURE_BU.BUILDING])
    expect(tipoDe(VACIA)).toEqual([])
  })

  it('`mutar` revienta si el patrón no está: el detector de casos vacuos', () => {
    expect(() => mutar('hola', 'adios', 'x')).toThrow()
    expect(mutar('a-b-a', '-b-', '+')).toBe('a+a')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Los namespaces: la trampa que devuelve `null` en las trece
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · `bu-ext2d` y `bu-core2d` no son intercambiables (T0.2·5)', () => {
  it('`NS_BU.ext2d` es EXACTAMENTE el `featureNs` que ya guarda `gml/_comun.js`', () => {
    // Si alguien reescribe uno de los dos, este test cae: es la misma cadena
    // vista desde dos sitios, y en `_comun.js` es el DISCRIMINANTE del dialecto.
    const bu = DIALECTOS.find((d) => d.id === DIALECTO.BU)
    expect(bu, 'ha desaparecido el dialecto BU de gml/_comun.js').toBeDefined()
    expect(NS_BU.ext2d).toBe(bu.featureNs)
    expect(NS_BU.core2d).not.toBe(NS_BU.ext2d)
  })

  it('los cinco ficheros DECLARAN los dos namespaces en su raíz', () => {
    for (const a of BU) {
      expect(a.texto, a.nombre).toContain(`xmlns:bu-ext2d="${NS_BU.ext2d}"`)
      expect(a.texto, a.nombre).toContain(`xmlns:bu-core2d="${NS_BU.core2d}"`)
    }
  })

  it('⛔ las plantas están en `bu-ext2d` y NO en `bu-core2d`: en el otro salen 0 de 13', () => {
    // ÉSTA es la mitad anti-vacuidad del hallazgo T0.2·5. Si el lector buscara
    // donde no es, no fallaría: devolvería `null` trece veces y `part10`
    // «parecería normal».
    const enExt = features(PARTES).filter(
      (f) => dentro(f, NS_BU.ext2d, 'numberOfFloorsAboveGround').length === 1,
    )
    const enCore = features(PARTES).filter(
      (f) => dentro(f, NS_BU.core2d, 'numberOfFloorsAboveGround').length > 0,
    )
    expect(enExt).toHaveLength(13)
    expect(enCore).toHaveLength(0)
    // Y al revés: `conditionOfConstruction` vive en `bu-core2d`, no en `bu-ext2d`.
    expect(
      features(PARTES).filter((f) => dentro(f, NS_BU.core2d, 'conditionOfConstruction').length === 1),
    ).toHaveLength(13)
    expect(
      features(PARTES).filter((f) => dentro(f, NS_BU.ext2d, 'conditionOfConstruction').length > 0),
    ).toHaveLength(0)
  })

  it('⛔ hay DOS `geometry`, uno en cada namespace, y el de fuera es el de `bu-ext2d`', () => {
    const parte = features(PARTES)[0]
    expect(dentro(parte, NS_BU.ext2d, 'geometry')).toHaveLength(1)
    expect(dentro(parte, NS_BU.core2d, 'geometry')).toHaveLength(1)
    expect(dentro(parte, NS_BU.ext2d, 'geometry')[0].firstElementChild.localName).toBe(
      'BuildingGeometry',
    )
    // Y en la piscina el de `bu-core2d` NO existe: el `gml:Polygon` cuelga del
    // de `bu-ext2d` directamente.
    const piscina = features(TODO)[1]
    expect(dentro(piscina, NS_BU.ext2d, 'geometry')).toHaveLength(1)
    expect(dentro(piscina, NS_BU.core2d, 'geometry')).toHaveLength(0)
  })

  it('el lector encuentra la geometría en las DOS formas, y las dos son reales', () => {
    const conPatches = parsearGmlBu(PARTES.texto)
    const conPolygon = parsearGmlBu(TODO.texto)
    expect(conPatches.partes.every((p) => p.anillos.length === 1)).toBe(true)
    expect(conPolygon.otras[0].anillos).toHaveLength(1)
  })

  it('si la geometría estuviera en el namespace que no es, se DICE (no sale `null` mudo)', () => {
    // Se mueve el contenedor exterior de `bu-ext2d` a `bu-core2d`, que es
    // exactamente el error que comete quien lee el fichero de memoria.
    const roto = mutar(
      mutar(BUILDING.texto, '<bu-ext2d:geometry>', '<bu-core2d:geometry2>'),
      '</bu-ext2d:geometry>',
      '</bu-core2d:geometry2>',
    )
    const r = parsearGmlBu(roto)
    expect(r.ok).toBe(true)
    expect(r.edificio.anillos).toEqual([])
    expect(tipos(r)).toContain(TIPO_GML.POSLIST_INVALIDA)
    expect(deTipo(r, TIPO_GML.POSLIST_INVALIDA)[0].mensaje).toContain('bu-ext2d:geometry')
    expect(bloqueosBu(r)).toContain(TIPO_GML.POSLIST_INVALIDA)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El `Building`: dos patches y los siete atributos
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · el `bu-ext2d:Building` de la parcela de referencia', () => {
  const r = parsearGmlBu(BUILDING.texto)
  const oraculo = features(BUILDING)[0]

  it('se reconoce como dialecto BU y `ok` es `true`', () => {
    expect(r.ok).toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.dialecto).toBe(DIALECTO.BU)
    expect(r.nMiembros).toBe(1)
    expect(r.partes).toEqual([])
    expect(r.otras).toEqual([])
  })

  it('⚠️ NO devuelve `soportado`: en `gml/_comun.js` BU es `soportado:false`', () => {
    // La inversión de la cabecera, atestada: la tabla la escribió la rama de
    // parcela y allí BU no se soporta. Reexponer ese booleano habría marcado el
    // fichero bueno como no soportado.
    expect(Object.keys(r)).not.toContain('soportado')
    expect(DIALECTOS.find((d) => d.id === DIALECTO.BU).soportado).toBe(false)
  })

  it('⛔ lee los DOS `gml:PolygonPatch` del único `gml:Surface` (5 + 53 = 58 puntos)', () => {
    expect(dentro(oraculo, NS.gml, 'Surface')).toHaveLength(1)
    expect(dentro(oraculo, NS.gml, 'PolygonPatch')).toHaveLength(2)
    expect(countsDe(oraculo)).toEqual([5, 53])
    // Y el lector devuelve LOS DOS anillos, ya abiertos (count − 1 cada uno).
    expect(r.edificio.anillos.map((a) => a.length)).toEqual([4, 52])
    expect(r.edificio.huecos).toEqual([])
    // Quedarse con el primero perdería 53 de los 58 puntos, en silencio.
    expect(r.edificio.anillos[1]).toHaveLength(52)
  })

  it('avisa de los patches múltiples con severidad INFO (en parcela sería ERROR)', () => {
    const d = deTipo(r, TIPO_GML.MULTIPLES_CARAS)
    expect(d).toHaveLength(1)
    expect(d[0].severidad).toBe(SEVERIDAD.INFO)
    expect(d[0].datos.caras).toBe(2)
    expect(d[0].datos.vertices).toEqual([4, 52])
    expect(bloqueosBu(r)).not.toContain(TIPO_GML.MULTIPLES_CARAS)
  })

  it('0 `gml:interior` en todo el fichero', () => {
    expect(dentro(BUILDING.raiz, NS.gml, 'interior')).toHaveLength(0)
    expect(r.edificio.huecos).toHaveLength(0)
  })

  it('identidad: `gml:id`, `localId` y la referencia catastral de `externalReference`', () => {
    expect(r.edificio.gmlId).toBe(oraculo.getAttributeNS(NS.gml, 'id'))
    expect(r.edificio.gmlId).toBe('ES.SDGC.BU.9398516VK3799G')
    expect(r.edificio.localId).toBe('9398516VK3799G')
    expect(r.edificio.refcat).toBe(textoDe(oraculo, NS_BU.core2d, 'reference'))
    expect(r.edificio.refcat).toBe('9398516VK3799G')
  })

  it('los atributos semánticos salen CRUDOS, sin traducir a vocabulario del modelo', () => {
    expect(r.edificio.conditionOfConstruction).toBe('functional')
    expect(r.edificio.currentUse).toBe('1_residential')
    expect(r.edificio.numberOfBuildingUnits).toBe(18)
    expect(r.edificio.numberOfDwellings).toBe(17)
    // Contra el oráculo, para que ninguno de los cuatro sea un literal de aquí.
    expect(r.edificio.conditionOfConstruction).toBe(
      textoDe(oraculo, NS_BU.core2d, 'conditionOfConstruction'),
    )
    expect(r.edificio.currentUse).toBe(textoDe(oraculo, NS_BU.ext2d, 'currentUse'))
    expect(String(r.edificio.numberOfBuildingUnits)).toBe(
      textoDe(oraculo, NS_BU.ext2d, 'numberOfBuildingUnits'),
    )
    expect(String(r.edificio.numberOfDwellings)).toBe(
      textoDe(oraculo, NS_BU.ext2d, 'numberOfDwellings'),
    )
    // Y NADA está traducido: no aparece por ninguna parte el vocabulario del modelo.
    expect(JSON.stringify(r.edificio)).not.toContain('FUNCIONAL')
    expect(JSON.stringify(r.edificio)).not.toContain('usoDominante')
    expect(JSON.stringify(r.edificio)).not.toContain('superficieConstruida')
  })

  it('⛔ `numberOfFloorsAboveGround` viene `xsi:nil`: sale `null` Y se distingue de «ausente»', () => {
    expect(nilDe(oraculo, NS_BU.ext2d, 'numberOfFloorsAboveGround')).toBe('other:unpopulated')
    expect(r.edificio.numberOfFloorsAboveGround).toBeNull()
    expect(r.edificio.nils.numberOfFloorsAboveGround).toBe('other:unpopulated')
    // La otra mitad: un elemento AUSENTE también da `null`, y ahí `nils` no lo tiene.
    const sinElemento = mutar(
      BUILDING.texto,
      '<bu-ext2d:numberOfFloorsAboveGround xsi:nil="true" nilReason="other:unpopulated">' +
        '</bu-ext2d:numberOfFloorsAboveGround>',
      '',
    )
    const s = parsearGmlBu(sinElemento)
    expect(s.edificio.numberOfFloorsAboveGround).toBeNull()
    expect(Object.hasOwn(s.edificio.nils, 'numberOfFloorsAboveGround')).toBe(false)
  })

  it('`dateOfConstruction` va al 1 de ENERO, en `beginning` y en `end`', () => {
    const evento = dentro(oraculo, NS_BU.core2d, 'DateOfEvent')[0]
    expect(r.edificio.dateOfConstruction).toEqual({
      beginning: textoDe(evento, NS_BU.core2d, 'beginning'),
      end: textoDe(evento, NS_BU.core2d, 'end'),
    })
    expect(r.edificio.dateOfConstruction.beginning).toBe('1997-01-01T00:00:00')
    expect(r.edificio.dateOfConstruction.end).toBe('1997-01-01T00:00:00')
    // Y el 1 de enero no es una coincidencia de este fichero: el otro Building
    // real dice 2004-01-01. El Catastro guarda el AÑO, no el día.
    expect(parsearGmlBu(TODO_RUSTICA.texto).edificio.dateOfConstruction).toEqual({
      beginning: '2004-01-01T00:00:00',
      end: '2004-01-01T00:00:00',
    })
  })

  it('`officialArea` sale como lista, con su referencia CRUDA y su `uom`', () => {
    const valor = dentro(oraculo, NS_BU.ext2d, 'value')[0]
    expect(r.edificio.officialArea).toEqual([
      {
        referencia: 'grossFloorArea',
        valor: 2513,
        uom: 'm2',
      },
    ])
    expect(r.edificio.officialArea[0].referencia).toBe(
      textoDe(oraculo, NS_BU.ext2d, 'officialAreaReference'),
    )
    expect(String(r.edificio.officialArea[0].valor)).toBe(valor.textContent.trim())
    expect(r.edificio.officialArea[0].uom).toBe(valor.getAttribute('uom'))
  })

  it('no lo estropea el envoltorio: el mismo Building llega igual por el `wfsBU` vivo', () => {
    // `wfsbu-allconstruction-*.xml` es la respuesta REAL del servicio del
    // 2026-08-03; `bu_building_*.gml` es el fixture de julio. Si el servicio
    // hubiera cambiado, esto cae.
    const vivo = parsearGmlBu(TODO.texto).edificio
    expect(vivo.gmlId).toBe(r.edificio.gmlId)
    expect(vivo.anillos).toEqual(r.edificio.anillos)
    expect(vivo.currentUse).toBe(r.edificio.currentUse)
    expect(vivo.officialArea).toEqual(r.edificio.officialArea)
    expect(vivo.dateOfConstruction).toEqual(r.edificio.dateOfConstruction)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Las TRECE partes
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · los trece `bu-ext2d:BuildingPart`', () => {
  const r = parsearGmlBu(PARTES.texto)
  const oraculo = features(PARTES)

  it('son 13, y sus `localId` van de part1 a part13 en orden de documento', () => {
    expect(r.partes).toHaveLength(13)
    expect(r.nMiembros).toBe(13)
    expect(r.edificio).toBeNull()
    expect(r.otras).toEqual([])
    expect(r.partes.map((p) => p.localId)).toEqual(
      oraculo.map((f) => textoDe(f, 'urn:x-inspire:specification:gmlas:BaseTypes:3.2', 'localId')),
    )
    expect(r.partes.map((p) => p.localId)).toEqual(
      Array.from({ length: 13 }, (_, i) => `9398516VK3799G_part${i + 1}`),
    )
  })

  it('1 `gml:PolygonPatch` y 0 `gml:interior` en cada una', () => {
    expect(oraculo.map((f) => dentro(f, NS.gml, 'PolygonPatch').length)).toEqual(Array(13).fill(1))
    expect(oraculo.map((f) => dentro(f, NS.gml, 'interior').length)).toEqual(Array(13).fill(0))
    expect(r.partes.map((p) => p.anillos.length)).toEqual(Array(13).fill(1))
    expect(r.partes.map((p) => p.huecos.length)).toEqual(Array(13).fill(0))
    // Con un solo patch NO se emite MULTIPLES_CARAS: ese aviso es del Building.
    expect(deTipo(r, TIPO_GML.MULTIPLES_CARAS)).toEqual([])
  })

  it('⛔ el `count` cuenta el punto de CIERRE: 13 anillos con un vértice menos', () => {
    const counts = oraculo.map((f) => countsDe(f)[0])
    // Lo que dice el fichero, leído del fichero.
    expect(counts).toEqual([5, 11, 16, 6, 20, 7, 22, 6, 7, 36, 8, 7, 7])
    // Y el `count` coincide con los pares REALMENTE escritos, cierre incluido.
    expect(oraculo.map((f) => paresDe(f)[0])).toEqual(counts)
    // El modelo los guarda ABIERTOS (regla de oro 4): uno menos, siempre.
    expect(r.partes.map((p) => p.anillos[0].length)).toEqual(counts.map((c) => c - 1))
    expect(r.partes.map((p) => p.anillos[0].length)).toEqual([
      4, 10, 15, 5, 19, 6, 21, 5, 6, 35, 7, 6, 6,
    ])
    // Y se dice una vez por anillo, sin sepultar nada.
    expect(deTipo(r, TIPO_GML.CIERRE_RETIRADO)).toHaveLength(13)
    expect(deTipo(r, TIPO_GML.CIERRE_RETIRADO)[9].datos).toMatchObject({ antes: 36, despues: 35 })
    expect(deTipo(r, TIPO_GML.COUNT_DISCREPANTE)).toEqual([])
  })

  it('el primer y el último vértice del anillo abierto son los del fichero, sin el cierre', () => {
    const crudos = dentro(oraculo[0], NS.gml, 'posList')[0].textContent.trim().split(/\s+/).map(Number)
    const anillo = r.partes[0].anillos[0]
    expect(anillo[0]).toEqual([crudos[0], crudos[1]])
    expect(anillo[anillo.length - 1]).toEqual([crudos[6], crudos[7]])
    // Y el par retirado era EXACTAMENTE el primero repetido.
    expect([crudos[8], crudos[9]]).toEqual(anillo[0])
  })

  it('⭐ LAS TRECE traen las dos plantas, no solo `part10`', () => {
    const arriba = oraculo.map((f) =>
      Number(textoDe(f, NS_BU.ext2d, 'numberOfFloorsAboveGround')),
    )
    const abajo = oraculo.map((f) => Number(textoDe(f, NS_BU.ext2d, 'numberOfFloorsBelowGround')))
    expect(r.partes.map((p) => p.numberOfFloorsAboveGround)).toEqual(arriba)
    expect(r.partes.map((p) => p.numberOfFloorsBelowGround)).toEqual(abajo)
    expect(arriba).toEqual([1, 7, 7, 6, 7, 6, 7, 6, 6, 0, 6, 6, 6])
    expect(abajo).toEqual([0, 0, 1, 0, 1, 0, 1, 1, 1, 1, 1, 1, 1])
    // Ninguna sale `null`: buscarlas en `bu-core2d` habría dado 13 nulls.
    expect(r.partes.filter((p) => p.numberOfFloorsAboveGround === null)).toEqual([])
  })

  it('⛔ `part10` es la ÚNICA solo bajo rasante (desviación 10 del plan)', () => {
    const soloBajo = r.partes.filter(
      (p) => p.numberOfFloorsAboveGround === 0 && p.numberOfFloorsBelowGround > 0,
    )
    expect(soloBajo).toHaveLength(1)
    expect(soloBajo[0].localId).toBe('9398516VK3799G_part10')
    expect(r.partes[9]).toBe(soloBajo[0])
    expect(soloBajo[0].heightBelowGround).toBe(3)
    expect(soloBajo[0].heightBelowGroundUom).toBe('m')
    // Y el lector NO la descarta ni la marca: la devuelve entera, con sus 35
    // vértices. Quien decida qué hacer con ella es `edificio/entrada.js`.
    expect(soloBajo[0].anillos[0]).toHaveLength(35)
  })

  it('`heightBelowGround` sale de las trece, con su `uom`, y no solo de `part10`', () => {
    expect(r.partes.map((p) => p.heightBelowGround)).toEqual(
      oraculo.map((f) => Number(textoDe(f, NS_BU.ext2d, 'heightBelowGround'))),
    )
    expect(r.partes.map((p) => p.heightBelowGround)).toEqual([0, 0, 3, 0, 3, 0, 3, 3, 3, 3, 3, 3, 3])
    expect(r.partes.map((p) => p.heightBelowGroundUom)).toEqual(Array(13).fill('m'))
  })

  it('⛔ `conditionOfConstruction` es `xsi:nil` en LAS TRECE ⇒ el estado sale del Building', () => {
    expect(oraculo.map((f) => nilDe(f, NS_BU.core2d, 'conditionOfConstruction'))).toEqual(
      Array(13).fill('other:unpopulated'),
    )
    expect(r.partes.map((p) => p.conditionOfConstruction)).toEqual(Array(13).fill(null))
    expect(r.partes.map((p) => p.nils.conditionOfConstruction)).toEqual(
      Array(13).fill('other:unpopulated'),
    )
    // Y el único sitio del proyecto donde ese dato tiene valor es el `Building`.
    expect(parsearGmlBu(BUILDING.texto).edificio.conditionOfConstruction).toBe('functional')
  })

  it('la referencia catastral sale del `xlink:href`, porque las partes no traen `reference`', () => {
    // Medido: `bu-core2d:reference` solo lo lleva el Building. Cortar el
    // `localId` por longitud fallaría con `_PI.1`, así que se lee el `refcat=`
    // con el que el propio servicio enlaza la parcela.
    expect(dentro(oraculo[0], NS_BU.core2d, 'reference')).toHaveLength(0)
    expect(r.partes.map((p) => p.refcat)).toEqual(Array(13).fill('9398516VK3799G'))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · ⭐ La piscina: el tercer tipo, que no estaba en ningún fixture de F00
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · `bu-ext2d:OtherConstruction`, la piscina (T0.1·7)', () => {
  const r = parsearGmlBu(TODO.texto)
  const oraculo = features(TODO)[1]

  it('la respuesta viva trae DOS miembros: un Building y una otra construcción', () => {
    expect(r.ok).toBe(true)
    expect(r.nMiembros).toBe(2)
    expect(r.edificio).not.toBeNull()
    expect(r.partes).toEqual([])
    expect(r.otras).toHaveLength(1)
  })

  it('⛔ su geometría es `gml:Polygon` DIRECTO, no `Surface/patches/PolygonPatch`', () => {
    const contenedor = dentro(oraculo, NS_BU.ext2d, 'geometry')[0]
    expect(contenedor.firstElementChild.localName).toBe('Polygon')
    expect(contenedor.firstElementChild.namespaceURI).toBe(NS.gml)
    expect(dentro(oraculo, NS.gml, 'Surface')).toHaveLength(0)
    expect(dentro(oraculo, NS.gml, 'PolygonPatch')).toHaveLength(0)
    // Y en el MISMO documento el Building sí usa Surface + patches: son dos
    // formas conviviendo en una sola respuesta del mismo endpoint.
    expect(dentro(features(TODO)[0], NS.gml, 'PolygonPatch')).toHaveLength(2)
  })

  it('⭐ se lee ENTERA: 19 pares con cierre → 18 vértices, primero y último incluidos', () => {
    expect(countsDe(oraculo)).toEqual([19])
    const anillo = r.otras[0].anillos[0]
    expect(anillo).toHaveLength(18)
    const crudos = dentro(oraculo, NS.gml, 'posList')[0].textContent.trim().split(/\s+/).map(Number)
    expect(anillo[0]).toEqual([crudos[0], crudos[1]])
    expect(anillo[17]).toEqual([crudos[34], crudos[35]])
    expect(anillo[0]).toEqual([439261.19, 4479673.05])
    expect(anillo[17]).toEqual([439260.87, 4479672.54])
    expect(r.otras[0].huecos).toEqual([])
  })

  it('`constructionNature` sale CRUDO y el `gml:id` conserva su sufijo `_PI.1`', () => {
    expect(r.otras[0].constructionNature).toBe('openAirPool')
    expect(r.otras[0].constructionNature).toBe(textoDe(oraculo, NS_BU.ext2d, 'constructionNature'))
    expect(r.otras[0].gmlId).toBe('ES.SDGC.BU.9398516VK3799G_PI.1')
    expect(r.otras[0].localId).toBe('9398516VK3799G_PI.1')
    // La referencia catastral NO se saca cortando el localId: sale del href.
    expect(r.otras[0].refcat).toBe('9398516VK3799G')
    expect(r.otras[0].localId).not.toBe(r.otras[0].refcat)
  })

  it('su `conditionOfConstruction` también viene `xsi:nil`, como en las partes', () => {
    expect(r.otras[0].conditionOfConstruction).toBeNull()
    expect(r.otras[0].nils.conditionOfConstruction).toBe('other:unpopulated')
  })

  it('`constructionNature` NO existe en el Building: es propio de este tipo', () => {
    expect(dentro(features(TODO)[0], NS_BU.ext2d, 'constructionNature')).toHaveLength(0)
    expect(Object.hasOwn(r.edificio, 'constructionNature')).toBe(false)
  })

  it('el mismo tipo con la forma `Surface` también se leería (no se exige una sola)', () => {
    const conSurface = mutar(
      mutar(
        TODO.texto,
        '<gml:Polygon gml:id="Polygon_ES.SDGC.BU.9398516VK3799G_PI.1" ' +
          'srsName="urn:ogc:def:crs:EPSG::25830">',
        '<gml:Surface gml:id="S_PI1" srsName="urn:ogc:def:crs:EPSG::25830"><gml:patches>' +
          '<gml:PolygonPatch>',
      ),
      '</gml:Polygon>',
      '</gml:PolygonPatch></gml:patches></gml:Surface>',
    )
    const s = parsearGmlBu(conSurface)
    expect(s.ok).toBe(true)
    expect(s.otras[0].anillos[0]).toHaveLength(18)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · El sistema de referencia: URN en todos los portadores
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · `srsName` en URN, literal y coherente (override O10)', () => {
  it('los 13 `gml:Surface` de las partes lo llevan, y es la MISMA URN', () => {
    const portadores = todos(PARTES).filter((e) => e.hasAttribute('srsName'))
    expect(portadores).toHaveLength(13)
    expect(portadores.map((e) => e.localName)).toEqual(Array(13).fill('Surface'))
    expect([...new Set(portadores.map((e) => e.getAttribute('srsName')))]).toEqual([
      'urn:ogc:def:crs:EPSG::25830',
    ])
  })

  it('el `Building` lo lleva en su `gml:Surface` Y en el `gml:Envelope` del `boundedBy`', () => {
    const portadores = todos(BUILDING).filter((e) => e.hasAttribute('srsName'))
    expect(portadores.map((e) => e.localName).sort()).toEqual(['Envelope', 'Surface'])
    expect([...new Set(portadores.map((e) => e.getAttribute('srsName')))]).toEqual([
      'urn:ogc:def:crs:EPSG::25830',
    ])
    // Y en la respuesta viva son cuatro: Envelope+Surface del Building y
    // Envelope+Polygon de la piscina.
    expect(
      todos(TODO)
        .filter((e) => e.hasAttribute('srsName'))
        .map((e) => e.localName)
        .sort(),
    ).toEqual(['Envelope', 'Envelope', 'Polygon', 'Surface'])
  })

  it('`srsName` sale LITERAL (sin normalizar) y `srs` en forma corta', () => {
    for (const a of [BUILDING, PARTES, TODO, TODO_RUSTICA]) {
      const r = parsearGmlBu(a.texto)
      expect(r.srsName, a.nombre).toBe('urn:ogc:def:crs:EPSG::25830')
      expect(r.srs, a.nombre).toBe('EPSG:25830')
    }
    // La URN es la forma canónica del dialecto BU, así que NO se avisa de forma.
    expect(DIALECTOS.find((d) => d.id === DIALECTO.BU).formaSrsName).toBe(FORMA_SRSNAME.URN)
    expect(deTipo(parsearGmlBu(PARTES.texto), TIPO_GML.SRS_FORMA_INESPERADA)).toEqual([])
  })

  it('la URI OGC se lee igual, pero se dice que no es la forma de este dialecto', () => {
    const enUri = mutar(
      PARTES.texto,
      'urn:ogc:def:crs:EPSG::25830',
      srsNameUri('EPSG:25830'),
      13,
    )
    const r = parsearGmlBu(enUri)
    expect(r.srs).toBe('EPSG:25830')
    expect(r.srsName).toBe(srsNameUri('EPSG:25830'))
    expect(deTipo(r, TIPO_GML.SRS_FORMA_INESPERADA)).toHaveLength(1)
    expect(deTipo(r, TIPO_GML.SRS_FORMA_INESPERADA)[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(r.partes).toHaveLength(13)
  })

  it('dos `srsName` distintos en el mismo fichero ⇒ `SRS_INCOHERENTE` y `srs: null`', () => {
    const incoherente = mutar(
      PARTES.texto,
      'Surface_ES.SDGC.BU.9398516VK3799G_part7" srsName="urn:ogc:def:crs:EPSG::25830',
      'Surface_ES.SDGC.BU.9398516VK3799G_part7" srsName="urn:ogc:def:crs:EPSG::25831',
    )
    const r = parsearGmlBu(incoherente)
    expect(deTipo(r, TIPO_GML.SRS_INCOHERENTE)).toHaveLength(1)
    expect(r.srs).toBeNull()
    // La geometría se lee igual: el diagnóstico necesita los dos términos.
    expect(r.partes).toHaveLength(13)
    expect(bloqueosBu(r)).toContain(TIPO_GML.SRS_INCOHERENTE)
  })

  it('un EPSG fuera de los tres soportados se rechaza NOMBRÁNDOLO', () => {
    // El patrón es la URN COMPLETA y no `EPSG::25830` a secas: esa cadena corta
    // aparece 39 veces en el fixture, porque los `xlink:href` de `addresses` y
    // `cadastralParcels` la llevan también en su `srsname=`. `mutar` lo cazó.
    const wgs = mutar(
      PARTES.texto,
      'urn:ogc:def:crs:EPSG::25830',
      'urn:ogc:def:crs:EPSG::4326',
      13,
    )
    const r = parsearGmlBu(wgs)
    expect(deTipo(r, TIPO_GML.SRS_NO_SOPORTADO)).toHaveLength(1)
    expect(deTipo(r, TIPO_GML.SRS_NO_SOPORTADO)[0].mensaje).toContain('EPSG:4326')
    expect(r.srs).toBeNull()
    expect(r.srsName).toBe('urn:ogc:def:crs:EPSG::4326')
  })

  it('sin ningún `srsName` y CON features ⇒ `SRS_AUSENTE` de nivel ERROR', () => {
    const sinSrs = mutar(PARTES.texto, ' srsName="urn:ogc:def:crs:EPSG::25830"', '', 13)
    const r = parsearGmlBu(sinSrs)
    expect(deTipo(r, TIPO_GML.SRS_AUSENTE)).toHaveLength(1)
    expect(deTipo(r, TIPO_GML.SRS_AUSENTE)[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(r.srs).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · ⭐ La colección VACÍA no es un error
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · la colección vacía es el punto de partida de la obra nueva (T0.1·5)', () => {
  const r = parsearGmlBu(VACIA.texto)

  it('cero `gml:featureMember`, y aun así `ok: true`', () => {
    expect(features(VACIA)).toHaveLength(0)
    expect(r.ok).toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.dialecto).toBe(DIALECTO.BU)
    expect(r.nMiembros).toBe(0)
    expect(r.edificio).toBeNull()
    expect(r.partes).toEqual([])
    expect(r.otras).toEqual([])
  })

  it('lo dice con un `SIN_MIEMBROS` de nivel INFO, y NO bloquea', () => {
    const d = deTipo(r, TIPO_GML.SIN_MIEMBROS)
    expect(d).toHaveLength(1)
    expect(d[0].severidad).toBe(SEVERIDAD.INFO)
    expect(d[0].mensaje).toContain('No es un error')
    expect(bloqueosBu(r)).toEqual([])
    expect(resumirDeteccionesBu(r).porSeveridad.ERROR).toBe(0)
  })

  it('no inventa un `SRS_AUSENTE`: sin coordenadas no falta ningún `srsName`', () => {
    expect(deTipo(r, TIPO_GML.SRS_AUSENTE)).toEqual([])
    expect(r.srs).toBeNull()
    expect(r.srsName).toBeNull()
  })

  it('se clasifica como BU aunque no haya feature del que sacar el namespace', () => {
    // Sin miembros, la raíz `gml:FeatureCollection` es ambigua entre tres
    // dialectos y `clasificarDialecto` devuelve DESCONOCIDO, con razón. El
    // desempate es el `gml:id` de la raíz, que el `wfsBU` fija en ES.SDGC.BU.
    expect(VACIA.raiz.getAttributeNS(NS.gml, 'id')).toBe(ID_RAIZ_BU)
    const conOtroId = mutar(VACIA.texto, `gml:id="${ID_RAIZ_BU}"`, 'gml:id="ES.LOCAL.CP"')
    const otro = parsearGmlBu(conOtroId)
    expect(otro.ok).toBe(false)
    expect(tipos(otro)).toContain(TIPO_GML.RAIZ_INESPERADA)
  })

  it('la mitad anti-vacuidad: la MISMA referencia catastral SÍ trae Building por otra vía', () => {
    // `13005A10900001` responde 0 miembros a `GetOtherBuildingByParcel` y 1 a
    // `GetAllConstructionByParcel`. Eso es lo que demuestra que el vacío
    // significa «no hay nada de ese tipo» y no «esa parcela no existe».
    const conConstruccion = parsearGmlBu(TODO_RUSTICA.texto)
    expect(conConstruccion.nMiembros).toBe(1)
    expect(conConstruccion.edificio.refcat).toBe('13005A10900001')
    expect(conConstruccion.edificio.currentUse).toBe('2_agriculture')
    // Y ese Building trae UN patch, no dos: «2 patches» es del edificio de
    // referencia, no una constante del dialecto.
    expect(conConstruccion.edificio.anillos.map((a) => a.length)).toEqual([4])
    expect(deTipo(conConstruccion, TIPO_GML.MULTIPLES_CARAS)).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Un GML de parcela NO es un GML de edificio (y al revés tampoco)
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · el lector se niega a leer una parcela, NOMBRÁNDOLA', () => {
  it('los tres GML de parcela salen `ok:false` con `DIALECTO_OTRO_TEMA`', () => {
    const esperado = [DIALECTO.CP_4_0_WFS, DIALECTO.CP_4_0_ENTREGA, DIALECTO.CP_3_0]
    CP.forEach((a, i) => {
      const r = parsearGmlBu(a.texto)
      expect(r.ok, a.nombre).toBe(false)
      expect(r.dialecto, a.nombre).toBe(esperado[i])
      expect(r.motivo, a.nombre).toContain('parcela')
      expect(tipos(r), a.nombre).toContain(TIPO_GML.DIALECTO_OTRO_TEMA)
      expect(r.edificio, a.nombre).toBeNull()
      expect(r.partes, a.nombre).toEqual([])
      expect(r.otras, a.nombre).toEqual([])
    })
  })

  it('el mensaje dice QUÉ es y a dónde ir, no «esto no vale» a secas', () => {
    const d = deTipo(parsearGmlBu(CP[0].texto), TIPO_GML.DIALECTO_OTRO_TEMA)[0]
    expect(d.severidad).toBe(SEVERIDAD.ERROR)
    expect(d.mensaje).toContain('parsearGml')
    expect(d.mensaje).toContain(DIALECTOS.find((x) => x.id === DIALECTO.CP_4_0_WFS).motivo)
  })

  it('⚠️ y `gml/parse.js` SIGUE negándose a leer los BU: no se ha reescrito, se completa', () => {
    // La otra mitad de la simetría. El clasificador de F04 ya daba un mensaje
    // bueno (`gml/parse.js:1135-1147`) y esta tarea no lo tocó.
    for (const a of [BUILDING, PARTES, TODO]) {
      const r = parsearGml(a.texto)
      expect(r.dialecto, a.nombre).toBe(DIALECTO.BU)
      expect(r.parcelas, a.nombre).toEqual([])
      expect(r.detecciones.map((d) => d.tipo), a.nombre).toContain(TIPO_GML.DIALECTO_OTRO_TEMA)
    }
    // Y la colección vacía: para la rama de parcela es un fichero sin clasificar
    // (no hay feature), lo que confirma que el desempate por `gml:id` es cosa de
    // este lector y no un cambio en el compartido.
    expect(parsearGml(VACIA.texto).dialecto).toBe(DIALECTO.DESCONOCIDO)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Un fichero roto produce detecciones, JAMÁS una excepción
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · ningún contenido hace lanzar a `parsearGmlBu` (la lección de F08)', () => {
  it('XML sin cerrar → `ok:false` con `XML_MAL_FORMADO`, sin throw', () => {
    const roto = mutar(BUILDING.texto, '</bu-ext2d:Building>', '')
    let r
    expect(() => {
      r = parsearGmlBu(roto)
    }).not.toThrow()
    expect(r.ok).toBe(false)
    expect(r.motivo).toContain('XML')
    expect(tipos(r)).toContain(TIPO_GML.XML_MAL_FORMADO)
    expect(bloqueosBu(r)).toEqual([TIPO_GML.XML_MAL_FORMADO])
  })

  it('cadena vacía, espacios y basura: `ok:false` y ni una excepción', () => {
    for (const basura of ['', '   ', 'no soy XML', '<', '{"json": true}', '<a><b/></a>']) {
      let r
      expect(() => {
        r = parsearGmlBu(basura)
      }, JSON.stringify(basura)).not.toThrow()
      expect(r.ok, JSON.stringify(basura)).toBe(false)
      expect(typeof r.motivo, JSON.stringify(basura)).toBe('string')
      expect(r.partes, JSON.stringify(basura)).toEqual([])
    }
  })

  it('un `posList` con letras se rechaza sin tirar el fichero entero', () => {
    const conLetras = mutar(PARTES.texto, '439228.84 4479666.09 439227.62', 'x 4479666.09 439227.62')
    const r = parsearGmlBu(conLetras)
    expect(r.ok).toBe(true)
    expect(deTipo(r, TIPO_GML.POSLIST_INVALIDA)).toHaveLength(1)
    expect(r.partes[0].anillos).toEqual([])
    // Las otras DOCE se leen igual: un anillo malo no se lleva por delante el resto.
    expect(r.partes.slice(1).every((p) => p.anillos.length === 1)).toBe(true)
  })

  it('un anillo sin cerrar se devuelve tal cual y se DICE (no se cierra por nuestra cuenta)', () => {
    const abierto = mutar(
      PARTES.texto,
      '439230.66 4479667.12 439228.84 4479666.09</gml:posList>',
      '439230.66 4479667.12</gml:posList>',
    )
    const r = parsearGmlBu(abierto)
    const d = deTipo(r, TIPO_GML.ANILLO_NO_CERRADO)
    expect(d).toHaveLength(1)
    expect(d[0].severidad).toBe(SEVERIDAD.ERROR)
    expect(r.partes[0].anillos[0]).toHaveLength(4)
    expect(deTipo(r, TIPO_GML.CIERRE_RETIRADO)).toHaveLength(12)
  })

  it('un `count` que no cuadra se avisa, y manda la lista', () => {
    const malCount = mutar(PARTES.texto, 'srsDimension="2" count="36"', 'srsDimension="2" count="35"')
    const r = parsearGmlBu(malCount)
    const d = deTipo(r, TIPO_GML.COUNT_DISCREPANTE)
    expect(d).toHaveLength(1)
    expect(d[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(d[0].datos).toMatchObject({ count: '35', pares: 36 })
    expect(r.partes[9].anillos[0]).toHaveLength(35)
  })

  it('un `srsDimension` distinto de 2 se avisa y se sigue emparejando de dos en dos', () => {
    const tresD = mutar(PARTES.texto, 'srsDimension="2" count="5"', 'srsDimension="3" count="5"')
    const r = parsearGmlBu(tresD)
    expect(deTipo(r, TIPO_GML.SRS_DIMENSION_INESPERADA)).toHaveLength(1)
    expect(r.partes[0].anillos[0]).toHaveLength(4)
  })

  it('un `Building` sin geometría se lee igual: los atributos siguen sirviendo', () => {
    const sinGeo = mutar(
      BUILDING.texto.replace(
        /<bu-ext2d:geometry>[\s\S]*?<\/bu-ext2d:geometry>/,
        '<bu-ext2d:geometry></bu-ext2d:geometry>',
      ),
      '<bu-ext2d:geometry></bu-ext2d:geometry>',
      '',
    )
    const r = parsearGmlBu(sinGeo)
    expect(r.ok).toBe(true)
    expect(r.edificio.anillos).toEqual([])
    expect(r.edificio.currentUse).toBe('1_residential')
    expect(deTipo(r, TIPO_GML.POSLIST_INVALIDA)[0].mensaje).toContain('bu-ext2d:geometry')
  })

  it('un valor numérico ilegible sale `null` y se NOMBRA el elemento', () => {
    const malo = mutar(
      BUILDING.texto,
      '<bu-ext2d:numberOfDwellings>17</bu-ext2d:numberOfDwellings>',
      '<bu-ext2d:numberOfDwellings>diecisiete</bu-ext2d:numberOfDwellings>',
    )
    const r = parsearGmlBu(malo)
    expect(r.edificio.numberOfDwellings).toBeNull()
    const d = deTipo(r, TIPO_GML.AREA_DECLARADA_DISCREPANTE)
    expect(d).toHaveLength(1)
    expect(d[0].mensaje).toContain('bu-ext2d:numberOfDwellings')
    expect(d[0].mensaje).toContain('diecisiete')
    expect(d[0].severidad).toBe(SEVERIDAD.AVISO)
  })

  it('⛔ un `refcat=` porcentaje-mal-escapado en el xlink:href no lanza: se usa crudo y se DICE', () => {
    // `decodeURIComponent('%E9')` lanza URIError, y `%E9` es exactamente lo que
    // emite un servicio que escape en ISO-8859-1 una referencia con «é». Antes
    // de la corrección, `leerRefcat` hacía reventar a `parsearGmlBu` con el
    // fichero del usuario, violando su propia cabecera («NO LANZA por el
    // contenido», SPEC §2.1). El número de sustituciones se LEE del fixture
    // (regla de oro 8): 13 partes con `cadastralParcels` y `addresses`.
    const veces = PARTES.texto.split('refcat=9398516VK3799G').length - 1
    expect(veces).toBeGreaterThan(0)
    const mutado = mutar(PARTES.texto, 'refcat=9398516VK3799G', 'refcat=%E9', veces)
    let r
    expect(() => {
      r = parsearGmlBu(mutado)
    }).not.toThrow()
    expect(r.ok).toBe(true)
    // El valor se usa TAL CUAL venía: decodificarlo es imposible y recortarlo
    // sería inventar. Las trece partes lo leen del primer enlace que lo trae.
    expect(r.partes.map((p) => p.refcat)).toEqual(Array(13).fill('%E9'))
    // …y se deja constancia con un AVISO por parte, nombrando el enlace exacto.
    const d = deTipo(r, TIPO_GML.AREA_DECLARADA_DISCREPANTE).filter((x) => x.datos?.crudo === '%E9')
    expect(d).toHaveLength(13)
    expect(d[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(d[0].mensaje).toContain('bu-core2d:cadastralParcels')
    expect(d[0].mensaje).toContain('refcat')
  })

  it('y un `refcat=` BIEN escapado se sigue decodificando (la vía feliz no cambia)', () => {
    const veces = PARTES.texto.split('refcat=9398516VK3799G').length - 1
    const mutado = mutar(
      PARTES.texto,
      'refcat=9398516VK3799G',
      'refcat=9398516VK3799G%C3%A9',
      veces,
    )
    const r = parsearGmlBu(mutado)
    expect(r.ok).toBe(true)
    expect(r.partes.map((p) => p.refcat)).toEqual(Array(13).fill('9398516VK3799Gé'))
    expect(deTipo(r, TIPO_GML.AREA_DECLARADA_DISCREPANTE)).toEqual([])
  })

  it('un feature desconocido dentro del `featureMember` se deja fuera, con su ERROR', () => {
    // ⚠️ Los fixtures BU están en CRLF en el árbol de trabajo, así que ningún
    // patrón de este fichero puede llevar un `\n` literal: se recorta el bloque
    // con una expresión regular y se le cambia el nombre al elemento dentro.
    const bloque = PRIMER_MIEMBRO(PARTES.texto)
    expect(bloque).toContain('_part1')
    const raro = mutar(
      PARTES.texto,
      bloque,
      bloque
        .replace('<bu-ext2d:BuildingPart ', '<bu-ext2d:Chiringuito ')
        .replace('</bu-ext2d:BuildingPart>', '</bu-ext2d:Chiringuito>'),
    )
    const r = parsearGmlBu(raro)
    expect(r.ok).toBe(true)
    expect(r.partes).toHaveLength(12)
    expect(r.nMiembros).toBe(13)
    const d = deTipo(r, TIPO_GML.RAIZ_INESPERADA)
    expect(d).toHaveLength(1)
    expect(d[0].mensaje).toContain('Chiringuito')
    expect(d[0].datos.conocidos).toEqual(Object.values(FEATURE_BU))
  })

  it('DOS `Building` en el mismo fichero: se queda el primero y se DICE cuál se deja fuera', () => {
    const dos = BUILDING.texto.replace(
      '</gml:FeatureCollection>',
      `${/ {2}<gml:featureMember>[\s\S]*<\/gml:featureMember>/.exec(BUILDING.texto)[0].replace(
        'ES.SDGC.BU.9398516VK3799G"',
        'ES.SDGC.BU.OTRO"',
      )}\n</gml:FeatureCollection>`,
    )
    const r = parsearGmlBu(dos)
    expect(r.nMiembros).toBe(2)
    expect(r.edificio.gmlId).toBe('ES.SDGC.BU.9398516VK3799G')
    const d = deTipo(r, TIPO_GML.VARIOS_MIEMBROS)
    expect(d).toHaveLength(1)
    expect(d[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(d[0].datos).toMatchObject({ edificios: 2, fuera: [1] })
  })

  it('truncar el fichero por CUALQUIER sitio no lo hace lanzar nunca', () => {
    // Barrido bruto sobre el fichero real: 60 cortes repartidos. Ninguno puede
    // producir una excepción, porque el fichero lo trae un tercero.
    for (let i = 0; i < 60; i++) {
      const corte = Math.floor((PARTES.texto.length * i) / 60)
      expect(() => parsearGmlBu(PARTES.texto.slice(0, corte)), `corte en ${corte}`).not.toThrow()
    }
  })

  it('el tope de errores de XML está declarado y se puede derivar', () => {
    expect(Number.isInteger(MAX_ERRORES_XML_BU)).toBe(true)
    expect(MAX_ERRORES_XML_BU).toBeGreaterThan(0)
    const muchos = `<gml:FeatureCollection xmlns:gml="${NS.gml}">${'&raro; '.repeat(
      MAX_ERRORES_XML_BU + 5,
    )}</gml:FeatureCollection>`
    const r = parsearGmlBu(muchos)
    expect(deTipo(r, TIPO_GML.XML_MAL_FORMADO)).toHaveLength(MAX_ERRORES_XML_BU + 1)
    expect(deTipo(r, TIPO_GML.XML_MAL_FORMADO).at(-1).datos.detallados).toBe(MAX_ERRORES_XML_BU)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · El `throw` se reserva al contrato roto por el PROGRAMADOR
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · lo que SÍ lanza es el contrato del programador (SPEC §2.1)', () => {
  it('`xml` que no es un string', () => {
    for (const malo of [null, undefined, 42, {}, [], Symbol('x')]) {
      expect(() => parsearGmlBu(malo), String(malo?.toString?.() ?? malo)).toThrow(TypeError)
    }
    expect(() => parsearGmlBu(null)).toThrow(/YA DECODIFICADO/)
  })

  it('`opciones` que no es un objeto plano', () => {
    expect(() => parsearGmlBu(VACIA.texto, null)).toThrow(TypeError)
    expect(() => parsearGmlBu(VACIA.texto, [])).toThrow(TypeError)
    expect(() => parsearGmlBu(VACIA.texto, 'nada')).toThrow(TypeError)
    // Y un objeto vacío o ausente NO lanza: es el uso normal.
    expect(() => parsearGmlBu(VACIA.texto)).not.toThrow()
    expect(() => parsearGmlBu(VACIA.texto, {})).not.toThrow()
  })

  it('los dos ayudantes exigen el resultado de `parsearGmlBu`', () => {
    expect(() => bloqueosBu(null)).toThrow(TypeError)
    expect(() => bloqueosBu({})).toThrow(TypeError)
    expect(() => resumirDeteccionesBu('no')).toThrow(TypeError)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · La forma del contrato C, y que nada está traducido
// ═════════════════════════════════════════════════════════════════════════════

describe('F11 · contrato C: la forma exacta que consumen T2.1 y T2.2', () => {
  const CLAVES = [
    'ok',
    'motivo',
    'dialecto',
    'srs',
    'srsName',
    'edificio',
    'partes',
    'otras',
    'nMiembros',
    'detecciones',
  ]

  it('las diez claves salen SIEMPRE, también en los caminos de fallo', () => {
    for (const texto of [PARTES.texto, VACIA.texto, CP[0].texto, '', 'basura']) {
      expect(Object.keys(parsearGmlBu(texto)).sort()).toEqual([...CLAVES].sort())
    }
  })

  it('`partes` y `otras` son siempre arrays, y `edificio` siempre objeto o `null`', () => {
    for (const texto of [PARTES.texto, VACIA.texto, CP[2].texto, '<a/>']) {
      const r = parsearGmlBu(texto)
      expect(Array.isArray(r.partes)).toBe(true)
      expect(Array.isArray(r.otras)).toBe(true)
      expect(Array.isArray(r.detecciones)).toBe(true)
      expect(r.edificio === null || typeof r.edificio === 'object').toBe(true)
      expect(typeof r.nMiembros).toBe('number')
    }
  })

  it('cada parte trae las nueve claves del contrato, y ninguna de sobra', () => {
    const p = parsearGmlBu(PARTES.texto).partes[0]
    expect(Object.keys(p).sort()).toEqual(
      [
        'gmlId',
        'localId',
        'refcat',
        'anillos',
        'huecos',
        'numberOfFloorsAboveGround',
        'numberOfFloorsBelowGround',
        'heightBelowGround',
        'heightBelowGroundUom',
        'conditionOfConstruction',
        'nils',
      ].sort(),
    )
  })

  it('cada otra construcción trae las suyas', () => {
    const o = parsearGmlBu(TODO.texto).otras[0]
    expect(Object.keys(o).sort()).toEqual(
      [
        'gmlId',
        'localId',
        'refcat',
        'anillos',
        'huecos',
        'constructionNature',
        'conditionOfConstruction',
        'nils',
      ].sort(),
    )
  })

  it('los anillos son pares `[x, y]` de números finitos, ABIERTOS y sin reorientar', () => {
    const r = parsearGmlBu(TODO.texto)
    const todosLosAnillos = [...r.edificio.anillos, ...r.otras.flatMap((o) => o.anillos)]
    expect(todosLosAnillos.length).toBeGreaterThan(0)
    for (const anillo of todosLosAnillos) {
      expect(anillo.length).toBeGreaterThan(2)
      for (const par of anillo) {
        expect(par).toHaveLength(2)
        expect(Number.isFinite(par[0]) && Number.isFinite(par[1])).toBe(true)
      }
      // ABIERTO: el último no repite al primero.
      expect(anillo.at(-1)).not.toEqual(anillo[0])
    }
  })

  it('el módulo NO conoce `model/`: nada de su vocabulario asoma en la salida', () => {
    // Es la frontera que permite probar este lector contra el fichero real sin
    // arrastrar el modelo, y la que deja la traducción entera en T2.1.
    const fuente = readFileSync(join(RAIZ, 'gml', 'parse-bu.js'), 'utf8')
    const codigo = fuente
      .split('\n')
      .filter((l) => !/^\s*(?:\/\/|\/\*|\*)/.test(l))
      .join('\n')
    expect(codigo).not.toMatch(/from\s+['"]\.\.\/model\//)
    expect(codigo).not.toMatch(/from\s+['"]\.\/parse\.js['"]/)
    const serializado = JSON.stringify(parsearGmlBu(TODO.texto))
    for (const palabra of ['FUNCIONAL', 'RUINOSA', 'PRINCIPAL', 'COMPLETO', 'SIMPLIFICADO']) {
      expect(serializado, `«${palabra}» es vocabulario del modelo y no debe salir de aquí`).not.toContain(
        palabra,
      )
    }
  })

  it('`resumirDeteccionesBu` y `bloqueosBu` derivan de las detecciones, no de una lista', () => {
    const r = parsearGmlBu(PARTES.texto)
    const resumen = resumirDeteccionesBu(r)
    expect(resumen.total).toBe(r.detecciones.length)
    expect(resumen.porSeveridad.INFO + resumen.porSeveridad.AVISO + resumen.porSeveridad.ERROR).toBe(
      resumen.total,
    )
    expect(resumen.porTipo[TIPO_GML.CIERRE_RETIRADO]).toBe(13)
    expect(bloqueosBu(r)).toEqual([])
    // Y con un fichero roto, el bloqueo aparece exactamente una vez por tipo.
    const roto = parsearGmlBu(CP[0].texto)
    expect(bloqueosBu(roto)).toEqual([TIPO_GML.DIALECTO_OTRO_TEMA])
  })

  it('los cinco ficheros reales pasan sin un solo bloqueo', () => {
    for (const a of BU) {
      const r = parsearGmlBu(a.texto)
      expect(r.ok, a.nombre).toBe(true)
      expect(bloqueosBu(r), a.nombre).toEqual([])
    }
  })
})

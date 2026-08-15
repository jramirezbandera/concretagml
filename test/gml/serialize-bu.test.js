/* -------------------------------------------------------------------------- *
 * test/gml/serialize-bu.test.js — F13 · T2.6 · el serializador de EDIFICIO     *
 *                                                                              *
 * ⭐ La prueba que manda es la primera: **la diana de oro**. La huella que sale  *
 * de aquí se compara contra `bu_building_9398516VK3799G.gml`, que es el         *
 * `Building` que el PROPIO Catastro publica para esa parcela. No es un snapshot *
 * nuestro comparándose consigo mismo: es verdad externa (regla de oro 8).       *
 *                                                                              *
 * El resto cubre el dialecto —lo que lo distingue del de parcela y es fácil de  *
 * romper copiando de al lado—, el contrato `{xml, detecciones, resumen}`, la    *
 * trampa de `xs:ID`, y los guardianes que impiden que las tablas duplicadas     *
 * entre capas diverjan.                                                         *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  ESTADO_A_CONDICION,
  MODELO,
  NATURALEZA_OTRA,
  ORDEN_BUILDING,
  REFERENCIA_GEOMETRIA,
  serializarEdificioBu,
} from '../../gml/serialize-bu.js'
import { NAMESPACE_BU_CATASTRO, NAMESPACE_BU_DEFECTO } from '../../gml/ids.js'
import { parsearGmlBu, NS_BU } from '../../gml/parse-bu.js'
import { NS, SEVERIDAD } from '../../gml/_comun.js'
import { CONDICION_A_ESTADO } from '../../edificio/entrada.js'
import { entradaDesdeGmlBu } from '../../edificio/entrada.js'
import { envolventeDe } from '../../edificio/envolvente.js'
import { MODELO_EDIFICIO, ESTADO_CONSERVACION } from '../../model/edificio.js'

// ── Los dos ficheros reales ──────────────────────────────────────────────────
const leer = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const GML_PARTES = leer('../fixtures/gml/bu_buildingpart_9398516VK3799G.gml')
const GML_EDIFICIO = leer('../fixtures/gml/bu_building_9398516VK3799G.gml')
const REFCAT = '9398516VK3799G'
const SRS = 'EPSG:25830'

const EDIFICIO = entradaDesdeGmlBu(GML_PARTES).edificio
const ENVOLVENTE = envolventeDe(EDIFICIO.partes).recintos

/** La piscina real de la parcela, tal cual sale del `wfsBU`. */
const PISCINA = {
  nombre: 'Piscina',
  recinto: {
    vertices: [
      [439261.19, 4479673.05],
      [439275.2, 4479670.5],
      [439273.03, 4479664.43],
      [439262.02, 4479668.37],
    ],
    tipo: 'EXTERIOR',
  },
}

const serializar = (extra = {}) =>
  serializarEdificioBu({
    envolvente: ENVOLVENTE,
    srs: SRS,
    refcat: REFCAT,
    plantasSobreRasante: 7,
    estadoConservacion: ESTADO_CONSERVACION.FUNCIONAL,
    ...extra,
  })

/** Conjunto de vértices de un anillo, redondeado a 2 decimales y ordenado. */
const clave = (vs) =>
  vs
    .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
    .sort()
    .join('|')

// ── 1 · ⭐ LA DIANA DE ORO ───────────────────────────────────────────────────

describe('serializarEdificioBu · la huella contra el Building del Catastro', () => {
  const nuestro = parsearGmlBu(serializar().xml)
  const suyo = parsearGmlBu(GML_EDIFICIO)

  it('el fichero del Catastro trae DOS patches, y nosotros también', () => {
    expect(suyo.edificio.anillos).toHaveLength(2)
    expect(nuestro.edificio.anillos).toHaveLength(2)
  })

  it('⭐ los dos anillos coinciden VÉRTICE A VÉRTICE con los suyos', () => {
    // El orden de las piezas y el sentido de giro pueden no coincidir —nosotros
    // orientamos según el override O1 y ellos publican lo que publican—, así que
    // se comparan como CONJUNTOS de vértices redondeados. Lo que se afirma es que
    // la geometría es la misma, no que el fichero sea el mismo.
    const nuestros = nuestro.edificio.anillos.map(clave).sort()
    const suyos = suyo.edificio.anillos.map(clave).sort()
    expect(nuestros).toEqual(suyos)
  })

  it('y ninguno de los dos tiene huecos', () => {
    expect(suyo.edificio.huecos).toEqual([])
    expect(nuestro.edificio.huecos).toEqual([])
  })

  it('la huella mide 322,13 m²: el sótano (la parte MAYOR) queda fuera', () => {
    // 5,20 + 316,93. `Parte 10` tiene 245,90 m² y 0 plantas sobre rasante: es un
    // sótano, y el Catastro también lo excluye de su Building.
    expect(serializar().resumen.superficieHuella).toBeCloseTo(322.13, 2)
    expect(EDIFICIO.partes).toHaveLength(13)
    expect(envolventeDe(EDIFICIO.partes).nIncluidas).toBe(12)
  })

  it('lo que sale se puede volver a leer con nuestro propio lector', () => {
    expect(nuestro.ok).toBe(true)
    expect(nuestro.dialecto).toBe(suyo.dialecto)
    expect(nuestro.srs).toBe(SRS)
  })
})

// ── 2 · El dialecto, donde se rompe copiando del de parcela ──────────────────

describe('serializarEdificioBu · el dialecto de edificio', () => {
  const xml = serializar().xml

  it('la raíz es `gml:FeatureCollection` con `gml:featureMember`, no WFS', () => {
    expect(xml).toContain('<gml:FeatureCollection')
    expect(xml).toContain('<gml:featureMember>')
    expect(xml).not.toContain('wfs:FeatureCollection')
    expect(xml).not.toContain('<wfs:member')
  })

  it('⛔ el `srsName` va en URN, no en URI como el de parcela (override O2)', () => {
    expect(xml).toContain('srsName="urn:ogc:def:crs:EPSG::25830"')
    expect(xml).not.toContain('http://www.opengis.net/def/crs/EPSG/0/')
  })

  it('la huella es UN `gml:Surface` con N `PolygonPatch`, nunca un MultiSurface', () => {
    expect(xml).not.toContain('MultiSurface')
    expect(xml.match(/<gml:Surface /g)).toHaveLength(1)
    expect(xml.match(/<gml:PolygonPatch>/g)).toHaveLength(2)
  })

  it('`horizontalGeometryReference` es `footPrint`: sin él el ICUC no la procesa', () => {
    expect(xml).toContain(
      `<bu-core2d:horizontalGeometryReference>${REFERENCIA_GEOMETRIA}</bu-core2d:horizontalGeometryReference>`,
    )
    expect(REFERENCIA_GEOMETRIA).toBe('footPrint')
    expect(xml).toContain('<bu-core2d:referenceGeometry>true</bu-core2d:referenceGeometry>')
  })

  it('⛔ `functional` está bien escrito (el PDF oficial pone «funtional»)', () => {
    expect(xml).toContain('<bu-core2d:conditionOfConstruction>functional<')
    expect(xml).not.toMatch(/funtional/)
  })

  it('la precisión de la huella sale NULA: no se afirma una que no se ha medido', () => {
    expect(xml).toMatch(
      /<bu-core2d:horizontalGeometryEstimatedAccuracy uom="m" xsi:nil="true" nilReason="other:unpopulated"\/>/,
    )
    // Y si el llamante la aporta, se emite tal cual.
    expect(serializar({ precisionMetros: 0.1 }).xml).toContain(
      '<bu-core2d:horizontalGeometryEstimatedAccuracy uom="m">0.1<',
    )
  })

  it('declara los tres namespaces draft del dialecto, con el `jrc` incluido', () => {
    expect(xml).toContain(`xmlns:bu-ext2d="${NS['bu-ext2d']}"`)
    expect(xml).toContain(`xmlns:bu-core2d="${NS['bu-core2d']}"`)
    expect(xml).toContain(`xmlns:base="${NS.base32}"`)
    // El prefijo se escribe `base`, aunque la clave interna sea `base32`.
    expect(xml).not.toContain('xmlns:base32')
    expect(NS['bu-ext2d']).toContain('inspire.jrc.ec.europa.eu')
  })

  it('⛔ declara `xmlns:xlink` aunque NADIE lo use: sin él la Sede rechaza el fichero', () => {
    // ═════════════════════════════════════════════════════════════════════════
    // MEDIDO CONTRA EL ICUC REAL EL 2026-08-06, con certificado y sobre la
    // parcela 9398516VK3799G. El servicio contesta «Los siguientes ficheros no se
    // han cargado al no ser válidos» —sin más detalle— a cualquier GML de
    // edificio que no declare este namespace en la raíz. Acotado bisecando en
    // cuatro rondas de subida; las seis medidas cuadran sin excepción:
    //
    //   · el fichero del Catastro tal cual .......................... carga
    //   · el fichero del Catastro con solo nuestros 5 prefijos ....... RECHAZADO
    //   · el nuestro con 8 prefijos más, sin `xlink` ................. RECHAZADO
    //   · el nuestro con los 5 de ISO 19139, sin `xlink` ............. RECHAZADO
    //   · el nuestro con otros 8 que SÍ incluyen `xlink` ............. carga
    //   · ⭐ el nuestro con `xlink` y nada más ....................... carga
    //
    // Ni el XSD ni la ayuda oficial lo exigen: el fichero valida contra
    // `BuildingExtended2D.xsd` con y sin la declaración. Es la asimetría de F04:
    // que el esquema diga OK no garantiza que la Sede lo acepte.
    expect(xml).toContain(`xmlns:xlink="${NS.xlink}"`)
    expect(NS.xlink).toBe('http://www.w3.org/1999/xlink')

    // ⭐ Anti-vacuidad, y es la mitad que da valor a la prueba: se comprueba que
    // el documento NO usa el prefijo en ningún sitio. Si algún día un elemento
    // emitiera un `xlink:href`, esta declaración dejaría de ser «superflua» y la
    // prueba pasaría a proteger otra cosa sin que nadie se enterase.
    expect(/xlink:[A-Za-z]/.test(xml)).toBe(false)
    // Las DOS apariciones de la palabra son las del propio `xmlns:xlink="…/xlink"`.
    expect(xml.match(/xlink/g)).toHaveLength(2)

    // Y el fichero del Catastro lo declara igual, que es de donde se sabe.
    expect(GML_EDIFICIO).toContain(`xmlns:xlink="${NS.xlink}"`)
  })

  it('no copia el comentario con el que el Catastro firma sus ficheros', () => {
    expect(GML_EDIFICIO).toContain('Edificios de la D.G. del Catastro.')
    expect(xml).not.toContain('D.G. del Catastro')
  })

  it('declara UTF-8 y escribe UTF-8 (el fixture del Catastro dice ISO-8859-1)', () => {
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true)
    expect(GML_EDIFICIO).toContain('ISO-8859-1')
  })
})

// ── 3 · La identidad ─────────────────────────────────────────────────────────

describe('serializarEdificioBu · identidad', () => {
  it('⛔ el `base:localId` va DESNUDO, sin sanear', () => {
    // Regresión de un defecto real de esta fase: la primera versión lo pasaba por
    // `toXmlId` y emitía `_9398516VK3799G`, porque una referencia catastral
    // empieza por dígito y un `xs:ID` no puede. Pero `base:localId` NO es un
    // `xs:ID` — es la identidad del edificio, y el fichero del Catastro la trae
    // sin guion bajo. Sanearla le cambia la identidad al objeto que se declara.
    expect(serializar().xml).toContain(`<base:localId>${REFCAT}</base:localId>`)
    expect(serializar().xml).not.toContain('<base:localId>_')
    expect(GML_EDIFICIO).toContain(`<base:localId>${REFCAT}</base:localId>`)
  })

  it('el `gml:id` del Building SÍ lleva el namespace delante', () => {
    expect(serializar().xml).toContain(`<bu-ext2d:Building gml:id="ES.LOCAL.BU.${REFCAT}">`)
  })

  it('el namespace por defecto es el de un particular, y el otro es el del Catastro', () => {
    expect(NAMESPACE_BU_DEFECTO).toBe('ES.LOCAL.BU')
    expect(NAMESPACE_BU_CATASTRO).toBe('ES.SDGC.BU')
    expect(serializar().xml).toContain(`<base:namespace>${NAMESPACE_BU_DEFECTO}</base:namespace>`)
    expect(serializar({ namespaceInspire: NAMESPACE_BU_CATASTRO }).xml).toContain(
      `<base:namespace>${NAMESPACE_BU_CATASTRO}</base:namespace>`,
    )
  })

  it('el `gml:id` de la colección es el namespace pelado, distinto del del edificio', () => {
    const { resumen } = serializar()
    expect(resumen.ids.coleccion).toBe(NAMESPACE_BU_DEFECTO)
    expect(resumen.ids.coleccion).not.toBe(resumen.ids.edificio)
  })

  it('LANZA sin referencia: la identidad no se inventa aquí', () => {
    expect(() => serializar({ refcat: '' })).toThrow(RangeError)
    expect(() => serializar({ refcat: '   ' })).toThrow(/no se inventa/)
  })

  it('⛔ ningún `gml:id` se repite, ni con referencias adversas', () => {
    // `xs:ID` es único en TODO el documento: repetir uno lo invalida entero y no
    // lo enseña ninguna herramienta local (es el modo de fallo que
    // `serializarExpedienteCp` documenta como el suyo). El serializador lleva una
    // guarda que LANZA, pero hoy es inalcanzable **por construcción**: los ids se
    // componen por índice y con prefijo de tipo. Esta prueba afirma esa propiedad,
    // que es lo que hace que la guarda no haga falta — y el día que deje de ser
    // cierta, esto se pone rojo antes que el fichero llegue a la Sede.
    const adversas = [
      REFCAT,
      `${REFCAT}_PI.1`, // el sufijo de las «otras», metido en la referencia
      `Surface_${REFCAT}`, // el prefijo de la geometría
      'A', // la más corta posible
      '1', // empieza por dígito: el caso que sí sanea `toXmlId`
    ]
    for (const refcat of adversas) {
      for (const namespaceInspire of [NAMESPACE_BU_DEFECTO, '']) {
        const { resumen } = serializar({ refcat, namespaceInspire, otras: [PISCINA, PISCINA] })
        const ids = [
          resumen.ids.coleccion,
          resumen.ids.edificio,
          resumen.ids.superficie,
          ...resumen.ids.otras.flatMap((o) => [o.gmlId, o.poligono]),
        ]
        expect(new Set(ids).size, `ids repetidos con refcat=${refcat} ns=${namespaceInspire}`).toBe(
          ids.length,
        )
      }
    }
  })
})

// ── 4 · Las construcciones «otras» (piscinas) ────────────────────────────────

describe('serializarEdificioBu · OtherConstruction', () => {
  const xml = serializar({ otras: [PISCINA] }).xml

  it('sale como `OtherConstruction` con `openAirPool`', () => {
    expect(xml).toContain('<bu-ext2d:OtherConstruction gml:id=')
    expect(xml).toContain(`<bu-ext2d:constructionNature>${NATURALEZA_OTRA}</bu-ext2d:constructionNature>`)
    expect(NATURALEZA_OTRA).toBe('openAirPool')
  })

  it('⛔ su geometría es un `gml:Polygon` DIRECTO, sin Surface ni patches', () => {
    const trozo = xml.slice(xml.indexOf('<bu-ext2d:OtherConstruction'))
    expect(trozo).toContain('<gml:Polygon ')
    expect(trozo).not.toContain('<gml:Surface')
    expect(trozo).not.toContain('<gml:patches>')
  })

  it('su `conditionOfConstruction` va nula: una piscina no está «en funcionamiento»', () => {
    const trozo = xml.slice(xml.indexOf('<bu-ext2d:OtherConstruction'))
    expect(trozo).toMatch(
      /<bu-core2d:conditionOfConstruction xsi:nil="true" nilReason="other:unpopulated"\/>/,
    )
  })

  it('se numeran con `_PI.n` desde 1, por ÍNDICE y no por nombre', () => {
    // Dos piscinas llamadas igual no pueden producir el mismo `gml:id`: eso
    // invalidaría el documento entero por `xs:ID` repetido.
    const dos = serializar({ otras: [PISCINA, { ...PISCINA }] })
    expect(dos.resumen.ids.otras.map((o) => o.localId)).toEqual([
      `${REFCAT}_PI.1`,
      `${REFCAT}_PI.2`,
    ])
    expect(dos.xml).toContain(`gml:id="ES.LOCAL.BU.${REFCAT}_PI.1"`)
    expect(dos.xml).toContain(`gml:id="ES.LOCAL.BU.${REFCAT}_PI.2"`)
  })

  it('cada una es su propio `gml:featureMember`', () => {
    expect(xml.match(/<gml:featureMember>/g)).toHaveLength(2)
  })
})

// ── 5 · Lo que NO se emite ───────────────────────────────────────────────────

describe('serializarEdificioBu · el ICUC no procesa BuildingPart, y no se emite', () => {
  it('con trece partes cargadas, el fichero no lleva ni un `BuildingPart`', () => {
    const { xml } = serializar()
    expect(EDIFICIO.partes).toHaveLength(13)
    expect(xml).not.toContain('BuildingPart')
    expect(parsearGmlBu(xml).partes).toEqual([])
  })

  it('pero las plantas por parte SÍ llegan: son las que deciden la huella', () => {
    // El máximo de las partes va al `numberOfFloorsAboveGround` del Building, y
    // las que declaran 0 sobre rasante se quedan fuera de la envolvente.
    expect(serializar().xml).toContain('<bu-ext2d:numberOfFloorsAboveGround>7<')
  })
})

// ── 6 · El contrato de salida ────────────────────────────────────────────────

describe('serializarEdificioBu · el contrato', () => {
  it('devuelve {xml, detecciones, resumen}, no un string pelado', () => {
    const r = serializar()
    expect(Object.keys(r).sort()).toEqual(['detecciones', 'resumen', 'xml'])
    expect(typeof r.xml).toBe('string')
    expect(Array.isArray(r.detecciones)).toBe(true)
  })

  it('cuenta lo que ha tenido que decidir: los anillos que ha reorientado', () => {
    const r = serializar()
    expect(r.detecciones.some((d) => d.tipo === 'ORIENTACION_NORMALIZADA')).toBe(true)
  })

  it('⛔ sin huella NO lanza y NO devuelve fichero: sale por `bloqueos`', () => {
    // Es un caso REAL: un edificio cuyas partes son todas sótano. El ICUC contesta
    // «Se debe aportar la geometría de la huella…».
    const r = serializar({ envolvente: [] })
    expect(r.xml).toBeNull()
    expect(r.resumen.bloqueos.length).toBeGreaterThan(0)
    expect(r.detecciones.some((d) => d.severidad === SEVERIDAD.ERROR)).toBe(true)
  })

  it('el resumen dice las piezas, las otras y la superficie de la huella', () => {
    const r = serializar({ otras: [PISCINA] })
    expect(r.resumen.nPiezas).toBe(2)
    expect(r.resumen.nOtras).toBe(1)
    expect(r.resumen.srsName).toBe('urn:ogc:def:crs:EPSG::25830')
    expect(r.resumen.modelo).toBe(MODELO.SIMPLIFICADO)
  })

  it('LANZA con opciones mal formadas: eso es contrato roto por el programador', () => {
    expect(() => serializarEdificioBu(null)).toThrow(TypeError)
    expect(() => serializar({ envolvente: 'no' })).toThrow(/'envolvente' debe ser un array/)
    expect(() => serializar({ modelo: 'MEDIO' })).toThrow(RangeError)
    expect(() => serializar({ estadoConservacion: 'ESTUPENDO' })).toThrow(RangeError)
  })

  it('⛔ rechaza un comentario que rompería el XML, igual que el de parcela', () => {
    // El prólogo es lo único que este módulo escribe sin pasar por `render`, y
    // XML 1.0 §2.5 prohíbe `--` en el cuerpo de un comentario y terminar en «-».
    // Antes de la corrección, `'expediente 2024--03'` salía interpolado tal
    // cual: `xml !== null`, cero detecciones y un fichero MAL FORMADO que jsdom
    // rechaza — el fallo mudo exacto que la regla de oro 1 prohíbe. La guarda es
    // la MISMA que la de `serialize-cp.js` (`gml/xml.js#normalizarComentarios`).
    for (const malo of ['expediente 2024--03', 'termina en -', ['bien', 'mal --'], [42]]) {
      expect(() => serializar({ comentario: malo }), JSON.stringify(malo)).toThrow(TypeError)
    }
    // Y un control C0, que ningún escapado salvaría dentro de un comentario:
    expect(() => serializar({ comentario: 'linea\u000Bpartida' })).toThrow(RangeError)
  })

  it('los comentarios BUENOS salen en el prólogo y el fichero se relee entero', () => {
    const { xml } = serializar({ comentario: ['uno', 'dos'] })
    expect(xml).toContain('<!--uno-->')
    expect(xml).toContain('<!--dos-->')
    expect(parsearGmlBu(xml).ok).toBe(true)
  })
})

// ── 7 · SIMPLIFICADO frente a COMPLETO ───────────────────────────────────────

describe('serializarEdificioBu · los dos modelos', () => {
  const semanticos = {
    modelo: MODELO.COMPLETO,
    usoDominante: '1_residential',
    numeroInmuebles: 18,
    numeroViviendas: 17,
    superficieConstruida: 2513,
    anioConstruccion: 1997,
  }

  it('SIMPLIFICADO no emite ni uno de los atributos semánticos', () => {
    const xml = serializar().xml
    for (const etiqueta of ['currentUse', 'numberOfBuildingUnits', 'numberOfDwellings', 'officialArea', 'dateOfConstruction']) {
      expect(xml, `${etiqueta} no debe estar en SIMPLIFICADO`).not.toContain(etiqueta)
    }
  })

  it('COMPLETO los emite, con los mismos valores que el fichero del Catastro', () => {
    const xml = serializar(semanticos).xml
    expect(xml).toContain('<bu-ext2d:currentUse>1_residential</bu-ext2d:currentUse>')
    expect(xml).toContain('<bu-ext2d:numberOfBuildingUnits>18</bu-ext2d:numberOfBuildingUnits>')
    expect(xml).toContain('<bu-ext2d:numberOfDwellings>17</bu-ext2d:numberOfDwellings>')
    expect(xml).toContain('<bu-ext2d:value uom="m2">2513</bu-ext2d:value>')
    expect(xml).toContain('<bu-core2d:beginning>1997-01-01T00:00:00</bu-core2d:beginning>')
    // Son los del `Building` real: el WFS los trae así.
    expect(GML_EDIFICIO).toContain('<bu-ext2d:numberOfDwellings>17</bu-ext2d:numberOfDwellings>')
  })

  it('los hijos salen en el orden del XSD, no en el que se escribieron', () => {
    const xml = serializar(semanticos).xml
    const posiciones = ORDEN_BUILDING.map((local) => xml.indexOf(`:${local}>`)).filter((p) => p >= 0)
    const ordenadas = [...posiciones].sort((a, b) => a - b)
    expect(posiciones).toEqual(ordenadas)
  })
})

// ── 8 · El reloj, que este módulo no consulta ────────────────────────────────

describe('serializarEdificioBu · no consulta el reloj', () => {
  it('el fichero no nombra la marca de tiempo del sistema ni en un comentario', () => {
    const fuente = readFileSync(
      fileURLToPath(new URL('../../gml/serialize-bu.js', import.meta.url)),
      'utf8',
    )
    expect(fuente).not.toMatch(/Date\.now|new Date\(/)
  })

  it('`beginLifespanVersion` sale nula si no se la dan, y con valor si sí', () => {
    expect(serializar().xml).toMatch(
      /<bu-core2d:beginLifespanVersion xsi:nil="true" nilReason="other:unpopulated"\/>/,
    )
    expect(serializar({ beginLifespanVersion: '2026-08-06T00:00:00' }).xml).toContain(
      '<bu-core2d:beginLifespanVersion>2026-08-06T00:00:00</bu-core2d:beginLifespanVersion>',
    )
  })
})

// ── 9 · Guardianes de las tablas duplicadas entre capas ──────────────────────

describe('serializarEdificioBu · las tablas duplicadas no pueden divergir', () => {
  it('`ESTADO_A_CONDICION` es la INVERSA exacta de `CONDICION_A_ESTADO`', () => {
    // Una traduce al leer (`edificio/entrada.js`) y la otra al escribir. Si
    // divergen, un edificio importado y vuelto a exportar cambia de estado solo.
    for (const [condicion, estado] of Object.entries(CONDICION_A_ESTADO)) {
      expect(ESTADO_A_CONDICION[estado], `${estado} → ${condicion}`).toBe(condicion)
    }
    expect(Object.keys(ESTADO_A_CONDICION).sort()).toEqual(Object.values(CONDICION_A_ESTADO).sort())
  })

  it('`MODELO` dice las mismas dos cadenas que `MODELO_EDIFICIO` del modelo', () => {
    // `gml/` no importa `model/` (frontera de capa), así que la tabla está escrita
    // dos veces a propósito. Esto impide que se separen.
    expect(MODELO).toEqual(MODELO_EDIFICIO)
  })

  it('los namespaces BU de `NS` son los mismos que usa el LECTOR', () => {
    expect(NS['bu-ext2d']).toBe(NS_BU.ext2d)
    expect(NS['bu-core2d']).toBe(NS_BU.core2d)
  })

  it('todo estado del modelo tiene traducción: ninguno se queda sin emitir', () => {
    for (const estado of Object.values(ESTADO_CONSERVACION)) {
      expect(ESTADO_A_CONDICION[estado], `falta la condición INSPIRE de ${estado}`).toBeDefined()
    }
  })
})

// ── 10 · Lo que el round-trip NO promete (M2, medido en la fase 0) ───────────

describe('serializarEdificioBu · lo que el fichero trae y el modelo no guarda', () => {
  // El round-trip de arriba promete «equivalente en partes, plantas, huella y
  // estructura». NO promete conservar el fichero. Esta lista se midió ANTES de
  // escribir el round-trip (fase 0 · M2) para que lo que se pierde esté escrito
  // como propiedad y no se descubra el día que alguien lo eche en falta.
  //
  // ⚠️ No es un defecto que se pierdan: el modelo es lo que el TÉCNICO declara
  // (regla de oro 4), y el `gml:id` del Catastro o la altura bajo rasante de cada
  // parte son hechos del fichero de ORIGEN. Copiarlos a un alta nuestra sería
  // afirmar en nombre del Catastro (regla de oro 9). Lo que sí es un defecto es
  // perderlos en silencio, y por eso están aquí.
  const leido = parsearGmlBu(GML_PARTES)

  it('el fichero trae por parte SEIS datos que el modelo no tiene dónde poner', () => {
    const delFichero = Object.keys(leido.partes[0])
    const delModelo = Object.keys(EDIFICIO.partes[0])
    expect(delModelo).toEqual([
      'nombre',
      'tipo',
      'recinto',
      'plantasSobreRasante',
      'plantasBajoRasante',
      'origen',
    ])
    // La intersección es de CONCEPTO, no de nombre: `anillos` → `recinto`,
    // `numberOfFloors*` → `plantas*`. Lo que se queda fuera entero es esto.
    const fuera = [
      'gmlId',
      'localId',
      'refcat',
      'nils',
      'heightBelowGround',
      'heightBelowGroundUom',
      'conditionOfConstruction',
    ]
    for (const clave of fuera) expect(delFichero).toContain(clave)
    for (const clave of fuera) expect(delModelo).not.toContain(clave)
  })

  it('`heightBelowGround` lo traen LAS TRECE, y nueve con valor distinto de 0', () => {
    // Es el dato más goloso de la lista —es una altura real, medida— y el que más
    // fácil sería dar por perdido sin enterarse.
    const conAltura = leido.partes.filter((p) => typeof p.heightBelowGround === 'number')
    expect(conAltura).toHaveLength(13)
    expect(conAltura.filter((p) => p.heightBelowGround !== 0)).toHaveLength(9)
    expect(serializar().xml).not.toContain('heightBelowGround')
  })

  it('los `gml:id` del Catastro NO se reutilizan: el alta declara identidad propia', () => {
    // `ES.SDGC.BU.…` es del Catastro. Un fichero nuestro que los repita está
    // firmando con la matrícula de otro.
    expect(leido.partes.every((p) => p.gmlId.startsWith(`${NAMESPACE_BU_CATASTRO}.`))).toBe(true)
    expect(serializar().xml).not.toContain(`${NAMESPACE_BU_CATASTRO}.`)
    expect(serializar().xml).toContain(`${NAMESPACE_BU_DEFECTO}.`)
  })

  it('los `nilReason` del origen no se copian: se emiten los nuestros', () => {
    expect(leido.partes[0].nils).toEqual({ conditionOfConstruction: 'other:unpopulated' })
    // El nuestro también los usa, pero porque LO DECIDE él, no por arrastre: sin
    // `estadoConservacion` el Building sale nulo, y con él sale con valor.
    expect(serializar({ estadoConservacion: null }).xml).toMatch(
      /<bu-core2d:conditionOfConstruction xsi:nil="true"/,
    )
    expect(serializar().xml).toContain('<bu-core2d:conditionOfConstruction>functional<')
  })

  it('del `Building` del Catastro se pierden la fecha de obra y su `beginLifespanVersion`', () => {
    const suyo = parsearGmlBu(GML_EDIFICIO).edificio
    expect(suyo.dateOfConstruction).toEqual({
      beginning: '1997-01-01T00:00:00',
      end: '1997-01-01T00:00:00',
    })
    expect(suyo.officialArea).toEqual([{ referencia: 'grossFloorArea', valor: 2513, uom: 'm2' }])
    // ⚠️ El modelo guarda `anioConstruccion` (un año), no el par de instantes; y
    // `superficieConstruida` (un número), no la lista de superficies con su
    // referencia. Lo que sale es lo que el técnico declara.
    expect(EDIFICIO.anioConstruccion ?? null).toBeNull()
    expect(EDIFICIO.superficieConstruida ?? null).toBeNull()
  })
})

// ── 11 · El documento de ENTREGA completo, byte a byte ───────────────────────

describe('serializarEdificioBu · el fichero de entrega, byte a byte', () => {
  /**
   * Lo que la app produciría HOY para el edificio real de `9398516VK3799G`: la
   * envolvente derivada de sus trece partes más su piscina, con los mismos
   * argumentos que pasa `app/cableado-edificio-gml.js`.
   *
   * ⭐ Es el gemelo de `__snapshots__/parcela-entrega.gml`, y existe por lo mismo:
   * este fichero se sube a un validador de la Sede, así que cualquier cambio en un
   * byte tiene que ser una DECISIÓN y no un efecto colateral. Además es el que
   * `scripts/validar-xsd.mjs` nombra para decir por qué NO puede validarlo (M1).
   */
  const XML_ENTREGA = serializarEdificioBu({
    envolvente: ENVOLVENTE,
    otras: [PISCINA],
    srs: SRS,
    refcat: REFCAT,
    modelo: EDIFICIO.modelo,
    plantasSobreRasante: 7,
    estadoConservacion: EDIFICIO.estadoConservacion ?? null,
  }).xml

  it('coincide con __snapshots__/edificio-entrega.gml', async () => {
    await expect(XML_ENTREGA).toMatchFileSnapshot('__snapshots__/edificio-entrega.gml')
  })

  it('el fixture del que sale es el modelo SIMPLIFICADO, y el snapshot lo refleja', () => {
    // Anti-vacuidad: si mañana `entradaDesdeGmlBu` decidiera otro modelo, el
    // snapshot cambiaría entero y este `it` diría por qué antes de que nadie lo
    // achacara al serializador.
    expect(EDIFICIO.modelo).toBe(MODELO.SIMPLIFICADO)
    expect(XML_ENTREGA).not.toContain('bu-ext2d:currentUse')
  })
})

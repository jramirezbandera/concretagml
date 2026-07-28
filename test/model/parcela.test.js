import { describe, it, expect, vi, afterEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import {
  crearRecinto,
  crearParcela,
  crearExpediente,
  TIPO_RECINTO,
  ORIGEN_PARCELA,
  SRS_VALIDOS,
  TIPO_EXPEDIENTE,
} from '../../model/parcela.js'

// F00 · tarea 2.4 — modelo de datos de la rama PARCELA como POJO plano.

afterEach(() => {
  vi.restoreAllMocks()
})

describe('constantes de dominio', () => {
  it('exporta los conjuntos de valores válidos', () => {
    expect(SRS_VALIDOS).toEqual(['EPSG:25829', 'EPSG:25830', 'EPSG:25831'])
    expect(TIPO_RECINTO).toEqual({ EXTERIOR: 'EXTERIOR', HUECO: 'HUECO' })
    expect(TIPO_EXPEDIENTE).toEqual({ PARCELA: 'PARCELA', EDIFICIO: 'EDIFICIO' })
    expect(ORIGEN_PARCELA).toEqual({
      WFS: 'WFS',
      LIST: 'LIST',
      TXT: 'TXT',
      DXF: 'DXF',
      GML_EXISTENTE: 'GML_EXISTENTE',
    })
  })
})

describe('crearRecinto', () => {
  it('produce el shape esperado con tipo EXTERIOR por defecto', () => {
    const r = crearRecinto([
      [0, 0],
      [10, 0],
      [10, 10],
    ])
    expect(r).toEqual({
      vertices: [
        [0, 0],
        [10, 0],
        [10, 10],
      ],
      tipo: 'EXTERIOR',
    })
    // POJO plano, sin métodos/prototipo de clase.
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype)
  })

  it('acepta tipo HUECO explícito', () => {
    expect(crearRecinto([[0, 0], [1, 1]], TIPO_RECINTO.HUECO).tipo).toBe('HUECO')
  })

  it('hace copia defensiva: mutar la fuente no afecta al recinto', () => {
    const fuente = [
      [1, 2],
      [3, 4],
    ]
    const r = crearRecinto(fuente)
    fuente[0][0] = 999
    fuente.push([5, 6])
    expect(r.vertices).toEqual([
      [1, 2],
      [3, 4],
    ])
    expect(r.vertices).not.toBe(fuente)
    expect(r.vertices[0]).not.toBe(fuente[0])
  })

  it('normaliza un anillo CERRADO a abierto y avisa (no silencioso)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = crearRecinto([
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
      [0, 0], // vértice de cierre repetido
    ])
    expect(r.vertices).toHaveLength(4)
    expect(r.vertices.at(-1)).toEqual([0, 10])
    expect(warn).toHaveBeenCalledTimes(1)
  })

  it('NO avisa cuando el anillo ya llega abierto', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const r = crearRecinto([
      [0, 0],
      [10, 0],
      [10, 10],
    ])
    expect(r.vertices).toHaveLength(3)
    expect(warn).not.toHaveBeenCalled()
  })

  it('rechaza tipo inválido, entrada no-array y vértices no numéricos', () => {
    expect(() => crearRecinto([[0, 0]], 'RARO')).toThrow(RangeError)
    expect(() => crearRecinto('nope')).toThrow(TypeError)
    expect(() => crearRecinto([[0, 'x']])).toThrow(TypeError)
    expect(() => crearRecinto([[0]])).toThrow(TypeError)
    expect(() => crearRecinto([[NaN, 1]])).toThrow(TypeError)
  })
})

describe('crearParcela', () => {
  const recintoExt = () => [{ vertices: [[0, 0], [10, 0], [10, 10], [0, 10]], tipo: 'EXTERIOR' }]

  it('produce el shape con defaults correctos', () => {
    const p = crearParcela({ idLocal: 'P1', origen: ORIGEN_PARCELA.WFS })
    expect(p).toEqual({
      idLocal: 'P1',
      refcat: null,
      recintos: [],
      geometriaOficial: null,
      superficieRegistral: null,
      superficieCatastral: null,
      origen: 'WFS',
    })
    expect(Object.getPrototypeOf(p)).toBe(Object.prototype)
  })

  it('conserva los campos suministrados', () => {
    const p = crearParcela({
      idLocal: 'P1',
      refcat: '9398516VK3799G',
      recintos: recintoExt(),
      superficieRegistral: 1535.87,
      origen: 'LIST',
    })
    expect(p.refcat).toBe('9398516VK3799G')
    expect(p.superficieRegistral).toBe(1535.87)
    expect(p.recintos).toHaveLength(1)
    expect(p.recintos[0].tipo).toBe('EXTERIOR')
  })

  it('exige idLocal y un origen válido', () => {
    expect(() => crearParcela({ origen: 'WFS' })).toThrow(TypeError)
    expect(() => crearParcela({ idLocal: '', origen: 'WFS' })).toThrow(TypeError)
    expect(() => crearParcela({ idLocal: 'P1' })).toThrow(RangeError)
    expect(() => crearParcela({ idLocal: 'P1', origen: 'XXX' })).toThrow(RangeError)
  })

  it('exige que recintos[0] sea EXTERIOR (invariante §4.3)', () => {
    expect(() =>
      crearParcela({
        idLocal: 'P1',
        origen: 'WFS',
        recintos: [{ vertices: [[0, 0], [1, 1], [2, 0]], tipo: 'HUECO' }],
      }),
    ).toThrow(/recintos\[0\] debe ser el EXTERIOR/)
  })

  it('exige que los recintos posteriores sean HUECO', () => {
    expect(() =>
      crearParcela({
        idLocal: 'P1',
        origen: 'WFS',
        recintos: [
          { vertices: [[0, 0], [10, 0], [10, 10], [0, 10]], tipo: 'EXTERIOR' },
          { vertices: [[1, 1], [2, 1], [2, 2]], tipo: 'EXTERIOR' },
        ],
      }),
    ).toThrow(/recintos\[1\] debe ser HUECO/)
  })

  it('guarda un EXTERIOR con HUECO en el orden correcto', () => {
    const p = crearParcela({
      idLocal: 'P1',
      origen: 'WFS',
      recintos: [
        { vertices: [[0, 0], [10, 0], [10, 10], [0, 10]], tipo: 'EXTERIOR' },
        { vertices: [[2, 2], [4, 2], [4, 4], [2, 4]], tipo: 'HUECO' },
      ],
    })
    expect(p.recintos.map((r) => r.tipo)).toEqual(['EXTERIOR', 'HUECO'])
  })

  it('geometriaOficial es copia INDEPENDIENTE aunque se pase el mismo array que recintos', () => {
    const fuente = recintoExt()
    const p = crearParcela({
      idLocal: 'P1',
      origen: 'WFS',
      recintos: fuente,
      geometriaOficial: fuente,
    })
    // Mutar recintos NO afecta a geometriaOficial.
    p.recintos[0].vertices[0][0] = 12345
    p.recintos[0].vertices.push([99, 99])
    expect(p.geometriaOficial[0].vertices[0][0]).toBe(0)
    expect(p.geometriaOficial[0].vertices).toHaveLength(4)
    expect(p.geometriaOficial).not.toBe(p.recintos)
    expect(p.geometriaOficial[0]).not.toBe(p.recintos[0])
  })

  it('geometriaOficial se congela: NUNCA se muta (regla 2)', () => {
    const p = crearParcela({
      idLocal: 'P1',
      origen: 'WFS',
      geometriaOficial: recintoExt(),
    })
    expect(Object.isFrozen(p.geometriaOficial)).toBe(true)
    expect(Object.isFrozen(p.geometriaOficial[0].vertices)).toBe(true)
    // Modo estricto (ESM): mutar lo congelado lanza TypeError.
    expect(() => {
      p.geometriaOficial[0].vertices[0][0] = 5
    }).toThrow(TypeError)
  })
})

// ── superficieCatastral (F05 · T0C) ──────────────────────────────────────────
// El `cp:areaValue` que el Catastro DECLARA en el GML del WFS, hermano de
// `superficieRegistral`. No es una superficie medida por nosotros: la medida se
// calcula con geo/area.js sobre los vértices y NO tiene por qué coincidir. Si
// esa distinción se pierde, F07 comparará una cifra consigo misma.

const CLAVE_NUEVA = 'superficieCatastral'
const RUTA_MODELO = fileURLToPath(new URL('../../model/parcela.js', import.meta.url))

/**
 * Claves que la factory DOCUMENTA en el JSDoc de `crearParcela`
 * (`@param {...} args.X` / `[args.X=...]`). Es una fuente INDEPENDIENTE del POJO
 * que devuelve: sirve para comparar conjuntos de claves derivados en vez de una
 * lista escrita a mano, y salta tanto si se añade un campo sin documentarlo como
 * si se documenta uno que no existe.
 */
function clavesDocumentadasDeCrearParcela() {
  const fuente = readFileSync(RUTA_MODELO, 'utf8')
  const desde = fuente.indexOf('Crea una Parcela')
  const hasta = fuente.indexOf('export function crearParcela')
  const jsdoc = fuente.slice(desde, hasta)
  return [...jsdoc.matchAll(/@param \{[^}]*\}\s+\[?args\.(\w+)/g)].map((m) => m[1])
}

describe('crearParcela · superficieCatastral (el cp:areaValue DECLARADO)', () => {
  const base = { idLocal: 'P1', origen: ORIGEN_PARCELA.WFS }

  it('no-regresión del shape: mismas claves se pase o no el campo, y son las documentadas', () => {
    const sin = crearParcela({ ...base })
    const con = crearParcela({ ...base, superficieCatastral: ring.areaValue })
    const clavesSin = Object.keys(sin).sort()
    const clavesCon = Object.keys(con).sort()

    // Pasar el campo no crea ni quita claves: nada de shape condicional.
    expect(clavesSin).toEqual(clavesCon)
    expect(clavesSin).toContain(CLAVE_NUEVA)
    // Conjuntos DERIVADOS: el POJO es exactamente lo que la factory documenta.
    expect(clavesSin).toEqual([...clavesDocumentadasDeCrearParcela()].sort())
    // Y lo heredado sigue ahí: `superficieRegistral` no se ha sustituido.
    expect(clavesSin.filter((k) => k !== CLAVE_NUEVA)).toContain('superficieRegistral')
    // El expediente reconstruye la parcela con la misma factory: mismo shape.
    expect(Object.keys(crearExpediente({ parcela: sin }).parcela).sort()).toEqual(clavesSin)
  })

  it('por defecto es null, y el null SOBREVIVE a structuredClone (undo/redo real)', () => {
    const p = crearParcela({ ...base })
    expect(p.superficieCatastral).toBe(null)

    const clon = structuredClone(p)
    expect(CLAVE_NUEVA in clon).toBe(true) // null, no "clave ausente"
    expect(clon.superficieCatastral).toBe(null)
    expect(clon).toEqual(p)

    // También dentro de un expediente completo, con valor y sin él.
    const e = crearExpediente({
      parcela: crearParcela({ ...base, superficieCatastral: ring.areaValue }),
    })
    const clonE = structuredClone(e)
    expect(clonE.parcela.superficieCatastral).toBe(ring.areaValue)
    expect(structuredClone(crearExpediente({ parcela: p })).parcela.superficieCatastral).toBe(null)
  })

  it('conserva un valor válido tal cual (sin redondear: regla de oro 11)', () => {
    expect(crearParcela({ ...base, superficieCatastral: 1536 }).superficieCatastral).toBe(1536)
    expect(crearParcela({ ...base, superficieCatastral: 1535.87 }).superficieCatastral).toBe(1535.87)
    expect(crearParcela({ ...base, superficieCatastral: 0 }).superficieCatastral).toBe(0)
  })

  it('con los inválidos hace EXACTAMENTE lo que hace hoy superficieRegistral', () => {
    // La política no se reinventa: se compara campo contra campo con los mismos
    // valores, así que si mañana cambia la de superficieRegistral, esto salta.
    const invalidos = ['1536', NaN, Infinity, -Infinity, {}, [], true, false]
    for (const v of invalidos) {
      expect(() => crearParcela({ ...base, superficieRegistral: v })).toThrow(TypeError)
      expect(() => crearParcela({ ...base, superficieCatastral: v })).toThrow(TypeError)
      expect(() => crearParcela({ ...base, superficieCatastral: v })).toThrow(
        /'superficieCatastral' debe ser número finito o null/,
      )
    }
    // Y con los que hoy SÍ admite superficieRegistral (incluido un negativo, que
    // no se valida aquí), los dos campos aceptan y guardan lo mismo.
    for (const v of [0, -12.5, 1536, 1535.87, null, undefined]) {
      const p = crearParcela({ ...base, superficieRegistral: v, superficieCatastral: v })
      expect(p.superficieCatastral).toBe(p.superficieRegistral)
      expect(p.superficieCatastral).toBe(v === undefined ? null : v)
    }
  })

  it('guarda el DECLARADO por el Catastro, NO la superficie medida por shoelace', () => {
    // Los dos números salen del fixture real (parcela 9398516VK3799G): el
    // `cp:areaValue` declarado y el área firmada de las coordenadas emitidas.
    const declarado = ring.areaValue // 1536, entero, uom="m2" (override O6)
    const medida = Math.abs(ring._verificado.areaFirmada) // 1535,865… m²

    const p = crearParcela({
      idLocal: ring.refCatastral,
      refcat: ring.refCatastral,
      origen: ORIGEN_PARCELA.WFS,
      recintos: [{ vertices: ring.anilloExterior, tipo: 'EXTERIOR' }],
      geometriaOficial: [{ vertices: ring.anilloExterior, tipo: 'EXTERIOR' }],
      superficieCatastral: declarado,
    })

    expect(p.superficieCatastral).toBe(declarado)
    expect(Number.isInteger(p.superficieCatastral)).toBe(true)
    // La trampa: NO es la superficie de sus propias coordenadas.
    expect(p.superficieCatastral).not.toBe(medida)
    expect(Number.isInteger(medida)).toBe(false)
    // Difieren de verdad (más de un cm²) y a la vez son la misma parcela
    // (menos de 1 m²: el declarado es el redondeo entero de lo medido).
    const diferencia = Math.abs(p.superficieCatastral - medida)
    expect(diferencia).toBeGreaterThan(0.01)
    expect(diferencia).toBeLessThan(1)
    expect(Math.round(medida)).toBe(declarado)
  })
})

describe('crearExpediente', () => {
  it('produce el shape con defaults correctos', () => {
    const e = crearExpediente()
    expect(e.tipo).toBe('PARCELA')
    expect(e.srs).toBe('EPSG:25830')
    expect(e.parcela).toBe(null)
    expect(Object.keys(e.metadatos).sort()).toEqual(
      ['autor', 'creado', 'idDocumento', 'modificado'].sort(),
    )
    expect(e.metadatos.autor).toBe('')
    expect(e.metadatos.idDocumento).toBe('')
    // creado/modificado son marcas ISO por defecto.
    expect(typeof e.metadatos.creado).toBe('string')
    expect(new Date(e.metadatos.creado).toString()).not.toBe('Invalid Date')
    expect(Object.getPrototypeOf(e)).toBe(Object.prototype)
  })

  it('propaga autor/idDocumento a metadatos y respeta metadatos explícitos', () => {
    const e1 = crearExpediente({ autor: 'JRB', idDocumento: 'DOC-7' })
    expect(e1.metadatos.autor).toBe('JRB')
    expect(e1.metadatos.idDocumento).toBe('DOC-7')

    const e2 = crearExpediente({
      metadatos: { creado: '2020-01-01T00:00:00.000Z', modificado: '2020-01-02T00:00:00.000Z', autor: 'X', idDocumento: 'Y' },
    })
    expect(e2.metadatos).toEqual({
      creado: '2020-01-01T00:00:00.000Z',
      modificado: '2020-01-02T00:00:00.000Z',
      autor: 'X',
      idDocumento: 'Y',
    })
  })

  it('rechaza srs y tipo inválidos', () => {
    expect(() => crearExpediente({ srs: 'EPSG:4326' })).toThrow(RangeError)
    expect(() => crearExpediente({ tipo: 'OTRO' })).toThrow(RangeError)
    for (const srs of SRS_VALIDOS) {
      expect(crearExpediente({ srs }).srs).toBe(srs)
    }
  })

  it('incrusta una parcela como copia independiente', () => {
    const parcela = crearParcela({
      idLocal: 'P1',
      origen: 'WFS',
      recintos: [{ vertices: [[0, 0], [10, 0], [10, 10]], tipo: 'EXTERIOR' }],
    })
    const e = crearExpediente({ parcela })
    expect(e.parcela.idLocal).toBe('P1')
    expect(e.parcela).not.toBe(parcela)
    expect(e.parcela.recintos).not.toBe(parcela.recintos)
    // mutar la fuente no toca la copia del expediente
    parcela.recintos[0].vertices[0][0] = 777
    expect(e.parcela.recintos[0].vertices[0][0]).toBe(0)
  })

  // ── Rama EDIFICIO del expediente (auditoría A5) ────────────────────────────
  // El Edificio se construye con model/edificio.js#crearEdificio; aquí se usa un
  // POJO equivalente para no acoplar los tests de las dos ramas.
  const edificioPojo = () => ({
    refcat: null,
    modelo: 'SIMPLIFICADO',
    partes: [
      {
        nombre: 'cuerpo principal',
        tipo: 'PRINCIPAL',
        recinto: { tipo: 'EXTERIOR', vertices: [[440000, 4100000], [440010, 4100000], [440010, 4100010]] },
        plantasSobreRasante: 2,
        plantasBajoRasante: null,
        origen: 'DIBUJADA',
      },
    ],
    parcelaContexto: null,
    construccionOficial: null,
  })

  it('tipo EDIFICIO incrusta la rama edificio como copia independiente', () => {
    const edificio = edificioPojo()
    const e = crearExpediente({ tipo: 'EDIFICIO', edificio })
    expect(e.edificio).not.toBe(edificio)
    expect(e.edificio.partes[0].nombre).toBe('cuerpo principal')
    expect(e.parcela).toBe(null)
    // mutar la fuente no toca la copia del expediente
    edificio.partes[0].plantasSobreRasante = 99
    expect(e.edificio.partes[0].plantasSobreRasante).toBe(2)
  })

  it('la exclusividad de rama por tipo LANZA (regla 1): PARCELA+edificio y EDIFICIO+parcela', () => {
    const parcela = crearParcela({ idLocal: 'P1', origen: 'WFS' })
    expect(() => crearExpediente({ tipo: 'PARCELA', edificio: edificioPojo() })).toThrow()
    expect(() => crearExpediente({ tipo: 'EDIFICIO', parcela })).toThrow()
  })

  it("un 'edificio' sin shape de crearEdificio LANZA TypeError", () => {
    expect(() => crearExpediente({ tipo: 'EDIFICIO', edificio: { cualquiera: true } })).toThrow(TypeError)
    expect(() => crearExpediente({ tipo: 'EDIFICIO', edificio: 'edificio' })).toThrow(TypeError)
  })

  it('re-congela construccionOficial en la copia del expediente (regla 2 tras structuredClone)', () => {
    const edificio = edificioPojo()
    edificio.construccionOficial = [
      { nombre: 'registrado', tipo: 'PRINCIPAL', recinto: null, plantasSobreRasante: 1, plantasBajoRasante: null, origen: 'WFS' },
    ]
    const e = crearExpediente({ tipo: 'EDIFICIO', edificio })
    expect(() => {
      e.edificio.construccionOficial[0].plantasSobreRasante = 99
    }).toThrow(TypeError)
  })
})

describe('structuredClone (undo/redo)', () => {
  it('clona en profundidad un expediente completo sin perder datos ni compartir referencias', () => {
    const e = crearExpediente({
      autor: 'JRB',
      idDocumento: 'DOC-1',
      parcela: crearParcela({
        idLocal: 'P1',
        refcat: '9398516VK3799G',
        origen: 'WFS',
        recintos: [{ vertices: [[0, 0], [10, 0], [10, 10], [0, 10]], tipo: 'EXTERIOR' }],
        geometriaOficial: [{ vertices: [[0, 0], [10, 0], [10, 10], [0, 10]], tipo: 'EXTERIOR' }],
      }),
    })

    const clon = structuredClone(e)

    expect(clon).toEqual(e) // igualdad estructural profunda
    // Las referencias internas NO se comparten.
    expect(clon).not.toBe(e)
    expect(clon.metadatos).not.toBe(e.metadatos)
    expect(clon.parcela).not.toBe(e.parcela)
    expect(clon.parcela.recintos).not.toBe(e.parcela.recintos)
    expect(clon.parcela.recintos[0]).not.toBe(e.parcela.recintos[0])
    expect(clon.parcela.recintos[0].vertices).not.toBe(e.parcela.recintos[0].vertices)
    expect(clon.parcela.geometriaOficial).not.toBe(e.parcela.geometriaOficial)
  })

  it('el clon es mutable aunque geometriaOficial del original esté congelada', () => {
    const e = crearExpediente({
      parcela: crearParcela({
        idLocal: 'P1',
        origen: 'WFS',
        geometriaOficial: [{ vertices: [[0, 0], [10, 0], [10, 10]], tipo: 'EXTERIOR' }],
      }),
    })
    const clon = structuredClone(e)
    expect(Object.isFrozen(clon.parcela.geometriaOficial)).toBe(false)
    expect(() => {
      clon.parcela.geometriaOficial[0].vertices[0][0] = 1
    }).not.toThrow()
  })
})

describe('parcela realista desde el fixture WFS', () => {
  it('construye una Parcela con el anillo exterior real (UTM, abierto)', () => {
    const p = crearParcela({
      idLocal: ring.refCatastral,
      refcat: ring.refCatastral,
      origen: ORIGEN_PARCELA.WFS,
      recintos: [{ vertices: ring.anilloExterior, tipo: 'EXTERIOR' }],
      geometriaOficial: [{ vertices: ring.anilloExterior, tipo: 'EXTERIOR' }],
    })

    expect(p.refcat).toBe('9398516VK3799G')
    expect(p.recintos[0].tipo).toBe('EXTERIOR')
    // 15 vértices, anillo abierto: el primero no se repite al final.
    expect(p.recintos[0].vertices).toHaveLength(15)
    expect(p.recintos[0].vertices[0]).not.toEqual(p.recintos[0].vertices.at(-1))
    // Coordenadas guardadas en UTM [x,y] tal cual (regla 3: nunca lat/lon).
    expect(p.recintos[0].vertices[0]).toEqual([439283.23, 4479671.27])
    // Sobrevive a structuredClone sin pérdida.
    expect(structuredClone(p)).toEqual(p)
  })

  it('normaliza el anillo CERRADO del GML (16 verts) a abierto (15) avisando', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const cerrado = [...ring.anilloExterior, ring.anilloExterior[0]] // 16, último = primero
    const p = crearParcela({
      idLocal: ring.refCatastral,
      origen: ORIGEN_PARCELA.WFS,
      recintos: [{ vertices: cerrado, tipo: 'EXTERIOR' }],
    })
    expect(p.recintos[0].vertices).toHaveLength(15)
    expect(warn).toHaveBeenCalled()
  })
})

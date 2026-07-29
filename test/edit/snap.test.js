import { describe, it, expect } from 'vitest'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import { OPERATIVOS } from '../../config/operativos.js'
import { crearParcela, crearRecinto } from '../../model/parcela.js'
import { dianasDe, ajustar, TIPO_ENGANCHE } from '../../edit/snap.js'

// F06 · edit/snap.js — enganche al parcelario oficial y a las colindantes
// (criterio de aceptación 2 de spec/feature-06-edicion-parcela.md).
//
// Módulo PURO: geometría euclídea plana sobre UTM en metros. Ni una latitud, ni
// una longitud, ni un grado en todo el fichero (regla de oro 3). Las distancias
// se comprueban con `Math.hypot` LOCAL —no importando `geo/metrica.js`— para que
// la aserción no dependa del mismo helper que usa el código bajo prueba.

// ── Utilidades del test ──────────────────────────────────────────────────────

const hipot = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

/** Cuadrado de `lado` m con esquina inferior izquierda en (x0,y0). Anillo ABIERTO. */
const cuadrado = (x0, y0, lado = 20) => [
  [x0, y0],
  [x0 + lado, y0],
  [x0 + lado, y0 + lado],
  [x0, y0 + lado],
]

/** Congela en profundidad: cualquier mutación en sitio lanzaría (modo estricto). */
function congelar(valor) {
  if (valor && typeof valor === 'object') {
    for (const v of Object.values(valor)) congelar(v)
    Object.freeze(valor)
  }
  return valor
}

/** Recoge todos los objetos/arrays alcanzables desde `valor`. */
function referencias(valor, acc = new Set()) {
  if (valor && typeof valor === 'object') {
    acc.add(valor)
    for (const v of Object.values(valor)) referencias(v, acc)
  }
  return acc
}

/** Referencias compartidas entre dos estructuras (debe ser siempre vacío). */
function compartidas(a, b) {
  const refsB = referencias(b)
  return [...referencias(a)].filter((o) => refsB.has(o))
}

// Coordenadas UTM realistas (huso 30, Norte ≈ 4,48·10⁶) y anillos ABIERTOS: el
// vértice de cierre NO está, que es justo lo que obliga a `dianasDe` a generar el
// lado v[n−1] → v[0].
const OFICIAL = cuadrado(440000, 4480000)
const EDITABLE = cuadrado(440000.5, 4480000.5)
const COLINDANTE = cuadrado(440100, 4480000)

/** Parcela POJO (el store admite cualquier POJO plano), con las tres fuentes. */
const parcelaTresFuentes = () =>
  structuredClone({
    idLocal: 'f06-snap',
    recintos: [{ vertices: EDITABLE, tipo: 'EXTERIOR' }],
    geometriaOficial: [{ vertices: OFICIAL, tipo: 'EXTERIOR' }],
  })

const colindantesUna = () => structuredClone([{ recintos: [{ vertices: COLINDANTE, tipo: 'EXTERIOR' }] }])

/** Parcela con un solo recinto EDITABLE, sin oficial: aísla lo que hace `excluir`. */
const soloEditable = (vertices = EDITABLE) =>
  structuredClone({ recintos: [{ vertices, tipo: 'EXTERIOR' }] })

// ── Vocabulario público ──────────────────────────────────────────────────────

describe('edit/snap.js — vocabulario público', () => {
  it('TIPO_ENGANCHE está congelado y trae VERTICE y LINDERO', () => {
    expect(Object.isFrozen(TIPO_ENGANCHE)).toBe(true)
    expect(TIPO_ENGANCHE).toEqual({ VERTICE: 'VERTICE', LINDERO: 'LINDERO' })
  })

  it('la tolerancia por defecto es OPERATIVOS.snapMetros, no un 0,2 escrito a mano', () => {
    // La aserción se ata al VALOR DE LA CONFIGURACIÓN, sea cual sea: si mañana
    // `snapMetros` cambia, este test sigue diciendo la verdad.
    const tau = OPERATIVOS.snapMetros
    const dianas = { vertices: [[440000, 4480000]], segmentos: [] }
    expect(ajustar([440000 + tau * 0.99, 4480000], dianas).enganchado).toBe(true)
    expect(ajustar([440000 + tau * 1.01, 4480000], dianas).enganchado).toBe(false)
    // Y es la MISMA cifra que declara la configuración operativa (regla de oro 9).
    expect(tau).toBe(OPERATIVOS.snapMetros)
    expect(tau).toBeGreaterThan(0)
  })
})

// ── dianasDe · las tres fuentes ──────────────────────────────────────────────

describe('edit/snap.js — dianasDe: compone las tres fuentes en su orden', () => {
  it('geometriaOficial + colindantes + recintos, en ese orden', () => {
    const dianas = dianasDe({ parcela: parcelaTresFuentes(), colindantes: colindantesUna() })

    expect(dianas.vertices).toEqual([...OFICIAL, ...COLINDANTE, ...EDITABLE])
    expect(dianas.segmentos).toHaveLength(12) // 4 lados × 3 anillos, cierre incluido
    // El orden importa: es el que fija el desempate de `ajustar`.
    expect(dianas.segmentos[0]).toEqual([OFICIAL[0], OFICIAL[1]])
    expect(dianas.segmentos[4]).toEqual([COLINDANTE[0], COLINDANTE[1]])
    expect(dianas.segmentos[8]).toEqual([EDITABLE[0], EDITABLE[1]])
  })

  it('las colindantes son VACÍAS por defecto: no se traen a espaldas de nadie', () => {
    const dianas = dianasDe({ parcela: parcelaTresFuentes() })
    expect(dianas.vertices).toEqual([...OFICIAL, ...EDITABLE])
    expect(dianas.vertices).toHaveLength(8)
    expect(dianas.segmentos).toHaveLength(8)
  })

  it('varias colindantes, cada una con sus recintos (forma ParcelaGml)', () => {
    const colindantes = [
      { refcat: 'A', recintos: [{ vertices: COLINDANTE, tipo: 'EXTERIOR' }] },
      { refcat: 'B', recintos: [{ vertices: cuadrado(440200, 4480000), tipo: 'EXTERIOR' }] },
    ]
    const dianas = dianasDe({ parcela: null, colindantes })
    expect(dianas.vertices).toHaveLength(8)
    expect(dianas.segmentos).toHaveLength(8)
  })

  it('parcela SIN geometriaOficial: solo aporta la geometría editable', () => {
    const dianas = dianasDe({ parcela: soloEditable() })
    expect(dianas.vertices).toEqual([...EDITABLE])
    expect(dianas.segmentos).toHaveLength(4)
  })

  it('los HUECOS también son dianas: se recorren todos los recintos', () => {
    const parcela = {
      recintos: [
        { vertices: OFICIAL, tipo: 'EXTERIOR' },
        { vertices: cuadrado(440005, 4480005, 5), tipo: 'HUECO' },
      ],
    }
    const dianas = dianasDe({ parcela })
    expect(dianas.vertices).toHaveLength(8)
    expect(dianas.segmentos).toHaveLength(8)
  })

  it('parcela null, sin recintos o vacía: catálogo VACÍO y NO lanza', () => {
    for (const parcela of [null, undefined, {}, { recintos: [] }, { recintos: null }]) {
      const dianas = dianasDe({ parcela })
      expect(dianas).toEqual({ vertices: [], segmentos: [] })
    }
    expect(dianasDe({})).toEqual({ vertices: [], segmentos: [] })
    expect(dianasDe()).toEqual({ vertices: [], segmentos: [] })
  })

  it('el lado de CIERRE entra en el catálogo: n vértices ⇒ n lados, y el último es v[n−1]→v[0]', () => {
    const dianas = dianasDe({ parcela: soloEditable() })
    expect(dianas.segmentos).toHaveLength(EDITABLE.length)
    expect(dianas.segmentos.at(-1)).toEqual([EDITABLE[3], EDITABLE[0]])
    // Y se puede enganchar a él, que es de lo que se trata: punto medio del lado
    // de cierre, desplazado 5 cm.
    const medio = [EDITABLE[0][0] - 0.05, (EDITABLE[0][1] + EDITABLE[3][1]) / 2]
    const r = ajustar(medio, dianas)
    expect(r.tipo).toBe(TIPO_ENGANCHE.LINDERO)
    expect(r.t).toBeCloseTo(0.5, 9)
  })
})

// ── dianasDe · datos degenerados ─────────────────────────────────────────────

describe('edit/snap.js — dianasDe: el dato degenerado se descarta, NO se lanza', () => {
  it('vértices no finitos: fuera del catálogo, y también los lados que los tocan', () => {
    const anillo = [
      [440000, 4480000],
      [NaN, 4480000],
      [440020, 4480020],
      [440000, 4480020],
    ]
    let dianas
    expect(() => {
      dianas = dianasDe({ parcela: soloEditable(anillo) })
    }).not.toThrow()

    expect(dianas.vertices).toEqual([anillo[0], anillo[2], anillo[3]])
    // Sobreviven solo los lados 2→3 y 3→0 (cierre); 0→1 y 1→2 tocan el NaN.
    expect(dianas.segmentos).toEqual([
      [anillo[2], anillo[3]],
      [anillo[3], anillo[0]],
    ])
  })

  it('acepta Infinity, strings y pares cortos sin lanzar: cada uno cae del catálogo', () => {
    const anillo = [[440000, 4480000], [Infinity, 0], ['440020', 4480020], [440000], null, [440010, 4480010]]
    const dianas = dianasDe({ parcela: soloEditable(anillo) })
    expect(dianas.vertices).toEqual([[440000, 4480000], [440010, 4480010]])
    // El ÚNICO lado que sobrevive es el de CIERRE (v[5] → v[0]), porque es el
    // único cuyos dos extremos son válidos. Los cuatro que tocan a un vértice
    // roto se caen, y no se inventa ningún lindero entre vértices que no eran
    // consecutivos.
    expect(dianas.segmentos).toEqual([[[440010, 4480010], [440000, 4480000]]])
  })

  it('vértice DUPLICADO: el lado de longitud nula no entra (un punto no es un lindero)', () => {
    const anillo = [
      [440000, 4480000],
      [440000, 4480000], // duplicado exacto
      [440020, 4480020],
      [440000, 4480020],
    ]
    const dianas = dianasDe({ parcela: soloEditable(anillo) })
    expect(dianas.vertices).toHaveLength(4) // el vértice repetido SÍ es diana
    expect(dianas.segmentos).toHaveLength(3) // el lado 0→1, de longitud 0, no
    for (const [A, B] of dianas.segmentos) expect(hipot(A, B)).toBeGreaterThan(0)
  })

  it('anillo de 1 vértice: una diana y NINGÚN lado', () => {
    const dianas = dianasDe({ parcela: soloEditable([[440000, 4480000]]) })
    expect(dianas.vertices).toHaveLength(1)
    expect(dianas.segmentos).toEqual([])
  })

  it('anillo de 2 vértices: UN lado, no el mismo dos veces', () => {
    const anillo = [
      [440000, 4480000],
      [440020, 4480000],
    ]
    const dianas = dianasDe({ parcela: soloEditable(anillo) })
    expect(dianas.vertices).toHaveLength(2)
    expect(dianas.segmentos).toEqual([[anillo[0], anillo[1]]])
  })

  it('anillo vacío o recintos malformados: se saltan sin lanzar', () => {
    const parcela = {
      recintos: [
        { vertices: [], tipo: 'EXTERIOR' },
        { tipo: 'HUECO' },
        null,
        { vertices: 'no soy un array' },
        { vertices: OFICIAL, tipo: 'HUECO' },
      ],
    }
    let dianas
    expect(() => {
      dianas = dianasDe({ parcela })
    }).not.toThrow()
    expect(dianas.vertices).toEqual([...OFICIAL])
  })

  it('colindantes con entradas raras (null, sin recintos): se saltan sin lanzar', () => {
    const dianas = dianasDe({
      parcela: null,
      colindantes: [null, {}, { recintos: null }, { recintos: [{ vertices: COLINDANTE }] }],
    })
    expect(dianas.vertices).toEqual([...COLINDANTE])
  })
})

// ── dianasDe · excluir ───────────────────────────────────────────────────────

describe('edit/snap.js — dianasDe: `excluir` quita el vértice Y SUS DOS LADOS', () => {
  it('quita el vértice arrastrado del catálogo', () => {
    const dianas = dianasDe({ parcela: soloEditable(), excluir: { recinto: 0, indice: 2 } })
    expect(dianas.vertices).toEqual([EDITABLE[0], EDITABLE[1], EDITABLE[3]])
    expect(dianas.vertices).not.toContainEqual(EDITABLE[2])
  })

  it('quita los DOS lados que lo tocan: el que llega y el que sale', () => {
    // Vértice 2 de un cuadrado: se van 1→2 y 2→3; quedan 0→1 y 3→0 (cierre).
    const dianas = dianasDe({ parcela: soloEditable(), excluir: { recinto: 0, indice: 2 } })
    expect(dianas.segmentos).toEqual([
      [EDITABLE[0], EDITABLE[1]],
      [EDITABLE[3], EDITABLE[0]],
    ])
  })

  it('VÉRTICE 0: se van el lado de CIERRE (v[n−1]→v[0]) y el primero (v[0]→v[1])', () => {
    // Es el caso que más fácil se rompe: quien escribe `indice−1` sin el módulo
    // del anillo se lleva el lado −1 (que no existe) y deja el de cierre dentro.
    const dianas = dianasDe({ parcela: soloEditable(), excluir: { recinto: 0, indice: 0 } })

    expect(dianas.vertices).toEqual([EDITABLE[1], EDITABLE[2], EDITABLE[3]])
    expect(dianas.segmentos).toEqual([
      [EDITABLE[1], EDITABLE[2]],
      [EDITABLE[2], EDITABLE[3]],
    ])
    // Explícito: NINGÚN lado del catálogo toca ya al vértice 0.
    for (const [A, B] of dianas.segmentos) {
      expect(A).not.toEqual(EDITABLE[0])
      expect(B).not.toEqual(EDITABLE[0])
    }
  })

  it('ÚLTIMO vértice: se van el lado que lo alimenta y el de CIERRE', () => {
    const ultimo = EDITABLE.length - 1
    const dianas = dianasDe({ parcela: soloEditable(), excluir: { recinto: 0, indice: ultimo } })
    expect(dianas.vertices).toEqual([EDITABLE[0], EDITABLE[1], EDITABLE[2]])
    expect(dianas.segmentos).toEqual([
      [EDITABLE[0], EDITABLE[1]],
      [EDITABLE[1], EDITABLE[2]],
    ])
  })

  it('el vértice arrastrado ya no se engancha a sí mismo (que es para lo que existe `excluir`)', () => {
    // Sin `excluir`, el vértice está a distancia 0 de sí mismo, gana siempre y el
    // arrastre queda CLAVADO. Con `excluir`, el punto se mueve libre.
    const parcela = soloEditable()
    const arrastrado = { recinto: 0, indice: 0 }
    const destino = [EDITABLE[0][0] + 0.03, EDITABLE[0][1] + 0.03] // 4 cm: dentro de τ

    const clavado = ajustar(destino, dianasDe({ parcela }))
    expect(clavado.enganchado).toBe(true)
    expect(clavado.punto).toEqual(EDITABLE[0])

    const libre = ajustar(destino, dianasDe({ parcela, excluir: arrastrado }))
    expect(libre.enganchado).toBe(false)
    expect(libre.punto).toEqual(destino)
  })

  it('`excluir` solo afecta al recinto señalado: el hueco no pierde nada', () => {
    const parcela = {
      recintos: [
        { vertices: OFICIAL, tipo: 'EXTERIOR' },
        { vertices: cuadrado(440005, 4480005, 5), tipo: 'HUECO' },
      ],
    }
    const dianas = dianasDe({ parcela, excluir: { recinto: 1, indice: 0 } })
    expect(dianas.vertices).toHaveLength(7) // 4 del exterior + 3 del hueco
    expect(dianas.vertices.slice(0, 4)).toEqual([...OFICIAL]) // exterior intacto
    expect(dianas.segmentos).toHaveLength(6) // 4 del exterior + 2 del hueco
  })

  it('`excluir` NO se aplica a geometriaOficial: el vértice oficial sigue siendo diana', () => {
    // Decisión documentada: `recintos` y `geometriaOficial` son DOS geometrías,
    // aunque una parcela recién descargada las tenga con las mismas coordenadas.
    // Engancharse al vértice oficial es, literalmente, «ajustar el vértice sobre
    // la parcela oficial», que es el caso de uso de F06.
    const parcela = {
      recintos: [{ vertices: structuredClone(OFICIAL), tipo: 'EXTERIOR' }],
      geometriaOficial: [{ vertices: structuredClone(OFICIAL), tipo: 'EXTERIOR' }],
    }
    const dianas = dianasDe({ parcela, excluir: { recinto: 0, indice: 0 } })
    expect(dianas.vertices.filter((v) => v[0] === OFICIAL[0][0] && v[1] === OFICIAL[0][1])).toHaveLength(1)

    const r = ajustar([OFICIAL[0][0] + 0.03, OFICIAL[0][1]], dianas)
    expect(r.tipo).toBe(TIPO_ENGANCHE.VERTICE)
    expect(r.punto).toEqual(OFICIAL[0])
  })

  it('excluir en un anillo de 2 vértices se lleva el único lado', () => {
    const anillo = [
      [440000, 4480000],
      [440020, 4480000],
    ]
    const dianas = dianasDe({ parcela: soloEditable(anillo), excluir: { recinto: 0, indice: 1 } })
    expect(dianas.vertices).toEqual([anillo[0]])
    expect(dianas.segmentos).toEqual([])
  })

  // ── Contrato roto por el PROGRAMADOR → throw (regla 1) ─────────────────────

  it('LANZA TypeError si `excluir` no tiene la forma {recinto, indice}', () => {
    const parcela = soloEditable()
    for (const mala of [3, 'r0', [0, 0], true]) {
      expect(() => dianasDe({ parcela, excluir: mala })).toThrow(TypeError)
    }
    expect(() => dianasDe({ parcela, excluir: { recinto: 0.5, indice: 0 } })).toThrow(/'excluir.recinto'/)
    expect(() => dianasDe({ parcela, excluir: { recinto: -1, indice: 0 } })).toThrow(/'excluir.recinto'/)
    expect(() => dianasDe({ parcela, excluir: { recinto: 0, indice: '1' } })).toThrow(/'excluir.indice'/)
    expect(() => dianasDe({ parcela, excluir: { recinto: 0, indice: NaN } })).toThrow(TypeError)
    // null y undefined SÍ son válidos: significan «no se está arrastrando nada».
    expect(() => dianasDe({ parcela, excluir: null })).not.toThrow()
    expect(() => dianasDe({ parcela, excluir: undefined })).not.toThrow()
  })

  it('LANZA RangeError si `excluir` apunta a un vértice que no existe', () => {
    const parcela = soloEditable()
    expect(() => dianasDe({ parcela, excluir: { recinto: 1, indice: 0 } })).toThrow(RangeError)
    expect(() => dianasDe({ parcela, excluir: { recinto: 0, indice: 4 } })).toThrow(RangeError)
    expect(() => dianasDe({ parcela: null, excluir: { recinto: 0, indice: 0 } })).toThrow(RangeError)
    // El mensaje dice lo recibido y el rango válido.
    expect(() => dianasDe({ parcela, excluir: { recinto: 0, indice: 9 } })).toThrow(/9/)
    expect(() => dianasDe({ parcela, excluir: { recinto: 0, indice: 9 } })).toThrow(/4 vértice/)
  })

  it('LANZA TypeError si `parcela` no es objeto ni null, o si `colindantes` no es array', () => {
    for (const mala of [42, 'parcela', [], true]) {
      expect(() => dianasDe({ parcela: mala })).toThrow(TypeError)
    }
    for (const malas of [42, 'colindantes', {}, null]) {
      expect(() => dianasDe({ parcela: null, colindantes: malas })).toThrow(TypeError)
    }
    expect(() => dianasDe({ parcela: 42 })).toThrow(/dianasDe: 'parcela'/)
    expect(() => dianasDe({ colindantes: 42 })).toThrow(/dianasDe: 'colindantes'/)
  })
})

// ── dianasDe · no toca el modelo ─────────────────────────────────────────────

describe('edit/snap.js — dianasDe: no muta el modelo y no lo aliasa', () => {
  it('con la parcela CONGELADA en profundidad no revienta (así llega geometriaOficial)', () => {
    const parcela = congelar(parcelaTresFuentes())
    const colindantes = congelar(colindantesUna())
    let dianas
    expect(() => {
      dianas = dianasDe({ parcela, colindantes, excluir: { recinto: 0, indice: 1 } })
    }).not.toThrow()
    expect(dianas.vertices).toHaveLength(11) // 4 oficial + 4 colindante + 3 editable
  })

  it('la geometriaOficial de una parcela REAL del modelo está congelada y aun así se cataloga', () => {
    const parcela = crearParcela({
      idLocal: 'f06-snap-real',
      origen: 'WFS',
      recintos: [crearRecinto(OFICIAL, 'EXTERIOR')],
      geometriaOficial: [crearRecinto(OFICIAL, 'EXTERIOR')],
    })
    expect(Object.isFrozen(parcela.geometriaOficial[0].vertices)).toBe(true)
    expect(() => dianasDe({ parcela })).not.toThrow()
    expect(dianasDe({ parcela }).vertices).toHaveLength(8)
  })

  it('el modelo queda EXACTAMENTE igual tras construir el catálogo', () => {
    const parcela = parcelaTresFuentes()
    const colindantes = colindantesUna()
    const antesP = structuredClone(parcela)
    const antesC = structuredClone(colindantes)

    dianasDe({ parcela, colindantes, excluir: { recinto: 0, indice: 0 } })

    expect(parcela).toEqual(antesP)
    expect(colindantes).toEqual(antesC)
  })

  it('las copias NO comparten ninguna referencia con el modelo', () => {
    const parcela = parcelaTresFuentes()
    const colindantes = colindantesUna()
    const dianas = dianasDe({ parcela, colindantes })

    expect(compartidas(dianas, parcela)).toEqual([])
    expect(compartidas(dianas, colindantes)).toEqual([])
    expect(dianas.vertices[0]).not.toBe(parcela.geometriaOficial[0].vertices[0])

    // Mutar el catálogo no toca el modelo, y al revés.
    dianas.vertices[0][0] = -1
    expect(parcela.geometriaOficial[0].vertices[0][0]).toBe(OFICIAL[0][0])
    parcela.recintos[0].vertices[0][1] = -1
    expect(dianas.vertices[4][1]).toBe(COLINDANTE[0][1])
  })

  it('los extremos de un lado tampoco se aliasan entre sí ni con los vértices', () => {
    const parcela = soloEditable()
    const dianas = dianasDe({ parcela })
    expect(dianas.segmentos[0][0]).not.toBe(dianas.vertices[0])
    expect(dianas.segmentos[0][1]).not.toBe(dianas.segmentos[1][0])
  })
})

// ── ajustar · vértices ───────────────────────────────────────────────────────

describe('edit/snap.js — ajustar: enganche a VÉRTICE', () => {
  const dianas = () => ({ vertices: [[440000, 4480000], [440020, 4480000]], segmentos: [] })

  it('engancha al vértice dentro de τ y devuelve su coordenada EXACTA', () => {
    const r = ajustar([440000.12, 4480000.09], dianas(), { tolerancia: 0.2 })
    expect(r.enganchado).toBe(true)
    expect(r.tipo).toBe(TIPO_ENGANCHE.VERTICE)
    expect(r.punto).toEqual([440000, 4480000]) // exacta: de eso trata el snap a vértice
    expect(r.distancia).toBeCloseTo(Math.hypot(0.12, 0.09), 9)
    expect(r.t).toBeNull() // `t` es de los lados; en un vértice no significa nada
  })

  it('el más cercano gana entre varios vértices dentro de τ', () => {
    const catalogo = {
      vertices: [[440000, 4480000], [440000.1, 4480000], [440000.05, 4480000]],
      segmentos: [],
    }
    const r = ajustar([440000.06, 4480000], catalogo, { tolerancia: 0.2 })
    expect(r.punto).toEqual([440000.05, 4480000])
    expect(r.distancia).toBeCloseTo(0.01, 9)
  })

  it('justo a τ engancha (la comparación es INCLUSIVA); un poco más allá, no', () => {
    // τ = 0,25 m y no 0,2: sobre coordenadas UTM (X ≈ 4,4·10⁵) la resta
    // 440000.2 − 440000 NO da 0.2 exacto en float64, y el test estaría midiendo
    // el redondeo en vez de la comparación. Un cuarto de metro sí es exacto.
    expect(ajustar([440000.25, 4480000], dianas(), { tolerancia: 0.25 }).enganchado).toBe(true)
    expect(ajustar([440000.2500001, 4480000], dianas(), { tolerancia: 0.25 }).enganchado).toBe(false)
  })

  it('vértices no finitos en el catálogo: se ignoran sin lanzar', () => {
    const catalogo = { vertices: [[NaN, 4480000], null, [440000, 4480000]], segmentos: [] }
    let r
    expect(() => {
      r = ajustar([440000.05, 4480000], catalogo, { tolerancia: 0.2 })
    }).not.toThrow()
    expect(r.punto).toEqual([440000, 4480000])
  })
})

// ── ajustar · linderos ───────────────────────────────────────────────────────

describe('edit/snap.js — ajustar: enganche a LINDERO, con su `t`', () => {
  // Catálogo SIN vértices a propósito: el snap a vértice tiene prioridad y
  // taparía estos casos (ver el describe siguiente).
  const lado = () => ({ vertices: [], segmentos: [[[440000, 4480000], [440010, 4480000]]] })

  it('engancha al lindero dentro de τ, con el pie de la perpendicular y su t', () => {
    const r = ajustar([440005, 4480000.05], lado(), { tolerancia: 0.2 })
    expect(r.enganchado).toBe(true)
    expect(r.tipo).toBe(TIPO_ENGANCHE.LINDERO)
    expect(r.punto[0]).toBeCloseTo(440005, 6)
    expect(r.punto[1]).toBeCloseTo(4480000, 6)
    expect(r.distancia).toBeCloseTo(0.05, 9)
    expect(r.t).toBeCloseTo(0.5, 9)
  })

  it('0 < t < 1 ⇒ el pie cae en el INTERIOR del lado (hay vértice que insertar)', () => {
    const r = ajustar([440002.5, 4479999.9], lado(), { tolerancia: 0.2 })
    expect(r.t).toBeCloseTo(0.25, 9)
    expect(r.t).toBeGreaterThan(0)
    expect(r.t).toBeLessThan(1)
  })

  it('t = 1 ⇒ el enganche cae en el EXTREMO B (ahí ya hay vértice, no se inserta)', () => {
    const r = ajustar([440010.1, 4480000.05], lado(), { tolerancia: 0.2 })
    expect(r.tipo).toBe(TIPO_ENGANCHE.LINDERO)
    expect(r.t).toBe(1)
    expect(r.punto).toEqual([440010, 4480000])
    expect(r.distancia).toBeCloseTo(Math.hypot(0.1, 0.05), 9)
  })

  it('t = 0 ⇒ el enganche cae en el EXTREMO A', () => {
    const r = ajustar([439999.9, 4480000.05], lado(), { tolerancia: 0.2 })
    expect(r.t).toBe(0)
    expect(r.punto).toEqual([440000, 4480000])
  })

  it('el lindero más cercano gana entre varios', () => {
    const catalogo = {
      vertices: [],
      segmentos: [
        [[440000, 4480000.15], [440010, 4480000.15]],
        [[440000, 4479999.95], [440010, 4479999.95]],
      ],
    }
    const r = ajustar([440005, 4480000], catalogo, { tolerancia: 0.2 })
    expect(r.punto[1]).toBeCloseTo(4479999.95, 6)
    expect(r.distancia).toBeCloseTo(0.05, 9)
  })

  it('lados degenerados o malformados en el catálogo: se ignoran sin lanzar', () => {
    const catalogo = {
      vertices: [],
      segmentos: [
        [[440000, 4480000], [440000, 4480000]], // longitud nula
        [[NaN, 0], [440010, 4480000]],
        [[440000, 4480000]], // par incompleto
        null,
        [[440000, 4480000.05], [440010, 4480000.05]],
      ],
    }
    let r
    expect(() => {
      r = ajustar([440005, 4480000], catalogo, { tolerancia: 0.2 })
    }).not.toThrow()
    expect(r.tipo).toBe(TIPO_ENGANCHE.LINDERO)
    expect(r.punto[1]).toBeCloseTo(4480000.05, 6)
  })
})

// ── ajustar · la prioridad ───────────────────────────────────────────────────

describe('edit/snap.js — ajustar: VÉRTICE gana a LINDERO aunque el lindero esté más cerca', () => {
  it('lindero a 5 cm y vértice a 15 cm: gana el VÉRTICE (dossier §3.6)', () => {
    const catalogo = {
      vertices: [[440005.15, 4480000.05]], // a 15 cm del punto
      segmentos: [[[440000, 4480000], [440010, 4480000]]], // a 5 cm del punto
    }
    const punto = [440005, 4480000.05]
    // Comprobación independiente de que el lindero ESTÁ más cerca:
    expect(hipot(punto, catalogo.vertices[0])).toBeCloseTo(0.15, 9)

    const r = ajustar(punto, catalogo, { tolerancia: 0.2 })
    expect(r.tipo).toBe(TIPO_ENGANCHE.VERTICE)
    expect(r.punto).toEqual([440005.15, 4480000.05])
    expect(r.distancia).toBeCloseTo(0.15, 9)
    expect(r.t).toBeNull()
  })

  it('si el vértice se sale de τ, el lindero recupera el enganche', () => {
    const catalogo = {
      vertices: [[440005.15, 4480000.05]],
      segmentos: [[[440000, 4480000], [440010, 4480000]]],
    }
    // τ = 0,10 m: el vértice (0,15) queda fuera; el lindero (0,05) dentro.
    const r = ajustar([440005, 4480000.05], catalogo, { tolerancia: 0.1 })
    expect(r.tipo).toBe(TIPO_ENGANCHE.LINDERO)
    expect(r.t).toBeCloseTo(0.5, 9)
  })

  it('un vértice al final de la lista sigue ganando a un lindero más cercano', () => {
    // El recorrido de vértices es COMPLETO antes de mirar ni un lado.
    const catalogo = {
      vertices: Array.from({ length: 50 }, (_, i) => [440100 + i, 4480100]).concat([
        [440005.19, 4480000],
      ]),
      segmentos: [[[440000, 4480000], [440010, 4480000]]],
    }
    const r = ajustar([440005, 4480000.01], catalogo, { tolerancia: 0.2 })
    expect(r.tipo).toBe(TIPO_ENGANCHE.VERTICE)
    expect(r.punto).toEqual([440005.19, 4480000])
  })
})

// ── ajustar · sin enganche y tolerancia ──────────────────────────────────────

describe('edit/snap.js — ajustar: sin enganche y tolerancia', () => {
  const catalogo = () => ({
    vertices: [[440000, 4480000]],
    segmentos: [[[440000, 4480000], [440010, 4480000]]],
  })

  it('nada dentro de τ: enganchado false, tipo/distancia/t null y el punto de entrada INTACTO', () => {
    const punto = [440005, 4480003]
    const r = ajustar(punto, catalogo(), { tolerancia: 0.2 })
    expect(r).toEqual({
      punto: [440005, 4480003],
      enganchado: false,
      tipo: null,
      distancia: null,
      t: null,
    })
    // Nunca devuelve null: el llamante siempre tiene un punto utilizable…
    expect(r.punto).not.toBeNull()
    // …y es una COPIA, no el array de entrada.
    expect(r.punto).not.toBe(punto)
    r.punto[0] = -1
    expect(punto[0]).toBe(440005)
  })

  it('catálogo VACÍO: no engancha y no lanza', () => {
    const r = ajustar([440005, 4480000], { vertices: [], segmentos: [] })
    expect(r.enganchado).toBe(false)
    expect(r.punto).toEqual([440005, 4480000])
  })

  it('τ = 0 apaga el snap (la tecla modificadora): ni una diana a distancia 0 engancha', () => {
    const r = ajustar([440000, 4480000], catalogo(), { tolerancia: 0 })
    expect(r.enganchado).toBe(false)
    expect(r.tipo).toBeNull()
    expect(r.punto).toEqual([440000, 4480000])
  })

  it('τ negativa: tampoco engancha, y NO lanza (no hay rama especial de apagado)', () => {
    for (const tolerancia of [-0.001, -1, -1e9]) {
      const r = ajustar([440000, 4480000], catalogo(), { tolerancia })
      expect(r.enganchado).toBe(false)
      expect(r.distancia).toBeNull()
    }
  })

  it('τ grande engancha desde lejos: el umbral es de verdad el que se pasa', () => {
    const r = ajustar([440005, 4480003], catalogo(), { tolerancia: 5 })
    expect(r.enganchado).toBe(true)
    expect(r.tipo).toBe(TIPO_ENGANCHE.LINDERO)
    expect(r.distancia).toBeCloseTo(3, 9)
  })
})

// ── ajustar · determinismo ───────────────────────────────────────────────────

describe('edit/snap.js — ajustar: determinismo del empate', () => {
  it('dos vértices a la MISMA distancia: gana el primero del recorrido', () => {
    // Un cuarto de metro por cada eje: es exacto en float64 sobre estas dos
    // coordenadas UTM, así que el empate es EMPATE y no «casi».
    const catalogo = { vertices: [[440000, 4480000.25], [440000.25, 4480000]], segmentos: [] }
    const punto = [440000, 4480000]
    expect(hipot(punto, catalogo.vertices[0])).toBe(hipot(punto, catalogo.vertices[1]))

    const r = ajustar(punto, catalogo, { tolerancia: 0.5 })
    expect(r.punto).toEqual([440000, 4480000.25])
    // Y la misma entrada da SIEMPRE la misma salida.
    for (let i = 0; i < 5; i++) {
      expect(ajustar(punto, catalogo, { tolerancia: 0.5 })).toEqual(r)
    }
  })

  it('dos lados a la MISMA distancia: gana el primero del recorrido', () => {
    const catalogo = {
      vertices: [],
      segmentos: [
        [[440000, 4480000.05], [440010, 4480000.05]],
        [[440000, 4479999.95], [440010, 4479999.95]],
      ],
    }
    const r = ajustar([440005, 4480000], catalogo, { tolerancia: 0.2 })
    expect(r.punto[1]).toBeCloseTo(4480000.05, 6)
  })

  it('el orden del catálogo manda: la diana OFICIAL gana el empate a la editable', () => {
    // `dianasDe` cataloga primero lo oficial: en un empate exacto (parcela recién
    // descargada, donde `recintos` y `geometriaOficial` coinciden) la respuesta es
    // siempre la misma, y es la oficial.
    const parcela = {
      recintos: [{ vertices: structuredClone(OFICIAL), tipo: 'EXTERIOR' }],
      geometriaOficial: [{ vertices: structuredClone(OFICIAL), tipo: 'EXTERIOR' }],
    }
    const dianas = dianasDe({ parcela })
    const r = ajustar([OFICIAL[1][0] + 0.05, OFICIAL[1][1]], dianas)
    expect(r.punto).toEqual(OFICIAL[1])
    expect(r.punto).not.toBe(parcela.recintos[0].vertices[1])
  })
})

// ── ajustar · contrato ───────────────────────────────────────────────────────

describe('edit/snap.js — ajustar: contrato roto por el PROGRAMADOR → throw', () => {
  const catalogo = () => ({ vertices: [[440000, 4480000]], segmentos: [] })

  it('LANZA TypeError si `punto` no es un par UTM de números finitos', () => {
    for (const malo of [null, undefined, [1], [NaN, 2], [1, Infinity], ['1', '2'], { x: 1, y: 2 }, 5]) {
      expect(() => ajustar(malo, catalogo())).toThrow(TypeError)
    }
    expect(() => ajustar([1, NaN], catalogo())).toThrow(/ajustar: 'punto'/)
  })

  it('LANZA TypeError si `dianas` no tiene la forma del catálogo', () => {
    for (const malas of [null, undefined, 42, 'dianas', {}, { vertices: [] }, { segmentos: [] }, [[], []]]) {
      expect(() => ajustar([440000, 4480000], malas)).toThrow(TypeError)
    }
    expect(() => ajustar([440000, 4480000], { vertices: [] })).toThrow(/ajustar: 'dianas'/)
  })

  it('LANZA TypeError si `tolerancia` no es un número finito (τ ≤ 0 sí es válido)', () => {
    for (const mala of [NaN, Infinity, -Infinity, '0.2', null, {}]) {
      expect(() => ajustar([440000, 4480000], catalogo(), { tolerancia: mala })).toThrow(TypeError)
    }
    expect(() => ajustar([440000, 4480000], catalogo(), { tolerancia: NaN })).toThrow(
      /ajustar: 'tolerancia'/,
    )
    expect(() => ajustar([440000, 4480000], catalogo(), { tolerancia: 0 })).not.toThrow()
    expect(() => ajustar([440000, 4480000], catalogo(), { tolerancia: -1 })).not.toThrow()
    // `undefined` NO es un error: es «no me pases opción», y entra el defecto.
    expect(() => ajustar([440000, 4480000], catalogo(), { tolerancia: undefined })).not.toThrow()
  })
})

// ── Integración: la parcela REAL del proyecto ────────────────────────────────

describe('edit/snap.js — integración con la parcela real 9398516VK3799G', () => {
  // Anillo EXTERIOR de 15 vértices tal como lo emite el WFS del Catastro, en
  // EPSG:25830 (X ≈ 439.222–439.283, Y ≈ 4.479.637–4.479.687). Es la fuente de
  // verdad del proyecto (regla de oro 8) y la misma parcela que carga la demo.
  const parcelaReal = () =>
    crearParcela({
      idLocal: `f06-snap-${ring.refCatastral}`,
      refcat: ring.refCatastral,
      origen: 'WFS',
      recintos: [crearRecinto(ring.anilloExterior, 'EXTERIOR')],
      geometriaOficial: [crearRecinto(ring.anilloExterior, 'EXTERIOR')],
    })

  /** Punto a `d` metros del lado A→B del anillo oficial, medido en su perpendicular. */
  function aLadoDeLindero(iA, iB, d, alfa = 0.5) {
    const A = ring.anilloExterior[iA]
    const B = ring.anilloExterior[iB]
    const largo = hipot(A, B)
    const ux = (B[0] - A[0]) / largo
    const uy = (B[1] - A[1]) / largo
    const sobre = [A[0] + alfa * (B[0] - A[0]), A[1] + alfa * (B[1] - A[1])]
    // Normal unitaria (−uy, ux): el desplazamiento es EXACTAMENTE `d` metros.
    return { punto: [sobre[0] - uy * d, sobre[1] + ux * d], sobre, largo }
  }

  it('arrastrado a 5 cm del lindero oficial: ENGANCHA al lindero, con su t', () => {
    const parcela = parcelaReal()
    const dianas = dianasDe({ parcela, excluir: { recinto: 0, indice: 0 } })
    const { punto, sobre, largo } = aLadoDeLindero(13, 14, 0.05)
    expect(largo).toBeGreaterThan(30) // lado largo: ningún vértice cerca

    const r = ajustar(punto, dianas)
    expect(r.enganchado).toBe(true)
    expect(r.tipo).toBe(TIPO_ENGANCHE.LINDERO)
    expect(r.distancia).toBeCloseTo(0.05, 6)
    expect(r.t).toBeCloseTo(0.5, 6)
    expect(r.punto[0]).toBeCloseTo(sobre[0], 6)
    expect(r.punto[1]).toBeCloseTo(sobre[1], 6)
  })

  it('el mismo vértice a 50 cm: NO engancha y el punto queda donde lo dejó el usuario', () => {
    const parcela = parcelaReal()
    const dianas = dianasDe({ parcela, excluir: { recinto: 0, indice: 0 } })
    const { punto } = aLadoDeLindero(13, 14, 0.5)

    const r = ajustar(punto, dianas)
    expect(r.enganchado).toBe(false)
    expect(r.tipo).toBeNull()
    expect(r.distancia).toBeNull()
    expect(r.punto).toEqual(punto)
  })

  it('cerca de un vértice oficial gana el VÉRTICE, aunque sus dos lados pasen más cerca', () => {
    const parcela = parcelaReal()
    const dianas = dianasDe({ parcela, excluir: { recinto: 0, indice: 0 } })
    const objetivo = ring.anilloExterior[6]
    // 8 cm en diagonal desde el vértice 6: dentro de τ (20 cm).
    const punto = [objetivo[0] + 0.06, objetivo[1] + 0.06]

    const r = ajustar(punto, dianas)
    expect(r.tipo).toBe(TIPO_ENGANCHE.VERTICE)
    expect(r.punto).toEqual(objetivo) // coordenada EXACTA del Catastro
    expect(r.t).toBeNull()
  })

  it('el catálogo de la parcela real: 15 dianas de vértice y 15 lados por anillo', () => {
    const parcela = parcelaReal()
    const dianas = dianasDe({ parcela })
    // Oficial + editable, y la parcela real no tiene huecos.
    expect(dianas.vertices).toHaveLength(30)
    expect(dianas.segmentos).toHaveLength(30)
    // Con el vértice 0 arrastrado: 15 oficiales + 14 editables, 15 + 13 lados.
    const conArrastre = dianasDe({ parcela, excluir: { recinto: 0, indice: 0 } })
    expect(conArrastre.vertices).toHaveLength(29)
    expect(conArrastre.segmentos).toHaveLength(28)
  })

  it('todo sale en UTM (metros): ninguna coordenada cae en el rango de un grado', () => {
    const dianas = dianasDe({ parcela: parcelaReal() })
    const planas = [...dianas.vertices, ...dianas.segmentos.flat()]
    for (const [x, y] of planas) {
      expect(Math.abs(x)).toBeGreaterThan(1000) // un grado jamás pasa de 180
      expect(Math.abs(y)).toBeGreaterThan(1000)
    }
    const r = ajustar([439250.35, 4479664.55], dianas, { tolerancia: 50 })
    expect(Math.abs(r.punto[0])).toBeGreaterThan(1000)
    expect(Math.abs(r.punto[1])).toBeGreaterThan(1000)
  })
})

// ── Rendimiento: se MIDE, no se afirma de memoria ────────────────────────────

describe('edit/snap.js — rendimiento con el catálogo en su techo', () => {
  /** Anillo circular de `n` vértices y radio 30 m: geometría realista y barata. */
  const anilloDe = (cx, cy, n) =>
    Array.from({ length: n }, (_, i) => {
      const a = (2 * Math.PI * i) / n
      return [cx + 30 * Math.cos(a), cy + 30 * Math.sin(a)]
    })

  it('un catálogo de ~10.000 dianas se construye y se consulta 60 veces sin acercarse al presupuesto de un fotograma', () => {
    // `maxVertices` (500) es el techo por el que el visor y el GML dejan de ser
    // manejables (config/operativos.json). Se monta el peor caso plausible: la
    // parcela en su techo, su oficial también, y OCHO colindantes iguales.
    const N = OPERATIVOS.maxVertices
    const parcela = {
      recintos: [{ vertices: anilloDe(440000, 4480000, N), tipo: 'EXTERIOR' }],
      geometriaOficial: [{ vertices: anilloDe(440000, 4480000, N), tipo: 'EXTERIOR' }],
    }
    const colindantes = Array.from({ length: 8 }, (_, k) => ({
      recintos: [{ vertices: anilloDe(440000 + 70 * (k + 1), 4480000, N), tipo: 'EXTERIOR' }],
    }))

    const t0 = performance.now()
    const dianas = dianasDe({ parcela, colindantes, excluir: { recinto: 0, indice: 0 } })
    const msCatalogo = performance.now() - t0

    // 10 anillos de 500: 5.000 vértices menos el arrastrado, 5.000 lados menos sus dos.
    expect(dianas.vertices).toHaveLength(10 * N - 1)
    expect(dianas.segmentos).toHaveLength(10 * N - 2)
    // El catálogo se construye UNA vez por arrastre (en `dragstart`).
    expect(msCatalogo).toBeLessThan(200)

    // Peor caso de consulta: un punto que NO engancha, que obliga a recorrer los
    // dos catálogos enteros sin poder salir antes.
    const lejos = [430000, 4470000]
    expect(ajustar(lejos, dianas).enganchado).toBe(false)

    const t1 = performance.now()
    for (let i = 0; i < 60; i++) ajustar(lejos, dianas)
    const ms60 = performance.now() - t1

    // 60 llamadas = un segundo de arrastre a 60 fps. El presupuesto de un
    // fotograma es 16,6 ms; se exige menos de la MITAD por llamada (8,3 ms), con
    // margen de sobra sobre lo medido, para que el test no sea un cronómetro
    // caprichoso pero siga cayendo si alguien mete un algoritmo cuadrático.
    expect(ms60).toBeLessThan(500)
  })

  it('el coste es LINEAL en el nº de dianas (no cuadrático)', () => {
    const catalogoDe = (n) => ({
      vertices: anilloDe(440000, 4480000, n),
      segmentos: anilloDe(440000, 4480000, n).map((v, i, a) => [v, a[(i + 1) % n]]),
    })
    const medir = (catalogo) => {
      const lejos = [430000, 4470000]
      for (let i = 0; i < 20; i++) ajustar(lejos, catalogo) // calentar
      const t = performance.now()
      for (let i = 0; i < 200; i++) ajustar(lejos, catalogo)
      return performance.now() - t
    }
    const chico = medir(catalogoDe(500))
    const grande = medir(catalogoDe(5000))
    // ×10 dianas debería costar ~×10. Se admite hasta ×40 (el reloj de un
    // portátil no es un banco de pruebas), que sigue descartando un O(n²) —que
    // costaría ×100— sin convertir el test en un dado.
    expect(grande).toBeLessThan(Math.max(chico, 1) * 40)
  })
})

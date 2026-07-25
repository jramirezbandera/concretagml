import { describe, it, expect } from 'vitest'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import { areaFirmada, area, orientacion, superficie } from '../../geo/area.js'

// F00 · geo/area.js — shoelace sobre anillo abierto con traslación a origen local.
// Convención de orientación (override O1): CCW=+1, CW=−1; Catastro quiere el
// exterior HORARIO (A_signed<0). Ver spec/feature-00-cimientos.md y SPEC §2/§3.

describe('geo/area.js — polígonos sintéticos', () => {
  // Cuadrado 10×10 = 100. Orden ANTIHORARIO (CCW): A_signed > 0 ⇒ +1.
  const cuadradoCCW = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
  ]
  // El mismo cuadrado en orden HORARIO (CW): A_signed < 0 ⇒ −1.
  const cuadradoCW = [
    [0, 0],
    [0, 10],
    [10, 10],
    [10, 0],
  ]

  it('cuadrado 10×10: |área| = 100', () => {
    expect(area(cuadradoCCW)).toBeCloseTo(100, 9)
    expect(area(cuadradoCW)).toBeCloseTo(100, 9)
  })

  it('el orden de vértices decide el signo del área firmada', () => {
    expect(areaFirmada(cuadradoCCW)).toBeCloseTo(100, 9)
    expect(areaFirmada(cuadradoCW)).toBeCloseTo(-100, 9)
  })

  it('orientación: CCW ⇒ +1, CW ⇒ −1', () => {
    expect(orientacion(cuadradoCCW)).toBe(1)
    expect(orientacion(cuadradoCW)).toBe(-1)
  })

  it('triángulo rectángulo (base 6, altura 4) = 12', () => {
    const triCCW = [
      [0, 0],
      [6, 0],
      [0, 4],
    ]
    expect(area(triCCW)).toBeCloseTo(12, 9)
    expect(areaFirmada(triCCW)).toBeCloseTo(12, 9)
    expect(orientacion(triCCW)).toBe(1)
    // Invertido → horario.
    const triCW = [
      [0, 0],
      [0, 4],
      [6, 0],
    ]
    expect(areaFirmada(triCW)).toBeCloseTo(-12, 9)
    expect(orientacion(triCW)).toBe(-1)
  })

  it('la traslación a origen local preserva el valor con Norte ≈ 4·10⁶', () => {
    // Cuadrado 10×10 desplazado a coordenadas UTM reales (Este ~439k, Norte ~4.48M).
    const cuadradoUTM = [
      [439000, 4479000],
      [439010, 4479000],
      [439010, 4479010],
      [439000, 4479010],
    ]
    expect(area(cuadradoUTM)).toBeCloseTo(100, 9)
    expect(orientacion(cuadradoUTM)).toBe(1)
  })
})

describe('geo/area.js — regresión con la parcela real (fixture)', () => {
  const anilloExterior = ring.anilloExterior

  it('el fixture es un anillo abierto de 15 vértices', () => {
    expect(anilloExterior).toHaveLength(15)
    expect(anilloExterior[0]).not.toEqual(anilloExterior.at(-1))
  })

  it('areaFirmada ≈ −1535.865149996761 (tol 1e-6)', () => {
    expect(areaFirmada(anilloExterior)).toBeCloseTo(-1535.865149996761, 6)
  })

  it('orientación === −1 (HORARIO, convención Catastro para el exterior)', () => {
    expect(orientacion(anilloExterior)).toBe(-1)
  })

  it('|área| redondeada === 1536 (== areaValue del GML real)', () => {
    expect(Math.round(area(anilloExterior))).toBe(1536)
    expect(Math.round(area(anilloExterior))).toBe(ring.areaValue)
  })
})

describe('geo/area.js — superficie con huecos', () => {
  it('resta el área del hueco interior (exterior − hueco)', () => {
    const exterior = {
      tipo: 'EXTERIOR',
      // Cuadrado 10×10 = 100 (antihorario).
      vertices: [
        [0, 0],
        [10, 0],
        [10, 10],
        [0, 10],
      ],
    }
    const hueco = {
      tipo: 'HUECO',
      // Cuadrado 2×2 = 4 interior (huecos van antihorario/horario indistinto: se usa |A|).
      vertices: [
        [2, 2],
        [4, 2],
        [4, 4],
        [2, 4],
      ],
    }
    expect(superficie([exterior, hueco])).toBeCloseTo(96, 9)
    // Sin huecos: la superficie es la del exterior.
    expect(superficie([exterior])).toBeCloseTo(100, 9)
  })

  it('resta varios huecos', () => {
    const exterior = {
      tipo: 'EXTERIOR',
      vertices: [
        [0, 0],
        [20, 0],
        [20, 20],
        [0, 20],
      ],
    } // 400
    const hueco1 = {
      tipo: 'HUECO',
      vertices: [
        [1, 1],
        [4, 1],
        [4, 4],
        [1, 4],
      ],
    } // 9
    const hueco2 = {
      tipo: 'HUECO',
      vertices: [
        [10, 10],
        [15, 10],
        [15, 15],
        [10, 15],
      ],
    } // 25
    expect(superficie([exterior, hueco1, hueco2])).toBeCloseTo(400 - 9 - 25, 9)
  })

  it('recintos[0] no-EXTERIOR lanza (guarda de invariante, auditoría A9)', () => {
    const hueco = { tipo: 'HUECO', vertices: [[0, 0], [1, 0], [1, 1]] }
    expect(() => superficie([hueco])).toThrow(TypeError)
  })

  it('recinto i≥1 que no sea HUECO lanza — antes se ignoraba en silencio (regla 1)', () => {
    const exterior = { tipo: 'EXTERIOR', vertices: [[0, 0], [10, 0], [10, 10], [0, 10]] }
    const otro = { tipo: 'OTRO', vertices: [[1, 1], [2, 1], [2, 2]] }
    const segundoExterior = { tipo: 'EXTERIOR', vertices: [[1, 1], [2, 1], [2, 2]] }
    expect(() => superficie([exterior, otro])).toThrow(TypeError)
    expect(() => superficie([exterior, segundoExterior])).toThrow(TypeError)
  })
})

describe('anillos degenerados (auditoría A8)', () => {
  it('menos de 3 vértices → área 0 (vacío, 1 y 2 vértices)', () => {
    expect(areaFirmada([])).toBe(0)
    expect(areaFirmada([[5, 5]])).toBe(0)
    expect(areaFirmada([[0, 0], [10, 10]])).toBe(0)
    expect(area([[0, 0], [10, 10]])).toBe(0)
  })

  it('3 vértices colineales → área 0, también en coordenadas UTM reales', () => {
    expect(areaFirmada([[0, 0], [5, 5], [10, 10]])).toBe(0)
    expect(areaFirmada([[439250, 4479664], [439260, 4479674], [439270, 4479684]])).toBeCloseTo(0, 9)
  })

  it('orientacion de un anillo degenerado (área 0) → +1 (convención documentada)', () => {
    expect(orientacion([])).toBe(1)
    expect(orientacion([[0, 0], [10, 10]])).toBe(1)
    expect(orientacion([[0, 0], [5, 5], [10, 10]])).toBe(1)
  })

  it('vértices duplicados consecutivos no alteran el área', () => {
    const conDuplicado = [[0, 0], [10, 0], [10, 0], [10, 10], [0, 10]]
    expect(area(conDuplicado)).toBeCloseTo(100, 9)
  })
})

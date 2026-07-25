import { describe, it, expect } from 'vitest'
import { errorCierre, compensarCierre } from '../../geo/cierre.js'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }

// Distancia euclídea local para los asserts (no depende del módulo bajo prueba).
const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

describe('geo/cierre — errorCierre (misclosure)', () => {
  it('cierre perfecto (último = primero exacto) → error ≈ 0', () => {
    const anillo = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    expect(errorCierre(anillo)).toBeCloseTo(0, 12)
  })

  it('misclosure deliberado de 0.10 m → error ≈ 0.10 (tol 1e-9)', () => {
    const anillo = [[0, 0], [10, 0], [10, 10], [0, 10], [0.1, 0]]
    expect(Math.abs(errorCierre(anillo) - 0.1)).toBeLessThan(1e-9)
  })

  it('mide la distancia euclídea real primer↔último (3-4-5)', () => {
    const anillo = [[0, 0], [10, 0], [0, 10], [3, 4]]
    expect(errorCierre(anillo)).toBeCloseTo(5, 12)
  })

  it('valida la entrada (lanza, no falla en silencio)', () => {
    expect(() => errorCierre(null)).toThrow(TypeError)
    expect(() => errorCierre([[0, 0]])).toThrow(RangeError)
    expect(() => errorCierre([[0, 0], [NaN, 1]])).toThrow(TypeError)
  })
})

describe('geo/cierre — compensarCierre', () => {
  it('cierre perfecto: anillo abierto (n−1), sin mover nada, error 0, no aplicado', () => {
    const anillo = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]
    const r = compensarCierre(anillo)
    expect(r.anillo).toHaveLength(anillo.length - 1)
    expect(r.error).toBeCloseTo(0, 12)
    expect(r.aplicado).toBe(false)
    expect(r.anillo).toEqual([[0, 0], [10, 0], [10, 10], [0, 10]])
    // El anillo devuelto está ABIERTO: no repite el vértice de cierre.
    expect(r.anillo[0]).not.toEqual(r.anillo.at(-1))
  })

  it('no muta el anillo de entrada', () => {
    const anillo = [[0, 0], [10, 0], [10, 10], [0, 10], [0.1, 0]]
    const copia = structuredClone(anillo)
    compensarCierre(anillo)
    expect(anillo).toEqual(copia)
  })

  it('misclosure 0.10: elimina el cierre, devuelve el error, y al re-cerrar coincide < 1e-9', () => {
    const anillo = [[0, 0], [10, 0], [10, 10], [0, 10], [0.1, 0]]
    const r = compensarCierre(anillo)
    expect(r.aplicado).toBe(true)
    expect(Math.abs(r.error - 0.1)).toBeLessThan(1e-9)
    expect(r.anillo).toHaveLength(anillo.length - 1)
    // Modelo: anillo guardado abierto; al serializar se cierra repitiendo V0.
    const cerrado = [...r.anillo, r.anillo[0]]
    expect(errorCierre(cerrado)).toBeLessThan(1e-9)
    // El primer vértice queda fijo (ancla del reparto).
    expect(r.anillo[0]).toEqual([0, 0])
  })

  it('Bowditch: la corrección de cada vértice es proporcional a la longitud acumulada', () => {
    // Triángulo con tramos DESIGUALES (3, 5, 3.95) para distinguir de 'lineal'.
    const V0 = [0, 0]
    const V1 = [3, 0]
    const V2 = [0, 4]
    const anillo = [V0, V1, V2, [0, 0.05]] // debería cerrar en V0; misclosure 0.05 en Y
    const r = compensarCierre(anillo, { metodo: 'bowditch' })

    const S1 = dist(V0, V1)           // 3
    const S2 = S1 + dist(V1, V2)      // 3 + 5 = 8
    const c1 = [r.anillo[1][0] - V1[0], r.anillo[1][1] - V1[1]]
    const c2 = [r.anillo[2][0] - V2[0], r.anillo[2][1] - V2[1]]

    // c_k = −e·(S_k/P)  ⇒  c_k/S_k = −e/P constante  ⇒  c1/S1 == c2/S2.
    // (Una implementación 'lineal' por índice NO cumple esto con tramos desiguales.)
    expect(c1[1] / S1).toBeCloseTo(c2[1] / S2, 12)
    expect(r.anillo[0]).toEqual([0, 0]) // V0 fijo
  })

  it("lineal: reparto proporcional al índice, no a la longitud", () => {
    const V0 = [0, 0]
    const V1 = [3, 0]
    const V2 = [0, 4]
    const anillo = [V0, V1, V2, [0, 0.05]]
    const r = compensarCierre(anillo, { metodo: 'lineal' })
    const c1y = r.anillo[1][1] - V1[1]
    const c2y = r.anillo[2][1] - V2[1]
    // w_k = k/(n−1) con n=4 ⇒ w1=1/3, w2=2/3 ⇒ c2 = 2·c1.
    expect(c2y).toBeCloseTo(2 * c1y, 12)
  })

  it('conserva la forma: ningún vértice se mueve más que el error de cierre', () => {
    const anillo = [[0, 0], [10, 0], [10, 10], [0, 10], [0.1, 0]]
    const r = compensarCierre(anillo)
    const orig = anillo.slice(0, -1)
    for (let i = 0; i < orig.length; i++) {
      expect(dist(orig[i], r.anillo[i])).toBeLessThanOrEqual(r.error + 1e-12)
    }
  })

  it('la suma de correcciones cierra el polígono (misclosure absorbido)', () => {
    const anillo = [[5, 5], [25, 5], [25, 20], [5, 20], [5.07, 4.96]]
    const errAntes = errorCierre(anillo)
    const r = compensarCierre(anillo)
    const cerrado = [...r.anillo, r.anillo[0]]
    expect(errAntes).toBeGreaterThan(0.05)
    expect(errorCierre(cerrado)).toBeLessThan(1e-9)
    expect(r.error).toBeCloseTo(errAntes, 12)
  })

  it('método desconocido lanza (ningún error silencioso)', () => {
    const anillo = [[0, 0], [10, 0], [10, 10], [0, 10], [0.1, 0]]
    expect(() => compensarCierre(anillo, { metodo: 'transit' })).toThrow(RangeError)
  })

  it('parcela real (fixture): cierra el anillo con misclosure y lo compensa', () => {
    const abiertoReal = ring.anilloExterior // 15 vértices, anillo abierto real
    const p0 = abiertoReal[0]
    // Cerramos el anillo con un vértice de cierre desviado 0.10 m (0.08 E, 0.06 S).
    const cierreMalo = [p0[0] + 0.08, p0[1] - 0.06]
    const entrada = [...abiertoReal.map((v) => [...v]), cierreMalo]

    // Coords UTM grandes (~4.4e6): tolerancia realista 1e-9 (cancelación float64).
    expect(Math.abs(errorCierre(entrada) - Math.hypot(0.08, 0.06))).toBeLessThan(1e-9) // = 0.10

    const r = compensarCierre(entrada)
    expect(r.aplicado).toBe(true)
    expect(r.anillo).toHaveLength(abiertoReal.length) // 16 − 1 = 15
    expect(Math.abs(r.error - 0.1)).toBeLessThan(1e-9)
    expect(r.anillo[0]).toEqual(p0) // primer vértice fijo

    const cerrado = [...r.anillo, r.anillo[0]]
    expect(errorCierre(cerrado)).toBeLessThan(1e-9)
  })
})

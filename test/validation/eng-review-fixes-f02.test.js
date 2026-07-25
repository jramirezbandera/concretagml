/* -------------------------------------------------------------------------- *
 * test/validation/eng-review-fixes-f02.test.js                                 *
 *                                                                              *
 * Tests de las conductas añadidas en la eng-review de F02:                      *
 *   · Finding 1 — guard estructural: parcela sin EXTERIOR ⇒ ERROR bloqueante.  *
 *   · Finding 2 — autointersección PINPOINT: verticesAfectados = los extremos  *
 *     de los segmentos que cruzan (subconjunto), no el anillo entero.           *
 *   · Robustez — throw en recintos no-array; regla de huso inerte sin `srs`.    *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { validarParcela, NIVEL } from '../../validation/parcela.js'
import { crearRecinto } from '../../model/parcela.js'

const SRS = 'EPSG:25830'
const BX = 440000
const BY = 4480000
const p = (dx, dy) => [BX + dx, BY + dy]
const claveSet = (refs) => new Set(refs.map((r) => `${r.recinto}:${r.indice}`))

// ── Finding 1 · guard estructural "sin exterior" ──────────────────────────────
describe('F02 · guard estructural (finding 1)', () => {
  it('recintos vacío ⇒ 1 ERROR bloqueante y puedeGenerar=false', () => {
    const r = validarParcela([], { srs: SRS })
    expect(r.puedeGenerar).toBe(false)
    expect(r.errores).toHaveLength(1)
    expect(r.errores[0].nivel).toBe(NIVEL.ERROR)
    expect(r.errores[0].mensaje).toMatch(/contorno exterior/i)
    expect(r.avisos).toEqual([])
  })

  it('recintos[0] no es EXTERIOR ⇒ ERROR bloqueante señalando ese recinto', () => {
    const soloHueco = [crearRecinto([p(0, 0), p(10, 0), p(10, 10), p(0, 10)], 'HUECO')]
    const r = validarParcela(soloHueco, { srs: SRS })
    expect(r.puedeGenerar).toBe(false)
    expect(r.errores.some((h) => /contorno EXTERIOR/i.test(h.mensaje))).toBe(true)
    // corta antes de correr las reglas normales: un único hallazgo estructural.
    expect(r.errores).toHaveLength(1)
    expect(claveSet(r.errores[0].verticesAfectados)).toEqual(
      new Set(['0:0', '0:1', '0:2', '0:3']),
    )
  })

  it('una parcela válida con EXTERIOR NO dispara el guard', () => {
    const ok = [crearRecinto([p(0, 0), p(30, 0), p(30, 30), p(0, 30)], 'EXTERIOR')]
    const r = validarParcela(ok, { srs: SRS })
    expect(r.puedeGenerar).toBe(true)
    expect(r.errores).toEqual([])
  })
})

// ── Finding 2 · autointersección pinpoint ─────────────────────────────────────
describe('F02 · autointersección pinpoint (finding 2)', () => {
  // Polígono de 6 vértices con UN solo cruce: el segmento vertical v3→v4 (x=4)
  // cruza el segmento inferior v0→v1 (y=0) en (4,0). Vértices implicados:
  // {0,1} (segmento inferior) y {3,4} (segmento vertical). v2 y v5 quedan LIMPIOS.
  const autoint = [
    crearRecinto(
      [p(0, 0), p(10, 0), p(10, 10), p(4, 10), p(4, -5), p(-3, -5)],
      'EXTERIOR',
    ),
  ]

  it('marca los extremos de los segmentos que cruzan, no el anillo entero', () => {
    const r = validarParcela(autoint, { srs: SRS })
    const cruce = r.errores.find((h) => h.correccion === 'Deshacer el cruce del contorno.')
    expect(cruce).toBeDefined()
    // Subconjunto estricto: 4 de los 6 vértices (prueba que NO es el anillo entero).
    expect(cruce.verticesAfectados.length).toBeLessThan(6)
    expect(claveSet(cruce.verticesAfectados)).toEqual(new Set(['0:0', '0:1', '0:3', '0:4']))
  })
})

// ── Robustez ──────────────────────────────────────────────────────────────────
describe('F02 · robustez del contrato', () => {
  it('recintos no-array LANZA TypeError (contrato roto por el llamante)', () => {
    expect(() => validarParcela(null, { srs: SRS })).toThrow(TypeError)
    expect(() => validarParcela('x', { srs: SRS })).toThrow(TypeError)
  })

  it('sin srs, la regla de huso queda inerte (no inventa errores de rango)', () => {
    const ok = [crearRecinto([p(0, 0), p(10, 0), p(10, 10), p(0, 10)], 'EXTERIOR')]
    const r = validarParcela(ok) // sin opts → sin srs
    expect(r.errores).toEqual([])
    expect(r.puedeGenerar).toBe(true)
  })
})

// ── OV-2/OV-3 · superficie NETA de la parcela ─────────────────────────────────
describe('F02 · superficie NETA (outside voice OV-2/OV-3)', () => {
  it('OV-2 · hueco idéntico al exterior ⇒ superficie neta ≈0 ⇒ ERROR bloqueante', () => {
    const ext = crearRecinto([p(0, 0), p(20, 0), p(20, 20), p(0, 20)], 'EXTERIOR')
    const hoyoIgual = crearRecinto([p(0, 0), p(20, 0), p(20, 20), p(0, 20)], 'HUECO')
    const r = validarParcela([ext, hoyoIgual], { srs: SRS })
    expect(r.puedeGenerar).toBe(false)
    expect(r.errores.some((h) => h.correccion === 'Revisar la geometría (superficie nula)')).toBe(true)
  })

  it('OV-3 · un hueco legítimo pequeño (0,25 m²) NO produce aviso de superficie', () => {
    const ext = crearRecinto([p(0, 0), p(100, 0), p(100, 100), p(0, 100)], 'EXTERIOR')
    const hoyoPeq = crearRecinto([p(10, 10), p(10.5, 10), p(10.5, 10.5), p(10, 10.5)], 'HUECO')
    const r = validarParcela([ext, hoyoPeq], { srs: SRS })
    expect(r.avisos.some((h) => /muy pequeña/i.test(h.mensaje))).toBe(false)
    expect(r.puedeGenerar).toBe(true)
  })
})

// ── OV-1 · nunca crashea con un recinto malformado ────────────────────────────
describe('F02 · robustez ante recinto malformado (outside voice OV-1)', () => {
  const ext = crearRecinto([p(0, 0), p(20, 0), p(20, 20), p(0, 20)], 'EXTERIOR')

  it('un recinto sin `vertices` + srs ⇒ hallazgo, NO excepción (regla de huso guardada)', () => {
    let r
    expect(() => {
      r = validarParcela([ext, { tipo: 'HUECO' }], { srs: SRS })
    }).not.toThrow()
    expect(r.errores.some((h) => h.correccion === 'Definir al menos 3 vértices')).toBe(true)
  })

  it('recintos [null] ⇒ error estructural, NO excepción (comprobarExterior a prueba de null)', () => {
    let r
    expect(() => {
      r = validarParcela([null], { srs: SRS })
    }).not.toThrow()
    expect(r.puedeGenerar).toBe(false)
    expect(r.errores.some((h) => /contorno EXTERIOR/i.test(h.mensaje))).toBe(true)
  })
})

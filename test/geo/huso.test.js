/* -------------------------------------------------------------------------- *
 * test/geo/huso.test.js — Detección de huso y saneamiento defensivo (F00)     *
 *                                                                            *
 * Verifica el criterio de aceptación 3 de F00:                               *
 *   - meridianoCentral: 29→−9, 30→−3, 31→+3.                                  *
 *   - detectarHuso: coordenadas de prueba de cada huso + fixture real h30.    *
 *   - sanear: X/Y invertidas, geográficas pegadas, UTM normal (sin cambios).  *
 *   - Punto fuera de España → detectarHuso devuelve null.                     *
 *   - Canarias (28/32628) quedó como gancho comentado (no en candidatos).     *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect } from 'vitest'

import {
  meridianoCentral,
  srsPorHuso,
  detectarHuso,
  sanear,
  CANDIDATOS_DEFECTO,
} from '../../geo/huso.js'
import { forward } from '../../geo/utm.js'
import fixtureRing from '../fixtures/geo/parcela-ring.json' with { type: 'json' }

describe('geo/huso — meridianoCentral', () => {
  it('λ0 = (z−1)·6 − 180 + 3 → 29:−9°, 30:−3°, 31:+3°', () => {
    expect(meridianoCentral(29)).toBe(-9)
    expect(meridianoCentral(30)).toBe(-3)
    expect(meridianoCentral(31)).toBe(3)
  })
})

describe('geo/huso — srsPorHuso', () => {
  it('mapea 29/30/31 → EPSG 25829/25830/25831', () => {
    expect(srsPorHuso(29)).toBe('EPSG:25829')
    expect(srsPorHuso(30)).toBe('EPSG:25830')
    expect(srsPorHuso(31)).toBe('EPSG:25831')
  })
  it('huso no implementado (Canarias 28) lanza RangeError (regla de oro 1)', () => {
    expect(() => srsPorHuso(28)).toThrow(RangeError)
    expect(() => srsPorHuso(27)).toThrow(RangeError)
  })
  it("huso string ('30') lanza TypeError — sin coerción de clave (auditoría A8)", () => {
    expect(() => srsPorHuso('30')).toThrow(TypeError)
    expect(() => srsPorHuso(30.5)).toThrow(TypeError)
  })
})

describe('geo/huso — detectarHuso', () => {
  it('fixture real de huso 30 → prioritario zona 30, srs EPSG:25830', () => {
    const r = detectarHuso(fixtureRing.referencePoint) // [439250.35, 4479664.55]
    expect(r).not.toBeNull()
    expect(r.zona).toBe(30)
    expect(r.srs).toBe('EPSG:25830')
    // Cae donde debe: lon ≈ −3.7°, lat ≈ 40.5° (bbox España, ventana CM30 ±3°).
    expect(r.lon).toBeGreaterThan(-6)
    expect(r.lon).toBeLessThan(0)
    expect(r.lat).toBeCloseTo(40.46, 1)
    // La ambigüedad se DECLARA (hallazgo A1): este punto también es viable como
    // h31 (lon aparente ≈ +2.3 ∈ ventana CM31 y bbox); h29 queda fuera del bbox.
    expect(r.ambiguo).toBe(true)
    expect(r.candidatos.map((c) => c.zona)).toEqual([30, 31])
  })

  it('punto generado en huso 30 → zona 30', () => {
    const { x, y } = forward(40, -4, 30) // lon −4 ∈ ventana CM30 ±3° y bbox
    const r = detectarHuso([x, y])
    expect(r.zona).toBe(30)
    expect(r.srs).toBe('EPSG:25830')
    expect(r.lon).toBeCloseTo(-4, 6)
    expect(r.lat).toBeCloseTo(40, 6)
  })

  // Huso 29 y 31: como el easting NO identifica el huso, un punto de estos husos
  // desprojectado con los candidatos por defecto [30,29,31] cae en huso 30 (la
  // interpretación h30 también aterriza en España). Con el dato ya "trae huso" se
  // pasa como único candidato para VERIFICAR (dossier §3.2, "úsalo y solo verifica").
  it('punto de huso 29 verificado con candidatos=[29] → zona 29, sin ambigüedad', () => {
    const { x, y } = forward(42, -8, 29) // Galicia: lon −8 ∈ bbox y ventana CM29
    const r = detectarHuso([x, y], [29])
    expect(r.zona).toBe(29)
    expect(r.srs).toBe('EPSG:25829')
    expect(r.lon).toBeCloseTo(-8, 6)
    expect(r.lat).toBeCloseTo(42, 6)
    // Modo verificación (un solo candidato): nunca ambiguo.
    expect(r.ambiguo).toBe(false)
    expect(r.candidatos).toHaveLength(1)
  })

  it('punto de huso 31 verificado con candidatos=[31] → zona 31', () => {
    const { x, y } = forward(41, 2, 31) // Cataluña: lon +2 ∈ bbox y ventana CM31
    const r = detectarHuso([x, y], [31])
    expect(r.zona).toBe(31)
    expect(r.srs).toBe('EPSG:25831')
    expect(r.lon).toBeCloseTo(2, 6)
    expect(r.lat).toBeCloseTo(41, 6)
  })

  it('el easting no identifica el huso: un punto de h31 resuelve prioritario a h30 PERO se declara ambiguo con h31 entre los candidatos (A1)', () => {
    const { x, y } = forward(41, 2, 31)
    const r = detectarHuso([x, y]) // candidatos por defecto [30,29,31]
    expect(r.zona).toBe(30) // prioritario = primer candidato viable ("asumir 30")
    expect(r.ambiguo).toBe(true) // ...pero el llamante SABE que hay alternativa
    expect(r.candidatos.map((c) => c.zona)).toContain(31) // la interpretación correcta está en la lista
    // La interpretación h31 recupera la posición real:
    const h31 = r.candidatos.find((c) => c.zona === 31)
    expect(h31.lon).toBeCloseTo(2, 6)
    expect(h31.lat).toBeCloseTo(41, 6)
  })

  it('punto fuera de España (París, h31) → null', () => {
    const { x, y } = forward(48.85, 2.35, 31) // lat 48.85 > 44.5 → fuera del bbox
    expect(detectarHuso([x, y])).toBeNull()
    // La latitud es idéntica para todo candidato, así que ninguno cae en el bbox.
    expect(detectarHuso([x, y], [29, 30, 31])).toBeNull()
  })

  it('rechaza coordenada no finita (sin error silencioso)', () => {
    expect(() => detectarHuso([NaN, 4e6])).toThrow(TypeError)
    expect(() => detectarHuso([500000])).toThrow(TypeError)
  })
})

describe('geo/huso — sanear', () => {
  it('X/Y invertidas → swap con corrección anotada', () => {
    const { coord, correcciones } = sanear([4479664, 439250]) // [Norte, Este]
    expect(coord).toEqual([439250, 4479664]) // [Este, Norte]
    expect(correcciones).toHaveLength(1)
    expect(correcciones[0].tipo).toBe('SWAP_XY')
    expect(correcciones[0].antes).toEqual([4479664, 439250])
    expect(correcciones[0].despues).toEqual([439250, 4479664])
    expect(correcciones[0].rangoPlausible).toBe(true) // Este/Norte en rango tras swap
  })

  it('geográficas pegadas → marca "grados" sin reproyectar', () => {
    const { coord, correcciones } = sanear([-3.7, 40.4])
    expect(coord).toEqual([-3.7, 40.4]) // intacta: NO se reproyecta aquí (regla de oro 3)
    expect(correcciones).toHaveLength(1)
    expect(correcciones[0].tipo).toBe('GRADOS')
    expect(correcciones[0].reproyectar).toBe(true)
    expect(correcciones[0].mensaje.toLowerCase()).toContain('grados')
  })

  it('coordenada UTM normal → sin correcciones', () => {
    const entrada = fixtureRing.referencePoint // [439250.35, 4479664.55]
    const { coord, correcciones } = sanear(entrada)
    expect(coord).toEqual(entrada)
    expect(correcciones).toHaveLength(0)
  })

  it('rechaza coordenada no finita', () => {
    expect(() => sanear([Infinity, 1])).toThrow(TypeError)
    expect(() => sanear([1])).toThrow(TypeError)
  })

  // Fronteras EXACTAS de los umbrales (auditoría A8): los comparadores del
  // dossier son estrictos (`<1000`, `>1_000_000`) y el borde exacto NO dispara.
  it('frontera exacta |c|=1000: NO son "grados" (umbral estricto <1000)', () => {
    const { correcciones } = sanear([1000, 1000])
    expect(correcciones).toHaveLength(0)
  })

  it('justo bajo la frontera (999.99): sí son "grados"', () => {
    const { correcciones } = sanear([999.99, 999.99])
    expect(correcciones).toHaveLength(1)
    expect(correcciones[0].tipo).toBe('GRADOS')
  })

  it('frontera exacta c0=1_000_000: NO hay swap (umbral estricto >1e6)', () => {
    const { coord, correcciones } = sanear([1_000_000, 500000])
    expect(coord).toEqual([1_000_000, 500000])
    expect(correcciones).toHaveLength(0)
  })

  it('justo sobre la frontera (1_000_001): swap, con rango NO plausible anotado', () => {
    const { coord, correcciones } = sanear([1_000_001, 500000])
    expect(coord).toEqual([500000, 1_000_001])
    expect(correcciones).toHaveLength(1)
    expect(correcciones[0].tipo).toBe('SWAP_XY')
    // Tras el swap el Norte=1.000.001 queda fuera de [3.93M, 4.93M]: se avisa.
    expect(correcciones[0].rangoPlausible).toBe(false)
  })
})

describe('geo/huso — Canarias DIFERIDO (override O13)', () => {
  it('los candidatos por defecto son [30,29,31] — sin huso 28 ni 27', () => {
    expect([...CANDIDATOS_DEFECTO]).toEqual([30, 29, 31])
    expect(CANDIDATOS_DEFECTO).not.toContain(28)
    expect(CANDIDATOS_DEFECTO).not.toContain(27)
  })

  it('el fichero conserva el gancho comentado de Canarias (28/32628)', () => {
    const src = readFileSync(fileURLToPath(new URL('../../geo/huso.js', import.meta.url)), 'utf8')
    expect(src).toMatch(/\/\/\s*DIFERIDO:\s*Canarias\b/)
    expect(src).toMatch(/28/)
    expect(src).toMatch(/32628/)
  })
})

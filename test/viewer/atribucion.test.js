/* -------------------------------------------------------------------------- *
 * test/viewer/atribucion.test.js — Textos legales de atribución (F03, T2A.1) *
 *                                                                            *
 * Proyecto Vitest `node` (sin sufijo `.dom`): demuestra que el módulo no     *
 * importa Leaflet ni toca el DOM. Cubre:                                    *
 *   - Presencia LITERAL de los cuatro textos (escritos a mano en el test,   *
 *     no derivados del módulo: detecta si alguien reformula el texto legal).*
 *   - El texto de OSM lleva enlace a la licencia ODbL.                      *
 *   - atribucionCombinada: unión con ' · ', deduplicación, array vacío.     *
 *   - atribucionCombinada: LANZA ante clave desconocida (RangeError: valor  *
 *     fuera de un dominio enumerado) o entrada que no es array (TypeError:  *
 *     forma del argumento) — regla de oro 1.                               *
 *   - ATRIBUCION está congelado.                                           *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { ATRIBUCION, atribucionCombinada } from '../../viewer/atribucion.js'

// ── ATRIBUCION — textos literales ────────────────────────────────────────────

describe('viewer/atribucion — textos literales verificados', () => {
  it('PNOA: texto literal exacto', () => {
    expect(ATRIBUCION.PNOA).toBe(
      'PNOA cedido por © Instituto Geográfico Nacional de España',
    )
  })

  it('IGN: texto literal exacto', () => {
    expect(ATRIBUCION.IGN).toBe('© Instituto Geográfico Nacional de España')
  })

  it('CATASTRO: texto literal exacto', () => {
    expect(ATRIBUCION.CATASTRO).toBe('© Dirección General del Catastro')
  })

  it('OSM: menciona "OpenStreetMap contributors" y la licencia ODbL', () => {
    expect(ATRIBUCION.OSM).toContain('OpenStreetMap')
    expect(ATRIBUCION.OSM).toContain('contributors')
    expect(ATRIBUCION.OSM).toContain('ODbL')
  })

  it('OSM: lleva enlace a la página de copyright/licencia', () => {
    expect(ATRIBUCION.OSM).toMatch(/<a\s+href="https:\/\/www\.openstreetmap\.org\/copyright">/)
  })

  it('ATRIBUCION está congelado (Object.freeze)', () => {
    expect(Object.isFrozen(ATRIBUCION)).toBe(true)
    const original = ATRIBUCION.PNOA
    expect(() => {
      'use strict'
      ATRIBUCION.PNOA = 'otro texto'
    }).toThrow()
    expect(ATRIBUCION.PNOA).toBe(original)
  })
})

// ── atribucionCombinada ───────────────────────────────────────────────────────

describe('viewer/atribucion — atribucionCombinada', () => {
  it("une varias claves con ' · ', en orden de aparición", () => {
    expect(atribucionCombinada(['PNOA', 'IGN'])).toBe(
      'PNOA cedido por © Instituto Geográfico Nacional de España · © Instituto Geográfico Nacional de España',
    )
  })

  it('deduplica textos repetidos (dos capas del IGN activas no repiten el texto)', () => {
    expect(atribucionCombinada(['IGN', 'IGN'])).toBe('© Instituto Geográfico Nacional de España')
  })

  it('array vacío devuelve string vacío', () => {
    expect(atribucionCombinada([])).toBe('')
  })

  it('combina las cuatro capas en el orden dado, sin duplicados', () => {
    const resultado = atribucionCombinada(['CATASTRO', 'PNOA', 'OSM', 'CATASTRO'])
    expect(resultado).toBe(
      [ATRIBUCION.CATASTRO, ATRIBUCION.PNOA, ATRIBUCION.OSM].join(' · '),
    )
  })

  it('LANZA (RangeError) ante una clave desconocida: valor fuera del dominio enumerado', () => {
    // RangeError, no TypeError: es la política del resto del proyecto para un
    // valor que no está en un dominio enumerado (validation/_comun.js#crearHallazgo,
    // services/ign.js#crearCapaWMTS, wms-catastro.js#validarCRS/rol,
    // sincronizacion.js#zona). Hallazgo 2.10 de la auditoría de coherencia.
    expect(() => atribucionCombinada(['NOEXISTE'])).toThrow(RangeError)
    expect(() => atribucionCombinada(['NOEXISTE'])).toThrow(/NOEXISTE/)
  })

  it('LANZA (TypeError) si `claves` no es un array: eso es FORMA, no dominio', () => {
    expect(() => atribucionCombinada('PNOA')).toThrow(TypeError)
    expect(() => atribucionCombinada(undefined)).toThrow(TypeError)
    expect(() => atribucionCombinada(null)).toThrow(TypeError)
  })
})

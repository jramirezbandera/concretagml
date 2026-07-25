import { describe, it, expect } from 'vitest'
import * as barrel from '../index.js'
import ring from './fixtures/geo/parcela-ring.json' with { type: 'json' }

// Smoke test del andamiaje (F00, Fase 1): confirma que Vitest (proyecto `node`)
// arranca, que el fixture de la parcela real carga y que structuredClone existe.
describe('andamiaje F00', () => {
  it('Vitest corre y assert básico funciona', () => {
    expect(1 + 1).toBe(2)
  })

  it('carga el fixture del anillo de la parcela real', () => {
    expect(ring.refCatastral).toBe('9398516VK3799G')
    expect(ring.anilloExterior).toHaveLength(15)
    // El anillo está ABIERTO: el primer vértice no se repite al final.
    expect(ring.anilloExterior[0]).not.toEqual(ring.anilloExterior.at(-1))
  })

  it('structuredClone está disponible (necesario para edit/historial.js)', () => {
    const estado = { recintos: [{ vertices: [[1, 2]], tipo: 'EXTERIOR' }] }
    const copia = structuredClone(estado)
    expect(copia).toEqual(estado)
    expect(copia.recintos).not.toBe(estado.recintos)
  })

  it('el barrel expone el espacio de nombres de validación (F02)', () => {
    expect(typeof barrel.validacion.validarParcela).toBe('function')
  })
})

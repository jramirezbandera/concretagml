// test/viewer/celda.test.js — F03 · Tarea 2A.2 (parsearCoordenada, hallazgo C7/T8)
//
// Proyecto Vitest `node` (sin sufijo .dom.test.js): la función bajo test es
// pura y Leaflet-free, no necesita jsdom. Tabla de casos al estilo de
// test/parsers/comun.test.js.

import { describe, it, expect } from 'vitest'

import { parsearCoordenada } from '../../viewer/celda.js'

// ── Casos válidos ─────────────────────────────────────────────────────────────

const CASOS_VALIDOS = [
  { texto: '439250.35', esperado: 439250.35 },
  { texto: '439250,35', esperado: 439250.35 },
  { texto: '439250', esperado: 439250 },
  { texto: '-4.5', esperado: -4.5 },
  { texto: '  4479664.55  ', esperado: 4479664.55 },
]

// ── Casos inválidos ───────────────────────────────────────────────────────────
// `entrada` incluye a propósito valores que NO son string (null/undefined/
// número/objeto): el contrato exige que también esos se resuelvan a
// {ok:false} sin lanzar (ver invariantes al final).

const CASOS_INVALIDOS = [
  { etiqueta: 'cadena vacía', entrada: '' },
  { etiqueta: 'solo espacios', entrada: '   ' },
  { etiqueta: 'texto no numérico', entrada: 'abc' },
  { etiqueta: 'número con sobrante alfabético', entrada: '123abc' },
  { etiqueta: 'sobrante con espacio interno', entrada: '12 34' },
  { etiqueta: 'ambos separadores (punto de millar + coma decimal)', entrada: '1.234,56' },
  { etiqueta: 'ambos separadores (coma de millar + punto decimal)', entrada: '1,234.56' },
  { etiqueta: 'separador duplicado (coma)', entrada: '12,,3' },
  { etiqueta: 'separador duplicado (punto)', entrada: '1.2.3' },
  { etiqueta: 'signo duplicado', entrada: '--5' },
  { etiqueta: 'signo mal colocado al final', entrada: '5-' },
  { etiqueta: 'notación exponencial', entrada: '1e5' },
  { etiqueta: "'Infinity' como texto", entrada: 'Infinity' },
  { etiqueta: "'-Infinity' como texto", entrada: '-Infinity' },
  { etiqueta: "'NaN' como texto", entrada: 'NaN' },
  { etiqueta: 'null', entrada: null },
  { etiqueta: 'undefined', entrada: undefined },
  { etiqueta: 'número (no string)', entrada: 42 },
  { etiqueta: 'objeto (no string)', entrada: {} },
]

const TODAS_LAS_ENTRADAS = [
  ...CASOS_VALIDOS.map((c) => c.texto),
  ...CASOS_INVALIDOS.map((c) => c.entrada),
]

describe('viewer/celda — parsearCoordenada · casos válidos', () => {
  it.each(CASOS_VALIDOS)('acepta "$texto" → $esperado', ({ texto, esperado }) => {
    const resultado = parsearCoordenada(texto)
    expect(resultado.ok).toBe(true)
    expect(resultado.valor).toBeCloseTo(esperado, 6)
  })
})

describe('viewer/celda — parsearCoordenada · casos inválidos', () => {
  it.each(CASOS_INVALIDOS)('rechaza $etiqueta ($entrada) con motivo legible', ({ entrada }) => {
    const resultado = parsearCoordenada(entrada)
    expect(resultado.ok).toBe(false)
    expect(typeof resultado.motivo).toBe('string')
    expect(resultado.motivo.length).toBeGreaterThan(0)
  })

  it("dos separadores mezclados: el motivo menciona la ambigüedad", () => {
    const resultado = parsearCoordenada('1.234,56')
    expect(resultado.ok).toBe(false)
    expect(resultado.motivo).toMatch(/ambigu/i)
  })
})

// ── Invariantes del contrato (hallazgo C7/T8) ─────────────────────────────────

describe('viewer/celda — parsearCoordenada · invariantes', () => {
  it('jamás produce NaN en valor: ok:true ⇒ Number.isFinite(valor)', () => {
    for (const entrada of TODAS_LAS_ENTRADAS) {
      const resultado = parsearCoordenada(entrada)
      if (resultado.ok) {
        expect(Number.isFinite(resultado.valor)).toBe(true)
      }
    }
  })

  it('jamás lanza, sea cual sea la entrada', () => {
    for (const entrada of TODAS_LAS_ENTRADAS) {
      expect(() => parsearCoordenada(entrada)).not.toThrow()
    }
  })
})

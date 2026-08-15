/* -------------------------------------------------------------------------- *
 * test/validation/auditoria-2026-08.test.js — regresiones de la auditoría      *
 * de agosto de 2026 (hallazgos REPRODUCIDOS ejecutando el código real).        *
 *                                                                              *
 *   · V1 — Hueco que se sale del exterior por una CONCAVIDAD: booleanContains  *
 *     solo mira los VÉRTICES del interior, así que un hueco con todos los      *
 *     vértices dentro pero una arista que cruza la concavidad pasaba sin       *
 *     hallazgo. La regla mide ahora el ÁREA del hueco fuera del exterior.      *
 *   · V2 — Hueco que comparte una ARISTA entera con el contorno exterior: un   *
 *     anillo interior que toca el exterior a lo largo de una CURVA es inválido *
 *     (ISO 19107); tocarlo en UN punto sí es válido y NO debe señalarse.       *
 *   · V3 — Construcción dentro de un PATIO (hueco) de la parcela: `dentro`     *
 *     sumaba solo los recintos no-HUECO y nunca restaba el solape con los      *
 *     huecos → 0 avisos, el silencio que la cabecera de validation/edificio.js *
 *     declara inadmisible.                                                     *
 *   · V5 — El hallazgo de solape entre partes llevaba refs del anillo de la    *
 *     parte i anotadas también en porParte[j]: índices fuera de rango si j     *
 *     tiene menos vértices. Un hallazgo compartido no puede llevar refs        *
 *     válidas para dos anillos a la vez → no lleva ninguna, y el resalte lo    *
 *     hace `porParte` (la parte entera).                                       *
 *                                                                              *
 * (V4 —vértices no finitos en el modelo edificio— vive en                      *
 * test/model/edificio.test.js, junto al resto de validación de dominio.)       *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { validarParcela, NIVEL } from '../../validation/parcela.js'
import { validarEdificio } from '../../validation/edificio.js'
import { crearRecinto } from '../../model/parcela.js'
import { crearParteConstruccion } from '../../model/edificio.js'

// Base UTM dentro del huso 30 (la misma familia que usa la suite de F02): la
// regla de huso no contamina los casos que no van de eso, y las magnitudes
// (~1e5/1e6 m) son las reales, que es donde muerde el ruido de coma flotante.
const SRS = 'EPSG:25830'
const BX = 440000
const BY = 4480000
const p = (dx, dy) => [BX + dx, BY + dy]

/** Rectángulo con esquina inferior izquierda en (BX+x, BY+y). Anillo ABIERTO. */
const rect = (x, y, ancho, alto, tipo = 'EXTERIOR') => ({
  vertices: [p(x, y), p(x + ancho, y), p(x + ancho, y + alto), p(x, y + alto)],
  tipo,
})

/** Una parte PRINCIPAL con una planta: el caso que no da hallazgos propios. */
const parte = (nombre, recinto) =>
  crearParteConstruccion({
    nombre,
    recinto,
    origen: 'DIBUJADA',
    plantasSobreRasante: 1,
    plantasBajoRasante: 0,
  })

// ── V1 · Hueco que se sale por una concavidad ────────────────────────────────

describe('V1 · hueco que se sale del exterior por una concavidad', () => {
  // Exterior cóncavo en L: {x∈[0,10], y∈[0,4]} ∪ {x∈[0,6], y∈[4,10]}. El hueco
  // tiene los CUATRO vértices dentro de la L, pero su arista (2,9)→(9,2) cruza
  // la concavidad (p.ej. pasa por (6.5, 4.5), que queda fuera). Es el escenario
  // exacto reproducido por la auditoría: booleanContains daba 0 errores.
  const exteriorL = crearRecinto(
    [p(0, 0), p(10, 0), p(10, 4), p(6, 4), p(6, 10), p(0, 10)],
    'EXTERIOR',
  )
  const huecoCruzado = crearRecinto([p(1, 8), p(2, 9), p(9, 2), p(9, 1)], 'HUECO')

  it('BLOQUEA: el área del hueco fuera del exterior es un ERROR aunque los vértices caigan dentro', () => {
    const r = validarParcela([exteriorL, huecoCruzado], { srs: SRS })
    expect(r.puedeGenerar).toBe(false)
    const h = r.errores.find((e) => e.correccion === 'Mover el hueco dentro de la parcela.')
    expect(h).toBeDefined()
    expect(h.nivel).toBe(NIVEL.ERROR)
    // Señala el hueco (recinto 1), anillo entero.
    expect(h.verticesAfectados.length).toBeGreaterThan(0)
    expect(h.verticesAfectados.every((v) => v.recinto === 1)).toBe(true)
  })

  it('control: el mismo hueco bien metido en la parte ancha de la L no dispara nada', () => {
    const huecoDentro = crearRecinto([p(1, 5), p(2, 6), p(4, 7), p(3, 5)], 'HUECO')
    const r = validarParcela([exteriorL, huecoDentro], { srs: SRS })
    expect(r.errores).toEqual([])
    expect(r.puedeGenerar).toBe(true)
  })
})

// ── V2 · Hueco apoyado en el contorno exterior ───────────────────────────────

describe('V2 · hueco que comparte una arista con el contorno exterior', () => {
  const exterior = crearRecinto([p(0, 0), p(10, 0), p(10, 10), p(0, 10)], 'EXTERIOR')

  it('BLOQUEA: apoyarse en el lindero a lo largo de un TRAMO es inválido (ISO 19107)', () => {
    // Triángulo con el lado (0,4)→(0,6) sobre el borde oeste del exterior: el
    // escenario exacto de la auditoría (área fuera = 0, así que el arreglo por
    // área de V1 NO lo caza; hace falta detectar el solape de frontera).
    const huecoApoyado = crearRecinto([p(0, 4), p(0, 6), p(3, 5)], 'HUECO')
    const r = validarParcela([exterior, huecoApoyado], { srs: SRS })
    expect(r.puedeGenerar).toBe(false)
    const h = r.errores.find((e) => e.correccion === 'Separar el hueco del contorno exterior.')
    expect(h).toBeDefined()
    expect(h.nivel).toBe(NIVEL.ERROR)
    // Dice DÓNDE: los dos extremos del lado apoyado (índices 0 y 1 del hueco).
    expect(h.verticesAfectados).toEqual([
      { recinto: 1, indice: 0 },
      { recinto: 1, indice: 1 },
    ])
  })

  it('⛔ tocar el exterior en UN punto sí es válido: ni un falso positivo ahí', () => {
    // El vértice (0,5) está sobre el borde oeste, pero los lados que salen de él
    // se meten hacia dentro: contacto puntual, válido ISO 19107.
    const huecoPuntual = crearRecinto([p(0, 5), p(3, 6), p(3, 4)], 'HUECO')
    const r = validarParcela([exterior, huecoPuntual], { srs: SRS })
    expect(r.errores).toEqual([])
    expect(r.puedeGenerar).toBe(true)
  })

  it('control: un hueco interior que no toca el lindero sigue sin dar hallazgos', () => {
    const huecoInterior = crearRecinto([p(2, 2), p(8, 2), p(8, 8), p(2, 8)], 'HUECO')
    const r = validarParcela([exterior, huecoInterior], { srs: SRS })
    expect(r.errores).toEqual([])
    expect(r.puedeGenerar).toBe(true)
  })
})

// ── V3 · Construcción dentro de un patio (hueco) de la parcela ───────────────

describe('V3 · construcción dentro de un patio de la parcela', () => {
  // Parcela 20×20 con patio 10×10 en el centro: el escenario exacto reproducido
  // por la auditoría (antes: 0 errores, 0 avisos, noComprobado vacío).
  const PARCELA = [rect(0, 0, 20, 20), rect(5, 5, 10, 10, 'HUECO')]

  it('AVISA: una construcción metida en el patio está FUERA de la parcela', () => {
    const r = validarEdificio([parte('Caseta', rect(8, 8, 4, 4))], {
      srs: SRS,
      parcelaContexto: PARCELA,
    })
    const h = r.avisos.find((x) => /se sale de la parcela/.test(x.mensaje))
    expect(h).toBeDefined()
    // Los 16 m² completos quedan fuera: el patio no es superficie de la parcela.
    expect(h.mensaje).toContain('16,00 m² de sus 16,00 m²')
    expect(h.parte).toBe(0)
    // Es el MISMO aviso (no bloqueante) que una construcción fuera de la parcela.
    expect(r.puedeGenerar).toBe(true)
    expect(r.noComprobado).toEqual([])
  })

  it('y una construcción a caballo del patio ya no infravalora `fuera`', () => {
    // 4×4 en x∈[3,7], y∈[5,9]: la mitad este (2×4 = 8 m²) pisa el patio.
    const r = validarEdificio([parte('Almacén', rect(3, 5, 4, 4))], {
      srs: SRS,
      parcelaContexto: PARCELA,
    })
    const h = r.avisos.find((x) => /se sale de la parcela/.test(x.mensaje))
    expect(h).toBeDefined()
    expect(h.mensaje).toContain('8,00 m² de sus 16,00 m²')
  })

  it('control: una construcción sobre la corona maciza sigue limpia', () => {
    const r = validarEdificio([parte('Garaje', rect(1, 1, 3, 3))], {
      srs: SRS,
      parcelaContexto: PARCELA,
    })
    expect(r.errores).toEqual([])
    expect(r.avisos.filter((x) => /se sale de la parcela/.test(x.mensaje))).toEqual([])
    expect(r.noComprobado).toEqual([])
  })
})

// ── V5 · Refs del hallazgo de solape entre partes ────────────────────────────

describe('V5 · el hallazgo de solape no lleva refs inválidas para ninguna de sus partes', () => {
  it('cada parte en cuyo porParte aparece el solape recibe refs válidas para SÍ misma (o ninguna)', () => {
    // Pentágono (5 vértices) solapado con un cuadrado (4 vértices): antes el
    // hallazgo llevaba refsAnillo(0, 5) —el anillo de la parte i— y se anotaba
    // también en porParte[j], donde el índice 4 no existe.
    const pentagono = {
      vertices: [p(0, 0), p(10, 0), p(10, 10), p(5, 13), p(0, 10)],
      tipo: 'EXTERIOR',
    }
    const cuadrado = rect(5, 5, 10, 10)
    const partes = [parte('Pentágono', pentagono), parte('Cuadrado', cuadrado)]
    const r = validarEdificio(partes, { srs: SRS })

    const h = r.errores.find((x) => /se solapan/.test(x.mensaje))
    expect(h).toBeDefined()
    // Sigue siendo UN hallazgo visible desde LAS DOS partes (diseño de F13)...
    expect(r.porParte[0].errores).toContain(h)
    expect(r.porParte[1].errores).toContain(h)
    expect(r.errores.filter((x) => /se solapan/.test(x.mensaje))).toHaveLength(1)
    // ...y sus refs, leídas DENTRO de cada una de esas partes (recinto 0 = su
    // propio anillo), no pueden apuntar a vértices que esa parte no tiene.
    for (const indiceParte of [0, 1]) {
      const nVertices = partes[indiceParte].recinto.vertices.length
      for (const ref of h.verticesAfectados) {
        expect(ref.recinto).toBe(0)
        expect(ref.indice).toBeLessThan(nVertices)
      }
    }
  })
})

/* -------------------------------------------------------------------------- *
 * test/validation/reglas-error.test.js — F02 · T3.1 · REGLAS DE ERROR         *
 *                                                                              *
 * Cubre las 7 reglas de ERROR (bloqueantes) de la tabla de                     *
 * spec/feature-02-validacion-parcela.md + 1 control (parcela válida). Prueba   *
 * la API PÚBLICA `validarParcela(recintos, { srs })` de validation/parcela.js. *
 *                                                                              *
 * Para cada regla se comprueba (criterio de aceptación 1 y 2):                 *
 *   · puedeGenerar === false,                                                   *
 *   · existe un hallazgo con nivel==='ERROR', su `correccion` (el VERBO)        *
 *     y sus `verticesAfectados` correctos.                                      *
 *                                                                              *
 * Anti-falsos-disparos (ver GOTCHAS del encargo):                              *
 *   · Base UTM VÁLIDA del huso 30 `B=[440000,4480000]` para todo lo que NO sea  *
 *     el caso de huso → la regla A1 (huso) no dispara de más.                   *
 *   · Un mismo defecto puede activar 2 reglas (bowtie = cruce Y superficie      *
 *     nula ≈0; colineal = superficie nula Y posible kink). Por eso se usa       *
 *     `errores.some(...)` para localizar EL hallazgo esperado, sin fijar el     *
 *     TOTAL de errores. El recuento exacto se reserva para el caso limpio.      *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'
import { validarParcela, NIVEL } from '../../validation/parcela.js'
import { crearRecinto } from '../../model/parcela.js'

// ── Base y helpers ────────────────────────────────────────────────────────────

// Base UTM dentro del huso 30 (Península): easting ~440 k, norte ~4.48 M. Sirve
// para que la regla de huso NO dispare en los casos que no la ejercitan.
const B = [440000, 4480000]
const SRS30 = 'EPSG:25830'

/** Desplaza la base B: p(dx, dy) = [B[0]+dx, B[1]+dy]. */
const p = (dx, dy) => [B[0] + dx, B[1] + dy]

/** ¿Contiene `verticesAfectados` la ref {recinto, indice}? */
const tiene = (vAfectados, recinto, indice) =>
  vAfectados.some((v) => v.recinto === recinto && v.indice === indice)

// ── 1 · Vértices insuficientes (< 3 distintos) ────────────────────────────────

describe('ERROR · Vértices insuficientes (< 3 distintos)', () => {
  it('un anillo de 2 vértices bloquea y ofrece "Definir al menos 3 vértices"', () => {
    // Solo 2 vértices distintos, ambos dentro del huso 30 (sin falso disparo de huso).
    const exterior = crearRecinto([p(0, 0), p(10, 0)], 'EXTERIOR')
    const { errores, puedeGenerar } = validarParcela([exterior], { srs: SRS30 })

    expect(puedeGenerar).toBe(false)
    const hallazgo = errores.find((e) => e.correccion === 'Definir al menos 3 vértices')
    expect(hallazgo).toBeDefined()
    expect(hallazgo.nivel).toBe(NIVEL.ERROR)
    // verticesAfectados marca TODOS los vértices del anillo (índices 0 y 1).
    expect(tiene(hallazgo.verticesAfectados, 0, 0)).toBe(true)
    expect(tiene(hallazgo.verticesAfectados, 0, 1)).toBe(true)
  })

  it('3 vértices con dos coincidentes también quedan por debajo de 3 distintos', () => {
    // Dos vértices idénticos colapsan a uno → 2 distintos < 3.
    const exterior = crearRecinto([p(0, 0), p(10, 0), p(10, 0)], 'EXTERIOR')
    const { errores, puedeGenerar } = validarParcela([exterior], { srs: SRS30 })

    expect(puedeGenerar).toBe(false)
    expect(
      errores.some(
        (e) => e.nivel === NIVEL.ERROR && e.correccion === 'Definir al menos 3 vértices',
      ),
    ).toBe(true)
  })
})

// ── 2 · Vértices duplicados (consecutivos a < 1 mm) ───────────────────────────

describe('ERROR · Vértices duplicados (consecutivos a < 1 mm)', () => {
  it('un vértice repetido bloquea y ofrece "Eliminar vértice duplicado" en el par {i},{i+1}', () => {
    // Cuadrado 10×10 válido con el vértice índice 1 repetido en el índice 2.
    const exterior = crearRecinto(
      [p(0, 0), p(10, 0), p(10, 0), p(10, 10), p(0, 10)],
      'EXTERIOR',
    )
    const { errores, puedeGenerar } = validarParcela([exterior], { srs: SRS30 })

    expect(puedeGenerar).toBe(false)
    const hallazgo = errores.find((e) => e.correccion === 'Eliminar vértice duplicado')
    expect(hallazgo).toBeDefined()
    expect(hallazgo.nivel).toBe(NIVEL.ERROR)
    // El par consecutivo duplicado: índices 1 y 2 del recinto 0.
    expect(tiene(hallazgo.verticesAfectados, 0, 1)).toBe(true)
    expect(tiene(hallazgo.verticesAfectados, 0, 2)).toBe(true)
    expect(hallazgo.verticesAfectados).toHaveLength(2)
  })
})

// ── 3 · Superficie nula (área ≈ 0) ────────────────────────────────────────────

describe('ERROR · Superficie nula (área ≈ 0)', () => {
  it('3 vértices colineales bloquean y la corrección menciona "superficie nula"', () => {
    // Tres puntos alineados (área = 0), todos dentro del huso 30.
    const exterior = crearRecinto([p(0, 0), p(10, 10), p(20, 20)], 'EXTERIOR')
    const { errores, puedeGenerar } = validarParcela([exterior], { srs: SRS30 })

    expect(puedeGenerar).toBe(false)
    // .some(): un anillo colineal puede además provocar un kink → no fijamos el total.
    const hallazgo = errores.find(
      (e) => e.nivel === NIVEL.ERROR && e.correccion.includes('superficie nula'),
    )
    expect(hallazgo).toBeDefined()
    // Marca todos los vértices del anillo (índices 0, 1 y 2 del recinto 0).
    expect(tiene(hallazgo.verticesAfectados, 0, 0)).toBe(true)
    expect(tiene(hallazgo.verticesAfectados, 0, 1)).toBe(true)
    expect(tiene(hallazgo.verticesAfectados, 0, 2)).toBe(true)
  })
})

// ── 4 · Autointersección (bowtie) ─────────────────────────────────────────────

describe('ERROR · Autointersección (contorno que se cruza)', () => {
  it('un bowtie bloquea y ofrece "Deshacer el cruce del contorno"', () => {
    // Bowtie (figura de 8): P0→P1 cruza con P2→P3 en el centro.
    const exterior = crearRecinto(
      [p(0, 0), p(10, 10), p(10, 0), p(0, 10)],
      'EXTERIOR',
    )
    const { errores, puedeGenerar } = validarParcela([exterior], { srs: SRS30 })

    expect(puedeGenerar).toBe(false)
    // .some(): un bowtie simétrico tiene además superficie neta ≈0 → 2 reglas posibles.
    const hallazgo = errores.find(
      (e) => e.nivel === NIVEL.ERROR && e.correccion.includes('Deshacer el cruce del contorno'),
    )
    expect(hallazgo).toBeDefined()
    // La regla marca el anillo entero (los 4 vértices del recinto 0).
    expect(tiene(hallazgo.verticesAfectados, 0, 0)).toBe(true)
    expect(tiene(hallazgo.verticesAfectados, 0, 3)).toBe(true)
  })
})

// ── 5 · Hueco fuera del exterior ──────────────────────────────────────────────

describe('ERROR · Hueco fuera del contorno exterior', () => {
  it('un hueco desplazado fuera bloquea y ofrece "Mover el hueco dentro de la parcela"', () => {
    // Exterior 10×10 y un hueco 2×2 totalmente desplazado fuera (offset +20,+20).
    const exterior = crearRecinto([p(0, 0), p(10, 0), p(10, 10), p(0, 10)], 'EXTERIOR')
    const hueco = crearRecinto([p(20, 20), p(22, 20), p(22, 22), p(20, 22)], 'HUECO')
    const { errores, puedeGenerar } = validarParcela([exterior, hueco], { srs: SRS30 })

    expect(puedeGenerar).toBe(false)
    const hallazgo = errores.find(
      (e) => e.nivel === NIVEL.ERROR && e.correccion.includes('Mover el hueco dentro de la parcela'),
    )
    expect(hallazgo).toBeDefined()
    // verticesAfectados apunta al recinto 1 (el hueco).
    expect(hallazgo.verticesAfectados.every((v) => v.recinto === 1)).toBe(true)
    expect(tiene(hallazgo.verticesAfectados, 1, 0)).toBe(true)
  })
})

// ── 6 · Huecos solapados ──────────────────────────────────────────────────────

describe('ERROR · Huecos solapados', () => {
  it('dos huecos que se solapan bloquean y ofrecen "Separar los huecos que se solapan"', () => {
    // Exterior 50×50 con dos huecos 10×10 que comparten la región [15,20]×[15,20].
    const exterior = crearRecinto([p(0, 0), p(50, 0), p(50, 50), p(0, 50)], 'EXTERIOR')
    const hueco1 = crearRecinto([p(10, 10), p(20, 10), p(20, 20), p(10, 20)], 'HUECO')
    const hueco2 = crearRecinto([p(15, 15), p(25, 15), p(25, 25), p(15, 25)], 'HUECO')
    const { errores, puedeGenerar } = validarParcela([exterior, hueco1, hueco2], { srs: SRS30 })

    expect(puedeGenerar).toBe(false)
    const hallazgo = errores.find(
      (e) => e.nivel === NIVEL.ERROR && e.correccion.includes('Separar los huecos que se solapan'),
    )
    expect(hallazgo).toBeDefined()
    // Señala ambos huecos (recintos 1 y 2).
    expect(tiene(hallazgo.verticesAfectados, 1, 0)).toBe(true)
    expect(tiene(hallazgo.verticesAfectados, 2, 0)).toBe(true)
  })
})

// ── 7 · Coordenadas fuera del huso ────────────────────────────────────────────

describe('ERROR · Coordenadas fuera del huso', () => {
  it('un cuadrado en [0,0] con SRS 25830 bloquea y la corrección menciona "fuera del huso"', () => {
    // Coordenadas realmente fuera de España: la desproyección con huso 30 cae fuera.
    const exterior = crearRecinto([[0, 0], [10, 0], [10, 10], [0, 10]], 'EXTERIOR')
    const { errores, puedeGenerar } = validarParcela([exterior], { srs: SRS30 })

    expect(puedeGenerar).toBe(false)
    const hallazgo = errores.find(
      (e) => e.nivel === NIVEL.ERROR && e.correccion.includes('fuera del huso'),
    )
    expect(hallazgo).toBeDefined()
    // Todos los vértices del recinto 0 caen fuera → los 4 marcados.
    expect(hallazgo.verticesAfectados).toHaveLength(4)
    expect(tiene(hallazgo.verticesAfectados, 0, 0)).toBe(true)
    expect(tiene(hallazgo.verticesAfectados, 0, 3)).toBe(true)
  })
})

// ── 8 · Control · parcela válida en huso 30 ───────────────────────────────────

describe('CONTROL · parcela válida (huso 30)', () => {
  it('un cuadrado 10×10 válido no produce errores y permite generar', () => {
    const exterior = crearRecinto([p(0, 0), p(10, 0), p(10, 10), p(0, 10)], 'EXTERIOR')
    const { errores, avisos, puedeGenerar } = validarParcela([exterior], { srs: SRS30 })

    // Caso limpio: aquí SÍ afirmamos el recuento exacto (0 errores, 0 avisos).
    expect(errores).toEqual([])
    expect(avisos).toEqual([])
    expect(puedeGenerar).toBe(true)
  })
})

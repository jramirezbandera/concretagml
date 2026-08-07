/* -------------------------------------------------------------------------- *
 * test/validation/edificio.test.js — F13 · T1.5 · validación de las PARTES     *
 *                                                                              *
 * Cubre la API pública `validarEdificio(partes, {srs, parcelaContexto})` y las  *
 * cuatro cosas que la ficha F13 §16.1 pide, más las tres del contrato:          *
 *                                                                              *
 *   · Las reglas de F02 se aplican POR PARTE y su hallazgo sabe de cuál es.     *
 *   · Parte principal sin plantas BLOQUEA (criterio de aceptación 6).           *
 *   · Solape entre construcciones: ERROR, y visible desde LAS DOS partes.       *
 *   · Fuera de la parcela: AVISO (puede ser legítimo); a >100 m: ERROR (ICUC).  *
 *   · Sin parcela con la que comparar NO se da por bueno: se dice que no se ha  *
 *     mirado (`noComprobado`), que es el caso NORMAL medido en la fase 0.       *
 *   · Errores y avisos, categorías separadas; `puedeGenerar` solo mira errores. *
 *                                                                              *
 * Y una prueba de VERDAD EXTERNA con el fixture real de 13 partes del Catastro: *
 * un edificio que existe y está bien tiene que pasar. Sin ella, todo lo de      *
 * arriba podría estar midiendo un validador que dice que no a todo.             *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import {
  COMPROBACION,
  DISTANCIA_MAXIMA_PARCELA_M,
  MOTIVO_NO_COMPROBADO,
  validarEdificio,
} from '../../validation/edificio.js'
import { NIVEL } from '../../validation/_comun.js'
import { crearParteConstruccion, TIPO_PARTE } from '../../model/edificio.js'
import { entradaDesdeGmlBu } from '../../edificio/entrada.js'

// ── Contexto geométrico ──────────────────────────────────────────────────────
// Base UTM del huso 30 (EPSG:25830), la misma familia de coordenadas que usan
// las pruebas de F02: desproyecta dentro de España y así la regla de huso no
// contamina los casos que no van de eso.
const SRS = 'EPSG:25830'
const BX = 440000
const BY = 4480000

/** Rectángulo con esquina inferior izquierda en (BX+x, BY+y). Anillo ABIERTO. */
const rect = (x, y, ancho, alto) => ({
  vertices: [
    [BX + x, BY + y],
    [BX + x + ancho, BY + y],
    [BX + x + ancho, BY + y + alto],
    [BX + x, BY + y + alto],
  ],
  tipo: 'EXTERIOR',
})

/** Una parte PRINCIPAL con una planta, que es el caso que no da hallazgos. */
const parte = (nombre, recinto, extra = {}) =>
  crearParteConstruccion({
    nombre,
    recinto,
    origen: 'DIBUJADA',
    plantasSobreRasante: 1,
    plantasBajoRasante: 0,
    ...extra,
  })

const valida = (partes, opciones = {}) => validarEdificio(partes, { srs: SRS, ...opciones })

// ── El fixture real ──────────────────────────────────────────────────────────
const RUTA_PARTES = fileURLToPath(
  new URL('../fixtures/gml/bu_buildingpart_9398516VK3799G.gml', import.meta.url),
)
const EDIFICIO_REAL = entradaDesdeGmlBu(readFileSync(RUTA_PARTES, 'utf8')).edificio

// ── 1 · El contrato ──────────────────────────────────────────────────────────

describe('validarEdificio · el contrato', () => {
  it('LANZA si `partes` no es un array: eso es contrato roto por el llamante', () => {
    expect(() => validarEdificio(null, { srs: SRS })).toThrow(TypeError)
    expect(() => validarEdificio(undefined, { srs: SRS })).toThrow(/debe ser un array/)
    // Y el mensaje dice POR QUÉ esto sí lanza cuando un dato malo no lo hace.
    expect(() => validarEdificio('partes', { srs: SRS })).toThrow(/regla 1/)
  })

  it('devuelve las cinco claves del contrato, con errores y avisos SEPARADOS', () => {
    const r = valida([parte('Vivienda', rect(0, 0, 10, 10))])
    expect(Object.keys(r).sort()).toEqual(
      ['avisos', 'errores', 'noComprobado', 'porParte', 'puedeGenerar'].sort(),
    )
    expect(Array.isArray(r.errores)).toBe(true)
    expect(Array.isArray(r.avisos)).toBe(true)
    // Ni un total agregado: son dos listas y `puedeGenerar` solo mira una.
    expect(r.puedeGenerar).toBe(r.errores.length === 0)
  })

  it('cada hallazgo sabe de qué parte es, y `porParte` guarda LOS MISMOS objetos', () => {
    const r = valida([parte('Vivienda', rect(0, 0, 10, 10)), parte('Sin dibujar', null)])
    const suyo = r.errores.find((h) => h.parte === 1)
    expect(suyo).toBeDefined()
    // Identidad, no igualdad: si fueran copias, marcar un hallazgo en el mapa no
    // se reflejaría en la lista y habría dos verdades sobre el mismo defecto.
    expect(r.porParte[1].errores[0]).toBe(suyo)
    expect(r.porParte[0].errores).toHaveLength(0)
  })

  it('un hallazgo del DOCUMENTO lleva `parte: null` y no se cuela en ninguna parte', () => {
    const r = valida([parte('Vivienda', rect(0, 0, 10, 10))])
    const delDocumento = r.avisos.filter((h) => h.parte === null)
    expect(delDocumento.length).toBeGreaterThan(0)
    expect(r.porParte[0].avisos).not.toContain(delDocumento[0])
  })
})

// ── 2 · Las reglas de F02, por parte ─────────────────────────────────────────

describe('validarEdificio · reutiliza las reglas de F02 sobre cada parte', () => {
  it('un vértice duplicado en la parte 2 se le atribuye a la parte 2', () => {
    // ⚠️ Las dos partes van SEPARADAS a propósito: puestas encima la una de la
    // otra aparece —con razón— un error de solape, y ese error nombra a las dos
    // partes. Un filtro por el TEXTO del mensaje se cazaría a sí mismo en cuanto
    // el nombre de una parte contuviera la palabra que busca.
    const conDuplicado = {
      vertices: [
        [BX + 50, BY],
        [BX + 60, BY],
        [BX + 60, BY + 0.0001], // a 0,1 mm del anterior: duplicado (< 1 mm)
        [BX + 60, BY + 10],
        [BX + 50, BY + 10],
      ],
      tipo: 'EXTERIOR',
    }
    const r = valida([parte('Primera', rect(0, 0, 10, 10)), parte('Segunda', conDuplicado)])
    const dup = r.errores.filter((h) => /Vértices consecutivos duplicados/.test(h.mensaje))
    expect(dup.length).toBeGreaterThan(0)
    expect(dup.every((h) => h.parte === 1)).toBe(true)
    expect(r.porParte[0].errores).toHaveLength(0)
  })

  it('la regla de huso también corre por parte', () => {
    // El origen [0,0] no cae en el huso 30: es el caso que usa la suite de F02.
    const fuera = { vertices: [[0, 0], [10, 0], [10, 10], [0, 10]], tipo: 'EXTERIOR' }
    const r = valida([parte('Fuera de huso', fuera)])
    expect(r.errores.concat(r.avisos).some((h) => h.parte === 0)).toBe(true)
    expect(r.puedeGenerar).toBe(false)
  })
})

// ── 3 · Criterio de aceptación 6 · plantas ───────────────────────────────────

describe('validarEdificio · una parte principal sin plantas bloquea', () => {
  it('PRINCIPAL sin plantas sobre rasante es ERROR con su verbo de corrección', () => {
    const r = valida([parte('Vivienda', rect(0, 0, 10, 10), { plantasSobreRasante: null })])
    const h = r.errores.find((x) => /plantas sobre rasante/.test(x.mensaje))
    expect(h).toBeDefined()
    expect(h.nivel).toBe(NIVEL.ERROR)
    expect(h.correccion).toMatch(/^Declarar/)
    expect(r.puedeGenerar).toBe(false)
  })

  it('una piscina SIN plantas no es un error: el modelo se las prohíbe', () => {
    // `crearParteConstruccion` fuerza las plantas a null en las de tipo OTRA, así
    // que exigírselas sería exigir lo imposible.
    const piscina = parte('Piscina', rect(0, 0, 10, 5), {
      tipo: TIPO_PARTE.OTRA,
      plantasSobreRasante: null,
    })
    expect(piscina.plantasSobreRasante).toBeNull()
    const r = valida([piscina])
    expect(r.errores).toHaveLength(0)
    expect(r.puedeGenerar).toBe(true)
  })

  it('una parte pendiente de dibujar es ERROR: el ICUC rechaza las partes vacías', () => {
    const r = valida([crearParteConstruccion({ nombre: 'Nueva', origen: 'DIBUJADA' })])
    const h = r.errores.find((x) => /no tiene recinto/.test(x.mensaje))
    expect(h).toBeDefined()
    expect(h.correccion).toMatch(/Dibujar/)
    expect(r.puedeGenerar).toBe(false)
  })
})

// ── 4 · Solapes entre construcciones ─────────────────────────────────────────

describe('validarEdificio · solapes', () => {
  it('dos partes que se solapan dan UN error con los m² medidos', () => {
    const r = valida([
      parte('Vivienda', rect(0, 0, 10, 10)),
      parte('Porche', rect(5, 5, 10, 10)),
    ])
    const h = r.errores.find((x) => /se solapan/.test(x.mensaje))
    expect(h).toBeDefined()
    expect(h.mensaje).toContain('25,00 m²') // 5 × 5, exacto
    expect(h.mensaje).toContain('Vivienda')
    expect(h.mensaje).toContain('Porche')
    expect(r.errores.filter((x) => /se solapan/.test(x.mensaje))).toHaveLength(1)
  })

  it('ese único error se ve desde LAS DOS partes', () => {
    const r = valida([
      parte('Vivienda', rect(0, 0, 10, 10)),
      parte('Porche', rect(5, 5, 10, 10)),
    ])
    const h = r.errores.find((x) => /se solapan/.test(x.mensaje))
    expect(r.porParte[0].errores).toContain(h)
    expect(r.porParte[1].errores).toContain(h)
    // Pero se CUENTA una sola vez: dos entradas serían dos errores para un solape.
    expect(r.errores).toHaveLength(1)
  })

  it('compartir pared NO es solaparse', () => {
    // El caso normal de un edificio real: cuerpos pegados. Medido: `intersect`
    // devuelve null cuando el lindero coincide entero.
    const r = valida([parte('A', rect(0, 0, 10, 10)), parte('B', rect(10, 0, 10, 10))])
    expect(r.errores).toHaveLength(0)
    expect(r.puedeGenerar).toBe(true)
  })
})

// ── 5 · Contra la parcela ────────────────────────────────────────────────────

describe('validarEdificio · las partes contra la parcela', () => {
  const PARCELA = [rect(0, 0, 20, 20)]

  it('salirse de la parcela es AVISO, no error: puede ser legítimo', () => {
    const r = valida([parte('Vivienda', rect(15, 0, 10, 10))], { parcelaContexto: PARCELA })
    const h = r.avisos.find((x) => /se sale de la parcela/.test(x.mensaje))
    expect(h).toBeDefined()
    expect(h.nivel).toBe(NIVEL.AVISO)
    expect(h.mensaje).toContain('50,00 m²') // la mitad de los 100 m² de la parte
    expect(h.parte).toBe(0)
    expect(r.puedeGenerar).toBe(true)
  })

  it('el aviso señala LA PARTE QUE SE SALE, no otra (§16.1)', () => {
    const r = valida(
      [parte('Dentro', rect(1, 1, 5, 5)), parte('Fuera', rect(15, 0, 10, 10))],
      { parcelaContexto: PARCELA },
    )
    const h = r.avisos.find((x) => /se sale de la parcela/.test(x.mensaje))
    expect(h.parte).toBe(1)
    expect(r.porParte[1].avisos).toContain(h)
    expect(r.porParte[0].avisos).not.toContain(h)
    // Y marca vértices de esa parte, para que el mapa pueda rodearla.
    expect(h.verticesAfectados.length).toBe(4)
  })

  it('una parte dentro del todo no produce ningún aviso de encaje', () => {
    const r = valida([parte('Dentro', rect(5, 5, 5, 5))], { parcelaContexto: PARCELA })
    expect(r.avisos.filter((x) => /se sale de la parcela/.test(x.mensaje))).toHaveLength(0)
    expect(r.noComprobado).toHaveLength(0)
  })

  it(`a más de ${DISTANCIA_MAXIMA_PARCELA_M} m es ERROR: el ICUC lo rechaza`, () => {
    const r = valida([parte('Vivienda', rect(500, 0, 10, 10))], { parcelaContexto: PARCELA })
    const h = r.errores.find((x) => /ICUC rechaza las construcciones a más de/.test(x.mensaje))
    expect(h).toBeDefined()
    expect(h.mensaje).toContain('480,00 m') // 500 − 20, exacto
    expect(r.puedeGenerar).toBe(false)
  })

  it('a menos de 100 m pero fuera: AVISO, no error', () => {
    const r = valida([parte('Caseta', rect(50, 0, 10, 10))], { parcelaContexto: PARCELA })
    expect(r.errores).toHaveLength(0)
    expect(r.avisos.some((x) => /se sale de la parcela/.test(x.mensaje))).toBe(true)
  })
})

// ── 6 · ⛔ Lo que NO se ha podido comprobar ──────────────────────────────────

describe('validarEdificio · sin parcela no se da nada por bueno', () => {
  it('sin parcela, las dos comprobaciones salen en `noComprobado` con su motivo', () => {
    const r = valida([parte('Vivienda', rect(0, 0, 10, 10))])
    expect(r.noComprobado).toEqual([
      { comprobacion: COMPROBACION.FUERA_DE_PARCELA, motivo: MOTIVO_NO_COMPROBADO.SIN_PARCELA },
      { comprobacion: COMPROBACION.DISTANCIA_A_PARCELA, motivo: MOTIVO_NO_COMPROBADO.SIN_PARCELA },
    ])
  })

  it('y además se DICE, porque el técnico mira la pantalla y no un array', () => {
    const r = valida([parte('Vivienda', rect(0, 0, 10, 10))])
    const h = r.avisos.find((x) => x.parte === null && /No se ha comprobado/.test(x.mensaje))
    expect(h).toBeDefined()
    expect(h.mensaje).toContain(`${DISTANCIA_MAXIMA_PARCELA_M} m`)
    // ⛔ El aviso NO bloquea: no saber no es lo mismo que estar mal.
    expect(r.puedeGenerar).toBe(true)
  })

  it('una parcela vacía o con recintos no aptos cuenta como NO comprobado', () => {
    // Un array vacío y un recinto degenerado son dos formas de «no hay con qué».
    for (const contexto of [[], [{ vertices: [[BX, BY]], tipo: 'EXTERIOR' }]]) {
      const r = valida([parte('Vivienda', rect(0, 0, 10, 10))], { parcelaContexto: contexto })
      expect(r.noComprobado).toHaveLength(2)
    }
  })
})

// ── 7 · Sin partes ───────────────────────────────────────────────────────────

describe('validarEdificio · sin nada que declarar', () => {
  it('un edificio sin partes bloquea, y lo dice como lo dice el ICUC', () => {
    const r = valida([])
    expect(r.errores).toHaveLength(1)
    expect(r.errores[0].parte).toBeNull()
    expect(r.errores[0].mensaje).toMatch(/ninguna construcción que declarar/)
    expect(r.puedeGenerar).toBe(false)
    expect(r.porParte).toHaveLength(0)
  })
})

// ── 8 · ⭐ Verdad externa: el edificio real del Catastro ─────────────────────

describe('validarEdificio · el fixture real de 13 partes', () => {
  it('trae trece partes principales con sus plantas', () => {
    expect(EDIFICIO_REAL.partes).toHaveLength(13)
    expect(EDIFICIO_REAL.partes.every((p) => p.tipo === TIPO_PARTE.PRINCIPAL)).toBe(true)
    expect(EDIFICIO_REAL.partes.every((p) => p.plantasSobreRasante !== null)).toBe(true)
  })

  it('⭐ un edificio que EXISTE y está bien pasa: cero errores', () => {
    const r = validarEdificio(EDIFICIO_REAL.partes, { srs: 'EPSG:25830' })
    expect(r.errores).toEqual([])
    expect(r.puedeGenerar).toBe(true)
  })

  it('y sus trece cuerpos pegados no se leen como solapes', () => {
    const r = validarEdificio(EDIFICIO_REAL.partes, { srs: 'EPSG:25830' })
    expect(r.errores.filter((h) => /se solapan/.test(h.mensaje))).toHaveLength(0)
  })

  it('el único aviso del documento es el de la parcela ausente', () => {
    const r = validarEdificio(EDIFICIO_REAL.partes, { srs: 'EPSG:25830' })
    const delDocumento = r.avisos.filter((h) => h.parte === null)
    expect(delDocumento).toHaveLength(1)
    expect(delDocumento[0].mensaje).toMatch(/No se ha comprobado/)
  })
})

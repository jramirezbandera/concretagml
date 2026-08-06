/* -------------------------------------------------------------------------- *
 * test/edificio/envolvente.test.js — La envolvente derivada (F12 · T1.3)      *
 *                                                                            *
 * Lo que se prueba aquí, por orden de importancia:                           *
 *   1. Que la envolvente se DERIVA y no se guarda: es el criterio de          *
 *      aceptación 3 de la ficha, y aquí se sostiene comprobando que el        *
 *      resultado no vuelve al modelo y que cambiar una parte cambia la cifra. *
 *   2. El criterio «sobre rasante» al pie de la letra, con el caso REAL que   *
 *      lo hace sorprendente: en el fixture del Catastro la parte MAYOR es un  *
 *      sótano, y la envolvente la excluye. 245,90 m² de 568,03.               *
 *   3. Que `[]` no significa dos cosas: sin envolvente y sin poder calcularla *
 *      se distinguen mirando `saltados`.                                      *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

import { entradaDesdeGmlBu } from '../../edificio/entrada.js'
import { MOTIVO_FUERA, envolventeDe } from '../../edificio/envolvente.js'
import { superficie } from '../../geo/area.js'
import { ORIGEN_PARTE, TIPO_PARTE, crearParteConstruccion } from '../../model/edificio.js'

// ── Andamiaje ─────────────────────────────────────────────────────────────────

/** Cuadrado de lado `lado` con la esquina inferior izquierda en (x0, y0). */
const cuadrado = (x0, y0, lado) => ({
  tipo: 'EXTERIOR',
  vertices: [
    [x0, y0],
    [x0 + lado, y0],
    [x0 + lado, y0 + lado],
    [x0, y0 + lado],
  ],
})

const parte = ({ nombre = 'p', recinto = null, tipo = TIPO_PARTE.PRINCIPAL, sobre = 1 } = {}) =>
  crearParteConstruccion({
    nombre,
    tipo,
    recinto,
    plantasSobreRasante: sobre,
    plantasBajoRasante: null,
    origen: ORIGEN_PARTE.DXF,
  })

const areaDe = (envolvente) =>
  envolvente.recintos.reduce((s, pieza) => s + superficie(pieza), 0)

// ── El criterio «sobre rasante» ──────────────────────────────────────────────

describe('envolventeDe · qué parte entra y qué parte no', () => {
  it('une dos partes que se TOCAN en un solo contorno, sin la línea de dentro', () => {
    // Dos cuadrados de 10 pegados por un lado: 200 m² en UNA pieza, no dos de 100.
    // Es la razón entera por la que hace falta una unión topológica y no una lista.
    const e = envolventeDe([
      parte({ nombre: 'a', recinto: cuadrado(0, 0, 10) }),
      parte({ nombre: 'b', recinto: cuadrado(10, 0, 10) }),
    ])
    expect(e.recintos).toHaveLength(1)
    expect(e.nIncluidas).toBe(2)
    expect(areaDe(e)).toBeCloseTo(200, 6)
    expect(e.excluidas).toEqual([])
  })

  it('dos cuerpos SEPARADOS salen como dos piezas, y no es un error', () => {
    const e = envolventeDe([
      parte({ nombre: 'a', recinto: cuadrado(0, 0, 10) }),
      parte({ nombre: 'b', recinto: cuadrado(100, 100, 10) }),
    ])
    expect(e.recintos).toHaveLength(2)
    expect(e.nIncluidas).toBe(2)
    expect(areaDe(e)).toBeCloseTo(200, 6)
    expect(e.saltados).toEqual([])
  })

  it('⛔ una parte con 0 plantas sobre rasante NO entra: un sótano no tiene huella', () => {
    const e = envolventeDe([
      parte({ nombre: 'cuerpo', recinto: cuadrado(0, 0, 10), sobre: 2 }),
      parte({ nombre: 'sótano', recinto: cuadrado(0, 0, 30), sobre: 0 }),
    ])
    expect(e.nIncluidas).toBe(1)
    expect(areaDe(e)).toBeCloseTo(100, 6)
    expect(e.excluidas).toEqual([
      { indice: 1, nombre: 'sótano', motivo: MOTIVO_FUERA.SOLO_BAJO_RASANTE },
    ])
  })

  it('una parte de tipo OTRA (piscina) NO entra: no es volumen edificado', () => {
    const e = envolventeDe([
      parte({ nombre: 'casa', recinto: cuadrado(0, 0, 10) }),
      parte({ nombre: 'piscina', recinto: cuadrado(20, 0, 5), tipo: TIPO_PARTE.OTRA }),
    ])
    expect(e.nIncluidas).toBe(1)
    expect(e.excluidas).toEqual([
      { indice: 1, nombre: 'piscina', motivo: MOTIVO_FUERA.NO_ES_PRINCIPAL },
    ])
  })

  it('una parte SIN contorno no entra, y se dice cuál', () => {
    const e = envolventeDe([
      parte({ nombre: 'casa', recinto: cuadrado(0, 0, 10) }),
      parte({ nombre: 'porche por dibujar', recinto: null }),
    ])
    expect(e.nIncluidas).toBe(1)
    expect(e.excluidas).toEqual([
      { indice: 1, nombre: 'porche por dibujar', motivo: MOTIVO_FUERA.SIN_CONTORNO },
    ])
  })

  it('⭐ plantas SIN DECLARAR entra, y consta que ha entrado por defecto', () => {
    // Es la decisión menos mala de las dos, y está razonada en la cabecera: al
    // cargar un DXF NINGUNA parte trae plantas, así que tratar `null` como «bajo
    // rasante» dejaría la envolvente vacía en el caso más común de todos.
    const e = envolventeDe([parte({ nombre: 'sin declarar', recinto: cuadrado(0, 0, 10), sobre: null })])
    expect(e.nIncluidas).toBe(1)
    expect(e.excluidas).toEqual([])
    expect(e.incluidasPorDefecto).toEqual([
      { indice: 0, nombre: 'sin declarar', motivo: 'SIN_PLANTAS_DECLARADAS' },
    ])
  })
})

// ── `[]` no puede significar dos cosas ───────────────────────────────────────

describe('envolventeDe · el vacío se distingue del fallo', () => {
  it('sin partes: `recintos` vacío, `saltados` vacío — no hay nada que dibujar', () => {
    const e = envolventeDe([])
    expect(e.recintos).toEqual([])
    expect(e.saltados).toEqual([])
    expect(e.nIncluidas).toBe(0)
  })

  it('todas excluidas: `recintos` vacío pero `excluidas` lo EXPLICA', () => {
    const e = envolventeDe([parte({ nombre: 'sótano', recinto: cuadrado(0, 0, 10), sobre: 0 })])
    expect(e.recintos).toEqual([])
    expect(e.excluidas).toHaveLength(1)
    // Y esto es lo que impide leer el silencio como un cero.
    expect(e.saltados).toEqual([])
  })

  it('un contorno degenerado sale por `saltados` y NO lanza', () => {
    const e = envolventeDe([
      parte({ nombre: 'buena', recinto: cuadrado(0, 0, 10) }),
      parte({ nombre: 'dos puntos', recinto: { tipo: 'EXTERIOR', vertices: [[0, 0], [1, 1]] } }),
    ])
    expect(e.nIncluidas).toBe(1)
    expect(e.saltados.length).toBeGreaterThan(0)
    expect(e.excluidas).toEqual([
      { indice: 1, nombre: 'dos puntos', motivo: MOTIVO_FUERA.CONTORNO_NO_APTO },
    ])
  })

  it('LANZA si no se le pasa un array: eso es un bug del llamante', () => {
    expect(() => envolventeDe(null)).toThrow(TypeError)
    expect(() => envolventeDe({ partes: [] })).toThrow(TypeError)
  })
})

// ── No muta, y se deriva ─────────────────────────────────────────────────────

describe('envolventeDe · es DERIVADA, criterio de aceptación 3', () => {
  it('no toca las partes que recibe', () => {
    const partes = [
      parte({ nombre: 'a', recinto: cuadrado(0, 0, 10) }),
      parte({ nombre: 'b', recinto: cuadrado(10, 0, 10) }),
    ]
    const antes = structuredClone(partes)
    envolventeDe(partes)
    expect(partes).toEqual(antes)
  })

  it('cambiar las plantas de una parte cambia la envolvente, sin tocar geometría', () => {
    const partes = [
      parte({ nombre: 'cuerpo', recinto: cuadrado(0, 0, 10), sobre: 2 }),
      parte({ nombre: 'anejo', recinto: cuadrado(10, 0, 10), sobre: 1 }),
    ]
    expect(areaDe(envolventeDe(partes))).toBeCloseTo(200, 6)
    // El anejo pasa a ser sótano: MISMA geometría, otra envolvente.
    const conSotano = partes.map((p, i) => (i === 1 ? { ...p, plantasSobreRasante: 0 } : p))
    expect(areaDe(envolventeDe(conSotano))).toBeCloseTo(100, 6)
  })
})

// ── El fixture REAL, que es donde el criterio sorprende ──────────────────────

describe('⭐ envolventeDe sobre el edificio real del Catastro (13 partes)', () => {
  const xml = readFileSync(
    fileURLToPath(new URL('../fixtures/gml/bu_buildingpart_9398516VK3799G.gml', import.meta.url)),
    'utf8',
  )
  // Las plantas sobre rasante que el fichero trae, medidas en la fase 0 de F12
  // leyendo el fixture. ⛔ **Hasta la fase 5, `entrada.js` las TIRABA** y este
  // fichero tenía que reponerlas a mano para poder medir el caso real; desde que
  // el lector las carga, sirven de ORÁCULO: lo que se afirma es que el modelo
  // trae exactamente esto, no lo que este test escriba.
  const SOBRE_RASANTE = [1, 7, 7, 6, 7, 6, 7, 6, 6, 0, 6, 6, 6]

  const partesDelFixture = () => entradaDesdeGmlBu(xml).edificio.partes

  /** Las mismas partes con las plantas borradas: el mundo anterior a la fase 5. */
  const sinPlantas = () =>
    partesDelFixture().map((p) => ({ ...p, plantasSobreRasante: null, plantasBajoRasante: null }))

  it('⭐ el lector trae las plantas del fichero, y son las que midió la fase 0', () => {
    expect(partesDelFixture().map((p) => p.plantasSobreRasante)).toEqual(SOBRE_RASANTE)
  })

  it('las trece entran mientras nadie declare plantas, y suman 568,03 m²', () => {
    // El caso «todavía no se sabe»: sin plantas asignadas no se puede excluir a
    // nadie, y la envolvente es la de las trece. Sigue siendo alcanzable —un DXF
    // no declara plantas— y por eso se mide, ahora con las plantas borradas a
    // mano en vez de contando con que el lector las tire.
    const e = envolventeDe(sinPlantas())
    expect(e.nIncluidas).toBe(13)
    expect(e.incluidasPorDefecto).toHaveLength(13)
    expect(areaDe(e)).toBeCloseTo(568.03, 1)
  })

  it('⛔ con las plantas REALES la envolvente pierde la parte MAYOR, y es correcto', () => {
    // `Parte 10` mide 245,90 m² —la mayor con diferencia, la siguiente es 126,87—
    // y trae `numberOfFloorsAboveGround = 0`: es un sótano. La envolvente de este
    // edificio EXCLUYE su parte más grande, el 43 % de la suma de las trece.
    //
    // ⚠️ Ya NO hace falta reponer las plantas: entran solas desde la fase 5. Que
    // el resultado sea el mismo que cuando se reponían a mano es lo que atesta
    // que el lector trae **estos** números y no otros plausibles.
    const e = envolventeDe(partesDelFixture())
    expect(e.nIncluidas).toBe(12)
    expect(e.excluidas).toEqual([
      { indice: 9, nombre: 'Parte 10', motivo: MOTIVO_FUERA.SOLO_BAJO_RASANTE },
    ])
    expect(areaDe(e)).toBeCloseTo(322.13, 1)
  })

  it('⭐ y NO sale una sola línea: este edificio son DOS cuerpos separados', () => {
    // Lo que la ficha llama «una línea que rodea todas las partes» son aquí dos.
    // Quien lo pinte tiene que contar con más de una pieza, y quien lo mida no
    // puede leer `recintos[0]` y creer que ya está.
    //
    // Las DOS mediciones, porque son dos hechos distintos y los dos importan: sin
    // plantas el cuerpo grande mide **562,83 m²**; con las reales —o sea, en la
    // aplicación de verdad desde la fase 5— mide **316,93**, porque el sótano de
    // 245,90 m² sale de la unión. La pieza pequeña (5,20 m²) no cambia: está
    // separada del resto.
    const sin = envolventeDe(sinPlantas())
    expect(sin.recintos).toHaveLength(2)
    const areasSin = sin.recintos.map((pieza) => superficie(pieza)).sort((a, b) => a - b)
    expect(areasSin[0]).toBeCloseTo(5.2, 1)
    expect(areasSin[1]).toBeCloseTo(562.83, 1)

    const real = envolventeDe(partesDelFixture())
    expect(real.recintos).toHaveLength(2)
    const areasReal = real.recintos.map((pieza) => superficie(pieza)).sort((a, b) => a - b)
    expect(areasReal[0]).toBeCloseTo(5.2, 1)
    expect(areasReal[1]).toBeCloseTo(316.93, 1)
  })

  it('las trece partes del fixture no traen ni un hueco (criterio 4, medido)', () => {
    for (const p of partesDelFixture()) {
      expect(Array.isArray(p.recinto.vertices)).toBe(true)
    }
    const e = envolventeDe(partesDelFixture())
    expect(e.saltados).toEqual([])
  })
})

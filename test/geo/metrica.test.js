import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import {
  distancia,
  longitudesDeLados,
  perimetroAnillo,
  perimetro,
} from '../../geo/metrica.js'
import * as comunValidacion from '../../validation/_comun.js'

// F06 · geo/metrica.js — medida euclídea PROPIA sobre UTM (regla de oro 6:
// `turf.distance`/`turf.length` están prohibidas). Anillos ABIERTOS: el lado de
// cierre es v[n−1] → v[0], luego hay TANTOS lados COMO VÉRTICES.

describe('geo/metrica.js · distancia', () => {
  it('triángulo 3-4-5: la hipotenusa mide 5', () => {
    expect(distancia([0, 0], [3, 4])).toBeCloseTo(5, 12)
    expect(distancia([3, 4], [0, 0])).toBeCloseTo(5, 12) // simétrica
  })

  it('el mismo punto dista 0 de sí mismo', () => {
    expect(distancia([439283.23, 4479671.27], [439283.23, 4479671.27])).toBe(0)
  })

  it('mide bien sobre coordenadas UTM reales (Norte ≈ 4,48·10⁶)', () => {
    // Dos vértices consecutivos del anillo real; el mismo par desplazado al
    // origen debe dar EXACTAMENTE lo mismo: hypot opera sobre diferencias, así
    // que no sufre la cancelación catastrófica que sí obliga a `geo/area.js` a
    // trasladar a origen local antes del shoelace.
    const a = ring.anilloExterior[0]
    const b = ring.anilloExterior[1]
    const d = distancia(a, b)
    const dLocal = distancia([0, 0], [b[0] - a[0], b[1] - a[1]])
    expect(d).toBeCloseTo(dLocal, 12) // idéntico: hypot ya trabaja sobre diferencias
    // Frente al valor exacto de los incrementos (−14,47 / −13,26) queda un
    // residuo de ~2·10⁻¹⁰ m: no es del cálculo, es de RESTAR dos coordenadas de
    // magnitud 4,4·10⁶ en float64. Dos décimas de nanómetro sobre un lado de
    // 19,6 m; la propia captura catastral tiene un error 10⁹ veces mayor.
    expect(d).toBeCloseTo(Math.hypot(-14.47, -13.26), 8)
    expect(d).toBeCloseTo(19.6267292, 7)
  })

  it('no desborda con magnitudes extremas (por eso Math.hypot y no sqrt(x²+y²))', () => {
    // Con sqrt(dx*dx + dy*dy) el cuadrado intermedio desbordaría a Infinity.
    expect(distancia([0, 0], [3e200, 4e200])).toBeCloseTo(5e200, -190)
    expect(Number.isFinite(distancia([0, 0], [3e200, 4e200]))).toBe(true)
  })
})

describe('geo/metrica.js · longitudesDeLados (anillo ABIERTO)', () => {
  // Rectángulo 6×4 en orden antihorario. Se elige rectángulo y no cuadrado a
  // propósito: los lados alternan 6 y 4, así que el ORDEN del array es
  // verificable y no da lo mismo equivocarse.
  const rect = [
    [0, 0],
    [6, 0],
    [6, 4],
    [0, 4],
  ]

  it('devuelve n longitudes, una por vértice: el ÚLTIMO es el lado de cierre', () => {
    const lados = longitudesDeLados(rect)
    expect(lados).toHaveLength(rect.length) // n lados, no n−1
    // lado i = v[i] → v[(i+1) % n]; el lado 3 va de [0,4] a [0,0] y mide 4.
    expect(lados[0]).toBeCloseTo(6, 12)
    expect(lados[1]).toBeCloseTo(4, 12)
    expect(lados[2]).toBeCloseTo(6, 12)
    expect(lados[3]).toBeCloseTo(4, 12)
  })

  it('el lado de cierre NO se olvida (si faltara, el perímetro sería 16 y no 20)', () => {
    expect(perimetroAnillo(rect)).toBeCloseTo(20, 12)
    expect(perimetroAnillo(rect)).not.toBeCloseTo(16, 6)
  })

  it('no muta el anillo de entrada', () => {
    const copia = rect.map((v) => [...v])
    longitudesDeLados(rect)
    expect(rect).toEqual(copia)
  })

  it('cada longitud coincide con `distancia` aplicada al par correspondiente', () => {
    const anillo = ring.anilloExterior
    const lados = longitudesDeLados(anillo)
    expect(lados).toHaveLength(anillo.length)
    lados.forEach((l, i) => {
      expect(l).toBeCloseTo(distancia(anillo[i], anillo[(i + 1) % anillo.length]), 12)
    })
  })
})

describe('geo/metrica.js · degenerados: la DECISIÓN sobre n < 3', () => {
  // Documentada en el JSDoc del módulo: con menos de 3 vértices NO hay anillo,
  // así que `longitudesDeLados` devuelve [] y el perímetro es 0.
  it('anillo vacío o de un solo vértice ⇒ [] y perímetro 0', () => {
    expect(longitudesDeLados([])).toEqual([])
    expect(longitudesDeLados([[10, 10]])).toEqual([])
    expect(perimetroAnillo([])).toBe(0)
    expect(perimetroAnillo([[10, 10]])).toBe(0)
  })

  it('DOS vértices ⇒ [] y 0: un segmento no encierra nada, y no se cuenta ida y vuelta', () => {
    const segmento = [
      [0, 0],
      [3, 4],
    ]
    // La trampa que evita esta decisión: con `% n` sobre n = 2 el recorrido
    // pasaría dos veces por el mismo segmento (0→1 y 1→0) y devolvería [5, 5],
    // un «perímetro» de 10 para algo que mide 5. Un número plausible y falso.
    expect(longitudesDeLados(segmento)).toEqual([])
    expect(perimetroAnillo(segmento)).toBe(0)
    expect(perimetroAnillo(segmento)).not.toBe(10)
    // Mismo criterio que geo/area.js#areaFirmada, que devuelve 0 para n < 3.
  })

  it('un triángulo (n = 3) SÍ es un anillo: 3 lados y perímetro 12', () => {
    // Frontera exacta de la decisión anterior.
    expect(longitudesDeLados([
      [0, 0],
      [3, 0],
      [3, 4],
    ])).toHaveLength(3)
    expect(perimetroAnillo([
      [0, 0],
      [3, 0],
      [3, 4],
    ])).toBeCloseTo(3 + 4 + 5, 12)
  })
})

describe('geo/metrica.js · perimetro(recintos) — desglosado a propósito', () => {
  const exterior = {
    vertices: [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ],
    tipo: 'EXTERIOR',
  }
  const hueco = {
    vertices: [
      [2, 2],
      [4, 2],
      [4, 4],
      [2, 4],
    ],
    tipo: 'HUECO',
  }

  it('sin huecos: exterior = total, huecos = 0', () => {
    const p = perimetro([exterior])
    expect(p.exterior).toBeCloseTo(40, 12)
    expect(p.huecos).toBe(0)
    expect(p.total).toBeCloseTo(40, 12)
  })

  it('con huecos, `total` SUMA (no resta como la superficie neta): un hueco añade lindero', () => {
    const p = perimetro([exterior, hueco])
    expect(p.exterior).toBeCloseTo(40, 12)
    expect(p.huecos).toBeCloseTo(8, 12)
    expect(p.total).toBeCloseTo(48, 12)
    // Y no 32: eso sería copiar la fórmula de geo/area.js#superficie sin pensar.
    expect(p.total).not.toBeCloseTo(32, 6)
  })

  it('varios huecos se acumulan', () => {
    const otro = { vertices: [[6, 6], [7, 6], [7, 7], [6, 7]], tipo: 'HUECO' }
    const p = perimetro([exterior, hueco, otro])
    expect(p.huecos).toBeCloseTo(8 + 4, 12)
    expect(p.total).toBeCloseTo(40 + 12, 12)
  })

  it('devuelve las TRES cifras y no un número suelto (SPEC §3: la tolerancia de identidad es del EXTERIOR)', () => {
    const p = perimetro([exterior, hueco])
    expect(typeof p).toBe('object')
    expect(Object.keys(p).sort()).toEqual(['exterior', 'huecos', 'total'])
    // El llamante que compara con ±0,50 m urbana / ±2,00 m rústica usa
    // `exterior`; si esta función devolviera un solo número habría elegido en
    // silencio por él.
  })

  it('recintos vacío o nulo ⇒ los tres a 0', () => {
    expect(perimetro([])).toEqual({ exterior: 0, huecos: 0, total: 0 })
    expect(perimetro(null)).toEqual({ exterior: 0, huecos: 0, total: 0 })
    expect(perimetro(undefined)).toEqual({ exterior: 0, huecos: 0, total: 0 })
  })

  it('LANZA si recintos[0] no es el EXTERIOR (regla de oro 1: bug del programa, no dato del usuario)', () => {
    expect(() => perimetro([hueco])).toThrow(TypeError)
    expect(() => perimetro([hueco])).toThrow(/recintos\[0\] debe ser el EXTERIOR/)
  })

  it('LANZA si algún recinto posterior no es HUECO, nombrando el índice', () => {
    expect(() => perimetro([exterior, exterior])).toThrow(TypeError)
    expect(() => perimetro([exterior, hueco, exterior])).toThrow(/recintos\[2\] debe ser HUECO/)
  })

  it('el perímetro del anillo real del WFS es coherente con su superficie', () => {
    const p = perimetro([{ vertices: ring.anilloExterior, tipo: 'EXTERIOR' }])
    // ~1.536 m²; el perímetro de una parcela así está en el orden de 10² m.
    expect(p.exterior).toBeGreaterThan(100)
    expect(p.exterior).toBeLessThan(400)
    // Desigualdad isoperimétrica: P² ≥ 4π·A para cualquier polígono simple.
    expect(p.exterior ** 2).toBeGreaterThan(4 * Math.PI * ring._verificado.areaAbsolutaRedondeada)
    expect(p.total).toBe(p.exterior)
  })
})

describe('geo/metrica.js · una sola definición en todo el proyecto (F06, T1.2)', () => {
  const RUTA = fileURLToPath(new URL('../../geo/metrica.js', import.meta.url))
  const FUENTE = readFileSync(RUTA, 'utf8')

  it('`validation/_comun.js` RE-EXPORTA esta misma función, no otra igual', () => {
    // Identidad de referencia, no `toEqual`: dos copias del mismo `Math.hypot`
    // pasarían un test de valor y seguirían siendo dos definiciones.
    expect(comunValidacion.distancia).toBe(distancia)
  })

  it('geo/metrica.js no importa NADA: es hoja del grafo de dependencias', () => {
    // Si algún día importa algo, que sea a sabiendas: este módulo lo consumen
    // `validation/`, `edit/` (F06) y las acotaciones de F09, y una dependencia
    // aquí se propaga a todos. En particular cierra la regla de oro 6 por la
    // vía fuerte: sin imports no hay `@turf/*` que valga.
    const IMPORTA =
      /(?:^|\n)[ \t]*(?:import|export)[^\n]*['"]|(?:import|require)\([ \t]*['"]/
    expect(IMPORTA.test(FUENTE), 'geo/metrica.js debe seguir sin dependencias').toBe(false)
  })

  it('el detector de imports no es vacuo: dispara sobre un módulo que sí importa', () => {
    // Sin esto, un fallo del regex daría el test de arriba en verde para siempre.
    const conImports = readFileSync(
      fileURLToPath(new URL('../../validation/_comun.js', import.meta.url)),
      'utf8',
    )
    const IMPORTA =
      /(?:^|\n)[ \t]*(?:import|export)[^\n]*['"]|(?:import|require)\([ \t]*['"]/
    expect(IMPORTA.test(conImports)).toBe(true)
  })
})

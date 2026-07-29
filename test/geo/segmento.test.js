import { describe, it, expect } from 'vitest'
import ring from '../fixtures/geo/parcela-ring.json' with { type: 'json' }
import {
  proyectarEnSegmento,
  intersectarRectas,
  SENO_MINIMO_DEFECTO,
  LONGITUD_NULA_METROS,
} from '../../geo/segmento.js'

// F06 · geo/segmento.js — proyección punto→segmento (snap a lindero) e
// intersección de rectas (guarda de paralelismo del offset). Dossier §3.6.
// Módulo puro: geometría euclídea plana sobre UTM en metros, helpers propios
// (regla de oro 6: `nearestPointOnLine`/`distance`/`length` de Turf prohibidas).

// Producto escalar local para afirmar la perpendicularidad sin usar el módulo
// que se está probando.
const dot = (u, v) => u[0] * v[0] + u[1] * v[1]

describe('geo/segmento — proyectarEnSegmento: interior del segmento', () => {
  it('proyecta en el interior con t, pie y distancia comprobables a mano', () => {
    // Segmento horizontal 0→10 sobre el eje X; P = (3,4).
    // t = dot((3,4),(10,0))/100 = 30/100 = 0.3 → F = (3,0) → distancia 4.
    const r = proyectarEnSegmento([3, 4], [0, 0], [10, 0])
    expect(r.t).toBeCloseTo(0.3, 15)
    expect(r.punto[0]).toBeCloseTo(3, 12)
    expect(r.punto[1]).toBeCloseTo(0, 12)
    expect(r.distancia).toBeCloseTo(4, 12)
    expect(r.enExtremo).toBeNull()
  })

  it('segmento oblicuo: t = 0.12 y distancia = 8 (3-4-5 escalado, a mano)', () => {
    // AB = (30,40) ⇒ |AB|² = 2500. P−A = (10,0) ⇒ dot = 300 ⇒ t = 0.12.
    // F = (3.6, 4.8); P−F = (6.4,−4.8) ⇒ |P−F| = 8 exacto.
    const r = proyectarEnSegmento([10, 0], [0, 0], [30, 40])
    expect(r.t).toBeCloseTo(0.12, 15)
    expect(r.punto[0]).toBeCloseTo(3.6, 12)
    expect(r.punto[1]).toBeCloseTo(4.8, 12)
    expect(r.distancia).toBeCloseTo(8, 12)
    expect(r.enExtremo).toBeNull()
  })

  it('con 0<t<1 el pie es PERPENDICULAR al segmento: (P−F)·AB ≈ 0', () => {
    const casos = [
      { P: [3, 4], A: [0, 0], B: [10, 0] },
      { P: [10, 0], A: [0, 0], B: [30, 40] },
      { P: [-7.25, 13.5], A: [-20, -3], B: [12, 25] },
      { P: [439250.35, 4479664.55], A: ring.anilloExterior[0], B: ring.anilloExterior[6] },
    ]
    for (const { P, A, B } of casos) {
      const r = proyectarEnSegmento(P, A, B)
      expect(r.enExtremo).toBeNull() // el pie cae dentro: hay vértice que insertar
      const PF = [P[0] - r.punto[0], P[1] - r.punto[1]]
      const AB = [B[0] - A[0], B[1] - A[1]]
      // Se normaliza por |AB| para que la tolerancia sea una LONGITUD (m) y no
      // dependa de lo largo que sea el lindero.
      const largo = Math.hypot(AB[0], AB[1])
      expect(Math.abs(dot(PF, AB)) / largo).toBeLessThan(1e-8)
    }
  })

  it('el pie que cae justo sobre un extremo da t exacto (0 o 1) y lo señala', () => {
    // P perpendicular a A: t = 0 sin recortar. P perpendicular a B: t = 1.
    const enA = proyectarEnSegmento([0, 5], [0, 0], [10, 0])
    expect(enA.t).toBe(0)
    expect(enA.enExtremo).toBe('A')
    expect(enA.distancia).toBeCloseTo(5, 12)
    const enB = proyectarEnSegmento([10, -5], [0, 0], [10, 0])
    expect(enB.t).toBe(1)
    expect(enB.enExtremo).toBe('B')
    expect(enB.distancia).toBeCloseTo(5, 12)
  })
})

describe('geo/segmento — proyectarEnSegmento: recorte a [0,1] por los dos lados', () => {
  it('t < 0 se recorta al extremo A y enExtremo lo dice (no se inserta vértice)', () => {
    // P = (−5,3): el pie de la recta caería en x = −5, fuera del segmento.
    const r = proyectarEnSegmento([-5, 3], [0, 0], [10, 0])
    expect(r.t).toBe(0)
    expect(r.punto).toEqual([0, 0])
    expect(r.enExtremo).toBe('A')
    // La distancia es al EXTREMO, no a la recta infinita (que sería 3).
    expect(r.distancia).toBeCloseTo(Math.hypot(5, 3), 12)
  })

  it('t > 1 se recorta al extremo B y enExtremo lo dice (no se inserta vértice)', () => {
    const r = proyectarEnSegmento([15, 3], [0, 0], [10, 0])
    expect(r.t).toBe(1)
    expect(r.punto).toEqual([10, 0])
    expect(r.enExtremo).toBe('B')
    expect(r.distancia).toBeCloseTo(Math.hypot(5, 3), 12)
  })

  it('t nunca sale de [0,1] por muy lejos que caiga P', () => {
    for (const P of [[-1e6, 0], [1e6, 0], [-3, -900], [777, 900]]) {
      const r = proyectarEnSegmento(P, [0, 0], [10, 0])
      expect(r.t).toBeGreaterThanOrEqual(0)
      expect(r.t).toBeLessThanOrEqual(1)
      expect(r.enExtremo === 'A' || r.enExtremo === 'B').toBe(true)
    }
  })
})

describe('geo/segmento — proyectarEnSegmento: segmento degenerado (A === B)', () => {
  it('A y B coincidentes: t=0, punto=A, enExtremo A, distancia |P−A| y NO lanza', () => {
    // Un vértice duplicado es un dato POSIBLE del modelo (lo señala F02), no un
    // bug del programa: se describe en el resultado, no se lanza (regla de oro 1).
    const r = proyectarEnSegmento([5, 5], [7, 7], [7, 7])
    expect(r.t).toBe(0)
    expect(r.punto).toEqual([7, 7])
    expect(r.enExtremo).toBe('A')
    expect(r.distancia).toBeCloseTo(Math.hypot(2, 2), 12)
  })

  it('degenerado con P encima de A: distancia 0, sigue sin lanzar', () => {
    const r = proyectarEnSegmento([7, 7], [7, 7], [7, 7])
    expect(r.distancia).toBe(0)
    expect(r.enExtremo).toBe('A')
  })

  it('extremos separados por menos de LONGITUD_NULA_METROS: también degenerado', () => {
    const A = [0, 0]
    const B = [LONGITUD_NULA_METROS / 10, 0]
    const r = proyectarEnSegmento([5, 0], A, B)
    expect(r.t).toBe(0)
    expect(r.enExtremo).toBe('A')
    expect(r.distancia).toBeCloseTo(5, 12)
  })

  it('un segmento diminuto pero real (1 µm) NO es degenerado: se proyecta', () => {
    const r = proyectarEnSegmento([5, 3], [0, 0], [1e-6, 0])
    expect(r.t).toBe(1) // el pie cae mucho más allá de B → recorte
    expect(r.enExtremo).toBe('B')
    expect(r.distancia).toBeCloseTo(Math.hypot(5 - 1e-6, 3), 12)
  })
})

describe('geo/segmento — proyectarEnSegmento: precisión UTM (regla de oro 5)', () => {
  // Origen: un vértice REAL de la parcela 9398516VK3799G (fixture F00), en
  // EPSG:25830. X ≈ 4,39·10⁵, Y ≈ 4,48·10⁶ — el orden de magnitud que hace
  // obligatoria la traslación a origen local.
  const base = ring.anilloExterior[12] // [439222.47, 4479678.13]
  const A = base
  const B = [base[0] + 30, base[1] + 40]
  const P = [base[0] + 10, base[1]]

  it('el vértice de referencia es el del fixture real (X≈439k, Y≈4,48M)', () => {
    expect(base).toEqual([439222.47, 4479678.13])
    expect(Math.abs(base[1])).toBeGreaterThan(4e6)
  })

  it('el MISMO problema en UTM y en coordenadas locales pequeñas da el mismo t', () => {
    // Esta es la prueba de la traslación: si se opera sobre las coordenadas
    // absolutas, el resultado UTM se separa del local. Medido: coinciden bit a
    // bit (diferencia 0.0); se afirma con margen 1e-12 por prudencia.
    const utm = proyectarEnSegmento(P, A, B)
    const local = proyectarEnSegmento([10, 0], [0, 0], [30, 40])
    expect(Math.abs(utm.t - local.t)).toBeLessThan(1e-12)
    expect(utm.t).toBeCloseTo(0.12, 12)
  })

  it('la distancia en UTM es exacta a menos de 1e-9 m (medido: error 0)', () => {
    const utm = proyectarEnSegmento(P, A, B)
    expect(Math.abs(utm.distancia - 8)).toBeLessThan(1e-9)
  })

  it('el pie, medido DESDE A, es (3.6, 4.8) con error < 1e-9 m', () => {
    const utm = proyectarEnSegmento(P, A, B)
    expect(Math.abs(utm.punto[0] - A[0] - 3.6)).toBeLessThan(1e-9)
    expect(Math.abs(utm.punto[1] - A[1] - 4.8)).toBeLessThan(1e-9)
  })

  it('geometría REAL: proyectar en UTM o con el anillo trasladado a mano da el mismo t', () => {
    // El punto de referencia del GML real contra la diagonal V0→V6 del anillo.
    // Izquierda: coordenadas UTM tal cual. Derecha: el MISMO problema con V0
    // restado a mano (decenas de metros). Si el módulo no trasladara, los dos
    // lados divergirían. Medido: coinciden bit a bit en t y en distancia.
    const V0 = ring.anilloExterior[0]
    const V6 = ring.anilloExterior[6]
    const utm = proyectarEnSegmento(ring.referencePoint, V0, V6)
    const local = proyectarEnSegmento(
      [ring.referencePoint[0] - V0[0], ring.referencePoint[1] - V0[1]],
      [0, 0],
      [V6[0] - V0[0], V6[1] - V0[1]],
    )
    expect(Math.abs(utm.t - local.t)).toBeLessThan(1e-12)
    expect(Math.abs(utm.distancia - local.distancia)).toBeLessThan(1e-9)
    expect(Math.abs(utm.punto[0] - V0[0] - local.punto[0])).toBeLessThan(1e-9)
    expect(Math.abs(utm.punto[1] - V0[1] - local.punto[1])).toBeLessThan(1e-9)
  })

  it('sin trasladar (forma expandida) el error de t sería ~1e-7: por eso se traslada', () => {
    // Guardián con dientes: reproduce aquí las versiones SIN traslación —
    // dot(P−A,AB) desarrollado en productos de coordenadas ABSOLUTAS, que es
    // exactamente como se pierde la precisión— y comprueba que fallan la
    // afirmación que el módulo pasa. Productos ≈ 2·10¹³ ⇒ ulp ≈ 4·10⁻³ m.
    const V0 = ring.anilloExterior[0]
    const V6 = ring.anilloExterior[6]
    const R = ring.referencePoint
    const dotExpandido =
      R[0] * V6[0] + R[1] * V6[1] - (R[0] * V0[0] + R[1] * V0[1]) -
      (V0[0] * V6[0] + V0[1] * V6[1]) + (V0[0] * V0[0] + V0[1] * V0[1])
    const largo2Trasladado = (V6[0] - V0[0]) ** 2 + (V6[1] - V0[1]) ** 2
    const largo2Expandido =
      V6[0] * V6[0] + V6[1] * V6[1] - 2 * (V0[0] * V6[0] + V0[1] * V6[1]) +
      (V0[0] * V0[0] + V0[1] * V0[1])

    const bueno = proyectarEnSegmento(R, V0, V6).t
    // Solo el producto escalar expandido: ya se va ~1.8e-7.
    expect(Math.abs(dotExpandido / largo2Trasladado - bueno)).toBeGreaterThan(1e-9)
    // Expandido también el denominador: ~6.3e-7.
    expect(Math.abs(dotExpandido / largo2Expandido - bueno)).toBeGreaterThan(1e-9)
    // Y el módulo, que sí traslada, reproduce el cálculo local exactamente.
    const local = proyectarEnSegmento(
      [R[0] - V0[0], R[1] - V0[1]], [0, 0], [V6[0] - V0[0], V6[1] - V0[1]],
    )
    expect(bueno).toBe(local.t)
  })

  it('proyecta el punto de referencia del Catastro sobre un lindero real', () => {
    // referencePoint del GML real contra el lindero V1→V2 del anillo exterior:
    // el pie cae DENTRO (t ≈ 0.6056) ⇒ ahí sí habría vértice que insertar.
    const r = proyectarEnSegmento(ring.referencePoint, ring.anilloExterior[1], ring.anilloExterior[2])
    expect(r.t).toBeCloseTo(0.605512, 6)
    expect(r.enExtremo).toBeNull()
    // Distancia coherente con el tamaño de la parcela (1536 m²): metros, no km.
    expect(r.distancia).toBeCloseTo(17.264, 3)
  })

  it('sobre el lindero V0→V1 el pie se sale: el recorte lo lleva a V1', () => {
    // Contraste con el caso anterior sobre datos REALES: el mismo punto, otro
    // lindero, y el resultado ya no admite inserción de vértice.
    const r = proyectarEnSegmento(ring.referencePoint, ring.anilloExterior[0], ring.anilloExterior[1])
    expect(r.t).toBe(1)
    expect(r.enExtremo).toBe('B')
    expect(r.punto).toEqual(ring.anilloExterior[1])
  })
})

describe('geo/segmento — proyectarEnSegmento: contrato (regla de oro 1)', () => {
  it('no muta las entradas', () => {
    const P = [3, 4]
    const A = [0, 0]
    const B = [10, 0]
    const copia = structuredClone([P, A, B])
    proyectarEnSegmento(P, A, B)
    expect([P, A, B]).toEqual(copia)
  })

  it('el punto devuelto es una copia, no un alias de A ni de B', () => {
    const A = [0, 0]
    const B = [10, 0]
    const r = proyectarEnSegmento([-5, 0], A, B) // recorta a A
    expect(r.punto).toEqual([0, 0])
    expect(r.punto).not.toBe(A)
    r.punto[0] = 999
    expect(A).toEqual([0, 0])
  })

  it('lanza TypeError nombrando el argumento roto (P, A o B)', () => {
    expect(() => proyectarEnSegmento(null, [0, 0], [1, 1])).toThrow(/proyectarEnSegmento: P\b/)
    expect(() => proyectarEnSegmento([0, 0], 'A', [1, 1])).toThrow(/proyectarEnSegmento: A\b/)
    expect(() => proyectarEnSegmento([0, 0], [0, 0], undefined)).toThrow(/proyectarEnSegmento: B\b/)
    expect(() => proyectarEnSegmento([0, 0], [0, 0], [1, 1, 1])).toThrow(TypeError)
  })

  it('lanza si alguna coordenada no es finita (NaN, Infinity, string)', () => {
    expect(() => proyectarEnSegmento([NaN, 0], [0, 0], [1, 1])).toThrow(TypeError)
    expect(() => proyectarEnSegmento([0, Infinity], [0, 0], [1, 1])).toThrow(TypeError)
    expect(() => proyectarEnSegmento([0, 0], ['0', 0], [1, 1])).toThrow(TypeError)
  })
})

describe('geo/segmento — intersectarRectas: rectas que se cortan', () => {
  it('perpendiculares: corte conocido y |seno| = 1 (90°)', () => {
    // Eje X contra la vertical x = 3.
    const r = intersectarRectas([0, 0], [1, 0], [3, -5], [0, 2])
    expect(r.paralelas).toBe(false)
    expect(r.punto[0]).toBeCloseTo(3, 12)
    expect(r.punto[1]).toBeCloseTo(0, 12)
    expect(Math.abs(r.seno)).toBeCloseTo(1, 15)
  })

  it('oblicuas a 45°: corte en (4,4) y |seno| = √2/2', () => {
    // y = x  contra  y = 4.
    const r = intersectarRectas([0, 0], [1, 1], [0, 4], [1, 0])
    expect(r.paralelas).toBe(false)
    expect(r.punto[0]).toBeCloseTo(4, 12)
    expect(r.punto[1]).toBeCloseTo(4, 12)
    expect(Math.abs(r.seno)).toBeCloseTo(Math.SQRT1_2, 15)
  })

  it('intercambiar las rectas da el MISMO punto y el seno con el signo opuesto', () => {
    const a = intersectarRectas([0, 0], [1, 1], [0, 4], [1, 0])
    const b = intersectarRectas([0, 4], [1, 0], [0, 0], [1, 1])
    expect(b.punto[0]).toBeCloseTo(a.punto[0], 12)
    expect(b.punto[1]).toBeCloseTo(a.punto[1], 12)
    expect(b.seno).toBeCloseTo(-a.seno, 15)
  })

  it('el corte no tiene por qué caer dentro de los tramos: son RECTAS', () => {
    // Las prolongaciones se cortan en (10,0), lejos de los puntos de paso.
    const r = intersectarRectas([0, 0], [1, 0], [10, 100], [0, 1])
    expect(r.punto[0]).toBeCloseTo(10, 12)
    expect(r.punto[1]).toBeCloseTo(0, 12)
  })

  it('`seno` es ADIMENSIONAL: escalar los directores no lo cambia', () => {
    const base = intersectarRectas([0, 0], [1, 1], [0, 4], [1, 0])
    const escalado = intersectarRectas([0, 0], [1000, 1000], [0, 4], [7, 0])
    expect(escalado.seno).toBeCloseTo(base.seno, 15)
    expect(escalado.punto[0]).toBeCloseTo(base.punto[0], 12)
    expect(escalado.punto[1]).toBeCloseTo(base.punto[1], 12)
  })
})

describe('geo/segmento — intersectarRectas: paralelas y casi paralelas', () => {
  it('paralelas exactas (mismo sentido): punto null, paralelas true, seno 0', () => {
    const r = intersectarRectas([0, 0], [1, 0], [0, 5], [2, 0])
    expect(r.punto).toBeNull()
    expect(r.paralelas).toBe(true)
    expect(r.seno).toBe(0)
  })

  it('antiparalelas (sentido contrario) también son paralelas: seno 0', () => {
    const r = intersectarRectas([0, 0], [1, 0], [0, 5], [-3, 0])
    expect(r.punto).toBeNull()
    expect(r.paralelas).toBe(true)
    expect(r.seno).toBe(0)
  })

  it('rectas COINCIDENTES (infinitos cortes) se declaran paralelas, no un punto', () => {
    const r = intersectarRectas([0, 0], [1, 0], [50, 0], [1, 0])
    expect(r.punto).toBeNull()
    expect(r.paralelas).toBe(true)
  })

  it('casi paralelas POR ENCIMA de senoMinimo: sí corta, en el punto conocido', () => {
    // θ = 0.02 rad ⇒ sin θ = 0.0199987 > 0.01. Corte en x = −cot θ.
    const theta = 0.02
    const r = intersectarRectas([0, 0], [1, 0], [0, 1], [Math.cos(theta), Math.sin(theta)])
    expect(r.paralelas).toBe(false)
    expect(Math.abs(r.seno)).toBeCloseTo(Math.sin(theta), 15)
    expect(r.punto[0]).toBeCloseTo(-1 / Math.tan(theta), 9)
    expect(r.punto[1]).toBeCloseTo(0, 9)
    // Ilustra por qué existe el umbral: 1 m de separación → 50 m de corrimiento.
    expect(Math.abs(r.punto[0])).toBeGreaterThan(49)
  })

  it('casi paralelas POR DEBAJO de senoMinimo: no se devuelve punto, pero sí el seno', () => {
    // θ = 0.005 rad ⇒ sin θ = 0.00499998 < 0.01 ⇒ fallback del llamante.
    const theta = 0.005
    const r = intersectarRectas([0, 0], [1, 0], [0, 1], [Math.cos(theta), Math.sin(theta)])
    expect(r.punto).toBeNull()
    expect(r.paralelas).toBe(true)
    // El seno se devuelve SIEMPRE: el llamante puede informar de cuánto falta.
    expect(Math.abs(r.seno)).toBeCloseTo(Math.sin(theta), 15)
  })

  it('senoMinimo por opción cambia el veredicto del MISMO par de rectas', () => {
    const theta = 0.005
    const P = [0, 0]
    const dir = [Math.cos(theta), Math.sin(theta)]
    expect(intersectarRectas(P, [1, 0], [0, 1], dir).paralelas).toBe(true)
    const laxo = intersectarRectas(P, [1, 0], [0, 1], dir, { senoMinimo: 0.001 })
    expect(laxo.paralelas).toBe(false)
    expect(laxo.punto[0]).toBeCloseTo(-1 / Math.tan(theta), 8)
    // Y al revés: un umbral severo declara paralelas a dos rectas a 45°.
    const severo = intersectarRectas([0, 0], [1, 1], [0, 4], [1, 0], { senoMinimo: 0.9 })
    expect(severo.paralelas).toBe(true)
    expect(severo.punto).toBeNull()
  })

  it('SENO_MINIMO_DEFECTO vale 0.01 (≈0,573°) y es el que se aplica sin opción', () => {
    expect(SENO_MINIMO_DEFECTO).toBe(0.01)
    // Justo por debajo y justo por encima del umbral por defecto.
    const bajo = Math.asin(SENO_MINIMO_DEFECTO * 0.9)
    const alto = Math.asin(SENO_MINIMO_DEFECTO * 1.1)
    expect(intersectarRectas([0, 0], [1, 0], [0, 1], [Math.cos(bajo), Math.sin(bajo)]).paralelas).toBe(true)
    expect(intersectarRectas([0, 0], [1, 0], [0, 1], [Math.cos(alto), Math.sin(alto)]).paralelas).toBe(false)
  })

  it('senoMinimo: 0 admite cortes rasantes pero NO divide por cero en paralelas exactas', () => {
    const rasante = intersectarRectas([0, 0], [1, 0], [0, 1], [1, 1e-9], { senoMinimo: 0 })
    expect(rasante.paralelas).toBe(false)
    expect(Number.isFinite(rasante.punto[0])).toBe(true)
    const exactas = intersectarRectas([0, 0], [1, 0], [0, 1], [1, 0], { senoMinimo: 0 })
    expect(exactas.paralelas).toBe(true)
    expect(exactas.punto).toBeNull()
  })
})

describe('geo/segmento — intersectarRectas: vector director nulo', () => {
  it('r nulo: paralelas true, punto null, seno 0 — y NO lanza', () => {
    const r = intersectarRectas([0, 0], [0, 0], [0, 5], [1, 0])
    expect(r).toEqual({ punto: null, paralelas: true, seno: 0 })
  })

  it('s nulo: mismo resultado (dos vértices coincidentes en el anillo)', () => {
    const r = intersectarRectas([0, 0], [1, 0], [0, 5], [0, 0])
    expect(r).toEqual({ punto: null, paralelas: true, seno: 0 })
  })

  it('director por debajo de LONGITUD_NULA_METROS también cuenta como nulo', () => {
    const r = intersectarRectas([0, 0], [LONGITUD_NULA_METROS / 10, 0], [0, 5], [0, 1])
    expect(r.paralelas).toBe(true)
    expect(r.seno).toBe(0)
  })
})

describe('geo/segmento — intersectarRectas: precisión UTM (regla de oro 5)', () => {
  const base = ring.anilloExterior[12] // [439222.47, 4479678.13]

  it('corte de horizontal y vertical en UTM: exacto a menos de 1e-9 m', () => {
    const Q = [base[0] + 10, base[1] - 7]
    const r = intersectarRectas(base, [1, 0], Q, [0, 1])
    expect(Math.abs(r.punto[0] - Q[0])).toBeLessThan(1e-9)
    // La componente Y no se toca en absoluto: sigue siendo la de P, bit a bit.
    expect(r.punto[1]).toBe(base[1])
  })

  it('corte oblicuo en UTM: el desplazamiento respecto de P es (5,5) < 1e-9', () => {
    // y = x  contra  y = −x, cruzándose 5 m más allá de la base.
    const r = intersectarRectas(base, [1, 1], [base[0] + 10, base[1]], [1, -1])
    expect(Math.abs(r.punto[0] - base[0] - 5)).toBeLessThan(1e-9)
    expect(Math.abs(r.punto[1] - base[1] - 5)).toBeLessThan(1e-9)
    expect(Math.abs(r.seno)).toBeCloseTo(1, 12)
  })

  it('el mismo corte resuelto en coordenadas locales pequeñas da lo mismo', () => {
    const utm = intersectarRectas(base, [1, 1], [base[0] + 10, base[1]], [1, -1])
    const local = intersectarRectas([0, 0], [1, 1], [10, 0], [1, -1])
    expect(Math.abs(utm.punto[0] - base[0] - local.punto[0])).toBeLessThan(1e-9)
    expect(Math.abs(utm.punto[1] - base[1] - local.punto[1])).toBeLessThan(1e-9)
    expect(utm.seno).toBe(local.seno)
  })

  it('corta dos linderos REALES prolongados de la parcela del fixture', () => {
    const V0 = ring.anilloExterior[0]
    const V1 = ring.anilloExterior[1]
    const V6 = ring.anilloExterior[6]
    const V7 = ring.anilloExterior[7]
    const r = intersectarRectas(V0, [V1[0] - V0[0], V1[1] - V0[1]], V6, [V7[0] - V6[0], V7[1] - V6[1]])
    expect(r.paralelas).toBe(false)
    // El corte cae en el entorno de la parcela (≈38 m de V0), no en el infinito.
    expect(Math.abs(r.punto[0] - V0[0])).toBeLessThan(100)
    expect(Math.abs(r.punto[1] - V0[1])).toBeLessThan(100)
    // Y está sobre las dos RECTAS (no sobre los tramos: cae en la prolongación,
    // que es justo lo que hace el offset). Distancia punto-recta = |cross|/|dir|.
    const distARecta = (P, A, B) => {
      const dx = B[0] - A[0]
      const dy = B[1] - A[1]
      return Math.abs((P[0] - A[0]) * dy - (P[1] - A[1]) * dx) / Math.hypot(dx, dy)
    }
    expect(distARecta(r.punto, V0, V1)).toBeLessThan(1e-9)
    expect(distARecta(r.punto, V6, V7)).toBeLessThan(1e-9)
    // Comprobación de que ESTÁ en la prolongación: proyectado sobre el tramo
    // V0→V1 se recorta a un extremo y queda a decenas de metros.
    expect(proyectarEnSegmento(r.punto, V0, V1).enExtremo).toBe('B')
  })
})

describe('geo/segmento — intersectarRectas: contrato (regla de oro 1)', () => {
  it('no muta las entradas', () => {
    const P = [0, 0]
    const r = [1, 1]
    const Q = [0, 4]
    const s = [1, 0]
    const copia = structuredClone([P, r, Q, s])
    intersectarRectas(P, r, Q, s)
    expect([P, r, Q, s]).toEqual(copia)
  })

  it('lanza TypeError nombrando el argumento roto (P, r, Q o s)', () => {
    expect(() => intersectarRectas(null, [1, 0], [0, 1], [0, 1])).toThrow(/intersectarRectas: P\b/)
    expect(() => intersectarRectas([0, 0], 'r', [0, 1], [0, 1])).toThrow(/intersectarRectas: r\b/)
    expect(() => intersectarRectas([0, 0], [1, 0], {}, [0, 1])).toThrow(/intersectarRectas: Q\b/)
    expect(() => intersectarRectas([0, 0], [1, 0], [0, 1], [NaN, 1])).toThrow(/intersectarRectas: s\b/)
  })

  it('lanza si senoMinimo no es un número en [0,1)', () => {
    const args = [[0, 0], [1, 0], [0, 1], [0, 1]]
    expect(() => intersectarRectas(...args, { senoMinimo: -0.1 })).toThrow(/senoMinimo/)
    expect(() => intersectarRectas(...args, { senoMinimo: 1 })).toThrow(/senoMinimo/)
    expect(() => intersectarRectas(...args, { senoMinimo: NaN })).toThrow(/senoMinimo/)
    expect(() => intersectarRectas(...args, { senoMinimo: '0.01' })).toThrow(TypeError)
  })

  it('el módulo es puro: sin opciones se comporta igual en llamadas repetidas', () => {
    const a = intersectarRectas([0, 0], [1, 1], [0, 4], [1, 0])
    const b = intersectarRectas([0, 0], [1, 1], [0, 4], [1, 0])
    expect(a).toEqual(b)
    expect(a.punto).not.toBe(b.punto)
  })
})

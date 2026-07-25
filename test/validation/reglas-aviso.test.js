import { describe, it, expect } from 'vitest'
import { validarParcela, NIVEL } from '../../validation/parcela.js'

// F02 · T3.2 — Reglas de AVISO (NO bloqueantes) de la validación de parcela.
//
// Las 4 avisos viven en validation/reglas-geometria.js y sus umbrales en
// config/operativos.json (segmentoCortoMetros:0.05, colinealidadGrados:179.9,
// superficieMinimaM2:1, areaNulaM2:1e-6, maxVertices:500). Un AVISO no bloquea:
// en cada caso de aviso PURO comprobamos errores.length===0 y puedeGenerar===true
// (regla 1: nada de errores acompañando al aviso).
//
// Cómo se evitan los DISPAROS CRUZADOS (gotcha):
//   · Coordenadas UTM del huso 30 sobre la base B=[440000,4480000] con
//     srs:'EPSG:25830' → la regla de HUSO (reglas-huso.js) no dispara.
//   · Polígonos simples y convexos → la regla de AUTOINTERSECCIÓN (reglas-topologia)
//     no dispara; sin huecos → tampoco las reglas de huecos.
//   · Cada geometría aísla su umbral: segmentos > 5 cm salvo el caso "segmento
//     corto"; ángulos < 179,9° salvo el caso "colineal"; área > 1 m² salvo el caso
//     "muy pequeña"; ≤ 500 vértices salvo el caso "muchos vértices". Así cada caso
//     produce EXACTAMENTE un aviso (avisos.length === 1).

const SRS = 'EPSG:25830'
const B = [440000, 4480000] // huso 30, dentro de España → la regla de huso NO dispara.

/** Punto UTM desplazado desde la base B (mantiene todo dentro del huso 30). */
const p = (dx, dy) => [B[0] + dx, B[1] + dy]

/** Un único recinto EXTERIOR con `vertices` (anillo ABIERTO, UTM). */
const soloExterior = (vertices) => [{ vertices, tipo: 'EXTERIOR' }]

/** Primer hallazgo cuyo `mensaje` contiene `parte`. */
const con = (hallazgos, parte) => hallazgos.find((h) => h.mensaje.includes(parte))

describe('F02 · reglas de AVISO — casi colineales (ángulo > 179,9°)', () => {
  // Triángulo A-B-C con un vértice M insertado en la arista A→B, apenas 2 cm por
  // encima de la recta: el ángulo interior en M ≈ 179,98° (> 179,9°). Los demás
  // vértices tienen ángulos ~56–67° (lejos del umbral). Aristas ~100/180 m (no
  // cortas); área ~15000 m² (no pequeña).
  const ring = [
    p(0, 0), //     0 = A
    p(100, 0.02), // 1 = M  ← casi en la recta de A y B
    p(200, 0), //   2 = B
    p(100, 150), // 3 = C
  ]

  it('marca SOLO el vértice central (índice 1) como casi colineal', () => {
    const { errores, avisos, puedeGenerar } = validarParcela(soloExterior(ring), { srs: SRS })

    expect(errores).toHaveLength(0)
    expect(puedeGenerar).toBe(true)
    expect(avisos).toHaveLength(1) // sin disparos cruzados: solo la colinealidad

    const aviso = con(avisos, 'casi colineal')
    expect(aviso).toBeDefined()
    expect(aviso.nivel).toBe(NIVEL.AVISO)
    expect(aviso.verticesAfectados).toEqual([{ recinto: 0, indice: 1 }])
    expect(aviso.correccion).toBeUndefined() // los avisos no llevan corrección
  })
})

describe('F02 · reglas de AVISO — segmento muy corto (< 5 cm, ≥ 1 mm)', () => {
  // Cuadrilátero cuya PRIMERA arista (0→1) mide 2 cm; las otras ~20–22 m. 2 cm
  // está entre duplicadoMetros (1 mm) y segmentoCortoMetros (5 cm) → AVISO, no
  // ERROR de duplicado. Ángulos ~63–116° (no colineal); área ~200 m² (no pequeña).
  const ring = [
    p(0, 0), //    0
    p(0.02, 0), // 1  ← arista 0→1 = 2 cm
    p(10, 20), //  2
    p(-10, 20), // 3
  ]

  it('marca los DOS extremos de la arista corta (índices 0 y 1)', () => {
    const { errores, avisos, puedeGenerar } = validarParcela(soloExterior(ring), { srs: SRS })

    expect(errores).toHaveLength(0)
    expect(puedeGenerar).toBe(true)
    expect(avisos).toHaveLength(1)

    const aviso = con(avisos, 'Segmento muy corto')
    expect(aviso).toBeDefined()
    expect(aviso.nivel).toBe(NIVEL.AVISO)
    expect(aviso.verticesAfectados).toEqual([
      { recinto: 0, indice: 0 },
      { recinto: 0, indice: 1 },
    ])
    expect(aviso.correccion).toBeUndefined()
  })
})

describe('F02 · reglas de AVISO — superficie muy pequeña (< 1 m², > ≈0)', () => {
  // Cuadrado 0,3 × 0,3 m = 0,09 m². Está en (areaNulaM2, superficieMinimaM2) =
  // (1e-6, 1) → AVISO "muy pequeña", NO ERROR "nula". Aristas de 0,3 m = 30 cm
  // (> 5 cm → no "segmento corto"); ángulos rectos (no colineal).
  const ring = [p(0, 0), p(0.3, 0), p(0.3, 0.3), p(0, 0.3)]

  it('marca todos los vértices del anillo con área minúscula', () => {
    const { errores, avisos, puedeGenerar } = validarParcela(soloExterior(ring), { srs: SRS })

    expect(errores).toHaveLength(0)
    expect(puedeGenerar).toBe(true)
    expect(avisos).toHaveLength(1)

    const aviso = con(avisos, 'muy pequeña')
    expect(aviso).toBeDefined()
    expect(aviso.nivel).toBe(NIVEL.AVISO)
    expect(aviso.verticesAfectados).toEqual([
      { recinto: 0, indice: 0 },
      { recinto: 0, indice: 1 },
      { recinto: 0, indice: 2 },
      { recinto: 0, indice: 3 },
    ])
    expect(aviso.correccion).toBeUndefined()
  })
})

describe('F02 · reglas de AVISO — muchos vértices (> 500)', () => {
  // Círculo de radio 50 m muestreado con 501 puntos. Segmentos ≈ 0,63 m (> 5 cm →
  // no "segmento corto"). Ángulo interior de un 501-gono regular ≈ 179,28°
  // (< 179,9° → no "casi colineal"). Área ≈ 7854 m² (no pequeña). Único aviso: el
  // recuento de vértices.
  const R = 50
  const N = 501
  const ring = []
  for (let k = 0; k < N; k++) {
    const t = (2 * Math.PI * k) / N
    ring.push(p(R * Math.cos(t), R * Math.sin(t)))
  }

  it('avisa del exceso de vértices con verticesAfectados vacío', () => {
    const { errores, avisos, puedeGenerar } = validarParcela(soloExterior(ring), { srs: SRS })

    expect(ring).toHaveLength(501)
    expect(errores).toHaveLength(0)
    expect(puedeGenerar).toBe(true)
    expect(avisos).toHaveLength(1)

    const aviso = con(avisos, 'Demasiados vértices')
    expect(aviso).toBeDefined()
    expect(aviso.nivel).toBe(NIVEL.AVISO)
    expect(aviso.mensaje).toContain('501 > 500')
    expect(aviso.verticesAfectados).toEqual([]) // el aviso es del anillo entero
    expect(aviso.correccion).toBeUndefined()
  })
})

describe('F02 · exclusión mutua — área nula NO produce el aviso "muy pequeña"', () => {
  // Tres puntos COLINEALES (sobre y=x): área = 0 ⇒ ERROR "Superficie nula".
  // Los rangos son disjuntos (≤ areaNulaM2 vs areaNulaM2 < área < superficieMinimaM2),
  // así que NUNCA debe aparecer el aviso "muy pequeña" para el mismo recinto.
  const ring = [p(0, 0), p(10, 10), p(20, 20)]

  it('emite el ERROR "Superficie nula" y jamás el AVISO "muy pequeña"', () => {
    const { errores, avisos, puedeGenerar } = validarParcela(soloExterior(ring), { srs: SRS })

    // Hay un ERROR bloqueante: no es un aviso puro.
    expect(puedeGenerar).toBe(false)

    // La superficie NETA de la parcela (aquí = el exterior colineal) es ≈0.
    const errorNula = errores.find((h) => h.correccion === 'Revisar la geometría (superficie nula)')
    expect(errorNula).toBeDefined()
    expect(errorNula.nivel).toBe(NIVEL.ERROR)

    // La clave de la exclusión mutua: ningún aviso de "muy pequeña".
    expect(avisos.some((a) => a.mensaje.includes('muy pequeña'))).toBe(false)
    expect(con(avisos, 'muy pequeña')).toBeUndefined()
  })
})

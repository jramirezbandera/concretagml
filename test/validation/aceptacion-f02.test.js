/* -------------------------------------------------------------------------- *
 * test/validation/aceptacion-f02.test.js — F02 · T3.3 · SUITE DE ACEPTACIÓN    *
 *                                                                              *
 * Prueba de CAJA NEGRA que mapea 1:1 a los 3 Criterios de aceptación de        *
 * spec/feature-02-validacion-parcela.md (§ "Criterios de aceptación"):         *
 *   1. Cada regla dispara sobre su caso con los `verticesAfectados` correctos. *
 *   2. Un error bloquea la generación (puedeGenerar=false); solo-avisos no.    *
 *   3. El recuento separa errores y avisos (nunca un total agregado).          *
 *                                                                              *
 * Solo ejercita la API PÚBLICA `validarParcela(recintos, { srs })`; construye  *
 * los polígonos INLINE con `crearRecinto` (anillos ABIERTOS, UTM, recintos[0]  *
 * = EXTERIOR). Coordenadas UTM válidas del huso 30 (base B, srs EPSG:25830)    *
 * salvo el caso "fuera del huso", que usa el origen [0,0].                     *
 *                                                                              *
 * Un `describe` por criterio. Los asserts usan `.some(...)` para no depender   *
 * de disparos colaterales (un mismo defecto puede activar >1 regla) — salvo    *
 * el criterio 3, donde el polígono está controlado para 1 error + ≥1 aviso.    *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import { validarParcela, NIVEL } from '../../validation/parcela.js'
import { crearRecinto } from '../../model/parcela.js'

// ── Contexto geométrico ───────────────────────────────────────────────────────
// Base UTM en el huso 30 (EPSG:25830): desproyecta dentro de España, de modo que
// la regla de huso NO contamina el resto de casos con "coordenadas fuera de rango".
const SRS = 'EPSG:25830'
const BX = 440000
const BY = 4480000

// ── Helpers de test ───────────────────────────────────────────────────────────
const R = (vertices, tipo = 'EXTERIOR') => crearRecinto(vertices, tipo)
const ref = (recinto, indice) => ({ recinto, indice })
/** Refs {recinto,indice} de los n primeros vértices de un recinto. */
const refsRango = (recinto, n) => Array.from({ length: n }, (_, i) => ref(recinto, i))

const valida = (recintos, srs = SRS) => validarParcela(recintos, { srs })

/**
 * ¿Dos listas de `verticesAfectados` designan el MISMO conjunto de vértices?
 * Compara como conjuntos (independiente del orden): robusto ante el orden en que
 * cada regla acumula sus refs. Sirve también para el caso vacío (ambas []).
 */
function mismosVertices(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
  const clave = (arr) => arr.map((r) => `${r.recinto}:${r.indice}`).sort()
  const ka = clave(a)
  const kb = clave(b)
  return ka.every((k, i) => k === kb[i])
}

/** Polígono convexo regular de `n` vértices (para el aviso "muchos vértices"). */
function circulo(n, cx = BX, cy = BY, r = 50) {
  const pts = []
  for (let i = 0; i < n; i++) {
    const t = (2 * Math.PI * i) / n
    pts.push([cx + r * Math.cos(t), cy + r * Math.sin(t)])
  }
  return pts
}

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 1 — "Cada regla dispara sobre su caso y devuelve los verticesAfectados
//               correctos (tests con polígonos construidos)."
// ════════════════════════════════════════════════════════════════════════════
//
// Tabla compacta: UNA entrada por regla (7 errores + 4 avisos = las 11 reglas de
// la spec). Cada entrada trae el polígono INLINE, la categoría donde debe caer el
// hallazgo, un predicado que lo IDENTIFICA (por `correccion` en errores, por
// `mensaje` en avisos) y los `verticesAfectados` esperados.
describe('F02 · AC1 · cada regla dispara con verticesAfectados correctos', () => {
  const casos = [
    // ── ERRORES (bloquean) ────────────────────────────────────────────────────
    {
      regla: 'Vértices insuficientes (< 3 distintos)',
      categoria: 'errores',
      recintos: [R([[BX, BY], [BX + 10, BY]])],
      identifica: (h) => h.correccion === 'Definir al menos 3 vértices',
      vertices: refsRango(0, 2),
    },
    {
      regla: 'Vértices duplicados (< 1 mm)',
      categoria: 'errores',
      recintos: [R([[BX, BY], [BX + 0.0005, BY], [BX + 10, BY], [BX + 10, BY + 10], [BX, BY + 10]])],
      identifica: (h) => h.correccion === 'Eliminar vértice duplicado',
      vertices: [ref(0, 0), ref(0, 1)],
    },
    {
      regla: 'Autointersección',
      categoria: 'errores',
      recintos: [R([[BX, BY], [BX + 10, BY], [BX, BY + 8], [BX + 6, BY + 12]])],
      identifica: (h) => h.correccion === 'Deshacer el cruce del contorno.',
      vertices: refsRango(0, 4),
    },
    {
      regla: 'Hueco fuera del exterior',
      categoria: 'errores',
      recintos: [
        R([[BX, BY], [BX + 100, BY], [BX + 100, BY + 100], [BX, BY + 100]]),
        R([[BX + 200, BY + 200], [BX + 210, BY + 200], [BX + 210, BY + 210], [BX + 200, BY + 210]], 'HUECO'),
      ],
      identifica: (h) => h.correccion === 'Mover el hueco dentro de la parcela.',
      vertices: refsRango(1, 4),
    },
    {
      regla: 'Huecos solapados',
      categoria: 'errores',
      recintos: [
        R([[BX, BY], [BX + 100, BY], [BX + 100, BY + 100], [BX, BY + 100]]),
        R([[BX + 10, BY + 10], [BX + 30, BY + 10], [BX + 30, BY + 30], [BX + 10, BY + 30]], 'HUECO'),
        R([[BX + 20, BY + 20], [BX + 40, BY + 20], [BX + 40, BY + 40], [BX + 20, BY + 40]], 'HUECO'),
      ],
      identifica: (h) => h.correccion === 'Separar los huecos que se solapan.',
      vertices: [...refsRango(1, 4), ...refsRango(2, 4)],
    },
    {
      regla: 'Superficie nula (área ≈ 0)',
      categoria: 'errores',
      recintos: [R([[BX, BY], [BX + 10, BY], [BX + 20, BY]])], // 3 vértices colineales distintos
      identifica: (h) => h.correccion === 'Revisar la geometría (superficie nula)',
      vertices: refsRango(0, 3),
    },
    {
      regla: 'Coordenadas fuera del huso',
      categoria: 'errores',
      recintos: [R([[0, 0], [10, 0], [10, 10], [0, 10]])], // origen: cae fuera de España en huso 30
      identifica: (h) => h.correccion === 'Revisar las coordenadas fuera del huso 30',
      vertices: refsRango(0, 4),
    },
    // ── AVISOS (no bloquean) ──────────────────────────────────────────────────
    {
      regla: 'Casi colineales (ángulo > 179,9°)',
      categoria: 'avisos',
      recintos: [R([[BX, BY], [BX + 5, BY + 0.001], [BX + 10, BY], [BX + 10, BY + 10], [BX, BY + 10]])],
      identifica: (h) => h.mensaje.includes('casi colineal'),
      vertices: [ref(0, 1)], // el vértice central casi alineado con sus vecinos
    },
    {
      regla: 'Segmento muy corto (< 5 cm)',
      categoria: 'avisos',
      recintos: [R([[BX, BY], [BX + 0.02, BY], [BX + 10, BY], [BX + 10, BY + 10], [BX, BY + 10]])],
      identifica: (h) => h.mensaje.includes('Segmento muy corto'),
      vertices: [ref(0, 0), ref(0, 1)], // los dos extremos del segmento de 2 cm
    },
    {
      regla: 'Superficie muy pequeña (< 1 m²)',
      categoria: 'avisos',
      recintos: [R([[BX, BY], [BX + 0.3, BY], [BX + 0.3, BY + 0.3], [BX, BY + 0.3]])], // 0,09 m²
      identifica: (h) => h.mensaje.includes('muy pequeña'),
      vertices: refsRango(0, 4),
    },
    {
      regla: 'Muchos vértices (> 500)',
      categoria: 'avisos',
      recintos: [R(circulo(520))],
      identifica: (h) => h.mensaje.includes('Demasiados vértices'),
      vertices: [], // regla del anillo entero: no señala vértices concretos
    },
  ]

  it.each(casos)('$regla → hallazgo en $categoria con sus verticesAfectados', (caso) => {
    const res = valida(caso.recintos)
    const lista = res[caso.categoria]
    // `.some()`: basta con que el hallazgo esperado aparezca; un mismo defecto
    // puede activar reglas colaterales y no queremos depender de ellas.
    const encontrado = lista.some(
      (h) => caso.identifica(h) && mismosVertices(h.verticesAfectados, caso.vertices),
    )
    expect(encontrado, `no apareció el hallazgo esperado de "${caso.regla}"`).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 2 — "Un polígono con error bloqueante impide la generación de GML;
//               uno con solo avisos, no." (garantía de la que depende F04)
// ════════════════════════════════════════════════════════════════════════════
describe('F02 · AC2 · bloqueo vs no bloqueo (garantía de la que depende F04)', () => {
  it('(a) error bloqueante (vértice duplicado) ⇒ puedeGenerar=false y errores.length>0', () => {
    const res = valida([
      R([[BX, BY], [BX + 0.0005, BY], [BX + 10, BY], [BX + 10, BY + 10], [BX, BY + 10]]),
    ])
    expect(res.errores.length).toBeGreaterThan(0)
    expect(res.puedeGenerar).toBe(false) // "impide la generación de GML"
  })

  it('(b) SOLO avisos (cuadrado 0,3×0,3 m) ⇒ puedeGenerar=true, errores vacío y avisos.length>0', () => {
    const res = valida([R([[BX, BY], [BX + 0.3, BY], [BX + 0.3, BY + 0.3], [BX, BY + 0.3]])])
    expect(res.errores.length).toBe(0)
    expect(res.avisos.length).toBeGreaterThan(0)
    expect(res.puedeGenerar).toBe(true) // "uno con solo avisos, no [bloquea]"
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 3 — "El recuento separa errores y avisos." Nunca "2 avisos" cuando
//               uno es bloqueante: son listas distintas, con recuento propio.
// ════════════════════════════════════════════════════════════════════════════
describe('F02 · AC3 · recuento separado de errores y avisos', () => {
  // Polígono con UN error Y UN aviso a la vez: cuadrado válido de área pequeña
  // (0,5×0,5 = 0,25 m² < 1 m² → aviso "superficie muy pequeña") PERO con un
  // vértice duplicado (< 1 mm → error "eliminar vértice duplicado").
  const conErrorYAviso = [
    R([[BX, BY], [BX + 0.0005, BY], [BX + 0.5, BY], [BX + 0.5, BY + 0.5], [BX, BY + 0.5]]),
  ]

  it('errores y avisos son LISTAS SEPARADAS, contadas por su .length independiente', () => {
    const res = valida(conErrorYAviso)
    // Categorías separadas (no un único cubo mezclado):
    expect(Array.isArray(res.errores)).toBe(true)
    expect(Array.isArray(res.avisos)).toBe(true)
    // El error existe y se cuenta aparte…
    expect(res.errores.length).toBe(1)
    expect(res.errores.some((h) => h.correccion === 'Eliminar vértice duplicado')).toBe(true)
    // …el aviso existe y se cuenta aparte.
    expect(res.avisos.length).toBeGreaterThanOrEqual(1)
    expect(res.avisos.some((h) => h.mensaje.includes('muy pequeña'))).toBe(true)
    // Cada nivel es homogéneo: ningún ERROR se cuela en avisos ni viceversa.
    expect(res.errores.every((h) => h.nivel === NIVEL.ERROR)).toBe(true)
    expect(res.avisos.every((h) => h.nivel === NIVEL.AVISO)).toBe(true)
  })

  it('NO existe un campo agregado (p.ej. "total") que sume errores y avisos juntos', () => {
    const res = valida(conErrorYAviso)
    expect(res).not.toHaveProperty('total')
    // La forma es EXACTAMENTE tres claves: nada que agregue los dos recuentos.
    expect(Object.keys(res).sort()).toEqual(['avisos', 'errores', 'puedeGenerar'])
  })

  // ── Comprobación de FORMA del contrato (además del recuento separado) ─────────
  it('validarParcela devuelve exactamente {errores, avisos, puedeGenerar} con la forma pactada', () => {
    // Caso limpio (sin hallazgos) y caso sucio (con error): la forma es la misma
    // y el invariante puedeGenerar === (errores.length === 0) se cumple en ambos.
    const limpio = valida([R([[BX, BY], [BX + 100, BY], [BX + 100, BY + 100], [BX, BY + 100]])])
    const sucio = valida(conErrorYAviso)
    for (const res of [limpio, sucio]) {
      expect(Object.keys(res).sort()).toEqual(['avisos', 'errores', 'puedeGenerar'])
      expect(Array.isArray(res.errores)).toBe(true)
      expect(Array.isArray(res.avisos)).toBe(true)
      expect(typeof res.puedeGenerar).toBe('boolean')
      expect(res.puedeGenerar).toBe(res.errores.length === 0)
    }
    // Y que efectivamente distinguen los dos escenarios.
    expect(limpio.puedeGenerar).toBe(true)
    expect(sucio.puedeGenerar).toBe(false)
  })
})

import { describe, it, expect } from 'vitest'
import { discretizarBulge } from '../../geo/arco.js'
import { area, areaFirmada } from '../../geo/area.js'

// F01 · geo/arco.js — discretización de arcos DXF (bulge, código 42) sobre UTM.
// Ver spec/feature-01-entrada-parcela.md § "Discretización de arcos DXF".
//
// Convención verificada aquí: discretizarBulge devuelve SOLO los vértices NUEVOS
// entre P1 y P2 (sin incluir P1 ni P2); el polígono se reconstruye como
// [P1, ...vertices, P2]. Los valores esperados son ANALÍTICOS (inline), no
// mágicos: se recalculan con las mismas fórmulas del feature.
//
// Regla de oro 5: la superficie del polígono discretizado se comprueba con
// geo/area.areaFirmada (shoelace propio sobre UTM), NUNCA turf.area.

const EPS = 0.01 // flecha máxima por defecto (1 cm).

// Segmento circular ½·R²·(θ − sinθ) — cálculo analítico independiente.
function segArea(R, theta) {
  return 0.5 * R * R * (theta - Math.sin(theta))
}

// nSeg esperado según la regla de la flecha, recalculado de forma independiente.
function nSegEsperado(R, absTheta, eps = EPS) {
  return Math.ceil(absTheta / (2 * Math.acos(1 - eps / R)))
}

// Flecha (sagitta) máxima de las cuerdas de [P1, ...vertices, P2] respecto al
// centro C: sagitta = R − |C − puntoMedioDeLaCuerda|.
function flechaMaxima(ring, C, R) {
  let maxSag = 0
  for (let i = 0; i < ring.length - 1; i++) {
    const midx = (ring[i][0] + ring[i + 1][0]) / 2
    const midy = (ring[i][1] + ring[i + 1][1]) / 2
    const sag = R - Math.hypot(C[0] - midx, C[1] - midy)
    if (sag > maxSag) maxSag = sag
  }
  return maxSag
}

describe('geo/arco.js — semicírculo b=1 sobre P1=[0,0], P2=[10,0]', () => {
  const P1 = [0, 0]
  const P2 = [10, 0]
  const res = discretizarBulge(P1, P2, 1)

  it('R=5, Δθ=π, centro=[5,0]', () => {
    expect(res.radio).toBeCloseTo(5, 12)
    expect(res.deltaTheta).toBeCloseTo(Math.PI, 12)
    expect(res.centro[0]).toBeCloseTo(5, 9)
    expect(res.centro[1]).toBeCloseTo(0, 9)
  })

  it('subdivide por flecha, no por nº fijo de tramos (nSeg = ceil(|Δθ|/δ_max) = 25)', () => {
    expect(res.nSeg).toBe(nSegEsperado(5, Math.PI))
    expect(res.nSeg).toBe(25)
    // Convención: vertices sin P1 ni P2 ⇒ hay nSeg−1 vértices intermedios.
    expect(res.vertices).toHaveLength(res.nSeg - 1)
  })

  it('la flecha de cada tramo ≤ ε (1 cm)', () => {
    const ring = [P1, ...res.vertices, P2]
    expect(flechaMaxima(ring, res.centro, res.radio)).toBeLessThanOrEqual(EPS + 1e-12)
  })

  it('⛔ G2 · ΔS es la variación REAL de superficie (n_seg·segmentitos), no el segmento entero', () => {
    // ⛔ REGRESIÓN del hallazgo G2 (auditoría 2026-08-15): la fórmula antigua
    // (S_arco − S_discreto) medía contra la CUERDA y para ESTE semicírculo
    // (R=5, ε=1cm) anunciaba ΔS=39,17 m² cuando el área entre la polilínea y el
    // arco verdadero —lo que de verdad cambia la superficie al discretizar— es
    // 0,103 m². La cifra correcta se calculaba internamente y se descartaba.
    const sDiscreto = res.nSeg * segArea(5, Math.PI / res.nSeg)
    expect(res.deltaS).toBeCloseTo(sDiscreto, 9)
    expect(res.deltaS).toBeCloseTo(0.10327, 4) // la cifra medida del hallazgo
    expect(res.deltaS).toBeLessThan(1) // y NUNCA más los ~39 m² del defecto
  })

  it('el polígono [P1, ...vertices, P2] (cerrado por la cuerda) tiene |área| = S_arco − ΔS', () => {
    const ring = [P1, ...res.vertices, P2]
    const sArco = segArea(5, Math.PI) // = ½·25·π = 12.5π (semidisco = πR²/2).
    expect(sArco).toBeCloseTo((Math.PI * 25) / 2, 9)
    // El shoelace de [P1, …, P2] cierra por la CUERDA: su área es el segmento
    // circular entero MENOS lo que la discretización deja fuera (ΔS). Con la
    // fórmula antigua esta identidad decía area(ring) = ΔS — que era el aviso
    // de que ΔS medía contra la cuerda, no contra el arco (G2).
    expect(area(ring)).toBeCloseTo(sArco - res.deltaS, 6)
    // El arco b=1 sale por debajo de la cuerda; el recorrido P1→(fondo)→P2 y
    // cierre por la cuerda es ANTIHORARIO ⇒ firmada > 0 (shoelace de
    // [0,0],[5,−5],[10,0] = +25). El signo lo fija la orientación del anillo.
    expect(areaFirmada(ring)).toBeGreaterThan(0)
  })
})

describe('geo/arco.js — cuarto de círculo b=tan(π/8) sobre P1=[0,0], P2=[10,0]', () => {
  const P1 = [0, 0]
  const P2 = [10, 0]
  const b = Math.tan(Math.PI / 8)
  const res = discretizarBulge(P1, P2, b)

  it('R=5√2, Δθ=π/2, centro=[5,5]', () => {
    // Δθ = 4·atan(tan(π/8)) = π/2; R = c/(2·sin(Δθ/2)) = 10/(2·sin(π/4)) = 5√2.
    expect(res.deltaTheta).toBeCloseTo(Math.PI / 2, 12)
    expect(res.radio).toBeCloseTo(5 * Math.SQRT2, 9)
    expect(res.centro[0]).toBeCloseTo(5, 9)
    expect(res.centro[1]).toBeCloseTo(5, 9)
  })

  it('nSeg analítico y flecha ≤ ε', () => {
    const R = 5 * Math.SQRT2
    expect(res.nSeg).toBe(nSegEsperado(R, Math.PI / 2))
    expect(res.nSeg).toBe(15)
    expect(res.vertices).toHaveLength(res.nSeg - 1)
    const ring = [P1, ...res.vertices, P2]
    expect(flechaMaxima(ring, res.centro, res.radio)).toBeLessThanOrEqual(EPS + 1e-12)
  })

  it('ΔS analítico (G2: n_seg·segmentitos) y |área| del polígono coherente (regla 5: areaFirmada, no turf)', () => {
    const R = 5 * Math.SQRT2
    const sArco = segArea(R, Math.PI / 2)
    const sDiscreto = res.nSeg * segArea(R, Math.PI / 2 / res.nSeg)
    // G2 (2026-08-15): ΔS = área entre polilínea y arco = Σ segmentitos.
    expect(res.deltaS).toBeCloseTo(sDiscreto, 9)
    // El polígono cerrado por la cuerda mide el segmento entero MENOS ΔS.
    const ring = [P1, ...res.vertices, P2]
    expect(area(ring)).toBeCloseTo(sArco - res.deltaS, 6)
  })
})

describe('geo/arco.js — signo del bulge (b<0 = horario, espejo de b>0)', () => {
  it('b=−1 refleja el semicírculo al otro lado de la cuerda', () => {
    const P1 = [0, 0]
    const P2 = [10, 0]
    const pos = discretizarBulge(P1, P2, 1)
    const neg = discretizarBulge(P1, P2, -1)
    expect(neg.deltaTheta).toBeCloseTo(-Math.PI, 12)
    expect(neg.radio).toBeCloseTo(pos.radio, 12)
    expect(neg.nSeg).toBe(pos.nSeg)
    expect(neg.deltaS).toBeCloseTo(pos.deltaS, 12) // misma magnitud de superficie.
    // Mismo centro [5,0], pero los vértices intermedios salen por arriba (y>0).
    expect(neg.centro[0]).toBeCloseTo(5, 9)
    expect(neg.centro[1]).toBeCloseTo(0, 9)
    expect(neg.vertices.every(([, y]) => y > 0)).toBe(true)
    expect(pos.vertices.every(([, y]) => y < 0)).toBe(true)
  })
})

describe('geo/arco.js — casos límite y validación (regla de oro 1)', () => {
  it('b=0 → segmento recto: sin vértices intermedios, ΔS=0, radio=Infinity, centro=null', () => {
    const res = discretizarBulge([100, 200], [110, 205], 0)
    expect(res.vertices).toEqual([])
    expect(res.nSeg).toBe(1)
    expect(res.deltaS).toBe(0)
    expect(res.radio).toBe(Infinity)
    expect(res.centro).toBeNull()
    expect(res.deltaTheta).toBe(0)
  })

  it('|b| muy pequeño es estable: pocos tramos, ΔS→0, sin explotar', () => {
    const res = discretizarBulge([0, 0], [10, 0], 1e-6)
    expect(Number.isFinite(res.nSeg)).toBe(true)
    expect(res.nSeg).toBeGreaterThanOrEqual(1)
    expect(res.nSeg).toBeLessThan(10)
    expect(res.deltaS).toBeGreaterThanOrEqual(0)
    expect(res.deltaS).toBeCloseTo(0, 3)
  })

  it('funciona con coordenadas UTM reales (Este ~439k, Norte ~4.48M)', () => {
    const P1 = [439000, 4479000]
    const P2 = [439010, 4479000]
    const res = discretizarBulge(P1, P2, 1)
    expect(res.radio).toBeCloseTo(5, 9)
    // G2: el polígono cerrado por la cuerda = segmento entero − ΔS.
    const ring = [P1, ...res.vertices, P2]
    expect(area(ring)).toBeCloseTo(segArea(5, Math.PI) - res.deltaS, 6)
  })

  it('coordenada no finita → TypeError', () => {
    expect(() => discretizarBulge([0, NaN], [10, 0], 1)).toThrow(TypeError)
    expect(() => discretizarBulge([0, 0], [Infinity, 0], 1)).toThrow(TypeError)
  })

  it('P1/P2 mal formados (no [x,y]) → TypeError', () => {
    expect(() => discretizarBulge([0], [10, 0], 1)).toThrow(TypeError)
    expect(() => discretizarBulge([0, 0, 0], [10, 0], 1)).toThrow(TypeError)
    expect(() => discretizarBulge('0,0', [10, 0], 1)).toThrow(TypeError)
  })

  it('b no finito → TypeError', () => {
    expect(() => discretizarBulge([0, 0], [10, 0], NaN)).toThrow(TypeError)
    expect(() => discretizarBulge([0, 0], [10, 0], Infinity)).toThrow(TypeError)
  })

  it('flechaMax ≤ 0 o no finito → TypeError', () => {
    expect(() => discretizarBulge([0, 0], [10, 0], 1, { flechaMax: 0 })).toThrow(TypeError)
    expect(() => discretizarBulge([0, 0], [10, 0], 1, { flechaMax: -0.01 })).toThrow(TypeError)
  })

  it('cuerda de longitud 0 con b≠0 → TypeError (arco degenerado)', () => {
    expect(() => discretizarBulge([5, 5], [5, 5], 1)).toThrow(TypeError)
  })

  it('flechaMax menor genera más tramos (subdivisión más fina)', () => {
    const grueso = discretizarBulge([0, 0], [10, 0], 1, { flechaMax: 0.05 })
    const fino = discretizarBulge([0, 0], [10, 0], 1, { flechaMax: 0.001 })
    expect(fino.nSeg).toBeGreaterThan(grueso.nSeg)
  })
})

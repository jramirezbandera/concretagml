/* -------------------------------------------------------------------------- *
 * test/parsers/aceptacion-f01.test.js — F01 · T4.1 · SUITE DE ACEPTACIÓN       *
 *                                                                              *
 * Prueba de CAJA NEGRA (end-to-end) que mapea 1:1 a los 4 Criterios de         *
 * aceptación de spec/feature-01-entrada-parcela.md (§ "Criterios de            *
 * aceptación"). NO re-testea internos: solo ejercita las APIs PÚBLICAS         *
 * importar() / parseDXF() / discretizarBulge(), y no reimplementa la           *
 * matemática de la discretización (la comprueba con una identidad geométrica   *
 * independiente — el shoelace del polígono resultante).                        *
 *                                                                              *
 * Un bloque describe() por criterio. Cada assert va atado a una frase EXACTA   *
 * del criterio, citada en comentario.                                          *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { importar } from '../../parsers/importar.js'
import { parseDXF } from '../../parsers/dxf.js'
import { discretizarBulge } from '../../geo/arco.js'
import { TIPO_DETECCION, SEVERIDAD } from '../../parsers/_comun.js'

// ── Carga de fixtures REALES ──────────────────────────────────────────────────
const leer = (rel, enc = 'utf8') => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), enc)
const LIST_REAL = leer('../fixtures/parsers/LIST.txt')
const PARCELA_REAL = leer('../fixtures/parsers/PARCELA.txt')
// El DXF real está en cp1252; sus rutas/coords son ASCII → 'latin1' basta.
const UTM_REAL = leer('../fixtures/parsers/UTM.dxf', 'latin1')
// DXF reales del usuario (exportados de AutoCAD) para AC2 (arco) y AC4 (no soportado).
const BULGE_REAL = leer('../fixtures/parsers/03_lwpolyline_bulge.dxf', 'latin1')
const NOSOP_REAL = leer('../fixtures/parsers/05_no_soportado_insert_spline.dxf', 'latin1')

// ── Helpers de test (medición geométrica genérica; NO matemática de bulge) ────
const porTipo = (dets, tipo) => dets.filter((d) => d.tipo === tipo)

/** Constructor de DXF sintético como pares (código, valor) línea a línea. */
const dxf = (...pares) => pares.join('\n') + '\n'

/**
 * Área shoelace |Σ|/2 de un anillo, medida trasladando el origen al primer
 * vértice para EVITAR la cancelación catastrófica con coords UTM (~1e6·1e6).
 * Para el polígono [P1, ...vertices, P2] el shoelace cierra P2→P1 por la CUERDA,
 * así que su área es exactamente el ΔS (área entre polilínea y cuerda). Es una
 * comprobación 100% independiente de geo/arco.js: solo usa coordenadas de salida.
 */
function shoelaceAbs(ring) {
  const [ox, oy] = ring[0]
  let s = 0
  for (let i = 0; i < ring.length; i++) {
    const [x1, y1] = ring[i]
    const [x2, y2] = ring[(i + 1) % ring.length]
    s += (x1 - ox) * (y2 - oy) - (x2 - ox) * (y1 - oy)
  }
  return Math.abs(s) / 2
}

/** Flecha (sagitta) máxima de las cuerdas de `ring` respecto al centro C de radio R. */
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

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 1 — "LIST/TXT reales parsean a modelo con el nº correcto de vértices
//               y polígonos (fixtures de DXF/LIST reales en test/fixtures/)."
// ════════════════════════════════════════════════════════════════════════════
describe('AC1 · LIST/TXT reales → modelo con nº correcto de vértices y polígonos', () => {
  it('LIST.txt real → 1 polígono, 11 vértices (vía importar, caja negra)', () => {
    const { parcela, anillos, resumen } = importar(LIST_REAL)
    // "…con el nº correcto de … polígonos": un único anillo/recinto.
    expect(resumen.nAnillos).toBe(1)
    expect(anillos).toHaveLength(1)
    // "…con el nº correcto de vértices…": 11 (la LWPOLYLINE lista 11 ubicaciones).
    expect(anillos[0]).toHaveLength(11)
    // "…parsean a modelo…": se construye la parcela con ese único recinto de 11.
    expect(parcela).not.toBeNull()
    expect(parcela.recintos).toHaveLength(1)
    expect(parcela.recintos[0].vertices).toHaveLength(11)
    expect(resumen.construida).toBe(true)
  })

  it('PARCELA.txt real → 12 filas normalizan a 1 polígono de 11 vértices ABIERTOS', () => {
    const { parcela, anillos, detecciones, resumen } = importar(PARCELA_REAL)
    // "…parsean a modelo…": el fichero trae 12 filas (la 12ª == la 1ª, cierre
    // EXACTO); el modelo guarda anillos abiertos → 11 vértices, 1 polígono.
    expect(resumen.nAnillos).toBe(1)
    expect(anillos[0]).toHaveLength(11)
    expect(parcela.recintos[0].vertices).toHaveLength(11)
    // El cierre exacto es normalización trivial (no una "corrección"): sin CIERRE.
    expect(porTipo(detecciones, TIPO_DETECCION.CIERRE)).toHaveLength(0)
    // "reales": describen la MISMA parcela que el LIST → vértices idénticos.
    expect(anillos[0]).toEqual(importar(LIST_REAL).anillos[0])
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 2 — "Un LWPOLYLINE con bulge conocido discretiza con flecha ≤ 1 cm y
//               el ΔS reportado coincide con el cálculo analítico (toBeCloseTo)."
// ════════════════════════════════════════════════════════════════════════════
describe('AC2 · LWPOLYLINE con bulge conocido → flecha ≤ 1 cm y ΔS analítico', () => {
  it('DXF REAL 03_lwpolyline_bulge.dxf → semicírculo b=1 (R=5) discretizado, flecha ≤1cm, ΔS analítico', () => {
    // Fixture real del usuario: cuadrado 10×10 cuyo lado de cierre V3→V0 (cuerda
    // vertical de 10 m) lleva bulge=1.0 → semicírculo Δθ=π, R=5, centro=(299380,4028490).
    const { anillos, detecciones } = parseDXF(BULGE_REAL)
    expect(anillos).toHaveLength(1) // una LWPOLYLINE en ENTITIES
    // "…discretiza…": el 42=1.0 NO se ignora → arco discretizado reportado. El parser
    // emite una detección POR TRAMO ({nSeg,deltaS,radio}) y otra de RESUMEN ({deltaSTotal}).
    const arcos = porTipo(detecciones, TIPO_DETECCION.ARCO_DISCRETIZADO)
    const porTramo = arcos.find((a) => a.datos && typeof a.datos.deltaS === 'number')
    expect(porTramo).toBeTruthy()
    expect(arcos.some((a) => a.datos && typeof a.datos.deltaSTotal === 'number')).toBe(true)
    const V0 = [299380.0, 4028484.999999999]
    const V3 = [299380.0, 4028495.0]
    const eng = discretizarBulge(V3, V0, 1.0) // el bulge va en el lado de cierre V3→V0
    expect(eng.radio).toBeCloseTo(5, 6) // R = cuerda/2
    // "…parsean a modelo…": anillo = 4 vértices del cuadrado + intermedios del arco.
    expect(anillos[0]).toHaveLength(4 + eng.vertices.length)
    const arcoParser = [V3, ...anillos[0].slice(4), V0] // el arco de cierre, geometría de SALIDA
    // "…con flecha ≤ 1 cm…" (medido sobre la salida del parser, no del motor).
    expect(flechaMaxima(arcoParser, eng.centro, eng.radio)).toBeLessThanOrEqual(0.01)
    // "…el ΔS reportado coincide con el cálculo analítico…": shoelace independiente ≈ ΔS,
    // y el ΔS de la detección del parser también.
    expect(shoelaceAbs(arcoParser)).toBeCloseTo(eng.deltaS, 4)
    expect(porTramo.datos.deltaS).toBeCloseTo(eng.deltaS, 6)
  })

  // Bulge CONOCIDO: semicírculo b=1 entre dos vértices UTM separados 20 m.
  //   b=1 ⇒ Δθ = 4·atan(1) = π (semicírculo);  c=20 ⇒ R = c/2 = 10 m;
  //   centro = punto medio de la cuerda = [298760, 4090050].
  const P1 = [298750, 4090050]
  const P2 = [298770, 4090050]
  // DXF ASCII mínimo y válido: UNA LWPOLYLINE (abierta) con el bulge en el 1er vértice.
  const TEXTO = dxf(
    '0', 'SECTION', '2', 'ENTITIES',
    '0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '0',
    '10', '298750.0', '20', '4090050.0', '42', '1',
    '10', '298770.0', '20', '4090050.0',
    '0', 'ENDSEC', '0', 'EOF',
  )
  const r = parseDXF(TEXTO)
  const ring = r.anillos[0]
  // Motor de referencia (misma API pública) para consistencia parser↔motor.
  const eng = discretizarBulge(P1, P2, 1)

  it('bulge=1 es un semicírculo conocido (R=10, Δθ=π, centro=[298760,4090050])', () => {
    // "…bulge conocido…": los parámetros del arco son analíticos y verificables.
    expect(eng.radio).toBeCloseTo(10, 9)
    expect(eng.deltaTheta).toBeCloseTo(Math.PI, 12)
    expect(eng.centro[0]).toBeCloseTo(298760, 6)
    expect(eng.centro[1]).toBeCloseTo(4090050, 6)
  })

  it('"discretiza": el LWPOLYLINE se sustituye por [P1, …vertices, P2] (parser↔motor)', () => {
    // "…discretiza…": el 42 NO se ignora; el arco se vuelve polilínea de cuerdas.
    expect(r.anillos).toHaveLength(1)
    // Consistencia parser↔motor: mismo nº de vértices insertados y mismas posiciones.
    expect(ring).toHaveLength(eng.nSeg + 1) // [P1] + (nSeg-1) intermedios + [P2]
    expect(ring).toEqual([P1, ...eng.vertices, P2])
  })

  it('"con flecha ≤ 1 cm": la sagitta de CADA tramo no supera 0.01 m', () => {
    // "…con flecha ≤ 1 cm…": subdivisión por sagitta, no por nº fijo de tramos.
    expect(flechaMaxima(ring, eng.centro, eng.radio)).toBeLessThanOrEqual(0.01)
  })

  it('"ΔS reportado coincide con el cálculo analítico" (toBeCloseTo) y emite ARCO_DISCRETIZADO', () => {
    // "…el ΔS reportado…": el parser emite ARCO_DISCRETIZADO (INFO) con datos.deltaS.
    const arcos = porTipo(r.detecciones, TIPO_DETECCION.ARCO_DISCRETIZADO)
    const porArco = arcos.find((d) => d.datos && 'nSeg' in d.datos)
    expect(porArco).toBeTruthy()
    expect(porArco.severidad).toBe(SEVERIDAD.INFO)
    expect(porArco.datos.nSeg).toBe(eng.nSeg)
    const deltaSReportado = porArco.datos.deltaS

    // "…coincide con el cálculo analítico (toBeCloseTo)": el ΔS reportado es el área
    // entre la polilínea y la cuerda, calculada AQUÍ por shoelace independiente.
    expect(deltaSReportado).toBeCloseTo(shoelaceAbs(ring), 5)
    // Forma cerrada analítica del segmento (identidad del feature, sinΔθ=sin π=0):
    //   ΔS = ½·R²·(nSeg·sin(Δθ/nSeg) − sinΔθ)
    const deltaSAnalitico = 0.5 * eng.radio ** 2 * (eng.nSeg * Math.sin(Math.PI / eng.nSeg) - Math.sin(Math.PI))
    expect(deltaSReportado).toBeCloseTo(deltaSAnalitico, 6)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 3 — "Coordenadas invertidas, geográficas y polígono abierto disparan
//               su detección; ninguna se 'arregla' en silencio."
// ════════════════════════════════════════════════════════════════════════════
describe('AC3 · invertidas / geográficas / polígono abierto → detección; nada en silencio', () => {
  const aTXT = (anillo) => anillo.map(([x, y]) => `${x} ${y}`).join('\n')

  it('"Coordenadas invertidas … disparan su detección; ninguna se arregla en silencio"', () => {
    // Cuadrado con X/Y invertidas en TODOS los vértices (|Este|>1e6, |Norte|<1e6).
    const invertido = [
      [4000000, 500000],
      [4000000, 500010],
      [4000010, 500010],
      [4000010, 500000],
    ]
    const { anillos, detecciones } = importar(aTXT(invertido), { formato: 'TXT' })
    // "…disparan su detección…": SWAP_XY como AVISO.
    const swap = porTipo(detecciones, TIPO_DETECCION.SWAP_XY)
    expect(swap).toHaveLength(1)
    expect(swap[0].severidad).toBe(SEVERIDAD.AVISO)
    // "…ninguna se arregla en silencio…": NO aplicado por defecto; anillo intacto.
    expect(swap[0].datos.aplicado).toBe(false)
    expect(anillos[0]).toEqual(invertido)
    // Se OFRECE el intercambio como dato, no se impone.
    expect(swap[0].datos.anilloIntercambiado).toEqual([
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
    ])
  })

  it('el intercambio es OFERTA, no imposición: solo con intercambiarXY:true se aplica', () => {
    // Refuerza "nada en silencio": el arreglo solo ocurre si el usuario lo pide.
    const invertido = [
      [4000000, 500000],
      [4000000, 500010],
      [4000010, 500010],
      [4000010, 500000],
    ]
    const { anillos, parcela } = importar(aTXT(invertido), { formato: 'TXT', intercambiarXY: true })
    expect(anillos[0]).toEqual([
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
    ])
    expect(parcela).not.toBeNull()
  })

  it('"Coordenadas … geográficas … disparan su detección; ninguna se arregla en silencio"', () => {
    // Anillo entero en grados geográficos (|v|<1000): no es UTM.
    const grados = [
      [-5.3, 36.9],
      [-5.2, 36.9],
      [-5.2, 37.0],
      [-5.3, 37.0],
    ]
    const { anillos, detecciones, parcela, resumen } = importar(aTXT(grados), { formato: 'TXT' })
    // "…disparan su detección…": GRADOS como AVISO, con oferta de proyectar.
    const g = porTipo(detecciones, TIPO_DETECCION.GRADOS)
    expect(g).toHaveLength(1)
    expect(g[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(g[0].datos.reproyectar).toBe(true)
    // "…ninguna se arregla en silencio…": NO se reproyecta (regla 3); anillo intacto,
    // parcela bloqueada por estar en grados (no en UTM).
    expect(anillos[0]).toEqual(grados)
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toContain('COORDENADAS_EN_GRADOS')
  })

  it('"…polígono abierto disparan su detección; ninguna se arregla en silencio"', () => {
    // Cuadrado con vértice de cierre a ~0.10 m del primero (misclosure apreciable).
    const casiCerrado = [
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
      [500000.08, 4000000.06], // off ~0.10 m respecto al primero
    ]
    const { anillos, detecciones } = importar(aTXT(casiCerrado), { formato: 'TXT' })
    // "…disparan su detección…": CIERRE como AVISO con el error MEDIDO.
    const cierre = porTipo(detecciones, TIPO_DETECCION.CIERRE)
    expect(cierre).toHaveLength(1)
    expect(cierre[0].severidad).toBe(SEVERIDAD.AVISO)
    // (marcador de banda ambigua; asserts de "no tocar" justo debajo)
    expect(cierre[0].datos.error).toBeCloseTo(0.1, 3)
    // "…ninguna se arregla en silencio…": en la banda ambigua NO se toca la geometría…
    expect(cierre[0].datos.aplicado).toBe('NINGUNO')
    // …pero SÍ se ofrecen AMBAS lecturas como dato (retirar el vértice / compensar).
    expect(cierre[0].datos.anilloSinCierre).toHaveLength(4)
    expect(cierre[0].datos.anilloCompensado).toHaveLength(4)
    // El anillo devuelto es el CRUDO intacto (Vúltimo conservado): nada se altera solo.
    expect(anillos[0]).toEqual(casiCerrado)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 4 — "Una entidad no soportada (INSERT, spline) produce aviso claro,
//               no un fallo de programa."
// ════════════════════════════════════════════════════════════════════════════
describe('AC4 · entidad no soportada (INSERT / spline) → aviso claro, no un fallo', () => {
  it('DXF REAL 05_no_soportado_insert_spline.dxf → INSERT y SPLINE avisan, sin lanzar; la LWPOLYLINE sí se lee', () => {
    // Fixture real del usuario: INSERT + SPLINE (no soportados) conviviendo con una
    // LWPOLYLINE recta en ENTITIES. Debe avisar de cada no-soportado y NO lanzar.
    let res
    expect(() => {
      res = parseDXF(NOSOP_REAL)
    }).not.toThrow() // "…no un fallo de programa."
    const avisos = porTipo(res.detecciones, TIPO_DETECCION.ENTIDAD_NO_SOPORTADA).filter(
      (d) => d.severidad === SEVERIDAD.AVISO,
    )
    // "…produce aviso claro…": INSERT y SPLINE aparecen nombrados en los avisos.
    const blob = avisos.map((d) => `${d.mensaje} ${JSON.stringify(d.datos ?? {})}`.toUpperCase()).join(' | ')
    expect(blob).toContain('INSERT')
    expect(blob).toContain('SPLINE')
    // La LWPOLYLINE real (recta) SÍ se lee como geometría (no se descarta todo el fichero).
    expect(res.anillos.length).toBeGreaterThanOrEqual(1)
  })

  it('UTM.dxf real (3 INSERT) → 3 avisos ENTIDAD_NO_SOPORTADA; NO lanza', () => {
    // "…no un fallo de programa…": la llamada no debe lanzar.
    let r
    expect(() => {
      r = parseDXF(UTM_REAL)
    }).not.toThrow()
    // "…entidad no soportada (INSERT…) produce aviso claro…": un AVISO por cada INSERT.
    const avisos = r.detecciones.filter(
      (d) => d.tipo === TIPO_DETECCION.ENTIDAD_NO_SOPORTADA && d.severidad === SEVERIDAD.AVISO,
    )
    expect(avisos).toHaveLength(3)
    for (const a of avisos) {
      expect(a.datos.tipo).toBe('INSERT')
      // "…aviso claro…": mensaje legible con la guía de qué hacer (LIMPIA/PURGE).
      expect(a.mensaje).toMatch(/no soportada/i)
      expect(a.mensaje).toMatch(/LIMPIA|PURGE/)
    }
  })

  it('SPLINE (inline) → aviso claro con guía; NO lanza y no aporta geometría', () => {
    // Cubre explícitamente la "spline" del criterio (UTM.dxf no la trae en ENTITIES).
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'SPLINE', '8', '0', '10', '298750.0', '20', '4090050.0',
      '0', 'ENDSEC', '0', 'EOF',
    )
    let r
    // "…no un fallo de programa…"
    expect(() => {
      r = parseDXF(texto)
    }).not.toThrow()
    // "…entidad no soportada (… spline) produce aviso claro…"
    const aviso = r.detecciones.find(
      (d) => d.tipo === TIPO_DETECCION.ENTIDAD_NO_SOPORTADA && d.severidad === SEVERIDAD.AVISO,
    )
    expect(aviso).toBeTruthy()
    expect(aviso.datos.tipo).toBe('SPLINE')
    expect(aviso.mensaje).toMatch(/no soportada/i)
    // La spline no forma anillo: no se inventa geometría.
    expect(r.anillos).toHaveLength(0)
  })
})

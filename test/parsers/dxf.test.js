/* -------------------------------------------------------------------------- *
 * test/parsers/dxf.test.js — F01 · T2.3 · Parser DXF propio, consciente de     *
 * secciones (parsers/dxf.js). LA TAREA DE MAYOR RIESGO DE F01.                 *
 *                                                                              *
 * Cubre:                                                                       *
 *   1. UTM.dxf REAL (471 KB, AutoCAD AC1024/R2020): SOLO geometría de ENTITIES *
 *      (≈25 anillos), NADA de las LWPOLYLINE con coords LOCALES de BLOCKS;      *
 *      3 avisos por los INSERT; robustez ante LINE/TEXT/MTEXT/POINT/IMAGE.     *
 *   2. Discretización de bulges (código 42) por CONSISTENCIA con              *
 *      geo/arco.js#discretizarBulge, en LWPOLYLINE y en POLYLINE clásica.      *
 *   3. poly_clasica.dxf SINTÉTICO (ver nota abajo): POLYLINE/VERTEX/SEQEND.    *
 *   4. AC4: entidad no soportada → aviso claro, no excepción.                  *
 *   5. Entrada inválida → TypeError (regla de oro 1).                          *
 *                                                                              *
 * ⚠️ DISCREPANCIA FEATURE vs FIXTURE REAL (verificada, ver nota en el test de  *
 * "arcos"): el valor 0.6011385410059346 que el enunciado da por "bulge" NO es  *
 * un bulge en UTM.dxf: son los códigos 41/42/43 (escalas X/Y/Z) de 3 bloques   *
 * INSERT "LOGO". El código 42 solo es bulge DENTRO de una LWPOLYLINE/VERTEX    *
 * (es contextual). Por eso UTM.dxf produce 0 arcos y el parser NO debe         *
 * confundir esa escala con un arco. La ruta de arco se ejercita, con ese mismo *
 * valor, sobre polilíneas donde SÍ es un bulge legítimo.                       *
 *                                                                              *
 * poly_clasica.dxf es un fixture SINTÉTICO (el DXF real no trae POLYLINE       *
 * clásica); el usuario puede sustituirlo por un DXF legado real equivalente.   *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { parseDXF } from '../../parsers/dxf.js'
import { discretizarBulge } from '../../geo/arco.js'
import { TIPO_DETECCION, SEVERIDAD } from '../../parsers/_comun.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (nombre) => resolve(__dirname, '../fixtures/parsers', nombre)
// El DXF real está en cp1252 (ANSI_1252); las rutas/coords son ASCII → 'latin1'.
const UTM = readFileSync(fixture('UTM.dxf'), 'latin1')
const POLY_CLASICA = readFileSync(fixture('poly_clasica.dxf'), 'utf8')

const BULGE = 0.6011385410059346 // el valor del enunciado, usado donde SÍ es bulge.

// Helper para construir DXF sintéticos como pares (código, valor) línea a línea.
const dxf = (...pares) => pares.join('\n') + '\n'

// ── 1 · UTM.dxf real ──────────────────────────────────────────────────────────

describe('parseDXF · UTM.dxf real (solo ENTITIES, nunca BLOCKS)', () => {
  const r = parseDXF(UTM)

  it('origen DXF y no revienta con LINE/TEXT/MTEXT/POINT/IMAGE/INSERT', () => {
    expect(r.origen).toBe('DXF')
    expect(Array.isArray(r.anillos)).toBe(true)
    expect(Array.isArray(r.detecciones)).toBe(true)
  })

  it('extrae exactamente los 25 anillos de ENTITIES (espacio-modelo)', () => {
    expect(r.anillos).toHaveLength(25)
    // Recuento de vértices verificado directamente sobre el fixture.
    expect(r.anillos.map((a) => a.length)).toEqual([
      11, 10, 10, 19, 4, 93, 34, 19, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 11,
    ])
  })

  it('NINGÚN vértice procede de BLOCKS: todos en UTM huso 30 (|x|≫1000)', () => {
    // Las LWPOLYLINE de BLOCKS llevan coords LOCALES (~ −44). Si se hubieran
    // colado, |x| sería < 1000. Todos deben ser Este UTM de 6 cifras (~298 800).
    for (const anillo of r.anillos) {
      for (const [x, y] of anillo) {
        expect(Math.abs(x)).toBeGreaterThan(1000)
        expect(x).toBeGreaterThan(298000)
        expect(x).toBeLessThan(299000)
        expect(y).toBeGreaterThan(4089000)
        expect(y).toBeLessThan(4091000)
      }
    }
  })

  it('emite 3 avisos ENTIDAD_NO_SOPORTADA (los 3 INSERT), no una excepción', () => {
    const avisos = r.detecciones.filter(
      (d) => d.tipo === TIPO_DETECCION.ENTIDAD_NO_SOPORTADA && d.severidad === SEVERIDAD.AVISO,
    )
    expect(avisos).toHaveLength(3)
    for (const a of avisos) {
      expect(a.datos.tipo).toBe('INSERT')
      expect(a.mensaje).toMatch(/LIMPIA|PURGE/) // guía del feature.
    }
  })

  it('NO discretiza ningún arco: el 0.601 de los INSERT (código 42 = escala Y) NO es un bulge', () => {
    // Prueba maestra de la consciencia de secciones/entidades: el parser NO debe
    // tratar el factor de escala 0.6011385410059346 de los bloques como un bulge.
    expect(r.detecciones.filter((d) => d.tipo === TIPO_DETECCION.ARCO_DISCRETIZADO)).toHaveLength(0)
  })

  it('resume anotaciones (TEXT/MTEXT) y otras entidades (LINE/POINT/IMAGE) en INFO, sin spam', () => {
    const infos = r.detecciones.filter(
      (d) => d.tipo === TIPO_DETECCION.ENTIDAD_NO_SOPORTADA && d.severidad === SEVERIDAD.INFO,
    )
    // Una detección para anotaciones y otra para el resto: NUNCA una por entidad.
    const anot = infos.find((d) => d.datos.tipos.TEXT)
    expect(anot.datos.tipos).toEqual({ TEXT: 121, MTEXT: 15 })
    expect(anot.datos.total).toBe(136)
    const otras = infos.find((d) => d.datos.tipos.LINE)
    expect(otras.datos.tipos.LINE).toBe(70)
    expect(otras.datos.tipos.POINT).toBe(155)
    expect(otras.datos.tipos.IMAGE).toBe(1)
  })
})

// ── 2 · Discretización de arcos (bulge, código 42) por CONSISTENCIA ───────────

describe('parseDXF · bulges donde SÍ son bulge (consistencia con geo/arco.js)', () => {
  const V0 = [298750, 4090050]
  const V1 = [298770, 4090050]
  const arco = discretizarBulge(V0, V1, BULGE)

  it('LWPOLYLINE: inserta discretizarBulge(Vi,Vi+1,b).vertices entre ambos vértices', () => {
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '0',
      '10', '298750.0', '20', '4090050.0', '42', String(BULGE),
      '10', '298770.0', '20', '4090050.0',
      '0', 'ENDSEC', '0', 'EOF',
    )
    const r = parseDXF(texto)
    expect(r.anillos).toHaveLength(1)
    // El tramo se reconstruye EXACTAMENTE como [P1, ...vertices, P2] (convención geo/arco).
    expect(r.anillos[0]).toEqual([V0, ...arco.vertices, V1])
  })

  it('reporta ARCO_DISCRETIZADO (INFO) con { nSeg, deltaS, radio } y un resumen total', () => {
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '0',
      '10', '298750.0', '20', '4090050.0', '42', String(BULGE),
      '10', '298770.0', '20', '4090050.0',
      '0', 'ENDSEC', '0', 'EOF',
    )
    const arcs = parseDXF(texto).detecciones.filter(
      (d) => d.tipo === TIPO_DETECCION.ARCO_DISCRETIZADO,
    )
    // Uno por arco + uno de resumen total.
    const porArco = arcs.find((d) => 'nSeg' in d.datos)
    expect(porArco.severidad).toBe(SEVERIDAD.INFO)
    expect(porArco.datos.nSeg).toBe(arco.nSeg)
    expect(porArco.datos.deltaS).toBeCloseTo(arco.deltaS, 9)
    expect(porArco.datos.radio).toBeCloseTo(arco.radio, 9)
    const resumen = arcs.find((d) => 'deltaSTotal' in d.datos)
    expect(resumen.datos.arcos).toBe(1)
    expect(resumen.datos.deltaSTotal).toBeCloseTo(arco.deltaS, 9)
  })

  it('POLYLINE clásica: el bulge de un VERTEX se discretiza igual que en LWPOLYLINE', () => {
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'POLYLINE', '8', '0', '66', '1', '70', '0',
      '0', 'VERTEX', '8', '0', '10', '298750.0', '20', '4090050.0', '42', String(BULGE),
      '0', 'VERTEX', '8', '0', '10', '298770.0', '20', '4090050.0',
      '0', 'SEQEND',
      '0', 'ENDSEC', '0', 'EOF',
    )
    const r = parseDXF(texto)
    expect(r.anillos[0]).toEqual([V0, ...arco.vertices, V1])
  })

  it('polilínea CERRADA: el bulge del ÚLTIMO vértice envuelve Vn-1→V0 sin duplicar V0', () => {
    // Cuadrado cerrado (70 bit 1) con bulge=1 (semicírculo) en el tramo de cierre.
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', '0', '90', '4', '70', '1',
      '10', '0.0', '20', '0.0',
      '10', '10.0', '20', '0.0',
      '10', '10.0', '20', '10.0',
      '10', '0.0', '20', '10.0', '42', '1',
      '0', 'ENDSEC', '0', 'EOF',
    )
    const r = parseDXF(texto)
    const cierre = discretizarBulge([0, 10], [0, 0], 1)
    const ring = r.anillos[0]
    // Anillo ABIERTO (regla 4): V0=[0,0] aparece UNA sola vez, al principio.
    expect(ring.filter(([x, y]) => x === 0 && y === 0)).toHaveLength(1)
    expect(ring[0]).toEqual([0, 0])
    // Los 4 vértices + los intermedios del arco de cierre, en orden.
    expect(ring).toEqual([[0, 0], [10, 0], [10, 10], [0, 10], ...cierre.vertices])
  })
})

// ── 3 · Fixture sintético poly_clasica.dxf ────────────────────────────────────

describe('parseDXF · poly_clasica.dxf (SINTÉTICO: POLYLINE/VERTEX/SEQEND)', () => {
  it('parsea la POLYLINE clásica cerrada a 1 anillo de 4 vértices con coords correctas', () => {
    const r = parseDXF(POLY_CLASICA)
    expect(r.origen).toBe('DXF')
    expect(r.anillos).toHaveLength(1)
    expect(r.anillos[0]).toEqual([
      [298750, 4090050],
      [298760, 4090050],
      [298760, 4090060],
      [298750, 4090060],
    ])
  })
})

// ── 4 · Consciencia de secciones (no descender a BLOCKS) ──────────────────────

describe('parseDXF · máquina de estados por secciones', () => {
  it('IGNORA la geometría de BLOCKS y solo toma la de ENTITIES', () => {
    // Misma LWPOLYLINE (coords locales) en BLOCKS y una real en ENTITIES.
    const texto = dxf(
      '0', 'SECTION', '2', 'BLOCKS',
      '0', 'BLOCK', '2', 'LOGO',
      '0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '0',
      '10', '-44.46', '20', '-12.3',
      '10', '-40.0', '20', '-10.0',
      '0', 'ENDBLK',
      '0', 'ENDSEC',
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', '0', '90', '2', '70', '0',
      '10', '298750.0', '20', '4090050.0',
      '10', '298760.0', '20', '4090050.0',
      '0', 'ENDSEC', '0', 'EOF',
    )
    const r = parseDXF(texto)
    expect(r.anillos).toHaveLength(1)
    expect(r.anillos[0]).toEqual([
      [298750, 4090050],
      [298760, 4090050],
    ])
    for (const [x] of r.anillos[0]) expect(Math.abs(x)).toBeGreaterThan(1000)
  })

  it('descarta la Z (código 30) de los VERTEX y lo reporta UNA vez (Z_DESCARTADA)', () => {
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'POLYLINE', '8', '0', '66', '1', '70', '0',
      '0', 'VERTEX', '8', '0', '10', '298750.0', '20', '4090050.0', '30', '3.5',
      '0', 'VERTEX', '8', '0', '10', '298760.0', '20', '4090050.0', '30', '3.5',
      '0', 'SEQEND',
      '0', 'ENDSEC', '0', 'EOF',
    )
    const r = parseDXF(texto)
    expect(r.anillos[0]).toEqual([
      [298750, 4090050],
      [298760, 4090050],
    ])
    const z = r.detecciones.filter((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)
    expect(z).toHaveLength(1)
    expect(z[0].datos.vertices).toBe(2)
  })
})

// ── 5 · AC4 · entidad no soportada → aviso claro, no excepción ────────────────

describe('parseDXF · AC4 (entidad no soportada nunca es un fallo de programa)', () => {
  it('una SPLINE suelta produce un AVISO claro con guía, sin lanzar', () => {
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'SPLINE', '8', '0', '10', '298750.0', '20', '4090050.0',
      '0', 'ENDSEC', '0', 'EOF',
    )
    let r
    expect(() => {
      r = parseDXF(texto)
    }).not.toThrow()
    const aviso = r.detecciones.find(
      (d) => d.tipo === TIPO_DETECCION.ENTIDAD_NO_SOPORTADA && d.severidad === SEVERIDAD.AVISO,
    )
    expect(aviso.datos.tipo).toBe('SPLINE')
    expect(aviso.mensaje).toMatch(/no soportada/i)
    expect(r.anillos).toHaveLength(0)
  })
})

// ── 6 · Entrada inválida → TypeError (regla de oro 1) ─────────────────────────

describe('parseDXF · validación de entrada', () => {
  it('LANZA TypeError si `texto` no es un string', () => {
    expect(() => parseDXF(42)).toThrow(TypeError)
    expect(() => parseDXF(null)).toThrow(TypeError)
    expect(() => parseDXF(['0', 'SECTION'])).toThrow(TypeError)
    expect(() => parseDXF(undefined)).toThrow(TypeError)
  })
})

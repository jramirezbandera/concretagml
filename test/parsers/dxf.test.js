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
 *   6. F11 · `capas[]`: la CAPA (código de grupo 8) de cada anillo, literal.   *
 *      Incluye el reparto MEDIDO de los dos DXF reales, la trampa de la        *
 *      POLYLINE clásica (la capa va en la CABECERA, no en VERTEX ni SEQEND),   *
 *      la ida y vuelta con `export/dxf.js` y el caso sin código 8, que hay     *
 *      que FABRICAR porque ningún DXF real del repo lo tiene.                  *
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
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { parseDXF } from '../../parsers/dxf.js'
import { discretizarBulge } from '../../geo/arco.js'
import { TIPO_DETECCION, SEVERIDAD } from '../../parsers/_comun.js'
import { CAPAS, serializarParcelaDxf } from '../../export/dxf.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixture = (nombre) => resolve(__dirname, '../fixtures/parsers', nombre)
// El DXF real está en cp1252 (ANSI_1252); las rutas/coords son ASCII → 'latin1'.
const UTM = readFileSync(fixture('UTM.dxf'), 'latin1')
const POLY_CLASICA = readFileSync(fixture('poly_clasica.dxf'), 'utf8')
// F11 · el primer DXF REAL del repo con POLYLINE/VERTEX/SEQEND clásicos
// (descarga de Consulta Masiva; procedencia en fixtures/parsers/PROCEDENCIA.md).
const EDIFICIO = readFileSync(fixture('edificio_consulta_masiva_3515508VF0831N.dxf'), 'latin1')
// Los otros dos fixtures de F01, que hasta F11 solo leía test/parsers/aceptacion-f01.
const BULGE_FIXTURE = readFileSync(fixture('03_lwpolyline_bulge.dxf'), 'latin1')
const NO_SOPORTADO_FIXTURE = readFileSync(fixture('05_no_soportado_insert_spline.dxf'), 'latin1')
// El fichero real que destapó que el flag de cierre (código 70) se estaba tirando:
// una polilínea `70=1` cuyo tramo de cierre mide 0,1118 m y caía en la banda
// ambigua de `importar.js`. Procedencia en fixtures/parsers/PROCEDENCIA.md.
const CIERRE_FLAG70 = readFileSync(fixture('cierre_flag70_arco.dxf'), 'latin1')

/** Reparto {capa: nºAnillos} a partir de `capas[]`. */
const repartoDe = (capas) => {
  const m = {}
  for (const c of capas) m[c] = (m[c] || 0) + 1
  return m
}

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

// ── 7 · F11 · la CAPA (código de grupo 8) de cada anillo ──────────────────────
//
// F01 leía la geometría y tiraba la capa, que es EL discriminante del fichero:
// sin ella, «una polilínea = una parte» produce 25 partes en un plano donde 16
// son cajetín, marco y leyenda. Estas pruebas fijan el reparto MEDIDO de los dos
// DXF reales (verdad externa, `fixtures/parsers/PROCEDENCIA.md`).

describe('parseDXF · capas[] (F11, contrato A)', () => {
  it('UTM.dxf: 25 anillos repartidos en 5 capas — FINO 16 · LINDE 4 · PARCELA 3 · BLANCO 1 · 0 ⇢ 1', () => {
    const r = parseDXF(UTM)
    expect(r.capas).toHaveLength(r.anillos.length) // 1:1, sin excepción
    expect(repartoDe(r.capas)).toEqual({ FINO: 16, LINDE: 4, PARCELA: 3, BLANCO: 1, 0: 1 })
  })

  it('UTM.dxf: la parcela de verdad está en la capa «0», NO en la llamada «PARCELA»', () => {
    // ⛔ La trampa medida en la fase 0: el anillo de la capa `0` (11 vértices) es
    // el que comparte sus 12 vértices con PARCELA.txt, la verdad externa de F01.
    // La capa literalmente llamada «PARCELA» trae OTROS tres anillos. Por eso el
    // reparto se OFRECE y no se adivina por el nombre (decisión 5 de F11).
    const r = parseDXF(UTM)
    const enCapaCero = r.anillos.filter((_, i) => r.capas[i] === '0')
    expect(enCapaCero).toHaveLength(1)
    expect(enCapaCero[0]).toHaveLength(11)
    expect(r.anillos.filter((_, i) => r.capas[i] === 'PARCELA')).toHaveLength(3)
  })

  it('las capas llegan LITERALES: ni minúsculas, ni recortes, ni normalización', () => {
    const r = parseDXF(UTM)
    expect(r.capas).toContain('PARCELA') // no 'parcela'
    expect(parseDXF(EDIFICIO).capas).toContain('Construccion') // no 'construccion' ni 'CONSTRUCCION'
  })

  it('edificio real: 7 anillos en «Construccion» y 1 en «Parcela»', () => {
    const r = parseDXF(EDIFICIO)
    expect(r.anillos).toHaveLength(8)
    expect(repartoDe(r.capas)).toEqual({ Construccion: 7, Parcela: 1 })
  })

  it('⚠️ y es POLYLINE/VERTEX/SEQEND, no LWPOLYLINE: la capa va en la CABECERA', () => {
    // La razón de ser de este fixture. El SEQEND de cada POLYLINE declara la capa
    // `0`; si la capa se leyera del SEQEND (o de los VERTEX), las siete huellas
    // saldrían en la capa `0` y el reparto sería un 8 ⇢ «0» silencioso.
    expect(EDIFICIO).toMatch(/\bPOLYLINE\b/)
    expect(EDIFICIO).not.toMatch(/\bLWPOLYLINE\b/)
    expect(EDIFICIO).toMatch(/SEQEND\r?\n[ \t]*8\r?\n0\r?\n/) // el SEQEND dice «0»
    const r = parseDXF(EDIFICIO)
    expect(r.capas.filter((c) => c === '0')).toHaveLength(0) // …y aun así ninguna huella cae en «0»
  })

  it('poly_clasica.dxf (VERTEX que SÍ repiten 8/0) sigue dando la capa «0»', () => {
    // El caso contrario del anterior: aquí cabecera y vértices coinciden, así que
    // leer la cabecera no puede empeorar nada.
    expect(parseDXF(POLY_CLASICA).capas).toEqual(['0'])
  })

  it('una entidad SIN código 8 da `` y nunca `undefined` (caso fabricado: no lo trae ningún DXF real)', () => {
    // ⚠️ Ninguno de los cinco DXF del repo tiene una entidad sin capa —AutoCAD
    // siempre la escribe—, así que el caso se fabrica aquí. Importa porque
    // `capas[i]` es `string` en el contrato: quien lo recorra no puede toparse
    // con `undefined` y creer que el índice no existe.
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '90', '2', '70', '0', // ← sin código 8
      '10', '298750.0', '20', '4090050.0',
      '10', '298760.0', '20', '4090050.0',
      '0', 'LWPOLYLINE', '8', 'CON_CAPA', '90', '2', '70', '0',
      '10', '298750.0', '20', '4090060.0',
      '10', '298760.0', '20', '4090060.0',
      '0', 'ENDSEC', '0', 'EOF',
    )
    const r = parseDXF(texto)
    expect(r.anillos).toHaveLength(2)
    expect(r.capas).toEqual(['', 'CON_CAPA'])
    expect(r.capas[0]).not.toBeUndefined()
    for (const c of r.capas) expect(typeof c).toBe('string')
  })

  it('una POLYLINE clásica sin código 8 en su cabecera también da ``', () => {
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'POLYLINE', '66', '1', '70', '0', // ← sin código 8 en la CABECERA
      '0', 'VERTEX', '8', 'DA_IGUAL', '10', '298750.0', '20', '4090050.0',
      '0', 'VERTEX', '8', 'DA_IGUAL', '10', '298760.0', '20', '4090050.0',
      '0', 'SEQEND', '8', 'TAMPOCO',
      '0', 'ENDSEC', '0', 'EOF',
    )
    // Manda la cabecera: ni el VERTEX ni el SEQEND aportan la capa.
    expect(parseDXF(texto).capas).toEqual([''])
  })

  it('`capas` y `anillos` tienen la MISMA longitud en los cinco DXF del repo', () => {
    for (const texto of [UTM, EDIFICIO, POLY_CLASICA, BULGE_FIXTURE, NO_SOPORTADO_FIXTURE]) {
      const r = parseDXF(texto)
      expect(r.capas).toHaveLength(r.anillos.length)
    }
  })
})

// ── 8 · F11 · la ida y vuelta con export/dxf.js (la asimetría que dejó F10) ───

describe('parseDXF · relee las capas del DXF que escribe export/dxf.js', () => {
  const cuadrado = (lado, dx = 0, dy = 0) => [
    [440123.45 + dx, 4470987.65 + dy],
    [440123.45 + dx + lado, 4470987.65 + dy],
    [440123.45 + dx + lado, 4470987.65 + dy + lado],
    [440123.45 + dx, 4470987.65 + dy + lado],
  ]
  const recinto = (vertices, tipo = 'EXTERIOR') => ({ vertices, tipo })

  it('PARCELA_OFICIAL y PARCELA_EDITADA vuelven 1:1 con sus anillos, con el literal que escribe el serializador', () => {
    const { dxf: escrito } = serializarParcelaDxf({
      recintosEditados: [recinto(cuadrado(40, 1.67))],
      recintosOficiales: [recinto(cuadrado(40))],
    })
    const r = parseDXF(escrito)
    expect(r.anillos).toHaveLength(2)
    // El orden de ENTITIES es oficial → editada (lo fija export/dxf.js).
    expect(r.capas).toEqual([CAPAS.OFICIAL.nombre, CAPAS.EDITADA.nombre])
    // Y no es una cadena escrita a mano en el test: es la del módulo que escribe.
    expect(r.capas).toEqual(['PARCELA_OFICIAL', 'PARCELA_EDITADA'])
  })

  it('con un hueco vuelven TRES anillos y la capa dice a cuál pertenece cada uno', () => {
    const { dxf: escrito } = serializarParcelaDxf({
      recintosEditados: [recinto(cuadrado(40)), recinto(cuadrado(10, 10, 10), 'HUECO')],
      recintosOficiales: [recinto(cuadrado(40))],
    })
    const r = parseDXF(escrito)
    expect(r.anillos).toHaveLength(3)
    expect(r.capas).toEqual([
      CAPAS.OFICIAL.nombre,
      CAPAS.EDITADA.nombre,
      CAPAS.EDITADA.nombre, // el hueco es de la geometría EDITADA, no otra parcela
    ])
    // El formato DXF no tiene el concepto de hueco (por eso export/dxf.js lo avisa):
    // la capa es lo único que dice que esos dos anillos son la misma figura.
    expect(repartoDe(r.capas)).toEqual({ PARCELA_OFICIAL: 1, PARCELA_EDITADA: 2 })
  })

  it('leer un DXF propio NO produce ni una detección (el cambio de F11 es aditivo)', () => {
    // Guarda del acuerdo escrito en la cabecera de parsers/dxf.js: la detección
    // del reparto la emite `parsers/importar.js`, no este parser, precisamente
    // para no poner roja esta afirmación (que además es cierta y hay que mantener).
    const { dxf: escrito } = serializarParcelaDxf({
      recintosEditados: [recinto(cuadrado(40, 1.67))],
      recintosOficiales: [recinto(cuadrado(40))],
    })
    expect(parseDXF(escrito).detecciones).toEqual([])
  })
})

// ── 9 · F11 · los 4 fixtures de F01 dan EXACTAMENTE los mismos anillos ────────
//
// «Si algún test de F01 cambia de resultado, parar: significa que se ha tocado la
// geometría». Esto lo hace ejecutable: la huella SHA-256 de `JSON.stringify(anillos)`
// se tomó con el `parsers/dxf.js` de HEAD (commit c2df2c7, antes de F11) y se
// comprobó idéntica con el de ahora. Si una de estas cuatro cae, NO se actualiza
// la cifra: se revierte el cambio que la movió.

describe('parseDXF · F01 intacto (huella exacta de los anillos, tomada antes de F11)', () => {
  const HUELLAS = [
    ['UTM.dxf', UTM, 25, '5e23097cd9aeb8fda8f2a7942b0b4c04a797e9d4cdeaebd56c1db62951abd3c4'],
    ['03_lwpolyline_bulge.dxf', BULGE_FIXTURE, 1, '92a4ad8106520a795cf3ba6bdc8d7102e91d0b2015a60654eb61def1da7ee223'],
    ['05_no_soportado_insert_spline.dxf', NO_SOPORTADO_FIXTURE, 1, '200d81f7348364b03b40d844e121af08aee5e69f509f1c0e2e6d4a875be6f45e'],
    ['poly_clasica.dxf', POLY_CLASICA, 1, 'ad3cc5d411a13c33aa227a6e6cba9beb1d539d8f2435dfa7758c383fe9a61b5f'],
  ]

  for (const [nombre, texto, nAnillos, huella] of HUELLAS) {
    it(`${nombre}: ${nAnillos} anillo(s), vértice a vértice, sin una sola coordenada movida`, () => {
      const r = parseDXF(texto)
      expect(r.anillos).toHaveLength(nAnillos)
      expect(
        createHash('sha256').update(JSON.stringify(r.anillos)).digest('hex'),
        `F11 debía ser ADITIVO y ha movido la geometría de ${nombre}: revierte, no actualices la huella`,
      ).toBe(huella)
    })
  }
})

// ═══════════════════════════════════════════════════════════════════════════
// F22 · `rotulos[]` — las anotaciones dejan de tirarse
// ═══════════════════════════════════════════════════════════════════════════

describe('parseDXF — F22 · los rótulos', () => {
  const MANZANA = readFileSync(fixture('manzana_consulta_masiva_6346726UF8664N.dxf'), 'latin1')

  it('devuelve las 161 anotaciones con texto y sitio, con su capa LITERAL', () => {
    const { rotulos } = parseDXF(MANZANA)
    expect(rotulos).toHaveLength(161)
    const porCapa = {}
    for (const r of rotulos) porCapa[r.capa] = (porCapa[r.capa] ?? 0) + 1
    expect(porCapa).toEqual({ txtConstru: 153, RefCatastral: 8 })
    expect(rotulos.find((r) => r.capa === 'RefCatastral')).toMatchObject({
      tipo: 'TEXT',
      texto: '6346726UF8664N',
    })
  })

  it('⚠️ el mensaje ya NO dice «se ignoraron»: dejó de ser cierto', () => {
    const { detecciones } = parseDXF(MANZANA)
    const anot = detecciones.find((d) => d.datos && typeof d.datos.conRotulo === 'number')
    expect(anot.datos).toMatchObject({ total: 161, conRotulo: 161 })
    expect(anot.mensaje).not.toContain('Se ignoraron')
    expect(anot.mensaje).toContain('no son geometría')
    expect(anot.mensaje).toContain('rótulos')
  })

  it('⚠️ la trampa del 11/21: con justificación manda el punto de alineación', () => {
    // En un TEXT el 10/20 solo es la posición real si NO hay justificación
    // (códigos 72/73). El fichero real trae 72=1 y 73=1 y DUPLICA el punto en
    // 10/20 y 11/21, así que no distingue las dos ramas: aquí se separan a mano,
    // porque el siguiente fichero puede no ser tan amable y el fallo sería mudo.
    const conJustificacion = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'TEXT', '8', 'R', '10', '0.0', '20', '0.0',
      '11', '386100.0', '21', '4064400.0', '72', '1', '73', '1', '1', 'BUENO',
      '0', 'TEXT', '8', 'R', '10', '386200.0', '20', '4064500.0',
      '72', '0', '73', '0', '1', 'IZQUIERDA',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n')
    const { rotulos } = parseDXF(conJustificacion)
    expect(rotulos).toEqual([
      { tipo: 'TEXT', capa: 'R', texto: 'BUENO', x: 386100, y: 4064400 },
      { tipo: 'TEXT', capa: 'R', texto: 'IZQUIERDA', x: 386200, y: 4064500 },
    ])
  })

  it('una anotación sin texto, o sin sitio, NO es un rótulo', () => {
    const crudo = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'TEXT', '8', 'R', '10', '386100.0', '20', '4064400.0', '1', '   ',
      '0', 'TEXT', '8', 'R', '1', 'SIN SITIO',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n')
    const { rotulos, detecciones } = parseDXF(crudo)
    expect(rotulos).toEqual([])
    // Pero el recuento de anotaciones NO cambia: siguen siendo dos.
    const anot = detecciones.find((d) => d.datos && typeof d.datos.conRotulo === 'number')
    expect(anot.datos).toMatchObject({ total: 2, conRotulo: 0 })
  })

  it('un MTEXT junta sus trozos (códigos 3) con el final (código 1)', () => {
    const crudo = [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'MTEXT', '8', 'R', '10', '386100.0', '20', '4064400.0',
      '3', 'PRIMERO', '3', '-SEGUNDO', '1', '-FINAL',
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n')
    expect(parseDXF(crudo).rotulos[0].texto).toBe('PRIMERO-SEGUNDO-FINAL')
  })

  it('un DXF sin anotaciones devuelve `rotulos: []`, nunca undefined', () => {
    expect(parseDXF(POLY_CLASICA).rotulos).toEqual([])
  })
})

// ── 10 · `cerrados[]` · el flag de cierre (código 70, bit 0) ──────────────────
//
// El parser ya lo leía para decidir si dibujar el tramo Vn-1→V0, y después lo
// TIRABA. Aguas abajo eso no se puede reconstruir: `parsers/importar.js` solo veía
// una lista de vértices y, cuando el último caía cerca del primero, preguntaba por
// un error de cierre que el fichero ya había contestado. El oráculo es
// `cierre_flag70_arco.dxf` (fichero real, ver PROCEDENCIA.md).
describe('parseDXF · cerrados[] (el flag de cierre, código de grupo 70)', () => {
  it('el fichero real que destapó el defecto: UNA polilínea con 70=1 → `cerrados: [true]`', () => {
    const r = parseDXF(CIERRE_FLAG70)
    expect(r.anillos).toHaveLength(1)
    expect(r.cerrados).toEqual([true])
    // 21 vértices y NO se repite V0: el flag es lo único que dice que cierra.
    expect(r.anillos[0]).toHaveLength(21)
    expect(r.anillos[0][20]).not.toEqual(r.anillos[0][0])
  })

  it('el tramo de cierre mide 0,1118 m y encaja con el arco — la razón de todo esto', () => {
    // Cuatro lados rectos (9–15 m) y un arco de 17 tramos de 0,11 a 0,25 m. El
    // tramo Vúltimo→V0 mide 0,1118 m: cae en la banda ambigua de 0,5 m de
    // `importar.js` y a la vez es el último tramo de la curva, no un misclosure.
    const a = parseDXF(CIERRE_FLAG70).anillos[0]
    const d = (p, q) => Math.hypot(q[0] - p[0], q[1] - p[1])
    expect(d(a[20], a[0])).toBeCloseTo(0.1118, 4)
    // El arco empieza en V4: sus tramos son V4→V5 … V19→V20 (i desde 5), NO V3→V4,
    // que es el cuarto lado recto y mide 13,65 m.
    const tramosDelArco = []
    for (let i = 5; i < a.length; i++) tramosDelArco.push(d(a[i - 1], a[i]))
    expect(Math.min(...tramosDelArco)).toBeGreaterThan(0.1) // el de cierre no es un outlier
    expect(Math.max(...tramosDelArco)).toBeLessThan(0.25)
    expect(d(a[0], a[1])).toBeGreaterThan(9) // …y los lados rectos son otro orden de magnitud
  })

  it('LWPOLYLINE: 70=0 → `false`, 70=1 → `true`, y sin código 70 → `false` (nunca undefined)', () => {
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'A', '90', '2', '70', '0',
      '10', '298750.0', '20', '4090050.0',
      '10', '298760.0', '20', '4090050.0',
      '0', 'LWPOLYLINE', '8', 'B', '90', '2', '70', '1',
      '10', '298750.0', '20', '4090060.0',
      '10', '298760.0', '20', '4090060.0',
      '0', 'LWPOLYLINE', '8', 'C', '90', '2', // ← sin código 70
      '10', '298750.0', '20', '4090070.0',
      '10', '298760.0', '20', '4090070.0',
      '0', 'ENDSEC', '0', 'EOF',
    )
    const r = parseDXF(texto)
    expect(r.cerrados).toEqual([false, true, false])
    for (const c of r.cerrados) expect(typeof c).toBe('boolean')
  })

  it('el bit 0 manda: 70=129 (cerrada + spline-fit) es CERRADA; 70=128 no lo es', () => {
    // El 70 es un mapa de bits, no un booleano: 128 = "polilínea generada por
    // linetype". Leerlo con `=== 1` daría `false` en una polilínea cerrada real.
    const conFlag = (n) => dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'A', '90', '2', '70', String(n),
      '10', '298750.0', '20', '4090050.0',
      '10', '298760.0', '20', '4090050.0',
      '0', 'ENDSEC', '0', 'EOF',
    )
    expect(parseDXF(conFlag(129)).cerrados).toEqual([true])
    expect(parseDXF(conFlag(128)).cerrados).toEqual([false])
  })

  it('POLYLINE clásica: el 70 va en la CABECERA, igual que la capa', () => {
    const texto = dxf(
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'POLYLINE', '8', 'CAB', '66', '1', '70', '1',
      '0', 'VERTEX', '8', 'CAB', '10', '298750.0', '20', '4090050.0',
      '0', 'VERTEX', '8', 'CAB', '10', '298760.0', '20', '4090050.0',
      '0', 'VERTEX', '8', 'CAB', '10', '298760.0', '20', '4090060.0',
      '0', 'SEQEND', '8', 'CAB',
      '0', 'ENDSEC', '0', 'EOF',
    )
    expect(parseDXF(texto).cerrados).toEqual([true])
    // Y el fixture sintético de la vía clásica, que su propia cabecera declara
    // «UNA POLYLINE clasica cerrada»: el flag lo confirma, no lo contradice.
    expect(parseDXF(POLY_CLASICA).cerrados).toEqual([true])
  })

  it('`cerrados` y `anillos` tienen la MISMA longitud en los seis DXF del repo', () => {
    const todos = [UTM, EDIFICIO, POLY_CLASICA, BULGE_FIXTURE, NO_SOPORTADO_FIXTURE, CIERRE_FLAG70]
    for (const texto of todos) {
      const r = parseDXF(texto)
      expect(r.cerrados).toHaveLength(r.anillos.length)
      for (const c of r.cerrados) expect(typeof c).toBe('boolean')
    }
  })

  it('F01/F11 INTACTOS: el cambio es aditivo — mismos anillos y mismas capas', () => {
    // La misma guardia que F11 se puso a sí misma: un campo más no puede mover ni
    // un vértice ni un nombre de capa de los fixtures que ya estaban.
    for (const texto of [UTM, EDIFICIO, POLY_CLASICA, BULGE_FIXTURE, NO_SOPORTADO_FIXTURE]) {
      const r = parseDXF(texto)
      expect(r.anillos.length).toBeGreaterThan(0)
      expect(r.capas).toHaveLength(r.anillos.length)
    }
    expect(repartoDe(parseDXF(UTM).capas)).toEqual({ FINO: 16, LINDE: 4, PARCELA: 3, BLANCO: 1, 0: 1 })
  })
})

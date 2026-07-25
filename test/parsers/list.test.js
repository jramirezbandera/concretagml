/* -------------------------------------------------------------------------- *
 * test/parsers/list.test.js — Parser de LISTA de AutoCAD (F01, T2.1)          *
 *                                                                            *
 * Se apoya en el fixture REAL test/fixtures/parsers/LIST.txt: pegado de la    *
 * LISTA (_LIST) de una LWPOLYLINE con 11 líneas «Ubicación: X= .. Y= .. Z=».  *
 * Cubre AC1: nº correcto de vértices/polígonos, coords crudas en UTM, descarte *
 * de Z, cabeceras que NO generan vértices, origen 'LIST', y el `meta` de       *
 * cotejo (Área/Perímetro/Cerrado). También el contrato de errores (regla 1).   *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { parseLIST } from '../../parsers/list.js'
import { TIPO_DETECCION, SEVERIDAD } from '../../parsers/_comun.js'
import { ORIGEN_PARCELA } from '../../model/parcela.js'

const LIST_REAL = readFileSync(
  fileURLToPath(new URL('../fixtures/parsers/LIST.txt', import.meta.url)),
  'utf8',
)

// Los 11 vértices del fixture, en orden (X, Y); la Z (0.0000) se descarta.
const VERTICES_ESPERADOS = [
  [298755.5889, 4090054.3788],
  [298755.8939, 4090054.3763],
  [298755.8139, 4090059.4292],
  [298756.1654, 4090063.3345],
  [298756.1104, 4090067.7861],
  [298760.5239, 4090067.546],
  [298759.6975, 4090058.5242],
  [298759.1598, 4090058.5734],
  [298758.4211, 4090050.5088],
  [298755.9492, 4090050.881],
  [298755.6446, 4090050.8585],
]

describe('parsers/list — parseLIST sobre el fixture REAL', () => {
  it('AC1: parsea 1 polígono con 11 vértices (sin vértice de cierre duplicado)', () => {
    const { anillos } = parseLIST(LIST_REAL)
    expect(anillos).toHaveLength(1)
    expect(anillos[0]).toHaveLength(11)
  })

  it('devuelve los vértices crudos en UTM [x, y], en orden', () => {
    const { anillos } = parseLIST(LIST_REAL)
    expect(anillos[0]).toEqual(VERTICES_ESPERADOS)
  })

  it('primer y último vértice concretos', () => {
    const { anillos } = parseLIST(LIST_REAL)
    expect(anillos[0][0]).toEqual([298755.5889, 4090054.3788])
    expect(anillos[0][10]).toEqual([298755.6446, 4090050.8585])
  })

  it('las cabeceras (Trazo/Capa/Área/Perímetro/Anchura) NO generan vértices', () => {
    // 11 «Ubicación» → exactamente 11 vértices; ninguna cabecera se coló.
    const { anillos } = parseLIST(LIST_REAL)
    expect(anillos[0]).toHaveLength(11)
    // Ningún vértice cae fuera del rango de las Ubicaciones reales (p. ej. 61.045
    // del Área o 42.1753 del Perímetro no aparecen como coordenada).
    for (const [x, y] of anillos[0]) {
      expect(x).toBeGreaterThan(298000)
      expect(y).toBeGreaterThan(4090000)
    }
  })

  it('descarta la Z y lo declara con UNA Deteccion Z_DESCARTADA (11 vértices)', () => {
    const { detecciones } = parseLIST(LIST_REAL)
    const z = detecciones.filter((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)
    expect(z).toHaveLength(1)
    expect(z[0].severidad).toBe(SEVERIDAD.INFO)
    expect(z[0].datos).toEqual({ vertices: 11 })
  })

  it("emite la Deteccion SEPARADOR_DECIMAL autodetectada como '.'", () => {
    const { detecciones } = parseLIST(LIST_REAL)
    const sep = detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep).toHaveLength(1)
    expect(sep[0].datos).toEqual({ separador: '.', autodetectado: true })
  })

  it("no hay corte de polígono (una sola LWPOLYLINE, sin palabra 'separador')", () => {
    const { detecciones } = parseLIST(LIST_REAL)
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.SEPARADOR_POLIGONO)).toBe(false)
  })

  it("etiqueta el origen como 'LIST'", () => {
    const { origen } = parseLIST(LIST_REAL)
    expect(origen).toBe(ORIGEN_PARCELA.LIST)
    expect(origen).toBe('LIST')
  })

  it('captura los metadatos reportados (Área/Perímetro/Cerrado) en `meta`', () => {
    const { meta } = parseLIST(LIST_REAL)
    expect(meta).toEqual({
      areaReportada: 61.045,
      perimetroReportado: 42.1753,
      cerrado: true,
    })
  })

  it('devuelve un POJO plano (regla de oro 4): sin prototipo de clase', () => {
    const r = parseLIST(LIST_REAL)
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(r.anillos[0][0])).toBe(Array.prototype)
  })
})

describe('parsers/list — parseLIST · contrato y opciones', () => {
  it('respeta un separador decimal FORZADO por opts', () => {
    const texto = 'Ubicación:  X= 439250,35  Y= 4479664,55  Z= 0,0000'
    const { anillos, detecciones } = parseLIST(texto, { separadorDecimal: ',' })
    expect(anillos).toEqual([[[439250.35, 4479664.55]]])
    const sep = detecciones.find((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep.datos).toEqual({ separador: ',', autodetectado: false })
  })

  it("la palabra 'separador' parte en varios anillos (multipolígono)", () => {
    const texto = [
      'Ubicación:  X= 10.0  Y= 20.0  Z= 0.0',
      'separador',
      'Ubicación:  X= 30.0  Y= 40.0  Z= 0.0',
    ].join('\n')
    const { anillos, detecciones } = parseLIST(texto)
    expect(anillos).toEqual([[[10, 20]], [[30, 40]]])
    expect(detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_POLIGONO)).toHaveLength(1)
  })

  it('sin metadatos reportados → no añade `meta`', () => {
    const texto = 'Ubicación:  X= 10.0  Y= 20.0  Z= 0.0'
    const r = parseLIST(texto)
    expect('meta' in r).toBe(false)
  })

  it('entrada inválida (no string) → TypeError (regla de oro 1)', () => {
    expect(() => parseLIST(42)).toThrow(TypeError)
    expect(() => parseLIST(null)).toThrow(TypeError)
    expect(() => parseLIST(['Ubicación:  X= 1  Y= 2'])).toThrow(TypeError)
  })

  it('separador decimal inválido en opts → RangeError (lo valida _comun.js)', () => {
    expect(() => parseLIST('X= 1 Y= 2', { separadorDecimal: ';' })).toThrow(RangeError)
  })
})

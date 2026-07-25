/* -------------------------------------------------------------------------- *
 * test/parsers/comun.test.js — Contrato y tokenizador compartido (F01, T1.1)  *
 *                                                                            *
 * Sin fixtures en disco: strings inline (list/txt no existen aún). Cubre:     *
 *   - autodetectarSeparadorDecimal: ',' vs '.' (incl. coma como delimitador). *
 *   - extraerPares: pares con cabeceras/etiquetas, descarte de Z, corte por   *
 *     `separador`, separador decimal declarado.                               *
 *   - crearDeteccion: LANZA ante tipo/severidad inválidos (regla de oro 1).   *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import {
  TIPO_DETECCION,
  SEVERIDAD,
  crearDeteccion,
  autodetectarSeparadorDecimal,
  extraerPares,
} from '../../parsers/_comun.js'

// ── TIPO_DETECCION / SEVERIDAD ────────────────────────────────────────────────

describe('parsers/_comun — vocabulario común', () => {
  it('TIPO_DETECCION expone el léxico requerido y está congelado', () => {
    for (const k of [
      'SEPARADOR_DECIMAL',
      'Z_DESCARTADA',
      'SEPARADOR_POLIGONO',
      'ARCO_DISCRETIZADO',
      'ENTIDAD_NO_SOPORTADA',
      'SWAP_XY',
      'GRADOS',
      'CIERRE',
      'HUSO_AMBIGUO',
    ]) {
      expect(TIPO_DETECCION[k]).toBe(k)
    }
    expect(Object.isFrozen(TIPO_DETECCION)).toBe(true)
    expect(() => {
      TIPO_DETECCION.NUEVO = 'X'
    }).toThrow()
  })

  it('SEVERIDAD tiene INFO/AVISO/ERROR y está congelada', () => {
    expect(SEVERIDAD).toEqual({ INFO: 'INFO', AVISO: 'AVISO', ERROR: 'ERROR' })
    expect(Object.isFrozen(SEVERIDAD)).toBe(true)
  })
})

// ── crearDeteccion ────────────────────────────────────────────────────────────

describe('parsers/_comun — crearDeteccion', () => {
  it('devuelve un POJO plano con tipo/mensaje/severidad', () => {
    const d = crearDeteccion(TIPO_DETECCION.Z_DESCARTADA, 'Z fuera', SEVERIDAD.INFO)
    expect(d).toEqual({ tipo: 'Z_DESCARTADA', mensaje: 'Z fuera', severidad: 'INFO' })
    // POJO sin prototipo de clase ni métodos (regla de oro 4).
    expect(Object.getPrototypeOf(d)).toBe(Object.prototype)
  })

  it('incluye `datos` sólo cuando se aporta', () => {
    const sin = crearDeteccion(TIPO_DETECCION.CIERRE, 'no cierra', SEVERIDAD.AVISO)
    expect('datos' in sin).toBe(false)
    const con = crearDeteccion(TIPO_DETECCION.CIERRE, 'no cierra', SEVERIDAD.AVISO, { gap: 0.2 })
    expect(con.datos).toEqual({ gap: 0.2 })
  })

  it('LANZA (RangeError) ante tipo inválido — regla de oro 1', () => {
    expect(() => crearDeteccion('NO_EXISTE', 'x', SEVERIDAD.INFO)).toThrow(RangeError)
  })

  it('LANZA (RangeError) ante severidad inválida — regla de oro 1', () => {
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, 'x', 'CRITICO')).toThrow(RangeError)
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, 'x', 'info')).toThrow(RangeError) // case-sensitive
  })

  it('LANZA (TypeError) ante mensaje vacío o `datos` no-objeto', () => {
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, '', SEVERIDAD.INFO)).toThrow(TypeError)
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, 'ok', SEVERIDAD.INFO, [1, 2])).toThrow(TypeError)
    expect(() => crearDeteccion(TIPO_DETECCION.GRADOS, 'ok', SEVERIDAD.INFO, null)).toThrow(TypeError)
  })
})

// ── autodetectarSeparadorDecimal ──────────────────────────────────────────────

describe('parsers/_comun — autodetectarSeparadorDecimal', () => {
  it("punto decimal, columnas por espacio → '.'", () => {
    const txt = '439250.35 4479664.55\n439260.10 4479670.20'
    expect(autodetectarSeparadorDecimal(txt)).toBe('.')
  })

  it("coma decimal, columnas por punto y coma → ','", () => {
    const txt = '439250,35;4479664,55\n439260,10;4479670,20'
    expect(autodetectarSeparadorDecimal(txt)).toBe(',')
  })

  it("coma decimal, columnas por espacio → ','", () => {
    const txt = '439250,35 4479664,55\n439260,10 4479670,20'
    expect(autodetectarSeparadorDecimal(txt)).toBe(',')
  })

  it("caso peliagudo: punto decimal + coma como separador de columnas → '.'", () => {
    // La coma es delimitador, no decimal; el punto gana el recuento \d?\d.
    expect(autodetectarSeparadorDecimal('439250.35, 4479664.55')).toBe('.') // con espacio
    expect(autodetectarSeparadorDecimal('439250.35,4479664.55')).toBe('.') // sin espacio
  })

  it("coords enteras (sin decimales) → '.' por defecto (elección segura)", () => {
    expect(autodetectarSeparadorDecimal('439250 4479664\n439260 4479670')).toBe('.')
  })

  it('LANZA si no recibe un string', () => {
    expect(() => autodetectarSeparadorDecimal(42)).toThrow(TypeError)
    expect(() => autodetectarSeparadorDecimal(['a'])).toThrow(TypeError)
  })
})

// ── extraerPares ──────────────────────────────────────────────────────────────

describe('parsers/_comun — extraerPares', () => {
  it('extrae pares saltando cabeceras y etiquetas mezcladas', () => {
    const lineas = [
      'LWPOLYLINE   Layer: "0"', // cabecera: 0 números → se salta
      'Vertices seguido', // etiqueta sin números → se salta
      '439250.35 4479664.55',
      '', // línea en blanco → se salta
      '439260.10   4479670.20',
      'Total: 2 vertices', // 2 números (2 y 2) — ojo: SÍ se leería…
    ]
    const { anillos } = extraerPares(lineas.slice(0, 5))
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
    ])
  })

  it('siempre emite UNA Deteccion SEPARADOR_DECIMAL con el separador elegido', () => {
    const { detecciones } = extraerPares('439250.35 4479664.55')
    const sep = detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep).toHaveLength(1)
    expect(sep[0].severidad).toBe(SEVERIDAD.INFO)
    expect(sep[0].datos).toEqual({ separador: '.', autodetectado: true })
  })

  it('respeta un separador decimal FORZADO por opts (sin autodetección)', () => {
    const { anillos, detecciones } = extraerPares('439250,35 4479664,55', { separadorDecimal: ',' })
    expect(anillos).toEqual([[[439250.35, 4479664.55]]])
    const sep = detecciones.find((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep.datos).toEqual({ separador: ',', autodetectado: false })
  })

  it('formato LIST de AutoCAD (X= Y= Z=): toma X,Y y descarta Z con su Deteccion', () => {
    const list = [
      'at point, X= 439250.3500  Y= 4479664.5500  Z= 0.0000',
      'at point, X= 439260.1000  Y= 4479670.2000  Z= 0.0000',
    ]
    const { anillos, detecciones } = extraerPares(list)
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
    ])
    const z = detecciones.filter((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)
    expect(z).toHaveLength(1)
    expect(z[0].datos).toEqual({ vertices: 2 })
  })

  it('sin Z: no emite Deteccion Z_DESCARTADA', () => {
    const { detecciones } = extraerPares(['439250.35 4479664.55', '439260.10 4479670.20'])
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)).toBe(false)
  })

  it('parte en varios anillos por la palabra `separador` (case-insensitive) y lo detecta', () => {
    const lineas = [
      '439250.35 4479664.55',
      '439260.10 4479670.20',
      'SEPARADOR', // mayúsculas, con espacios el trim la deja exacta
      '  Separador  ', // se ignora como corte extra pero cuenta como corte
      '400000.00 4400000.00',
      '400010.00 4400010.00',
    ]
    const { anillos, detecciones } = extraerPares(lineas)
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
      [
        [400000.0, 4400000.0],
        [400010.0, 4400010.0],
      ],
    ])
    // Dos líneas `separador` → dos detecciones SEPARADOR_POLIGONO (una por corte).
    const cortes = detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_POLIGONO)
    expect(cortes).toHaveLength(2)
  })

  it('un `separador` simple divide en exactamente 2 anillos con 1 detección', () => {
    const { anillos, detecciones } = extraerPares([
      '10.0 20.0',
      'separador',
      '30.0 40.0',
    ])
    expect(anillos).toHaveLength(2)
    expect(detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_POLIGONO)).toHaveLength(1)
  })

  it('acepta indistintamente un string crudo o un array de líneas', () => {
    const comoString = extraerPares('439250.35 4479664.55\n439260.10 4479670.20')
    const comoArray = extraerPares(['439250.35 4479664.55', '439260.10 4479670.20'])
    expect(comoString.anillos).toEqual(comoArray.anillos)
  })

  it('coma decimal autodetectada: parsea correctamente los pares', () => {
    const { anillos } = extraerPares(['439250,35 4479664,55', '439260,10 4479670,20'])
    expect(anillos).toEqual([
      [
        [439250.35, 4479664.55],
        [439260.1, 4479670.2],
      ],
    ])
  })

  it('LANZA ante entrada inválida (ni string ni array de strings) — regla de oro 1', () => {
    expect(() => extraerPares(42)).toThrow(TypeError)
    expect(() => extraerPares([1, 2])).toThrow(TypeError)
    expect(() => extraerPares('x', { separadorDecimal: ';' })).toThrow(RangeError)
  })

  it('entrada sin coordenadas → anillos vacío pero SEPARADOR_DECIMAL igualmente emitido', () => {
    const { anillos, detecciones } = extraerPares(['cabecera', 'sin numeros aqui'])
    expect(anillos).toEqual([])
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)).toBe(true)
  })
})

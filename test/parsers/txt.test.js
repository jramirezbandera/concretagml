/* -------------------------------------------------------------------------- *
 * test/parsers/txt.test.js — Parser TXT de dos columnas (F01, T2.2)           *
 *                                                                            *
 * Fixture REAL en disco: test/fixtures/parsers/PARCELA.txt (12 filas, dos     *
 * columnas por espacio, decimal '.', la última fila REPITE la primera →       *
 * anillo cerrado). El parser NO elimina el vértice de cierre: eso es del       *
 * orquestador aguas abajo. Cubre:                                             *
 *   - AC1: nº correcto de anillos (1) y vértices (12, incluida la fila de      *
 *     cierre duplicada que NO se quita); primer y último vértice coinciden.    *
 *   - separador decimal autodetectado = '.'; sin Z; origen = 'TXT'.           *
 *   - Blindaje de la autodetección coma-decimal + swap de sep. de columnas.   *
 *   - Regla de oro 1: entrada no-string → TypeError.                          *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { parseTXT } from '../../parsers/txt.js'
import { TIPO_DETECCION, SEVERIDAD } from '../../parsers/_comun.js'
import { ORIGEN_PARCELA } from '../../model/parcela.js'

// Fixture real leído de disco (texto crudo, tal cual lo exportaría el técnico).
const PARCELA_TXT = readFileSync(
  fileURLToPath(new URL('../fixtures/parsers/PARCELA.txt', import.meta.url)),
  'utf8',
)

// Valores verificados a mano contra el fixture (primer y último vértice).
const PRIMER_VERTICE = [298755.5889, 4090054.3788]
const ULTIMO_VERTICE = [298755.5889, 4090054.3788]

describe('parsers/txt — parseTXT sobre el fixture REAL PARCELA.txt', () => {
  it('AC1: un único anillo con 12 vértices (la fila de cierre NO se elimina)', () => {
    const { anillos } = parseTXT(PARCELA_TXT)
    expect(anillos).toHaveLength(1)
    expect(anillos[0]).toHaveLength(12)
  })

  it('AC1: primer y último vértice coinciden (anillo cerrado, se deja crudo)', () => {
    const [anillo] = parseTXT(PARCELA_TXT).anillos
    expect(anillo[0]).toEqual(PRIMER_VERTICE)
    expect(anillo.at(-1)).toEqual(ULTIMO_VERTICE)
    expect(anillo[0]).toEqual(anillo.at(-1)) // el parser NO normaliza el cierre
  })

  it('detecta el separador decimal como "." (columnas por espacio)', () => {
    const { detecciones } = parseTXT(PARCELA_TXT)
    const sep = detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep).toHaveLength(1)
    expect(sep[0].severidad).toBe(SEVERIDAD.INFO)
    expect(sep[0].datos).toEqual({ separador: '.', autodetectado: true })
  })

  it('no hay tercera coordenada: no emite Deteccion Z_DESCARTADA', () => {
    const { detecciones } = parseTXT(PARCELA_TXT)
    expect(detecciones.some((d) => d.tipo === TIPO_DETECCION.Z_DESCARTADA)).toBe(false)
  })

  it('estampa origen = "TXT" (ORIGEN_PARCELA.TXT)', () => {
    const res = parseTXT(PARCELA_TXT)
    expect(res.origen).toBe('TXT')
    expect(res.origen).toBe(ORIGEN_PARCELA.TXT)
  })

  it('devuelve el ResultadoParse completo: { anillos, detecciones, origen }', () => {
    const res = parseTXT(PARCELA_TXT)
    expect(Object.keys(res).sort()).toEqual(['anillos', 'detecciones', 'origen'])
    // POJO plano (regla de oro 4): coords crudas [x, y], sin métodos ni clases.
    expect(Object.getPrototypeOf(res)).toBe(Object.prototype)
    expect(Array.isArray(res.anillos[0][0])).toBe(true)
  })
})

describe('parsers/txt — autodetección coma-decimal + swap de separador de columnas', () => {
  it('decimal "," con columnas por ESPACIO: la coma es decimal, no delimitador', () => {
    // Caso peliagudo del enunciado: "298755,58 4090054,37" → un solo par [x, y].
    const txt = '298755,58 4090054,37\n298755,89 4090054,38'
    const { anillos, detecciones } = parseTXT(txt)
    expect(anillos).toEqual([
      [
        [298755.58, 4090054.37],
        [298755.89, 4090054.38],
      ],
    ])
    const sep = detecciones.find((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep.datos).toEqual({ separador: ',', autodetectado: true })
  })

  it('decimal "," con columnas por PUNTO Y COMA', () => {
    const { anillos } = parseTXT('298755,58;4090054,37\n298755,89;4090054,38')
    expect(anillos).toEqual([
      [
        [298755.58, 4090054.37],
        [298755.89, 4090054.38],
      ],
    ])
  })

  it('decimal "." con columnas por COMA (la coma delimita, el punto es decimal)', () => {
    const { anillos } = parseTXT('298755.58, 4090054.37\n298755.89, 4090054.38')
    expect(anillos).toEqual([
      [
        [298755.58, 4090054.37],
        [298755.89, 4090054.38],
      ],
    ])
  })

  it('respeta un separador decimal FORZADO por opts', () => {
    const { anillos, detecciones } = parseTXT('298755,58 4090054,37', { separadorDecimal: ',' })
    expect(anillos).toEqual([[[298755.58, 4090054.37]]])
    const sep = detecciones.find((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep.datos).toEqual({ separador: ',', autodetectado: false })
  })

  it('⛔ H5 (2026-08-15) · ENTEROS con coma de columna: «439250,4479664» parsea, no muere en SIN_GEOMETRIA', () => {
    // Antes, la coma «ganaba» como decimal (1 a 0), cada línea se fundía en UN
    // número (439250.4479664), todas se saltaban (<2 números) y el resultado era
    // anillos: [] → SIN_GEOMETRIA con un motivo falso. La doc del propio
    // _comun.js afirmaba que este caso daba «dos enteros» — ahora es verdad.
    const { anillos, detecciones } = parseTXT('439250,4479664\n439260,4479670\n439270,4479680')
    expect(anillos).toEqual([
      [
        [439250, 4479664],
        [439260, 4479670],
        [439270, 4479680],
      ],
    ])
    const sep = detecciones.find((d) => d.tipo === TIPO_DETECCION.SEPARADOR_DECIMAL)
    expect(sep.datos.separador).toBe('.')
  })

  it('⛔ H5 · formato español con miles: «439.250,35 4.479.664,55» → un par, no confeti', () => {
    const { anillos } = parseTXT('439.250,35 4.479.664,55')
    expect(anillos).toEqual([[[439250.35, 4479664.55]]])
  })

  it('H1 · una LISTA con arcos que entra por la vía TXT AVISA de que el arco queda como cuerda', () => {
    // parseTXT no discretiza (eso es de parseLIST con geo/arco.js), pero tragarse
    // la Curvatura en silencio era el defecto: ahora al menos se dice.
    const lista = [
      'Ubicación:  X= 0.0  Y= 0.0  Z= 0.0',
      'Curvatura: 1.0000',
      'Centro: X= 5.0  Y= 0.0  Z= 0.0',
      'Radio: 5.0',
      'Ubicación:  X= 10.0  Y= 0.0  Z= 0.0',
    ].join('\n')
    const { anillos, detecciones } = parseTXT(lista)
    expect(anillos).toEqual([
      [
        [0, 0],
        [10, 0],
      ],
    ]) // sin vértice fantasma del Centro
    const aviso = detecciones.find(
      (d) => d.tipo === TIPO_DETECCION.ARCO_DISCRETIZADO && d.severidad === SEVERIDAD.AVISO,
    )
    expect(aviso).toBeTruthy()
    expect(aviso.mensaje).toMatch(/cuerda/)
    expect(aviso.datos).toEqual({ arcos: 1, aplicado: false })
  })

  it('la palabra `separador` en línea propia divide en dos anillos', () => {
    const { anillos, detecciones } = parseTXT('10.0 20.0\nseparador\n30.0 40.0')
    expect(anillos).toEqual([[[10, 20]], [[30, 40]]])
    expect(
      detecciones.filter((d) => d.tipo === TIPO_DETECCION.SEPARADOR_POLIGONO),
    ).toHaveLength(1)
  })
})

describe('parsers/txt — regla de oro 1: sin decisiones silenciosas', () => {
  it('LANZA (TypeError) si `texto` no es un string', () => {
    expect(() => parseTXT(42)).toThrow(TypeError)
    expect(() => parseTXT(['298755.58 4090054.37'])).toThrow(TypeError) // array NO es válido
    expect(() => parseTXT(null)).toThrow(TypeError)
    expect(() => parseTXT(undefined)).toThrow(TypeError)
    expect(() => parseTXT({})).toThrow(TypeError)
  })

  it('LANZA (RangeError) si opts.separadorDecimal no es "," ni "."', () => {
    expect(() => parseTXT('10 20', { separadorDecimal: ';' })).toThrow(RangeError)
  })
})

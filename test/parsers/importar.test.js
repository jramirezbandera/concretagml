/* -------------------------------------------------------------------------- *
 * test/parsers/importar.test.js — Orquestador de importación (F01, T3.1)      *
 *                                                                            *
 * Tarea de INTEGRACIÓN de F01: importar() convierte los detectores puros de   *
 * F00 en un informe accionable. Se apoya en los fixtures REALES               *
 * (LIST.txt / PARCELA.txt, misma parcela, huso 30, ~298755/4090054) y en      *
 * casos SINTÉTICOS inline para los detectores defensivos (criterio de         *
 * aceptación 3: "ninguna se arregla en silencio").                            *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import { importar } from '../../parsers/importar.js'
import { TIPO_DETECCION, SEVERIDAD } from '../../parsers/_comun.js'
import { ORIGEN_PARCELA, TIPO_RECINTO } from '../../model/parcela.js'

const leer = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const LIST_REAL = leer('../fixtures/parsers/LIST.txt')
const PARCELA_REAL = leer('../fixtures/parsers/PARCELA.txt')
const DXF_REAL = leer('../fixtures/parsers/UTM.dxf')

/** Helpers de filtrado de detecciones. */
const porTipo = (dets, tipo) => dets.filter((d) => d.tipo === tipo)
const infoHuso = (dets) =>
  dets.find((d) => d.tipo === TIPO_DETECCION.HUSO_DETECTADO && d.severidad === SEVERIDAD.INFO)

// ── Construir un volcado TXT de dos columnas a partir de un anillo ────────────
const aTXT = (anillo) => anillo.map(([x, y]) => `${x} ${y}`).join('\n')

// ════════════════════════════════════════════════════════════════════════════
describe('parsers/importar — fixtures REALES (LIST / PARCELA)', () => {
  it('LIST: produce parcela con 1 anillo EXTERIOR de 11 vértices, origen LIST', () => {
    const { parcela, anillos, resumen } = importar(LIST_REAL)
    expect(resumen.nAnillos).toBe(1)
    expect(anillos[0]).toHaveLength(11)
    expect(parcela).not.toBeNull()
    expect(parcela.recintos).toHaveLength(1)
    expect(parcela.recintos[0].tipo).toBe(TIPO_RECINTO.EXTERIOR)
    expect(parcela.recintos[0].vertices).toHaveLength(11)
    expect(parcela.origen).toBe(ORIGEN_PARCELA.LIST)
    expect(resumen.construida).toBe(true)
    expect(resumen.bloqueos).toEqual([])
  })

  it('LIST: autodetecta el formato como LIST', () => {
    const { resumen } = importar(LIST_REAL)
    expect(resumen.formato).toBe('LIST')
    expect(resumen.formatoAutodetectado).toBe(true)
  })

  it('LIST: detectarHuso devuelve zona 30 y el punto de caída sale como INFO', () => {
    const { detecciones, resumen } = importar(LIST_REAL)
    expect(resumen.huso.zona).toBe(30)
    expect(resumen.huso.srs).toBe('EPSG:25830')

    const info = infoHuso(detecciones)
    expect(info).toBeTruthy()
    expect(info.datos.zona).toBe(30)
    expect(typeof info.datos.lon).toBe('number')
    expect(typeof info.datos.lat).toBe('number')
    // Cae en la Península (lon ~ -5.26, lat ~ 36.94).
    expect(info.datos.lon).toBeCloseTo(-5.2597, 3)
    expect(info.datos.lat).toBeCloseTo(36.9351, 3)
  })

  it('LIST: huso ambiguo por defecto (30 vs 31) → AVISO extra con los candidatos', () => {
    const { detecciones, resumen } = importar(LIST_REAL)
    expect(resumen.huso.ambiguo).toBe(true)
    const aviso = detecciones.find(
      (d) => d.tipo === TIPO_DETECCION.HUSO_AMBIGUO && d.severidad === SEVERIDAD.AVISO,
    )
    expect(aviso).toBeTruthy()
    expect(aviso.datos.candidatos.map((c) => c.zona)).toEqual([30, 31])
  })

  it('LIST con opts.huso=30: verifica sin ambigüedad (un único HUSO INFO)', () => {
    const { detecciones, resumen } = importar(LIST_REAL, { huso: 30 })
    expect(resumen.huso.ambiguo).toBe(false)
    // Huso forzado y no ambiguo: 1 punto de caída (HUSO_DETECTADO) y CERO HUSO_AMBIGUO.
    expect(porTipo(detecciones, TIPO_DETECCION.HUSO_DETECTADO)).toHaveLength(1)
    expect(porTipo(detecciones, TIPO_DETECCION.HUSO_AMBIGUO)).toHaveLength(0)
    expect(infoHuso(detecciones).datos.zona).toBe(30)
  })

  it('LIST: coteja la superficie (shoelace propio) contra la meta reportada', () => {
    const { resumen } = importar(LIST_REAL)
    expect(resumen.superficie).not.toBeNull()
    expect(resumen.superficie.reportada).toBe(61.045)
    expect(resumen.superficie.calculada).toBeCloseTo(61.045, 2)
    expect(resumen.superficie.coincide).toBe(true) // divergencia ~5e-7 << umbral
  })

  it('LIST: ARRASTRA las detecciones del parser (SEPARADOR_DECIMAL, Z_DESCARTADA)', () => {
    const { detecciones } = importar(LIST_REAL)
    expect(porTipo(detecciones, TIPO_DETECCION.SEPARADOR_DECIMAL)).toHaveLength(1)
    expect(porTipo(detecciones, TIPO_DETECCION.Z_DESCARTADA)).toHaveLength(1)
  })

  it('PARCELA.txt: mismo polígono; vértice de cierre duplicado → 11 vértices ABIERTOS', () => {
    // El fichero trae 12 vértices (el último == el primero). El modelo guarda
    // anillos ABIERTOS (regla 4): se retira el duplicado exacto sin ruido.
    const { parcela, anillos, resumen } = importar(PARCELA_REAL)
    expect(resumen.formato).toBe('TXT')
    expect(anillos[0]).toHaveLength(11)
    expect(parcela.recintos[0].vertices).toHaveLength(11)
    // Duplicado EXACTO → NO se emite Deteccion CIERRE (normalización trivial).
    expect(porTipo(importar(PARCELA_REAL).detecciones, TIPO_DETECCION.CIERRE)).toHaveLength(0)
  })

  it('LIST y PARCELA.txt describen la MISMA parcela (misma superficie shoelace)', () => {
    const a = importar(LIST_REAL).parcela.recintos[0].vertices
    const b = importar(PARCELA_REAL).parcela.recintos[0].vertices
    expect(b).toEqual(a) // los 11 vértices coinciden vértice a vértice
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('parsers/importar — detectores defensivos SINTÉTICOS (nada en silencio)', () => {
  // Cuadrado UTM con X/Y invertidas: |Este|>1e6, |Norte|<1e6 en TODOS los vértices.
  const ANILLO_SWAP = [
    [4000000, 500000],
    [4000000, 500010],
    [4000010, 500010],
    [4000010, 500000],
  ]

  it('SWAP_XY: todo el anillo invertido → Deteccion SWAP_XY + oferta; NADA aplicado por defecto', () => {
    const { anillos, detecciones, parcela, resumen } = importar(aTXT(ANILLO_SWAP), { formato: 'TXT' })
    const swap = porTipo(detecciones, TIPO_DETECCION.SWAP_XY)
    expect(swap).toHaveLength(1)
    expect(swap[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(swap[0].datos.aplicado).toBe(false)
    // Se OFRECE el anillo intercambiado como dato...
    expect(swap[0].datos.anilloIntercambiado).toEqual([
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
    ])
    // ...pero el anillo devuelto sigue SIN intercambiar (nada corregido en silencio).
    expect(anillos[0]).toEqual(ANILLO_SWAP)
    // Coords no-UTM → huso no resuelto → parcela bloqueada (pero SÍ informe).
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toContain('HUSO_NO_RESUELTO')
  })

  it('SWAP_XY con opts.intercambiarXY: aplica el swap y construye la parcela', () => {
    const { anillos, parcela, resumen } = importar(aTXT(ANILLO_SWAP), {
      formato: 'TXT',
      intercambiarXY: true,
    })
    expect(anillos[0]).toEqual([
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
    ])
    expect(parcela).not.toBeNull()
    expect(resumen.huso.zona).toBe(30)
  })

  it('SWAP_XY inconsistente (solo algunos vértices) → AVISO de datos sospechosos, NO intercambia', () => {
    const mixto = [
      [4000000, 500000], // invertido
      [500010, 4000000], // normal
      [4000010, 500010], // invertido
      [500000, 4000010], // normal
    ]
    const { anillos, detecciones } = importar(aTXT(mixto), { formato: 'TXT' })
    const swap = porTipo(detecciones, TIPO_DETECCION.SWAP_XY)
    expect(swap).toHaveLength(1)
    expect(swap[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(swap[0].datos.conSwap).toBe(2)
    expect(swap[0].datos.total).toBe(4)
    expect(anillos[0]).toEqual(mixto) // intacto
  })

  it('GRADOS: anillo entero en grados → Deteccion GRADOS, sin reproyectar, parcela bloqueada', () => {
    const grados = [
      [-5.3, 36.9],
      [-5.2, 36.9],
      [-5.2, 37.0],
      [-5.3, 37.0],
    ]
    const { anillos, detecciones, parcela, resumen } = importar(aTXT(grados), { formato: 'TXT' })
    const g = porTipo(detecciones, TIPO_DETECCION.GRADOS)
    expect(g).toHaveLength(1)
    expect(g[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(g[0].datos.reproyectar).toBe(true)
    // NO se reproyecta (regla 3): el anillo se devuelve intacto, en grados.
    expect(anillos[0]).toEqual(grados)
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toContain('COORDENADAS_EN_GRADOS')
    // El centroide en grados no cae en España → AVISO de huso (fueraDeEspana).
    expect(resumen.huso).toBeNull()
    const husoAviso = detecciones.find(
      (d) => d.tipo === TIPO_DETECCION.HUSO_DETECTADO && d.datos && d.datos.fueraDeEspana,
    )
    expect(husoAviso.severidad).toBe(SEVERIDAD.AVISO)
  })

  it('GRADOS inconsistente → AVISO de datos sospechosos (no todo el anillo es grados)', () => {
    const mixto = [
      [-5, 36],
      [-5, 4000000], // no es grados (|4e6|>1000)
      [-4, 37],
      [-4, 36],
    ]
    const { detecciones } = importar(aTXT(mixto), { formato: 'TXT' })
    const g = porTipo(detecciones, TIPO_DETECCION.GRADOS)
    expect(g).toHaveLength(1)
    expect(g[0].datos.conGrados).toBe(3)
    expect(g[0].datos.total).toBe(4)
  })

  it('GRADOS en un HUECO (no solo el exterior) también bloquea el modelo (revisión F01)', () => {
    // Exterior UTM válido + un hueco entero en grados (partido con `separador`):
    // unidades mezcladas → el modelo NO se construye aunque el exterior sea correcto.
    const txt =
      '298750 4090050\n298760 4090050\n298760 4090060\n298750 4090060\n' +
      'separador\n' +
      '-5.00 36.90\n-5.00 36.91\n-5.01 36.90\n'
    const { parcela, resumen, detecciones } = importar(txt, { formato: 'TXT' })
    expect(resumen.nAnillos).toBe(2)
    expect(resumen.bloqueos).toContain('COORDENADAS_EN_GRADOS')
    expect(parcela).toBeNull()
    // Y el hueco en grados quedó reportado (nada en silencio).
    expect(porTipo(detecciones, TIPO_DETECCION.GRADOS).length).toBeGreaterThan(0)
  })

  it('CIERRE: anillo con error de cierre apreciable → Deteccion CIERRE + compensado disponible, NO aplicado', () => {
    // Cuadrado 10×10 cuyo vértice de cierre queda a ~0.10 m del primero.
    const casiCerrado = [
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
      [500000.08, 4000000.06], // vértice de cierre off ~0.10 m
    ]
    const { anillos, detecciones, parcela } = importar(aTXT(casiCerrado), { formato: 'TXT' })
    const cierre = porTipo(detecciones, TIPO_DETECCION.CIERRE)
    expect(cierre).toHaveLength(1)
    expect(cierre[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(cierre[0].datos.error).toBeCloseTo(0.1, 3) // error MEDIDO
    // Banda ambigua: por defecto NO se toca la geometría ("ofrecer, no tocar").
    expect(cierre[0].datos.aplicado).toBe('NINGUNO')
    // Se OFRECEN las dos lecturas como dato: retirar el vértice / compensar.
    expect(cierre[0].datos.anilloSinCierre).toHaveLength(4)
    expect(cierre[0].datos.anilloCompensado).toHaveLength(4)
    // El anillo devuelto es el CRUDO intacto (Vúltimo conservado, 5 vértices).
    expect(anillos[0]).toEqual(casiCerrado)
    expect(parcela).not.toBeNull() // cae en huso 30 → se construye (con el vértice ambiguo)
  })

  it('CIERRE con opts.compensarCierre: aplica la compensación al modelo', () => {
    const casiCerrado = [
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
      [500000.08, 4000000.06],
    ]
    const { anillos, detecciones } = importar(aTXT(casiCerrado), {
      formato: 'TXT',
      compensarCierre: true,
    })
    const cierre = porTipo(detecciones, TIPO_DETECCION.CIERRE)[0]
    expect(cierre.datos.aplicado).toBe('COMPENSADO')
    expect(anillos[0]).toHaveLength(4)
    // El primer vértice queda fijo; los demás se han movido (Bowditch).
    expect(anillos[0][0]).toEqual([500000, 4000000])
    expect(anillos[0][1][0]).not.toBe(500010) // corregido
  })

  it('CIERRE con opts.retirarCierre: retira el vértice de cierre SIN compensar', () => {
    const casiCerrado = [
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
      [500000.08, 4000000.06],
    ]
    const { anillos, detecciones } = importar(aTXT(casiCerrado), {
      formato: 'TXT',
      retirarCierre: true,
    })
    const cierre = porTipo(detecciones, TIPO_DETECCION.CIERRE)[0]
    expect(cierre.datos.aplicado).toBe('RETIRADO')
    // Se retira Vúltimo sin mover el resto (no es Bowditch): quedan los 4 originales.
    expect(anillos[0]).toEqual([
      [500000, 4000000],
      [500010, 4000000],
      [500010, 4000010],
      [500000, 4000010],
    ])
  })

  it('CIERRE: anillo ABIERTO con arista de cierre REAL (grande) → INFO, geometría intacta', () => {
    // Triángulo abierto: v0..vLast distan ~33 m (> ventana) → es una arista real,
    // no un misclosure. Se deja constancia (INFO) pero NO se altera la geometría.
    const triangulo = [
      [500000, 4000000],
      [500030, 4000000],
      [500015, 4000030],
    ]
    const { anillos, detecciones } = importar(aTXT(triangulo), { formato: 'TXT' })
    const cierre = porTipo(detecciones, TIPO_DETECCION.CIERRE)
    expect(cierre).toHaveLength(1)
    expect(cierre[0].severidad).toBe(SEVERIDAD.INFO)
    expect(cierre[0].datos.interpretacion).toBe('ABIERTO')
    expect(anillos[0]).toEqual(triangulo) // geometría sin tocar
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('parsers/importar — el informe siempre existe; un dato malo no lanza', () => {
  it('un dato malo (grados) NO lanza: devuelve informe con detecciones y parcela null', () => {
    let out
    expect(() => {
      out = importar('-5 36\n-5 37\n-4 37\n-4 36', { formato: 'TXT' })
    }).not.toThrow()
    expect(out.parcela).toBeNull()
    expect(out.detecciones.length).toBeGreaterThan(0)
    expect(out.resumen.detecciones.total).toBe(out.detecciones.length)
  })

  it('el informe SIEMPRE aborda el huso: para dato bueno, punto de caída presente (INFO)', () => {
    const { resumen, detecciones } = importar(LIST_REAL)
    expect(resumen.huso).not.toBeNull()
    expect(infoHuso(detecciones)).toBeTruthy()
  })

  it('el resumen lleva recuentos por tipo y severidad coherentes con las detecciones', () => {
    const { detecciones, resumen } = importar(LIST_REAL)
    const info = detecciones.filter((d) => d.severidad === SEVERIDAD.INFO).length
    const aviso = detecciones.filter((d) => d.severidad === SEVERIDAD.AVISO).length
    expect(resumen.detecciones.porSeveridad.INFO).toBe(info)
    expect(resumen.detecciones.porSeveridad.AVISO).toBe(aviso)
  })
})

// ════════════════════════════════════════════════════════════════════════════
describe('parsers/importar — formato, DXF y contrato de errores', () => {
  it('autodetecta DXF y ARRASTRA las detecciones del parser (entidades no soportadas)', () => {
    const { resumen, detecciones, parcela } = importar(DXF_REAL)
    expect(resumen.formato).toBe('DXF')
    expect(resumen.formatoAutodetectado).toBe(true)
    expect(resumen.origen).toBe(ORIGEN_PARCELA.DXF)
    expect(porTipo(detecciones, TIPO_DETECCION.ENTIDAD_NO_SOPORTADA).length).toBeGreaterThan(0)
    expect(parcela).not.toBeNull()
  })

  it('respeta el formato EXPLÍCITO (no autodetecta)', () => {
    const { resumen } = importar(PARCELA_REAL, { formato: 'TXT' })
    expect(resumen.formato).toBe('TXT')
    expect(resumen.formatoAutodetectado).toBe(false)
  })

  it('entrada no-string → TypeError (error de programación, no de dato)', () => {
    expect(() => importar(42)).toThrow(TypeError)
    expect(() => importar(null)).toThrow(TypeError)
  })

  it('opts.formato inválido → RangeError; opts.huso inválido → RangeError', () => {
    expect(() => importar('1 2\n3 4', { formato: 'CSV' })).toThrow(RangeError)
    expect(() => importar('1 2\n3 4', { huso: 28 })).toThrow(RangeError) // Canarias diferido
  })

  it('devuelve POJO plano (regla de oro 4): sin prototipos de clase', () => {
    const r = importar(LIST_REAL)
    expect(Object.getPrototypeOf(r)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(r.resumen)).toBe(Object.prototype)
    expect(Object.getPrototypeOf(r.anillos[0][0])).toBe(Array.prototype)
    expect(Object.getPrototypeOf(r.parcela)).toBe(Object.prototype)
  })
})

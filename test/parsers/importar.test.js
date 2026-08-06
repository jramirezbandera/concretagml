/* -------------------------------------------------------------------------- *
 * test/parsers/importar.test.js — Orquestador de importación (F01, T3.1)      *
 *                                                                            *
 * Tarea de INTEGRACIÓN de F01: importar() convierte los detectores puros de   *
 * F00 en un informe accionable. Se apoya en los fixtures REALES               *
 * (LIST.txt / PARCELA.txt, misma parcela, huso 30, ~298755/4090054) y en      *
 * casos SINTÉTICOS inline para los detectores defensivos (criterio de         *
 * aceptación 3: "ninguna se arregla en silencio").                            *
 *                                                                            *
 * ⛔ F11 añade el bloque «reparto por capas», que arregla un defecto VIVO:    *
 * hasta el 2026-08-03 `importar(UTM.dxf)` devolvía una parcela de −390,45 m²  *
 * con `bloqueos: []` y `construida: true`. Ver la cabecera de importar.js.    *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { describe, it, expect } from 'vitest'

import {
  importar,
  BLOQUEOS,
  BLOQUEOS_SOLO_PARCELA,
  sinDeteccionesDeParcela,
} from '../../parsers/importar.js'
import { TIPO_DETECCION, SEVERIDAD } from '../../parsers/_comun.js'
import { ORIGEN_PARCELA, TIPO_RECINTO } from '../../model/parcela.js'
import { superficie } from '../../geo/area.js'
import { CAPAS, serializarParcelaDxf } from '../../export/dxf.js'

const leer = (rel) => readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8')
const LIST_REAL = leer('../fixtures/parsers/LIST.txt')
const PARCELA_REAL = leer('../fixtures/parsers/PARCELA.txt')
const DXF_REAL = leer('../fixtures/parsers/UTM.dxf')
const DXF_EDIFICIO = leer('../fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf')

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
    // NO se reproyecta MIENTRAS NO SE PIDA: el anillo se devuelve intacto, en grados.
    expect(anillos[0]).toEqual(grados)
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toContain('COORDENADAS_EN_GRADOS')

    // ⛔ RETRACTADO EN F19, y se deja escrito porque el error es instructivo.
    // Aquí decía: «El centroide en grados no cae en España → AVISO de huso
    // (fueraDeEspana)», y exigía `resumen.huso === null` y ese aviso. Las dos
    // afirmaciones eran ciertas sobre el código y FALSAS sobre el mundo: este
    // cuadrado está en la provincia de Cádiz. `detectarHuso` trataba los grados
    // como metros y desproyectaba un disparate, así que la aplicación rechazaba
    // el fichero por un motivo inventado. **Un guardián en verde puede estar
    // defendiendo el defecto** (F11 M28-M30, F18): este llevaba desde F01.
    expect(resumen.huso).not.toBeNull()
    expect(resumen.huso.zona).toBe(30) // lo dice la LONGITUD, no una desproyección
    expect(resumen.huso.ambiguo).toBe(false) // en grados no hay ambigüedad de huso
    expect(
      detecciones.some((d) => d.datos && d.datos.fueraDeEspana),
    ).toBe(false)
    // Y el único bloqueo es el que de verdad hay: están en grados. Decir además
    // «no se ha podido resolver el huso» sería contradecir la frase de al lado.
    expect(resumen.bloqueos).not.toContain('HUSO_NO_RESUELTO')
    expect(g[0].mensaje).toMatch(/huso 30/)
    expect(g[0].datos.situacion.region).toBe('PENINSULA_BALEARES')
  })

  it('GRADOS: con `proyectarGrados` se proyecta, y las dos lecturas caen en el mismo sitio', () => {
    // El mismo punto escrito en los dos órdenes que llegan de un CAD o un GPS.
    const lonLat = [
      [-4.42143, 36.7213],
      [-4.42133, 36.7213],
      [-4.42133, 36.7214],
      [-4.42143, 36.7214],
    ]
    const latLon = lonLat.map(([lon, lat]) => [lat, lon])

    const a = importar(aTXT(lonLat), { formato: 'TXT', proyectarGrados: true })
    const b = importar(aTXT(latLon), { formato: 'TXT', proyectarGrados: true })

    expect(a.resumen.construida).toBe(true)
    expect(b.resumen.construida).toBe(true)
    expect(a.resumen.bloqueos).toEqual([])
    // ⭐ El orden de las columnas NO se pregunta y no hace falta: los rangos de
    // España son disjuntos (lon ∈ [−9,5 · 4,5], lat ∈ [35,5 · 44,5]), así que solo
    // una de las dos lecturas cae dentro. Las dos entradas dan la MISMA parcela.
    expect(b.anillos[0]).toEqual(a.anillos[0])
    expect(a.anillos[0][0][0]).toBeCloseTo(373062.9068, 4)
    expect(a.anillos[0][0][1]).toBeCloseTo(4064897.5821, 4)
    // Y el huso con el que se proyectó no vuelve a «deducirse»: se verifica.
    expect(a.resumen.huso.zona).toBe(30)
    expect(a.resumen.huso.ambiguo).toBe(false)
    const proyectadas = porTipo(a.detecciones, TIPO_DETECCION.GRADOS)
    expect(proyectadas).toHaveLength(1)
    expect(proyectadas[0].severidad).toBe(SEVERIDAD.INFO) // ya no es un aviso: está hecho
    expect(proyectadas[0].datos.aplicado).toBe(true)
    expect(porTipo(b.detecciones, TIPO_DETECCION.GRADOS)[0].mensaje).toMatch(
      /\(latitud, longitud\)/,
    )
  })

  it('GRADOS: Canarias se NOMBRA y no se proyecta, aunque se pida (O13)', () => {
    const canarias = [
      [-15.42, 28.12],
      [-15.419, 28.12],
      [-15.419, 28.121],
      [-15.42, 28.121],
    ]
    const { parcela, resumen, detecciones, anillos } = importar(aTXT(canarias), {
      formato: 'TXT',
      proyectarGrados: true, // se pide, y aun así NO se proyecta
    })
    expect(parcela).toBeNull()
    expect(anillos[0]).toEqual(canarias) // intacto
    expect(resumen.bloqueos).toContain('COORDENADAS_EN_GRADOS')
    const g = porTipo(detecciones, TIPO_DETECCION.GRADOS)[0]
    // Lo que importa: se dice CANARIAS. Dejarla caer en «fuera de España» sería
    // cierto de una forma inútil, y el usuario no sabría qué ha pasado.
    expect(g.mensaje).toMatch(/Canarias/)
    expect(g.datos.situacion.region).toBe('CANARIAS')
    expect(g.datos.situacion.zona).toBe(28)
    expect(g.datos.situacion.proyectable).toBe(false)
  })

  it('GRADOS: lo que no cae en ningún territorio conocido lo dice, sin inventarse un huso', () => {
    const paris = [
      [2.2945, 48.8582],
      [2.2946, 48.8582],
      [2.2946, 48.8583],
      [2.2945, 48.8583],
    ]
    const { resumen, detecciones } = importar(aTXT(paris), {
      formato: 'TXT',
      proyectarGrados: true,
    })
    expect(resumen.construida).toBe(false)
    expect(resumen.huso).toBeNull()
    expect(resumen.bloqueos).toContain('HUSO_NO_RESUELTO') // aquí SÍ es verdad
    const g = porTipo(detecciones, TIPO_DETECCION.GRADOS)[0]
    expect(g.datos.situacion.region).toBe('FUERA')
    expect(g.mensaje).toMatch(/los dos órdenes/)
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
    // ⛔ CAMBIADO EN F11. Hasta el 2026-08-03 aquí ponía `expect(parcela).not.toBeNull()`
    // y era exactamente el defecto: la parcela que salía medía −390,45 m². Con 25
    // anillos en 5 capas ya NO se construye; el bloque «reparto por capas» de abajo
    // lo cuenta entero, y con `opts.capa` sí sale la parcela buena.
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toContain(BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS)
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

// ════════════════════════════════════════════════════════════════════════════
// F11 · EL REPARTO POR CAPAS — y el defecto de la superficie negativa
// ════════════════════════════════════════════════════════════════════════════
//
// Este bloque entero existe por una medición: `importar(UTM.dxf)` devolvía
// −390,45 m² con `bloqueos: []`, y nadie lo veía porque NO HABÍA una sola prueba
// que mirase la superficie de una parcela venida de un DXF. La tenía que haber.

describe('parsers/importar — capas[] (contrato B)', () => {
  it('DXF: `capas` sale en el objeto y en el resumen, 1:1 con los anillos', () => {
    const r = importar(DXF_REAL)
    expect(r.capas).toHaveLength(r.anillos.length)
    expect(r.resumen.capas).toEqual(r.capas)
    expect(r.resumen.nVertices).toHaveLength(r.capas.length)
  })

  it('UTM.dxf: el reparto exacto — FINO 16 · LINDE 4 · PARCELA 3 · BLANCO 1 · 0 ⇢ 1', () => {
    const { detecciones, capas } = importar(DXF_REAL)
    const reparto = {}
    for (const c of capas) reparto[c] = (reparto[c] || 0) + 1
    expect(reparto).toEqual({ FINO: 16, LINDE: 4, PARCELA: 3, BLANCO: 1, 0: 1 })

    // Y el reparto se DICE, no solo se devuelve (regla de oro 1): la detección
    // lleva las cinco capas con su recuento y nombra la decisión que no se toma.
    const det = porTipo(detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO)[0]
    expect(det.severidad).toBe(SEVERIDAD.AVISO)
    expect(det.datos.capas).toEqual({ FINO: 16, LINDE: 4, PARCELA: 3, BLANCO: 1, 0: 1 })
    expect(det.datos.nCapas).toBe(5)
    expect(det.datos.aplicado).toBe('NINGUNO')
    expect(det.mensaje).toContain('25 polilínea(s) en 5 capa(s)')
    expect(det.mensaje).toContain('«FINO» ⇢ 16')
    expect(det.mensaje).toMatch(/no se adivina/i)
  })

  it('edificio real: 8 anillos en 2 capas — «Construccion» ⇢ 7, «Parcela» ⇢ 1', () => {
    const { capas, detecciones } = importar(DXF_EDIFICIO)
    expect(capas.filter((c) => c === 'Construccion')).toHaveLength(7)
    expect(capas.filter((c) => c === 'Parcela')).toHaveLength(1)
    const det = porTipo(detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO)[0]
    expect(det.datos.capas).toEqual({ Construccion: 7, Parcela: 1 })
  })

  it('LIST y TXT: `capas` son cadenas vacías, y NO se emite detección de reparto', () => {
    // No tienen el concepto de capa; inventarle una sería adivinar. Y el array
    // existe igual para que quien recorra `capas[i]` no se tope con `undefined`.
    for (const texto of [LIST_REAL, PARCELA_REAL]) {
      const r = importar(texto)
      expect(r.capas).toEqual(r.anillos.map(() => ''))
      expect(porTipo(r.detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO)).toHaveLength(0)
      expect(r.resumen.bloqueos).toEqual([]) // el camino feliz de F01, intacto
    }
  })
})

describe('parsers/importar — ⛔ el defecto: superficies NEGATIVAS en silencio', () => {
  it('⭐ UTM.dxf ya NO da −390,45 m²: bloquea nombrando el reparto, no construye', () => {
    const { parcela, resumen } = importar(DXF_REAL)
    expect(parcela).toBeNull()
    expect(resumen.construida).toBe(false)
    expect(resumen.bloqueos).toEqual([
      BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS,
      BLOQUEOS.SUPERFICIE_NO_POSITIVA,
    ])
  })

  it('⭐ y con la capa elegida sale la parcela BUENA: 61,05 m², la de PARCELA.txt', () => {
    // La verdad externa: el anillo de la capa `0` es el mismo polígono que
    // `PARCELA.txt` (F01), vértice a vértice. Ésa es la parcela; los otros 24
    // anillos son lindes, cajetín, marco y leyenda.
    const { parcela, resumen, capas } = importar(DXF_REAL, { capa: '0' })
    expect(resumen.bloqueos).toEqual([])
    expect(resumen.construida).toBe(true)
    expect(capas).toEqual(['0'])
    expect(superficie(parcela.recintos)).toBeCloseTo(61.045, 2)

    // Los 11 vértices, uno a uno y en el mismo orden, contra el volcado de
    // coordenadas. Se comparan a 4 decimales (0,1 mm) y no con `toEqual` porque
    // el DXF guarda más cifras que el TXT: `PARCELA.txt` viene redondeado a 4.
    const delTxt = importar(PARCELA_REAL).parcela.recintos[0].vertices
    const delDxf = parcela.recintos[0].vertices
    expect(delDxf).toHaveLength(delTxt.length)
    delDxf.forEach(([x, y], i) => {
      expect(x).toBeCloseTo(delTxt[i][0], 4)
      expect(y).toBeCloseTo(delTxt[i][1], 4)
    })
  })

  it('⛔ elegir capa NO basta: «PARCELA» son 3 anillos disjuntos y dan −29,06 m²', () => {
    // Por esto hacen falta los DOS guardas. La capa literalmente llamada
    // «PARCELA» no contiene la parcela: contiene tres lindes sueltos, y el
    // reparto «uno exterior + N huecos» sigue sin sostenerse dentro de una capa.
    const { parcela, resumen, detecciones } = importar(DXF_REAL, { capa: 'PARCELA' })
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toEqual([BLOQUEOS.SUPERFICIE_NO_POSITIVA])
    expect(resumen.bloqueos).not.toContain(BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS) // ya es una sola
    const aviso = porTipo(detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO).find(
      (d) => d.datos && typeof d.datos.superficie === 'number',
    )
    expect(aviso.severidad).toBe(SEVERIDAD.AVISO)
    expect(aviso.datos.superficie).toBeCloseTo(-29.06, 1)
    expect(aviso.mensaje).toContain('-29.06 m²') // la cifra, no un adjetivo
  })

  it('el DXF de dos capas que escribe export/dxf.js ya NO da −100,00 m²', () => {
    // El otro caso medido en la fase 0, y el que hace que esto no sea un problema
    // de «planos ajenos»: lo produce nuestro propio serializador.
    const cuadrado = (lado, dx = 0, dy = 0) => [
      [440123.45 + dx, 4470987.65 + dy],
      [440123.45 + dx + lado, 4470987.65 + dy],
      [440123.45 + dx + lado, 4470987.65 + dy + lado],
      [440123.45 + dx, 4470987.65 + dy + lado],
    ]
    const { dxf } = serializarParcelaDxf({
      recintosEditados: [
        { vertices: cuadrado(40), tipo: 'EXTERIOR' },
        { vertices: cuadrado(10, 10, 10), tipo: 'HUECO' },
      ],
      recintosOficiales: [{ vertices: cuadrado(40), tipo: 'EXTERIOR' }],
    })

    // Antes: 3 anillos → 1600 − 1600 − 100 = −100,00 m², con bloqueos: [].
    const crudo = importar(dxf)
    expect(crudo.parcela).toBeNull()
    expect(crudo.resumen.bloqueos).toContain(BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS)

    // Y la asimetría que dejó escrita F10 se cierra: pidiendo la capa EDITADA
    // vuelve la geometría del usuario, exterior y hueco, con sus 1.500 m².
    const editada = importar(dxf, { capa: CAPAS.EDITADA.nombre })
    expect(editada.resumen.bloqueos).toEqual([])
    expect(editada.capas).toEqual([CAPAS.EDITADA.nombre, CAPAS.EDITADA.nombre])
    expect(editada.parcela.recintos.map((r) => r.tipo)).toEqual(['EXTERIOR', 'HUECO'])
    expect(superficie(editada.parcela.recintos)).toBeCloseTo(1500, 6)

    // Y la OFICIAL vuelve por su lado, que es lo que el nombre de la capa prometía.
    const oficial = importar(dxf, { capa: CAPAS.OFICIAL.nombre })
    expect(superficie(oficial.parcela.recintos)).toBeCloseTo(1600, 6)
  })

  it('un DXF de UNA sola capa sigue construyendo la parcela: el guarda no es un peaje', () => {
    // 03_lwpolyline_bulge.dxf: un anillo en la capa «PARCELA». Una sola capa y
    // superficie positiva ⇒ camino feliz, con la constancia del reparto en INFO.
    const bulge = leer('../fixtures/parsers/03_lwpolyline_bulge.dxf')
    const { parcela, resumen, detecciones } = importar(bulge)
    expect(resumen.bloqueos).toEqual([])
    expect(parcela).not.toBeNull()
    expect(resumen.capas).toEqual(['PARCELA'])
    const det = porTipo(detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO)[0]
    expect(det.severidad).toBe(SEVERIDAD.INFO) // constancia, no aviso
    expect(det.datos.nCapas).toBe(1)
  })

  it('la geometría de un solo anillo NUNCA se ve afectada (el camino de F01)', () => {
    // El guarda de superficie no puede empezar a bloquear parcelas normales: se
    // comprueba con los dos fixtures reales de F01 y con un cuadrado sintético.
    for (const texto of [LIST_REAL, PARCELA_REAL, '500000 4000000\n500010 4000000\n500010 4000010\n500000 4000010']) {
      const { parcela, resumen } = importar(texto)
      expect(parcela).not.toBeNull()
      expect(resumen.bloqueos).toEqual([])
      expect(superficie(parcela.recintos)).toBeGreaterThan(0)
    }
  })
})

describe('parsers/importar — opts.capa: la oferta que resuelve el reparto', () => {
  it('filtra a la capa pedida y DICE lo que ha dejado fuera', () => {
    const { resumen, detecciones } = importar(DXF_EDIFICIO, { capa: 'Parcela' })
    expect(resumen.nAnillos).toBe(1)
    expect(resumen.capas).toEqual(['Parcela'])
    const det = porTipo(detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO)[0]
    expect(det.severidad).toBe(SEVERIDAD.INFO)
    expect(det.datos.aplicado).toBe('FILTRADO')
    expect(det.datos.capaElegida).toBe('Parcela')
    // El reparto ENTERO sigue en la detección, aunque solo se importe una capa.
    expect(det.datos.capas).toEqual({ Construccion: 7, Parcela: 1 })
    expect(det.mensaje).toContain('«Construccion» ⇢ 7')
  })

  it('una capa que no existe NO lanza: avisa nombrándola y queda SIN_GEOMETRIA', () => {
    // Elegir mal una capa es una decisión sobre el dato, no un fallo de programa
    // (frontera de errores de este módulo). Pero no puede quedar callado.
    const { parcela, resumen, detecciones } = importar(DXF_REAL, { capa: 'PARCELA_OFICIAL' })
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toEqual([BLOQUEOS.SIN_GEOMETRIA])
    const det = porTipo(detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO)[0]
    expect(det.severidad).toBe(SEVERIDAD.AVISO)
    expect(det.datos.existe).toBe(false)
    expect(det.mensaje).toContain('«PARCELA_OFICIAL»')
    expect(det.mensaje).toContain('«FINO» ⇢ 16') // las capas disponibles, para elegir otra
  })

  it('la capa se compara LITERAL: «parcela» no es «PARCELA»', () => {
    expect(importar(DXF_REAL, { capa: 'parcela' }).resumen.nAnillos).toBe(0)
    expect(importar(DXF_REAL, { capa: 'PARCELA' }).resumen.nAnillos).toBe(3)
  })

  it('opts.capa que no es string → RangeError (eso sí es error de programación)', () => {
    expect(() => importar(DXF_REAL, { capa: 0 })).toThrow(RangeError)
    expect(() => importar(DXF_REAL, { capa: ['0'] })).toThrow(RangeError)
    expect(() => importar(DXF_REAL, { capa: null })).toThrow(RangeError)
  })
})

describe('parsers/importar — el catálogo BLOQUEOS', () => {
  it('clave === valor, congelado, y son los cinco', () => {
    expect(BLOQUEOS).toEqual({
      SIN_GEOMETRIA: 'SIN_GEOMETRIA',
      COORDENADAS_EN_GRADOS: 'COORDENADAS_EN_GRADOS',
      HUSO_NO_RESUELTO: 'HUSO_NO_RESUELTO',
      ANILLOS_EN_VARIAS_CAPAS: 'ANILLOS_EN_VARIAS_CAPAS',
      SUPERFICIE_NO_POSITIVA: 'SUPERFICIE_NO_POSITIVA',
    })
    expect(Object.isFrozen(BLOQUEOS)).toBe(true)
  })

  it('los cinco se emiten LITERALES en el fichero (el catálogo no puede desincronizarse)', () => {
    // Mitad estática del pacto: `parsers/importar.js` escribe los códigos a mano
    // en sus `bloqueos.push(...)` porque hay guardas de OTRAS capas que buscan
    // exactamente ese texto (`test/edificio/comun.test.js`). Este test ata las
    // dos cosas: si alguien cambia el catálogo y no el push —o al revés—, cae aquí.
    const fuente = readFileSync(
      fileURLToPath(new URL('../../parsers/importar.js', import.meta.url)),
      'utf8',
    )
    for (const codigo of Object.values(BLOQUEOS)) {
      expect(fuente.includes(`bloqueos.push('${codigo}')`), `no se emite '${codigo}'`).toBe(true)
    }
  })

  it('BLOQUEOS_SOLO_PARCELA son los DOS de F11, y ninguno de los tres heredados', () => {
    // La rama EDIFICIO arrastra los bloqueos sin traducir: estos dos hablan del
    // reparto exterior/huecos, que allí no aplica, y hay que filtrarlos. Un DXF de
    // edificio SIEMPRE trae varias capas, así que sin el filtro quedaría bloqueado
    // justo en su caso normal.
    expect(BLOQUEOS_SOLO_PARCELA).toEqual([
      BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS,
      BLOQUEOS.SUPERFICIE_NO_POSITIVA,
    ])
    expect(BLOQUEOS_SOLO_PARCELA).not.toContain(BLOQUEOS.SIN_GEOMETRIA)
    expect(BLOQUEOS_SOLO_PARCELA).not.toContain(BLOQUEOS.COORDENADAS_EN_GRADOS)
    expect(BLOQUEOS_SOLO_PARCELA).not.toContain(BLOQUEOS.HUSO_NO_RESUELTO)
    // Y el filtro de una línea deja al edificio real sin ningún bloqueo.
    const { resumen } = importar(DXF_EDIFICIO)
    expect(resumen.bloqueos.filter((b) => !BLOQUEOS_SOLO_PARCELA.includes(b))).toEqual([])
  })

  // ── La SEGUNDA mitad del filtro, que faltaba (2026-08-04) ──────────────────
  //
  // Filtrar los bloqueos no bastaba: **la detección que acompaña a un bloqueo de
  // parcela se seguía LEYENDO**. El guion de humo 13 midió la rama EDIFICIO
  // diciendo a la vez «Cargadas 7 partes… 62 vértices» y «da −13,32 m²… No se
  // construye la parcela». La suite estaba verde porque el reenvío completo era
  // deliberado y estaba probado en `test/edificio/entrada.test.js`.

  it('la detección de SUPERFICIE_NO_POSITIVA lleva `datos.bloqueo` con su código', () => {
    const { detecciones } = importar(DXF_EDIFICIO, { capa: 'Construccion' })
    const marcadas = detecciones.filter((d) => d?.datos?.bloqueo !== undefined)

    expect(marcadas).toHaveLength(1)
    expect(marcadas[0].datos.bloqueo).toBe(BLOQUEOS.SUPERFICIE_NO_POSITIVA)
    // Y sigue siendo la misma detección de siempre, con su severidad y su cifra:
    // marcar no es reescribir. La rama PARCELA la lee igual que antes.
    expect(marcadas[0].tipo).toBe(TIPO_DETECCION.SEPARADOR_POLIGONO)
    expect(marcadas[0].severidad).toBe(SEVERIDAD.AVISO)
    expect(marcadas[0].mensaje).toMatch(/No se construye la parcela/)
  })

  it('⛔ toda detección con `datos.bloqueo` nombra un código de BLOQUEOS_SOLO_PARCELA', () => {
    // El invariante que hace que la marca no pueda mentir. Se barren los cuatro
    // fixtures reales y el DXF que escribimos nosotros: si alguien marca una
    // detección con un bloqueo que NO es de parcela, el filtro de `edificio/` se
    // la comería sin que nadie lo hubiera decidido.
    const lado = (l, dx = 0, dy = 0) => [
      [440123.45 + dx, 4470987.65 + dy],
      [440123.45 + dx + l, 4470987.65 + dy],
      [440123.45 + dx + l, 4470987.65 + dy + l],
      [440123.45 + dx, 4470987.65 + dy + l],
    ]
    // Nuestro propio DXF de dos capas: el que producía −100,00 m² en silencio.
    const { dxf: DXF_NUESTRO } = serializarParcelaDxf({
      recintosEditados: [
        { vertices: lado(40), tipo: 'EXTERIOR' },
        { vertices: lado(10, 10, 10), tipo: 'HUECO' },
      ],
      recintosOficiales: [{ vertices: lado(40), tipo: 'EXTERIOR' }],
    })
    const textos = [LIST_REAL, PARCELA_REAL, DXF_REAL, DXF_EDIFICIO, DXF_NUESTRO]
    let vistas = 0
    for (const texto of textos) {
      for (const opts of [{}, { capa: 'Construccion' }, { capa: CAPAS.OFICIAL.nombre }]) {
        for (const d of importar(texto, opts).detecciones) {
          if (d?.datos?.bloqueo === undefined) continue
          vistas += 1
          expect(BLOQUEOS_SOLO_PARCELA).toContain(d.datos.bloqueo)
        }
      }
    }
    // Anti-vacuidad: si el barrido dejara de producir ninguna marcada, este `it`
    // pasaría afirmando nada.
    expect(vistas).toBeGreaterThan(0)
  })

  it('`sinDeteccionesDeParcela` quita ESAS y no toca ninguna otra', () => {
    const { detecciones } = importar(DXF_EDIFICIO, { capa: 'Construccion' })
    const limpias = sinDeteccionesDeParcela(detecciones)

    expect(limpias).toHaveLength(detecciones.length - 1)
    expect(limpias.every((d) => d?.datos?.bloqueo === undefined)).toBe(true)
    // El mensaje del reparto por capas comparte TIPO con la que se va, y se queda:
    // filtrar por `tipo` habría matado la explicación que el edificio sí necesita.
    expect(
      limpias.some(
        (d) => d.tipo === TIPO_DETECCION.SEPARADOR_POLIGONO && /capa\(s\)/.test(d.mensaje),
      ),
    ).toBe(true)
    // Y no muta la entrada.
    expect(detecciones).toHaveLength(limpias.length + 1)
  })

  it('`sinDeteccionesDeParcela` con una lista sin marcas la devuelve entera', () => {
    const { detecciones } = importar(LIST_REAL)
    expect(sinDeteccionesDeParcela(detecciones)).toHaveLength(detecciones.length)
  })
})

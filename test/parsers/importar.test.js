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

  it('⭐ LIST: el huso DEJÓ de ser ambiguo el 2026-08-09 (la lectura h31 caía en el mar)', () => {
    // ⛔ **Esta prueba exigía `ambiguo: true` con candidatos [30, 31]**, y era cierto
    // mientras los tres husos se validaban contra un rectángulo único. Este fixture
    // real cae en lon −5,26 · lat 36,94 (provincia de Sevilla); leído como huso 31
    // daba lon +0,74 con la MISMA latitud, o sea Mediterráneo abierto al sur de
    // Valencia — y pasaba el filtro porque el rectángulo llegaba a lon 4,5.
    // Con `BBOX_POR_HUSO` (huso 31: lat 38,5…43,0, de Formentera al Valle de Arán)
    // esa lectura muere y queda una sola. Ver `geo/huso.js`.
    const { detecciones, resumen } = importar(LIST_REAL)
    expect(resumen.huso.ambiguo).toBe(false)
    expect(resumen.huso.zona).toBe(30)
    expect(resumen.huso.lat).toBeLessThan(38.5) // el porqué, medido: por debajo de Formentera
    expect(porTipo(detecciones, TIPO_DETECCION.HUSO_AMBIGUO)).toHaveLength(0)
  })

  it('LIST: donde la ambigüedad es REAL sigue saliendo el AVISO con los candidatos', () => {
    // Un cuadrado de Madrid: leído como huso 31 cae frente a Tarragona, y eso un
    // rectángulo no lo distingue de tierra. La ambigüedad que queda es la de verdad.
    const madrid = '440123.45 4470987.65\n440133.45 4470987.65\n440133.45 4470997.65\n440123.45 4470997.65'
    const { detecciones, resumen } = importar(madrid)
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

  it('⛔ elegir capa NO basta: «PARCELA» son 3 anillos disjuntos, y F22 los NOMBRA así', () => {
    // Por esto hacen falta los guardas. La capa literalmente llamada «PARCELA» no
    // contiene la parcela: contiene tres lindes sueltos, y el reparto «uno
    // exterior + N huecos» sigue sin sostenerse dentro de una capa.
    //
    // ⭐ **El título de este test decía «disjuntos» desde F11 y el código no sabía
    // decirlo**: solo sabía que la resta daba −29,06 m². Desde F22 la causa tiene
    // nombre —`VARIOS_RECINTOS_DISJUNTOS`— y la salida deja de ser un callejón:
    // hay tres recintos y se puede preguntar cuál es la parcela.
    const { parcela, resumen, detecciones } = importar(DXF_REAL, { capa: 'PARCELA' })
    expect(parcela).toBeNull()
    expect(resumen.bloqueos).toEqual([BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS])
    expect(resumen.bloqueos).not.toContain(BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS) // ya es una sola
    // ⚠️ Y `SUPERFICIE_NO_POSITIVA` NO acompaña: los −29,06 m² eran el resultado de
    // leer tres fincas como un contorno con huecos, no un hecho sobre el fichero.
    // Enseñar las dos cosas es la contradicción que F11 pagó con el guion 13.
    expect(resumen.bloqueos).not.toContain(BLOQUEOS.SUPERFICIE_NO_POSITIVA)

    const aviso = porTipo(detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO).find(
      (d) => d.datos && d.datos.bloqueo === BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
    )
    expect(aviso.severidad).toBe(SEVERIDAD.AVISO)
    expect(aviso.datos.nRecintos).toBe(3)
    // La cifra de cada recinto, no un adjetivo: es lo que hace falta para poder
    // rotularlos cuando se pregunte cuál es la parcela, y se mide UNA vez.
    expect(aviso.datos.recintos.map((r) => Math.round(r.superficie))).toEqual([108, 66, 71])
    expect(aviso.mensaje).toContain('3 recintos SEPARADOS')
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

// ═════════════════════════════════════════════════════════════════════════════
// Auditoría 2026-08 · Una línea que NO entra no puede dejar construir la parcela
// ═════════════════════════════════════════════════════════════════════════════
//
// La auditoría midió que `extraerPares` se tragaba una línea de cuatro números
// como si fuera un vértice con Z, perdiendo la mitad de los pares con el mensaje
// FALSO de «Z descartada». El arreglo lo convirtió en una detección ERROR
// honesta… y ahí se quedó corto: una detección no impide construir. Medido
// entonces sobre el caso de abajo: `construida: true`, `bloqueos: []` y una
// parcela de CUATRO vértices —en vez de seis— lista para firmarse.

describe('parsers/importar — líneas descartadas y el bloqueo que faltaba', () => {
  /** Parcela en L de SEIS vértices donde UNA línea trae dos vértices juntos. */
  const L_CON_LINEA_DE_CUATRO = [
    '440000.00 4470000.00',
    '440100.00 4470000.00',
    '440100.00 4470040.00 440060.00 4470040.00', // ← los dos que se pierden
    '440060.00 4470100.00',
    '440000.00 4470100.00',
  ].join('\n')

  it('⭐ pierde dos vértices y YA NO se construye: bloquea con LINEAS_NO_IMPORTADAS', () => {
    const { parcela, resumen } = importar(L_CON_LINEA_DE_CUATRO, { formato: 'TXT' })
    expect(resumen.bloqueos).toContain(BLOQUEOS.LINEAS_NO_IMPORTADAS)
    expect(resumen.construida).toBe(false)
    expect(parcela).toBeNull()
    // Anti-vacuidad: el destrozo que se evita estaba MEDIDO — cuatro de seis.
    expect(resumen.nVertices).toEqual([4])
  })

  it('y la detección que lo acompaña nombra la línea, en ERROR', () => {
    const { detecciones } = importar(L_CON_LINEA_DE_CUATRO, { formato: 'TXT' })
    const det = porTipo(detecciones, TIPO_DETECCION.FORMATO_NO_SOPORTADO)[0]
    expect(det.severidad).toBe(SEVERIDAD.ERROR)
    expect(det.mensaje).toContain('440100.00 4470040.00 440060.00 4470040.00')
  })

  it('sin líneas perdidas la MISMA parcela entra entera: el bloqueo no sobra', () => {
    // Anti-vacuidad del bloqueo: si dijera que sí a todo, esto también fallaría.
    const entera = L_CON_LINEA_DE_CUATRO.replace(
      '440100.00 4470040.00 440060.00 4470040.00',
      '440100.00 4470040.00\n440060.00 4470040.00',
    )
    const { parcela, resumen } = importar(entera, { formato: 'TXT' })
    expect(resumen.bloqueos).not.toContain(BLOQUEOS.LINEAS_NO_IMPORTADAS)
    expect(resumen.nVertices).toEqual([6])
    expect(parcela).not.toBeNull()
  })

  it('⛔ cuando NO entra ni un anillo, sustituye a SIN_GEOMETRIA y no se suman', () => {
    // El diagnóstico falso que se evita: «el fichero no trae ni una polilínea»
    // dicho sobre un volcado que es TODO coordenadas manda al técnico a buscar el
    // problema donde no está.
    const todoDeCuatro = ['440000.00 4470000.00 440100.00 4470000.00', '440100.00 4470040.00 440060.00 4470040.00'].join('\n')
    const { resumen } = importar(todoDeCuatro, { formato: 'TXT' })
    expect(resumen.bloqueos).toEqual([BLOQUEOS.LINEAS_NO_IMPORTADAS])
    expect(resumen.bloqueos).not.toContain(BLOQUEOS.SIN_GEOMETRIA)
  })

  it('la «Curvatura» huérfana es AVISO y NO bloquea: no pierde ningún vértice', () => {
    // El mismo TIPO en dos severidades. Se distingue por SEVERIDAD y no por el
    // texto, y esta prueba es la que lo ata.
    const { resumen } = importar('Curvatura: 0.4142\n440000.00 4470000.00\n440100.00 4470000.00\n440100.00 4470100.00', {
      formato: 'LIST',
    })
    expect(resumen.bloqueos).not.toContain(BLOQUEOS.LINEAS_NO_IMPORTADAS)
  })
})

describe('parsers/importar — el catálogo BLOQUEOS', () => {
  it('clave === valor, congelado, y son los SIETE', () => {
    expect(BLOQUEOS).toEqual({
      SIN_GEOMETRIA: 'SIN_GEOMETRIA',
      COORDENADAS_EN_GRADOS: 'COORDENADAS_EN_GRADOS',
      HUSO_NO_RESUELTO: 'HUSO_NO_RESUELTO',
      ANILLOS_EN_VARIAS_CAPAS: 'ANILLOS_EN_VARIAS_CAPAS',
      SUPERFICIE_NO_POSITIVA: 'SUPERFICIE_NO_POSITIVA',
      // F22 · Los anillos son N fincas separadas, no un contorno con huecos.
      VARIOS_RECINTOS_DISJUNTOS: 'VARIOS_RECINTOS_DISJUNTOS',
      // Auditoría 2026-08 · El parser descartó líneas: al contorno le faltan vértices.
      LINEAS_NO_IMPORTADAS: 'LINEAS_NO_IMPORTADAS',
    })
    expect(Object.isFrozen(BLOQUEOS)).toBe(true)
  })

  it('los siete se emiten LITERALES en el fichero (el catálogo no puede desincronizarse)', () => {
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

  it('BLOQUEOS_SOLO_PARCELA son los dos de F11 y el de F22, y ninguno de los tres heredados', () => {
    // La rama EDIFICIO arrastra los bloqueos sin traducir: estos tres hablan del
    // reparto exterior/huecos, que allí no aplica, y hay que filtrarlos. Un DXF de
    // edificio SIEMPRE trae varias capas, así que sin el filtro quedaría bloqueado
    // justo en su caso normal.
    //
    // ⚠️ Y el de F22 es el que MÁS falta hace que se filtre: las huellas de un
    // edificio son disjuntas POR DEFINICIÓN, así que sin él la rama EDIFICIO se
    // bloquearía en el 100 % de sus ficheros y no solo en los de varias capas.
    expect(BLOQUEOS_SOLO_PARCELA).toEqual([
      BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS,
      BLOQUEOS.SUPERFICIE_NO_POSITIVA,
      BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
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

// ═══════════════════════════════════════════════════════════════════════════
// F22 · EL DXF DE «CONSULTA MASIVA»: UNA MANZANA ENTERA
// ═══════════════════════════════════════════════════════════════════════════

const DXF_MANZANA = leer('../fixtures/parsers/manzana_consulta_masiva_6346726UF8664N.dxf')

describe('parsers/importar — F22 · N fincas separadas, no un contorno con huecos', () => {
  it('⛔ el defecto de partida: la capa «Parcela» son OCHO fincas y no entraba ninguna', () => {
    const { parcela, resumen, detecciones } = importar(DXF_MANZANA, { capa: 'Parcela' })
    expect(parcela).toBeNull()
    expect(resumen.nAnillos).toBe(8)

    // La causa se NOMBRA, y ya no se acusa al fichero de un defecto que no tiene.
    expect(resumen.bloqueos).toEqual([BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS])
    expect(resumen.bloqueos).not.toContain(BLOQUEOS.SUPERFICIE_NO_POSITIVA)

    const aviso = porTipo(detecciones, TIPO_DETECCION.SEPARADOR_POLIGONO).find(
      (d) => d.datos && d.datos.bloqueo === BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
    )
    expect(aviso.severidad).toBe(SEVERIDAD.AVISO)
    expect(aviso.datos.nRecintos).toBe(8)
    expect(aviso.datos.saltados).toEqual([])
    // Las ocho superficies medidas UNA vez, para poder rotularlas al preguntar
    // cuál es la parcela sin volver a medir (y sin arriesgarse a enseñar un
    // número distinto del que se guarda).
    expect(aviso.datos.recintos.map((r) => Math.round(r.superficie))).toEqual([
      548, 444, 656, 1099, 863, 5165, 646, 542,
    ])
    // Y todas dicen de qué capa vienen: es lo que hace falta para nombrarlas.
    expect(new Set(aviso.datos.recintos.map((r) => r.capa))).toEqual(new Set(['Parcela']))
  })

  it('⛔⛔ el caso que era SILENCIOSO: con el anillo mayor primero se construía una finca falsa', () => {
    // El fichero real bloqueaba por CASUALIDAD: su finca más pequeña viene la
    // primera, así que la resta salía negativa. Reordenados los MISMOS ocho
    // anillos con el mayor delante, `superficie` da +368,22 m² y hasta F22 esto
    // devolvía `bloqueos: []`, `construida: true` — una parcela que no existe,
    // con siete «huecos» que son las parcelas de los vecinos, lista para firmarse.
    //
    // Es el guardián de la regresión más cara de esta fase, y por eso reordena de
    // verdad en vez de dar por bueno el orden del fichero.
    const { anillos } = importar(DXF_MANZANA, { capa: 'Parcela' })
    const porArea = [...anillos].sort(
      (a, b) =>
        superficie([{ vertices: b, tipo: TIPO_RECINTO.EXTERIOR }]) -
        superficie([{ vertices: a, tipo: TIPO_RECINTO.EXTERIOR }]),
    )
    const comoTxt = porArea.map((a) => a.map(([x, y]) => `${x} ${y}`).join('\n')).join('\nseparador\n')

    // La lectura vieja daba un número POSITIVO y plausible: de ahí el silencio.
    const recintosViejos = porArea.map((v, i) => ({
      vertices: v,
      tipo: i === 0 ? TIPO_RECINTO.EXTERIOR : TIPO_RECINTO.HUECO,
    }))
    expect(superficie(recintosViejos)).toBeCloseTo(368.22, 1)

    const { parcela, resumen } = importar(comoTxt, { formato: 'TXT' })
    expect(resumen.bloqueos).toContain(BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS)
    expect(parcela).toBeNull()
  })

  it('el bloqueo es SOLO DE PARCELA: la rama EDIFICIO no lo ve, ni a él ni a su detección', () => {
    // Las huellas de un edificio son disjuntas por definición: sin este filtro,
    // esa rama quedaría bloqueada en TODOS sus ficheros.
    const { detecciones } = importar(DXF_MANZANA, { capa: 'Parcela' })
    expect(BLOQUEOS_SOLO_PARCELA).toContain(BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS)
    expect(
      sinDeteccionesDeParcela(detecciones).some(
        (d) => d?.datos?.bloqueo === BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
      ),
    ).toBe(false)
  })

  it('⭐ una parcela CON sus construcciones dentro NO es «N fincas»: eso es contención', () => {
    // El otro DXF de Consulta Masiva del repo trae UNA parcela y 7 huellas dentro.
    // Sin elegir capa son 8 anillos, igual que la manzana — y la respuesta tiene
    // que ser la contraria, porque están anidados y no separados. Es la prueba de
    // que el detector distingue las dos cosas y no cuenta anillos.
    const { resumen } = importar(DXF_EDIFICIO)
    expect(resumen.nAnillos).toBe(8)
    expect(resumen.bloqueos).not.toContain(BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS)
    expect(resumen.bloqueos).toContain(BLOQUEOS.SUPERFICIE_NO_POSITIVA)
  })

  it('y con su capa `Parcela` (un solo anillo) entra sin un solo bloqueo', () => {
    const { parcela, resumen } = importar(DXF_EDIFICIO, { capa: 'Parcela' })
    expect(resumen.bloqueos).toEqual([])
    expect(parcela).not.toBeNull()
  })
})

describe('parsers/importar — F22 · los rótulos que el fichero trae dentro', () => {
  it('⭐ el fichero NOMBRA sus ocho fincas, y la capa se elige MIDIENDO', () => {
    // ⛔ No se elige por el nombre de la capa, y no es purismo: F11 midió que en
    // `UTM.dxf` la parcela buena está en la capa «0» y NO en la llamada «PARCELA».
    // Aquí compiten `txtConstru` (153 rótulos de planta) y `RefCatastral` (8
    // referencias), y gana la que empareja 1:1 con los recintos.
    const { resumen } = importar(DXF_MANZANA, { capa: 'Parcela' })
    expect(resumen.rotulos.capa).toBe('RefCatastral')
    expect(resumen.rotulos.nombres).toEqual([
      '6346726UF8664N',
      '6346725UF8664N',
      '6346714UF8664N',
      '6346713UF8664N',
      '6145925UF8664N',
      '6346306UF8664N',
      '6247108UF8664N',
      '6145924UF8664N',
    ])
  })

  it('y los nombres viajan en la detección, junto a la superficie de cada recinto', () => {
    // Es lo que el cajón de la fase 3 va a pintar. Que vaya en la MISMA detección
    // que las superficies es lo que impide medir dos veces y enseñar dos cifras.
    const { detecciones } = importar(DXF_MANZANA, { capa: 'Parcela' })
    const aviso = detecciones.find(
      (d) => d?.datos?.bloqueo === BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
    )
    expect(aviso.datos.rotulos).toEqual({ capa: 'RefCatastral' })
    expect(aviso.datos.recintos[0]).toMatchObject({ indice: 0, nombre: '6346726UF8664N' })
    expect(aviso.datos.recintos.map((r) => r.nombre).filter(Boolean)).toHaveLength(8)
    // Y el mensaje los dice, para que el aviso valga por sí solo.
    expect(aviso.mensaje).toContain('«RefCatastral»')
    expect(aviso.mensaje).toContain('6346726UF8664N')
  })

  it('⛔ la capa que NO empareja se rechaza, aunque se pida a mano', () => {
    // `txtConstru` mete varias plantas dentro de cada finca ⇒ 7 recintos ambiguos.
    // Pedirla no la hace válida: se prefiere no nombrar nada a nombrar mal.
    const { resumen } = importar(DXF_MANZANA, { capa: 'Parcela', capaRotulos: 'txtConstru' })
    expect(resumen.rotulos).toBeNull()
  })

  it('LIST y TXT no tienen rótulos, y no se les inventan', () => {
    expect(importar(LIST_REAL).resumen.rotulos).toBeNull()
    expect(importar(PARCELA_REAL).resumen.rotulos).toBeNull()
  })

  it('⭐ y en el DXF de edificio los rótulos son las PLANTAS que F12 hace teclear', () => {
    // No lo usa nadie todavía (la decisión 4 de F22 deja las construcciones
    // fuera), pero el dato deja de tirarse y la deuda de F11 tiene suministro.
    const { resumen } = importar(DXF_EDIFICIO, { capa: 'Construccion' })
    expect(resumen.rotulos.capa).toBe('txtConstru')
    expect(resumen.rotulos.nombres).toEqual(['II', 'III', 'III', 'II', 'I', 'P', 'I'])
    // Y con la capa de parcela, su referencia catastral.
    expect(importar(DXF_EDIFICIO, { capa: 'Parcela' }).resumen.rotulos).toEqual({
      capa: 'RefCatastral',
      nombres: ['3515508VF0831N'],
    })
  })
})

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
// EL FLAG DE CIERRE DEL DXF (cÃ³digo 70) â€” la cuarta banda de `resolverCierre`
//
// â›” Defecto medido el 2026-08-15 con `cierre_flag70_arco.dxf`, un fichero real:
// una polilÃ­nea marcada como CERRADA cuyo tramo de cierre mide 0,1118 m. AutoCAD
// la dibujaba cerrada y la aplicaciÃ³n preguntaba por un error de cierre â€” dos
// cosas ciertas que juntas se leen como una contradicciÃ³n (lecciÃ³n M28). Peor:
// la pregunta empujaba a la respuesta equivocada, porque Â«retirar el vÃ©rtice de
// cierreÂ» se habrÃ­a comido el Ãºltimo vÃ©rtice bueno de un arco de 17 tramos.
//
// La verdad externa estÃ¡ en el fichero: con `70=1` el DXF afirma que el tramo
// VÃºltimoâ†’V0 es una arista dibujada y que NO hay vÃ©rtice de cierre repetido.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
describe('parsers/importar â€” CIERRE declarado por el fichero (DXF, cÃ³digo 70)', () => {
  const DXF_CERRADO = leer('../fixtures/parsers/cierre_flag70_arco.dxf')

  /** El mismo anillo, con el flag de cierre que se le diga. Es el A/B del bloque:
   *  geometrÃ­a IDÃ‰NTICA, lo Ãºnico que cambia es lo que el fichero declara. */
  const conFlag = (flag, anillo) =>
    [
      '0', 'SECTION', '2', 'ENTITIES',
      '0', 'LWPOLYLINE', '8', 'PARCELA', '90', String(anillo.length), '70', String(flag),
      ...anillo.flatMap(([x, y]) => ['10', String(x), '20', String(y)]),
      '0', 'ENDSEC', '0', 'EOF',
    ].join('\n') + '\n'

  /** Cuadrado 10Ã—10 cuyo Ãºltimo vÃ©rtice queda a ~0,10 m del primero: exactamente
   *  el caso que hasta hoy caÃ­a siempre en la banda ambigua. */
  const CASI_CERRADO = [
    [500000, 4000000],
    [500010, 4000000],
    [500010, 4000010],
    [500000, 4000010],
    [500000.08, 4000000.06],
  ]

  it('el fichero REAL: INFO, no AVISO â€” y la geometrÃ­a, intacta', () => {
    const { anillos, detecciones, parcela } = importar(DXF_CERRADO)
    const cierre = porTipo(detecciones, TIPO_DETECCION.CIERRE)
    expect(cierre).toHaveLength(1)
    expect(cierre[0].severidad).toBe(SEVERIDAD.INFO)
    expect(cierre[0].datos.interpretacion).toBe('CERRADO_EN_EL_FICHERO')
    expect(cierre[0].datos.cerradoEnElFichero).toBe(true)
    expect(cierre[0].datos.aplicado).toBe('NINGUNO')
    // El error se sigue MIDIENDO y publicando: no se pregunta, pero no se oculta.
    expect(cierre[0].datos.error).toBeCloseTo(0.1118, 4)
    // Los 21 vÃ©rtices siguen ahÃ­: ni se retira el Ãºltimo ni se compensa nada.
    expect(anillos[0]).toHaveLength(21)
    expect(parcela).not.toBeNull()
    expect(parcela.recintos[0].vertices).toHaveLength(21)
  })

  it('â­ el A/B que lo demuestra: MISMA geometrÃ­a, `70=1` calla y `70=0` pregunta', () => {
    // Si el cambio dependiera de la geometrÃ­a serÃ­a una heurÃ­stica nuestra. AquÃ­
    // los dos ficheros traen los MISMOS cinco vÃ©rtices y el mismo error de 0,10 m:
    // lo Ãºnico distinto es lo que el fichero declara de sÃ­ mismo.
    const cerrado = porTipo(
      importar(conFlag(1, CASI_CERRADO)).detecciones,
      TIPO_DETECCION.CIERRE,
    )[0]
    const abierto = porTipo(
      importar(conFlag(0, CASI_CERRADO)).detecciones,
      TIPO_DETECCION.CIERRE,
    )[0]
    expect(cerrado.datos.error).toBeCloseTo(abierto.datos.error, 12) // el MISMO error
    expect(cerrado.severidad).toBe(SEVERIDAD.INFO)
    expect(cerrado.datos.interpretacion).toBe('CERRADO_EN_EL_FICHERO')
    expect(abierto.severidad).toBe(SEVERIDAD.AVISO)
    expect(abierto.datos.interpretacion).toBe('AMBIGUO')
    expect(abierto.datos.cerradoEnElFichero).toBe(false)
  })

  it('las dos lecturas se siguen publicando como dato, aunque no se pregunte', () => {
    // Que no haya pregunta no puede significar que se pierda la capacidad: una
    // interfaz que quiera ofrecer Â«compensarÂ» bajo demanda tiene aquÃ­ el anillo
    // ya calculado, sin reimplementar Bowditch.
    const d = porTipo(importar(conFlag(1, CASI_CERRADO)).detecciones, TIPO_DETECCION.CIERRE)[0]
    expect(d.datos.anilloSinCierre).toHaveLength(4)
    expect(d.datos.anilloCompensado).toHaveLength(4)
    expect(d.datos.metodo).toBe('bowditch')
    expect(d.datos.toleranciaCierre).toBe(0.5)
  })

  it('si el llamante PIDE la correcciÃ³n se aplica igual, y entonces sube a AVISO', () => {
    // Â«Ofrecer, no tocarÂ» sigue en pie por los dos lados: el fichero no nos obliga
    // a ignorar al usuario, pero alterar geometrÃ­a contra lo que el propio fichero
    // afirma no puede irse en un INFO.
    const { anillos, detecciones } = importar(conFlag(1, CASI_CERRADO), { retirarCierre: true })
    const d = porTipo(detecciones, TIPO_DETECCION.CIERRE)[0]
    expect(d.datos.aplicado).toBe('RETIRADO')
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(d.datos.interpretacion).toBe('CERRADO_EN_EL_FICHERO')
    expect(anillos[0]).toHaveLength(4)
  })

  it('el flag NO se cuela en las otras bandas: cierre exacto y arista larga, igual que siempre', () => {
    // (a) VÃºltimo duplica V0 EXACTAMENTE, con `70=1`: se retira sin Deteccion, que
    //     es normalizaciÃ³n trivial y lo era antes de este cambio.
    const exacto = [...CASI_CERRADO.slice(0, 4), [500000, 4000000]]
    const a = importar(conFlag(1, exacto))
    expect(porTipo(a.detecciones, TIPO_DETECCION.CIERRE)).toHaveLength(0)
    expect(a.anillos[0]).toHaveLength(4)

    // (b) Arista de cierre REAL (> 0,5 m) con `70=1`: sigue siendo INFO 'ABIERTO'.
    //     El flag solo desambigua DENTRO de la banda ambigua; fuera no hay nada
    //     que desambiguar y el mensaje de siempre sigue siendo el correcto.
    const b = importar(
      conFlag(1, [
        [500000, 4000000],
        [500030, 4000000],
        [500015, 4000030],
      ]),
    )
    const d = porTipo(b.detecciones, TIPO_DETECCION.CIERRE)[0]
    expect(d.severidad).toBe(SEVERIDAD.INFO)
    expect(d.datos.interpretacion).toBe('ABIERTO')
  })

  it('LIST y TXT no declaran cierre, asÃ­ que su banda ambigua NO cambia', () => {
    // El flag es del DXF. Un pegado de coordenadas no tiene forma de afirmar que
    // el anillo cierra, y ahÃ­ `false` no es Â«no se sabeÂ»: es la verdad.
    const d = porTipo(
      importar(aTXT(CASI_CERRADO), { formato: 'TXT' }).detecciones,
      TIPO_DETECCION.CIERRE,
    )[0]
    expect(d.severidad).toBe(SEVERIDAD.AVISO)
    expect(d.datos.cerradoEnElFichero).toBe(false)
    expect(d.datos.aplicado).toBe('NINGUNO')
  })

  it('el flag viaja POR ANILLO y sobrevive al filtrado por capa', () => {
    // El filtro por capa reordena y descarta anillos: si `cerrados[]` no se
    // filtrara con `anillos[]` y `capas[]`, el flag se leerÃ­a del anillo
    // equivocado EN SILENCIO. AquÃ­ la capa elegida es la segunda del fichero.
    const texto =
      [
        '0', 'SECTION', '2', 'ENTITIES',
        '0', 'LWPOLYLINE', '8', 'OTRA', '90', '5', '70', '0',
        ...CASI_CERRADO.flatMap(([x, y]) => ['10', String(x), '20', String(y)]),
        '0', 'LWPOLYLINE', '8', 'BUENA', '90', '5', '70', '1',
        ...CASI_CERRADO.flatMap(([x, y]) => ['10', String(x + 100), '20', String(y)]),
        '0', 'ENDSEC', '0', 'EOF',
      ].join('\n') + '\n'
    const buena = porTipo(importar(texto, { capa: 'BUENA' }).detecciones, TIPO_DETECCION.CIERRE)
    expect(buena).toHaveLength(1)
    expect(buena[0].datos.cerradoEnElFichero).toBe(true) // el flag de la SEGUNDA
    const otra = porTipo(importar(texto, { capa: 'OTRA' }).detecciones, TIPO_DETECCION.CIERRE)
    expect(otra[0].datos.cerradoEnElFichero).toBe(false)
  })
})

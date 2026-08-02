// test/report/canvas.dom.test.js — F09 · T3.1.
//
// Proyecto Vitest `dom` (jsdom): lo enruta el sufijo `.dom.test.js`, y el módulo
// bajo prueba toca `document`, `Image` y `<canvas>`.
//
// ── ⚠️ LO QUE ESTA SUITE NO PUEDE MEDIR, Y NO ES UN OLVIDO ──────────────────
// **El criterio de aceptación 1 de la spec —«el canvas compuesto exporta con
// `toDataURL` sin `SecurityError`, con control negativo TAINTED»— NO se mide
// aquí.** No es que se haya escapado: es que no se puede.
//
// jsdom **no implementa el contexto 2D**. `canvas.getContext('2d')` devuelve
// `null` mientras el paquete `canvas` no esté instalado, y ese paquete no está ni
// se va a instalar (compila binarios nativos; ver la desviación 1 declarada en el
// plan de F09 antes de empezar). Sin contexto 2D no hay lienzo que contaminar, no
// hay `drawImage` real que lo contamine y no hay `toDataURL` que lance. Un test
// que fingiera ese criterio con dobles estaría comprobando el doble, no el
// navegador — que es la peor manera de tener un criterio de aceptación: en verde y
// sin medir nada.
//
// **Dónde se mide de verdad: en el guion de navegador `11` (T6.2)**, contra el
// WMS real y con el control negativo TAINTED (una imagen SIN `crossOrigin` que
// tiene que hacer fallar `toDataURL`; sin ese control, la prueba positiva pasaría
// también con un `crossOrigin` que no sirviera para nada).
//
// ── LO QUE SÍ SE MIDE AQUÍ, POR ORDEN DE IMPORTANCIA ────────────────────────
//   1. **El ORDEN de asignación `crossOrigin` → `src`.** Es el test estrella. Un
//      lienzo contaminado casi nunca viene de OLVIDAR `crossOrigin`: viene de
//      ponerlo TARDE, después de `src`, cuando la carga ya arrancó en el modo por
//      defecto. Y ese bug es invisible en cualquier otra prueba —la imagen carga,
//      se dibuja, todo va bien— hasta que `toDataURL` lanza al final del todo. Por
//      eso el `Image` falso registra el orden en que se le asignan las propiedades
//      y la prueba falla si `src` llega antes que `crossOrigin`.
//   2. **La sustitución de tamaño del WMS**, medida el 2026-08-02: `4200×100` y
//      `5000×100` devolvieron `4000×2000`, con HTTP 200 y sin aviso. El `Image`
//      falso dispara `load` con `naturalWidth`/`naturalHeight` distintos de lo
//      pedido y se afirma que NO se dibuja y que sale con motivo. El `load` no es
//      la comprobación.
//   3. **El orden de dibujo**, con un lienzo falso que registra cada llamada y
//      cada propiedad que se le asigna, en una sola lista ordenada.
//   4. **El troceado**: tantas `GetMap` como teselas, cada una en su `offset`.
//   5. **Una capa que no sirve** se apaga, se declara con motivo y el resto del
//      plano se compone igual.
//
// El encuadre de las pruebas **no está escrito a mano: sale de `encuadrar`**, el
// módulo real. Un encuadre falso podría estar de acuerdo con `componerPlano` y en
// desacuerdo con la realidad, que es justo lo que la pareja T2.1/T3.1 no puede
// permitirse (la escala del plano y el mapeo del vector tienen que ser la MISMA
// aritmética o el documento miente).

import { describe, it, expect, vi } from 'vitest'

import {
  CALIDAD_JPEG,
  COLORES_PLANO,
  FORMATO_PLANO,
  FORMATO_SONDEO,
  MEDIDAS_MM,
  SRS_PLANO,
  TEXTO_NORTE,
  componerPlano,
  metrosDeBarra,
} from '../../report/canvas.js'
import { encuadrar } from '../../report/encuadre.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { textoDeLongitud } from '../../viewer/acotaciones.js'
import { longitudesDeLados } from '../../geo/metrica.js'
import { COLOR_USUARIO } from '../../viewer/_comun.js'

// ── Geometría de prueba ──────────────────────────────────────────────────────

/**
 * Rectángulo 20 × 15 m (Este × Norte), anillo ABIERTO, en el entorno del fixture
 * F00 — el mismo exterior que usa el arnés del visor, para que las cifras sean
 * comparables entre suites. Lados `20 · 15 · 20 · 15`.
 */
const EXTERIOR = [
  [439240, 4479655],
  [439260, 4479655],
  [439260, 4479670],
  [439240, 4479670],
]

/** Hueco de 4 × 4 m, holgadamente dentro del exterior. */
const HUECO = [
  [439248, 4479660],
  [439252, 4479660],
  [439252, 4479664],
  [439248, 4479664],
]

const recintosDe = (...anillos) =>
  anillos.map((vertices, i) => ({ vertices, tipo: i === 0 ? 'EXTERIOR' : 'HUECO' }))

const RECINTOS = recintosDe(EXTERIOR)
const RECINTOS_CON_HUECO = recintosDe(EXTERIOR, HUECO)

/** El encuadre REAL de la Receta A: 180 × 130 mm a 300 ppp → 2126 × 1535 px, 1 tesela. */
const encuadreNormal = (extra = {}) =>
  encuadrar({ recintos: RECINTOS, anchoMm: 180, altoMm: 130, ...extra })

// ── Dobles instrumentados ────────────────────────────────────────────────────

/** Métodos del contexto 2D que este módulo usa. Cualquier otro es un descuido. */
const METODOS_CTX = [
  'save',
  'restore',
  'beginPath',
  'moveTo',
  'lineTo',
  'closePath',
  'fill',
  'stroke',
  'fillRect',
  'strokeRect',
  'drawImage',
  'translate',
  'rotate',
  'fillText',
  'strokeText',
  'setLineDash',
]

/** Propiedades del contexto 2D cuya ASIGNACIÓN también se registra, en orden. */
const PROPIEDADES_CTX = [
  'fillStyle',
  'strokeStyle',
  'lineWidth',
  'font',
  'textAlign',
  'textBaseline',
  'lineJoin',
  'lineCap',
]

/**
 * Lienzo falso: registra en UNA sola lista ordenada las llamadas de dibujo y las
 * asignaciones de propiedad, que es lo que permite afirmar sobre el ORDEN.
 *
 * `save()`/`restore()` NO restauran nada (son solo apuntes en la lista): las
 * aserciones de esta suite son sobre la secuencia, nunca sobre el estado final.
 *
 * @param {object} [opciones]
 * @param {string} [opciones.dataUrl]  Lo que devolverá `toDataURL`.
 */
function crearLienzoFalso({ dataUrl = JPEG_DATA_URL } = {}) {
  const log = []
  const ctx = {}
  for (const nombre of METODOS_CTX) {
    ctx[nombre] = (...args) => log.push({ tipo: 'llamada', nombre, args })
  }
  for (const nombre of PROPIEDADES_CTX) {
    let valor = null
    Object.defineProperty(ctx, nombre, {
      get: () => valor,
      set: (v) => {
        valor = v
        log.push({ tipo: 'prop', nombre, valor: v })
      },
    })
  }
  const canvas = {
    width: 0,
    height: 0,
    log,
    ctx,
    getContext: (tipo) => (tipo === '2d' ? ctx : null),
    toDataURL: (mime, calidad) => {
      log.push({ tipo: 'llamada', nombre: 'toDataURL', args: [mime, calidad] })
      return dataUrl
    },
  }
  return {
    canvas,
    log,
    crearCanvas: (ancho, alto) => {
      canvas.width = ancho
      canvas.height = alto
      return canvas
    },
    /** Índice de la primera llamada `nombre` que cumpla `filtro` (−1 si no hay). */
    indiceLlamada: (nombre, filtro = () => true) =>
      log.findIndex((e) => e.tipo === 'llamada' && e.nombre === nombre && filtro(e.args)),
    llamadas: (nombre) => log.filter((e) => e.tipo === 'llamada' && e.nombre === nombre),
    props: (nombre) => log.filter((e) => e.tipo === 'prop' && e.nombre === nombre),
  }
}

/** `WIDTH`/`HEIGHT` que viajan en una URL de `GetMap`. */
function tamanoDeUrl(url) {
  return {
    ancho: Number(/[?&]WIDTH=(\d+)/.exec(url)[1]),
    alto: Number(/[?&]HEIGHT=(\d+)/.exec(url)[1]),
  }
}

/** Las capas que viajan en `LAYERS=` de una URL de `GetMap`. */
const capasDeUrl = (url) => /[?&]LAYERS=([^&]*)/.exec(url)[1].split(',')

/**
 * `Image` falso. Lo que lo hace útil no es que simule la carga —eso lo hace
 * cualquiera— sino que **apunta el orden en que se le asignan las propiedades**.
 *
 * @param {(url: string) => {ok: boolean, ancho?: number, alto?: number}} responder
 *   Qué hace el servicio con cada URL. Por defecto: sirve el tamaño pedido.
 */
function crearImagenFalsa(responder = (url) => ({ ok: true, ...tamanoDeUrl(url) })) {
  const emitidas = []

  class ImagenFalsa {
    constructor() {
      this.orden = []
      this.onload = null
      this.onerror = null
      this.naturalWidth = 0
      this.naturalHeight = 0
      emitidas.push(this)
    }

    set crossOrigin(valor) {
      this.orden.push('crossOrigin')
      this._crossOrigin = valor
    }

    get crossOrigin() {
      return this._crossOrigin
    }

    set src(valor) {
      this.orden.push('src')
      this._src = valor
      const respuesta = responder(valor)
      // Asíncrono como el de verdad: si resolviera en la misma vuelta, un módulo
      // que asignara `onload` DESPUÉS de `src` pasaría el test por accidente.
      setTimeout(() => {
        if (!respuesta.ok) {
          if (this.onerror) this.onerror(new Event('error'))
          return
        }
        this.naturalWidth = respuesta.ancho
        this.naturalHeight = respuesta.alto
        if (this.onload) this.onload(new Event('load'))
      }, 0)
    }

    get src() {
      return this._src
    }
  }

  return {
    ImagenFalsa,
    emitidas,
    urls: () => emitidas.map((img) => img.src),
    total: () => emitidas.length,
  }
}

/** JPEG mínimo reconocible: SOI + EOI. Lo que devuelve el lienzo falso. */
const BYTES_JPEG = [0xff, 0xd8, 0xff, 0xd9]
const JPEG_DATA_URL = `data:image/jpeg;base64,${btoa(String.fromCharCode(...BYTES_JPEG))}`

/** Composición con todo inyectado y sin ruido en consola. */
async function componer(extra = {}) {
  const lienzo = extra.lienzo ?? crearLienzoFalso()
  const imagen = extra.imagen ?? crearImagenFalsa()
  const avisos = []
  const plano = await componerPlano({
    encuadre: extra.encuadre ?? encuadreNormal(),
    recintos: extra.recintos ?? RECINTOS,
    recintosOficiales: extra.recintosOficiales ?? null,
    crearCanvas: lienzo.crearCanvas,
    CrearImagen: imagen.ImagenFalsa,
    alAvisar: (mensaje, detalle) => avisos.push({ mensaje, detalle }),
    ...extra.opciones,
  })
  return { plano, lienzo, imagen, avisos }
}

// ═══════════════════════════════════════════════════════════════════════════
// 1 · EL TEST ESTRELLA: crossOrigin ANTES que src
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · el orden `crossOrigin` → `src` (el bug invisible)', () => {
  it('asigna `crossOrigin` ANTES que `src` en TODAS las imágenes que pide', async () => {
    const { imagen } = await componer()

    expect(imagen.total()).toBeGreaterThan(0)
    for (const img of imagen.emitidas) {
      const iCross = img.orden.indexOf('crossOrigin')
      const iSrc = img.orden.indexOf('src')
      expect(iCross, 'nunca se asignó `crossOrigin`').toBeGreaterThanOrEqual(0)
      expect(iSrc, 'nunca se asignó `src`').toBeGreaterThanOrEqual(0)
      expect(
        iCross,
        'con `crossOrigin` asignado DESPUÉS de `src` la carga ya ha arrancado en el modo por ' +
          'defecto: el atributo no surte efecto y el lienzo queda contaminado aunque el ' +
          'servidor emita Access-Control-Allow-Origin',
      ).toBeLessThan(iSrc)
    }
  })

  it('el valor asignado es `anonymous` (el que pide el override O7, verificado)', async () => {
    const { imagen } = await componer()
    for (const img of imagen.emitidas) expect(img.crossOrigin).toBe('anonymous')
  })

  it('el propio doble detecta el orden inverso (control negativo del test estrella)', () => {
    // Sin esto, la prueba de arriba pasaría igual con un `Image` falso que no
    // registrara nada: se comprueba que el instrumento mide.
    const { ImagenFalsa } = crearImagenFalsa()
    const img = new ImagenFalsa()
    img.src = 'https://ejemplo/?WIDTH=1&HEIGHT=1'
    img.crossOrigin = 'anonymous'
    expect(img.orden).toEqual(['src', 'crossOrigin'])
    expect(img.orden.indexOf('crossOrigin')).toBeGreaterThan(img.orden.indexOf('src'))
  })

  it('las imágenes se piden con `Image` inyectado, no con el global (el test lo exige)', async () => {
    const global = vi.spyOn(globalThis, 'Image')
    await componer()
    expect(global).not.toHaveBeenCalled()
    global.mockRestore()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 2 · LA SUSTITUCIÓN DE TAMAÑO DEL WMS (hallazgo medido el 2026-08-02)
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · el WMS no recorta, SUSTITUYE: se compara lo servido', () => {
  it('con `naturalWidth`/`naturalHeight` distintos de lo pedido NO dibuja y lo declara', async () => {
    // Exactamente lo medido: se pidió 2126×1535 y el servicio planta 4000×2000
    // con HTTP 200. El `load` dispara igual, así que el `load` no es la prueba.
    const imagen = crearImagenFalsa(() => ({ ok: true, ancho: 4000, alto: 2000 }))
    const { plano, lienzo, avisos } = await componer({ imagen })

    expect(lienzo.llamadas('drawImage')).toHaveLength(0)
    expect(plano.teselasDibujadas).toBe(0)
    expect(plano.teselasCaidas).toHaveLength(1)
    expect(plano.teselasCaidas[0].motivo).toMatch(/4000×2000/)
    expect(plano.teselasCaidas[0].motivo).toMatch(/2126×1535/)
    expect(avisos.some((a) => /4000×2000/.test(a.mensaje))).toBe(true)
  })

  it('un tamaño sustituido NO se atribuye a una capa (no dispara el sondeo capa a capa)', async () => {
    // Culpar a `catastro` de que el servicio ignore WIDTH/HEIGHT sería señalar a
    // un inocente, y repetir la petición capa a capa daría el mismo tamaño malo
    // seis veces. Una sola petición, y la tesela cae entera.
    const imagen = crearImagenFalsa(() => ({ ok: true, ancho: 4000, alto: 2000 }))
    const { plano } = await componer({ imagen })

    expect(imagen.total()).toBe(1)
    expect(plano.capasCaidas).toEqual([])
    expect(plano.peticiones).toBe(1)
  })

  it('sin cartografía dibujada, ni se declaran capas usadas ni se atribuye fuente', async () => {
    const imagen = crearImagenFalsa(() => ({ ok: true, ancho: 4000, alto: 2000 }))
    const { plano, avisos } = await componer({ imagen })

    expect(plano.capasUsadas).toEqual([])
    expect(plano.atribucion).toBe('')
    expect(avisos.some((a) => /sin cartografía de fondo/.test(a.mensaje))).toBe(true)
  })

  it('una imagen SIN dimensiones tampoco se dibuja (lo no verificable no entra)', async () => {
    // `naturalWidth` sin definir es el caso de un doble mal hecho o de un origen
    // que no decodifica. Fiarse porque «cargó» es justo lo que no se puede hacer.
    class SinDimensiones {
      constructor() {
        this.onload = null
        this.onerror = null
      }
      set src(_valor) {
        setTimeout(() => this.onload && this.onload(new Event('load')), 0)
      }
    }
    const lienzo = crearLienzoFalso()
    const plano = await componerPlano({
      encuadre: encuadreNormal(),
      recintos: RECINTOS,
      crearCanvas: lienzo.crearCanvas,
      CrearImagen: SinDimensiones,
      alAvisar: () => {},
    })
    expect(lienzo.llamadas('drawImage')).toHaveLength(0)
    expect(plano.teselasCaidas).toHaveLength(1)
  })

  it('con el tamaño correcto SÍ dibuja, y con `drawImage` de TRES argumentos', async () => {
    // Los cinco argumentos escalarían una imagen del tamaño equivocado hasta
    // encajar: taparían el fallo que la comprobación acaba de descartar.
    const { plano, lienzo } = await componer()
    const dibujos = lienzo.llamadas('drawImage')

    expect(dibujos).toHaveLength(1)
    expect(dibujos[0].args).toHaveLength(3)
    expect(dibujos[0].args.slice(1)).toEqual([0, 0])
    expect(plano.teselasDibujadas).toBe(1)
    expect(plano.teselasCaidas).toEqual([])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 3 · EL ORDEN DE DIBUJO
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · el orden de dibujo del dossier §4.4', () => {
  /** Índices de los hitos de cada capa del plano, en la lista del lienzo falso. */
  async function hitos() {
    const { plano, lienzo } = await componer({ recintos: RECINTOS_CON_HUECO })
    const log = lienzo.log
    const iTexto = (texto) =>
      log.findIndex((e) => e.tipo === 'llamada' && e.nombre === 'fillText' && e.args[0] === texto)
    return {
      plano,
      lienzo,
      fondo: lienzo.indiceLlamada('fillRect', (a) => a[0] === 0 && a[1] === 0),
      cartografia: lienzo.indiceLlamada('drawImage'),
      relleno: lienzo.indiceLlamada('fill', (a) => a[0] === 'evenodd'),
      cota: iTexto(textoDeLongitud(20)),
      vertice: iTexto('1'),
      escala: iTexto(textoDeLongitud(plano.metrosBarra)),
      norte: iTexto(TEXTO_NORTE),
    }
  }

  it('pinta el fondo blanco antes de nada (un lienzo transparente sale NEGRO en JPEG)', async () => {
    const h = await hitos()
    // La PRIMERA llamada de dibujo de todo el plano es ese `fillRect(0,0,…)`, y el
    // primer color que se asigna es el blanco del fondo.
    const primeraLlamada = h.lienzo.log.findIndex((e) => e.tipo === 'llamada')
    expect(h.fondo).toBe(primeraLlamada)
    expect(h.lienzo.props('fillStyle')[0].valor).toBe(COLORES_PLANO.FONDO)
    expect(h.lienzo.llamadas('fillRect')[0].args).toEqual([0, 0, 2126, 1535])
    expect(h.fondo).toBeLessThan(h.cartografia)
  })

  it('cartografía → parcela → acotaciones → vértices → escala → norte', async () => {
    const h = await hitos()
    for (const [nombre, indice] of Object.entries(h)) {
      if (typeof indice === 'number') {
        expect(indice, `no se ha encontrado el hito «${nombre}» en el lienzo`).toBeGreaterThanOrEqual(0)
      }
    }
    expect(h.cartografia).toBeLessThan(h.relleno)
    expect(h.relleno).toBeLessThan(h.cota)
    expect(h.cota).toBeLessThan(h.vertice)
    expect(h.vertice).toBeLessThan(h.escala)
    expect(h.escala).toBeLessThan(h.norte)
  })

  it('la geometría OFICIAL va entre la parcela y las acotaciones, y en gris discontinuo', async () => {
    const oficial = recintosDe([
      [439241, 4479656],
      [439259, 4479656],
      [439259, 4479669],
      [439241, 4479669],
    ])
    const { lienzo } = await componer({ recintosOficiales: oficial })
    const iRelleno = lienzo.indiceLlamada('fill', (a) => a[0] === 'evenodd')
    const iGris = lienzo.log.findIndex(
      (e) => e.tipo === 'prop' && e.nombre === 'strokeStyle' && e.valor === COLORES_PLANO.OFICIAL,
    )
    const iRaya = lienzo.indiceLlamada('setLineDash', (a) => Array.isArray(a[0]) && a[0].length === 2)
    const iCota = lienzo.log.findIndex(
      (e) => e.tipo === 'llamada' && e.nombre === 'fillText' && e.args[0] === textoDeLongitud(20),
    )

    expect(iRelleno).toBeLessThan(iGris)
    expect(iGris).toBeLessThan(iCota)
    expect(iRaya).toBeGreaterThanOrEqual(0)
  })

  it('sin geometría oficial no se traza su línea (null no dibuja una caja vacía)', async () => {
    // El marcador es el `setLineDash` con patrón: es lo único que hace la capa
    // oficial y nadie más. (El gris de `OFICIAL` NO sirve de marcador: es también
    // el del filete de los dos cartuchos, que salen siempre.)
    const conOficial = await componer({ recintosOficiales: recintosDe(EXTERIOR) })
    const sinOficial = await componer()
    const rayado = (l) => l.llamadas('setLineDash').filter((e) => e.args[0].length === 2)

    expect(rayado(conOficial.lienzo)).toHaveLength(1)
    expect(rayado(sinOficial.lienzo)).toHaveLength(0)
  })

  it('el hueco se resuelve con `fill(\'evenodd\')` sobre un solo path, sin restar polígonos', async () => {
    const { lienzo } = await componer({ recintos: RECINTOS_CON_HUECO })
    const rellenos = lienzo.llamadas('fill').filter((e) => e.args[0] === 'evenodd')
    expect(rellenos).toHaveLength(1)
    // Un solo `beginPath` para los dos anillos: 4 + 4 vértices → 2 moveTo y 6 lineTo.
    const iRelleno = lienzo.indiceLlamada('fill', (a) => a[0] === 'evenodd')
    const antes = lienzo.log.slice(0, iRelleno)
    const moveTo = antes.filter((e) => e.tipo === 'llamada' && e.nombre === 'moveTo')
    expect(moveTo).toHaveLength(2)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 4 · EL TROCEADO
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · el troceado: una GetMap por tesela, cada una en su sitio', () => {
  it('la ruta normal (Receta A medida) es UNA sola petición', async () => {
    const encuadre = encuadreNormal()
    const { plano, imagen } = await componer({ encuadre })

    expect(encuadre.teselas).toHaveLength(1)
    expect(imagen.total()).toBe(1)
    expect(plano.teselasPedidas).toBe(1)
    expect(plano.peticiones).toBe(1)
  })

  it('con el plano troceado se pide una GetMap por tesela y se dibuja en su offset', async () => {
    // `maxPx` bajo fuerza la rejilla sin tocar el tamaño del papel: 2126×1535 con
    // techo de 1200 px da 2 columnas × 2 filas.
    const encuadre = encuadreNormal({ maxPx: 1200 })
    const { plano, imagen, lienzo } = await componer({ encuadre })

    expect(encuadre.rejilla).toEqual({ columnas: 2, filas: 2 })
    expect(imagen.total()).toBe(4)
    expect(plano.teselasPedidas).toBe(4)

    const dibujos = lienzo.llamadas('drawImage')
    expect(dibujos).toHaveLength(4)
    expect(dibujos.map((d) => d.args.slice(1))).toEqual(
      encuadre.teselas.map((t) => [t.offsetX, t.offsetY]),
    )
  })

  it('cada URL pide el tamaño de SU tesela (no el del plano entero)', async () => {
    const encuadre = encuadreNormal({ maxPx: 1200 })
    const { imagen } = await componer({ encuadre })

    expect(imagen.urls().map(tamanoDeUrl)).toEqual(
      encuadre.teselas.map((t) => ({ ancho: t.anchoPx, alto: t.altoPx })),
    )
  })

  it('la petición lleva el SRS, el formato y las capas pactados', async () => {
    const { imagen } = await componer()
    const url = imagen.urls()[0]

    expect(url).toContain(`SRS=${SRS_PLANO}`)
    expect(url).toContain(`FORMAT=${FORMATO_PLANO}`)
    expect(url).toContain('REQUEST=GetMap')
    expect(capasDeUrl(url)).toContain('catastro')
  })

  it('el `urlDeMapa` inyectado recibe el bbox y el tamaño de cada tesela', async () => {
    const encuadre = encuadreNormal()
    const urlDeMapa = vi.fn(() => 'https://ejemplo/?WIDTH=2126&HEIGHT=1535&LAYERS=catastro')
    await componer({ encuadre, opciones: { urlDeMapa } })

    expect(urlDeMapa).toHaveBeenCalledTimes(1)
    const [bbox, tamano, opts] = urlDeMapa.mock.calls[0]
    expect(bbox).toEqual(encuadre.teselas[0].bbox)
    expect(tamano).toEqual({ ancho: 2126, alto: 1535 })
    expect(opts.crs).toBe(SRS_PLANO)
    expect(opts.formato).toBe(FORMATO_PLANO)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 5 · UNA CAPA QUE NO SIRVE SE APAGA Y SE DICE
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · una capa que no sirve se apaga, se declara y el plano sale igual', () => {
  /** Servicio que rechaza cualquier petición en la que aparezca `mala`. */
  const servicioConCapaMala = (mala) =>
    crearImagenFalsa((url) =>
      capasDeUrl(url).includes(mala) ? { ok: false } : { ok: true, ...tamanoDeUrl(url) },
    )

  it('la capa que falla cae a `capasCaidas` con motivo y sale de `capasUsadas`', async () => {
    const imagen = servicioConCapaMala('rota')
    const { plano } = await componer({
      imagen,
      opciones: { capas: ['catastro', 'rota', 'textos'] },
    })

    expect(plano.capasCaidas).toHaveLength(1)
    expect(plano.capasCaidas[0].capa).toBe('rota')
    expect(plano.capasCaidas[0].motivo).toMatch(/no llegó a cargarse/)
    expect(plano.capasUsadas).toEqual(['catastro', 'textos'])
  })

  it('el resto del plano se compone igual: las capas sanas se dibujan y el vector también', async () => {
    const imagen = servicioConCapaMala('rota')
    const { plano, lienzo } = await componer({
      imagen,
      opciones: { capas: ['catastro', 'rota', 'textos'] },
    })

    // Una petición conjunta fallida + una por capa en el sondeo = 4.
    expect(plano.peticiones).toBe(4)
    // Se dibujan las dos capas sanas, superpuestas en el mismo offset.
    expect(lienzo.llamadas('drawImage')).toHaveLength(2)
    expect(plano.teselasDibujadas).toBe(1)
    expect(plano.atribucion).toBe(ATRIBUCION.CATASTRO)
    expect(lienzo.llamadas('fill').some((e) => e.args[0] === 'evenodd')).toBe(true)
    expect(plano.jpeg).toBeInstanceOf(Uint8Array)
  })

  it('el sondeo pide PNG TRANSPARENTE: en JPEG cada capa taparía a la anterior', async () => {
    const imagen = servicioConCapaMala('rota')
    await componer({ imagen, opciones: { capas: ['catastro', 'rota'] } })

    const sondeos = imagen.urls().slice(1)
    expect(sondeos).toHaveLength(2)
    for (const url of sondeos) {
      expect(url).toContain(`FORMAT=${FORMATO_SONDEO}`)
      expect(url).toContain('TRANSPARENT=TRUE')
      expect(capasDeUrl(url)).toHaveLength(1)
    }
  })

  it('la capa caída no se vuelve a pedir en las teselas siguientes (el sondeo se paga una vez)', async () => {
    const imagen = servicioConCapaMala('rota')
    const encuadre = encuadreNormal({ maxPx: 1200 })
    const { plano } = await componer({
      encuadre,
      imagen,
      opciones: { capas: ['catastro', 'rota'] },
    })

    expect(plano.capasCaidas).toHaveLength(1)
    // Tesela 1: conjunta fallida + 2 sondeos. Teselas 2–4: conjunta ya depurada.
    expect(plano.peticiones).toBe(3 + 3)
    expect(imagen.urls().filter((u) => capasDeUrl(u).includes('rota'))).toHaveLength(2)
  })

  it('si NINGUNA capa sirve, el plano sale sobre blanco, sin atribución y avisando', async () => {
    const imagen = crearImagenFalsa(() => ({ ok: false }))
    const { plano, lienzo, avisos } = await componer({
      imagen,
      opciones: { capas: ['catastro'] },
    })

    expect(lienzo.llamadas('drawImage')).toHaveLength(0)
    expect(plano.capasUsadas).toEqual([])
    expect(plano.capasCaidas.map((c) => c.capa)).toEqual(['catastro'])
    expect(plano.atribucion).toBe('')
    expect(avisos.some((a) => /sin cartografía de fondo/.test(a.mensaje))).toBe(true)
    // Y aun así hay plano: fondo, vector y cromo.
    expect(lienzo.llamadas('fill').some((e) => e.args[0] === 'evenodd')).toBe(true)
    expect(plano.jpeg[0]).toBe(0xff)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 6 · LOS BYTES DE SALIDA
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · los bytes que consume report/pdf.js#imagenJpeg', () => {
  it('devuelve un `Uint8Array` con los bytes del JPEG, no un data URL', async () => {
    const { plano } = await componer()
    expect(plano.jpeg).toBeInstanceOf(Uint8Array)
    expect([...plano.jpeg]).toEqual(BYTES_JPEG)
  })

  it('exporta con `toDataURL(image/jpeg, 0.92)`', async () => {
    const { lienzo } = await componer()
    const exportacion = lienzo.llamadas('toDataURL')
    expect(exportacion).toHaveLength(1)
    expect(exportacion[0].args).toEqual([FORMATO_PLANO, CALIDAD_JPEG])
  })

  it('la calidad se puede bajar y viaja en el resultado', async () => {
    const { plano, lienzo } = await componer({ opciones: { calidad: 0.6 } })
    expect(lienzo.llamadas('toDataURL')[0].args[1]).toBe(0.6)
    expect(plano.calidad).toBe(0.6)
  })

  it('si `toDataURL` cae a PNG en silencio, LANZA (esos bytes no los lee /DCTDecode)', async () => {
    // La especificación HTML manda usar image/png cuando el tipo pedido no está
    // soportado. El data URL sería válido y los bytes, veneno para el PDF.
    const lienzo = crearLienzoFalso({ dataUrl: 'data:image/png;base64,iVBORw0KGgo=' })
    await expect(componer({ lienzo })).rejects.toThrow(RangeError)
    await expect(componer({ lienzo })).rejects.toThrow(/PNG en silencio/)
  })

  it('si el lienzo está contaminado, el `SecurityError` sale explicado y con causa', async () => {
    const lienzo = crearLienzoFalso()
    const causa = new Error('SecurityError: tainted canvas')
    lienzo.canvas.toDataURL = () => {
      throw causa
    }
    await expect(componer({ lienzo })).rejects.toThrow(/crossOrigin.*después de `src`/s)
    await expect(componer({ lienzo })).rejects.toMatchObject({ cause: causa })
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 7 · LA ESCALA GRÁFICA
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · la barra de escala usa `sx`, no un promedio', () => {
  it('`metrosDeBarra` da el mayor 1-2-5·10ᵏ que cabe en la fracción pedida', () => {
    // 1000 px a 10 px/m son 100 m de plano; el 25 % son 25 m → cabe 20, no 25.
    expect(metrosDeBarra(1000, 10)).toBe(20)
    expect(metrosDeBarra(1000, 10, 0.5)).toBe(50)
    expect(metrosDeBarra(1000, 10, 0.1)).toBe(10)
    // Escalas grandes: 1000 px a 200 px/m son 5 m; el 25 % es 1,25 m → 1 m.
    expect(metrosDeBarra(1000, 200)).toBe(1)
    // Y muy grandes: 0,5 m es un valor honrado, no un 0 disimulado.
    expect(metrosDeBarra(1000, 500)).toBe(0.5)
  })

  it('nunca se pasa de la fracción del ancho', () => {
    for (const sx of [0.5, 3, 12.7, 21.96, 137]) {
      expect(metrosDeBarra(2126, sx) * sx).toBeLessThanOrEqual(2126 * 0.25)
    }
  })

  it('rechaza lo que no es un número finito y positivo', () => {
    expect(() => metrosDeBarra('2126', 10)).toThrow(TypeError)
    expect(() => metrosDeBarra(2126, 0)).toThrow(RangeError)
    expect(() => metrosDeBarra(2126, 10, 0)).toThrow(RangeError)
    expect(() => metrosDeBarra(NaN, 10)).toThrow(RangeError)
  })

  it('la barra dibujada mide exactamente `N · sx` píxeles', async () => {
    const encuadre = encuadreNormal()
    const { plano, lienzo } = await componer({ encuadre })

    expect(plano.metrosBarra).toBe(metrosDeBarra(encuadre.anchoPx, encuadre.sx))
    const esperado = plano.metrosBarra * encuadre.sx
    // El contorno de la barra (`strokeRect`) es el que lleva la longitud entera.
    const contorno = lienzo
      .llamadas('strokeRect')
      .find((e) => Math.abs(e.args[2] - esperado) < 1e-9)
    expect(contorno, `ningún strokeRect mide ${esperado} px de ancho`).toBeDefined()
  })

  it('usa `sx` y NO el promedio de `sx` y `sy`', async () => {
    // ⚠️ **Con un encuadre real esto NO se puede distinguir, y por eso el encuadre
    // de esta prueba se retuerce a mano.** `bboxAlRatio` deja `sx` y `sy` iguales
    // salvo el residuo de restar coordenadas UTM de magnitud 4·10⁶: MEDIDO, 3,9·10⁻¹³
    // relativo, que sobre una barra de 20 m son 9·10⁻¹¹ px. Una prueba «sx vs.
    // promedio» sobre el encuadre normal daría VERDE con las dos implementaciones,
    // es decir, no probaría nada. Con `sy` duplicado, el promedio se separa un 25 %
    // y la diferencia entre leer un campo y leer el otro es visible.
    const real = encuadreNormal()
    const encuadre = { ...real, sy: real.sy * 2 }
    const { plano, lienzo } = await componer({ encuadre })

    const conSx = plano.metrosBarra * encuadre.sx
    const conPromedio = (plano.metrosBarra * (encuadre.sx + encuadre.sy)) / 2
    const contorno = lienzo.llamadas('strokeRect').map((e) => e.args[2])

    // Con `sy` duplicado, `(sx + 2·sy)/2 ≈ 1,5·sx`: la separación es del 50 %.
    expect(conPromedio / conSx).toBeCloseTo(1.5, 6)
    expect(contorno.some((ancho) => Math.abs(ancho - conSx) < 1e-9)).toBe(true)
    expect(contorno.some((ancho) => Math.abs(ancho - conPromedio) < 1e-9)).toBe(false)
  })

  it('el residuo entre `sx` y `sy` del encuadre real es real pero despreciable', () => {
    // La cifra que justifica la prueba de arriba, medida y no supuesta.
    const { sx, sy } = encuadreNormal()
    expect(sx).not.toBe(sy)
    expect(Math.abs(sx - sy) / sx).toBeLessThan(1e-11)
  })

  it('se rotula con `textoDeLongitud`, el formato compartido con las cotas', async () => {
    const { plano, lienzo } = await componer()
    const rotulos = lienzo.llamadas('fillText').map((e) => e.args[0])
    expect(rotulos).toContain(textoDeLongitud(plano.metrosBarra))
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 8 · EL VECTOR: COTAS, VÉRTICES Y NORTE
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · el vector encima de la cartografía', () => {
  it('acota los cuatro lados con su longitud en UTM y el formato compartido', async () => {
    const { lienzo } = await componer()
    const rotulos = lienzo.llamadas('fillText').map((e) => e.args[0])

    for (const metros of longitudesDeLados(EXTERIOR)) {
      expect(rotulos).toContain(textoDeLongitud(metros))
    }
    expect(rotulos.filter((t) => t === textoDeLongitud(20))).toHaveLength(2)
    expect(rotulos.filter((t) => t === textoDeLongitud(15))).toHaveLength(2)
  })

  it('la cota se gira con su lado y nunca queda boca abajo', async () => {
    const { lienzo } = await componer()
    for (const giro of lienzo.llamadas('rotate')) {
      expect(Math.abs(giro.args[0])).toBeLessThanOrEqual(Math.PI / 2 + 1e-9)
    }
  })

  it('los lados demasiado cortos para el papel no se acotan (el rótulo no cabría)', async () => {
    // Un chaflán de 1,41 m sobre la misma caja: no mueve el encuadre (los extremos
    // del rectángulo no cambian) pero mete un lado que en el papel mide ~5 mm.
    const chaflan = recintosDe([
      [439240, 4479655],
      [439259, 4479655],
      [439260, 4479656],
      [439260, 4479670],
      [439240, 4479670],
    ])
    const encuadre = encuadreNormal()
    const { lienzo } = await componer({ encuadre, recintos: chaflan })
    const rotulos = lienzo.llamadas('fillText').map((e) => e.args[0])

    // El umbral se DERIVA, no se escribe: la longitud del chaflán llevada a
    // milímetros de papel por el mismo mm→px que usa el módulo.
    const pxPorMm = encuadre.anchoPx / encuadre.anchoMm
    const largos = longitudesDeLados(chaflan[0].vertices)
    const corto = Math.min(...largos)
    expect((corto * encuadre.sx) / pxPorMm).toBeLessThan(MEDIDAS_MM.COTA_MINIMA)

    expect(rotulos).not.toContain(textoDeLongitud(corto))
    // Los demás lados sí se acotan, y el vértice del chaflán se dibuja igual: no
    // acotar un lado no es borrarlo del plano.
    for (const largo of largos.filter((l) => (l * encuadre.sx) / pxPorMm >= MEDIDAS_MM.COTA_MINIMA)) {
      expect(rotulos).toContain(textoDeLongitud(largo))
    }
    expect(rotulos.filter((t) => /^\d+$/.test(t))).toEqual(['1', '2', '3', '4', '5'])
  })

  it('numera los vértices desde 1 DENTRO de cada recinto, como la tabla del visor', async () => {
    const { lienzo } = await componer({ recintos: RECINTOS_CON_HUECO })
    const numeros = lienzo
      .llamadas('fillText')
      .map((e) => e.args[0])
      .filter((t) => /^\d+$/.test(t))

    // 4 + 4 vértices, numerados 1–4 y otra vez 1–4 (no 1–8).
    expect(numeros).toEqual(['1', '2', '3', '4', '1', '2', '3', '4'])
  })

  it('dibuja la flecha de norte VERTICAL y rotulada «Norte de cuadrícula»', async () => {
    const { plano, lienzo } = await componer()
    const rotulos = lienzo.llamadas('fillText').map((e) => e.args[0])

    expect(rotulos).toContain('N')
    expect(rotulos).toContain(TEXTO_NORTE)
    expect(TEXTO_NORTE).toMatch(/cuadrícula/)

    // El asta: un `moveTo`/`lineTo` con la MISMA x y hacia ARRIBA. En UTM el norte
    // de cuadrícula es +Y, y en el lienzo la y va invertida, así que «al norte» es
    // «menos y». Si algún día alguien inclinara la flecha por la convergencia, esta
    // prueba es la que se lo diría.
    // Se mira SOLO el bloque de norte —de la barra de escala en adelante—: el
    // lindero también tiene lados verticales y no se le puede confundir con el asta.
    const tramo = lienzo.log
      .slice(lienzo.indiceLlamada('fillText', (a) => a[0] === textoDeLongitud(plano.metrosBarra)))
      .filter((e) => e.tipo === 'llamada')
    const astas = []
    for (let i = 0; i < tramo.length - 1; i++) {
      if (tramo[i].nombre === 'moveTo' && tramo[i + 1].nombre === 'lineTo') {
        astas.push([tramo[i].args, tramo[i + 1].args])
      }
    }
    const vertical = astas.find(([desde, hasta]) => desde[0] === hasta[0] && desde[1] !== hasta[1])
    expect(vertical, 'no hay ningún segmento vertical en la flecha de norte').toBeDefined()
    expect(vertical[1][1]).toBeLessThan(vertical[0][1])
  })

  it('el trazo del usuario NO es el amarillo del visor, y el relleno SÍ lo lleva', async () => {
    // Sobre la cartografía clara del WMS, `#FFD600` da ~1,4:1: no se lee. El trazo
    // usa el ámbar oscuro que la hoja de estilos ya reserva para fondo claro.
    const { lienzo } = await componer()
    const trazos = lienzo.props('strokeStyle').map((e) => e.valor)
    const rellenos = lienzo.props('fillStyle').map((e) => e.valor)

    expect(COLORES_PLANO.USUARIO).toBe('#A16207')
    expect(trazos).toContain(COLORES_PLANO.USUARIO)
    expect(trazos).not.toContain(COLOR_USUARIO)
    expect(COLORES_PLANO.USUARIO_RELLENO.startsWith(COLOR_USUARIO)).toBe(true)
    expect(rellenos).toContain(COLORES_PLANO.USUARIO_RELLENO)
  })

  it('ni un color de mérito: nada verde ni rojo en todo el plano (regla de oro 9)', async () => {
    const { lienzo } = await componer({ recintosOficiales: recintosDe(EXTERIOR) })
    const colores = [...lienzo.props('fillStyle'), ...lienzo.props('strokeStyle')].map(
      (e) => String(e.valor).toUpperCase(),
    )
    const paleta = new Set(Object.values(COLORES_PLANO).map((c) => String(c).toUpperCase()))
    for (const color of colores) {
      expect(paleta.has(color), `color fuera de la paleta declarada: ${color}`).toBe(true)
    }
  })

  it('el cromo se dimensiona en MILÍMETROS de papel, no en píxeles fijos', async () => {
    // A doble resolución, el mismo trazo tiene que medir el doble de píxeles: es
    // lo que hace que el plano se vea igual a 300 y a 600 ppp.
    const grosores = async (ppp) => {
      const { lienzo } = await componer({ encuadre: encuadreNormal({ ppp }) })
      return lienzo.props('lineWidth').map((e) => e.valor)
    }
    const a300 = await grosores(300)
    const a600 = await grosores(600)
    expect(Math.max(...a600) / Math.max(...a300)).toBeCloseTo(2, 3)
    expect(Math.min(...a600) / Math.min(...a300)).toBeCloseTo(2, 3)

    // Y los valores absolutos son los declarados en MEDIDAS_MM: el trazo de la
    // parcela, 0,5 mm ≈ 5,9 px a 300 ppp; el de la oficial, 0,25 mm ≈ 3,0 px.
    const enPx = (mm, ppp) => (mm / 25.4) * ppp
    for (const medida of [MEDIDAS_MM.TRAZO_PARCELA, MEDIDAS_MM.TRAZO_OFICIAL, MEDIDAS_MM.HALO]) {
      expect(
        a300.some((px) => Math.abs(px - enPx(medida, 300)) < 0.01),
        `ningún trazo mide los ${medida} mm declarados`,
      ).toBe(true)
    }
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 9 · DATO DEGENERADO vs. CONTRATO ROTO
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · qué avisa y qué lanza', () => {
  it('un anillo de menos de 3 vértices se avisa y el plano sale sin él (no lanza)', async () => {
    const { plano, avisos, lienzo } = await componer({
      recintos: recintosDe(EXTERIOR, [
        [439248, 4479660],
        [439252, 4479660],
      ]),
    })

    expect(avisos.some((a) => /2 vértices/.test(a.mensaje))).toBe(true)
    expect(plano.jpeg).toBeInstanceOf(Uint8Array)
    // El exterior sí se dibuja: 4 números de vértice y ninguno más.
    const numeros = lienzo
      .llamadas('fillText')
      .map((e) => e.args[0])
      .filter((t) => /^\d+$/.test(t))
    expect(numeros).toEqual(['1', '2', '3', '4'])
  })

  it('una coordenada no utilizable se avisa y ese recinto no sale (no un trazo mudo)', async () => {
    const { avisos } = await componer({
      recintos: recintosDe(EXTERIOR, [
        [439248, Number.NaN],
        [439252, 4479660],
        [439252, 4479664],
      ]),
    })
    expect(avisos.some((a) => /coordenada no utilizable/.test(a.mensaje))).toBe(true)
  })

  it('lanza `TypeError` si el encuadre no es un encuadre de report/encuadre.js', async () => {
    const lienzo = crearLienzoFalso()
    const base = { recintos: RECINTOS, crearCanvas: lienzo.crearCanvas, alAvisar: () => {} }

    await expect(componerPlano()).rejects.toThrow(TypeError)
    await expect(componerPlano({ ...base, encuadre: null })).rejects.toThrow(/encuadrar/)
    await expect(
      componerPlano({ ...base, encuadre: { anchoPx: 10, altoPx: 10, sx: 1, sy: 1 } }),
    ).rejects.toThrow(/toPx/)
    await expect(
      componerPlano({ ...base, encuadre: { ...encuadreNormal(), teselas: [] } }),
    ).rejects.toThrow(/teselas/)
    await expect(
      componerPlano({ ...base, encuadre: { ...encuadreNormal(), anchoMm: undefined } }),
    ).rejects.toThrow(/anchoMm/)
  })

  it('lanza si los recintos, las capas o la calidad no son lo pactado', async () => {
    const lienzo = crearLienzoFalso()
    const imagen = crearImagenFalsa()
    const base = {
      encuadre: encuadreNormal(),
      recintos: RECINTOS,
      crearCanvas: lienzo.crearCanvas,
      CrearImagen: imagen.ImagenFalsa,
      alAvisar: () => {},
    }

    await expect(componerPlano({ ...base, recintos: 'no' })).rejects.toThrow(TypeError)
    await expect(componerPlano({ ...base, recintos: [{}] })).rejects.toThrow(/vertices/)
    await expect(componerPlano({ ...base, recintosOficiales: 7 })).rejects.toThrow(
      /recintosOficiales/,
    )
    await expect(componerPlano({ ...base, capas: [] })).rejects.toThrow(/capas/)
    await expect(componerPlano({ ...base, capas: ['a', ''] })).rejects.toThrow(/capa/)
    await expect(componerPlano({ ...base, calidad: 0 })).rejects.toThrow(RangeError)
    await expect(componerPlano({ ...base, calidad: 1.5 })).rejects.toThrow(RangeError)
    await expect(componerPlano({ ...base, alAvisar: 'no' })).rejects.toThrow(TypeError)
  })

  it('lanza si una dependencia de navegador no es inyectable (en Node no hay defecto)', async () => {
    // `null`, no `undefined`: `undefined` activa el valor por DEFECTO del parámetro
    // (`globalThis.Image`), que en jsdom existe y en Node no. Justo esa asimetría es
    // la que el mensaje explica.
    const lienzo = crearLienzoFalso()
    const base = {
      encuadre: encuadreNormal(),
      recintos: RECINTOS,
      crearCanvas: lienzo.crearCanvas,
      CrearImagen: crearImagenFalsa().ImagenFalsa,
      alAvisar: () => {},
    }
    await expect(componerPlano({ ...base, CrearImagen: null })).rejects.toThrow(/CrearImagen/)
    await expect(componerPlano({ ...base, crearCanvas: null })).rejects.toThrow(/crearCanvas/)
    await expect(componerPlano({ ...base, urlDeMapa: 'no' })).rejects.toThrow(/urlDeMapa/)
  })

  it('lanza —explicándolo— si el lienzo no da contexto 2D (el caso de jsdom)', async () => {
    // Es exactamente lo que ocurre con el `document.createElement('canvas')` real
    // de este entorno, y por lo que TODO el dibujo se prueba con dobles.
    await expect(
      componerPlano({
        encuadre: encuadreNormal(),
        recintos: RECINTOS,
        crearCanvas: () => ({ width: 0, height: 0, getContext: () => null }),
        CrearImagen: crearImagenFalsa().ImagenFalsa,
        alAvisar: () => {},
      }),
    ).rejects.toThrow(/contexto 2D/)
  })

  it('lanza si el lienzo no admite el tamaño pedido (techo de área del navegador)', async () => {
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({}),
      toDataURL: () => JPEG_DATA_URL,
    }
    Object.defineProperty(canvas, 'width', { get: () => 100, set: () => {} })
    await expect(
      componerPlano({
        encuadre: encuadreNormal(),
        recintos: RECINTOS,
        crearCanvas: () => canvas,
        CrearImagen: crearImagenFalsa().ImagenFalsa,
        alAvisar: () => {},
      }),
    ).rejects.toThrow(RangeError)
  })

  it('el lienzo se pide al tamaño exacto del encuadre', async () => {
    const encuadre = encuadreNormal()
    const { lienzo } = await componer({ encuadre })
    expect(lienzo.canvas.width).toBe(encuadre.anchoPx)
    expect(lienzo.canvas.height).toBe(encuadre.altoPx)
    expect([lienzo.canvas.width, lienzo.canvas.height]).toEqual([2126, 1535])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// 10 · EL CONTRATO B
// ═══════════════════════════════════════════════════════════════════════════

describe('report/canvas · el contrato B, completo', () => {
  it('devuelve los campos congelados del contrato, con sus tipos', async () => {
    const { plano } = await componer()

    expect(Object.keys(plano)).toEqual(
      expect.arrayContaining([
        'jpeg',
        'anchoPx',
        'altoPx',
        'teselasPedidas',
        'capasUsadas',
        'capasCaidas',
        'atribucion',
      ]),
    )
    expect(plano.jpeg).toBeInstanceOf(Uint8Array)
    expect(plano.anchoPx).toBe(2126)
    expect(plano.altoPx).toBe(1535)
    expect(Number.isInteger(plano.teselasPedidas)).toBe(true)
    expect(Array.isArray(plano.capasUsadas)).toBe(true)
    expect(Array.isArray(plano.capasCaidas)).toBe(true)
    expect(typeof plano.atribucion).toBe('string')
  })

  it('la atribución sale de viewer/atribucion.js, no escrita a mano', async () => {
    const { plano } = await componer()
    expect(plano.atribucion).toBe(ATRIBUCION.CATASTRO)

    const conVarias = await componer({ opciones: { clavesAtribucion: ['CATASTRO', 'PNOA'] } })
    expect(conVarias.plano.atribucion).toBe(`${ATRIBUCION.CATASTRO} · ${ATRIBUCION.PNOA}`)
  })

  it('una clave de atribución inventada revienta (no se imprime un pie a medias)', async () => {
    await expect(componer({ opciones: { clavesAtribucion: ['INVENTADA'] } })).rejects.toThrow(
      RangeError,
    )
  })

  it('…y revienta TAMBIÉN cuando no llega cartografía, antes de pedir nada', async () => {
    // Si el pie se compusiera al final, una clave inventada solo saltaría en las
    // composiciones en las que además hubo cartografía: un contrato que se comprueba
    // según cómo venga la red. Y salta ANTES de gastar una petición.
    const imagen = crearImagenFalsa(() => ({ ok: false }))
    await expect(
      componer({ imagen, opciones: { clavesAtribucion: ['INVENTADA'] } }),
    ).rejects.toThrow(RangeError)
    expect(imagen.total()).toBe(0)
  })

  it('no lee el reloj: dos composiciones seguidas dan los mismos bytes', async () => {
    const a = await componer()
    const b = await componer()
    expect([...a.plano.jpeg]).toEqual([...b.plano.jpeg])
    expect(a.plano.metrosBarra).toBe(b.plano.metrosBarra)
  })
})

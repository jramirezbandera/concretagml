/* -------------------------------------------------------------------------- *
 * test/report/aceptacion-f09.dom.test.js — F09 · T6.1 · SUITE DE ACEPTACIÓN    *
 *                                                                              *
 * La prueba que decide si F09 está hecha. Los CINCO criterios de               *
 * `spec/feature-09-informe-parcela.md` § «Criterios de aceptación», uno a uno   *
 * y con su texto LITERAL en el nombre del `describe`:                           *
 *                                                                              *
 *   AC1 · «El canvas compuesto exporta con `toDataURL` sin `SecurityError`     *
 *         (test en proyecto `dom` con tesela CORS simulada; control negativo   *
 *         TAINTED valida la prueba).»  ⚠️ NO SE PUEDE MEDIR AQUÍ — ver § 4.     *
 *   AC2 · «El mapeo UTM→px coloca los vértices en el píxel correcto (función   *
 *         pura testeada).»                                                     *
 *   AC3 · «Si la salida supera el `MaxWidth` del WMS, se parte en varias       *
 *         `GetMap` y se recomponen sin costura.»                               *
 *   AC4 · «La descripción literaria de una geometría fixture recorre horario   *
 *         desde el NO y agrupa tramos; es editable.»                           *
 *   AC5 · «El PDF lleva pie de firma configurable y el nombre correcto;        *
 *         ninguna cifra del diagnóstico lleva color de mérito.»                *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * ⚠️ EL CRITERIO 1 **NO SE PUEDE MEDIR EN ESTE FICHERO**, Y SE DICE            *
 * ════════════════════════════════════════════════════════════════════════════ *
 * **jsdom no tiene contexto 2D.** El paquete `canvas` no está instalado y no   *
 * se va a instalar (compila binarios nativos; desviación 1 declarada en el     *
 * plan de F09 antes de empezar). Medido y afirmado en el § 4.1:                *
 * `getContext('2d')` devuelve `null` y `toDataURL()` devuelve **`null`**, ni   *
 * siquiera lanza. O sea: **un test que solo comprobara «`toDataURL` no lanza   *
 * `SecurityError`» estaría en VERDE sin haber exportado ni un píxel.** Ésa es  *
 * exactamente la clase de criterio de aceptación que no protege de nada, y     *
 * este proyecto ya sabe lo que cuesta (SPEC §3.1: un guardián que no se        *
 * ejecuta no protege de nada).                                                 *
 *                                                                              *
 * **Dónde se mide de verdad:** en el guion de navegador                        *
 * `scripts/smoke-navegador/11-informe-pdf.js` (T6.2), contra el WMS REAL del   *
 * Catastro y **con el control negativo TAINTED** que la propia spec exige      *
 * —una tesela cargada SIN `crossOrigin` que tiene que hacer fallar             *
 * `toDataURL`—. Sin ese control, la mitad positiva pasaría igual con un        *
 * `crossOrigin` que no sirviera para nada.                                     *
 *                                                                              *
 * **Lo que SÍ se mide aquí, y es el fallo REAL** (§ 4.2 y § 4.3): un lienzo    *
 * contaminado casi nunca viene de OLVIDAR `crossOrigin`; viene de ponerlo      *
 * TARDE, después de `src`, cuando la carga ya arrancó en el modo por defecto.  *
 * Ese bug es invisible en cualquier otra prueba —la imagen carga, se dibuja,   *
 * todo va bien— hasta que `toDataURL` lanza al final del todo. Y la SEGUNDA    *
 * RED: que el tamaño sustituido en silencio por el WMS se caza en los dos      *
 * extremos de la cadena (`naturalWidth`/`naturalHeight` en el lienzo, `SOF`    *
 * del JPEG en el PDF).                                                         *
 *                                                                              *
 * Precedente de la casa: el AC4 de F08 se declaró cumplido **A MEDIAS** en su  *
 * propia suite (`test/comprobacion/aceptacion-f08.dom.test.js`, § 7) en vez de *
 * fingirse. Un verde falso en un criterio de aceptación es peor que un rojo:   *
 * el rojo se arregla, el verde falso se hereda.                                *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LAS CUATRO REGLAS QUE GOBIERNAN ESTE FICHERO                                 *
 * ════════════════════════════════════════════════════════════════════════════ *
 * 1. **SOBRE LA PARCELA REAL Y SUS CUATRO COLINDANTES REALES.** Todo sale de   *
 *    9398516VK3799G y de su vecindad del WFS                                   *
 *    (`test/fixtures/catastro/wfs-neighbour-9398516VK3799G.xml`, 5 miembros    *
 *    para 4 colindantes con la propia en 2.ª — override O15), más los dos      *
 *    fixtures de `Consulta_DNPRC` medidos en vivo en T0.2. **No se inventa un  *
 *    POJO**: un informe montado sobre datos de juguete demuestra que el        *
 *    maquetador compila, no que el documento sirva.                            *
 * 2. **ORÁCULOS PROPIOS.** El área firmada sale de una shoelace de cuatro      *
 *    líneas escrita aquí (regla de oro 5: trasladada a origen local), la       *
 *    esquina NO de un min/max propio, y el mapeo UTM→px se contrasta con una   *
 *    REGLA sobre el papel: milímetros desde el borde según la escala rotulada. *
 *    Preguntarle a `geo/` si está de acuerdo consigo mismo no es un oráculo    *
 *    (misma disciplina que las suites de aceptación de F06 y F07).             *
 * 3. **NO SE DUPLICAN LAS UNITARIAS.** Cada `it` cita la frase del criterio a  *
 *    la que está atado. Lo que ya afirma un test de módulo se REMITE:          *
 *      · el encuadre número a número, la escala y el contrato roto →           *
 *        `test/report/encuadre.test.js`;                                       *
 *      · el orden de dibujo, la capa que se cae, la barra de escala y el       *
 *        contrato B completo → `test/report/canvas.dom.test.js`;               *
 *      · el lindero tramo a tramo, la vía pública y la nota técnica →          *
 *        `test/report/literal.test.js`;                                        *
 *      · el encabezado, el identificador y la neutralidad jurídica del pie →   *
 *        `test/report/firma.test.js`;                                          *
 *      · la maqueta, el oráculo geométrico y el guardián de vocabulario        *
 *        completo → `test/report/pdf-parcela.test.js`;                         *
 *      · el escritor de PDF y el `SOF` del JPEG → `test/report/pdf.test.js`;   *
 *      · el diálogo nodo a nodo y la presunción → `test/app/dialogo-informe.   *
 *        dom.test.js`;                                                         *
 *      · el cable completo (preparar → editar → componer → entregar) →         *
 *        `test/app/informe.dom.test.js`.                                       *
 * 4. **CADA GUARDIÁN, CON SU PRUEBA DE QUE DISPARA.** Es la disciplina de      *
 *    `test/gml/aceptacion-f04.test.js`: un guardián que nunca se ha visto en   *
 *    rojo es una promesa, no una prueba. El doble de `Image`, el extractor de  *
 *    grises y el oráculo de la regla se prueban contra un caso que TIENE que   *
 *    ponerlos en rojo.                                                         *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom): lo enruta el sufijo `.dom.test.js`, y hace    *
 * falta para el § 4 (canvas e `Image`) y para el «es editable» del § 7.        *
 * -------------------------------------------------------------------------- */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, afterEach, vi } from 'vitest'

import { SELECTOR as SELECTOR_DIALOGO, crearDialogoInforme } from '../../app/dialogo-informe.js'
import { diagnosticar } from '../../diagnostico/parcela.js'
import { parsearGml } from '../../gml/parse.js'
import { CALIDAD_JPEG, FORMATO_PLANO, componerPlano } from '../../report/canvas.js'
import { MAX_PIXELES_TESELA, PPP_INFORME, encuadrar } from '../../report/encuadre.js'
import {
  CAMPOS_FIRMA,
  NO_CONSTA,
  ROTULO_FIRMA,
  componerEncabezado,
} from '../../report/firma.js'
import { PRESUNCION, describirLindero } from '../../report/literal.js'
import { A4_ALTO_MM, A4_ANCHO_MM, PUNTOS_POR_MM, crearDocumentoPdf } from '../../report/pdf.js'
import { NOMBRE_INFORME, informePdfParcela } from '../../report/pdf-parcela.js'
import { leerDnprc } from '../../services/_catastro-dnp.js'

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La verdad-terreno: la parcela real, sus cuatro colindantes y los fixtures
// ═════════════════════════════════════════════════════════════════════════════

const RAIZ = join(import.meta.dirname, '..', '..')
const leer = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')

/** Clon profundo por JSON: vale porque el modelo es POJO plano (regla de oro 4). */
const clon = (v) => JSON.parse(JSON.stringify(v))

const REF = '9398516VK3799G'

/** `GetNeighbourParcel` real: 5 miembros para 4 colindantes, con la propia (O15). */
const VECINDARIO = parsearGml(
  leer('test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml'),
).parcelas.map((p) => ({ refcat: p.refcat, label: p.label, recintos: p.recintos }))

const PROPIA = VECINDARIO.find((v) => v.refcat === REF)
const VECINAS_FIXTURE = VECINDARIO.filter((v) => v.refcat !== REF)

/** La geometría OFICIAL, intacta. Se clona en cada uso: regla de oro 2. */
const oficial = () => clon(PROPIA.recintos)
const vecinas = () => clon(VECINAS_FIXTURE)

/** El anillo exterior tal como llega del WFS. 15 vértices, sentido horario (O1). */
const ANILLO = PROPIA.recintos[0].vertices

/**
 * La geometría EDITADA: la oficial con su primer vértice movido **0,40 m al
 * este**. Es el caso MEDIDO de `test/diagnostico/parcela.test.js` y el que usan
 * las suites de F07 y de T3.2: una sola edición produce las ocho métricas a la
 * vez, con TRES invasiones reales a colindantes.
 */
function editada() {
  const r = oficial()
  r[0].vertices[0] = [r[0].vertices[0][0] + 0.4, r[0].vertices[0][1]]
  return r
}

/** El GML de UNA parcela: de ahí sale el `cp:areaValue` que declara el Catastro. */
const DECLARADA = parsearGml(
  leer('test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml'),
).parcelas[0].areaValue

/** El `Consulta_DNPRC` de la finca urbana, medido en vivo en T0.2. */
const DNP_URBANA = leerDnprc(
  leer('test', 'fixtures', 'catastro', 'ovc-dnprc-urbana-9398516VK3799G.json'),
)

/**
 * Un JPEG REAL de 24×16 px con su APP0/JFIF, sus tablas y su SOF0 de 3
 * componentes: la forma de lo que devuelve el WMS del Catastro. Diminuto a
 * propósito — aquí se prueban los criterios, no la cartografía.
 */
const JPEG = Uint8Array.from(readFileSync(join(RAIZ, 'test', 'fixtures', 'report', 'plano-prueba.jpg')))
const JPEG_ANCHO_PX = 24
const JPEG_ALTO_PX = 16

/** Instante FIJO: ningún módulo de `report/` lee el reloj, y así se puede afirmar. */
const FECHA = new Date(Date.UTC(2026, 7, 2, 17, 4, 53))

/** El tamaño del plano en el papel, el mismo que fija `app/cableado-informe.js`. */
const ANCHO_PLANO_MM = 180
const ALTO_PLANO_MM = 130

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Oráculos propios, que NO comparten una línea con lo que se prueba
// ═════════════════════════════════════════════════════════════════════════════

const distancia = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1])

/**
 * Área firmada por la fórmula del cordón de zapato, TRASLADADA a origen local
 * (regla de oro 5): sobre UTM absolutas (Norte ≈ 4,5·10⁶) la misma suma pierde
 * ~4·10⁻⁵ m² por cancelación en float64. Negativa ⇒ HORARIO. Es el oráculo de
 * aceptación de F04, F06 y F07, reescrito aquí para no compartir nada con
 * `geo/area.js`.
 */
function shoelace(anillo) {
  const [ox, oy] = anillo[0]
  let suma = 0
  for (let i = 0; i < anillo.length; i++) {
    const a = anillo[i]
    const b = anillo[(i + 1) % anillo.length]
    suma += (a[0] - ox) * (b[1] - oy) - (b[0] - ox) * (a[1] - oy)
  }
  return suma / 2
}

/** Perímetro de un anillo cerrado, sumando lado a lado. */
const perimetro = (anillo) =>
  anillo.reduce((s, v, i) => s + distancia(v, anillo[(i + 1) % anillo.length]), 0)

/** La caja envolvente, con un min/max escrito aquí y no importado de `geo/bbox.js`. */
function cajaDe(anillo) {
  const xs = anillo.map((v) => v[0])
  const ys = anillo.map((v) => v[1])
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Dobles instrumentados del navegador (los mismos planteamientos de T3.1,
//     reescritos aquí para medir LOS CRITERIOS, no el módulo)
// ═════════════════════════════════════════════════════════════════════════════

/** Métodos del contexto 2D que `report/canvas.js` usa. */
const METODOS_CTX = [
  'save', 'restore', 'beginPath', 'moveTo', 'lineTo', 'closePath', 'fill', 'stroke',
  'fillRect', 'strokeRect', 'drawImage', 'translate', 'rotate', 'fillText', 'strokeText',
  'setLineDash',
]

/** Propiedades del contexto cuya asignación también se apunta, en la misma lista. */
const PROPIEDADES_CTX = [
  'fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline',
  'lineJoin', 'lineCap',
]

/** JPEG mínimo reconocible por `report/canvas.js`: SOI + EOI. */
const BYTES_JPEG_MINIMO = [0xff, 0xd8, 0xff, 0xd9]
const JPEG_DATA_URL = `data:image/jpeg;base64,${btoa(String.fromCharCode(...BYTES_JPEG_MINIMO))}`

/**
 * Lienzo falso: registra en UNA lista ordenada las llamadas de dibujo y las
 * asignaciones de propiedad. `save()`/`restore()` no restauran nada: aquí solo se
 * afirma sobre la SECUENCIA y sobre los argumentos, nunca sobre el estado final.
 */
function crearLienzoFalso({ dataUrl = JPEG_DATA_URL, alExportar = null } = {}) {
  const log = []
  const ctx = {}
  for (const nombre of METODOS_CTX) ctx[nombre] = (...args) => log.push({ nombre, args })
  for (const nombre of PROPIEDADES_CTX) {
    let valor = null
    Object.defineProperty(ctx, nombre, { get: () => valor, set: (v) => { valor = v } })
  }
  const canvas = {
    width: 0,
    height: 0,
    getContext: (tipo) => (tipo === '2d' ? ctx : null),
    toDataURL: (mime, calidad) => {
      log.push({ nombre: 'toDataURL', args: [mime, calidad] })
      if (alExportar !== null) alExportar()
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
    llamadas: (nombre) => log.filter((e) => e.nombre === nombre),
  }
}

/** `WIDTH`/`HEIGHT` que viajan en una URL de `GetMap`. */
const tamanoDeUrl = (url) => ({
  ancho: Number(/[?&]WIDTH=(\d+)/.exec(url)[1]),
  alto: Number(/[?&]HEIGHT=(\d+)/.exec(url)[1]),
})

/**
 * `Image` falso. Lo que lo hace útil no es que simule la carga —eso lo hace
 * cualquiera— sino que **apunta el ORDEN en que se le asignan las propiedades**,
 * que es lo único que puede delatar el bug del criterio 1 sin un navegador.
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
      // Asíncrono como el de verdad: resolver en la misma vuelta dejaría pasar a
      // un módulo que asignara `onload` DESPUÉS de `src`.
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

  return { ImagenFalsa, emitidas, urls: () => emitidas.map((i) => i.src) }
}

/** El encuadre REAL de la parcela real, que es el que compone el informe. */
const encuadreReal = (extra = {}) =>
  encuadrar({ recintos: oficial(), anchoMm: ANCHO_PLANO_MM, altoMm: ALTO_PLANO_MM, ...extra })

/** Compone el plano de la parcela real con todo el navegador doblado. */
async function componerConDobles({ encuadre = encuadreReal(), imagen, lienzo, recintos } = {}) {
  const elLienzo = lienzo ?? crearLienzoFalso()
  const laImagen = imagen ?? crearImagenFalsa()
  const avisos = []
  const plano = await componerPlano({
    encuadre,
    recintos: recintos ?? oficial(),
    crearCanvas: elLienzo.crearCanvas,
    CrearImagen: laImagen.ImagenFalsa,
    alAvisar: (mensaje, detalle) => avisos.push({ mensaje, detalle }),
  })
  return { plano, lienzo: elLienzo, imagen: laImagen, avisos }
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · AC1 · «El canvas compuesto exporta con `toDataURL` sin `SecurityError`
//           (test en proyecto `dom` con tesela CORS simulada; control negativo
//           TAINTED valida la prueba).»
//
//           ⚠️ DECLARADO NO MEDIBLE AQUÍ. Ver la cabecera del fichero.
// ═════════════════════════════════════════════════════════════════════════════

describe('F09 · AC1 · ⚠️ el canvas compuesto exporta con toDataURL sin SecurityError — NO SE PUEDE MEDIR EN jsdom, y se dice', () => {
  it('MEDIDO: jsdom no da contexto 2D, y `toDataURL` devuelve `null` sin lanzar', () => {
    // ⛔ ÉSTE es el motivo por el que el criterio 1 no se puede fingir aquí, y está
    // medido en vez de supuesto. Sin contexto 2D no hay lienzo que contaminar, no
    // hay `drawImage` real que lo contamine y no hay `toDataURL` que lance: la
    // aserción «no lanza SecurityError» saldría VERDE sin haber exportado nada.
    // Los dos métodos escriben además un «Not implemented: HTMLCanvasElement's
    // getContext() method: without installing the canvas npm package» en la consola
    // VIRTUAL de jsdom. Esas tres líneas salen en la ejecución de esta suite y no se
    // silencian: no pasan por `console.error` —medido, un `vi.spyOn` sobre él no las
    // intercepta porque el `sendTo(console)` de jsdom guardó la referencia antes—, y
    // además dicen exactamente lo que esta sección viene a declarar.
    const lienzo = document.createElement('canvas')

    expect(lienzo.getContext('2d')).toBeNull()
    expect(typeof lienzo.toDataURL).toBe('function')
    expect(lienzo.toDataURL('image/jpeg', CALIDAD_JPEG)).toBeNull()
    // Y no lanza: si lanzara, al menos habría algo que distinguir. No lanzando, un
    // `expect(...).not.toThrow()` sobre `toDataURL` es una aserción sin contenido.
    expect(() => lienzo.toDataURL()).not.toThrow()
  })

  it('el paquete `canvas` NO está instalado, y no es un descuido que se pueda arreglar', () => {
    // Compila binarios nativos en Windows; es la desviación 1 declarada en el plan
    // de F09 antes de empezar. Anti-vacuidad: la MISMA resolución de ruta sí
    // encuentra a `jsdom`, así que este `existsSync` no está mirando al vacío.
    expect(existsSync(join(RAIZ, 'node_modules', 'jsdom'))).toBe(true)
    expect(
      existsSync(join(RAIZ, 'node_modules', 'canvas')),
      'el paquete `canvas` ha aparecido en node_modules: si es deliberado, este ' +
        'criterio ya SÍ se puede medir aquí y hay que reescribir esta sección entera ' +
        'en vez de dejarla remitiendo al guion 11.',
    ).toBe(false)
    expect(leer('package.json')).not.toMatch(/"canvas":/)
  })

  it('SE REMITE AL GUION 11 · el fichero que sí lo mide existe y lleva su control negativo', () => {
    // Un «se mide en otro sitio» sin comprobar que ese sitio existe es una promesa.
    // El guion 11 (T6.2) corre en navegador de verdad, con tesela real del Catastro
    // y con el control negativo que la propia spec exige.
    const guion = join(RAIZ, 'scripts', 'smoke-navegador', '11-informe-pdf.js')
    expect(
      existsSync(guion),
      `${guion} no existe: el criterio 1 se está remitiendo a un fichero que no está. ` +
        'Es T6.2 y va en paralelo con esta tarea.',
    ).toBe(true)
    const fuente = readFileSync(guion, 'utf8')
    expect(fuente, 'el guion 11 no exporta con `toDataURL`').toMatch(/toDataURL/)
    expect(fuente, 'el guion 11 no busca el `SecurityError` del criterio').toMatch(/SecurityError/)
    expect(
      fuente,
      'el guion 11 no lleva el CONTROL NEGATIVO (la tesela contaminada): sin él, la mitad ' +
        'positiva pasaría igual con un `crossOrigin` que no sirviera para nada, y el criterio 1 ' +
        'se quedaría sin medir en NINGÚN sitio del proyecto.',
    ).toMatch(/controlNegativo|control negativo/)
  })
})

// ── 4.2 · Lo que SÍ es medible aquí, y es el fallo REAL ──────────────────────

describe('F09 · AC1 · lo medible del criterio 1: `crossOrigin` se asigna ANTES que `src`', () => {
  it('en TODAS las imágenes del plano de la parcela real, y con valor `anonymous`', async () => {
    // Un lienzo contaminado casi nunca viene de OLVIDAR `crossOrigin`: viene de
    // ponerlo TARDE. Asignado después de `src` la carga ya arrancó en el modo por
    // defecto, el atributo no surte efecto, la imagen carga, se dibuja, todo va
    // bien — y `toDataURL` lanza `SecurityError` al final del todo, cuando ya no se
    // sabe de dónde vino. Es el único frente del criterio 1 que jsdom permite medir.
    const { imagen } = await componerConDobles()

    expect(imagen.emitidas.length).toBeGreaterThan(0)
    for (const img of imagen.emitidas) {
      const iCross = img.orden.indexOf('crossOrigin')
      const iSrc = img.orden.indexOf('src')
      expect(iCross, 'nunca se asignó `crossOrigin`').toBeGreaterThanOrEqual(0)
      expect(iSrc, 'nunca se asignó `src`').toBeGreaterThanOrEqual(0)
      expect(
        iCross,
        'con `crossOrigin` asignado DESPUÉS de `src` el atributo no surte efecto y el lienzo ' +
          'queda contaminado aunque el servidor emita Access-Control-Allow-Origin (override O7)',
      ).toBeLessThan(iSrc)
      expect(img.crossOrigin).toBe('anonymous')
    }
  })

  it('DISPARA: el propio doble detecta el orden inverso (si no, no estaría midiendo nada)', () => {
    const { ImagenFalsa } = crearImagenFalsa()
    const img = new ImagenFalsa()
    img.src = 'https://ejemplo/?WIDTH=1&HEIGHT=1'
    img.crossOrigin = 'anonymous'
    expect(img.orden).toEqual(['src', 'crossOrigin'])
    expect(img.orden.indexOf('crossOrigin')).toBeGreaterThan(img.orden.indexOf('src'))
  })

  it('y si el lienzo SÍ sale contaminado, no se devuelve un plano a medias: se lanza explicado', async () => {
    // La otra mitad del criterio, la que sí se puede afirmar sin contexto 2D: qué
    // pasa cuando el `SecurityError` ocurre. No se traga, no se devuelve un plano
    // vacío que acabaría incrustado en un PDF firmable — se lanza, con la causa a la
    // vista y nombrando el orden `crossOrigin`/`src`, que es la pista que hace falta.
    const lienzo = crearLienzoFalso({
      alExportar: () => {
        throw new Error('SecurityError: Tainted canvases may not be exported.')
      },
    })
    await expect(componerConDobles({ lienzo })).rejects.toThrow(/crossOrigin.*después de `src`/s)
  })

  it('y el plano se exporta como JPEG con la calidad pactada, no como lo que caiga', async () => {
    // El paso 7 de la Receta A. Si `toDataURL` cayera a PNG en silencio —la
    // especificación HTML lo manda cuando el tipo pedido no está soportado— los
    // bytes serían veneno para el `/DCTDecode` del PDF; eso lo cubre entero
    // `test/report/canvas.dom.test.js` y aquí solo se afirma la forma de la llamada.
    const { lienzo, plano } = await componerConDobles()
    const exportacion = lienzo.llamadas('toDataURL')
    expect(exportacion).toHaveLength(1)
    expect(exportacion[0].args).toEqual([FORMATO_PLANO, CALIDAD_JPEG])
    expect(plano.jpeg).toBeInstanceOf(Uint8Array)
    expect([...plano.jpeg]).toEqual(BYTES_JPEG_MINIMO)
  })
})

// ── 4.3 · La segunda red: el tamaño sustituido, cazado en los dos extremos ───

describe('F09 · AC1 · la segunda red: el tamaño que el WMS sustituye en silencio se caza dos veces', () => {
  it('en el LIENZO: `naturalWidth`/`naturalHeight` distintos de lo pedido ⇒ no se dibuja y se declara', async () => {
    // Hecho MEDIDO el 2026-08-02 contra el servicio real: se pidió 4200×100 y
    // 5000×100 y devolvió 4000×2000 SUSTITUYENDO las dos dimensiones, con HTTP 200
    // y sin aviso. El `load` dispara igual, así que **el `load` no es la
    // comprobación**. Un plano dibujado sobre una imagen del tamaño equivocado sale
    // con toda la geometría descolocada bajo una escala correctamente rotulada:
    // exactamente el documento que no se puede firmar.
    const encuadre = encuadreReal()
    const imagen = crearImagenFalsa(() => ({ ok: true, ancho: 4000, alto: 2000 }))
    const { plano, lienzo, avisos } = await componerConDobles({ encuadre, imagen })

    expect(lienzo.llamadas('drawImage')).toHaveLength(0)
    expect(plano.teselasDibujadas).toBe(0)
    expect(plano.teselasCaidas).toHaveLength(1)
    expect(plano.teselasCaidas[0].motivo).toMatch(/4000×2000/)
    expect(plano.teselasCaidas[0].motivo).toMatch(`${encuadre.anchoPx}×${encuadre.altoPx}`)
    // Y se dice en el panel de avisos: una tesela no se cae en silencio (regla 1).
    expect(avisos.some((a) => /4000×2000/.test(a.mensaje))).toBe(true)
  })

  it('con el tamaño correcto SÍ se dibuja, así que la red de arriba no es un «nunca dibuja»', async () => {
    const { plano, lienzo } = await componerConDobles()
    expect(lienzo.llamadas('drawImage')).toHaveLength(1)
    expect(plano.teselasDibujadas).toBe(1)
    expect(plano.teselasCaidas).toEqual([])
  })

  it('en el PDF: `imagenJpeg` LANZA si los píxeles declarados no cuadran con el `SOF` real', () => {
    // La segunda red, al otro extremo de la cadena. Aquí ya no hay `naturalWidth`
    // que mirar: se releen los bytes del JPEG y se contrasta su `SOF` contra lo que
    // el llamante dice que trae. Si no cuadran, el plano se estaría metiendo en el
    // papel con el tamaño de otro.
    const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
    const caja = { x: 15, y: 40, anchoMm: 180, altoMm: 120 }

    expect(() =>
      doc.imagenJpeg(JPEG, { ...caja, anchoPx: 4000, altoPx: JPEG_ALTO_PX }),
    ).toThrow(RangeError)
    expect(() => doc.imagenJpeg(JPEG, { ...caja, anchoPx: JPEG_ANCHO_PX, altoPx: 2000 })).toThrow(
      /se declaran 2000 px de alto y el JPEG trae 16/,
    )
    // Anti-vacuidad: con los píxeles de verdad NO lanza y devuelve el tamaño leído
    // del propio fichero, no el que se le pasó.
    const puesta = doc.imagenJpeg(JPEG, {
      ...caja,
      anchoPx: JPEG_ANCHO_PX,
      altoPx: JPEG_ALTO_PX,
    })
    expect([puesta.anchoPx, puesta.altoPx]).toEqual([JPEG_ANCHO_PX, JPEG_ALTO_PX])
  })

  it('…y la red llega hasta `informePdfParcela`: un plano que miente sobre su tamaño no se maqueta', () => {
    // El criterio no se cumple con que lance el escritor de bajo nivel: tiene que
    // llegar arriba, que es donde el llamante monta el contrato B.
    expect(() => informe({ plano: planoDe({ anchoPx: 4000 }) })).toThrow(RangeError)
    expect(() => informe({ plano: planoDe() })).not.toThrow()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · AC2 · «El mapeo UTM→px coloca los vértices en el píxel correcto (función
//           pura testeada).»
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Un caso de números REDONDOS, calculado a mano y no derivado de la
 * implementación:
 *
 *   · cuadrado de 100 × 100 m, sin margen ⇒ la caja ES el cuadrado y el ratio ya
 *     es 1, así que el ajuste al ratio no la toca;
 *   · 100 mm de papel a **254 ppp** ⇒ `100/25,4 · 254 = 1000` px exactos en cada
 *     eje (el 254 se elige justamente para que el redondeo no exista);
 *   · ⇒ `sx = sy = 1000 px / 100 m = 10 px/m`;
 *   · ⇒ escala `100 m · 1000 / 100 mm = 1:1000` EXACTA.
 *
 * Con esos cuatro números, dónde cae cada punto se puede escribir con un lápiz.
 */
const CUADRADO_100 = [
  {
    tipo: 'EXTERIOR',
    vertices: [
      [400000, 4400000],
      [400100, 4400000],
      [400100, 4400100],
      [400000, 4400100],
    ],
  },
]

describe('F09 · AC2 · el mapeo UTM→px coloca los vértices en el píxel correcto (función pura testeada)', () => {
  const e = encuadrar({ recintos: CUADRADO_100, anchoMm: 100, altoMm: 100, ppp: 254, margenM: 0 })

  it('el caso de lápiz sale como dice el lápiz: 1000 px, 10 px/m, 1:1000', () => {
    expect([e.anchoPx, e.altoPx]).toEqual([1000, 1000])
    expect([e.sx, e.sy]).toEqual([10, 10])
    expect(e.escalaExacta).toBe(1000)
    expect(e.escalaDenominador).toBe(1000)
    expect(e.bbox).toEqual({ minX: 400000, minY: 4400000, maxX: 400100, maxY: 4400100 })
  })

  it('los cuatro vértices caen en los cuatro píxeles que les tocan, con la Y INVERTIDA', () => {
    // El norte ARRIBA: la esquina de máximo Y es la fila 0, no la última. Si alguien
    // quitara la inversión, estas cuatro aserciones cambiarían de pareja dos a dos y
    // el plano saldría del revés — legible, bien rotulado y falso.
    expect(e.toPx([400000, 4400100]), 'NO → (0,0)').toEqual([0, 0])
    expect(e.toPx([400100, 4400100]), 'NE → (ancho,0)').toEqual([1000, 0])
    expect(e.toPx([400000, 4400000]), 'SO → (0,alto)').toEqual([0, 1000])
    expect(e.toPx([400100, 4400000]), 'SE → (ancho,alto)').toEqual([1000, 1000])
    // Y el centro, que es el punto que un error de signo NO movería: sin esta pareja
    // de arriba, un mapeo espejado pasaría el test del centro tan campante.
    expect(e.toPx([400050, 4400050])).toEqual([500, 500])
  })

  it('DISPARA: la inversión está de verdad ahí — el NO y el SO no caen en la misma fila', () => {
    // Mitad anti-vacuidad de lo anterior. Con la Y sin invertir los dos irían a la
    // misma esquina y las cuatro aserciones seguirían pareciendo razonables.
    expect(e.toPx([400000, 4400100])[1]).not.toBe(e.toPx([400000, 4400000])[1])
    expect(e.toPx([400000, 4400100])[1]).toBeLessThan(e.toPx([400000, 4400000])[1])
  })

  it('SOBRE LA PARCELA REAL · los 15 vértices caen donde los pone una REGLA sobre el papel', () => {
    // El oráculo INDEPENDIENTE, y el que de verdad importa: el informe declara una
    // escala, y quien lo recibe puede coger una regla y medir. Un vértice que está a
    // `d` metros del borde oeste de la caja tiene que salir impreso a
    // `d · 1000 / escalaExacta` milímetros del borde izquierdo del plano, o sea a
    // `mm/25,4 · ppp` píxeles. Esa cuenta pasa por la ESCALA ROTULADA y no por
    // `sx`/`sy`, así que un error en la aritmética del mapeo rompería la igualdad.
    const real = encuadreReal()
    let peor = 0
    for (const v of ANILLO) {
      const mmDesdeIzquierda = ((v[0] - real.bbox.minX) * 1000) / real.escalaExacta
      const mmDesdeArriba = ((real.bbox.maxY - v[1]) * 1000) / real.escalaExacta
      const [px, py] = real.toPx(v)
      peor = Math.max(
        peor,
        Math.abs(px - (mmDesdeIzquierda / 25.4) * PPP_INFORME),
        Math.abs(py - (mmDesdeArriba / 25.4) * PPP_INFORME),
      )
    }
    // MEDIDO: 0,013 px, que a 300 ppp son 1,1 µm de papel. No es 0 porque los
    // píxeles del lienzo son ENTEROS (2126 × 1535) y eso deja la resolución real en
    // 300,002 ppp en X y 299,915 en Y; el módulo devuelve esa desviación en
    // `pppReal` en vez de dejar que se suponga (regla de oro 1).
    expect(peor).toBeLessThan(0.02)
    expect(real.pppReal.x).toBeCloseTo(PPP_INFORME, 1)
    expect(real.pppReal.y).toBeCloseTo(PPP_INFORME, 0)
  })

  it('DISPARA: el oráculo de la regla nota un vértice movido un metro', () => {
    // Sin esto, «los 15 caen donde los pone la regla» podría estar comparando dos
    // cosas que siempre coinciden. Un metro sobre el terreno son ~22 px de plano.
    const real = encuadreReal()
    const v = ANILLO[0]
    const mmDesdeIzquierda = ((v[0] + 1 - real.bbox.minX) * 1000) / real.escalaExacta
    const [px] = real.toPx(v)
    expect(Math.abs(px - (mmDesdeIzquierda / 25.4) * PPP_INFORME)).toBeGreaterThan(20)
  })

  it('y el PLANO dibuja el vértice EN ese píxel: el mapeo del vector es el que rotula la escala', async () => {
    // La mitad del criterio que una función pura no puede dar. Si `report/canvas.js`
    // recalculara el mapeo por su cuenta —o redondeara— el plano saldría con la
    // geometría a un lado y la escala rotulada al otro, y las dos serían «correctas»
    // por separado. El vector se traza con `moveTo` en el primer vértice del anillo.
    const encuadre = encuadreReal()
    const { lienzo } = await componerConDobles({ encuadre })

    const primerMoveTo = lienzo.llamadas('moveTo')[0]
    expect(primerMoveTo, 'el plano no ha trazado ningún contorno').toBeDefined()
    expect(primerMoveTo.args).toEqual(encuadre.toPx(ANILLO[0]))
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · AC3 · «Si la salida supera el `MaxWidth` del WMS, se parte en varias
//           `GetMap` y se recomponen sin costura.»
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Comprueba que una rejilla de teselas cubre su encuadre **sin solape y sin
 * hueco**, en los dos ejes y a la vez en píxeles y en UTM. Devuelve las teselas
 * agrupadas por fila para poder seguir afirmando sobre ellas.
 *
 * La comprobación de UTM es con `toBe` (igualdad EXACTA de float64), no con
 * `toBeCloseTo`: los cortes se calculan una sola vez y se COMPARTEN entre
 * vecinas, así que un borde que difiera en el último bit significa que alguien
 * los ha vuelto a calcular por su cuenta — y ese es justo el bug que deja una
 * costura de un píxel en el papel.
 */
function verificarSinCostura(encuadre, maxPx) {
  const { columnas, filas } = encuadre.rejilla
  const porFila = []
  for (let f = 0; f < filas; f++) {
    porFila.push(encuadre.teselas.slice(f * columnas, (f + 1) * columnas))
  }

  for (const t of encuadre.teselas) {
    expect(t.anchoPx, 'una tesela pide más ancho del que sirve el WMS').toBeLessThanOrEqual(maxPx)
    expect(t.altoPx, 'una tesela pide más alto del que sirve el WMS').toBeLessThanOrEqual(maxPx)
    expect(t.anchoPx).toBeGreaterThan(0)
    expect(t.altoPx).toBeGreaterThan(0)
  }

  for (let f = 0; f < filas; f++) {
    // ── En píxeles: los offsets encadenan y la fila suma el ancho del lienzo ──
    let x = 0
    for (const t of porFila[f]) {
      expect(t.offsetX, `hueco o solape en la fila ${f}`).toBe(x)
      x += t.anchoPx
    }
    expect(x, `la fila ${f} no suma el ancho del lienzo`).toBe(encuadre.anchoPx)

    // ── En UTM: el borde derecho de cada una ES el izquierdo de la siguiente ──
    for (let c = 0; c < columnas; c++) {
      const t = porFila[f][c]
      if (c === 0) expect(t.bbox.minX).toBe(encuadre.bbox.minX)
      if (c === columnas - 1) expect(t.bbox.maxX).toBe(encuadre.bbox.maxX)
      if (c > 0) expect(t.bbox.minX).toBe(porFila[f][c - 1].bbox.maxX)
      // Todas las de una fila comparten franja de latitud, exacta.
      expect(t.bbox.maxY).toBe(porFila[f][0].bbox.maxY)
      expect(t.bbox.minY).toBe(porFila[f][0].bbox.minY)
    }
  }

  // ── En vertical: lo mismo, fila contra fila ────────────────────────────────
  let y = 0
  for (let f = 0; f < filas; f++) {
    expect(porFila[f][0].offsetY, `hueco o solape entre filas en ${f}`).toBe(y)
    y += porFila[f][0].altoPx
    if (f === 0) expect(porFila[f][0].bbox.maxY).toBe(encuadre.bbox.maxY)
    if (f === filas - 1) expect(porFila[f][0].bbox.minY).toBe(encuadre.bbox.minY)
    // La fila de arriba es la del NORTE: su borde inferior ES el superior de la de
    // abajo. Si el signo de la Y se hubiera colado al revés, esto se cae.
    if (f > 0) expect(porFila[f][0].bbox.maxY).toBe(porFila[f - 1][0].bbox.minY)
  }
  expect(y, 'las filas no suman el alto del lienzo').toBe(encuadre.altoPx)

  return porFila
}

describe('F09 · AC3 · si la salida supera el MaxWidth del WMS, se parte en varias GetMap y se recomponen sin costura', () => {
  it('«si lo supera»: A3 apaisado a 300 ppp da 4961×3508 y se parte en 2×1', () => {
    // El caso realista que dispara el troceado: 420 mm a 300 ppp son 4961 px, por
    // encima de los 4000 que sirve el servicio. `MAX_PIXELES_TESELA` es el techo
    // MEDIDO del WMS del Catastro, no un número prudente: `4000×100` se sirve
    // exacto y `4200×100` devuelve 4000×2000 sustituyendo las dos dimensiones.
    const e = encuadrar({ recintos: oficial(), anchoMm: 420, altoMm: 297 })

    expect(MAX_PIXELES_TESELA).toBe(4000)
    expect([e.anchoPx, e.altoPx]).toEqual([4961, 3508])
    expect(e.anchoPx).toBeGreaterThan(MAX_PIXELES_TESELA)
    expect(e.rejilla).toEqual({ columnas: 2, filas: 1 })
    expect(e.teselas).toHaveLength(2)
    // 2480 + 2481 = 4961: el reparto no acumula el resto en la última.
    expect(e.teselas.map((t) => t.anchoPx)).toEqual([2480, 2481])
    expect(e.teselas.reduce((s, t) => s + t.anchoPx, 0)).toBe(e.anchoPx)
    verificarSinCostura(e, MAX_PIXELES_TESELA)
  })

  it('«y se recomponen sin costura»: los bbox comparten borde EXACTO, sin solape ni hueco', () => {
    const e = encuadrar({ recintos: oficial(), anchoMm: 420, altoMm: 297 })
    const [izq, der] = e.teselas

    // Igualdad EXACTA, no aproximada: el corte se calcula UNA vez y se comparte.
    // Un `toBeCloseTo` aquí dejaría pasar la costura de un píxel que se ve en el
    // papel a 300 ppp y que ninguna otra prueba miraría.
    expect(der.bbox.minX).toBe(izq.bbox.maxX)
    expect(izq.bbox.minX).toBe(e.bbox.minX)
    expect(der.bbox.maxX).toBe(e.bbox.maxX)
    expect(izq.bbox.minY).toBe(e.bbox.minY)
    expect(izq.bbox.maxY).toBe(e.bbox.maxY)
    expect(der.bbox).toMatchObject({ minY: e.bbox.minY, maxY: e.bbox.maxY })
    // Y la anchura de mundo de las dos suma la del plano, hasta el último bit útil.
    const mundo = (t) => t.bbox.maxX - t.bbox.minX
    expect(mundo(izq) + mundo(der)).toBeCloseTo(e.bbox.maxX - e.bbox.minX, 9)
  })

  it('en los DOS ejes: 420×420 mm da una rejilla 2×2 y la fila de arriba es la del NORTE', () => {
    const e = encuadrar({ recintos: oficial(), anchoMm: 420, altoMm: 420 })
    expect([e.anchoPx, e.altoPx]).toEqual([4961, 4961])
    expect(e.rejilla).toEqual({ columnas: 2, filas: 2 })

    const filas = verificarSinCostura(e, MAX_PIXELES_TESELA)
    // El troceado se recorre en el sentido del CANVAS (la fila 0 es la de arriba) y
    // en UTM eso es la de mayor Y. Un signo cambiado aquí pondría el norte abajo.
    expect(filas[0][0].bbox.maxY).toBe(e.bbox.maxY)
    expect(filas[1][0].bbox.minY).toBe(e.bbox.minY)
    expect(filas[0][0].bbox.minY).toBe(filas[1][0].bbox.maxY)
  })

  it('ANTI-VACUIDAD · la ruta normal del informe NO trocea: 180×130 mm es UNA sola GetMap', () => {
    // Si el troceado se disparara siempre, todo lo de arriba pasaría sin decir nada
    // sobre el criterio. 2126×1535 caben de sobra bajo los 4000.
    const e = encuadreReal()
    expect([e.anchoPx, e.altoPx]).toEqual([2126, 1535])
    expect(e.rejilla).toEqual({ columnas: 1, filas: 1 })
    expect(e.teselas).toHaveLength(1)
    expect(e.teselas[0].bbox).toEqual(e.bbox)
  })

  it('«en varias GetMap»: una petición por tesela, con el tamaño de SU tesela', async () => {
    const encuadre = encuadrar({ recintos: oficial(), anchoMm: 420, altoMm: 297 })
    const { imagen, plano } = await componerConDobles({ encuadre })

    expect(imagen.emitidas).toHaveLength(2)
    expect(plano.teselasPedidas).toBe(2)
    // Cada URL pide SU tamaño, no el del plano entero: pedir 4961 px daría un
    // HTTP 200 con una imagen de 4000 y el plano saldría descolocado en silencio.
    expect(imagen.urls().map(tamanoDeUrl)).toEqual(
      encuadre.teselas.map((t) => ({ ancho: t.anchoPx, alto: t.altoPx })),
    )
    for (const { ancho, alto } of imagen.urls().map(tamanoDeUrl)) {
      expect(Math.max(ancho, alto)).toBeLessThanOrEqual(MAX_PIXELES_TESELA)
    }
  })

  it('«y se recomponen»: cada trozo se dibuja en su offset y los dos cubren el lienzo entero', async () => {
    const encuadre = encuadrar({ recintos: oficial(), anchoMm: 420, altoMm: 297 })
    const { lienzo, plano } = await componerConDobles({ encuadre })

    const dibujos = lienzo.llamadas('drawImage')
    expect(dibujos).toHaveLength(2)
    // `drawImage` de TRES argumentos: los cinco escalarían una imagen del tamaño
    // equivocado hasta encajar, tapando justo el fallo que la segunda red descarta.
    for (const d of dibujos) expect(d.args).toHaveLength(3)
    expect(dibujos.map((d) => d.args.slice(1))).toEqual(
      encuadre.teselas.map((t) => [t.offsetX, t.offsetY]),
    )
    // Y el lienzo sobre el que se recompone es el del plano ENTERO, no el de una
    // tesela: la costura desaparece porque los trozos van al mismo lienzo.
    expect(lienzo.canvas.width).toBe(encuadre.anchoPx)
    expect(lienzo.canvas.height).toBe(encuadre.altoPx)
    expect(plano.teselasDibujadas).toBe(2)
    expect(plano.teselasCaidas).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · AC4 · «La descripción literaria de una geometría fixture recorre horario
//           desde el NO y agrupa tramos; es editable.»
// ═════════════════════════════════════════════════════════════════════════════

/** La descripción de la parcela real contra sus cuatro colindantes reales. */
const literalReal = (extra = {}) =>
  describirLindero({ recintos: oficial(), vecinas: vecinas(), clase: 'URBANA', ...extra })

describe('F09 · AC4 · la descripción literaria de una geometría fixture recorre horario desde el NO y agrupa tramos', () => {
  it('«desde el NO»: arranca en el vértice más cercano a la esquina noroeste de la caja', () => {
    // El criterio se recalcula con un min/max y una `Math.hypot` escritos AQUÍ: si
    // alguien cambiara «más al noroeste» por «el de mayor Y» —que sobre esta parcela
    // da otro vértice— esto se rompe. El número 12 no se escribe a mano: se deriva.
    const caja = cajaDe(ANILLO)
    const esquina = [caja.minX, caja.maxY]
    let esperado = 0
    for (let i = 1; i < ANILLO.length; i++) {
      if (distancia(ANILLO[i], esquina) < distancia(ANILLO[esperado], esquina)) esperado = i
    }

    expect(literalReal().tramos[0].indiceInicio).toBe(esperado)
    // Y el texto nombra ese vértice por sus COORDENADAS, que es lo que se puede
    // replantear sobre el terreno; el número de orden depende del fichero.
    const [x, y] = ANILLO[esperado]
    expect(literalReal().texto).toContain('desde el vértice más al noroeste')
    expect(literalReal().texto).toContain(
      `X ${x.toFixed(2).replace('.', ',')} · Y ${y.toFixed(2).replace('.', ',')}`,
    )
  })

  it('«recorre horario»: el anillo reconstruido en el orden del recorrido tiene área NEGATIVA', () => {
    // Oráculo propio y a lado por tramo (`rumboSimilarGrados` mínimo, para que la
    // agrupación no esconda el orden). Área firmada negativa ⇒ horario, medido con
    // la shoelace de este fichero y no con `geo/area.js`.
    const orden = literalReal({ opciones: { rumboSimilarGrados: 1e-9 } }).tramos.map(
      (t) => t.indiceInicio,
    )
    expect(orden).toHaveLength(ANILLO.length)
    expect(new Set(orden).size, 'el recorrido repite o se salta vértices').toBe(ANILLO.length)

    expect(shoelace(orden.map((i) => ANILLO[i]))).toBeLessThan(0)
  })

  it('«recorre horario» TAMBIÉN cuando el anillo llega ANTIHORARIO, y el texto es el MISMO', () => {
    // La prueba que atrapa el bug del sentido. Dar por hecha la orientación —en vez
    // de medirla— describiría este lindero con los cardinales OPUESTOS (azimut +
    // 180°) sin que nada se rompiera: el documento se leería perfectamente bien y
    // sería falso de cabo a rabo. Y la escritura que lo copiara, también.
    const alReves = oficial()
    alReves[0].vertices.reverse()
    expect(shoelace(alReves[0].vertices), 'el fixture invertido no es antihorario').toBeGreaterThan(0)

    const derecho = literalReal()
    const invertido = describirLindero({ recintos: alReves, vecinas: vecinas(), clase: 'URBANA' })

    expect(invertido.texto).toBe(derecho.texto)
    // El recorrido sobre el anillo invertido sigue siendo horario.
    const orden = describirLindero({
      recintos: alReves,
      vecinas: vecinas(),
      clase: 'URBANA',
      opciones: { rumboSimilarGrados: 1e-9 },
    }).tramos.map((t) => t.indiceInicio)
    expect(shoelace(orden.map((i) => alReves[0].vertices[i]))).toBeLessThan(0)
    // Y los índices SÍ cambian, porque son índices en la lista que llegó: si no
    // cambiaran, la igualdad de textos sería la de dos llamadas idénticas.
    expect(invertido.tramos[0].indiceInicio).not.toBe(derecho.tramos[0].indiceInicio)
    expect(alReves[0].vertices[invertido.tramos[0].indiceInicio]).toEqual(
      ANILLO[derecho.tramos[0].indiceInicio],
    )
  })

  it('«agrupa tramos»: los 15 lados salen en CUATRO frentes, cada uno con su colindante', () => {
    // Es la descripción que un técnico escribiría a mano de esta parcela: tres
    // colindantes catastrales y un frente que no linda con ninguna de las cuatro
    // parcelas traídas. Sin agrupar, esto serían quince frases de un lado cada una.
    const r = literalReal()
    expect(
      r.tramos.map((t) => ({
        cardinal: t.cardinal,
        refcat: t.refcat,
        nLados: t.nLados,
        longitud: Number(t.longitud.toFixed(2)),
      })),
    ).toEqual([
      { cardinal: 'Este', refcat: '9398517VK3799G', nLados: 1, longitud: 26.5 },
      { cardinal: 'Sudeste', refcat: '9398518VK3799G', nLados: 2, longitud: 39.4 },
      { cardinal: 'Sudoeste', refcat: '9398515VK3799G', nLados: 3, longitud: 50 },
      { cardinal: 'Noroeste', refcat: null, nLados: 9, longitud: 47.21 },
    ])

    // La agrupación no pierde ni un lado ni un metro: los `nLados` suman los 15 y
    // las longitudes suman el perímetro medido con el oráculo de este fichero.
    expect(r.tramos.reduce((s, t) => s + t.nLados, 0)).toBe(ANILLO.length)
    expect(r.tramos.reduce((s, t) => s + t.longitud, 0)).toBeCloseTo(perimetro(ANILLO), 6)
    expect(r.saltados).toEqual([])
  })

  it('los cardinales van en el sentido de las agujas del reloj, azimut creciente', () => {
    // Segunda lectura del «horario», a nivel de tramo y sin reconstruir nada: el
    // azimut se mide desde el Norte y crece HACIA EL ESTE, así que un recorrido
    // horario da una serie creciente. Si el recorrido fuera antihorario, esta serie
    // decrecería aunque cada tramo por separado siguiera siendo correcto.
    const azimuts = literalReal().tramos.map((t) => t.azimut)
    for (let i = 1; i < azimuts.length; i++) {
      expect(azimuts[i], `el tramo ${i} rompe el sentido horario`).toBeGreaterThan(azimuts[i - 1])
    }
  })

  it('la descripción sale REDACTADA, no como una lista de datos: es lo que se copia a una escritura', () => {
    const r = literalReal()
    expect(r.lindero[0]).toBe(
      'Linda al Este, en línea recta de 26,50 m, con la parcela de referencia catastral ' +
        '9398517VK3799G, rotulada «17» en el parcelario catastral.',
    )
    // Y el frente sin colindante catastral se PROPONE como vía pública, con la marca
    // de «no verificado» viajando en el tramo y no solo dentro de la frase — que es
    // lo que hace que la advertencia sobreviva a que el usuario reescriba el párrafo.
    expect(r.tramos[3].presuncionNoVerificada).toBe(PRESUNCION.VIA_PUBLICA)
    expect(r.vecinasConsultadas).toBe(true)
  })
})

// ── 7 bis · «…es editable» ───────────────────────────────────────────────────

const dialogosVivos = []

afterEach(() => {
  while (dialogosVivos.length) {
    const d = dialogosVivos.pop()
    try {
      d.destruir()
    } catch {
      /* la limpieza nunca debe enmascarar el fallo real del test */
    }
  }
  document.body.innerHTML = ''
  document.body.className = ''
  vi.restoreAllMocks()
})

/** El diálogo de preparación, cargado con el informe REAL de esta parcela. */
function conDialogo() {
  document.body.className = 'gml-app'
  document.body.innerHTML = ''
  const dialogo = crearDialogoInforme({ documento: document, alAvisar: () => {} })
  dialogosVivos.push(dialogo)
  dialogo.fijar({
    encabezado: componerEncabezado({
      descriptivos: DNP_URBANA,
      refcat: REF,
      srs: 'EPSG:25830',
      fecha: FECHA,
      idDocumento: null,
    }),
    procedencia: DNP_URBANA,
    lindero: literalReal(),
  })
  return { dialogo, raiz: dialogo.nodo }
}

/** Teclea en un control y dispara el `input`/`change` que emitiría el navegador. */
function teclear(el, valor) {
  el.value = valor
  el.dispatchEvent(new Event('input', { bubbles: true }))
  el.dispatchEvent(new Event('change', { bubbles: true }))
}

describe('F09 · AC4 · «…es editable»: el borrador se corrige antes de exportar, y la corrección llega al papel', () => {
  it('el borrador de la parcela real llega a un `<textarea>` que se puede escribir', () => {
    const { raiz } = conDialogo()
    const cuadro = raiz.querySelector(SELECTOR_DIALOGO.LITERAL)

    expect(cuadro.tagName).toBe('TEXTAREA')
    expect(cuadro.readOnly).toBe(false)
    expect(cuadro.disabled).toBe(false)
    expect(cuadro.value).toBe(literalReal().texto)
    // Anti-vacuidad: el borrador no está vacío, así que «es editable» se dice sobre
    // algo. Son cuatro párrafos de lindero más la nota técnica.
    expect(cuadro.value.length).toBeGreaterThan(500)
  })

  it('lo escrito a mano es lo que devuelve el diálogo, LITERAL y con sus párrafos', () => {
    const { dialogo, raiz } = conDialogo()
    const corregido =
      'Linda al Este con la finca de don Fulano.\n\nLinda al Oeste con el camino de servicio.\n'

    teclear(raiz.querySelector(SELECTOR_DIALOGO.LITERAL), corregido)

    // Sin recortar, sin colapsar y sin tocar los saltos de línea: son párrafos.
    expect(dialogo.valores().lindero).toBe(corregido)
    expect(dialogo.valores().linderoEditado).toBe(true)
  })

  it('«Regenerar» devuelve el borrador de la aplicación y avisa a quien esté suscrito', () => {
    // El otro medio de la edición: poder deshacerla. Es lo que hace que corregir no
    // dé miedo, y lo que exige que exista un camino de vuelta al texto redactado.
    const { dialogo, raiz } = conDialogo()
    const visto = []
    dialogo.alRegenerar(() => visto.push(raiz.querySelector(SELECTOR_DIALOGO.LITERAL).value))

    teclear(raiz.querySelector(SELECTOR_DIALOGO.LITERAL), 'media hora de correcciones')
    raiz.querySelector(SELECTOR_DIALOGO.REGENERAR).click()

    expect(raiz.querySelector(SELECTOR_DIALOGO.LITERAL).value).toBe(literalReal().texto)
    expect(dialogo.valores().linderoEditado).toBe(false)
    // Y se avisa DESPUÉS de haber restaurado: quien recompone el borrador con datos
    // frescos tiene que ver el texto ya puesto, no el que había.
    expect(visto).toEqual([literalReal().texto])
  })

  it('LO QUE CIERRA EL CRITERIO · el texto corregido es el que se imprime en el PDF', () => {
    // «Editable» no significa «hay un cuadro que admite teclas»: significa que lo
    // que se teclea es lo que sale en el documento firmable. El cable completo
    // (`literalParaImprimir`) está en `test/app/informe.dom.test.js`; aquí se afirma
    // el extremo que importa, releyendo el PDF.
    const corregido = 'Linda al Este con la finca matriz de la que se segregó en 1974.'
    const conCorreccion = informe({
      literal: { ...literalReal(), texto: corregido, lindero: [corregido], notaTecnica: [] },
    })

    expect(leerPdf(conCorreccion.bytes).corrido).toContain(corregido)
    // Y el borrador que la aplicación había redactado ya NO está: no se imprimen los
    // dos, que sería la manera silenciosa de ignorar la corrección.
    expect(leerPdf(conCorreccion.bytes).corrido).not.toContain(
      'rotulada «17» en el parcelario catastral',
    )
    // Anti-vacuidad: sin corregir, el borrador SÍ sale.
    expect(leerPdf(informe().bytes).corrido).toContain('rotulada «17» en el parcelario catastral')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · AC5 · «El PDF lleva pie de firma configurable y el nombre correcto;
//           ninguna cifra del diagnóstico lleva color de mérito.»
// ═════════════════════════════════════════════════════════════════════════════

// ── Las piezas del informe, todas producidas de verdad ───────────────────────

const diagnosticoDe = (recintos) =>
  diagnosticar({
    recintos: clon(recintos),
    geometriaOficial: oficial(),
    superficieCatastral: DECLARADA,
    superficieRegistral: null,
    vecinas: vecinas(),
    refcat: REF,
  })

/** El encuadre del plano: el alto se DERIVA del JPEG (24×16 ⇒ 180×120 mm). */
const ENCUADRE_PLANO = encuadrar({
  recintos: oficial(),
  anchoMm: 180,
  altoMm: (180 * JPEG_ALTO_PX) / JPEG_ANCHO_PX,
})

/** El contrato B, con la forma que devuelve `report/canvas.js#componerPlano`. */
const planoDe = (cambios = {}) => ({
  jpeg: JPEG,
  anchoPx: JPEG_ANCHO_PX,
  altoPx: JPEG_ALTO_PX,
  teselasPedidas: 1,
  capasUsadas: ['Catastro'],
  capasCaidas: [],
  atribucion: '© Dirección General del Catastro',
  teselasCaidas: [],
  ...cambios,
})

const parcelaDe = (recintos) => ({
  idLocal: 'parcela-1',
  refcat: REF,
  srs: 'EPSG:25830',
  recintos: clon(recintos),
  geometriaOficial: oficial(),
  superficieRegistral: null,
  superficieCatastral: DECLARADA,
  origen: 'CATASTRO',
})

const FIRMA = Object.freeze({
  nombre: 'Javier Ramírez Bandera',
  numeroColegiado: '04321',
  colegio: 'Colegio Oficial de Arquitectos de Málaga',
  contacto: 'jramirezbandera@gmail.com',
})

/**
 * El informe completo, con todo real. Por defecto sobre el caso editado (el
 * vértice 0 movido 0,40 m al este); `recintos` lo cambia sin tocar nada más, y no
 * viaja a `informePdfParcela` —no es un parámetro suyo— sino que decide a la vez
 * el diagnóstico, la parcela y el lindero, que es como se sostienen entre sí.
 */
function informe({ recintos = editada(), ...entrada } = {}) {
  return informePdfParcela({
    diagnostico: diagnosticoDe(recintos),
    encabezado: componerEncabezado({
      descriptivos: DNP_URBANA,
      refcat: REF,
      srs: 'EPSG:25830',
      fecha: FECHA,
      idDocumento: null,
    }),
    parcela: parcelaDe(recintos),
    plano: planoDe(),
    encuadre: ENCUADRE_PLANO,
    literal: describirLindero({ recintos: clon(recintos), vecinas: vecinas(), clase: 'URBANA' }),
    firma: null,
    procedencia: DNP_URBANA,
    ...entrada,
  })
}

// ── El oráculo: releer el PDF y sacar su texto CON SU TINTA ─────────────────

/** Reverso de la franja 0x80–0x9F de CP1252, la única que no es Latin-1. */
const ALTOS_CP1252 = Object.freeze({
  0x80: '€', 0x82: '‚', 0x83: 'ƒ', 0x84: '„', 0x85: '…', 0x86: '†', 0x87: '‡',
  0x88: 'ˆ', 0x89: '‰', 0x8a: 'Š', 0x8b: '‹', 0x8c: 'Œ', 0x8e: 'Ž', 0x91: '‘',
  0x92: '’', 0x93: '“', 0x94: '”', 0x95: '•', 0x96: '–', 0x97: '—',
  0x98: '˜', 0x99: '™', 0x9a: 'š', 0x9b: '›', 0x9c: 'œ', 0x9e: 'ž', 0x9f: 'Ÿ',
})

/** Los bytes como texto latin-1: cada byte, un carácter, y el índice ES el offset. */
const aLatin1 = (bytes) => Buffer.from(bytes).toString('latin1')

/**
 * Los renglones del PDF **con el gris con el que se dibujó cada uno**.
 *
 * Es lo que diferencia este oráculo del de `test/report/pdf-parcela.test.js`, que
 * lee posición y tamaño: aquí lo que hay que vigilar es la TINTA. `report/pdf.js`
 * emite cada texto como `q\n<gris> g\nBT\n…`, así que el gris viaja pegado a su
 * renglón y no hay que reconstruir un estado gráfico.
 */
function leerPdf(bytes) {
  const documento = aLatin1(bytes)
  const streams = []
  const reStream = /stream\n([\s\S]*?)\nendstream/g
  let s
  while ((s = reStream.exec(documento)) !== null) {
    // Los bytes de un JPEG pueden contener por casualidad cualquier secuencia.
    if (documento.slice(Math.max(0, s.index - 240), s.index).includes('/Subtype /Image')) continue
    streams.push(s[1])
  }

  const renglones = []
  for (const stream of streams) {
    const re = /q\n([\d.]+) g\nBT\n\/F\d ([\d.]+) Tf\n1 0 0 1 [-\d.]+ [-\d.]+ Tm\n\(/g
    let m
    while ((m = re.exec(stream)) !== null) {
      let i = re.lastIndex
      const bytesTexto = []
      while (i < stream.length) {
        const c = stream[i]
        if (c === '\\') {
          bytesTexto.push(stream.charCodeAt(i + 1))
          i += 2
          continue
        }
        if (c === ')') break
        bytesTexto.push(stream.charCodeAt(i))
        i += 1
      }
      renglones.push({
        gris: Number(m[1]),
        tam: Number(m[2]) / PUNTOS_POR_MM,
        texto: bytesTexto.map((b) => ALTOS_CP1252[b] ?? String.fromCharCode(b)).join(''),
      })
    }
  }

  return {
    renglones,
    lineas: renglones.map((r) => r.texto),
    corrido: renglones.map((r) => r.texto).join(' ').replace(/\s+/g, ' '),
    /** Los renglones de la sección 4 (el diagnóstico), de su epígrafe al siguiente. */
    diagnostico() {
      const desde = renglones.findIndex((r) => /^\d+\.\s\sDIAGNÓSTICO DE ENCAJE/.test(r.texto))
      const hasta = renglones.findIndex(
        (r, i) => i > desde && /^\d+\.\s\sDESCRIPCIÓN LITERARIA/.test(r.texto),
      )
      expect(desde, 'no está el epígrafe del diagnóstico en el PDF').toBeGreaterThan(-1)
      expect(hasta, 'no está el epígrafe siguiente: la sección no se puede acotar').toBeGreaterThan(
        desde,
      )
      return renglones.slice(desde, hasta)
    },
  }
}

/**
 * Una MAGNITUD del informe: una cifra con o sin unidad, o el «No consta» que la
 * sustituye cuando no hay dato. Es exactamente lo que el criterio prohíbe teñir.
 */
const MAGNITUD = /^[+−-]?\d[\d.]*(,\d+)?\s?(m²|m|%)?$/

describe('F09 · AC5 · el PDF lleva pie de firma configurable', () => {
  it('con firma puesta, los CUATRO campos salen con su valor y con el rótulo del módulo', () => {
    const leido = leerPdf(informe({ firma: FIRMA }).bytes)

    expect(CAMPOS_FIRMA).toEqual(['nombre', 'numeroColegiado', 'colegio', 'contacto'])
    for (const campo of CAMPOS_FIRMA) {
      expect(leido.lineas, `falta el rótulo de ${campo}`).toContain(ROTULO_FIRMA[campo])
      expect(leido.lineas, `falta el valor de ${campo}`).toContain(FIRMA[campo])
    }
  })

  it('SIN firma, los cuatro salen igual con «No consta»: el hueco mudo no existe', () => {
    // Un pie de firma en blanco no es un informe defectuoso —el documento sirve para
    // que alguien lo lea antes de firmarlo—, pero un hueco vacío en el papel se lee
    // como «esto se me ha olvidado imprimir». Con «No consta» se lee lo que pasa.
    const leido = leerPdf(informe({ firma: null }).bytes)

    for (const campo of CAMPOS_FIRMA) {
      expect(leido.lineas).toContain(ROTULO_FIRMA[campo])
    }
    expect(leido.lineas.filter((l) => l === NO_CONSTA).length).toBeGreaterThanOrEqual(
      CAMPOS_FIRMA.length,
    )
    // Y el pie ocupa lo mismo: el documento no cambia de forma por no llevar firma.
    expect(informe({ firma: null }).nPaginas).toBe(informe({ firma: FIRMA }).nPaginas)
  })

  it('«configurable» significa campo a campo: una firma A MEDIAS imprime lo que hay y dice lo que falta', () => {
    // El caso real de quien todavía no ha tecleado el número de colegiado. Ni se
    // rechaza el informe ni se inventa el dato.
    const leido = leerPdf(informe({ firma: { nombre: 'Quien firma' } }).bytes)

    expect(leido.lineas).toContain('Quien firma')
    expect(leido.corrido).toContain(`${ROTULO_FIRMA.numeroColegiado} ${NO_CONSTA}`)
    expect(leido.corrido).toContain(`${ROTULO_FIRMA.colegio} ${NO_CONSTA}`)
  })

  it('el pie es NEUTRAL: no presupone titulación en ninguno de los dos casos', () => {
    // «Técnico competente» está en disputa jurídica (spec §Contenido, punto 6). El
    // guardián completo de vocabulario vive en `test/report/firma.test.js`; aquí se
    // afirma sobre el papel compuesto, que es donde acabaría leyéndolo un cliente.
    for (const firma of [FIRMA, null]) {
      const corrido = leerPdf(informe({ firma }).bytes).corrido
      for (const prohibido of [
        /t[ée]cnico competente/i,
        /arquitect[oa]s? t[ée]cnic[oa]?/i,
        /ingenier[oa]/i,
        /facultativ[oa]/i,
      ]) {
        expect(prohibido.test(corrido), `el pie presupone titulación: ${prohibido}`).toBe(false)
      }
    }
    // Y sí dice lo que la firma NO es, que es la advertencia que importa.
    expect(leerPdf(informe({ firma: FIRMA }).bytes).corrido).toContain(
      'no lleva firma electrónica ni código seguro de verificación',
    )
  })
})

describe('F09 · AC5 · …y el nombre correcto', () => {
  it('el nombre LEGAL es «Informe de contraste con el parcelario catastral», y está en los cuatro sitios', () => {
    // No «Informe de validación gráfica»: el IVG y la VGA son un documento y un
    // procedimiento OFICIALES del Catastro con código seguro de verificación, y un
    // nombre casi homónimo hace creer al cliente que ya se presentó (spec §11.1).
    const r = informe({ firma: FIRMA })
    expect(NOMBRE_INFORME).toBe('Informe de contraste con el parcelario catastral')

    expect(r.titulo).toBe(NOMBRE_INFORME)
    expect(leerPdf(r.bytes).lineas).toContain(NOMBRE_INFORME.toUpperCase())
    // El /Title del /Info va en UTF-16BE con BOM (auditoría R1: fuera de los
    // content streams el estándar exige PDFDocEncoding o UTF-16BE, y CP1252
    // diverge de PDFDocEncoding en 0x80–0x9F). En latin-1, cada carácter es
    // «byte alto + byte bajo».
    const utf16 = (s) =>
      '\xfe\xff' +
      [...s]
        .map(
          (c) =>
            String.fromCharCode(c.charCodeAt(0) >> 8) +
            String.fromCharCode(c.charCodeAt(0) & 0xff),
        )
        .join('')
    expect(aLatin1(r.bytes)).toContain(`/Title (${utf16(`${NOMBRE_INFORME} · ${r.idDocumento}`)})`)
    expect(r.nombreFichero).toBe(`informe-contraste-${r.idDocumento}.pdf`)
    expect(r.nombreFichero.endsWith('.pdf')).toBe(true)
  })

  it('y las siglas de los documentos oficiales NO aparecen, ni siquiera dentro de una negación', () => {
    // En un `.txt` que se mira y se tira se pueden nombrar para negarlos; en un papel
    // que se firma, la sigla se lee y la negación no.
    const corrido = leerPdf(informe({ firma: FIRMA }).bytes).corrido
    for (const prohibido of [/validaci[óo]n gr[áa]fica/i, /\bIVG\b/, /\bVGA\b/]) {
      expect(prohibido.test(corrido), `el informe dice ${prohibido}`).toBe(false)
    }
    // Se dice lo que NO es, sin nombrarlo.
    expect(corrido).toContain('no es un documento oficial del Catastro')
    expect(corrido).toContain('La aplicación mide; el colegiado interpreta y firma')
  })
})

describe('F09 · AC5 · …ninguna cifra del diagnóstico lleva color de mérito', () => {
  it('1/3 · el escritor de PDF no SABE emitir color: no hay `rg`, ni `RG`, ni `k`, ni `K`', () => {
    // La mitad estructural del criterio, y la más fuerte: `report/pdf.js` no tiene
    // API de color. Su único control de tinta es `gris` (0 negro … 1 blanco), y
    // `exigirGris` rechaza cualquier otra cosa. Un rojo o un ámbar en una cifra no
    // es un descuido que se pueda colar: hay que ampliar el escritor para poder
    // cometerlo, y entonces esto se pone rojo.
    const documento = aLatin1(informe({ firma: FIRMA }).bytes)

    for (const operador of [/\d \d \d rg\b/, /\d \d \d RG\b/, /\d \d \d \d k\b/, /\d \d \d \d K\b/]) {
      expect(operador.test(documento), `el PDF emite el operador de color ${operador}`).toBe(false)
    }
    // ANTI-VACUIDAD: los operadores de GRIS sí están, así que la búsqueda de arriba
    // no está mirando un documento sin tinta.
    expect(/\n0 g\n/.test(documento)).toBe(true)
    expect(/ G\n/.test(documento)).toBe(true)

    // Y el único mando de tinta que el escritor expone es un GRIS de 0 a 1: no hay
    // por dónde meter un rojo aunque se quisiera. Se comprueba por comportamiento y
    // no leyendo el fuente, que es lo que sobrevive a un refactor.
    const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
    const donde = { x: 20, y: 20, tam: 3 }
    expect(() => doc.texto('cifra', { ...donde, gris: '#C62828' })).toThrow(TypeError)
    expect(() => doc.texto('cifra', { ...donde, gris: 1.5 })).toThrow(RangeError)
    expect(() => doc.texto('cifra', { ...donde, gris: 0.4 })).not.toThrow()
  })

  it('2/3 · TODA magnitud del diagnóstico va en negro, y hay grises disponibles que no se usan para eso', () => {
    // El gris existe y se usa —0,4 para los rótulos, 0,3 para las notas al pie de
    // cada bloque—, así que «todas las cifras en negro» no es la frase trivial de un
    // documento monocromo: es una decisión que se puede romper y que aquí se vigila.
    const seccion = leerPdf(informe({ firma: FIRMA }).bytes).diagnostico()
    const magnitudes = seccion.filter((r) => MAGNITUD.test(r.texto) || r.texto === NO_CONSTA)

    expect(magnitudes.length, 'la sección del diagnóstico no trae cifras: el guardián sería vacuo')
      .toBeGreaterThan(25)
    expect([...new Set(magnitudes.map((r) => r.gris))]).toEqual([0])
    // Anti-vacuidad de la anti-vacuidad: en la MISMA sección hay renglones con otro
    // gris, o sea que la tinta se está eligiendo de verdad renglón a renglón.
    expect([...new Set(seccion.map((r) => r.gris))].length).toBeGreaterThan(1)
  })

  it('3/3 · LA PRUEBA DEL CRITERIO · la tinta no depende del VALOR: dos diagnósticos opuestos, los mismos grises', () => {
    // Aquí es donde «color de mérito» se convierte en algo medible. Se componen dos
    // informes de la MISMA parcela:
    //   · uno cuya geometría COINCIDE con el contorno oficial (desviación 4·10⁻¹⁰ m,
    //     cero invasiones);
    //   · otro con el vértice 0 movido 0,40 m (3,12 m² de diferencia y TRES
    //     invasiones reales a colindantes).
    // Si alguna cifra llevara juicio de valor, la tinta de los dos documentos tendría
    // que diferir en alguna parte. No difiere en ninguna.
    const coincidente = leerPdf(informe({ recintos: oficial() }).bytes).diagnostico()
    const desviada = leerPdf(informe({ recintos: editada() }).bytes).diagnostico()

    const grisesDe = (s) => [...new Set(s.map((r) => r.gris))].sort()
    expect(grisesDe(coincidente)).toEqual(grisesDe(desviada))
    for (const seccion of [coincidente, desviada]) {
      const magnitudes = seccion.filter((r) => MAGNITUD.test(r.texto) || r.texto === NO_CONSTA)
      expect(magnitudes.length).toBeGreaterThan(25)
      expect([...new Set(magnitudes.map((r) => r.gris))]).toEqual([0])
    }
    // Y los dos informes NO son el mismo documento: si lo fueran, la igualdad de
    // tintas sería la de un documento consigo mismo, que no dice nada.
    const comoTexto = (s) => s.map((r) => r.texto).join('\n')
    expect(comoTexto(coincidente)).not.toBe(comoTexto(desviada))
  })

  it('DISPARA: el extractor SÍ ve un gris distinto de 0 cuando lo hay', () => {
    // La mitad anti-vacuidad del instrumento. Si `leerPdf` devolviera siempre 0, los
    // tres tests de arriba pasarían con un documento pintado de rojo.
    const doc = crearDocumentoPdf({ anchoMm: A4_ANCHO_MM, altoMm: A4_ALTO_MM })
    doc.texto('1.234,56 m2', { x: 20, y: 20, tam: 3, gris: 0 })
    doc.texto('9.876,54 m2', { x: 20, y: 30, tam: 3, gris: 0.55 })

    const leido = leerPdf(doc.bytes())
    expect(leido.renglones.map((r) => [r.texto, r.gris])).toEqual([
      ['1.234,56 m2', 0],
      ['9.876,54 m2', 0.55],
    ])
    // Y el mismo criterio de «toda magnitud en negro» pondría ROJO este documento.
    const magnitudes = leido.renglones.filter((r) => /\d/.test(r.texto))
    expect([...new Set(magnitudes.map((r) => r.gris))]).not.toEqual([0])
  })

  it('y tampoco hay color de mérito en PALABRAS: la sección del diagnóstico no dictamina', () => {
    // Un adjetivo hace el mismo trabajo que un ámbar. El guardián completo sobre el
    // documento entero —con su lista de catorce regex y su prueba de que cada una
    // caza algo— vive en `test/report/pdf-parcela.test.js`; aquí se afirma el
    // criterio sobre la sección que el criterio nombra, en los DOS diagnósticos.
    const VEREDICTO =
      /\b(v[áa]lid[oa]s?|inv[áa]lid[oa]s?|correct[oa]s?|incorrect[oa]s?|apt[oa]s?|cumple[n]?|incumple[n]?|conforme[s]?|toleranci[ao]s?|sem[áa]foros?|umbral(es)?|aprobad[oa]s?|acept(able|ables|ado|ada))\b/i

    for (const recintos of [oficial(), editada()]) {
      const seccion = leerPdf(informe({ recintos }).bytes).diagnostico()
      const texto = seccion.map((r) => r.texto).join(' ')
      expect(texto.length, 'la sección está vacía: el guardián sería vacuo').toBeGreaterThan(1000)
      expect(VEREDICTO.test(texto), `la sección del diagnóstico dictamina: ${texto.slice(0, 200)}`)
        .toBe(false)
    }
    // DISPARA: la regex no está muerta.
    expect(VEREDICTO.test('La geometría es correcta y está dentro de la tolerancia.')).toBe(true)
  })
})

/* -------------------------------------------------------------------------- *
 * ⛔ LO QUE ESTA SUITE **NO** PUEDE CUBRIR, DICHO CON TODAS LAS LETRAS         *
 *                                                                              *
 * jsdom no tiene rasterizador, ni contexto 2D, ni red, ni un gestor de         *
 * ventanas que entregue ficheros. Nada de lo que sigue se puede afirmar aquí   *
 * sin mentir.                                                                  *
 *                                                                              *
 * ── Lo mide `scripts/smoke-navegador/11-informe-pdf.js` (T6.2) ──             *
 *   (n1) **EL CRITERIO 1 ENTERO.** Que el canvas compuesto exporte con         *
 *        `toDataURL` sin `SecurityError`, con **tesela REAL del WMS del        *
 *        Catastro** y con el **control negativo TAINTED** que valida la        *
 *        prueba. Aquí no hay contexto 2D: está medido en el § 4.1 que          *
 *        `getContext('2d')` da `null` y que `toDataURL()` devuelve `null` sin  *
 *        lanzar, así que la aserción saldría verde sin haber exportado nada.   *
 *   (n2) **Que el plano SE VEA**: que la cartografía esté debajo, la geometría *
 *        encima, y que el norte y la barra de escala no se solapen con nada.   *
 *        El orden de dibujo se afirma por la secuencia de llamadas; que el     *
 *        resultado sea legible, no.                                            *
 *   (n3) **Que el PDF llegue a la carpeta de descargas** y que un lector de    *
 *        PDF de verdad lo abra. Aquí se releen los bytes con un oráculo        *
 *        propio, que es todo lo que se puede hacer sin un navegador.           *
 *   (n4) **Cuánto tarda** componer el plano a 300 ppp contra el servicio real, *
 *        y si el troceado del criterio 3 hace falta en algún papel del flujo.  *
 *                                                                              *
 * ── Queda para el checklist humano (§ de `CHECKLIST-HUMANO.md`) ──            *
 *   (h1) **Si el plano a 300 ppp está a la altura de un documento que se       *
 *        firma.** Ninguna máquina puede decir si una escala 1:538 sobre 180 mm *
 *        de papel deja ver el lindero que hay que discutir.                    *
 *   (h2) **Si la descripción literaria se puede copiar a una escritura tal     *
 *        cual.** El AC4 afirma que arranca donde debe, que recorre horario y   *
 *        que agrupa; que el resultado sea castellano de notaría lo dice un     *
 *        humano. Hereda el carácter BLOQUEANTE de la §8 de F07.                *
 *   (h3) **Si la presunción de vía pública se entiende como PROPUESTA y no     *
 *        como dato.** El acuse es mecánico; que nadie lo marque sin leerlo, no.*
 *   (h4) **Que el recorrido F05 → F06 → F07 → F08 siga igual** con el diálogo  *
 *        de informe montado encima.                                            *
 * -------------------------------------------------------------------------- */

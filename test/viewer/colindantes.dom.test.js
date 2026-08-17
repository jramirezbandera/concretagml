/* -------------------------------------------------------------------------- *
 * test/viewer/colindantes.dom.test.js — La capa de PARCELAS VECINAS           *
 *                                                                            *
 * `viewer/colindantes.js` dibuja; no calcula ni consulta nada. Así que aquí se *
 * prueba lo que se PONE en el mapa y con qué opciones. Por orden de importancia:*
 *                                                                            *
 *   1. **EL CLIC DEL MAPA SOBREVIVE A LA CAPA INTERACTIVA.** Es el riesgo de   *
 *      la tarea, y la razón por la que este fichero existe: el emergente con la *
 *      referencia catastral obliga a `interactive:true`, y una capa interactiva  *
 *      puede robarle el clic al mapa — que es la deducción por clic de F05. Se  *
 *      MIDE (oyente en `mapa.on('click')`, clic real sobre el `<path>` de una   *
 *      vecina, y el oyente disparándose con su `latlng`), no se supone.        *
 *   2. **Una forma por vecina**, con su referencia en el emergente.            *
 *   3. **Ni un color de mérito** (regla de oro 9): ni verde, ni rojo, ni el     *
 *      ámbar, que está reservado a la invasión de F07.                         *
 *   4. **El pane 405**, por debajo de la parcela: el contexto no tapa al asunto.*
 *   5. **Que `limpiar()` y `destruir()` no dejan nada.**                       *
 *                                                                            *
 * Las vecinas se construyen A MANO (POJO literal `[{refcat, recintos}]`): esta  *
 * capa consume una FORMA —la misma que `diagnostico/parcela.js`—, no una        *
 * función, y montar el WFS aquí acoplaría el test de la vista a la red.         *
 *                                                                            *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).        *
 * -------------------------------------------------------------------------- */

import L from 'leaflet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { NIVEL, PANE, PANES, vertUTMaLatLng } from '../../viewer/_comun.js'
import { COLOR_USUARIO } from '../../viewer/_comun.js'
import {
  CLASE_COLINDANTE,
  CLASE_EMERGENTE,
  SIN_REFERENCIA,
  crearCapaColindantes,
  textoEmergente,
} from '../../viewer/colindantes.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

const ZONA = 30

// Cuadrados de 10 m en UTM real (huso 30): la proyección se ejecuta de verdad.
const X0 = 373000
const Y0 = 4070000

const rect = (x0, y0, x1, y1) => ({
  vertices: [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  tipo: 'EXTERIOR',
})

/** Una vecina al este, otra al norte: dos parcelas distintas y separadas. */
const VECINA_A = { refcat: '9398501VK3799G', recintos: [rect(X0 + 10, Y0, X0 + 20, Y0 + 10)] }
const VECINA_B = { refcat: '9398502VK3799G', recintos: [rect(X0, Y0 + 10, X0 + 10, Y0 + 20)] }

/** Vecina con patio: exterior + hueco, los dos anillos del MISMO polígono. */
const VECINA_CON_HUECO = {
  refcat: '9398503VK3799G',
  recintos: [
    rect(X0 + 30, Y0, X0 + 50, Y0 + 20),
    { ...rect(X0 + 35, Y0 + 5, X0 + 40, Y0 + 10), tipo: 'HUECO' },
  ],
}

const montados = []
afterEach(() => {
  while (montados.length) {
    const limpiar = montados.pop()
    try {
      limpiar()
    } catch {
      /* la limpieza nunca debe enmascarar el fallo real del test */
    }
  }
})

/** Monta mapa + panes + capa, y lo apunta todo para la limpieza. */
function conMapa({ alAvisar } = {}) {
  const { mapa, contenedor, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
  crearPanes(mapa)
  const capa = crearCapaColindantes({ mapa, zona: ZONA, alAvisar })
  montados.push(() => {
    capa.destruir()
    destruir()
  })
  return { mapa, contenedor, capa }
}

/**
 * Las capas vivas del mapa, **sin el RENDERIZADOR**. Leaflet añade su `L.SVG` al
 * mapa como una capa más en cuanto se dibuja el primer trazo, así que sin este
 * filtro «el mapa quedó limpio» sería imposible de afirmar. Misma trampa —y misma
 * solución— que en `test/viewer/contraste.dom.test.js`.
 */
function capasDe(mapa) {
  const todas = []
  mapa.eachLayer((c) => {
    if (!(c instanceof L.Renderer)) todas.push(c)
  })
  return todas
}

/** Los polígonos que la capa ha puesto en SU pane (405). */
const contornosDe = (mapa) =>
  capasDe(mapa).filter((c) => c instanceof L.Polygon && c.options.pane === PANE.COLINDANTES)

// ── EL RIESGO DE LA TAREA: la capa interactiva y el clic del mapa ────────────

describe('viewer/colindantes · el CLIC del mapa sobrevive a la capa interactiva', () => {
  /**
   * Un clic REAL del DOM sobre el elemento de una capa. No se usa `capa.fire()`:
   * eso saltaría justamente la maquinaria que se quiere medir
   * (`Map#_handleDOMEvent` → `_findEventTargets` → `_fireDOMEvent`, que es donde
   * vive el `bubblingMouseEvents`).
   */
  function clicarSobre(elemento, { x = 400, y = 300 } = {}) {
    elemento.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }),
    )
  }

  it('un clic sobre una vecina LLEGA a mapa.on(«click»), con su latlng', () => {
    // ⚠️ ESTE es el test que decide el diseño de la capa. `bindTooltip` exige
    // `interactive:true`, y una capa interactiva podría tragarse el clic del que
    // depende la deducción por clic de F05 (saca la referencia catastral de dónde se
    // pulsa). Si este test cae, la capa se queda SIN emergente y con
    // `interactive:false`: el clic de F05 manda sobre el adorno.
    const { mapa, capa } = conMapa()
    const alClicar = vi.fn()
    mapa.on('click', alClicar)

    capa.pintar([VECINA_A])
    const path = contornosDe(mapa)[0].getElement()
    expect(path, 'la vecina no ha llegado a dibujar su <path>').not.toBeNull()

    clicarSobre(path)

    expect(alClicar).toHaveBeenCalledTimes(1)
    const evento = alClicar.mock.calls[0][0]
    expect(Number.isFinite(evento.latlng.lat)).toBe(true)
    expect(Number.isFinite(evento.latlng.lng)).toBe(true)
    // Y el latlng es el DEL PUNTERO (el que F05 convierte a referencia
    // catastral), no el centro de la vecina: se comprueba contra la conversión
    // que hace el propio mapa desde el punto del contenedor.
    const esperado = mapa.containerPointToLatLng(L.point(400, 300))
    expect(evento.latlng.lat).toBeCloseTo(esperado.lat, 9)
    expect(evento.latlng.lng).toBeCloseTo(esperado.lng, 9)
  })

  it('el polígono declara `bubblingMouseEvents` (el defecto de L.Path del que depende)', () => {
    // Guardián del hallazgo: si una versión futura de Leaflet cambiara ese
    // defecto, esta prueba cae AQUÍ y no en la pantalla del usuario.
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A])
    expect(contornosDe(mapa)[0].options.bubblingMouseEvents).toBe(true)
  })

  it('el clic también llega con VARIAS vecinas y con la de hueco', () => {
    const { mapa, capa } = conMapa()
    const alClicar = vi.fn()
    mapa.on('click', alClicar)

    capa.pintar([VECINA_A, VECINA_B, VECINA_CON_HUECO])
    for (const contorno of contornosDe(mapa)) clicarSobre(contorno.getElement())

    expect(alClicar).toHaveBeenCalledTimes(3)
  })

  it('sin capa pintada el mapa sigue recibiendo sus clics (línea base del test)', () => {
    // Sin esta línea base, el test de arriba podría estar pasando por un motivo
    // equivocado (p. ej. que el mapa reciba el clic pase lo que pase).
    const { mapa, contenedor } = conMapa()
    const alClicar = vi.fn()
    mapa.on('click', alClicar)

    clicarSobre(contenedor.querySelector('.leaflet-map-pane'))

    expect(alClicar).toHaveBeenCalledTimes(1)
  })
})

// ── Contratos del programador ────────────────────────────────────────────────

describe('viewer/colindantes · contratos del programador (throw, nunca corrección callada)', () => {
  it('un mapa que no es L.Map lanza TypeError', () => {
    for (const mapa of [null, undefined, {}, { addLayer() {} }, 'mapa']) {
      expect(() => crearCapaColindantes({ mapa, zona: ZONA })).toThrow(TypeError)
    }
  })

  it('una zona fuera de 29/30/31 lanza RangeError', () => {
    const { mapa } = conMapa()
    for (const zona of [28, 32, '30', null, undefined]) {
      expect(() => crearCapaColindantes({ mapa, zona })).toThrow(RangeError)
    }
  })

  it('sin el pane `colindantes` lanza, y el mensaje dice por qué existe ese pane', () => {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    montados.push(destruir)
    // A propósito NO se llama a `crearPanes`: el mapa está pelado.
    let error = null
    try {
      crearCapaColindantes({ mapa, zona: ZONA })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toContain(PANE.COLINDANTES)
    expect(error.message).toMatch(/contexto/i)
  })

  it('`vecinas` que no es array ni null lanza, y el mensaje avisa de la trampa de F05', () => {
    const { capa } = conMapa()
    for (const vecinas of ['9398501VK3799G', 42, {}]) {
      expect(() => capa.pintar(vecinas)).toThrow(TypeError)
    }
    // La trampa REAL, ya documentada en `app/main.js#alColindantes`: F05 devuelve
    // PARCELAS y `edicion.fijarColindantes` recibe RECINTOS. Aquí van parcelas.
    let error = null
    try {
      capa.pintar({})
    } catch (e) {
      error = e
    }
    expect(error.message).toContain('PARCELAS')
  })

  it('`null` no lanza: es la forma de limpiar', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A])
    expect(contornosDe(mapa)).toHaveLength(1)

    expect(() => capa.pintar(null)).not.toThrow()
    expect(contornosDe(mapa)).toHaveLength(0)
  })
})

// ── Lo que se dibuja ─────────────────────────────────────────────────────────

describe('viewer/colindantes · pinta una forma por vecina', () => {
  it('tres vecinas ⇒ tres polígonos, todos en el pane `colindantes`', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A, VECINA_B, VECINA_CON_HUECO])

    const contornos = contornosDe(mapa)
    expect(contornos).toHaveLength(3)
    for (const contorno of contornos) {
      expect(contorno.options.pane).toBe(PANE.COLINDANTES)
      expect(contorno.options.className).toBe(CLASE_COLINDANTE)
    }
  })

  it('UNA forma por VECINA, no una por recinto: el hueco es otro anillo del mismo polígono', () => {
    // Es lo que hace que el emergente sea uno por parcela —la unidad que tiene
    // referencia catastral— y que el patio se recorte solo (`fillRule:'evenodd'`).
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_CON_HUECO])

    const contornos = contornosDe(mapa)
    expect(contornos).toHaveLength(1)
    expect(contornos[0].getLatLngs()).toHaveLength(2)
  })

  it('los vértices llegan proyectados desde UTM con la ZONA que se le dio', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A])

    const anillo = contornosDe(mapa)[0].getLatLngs()[0]
    expect(anillo).toHaveLength(4)
    const [lat, lon] = vertUTMaLatLng(VECINA_A.recintos[0].vertices[0], ZONA)
    expect(anillo[0].lat).toBeCloseTo(lat, 9)
    expect(anillo[0].lng).toBeCloseTo(lon, 9)
  })

  it('es IDEMPOTENTE: pintar dos veces lo mismo no acumula contornos', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A, VECINA_B])
    capa.pintar([VECINA_A, VECINA_B])
    expect(contornosDe(mapa)).toHaveLength(2)
  })

  it('un array vacío deja el mapa sin contornos (y no es lo mismo que no consultar)', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A])
    capa.pintar([])
    expect(contornosDe(mapa)).toHaveLength(0)
  })
})

// ── El emergente ─────────────────────────────────────────────────────────────

describe('viewer/colindantes · el título emergente lleva la referencia catastral', () => {
  it('cada contorno trae SU referencia', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A, VECINA_B])

    const contenidos = contornosDe(mapa).map((c) => c.getTooltip().getContent())
    expect(contenidos).toEqual([VECINA_A.refcat, VECINA_B.refcat])
  })

  it('el emergente cuelga del polígono y usa la clase estable del módulo', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A])

    const tooltip = contornosDe(mapa)[0].getTooltip()
    expect(tooltip).toBeTruthy()
    expect(tooltip.options.className).toBe(CLASE_EMERGENTE)
    // `sticky`: sigue al puntero. En una parcela rústica grande, el centro
    // geométrico puede caer fuera de la pantalla y el rótulo no se vería.
    expect(tooltip.options.sticky).toBe(true)
  })

  it('una vecina SIN referencia lo DICE, no se queda muda (regla de oro 1)', () => {
    // El caso existe de verdad: `gml/parse.js` devuelve `''` donde el elemento
    // está y viene vacío. Un contorno mudo entre otros que hablan se lee como
    // «este no ha cargado bien».
    const { mapa, capa } = conMapa()
    capa.pintar([
      { refcat: null, recintos: VECINA_A.recintos },
      { refcat: '   ', recintos: VECINA_B.recintos },
    ])

    for (const contorno of contornosDe(mapa)) {
      expect(contorno.getTooltip().getContent()).toBe(SIN_REFERENCIA)
    }
  })

  it('`textoEmergente` es la ÚNICA fuente del texto (los tests no copian el formato)', () => {
    expect(textoEmergente('9398501VK3799G')).toBe('9398501VK3799G')
    expect(textoEmergente('  9398501VK3799G  ')).toBe('9398501VK3799G')
    expect(textoEmergente('')).toBe(SIN_REFERENCIA)
    expect(textoEmergente(null)).toBe(SIN_REFERENCIA)
    expect(textoEmergente(undefined)).toBe(SIN_REFERENCIA)
  })
})

// ── El estilo: contexto, no veredicto (regla de oro 9) ───────────────────────

describe('viewer/colindantes · ni un color de mérito (regla de oro 9)', () => {
  it('contorno GRIS, fino y sin relleno visible', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A])
    const { options } = contornosDe(mapa)[0]

    // Gris de verdad: las tres componentes del color, iguales o casi (un gris
    // azulado sigue siendo neutro; un verde o un rojo no lo serían).
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(options.color.slice(i, i + 2), 16))
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeLessThan(24)
    // Y CLARO: los tonos oscuros desaparecen en las sombras de la ortofoto, que
    // es la lección que llevó el color del usuario del violeta al amarillo.
    expect(Math.min(r, g, b)).toBeGreaterThan(150)

    expect(options.weight).toBeLessThanOrEqual(2)
    // Sin relleno VISIBLE (cero píxeles pintados) …
    expect(options.fillOpacity).toBe(0)
    // … pero con `fill:true`, que es lo que hace que el interior entero responda
    // al emergente. Con `fill:false` habría que acertarle al trazo de 1,5 px.
    expect(options.fill).toBe(true)
  })

  it('NO usa el amarillo del usuario, ni verde, ni rojo, ni el ÁMBAR de la invasión', () => {
    // El ámbar (`viewer/contraste.js#COLOR_INVASION`) es la ÚNICA excepción
    // autorizada a la regla 9 en todo el proyecto. Si una vecina se pintara de
    // ámbar por el mero hecho de existir, el ámbar dejaría de significar lo único
    // que significa.
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A])
    const color = contornosDe(mapa)[0].options.color.toUpperCase()

    expect(color).not.toBe(COLOR_USUARIO.toUpperCase())
    expect(color).not.toBe('#D97706')
    expect(color).not.toMatch(/^#(0F0|00FF00|F00|FF0000)$/)
  })

  it('el pane 405 va por DEBAJO de la parcela oficial: el contexto no tapa al asunto', () => {
    const z = Object.fromEntries(PANES.map((p) => [p.nombre, p.zIndex]))
    expect(z[PANE.COLINDANTES]).toBe(405)
    expect(z[PANE.COLINDANTES]).toBeLessThan(z[PANE.PARCELA_OFICIAL])
    expect(z[PANE.COLINDANTES]).toBeLessThan(z[PANE.PARCELA_EDITADA])
    expect(z[PANE.COLINDANTES]).toBeLessThan(z[PANE.VERTICES])
    // Y por ENCIMA del overlayPane de Leaflet (400), donde vive la cartografía.
    expect(z[PANE.COLINDANTES]).toBeGreaterThan(400)
  })
})

// ── Vecinas sin contorno: no se pintan y NO se callan ────────────────────────

describe('viewer/colindantes · una vecina sin contorno dibujable se cuenta (regla de oro 1)', () => {
  it('se saltan las que no tienen anillo, y se AVISA con cuántas de cuántas', () => {
    // Callarlo dejaría 2 contornos en pantalla mientras el panel dice «4 parcelas
    // colindantes», y esa resta la tendría que hacer el usuario de cabeza.
    const alAvisar = vi.fn()
    const { mapa, capa } = conMapa({ alAvisar })

    capa.pintar([
      VECINA_A,
      { refcat: 'sin-recintos', recintos: [] },
      { refcat: 'anillo-corto', recintos: [{ vertices: [[X0, Y0], [X0 + 1, Y0]] }] },
      VECINA_B,
    ])

    expect(contornosDe(mapa)).toHaveLength(2)
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toContain('2 de 4')
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('un vértice NO FINITO no revienta dentro de L.LatLng: se descarta el anillo', () => {
    const alAvisar = vi.fn()
    const { mapa, capa } = conMapa({ alAvisar })

    expect(() =>
      capa.pintar([
        {
          refcat: 'rota',
          recintos: [{ vertices: [[X0, Y0], [NaN, Y0], [X0 + 10, Y0 + 10]] }],
        },
      ]),
    ).not.toThrow()

    expect(contornosDe(mapa)).toHaveLength(0)
    expect(alAvisar).toHaveBeenCalledTimes(1)
  })

  it('sin ninguna saltada NO avisa (el canal no se usa para decir «todo bien»)', () => {
    const alAvisar = vi.fn()
    const { capa } = conMapa({ alAvisar })
    capa.pintar([VECINA_A, VECINA_B])
    expect(alAvisar).not.toHaveBeenCalled()
  })
})

// ── limpiar() y destruir() ───────────────────────────────────────────────────

describe('viewer/colindantes · limpiar y destruir', () => {
  it('`limpiar()` quita los contornos y la capa sigue viva', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VECINA_A, VECINA_B])
    expect(contornosDe(mapa)).toHaveLength(2)

    capa.limpiar()
    expect(contornosDe(mapa)).toHaveLength(0)

    // Sigue sirviendo: es lo que la distingue de `destruir()`. El caso real es
    // cambiar de parcela — las vecinas de antes ya no lindan con nada.
    capa.pintar([VECINA_A])
    expect(contornosDe(mapa)).toHaveLength(1)
  })

  it('`destruir()` deja el mapa como estaba, y es IDEMPOTENTE', () => {
    const { mapa, capa } = conMapa()
    const antes = capasDe(mapa).length
    capa.pintar([VECINA_A, VECINA_B, VECINA_CON_HUECO])
    expect(capasDe(mapa).length).toBe(antes + 3)

    capa.destruir()

    expect(contornosDe(mapa)).toHaveLength(0)
    expect(capasDe(mapa).length).toBe(antes)
    expect(() => capa.destruir()).not.toThrow()
    expect(() => capa.destruir()).not.toThrow()
  })

  it('tras `destruir()`, `pintar` es un NO-OP y no lanza (respuesta del WFS en vuelo)', () => {
    // El desmontaje del visor va en orden inverso y una consulta de colindantes
    // puede resolverse después. Mismo criterio que `acotaciones.pintar` y
    // `contraste.pintar`.
    const { mapa, capa } = conMapa()
    capa.destruir()

    expect(() => capa.pintar([VECINA_A])).not.toThrow()
    expect(contornosDe(mapa)).toHaveLength(0)
  })
})

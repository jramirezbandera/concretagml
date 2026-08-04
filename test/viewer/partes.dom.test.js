/* -------------------------------------------------------------------------- *
 * test/viewer/partes.dom.test.js — Las HUELLAS de las partes de construcción   *
 *                                                                            *
 * `viewer/partes.js` dibuja; no calcula, no consulta y no valida nada. Así que  *
 * aquí se prueba lo que se PONE en el mapa y con qué opciones. Por orden de     *
 * importancia:                                                                 *
 *                                                                            *
 *   1. **UNA PARTE SIN `recinto` NO SE PINTA Y NO SE CALLA.** Es el caso que    *
 *      distingue a esta capa de la de colindantes: `recinto: null` es un estado *
 *      NORMAL del modelo («pendiente de dibujar», y dibujarlas es F12), así que  *
 *      no puede lanzar; pero si se callara, el mapa enseñaría 10 huellas         *
 *      mientras la lista del panel dice «13 partes» (regla de oro 1).          *
 *   2. **EL CLIC DEL MAPA SOBREVIVE A LA CAPA INTERACTIVA.** El emergente obliga *
 *      a `interactive:true`, y aquí el riesgo es MAYOR que en `colindantes.js`:  *
 *      aquella se defiende además con el apilado (pane 405, debajo de todo) y    *
 *      estas huellas van en 422, POR ENCIMA del polígono de la parcela. Se MIDE. *
 *   3. **Una huella por parte**, con su nombre en el emergente.                 *
 *   4. **El relleno es VISIBLE pero bajo**, y **ni un color de mérito**          *
 *      (regla de oro 9): ni el amarillo del usuario, ni el ámbar de la invasión. *
 *   5. **Que `limpiar()` y `destruir()` no dejan ni capas ni oyentes.**          *
 *                                                                            *
 * Las partes se construyen con `model/edificio.js#crearParteConstruccion`, NO a  *
 * mano: así el test respeta por construcción los invariantes del modelo (y de    *
 * paso atesta que `recinto: null` es un estado que el modelo ACEPTA, que es la   *
 * premisa entera del punto 1). Las dos excepciones —una parte sin nombre y una   *
 * con un vértice NaN— van como POJO literal a propósito: el modelo las prohíbe,  *
 * y son la red de esta capa, no un camino del modelo.                           *
 *                                                                            *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).         *
 * -------------------------------------------------------------------------- */

import L from 'leaflet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { ORIGEN_PARTE, crearParteConstruccion } from '../../model/edificio.js'
import { COLOR_USUARIO, NIVEL, PANE, PANES, vertUTMaLatLng } from '../../viewer/_comun.js'
import {
  CLASE_EMERGENTE,
  CLASE_HUELLA,
  SIN_NOMBRE,
  crearCapaPartes,
  textoEmergenteParte,
} from '../../viewer/partes.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

const ZONA = 30

// Rectángulos en UTM real (huso 30): la proyección se ejecuta de verdad.
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

/** Una parte con su huella, construida por el modelo. */
const parte = (nombre, recinto) =>
  crearParteConstruccion({ nombre, recinto, origen: ORIGEN_PARTE.DXF })

/** Vivienda + porche + piscina: el enunciado literal de la spec §14.2. */
const VIVIENDA = parte('Cuerpo principal', rect(X0, Y0, X0 + 12, Y0 + 10))
const PORCHE = parte('Porche', rect(X0 + 12, Y0, X0 + 16, Y0 + 4))
const PISCINA = parte('Piscina', rect(X0, Y0 + 14, X0 + 8, Y0 + 18))

/** Parte «pendiente de dibujar»: el modelo la ADMITE con `recinto: null`. */
const SIN_RECINTO = parte('Trastero (pendiente)', null)

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
  const capa = crearCapaPartes({ mapa, zona: ZONA, alAvisar })
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
 * solución— que en `colindantes.dom.test.js` y `contraste.dom.test.js`.
 */
function capasDe(mapa) {
  const todas = []
  mapa.eachLayer((c) => {
    if (!(c instanceof L.Renderer)) todas.push(c)
  })
  return todas
}

/** Las huellas que la capa ha puesto en SU pane (422). */
const huellasDe = (mapa) =>
  capasDe(mapa).filter((c) => c instanceof L.Polygon && c.options.pane === PANE.PARTES)

/**
 * Cuántos oyentes tiene registrados el mapa, sumando todos los tipos de evento.
 * `L.Evented` los guarda en `_events`; se lee esa interna a propósito, porque es
 * la ÚNICA forma de afirmar «no ha quedado ni uno» sin fiarse de la palabra del
 * módulo.
 *
 * ⚠️ **MEDIDO, y al revés de lo que parece:** pintar huellas NO sube esta cuenta.
 * `L.Path` no declara `getEvents()`, así que `Map#addLayer` no da de alta nada en
 * el mapa por un polígono, y `bindTooltip` engancha sus oyentes AL POLÍGONO, no
 * al mapa. El único que sí registra en el mapa es el RENDERIZADOR `L.SVG`, que se
 * monta con el primer trazo y se queda. O sea que la cuenta es PLANA — y eso es
 * justo lo que el `it` de más abajo atesta, con un control para no estar verde por
 * no medir nada.
 */
function contarOyentes(mapa) {
  const eventos = mapa._events || {}
  return Object.values(eventos).reduce((n, l) => n + (Array.isArray(l) ? l.length : 0), 0)
}

// ── EL CASO QUE DEFINE ESTA CAPA: la parte sin contorno ──────────────────────

describe('viewer/partes · una parte sin contorno dibujable NO se pinta y NO se calla', () => {
  it('`recinto: null` es un estado que el MODELO acepta (premisa de todo lo demás)', () => {
    // Si esto cayera, el resto de este bloque estaría probando un caso imposible.
    expect(() => parte('Trastero (pendiente)', null)).not.toThrow()
    expect(SIN_RECINTO.recinto).toBeNull()
  })

  it('NO lanza, se salta la parte y AVISA con cuántas de cuántas', () => {
    const alAvisar = vi.fn()
    const { mapa, capa } = conMapa({ alAvisar })

    expect(() =>
      capa.pintar([VIVIENDA, SIN_RECINTO, PORCHE, parte('Garaje (pendiente)', null)]),
    ).not.toThrow()

    expect(huellasDe(mapa)).toHaveLength(2)
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toContain('2 de 4')
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('AVISO y no ERROR: una parte pendiente de dibujar no impide seguir', () => {
    const alAvisar = vi.fn()
    const { capa } = conMapa({ alAvisar })
    capa.pintar([SIN_RECINTO])
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    expect(alAvisar.mock.calls[0][1].nivel).not.toBe(NIVEL.ERROR)
  })

  it('un solo aviso por LLAMADA, no uno por parte saltada', () => {
    // Trece partes sin dibujar no pueden producir trece tarjetas en el panel de
    // avisos: eso sería enterrar el resto de la pantalla.
    const alAvisar = vi.fn()
    const { capa } = conMapa({ alAvisar })
    capa.pintar([SIN_RECINTO, SIN_RECINTO, SIN_RECINTO, SIN_RECINTO, SIN_RECINTO])
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toContain('5 de 5')
  })

  it('un anillo de menos de 3 vértices tampoco se pinta, y también se cuenta', () => {
    const alAvisar = vi.fn()
    const { mapa, capa } = conMapa({ alAvisar })

    capa.pintar([
      VIVIENDA,
      parte('Muro', { vertices: [[X0, Y0], [X0 + 1, Y0]], tipo: 'EXTERIOR' }),
    ])

    expect(huellasDe(mapa)).toHaveLength(1)
    expect(alAvisar.mock.calls[0][0]).toContain('1 de 2')
  })

  it('un vértice NO FINITO no revienta dentro de L.LatLng: se descarta el anillo', () => {
    // POJO literal a propósito: es la red de esta capa, no un camino del modelo.
    const alAvisar = vi.fn()
    const { mapa, capa } = conMapa({ alAvisar })

    expect(() =>
      capa.pintar([
        { nombre: 'Rota', recinto: { vertices: [[X0, Y0], [NaN, Y0], [X0 + 10, Y0 + 10]] } },
      ]),
    ).not.toThrow()

    expect(huellasDe(mapa)).toHaveLength(0)
    expect(alAvisar).toHaveBeenCalledTimes(1)
  })

  it('sin ninguna saltada NO avisa (el canal no se usa para decir «todo bien»)', () => {
    const alAvisar = vi.fn()
    const { capa } = conMapa({ alAvisar })
    capa.pintar([VIVIENDA, PORCHE, PISCINA])
    expect(alAvisar).not.toHaveBeenCalled()
  })
})

// ── EL RIESGO HEREDADO: la capa interactiva y el clic del mapa ───────────────

describe('viewer/partes · el CLIC del mapa sobrevive a la capa interactiva', () => {
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

  it('un clic sobre una huella LLEGA a mapa.on(«click»), con su latlng', () => {
    // ⚠️ En `colindantes.js` este test decidía el diseño de la capa; aquí decide
    // más, porque estas huellas van en el pane 422 —POR ENCIMA del polígono de la
    // parcela— y no pueden apoyarse en el apilado como hace aquella. Si cae, la
    // salida es la misma: sin emergente y con `interactive:false`.
    const { mapa, capa } = conMapa()
    const alClicar = vi.fn()
    mapa.on('click', alClicar)

    capa.pintar([VIVIENDA])
    const path = huellasDe(mapa)[0].getElement()
    expect(path, 'la huella no ha llegado a dibujar su <path>').not.toBeNull()

    clicarSobre(path)

    expect(alClicar).toHaveBeenCalledTimes(1)
    const evento = alClicar.mock.calls[0][0]
    const esperado = mapa.containerPointToLatLng(L.point(400, 300))
    expect(evento.latlng.lat).toBeCloseTo(esperado.lat, 9)
    expect(evento.latlng.lng).toBeCloseTo(esperado.lng, 9)
  })

  it('la huella declara `bubblingMouseEvents` (el defecto de L.Path del que depende)', () => {
    // Guardián del hallazgo: si una versión futura de Leaflet cambiara ese
    // defecto, esta prueba cae AQUÍ y no en la pantalla del usuario.
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    expect(huellasDe(mapa)[0].options.bubblingMouseEvents).toBe(true)
  })
})

// ── Contratos del programador ────────────────────────────────────────────────

describe('viewer/partes · contratos del programador (throw, nunca corrección callada)', () => {
  it('un mapa que no es L.Map lanza TypeError', () => {
    for (const mapa of [null, undefined, {}, { addLayer() {} }, 'mapa']) {
      expect(() => crearCapaPartes({ mapa, zona: ZONA })).toThrow(TypeError)
    }
  })

  it('una zona fuera de 29/30/31 lanza RangeError, y el mensaje avisa de la trampa del srs', () => {
    const { mapa } = conMapa()
    for (const zona of [28, 32, '30', null, undefined]) {
      expect(() => crearCapaPartes({ mapa, zona })).toThrow(RangeError)
    }
    // ⚠️ La confusión REAL de esta fase: `zona` es el HUSO, no el `srs`. Pasar
    // 'EPSG:25830' no da un error de dibujo, pone las huellas en otro continente.
    let error = null
    try {
      crearCapaPartes({ mapa, zona: 'EPSG:25830' })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(RangeError)
    expect(error.message).toContain('husoPorSrs')
  })

  it('sin el pane `partes` lanza, y el mensaje dice por qué existe ese pane', () => {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    montados.push(destruir)
    // A propósito NO se llama a `crearPanes`: el mapa está pelado.
    let error = null
    try {
      crearCapaPartes({ mapa, zona: ZONA })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toContain(PANE.PARTES)
    expect(error.message).toMatch(/contexto/i)
  })

  it('un `alAvisar` que no es función lanza (lo hace `resolverAvisar`)', () => {
    const { mapa } = conMapa()
    expect(() => crearCapaPartes({ mapa, zona: ZONA, alAvisar: 'avisa' })).toThrow(TypeError)
  })

  it('`partes` que no es array ni null lanza, y el mensaje avisa de la trampa del nombre', () => {
    const { capa } = conMapa()
    for (const partes of ['Cuerpo principal', 42, {}, VIVIENDA]) {
      expect(() => capa.pintar(partes)).toThrow(TypeError)
    }
    // La trampa real: pasarle `edificio.partes.map(p => p.recinto)` no lanzaría y
    // dejaría todas las huellas con el mismo rótulo genérico.
    let error = null
    try {
      capa.pintar({})
    } catch (e) {
      error = e
    }
    expect(error.message).toContain('nombre')
  })

  it('`null` y `undefined` no lanzan: son la forma de limpiar', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    expect(huellasDe(mapa)).toHaveLength(1)

    expect(() => capa.pintar(null)).not.toThrow()
    expect(huellasDe(mapa)).toHaveLength(0)

    capa.pintar([VIVIENDA])
    expect(() => capa.pintar(undefined)).not.toThrow()
    expect(huellasDe(mapa)).toHaveLength(0)
  })
})

// ── Lo que se dibuja ─────────────────────────────────────────────────────────

describe('viewer/partes · pinta una huella por parte', () => {
  it('tres partes ⇒ tres polígonos, todos en el pane `partes` y con la clase estable', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA, PORCHE, PISCINA])

    const huellas = huellasDe(mapa)
    expect(huellas).toHaveLength(3)
    for (const huella of huellas) {
      expect(huella.options.pane).toBe(PANE.PARTES)
      expect(huella.options.className).toBe(CLASE_HUELLA)
    }
  })

  it('UN anillo por huella: una parte trae UN `recinto`, no un array de ellos', () => {
    // Es la diferencia estructural con `colindantes.js`, donde una vecina lleva
    // exterior + patios dentro del mismo polígono. Si F12 le da huecos a una
    // parte, esta prueba es la que lo destapa.
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    expect(huellasDe(mapa)[0].getLatLngs()).toHaveLength(1)
  })

  it('los vértices llegan proyectados desde UTM con la ZONA que se le dio', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])

    const anillo = huellasDe(mapa)[0].getLatLngs()[0]
    expect(anillo).toHaveLength(4)
    const [lat, lon] = vertUTMaLatLng(VIVIENDA.recinto.vertices[0], ZONA)
    expect(anillo[0].lat).toBeCloseTo(lat, 9)
    expect(anillo[0].lng).toBeCloseTo(lon, 9)
  })

  it('es IDEMPOTENTE: pintar dos veces lo mismo no acumula huellas', () => {
    // Es lo que permite que el suscriptor del store la llame en cada `set` sin
    // llevar la cuenta de nada.
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA, PORCHE])
    capa.pintar([VIVIENDA, PORCHE])
    capa.pintar([VIVIENDA, PORCHE])
    expect(huellasDe(mapa)).toHaveLength(2)
  })

  it('cada `pintar` SUSTITUYE: pintar menos partes deja menos huellas', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA, PORCHE, PISCINA])
    expect(huellasDe(mapa)).toHaveLength(3)
    capa.pintar([VIVIENDA])
    expect(huellasDe(mapa)).toHaveLength(1)
  })

  it('un array vacío deja el mapa sin huellas (y no avisa: cero de cero)', () => {
    const alAvisar = vi.fn()
    const { mapa, capa } = conMapa({ alAvisar })
    capa.pintar([VIVIENDA])
    capa.pintar([])
    expect(huellasDe(mapa)).toHaveLength(0)
    expect(alAvisar).not.toHaveBeenCalled()
  })
})

// ── El pane 422 ──────────────────────────────────────────────────────────────

describe('viewer/partes · el pane 422, entre la parcela y las anotaciones', () => {
  it('sobre la parcela editada (el asunto es el edificio) y bajo vértices y anotaciones', () => {
    const z = Object.fromEntries(PANES.map((p) => [p.nombre, p.zIndex]))
    expect(PANE.PARTES).toBe('partes')
    expect(z[PANE.PARTES]).toBe(422)
    // SOBRE la parcela: por debajo, el relleno amarillo taparía la huella.
    expect(z[PANE.PARTES]).toBeGreaterThan(z[PANE.PARCELA_EDITADA])
    expect(z[PANE.PARTES]).toBeGreaterThan(z[PANE.PARCELA_OFICIAL])
    expect(z[PANE.PARTES]).toBeGreaterThan(z[PANE.COLINDANTES])
    // DEBAJO de las anotaciones (una cota bajo un relleno no se lee) y de los
    // vértices, que es lo que se agarra en F12.
    expect(z[PANE.PARTES]).toBeLessThan(z[PANE.ACOTACIONES])
    expect(z[PANE.PARTES]).toBeLessThan(z[PANE.DIAGNOSTICO])
    expect(z[PANE.PARTES]).toBeLessThan(z[PANE.VERTICES])
  })

  it('las huellas van al pane `partes` y no al `overlayPane` por defecto', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    const path = huellasDe(mapa)[0].getElement()
    expect(path.closest('.leaflet-pane').classList.contains(`leaflet-${PANE.PARTES}-pane`)).toBe(
      true,
    )
  })
})

// ── El emergente ─────────────────────────────────────────────────────────────

describe('viewer/partes · el título emergente lleva el NOMBRE de la parte', () => {
  it('cada huella trae SU nombre', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA, PORCHE, PISCINA])

    const contenidos = huellasDe(mapa).map((c) => c.getTooltip().getContent())
    expect(contenidos).toEqual(['Cuerpo principal', 'Porche', 'Piscina'])
  })

  it('el emergente cuelga del polígono y usa la clase estable del módulo', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])

    const tooltip = huellasDe(mapa)[0].getTooltip()
    expect(tooltip).toBeTruthy()
    expect(tooltip.options.className).toBe(CLASE_EMERGENTE)
    // `sticky`: sigue al puntero. En un edificio en L el centro geométrico cae
    // FUERA del polígono, y un rótulo ahí no explica nada.
    expect(tooltip.options.sticky).toBe(true)
  })

  it('una parte sin nombre lo DICE, no se queda muda (regla de oro 1)', () => {
    // POJO literal: `crearParteConstruccion` LANZA con un nombre vacío, así que
    // esto es la red de la capa y no un camino del modelo. Se comprueban las dos
    // cosas, para que quede claro cuál es cuál.
    expect(() => parte('', rect(X0, Y0, X0 + 5, Y0 + 5))).toThrow(TypeError)

    const { mapa, capa } = conMapa()
    capa.pintar([
      { nombre: '', recinto: rect(X0, Y0, X0 + 5, Y0 + 5) },
      { nombre: '   ', recinto: rect(X0 + 6, Y0, X0 + 11, Y0 + 5) },
      { recinto: rect(X0 + 12, Y0, X0 + 17, Y0 + 5) },
    ])

    for (const huella of huellasDe(mapa)) {
      expect(huella.getTooltip().getContent()).toBe(SIN_NOMBRE)
    }
  })

  it('`textoEmergenteParte` es la ÚNICA fuente del texto (los tests no copian el formato)', () => {
    expect(textoEmergenteParte('Porche')).toBe('Porche')
    expect(textoEmergenteParte('  Porche  ')).toBe('Porche')
    expect(textoEmergenteParte('')).toBe(SIN_NOMBRE)
    expect(textoEmergenteParte('   ')).toBe(SIN_NOMBRE)
    expect(textoEmergenteParte(null)).toBe(SIN_NOMBRE)
    expect(textoEmergenteParte(undefined)).toBe(SIN_NOMBRE)
  })
})

// ── El estilo: la huella es el ASUNTO, pero sin veredicto (regla de oro 9) ────

describe('viewer/partes · relleno visible pero bajo, y ni un color de mérito', () => {
  it('RELLENA de verdad: `fill:true` y una opacidad ni cero ni opaca', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    const { options } = huellasDe(mapa)[0]

    expect(options.fill).toBe(true)
    // Ni cero —al revés que `colindantes.js`, donde el relleno invisible es un
    // truco para el emergente—: aquí la huella es el asunto y tiene que verse.
    expect(options.fillOpacity).toBeGreaterThan(0)
    // Ni opaca: el usuario tiene que seguir viendo LA CUBIERTA de la ortofoto que
    // hay debajo, porque comparar la huella con el tejado real es la comprobación
    // entera que justifica pintar las partes (decisión 3 de F11).
    expect(options.fillOpacity).toBeLessThanOrEqual(0.35)
    expect(options.fillColor).toBe(options.color)
  })

  it('NO usa el amarillo del usuario: la parcela sigue debajo y hay que distinguirlas', () => {
    // La restricción propia de esta capa. En la rama EDIFICIO la parcela es
    // contexto y se pinta de amarillo en el pane 420; estas huellas van en el 422,
    // justo encima. Del mismo color, el técnico no sabría qué está mirando.
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    const color = huellasDe(mapa)[0].options.color.toUpperCase()
    expect(color).not.toBe(COLOR_USUARIO.toUpperCase())
  })

  it('NI el ÁMBAR de la invasión, ni verde, ni rojo (regla de oro 9)', () => {
    // El ámbar (`viewer/contraste.js#COLOR_INVASION`) es la ÚNICA excepción
    // autorizada a la regla 9 en todo el proyecto: significa invasión y solo eso.
    // Una parte de construcción no está «bien» ni «mal».
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    const color = huellasDe(mapa)[0].options.color.toUpperCase()

    expect(color).not.toBe('#D97706')
    expect(color).not.toBe('#DB2777') // la desviación máxima de F07
    expect(color).not.toMatch(/^#(0F0|00FF00|F00|FF0000)$/)
  })

  it('NO es gris: el gris es el contexto (la colindante y la diferencia sombreada)', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    const { color } = huellasDe(mapa)[0].options
    const [r, g, b] = [1, 3, 5].map((i) => parseInt(color.slice(i, i + 2), 16))

    // Un gris tiene las tres componentes casi iguales; este tono no puede serlo.
    expect(Math.max(r, g, b) - Math.min(r, g, b)).toBeGreaterThan(24)
    // Y CLARO: los tonos oscuros desaparecen en las sombras de la ortofoto, y una
    // huella se dibuja precisamente sobre una cubierta. Es el motivo por el que la
    // fase 5 de F03 le quitó el violeta oscuro `#7C3AED` a la geometría del
    // usuario, y aquí muerde igual.
    expect(Math.min(r, g, b)).toBeGreaterThan(120)
    expect(color.toUpperCase()).not.toBe('#7C3AED')
  })

  it('el trazo es opaco y algo más grueso que el de una colindante', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    const { options } = huellasDe(mapa)[0]
    expect(options.opacity).toBe(1)
    expect(options.weight).toBeGreaterThan(1.5)
  })
})

// ── limpiar() y destruir() ───────────────────────────────────────────────────

describe('viewer/partes · limpiar y destruir', () => {
  it('`limpiar()` quita las huellas y la capa sigue viva', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA, PORCHE])
    expect(huellasDe(mapa)).toHaveLength(2)

    capa.limpiar()
    expect(huellasDe(mapa)).toHaveLength(0)

    // Sigue sirviendo: es lo que la distingue de `destruir()`. El caso real es
    // conmutar a la rama PARCELA y volver.
    capa.pintar([VIVIENDA])
    expect(huellasDe(mapa)).toHaveLength(1)
  })

  it('`limpiar()` sobre un mapa ya limpio no lanza (es idempotente)', () => {
    const { capa } = conMapa()
    expect(() => capa.limpiar()).not.toThrow()
    expect(() => capa.limpiar()).not.toThrow()
  })

  it('`destruir()` deja el mapa como estaba, y es IDEMPOTENTE', () => {
    const { mapa, capa } = conMapa()
    const antes = capasDe(mapa).length
    capa.pintar([VIVIENDA, PORCHE, PISCINA])
    expect(capasDe(mapa).length).toBe(antes + 3)

    capa.destruir()

    expect(huellasDe(mapa)).toHaveLength(0)
    expect(capasDe(mapa).length).toBe(antes)
    expect(() => capa.destruir()).not.toThrow()
    expect(() => capa.destruir()).not.toThrow()
  })

  it('la capa NO engancha ni un OYENTE al mapa: ni al pintar, ni al destruir', () => {
    // Lo que se atesta es que esta capa no toca los eventos del mapa, al contrario
    // que `viewer/contraste.js`, que sí escucha `zoomend` y tiene que soltarlo en
    // su `destruir`. Si alguien enchufa aquí un `mapa.on(...)` —para repintar al
    // hacer zoom, por ejemplo— sin su `off`, esta prueba cae.
    const { mapa, capa } = conMapa()
    // La línea base se toma DESPUÉS de un ciclo completo: el renderizador SVG de
    // Leaflet se monta con el primer trazo, registra LO SUYO y se queda para
    // siempre, así que contarlo antes haría pasar su alta por una fuga nuestra.
    capa.pintar([VIVIENDA])
    capa.limpiar()
    const base = contarOyentes(mapa)
    const espiaOn = vi.spyOn(mapa, 'on')

    capa.pintar([VIVIENDA, PORCHE, PISCINA])
    expect(contarOyentes(mapa)).toBe(base)
    capa.pintar([VIVIENDA])
    capa.destruir()

    expect(contarOyentes(mapa)).toBe(base)
    expect(espiaOn).not.toHaveBeenCalled()

    // ── CONTROL DEL INSTRUMENTO ──────────────────────────────────────────────
    // Sin esto, el `it` estaría verde por no medir nada: la cuenta es PLANA (un
    // `L.Polygon` no registra eventos en el mapa; ver `contarOyentes`), así que
    // hay que demostrar que sube cuando algo la sube de verdad.
    mapa.on('click', () => {})
    expect(contarOyentes(mapa)).toBe(base + 1)
    expect(espiaOn).toHaveBeenCalledTimes(1)
    espiaOn.mockRestore()
  })

  it('`destruir()` no deja el emergente abierto colgando del documento', () => {
    const { mapa, capa } = conMapa()
    capa.pintar([VIVIENDA])
    huellasDe(mapa)[0].openTooltip()
    expect(document.querySelectorAll(`.${CLASE_EMERGENTE}`).length).toBe(1)

    capa.destruir()

    expect(document.querySelectorAll(`.${CLASE_EMERGENTE}`).length).toBe(0)
  })

  it('tras `destruir()`, `pintar` es un NO-OP y no lanza (respuesta del WFS en vuelo)', () => {
    // El desmontaje del visor va en orden inverso y una consulta del `wfsBU` puede
    // resolverse después. Mismo criterio que `colindantes.pintar` y
    // `contraste.pintar`.
    const { mapa, capa } = conMapa()
    capa.destruir()

    expect(() => capa.pintar([VIVIENDA])).not.toThrow()
    expect(huellasDe(mapa)).toHaveLength(0)
    // Y ni siquiera lanza con basura: tras destruir no se valida nada porque no se
    // hace nada.
    expect(() => capa.pintar('basura')).not.toThrow()
  })
})

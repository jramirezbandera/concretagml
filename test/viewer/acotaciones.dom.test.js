// test/viewer/acotaciones.dom.test.js — F06 · Tarea T3.2.
//
// Proyecto Vitest `dom` (jsdom): el nombre `*.dom.test.js` lo enruta ahí, y el
// módulo bajo prueba importa Leaflet (solo-navegador).
//
// Lo que se blinda aquí, por orden de importancia:
//   · **La cota no roba el clic.** En F06 el clic sobre un lado inserta un
//     vértice, y el punto medio del lado —donde vive la cota— es justo donde más
//     se pincha. Hay una prueba de COMPORTAMIENTO (se despacha un `click` real
//     sobre el rótulo y se comprueba que lo recibe el MAPA, no la cota), no solo
//     una aserción sobre `options.interactive`.
//   · **El filtro es por píxeles.** Al alejar el zoom las cotas desaparecen solas
//     y al acercar reaparecen, sin que nadie las apague y sin repintar. El umbral
//     esperado se DERIVA de `OPERATIVOS.acotacionMinimaPx` y de la proyección real
//     del mapa; no hay ningún `44` ni ningún nº de píxeles escrito a mano.
//   · **`soloRef` repinta dos lados y solo dos.** Se comprueba moviendo DOS
//     vértices y declarando UNO: los lados no declarados deben quedarse con su
//     texto viejo. Un test que solo mirara los lados repintados pasaría también
//     con un repintado completo, es decir, no probaría nada.
//   · **No hay fuga de listeners de mapa** (`zoomend`/`moveend`), que es lo que
//     `viewer/index.js` desmonta en orden inverso.
//
// El arnés (`_ayuda-jsdom.js`) da un contenedor con `clientWidth/Height` REALES:
// sin eso `map.getSize()` sería `(0,0)` y la medida en píxeles no mediría nada.
// Hay una prueba explícita de esa premisa (`el arnés no miente`), para que ningún
// test de esta suite pueda pasar por casualidad sobre una proyección degenerada.

import { describe, it, expect, vi, afterEach } from 'vitest'
import L from 'leaflet'

import { NIVEL, PANE, vertUTMaLatLng } from '../../viewer/_comun.js'
import {
  CLASE_ACOTACION,
  crearAcotaciones,
  textoDeLongitud,
} from '../../viewer/acotaciones.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { longitudesDeLados } from '../../geo/metrica.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

// ── Geometría de prueba ──────────────────────────────────────────────────────

const HUSO = 30

/**
 * Rectángulo 20 × 15 m (Este × Norte), anillo ABIERTO, en el entorno del fixture
 * F00 — es el mismo exterior que usa `parcelaConHueco()` del arnés, así que el
 * centro por defecto de `montarMapa` cae encima.
 *
 * Lados: `20 · 15 · 20 · 15`, y el CUARTO es el de cierre (`v[3] → v[0]`).
 */
const RECTANGULO = [
  [439240, 4479655],
  [439260, 4479655],
  [439260, 4479670],
  [439240, 4479670],
]

/**
 * Tira 40 × 4 m: lados muy desiguales a propósito. A los zooms de esta suite unos
 * superan el umbral de 44 px y otros no, que es lo que hace que la prueba del
 * valor POR DEFECTO no sea vacua (se comprueba: `new Set(esperado).size === 2`).
 */
const TIRA = [
  [439240, 4479655],
  [439280, 4479655],
  [439280, 4479659],
  [439240, 4479659],
]

// ── Utilidades del test ──────────────────────────────────────────────────────

/** Limpieza garantizada (LIFO) aunque un `expect` falle a mitad de test. */
const pendientes = []
afterEach(() => {
  while (pendientes.length) {
    const limpiar = pendientes.pop()
    try {
      limpiar()
    } catch {
      /* la limpieza nunca debe enmascarar el fallo real del test */
    }
  }
})

/** Mapa del arnés + los panes de `PANES` (derivados, nunca a mano). */
function montarSoporte({ zoom = 19, conPanes = true } = {}) {
  const { mapa, destruir } = montarMapa({ zoom })
  pendientes.push(destruir)
  if (conPanes) crearPanes(mapa)
  return mapa
}

/** La capa de acotaciones sobre un mapa ya montado, con su limpieza registrada. */
function acotar(mapa, opciones = {}) {
  const alAvisar = opciones.alAvisar || vi.fn()
  const acot = crearAcotaciones({ mapa, zona: HUSO, ...opciones, alAvisar })
  pendientes.push(() => acot.destruir())
  return { acot, alAvisar }
}

/** Soporte + capa de una tacada, para el caso normal. */
function montar(opcionesMapa = {}, opcionesCapa = {}) {
  const mapa = montarSoporte(opcionesMapa)
  return { mapa, ...acotar(mapa, opcionesCapa) }
}

/**
 * Las cotas REALMENTE pintadas, leídas del DOM del pane y ordenadas por
 * `(recinto, lado)`. Se lee el DOM y no una API del módulo a propósito: el
 * contrato solo expone `pintar`/`destruir`, así que aquí se comprueba lo que el
 * usuario ve.
 */
function cotasDe(mapa) {
  const pane = mapa.getPane(PANE.ACOTACIONES)
  return [...pane.querySelectorAll(`.${CLASE_ACOTACION}`)]
    .map((el) => ({
      el,
      recinto: Number(el.dataset.recinto),
      lado: Number(el.dataset.lado),
      texto: el.firstElementChild ? el.firstElementChild.textContent : '',
      visible: el.style.display !== 'none',
    }))
    .sort((a, b) => a.recinto - b.recinto || a.lado - b.lado)
}

const textosDe = (mapa) => cotasDe(mapa).map((c) => c.texto)
const visiblesDe = (mapa) => cotasDe(mapa).map((c) => c.visible)

/** Los marcadores de cota que hay en el mapa (por su pane, no por el orden). */
function marcadoresCota(mapa) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Marker && capa.options.pane === PANE.ACOTACIONES) out.push(capa)
  })
  return out
}

/**
 * Longitud EN PÍXELES de cada lado, calculada por el test con la MISMA
 * proyección que la producción (`latLngToLayerPoint`) sobre el mapa real. Es lo
 * que permite escribir el umbral esperado sin teclear ningún número de píxeles.
 */
function longitudesPx(mapa, anillo) {
  const n = anillo.length
  return anillo.map((_, i) => {
    const a = mapa.latLngToLayerPoint(vertUTMaLatLng(anillo[i], HUSO))
    const b = mapa.latLngToLayerPoint(vertUTMaLatLng(anillo[(i + 1) % n], HUSO))
    return Math.hypot(a.x - b.x, a.y - b.y)
  })
}

/** Copia profunda de un anillo, para moverle vértices sin tocar la constante. */
const clonarAnillo = (anillo) => anillo.map((v) => [...v])

// ── La premisa del arnés ─────────────────────────────────────────────────────

describe('viewer/acotaciones · la premisa del arnés (para no pasar por casualidad)', () => {
  it('el mapa de jsdom tiene tamaño real y una proyección que discrimina', () => {
    const mapa = montarSoporte()
    // Sin tamaño, `getBounds()` degenera y la medida en píxeles sería siempre 0:
    // toda esta suite pasaría en verde sin probar el filtro.
    expect(mapa.getSize().x).toBeGreaterThan(0)
    expect(mapa.getSize().y).toBeGreaterThan(0)
    const px = longitudesPx(mapa, RECTANGULO)
    expect(px.every((p) => p > 0)).toBe(true)
    // 20 m y 15 m no pueden medir lo mismo en pantalla.
    expect(px[0]).toBeGreaterThan(px[1])
  })

  it('el pane de acotaciones existe y se ha creado derivándolo de PANES', () => {
    const mapa = montarSoporte()
    expect(mapa.getPane(PANE.ACOTACIONES)).toBeTruthy()
    expect(Number(mapa.getPane(PANE.ACOTACIONES).style.zIndex)).toBeGreaterThan(
      Number(mapa.getPane(PANE.PARCELA_EDITADA).style.zIndex),
    )
    expect(Number(mapa.getPane(PANE.ACOTACIONES).style.zIndex)).toBeLessThan(
      Number(mapa.getPane(PANE.VERTICES).style.zIndex),
    )
  })
})

// ── Contratos del programador ────────────────────────────────────────────────

describe('viewer/acotaciones · contrato roto por el programador → throw', () => {
  it('lanza si `mapa` no es un L.Map (y comprueba también la función con la que MIDE)', () => {
    expect(() => crearAcotaciones({ mapa: null, zona: HUSO })).toThrow(TypeError)
    expect(() => crearAcotaciones({ mapa: {}, zona: HUSO })).toThrow(TypeError)
    // Un doble con addLayer/removeLayer pero sin proyección: pasaría un guardián
    // perezoso y reventaría dentro, al medir.
    const cojo = {
      addLayer() {},
      removeLayer() {},
      on() {},
      off() {},
      getPane: () => document.createElement('div'),
    }
    expect(() => crearAcotaciones({ mapa: cojo, zona: HUSO })).toThrow(/latLngToLayerPoint/)
  })

  it('lanza RangeError si la zona no es 29/30/31', () => {
    const mapa = montarSoporte()
    expect(() => crearAcotaciones({ mapa, zona: 28 })).toThrow(RangeError)
    expect(() => crearAcotaciones({ mapa, zona: undefined })).toThrow(RangeError)
  })

  it('lanza si `minimoPx` no es un número finito ≥ 0', () => {
    const mapa = montarSoporte()
    expect(() => crearAcotaciones({ mapa, zona: HUSO, minimoPx: NaN })).toThrow(TypeError)
    expect(() => crearAcotaciones({ mapa, zona: HUSO, minimoPx: -1 })).toThrow(TypeError)
    expect(() => crearAcotaciones({ mapa, zona: HUSO, minimoPx: '44' })).toThrow(TypeError)
  })

  it('lanza si falta el pane de acotaciones (nombrándolo)', () => {
    const mapa = montarSoporte({ conPanes: false })
    expect(() => crearAcotaciones({ mapa, zona: HUSO })).toThrow(/acotaciones/)
  })

  it('lanza si `alAvisar` no es una función (resolverAvisar)', () => {
    const mapa = montarSoporte()
    expect(() => crearAcotaciones({ mapa, zona: HUSO, alAvisar: 'ups' })).toThrow(TypeError)
    // null/undefined SÍ son legítimos: caen al aviso por defecto.
    expect(() => crearAcotaciones({ mapa, zona: HUSO, alAvisar: null }).destruir()).not.toThrow()
  })

  it('`pintar` lanza si los anillos o la RefVertice no tienen la forma pactada', () => {
    const { acot } = montar()
    expect(() => acot.pintar('nope')).toThrow(TypeError)
    expect(() => acot.pintar(null)).toThrow(TypeError)
    expect(() => acot.pintar([RECTANGULO], { soloRef: { recinto: 0 } })).toThrow(TypeError)
    expect(() => acot.pintar([RECTANGULO], { soloRef: { recinto: 0, indice: 1.5 } })).toThrow(
      TypeError,
    )
  })
})

// ── Qué se pinta ─────────────────────────────────────────────────────────────

describe('viewer/acotaciones · rotula la longitud de CADA lado', () => {
  it('pinta una cota por lado, incluido el de CIERRE (v[n−1] → v[0])', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])

    const cotas = cotasDe(mapa)
    expect(cotas).toHaveLength(RECTANGULO.length)
    expect(cotas.map((c) => c.lado)).toEqual([0, 1, 2, 3])
    // El lado 3 es el de cierre: mide 15 m, no 0 y no existe "de más".
    expect(cotas[3].texto).toBe(textoDeLongitud(15))
  })

  it('los textos son EXACTAMENTE los de geo/metrica.js#longitudesDeLados', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    // La longitud no se recalcula aquí con otra fórmula: se compara contra la
    // única función del proyecto que mide lados (regla de oro 6, turf prohibido).
    expect(textosDe(mapa)).toEqual(longitudesDeLados(RECTANGULO).map(textoDeLongitud))
  })

  it('el número va en español, con coma decimal y 2 decimales (centímetro)', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    expect(textosDe(mapa)[0]).toBe('20,00 m')

    // Un lado con decimales: el redondeo es de PRESENTACIÓN (regla 11 lo permite)
    // y va a centímetro, la misma precisión que el GML de salida.
    const oblicuo = clonarAnillo(RECTANGULO)
    oblicuo[1] = [439252.3456, 4479655]
    acot.pintar([oblicuo])
    expect(textosDe(mapa)[0]).toBe('12,35 m')

    // Y el agrupamiento de millares es el que manda el ICU para `es-ES`, no el
    // que uno supondría: el español NO agrupa los números de CUATRO cifras
    // (`minimumGroupingDigits: 2`), y sí los de cinco. Es exactamente por esto por
    // lo que se usa `Intl.NumberFormat` y no un `toFixed().replace('.', ',')`
    // casero, que habría escrito «1.234,50» —incorrecto en español— con toda
    // naturalidad. Se fija por escrito para que nadie lo «arregle» al revés.
    const largo = clonarAnillo(RECTANGULO)
    largo[1] = [440474.5, 4479655]
    acot.pintar([largo])
    expect(textosDe(mapa)[0]).toBe('1234,50 m')

    const larguisimo = clonarAnillo(RECTANGULO)
    larguisimo[1] = [451585.5, 4479655]
    acot.pintar([larguisimo])
    expect(textosDe(mapa)[0]).toBe('12.345,50 m')
  })

  it('la cota se coloca en el punto medio del lado (media en UTM, no turf.midpoint)', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])

    const medioUTM = [
      (RECTANGULO[0][0] + RECTANGULO[1][0]) / 2,
      (RECTANGULO[0][1] + RECTANGULO[1][1]) / 2,
    ]
    const [lat, lng] = vertUTMaLatLng(medioUTM, HUSO)
    const marcador = marcadoresCota(mapa).find(
      (m) => m.getElement() && m.getElement().dataset.lado === '0',
    )
    expect(marcador.getLatLng().lat).toBeCloseTo(lat, 9)
    expect(marcador.getLatLng().lng).toBeCloseTo(lng, 9)
  })

  it('las cotas viven en el pane de acotaciones, no en el de vértices', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    const marcadores = marcadoresCota(mapa)
    expect(marcadores).toHaveLength(4)
    for (const m of marcadores) {
      expect(m.options.pane).toBe(PANE.ACOTACIONES)
      expect(m.getElement().parentNode).toBe(mapa.getPane(PANE.ACOTACIONES))
    }
  })

  it('acota TODOS los recintos, huecos incluidos, y respeta sus índices', () => {
    const { mapa, acot } = montar()
    const hueco = [
      [439248, 4479660],
      [439252, 4479660],
      [439252, 4479664],
      [439248, 4479664],
    ]
    acot.pintar([RECTANGULO, hueco])

    const cotas = cotasDe(mapa)
    expect(cotas).toHaveLength(8)
    expect(cotas.filter((c) => c.recinto === 1).map((c) => c.texto)).toEqual(
      longitudesDeLados(hueco).map(textoDeLongitud),
    )
  })
})

// ── El filtro por píxeles ────────────────────────────────────────────────────

describe('viewer/acotaciones · el filtro es por PÍXELES de pantalla', () => {
  it('al alejar el zoom las cotas desaparecen solas; al acercar, reaparecen', () => {
    const { mapa, acot } = montar({ zoom: 19 })
    acot.pintar([RECTANGULO])

    // Premisa medida, no supuesta: a este zoom todos los lados superan el umbral.
    expect(longitudesPx(mapa, RECTANGULO).every((p) => p > OPERATIVOS.acotacionMinimaPx)).toBe(true)
    expect(visiblesDe(mapa)).toEqual([true, true, true, true])

    // NADIE vuelve a llamar a `pintar`: lo hace la suscripción a zoomend/moveend.
    mapa.setZoom(15)
    expect(longitudesPx(mapa, RECTANGULO).every((p) => p < OPERATIVOS.acotacionMinimaPx)).toBe(true)
    expect(visiblesDe(mapa)).toEqual([false, false, false, false])

    mapa.setZoom(19)
    expect(visiblesDe(mapa)).toEqual([true, true, true, true])
  })

  it('el umbral por defecto ES OPERATIVOS.acotacionMinimaPx (caso no vacuo)', () => {
    const { mapa, acot } = montar({ zoom: 19 })
    acot.pintar([TIRA])

    const esperado = longitudesPx(mapa, TIRA).map((p) => p > OPERATIVOS.acotacionMinimaPx)
    // Si todos los lados cayeran del mismo lado del umbral, esta prueba no
    // distinguiría el valor por defecto de cualquier otro: se exige que discrimine.
    expect(new Set(esperado).size).toBe(2)
    expect(visiblesDe(mapa)).toEqual(esperado)
  })

  it('un `minimoPx` propio manda sobre el defecto (umbral derivado del mapa)', () => {
    const mapa = montarSoporte({ zoom: 19 })
    const px = longitudesPx(mapa, RECTANGULO)
    // Umbral a medio camino entre el lado más corto y el más largo: deja fuera
    // exactamente los cortos, sea cual sea el zoom en el que corra la suite.
    const umbral = (Math.min(...px) + Math.max(...px)) / 2
    const { acot } = acotar(mapa, { minimoPx: umbral })
    acot.pintar([RECTANGULO])
    expect(visiblesDe(mapa)).toEqual(px.map((p) => p > umbral))
    expect(visiblesDe(mapa)).toEqual([true, false, true, false])
  })

  it('`minimoPx: 0` acota siempre y un umbral enorme no acota nunca', () => {
    const mapa = montarSoporte({ zoom: 12 })
    const { acot } = acotar(mapa, { minimoPx: 0 })
    acot.pintar([RECTANGULO])
    expect(visiblesDe(mapa).every(Boolean)).toBe(true)

    const otro = montarSoporte({ zoom: 22 })
    const { acot: acot2 } = acotar(otro, { minimoPx: 1e6 })
    acot2.pintar([RECTANGULO])
    expect(visiblesDe(otro).some(Boolean)).toBe(false)
  })

  it('se suscribe a zoomend Y a moveend, y se da de baja en destruir()', () => {
    const mapa = montarSoporte()
    // Cuenta DELTA sobre el registro de eventos de Leaflet: así da igual cuántos
    // listeners propios tenga ya el mapa. Es la única forma de demostrar que no
    // queda una fuga (un listener huérfano no se ve desde fuera).
    const cuantos = (tipo) => (mapa._events && mapa._events[tipo] ? mapa._events[tipo].length : 0)
    const antes = { zoomend: cuantos('zoomend'), moveend: cuantos('moveend') }

    const acot = crearAcotaciones({ mapa, zona: HUSO })
    expect(cuantos('zoomend')).toBe(antes.zoomend + 1)
    expect(cuantos('moveend')).toBe(antes.moveend + 1)

    acot.destruir()
    expect(cuantos('zoomend')).toBe(antes.zoomend)
    expect(cuantos('moveend')).toBe(antes.moveend)
  })

  it('`moveend` vuelve a MEDIR (y tras destruir() ya no mide nada)', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])

    const espia = vi.spyOn(mapa, 'latLngToLayerPoint')
    mapa.fire('moveend')
    expect(espia.mock.calls.length).toBeGreaterThan(0)

    acot.destruir()
    espia.mockClear()
    mapa.fire('moveend')
    mapa.fire('zoomend')
    expect(espia.mock.calls.length).toBe(0)
    espia.mockRestore()
  })
})

// ── El punto delicado: la cota no puede robar el clic ────────────────────────

describe('viewer/acotaciones · una cota JAMÁS roba el clic (F06 inserta vértices al clicar)', () => {
  it('el clic que cae sobre el rótulo lo recibe el MAPA, no la cota', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])

    const cota = marcadoresCota(mapa)[0]
    const alClicarCota = vi.fn()
    const alClicarMapa = vi.fn()
    cota.on('click', alClicarCota)
    mapa.on('click', alClicarMapa)

    cota.getElement().dispatchEvent(new MouseEvent('click', { bubbles: true }))

    // Este es EL test de la tarea: si la cota fuese interactiva, Leaflet la habría
    // registrado como `_target` y el clic moriría en ella — y en F06 el usuario se
    // quedaría sin poder insertar un vértice justo en mitad del lado.
    expect(alClicarCota).not.toHaveBeenCalled()
    expect(alClicarMapa).toHaveBeenCalledTimes(1)
  })

  it('el marcador es `interactive:false` y su rótulo no intercepta el puntero', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])

    for (const m of marcadoresCota(mapa)) {
      expect(m.options.interactive).toBe(false)
      const el = m.getElement()
      // Leaflet solo pone `.leaflet-interactive` a lo que registra como diana.
      expect(el.classList.contains('leaflet-interactive')).toBe(false)
      // Y el `pointer-events:none` va EN LÍNEA porque `viewer/*` no importa
      // leaflet.css: la cota no puede depender de que la hoja esté cargada.
      expect(el.style.pointerEvents).toBe('none')
      expect(el.firstElementChild.getAttribute('style')).toContain('pointer-events:none')
    }
  })

  it('tampoco entra en el orden de tabulación', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    for (const m of marcadoresCota(mapa)) {
      expect(m.options.keyboard).toBe(false)
      expect(m.getElement().hasAttribute('tabindex')).toBe(false)
    }
  })
})

// ── Repintado parcial (el camino del arrastre) ───────────────────────────────

describe('viewer/acotaciones · `soloRef` repinta los DOS lados del vértice, y solo esos', () => {
  it('repinta el lado que llega y el que sale, y deja el resto intacto', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    const antes = textosDe(mapa)

    // Se mueven DOS vértices (el 1 y el 3) pero solo se declara el 1. Los lados 2
    // y 3, que dependen del vértice 3, deben quedarse con su texto VIEJO: es lo
    // único que distingue un repintado parcial de uno completo.
    const movido = clonarAnillo(RECTANGULO)
    movido[1] = [439265, 4479655]
    movido[3] = [439240, 4479680]
    acot.pintar([movido], { soloRef: { recinto: 0, indice: 1 } })

    const longitudes = longitudesDeLados(movido)
    const despues = textosDe(mapa)
    expect(despues[0]).toBe(textoDeLongitud(longitudes[0]))
    expect(despues[1]).toBe(textoDeLongitud(longitudes[1]))
    expect(despues[2]).toBe(antes[2])
    expect(despues[3]).toBe(antes[3])
    // Sin esto, el test pasaría también si los lados 2 y 3 no hubieran cambiado.
    expect(textoDeLongitud(longitudes[2])).not.toBe(antes[2])
    expect(textoDeLongitud(longitudes[3])).not.toBe(antes[3])
  })

  it('el vértice 0 arrastra el lado de CIERRE (el módulo del anillo)', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    const antes = textosDe(mapa)

    const movido = clonarAnillo(RECTANGULO)
    movido[0] = [439230, 4479650]
    acot.pintar([movido], { soloRef: { recinto: 0, indice: 0 } })

    const longitudes = longitudesDeLados(movido)
    const despues = textosDe(mapa)
    expect(despues[0]).toBe(textoDeLongitud(longitudes[0])) // v0 → v1
    expect(despues[3]).toBe(textoDeLongitud(longitudes[3])) // v3 → v0 (cierre)
    expect(despues[1]).toBe(antes[1])
    expect(despues[2]).toBe(antes[2])
  })

  it('también reposiciona la cota (no solo su texto)', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    const cota0 = marcadoresCota(mapa).find((m) => m.getElement().dataset.lado === '0')
    const antes = cota0.getLatLng()

    const movido = clonarAnillo(RECTANGULO)
    movido[1] = [439265, 4479658]
    acot.pintar([movido], { soloRef: { recinto: 0, indice: 1 } })

    const medio = [(movido[0][0] + movido[1][0]) / 2, (movido[0][1] + movido[1][1]) / 2]
    const [lat, lng] = vertUTMaLatLng(medio, HUSO)
    expect(cota0.getLatLng().lat).toBeCloseTo(lat, 9)
    expect(cota0.getLatLng().lng).toBeCloseTo(lng, 9)
    expect(cota0.getLatLng().lat).not.toBeCloseTo(antes.lat, 9)
  })

  it('si la FORMA ha cambiado, `soloRef` cae a repintado completo', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])

    // Se inserta un vértice: los índices de la RefVertice ya no describen el
    // anillo pintado, así que repintar dos lados dejaría el resto mintiendo.
    const conVertice = clonarAnillo(RECTANGULO)
    conVertice.splice(1, 0, [439250, 4479650])
    acot.pintar([conVertice], { soloRef: { recinto: 0, indice: 1 } })

    expect(textosDe(mapa)).toEqual(longitudesDeLados(conVertice).map(textoDeLongitud))
  })

  it('una RefVertice que ya no existe avisa (AVISO) y no lanza', () => {
    const { mapa, acot, alAvisar } = montar()
    acot.pintar([RECTANGULO])

    expect(() => acot.pintar([RECTANGULO], { soloRef: { recinto: 0, indice: 9 } })).not.toThrow()
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][1]).toMatchObject({ nivel: NIVEL.AVISO })
    // Y lo pintado sigue siendo válido, no se ha borrado nada.
    expect(cotasDe(mapa)).toHaveLength(4)
  })
})

// ── Rendimiento: reutilización de marcadores ─────────────────────────────────

describe('viewer/acotaciones · reutiliza los marcadores en su sitio', () => {
  it('un repintado completo con la MISMA forma no recrea ni un marcador', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    const antesMarcadores = marcadoresCota(mapa)
    const antesElementos = cotasDe(mapa).map((c) => c.el)

    const movido = clonarAnillo(RECTANGULO)
    movido[2] = [439262, 4479671]
    acot.pintar([movido])

    const despuesElementos = cotasDe(mapa).map((c) => c.el)
    expect(despuesElementos).toHaveLength(antesElementos.length)
    despuesElementos.forEach((el, i) => expect(el).toBe(antesElementos[i]))
    expect(marcadoresCota(mapa).length).toBe(antesMarcadores.length)
  })

  it('un cambio de zoom no toca el DOM del rótulo, solo su visibilidad', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    const antes = cotasDe(mapa).map((c) => c.el)
    const textos = textosDe(mapa)

    mapa.setZoom(15)
    mapa.setZoom(19)

    const despues = cotasDe(mapa).map((c) => c.el)
    despues.forEach((el, i) => expect(el).toBe(antes[i]))
    expect(textosDe(mapa)).toEqual(textos)
  })

  it('al crecer o menguar la forma solo se ajusta la diferencia', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    const primeros = cotasDe(mapa).map((c) => c.el)

    const conVertice = [...clonarAnillo(RECTANGULO), [439235, 4479662]]
    acot.pintar([conVertice])
    const tras = cotasDe(mapa)
    expect(tras).toHaveLength(5)
    // Los cuatro lados que ya existían conservan su elemento del DOM.
    primeros.forEach((el, i) => expect(tras[i].el).toBe(el))

    acot.pintar([RECTANGULO])
    expect(cotasDe(mapa)).toHaveLength(4)
  })

  it('quitar un recinto quita sus cotas', () => {
    const { mapa, acot } = montar()
    const hueco = [
      [439248, 4479660],
      [439252, 4479660],
      [439252, 4479664],
      [439248, 4479664],
    ]
    acot.pintar([RECTANGULO, hueco])
    expect(cotasDe(mapa)).toHaveLength(8)

    acot.pintar([RECTANGULO])
    expect(cotasDe(mapa)).toHaveLength(4)
    expect(cotasDe(mapa).every((c) => c.recinto === 0)).toBe(true)
  })
})

// ── Dato degenerado: nunca lanza ─────────────────────────────────────────────

describe('viewer/acotaciones · dato degenerado del modelo → no lanza', () => {
  it('un anillo de menos de 3 vértices no tiene lados que acotar (y no avisa)', () => {
    const { mapa, acot, alAvisar } = montar()
    expect(() => acot.pintar([[[439240, 4479655], [439260, 4479655]]])).not.toThrow()
    expect(cotasDe(mapa)).toHaveLength(0)
    // Es el contrato documentado de `longitudesDeLados` (`[]`), no una anomalía:
    // señalar la degeneración es trabajo de F02, no de una capa de dibujo.
    expect(alAvisar).not.toHaveBeenCalled()
  })

  it('anillos vacíos, sin recintos o con basura por anillo: nada, y sin reventar', () => {
    const { mapa, acot } = montar()
    expect(() => acot.pintar([])).not.toThrow()
    expect(() => acot.pintar([[]])).not.toThrow()
    expect(() => acot.pintar([null, undefined])).not.toThrow()
    expect(cotasDe(mapa)).toHaveLength(0)
  })

  it('un vértice no finito se ignora, avisa UNA vez y no impide acotar el resto', () => {
    const { mapa, acot, alAvisar } = montar()
    const roto = [
      [439240, 4479655],
      [Number.NaN, 4479655], // deja DOS lados degenerados (el que llega y el que sale)
      [439260, 4479670],
    ]
    expect(() => acot.pintar([roto])).not.toThrow()

    // Un aviso por llamada, no uno por lado (un arrastre generaría cientos).
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][1]).toMatchObject({ nivel: NIVEL.AVISO })

    // El único lado sano (v[2] → v[0], el de cierre) SÍ se acota.
    const cotas = cotasDe(mapa)
    expect(cotas).toHaveLength(1)
    expect(cotas[0].lado).toBe(2)
    expect(cotas[0].texto).toBe(textoDeLongitud(longitudesDeLados(roto)[2]))
  })

  it('un vértice que deja de ser finito OCULTA la cota que ya estaba pintada', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    expect(visiblesDe(mapa)).toEqual([true, true, true, true])

    const roto = clonarAnillo(RECTANGULO)
    roto[1] = [Number.POSITIVE_INFINITY, 4479655]
    acot.pintar([roto])

    const cotas = cotasDe(mapa)
    // Los lados 0 y 1 tocan el vértice roto: se ocultan en vez de rotular «NaN m».
    expect(cotas.find((c) => c.lado === 0).visible).toBe(false)
    expect(cotas.find((c) => c.lado === 1).visible).toBe(false)
    expect(cotas.find((c) => c.lado === 2).visible).toBe(true)
    expect(cotas.every((c) => !c.texto.includes('NaN'))).toBe(true)
  })
})

// ── Desmontaje ───────────────────────────────────────────────────────────────

describe('viewer/acotaciones · destruir() es idempotente y deja el mapa limpio', () => {
  it('quita todas las cotas del mapa y del DOM', () => {
    const { mapa, acot } = montar()
    acot.pintar([RECTANGULO])
    expect(marcadoresCota(mapa)).toHaveLength(4)

    acot.destruir()
    expect(marcadoresCota(mapa)).toHaveLength(0)
    expect(cotasDe(mapa)).toHaveLength(0)
  })

  it('llamarlo dos veces no lanza', () => {
    const { acot } = montar()
    acot.pintar([RECTANGULO])
    acot.destruir()
    expect(() => acot.destruir()).not.toThrow()
  })

  it('`pintar` después de destruir es un no-op, no un throw', () => {
    const { mapa, acot } = montar()
    acot.destruir()
    // El desmontaje del visor va en orden inverso: una notificación en vuelo
    // puede llegar después. No debe reventar ni resucitar la capa.
    expect(() => acot.pintar([RECTANGULO])).not.toThrow()
    expect(cotasDe(mapa)).toHaveLength(0)
  })
})

// test/viewer/index.dom.test.js — F03 · Tarea 3C.
//
// CAJA NEGRA sobre `crearVisor`. Aquí NO se repite lo que ya cubren los tests de
// los nueve módulos del visor (las cinco bases conmutan → `capas.dom.test.js`;
// el arrastre incremental → `sincronizacion.dom.test.js`; los panes → `mapa.dom.
// test.js`): se prueba lo que SOLO existe cuando las piezas están ensambladas.
//
// Lo que este fichero protege:
//   · EL CONTRATO DE VIEWPORT (hallazgo C5) — los tres caminos: geometría,
//     `vistaInicial` y `throw`. Es la razón de ser de la tarea: un visor que
//     arranca mirando a un sitio arbitrario es un fallo silencioso.
//   · El caso DEGENERADO (un vértice, o vértices coincidentes): ni zoom absurdo
//     ni NaN.
//   · El ensamblaje visto desde fuera (criterio de aceptación 3) y la atribución
//     en el DOM (criterio de aceptación 5).
//   · La traducción `srs → zona` y la comprobación del tope de zoom.
//   · Que `alAvisar` llega a las DOS mitades (capas y sincronización).
//   · `destruir()`: idempotente y sin dejar nada vivo detrás.
//
// Proyecto Vitest `dom` (jsdom): el sufijo `.dom.test.js` lo enruta ahí, porque
// `viewer/index.js` arrastra Leaflet. NINGUNA petición real de red: jsdom no
// descarga imágenes, y `load`/`error` se emiten a mano con `dispararCarga`.

import { describe, it, expect, vi, afterEach } from 'vitest'
import L from 'leaflet'

import { crearVisor } from '../../viewer/index.js'
import { NIVEL, PANE, crearEstadoVista, vertUTMaLatLng } from '../../viewer/_comun.js'
import { BASE_POR_DEFECTO, ID_CAPA, maxZoomNativo, CAPAS } from '../../viewer/capas.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { MENSAJES } from '../../viewer/wms-catastro.js'
import { crearHistorial } from '../../edit/historial.js'
import {
  crearContenedor,
  dispararCarga,
  espiarPeticiones,
  parcelaConHueco,
} from './_ayuda-jsdom.js'

// ── Utilidades del test ──────────────────────────────────────────────────────

/** Huso/SRS de `parcelaConHueco()` (Península, EPSG:25830). */
const SRS_DEMO = 'EPSG:25830'
const HUSO_DEMO = 30

/** Tope nativo de las capas del visor (20, DERIVADO — no escrito a mano aquí). */
const MAX_NATIVO = maxZoomNativo(CAPAS)

/** Vista explícita de ejemplo para la rama 2 de la cascada (Madrid, Puerta del Sol). */
const VISTA_MADRID = Object.freeze({ centro: [40.4169, -3.7036], zoom: 15 })

/** Limpieza garantizada aunque un `expect` falle a mitad de test. */
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

/**
 * Contenedor + tabla listos y registrados para limpieza. Se separa de
 * `abrirVisor` porque los tests de `throw` necesitan el contenedor SIN visor,
 * para poder afirmar que no ha quedado nada montado dentro.
 */
function prepararDOM({ ancho, alto } = {}) {
  const contenedor = crearContenedor({ ancho, alto })
  const tablaEl = document.createElement('table')
  document.body.appendChild(tablaEl)
  pendientes.push(() => {
    contenedor.remove()
    tablaEl.remove()
  })
  return { contenedor, tablaEl }
}

/**
 * Abre un visor completo sobre `parcelaConHueco()` y registra su destrucción.
 *
 * Las cuatro animaciones van desactivadas por el REST de opciones (que
 * `crearVisor` reenvía a `L.map` vía `crearMapa`): son transiciones CSS que
 * jsdom nunca resuelve — la razón está en la cabecera de `_ayuda-jsdom.js`.
 */
function abrirVisor({ parcela = parcelaConHueco(), estado, srs = SRS_DEMO, ...resto } = {}) {
  const { contenedor, tablaEl } = prepararDOM()
  const store = estado || crearEstadoVista(parcela)
  const visor = crearVisor(contenedor, {
    estado: store,
    tablaEl,
    srs,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    inertia: false,
    ...resto,
  })
  pendientes.push(() => visor.destruir())
  return { contenedor, tablaEl, store, visor, parcela }
}

/** Todos los vértices UTM de todos los recintos de una parcela, aplanados. */
const verticesDe = (parcela) => parcela.recintos.flatMap((recinto) => recinto.vertices)

function marcadoresDe(mapa) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Marker) out.push(capa)
  })
  return out
}

function marcadorDe(mapa, recinto, indice) {
  return (
    marcadoresDe(mapa).find(
      (m) => m.refVertice && m.refVertice.recinto === recinto && m.refVertice.indice === indice,
    ) || null
  )
}

const filasDe = (tablaEl) => [...tablaEl.querySelectorAll('tr[data-indice]')]

function inputXDe(tablaEl, recinto, indice) {
  return tablaEl.querySelector(
    `tr[data-recinto="${recinto}"][data-indice="${indice}"] input[data-eje="x"]`,
  )
}

/** Teclea un valor y termina la edición: `change`, NO `input` (hallazgo C7). */
function cambiarCelda(input, texto) {
  input.value = texto
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * `espiarPeticiones` del arnés (`_ayuda-jsdom.js`) + registro automático de su
 * `restaurar()` en la pila de limpieza de esta suite. El envoltorio de
 * `globalThis.Image` es compartido con `wms-catastro.dom.test.js` y
 * `capas.dom.test.js`; lo único propio de aquí es CUÁNDO se deshace.
 *
 * @returns {ReturnType<typeof espiarPeticiones>}
 */
function espiarPeticionesDeEsteTest() {
  const espia = espiarPeticiones()
  pendientes.push(() => espia.restaurar())
  return espia
}

/**
 * Parcela POJO con geometría DEGENERADA. A mano y no con `model/parcela.js`
 * porque el modelo no produciría esto (un recinto exige un anillo de verdad):
 * llega de un GML corrupto cargado por F01 o de un boceto a medias de F06, y el
 * visor no puede reventar ni encuadrar a un zoom absurdo por ello.
 */
function parcelaDegenerada(vertices) {
  return { idLocal: 'degenerada', recintos: [{ vertices }] }
}

// ── EL CONTRATO DE VIEWPORT (hallazgo C5) ────────────────────────────────────

describe('crearVisor · contrato de viewport: nunca un encuadre mudo (hallazgo C5)', () => {
  it('CON GEOMETRÍA encuadra sobre ella: los bounds contienen TODOS los vértices de TODOS los recintos', () => {
    const { visor, parcela } = abrirVisor()
    const bounds = visor.mapa.getBounds()

    // Los ocho vértices (exterior + hueco), no solo los del recinto 0.
    const vertices = verticesDe(parcela)
    expect(vertices.length).toBe(8)
    for (const vertice of vertices) {
      const latlng = L.latLng(vertUTMaLatLng(vertice, HUSO_DEMO))
      expect(bounds.contains(latlng), `vértice [${vertice}] fuera del encuadre`).toBe(true)
    }

    // Y encuadra AJUSTADO, no "España entera": el ancho del encuadre es del
    // orden del de la parcela (~20 m), no de kilómetros.
    const anchoEncuadreM = visor.mapa.distance(bounds.getNorthWest(), bounds.getNorthEast())
    expect(anchoEncuadreM).toBeLessThan(200)
  })

  it('SIN geometría pero CON vistaInicial, aplica ESE centro y ESE zoom', () => {
    const { visor, tablaEl } = abrirVisor({
      estado: crearEstadoVista(null),
      vistaInicial: VISTA_MADRID,
    })

    expect(visor.mapa.getCenter().lat).toBeCloseTo(VISTA_MADRID.centro[0], 9)
    expect(visor.mapa.getCenter().lng).toBeCloseTo(VISTA_MADRID.centro[1], 9)
    expect(visor.mapa.getZoom()).toBe(VISTA_MADRID.zoom)
    // La tabla existe y dice que no hay vértices (no se inventa geometría).
    expect(filasDe(tablaEl)).toHaveLength(0)
    expect(tablaEl.textContent).toContain('Sin vértices')
  })

  it('SIN geometría y SIN vistaInicial LANZA, y el mensaje nombra LAS DOS salidas', () => {
    const { contenedor, tablaEl } = prepararDOM()

    let error = null
    try {
      crearVisor(contenedor, { estado: crearEstadoVista(null), tablaEl, srs: SRS_DEMO })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(TypeError)
    // Las dos salidas, nombradas: si alguien "simplifica" el mensaje, este test
    // salta antes de que nadie descubra el visor mudo en producción.
    expect(error.message).toMatch(/vistaInicial/)
    expect(error.message).toMatch(/geometr/i)
  })

  it('el throw del encuadre NO deja un visor a medio montar (ensamblaje atómico)', () => {
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, { estado: crearEstadoVista(null), tablaEl, srs: SRS_DEMO }),
    ).toThrow()

    // El mapa se monta ANTES de encuadrar, así que sin el desmontaje quedaría un
    // L.Map vivo en el DOM (con sus controles, sus listeners de window y sus
    // imágenes en vuelo) y nadie con una referencia para destruirlo.
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-layers')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-attribution')).toBeNull()
    // Y la tabla, que `sincronizar` ya había construido, queda vacía.
    expect(tablaEl.children).toHaveLength(0)
  })

  it('con geometría Y vistaInicial, MANDA la geometría (precedencia documentada)', () => {
    const { visor, parcela } = abrirVisor({ vistaInicial: VISTA_MADRID })
    const bounds = visor.mapa.getBounds()

    expect(bounds.contains(L.latLng(vertUTMaLatLng(parcela.recintos[0].vertices[0], HUSO_DEMO)))).toBe(
      true,
    )
    expect(bounds.contains(L.latLng(VISTA_MADRID.centro))).toBe(false)
  })

  it('una vistaInicial malformada es contrato roto del programador → TypeError', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    for (const vistaInicial of [
      {},
      { centro: [40.4], zoom: 15 },
      { centro: [40.4, -3.7], zoom: 'quince' },
      { centro: [40.4, -3.7] },
      null,
    ]) {
      expect(() => crearVisor(contenedor, { ...base, vistaInicial })).toThrow(TypeError)
    }
    // Se valida ANTES de montar nada, aunque la geometría fuera a ganar igual.
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
  })
})

// ── Caso degenerado: ni zoom absurdo ni NaN ──────────────────────────────────

describe('crearVisor · geometría degenerada (bounds sin extensión)', () => {
  it('una parcela de UN SOLO vértice no produce zoom absurdo ni NaN', () => {
    const punto = [439250, 4479662.5]
    const { visor } = abrirVisor({ parcela: parcelaDegenerada([punto]) })

    const zoom = visor.mapa.getZoom()
    const centro = visor.mapa.getCenter()

    expect(Number.isFinite(zoom)).toBe(true)
    // Sin tratar el caso, `fitBounds` sobre bounds de extensión cero da una
    // escala infinita y el zoom se pega al maxZoom del mapa (24).
    expect(zoom).toBeLessThan(visor.mapa.getMaxZoom())
    expect(zoom).toBeGreaterThanOrEqual(15)
    expect(zoom).toBeLessThanOrEqual(MAX_NATIVO)

    const [lat, lon] = vertUTMaLatLng(punto, HUSO_DEMO)
    expect(Number.isFinite(centro.lat)).toBe(true)
    expect(Number.isFinite(centro.lng)).toBe(true)
    expect(centro.lat).toBeCloseTo(lat, 9)
    expect(centro.lng).toBeCloseTo(lon, 9)
  })

  it('vértices TODOS COINCIDENTES se tratan igual que un punto', () => {
    const punto = [439250, 4479662.5]
    const { visor } = abrirVisor({ parcela: parcelaDegenerada([punto, punto, punto]) })

    expect(Number.isFinite(visor.mapa.getZoom())).toBe(true)
    expect(visor.mapa.getZoom()).toBeLessThan(visor.mapa.getMaxZoom())
    expect(visor.mapa.getCenter().lat).toBeCloseTo(vertUTMaLatLng(punto, HUSO_DEMO)[0], 9)
  })

  it('geometría degenerada en UN SOLO eje (vértices alineados) sí la encuadra fitBounds', () => {
    // No es un caso "de punto": el eje con extensión manda en la escala, y el
    // encuadre resultante debe contener los tres vértices.
    const alineados = [
      [439240, 4479660],
      [439250, 4479660],
      [439260, 4479660],
    ]
    const { visor } = abrirVisor({ parcela: parcelaDegenerada(alineados) })

    const bounds = visor.mapa.getBounds()
    for (const vertice of alineados) {
      expect(bounds.contains(L.latLng(vertUTMaLatLng(vertice, HUSO_DEMO)))).toBe(true)
    }
    expect(Number.isFinite(visor.mapa.getZoom())).toBe(true)
  })
})

// ── Ensamblaje visto desde fuera (criterio de aceptación 3) ──────────────────

// OJO con el rótulo: aquí NO se prueba el criterio de aceptación 3 («arrastrar un
// marcador actualiza la fila y viceversa, sin bucle») — eso lo prueba
// `sincronizacion.dom.test.js`, y este fichero no lo repite (ver la cabecera).
// Lo que se prueba aquí es que el ENSAMBLAJE deja al visor en un estado del que
// el criterio 3 pueda partir: una base, los panes, y una fila y un marcador por
// vértice.
describe('crearVisor · ensamblaje del visor completo, desde fuera', () => {
  it('ensamblaje completo: base activa, los tres panes, y tabla y marcadores para cada vértice', () => {
    const { visor, tablaEl, parcela } = abrirVisor()

    // Base activa (la del defecto: Ortofoto PNOA) y una sola.
    expect(visor.capas.baseActiva()).toBe(BASE_POR_DEFECTO)
    expect(visor.mapa.hasLayer(visor.capas.bases.get(BASE_POR_DEFECTO))).toBe(true)
    const basesEnMapa = [...visor.capas.bases].filter(([, capa]) => visor.mapa.hasLayer(capa))
    expect(basesEnMapa).toHaveLength(1)

    // Los tres panes del visor (derivados de PANE, no escritos a mano).
    for (const nombre of Object.values(PANE)) {
      expect(visor.mapa.getPane(nombre), `falta el pane «${nombre}»`).toBeTruthy()
    }

    // Una fila por vértice de CADA recinto, y un marcador por vértice.
    const vertices = verticesDe(parcela)
    expect(filasDe(tablaEl)).toHaveLength(vertices.length)
    expect(marcadoresDe(visor.mapa)).toHaveLength(vertices.length)
    expect(tablaEl.querySelectorAll('tbody[data-recinto]')).toHaveLength(parcela.recintos.length)
  })

  it('devuelve EL MISMO store que se le pasó (no crea otro ni lo copia)', () => {
    const store = crearEstadoVista(parcelaConHueco())
    const { visor } = abrirVisor({ estado: store })
    expect(visor.estado).toBe(store)
  })

  it('`capas` es la API de montarCapas: conmutar base y regular la superpuesta', () => {
    const { visor } = abrirVisor()

    visor.capas.activarBase(ID_CAPA.BLANCO)
    expect(visor.capas.baseActiva()).toBe(ID_CAPA.BLANCO)

    expect(visor.capas.superpuestaActiva()).toBe(false)
    visor.capas.activarSuperpuesta(true)
    expect(visor.capas.superpuestaActiva()).toBe(true)
    expect(visor.capas.fijarOpacidad(0.25)).toBe(0.25)
  })

  it('CRITERIO 5: la atribución de la base activa aparece EN EL DOM del contenedor', () => {
    const { contenedor, visor } = abrirVisor()

    const control = contenedor.querySelector('.leaflet-control-attribution')
    expect(control).not.toBeNull()
    // Texto EXACTO de `viewer/atribucion.js` (obligación legal: una paráfrasis
    // sería un incumplimiento de licencia, así que no vale un `toContain('IGN')`).
    expect(control.textContent).toContain(ATRIBUCION.PNOA)

    // Y sigue el juego de Leaflet al conmutar: la del Catastro entra, la del
    // PNOA sale. `crearVisor` no hace NADA activo aquí — es el control nativo.
    visor.capas.activarBase(ID_CAPA.CATASTRO)
    expect(control.textContent).toContain(ATRIBUCION.CATASTRO)
    expect(control.textContent).not.toContain(ATRIBUCION.PNOA)
  })
})

// ── srs → zona ───────────────────────────────────────────────────────────────

describe('crearVisor · traducción srs → zona (geo/huso.js#husoPorSrs)', () => {
  it("con 'EPSG:25830' los vértices caen donde deben (huso 30)", () => {
    const { visor, parcela } = abrirVisor({ srs: 'EPSG:25830' })

    for (let i = 0; i < parcela.recintos[0].vertices.length; i++) {
      const [lat, lon] = vertUTMaLatLng(parcela.recintos[0].vertices[i], 30)
      const marcador = marcadorDe(visor.mapa, 0, i)
      expect(marcador).not.toBeNull()
      expect(marcador.getLatLng().lat).toBeCloseTo(lat, 9)
      expect(marcador.getLatLng().lng).toBeCloseTo(lon, 9)
    }
  })

  it("con 'EPSG:25829' la MISMA geometría cae en otro huso (la zona se usa de verdad)", () => {
    // Si `crearVisor` ignorase el srs y asumiera un huso fijo, este test y el
    // anterior no podrían pasar los dos: las mismas coordenadas UTM en el huso
    // 29 caen ~6° al oeste.
    const parcela = parcelaConHueco()
    const { visor } = abrirVisor({ parcela, srs: 'EPSG:25829' })

    const [lat29, lon29] = vertUTMaLatLng(parcela.recintos[0].vertices[0], 29)
    const marcador = marcadorDe(visor.mapa, 0, 0)
    expect(marcador.getLatLng().lat).toBeCloseTo(lat29, 9)
    expect(marcador.getLatLng().lng).toBeCloseTo(lon29, 9)

    const [, lon30] = vertUTMaLatLng(parcela.recintos[0].vertices[0], 30)
    expect(Math.abs(lon29 - lon30)).toBeGreaterThan(5)
  })

  it('un SRS no soportado lanza RangeError ANTES de montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl }

    // Canarias (EPSG:32628) está DIFERIDA (override O13) y 4326 no es un huso.
    expect(() => crearVisor(contenedor, { ...base, srs: 'EPSG:32628' })).toThrow(RangeError)
    expect(() => crearVisor(contenedor, { ...base, srs: 'EPSG:4326' })).toThrow(RangeError)
    // La forma URI/URN del srsName del GML es de F04, no de aquí.
    expect(() =>
      crearVisor(contenedor, { ...base, srs: 'http://www.opengis.net/def/crs/EPSG/0/25830' }),
    ).toThrow(RangeError)
    // Y sin srs, TypeError (es un string, no un objeto).
    expect(() => crearVisor(contenedor, base)).toThrow(TypeError)

    expect(contenedor.children).toHaveLength(0)
  })
})

// ── Tope de zoom vs. maxNativeZoom de lo montado ─────────────────────────────

describe('crearVisor · el maxZoom del mapa debe superar el zoom nativo de las capas', () => {
  it('un maxZoom insuficiente LANZA RangeError, con el valor que haría falta en el mensaje', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    let error = null
    try {
      crearVisor(contenedor, { ...base, maxZoom: MAX_NATIVO })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(RangeError)
    expect(error.message).toContain('maxZoom')
    expect(error.message).toContain(String(MAX_NATIVO))
    // Nada montado tras el fallo (mismo ensamblaje atómico que el encuadre mudo).
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()

    // Igual de insuficiente por debajo.
    expect(() => crearVisor(contenedor, { ...base, maxZoom: MAX_NATIVO - 5 })).toThrow(RangeError)
  })

  it('el maxZoom por DEFECTO (24, de crearMapa) no lanza y supera el tope nativo', () => {
    const { visor } = abrirVisor()
    expect(visor.mapa.getMaxZoom()).toBeGreaterThan(MAX_NATIVO)
    expect(visor.capas.maxNativeZoom).toBe(MAX_NATIVO)
  })

  it('un maxZoom por encima del tope nativo (21) sí se acepta', () => {
    const { visor } = abrirVisor({ maxZoom: MAX_NATIVO + 1 })
    expect(visor.mapa.getMaxZoom()).toBe(MAX_NATIVO + 1)
  })
})

// ── Propagación de alAvisar (regla de oro 1) ─────────────────────────────────

describe('crearVisor · propaga alAvisar a las DOS mitades (regla de oro 1)', () => {
  it('un fallo de carga de la cartografía WMS llega al alAvisar del VISOR', () => {
    // Mitad «capas»: sin la propagación, el fallo se quedaría en el console.warn
    // por defecto y la UI de avisos no se enteraría nunca.
    const espia = espiarPeticionesDeEsteTest()
    const alAvisar = vi.fn()
    abrirVisor({ alAvisar, baseInicial: ID_CAPA.CATASTRO })

    // Una imagen por encuadre, y del encuadre DEFINITIVO: el encuadre es el
    // último paso del ensamblaje, así que la capa no llega a pedir un encuadre
    // intermedio (criterio de aceptación 2).
    expect(espia.total).toBe(1)
    dispararCarga(espia.imagenes[0], { error: true })

    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toBe(MENSAJES.SIN_CARTOGRAFIA)
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('una celda de coordenada ilegible llega al alAvisar del VISOR', () => {
    // Mitad «sincronización».
    const alAvisar = vi.fn()
    const { tablaEl, store } = abrirVisor({ alAvisar })
    const antes = structuredClone(store.get())

    cambiarCelda(inputXDe(tablaEl, 0, 0), 'no soy un número')

    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    // Y el modelo, intacto (dato malo del usuario: aviso, no throw ni NaN).
    expect(store.get()).toEqual(antes)
  })

  it('sin alAvisar el visor arranca igual (suelo mínimo: console.warn)', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    pendientes.push(() => aviso.mockRestore())

    const { tablaEl } = abrirVisor()
    cambiarCelda(inputXDe(tablaEl, 0, 0), 'basura')

    expect(aviso).toHaveBeenCalled()
    expect(String(aviso.mock.calls[0][0])).toContain('[visor]')
  })

  it('un alAvisar que no es función es contrato roto → TypeError, sin montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        alAvisar: 'no soy una función',
      }),
    ).toThrow(TypeError)
    expect(contenedor.children).toHaveLength(0)
  })
})

// ── Historial (F06 enchufará undo/redo encima) ───────────────────────────────

describe('crearVisor · propagación del historial', () => {
  it('si viene historial, una edición VÁLIDA commitea una instantánea', () => {
    const historial = crearHistorial()
    const { tablaEl, store } = abrirVisor({ historial })

    cambiarCelda(inputXDe(tablaEl, 0, 1), '439261,25')

    expect(historial.pila).toHaveLength(1)
    expect(historial.pila[0].recintos[0].vertices[1][0]).toBeCloseTo(439261.25, 6)
    expect(store.get().recintos[0].vertices[1][0]).toBeCloseTo(439261.25, 6)
  })

  it('si NO viene historial, la misma edición se aplica y no lanza', () => {
    const { tablaEl, store } = abrirVisor()
    expect(() => cambiarCelda(inputXDe(tablaEl, 0, 1), '439261,25')).not.toThrow()
    expect(store.get().recintos[0].vertices[1][0]).toBeCloseTo(439261.25, 6)
  })
})

// ── destruir() ───────────────────────────────────────────────────────────────

describe('crearVisor · destruir', () => {
  it('deja el contenedor sin mapa y la tabla vacía', () => {
    const { contenedor, tablaEl, visor } = abrirVisor({ superpuestaInicial: true })

    expect(contenedor.querySelector('.leaflet-map-pane')).not.toBeNull()
    expect(filasDe(tablaEl).length).toBeGreaterThan(0)

    visor.destruir()

    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-layers')).toBeNull()
    expect(contenedor.querySelector('.gml-control-opacidad')).toBeNull()
    expect(tablaEl.children).toHaveLength(0)
    // El mapa queda desmontado (mismo contrato de Leaflet que usa mapa.dom.test.js).
    expect(() => visor.mapa.getCenter()).toThrow()
  })

  it('es IDEMPOTENTE: llamarlo dos (y tres) veces no lanza', () => {
    const { visor } = abrirVisor()
    visor.destruir()
    expect(() => visor.destruir()).not.toThrow()
    expect(() => visor.destruir()).not.toThrow()
  })

  it('un estado.set POSTERIOR no lanza ni repinta (la sincronización se dio de baja)', () => {
    const { tablaEl, store, visor } = abrirVisor()
    visor.destruir()

    const otra = parcelaConHueco()
    otra.recintos[0].vertices[0] = [439200, 4479600]
    expect(() => store.set(otra)).not.toThrow()

    // Ni una fila repintada: la tabla sigue vacía y el store guarda el valor.
    expect(tablaEl.children).toHaveLength(0)
    expect(store.get()).toBe(otra)
  })
})

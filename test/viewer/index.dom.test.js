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
// Y desde F06 · T4.1, la OPCIÓN `edicion` — que es ensamblaje puro y por tanto
// vive aquí y no en `edicion.dom.test.js` ni en `acotaciones.dom.test.js`:
//   · `edicion:false` (el defecto) ⇒ el visor de F03 EXACTO, con los TRES
//     ganchos de `sincronizar` en `null` y `visor.edicion`/`visor.acotaciones` a
//     `null` (no `undefined`).
//   · `edicion:true|{…}` ⇒ las dos piezas montadas y ENCHUFADAS: los ganchos que
//     recibe `sincronizar` son los de la edición, y su `alPrevisualizar` repinta
//     las cotas.
//   · el DOBLE CANAL de `alPrevisualizar` (cotas + llamante) y su orden.
//   · el desmontaje en orden INVERSO, con el `doubleClickZoom` restaurado
//     mientras el mapa sigue en pie.
//   · la ATOMICIDAD cuando la edición falla a mitad del ensamblaje.
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
import { CLASE_ACOTACION, textoDeLongitud } from '../../viewer/acotaciones.js'
import { MENSAJES } from '../../viewer/wms-catastro.js'
import { sincronizar } from '../../viewer/sincronizacion.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { crearHistorial } from '../../edit/historial.js'
import {
  crearContenedor,
  dispararCarga,
  espiarPeticiones,
  parcelaConHueco,
} from './_ayuda-jsdom.js'

// `sincronizar` se envuelve en un espía que llama al ORIGINAL: el comportamiento
// del visor es idéntico —y por eso las 28 pruebas de F03 de este fichero siguen
// verdes sin tocar ni una línea— y a cambio se puede LEER con qué ganchos se ha
// construido. Es la única forma de demostrar «los tres en `null`»: un gancho que
// no se enchufa no deja ninguna huella observable, que es justo lo que hay que
// probar. Mismo patrón —y por el mismo motivo— que el espía sobre `dianasDe` de
// `test/viewer/edicion.dom.test.js`.
vi.mock('../../viewer/sincronizacion.js', async (importarOriginal) => {
  const real = await importarOriginal()
  return { ...real, sincronizar: vi.fn(real.sincronizar) }
})

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
 * Los argumentos con los que se construyó la ÚLTIMA sincronización. Se lee la
 * última llamada (y no se limpia el espía entre tests) porque cada test abre su
 * propio visor: la última llamada es siempre la suya.
 *
 * @returns {object}
 */
function argumentosDeSincronizar() {
  const llamadas = vi.mocked(sincronizar).mock.calls
  expect(llamadas.length, 'nadie ha llamado a sincronizar').toBeGreaterThan(0)
  return llamadas[llamadas.length - 1][0]
}

/** Los rótulos de acotación que hay pintados DENTRO del contenedor del mapa. */
const cotasDe = (contenedor) => [...contenedor.querySelectorAll(`.${CLASE_ACOTACION}`)]

/** El texto de cada cota, en un Set (el orden de los lados no importa aquí). */
const textosDeCotas = (contenedor) => new Set(cotasDe(contenedor).map((el) => el.textContent))

/**
 * Anillos UTM de una parcela, en la forma en la que viajan por `alPrevisualizar`
 * (un array por recinto). Se DERIVA de la parcela, nunca se copia a mano.
 */
const anillosDe = (parcela) => parcela.recintos.map((recinto) => recinto.vertices)

/**
 * Sustituye `obj.destruir` por una versión que apunta su nombre en `orden` (y
 * ejecuta `antes` justo antes de desmontar de verdad).
 *
 * Funciona porque la pila `deshacer` de `crearVisor` guarda `() => pieza.destruir()`
 * —la propiedad se resuelve EN LA LLAMADA—, y `visor.edicion`/`visor.acotaciones`/
 * `visor.capas` son exactamente esos mismos objetos.
 */
function anotarDestruccion(obj, nombre, orden, antes) {
  const real = obj.destruir.bind(obj)
  obj.destruir = () => {
    orden.push(nombre)
    if (antes) antes()
    real()
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// F06 · T4.1 — la opción `edicion`
// ═══════════════════════════════════════════════════════════════════════════

// ── El DEFECTO: el visor de F03, exacto ──────────────────────────────────────

describe('crearVisor · edicion:false (el DEFECTO) es el visor de F03 EXACTO', () => {
  it('no monta nada: visor.edicion y visor.acotaciones valen null, NO undefined', () => {
    const { visor, contenedor } = abrirVisor()

    expect(visor.edicion).toBeNull()
    expect(visor.acotaciones).toBeNull()
    // La diferencia entre «no montado» y «me he olvidado de devolverlo»: las
    // propiedades EXISTEN y valen null. Sin esto, `null` y `undefined` serían
    // indistinguibles para el llamante.
    expect('edicion' in visor).toBe(true)
    expect('acotaciones' in visor).toBe(true)

    // Ni una cota pintada, y el zoom por doble clic INTACTO (lo apaga
    // `crearEdicion`, y un visor de solo lectura no puede perderlo).
    expect(cotasDe(contenedor)).toHaveLength(0)
    expect(visor.mapa.doubleClickZoom.enabled()).toBe(true)
  })

  it('sincronizar recibe los TRES ganchos de F06 en null', () => {
    abrirVisor()
    const args = argumentosDeSincronizar()

    expect(args.ajustar).toBeNull()
    expect(args.alPrevisualizar).toBeNull()
    expect(args.alCrearMarcador).toBeNull()
  })

  it('`edicion: false` explícito se comporta igual que no pasarlo', () => {
    const { visor } = abrirVisor({ edicion: false })
    expect(visor.edicion).toBeNull()
    expect(visor.acotaciones).toBeNull()
    expect(argumentosDeSincronizar().alPrevisualizar).toBeNull()
  })
})

// ── `edicion: true` — las dos piezas montadas y ENCHUFADAS ───────────────────

describe('crearVisor · edicion:true monta las dos piezas y las enchufa', () => {
  it('devuelve las dos piezas, con su API completa', () => {
    const { visor } = abrirVisor({ edicion: true })

    expect(visor.edicion).not.toBeNull()
    expect(visor.acotaciones).not.toBeNull()
    for (const metodo of [
      'ajustar',
      'alCrearMarcador',
      'snapActivo',
      'tolerancia',
      'seleccionarLado',
      'ladoSeleccionado',
      'desplazarSeleccion',
      'insertarEn',
      'eliminar',
      'fijarColindantes',
      'alCambiarSeleccion',
      'destruir',
    ]) {
      expect(typeof visor.edicion[metodo], `falta edicion.${metodo}`).toBe('function')
    }
    expect(typeof visor.acotaciones.pintar).toBe('function')
  })

  it('sincronizar recibe `ajustar` y `alCrearMarcador` DE LA EDICIÓN (las mismas funciones)', () => {
    const { visor } = abrirVisor({ edicion: true })
    const args = argumentosDeSincronizar()

    // Identidad, no "una función cualquiera": si el visor fabricara un envoltorio
    // propio, el snap y el menú de vértice podrían no ser los de esta edición.
    expect(args.ajustar).toBe(visor.edicion.ajustar)
    expect(args.alCrearMarcador).toBe(visor.edicion.alCrearMarcador)
    expect(typeof args.alPrevisualizar).toBe('function')
  })

  it('el alPrevisualizar que recibe sincronizar REPINTA LAS COTAS, con el soloRef del gesto', () => {
    const { visor } = abrirVisor({ edicion: true })
    const pintar = vi.spyOn(visor.acotaciones, 'pintar')

    const anillos = [
      [
        [439240, 4479655],
        [439260, 4479655],
        [439260, 4479670],
      ],
    ]
    const ref = { recinto: 0, indice: 1 }
    argumentosDeSincronizar().alPrevisualizar(anillos, ref)

    // `soloRef` es lo que hace que un arrastre repinte DOS lados y no 500.
    expect(pintar).toHaveBeenCalledTimes(1)
    expect(pintar).toHaveBeenCalledWith(anillos, { soloRef: ref })
  })

  it('las cotas están pintadas de ARRANQUE, con la longitud real de cada lado', () => {
    const { contenedor, parcela } = abrirVisor({ edicion: true })

    // 4 lados del exterior + 4 del hueco (el último de cada anillo es el cierre).
    const lados = parcela.recintos.reduce((n, r) => n + r.vertices.length, 0)
    expect(cotasDe(contenedor)).toHaveLength(lados)

    // El exterior mide 20 × 15 m y el hueco 4 × 4: los textos se DERIVAN de la
    // misma función que los escribe, nunca se copia el formato español a mano.
    const textos = textosDeCotas(contenedor)
    for (const metros of [20, 15, 4]) {
      expect(textos.has(textoDeLongitud(metros)), `falta la cota de ${metros} m`).toBe(true)
    }
    // Y se ven: a este encuadre (parcela de 20 m en 800 px) ningún lado baja del
    // umbral por defecto.
    for (const cota of cotasDe(contenedor)) expect(cota.style.display).not.toBe('none')
  })

  it('el arranque con edición NO deja ni un aviso espurio', () => {
    // Regresión de la coda del ensamblaje: el primer render de `sincronizar`
    // ocurre con el mapa AÚN SIN VISTA, y las cotas miden en píxeles
    // (`latLngToLayerPoint` LANZA sin vista). Si el puente no naciera mudo, cada
    // arranque con edición dejaría el aviso «las medidas en vivo han fallado»,
    // que es ruido indistinguible de un fallo de verdad.
    const alAvisar = vi.fn()
    const { contenedor } = abrirVisor({ edicion: true, alAvisar })

    expect(alAvisar).not.toHaveBeenCalled()
    // Y no es que no haya pintado nada: las cotas están.
    expect(cotasDe(contenedor).length).toBeGreaterThan(0)
  })

  it('arranca SIN geometría (vistaInicial) y las cotas aparecen cuando llega la parcela', () => {
    // El camino real de F05 → F06: el visor se abre vacío sobre una vista
    // explícita y la parcela entra después por el store. El puente tiene que
    // seguir vivo, sin que nadie lo vuelva a enchufar.
    const store = crearEstadoVista(null)
    const { contenedor } = abrirVisor({
      estado: store,
      vistaInicial: VISTA_MADRID,
      edicion: true,
    })
    expect(cotasDe(contenedor)).toHaveLength(0)

    store.set(parcelaConHueco())

    expect(cotasDe(contenedor).length).toBeGreaterThan(0)
    expect(textosDeCotas(contenedor).has(textoDeLongitud(20))).toBe(true)
  })

  it('CON EDICIÓN, el ENCUADRE sigue siendo el último paso: UNA sola petición al WMS', () => {
    // Criterio de aceptación 2 de F03. Montar dos piezas más entre las capas y el
    // encuadre no puede colar una petición del encuadre intermedio, y el
    // repintado posterior de las cotas no mueve el mapa, así que tampoco añade
    // una segunda.
    const espia = espiarPeticionesDeEsteTest()
    abrirVisor({ edicion: true, baseInicial: ID_CAPA.CATASTRO })

    expect(espia.total).toBe(1)
  })
})

// ── Las opciones llegan a quien deben ────────────────────────────────────────

describe('crearVisor · las opciones de `edicion` llegan a su destinatario', () => {
  it('sin opciones, cada pieza usa SU defecto de config/operativos.json', () => {
    const { visor } = abrirVisor({ edicion: true })
    expect(visor.edicion.tolerancia()).toBe(OPERATIVOS.snapMetros)
    expect(visor.edicion.snapActivo()).toBe(true)
  })

  it('`tolerancia` y `snapActivo` llegan a crearEdicion', () => {
    const { visor } = abrirVisor({ edicion: { tolerancia: 1.25, snapActivo: false } })
    expect(visor.edicion.tolerancia()).toBe(1.25)
    expect(visor.edicion.snapActivo()).toBe(false)
  })

  it('`minimoPx` llega a crearAcotaciones (se mide en QUÉ cotas se ven)', () => {
    // El umbral no se puede leer de la API de acotaciones, así que se mide por su
    // efecto, que es lo que importa: con 0 se rotula todo, con un umbral enorme
    // no se rotula nada. Los rótulos siguen existiendo en los dos casos (se
    // ocultan con `display`, no se destruyen).
    const todas = abrirVisor({ edicion: { minimoPx: 0 } })
    expect(cotasDe(todas.contenedor).length).toBeGreaterThan(0)
    for (const cota of cotasDe(todas.contenedor)) expect(cota.style.display).not.toBe('none')

    const ninguna = abrirVisor({ edicion: { minimoPx: 1e6 } })
    expect(cotasDe(ninguna.contenedor).length).toBeGreaterThan(0)
    for (const cota of cotasDe(ninguna.contenedor)) expect(cota.style.display).toBe('none')
  })

  it('una clave DESCONOCIDA en `edicion` es TypeError y no monta nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    let error = null
    try {
      // La errata clásica. Sin esta guarda, el snap usaría los 20 cm por defecto
      // y el usuario vería «engancha mal» sin que nada lo explicara.
      crearVisor(contenedor, { ...base, edicion: { toleracia: 1.25 } })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toContain('toleracia')
    expect(error.message).toContain('tolerancia')
    expect(contenedor.children).toHaveLength(0)
  })

  it('`edicion` que no es booleano ni objeto es TypeError, sin montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    // `null` se rechaza a propósito: sería una cuarta forma de decir "no", y casi
    // siempre es un `?? false` que falta.
    for (const edicion of ['si', 1, null, [], () => {}]) {
      expect(() => crearVisor(contenedor, { ...base, edicion })).toThrow(TypeError)
    }
    expect(contenedor.children).toHaveLength(0)
  })

  it('un `snapActivo` que no es booleano lanza, y no deja la edición montada', () => {
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        edicion: { snapActivo: 'sí' },
      }),
    ).toThrow(TypeError)

    // Se aplica DESPUÉS de apilar el deshacer de la edición, así que el fallo
    // arrastra también a la pieza ya construida.
    expect(contenedor.children).toHaveLength(0)
    expect(document.querySelector(`.${CLASE_ACOTACION}`)).toBeNull()
  })
})

// ── El DOBLE CANAL de alPrevisualizar ────────────────────────────────────────

describe('crearVisor · alPrevisualizar del llamante (canal propio, no una clave de edicion)', () => {
  it('se llama TAMBIÉN con edición montada, y DESPUÉS de repintar las cotas', () => {
    const orden = []
    const alPrevisualizar = vi.fn(() => orden.push('llamante'))
    const { visor } = abrirVisor({ edicion: true, alPrevisualizar })

    // Arranque: exactamente UNA llamada (la del render posterior al encuadre; la
    // del render mudo previo no cuenta), con los anillos del estado y ref null.
    expect(alPrevisualizar).toHaveBeenCalledTimes(1)

    vi.spyOn(visor.acotaciones, 'pintar').mockImplementation(() => orden.push('cotas'))
    orden.length = 0
    argumentosDeSincronizar().alPrevisualizar([[[1, 2]]], null)

    // Las cotas PRIMERO: es el orden que garantiza que un llamante que revienta no
    // se lleve por delante el repintado.
    expect(orden).toEqual(['cotas', 'llamante'])
  })

  it('recibe los anillos UTM del estado y refVertice null en el arranque', () => {
    const alPrevisualizar = vi.fn()
    const { parcela } = abrirVisor({ edicion: true, alPrevisualizar })

    const [anillos, ref] = alPrevisualizar.mock.calls[0]
    expect(anillos).toEqual(anillosDe(parcela))
    expect(ref).toBeNull()
    // COPIA, nunca los arrays del estado (contrato de `sincronizacion.js`).
    expect(anillos[0]).not.toBe(parcela.recintos[0].vertices)
  })

  it('funciona SIN edición montada: son dos cosas distintas', () => {
    const alPrevisualizar = vi.fn()
    const { visor, parcela } = abrirVisor({ alPrevisualizar })

    expect(visor.edicion).toBeNull()
    expect(visor.acotaciones).toBeNull()
    // El gancho que llega a `sincronizar` ya no es `null`: hay un consumidor.
    expect(typeof argumentosDeSincronizar().alPrevisualizar).toBe('function')
    expect(alPrevisualizar).toHaveBeenCalledTimes(1)
    expect(alPrevisualizar.mock.calls[0][0]).toEqual(anillosDe(parcela))
  })

  it('un alPrevisualizar que REVIENTA no tumba el visor ni el repintado de las cotas', () => {
    const alAvisar = vi.fn()
    const alPrevisualizar = vi.fn(() => {
      throw new Error('la ficha del pie ha explotado')
    })
    const { contenedor } = abrirVisor({ edicion: true, alPrevisualizar, alAvisar })

    // Las cotas se han pintado igual (van primero) …
    expect(cotasDe(contenedor).length).toBeGreaterThan(0)
    // … y el fallo NO se ha tragado: lo cuenta la red que `sincronizacion.js` ya
    // pone, UNA vez (aquí no se duplica esa protección).
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('un alPrevisualizar que no es función es contrato roto → TypeError, sin montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        alPrevisualizar: 'no soy una función',
      }),
    ).toThrow(TypeError)
    expect(contenedor.children).toHaveLength(0)
  })
})

// ── ATOMICIDAD del ensamblaje con edición ────────────────────────────────────

describe('crearVisor · si la edición falla a mitad, no queda NADA montado', () => {
  it('un fallo de crearEdicion (tolerancia negativa) deja el contenedor limpio', () => {
    const { contenedor, tablaEl } = prepararDOM()

    let error = null
    try {
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        // Una tolerancia negativa no es una tolerancia: `crearEdicion` lanza. Y lo
        // hace con el mapa, las capas y las acotaciones YA montadas, que es
        // exactamente el punto medio que este test vigila.
        edicion: { tolerancia: -1 },
      })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(RangeError)
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-layers')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-attribution')).toBeNull()
    expect(contenedor.children).toHaveLength(0)
    // Y las acotaciones, que sí llegaron a montarse, se han desmontado con todo
    // lo demás (si no, quedarían rótulos huérfanos en el documento).
    expect(document.querySelector(`.${CLASE_ACOTACION}`)).toBeNull()
    // La tabla ni siquiera llegó a construirse: `sincronizar` es el paso 4.
    expect(tablaEl.children).toHaveLength(0)
  })

  it('un fallo de crearAcotaciones (minimoPx inválido) deja el contenedor limpio', () => {
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        edicion: { minimoPx: -1 },
      }),
    ).toThrow(TypeError)

    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(contenedor.children).toHaveLength(0)
  })
})

// ── destruir() con edición montada ───────────────────────────────────────────

describe('crearVisor · destruir con edición: orden inverso e idempotencia', () => {
  it('desmonta en ORDEN INVERSO: sincronización → edición → acotaciones → capas → mapa', () => {
    const { contenedor, tablaEl, visor } = abrirVisor({ edicion: true })
    expect(tablaEl.children.length).toBeGreaterThan(0)

    const orden = []
    /** Lo observado en el instante en el que le toca a la EDICIÓN. */
    let alTocarleALaEdicion = null

    anotarDestruccion(visor.edicion, 'edicion', orden, () => {
      alTocarleALaEdicion = {
        // La sincronización ya se ha ido: es la primera de la pila, y lo único
        // que deja como huella es la tabla vaciada.
        tablaYaVacia: tablaEl.children.length === 0,
        // Y el mapa SIGUE EN PIE: `crearEdicion` tiene que poder restaurarle el
        // `doubleClickZoom` y darse de baja de sus eventos.
        mapaAunEnPie: contenedor.querySelector('.leaflet-map-pane') !== null,
      }
    })
    anotarDestruccion(visor.acotaciones, 'acotaciones', orden)
    anotarDestruccion(visor.capas, 'capas', orden)
    const quitarMapa = visor.mapa.remove.bind(visor.mapa)
    visor.mapa.remove = () => {
      orden.push('mapa')
      return quitarMapa()
    }

    visor.destruir()

    expect(orden).toEqual(['edicion', 'acotaciones', 'capas', 'mapa'])
    expect(alTocarleALaEdicion).toEqual({ tablaYaVacia: true, mapaAunEnPie: true })
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(cotasDe(contenedor)).toHaveLength(0)
  })

  it('restaura el doubleClickZoom que crearEdicion había apagado', () => {
    const { visor } = abrirVisor({ edicion: true })

    // Mientras la edición vive, el doble clic INSERTA un vértice: ampliar además
    // el mapa con el mismo gesto sería un efecto sorpresa.
    expect(visor.mapa.doubleClickZoom.enabled()).toBe(false)

    // Se mide EN EL INSTANTE del desmontaje del mapa y no después: `Map#remove`
    // deshabilita todos sus handlers, así que preguntarlo al final daría `false`
    // pasara lo que pasara — el test parecería pasar sin probar nada.
    let alQuitarElMapa = null
    const quitarMapa = visor.mapa.remove.bind(visor.mapa)
    visor.mapa.remove = () => {
      alQuitarElMapa = visor.mapa.doubleClickZoom.enabled()
      return quitarMapa()
    }

    visor.destruir()
    expect(alQuitarElMapa).toBe(true)
  })

  it('es IDEMPOTENTE: cada pieza se desmonta UNA sola vez aunque se llame tres', () => {
    const { visor } = abrirVisor({ edicion: true })

    const orden = []
    anotarDestruccion(visor.edicion, 'edicion', orden)
    anotarDestruccion(visor.acotaciones, 'acotaciones', orden)

    visor.destruir()
    expect(() => visor.destruir()).not.toThrow()
    expect(() => visor.destruir()).not.toThrow()

    expect(orden).toEqual(['edicion', 'acotaciones'])
  })

  it('tras destruir, un estado.set no revive ni las cotas ni la edición', () => {
    const { contenedor, store, visor } = abrirVisor({ edicion: true })
    visor.destruir()

    const otra = parcelaConHueco()
    otra.recintos[0].vertices[0] = [439200, 4479600]
    expect(() => store.set(otra)).not.toThrow()

    expect(cotasDe(contenedor)).toHaveLength(0)
    expect(() => visor.edicion.insertarEn({ lat: 40, lng: -3 })).not.toThrow()
    expect(visor.edicion.insertarEn({ lat: 40, lng: -3 }).aplicado).toBe(false)
  })
})

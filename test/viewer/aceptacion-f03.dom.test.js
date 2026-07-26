/* -------------------------------------------------------------------------- *
 * test/viewer/aceptacion-f03.dom.test.js — F03 · T4C.1 · SUITE DE ACEPTACIÓN   *
 *                                                                              *
 * Prueba de CAJA NEGRA que mapea 1:1 a los 5 Criterios de aceptación de        *
 * spec/feature-03-visor.md (§ "Criterios de aceptación"):                      *
 *   1. Las cinco capas base conmutan; la superpuesta regula opacidad.          *
 *   2. El WMS del Catastro se pide una vez por encuadre, nunca en mosaico.     *
 *   3. Arrastrar un marcador actualiza la fila de la tabla y viceversa, sin    *
 *      bucle.                                                                  *
 *   4. Todas las capas cargan con `crossOrigin='anonymous'`.                   *
 *   5. La atribución aparece en el visor.                                      *
 *                                                                              *
 * Ejercita SOLO la API PÚBLICA del visor: `crearVisor(contenedor, opciones)` y  *
 * el `{mapa, estado, capas}` que devuelve, más el DOM que el visor deja en el   *
 * contenedor y en la tabla (los selectores documentados de                      *
 * `viewer/sincronizacion.js`: `tbody[data-recinto]`, `tr[data-indice]`,         *
 * `input[data-eje]`, evento `change`). La parcela se construye INLINE con       *
 * `crearRecinto`/`crearParcela` (exterior + hueco, anillos ABIERTOS, UTM huso   *
 * 30), igual que las suites de aceptación de F01 y F02; del arnés               *
 * `_ayuda-jsdom.js` se usa solo la FONTANERÍA de jsdom (contenedor con tamaño   *
 * real, espía de `new Image()`, disparo de `load`).                             *
 *                                                                              *
 * QUÉ **NO** RE-TESTEA (hay 956 pruebas que ya cubren los módulos por dentro):  *
 *   · la construcción de la URL `GetMap`, la deduplicación por URL, el token    *
 *     anti-carrera y los avisos de la capa WMS → `wms-catastro.dom.test.js`;    *
 *   · los descriptores de capa, el rótulo del control y los clics reales en sus *
 *     radios → `capas.dom.test.js` y `contrato-capas.dom.test.js`;              *
 *   · el render idempotente, la reversión de celdas ilegibles y el historial →  *
 *     `sincronizacion.dom.test.js`;                                             *
 *   · los panes, `zoomSnap` y el blindaje del control de atribución →           *
 *     `mapa.dom.test.js`;                                                       *
 *   · el contrato de viewport, la traducción `srs→zona` y `destruir()` →        *
 *     `index.dom.test.js`.                                                      *
 *   Nada de esto se repite aquí: esta suite solo afirma lo que los CRITERIOS    *
 *   dicen, y cada `it` cita la frase del spec a la que está atado. Si un `it`   *
 *   no puede citar una frase, no pertenece a este fichero.                      *
 *                                                                              *
 * Un `describe` por criterio (`F03 · AC1 ·` … `F03 · AC5 ·`). Las ramas de un   *
 * mismo criterio van prefijadas `(a)`/`(b)`/… y los asserts llevan mensaje      *
 * explicativo como 2.º argumento de `expect` (convenciones de F02).             *
 *                                                                              *
 * CERO listas literales de capas o de ids: todo se DERIVA de lo que el visor    *
 * monta (`visor.capas.bases.keys()`, `visor.capas.capas`, `descriptorPorId`,    *
 * `Object.values(ATRIBUCION)`, `mapa.getSize()`).                               *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom): el sufijo `.dom.test.js` lo enruta ahí, porque *
 * `viewer/index.js` arrastra Leaflet. NINGUNA petición real de red: jsdom no    *
 * descarga imágenes, y `load` se emite a mano con `dispararCarga`.              *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, afterEach } from 'vitest'
import L from 'leaflet'

import { crearVisor } from '../../viewer/index.js'
import { PANE, crearEstadoVista, vertUTMaLatLng } from '../../viewer/_comun.js'
import { ID_CAPA, descriptorPorId } from '../../viewer/capas.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { crearParcela, crearRecinto, ORIGEN_PARCELA, TIPO_RECINTO } from '../../model/parcela.js'
import { crearContenedor, dispararCarga, espiarPeticiones } from './_ayuda-jsdom.js'

// ── Contexto geométrico (fixture INLINE, como F01/F02) ───────────────────────
// Huso 30 (EPSG:25830), en el entorno del referencePoint del fixture F00
// [439250.35, 4479664.55]: la parcela cae dentro de España y el encuadre inicial
// sale a escala de parcela, que es el escenario real del visor.
const SRS = 'EPSG:25830'
const HUSO = 30

/** Exterior de ~20×15 m (Este×Norte), anillo ABIERTO. */
const EXTERIOR_UTM = [
  [439240, 4479655],
  [439260, 4479655],
  [439260, 4479670],
  [439240, 4479670],
]

/** Hueco de 4×4 m, holgadamente contenido en el exterior. */
const HUECO_UTM = [
  [439248, 4479660],
  [439252, 4479660],
  [439252, 4479664],
  [439248, 4479664],
]

/**
 * Parcela EXTERIOR + HUECO construida con el modelo (no a mano): así el fixture
 * respeta por construcción los invariantes de `model/parcela.js` (anillos
 * abiertos, copia defensiva, `recintos[0]` EXTERIOR).
 */
function parcelaExteriorConHueco() {
  return crearParcela({
    idLocal: 'aceptacion-f03',
    origen: ORIGEN_PARCELA.LIST,
    recintos: [
      crearRecinto(EXTERIOR_UTM, TIPO_RECINTO.EXTERIOR),
      crearRecinto(HUECO_UTM, TIPO_RECINTO.HUECO),
    ],
  })
}

// ── Fontanería del test ──────────────────────────────────────────────────────

/** Limpieza garantizada aunque un `expect` falle a mitad de test (LIFO). */
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
  // `document.body` limpio entre tests: el arnés inserta el contenedor en el
  // body y un resto de un test anterior falsearía cualquier `querySelector`.
  document.body.replaceChildren()
})

/**
 * Abre un visor COMPLETO sobre la parcela del fixture y registra su destrucción.
 *
 * Las cuatro animaciones van desactivadas por el REST de opciones (que
 * `crearVisor` reenvía a `L.map`): son transiciones CSS que jsdom nunca resuelve
 * — la razón completa está en la cabecera de `_ayuda-jsdom.js`.
 */
function abrirVisor({ parcela = parcelaExteriorConHueco(), estado, srs = SRS, ...resto } = {}) {
  const contenedor = crearContenedor()
  const tablaEl = document.createElement('table')
  document.body.appendChild(tablaEl)

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

/**
 * Espía de `new Image()` del arnés + registro de su `restaurar()` en la pila que
 * drena el `afterEach`.
 *
 * **Se instala ANTES de `crearVisor` SIEMPRE**: la primera petición de la capa
 * WMS ocurre DURANTE el montaje (el encuadre es el último paso del ensamblaje y
 * dispara el `onAdd` de la capa), así que un espía instalado después no la vería
 * y la cuenta del criterio 2 empezaría en 0 por accidente.
 */
function espiar() {
  const espia = espiarPeticiones()
  pendientes.push(() => espia.restaurar())
  return espia
}

/** Valor CRUDO de un parámetro de la query (sin decodificar). */
function parametro(url, nombre) {
  const encontrado = new RegExp(`[?&]${nombre}=([^&]*)`).exec(url)
  return encontrado ? encontrado[1] : null
}

/** Ids de las capas BASE que están ahora mismo en el mapa (derivado, sin listas). */
function basesEnMapa(visor) {
  return [...visor.capas.bases]
    .filter(([, capa]) => visor.mapa.hasLayer(capa))
    .map(([id]) => id)
}

/**
 * Marcadores del visor indexados por su `refVertice` (`'recinto:indice'`).
 *
 * `viewer/sincronizacion.js` expone `marcador.refVertice` A PROPÓSITO para esto:
 * localizar un vértice concreto SIN depender del orden en que `mapa.eachLayer`
 * enumere las capas (que no es contrato de nadie).
 */
function marcadoresPorRef(mapa) {
  const porRef = new Map()
  mapa.eachLayer((capa) => {
    if (capa.refVertice) porRef.set(`${capa.refVertice.recinto}:${capa.refVertice.indice}`, capa)
  })
  return porRef
}

const marcadorDe = (mapa, recinto, indice) => marcadoresPorRef(mapa).get(`${recinto}:${indice}`)

/** El polígono de la geometría EDITABLE (por su pane, derivado de `PANE`). */
function poligonoEditadoDe(mapa) {
  let encontrado = null
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Polygon && capa.options.pane === PANE.PARCELA_EDITADA) encontrado = capa
  })
  return encontrado
}

const filaDe = (tablaEl, recinto, indice) =>
  tablaEl.querySelector(`tr[data-recinto="${recinto}"][data-indice="${indice}"]`)

const inputDe = (fila, eje) => fila.querySelector(`input[data-eje="${eje}"]`)

/** Teclea un valor y TERMINA la edición: `change`, nunca `input` (hallazgo C7). */
function cambiarCelda(input, texto) {
  input.value = texto
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * Cuenta las NOTIFICACIONES del store, o sea los `estado.set` que llegan a las
 * vistas. Es la medida del "sin bucle" del criterio 3: un `set` por operación
 * acabada, ni uno por frame de arrastre ni una cascada.
 */
function contarNotificaciones(store) {
  let n = 0
  pendientes.push(store.subscribe(() => n++))
  return () => n
}

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 1 — "Las cinco capas base conmutan; la superpuesta regula opacidad."
// ════════════════════════════════════════════════════════════════════════════
describe('F03 · AC1 · las cinco capas base conmutan; la superpuesta regula opacidad', () => {
  it('"Las CINCO capas base": el visor monta exactamente cinco bases (+1 superpuesta)', () => {
    const { visor } = abrirVisor()
    // El criterio dice "cinco" con número: citarlo es legítimo, y es el único
    // literal de este describe. Todo lo demás se deriva de estas colecciones.
    expect(visor.capas.bases.size, 'el spec enumera CINCO capas base').toBe(5)
    expect(
      visor.capas.capas.size,
      'las cinco bases + la superpuesta catastral del spec',
    ).toBe(visor.capas.bases.size + 1)
  })

  it('"Las cinco capas base CONMUTAN": cada base queda activa y deja EXACTAMENTE UNA', () => {
    const { visor } = abrirVisor()

    // Los ids salen de `bases.keys()`: si mañana el visor monta otro conjunto,
    // este test lo recorre igual (una lista escrita a mano se quedaría vieja en
    // verde).
    for (const id of [...visor.capas.bases.keys()]) {
      const capa = visor.capas.activarBase(id)

      expect(visor.capas.baseActiva(), `tras activar «${id}»`).toBe(id)
      expect(capa, `activarBase debe devolver la capa de «${id}»`).toBe(
        visor.capas.bases.get(id),
      )
      expect(visor.mapa.hasLayer(capa), `«${id}» debería estar EN el mapa`).toBe(true)
      // "conmutan" = excluyentes: una base entra y la anterior sale. Dos bases
      // opacas a la vez no serían una conmutación, serían un apilamiento.
      expect(basesEnMapa(visor), `solo «${id}» debería estar activa`).toEqual([id])
    }
  })

  it('"Las cinco capas base conmutan": el control que ve el usuario ofrece 5 radios + 1 casilla', () => {
    const { contenedor, visor } = abrirVisor()

    const raiz = visor.capas.control.getContainer()
    expect(contenedor.contains(raiz), 'el control de capas vive dentro del visor').toBe(true)

    // Radios (excluyentes) = bases; casilla (independiente) = superpuesta. Los
    // números se derivan de lo montado, no se escriben: 5 y 1 son consecuencia.
    expect(raiz.querySelectorAll('input[type=radio]')).toHaveLength(visor.capas.bases.size)
    expect(raiz.querySelectorAll('input[type=checkbox]')).toHaveLength(
      visor.capas.capas.size - visor.capas.bases.size,
    )
  })

  it('(a) "la superpuesta REGULA OPACIDAD": activada, el control se habilita y fijarOpacidad(0.25) llega a la capa', () => {
    const { contenedor, visor } = abrirVisor()

    const rango = contenedor.querySelector('.gml-control-opacidad input[type=range]')
    expect(rango, 'el visor debe montar el deslizador de opacidad').not.toBeNull()

    visor.capas.activarSuperpuesta(true)
    expect(visor.capas.superpuestaActiva(), 'la superpuesta debe quedar activa').toBe(true)
    expect(
      rango.disabled,
      'con la superpuesta activa el control de opacidad tiene que estar HABILITADO',
    ).toBe(false)

    expect(visor.capas.fijarOpacidad(0.25)).toBe(0.25)
    expect(visor.capas.opacidad(), 'la API debe devolver la opacidad fijada').toBe(0.25)
    // "regula opacidad" de verdad: el valor llega a la CAPA, no solo al widget.
    expect(
      visor.capas.superpuesta.options.opacity,
      'la capa superpuesta debe reflejar la opacidad regulada',
    ).toBe(0.25)
    expect(visor.capas.superpuesta.getElement().style.opacity).toBe('0.25')
  })

  it('(b) "la superpuesta regula opacidad": desactivada, el control queda DESHABILITADO (no regula nada que no se vea)', () => {
    const { contenedor, visor } = abrirVisor({ superpuestaInicial: true })
    const rango = contenedor.querySelector('.gml-control-opacidad input[type=range]')
    expect(rango.disabled, 'arrancando con la superpuesta encendida, habilitado').toBe(false)

    visor.capas.activarSuperpuesta(false)

    expect(visor.capas.superpuestaActiva()).toBe(false)
    expect(
      rango.disabled,
      'sin superpuesta en pantalla, un control de opacidad habilitado MENTIRÍA',
    ).toBe(true)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 2 — "El WMS del Catastro se pide **una vez por encuadre**, nunca en
//               mosaico (verificable en el nº de peticiones al mover el mapa)."
// ════════════════════════════════════════════════════════════════════════════
//
// La medida es el nº de `new Image()`: `viewer/wms-catastro.js` precarga cada
// imagen en un `new Image()` desprendido, así que envolver el constructor
// (`espiarPeticiones`) da el número EXACTO de peticiones al Catastro. La imagen
// VISIBLE la crea Leaflet con `document.createElement('img')` y solo recibe URLs
// ya cargadas: no entra en la cuenta, y esa es justo la distinción a medir.
describe('F03 · AC2 · el WMS del Catastro se pide una vez por encuadre, nunca en mosaico', () => {
  it('"una vez por encuadre … verificable en el nº de peticiones al mover el mapa": 1 → 2 → 3, y un pan NULO sigue en 3', () => {
    const espia = espiar() // ANTES de crearVisor: la 1.ª petición es del montaje
    const { visor } = abrirVisor({ baseInicial: ID_CAPA.CATASTRO })

    expect(
      espia.total,
      'el montaje cuesta UNA petición, y del encuadre definitivo (el encuadre es el último paso del ensamblaje)',
    ).toBe(1)
    dispararCarga(espia.ultima())

    // PAN: encuadre nuevo ⇒ exactamente una petición más. `animate:false` hace el
    // `moveend` sincrónico (con la animación por defecto llegaría ~250 ms tarde).
    visor.mapa.panBy([160, 120], { animate: false })
    expect(espia.total, 'un pan es UN encuadre nuevo: una petición, no una rejilla').toBe(2)
    dispararCarga(espia.ultima())

    // ZOOM: Leaflet emite `zoomend` Y `moveend` en cada zoom; si la capa
    // escuchara los dos, aquí se contarían 4 en vez de 3.
    visor.mapa.setZoom(visor.mapa.getZoom() - 1, { animate: false })
    expect(espia.total, 'un zoom es UN encuadre nuevo: una petición').toBe(3)
    dispararCarga(espia.ultima())

    // PAN NULO: Leaflet emite `moveend` igual, pero el encuadre no ha cambiado.
    visor.mapa.panBy([0, 0], { animate: false })
    expect(
      espia.total,
      'un movimiento que no cambia el encuadre no debe costar NINGUNA petición al Catastro',
    ).toBe(3)
  })

  it('"NUNCA EN MOSAICO": ninguna petición es una tesela; cada una es el lienzo completo y su BBOX es único', () => {
    const espia = espiar()
    const { visor } = abrirVisor({ baseInicial: ID_CAPA.CATASTRO })
    dispararCarga(espia.ultima())
    visor.mapa.panBy([160, 120], { animate: false })
    dispararCarga(espia.ultima())
    visor.mapa.setZoom(visor.mapa.getZoom() - 1, { animate: false })
    dispararCarga(espia.ultima())

    const urls = espia.urls()
    expect(urls, 'tres encuadres, tres peticiones').toHaveLength(3)

    // El tamaño de la imagen se DERIVA del lienzo (`getSize()`), no se escribe:
    // que WIDTH/HEIGHT sean el mapa entero ES la prueba de que no hay mosaico.
    const tamano = visor.mapa.getSize()
    for (const url of urls) {
      expect(parametro(url, 'WIDTH'), `WIDTH de ${url}`).toBe(String(tamano.x))
      expect(parametro(url, 'HEIGHT'), `HEIGHT de ${url}`).toBe(String(tamano.y))
      // 256 px es el tamaño canónico de tesela: ni una petición debe tenerlo.
      expect(parametro(url, 'WIDTH'), 'una imagen de 256 px sería una TESELA').not.toBe('256')
      expect(url, 'ni rastro de vocabulario de teselas en la URL').not.toContain('TILE')
    }

    // Un mosaico serviría VARIAS imágenes del MISMO encuadre (mismo momento,
    // BBOX contiguos); aquí cada petición corresponde a un encuadre distinto.
    const bboxes = urls.map((url) => parametro(url, 'BBOX'))
    expect(new Set(bboxes).size, 'los tres BBOX deben ser distintos entre sí').toBe(3)
  })

  it('(caso de DOS instancias visibles) base Catastro + superpuesta = 2 peticiones por encuadre, y eso es CORRECTO', () => {
    // ⚠️ NO ES UN FALLO Y NO HAY NADA QUE "ARREGLAR" AQUÍ. El criterio real,
    // escrito en la cabecera de `viewer/wms-catastro.js` (punto 9) y en la de
    // `viewer/capas.js`, es «1 petición por capa WMS del Catastro VISIBLE». Con la
    // base catastral Y la superpuesta encendidas hay DOS imágenes distintas del
    // MISMO encuadre —una opaca (TRANSPARENT=FALSE) para el fondo y otra con
    // TRANSPARENT=TRUE para superponer—, no una capa teselada partida en dos
    // trozos. Lo que el criterio prohíbe es el MOSAICO, y este test lo afirma:
    // ambas piden el MISMO BBOX y el MISMO tamaño (el lienzo completo).
    // Que nadie "optimice" esto fusionando las dos capas ni reutilizando la
    // imagen de una para la otra: son dos productos distintos del servicio.
    const espia = espiar()
    const { visor } = abrirVisor({
      baseInicial: ID_CAPA.CATASTRO,
      superpuestaInicial: true,
    })

    expect(espia.total, 'dos capas WMS visibles ⇒ dos peticiones, una por capa').toBe(2)
    const [urlA, urlB] = espia.urls()
    expect(parametro(urlA, 'BBOX'), 'MISMO encuadre: no es un mosaico').toBe(parametro(urlB, 'BBOX'))
    expect(parametro(urlA, 'WIDTH')).toBe(parametro(urlB, 'WIDTH'))
    expect(parametro(urlA, 'HEIGHT')).toBe(parametro(urlB, 'HEIGHT'))
    // Y son productos DISTINTOS del servicio, no dos trozos de lo mismo.
    expect(
      [parametro(urlA, 'TRANSPARENT'), parametro(urlB, 'TRANSPARENT')].sort(),
      'una opaca (base) y una con transparencia (superpuesta)',
    ).toEqual(['FALSE', 'TRUE'])

    // Y sigue siendo "una vez por encuadre": el siguiente encuadre cuesta 2, no 4.
    for (const imagen of espia.imagenes) dispararCarga(imagen)
    visor.mapa.panBy([160, 120], { animate: false })
    expect(espia.total, 'segundo encuadre: 2 capas visibles ⇒ 2 peticiones más').toBe(4)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 3 — "Arrastrar un marcador actualiza la fila de la tabla y viceversa,
//               sin bucle."
// ════════════════════════════════════════════════════════════════════════════
describe('F03 · AC3 · arrastrar un marcador actualiza la fila de la tabla y viceversa, sin bucle', () => {
  /** Desplaza un marcador a una posición nueva y visible (≈5 m). */
  function moverMarcador(marcador, dLat = 0.00005, dLng = 0.00005) {
    const desde = marcador.getLatLng()
    const destino = L.latLng(desde.lat + dLat, desde.lng + dLng)
    marcador.setLatLng(destino)
    return destino
  }

  it('(a) "ARRASTRAR UN MARCADOR ACTUALIZA LA FILA DE LA TABLA": el `drag` mueve fila y polígono con CERO set en el store', () => {
    const { visor, tablaEl, store } = abrirVisor()
    const notificaciones = contarNotificaciones(store)

    const marcador = marcadorDe(visor.mapa, 0, 0)
    expect(marcador, 'debe existir el marcador del vértice 0 del exterior').toBeTruthy()
    const fila = filaDe(tablaEl, 0, 0)
    expect(fila, 'debe existir la fila tr[data-recinto="0"][data-indice="0"]').not.toBeNull()

    const xAntes = inputDe(fila, 'x').value
    const yAntes = inputDe(fila, 'y').value
    const estadoAntes = structuredClone(store.get())
    const poligono = poligonoEditadoDe(visor.mapa)
    expect(poligono, 'debe existir el polígono de la geometría editable').not.toBeNull()

    const destino = moverMarcador(marcador)
    marcador.fire('drag')

    // "…actualiza la fila de la tabla": las DOS celdas de ESA fila, en el sitio.
    expect(inputDe(fila, 'x').value, 'la celda X debe seguir al marcador').not.toBe(xAntes)
    expect(inputDe(fila, 'y').value, 'la celda Y debe seguir al marcador').not.toBe(yAntes)
    // …y el dibujo también: fila y polígono son dos vistas del mismo vértice.
    expect(poligono.getLatLngs()[0][0].lat).toBeCloseTo(destino.lat, 9)
    expect(poligono.getLatLngs()[0][0].lng).toBeCloseTo(destino.lng, 9)

    // Un arrastre son DECENAS de eventos `drag`: el gesto en curso no toca el
    // store (un `set` por frame reventaría el historial y recrearía la fila que
    // el usuario está mirando).
    expect(notificaciones(), 'el `drag` no debe hacer NINGÚN set').toBe(0)
    expect(store.get(), 'el modelo no cambia hasta que el gesto acaba').toEqual(estadoAntes)
  })

  it('(b) el gesto acaba en EXACTAMENTE UN set: `dragend` escribe el vértice, y lo escribe en UTM', () => {
    const { visor, store } = abrirVisor()
    const notificaciones = contarNotificaciones(store)

    const marcador = marcadorDe(visor.mapa, 0, 0)
    const destino = moverMarcador(marcador)
    marcador.fire('drag')
    marcador.fire('drag') // decenas de frames en el gesto real
    marcador.fire('drag')
    marcador.fire('dragend')

    expect(notificaciones(), 'un gesto acabado = UN set, sin importar los frames').toBe(1)

    const [x, y] = store.get().recintos[0].vertices[0]
    // El modelo va SIEMPRE en UTM (regla de oro 3): un [lat,lon] aquí sería
    // ~[37.6, -4.6], y estos órdenes de magnitud lo descartan sin ambigüedad.
    expect(Math.abs(x), 'el Este UTM del huso 30 es del orden de 1e5').toBeGreaterThan(100000)
    expect(Math.abs(y), 'el Norte UTM peninsular es del orden de 4e6').toBeGreaterThan(1000000)
    // Comprobación INDEPENDIENTE del valor: desproyectar lo guardado devuelve la
    // posición del marcador (se usa el sentido INVERSO al que hizo el arrastre).
    const [lat, lon] = vertUTMaLatLng([x, y], HUSO)
    expect(lat).toBeCloseTo(destino.lat, 7)
    expect(lon).toBeCloseTo(destino.lng, 7)
  })

  it('(c) "…Y VICEVERSA": editar la celda X de una fila mueve su marcador y cambia el estado', () => {
    const { visor, tablaEl, store } = abrirVisor()

    // Vértice 1 del EXTERIOR, movido 1,25 m al Este. El valor se teclea con COMA
    // (es lo que teclea un usuario español) y se DERIVA del fixture.
    const nuevoX = EXTERIOR_UTM[1][0] + 1.25
    const fila = filaDe(tablaEl, 0, 1)
    cambiarCelda(inputDe(fila, 'x'), String(nuevoX).replace('.', ','))

    // "…y viceversa": la tabla escribe en el modelo…
    expect(store.get().recintos[0].vertices[1][0]).toBeCloseTo(nuevoX, 6)
    expect(
      store.get().recintos[0].vertices[1][1],
      'la Y no se toca al editar la X',
    ).toBeCloseTo(EXTERIOR_UTM[1][1], 6)

    // …y el MARCADOR se mueve con él (el mapa es la otra vista del mismo estado).
    const [lat, lon] = vertUTMaLatLng([nuevoX, EXTERIOR_UTM[1][1]], HUSO)
    const marcador = marcadorDe(visor.mapa, 0, 1)
    expect(marcador.getLatLng().lat).toBeCloseTo(lat, 9)
    expect(marcador.getLatLng().lng).toBeCloseTo(lon, 9)
    // Y el polígono, que es la tercera vista del mismo vértice.
    expect(poligonoEditadoDe(visor.mapa).getLatLngs()[0][1].lng).toBeCloseTo(lon, 9)
  })

  it('(d) "SIN BUCLE": una notificación por operación, y las MISMAS instancias de marcador siguen vivas', () => {
    const { visor, tablaEl, store } = abrirVisor()
    const notificaciones = contarNotificaciones(store)
    const antes = marcadoresPorRef(visor.mapa)
    expect(antes.size, 'un marcador por vértice de cada recinto').toBe(
      store.get().recintos.reduce((n, r) => n + r.vertices.length, 0),
    )

    // 1.ª operación: un arrastre completo del exterior.
    const marcador = marcadorDe(visor.mapa, 0, 0)
    moverMarcador(marcador)
    marcador.fire('drag')
    marcador.fire('dragend')
    expect(notificaciones(), 'primera operación: exactamente UNA notificación').toBe(1)

    // 2.ª operación: una celda del HUECO (otro recinto, para que la vuelta no
    // dependa de estar en el exterior).
    const nuevaY = HUECO_UTM[0][1] + 0.5
    cambiarCelda(inputDe(filaDe(tablaEl, 1, 0), 'y'), String(nuevaY).replace('.', ','))
    expect(
      notificaciones(),
      'segunda operación: UNA notificación más, no una cascada tabla→mapa→tabla',
    ).toBe(2)

    // Segunda afirmación del "sin bucle": la FORMA no ha cambiado (mismo nº de
    // recintos y de vértices), así que el render actualizó EN SITIO y NO recreó
    // nada. Si hubiera realimentación, cada notificación reconstruiría la vista y
    // estas instancias serían otras — y el gesto del usuario se perdería a mitad.
    const despues = marcadoresPorRef(visor.mapa)
    expect(despues.size).toBe(antes.size)
    for (const [ref, instancia] of antes) {
      expect(despues.get(ref), `el marcador «${ref}» debería ser LA MISMA instancia`).toBe(
        instancia,
      )
    }
    // Y el número de filas tampoco ha bailado.
    expect(tablaEl.querySelectorAll('tr[data-indice]')).toHaveLength(antes.size)
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 4 — "Todas las capas cargan con `crossOrigin='anonymous'`."
// ════════════════════════════════════════════════════════════════════════════
describe('F03 · AC4 · todas las capas cargan con crossOrigin=anonymous', () => {
  it('"TODAS las capas": recorrido de las capas MONTADAS por el visor, sin ninguna excepción', () => {
    const { visor } = abrirVisor()

    // Recorrido DERIVADO de lo que el visor monta: si mañana entra una capa más,
    // este test la exige también (una lista escrita a mano la dejaría fuera).
    expect(visor.capas.capas.size, 'debe haber capas que recorrer').toBeGreaterThan(0)
    for (const [id, capa] of visor.capas.capas) {
      expect(
        capa.options.crossOrigin,
        `la capa «${id}» debe declarar crossOrigin anonymous (override O7: sin él la ` +
          `imagen contaminaría el canvas del informe de F09)`,
      ).toBe('anonymous')
    }
    // Y ninguna base queda fuera de ese recorrido (nada montado por un lado).
    for (const id of visor.capas.bases.keys()) {
      expect(visor.capas.capas.has(id), `«${id}» debe estar en el recorrido`).toBe(true)
    }
  })

  it('"todas las capas CARGAN con crossOrigin=anonymous": las DOS imágenes reales de la capa WMS visible van anónimas', () => {
    const espia = espiar()
    const { visor } = abrirVisor({ baseInicial: ID_CAPA.CATASTRO })
    const capa = visor.capas.bases.get(visor.capas.baseActiva())

    // (1) La imagen VISIBLE del `L.ImageOverlay`…
    expect(
      capa.getElement().getAttribute('crossorigin'),
      'la imagen visible del overlay debe ir anónima',
    ).toBe('anonymous')
    // (2) …y la PRECARGA desprendida, que es la que de verdad trae los píxeles
    // (`crossOrigin` ANTES de `src`, o el atributo no surte efecto).
    expect(
      espia.ultima().getAttribute('crossorigin'),
      'la imagen de PRECARGA es la que descarga los píxeles: si va sin anonymous, ' +
        'el criterio 4 no se cumple aunque el overlay lo declare',
    ).toBe('anonymous')
  })
})

// ════════════════════════════════════════════════════════════════════════════
// CRITERIO 5 — "La atribución aparece en el visor."
// ════════════════════════════════════════════════════════════════════════════
//
// Los textos son obligación LEGAL (CC-BY 4.0 del IGN, Ley 37/2007 RISP del
// Catastro, ODbL de OSM), así que se comparan por IDENTIDAD DE REFERENCIA con el
// valor de `viewer/atribucion.js` que declara el descriptor de la capa activa —
// nunca con un `toContain('Catastro')`, que dejaría pasar una paráfrasis
// («(c) Direccion General del Catastro») y con ella un incumplimiento.
//
// Se lee `innerHTML` y no `textContent` porque el texto de OSM incluye el ENLACE
// a la licencia ODbL que el spec exige («con enlace»): `textContent` se comería
// el `<a href…>` y la comparación exacta sería imposible de escribir.
describe('F03 · AC5 · la atribución aparece en el visor', () => {
  const controlDe = (contenedor) => contenedor.querySelector('.leaflet-control-attribution')

  it('"la atribución APARECE EN EL VISOR": el control está en el contenedor y muestra el texto EXACTO de la base activa', () => {
    const { contenedor, visor } = abrirVisor()

    const control = controlDe(contenedor)
    expect(control, 'el visor debe montar el control de atribución de Leaflet').not.toBeNull()

    // La atribución esperada se DERIVA de la base que el visor tenga activa.
    const esperada = descriptorPorId(visor.capas.baseActiva()).atribucion
    expect(
      Object.values(ATRIBUCION),
      'el texto de la capa debe salir de viewer/atribucion.js, no estar escrito a mano',
    ).toContain(esperada)
    expect(control.innerHTML, `falta la atribución literal «${esperada}»`).toContain(esperada)
  })

  it('(a) al conmutar de base aparece la atribución de la nueva y DESAPARECE la de la anterior', () => {
    const { contenedor, visor } = abrirVisor()
    const control = controlDe(contenedor)

    const anterior = descriptorPorId(visor.capas.baseActiva()).atribucion
    visor.capas.activarBase(ID_CAPA.OSM)
    const ahora = descriptorPorId(ID_CAPA.OSM).atribucion

    expect(ahora, 'dos bases distintas, dos titulares distintos').not.toBe(anterior)
    expect(control.innerHTML, `falta la atribución de la base activa: «${ahora}»`).toContain(ahora)
    // Atribuir cartografía que ya no está en pantalla sería igual de incorrecto
    // que no atribuir la que sí está.
    expect(
      control.innerHTML,
      'la atribución de una capa retirada no debe seguir en el visor',
    ).not.toContain(anterior)
    // OSM exige mención CON ENLACE a la licencia (ODbL): el enlace está vivo.
    expect(control.querySelector('a[href*="openstreetmap"]')).not.toBeNull()
  })

  it('(b) con la base «Blanco» NO aparece ninguno de los cuatro textos, y eso es CORRECTO', () => {
    // NO ES UN OLVIDO NI UN BUG. La atribución es una obligación legal sobre
    // DATOS DE TERCEROS, y «Blanco» no muestra datos de nadie: es un
    // `L.GridLayer` que pinta píxeles blancos generados en el cliente, sin
    // imagen, sin geometría y sin topónimos. No existe titular al que citar, así
    // que su `atribucion` es la cadena vacía (`L.Control.Attribution` ignora las
    // cadenas vacías) y el visor no muestra ninguna. Poner ahí un texto sería
    // inventarse una cesión que no ha ocurrido. Por eso `ATRIBUCION` no tiene ni
    // debe tener una clave `BLANCO`.
    const { contenedor, visor } = abrirVisor()
    const control = controlDe(contenedor)

    visor.capas.activarBase(ID_CAPA.BLANCO)

    expect(descriptorPorId(ID_CAPA.BLANCO).atribucion, '«Blanco» no atribuye a nadie').toBe('')
    // Los CUATRO textos legales del proyecto, derivados de `ATRIBUCION`.
    expect(Object.keys(ATRIBUCION), 'los cuatro titulares del spec').toHaveLength(4)
    for (const texto of Object.values(ATRIBUCION)) {
      expect(
        control.innerHTML,
        `«Blanco» no muestra cartografía de terceros: no debe citar «${texto}»`,
      ).not.toContain(texto)
    }
    // El control SIGUE en el visor (no se desmonta): en cuanto vuelva una capa
    // con datos de terceros, su atribución aparece sin que nadie haga nada.
    expect(control.isConnected, 'el control de atribución no desaparece del visor').toBe(true)
  })
})

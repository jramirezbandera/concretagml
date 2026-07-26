// test/viewer/_ayuda-jsdom.js — F03 · Tarea 2A.3 (arnés de test compartido del visor).
//
// PROBLEMA: bajo jsdom, un <div> recién creado (o cualquier elemento sin un
// motor de layout real detrás) tiene `clientWidth`/`clientHeight` === 0 — jsdom
// no calcula layout. Leaflet lee esas propiedades directamente en
// `Map#getSize()` (`leaflet-src.js`, ~línea 4009: `this._container.clientWidth
// || 0`), así que con tamaño 0:
//   - `map.getSize()` da `(0, 0)`.
//   - `map.getBounds()` DEGENERA: noreste === suroeste (un único punto), porque
//     Leaflet proyecta el encuadre a partir del tamaño en píxeles del mapa.
//   - Cualquier capa que derive un BBOX del encuadre (la capa WMS de la Fase
//     2B) recibiría un BBOX sin sentido, y ese test — el más importante de la
//     fase — sería imposible de escribir.
//
// SOLUCIÓN — `crearContenedor`:
//   - Redefine `clientWidth`/`clientHeight` (y también `offsetWidth`/
//     `offsetHeight`, que Leaflet consulta en `DomUtil.getScale` /
//     `getSizedParentNode`) con `Object.defineProperty`, porque en jsdom esas
//     propiedades son de solo lectura y no se pueden asignar con `=`.
//   - Sobrescribe `getBoundingClientRect()` para que devuelva un rect
//     coherente con esas mismas dimensiones (Leaflet lo usa en `getScale` para
//     detectar zoom CSS aplicado externamente).
//   - Añade el contenedor a `document.body` (Leaflet exige que el contenedor
//     esté en el documento; si no, algunos cálculos de `getSizedParentNode`
//     recorrerían `parentNode` hasta `null`).
//
// SOLUCIÓN — `montarMapa`: además del contenedor, desactiva TODAS las
// animaciones de Leaflet (`zoomAnimation`, `fadeAnimation`,
// `markerZoomAnimation`, `inertia`). Son transiciones CSS (`transitionend`) que
// jsdom nunca resuelve: sin desactivarlas, ciertas operaciones (p.ej. `setView`
// con zoom distinto, o `dragend` con inercia) dejan el test colgado esperando
// un evento que Leaflet solo dispara al final de una transición que no llega
// a ocurrir nunca en jsdom.
//
// SOLUCIÓN — `crearPanes`: los tres panes del visor sobre un mapa ya montado.
// Estaba reimplementado a mano en el test de `viewer/sincronizacion.js`; ahora es
// del arnés (hallazgo 2.12 de la auditoría de coherencia 2C.2), derivado de
// `PANES`, para que un cambio en `viewer/_comun.js#PANES` no deje ningún test en
// verde con panes viejos.
//
// SOLUCIÓN — `espiarPeticiones`: envuelve `globalThis.Image` para contar las
// peticiones reales al WMS del Catastro (criterio de aceptación 2). Estaba
// copiado íntegro en TRES suites (`wms-catastro`, `capas`, `index`); se centraliza
// aquí por el mismo motivo que `crearPanes` (auditoría de cierre de la fase 3).
//
// Este módulo es la BASE de todos los tests `*.dom.test.js` de la Fase 2B
// (`services/ign.js`, `viewer/wms-catastro.js`, `viewer/mapa.js`,
// `viewer/sincronizacion.js`). El propio arnés se comprueba en
// `ayuda-jsdom.dom.test.js`. Cada test usa las piezas que le sirven: el de
// `viewer/mapa.js` solo `crearContenedor` (porque `crearMapa` ES la función bajo
// prueba y `montarMapa` crea su propio `L.map`); el de `viewer/sincronizacion.js`,
// `montarMapa` + `crearPanes` + `parcelaConHueco`.
//
// Convención de nombre: el prefijo `_` sigue `parsers/_comun.js` /
// `validation/_comun.js` — módulo de APOYO, no una suite (no lleva
// `.test.js`, Vitest no lo recoge como fichero de test).

import L from 'leaflet'
import { crearParcela, crearRecinto, TIPO_RECINTO } from '../../model/parcela.js'
import { PANES, vertUTMaLatLng } from '../../viewer/_comun.js'

// Huso/SRS de la parcela de demo: el mismo que test/fixtures/geo/parcela-ring.json
// (Península, huso 30 — EPSG:25830). Se usa tanto para construir la parcela como
// para centrar el mapa por defecto sobre ella.
const SRS_DEMO = 'EPSG:25830'
const HUSO_DEMO = 30

// Exterior de ~20×15 m (Este×Norte) en el entorno del fixture F00
// (referencePoint [439250.35, 4479664.55]). Anillo ABIERTO (crearRecinto lo
// exige normalizado así; si llegara cerrado, lo normalizaría con un aviso).
const EXTERIOR_DEMO_UTM = [
  [439240, 4479655],
  [439260, 4479655],
  [439260, 4479670],
  [439240, 4479670],
]

// Hueco de 4×4 m, claramente contenido dentro del exterior anterior (margen
// ≥ 4 m por cada lado).
const HUECO_DEMO_UTM = [
  [439248, 4479660],
  [439252, 4479660],
  [439252, 4479664],
  [439248, 4479664],
]

// Centroide del exterior (para centrar el mapa de demo por defecto).
const CENTROIDE_DEMO_UTM = [439250, 4479662.5]

/**
 * Div en document.body con clientWidth/clientHeight REALES bajo jsdom (ver
 * cabecera del módulo). También fija offsetWidth/offsetHeight y
 * getBoundingClientRect() de forma coherente.
 *
 * @param {object} [opciones]
 * @param {number} [opciones.ancho=800]  Ancho deseado, en px CSS.
 * @param {number} [opciones.alto=600]   Alto deseado, en px CSS.
 * @returns {HTMLDivElement}  Elemento ya insertado en document.body.
 */
export function crearContenedor({ ancho = 800, alto = 600 } = {}) {
  const contenedor = document.createElement('div')

  for (const prop of ['clientWidth', 'offsetWidth']) {
    Object.defineProperty(contenedor, prop, { value: ancho, configurable: true })
  }
  for (const prop of ['clientHeight', 'offsetHeight']) {
    Object.defineProperty(contenedor, prop, { value: alto, configurable: true })
  }

  contenedor.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: ancho,
    bottom: alto,
    width: ancho,
    height: alto,
    toJSON() {
      return this
    },
  })

  document.body.appendChild(contenedor)
  return contenedor
}

/**
 * Mapa Leaflet listo para test: contenedor con tamaño real (crearContenedor) +
 * animaciones desactivadas (ver cabecera del módulo). Centra la vista por
 * defecto sobre el centroide de `parcelaConHueco()`, a un zoom de escala de
 * parcela.
 *
 * @param {object} [opciones]
 * @param {number} [opciones.ancho=800]              Ancho del contenedor, px.
 * @param {number} [opciones.alto=600]                Alto del contenedor, px.
 * @param {[number, number]} [opciones.centro]        `[lat, lng]`; por defecto
 *   el centroide de la parcela de demo (huso 30).
 * @param {number} [opciones.zoom=18]                  Zoom inicial.
 * @param {object} [opcionesLeaflet]  Resto de opciones, pasadas a `L.map`
 *   (se combinan con las animaciones desactivadas; pueden sobrescribirlas si
 *   un test necesita lo contrario).
 * @returns {{ mapa: import('leaflet').Map, contenedor: HTMLDivElement, destruir: () => void }}
 */
export function montarMapa({ ancho, alto, centro, zoom = 18, ...opcionesLeaflet } = {}) {
  const contenedor = crearContenedor({ ancho, alto })
  const centroDefecto = vertUTMaLatLng(CENTROIDE_DEMO_UTM, HUSO_DEMO)

  const mapa = L.map(contenedor, {
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    inertia: false,
    ...opcionesLeaflet,
  })
  mapa.setView(centro ?? centroDefecto, zoom)

  const destruir = () => {
    mapa.remove()
    contenedor.remove()
  }

  return { mapa, contenedor, destruir }
}

/**
 * Los tres panes del visor sobre un mapa ya montado, con su `zIndex` aplicado al
 * estilo (Leaflet NO asigna zIndex a un pane custom por sí solo).
 *
 * Vive AQUÍ y no en cada test (hallazgo 2.12 de la auditoría de coherencia): el
 * bucle estaba duplicado —una copia en `viewer/mapa.js`, que es producción, y otra
 * reimplementada a mano en `test/viewer/sincronizacion.dom.test.js` para no
 * acoplarse a otra tarea de la fase—, así que si `PANES` cambiaba, ese test seguía
 * en verde con panes viejos. Ahora la copia del test es esta, y se deriva de
 * `PANES` igual que la de producción.
 *
 * No sustituye a `viewer/mapa.js#crearMapa`: es para los tests de módulos que dan
 * por hecho un mapa YA montado con sus panes (`viewer/sincronizacion.js`) y que no
 * deben depender del módulo del mapa para montarlos.
 *
 * @param {import('leaflet').Map} mapa  Mapa ya creado (p. ej. de {@link montarMapa}).
 * @returns {Record<string, HTMLElement>}  Panes indexados por nombre canónico.
 */
export function crearPanes(mapa) {
  const panes = {}
  for (const { nombre, zIndex } of PANES) {
    const pane = mapa.createPane(nombre)
    pane.style.zIndex = String(zIndex)
    panes[nombre] = pane
  }
  return panes
}

/**
 * POJO de parcela con exterior + 1 hueco, EPSG:25830 (huso 30). Construida
 * con `model/parcela.js` (`crearParcela` + `crearRecinto`), NO a mano: así el
 * arnés respeta los invariantes del modelo (anillos abiertos, copia
 * defensiva, `recintos[0]` EXTERIOR) por construcción, no por convención.
 *
 * `crearParcela` no porta `srs` (eso vive en el Expediente, no en la Parcela;
 * ver model/parcela.js#crearExpediente) pero los cuatro módulos que consumen
 * este arnés (services/ign, viewer/wms-catastro, viewer/mapa,
 * viewer/sincronizacion) necesitan saber en qué huso/SRS está la geometría de
 * demo para proyectar UTM↔lat/lon; por eso se decoran `srs` y `huso` sobre el
 * POJO devuelto. Sigue siendo un POJO plano (solo strings/numbers/arrays) y
 * por tanto `structuredClone`-able.
 *
 * @returns {object} Parcela + `{srs, huso}` (ver model/parcela.js#crearParcela)
 */
export function parcelaConHueco() {
  const exterior = crearRecinto(EXTERIOR_DEMO_UTM, TIPO_RECINTO.EXTERIOR)
  const hueco = crearRecinto(HUECO_DEMO_UTM, TIPO_RECINTO.HUECO)

  const parcela = crearParcela({
    idLocal: 'demo-ayuda-jsdom',
    origen: 'LIST',
    recintos: [exterior, hueco],
  })

  return { ...parcela, srs: SRS_DEMO, huso: HUSO_DEMO }
}

/**
 * jsdom no descarga imágenes (un `<img src="...">` nunca dispara `load` ni
 * `error` de forma natural): emite el evento correspondiente a mano.
 * Permite simular carga, error, y CARRERAS (una respuesta lenta antigua que
 * llega después de una más nueva) en los tests de la capa WMS de la Fase 2B.
 *
 * @param {HTMLImageElement} img
 * @param {object} [opciones]
 * @param {boolean} [opciones.error=false]  Si true, emite `error` en vez de `load`.
 */
export function dispararCarga(img, { error = false } = {}) {
  img.dispatchEvent(new Event(error ? 'error' : 'load'))
}

/** Cede el hilo un tick (deja correr microtasks/macrotasks pendientes). */
export const esperarCiclo = () => new Promise((r) => setTimeout(r, 0))

/**
 * Envuelve `globalThis.Image` para CONTAR e inspeccionar cada petición emitida.
 *
 * Es la pieza que hace medible el CRITERIO DE ACEPTACIÓN 2 de F03 («el WMS del
 * Catastro se pide una vez por encuadre, nunca en mosaico»):
 * `viewer/wms-catastro.js` precarga cada imagen en un `new Image()` desprendido,
 * así que envolver el constructor da el número EXACTO de peticiones al Catastro.
 * La imagen VISIBLE la crea Leaflet con `document.createElement('img')` y solo
 * recibe URLs ya cargadas, por lo que no entra en la cuenta: es justo la
 * distinción que se quiere medir.
 *
 * Se usa una función-fábrica (no una subclase) para no depender de cómo jsdom
 * implemente el constructor `Image`.
 *
 * Vive AQUÍ y no en cada test (auditoría de cierre de la fase 3, punto 9):
 * estaba copiado íntegro en `wms-catastro.dom.test.js`, `capas.dom.test.js` e
 * `index.dom.test.js`, que es exactamente el motivo por el que `crearPanes` se
 * movió a este arnés en la fase 2.
 *
 * **`restaurar()` es del llamante**: este módulo no conoce el `afterEach` ni la
 * pila de limpieza de cada suite, así que devuelve el mando y cada test lo
 * registra donde le corresponda. Sin restaurar, el `globalThis.Image` envuelto
 * se filtraría al resto de tests del fichero.
 *
 * @returns {{imagenes: HTMLImageElement[], total: number,
 *            urls: () => (string|null)[], ultima: () => HTMLImageElement|undefined,
 *            restaurar: () => void}}
 */
export function espiarPeticiones() {
  const ImagenOriginal = globalThis.Image
  const imagenes = []
  globalThis.Image = function ImagenEspia() {
    const img = new ImagenOriginal()
    imagenes.push(img)
    return img
  }
  return {
    imagenes,
    get total() {
      return imagenes.length
    },
    urls: () => imagenes.map((img) => img.getAttribute('src')),
    ultima: () => imagenes[imagenes.length - 1],
    restaurar() {
      globalThis.Image = ImagenOriginal
    },
  }
}

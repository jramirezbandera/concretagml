// viewer/wms-catastro.js — F03 · Tarea 2B.2. Cartografía del Catastro POR ENCUADRE.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ POR QUÉ ESTE MÓDULO NO TESELA — la restricción más importante del        ║
// ║ proyecto. El WMS `ServidorWMS.aspx` RASTERIZA la imagen en cada          ║
// ║ petición (no sirve teselas pregeneradas) y la DGC desaconseja            ║
// ║ oficialmente el uso en mosaico: "un visor mal diseñado lanza hasta 30    ║
// ║ consultas por pantalla" (dossier §2.3/§2.5). La penalización por abuso   ║
// ║ es denegación de servicio ~10 días, con detección de rotación de IP/UA.  ║
// ║ Teselar este servicio es EL mayor riesgo de bloqueo del proyecto.        ║
// ║ Por eso aquí NO se usa `L.tileLayer.wms` NUNCA: se gestiona un único     ║
// ║ `L.ImageOverlay` = UNA imagen del viewport = UNA petición por encuadre   ║
// ║ (criterio de aceptación 2 de F03, medible en el nº de peticiones).       ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// Decisiones deliberadas de este módulo (cada una con su razón; no cambiar sin
// leerlas):
//
// 1) WMS **1.1.1 con `SRS=`**, no 1.3.0 con `CRS=`. En 1.1.1 el orden de ejes de
//    un CRS proyectado es SIEMPRE X,Y, que es justo la garantía que se busca
//    (en 1.3.0 el orden depende del CRS y reaparece la trampa lat/lon).
//    VERIFICADO el 2026-07-26 contra el servicio real, y resulta ser
//    **OBLIGATORIO**, no una preferencia (ver hecho (a) más abajo).
//
// 2) Se escucha **`moveend` + `resize`, y NO `zoomend`**. El plan original decía
//    `moveend`+`zoomend`, pero Leaflet emite AMBOS en cada zoom
//    (`Map#_moveEnd(zoomChanged)`: `fire('zoomend')` y después `fire('moveend')`
//    — leaflet-src.js 1.9.4 ~línea 4357). `moveend` cubre pan y zoom por igual,
//    porque en ambos casos cambian centro/zoom y Leaflet pasa por `_moveEnd`.
//    Verificado empíricamente por partida doble en
//    `test/viewer/wms-catastro.dom.test.js`: (a) un solo `setZoom` deja la traza
//    `['zoomend','moveend']`; (b) por MUTACIÓN de este módulo (añadir
//    `eventos.zoomend` y desactivar la deduplicación del punto 3 a la vez), un
//    zoom pasa a emitir **2 peticiones** en vez de 1 → el criterio 2 se rompe.
//    Matiz honesto medido en esa misma mutación: con la deduplicación puesta,
//    suscribir también `zoomend` NO duplicaría (en `zoomend` el encuadre ya es el
//    nuevo, así que ambos eventos calculan la MISMA URL y la segunda se
//    deduplica). Son dos defensas independientes; suscribir solo `moveend` es la
//    primera y hace que el criterio no DEPENDA de la segunda.
//    `resize` se escucha porque `invalidateSize()` cambia el tamaño de la imagen
//    pedida; y como `invalidateSize` emite `moveend` Y `resize` (en ese orden, ya
//    con el tamaño nuevo), aquí sí es la deduplicación la que evita la doble.
//
// 3) **Deduplicación por URL:** si la URL recién calculada es idéntica a la
//    última pedida, no se lanza petición. Un `moveend` que no mueve el mapa
//    (Leaflet lo emite igual: `panBy` con desplazamiento 0 hace
//    `return this.fire('moveend')`) cuesta 0 peticiones.
//
// 4) **Token de secuencia anti-carrera** (hallazgo C9/T5 de la review): cada
//    petición captura un número de un contador monótono. Al resolverse una
//    carga, si su número no es el último emitido, se descarta para la imagen
//    (sí se contabiliza en `estado()`). Una respuesta lenta de un encuadre viejo
//    NUNCA puede pisar una imagen más nueva.
//
// 5) **La imagen previa se mantiene hasta que la nueva ha cargado.**
//    `ImageOverlay#setUrl` asigna `src` sobre la imagen VISIBLE y deja el hueco
//    en blanco mientras descarga. Por eso se precarga en un `new Image()`
//    desprendido (con `crossOrigin='anonymous'` ANTES de `src`, regla CORS del
//    dossier §4.4) y solo en su `load` se hace `setBounds`+`setUrl` sobre el
//    overlay visible: la imagen ya está en la caché del navegador, así que el
//    intercambio es inmediato y no genera una segunda petición de red.
//
// 6) **Error de carga → aviso, jamás silencio** (regla de oro 1; hallazgo T3 de
//    la review). Nivel `NIVEL.AVISO`, NO ERROR: es cartografía de FONDO que no
//    carga, el mismo suceso que un `tileerror` del IGN, y no bloquea la
//    generación del GML (la regla completa está junto al typedef `Avisar` de
//    `viewer/_comun.js`). Y se distingue en el mensaje "no hay cartografía
//    cargada" de "se sigue mostrando la del encuadre anterior (obsoleta)": para
//    el usuario son dos situaciones distintas. Excepción razonada: el fallo de una petición
//    ya SUPERADA por otra más nueva se contabiliza pero no se anuncia (avisar de
//    un encuadre que ya nadie está mirando sería una falsa alarma; la petición
//    vigente reportará su propio resultado).
//
// 7) `getMapUrl` es **agnóstica de CRS a propósito**: recibe el BBOX ya en las
//    unidades del CRS pedido y no proyecta nada. La capa la usa con
//    `EPSG:3857` (el CRS del mapa de Leaflet, para que la imagen encaje píxel a
//    píxel con el lienzo), y F09 reutilizará LA MISMA función con `EPSG:25830`
//    para el plano a 300 ppp del informe (dossier §4.4, receta A, paso 4).
//
// 8) **Una única constante base**, `CATASTRO_WMS` (dossier §2.4): si algún día
//    retiran CORS, se apunta a un proxy en un solo sitio y el resto del código
//    no se entera. Hoy CORS está VERIFICADO (`ACAO:*`, y la imagen con
//    `crossOrigin='anonymous'` NO contamina el canvas — dossier §0.6, override
//    O7), lo que además habilita el plano del informe.
//
// 9) **Doble uso con la misma factory:** base opaca (`pane:'tilePane'`,
//    opacidad 1, `transparente:false`) y superpuesta translúcida
//    (`pane:'overlayPane'`, opacidad regulable, `transparente:true`). El
//    criterio real es **1 petición por INSTANCIA VISIBLE**: con base y
//    superpuesta activas a la vez son 2 peticiones por encuadre, y eso es lo
//    esperado, no un fallo (son dos imágenes distintas: opaca y con
//    transparencia).
//
// HECHOS VERIFICADOS CONTRA EL SERVICIO REAL — banco de pruebas 2D.1, medido el
// **2026-07-26** en navegador real (`GetCapabilities` + `GetMap` reales). Lo que
// hasta esa fecha era una lista de SUPUESTOS es ahora una lista de hechos, con su
// evidencia. Los siete supuestos originales quedaron CONFIRMADOS y ninguno obligó
// a cambiar el diálogo con el servicio; el único cambio de código que salió del
// banco es la guarda de tamaño del punto (f):
//   a) **`VERSION=1.1.1` + `SRS=` es obligatorio, no una preferencia.** El
//      servidor declara `<WMT_MS_Capabilities version="1.1.1">`;
//      `VERSION=1.3.0&CRS=EPSG:3857` devuelve `ServiceException
//      code="InvalidFormat"` con `SRS () Invalido` — o sea que **no lee `CRS=` en
//      absoluto**; y `VERSION=1.3.0&SRS=…` sí sirve el PNG, o sea que **ignora
//      `VERSION`**. Pedirle el Capabilities en 1.3.0 devuelve el documento 1.1.1
//      byte a byte (28799 B en ambos casos). Lo que manda es `SRS=`.
//   b) **`EPSG:3857` está anunciado Y bien georreferenciado.** El `<Layer>` raíz
//      declara `<SRS>EPSG:3785</SRS>` y `<SRS>EPSG:3857</SRS>` más un
//      `<BoundingBox SRS="EPSG:3857" …>`; en 1.1.1 el SRS del Layer raíz se
//      HEREDA y las seis capas son hijas directas. Superponiendo la catastral
//      translúcida sobre la WMTS `ign-base` (rejilla `GoogleMapsCompatible`
//      canónica de 3857), los linderos trazan sobre las huellas de edificio, los
//      bordes de calzada y el cruce en Y del IGN con concordancia SUBMÉTRICA.
//   c) **`FORMAT=image/png`**: `Content-Type: image/png`, PNG 900×600 RGBA.
//   d) **`TRANSPARENT=TRUE|FALSE` se honra**: salidas distintas y comprobables
//      (RGBA de 77795 B vs colormap de 41703 B).
//   e) **Capas en minúscula y las seis en una sola petición.** El Capabilities
//      las declara con OTRA capitalización (`Catastro, CONSTRU, MASA, SUBPARCE,
//      TEXTOS, LIMITES`), pero el servidor es INSENSIBLE a mayúsculas: ambas
//      formas devuelven imágenes de 77795 B idénticos. Las seis combinan en una
//      sola petición, como se pide aquí.
//   f) **Techo silencioso de 4000 px por eje** (era el supuesto "MaxWidth/
//      MaxHeight"): ver {@link MAX_PIXELES_WMS}. El servicio NO declara esos
//      elementos (WMS 1.1.1 no los tiene) y recorta EN SILENCIO.
//   g) **El error es un `ServiceException` XML, nunca una imagen**:
//      `<ServiceExceptionReport version="1.1.1">` con `Content-Type: text/xml;
//      charset=iso-8859-1`, y en navegador real los cuatro casos de error
//      disparan el `onerror` del `<img>`. MATIZ IMPORTANTE Y NO OBVIO: el
//      servidor responde **HTTP 200**, no 4xx — el `error` salta porque un cuerpo
//      `text/xml` no es una imagen decodificable, NO por el código de estado. La
//      ruta de aviso del punto 6 funciona, pero depende de eso: si algún día el
//      servicio devolviera un PNG con el texto del error dentro, el `onerror` no
//      se dispararía y el aviso no llegaría nunca.
//   h) **Criterio de aceptación 2, verificado EN VIVO** (no solo en jsdom): 4
//      peticiones `GetMap` para 4 encuadres (carga, pan, dos zooms), todas con
//      `WIDTH=900&HEIGHT=600` y cuatro BBOX distintos; un pan nulo cuesta **0**
//      peticiones (deduplicación del punto 3); **cero** peticiones con
//      `WIDTH=256` (ni rastro de mosaico). Todas HTTP 200 con
//      `Access-Control-Allow-Origin: *`, y el canvas quedó **CLEAN**
//      (`toDataURL` y `getImageData` sin `SecurityError`): reconfirma el override
//      O7 en vivo y hace viable la receta del plano a 300 ppp de F09.
//
// Este módulo IMPORTA LEAFLET → es SOLO-NAVEGADOR: su test es `*.dom.test.js` y
// NO entra en el barrel raíz `index.js` (rompería la suite `node`; ver la nota
// de `viewer/_comun.js`). Tampoco importa `leaflet/dist/leaflet.css`.

import L from 'leaflet'
import { ATRIBUCION } from './atribucion.js'
import { NIVEL, resolverAvisar } from './_comun.js'

// ── Constantes del servicio ───────────────────────────────────────────────────

/**
 * Endpoint ÚNICO del WMS por capas del Catastro (dossier §2.1). Punto único de
 * contingencia CORS (§2.4): nadie más debe escribir esta URL.
 */
export const CATASTRO_WMS = 'https://ovc.catastro.meh.es/Cartografia/WMS/ServidorWMS.aspx'

/**
 * Versión de WMS que se pide. 1.1.1 → el parámetro del CRS se llama `SRS` y el
 * orden de ejes de un CRS proyectado es siempre X,Y (ver decisión 1 de la
 * cabecera). VERIFICADA el 2026-07-26 contra el servicio real: lo que el
 * servidor lee de verdad es `SRS=` (con `CRS=` responde `SRS () Invalido`), y
 * declara `<WMT_MS_Capabilities version="1.1.1">`. No es negociable; si algún
 * día lo fuera, se cambia aquí y solo aquí (la versión no está cableada en
 * ningún otro sitio).
 */
export const VERSION_WMS = '1.1.1'

/** CRS del mapa de Leaflet: el único que la CAPA sabe proyectar por sí sola. */
export const CRS_MAPA = 'EPSG:3857'

/** Capas del WMS catastral que pide el visor (spec F03 §"WMS del Catastro"). */
export const CAPAS_DEFECTO = Object.freeze([
  'catastro',
  'constru',
  'masa',
  'subparce',
  'textos',
  'limites',
])

/** Formato de imagen por defecto (PNG: admite transparencia para la superpuesta). */
export const FORMATO_DEFECTO = 'image/png'

/**
 * **Techo duro de tamaño de imagen del WMS del Catastro: 4000 px por eje.**
 *
 * MEDIDO el 2026-07-26 contra el servicio real (banco 2D.1): el servidor recorta
 * EN SILENCIO y devuelve siempre HTTP 200 con un PNG válido de otro tamaño.
 * `WIDTH=4001&HEIGHT=100` devolvió un PNG de **4000×2000** (¡recorta y además
 * reescala el otro eje!); `5000²`, `8000²` y `10000²` devolvieron todos
 * **4000×4000**. El servicio **no declara** el límite: WMS 1.1.1 no tiene los
 * elementos `MaxWidth`/`MaxHeight` del 1.3.0, así que no hay forma de leerlo del
 * Capabilities — solo midiéndolo.
 *
 * Por qué {@link getMapUrl} LANZA al superarlo (regla de oro 1): sin esta guarda,
 * `getMapUrl` construía sin objeción un `WIDTH=6000` y el llamante recibía una
 * imagen de otro tamaño **sin enterarse** — un boquete en la regla 1 (error
 * silencioso) y, peor, una imagen con otra escala de la que el llamante cree. En
 * el visor no se dispara nunca (el tamaño es el del lienzo), pero **F09 pide 2126
 * px de ancho para un plano de 180 mm a 300 ppp y podría pedir más** en formatos
 * grandes. Como el tamaño lo ELIGE el programador (no el usuario), la política
 * del proyecto es `throw`: F09 debe trocear el plano en varias peticiones o
 * reducir el tamaño DELIBERADAMENTE, no descubrir el recorte por accidente.
 */
export const MAX_PIXELES_WMS = 4000

/** Opacidad por defecto de la instancia superpuesta (la Fase 3 la regula en vivo). */
export const OPACIDAD_SUPERPUESTA = 0.6

/**
 * Mensajes de usuario del módulo (español, mostrables tal cual). Exportados para
 * que la UI de avisos de Fase 3/4 y los tests los referencien en vez de
 * parafrasearlos. Distinguen las dos situaciones del punto 6 de la cabecera.
 */
export const MENSAJES = Object.freeze({
  SIN_CARTOGRAFIA:
    'No se ha podido cargar la cartografía catastral del Catastro; el mapa se muestra sin ella.',
  OBSOLETA:
    'No se ha podido actualizar la cartografía catastral del Catastro; se sigue mostrando ' +
    'la del encuadre anterior (obsoleta).',
})

// Decimales con los que se serializan las coordenadas del BBOX. 3 decimales =
// 1 mm, muy por debajo de cualquier tamaño de píxel del visor (y del cm
// catastral): no se pierde nada y las URLs quedan legibles y comparables (lo que
// además favorece los aciertos de la caché HTTP del navegador → menos peticiones
// al Catastro, que es la misión de este módulo).
const DECIMALES_COORD = 3

// Placeholder de Leaflet para la imagen del overlay ANTES de la primera carga:
// un GIF 1×1 transparente embebido como `data:` URI → CERO peticiones de red.
// El overlay debe tener un `src` desde su creación (`ImageOverlay#_initImage`);
// con esto la primera imagen real no llega nunca de un `src` vacío (que en un
// navegador resolvería a la propia página y sí generaría una petición).
const IMAGEN_VACIA = L.Util.emptyImageUrl

// ── getMapUrl — función pura, agnóstica de CRS ────────────────────────────────

/**
 * BBOX ya expresado en las unidades del CRS que se va a pedir, en orden X,Y.
 * @typedef {Object} BBoxProyectado
 * @property {number} minX  Xmin (Este mínimo).
 * @property {number} minY  Ymin (Norte mínimo).
 * @property {number} maxX  Xmax (Este máximo).
 * @property {number} maxY  Ymax (Norte máximo).
 */

/**
 * @typedef {Object} TamanoImagen
 * @property {number} ancho  Ancho de la imagen en píxeles (> 0).
 * @property {number} alto   Alto de la imagen en píxeles (> 0).
 */

/**
 * Construye la URL de un `GetMap` del WMS del Catastro. **No proyecta nada** y
 * **nunca reordena ejes**: el `bbox` llega ya en las unidades del CRS pedido y
 * en orden X,Y (dossier §2.5: 25830/25829/25831/3857 → `Xmin,Ymin,Xmax,Ymax`,
 * sin invertir; 4326/4258 van lat,lon y quien los use debe invertir ANTES de
 * llamar aquí — por eso este módulo no los admite: `validarCRS` no lo impide,
 * pero la responsabilidad del orden es del llamante).
 *
 * Los valores se concatenan SIN percent-encoding en `:` `,` y `/` (caracteres
 * legales en un query string, RFC 3986) para que la URL sea literalmente de la
 * misma forma que el único ejemplo verificado del dossier §2.2.
 *
 * @param {BBoxProyectado} bbox   BBOX YA en unidades del CRS pedido.
 * @param {TamanoImagen} tamano   Tamaño de la imagen en píxeles. Ningún eje puede
 *   superar {@link MAX_PIXELES_WMS} (techo silencioso del servicio: se lanza en
 *   vez de recibir una imagen de otro tamaño sin saberlo).
 * @param {object} [opts]
 * @param {string} [opts.crs='EPSG:3857']       CRS pedido (forma WMS `EPSG:nnnnn`).
 * @param {string[]} [opts.capas=CAPAS_DEFECTO] Capas del WMS, en orden de dibujo.
 * @param {string} [opts.formato='image/png']   `FORMAT` del GetMap.
 * @param {boolean} [opts.transparente=false]   `TRANSPARENT=TRUE|FALSE`.
 * @returns {string}  URL absoluta lista para `img.src`.
 * @throws {TypeError|RangeError}  Contrato roto por el programador (regla de oro
 *   1: aquí no hay dato de usuario que avisar, hay un bug que hay que ver).
 */
export function getMapUrl(bbox, tamano, opts = {}) {
  if (opts === null || typeof opts !== 'object') {
    throw new TypeError(`getMapUrl: 'opts' debe ser un objeto; recibido ${typeof opts}.`)
  }
  const {
    crs = CRS_MAPA,
    capas = CAPAS_DEFECTO,
    formato = FORMATO_DEFECTO,
    transparente = false,
  } = opts

  const { minX, minY, maxX, maxY } = validarBBox(bbox)
  const { ancho, alto } = validarTamano(tamano)
  validarCRS(crs)
  const capasValidas = validarCapas(capas)
  validarFormato(formato)

  const partes = [
    'SERVICE=WMS',
    `VERSION=${VERSION_WMS}`,
    'REQUEST=GetMap',
    `SRS=${crs}`,
    `BBOX=${[minX, minY, maxX, maxY].map(formatearCoord).join(',')}`,
    `WIDTH=${ancho}`,
    `HEIGHT=${alto}`,
    `FORMAT=${formato}`,
    `TRANSPARENT=${transparente ? 'TRUE' : 'FALSE'}`,
    `LAYERS=${capasValidas.join(',')}`,
    // STYLES es OBLIGATORIO en WMS aunque vaya vacío (= estilo por defecto de
    // cada capa). Omitirlo es una de las causas clásicas de ServiceException.
    'STYLES=',
  ]

  return `${CATASTRO_WMS}?${partes.join('&')}`
}

/** Coordenada → texto: recorta a 1 mm y quita ceros/exponentes innecesarios. */
function formatearCoord(valor) {
  const redondeado = Number(valor.toFixed(DECIMALES_COORD))
  return String(Object.is(redondeado, -0) ? 0 : redondeado)
}

/**
 * @param {*} bbox
 * @returns {BBoxProyectado}
 * @throws {TypeError|RangeError}
 */
function validarBBox(bbox) {
  if (bbox === null || typeof bbox !== 'object') {
    throw new TypeError(
      `getMapUrl: 'bbox' debe ser {minX,minY,maxX,maxY}; recibido ${typeof bbox}.`,
    )
  }
  for (const clave of ['minX', 'minY', 'maxX', 'maxY']) {
    if (typeof bbox[clave] !== 'number' || !Number.isFinite(bbox[clave])) {
      throw new TypeError(
        `getMapUrl: 'bbox.${clave}' debe ser un número finito; recibido ` +
          `${JSON.stringify(bbox[clave])}. BBOX completo: ${JSON.stringify(bbox)}.`,
      )
    }
  }
  if (bbox.minX >= bbox.maxX) {
    throw new RangeError(
      `getMapUrl: BBOX degenerado o invertido en X (minX=${bbox.minX} >= maxX=${bbox.maxX}). ` +
        'El BBOX va en orden Xmin,Ymin,Xmax,Ymax y en unidades del CRS (dossier §2.5).',
    )
  }
  if (bbox.minY >= bbox.maxY) {
    throw new RangeError(
      `getMapUrl: BBOX degenerado o invertido en Y (minY=${bbox.minY} >= maxY=${bbox.maxY}). ` +
        'El BBOX va en orden Xmin,Ymin,Xmax,Ymax y en unidades del CRS (dossier §2.5).',
    )
  }
  return { minX: bbox.minX, minY: bbox.minY, maxX: bbox.maxX, maxY: bbox.maxY }
}

/**
 * @param {*} tamano
 * @returns {{ancho:number, alto:number}}  Píxeles ENTEROS (WMS exige enteros en
 *   WIDTH/HEIGHT; redondear un contador de píxeles no altera ningún dato).
 * @throws {TypeError|RangeError}
 */
function validarTamano(tamano) {
  if (tamano === null || typeof tamano !== 'object') {
    throw new TypeError(
      `getMapUrl: 'tamano' debe ser {ancho,alto} en píxeles; recibido ${typeof tamano}.`,
    )
  }
  for (const clave of ['ancho', 'alto']) {
    if (typeof tamano[clave] !== 'number' || !Number.isFinite(tamano[clave])) {
      throw new TypeError(
        `getMapUrl: 'tamano.${clave}' debe ser un número finito; recibido ` +
          `${JSON.stringify(tamano[clave])}.`,
      )
    }
    if (tamano[clave] <= 0) {
      throw new RangeError(
        `getMapUrl: 'tamano.${clave}' debe ser > 0 píxeles; recibido ${tamano[clave]}.`,
      )
    }
    // Se compara el valor YA REDONDEADO: es el que va a viajar en WIDTH/HEIGHT,
    // y un 4000.4 no debe rechazarse por su parte decimal.
    if (Math.round(tamano[clave]) > MAX_PIXELES_WMS) {
      throw new RangeError(
        `getMapUrl: 'tamano.${clave}' = ${tamano[clave]} px supera el techo del servicio ` +
          `(${MAX_PIXELES_WMS} px por eje, medido el 2026-07-26). El WMS del Catastro NO ` +
          `declara ese límite y lo aplica EN SILENCIO: devolvería HTTP 200 con un PNG de ` +
          `otro tamaño y el llamante trabajaría con una escala equivocada sin enterarse ` +
          `(regla de oro 1). Trocea la imagen en varias peticiones o reduce el tamaño ` +
          `deliberadamente (F09, plano a 300 ppp).`,
      )
    }
  }
  return { ancho: Math.round(tamano.ancho), alto: Math.round(tamano.alto) }
}

/**
 * El CRS se escribe en la forma WMS `EPSG:nnnnn`. NO se acepta la forma URN/URI
 * del WFS (`urn:ogc:def:crs:EPSG::25830`, `http://www.opengis.net/def/crs/...`):
 * confundirlas es un error real y fácil, porque en este mismo proyecto el WFS y
 * el GML sí usan esas formas (overrides O2/O10).
 *
 * @param {*} crs
 * @throws {TypeError}
 */
function validarCRS(crs) {
  if (typeof crs !== 'string' || !/^EPSG:\d{4,6}$/.test(crs)) {
    throw new TypeError(
      `getMapUrl: 'crs' debe tener la forma WMS 'EPSG:nnnnn' (p. ej. 'EPSG:3857' o ` +
        `'EPSG:25830'); recibido ${JSON.stringify(crs)}. La forma URN/URI ` +
        `('urn:ogc:def:crs:EPSG::25830') es del WFS/GML, no del WMS.`,
    )
  }
}

/**
 * @param {*} capas
 * @returns {string[]}
 * @throws {TypeError}
 */
function validarCapas(capas) {
  if (!Array.isArray(capas) || capas.length === 0) {
    throw new TypeError(
      `getMapUrl: 'capas' debe ser un array NO vacío de nombres de capa; recibido ` +
        `${JSON.stringify(capas)}.`,
    )
  }
  for (const capa of capas) {
    if (typeof capa !== 'string' || capa.trim() === '' || capa.includes(',')) {
      throw new TypeError(
        `getMapUrl: cada capa debe ser un string no vacío y sin comas (la coma separa ` +
          `capas en LAYERS); recibido ${JSON.stringify(capa)}.`,
      )
    }
  }
  return capas.slice()
}

/**
 * @param {*} formato
 * @throws {TypeError}
 */
function validarFormato(formato) {
  if (typeof formato !== 'string' || formato.trim() === '') {
    throw new TypeError(
      `getMapUrl: 'formato' debe ser un string no vacío (p. ej. 'image/png'); recibido ` +
        `${JSON.stringify(formato)}.`,
    )
  }
}

// ── La capa: un único L.ImageOverlay gestionado por encuadre ──────────────────

/**
 * Contadores y estado de la capa, para la UI (Fase 3: rótulo "cartografía
 * obsoleta") y para los tests del criterio de aceptación 2.
 *
 * @typedef {Object} EstadoCapaWMS
 * @property {'base'|'overlay'} rol
 * @property {number} peticiones   Peticiones EMITIDAS (= imágenes precargadas).
 * @property {number} aplicadas    Cargas que llegaron a la imagen visible.
 * @property {number} cargadas     Cargas resueltas con éxito (aplicadas o no).
 * @property {number} descartadas  Resoluciones descartadas por el token de secuencia.
 * @property {number} fallidas     Cargas resueltas con error.
 * @property {boolean} hayCartografia  Hay al menos una imagen real visible.
 * @property {boolean} obsoleta    La imagen visible NO es del encuadre actual
 *   (última petición fallida con imagen previa en pantalla).
 */

const CapaWMSCatastro = L.ImageOverlay.extend({
  options: {
    // OJO con la precedencia: `options` del prototipo es la precedencia MÁS BAJA
    // de Leaflet. `crossOrigin` y `attribution` se re-afirman al final de
    // `initialize` con un `L.setOptions` explícito (hallazgo 2.3 de la auditoría
    // de coherencia); aquí están solo como valor de partida. Lo que se declare
    // aquí y no allí es negociable por el llamante.
    // Override O7 / criterio de aceptación 4: SIEMPRE anónimo, para que la
    // imagen no contamine el canvas del informe (F09).
    crossOrigin: 'anonymous',
    // Criterio de aceptación 5: el texto legal viene de viewer/atribucion.js,
    // nunca escrito a mano aquí.
    attribution: ATRIBUCION.CATASTRO,
    alt: 'Cartografía catastral del encuadre actual',
    interactive: false,
  },

  /**
   * @param {object} [opciones]  Ver {@link crearCapaWMSCatastro}.
   */
  initialize(opciones = {}) {
    if (opciones === null || typeof opciones !== 'object') {
      throw new TypeError(
        `crearCapaWMSCatastro: 'opts' debe ser un objeto; recibido ${typeof opciones}.`,
      )
    }
    const {
      rol = 'overlay',
      pane,
      opacidad,
      capas = CAPAS_DEFECTO,
      formato = FORMATO_DEFECTO,
      transparente,
      crs = CRS_MAPA,
      alAvisar,
    } = opciones

    if (rol !== 'base' && rol !== 'overlay') {
      throw new RangeError(
        `crearCapaWMSCatastro: 'rol' debe ser 'base' o 'overlay'; recibido ${JSON.stringify(rol)}.`,
      )
    }
    validarCRS(crs)
    if (crs !== CRS_MAPA) {
      // Camino abierto, no implementado (a propósito). La capa deriva su BBOX de
      // `mapa.getBounds()` proyectando con `L.CRS.EPSG3857.project`, así que solo
      // puede pedir el CRS del mapa. Para otro CRS (F09 necesita `EPSG:25830`
      // para el plano a 300 ppp) la proyección de las esquinas la hace quien
      // corresponda — `geo/utm.js#forward` — y se llama a `getMapUrl`
      // directamente, que es agnóstica de CRS justo para eso.
      //
      // ⚠️ Y como CAMINO DE CONTINGENCIA («si 3857 fallara, pedir 25830 y
      // proyectar las esquinas») es PEOR de lo que se creía. Medido en 2D.1: el
      // desajuste de una imagen 25830 sobre el lienzo 3857 sería de **~7,25 px a
      // CUALQUIER escala** — lo domina la convergencia de meridianos
      // (γ = Δλ·sin φ), que es una ROTACIÓN y por tanto invariante en píxeles, no
      // un error que se disimule al alejarse. A escala de parcela eso son
      // **4,33 m**, muy por encima de la tolerancia catastral urbana de ±0,5 m.
      // O sea: el plan B NO es equivalente al plan A. Quien lo lea no debe
      // tomarlo por un intercambio inocuo. Por suerte 3857 está verificado
      // (hecho (b) de la cabecera) y esta contingencia no hace falta.
      throw new RangeError(
        `crearCapaWMSCatastro: la capa solo sabe proyectar el CRS del mapa (${CRS_MAPA}); ` +
          `recibido ${JSON.stringify(crs)}. Para otro CRS proyecta tú las esquinas ` +
          `(geo/utm.js#forward) y llama a getMapUrl directamente (F09, plano a 300 ppp).`,
      )
    }
    if (opacidad !== undefined) {
      if (typeof opacidad !== 'number' || !Number.isFinite(opacidad)) {
        throw new TypeError(
          `crearCapaWMSCatastro: 'opacidad' debe ser un número; recibido ${typeof opacidad}.`,
        )
      }
      if (opacidad < 0 || opacidad > 1) {
        throw new RangeError(
          `crearCapaWMSCatastro: 'opacidad' debe estar en [0,1]; recibido ${opacidad}.`,
        )
      }
    }
    if (pane !== undefined && (typeof pane !== 'string' || pane.trim() === '')) {
      throw new TypeError(
        `crearCapaWMSCatastro: 'pane' debe ser el nombre de un pane de Leaflet; recibido ` +
          `${JSON.stringify(pane)}.`,
      )
    }

    // Defectos por rol (punto 9 de la cabecera): base opaca vs superpuesta
    // translúcida. Cualquier opción explícita gana sobre el defecto del rol.
    const porRol =
      rol === 'base'
        ? { pane: 'tilePane', opacidad: 1, transparente: false }
        : { pane: 'overlayPane', opacidad: OPACIDAD_SUPERPUESTA, transparente: true }

    this._avisar = resolverAvisar(alAvisar)
    this._rol = rol
    this._crs = crs
    this._capas = validarCapas(capas)
    this._formato = formato
    this._transparente = transparente === undefined ? porRol.transparente : Boolean(transparente)
    validarFormato(formato)

    // Estado de la gestión por encuadre.
    this._secuencia = 0 // contador monótono: token anti-carrera
    this._urlPedida = null // última URL EMITIDA (base de la deduplicación)
    this._urlVisible = null // última URL aplicada a la imagen visible
    this._precarga = null // <img> desprendido en vuelo (si hay)
    this._obsoleta = false
    this._cuenta = { peticiones: 0, aplicadas: 0, cargadas: 0, descartadas: 0, fallidas: 0 }

    // El overlay nace con el GIF 1×1 y unos bounds degenerados: `onAdd` pone los
    // bounds reales ANTES de que Leaflet posicione la imagen, y la primera
    // imagen real entra por precarga.
    L.ImageOverlay.prototype.initialize.call(this, IMAGEN_VACIA, [
      [0, 0],
      [0, 0],
    ])
    L.setOptions(this, {
      pane: pane === undefined ? porRol.pane : pane,
      opacity: opacidad === undefined ? porRol.opacidad : opacidad,
    })
    // Invariantes NO negociables (misma disciplina que `services/ign.js`, que los
    // pone DESPUÉS del spread de `opts`): se re-afirman AL FINAL, en la
    // precedencia más alta. Hoy `initialize` solo reenvía `{pane, opacity}` y el
    // invariante se sostendría igual por el `options` del prototipo, pero eso es
    // un accidente: en cuanto alguien añada un pass-through de `...resto` —la
    // petición natural de la Fase 3 para `className`/`zIndex`— `crossOrigin` y
    // `attribution` se debilitarían sin que nada avisara. Con esto, no.
    L.setOptions(this, {
      crossOrigin: 'anonymous',
      attribution: ATRIBUCION.CATASTRO,
    })
  },

  /**
   * Eventos del mapa a los que la capa reacciona. Leaflet los registra y los
   * DA DE BAJA solo (`Layer#_layerAdd`), así que no hay `off` que olvidar.
   * `zoom`/`viewreset` los hereda de `ImageOverlay` (reposicionan la imagen
   * actual mientras llega la nueva). Ver decisión 2 de la cabecera: `moveend`
   * sí, `zoomend` NO.
   */
  getEvents() {
    const eventos = L.ImageOverlay.prototype.getEvents.call(this)
    eventos.moveend = this._alCambiarEncuadre
    eventos.resize = this._alCambiarEncuadre
    return eventos
  },

  onAdd(mapa) {
    // Bounds reales antes de que `ImageOverlay.onAdd` → `_reset()` posicione la
    // imagen (si no, la posicionaría en [[0,0],[0,0]]).
    const encuadre = this._encuadre()
    if (encuadre) this._bounds = encuadre.bounds

    L.ImageOverlay.prototype.onAdd.call(this, mapa)

    // Una petición al añadirse. Si el mapa aún no tuviera vista, Leaflet no
    // habría llamado a `onAdd` todavía (`Map#addLayer` → `whenReady`), así que
    // aquí `getBounds()` siempre es válido.
    this._solicitar()
  },

  onRemove(mapa) {
    // Al salir del mapa, la precarga en vuelo deja de interesar: se desconectan
    // sus handlers y se invalida su token (nada podrá tocar una capa retirada).
    this._cancelarPrecarga()
    L.ImageOverlay.prototype.onRemove.call(this, mapa)
  },

  /** @returns {string|null} URL de la imagen VISIBLE (null si no hay ninguna real). */
  urlVisible() {
    return this._urlVisible
  },

  /** @returns {string|null} Última URL EMITIDA (la que dedupe compara). */
  urlPedida() {
    return this._urlPedida
  },

  /** @returns {EstadoCapaWMS} */
  estado() {
    return {
      rol: this._rol,
      ...this._cuenta,
      hayCartografia: this._urlVisible !== null,
      obsoleta: this._obsoleta,
    }
  },

  // ── Interno ────────────────────────────────────────────────────────────────

  _alCambiarEncuadre() {
    this._solicitar()
  },

  /**
   * Encuadre actual del mapa → BBOX en metros Web Mercator + tamaño en píxeles.
   * `null` si el mapa no tiene superficie visible (contenedor 0×0, p. ej. un
   * panel oculto) o si el encuadre degenera: no hay nada que pedir, y no es un
   * error que contar al usuario.
   *
   * @returns {{bounds: import('leaflet').LatLngBounds, bbox: BBoxProyectado, tamano: TamanoImagen}|null}
   */
  _encuadre() {
    const mapa = this._map
    if (!mapa || mapa.getZoom() === undefined) return null

    const tam = mapa.getSize()
    const ancho = Math.round(tam.x)
    const alto = Math.round(tam.y)
    if (!(ancho > 0) || !(alto > 0)) return null

    const bounds = mapa.getBounds()
    // Proyección de las DOS esquinas del encuadre a metros Web Mercator. En 3857
    // el orden es X,Y y NO se invierte nada (dossier §2.5).
    const so = L.CRS.EPSG3857.project(bounds.getSouthWest())
    const ne = L.CRS.EPSG3857.project(bounds.getNorthEast())
    const bbox = {
      minX: Math.min(so.x, ne.x),
      minY: Math.min(so.y, ne.y),
      maxX: Math.max(so.x, ne.x),
      maxY: Math.max(so.y, ne.y),
    }
    if (!(bbox.maxX > bbox.minX) || !(bbox.maxY > bbox.minY)) return null

    return { bounds, bbox, tamano: { ancho, alto } }
  },

  /**
   * UNA petición por encuadre: calcula la URL, deduplica y precarga. Nunca
   * lanza (corre dentro de handlers de eventos de Leaflet).
   */
  _solicitar() {
    if (!this._map) return
    const encuadre = this._encuadre()
    if (!encuadre) return

    const url = getMapUrl(encuadre.bbox, encuadre.tamano, {
      crs: this._crs,
      capas: this._capas,
      formato: this._formato,
      transparente: this._transparente,
    })

    // Deduplicación (decisión 3): mismo encuadre ⇒ 0 peticiones.
    if (url === this._urlPedida) return
    this._urlPedida = url

    const secuencia = ++this._secuencia
    this._cuenta.peticiones++

    const img = new Image()
    // ORDEN OBLIGATORIO (dossier §4.4): crossOrigin ANTES de src, o la imagen
    // contamina el canvas del informe aunque el servidor emita ACAO.
    img.crossOrigin = 'anonymous'
    img.onload = () => this._alCargar(secuencia, url, encuadre.bounds)
    img.onerror = (evento) => this._alFallar(secuencia, evento)
    img.src = url
    this._precarga = img
  },

  /**
   * @param {number} secuencia
   * @param {string} url
   * @param {import('leaflet').LatLngBounds} bounds
   */
  _alCargar(secuencia, url, bounds) {
    this._cuenta.cargadas++
    // Token anti-carrera (decisión 4): una respuesta de un encuadre ya superado
    // se descarta para la imagen, pero SÍ se contabiliza.
    if (secuencia !== this._secuencia || !this._map) {
      this._cuenta.descartadas++
      return
    }
    this._precarga = null
    // La imagen ya está en la caché del navegador: `setUrl` la intercambia sin
    // una segunda petición de red y sin dejar el hueco en blanco (decisión 5).
    this.setBounds(bounds)
    this.setUrl(url)
    this._urlVisible = url
    this._obsoleta = false
    this._cuenta.aplicadas++
  },

  /**
   * @param {number} secuencia
   * @param {*} causa  El evento `error` de la imagen (no lleva detalle útil por
   *   diseño del navegador; se pasa igual como `causa` para la consola).
   */
  _alFallar(secuencia, causa) {
    this._cuenta.fallidas++
    // Fallo de una petición ya superada: se cuenta y se calla (ver decisión 6).
    if (secuencia !== this._secuencia || !this._map) {
      this._cuenta.descartadas++
      return
    }
    this._precarga = null
    // Se libera la deduplicación para que el MISMO encuadre pueda reintentarse
    // en el próximo `moveend`/`resize`: si no, una URL fallida quedaría vetada
    // para siempre y el usuario no podría recuperar la cartografía sin recargar.
    this._urlPedida = null

    // NIVEL.AVISO, no ERROR (hallazgo 2.5 de la auditoría de coherencia): esto es
    // cartografía DE FONDO que falla por red, exactamente el mismo suceso que un
    // `tileerror` del IGN — y `validation/_comun.js#NIVEL` fija que ERROR es lo
    // que BLOQUEA la generación del GML. Un fondo que no carga no bloquea nada:
    // la geometría del usuario está en el modelo, no en la imagen. La regla
    // completa está escrita junto al typedef `Avisar` de `viewer/_comun.js`.
    if (this._urlVisible !== null) {
      this._obsoleta = true
      this._avisar(MENSAJES.OBSOLETA, { nivel: NIVEL.AVISO, causa })
    } else {
      this._avisar(MENSAJES.SIN_CARTOGRAFIA, { nivel: NIVEL.AVISO, causa })
    }
  },

  _cancelarPrecarga() {
    this._secuencia++ // invalida cualquier resolución pendiente
    if (this._precarga) {
      this._precarga.onload = null
      this._precarga.onerror = null
      this._precarga = null
    }
    // La deduplicación vuelve a "lo que de verdad se ve": si la capa se retira
    // con una petición en vuelo y luego se vuelve a añadir al mismo encuadre, la
    // petición abortada NO debe quedar deduplicada (o el encuadre nunca cargaría);
    // y si lo visible ya era correcto, el re-añadido sigue costando 0 peticiones.
    this._urlPedida = this._urlVisible
  },
})

/**
 * Crea la capa de cartografía catastral por encuadre: UN `L.ImageOverlay`
 * gestionado, UNA petición `GetMap` por encuadre (criterio de aceptación 2 de
 * F03). Se añade con `mapa.addLayer(capa)` o `capa.addTo(mapa)`.
 *
 * La misma factory sirve para los dos usos de la spec (punto 9 de la cabecera):
 *
 * ```js
 * const base = crearCapaWMSCatastro({ rol: 'base', alAvisar })          // opaca, tilePane
 * const encima = crearCapaWMSCatastro({ rol: 'overlay', alAvisar })     // translúcida, overlayPane
 * encima.setOpacity(0.35)   // la Fase 3 cablea aquí un <input type="range">
 * ```
 *
 * @param {object} [opts]
 * @param {'base'|'overlay'} [opts.rol='overlay']  Fija los defectos de `pane`,
 *   `opacidad` y `transparente` del doble uso. Cualquier opción explícita gana.
 * @param {string} [opts.pane]           Pane de Leaflet (defecto por rol:
 *   `'tilePane'` para base, `'overlayPane'` para superpuesta).
 * @param {number} [opts.opacidad]       Opacidad inicial en [0,1] (defecto por
 *   rol: 1 / {@link OPACIDAD_SUPERPUESTA}). Regulable después con `setOpacity`.
 * @param {string[]} [opts.capas=CAPAS_DEFECTO]  Capas del WMS.
 * @param {string} [opts.formato='image/png']    `FORMAT` del GetMap.
 * @param {boolean} [opts.transparente]  `TRANSPARENT` (defecto por rol:
 *   `false` para base, `true` para superpuesta).
 * @param {string} [opts.crs='EPSG:3857']  Solo el CRS del mapa; ver la nota de
 *   `initialize` (para otro CRS, `getMapUrl` directamente).
 * @param {import('./_comun.js').Avisar} [opts.alAvisar]  Canal de aviso (regla
 *   de oro 1). Si no se pasa, `avisoPorDefecto` de `viewer/_comun.js`.
 * @returns {import('leaflet').ImageOverlay & {
 *   urlVisible: () => (string|null),
 *   urlPedida: () => (string|null),
 *   estado: () => EstadoCapaWMS,
 * }}
 * @throws {TypeError|RangeError}  Opciones inválidas (contrato del programador).
 */
export function crearCapaWMSCatastro(opts = {}) {
  return new CapaWMSCatastro(opts)
}

// services/ign.js — F03 · Tarea 2B.1. ÚNICO punto del código que habla con el IGN
// (Instituto Geográfico Nacional). Aísla las tres capas WMTS teseladas que sirven
// de fondo cartográfico al visor: `pnoa-ma` (ortofoto), `ign-base` (mapa base) y
// `mapa-raster` (topográfico MTN). Regla de oro 7 del proyecto: si mañana el IGN
// cambia un endpoint, una capa o un formato, se cambia AQUÍ y en ningún otro
// sitio — `viewer/capas.js` y el resto del visor consumen `WMTS_IGN`/`crearCapaWMTS`/
// `CAPAS_IGN`, nunca construyen una URL del IGN a mano.
//
// Diferencia esencial con `viewer/wms-catastro.js` (spec feature-03, §"WMS del
// Catastro"): el WMS del Catastro sirve UNA imagen por encuadre y teselarlo está
// PROHIBIDO (penaliza el mosaico, mayor riesgo de bloqueo del proyecto). Las tres
// WMTS de este módulo son justo lo contrario: teselas PREGENERADAS por el IGN,
// pensadas para mosaico — por eso aquí `L.tileLayer` con plantilla `{z}/{x}/{y}`
// es lo correcto, y allí (Catastro) sería un error.
//
// `crossOrigin: 'anonymous'` en TODA capa (criterio de aceptación 4 de F03,
// override O7 del dossier de I+D): MEJORES_PRACTICAS_GML.md §0.6 verifica en
// navegador real que los servicios del IGN emiten `Access-Control-Allow-Origin: *`
// y que una tesela cargada con `crossOrigin='anonymous'` NO contamina el canvas
// (`toDataURL`/`getImageData` limpios). Sin este atributo, el plano a 300 ppp del
// informe (F09) sería imposible: el canvas quedaría "tainted" y ni siquiera se
// podría leer para componerlo. Ya no es una incógnita — se construye con
// `crossOrigin` desde el principio, no como parche posterior.
//
// Atribución: obligación LEGAL, no cosmética (criterio de aceptación 5 de F03;
// PNOA/IGN se ceden bajo CC-BY 4.0 y exigen mención literal del titular). Los
// textos NO se copian a mano aquí: se importan de `viewer/atribucion.js`, la
// única fuente de esos strings en todo el proyecto.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — Ningún error silencioso: un fallo de red al cargar una tesela
//     (evento `tileerror` de Leaflet) se avisa por el canal común de
//     `viewer/_comun.js#resolverAvisar`, nivel `NIVEL.AVISO` (no bloqueante: que
//     falle una tesela de fondo no debe romper el visor, pero jamás puede
//     quedar callado — hallazgo T3/C10 de la review, era un gap crítico). El
//     nivel se toma del enum `NIVEL` de `viewer/_comun.js` (re-exportado de
//     `validation/_comun.js`), nunca como literal suelto.
//     `crearCapaWMTS('id-inexistente')` es en cambio un contrato roto por el
//     PROGRAMADOR (no hay dato de usuario en un id de servicio): `throw`.
//   · Este módulo importa Leaflet (`import L from 'leaflet'`) y por tanto es
//     SOLO-navegador: su test lleva sufijo `.dom.test.js` y el módulo NO entra
//     por el barrel raíz `index.js` (Leaflet exige `window`; rompería la suite
//     `node` del proyecto). Tampoco importa `leaflet/dist/leaflet.css` — el CSS
//     de Leaflet vive solo en la entrada demo de la Fase 4.

import L from 'leaflet'
import { ATRIBUCION } from '../viewer/atribucion.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

/**
 * Configuración de una WMTS teselada del IGN.
 *
 * @typedef {Object} ServicioWMTS
 * @property {string} id             Clave de {@link WMTS_IGN} ('pnoa-ma'|'ign-base'|'mapa-raster').
 * @property {string} nombre         Rótulo en español para el control de capas.
 * @property {string} url            Endpoint base (sin query string).
 * @property {string} layer          Valor de `LAYER` en el GetTile KVP.
 * @property {string} formato        MIME type de `FORMAT` ('image/jpeg'|'image/png').
 * @property {string} tileMatrixSet  Rejilla ('GoogleMapsCompatible', EPSG:3857).
 * @property {number} maxNativeZoom  Zoom nativo máximo servido por el IGN.
 * @property {string} atribucion     Texto legal (de {@link ATRIBUCION}).
 */

/**
 * Config congelada de las tres WMTS teseladas del IGN, indexada por id. Verificada
 * contra MEJORES_PRACTICAS_GML.md §2.1 (tabla de endpoints, ~línea 418-421).
 *
 * @type {Readonly<Record<'pnoa-ma'|'ign-base'|'mapa-raster', ServicioWMTS>>}
 */
export const WMTS_IGN = Object.freeze({
  'pnoa-ma': Object.freeze({
    id: 'pnoa-ma',
    nombre: 'Ortofoto PNOA',
    url: 'https://www.ign.es/wmts/pnoa-ma',
    layer: 'OI.OrthoimageCoverage',
    formato: 'image/jpeg',
    tileMatrixSet: 'GoogleMapsCompatible',
    // z20, VERIFICADO el 2026-07-26 (ver nota de MAX_ZOOM_NATIVO_IGN). El
    // dossier §2.1 se quedaba CORTO: decía "JPEG teselado (hasta z19)" y el
    // máximo real de esta capa es 20.
    maxNativeZoom: 20,
    atribucion: ATRIBUCION.PNOA,
  }),
  'ign-base': Object.freeze({
    id: 'ign-base',
    nombre: 'Base IGN',
    url: 'https://www.ign.es/wmts/ign-base',
    layer: 'IGNBaseTodo',
    formato: 'image/png',
    tileMatrixSet: 'GoogleMapsCompatible',
    // z20, VERIFICADO el 2026-07-26 (ver nota de MAX_ZOOM_NATIVO_IGN). Ya no es
    // el valor CONSERVADOR que el dossier no cubría: es el máximo declarado.
    maxNativeZoom: 20,
    atribucion: ATRIBUCION.IGN,
  }),
  'mapa-raster': Object.freeze({
    id: 'mapa-raster',
    nombre: 'Topográfico IGN (MTN)',
    url: 'https://www.ign.es/wmts/mapa-raster',
    layer: 'MTN',
    formato: 'image/jpeg',
    tileMatrixSet: 'GoogleMapsCompatible',
    // z20, VERIFICADO el 2026-07-26 (ver nota de MAX_ZOOM_NATIVO_IGN), igual
    // que las otras dos.
    maxNativeZoom: 20,
    atribucion: ATRIBUCION.IGN,
  }),
})

/**
 * Zoom nativo máximo de TODAS las WMTS del IGN — **derivado** de
 * {@link WMTS_IGN}, nunca escrito a mano: el valor vive en un único sitio (la
 * config de cada servicio) y no puede desincronizarse de ella.
 *
 * VERIFICADO el 2026-07-26 contra el servicio real (tarea 2D.1, banco de
 * pruebas en navegador): el `GetCapabilities` de los tres servicios declara
 * `TileMatrixSetLimits` de `GoogleMapsCompatible` para los niveles **0..20**, y
 * pidiendo teselas se confirma que **z20 devuelve imagen real (HTTP 200) y z21
 * devuelve HTTP 400**. El dossier §2.1 se quedaba corto (decía "hasta z19" para
 * PNOA); el real es 20 en los tres.
 *
 * Por qué NO es cosmético: con 19, Leaflet **reescala** la última tesela para
 * pintar z20 en vez de pedir la nativa, y se pierde calidad real justo en la
 * escala de calcado de precisión —que es el propósito de la herramienta—.
 *
 * QUÉ ES Y QUÉ NO ES (auditoría de cierre de la fase 3, punto 6): es un dato
 * agregado DEL SERVICIO —«hasta dónde tesela el IGN»—, útil para los tests de
 * este módulo y para F09 (el plano a 300 ppp, que necesita saber a qué
 * resolución existe imagen real). **NO es la fuente del tope de zoom del
 * visor, y hoy NINGÚN módulo del visor lo lee.** Ese tope lo deriva
 * `viewer/capas.js#maxZoomNativo` capa a capa, leyendo el `maxNativeZoom` que
 * cada descriptor toma de `WMTS_IGN[id]`; y hace bien: un visor sin capas del
 * IGN no debe compararse contra el tope del IGN, y `services/osm.js` aporta su
 * propio 19. Si algún día el visor necesitara un máximo global del IGN, sería
 * esta constante — pero que nadie escriba en un comentario que ya lo usa.
 *
 * @type {number}
 */
export const MAX_ZOOM_NATIVO_IGN = Math.max(
  ...Object.values(WMTS_IGN).map((servicio) => servicio.maxNativeZoom),
)

/**
 * Construye la plantilla de URL GetTile en KVP para una WMTS del IGN, con los
 * placeholders `{z}`/`{x}`/`{y}` que Leaflet sustituye por tesela.
 *
 * @param {ServicioWMTS} servicio
 * @returns {string}
 */
function plantillaGetTile(servicio) {
  return (
    `${servicio.url}?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0` +
    `&LAYER=${servicio.layer}&STYLE=default&FORMAT=${encodeURIComponent(servicio.formato)}` +
    `&TILEMATRIXSET=${servicio.tileMatrixSet}&TILEMATRIX={z}&TILECOL={x}&TILEROW={y}`
  )
}

/**
 * Crea la capa Leaflet (`L.TileLayer`) de una WMTS del IGN.
 *
 * `crossOrigin`, `attribution` y `maxNativeZoom` son invariantes NO negociables:
 * se aplican DESPUÉS de fundir `opts` para que ningún llamante pueda debilitarlos
 * por accidente (override O7 y criterios de aceptación 4/5 de F03). `maxZoom` sí
 * es negociable — por defecto se deja igual a `maxNativeZoom` (Leaflet nunca
 * pediría de otro modo las teselas nativas del nivel máximo si el `maxZoom` de
 * la CAPA se quedara en su valor por defecto de 18); el llamante puede pasar un
 * `maxZoom` mayor en `opts` para el "zoom sin tope artificial" del criterio de
 * aceptación (spec feature-03, Interacción: `maxZoom > maxNativeZoom` para
 * calcar sobre ortofoto aunque pixele) sin tocar este módulo.
 *
 * @param {'pnoa-ma'|'ign-base'|'mapa-raster'} id
 * @param {{alAvisar?: import('../viewer/_comun.js').Avisar, [k: string]: *}} [opts]
 *   `alAvisar` es el canal de aviso (ver `viewer/_comun.js#resolverAvisar`); el
 *   resto de propiedades se pasan tal cual como opciones de `L.tileLayer`.
 * @returns {import('leaflet').TileLayer}
 * @throws {RangeError}  Si `id` no es una de las claves de {@link WMTS_IGN}
 *   (contrato roto por el programador, no un dato del usuario).
 */
export function crearCapaWMTS(id, opts = {}) {
  const servicio = WMTS_IGN[id]
  if (!servicio) {
    throw new RangeError(
      `crearCapaWMTS: id de servicio IGN desconocido: ${JSON.stringify(id)}. ` +
        `Válidos: ${Object.keys(WMTS_IGN).join(', ')}.`,
    )
  }

  const { alAvisar, ...opcionesLeaflet } = opts
  const avisar = resolverAvisar(alAvisar)

  const capa = L.tileLayer(plantillaGetTile(servicio), {
    maxZoom: servicio.maxNativeZoom,
    ...opcionesLeaflet,
    // Invariantes NO negociables: ver comentario de la función.
    crossOrigin: 'anonymous',
    attribution: servicio.atribucion,
    maxNativeZoom: servicio.maxNativeZoom,
  })

  // Hallazgo T3/C10 de la review: una tesela de fondo que falla NO debe romper
  // el visor (no bloqueante), pero tampoco puede quedar callada (regla 1).
  capa.on('tileerror', (evento) => {
    avisar(`No se ha podido cargar una tesela de «${servicio.nombre}».`, {
      nivel: NIVEL.AVISO,
      causa: evento && 'error' in evento ? evento.error : evento,
    })
  })

  return capa
}

/**
 * Descriptores de las tres WMTS del IGN, que consume `viewer/capas.js` para
 * componer el control de capas. Las tres son capas BASE (`rol:'base'`): el spec
 * (feature-03, §Capas) lista cinco capas base en total (Catastro, PNOA,
 * Topográfico IGN, OSM, Blanco). De las tres aisladas aquí, `viewer/capas.js`
 * monta dos —«Ortofoto PNOA» (`pnoa-ma`) y «Topográfico IGN (MTN)»
 * (`mapa-raster`)— y deja fuera `ign-base`, que se aísla igualmente en este
 * módulo porque el spec pide EXPLÍCITAMENTE aislar las tres WMTS en
 * `services/ign.js`, independientemente de cuántas lleguen al control.
 *
 * Cada `crear(opts)` REENVÍA sus opciones a {@link crearCapaWMTS}, `alAvisar`
 * incluido (hallazgo 2.6 de la auditoría de coherencia): antes el descriptor
 * llamaba a `crearCapaWMTS(servicio.id)` sin argumentos, así que en cuanto la
 * Fase 3 usara `CAPAS_IGN` **para lo que existe** —alimentar el control de
 * capas— todos los `tileerror` dejarían de llegar a la UI de avisos y la regla 1
 * se quedaría en su suelo mínimo (`console.warn`). Pasar `alAvisar` por el
 * descriptor es el caso NORMAL, no la excepción.
 *
 * Cada descriptor propaga también `servicio.id`: es la clave ESTABLE con la que
 * indexar la capa y persistir "qué capa tenía activa el usuario". `nombre` es un
 * rótulo de UI (`'Topográfico IGN (MTN)'`) y no vale para eso.
 *
 * @type {ReadonlyArray<import('../viewer/_comun.js').DescriptorCapa>}
 */
export const CAPAS_IGN = Object.freeze(
  Object.values(WMTS_IGN).map((servicio) =>
    Object.freeze({
      id: servicio.id,
      nombre: servicio.nombre,
      rol: 'base',
      crear: (opts) => crearCapaWMTS(servicio.id, opts),
      atribucion: servicio.atribucion,
    }),
  ),
)

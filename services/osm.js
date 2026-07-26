// services/osm.js — F03 · Tarea 3A.1. ÚNICO punto del código que habla con
// OpenStreetMap. Aísla la capa base de cortesía «OpenStreetMap» que exige el
// spec (feature-03, §Capas: "Base: Catastro · Ortofoto PNOA (IGN) · Topográfico
// IGN · OpenStreetMap · Blanco"). Regla de oro 7 del proyecto: si mañana OSM
// cambia de endpoint, de política de uso o el proyecto migra a un proveedor de
// teselas propio/de pago, se cambia AQUÍ y en ningún otro sitio.
//
// Es el HERMANO GEMELO en forma de `services/ign.js` (léelo si algo de aquí no
// se entiende): misma config congelada + factory + invariantes-después-del-spread,
// adaptado a UN SOLO servicio en vez de tres. `viewer/atribucion.js` ya exportaba
// `ATRIBUCION.OSM` desde la Fase 2, sin consumidor; este módulo es su primer
// consumidor.
//
// Diferencia con `viewer/wms-catastro.js` (spec feature-03, §"WMS del
// Catastro"): igual que las WMTS del IGN, `tile.openstreetmap.org` sirve
// teselas PREGENERADAS pensadas para mosaico — `L.tileLayer` con plantilla
// `{z}/{x}/{y}` es lo correcto aquí, al revés que el WMS del Catastro (una
// imagen por encuadre, teselarlo está prohibido).
//
// `maxNativeZoom: 19` — es el máximo REAL de las teselas estándar de
// `tile.openstreetmap.org` (el servidor no genera teselas nativas más allá; a
// z20 un cliente vería la tesela de z19 reescalada). OJO: NO es el mismo caso
// que `MAX_ZOOM_NATIVO_IGN` (z20) de `services/ign.js` — aquello se VERIFICÓ
// empíricamente el 2026-07-26 contra el `GetCapabilities` real de las tres
// WMTS del IGN (z20 → HTTP 200, z21 → HTTP 400). El 19 de aquí es el límite
// DOCUMENTADO del esquema de teselas estándar de OSM, no algo que este
// proyecto haya verificado en vivo pieza a pieza; no lo confundas con el otro.
//
// `crossOrigin: 'anonymous'` SIEMPRE (criterio de aceptación 4 de F03, override
// O7 del dossier): igual que en `services/ign.js`. Pero, a diferencia del WMS
// del Catastro y de las WMTS del IGN —cuyo CORS SÍ se verificó en navegador
// real (MEJORES_PRACTICAS_GML.md §0.6)—, **el CORS de `tile.openstreetmap.org`
// NO se ha comprobado empíricamente en este proyecto**. Se aplica el atributo
// por coherencia y por si el canvas del plano de F09 algún día lleva OSM de
// fondo, pero si entonces ese canvas saliera "tainted" (`toDataURL`/
// `getImageData` sucios), el sospechoso es este servicio, no los otros dos.
// Sé honesto tú también si tocas este comentario: no afirmes una verificación
// que no se ha hecho.
//
// POLÍTICA DE USO DE OSM (no es opcional, es una restricción operativa real):
// la Tile Usage Policy de la OSM Foundation
// (https://operations.osmfoundation.org/policies/tiles/)
// desaconseja el uso pesado de `tile.openstreetmap.org` y exige atribución
// visible — la misma clase de restricción que ya rige el WMS del Catastro
// (`viewer/wms-catastro.js`). Esta capa es una **cortesía de fondo**, NO la
// cartografía de trabajo del proyecto (esa es el Catastro y la ortofoto PNOA):
// sirve para orientarse, no para calcar con precisión. Si el uso del visor
// creciera, habría que mover esta capa a un proveedor propio o de pago
// (p. ej. un servidor de teselas gestionado) en vez de seguir pegándose
// directamente al servidor comunitario.
//
// Atribución: obligación LEGAL (criterio de aceptación 5 de F03; OSM se cede
// bajo ODbL y exige mención + enlace a la licencia). El texto NO se copia a
// mano aquí: se importa de `viewer/atribucion.js`, la única fuente de esos
// strings en todo el proyecto.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — Ningún error silencioso: un fallo de red al cargar una tesela
//     (evento `tileerror` de Leaflet) se avisa por el canal común de
//     `viewer/_comun.js#resolverAvisar`, nivel `NIVEL.AVISO` (no bloqueante:
//     cartografía DE FONDO que falla nunca impide generar el GML — la misma
//     regla que ya fija `services/ign.js`, ver su comentario junto al typedef
//     `Avisar` de `viewer/_comun.js`).
//   · Este módulo importa Leaflet (`import L from 'leaflet'`) y por tanto es
//     SOLO-navegador: su test lleva sufijo `.dom.test.js` y el módulo NO entra
//     por el barrel raíz `index.js` (Leaflet exige `window`; rompería la suite
//     `node` del proyecto). Tampoco importa `leaflet/dist/leaflet.css`.

import L from 'leaflet'
import { ATRIBUCION } from '../viewer/atribucion.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

/**
 * Config congelada del ÚNICO servicio de teselas OSM que consume el proyecto.
 * A diferencia de `services/ign.js#WMTS_IGN` (tres servicios distintos,
 * indexados por id) aquí solo hay UNO: no se indexa por id, se exporta
 * directamente el objeto de configuración.
 *
 * @typedef {Object} ServicioOSM
 * @property {string} id             Clave estable ('osm').
 * @property {string} nombre         Rótulo en español para el control de capas.
 * @property {string} url            Plantilla de tesela `{z}/{x}/{y}` (sin query string: OSM no usa KVP).
 * @property {number} maxNativeZoom  Zoom nativo máximo del esquema de teselas estándar de OSM.
 * @property {string} atribucion     Texto legal (de {@link ATRIBUCION}).
 *
 * @type {Readonly<ServicioOSM>}
 */
export const OSM = Object.freeze({
  id: 'osm',
  nombre: 'OpenStreetMap',
  url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
  // 19: máximo DOCUMENTADO del esquema de teselas estándar de OSM (ver cabecera
  // del módulo). NO confundir con el 20 de `services/ign.js#MAX_ZOOM_NATIVO_IGN`,
  // que sí se verificó en vivo contra el GetCapabilities real de las tres WMTS
  // del IGN — este valor no ha pasado por esa misma verificación empírica aquí.
  maxNativeZoom: 19,
  atribucion: ATRIBUCION.OSM,
})

/**
 * Crea la capa Leaflet (`L.TileLayer`) de OpenStreetMap.
 *
 * `crossOrigin`, `attribution` y `maxNativeZoom` son invariantes NO negociables:
 * se aplican DESPUÉS de fundir `opts` para que ningún llamante pueda debilitarlos
 * por accidente (override O7 y criterios de aceptación 4/5 de F03) — mismo
 * patrón que `services/ign.js#crearCapaWMTS`. `maxZoom` sí es negociable — por
 * defecto igual a `maxNativeZoom`; el llamante puede subirlo en `opts` para el
 * "zoom sin tope artificial" del criterio de aceptación (spec feature-03,
 * Interacción) sin tocar este módulo, asumiendo que a partir de `maxNativeZoom`
 * Leaflet reescala en vez de pedir teselas nativas que OSM no sirve.
 *
 * @param {{alAvisar?: import('../viewer/_comun.js').Avisar, [k: string]: *}} [opts]
 *   `alAvisar` es el canal de aviso (ver `viewer/_comun.js#resolverAvisar`); el
 *   resto de propiedades se pasan tal cual como opciones de `L.tileLayer`.
 * @returns {import('leaflet').TileLayer}
 */
export function crearCapaOSM(opts = {}) {
  const { alAvisar, ...opcionesLeaflet } = opts
  const avisar = resolverAvisar(alAvisar)

  const capa = L.tileLayer(OSM.url, {
    maxZoom: OSM.maxNativeZoom,
    ...opcionesLeaflet,
    // Invariantes NO negociables: ver comentario de la función.
    crossOrigin: 'anonymous',
    attribution: OSM.atribucion,
    maxNativeZoom: OSM.maxNativeZoom,
  })

  // Igual que `services/ign.js#crearCapaWMTS`: una tesela de fondo que falla NO
  // debe romper el visor (no bloqueante), pero tampoco puede quedar callada
  // (regla 1).
  capa.on('tileerror', (evento) => {
    avisar(`No se ha podido cargar una tesela de «${OSM.nombre}».`, {
      nivel: NIVEL.AVISO,
      causa: evento && 'error' in evento ? evento.error : evento,
    })
  })

  return capa
}

/**
 * Descriptor de la capa OSM, listo para el control de capas de la Fase 3
 * (`viewer/capas.js`). Es `rol:'base'`, igual que las tres de
 * `services/ign.js#CAPAS_IGN` y la del Catastro: el spec (feature-03, §Capas)
 * lista cinco capas base en total (Catastro, PNOA, IGN, OSM, Blanco).
 *
 * FORMA DELIBERADAMENTE distinta de `CAPAS_IGN`: aquella es un ARRAY porque
 * `services/ign.js` aísla TRES servicios WMTS reales bajo un mismo módulo (el
 * spec pide explícitamente aislar los tres, aunque solo dos lleguen al control
 * final). Aquí hay UN SOLO servicio — envolverlo en un array de un elemento
 * sería un paralelismo falso, no una necesidad real. Se exporta un único
 * descriptor suelto; el consumidor (`viewer/capas.js`) puede insertarlo en su
 * lista de capas base con un simple `[...CAPAS_IGN, CAPA_CATASTRO, CAPA_OSM, CAPA_BLANCO]`
 * o equivalente, tan trivialmente como si fuera un array de uno.
 *
 * `crear(opts)` REENVÍA sus opciones a {@link crearCapaOSM}, `alAvisar`
 * incluido (mismo hallazgo 2.6 de la auditoría de coherencia que ya corrigió
 * `services/ign.js#CAPAS_IGN`): un descriptor que no propaga `alAvisar` apaga
 * la regla 1 en cuanto `viewer/capas.js` lo use para lo que existe.
 *
 * @type {Readonly<import('../viewer/_comun.js').DescriptorCapa>}
 */
export const CAPA_OSM = Object.freeze({
  id: OSM.id,
  nombre: OSM.nombre,
  rol: 'base',
  crear: (opts) => crearCapaOSM(opts),
  atribucion: OSM.atribucion,
})

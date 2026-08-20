// viewer/capas.js — F03 · Tarea 3B. ENSAMBLADOR de las capas del visor.
//
// Convierte seis módulos sueltos (`services/ign.js`, `services/osm.js`,
// `viewer/wms-catastro.js`, `viewer/atribucion.js`, `viewer/_comun.js` y la capa
// «Blanco» que nace aquí) en el mapa utilizable que pide el spec
// (feature-03-visor.md, §Capas):
//
//     «Base: Catastro · Ortofoto PNOA (IGN) · Topográfico IGN · OpenStreetMap ·
//      Blanco» + «Superpuesta: cartografía catastral en transparencia con
//      opacidad regulable».
//
// Es el módulo que cumple el CRITERIO DE ACEPTACIÓN 1 («las cinco capas base
// conmutan; la superpuesta regula opacidad») y el que hace que el CRITERIO 5
// («la atribución aparece en el visor») se cumpla de verdad: la atribución la
// pinta el control NATIVO de Leaflet a partir de la `attribution` de las capas
// MONTADAS, así que sin este módulo no hay nada que atribuir. Aquí NO se usa
// `viewer/atribucion.js#atribucionCombinada` — es solo para el pie del PDF de
// F09; usarla en el visor duplicaría la atribución en pantalla.
//
// ── ESTE ES EL ÚNICO SITIO QUE DECIDE **QUÉ** DESCRIPTORES FORMAN EL VISOR ────
// (decisión de la auditoría de la fase 2). Ojo con la formulación: descriptores
// se CONSTRUYEN en tres sitios —`services/ign.js#CAPAS_IGN`,
// `services/osm.js#CAPA_OSM` y este módulo—, y eso es correcto: cada servicio es
// la fuente de verdad de SUS propios datos (url, tope nativo, atribución) y no
// tendría sentido que este módulo los copiara. Lo que NO se decide en ningún
// otro sitio es la COMPOSICIÓN del visor: cuáles de esos descriptores entran, en
// qué orden se ofrecen, con qué rol y congelados. Esa es la regla útil, y es la
// que este módulo posee en exclusiva.
//
// Los módulos de servicio exportan lo suyo y este los consume de DOS maneras
// distintas, y la diferencia no es un descuido:
//   · `services/ign.js#CAPAS_IGN` y `services/osm.js#CAPA_OSM` se consumen como
//     **DATO**: ya son descriptores declarativos (`id`/`nombre`/`rol`/`crear`/
//     `atribucion`) y aquí solo se seleccionan, se ordenan y se enriquecen con
//     el `maxNativeZoom` que su propio módulo dueño declara (`WMTS_IGN`, `OSM`);
//     ningún valor se copia a mano.
//   · `viewer/wms-catastro.js` se consume como **FACTORY**, y que no exporte
//     descriptor NO es un defecto: su `rol` es un ARGUMENTO DE CONSTRUCCIÓN que
//     cambia `pane`, `opacidad` y `transparente` (punto 9 de su cabecera), no un
//     campo declarativo. Un mismo módulo produce aquí DOS capas de roles
//     distintos —la base opaca y la superpuesta translúcida—, que es justo lo
//     que un descriptor único no podría expresar.
//
// ── CRITERIO DE ACEPTACIÓN 2: DOS PETICIONES NO SON UN FALLO ─────────────────
// Con la base «Catastro» Y la superpuesta catastral activas a la vez, el visor
// hace **2** peticiones `GetMap` por encuadre. **Eso es correcto y no hay nada
// que arreglar.** El criterio real, escrito en la cabecera de
// `viewer/wms-catastro.js` (punto 9), es «**1 petición por capa WMS del Catastro
// VISIBLE**»: son dos imágenes distintas (una opaca sin transparencia para el
// fondo, otra con `TRANSPARENT=TRUE` para superponer), no una teselada en dos
// trozos. Lo que el criterio prohíbe es el MOSAICO. Que nadie «optimice» esto
// fusionando las dos capas ni reutilizando la imagen de una para la otra.
//
// ── LA CAPA «BLANCO» ────────────────────────────────────────────────────────
// Nace aquí porque no es un servicio: es la ausencia de servicio. Se implementa
// como un `L.GridLayer` cuyo `createTile` devuelve un `<div>` blanco — CERO
// peticiones de red, ni siquiera un `data:` URI. Se descartaron las
// alternativas: un `L.TileLayer` con un PNG blanco embebido (haría trabajo
// inútil por tesela), y un `<div>` a pantalla completa en el pane (el `mapPane`
// se TRANSLADA al hacer pan, así que un div fijo dejaría huecos). `GridLayer` es
// la pieza que Leaflet tiene justamente para esto y participa sin trampas en el
// control de capas, en los panes, en la opacidad y en el pan/zoom.
//
// **Su `atribucion` es la cadena vacía, y eso es LEGÍTIMO, no un olvido**
// (punto que la auditoría marcó como «decidir y escribir»): la atribución es una
// obligación legal sobre DATOS DE TERCEROS, y en «Blanco» no hay datos de nadie
// —ni imagen, ni geometría, ni topónimo—, solo píxeles blancos generados en el
// cliente. No existe titular al que citar. Poner ahí un texto sería inventarse
// una cesión que no ha ocurrido. `L.Control.Attribution#addAttribution` ignora
// las cadenas vacías, así que al activar «Blanco» el visor no muestra ninguna
// atribución: correcto, porque no hay ninguna cartografía de terceros en
// pantalla. Por eso `ATRIBUCION` (`viewer/atribucion.js`) NO tiene ni debe tener
// una clave `BLANCO`.
//
// «Blanco» sí declara `crossOrigin: 'anonymous'` aunque no cargue nada: el
// atributo es VACUO ahí (no hay petición que anotar) y se pone para que la
// guarda transversal de la Fase 4 pueda ENUMERAR las capas sin excepciones y
// para que un futuro `createTile` que sí cargara una imagen lo herede. No es
// una afirmación sobre ningún servicio.
//
// ── EL `maxNativeZoom` DE CADA DESCRIPTOR ───────────────────────────────────
// `viewer/mapa.js` dejó DELIBERADAMENTE de conocer el tope nativo (hallazgo 2.7
// de la auditoría: no monta capas, luego no sabe cuál aplica). Quien lo sabe es
// este módulo, así que cada descriptor lo declara y {@link maxZoomNativo} lo
// deriva para el conjunto que se monte. `crearVisor` (tarea 3C) compara ahí el
// `maxZoom` DEL MAPA con el tope nativo de lo REALMENTE montado. Ausente en
// «Blanco» (no hay tesela nativa que reescalar) y en las dos capas del WMS del
// Catastro (una imagen por encuadre, siempre a la resolución del lienzo: no
// existe «zoom nativo» que superar).
//
// Consecuencia operativa que este módulo SÍ aplica: a cada capa teselada se le
// pasa `maxZoom: mapa.getMaxZoom()`. Sin eso, `L.TileLayer` se queda con
// `maxZoom == maxNativeZoom` (20) y `L.Control.Layers#_checkDisabledLayers`
// DESHABILITARÍA el radio de esas capas por encima de z20 — justo donde el spec
// exige poder seguir acercándose para calcar sobre la ortofoto aunque pixele
// (§Interacción, «zoom sin tope artificial»). Con el `maxZoom` del mapa, Leaflet
// reescala la tesela nativa en vez de dejar de pedirla, que es lo correcto.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — Ningún error silencioso: `alAvisar` se RESUELVE aquí
//     (`resolverAvisar`, patrón obligatorio del visor) y se PROPAGA a cada
//     `descriptor.crear(...)`. Es el punto exacto que la auditoría señaló: los
//     descriptores aceptan `opts` precisamente para esto, y montar las capas sin
//     pasar el canal dejaría TODOS los `tileerror` y los fallos del `GetMap` en
//     el `console.warn` por defecto. Un fallo de red de cartografía de fondo es
//     SIEMPRE `NIVEL.AVISO` (nunca ERROR: no bloquea la generación del GML);
//     esa clasificación la aplican los módulos dueños, aquí solo se transporta
//     el canal.
//   · Contrato roto por el programador (id de capa inexistente, mapa que no es un
//     mapa, opacidad INICIAL no numérica o fuera de `[0,1]`) → `throw`
//     (`TypeError` forma, `RangeError` dominio). La ÚNICA opacidad que se acota
//     en vez de lanzar es la que llega del `<input type="range">`, y es la
//     excepción razonada: ver {@link acotarOpacidad} y {@link validarOpacidadInicial}.
//   · Módulo SOLO-NAVEGADOR (importa Leaflet): su test es `*.dom.test.js` y NO
//     entra por el barrel raíz `index.js`. Tampoco importa
//     `leaflet/dist/leaflet.css` — el CSS de Leaflet va solo en la entrada demo
//     de la Fase 4.

import L from 'leaflet'
import { CAPAS_IGN, WMTS_IGN } from '../services/ign.js'
import { CAPA_OSM, OSM } from '../services/osm.js'
import { ATRIBUCION } from './atribucion.js'
import { DENSIDAD_BASE_PX, resolverAvisar } from './_comun.js'
import { OPACIDAD_SUPERPUESTA, crearCapaWMSCatastro } from './wms-catastro.js'

// ── Identidad de las capas ────────────────────────────────────────────────────

/**
 * Claves ESTABLES de las capas del visor. Son las que se indexan, se persisten
 * («qué capa tenía activa el usuario») y se pasan a {@link montarCapas}. Nunca
 * se usa `nombre` para eso: `nombre` es un rótulo de UI, traducible y retocable.
 *
 * Las cuatro primeras las heredan de su módulo dueño (`WMTS_IGN`, `OSM`); las
 * dos del Catastro nacen aquí, porque `viewer/wms-catastro.js` no tiene noción
 * de «id de capa del control» (produce capas por rol, no por identidad).
 */
export const ID_CAPA = Object.freeze({
  CATASTRO: 'catastro',
  PNOA: 'pnoa-ma',
  TOPOGRAFICO: 'mapa-raster',
  OSM: OSM.id,
  BLANCO: 'blanco',
  CATASTRO_SUPERPUESTA: 'catastro-superpuesta',
})

/**
 * Base activa al arrancar el visor: la **Ortofoto PNOA** (decisión del plan
 * maestro para la demo). Es la cartografía sobre la que se calca de verdad, y la
 * que hace visible el sentido de la superpuesta catastral en transparencia.
 */
export const BASE_POR_DEFECTO = ID_CAPA.PNOA

/** Color de la capa «Blanco». Blanco puro: es un lienzo, no un estilo. */
const BLANCO_HEX = '#ffffff'

/** Pasos del `<input type="range">` de opacidad: granularidad del 1 %. */
const PASOS_OPACIDAD = 100

// ── La capa «Blanco» (sin red) ────────────────────────────────────────────────

const CapaBlanca = L.GridLayer.extend({
  options: {
    // Cadena vacía DELIBERADA: no hay datos de terceros que atribuir (ver la
    // cabecera del módulo). `L.Control.Attribution#addAttribution` ignora las
    // cadenas vacías, así que no aparece nada en el control — correcto.
    attribution: '',
    // Vacuo aquí (esta capa no hace ninguna petición) pero declarado para que la
    // enumeración de capas de la guarda transversal (Fase 4) no necesite
    // excepciones. Ver la cabecera.
    crossOrigin: 'anonymous',
    className: 'gml-capa-blanca',
  },

  /**
   * Una tesela = un `<div>` blanco. CERO red: ni URL, ni `data:` URI, ni
   * `new Image()`.
   *
   * @param {{x:number,y:number,z:number}} coords
   * @param {(err:*, tile:HTMLElement) => void} done
   * @returns {HTMLElement}
   */
  createTile(coords, done) {
    const tesela = document.createElement('div')
    tesela.style.backgroundColor = BLANCO_HEX
    // `done` en un MICROTASK, no sincrónicamente: `GridLayer#_addTile` registra
    // la tesela en `this._tiles` DESPUÉS de llamar a `createTile`, así que un
    // `done()` síncrono llegaría a un `_tileReady` que no encuentra la tesela y
    // saldría por su guarda — la capa nunca emitiría `load` ni marcaría las
    // teselas activas. El microtask corre al final del tick actual, ya con la
    // tesela registrada, y no deja temporizadores pendientes en los tests.
    queueMicrotask(() => done(null, tesela))
    return tesela
  },
})

/**
 * Crea la capa base «Blanco»: un lienzo blanco sin ninguna petición de red.
 *
 * @param {{alAvisar?: import('./_comun.js').Avisar, [k: string]: *}} [opts]
 *   `alAvisar` se acepta y se IGNORA a propósito: esta capa no puede fallar
 *   (no habla con nadie), pero debe aceptar las mismas opciones que el resto de
 *   factories para que el descriptor sea intercambiable. El resto de
 *   propiedades se pasan tal cual como opciones de `L.GridLayer`.
 * @returns {import('leaflet').GridLayer}
 */
export function crearCapaBlanca(opts = {}) {
  const { alAvisar, ...opcionesLeaflet } = opts
  // Se resuelve (y por tanto se VALIDA la forma) aunque no se use: si alguien
  // pasa basura donde va el canal de aviso, que salte aquí y no tres capas más
  // allá. Mismo patrón obligatorio que el resto del visor.
  resolverAvisar(alAvisar)

  return new CapaBlanca({
    ...opcionesLeaflet,
    // Invariantes NO negociables, DESPUÉS del spread (misma disciplina que
    // `services/ign.js` y `services/osm.js`).
    attribution: '',
    crossOrigin: 'anonymous',
  })
}

// ── Los seis descriptores ─────────────────────────────────────────────────────

/**
 * Copia congelada de un descriptor con su `maxNativeZoom` declarado. El valor
 * NUNCA se escribe a mano: se lee de la config del módulo dueño (`WMTS_IGN`,
 * `OSM`), igual que hace `services/ign.js#MAX_ZOOM_NATIVO_IGN`.
 *
 * @param {import('./_comun.js').DescriptorCapa} descriptor
 * @param {number} maxNativeZoom
 * @returns {Readonly<import('./_comun.js').DescriptorCapa>}
 */
function conZoomNativo(descriptor, maxNativeZoom) {
  return Object.freeze({ ...descriptor, maxNativeZoom })
}

/**
 * Selecciona un descriptor de `services/ign.js#CAPAS_IGN` por id y le añade su
 * `maxNativeZoom`. Que el id no exista es un contrato roto por el PROGRAMADOR
 * (no hay dato de usuario en el id de un servicio) → `RangeError`, la misma
 * política que `services/ign.js#crearCapaWMTS`.
 *
 * @param {'pnoa-ma'|'ign-base'|'mapa-raster'} id
 * @returns {Readonly<import('./_comun.js').DescriptorCapa>}
 */
function descriptorIGN(id) {
  const descriptor = CAPAS_IGN.find((capa) => capa.id === id)
  const servicio = WMTS_IGN[id]
  if (!descriptor || !servicio) {
    throw new RangeError(
      `viewer/capas.js: id de capa del IGN desconocido: ${JSON.stringify(id)}. ` +
        `Válidos: ${CAPAS_IGN.map((capa) => capa.id).join(', ')}.`,
    )
  }
  return conZoomNativo(descriptor, servicio.maxNativeZoom)
}

/**
 * Base «Catastro»: cartografía catastral OPACA, `pane:'tilePane'`, una imagen
 * por encuadre (jamás teselada). `rol` va DESPUÉS del spread de `opts`: la
 * identidad del descriptor ES su rol, y un llamante no puede convertir esta capa
 * en la superpuesta pasando `{rol:'overlay'}` — para eso está
 * {@link CAPA_SUPERPUESTA}.
 *
 * Sin `maxNativeZoom`: el WMS rasteriza a la resolución del lienzo en cada
 * petición, así que no hay tesela nativa que reescalar (ver cabecera).
 *
 * @type {Readonly<import('./_comun.js').DescriptorCapa>}
 */
export const CAPA_CATASTRO = Object.freeze({
  id: ID_CAPA.CATASTRO,
  nombre: 'Catastro',
  rol: 'base',
  crear: (opts) => crearCapaWMSCatastro({ ...opts, rol: 'base' }),
  atribucion: ATRIBUCION.CATASTRO,
})

/**
 * Base «Blanco»: lienzo sin red. `atribucion: ''` LEGÍTIMA — no hay datos de
 * terceros que citar (razón completa en la cabecera del módulo).
 *
 * @type {Readonly<import('./_comun.js').DescriptorCapa>}
 */
export const CAPA_BLANCO = Object.freeze({
  id: ID_CAPA.BLANCO,
  nombre: 'Blanco',
  rol: 'base',
  crear: (opts) => crearCapaBlanca(opts),
  atribucion: '',
})

/**
 * Las CINCO capas base del spec, en el orden en que se ofrecen al usuario:
 * Catastro · Ortofoto PNOA · Topográfico IGN (MTN) · OpenStreetMap · Blanco.
 *
 * `services/ign.js` aísla TRES servicios WMTS; solo dos entran aquí. **La
 * tercera, `ign-base` («Base IGN»), queda disponible pero FUERA de las cinco**,
 * y es una elección, no un olvido: el spec pide *aislar* las tres WMTS en
 * `services/ign.js` (§Capas) y lista *cinco* capas base, de las cuales solo dos
 * son del IGN («Ortofoto PNOA (IGN)» y «Topográfico IGN»). Montar también
 * `ign-base` daría un control de seis entradas que el spec no pide y añadiría
 * una segunda cartografía vectorial-raster de callejero que se solapa con
 * OpenStreetMap. Quien la quiera (una demo, F16) la tiene a un
 * `descriptorIGN('ign-base')` de distancia, sin tocar `services/ign.js`.
 *
 * @type {ReadonlyArray<Readonly<import('./_comun.js').DescriptorCapa>>}
 */
export const CAPAS_BASE = Object.freeze([
  CAPA_CATASTRO,
  descriptorIGN(ID_CAPA.PNOA),
  descriptorIGN(ID_CAPA.TOPOGRAFICO),
  conZoomNativo(CAPA_OSM, OSM.maxNativeZoom),
  CAPA_BLANCO,
])

/**
 * La capa SUPERPUESTA del spec: cartografía catastral en transparencia sobre
 * cualquier base, `pane:'overlayPane'`, `TRANSPARENT=TRUE` y opacidad regulable
 * con el `<input type="range">` que monta {@link montarCapas}.
 *
 * Misma factory que {@link CAPA_CATASTRO} y distinto `rol`: eso es lo que hace
 * que `viewer/wms-catastro.js` no pueda exportar «su» descriptor (cabecera).
 *
 * @type {Readonly<import('./_comun.js').DescriptorCapa>}
 */
export const CAPA_SUPERPUESTA = Object.freeze({
  id: ID_CAPA.CATASTRO_SUPERPUESTA,
  nombre: 'Cartografía catastral',
  rol: 'overlay',
  crear: (opts) => crearCapaWMSCatastro({ ...opts, rol: 'overlay' }),
  atribucion: ATRIBUCION.CATASTRO,
})

/**
 * TODAS las capas del visor (las cinco bases + la superpuesta) como DATO
 * inspeccionable. Existe para poder recorrerlas SIN montar un mapa: es lo que
 * necesita la guarda transversal de `crossOrigin`/atribución de la Fase 4, y lo
 * que usa el test de este módulo para enumerar invariantes.
 *
 * @type {ReadonlyArray<Readonly<import('./_comun.js').DescriptorCapa>>}
 */
export const CAPAS = Object.freeze([...CAPAS_BASE, CAPA_SUPERPUESTA])

/**
 * Busca un descriptor por su `id` estable entre {@link CAPAS}.
 *
 * @param {string} id
 * @returns {Readonly<import('./_comun.js').DescriptorCapa>}
 * @throws {RangeError}  Si el id no es el de ninguna capa del visor (contrato
 *   roto por el programador: los ids son de {@link ID_CAPA}, no dato de usuario).
 */
export function descriptorPorId(id) {
  const descriptor = CAPAS.find((capa) => capa.id === id)
  if (!descriptor) {
    throw new RangeError(
      `descriptorPorId: id de capa desconocido: ${JSON.stringify(id)}. ` +
        `Válidos: ${CAPAS.map((capa) => capa.id).join(', ')}.`,
    )
  }
  return descriptor
}

/**
 * Tope de zoom NATIVO de un conjunto de capas: el máximo de los `maxNativeZoom`
 * que declaren. **Derivado, nunca escrito a mano.**
 *
 * `null` cuando ninguna capa declara tope nativo. **Hoy ese `null` NO es
 * alcanzable desde el visor**: {@link montarCapas} monta SIEMPRE las seis capas
 * y dos de ellas (PNOA y Topográfico, más OSM) declaran tope, así que el
 * conjunto montado siempre da 20. Es la PREPARACIÓN para cuando se pueda montar
 * un subconjunto —un visor de solo «Catastro» + «Blanco», que el spec admitiría
 * y que fue justo la configuración que el `RangeError` de `viewer/mapa.js`
 * rechazaba mal antes del hallazgo 2.7—; ese montaje parcial **no está
 * implementado y nadie lo pide todavía** (`montarCapas` no acepta ningún
 * parámetro para elegir capas). No lo escribas «porque el `null` está ahí».
 *
 * `null` NO es 0: distinguir «no hay tope» de «el tope es cero» es lo que impide
 * que `crearVisor` invente una comparación falsa el día que ese caso exista.
 *
 * @param {ReadonlyArray<{maxNativeZoom?: number}>} descriptores
 * @returns {number|null}
 * @throws {TypeError}  Si `descriptores` no es un array.
 */
export function maxZoomNativo(descriptores) {
  if (!Array.isArray(descriptores)) {
    throw new TypeError(
      `maxZoomNativo: 'descriptores' debe ser un array de descriptores de capa; ` +
        `recibido ${typeof descriptores}.`,
    )
  }
  const topes = descriptores
    .map((descriptor) => descriptor && descriptor.maxNativeZoom)
    .filter((tope) => typeof tope === 'number' && Number.isFinite(tope))
  return topes.length === 0 ? null : Math.max(...topes)
}

// ── Control de opacidad de la superpuesta ─────────────────────────────────────

/**
 * Acota una opacidad a `[0,1]`. **Uso EXCLUSIVO: el GESTO** — o sea
 * `fijarOpacidad` (API pública equivalente a mover el deslizador) y
 * `_alMoverRango` (el deslizador de verdad). No la llames desde ningún otro
 * sitio.
 *
 * **Por qué aquí se ACOTA y no se lanza**, a diferencia del resto del proyecto:
 * este valor viene de un `<input type="range">`, o sea de un GESTO del usuario
 * sobre una magnitud puramente visual que no puede corromper el modelo. Acotar
 * es la respuesta conservadora y siempre correcta. La FORMA sí es contrato del
 * programador: un valor que no es un número finito → `TypeError`, igual que en
 * todo el visor.
 *
 * La opacidad INICIAL es el caso CONTRARIO y va por {@link validarOpacidadInicial}:
 * la escribe el programador, no la gesticula nadie. Hasta la auditoría de cierre
 * de la fase 3, `montarCapas` acotaba también la inicial antes de pasarla, con lo
 * que el `RangeError` de `viewer/wms-catastro.js` era INALCANZABLE por esa vía y
 * un `crearVisor(el, { opacidad: 5 })` montaba un visor a opacidad 1 sin decir
 * nada: corrección silenciosa de un valor mal escrito, justo lo que prohíbe la
 * regla de oro 1. Dos caminos distintos para dos orígenes distintos, y ninguno
 * invade al otro.
 *
 * @param {number} valor
 * @returns {number}  Valor en `[0,1]`.
 * @throws {TypeError}  Si `valor` no es un número finito.
 */
function acotarOpacidad(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError(
      `opacidad: debe ser un número finito en [0,1]; recibido ${typeof valor} ` +
        `(${JSON.stringify(valor)}).`,
    )
  }
  return Math.min(1, Math.max(0, valor))
}

/**
 * Valida una opacidad INICIAL: la que escribe el PROGRAMADOR al montar el visor
 * (`montarCapas({opacidad})`, `crearVisor(el, {opacidad})`). Política de contrato
 * del proyecto, sin excepciones: `TypeError` si no es un número finito,
 * `RangeError` si está fuera de `[0,1]`. Es la MISMA política —y el mismo par de
 * errores— que aplica `viewer/wms-catastro.js` a su propia opción `opacidad`.
 *
 * Ver {@link acotarOpacidad} para el porqué de la asimetría con el gesto.
 *
 * @param {number} valor
 * @returns {number}  El MISMO valor (validado, nunca modificado).
 * @throws {TypeError}   Si `valor` no es un número finito.
 * @throws {RangeError}  Si `valor` está fuera de `[0,1]`.
 */
function validarOpacidadInicial(valor) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) {
    throw new TypeError(
      `montarCapas: 'opacidad' inicial debe ser un número finito en [0,1]; recibido ` +
        `${typeof valor} (${JSON.stringify(valor)}). (La opacidad del DESLIZADOR sí se ` +
        `acota: es un gesto. Esta la escribes tú.)`,
    )
  }
  if (valor < 0 || valor > 1) {
    throw new RangeError(
      `montarCapas: 'opacidad' inicial debe estar en [0,1]; recibido ${valor}. No se acota ` +
        `en silencio (regla de oro 1): un valor fuera de rango escrito por el programador es ` +
        `un bug, no un gesto que redondear.`,
    )
  }
  return valor
}

/**
 * Control propio de Leaflet con el `<input type="range">` de opacidad de la
 * superpuesta.
 *
 * **Por qué un `L.Control` y no un `<input>` suelto en la página** (decisión de
 * diseño de esta tarea): (1) la entrada demo de la Fase 4 no tiene que cablear
 * DOM a mano ni conocer el id de ningún elemento — pide el visor y el control
 * aparece; (2) vive dentro del contenedor del mapa, así que se posiciona con el
 * sistema de esquinas de Leaflet y se destruye con él (nada que limpiar aparte);
 * (3) puede DESHABILITARSE solo cuando la superpuesta no está activa, que es la
 * única forma de que un control de opacidad no mienta sobre algo que no se ve.
 * Se deshabilita en vez de desaparecer para que la posición del cromo no baile
 * al conmutar la capa.
 *
 * ── SE MUDA A `topright` EL 2026-08-19, Y NO ES UNA PREFERENCIA ─────────────
 * ⛔ **Estaba en `bottomright` y ahí chocaba con la barra de edición del mapa.**
 * `TODOS.md` daba ese solape por cerrado el 2026-08-18 con «0 px²», pero esa
 * medida se tomó con **«Quitar puntos» escondido**, o sea sin la pantalla en la
 * que más botones se ven a la vez: la del levantamiento importado.
 *
 * **MEDIDO EN CHROMIUM A 1280×720, `?demo=real`, el 2026-08-19** (intersección de
 * rectángulos de verdad, no solo el eje X), con las DIEZ herramientas visibles:
 *
 * | | cruce X | cruce Y | área |
 * |---|---|---|---|
 * | Opacidad en `bottomright` (como estaba) | 7,9 px | 38 px | **299,3 px²** |
 * | Opacidad en `topright` (hoy) | 7,9 px | **0 px** | **0 px²** |
 *
 * La barra mide **326 px** con nueve herramientas y **356** con las diez; su borde
 * derecho llega a 1014 y el control de opacidad empieza en 1006,1. O sea que **el
 * cruce horizontal sigue existiendo** —la barra es ancha y va centrada— y lo que
 * lo vuelve inofensivo es que el vecino ya no comparte banda vertical.
 *
 * ⭐ **El defecto EXISTÍA y nadie lo sabía**, porque la cifra que lo declaraba
 * cerrado había caducado sin avisar. Es la misma lección que ese apunte se
 * escribió a sí mismo —«una cifra de maquetación sin fecha de remedición es una
 * cifra que caduca sin avisar»— aplicada a él. Al remedir, comprobar SIEMPRE con
 * qué botones visibles se toma el número.
 *
 * ⚠️ **`topright` no es «una esquina libre cualquiera»: es la del control de
 * capas, y ahí SE APILA debajo**, que es lo que se quiere. Leaflet apila por
 * orden de alta dentro de una esquina, y en {@link montarCapas} el control de
 * capas se da de alta ANTES que éste — así que el orden visual sale solo y no
 * hay que reordenar nada. El de capas nace `collapsed: false` (cinco bases y una
 * superpuesta), así que la columna crece, pero hacia abajo desde el borde
 * superior, que es espacio que en esta aplicación no compite con nada.
 *
 * ⭐ **Lo que esto libera, que es el motivo de la mudanza:** `bottomright` se
 * queda **solo con la atribución de Leaflet**, y la atribución cruza a la barra
 * 196,1 px en horizontal pero **0 en vertical** (medido el 2026-08-18). O sea que
 * el borde inferior derecho deja de ser un vecino con el que chocar.
 */
const ControlOpacidad = L.Control.extend({
  options: {
    position: 'topright',
    etiqueta: 'Opacidad de la cartografía catastral',
  },

  /**
   * @param {object} [opciones]
   * @param {(valor:number)=>void} [opciones.alCambiar]  Se invoca con la
   *   opacidad ya acotada cada vez que cambia (por gesto o por API).
   * @param {number} [opciones.valorInicial]  Opacidad de partida. Es opacidad
   *   INICIAL (la escribe el programador), así que se VALIDA —no se acota—:
   *   ver {@link validarOpacidadInicial}.
   */
  initialize(opciones = {}) {
    const { alCambiar, valorInicial = OPACIDAD_SUPERPUESTA, ...resto } = opciones
    L.setOptions(this, resto)
    if (alCambiar !== undefined && typeof alCambiar !== 'function') {
      throw new TypeError(
        `ControlOpacidad: 'alCambiar' debe ser una función; recibido ${typeof alCambiar}.`,
      )
    }
    this._alCambiar = alCambiar || (() => {})
    this._valor = validarOpacidadInicial(valorInicial)
    this._habilitado = true
  },

  onAdd() {
    const contenedor = L.DomUtil.create('div', 'gml-control-opacidad')
    // Estilos MÍNIMOS en línea: este módulo no importa `leaflet.css` (va solo en
    // la entrada demo de la Fase 4), así que el control tiene que ser legible por
    // sí mismo. Lo justo para que se lea sobre cualquier cartografía; el resto
    // del cromo lo viste la Fase 4.
    //
    // ⭐ LOS TRES VALORES CAMBIARON EL 2026-08-10 (revisión de diseño del autor:
    // «el control de opacidad flota sin peso sobre un fondo ruidoso y se pierde»).
    // Y tienen que cambiarse AQUÍ y no en `estilos/app.css`, porque un estilo en
    // línea gana a cualquier regla sin marca de prioridad —que aquella hoja tiene
    // prohibida— : es el acuerdo escrito en su bloque `.gml-control-opacidad`.
    //   · el fondo pasa de `rgba(255,255,255,0.92)` a BLANCO OPACO. El 8 % de
    //     ortofoto que se colaba era justo lo que impedía leerlo como una tarjeta
    //     que está delante del mapa, que es el encargo entero;
    //   · el relleno pasa de `4px 8px` a `8px 12px` — la rejilla de 8 de
    //     `estilos/tokens/spacing.css`, que este control era el único cromo de la
    //     aplicación en no seguir;
    //   · el radio pasa de 4 a 6 px, que es `--gml-radio`, el ÚNICO radio de la
    //     interfaz desde esa misma revisión.
    // ⚠️ Los 6 px están escritos como literal y no como `var(--gml-radio)` a
    // propósito: este módulo tiene que verse bien SIN la hoja cargada, y una
    // variable sin declarar deja la propiedad en su valor inicial (0). El
    // comentario es lo que ata los dos sitios; ver `.gml-control-opacidad`.
    contenedor.style.background = '#ffffff'
    contenedor.style.padding = '8px 12px'
    contenedor.style.borderRadius = '6px'
    contenedor.style.font = `${DENSIDAD_BASE_PX}px system-ui, sans-serif`

    const id = `gml-opacidad-${L.Util.stamp(this)}`

    const etiqueta = L.DomUtil.create('label', 'gml-control-opacidad-etiqueta', contenedor)
    etiqueta.setAttribute('for', id)
    etiqueta.textContent = this.options.etiqueta
    etiqueta.style.display = 'block'

    const rango = L.DomUtil.create('input', 'gml-control-opacidad-rango', contenedor)
    rango.type = 'range'
    rango.id = id
    rango.min = '0'
    rango.max = String(PASOS_OPACIDAD)
    rango.step = '1'
    rango.value = String(Math.round(this._valor * PASOS_OPACIDAD))
    rango.setAttribute('aria-label', this.options.etiqueta)
    this._rango = rango

    // Sin esto, arrastrar el deslizador ARRASTRARÍA EL MAPA (el contenedor del
    // control vive dentro del contenedor del mapa) y la rueda del ratón sobre el
    // control haría zoom.
    L.DomEvent.disableClickPropagation(contenedor)
    L.DomEvent.disableScrollPropagation(contenedor)
    // `input` cubre el arrastre en vivo; `change` cubre teclado y navegadores
    // que no emitan `input` durante el arrastre. Son idempotentes entre sí.
    L.DomEvent.on(rango, 'input change', this._alMoverRango, this)

    this._reflejarHabilitado()
    return contenedor
  },

  onRemove() {
    if (this._rango) {
      L.DomEvent.off(this._rango, 'input change', this._alMoverRango, this)
    }
    this._rango = null
  },

  /** @returns {number} Opacidad actual, en `[0,1]`. */
  valor() {
    return this._valor
  },

  /**
   * Fija la opacidad (acotada a `[0,1]`), refleja el deslizador y avisa.
   *
   * @param {number} valor
   * @returns {number}  El valor realmente aplicado.
   * @throws {TypeError}  Si `valor` no es un número finito.
   */
  fijar(valor) {
    this._valor = acotarOpacidad(valor)
    if (this._rango) {
      this._rango.value = String(Math.round(this._valor * PASOS_OPACIDAD))
    }
    this._alCambiar(this._valor)
    return this._valor
  },

  /**
   * Habilita/deshabilita el control (la superpuesta no está en el mapa).
   * @param {boolean} activo
   */
  habilitar(activo) {
    this._habilitado = Boolean(activo)
    this._reflejarHabilitado()
  },

  /** @returns {boolean} */
  habilitado() {
    return this._habilitado
  },

  _reflejarHabilitado() {
    if (this._rango) this._rango.disabled = !this._habilitado
    if (this._container) {
      this._container.setAttribute('aria-disabled', String(!this._habilitado))
      this._container.style.opacity = this._habilitado ? '1' : '0.5'
    }
  },

  _alMoverRango() {
    const pasos = Number(this._rango.value)
    // El DOM devuelve una cadena; si por lo que sea no es numerable, se ignora
    // el gesto en vez de romper el visor (es un gesto, no un contrato).
    if (!Number.isFinite(pasos)) return
    this.fijar(pasos / PASOS_OPACIDAD)
  },
})

// ── Montaje ───────────────────────────────────────────────────────────────────

/**
 * ¿Sirve como mapa de Leaflet? DUCK TYPING deliberado, no `instanceof L.Map`,
 * por la misma razón que `viewer/mapa.js#esElementoDOM`: se comprueba lo que de
 * verdad se necesita.
 *
 * @param {*} mapa
 * @returns {boolean}
 */
function esMapa(mapa) {
  return (
    !!mapa &&
    typeof mapa === 'object' &&
    typeof mapa.addLayer === 'function' &&
    typeof mapa.removeLayer === 'function' &&
    typeof mapa.hasLayer === 'function' &&
    typeof mapa.addControl === 'function'
  )
}

/**
 * @typedef {Object} CapasMontadas
 * @property {import('leaflet').Control.Layers} control  El `L.control.layers`
 *   con las cinco bases (radios) y la superpuesta (casilla).
 * @property {import('leaflet').Control} controlOpacidad  El control propio con
 *   el `<input type="range">` de opacidad de la superpuesta.
 * @property {Map<string, object>} bases  Capas base creadas, por `id` estable.
 * @property {Map<string, object>} capas  TODAS las capas creadas, por `id`.
 * @property {object} superpuesta  La capa WMS catastral superpuesta.
 * @property {number|null} maxNativeZoom  Tope nativo del conjunto MONTADO
 *   (derivado con {@link maxZoomNativo} sobre los descriptores que de verdad se
 *   han usado, no sobre el catálogo `CAPAS`); `null` si ninguna capa lo declara.
 *   Hoy siempre 20: se montan SIEMPRE las seis capas (ver {@link maxZoomNativo}).
 * @property {() => string} baseActiva  `id` de la base activa ahora mismo.
 * @property {(id: string) => object} activarBase  Conmuta la base (deja UNA sola).
 * @property {() => boolean} superpuestaActiva
 * @property {(activa?: boolean) => void} activarSuperpuesta
 * @property {() => number} opacidad
 * @property {(valor: number) => number} fijarOpacidad  Acotada a `[0,1]`.
 * @property {() => void} destruir  IDEMPOTENTE.
 */

/**
 * Monta las capas del visor sobre un mapa YA creado (`viewer/mapa.js#crearMapa`):
 * crea las seis capas propagándoles el canal de aviso, añade la base por
 * defecto, monta el `L.control.layers` con las cinco bases + la superpuesta y
 * cablea el control de opacidad.
 *
 * NO encuadra el mapa, NO crea panes y NO toca el control de atribución: eso es
 * de `crearMapa` y de `crearVisor`. Tampoco comprueba el `maxZoom` del mapa
 * contra `maxNativeZoom` — solo lo EXPONE (ver cabecera); esa comprobación es de
 * `crearVisor` (tarea 3C), que es quien decide qué hacer si no se cumple.
 *
 * La superpuesta NO se añade por defecto (`superpuestaInicial: false`): el
 * encargo de esta tarea es «añadir la base por defecto», y arrancar con las dos
 * capas catastrales encendidas costaría 2 peticiones `GetMap` en el primer
 * encuadre sin que el usuario lo haya pedido. La entrada demo de la Fase 4 puede
 * pasar `superpuestaInicial: true` si quiere la vista de calcado desde el
 * arranque.
 *
 * @param {object} opciones
 * @param {import('leaflet').Map} opciones.mapa  Mapa de `crearMapa`.
 * @param {import('./_comun.js').Avisar} [opciones.alAvisar]  Canal de aviso
 *   (regla de oro 1). Se PROPAGA a todas las capas: sin él, los `tileerror` y
 *   los fallos del `GetMap` se quedarían en `console.warn`.
 * @param {string} [opciones.baseInicial='pnoa-ma']  `id` de la base a activar.
 * @param {boolean} [opciones.superpuestaInicial=false]  Activar la superpuesta.
 * @param {number} [opciones.opacidad=0.6]  Opacidad inicial de la superpuesta.
 *   Es opacidad INICIAL, o sea contrato del programador: se VALIDA y no se acota
 *   (ver {@link acotarOpacidad}). Para acotar hay `fijarOpacidad`, que es el gesto.
 * @param {string} [opciones.posicion='topright']  Esquina del control de capas.
 * @param {string} [opciones.posicionOpacidad='topright']  Esquina del control de
 *   opacidad. ⚠️ **Es la MISMA que la de capas a propósito desde el 2026-08-19**:
 *   se apila debajo, y `bottomright` se libera para que la barra de edición deje
 *   de chocar con él. El porqué medido está en {@link ControlOpacidad}.
 * @returns {CapasMontadas}
 * @throws {TypeError}   Si `mapa` no es un mapa de Leaflet, o si `opacidad` no es
 *   un número finito.
 * @throws {RangeError}  Si `baseInicial` no es el `id` de ninguna de las cinco
 *   capas base, o si `opacidad` está fuera de `[0,1]`.
 */
export function montarCapas(opciones = {}) {
  if (opciones === null || typeof opciones !== 'object') {
    throw new TypeError(`montarCapas: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`)
  }
  const {
    mapa,
    alAvisar,
    baseInicial = BASE_POR_DEFECTO,
    superpuestaInicial = false,
    opacidad = OPACIDAD_SUPERPUESTA,
    posicion = 'topright',
    posicionOpacidad = 'topright',
  } = opciones

  if (!esMapa(mapa)) {
    throw new TypeError(
      `montarCapas: 'mapa' debe ser un mapa de Leaflet (el de viewer/mapa.js#crearMapa); ` +
        `recibido ${JSON.stringify(mapa)}.`,
    )
  }
  if (!CAPAS_BASE.some((descriptor) => descriptor.id === baseInicial)) {
    throw new RangeError(
      `montarCapas: 'baseInicial' debe ser el id de una capa BASE; recibido ` +
        `${JSON.stringify(baseInicial)}. Válidos: ${CAPAS_BASE.map((c) => c.id).join(', ')}.`,
    )
  }
  // La opacidad INICIAL la escribe el programador: se valida (TypeError/RangeError),
  // NUNCA se acota. Aquí arriba y no más abajo para que un valor mal escrito falle
  // ANTES de crear ninguna capa (mismo criterio que las dos comprobaciones de
  // encima). Ver `acotarOpacidad`/`validarOpacidadInicial`.
  validarOpacidadInicial(opacidad)

  // Patrón obligatorio del visor: se resuelve UNA vez y se propaga el MISMO
  // avisador a todas las capas (así una UI de avisos recibe todo por un canal).
  const avisar = resolverAvisar(alAvisar)

  // El `maxZoom` del MAPA sube el de las capas teseladas por encima de su tope
  // nativo (ver cabecera: si no, el control deshabilitaría sus radios al pasar
  // de z20 y se perdería el calcado de precisión). Si el mapa no declara un
  // maxZoom finito no hay nada que subir y las capas se quedan en su tope
  // nativo — por eso `crearMapa` fija `maxZoom: 24`.
  const topeMapa = typeof mapa.getMaxZoom === 'function' ? mapa.getMaxZoom() : undefined
  const subirTope = typeof topeMapa === 'number' && Number.isFinite(topeMapa)

  /**
   * Descriptores REALMENTE usados para crear capa, acumulados por
   * {@link crearDesde} conforme se montan. De aquí sale el `maxNativeZoom` que se
   * devuelve, en vez de derivarlo del catálogo completo `CAPAS`: hoy los dos dan
   * 20 —se montan siempre las seis— pero que coincidan tiene que ser una
   * CONSECUENCIA, no una casualidad que se rompa el día que se pueda montar un
   * subconjunto. El typedef promete «tope nativo del conjunto MONTADO»; esto lo
   * cumple.
   *
   * @type {Array<Readonly<import('./_comun.js').DescriptorCapa>>}
   */
  const montados = []

  /**
   * @param {Readonly<import('./_comun.js').DescriptorCapa>} descriptor
   * @param {object} [extra]  Opciones propias de esta capa (p. ej. la `opacidad`
   *   inicial de la superpuesta), ya validadas por el llamante.
   * @returns {object}
   */
  function crearDesde(descriptor, extra) {
    const opts = { alAvisar: avisar, ...extra }
    // Solo a las capas con tope nativo (= teseladas) les importa `maxZoom`. A
    // las del WMS del Catastro se lo pasaríamos para que lo ignorasen en
    // silencio, que es justo lo que no se quiere.
    if (subirTope && descriptor.maxNativeZoom !== undefined) opts.maxZoom = topeMapa
    montados.push(descriptor)
    return descriptor.crear(opts)
  }

  /** @type {Map<string, object>} */
  const bases = new Map()
  for (const descriptor of CAPAS_BASE) bases.set(descriptor.id, crearDesde(descriptor))
  // `opacidad` va SIN acotar: ya está validada arriba (es inicial, la escribe el
  // programador). `viewer/wms-catastro.js` la vuelve a validar por su cuenta.
  const superpuesta = crearDesde(CAPA_SUPERPUESTA, { opacidad })

  /** @type {Map<string, object>} */
  const capas = new Map([...bases, [CAPA_SUPERPUESTA.id, superpuesta]])

  // ── Estado de conmutación ──────────────────────────────────────────────────
  let idBaseActiva = baseInicial
  const idPorSello = new Map([...bases].map(([id, capa]) => [L.Util.stamp(capa), id]))

  // Se escucha en la CAPA (`add`), no en el mapa (`baselayerchange`): así el
  // seguimiento vale igual para un clic en el radio del control y para una
  // llamada programática a `activarBase`, sin depender de que el control de
  // capas esté montado.
  const alAnadirBase = (evento) => {
    const id = idPorSello.get(L.Util.stamp(evento.target))
    if (id !== undefined) idBaseActiva = id
  }
  for (const capa of bases.values()) capa.on('add', alAnadirBase)

  // ── Capas y controles en el mapa ───────────────────────────────────────────
  mapa.addLayer(bases.get(baseInicial))

  const rotulados = {}
  for (const descriptor of CAPAS_BASE) rotulados[descriptor.nombre] = bases.get(descriptor.id)
  const control = L.control.layers(rotulados, { [CAPA_SUPERPUESTA.nombre]: superpuesta }, {
    position: posicion,
    // Desplegado: son cinco bases y una superpuesta, y el spec quiere que
    // CONMUTEN — esconderlas tras un icono que hay que descubrir sería trabajar
    // en contra del criterio de aceptación 1.
    collapsed: false,
  })
  mapa.addControl(control)

  const controlOpacidad = new ControlOpacidad({
    position: posicionOpacidad,
    valorInicial: opacidad,
    alCambiar: (valor) => superpuesta.setOpacity(valor),
  })
  mapa.addControl(controlOpacidad)

  const reflejarSuperpuesta = () => controlOpacidad.habilitar(mapa.hasLayer(superpuesta))
  superpuesta.on('add remove', reflejarSuperpuesta)

  if (superpuestaInicial) mapa.addLayer(superpuesta)
  reflejarSuperpuesta()

  // ── API ────────────────────────────────────────────────────────────────────

  /**
   * Conmuta la base: deja EXACTAMENTE UNA activa. Se quita primero la vieja y
   * se añade después la nueva (el mismo orden que usa `L.Control.Layers`
   * internamente), para que nunca haya dos bases opacas simultáneas.
   *
   * @param {string} id
   * @returns {object}  La capa activada.
   * @throws {RangeError}
   */
  function activarBase(id) {
    const capa = bases.get(id)
    if (!capa) {
      throw new RangeError(
        `activarBase: id de capa BASE desconocido: ${JSON.stringify(id)}. ` +
          `Válidos: ${[...bases.keys()].join(', ')}.`,
      )
    }
    for (const [otroId, otra] of bases) {
      if (otroId !== id && mapa.hasLayer(otra)) mapa.removeLayer(otra)
    }
    if (!mapa.hasLayer(capa)) mapa.addLayer(capa)
    idBaseActiva = id
    return capa
  }

  /** @param {boolean} [activa=true] */
  function activarSuperpuesta(activa = true) {
    if (activa && !mapa.hasLayer(superpuesta)) mapa.addLayer(superpuesta)
    else if (!activa && mapa.hasLayer(superpuesta)) mapa.removeLayer(superpuesta)
  }

  let destruido = false
  function destruir() {
    if (destruido) return
    destruido = true

    superpuesta.off('add remove', reflejarSuperpuesta)
    for (const capa of bases.values()) capa.off('add', alAnadirBase)

    // Los controles PRIMERO: `L.Control.Layers` se reconstruye entero en cada
    // `add`/`remove` de una capa registrada, y quitarlo antes evita ese trabajo
    // inútil sobre un DOM que ya se va.
    control.remove()
    controlOpacidad.remove()

    // Solo NUESTRAS capas y NUESTROS controles. El control de atribución y la
    // barra de escala son de `viewer/mapa.js` y siguen ahí: quitarlos aquí
    // incumpliría el criterio de aceptación 5 en cuanto alguien remontara capas.
    for (const capa of capas.values()) {
      if (mapa.hasLayer(capa)) mapa.removeLayer(capa)
    }
  }

  return {
    control,
    controlOpacidad,
    bases,
    capas,
    superpuesta,
    maxNativeZoom: maxZoomNativo(montados),
    baseActiva: () => idBaseActiva,
    activarBase,
    superpuestaActiva: () => mapa.hasLayer(superpuesta),
    activarSuperpuesta,
    opacidad: () => controlOpacidad.valor(),
    fijarOpacidad: (valor) => controlOpacidad.fijar(valor),
    destruir,
  }
}

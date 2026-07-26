// viewer/index.js — F03 · Tarea 3C. LA API PÚBLICA DEL VISOR.
//
// Es la pieza que convierte los módulos sueltos de `viewer/` en UN VISOR. Todo
// lo que quiera un mapa —la entrada demo de la Fase 4, F05 (búsqueda/carga de
// parcela) y F06 (edición)— importa ESTE fichero y nada más de `viewer/`:
//
//   import { crearVisor } from './viewer/index.js'
//
// ── QUÉ ENSAMBLA, EN QUÉ ORDEN Y POR QUÉ ────────────────────────────────────
//   1. `crearMapa`     — el `L.Map` con `zoomSnap:0`, `maxZoom` alto, los TRES
//                        panes del visor, la barra de escala métrica y el
//                        control de atribución blindado. El mapa nace SIN VISTA
//                        a propósito (ver punto 4).
//   2. `montarCapas`   — las cinco bases + la superpuesta, el control de capas y
//                        el de opacidad. Va DESPUÉS del mapa porque necesita el
//                        `maxZoom` del mapa para subir el tope de las teseladas.
//   3. `sincronizar`   — tabla de vértices ↔ dibujo, ambos vistas del mismo
//                        `estado`. Va DESPUÉS de las capas para que la geometría
//                        del usuario se cablee sobre un mapa ya completo.
//   4. ENCUADRE        — el ÚLTIMO paso, y no por casualidad. Leaflet difiere el
//                        `onAdd` de toda capa hasta que el mapa tiene vista
//                        (`Map#addLayer` → `whenReady`), así que encuadrar al
//                        final significa que la capa WMS del Catastro emite su
//                        PRIMERA petición ya sobre el encuadre definitivo: UNA
//                        petición, no una para un encuadre intermedio y otra
//                        para el bueno (criterio de aceptación 2).
//
// `destruir()` deshace exactamente eso EN ORDEN INVERSO (sincronización →
// capas → mapa) y es IDEMPOTENTE. Y si algo falla A MITAD del ensamblaje —el
// `throw` del encuadre mudo y el del tope de zoom son caminos DOCUMENTADOS que
// un programador va a pisar en desarrollo— se deshace lo ya montado antes de
// propagar el error: `crearVisor` es atómica, o devuelve un visor entero o no
// deja nada en el contenedor. Un mapa Leaflet a medio montar en el DOM es una
// fuga silenciosa (listeners de `window`, controles, imágenes en vuelo).
//
// ── EL CONTRATO DE VIEWPORT — NUNCA UN ENCUADRE MUDO (hallazgo C5) ───────────
// Un visor que arranca mirando a un sitio arbitrario porque nadie decidió dónde
// mirar es un FALLO SILENCIOSO, y la regla de oro 1 lo prohíbe. La cascada, en
// este orden estricto:
//
//   1. ¿El `estado` trae geometría (recintos con vértices finitos)?
//      → `fitBounds` sobre TODOS los vértices de TODOS los recintos, con
//        margen ({@link MARGEN_ENCUADRE_PX}). Caso degenerado (un solo vértice,
//        o todos coincidentes): los bounds no tienen extensión y `fitBounds`
//        daría el `maxZoom` del mapa (24) sobre un punto — ahí se hace un
//        `setView` explícito a {@link ZOOM_PUNTO}. Ver {@link EXTENSION_MINIMA_M}.
//   2. ¿No hay geometría pero sí `opciones.vistaInicial` ({centro, zoom})?
//      → `setView`. Es la vía EXPLÍCITA: el llamante dice dónde mirar.
//   3. ¿Ninguna de las dos? → **`throw`**. No es un dato malo del usuario: es
//      el llamante que no ha decidido dónde mirar, o sea un bug. El mensaje
//      nombra las DOS salidas.
//
// Cuando vienen las dos, MANDA la geometría (y `vistaInicial` se ignora): mirar
// a otro sitio teniendo la parcela cargada no le sirve a nadie. Es una
// precedencia documentada, no un descarte silencioso.
//
// ⚠️ A quien venga dentro de seis meses a "simplificar" esto poniendo un centro
// por defecto (Madrid, el centroide de España, la última vista guardada…): ESE
// es justo el fallo que este contrato existe para impedir. La vía para "un
// visor sin parcela" ya está, se llama `vistaInicial`, y obliga a que alguien
// escriba conscientemente el centro y el zoom.
//
// ── EL TOPE DE ZOOM VIVE AQUÍ, NO EN `viewer/mapa.js` ───────────────────────
// `montarCapas` devuelve el `maxNativeZoom` DERIVADO de las capas realmente
// montadas. **Hoy vale SIEMPRE 20**: `montarCapas` monta las seis capas y no
// acepta ningún parámetro para montar un subconjunto. El `null` que su contrato
// admite («ninguna capa montada tiene tope nativo», que sería el caso de un
// visor de solo Catastro + Blanco) es PREPARACIÓN para cuando ese montaje
// parcial exista, no un caso alcanzable ahora — y por eso la rama
// `if (typeof maxNativeZoom !== 'number') return` de `comprobarTopeDeZoom` es
// hoy código muerto en producción, deliberadamente. Si lo hay y el `maxZoom` del
// mapa no lo supera, el visor no podría acercarse más allá de la resolución
// nativa —que es exactamente lo que el spec exige para calcar sobre la ortofoto
// aunque pixele— y además `L.Control.Layers#_checkDisabledLayers` deshabilitaría
// los radios de las teseladas. Es un error de configuración del PROGRAMADOR:
// `RangeError`, con el valor que haría falta escrito en el mensaje.
// `viewer/mapa.js` dejó deliberadamente de conocer este dato (hallazgo 2.7 de la
// auditoría de coherencia): no monta capas, luego no sabe cuál aplica. Quien lo
// sabe es esta función, que es quien las monta.
//
// ── ATRIBUCIÓN (criterio de aceptación 5): NADA ACTIVO QUE HACER ────────────
// Cada capa lleva su `attribution` y el control NATIVO de Leaflet las muestra y
// las oculta según cuál esté activa. Aquí NO se usa
// `viewer/atribucion.js#atribucionCombinada`: esa es para el pie del PDF de F09
// y usarla en el visor DUPLICARÍA la atribución en pantalla. El test de este
// módulo sí comprueba que la atribución acaba visible en el DOM.
//
// ── ESTE FICHERO NO ENTRA EN EL BARREL RAÍZ `index.js` (hallazgo C1/T10) ────
// Importa Leaflet (vía `mapa.js`/`capas.js`/`sincronizacion.js`), y el barrel
// raíz lo cargan los tests del proyecto Vitest `node`, que corre sin `window`.
// El visor se consume importando `viewer/index.js` DIRECTAMENTE. El invariante
// lo vigila `test/contrato.test.js`. Tampoco se importa
// `leaflet/dist/leaflet.css`: el CSS de Leaflet va solo en la entrada demo de la
// Fase 4.

import { husoPorSrs } from '../geo/huso.js'
import { resolverAvisar, validarVistaInicial, vertUTMaLatLng, NIVEL } from './_comun.js'
import { crearMapa } from './mapa.js'
import { montarCapas } from './capas.js'
import { sincronizar } from './sincronizacion.js'

// ── Constantes del encuadre ──────────────────────────────────────────────────

/**
 * Margen (en píxeles CSS) que `fitBounds` deja alrededor de la geometría. Sin
 * él la parcela toca literalmente los cuatro bordes del lienzo y sus vértices
 * quedan medio tapados por el cromo del visor (control de capas arriba a la
 * derecha, escala y opacidad abajo).
 */
const MARGEN_ENCUADRE_PX = 32

/**
 * Extensión (en METROS, unidades del modelo) por debajo de la cual la geometría
 * se considera un PUNTO y no un recinto encuadrable.
 *
 * Medio metro es la tolerancia catastral urbana que el proyecto ya maneja
 * (±0,5 m; ver la cabecera de `viewer/wms-catastro.js`): por debajo de eso no
 * hay "recinto" que encuadrar, hay un punto. Y la razón técnica de tratarlo
 * aparte: con bounds de extensión CERO, `Map#getBoundsZoom` calcula una escala
 * infinita y devuelve el `maxZoom` del mapa (24), o sea que el visor arrancaría
 * con el zoom pegado al tope sobre un único vértice — un encuadre absurdo, que
 * es justo lo que el contrato de viewport quiere impedir.
 *
 * Se compara contra el MÁXIMO de los dos ejes a propósito: una geometría
 * degenerada en UN solo eje (todos los vértices alineados) sí la encuadra
 * `fitBounds` sin problema — el eje con extensión manda en la escala.
 */
const EXTENSION_MINIMA_M = 0.5

/**
 * Zoom con el que se encuadra una geometría degenerada en un punto. Escala de
 * parcela y por debajo del tope nativo de las teseladas (20), así que la
 * ortofoto se ve nítida. Si el `maxZoom` del mapa fuera menor, Leaflet lo acota
 * solo (`Map#_limitZoom`).
 */
const ZOOM_PUNTO = 19

// ── Helpers privados ─────────────────────────────────────────────────────────

/**
 * ¿Sirve como store de `crearEstadoVista`? DUCK TYPING deliberado, igual que
 * `viewer/mapa.js#esElementoDOM` y `viewer/capas.js#esMapa`: se comprueba lo que
 * de verdad se usa. Se valida AQUÍ (y no solo dentro de `sincronizar`) porque
 * `crearVisor` LEE el estado por su cuenta para decidir el encuadre.
 *
 * @param {*} estado
 * @returns {boolean}
 */
function esStore(estado) {
  return (
    !!estado &&
    typeof estado === 'object' &&
    typeof estado.get === 'function' &&
    typeof estado.set === 'function' &&
    typeof estado.subscribe === 'function'
  )
}

/**
 * Prefijo del mensaje de error de `viewer/_comun.js#validarVistaInicial` para
 * este módulo.
 *
 * El VALIDADOR es compartido con `viewer/mapa.js` (auditoría de cierre de la
 * fase 3, punto 4: eran dos copias y ya habían divergido). Lo que `crearVisor`
 * sigue SIN delegar es la APLICACIÓN de la opción: el encuadre va DESPUÉS de
 * montar las capas (ver la cabecera) y `crearMapa` la aplicaría de inmediato.
 * Aquí se valida ANTES de montar nada, aunque la `vistaInicial` acabe sin usarse
 * por haber geometría: una vista malformada es un bug del llamante lo mire quien
 * lo mire, y tragárselo por "total, no la iba a usar" sería un error silencioso.
 */
const CONTEXTO_VISTA_INICIAL = "crearVisor: 'opciones.vistaInicial'"

/**
 * TODOS los vértices UTM finitos de TODOS los recintos del estado, aplanados.
 *
 * Se encuadra sobre `recintos` (la geometría EDITABLE), no sobre
 * `geometriaOficial`: la oficial es la referencia congelada del Catastro y,
 * cuando existe, la editable nace de ella — encuadrar sobre las dos no cambiaría
 * el resultado en el caso normal y en el caso editado mostraría de más.
 *
 * Un vértice NO FINITO se descarta y se AVISA (nunca en silencio: regla de oro
 * 1). No es paranoia: `L.LatLng` LANZA con un `NaN`, así que un solo vértice
 * corrupto tumbaría el encuadre entero con un error de Leaflet ilegible en vez
 * de con un aviso que el usuario pueda entender.
 *
 * @param {object|null} parcela
 * @param {import('./_comun.js').Avisar} avisar
 * @returns {Array<[number, number]>}
 */
function verticesFinitos(parcela, avisar) {
  const recintos = parcela && Array.isArray(parcela.recintos) ? parcela.recintos : []
  const vertices = []
  let descartados = 0

  for (const recinto of recintos) {
    if (!recinto || !Array.isArray(recinto.vertices)) continue
    for (const vertice of recinto.vertices) {
      if (Array.isArray(vertice) && Number.isFinite(vertice[0]) && Number.isFinite(vertice[1])) {
        vertices.push([vertice[0], vertice[1]])
      } else {
        descartados++
      }
    }
  }

  if (descartados > 0) {
    avisar(
      `La parcela tiene ${descartados} vértice(s) con coordenadas no numéricas: el encuadre ` +
        `inicial del mapa los ignora.`,
      // AVISO y no ERROR: el visor se encuadra igual con el resto de vértices y
      // el GML se puede seguir generando (la regla está junto al typedef
      // `Avisar` de `viewer/_comun.js`).
      { nivel: NIVEL.AVISO },
    )
  }

  return vertices
}

/**
 * Extensión (m) y centro (UTM) de una nube de vértices UTM no vacía.
 *
 * Se calcula en UTM —no en lat/lon— porque el modelo va en metros (regla de oro
 * 3) y "medio metro" solo significa algo en metros. La proyección a lat/lon
 * ocurre después, y solo para pintar.
 *
 * @param {Array<[number, number]>} vertices  No vacío.
 * @returns {{ancho:number, alto:number, centro:[number, number]}}
 */
function extensionUTM(vertices) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of vertices) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return {
    ancho: maxX - minX,
    alto: maxY - minY,
    centro: [(minX + maxX) / 2, (minY + maxY) / 2],
  }
}

/**
 * La CASCADA DEL VIEWPORT (hallazgo C5). Ver la cabecera del módulo: geometría →
 * `vistaInicial` → `throw`. Nunca hay una cuarta rama que "mire a algún sitio".
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa
 * @param {import('./_comun.js').EstadoVista} args.estado
 * @param {number} args.zona
 * @param {{centro:[number,number], zoom:number}} [args.vistaInicial]
 * @param {import('./_comun.js').Avisar} args.avisar
 * @returns {'geometria'|'vistaInicial'}  Qué rama se ha aplicado (para el JSDoc
 *   del que lee, y para que el test afirme la precedencia sin adivinar).
 * @throws {TypeError} Si no hay ni geometría ni `vistaInicial`.
 */
function encuadrar({ mapa, estado, zona, vistaInicial, avisar }) {
  const vertices = verticesFinitos(estado.get(), avisar)

  // 1 · Geometría: manda siempre que la haya, aunque venga también vistaInicial.
  if (vertices.length > 0) {
    const { ancho, alto, centro } = extensionUTM(vertices)

    // Caso degenerado (un vértice, o todos coincidentes): `fitBounds` sobre
    // bounds sin extensión daría el maxZoom del mapa. Se encuadra el punto a un
    // zoom de parcela, explícitamente.
    if (Math.max(ancho, alto) < EXTENSION_MINIMA_M) {
      mapa.setView(vertUTMaLatLng(centro, zona), ZOOM_PUNTO)
      return 'geometria'
    }

    // `fitBounds` acepta directamente el array de [lat,lon] como bounds. Se
    // proyecta VÉRTICE A VÉRTICE (no las dos esquinas del bbox UTM): la
    // desproyección UTM→lat/lon no conserva los ejes —la convergencia de
    // meridianos es una rotación— y el bbox de las esquinas dejaría fuera parte
    // de la parcela.
    mapa.fitBounds(
      vertices.map((vertice) => vertUTMaLatLng(vertice, zona)),
      { padding: [MARGEN_ENCUADRE_PX, MARGEN_ENCUADRE_PX] },
    )
    return 'geometria'
  }

  // 2 · La vía explícita.
  if (vistaInicial !== undefined) {
    mapa.setView(vistaInicial.centro, vistaInicial.zoom)
    return 'vistaInicial'
  }

  // 3 · Nadie ha decidido dónde mirar: es un bug, no un dato malo.
  throw new TypeError(
    `crearVisor: no hay dónde mirar y el visor NUNCA encuadra a un sitio arbitrario ` +
      `(regla de oro 1: ningún fallo silencioso). Hay que darle UNA de estas dos salidas: ` +
      `(1) un 'estado' con GEOMETRÍA —una parcela con recintos[].vertices en UTM—, sobre la ` +
      `que se hace fitBounds; o (2) 'opciones.vistaInicial' = {centro:[lat,lon], zoom:number}, ` +
      `la vía explícita para arrancar sin parcela. No se ha recibido ninguna de las dos.`,
  )
}

/**
 * El `maxZoom` del mapa TIENE que superar el zoom nativo de las capas montadas
 * (ver la cabecera del módulo). Vive aquí porque solo aquí se sabe qué capas hay.
 *
 * @param {import('leaflet').Map} mapa
 * @param {number|null} maxNativeZoom  El DERIVADO que devuelve `montarCapas`;
 *   `null` = ninguna capa montada tiene tope nativo (nada que comprobar). Hoy
 *   `null` NO ocurre —se montan siempre las seis capas y tres declaran tope—, así
 *   que esa primera rama es código muerto en producción a propósito: es el
 *   contrato correcto para cuando `montarCapas` sepa montar un subconjunto, y
 *   quitarla obligaría a reescribirla entonces. Ver la cabecera del módulo.
 * @returns {void}
 * @throws {RangeError}
 */
function comprobarTopeDeZoom(mapa, maxNativeZoom) {
  if (typeof maxNativeZoom !== 'number') return
  const tope = mapa.getMaxZoom()
  if (tope > maxNativeZoom) return

  throw new RangeError(
    `crearVisor: 'maxZoom' del mapa (${tope}) no supera el zoom nativo de las capas montadas ` +
      `(${maxNativeZoom}). El spec exige poder acercarse MÁS ALLÁ de la resolución nativa para ` +
      `calcar sobre la ortofoto aunque pixele, y además L.Control.Layers deshabilitaría los ` +
      `radios de las capas teseladas al llegar a z${maxNativeZoom}. Usa maxZoom > ` +
      `${maxNativeZoom} (el defecto de crearMapa, 24, ya lo cumple).`,
  )
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Visor
 * @property {import('leaflet').Map} mapa  El `L.Map` ya encuadrado y con capas.
 * @property {import('./_comun.js').EstadoVista} estado  EL MISMO store que se
 *   pasó en las opciones, devuelto por comodidad (ver el JSDoc de `crearVisor`).
 * @property {import('./capas.js').CapasMontadas} capas  Lo que devuelve
 *   `montarCapas`: conmutar base, activar la superpuesta, regular la opacidad…
 * @property {() => void} destruir  Deshace TODO el ensamblaje en orden inverso
 *   (sincronización → capas → mapa). IDEMPOTENTE: llamarlo dos veces no lanza.
 */

/**
 * Crea el visor completo de F03: mapa + capas + tabla de vértices sincronizada,
 * encuadrado según el contrato de viewport (ver la cabecera del módulo).
 *
 * ── RECIBE EL STORE, NO UNA PARCELA (decisión, una sola forma) ───────────────
 * `opciones.estado` es el store YA CREADO con
 * `viewer/_comun.js#crearEstadoVista(parcela)`. No se admite pasar una parcela
 * "y que el visor cree el store": sería un segundo camino para lo mismo y, sobre
 * todo, dejaría al llamante sin el store, que es justo la pieza que F05 (cargar
 * una parcela nueva), F06 (undo/redo) y cualquier otra vista de la Fase 4
 * necesitan COMPARTIR con el mapa. El store se devuelve en el resultado por pura
 * comodidad (`visor.estado`), pero es el mismo objeto que entró.
 *
 * ```js
 * const estado = crearEstadoVista(parcela)
 * const visor = crearVisor(document.getElementById('mapa'), {
 *   estado, tablaEl: document.getElementById('tabla'), srs: 'EPSG:25830',
 *   alAvisar: (mensaje, detalle) => panelDeAvisos.mostrar(mensaje, detalle),
 * })
 * // … más tarde:
 * estado.set(otraParcela)   // mapa y tabla se repintan solos
 * visor.destruir()
 * ```
 *
 * @param {HTMLElement} contenedor  Elemento del DOM donde montar el mapa.
 * @param {object} opciones  **Las claves que NO estén documentadas abajo se pasan
 *   TAL CUAL a `L.map`** (vía `crearMapa`) — misma convención que
 *   `crearMapa(el, opts)` y `crearCapaWMTS(id, opts)`: es un rest sobre
 *   `opciones`, no una clave anidada. Se escribe
 *   `crearVisor(el, { …, zoomAnimation: false })`, NO
 *   `crearVisor(el, { opcionesLeaflet: {…} })` (hallazgo 2.1: esa forma la
 *   ignora Leaflet EN SILENCIO). Ninguna de ellas puede pisar `zoomSnap`,
 *   `maxZoom` ni `attributionControl`.
 * @param {import('./_comun.js').EstadoVista} opciones.estado  Store de
 *   `crearEstadoVista`. Mapa y tabla son dos vistas de ÉL (no de una copia).
 * @param {HTMLElement} opciones.tablaEl  El `<table>` de vértices, o el
 *   contenedor donde crearlo. Su interior pasa a ser de `sincronizar`.
 * @param {'EPSG:25829'|'EPSG:25830'|'EPSG:25831'} opciones.srs  SRS del modelo,
 *   en forma corta. Se traduce a huso con `geo/huso.js#husoPorSrs` (que es quien
 *   lanza si no está soportado): `sincronizar` y la proyección del encuadre
 *   necesitan `zona`, no `srs`.
 * @param {{centro:[number,number], zoom:number}} [opciones.vistaInicial]  Dónde
 *   mirar CUANDO NO HAY GEOMETRÍA. Si el estado trae geometría se ignora (manda
 *   la geometría). Sin geometría y sin esto, `crearVisor` LANZA.
 * @param {import('../edit/historial.js').Historial|null} [opciones.historial=null]
 *   Historial de `edit/historial.js`. Se propaga a `sincronizar`, que commitea
 *   una instantánea por operación acabada; F06 enchufará undo/redo encima.
 * @param {import('./_comun.js').Avisar} [opciones.alAvisar]  Canal de aviso
 *   (regla de oro 1). Se resuelve UNA vez y se propaga a `montarCapas` Y a
 *   `sincronizar`: es el ÚNICO camino para que un fallo de red de la cartografía
 *   o una celda ilegible lleguen a la UI de avisos en vez de quedarse en el
 *   `console.warn` por defecto.
 * @param {string} [opciones.baseInicial='pnoa-ma']  Id de la capa base activa al
 *   arrancar (`viewer/capas.js#ID_CAPA`).
 * @param {boolean} [opciones.superpuestaInicial=false]  Arrancar con la
 *   cartografía catastral superpuesta encendida.
 * @param {number} [opciones.opacidad=0.6]  Opacidad inicial de la superpuesta.
 * @param {string} [opciones.posicion='topright']  Esquina del control de capas.
 * @param {string} [opciones.posicionOpacidad='bottomright']  Esquina del control
 *   de opacidad.
 * @param {number} [opciones.maxZoom=24]  Tope de zoom del mapa. DEBE superar el
 *   `maxNativeZoom` de las capas montadas o se lanza `RangeError` (ver cabecera).
 * @returns {Visor}
 * @throws {TypeError}  Contrato del programador: `opciones` no es un objeto,
 *   `estado` no es el store, `vistaInicial` malformada, `srs` no es un string
 *   (desde `husoPorSrs`), `contenedor`/`tablaEl` no son elementos del DOM (desde
 *   `crearMapa`/`sincronizar`), o **no hay ni geometría ni `vistaInicial`**.
 * @throws {RangeError}  `srs` no soportado (desde `husoPorSrs`), `baseInicial`
 *   inexistente (desde `montarCapas`), o `maxZoom` que no supera el zoom nativo
 *   de las capas montadas.
 */
export function crearVisor(contenedor, opciones = {}) {
  if (opciones === null || typeof opciones !== 'object') {
    throw new TypeError(`crearVisor: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`)
  }

  const {
    estado,
    tablaEl,
    srs,
    vistaInicial,
    historial = null,
    alAvisar,
    baseInicial,
    superpuestaInicial,
    opacidad,
    posicion,
    posicionOpacidad,
    maxZoom,
    ...opcionesMapa
  } = opciones

  // ── Contratos que consume ESTA función, comprobados ANTES de montar nada ──
  // (lo que consumen los módulos ensamblados lo comprueban ellos; aquí solo lo
  // propio: el estado se LEE para el encuadre, la zona se USA para proyectar).
  if (!esStore(estado)) {
    throw new TypeError(
      `crearVisor: 'opciones.estado' debe ser el store de crearEstadoVista ` +
        `({get,set,subscribe}); recibido ${JSON.stringify(estado)}. El visor NO crea el ` +
        `store: lo crea el llamante para poder compartirlo con el resto de vistas.`,
    )
  }
  // TypeError si no es string, RangeError si el huso no está soportado. Es
  // contrato del programador: el `srs` sale del Expediente, no lo teclea nadie.
  const zona = husoPorSrs(srs)
  // Un solo avisador para todo el visor (y su forma queda validada ya aquí).
  const avisar = resolverAvisar(alAvisar)
  if (vistaInicial !== undefined) validarVistaInicial(vistaInicial, CONTEXTO_VISTA_INICIAL)

  // Pila de deshacer: se apila cada pieza montada y se desapila en orden inverso,
  // tanto en `destruir()` como si el ensamblaje falla a mitad (ver cabecera).
  /** @type {Array<() => void>} */
  const deshacer = []

  try {
    // 1 · El mapa (sin vista: el encuadre es el paso 4).
    const { mapa, panes, destruir: destruirMapa } = crearMapa(contenedor, {
      ...opcionesMapa,
      maxZoom,
    })
    deshacer.push(() => destruirMapa())

    // 2 · Las capas (necesitan el maxZoom del mapa para subir el de las teseladas).
    const capas = montarCapas({
      mapa,
      alAvisar: avisar,
      baseInicial,
      superpuestaInicial,
      opacidad,
      posicion,
      posicionOpacidad,
    })
    deshacer.push(() => capas.destruir())

    // La comprobación del tope, en cuanto se sabe qué capas hay de verdad.
    comprobarTopeDeZoom(mapa, capas.maxNativeZoom)

    // 3 · Tabla ↔ dibujo, ambos vistas del mismo estado.
    const sincronizacion = sincronizar({
      mapa,
      panes,
      estado,
      tablaEl,
      zona,
      historial,
      alAvisar: avisar,
    })
    deshacer.push(() => sincronizacion.destruir())

    // 4 · El encuadre, lo ÚLTIMO (ver cabecera: así la capa WMS del Catastro
    // pide UNA sola imagen, y del encuadre bueno).
    encuadrar({ mapa, estado, zona, vistaInicial, avisar })

    let destruido = false
    return {
      mapa,
      estado,
      capas,
      destruir() {
        if (destruido) return
        destruido = true
        desmontar(deshacer)
      },
    }
  } catch (error) {
    // Ensamblaje atómico: o hay visor, o no queda nada montado en el contenedor.
    desmontar(deshacer)
    throw error
  }
}

/**
 * Desapila y ejecuta la pila de deshacer (orden inverso al de montaje). Un
 * fallo desmontando NUNCA debe enmascarar el error que provocó el desmontaje ni
 * dejar sin ejecutar el resto de la pila.
 *
 * @param {Array<() => void>} deshacer
 * @returns {void}
 */
function desmontar(deshacer) {
  while (deshacer.length > 0) {
    const paso = deshacer.pop()
    try {
      paso()
    } catch {
      /* se sigue desmontando: lo que importa es no dejar piezas vivas */
    }
  }
}

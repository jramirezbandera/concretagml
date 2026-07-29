// viewer/index.js — F03 · Tarea 3C. LA API PÚBLICA DEL VISOR.
//
// Es la pieza que convierte los módulos sueltos de `viewer/` en UN VISOR. Todo
// lo que quiera un mapa —la entrada demo de la Fase 4, F05 (búsqueda/carga de
// parcela) y F06 (edición)— importa ESTE fichero y nada más de `viewer/`:
//
//   import { crearVisor } from './viewer/index.js'
//
// ── QUÉ ENSAMBLA, EN QUÉ ORDEN Y POR QUÉ ────────────────────────────────────
//   1. `crearMapa`     — el `L.Map` con `zoomSnap:0`, `maxZoom` alto, los panes
//                        del visor, la barra de escala métrica y el control de
//                        atribución blindado. El mapa nace SIN VISTA a propósito
//                        (ver punto 6).
//   2. `montarCapas`   — las cinco bases + la superpuesta, el control de capas y
//                        el de opacidad. Va DESPUÉS del mapa porque necesita el
//                        `maxZoom` del mapa para subir el tope de las teseladas.
//   3. EDICIÓN (F06)   — `crearAcotaciones` + `crearEdicion`, y SOLO si el
//                        llamante ha pedido `opciones.edicion`. Va ANTES de
//                        `sincronizar`, que es justo lo contrario de lo que
//                        sugiere el orden visual —primero el dibujo, luego lo que
//                        se cuelga de él—, y por eso está escrito aquí en vez de
//                        confiarlo a la intuición del que venga a "ordenarlo":
//                        `sincronizar` CONSUME los tres ganchos de F06
//                        (`ajustar`, `alCrearMarcador`, `alPrevisualizar`) y los
//                        recibe UNA SOLA VEZ, al construirse. No existe ninguna
//                        vía para enchufarlos después. Montar la edición detrás
//                        dejaría un visor con la capa de edición viva y los
//                        marcadores SIN cablear: parecería que edita y no
//                        editaría, en silencio — el fallo que la regla de oro 1
//                        prohíbe. Si algún día hay que mover este paso, lo que
//                        hay que cambiar antes es el contrato de `sincronizar`.
//   4. `sincronizar`   — tabla de vértices ↔ dibujo, ambos vistas del mismo
//                        `estado`. Va DESPUÉS de las capas para que la geometría
//                        del usuario se cablee sobre un mapa ya completo, y
//                        recibe los ganchos del paso 3 — o los TRES en `null`,
//                        que es el visor de F03 EXACTO (`edicion:false`, el
//                        defecto).
//   5. DIAGNÓSTICO (F07) — `crearCajonDiagnostico` + `crearContraste`, y SOLO si
//                        el llamante ha pedido `opciones.diagnostico`. Va DESPUÉS
//                        de `sincronizar` y no antes, al revés que la edición, y
//                        la asimetría tiene una razón concreta: el diagnóstico NO
//                        entrega ningún gancho a `sincronizar` — no dibuja durante
//                        el arrastre ni mide en cada frame. Lo pinta el cableado
//                        de la app cuando el store cierra una operación, que es
//                        una vez por gesto acabado y no sesenta veces por segundo.
//                        Al no haber dependencia, manda el orden natural: primero
//                        la geometría, después la anotación que la comenta. Lo que
//                        sí es obligatorio es que vaya ANTES del encuadre, y por
//                        partida doble: para que el ensamblaje siga siendo atómico
//                        (el `throw` del encuadre mudo tiene que llevarse por
//                        delante también el cajón) y porque el cajón es un control
//                        del mapa que `app/cableado-diagnostico.js` resuelve por
//                        selector — cuando `crearVisor` devuelve, sus nodos ya
//                        tienen que estar en el documento.
//   6. ENCUADRE        — el ÚLTIMO paso, y no por casualidad. Leaflet difiere el
//                        `onAdd` de toda capa hasta que el mapa tiene vista
//                        (`Map#addLayer` → `whenReady`), así que encuadrar al
//                        final significa que la capa WMS del Catastro emite su
//                        PRIMERA petición ya sobre el encuadre definitivo: UNA
//                        petición, no una para un encuadre intermedio y otra
//                        para el bueno (criterio de aceptación 2).
//
// `destruir()` deshace exactamente eso EN ORDEN INVERSO (diagnóstico →
// sincronización → edición → acotaciones → capas → mapa) y es IDEMPOTENTE. Ese
// orden tampoco es decorativo: `crearEdicion` APAGA el `doubleClickZoom` mientras vive
// —el doble clic inserta un vértice— y lo restaura al destruirse, así que tiene
// que desmontarse con el mapa todavía en pie. Y si algo falla A MITAD del
// ensamblaje —el `throw` del encuadre mudo, el del tope de zoom y el de una
// opción de edición malformada son caminos DOCUMENTADOS que un programador va a
// pisar en desarrollo— se deshace lo ya montado antes de propagar el error:
// `crearVisor` es atómica, o devuelve un visor entero o no deja nada en el
// contenedor. Un mapa Leaflet a medio montar en el DOM es una fuga silenciosa
// (listeners de `window`, controles, imágenes en vuelo).
//
// ── LAS VISTAS EN VIVO NO PINTAN HASTA DESPUÉS DEL ENCUADRE ────────────────
// `sincronizar` avisa a `alPrevisualizar` al cerrar CADA render, y su primer
// render ocurre en el paso 4 — o sea, con el mapa aún sin vista. Las acotaciones
// miden en PÍXELES DE PANTALLA (`Map#latLngToLayerPoint`), y sobre un mapa sin
// vista eso no da un número malo: LANZA (`_checkIfLoaded`: «Set map center and
// zoom first»). Ese `throw` no tumbaría nada —`sincronizacion.js` protege el
// gancho— pero sí dejaría un aviso espurio en la UI en CADA arranque con
// edición, que es ruido indistinguible de un fallo real. Así que el puente de
// previsualización nace MUDO y se abre justo después del encuadre, con un
// `refrescar()` que reproduce el mismo camino de datos (una copia de los anillos
// del estado, `refVertice:null`). El encuadre sigue siendo el último paso del
// MONTAJE; esto es un repintado, no una pieza más: no apila nada en `deshacer`.
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
import { crearAcotaciones } from './acotaciones.js'
import { crearBarraEdicion } from './barra-edicion.js'
import { crearCajonDiagnostico } from './cajon-diagnostico.js'
import { crearContraste } from './contraste.js'
import { crearEdicion } from './edicion.js'
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
 * Claves que admite `opciones.edicion` cuando viene como objeto. **Es la lista
 * cerrada**: una clave que no esté aquí es un `throw`, no un silencio.
 *
 * Por qué cerrada y no abierta (el resto de `opciones` sí se reenvía tal cual a
 * `L.map`): ahí el rest TIENE un destinatario documentado —Leaflet— y una clave
 * desconocida acaba en él. Aquí no hay destinatario: `edicion: {toleracia: 0.5}`
 * —con la errata— montaría la edición con la tolerancia por defecto y el usuario
 * vería el snap enganchar "mal" sin que nada lo explicara. Es exactamente el
 * fallo silencioso de la regla de oro 1, y cuesta tres líneas impedirlo.
 *
 * Lo que deliberadamente NO está: las COLINDANTES del snap. Llegan del WFS de
 * F05, o sea después y de forma asíncrona, así que su camino es
 * `visor.edicion.fijarColindantes(...)` y solo ese. Admitirlas también aquí sería
 * un segundo camino para lo mismo que además estaría vacío casi siempre.
 */
const CLAVES_EDICION = Object.freeze([
  'tolerancia',
  'minimoPx',
  'snapActivo',
  'barra',
  'posicionBarra',
])

/**
 * ¿Se monta la barra de herramientas sobre el mapa? **Sí por defecto**, y es una
 * decisión, no una comodidad: la barra es la ÚNICA superficie desde la que el
 * usuario puede deshacer, conmutar el enganche o desplazar un lindero, porque el
 * bloque «Edición» del panel dejó de existir. Un visor con edición y sin barra es
 * un visor con la mitad de la función inalcanzable, así que hay que pedirlo
 * explícitamente (`barra: false`) y solo tiene sentido para quien fabrique su
 * propia UI — o para un test que quiera el mapa pelado.
 */
const BARRA_POR_DEFECTO = true

/**
 * Normaliza `opciones.edicion` a «no montar» (`null`) o al objeto de opciones con
 * el que se montan las dos piezas de F06.
 *
 * @param {*} edicion
 * @returns {{tolerancia?: number, minimoPx?: number, snapActivo?: boolean}|null}
 * @throws {TypeError}  Contrato del programador.
 */
function normalizarEdicion(edicion) {
  if (edicion === undefined || edicion === false) return null
  if (edicion === true) return { barra: BARRA_POR_DEFECTO }

  // `null` se rechaza EN VEZ de tratarlo como `false`, aunque `typeof null` sea
  // 'object' y colarlo fuera trivial: sería una cuarta forma de decir "no", y las
  // formas de decir "no" ya son dos de más. Un `edicion: null` es casi siempre un
  // `?? false` que falta o un valor que se esperaba haber calculado.
  if (edicion === null || typeof edicion !== 'object' || Array.isArray(edicion)) {
    throw new TypeError(
      `crearVisor: 'opciones.edicion' debe ser un booleano, un objeto de opciones ` +
        `{${CLAVES_EDICION.join(', ')}} o undefined; recibido ` +
        `${Array.isArray(edicion) ? 'un array' : JSON.stringify(edicion) || typeof edicion}.`,
    )
  }

  const desconocidas = Object.keys(edicion).filter((clave) => !CLAVES_EDICION.includes(clave))
  if (desconocidas.length > 0) {
    throw new TypeError(
      `crearVisor: 'opciones.edicion' no conoce ${desconocidas.map((c) => `'${c}'`).join(', ')}. ` +
        `Las únicas claves admitidas son: ${CLAVES_EDICION.join(', ')}. Las colindantes del snap ` +
        `no se pasan aquí: llegan del WFS después de montar el visor y se fijan con ` +
        `visor.edicion.fijarColindantes(recintos).`,
    )
  }
  // La barra se monta salvo que la quiten a mano (ver {@link BARRA_POR_DEFECTO}).
  return { barra: BARRA_POR_DEFECTO, ...edicion }
}

/**
 * Claves que admite `opciones.diagnostico` cuando viene como objeto. **Lista
 * cerrada**, por el mismo motivo que {@link CLAVES_EDICION}: aquí no hay ningún
 * destinatario al que reenviar lo desconocido, así que `diagnostico:{posicón:…}`
 * —con la errata— montaría el cajón en la esquina por defecto y nadie sabría por
 * qué. Son las dos únicas opciones que las dos piezas de F07 aceptan.
 *
 * Lo que deliberadamente NO está: las COLINDANTES, la superficie registral y la
 * clase de suelo. Las tres son DATOS del expediente, no configuración del visor,
 * y ninguna existe cuando el visor se monta: las colindantes llegan del WFS y las
 * otras dos las teclea el usuario en el propio cajón. Su camino es
 * `visor.diagnostico.cajon.pintar(diagnosticar(...))`, y solo ese.
 */
const CLAVES_DIAGNOSTICO = Object.freeze(['posicion', 'minimoPx'])

/**
 * Normaliza `opciones.diagnostico` a «no montar» (`null`) o al objeto de opciones
 * con el que se montan las dos piezas de F07.
 *
 * Es un gemelo de {@link normalizarEdicion} y NO se ha factorizado con él a un
 * `normalizarOpcionCompuesta(valor, claves, nombre)`: los dos mensajes de error
 * dicen cosas distintas —cada uno nombra la vía correcta para lo que su lista
 * cerrada excluye, que es la mitad de su valor— y el defecto de `edicion` es un
 * objeto (`{barra:true}`) mientras que el de aquí es el vacío. Lo común serían
 * cuatro líneas de forma; lo distinto es todo lo que se lee.
 *
 * @param {*} diagnostico
 * @returns {{posicion?: string, minimoPx?: number}|null}
 * @throws {TypeError}  Contrato del programador.
 */
function normalizarDiagnostico(diagnostico) {
  if (diagnostico === undefined || diagnostico === false) return null
  if (diagnostico === true) return {}

  if (diagnostico === null || typeof diagnostico !== 'object' || Array.isArray(diagnostico)) {
    throw new TypeError(
      `crearVisor: 'opciones.diagnostico' debe ser un booleano, un objeto de opciones ` +
        `{${CLAVES_DIAGNOSTICO.join(', ')}} o undefined; recibido ` +
        `${Array.isArray(diagnostico) ? 'un array' : JSON.stringify(diagnostico) || typeof diagnostico}.`,
    )
  }

  const desconocidas = Object.keys(diagnostico).filter(
    (clave) => !CLAVES_DIAGNOSTICO.includes(clave),
  )
  if (desconocidas.length > 0) {
    throw new TypeError(
      `crearVisor: 'opciones.diagnostico' no conoce ${desconocidas.map((c) => `'${c}'`).join(', ')}. ` +
        `Las únicas claves admitidas son: ${CLAVES_DIAGNOSTICO.join(', ')}. Los datos del ` +
        `expediente (colindantes, superficie registral, clase de suelo) no se pasan aquí: no ` +
        `existen cuando se monta el visor. Se pintan con ` +
        `visor.diagnostico.cajon.pintar(diagnosticar({...})).`,
    )
  }
  return { ...diagnostico }
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
 * @property {ReturnType<typeof crearEdicion>|null} edicion  La interacción de
 *   edición de F06 (`viewer/edicion.js`), o **`null`** si el visor se montó sin
 *   ella. `null` y NO `undefined`, a propósito: `undefined` es lo que devuelve un
 *   objeto al que se le ha olvidado una propiedad, y aquí «no montado» es una
 *   respuesta, no un olvido. `if (visor.edicion)` distingue las dos situaciones
 *   sin que el llamante tenga que acordarse de con qué opciones lo creó.
 * @property {import('./acotaciones.js').Acotaciones|null} acotaciones  La capa de
 *   cotas de F06, o **`null`** por el mismo motivo. Se monta y se desmonta con la
 *   edición: son las dos mitades de la misma opción.
 * @property {{cajon: ReturnType<typeof crearCajonDiagnostico>,
 *   contraste: ReturnType<typeof crearContraste>}|null} diagnostico  Las dos
 *   piezas de F07, o **`null`** si el visor se montó sin ellas (mismo criterio que
 *   `edicion`: `null` es una respuesta, `undefined` sería un olvido). Van juntas en
 *   un objeto y no como dos propiedades hermanas porque son inseparables —el cajón
 *   dice las cifras y la capa señala DÓNDE están en el mapa; una sin la otra es
 *   media función— y porque así `if (visor.diagnostico)` es una sola pregunta.
 * @property {() => void} destruir  Deshace TODO el ensamblaje en orden inverso
 *   (diagnóstico → sincronización → edición → acotaciones → capas → mapa).
 *   IDEMPOTENTE: llamarlo dos veces no lanza.
 */

/**
 * Crea el visor completo: mapa + capas + tabla de vértices sincronizada —y, si se
 * pide, la EDICIÓN de F06 con sus acotaciones—, encuadrado según el contrato de
 * viewport (ver la cabecera del módulo).
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
 * Con edición (F06), y con la ficha de medidas del pie enchufada al MISMO canal
 * en vivo que las cotas:
 *
 * ```js
 * const visor = crearVisor(el, {
 *   estado, tablaEl, srs: 'EPSG:25830', historial,
 *   edicion: { tolerancia: 0.2 },
 *   alPrevisualizar: (anillosUTM) => ficha.medir(anillosUTM),
 * })
 * visor.edicion.fijarColindantes(vecinas.flatMap((p) => p.recintos))
 * visor.edicion.desplazarSeleccion(0.5)
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
 * @param {boolean|{tolerancia?: number, minimoPx?: number, snapActivo?: boolean}}
 *   [opciones.edicion=false]  Monta las dos piezas de F06: la INTERACCIÓN de
 *   edición (`viewer/edicion.js`) y la capa de ACOTACIONES
 *   (`viewer/acotaciones.js`).
 *
 *   · **`false` (el DEFECTO) ⇒ el visor de F03 EXACTO.** No se monta nada, los
 *     tres ganchos de `sincronizar` van en `null` y `visor.edicion` /
 *     `visor.acotaciones` valen `null`. Un visor de solo lectura (el plano de F09)
 *     no debe pagar ni un marcador de más ni, sobre todo, quedarse sin el zoom por
 *     doble clic, que `crearEdicion` apaga.
 *
 *     (Aquí decía «el diagnóstico de F07» como segundo ejemplo de visor de solo
 *     lectura, y **era falso**: F07 se monta ENCIMA de la edición, con la parcela
 *     viva y el cajón recalculando en cada operación del store. Se corrige en vez
 *     de borrarse porque la suposición es fácil de volver a hacer: `diagnostico` y
 *     `edicion` son opciones INDEPENDIENTES y su combinación normal es las dos a la
 *     vez, no una u otra.)
 *   · **`true`** ⇒ se montan con todos sus valores por defecto.
 *   · **objeto** ⇒ igual, con estas TRES claves y ninguna más (una clave
 *     desconocida es `TypeError`, ver {@link CLAVES_EDICION}):
 *       - `tolerancia` (metros) → τ del snap, a `crearEdicion`
 *         (defecto `OPERATIVOS.snapMetros`, 20 cm). `0` = snap apagado.
 *       - `minimoPx` (píxeles) → longitud mínima en PANTALLA para rotular un
 *         lado, a `crearAcotaciones` (defecto `OPERATIVOS.acotacionMinimaPx`).
 *       - `snapActivo` (booleano) → estado inicial del enganche; se aplica con
 *         `edicion.snapActivo(valor)` en cuanto la pieza existe.
 * @param {import('./sincronizacion.js').AlPrevisualizar|null}
 *   [opciones.alPrevisualizar=null]  Vistas en vivo **DEL LLAMANTE**: la ficha de
 *   superficie / perímetro / Δcatastral de F06, o cualquier otra cosa que quiera
 *   los anillos EN VUELO durante el arrastre. Recibe UTM y `refVertice` tal como
 *   los define {@link import('./sincronizacion.js').AlPrevisualizar}.
 *
 *   Es una opción **de primer nivel y no una clave de `edicion`**, y es
 *   deliberado: medir la parcela mientras se mueve un vértice no exige poder
 *   insertar vértices ni enganchar al parcelario. Son dos cosas distintas, así
 *   que se piden por separado — este gancho funciona igual **monte o no monte
 *   edición**.
 *
 *   Cuando SÍ hay edición, el canal tiene dos consumidores y se llama a los DOS,
 *   en este orden: primero se repintan las cotas
 *   (`acotaciones.pintar(anillos, {soloRef: ref})`) y después este gancho. El
 *   orden es la protección: `sincronizacion.js` ya envuelve el gancho entero en
 *   `try/catch` —avisa una vez por gesto y el arrastre sigue—, así que envolverlo
 *   aquí otra vez sería duplicar una red que ya está puesta; lo único que esa red
 *   NO garantiza es que el otro consumidor llegue a ejecutarse, y eso se resuelve
 *   pintando las cotas ANTES. Un `alPrevisualizar` que revienta no se lleva por
 *   delante ni el repintado de las cotas ni el gesto.
 * @param {boolean|{posicion?: string, minimoPx?: number}} [opciones.diagnostico=false]
 *   Monta las dos piezas de F07: el CAJÓN de cifras (`viewer/cajon-diagnostico.js`)
 *   y la capa de CONTRASTE sobre el mapa (`viewer/contraste.js`).
 *
 *   · **`false` (el DEFECTO) ⇒ el visor de antes de F07, sin un control ni un
 *     listener de más.** `visor.diagnostico` vale `null`.
 *   · **`true`** ⇒ las dos, con sus defectos.
 *   · **objeto** ⇒ igual, con estas DOS claves y ninguna más (una desconocida es
 *     `TypeError`, ver {@link CLAVES_DIAGNOSTICO}):
 *       - `posicion` → esquina del cajón (defecto `'bottomleft'`, **la única libre**:
 *         ver el JSDoc de `crearCajonDiagnostico`).
 *       - `minimoPx` → longitud mínima en PANTALLA para rotular la cota de la
 *         desviación máxima (defecto `OPERATIVOS.cotaDiagnosticoMinimaPx`).
 *
 *   El cajón nace CERRADO y la capa VACÍA: montar el diagnóstico no diagnostica
 *   nada. Quien lo abre y le da las cifras es `app/cableado-diagnostico.js`, cuando
 *   el usuario pulsa «Diagnosticar». Un visor que se abriera solo taparía el mapa
 *   con un cajón que nadie ha pedido.
 * @returns {Visor}
 * @throws {TypeError}  Contrato del programador: `opciones` no es un objeto,
 *   `estado` no es el store, `vistaInicial` malformada, `srs` no es un string
 *   (desde `husoPorSrs`), `contenedor`/`tablaEl` no son elementos del DOM (desde
 *   `crearMapa`/`sincronizar`), `edicion` o `diagnostico` que no son booleano ni
 *   objeto, `alPrevisualizar` que no es función, o **no hay ni geometría ni
 *   `vistaInicial`**.
 * @throws {RangeError}  `srs` no soportado (desde `husoPorSrs`), `baseInicial`
 *   inexistente (desde `montarCapas`), `maxZoom` que no supera el zoom nativo
 *   de las capas montadas, `edicion.tolerancia` negativa (desde `crearEdicion`) o
 *   `diagnostico.posicion` que no es una esquina de Leaflet (desde
 *   `crearCajonDiagnostico`).
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
    edicion: opcionEdicion = false,
    diagnostico: opcionDiagnostico = false,
    alPrevisualizar,
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
  // `null` = no montar edición. Lanza ANTES de montar nada si la opción no tiene
  // forma: una opción malformada es un bug del llamante lo montemos o no.
  const opcionesEdicion = normalizarEdicion(opcionEdicion)
  const opcionesDiagnostico = normalizarDiagnostico(opcionDiagnostico)
  // Misma política que `resolverAvisar` y que los tres ganchos de `sincronizar`:
  // "no me han pasado nada" es legítimo (cae a `null`); "me han pasado basura
  // donde iba una función" es contrato roto, y eso aquí es `throw`.
  if (
    alPrevisualizar !== undefined &&
    alPrevisualizar !== null &&
    typeof alPrevisualizar !== 'function'
  ) {
    throw new TypeError(
      `crearVisor: 'opciones.alPrevisualizar' debe ser una función (anillosUTM, refVertice), o ` +
        `null/undefined para no enchufar ninguna vista en vivo; recibido ${typeof alPrevisualizar}.`,
    )
  }
  const previsualizarDelLlamante = typeof alPrevisualizar === 'function' ? alPrevisualizar : null

  // Pila de deshacer: se apila cada pieza montada y se desapila en orden inverso,
  // tanto en `destruir()` como si el ensamblaje falla a mitad (ver cabecera).
  /** @type {Array<() => void>} */
  const deshacer = []

  try {
    // 1 · El mapa (sin vista: el encuadre es el paso 5).
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

    // 3 · Las dos piezas de F06, ANTES de sincronizar porque `sincronizar`
    // CONSUME sus ganchos y solo los acepta al construirse (ver cabecera).
    /** @type {import('./acotaciones.js').Acotaciones|null} */
    let acotaciones = null
    /** @type {ReturnType<typeof crearEdicion>|null} */
    let edicion = null
    if (opcionesEdicion !== null) {
      acotaciones = crearAcotaciones({
        mapa,
        zona,
        minimoPx: opcionesEdicion.minimoPx,
        alAvisar: avisar,
      })
      deshacer.push(() => acotaciones.destruir())

      edicion = crearEdicion({
        mapa,
        estado,
        zona,
        historial,
        tolerancia: opcionesEdicion.tolerancia,
        alAvisar: avisar,
      })
      deshacer.push(() => edicion.destruir())

      // Después de apilar su deshacer: `snapActivo` valida su argumento y lanza,
      // y esa `edicion` ya montada tiene que caer con el resto en el desmontaje.
      if (opcionesEdicion.snapActivo !== undefined) edicion.snapActivo(opcionesEdicion.snapActivo)

      // La BARRA de herramientas, sobre el mapa. Es una VISTA: no conoce el
      // modelo ni el historial, solo fabrica los nodos del contrato
      // (`[data-accion]`, `[data-campo]`, `[data-estado]`) que `app/main.js`
      // localiza por selector y cablea. Por eso se monta AQUÍ y no allí: cuando
      // `crearVisor` devuelve, los nodos ya están en el documento, que es
      // exactamente lo que `cablearEdicion` necesita para resolverlos.
      //
      // Vive sobre el mapa y no en el panel porque el bloque «Edición» del panel
      // se comía 270 px fijos y dejaba la tabla de vértices en 1,6 renglones de
      // los 15 de la parcela (medido en navegador, ver `spec/feature-06`).
      if (opcionesEdicion.barra) {
        const barra = crearBarraEdicion({ mapa, posicion: opcionesEdicion.posicionBarra })
        deshacer.push(() => barra.destruir())
      }
    }

    // El PUENTE de previsualización: un solo gancho para `sincronizar`, dos
    // consumidores (ver el JSDoc de `opciones.alPrevisualizar`). Nace mudo —el
    // mapa aún no tiene vista y las cotas miden en píxeles— y se abre justo tras
    // el encuadre (ver la cabecera del módulo).
    //
    // Sin ninguno de los dos consumidores, el gancho es `null` y no una función
    // vacía: `sincronizar` con `alPrevisualizar:null` no copia los anillos en cada
    // frame, y eso es parte de "el visor de F03 EXACTO".
    let vistasEnVivoAbiertas = false
    const puentePrevisualizacion =
      acotaciones === null && previsualizarDelLlamante === null
        ? null
        : (anillosUTM, refVertice) => {
            if (!vistasEnVivoAbiertas) return
            // Las cotas PRIMERO: es lo que garantiza que se repinten aunque el
            // gancho del llamante reviente (`sincronizacion.js` ya atrapa eso y
            // avisa una vez por gesto; aquí no se duplica esa red).
            if (acotaciones !== null) acotaciones.pintar(anillosUTM, { soloRef: refVertice })
            if (previsualizarDelLlamante !== null) previsualizarDelLlamante(anillosUTM, refVertice)
          }

    // 4 · Tabla ↔ dibujo, ambos vistas del mismo estado. Con los ganchos del
    // paso 3, o con los TRES en `null` (el visor de F03, byte a byte).
    const sincronizacion = sincronizar({
      mapa,
      panes,
      estado,
      tablaEl,
      zona,
      historial,
      alAvisar: avisar,
      ajustar: edicion === null ? null : edicion.ajustar,
      alPrevisualizar: puentePrevisualizacion,
      alCrearMarcador: edicion === null ? null : edicion.alCrearMarcador,
    })
    deshacer.push(() => sincronizacion.destruir())

    // 5 · Las dos piezas de F07. Nacen INERTES —el cajón cerrado y la capa sin
    // nada puesto— y eso es lo que las hace seguras aquí, con el mapa todavía sin
    // vista: `crearContraste` solo se suscribe a `zoomend moveend`, y su repintado
    // sale por la puerta de atrás mientras no le hayan pintado nada. El encuadre
    // del paso 6 dispara esos dos eventos y no pasa nada, que es justo lo que las
    // acotaciones de F06 NO podían garantizar (por eso ellas necesitan el puente
    // mudo y estas no).
    /** @type {{cajon: object, contraste: object}|null} */
    let diagnostico = null
    if (opcionesDiagnostico !== null) {
      const cajon = crearCajonDiagnostico({
        mapa,
        posicion: opcionesDiagnostico.posicion,
        alAvisar: avisar,
      })
      deshacer.push(() => cajon.destruir())

      const contraste = crearContraste({
        mapa,
        zona,
        minimoPx: opcionesDiagnostico.minimoPx,
        alAvisar: avisar,
      })
      deshacer.push(() => contraste.destruir())

      diagnostico = { cajon, contraste }
    }

    // 6 · El encuadre, lo ÚLTIMO del MONTAJE (ver cabecera: así la capa WMS del
    // Catastro pide UNA sola imagen, y del encuadre bueno).
    encuadrar({ mapa, estado, zona, vistaInicial, avisar })

    // Coda (no es un paso del montaje: no apila nada en `deshacer`): con el mapa
    // ya encuadrado, las vistas en vivo pueden medir. Se abre el puente y se
    // fuerza UN render, que es lo que las deja pintadas de arranque sin que el
    // llamante tenga que acordarse de refrescarlas. No mueve el mapa, así que no
    // provoca una segunda petición al WMS.
    if (puentePrevisualizacion !== null) {
      vistasEnVivoAbiertas = true
      sincronizacion.refrescar()
    }

    let destruido = false
    return {
      mapa,
      estado,
      capas,
      edicion,
      acotaciones,
      diagnostico,
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

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
//   2 bis. COLINDANTES — `crearCapaColindantes`, y SOLO si el llamante ha pedido
//                        `opciones.colindantes`. Va aquí, pegada a las capas de
//                        fondo, porque es lo que es: CONTEXTO cartográfico. Su
//                        pane (405) es el más bajo del visor, así que se monta
//                        antes que la geometría y se desmonta después que ella —
//                        el orden del montaje ES el orden de apilado dentro de
//                        cada pane, pero entre panes manda el zIndex, y este va
//                        debajo de todo. Nace VACÍA: montarla no trae vecinas.
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
//   5 bis. COMPROBACIÓN (F08) — `crearCajonComprobacion`, y SOLO si el llamante ha
//                        pedido `opciones.comprobacion`. Comparte `bottomleft` con
//                        el cajón de F07 —las cuatro esquinas del mapa ya estaban
//                        ocupadas— y los dos son MUTUAMENTE EXCLUYENTES por diseño:
//                        la comprobación precede al diagnóstico y no coexiste con
//                        él. Va después del diagnóstico y antes del encuadre, por
//                        las mismas dos razones que él.
//   6. ENCUADRE        — el ÚLTIMO paso, y no por casualidad. Leaflet difiere el
//                        `onAdd` de toda capa hasta que el mapa tiene vista
//                        (`Map#addLayer` → `whenReady`), así que encuadrar al
//                        final significa que la capa WMS del Catastro emite su
//                        PRIMERA petición ya sobre el encuadre definitivo: UNA
//                        petición, no una para un encuadre intermedio y otra
//                        para el bueno (criterio de aceptación 2).
//   7. REENCUADRE VIVO — la suscripción al store que vuelve a encuadrar cuando
//                        entra una parcela DISTINTA —y que de paso SUELTA las
//                        colindantes de la anterior, que ya no son de nadie—. Va
//                        necesariamente después del paso 6 (ver el bloque «EL MAPA
//                        SIGUE A LA PARCELA»).
//
// `destruir()` deshace exactamente eso EN ORDEN INVERSO (reencuadre →
// comprobación → diagnóstico → sincronización → edición → acotaciones →
// colindantes → capas → mapa) y es
// IDEMPOTENTE. Ese
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
// ── EL MAPA SIGUE A LA PARCELA, PERO NO PERSIGUE AL EDITOR ──────────────────
// El encuadre del paso 6 ocurría UNA sola vez, al construir el visor, y el visor
// no exponía ninguna forma de repetirlo. Consecuencia medida en la revisión visual
// de F08: se traía una parcela de Sevilla por referencia catastral, o se soltaba
// un GML de Cádiz, y **el mapa seguía mirando la parcela de demostración**. Otro
// fallo silencioso: la app había cargado lo que se le pedía y no lo enseñaba.
//
// Se arregla con UNA suscripción al store (paso 7) y una regla de una línea:
// **se reencuadra cuando entra una parcela DISTINTA, y solo entonces.**
//
//   · **La identidad es `refcat ?? idLocal`, NUNCA la del objeto.** `edit/`
//     reconstruye el POJO en cada operación (regla de oro 4: modelo plano +
//     `structuredClone`), así que comparar referencias diría «otra parcela» en
//     CADA frame de un arrastre. Los dos campos sobreviven a las ediciones porque
//     `edit/` no reetiqueta el expediente, que es exactamente la propiedad que
//     hace falta. Es la MISMA clave y el MISMO motivo que
//     `app/cableado-diagnostico.js#claveDeExpediente` — dos copias de seis líneas
//     en dos capas que no pueden importarse entre sí (`viewer/` no conoce `app/`);
//     lo que no puede haber son dos criterios distintos de «es otra parcela».
//   · **JAMÁS al editar.** Si la identidad no cambia, la vista no se toca. Un mapa
//     que se recentra mientras se arrastra un vértice es peor que un mapa quieto:
//     el vértice se escapa del puntero. Esto rompería F06 entero, y es el test más
//     importante de los dos que protegen este bloque.
//   · **Nunca dos veces al arrancar.** `crearVisor` ya encuadra en el paso 6, y
//     `crearEstadoVista#subscribe` **no notifica al suscribirse** (solo `set`
//     notifica: ver `viewer/_comun.js`). Además la clave se inicializa DESPUÉS del
//     encuadre con la parcela que se acaba de encuadrar, así que el primer `set`
//     que llegue con esa misma parcela tampoco mueve nada.
//   · **Del mismo cambio de identidad cuelga la LIMPIEZA DE LAS COLINDANTES**, y
//     no de los cableados de `app/`: las vecinas son de UNA parcela, así que
//     «ha entrado otra» es exactamente el suceso que las jubila. Hay tres vías de
//     entrada de parcela (Catastro, fichero GML, `estado.set` a pelo) y todas
//     pasan por aquí; una llamada por cableado sería un cable que se rompe en
//     silencio con la cuarta. El razonamiento completo está en el paso 7.
//   · **El reencuadre automático NO usa la cascada entera**, solo su rama de
//     geometría. Dos razones: (1) esto corre dentro de una notificación del store,
//     y el `throw` del encuadre mudo saldría por el `set()` de quien cargó la
//     parcela, en un sitio donde ya no significa lo que dice; (2) vaciar el store
//     (`set(null)`) no es motivo para viajar a `vistaInicial` — no hay nada que
//     mirar, y quedarse donde se está es lo único que no sorprende.
//
// Y para el uso EXPLÍCITO está `visor.encuadrar()`, que sí ejecuta la cascada
// completa (geometría → `vistaInicial` → `throw`) reutilizando la misma función
// que el paso 6.
//
// ── ENCUADRAR SOBRE UNA GEOMETRÍA QUE NO ESTÁ EN ESTE STORE (F11) ───────────
// `visor.encuadrar()` y el reencuadre vivo miran los dos AL STORE que se le pasó
// al visor, o sea al de PARCELA. F11 estrena una segunda rama con su propio store
// —las partes de construcción de un edificio— y ahí ninguno de los dos sirve. Por
// eso este módulo EXPORTA, además de `crearVisor`:
//
//   encuadrarSobreRecintos({ mapa, recintos, zona, alAvisar, sujeto })
//
// que es LA MISMA pieza que usan el paso 6 y el paso 7, con el caso degenerado
// dentro, y que no lee ningún store. Su porqué completo —y por qué se extrae en
// vez de reimplementarse en `app/`— está en su JSDoc.
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
import { crearCajonComprobacion } from './cajon-comprobacion.js'
import { crearCajonParcelas } from './cajon-parcelas.js'
import { crearCapaCandidatas } from './candidatas.js'
import { crearCajonDiagnostico } from './cajon-diagnostico.js'
import { crearCapaColindantes } from './colindantes.js'
import { crearCapaPuntosLevantamiento } from './puntos-levantamiento.js'
import { crearContraste } from './contraste.js'
import { crearEdicion } from './edicion.js'
import { crearListaSobrante } from './lista-sobrante.js'
import { crearLeyenda } from './leyenda.js'
import { crearMapa } from './mapa.js'
import { VARIANTE, crearCapaPiezas } from './piezas.js'
import { crearSenalMiembro } from './senal-miembro.js'
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

/**
 * Sujeto de la frase del aviso de vértices no numéricos de
 * {@link encuadrarSobreRecintos}. Existe como parámetro —y no como literal— desde
 * F11: la MISMA función encuadra ahora la parcela y las huellas de un edificio, y
 * decirle al usuario «La parcela tiene 3 vértices con coordenadas no numéricas»
 * mientras mira un edificio es contarle un fallo real sobre el objeto equivocado.
 * El defecto es el literal de F03, byte a byte, para que la rama de parcela diga
 * exactamente lo que decía.
 */
const SUJETO_POR_DEFECTO = 'La parcela'

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
 * Claves que admite `opciones.comprobacion` cuando viene como objeto. **Lista
 * cerrada**, por el mismo motivo que {@link CLAVES_EDICION} y
 * {@link CLAVES_DIAGNOSTICO}.
 *
 * Solo hay una, y no es un descuido: el cajón de comprobación no tiene ningún otro
 * parámetro de MONTAJE. Todo lo demás que necesita —qué fichero, qué parcela, qué
 * detecciones— es un DATO que no existe cuando el visor se monta: llega cuando el
 * usuario suelta un `.gml`, y su camino es
 * `visor.comprobacion.pintar(comprobarGml({...}))`, y solo ese.
 */
const CLAVES_COMPROBACION = Object.freeze(['posicion'])

/**
 * Normaliza `opciones.comprobacion` a «no montar» (`null`) o al objeto de opciones
 * con el que se monta el cajón de F08.
 *
 * Tercer gemelo de {@link normalizarEdicion} y {@link normalizarDiagnostico}, y
 * tampoco se factoriza con ellos: la razón está escrita en el JSDoc del segundo
 * —los mensajes de error dicen cosas distintas y esa mitad es lo que vale— y con
 * tres copias sigue siendo cierta. Lo común serían cuatro líneas de forma.
 *
 * @param {*} comprobacion
 * @returns {{posicion?: string}|null}
 * @throws {TypeError}  Contrato del programador.
 */
function normalizarComprobacion(comprobacion) {
  if (comprobacion === undefined || comprobacion === false) return null
  if (comprobacion === true) return {}

  if (comprobacion === null || typeof comprobacion !== 'object' || Array.isArray(comprobacion)) {
    throw new TypeError(
      `crearVisor: 'opciones.comprobacion' debe ser un booleano, un objeto de opciones ` +
        `{${CLAVES_COMPROBACION.join(', ')}} o undefined; recibido ` +
        `${Array.isArray(comprobacion) ? 'un array' : JSON.stringify(comprobacion) || typeof comprobacion}.`,
    )
  }

  const desconocidas = Object.keys(comprobacion).filter(
    (clave) => !CLAVES_COMPROBACION.includes(clave),
  )
  if (desconocidas.length > 0) {
    throw new TypeError(
      `crearVisor: 'opciones.comprobacion' no conoce ${desconocidas.map((c) => `'${c}'`).join(', ')}. ` +
        `La única clave admitida es: ${CLAVES_COMPROBACION.join(', ')}. El fichero cargado, la ` +
        `parcela elegida y sus detecciones no se pasan aquí: no existen cuando se monta el ` +
        `visor. Se pintan con visor.comprobacion.pintar(comprobarGml({...})).`,
    )
  }
  return { ...comprobacion }
}

/**
 * Claves que admite `opciones.parcelas` cuando viene como objeto (F22). **Lista
 * cerrada**, cuarto gemelo de las tres de arriba.
 *
 * Solo hay una, y por el mismo motivo que en comprobación: el cajón de elección no
 * tiene ningún otro parámetro de MONTAJE. Cuántas fincas hay, cómo se llaman y qué
 * miden son DATOS que no existen cuando el visor se monta —llegan cuando el
 * usuario suelta un `.dxf` con la manzana entera— y su camino es
 * `visor.parcelas.cajon.pintar({...})` + `visor.parcelas.capa.pintar([...])`.
 */
const CLAVES_PARCELAS = Object.freeze(['posicion'])

/**
 * Normaliza `opciones.parcelas` a «no montar» (`null`) o al objeto de opciones con
 * el que se montan las dos piezas de F22.
 *
 * @param {*} parcelas
 * @returns {{posicion?: string}|null}
 * @throws {TypeError}  Contrato del programador.
 */
function normalizarParcelas(parcelas) {
  if (parcelas === undefined || parcelas === false) return null
  if (parcelas === true) return {}

  if (parcelas === null || typeof parcelas !== 'object' || Array.isArray(parcelas)) {
    throw new TypeError(
      `crearVisor: 'opciones.parcelas' debe ser un booleano, un objeto de opciones ` +
        `{${CLAVES_PARCELAS.join(', ')}} o undefined; recibido ` +
        `${Array.isArray(parcelas) ? 'un array' : JSON.stringify(parcelas) || typeof parcelas}.`,
    )
  }

  const desconocidas = Object.keys(parcelas).filter((clave) => !CLAVES_PARCELAS.includes(clave))
  if (desconocidas.length > 0) {
    throw new TypeError(
      `crearVisor: 'opciones.parcelas' no conoce ${desconocidas.map((c) => `'${c}'`).join(', ')}. ` +
        `La única clave admitida es: ${CLAVES_PARCELAS.join(', ')}. Las fincas del dibujo, sus ` +
        `nombres y sus superficies no se pasan aquí: no existen cuando se monta el visor. Se ` +
        `pintan con visor.parcelas.cajon.pintar({...}) y visor.parcelas.capa.pintar([...]).`,
    )
  }
  return { ...parcelas }
}

/**
 * Normaliza `opciones.colindantes` a un booleano: montar la capa de vecinas o no.
 *
 * **Cuarto hermano de los tres de arriba, y el único que NO admite forma de
 * objeto**, que es una decisión y no un olvido: la capa de colindantes no tiene
 * ninguna opción de MONTAJE. No hay esquina que elegir (no es un control), ni
 * umbral en píxeles que ajustar (no rotula nada que dependa del zoom). Lo único
 * que necesita —QUÉ vecinas— es un dato que llega del WFS después de montar el
 * visor, y su camino es `visor.colindantes.pintar(vecinas)`, y solo ese. Una
 * lista cerrada VACÍA sería peor que no tenerla: prometería una configuración
 * que no existe.
 *
 * @param {*} colindantes
 * @returns {boolean}
 * @throws {TypeError}  Contrato del programador.
 */
function normalizarColindantes(colindantes) {
  if (colindantes === undefined || colindantes === false) return false
  if (colindantes === true) return true

  throw new TypeError(
    `crearVisor: 'opciones.colindantes' es un BOOLEANO (o undefined); recibido ` +
      `${describir(colindantes)}. No admite objeto de opciones porque la capa de vecinas ` +
      `no tiene ninguna: las parcelas colindantes llegan del WFS DESPUÉS de montar el ` +
      `visor y se pintan con visor.colindantes.pintar([{refcat, recintos}]).`,
  )
}

/**
 * Normaliza `opciones.sobrante` a un booleano (F17 · 4.2).
 *
 * ⚠️ **BOOLEANO y no objeto de opciones**, al revés que `diagnostico` y
 * `comprobacion` y por la misma razón que `colindantes`: sus dos piezas no tienen
 * nada que elegir al montarse. La lista NO es un control de Leaflet —no hay
 * esquina que escoger: la cuelga `app/main.js` de la sección anfitriona del
 * panel—, y la capa de manchas no mide en píxeles, así que tampoco tiene
 * `minimoPx`. Lo que sí hay que darle es la FOTO, y eso llega después de montar
 * el visor: `visor.sobrante.lista.pintar(derivarCesion({...}))`.
 *
 * @param {*} sobrante
 * @returns {boolean}
 * @throws {TypeError}
 */
function normalizarSobrante(sobrante) {
  if (sobrante === undefined || sobrante === false) return false
  if (sobrante === true) return true

  throw new TypeError(
    `crearVisor: 'opciones.sobrante' es un BOOLEANO (o undefined); recibido ` +
      `${describir(sobrante)}. No admite objeto de opciones porque sus dos piezas no eligen ` +
      `nada al montarse: la lista no es un control del mapa (la aloja app/main.js en la ` +
      `sección [data-anfitrion="sobrante"] del panel) y la capa de manchas no mide en ` +
      `píxeles. La foto se pinta con visor.sobrante.lista.pintar(derivarCesion({...})).`,
  )
}

/**
 * Normaliza `opciones.leyenda` (2026-08-15).
 *
 * ⚠️ **Admite OBJETO además de booleano**, al revés que `colindantes` y
 * `sobrante`, y la asimetría tiene motivo: la leyenda sí elige dos cosas al
 * montarse, y las dos son irreversibles desde fuera si no se pasan aquí. La
 * ESQUINA, porque comparte `bottomleft` con el cajón de diagnóstico cuando el
 * visor se monta a pelo y quien monte los dos flotando querrá separarlos; y los
 * GRUPOS iniciales, porque la leyenda tiene que nacer diciendo la verdad —una que
 * anuncia el ámbar de la invasión en una pantalla donde no se diagnostica nada
 * está mintiendo desde el primer fotograma, y esperar al primer `grupos()` del
 * cableado sería un fotograma de más—.
 *
 * `abierta` NO se puede fijar aquí a propósito: es un gesto del usuario, y el
 * defecto (plegada) está razonado en la cabecera de `viewer/leyenda.js`. Quien la
 * quiera abierta llama a `visor.leyenda.abrir()`, que es lo mismo pero se lee.
 *
 * @param {*} leyenda
 * @returns {{posicion: string|undefined, grupos: string[]|undefined}|null}  `null`
 *   ⇒ no montarla.
 * @throws {TypeError}
 */
function normalizarLeyenda(leyenda) {
  if (leyenda === undefined || leyenda === false) return null
  if (leyenda === true) return { posicion: undefined, grupos: undefined }
  if (leyenda !== null && typeof leyenda === 'object' && !Array.isArray(leyenda)) {
    return { posicion: leyenda.posicion, grupos: leyenda.grupos }
  }

  throw new TypeError(
    `crearVisor: 'opciones.leyenda' debe ser un booleano o un objeto ` +
      `{posicion, grupos}; recibido ${describir(leyenda)}.`,
  )
}

/** Describe un valor para un mensaje de contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * QUÉ PARCELA es esta, a efectos de «¿ha entrado una distinta?». La referencia
 * catastral primero y el `idLocal` como respaldo. Ver el bloque «EL MAPA SIGUE A
 * LA PARCELA» de la cabecera para el porqué de cada pieza; en corto: los dos
 * sobreviven a las ediciones y la identidad del OBJETO no, porque `edit/`
 * reconstruye el POJO en cada operación.
 *
 * ⚠️ **Gemela de `app/cableado-diagnostico.js#claveDeExpediente`**, a propósito y
 * declarado: `viewer/` no puede importar de `app/` (la capa de vista no conoce a
 * la aplicación que la usa) y `app/` no es un sitio del que un módulo del visor
 * pueda depender. Lo que sí es intolerable es que las dos capas tengan criterios
 * DISTINTOS de «es otra parcela»: si alguien cambia uno, tiene que cambiar el
 * otro, y por eso cada copia nombra a la otra.
 *
 * `null` = la parcela no dice quién es (o no hay parcela). Ver el aviso de
 * {@link crearVisor}: con dos parcelas anónimas seguidas, el reencuadre no puede
 * distinguirlas de una edición y no se mueve — y lo dice.
 *
 * @param {object|null} parcela
 * @returns {string|null}
 */
function claveDeParcela(parcela) {
  if (parcela === null || parcela === undefined) return null
  const refcat = typeof parcela.refcat === 'string' ? parcela.refcat.trim() : ''
  if (refcat !== '') return `refcat:${refcat}`
  const idLocal = typeof parcela.idLocal === 'string' ? parcela.idLocal : ''
  return idLocal === '' ? null : `idLocal:${idLocal}`
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
 * TODOS los vértices UTM finitos de TODOS los recintos recibidos, aplanados.
 *
 * En la rama de PARCELA se encuadra sobre `parcela.recintos` (la geometría
 * EDITABLE), no sobre `geometriaOficial`: la oficial es la referencia congelada
 * del Catastro y, cuando existe, la editable nace de ella — encuadrar sobre las
 * dos no cambiaría el resultado en el caso normal y en el caso editado mostraría
 * de más. Quién decide QUÉ recintos son es del llamante desde F11 (ver
 * {@link encuadrarSobreRecintos}); aquí solo se aplanan.
 *
 * Un vértice NO FINITO se descarta y se AVISA (nunca en silencio: regla de oro
 * 1). No es paranoia: `L.LatLng` LANZA con un `NaN`, así que un solo vértice
 * corrupto tumbaría el encuadre entero con un error de Leaflet ilegible en vez
 * de con un aviso que el usuario pueda entender.
 *
 * @param {*} recintos  Array de `{vertices: [x,y][]}` en UTM. Cualquier otra cosa
 *   —`null`, `undefined`, un no-array— se trata como "no hay recintos" y devuelve
 *   `[]`: el store puede estar vacío, y eso es un estado legítimo, no un bug.
 * @param {import('./_comun.js').Avisar} avisar
 * @param {string} sujeto  Sujeto de la frase del aviso (ver {@link SUJETO_POR_DEFECTO}).
 * @returns {Array<[number, number]>}
 */
function verticesFinitos(recintos, avisar, sujeto) {
  const lista = Array.isArray(recintos) ? recintos : []
  const vertices = []
  let descartados = 0

  for (const recinto of lista) {
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
      `${sujeto} tiene ${descartados} vértice(s) con coordenadas no numéricas: el encuadre ` +
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
 * ¿Trae esta parcela algún vértice utilizable?
 *
 * Pregunta BARATA y **sin efectos secundarios**, al revés que
 * {@link verticesFinitos}, que además AVISA de los vértices no numéricos. La usa
 * el reencuadre vivo (paso 7) para decidir si merece la pena hablar de una parcela
 * sin identidad: si no hay geometría, tampoco habría nada que encuadrar, y avisar
 * dos veces de los mismos vértices rotos es ruido.
 *
 * @param {object|null} parcela
 * @returns {boolean}
 */
function tieneGeometria(parcela) {
  const recintos = parcela && Array.isArray(parcela.recintos) ? parcela.recintos : []
  for (const recinto of recintos) {
    if (!recinto || !Array.isArray(recinto.vertices)) continue
    for (const vertice of recinto.vertices) {
      if (Array.isArray(vertice) && Number.isFinite(vertice[0]) && Number.isFinite(vertice[1])) {
        return true
      }
    }
  }
  return false
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

// ── El encuadre sobre una geometría (público desde F11) ──────────────────────

/**
 * Encuadra el mapa sobre UNOS RECINTOS EN UTM, con margen — y con el caso
 * degenerado resuelto.
 *
 * ── POR QUÉ ES PÚBLICA (F11 · T1.5), habiendo sido privada cuatro fases ──────
 * Hasta F10 el único encuadre posible era «lo que hay en el store de PARCELA», y
 * para eso ya está `visor.encuadrar()`. F11 estrena una SEGUNDA rama con su
 * propio store (el de edificio), y ahí `visor.encuadrar()` **no sirve**: ejecuta
 * la cascada sobre el store de parcela, que en esa rama es contexto y puede estar
 * vacío o hablar de otro municipio. Un edificio traído por referencia catastral o
 * soltado como GML puede caer a **cientos de kilómetros** de lo que se está
 * mirando, y ese es exactamente el defecto que la firma humana encontró en F03 y
 * que `README.md:58-63` documenta: «se traía una parcela de Sevilla y el mapa
 * seguía mirando la de demostración».
 *
 * Se EXTRAE en vez de reimplementarse en `app/` por una razón concreta y medible:
 * el **caso degenerado**. Un edificio de un solo vértice, o con todos los vértices
 * coincidentes, produce unos bounds SIN EXTENSIÓN, y `fitBounds` sobre eso calcula
 * una escala infinita y devuelve el `maxZoom` del mapa (24) sobre un punto. Esa
 * regla —y el medio metro de {@link EXTENSION_MINIMA_M} que la dispara— es
 * conocimiento del visor, no del cableado, y copiarla a `app/` sería tener dos
 * criterios de «esto es un punto y no un recinto» destinados a divergir.
 *
 * **No lee el store, no conoce la parcela y no conoce el edificio**: recibe
 * recintos. Por eso sirve igual para las huellas de las partes de construcción
 * (`edificio.partes[].recinto`) que para `parcela.recintos`, y por eso la rama 1
 * de la cascada del viewport ({@link encuadrarGeometria}) es hoy tres líneas que
 * la llaman.
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa de Leaflet YA montado.
 * @param {Array<{vertices: Array<[number, number]>}>|null} args.recintos  Recintos
 *   en UTM. `null`, `undefined` o un array vacío significan «no hay nada que
 *   encuadrar» y devuelven `false` SIN tocar la vista: es un estado legítimo (el
 *   store de edificio nace vacío), no un contrato roto.
 * @param {number} args.zona  Huso UTM (29/30/31) de esos recintos.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso del visor.
 *   Se resuelve con `resolverAvisar`, así que se puede pasar el ya resuelto.
 * @param {string} [args.sujeto='La parcela']  Sujeto de la frase del aviso de
 *   vértices no numéricos (`'El edificio'`, `'La parte «Porche»'`…). Ver
 *   {@link SUJETO_POR_DEFECTO}.
 * @returns {boolean}  `true` si ha encuadrado; `false` si no había ni un vértice
 *   utilizable (y entonces NO ha tocado la vista: quedarse donde se está es lo
 *   único que no sorprende).
 * @throws {TypeError}  Si `mapa` no es un mapa de Leaflet, o si `alAvisar` no es
 *   una función (contrato del programador, desde `resolverAvisar`).
 */
export function encuadrarSobreRecintos({
  mapa,
  recintos,
  zona,
  alAvisar,
  sujeto = SUJETO_POR_DEFECTO,
} = {}) {
  // DUCK TYPING, igual que `esStore` y que `viewer/capas.js#esMapa`: se comprueba
  // lo que de verdad se usa. Sin esta guarda, un `mapa` equivocado reventaría
  // dentro de Leaflet con un error ilegible y a tres saltos de aquí.
  if (
    !mapa ||
    typeof mapa !== 'object' ||
    typeof mapa.setView !== 'function' ||
    typeof mapa.fitBounds !== 'function'
  ) {
    throw new TypeError(
      `encuadrarSobreRecintos: 'mapa' debe ser un mapa de Leaflet (el de ` +
        `viewer/mapa.js#crearMapa), con setView/fitBounds; recibido ${JSON.stringify(mapa)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  const vertices = verticesFinitos(recintos, avisar, sujeto)
  if (vertices.length === 0) return false

  const { ancho, alto, centro } = extensionUTM(vertices)

  // Caso degenerado (un vértice, o todos coincidentes): `fitBounds` sobre
  // bounds sin extensión daría el maxZoom del mapa. Se encuadra el punto a un
  // zoom de parcela, explícitamente.
  if (Math.max(ancho, alto) < EXTENSION_MINIMA_M) {
    mapa.setView(vertUTMaLatLng(centro, zona), ZOOM_PUNTO)
    return true
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
  return true
}

/**
 * RAMA 1 de la cascada, aislada: encuadrar sobre la geometría del estado, si la
 * hay. Es la ÚNICA rama que usa el reencuadre automático del paso 7 (el porqué
 * está en la cabecera: dentro de una notificación del store no puede haber ni un
 * `throw` de contrato ni un salto a `vistaInicial`).
 *
 * Desde F11 es un ADAPTADOR de tres líneas sobre {@link encuadrarSobreRecintos}:
 * lo único que aporta es LEER EL STORE, que es justo lo que la rama de edificio no
 * puede reutilizar (su documento vive en otro store). Todo lo demás —el margen, el
 * caso degenerado, la proyección vértice a vértice, el aviso de los vértices no
 * numéricos— es la misma función y no una copia.
 *
 * ── ⭐ Y DESDE EL 2026-08-19 MIRA TAMBIÉN A LOS PUNTOS SUELTOS ─────────────
 * Un levantamiento de campo importado SIN UNIR entra con `recintos: []` y su nube
 * de puntos. Sin esta segunda mirada, `encuadrarGeometria` devolvía `false`, la
 * cascada caía a `vistaInicial` y el usuario aterrizaba en Edición **mirando la
 * vista general de España** con sus 88 esquinas a diez husos de distancia: la
 * herramienta puesta, los puntos cargados y nada en pantalla. Es un defecto de los
 * caros —parece que el fichero no ha entrado— y sale gratis de arreglar, porque
 * son pares UTM igual que los vértices de un recinto.
 *
 * ⚠️ **Los recintos MANDAN cuando los hay.** En cuanto el técnico cierra su
 * primer contorno, lo que encuadra es el contorno: los puntos son la referencia
 * sobre la que se dibujó, y pueden extenderse más allá de lo que acabó siendo la
 * finca (un levantamiento suele medir más de lo que se declara).
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa
 * @param {import('./_comun.js').EstadoVista} args.estado
 * @param {number} args.zona
 * @param {import('./_comun.js').Avisar} args.avisar
 * @returns {boolean}  `true` si ha encuadrado; `false` si no había ni geometría ni
 *   puntos (y entonces NO ha tocado la vista).
 */
function encuadrarGeometria({ mapa, estado, zona, avisar }) {
  const parcela = estado.get()
  if (
    encuadrarSobreRecintos({
      mapa,
      recintos: parcela && parcela.recintos,
      zona,
      alAvisar: avisar,
    })
  ) {
    return true
  }

  // Los puntos se envuelven en un recinto SINTÉTICO —no se guarda en ninguna
  // parte— para reutilizar entera la función de arriba en vez de escribir un
  // segundo encuadre que tendría su propio margen y su propio caso degenerado.
  const puntos = parcela && Array.isArray(parcela.puntosLevantamiento)
    ? parcela.puntosLevantamiento
    : []
  if (puntos.length === 0) return false
  return encuadrarSobreRecintos({
    mapa,
    recintos: [{ vertices: puntos }],
    zona,
    alAvisar: avisar,
  })
}

/**
 * La CASCADA DEL VIEWPORT (hallazgo C5). Ver la cabecera del módulo: geometría →
 * `vistaInicial` → `throw`. Nunca hay una cuarta rama que "mire a algún sitio".
 *
 * La usan DOS llamantes y ninguno más: el paso 6 del montaje y `visor.encuadrar()`
 * (el encuadre explícito, que es la misma decisión tomada más tarde).
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
  // 1 · Geometría: manda siempre que la haya, aunque venga también vistaInicial.
  if (encuadrarGeometria({ mapa, estado, zona, avisar })) return 'geometria'

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
 * @property {import('./barra-edicion.js').BarraMontada|null} barraEdicion  La
 *   BARRA FLOTANTE de herramientas de F06 (`viewer/barra-edicion.js`), o **`null`**
 *   si el visor se montó sin edición **o con `edicion.barra:false`** (mismo
 *   criterio que las anteriores: `null` es una respuesta, `undefined` sería un
 *   olvido). Ojo a esa segunda vía: `visor.edicion` puede no ser `null` y
 *   `visor.barraEdicion` sí — son dos preguntas distintas.
 *
 *   Se devuelve desde F11 y para UNA cosa: **poder ocultarla sin desmontarla**
 *   cuando la rama activa es EDIFICIO (`app/rama.js`). El nodo es
 *   `visor.barraEdicion.control.getContainer()` —`getContainer()` es API pública de
 *   `L.Control`— y se esconde con `hidden`, la misma disciplina con la que se
 *   intercambian las dos secciones del panel: **jamás `remove()` ni
 *   `replaceChildren()`**, porque `app/main.js#cablearEdicion` resolvió sus siete
 *   nodos UNA sola vez en el montaje y una referencia huérfana sigue siendo
 *   escribible y muda (medido en F11 · T0.3).
 *
 *   Lo que este visor NO hace es ocultarla él: no sabe qué rama está activa, y
 *   averiguarlo sería devolverle a la vista un conocimiento de la aplicación.
 * @property {{cajon: ReturnType<typeof crearCajonDiagnostico>,
 *   contraste: ReturnType<typeof crearContraste>}|null} diagnostico  Las dos
 *   piezas de F07, o **`null`** si el visor se montó sin ellas (mismo criterio que
 *   `edicion`: `null` es una respuesta, `undefined` sería un olvido). Van juntas en
 *   un objeto y no como dos propiedades hermanas porque son inseparables —el cajón
 *   dice las cifras y la capa señala DÓNDE están en el mapa; una sin la otra es
 *   media función— y porque así `if (visor.diagnostico)` es una sola pregunta.
 * @property {ReturnType<typeof crearCajonComprobacion>|null} comprobacion  El
 *   cajón de F08 (`viewer/cajon-comprobacion.js`), o **`null`** si el visor se
 *   montó sin él (mismo criterio que `edicion` y `diagnostico`: `null` es una
 *   respuesta, `undefined` sería un olvido).
 *
 *   Va SUELTO y no dentro de un objeto como `diagnostico`, y la asimetría es
 *   deliberada: F07 son DOS piezas inseparables (el cajón dice las cifras y la
 *   capa las señala en el mapa), mientras que F08 es UNA. Envolverla en
 *   `{cajon}` para que se pareciera obligaría a todos sus llamantes a escribir
 *   `visor.comprobacion.cajon` por una simetría que no existe.
 * @property {{cajon: ReturnType<typeof crearCajonParcelas>,
 *   capa: ReturnType<typeof crearCapaCandidatas>}|null} parcelas  **F22.** Las dos
 *   piezas de la elección de finca, o **`null`** si el visor se montó sin ellas.
 *
 *   Van JUNTAS en un objeto —como `diagnostico` y `sobrante`, y al revés que
 *   `comprobacion`— porque aquí la asimetría de arriba **no aplica**: son dos
 *   piezas inseparables, el cajón dice los nombres y la capa enseña dónde cae cada
 *   uno. Elegir entre ocho referencias que comparten los once primeros caracteres
 *   sin ver el mapa no es elegir, es adivinar.
 * @property {{lista: ReturnType<typeof crearListaSobrante>,
 *   capa: ReturnType<typeof crearCapaPiezas>,
 *   capaFuera: ReturnType<typeof crearCapaPiezas>,
 *   capaVecinos: ReturnType<typeof crearCapaPiezas>,
 *   senal: ReturnType<typeof crearSenalMiembro>}|null} sobrante  Las CINCO piezas
 *   de F17, o **`null`** si el visor se montó sin ellas. Van JUNTAS en un objeto,
 *   como `diagnostico` y por lo mismo: se usan siempre a la vez —la lista enseña
 *   las cifras y las capas las manchas de la misma foto— y así `if (visor.sobrante)`
 *   es una sola pregunta.
 *   · `capa` pinta lo que la parcela SUELTA (cian, `P_of − P_new`).
 *   · `capaFuera` pinta lo que se SALE del contorno oficial (ámbar, `P_new − P_of`).
 *   · `capaVecinos` pinta cómo queda la parcela del COLINDANTE tras el recorte
 *     (violeta, relleno tenue). Sin ella, la aplicación proponía modificar la
 *     finca de otro titular sin enseñarla nunca.
 *     Existe desde que la puerta dejó de esconder el sobrante cuando las dos cosas
 *     pasan a la vez, que es el caso normal de un lindero rectificado.
 *   · `senal` marca UNA geometría del expediente —la de la fila que el usuario
 *     está señalando en «Para comprobar»— con un marco de selección, y sabe
 *     encuadrarla. No es una capa de datos: es un puntero, y por eso no lleva
 *     color propio (`viewer/senal-miembro.js`).
 *   ⚠️ **`lista.nodo` NO está en el documento**: `crearVisor` la fabrica y la
 *   devuelve, y quien la cuelga de la sección anfitriona del panel es `app/main.js`.
 * @property {ReturnType<typeof crearLeyenda>|null} leyenda  La LEYENDA de los
 *   grafismos del mapa (`viewer/leyenda.js`), o **`null`** si el visor se montó sin
 *   ella. Va SUELTA y no dentro de otro objeto —al contrario que `diagnostico` y
 *   `sobrante`— porque no es la mitad de nada: es cromo del mapa, como el control
 *   de capas, y no se usa junto a ninguna otra pieza.
 *
 *   Nace PLEGADA y enseñando los grupos con los que se montó. Quien la pone al día
 *   es la aplicación, que es la única que sabe qué pantalla hay:
 *   `visor.leyenda.grupos([GRUPO.LEVANTAMIENTO, GRUPO.CATASTRO, GRUPO.DIAGNOSTICO])`.
 * @property {import('./colindantes.js').CapaColindantes|null} colindantes  La capa
 *   de PARCELAS VECINAS (`viewer/colindantes.js`), o **`null`** si el visor se
 *   montó sin ella (mismo criterio que las anteriores: `null` es una respuesta,
 *   `undefined` sería un olvido). Nace VACÍA: se le dan las vecinas con
 *   `visor.colindantes.pintar([{refcat, recintos}])` cuando llegan del WFS.
 *
 *   Lo ÚNICO que el visor le hace por su cuenta es LIMPIARLA cuando entra en el
 *   store una parcela con otra identidad (paso 7): las vecinas son de una parcela
 *   concreta y dejarlas junto a otra sería mentir sobre el mapa. Quien las pinta
 *   sigue siendo el llamante, siempre.
 * @property {() => ('geometria'|'vistaInicial'|null)} encuadrar  Vuelve a encuadrar
 *   el mapa AHORA, ejecutando la cascada completa del viewport (geometría →
 *   `vistaInicial` → `throw`) sobre el estado actual del store. Es la MISMA función
 *   del paso 6 del montaje, así que respeta también el caso degenerado (un vértice,
 *   o todos coincidentes → `setView` a {@link ZOOM_PUNTO}, nunca `fitBounds` sobre
 *   unos bounds sin extensión).
 *
 *   Devuelve qué rama se aplicó, o **`null` si el visor ya está destruido** — un
 *   no-op, no un `throw`, por lo mismo que `acotaciones.pintar` y
 *   `contraste.pintar`: el desmontaje va en orden inverso y una respuesta de red en
 *   vuelo puede llegar después.
 *
 *   Casi nunca hace falta: el visor **se reencuadra solo** cuando entra una parcela
 *   distinta (ver la cabecera). Esto es para el gesto EXPLÍCITO —un botón «centrar
 *   en la parcela» después de que el usuario se haya ido navegando— y para
 *   recolocar la vista tras un cambio de tamaño del contenedor.
 * @property {() => void} destruir  Deshace TODO el ensamblaje en orden inverso
 *   (reencuadre → comprobación → diagnóstico → sincronización → edición →
 *   acotaciones → colindantes → capas → mapa). IDEMPOTENTE: llamarlo dos veces no
 *   lanza.
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
 * @param {string} [opciones.posicionOpacidad='topright']  Esquina del control de
 *   opacidad. Desde el 2026-08-19 se apila BAJO el de capas, y `bottomright` queda
 *   libre para la barra de edición (ver `viewer/capas.js#ControlOpacidad`).
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
 * @param {boolean|{posicion?: string}} [opciones.comprobacion=false]  Monta el
 *   CAJÓN de comprobación de F08 (`viewer/cajon-comprobacion.js`): qué es el `.gml`
 *   que se acaba de soltar en la ventana, qué trae y qué le pasa.
 *
 *   · **`false` (el DEFECTO) ⇒ el visor de antes de F08, sin un control ni un
 *     listener de más.** `visor.comprobacion` vale `null`. El defecto es `false`
 *     para que el visor de F03/F06/F07 quede **idéntico** y sus pruebas sigan
 *     intactas: F08 no le cobra un solo nodo a quien no lo ha pedido.
 *   · **`true`** ⇒ el cajón, con sus defectos.
 *   · **objeto** ⇒ igual, con esta ÚNICA clave (una desconocida es `TypeError`,
 *     ver {@link CLAVES_COMPROBACION}):
 *       - `posicion` → esquina del cajón (defecto `'bottomleft'`).
 *
 *   ⚠️ **`bottomleft` es la MISMA esquina que el cajón de diagnóstico**, y es una
 *   decisión, no un descuido: las cuatro esquinas del mapa ya estaban ocupadas
 *   cuando llegó F08, y los dos cajones son **mutuamente excluyentes por diseño**
 *   —la comprobación precede al diagnóstico y no coexiste con él—. Montar los dos
 *   a la vez es legítimo y es lo normal; abrirlos a la vez no, y de eso responde
 *   el cableado de la aplicación, que es quien sabe en qué punto del recorrido
 *   está. Ver la cabecera de `viewer/cajon-comprobacion.js`.
 *
 *   El cajón nace CERRADO y en blanco: montarlo no comprueba nada. Quien lo abre y
 *   le da el contenido es el cableado de F08, cuando el usuario suelta un fichero.
 * @param {boolean|{posicion?: string}} [opciones.parcelas=false]  **F22.** Monta las
 *   DOS piezas de la elección de finca: el cajón (`viewer/cajon-parcelas.js`) y la
 *   capa que dibuja las candidatas y resalta la marcada (`viewer/candidatas.js`).
 *
 *   Existe porque el DXF de «Consulta Masiva» del Catastro trae **la manzana
 *   entera** —ocho fincas disjuntas, cada una con su referencia— y hay que decir
 *   cuál es la del expediente. Ocho referencias que comparten los once primeros
 *   caracteres no se distinguen leyendo: por eso hay una capa y no solo una lista.
 *
 *   · **`false` (el DEFECTO)** ⇒ `visor.parcelas` vale `null` y no se monta ni un
 *     nodo de más. Mismo criterio que F08: una fase no le cobra nada a quien no la
 *     ha pedido.
 *   · **`true`** ⇒ las dos piezas, con sus defectos.
 *   · **objeto** ⇒ igual, con esta ÚNICA clave (ver {@link CLAVES_PARCELAS}):
 *       - `posicion` → esquina del cajón (defecto `'bottomleft'`).
 *
 *   ⚠️ **Tercer cajón en `bottomleft`**, con el mismo razonamiento que el segundo:
 *   son caras del mismo hueco y son mutuamente excluyentes por recorrido. Montar
 *   los tres es lo normal; abrir dos a la vez no, y de eso responde el cableado.
 *
 *   Nacen inertes: el cajón cerrado y con su motivo escrito, la capa sin un
 *   polígono. Quien las llena es `app/`, cuando `parsers/importar.js` bloquea con
 *   `VARIOS_RECINTOS_DISJUNTOS`.
 * @param {boolean} [opciones.colindantes=false]  Monta la capa de PARCELAS VECINAS
 *   (`viewer/colindantes.js`): un contorno gris fino por colindante, con su
 *   referencia catastral en un título emergente.
 *
 *   · **`false` (el DEFECTO) ⇒ el visor de antes, sin una capa ni un pane ocupado
 *     de más.** `visor.colindantes` vale `null`. El defecto es `false` para que el
 *     visor de F03/F06/F07 quede **idéntico** y sus pruebas sigan intactas.
 *   · **`true`** ⇒ la capa, VACÍA. Montarla no trae vecinas: eso es una consulta al
 *     WFS que hace la aplicación. Se pintan con
 *     `visor.colindantes.pintar([{refcat, recintos}])`, y se van SOLAS cuando entra
 *     otra parcela en el store (paso 7): el llamante no tiene que acordarse de
 *     limpiarlas en cada vía de entrada, que es donde se olvidaría.
 *
 *   **Es booleano y no admite objeto**, al revés que las tres opciones de arriba:
 *   la capa no tiene ni una opción de montaje (ver {@link normalizarColindantes}).
 * @param {boolean} [opciones.sobrante=false]  Monta las dos piezas de F17: la
 *   LISTA del sobrante (`viewer/lista-sobrante.js`) y la capa de MANCHAS
 *   numeradas (`viewer/piezas.js`).
 *
 *   · **`false` (el DEFECTO) ⇒ el visor de antes, sin un nodo ni un pane ocupado
 *     de más.** `visor.sobrante` vale `null`.
 *   · **`true`** ⇒ las dos, VACÍAS. Montarlas no deriva nada: derivar es una resta
 *     booleana que hace la aplicación cuando el usuario la pide. Se pintan con
 *     `visor.sobrante.lista.pintar(cesion)` y `visor.sobrante.capa.pintar(cesion.piezas)`.
 *
 *   ⚠️ **`lista.nodo` sale SIN COLGAR de ningún sitio**: hay que insertarlo en la
 *   sección `[data-anfitrion="sobrante"]` del panel. Lo hace `app/main.js`, que es
 *   el único módulo que conoce la cáscara.
 *
 *   **Es booleano y no admite objeto**, por lo mismo que `colindantes` (ver
 *   {@link normalizarSobrante}).
 * @param {boolean|{posicion?: string, grupos?: string[]}} [opciones.leyenda=false]
 *   Monta la LEYENDA de los grafismos (`viewer/leyenda.js`): la tarjeta que dice
 *   qué significa cada color y cada trazo de los que se ven sobre la ortofoto.
 *
 *   · **`false` (el DEFECTO) ⇒ el visor de antes, sin un nodo de más.**
 *     `visor.leyenda` vale `null`.
 *   · **`true`** ⇒ la leyenda PLEGADA en `bottomleft`, con
 *     `GRUPOS_POR_DEFECTO` (lo que siempre está dibujado: tu medición y el
 *     Catastro).
 *   · **`{posicion, grupos}`** ⇒ ídem eligiendo esquina y grupos iniciales. Sí
 *     admite objeto, al revés que `colindantes` y `sobrante`: ver
 *     {@link normalizarLeyenda}.
 * @returns {Visor}
 * @throws {TypeError}  Contrato del programador: `opciones` no es un objeto,
 *   `estado` no es el store, `vistaInicial` malformada, `srs` no es un string
 *   (desde `husoPorSrs`), `contenedor`/`tablaEl` no son elementos del DOM (desde
 *   `crearMapa`/`sincronizar`), `edicion`, `diagnostico` o `comprobacion` que no
 *   son booleano ni objeto, `colindantes`/`sobrante` que no son booleanos,
 *   `alPrevisualizar` que no es función, o **no hay ni geometría ni `vistaInicial`**.
 * @throws {RangeError}  `srs` no soportado (desde `husoPorSrs`), `baseInicial`
 *   inexistente (desde `montarCapas`), `maxZoom` que no supera el zoom nativo
 *   de las capas montadas, `edicion.tolerancia` negativa (desde `crearEdicion`),
 *   `diagnostico.posicion` que no es una esquina de Leaflet (desde
 *   `crearCajonDiagnostico`) o `comprobacion.posicion` ídem (desde
 *   `crearCajonComprobacion`).
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
    comprobacion: opcionComprobacion = false,
    parcelas: opcionParcelas = false,
    colindantes: opcionColindantes = false,
    sobrante: opcionSobrante = false,
    leyenda: opcionLeyenda = false,
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
  const opcionesComprobacion = normalizarComprobacion(opcionComprobacion)
  const opcionesParcelas = normalizarParcelas(opcionParcelas)
  const montarColindantes = normalizarColindantes(opcionColindantes)
  const montarSobrante = normalizarSobrante(opcionSobrante)
  const opcionesLeyenda = normalizarLeyenda(opcionLeyenda)
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

    // 2 bis · Las PARCELAS VECINAS. Va pegada a las capas de fondo porque es lo
    // que es —contexto cartográfico, en el pane más bajo del visor (405)— y nace
    // VACÍA: no pone ni una capa en el mapa hasta que alguien le pase vecinas, así
    // que aquí es tan inerte como el cajón cerrado de F08. No necesita que el mapa
    // tenga vista (Leaflet difiere el `onAdd` de toda capa hasta que la tiene).
    /** @type {ReturnType<typeof crearCapaColindantes>|null} */
    let colindantes = null
    if (montarColindantes) {
      colindantes = crearCapaColindantes({ mapa, zona, alAvisar: avisar })
      deshacer.push(() => colindantes.destruir())
    }

    // 2 quater · LOS PUNTOS SUELTOS DEL LEVANTAMIENTO (2026-08-19). Se monta
    // SIEMPRE y nace vacía, como la de vecinas: no pone una capa en el mapa hasta
    // que alguien le pase puntos, y son un dato del expediente —viajan en
    // `parcela.puntosLevantamiento`— y no una opción del visor, así que no hay
    // nada que preguntarle al llamante. La alternativa era un tercer booleano de
    // montaje para una capa inerte.
    //
    // ⚠️ **Y su gemela es `edicion.fijarPuntos`, que come del MISMO array.** Ésta
    // los enseña y aquélla los engancha; si un día una de las dos se alimentara de
    // otro sitio, el usuario apuntaría a un punto y engancharía a otro.
    const puntosLevantamiento = crearCapaPuntosLevantamiento({ mapa, zona, alAvisar: avisar })
    deshacer.push(() => puntosLevantamiento.destruir())

    // 2 ter · LA LEYENDA. Va aquí, pegada a las capas y antes de que se dibuje
    // nada, por lo mismo que el control de capas: es cromo del mapa y no depende
    // de que haya geometría. Nace PLEGADA —una pastilla de 90 px— y sin saber qué
    // hay en pantalla: quién enciende y apaga grupos es la aplicación, con
    // `visor.leyenda.grupos([...])`. Ver la cabecera de `viewer/leyenda.js`.
    /** @type {ReturnType<typeof crearLeyenda>|null} */
    let leyenda = null
    if (opcionesLeyenda !== null) {
      leyenda = crearLeyenda({
        mapa,
        alAvisar: avisar,
        ...(opcionesLeyenda.posicion === undefined ? {} : { posicion: opcionesLeyenda.posicion }),
        ...(opcionesLeyenda.grupos === undefined ? {} : { grupos: opcionesLeyenda.grupos }),
      })
      deshacer.push(() => leyenda.destruir())
    }

    // 3 · Las dos piezas de F06, ANTES de sincronizar porque `sincronizar`
    // CONSUME sus ganchos y solo los acepta al construirse (ver cabecera).
    /** @type {import('./acotaciones.js').Acotaciones|null} */
    let acotaciones = null
    /** @type {ReturnType<typeof crearEdicion>|null} */
    let edicion = null
    /** @type {import('./barra-edicion.js').BarraMontada|null} */
    let barraEdicion = null
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
      //
      // Se guarda en `barraEdicion` y SE DEVUELVE (F11 · T1.5) porque hay un
      // llamante que necesita OCULTARLA sin desmontarla: con la rama EDIFICIO
      // activa, la parcela que hay en el mapa es CONTEXTO, y `viewer/edicion.js`
      // seguiría dejando arrastrar sus vértices y respondiendo a Ctrl+Z — o sea,
      // deshaciendo una edición de parcela mientras el usuario cree estar
      // trabajando sobre el edificio. Ocultar es lo correcto y desmontar no:
      // `crearEdicion` apaga el `doubleClickZoom` y lo restaura al destruirse, y
      // volver de rama tendría que reconstruir la barra entera y volver a
      // cablearla desde `app/main.js`. Ver la propiedad `barraEdicion` del
      // typedef {@link Visor}.
      if (opcionesEdicion.barra) {
        // `alAvisar` NO es opcional aquí, aunque el parámetro lo sea: era la única
        // pieza del ensamblaje que se montaba sin el canal (auditoría V7), y su
        // único aviso —la caída a `bottomleft` cuando el mapa no expone
        // `_controlCorners`, `barra-edicion.js`— se iba al `console.warn` del suelo
        // mínimo en vez de a la UI. O sea: la barra aparecía en otra esquina,
        // encima del control de escala, y nadie se lo contaba al usuario.
        barraEdicion = crearBarraEdicion({
          mapa,
          posicion: opcionesEdicion.posicionBarra,
          alAvisar: avisar,
        })
        deshacer.push(() => barraEdicion.destruir())
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
    // paso 3, o con los CUATRO en `null` (el visor de F03, byte a byte).
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
      // La × de cada fila (2026-08-10). Va atada a que HAYA edición, y por eso el
      // ternario y no una función siempre: montado sin edición —el visor de F03, o
      // una pantalla de solo lectura— la tabla no estrena la cuarta columna, que es
      // lo correcto. Un botón de borrar en una tabla que no se puede editar sería
      // un mando muerto, y esos no se apagan: no se ponen.
      alBorrar: edicion === null ? null : (ref) => edicion.eliminar(ref),
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

    // 5 bis · El cajón de F08. Nace CERRADO y en blanco, así que es tan inerte
    // aquí como las dos piezas de F07 y por el mismo motivo: no se suscribe a
    // ningún evento del mapa, no mide en píxeles y no toca el store. Va DESPUÉS
    // del diagnóstico porque comparte esquina con su cajón —Leaflet apila por
    // orden de alta dentro de una esquina, y con los dos abiertos (que no debería
    // pasar nunca) el de la comprobación queda debajo, que es lo coherente con el
    // recorrido—, y ANTES del encuadre por lo mismo que el diagnóstico: para que
    // el ensamblaje siga siendo atómico y para que sus nodos ya estén en el
    // documento cuando `crearVisor` devuelva, que es lo que el cableado necesita
    // para resolverlos por selector.
    /** @type {ReturnType<typeof crearCajonComprobacion>|null} */
    let comprobacion = null
    if (opcionesComprobacion !== null) {
      comprobacion = crearCajonComprobacion({
        mapa,
        posicion: opcionesComprobacion.posicion,
        alAvisar: avisar,
      })
      deshacer.push(() => comprobacion.destruir())
    }

    // 5 quater · Las dos piezas de F22: el CAJÓN donde se elige cuál de las N
    // fincas de un dibujo es la del expediente, y la CAPA que las dibuja y resalta
    // la que se está mirando. Van juntas porque son una sola función partida por
    // el patrón de la casa —un control es DOM y una capa es geometría—, igual que
    // `diagnostico` es `{cajon, contraste}` y `sobrante` es `{lista, capa}`.
    //
    // ⚠️ El cajón va DESPUÉS del de comprobación, y no da igual: los tres cajones
    // comparten `bottomleft`, y Leaflet apila por orden de alta dentro de una
    // esquina. Con dos abiertos a la vez —que no debería pasar nunca, y de eso se
    // ocupa el cableado— el último dado de alta queda debajo. Éste es el más
    // reciente del recorrido, así que ahí es donde toca.
    //
    // Las dos nacen inertes: el cajón cerrado y con su motivo escrito, la capa sin
    // un polígono puesto. No se suscriben a nada del mapa ni tocan el store.
    /** @type {{cajon: object, capa: object}|null} */
    let parcelas = null
    if (opcionesParcelas !== null) {
      const cajonParcelas = crearCajonParcelas({
        mapa,
        posicion: opcionesParcelas.posicion,
        alAvisar: avisar,
      })
      const capaCandidatas = crearCapaCandidatas({ mapa, zona, alAvisar: avisar })
      parcelas = { cajon: cajonParcelas, capa: capaCandidatas }
      deshacer.push(() => {
        capaCandidatas.destruir()
        cajonParcelas.destruir()
      })
    }

    // 5 ter · Las dos piezas de F17: la LISTA del sobrante y sus MANCHAS. Nacen
    // las dos vacías —la lista con el botón apagado y su motivo escrito, la capa
    // sin un polígono puesto—, así que aquí son tan inertes como los dos cajones
    // anteriores y por el mismo motivo: no se suscriben a nada del mapa.
    //
    // ⚠️ La lista **no se cuelga de ningún sitio aquí**: se fabrica y se devuelve.
    // Quién la aloja es `app/main.js` (la sección `[data-anfitrion="sobrante"]` del
    // panel), que es el único módulo que conoce la cáscara. Es la misma división
    // que el cajón de diagnóstico estrenó el 2026-08-05 con `anfitrion()`, con una
    // diferencia: aquél nace en una esquina del mapa y SE MUDA; éste nunca ha
    // estado en el mapa, así que hasta que alguien lo cuelgue no está en el
    // documento — y por eso `crearVisor` lo devuelve en vez de darlo por puesto.
    /** @type {{lista: object, capa: object, capaFuera: object, capaVecinos: object,
     *   senal: object}|null} */
    let sobrante = null
    if (montarSobrante) {
      const capaPiezas = crearCapaPiezas({ mapa, zona, alAvisar: avisar })
      deshacer.push(() => capaPiezas.destruir())

      // La SEGUNDA capa: lo que la geometría medida se sale del contorno oficial.
      //
      // ⛔ Son dos capas y no una con dos modos, y la razón es que **se pintan a la
      // vez**: el caso que las estrena es justo el mixto —la parcela se retranquea
      // por un lado y se sale por otro—, así que una sola capa tendría que llevar
      // dos listas, dos resaltados y dos paletas dentro. Cada una con su foto y su
      // resaltado recíproco es lo mismo que el visor ya hace con `contraste` y
      // `partes`, y cuesta un objeto más en el retorno.
      const capaFuera = crearCapaPiezas({ mapa, zona, alAvisar: avisar, variante: VARIANTE.FUERA })
      deshacer.push(() => capaFuera.destruir())

      // ⛔ **LA TERCERA CAPA, Y ES UN DEFECTO CORREGIDO** (2026-08-18): cómo queda
      // la parcela del COLINDANTE después del recorte. Se calculaba, viajaba en la
      // foto y entraba en el `.gml` como una parcela más del expediente… y no se
      // dibujaba en ningún sitio. La aplicación proponía modificar la finca de otro
      // titular sin enseñarla nunca.
      //
      // Es una capa aparte y no un modo de las otras dos por lo mismo que aquéllas
      // son dos: **se pintan a la vez** —lo ámbar es lo que invades, lo violeta es
      // cómo le queda a él— y cada una tiene su foto y su resaltado.
      const capaVecinos = crearCapaPiezas({ mapa, zona, alAvisar: avisar, variante: VARIANTE.VECINO })
      deshacer.push(() => capaVecinos.destruir())

      // ⭐ **CON EL MAPA DESDE EL 2026-08-17.** Con él, la lista se monta como
      // control de Leaflet en `bottomleft` y se arrastra; sin él seguiría siendo
      // el nodo suelto que era, y alguien tendría que colgarlo. Ya no lo cuelga
      // nadie: `app/cableado-derivacion.js` dejó de hacerlo y la sección
      // `[data-anfitrion="sobrante"]` de `index.html` se retiró.
      const listaSobrante = crearListaSobrante({
        mapa,
        documento: contenedor.ownerDocument ?? undefined,
        alAvisar: avisar,
      })
      deshacer.push(() => listaSobrante.destruir())

      // ⭐ **LA CUARTA PIEZA (2026-08-20): la SEÑAL de «cuál es cuál».**
      //
      // No es una capa de datos como las tres de arriba —no tiene foto propia ni
      // se pinta sola—: es el PUNTERO que marca en el mapa la geometría de la
      // fila que el usuario está señalando en la zona «Para comprobar», y sabe
      // encuadrarla. Existe porque aquella zona lista las parcelas del expediente
      // por su referencia catastral y el caso normal es que compartan once
      // caracteres de doce: el usuario tenía delante todo lo que iba a firmar y
      // no podía emparejar una fila con ninguna de las manchas del mapa.
      //
      // ⛔ **Y no es una VARIANTE más de `crearCapaPiezas`**, que era lo cómodo.
      // Aquella capa pinta MUCHAS manchas permanentes, numeradas y con un color
      // que significa algo; ésta pinta UNA, mientras se apunta, y sin color
      // propio a propósito (el porqué, en la cabecera de su módulo). Meterlas en
      // la misma fábrica habría obligado a que «pintar el sobrante» y «señalar
      // una parcela» compartieran el estado de resaltado, que son dos cosas que
      // el usuario hace a la vez.
      const senalMiembro = crearSenalMiembro({ mapa, zona, alAvisar: avisar })
      deshacer.push(() => senalMiembro.destruir())

      sobrante = {
        lista: listaSobrante,
        capa: capaPiezas,
        capaFuera,
        capaVecinos,
        senal: senalMiembro,
      }
    }

    // 6 · El encuadre, lo ÚLTIMO del MONTAJE (ver cabecera: así la capa WMS del
    // Catastro pide UNA sola imagen, y del encuadre bueno).
    encuadrar({ mapa, estado, zona, vistaInicial, avisar })

    // 7 · EL REENCUADRE VIVO: el mapa sigue a la parcela, pero no persigue al
    // editor (ver el bloque homónimo de la cabecera).
    //
    // La clave se inicializa AQUÍ, después del paso 6, con la parcela que se acaba
    // de encuadrar: eso —y que `crearEstadoVista#subscribe` no notifica al
    // suscribirse— es lo que garantiza que el arranque encuadre UNA sola vez.
    let claveEncuadrada = claveDeParcela(estado.get())
    /** Un solo aviso de «parcela sin identidad» por visor, no uno por `set`. */
    let avisadoSinIdentidad = false

    const bajaReencuadre = estado.subscribe((parcela) => {
      const clave = claveDeParcela(parcela)

      if (clave === claveEncuadrada) {
        // Caso normal y masivo: la MISMA parcela, editada. No se toca la vista.
        // Pero si la parcela no dice quién es, «la misma» es una suposición y no
        // un hecho: se avisa UNA vez y se sigue sin mover el mapa, que es la
        // opción que nunca estropea un arrastre en curso. Con `crearParcela` esto
        // no ocurre (`idLocal` es obligatorio); un POJO a mano sí puede.
        if (clave === null && !avisadoSinIdentidad && tieneGeometria(parcela)) {
          avisadoSinIdentidad = true
          avisar(
            `La parcela no trae ni referencia catastral ni identificador local, así que el ` +
              `visor no puede distinguir «ha entrado otra parcela» de «se ha editado esta»: ` +
              `no reencuadra solo. Usa visor.encuadrar() para encuadrarla a mano.` +
              // La coda solo aparece si HAY capa de vecinas: nombrar una pieza que
              // este visor no monta sería mandar al usuario a un `null`.
              (colindantes === null
                ? ''
                : ` Por lo mismo tampoco suelta las parcelas colindantes que hubiera ` +
                  `pintadas: si ya no son suyas, visor.colindantes.limpiar().`),
            { nivel: NIVEL.AVISO },
          )
        }
        return
      }

      claveEncuadrada = clave

      // ── PARCELA NUEVA ⇒ LAS VECINAS DE LA ANTERIOR SE VAN ────────────────────
      // Unas colindantes dibujadas junto a una parcela que ya no está en pantalla
      // son una MENTIRA sobre el mapa: el contorno gris sigue diciendo «esto linda
      // con lo tuyo» cuando lo tuyo es otra cosa, y a 500 m de distancia ni siquiera
      // se ve que se ha quedado atrás.
      //
      // Va AQUÍ, colgado del MISMO cambio de identidad que dispara el reencuadre, y
      // no en los cableados de `app/`, por tres razones:
      //   · Es UN solo sitio. Hoy hay tres vías de entrada de parcela (el Catastro
      //     de F05, el fichero GML de F08 y cualquier `estado.set` directo) y todas
      //     pasan por el store; una llamada por cableado sería un cable que se rompe
      //     EN SILENCIO el día que alguien añada la cuarta y no se acuerde de ella.
      //   · Dice exactamente lo que significa: parcela nueva, vecinas que ya no son
      //     suyas. Es el mismo hecho que el reencuadre, no una coincidencia.
      //   · `viewer/` es quien tiene la capa. `app/` tendría que ir a buscarla.
      //
      // ⚠️ **Y HAY EXACTAMENTE UNA EXCEPCIÓN, desde el 2026-08-08.** «Traer el
      // parcelario de fondo» cambia la `geometriaOficial` **sin mover la identidad**:
      // la parcela de trabajo sigue siendo la del usuario, con su `idLocal` y —si ya
      // la tenía— con su misma referencia catastral. Ese `set` entra por aquí como
      // «la MISMA parcela, editada» y no suelta nada, así que los contornos de las
      // vecinas del fondo anterior se quedarían dibujados. Lo limpia `app/main.js`
      // desde `alCambiarOficial`, llamando a `visor.colindantes.limpiar()`.
      //
      // No se arregla ampliando esta clave a una de CONTENIDO: la clave se consulta
      // en cada `set` —o sea, en cada vértice que se arrastra— y mirar la geometría
      // haría reencuadrar el mapa a media edición, que es justo lo que el bloque «EL
      // MAPA SIGUE A LA PARCELA» existe para impedir. Un caso que este módulo no
      // puede distinguir se dice desde fuera; no se adivina desde dentro.
      //
      // ANTES del encuadre a propósito: la vista se mueve a la parcela nueva con el
      // mapa YA limpio, así que ningún repintado intermedio puede enseñar los
      // contornos viejos sobre ella. Y se limpia también cuando la parcela nueva no
      // trae geometría (o cuando el store se VACÍA con `set(null)`, que aquí es un
      // cambio de identidad como otro cualquiera): entonces no hay encuadre que
      // hacer, y unas vecinas huérfanas serían todavía menos explicables.
      if (colindantes !== null) colindantes.limpiar()

      // Solo la rama de geometría: ni `throw` ni salto a `vistaInicial` dentro de
      // una notificación del store (ver la cabecera). Sin geometría, la vista se
      // queda donde está.
      encuadrarGeometria({ mapa, estado, zona, avisar })
    })
    deshacer.push(() => bajaReencuadre())

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
      barraEdicion,
      diagnostico,
      comprobacion,
      parcelas,
      colindantes,
      puntosLevantamiento,
      sobrante,
      leyenda,

      /**
       * El encuadre EXPLÍCITO. Misma función que el paso 6 —cascada completa— y
       * misma clave de identidad: encuadrar a mano cuenta como «esta es la vista de
       * esta parcela», así que se actualiza `claveEncuadrada` y el reencuadre
       * automático no vuelve a dispararse por lo mismo.
       */
      encuadrar() {
        if (destruido) return null
        const rama = encuadrar({ mapa, estado, zona, vistaInicial, avisar })
        claveEncuadrada = claveDeParcela(estado.get())
        return rama
      },

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

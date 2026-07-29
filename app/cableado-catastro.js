// app/cableado-catastro.js — F05 · T3B. EL CABLE entre el cliente del Catastro y
// la cáscara de la app.
//
// `services/catastro.js` está terminado y sabe hablar con el Catastro; `index.html`
// tiene el campo, los dos botones y las tres cajas vacías. Mientras nadie una las
// dos cosas, F05 entera es código muerto: este fichero es lo que la convierte en
// producto, igual que `app/main.js#cablearGeneracionGml` hizo con F04.
//
// Su anatomía es DELIBERADAMENTE la misma que la de aquel cableado —nodos
// resueltos por selector con `throw` si faltan, selectores exportados como
// constantes, dependencias inyectables con valor por defecto y un `destruir()`
// idempotente—, y no por simetría estética: es lo que permite que el siguiente que
// llegue reconozca el patrón sin leerlo entero.
//
// ── LO QUE ESTE MÓDULO **NO** HACE, Y CONVIENE QUE ESTÉ POR ESCRITO ──────────
//   · **No habla con el Catastro.** No construye URLs, no llama a `fetch`, no sabe
//     qué es una *stored query*. Recibe el cliente ya hecho (`opciones.cliente`) y
//     consume su vocabulario: {@link MOTIVO_CATASTRO}, {@link NIVEL_POR_MOTIVO},
//     {@link ORIGEN} y `normalizarRefcat`. Duplicar aquí cualquiera de esas
//     decisiones sería crear una segunda verdad sobre el Catastro.
//   · **No importa Leaflet.** El mapa entra por DUCK TYPING (`on`/`off`) y la
//     coordenada del clic se convierte con `viewer/_comun.js#latLngAUTM`. Ver la
//     sección del clic en el mapa.
//   · **No decide la cadencia ni el arranque.** No consulta al Catastro por el mero
//     hecho de montarse: una petición que nadie ha pedido, disparada en cada
//     recarga de la página, es exactamente lo que la política de uso del servicio
//     castiga (override O8). Todo sale de un gesto explícito del usuario.
//   · **No toca la ficha del pie** (`data-ficha="…"`). Esos nodos son de
//     `app/main.js`; `colindantes()` DEVUELVE su resultado —y desde F06 lo
//     PUBLICA además a quien se haya suscrito con `alColindantes`— para que quien
//     cablee decida qué hacer con él. Ni una vecina entra en el modelo.
//
// ── F06 · LOS DOS GANCHOS HACIA AFUERA, Y POR QUÉ SON DOS Y NO UNO ──────────
// Hasta F05 este módulo no llamaba a nadie: escribía en el store, en la cáscara y
// devolvía resultados. F06 necesita dos avisos que el store NO puede dar, y por eso
// son dos ganchos y no un suscriptor más de `estado.subscribe`:
//
//   · **`alCargarParcela(parcela)`** — se dispara tras el `estado.set` de una
//     parcela **TRAÍDA del Catastro**, y sólo ahí. El store notifica TODOS los
//     `set`, y desde fuera «parcela recién traída» y «parcela con un vértice
//     movido» son indistinguibles: quien reinicia el historial de edición
//     (`edit/historial.js`) necesita justo esa diferencia, porque reiniciarlo en
//     cada arrastre borraría el «deshacer» del usuario. `deducir()` **no** lo
//     dispara: rellena el campo, no mete geometría.
//   · **`alColindantes(resultado)`** — SUSCRIPCIÓN (varios oyentes, con baja), no
//     un callback único, calcada de `crearEstadoVista#subscribe`. Recibe el
//     {@link ResultadoCatastro} de una consulta de vecinas que ha ido BIEN: los
//     `ok:false` se cuentan por el renglón y el panel y no se publican, porque
//     quien se suscribe espera datos utilizables (las vecinas son dianas del snap
//     de F06), no un objeto que tenga que volver a clasificar.
//
// Un oyente que revienta **no tumba el cableado ni impide que se notifique a los
// demás**: se envuelve, se cuenta por el panel y por la consola
// ({@link MENSAJE_SUSCRIPTOR_ROTO}) y se sigue. Lo contrario haría que un bug en el
// snap convirtiera una consulta correcta en una excepción del Catastro, que es
// mentir sobre de quién es el fallo.
//
// ⚠️ Los dos son **opcionales**. Sin ellos el módulo se comporta exactamente como
// en F05, y eso no es cortesía: `app/main.js` los enchufa cuando existe quien los
// consume, y ningún test de F05 tuvo que cambiar para que existieran.
//
// ── POR QUÉ «TRAER COLINDANTES» ES UN BOTÓN Y NO UN EFECTO DE `cargar()` ────
// Las vecinas hacen falta desde F06 (snap «al parcelario oficial y a las
// colindantes»), y la tentación es traerlas solas al cargar la parcela. No se hace:
// sería una SEGUNDA petición por cada parcela que nadie ha pedido, que es
// exactamente lo que castiga la política de uso del servicio (override O8), y
// dispararlas desde el suscriptor del store acabaría consultando al Catastro **al
// mover un vértice**. Una pulsación, una petición. La segunda pulsación sobre la
// misma parcela **no vuelve a la red**, y eso tampoco se resuelve aquí: lo da la
// caché de `services/catastro.js` (clave `parcela:<srs>:<refcat>:vecindad`).
//
// ── LAS DOS DEFENSAS CONTRA LA CARRERA, Y HACEN FALTA LAS DOS ───────────────
// Dos consultas encabalgadas (dos clics seguidos, un clic mientras F07 pide los
// colindantes, una pantalla que se cierra con algo en vuelo) se defienden con:
//
//   1. **`AbortController`** — corta la red. Empezar una consulta aborta la
//      anterior: el servicio deja de trabajar para una pregunta que ya no
//      interesa, que es lo que de verdad protege del bloqueo.
//   2. **Token de secuencia** — impide ESCRIBIR. Y no sobra: abortar NO impide que
//      una respuesta **ya en vuelo** llegue igualmente, y llegue TARDE. Si la
//      primera consulta se resuelve después de la segunda —y es lo normal cuando
//      la primera referencia era la lenta—, sin token pisaría el store con la
//      parcela vieja y el usuario acabaría con una parcela que no pidió, en
//      silencio. El precedente está en `viewer/wms-catastro.js` y allí está escrito
//      con estas palabras: «una respuesta lenta de un encuadre viejo NUNCA puede
//      pisar una imagen más nueva».
//
// Una consulta SUPERADA no escribe nada —ni store, ni renglón, ni procedencia— y
// devuelve un {@link ResultadoCatastro} con motivo `CANCELADA`. Tampoco se anuncia,
// misma decisión que `wms-catastro.js`: avisar de una consulta que el propio
// usuario ha sustituido es ruido sobre algo que él ya sabe.
//
// ⚠️ Que los botones se apaguen mientras hay algo en vuelo **no es una de las dos
// defensas**: `disabled` es estado de PRESENTACIÓN, lo escribe este mismo módulo y
// se puede quitar desde el inspector, desde un atajo de teclado que mañana dispare
// `cargar()` sin pasar por el botón, o desde F07 llamando a la API. Es cortesía;
// la garantía son el token y el abortador. Es la misma doctrina que
// `cablearGeneracionGml`, que vuelve a validar en vez de fiarse de `boton.disabled`.
//
// ── EL REPARTO DE SUPERFICIES (calcado de `cablearGeneracionGml`) ───────────
// Hay TRES sitios donde escribir y cada uno dice una cosa distinta. Mezclarlos es
// lo que produce paneles que repiten y renglones que no caben:
//
//   · **Renglón `role="status"`** (`data-estado="cargar-catastro"`) → el DESENLACE
//     de la acción que el usuario acaba de pedir. Siempre, salga bien o mal. Es una
//     línea de 11 px: lleva el RESUMEN ({@link RESUMEN_POR_MOTIVO}), nunca el
//     mensaje largo del servicio.
//   · **Panel de avisos** → lo que le pasa al DATO, entero y sin recortar: «el
//     servicio ha devuelto 5 parcelas y ninguna es la pedida», «esta parcela sale
//     de la copia local, guardada hace 6 días». Es el único sitio donde caben los
//     textos que `services/catastro.js` compone con el literal del Catastro dentro.
//   · **`data-procedencia`** → de dónde salió el dato que hay AHORA en pantalla y
//     su antigüedad. Es lo único que impide que una parcela sacada de la caché se
//     presente como recién traída de la Sede. Se reescribe cuando entra un dato
//     nuevo; **una consulta fallida no lo toca**, porque lo que ya está en el store
//     sigue viniendo de donde venía y borrarlo sería mentir por omisión.
//
// **Ningún motivo de F05 es `ERROR`**, y aquí no se reinventa la clasificación: el
// nivel del panel sale de {@link NIVEL_POR_MOTIVO}. Que el Catastro no conteste no
// bloquea nada —la geometría se puede dibujar a mano y el GML se genera igual—, así
// que los ocho motivos son `AVISO`. La ÚNICA excepción es la excepción de verdad:
// un `throw` inesperado (contrato roto en una capa de abajo) sí sale como
// `NIVEL.ERROR`, porque no es un motivo del catálogo sino un defecto de
// programación, y `cablearGeneracionGml` ya lo trata así.
//
// ── POR QUÉ LA DEDUCCIÓN NO ESCRIBE EN EL MODELO ───────────────────────────
// `deducir()` rellena el CAMPO y el rótulo de procedencia, y nada más. `refcat` no
// entra en el modelo hasta que el usuario pulsa «Traer del Catastro». Así
// `parcela.refcat` significa SIEMPRE «esto lo afirma el usuario» y nunca «esto lo
// adivinó un servicio», que es la diferencia entre una referencia catastral y una
// conjetura con formato de referencia catastral.
//
// ── POR QUÉ EL PUNTO DE LA DEDUCCIÓN ES `puntoInterior` Y NO EL CENTROIDE ───
// El centroide aritmético de una parcela en forma de L cae FUERA del polígono. El
// Catastro no tiene forma de saberlo: contestaría tan tranquilo con la referencia
// de la parcela VECINA, y esta herramienta rellenaría el campo con un dato mal, en
// silencio — justo lo que prohíbe la regla de oro 1. `gml/anillos.js#puntoInterior`
// devuelve un punto ESTRICTAMENTE interior (huecos descontados) y lo verifica en
// vez de confiar.
//
// ⚠️ Trampa dentro de la trampa: `puntoInterior` devuelve además unas `detecciones`
// cuyo texto habla del `cp:referencePoint` y de «lo que el Catastro rechaza». **Ese
// texto es FALSO en este contexto**: aquí no se está serializando nada y no hay
// ningún `referencePoint` que el Catastro pueda rechazar. Por eso este módulo usa
// el punto y **no republica sus detecciones**: traduce el caso «no hay punto» a un
// mensaje propio y verdadero.
//
// Su test es `test/app/catastro.dom.test.js`, **con sufijo `.dom`**: toca el DOM.

import { husoPorSrs } from '../geo/huso.js'
import { puntoInterior } from '../gml/anillos.js'
import { ORIGEN_PARCELA, crearParcela } from '../model/parcela.js'
import {
  MOTIVO_CATASTRO,
  NIVEL_POR_MOTIVO,
  ORIGEN,
  normalizarRefcat,
} from '../services/catastro.js'
import { NIVEL, latLngAUTM } from '../viewer/_comun.js'

// ── Los selectores del contrato con `index.html` ─────────────────────────────
//
// Se exportan por el mismo motivo que `SELECTOR_BOTON_GML` en F04: para que los
// tests y los guiones de humo apunten al MISMO literal que el módulo, en vez de a
// una copia que puede divergir sin que nadie se entere. Los `data-*` de
// `index.html` son contrato de este fichero, y su cabecera lo dice allí.

/** El `<input>` de la referencia catastral. */
export const SELECTOR_CAMPO_REFCAT = '[data-campo="refcat"]'

/** «Traer del Catastro». Nace habilitado: escribir y pulsar es la acción primera. */
export const SELECTOR_BOTON_CARGAR = '[data-accion="cargar-catastro"]'

/**
 * «Deducir del mapa». **Nace `disabled` en `index.html`** y lo habilita el ESTADO,
 * nunca la mera importación de este módulo: ver {@link puedeDeducirDe}.
 */
export const SELECTOR_BOTON_DEDUCIR = '[data-accion="deducir-refcat"]'

/**
 * «Traer colindantes». **Nace `disabled` en `index.html`** y lo habilita el
 * ESTADO: ver {@link puedePedirColindantesDe}.
 *
 * No tiene renglón propio y usa el del bloque ({@link SELECTOR_ESTADO_CATASTRO}),
 * que es lo correcto: es una consulta al Catastro más, y darle un `role="status"`
 * aparte haría que dos renglones vecinos se contradijeran sobre cuál fue la última
 * acción.
 */
export const SELECTOR_BOTON_COLINDANTES = '[data-accion="traer-colindantes"]'

/** Renglón `role="status"` del bloque: el desenlace de la última acción. */
export const SELECTOR_ESTADO_CATASTRO = '[data-estado="cargar-catastro"]'

/** De dónde salió el dato que hay en pantalla, y su antigüedad. */
export const SELECTOR_PROCEDENCIA = '[data-procedencia="parcela"]'

/** La `<ul>` de candidatos de la deducción. Nace `hidden` y vacía. */
export const SELECTOR_CANDIDATOS = '[data-candidatos="refcat"]'

// ── Constantes de presentación ───────────────────────────────────────────────

/** Modificador de `.gml-accion-estado` para el desenlace que NO trae el dato. */
const CLASE_ESTADO_ERROR = 'gml-accion-estado--error'

/**
 * Rótulo de procedencia de la referencia DEDUCIDA. El texto es el de la spec (§7.3)
 * y las dos mitades importan: «deducida de la ubicación» dice que no la ha afirmado
 * nadie, y «puedes corregirla» dice que el campo sigue siendo del usuario.
 */
export const ROTULO_DEDUCIDA = 'Parcela deducida de la ubicación · puedes corregirla'

/**
 * Lo que se le dice al usuario cuando la consulta revienta por un defecto de
 * programación (un contrato roto en `services/`, en `model/` o aquí). No intenta
 * explicar la causa técnica —no le sirve de nada— pero tampoco la esconde: dice qué
 * ha pasado, que no se ha cambiado nada, y dónde está el detalle para copiarlo.
 *
 * Se exporta para que su test lo afirme sin copiar el literal, igual que
 * `MENSAJE_FALLO_INESPERADO` de `app/main.js`.
 */
export const MENSAJE_FALLO_INESPERADO =
  'La consulta al Catastro se ha interrumpido por un fallo interno de la aplicación; no se ha ' +
  'cambiado nada. El detalle técnico está en la consola del navegador.'

/**
 * Lo que se le dice al usuario cuando revienta algo que estaba PENDIENTE del
 * resultado (el callback `alCargarParcela` o un suscriptor de `alColindantes`), no
 * la consulta.
 *
 * Es distinto de {@link MENSAJE_FALLO_INESPERADO} a propósito, y la diferencia
 * importa: ahí falló la consulta y no se cambió nada; aquí la consulta ha ido bien,
 * el dato del Catastro es correcto y lo que puede haberse quedado a medias es lo
 * que dependía de él. Decir «la consulta se ha interrumpido» sería culpar al
 * Catastro de un bug de esta casa.
 *
 * **No toca el renglón**: el renglón cuenta el desenlace de lo que el usuario
 * pidió, y lo que pidió salió bien. Va por panel y consola, que son dos canales.
 */
export const MENSAJE_SUSCRIPTOR_ROTO =
  'La consulta al Catastro ha terminado bien, pero algo que estaba pendiente de su resultado ha ' +
  'fallado por un defecto interno de la aplicación. El dato del Catastro es correcto; lo que ' +
  'puede no haberse actualizado es lo que dependía de él. El detalle técnico está en la consola ' +
  'del navegador.'

/**
 * Por qué «Traer colindantes» está apagado. **Un botón gris y mudo es un error
 * silencioso** (regla de oro 1, y está escrito en `index.html`: «quien las
 * enciende —y quien escribe el motivo cuando NO las enciende— es el cableado»).
 *
 * Se exporta para que su test lo afirme sin copiar el literal.
 */
export const MOTIVO_COLINDANTES_APAGADO =
  '«Traer colindantes» está apagado: las vecinas lo son de una parcela concreta, y todavía no ' +
  'hay ninguna cargada con referencia catastral. Trae una parcela del Catastro y se enciende.'

/** Cola del renglón cuando el mensaje ÍNTEGRO acaba de entrar en el panel. */
const COLA_DETALLE = 'El detalle está en el panel de avisos.'

/**
 * Resumen de UNA LÍNEA por motivo, para el renglón. **Mapa explícito y TOTAL sobre
 * {@link MOTIVO_CATASTRO}**, con guardián de carga más abajo: un `default` es
 * exactamente lo que hace que un motivo nuevo herede un texto que nadie ha escrito.
 *
 * No sustituye al `mensaje` del cliente —que es largo, presentable y va ÍNTEGRO al
 * panel—: lo resume para una línea de 11 px. Que la UI pueda decidir con `motivo`
 * sin analizar el texto de `mensaje` es una promesa explícita de
 * `services/catastro.js`, y esto es esa promesa cobrada.
 *
 * @type {Readonly<Record<string, string>>}
 */
const RESUMEN_POR_MOTIVO = Object.freeze({
  [MOTIVO_CATASTRO.ENTRADA_INVALIDA]:
    'No se ha consultado nada: lo escrito no tiene forma de referencia catastral de parcela.',
  [MOTIVO_CATASTRO.NO_ENCONTRADO]:
    'El Catastro no tiene nada que devolver aquí, y eso es una respuesta válida.',
  [MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE]:
    'El encuadre pedido es más grande de lo que el servicio admite. Acerca el mapa.',
  [MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE]:
    'El Catastro ha contestado algo que esta aplicación no sabe usar.',
  [MOTIVO_CATASTRO.ESTADO_HTTP]: 'El servicio del Catastro ha respondido con un error.',
  [MOTIVO_CATASTRO.TIEMPO_AGOTADO]: 'El Catastro ha tardado demasiado en contestar.',
  [MOTIVO_CATASTRO.SIN_RED]: 'No se ha podido contactar con el Catastro.',
  [MOTIVO_CATASTRO.CANCELADA]: 'La consulta al Catastro se ha cancelado.',
})

/**
 * Suelo de {@link RESUMEN_POR_MOTIVO} para un motivo que no está en el catálogo.
 * No debería ocurrir nunca —el guardián de carga garantiza que el catálogo está
 * cubierto—, pero un renglón EN BLANCO tras pulsar un botón es la definición
 * exacta de error silencioso, y ese es el caso que este texto tapa.
 */
const RESUMEN_DESCONOCIDO = 'La consulta al Catastro no ha traído el dato.'

/** Lo que se dice cuando una consulta ha sido superada por otra más nueva. */
const MENSAJE_SUPERADA =
  'Esta consulta al Catastro quedó superada por otra más nueva, así que su respuesta se ha ' +
  'descartado sin usarla.'

/** No hay geometría en el store: no hay desde dónde deducir. */
const MENSAJE_SIN_GEOMETRIA =
  'No hay ninguna geometría cargada, así que no hay ningún punto desde el que preguntarle al ' +
  'Catastro qué parcela hay ahí. Carga una parcela o dibuja el contorno primero.'

/**
 * `puntoInterior` no ha encontrado ningún punto dentro de la parcela. El texto es
 * PROPIO a propósito (ver la trampa de la cabecera): el de sus detecciones habla
 * del `cp:referencePoint` y de lo que el Catastro rechaza, y aquí no se está
 * serializando nada.
 */
const MENSAJE_SIN_PUNTO_INTERIOR =
  'No se ha podido encontrar ningún punto dentro de la parcela desde el que consultar al ' +
  'Catastro: la geometría es degenerada (área nula, anillo colapsado o huecos que la anulan). ' +
  'No se ha llegado a consultar nada.'

/**
 * Guardián de carga: {@link RESUMEN_POR_MOTIVO} tiene que ser TOTAL sobre el
 * catálogo del cliente. Si `services/catastro.js` añade un motivo y aquí no se le
 * escribe un resumen, este módulo **no carga** en vez de dejar un renglón mudo la
 * primera vez que ese motivo aparezca en producción. Ruidoso a propósito, y por la
 * misma razón que el guardián gemelo de `services/catastro.js`: un módulo que no
 * carga se arregla en cinco minutos; un renglón en blanco no lo ve nadie.
 */
for (const motivo of Object.values(MOTIVO_CATASTRO)) {
  /* c8 ignore next 6 -- solo se alcanza si el catálogo del cliente crece y este no */
  if (RESUMEN_POR_MOTIVO[motivo] === undefined) {
    throw new Error(
      `app/cableado-catastro: falta el resumen de renglón de MOTIVO_CATASTRO.${motivo}. ` +
        `Un motivo nuevo del cliente tiene que llegar a la pantalla con un texto decidido por ` +
        `alguien, no con un renglón en blanco.`,
    )
  }
}

/**
 * «hace 6 días». Se delega en `Intl.RelativeTimeFormat` en vez de escribir las
 * pluralizaciones a mano: son cuatro unidades × singular/plural × casos especiales
 * («ayer», «anteayer») que el navegador ya sabe hacer bien en español.
 */
const RELATIVO = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' })

/** «12:34». La hora a la que se trajo el dato; ver {@link textoProcedencia}. */
const HORA = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' })

/**
 * Escalones de {@link describirEdad}, de menor a mayor. Se elige el MAYOR que quepa
 * entero: 6 días se dicen en días, 90 minutos en horas.
 *
 * @type {ReadonlyArray<[string, number]>}
 */
const ESCALONES_EDAD = Object.freeze([
  ['second', 1000],
  ['minute', 60_000],
  ['hour', 3_600_000],
  ['day', 86_400_000],
])

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO (lo dice su
 * propia cabecera), así que un selector que no encuentra nada es un bug del
 * programador, no un dato malo: regla de oro 1, se lanza y **se nombra el
 * selector**. La alternativa —seguir con un `null` y morir cien líneas más allá con
 * «cannot set properties of null»— es justo el fallo ilegible que no se admite.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error} Si la cáscara no tiene ese nodo.
 */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/cableado-catastro.js: la cáscara no tiene ningún nodo '${selector}'. El marcado de ` +
        `index.html es contrato de este cableado (y de estilos/app.css): si se ha renombrado o ` +
        `movido ese nodo, hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── Lecturas del modelo ──────────────────────────────────────────────────────

/**
 * El string, si es un string con contenido; `null` si no. Se comprueba el
 * CONTENIDO y no sólo la presencia: una referencia de espacios en blanco no es una
 * referencia, y colarla haría que la app afirmara tener una que no tiene.
 *
 * @param {*} valor
 * @returns {string|null}
 */
function textoNoVacio(valor) {
  return typeof valor === 'string' && valor.trim().length > 0 ? valor : null
}

/**
 * Referencia catastral REAL de un POJO de parcela del store, o `null`. Mismo
 * criterio que `app/main.js#referenciaCatastralDe`, y por lo mismo.
 *
 * @param {object|null} parcelaActual
 * @returns {string|null}
 */
function referenciaDe(parcelaActual) {
  return parcelaActual === null || parcelaActual === undefined
    ? null
    : textoNoVacio(parcelaActual.refcat)
}

/**
 * Los recintos del POJO que haya en el store. El store admite `null` (es su valor
 * inicial documentado) y cualquier POJO sin validarlo, así que aquí no se da nada
 * por hecho.
 *
 * @param {object|null} parcelaActual
 * @returns {Array<{vertices: Array<[number, number]>, tipo: string}>}
 */
function recintosDe(parcelaActual) {
  const recintos = parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.recintos
  return Array.isArray(recintos) ? recintos : []
}

/**
 * ¿Tiene sentido ofrecer «Deducir del mapa»? **Hay geometría en el store Y `refcat`
 * es `null`.** Las dos mitades importan:
 *   · sin geometría no hay punto desde el que preguntar;
 *   · con referencia ya no hay nada que deducir, y ofrecerlo invitaría a
 *     sobrescribir un dato que el usuario ha afirmado con una conjetura.
 *
 * Es alcanzable hoy con `?demo=hueco` (parcela sintética, sin referencia).
 *
 * No se exporta: es una regla INTERNA de esta pantalla, y sacarla invitaría a que
 * otro módulo decidiera con ella cuándo se puede deducir — que es justo lo que este
 * cableado existe para no repartir. Se comprueba desde fuera por su efecto (el
 * `disabled` del botón), que es lo que el usuario ve.
 *
 * @param {object|null} parcelaActual
 * @returns {boolean}
 */
function puedeDeducirDe(parcelaActual) {
  return recintosDe(parcelaActual).length > 0 && referenciaDe(parcelaActual) === null
}

/**
 * ¿Tiene sentido ofrecer «Traer colindantes»? **Hay una parcela con referencia
 * catastral en el MODELO.** Es la condición exacta y ninguna otra:
 *   · sin referencia no hay a quién pedirle vecinas — `GetNeighbourParcel` se
 *     pregunta por una referencia, no por una geometría;
 *   · se mira el MODELO y no el campo, y esa es la mitad que se olvida: el campo
 *     puede tener una referencia a medio teclear o una que el usuario acaba de
 *     pegar y aún no ha traído, y encender el botón entonces prometería las
 *     vecinas de una parcela que no está en el expediente.
 *
 * ⚠️ **No se exige que la referencia sea normalizable.** Una referencia rara en el
 * modelo enciende el botón igual, y el cliente contesta `ENTRADA_INVALIDA` sin
 * tocar la red — mismo criterio que «Traer del Catastro», que está siempre
 * disponible por eso mismo. Apagar el botón por algo que el usuario no puede ver ni
 * corregir sería la peor versión del botón mudo.
 *
 * No se exporta, por el mismo motivo que {@link puedeDeducirDe}: es una regla
 * INTERNA de esta pantalla. Se comprueba desde fuera por su efecto (el `disabled`).
 *
 * @param {object|null} parcelaActual
 * @returns {boolean}
 */
function puedePedirColindantesDe(parcelaActual) {
  return referenciaDe(parcelaActual) !== null
}

// ── Procedencia ──────────────────────────────────────────────────────────────

/**
 * «hace 6 días», «hace 3 horas», «ahora». `null` si la edad no es utilizable —que
 * es distinto de «hace 0 ms»: `services/catastro.js` deja `edadMs` en `null`
 * cuando la caché no guardó el instante, y ahí no se inventa una edad.
 *
 * @param {number|null} edadMs
 * @returns {string|null}
 */
function describirEdad(edadMs) {
  if (!Number.isFinite(edadMs) || edadMs < 0) return null
  let elegido = ESCALONES_EDAD[0]
  for (const escalon of ESCALONES_EDAD) {
    if (edadMs >= escalon[1]) elegido = escalon
  }
  const [unidad, ms] = elegido
  return RELATIVO.format(-Math.floor(edadMs / ms), unidad)
}

/**
 * El renglón de `data-procedencia` a partir de `resultado.procedencia`. Es lo que
 * impide que un dato viejo se presente como recién traído.
 *
 * Para `RED` se escribe **la hora**, no «ahora mismo»: el usuario deja la pestaña
 * abierta y «ahora mismo» envejece mal — a los veinte minutos sigue diciendo que el
 * dato acaba de llegar, que es exactamente la mentira que este renglón existe para
 * evitar. Una hora sigue siendo verdad siempre.
 *
 * @param {import('../services/catastro.js').ProcedenciaCatastro} procedencia
 * @param {Date} instante  El «ahora» del cableado (inyectable: ver `cablearCatastro`).
 * @returns {string}
 */
function textoProcedencia(procedencia, instante) {
  if (procedencia.origen === ORIGEN.CACHE) {
    const edad = describirEdad(procedencia.edadMs)
    return edad === null
      ? 'Del Catastro, de la copia local de esta aplicación. No consta cuándo se guardó, así que ' +
          'puede ser muy antigua. No se ha consultado al servicio.'
      : `Del Catastro, de la copia local de esta aplicación, guardada ${edad}. No se ha ` +
          `consultado al servicio.`
  }
  if (procedencia.origen === ORIGEN.RED) {
    return `Del Catastro, traído del servicio a las ${HORA.format(instante)}.`
  }
  // `LOCAL` significa que no se pidió nada (decisión tomada sin tocar la red), y
  // por ahí no llega ningún DATO: no hay procedencia que contar.
  /* c8 ignore next */
  return ''
}

// ── Duck typing de las dependencias inyectadas ───────────────────────────────

/** ¿Sirve como cliente del Catastro? Sólo lo que este módulo le pide, y nada más. */
function esCliente(c) {
  return (
    !!c &&
    typeof c === 'object' &&
    typeof c.parcelaPorRefcat === 'function' &&
    typeof c.parcelaYColindantes === 'function' &&
    typeof c.refcatPorCoordenada === 'function'
  )
}

/**
 * ¿Sirve como emisor de clics del mapa? DUCK TYPING sobre `on`/`off`, deliberado y
 * no `instanceof L.Map`: **este módulo no importa Leaflet** (y no debe), un mapa de
 * otro *realm* no pasaría el `instanceof`, y un emisor de prueba con esos dos
 * métodos es todo lo que hace falta para ejercitar el camino entero.
 */
function esEmisor(m) {
  return !!m && typeof m.on === 'function' && typeof m.off === 'function'
}

// ── El cableado ──────────────────────────────────────────────────────────────

/**
 * @typedef {import('../services/catastro.js').ResultadoCatastro} ResultadoCatastro
 */

/**
 * Cablea el bloque «Origen de la parcela»: el campo de la referencia, «Traer del
 * Catastro», «Deducir del mapa», «Traer colindantes», la lista de candidatos y el
 * renglón de procedencia. Es el último metro de F05 y lo único de toda la feature
 * que el usuario llega a ver.
 *
 * ── LAS TRES ACCIONES ──
 *   · **`cargar()`** — `cliente.parcelaPorRefcat(lo que hay en el campo)` y, si trae
 *     dato, `estado.set(crearParcela(...))`. Es la ÚNICA de las tres que escribe en
 *     el modelo, y hace **un solo `set`**. Es también la única que dispara
 *     `alCargarParcela`, y siempre DESPUÉS del `set`.
 *   · **`deducir()`** — punto interior de la geometría del store →
 *     `cliente.refcatPorCoordenada` → rellena el CAMPO (nunca el modelo). Con
 *     varios candidatos no rellena nada: los lista con su domicilio y deja elegir.
 *     **No dispara `alCargarParcela`**: no mete geometría en ninguna parte.
 *   · **`colindantes()`** — `cliente.parcelaYColindantes` de la parcela cargada.
 *     Desde F06 tiene su BOTÓN («Traer colindantes»), y sigue sin escribir en el
 *     modelo: `model/parcela.js` no tiene dónde guardar unas vecinas, y meterlas
 *     donde no van sería peor que devolverlas. Se devuelve el
 *     {@link ResultadoCatastro} **y se publica** a los suscriptores de
 *     `alColindantes`, para que F06 (snap) y F07 (diagnóstico, invasión) hagan con
 *     él lo que les toque.
 *
 * Las tres devuelven una promesa del {@link ResultadoCatastro} (o `null` si no se
 * llegó a consultar nada), y las tres comparten el mismo esqueleto de defensas: ver
 * la cabecera del módulo.
 *
 * ```js
 * const catastro = cablearCatastro({
 *   estado, panel, cliente, srs: 'EPSG:25830', mapa,
 *   alCargarParcela: (parcela) => reiniciar(historial, parcela),
 * })
 * const baja = catastro.alColindantes((r) => {
 *   snap.dianas(r.datos.colindantes.flatMap((p) => p.recintos))
 * })
 * // … al cerrar la pantalla:
 * catastro.destruir()   // retira los oyentes Y suelta los suscriptores
 * ```
 *
 * @param {object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El MISMO store
 *   que el mapa, la tabla y la ficha. `viewer/index.js` documenta que recibe el
 *   store ya hecho justamente para que F05 pueda compartirlo; esto es esa promesa
 *   cobrada.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos ya
 *   montado: por él sale, íntegro, lo que le pasa al dato.
 * @param {{parcelaPorRefcat: Function, parcelaYColindantes: Function,
 *          refcatPorCoordenada: Function}} opciones.cliente  El de
 *   `services/catastro.js#crearClienteCatastro`. **Obligatorio y sin defecto**: uno
 *   creado aquí decidiría por el llamante el transporte, la caché y el reloj — y en
 *   un test tocaría la red de verdad.
 * @param {string} opciones.srs  SRS del expediente (`'EPSG:25830'`…). Se valida al
 *   cablear, no en la primera consulta: un huso mal escrito se descubre al montar
 *   la pantalla, no media hora después.
 * @param {{on: Function, off: Function}|null} [opciones.mapa=null]  Emisor de clics
 *   del mapa (el `L.Map`). Por DUCK TYPING; ver {@link esEmisor}.
 * @param {((parcela: object) => void)|null} [opciones.alCargarParcela=null]  Se
 *   llama DESPUÉS de cada `estado.set` de una parcela **traída del Catastro**, con
 *   el POJO que ha entrado en el store. **OPCIONAL**: sin él, el módulo se comporta
 *   igual que en F05. No se llama en `deducir()` (que no mete geometría), ni cuando
 *   la respuesta llega superada por otra más nueva, ni después de `destruir()`. Ver
 *   la sección de los dos ganchos en la cabecera.
 * @param {HTMLElement} [opciones.campo]  Por defecto {@link SELECTOR_CAMPO_REFCAT}.
 * @param {HTMLElement} [opciones.botonCargar]  Ídem {@link SELECTOR_BOTON_CARGAR}.
 * @param {HTMLElement} [opciones.botonDeducir]  Ídem {@link SELECTOR_BOTON_DEDUCIR}.
 * @param {HTMLElement} [opciones.botonColindantes]  Ídem
 *   {@link SELECTOR_BOTON_COLINDANTES}.
 * @param {HTMLElement} [opciones.renglon]  Ídem {@link SELECTOR_ESTADO_CATASTRO}.
 * @param {HTMLElement} [opciones.procedencia]  Ídem {@link SELECTOR_PROCEDENCIA}.
 * @param {HTMLElement} [opciones.candidatos]  Ídem {@link SELECTOR_CANDIDATOS}.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora». Se inyecta porque la
 *   hora sale POR PANTALLA en el renglón de procedencia, y un módulo que lee el
 *   reloj del sistema no es reproducible.
 * @returns {{cargar: () => Promise<ResultadoCatastro|null>,
 *            deducir: () => Promise<ResultadoCatastro|null>,
 *            colindantes: () => Promise<ResultadoCatastro|null>,
 *            alColindantes: (fn: (resultado: ResultadoCatastro) => void) => (() => void),
 *            destruir: () => void}}
 * @throws {Error|TypeError|RangeError}  Si falta un nodo del contrato (vía
 *   {@link nodo}, nombrando el selector), si el `cliente` no lo es, si el `mapa` no
 *   emite, si `alCargarParcela` no es función, o si el `srs` no es un huso
 *   soportado.
 */
export function cablearCatastro({
  estado,
  panel,
  cliente,
  srs,
  mapa = null,
  alCargarParcela = null,
  campo = nodo(SELECTOR_CAMPO_REFCAT),
  botonCargar = nodo(SELECTOR_BOTON_CARGAR),
  botonDeducir = nodo(SELECTOR_BOTON_DEDUCIR),
  botonColindantes = nodo(SELECTOR_BOTON_COLINDANTES),
  renglon = nodo(SELECTOR_ESTADO_CATASTRO),
  procedencia = nodo(SELECTOR_PROCEDENCIA),
  candidatos = nodo(SELECTOR_CANDIDATOS),
  ahora = () => new Date(),
} = {}) {
  if (!esCliente(cliente)) {
    throw new TypeError(
      `cablearCatastro: 'cliente' debe ser el de services/catastro.js#crearClienteCatastro ` +
        `(con parcelaPorRefcat, parcelaYColindantes y refcatPorCoordenada); recibido ` +
        `${typeof cliente}. No se crea uno por defecto a propósito: eso decidiría por ti el ` +
        `transporte, la caché y el reloj, y en un test tocaría la red de verdad.`,
    )
  }
  if (mapa !== null && !esEmisor(mapa)) {
    throw new TypeError(
      `cablearCatastro: 'mapa' debe ser un emisor con 'on' y 'off' (el L.Map del visor), o null ` +
        `si no se quiere deducir con un clic; recibido ${typeof mapa}.`,
    )
  }
  if (alCargarParcela !== null && typeof alCargarParcela !== 'function') {
    throw new TypeError(
      `cablearCatastro: 'alCargarParcela' debe ser una función (se le pasa el POJO de la parcela ` +
        `que acaba de entrar en el store) o null si no hace falta; recibido ` +
        `${typeof alCargarParcela}. Se rechaza al cablear y no en la primera carga: un gancho ` +
        `mal pasado tiene que descubrirse al montar la pantalla, no media hora después.`,
    )
  }
  // Delegado: `husoPorSrs` es el único sitio del proyecto que sabe qué husos están
  // implementados y cuál está diferido (Canarias, override O13). Lanza solo.
  const huso = husoPorSrs(srs)

  const doc = candidatos.ownerDocument

  /**
   * Contador monótono de consultas. Cada una captura su número al empezar; al
   * resolverse, si su número ya no es el último, la consulta está SUPERADA y no
   * escribe nada. Ver la cabecera: esta es la defensa que el `AbortController` no
   * puede dar.
   */
  let secuencia = 0

  /** El `AbortController` de la consulta en curso, o `null` si no hay ninguna. */
  let enVuelo = null

  let destruido = false

  /**
   * Los suscriptores de `alColindantes`. Un `Set` y no un solo callback, calcado de
   * `crearEstadoVista#subscribe`: F06 quiere las vecinas para el snap y F07 las
   * querrá para el diagnóstico, y el segundo en llegar no puede desalojar al
   * primero en silencio — que es exactamente lo que hace un `alColindantes = fn`.
   */
  const suscriptoresColindantes = new Set()

  // ── Escritura en la cáscara ────────────────────────────────────────────────

  /**
   * Escribe el renglón `role="status"`. Vacío + sin modificador es el estado «no ha
   * pasado nada todavía»: el CSS lo colapsa (`:empty`) y el bloque no da un salto.
   *
   * @param {string} texto
   * @param {boolean} fallo  `true` si la acción NO ha traído lo que se le pidió.
   */
  function decir(texto, fallo) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, fallo)
  }

  /** Vacía y esconde la lista de candidatos. Una lista visible y vacía AFIRMARÍA
   * que la deducción no encontró nada, que es otra cosa. */
  function ocultarCandidatos() {
    candidatos.replaceChildren()
    candidatos.hidden = true
  }

  /**
   * Estado de los TRES botones. Es a la vez el suscriptor del store y lo que se
   * llama al acabar cada consulta, así que la regla vive en UN solo sitio:
   *
   *   · mientras hay algo EN VUELO, los tres apagados (cortesía, no garantía; y
   *     además es lo que impide que una doble pulsación dispare dos peticiones);
   *   · «Traer del Catastro», siempre disponible en reposo: el campo vacío o mal
   *     escrito lo resuelve el cliente con `ENTRADA_INVALIDA` y sin tocar la red,
   *     y un botón apagado sin motivo al lado es lo que no se admite;
   *   · «Deducir del mapa», sólo si {@link puedeDeducirDe};
   *   · «Traer colindantes», sólo si {@link puedePedirColindantesDe}, y cuando
   *     queda apagado **se escribe el motivo**: ver {@link MOTIVO_COLINDANTES_APAGADO}.
   *
   * ── POR QUÉ EL MOTIVO SÓLO SE ESCRIBE CON EL RENGLÓN VACÍO ──
   * El renglón es del DESENLACE de la última acción (reparto de superficies de la
   * cabecera), y `refrescar` corre en cada `set` del store —o sea, en cada vértice
   * que F06 mueva— y al final de cada consulta. Escribir ahí sin condición borraría
   * «Cargada la parcela X: 12 vértices» un instante después de haberlo puesto. El
   * renglón VACÍO es el único estado que no es de nadie («no ha pasado nada
   * todavía»), y es justo el que se ve al abrir la app con el botón ya gris: ese
   * hueco es el que se llena. En cuanto una acción habla, el motivo del botón
   * apagado ES lo que esa acción acaba de contar.
   *
   * @param {object|null} parcelaActual
   */
  function refrescar(parcelaActual) {
    const ocupado = enVuelo !== null
    botonCargar.disabled = ocupado
    botonDeducir.disabled = ocupado || !puedeDeducirDe(parcelaActual)
    const sinReferencia = !puedePedirColindantesDe(parcelaActual)
    botonColindantes.disabled = ocupado || sinReferencia
    // `ocupado` fuera: mientras hay algo en vuelo el motivo de estar apagado es la
    // consulta en curso, no la falta de referencia, y contarlo sería mentir.
    if (!ocupado && sinReferencia && renglon.textContent === '') {
      // `false`: no es un fallo. Nadie ha pedido nada todavía; se explica un botón.
      decir(MOTIVO_COLINDANTES_APAGADO, false)
    }
  }

  // ── Los dos ganchos hacia afuera ───────────────────────────────────────────

  /**
   * Cuenta que un oyente de fuera ha reventado. **Panel y consola, nunca el
   * renglón**: la consulta ha ido bien y el renglón cuenta lo que el usuario pidió.
   *
   * Nivel `ERROR` por la misma razón que {@link reventar}: no es un motivo del
   * catálogo del Catastro sino un defecto de programación, y esos no se degradan a
   * aviso para que no molesten.
   *
   * @param {string} quien  El gancho que ha fallado, para la consola.
   * @param {*} causa
   */
  function contarOyenteRoto(quien, causa) {
    panel.avisar(MENSAJE_SUSCRIPTOR_ROTO, { nivel: NIVEL.ERROR, causa })
    console.error(`[catastro] ${quien} ha fallado tras una consulta correcta:`, causa)
  }

  /**
   * Avisa de que ha entrado en el store una parcela TRAÍDA del Catastro. Se llama
   * desde {@link aplicar} y desde ningún otro sitio.
   *
   * @param {object} parcela  El POJO que acaba de entrar en el store.
   */
  function notificarCarga(parcela) {
    if (alCargarParcela === null || destruido) return
    try {
      alCargarParcela(parcela)
    } catch (causa) {
      contarOyenteRoto('el aviso de parcela cargada (alCargarParcela)', causa)
    }
  }

  /**
   * Publica un resultado de vecinas que ha ido BIEN a todos los suscriptores.
   *
   * Se itera sobre una COPIA: un suscriptor que se da de baja a sí mismo dentro de
   * la notificación (o que registra otro) no puede alterar el recorrido en curso.
   * Y cada uno va en su propio `try`: **uno que revienta no puede impedir que se
   * notifique a los demás**, que es la diferencia entre un canal y una cadena.
   *
   * @param {ResultadoCatastro} resultado
   */
  function publicarColindantes(resultado) {
    for (const fn of [...suscriptoresColindantes]) {
      try {
        fn(resultado)
      } catch (causa) {
        contarOyenteRoto('un suscriptor de colindantes (alColindantes)', causa)
      }
    }
  }

  /**
   * Reparto de superficies para un resultado que NO trae dato: el mensaje ÍNTEGRO
   * del cliente al panel (con su nivel, que sale de `NIVEL_POR_MOTIVO` y nunca de
   * una clasificación inventada aquí) y el RESUMEN al renglón.
   *
   * @param {ResultadoCatastro} resultado
   */
  function contarFallo(resultado) {
    panel.avisar(resultado.mensaje, { nivel: NIVEL_POR_MOTIVO[resultado.motivo] ?? NIVEL.AVISO })
    decir(`${RESUMEN_POR_MOTIVO[resultado.motivo] ?? RESUMEN_DESCONOCIDO} ${COLA_DETALLE}`, true)
  }

  /**
   * La red de la regla de oro 1 para un `throw` INESPERADO. Un contrato roto en las
   * capas de abajo no llega como resultado: llega como excepción (un POJO corrupto
   * en el store que hace lanzar a `crearParcela`, un `srs` que `puntoInterior` no
   * admite). Sin esto, la excepción sube desde un manejador de `click` y el usuario
   * ve un botón que NO HACE NADA: pulsa, no pasa nada y nada le dice por qué.
   *
   * El defecto no se tapa —va a la consola para quien depura— y quien llamó recibe
   * el rechazo: los dos destinatarios atendidos.
   *
   * @param {*} causa
   */
  function reventar(causa) {
    decir(MENSAJE_FALLO_INESPERADO, true)
    panel.avisar(MENSAJE_FALLO_INESPERADO, { nivel: NIVEL.ERROR, causa })
    console.error('[catastro] la consulta al Catastro ha fallado de forma inesperada:', causa)
  }

  // ── El esqueleto de las tres consultas ─────────────────────────────────────

  /**
   * Un {@link ResultadoCatastro} de consulta SUPERADA. Conserva la `procedencia`
   * real —la consulta costó sus intentos y sus milisegundos, y borrarlo sería
   * perder información cierta— y cambia el desenlace por lo que de verdad pasó: su
   * respuesta se descartó sin usarla.
   *
   * @param {ResultadoCatastro} resultado  Lo que contestó el cliente, tarde.
   * @returns {ResultadoCatastro}
   */
  function superada(resultado) {
    return {
      ok: false,
      datos: null,
      motivo: MOTIVO_CATASTRO.CANCELADA,
      mensaje: MENSAJE_SUPERADA,
      procedencia: resultado.procedencia,
    }
  }

  /**
   * Envuelve UNA consulta con las dos defensas y con el estado de los botones.
   *
   * El botón se rehabilita en el `finally`, **también si el `await` lanza**: sin
   * eso, un fallo inesperado deja la UI muerta y muda, que es la peor combinación
   * posible. Pero sólo lo rehabilita la consulta VIGENTE: si ya hay otra más nueva
   * corriendo, encender el botón invitaría a pulsar sobre algo que está ocupado, y
   * de eso se encargará ella cuando termine.
   *
   * @param {(senal: AbortSignal) => Promise<ResultadoCatastro>} consultar
   * @returns {Promise<{resultado: ResultadoCatastro, vigente: boolean}>}
   */
  async function operar(consultar) {
    if (enVuelo !== null) enVuelo.abort()
    const controlador = new AbortController()
    enVuelo = controlador
    const token = ++secuencia
    refrescar(estado.get())
    try {
      const resultado = await consultar(controlador.signal)
      return { resultado, vigente: token === secuencia }
    } finally {
      if (enVuelo === controlador) enVuelo = null
      // `destruir()` incrementa `secuencia`, así que tras destruir NINGUNA consulta
      // en vuelo vuelve a encender un botón de una pantalla que ya no está.
      if (token === secuencia) refrescar(estado.get())
    }
  }

  // ── 1 · Traer del Catastro ─────────────────────────────────────────────────

  /**
   * Por qué la parcela traída no se puede cargar en el modelo, o `null` si sí.
   *
   * Los tres casos son DATO MALO del servicio, no bugs, así que salen por el canal
   * de avisos y no como excepción — pero **no se cargan**: media parcela en el
   * store es peor que ninguna, porque se dibuja y parece buena.
   *
   * El del SRS es el que más importa y el menos evidente: se pide la geometría en
   * el sistema del expediente, y si el servicio contestara en otro, los metros
   * entrarían en el modelo como si fueran los nuestros y la parcela aparecería
   * kilómetros más allá **sin un solo error por ninguna parte**.
   *
   * @param {import('../gml/parse.js').ParcelaGml} p
   * @returns {string|null}
   */
  function porQueNoSirve(p) {
    if (p.srs !== null && p.srs !== srs) {
      return (
        `El Catastro ha devuelto la geometría en ${p.srs} y este expediente trabaja en ${srs}. ` +
        `No se carga: mezclar dos sistemas de referencia colocaría la parcela a kilómetros de ` +
        `donde está, y sin dar ningún error.`
      )
    }
    if (p.recintos.length === 0) {
      return (
        'El Catastro ha contestado con una parcela sin geometría: no trae ni un solo contorno ' +
        'que dibujar. No se carga nada, para no dejar el expediente con una parcela vacía.'
      )
    }
    if (textoNoVacio(p.localId) === null && normalizarRefcat(p.refcat) === null) {
      return (
        'El Catastro ha contestado con una parcela sin identificador de ninguna clase (ni ' +
        'referencia catastral, ni localId). No se carga: sin identidad no se puede generar ' +
        'después su GML.'
      )
    }
    return null
  }

  /**
   * Mete en el store la parcela traída. **Un solo `estado.set`.**
   *
   * `geometriaOficial` se rellena con la MISMA geometría que se acaba de traer, y
   * eso no es redundancia: es el término de comparación del diagnóstico (regla de
   * oro 2). A partir de aquí el usuario puede mover vértices en `recintos` y
   * `geometriaOficial` sigue siendo, congelada, lo que dijo el Catastro. El visor
   * **ya la pinta** en su pane `parcelaOficial` sin tocar `viewer/`.
   *
   * @param {ResultadoCatastro} resultado
   * @param {string} pedida  Lo que el usuario tenía escrito en el campo.
   */
  function aplicar(resultado, pedida) {
    const p = resultado.datos
    const estorbo = porQueNoSirve(p)
    if (estorbo !== null) {
      panel.avisar(estorbo, { nivel: NIVEL.AVISO })
      decir(`No se ha cargado la parcela. ${COLA_DETALLE}`, true)
      return
    }

    const refcat = normalizarRefcat(p.refcat) ?? normalizarRefcat(pedida)
    const parcela = crearParcela({
      idLocal: textoNoVacio(p.localId) ?? refcat,
      refcat,
      recintos: p.recintos,
      geometriaOficial: p.recintos,
      // `areaValue` es la superficie que el Catastro DECLARA, y se guarda tal cual:
      // la medida se calcula aparte con `geo/area.js` y las dos no tienen por qué
      // coincidir. La diferencia ES el dato (ver `model/parcela.js`).
      superficieCatastral: p.areaValue,
      origen: ORIGEN_PARCELA.WFS,
    })

    estado.set(parcela)

    // El campo se queda con la referencia CANONICA que el Catastro ha confirmado,
    // no con lo que se tecleó: «9398516 vk3799g» y «9398516VK3799G» son la misma
    // parcela, y dejar en pantalla una forma distinta de la que hay en el modelo
    // invita a dudar de cuál de las dos se ha cargado.
    if (parcela.refcat !== null) campo.value = parcela.refcat
    procedencia.textContent = textoProcedencia(resultado.procedencia, ahora())
    ocultarCandidatos()

    if (resultado.procedencia.origen === ORIGEN.CACHE) {
      // Al panel además del renglón de procedencia: ese renglón es gris de 11 px y
      // «sólo se lee cuando se duda del dato», mientras que trabajar sobre una
      // copia local de hace semanas es algo que conviene que salte a la vista.
      panel.avisar(
        `La parcela ${parcela.refcat} no se ha traído del Catastro: sale de la copia local de ` +
          `esta aplicación (${textoProcedencia(resultado.procedencia, ahora())}). Si el Catastro ` +
          `la ha rectificado desde entonces, esto no lo refleja.`,
        { nivel: NIVEL.AVISO },
      )
    }

    decir(
      `Cargada la parcela ${parcela.refcat} del Catastro: ` +
        `${parcela.recintos.reduce((n, r) => n + r.vertices.length, 0)} vértices.`,
      false,
    )

    // EL ÚLTIMO, y a propósito: quien escuche esto (F06 reinicia el historial de
    // edición) se encuentra la pantalla ya coherente —store, campo, procedencia y
    // renglón—, en vez de a mitad de escribirse. Y si revienta, lo de arriba ya
    // está hecho: una parcela cargada no se deshace porque falle un oyente.
    notificarCarga(parcela)
  }

  /**
   * Trae la parcela de la referencia que haya escrita en el campo y la mete en el
   * store. La referencia se lee **antes del `await`**: si el usuario cambia el
   * campo mientras la consulta viaja, esta consulta sigue siendo la de la
   * referencia que pidió.
   *
   * @returns {Promise<ResultadoCatastro|null>}
   */
  async function cargar() {
    if (destruido) return null
    const pedida = campo.value
    try {
      const { resultado, vigente } = await operar((senal) =>
        cliente.parcelaPorRefcat(pedida, { srs, senal }),
      )
      // Superada: no escribe NADA, ni siquiera un aviso. El usuario ya sabe que
      // pidió otra cosa; contárselo sería ruido sobre su propia decisión.
      if (!vigente) return superada(resultado)
      if (!resultado.ok) {
        contarFallo(resultado)
        return resultado
      }
      aplicar(resultado, pedida)
      return resultado
    } catch (causa) {
      reventar(causa)
      throw causa
    }
  }

  // ── 2 · Deducir la referencia ──────────────────────────────────────────────

  /** Rellena el CAMPO (nunca el modelo) con la referencia de un candidato. */
  function rellenarCampo(refcat) {
    campo.value = refcat
    procedencia.textContent = ROTULO_DEDUCIDA
  }

  /**
   * Pinta la lista de candidatos: un `<li>` con un `<button>` por parcela, con su
   * referencia y **su domicilio**. El domicilio es lo ÚNICO que permite a una
   * persona distinguir entre varios candidatos (lo dice `_catastro-ovc.js`), así
   * que una lista sin él sería una lista de códigos indistinguibles.
   *
   * @param {Array<{refcat: string, domicilio: string|null}>} lista
   */
  function pintarCandidatos(lista) {
    candidatos.replaceChildren()
    for (const candidato of lista) {
      const fila = doc.createElement('li')
      const boton = doc.createElement('button')
      boton.type = 'button'
      boton.dataset.refcat = candidato.refcat
      // Un domicilio ausente se DICE. Dejar la fila con la referencia a secas haría
      // pensar que el domicilio está en blanco, que es otra cosa.
      boton.textContent =
        candidato.domicilio === null
          ? `${candidato.refcat} · (el Catastro no ha dado el domicilio)`
          : `${candidato.refcat} · ${candidato.domicilio}`
      fila.appendChild(boton)
      candidatos.appendChild(fila)
    }
    candidatos.hidden = false
  }

  /**
   * Presenta lo que el OVC ha devuelto para un punto.
   *
   * **Con un solo candidato se rellena el campo; con varios NO se rellena nada.**
   * Es la regla de la spec (§7.3) y no es prudencia: elegir uno de los dos a ciegas
   * sería meterle al usuario en el expediente la parcela del vecino sin que él haya
   * dicho nada, y en un lindero eso es exactamente el error que esta herramienta
   * existe para no cometer.
   *
   * @param {ResultadoCatastro} resultado
   */
  function presentarCandidatos(resultado) {
    const { candidatos: lista, unico } = resultado.datos
    if (unico) {
      ocultarCandidatos()
      rellenarCampo(lista[0].refcat)
      decir(
        `Referencia deducida de la ubicación: ${lista[0].refcat}. Compruébala y pulsa «Traer ` +
          `del Catastro» para cargar esa parcela.`,
        false,
      )
      return
    }
    pintarCandidatos(lista)
    decir(
      `En ese punto hay ${lista.length} parcelas y no se rellena ninguna a ciegas: elige la ` +
        `tuya en la lista, que lleva el domicilio de cada una.`,
      false,
    )
  }

  /**
   * Pregunta al Catastro qué parcela hay en un punto UTM. Es el tramo común de los
   * dos caminos de deducción (el botón y el clic en el mapa).
   *
   * @param {number} x  Este, en metros del SRS del expediente.
   * @param {number} y  Norte, en metros.
   * @returns {Promise<ResultadoCatastro|null>}
   */
  async function deducirEn(x, y) {
    try {
      const { resultado, vigente } = await operar((senal) =>
        cliente.refcatPorCoordenada(x, y, { srs, senal }),
      )
      if (!vigente) return superada(resultado)
      if (!resultado.ok) {
        // La lista vieja se retira: dejarla puesta junto a un «aquí no hay nada»
        // sería enseñar candidatos de una consulta anterior como si fueran de esta.
        ocultarCandidatos()
        contarFallo(resultado)
        return resultado
      }
      presentarCandidatos(resultado)
      return resultado
    } catch (causa) {
      reventar(causa)
      throw causa
    }
  }

  /**
   * Deduce la referencia desde la GEOMETRÍA que hay en el store: punto interior →
   * Catastro → campo. Ver la cabecera para las dos trampas (el centroide que se
   * sale, y las detecciones de `puntoInterior` que aquí mentirían).
   *
   * @returns {Promise<ResultadoCatastro|null>}
   */
  async function deducir() {
    if (destruido) return null
    const recintos = recintosDe(estado.get())
    if (recintos.length === 0) {
      panel.avisar(MENSAJE_SIN_GEOMETRIA, { nivel: NIVEL.AVISO })
      decir(`No hay desde dónde deducir. ${COLA_DETALLE}`, true)
      return null
    }

    let punto
    try {
      // Sólo el PUNTO. Las `detecciones` que vienen al lado hablan del
      // `cp:referencePoint` y de lo que el Catastro rechaza al inscribir: aquí no
      // se está serializando nada, así que republicarlas sería contarle al usuario
      // un problema que no tiene.
      ;({ punto } = puntoInterior(recintos))
    } catch (causa) {
      reventar(causa)
      throw causa
    }
    if (punto === null) {
      panel.avisar(MENSAJE_SIN_PUNTO_INTERIOR, { nivel: NIVEL.AVISO })
      decir(`No se ha podido deducir la referencia. ${COLA_DETALLE}`, true)
      return null
    }
    return deducirEn(punto[0], punto[1])
  }

  // ── 3 · Colindantes ────────────────────────────────────────────────────────

  /**
   * Trae la parcela y sus COLINDANTES. No escribe en el modelo (ver el JSDoc de
   * {@link cablearCatastro}); devuelve el resultado para quien sepa qué hacer con
   * él, y **lo publica** a los suscriptores de `alColindantes`.
   *
   * La referencia sale del MODELO —los colindantes lo son de la parcela cargada, no
   * de lo que haya a medio teclear— y sólo cae al campo si el modelo aún no tiene
   * ninguna, que es el caso de quien pide vecinas antes de cargar nada.
   *
   * ── «CERO COLINDANTES» NO ES UN FALLO, Y AQUÍ SE DICE DISTINTO ──
   * Una parcela aislada existe (rodeada de viales, de dominio público o de suelo
   * sin parcelar), y contarla como un error mandaría al usuario a buscar una avería
   * que no hay. Se distingue **por el número**, que es un dato que esta casa ha
   * calculado —`services/catastro.js` separa la propia por referencia catastral
   * normalizada (override O15: `GetNeighbourParcel` la devuelve dentro, en 2.ª
   * posición)—, **nunca leyendo el texto del servicio**: el override O14 dice que
   * «vacío» y «no existe» llegan con el mismo `exceptionCode` y sólo se
   * distinguirían por texto libre, bilingüe y con errata, sobre el que está
   * PROHIBIDO ramificar. Ese caso ni llega aquí: sale como `NO_ENCONTRADO` y lo
   * cuenta {@link contarFallo}.
   *
   * @returns {Promise<ResultadoCatastro|null>}
   */
  async function colindantes() {
    if (destruido) return null
    const pedida = referenciaDe(estado.get()) ?? campo.value
    try {
      const { resultado, vigente } = await operar((senal) =>
        cliente.parcelaYColindantes(pedida, { srs, senal }),
      )
      if (!vigente) return superada(resultado)
      if (!resultado.ok) {
        // Un resultado sin dato NO se publica: quien se suscribe espera vecinas
        // utilizables (dianas del snap), no un objeto que tenga que reclasificar.
        contarFallo(resultado)
        return resultado
      }
      const cuantos = resultado.datos.colindantes.length
      decir(
        cuantos === 0
          ? `El Catastro ha contestado con la parcela ${pedida} y NINGUNA colindante. No es un ` +
              `fallo: es el dato — hay parcelas aisladas, rodeadas de viales o de suelo sin ` +
              `parcelar.`
          : `El Catastro ha devuelto ${cuantos} colindante${cuantos === 1 ? '' : 's'} de la ` +
              `parcela ${pedida}.`,
        false,
      )
      // También con CERO: una lista vacía es una respuesta, y quien espere dianas
      // de snap necesita saber que no las hay tanto como necesita saber cuáles son.
      publicarColindantes(resultado)
      return resultado
    } catch (causa) {
      reventar(causa)
      throw causa
    }
  }

  // ── Oyentes ────────────────────────────────────────────────────────────────

  /**
   * Los cuatro manejadores de `click` sueltan la promesa a propósito. Lo que puede
   * fallar dentro ya se ha contado por TRES canales (renglón, panel y
   * `console.error`) antes de rechazar, así que dejar además una promesa sin
   * manejar sólo añadiría un mensaje del motor encima de los tres que sí explican
   * qué ha pasado. Quien llama a la API (`cargar()`, F07) sí recibe el rechazo.
   */
  const yaContado = () => {}

  const alPulsarCargar = () => {
    cargar().catch(yaContado)
  }

  const alPulsarDeducir = () => {
    deducir().catch(yaContado)
  }

  /**
   * «Traer colindantes». **Una pulsación, una petición**: `refrescar` deja el botón
   * `disabled` en este mismo tick (dentro de `operar`, antes del primer `await`),
   * así que una doble pulsación no llega a disparar la segunda. Y si alguien
   * quitara el `disabled` desde el inspector, la protección de verdad sigue siendo
   * la de siempre —abortador + token—, no el atributo.
   */
  const alPulsarColindantes = () => {
    colindantes().catch(yaContado)
  }

  /**
   * Elegir un candidato de la lista. Un solo oyente DELEGADO en la `<ul>`, no uno
   * por fila: la lista se repinta entera en cada deducción y así no hay oyentes que
   * retirar ni que se queden colgando de nodos que ya no existen.
   */
  const alElegirCandidato = (evento) => {
    const destino = evento.target
    if (!destino || typeof destino.closest !== 'function') return
    const boton = destino.closest('button[data-refcat]')
    if (boton === null) return
    rellenarCampo(boton.dataset.refcat)
    ocultarCandidatos()
    decir(
      `Referencia elegida: ${boton.dataset.refcat}. Pulsa «Traer del Catastro» para cargar esa ` +
        `parcela.`,
      false,
    )
    campo.focus()
  }

  /**
   * Clic en el mapa → geocodificación inversa del punto pinchado.
   *
   * Se ignora en dos situaciones, y las dos son deliberadas:
   *   · **Si no {@link puedeDeducirDe}.** Un clic en el mapa es también como se
   *     deselecciona, se centra o simplemente se falla un arrastre: consultar al
   *     Catastro en cada uno de ellos sería tráfico que nadie ha pedido, y encima
   *     sobreescribiría un campo que ya tiene la referencia buena. El clic es una
   *     SEGUNDA vía para la misma acción del botón, no una acción nueva.
   *   · **Si hay algo en vuelo.** Es la versión del mapa del `disabled` de los
   *     botones: sin ella, un clic accidental durante una carga la abortaría.
   */
  const alPulsarMapa = (evento) => {
    if (destruido || enVuelo !== null) return
    if (!puedeDeducirDe(estado.get())) return
    const [x, y] = latLngAUTM(evento.latlng, huso)
    deducirEn(x, y).catch(yaContado)
  }

  botonCargar.addEventListener('click', alPulsarCargar)
  botonDeducir.addEventListener('click', alPulsarDeducir)
  botonColindantes.addEventListener('click', alPulsarColindantes)
  candidatos.addEventListener('click', alElegirCandidato)
  if (mapa !== null) mapa.on('click', alPulsarMapa)

  const desuscribir = estado.subscribe(refrescar)
  // `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`): el primer
  // estado de los botones se calcula a mano. Sin esta línea, «Deducir del mapa» se
  // quedaría en el `disabled` con el que nace en `index.html` hasta el primer
  // cambio del store — y quien abre la app con `?demo=hueco` vería gris justo el
  // botón que le hace falta.
  refrescar(estado.get())

  return {
    cargar,
    deducir,
    colindantes,

    /**
     * Se suscribe a los resultados de {@link colindantes} que traen dato. Devuelve
     * la función de BAJA, como `crearEstadoVista#subscribe`: quien se suscribe se
     * puede ir sin tener que destruir el cableado entero.
     *
     * Sólo se notifican las consultas con `ok: true` —los fallos ya se cuentan por
     * el renglón y el panel—, y **cero colindantes SÍ se notifica**: una lista
     * vacía es una respuesta.
     *
     * Después de {@link destruir} no registra nada y devuelve una baja inerte: la
     * misma doctrina que las tres acciones, que devuelven `null` en vez de lanzar.
     * Un `fn` que no es función sí lanza, porque eso lo escribe un programador.
     *
     * @param {(resultado: ResultadoCatastro) => void} fn
     * @returns {() => void}  La baja. Idempotente.
     * @throws {TypeError}  Si `fn` no es una función.
     */
    alColindantes(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(
          `alColindantes: 'fn' debe ser una función (recibe el ResultadoCatastro de una consulta ` +
            `de vecinas que ha ido bien); recibido ${typeof fn}.`,
        )
      }
      if (destruido) return () => {}
      suscriptoresColindantes.add(fn)
      return () => {
        suscriptoresColindantes.delete(fn)
      }
    },

    /**
     * Deja el cableado inerte: retira los cinco oyentes, la suscripción al store y
     * **los suscriptores de `alColindantes`**, y **aborta lo que esté en vuelo**.
     * IDEMPOTENTE.
     *
     * El orden importa: primero se invalida la secuencia y luego se aborta, para
     * que la respuesta que llegue después de esto no encuentre ningún camino por el
     * que escribir en una pantalla que ya no está.
     */
    destruir() {
      if (destruido) return
      destruido = true
      secuencia += 1
      if (enVuelo !== null) {
        enVuelo.abort()
        enVuelo = null
      }
      botonCargar.removeEventListener('click', alPulsarCargar)
      botonDeducir.removeEventListener('click', alPulsarDeducir)
      botonColindantes.removeEventListener('click', alPulsarColindantes)
      candidatos.removeEventListener('click', alElegirCandidato)
      if (mapa !== null) mapa.off('click', alPulsarMapa)
      desuscribir()
      // Se sueltan los suscriptores: si no, una consulta que ya no puede llegar a
      // publicarse mantendría vivas —por el cierre— las cerraduras de F06 (el snap,
      // sus capas de Leaflet) mucho después de que su pantalla se haya ido.
      suscriptoresColindantes.clear()
    },
  }
}

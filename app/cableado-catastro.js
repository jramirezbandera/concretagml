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
// ── LAS DOS PUERTAS: «EMPEZAR DESDE EL CATASTRO» Y «TRAER EL FONDO» ─────────
// `cargar({sustituir})` hace DOS cosas distintas según qué botón se haya pulsado, y
// desde 2026-08-08 la distinción es un argumento y no una deducción:
//
//   · **`sustituir: true`** (por defecto, el botón de siempre) — documento nuevo. La
//     geometría del WFS ocupa `recintos` **y** `geometriaOficial`.
//   · **`sustituir: false`** — sólo el fondo. `recintos`, `origen` y el historial del
//     usuario **no se tocan**; entra `geometriaOficial` y se adopta la `refcat`.
//
// Antes no había puerta 2 y `aplicar` construía la parcela desde cero: traer el
// Catastro sobre una medición propia **la borraba**, y como el gancho de carga
// reinicia el historial, tampoco volvía con Ctrl+Z. El reparto vive en
// {@link componerParcelaConOficial}, y quién decide es el llamante — nunca el store.
//
// ── F06 · LOS GANCHOS HACIA AFUERA, Y POR QUÉ SON VARIOS Y NO UNO ──────────
// Hasta F05 este módulo no llamaba a nadie: escribía en el store, en la cáscara y
// devolvía resultados. F06 necesita avisos que el store NO puede dar, y por eso son
// ganchos y no un suscriptor más de `estado.subscribe`:
//
//   · **`alCargarParcela(parcela)`** — se dispara tras el `estado.set` de una
//     parcela **TRAÍDA del Catastro que sustituye a la anterior**, y sólo ahí. El
//     store notifica TODOS los `set`, y desde fuera «parcela recién traída» y
//     «parcela con un vértice movido» son indistinguibles: quien reinicia el
//     historial de edición (`edit/historial.js`) necesita justo esa diferencia,
//     porque reiniciarlo en cada arrastre borraría el «deshacer» del usuario.
//     `deducir()` **no** lo dispara: rellena el campo, no mete geometría. Y la
//     puerta 2 **tampoco**: ahí no hay documento nuevo que sembrar.
//   · **`alCambiarOficial(parcela)`** — se dispara por las DOS puertas, porque por
//     las dos entra parcelario nuevo. Es de quien tiene que invalidar lo que dependía
//     del fondo anterior: las dianas del snap, el contador de vecinas, el diagnóstico
//     ya calculado y la capa que lo pinta. Sin este reparto, la puerta 2 dejaría
//     colgadas las dianas de otra parcela y el snap engancharía a geometría de otro
//     sitio sin que nada lo explicara.
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
// ⚠️ Los tres son **opcionales**. Sin ellos el módulo se comporta exactamente como
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

import { solape } from '../diagnostico/topologia.js'
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
import { PROCEDENCIA, mensajeOrigenDesconocido } from './contraste.js'

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
 * Lo que se dice al PANEL cuando lo traído se ha pedido con una referencia que
 * dedujo la aplicación, no una que haya afirmado nadie.
 *
 * ── POR QUÉ TAMBIÉN AL PANEL, Y NO SOLO AL RENGLÓN ──
 * Es el mismo argumento que este módulo ya usa unas líneas más abajo para la
 * copia local: el renglón de procedencia «es gris de 11 px y sólo se lee cuando
 * se duda del dato». Una referencia deducida es MÁS consecuente que una caché
 * vieja —de ella cuelgan el parcelario de fondo, los linderos y la derivación de
 * sobrante—, así que si aquélla merece saltar a la vista, ésta también.
 *
 * ⛔ **No dice si la deducción es buena ni la califica** (regla de oro 9): dice
 * de dónde salió y cómo cambiarla. Quien sabe cuál es su parcela es quien firma.
 *
 * @param {string} refcat
 * @returns {string}
 */
export const avisoReferenciaDeducida = (refcat) =>
  `La referencia ${refcat} no la has escrito tú: la ha deducido esta aplicación mirando un ` +
  `punto dentro de tu medición. Si tu medición no coincide con el parcelario —que es lo ` +
  `normal, y el motivo de esta herramienta— el punto puede caer en la parcela vecina y la ` +
  `referencia sería de otra finca. Compruébala sobre el mapa; si no es ésa, corrígela en el ` +
  `campo «Referencia catastral» y vuelve a traer el parcelario.`

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

/**
 * Lo que se dice cuando alguien llama a `cargar({refcat})` con una referencia que no
 * es utilizable. **Es un defecto de programación, no un dato malo**, y por eso sale
 * con nivel `ERROR` y además a la consola: el usuario no ha escrito nada que pueda
 * corregir.
 *
 * La alternativa —caer al campo— sería peor que no consultar: por el contrato K.1
 * ese campo puede ser el de otra pantalla, y traería la parcela de una referencia que
 * el usuario no ha pedido desde donde está.
 *
 * Se exporta para que su test lo afirme sin copiar el literal.
 */
export const MENSAJE_SIN_REFCAT_PEDIDA =
  'No se ha consultado al Catastro: quien ha pedido la parcela no ha dicho cuál. Es un fallo ' +
  'interno de la aplicación; no se ha cambiado nada. Escribe la referencia catastral y pulsa ' +
  '«Traer del Catastro».'

/**
 * El fondo que se acaba de traer **no toca** la medición del usuario: cero metros
 * cuadrados en común.
 *
 * ── POR QUÉ AVISO Y NO BLOQUEO ──
 * Porque puede ser lo que el usuario quiere. Un levantamiento de una finca y el
 * parcelario de la de al lado es un contraste legítimo, y hay expedientes en los que
 * la parcela oficial se ha movido entera. Bloquear aquí sería decidir por él sobre un
 * dato que él ha pedido a propósito. Pero **callarse sería peor**: sin solape, todo
 * lo que viene después —el diagnóstico de encaje, el sobrante, el informe— compara
 * dos polígonos sin relación y da cifras enormes, ciertas y sin ningún sentido.
 *
 * Las dos causas realistas se nombran porque son las que el usuario puede corregir:
 * la referencia catastral equivocada y el huso equivocado.
 */
export const MENSAJE_FONDO_SIN_SOLAPE =
  'El parcelario que has traído NO se solapa con tu medición: no comparten ni un metro cuadrado. ' +
  'Se ha cargado igual, por si es lo que buscabas, pero conviene mirarlo: casi siempre significa ' +
  'que la referencia catastral es de otra parcela, o que la medición está en un huso distinto. ' +
  'Mientras tanto, el diagnóstico de encaje comparará tu geometría contra ESE fondo.'

/**
 * No se ha podido comprobar el solape. **Es distinto de «no se solapan»** y por eso
 * tiene mensaje propio: `diagnostico/topologia.js` separa los dos casos a propósito
 * (`saltados` dice POR QUÉ no se midió), y fundirlos convertiría un «no lo sé» en una
 * afirmación sobre la geometría del usuario. Regla de oro 1.
 */
export const MENSAJE_SOLAPE_NO_MEDIDO =
  'El parcelario ha entrado bien, pero no se ha podido comprobar si cae encima de tu medición. ' +
  'Eso no quiere decir que no encaje: quiere decir que no se ha podido medir. Míralo en el mapa ' +
  'antes de diagnosticar el encaje.'

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

/** Cuántos vértices suman unos recintos. Para los renglones, que los cuentan. */
const vertices = (recintos) =>
  (Array.isArray(recintos) ? recintos : []).reduce((n, r) => n + r.vertices.length, 0)

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
 * ¿Tiene sentido deducir la referencia con un CLIC EN EL MAPA? **Sólo que el modelo
 * no tenga ya una referencia.** Sin geometría, y ésa es toda la diferencia con
 * {@link puedeDeducirDe}.
 *
 * ── POR QUÉ SON DOS PREGUNTAS Y NO UNA (2026-08-11) ──
 * Hasta hoy el clic reusaba `puedeDeducirDe`, y con ella heredaba **una condición
 * que no es suya**: la de que haya geometría cargada. Esa condición existe por el
 * BOTÓN, que saca el punto de un `puntoInterior` de la parcela — sin parcela no hay
 * punto y el botón no puede prometer nada. **El clic trae su propio punto**: es
 * exactamente el sitio donde el usuario ha pinchado. Exigirle geometría era pedirle
 * un dato que no necesita, y el precio lo pagaba el caso más frecuente de todos —
 * la aplicación recién abierta, vacía, con el mapa delante y catorce caracteres que
 * teclear a mano.
 *
 * Lo que SÍ se conserva es la otra mitad, y por su motivo original: con una
 * referencia ya en el modelo, un clic en el mapa **no la pisa**. Ahí el mapa es la
 * parcela del expediente y el clic es como se deselecciona, se centra o se falla un
 * arrastre; sustituir en silencio una referencia buena por la de donde cayó el dedo
 * sería el error silencioso de siempre.
 *
 * No se exporta, por lo mismo que {@link puedeDeducirDe}: es una regla INTERNA de
 * esta pantalla. Se comprueba desde fuera por su efecto (que el clic consulte o no).
 *
 * @param {object|null} parcelaActual
 * @returns {boolean}
 */
function puedeDeducirClicando(parcelaActual) {
  return referenciaDe(parcelaActual) === null
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

// ── La composición contra lo que YA HAY ──────────────────────────────────────

/**
 * Lo que sobrevive a CUALQUIERA de las dos composiciones contra el store: los campos
 * que no son de ninguno de los dos ejes.
 *
 * Los dos compositores del proyecto —{@link componerParcelaConOficial} aquí y
 * `componerParcelaMedida` en `app/cableado-medicion.js`— son duales: cada uno pisa lo
 * que el otro conserva (uno trae `recintos`, el otro `geometriaOficial`). Pero estos
 * dos campos no los toca ninguno, y por eso son el único trozo compartido:
 *
 *   · **`idLocal`** — la identidad del documento abierto. Cambiarlo aquí crearía un
 *     expediente distinto por traer un fondo, y el almacén de F10 lo guardaría como
 *     otra cosa.
 *   · **`superficieRegistral`** — la del Registro de la Propiedad. No la emite ni el
 *     Catastro ni el fichero del usuario: **la teclea una persona**, y es el dato más
 *     caro de recuperar de los tres. Es exactamente el que se perdía en silencio
 *     cuando este cableado construía la parcela desde cero.
 *
 * ⚠️ **`refcat`, `superficieCatastral`, `geometriaOficial`, `recintos` y `origen` NO
 * están aquí a propósito.** Cada compositor decide qué hace con ellos, y meterlos en
 * este helper sería justo la unificación que la decisión 4A descarta: los
 * compositores siguen separados porque son duales, no gemelos.
 *
 * @param {object} actual  El POJO del store. Se asume no nulo (lo garantiza el
 *   llamante, que sólo llega aquí con algo que conservar).
 * @returns {{idLocal: string, superficieRegistral: number|null}}
 */
export function camposInvariantes(actual) {
  return {
    idLocal: actual.idLocal,
    superficieRegistral: actual.superficieRegistral ?? null,
  }
}

/**
 * ¿Esta carga va a CONSERVAR la medición que ya hay? Es el predicado de la puerta 2,
 * y vive aparte por un motivo concreto: {@link componerParcelaConOficial} lo necesita
 * para componer y `aplicar` lo necesita para **contar lo que realmente ha pasado** —
 * el renglón, el renglón de procedencia y los ganchos hacia `main.js` tienen que
 * decir lo mismo que hizo el compositor. Dos copias del predicado divergirían, y la
 * divergencia sería un rótulo que miente sobre la geometría que hay en pantalla.
 *
 * Pedir la puerta 2 sin nada que conservar **no es un error**: los dos caminos
 * coinciden de hecho y el resultado es un documento nuevo. Por eso esto se pregunta,
 * en vez de exigirse.
 *
 * @param {object|null} actual
 * @param {boolean} sustituir
 * @returns {boolean}
 */
function conservaLaMedicion(actual, sustituir) {
  return sustituir === false && recintosDe(actual).length > 0
}

/**
 * ⭐ **La parcela que entra en el store cuando el Catastro contesta.** Es la pieza
 * que arregla el defecto de las dos puertas, y su historia importa para no
 * reintroducirlo: hasta 2026-08-08 este cableado construía la parcela DESDE CERO,
 * metiendo la geometría del WFS en `recintos` **y** en `geometriaOficial`. Con una
 * medición propia cargada —un DXF, un TXT, un GML ajeno— eso la borraba, y como el
 * gancho de carga reinicia el historial, tampoco se recuperaba con Ctrl+Z.
 *
 * Las dos puertas son:
 *
 * | `sustituir` | Qué es | Qué hace |
 * |---|---|---|
 * | `true`  | «Empezar desde el Catastro» | Lo de siempre: el WFS ocupa `recintos` **y** `geometriaOficial`. Documento nuevo. |
 * | `false` | «Traer el parcelario de fondo» | El WFS entra **solo** en `geometriaOficial`. `recintos` intactos. |
 *
 * La distinción **no se deduce del store**: sale de qué botón se pulsó. Adivinarla
 * mirando si hay geometría es exactamente el estado oculto que causó el defecto.
 *
 * ── DUAL DE `componerParcelaMedida`, NO GEMELA ──
 * `app/cableado-medicion.js` compone el caso contrario —entra geometría de trabajo y
 * la oficial no se toca— y las dos comparten sólo {@link camposInvariantes}. No se
 * unifican: cada una conserva lo que la otra pisa, así que una función con un
 * interruptor tendría dos mitades sin nada en común salvo la llamada a
 * `crearParcela`.
 *
 * ── LA GUARDA DEL STORE VACÍO ──
 * Con `sustituir: false` pero sin nada que conservar (store en `null`, o una parcela
 * sin recintos) **los dos caminos coinciden de hecho**, y está bien que coincidan:
 * la puerta de contexto sigue siendo segura porque no hay medición que perder. Se
 * escribe como guarda explícita y no como `actual.idLocal` a pelo, que lanzaría.
 *
 * ── QUÉ SE ADOPTA Y QUÉ NO (decisión 12A) ──
 * La parcela de trabajo **adopta la `refcat`** del fondo: a partir de aquí el
 * expediente afirma ser esa parcela catastral, que es lo que hace falta para pedir
 * colindantes, diagnosticar el encaje y emitir el GML. `idLocal` y `origen` **no se
 * tocan**: la geometría sigue siendo la medida por el usuario y su procedencia sigue
 * siendo la que era. Un `origen: WFS` sobre unos vértices de DXF sería una mentira
 * en el campo que existe para no contarla. Si el fondo llega sin referencia
 * utilizable, la anterior se conserva: adoptar `null` sería borrar un dato cierto.
 *
 * @param {object|null} actual  Lo que hay en el store, o `null`.
 * @param {import('../gml/parse.js').ParcelaGml} traida  Lo que ha contestado el WFS.
 * @param {object} args
 * @param {string|null} args.refcat  La referencia ya normalizada, o `null`.
 * @param {boolean} [args.sustituir=true]  `false` = puerta de contexto (solo fondo).
 * @returns {object} Parcela
 */
export function componerParcelaConOficial(actual, traida, { refcat, sustituir = true } = {}) {
  if (!conservaLaMedicion(actual, sustituir)) {
    return crearParcela({
      idLocal: textoNoVacio(traida.localId) ?? refcat,
      refcat,
      recintos: traida.recintos,
      geometriaOficial: traida.recintos,
      // `areaValue` es la superficie que el Catastro DECLARA, y se guarda tal cual:
      // la medida se calcula aparte con `geo/area.js` y las dos no tienen por qué
      // coincidir. La diferencia ES el dato (ver `model/parcela.js`).
      superficieCatastral: traida.areaValue,
      origen: ORIGEN_PARCELA.WFS,
    })
  }

  return crearParcela({
    ...camposInvariantes(actual),
    // ⛔ INTACTOS. Es toda la decisión de la puerta 2 en una línea.
    recintos: actual.recintos,
    origen: actual.origen,
    refcat: refcat ?? actual.refcat ?? null,
    geometriaOficial: traida.recintos,
    superficieCatastral: traida.areaValue,
  })
}

// ── Procedencia ──────────────────────────────────────────────────────────────

/**
 * «hace 6 días», «hace 3 horas», «ahora». `null` si la edad no es utilizable —que
 * es distinto de «hace 0 ms»: `services/catastro.js` deja `edadMs` en `null`
 * cuando la caché no guardó el instante, y ahí no se inventa una edad.
 *
 * ⛔ **EXPORTADA desde F10 · T5.1, y solo por eso**, exactamente como se exportó
 * {@link textoProcedencia} en F08 y con el mismo argumento: el diálogo «Expediente»
 * escribe la antigüedad de cada guardado y del borrador («guardado hace 6 días»), y
 * es LA MISMA frase sobre el mismo hecho. Una segunda redacción de esto no sería
 * otra función: sería otra forma de decir los días, otro criterio para el escalón —
 * ¿90 minutos son «hace 2 horas» o «hace 90 minutos»?— y otro juego de casos
 * especiales («ayer», «anteayer»), y la que se quedase vieja sería siempre la nueva.
 * Este módulo no cambia por ello ni una línea de comportamiento.
 *
 * @param {number|null} edadMs
 * @returns {string|null}
 */
export function describirEdad(edadMs) {
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
 * ⛔ **EXPORTADA desde F08 · T4.1, y solo por eso.** `app/cableado-comprobacion.js`
 * escribe el MISMO renglón `[data-procedencia="parcela"]` cuando la parcela entra
 * desde un fichero, y su procedencia es DOBLE: la geometría es del fichero y el
 * parcelario del Catastro. La mitad que habla del Catastro tiene que decir
 * exactamente lo que dice aquí —incluida la edad de la copia local—, así que se
 * reutiliza esta función en vez de redactar una segunda versión: dos redacciones
 * del mismo hecho divergen, y la que se queda vieja siempre es la nueva. Este
 * módulo no cambia por ello ni una línea de comportamiento.
 *
 * @param {import('../services/catastro.js').ProcedenciaCatastro} procedencia
 * @param {Date} instante  El «ahora» del cableado (inyectable: ver `cablearCatastro`).
 * @returns {string}
 */
export function textoProcedencia(procedencia, instante) {
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

/**
 * ⭐ El renglón `[data-procedencia="parcela"]` cuando el Catastro **sólo ha traído el
 * fondo**. Es la pieza de la puerta 2 que más importa que esté bien redactada, y su
 * regla es una sola: **nunca «Del Catastro» a secas.**
 *
 * En este estado hay DOS geometrías en pantalla con dueños distintos, y confundirlas
 * es el error de producto de toda la feature: la de trabajo la midió (o la editó) el
 * usuario y es la que se va a serializar; la oficial la emite el Catastro y sólo está
 * para contrastar. Un renglón que dijera «Del Catastro» —que es exactamente lo que se
 * escribe cuando la parcela sí viene del servicio— convertiría el levantamiento
 * propio en un dato oficial, y a partir de ahí el usuario firma sobre él.
 *
 * Por eso el orden es el que es: **primero de dónde viene la geometría de trabajo**,
 * que es la que se dibuja y la que se va a generar, y después el parcelario, rotulado
 * como lo que es. Mismo criterio que `textoProcedenciaDoble` en
 * `app/cableado-comprobacion.js`, del que esto es el tercer caso.
 *
 * Ninguna de las dos mitades se redacta aquí:
 *   · la de la geometría sale de `PROCEDENCIA` (`app/contraste.js`), que es el ÚNICO
 *     sitio del proyecto donde se dice de dónde salió un dibujo y tiene una prueba
 *     que exige una entrada por cada `ORIGEN_PARCELA`. Y por eso el rótulo es
 *     correcto también cuando la geometría de trabajo vino del WFS —traer un fondo
 *     sobre una parcela ya cargada— en vez de suponer que siempre es una medición;
 *   · la del Catastro es {@link textoProcedencia} **tal cual**, con su hora y con la
 *     edad de la copia local.
 *
 * Dos redacciones del mismo hecho divergen, y la que se queda vieja siempre es la
 * nueva.
 *
 * @param {object} args
 * @param {string} args.origen  `parcela.origen` de la geometría de TRABAJO.
 * @param {import('../services/catastro.js').ProcedenciaCatastro} args.procedencia
 * @param {Date} args.instante  El «ahora» del cableado (inyectable).
 * @returns {string}
 */
export function textoProcedenciaFondo({ origen, procedencia, instante }) {
  const trabajo = PROCEDENCIA[origen] ?? mensajeOrigenDesconocido(origen)
  return (
    `Geometría de trabajo: ${trabajo} Es la que se edita y la que se genera. ` +
    `Parcelario oficial, sólo de fondo para contrastar: ${textoProcedencia(procedencia, instante)}`
  )
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
 *   · **`cargar({refcat, sustituir})`** — `cliente.parcelaPorRefcat` y, si trae dato,
 *     `estado.set` de lo que componga {@link componerParcelaConOficial}. Es la ÚNICA
 *     de las tres que escribe en el modelo, y hace **un solo `set`**. Sin argumentos
 *     se comporta como siempre: la referencia del campo y documento nuevo. Es también
 *     la única que dispara los ganchos, y siempre DESPUÉS del `set`.
 *   · **`deducir()`** — punto interior de la geometría del store →
 *     `cliente.refcatPorCoordenada` → rellena el CAMPO (nunca el modelo). Con
 *     varios candidatos no rellena nada: los lista con su domicilio y deja elegir.
 *     **No dispara ningún gancho**: no mete geometría en ninguna parte.
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
 *   del mapa (el `L.Map`). Por DUCK TYPING; ver {@link esEmisor}. Un clic deduce la
 *   referencia del punto pinchado **mientras el modelo no tenga ya una**
 *   ({@link puedeDeducirClicando}), y eso incluye la aplicación recién abierta y
 *   vacía: el punto lo trae el clic, así que no hace falta geometría cargada —
 *   ésa es condición del BOTÓN, que saca el punto de la parcela.
 * @param {((parcela: object) => void)|null} [opciones.alCargarParcela=null]  **El
 *   gancho del DOCUMENTO NUEVO.** Se llama DESPUÉS del `estado.set` de una parcela
 *   traída del Catastro **que ha sustituido a la anterior**, con el POJO que ha
 *   entrado en el store. **OPCIONAL**: sin él, el módulo se comporta igual que en
 *   F05. No se llama en `deducir()` (que no mete geometría), ni cuando la respuesta
 *   llega superada por otra más nueva, ni después de `destruir()`, **ni cuando el
 *   Catastro sólo ha aportado el fondo** (`cargar({sustituir: false})`): ahí el
 *   documento del usuario sigue siendo el suyo. Ver {@link notificarCarga}.
 * @param {((parcela: object) => void)|null} [opciones.alCambiarOficial=null]  **El
 *   gancho del PARCELARIO NUEVO.** Se llama DESPUÉS del `estado.set` **por las dos
 *   puertas**, porque por las dos entra `geometriaOficial` nueva: lo que dependa del
 *   fondo (las dianas del snap de la parcela anterior, el contador de vecinas, el
 *   diagnóstico ya calculado, la capa que lo pinta) hay que invalidarlo en los dos
 *   casos. Con la puerta 1 se llama DESPUÉS de `alCargarParcela`.
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
 * @returns {{cargar: (opciones?: {refcat?: string, sustituir?: boolean})
 *              => Promise<ResultadoCatastro|null>,
 *            deducir: () => Promise<ResultadoCatastro|null>,
 *            colindantes: () => Promise<ResultadoCatastro|null>,
 *            alColindantes: (fn: (resultado: ResultadoCatastro) => void) => (() => void),
 *            destruir: () => void}}
 * @throws {Error|TypeError|RangeError}  Si falta un nodo del contrato (vía
 *   {@link nodo}, nombrando el selector), si el `cliente` no lo es, si el `mapa` no
 *   emite, si `alCargarParcela` o `alCambiarOficial` no son función, o si el `srs` no es un huso
 *   soportado.
 */
export function cablearCatastro({
  estado,
  panel,
  cliente,
  srs,
  mapa = null,
  alCargarParcela = null,
  alCambiarOficial = null,
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
  if (alCambiarOficial !== null && typeof alCambiarOficial !== 'function') {
    throw new TypeError(
      `cablearCatastro: 'alCambiarOficial' debe ser una función (se le pasa el POJO de la parcela ` +
        `cuyo parcelario oficial acaba de cambiar) o null si no hace falta; recibido ` +
        `${typeof alCambiarOficial}. Mismo momento y mismo motivo que 'alCargarParcela'.`,
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
   * La referencia que ESTA aplicación dedujo de la ubicación, o `null` si la que
   * hay en el campo la ha puesto una persona (tecleada, elegida de la lista de
   * candidatos, o traída del modelo).
   *
   * ── ⛔ EL DEFECTO QUE ESTO CIERRA, CON SU CASO REAL (2026-08-10) ───────────
   * `rellenarCampo` marcaba la deducción con {@link ROTULO_DEDUCIDA} —«Parcela
   * deducida de la ubicación · puedes corregirla»— y acto seguido `cargar()`
   * **pisaba esa marca** al escribir en el mismo nodo la procedencia de la
   * GEOMETRÍA. O sea: la aplicación se ponía el aviso y ella misma lo borraba
   * medio segundo después, dejando en pantalla un texto que solo hablaba de la
   * copia local del parcelario y que se leía como si la referencia estuviese
   * confirmada.
   *
   * Se descubrió con una parcela mal grafiada en el Catastro: la medición era
   * mayor que el parcelario y asomaba sobre la vecina, el punto interior cayó
   * dentro de la 146 y la aplicación dedujo `29050A01000146` cuando la parcela
   * era la 44. El Catastro responde a «¿qué parcela hay en este punto?» con toda
   * confianza (`unico: true`), así que no había ni ambigüedad que detectar: la
   * pregunta era otra, «¿de qué parcela es esta medición?», y esa **solo la puede
   * contestar quien firma**. De ahí que esto NO intente adivinar mejor —midiendo
   * solape con las vecinas, por ejemplo—: propone y se declara conjetura.
   *
   * Se guarda la referencia y no un booleano para que la marca muera sola cuando
   * deje de ser cierta: si el usuario teclea otra, o carga otra parcela, lo que
   * hay en pantalla ya no es lo que dedujimos y comparar cadenas lo dice sin
   * tener que acordarse de apagar una bandera en cada camino.
   */
  let refcatDeducida = null

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

    // ⭐ **Y NO SE ESCRIBE CON EL STORE VACÍO** (2026-08-07). Desde que la
    // aplicación arranca sin nada precargado, éste es el estado en el que se
    // ABRE, y ahí el motivo dejó de ganarse su sitio por dos razones, las dos
    // medidas el mismo día a 1280×720 —el suelo declarado del proyecto—:
    //
    //   · **DUPLICA AL RAIL.** Con el store vacío, el peldaño «Validación» ya
    //     dice «Trae antes una parcela: por referencia catastral o desde tu
    //     medición». Este párrafo repite eso mismo en tres frases y para un
    //     botón secundario. Es exactamente la palanca 3 de F11·M29: no es un
    //     recorte de honradez, es quitar la segunda copia.
    //   · **COSTABA 59,00 px MEDIDOS Y SE COMÍA UNA RUTA CRÍTICA.** Con él
    //     puesto, «¿Ya tenías un expediente? Abrirlo» —la ruta 4 del plan de
    //     pruebas— quedaba **45 px por debajo del borde**, y `.gml-panel` es
    //     `overflow:hidden` con `scrollHeight === clientHeight`: no recortada
    //     tras un scroll, sino **inalcanzable y en silencio**. Sin él, el pie
    //     entra con 14 px de holgura.
    //
    // ⚠️ **Con parcela y sin referencia SÍ se escribe, y ahí es donde importa**:
    // una parcela que ha entrado por `.dxf`, por pegado o por un GML ajeno no
    // tiene refcat, y entonces el botón apagado SÍ sorprende — el usuario ve una
    // parcela en pantalla y un botón de colindantes que no responde. Ése es el
    // caso para el que se escribió el mensaje.
    //
    // `ocupado` fuera de la condición: mientras hay algo en vuelo el motivo de
    // estar apagado es la consulta en curso, no la falta de referencia, y
    // contarlo sería mentir.
    const hayParcela = parcelaActual !== null && parcelaActual !== undefined
    if (!ocupado && hayParcela && sinReferencia && renglon.textContent === '') {
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
   * ── POR QUÉ SON DOS GANCHOS Y NO UNO CON UNA BANDERA ──
   * Lo que hay que hacer al otro lado **no cae todo del mismo lado** de la puerta.
   * `main.js` reiniciaba el historial, vaciaba las dianas del snap, reseteaba el
   * contador de vecinas, repintaba y decía «parcela nueva» — cinco cosas en un solo
   * gancho indivisible. Por la puerta 2 sólo tres de las cinco son ciertas: **no hay
   * parcela nueva** (así que ni reinicio de historial ni ese mensaje), pero **sí hay
   * fondo nuevo** (así que las dianas de la parcela anterior hay que tirarlas — si
   * no, el snap engancha a geometría de otro sitio sin que nada lo explique).
   *
   * Pasar una bandera a un solo gancho dejaría ese reparto escrito en `main.js`, que
   * es donde ya estaba mal. Con dos ganchos, cada efecto se registra en el que le
   * toca y el reparto es la propia firma.
   *
   * Por la puerta 1 se llaman **los dos**, y en este orden: el documento primero
   * (siembra el historial) y el fondo después (lo reencuadra sobre lo sembrado).
   *
   * @param {object} parcela  El POJO que acaba de entrar en el store.
   * @param {boolean} soloFondo  `true` si la medición del usuario se ha conservado.
   */
  function notificarCarga(parcela, soloFondo) {
    if (destruido) return
    if (!soloFondo) {
      llamarGancho(alCargarParcela, 'el aviso de parcela cargada (alCargarParcela)', parcela)
    }
    llamarGancho(alCambiarOficial, 'el aviso de parcelario nuevo (alCambiarOficial)', parcela)
  }

  /**
   * Un gancho hacia afuera, con su red. Cada uno en su propio `try`: **uno que
   * revienta no puede impedir que se llame al otro**, por el mismo motivo que
   * {@link publicarColindantes} itera con `try` por suscriptor.
   *
   * @param {((parcela: object) => void)|null} gancho
   * @param {string} quien  Cómo se llama, para la consola.
   * @param {object} parcela
   */
  function llamarGancho(gancho, quien, parcela) {
    if (gancho === null) return
    try {
      gancho(parcela)
    } catch (causa) {
      contarOyenteRoto(quien, causa)
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
   * Comprueba que el fondo recién traído CAE ENCIMA de la medición del usuario, y
   * avisa si no. **No bloquea nada**: ver {@link MENSAJE_FONDO_SIN_SOLAPE}.
   *
   * Sólo tiene sentido por la puerta 2. Por la puerta 1 `recintos` y
   * `geometriaOficial` son la misma geometría, así que el solape sería del 100 % por
   * construcción y medirlo sería gastar una booleana para confirmar una tautología.
   *
   * `solape` puede lanzar (contrato del llamante) y eso **no puede tumbar una carga
   * que ya ha ido bien**: el dato del Catastro es correcto y está en el store. Se
   * cuenta como lo que es —«no se ha podido medir»— y se sigue.
   *
   * @param {object} parcela  La que acaba de entrar en el store.
   */
  function avisarSiElFondoNoCuadra(parcela) {
    let comun
    try {
      comun = solape(parcela.recintos, parcela.geometriaOficial)
    } catch (causa) {
      panel.avisar(MENSAJE_SOLAPE_NO_MEDIDO, { nivel: NIVEL.AVISO, causa })
      console.error('[catastro] no se ha podido comprobar el solape del fondo traído:', causa)
      return
    }
    // Un recinto saltado deja el área INCOMPLETA, así que un 0 con saltados no
    // afirma «no se solapan»: afirma «no lo sé». Los dos casos se dicen distinto.
    if (comun.saltados.length > 0) {
      panel.avisar(MENSAJE_SOLAPE_NO_MEDIDO, { nivel: NIVEL.AVISO })
      return
    }
    if (comun.area > 0) return
    panel.avisar(MENSAJE_FONDO_SIN_SOLAPE, { nivel: NIVEL.AVISO })
  }

  /**
   * Mete en el store la parcela traída. **Un solo `estado.set`.**
   *
   * Qué ocupa qué lo decide {@link componerParcelaConOficial} a partir de
   * `sustituir`, que sale de qué botón se pulsó y **nunca de mirar el store**. Con la
   * puerta de entrada (`sustituir: true`) `geometriaOficial` se rellena con la MISMA
   * geometría que se acaba de traer, y eso no es redundancia: es el término de
   * comparación del diagnóstico (regla de oro 2). A partir de ahí el usuario puede
   * mover vértices en `recintos` y `geometriaOficial` sigue siendo, congelada, lo que
   * dijo el Catastro. El visor **ya la pinta** en su pane `parcelaOficial` sin tocar
   * `viewer/`.
   *
   * @param {ResultadoCatastro} resultado
   * @param {string} pedida  Lo que el usuario tenía escrito en el campo.
   * @param {boolean} sustituir  `false` = solo fondo; ver el compositor.
   */
  function aplicar(resultado, pedida, sustituir) {
    const p = resultado.datos
    const estorbo = porQueNoSirve(p)
    if (estorbo !== null) {
      panel.avisar(estorbo, { nivel: NIVEL.AVISO })
      decir(`No se ha cargado la parcela. ${COLA_DETALLE}`, true)
      return
    }

    const refcat = normalizarRefcat(p.refcat) ?? normalizarRefcat(pedida)
    const anterior = estado.get()
    // Lo que REALMENTE va a pasar, no lo que se pidió: pedir la puerta 2 sin nada que
    // conservar acaba en documento nuevo, y desde aquí abajo mandan los hechos — el
    // renglón, la procedencia y los ganchos tienen que contar todos lo mismo.
    const soloFondo = conservaLaMedicion(anterior, sustituir)
    const parcela = componerParcelaConOficial(anterior, p, { refcat, sustituir })

    estado.set(parcela)

    // El campo se queda con la referencia CANONICA que el Catastro ha confirmado,
    // no con lo que se tecleó: «9398516 vk3799g» y «9398516VK3799G» son la misma
    // parcela, y dejar en pantalla una forma distinta de la que hay en el modelo
    // invita a dudar de cuál de las dos se ha cargado.
    if (parcela.refcat !== null) campo.value = parcela.refcat

    // ⭐ ¿Se ha traído esto con una referencia que DEDUJIMOS nosotros, o con una
    // que ha afirmado una persona? Hasta el 2026-08-10 esta línea no lo
    // distinguía y borraba la marca de la conjetura; el porqué largo, con su caso
    // real, está en {@link refcatDeducida}.
    const conConjetura = refcatDeducida !== null && parcela.refcat === refcatDeducida
    const deLaGeometria = soloFondo
      ? textoProcedenciaFondo({
          origen: parcela.origen,
          procedencia: resultado.procedencia,
          instante: ahora(),
        })
      : textoProcedencia(resultado.procedencia, ahora())
    // La conjetura va DELANTE: es lo que decide si todo lo que viene detrás vale
    // para algo, y en un renglón largo lo último se lee la mitad de las veces.
    procedencia.textContent = conConjetura
      ? `${ROTULO_DEDUCIDA}. ${deLaGeometria}`
      : deLaGeometria
    ocultarCandidatos()

    if (soloFondo) avisarSiElFondoNoCuadra(parcela)

    // La conjetura, al panel. Va ANTES del aviso de la caché a propósito: si las
    // dos cosas pasan a la vez, «puede que esta ni sea tu parcela» manda sobre
    // «esta parcela es de una copia de hace ocho horas».
    if (conConjetura) {
      panel.avisar(avisoReferenciaDeducida(parcela.refcat), { nivel: NIVEL.AVISO })
    }

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

    // El renglón cuenta lo que ha entrado, y por la puerta 2 lo que ha entrado NO es
    // una parcela: es un fondo. Contar «Cargada la parcela X: 12 vértices» sobre unos
    // vértices que son los del levantamiento del usuario sería atribuirle al Catastro
    // una geometría que no ha emitido, justo en la línea que dice qué ha pasado.
    decir(
      soloFondo
        ? `Traído el parcelario oficial de ${parcela.refcat} como fondo: ` +
            `${vertices(parcela.geometriaOficial)} vértices. Tu medición sigue en pantalla, ` +
            `intacta (${vertices(parcela.recintos)} vértices).`
        : `Cargada la parcela ${parcela.refcat} del Catastro: ` +
            `${vertices(parcela.recintos)} vértices.`,
      false,
    )

    // EL ÚLTIMO, y a propósito: quien escuche esto (F06 reinicia el historial de
    // edición) se encuentra la pantalla ya coherente —store, campo, procedencia y
    // renglón—, en vez de a mitad de escribirse. Y si revienta, lo de arriba ya
    // está hecho: una parcela cargada no se deshace porque falle un oyente.
    notificarCarga(parcela, soloFondo)
  }

  /**
   * Trae una parcela del Catastro y la mete en el store. La referencia se lee
   * **antes del `await`**: si el usuario cambia el campo mientras la consulta viaja,
   * esta consulta sigue siendo la de la referencia que pidió.
   *
   * ── LA INTENCIÓN SE PASA, NO SE DEDUCE ──
   * `sustituir` dice cuál de las dos puertas se ha abierto (ver
   * {@link componerParcelaConOficial}) y **por defecto es `true`**, que es el
   * comportamiento de siempre: `alPulsarCargar` sigue invocando `cargar()` sin
   * argumentos y no cambia ni una línea. Quien quiera el fondo sin perder la
   * medición lo pide explícitamente.
   *
   * ── Y LA REFERENCIA TAMBIÉN, CUANDO QUIEN LLAMA NO ES ESTA PANTALLA ──
   * Sin `refcat` se lee `campo.value`, como siempre. Con `refcat` **no se mira el
   * campo**, y eso es lo que permite que otro cableado (el aviso accionable del
   * Diagnóstico) pida una parcela concreta: por el contrato K.1 hay varias pantallas
   * montadas a la vez y `campo` es el `<input>` de la PRIMERA en orden de documento
   * —aunque esté `hidden`—, así que caer al campo desde otra pantalla traería la
   * parcela de una referencia que el usuario no ha pedido desde ahí.
   *
   * Por eso una `refcat` pasada pero inservible **no cae al campo: no consulta**, y
   * escribe el motivo. Es un defecto de programación, no un dato malo del usuario.
   *
   * @param {object} [opciones]
   * @param {string} [opciones.refcat]  La referencia a traer. Omitida = la del campo.
   * @param {boolean} [opciones.sustituir=true]  `false` = traer solo el parcelario
   *   de fondo, conservando `recintos`, `origen` y el historial.
   * @returns {Promise<ResultadoCatastro|null>}
   */
  async function cargar({ refcat, sustituir = true } = {}) {
    if (destruido) return null
    const delCampo = refcat === undefined
    const pedida = delCampo ? campo.value : refcat
    if (!delCampo && textoNoVacio(pedida) === null) {
      panel.avisar(MENSAJE_SIN_REFCAT_PEDIDA, { nivel: NIVEL.ERROR })
      decir(`No se ha consultado al Catastro. ${COLA_DETALLE}`, true)
      console.error('[catastro] cargar({refcat}) con una referencia inservible:', refcat)
      return null
    }
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
      aplicar(resultado, pedida, sustituir)
      return resultado
    } catch (causa) {
      reventar(causa)
      throw causa
    }
  }

  // ── 2 · Deducir la referencia ──────────────────────────────────────────────

  /** Rellena el CAMPO (nunca el modelo) con la referencia de un candidato. */
  /**
   * @param {string} refcat
   * @param {{sinConfirmar: boolean}} quien  `true` cuando la puso la aplicación
   *   ella sola (el servicio devolvió UN candidato y nadie lo miró); `false`
   *   cuando una persona la ha elegido de la lista.
   *   **Sin valor por defecto a propósito**: los dos casos escriben el mismo
   *   campo y se distinguen solo aquí, así que un defecto silencioso marcaría
   *   como conjetura una elección humana, o al revés, sin que nada avisara.
   */
  function rellenarCampo(refcat, { sinConfirmar }) {
    campo.value = refcat
    // El rótulo es el mismo para los dos: las dos salieron de la UBICACIÓN, y en
    // las dos «puedes corregirla» sigue siendo verdad.
    procedencia.textContent = ROTULO_DEDUCIDA
    // Lo que NO es igual es si alguien la ha mirado. Elegir de la lista es una
    // decisión humana —la lista sale de una ambigüedad real y quien decide, por
    // el domicilio, es una persona—, así que ésa no arrastra el aviso del panel
    // ni sobrevive a la carga como conjetura. La que nadie miró, sí.
    refcatDeducida = sinConfirmar ? refcat : null
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
      rellenarCampo(lista[0].refcat, { sinConfirmar: true })
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
    rellenarCampo(boton.dataset.refcat, { sinConfirmar: false })
    ocultarCandidatos()
    decir(
      `Referencia elegida: ${boton.dataset.refcat}. Pulsa «Traer del Catastro» para cargar esa ` +
        `parcela.`,
      false,
    )
    campo.focus()
  }

  /**
   * Clic en el mapa → geocodificación inversa del punto pinchado. Es la vía de
   * entrada de quien tiene la parcela delante y no tiene los catorce caracteres:
   * se pincha encima y el campo se rellena, marcado como conjetura (nunca el
   * modelo — ver la cabecera).
   *
   * Se ignora en dos situaciones, y las dos son deliberadas:
   *   · **Si no {@link puedeDeducirClicando}.** O sea: si el modelo ya tiene
   *     referencia. Entonces el mapa es la parcela del expediente y el clic es
   *     también como se deselecciona, se centra o se falla un arrastre; pisar en
   *     silencio una referencia buena con la de donde cayó el dedo sería un error
   *     silencioso. **No se exige geometría**: el punto lo trae el propio clic.
   *   · **Si hay algo en vuelo.** Es la versión del mapa del `disabled` de los
   *     botones: sin ella, un clic accidental durante una carga la abortaría. Y de
   *     paso es lo que hace que el doble clic de zoom —que en Leaflet emite DOS
   *     `click` antes del `dblclick`— cueste una sola consulta y no dos.
   */
  const alPulsarMapa = (evento) => {
    if (destruido || enVuelo !== null) return
    if (!puedeDeducirClicando(estado.get())) return
    const [x, y] = latLngAUTM(evento.latlng, huso)
    deducirEn(x, y).catch(yaContado)
  }

  /**
   * Teclear en el campo retira la marca de conjetura: a partir de la primera
   * pulsación lo que hay ahí lo afirma una persona, no lo dedujo nadie.
   *
   * Es el único oyente que ha tenido nunca este campo —hasta el 2026-08-10 solo
   * se leía al pulsar un botón—, y no dispara ninguna consulta: cambiar la
   * referencia no puede costar una petición al Catastro por tecla (override O8).
   * Traer con la nueva sigue siendo una pulsación deliberada del usuario.
   */
  const alEscribirRefcat = () => {
    if (refcatDeducida === null) return
    refcatDeducida = null
    // Y la marca se va de la pantalla en el acto: dejar «deducida de la
    // ubicación» sobre algo que acabas de teclear tú sería mentir al revés.
    if (procedencia.textContent === ROTULO_DEDUCIDA) procedencia.textContent = ''
  }

  campo.addEventListener('input', alEscribirRefcat)
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
      campo.removeEventListener('input', alEscribirRefcat)
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

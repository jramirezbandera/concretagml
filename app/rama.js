// app/rama.js — F11 · T2.4 (rework de UI · T1). EL APLICADOR DE LA RAMA ACTIVA.
//
// Once fases después, esta aplicación solo sabía de PARCELAS: el store lleva un
// POJO de parcela con once suscriptores en producción, el panel se titula
// «Origen de la parcela», el visor encuadra sobre `parcela.recintos` y el pie
// genera un GML de parcela. F11 le añade una segunda rama —EDIFICIO— que
// **SUSTITUYE** al panel de parcela en vez de sumarse a él, y este módulo es
// quien lo PINTA.
//
// ── ⛔ ESTA CABECERA DECÍA «EL DUEÑO ÚNICO DE LA RAMA ACTIVA» ───────────────
// Hasta el 2026-08-04 era verdad, y aquí ponía además «este módulo es lo único
// que sabe cuál de las dos está activa». El rework de UI (T1) partió esa
// responsabilidad en dos, porque la rama resultó ser **uno de tres ejes**
// —`{rama, paso, modo}`— y este módulo ya conocía los CTA, la barra, los textos
// y la visibilidad: seguir metiéndole estado lo convertía en el módulo que lo
// sabe todo.
//
//   · **Quien DECIDE es `app/navegacion.js`**: dueño sin DOM de los tres ejes,
//     de los guards y de los motivos en texto. Si un paso sale apagado y quieres
//     saber por qué, la respuesta está allí y no aquí.
//   · **Quien APLICA es este módulo**: se suscribe y pinta. No decide.
//
// Por eso `RAMA` y `RAMAS` se DECLARAN en `app/navegacion.js` y aquí solo se
// reexportan (ver más abajo): el import tiene que ir aplicador → dueño.
//
// ── QUÉ HACE, EN UNA LÍNEA CADA COSA ────────────────────────────────────────
//   1. Fabrica el CONMUTADOR («Parcela» / «Edificio») dentro de `.gml-chips`.
//   2. Pone `data-rama` en el `<body>` —el ÚNICO gancho de CSS de la rama—.
//   3. Intercambia las `<section>` marcadas con `data-rama-panel`, por
//      VISIBILIDAD y jamás por sustitución del DOM (ver la regla dura de abajo).
//   4. APAGA con el motivo escrito al lado los CTA del pie que esta rama todavía
//      no sabe atender, y un botón encendido que no cumple es peor que uno
//      apagado que explica.
//      ⭐ **F13 · hoy es UNO, no dos.** Hasta esta fase se apagaban los dos
//      —«Generar GML» y «Diagnosticar encaje»— porque «todavía no se saben hacer
//      con una construcción». **Generar el GML de una construcción YA se sabe**
//      (`gml/serialize-bu.js`, el fichero del ICUC), así que ese botón lo gobierna
//      ahora `app/cableado-edificio-gml.js` según el DATO. Aquí solo queda
//      «Diagnosticar encaje», que es F14.
//   5. OCULTA la barra de edición flotante: con la rama EDIFICIO la parcela del
//      mapa es CONTEXTO, y un `Ctrl+Z` ahí deshace una edición que el usuario
//      cree estar haciendo sobre el edificio.
//
// ── ⛔ LA REGLA DURA, Y NO ES UN ARGUMENTO: ES UNA MEDICIÓN (F11 · T0.3·5) ───
// **El intercambio es `seccion.hidden = true/false`. JAMÁS `replaceChildren`,
// `innerHTML` ni `remove()`.**
//
// Medido en la fase 0, en navegador real y en jsdom, las dos formas:
//   · Con `hidden`: `document.querySelector('[data-campo="refcat"]')` devuelve
//     **el mismo nodo**, `isConnected` sigue `true`, conserva su valor y **sus
//     oyentes siguen disparando**. Al volver, la caja de vértices mide otra vez
//     exactamente 267,44 px.
//   · Con `replaceChildren`: la referencia que el cableado resolvió **una sola
//     vez en el montaje** (`app/cableado-catastro.js:656-662`) queda
//     **huérfana, escribible y muda** — `isConnected: false`, escribir en ella
//     **no lanza**, sus oyentes **siguen disparando**, y la referencia catastral
//     recién traída del Catastro acaba en un nodo fuera del documento
//     **mientras el usuario ve el campo vacío**.
//
// **Superficie del riesgo, contada: 30 nodos resueltos así en `app/`.** Este
// módulo es, con diferencia, el que más fácil los rompería, y por eso no
// construye ni destruye ni un nodo ajeno: solo escribe `hidden`.
//
// ── ⭐ EL COROLARIO MEDIDO QUE OBLIGA A LOS NOMBRES (T0.3·6) ────────────────
// Con las dos ramas en el DOM y dos nodos `[data-campo="refcat"]`,
// `querySelector` devuelve **siempre el de parcela**, también **con su sección
// `hidden`**, porque manda el orden del documento. De ahí la regla del contrato
// K.1: **ningún `data-campo`, `data-accion`, `data-estado`, `data-ficha` ni
// `data-procedencia` puede repetirse entre ramas** — el cableado de edificio
// leería y escribiría en un campo invisible de la otra. Hay un `it` en
// `test/app/rama.dom.test.js` que lo vigila, y no es decorativo: es el único
// guardián que tiene esa regla.
//
// ── FABRICA SU PROPIO MARCADO, Y `index.html` NO SE TOCA ────────────────────
// Igual que `app/zona-fichero.js` con su `<input type="file">` y
// `app/dialogo-expediente.js` con su `<dialog>`: lo que este módulo pone lo
// quita `destruir()`, para que la cáscara no se quede con un control huérfano el
// día que nadie cablee la rama. El sitio está MEDIDO (T0.3·2): dos
// `.gml-boton--menudo` con `gap: 4px` dentro de `.gml-chips` miden **116,17 px
// de los 169,28 libres** ⇒ **46,11 px de holgura** y **coste 0 px** (cabecera
// 117,13 → 117,13; caja de vértices 267,44 → 267,44). F11 es la sexta fase
// seguida a coste cero.
//
// Va en la CABECERA porque es **lo único del panel que NO se intercambia**: el
// conmutador no puede vivir dentro de una de las dos secciones que él mismo
// oculta. Y los rótulos «Parcela» y «Edificio» **no pueden crecer**: con
// `flex-wrap: wrap` (que es lo que hay, y a propósito) la fila saltaría de línea
// y costaría 20–29 px sin que nada avise. El guardián es de ANCHO y vive en el
// guion de humo 13.
//
// ── FRONTERA CON EL CSS (T1.6), QUE SE ESCRIBIÓ EN PARALELO Y SIN VERSE ─────
// Este módulo **no escribe ni una regla CSS, ni desde JS**. Marca el estado y ya:
//   · `.gml-app[data-rama='PARCELA'|'EDIFICIO']` es el ÚNICO gancho de la rama,
//     molde exacto de `body[data-arrastrando="si"]` de F08.
//   · El aspecto ACTIVO se pinta desde `data-rama`, **no desde `aria-pressed`**
//     (una sola fuente para el estado visible; dos fuentes acaban divergiendo).
//     ⚠️ `aria-pressed` sigue siendo obligatorio: es lo que oye el lector de
//     pantalla, y por eso se escribe en los dos botones en cada cambio.
//   · **No hay ni una regla CSS sobre `[data-rama-panel]`**, a propósito: quien
//     oculta es `.gml-app [hidden]{display:none}` y una segunda regla daría DOS
//     dueños a la misma visibilidad. El atributo sirve para ENCONTRAR las
//     secciones; la visibilidad la gobierna `hidden`.
//
// ── LAS DOS SECCIONES DE LA RAMA PARCELA, Y POR QUÉ SON DOS ────────────────
// «Origen de la parcela» (`.gml-bloque--catastro`) y «Vértices»
// (`.gml-bloque--vertices`). La segunda no es un extra: es que
// `.gml-bloque--partes` **sustituye a `.gml-bloque--vertices` como estirador**
// del panel (`flex: 1 1 auto` + `min-height: 0`), y dos estiradores a la vez
// descosen el reparto de altura. El CSS de T1.6 lo dice con estas palabras: «las
// dos ramas no pueden estirarse a la vez, y no hace falta ninguna regla para
// impedirlo: la sección que no toca está `hidden`». La cuenta medida cierra:
// ocultar «Origen de la parcela» devuelve +118,23 px, el bloque de edificio
// cuesta −177,34 px, y a la lista de partes le quedan 225,22 px.
//
// **«Avisos» y el pie NO se intercambian**: los avisos son de las dos ramas, y
// el pie lleva los CTA (que aquí se apagan) y la ficha (que recorta T4.1).
//
// ── ⛔ LA BARRA DE EDICIÓN SE PREGUNTA POR `barraEdicion`, NUNCA POR `edicion`
// Medido por T1.5: **`visor.edicion !== null` NO implica
// `visor.barraEdicion !== null`** — con `edicion:{barra:false}` la edición se
// monta y la barra no. Preguntar por `edicion` y dar por hecha la barra sería un
// `TypeError` dentro de un clic, que es la peor forma de fallar que tiene esta
// aplicación. El nodo se saca con `visor.barraEdicion.control.getContainer()`
// —API pública de `L.Control`— y se oculta con `.hidden = true`: **nunca
// `remove()` ni `replaceChildren()`**, por lo mismo que las secciones. Desmontarla
// tampoco vale: `crearEdicion` apaga el `doubleClickZoom` y lo restaura al
// destruirse, y volver de rama obligaría a reconstruir la barra y a recablearla
// desde `app/main.js`.
//
// ── POR DENTRO **ES** `crearEstadoVista` ────────────────────────────────────
// Misma superficie que el store del visor (`get`/`set`/`subscribe`) porque es
// literalmente el mismo closure: `estado`, el `Set` de suscriptores y la guarda
// anti-reentrada son POR INSTANCIA (`viewer/_comun.js:412`). Escribir un segundo
// store para llevar una cadena de dos valores habría sido una copia peor de una
// pieza con 5.000 pruebas detrás.
//
// ⚠️ Con un matiz que hay que conocer: la guarda anti-reentrada de
// `crearEstadoVista` actualiza el estado pero **no relanza la notificación**. Si
// un suscriptor conmuta la rama DENTRO de la notificación, `get()` diría una cosa
// y la pantalla enseñaría otra. Se reconcilia en {@link cablearRama}`.set` sin
// tocar `viewer/_comun.js`: ver {@link TOPE_RECONCILIACION}.

import { NIVEL, crearEstadoVista, resolverAvisar } from '../viewer/_comun.js'
import { RAMA, RAMAS } from './navegacion.js'

// ── El vocabulario ───────────────────────────────────────────────────────────

/**
 * Las dos ramas de la aplicación (`RAMA`) y su orden de pintado y tabulación
 * (`RAMAS`). **Contrato G**: lo consumen `app/main.js`, `app/cableado-edificio.js`
 * y `app/cableado-expediente.js`, y los valores son los mismos literales que
 * viajan al `data-rama` del `<body>` y a los `data-rama-panel` de las secciones —
 * una sola cadena por concepto, así que no puede haber un atributo escrito con un
 * valor que nadie atienda. `RAMAS` **es el orden del DOM**, no un adorno: el CSS
 * de T1.6 declina a propósito usar `order` (cambia el orden visual y no el del
 * foco, y un tabulador que salta hacia atrás es justo lo que prohíbe WCAG 2.4.3),
 * así que quien decide el orden es esa lista.
 *
 * ⚠️ **Desde el rework de UI (T1) las dos se DECLARAN en `app/navegacion.js`** y
 * aquí solo se reexportan, sin redefinir ni una cadena. El motivo es el sentido
 * de la dependencia: `app/navegacion.js` es el dueño sin DOM de `{rama, paso,
 * modo}` y este módulo va camino de ser su APLICADOR —se suscribirá y pintará,
 * pero ya no decidirá—, así que el import tiene que ir aplicador → dueño. Dejarlo
 * al revés obligaría a invertirlo el día de la rebanada 2 con siete llamantes
 * colgando. Los siete siguen importando `RAMA` de aquí y no se enteran.
 *
 * @readonly
 */
export { RAMA, RAMAS }

/** Lo que se lee en cada botón del conmutador. **No pueden crecer**: ver la
 *  cabecera (46,11 px de holgura medidos, y el guardián es de ancho). */
export const ROTULO = Object.freeze({ PARCELA: 'Parcela', EDIFICIO: 'Edificio' })

// ── El contrato de marcado (K.1) ─────────────────────────────────────────────
//
// Los literales los EXPORTA este módulo, que es quien fabrica el marcado, igual
// que `app/zona-fichero.js` exporta `CLASE_SUPERPOSICION` y `DATO_ARRASTRANDO`.
// `estilos/app.css` se escribió contra estas cadenas sin copiarlas: las CITA en
// su comentario. Si un nombre de aquí cambiara, la regla de allí quedaría muerta
// y no lo diría nadie — el guion de humo 13 es quien lo caza.

/** Clase del envoltorio del conmutador. La viste `estilos/app.css`
 *  (`inline-flex`, `gap: 4px`, `flex: none`, `align-items: stretch`). */
export const CLASE_CONMUTADOR = 'gml-conmutador-rama'

/**
 * Clases de la aplicación que este módulo REUTILIZA en vez de inventar
 * equivalentes. Se declaran —y el guardián de clases las cuenta— por el mismo
 * motivo que en `app/dialogo-expediente.js`: sin la lista, un test que exigiera
 * «solo {@link CLASE_CONMUTADOR}» saldría rojo y la reacción natural sería
 * duplicar el cromo, que es justo lo que no se quiere.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLASE_REUTILIZADA = Object.freeze(['gml-boton', 'gml-boton--menudo'])

/**
 * Nombre del `data-*` de la rama activa en el `<body>` (`dataset.rama`, o sea
 * `data-rama` en el marcado). **Es el único gancho de CSS de la rama**, molde
 * exacto de `body[data-arrastrando="si"]` de F08. A diferencia de aquél, aquí
 * SIEMPRE hay un valor: no existe el estado «sin rama», y por eso no se quita
 * salvo al destruir.
 */
export const DATO_RAMA = 'rama'

/** El mismo, escrito como atributo. Para los selectores y para los tests. */
export const ATRIBUTO_RAMA = 'data-rama'

/** `data-rama-panel` en las `<section>` que se intercambian. Su `dataset` es
 *  `ramaPanel`. **Sobre él no hay ni una regla CSS, a propósito** (ver cabecera). */
export const ATRIBUTO_PANEL = 'data-rama-panel'

/** `data-ir-a-rama="PARCELA"|"EDIFICIO"` en cada botón del conmutador. */
export const ATRIBUTO_IR_A_RAMA = 'data-ir-a-rama'

/**
 * Los selectores del contrato. **Nombrados por el COMPONENTE**, que es la
 * lección M8 de F07 y ya costó dos veces: `querySelector` se queda con el
 * PRIMERO del documento, así que un nombre repetido deja a uno de los dos mudo.
 *
 * @readonly
 */
export const SELECTOR = Object.freeze({
  /** El `<body>`, que **es** `.gml-app`: ahí va `data-rama`. */
  APP: '.gml-app',
  /** La fila de chips de la cabecera, donde se inserta el conmutador. */
  CHIPS: '.gml-chips',
  /** El envoltorio del conmutador, ya fabricado. */
  CONMUTADOR: '[data-conmutador="rama"]',
  /** Cualquiera de los dos botones del conmutador. */
  BOTON: `[${ATRIBUTO_IR_A_RAMA}]`,
  /** Cualquier `<section>` que participe del intercambio. */
  PANEL: `[${ATRIBUTO_PANEL}]`,
  /** El CTA «Generar GML» del pie y su renglón `role="status"`. */
  CTA_GENERAR: '[data-accion="generar-gml"]',
  ESTADO_GENERAR: '[data-estado="generar-gml"]',
  /** El CTA «Diagnosticar encaje» del pie y su renglón `role="status"`. */
  CTA_DIAGNOSTICAR: '[data-accion="diagnosticar"]',
  ESTADO_DIAGNOSTICAR: '[data-estado="diagnosticar"]',
})

/** Selector del botón que lleva a una rama. @param {string} rama */
export const selectorBoton = (rama) => `[${ATRIBUTO_IR_A_RAMA}="${rama}"]`

/** Selector de las secciones de una rama. @param {string} rama */
export const selectorPanel = (rama) => `[${ATRIBUTO_PANEL}="${rama}"]`

/**
 * Las secciones de `index.html` que este módulo marca como de la rama PARCELA
 * cuando el llamante no dice otra cosa. **La segunda no es un extra**: ver la
 * cabecera (el estirador cambia de dueño).
 *
 * ⭐ **F14 · Entra la tercera: `.gml-bloque--contraste`.** Hasta hoy no estaba, y
 * era CORRECTO que no estuviera: la rama EDIFICIO no llegaba a la pantalla de
 * Diagnóstico —`MOTIVO_RAMA[PASO.DIAGNOSTICO]` la bloqueaba—, así que el eje PASO
 * ya la dejaba fuera y marcarla además habría sido un segundo dueño de la misma
 * visibilidad. `index.html` llegó a decirlo con esas palabras.
 *
 * **F14 es la fase que vuelve falso ese razonamiento**: abre los dos peldaños en
 * la rama de edificio, y desde entonces la sección anfitriona del diagnóstico de
 * PARCELA se vería en `#/edificio/diagnostico` — está MEDIDO, y era el defecto que
 * la fase 4a dejó abierto: el cajón de parcela (367 × 413 px) montado sobre una
 * construcción. Ahora la rama la esconde y en su lugar se ve la del edificio, que
 * fabrica `app/panel-edificio.js` y sella `app/cableado-edificio.js`.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const SECCIONES_PARCELA = Object.freeze([
  '.gml-bloque--catastro',
  '.gml-bloque--vertices',
  '.gml-bloque--contraste',
])

// ── Lo que se le dice al usuario ─────────────────────────────────────────────

/** Modificador de `.gml-accion-estado` para el desenlace que no trae el dato.
 *  Se RETIRA mientras el CTA está apagado por la rama: que el GML de edificio no
 *  se escriba todavía no es un error, es un hecho sobre esta versión. */
const CLASE_ESTADO_ERROR = 'gml-accion-estado--error'

/**
 * ⭐ **F13 · RETIRADO: «Generar GML» YA NO SE APAGA EN LA RAMA EDIFICIO.**
 *
 * Aquí vivía `MOTIVO_GENERAR_GML_EN_EDIFICIO`, que decía —y era verdad cuando se
 * escribió— «esta versión escribe el GML de una parcela y todavía no el de una
 * construcción». **F13 es la fase que lo vuelve falso**: `gml/serialize-bu.js`
 * escribe el fichero del ICUC y `app/cableado-edificio-gml.js` lo cablea a este
 * mismo botón.
 *
 * Se retira con la misma honradez con la que se puso, así que hay que decir qué
 * queda fuera: el botón **sigue pudiendo estar apagado** en esta rama, pero por
 * un motivo del DATO —no hay construcción cargada, le faltan las plantas a una
 * parte, dos se solapan— y ese motivo lo escribe el cableado nuevo en el mismo
 * renglón. Lo que desaparece no es el apagado: es el apagado *por ser edificio*.
 *
 * ⭐ **F14 · Y AHORA SE RETIRA EL OTRO.**
 *
 * Aquí vivía además `MOTIVO_DIAGNOSTICAR_EN_EDIFICIO`:
 *
 * > «*«Diagnosticar encaje» está apagado mientras estás en la rama Edificio: el
 * > diagnóstico contrasta una parcela medida contra el parcelario del Catastro y
 * > todavía no sabe hacerlo con un edificio. Vuelve a la rama Parcela y el botón
 * > se enciende.*»
 *
 * Era verdad, y **F14 es la fase que lo vuelve falso**: `diagnostico/edificio.js`
 * contrasta la construcción medida con la registrada, y el peldaño Diagnóstico
 * existe ya en esta rama (`app/navegacion.js#REGLA`).
 *
 * Con esto **`app/rama.js` deja de apagar ningún CTA por ser edificio**, que es lo
 * que este módulo llevaba haciendo desde F11. Lo que queda es lo que siempre debió
 * ser: la rama intercambia paneles y conmuta, y **quién puede pulsar qué lo deciden
 * el dato y el peldaño**, cada uno en su sitio. `ctaPrevio` y la mecánica de
 * reponer se conservan —son el contrato con los dos cableados que comparten el
 * botón— y hoy no tienen a quién aplicar: hay un test que lo afirma, para que nadie
 * vuelva a colgar de aquí un apagado por rama.
 *
 * Hay guardián de que **ninguno de los dos textos reaparece** en pantalla, igual
 * que F13 lo dejó para los suyos.
 */

/**
 * ⭐ **F13 · RETIRADO TAMBIÉN, y por la mitad que se volvió falsa.**
 *
 * Aquí vivía `MOTIVO_CTA_EN_EDIFICIO`, que decía «*«Generar GML» y «Diagnosticar
 * encaje» están apagados en la rama Edificio: esta versión sabe hacer las dos
 * cosas con una parcela y todavía no con una construcción*». Existía por una
 * medida cara del 2026-08-04, y conviene no perderla al retirarlo:
 *
 * > Enseñar los DOS motivos completos a la vez costaba **+134,75 px** en
 * > `.gml-acciones` (de 72,78 a 207,53), el panel se sobresuscribía **47,54 px en
 * > vacío** a 1440×900, `.gml-panel` recortaba por abajo con su `overflow:hidden`
 * > y **«Diagnosticar encaje» y su motivo se quedaban fuera de la pantalla**. Un
 * > botón cuyo motivo no se puede leer es un botón mudo.
 *
 * Se resolvió con UN mensaje que nombraba los dos botones. **F13 deshace el
 * problema en vez de administrarlo**: como «Generar GML» ya no se apaga por ser
 * edificio, queda **un solo** CTA apagado y su motivo cabe entero y por su cuenta.
 * No hay dos párrafos que sumar.
 *
 * ⚠️ **La lección sigue viva para quien apague un segundo CTA aquí**: dos motivos
 * permanentes en este pie no caben, y hay que medirlo antes de darlo por bueno, no
 * después. Está escrito en {@link aplicarCtas}, que es donde se decidiría.
 */

/**
 * Lo que se dice cuando se conmuta a EDIFICIO y no hay panel de edificio montado.
 * Es un fallo de montaje de la aplicación —el llamante no ha cableado
 * `app/panel-edificio.js`—, pero **el usuario ve una pantalla medio vacía**, así
 * que se cuenta por el panel de avisos y no solo por la consola (regla de oro 1).
 * La rama SE CAMBIA igual: dejarla a medias y callarlo sería peor.
 */
export const MENSAJE_SIN_PANEL_EDIFICIO =
  'Se ha cambiado a la rama Edificio, pero en esta pantalla no hay montado ningún panel de ' +
  'edificio: no vas a ver dónde meter sus datos. Vuelve a la rama Parcela para seguir trabajando. ' +
  'Si esto pasa siempre, es un fallo de montaje de la aplicación.'

/**
 * Lo que se le dice al usuario cuando revienta algo que estaba PENDIENTE del
 * cambio de rama (un suscriptor del store, típicamente). Gemelo de
 * `MENSAJE_ALFICHERO_ROTO` de `app/zona-fichero.js` y por el mismo motivo
 * MEDIDO: **una excepción lanzada dentro de un oyente del DOM no sale por
 * `dispatchEvent`** —ni en jsdom ni en el navegador—, así que dejarla propagar
 * es un error silencioso para el usuario. Se atrapa y se cuenta por los dos
 * canales de la casa: el panel (en español) y `console.error` (el detalle).
 */
export const MENSAJE_CONMUTAR_ROTO =
  'Se ha cambiado de rama, pero algo que estaba pendiente del cambio se ha interrumpido por un ' +
  'fallo interno; lo que ves en pantalla puede no estar completo. El detalle técnico está en la ' +
  'consola del navegador.'

/**
 * Lo que se dice cuando la rama y la pantalla no consiguen ponerse de acuerdo.
 * Solo puede pasar si un suscriptor conmuta la rama en cada notificación —o sea,
 * un bucle—: ver {@link TOPE_RECONCILIACION}.
 */
export const MENSAJE_SIN_CONVERGER =
  'La rama activa y lo que se ve en pantalla no han conseguido ponerse de acuerdo: algo la está ' +
  'cambiando en bucle. Se deja como está; el detalle técnico está en la consola del navegador.'

/**
 * Lo que se dice de una `<section>` marcada con un `data-rama-panel` que no es
 * ninguna de las dos ramas. **No se toca ese nodo** —ocultar una sección ajena
 * porque su atributo está mal escrito sería mucho peor que dejarla— y se avisa
 * UNA vez por valor distinto, para que un repintado no llene el panel.
 *
 * @param {string} valor
 * @returns {string}
 */
export const mensajePanelDesconocido = (valor) =>
  `Hay una sección del panel marcada como «${valor}», que no es ninguna de las dos ramas ` +
  `(${RAMAS.join(' o ')}); se ha dejado tal cual estaba. Es un fallo de montaje de la aplicación.`

/**
 * Cuántas veces se reintenta poner de acuerdo `get()` con la pantalla antes de
 * rendirse y decirlo. Ocho es holgadísimo: hace falta UNA vuelta para el caso
 * real (un suscriptor que conmuta durante la notificación, que la guarda
 * anti-reentrada de `crearEstadoVista` deja sin notificar), y el tope existe solo
 * para que un bucle de programación no cuelgue la pestaña.
 */
export const TOPE_RECONCILIACION = 8

/**
 * `id` que se le pone al renglón del primer CTA mientras la rama EDIFICIO está
 * puesta, para que el segundo botón pueda apuntarle con `aria-describedby`.
 * `index.html` no se lo pone porque hasta F11 nadie lo necesitaba; este módulo lo
 * pone y lo retira, como todo lo demás que toca.
 */
export const ID_MOTIVO_CTA = 'gml-motivo-cta-edificio'

// ── Utilidades ───────────────────────────────────────────────────────────────

/**
 * ¿Sirve como elemento del DOM? DUCK TYPING deliberado y no `instanceof
 * HTMLElement` — mismo criterio (y mismo motivo) que `app/avisos.js` y
 * `app/zona-fichero.js`: un elemento de otro realm (iframe) no pasa el
 * `instanceof`, y `HTMLElement` ni siquiera existe como global bajo el proyecto
 * Vitest `node`.
 *
 * @param {*} el
 * @returns {boolean}
 */
function esElementoDOM(el) {
  return (
    !!el &&
    typeof el === 'object' &&
    typeof el.addEventListener === 'function' &&
    typeof el.removeEventListener === 'function' &&
    el.nodeType === 1
  )
}

/**
 * ¿Sirve como documento? Se piden solo las tres capacidades que este módulo usa,
 * no `instanceof Document`: así el test puede inyectar un doble y así funciona
 * dentro de un iframe.
 *
 * @param {*} d
 * @returns {boolean}
 */
function esDocumento(d) {
  return (
    !!d &&
    typeof d === 'object' &&
    typeof d.createElement === 'function' &&
    typeof d.querySelector === 'function' &&
    typeof d.querySelectorAll === 'function'
  )
}

/**
 * Resuelve un nodo del contrato con `index.html` o LANZA nombrando el selector.
 * Mismo criterio —y casi el mismo texto— que el `nodo()` de
 * `app/cableado-catastro.js`: un contrato roto por el PROGRAMADOR se descubre al
 * montar la pantalla, no media hora después.
 *
 * @param {Document} documento
 * @param {string} selector
 * @returns {Element}
 * @throws {Error}
 */
function nodo(documento, selector) {
  const encontrado = documento.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `cablearRama: no se encuentra «${selector}» en el documento. Es parte del contrato de ` +
        `marcado con index.html; sin él la rama no se puede conmutar.`,
    )
  }
  return encontrado
}

/**
 * Normaliza y valida una rama. Es un parámetro de PROGRAMADOR —el usuario solo
 * puede pulsar uno de los dos botones que fabrica este módulo—, así que una
 * cadena que no sea una rama se caza aquí y se nombra, en vez de dejar el
 * `<body>` con un `data-rama` que ninguna regla del CSS atiende.
 *
 * @param {*} rama
 * @returns {'PARCELA'|'EDIFICIO'}
 * @throws {RangeError}
 */
function normalizarRama(rama) {
  if (rama !== RAMA.PARCELA && rama !== RAMA.EDIFICIO) {
    throw new RangeError(
      `cablearRama: rama desconocida ${JSON.stringify(rama)}. Las únicas son ` +
        `${RAMAS.map((r) => `RAMA.${r}`).join(' y ')}.`,
    )
  }
  return rama
}

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Rama
 * @property {() => ('PARCELA'|'EDIFICIO')} get  La rama activa. Nunca `null`: no
 *   existe el estado «sin rama».
 * @property {(rama: 'PARCELA'|'EDIFICIO') => void} set  Conmuta y notifica.
 *   Aplica el cambio al DOM **antes** que a ningún suscriptor de fuera, para que
 *   nadie reaccione a una rama que la pantalla todavía no enseña.
 * @property {(fn: (rama: string) => void) => (() => void)} subscribe  Registra un
 *   suscriptor; devuelve la baja. Misma superficie que `crearEstadoVista`, y por
 *   dentro **es** `crearEstadoVista`.
 * @property {() => void} destruir  Devuelve la pantalla a la rama PARCELA, retira
 *   el conmutador y todos sus oyentes, restaura los dos CTA del pie y la barra de
 *   edición, y quita las marcas que puso. IDEMPOTENTE.
 */

/**
 * Cablea la rama activa de la aplicación. **Contrato G / K.1.**
 *
 * Contrato roto por el PROGRAMADOR (falta `.gml-chips`, falta `.gml-app`, falta
 * un CTA del pie, una rama que no existe) → `Error`/`TypeError`/`RangeError`,
 * igual que el resto del proyecto. Lo que puede pasarle a un USUARIO —conmutar a
 * una rama cuyo panel no está montado, un suscriptor que revienta— **nunca
 * lanza**: produce un aviso y el recorrido sigue.
 *
 * @param {Object} [opciones]
 * @param {Document} [opciones.documento]  El documento sobre el que se cablea.
 *   Se inyecta —en vez de tomar el global— para que el test pueda medirlo y para
 *   que funcione dentro de un iframe.
 * @param {{avisar: Function}|null} [opciones.panel=null]  El panel de avisos de
 *   `app/avisos.js`. Si no se pasa, se cae al `console.warn` de
 *   `viewer/_comun.js#avisoPorDefecto` — nunca al silencio.
 * @param {{barraEdicion: {control: {getContainer: () => Element}}|null}|null}
 *   [opciones.visor=null]  El visor de `viewer/index.js`, **solo** para poder
 *   ocultar su barra de edición. ⛔ Se pregunta por `visor.barraEdicion` y jamás
 *   por `visor.edicion`: son dos preguntas distintas y la segunda no implica la
 *   primera (medido por T1.5). `null` ⇒ no hay barra que ocultar, que es un
 *   montaje legítimo.
 * @param {'PARCELA'|'EDIFICIO'} [opciones.ramaInicial=RAMA.PARCELA]  Con qué rama
 *   nace la pantalla. `index.html` declara la de parcela, así que cualquier otra
 *   cosa obligaría a repintar en el arranque.
 * @param {HTMLElement} [opciones.app]  El nodo que lleva `data-rama`. Por defecto
 *   {@link SELECTOR.APP}, que es el `<body>`.
 * @param {HTMLElement} [opciones.contenedor]  Dónde se inserta el conmutador. Por
 *   defecto {@link SELECTOR.CHIPS}.
 * @param {HTMLElement[]} [opciones.seccionesParcela]  Las `<section>` de la rama
 *   PARCELA. Por defecto las de {@link SECCIONES_PARCELA}. Las de EDIFICIO **no
 *   se pasan**: las marca quien las fabrica (`app/panel-edificio.js`) y este
 *   módulo las descubre por `data-rama-panel` en cada conmutación, para no
 *   depender de en qué orden se monten los pasos 13 de `app/main.js`.
 * @param {HTMLElement} [opciones.botonGenerar]  Ídem {@link SELECTOR.CTA_GENERAR}.
 * @param {HTMLElement} [opciones.renglonGenerar]  Ídem {@link SELECTOR.ESTADO_GENERAR}.
 * @param {HTMLElement} [opciones.botonDiagnosticar]  Ídem {@link SELECTOR.CTA_DIAGNOSTICAR}.
 * @param {HTMLElement} [opciones.renglonDiagnosticar]  Ídem {@link SELECTOR.ESTADO_DIAGNOSTICAR}.
 * @returns {Rama}
 * @throws {Error|TypeError|RangeError}
 */
export function cablearRama({
  documento,
  panel = null,
  visor = null,
  ramaInicial = RAMA.PARCELA,
  app,
  contenedor,
  seccionesParcela,
  botonGenerar,
  renglonGenerar,
  botonDiagnosticar,
  renglonDiagnosticar,
} = {}) {
  if (!esDocumento(documento)) {
    throw new TypeError(
      `cablearRama: 'documento' debe ser un Document (o un objeto con createElement, ` +
        `querySelector y querySelectorAll); recibido ${typeof documento}. No se toma el global a ` +
        `propósito: así el test puede medirlo y la rama funciona dentro de un iframe.`,
    )
  }
  if (panel !== null && typeof panel?.avisar !== 'function') {
    throw new TypeError(
      `cablearRama: 'panel' debe ser el de app/avisos.js#crearPanelAvisos (con 'avisar') o null ` +
        `si no hay panel; recibido ${typeof panel}.`,
    )
  }
  const inicial = normalizarRama(ramaInicial)

  const avisar = resolverAvisar(
    panel === null ? undefined : (mensaje, opciones) => panel.avisar(mensaje, opciones),
  )

  const nodoApp = app ?? nodo(documento, SELECTOR.APP)
  const nodoChips = contenedor ?? nodo(documento, SELECTOR.CHIPS)
  if (!esElementoDOM(nodoApp) || !esElementoDOM(nodoChips)) {
    throw new TypeError(
      `cablearRama: 'app' y 'contenedor' deben ser elementos del DOM; recibidos ` +
        `${typeof nodoApp} y ${typeof nodoChips}.`,
    )
  }

  // ── Los dos CTA del pie ────────────────────────────────────────────────────
  // Se resuelven UNA vez, y aquí sí es seguro: viven en el pie del panel, que
  // NO participa del intercambio de secciones. La regla dura de la cabecera
  // protege justamente a las referencias como éstas.
  // ⭐ F13 · `apagaEnEdificio` es lo que cambió. «Generar GML» ya NO se apaga por
  // estar en esta rama —lo cablea `app/cableado-edificio-gml.js` y lo enciende o
  // lo apaga según el DATO—, y «Diagnosticar encaje» sigue apagado hasta F14. Los
  // dos siguen resolviéndose aquí porque los dos viven en el mismo pie y el que
  // ya no se apaga hay que **reponerlo** si venía apagado de antes.
  const ctas = [
    {
      boton: botonGenerar ?? nodo(documento, SELECTOR.CTA_GENERAR),
      renglon: renglonGenerar ?? nodo(documento, SELECTOR.ESTADO_GENERAR),
      motivo: null,
      apagaEnEdificio: false,
    },
    {
      boton: botonDiagnosticar ?? nodo(documento, SELECTOR.CTA_DIAGNOSTICAR),
      renglon: renglonDiagnosticar ?? nodo(documento, SELECTOR.ESTADO_DIAGNOSTICAR),
      // ⭐ F14 · `apagaEnEdificio: false`, igual que su hermano desde F13. Los dos
      // CTA se siguen resolviendo aquí porque los dos viven en el mismo pie y hay
      // que poder REPONERLOS si vinieran apagados de antes.
      motivo: null,
      apagaEnEdificio: false,
    },
  ]
  /** Lo que tenía cada CTA antes de que esta rama lo apagase. `null` = no apagado. */
  const ctaPrevio = new Map()

  // ── Las secciones de la rama PARCELA, marcadas ─────────────────────────────
  // Se MARCAN, no se declaran en `index.html`: ese fichero no se toca en F11.
  // Se anota si la marca la hemos puesto nosotros y cómo estaba el `hidden`,
  // para que `destruir()` devuelva el documento exactamente a como estaba.
  /** @type {{seccion: Element, marcada: boolean, hiddenOriginal: boolean}[]} */
  const marcas = []
  const seccionesPar =
    seccionesParcela ?? SECCIONES_PARCELA.map((selector) => nodo(documento, selector))
  for (const seccion of seccionesPar) {
    if (!esElementoDOM(seccion)) {
      throw new TypeError(
        `cablearRama: 'seccionesParcela' debe ser una lista de elementos del DOM (las <section> ` +
          `que se ocultan al pasar a la rama Edificio); hay un ${typeof seccion}.`,
      )
    }
    const yaMarcada = seccion.hasAttribute(ATRIBUTO_PANEL)
    marcas.push({ seccion, marcada: !yaMarcada, hiddenOriginal: seccion.hidden === true })
    if (!yaMarcada) seccion.setAttribute(ATRIBUTO_PANEL, RAMA.PARCELA)
  }

  // ── El conmutador, fabricado aquí ──────────────────────────────────────────
  const conmutador = documento.createElement('div')
  conmutador.className = CLASE_CONMUTADOR
  conmutador.setAttribute('data-conmutador', 'rama')
  // `role="group"` es la forma ARIA de decir que estos dos botones son UNA cosa
  // —un conmutador de dos posiciones—, igual que en `viewer/barra-edicion.js`.
  // La etiqueta no dice «rama» porque «rama» es vocabulario de este código, no
  // del técnico que usa la aplicación.
  conmutador.setAttribute('role', 'group')
  conmutador.setAttribute('aria-label', 'Qué se está preparando')

  /** @type {Record<string, HTMLElement>} */
  const botones = {}
  for (const rama of RAMAS) {
    const boton = documento.createElement('button')
    // `type="button"` explícito: un `<button>` sin tipo dentro de un `<form>` es
    // un botón de envío. Esta cáscara no tiene formularios, pero cuesta nada.
    boton.type = 'button'
    boton.className = ['gml-boton', 'gml-boton--menudo'].join(' ')
    boton.setAttribute(ATRIBUTO_IR_A_RAMA, rama)
    // `aria-pressed` es OBLIGATORIO y NO es la fuente del aspecto (lo pinta
    // `data-rama`): es lo único que oye el lector de pantalla.
    boton.setAttribute('aria-pressed', String(rama === inicial))
    boton.textContent = ROTULO[rama]
    conmutador.appendChild(boton)
    botones[rama] = boton
  }

  // AL PRINCIPIO de la fila, y sin `order`: el conmutador es un CONTROL y los
  // chips son lecturas, así que un control detrás de unos números se lee como si
  // los gobernara. Y en el modo de fallo de `flex-wrap: wrap` —que es el que hay,
  // medido y a propósito— el que salta de línea es el último, o sea un chip: el
  // control se queda a la vista. El orden visual y el del foco coinciden porque
  // es el del DOM, que es lo que pide WCAG 2.4.3.
  nodoChips.insertBefore(conmutador, nodoChips.firstChild)

  // ── Registro de escuchadores: cero fugas por construcción ──────────────────
  // Todo escuchador se da de alta por aquí, con su diana, su identidad y su fase.
  // `destruir()` recorre la lista: es imposible añadir uno y olvidarse de
  // quitarlo. Mismo mecanismo que `app/zona-fichero.js`.
  /** @type {{diana: EventTarget, tipo: string, fn: Function, captura: boolean}[]} */
  const oyentes = []
  function escuchar(diana, tipo, fn, captura = false) {
    diana.addEventListener(tipo, fn, captura)
    oyentes.push({ diana, tipo, fn, captura })
  }

  let destruido = false
  /** Lo último que se ha APLICADO al DOM. Puede ir por detrás de `store.get()`
   *  si un suscriptor conmuta durante la notificación: ver `set`. */
  let ramaAplicada = null
  /** Valores de `data-rama-panel` ya denunciados, para no repetir el aviso. */
  const desconocidosDenunciados = new Set()

  // ── El store: por dentro ES `crearEstadoVista` ─────────────────────────────
  const store = crearEstadoVista(inicial)

  // ── La barra de edición flotante ───────────────────────────────────────────

  /**
   * El contenedor de la barra, o `null` si no hay barra. ⛔ Se pregunta por
   * `barraEdicion` y **jamás** por `edicion`. `getContainer()` es API pública de
   * `L.Control`; se llama dentro de un `try` porque un control aún no añadido al
   * mapa puede no tener contenedor, y quedarse sin ocultar la barra no puede
   * tumbar la conmutación.
   *
   * @returns {Element|null}
   */
  function nodoBarra() {
    const barra = visor?.barraEdicion
    if (!barra || typeof barra.control?.getContainer !== 'function') return null
    try {
      const contenedorBarra = barra.control.getContainer()
      return esElementoDOM(contenedorBarra) ? contenedorBarra : null
    } catch {
      return null
    }
  }

  /** Lo que valía `hidden` en la barra antes de que esta rama la ocultase. */
  let barraPrevio = null

  /** @param {string} rama */
  function aplicarBarra(rama) {
    const nodoDeLaBarra = nodoBarra()
    if (nodoDeLaBarra === null) return
    if (rama === RAMA.EDIFICIO) {
      if (barraPrevio === null) barraPrevio = { nodo: nodoDeLaBarra, hidden: nodoDeLaBarra.hidden }
      // `hidden`, NUNCA `remove()` ni `replaceChildren()`: `app/main.js#cablearEdicion`
      // resolvió los siete nodos de la barra UNA sola vez en el montaje.
      nodoDeLaBarra.hidden = true
      return
    }
    if (barraPrevio !== null) {
      barraPrevio.nodo.hidden = barraPrevio.hidden
      barraPrevio = null
    }
  }

  // ── Los dos CTA del pie ────────────────────────────────────────────────────

  /**
   * Apaga (o repone) los CTA del pie que esta rama todavía no sabe atender.
   *
   * ⭐ **F13 · hoy es UNO SOLO** («Diagnosticar encaje»), así que su motivo se
   * escribe entero en su propio renglón y no hace falta el reparto con
   * `aria-describedby` que hubo mientras eran dos.
   *
   * ⛔ **Si algún día vuelven a ser dos, MÍDELO ANTES.** El 2026-08-04 se midió
   * que dos motivos permanentes en este pie cuestan **+134,75 px** en
   * `.gml-acciones` y dejan el segundo botón —y su explicación— fuera de la
   * pantalla, con `.gml-panel` recortando por su `overflow:hidden`. La salida de
   * entonces fue un mensaje único que nombraba los dos; la de hoy es que solo hay
   * uno. La que no vale es añadir el segundo y ver qué pasa.
   *
   * @param {string} rama
   */
  function aplicarCtas(rama) {
    const apagados = ctas.filter((c) => c.apagaEnEdificio)
    ctas.forEach((cta) => {
      if (rama === RAMA.EDIFICIO && cta.apagaEnEdificio) {
        if (!ctaPrevio.has(cta.boton)) {
          ctaPrevio.set(cta.boton, {
            disabled: cta.boton.disabled === true,
            texto: cta.renglon.textContent,
            clase: cta.renglon.className,
            describedby: cta.boton.getAttribute('aria-describedby'),
            idRenglon: cta.renglon.getAttribute('id'),
          })
        }
        cta.boton.disabled = true
        // El motivo va en el renglón `role="status"` que ya existe al lado del
        // botón: el lector de pantalla lo anuncia sin robar el foco.
        const primero = apagados[0] === cta
        cta.renglon.textContent = primero ? cta.motivo : ''
        cta.renglon.classList.remove(CLASE_ESTADO_ERROR)
        if (primero) {
          // `index.html` no le pone `id` a este renglón porque hasta hoy nadie lo
          // necesitaba. Se le pone aquí y se retira al reponer, como todo lo demás
          // que toca este módulo.
          if (!cta.renglon.id) cta.renglon.id = ID_MOTIVO_CTA
        } else {
          cta.boton.setAttribute('aria-describedby', apagados[0].renglon.id)
        }
        return
      }
      const previo = ctaPrevio.get(cta.boton)
      if (previo === undefined) return
      cta.boton.disabled = previo.disabled
      cta.renglon.textContent = previo.texto
      cta.renglon.className = previo.clase
      if (previo.describedby === null) cta.boton.removeAttribute('aria-describedby')
      else cta.boton.setAttribute('aria-describedby', previo.describedby)
      if (previo.idRenglon === null) cta.renglon.removeAttribute('id')
      else cta.renglon.setAttribute('id', previo.idRenglon)
      ctaPrevio.delete(cta.boton)
    })
  }

  /**
   * Guarda de última línea sobre los CTA que esta rama apaga, en fase de CAPTURA.
   * El botón ya está `disabled`, así que en condiciones normales esto no llega a
   * correr nunca; existe porque esos CTA tienen OTROS dueños —`cablearDiagnostico`,
   * suscrito al store de PARCELA— que los encienden cuando ese store cambia y
   * podrían reencenderlos con la rama EDIFICIO puesta. Diagnosticar el encaje de
   * la parcela mientras el usuario mira un edificio es exactamente el fallo
   * silencioso que F11 no podía publicar.
   *
   * ⭐ **F13 · y por eso el oyente ya NO se pone en «Generar GML»**: ese botón
   * tiene ahora dueño en esta rama (`app/cableado-edificio-gml.js`) y bloquearle
   * el clic sería impedir justamente lo que la fase viene a permitir. La guarda se
   * pone solo donde sigue habiendo algo que guardar — ver dónde se suscribe.
   *
   * @param {Event} evento
   */
  function alPulsarCta(evento) {
    if (destruido || store.get() !== RAMA.EDIFICIO) return
    evento.preventDefault()
    evento.stopImmediatePropagation()
    // Y se vuelve a decir por qué: si alguien lo reencendió, también le habrá
    // pisado el renglón.
    aplicarCtas(RAMA.EDIFICIO)
  }

  // ── El intercambio de secciones ────────────────────────────────────────────

  /**
   * Pone `hidden` en todas las `<section>` marcadas, según la rama. **Se
   * descubren en CADA aplicación** y no una sola vez al cablear: el panel de
   * edificio lo fabrica otro módulo y puede montarse después que éste.
   *
   * @param {string} rama
   * @returns {number}  Cuántas secciones se han dejado VISIBLES para esa rama.
   */
  function aplicarSecciones(rama) {
    let visibles = 0
    for (const seccion of documento.querySelectorAll(SELECTOR.PANEL)) {
      const suya = seccion.getAttribute(ATRIBUTO_PANEL)
      if (suya !== RAMA.PARCELA && suya !== RAMA.EDIFICIO) {
        // Ni se oculta ni se enseña: tocar un nodo cuyo atributo está mal escrito
        // sería peor que dejarlo. Se denuncia una vez por valor.
        if (!desconocidosDenunciados.has(suya)) {
          desconocidosDenunciados.add(suya)
          avisar(mensajePanelDesconocido(String(suya)), { nivel: NIVEL.AVISO })
        }
        continue
      }
      // ⛔ AQUÍ, Y SOLO AQUÍ, ESTÁ EL INTERCAMBIO. `hidden` y nada más.
      seccion.hidden = suya !== rama
      if (suya === rama) visibles += 1
    }
    return visibles
  }

  /**
   * Lleva la rama a la pantalla. Es el PRIMER suscriptor del store, así que
   * cuando le llega el turno a cualquier otro la pantalla ya está conmutada.
   * Idempotente: aplicarla dos veces con el mismo valor no cambia nada.
   *
   * @param {string} rama
   */
  function aplicar(rama) {
    if (destruido) return
    // 1 · El único gancho de CSS de la rama.
    nodoApp.setAttribute(ATRIBUTO_RAMA, rama)
    // 2 · Lo que oye el lector de pantalla (y que NO pinta nada: ver cabecera).
    for (const r of RAMAS) botones[r].setAttribute('aria-pressed', String(r === rama))
    // 3 · Las secciones.
    const visibles = aplicarSecciones(rama)
    // 4 · Los dos CTA del pie, con el motivo escrito al lado.
    aplicarCtas(rama)
    // 5 · La barra de edición flotante.
    aplicarBarra(rama)
    ramaAplicada = rama
    // Regla de oro 1: una rama sin panel deja al usuario mirando un hueco. Se
    // conmuta igual —quedarse a medias sería peor— pero no se calla.
    if (rama === RAMA.EDIFICIO && visibles === 0) {
      avisar(MENSAJE_SIN_PANEL_EDIFICIO, { nivel: NIVEL.ERROR })
    }
  }

  // El DOM, ANTES que nadie de fuera: quien se suscriba después reaccionará a una
  // rama que la pantalla ya está enseñando.
  const bajaPropia = store.subscribe(aplicar)
  // `subscribe` no notifica al suscribirse (contrato de `crearEstadoVista`), así
  // que la primera aplicación va a mano. Es también la que deja `data-rama`
  // escrito desde el arranque, para que el CSS pinte el botón activo sin esperar
  // a la primera pulsación.
  aplicar(inicial)

  escuchar(botones[RAMA.PARCELA], 'click', alPulsar)
  escuchar(botones[RAMA.EDIFICIO], 'click', alPulsar)
  // Solo sobre los que esta rama apaga: ver {@link alPulsarCta}. Ponerlo sobre
  // «Generar GML» impediría el clic que F13 viene a permitir.
  for (const cta of ctas) {
    if (cta.apagaEnEdificio) escuchar(cta.boton, 'click', alPulsarCta, true)
  }

  /** @param {Event} evento */
  function alPulsar(evento) {
    evento.preventDefault()
    const destino = evento.currentTarget.getAttribute(ATRIBUTO_IR_A_RAMA)
    // Ya estamos ahí: no se notifica. Un `set` redundante despertaría a los
    // suscriptores de fuera (que recargan cosas) sin que nada haya cambiado.
    if (destino === store.get() && destino === ramaAplicada) return
    try {
      set(destino)
    } catch (causa) {
      // Ver {@link MENSAJE_CONMUTAR_ROTO}: una excepción dentro de un oyente del
      // DOM no sale por `dispatchEvent`, así que dejarla propagar sería mudo.
      avisar(MENSAJE_CONMUTAR_ROTO, { nivel: NIVEL.ERROR, causa })
      console.error('[rama] el cambio de rama ha fallado de forma inesperada:', causa)
    }
  }

  /** Ver {@link Rama.set}. */
  function set(rama) {
    if (destruido) return
    const valida = normalizarRama(rama)
    store.set(valida)
    // ── Reconciliación de la guarda anti-reentrada de `crearEstadoVista` ──────
    // Si un suscriptor conmuta la rama DENTRO de la notificación, aquel store
    // actualiza `estado` y NO relanza la cascada (es su defensa contra el bucle
    // de realimentación, y está bien). Aquí eso dejaría `get()` diciendo una cosa
    // y la pantalla enseñando otra, que es el desacuerdo más caro que puede tener
    // este módulo. Se arregla SIN tocar `viewer/_comun.js`, que tiene 5.000
    // pruebas detrás.
    let vueltas = 0
    while (store.get() !== ramaAplicada && vueltas < TOPE_RECONCILIACION) {
      aplicar(store.get())
      vueltas += 1
    }
    if (store.get() !== ramaAplicada) {
      avisar(MENSAJE_SIN_CONVERGER, { nivel: NIVEL.ERROR })
      console.error(
        `[rama] la rama no converge tras ${TOPE_RECONCILIACION} vueltas: get()=` +
          `${store.get()}, en pantalla=${ramaAplicada}.`,
      )
    }
  }

  /** Ver {@link Rama.destruir}. IDEMPOTENTE. */
  function destruir() {
    if (destruido) return

    // Se devuelve la pantalla a la rama PARCELA ANTES de marcar el destruido:
    // así los CTA recuperan su estado, la barra de edición vuelve a verse y las
    // secciones de edificio quedan ocultas, que es el estado que `index.html`
    // declara. Dejar la aplicación en EDIFICIO sin nadie que sepa conmutarla
    // sería dejarla rota.
    aplicar(RAMA.PARCELA)

    destruido = true
    bajaPropia()
    for (const { diana, tipo, fn, captura } of oyentes) {
      diana.removeEventListener(tipo, fn, captura)
    }
    oyentes.length = 0

    // Las marcas que puso ESTE módulo, y solo ésas: las de `data-rama-panel`
    // que ya venían puestas son de quien fabricó aquella sección.
    for (const { seccion, marcada, hiddenOriginal } of marcas) {
      if (marcada) seccion.removeAttribute(ATRIBUTO_PANEL)
      seccion.hidden = hiddenOriginal
    }
    marcas.length = 0

    nodoApp.removeAttribute(ATRIBUTO_RAMA)
    if (conmutador.parentNode) conmutador.parentNode.removeChild(conmutador)
  }

  return {
    get: () => store.get(),
    set,
    subscribe: (fn) => store.subscribe(fn),
    destruir,
  }
}

export default cablearRama

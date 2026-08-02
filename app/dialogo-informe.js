// app/dialogo-informe.js — F09 · T4.1. El DIÁLOGO «Preparar informe».
//
// La última pantalla antes de que alguien firme un documento. Recoge lo que la
// aplicación ha medido, lo pone donde se pueda corregir, y entrega los valores a
// quien compone el PDF. **No sabe nada de PDF, ni de red, ni de IndexedDB**: eso
// es del cableado de T5.1.
//
// ── POR QUÉ ESTO SÍ ES UN MODAL, HABIENDO DICHO F08 QUE NO ──────────────────
// F08 decidió «nada de modales» y aquel criterio se rompe aquí **a propósito**,
// porque el caso es otro:
//
//   · El cajón de F07 y el de F08 **anotan el mapa**. Viven sobre la cartografía
//     porque hablan de ella: dónde encaja la parcela, qué trae el fichero. Mirar
//     el mapa mientras se leen es parte de leerlos.
//   · Esto **prepara un documento**. El mapa no aporta nada mientras se teclea un
//     número de colegiado, y las cuatro esquinas de Leaflet están ocupadas desde
//     F08 (`topleft` la barra de edición, `topright` el control de capas,
//     `bottomleft` los dos cajones turnándose, `bottomright` la opacidad y la
//     atribución). Los dos cajones actuales suman ya **946 px sobre 900 de
//     lienzo**: un formulario de diez campos ahí dentro empeora una deuda que ya
//     está declarada.
//
// Y el modal se paga con lo que cuesta un modal: foco al abrir, `Escape` que
// cierra, foco devuelto al cerrar, y **cerrar no borra nada** (ver {@link cerrar}).
//
// ── POR QUÉ VIVE EN `app/` Y NO EN `viewer/` ────────────────────────────────
// La frontera de este repo es Leaflet: `viewer/` son controles del mapa, `app/`
// es todo lo demás. Precedente exacto: `app/zona-fichero.js`, que también es una
// vista de DOM, también fabrica su propio control (`<input type="file">`) y
// también vive aquí. **`index.html` no se toca**: el `<dialog>` lo fabrica este
// módulo, igual que hacen aquél y los dos cajones con su marcado.
//
// Corolario: este módulo **NO sale por el barrel raíz** `index.js`. Toca
// `document`, y el barrel lo carga el proyecto Vitest `node`, que no tiene DOM.
// Hay un guardián que lo comprobará en la fase 5 (T5.2).
//
// ── ⛔ LO QUE `<dialog>` NO HACE EN JSDOM — MEDIDO (2026-08-02, jsdom 29.1.1) ─
// `HTMLDialogElement` **existe** y su prototipo tiene **exactamente una** cosa:
// la propiedad reflejada `open`. Medido con `Object.getOwnPropertyNames`:
//
//     ['constructor', 'open']
//
// O sea que NO existen `showModal()`, `show()`, `close()`, `returnValue`, ni los
// eventos `cancel` y `close`, ni la capa superior, ni `::backdrop`, ni el atrape
// de foco, ni `inert` (`'inert' in document.body === false`). Lo único que sí
// funciona es la hoja del navegador: un `<dialog>` sin `open` computa
// `display:none` y con `open` computa `display:block`.
//
// Consecuencias, y son de DISEÑO, no de test:
//
//   1. **Se detecta la capacidad y se cae al atributo `open`.** Llamar a
//      `showModal()` a pelo lanzaría `TypeError` en jsdom y el módulo entero sería
//      inprobable en el proyecto `dom`.
//   2. **`Escape` se implementa aquí**, con un `keydown` propio, porque el evento
//      `cancel` no llega a existir. En un navegador de verdad las dos vías se
//      solapan —la nativa y la nuestra— y por eso {@link cerrar} es IDEMPOTENTE y
//      no se hace `preventDefault` sobre la tecla: cancelar el gesto dejaría la
//      mitad nativa muerta sin ganar nada.
//   3. **El foco lo movemos y lo devolvemos nosotros.** El navegador ya lo hace
//      con `showModal()`, así que en producción se hace dos veces sobre el mismo
//      elemento (inofensivo) y en jsdom se hace una, que es la que se puede medir.
//   4. **El atrape de foco NO se reimplementa.** Es lo único de la lista que se
//      queda sin sustituto, y es deliberado: en el navegador lo da la capa
//      superior gratis, y escribir a mano un ciclo de tabulación es código que
//      solo correría donde no hace falta. Se declara aquí para que nadie lo
//      descubra como un olvido.
//
// ── LA PRESUNCIÓN DE VÍA PÚBLICA NO SE PUEDE PASAR POR ALTO ─────────────────
// `report/literal.js` tiene UNA excepción a la regla de oro 9: en parcela urbana
// con colindantes consultados, un frente que ninguna parcela alcanza se describe
// «presumiblemente con vía pública … dato NO verificado, confirme antes de
// firmar». Es el único sitio de toda la aplicación donde se PROPONE en vez de
// medir, y quien va a firmar tiene que enterarse.
//
// **El problema es que dentro de un `<textarea>` no hay formato.** No se puede
// subrayar el renglón, ni pintarlo, ni ponerle un icono: un `<textarea>` es texto
// plano. Así que la marca tiene que estar FUERA, y este módulo la pone en tres
// capas, cada una tapando el agujero de la anterior:
//
//   1. **Un bloque propio, encima del cuadro de edición**
//      ({@link CLASE.PRESUNCION}), que enumera los tramos afectados —cardinal,
//      número de lados y longitud— para que se puedan localizar en el borrador.
//   2. **Ese bloque se deriva de `tramos[].presuncionNoVerificada`, NO del
//      texto.** Es la capa que de verdad importa. Un resaltado que buscara la
//      frase con un `includes` desaparecería en cuanto el usuario reescribiera el
//      párrafo —que es exactamente lo que este cuadro existe para permitir—, y lo
//      que se habría borrado sería la ADVERTENCIA, no el hecho. La cabecera de
//      `report/literal.js` avisa de esto con todas las letras: «una advertencia
//      que solo existiera en una cadena de texto se pierde en el primer `replace`
//      de quien maquete». Aquí la advertencia vive en el dato.
//   3. **Un acuse con la mano.** «Componer PDF» nace apagado mientras haya una
//      presunción sin repasar, y se enciende al marcar la casilla del bloque. No
//      es un adorno defensivo: es la única forma de que la advertencia no se pueda
//      leer en diagonal. Y como manda la regla de oro 1, **el botón apagado nunca
//      está mudo**: el motivo se escribe en el `role="status"` en el mismo paso
//      ({@link MOTIVO_PRESUNCION_SIN_ACUSE}).
//
// Lo que NO se hace, y es tan decisión como lo anterior: **no se bloquea la
// exportación**. El acuse dice «lo he repasado», no «lo he verificado», y no se
// pide ninguna prueba. La aplicación mide y el colegiado firma; obligar a jurar
// algo sería invertir esa frase.
//
// ── NEUTRALIDAD JURÍDICA DEL PIE DE FIRMA (MEJORES_PRACTICAS_GML.md §5.2) ────
// **Quién puede firmar qué está en disputa** entre topógrafos, arquitectos,
// aparejadores, agrónomos y geógrafos. Reglas duras de este formulario, las mismas
// que ya cumple `report/firma.js` y por el mismo motivo:
//
//   · **Ningún desplegable de profesiones.** Ninguno. Una lista cerrada es una
//     decisión sobre quién puede firmar, y ésa no nos toca.
//   · **`colegio` es un campo de texto libre**, sin sugerencias ni autocompletado.
//   · **Ninguna etiqueta presupone titulación.** Los rótulos son los de
//     `report/firma.js#ROTULO_FIRMA` —descriptivos del CAMPO— y se IMPORTAN de
//     allí en vez de copiarse: dos listas de rótulos divergen, y la que se queda
//     vieja siempre es la copia.
//
// ── REGLA DE ORO 9, SOBRE TODO LO QUE ESTE MÓDULO ESCRIBE ───────────────────
// «La aplicación mide; el colegiado interpreta y firma» (SPEC §2). Ni una palabra
// de mérito en los rótulos, ni en los apuntes, ni en los acuses, ni en las clases
// CSS. Hay un guardián de vocabulario en `test/app/dialogo-informe.dom.test.js`,
// con la misma lista que el de `report/contraste-texto.js`, que despoja del DOM
// todo el texto que ATRAVIESA —el borrador del lindero, los valores del
// encabezado, lo que teclee el usuario— y afirma sobre lo que queda, que es lo
// que escribe este fichero.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ────────────────────────────────────
// Fabrica nodos, los rellena, los abre y los cierra. No compone el PDF, no habla
// con el Catastro, no guarda la firma. Recibe POJOs y devuelve valores; quien
// encadene eso es `app/cableado-informe.js` (T5.1).

import {
  CAMPOS_DEL_SERVICIO,
  CAMPOS_FIRMA,
  lineasEncabezado,
  normalizarFirma,
  ROTULO_FIRMA,
  TITULO_FIRMA,
} from '../report/firma.js'
import { PRESUNCION } from '../report/literal.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── El contrato de marcado con `estilos/app.css` y con el cableado ───────────

/**
 * Clases CSS que pone este módulo. **Congeladas y son contrato**: la sección
 * «El diálogo Preparar informe» de `estilos/app.css` se escribe contra estos
 * literales, igual que `viewer/cajon-comprobacion.js#CLASE` y
 * `viewer/cajon-diagnostico.js#CLASE`.
 *
 * Ninguna lleva juicio: no hay `--ok`, ni `--error`, ni `--exito`. Es la regla de
 * oro 9 aplicada al gancho de CSS, y hay un guardián que lo afirma.
 *
 * @readonly
 */
export const CLASE = Object.freeze({
  DIALOGO: 'gml-dialogo-informe',
  CUERPO: 'gml-dialogo-informe-cuerpo',
  TITULO: 'gml-dialogo-informe-titulo',
  INTRO: 'gml-dialogo-informe-intro',
  GRUPO: 'gml-dialogo-informe-grupo',
  LEYENDA: 'gml-dialogo-informe-leyenda',
  REJILLA: 'gml-dialogo-informe-rejilla',
  CAMPO: 'gml-dialogo-informe-campo',
  ROTULO: 'gml-dialogo-informe-rotulo',
  ENTRADA: 'gml-dialogo-informe-entrada',
  FIJO: 'gml-dialogo-informe-fijo',
  APUNTE: 'gml-dialogo-informe-apunte',
  LITERAL: 'gml-dialogo-informe-literal',
  PRESUNCION: 'gml-dialogo-informe-presuncion',
  PRESUNCION_TITULO: 'gml-dialogo-informe-presuncion-titulo',
  LISTA: 'gml-dialogo-informe-lista',
  CASILLA_FILA: 'gml-dialogo-informe-casilla-fila',
  CASILLA: 'gml-dialogo-informe-casilla',
  PIE: 'gml-dialogo-informe-pie',
  ESTADO: 'gml-dialogo-informe-estado',
})

/**
 * Clases de la aplicación que este módulo REUTILIZA en vez de inventar
 * equivalentes propias. Se declaran —y el guardián de clases las cuenta— porque
 * si no, un test que exigiera «solo las de {@link CLASE}» saldría rojo y la
 * reacción natural sería duplicar el cromo, que es justo lo que no se quiere.
 *
 * Por qué cada una:
 *   · `gml-boton` y sus dos variantes: el `:disabled` de esta aplicación está
 *     escrito una sola vez, y su cabecera lo dice sin rodeos —«los dos botones que
 *     nacen apagados en esta app tienen que apagarse igual, o el usuario acaba
 *     aprendiendo dos idiomas para el mismo estado»—. Este diálogo tiene un
 *     tercero, y se apaga como los otros dos.
 *   · `gml-entrada`: el borde, el radio, el fondo y el foco de un campo de texto
 *     de esta aplicación. Lo único que hay que deshacer es su `letter-spacing`,
 *     que está calibrado para la referencia catastral y no para prosa; se deshace
 *     desde la hoja, en una línea.
 *   · `gml-mono`: la regla tipográfica del sistema («todo valor numérico o
 *     normativo va en mono con cifras tabulares»). La llevan los cuatro datos que
 *     pone la aplicación y no se editan.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLASE_REUTILIZADA = Object.freeze([
  'gml-boton',
  'gml-boton--primario',
  'gml-boton--secundario',
  'gml-entrada',
  'gml-mono',
])

/**
 * Los `data-*` que este módulo produce. **Son el CONTRATO con el cableado de
 * T5.1**, que localiza los nodos por selector y lanza si falta alguno, igual que
 * `app/main.js` con los del pie y con los de los dos cajones.
 *
 * ⚠️ `ESTADO` vale `dialogo-informe`, **nombrado por el COMPONENTE y no por la
 * acción**. Es la lección M8 de F07, que en F08 volvió a costar: `querySelector`
 * se queda con el PRIMERO del documento, así que un `[data-estado="componer"]`
 * chocaría con el renglón de cualquier acción homónima del panel y dejaría a uno
 * de los dos inalcanzable y mudo sin que nada lo dijera.
 *
 * Todos estos nodos EXISTEN SIEMPRE, también con el diálogo cerrado y sin nada
 * pintado — menos los del encabezado, que dependen de qué filas aplican a la
 * finca (ver {@link selectorEncabezado}).
 *
 * @readonly
 */
export const SELECTOR = Object.freeze({
  TITULO: '[data-informe="titulo"]',
  INTRO: '[data-informe="intro"]',
  ENCABEZADO: '[data-informe="encabezado"]',
  LINDERO: '[data-informe="lindero"]',
  LITERAL: '[data-informe="literal"]',
  PRESUNCION: '[data-informe="presuncion"]',
  PRESUNCION_TRAMOS: '[data-informe="presuncion-tramos"]',
  ACUSE: '[data-informe="acuse-presuncion"]',
  FIRMA: '[data-informe="firma"]',
  RECORDAR: '[data-informe="recordar"]',
  COMPONER: '[data-accion="componer-pdf"]',
  CANCELAR: '[data-accion="cancelar-informe"]',
  REGENERAR: '[data-accion="regenerar-lindero"]',
  ESTADO: '[data-estado="dialogo-informe"]',
})

/**
 * El selector de una fila del encabezado. **Fuera de {@link SELECTOR} a
 * propósito**, igual que `SELECTOR_MIEMBRO` en el cajón de F08: los de ahí existen
 * siempre y éstos no. En una finca **urbana** no se pintan `paraje`, `poligono` ni
 * `parcela` —`report/firma.js#lineasEncabezado` no los emite, porque no le faltan
 * a la finca: es que no existen para ella—, así que meterlos en la tabla obligaría
 * al test del contrato de nodos a llevar una excepción escrita a mano, que es como
 * se pudren esas guardas.
 *
 * @param {string} campo  Una clave de `report/firma.js#CAMPOS_ENCABEZADO`.
 * @returns {string}
 */
export const selectorEncabezado = (campo) => `[data-encabezado="${campo}"]`

/**
 * El selector de un campo del pie de firma. Los cuatro existen siempre (los emite
 * `report/firma.js#CAMPOS_FIRMA` sin condiciones), pero se localizan igual que los
 * del encabezado para que el cableado no tenga dos formas de hacer lo mismo.
 *
 * @param {string} campo  Una clave de `report/firma.js#CAMPOS_FIRMA`.
 * @returns {string}
 */
export const selectorFirma = (campo) => `[data-firma="${campo}"]`

// ── Qué se edita y qué no ────────────────────────────────────────────────────

/**
 * Los campos del encabezado que se pueden **corregir a mano** en este diálogo:
 * los que vienen del servicio descriptivo del Catastro, **menos `clase`**.
 *
 * Por qué `clase` no se edita, aunque venga del mismo sitio que los demás:
 *
 *   · Es un **vocabulario cerrado** (`URBANA` | `RUSTICA`), no prosa.
 *     `report/firma.js#componerEncabezado` LANZA con cualquier otro valor, y con
 *     razón: un campo libre dejaría teclear «Urbana con jardín» y el error
 *     saltaría tres módulos más allá, al componer.
 *   · Es la que **decide qué filas se imprimen**. Cambiarla no cambia un dato:
 *     cambia el documento entero, haciendo aparecer o desaparecer el paraje, el
 *     polígono y la parcela. Eso no es corregir una errata.
 *   · Un desplegable de dos opciones sería reescribir lo que el Catastro dice de
 *     la finca. Si está mal, se corrige en el Catastro.
 *
 * `refcat`, `srs`, `fecha` e `idDocumento` tampoco se editan por otro motivo: los
 * pone la aplicación, no el servicio. Un identificador de documento tecleado a
 * mano no identifica nada, y una referencia catastral cambiada aquí haría que el
 * informe hablara de una parcela y el plano de otra.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CAMPOS_EDITABLES = Object.freeze(CAMPOS_DEL_SERVICIO.filter((c) => c !== 'clase'))

/**
 * Los campos fijos que se pintan en **mono con cifras tabulares**: la regla
 * tipográfica del sistema para todo valor numérico o normativo. `clase` se queda
 * fuera —es una palabra, no un código que nadie coteje carácter a carácter.
 *
 * @readonly
 * @type {readonly string[]}
 */
const CAMPOS_MONO = Object.freeze(['refcat', 'srs', 'fecha', 'idDocumento'])

// ── Vocabulario ──────────────────────────────────────────────────────────────

/** Lo que rotula el diálogo. El nombre legal correcto (SPEC §11.1). */
const TITULO =
  'Preparar el informe de contraste con el parcelario catastral'

/**
 * El desmentido, arriba del todo y antes de cualquier campo.
 *
 * Dice lo mismo, y casi con las mismas palabras, que la cabecera de
 * `report/contraste-texto.js`: el IVG y la VGA son un documento y un
 * procedimiento OFICIALES del Catastro, con código seguro de verificación, que
 * emite su Sede Electrónica. Esto no es aquello, y quien va a firmar tiene que
 * haberlo leído antes de teclear su número de colegiado, no después.
 */
const INTRO =
  'Este documento lo redacta y lo firma quien lo presenta. Aquí se cambia lo que haga falta ' +
  'antes de componer el PDF: los datos del encabezado, el texto del lindero y el pie de firma. ' +
  'No es la validación gráfica alternativa (VGA) ni el informe de validación gráfica (IVG) del ' +
  'Catastro, que son un procedimiento y un documento oficiales con código seguro de ' +
  'verificación y los emite su Sede Electrónica.'

/**
 * Lo que dice el renglón de estado mientras no se ha preparado ningún informe: al
 * nacer, y después de `fijar(null)`. El botón primario está apagado en los dos
 * momentos y **tiene que decir por qué** aunque el diálogo esté cerrado y no lo vea
 * nadie: la alternativa es un botón gris y mudo esperando a que alguien abra.
 */
export const SIN_DATOS =
  'El botón «Componer PDF» está apagado: todavía no se ha preparado ningún informe.'

/**
 * El motivo por el que «Componer PDF» está apagado con una presunción sin
 * repasar. Regla de oro 1: el botón se apaga y el porqué se escribe **en el mismo
 * paso**, nunca en dos.
 *
 * Se exporta para que el test y el cableado lo afirmen sin copiar el literal.
 */
export const MOTIVO_PRESUNCION_SIN_ACUSE =
  'El botón «Componer PDF» está apagado: el borrador propone linderos que la aplicación no ha ' +
  'medido. Repáselos arriba y marque la casilla para seguir.'

/** Acuse de «Regenerar» cuando el texto de verdad ha cambiado. */
const REGENERADO_CON_CAMBIO =
  'Se ha vuelto al borrador que redactó la aplicación. Lo que hubiera escrito encima ya no está.'

/** Acuse de «Regenerar» cuando no había nada que deshacer. */
const REGENERADO_SIN_CAMBIO =
  'El texto ya era el borrador que redactó la aplicación: no ha cambiado nada.'

/**
 * Lo que se le dice al usuario cuando revienta un oyente suyo, o sea lo que estaba
 * PENDIENTE de la pulsación. Gemelo de `app/zona-fichero.js#MENSAJE_ALFICHERO_ROTO`
 * y de `app/cableado-catastro.js#MENSAJE_SUSCRIPTOR_ROTO`, y por el mismo motivo
 * MEDIDO: **una excepción lanzada dentro de un oyente del DOM no sale por
 * `dispatchEvent`** —ni en jsdom ni en el navegador—, así que dejarla propagar es
 * un error silencioso de manual: la pantalla se queda como estaba, sin decir nada,
 * y el único rastro está en una consola que nadie abre.
 */
export const MENSAJE_OYENTE_ROTO =
  'La orden ha llegado bien, pero lo que la aplicación tenía que hacer con ella se ha ' +
  'interrumpido por un fallo interno; no se ha cambiado nada de lo que hay escrito en este ' +
  'diálogo. El detalle técnico está en la consola del navegador.'

/**
 * Cómo se enuncia cada presunción de `report/literal.js#PRESUNCION` en la lista
 * del bloque de advertencia.
 *
 * Se escribe aquí y no se importa de allí porque allí la frase va DENTRO del
 * párrafo del lindero («presumiblemente con vía pública…») y aquí es un renglón
 * suelto de una relación: la misma cosa dicha en dos sitios con dos sintaxis. Lo
 * que sí se importa es el CÓDIGO ({@link PRESUNCION}), que es lo que no puede
 * divergir.
 *
 * @type {Readonly<Record<string, string>>}
 */
const FRASE_PRESUNCION = Object.freeze({
  [PRESUNCION.VIA_PUBLICA]:
    'se propone vía pública: ninguna parcela colindante alcanza este lindero y la finca consta ' +
    'como urbana',
})

/**
 * Un código de presunción que esta pantalla no sabe redactar. **No se calla**
 * (regla de oro 1): un código nuevo en `report/literal.js` tiene que verse aquí
 * como un renglón raro y no desaparecer del bloque de advertencia, que es
 * precisamente el sitio donde una desaparición cuesta cara.
 *
 * @param {string} codigo
 * @returns {string}
 */
const fraseDesconocida = (codigo) =>
  `la aplicación lo propone bajo el código «${codigo}», que esta pantalla todavía no sabe ` +
  'redactar: mírelo en el borrador antes de firmar'

// ── Formato ──────────────────────────────────────────────────────────────────

/** Dos decimales y coma, como en todo el proyecto. */
const FORMATO_2 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Singular o plural con su cifra delante, para no escribir «1 lado(s)». */
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`

// ── Utilidades ───────────────────────────────────────────────────────────────

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para el mensaje de un `throw`, sin reventar con los cíclicos. */
function describir(valor) {
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

/**
 * ¿Sirve como documento? DUCK TYPING deliberado, no `instanceof Document` —
 * mismo criterio (y mismo motivo) que `app/avisos.js#esElementoDOM` y
 * `app/zona-fichero.js#esVentana`: un documento de otro realm (iframe) no pasa el
 * `instanceof`, y `Document` ni siquiera existe como global bajo el proyecto
 * Vitest `node`.
 *
 * @param {*} d
 * @returns {boolean}
 */
function esDocumento(d) {
  return (
    !!d &&
    typeof d === 'object' &&
    typeof d.createElement === 'function' &&
    typeof d.createTextNode === 'function' &&
    !!d.body
  )
}

/** Un texto utilizable, o `null`. Recorta y colapsa, como `report/firma.js`. */
function limpiar(valor) {
  if (typeof valor !== 'string') return null
  const limpio = valor.replace(/\s+/g, ' ').trim()
  return limpio === '' ? null : limpio
}

/**
 * Sello incremental para los `id` del marcado. Dos diálogos en el mismo documento
 * —dos mapas en una página, o un test que monta y no desmonta— compartirían los
 * `id` de sus `<label for>` y de sus `aria-describedby`, y un `for` que apunta al
 * campo de otro diálogo es un fallo que no se ve: el rótulo sigue ahí, solo que
 * pulsarlo enfoca el control equivocado. Mismo recurso que el `L.Util.stamp` de
 * los cajones.
 */
let sello = 0

// ── La vista ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} LinderoBorrador
 * @property {string} texto  El borrador redactado, tal cual lo devuelve
 *   `report/literal.js#describirLindero`.
 * @property {Array<{cardinal: string, longitud: number, nLados: number,
 *   presuncionNoVerificada: string|null}>} tramos  Los tramos del recorrido. **La
 *   marca de presunción viaja aquí y no en el texto**: ver la cabecera del módulo.
 */

/**
 * @typedef {Object} ValoresInforme
 * @property {object} encabezado  El mismo objeto que se pasó a `fijar`, con los
 *   campos de {@link CAMPOS_EDITABLES} **sustituidos por lo que haya en pantalla**
 *   (recortado; vacío ⇒ `null`) y todo lo demás tal cual llegó, `fecha` incluida.
 *   Se puede pasar directo a `report/firma.js#lineasEncabezado`.
 * @property {string} lindero  El contenido del cuadro de edición, **literal**: sin
 *   recortar, sin colapsar y sin tocar los saltos de línea, que son párrafos.
 * @property {boolean} linderoEditado  `true` si difiere del borrador que redactó
 *   la aplicación.
 * @property {import('../report/firma.js').Firma} firma  Los cuatro campos
 *   normalizados con `report/firma.js#normalizarFirma`.
 * @property {boolean} recordarFirma  Si la casilla «Recordar» está marcada.
 * @property {object[]} presunciones  Los tramos con `presuncionNoVerificada`, tal
 *   como llegaron. `[]` si no hay ninguno.
 * @property {boolean} acusePresuncion  Si se ha marcado el acuse. Con
 *   `presunciones` vacío es siempre `false` y no significa nada.
 */

/**
 * @typedef {Object} DialogoInforme
 * @property {HTMLElement} nodo  El `<dialog>` fabricado. Se expone para que el
 *   cableado y sus pruebas puedan interrogarlo por selector sin conocer dónde se
 *   montó.
 * @property {(datos: object|null) => void} fijar  Carga un informe.
 * @property {(lindero: LinderoBorrador) => void} fijarLindero  Sustituye SOLO el
 *   borrador del lindero (y con él la marca de presunción).
 * @property {() => void} abrir
 * @property {() => void} cerrar
 * @property {() => boolean} abierto
 * @property {() => ValoresInforme|null} valores
 * @property {() => boolean} puedeComponer
 * @property {(texto: string) => void} estado
 * @property {(fn: Function) => () => void} alComponer
 * @property {(fn: Function) => () => void} alRegenerar
 * @property {(fn: Function) => () => void} alCancelar
 * @property {() => void} destruir  IDEMPOTENTE.
 */

/**
 * Motivos con los que se cierra el diálogo. Viajan a los oyentes de
 * {@link DialogoInforme.alCancelar} para que el cableado pueda distinguir «el
 * usuario se ha echado atrás» de «lo he cerrado yo al terminar».
 *
 * @readonly
 */
export const MOTIVO_CIERRE = Object.freeze({
  /** Se ha pulsado «Cancelar». */
  BOTON: 'BOTON',
  /** Se ha pulsado `Escape` (o el navegador ha pedido cerrar por su cuenta). */
  ESCAPE: 'ESCAPE',
  /**
   * Lo ha cerrado el propio `<dialog>` sin pasar por aquí. En jsdom no ocurre —no
   * hay `close`— y en el navegador es la red de seguridad: si algún día una vía
   * nativa cierra el diálogo, el estado interno se entera igual.
   */
  NATIVO: 'NATIVO',
  /**
   * Lo ha cerrado el programa con `cerrar()`. **Nunca llega a los oyentes de
   * `alCancelar`**: se declara para que el motivo exista y se pueda nombrar, no
   * para que se reparta. El usuario no se ha echado atrás de nada.
   */
  PROGRAMATICO: 'PROGRAMATICO',
})

/**
 * El diálogo «Preparar informe».
 *
 * ```js
 * const dialogo = crearDialogoInforme({ documento: document, alAvisar: panel.avisar })
 * dialogo.fijar({ encabezado, procedencia, lindero, firma, recordarFirma: true })
 * dialogo.abrir()
 * dialogo.alComponer((valores) => componerPdf(valores))
 * dialogo.alRegenerar(() => dialogo.fijarLindero(describirLindero({ recintos, vecinas, clase })))
 * ```
 *
 * Contrato roto por el PROGRAMADOR (falta `documento`, un `alAlgo` que no recibe
 * función, un `fijar` con la forma equivocada) → `TypeError`, igual que el resto
 * del proyecto. Un dato malo del USUARIO —un campo en blanco, un lindero
 * reescrito, una firma a medias— **nunca lanza**: un informe sin número de
 * colegiado es un informe legítimo, y así lo dice `report/firma.js`.
 *
 * @param {Object} opciones
 * @param {Document} opciones.documento  El documento donde se monta. Se inyecta
 *   —en vez de tomar el global— para que el test pueda medirlo y para que el
 *   diálogo funcione dentro de un iframe.
 * @param {import('../viewer/_comun.js').Avisar} [opciones.alAvisar]  El canal de
 *   `app/avisos.js`. Si no se pasa, cae al `console.warn` de
 *   `viewer/_comun.js#avisoPorDefecto` — nunca al silencio.
 * @returns {DialogoInforme}
 * @throws {TypeError}
 */
export function crearDialogoInforme({ documento, alAvisar } = {}) {
  if (!esDocumento(documento)) {
    throw new TypeError(
      `crearDialogoInforme: 'documento' debe ser un Document (o un objeto con createElement, ` +
        `createTextNode y body); recibido ${describir(documento)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  const doc = documento
  const marca = (sello += 1)
  const id = (sufijo) => `gml-dialogo-informe-${marca}-${sufijo}`

  const crear = (etiqueta, clase, texto) => {
    const el = doc.createElement(etiqueta)
    if (clase) el.className = clase
    if (texto !== undefined) el.textContent = texto
    return el
  }

  // ── Estado ────────────────────────────────────────────────────────────────

  let destruido = false
  let estaAbierto = false
  /** Lo último que se pasó a `fijar`, ya normalizado. `null` = nada preparado. */
  let datos = null
  /** El borrador tal cual lo redactó la aplicación, para que «Regenerar» pueda volver. */
  let borrador = ''
  /** Los tramos con presunción del borrador vigente. */
  let presunciones = []
  /** Quién tenía el foco antes de abrir, para devolvérselo al cerrar. */
  let focoPrevio = null

  const oyentes = { componer: new Set(), regenerar: new Set(), cancelar: new Set() }

  /** Registro de escuchadores: cero fugas por construcción, igual que en `app/zona-fichero.js`. */
  const escuchados = []
  function escuchar(diana, tipo, fn) {
    diana.addEventListener(tipo, fn)
    escuchados.push({ diana, tipo, fn })
  }

  // ── El marcado ────────────────────────────────────────────────────────────

  const dialogo = crear('dialog', CLASE.DIALOGO)
  // ⚠️ NI `font` NI NINGUNA `fontFamily` EN LÍNEA, aquí ni en ningún hijo, y es
  // deliberado (lección MEDIDA de F08, guion 10): un estilo en línea GANA a la
  // hoja, así que un `font: 'inherit'` de conveniencia deja muertas las reglas de
  // `estilos/app.css` sin que nada se queje — y en jsdom no hay cascada que lo
  // delate. A diferencia de los módulos de `viewer/`, este NO necesita ser legible
  // sin hoja: `estilos/app.css` entra por `<link>` en `index.html` y es contrato de
  // la cáscara. Todo el cromo es de allí.
  dialogo.setAttribute('aria-labelledby', id('titulo'))
  // Recomendado con `showModal()` y necesario en la vía de respaldo (ver la
  // cabecera): sin capa superior, nada le dice a un lector de pantalla que lo de
  // detrás está fuera de juego.
  dialogo.setAttribute('aria-modal', 'true')
  // Suelo del foco: si el diálogo no tuviera ni un control enfocable, `abrir()`
  // dejaría el foco donde estaba —fuera— y `Escape` no llegaría nunca.
  dialogo.tabIndex = -1

  const cuerpo = crear('div', CLASE.CUERPO)
  dialogo.append(cuerpo)

  const titulo = crear('h2', CLASE.TITULO, TITULO)
  titulo.id = id('titulo')
  titulo.dataset.informe = 'titulo'

  const intro = crear('p', CLASE.INTRO, INTRO)
  intro.dataset.informe = 'intro'

  // ── Encabezado ────────────────────────────────────────────────────────────
  // `<fieldset>`/`<legend>` y no un `<div>` con un `<p>`: es un GRUPO de controles
  // relacionados, que es literalmente lo que ese par de elementos significa, y es
  // lo que hace que un lector de pantalla anuncie el grupo antes del primer campo.
  // Válido fuera de un `<form>`, igual que en `viewer/cajon-comprobacion.js`.
  const grupoEncabezado = crear('fieldset', CLASE.GRUPO)
  grupoEncabezado.dataset.informe = 'encabezado'
  grupoEncabezado.append(crear('legend', CLASE.LEYENDA, 'Encabezado del documento'))
  grupoEncabezado.append(
    crear(
      'p',
      CLASE.APUNTE,
      'Lo que se escriba aquí es lo que se imprime. Los cuatro datos en gris los pone la ' +
        'aplicación y no se editan: cambiarlos a mano haría que el texto hablara de una parcela ' +
        'y el plano de otra.',
    ),
  )
  const rejillaEncabezado = crear('div', CLASE.REJILLA)
  grupoEncabezado.append(rejillaEncabezado)

  // ── Lindero ───────────────────────────────────────────────────────────────
  const grupoLindero = crear('fieldset', CLASE.GRUPO)
  grupoLindero.dataset.informe = 'lindero'
  grupoLindero.append(crear('legend', CLASE.LEYENDA, 'Descripción del lindero'))
  grupoLindero.append(
    crear(
      'p',
      CLASE.APUNTE,
      'Este es el borrador que ha redactado la aplicación con la geometría y con las parcelas ' +
        'colindantes que se hayan traído. Se puede reescribir entero: lo que quede en el cuadro ' +
        'es lo que se imprime.',
    ),
  )

  // El bloque de la presunción. Existe SIEMPRE y se enseña con `hidden`, no
  // creándolo al vuelo: si solo apareciera al pintar, el `nodo()` del cableado
  // lanzaría al arrancar. Ver la cabecera para por qué está aquí y no dentro del
  // cuadro de texto.
  const bloquePresuncion = crear('section', CLASE.PRESUNCION)
  bloquePresuncion.dataset.informe = 'presuncion'
  bloquePresuncion.hidden = true
  bloquePresuncion.append(
    crear(
      'h3',
      CLASE.PRESUNCION_TITULO,
      'Lo que el borrador PROPONE sin haberlo medido',
    ),
    crear(
      'p',
      CLASE.APUNTE,
      'Los tramos de abajo no salen de una medición: son la lectura más probable de una ' +
        'ausencia, y esta aplicación no la ha comprobado. Repáselos en el cuadro de edición y ' +
        'decida usted qué se imprime.',
    ),
  )
  const listaPresuncion = crear('ul', CLASE.LISTA)
  listaPresuncion.dataset.informe = 'presuncion-tramos'
  bloquePresuncion.append(listaPresuncion)

  const filaAcuse = crear('label', CLASE.CASILLA_FILA)
  filaAcuse.htmlFor = id('acuse')
  const acuse = crear('input', CLASE.CASILLA)
  acuse.type = 'checkbox'
  acuse.id = id('acuse')
  acuse.dataset.informe = 'acuse-presuncion'
  filaAcuse.append(acuse, doc.createTextNode('He repasado los tramos de arriba.'))
  bloquePresuncion.append(filaAcuse)
  grupoLindero.append(bloquePresuncion)

  const literal = crear('textarea', `gml-entrada ${CLASE.LITERAL}`)
  literal.id = id('literal')
  literal.dataset.informe = 'literal'
  literal.rows = 12
  literal.setAttribute('aria-label', 'Texto del lindero, editable')
  grupoLindero.append(literal)

  const regenerar = crear('button', 'gml-boton gml-boton--secundario', 'Regenerar el borrador')
  regenerar.type = 'button'
  regenerar.dataset.accion = 'regenerar-lindero'
  const filaRegenerar = crear('div', CLASE.PIE)
  filaRegenerar.append(regenerar)
  grupoLindero.append(filaRegenerar)

  // ── Firma ─────────────────────────────────────────────────────────────────
  // El rótulo del grupo es `report/firma.js#TITULO_FIRMA` —«Firma», y nada más—,
  // IMPORTADO y no copiado. Aquel módulo razona por extenso por qué no es «Técnico
  // que suscribe» ni ninguna variante con profesión: entre dos redacciones, la que
  // menos afirme.
  const grupoFirma = crear('fieldset', CLASE.GRUPO)
  grupoFirma.dataset.informe = 'firma'
  grupoFirma.append(crear('legend', CLASE.LEYENDA, TITULO_FIRMA))
  grupoFirma.append(
    crear(
      'p',
      CLASE.APUNTE,
      'Los cuatro se imprimen al pie del documento. El que se deje en blanco se imprime como ' +
        '«No consta»: nunca queda un hueco mudo.',
    ),
  )
  const rejillaFirma = crear('div', CLASE.REJILLA)
  grupoFirma.append(rejillaFirma)

  /** Los `<input>` del pie de firma, por campo. */
  const entradasFirma = new Map()
  for (const campo of CAMPOS_FIRMA) {
    const caja = crear('div', CLASE.CAMPO)
    const idCampo = id(`firma-${campo}`)
    const rotulo = crear('label', CLASE.ROTULO, ROTULO_FIRMA[campo])
    rotulo.htmlFor = idCampo
    const entrada = crear('input', `gml-entrada ${CLASE.ENTRADA}`)
    entrada.type = 'text'
    entrada.id = idCampo
    entrada.dataset.firma = campo
    // ⛔ NI `list`, NI `autocomplete` con vocabulario, NI `<datalist>` en
    // `colegio`. Es campo LIBRE por decisión jurídica, no por comodidad: una lista
    // de la que elegir sería una lista cerrada de quién puede firmar, y esa
    // decisión no le toca a esta herramienta (MEJORES_PRACTICAS_GML.md §5.2).
    caja.append(rotulo, entrada)
    rejillaFirma.append(caja)
    entradasFirma.set(campo, entrada)
  }

  const filaRecordar = crear('label', CLASE.CASILLA_FILA)
  filaRecordar.htmlFor = id('recordar')
  const recordar = crear('input', CLASE.CASILLA)
  recordar.type = 'checkbox'
  recordar.id = id('recordar')
  recordar.dataset.informe = 'recordar'
  filaRecordar.append(
    recordar,
    doc.createTextNode('Recordar estos datos en este navegador para el próximo informe.'),
  )
  grupoFirma.append(filaRecordar)

  // ── El pie ────────────────────────────────────────────────────────────────
  const pie = crear('div', CLASE.PIE)
  const componer = crear('button', 'gml-boton gml-boton--primario', 'Componer PDF')
  componer.type = 'button'
  componer.dataset.accion = 'componer-pdf'
  // El renglón de estado es donde se escribe POR QUÉ está apagado, así que se
  // enlaza: un lector de pantalla que anuncie el botón anuncia también el motivo,
  // sin que el usuario tenga que ir a buscarlo.
  componer.setAttribute('aria-describedby', id('estado'))
  // NACE APAGADO: sin informe preparado no hay nada que componer. A partir de aquí
  // lo gobierna `repintarGate`, y nunca sin escribir el motivo.
  componer.disabled = true

  const cancelar = crear('button', 'gml-boton gml-boton--secundario', 'Cancelar')
  cancelar.type = 'button'
  cancelar.dataset.accion = 'cancelar-informe'
  pie.append(componer, cancelar)

  // `role="status"` para que el lector de pantalla lo anuncie SIN robar el foco,
  // igual que el de «Generar GML», el de la barra de edición y los de los dos
  // cajones: el usuario sigue con las manos donde estaba.
  const estadoNodo = crear('p', CLASE.ESTADO, SIN_DATOS)
  estadoNodo.id = id('estado')
  estadoNodo.dataset.estado = 'dialogo-informe'
  estadoNodo.setAttribute('role', 'status')

  cuerpo.append(titulo, intro, grupoEncabezado, grupoLindero, grupoFirma, pie, estadoNodo)
  doc.body.appendChild(dialogo)

  // ── Pintado ───────────────────────────────────────────────────────────────

  /** Los `<input>`/`<p>` del encabezado que hay pintados ahora mismo, por campo. */
  const nodosEncabezado = new Map()

  /**
   * El encabezado, pintando **lo que `report/firma.js#lineasEncabezado` da y solo
   * eso**: la lógica de qué filas aplican a esta finca —en urbana no salen paraje,
   * polígono ni parcela— vive allí y aquí no se duplica. Duplicarla sería tener dos
   * verdades sobre el mismo documento, y la que se quedaría vieja sería ésta.
   *
   * ⚠️ **Un campo que no consta se pinta VACÍO, nunca con el sustituto dentro.**
   * `lineasEncabezado` devuelve «No consta» / «No se ha consultado» / «No se ha
   * podido consultar» para IMPRIMIR, y meter eso en un `<input>` tendría dos
   * efectos, los dos malos: el usuario vería un dato donde no lo hay, y
   * {@link valores} devolvería la cadena «No consta» como si fuera el nombre del
   * municipio. El sustituto es información sobre por qué el campo está vacío, así
   * que va debajo, en un apunte enlazado por `aria-describedby`.
   */
  function pintarEncabezado() {
    rejillaEncabezado.replaceChildren()
    nodosEncabezado.clear()
    if (datos === null) return

    for (const linea of lineasEncabezado(datos.encabezado, {
      procedencia: datos.procedencia,
    })) {
      const caja = crear('div', CLASE.CAMPO)
      const editable = CAMPOS_EDITABLES.includes(linea.campo)
      const idCampo = id(`encabezado-${linea.campo}`)

      if (editable) {
        const rotulo = crear('label', CLASE.ROTULO, linea.etiqueta)
        rotulo.htmlFor = idCampo
        const entrada = crear('input', `gml-entrada ${CLASE.ENTRADA}`)
        entrada.type = 'text'
        entrada.id = idCampo
        entrada.dataset.encabezado = linea.campo
        entrada.value = linea.consta ? linea.valor : ''
        caja.append(rotulo, entrada)
        nodosEncabezado.set(linea.campo, entrada)

        if (!linea.consta) {
          // El sustituto y, si lo hay, el mensaje del servicio —redactado por
          // `services/` y copiado LITERAL (regla de oro 1)—. Los tres sabores de
          // «no hay» se escriben distinto a propósito y esa distinción se conserva
          // hasta aquí: «no consta» afirma algo del Catastro, «no se ha consultado»
          // afirma algo de nosotros.
          const apunte = crear(
            'p',
            CLASE.APUNTE,
            linea.detalle === null ? linea.valor : `${linea.valor} — ${linea.detalle}`,
          )
          apunte.id = `${idCampo}-nota`
          entrada.setAttribute('aria-describedby', apunte.id)
          caja.append(apunte)
        }
      } else {
        // Fijo: se enseña, no se edita. Un `<span>` de rótulo y no un `<label>`,
        // porque un `<label>` sin control al que apuntar es marcado que miente.
        const rotulo = crear('span', CLASE.ROTULO, linea.etiqueta)
        const clase = CAMPOS_MONO.includes(linea.campo)
          ? `${CLASE.FIJO} gml-mono`
          : CLASE.FIJO
        const valor = crear('p', clase, linea.valor)
        valor.dataset.encabezado = linea.campo
        caja.append(rotulo, valor)
        nodosEncabezado.set(linea.campo, valor)
      }

      rejillaEncabezado.append(caja)
    }
  }

  /**
   * El bloque de la presunción. Se deriva de `tramos[].presuncionNoVerificada` y
   * **nunca del texto**: ver la cabecera del módulo, que es donde se razona por qué
   * ésa es la mitad que de verdad importa.
   */
  function pintarPresuncion() {
    listaPresuncion.replaceChildren()
    bloquePresuncion.hidden = presunciones.length === 0
    // El acuse se desmarca en cada repintado: es un acuse de ESTOS tramos, y un
    // borrador nuevo trae tramos nuevos. Arrastrar la casilla marcada de un
    // borrador al siguiente sería dar por repasado lo que nadie ha visto.
    acuse.checked = false

    for (const tramo of presunciones) {
      const codigo = tramo.presuncionNoVerificada
      const frase = FRASE_PRESUNCION[codigo] ?? fraseDesconocida(codigo)
      const medida =
        tramo.nLados === 1
          ? `en línea recta de ${FORMATO_2.format(tramo.longitud)} m`
          : `en línea quebrada de ${plural(tramo.nLados, 'lado', 'lados')} que suman ` +
            `${FORMATO_2.format(tramo.longitud)} m`
      listaPresuncion.append(
        crear('li', null, `Linda al ${tramo.cardinal}, ${medida}: ${frase}.`),
      )
    }
  }

  /**
   * El botón primario y su porqué, **SIEMPRE en el mismo paso** (regla de oro 1).
   * Separar las dos cosas es exactamente como se llega a tener un botón gris y
   * mudo.
   *
   * Cuando sí se puede componer, el renglón se VACÍA. Es un repintado: dejar ahí el
   * motivo del informe anterior —o el «Componiendo el PDF…» de la vez pasada— sería
   * peor que no decir nada. Quien quiera escribir algo después tiene {@link estado}.
   */
  function repintarGate() {
    const motivo =
      datos === null
        ? SIN_DATOS
        : presunciones.length > 0 && !acuse.checked
          ? MOTIVO_PRESUNCION_SIN_ACUSE
          : null
    componer.disabled = motivo !== null
    estadoNodo.textContent = motivo ?? ''
  }

  // ── Oyentes ───────────────────────────────────────────────────────────────

  /**
   * Reparte un suceso entre sus oyentes **atrapando lo que revienten**.
   *
   * Ver {@link MENSAJE_OYENTE_ROTO}: una excepción dentro de un oyente del DOM no
   * sale por `dispatchEvent`, así que dejarla propagar deja al usuario mirando una
   * pantalla que no ha hecho nada y sin una palabra. Se cuenta por los dos canales
   * de la casa: el panel (en español) y `console.error` (el detalle).
   *
   * El `try` alcanza a CADA oyente por separado: uno roto no puede dejar sin
   * enterarse a los demás.
   *
   * @param {Set<Function>} conjunto
   * @param {*} [carga]
   */
  function repartir(conjunto, carga) {
    for (const fn of conjunto) {
      try {
        fn(carga)
      } catch (causa) {
        avisar(MENSAJE_OYENTE_ROTO, { nivel: NIVEL.ERROR, causa })
        console.error('[dialogo-informe] un oyente ha fallado de forma inesperada:', causa)
      }
    }
  }

  /** Alta de un oyente, con su baja. Mismo patrón —y misma guarda— que los cajones. */
  function suscribir(conjunto, fn, quien) {
    if (typeof fn !== 'function') {
      throw new TypeError(`${quien}: 'fn' debe ser una función; recibido ${describir(fn)}.`)
    }
    conjunto.add(fn)
    return () => conjunto.delete(fn)
  }

  function alPulsarComponer() {
    // Guarda de cinturón: el botón está `disabled`, pero un `click()` sintético
    // sobre un botón deshabilitado no dispara en el navegador y sí podría llegar
    // aquí por otras vías. Componer un PDF con una presunción sin repasar es
    // justo lo que este gate existe para impedir.
    if (componer.disabled) return
    repartir(oyentes.componer, valores())
  }

  function alPulsarCancelar() {
    cerrarInterno(MOTIVO_CIERRE.BOTON, true)
  }

  /**
   * «Regenerar el borrador».
   *
   * Hace DOS cosas y en este orden, que no es indiferente:
   *
   *   1. **Restaura, por sí solo, el borrador que este módulo guardó.** No depende
   *      de que nadie esté suscrito: un botón cuyo efecto dependiera de que el
   *      llamante se acuerde de reaccionar sería un botón muerto el día que se le
   *      olvide.
   *   2. **Avisa a los suscritos**, para que el cableado pueda recalcular el
   *      lindero —si algo ha cambiado desde que se abrió— y sustituirlo con
   *      {@link fijarLindero}.
   *
   * Y **dice lo que ha pasado**. Volver al borrador tira lo que hubiera escrito
   * encima, y eso no puede ocurrir en silencio (regla de oro 1). Es la contrapartida
   * conocida de este botón: no hay deshacer. El acuse se escribe DESPUÉS de
   * repintar, porque `repintarGate` vacía el renglón.
   */
  function alPulsarRegenerar() {
    const habiaCambio = literal.value !== borrador
    literal.value = borrador
    repintarGate()
    estadoNodo.textContent = habiaCambio ? REGENERADO_CON_CAMBIO : REGENERADO_SIN_CAMBIO
    repartir(oyentes.regenerar)
  }

  function alCambiarAcuse() {
    repintarGate()
  }

  /**
   * `Escape`.
   *
   * **No se hace `preventDefault`**: en un navegador de verdad el propio
   * `<dialog>` ya atiende la petición de cierre (evento `cancel`), y cancelar el
   * gesto aquí dejaría esa mitad muerta sin ganar nada. Las dos vías convergen
   * porque {@link cerrarInterno} es idempotente.
   *
   * En jsdom esta es la ÚNICA vía: no hay `cancel` ni `close` (ver la cabecera).
   */
  function alTecla(evento) {
    if (evento.key !== 'Escape') return
    cerrarInterno(MOTIVO_CIERRE.ESCAPE, true)
  }

  /** La vía nativa, cuando existe. En jsdom no llega nunca. */
  function alCancelNativo() {
    cerrarInterno(MOTIVO_CIERRE.ESCAPE, true)
  }

  /**
   * Red de seguridad: el `<dialog>` se ha cerrado sin pasar por aquí. Si el cierre
   * lo hemos hecho nosotros, `estaAbierto` ya es `false` y esto no hace nada.
   *
   * La guarda de `dialogo.open` es para un `close` RANCIO: el navegador encola ese
   * evento, así que un `cerrar()` seguido de un `abrir()` en el mismo tick lo
   * entregaría con el diálogo ya reabierto y esto lo volvería a cerrar sin que
   * nadie lo hubiera pedido.
   */
  function alCerrarNativo() {
    if (dialogo.open) return
    cerrarInterno(MOTIVO_CIERRE.NATIVO, true)
  }

  escuchar(componer, 'click', alPulsarComponer)
  escuchar(cancelar, 'click', alPulsarCancelar)
  escuchar(regenerar, 'click', alPulsarRegenerar)
  escuchar(acuse, 'change', alCambiarAcuse)
  escuchar(dialogo, 'keydown', alTecla)
  escuchar(dialogo, 'cancel', alCancelNativo)
  escuchar(dialogo, 'close', alCerrarNativo)

  // ── Apertura y cierre ─────────────────────────────────────────────────────

  /**
   * El primer control al que se puede ir. Se enfoca **un campo** y no el diálogo:
   * esto es un formulario que se viene a rellenar, y aterrizar en el primer campo
   * es lo que deja empezar a teclear. El NOMBRE del diálogo lo anuncia igualmente
   * el `aria-labelledby` cuando `showModal()` lo mete en la capa superior.
   *
   * @returns {HTMLElement}
   */
  function primerFoco() {
    // La visibilidad se comprueba por el `hidden` del ancestro y **no** por
    // `offsetParent`, que es la forma habitual y aquí sería una trampa doble:
    // en jsdom vale `null` siempre (no hay maquetado) y en un navegador vale
    // `null` para todo lo que cuelga de un `position: fixed` — que es justo lo que
    // este diálogo es. Con `offsetParent` el foco no aterrizaría nunca en un campo,
    // ni aquí ni allí. Y `[hidden]` es lo único que este módulo oculta.
    for (const el of dialogo.querySelectorAll('input, textarea, button')) {
      if (!el.disabled && el.closest('[hidden]') === null) return el
    }
    return dialogo
  }

  function abrir() {
    if (destruido || estaAbierto) return
    focoPrevio = doc.activeElement ?? null
    estaAbierto = true

    // Detección de capacidad, no de navegador. Ver la cabecera: en jsdom
    // `showModal` no existe y llamarlo a pelo lanzaría `TypeError`.
    if (typeof dialogo.showModal === 'function') {
      try {
        dialogo.showModal()
      } catch {
        // `showModal()` lanza `InvalidStateError` si el diálogo ya tenía el
        // atributo `open` o si no está conectado al documento. En los dos casos
        // enseñarlo sigue siendo lo correcto; lo que se pierde es la capa superior.
        dialogo.setAttribute('open', '')
      }
    } else {
      dialogo.setAttribute('open', '')
    }

    primerFoco().focus()
  }

  /**
   * Cierra y, si toca, avisa.
   *
   * IDEMPOTENTE por construcción: `estaAbierto` se baja ANTES de tocar el DOM, así
   * que el `close` que emita el navegador vuelve a entrar aquí y sale por la
   * primera línea. Es lo que permite que la vía nativa y la nuestra convivan sin
   * notificar dos veces.
   *
   * @param {string} motivo  Uno de {@link MOTIVO_CIERRE}.
   * @param {boolean} notificar  `false` cuando lo cierra el programa (`cerrar()`),
   *   `true` cuando se ha echado atrás el usuario. Mismo criterio que el
   *   «Descartar» del cajón de F08: `cerrar()` es mudo, un gesto del usuario no.
   */
  function cerrarInterno(motivo, notificar) {
    if (!estaAbierto) return
    estaAbierto = false

    if (typeof dialogo.close === 'function') {
      try {
        dialogo.close()
      } catch {
        dialogo.removeAttribute('open')
      }
    } else {
      dialogo.removeAttribute('open')
    }

    // El foco vuelve a quien lo tenía. El navegador ya lo hace con `showModal()`,
    // y hacerlo otra vez sobre el mismo elemento no cuesta nada; en jsdom ésta es
    // la única vía. Si aquel elemento ya no está en el documento —se ha repintado
    // el panel mientras el diálogo estaba abierto— no se fuerza nada: el foco se
    // queda en el `<body>`, que es donde lo dejaría el navegador.
    const previo = focoPrevio
    focoPrevio = null
    if (previo && typeof previo.focus === 'function' && previo.isConnected) previo.focus()

    if (notificar) repartir(oyentes.cancelar, motivo)
  }

  // ── Carga ─────────────────────────────────────────────────────────────────

  /**
   * Exige el objeto de `describirLindero`, no una cadena suelta. Ver
   * {@link DialogoInforme.fijarLindero} para el porqué, que es de fondo y no de
   * tipos.
   *
   * @param {*} lindero
   * @param {string} quien
   * @throws {TypeError}
   */
  function exigirLindero(lindero, quien) {
    if (
      !esObjeto(lindero) ||
      typeof lindero.texto !== 'string' ||
      !Array.isArray(lindero.tramos)
    ) {
      throw new TypeError(
        `${quien}: se espera lo que devuelve report/literal.js#describirLindero ` +
          `({texto, tramos, …}); recibido ${describir(lindero)}. Un string suelto NO vale: la ` +
          'marca de presunción viaja en los tramos y no en el texto, y sin ella el diálogo ' +
          'enseñaría un lindero propuesto como si estuviera medido.',
      )
    }
  }

  /** El cuerpo de {@link DialogoInforme.fijarLindero}, sin la guarda. */
  function cargarLindero(lindero) {
    borrador = lindero.texto
    literal.value = lindero.texto
    presunciones = lindero.tramos.filter(
      (t) =>
        esObjeto(t) &&
        t.presuncionNoVerificada !== null &&
        t.presuncionNoVerificada !== undefined,
    )
    pintarPresuncion()
    repintarGate()
  }

  // ── Lectura ───────────────────────────────────────────────────────────────

  /** @returns {ValoresInforme|null} */
  function valores() {
    if (destruido || datos === null) return null

    const encabezado = { ...datos.encabezado }
    for (const campo of CAMPOS_EDITABLES) {
      const nodo = nodosEncabezado.get(campo)
      // Un campo que no se ha pintado —los tres de rústica en una finca urbana—
      // conserva lo que trajera el encabezado. No se inventa nada por él.
      if (nodo === undefined || nodo.tagName !== 'INPUT') continue
      encabezado[campo] = limpiar(nodo.value)
    }

    const firma = {}
    for (const campo of CAMPOS_FIRMA) firma[campo] = entradasFirma.get(campo).value
    return {
      encabezado,
      // El lindero se devuelve LITERAL: sin recortar y sin colapsar. Sus saltos de
      // línea son párrafos, y `limpiar()` —que colapsa rachas de espacio— convertiría
      // el documento entero en un párrafo único.
      lindero: literal.value,
      linderoEditado: literal.value !== borrador,
      firma: normalizarFirma(firma),
      recordarFirma: recordar.checked === true,
      presunciones: [...presunciones],
      acusePresuncion: presunciones.length > 0 && acuse.checked === true,
    }
  }

  // ── API pública ───────────────────────────────────────────────────────────

  return {
    nodo: dialogo,

    /**
     * Carga un informe: encabezado, borrador del lindero y pie de firma.
     *
     * ⚠️ **REEMPLAZA todo lo que hubiera escrito**, incluido el texto del lindero y
     * los campos del encabezado. Es la puerta por la que entra un documento NUEVO,
     * no un refresco: llamarlo dos veces con lo mismo tira las correcciones del
     * usuario. Para sustituir solo el borrador está {@link fijarLindero}.
     *
     * `null` deja el diálogo en blanco —sin cerrarlo— y el botón primario APAGADO,
     * con su motivo escrito.
     *
     * @param {Object|null} entrada
     * @param {object} entrada.encabezado  El de `report/firma.js#componerEncabezado`.
     * @param {object|null} [entrada.procedencia]  La de
     *   `report/firma.js#procedenciaDescriptivos`, o el sobre del contrato E tal
     *   cual, o `null` ⇒ no se consultó. Es lo que distingue «no consta» de «no se
     *   ha consultado» en los apuntes de los campos vacíos.
     * @param {LinderoBorrador} entrada.lindero  Lo que devuelve
     *   `report/literal.js#describirLindero`. **El objeto entero, no su `texto`**:
     *   ver {@link fijarLindero}.
     * @param {object|null} [entrada.firma]  Lo que haya recordado el navegador, o
     *   `null` en el primer arranque.
     * @param {boolean} [entrada.recordarFirma=false]
     * @throws {TypeError}  Contrato del programador. También lo que lancen
     *   `lineasEncabezado` y `normalizarFirma`, que validan lo suyo.
     */
    fijar(entrada) {
      if (destruido) return

      if (entrada === null || entrada === undefined) {
        datos = null
        borrador = ''
        presunciones = []
        literal.value = ''
        recordar.checked = false
        for (const campo of CAMPOS_FIRMA) entradasFirma.get(campo).value = ''
        pintarEncabezado()
        pintarPresuncion()
        repintarGate()
        return
      }

      if (!esObjeto(entrada)) {
        throw new TypeError(
          `fijar: se espera un objeto {encabezado, procedencia, lindero, firma, ` +
            `recordarFirma} o null; recibido ${describir(entrada)}.`,
        )
      }
      const { encabezado, procedencia = null, lindero, firma = null, recordarFirma = false } =
        entrada
      if (!esObjeto(encabezado)) {
        throw new TypeError(
          `fijar: 'encabezado' debe ser el objeto de report/firma.js#componerEncabezado; ` +
            `recibido ${describir(encabezado)}.`,
        )
      }

      // ⚠️ LAS TRES VALIDACIONES VAN ANTES DE TOCAR UN SOLO NODO, y el orden
      // importa: si algo va a lanzar, tiene que lanzar con el diálogo EXACTAMENTE
      // como estaba. Un `fijar` que reventara a mitad dejaría la pantalla con el
      // encabezado del documento nuevo y el lindero del anterior — dos documentos
      // distintos a la vez, y nadie avisando.
      const normalizada = normalizarFirma(firma)
      lineasEncabezado(encabezado, { procedencia })
      exigirLindero(lindero, 'fijar')

      datos = { encabezado, procedencia }
      for (const campo of CAMPOS_FIRMA) {
        entradasFirma.get(campo).value = normalizada[campo] ?? ''
      }
      recordar.checked = recordarFirma === true

      pintarEncabezado()
      cargarLindero(lindero)
    },

    /**
     * Sustituye SOLO el borrador del lindero, y con él la marca de presunción.
     *
     * Es lo que llama el cableado desde su oyente de {@link alRegenerar} cuando ha
     * recalculado la descripción (porque han cambiado los colindantes, por
     * ejemplo). El resto del diálogo —encabezado, firma, casillas— no se toca.
     *
     * ⚠️ **Se exige el OBJETO de `describirLindero`, no una cadena suelta**, y no es
     * rigidez: la marca de presunción viaja en `tramos[].presuncionNoVerificada` y
     * no en el texto. Admitir un `string` dejaría entrar un borrador con «vía
     * pública» dentro y sin bloque de advertencia, que es exactamente el fallo
     * contra el que avisa la cabecera de `report/literal.js`.
     *
     * @param {LinderoBorrador} lindero
     * @throws {TypeError}
     */
    fijarLindero(lindero) {
      if (destruido) return
      exigirLindero(lindero, 'fijarLindero')
      cargarLindero(lindero)
    },

    /**
     * Abre el diálogo: `showModal()` donde exista, atributo `open` donde no (ver la
     * cabecera). Mueve el foco al primer campo y recuerda quién lo tenía.
     *
     * Idempotente: abrir lo ya abierto no hace nada, y sobre todo **no vuelve a
     * apuntar `focoPrevio`**, que es como se pierde el elemento al que había que
     * devolver el foco.
     */
    abrir,

    /**
     * Cierra el diálogo **sin borrar nada**, y sin avisar a los oyentes de
     * {@link alCancelar} (eso es para los gestos del usuario).
     *
     * Que cerrar no borre es la contrapartida de haber aceptado `Escape` en un
     * diálogo que contiene texto reescrito a mano. El cajón de F08 se negó a
     * cerrarse con `Escape` justamente porque perder lo que tenía dentro era una
     * pérdida silenciosa; aquí la accesibilidad pide que `Escape` cierre, así que
     * lo que se garantiza es lo otro: volver a llamar a {@link abrir} devuelve la
     * pantalla exactamente como estaba, con las correcciones dentro. Lo único que
     * reemplaza el contenido es {@link fijar}.
     */
    cerrar() {
      cerrarInterno(MOTIVO_CIERRE.PROGRAMATICO, false)
    },

    abierto() {
      return !destruido && estaAbierto === true
    },

    valores,

    /**
     * ¿Está encendido «Componer PDF»? Se expone para que el cableado y sus pruebas
     * no tengan que espiar el `disabled` de un nodo por selector, y para que el
     * guion de navegador pueda afirmarlo sin conocer el marcado. Gemelo de
     * `puedeContrastar()` en el cajón de F08.
     */
    puedeComponer() {
      return !destruido && componer.disabled === false
    },

    /**
     * Escribe el renglón de estado (`role="status"`).
     *
     * ⚠️ Lo que se escriba aquí vale **hasta el siguiente repintado**: `fijar`,
     * `fijarLindero` y la casilla del acuse vuelven a escribir ahí el motivo del
     * gate (o lo vacían). Es el orden correcto —el motivo de un botón apagado manda
     * sobre el mensaje de la operación anterior—, y es el mismo aviso que lleva el
     * `estado()` del cajón de F08.
     *
     * @param {string} texto
     */
    estado(texto) {
      if (!destruido) estadoNodo.textContent = typeof texto === 'string' ? texto : ''
    },

    /**
     * Se suscribe a «Componer PDF». El oyente recibe {@link ValoresInforme} ya
     * leído, para que el cableado no tenga que acordarse de pedirlo. Devuelve la
     * BAJA.
     *
     * Varios oyentes, como `alColindantes` de F05 y los tres de los cajones: un
     * `= fn` desengancharía al primero en silencio.
     */
    alComponer(fn) {
      return suscribir(oyentes.componer, fn, 'alComponer')
    },

    /**
     * Se suscribe a «Regenerar el borrador». **El texto ya se ha restaurado** cuando
     * el oyente corre: esto es para quien quiera además recalcularlo. Devuelve la
     * BAJA.
     */
    alRegenerar(fn) {
      return suscribir(oyentes.regenerar, fn, 'alRegenerar')
    },

    /**
     * Se suscribe al cierre POR GESTO DEL USUARIO —«Cancelar» o `Escape`—, nunca al
     * `cerrar()` del programa. El oyente recibe el motivo ({@link MOTIVO_CIERRE}).
     * Devuelve la BAJA.
     */
    alCancelar(fn) {
      return suscribir(oyentes.cancelar, fn, 'alCancelar')
    },

    /**
     * Retira los escuchadores, saca el `<dialog>` del documento y deja el módulo
     * inerte. **IDEMPOTENTE** y deja el DOM como estaba.
     *
     * Se cierra antes de desmontar para que el foco vuelva a quien lo tenía: un
     * diálogo que desaparece con el foco dentro deja el foco en el `<body>` y a
     * quien navega con teclado en mitad de ninguna parte.
     */
    destruir() {
      if (destruido) return
      cerrarInterno(MOTIVO_CIERRE.PROGRAMATICO, false)
      destruido = true

      for (const { diana, tipo, fn } of escuchados) diana.removeEventListener(tipo, fn)
      escuchados.length = 0

      oyentes.componer.clear()
      oyentes.regenerar.clear()
      oyentes.cancelar.clear()

      if (dialogo.parentNode) dialogo.parentNode.removeChild(dialogo)
    },
  }
}

export default crearDialogoInforme

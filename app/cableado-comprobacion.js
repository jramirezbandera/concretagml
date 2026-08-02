// app/cableado-comprobacion.js — F08 · T4.1. EL RECORRIDO ENTERO, DE PUNTA A PUNTA.
//
// Las cinco piezas de las fases 1 a 3 están hechas y ninguna conoce a las otras:
// `app/zona-fichero.js` entrega un `File` y no sabe qué es un GML;
// `gml/decodificar.js` convierte bytes en texto; `comprobacion/gml.js` dice qué es
// ese texto y qué le pasa; `viewer/cajon-comprobacion.js` lo enseña y ofrece dos
// salidas. Este fichero es lo que las une y lo que las conecta con el store, con
// el Catastro y con la ficha del pie. Mientras no existiera, F08 entera era código
// muerto.
//
// El recorrido, entero:
//
//   File → ArrayBuffer → decodificarGml → comprobarGml → cajón → («Contrastar»)
//        → cliente.parcelaPorRefcat → UN SOLO estado.set → cajón cerrado
//        → y F07 se enciende sola, sin una línea de código nuevo.
//
// Su anatomía es la de `app/cableado-diagnostico.js` y la de
// `app/cableado-catastro.js` a propósito —selectores exportados, motivos como
// constantes exportadas, dependencias inyectables, `destruir()` idempotente—: quien
// llegue después reconoce el patrón sin leerlo entero.
//
// ── LAS SEIS COSAS DE LAS QUE ES DUEÑO ──────────────────────────────────────
//
//   1. **NO LLAMA A `cablearCatastro().cargar()`.** Ese camino hace `estado.set`
//      con la geometría del WFS, y aquí eso BORRARÍA la geometría del fichero —que
//      es justo lo que hay que contrastar—. Se llama a `cliente.parcelaPorRefcat`
//      directamente y se COMPONE una parcela con las dos: `recintos` del fichero,
//      `geometriaOficial` del parcelario. Un solo `estado.set`.
//   2. **LA PROCEDENCIA DICE LAS DOS COSAS.** Ver {@link textoProcedenciaDoble}.
//   3. **UN FALLO DE RED NO TUMBA EL RECORRIDO.** La parcela entra igual con
//      `geometriaOficial: null` y se dice por qué.
//   4. **LA EXCLUSIÓN MUTUA DE LOS DOS CAJONES**, que comparten `bottomleft`.
//   5. **LA ELECCIÓN DE PARCELA** de un fichero multiparcela: se recomprueba con
//      el índice elegido y entra ÉSA, nunca la unión.
//   6. **CADA FALLO SE CUENTA DONDE OCURRE.** Ver la sección siguiente.
//
// ── ⚠️ UNA EXCEPCIÓN DENTRO DE UN OYENTE DEL DOM NO LLEGA A NINGUNA PARTE ───
// MEDIDO en T3.2, y gobierna cómo está escrito todo este fichero: una excepción
// lanzada dentro de un oyente del DOM **no sale por `dispatchEvent`** —ni en jsdom
// ni en el navegador—. `app/zona-fichero.js` ya atrapa lo que lance `alFichero` y
// lo manda al panel con `NIVEL.ERROR` y un mensaje genérico, que es lo correcto
// desde allí y es MUY POCO desde aquí: «algo se ha interrumpido» no le dice al
// usuario si el fichero no se pudo leer, si no era un GML o si el Catastro no
// contestó. Así que aquí **no se deja subir ni un fallo**: cada uno se atrapa donde
// ocurre, con su renglón, su mensaje en español y su detalle en consola (regla de
// oro 1). El `throw` se reserva —como en toda la casa— al contrato roto por el
// PROGRAMADOR: un nodo que falta en `index.html`, un cajón que no es el de F08.
//
// ── POR QUÉ «CONTRASTAR» NO CIERRA EL CAJÓN, Y QUIÉN LO CIERRA ──────────────
// El cajón no se cierra solo al pulsar el primario, y está razonado en
// `viewer/cajon-comprobacion.js#_alPulsarContrastar`: detrás de esa pulsación hay
// una petición al Catastro, y su renglón `role="status"` es la única superficie
// donde contar la espera. Cerrarlo en el clic dejaría la petición corriendo sin
// sitio donde decir «trayendo el parcelario…» ni dónde acabar si falla.
//
// **El cierre es de este módulo, y ocurre cuando el recorrido TERMINA** — en éxito
// y en fallo, que es la mitad que se olvida—: en cuanto la parcela está en el store
// el cajón ya no tiene nada que decir, y lo que hay que mirar es el mapa.
//
// ── LA EXCLUSIÓN MUTUA DE LOS DOS CAJONES, Y HASTA DÓNDE LLEGA ──────────────
// El cajón de comprobación y el de diagnóstico comparten la esquina `bottomleft`
// (las otras tres están ocupadas desde F06/F03; está medido y escrito en el JSDoc
// de `crearCajonDiagnostico`). Son mutuamente excluyentes POR DISEÑO, y ninguno de
// los dos se coordina con el otro: los dos exponen `abrir`/`cerrar`/`abierto` para
// que sea la capa de aplicación —esta— quien lo blinde, que es donde se sabe qué
// está pasando.
//
// Dos de los tres caminos quedan blindados aquí:
//   · **Cualquier `estado.set` cierra el de comprobación.** No solo el nuestro: si
//     llega una parcela del Catastro, o el usuario deshace una edición, este cajón
//     sobra. Es la guarda que ni una carrera puede saltarse, porque no depende de
//     que el recorrido llegue a su final.
//   · **Abrir el de comprobación cierra el de diagnóstico**, si se ha inyectado
//     (`cajonDiagnostico`). Soltar un fichero no es un clic, así que el guardián de
//     clic-fuera de F07 no se entera y su cajón se quedaría abierto debajo.
//
// **Y el tercero no, y se dice:** pulsar «Diagnosticar encaje» en el pie con el
// cajón de comprobación abierto abre el de F07 sin tocar el store, así que los dos
// quedarían apilados en vertical —legible, pero feo—. No se resuelve desde aquí
// porque la única forma sería escuchar el clic del CTA de otra feature, y un cable
// así se rompe en silencio el día que ese botón cambie de nombre. Queda declarado:
// {@link cablearComprobacion} devuelve `cerrar()` para que quien monte la pantalla
// pueda atarlo si algún día molesta.
//
// ── LO QUE ESTE MÓDULO **NO** HACE ──────────────────────────────────────────
//   · **No importa Leaflet ni toca el mapa.** El cajón entra ya construido
//     (`visor.comprobacion`) y se le habla por sus métodos.
//   · **No construye URLs ni sabe qué es una *stored query*.** Habla con
//     `services/catastro.js`, que ya clasifica con `TIPO_RESPUESTA_WFS` — y eso
//     importa aquí más que en ningún sitio: **el error del WFS llega con HTTP 200**
//     (override O14), así que `response.ok` no clasifica nada, y ramificar sobre el
//     texto libre del `ExceptionReport` está PROHIBIDO («no existe» y «vacío» no se
//     distinguen: el servicio usa el mismo código).
//   · **No juzga el fichero.** Traslada lo que midió `comprobacion/gml.js` (regla
//     de oro 9). La única decisión que toma es de CAPACIDAD: si hay o no hay
//     parcelario con el que contrastar.
//   · **No publica las notas del fichero en el panel de avisos.** Ya están en el
//     cajón, que es donde se leen; repetirlas sería contar dos veces lo mismo.
//
// Su test es `test/app/comprobacion.dom.test.js`, con sufijo `.dom`: toca el DOM.

import { comprobarGml } from '../comprobacion/gml.js'
import { husoPorSrs } from '../geo/huso.js'
import { decodificarGml } from '../gml/decodificar.js'
import { ORIGEN_PARCELA, crearParcela } from '../model/parcela.js'
import { normalizarRefcat } from '../services/catastro.js'
import { NIVEL } from '../viewer/_comun.js'
import { SELECTOR_CAMPO_REFCAT, SELECTOR_PROCEDENCIA, textoProcedencia } from './cableado-catastro.js'
import { crearZonaFichero } from './zona-fichero.js'

// ── Los selectores del contrato con `index.html` ─────────────────────────────

/**
 * «Abrir un GML…», el botón de la fila del rótulo que escribió T3.3. Abre el
 * selector de ficheros; el `<input type="file">` lo fabrica `app/zona-fichero.js`
 * y NO está en la cáscara (ver el comentario de `index.html` que lo razona).
 */
export const SELECTOR_BOTON_ABRIR = '[data-accion="abrir-gml"]'

/**
 * El renglón de procedencia, **el MISMO que escribe `cableado-catastro.js`**. Se
 * reexporta desde allí en vez de copiar el literal: hay un solo renglón de
 * procedencia en la pantalla porque hay un solo dato del que hablar (la parcela que
 * está cargada), y dos vías distintas para traerla. Dos nodos serían dos verdades
 * simultáneas sobre la misma parcela.
 */
export { SELECTOR_PROCEDENCIA }

/**
 * El campo «Referencia catastral», **el MISMO que escribe `cableado-catastro.js`**,
 * y se reexporta desde allí por la misma razón que el renglón de procedencia: hay UN
 * campo porque hay UNA parcela cargada, y dos vías distintas de traerla. Este módulo
 * lo escribe (ver {@link cablearComprobacion}) y no lo lee nunca: lo que hay tecleado
 * ahí no decide nada de este recorrido — el fichero es el que manda.
 */
export { SELECTOR_CAMPO_REFCAT }

/**
 * Extensiones que la zona de fichero acepta. `.xml` además de `.gml` porque hay
 * despachos que guardan el GML con esa extensión y el contenido es el mismo; quién
 * decide de verdad si es un GML es `gml/parse.js`, mirando dentro.
 */
export const EXTENSIONES = Object.freeze(['.gml', '.xml'])

// ── Mensajes ─────────────────────────────────────────────────────────────────

/**
 * Lo que se escribe en el renglón del cajón mientras la petición viaja. Es el
 * motivo de que «Contrastar» no cierre el cajón: sin esta superficie, el usuario
 * pulsaría un botón y no pasaría nada visible durante segundos.
 */
export const ESPERANDO_PARCELARIO = 'Trayendo el parcelario del Catastro…'

/**
 * Cola común de todos los motivos por los que la parcela entra SIN parcelario. Se
 * escribe una sola vez porque es lo que convierte una carencia en información
 * accionable: dice qué se pierde (el diagnóstico de encaje) y que lo demás sigue
 * en pie. El CTA de F07 escribirá además su propio motivo —`MOTIVO_SIN_OFICIAL` de
 * `app/cableado-diagnostico.js`—, que dice lo mismo desde el otro lado.
 */
export const COLA_SIN_PARCELARIO =
  'La parcela se carga igual con la geometría del fichero; lo único que no se podrá hacer es ' +
  'el diagnóstico de encaje, que necesita el contorno oficial para contrastar.'

/**
 * No hay a quién pedirle el parcelario. **No es un fallo**: es una pantalla montada
 * sin el cliente del Catastro, que es un uso legítimo (y es lo que pasa si el
 * cliente no se pudo construir al arrancar). Gemelo de `MOTIVO_SIN_CATASTRO` de
 * `cableado-diagnostico.js`.
 */
export const MOTIVO_SIN_CLIENTE =
  'No se ha pedido el parcelario al Catastro: esta pantalla no tiene conectado el cliente del ' +
  `servicio. ${COLA_SIN_PARCELARIO}`

/**
 * La pantalla se ha cerrado con la consulta en vuelo. **No lo lee nadie** —quien la
 * pidió comprueba `destruido` y se va sin escribir—, y aun así se redacta en español
 * y no se deja a `null`: el contrato de `traerParcelario` es que sin contorno hay
 * SIEMPRE un motivo, y una excepción a esa regla es como se acaba enseñando un
 * hueco donde tenía que haber una explicación.
 */
export const MOTIVO_CANCELADO =
  'La consulta del parcelario se ha cancelado porque la pantalla se ha cerrado mientras viajaba.'

/**
 * Lo que se le dice al usuario cuando el navegador no ha podido leer los bytes del
 * fichero. Es lo primero que puede fallar del recorrido y **no es culpa suya ni
 * del fichero**: el `File` que entrega el sistema es un puntero a algo que puede
 * haberse movido, renombrado o desmontado (un pendrive) entre que se eligió y que
 * se leyó.
 */
export const MENSAJE_FICHERO_NO_LEIDO =
  'No se ha podido leer el contenido del fichero. Suele pasar cuando se ha movido, renombrado o ' +
  'desconectado la unidad desde que se eligió: vuelve a abrirlo. No se ha cambiado nada.'

/**
 * Lo que se le dice al usuario cuando la comprobación revienta por un defecto de
 * programación. Mismo criterio —y mismas tres piezas: qué ha pasado, que no se ha
 * cambiado nada, y dónde está el detalle— que `MENSAJE_FALLO_INESPERADO` de
 * `app/main.js`, de `cableado-catastro.js` y de `cableado-diagnostico.js`.
 *
 * Que exista este mensaje no es defensa de más: `comprobarGml` promete no lanzar
 * por un fichero malo, pero `crearParcela` sí lanza si la geometría leída rompe un
 * invariante del modelo, y ese camino tiene que acabar en algún sitio que el
 * usuario pueda leer.
 */
export const MENSAJE_FALLO_INESPERADO =
  'La comprobación del fichero se ha interrumpido por un fallo interno de la aplicación; no se ' +
  'ha cambiado nada. El detalle técnico está en la consola del navegador.'

/**
 * Lo que se le dice al usuario cuando revienta el gancho `alCargarParcela`, o sea
 * lo que estaba PENDIENTE de la parcela y no la parcela. Gemelo —y por el mismo
 * motivo— de `MENSAJE_SUSCRIPTOR_ROTO` de `cableado-catastro.js`: el fichero se
 * leyó, la parcela entró en el store y decir «la comprobación se ha interrumpido»
 * culparía al fichero de un defecto de esta casa.
 */
export const MENSAJE_SUSCRIPTOR_ROTO =
  'La parcela del fichero ha entrado bien, pero algo que estaba pendiente de ella se ha ' +
  'interrumpido por un fallo interno. El detalle técnico está en la consola del navegador.'

/**
 * Por qué no se le puede pedir el parcelario al Catastro con lo que trae el
 * fichero. **Las tres formas de «no hay referencia» se dicen distinto porque
 * significan cosas distintas**, y las tres están medidas sobre ficheros reales:
 *
 *   · `''` — el elemento `cp:nationalCadastralReference` **está y viene vacío**. Es
 *     el caso de `UTM_1.gml` (un alta de particular, `ES.LOCAL.CP`) y el de la
 *     plantilla oficial del propio Catastro, `cp_ejemplo_explicativo.gml`. El
 *     fichero afirma «esta parcela todavía no tiene referencia».
 *   · `null` — el elemento **no está**. El fichero no dice nada al respecto.
 *   · Cualquier otra cosa que `normalizarRefcat` no reconozca: hay algo escrito y
 *     no tiene forma de referencia catastral.
 *
 * ⚠️ Y lo que NO se hace, que es lo importante: **no se recurre al `localId`**.
 * Parece un respaldo razonable y es una trampa medida — el `localId` de
 * `UTM_1.gml` es `8703362TF9980S0001SH`, que tiene exactamente la forma de una
 * referencia de INMUEBLE, así que `normalizarRefcat` la aceptaría y la recortaría a
 * `8703362TF9980S`. Se pediría al Catastro una parcela que nadie ha afirmado que
 * sea ésta, y su contorno entraría en el expediente como término de comparación.
 * Un identificador local es local: no es una referencia catastral.
 *
 * @param {string|null} refcatCruda  `miembros[elegido].refcat`, TAL CUAL.
 * @returns {string}
 */
export function motivoSinReferencia(refcatCruda) {
  if (refcatCruda === null) {
    return (
      'El fichero no trae referencia catastral, así que no hay ninguna parcela que pedirle al ' +
      `Catastro para contrastar. ${COLA_SIN_PARCELARIO}`
    )
  }
  if (refcatCruda.trim() === '') {
    return (
      'El fichero trae la referencia catastral VACÍA (el elemento está, pero sin nada dentro): ' +
      'es lo que hace un alta de parcela que todavía no la tiene. No hay nada que pedirle al ' +
      `Catastro. ${COLA_SIN_PARCELARIO}`
    )
  }
  return (
    `Lo que el fichero declara como referencia catastral, «${refcatCruda}», no tiene forma de ` +
    'referencia catastral de parcela (14 caracteres, letras y números), así que no se le pide ' +
    `nada al Catastro con ella. ${COLA_SIN_PARCELARIO}`
  )
}

/**
 * Por qué no se pide el parcelario cuando el fichero trabaja en OTRO sistema de
 * referencia que el expediente.
 *
 * No es celo: es la regla de oro 3 y el mismo razonamiento que `porQueNoSirve` de
 * `cableado-catastro.js`. El parcelario se pediría en un huso y las coordenadas del
 * fichero estarían en otro, así que el contraste mediría la distancia entre dos
 * sitios de la Península — cientos de kilómetros— y la presentaría como si fuera la
 * desviación del lindero. Un número enorme y perfectamente calculado, que es la
 * peor clase de mentira que puede dar esta aplicación.
 *
 * La geometría del fichero **sí entra**: el usuario ha pedido verla y el visor
 * dibuja en el huso del expediente, así que se le enseña y se le dice.
 *
 * @param {string} srsFichero
 * @param {string} srsExpediente
 * @returns {string}
 */
export function motivoSrsAjeno(srsFichero, srsExpediente) {
  return (
    `El fichero declara ${srsFichero} y este expediente trabaja en ${srsExpediente}. No se pide ` +
    'el parcelario: se traería en un sistema de referencia distinto del de la geometría del ' +
    'fichero, y contrastar los dos daría una desviación de cientos de kilómetros con pinta de ' +
    'medida. La geometría del fichero se carga igual, pero se dibujará con el huso del ' +
    `expediente. ${COLA_SIN_PARCELARIO}`
  )
}

/**
 * Por qué no sirve lo que el Catastro ha contestado, aunque haya contestado bien.
 * Dos casos, los mismos dos que mira `cableado-catastro.js#porQueNoSirve` — y aquí
 * la consecuencia es MENOR y por eso el texto es otro: allí no se carga nada,
 * aquí se carga la parcela del fichero y lo único que se pierde es el parcelario.
 *
 * @param {import('../gml/parse.js').ParcelaGml} p  Lo que ha devuelto el WFS.
 * @param {string} srsExpediente
 * @returns {string|null}  El motivo, o `null` si sirve.
 */
function porQueNoSirveElParcelario(p, srsExpediente) {
  if (p.srs !== null && p.srs !== srsExpediente) {
    return (
      `El Catastro ha devuelto el parcelario en ${p.srs} y este expediente trabaja en ` +
      `${srsExpediente}. No se usa como contorno oficial: mezclar dos sistemas de referencia ` +
      `colocaría el lindero a kilómetros de donde está, y sin dar ningún error. ` +
      `${COLA_SIN_PARCELARIO}`
    )
  }
  if (p.recintos.length === 0) {
    return (
      'El Catastro ha contestado con una parcela sin geometría: no trae ni un solo contorno con ' +
      `el que contrastar. ${COLA_SIN_PARCELARIO}`
    )
  }
  return null
}

/**
 * El renglón de procedencia cuando la parcela viene de un fichero. **Es la pieza de
 * este módulo que más importa que esté bien redactada.**
 *
 * La procedencia de esta parcela es DOBLE y las dos mitades tienen dueños
 * distintos: la geometría la escribió otro técnico con otro programa, y el
 * parcelario lo emite el Catastro. Un renglón que dijera «Del Catastro» a secas
 * —que es exactamente lo que escribe `cableado-catastro.js` cuando la parcela sí
 * viene del servicio— convertiría el fichero de un tercero en un dato oficial, y
 * ése es el error de producto de toda esta fase: a partir de ahí el usuario mira
 * una geometría ajena creyendo que es la del Catastro, y firma sobre ella.
 *
 * Por eso el orden es el que es: **primero de dónde viene la geometría**, que es el
 * dato que se dibuja y el que se va a generar, y después el parcelario, rotulado
 * como lo que es —un término de comparación—.
 *
 * La mitad del Catastro no se redacta aquí: se reutiliza `textoProcedencia` de
 * `cableado-catastro.js` **tal cual**, con su hora y con la edad de la copia local.
 * Dos redacciones del mismo hecho divergen, y la que se queda vieja siempre es la
 * nueva.
 *
 * @param {object} args
 * @param {string} args.nombreFichero
 * @param {import('../services/catastro.js').ProcedenciaCatastro|null} args.procedencia
 *   La del resultado del Catastro, o `null` si no hay parcelario.
 * @param {Date} args.instante  El «ahora» del cableado (inyectable).
 * @param {string|null} args.sinParcelario  Por qué no hay parcelario; `null` si lo hay.
 * @returns {string}
 */
export function textoProcedenciaDoble({ nombreFichero, procedencia, instante, sinParcelario }) {
  const geometria = `Geometría del fichero «${nombreFichero}», NO del Catastro.`
  if (procedencia === null) {
    return `${geometria} Sin parcelario con el que contrastarla: ${sinParcelario}`
  }
  return `${geometria} Parcelario, solo para contrastar: ${textoProcedencia(procedencia, instante)}`
}

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO, así que un
 * selector que no encuentra nada es un bug del programador y no un dato malo: se
 * lanza y **se nombra el selector**. Tercer gemelo del de `cableado-catastro.js` y
 * el de `cableado-diagnostico.js`; siguen siendo tres copias de cuatro líneas
 * porque cada mensaje nombra su propio fichero, que es la mitad de lo que sirve.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error} Si la cáscara no tiene ese nodo.
 */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/cableado-comprobacion.js: la cáscara no tiene ningún nodo '${selector}'. El marcado ` +
        `de index.html es contrato de este cableado (y de estilos/app.css): si se ha renombrado ` +
        `o movido ese nodo, hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── Lecturas del modelo ──────────────────────────────────────────────────────

/** Texto no vacío, o `null`. `''` y `'   '` son «no consta», no un identificador. */
function textoNoVacio(v) {
  if (typeof v !== 'string') return null
  const limpio = v.trim()
  return limpio === '' ? null : limpio
}

/**
 * El `idLocal` con el que la parcela del fichero entra en el modelo. `crearParcela`
 * lo exige no vacío porque de él sale el `inspireId` del GML que se genere después.
 *
 * El orden es el del propio documento: primero el `localId` que el fichero declara
 * —que es literalmente ese campo—, después la referencia catastral, y solo si no
 * hay ninguno de los dos, el nombre del fichero. Ese último recurso no es bonito y
 * es preferible a lo alternativo: inventar un identificador («parcela-1») que no
 * aparece en ningún sitio, o negarse a cargar una geometría que el usuario tiene
 * delante y quiere ver.
 *
 * @param {{localId: string|null}} miembro
 * @param {string|null} refcat  Ya normalizada.
 * @param {string} nombreFichero
 * @returns {string}
 */
function idLocalDe(miembro, refcat, nombreFichero) {
  return textoNoVacio(miembro.localId) ?? refcat ?? textoNoVacio(nombreFichero) ?? 'parcela-de-fichero'
}

// ── Contratos de las dependencias ────────────────────────────────────────────

/** ¿Sirve como store? DUCK TYPING, igual que en `viewer/index.js#esStore`. */
const esStore = (v) =>
  !!v && typeof v.get === 'function' && typeof v.set === 'function' && typeof v.subscribe === 'function'

/** ¿Es el cajón de `viewer/cajon-comprobacion.js`? Se comprueba lo que se USA. */
const esCajon = (v) =>
  !!v &&
  typeof v.pintar === 'function' &&
  typeof v.abrir === 'function' &&
  typeof v.cerrar === 'function' &&
  typeof v.estado === 'function' &&
  typeof v.alElegir === 'function' &&
  typeof v.alContrastar === 'function' &&
  typeof v.alDescartar === 'function'

/**
 * ¿Sirve como cajón al que cerrar? Solo `cerrar`, que es lo único que se le pide al
 * de diagnóstico. Pedirle su API entera acoplaría este módulo a F07 sin ninguna
 * necesidad.
 */
const esCerrable = (v) => !!v && typeof v.cerrar === 'function'

/** ¿Sirve como cliente del Catastro? Solo lo que este módulo le pide. */
const esCliente = (v) => !!v && typeof v.parcelaPorRefcat === 'function'

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Cablea el recorrido de comprobación de un GML existente: la entrada por fichero,
 * el cajón del mapa, la petición del parcelario y el único `estado.set`.
 *
 * ```js
 * const visor = crearVisor(el, { estado, tablaEl, srs, diagnostico: true, comprobacion: true })
 * const comp = cablearComprobacion({
 *   estado,
 *   cajon: visor.comprobacion,
 *   panel,
 *   cliente,                                  // el de services/catastro.js
 *   srs: SRS_DEMO,
 *   cajonDiagnostico: visor.diagnostico.cajon,
 *   alCargarParcela: edicionCableada.alCargarParcela,
 * })
 * // … al cerrar la pantalla:
 * comp.destruir()
 * ```
 *
 * @param {Object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El MISMO store
 *   que el mapa, la tabla y la ficha. Se LEE, se ESCUCHA y se ESCRIBE **una sola
 *   vez por recorrido**.
 * @param {ReturnType<import('../viewer/cajon-comprobacion.js').crearCajonComprobacion>} opciones.cajon
 *   `visor.comprobacion`. Si vale `null`, el visor se montó sin `comprobacion: true`.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos: por él
 *   sale todo lo que este módulo decide y todo lo que le falla.
 * @param {string} opciones.srs  SRS del expediente (`'EPSG:25830'`…). Se valida al
 *   cablear —con `husoPorSrs`, que es el único sitio del proyecto que sabe qué husos
 *   están implementados—, no en el primer fichero.
 * @param {{parcelaPorRefcat: Function}|null} [opciones.cliente=null]  El de
 *   `services/catastro.js#crearClienteCatastro`. `null` ⇒ no se pide parcelario y se
 *   DICE ({@link MOTIVO_SIN_CLIENTE}): es un uso legítimo, no una degradación
 *   callada. **No se crea uno por defecto**, por lo mismo que en `cablearCatastro`:
 *   decidiría por el llamante el transporte, la caché y el reloj, y en un test
 *   tocaría la red de verdad.
 * @param {{cerrar: Function}|null} [opciones.cajonDiagnostico=null]  El cajón de F07
 *   (`visor.diagnostico.cajon`), solo para CERRARLO al abrir el de comprobación: los
 *   dos comparten esquina. `null` ⇒ no hay ninguno que cerrar.
 * @param {((parcela: object) => void)|null} [opciones.alCargarParcela=null]  Se llama
 *   DESPUÉS del `estado.set`, con el POJO que ha entrado. Mismo contrato y mismo
 *   gancho que el de `cablearCatastro`: cargar una parcela de un fichero es abrir un
 *   documento nuevo, así que el historial de edición se REINICIA en vez de commitear
 *   encima (ver `app/main.js#cablearEdicion`). Sin él, el módulo funciona igual.
 * @param {Window} [opciones.ventana=globalThis]  La ventana sobre la que se puede
 *   soltar el fichero. Se inyecta por lo mismo que en `crearZonaFichero`.
 * @param {HTMLElement} [opciones.boton]  Por defecto {@link SELECTOR_BOTON_ABRIR}.
 * @param {HTMLElement} [opciones.procedencia]  Ídem {@link SELECTOR_PROCEDENCIA}.
 * @param {HTMLInputElement} [opciones.campo]  Ídem {@link SELECTOR_CAMPO_REFCAT}. Se
 *   ESCRIBE al cargar la parcela y no se lee jamás: ver el bloque de {@link contrastar}.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora». Se inyecta porque la
 *   hora sale POR PANTALLA en el renglón de procedencia, y un módulo que lee el
 *   reloj del sistema no es reproducible.
 * @returns {{comprobar: (fichero: File) => Promise<void>,
 *            contrastar: () => Promise<void>,
 *            comprobacion: () => object|null,
 *            cerrar: () => void,
 *            destruir: () => void}}
 * @throws {TypeError}  Contrato del programador.
 * @throws {RangeError}  Si el `srs` no es un huso soportado (vía `husoPorSrs`).
 * @throws {Error}  Si la cáscara no trae los dos nodos del contrato.
 */
export function cablearComprobacion({
  estado,
  cajon,
  panel,
  srs,
  cliente = null,
  cajonDiagnostico = null,
  alCargarParcela = null,
  ventana = globalThis,
  boton = nodo(SELECTOR_BOTON_ABRIR),
  procedencia = nodo(SELECTOR_PROCEDENCIA),
  campo = nodo(SELECTOR_CAMPO_REFCAT),
  ahora = () => new Date(),
} = {}) {
  if (!esStore(estado)) {
    throw new TypeError(
      `cablearComprobacion: 'estado' debe ser el store de crearEstadoVista ` +
        `({get, set, subscribe}); recibido ${typeof estado}.`,
    )
  }
  if (!esCajon(cajon)) {
    throw new TypeError(
      `cablearComprobacion: 'cajon' debe ser el de viewer/cajon-comprobacion.js ` +
        `(lo devuelve crearVisor en visor.comprobacion); recibido ${typeof cajon}. Si vale null, ` +
        `el visor se montó sin 'comprobacion: true'.`,
    )
  }
  if (!panel || typeof panel.avisar !== 'function') {
    throw new TypeError(
      `cablearComprobacion: 'panel' debe ser el panel de avisos (con 'avisar'); recibido ` +
        `${typeof panel}. Sin él, un fichero que no se puede leer no tendría dónde contarse.`,
    )
  }
  if (cliente !== null && !esCliente(cliente)) {
    throw new TypeError(
      `cablearComprobacion: 'cliente' debe ser el de services/catastro.js#crearClienteCatastro ` +
        `(con parcelaPorRefcat), o null para no pedir el parcelario; recibido ${typeof cliente}.`,
    )
  }
  if (cajonDiagnostico !== null && !esCerrable(cajonDiagnostico)) {
    throw new TypeError(
      `cablearComprobacion: 'cajonDiagnostico' debe ser el cajón de F07 (visor.diagnostico.cajon, ` +
        `con 'cerrar'), o null si no hay ninguno; recibido ${typeof cajonDiagnostico}.`,
    )
  }
  if (alCargarParcela !== null && typeof alCargarParcela !== 'function') {
    throw new TypeError(
      `cablearComprobacion: 'alCargarParcela' debe ser una función (se le pasa el POJO de la ` +
        `parcela que acaba de entrar en el store) o null si no hace falta; recibido ` +
        `${typeof alCargarParcela}.`,
    )
  }
  // Delegado: `husoPorSrs` es el único sitio del proyecto que sabe qué husos están
  // implementados y cuál está diferido (Canarias, override O13). Lanza solo.
  husoPorSrs(srs)

  let destruido = false

  /**
   * El fichero que se está comprobando, con TODO lo que hace falta para volver a
   * comprobarlo con otro índice sin releer nada del disco. `null` = no hay ninguno.
   *
   * @type {{nombre: string, bytes: number, texto: string, detecciones: Array,
   *   encodingUsado: string}|null}
   */
  let fuente = null

  /** La última {@link import('../comprobacion/gml.js').Comprobacion}, o `null`. */
  let comprobacion = null

  /** Una petición de parcelario en vuelo: la segunda pulsación no encabalga. */
  let contrastando = false

  // ── Los fallos, cada uno contado donde ocurre ──────────────────────────────

  /**
   * Cuenta un fallo INESPERADO por los dos canales de la casa y **no lo deja
   * subir**: este camino se alcanza desde un oyente del DOM, donde una excepción no
   * llega a ninguna parte (ver la cabecera).
   *
   * @param {string} donde  Para la consola, no para el usuario.
   * @param {*} causa
   * @param {string} [mensaje]
   */
  function reventar(donde, causa, mensaje = MENSAJE_FALLO_INESPERADO) {
    panel.avisar(mensaje, { nivel: NIVEL.ERROR, causa })
    console.error(`[comprobacion] ${donde}:`, causa)
  }

  /**
   * Avisa de que ha entrado en el store una parcela leída de un fichero. Se llama
   * desde {@link contrastar} y desde ningún otro sitio, y **el último**: quien
   * escuche se encuentra la pantalla ya coherente. Si revienta, lo de arriba ya
   * está hecho — una parcela cargada no se deshace porque falle un oyente.
   *
   * @param {object} parcela
   */
  function notificarCarga(parcela) {
    if (alCargarParcela === null || destruido) return
    try {
      alCargarParcela(parcela)
    } catch (causa) {
      reventar('el aviso de parcela cargada (alCargarParcela) ha fallado', causa, MENSAJE_SUSCRIPTOR_ROTO)
    }
  }

  // ── 1 · Del fichero al cajón ───────────────────────────────────────────────

  /**
   * Comprueba un `File` y enseña el resultado. **No lanza nunca**: cada tramo del
   * recorrido tiene su propio `catch` con su mensaje, porque «no ha pasado nada» es
   * lo único que el usuario no puede interpretar.
   *
   * @param {File} fichero
   * @returns {Promise<void>}
   */
  async function comprobar(fichero) {
    if (destruido) return

    const nombre = typeof fichero?.name === 'string' ? fichero.name : 'fichero sin nombre'

    /** @type {ArrayBuffer} */
    let crudo
    try {
      crudo = await fichero.arrayBuffer()
    } catch (causa) {
      panel.avisar(MENSAJE_FICHERO_NO_LEIDO, { nivel: NIVEL.ERROR, causa })
      console.error(`[comprobacion] no se han podido leer los bytes de «${nombre}»:`, causa)
      return
    }
    if (destruido) return

    try {
      // ⚠️ `new Uint8Array(...)` y no el búfer a pelo, y no es cosmética: la vista
      // se construye con el `Uint8Array` de ESTE realm, que es el mismo que el
      // `instanceof` de `gml/decodificar.js#aBytes`. Un búfer que venga de otro
      // realm —jsdom, un iframe— no pasaría ese `instanceof` y la función lanzaría
      // diciendo que le han pasado un `object`. Está medido en la suite `.dom`.
      const datos = new Uint8Array(crudo)
      const { texto, encodingUsado, detecciones } = decodificarGml(datos)
      fuente = { nombre, bytes: datos.byteLength, texto, detecciones, encodingUsado }
      pintar(0)
    } catch (causa) {
      fuente = null
      comprobacion = null
      reventar(`la comprobación de «${nombre}» ha fallado`, causa)
      return
    }

    // El de diagnóstico comparte esquina con éste (ver la cabecera). Se cierra ANTES
    // de abrir: soltar un fichero no es un clic, así que su guardián de clic-fuera
    // no se entera y se quedarían los dos apilados.
    if (cajonDiagnostico !== null) cajonDiagnostico.cerrar()
    cajon.abrir()
  }

  /**
   * Recomprueba el fichero en memoria con el índice pedido y lo pinta. Es el punto
   * único: lo comparten la primera lectura y cada cambio de radio, para que no haya
   * dos formas de calcular lo mismo.
   *
   * @param {number} indice
   */
  function pintar(indice) {
    comprobacion = comprobarGml({
      texto: fuente.texto,
      nombreFichero: fuente.nombre,
      bytes: fuente.bytes,
      deteccionesPrevias: fuente.detecciones,
      encodingUsado: fuente.encodingUsado,
      indiceElegido: indice,
    })
    cajon.pintar(comprobacion)
  }

  /**
   * El usuario ha marcado otra parcela de un fichero multiparcela. Se recomprueba
   * ENTERA con ese índice y no se «ajusta» lo pintado: las cuatro comprobaciones de
   * F08 (superficie, huso, geometría, orientación) son de la parcela elegida, y
   * repintar solo las cifras dejaría los hallazgos de la anterior debajo.
   *
   * @param {number} indice
   */
  function elegir(indice) {
    if (destruido || fuente === null) return
    try {
      pintar(indice)
    } catch (causa) {
      reventar(`la comprobación de la parcela nº ${indice + 1} ha fallado`, causa)
    }
  }

  // ── 2 · Del cajón al store, pasando por el Catastro ────────────────────────

  /**
   * El parcelario de la parcela elegida, o el motivo de que no lo haya. **Nunca
   * lanza y nunca deja las dos cosas a `null`**: o trae contorno o trae motivo.
   *
   * Aquí está el override O14 en una línea: no se mira ningún `response.ok` ni se
   * lee el texto del `ExceptionReport`. Se pregunta a `services/catastro.js`, que ya
   * clasificó con `TIPO_RESPUESTA_WFS`, y se cuenta lo que diga.
   *
   * **No avisa por el panel, y es a propósito**: devuelve el motivo y lo publica
   * {@link contrastar}, en UN solo sitio. Repartir la publicación entre las dos
   * funciones dejaba al usuario la misma frase dos veces (el panel las agrupa, así
   * que ni siquiera se vería el fallo: se vería un «×2» inexplicable).
   *
   * @param {import('../comprobacion/gml.js').MiembroComprobado} miembro
   * @param {string} srsFichero
   * @returns {Promise<{oficial: Array|null, areaValue: number|null,
   *   procedencia: object|null, motivo: string|null}>}
   */
  async function traerParcelario(miembro, srsFichero) {
    const sin = (motivo) => ({ oficial: null, areaValue: null, procedencia: null, motivo })

    const refcat = normalizarRefcat(miembro.refcat)
    if (refcat === null) return sin(motivoSinReferencia(miembro.refcat))
    if (cliente === null) return sin(MOTIVO_SIN_CLIENTE)
    if (srsFichero !== srs) return sin(motivoSrsAjeno(srsFichero, srs))

    cajon.estado(ESPERANDO_PARCELARIO)

    let resultado
    try {
      resultado = await cliente.parcelaPorRefcat(refcat, { srs })
    } catch (causa) {
      // Los motivos del catálogo salen por `ok:false`; lo que llega aquí es un fallo
      // INESPERADO del cliente. Ya se ha contado por consola; el recorrido sigue.
      console.error('[comprobacion] la consulta del parcelario ha reventado:', causa)
      return sin(
        'La consulta del parcelario al Catastro se ha interrumpido por un fallo interno; el ' +
          `detalle técnico está en la consola del navegador. ${COLA_SIN_PARCELARIO}`,
      )
    }
    if (destruido) return sin(MOTIVO_CANCELADO)

    if (!resultado.ok) {
      // El mensaje del servicio se arrastra ÍNTEGRO y no se interpreta (trampa 3 de
      // `services/catastro.js`): «esa referencia no existe» y «no hay nada en esa
      // zona» llegan con el mismo código y no se distinguen.
      return sin(`${resultado.mensaje} ${COLA_SIN_PARCELARIO}`)
    }

    const estorbo = porQueNoSirveElParcelario(resultado.datos, srs)
    if (estorbo !== null) return sin(estorbo)

    return {
      oficial: resultado.datos.recintos,
      // `areaValue` es la superficie que el CATASTRO declara, y por eso se coge de
      // aquí y no del fichero. La que declara el fichero ya la enseña el cajón como
      // «superficie declarada», y son dos números distintos con el mismo nombre
      // coloquial: atribuirle al Catastro el número de un tercero es exactamente lo
      // que C1 existe para no hacer.
      areaValue: resultado.datos.areaValue,
      procedencia: resultado.procedencia,
      motivo: null,
    }
  }

  /**
   * «Contrastar con el parcelario»: pide el parcelario, compone la parcela con las
   * DOS geometrías y la mete en el store. **Un solo `estado.set`.**
   *
   * `recintos` son los del FICHERO y `geometriaOficial` el del Catastro, y ése es
   * todo el sentido de esta tarea: si se llamara a `cablearCatastro().cargar()`, el
   * `estado.set` de allí metería la geometría del WFS en los dos sitios y borraría
   * la del fichero — justo lo que hay que contrastar.
   *
   * @returns {Promise<void>}
   */
  async function contrastar() {
    if (destruido || contrastando) return
    const c = comprobacion
    if (c === null) return
    if (!c.puedeContinuar || c.geometria === null || c.elegido === null) {
      // El cajón ya tiene el botón apagado con este mismo motivo escrito; llegar
      // aquí solo es posible desde la API. Se repite el motivo y no se inventa otro.
      cajon.estado(c.motivoNoContinua ?? '')
      return
    }

    contrastando = true
    try {
      const miembro = c.miembros[c.elegido]
      const refcat = normalizarRefcat(miembro.refcat)
      const { oficial, areaValue, procedencia: deDonde, motivo } = await traerParcelario(
        miembro,
        c.geometria.srs,
      )
      if (destruido) return

      const parcela = crearParcela({
        idLocal: idLocalDe(miembro, refcat, c.fichero.nombre),
        refcat,
        recintos: c.geometria.recintos,
        geometriaOficial: oficial,
        superficieCatastral: areaValue,
        origen: ORIGEN_PARCELA.GML_EXISTENTE,
      })

      // EL ÚNICO `set` del recorrido. Su suscriptor cierra este cajón (ver la
      // cabecera), así que a partir de esta línea el cajón ya no se ve.
      estado.set(parcela)

      // ── EL CAMPO DICE LO MISMO QUE EL MODELO. SIEMPRE, Y TAMBIÉN CUANDO ES «NADA»
      //
      // La forma que se escribe es la CANÓNICA —la que ha entrado en el modelo—, y
      // nunca la cadena cruda del fichero: es el razonamiento de
      // `cableado-catastro.js#aplicar`, que aquí vale igual. «9398516 vk3799g» y
      // «9398516VK3799G» son la misma parcela, y dejar en pantalla una forma
      // distinta de la del modelo invita a dudar de cuál se ha cargado.
      //
      // **Sin referencia utilizable el campo se VACÍA; no se deja como estaba.** Es
      // la única diferencia con la vía del Catastro, y es deliberada. Allí `null`
      // significa «el servicio no ha confirmado lo que TECLEASTE», y lo tecleado es
      // del usuario: borrárselo sería quitarle de las manos lo que estaba
      // intentando. Aquí no hay nada tecleado que respetar — hay un fichero que
      // afirma que esta parcela no tiene referencia (`''`: el elemento está y viene
      // vacío, que es el caso de `UTM_1.gml` y el de la plantilla oficial de alta
      // `cp_ejemplo_explicativo.gml`) o que no dice ninguna (`null`).
      //
      // Dejar ahí la referencia ANTERIOR sería peor que el hueco: el campo estaría
      // hablando de una parcela que ya no está en pantalla. Y sería exactamente la
      // contradicción que este bloque existe para cerrar, del revés — los botones
      // derivados («Deducir del mapa», «Traer colindantes») se encienden mirando el
      // MODELO y no el campo, así que una referencia huérfana dejaría «Deducir del
      // mapa» encendido al lado de una referencia perfectamente escrita, que es lo
      // único que ese botón promete que NO hace falta.
      //
      // Y esto es PINTAR, no consultar: escribir el campo no dispara ninguna
      // petición. La consulta ya se hizo arriba —o se decidió no hacerla— y quedó
      // contada; la referencia que se escribe es la que ya está en el store.
      campo.value = parcela.refcat ?? ''

      procedencia.textContent = textoProcedenciaDoble({
        nombreFichero: c.fichero.nombre,
        procedencia: deDonde,
        instante: ahora(),
        sinParcelario: motivo,
      })

      if (motivo !== null) {
        // Va también al panel: el renglón de procedencia es gris de 11 px y «solo se
        // lee cuando se duda del dato», mientras que quedarse sin parcelario cambia
        // lo que se puede hacer a continuación.
        panel.avisar(motivo, { nivel: NIVEL.AVISO })
      }

      cerrar()
      notificarCarga(parcela)
    } catch (causa) {
      // `crearParcela` lanza si la geometría leída rompe un invariante del modelo, y
      // ese camino no puede acabar en un cajón mudo.
      cajon.estado('La parcela no se ha cargado. El motivo está en el panel de avisos.')
      reventar('el contraste con el parcelario ha fallado', causa)
    } finally {
      contrastando = false
    }
  }

  /**
   * «Descartar». El cajón se cierra solo (lo hace la vista, porque es una decisión
   * instantánea y sin consecuencias que contar); lo que hace este módulo es SOLTAR
   * el fichero, para que no se quede un documento cargado en memoria al que ya no
   * se puede volver desde ninguna parte de la interfaz.
   */
  function descartar() {
    if (destruido) return
    fuente = null
    comprobacion = null
    cajon.pintar(null)
  }

  /** Cierra el cajón. Idempotente por parte de la vista. */
  function cerrar() {
    if (!destruido) cajon.cerrar()
  }

  // ── Oyentes ────────────────────────────────────────────────────────────────

  /**
   * La entrega del fichero. **Suelta la promesa a propósito y no puede lanzar**: lo
   * que hay dentro de `comprobar` ya se cuenta por el panel y por la consola antes
   * de resolverse, y una excepción aquí acabaría en el `catch` genérico de
   * `zona-fichero.js`, con un mensaje que no dice qué ha pasado (ver la cabecera).
   *
   * @param {File} fichero
   */
  const alFichero = (fichero) => {
    comprobar(fichero).catch((causa) => {
      reventar('la comprobación del fichero ha fallado fuera de todo control', causa)
    })
  }

  /** Ídem para el primario del cajón. */
  const alContrastar = () => {
    contrastar().catch((causa) => {
      reventar('el contraste ha fallado fuera de todo control', causa)
    })
  }

  /**
   * El suscriptor del store: **cualquier `estado.set` cierra este cajón**. No solo
   * el nuestro, y ahí está la gracia — es la guarda que no depende de que el
   * recorrido llegue a su final, así que ni una carrera puede dejar los dos cajones
   * de `bottomleft` abiertos a la vez.
   *
   * No mira QUÉ ha entrado: una parcela nueva, una edición o un `undo` hacen todos
   * que lo que este cajón enseña sea de otro momento.
   */
  const alCambiarElStore = () => {
    if (!destruido) cajon.cerrar()
  }

  const zona = crearZonaFichero({
    boton,
    ventana,
    extensiones: [...EXTENSIONES],
    alFichero,
    alAviso: panel.avisar,
  })

  const bajaElegir = cajon.alElegir(elegir)
  const bajaContrastar = cajon.alContrastar(alContrastar)
  const bajaDescartar = cajon.alDescartar(descartar)
  const desuscribirStore = estado.subscribe(alCambiarElStore)

  return {
    /** Comprueba un `File` como si el usuario lo hubiera soltado. No lanza. */
    comprobar,

    /** Dispara «Contrastar» sin pasar por el botón. No lanza. */
    contrastar,

    /** La última comprobación pintada, o `null`. Solo para leer. */
    comprobacion: () => comprobacion,

    cerrar,

    /**
     * Deja el cableado inerte: retira la zona de fichero (con sus oyentes de la
     * VENTANA, que sobrevivirían a la pantalla), las tres suscripciones del cajón y
     * la del store, y cierra el cajón. IDEMPOTENTE.
     *
     * No destruye el cajón: es del VISOR y lo desmonta `visor.destruir()`. Este
     * módulo desmonta lo que ha montado él, ni más ni menos — la misma regla que
     * hace que `crearVisor` sea atómico.
     */
    destruir() {
      if (destruido) return
      destruido = true
      zona.destruir()
      bajaElegir()
      bajaContrastar()
      bajaDescartar()
      desuscribirStore()
      cajon.cerrar()
      fuente = null
      comprobacion = null
    },
  }
}

export default cablearComprobacion

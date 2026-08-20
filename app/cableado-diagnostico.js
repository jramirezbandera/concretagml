// app/cableado-diagnostico.js — F07 · T4.3. EL CABLE entre el diagnóstico y la app.
//
// `diagnostico/` sabe medir el encaje, `viewer/cajon-diagnostico.js` sabe enseñarlo
// y `viewer/contraste.js` sabe señalarlo en el mapa. Ninguno de los tres conoce el
// store, el Catastro ni el CTA del pie: este fichero es lo que los une, igual que
// `app/cableado-catastro.js` hizo con F05 y `cablearEdicion` con F06.
//
// Su anatomía es la de aquel a propósito —selectores exportados, nodos resueltos
// con `throw` si faltan, dependencias inyectables, `destruir()` idempotente—: quien
// llegue después reconoce el patrón sin leerlo entero.
//
// ── LAS SEIS COSAS DE LAS QUE ES DUEÑO ──────────────────────────────────────
//
//   1. **EL CTA.** Encendido ⟺ hay `geometriaOficial` en el store. Y cuando queda
//      apagado se ESCRIBE EL MOTIVO: un botón gris y mudo es un error silencioso
//      (regla de oro 1). Ver {@link MOTIVO_SIN_OFICIAL}.
//   2. **LAS COLINDANTES.** Al abrir, si no hay vecinas, UNA llamada a
//      `catastro.colindantes()`. Una apertura, una petición (override O8). Y lo
//      que llega por ese canal **se coteja con la parcela que hay en pantalla**
//      antes de adoptarse: ver {@link cablearDiagnostico}`#adoptar`.
//   3. **LA TRADUCCIÓN** `ParcelaGml[] → [{refcat, recintos}]`, que es lo que come
//      `diagnostico/parcela.js`.
//   4. **EL ESTADO DEL EXPEDIENTE**: la superficie registral y la clase de suelo
//      sobreviven a las ediciones y se REINICIAN con cada parcela distinta.
//   5. **EL RECÁLCULO**: por el store (una vez por operación acabada) y por los dos
//      campos del cajón. **Nunca por `alPrevisualizar`.**
//   6. **EL INFORME DE CONTRASTE** (F08 · T4.2): compone el texto con
//      `report/contraste-texto.js` y lo entrega con `gml/descargar.js#descargarTexto`
//      cuando se pulsa el botón del PIE del cajón. Ver el bloque de abajo.
//
// ── F08 · EL INFORME: QUIÉN PONE CADA PIEZA ─────────────────────────────────
// El botón vive DENTRO del cajón —las tres razones están escritas en
// `viewer/cajon-diagnostico.js`, que es donde se toma la decisión de UI— y ese
// módulo solo enciende, apaga y avisa. Aquí se pone todo lo que él no puede saber:
//
//   · **El diagnóstico.** Se guarda el ÚLTIMO que se pintó ({@link
//     cablearDiagnostico} → `ultimoDiagnostico`) en vez de recalcularlo al pulsar:
//     recalcular daría cifras que podrían no ser las que el usuario está mirando
//     —cuesta ~67 ms y el store puede haber cambiado— y el informe tiene que decir
//     exactamente lo que dice el cajón. Cuando no hay ninguno, el botón está
//     apagado Y la comprobación de dentro lo vuelve a mirar (el `disabled` es
//     cortesía, la garantía es la guarda).
//   · **La FECHA.** `report/contraste-texto.js` **no consulta el reloj** —hay un
//     guardián que lo comprueba con un grep sobre su fuente— por la misma razón que
//     `gml/`: un informe descargado es un snapshot y tiene que valer lo mismo dentro
//     de un año. Quien sí puede leerlo es este cableado, y lo hace por `ahora()`,
//     inyectable igual que en `cablearCatastro` y en `cablearGeneracionGml`.
//   · **La COMPROBACIÓN, que puede ser `null`.** Quien llegó por referencia
//     catastral (F05) no tiene fichero que comprobar y descarga su informe igual;
//     `informeContrasteTexto` admite `null` y se salta la sección del fichero. Por
//     eso la opción es una FUNCIÓN (`comprobacion()`) y no un valor: la
//     comprobación cambia con el tiempo —entra al soltar un GML y se va al
//     descartarlo— y un valor congelado en el montaje mentiría a la segunda carga.
//     Su defecto es `() => null`, que es exactamente la vía de F05, así que la
//     interfaz **no se ramifica por procedencia**. Quien la enchufa es `app/main.js`
//     (T5.1), y no hay que fabricar nada: `app/cableado-comprobacion.js` ya expone
//     `comprobacion: () => comprobacion` con esa misma forma.
//   · **El NOMBRE del fichero.** Ver {@link nombreFicheroInforme}.
//
// ── POR QUÉ EL RECÁLCULO NO SE ENGANCHA A `alPrevisualizar` ─────────────────
// Es la decisión de rendimiento de F07 y conviene que esté escrita donde se toma.
// `alPrevisualizar` se dispara en CADA FRAME de un arrastre —sesenta veces por
// segundo— y lo que hay detrás de `diagnosticar()` no es una resta: es la
// intersección topológica contra el contorno oficial y contra cada vecina, más el
// muestreo de la desviación lado a lado (decenas de miles de proyecciones, ~67 ms
// medidos sobre la parcela real). Colgarlo del frame convertiría un arrastre fluido
// en una presentación de diapositivas, y para nada: el diagnóstico no se lee
// mientras se mueve el ratón, se lee cuando se ha soltado.
//
// El canal correcto es `estado.subscribe`, que notifica UNA vez por operación
// ACABADA. La ficha del pie sigue con `edit/metricas.js` por el canal en vivo y el
// cajón con `diagnostico/parcela.js` por este: son dos consumidores distintos del
// mismo modelo y **ninguno recalcula lo del otro**. Que las dos cifras de
// superficie coincidan es invariante, y lo afirma el test de aceptación.
//
// ── POR QUÉ UNA PARCELA DISTINTA CIERRA EL CAJÓN ────────────────────────────
// La alternativa —dejarlo abierto y recalcular— parecía más amable y es peor por
// dos motivos. El primero: las vecinas son de la parcela ANTERIOR, así que habría
// que tirarlas, y el cajón se quedaría abierto diciendo «no se ha consultado» sin
// que el usuario hubiera hecho nada. El segundo, y el que decide: para volver a
// tenerlas haría falta otra petición, y dispararla sola —sin que nadie la pida— es
// justo lo que castiga la política de uso del servicio (override O8). Cerrando, la
// siguiente pulsación del CTA es el gesto que la autoriza. Una parcela nueva es un
// diagnóstico nuevo, no el mismo con otras cifras.
//
// El expediente (registral y clase) se reinicia en ese mismo momento y solo en ese:
// son datos de UNA escritura y de UNA parcela. Sobreviven a las ediciones —mover un
// vértice no cambia lo que dice el Registro— y eso es lo que el test afirma.
//
// ── LO QUE ESTE MÓDULO **NO** HACE ──────────────────────────────────────────
//   · **No importa Leaflet ni toca el mapa.** El contraste entra ya construido
//     (`visor.diagnostico.contraste`) y se le habla por sus tres métodos.
//   · **No habla con el Catastro.** Recibe el cableado de F05 y le pide
//     `colindantes()`; no construye URLs ni sabe qué es una *stored query*.
//   · **No filtra la parcela propia de las colindantes.** Ya lo hace
//     `services/catastro.js#parcelaYColindantes`, que es donde está medido el
//     override O15 (`GetNeighbourParcel` devuelve 5 miembros para 4 colindantes, y
//     la propia NO viene la primera). Repetir aquí ese filtro sería una segunda
//     verdad sobre el servicio; lo que sí hay es un test que lo afirma de extremo a
//     extremo, porque de eso depende que la parcela no aparezca invadiéndose a sí
//     misma al 100 %.
//   · **No decide si el encaje es bueno.** Traslada cifras (regla de oro 9).
//
// Su test es `test/app/diagnostico.dom.test.js`, con sufijo `.dom`: toca el DOM.

import { diagnosticar } from '../diagnostico/parcela.js'
import {
  EXTENSION_GML,
  PREFIJO_NOMBRE,
  TIPO_MIME_TEXTO,
  descargarTexto,
  nombreFicheroGml,
} from '../gml/descargar.js'
import { informeContrasteTexto } from '../report/contraste-texto.js'
// ⚠️ De `viewer/` solo se importa `_comun.js`, que NO trae Leaflet. El motivo de
// «Descargar informe de contraste» vive en `viewer/cajon-diagnostico.js` y **no se
// importa desde aquí a propósito**: ese módulo sí importa Leaflet, y este fichero
// tiene escrito —y cumple— que no lo hace. Tampoco se copia el literal: quien
// escribe ese renglón cuando el botón está apagado es el propio cajón, en el mismo
// instante en que lo apaga. Ver la guarda de `descargarInforme`.
import { NIVEL } from '../viewer/_comun.js'
import { traducirColindantes } from './colindantes.js'
import { INSTRUCCION_PARCELARIO } from './navegacion.js'

// ── Los selectores del contrato con `index.html` ─────────────────────────────

/**
 * «Diagnosticar encaje». **Nace `disabled` en `index.html`** y lo enciende el
 * ESTADO, nunca la mera importación de este módulo.
 */
export const SELECTOR_BOTON_DIAGNOSTICAR = '[data-accion="diagnosticar"]'

/**
 * Renglón `role="status"` del CTA. Lleva la misma cadena que su `data-accion`, que
 * es la convención de esta app (`generar-gml`/`generar-gml`, `cargar-catastro`/
 * `cargar-catastro`).
 *
 * ⚠️ NO confundir con el renglón del CAJÓN, que es `[data-estado="cajon-diagnostico"]`
 * y vive dentro del mapa. Son dos superficies distintas: este cuenta el desenlace
 * de PULSAR el botón (por qué está apagado, si la consulta de vecinas falló); el
 * otro, el estado de lo que se está enseñando dentro del cajón. Se llaman distinto
 * a propósito: `querySelector` se queda con el PRIMERO del documento y el `<aside>`
 * va antes que el `<main>`, así que dos nodos con el mismo valor dejarían al del
 * cajón inalcanzable y mudo. La trampa está documentada en `index.html` desde F06.
 */
export const SELECTOR_ESTADO_DIAGNOSTICO = '[data-estado="diagnosticar"]'

/**
 * ⭐ «Traer el parcelario de fondo» — **la puerta 2** (2026-08-08). **Nace
 * `disabled` en `index.html`** y lo enciende el ESTADO, como sus tres hermanos.
 *
 * ⚠️ **El `data-accion` es DISTINTO del de Entrada a propósito, y es la parte más
 * frágil de esta tarea.** Entrada tiene `cargar-catastro`, que sustituye el
 * documento; éste conserva la medición. Con las dos pantallas montadas a la vez
 * —que es como funciona esta app— `querySelector` devuelve **la primera en orden de
 * documento aunque esté `hidden`** (contrato K.1), así que dos botones con el mismo
 * valor dejarían a éste huérfano y sus clics irían a parar al que borra la medición:
 * exactamente el defecto que esta feature viene a cerrar, servido por el arreglo.
 */
export const SELECTOR_BOTON_FONDO = '[data-accion="traer-fondo-catastral"]'

/**
 * Su `role="status"`, con la misma cadena que su `data-accion` (convención del pie).
 *
 * **Tiene renglón propio y no comparte el de «Diagnosticar encaje»**, aunque vivan
 * en el mismo bloque: los dos escriben motivo cuando nacen apagados, y con un solo
 * renglón el último en refrescar borraría al otro en cada `set` del store. Son dos
 * acciones con dos desenlaces distintos; el de arriba dice qué falta y el de abajo,
 * qué ha pasado al intentar traerlo.
 */
export const SELECTOR_ESTADO_FONDO = '[data-estado="traer-fondo-catastral"]'

// ── Constantes de presentación ───────────────────────────────────────────────

/** Modificador de `.gml-accion-estado` para el desenlace que NO trae el dato. */
const CLASE_ESTADO_ERROR = 'gml-accion-estado--error'

/**
 * Por qué «Diagnosticar encaje» está apagado. Se exporta para que su test lo
 * afirme sin copiar el literal, igual que `MOTIVO_COLINDANTES_APAGADO` de F05.
 *
 * Dice las dos cosas que hacen falta: qué falta y cómo conseguirlo. «Necesitas una
 * parcela» a secas dejaría al usuario mirando una parcela cargada sin entender por
 * qué no le vale (la suya es un DXF: tiene geometría, pero no tiene contra qué
 * contrastarla).
 *
 * ⛔ **El «cómo conseguirlo» decía «Tráela del Catastro y se enciende», y era la
 * trampa**: hacerlo borraba su medición. Ahora sale de {@link INSTRUCCION_PARCELARIO},
 * que lo dice UNA vez para los cuatro sitios que lo decían de cuatro maneras.
 */
export const MOTIVO_SIN_OFICIAL =
  '«Diagnosticar encaje» está apagado: el diagnóstico contrasta la geometría medida contra el ' +
  'contorno OFICIAL del Catastro, y esta parcela no lo trae (se ha cargado de un fichero o se ' +
  `ha dibujado). ${INSTRUCCION_PARCELARIO}`

/**
 * Lo que se dice cuando no hay a quién pedirle las vecinas. No es un fallo: es un
 * visor montado sin el cableado del Catastro, que es un uso legítimo.
 */
export const MOTIVO_SIN_CATASTRO =
  'No se han consultado las parcelas colindantes: esta pantalla no tiene conectado el cliente ' +
  'del Catastro. Las otras ocho medidas del diagnóstico no dependen de ellas.'

/**
 * Lo que se dice cuando la consulta de vecinas no ha traído nada. **El diagnóstico
 * se pinta igual**: un fallo de red no puede tumbar las ocho medidas que no
 * dependen de la red, y decir «no hay invasión» porque no se ha podido mirar sería
 * el error silencioso más caro de esta pantalla.
 */
export const COLA_SIN_VECINAS =
  'El resto del diagnóstico está calculado; solo falta la invasión a colindantes.'

// ── La puerta 2 · «Traer el parcelario de fondo» ─────────────────────────────

/**
 * Por qué la puerta 2 está apagada cuando esta pantalla **no tiene con qué
 * consultar** al Catastro. Es el caso de un visor montado sin `cablearCatastro`, o
 * con un cableado que no expone `cargar`: legítimo, pero hay que decirlo.
 *
 * ⚠️ Y por eso la comprobación es `typeof catastro.cargar === 'function'` y **no se
 * amplía `esCatastro`** (decisión 3A): aquel contrato lo firmó F07 para pedir
 * vecinas, lo cumplen dobles de prueba de dos métodos y ampliarlo tumbaría el
 * cableado entero —incluidas las ocho medidas que no dependen de la red— por una
 * función que solo hace falta para un botón. Cada puerta comprueba lo suyo.
 */
export const MOTIVO_FONDO_SIN_CATASTRO =
  '«Traer el parcelario de fondo» está apagado: esta pantalla no tiene conectado el cliente del ' +
  'Catastro, así que no hay a quién pedirle el parcelario. El resto del diagnóstico no depende ' +
  'de él.'

/**
 * Por qué está apagada cuando no hay nada que conservar. Sin geometría propia, «de
 * fondo» no significa nada: lo que hace falta es EMPEZAR, y eso se hace en Entrada.
 */
export const MOTIVO_FONDO_SIN_GEOMETRIA =
  '«Traer el parcelario de fondo» está apagado: el fondo se trae para contrastarlo con algo, y ' +
  'todavía no hay ninguna geometría cargada. Carga tu levantamiento —o empieza desde el ' +
  'Catastro, en Entrada— y se enciende.'

/** Lo que se dice mientras la consulta viaja. Un botón apagado no se queda mudo. */
export const MENSAJE_FONDO_EN_CURSO = 'Pidiéndole el parcelario al Catastro…'

/**
 * No hay referencia catastral en el modelo **y esta pantalla no puede deducirla**
 * (cableado sin `deducir`). Se dice en vez de dejar el botón encendido y que no pase
 * nada al pulsarlo.
 */
export const MOTIVO_FONDO_SIN_DEDUCIR =
  'No se ha traído el parcelario: esta parcela no tiene referencia catastral y esta pantalla no ' +
  'puede deducirla del mapa. Escribe la referencia en Entrada.'

/**
 * El Catastro dice que en ese punto hay VARIAS parcelas.
 *
 * No se elige ninguna a ciegas —es la regla de la spec §7.3 y aquí pesa más que
 * nunca: elegir mal metería en el expediente el parcelario del vecino como término
 * de comparación de un lindero—. Se nombran las candidatas para que el usuario sepa
 * cuáles son.
 *
 * ⚠️ **Límite conocido, y se declara en vez de disimularse.** Desde aquí no se puede
 * elegir todavía: la lista de candidatos la pinta el bloque de Entrada. Es un caso
 * raro —el OVC no devolvió dos en ninguna de las 8 capturas reales del proyecto— y
 * su salida natural es que la parcela ya traiga referencia catastral.
 *
 * @param {Array<{refcat: string}>} candidatos
 * @returns {string}
 */
/**
 * Un fallo INESPERADO al traer el fondo (un contrato roto, no un motivo del catálogo
 * del Catastro). F05 ya lo ha contado por sus tres canales; esto solo cierra el
 * renglón para que no se quede un «pidiendo…» eterno al lado de un botón encendido.
 */
export const MENSAJE_FONDO_ROTO =
  'No se ha podido traer el parcelario: la consulta se ha interrumpido por un fallo interno de ' +
  'la aplicación. No se ha cambiado nada de lo que hay en pantalla.'

export const motivoFondoVariasParcelas = (candidatos) =>
  `No se ha traído el parcelario: en el punto interior de tu geometría el Catastro dice que hay ` +
  `${candidatos.length} parcelas (${candidatos.map((c) => c.refcat).join(', ')}), y esta ` +
  `aplicación no elige ninguna a ciegas — meter el parcelario del vecino como término de ` +
  `comparación de un lindero es justo el error que no se puede cometer. Escribe en Entrada la ` +
  `referencia que sea la tuya.`

/**
 * Lo que se le dice al usuario cuando el diagnóstico revienta por un defecto de
 * programación. Mismo criterio —y mismas tres piezas— que
 * `MENSAJE_FALLO_INESPERADO` de `app/main.js` y de `cableado-catastro.js`: qué ha
 * pasado, que no se ha cambiado nada, y dónde está el detalle.
 */
export const MENSAJE_FALLO_INESPERADO =
  'El diagnóstico se ha interrumpido por un fallo interno de la aplicación; no se ha cambiado ' +
  'nada de la parcela. El detalle técnico está en la consola del navegador.'

/**
 * Fallo COMPONIENDO el informe. Se distingue del de la entrega porque llevan a
 * acciones distintas: aquí el fichero no llegó a existir, allí existe y no bajó.
 * Mismo criterio —y mismas tres piezas— que {@link MENSAJE_FALLO_INESPERADO}.
 */
export const MENSAJE_INFORME_NO_COMPUESTO =
  'El informe de contraste no se ha podido componer por un fallo interno de la aplicación; ' +
  'no se ha descargado nada y no se ha cambiado nada de la parcela. El detalle técnico está ' +
  'en la consola del navegador.'

/**
 * Fallo ENTREGANDO el informe: el texto se compuso entero y lo que falló fue el
 * navegador (una extensión que ha roto el `click`, la pestaña cerrándose). Se dice
 * aparte porque para el usuario «tu informe no se puede escribir» y «el informe
 * está hecho pero no ha bajado» son cosas distintas, y un solo mensaje para las dos
 * le haría buscar el problema donde no está. Es la misma distinción que hace
 * `app/main.js` con el GML.
 */
export const MENSAJE_INFORME_NO_ENTREGADO =
  'El informe de contraste se ha compuesto, pero el navegador no ha podido entregarlo. ' +
  'Vuelve a intentarlo; el detalle técnico está en la consola del navegador.'

// ── El nombre del fichero del informe ────────────────────────────────────────

/**
 * Primera parte del nombre del informe, en el lugar que el GML ocupa con
 * `PREFIJO_NOMBRE` (`'parcela'`) y por el mismo motivo: dice QUÉ es el fichero
 * antes de decir de qué parcela es, y agrupa todo lo que sale de esta aplicación
 * en la misma carpeta de descargas.
 *
 * @readonly
 */
export const PREFIJO_INFORME = 'contraste'

/**
 * Extensión del informe. Es texto plano de verdad —lo dice {@link TIPO_MIME_TEXTO}—
 * y `.txt` es lo que hace que se abra con un editor en los tres sistemas.
 *
 * @readonly
 */
export const EXTENSION_INFORME = '.txt'

/**
 * Compone el nombre con el que baja el informe:
 * `contraste_<referencia>_<AAAA-MM-DDTHH-mm-ss>.txt`.
 *
 *     contraste_9398516VK3799G_2026-07-30T11-45-30.txt   ← con referencia
 *     contraste_sin-referencia_2026-07-30T11-45-30.txt   ← sin RC (un alta, un 3.0)
 *
 * ── POR QUÉ SE DERIVA DE `nombreFicheroGml` Y NO SE ESCRIBE OTRA VEZ ────────
 * El nombre de un fichero no es texto libre: la referencia catastral la teclea o
 * la pega el usuario, y de ahí salen rutas (`/`, `\`, `..`), caracteres ilegales
 * en Windows, nombres de DISPOSITIVO reservados (`CON.txt` no se puede crear) y
 * longitudes que revientan con `ENAMETOOLONG`. Todo eso ya está resuelto —por
 * lista BLANCA, con el porqué de cada decisión escrito al lado— dentro de
 * `gml/descargar.js#nombreFicheroGml`, y su saneador **no está exportado**. Copiar
 * cuarenta líneas de lista blanca aquí sería abrir la segunda familia de
 * duplicados que la cabecera de aquel módulo se niega expresamente a abrir; la
 * copia que se olvidara de una corrección fallaría en verde.
 *
 * Así que se le pide el nombre HECHO y se le cambian las dos piezas que son de
 * este dominio: el prefijo y la extensión. La marca de tiempo, el saneado de la
 * referencia y las dos marcas honestas (`sin-referencia`, `referencia-ilegible`)
 * vienen intactas del original — que es justamente lo que se quiere, porque el
 * informe y el GML de la misma parcela y el mismo instante tienen que emparejarse
 * de un vistazo en la carpeta de descargas.
 *
 * **Y no colisiona con el del GML** por partida doble: distinto prefijo y distinta
 * extensión. Hay un test que lo afirma en vez de darlo por hecho.
 *
 * FUNCIÓN PURA: la fecha entra por parámetro, igual que en `gml/`.
 *
 * @param {object} args
 * @param {string|null} [args.refcat=null]  La referencia tal cual la tenga el
 *   expediente, sin sanear. `null`, vacía o en blanco = no hay referencia.
 * @param {Date} args.fecha  Instante que se estampa en el nombre. OBLIGATORIO.
 * @returns {string}  Nombre de fichero seguro, terminado en {@link EXTENSION_INFORME}.
 * @throws {TypeError|RangeError}  Los de `nombreFicheroGml`, sin traducir: son
 *   contratos del programador y el mensaje original nombra el problema mejor.
 */
export function nombreFicheroInforme({ refcat = null, fecha } = {}) {
  const delGml = nombreFicheroGml({ refcat, fecha })
  // Se recorta por longitud y no por `replace`, porque un `replace` de la cadena
  // «parcela» acertaría también dentro de una referencia que la contuviera.
  const cuerpo = delGml.slice(PREFIJO_NOMBRE.length, delGml.length - EXTENSION_GML.length)
  return `${PREFIJO_INFORME}${cuerpo}${EXTENSION_INFORME}`
}

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO, así que un
 * selector que no encuentra nada es un bug del programador y no un dato malo: se
 * lanza y **se nombra el selector**. Gemelo del de `cableado-catastro.js`; son dos
 * copias de cuatro líneas y siguen siendo dos porque cada mensaje nombra su propio
 * fichero, que es la mitad de lo que sirve.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error} Si la cáscara no tiene ese nodo.
 */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/cableado-diagnostico.js: la cáscara no tiene ningún nodo '${selector}'. El marcado ` +
        `de index.html es contrato de este cableado (y de estilos/app.css): si se ha renombrado ` +
        `o movido ese nodo, hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── Lecturas del modelo ──────────────────────────────────────────────────────

/**
 * Los recintos del POJO que haya en el store. El store admite `null` (su valor
 * inicial documentado) y cualquier POJO sin validarlo, así que aquí no se da nada
 * por hecho. Mismo criterio que `cableado-catastro.js#recintosDe`.
 *
 * @param {object|null} parcelaActual
 * @returns {Array<{vertices: Array<[number, number]>, tipo: string}>}
 */
function recintosDe(parcelaActual) {
  const recintos =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.recintos
  return Array.isArray(recintos) ? recintos : []
}

/**
 * El contorno OFICIAL del POJO, o `null`. `null` y un array VACÍO se tratan igual
 * —no hay con qué contrastar— pero se distinguen del array con recintos, que es lo
 * único que enciende el CTA.
 *
 * @param {object|null} parcelaActual
 * @returns {Array|null}
 */
function oficialDe(parcelaActual) {
  const oficial =
    parcelaActual === null || parcelaActual === undefined ? null : parcelaActual.geometriaOficial
  return Array.isArray(oficial) && oficial.length > 0 ? oficial : null
}

/**
 * ¿Tiene sentido ofrecer «Diagnosticar encaje»? **Hay contorno oficial Y hay
 * geometría del usuario.** Las dos mitades importan y la segunda no es teórica: el
 * store arranca en `null` y una parcela a medio dibujar tiene `recintos: []`.
 *
 * No se exporta: es una regla INTERNA de esta pantalla, y sacarla invitaría a que
 * otro módulo decidiera con ella. Se comprueba desde fuera por su efecto (el
 * `disabled` del botón), que es lo que el usuario ve. Mismo criterio que
 * `puedePedirColindantesDe` de F05. (Aquí se nombraba también `puedeDeducirDe`, que
 * se fue con el botón «Deducir del mapa» el 2026-08-16.)
 *
 * @param {object|null} parcelaActual
 * @returns {boolean}
 */
function puedeDiagnosticar(parcelaActual) {
  return oficialDe(parcelaActual) !== null && recintosDe(parcelaActual).length > 0
}

/**
 * Qué PARCELA es esta, a efectos de «¿ha entrado una distinta?». La referencia
 * catastral primero y el `idLocal` como respaldo: los dos sobreviven a las
 * ediciones —`edit/` reconstruye el POJO pero no reetiqueta el expediente—, que es
 * exactamente la propiedad que hace falta. La identidad del OBJETO no vale: cada
 * operación de edición produce uno nuevo.
 *
 * @param {object|null} parcelaActual
 * @returns {string|null}
 */
function claveDeExpediente(parcelaActual) {
  if (parcelaActual === null || parcelaActual === undefined) return null
  const refcat = typeof parcelaActual.refcat === 'string' ? parcelaActual.refcat.trim() : ''
  if (refcat !== '') return `refcat:${refcat.toUpperCase()}`
  const idLocal = typeof parcelaActual.idLocal === 'string' ? parcelaActual.idLocal : ''
  return idLocal === '' ? null : `idLocal:${idLocal}`
}

/**
 * De qué expediente son las vecinas que trae un resultado del Catastro, **según
 * el propio resultado**, o `null` si no lo declara.
 *
 * `parcelaYColindantes` devuelve `{propia, colindantes}` y la `propia` es la
 * parcela que se pidió, separada por referencia catastral normalizada (override
 * O15). Ésa es la única identidad que el resultado lleva encima, y es lo que
 * permite descartar unas vecinas que se pidieron para otra finca.
 *
 * ⚠️ **Puede venir `null`, y eso NO es un fallo**: hay parcelas para las que
 * `GetNeighbourParcel` se omite a sí misma (medido el 2026-08-15 en
 * `8081401TF9288S`). Cuando pasa, el resultado no declara identidad y el cotejo
 * cae en la que apuntó {@link cablearDiagnostico}`#pedirVecinas` al pedirlas. Y
 * si tampoco la hay —una publicación de F05 sobre un servicio que se omite— se
 * adopta, que es lo que se venía haciendo: descartar por no poder comprobar
 * dejaría el diagnóstico sin invasión para siempre y sin decir por qué.
 *
 * @param {object|null} resultado
 * @returns {string|null}
 */
function claveDelResultado(resultado) {
  const propia = resultado?.datos?.propia
  if (propia === null || propia === undefined || typeof propia !== 'object') return null
  const refcat = typeof propia.refcat === 'string' ? propia.refcat.trim() : ''
  return refcat === '' ? null : `refcat:${refcat.toUpperCase()}`
}

/**
 * La referencia catastral del POJO, o `null`, **para el NOMBRE del fichero**. La
 * cadena vacía y la cadena en blanco valen `null`: es el caso REAL de `UTM_1.gml`
 * y de la plantilla oficial del Catastro, donde el elemento está y viene VACÍO
 * (medido en F08 · T2.1, donde `refcat` resultó ser `''` y no `null`).
 *
 * No se reutiliza {@link claveDeExpediente}: aquella es una clave de IDENTIDAD
 * —mezcla `refcat` con `idLocal` y les pone prefijo— y meterla en el nombre de un
 * fichero escribiría `idLocal-de-un-dxf` donde el usuario espera una referencia.
 *
 * @param {object|null} parcelaActual
 * @returns {string|null}
 */
function referenciaDe(parcelaActual) {
  if (parcelaActual === null || parcelaActual === undefined) return null
  const refcat = typeof parcelaActual.refcat === 'string' ? parcelaActual.refcat : ''
  return refcat.trim() === '' ? null : refcat
}

/**
 * `ParcelaGml[]` → `[{refcat, recintos}]`, que es lo que come
 * `diagnostico/parcela.js`. La traducción es de tres campos y aun así vive en una
 * función con nombre: es la costura entre el vocabulario de `gml/parse.js` y el de
 * `diagnostico/`, y las costuras se leen mejor con nombre.
 *
 * Una vecina SIN recintos se deja pasar con `recintos: []`. No se filtra a
 * propósito: `diagnostico/topologia.js` la anota en `saltados` con su índice y su
 * motivo, y así el usuario ve que el Catastro devolvió una vecina que no se ha
 * podido medir. Descartarla aquí la haría desaparecer sin dejar rastro, que es la
 * definición de fallo silencioso.
 *
 * @param {Array<{refcat: string|null, recintos: Array}>} parcelas
 * @returns {Array<{refcat: string|null, recintos: Array}>}
 */
// ⚠️ **Ya no se traduce aquí.** Esta función existía con una gemela casi idéntica
// en `app/cableado-informe.js`, y las dos discrepaban en un detalle real: aquélla
// recortaba el `refcat` antes de decidir si estaba vacío y ésta no, así que una
// referencia de solo espacios llegaba aquí como cadena y allí como `null`. La
// traducción vive ahora en `app/colindantes.js#traducirColindantes`, una vez y con
// el superconjunto de campos (`label` incluido, que lo usa el informe).
const aVecinas = traducirColindantes

// ── Contratos de las dependencias ────────────────────────────────────────────

/** ¿Sirve como store? DUCK TYPING, igual que en `viewer/index.js#esStore`. */
const esStore = (v) =>
  !!v && typeof v.get === 'function' && typeof v.subscribe === 'function'

/** ¿Es el cajón de `viewer/cajon-diagnostico.js`? Se comprueba lo que se USA. */
const esCajon = (v) =>
  !!v &&
  typeof v.pintar === 'function' &&
  typeof v.abrir === 'function' &&
  typeof v.cerrar === 'function' &&
  typeof v.abierto === 'function' &&
  typeof v.registral === 'function' &&
  typeof v.clase === 'function' &&
  typeof v.reiniciarExpediente === 'function' &&
  typeof v.estado === 'function' &&
  // Las DOS del pie del informe (F09 · T4.2). Se comprueba lo que se USA, así que
  // entran en la misma lista: sin ellas el botón quedaría montado y mudo.
  //
  // ⚠️ **Eran TRES hasta el 2026-08-15**: `alDescargar` se fue con el botón del
  // informe en texto (ver la cabecera de `viewer/cajon-diagnostico.js`). Ya no se
  // exige, y no puede exigirse: un cajón que la trajera sería un cajón viejo.
  //
  // ⚠️ `alPreparar` lo consume `app/cableado-informe.js` (F09) y NO este módulo, y
  // aun así se exige aquí. No es celo: este cableado es el primero de los dos que
  // monta sobre el pie del cajón. Un cajón sin ese canal pasaría esta guarda,
  // `cablearDiagnostico` seguiría funcionando entero, y el botón del documento
  // firmable —el que el usuario viene a pulsar— se quedaría montado y mudo, sin un
  // solo síntoma. Un contrato que solo se comprueba cuando alguien lo usa es un
  // contrato que se descubre roto en producción.
  typeof v.estadoInforme === 'function' &&
  typeof v.alPreparar === 'function' &&
  typeof v.alCambiar === 'function' &&
  typeof v.alCerrar === 'function'

/** ¿Es la capa de `viewer/contraste.js`? */
const esContraste = (v) => !!v && typeof v.pintar === 'function' && typeof v.limpiar === 'function'

/** ¿Es el cableado de F05, con lo que este módulo le pide? */
const esCatastro = (v) =>
  !!v && typeof v.colindantes === 'function' && typeof v.alColindantes === 'function'

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * Cablea el diagnóstico de encaje: el CTA del pie, el cajón del mapa, la capa de
 * contraste y (si lo hay) el cliente del Catastro para las colindantes.
 *
 * ```js
 * const visor = crearVisor(el, { estado, tablaEl, srs, edicion: true, diagnostico: true })
 * const catastro = cablearCatastro({ estado, panel, cliente, srs })
 * const diag = cablearDiagnostico({
 *   estado,
 *   cajon: visor.diagnostico.cajon,
 *   contraste: visor.diagnostico.contraste,
 *   catastro,
 *   panel,
 *   // Opcional (F08): de dónde sale la comprobación del fichero, si la hay. Es la
 *   // MISMA función que `cablearComprobacion` ya expone. Sin esto el informe se
 *   // descarga igual, con la sección del fichero omitida.
 *   comprobacion: comprobacionCableada.comprobacion,
 * })
 * // … al cerrar la pantalla:
 * diag.destruir()
 * ```
 *
 * @param {Object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El store del
 *   visor. Se LEE y se ESCUCHA; nunca se escribe: el diagnóstico mide, no edita.
 * @param {object} opciones.cajon  `visor.diagnostico.cajon`.
 * @param {object} opciones.contraste  `visor.diagnostico.contraste`.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel  Panel de avisos, para
 *   el único caso que le corresponde: un fallo INESPERADO del cálculo.
 * @param {object|null} [opciones.catastro=null]  El cableado de F05
 *   (`cablearCatastro`). `null` ⇒ no se consultan vecinas y se DICE
 *   ({@link MOTIVO_SIN_CATASTRO}): es un uso legítimo, no una degradación callada.
 * @param {HTMLElement} [opciones.boton]  El CTA. Por defecto, el de la cáscara.
 * @param {HTMLElement} [opciones.renglon]  Su `role="status"`.
 * @param {HTMLElement} [opciones.botonFondo]  «Traer el parcelario de fondo» (la
 *   puerta 2). Por defecto {@link SELECTOR_BOTON_FONDO}.
 * @param {HTMLElement} [opciones.renglonFondo]  Su `role="status"` PROPIO; ver
 *   {@link SELECTOR_ESTADO_FONDO} sobre por qué no comparte el del CTA.
 * @param {() => (object|null)} [opciones.comprobacion]  De dónde sale la
 *   `Comprobacion` de `comprobacion/gml.js` que va en la cabecera del informe.
 *   **Es una función y su defecto devuelve `null`**, que es la vía de F05: quien
 *   llegó por referencia catastral no tiene fichero que comprobar y descarga su
 *   informe igual. Ver el bloque «EL INFORME» de la cabecera.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora» para la cabecera del
 *   informe y para el nombre del fichero. Por defecto el reloj del sistema. Es un
 *   parámetro y no una llamada directa porque `report/contraste-texto.js` **no
 *   consulta el reloj por contrato** —hay un guardián que lo comprueba—, así que
 *   poder fijarlo desde fuera es lo único que permite afirmar algo exacto sobre el
 *   texto y sobre el nombre en una prueba. Mismo criterio que `cablearCatastro` y
 *   que `cablearGeneracionGml`.
 * @param {typeof descargarTexto} [opciones.descargar]  La entrega del fichero.
 * @returns {{abrir: (evento?: Event|null) => Promise<void>, recalcular: () => void,
 *   descargarInforme: () => (object|null), traerFondo: () => Promise<void>,
 *   ultimoDiagnostico: () => (object|null),
 *   olvidarPorFondoNuevo: () => void, destruir: () => void}}
 * @throws {TypeError}  Contrato del programador.
 * @throws {Error}  Si la cáscara no trae los dos nodos del contrato.
 */
export function cablearDiagnostico({
  estado,
  cajon,
  contraste,
  panel,
  catastro = null,
  boton = nodo(SELECTOR_BOTON_DIAGNOSTICAR),
  renglon = nodo(SELECTOR_ESTADO_DIAGNOSTICO),
  botonFondo = nodo(SELECTOR_BOTON_FONDO),
  renglonFondo = nodo(SELECTOR_ESTADO_FONDO),
  comprobacion = () => null,
  ahora = () => new Date(),
  descargar = descargarTexto,
} = {}) {
  if (!esStore(estado)) {
    throw new TypeError(
      `cablearDiagnostico: 'estado' debe ser el store de crearEstadoVista ` +
        `({get, subscribe}); recibido ${typeof estado}.`,
    )
  }
  if (!esCajon(cajon)) {
    throw new TypeError(
      `cablearDiagnostico: 'cajon' debe ser el de viewer/cajon-diagnostico.js ` +
        `(lo devuelve crearVisor en visor.diagnostico.cajon); recibido ${typeof cajon}. Si vale ` +
        `undefined, el visor se montó sin 'diagnostico: true'.`,
    )
  }
  if (!esContraste(contraste)) {
    throw new TypeError(
      `cablearDiagnostico: 'contraste' debe ser el de viewer/contraste.js ` +
        `(visor.diagnostico.contraste); recibido ${typeof contraste}.`,
    )
  }
  if (!panel || typeof panel.avisar !== 'function') {
    throw new TypeError(
      `cablearDiagnostico: 'panel' debe ser el panel de avisos (con 'avisar'); recibido ` +
        `${typeof panel}. Sin él, un fallo interno del cálculo no tendría dónde contarse.`,
    )
  }
  if (catastro !== null && !esCatastro(catastro)) {
    throw new TypeError(
      `cablearDiagnostico: 'catastro' debe ser el cableado de app/cableado-catastro.js ` +
        `(con colindantes y alColindantes), o null para no consultar vecinas; recibido ` +
        `${typeof catastro}.`,
    )
  }
  // Las tres del informe. Se validan aunque tengan defecto: un `comprobacion` que
  // fuera el OBJETO en vez de la función que lo devuelve es el error fácil de
  // cometer aquí, y sin guarda se descubriría el día que alguien pulse el botón —
  // con un `TypeError` de dentro de este módulo, no del llamante que se equivocó.
  for (const [nombre, valor] of [
    ['comprobacion', comprobacion],
    ['ahora', ahora],
    ['descargar', descargar],
  ]) {
    if (typeof valor !== 'function') {
      throw new TypeError(
        `cablearDiagnostico: '${nombre}' debe ser una función; recibido ${typeof valor}. ` +
          `'comprobacion' se pasa como función (y no como valor) porque la comprobación ` +
          `cambia con el tiempo; 'ahora' porque report/contraste-texto.js no consulta el ` +
          `reloj por contrato.`,
      )
    }
  }

  let destruido = false

  /**
   * Las vecinas traducidas, o `null`. **`null` = NO SE HA CONSULTADO**, que es
   * distinto de `[]` = se consultó y no hay ninguna, y esa distinción viaja intacta
   * hasta el cajón: es lo que separa «no hay invasión» de «no lo he mirado».
   *
   * @type {Array<{refcat: string|null, recintos: Array}>|null}
   */
  let vecinas = null

  /** Qué parcela había la última vez, para detectar que ha entrado otra. */
  let clave = claveDeExpediente(estado.get())

  /** Una consulta de vecinas en vuelo, para no encabalgar dos aperturas. */
  let pidiendo = false

  /**
   * Para qué expediente se pidieron las vecinas que están en vuelo, o `null` si
   * este módulo no ha pedido ninguna. Es la segunda mitad del cotejo de
   * {@link adoptar}: sirve para los resultados que no declaran identidad (ver
   * {@link claveDelResultado}), que son justo los de la consulta que este módulo
   * acaba de disparar.
   *
   * @type {string|null}
   */
  let clavePedida = null

  /**
   * Una petición de parcelario de fondo en vuelo. **Una pulsación, una petición**: el
   * botón queda `disabled` en este mismo tick, antes del primer `await`, así que una
   * doble pulsación no llega a disparar la segunda. Misma doctrina que
   * `cableado-catastro.js#operar`.
   */
  let trayendoFondo = false

  /**
   * El ÚLTIMO diagnóstico que se pintó en el cajón, que es el que el informe
   * recoge. `null` = no hay ninguno, y entonces el botón del pie está apagado con
   * su motivo escrito.
   *
   * Se guarda en vez de recalcularse al pulsar, y no es por ahorrar los ~67 ms:
   * recalcular podría dar cifras DISTINTAS de las que el usuario tiene delante —el
   * store puede haber cambiado entre el repintado y el clic— y un informe que no
   * dice lo mismo que la pantalla de la que salió es peor que no tener informe.
   *
   * Su invariante, que sostiene toda la guarda del botón: **`ultimoDiagnostico` es
   * `null` exactamente cuando el cajón ha recibido `pintar(null)`**, que es lo que
   * apaga el botón y escribe su motivo. Por eso hay UN solo sitio que lo devuelve a
   * `null` —{@link olvidarDiagnostico}, que hace las dos cosas juntas— y no tres
   * asignaciones sueltas de las que haya que acordarse.
   *
   * @type {object|null}
   */
  let ultimoDiagnostico = null

  /**
   * Quién quiere enterarse de que {@link ultimoDiagnostico} ha cambiado. Un `Set` y
   * no un `= fn`, igual que los `alCambiar`/`alPreparar` del cajón: un asignador
   * desengancharía al primer oyente en silencio. Ver {@link notificarDiagnostico}.
   *
   * @type {Set<(d: object|null) => void>}
   */
  const oyentesDiagnostico = new Set()

  // ── Escritura en la cáscara ────────────────────────────────────────────────

  /**
   * Escribe el renglón del CTA. Vacío + sin modificador es «no ha pasado nada
   * todavía»: el CSS lo colapsa (`:empty`) y el pie no da un salto.
   *
   * @param {string} texto
   * @param {boolean} fallo
   */
  function decir(texto, fallo) {
    renglon.textContent = texto
    renglon.classList.toggle(CLASE_ESTADO_ERROR, fallo)
  }

  /**
   * Estado del CTA. Es a la vez el suscriptor del store y lo que se llama al acabar
   * cada consulta, así que la regla vive en UN solo sitio.
   *
   * ── POR QUÉ EL MOTIVO SOLO SE ESCRIBE CON EL RENGLÓN VACÍO ──
   * Calcado de `cableado-catastro.js#refrescar`, y por lo mismo: esto corre en cada
   * `set` del store —o sea, en cada vértice que F06 mueva—, y escribir sin
   * condición borraría el desenlace de la última acción un instante después de
   * haberlo puesto. El renglón VACÍO es el único estado que no es de nadie, y es
   * justo el que se ve al abrir la app con el botón ya gris.
   *
   * @param {object|null} parcelaActual
   */
  function refrescarBoton(parcelaActual) {
    const sinOficial = !puedeDiagnosticar(parcelaActual)
    boton.disabled = sinOficial
    if (sinOficial && renglon.textContent === '') decir(MOTIVO_SIN_OFICIAL, false)
  }

  // ── La puerta 2: «Traer el parcelario de fondo» ────────────────────────────

  /**
   * Escribe el renglón propio de la puerta 2. Gemelo de {@link decir} sobre el otro
   * nodo; ver {@link SELECTOR_ESTADO_FONDO} sobre por qué son dos y no uno.
   *
   * @param {string} texto
   * @param {boolean} fallo
   */
  function decirFondo(texto, fallo) {
    renglonFondo.textContent = texto
    renglonFondo.classList.toggle(CLASE_ESTADO_ERROR, fallo)
  }

  /**
   * ¿Puede esta pantalla traer un parcelario de fondo? **Dos condiciones, y ninguna
   * mira si ya hay oficial**: traer OTRO fondo sobre uno que ya está es legítimo (el
   * caso de haberse equivocado de referencia).
   *
   * @param {object|null} parcelaActual
   * @returns {string|null}  El motivo por el que NO, o `null` si sí.
   */
  function porQueNoSePuedeTraerFondo(parcelaActual) {
    if (typeof catastro?.cargar !== 'function') return MOTIVO_FONDO_SIN_CATASTRO
    if (recintosDe(parcelaActual).length === 0) return MOTIVO_FONDO_SIN_GEOMETRIA
    return null
  }

  /**
   * Estado del botón de la puerta 2. Mismo criterio de escritura que
   * {@link refrescarBoton} —el motivo solo con el renglón vacío—, y por lo mismo:
   * esto corre en cada `set` del store.
   *
   * ── ⛔ CON PARCELARIO YA TRAÍDO, EL BOTÓN SE ESCONDE. ES UNA DECISIÓN MEDIDA ──
   * El pie de Validación tenía tres CTA y éste es el cuarto. **Medido con el guion
   * 16 el 2026-08-08, a 1280×720 y con un sobrante de 2 piezas**: el botón cuesta
   * 40,39 px (con su hueco) y deja la caja de vértices en 103,42 px, por debajo del
   * suelo de 124,57 que aquel guion defiende. Y el panel **no desborda**, así que
   * el síntoma es el peor posible: la tabla encoge en silencio.
   *
   * Se esconde justo donde sobra. Este botón existe para TRAER el parcelario; con
   * uno ya puesto su utilidad es marginal —volver a traerlo si te equivocaste de
   * referencia— y ése es exactamente el estado que el guion 16 mide, porque derivar
   * el sobrante EXIGE contorno oficial. Coste devuelto: los 40,39 px enteros, y cero
   * en el estado que motiva la feature.
   *
   * ⚠️ **Se oculta con `hidden`, no se retira del DOM** (contrato K.1): este mismo
   * cableado guarda la referencia en su cierre y un nodo huérfano seguiría siendo
   * escribible y mudo. Y lleva `disabled` ADEMÁS de `hidden`, que son dos
   * afirmaciones: un botón oculto pero habilitado lo sigue alcanzando el tabulador.
   *
   * ⚠️ **`traerFondo()` sigue en la API y sigue funcionando**: lo que se esconde es
   * el control, no la capacidad. Un guion de humo o un control futuro pueden traer
   * otro fondo sin que este módulo cambie.
   *
   * @param {object|null} parcelaActual
   */
  function refrescarBotonFondo(parcelaActual) {
    const yaHayParcelario = oficialDe(parcelaActual) !== null
    const motivo = yaHayParcelario ? null : porQueNoSePuedeTraerFondo(parcelaActual)

    botonFondo.hidden = yaHayParcelario
    renglonFondo.hidden = yaHayParcelario
    botonFondo.disabled = yaHayParcelario || motivo !== null || trayendoFondo

    if (yaHayParcelario) {
      // Un motivo escrito debajo de un botón invisible es ruido, y encima ocupa.
      if (renglonFondo.textContent !== '') decirFondo('', false)
      return
    }
    // ⛔ **EL MOTIVO QUE DEJA DE SER VERDAD SE RETIRA (2026-08-19), y lo destapó
    // el navegador.** La regla de arriba —escribir solo con el renglón vacío—
    // protege el desenlace de la última acción de ser borrado por el siguiente
    // `set` del store, y eso sigue en pie. Lo que le faltaba es la vuelta: cuando
    // la condición que se contó DESAPARECE, nadie retiraba la frase, así que el
    // botón se encendía con «está apagado porque…» escrito justo debajo.
    //
    // Era inalcanzable hasta hoy: con `MOTIVO_FONDO_SIN_GEOMETRIA` puesto no había
    // forma de fabricar geometría sin cargar otro documento, y eso reinicia la
    // pantalla. El levantamiento de puntos sueltos abre justo ese camino —se entra
    // en Edición sin contorno y se dibuja allí mismo— y con él aparecen las dos
    // mitades contradictorias a la vez, que es el defecto que esta casa ya ha
    // pagado tres veces (M25, M31 y el chip de «0 errores»).
    //
    // ⚠️ Solo se retira **lo que ha escrito esta misma función**. Un desenlace
    // —«el Catastro no contesta», «hay varias parcelas ahí»— no es un motivo de
    // apagado y no se toca: por eso se compara contra el catálogo de motivos y no
    // se vacía a ciegas.
    if (motivo === null && esMotivoDeApagado(renglonFondo.textContent)) {
      decirFondo('', false)
      return
    }
    if (motivo !== null && renglonFondo.textContent === '') decirFondo(motivo, false)
  }

  /**
   * ¿Este texto es uno de los motivos de APAGADO que escribe
   * {@link refrescarBotonFondo}, y no el desenlace de una acción del usuario?
   *
   * Se compara contra el catálogo y no contra «cualquier cosa», porque son los
   * únicos que esta función tiene derecho a retirar: los demás los ha puesto un
   * intento real de traer el fondo y siguen siendo verdad.
   *
   * @param {string} texto
   * @returns {boolean}
   */
  function esMotivoDeApagado(texto) {
    return texto === MOTIVO_FONDO_SIN_GEOMETRIA || texto === MOTIVO_FONDO_SIN_CATASTRO
  }

  /**
   * La referencia catastral con la que pedir el fondo, o `null` si no hay forma de
   * saberla (y entonces ya se ha dicho por qué).
   *
   * ── PRIMERO EL MODELO, DESPUÉS EL MAPA. NUNCA UN CAMPO ──
   * El campo `[data-campo="refcat"]` vive en Entrada y por el contrato K.1 leerlo
   * desde aquí devolvería el `<input>` de otra pantalla —la primera del documento,
   * aunque esté `hidden`—: se traería la parcela de una referencia que el usuario no
   * ha escrito aquí. Así que la referencia sale del MODELO, que es la misma regla con
   * la que F05 enciende «Traer colindantes».
   *
   * Y cuando el modelo no la trae —el caso normal y el que motiva toda la feature: un
   * DXF recién importado— se **deduce del mapa**. `catastro.deducir()` ya existe desde
   * F05, coge un punto INTERIOR de la geometría del store (no el centroide, que en una
   * parcela en L cae fuera), se lo pregunta al Catastro y **nunca escribe en el
   * modelo**. Encadenarlo aquí es lo que convierte «tengo un DXF y quiero ver el
   * parcelario debajo» en una sola pulsación.
   *
   * @param {object|null} parcelaActual
   * @returns {Promise<string|null>}
   */
  async function referenciaParaElFondo(parcelaActual) {
    const delModelo = referenciaDe(parcelaActual)
    if (delModelo !== null) return delModelo

    if (typeof catastro.deducir !== 'function') {
      decirFondo(MOTIVO_FONDO_SIN_DEDUCIR, true)
      return null
    }
    const resultado = await catastro.deducir()
    if (destruido) return null
    // `null` (sin geometría, sin punto interior) y `ok:false` ya los ha contado F05
    // por su renglón y por el panel, con su motivo. Repetirlo aquí sería decirlo dos
    // veces con dos redacciones.
    if (resultado === null || resultado.ok !== true || !resultado.datos) return null

    const { candidatos, unico } = resultado.datos
    if (unico !== true) {
      decirFondo(motivoFondoVariasParcelas(candidatos), true)
      return null
    }
    return candidatos[0].refcat
  }

  /**
   * ⭐ **«Traer el parcelario de fondo».** La acción que el aviso ofrece EN SITIO, en
   * vez de mandar al usuario a Entrada — donde el único botón que hay es el que
   * sustituye su medición por la del Catastro.
   *
   * Todo el trabajo lo hace `cablearCatastro`: aquí solo se decide **con qué
   * referencia** y **con qué intención** (`sustituir: false`). Este módulo sigue sin
   * escribir en el store ni una vez, que es su invariante desde F07: el diagnóstico
   * mide, no edita.
   *
   * @returns {Promise<void>}
   */
  async function traerFondo() {
    if (destruido || trayendoFondo) return
    const parcelaActual = estado.get()
    const motivo = porQueNoSePuedeTraerFondo(parcelaActual)
    if (motivo !== null) {
      decirFondo(motivo, false)
      return
    }

    trayendoFondo = true
    refrescarBotonFondo(parcelaActual)
    decirFondo(MENSAJE_FONDO_EN_CURSO, false)
    try {
      const refcat = await referenciaParaElFondo(parcelaActual)
      if (destruido) return
      if (refcat === null) return // ya se ha dicho por qué, arriba o en F05
      // Y el desenlace lo cuenta el renglón de F05, que es el que sabe si el dato
      // vino de la red o de la copia local. Aquí se limpia el «pidiendo…» para no
      // dejar dos renglones contando la misma consulta con distinto tiempo verbal.
      await catastro.cargar({ refcat, sustituir: false })
      if (!destruido) decirFondo('', false)
      // ── ⭐ Y ADEMÁS LAS VECINAS ────────────────────────────────────────────
      // El botón se llama «traer el PARCELARIO», y pedir solo `GetParcel` no lo
      // trae: quien suelta un .dxf y lo pulsa ve aparecer su parcela oficial SOLA
      // en mitad del mapa, sin nada alrededor con lo que situarla — que es justo
      // lo que se venía a mirar. Las vecinas ya se sabían pedir (`pedirVecinas`,
      // desde F07) y ya se sabían pintar (F05); lo único que faltaba era que este
      // botón las pidiera.
      //
      // ⚠️ **DESPUÉS de `cargar`, y el orden NO es estético.** `colindantes()` lee
      // la referencia del MODELO, y con un .dxf el modelo no la tiene hasta que
      // `cargar({sustituir:false})` la adopta: invertir las dos llamadas pediría
      // las vecinas de `null`.
      //
      // ⚠️ **Un fallo aquí NO es una avería de este botón**, y por eso el renglón
      // del fondo se limpia ANTES: cuando esto corre, el parcelario ya ha entrado.
      // Que no lo cuente el `catch` de abajo no es suerte ni orden de líneas —está
      // dentro del mismo `try`—: es que `pedirVecinas` **atrapa lo suyo** y no
      // propaga nunca. Lo cuenta por el renglón del DIAGNÓSTICO y por la consola,
      // que es de quien es el fallo. Contarlo además como «no se ha podido traer el
      // parcelario» diría que ha fallado algo que ha ido bien.
      //
      // `pedirVecinas` es idempotente en lo caro (override O8): si ya las hay, no
      // pide nada. Por eso abrir el diagnóstico después de esto no vuelve a la red.
      if (!destruido) await pedirVecinas()
    } catch (causa) {
      // `cargar` y `deducir` propagan los fallos INESPERADOS (los del catálogo salen
      // por `ok:false`). F05 ya los ha contado por tres canales; aquí solo se cierra
      // el renglón para que el usuario no se quede mirando un «pidiendo…» eterno.
      decirFondo(MENSAJE_FONDO_ROTO, true)
      console.error('cablearDiagnostico: fallo al traer el parcelario de fondo', causa)
    } finally {
      trayendoFondo = false
      if (!destruido) refrescarBotonFondo(estado.get())
    }
  }

  // ── El cálculo ─────────────────────────────────────────────────────────────

  /**
   * Recalcula y repinta las DOS vistas. No hace nada con el cajón cerrado: medir
   * para no enseñarlo cuesta los mismos ~67 ms y no lo mira nadie.
   *
   * Un fallo aquí es un defecto de programación (los datos malos del usuario los
   * traduce `diagnosticar` a `saltados` y a `omisiones`, no a excepciones), así que
   * se cuenta como tal —panel con `NIVEL.ERROR` y consola— y **no se deja subir**:
   * este camino se alcanza desde un suscriptor del store, y dejar reventar ahí
   * tumbaría también a los otros suscriptores, que no tienen la culpa.
   */
  /**
   * Avisa de que {@link ultimoDiagnostico} acaba de cambiar (rework de UI · T9).
   *
   * ⛔ **Esto existe para borrar un apaño con fecha de caducidad.** T5 tuvo que
   * refrescar los hechos del rail «a ojo» —una microtarea al soltar el clic del CTA
   * y otra pasada 500 ms después, por si habían llegado las vecinas— porque este
   * módulo **no notificaba a nadie**: `ultimoDiagnostico()` era una lectura, no un
   * canal. El paso «Informe» del rail depende de que haya diagnóstico, así que sin
   * aviso el rail se enteraba tarde, o no se enteraba.
   *
   * Se llama en los DOS sitios donde el diagnóstico deja de ser el que era: cuando
   * se calcula uno nuevo y cuando se olvida el que había. Un oyente roto se cuenta y
   * no interrumpe: quien avisa ya ha hecho su trabajo.
   */
  function notificarDiagnostico() {
    for (const fn of [...oyentesDiagnostico]) {
      try {
        fn(ultimoDiagnostico)
      } catch (causa) {
        console.error('cablearDiagnostico: un oyente de alDiagnostico ha reventado', causa)
      }
    }
  }

  function recalcular() {
    if (destruido || !cajon.abierto()) return
    const parcelaActual = estado.get()
    const recintos = recintosDe(parcelaActual)
    const geometriaOficial = oficialDe(parcelaActual)

    if (recintos.length === 0) {
      olvidarDiagnostico()
      contraste.pintar(null)
      cajon.estado('No hay geometría que diagnosticar.')
      return
    }

    try {
      const d = diagnosticar({
        recintos,
        geometriaOficial,
        superficieCatastral:
          typeof parcelaActual.superficieCatastral === 'number'
            ? parcelaActual.superficieCatastral
            : null,
        superficieRegistral: cajon.registral(),
        vecinas,
        clase: cajon.clase(),
        // Para PROPONER la clase cuando nadie la ha elegido. Sin normalizar: la del
        // modelo ya viene del Catastro o la ha escrito el usuario, y
        // `diagnostico/margen.js` reconoce las dos formas.
        refcat: typeof parcelaActual.refcat === 'string' ? parcelaActual.refcat : null,
      })
      ultimoDiagnostico = d
      cajon.pintar(d)
      contraste.pintar(d, { recintos, geometriaOficial })
      notificarDiagnostico()
    } catch (causa) {
      // Se OLVIDA el anterior, y no es celo: el informe se compone del último
      // diagnóstico, y dejar en pie el de hace dos ediciones ofrecería descargar
      // unas cifras que ya no describen la parcela que hay en el store. `pintar(null)`
      // vacía el cajón Y apaga el botón del informe con su motivo, las dos cosas de
      // una vez. El renglón de estado se escribe DESPUÉS: `pintar` no lo toca.
      olvidarDiagnostico()
      cajon.estado('El diagnóstico ha fallado. Mira el panel de avisos.')
      panel.avisar(MENSAJE_FALLO_INESPERADO, { nivel: NIVEL.ERROR, causa })
      console.error('cablearDiagnostico: fallo al diagnosticar', causa)
    }
  }

  // ── El informe de contraste (F08 · T4.2) ───────────────────────────────────

  /**
   * Tira el último diagnóstico y deja el cajón coherente con esa verdad: en blanco
   * y con el botón del informe apagado —el cajón escribe su propio motivo—. Es el
   * ÚNICO camino por el que `ultimoDiagnostico` vuelve a `null`, para que el
   * invariante que sostiene la guarda del botón no dependa de acordarse.
   */
  function olvidarDiagnostico() {
    // Sin este `if`, olvidar dos veces seguidas —que pasa: cada `set` del store con
    // la geometría vacía pasa por aquí— despertaría al rail para decirle lo mismo.
    const habia = ultimoDiagnostico !== null
    ultimoDiagnostico = null
    cajon.pintar(null)
    if (habia) notificarDiagnostico()
  }

  /**
   * Compone el informe de contraste EN TEXTO y lo entrega.
   *
   * ── ⛔ YA NO TIENE BOTÓN (2026-08-15) ──────────────────────────────────────
   * Era lo que se llamaba al pulsar «Descargar informe de contraste» en el pie del
   * cajón. **El botón se ha retirado por encargo del autor** —«solo necesito el
   * pdf»— y esta función se queda: sigue en la API, sigue probada y sigue siendo
   * la única salida que se compone SIN RED (no pide una tesela al WMS), que era la
   * degradación declarada de F09 para el día que el plano no se pueda armar.
   *
   * Es una decisión consciente, no un olvido: quitar el botón es cosa de la
   * interfaz, y borrar `report/contraste-texto.js` con sus ficheros de prueba es
   * otra cosa, y es del autor. Mientras tanto, esto es exactamente lo que la
   * cabecera de esta función ya decía que también era: algo que se puede disparar
   * desde fuera (un guion de humo, un atajo, una consola).
   *
   * Los dos fallos posibles se cuentan por SEPARADO y con mensajes distintos —ver
   * {@link MENSAJE_INFORME_NO_COMPUESTO} y {@link MENSAJE_INFORME_NO_ENTREGADO}—,
   * y ninguno se deja subir: esto corre dentro de un oyente del DOM, y una
   * excepción lanzada ahí **no sale por `dispatchEvent`** (medido en F08 · T3.2).
   * Se reportaría como error no capturado en `window`, el usuario vería que no pasa
   * nada y el único rastro quedaría en una consola que un técnico del Catastro no
   * abre nunca.
   *
   * @returns {object|null}  El `ResultadoDescarga` de `gml/descargar.js`, o `null`
   *   si no se llegó a intentar la entrega.
   */
  function descargarInforme() {
    if (destruido) return null

    if (ultimoDiagnostico === null) {
      // El `disabled` del botón es cortesía; la garantía es esta comprobación —la
      // misma doctrina que el CTA de arriba—. Y el POR QUÉ no se reescribe aquí:
      // lo escribe el cajón en su propio renglón en el mismo instante en que apaga
      // el botón, así que basta con asegurarse de que el gate está bajado. Dos
      // redacciones del mismo motivo, en dos módulos, divergirían.
      cajon.pintar(null)
      return null
    }

    // Un solo instante para el texto y para el nombre del fichero, igual que hace
    // `app/main.js` con el GML: si se leyeran dos veces el reloj, la cabecera y el
    // nombre podrían discrepar en el cambio de segundo y el fichero de la carpeta
    // dejaría de emparejarse con su contenido.
    const fecha = ahora()
    const parcelaActual = estado.get()

    let texto
    try {
      texto = informeContrasteTexto({
        // `null` es un caso legítimo y frecuente, no una degradación: la parcela
        // llegó por referencia catastral y no hubo fichero que comprobar.
        comprobacion: comprobacion(),
        diagnostico: ultimoDiagnostico,
        parcela: parcelaActual,
        fecha,
      })
    } catch (causa) {
      cajon.estadoInforme('El informe no se ha podido componer. Mira el panel de avisos.')
      panel.avisar(MENSAJE_INFORME_NO_COMPUESTO, { nivel: NIVEL.ERROR, causa })
      console.error('cablearDiagnostico: fallo al componer el informe de contraste', causa)
      return null
    }

    let entrega
    try {
      entrega = descargar(texto, {
        nombreFichero: nombreFicheroInforme({ refcat: referenciaDe(parcelaActual), fecha }),
        mime: TIPO_MIME_TEXTO,
      })
    } catch (causa) {
      // `descargarTexto` PROPAGA lo que lance el `click()` (una extensión que ha
      // manipulado el DOM), después de haber limpiado. Aquí se cierra el renglón
      // para que el usuario no se quede mirando un botón que aparentemente no hizo
      // nada.
      cajon.estadoInforme('El informe no ha bajado. Mira el panel de avisos.')
      panel.avisar(MENSAJE_INFORME_NO_ENTREGADO, { nivel: NIVEL.ERROR, causa })
      console.error('cablearDiagnostico: fallo al entregar el informe de contraste', causa)
      return null
    }

    // El desenlace se dice SIEMPRE, salga bien o mal. Cuando no baja, `descargarTexto`
    // trae un `mensaje` en castellano ya presentable: se enseña tal cual y no se
    // duplica en el panel, porque el panel es para lo que le pasa al DATO y esto es
    // lo que le ha pasado a la ENTREGA.
    cajon.estadoInforme(
      entrega.descargado ? `Descargado «${entrega.nombre}».` : entrega.mensaje,
    )
    return entrega
  }

  // ── Las colindantes ────────────────────────────────────────────────────────

  /**
   * Adopta las vecinas de un resultado del Catastro y repinta si el cajón está
   * abierto. Es el ÚNICO camino por el que `vecinas` deja de ser `null`, y por eso
   * se llega a él tanto desde la petición propia como desde el botón «Traer
   * colindantes» de F05: quien ya las trajo no tiene que traerlas otra vez.
   *
   * ── ⛔ Y SE COTEJA DE QUÉ PARCELA SON (auditoría 2026-08-16) ────────────────
   * Este canal es público y ASÍNCRONO: lo que llega puede haberse pedido para la
   * parcela de antes. El caso medido: cajón abierto sobre A con `colindantes(A)`
   * en vuelo, entra B por una vía que **no es F05** (un fichero, un `.json`
   * restaurado) —así que nadie invalida aquella consulta—, llega la respuesta de A
   * y se adopta como vigente. A partir de ahí `vecinas` ya no es `null`, o sea que
   * {@link pedirVecinas} **no vuelve a consultar nunca**, y la invasión de B se
   * mide contra las vecinas de A, con las referencias catastrales de A. De ahí
   * pasa al PDF firmable por `ultimoDiagnostico`.
   *
   * Lo que se descarta no se anuncia al usuario, y es la misma decisión que toma
   * `cableado-catastro.js` con una consulta superada: el cajón sigue diciendo «no
   * se han consultado», que es **exactamente** lo que ha pasado con las de esta
   * parcela, y la siguiente apertura las pedirá. El rastro técnico va a la consola.
   *
   * @param {import('../services/catastro.js').ResultadoCatastro} resultado
   */
  function adoptar(resultado) {
    if (destruido) return
    if (!resultado || !resultado.ok || !resultado.datos) return
    // La que declara el resultado manda; la que apuntó `pedirVecinas` es el
    // respaldo para los servicios que se omiten a sí mismos. Ver `claveDelResultado`.
    const declarada = claveDelResultado(resultado) ?? clavePedida
    if (declarada !== null && declarada !== claveDeExpediente(estado.get())) {
      console.warn(
        'cablearDiagnostico: se descartan unas colindantes que no son de la parcela que hay en ' +
          `pantalla (llegaron las de ${declarada}).`,
      )
      return
    }
    vecinas = aVecinas(resultado.datos.colindantes)
    recalcular()
  }

  /**
   * UNA petición de vecinas, y solo si no las hay. El resto de casos —ya
   * consultadas, sin cliente, otra petición en vuelo— salen por arriba sin tocar la
   * red: una apertura, una petición (override O8).
   *
   * **El diagnóstico ya está pintado antes de llamar a esto**, así que un fallo
   * aquí solo escribe el renglón. Es la regla que este módulo defiende: un fallo de
   * red no puede tumbar las ocho medidas que no dependen de la red.
   */
  async function pedirVecinas() {
    if (destruido || vecinas !== null || pidiendo) return
    if (catastro === null) {
      decir(MOTIVO_SIN_CATASTRO, false)
      return
    }
    pidiendo = true
    // PARA QUÉ parcela se piden. `adoptar` lo necesita para poder descartar lo que
    // llegue tarde cuando el resultado no declara identidad; ver su cabecera.
    clavePedida = claveDeExpediente(estado.get())
    try {
      // La adopción y el repintado llegan por `alColindantes` (el cableado de F05
      // publica ANTES de devolver), así que aquí solo queda contar el desenlace. Un
      // segundo camino de adopción desde este `resultado` traduciría dos veces lo
      // mismo y dejaría dos sitios donde equivocarse.
      const resultado = await catastro.colindantes()
      if (destruido) return
      if (resultado === null) return
      if (!resultado.ok) {
        // El motivo largo ya lo ha contado el cableado de F05 por su renglón y por
        // el panel. Aquí se dice lo ÚNICO que este módulo sabe y aquel no: que el
        // resto del diagnóstico sigue en pie.
        decir(COLA_SIN_VECINAS, true)
        cajon.estado('Invasión a colindantes: no se ha podido consultar.')
      }
    } catch (causa) {
      // `colindantes()` propaga los fallos INESPERADOS (los del catálogo salen por
      // `ok:false`). Ya se han contado por tres canales en F05; aquí solo se cierra
      // el renglón para que el usuario no se quede mirando un cajón a medias.
      decir(COLA_SIN_VECINAS, true)
      cajon.estado('Invasión a colindantes: no se ha podido consultar.')
      console.error('cablearDiagnostico: fallo al pedir las colindantes', causa)
    } finally {
      pidiendo = false
      clavePedida = null
    }
  }

  /**
   * Abre el cajón, pinta con lo que hay y **después** pide las vecinas si faltan.
   * Ese orden es la decisión: el usuario ve las ocho medidas al instante y la
   * invasión aparece cuando llega, en vez de mirar un cajón vacío mientras la red
   * trabaja.
   *
   * @param {Event|null} [evento=null]  El clic que lo está abriendo, si viene de
   *   uno. Se le pasa al cajón para que su guardián del clic fuera no cuente como
   *   «clic fuera» el mismo clic del CTA —que vive en el pie, o sea fuera— y lo
   *   cierre en el mismo gesto. Ver `viewer/cajon-diagnostico.js#_cerrarPorClicFuera`.
   * @returns {Promise<void>}
   */
  async function abrir(evento = null) {
    if (destruido) return
    if (!puedeDiagnosticar(estado.get())) {
      decir(MOTIVO_SIN_OFICIAL, false)
      return
    }
    decir('', false)
    cajon.abrir(evento)
    cajon.estado('')
    recalcular()
    await pedirVecinas()
  }

  // ── Oyentes ────────────────────────────────────────────────────────────────

  /**
   * El manejador suelta la promesa a propósito, igual que los cuatro de F05: lo que
   * puede fallar dentro ya se ha contado por el renglón, por el cajón y por la
   * consola antes de resolverse. Quien llama a `abrir()` desde la API sí recibe la
   * promesa.
   */
  const alPulsar = (evento) => {
    abrir(evento).catch(() => {})
  }

  /**
   * El suscriptor del store: UNA vez por operación acabada (ver la cabecera sobre
   * por qué no `alPrevisualizar`).
   *
   * @param {object|null} parcelaActual
   */
  /**
   * Tira TODO lo que estaba medido contra el parcelario anterior: las vecinas
   * consultadas, el cajón, el diagnóstico guardado y las manchas del mapa.
   *
   * Vive en una función con nombre porque tiene DOS disparadores que no se parecen
   * en nada, y sólo uno de los dos puede detectarse desde aquí:
   *   · **otra parcela** — lo ve {@link alCambiarElStore} por la clave de identidad;
   *   · **otro parcelario bajo la MISMA parcela** — la puerta de contexto del
   *     Catastro. La identidad no se mueve, así que este módulo no puede verlo:
   *     se lo dice `app/main.js` por {@link olvidarPorFondoNuevo}.
   *
   * El diagnóstico se OLVIDA y no se recalcula. El cajón queda cerrado, así que
   * `recalcular()` sale por arriba y no lo repintaría: sin esto el botón del informe
   * se quedaría encendido, y el fichero que bajara hablaría de un parcelario que ya
   * no está — con su referencia catastral en el nombre. Es el fallo más caro que
   * este pie podría cometer, y es silencioso.
   */
  function olvidarLoMedidoContraElFondo() {
    vecinas = null
    cajon.reiniciarExpediente()
    cajon.cerrar()
    olvidarDiagnostico()
    contraste.pintar(null)
    decir('', false)
  }

  function alCambiarElStore(parcelaActual) {
    if (destruido) return
    const nueva = claveDeExpediente(parcelaActual)
    if (nueva !== clave) {
      clave = nueva
      // Otra parcela: otro expediente, otras vecinas, otro diagnóstico. Ver la
      // cabecera sobre por qué se cierra en vez de recalcular.
      olvidarLoMedidoContraElFondo()
    }
    refrescarBoton(parcelaActual)
    refrescarBotonFondo(parcelaActual)
    recalcular()
  }

  /** Suelta la promesa igual que {@link alPulsar}, y por lo mismo. */
  const alPulsarFondo = () => {
    traerFondo().catch(() => {})
  }

  boton.addEventListener('click', alPulsar)
  botonFondo.addEventListener('click', alPulsarFondo)
  const desuscribirStore = estado.subscribe(alCambiarElStore)
  const bajaCambio = cajon.alCambiar(recalcular)
  // Al cerrar el cajón se limpia el mapa: las manchas y la cota son la MITAD del
  // diagnóstico, y dejarlas pintadas sobre un cajón cerrado sería dejar una
  // anotación sin su explicación.
  const bajaCierre = cajon.alCerrar(() => contraste.pintar(null))
  // ⛔ Aquí iba `cajon.alDescargar(descargarInforme)`. El botón del informe en
  // texto se retiró el 2026-08-15; `descargarInforme` sigue viva y sigue en la API
  // de este cableado, sin botón que la dispare. Ver su cabecera.
  const bajaColindantes = catastro === null ? () => {} : catastro.alColindantes(adoptar)

  // `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`): el primer
  // estado del botón se calcula a mano. Sin esta línea, el CTA se quedaría en el
  // `disabled` con el que nace en `index.html` hasta el primer cambio del store, y
  // quien abra la app con una parcela ya cargada vería gris justo el botón que le
  // hace falta.
  refrescarBoton(estado.get())
  refrescarBotonFondo(estado.get())

  return {
    abrir,
    recalcular,
    descargarInforme,
    traerFondo,

    /**
     * ⭐ **Ha entrado otro parcelario bajo la MISMA parcela** (la puerta de contexto
     * del Catastro, 2026-08-08). Todo lo que este cableado tenía medido se refiere al
     * fondo anterior y hay que tirarlo.
     *
     * ── POR QUÉ HACE FALTA QUE ALGUIEN LO DIGA ──
     * Este módulo se entera solo de que «ha entrado otra parcela», y lo detecta por
     * IDENTIDAD ({@link claveDeExpediente}: referencia catastral o `idLocal`). Es la
     * clave correcta para lo que fue diseñada, y **no se cambia a una clave de
     * contenido**: `referenciaDe` documenta unas líneas más arriba por qué son dos
     * claves distintas, y una clave que mirara la geometría se recalcularía en cada
     * arrastre de un vértice.
     *
     * Pero traer el parcelario de fondo **no mueve la identidad**: la parcela de
     * trabajo sigue siendo la del usuario, con su `idLocal`, y si ya tenía referencia
     * catastral la clave es exactamente la misma que antes. Sin este canal el cajón
     * se quedaría enseñando un solape, una desviación y una invasión medidos contra
     * un contorno oficial que ya no está en el modelo, con el botón del informe
     * encendido encima. Silencioso y firmable: la peor combinación.
     *
     * Es idempotente y barato: llamarlo sin nada que olvidar deja todo igual.
     *
     * @returns {void}
     */
    olvidarPorFondoNuevo() {
      if (destruido) return
      olvidarLoMedidoContraElFondo()
      // El renglón se acaba de vaciar; si el botón queda apagado, su motivo vuelve.
      refrescarBoton(estado.get())
    },

    /**
     * El ÚLTIMO diagnóstico que se PINTÓ en el cajón, o `null` si no hay ninguno.
     *
     * ── POR QUÉ SE EXPONE (F09 · T5.1) ─────────────────────────────────────
     * El informe firmable en PDF lo compone `app/cableado-informe.js`, que
     * escucha el OTRO botón del mismo pie (`alPreparar`) y necesita exactamente
     * las mismas cifras. Las alternativas eran las dos peores:
     *
     *   · **Recalcular allí** con `diagnosticar()`: ~67 ms de bloqueo mientras el
     *     usuario espera, y —lo que decide— una SEGUNDA verdad sobre el mismo
     *     expediente. Habría que reproducir la registral, la clase, las vecinas y
     *     la traducción `ParcelaGml → Vecina`; el día que una de las cuatro
     *     divergiera, el PDF diría una cosa y el cajón del que salió, otra. La
     *     invariante que este módulo defiende desde F08 es justo esa: **el
     *     informe dice EXACTAMENTE lo que dice el cajón**.
     *   · **Duplicar el estado** guardando otra copia en el otro cableado, con
     *     dos sitios que acordarse de poner a `null` cuando entra otra parcela.
     *
     * Es una lectura, no una puerta: devuelve la referencia tal cual y no admite
     * escritura. `null` significa lo mismo que dentro —no hay diagnóstico que
     * enseñar— y es exactamente cuando los dos botones del pie están apagados.
     *
     * @returns {object|null}
     */
    ultimoDiagnostico: () => ultimoDiagnostico,

    /**
     * Se suscribe a los cambios del último diagnóstico. Devuelve la BAJA, igual que
     * los `alAlgo` del cajón. **Rework de UI · T9**, y borra un apaño: ver
     * {@link notificarDiagnostico}, donde está escrito qué se hacía antes y por qué
     * no valía.
     *
     * Se le pasa el diagnóstico nuevo —o `null` si lo que ha pasado es que se ha
     * olvidado el que había—, para que quien escuche no tenga que volver a
     * preguntar. No promete no repetirse: lo que promete es no callarse.
     *
     * @param {(d: object|null) => void} fn
     * @returns {() => void}
     */
    alDiagnostico(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alDiagnostico: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      oyentesDiagnostico.add(fn)
      return () => oyentesDiagnostico.delete(fn)
    },

    /**
     * Deja el cableado inerte: retira el oyente del CTA, la suscripción al store,
     * las TRES del cajón (cambio, cierre y descarga) y la de las colindantes, y
     * **limpia el mapa**. IDEMPOTENTE.
     *
     * No destruye el cajón ni el contraste: son del VISOR y los desmonta
     * `visor.destruir()`. Este módulo desmonta lo que ha montado él, ni más ni
     * menos — la misma regla que hace que `crearVisor` sea atómico. Consecuencia
     * buscada: tras destruir, el botón del informe sigue en el DOM y sigue
     * pulsable, pero ya no llama a nadie.
     */
    destruir() {
      if (destruido) return
      destruido = true
      boton.removeEventListener('click', alPulsar)
      botonFondo.removeEventListener('click', alPulsarFondo)
      desuscribirStore()
      bajaCambio()
      bajaCierre()
      bajaColindantes()
      oyentesDiagnostico.clear()
      contraste.pintar(null)
    },
  }
}

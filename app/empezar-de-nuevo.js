// app/empezar-de-nuevo.js — «Vaciarlo»: la salida del expediente en curso.
//                                                          (2026-08-09)
//
// ── QUÉ HACE, EN UNA FRASE ─────────────────────────────────────────────────
// Enseña un renglón en el pie de Entrada cuando hay algo cargado, y al segundo
// clic llama a `alVaciar`. **No vacía nada él**: quién sabe vaciar es
// `app/main.js`, que es el único que conoce las veinte piezas que hay montadas.
//
// ── ⛔ EL HUECO QUE CIERRA, Y POR QUÉ ERA UN HUECO DE VERDAD ───────────────
// Esta aplicación tenía CUATRO puertas de entrada —el Catastro, un `.dxf`/`.txt`,
// un `.gml` y un expediente guardado— y **ni una de salida**. Quien soltaba el
// fichero equivocado, elegía la finca que no era o tecleaba la referencia de al
// lado se quedaba con ella: no hay ningún gesto en toda la interfaz que devuelva
// la pantalla al estado con el que arranca. Recargar a mano tampoco servía, y ése
// es el detalle que lo convertía en un defecto en vez de en una molestia: la
// aplicación escribe el paso en el hash (`#/parcela/edicion`, decisión D3 de
// `app/main.js`) y el `?demo=` viaja en la query, así que F5 vuelve a entrar con
// exactamente lo mismo con lo que se salió.
//
// ── ⚠️ DOS TIEMPOS, Y ESTÁ COPIADO DE DONDE YA FUNCIONABA ─────────────────
// Vaciar es irreversible EN PANTALLA (lo autoguardado sobrevive: ver abajo), así
// que el primer clic ARMA y lo escribe en el renglón de estado, y el segundo
// —dentro de {@link MS_CONFIRMAR}— vacía. Es el mismo patrón, con el mismo plazo,
// que `app/cableado-expediente.js#MS_CONFIRMAR_BORRADO` usa desde F10 para borrar
// un expediente guardado. No se abre un `<dialog>` de confirmación: sería el
// séptimo de la aplicación y el único que se traga un gesto entero para preguntar
// lo que un renglón `role="status"` ya pregunta sin tapar la pantalla.
//
// El plazo se OLVIDA solo. Un armado que durase para siempre convertiría el
// «Vaciarlo» de dentro de diez minutos en un vaciado a la primera, y el usuario no
// tendría cómo saber que su primer clic sigue contando.
//
// ── ⭐ LO AUTOGUARDADO NO SE TOCA, Y ES LA DECISIÓN DEL AUTOR (2026-08-09) ──
// «Vaciar» limpia la PANTALLA. El borrador que `storage/autoguardado.js` viene
// escribiendo cada dos segundos se queda en IndexedDB, así que un clic de más no
// destruye una tarde de trabajo: se recupera por «Expediente», y la propia app lo
// dice sola al arrancar (`mensajeHayBorrador`). Es la misma regla que ya gobierna
// el arranque —**ofrecer, no imponer**— aplicada a la salida.
//
// Consecuencia declarada, para que nadie la lea como un defecto: **después de
// vaciar, la aplicación avisa de que hay trabajo autoguardado sin abrir.** Es
// correcto y es el punto: el aviso es la red debajo del trapecio.
//
// ── ⛔ POR QUÉ ESTE MÓDULO NO SABE VACIAR ─────────────────────────────────
// Porque no puede saberlo sin mentir. `app/main.js` monta dieciocho cableados y
// varios llevan estado propio en `let` de módulo —las colindantes traídas, el
// último diagnóstico, el sobrante derivado, la elección de finca pendiente, la
// identidad del expediente abierto—, y ninguno de ellos se entera de un
// `estado.set(null)`. Un vaciado que solo tocara los dos stores dejaría la ficha
// del pie diciendo «3 colindantes» sobre una pantalla vacía, que es exactamente la
// clase de mentira en verde que este repositorio lleva quince fases pagando. Así
// que el ACTO se le pide a quien lo tiene todo delante y este módulo se queda con
// lo que sí es suyo: cuándo ofrecerlo y cuándo no.

// ── ⛔ EL DEFECTO DEL 2026-08-15: «A VECES SE QUEDA PILLADO» ────────────────
// Lo dijo el autor y era literal. Desde la mudanza al menú de expediente
// (2026-08-10) los dos tiempos vivían DENTRO de un desplegable que, desde el
// 2026-08-11, se cierra al activar cualquier opción. Sumadas, las dos decisiones
// —cada una correcta por su lado— daban esto, medido con barra y este módulo
// montados juntos:
//
//   1. Primer clic: se escribe la confirmación en el renglón… y el mismo clic
//      cierra el menú, así que **el renglón se va con él sin haberse leído**.
//   2. Para el segundo clic hay que reabrir el menú y volver a pulsar: tres
//      gestos, y todos dentro de {@link MS_CONFIRMAR}.
//   3. Si se tardaba más —lo normal, porque nadie corre contra un plazo que no
//      sabe que existe—, el clic volvía a ARMAR. Pantalla idéntica, nada pasa.
//      Un botón que se traga los clics.
//   4. Y el `role="status"` tampoco salvaba a nadie: un `aria-live` dentro de un
//      subárbol oculto no se anuncia, así que la pregunta no llegaba ni por ahí.
//
// Se cierra por los dos lados, y ninguno de los dos es el plazo (el plazo está
// bien: ver {@link MS_CONFIRMAR}):
//
//   · **El menú se queda abierto mientras se pregunta.** El botón lleva el
//     `data-menu-conserva` de `app/barra.js` SOLO mientras está armado, así que
//     el clic que arma deja el menú puesto —con la pregunta debajo y el foco en
//     el mismo botón— y el que confirma lo cierra como cualquier otra opción.
//   · **El armado se olvida EN PANTALLA, no solo en el reloj.** Al caducar, un
//     temporizador borra el renglón. Antes el texto se quedaba puesto para
//     siempre: se leía «Vuelve a pulsar para confirmarlo» cuando pulsar ya solo
//     volvía a armar, que es la definición de una pantalla que miente.
//
// ⚠️ Y el test de este módulo montaba el DOM real **sin la barra**, así que las
// dos primeras estaban en verde. Desde hoy monta las dos piezas juntas.

// ⚠️ **Única dependencia de este módulo, y es un contrato de verdad, no una
// comodidad**: el atributo con el que se le pide al menú que no se cierre lo
// define quien cierra el menú. Copiar aquí la cadena `'data-menu-conserva'`
// habría sido la clase de duplicado que se desincroniza en silencio el día que
// aquél la renombre —y el síntoma sería exactamente el defecto que esta línea
// arregla—. No es el caso de {@link MS_CONFIRMAR}, que repite un NÚMERO porque lo
// que comparte con `cableado-expediente.js` es el patrón, no un contrato.
import { ATRIBUTO_CONSERVA } from './barra.js'

// ── El contrato de marcado ──────────────────────────────────────────────────

/**
 * El renglón entero, el que se enseña y se esconde. Es `<p>` y no el botón a
 * secas: ocultar solo el botón dejaría la pregunta «¿Quieres empezar de cero?»
 * flotando sin respuesta.
 */
export const SELECTOR_FILA = '[data-pie="empezar-de-nuevo"]'

/** El botón. */
export const SELECTOR_BOTON = '[data-accion="empezar-de-nuevo"]'

/** El renglón `role="status"` donde se pide la confirmación. */
export const SELECTOR_ESTADO = '[data-estado="empezar-de-nuevo"]'

// ── Tiempos y textos ────────────────────────────────────────────────────────

/**
 * Cuánto dura el armado antes de olvidarse: **5 segundos**.
 *
 * No es una cifra nueva: es la de {@link
 * import('./cableado-expediente.js').MS_CONFIRMAR_BORRADO}, el otro sitio de la
 * aplicación donde se pide dos veces lo mismo. Se repite el número en vez de
 * importarlo a propósito — traer aquí aquel módulo (2.300 líneas, IndexedDB,
 * validación) para leer una constante ataría dos piezas que no tienen nada más en
 * común. Lo que se comparte es el patrón, no el código.
 */
export const MS_CONFIRMAR = 5000

/**
 * Lo que se lee tras el PRIMER clic. Dice las tres cosas que hacen falta: **qué
 * hace**, **que no se pierde nada** y **cómo se confirma**.
 */
export const MENSAJE_ARMADO =
  'Vuelve a pulsar «Vaciarlo» para confirmarlo. Se cierra lo que hay en pantalla y la aplicación ' +
  'vuelve a empezar; el trabajo autoguardado NO se borra, y podrás recuperarlo desde «Expediente».'

// ── Utilidades ──────────────────────────────────────────────────────────────

/**
 * El reloj de pared del documento, para el olvido del armado.
 *
 * ⚠️ NO se usa el `setTimeout` global a propósito, por lo mismo que no se toma el
 * `document` global: en jsdom el del documento es el que la prueba puede parar al
 * desmontar. Si el documento no trae ventana (un `Document` suelto), se cae al
 * global — perder el olvido no puede costar una excepción.
 */
const relojDe = (documento) => documento.defaultView ?? globalThis

/** ¿Sirve como documento? DUCK TYPING, igual que `app/pantalla.js` y `app/rama.js`. */
const esDocumento = (d) => !!d && typeof d === 'object' && typeof d.querySelector === 'function'

/** ¿Sirve como elemento del DOM? @param {*} el */
const esElementoDOM = (el) => !!el && typeof el === 'object' && el.nodeType === 1

/** ¿Sirve como store de `viewer/_comun.js#crearEstadoVista`? @param {*} s */
const esStore = (s) =>
  !!s && typeof s === 'object' && typeof s.get === 'function' && typeof s.subscribe === 'function'

// ── API pública ─────────────────────────────────────────────────────────────

/**
 * @typedef {Object} EmpezarDeNuevo
 * @property {() => boolean} hayAlgo   Si ahora mismo hay algo que vaciar. Es lo
 *   que decide si el renglón se ve.
 * @property {() => boolean} armado    Si el primer clic sigue contando.
 * @property {() => void} refrescar    Vuelve a preguntar a los stores y repinta.
 *   Se expone para quien vacíe SIN pasar por los stores (nadie hoy) y para el test.
 * @property {() => void} destruir     Desarma, esconde el renglón, se da de baja
 *   de los dos stores y deja de oír el clic. IDEMPOTENTE.
 */

/**
 * Cablea el «Vaciarlo» del pie de Entrada.
 *
 * @param {Object} opciones
 * @param {Document} opciones.documento
 * @param {object} opciones.estado          El store de PARCELA (`crearEstadoVista`).
 * @param {object} opciones.estadoEdificio  El store de EDIFICIO.
 * @param {() => void} opciones.alVaciar    Lo que hace el vaciado de verdad. Lo pone
 *   `app/main.js`; ver «POR QUÉ ESTE MÓDULO NO SABE VACIAR» en la cabecera. Si
 *   LANZA, el error sube: es un fallo del programador y la regla de oro 1 lo quiere
 *   sonando, no tragado.
 * @param {() => Date} [opciones.ahora]     El reloj, inyectado como en
 *   `storage/cache-catastro.js` y `app/cableado-expediente.js`. Es el que decide si
 *   un clic CONFIRMA o vuelve a armar, y se mueve a mano en la prueba.
 *
 *   ⚠️ **El olvido del renglón NO usa este reloj y no puede usarlo**: repintar
 *   solo hay que hacerlo, y para eso hace falta un temporizador de verdad (ver
 *   `armar`). Su prueba estrena el `vi.useFakeTimers` que la línea anterior de este
 *   comentario juraba que no haría falta, y lo estrena aquí porque el defecto que
 *   cierra —un renglón que sigue diciendo «vuelve a pulsar» cuando pulsar ya no
 *   confirma— no se puede medir sin dejar pasar el tiempo.
 * @returns {EmpezarDeNuevo}
 */
export function cablearEmpezarDeNuevo({
  documento,
  estado,
  estadoEdificio,
  alVaciar,
  ahora = () => new Date(),
} = {}) {
  if (!esDocumento(documento)) {
    throw new TypeError(
      `cablearEmpezarDeNuevo: 'documento' debe ser un Document (o un objeto con querySelector); ` +
        `recibido ${typeof documento}. No se toma el global a propósito.`,
    )
  }
  if (!esStore(estado) || !esStore(estadoEdificio)) {
    throw new TypeError(
      `cablearEmpezarDeNuevo: 'estado' y 'estadoEdificio' deben ser los dos stores de ` +
        `viewer/_comun.js#crearEstadoVista (con get y subscribe). Se necesitan LOS DOS: la ` +
        `pantalla puede tener cargada la rama de edificio y ninguna parcela, y al revés.`,
    )
  }
  if (typeof alVaciar !== 'function') {
    throw new TypeError(
      `cablearEmpezarDeNuevo: 'alVaciar' debe ser una función; recibido ${typeof alVaciar}. Sin ` +
        `ella el botón preguntaría dos veces para no hacer nada, que es peor que no tenerlo.`,
    )
  }

  const fila = documento.querySelector(SELECTOR_FILA)
  const boton = documento.querySelector(SELECTOR_BOTON)
  const renglon = documento.querySelector(SELECTOR_ESTADO)
  if (!esElementoDOM(fila) || !esElementoDOM(boton) || !esElementoDOM(renglon)) {
    throw new Error(
      `cablearEmpezarDeNuevo: falta parte del marcado en el documento (fila «${SELECTOR_FILA}»: ` +
        `${esElementoDOM(fila)}, botón «${SELECTOR_BOTON}»: ${esElementoDOM(boton)}, renglón ` +
        `«${SELECTOR_ESTADO}»: ${esElementoDOM(renglon)}). Los tres son contrato con index.html.`,
    )
  }

  let destruido = false
  /** Hasta cuándo cuenta el primer clic, en ms de época. `null` = desarmado. */
  let armadoHasta = null
  /** El temporizador del olvido. `null` = no hay ninguno en marcha. */
  let olvido = null
  const reloj = relojDe(documento)

  /**
   * ¿Hay algo que vaciar?
   *
   * Se pregunta a los DOS stores y basta con que uno diga que sí. Y se pregunta por
   * el documento entero (`!== null`), no por su geometría: una parcela traída del
   * Catastro cuya referencia el usuario ya ha tecleado ES algo que se quiere poder
   * tirar, aunque todavía no tenga ni un vértice propio.
   *
   * ⚠️ **El dibujo de VARIAS fincas sin elegir no cuenta, y es correcto.** Mientras
   * `app/cableado-medicion.js` tiene la elección pendiente, el store sigue vacío…
   * pero es que ahí lo que hay delante es el cajón de fincas, con su propio
   * «Descartar». Ofrecer dos salidas a la misma pantalla sería la trampa que el
   * rework de UI vino a quitar.
   */
  const hayAlgo = () => estado.get() !== null || estadoEdificio.get() !== null

  /**
   * Borra el renglón y olvida el primer clic. **Idempotente**, y deja el botón
   * como estaba: sin el `data-menu-conserva`, o sea volviendo a cerrar el menú al
   * activarse, que es lo normal de una opción.
   */
  function desarmar() {
    armadoHasta = null
    renglon.textContent = ''
    boton.removeAttribute(ATRIBUTO_CONSERVA)
    if (olvido !== null) {
      reloj.clearTimeout(olvido)
      olvido = null
    }
  }

  /**
   * Arma el primer clic: escribe la pregunta, pide que el menú NO se cierre y
   * programa el olvido.
   *
   * ⚠️ El olvido borra el renglón **y solo eso importa de él**: `armado()` ya sabía
   * caducar por reloj, pero el reloj no repinta. Sin este temporizador el renglón
   * se quedaba diciendo «vuelve a pulsar» encima de un botón que ya solo re-armaba.
   */
  function armar(t) {
    armadoHasta = t + MS_CONFIRMAR
    renglon.textContent = MENSAJE_ARMADO
    boton.setAttribute(ATRIBUTO_CONSERVA, '')
    if (olvido !== null) reloj.clearTimeout(olvido)
    olvido = reloj.setTimeout(() => {
      olvido = null
      if (!destruido) desarmar()
    }, MS_CONFIRMAR)
  }

  /** Enseña o esconde el renglón según lo que haya. Idempotente. */
  function refrescar() {
    if (destruido) return
    const visible = hayAlgo()
    fila.hidden = !visible
    // Se desarma al esconderse. Si no, vaciar por otra vía —abrir un expediente,
    // soltar otro fichero— dejaría un armado invisible esperando, y el siguiente
    // «Vaciarlo» vaciaría a la primera sin haber preguntado.
    if (!visible && armadoHasta !== null) desarmar()
  }

  /** El clic, en dos tiempos. Ver {@link MS_CONFIRMAR}. */
  function alPulsar() {
    if (destruido) return
    // El botón no puede pulsarse con la fila escondida (`display:none` lo saca del
    // orden de tabulación y del ratón), pero el nodo SIGUE encontrándose con
    // `querySelector` y sigue oyendo — es la contrapartida declarada en
    // `app/pantalla.js`. Así que se comprueba en vez de suponerlo.
    if (!hayAlgo()) return

    const t = ahora().getTime()
    if (armadoHasta === null || t > armadoHasta) {
      // El olvido de arriba ya suele haber pasado por aquí; esto es la red para el
      // documento sin ventana y para el reloj inyectado que corre más que el real.
      armar(t)
      return
    }
    // Confirmado. Se desarma ANTES de vaciar: `alVaciar` puede no volver nunca
    // —en producción recarga el documento— y dejar el armado puesto sería dejarlo
    // puesto para siempre.
    desarmar()
    alVaciar()
  }

  boton.addEventListener('click', alPulsar)
  const bajaParcela = estado.subscribe(refrescar)
  const bajaEdificio = estadoEdificio.subscribe(refrescar)
  // `subscribe` no notifica al suscribirse (contrato de `crearEstadoVista`), así que
  // la primera pasada va a mano: es la que deja el renglón escondido en el arranque
  // vacío y visible si se monta con algo ya cargado (`?demo=`).
  refrescar()

  return {
    hayAlgo,
    armado: () => armadoHasta !== null && ahora().getTime() <= armadoHasta,
    refrescar,

    destruir() {
      if (destruido) return
      destruido = true
      boton.removeEventListener('click', alPulsar)
      bajaParcela()
      bajaEdificio()
      desarmar()
      fila.hidden = true
    },
  }
}

export default cablearEmpezarDeNuevo

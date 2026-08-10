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
 *   `storage/cache-catastro.js` y `app/cableado-expediente.js`: este repositorio no
 *   tiene ni un `vi.useFakeTimers` y no va a estrenarlo aquí.
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

  /** Borra el renglón y olvida el primer clic. */
  function desarmar() {
    armadoHasta = null
    renglon.textContent = ''
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
      armadoHasta = t + MS_CONFIRMAR
      renglon.textContent = MENSAJE_ARMADO
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

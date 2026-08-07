// app/contraste.js — Rework de UI · T9. LA PANTALLA DE CONTRASTE.
//
// ── QUÉ PROBLEMA RESUELVE, Y POR QUÉ HACÍA FALTA UN MÓDULO ─────────────────
// La aplicación tenía DOS cajones sobre el mapa —el de comprobación (F08) y el
// de diagnóstico (F07)— compartiendo la esquina `bottomleft`, mutuamente
// excluyentes **por acuerdo entre ellos**: `cablearComprobacion` recibía el cajón
// del otro para poder cerrarlo al abrir el suyo. Funcionaba, pero la exclusión
// era una convención entre dos módulos y no una consecuencia del estado.
//
// Con la autoridad de navegación en pie (T1) esa exclusión puede DERIVARSE, y por
// eso T9 la mueve aquí: **qué cajón puede estar abierto es una función del paso**,
// y de nada más. Ver {@link cajonDe}, que es pura y cabe en cuatro líneas.
//
//   · `PASO.ENTRADA`     → el de COMPROBACIÓN. Es lo que sale al soltar un `.gml`:
//                          «esto es lo que traes». Pertenece a la tercera vía de
//                          Entrada, no a una pantalla propia. **Solo en PARCELA.**
//   · `PASO.DIAGNOSTICO` → el de DIAGNÓSTICO en la rama PARCELA, y el de
//                          CONTRASTE DE EDIFICIO en la rama EDIFICIO (F14).
//   · cualquier otro     → ninguno.
//
// ⭐ **F14 añade el segundo eje.** Hasta el 2026-08-07 bastaba con el paso, porque
// la rama EDIFICIO no llegaba a Diagnóstico. Al abrir ese peldaño, la pregunta de
// una sola variable dio el defecto que la fase 4a midió en Chrome: en
// `#/edificio/diagnostico` se montaba el cajón de PARCELA (367 × 413 px) encima de
// una construcción. El peldaño estaba abierto y enseñaba la pantalla equivocada.
// La corrección mantiene lo que T9 ganó: **sigue siendo UNA función pura del
// estado** ({@link cajonDe}), no una bandera repartida por la cáscara.
//
// ── ⛔ EL DEFECTO QUE T9 ARREGLA, MEDIDO ───────────────────────────────────
// Hasta el 2026-08-04, «Contrastar con el parcelario» metía la parcela en el
// store y **cerraba el cajón sin mover al usuario de sitio**. Quien soltaba un
// GML ajeno se quedaba en Entrada mirando las tres vías, con la geometría de otro
// ya cargada por debajo y sin una sola línea en pantalla que dijera de dónde
// había salido: el renglón `[data-procedencia="parcela"]` de `index.html` vive
// DENTRO de la sección de Entrada, así que en cuanto se navega desaparece. La
// ruta crítica 2 del plan de pruebas —«Entrada (soltar `.gml`) → contraste →
// Informe»— no se podía andar.
//
// ── LA PROCEDENCIA SE DECLARA, Y SALE DEL MODELO ───────────────────────────
// No hay un estado paralelo que diga de quién es la geometría: ya lo dice
// `parcela.origen` (`model/parcela.js`, lista cerrada y validada al construir) y
// lo completa el MODO de la navegación. {@link textoProcedencia} los junta, y es
// una función PURA — el texto se compone aquí y se le pasa hecho a la vista,
// porque `viewer/cajon-diagnostico.js` no importa `model/` ni debe empezar ahora.
//
// Los dos ejes dicen cosas distintas y por eso hacen falta los dos:
//   · `origen` — **de dónde salió** el dibujo. No cambia nunca.
//   · `modo`   — **si ya es tuyo**. Cambia al cruzar la puerta (D4), y entonces el
//                origen sigue diciendo GML_EXISTENTE, que es la verdad: lo trajiste
//                de un fichero ajeno y lo has tomado como tuyo.
//
// ── LA PUERTA (decisión D4) SE ENCHUFA AQUÍ ────────────────────────────────
// «Comprobación es una PUERTA, no una cárcel»: el CTA «Tomar esta geometría y
// editarla» llama a `app/navegacion.js#abrirPuerta`, y quien los une es este
// módulo. No lo hace la vista —`viewer/cajon-diagnostico.js` no sabe qué es un
// modo, y no va a empezar— ni `app/cableado-diagnostico.js`, que es de F07 y no
// tiene por qué enterarse de que existe una autoridad de navegación.
//
// El botón se ESCONDE cuando no aplica, en vez de apagarse con un motivo, y es la
// única excepción a la regla de la casa en toda la pantalla: un «tomar esta
// geometría» gris sobre tu propia parcela no tiene ningún motivo que escribir al
// lado. El porqué largo está en `viewer/cajon-diagnostico.js#puerta`.
//
// ── ESTE MÓDULO NO TOCA EL DOM ─────────────────────────────────────────────
// Recibe funciones —abrir esto, cerrar aquello, declarar este texto— y llama a las
// que tocan cuando cambia el paso, el modo o la parcela. No conoce Leaflet, ni los
// cajones, ni un selector. Quién sabe qué función es cuál es `app/main.js`, que es
// la costura y ya lo sabía.
//
// Su test es `test/app/contraste.test.js` (proyecto `node`: no hace falta DOM).

import { ORIGEN_PARCELA } from '../model/parcela.js'
import { MODO, PASO, RAMA } from './navegacion.js'

// ── El vocabulario ───────────────────────────────────────────────────────────

/**
 * Qué cajón puede estar abierto sobre el mapa. **`NINGUNO` es un valor, no la
 * ausencia de uno**: hay pasos en los que la esquina tiene que estar vacía, y
 * decirlo con una cadena permite que {@link cajonDe} sea total.
 *
 * @readonly
 */
export const CAJON = Object.freeze({
  NINGUNO: 'NINGUNO',
  COMPROBACION: 'COMPROBACION',
  DIAGNOSTICO: 'DIAGNOSTICO',
  /**
   * F14 · El contraste de la CONSTRUCCIÓN. Mismo paso que `DIAGNOSTICO` y otra
   * rama: ver {@link cajonDe}, donde está el porqué de que ahora haga falta el
   * segundo eje.
   */
  CONTRASTE_EDIFICIO: 'CONTRASTE_EDIFICIO',
})

/**
 * Qué cajón permite una situación. **FUNCIÓN PURA, y es el corazón de T9**: la
 * exclusión mutua de la esquina `bottomleft` deja de ser un acuerdo entre módulos
 * y pasa a ser una consecuencia del estado de navegación.
 *
 * ── ⭐ F14 · POR QUÉ AHORA MIRA TAMBIÉN LA RAMA ─────────────────────────────
 * Hasta hoy bastaba el paso, porque la rama EDIFICIO **no llegaba a
 * Diagnóstico**. F14 abre ese peldaño, y con una sola pregunta el resultado fue
 * el defecto que la fase 4a midió en Chrome: en `#/edificio/diagnostico` se
 * montaba `.gml-cajon-diagnostico` —el cajón de PARCELA, 367 × 413 px— encima de
 * una construcción. El peldaño estaba abierto y enseñaba la pantalla equivocada.
 *
 * El segundo eje se añade aquí y no en el llamante a propósito: **cuál de los
 * tres cajones toca sigue siendo UNA función pura del estado**, que es lo que T9
 * ganó y lo que no se puede perder por una bandera repartida por la cáscara.
 *
 * Ni un paso ni una rama desconocidos lanzan: esta función se llama desde un
 * suscriptor, y reventar ahí dejaría la esquina en el estado anterior y sin nadie
 * que lo cuente. Quien valida los dos ejes es `app/navegacion.js`. Una rama que
 * no sea EDIFICIO se trata como PARCELA, que es el defecto de la aplicación.
 *
 * @param {string} paso
 * @param {string} [rama=RAMA.PARCELA]
 * @returns {'NINGUNO'|'COMPROBACION'|'DIAGNOSTICO'|'CONTRASTE_EDIFICIO'}
 */
export function cajonDe(paso, rama = RAMA.PARCELA) {
  if (paso === PASO.DIAGNOSTICO) {
    return rama === RAMA.EDIFICIO ? CAJON.CONTRASTE_EDIFICIO : CAJON.DIAGNOSTICO
  }
  // La comprobación es de PARCELA y solo de parcela: se entra soltando un `.gml`
  // de parcela en Entrada, y `viewer/cajon-comprobacion.js` lee `ParcelaGml`. En
  // la rama de edificio esa esquina se queda vacía, que es la verdad.
  if (paso === PASO.ENTRADA && rama !== RAMA.EDIFICIO) return CAJON.COMPROBACION
  return CAJON.NINGUNO
}

// ── La procedencia, declarada ────────────────────────────────────────────────

/**
 * De dónde salió la geometría, por cada valor de `ORIGEN_PARCELA`. **Una entrada
 * por origen, y hay una prueba que lo exige recorriendo el modelo**: un origen
 * nuevo sin texto aquí saldría en pantalla como un renglón vacío, que es
 * exactamente la clase de silencio que T9 viene a quitar.
 *
 * Regla de oro 9 en cada línea: dicen DE DÓNDE viene el dibujo, nunca si está
 * bien. Ni «válido», ni «correcto», ni «oficial» aplicado a lo que trae el
 * usuario — «oficial» solo se dice del contorno del Catastro, que es de quien es.
 *
 * @readonly
 */
export const PROCEDENCIA = Object.freeze({
  [ORIGEN_PARCELA.WFS]: 'Recinto traído del Catastro.',
  [ORIGEN_PARCELA.LIST]: 'Recinto leído de un listado de coordenadas.',
  [ORIGEN_PARCELA.TXT]: 'Recinto leído de tu medición en .txt.',
  [ORIGEN_PARCELA.DXF]: 'Recinto leído de tu medición en .dxf.',
  [ORIGEN_PARCELA.GML_EXISTENTE]: 'Recinto leído del GML de otro técnico.',
})

/**
 * Lo que se añade mientras la geometría es de otro y **todavía no se ha tomado**.
 * Nombra la puerta con las MISMAS palabras que el botón y que
 * `MOTIVO_MODO[PASO.EDICION]` de `app/navegacion.js`: tres textos distintos para
 * la misma acción obligan a adivinar que hablan de lo mismo.
 */
export const COLA_EN_COMPROBACION =
  'Lo estás comprobando: no se edita ni se genera GML hasta que pulses «Tomar esta geometría y ' +
  'editarla».'

/**
 * Y lo que se añade DESPUÉS de cruzar la puerta. No se calla que el dibujo vino
 * de fuera —el origen no cambia, y fingir que sí sería reescribir la historia del
 * documento—, pero sí dice que el fichero de origen no se ha tocado, que es la
 * duda inmediata de quien acaba de pulsar «tomar».
 */
export const COLA_TOMADA =
  'Lo has tomado como tuyo para editarlo; el fichero del que salió no se modifica.'

/**
 * Cuando el origen no está en la tabla. **Nombra el valor en vez de callarse**:
 * si algún día `ORIGEN_PARCELA` crece y nadie toca {@link PROCEDENCIA}, el
 * renglón lo dice en pantalla en vez de quedarse en blanco. La prueba que recorre
 * el modelo debería haberlo cazado antes; esto es la red de debajo.
 *
 * @param {*} origen
 * @returns {string}
 */
export const mensajeOrigenDesconocido = (origen) =>
  `Recinto de procedencia no declarada (${JSON.stringify(origen)}). Es un fallo de la aplicación: ` +
  'la geometría está en pantalla, pero esta versión no sabe decir de dónde salió.'

/**
 * El renglón de procedencia de la pantalla de contraste. **FUNCIÓN PURA**: se
 * compone aquí y se le entrega hecho a la vista, porque `viewer/` no importa
 * `model/` y no va a empezar por esto.
 *
 * @param {Object} args
 * @param {string|null} args.origen  `parcela.origen`, tal cual está en el POJO.
 * @param {string} [args.modo=MODO.NORMAL]  El de `app/navegacion.js`.
 * @returns {string}
 */
export function textoProcedencia({ origen, modo = MODO.NORMAL } = {}) {
  const base = PROCEDENCIA[origen] ?? mensajeOrigenDesconocido(origen)
  if (modo === MODO.COMPROBACION) return `${base} ${COLA_EN_COMPROBACION}`
  if (origen === ORIGEN_PARCELA.GML_EXISTENTE) return `${base} ${COLA_TOMADA}`
  return base
}

// ── Duck typing ──────────────────────────────────────────────────────────────

/** ¿Sirve como la navegación de `app/navegacion.js`? Solo lo que aquí se usa. */
const esNavegacion = (n) =>
  !!n && typeof n === 'object' && typeof n.get === 'function' && typeof n.subscribe === 'function'

/** ¿Sirve como store de `crearEstadoVista`? Lo mismo que piden los cableados. */
const esStore = (s) =>
  !!s && typeof s === 'object' && typeof s.get === 'function' && typeof s.subscribe === 'function'

/** Una función, o un no-op. **Todas las acciones son OPCIONALES a propósito**: una
 *  pantalla montada sin cajón de comprobación —o sin el de diagnóstico, o sin
 *  store— sigue navegando, y este módulo no es quien decide que eso sea un error.
 *  Es la misma regla que hace que `cablearExpediente` funcione sin rama. */
const oNada = (fn) => (typeof fn === 'function' ? fn : () => {})

// ── API pública ──────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Contraste
 * @property {() => string} get  Qué cajón permite el paso actual ({@link CAJON}).
 * @property {() => string} procedencia  El renglón que se está declarando ahora.
 * @property {() => void} refrescar  Vuelve a aplicar todo. Para el llamante que
 *   cambia algo que este módulo no puede oír.
 * @property {() => void} destruir  Se da de baja de las tres cosas. IDEMPOTENTE.
 */

/**
 * Cablea la pantalla de contraste: la esquina del mapa, el renglón de procedencia
 * y la puerta.
 *
 * ⚠️ **El cajón se abre por TRANSICIÓN y no en cada notificación.**
 * `abrirDiagnostico` pide las parcelas colindantes por RED
 * (`cablearDiagnostico#abrir` → `pedirVecinas`), así que reabrirlo en cada aviso
 * del store dispararía una petición por tecla pulsada durante la edición. Solo se
 * llama cuando el cajón que toca CAMBIA.
 *
 * La procedencia y la puerta, en cambio, se aplican SIEMPRE: son idempotentes
 * —escriben un texto y una visibilidad— y equivocarse por defecto ahí cuesta un
 * renglón que habla de la parcela anterior.
 *
 * @param {Object} opciones
 * @param {object} opciones.navegacion  La de `app/navegacion.js`.
 * @param {object} [opciones.estado]  El store de la parcela. Sin él, la
 *   procedencia se declara vacía: no hay de dónde sacar el origen.
 * @param {() => void} [opciones.abrirDiagnostico]
 * @param {() => void} [opciones.cerrarDiagnostico]
 * @param {() => void} [opciones.cerrarComprobacion]
 * @param {(texto: string) => void} [opciones.declararProcedencia]
 * @param {(visible: boolean) => void} [opciones.mostrarPuerta]
 * @param {(fn: () => void) => (() => void)} [opciones.suscribirPuerta]  Cómo
 *   escuchar el CTA. Se le devuelve la baja, igual que `alCambiar` y compañía.
 * @param {(esPantalla: boolean) => void} [opciones.fijarDiagnosticoComoPantalla]
 *   Rework de UI · rebanada 4. Se le dice al cajón de diagnóstico si en este paso
 *   **es la pantalla** o es un cajón flotante. Ver el bloque de abajo.
 * @param {(fn: () => void) => (() => void)} [opciones.suscribirSalida]  Cómo
 *   escuchar el ✕ del cajón cuando es pantalla: entonces ese botón no cierra
 *   nada, PIDE SALIR, y a dónde se sale se decide aquí.
 * @param {() => void} [opciones.abrirContrasteEdificio]  F14 · El gemelo de
 *   `abrirDiagnostico` en la rama EDIFICIO. Opcional como todos los demás: una
 *   pantalla montada sin él sigue navegando.
 * @param {() => void} [opciones.cerrarContrasteEdificio]
 * @param {(esPantalla: boolean) => void} [opciones.fijarContrasteEdificioComoPantalla]
 * @param {(fn: () => void) => (() => void)} [opciones.suscribirSalidaEdificio]
 *   El ✕ del cajón de edificio. Se escucha APARTE del de parcela porque los dos
 *   son nodos distintos con oyentes distintos; a dónde se sale se decide igual.
 * @returns {Contraste}
 * @throws {TypeError}  Contrato del programador.
 */
export function cablearContraste({
  navegacion,
  estado = null,
  abrirDiagnostico,
  cerrarDiagnostico,
  cerrarComprobacion,
  declararProcedencia,
  mostrarPuerta,
  suscribirPuerta,
  fijarDiagnosticoComoPantalla,
  suscribirSalida,
  abrirContrasteEdificio,
  cerrarContrasteEdificio,
  fijarContrasteEdificioComoPantalla,
  suscribirSalidaEdificio,
} = {}) {
  if (!esNavegacion(navegacion)) {
    throw new TypeError(
      `cablearContraste: 'navegacion' debe ser la autoridad de app/navegacion.js (con get y ` +
        `subscribe); recibido ${typeof navegacion}. Sin ella la esquina del mapa volvería a ` +
        `depender de que dos módulos se pongan de acuerdo.`,
    )
  }
  if (estado !== null && !esStore(estado)) {
    throw new TypeError(
      `cablearContraste: 'estado' debe ser el store de crearEstadoVista (con get y subscribe) o ` +
        `null; recibido ${typeof estado}.`,
    )
  }

  const abrirD = oNada(abrirDiagnostico)
  const cerrarD = oNada(cerrarDiagnostico)
  const cerrarC = oNada(cerrarComprobacion)
  const declarar = oNada(declararProcedencia)
  const puerta = oNada(mostrarPuerta)
  const comoPantalla = oNada(fijarDiagnosticoComoPantalla)
  // F14 · Los tres gemelos de la rama EDIFICIO.
  const abrirE = oNada(abrirContrasteEdificio)
  const cerrarE = oNada(cerrarContrasteEdificio)
  const comoPantallaE = oNada(fijarContrasteEdificioComoPantalla)

  let destruido = false
  /** El último cajón aplicado. `null` = todavía no se ha aplicado ninguno. */
  let aplicado = null
  /** Lo último que se declaró, para poder afirmarlo sin leer el DOM. */
  let dicho = ''

  /**
   * Escribe la procedencia y enseña o esconde la puerta.
   *
   * **Sin parcela en el store el renglón se VACÍA**, y es deliberado: decir de
   * dónde viene una geometría que no está sería peor que no decir nada. La vista
   * oculta el renglón cuando recibe cadena vacía, así que no cuesta ni un píxel.
   */
  function declararEstado() {
    const { modo } = navegacion.get()
    const parcela = estado === null ? null : estado.get()
    const texto =
      parcela === null || parcela === undefined
        ? ''
        : textoProcedencia({ origen: parcela.origen ?? null, modo })
    dicho = texto
    declarar(texto)
    // La puerta solo tiene sentido mientras la geometría es de otro. Y solo si hay
    // geometría: un «tomar esta geometría» sobre la nada no toma nada.
    puerta(modo === MODO.COMPROBACION && texto !== '')
  }

  /** @param {{paso: string, rama: string}} situacion */
  function aplicar({ paso, rama }) {
    if (destruido) return
    const toca = cajonDe(paso, rama)
    if (toca !== aplicado) {
      aplicado = toca
      // ── ⛔ ESTA LÍNEA VA ANTES DE ABRIR, Y NO ES ORDEN LIBRE (rebanada 4) ──
      // El cajón de diagnóstico se descartaba al pulsar fuera. Si se abriera
      // primero y se declarara pantalla después, quedaría un instante descartable
      // — y ese instante es exactamente el que dura el clic del rail que acaba de
      // abrirlo, que sigue burbujeando hacia el `document`. Medido antes de esto:
      // **el peldaño «Diagnóstico» abría el cajón y su propio guardián lo cerraba
      // en el mismo gesto, dejando la pantalla vacía sin decir nada.**
      //
      // Que sea EL CAJÓN DE ESTE PASO lo que manda —y no una constante— es lo que
      // deja el de comprobación como estaba: aquél sí es un cajón, es la respuesta
      // pasajera a soltar un `.gml` en Entrada, y descartarlo es lo correcto.
      comoPantalla(toca === CAJON.DIAGNOSTICO)
      // F14 · Y lo mismo para el de edificio, por el mismo motivo y en el mismo
      // sitio: declararlo pantalla ANTES de abrirlo. Si se abriera primero,
      // quedaría un instante descartable — y ese instante es exactamente el que
      // dura el clic del rail que acaba de abrirlo, que sigue burbujeando hacia el
      // `document`. En la otra rama eso ya costó una pantalla vacía y muda.
      comoPantallaE(toca === CAJON.CONTRASTE_EDIFICIO)
      // Cerrar SIEMPRE va antes de abrir: los TRES cajones comparten esquina, y
      // abrir primero los apilaría en vertical durante un fotograma.
      if (toca !== CAJON.COMPROBACION) cerrarC()
      if (toca !== CAJON.CONTRASTE_EDIFICIO) cerrarE()
      if (toca === CAJON.DIAGNOSTICO) abrirD()
      else cerrarD()
      if (toca === CAJON.CONTRASTE_EDIFICIO) abrirE()
    }
    declararEstado()
  }

  const bajaNavegacion = navegacion.subscribe(aplicar)
  // El store se escucha aparte: cambiar de parcela no cambia el paso, pero sí
  // cambia de quién es la geometría. Sin esto, contrastar el GML de otro dejaría
  // en pantalla la procedencia de la parcela anterior.
  const bajaEstado = estado === null ? () => {} : estado.subscribe(() => declararEstado())
  // Y la puerta. Quien la cruza es la autoridad; este módulo solo la enchufa —el
  // cajón no sabe qué es un modo—.
  const bajaPuerta =
    typeof suscribirPuerta === 'function'
      ? suscribirPuerta(() => {
          if (!destruido) navegacion.abrirPuerta()
        })
      : () => {}

  // ── La SALIDA del diagnóstico (rework de UI · rebanada 4) ──────────────────
  //
  // El ✕ de un cajón que no se descarta tiene que significar algo, y lo que
  // significa es «sácame de aquí». Se sale a **Validación** y no a Entrada: es el
  // paso anterior en el recorrido y el que enseña la misma geometría con sus
  // vértices, así que salirse del diagnóstico no tira el trabajo hecho.
  //
  // El guardián de Validación pide `geometria`, y estar en Diagnóstico exige más
  // que eso, así que desde aquí NUNCA puede fallar. Se comprueba igualmente y se
  // cae a Entrada si algún día deja de ser verdad: un ✕ que no hace nada es
  // exactamente el fallo silencioso que esta rebanada existe para quitar.
  function salir() {
    if (destruido) return
    if (navegacion.navegarAPaso(PASO.VALIDACION).ok) return
    navegacion.navegarAPaso(PASO.ENTRADA)
  }

  const bajaSalida =
    typeof suscribirSalida === 'function' ? suscribirSalida(salir) : () => {}
  // F14 · El ✕ del cajón de edificio sale al MISMO sitio, y con el mismo
  // razonamiento: Validación es el paso anterior del recorrido y enseña la misma
  // construcción con sus partes, así que salirse del contraste no tira el trabajo
  // hecho. Su guardián pide `geometria`, y estar en Diagnóstico exige eso mismo,
  // así que desde aquí no puede fallar; se comprueba igual y se cae a Entrada por
  // si algún día deja de ser verdad.
  const bajaSalidaEdificio =
    typeof suscribirSalidaEdificio === 'function' ? suscribirSalidaEdificio(salir) : () => {}

  // `subscribe` no notifica al suscribirse (contrato de `crearEstadoVista`), así
  // que la primera aplicación va a mano. Es también la que deja la esquina
  // coherente cuando se aterriza desde un hash: `#/parcela/diagnostico` abre el
  // cajón sin que nadie tenga que pulsar el CTA.
  aplicar(navegacion.get())

  return {
    get: () => {
      const { paso, rama } = navegacion.get()
      return cajonDe(paso, rama)
    },

    procedencia: () => dicho,

    refrescar() {
      if (!destruido) declararEstado()
    },

    destruir() {
      if (destruido) return
      destruido = true
      bajaNavegacion()
      bajaEstado()
      if (typeof bajaPuerta === 'function') bajaPuerta()
      if (typeof bajaSalida === 'function') bajaSalida()
      if (typeof bajaSalidaEdificio === 'function') bajaSalidaEdificio()
    },
  }
}

export default cablearContraste

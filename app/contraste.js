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
//                          Entrada, no a una pantalla propia.
//   · `PASO.DIAGNOSTICO` → el de DIAGNÓSTICO. Es la pantalla de contraste.
//   · cualquier otro     → ninguno.
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
import { MODO, PASO } from './navegacion.js'

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
})

/**
 * Qué cajón permite un paso. **FUNCIÓN PURA, y es el corazón de T9**: la
 * exclusión mutua de la esquina `bottomleft` deja de ser un acuerdo entre dos
 * módulos y pasa a ser una consecuencia del estado de navegación.
 *
 * Un paso desconocido devuelve `NINGUNO` y no lanza: esta función se llama desde
 * un suscriptor, y reventar ahí dejaría la aplicación con la esquina en el estado
 * anterior y sin nadie que lo cuente. Quien valida los pasos es
 * `app/navegacion.js`, que lanza al recibir uno que no existe.
 *
 * @param {string} paso
 * @returns {'NINGUNO'|'COMPROBACION'|'DIAGNOSTICO'}
 */
export function cajonDe(paso) {
  if (paso === PASO.DIAGNOSTICO) return CAJON.DIAGNOSTICO
  if (paso === PASO.ENTRADA) return CAJON.COMPROBACION
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

  /** @param {{paso: string}} situacion */
  function aplicar({ paso }) {
    if (destruido) return
    const toca = cajonDe(paso)
    if (toca !== aplicado) {
      aplicado = toca
      // Cerrar SIEMPRE va antes de abrir: los dos cajones comparten esquina, y
      // abrir primero los apilaría en vertical durante un fotograma.
      if (toca !== CAJON.COMPROBACION) cerrarC()
      if (toca === CAJON.DIAGNOSTICO) abrirD()
      else cerrarD()
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

  // `subscribe` no notifica al suscribirse (contrato de `crearEstadoVista`), así
  // que la primera aplicación va a mano. Es también la que deja la esquina
  // coherente cuando se aterriza desde un hash: `#/parcela/diagnostico` abre el
  // cajón sin que nadie tenga que pulsar el CTA.
  aplicar(navegacion.get())

  return {
    get: () => cajonDe(navegacion.get().paso),

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
    },
  }
}

export default cablearContraste

// pwa/instalacion.js — 2026-09-25 · La oferta de instalar la aplicación.
//
// Chrome y Edge avisan de que una página se puede instalar con el evento
// `beforeinstallprompt`. Si nadie lo recoge, el navegador pone su icono en la barra de
// direcciones y ahí se queda: nadie lo ve. Este módulo lo RECOGE y lo guarda, para que
// la aplicación ofrezca «Instalar» en el sitio donde tiene sentido —el diálogo del
// expediente, junto a lo que se dice de la durabilidad— y no en uno cualquiera.
//
// ── POR QUÉ IMPORTA MÁS QUE LA COMODIDAD ────────────────────────────────────
// Instalar es lo que hace que el navegador deje de poder borrar los expedientes por su
// cuenta (`storage/cuota.js`: la persistencia se concede a los sitios instalados), y la
// aplicación llevaba desde F10 aconsejándolo sin poder instalarse.
//
// ── LO QUE NO HACE ──────────────────────────────────────────────────────────
// No pinta nada ni sabe que existe un diálogo: da un estado y un `instalar()`, y avisa
// cuando cambian. Tampoco decide si la instalación salió bien por su cuenta: lo dice el
// navegador (`userChoice`) y lo confirma `appinstalled`.

/**
 * @typedef {Object} EstadoInstalacion
 * @property {boolean} disponible  El navegador ha ofrecido instalar y la oferta sigue
 *   sin usar. Solo entonces tiene sentido enseñar el botón.
 * @property {boolean} instalada  Ya corre como aplicación instalada (ventana propia),
 *   o se acaba de instalar en esta sesión.
 */

/**
 * Por qué `instalar()` no ha instalado.
 *
 * @readonly
 */
export const MOTIVO_INSTALACION = Object.freeze({
  /** El navegador no ha hecho (todavía, o nunca) la oferta. */
  NO_DISPONIBLE: 'NO_DISPONIBLE',
  /** Se preguntó y el usuario dijo que no. No es un error. */
  RECHAZADA: 'RECHAZADA',
  /** `prompt()` lanzó. */
  ERROR: 'ERROR',
})

/** ¿Se está ejecutando ya como aplicación, en su propia ventana? */
function enVentanaPropia(ventana) {
  try {
    return ventana.matchMedia?.('(display-mode: standalone)')?.matches === true
  } catch {
    return false
  }
}

/**
 * Crea el gestor de la oferta de instalación.
 *
 * @param {object} [opciones]
 * @param {*} [opciones.ventana=globalThis.window]  Lo que emite `beforeinstallprompt` y
 *   `appinstalled`. Inyectable: en Node basta un `EventTarget`. `null` ⇒ no hay dónde
 *   escuchar, y el estado se queda en «no disponible» para siempre.
 * @returns {{estado: () => EstadoInstalacion,
 *            instalar: () => Promise<{ok: boolean, motivo: string|null}>,
 *            alCambiar: (fn: (e: EstadoInstalacion) => void) => () => void,
 *            destruir: () => void}}
 * @throws {TypeError}  Si `ventana` no es nula ni tiene `addEventListener`.
 */
export function crearInstalacion({ ventana = globalThis.window ?? null } = {}) {
  if (ventana !== null && typeof ventana?.addEventListener !== 'function') {
    throw new TypeError(
      `crearInstalacion: 'ventana' debe tener addEventListener, o ser null; recibido ${typeof ventana}.`,
    )
  }

  /** El `BeforeInstallPromptEvent` guardado. Solo sirve UNA vez: `prompt()` lo gasta. */
  let oferta = null
  let instalada = ventana !== null && enVentanaPropia(ventana)
  let destruido = false
  /** @type {Set<Function>} */
  const oyentes = new Set()

  const estado = () => ({ disponible: oferta !== null && !instalada, instalada })

  function notificar() {
    const foto = estado()
    for (const fn of [...oyentes]) {
      try {
        fn(foto)
      } catch (causa) {
        console.error('[pwa] un oyente de la instalación ha fallado:', causa)
      }
    }
  }

  function alOfrecer(evento) {
    // Sin `preventDefault` el navegador enseñaría su propia barra (en móvil) además de
    // nuestro botón: dos ofertas de lo mismo, una de ellas fuera de contexto.
    evento.preventDefault?.()
    oferta = evento
    notificar()
  }

  function alInstalar() {
    oferta = null
    instalada = true
    notificar()
  }

  ventana?.addEventListener('beforeinstallprompt', alOfrecer)
  ventana?.addEventListener('appinstalled', alInstalar)

  return {
    estado,

    /**
     * Enseña el diálogo de instalación del navegador. Tiene que llamarse desde un
     * gesto del usuario (un clic), o el navegador lo ignora.
     */
    async instalar() {
      if (destruido || oferta === null || instalada) {
        return { ok: false, motivo: MOTIVO_INSTALACION.NO_DISPONIBLE }
      }
      const usada = oferta
      // La oferta se gasta al usarla, salga como salga: volver a llamar a `prompt()`
      // sobre el mismo evento lanza. Si el usuario dice que no, el navegador volverá a
      // ofrecer más adelante con un evento nuevo.
      oferta = null
      notificar()
      try {
        await usada.prompt()
        const eleccion = await usada.userChoice
        if (eleccion?.outcome === 'accepted') {
          instalada = true
          notificar()
          return { ok: true, motivo: null }
        }
        return { ok: false, motivo: MOTIVO_INSTALACION.RECHAZADA }
      } catch (causa) {
        console.warn('[pwa] el navegador no ha podido enseñar la instalación:', causa)
        return { ok: false, motivo: MOTIVO_INSTALACION.ERROR }
      }
    },

    alCambiar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alCambiar: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },

    destruir() {
      if (destruido) return
      destruido = true
      oferta = null
      oyentes.clear()
      ventana?.removeEventListener('beforeinstallprompt', alOfrecer)
      ventana?.removeEventListener('appinstalled', alInstalar)
    },
  }
}

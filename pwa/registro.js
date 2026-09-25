// pwa/registro.js — 2026-09-25 · Registrar el service worker, y nada más.
//
// Es lo que hace que el navegador trate esto como una aplicación instalable y que abra
// sin conexión. Lo llama `app/main.js` SOLO en el build (`import.meta.env.PROD`): en
// `npm run dev` un service worker interceptaría la recarga en caliente, y en las
// pruebas no hay ninguno que registrar.
//
// ── POR QUÉ UN FALLO AQUÍ NO VA AL PANEL DE AVISOS ──────────────────────────
// Misma frontera que `storage/cuota.js` —«el entorno que dice NO no es el entorno que
// se rompe»— y por el mismo motivo: el registro falla en entornos que lo prohíben
// (una ventana privada de Firefox, una política de empresa), y ahí fallaría en CADA
// carga. Una tarjeta en cada carga por algo que el usuario no puede cambiar enseña a no
// leer el panel. Y no se pierde nada del trabajo: la aplicación funciona igual, solo
// que no se instala ni abre sin conexión. Se devuelve como dato —con su `mensaje`— y se
// anota en la consola para quien diagnostique.

/**
 * Por qué no se ha registrado. Códigos estables, como `MOTIVO_CUOTA`.
 *
 * @readonly
 */
export const MOTIVO_REGISTRO = Object.freeze({
  /** No hay `navigator.serviceWorker`: un navegador sin soporte, o una página por
   *  `http://` que no es `localhost` (los service workers exigen contexto seguro). */
  SIN_API: 'SIN_API',
  /** La API existe y `register` rechazó. */
  RECHAZADO: 'RECHAZADO',
})

const MENSAJE_SIN_API =
  'Este navegador no admite service workers (o la página no se sirve por https), así que la ' +
  'aplicación no se puede instalar ni abrir sin conexión. Todo lo demás funciona igual.'

const MENSAJE_RECHAZADO =
  'El navegador no ha dejado preparar la aplicación para instalarse y abrir sin conexión (pasa ' +
  'en ventanas privadas y con algunas políticas de empresa). Todo lo demás funciona igual.'

/**
 * @typedef {Object} ResultadoRegistro
 * @property {boolean} ok
 * @property {string|null} motivo  Uno de {@link MOTIVO_REGISTRO}, o `null` si `ok`.
 * @property {string|null} mensaje  Presentable, o `null` si `ok`.
 * @property {*} registro  El `ServiceWorkerRegistration`, o `null`.
 */

/**
 * Registra el service worker. **Nunca lanza por causas del entorno**; sí por contrato
 * roto (una `url` vacía).
 *
 * @param {object} opciones
 * @param {string} opciones.url  La URL del script. En producción,
 *   `import.meta.env.BASE_URL + 'sw.js'`, o sea `/concretagml/sw.js`: el alcance por
 *   defecto es su carpeta, que es la aplicación entera.
 * @param {*} [opciones.contenedor=globalThis.navigator?.serviceWorker]  Inyectable
 *   porque en Node no existe.
 * @returns {Promise<ResultadoRegistro>}
 * @throws {TypeError}  Si `url` no es una cadena no vacía.
 */
export async function registrarServiceWorker({
  url,
  contenedor = globalThis.navigator?.serviceWorker ?? null,
} = {}) {
  if (typeof url !== 'string' || url === '') {
    throw new TypeError(
      `registrarServiceWorker: 'url' debe ser la URL del script; recibido ${JSON.stringify(url)}.`,
    )
  }
  if (!contenedor || typeof contenedor.register !== 'function') {
    return { ok: false, motivo: MOTIVO_REGISTRO.SIN_API, mensaje: MENSAJE_SIN_API, registro: null }
  }
  try {
    const registro = await contenedor.register(url)
    return { ok: true, motivo: null, mensaje: null, registro }
  } catch (causa) {
    console.warn('[pwa] no se ha podido registrar el service worker:', causa)
    return { ok: false, motivo: MOTIVO_REGISTRO.RECHAZADO, mensaje: MENSAJE_RECHAZADO, registro: null }
  }
}

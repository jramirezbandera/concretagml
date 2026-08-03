// storage/cuota.js — F10 · T1.2. LA CUOTA DEL SITIO: pedirla, medirla y reconocer
// cuándo se ha acabado.
//
// F05 dejó esto escrito y aplazado con nombre y apellidos: «la purga por antigüedad
// y **la gestión de cuota son de F10**» (`storage/cache-catastro.js`). Este módulo es
// esa mitad. No guarda nada ni lee ningún almacén: solo habla con
// `navigator.storage`, que es una API DEL SITIO —no de una base—, y por eso vive
// aparte de `bd.js` y no dentro.
//
// ── LO QUE SE MIDIÓ ANTES DE ESCRIBIRLO (2026-08-03, fase 0 de F10) ──────────
// Importa, porque la ficha de la fase prometía una cosa y el navegador hace otra:
//
//   · **`persist()` devuelve `false`.** En 0 ms, sin preguntar nada y sin lanzar.
//     Igual en `http://localhost:5173` que en el `https://` publicado en Pages.
//     `spec/feature-10-persistencia-export.md` dice «`navigator.storage.persist()`
//     al arrancar (**evita desalojo**)» y **no lo evita**: Chrome concede la
//     persistencia a sitios instalados como aplicación, marcados como favoritos o
//     con interacción acumulada, y un perfil recién hecho no tiene nada de eso.
//     La consecuencia de diseño está más abajo, en {@link crearCuota}.
//   · **La cuota medida fue 1.863,5 MB (1,82 GB)** en los dos orígenes.
//   · **Un expediente ocupa ~864 B** de `usage` (1.488 B de JSON: IndexedDB lo
//     guarda más compacto). Caben del orden de **1,3 millones**. O sea que la cuota
//     no la llenan los expedientes: la llena la **caché del Catastro** de F05, que
//     es exactamente por lo que la degradación purga ESA y no otra cosa.
//
// ── POR QUÉ ESTO **NO** AVISA CUANDO EL NAVEGADOR DICE QUE NO ────────────────
// La regla de oro 1 prohíbe los errores silenciosos, y aquí hay que distinguir con
// cuidado, porque tratar esto como error produciría un aviso en el panel **en cada
// carga de cada usuario**:
//
//   · Que `persist()` devuelva `false` **no es un fallo**: es el estado normal,
//     medido, del 100 % de las visitas nuevas. Se devuelve como dato, con su
//     `mensaje` presentable, y quien lo pide decide dónde contarlo — el sitio
//     natural es el diálogo del expediente, donde el usuario está pensando en
//     guardar, y no un aviso al arrancar que no le deja hacer nada.
//   · Que la API **no exista** tampoco es un fallo nuestro: es un entorno que no
//     puede (Node, un navegador viejo). Mismo trato.
//   · Que una llamada **lance** sí es un suceso anómalo, y ese sí va al canal.
//
// Es la misma frontera de siempre —*el entorno degrada, el programador revienta*—
// afinada un escalón: **el entorno que dice «no» no es el entorno que se rompe.**
//
// ── QUÉ NO HACE, A PROPÓSITO ────────────────────────────────────────────────
// No purga (eso es de `storage/cache-catastro.js`, que es la dueña de sus datos y
// de su política de antigüedad), no abre bases, no toca el DOM y no lee el reloj.
// No sale por el barrel raíz: `storage/` entero está fuera por decisión de capas
// (`index.js`), y este módulo además depende de `navigator`.

import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── Motivos ──────────────────────────────────────────────────────────────────

/**
 * Por qué la cuota no se pudo pedir o medir. Códigos estables, para que la interfaz
 * decida sin leerle el texto al `mensaje` (mismo criterio que `MOTIVO_SIN_BD` en
 * `storage/bd.js` y `MOTIVO_NO_DESCARGADO` en `gml/descargar.js`).
 *
 * @readonly
 */
export const MOTIVO_CUOTA = Object.freeze({
  /** No hay `navigator.storage`, o lo que hay no tiene el método que hace falta. */
  SIN_API: 'SIN_API',
  /**
   * La API existe, se preguntó, y el navegador dijo que no. **No es un error**:
   * es la respuesta normal de un sitio que no está instalado ni marcado (medido).
   */
  DENEGADA: 'DENEGADA',
  /** La llamada lanzó. Esto sí es anómalo y sí va al canal de avisos. */
  ERROR: 'ERROR',
})

/**
 * Lo que devuelve `pedirPersistencia()`. Las cinco claves, siempre presentes.
 *
 * @typedef {Object} ResultadoPersistencia
 * @property {boolean} ok  `true` solo si se pudo PREGUNTAR sin incidencias. Un `no`
 *   del navegador es `ok: true` con `persistido: false`: la pregunta funcionó.
 * @property {boolean} persistido  Si el almacenamiento del sitio queda a salvo del
 *   desalojo automático. **Medido: `false` es lo normal.**
 * @property {boolean|null} yaEstaba  Si la persistencia ya estaba concedida ANTES
 *   de preguntar. `null` cuando no se pudo saber. Distingue «esta llamada ha
 *   conseguido algo» de «ya estaba y la llamada no ha cambiado nada», que es
 *   justo lo que hay que saber para no contarle al usuario un logro que no ha
 *   ocurrido.
 * @property {string|null} motivo  `null` si `persistido`; si no, clave de
 *   {@link MOTIVO_CUOTA}.
 * @property {string|null} mensaje  Texto en castellano presentable, o `null`.
 * @property {*} causa  El error, si lo hubo; `null` en cualquier otro caso.
 */

/**
 * Lo que devuelve `medir()`.
 *
 * @typedef {Object} ResultadoMedida
 * @property {boolean} ok
 * @property {number|null} usoBytes  Lo ocupado por este origen, o `null`.
 * @property {number|null} cuotaBytes  El techo, o `null`.
 * @property {number|null} fraccion  `uso/cuota` en `[0,1]`, o `null` si falta alguno
 *   o la cuota es 0. Se calcula aquí para que nadie divida por cero por su cuenta.
 * @property {string|null} motivo  Clave de {@link MOTIVO_CUOTA} si `!ok`.
 * @property {string|null} mensaje
 * @property {*} causa
 */

// ── El predicado, que es puro y por eso va suelto ────────────────────────────

/**
 * ¿Este error es «se ha acabado el espacio»?
 *
 * ⚠️ **Se reconoce por `name` y por `code`, JAMÁS por el texto del mensaje**, que
 * cambia con el navegador y con el idioma del usuario: un `includes('quota')`
 * funcionaría en un Chrome en inglés y fallaría en el mismo Chrome en castellano,
 * y el fallo sería que la degradación no se dispara —o sea, silencio— justo cuando
 * más falta hace.
 *
 * Se aceptan tres formas, y las tres están en navegadores vivos:
 *   · `name === 'QuotaExceededError'` — el nombre estándar;
 *   · `code === 22` — el `QUOTA_EXCEEDED_ERR` heredado de DOM Level 1;
 *   · `NS_ERROR_DOM_QUOTA_REACHED` / `code === 1014` — la forma de Firefox.
 *
 * Se exporta **suelta y no dentro del objeto que devuelve {@link crearCuota}**,
 * a propósito: es una función pura que no toca `navigator`, y ofrecerla también
 * como método daría dos caminos hasta la misma cosa —justo lo que la cabecera de
 * `index.js` explica que este proyecto evita—.
 *
 * @param {*} error  Lo que sea que haya llegado por un `catch`.
 * @returns {boolean}
 */
export function esCuotaExcedida(error) {
  if (!error || typeof error !== 'object') return false
  const { name, code } = error
  return (
    name === 'QuotaExceededError' ||
    name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
    code === 22 ||
    code === 1014
  )
}

// ── Textos ───────────────────────────────────────────────────────────────────

/**
 * Lo que se le enseña al usuario cuando el navegador no garantiza la conservación.
 * Dice **qué pasa y qué puede hacer él**, sin dramatizar: sus expedientes no están
 * en peligro inmediato: lo que no hay es una garantía.
 *
 * @readonly
 */
export const AVISO_SIN_PERSISTENCIA =
  'El navegador no garantiza que conserve estos datos: si se queda sin espacio, puede ' +
  'borrar por su cuenta lo que esta página tenga guardado. Para que los proteja, añade ' +
  'la página a favoritos o instálala como aplicación. Y para llevarte un trabajo con ' +
  'seguridad, exporta el expediente a un fichero.'

const SIN_API_PERSIST =
  'Este navegador no permite pedir que los datos guardados se conserven ' +
  '(`navigator.storage.persist`). La aplicación funciona igual; lo que no hay es garantía ' +
  'de que lo guardado siga ahí mañana.'

const SIN_API_ESTIMATE =
  'Este navegador no permite consultar cuánto espacio queda ' +
  '(`navigator.storage.estimate`), así que no se puede mostrar el consumo.'

// ── La fábrica ───────────────────────────────────────────────────────────────

/**
 * ¿Sirve como gestor de almacenamiento? DUCK TYPING, igual que `esFabricaIndexedDb`
 * en `storage/bd.js` y por lo mismo: `instanceof StorageManager` exige un
 * constructor global que en Node no existe, y obligaría a un doble de prueba a
 * fingir una jerarquía entera para hacer de gestor.
 *
 * @param {*} v
 * @returns {boolean}
 */
function esObjeto(v) {
  return !!v && (typeof v === 'object' || typeof v === 'function')
}

/**
 * Crea el gestor de cuota del sitio.
 *
 * **Nada de esto lanza por causas del entorno.** Si la API no está, o dice que no,
 * se devuelve un resultado con su `motivo` y su `mensaje`. Lanzar queda para el
 * contrato roto por el programador (un `alAvisar` que no es función, un
 * `almacenamiento` que es un número).
 *
 * @param {object} [opciones]
 * @param {*} [opciones.almacenamiento=globalThis.navigator?.storage]  El
 *   `StorageManager`. **Inyectable, y no por gusto**: en Node no existe, así que sin
 *   este parámetro este módulo no se podría probar en el proyecto Vitest `node` —que
 *   es donde vive `test/storage/`—. `null`/`undefined` significan «este entorno no
 *   lo tiene», que es un estado legítimo y no un error.
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]  Canal
 *   de avisos. Se usa **solo cuando una llamada LANZA** (ver la cabecera): un «no»
 *   del navegador no es un incidente y no se cuenta por aquí.
 * @returns {{pedirPersistencia: () => Promise<ResultadoPersistencia>, medir: () => Promise<ResultadoMedida>}}
 * @throws {TypeError}  Si `almacenamiento` no es objeto, función, ni nulo; o si
 *   `alAvisar` no es función ni nulo (lo lanza `resolverAvisar`).
 */
export function crearCuota({
  almacenamiento = globalThis.navigator?.storage,
  alAvisar = null,
} = {}) {
  const avisar = resolverAvisar(alAvisar)
  if (almacenamiento !== null && almacenamiento !== undefined && !esObjeto(almacenamiento)) {
    throw new TypeError(
      `crearCuota: 'almacenamiento' debe ser un StorageManager (algo con 'persist'/'estimate'), ` +
        `o null/undefined si este entorno no lo tiene; recibido un ${typeof almacenamiento}.`,
    )
  }

  const tiene = (metodo) => esObjeto(almacenamiento) && typeof almacenamiento[metodo] === 'function'

  return {
    /**
     * Pide al navegador que no desaloje lo guardado por este sitio.
     *
     * ⚠️ **Medido: devuelve `false`.** Y aun así se llama, por dos motivos que
     * conviene tener escritos para que nadie lo borre por inútil: (a) en cuanto el
     * usuario marca la página como favorita o la instala, la MISMA llamada empieza
     * a devolver `true` sin cambiar una línea; y (b) `persisted()` es la única
     * forma de saber en qué régimen se está, y de eso depende lo que la interfaz
     * tiene derecho a prometerle al usuario sobre su trabajo.
     *
     * @returns {Promise<ResultadoPersistencia>}
     */
    async pedirPersistencia() {
      if (!tiene('persist')) {
        return {
          ok: false, persistido: false, yaEstaba: null,
          motivo: MOTIVO_CUOTA.SIN_API, mensaje: SIN_API_PERSIST, causa: null,
        }
      }
      // `persisted()` primero: si ya está concedida, `persist()` la devuelve
      // igual, pero preguntar antes deja claro en el resultado si esto ha
      // cambiado algo o ya estaba.
      //
      // Va en su PROPIO `try`, y no dentro del de abajo, por una diferencia de
      // importancia entre las dos llamadas: lo que se quiere es la persistencia;
      // saber si ya estaba concedida es un extra. Si `persisted()` falla y se
      // arrastrara a `persist()` con él, un dato accesorio roto tumbaría la
      // petición principal — y el resultado sería peor que no haberlo preguntado.
      // Su fallo se refleja donde corresponde: `yaEstaba: null`, que el contrato
      // ya define como «no se pudo saber».
      let yaEstaba = null
      if (tiene('persisted')) {
        try {
          yaEstaba = Boolean(await almacenamiento.persisted())
        } catch {
          yaEstaba = null
        }
      }
      try {
        const persistido = Boolean(await almacenamiento.persist())
        return {
          ok: true,
          persistido,
          yaEstaba,
          motivo: persistido ? null : MOTIVO_CUOTA.DENEGADA,
          mensaje: persistido ? null : AVISO_SIN_PERSISTENCIA,
          causa: null,
        }
      } catch (error) {
        // Esto sí es anómalo: la API estaba y ha reventado.
        const detalle = error && error.name ? `${error.name}: ${error.message}` : String(error)
        const mensaje =
          `No se ha podido pedir que el navegador conserve los datos guardados (${detalle}). ` +
          'La aplicación funciona igual, pero no hay garantía de conservación.'
        avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
        return {
          ok: false, persistido: false, yaEstaba,
          motivo: MOTIVO_CUOTA.ERROR, mensaje, causa: error,
        }
      }
    },

    /**
     * Cuánto ocupa este sitio y cuánto le dejan ocupar.
     *
     * Las cifras son ESTIMADAS por el navegador a propósito (si fueran exactas
     * servirían para deducir el historial de navegación del usuario), así que se
     * devuelven tal cual y se enseñan como lo que son. `fraccion` se calcula aquí
     * para que nadie divida por cero cuando la cuota venga a 0.
     *
     * @returns {Promise<ResultadoMedida>}
     */
    async medir() {
      if (!tiene('estimate')) {
        return {
          ok: false, usoBytes: null, cuotaBytes: null, fraccion: null,
          motivo: MOTIVO_CUOTA.SIN_API, mensaje: SIN_API_ESTIMATE, causa: null,
        }
      }
      try {
        const { usage, quota } = (await almacenamiento.estimate()) ?? {}
        const usoBytes = Number.isFinite(usage) ? usage : null
        const cuotaBytes = Number.isFinite(quota) ? quota : null
        const fraccion =
          usoBytes !== null && cuotaBytes !== null && cuotaBytes > 0 ? usoBytes / cuotaBytes : null
        return { ok: true, usoBytes, cuotaBytes, fraccion, motivo: null, mensaje: null, causa: null }
      } catch (error) {
        const detalle = error && error.name ? `${error.name}: ${error.message}` : String(error)
        const mensaje = `No se ha podido consultar el espacio disponible (${detalle}).`
        avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
        return {
          ok: false, usoBytes: null, cuotaBytes: null, fraccion: null,
          motivo: MOTIVO_CUOTA.ERROR, mensaje, causa: error,
        }
      }
    },
  }
}

export default crearCuota

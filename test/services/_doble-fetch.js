/* -------------------------------------------------------------------------- *
 * test/services/_doble-fetch.js — F05 · T1A · Los dos dobles de `services/_red` *
 *                                                                               *
 * ── POR QUÉ NO ES UN `*.test.js` ────────────────────────────────────────────  *
 * No lleva el sufijo a propósito, igual que `test/gml/_canonico.js` y           *
 * `test/viewer/_ayuda-jsdom.js`: la guarda de partición de                      *
 * `test/contrato.test.js` recorre el repo entero exigiendo que TODO fichero     *
 * `*.test.js` lo ejecute exactamente un proyecto de Vitest, y esto no es una    *
 * suite, es una herramienta. Con el sufijo aparecería como un fichero de test   *
 * que no declara ni un `it`. El prefijo `_` sigue la convención de              *
 * `parsers/_comun.js` / `validation/_comun.js`: módulo de APOYO.                *
 *                                                                               *
 * El fichero se llama por su pieza principal, pero hospeda DOS dobles —el de    *
 * `fetch` y el de `dormir`—: son el mismo arnés (no se puede probar una         *
 * petición sin controlar también su espera) y separarlos crearía un cuarto      *
 * fichero que el encargo de esta tarea no contempla.                            *
 *                                                                               *
 * ── LO QUE ESTOS DOBLES MIDEN, QUE ES EL PUNTO ──────────────────────────────  *
 * No están para «devolver algo» sino para hacer OBSERVABLE lo que el transporte *
 * hace de verdad, que es donde están los criterios de esta tarea:               *
 *   · cuántas peticiones EMITE (criterio 4: un 200 se pide una vez, un rechazo  *
 *     exactamente `BACKOFF.intentos` veces),                                    *
 *   · cuántas hay EN VUELO a la vez, y el máximo alcanzado (criterio 2),        *
 *   · qué esperas abre y cuáles CANCELA (criterios 1 y 3),                      *
 *   · con qué opciones llama al `fetch` — en particular, que no le pasa ni una  *
 *     cabecera.                                                                 *
 *                                                                               *
 * ── LA RESPUESTA ES UN `Response` DE VERDAD ─────────────────────────────────  *
 * `crearDobleFetch` construye `new Response(...)`, el global real de la         *
 * plataforma (Node 18+ y todo navegador), no un objeto con forma de respuesta.  *
 * Así el transporte se enfrenta al `text()` real —que decodifica UTF-8 por      *
 * especificación, que es justo la propiedad en la que este proyecto se apoya    *
 * para NO decodificar bytes a mano— y a unas `headers` reales. Un doble a mano  *
 * probaría el duck typing del transporte contra el duck typing del doble.       *
 *                                                                               *
 * ── LA ÚNICA COMPLICACIÓN, Y HAY QUE ENTENDERLA ANTES DE USAR ESTO ──────────  *
 * `crearDobleDormir` resuelve las esperas DE INMEDIATO... salvo el reloj del    *
 * timeout, que por defecto queda PENDIENTE PARA SIEMPRE. No es un capricho:     *
 * el timeout del transporte es una carrera entre el `fetch` y                   *
 * `dormir(MS_TIMEOUT)`, así que un reloj que resuelve al instante GANA LA       *
 * CARRERA A TODO `fetch` y convierte el transporte en una máquina de producir   *
 * `TIEMPO_AGOTADO`: ninguna petición saldría nunca con éxito y la suite entera  *
 * mediría un módulo que no es el que corre en producción.                       *
 *                                                                               *
 * El reloj se reconoce por sus milisegundos (`ms === MS_TIMEOUT`), y            *
 * `MS_TIMEOUT` se IMPORTA del módulo: no hay ningún 15000 escrito aquí. Es el   *
 * único acoplamiento entre el doble y el módulo bajo prueba, es explícito, y si *
 * alguien cambia la constante el doble le sigue solo. Para probar el timeout se *
 * pide lo contrario a las claras: `crearDobleDormir({ venceElReloj: true })`,   *
 * y así el criterio 5 se comprueba sin gastar 15 segundos de reloj real ni      *
 * tocar un temporizador falso (este repo tiene CERO `vi.useFakeTimers`).        *
 * -------------------------------------------------------------------------- */

import { MS_TIMEOUT } from '../../services/_red.js'

/**
 * Error con el que un `fetch` real rechaza cuando se aborta su señal. En el
 * navegador es un `DOMException` con `name: 'AbortError'`; lo que el transporte
 * mira NO es el error sino la señal (`senal.aborted`), así que basta con que el
 * nombre sea el realista.
 *
 * @returns {Error}
 */
export function errorDeAborto() {
  const error = new Error('La petición se ha abortado.')
  error.name = 'AbortError'
  return error
}

/**
 * Error con el que un `fetch` real rechaza cuando no hay red — y también cuando
 * falla CORS, y cuando falla el DNS, y cuando falla el TLS. **El mismo para los
 * cuatro**, que es exactamente el motivo por el que `MOTIVO_RED.SIN_RED` los
 * agrupa: si aquí hiciera falta un error distinto por caso, el transporte podría
 * distinguirlos, y no puede.
 *
 * @returns {TypeError}
 */
export function errorDeRed() {
  return new TypeError('Failed to fetch')
}

/**
 * Guion de UNA llamada al `fetch` doble. Formas admitidas (excluyentes):
 *
 * ```js
 * { estado: 200, texto: '<gml…>', tipoContenido: 'text/xml' }  // responde
 * { error: errorDeRed() }                                      // rechaza
 * { pendiente: true }                                          // no resuelve NUNCA
 *                                                              // (solo la termina un abort)
 * { retenida: true, estado: 200, texto: 'ok' }                 // espera a `soltar()`
 * { noEsRespuesta: 'esto no es un Response' }                  // inyección rota
 * ```
 *
 * @typedef {Object} GuionFetch
 * @property {number} [estado=200]
 * @property {string|null} [texto=null]
 * @property {string|null} [tipoContenido=null]
 * @property {Error} [error]
 * @property {boolean} [pendiente]
 * @property {boolean} [retenida]
 * @property {*} [noEsRespuesta]
 */

/**
 * Doble de `fetch` que cuenta, mide la concurrencia y honra el `AbortSignal`.
 *
 * **Honrar la señal no es un detalle**: un `fetch` que la ignorase dejaría
 * colgados para siempre los tests de cancelación y de timeout, y además estaría
 * mintiendo — el `fetch` de la plataforma la honra por especificación, y el
 * transporte se apoya en ello para abandonar de verdad una petición vencida.
 *
 * @param {object} [opciones]
 * @param {GuionFetch|((url: string, intento: number) => GuionFetch)} [opciones.plan]
 *   Qué responder. Si es función, recibe la URL y el número de intento **de esa
 *   URL** (1-based), que es lo que permite escribir «falla dos veces y luego
 *   contesta» sin llevar la cuenta a mano en el test.
 * @returns {{
 *   fetch: (url: string, opciones?: object) => Promise<Response>,
 *   llamadas: {url: string, intento: number, opciones: object, senal: AbortSignal|null,
 *              abortada: boolean, terminada: boolean}[],
 *   total: number, enVuelo: number, maxSimultaneas: number, abortadas: number,
 *   retenidas: number,
 *   urls: () => string[],
 *   soltar: (cuantas?: number) => number
 * }}
 */
export function crearDobleFetch({ plan = { estado: 200, texto: 'ok' } } = {}) {
  const llamadas = []
  const intentosPorUrl = new Map()
  /** @type {{entregar: () => void}[]} */
  const enEspera = []
  let enVuelo = 0
  let maxSimultaneas = 0

  const guionDe = typeof plan === 'function' ? plan : () => plan

  async function fetchDoble(url, opciones = {}) {
    const senal = opciones && opciones.signal ? opciones.signal : null
    const intento = (intentosPorUrl.get(url) ?? 0) + 1
    intentosPorUrl.set(url, intento)
    const llamada = { url, intento, opciones, senal, abortada: false, terminada: false }
    llamadas.push(llamada)

    enVuelo += 1
    if (enVuelo > maxSimultaneas) maxSimultaneas = enVuelo
    try {
      // `return await` (y no `return` a secas) es lo que hace que el `finally`
      // corra al TERMINAR la petición y no al crearla: sin el `await`, `enVuelo`
      // bajaría de inmediato y la medida de concurrencia sería siempre 1.
      return await new Promise((resolver, rechazar) => {
        const guion = guionDe(url, intento) ?? {}
        let alAbortar = null
        const desconectar = () => {
          if (senal && alAbortar) senal.removeEventListener('abort', alAbortar)
        }
        const entregar = () => {
          desconectar()
          if (guion.error) rechazar(guion.error)
          else if ('noEsRespuesta' in guion) resolver(guion.noEsRespuesta)
          else resolver(respuestaDe(guion))
        }

        if (senal) {
          if (senal.aborted) {
            llamada.abortada = true
            rechazar(errorDeAborto())
            return
          }
          alAbortar = () => {
            llamada.abortada = true
            desconectar()
            rechazar(errorDeAborto())
          }
          senal.addEventListener('abort', alAbortar, { once: true })
        }

        if (guion.pendiente) return // solo un abort puede terminarla
        if (guion.retenida) {
          enEspera.push({ entregar })
          return
        }
        entregar()
      })
    } finally {
      enVuelo -= 1
      llamada.terminada = true
    }
  }

  return {
    fetch: fetchDoble,
    llamadas,
    get total() {
      return llamadas.length
    },
    get enVuelo() {
      return enVuelo
    },
    get maxSimultaneas() {
      return maxSimultaneas
    },
    get abortadas() {
      return llamadas.filter((l) => l.abortada).length
    },
    get retenidas() {
      return enEspera.length
    },
    urls: () => llamadas.map((l) => l.url),
    /**
     * Entrega las peticiones retenidas (las del guion `{retenida: true}`).
     *
     * @param {number} [cuantas=Infinity]
     * @returns {number} cuántas se entregaron de verdad.
     */
    soltar(cuantas = Infinity) {
      const lote = enEspera.splice(0, cuantas === Infinity ? enEspera.length : cuantas)
      for (const pendiente of lote) pendiente.entregar()
      return lote.length
    },
  }
}

/**
 * Construye un `Response` REAL a partir del guion.
 *
 * @param {GuionFetch} guion
 * @returns {Response}
 */
function respuestaDe(guion) {
  const estado = guion.estado ?? 200
  const cabeceras = guion.tipoContenido ? { 'content-type': guion.tipoContenido } : {}
  // `texto` va como `null` cuando no se declara: `new Response(cuerpo, {status})`
  // lanza si se le da cuerpo a un estado que no admite ninguno (204, 304).
  return new Response(guion.texto ?? null, { status: estado, headers: cabeceras })
}

/**
 * Doble de `dormir`: **apunta los milisegundos y resuelve de inmediato**, sin
 * temporizadores de ninguna clase. Es la pieza que hace que la secuencia del
 * backoff sea afirmable (criterio 1) y que la ausencia de temporizadores
 * huérfanos sea contable (criterio 3), sin gastar ni un milisegundo real.
 *
 * Lee antes la nota sobre el reloj del timeout en la cabecera de este fichero:
 * es la única sutileza del arnés.
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.venceElReloj=false]  Si `true`, TAMBIÉN resuelve al
 *   instante el reloj de {@link MS_TIMEOUT} — o sea, el plazo vence siempre. Es
 *   como se prueba el criterio 5.
 * @returns {{
 *   dormir: (ms: number, senal: AbortSignal) => Promise<void>,
 *   esperas: {ms: number, esReloj: boolean, resuelta: boolean, cancelada: boolean}[],
 *   creadas: number, canceladas: number,
 *   msBackoff: () => number[], msReloj: () => number[]
 * }}
 */
export function crearDobleDormir({ venceElReloj = false } = {}) {
  const esperas = []

  function dormir(ms, senal) {
    // `esReloj` se decide por los ms y con la constante IMPORTADA (ver cabecera).
    // Ninguna espera del backoff puede coincidir: su techo es `BACKOFF.maxMs`,
    // tres órdenes por debajo del plazo.
    const espera = { ms, esReloj: ms === MS_TIMEOUT, resuelta: false, cancelada: false }
    esperas.push(espera)
    return new Promise((resolver) => {
      const marcar = () => {
        espera.cancelada = true
      }
      // La cancelación se apunta SIEMPRE, también en una espera ya resuelta: el
      // criterio 3 dice «tantas cancelaciones como temporizadores creó», y la
      // disciplina que comprueba es que el transporte cancele TODAS las esperas
      // que abre, no solo las que aún corren. Una espera resuelta que nadie
      // cancela sería, con un `setTimeout` de verdad, un handle ya disparado…
      // pero también sería la señal de que el `finally` que debía cancelarla no
      // existe, y ese mismo `finally` es el que salva a las que sí siguen vivas.
      if (senal) {
        if (senal.aborted) marcar()
        else senal.addEventListener('abort', marcar, { once: true })
      }
      if (espera.esReloj && !venceElReloj) return // pendiente para siempre
      espera.resuelta = true
      resolver()
    })
  }

  return {
    dormir,
    esperas,
    get creadas() {
      return esperas.length
    },
    get canceladas() {
      return esperas.filter((e) => e.cancelada).length
    },
    /** Milisegundos de las esperas de BACKOFF, en orden de creación. */
    msBackoff: () => esperas.filter((e) => !e.esReloj).map((e) => e.ms),
    /** Milisegundos de los relojes de timeout abiertos (uno por intento). */
    msReloj: () => esperas.filter((e) => e.esReloj).map((e) => e.ms),
  }
}

/** Cede el hilo: deja correr las microtareas (y los `setTimeout(0)`) pendientes. */
export const cederCiclo = () => new Promise((resolver) => setTimeout(resolver, 0))

/**
 * Cede el hilo varias veces seguidas. Un `pedirTexto` atraviesa varios `await`
 * antes de llegar a llamar al `fetch` (validación → cola → carrera), así que un
 * solo ciclo no basta para afirmar «ya están todas en vuelo».
 *
 * @param {number} [veces=5]
 */
export async function cederCiclos(veces = 5) {
  for (let i = 0; i < veces; i += 1) await cederCiclo()
}

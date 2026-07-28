// services/_red.js — F05 · Tarea T1A. El TRANSPORTE de red del proyecto.
//
// ╔══════════════════════════════════════════════════════════════════════════╗
// ║ ESTE MÓDULO NO SABE QUÉ ES EL CATASTRO. Recibe una URL y devuelve un     ║
// ║ resultado HTTP. No sabe qué es una parcela, ni una referencia catastral, ║
// ║ ni un `ExceptionReport`, ni un `posList`. Otros módulos de F05 sí lo     ║
// ║ saben; este es el único que habla de bytes y códigos de estado.          ║
// ║                                                                          ║
// ║ Esa frontera es la decisión que más protege del proyecto, y por eso está ║
// ║ escrita antes que ninguna otra cosa: el servicio del Catastro contesta   ║
// ║ «esa parcela no existe» con **HTTP 200** y un XML de excepción dentro    ║
// ║ (MEDIDO; es el mismo comportamiento que `viewer/wms-catastro.js` anota   ║
// ║ como hecho (g) para el WMS: «el servidor responde HTTP 200, no 4xx»).    ║
// ║ Para un transporte que solo ve HTTP eso es un ÉXITO: devuelve el texto   ║
// ║ y **NO REINTENTA**.                                                      ║
// ║                                                                          ║
// ║ Reintentar un «no existe esa parcela» es inútil —la respuesta será       ║
// ║ idéntica— *y* es la vía más rápida a que el Catastro deniegue el         ║
// ║ servicio: la penalización oficial es una denegación de ~10 días con      ║
// ║ detección de rotación de IP/UA (override O8 del dossier; la cifra de     ║
// ║ «3.600 peticiones/h» NO existe en fuente oficial y no se cita).          ║
// ║                                                                          ║
// ║ Con esta frontera, no reintentar es lo que pasa **POR OMISIÓN**, en vez  ║
// ║ de ser algo de lo que hay que acordarse en cada llamada. Quien quiera    ║
// ║ reintentar un 200 tendrá que escribirlo, verlo y justificarlo.           ║
// ╚══════════════════════════════════════════════════════════════════════════╝
//
// ── PRIMER CÓDIGO ASÍNCRONO DEL PROYECTO ─────────────────────────────────────
// Hasta aquí no había ni un `fetch`, ni un `async`, ni una `Promise` en el
// código de producción: el visor habla con la red por `<img>` y por eventos de
// Leaflet. No hay patrón previo que copiar, así que este módulo deja escrito el
// porqué de cada decisión. Lo que sí hay es un PRECEDENTE de disciplina —
// `viewer/wms-catastro.js`: token de secuencia anti-carrera, liberación del veto
// tras un fallo, contadores expuestos por `estado()`— y este módulo lo traduce a
// promesas en vez de inventarse otra cosa.
//
// ── LAS TRES INYECCIONES, Y LA TERCERA ES LA CLAVE ───────────────────────────
// `fetch`, `ahora` y `dormir` entran por parámetro. Las dos primeras son las
// habituales; la tercera es la que hace testable todo lo demás:
//
//   **NO SE FALSEA EL TIEMPO: SE INYECTA LA ESPERA.** El repo tiene CERO
//   `vi.useFakeTimers` y su precedente para el reloj es la inyección
//   (`gml/_comun.js#dateTimeCatastro` recibe la fecha por parámetro justo para
//   eso, y su cabecera prohíbe leer el reloj del sistema ahí dentro). Un test
//   pasa un `dormir` que APUNTA los ms y RESUELVE de inmediato, y con eso puede
//   afirmar la *secuencia* de esperas —que es lo que de verdad importa del
//   backoff— sin ningún temporizador, ni real ni falso, y sin gastar tiempo.
//
// ── LAS DOS TRAMPAS QUE ESTE MÓDULO EXISTE PARA NO CAER ──────────────────────
//
// 1) **El temporizador huérfano.** El timeout es una carrera entre el `fetch` y
//    `dormir(MS_TIMEOUT)`. Si el `dormir` que PIERDE la carrera deja su
//    `setTimeout` vivo, el proceso se queda con un handle abierto: en Vitest eso
//    es una suite que se cuelga o que avisa al terminar, y en el navegador es
//    trabajo que sigue corriendo para nadie. Por eso hay una regla sin
//    excepciones en este fichero: **toda espera se abre con su propia señal y se
//    ABORTA en un `finally`, gane o pierda** (ver {@link abrirEspera}). Vale
//    igual para el reloj del timeout y para las esperas del backoff. El
//    invariante es comprobable desde fuera —«tantas cancelaciones como
//    temporizadores creados»— y su test lo comprueba.
//
// 2) **El reloj arranca al SALIR de la cola, no al entrar.** Si el timeout
//    empezara a contar al encolar, una petición que espera detrás de otras tres
//    «vencería» sin haberse llegado a enviar nunca, y el usuario vería un
//    «tiempo agotado» de una petición que no existió. Aquí el reloj se abre
//    dentro de {@link crearTransporte}·`emitir`, ya con plaza concedida.
//    Consecuencia deliberada: `ms` del resultado y el reloj del timeout son DOS
//    relojes distintos. `ms` mide de extremo a extremo lo que esperó el llamante
//    (cola incluida, porque es lo que él vivió); `MS_TIMEOUT` mide solo el
//    diálogo con el servidor.
//
// ── LO QUE ESTE MÓDULO NO HACE, Y CONVIENE QUE ESTÉ POR ESCRITO ──────────────
//
//   · **No toca ni una cabecera.** No hay `headers` en ninguna llamada, y desde
//     luego no hay `User-Agent`: es *forbidden header name* (un navegador no
//     puede fijarla ni aunque se lo pidas) y además el Catastro DETECTA Y
//     PENALIZA la rotación de User-Agent (override O8). Medido: el servicio
//     responde 200 sin ninguna cabecera nuestra. La app no tiene nada que hacer
//     aquí, y el criterio de aceptación 5 de F05 («el User-Agent no se rota») se
//     cumple por construcción: no se escribe.
//   · **No decodifica bytes a mano.** Usa `response.text()`, que por
//     especificación decodifica SIEMPRE UTF-8. Es lo correcto aunque parezca lo
//     contrario: el WFS del Catastro declara `encoding="ISO-8859-1"` en el
//     prólogo XML y **sus bytes son UTF-8** (medido; el fixture
//     `cp_parcela_9398516VK3799G.gml` miente sobre sí mismo, ver
//     `test/gml/_canonico.js` fila 7). Nada de `TextDecoder`, ni `'latin1'`, ni
//     `'iso-8859-1'`: harían texto roto a partir de bytes correctos.
//   · **No reintenta un 2xx, jamás. Ni un 4xx.** Solo se reintenta cuando el
//     `fetch` RECHAZA (fallo de red) o cuando el estado es 5xx. Un 4xx es «tu
//     petición está mal»: repetirla da lo mismo tres veces y suma tres marcas en
//     el contador de quien nos vigila.
//   · **No cachea** (eso es de `storage/`), **no deduplica por URL** (eso lo
//     decide quien llama, que es el único que sabe si dos URLs iguales son la
//     misma pregunta) y **no conoce ningún dominio**. `CATASTRO_BASE` vive en
//     `services/catastro.js`, no aquí.
//
// ── Fronteras de responsabilidad (SPEC §2) ───────────────────────────────────
//   · Regla 1 — NINGÚN error silencioso. Un fallo de red no lanza: devuelve un
//     {@link ResultadoHttp} con `motivo` (código estable) y `mensaje` (español
//     presentable), y además avisa por el canal común. El `throw` se reserva al
//     contrato roto por el PROGRAMADOR (`TypeError`/`RangeError`), igual que en
//     `validation/_comun.js#crearHallazgo`.
//   · Regla 7 — «llamadas externas aisladas en services/». Este es el suelo de
//     esa capa: por debajo solo está el `fetch` del navegador.
//   · El canal de aviso es el del proyecto (`viewer/_comun.js#resolverAvisar`),
//     igual que en `services/ign.js`. Ese módulo NO importa Leaflet, así que es
//     seguro bajo el proyecto Vitest `node` — y por eso el test de este fichero
//     no lleva sufijo `.dom`. (Peculiaridad conocida y asumida: el avisador por
//     defecto prefija `[visor]`. Es el precio de tener UN canal en vez de dos.)

import { NIVEL, resolverAvisar } from '../viewer/_comun.js'

// ── Motivos ───────────────────────────────────────────────────────────────────

/**
 * Por qué no se pudo entregar el cuerpo. Códigos estables: la UI puede decidir
 * con ellos **sin analizar el texto de `mensaje`** (misma disciplina que
 * `gml/descargar.js#MOTIVO_NO_DESCARGADO`).
 *
 * La lista es corta a propósito: **solo está lo que este módulo puede MEDIR**.
 * No hay `NO_ENCONTRADO`, ni `LIMITE_EXCEDIDO`, ni `CORS`, porque nada de eso es
 * observable desde aquí — el primero llega dentro de un cuerpo con HTTP 200 y el
 * último es indistinguible de estar sin red (ver {@link MOTIVO_RED.SIN_RED}).
 *
 * @readonly
 */
export const MOTIVO_RED = Object.freeze({
  // Hubo respuesta y su código NO es 2xx. `estado` lleva el número exacto: quien
  // llama puede distinguir un 404 de un 503 sin leer ni una palabra en español.
  ESTADO_HTTP: 'ESTADO_HTTP',

  // Dejamos de esperar (ver {@link MS_TIMEOUT}). No dice que el servidor esté
  // caído; dice que no contestó dentro de nuestro plazo.
  TIEMPO_AGOTADO: 'TIEMPO_AGOTADO',

  // El `fetch` RECHAZÓ: no llegó a haber respuesta. **Agrupa a propósito
  // offline, DNS, TLS y CORS**, y esto no es dejadez, es la verdad de lo que se
  // puede saber: un fallo de CORS rechaza el `fetch` con **el mismo `TypeError`
  // ("Failed to fetch")** que estar sin red. El motivo real solo aparece en la
  // consola de devtools, escrito por el navegador, y es INALCANZABLE desde
  // script. Separarlos en cuatro motivos sería inventarse una precisión que no
  // tenemos, y la UI acabaría diciendo «error de CORS» cuando lo que pasa es que
  // el usuario tiene el wifi caído. Lo honesto es un solo motivo y un `mensaje`
  // que NOMBRE LAS CUATRO POSIBILIDADES, para que el usuario pueda orientarse.
  SIN_RED: 'SIN_RED',

  // El llamante abortó (o se destruyó el transporte). No es un fallo del
  // servicio y NO cuenta como `fallidas` en {@link crearTransporte}·`estado()`.
  CANCELADA: 'CANCELADA',
})

// ── Constantes de disciplina de peticiones ────────────────────────────────────

/**
 * Peticiones simultáneas como máximo. **No es un ajuste de rendimiento**, y
 * conviene que quede claro para que nadie lo suba «porque va lento»:
 *
 *   · A 0,099–0,451 s por petición al WFS (MEDIDO contra el servicio real), la
 *     serie completa de una carga de parcela cabe en un par de segundos
 *     igualmente. Subir este número no haría la app perceptiblemente más rápida.
 *   · Lo que sí haría es **parecer un raspador automático**, que es exactamente
 *     el perfil que el Catastro penaliza con la denegación de ~10 días (override
 *     O8). El anti-bloqueo real de F05 es caché + cola + backoff + WMS por
 *     encuadre, y esta constante es la pata «cola».
 *   · Y hay un motivo de memoria: un BBOX puede pesar **1,15 MB** (medido). Dos
 *     en vuelo ya son 2,3 MB de texto vivo en una pestaña.
 *
 * La spec de F05 admite «máx 2–4»; se elige el extremo prudente.
 */
export const MAX_CONCURRENCIA = 2

/**
 * Plazo tras el cual se deja de esperar una respuesta, en milisegundos.
 *
 * **No es un umbral de calidad** —no dice que una respuesta de 14 s sea
 * aceptable— sino el punto en que dejamos de esperar: pasado eso, lo que hay al
 * otro lado no va a contestar, y seguir esperando solo retiene una plaza de
 * {@link MAX_CONCURRENCIA} y un usuario mirando una rueda que gira.
 *
 * ⚠️ **El margen es mucho menor de lo que parece, y conviene saberlo antes de
 * bajarlo.** Los dos servicios que atraviesan este transporte NO van a la misma
 * velocidad (medido el 2026-07-27, ver `test/fixtures/catastro/PROCEDENCIA.md`):
 *
 *   · WFS (`wfsCP.aspx`)      0,099–0,451 s  →  este plazo es ~33× lo peor visto
 *   · OVC (`Consulta_RCCOOR`) hasta **2,903 s** →  este plazo es solo ~5×
 *
 * El OVC es diez veces más lento porque abre sesión ASP.NET nueva en cada
 * llamada. Un plazo calculado sobre la latencia del WFS —que es la que se mide
 * primero, porque es el servicio principal— **cortaría llamadas buenas de
 * geocodificación**. Si alguien viene a afinar este número, que lo haga contra
 * los 2,9 s, no contra los 0,2 s.
 */
export const MS_TIMEOUT = 15000

/**
 * Reintentos y espera entre ellos. **Jitter completo, y no es opcional.**
 *
 * La espera del intento `n` es:
 *
 * ```js
 * espera = aleatorio() * Math.min(maxMs, baseMs * factor ** (n - 1))
 * ```
 *
 * Es decir: el backoff exponencial fija el TECHO y el azar elige un punto
 * cualquiera por debajo. Un backoff sin jitter es determinista, y varias
 * pestañas de esta misma app comparten IP: si tres pestañas tropiezan con el
 * mismo 503, sin jitter reintentan las tres **a la vez**, y otra vez a la vez, y
 * otra — oleadas sincronizadas contra un servicio que ya iba mal. Ese es
 * justamente el patrón que el Catastro penaliza. El jitter las desparrama.
 *
 * `intentos: 3` cuenta el PRIMER envío: 3 intentos = 1 envío + 2 reintentos, y
 * por tanto **2 esperas**. No se redondea la espera a entero: su única
 * consumidora es `setTimeout` (que ya trunca), y redondear aquí obligaría al
 * test a reproducir el redondeo en vez de derivar la cifra de esta constante.
 *
 * @readonly
 */
export const BACKOFF = Object.freeze({ intentos: 3, baseMs: 400, factor: 2, maxMs: 4000 })

// ── Mensajes ──────────────────────────────────────────────────────────────────

/**
 * Textos en español, presentables tal cual (regla de oro 1). Se componen aquí y
 * no en la UI para que un mismo suceso se cuente siempre con las mismas
 * palabras. Van DESPUÉS de las constantes porque uno de ellos deriva de
 * {@link MS_TIMEOUT}: el plazo se dice en el mensaje y se cumple en el código
 * leyendo el mismo número, así que no pueden desincronizarse.
 *
 * @readonly
 */
const MENSAJES = Object.freeze({
  TIEMPO_AGOTADO:
    `El servicio no ha respondido en ${MS_TIMEOUT / 1000} segundos. ` +
    'Puede estar saturado o no disponible en este momento; vuelve a intentarlo dentro de un rato.',

  // Las CUATRO posibilidades, nombradas. Ver {@link MOTIVO_RED.SIN_RED}: el
  // navegador no nos deja saber cuál de ellas es, así que se dicen todas en vez
  // de elegir una al azar y sonar seguros de algo que no sabemos.
  SIN_RED:
    'No se ha podido contactar con el servicio. Puede ser una falta de conexión a internet, ' +
    'un problema al resolver el nombre del servidor (DNS), un problema con su certificado (TLS), ' +
    'o que el servicio haya dejado de permitir el acceso desde el navegador (CORS). ' +
    'El navegador no permite distinguir cuál de los cuatro es.',

  CANCELADA: 'La consulta se ha cancelado antes de terminar.',
})

/**
 * Mensaje de un estado HTTP no 2xx. Se separa en dos frases —el hecho y su
 * lectura— porque el número por sí solo no le dice nada a un colegiado.
 *
 * @param {number} estado
 * @returns {string}
 */
function mensajeDeEstado(estado) {
  const lectura =
    estado >= 500
      ? 'Es un fallo del servidor, no de la consulta.'
      : estado === 404
        ? 'El servidor dice que esa dirección no existe.'
        : estado >= 400
          ? 'El servidor ha rechazado la consulta.'
          : 'El servidor ha respondido algo que no es una entrega de datos.'
  return `El servicio ha respondido con el código HTTP ${estado}. ${lectura}`
}

// ── Espera por defecto ────────────────────────────────────────────────────────

/**
 * Espera `ms` milisegundos y resuelve. **Escucha la señal**: si se aborta,
 * `clearTimeout` y resuelve YA. Es el `dormir` por defecto de
 * {@link crearTransporte}, y el único sitio del módulo donde hay un
 * `setTimeout`.
 *
 * Contrato deliberado: **abortar RESUELVE, no rechaza.** «Deja de esperar» no es
 * un error, y si rechazara, cada espera perdedora de una carrera dejaría una
 * promesa rechazada sin manejador — que en Vitest es un fallo del fichero entero
 * y en el navegador un `unhandledrejection`. Quien llama sabe por qué canceló;
 * no necesita que se lo cuenten con una excepción.
 *
 * El `removeEventListener` no es cosmético: la señal del llamante puede vivir
 * mucho más que una espera concreta (un `AbortController` por pantalla, por
 * ejemplo), y una señal a la que se le van acumulando manejadores es una fuga
 * tan real como un temporizador huérfano.
 *
 * @param {number} ms
 * @param {AbortSignal|null} [senal]
 * @returns {Promise<void>}
 */
export function dormirConTemporizador(ms, senal = null) {
  return new Promise((resolver) => {
    if (senal && senal.aborted) {
      resolver()
      return
    }
    let temporizador = null
    const limpiar = () => {
      if (temporizador !== null) clearTimeout(temporizador)
      temporizador = null
      if (senal) senal.removeEventListener('abort', alAbortar)
    }
    function alAbortar() {
      limpiar()
      resolver()
    }
    if (senal) senal.addEventListener('abort', alAbortar, { once: true })
    temporizador = setTimeout(() => {
      limpiar()
      resolver()
    }, ms)
  })
}

// ── Utilidades internas ───────────────────────────────────────────────────────

/**
 * Marca de «contrato roto por el programador» en un error que viaja por caminos
 * asíncronos. Sin ella, el `catch` que traduce fallos de red a
 * {@link MOTIVO_RED.SIN_RED} se tragaría también los `TypeError` de una
 * inyección mal cableada, y un bug del programa se disfrazaría de problema de
 * red del usuario — que es la peor confusión posible en este módulo.
 */
const ERROR_DE_CONTRATO = Symbol('services/_red: contrato roto por el programador')

/** Testigo con el que el reloj gana la carrera al `fetch`. */
const TESTIGO_TIEMPO = Symbol('services/_red: se agotó el plazo')

/**
 * @param {string} mensaje
 * @returns {TypeError} marcado para que no lo capture la traducción de fallos de red.
 */
function errorDeContrato(mensaje) {
  const error = new TypeError(mensaje)
  error[ERROR_DE_CONTRATO] = true
  return error
}

/**
 * ¿Sirve como `AbortSignal`? DUCK TYPING deliberado, no `instanceof AbortSignal`:
 * misma disciplina que `gml/descargar.js#esDocumentoUtil` («se pide exactamente
 * lo que este módulo usa y nada más, para que un doble de test no tenga que
 * fingir un documento entero»).
 *
 * @param {*} s
 * @returns {boolean}
 */
function esSenal(s) {
  return (
    !!s &&
    typeof s === 'object' &&
    typeof s.aborted === 'boolean' &&
    typeof s.addEventListener === 'function' &&
    typeof s.removeEventListener === 'function'
  )
}

/** @param {AbortSignal|null} senal @returns {boolean} */
function abortada(senal) {
  return !!senal && senal.aborted === true
}

/**
 * ¿Sirve como `Response`? Lo mínimo que este módulo consulta: `status` y
 * `text()`. Si no lo cumple, la inyección de `fetch` está mal cableada y eso es
 * un bug, no un problema de red (ver {@link ERROR_DE_CONTRATO}).
 *
 * @param {*} r
 * @returns {boolean}
 */
function esRespuesta(r) {
  return !!r && typeof r === 'object' && typeof r.status === 'number' && typeof r.text === 'function'
}

/**
 * `Content-Type` tal cual lo mande el servidor, sin interpretarlo. En
 * particular **no se mira el `charset`**: el cuerpo se decodifica siempre como
 * UTF-8 (ver la cabecera del módulo), así que leerlo solo serviría para
 * tentarse a hacer lo contrario.
 *
 * @param {*} respuesta
 * @returns {string|null}
 */
function tipoContenidoDe(respuesta) {
  const cabeceras = respuesta.headers
  if (!cabeceras || typeof cabeceras.get !== 'function') return null
  const valor = cabeceras.get('content-type')
  return typeof valor === 'string' ? valor : null
}

/**
 * Encadena la señal del llamante a un `AbortController` interno.
 *
 * @param {AbortController} controlador
 * @param {AbortSignal|null} senal
 * @returns {() => void} función que DESCONECTA el encadenado (llamar siempre en
 *   un `finally`: ver la nota sobre fugas de {@link dormirConTemporizador}).
 */
function encadenarSenal(controlador, senal) {
  if (!senal) return () => {}
  if (senal.aborted) {
    controlador.abort()
    return () => {}
  }
  const alAbortar = () => controlador.abort()
  senal.addEventListener('abort', alAbortar, { once: true })
  return () => senal.removeEventListener('abort', alAbortar)
}

// ── Typedefs del contrato ─────────────────────────────────────────────────────

/**
 * Resultado de una petición. POJO plano y **con las MISMAS NUEVE CLAVES
 * SIEMPRE**, salga bien o mal: quien lo reciba las lee sin comprobar antes si
 * existen (misma disciplina que `gml/descargar.js#ResultadoDescarga`). Un
 * resultado cuya forma depende de si hubo éxito obliga a todos sus consumidores
 * a defenderse, y tarde o temprano uno se olvida.
 *
 * Invariantes que se pueden dar por buenos:
 *   · `ok === true` ⟺ `motivo === null` ⟺ `mensaje === null`.
 *   · `texto !== null` ⟺ `ok` — el cuerpo solo se lee en 2xx (ver `emitir`).
 *   · `estado === null` ⟺ no llegó a haber respuesta (red, plazo, cancelación).
 *   · `intentos` cuenta peticiones **EMITIDAS de verdad**: es 0 si se canceló
 *     antes de llegar a la red, y nunca pasa de `BACKOFF.intentos`.
 *
 * @typedef {Object} ResultadoHttp
 * @property {boolean} ok            `true` si hubo respuesta 2xx. **No dice nada
 *   del CONTENIDO**: un `ExceptionReport` del Catastro llega con HTTP 200 y por
 *   tanto con `ok: true`. Interpretarlo es de otro módulo.
 * @property {number|null} estado    Código HTTP, o `null` si no llegó a haberlo.
 * @property {string|null} texto     Cuerpo decodificado como UTF-8, o `null`.
 * @property {string|null} tipoContenido  `Content-Type` sin interpretar, o `null`.
 * @property {string|null} motivo    Clave de {@link MOTIVO_RED}; `null` si `ok`.
 * @property {string|null} mensaje   Español presentable; `null` si `ok`.
 * @property {number} intentos       Peticiones EMITIDAS de verdad.
 * @property {number} ms             Milisegundos de extremo a extremo, **cola
 *   incluida** (es lo que esperó el llamante; no es el reloj del timeout).
 * @property {string} url            La URL pedida, tal cual se recibió.
 */

/**
 * Contadores ACUMULADOS del transporte, al estilo de
 * `viewer/wms-catastro.js#estado()`. No se reinician nunca —tampoco al
 * `destruir()`: un contador que se borra es un contador que miente sobre lo que
 * pasó— salvo los dos instantáneos, que son fotografías del momento.
 *
 * Hay **dos unidades** y conviene no confundirlas: una *operación* es una
 * llamada a `pedirTexto`; una *petición* es una llamada real al `fetch`. Una
 * operación puede costar entre 0 y `BACKOFF.intentos` peticiones.
 *
 * @typedef {Object} EstadoTransporte
 * @property {number} peticiones  Peticiones HTTP EMITIDAS (llamadas al `fetch`).
 *   Es el número que cuadra exactamente con un doble de `fetch`.
 * @property {number} exitos      Operaciones terminadas con `ok: true`.
 * @property {number} fallidas    Operaciones terminadas con `ok: false` y motivo
 *   distinto de `CANCELADA`. **Cancelar no es fallar** (criterio 6 de la tarea):
 *   una cancelación es una decisión de la app, no un problema del servicio, y
 *   contarla como fallo emborronaría el único contador que sirve para saber si
 *   el servicio va mal.
 * @property {number} reintentos  Peticiones que NO eran el primer intento de su
 *   operación. `peticiones - reintentos` = operaciones que llegaron a la red.
 * @property {number} enCola      Operaciones esperando plaza AHORA MISMO.
 * @property {number} enVuelo     Operaciones que ocupan plaza AHORA MISMO
 *   (0..{@link MAX_CONCURRENCIA}). Una operación esperando su backoff entre dos
 *   intentos SIGUE ocupando plaza, a propósito: si la soltara, entraría otra
 *   operación y el pico real de peticiones simultáneas podría superar el máximo.
 */

// ── Transporte ────────────────────────────────────────────────────────────────

/**
 * Crea el transporte: cola, timeout, backoff con jitter y contadores.
 *
 * Es una factory (`crearX`), nunca una clase (convención del proyecto). El
 * estado vive en el cierre, así que dos transportes no comparten ni cola ni
 * contadores — útil de verdad: los tests crean uno por caso y no hay nada que
 * reiniciar entre ellos.
 *
 * ```js
 * const red = crearTransporte({ alAvisar })
 * const r = await red.pedirTexto(url, { senal: control.signal })
 * if (r.ok) parsear(r.texto)          // ← `ok` es HTTP, no «hay parcela»
 * else mostrar(r.mensaje)             // ← ya viene en español
 * ```
 *
 * @param {object} [opciones]
 * @param {typeof globalThis.fetch} [opciones.fetch=globalThis.fetch]  El `fetch`
 *   a usar. Se inyecta para poder medir peticiones sin red (y porque en Node el
 *   global existe pero no queremos que un test toque internet jamás).
 * @param {() => number} [opciones.ahora=() => Date.now()]  Reloj para medir `ms`.
 *   Se inyecta por el mismo motivo que `gml/_comun.js#dateTimeCatastro` recibe la
 *   fecha: un módulo que lee el reloj del sistema no es reproducible.
 * @param {() => number} [opciones.aleatorio=Math.random]  Fuente del jitter, en
 *   [0,1). Inyectarla es lo que permite comprobar la secuencia de esperas en los
 *   dos extremos (0 y 1) en vez de tener que aceptar «pues salió un número».
 * @param {(ms: number, senal: AbortSignal) => Promise<void>} [opciones.dormir]
 *   La espera. **Aquí es donde se inyecta el tiempo** (ver la cabecera). Debe
 *   RESOLVER al abortarse la señal, nunca rechazar.
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]
 *   Canal de aviso (regla 1). Por defecto, el del proyecto.
 * @returns {{pedirTexto: (url: string, opciones?: {senal?: AbortSignal|null}) => Promise<ResultadoHttp>,
 *            estado: () => EstadoTransporte,
 *            destruir: () => void}}
 * @throws {TypeError} Si alguna inyección no es una función (contrato roto por
 *   el programador). En particular, si el entorno no trae `fetch` y no se pasa
 *   ninguno: eso se dice aquí y no se descubre en la primera petición.
 */
export function crearTransporte(opciones = {}) {
  if (!opciones || typeof opciones !== 'object') {
    throw new TypeError(
      `crearTransporte: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`,
    )
  }
  const {
    fetch: fetchDe = globalThis.fetch,
    ahora = () => Date.now(),
    aleatorio = Math.random,
    dormir = dormirConTemporizador,
    alAvisar = null,
  } = opciones

  if (typeof fetchDe !== 'function') {
    throw new TypeError(
      `crearTransporte: 'fetch' debe ser una función. Si este entorno no trae ` +
        `\`globalThis.fetch\` (Node antiguo, o un test que no debe tocar la red), ` +
        `inyéctalo: crearTransporte({ fetch }). Recibido ${typeof fetchDe}.`,
    )
  }
  for (const [nombre, fn] of [
    ['ahora', ahora],
    ['aleatorio', aleatorio],
    ['dormir', dormir],
  ]) {
    if (typeof fn !== 'function') {
      throw new TypeError(`crearTransporte: '${nombre}' debe ser una función; recibido ${typeof fn}.`)
    }
  }

  const avisar = resolverAvisar(alAvisar)

  // Contadores acumulados (ver {@link EstadoTransporte}).
  const cuenta = { peticiones: 0, exitos: 0, fallidas: 0, reintentos: 0 }

  /** @type {{conceder: () => void, cancelar: () => void}[]} Cola de espera FIFO. */
  const cola = []
  /** Operaciones que ocupan plaza (fetch en vuelo o esperando su backoff). */
  let enVuelo = 0
  /** Controladores de las peticiones vivas, para poder abortarlas al destruir. */
  const controladoresVivos = new Set()
  /**
   * Señal de VIDA del transporte: se aborta en `destruir()` y va encadenada a
   * toda espera. Sin ella, destruir el transporte mientras una operación está en
   * su espera de backoff dejaría corriendo un `setTimeout` de hasta
   * `BACKOFF.maxMs` sobre un transporte que ya no existe — el temporizador
   * huérfano de la trampa 1, entrando por la puerta de atrás.
   */
  const controlVida = new AbortController()
  let destruido = false

  // ── Cola de concurrencia ────────────────────────────────────────────────────

  /**
   * Pide plaza. FIFO: quien llega antes sale antes, que es lo que espera un
   * usuario que ha pedido cuatro parcelas seguidas.
   *
   * @param {AbortSignal|null} senal
   * @returns {Promise<boolean>} `true` si consiguió plaza; `false` si se canceló
   *   mientras esperaba (y entonces NO se emite ninguna petición: cancelar en
   *   cola cuesta cero peticiones al Catastro, que es medio motivo de que la
   *   cola exista).
   */
  function pedirPlaza(senal) {
    if (enVuelo < MAX_CONCURRENCIA && cola.length === 0) {
      enVuelo += 1
      return Promise.resolve(true)
    }
    return new Promise((resolver) => {
      /** @type {{conceder: () => void, cancelar: () => void}} */
      const entrada = { conceder: () => {}, cancelar: () => {} }
      let soltarSenal = () => {}
      const sacarDeCola = () => {
        const i = cola.indexOf(entrada)
        if (i >= 0) cola.splice(i, 1)
        soltarSenal()
      }
      entrada.conceder = () => {
        sacarDeCola()
        enVuelo += 1
        resolver(true)
      }
      entrada.cancelar = () => {
        sacarDeCola()
        resolver(false)
      }
      cola.push(entrada)
      if (senal) {
        // No hace falta mirar `senal.aborted` aquí: `pedirTexto` lo comprueba
        // justo antes de llamar, sin ningún `await` de por medio, así que una
        // señal ya abortada no puede llegar a encolarse. (Si algún día se
        // introdujera un `await` en ese hueco, esta entrada se quedaría en la
        // cola para siempre — de ahí que quede escrito de qué depende.)
        const alAbortar = () => entrada.cancelar()
        senal.addEventListener('abort', alAbortar, { once: true })
        soltarSenal = () => senal.removeEventListener('abort', alAbortar)
      }
    })
  }

  /** Suelta la plaza y deja entrar al siguiente de la cola, si lo hay. */
  function liberarPlaza() {
    enVuelo -= 1
    const siguiente = cola.shift()
    if (siguiente) siguiente.conceder()
  }

  // ── Esperas (la regla sin excepciones: toda espera se cancela) ───────────────

  /**
   * Abre una espera CON su cancelación. La disciplina del módulo (trampa 1 de la
   * cabecera) es que el `cancelar()` devuelto se llame SIEMPRE en un `finally`,
   * haya terminado la espera o no: `clearTimeout` sobre un temporizador ya
   * disparado no cuesta nada, y no llamarlo sobre uno vivo cuesta un handle
   * abierto que cuelga la suite.
   *
   * @param {number} ms
   * @param {AbortSignal|null} [senalExterna]  Señal que además puede acortarla.
   * @returns {{promesa: Promise<void>, cancelar: () => void}}
   */
  function abrirEspera(ms, senalExterna = null) {
    const control = new AbortController()
    const soltarExterna = encadenarSenal(control, senalExterna)
    const soltarVida = encadenarSenal(control, controlVida.signal)
    const soltar = () => {
      soltarExterna()
      soltarVida()
    }
    const promesa = dormir(ms, control.signal)
    if (!promesa || typeof promesa.then !== 'function') {
      soltar()
      throw errorDeContrato(
        `crearTransporte: 'dormir' debe devolver una promesa; devolvió ${typeof promesa}.`,
      )
    }
    return {
      promesa,
      cancelar() {
        control.abort()
        soltar()
      },
    }
  }

  /**
   * Espera del backoff antes del intento `n + 1`. La fórmula está en
   * {@link BACKOFF}; aquí solo se aplica.
   *
   * La señal del llamante SÍ se encadena: cancelar durante una espera de hasta 4
   * segundos tiene que cortarla en el acto, o la app se sentiría colgada
   * después de que el usuario haya pulsado «cancelar».
   *
   * @param {number} n  Número del intento que acaba de fallar (1-based).
   * @param {AbortSignal|null} senal
   */
  async function esperarBackoff(n, senal) {
    const techo = Math.min(BACKOFF.maxMs, BACKOFF.baseMs * BACKOFF.factor ** (n - 1))
    const espera = abrirEspera(aleatorio() * techo, senal)
    try {
      await espera.promesa
    } finally {
      espera.cancelar()
    }
  }

  // ── Una petición ────────────────────────────────────────────────────────────

  /**
   * Emite UNA petición y la resuelve en una de cuatro formas. No reintenta y no
   * decide nada de política: eso es de `ejecutar`.
   *
   * El reloj del timeout se abre AQUÍ, con la plaza ya concedida (trampa 2 de la
   * cabecera): una petición que espera en cola no puede «vencer» sin haberse
   * enviado.
   *
   * El reloj NO se encadena a la señal del llamante, a propósito: si se
   * encadenara, cancelar acortaría el reloj y la carrera la ganaría el testigo
   * de tiempo, con lo que una cancelación se contaría como `TIEMPO_AGOTADO`. La
   * cancelación llega por el otro lado (aborta el `fetch`) y se reconoce por la
   * señal, que es la verdad de lo que pasó.
   *
   * @param {string} url
   * @param {AbortSignal|null} senal
   * @returns {Promise<{tipo: 'RESPUESTA', ok: boolean, estado: number, texto: string|null, tipoContenido: string|null}
   *                 | {tipo: 'TIEMPO'} | {tipo: 'CANCELADA'} | {tipo: 'RED', causa: *}>}
   */
  async function emitir(url, senal) {
    const controlador = new AbortController()
    const soltarSenal = encadenarSenal(controlador, senal)
    controladoresVivos.add(controlador)
    let reloj = null
    try {
      reloj = abrirEspera(MS_TIMEOUT, null)

      // El cuerpo se lee DENTRO de la carrera, no después: si no, una respuesta
      // que llega enseguida pero cuyo cuerpo tarda un minuto en bajar (1,15 MB
      // por un enlace malo) quedaría fuera del plazo y el timeout no serviría de
      // nada. El plazo cubre la conversación entera.
      const peticion = (async () => {
        // Sin `headers`. Ni una. Ver la cabecera del módulo: `User-Agent` es
        // *forbidden header name* y el Catastro penaliza su rotación.
        const respuesta = await fetchDe(url, { signal: controlador.signal })
        if (!esRespuesta(respuesta)) {
          throw errorDeContrato(
            `crearTransporte: el 'fetch' inyectado debe resolver algo con \`status\` (número) ` +
              `y \`text()\` (función), como un Response; resolvió ${typeof respuesta}.`,
          )
        }
        const estadoHttp = respuesta.status
        const ok = estadoHttp >= 200 && estadoHttp < 300
        return {
          tipo: 'RESPUESTA',
          ok,
          estado: estadoHttp,
          tipoContenido: tipoContenidoDe(respuesta),
          // Solo se lee el cuerpo de un 2xx. Un cuerpo no-2xx no tiene contrato
          // (puede ser una página de error de un proxy de 2 MB), leerlo puede
          // fallar por su cuenta y enturbiaría un `ESTADO_HTTP` que ya está
          // perfectamente diagnosticado por su número. Además el único cuerpo de
          // error que le importa a este proyecto —el `ExceptionReport` del
          // Catastro— llega con HTTP **200** y por tanto SÍ se lee.
          texto: ok ? await respuesta.text() : null,
        }
      })()

      // La perdedora de la carrera no puede quedarse sin manejador: cuando gana
      // el reloj, abortamos el `fetch` y esta promesa rechaza con AbortError. Sin
      // este `catch` vacío sería una UNHANDLED REJECTION, que Vitest imputa al
      // fichero entero y el navegador emite como `unhandledrejection`. No se está
      // tapando nada: el resultado de esa promesa ya no le importa a nadie.
      peticion.catch(() => {})

      const resuelto = await Promise.race([
        peticion,
        reloj.promesa.then(() => TESTIGO_TIEMPO),
      ])

      if (resuelto === TESTIGO_TIEMPO) {
        // Se abandona la petición de verdad: sin esto, el `fetch` seguiría vivo
        // ocupando conexión y descargando bytes que ya nadie va a leer.
        controlador.abort()
        // Si además el llamante había cancelado, manda la cancelación: es la
        // descripción más veraz de lo que ocurrió, y no cuenta como fallo.
        return abortada(senal) || destruido ? { tipo: 'CANCELADA' } : { tipo: 'TIEMPO' }
      }
      return resuelto
    } catch (error) {
      if (error && error[ERROR_DE_CONTRATO]) throw error
      if (abortada(senal) || destruido) return { tipo: 'CANCELADA' }
      // Todo lo demás es SIN_RED: offline, DNS, TLS y CORS llegan aquí con el
      // MISMO `TypeError` y no hay forma de distinguirlos (ver MOTIVO_RED).
      return { tipo: 'RED', causa: error }
    } finally {
      if (reloj) reloj.cancelar()
      soltarSenal()
      controladoresVivos.delete(controlador)
    }
  }

  // ── Resultados ──────────────────────────────────────────────────────────────

  /**
   * ÚNICA fábrica de {@link ResultadoHttp} del módulo: por aquí pasan los seis
   * caminos de salida, y por eso las nueve claves están siempre y en el mismo
   * orden. Escribir el objeto a mano en cada `return` es exactamente cómo
   * aparecen los resultados a los que les falta una clave.
   *
   * @param {object} campos
   * @returns {ResultadoHttp}
   */
  function crearResultado({
    ok,
    estado = null,
    texto = null,
    tipoContenido = null,
    motivo = null,
    mensaje = null,
    intentos,
    ms,
    url,
  }) {
    return { ok, estado, texto, tipoContenido, motivo, mensaje, intentos, ms, url }
  }

  // ── Política: reintentos ────────────────────────────────────────────────────

  /**
   * Ejecuta la operación con su política de reintentos, ya con plaza concedida.
   *
   * **Qué se reintenta, y solo esto:**
   *   · que el `fetch` RECHACE (fallo de red): puede ser un tropiezo momentáneo.
   *   · un estado **5xx**: el servidor dice que el fallo es suyo, y suyo puede
   *     ser también el arreglo un segundo después.
   *
   * **Qué NO se reintenta, y por qué está escrito:**
   *   · **2xx**, jamás — es un éxito, aunque el cuerpo diga «no existe esa
   *     parcela» (la frontera de la cabecera).
   *   · **4xx** — «tu petición está mal»: repetirla da lo mismo tres veces y deja
   *     tres marcas en el contador de quien nos vigila.
   *   · **TIEMPO_AGOTADO** — decisión de este módulo, no obvia, así que se
   *     razona: ya hemos esperado {@link MS_TIMEOUT}, que es un orden de
   *     magnitud largo por encima de lo peor medido (2,9 s en el OVC, 0,45 s en
   *     el WFS). Un servicio que no contesta en 15 s está caído o saturado, y
   *     echarle dos peticiones más encima es exactamente la oleada que el
   *     Catastro penaliza. Además triplicaría la espera del usuario (45 s) para
   *     acabar diciéndole lo mismo. Quien quiera reintentar, que lo decida
   *     arriba, con la pantalla delante.
   *   · **CANCELADA** — lo pidió el llamante.
   *
   * @param {string} url
   * @param {AbortSignal|null} senal
   * @param {number} inicio  Marca de {@link crearTransporte}·`ahora` al entrar.
   * @returns {Promise<ResultadoHttp>}
   */
  async function ejecutar(url, senal, inicio) {
    const transcurrido = () => Math.max(0, ahora() - inicio)

    /** @returns {ResultadoHttp} */
    const fallar = (motivo, mensaje, { estado = null, intentos, causa = undefined }) => {
      cuenta.fallidas += 1
      // Regla de oro 1: ningún error silencioso. NIVEL.AVISO y no ERROR, por la
      // regla de clasificación de `viewer/_comun.js`: ERROR es lo que BLOQUEA la
      // generación del GML, y que el Catastro no conteste no bloquea nada — la
      // geometría del usuario está en el modelo. Aquí se pierde una consulta,
      // no un trabajo.
      avisar(mensaje, { nivel: NIVEL.AVISO, causa })
      return crearResultado({
        ok: false,
        estado,
        motivo,
        mensaje,
        intentos,
        ms: transcurrido(),
        url,
      })
    }

    /** @returns {ResultadoHttp} Cancelación: NO avisa y NO cuenta como fallo. */
    const cancelar = (intentos) =>
      crearResultado({
        ok: false,
        motivo: MOTIVO_RED.CANCELADA,
        mensaje: MENSAJES.CANCELADA,
        intentos,
        ms: transcurrido(),
        url,
      })

    for (let n = 1; n <= BACKOFF.intentos; n += 1) {
      if (abortada(senal) || destruido) return cancelar(n - 1)

      cuenta.peticiones += 1
      if (n > 1) cuenta.reintentos += 1
      const r = await emitir(url, senal)
      const ultimo = n === BACKOFF.intentos

      if (r.tipo === 'CANCELADA') return cancelar(n)
      if (r.tipo === 'TIEMPO') {
        return fallar(MOTIVO_RED.TIEMPO_AGOTADO, MENSAJES.TIEMPO_AGOTADO, { intentos: n })
      }
      if (r.tipo === 'RESPUESTA') {
        if (r.ok) {
          cuenta.exitos += 1
          return crearResultado({
            ok: true,
            estado: r.estado,
            texto: r.texto,
            tipoContenido: r.tipoContenido,
            intentos: n,
            ms: transcurrido(),
            url,
          })
        }
        if (r.estado >= 500 && !ultimo) {
          await esperarBackoff(n, senal)
          continue
        }
        return fallar(MOTIVO_RED.ESTADO_HTTP, mensajeDeEstado(r.estado), {
          estado: r.estado,
          intentos: n,
        })
      }
      // r.tipo === 'RED'
      if (!ultimo) {
        await esperarBackoff(n, senal)
        continue
      }
      return fallar(MOTIVO_RED.SIN_RED, MENSAJES.SIN_RED, { intentos: n, causa: r.causa })
    }

    // Inalcanzable: el bucle solo sale por `return`. Se deja explícito porque un
    // camino sin `return` devolvería `undefined` y rompería el contrato de «las
    // mismas nueve claves siempre» justo donde nadie lo estaría mirando.
    /* c8 ignore next */
    throw errorDeContrato('services/_red: el bucle de intentos terminó sin resultado.')
  }

  // ── API ─────────────────────────────────────────────────────────────────────

  /**
   * Pide una URL y devuelve su texto. **Nunca rechaza por un problema de red**:
   * los fallos vienen como {@link ResultadoHttp} con `motivo` y `mensaje`. Solo
   * rechaza si el contrato lo rompe el programador (una URL que no es cadena,
   * una `senal` que no es señal, un `fetch` inyectado que no resuelve un
   * Response…).
   *
   * @param {string} url
   * @param {object} [opciones]
   * @param {AbortSignal|null} [opciones.senal]  Señal del llamante. Cancelar
   *   mientras la operación espera en cola cuesta **cero** peticiones.
   * @returns {Promise<ResultadoHttp>}
   * @throws {TypeError} Contrato roto por el programador.
   */
  async function pedirTexto(url, opciones = {}) {
    if (typeof url !== 'string' || url.trim() === '') {
      throw new TypeError(
        `pedirTexto: 'url' debe ser una cadena no vacía; recibido ${JSON.stringify(url)}.`,
      )
    }
    if (!opciones || typeof opciones !== 'object') {
      throw new TypeError(`pedirTexto: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`)
    }
    const senal = opciones.senal === undefined ? null : opciones.senal
    if (senal !== null && !esSenal(senal)) {
      throw new TypeError(
        `pedirTexto: 'senal' debe ser un AbortSignal (o null); recibido ${typeof senal}.`,
      )
    }

    // El reloj de `ms` arranca AQUÍ, antes de la cola: mide lo que esperó el
    // llamante, que incluye la espera de plaza. El reloj del TIMEOUT arranca más
    // tarde, al salir de la cola (trampa 2 de la cabecera). Son dos relojes
    // distintos porque miden dos cosas distintas.
    const inicio = ahora()

    if (destruido || abortada(senal)) {
      return crearResultado({
        ok: false,
        motivo: MOTIVO_RED.CANCELADA,
        mensaje: MENSAJES.CANCELADA,
        intentos: 0,
        ms: Math.max(0, ahora() - inicio),
        url,
      })
    }

    const conPlaza = await pedirPlaza(senal)
    if (!conPlaza) {
      return crearResultado({
        ok: false,
        motivo: MOTIVO_RED.CANCELADA,
        mensaje: MENSAJES.CANCELADA,
        intentos: 0,
        ms: Math.max(0, ahora() - inicio),
        url,
      })
    }

    try {
      return await ejecutar(url, senal, inicio)
    } finally {
      liberarPlaza()
    }
  }

  /**
   * Fotografía de los contadores. Objeto nuevo en cada llamada: quien lo guarde
   * conserva la foto, no una referencia que cambia sola.
   *
   * @returns {EstadoTransporte}
   */
  function estado() {
    return { ...cuenta, enCola: cola.length, enVuelo }
  }

  /**
   * Deja el transporte inerte: aborta lo que esté en vuelo, vacía la cola (esas
   * operaciones devuelven `CANCELADA` sin haber emitido nada) y hace que las
   * llamadas posteriores devuelvan `CANCELADA` inmediatamente.
   *
   * Que una llamada posterior devuelva un resultado en vez de lanzar es
   * deliberado: «pedir sobre un transporte ya destruido» no es un bug del
   * programador, es la carrera normal entre una pantalla que se cierra y un
   * manejador que ya estaba en marcha. Lanzar ahí obligaría a envolver cada
   * llamada en un `try`.
   *
   * Idempotente. Los contadores acumulados NO se borran.
   */
  function destruir() {
    destruido = true
    // Primero la señal de vida (corta las esperas de backoff en curso), luego
    // las peticiones vivas, y por último la cola. En este orden porque abortar
    // una petición hace avanzar su operación, y conviene que para entonces la
    // señal de vida ya diga la verdad.
    controlVida.abort()
    for (const controlador of controladoresVivos) controlador.abort()
    controladoresVivos.clear()
    for (const entrada of cola.splice(0)) entrada.cancelar()
  }

  return { pedirTexto, estado, destruir }
}

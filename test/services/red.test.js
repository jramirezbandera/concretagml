/* -------------------------------------------------------------------------- *
 * test/services/red.test.js — F05 · T1A · El transporte de red                  *
 *                                                                               *
 * `services/_red.js` es el PRIMER código asíncrono del proyecto, así que esta    *
 * suite es también el primer sitio donde había que decidir cómo se prueba el     *
 * tiempo. La decisión está tomada y es la del repo: **no se falsea el tiempo,    *
 * se inyecta la espera** — cero `vi.useFakeTimers`, igual que en los otros 47    *
 * ficheros. El doble de `dormir` (`_doble-fetch.js`) apunta los milisegundos y   *
 * resuelve al instante, y con eso se puede afirmar la SECUENCIA de esperas, que  *
 * es lo que de verdad importa de un backoff, sin gastar ni un milisegundo.       *
 *                                                                               *
 * ── LO QUE AQUÍ NO SE ESCRIBE A MANO ────────────────────────────────────────  *
 * Ni la secuencia del backoff (se DERIVA de `BACKOFF` con la misma fórmula que   *
 * documenta la constante), ni el número de intentos (`BACKOFF.intentos`), ni el  *
 * juego de claves del resultado (se deriva del caso de éxito y se compara con    *
 * los demás), ni el máximo de concurrencia (`MAX_CONCURRENCIA`). Un test que     *
 * repite a mano el número que quiere vigilar no vigila nada: lo copia.           *
 *                                                                               *
 * ── PRUEBAS NEGATIVAS (que el instrumento detecta lo que dice detectar) ─────   *
 * Dos criterios de esta tarea se apoyan enteramente en el arnés, así que el      *
 * arnés se prueba a sí mismo antes de que se le crea nada:                       *
 *   · «máximo de vuelos concurrentes === MAX_CONCURRENCIA» → se mide TAMBIÉN un  *
 *     «transporte sin cola» (llamar al `fetch` diez veces a pelo) y se comprueba *
 *     que el instrumento reporta 10. Si no lo hiciera, la igualdad del criterio  *
 *     2 sería verdad por casualidad.                                             *
 *   · «tantas cancelaciones como temporizadores» → se comprueba que una espera   *
 *     que nadie cancela SALE como no cancelada. Si no, el contador diría         *
 *     siempre que sí.                                                            *
 *                                                                               *
 * ── COMPROBADO POR MUTACIÓN (a mano, durante el desarrollo) ─────────────────   *
 * Como hace el resto del repo con los guardianes que no se pueden auto-romper.   *
 * Se mutó `services/_red.js`, se corrió la suite y se revirtió:                  *
 *   (a) anulando el `finally { reloj.cancelar() }` de `emitir` → **3 rojos**;    *
 *       el criterio 3 dice «expected 2 to be 5» (creó cinco esperas y solo       *
 *       canceló dos: los tres relojes quedaban huérfanos).                       *
 *   (b) devolviendo siempre `Promise.resolve(true)` en `pedirPlaza`, o sea sin   *
 *       cola → **5 rojos**; el criterio 2 dice «expected 10 to be 2».            *
 *   (c) reintentando también las respuestas 2xx → **9 rojos**; el criterio 4     *
 *       dice «expected 3 to be 1».                                               *
 * Queda constancia porque un test que nunca se ha visto fallar no es una         *
 * garantía, es una esperanza.                                                    *
 *                                                                               *
 * Proyecto Vitest `node`: lógica pura. Se inyecta el `fetch`, así que **ningún   *
 * test de este fichero toca la red** ni necesita jsdom ni globals de navegador.  *
 * -------------------------------------------------------------------------- */

import { describe, it, expect } from 'vitest'

import {
  crearTransporte,
  dormirConTemporizador,
  BACKOFF,
  MAX_CONCURRENCIA,
  MOTIVO_RED,
  MS_TIMEOUT,
} from '../../services/_red.js'
import { NIVEL } from '../../viewer/_comun.js'
import {
  cederCiclos,
  crearDobleDormir,
  crearDobleFetch,
  errorDeRed,
} from './_doble-fetch.js'

const URL_DEMO = 'https://ejemplo.invalid/wfsCP.aspx?request=getfeature&refcat=1234'

// Un `ExceptionReport` del Catastro, que es el caso que da sentido a la frontera
// de este módulo: llega con **HTTP 200** y un cuerpo que dice que no hay nada.
const EXCEPTION_REPORT =
  '<?xml version="1.0" encoding="ISO-8859-1"?>' +
  '<ows:ExceptionReport><ows:Exception exceptionCode="InvalidParameterValue">' +
  '<ows:ExceptionText>No existe la referencia catastral</ows:ExceptionText>' +
  '</ows:Exception></ows:ExceptionReport>'

/**
 * Monta transporte + dobles de una vez. `alAvisar` es un espía por defecto: así
 * ningún test escribe en la consola por el avisador por defecto del proyecto, y
 * el que quiera comprobar el aviso solo tiene que mirar `avisos`.
 */
function montar({ plan, aleatorio = () => 0.5, venceElReloj = false, ahora = undefined } = {}) {
  const red = crearDobleFetch({ plan })
  const esperas = crearDobleDormir({ venceElReloj })
  const avisos = []
  const transporte = crearTransporte({
    fetch: red.fetch,
    dormir: esperas.dormir,
    aleatorio,
    ...(ahora ? { ahora } : {}),
    alAvisar: (mensaje, detalle) => avisos.push({ mensaje, detalle }),
  })
  return { transporte, red, esperas, avisos }
}

/**
 * La secuencia de esperas que DEBE producir el backoff, derivada de la constante
 * con la fórmula que la propia constante documenta. `BACKOFF.intentos` cuenta el
 * primer envío, así que hay una espera menos que intentos.
 *
 * @param {number} aleatorio  Valor fijo de la fuente de jitter.
 * @returns {number[]}
 */
function esperasDerivadas(aleatorio) {
  const secuencia = []
  for (let n = 1; n < BACKOFF.intentos; n += 1) {
    secuencia.push(aleatorio * Math.min(BACKOFF.maxMs, BACKOFF.baseMs * BACKOFF.factor ** (n - 1)))
  }
  return secuencia
}

// ── Contrato del módulo ───────────────────────────────────────────────────────

describe('services/_red · contrato del módulo', () => {
  it('crearTransporte devuelve exactamente pedirTexto, estado y destruir', () => {
    const { transporte } = montar()
    expect(Object.keys(transporte).sort()).toEqual(['destruir', 'estado', 'pedirTexto'])
    expect(typeof transporte.pedirTexto).toBe('function')
  })

  it('MOTIVO_RED está congelado y solo tiene lo que este módulo puede MEDIR', () => {
    // Cuatro motivos, ni uno más: no hay NO_ENCONTRADO (llega con HTTP 200
    // dentro del cuerpo) ni CORS (indistinguible de estar sin red).
    expect(Object.keys(MOTIVO_RED).sort()).toEqual([
      'CANCELADA',
      'ESTADO_HTTP',
      'SIN_RED',
      'TIEMPO_AGOTADO',
    ])
    expect(Object.isFrozen(MOTIVO_RED)).toBe(true)
    // Clave === valor: un motivo que viaja serializado sigue siendo el mismo.
    for (const [clave, valor] of Object.entries(MOTIVO_RED)) expect(valor).toBe(clave)
  })

  it('BACKOFF está congelado y describe una progresión creciente y acotada', () => {
    expect(Object.isFrozen(BACKOFF)).toBe(true)
    expect(BACKOFF.intentos).toBeGreaterThanOrEqual(2)
    expect(BACKOFF.factor).toBeGreaterThan(1)
    expect(BACKOFF.baseMs).toBeGreaterThan(0)
    // El techo tiene que morder de verdad o el `Math.min` sería decorativo… o no
    // morder nunca, y entonces sobraría. Se comprueba que está EN el rango que
    // los intentos recorren.
    const ultimoTecho = BACKOFF.baseMs * BACKOFF.factor ** (BACKOFF.intentos - 1)
    expect(BACKOFF.maxMs).toBeGreaterThanOrEqual(BACKOFF.baseMs)
    expect(ultimoTecho).toBeGreaterThan(0)
  })

  it('las constantes de disciplina valen lo que su documentación dice', () => {
    // Estos dos números SON la decisión (no un detalle de implementación):
    // cambiarlos es cambiar la política anti-bloqueo, y debe costar tocar un
    // test que lo diga con todas las letras.
    expect(MAX_CONCURRENCIA).toBe(2)
    expect(MS_TIMEOUT).toBe(15000)
    // El margen se mide contra LO PEOR MEDIDO, no contra lo típico, y esa
    // distinción no es cosmética: el WFS contesta en 0,099–0,451 s, pero
    // `Consulta_RCCOOR` del OVC llegó a 2,903 s (abre sesión ASP.NET nueva en
    // cada llamada). Los dos servicios atraviesan ESTE transporte, así que un
    // plazo dimensionado sobre la latencia del WFS —que es la que se mide
    // primero, por ser el servicio principal— cortaría llamadas buenas de
    // geocodificación. Cifras y fecha en `test/fixtures/catastro/PROCEDENCIA.md`.
    const MS_PEOR_MEDIDO = 2903
    expect(MS_TIMEOUT / MS_PEOR_MEDIDO).toBeGreaterThan(3)
    // Y el techo: un plazo de minutos no es prudencia, es una rueda girando y
    // una plaza de MAX_CONCURRENCIA retenida para nada.
    expect(MS_TIMEOUT).toBeLessThan(60_000)
  })

  it('lanza TypeError si una inyección no es función (contrato del programador)', () => {
    expect(() => crearTransporte({ fetch: 'no' })).toThrow(TypeError)
    expect(() => crearTransporte({ fetch: () => {}, ahora: 1 })).toThrow(/'ahora'/)
    expect(() => crearTransporte({ fetch: () => {}, aleatorio: null })).toThrow(/'aleatorio'/)
    expect(() => crearTransporte({ fetch: () => {}, dormir: {} })).toThrow(/'dormir'/)
    expect(() => crearTransporte(null)).toThrow(/'opciones'/)
    // El mensaje del `fetch` ausente explica QUÉ HACER, no solo qué pasó: es el
    // error que verá quien monte esto en un entorno sin `fetch` global.
    expect(() => crearTransporte({ fetch: null })).toThrow(/inyéctalo/)
  })

  it('lanza TypeError si la url o la señal no cumplen la forma', async () => {
    const { transporte } = montar()
    await expect(transporte.pedirTexto('')).rejects.toThrow(/'url'/)
    await expect(transporte.pedirTexto(null)).rejects.toThrow(TypeError)
    await expect(transporte.pedirTexto('  ')).rejects.toThrow(/'url'/)
    await expect(transporte.pedirTexto(URL_DEMO, { senal: {} })).rejects.toThrow(/'senal'/)
    await expect(transporte.pedirTexto(URL_DEMO, null)).rejects.toThrow(/'opciones'/)
  })
})

// ── La frontera: HTTP y nada más ──────────────────────────────────────────────

describe('services/_red · la frontera (esto NO sabe qué es el Catastro)', () => {
  it('un 200 se pide UNA vez y devuelve el cuerpo (criterio 4)', async () => {
    const { transporte, red } = montar({
      plan: { estado: 200, texto: '<gml/>', tipoContenido: 'text/xml; charset=utf-8' },
    })
    const r = await transporte.pedirTexto(URL_DEMO)

    expect(r.ok).toBe(true)
    expect(r.estado).toBe(200)
    expect(r.texto).toBe('<gml/>')
    expect(r.tipoContenido).toBe('text/xml; charset=utf-8')
    expect(r.motivo).toBeNull()
    expect(r.mensaje).toBeNull()
    expect(r.intentos).toBe(1)
    expect(r.url).toBe(URL_DEMO)
    expect(typeof r.ms).toBe('number')
    // EXACTAMENTE una petición emitida: un 2xx no se reintenta jamás.
    expect(red.total).toBe(1)
  })

  it('un ExceptionReport del Catastro (HTTP 200) es un ÉXITO y NO se reintenta', async () => {
    const { transporte, red, avisos } = montar({
      plan: { estado: 200, texto: EXCEPTION_REPORT, tipoContenido: 'text/xml' },
    })
    const r = await transporte.pedirTexto(URL_DEMO)

    // Para el transporte esto es un éxito: hubo respuesta 2xx y hay cuerpo. Que
    // el cuerpo diga «no existe esa referencia» es asunto de otro módulo.
    expect(r.ok).toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.texto).toContain('ExceptionReport')
    expect(red.total).toBe(1) // ← el corazón de la tarea: cero reintentos
    expect(avisos).toEqual([]) // ← y ni un aviso: no ha fallado nada
  })

  it('decodifica siempre UTF-8 aunque el prólogo XML declare ISO-8859-1', async () => {
    // El WFS del Catastro declara `encoding="ISO-8859-1"` y sus bytes son UTF-8
    // (medido). `response.text()` decodifica UTF-8 por especificación, que es
    // justo por lo que este módulo no toca `TextDecoder` ni `'latin1'`.
    const conAcentos = '<?xml version="1.0" encoding="ISO-8859-1"?><a>PEÑÍSCOLA · 3 m²</a>'
    const { transporte } = montar({ plan: { estado: 200, texto: conAcentos } })
    const r = await transporte.pedirTexto(URL_DEMO)
    expect(r.texto).toBe(conAcentos)
    expect(r.texto).toContain('PEÑÍSCOLA · 3 m²')
  })

  it('no manda NI UNA cabecera al fetch (User-Agent incluido)', async () => {
    const { transporte, red } = montar()
    await transporte.pedirTexto(URL_DEMO)

    const opciones = red.llamadas[0].opciones
    // La única opción es la señal del AbortController: ni `headers`, ni `mode`,
    // ni `credentials`. `User-Agent` es *forbidden header name* y el Catastro
    // penaliza su rotación (criterio de aceptación 5 de F05).
    expect(Object.keys(opciones)).toEqual(['signal'])
    expect(JSON.stringify(Object.keys(opciones))).not.toMatch(/user-?agent/i)
    expect(red.llamadas[0].url).toBe(URL_DEMO)
  })

  it('un 4xx NO se reintenta y da ESTADO_HTTP con el número exacto', async () => {
    const { transporte, red } = montar({ plan: { estado: 404, texto: 'no' } })
    const r = await transporte.pedirTexto(URL_DEMO)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_RED.ESTADO_HTTP)
    expect(r.estado).toBe(404)
    expect(r.mensaje).toContain('404')
    expect(r.intentos).toBe(1)
    expect(red.total).toBe(1)
  })

  it('el cuerpo solo se lee en 2xx: texto !== null ⟺ ok', async () => {
    const conCuerpo = montar({ plan: { estado: 503, texto: 'error del servidor' } })
    const r = await conCuerpo.transporte.pedirTexto(URL_DEMO)
    expect(r.ok).toBe(false)
    expect(r.texto).toBeNull()

    const bien = montar({ plan: { estado: 204 } }) // 2xx sin cuerpo
    const r2 = await bien.transporte.pedirTexto(URL_DEMO)
    expect(r2.ok).toBe(true)
    expect(r2.texto).toBe('') // cuerpo vacío, pero leído: no es `null`
  })
})

// ── Reintentos y backoff ──────────────────────────────────────────────────────

describe('services/_red · reintentos (solo rechazo de red o 5xx)', () => {
  it('un fetch que RECHAZA se llama exactamente BACKOFF.intentos veces (criterio 4)', async () => {
    const { transporte, red } = montar({ plan: { error: errorDeRed() } })
    const r = await transporte.pedirTexto(URL_DEMO)

    expect(red.total).toBe(BACKOFF.intentos)
    expect(r.intentos).toBe(BACKOFF.intentos)
    expect(r.motivo).toBe(MOTIVO_RED.SIN_RED)
    expect(r.estado).toBeNull()
  })

  it('el mensaje de SIN_RED nombra las CUATRO posibilidades', async () => {
    const { transporte } = montar({ plan: { error: errorDeRed() } })
    const r = await transporte.pedirTexto(URL_DEMO)
    // Agruparlas es honesto solo si el texto no finge saber cuál es.
    expect(r.mensaje).toMatch(/conexión/i)
    expect(r.mensaje).toMatch(/DNS/)
    expect(r.mensaje).toMatch(/TLS/)
    expect(r.mensaje).toMatch(/CORS/)
    expect(r.mensaje).toMatch(/no permite distinguir/i)
  })

  it('un 5xx se reintenta; un 5xx seguido de 200 sale bien y no cuenta como fallo', async () => {
    const { transporte, red, esperas } = montar({
      plan: (_url, intento) => (intento === 1 ? { estado: 503 } : { estado: 200, texto: 'ok' }),
    })
    const r = await transporte.pedirTexto(URL_DEMO)

    expect(red.total).toBe(2)
    expect(r.ok).toBe(true)
    expect(r.intentos).toBe(2)
    expect(transporte.estado().fallidas).toBe(0)
    expect(transporte.estado().reintentos).toBe(1)
    expect(esperas.msBackoff()).toHaveLength(1) // una sola espera: hubo un reintento
  })

  it('un 5xx persistente agota los intentos y devuelve ESTADO_HTTP', async () => {
    const { transporte, red } = montar({ plan: { estado: 503 } })
    const r = await transporte.pedirTexto(URL_DEMO)

    expect(red.total).toBe(BACKOFF.intentos)
    expect(r.motivo).toBe(MOTIVO_RED.ESTADO_HTTP)
    expect(r.estado).toBe(503)
    expect(r.intentos).toBe(BACKOFF.intentos)
  })

  it('la secuencia de esperas es la DERIVADA de BACKOFF, con jitter 0 (criterio 1)', async () => {
    const { transporte, esperas } = montar({ plan: { error: errorDeRed() }, aleatorio: () => 0 })
    await transporte.pedirTexto(URL_DEMO)
    expect(esperas.msBackoff()).toEqual(esperasDerivadas(0))
  })

  it('la secuencia de esperas es la DERIVADA de BACKOFF, con jitter 1 (criterio 1)', async () => {
    const { transporte, esperas } = montar({ plan: { error: errorDeRed() }, aleatorio: () => 1 })
    await transporte.pedirTexto(URL_DEMO)
    const derivadas = esperasDerivadas(1)
    expect(esperas.msBackoff()).toEqual(derivadas)
    // Y la progresión es creciente de verdad (con jitter 1 el techo es el valor):
    // si alguien «simplificara» el backoff a una espera fija, esto lo vería.
    expect(derivadas[derivadas.length - 1]).toBeGreaterThan(derivadas[0])
  })

  it('el jitter es multiplicativo sobre el techo, no un ruido sumado', async () => {
    // Con `aleatorio = 0.25`, cada espera debe ser exactamente un cuarto de su
    // techo. Es lo que distingue el jitter COMPLETO (el que desincroniza de
    // verdad varias pestañas) de un «techo ± algo».
    const { transporte, esperas } = montar({ plan: { error: errorDeRed() }, aleatorio: () => 0.25 })
    await transporte.pedirTexto(URL_DEMO)
    expect(esperas.msBackoff()).toEqual(esperasDerivadas(0.25))
  })

  it('abre UN reloj de timeout por intento y ninguno más', async () => {
    const { transporte, esperas } = montar({ plan: { error: errorDeRed() } })
    await transporte.pedirTexto(URL_DEMO)
    expect(esperas.msReloj()).toEqual(Array.from({ length: BACKOFF.intentos }, () => MS_TIMEOUT))
  })
})

// ── Concurrencia (criterio 2) ─────────────────────────────────────────────────

describe('services/_red · cola de concurrencia', () => {
  const diezUrls = Array.from({ length: 10 }, (_, i) => `${URL_DEMO}&n=${i}`)

  it('con 10 peticiones simultáneas el pico de vuelos es EXACTAMENTE MAX_CONCURRENCIA', async () => {
    const { transporte, red } = montar({ plan: { retenida: true, estado: 200, texto: 'ok' } })

    const promesas = diezUrls.map((u) => transporte.pedirTexto(u))
    await cederCiclos()

    // Antes de soltar nada: solo hay MAX_CONCURRENCIA en vuelo y el resto espera.
    expect(red.total).toBe(MAX_CONCURRENCIA)
    expect(transporte.estado().enVuelo).toBe(MAX_CONCURRENCIA)
    expect(transporte.estado().enCola).toBe(diezUrls.length - MAX_CONCURRENCIA)

    for (let i = 0; i < diezUrls.length; i += 1) {
      red.soltar()
      await cederCiclos()
    }
    const resultados = await Promise.all(promesas)

    expect(resultados.every((r) => r.ok)).toBe(true)
    expect(red.total).toBe(diezUrls.length)
    // IGUALDAD, no `≤`: un `≤` daría por bueno un transporte que serializa todo
    // de uno en uno, que es tan incorrecto como uno sin cola.
    expect(red.maxSimultaneas).toBe(MAX_CONCURRENCIA)
    // Y al terminar no queda nadie ocupando plaza ni esperando.
    expect(transporte.estado().enVuelo).toBe(0)
    expect(transporte.estado().enCola).toBe(0)
  })

  it('PRUEBA NEGATIVA: el instrumento detecta un «transporte» SIN cola', async () => {
    // Diez llamadas al `fetch` a pelo (que es exactamente lo que haría un
    // transporte sin cola). Si el medidor no viera la diferencia, la igualdad
    // del test anterior no significaría nada.
    const red = crearDobleFetch({ plan: { retenida: true, estado: 200, texto: 'ok' } })
    const vuelos = diezUrls.map((u) => red.fetch(u))
    await cederCiclos()

    expect(red.maxSimultaneas).toBe(diezUrls.length)
    expect(red.maxSimultaneas).not.toBe(MAX_CONCURRENCIA)

    red.soltar()
    await Promise.all(vuelos)
    expect(red.enVuelo).toBe(0)
  })

  it('una operación que espera su backoff SIGUE ocupando plaza', async () => {
    // Si la soltara, entraría otra operación y el pico real de peticiones
    // simultáneas podría superar el máximo justo cuando el servicio va mal.
    const { transporte, red } = montar({
      plan: (_url, intento) =>
        intento === 1 ? { estado: 503 } : { retenida: true, estado: 200, texto: 'ok' },
    })
    const promesas = [0, 1, 2].map((i) => transporte.pedirTexto(`${URL_DEMO}&q=${i}`))
    await cederCiclos()

    expect(transporte.estado().enVuelo).toBe(MAX_CONCURRENCIA)
    expect(red.maxSimultaneas).toBe(MAX_CONCURRENCIA)

    for (let i = 0; i < 4; i += 1) {
      red.soltar()
      await cederCiclos()
    }
    await Promise.all(promesas)
    expect(red.maxSimultaneas).toBe(MAX_CONCURRENCIA)
  })
})

// ── Temporizadores huérfanos (criterio 3) ─────────────────────────────────────

describe('services/_red · ni un temporizador huérfano', () => {
  it('tras un éxito hay tantas cancelaciones como esperas creadas', async () => {
    const { transporte, esperas } = montar()
    await transporte.pedirTexto(URL_DEMO)
    expect(esperas.creadas).toBe(1) // el reloj del único intento
    expect(esperas.canceladas).toBe(esperas.creadas)
  })

  it('tras agotar los reintentos, también (relojes + esperas de backoff)', async () => {
    const { transporte, esperas } = montar({ plan: { error: errorDeRed() } })
    await transporte.pedirTexto(URL_DEMO)
    // Derivado: un reloj por intento y una espera entre intentos consecutivos.
    expect(esperas.creadas).toBe(BACKOFF.intentos + (BACKOFF.intentos - 1))
    expect(esperas.canceladas).toBe(esperas.creadas)
  })

  it('tras N peticiones de todo tipo, canceladas === creadas', async () => {
    const { transporte, esperas } = montar({
      plan: (url) => {
        if (url.endsWith('bien')) return { estado: 200, texto: 'ok' }
        if (url.endsWith('cuatro')) return { estado: 404 }
        if (url.endsWith('cinco')) return { estado: 500 }
        return { error: errorDeRed() }
      },
    })
    await Promise.all(
      ['bien', 'cuatro', 'cinco', 'roto'].map((s) => transporte.pedirTexto(`${URL_DEMO}&s=${s}`)),
    )
    expect(esperas.creadas).toBeGreaterThan(0)
    expect(esperas.canceladas).toBe(esperas.creadas)
  })

  it('destruir() corta también la espera de backoff en curso', async () => {
    // Es la puerta de atrás del temporizador huérfano: la petición ya no está en
    // vuelo, pero su espera sí, y con `setTimeout` de verdad serían hasta 4 s de
    // temporizador vivo sobre un transporte que ya no existe.
    const esperasVivas = []
    const red = crearDobleFetch({ plan: { error: errorDeRed() } })
    const transporte = crearTransporte({
      fetch: red.fetch,
      alAvisar: () => {},
      // `dormir` que NUNCA resuelve por sí solo: solo la señal puede terminarlo.
      dormir: (ms, senal) =>
        new Promise((resolver) => {
          esperasVivas.push({ ms, senal })
          if (senal.aborted) resolver()
          else senal.addEventListener('abort', () => resolver(), { once: true })
        }),
    })
    const enCurso = transporte.pedirTexto(URL_DEMO)
    await cederCiclos()

    transporte.destruir()
    const r = await enCurso
    expect(r.motivo).toBe(MOTIVO_RED.CANCELADA)
    expect(esperasVivas.every((e) => e.senal.aborted)).toBe(true)
  })

  it('PRUEBA NEGATIVA: el contador de esperas distingue cancelar de no cancelar', async () => {
    const esperas = crearDobleDormir()
    const control = new AbortController()
    await esperas.dormir(BACKOFF.baseMs, control.signal)

    expect(esperas.creadas).toBe(1)
    expect(esperas.canceladas).toBe(0) // nadie la ha cancelado todavía
    control.abort()
    expect(esperas.canceladas).toBe(1)
  })
})

// ── Timeout (criterio 5) ──────────────────────────────────────────────────────

describe('services/_red · plazo agotado', () => {
  it('un fetch que nunca resuelve da TIEMPO_AGOTADO, sin gastar tiempo real', async () => {
    const arranque = Date.now()
    const { transporte, red } = montar({ plan: { pendiente: true }, venceElReloj: true })
    const r = await transporte.pedirTexto(URL_DEMO)

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_RED.TIEMPO_AGOTADO)
    expect(r.estado).toBeNull()
    expect(r.texto).toBeNull()
    expect(r.mensaje).toContain(`${MS_TIMEOUT / 1000} segundos`)
    // El test no espera de verdad los 15 s: la espera está inyectada.
    expect(Date.now() - arranque).toBeLessThan(MS_TIMEOUT / 10)
    expect(red.total).toBe(1)
  })

  it('el plazo agotado ABANDONA la petición (no la deja descargando para nadie)', async () => {
    const { transporte, red } = montar({ plan: { pendiente: true }, venceElReloj: true })
    await transporte.pedirTexto(URL_DEMO)
    expect(red.abortadas).toBe(1)
  })

  it('el plazo agotado NO se reintenta', async () => {
    // Decisión razonada en el módulo: ya se ha esperado un orden de magnitud
    // largo por encima de lo peor medido (2,9 s en el OVC, 0,45 s en el WFS);
    // dos peticiones más sobre un servicio saturado son la oleada que
    // el Catastro penaliza, y triplicarían la espera del usuario para acabar
    // diciéndole lo mismo.
    const { transporte, red } = montar({ plan: { pendiente: true }, venceElReloj: true })
    const r = await transporte.pedirTexto(URL_DEMO)
    expect(red.total).toBe(1)
    expect(r.intentos).toBe(1)
    expect(transporte.estado().reintentos).toBe(0)
  })

  it('el reloj arranca al SALIR de la cola, no al entrar', async () => {
    // Trampa 2: si el plazo contase desde el encolado, una petición que espera
    // detrás de otras «vencería» sin haberse enviado nunca, y el usuario vería
    // un «tiempo agotado» de una petición que no existió. Aquí las dos primeras
    // se quedan pendientes y la tercera espera en cola: mientras espera NO se le
    // abre ningún reloj, y por tanto no puede vencer.
    const { transporte, red, esperas } = montar({
      plan: { retenida: true, estado: 200, texto: 'ok' },
    })
    const promesas = [0, 1, 2].map((i) => transporte.pedirTexto(`${URL_DEMO}&c=${i}`))
    await cederCiclos()

    expect(transporte.estado().enCola).toBe(1)
    // Un reloj por petición EMITIDA (2), no por operación PEDIDA (3).
    expect(esperas.msReloj()).toHaveLength(MAX_CONCURRENCIA)

    // Al soltar las dos primeras, la tercera sale de la cola: es AHÍ, y no
    // antes, donde aparece su reloj.
    red.soltar()
    await cederCiclos()
    expect(esperas.msReloj()).toHaveLength(MAX_CONCURRENCIA + 1)

    red.soltar()
    const resultados = await Promise.all(promesas)
    expect(resultados.every((r) => r.ok)).toBe(true)
  })
})

// ── Cancelación (criterio 6) ──────────────────────────────────────────────────

describe('services/_red · cancelación', () => {
  it('una señal ya abortada devuelve CANCELADA sin emitir NADA', async () => {
    const { transporte, red, avisos } = montar()
    const control = new AbortController()
    control.abort()

    const r = await transporte.pedirTexto(URL_DEMO, { senal: control.signal })
    expect(r.motivo).toBe(MOTIVO_RED.CANCELADA)
    expect(r.intentos).toBe(0)
    expect(red.total).toBe(0)
    // Cancelar no es fallar: ni cuenta como fallo ni molesta al usuario con un
    // aviso de algo que ha pedido él.
    expect(transporte.estado().fallidas).toBe(0)
    expect(avisos).toEqual([])
  })

  it('abortar EN VUELO da CANCELADA y no cuenta como fallo', async () => {
    const { transporte, red, avisos } = montar({ plan: { retenida: true, estado: 200 } })
    const control = new AbortController()
    const enCurso = transporte.pedirTexto(URL_DEMO, { senal: control.signal })
    await cederCiclos()
    expect(red.total).toBe(1)

    control.abort()
    const r = await enCurso

    expect(r.motivo).toBe(MOTIVO_RED.CANCELADA)
    expect(r.intentos).toBe(1) // sí se llegó a emitir
    expect(transporte.estado().fallidas).toBe(0)
    expect(transporte.estado().exitos).toBe(0)
    expect(avisos).toEqual([])
    expect(red.abortadas).toBe(1)
  })

  it('abortar EN COLA cuesta CERO peticiones al servicio', async () => {
    const { transporte, red } = montar({ plan: { retenida: true, estado: 200, texto: 'ok' } })
    const control = new AbortController()

    const enVuelo = [0, 1].map((i) => transporte.pedirTexto(`${URL_DEMO}&v=${i}`))
    const enCola = [2, 3].map((i) =>
      transporte.pedirTexto(`${URL_DEMO}&v=${i}`, { senal: control.signal }),
    )
    await cederCiclos()
    expect(red.total).toBe(MAX_CONCURRENCIA)
    expect(transporte.estado().enCola).toBe(2)

    control.abort()
    const cancelados = await Promise.all(enCola)
    expect(cancelados.every((r) => r.motivo === MOTIVO_RED.CANCELADA)).toBe(true)
    expect(cancelados.every((r) => r.intentos === 0)).toBe(true)
    // Lo importante: el Catastro no ha visto ni una petición de más.
    expect(red.total).toBe(MAX_CONCURRENCIA)
    expect(transporte.estado().enCola).toBe(0)

    red.soltar()
    await Promise.all(enVuelo)
  })

  it('cancelar durante la espera del backoff la corta en el acto', async () => {
    const esperasVivas = []
    const red = crearDobleFetch({ plan: { error: errorDeRed() } })
    const transporte = crearTransporte({
      fetch: red.fetch,
      alAvisar: () => {},
      dormir: (ms, senal) =>
        new Promise((resolver) => {
          esperasVivas.push({ ms, senal })
          if (senal.aborted) resolver()
          else senal.addEventListener('abort', () => resolver(), { once: true })
        }),
    })
    const control = new AbortController()
    const enCurso = transporte.pedirTexto(URL_DEMO, { senal: control.signal })
    await cederCiclos()

    // Se estaba esperando el backoff (una espera más corta que el plazo).
    expect(esperasVivas.some((e) => e.ms < MS_TIMEOUT)).toBe(true)

    control.abort()
    const r = await enCurso
    expect(r.motivo).toBe(MOTIVO_RED.CANCELADA)
    // No siguió reintentando después de que el usuario dijera que no.
    expect(red.total).toBeLessThan(BACKOFF.intentos)
  })
})

// ── destruir() ────────────────────────────────────────────────────────────────

describe('services/_red · destruir', () => {
  it('aborta lo vivo, vacía la cola y deja el transporte inerte', async () => {
    const { transporte, red } = montar({ plan: { retenida: true, estado: 200, texto: 'ok' } })
    const promesas = [0, 1, 2, 3].map((i) => transporte.pedirTexto(`${URL_DEMO}&d=${i}`))
    await cederCiclos()
    expect(red.total).toBe(MAX_CONCURRENCIA)

    transporte.destruir()
    const resultados = await Promise.all(promesas)

    expect(resultados.every((r) => r.motivo === MOTIVO_RED.CANCELADA)).toBe(true)
    expect(red.total).toBe(MAX_CONCURRENCIA) // no se emitió ninguna más
    expect(transporte.estado().enCola).toBe(0)
    expect(transporte.estado().enVuelo).toBe(0)
    expect(transporte.estado().fallidas).toBe(0)
  })

  it('una petición posterior devuelve CANCELADA en vez de lanzar', async () => {
    const { transporte, red } = montar()
    transporte.destruir()
    const r = await transporte.pedirTexto(URL_DEMO)
    expect(r.motivo).toBe(MOTIVO_RED.CANCELADA)
    expect(r.intentos).toBe(0)
    expect(red.total).toBe(0)
  })

  it('es idempotente y NO borra los contadores acumulados', async () => {
    const { transporte } = montar()
    await transporte.pedirTexto(URL_DEMO)
    const antes = transporte.estado()

    transporte.destruir()
    transporte.destruir()

    const despues = transporte.estado()
    // Un contador que se borra al destruir es un contador que miente sobre lo
    // que pasó.
    expect(despues.peticiones).toBe(antes.peticiones)
    expect(despues.exitos).toBe(antes.exitos)
  })
})

// ── Forma del resultado (criterio 7) ──────────────────────────────────────────

describe('services/_red · el resultado tiene SIEMPRE las mismas claves', () => {
  it('las nueve claves están en todos los caminos, salga bien o mal', async () => {
    /** @returns {Promise<import('../../services/_red.js').ResultadoHttp>} */
    async function resultadoDe(opciones, abortarAntes = false) {
      const { transporte } = montar(opciones)
      const control = new AbortController()
      if (abortarAntes) control.abort()
      return transporte.pedirTexto(URL_DEMO, { senal: control.signal })
    }

    const exito = await resultadoDe({ plan: { estado: 200, texto: 'ok' } })
    const casos = [
      exito,
      await resultadoDe({ plan: { estado: 404 } }),
      await resultadoDe({ plan: { estado: 503 } }),
      await resultadoDe({ plan: { error: errorDeRed() } }),
      await resultadoDe({ plan: { pendiente: true }, venceElReloj: true }),
      await resultadoDe({ plan: { estado: 200, texto: 'ok' } }, true),
    ]

    // El juego de claves se DERIVA del caso de éxito; no hay lista escrita.
    const clavesEsperadas = Object.keys(exito).sort()
    expect(clavesEsperadas).toHaveLength(9)
    for (const r of casos) {
      expect(Object.keys(r).sort()).toEqual(clavesEsperadas)
      expect(typeof r.ok).toBe('boolean')
      expect(typeof r.intentos).toBe('number')
      expect(typeof r.ms).toBe('number')
      expect(r.url).toBe(URL_DEMO)
      // Invariantes del contrato, comprobados en TODOS los caminos.
      expect(r.motivo === null).toBe(r.ok)
      expect(r.mensaje === null).toBe(r.ok)
      expect(r.texto !== null).toBe(r.ok)
      expect(r.intentos).toBeLessThanOrEqual(BACKOFF.intentos)
      // `estado` solo puede traer número si LLEGÓ a haber respuesta.
      if (!r.ok && r.motivo !== MOTIVO_RED.ESTADO_HTTP) expect(r.estado).toBeNull()
      if (r.motivo !== null) expect(Object.values(MOTIVO_RED)).toContain(r.motivo)
    }
  })

  it('`ms` sale del reloj inyectado y cubre también la espera en cola', async () => {
    let t = 1000
    const { transporte } = montar({
      plan: { estado: 200, texto: 'ok' },
      ahora: () => {
        t += 7
        return t
      },
    })
    const r = await transporte.pedirTexto(URL_DEMO)
    expect(r.ms).toBeGreaterThan(0)
    expect(r.ms % 7).toBe(0) // solo puede venir del reloj inyectado
  })
})

// ── Contadores (criterio 8) ───────────────────────────────────────────────────

describe('services/_red · estado() cuadra con lo que hizo el doble de fetch', () => {
  it('peticiones === llamadas al fetch, y reintentos === las que no eran la primera', async () => {
    const { transporte, red } = montar({
      plan: (url) => {
        if (url.endsWith('bien')) return { estado: 200, texto: 'ok' }
        if (url.endsWith('cuatro')) return { estado: 404 }
        return { estado: 500 } // agota intentos
      },
    })
    await Promise.all(
      ['bien', 'cuatro', 'cinco'].map((s) => transporte.pedirTexto(`${URL_DEMO}&s=${s}`)),
    )
    const e = transporte.estado()

    // La igualdad que ata el contador al mundo real.
    expect(e.peticiones).toBe(red.total)
    // Operaciones que llegaron a la red = peticiones - reintentos.
    expect(e.peticiones - e.reintentos).toBe(3)
    expect(e.exitos).toBe(1)
    expect(e.fallidas).toBe(2)
    expect(e.enCola).toBe(0)
    expect(e.enVuelo).toBe(0)
    // Y las llamadas del doble lo confirman por su lado: la que agota reintentos
    // aparece `BACKOFF.intentos` veces con la misma URL.
    const porUrl = red.urls().filter((u) => u.endsWith('cinco'))
    expect(porUrl).toHaveLength(BACKOFF.intentos)
  })

  it('estado() es una FOTOGRAFÍA, no una referencia viva', async () => {
    const { transporte } = montar()
    const foto = transporte.estado()
    await transporte.pedirTexto(URL_DEMO)
    expect(foto.peticiones).toBe(0)
    expect(transporte.estado().peticiones).toBe(1)
    expect(Object.keys(foto).sort()).toEqual([
      'enCola',
      'enVuelo',
      'exitos',
      'fallidas',
      'peticiones',
      'reintentos',
    ])
  })
})

// ── Regla de oro 1: ningún error silencioso ───────────────────────────────────

describe('services/_red · avisos (regla de oro 1)', () => {
  it('un fallo definitivo avisa una vez, en español y con NIVEL.AVISO', async () => {
    const { transporte, avisos } = montar({ plan: { error: errorDeRed() } })
    const r = await transporte.pedirTexto(URL_DEMO)

    expect(avisos).toHaveLength(1) // uno por operación, no uno por intento
    expect(avisos[0].mensaje).toBe(r.mensaje)
    // AVISO y no ERROR: que el Catastro no conteste no impide generar el GML —
    // la geometría del usuario está en el modelo (regla de clasificación de
    // viewer/_comun.js). Aquí se pierde una consulta, no un trabajo.
    expect(avisos[0].detalle.nivel).toBe(NIVEL.AVISO)
    expect(avisos[0].detalle.causa).toBeInstanceOf(TypeError)
  })

  it('un 4xx también avisa, con el número dentro del mensaje', async () => {
    const { transporte, avisos } = montar({ plan: { estado: 404 } })
    await transporte.pedirTexto(URL_DEMO)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toMatch(/404/)
    expect(avisos[0].detalle.nivel).toBe(NIVEL.AVISO)
  })

  it('un éxito no avisa de nada', async () => {
    const { transporte, avisos } = montar()
    await transporte.pedirTexto(URL_DEMO)
    expect(avisos).toEqual([])
  })

  it('un alAvisar que no es función es contrato roto: TypeError', () => {
    expect(() => crearTransporte({ fetch: () => {}, alAvisar: 'ruido' })).toThrow(TypeError)
  })
})

// ── Contrato roto por el programador dentro de un camino asíncrono ────────────

describe('services/_red · una inyección rota NO se disfraza de fallo de red', () => {
  it('un fetch que resuelve algo que no es Response rechaza con TypeError', async () => {
    const { transporte } = montar({ plan: { noEsRespuesta: { cuerpo: 'lo que sea' } } })
    await expect(transporte.pedirTexto(URL_DEMO)).rejects.toThrow(TypeError)
    await expect(transporte.pedirTexto(URL_DEMO)).rejects.toThrow(/status/)
  })

  it('un dormir que no devuelve promesa rechaza con TypeError', async () => {
    const red = crearDobleFetch()
    const transporte = crearTransporte({
      fetch: red.fetch,
      alAvisar: () => {},
      dormir: () => undefined,
    })
    await expect(transporte.pedirTexto(URL_DEMO)).rejects.toThrow(/'dormir'/)
  })
})

// ── La espera por defecto ─────────────────────────────────────────────────────

describe('services/_red · dormirConTemporizador (el `dormir` por defecto)', () => {
  it('crea UN setTimeout con los ms pedidos y resuelve al dispararse', async () => {
    // Se comprueba el `setTimeout` en vez de cronometrar: un test que mide
    // tiempo real es un test que algún día falla en una máquina cargada.
    const original = globalThis.setTimeout
    const ms = []
    globalThis.setTimeout = (fn, t) => {
      ms.push(t)
      return original(fn, t)
    }
    try {
      await expect(dormirConTemporizador(3)).resolves.toBeUndefined()
    } finally {
      globalThis.setTimeout = original
    }
    expect(ms).toEqual([3])
  })

  it('con la señal ya abortada resuelve sin crear temporizador', async () => {
    const control = new AbortController()
    control.abort()
    let creados = 0
    const original = globalThis.setTimeout
    globalThis.setTimeout = (...args) => {
      creados += 1
      return original(...args)
    }
    try {
      await dormirConTemporizador(60000, control.signal)
    } finally {
      globalThis.setTimeout = original
    }
    expect(creados).toBe(0)
  })

  it('abortar durante la espera hace clearTimeout y RESUELVE (no rechaza)', async () => {
    // La prueba de la trampa 1 en el `dormir` real: sin el `clearTimeout`, este
    // test dejaría vivo un temporizador de un minuto y el proceso de Vitest se
    // quedaría con un handle abierto.
    let limpiados = 0
    const original = globalThis.clearTimeout
    globalThis.clearTimeout = (id) => {
      limpiados += 1
      return original(id)
    }
    const control = new AbortController()
    try {
      const espera = dormirConTemporizador(60000, control.signal)
      control.abort()
      // Resuelve —no rechaza—: «deja de esperar» no es un error, y una promesa
      // rechazada sin manejador sería un `unhandledrejection`.
      await expect(espera).resolves.toBeUndefined()
    } finally {
      globalThis.clearTimeout = original
    }
    expect(limpiados).toBe(1)
  })

  it('suelta el manejador de la señal al terminar (una señal larga no acumula)', async () => {
    // Una señal de vida por pantalla puede recibir cientos de esperas; si cada
    // una dejara su manejador puesto, la fuga sería tan real como la del
    // temporizador.
    let vivos = 0
    const senal = {
      aborted: false,
      addEventListener: () => {
        vivos += 1
      },
      removeEventListener: () => {
        vivos -= 1
      },
    }
    await dormirConTemporizador(1, senal)
    expect(vivos).toBe(0)
  })
})

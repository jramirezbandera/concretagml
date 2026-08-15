/* -------------------------------------------------------------------------- *
 * test/storage/cache-catastro.test.js — F05 · T2B · la caché del Catastro      *
 *                                                                              *
 * La caché es el mayor factor anti-bloqueo del cliente, y a la vez el sitio     *
 * donde es más fácil fabricar un fallo silencioso: si sirve un texto            *
 * corrompido, si sirve un dato de hace un año creyéndolo fresco, o si convierte *
 * un almacenamiento lleno en una consulta fallida, nadie se entera hasta que    *
 * un colegiado firma un GML hecho con datos que no eran los que creía. Este     *
 * fichero existe para que ninguna de esas tres cosas pueda pasar.               *
 *                                                                              *
 * ── PROYECTO `node`, SIN SUFIJO `.dom`, Y ES DELIBERADO ──                     *
 * `vitest.config.js` enruta POR SUFIJO y `fake-indexeddb` es una implementación *
 * de IndexedDB en JavaScript puro: no necesita `window` ni jsdom. Va a `node`,  *
 * que además es el bucle rápido. Mismo criterio que `test/storage/bd.test.js`.  *
 *                                                                              *
 * ── LAS CINCO DECISIONES DE ESTE FICHERO ──                                    *
 *                                                                              *
 * 1. NADA ESCRITO A MANO DOS VECES. Las claves de caché NO se teclean aquí: se  *
 *    obtienen HACIENDO CONSULTAR AL CLIENTE REAL (`crearClienteCatastro` con    *
 *    una caché espía) y quedándose con la clave que compone. Así el prefijo y   *
 *    el redondeo al metro los pone `services/catastro.js`, que es su dueño, y   *
 *    el día que cambie allí este fichero se entera. Igual con los nombres de    *
 *    los almacenes (`ALMACENES`) y con el campo clave (`ESQUEMA_ALMACENES`).    *
 *                                                                              *
 * 2. EL PUERTO SE COMPRUEBA DERIVÁNDOLO DE `CACHE_NULA`, no listando `leer` y   *
 *    `guardar` a mano — y, sobre todo, PASÁNDOLE la caché a                     *
 *    `crearClienteCatastro`, que es quien hace el duck typing de verdad. Si el  *
 *    puerto y esta implementación divergen, salta aquí y no en el cableado.     *
 *                                                                              *
 * 3. UNA BASE POR PRUEBA. `new IDBFactory()` de `fake-indexeddb` da un universo *
 *    de bases aislado, y como `abrirBd` MEMOIZA la conexión en una variable de  *
 *    módulo, cada base sale de un módulo recién cargado (`vi.resetModules()` +  *
 *    `import()`), que es la versión honesta de «otro proceso».                  *
 *                                                                              *
 * 4. EL TIEMPO ENTRA POR PARÁMETRO. Cero `vi.useFakeTimers`: se mueve el reloj  *
 *    inyectado. Además de ser el precedente del repo, falsear el tiempo global  *
 *    rompería a `fake-indexeddb`, que lo usa para sus propias transacciones.    *
 *                                                                              *
 * 5. SE SIMULA LO QUE `fake-indexeddb` NO PUEDE. Esta implementación no tiene   *
 *    cuota que agotar (lo dice `test/storage/bd.test.js`), así que el           *
 *    `QuotaExceededError` se provoca envolviendo la base REAL con un `put` que  *
 *    rechaza y un `get` que sigue delegando. Es exactamente la situación del    *
 *    navegador lleno: se puede leer lo de antes, no se puede escribir lo nuevo. *
 *                                                                              *
 * ── MUTACIONES EJECUTADAS PARA COMPROBAR QUE ESTOS GUARDIANES NO SON VACUOS ── *
 * (Cada una se aplicó a `storage/cache-catastro.js`, se corrió `test:node`, se  *
 * anotó el rojo y se revirtió CON EL EDITOR — nunca con `git checkout`: hay     *
 * trabajo sin commitear en este árbol y ya se perdió una implementación así.)   *
 *                                                                              *
 * · M1 · `edad > MS_TTL` → `edad >= MS_TTL` (caducar un instante antes).        *
 *   ROJO 2: «EN el límite exacto del TTL todavía acierta» y «lo decide el       *
 *   `ahora` INYECTADO». Es lo que separa `>` de `>=`: sin esas dos, los dos     *
 *   operadores pasarían igual y la frontera no estaría fijada por nadie.        *
 * · M2 · `edad > MS_TTL` → `false` (no caducar jamás).                          *
 *   ROJO 4: «PASADO el TTL se comporta como ausente», «caducar NO borra»,       *
 *   «pasado el TTL vuelve a la red por su cuenta» y el recuento de `estado()`.  *
 * · M3 · en el `catch` de `guardar`, añadir `throw error` (relanzar).           *
 *   ROJO 3: las tres pruebas de la cuota agotada. **Hallazgo:** la prueba que   *
 *   pasa por el CLIENTE REAL siguió VERDE, y es información: `services/         *
 *   catastro.js#guardarEnCache` tiene su propio `try`, así que absorbe el       *
 *   rechazo. O sea que esta regla —«no se relanza»— SOLO es observable en la    *
 *   frontera de este módulo, y por eso hay pruebas suyas y no solo de           *
 *   integración. Una suite que solo mirase el cliente la habría dado por buena. *
 * · M4 · `{[campoClave]: clave, …}` → `{[campoClave]: clave.slice(-14)}` (o     *
 *   sea, guardar solo la referencia catastral, que es lo que el NOMBRE del      *
 *   campo sugiere y la cabecera del módulo explica que sería un error).         *
 *   ROJO 15: se cae media suite, empezando por la ida y vuelta del GML.         *
 * · M5 · `rutaDe` → devolver siempre el almacén de parcelas.                    *
 *   ROJO 2: «cada clave va a su almacén» (la de `revgeo` aparecía en el de      *
 *   parcelas) y «una clave con prefijo DESCONOCIDO lanza».                      *
 * · M6 · en `leer`, `return {valor, guardadoEn}` → `return {valor}`.            *
 *   ROJO 4: el puerto exige `guardadoEn` —sin él no hay «guardado hace 6        *
 *   días»— y el ciclo por el cliente real se queda sin `edadMs`.                *
 * · M7 · quitar la marca de la bandera `avisadoSinBase` (avisar cada vez).      *
 *   **VERDE: la mutación NO mató a nadie.** No era un agujero de la suite sino  *
 *   código muerto: solo se llega al aviso desde `obtenerBase`, que corre como   *
 *   mucho una vez porque la resolución de la base está MEMOIZADA. La bandera se *
 *   quitó del módulo —un guardián que ningún test puede hacer fallar tranquiliza*
 *   sin proteger (`services/catastro.js`, trampa 7)— y se sustituyó por M7'.    *
 * · M7' · `base()` → `return obtenerBase()` (sin memoizar), que es lo que de    *
 *   verdad sostiene el «una sola vez».                                          *
 *   ROJO 4: los cuatro casos de «sin almacén … y lo dice UNA sola vez».         *
 * · M8 · quitar el `avisar` del `catch` de `leer`.                              *
 *   ROJO 1: «una LECTURA que revienta se comporta como “no estaba” y avisa».    *
 * -------------------------------------------------------------------------- */

// Pone `globalThis.indexedDB` y las clases `IDB*` que `wrap` de `idb` necesita
// para decidir qué envuelve (`instanceof IDBRequest`/`IDBTransaction`). Sin
// ellas, `storage/bd.js` fallaría de una forma que no se parecería a la causa.
import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { describe, it, expect, vi } from 'vitest'

import {
  ALMACENES_DE_CACHE,
  ALMACEN_POR_PREFIJO,
  MOTIVO_PURGA,
  MS_TTL,
  PREFIJO,
  crearCacheCatastro,
} from '../../storage/cache-catastro.js'
import { ALMACENES, ESQUEMA_ALMACENES } from '../../storage/bd.js'
import { CACHE_NULA, ORIGEN, crearClienteCatastro } from '../../services/catastro.js'
import { MOTIVO_RED } from '../../services/_red.js'
import { NIVEL } from '../../viewer/_comun.js'

// ── La verdad externa, leída como UTF-8 ──────────────────────────────────────

const DIR_GML = fileURLToPath(new URL('../fixtures/gml/', import.meta.url))
const DIR_CATASTRO = fileURLToPath(new URL('../fixtures/catastro/', import.meta.url))

/**
 * El GML REAL de la parcela del Catastro. Se lee como **UTF-8 a propósito**
 * aunque su prólogo declare `ISO-8859-1`: el fichero se contradice a sí mismo
 * —sus bytes son UTF-8— y quien manda son los bytes (regla de oro 8). Leerlo como
 * latin-1 daría `Ã³` donde hay `ó`, y hay una prueba que lo comprueba para que
 * este comentario no sea una promesa.
 */
const GML_PARCELA = readFileSync(`${DIR_GML}cp_parcela_9398516VK3799G.gml`, 'utf8')
const OVC_OK = readFileSync(`${DIR_CATASTRO}ovc-rccoor-ok.json`, 'utf8')

/** La referencia catastral buena: la del propio GML, no una tecleada aquí. */
const RC_BUENA = /<cp:nationalCadastralReference>([^<]*)</.exec(GML_PARCELA)[1]

/** El punto de la geocodificación inversa: el que devuelve el fixture del OVC. */
const GEO = JSON.parse(OVC_OK).Consulta_RCCOORResult.coordenadas.coord[0].geo
const X_FIXTURE = Number(GEO.xcen)
const Y_FIXTURE = Number(GEO.ycen)
const SRS_FIXTURE = GEO.srs

/** Instante de referencia. Cualquier época sirve: lo que importa es moverlo. */
const T0 = 1_700_000_000_000

// ── Arnés: bases aisladas ────────────────────────────────────────────────────

/**
 * Una base recién creada, con sus almacenes, aislada de las demás pruebas. Sale
 * de la puerta de verdad (`abrirBd`), no de un `open` a mano: si la escalera de
 * migraciones dejara de crear un almacén, estas pruebas se enteran.
 *
 * `vi.resetModules()` porque `abrirBd` memoiza la conexión en una variable de
 * módulo y además lanza si se le llama luego con otra fábrica.
 *
 * @returns {Promise<import('../../storage/bd.js').ResultadoApertura>}
 */
async function baseNueva() {
  vi.resetModules()
  const { abrirBd } = await import('../../storage/bd.js')
  const apertura = await abrirBd({ indexedDB: new IDBFactory() })
  // El arnés no puede mentir en verde: si la base no abriera, TODAS las pruebas
  // de acierto pasarían por el camino de «no hay base» sin decir nada.
  expect(apertura.disponible, 'el arnés no ha conseguido abrir la base').toBe(true)
  return apertura
}

/**
 * La base real con la CUOTA AGOTADA: `get` sigue delegando y `put` rechaza con
 * el error que lanza de verdad el navegador cuando se queda sin espacio. Es la
 * única forma de reproducirlo, porque `fake-indexeddb` no tiene cuota (decisión
 * 5 de la cabecera), y reproduce la situación exacta: lo de antes se puede leer,
 * lo nuevo no se puede escribir.
 *
 * @param {*} real  La base envuelta por `idb`.
 */
function baseConCuotaAgotada(real) {
  return {
    get: (almacen, clave) => real.get(almacen, clave),
    put: async () => {
      throw new DOMException('The quota has been exceeded.', 'QuotaExceededError')
    },
  }
}

/** Una base cuya LECTURA revienta (base cerrada por el navegador, almacén ausente). */
function baseConLecturaRota() {
  return {
    get: async () => {
      throw new DOMException('The database connection is closing.', 'InvalidStateError')
    },
    put: async () => {},
  }
}

// ── Arnés: el cliente real, para que las claves las componga su dueño ────────

/** Lo que contesta un transporte que no llega a ninguna parte. */
const SIN_RED = Object.freeze({
  ok: false,
  estado: null,
  texto: null,
  tipoContenido: null,
  motivo: MOTIVO_RED.SIN_RED,
  mensaje: 'Doble de test: no hay red.',
  intentos: 0,
  ms: 0,
  url: '',
})

/** Transporte que siempre contesta lo mismo y cuenta cuántas veces le preguntan. */
function transporteQueContesta(respuesta) {
  const doble = {
    peticiones: 0,
    pedirTexto: async () => {
      doble.peticiones += 1
      return respuesta
    },
    estado: () => ({}),
    destruir: () => {},
  }
  return doble
}

/** Respuesta HTTP correcta con un cuerpo dado. */
const conCuerpo = (texto) => ({
  ok: true,
  estado: 200,
  texto,
  tipoContenido: 'text/xml; charset=UTF-8',
  motivo: null,
  mensaje: null,
  intentos: 1,
  ms: 1,
  url: 'https://doble/',
})

/**
 * La clave que el CLIENTE REAL compone para una consulta. No se teclea ninguna
 * clave en este fichero: se le pone al cliente una caché espía, se le pide la
 * consulta y se recoge la clave con la que consultó la caché (que es lo PRIMERO
 * que hace, antes de tocar la red). Así el prefijo y el redondeo los sigue
 * poniendo `services/catastro.js`, que es su dueño.
 *
 * @param {(cliente: *) => Promise<*>} consulta
 * @returns {Promise<string>}
 */
async function claveDelCliente(consulta) {
  const claves = []
  const espia = {
    leer: async (clave) => {
      claves.push(clave)
      return null
    },
    guardar: async () => {},
  }
  const cliente = crearClienteCatastro({
    transporte: transporteQueContesta(SIN_RED),
    cache: espia,
  })
  await consulta(cliente)
  expect(claves, 'el cliente no ha consultado la caché ni una vez').toHaveLength(1)
  return claves[0]
}

const claveParcelaDe = (refcat) =>
  claveDelCliente((c) => c.parcelaPorRefcat(refcat, { srs: SRS_FIXTURE }))

const claveRevgeoDe = (x, y) =>
  claveDelCliente((c) => c.refcatPorCoordenada(x, y, { srs: SRS_FIXTURE }))

/** Las dos claves canónicas del caso, compuestas por el cliente y no por mí. */
const CLAVE_PARCELA = await claveParcelaDe(RC_BUENA)
const CLAVE_REVGEO = await claveRevgeoDe(X_FIXTURE, Y_FIXTURE)

/**
 * Cómo se invoca cada operación DEL PUERTO. La lista de operaciones no está
 * aquí: sale de `CACHE_NULA`. Este objeto solo dice con qué argumentos se llama
 * a cada una, y si el puerto crece sin que crezca este mapa, las pruebas que lo
 * recorren fallan NOMBRANDO la operación que falta.
 */
const INVOCACION = {
  leer: (cache) => cache.leer(CLAVE_PARCELA),
  guardar: (cache) => cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 }),
}

// ── El arnés es el que decimos (no vacuidad) ─────────────────────────────────

describe('cache-catastro · el arnés y los fixtures no mienten', () => {
  it('el GML del fixture SIRVE para detectar corrupción: trae acentos y varias líneas', () => {
    // Un fixture puramente ASCII y de una sola línea no podría distinguir un
    // viaje limpio por IndexedDB de uno que estropea la codificación o los
    // saltos de línea. Se afirma que este sí puede.
    expect(GML_PARCELA.length).toBeGreaterThan(1000)
    expect([...GML_PARCELA].some((c) => c.codePointAt(0) > 127)).toBe(true)

    // ⚠️ Aquí había un `toContain('\r\n')` y **lo puso rojo la CI del primer push
    // de F05** (2026-07-28). El salto de línea concreto NO ES UNA PROPIEDAD DEL
    // FIXTURE, es del sistema de ficheros: `.gitattributes` guarda estos ficheros
    // con LF, y el checkout de Windows los deja con CRLF. Afirmar `\r\n` era
    // afirmar «estoy en Windows», y en Linux —que es donde corre CI, y el único
    // sitio donde se comprueba que el proyecto no depende del sistema de ficheros
    // de Windows— fallaba con razón.
    //
    // Lo invariante, y lo que de verdad sostiene la no-vacuidad, es que el fixture
    // tiene VARIAS LÍNEAS: eso basta para que un viaje que estropee los saltos se
    // note. Cuál sea el salto da igual, porque la prueba de ida y vuelta exige
    // igualdad carácter a carácter y por tanto lo conserva sea el que sea.
    const salto = GML_PARCELA.includes('\r\n') ? '\r\n' : '\n'
    expect(GML_PARCELA.split(salto).length).toBeGreaterThan(5)
  })

  it('el GML se ha leído como UTF-8 pese a que declara ISO-8859-1 (mandan los bytes)', () => {
    // El fichero se contradice a sí mismo: prólogo `ISO-8859-1`, bytes UTF-8.
    expect(GML_PARCELA).toContain('encoding="ISO-8859-1"')
    expect(GML_PARCELA).toContain('ó') // como latin-1 saldría 'Ã³'
    expect(GML_PARCELA).not.toContain('Ã')
  })

  it('las claves las compone el CLIENTE, y llevan su prefijo y su SRS', () => {
    expect(CLAVE_PARCELA.startsWith(PREFIJO.PARCELA)).toBe(true)
    expect(CLAVE_REVGEO.startsWith(PREFIJO.REVGEO)).toBe(true)
    expect(CLAVE_PARCELA).toContain(SRS_FIXTURE)
    expect(CLAVE_PARCELA).toContain(RC_BUENA)
    expect(CLAVE_REVGEO).toContain(SRS_FIXTURE)
  })

  it('`fake-indexeddb` deja las clases IDB* que `idb` necesita', () => {
    expect(typeof globalThis.indexedDB).toBe('object')
    expect(typeof globalThis.IDBRequest).toBe('function')
    expect(typeof globalThis.IDBTransaction).toBe('function')
  })
})

// ── Criterio 7 · el puerto de services/catastro.js ───────────────────────────

describe('cache-catastro · implementa el puerto de services/catastro.js (criterio 7)', () => {
  it('tiene TODAS las operaciones del puerto, derivadas de CACHE_NULA', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva() })
    for (const nombre of Object.keys(CACHE_NULA)) {
      expect(typeof cache[nombre], `al puerto le falta «${nombre}»`).toBe('function')
      expect(
        Object.keys(INVOCACION),
        `el puerto declara «${nombre}» y este fichero no sabe invocarla`,
      ).toContain(nombre)
    }
    // Y no se prueba menos de lo que hay: si CACHE_NULA se quedara vacío, el
    // bucle de arriba no comprobaría nada.
    expect(Object.keys(CACHE_NULA).length).toBeGreaterThan(0)
  })

  it('las dos operaciones son asíncronas de verdad (devuelven promesas)', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    for (const nombre of Object.keys(CACHE_NULA)) {
      const devuelto = INVOCACION[nombre](cache)
      expect(typeof devuelto.then, `«${nombre}» no devuelve una promesa`).toBe('function')
      await devuelto
    }
  })

  it('`crearClienteCatastro` la acepta: el duck typing del CONSUMIDOR es el juez', async () => {
    // Es la prueba que de verdad ata el puerto: si esta implementación y la
    // declaración de `services/catastro.js` divergieran, el cliente lanzaría
    // aquí en vez de en el cableado de la app.
    const cache = crearCacheCatastro({ bd: await baseNueva() })
    expect(() =>
      crearClienteCatastro({ transporte: transporteQueContesta(SIN_RED), cache }),
    ).not.toThrow()
  })

  it('`leer` devuelve `null` —no `undefined`— cuando no hay nada (lo exige el puerto)', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    const vacio = await cache.leer(CLAVE_PARCELA)
    expect(vacio).toBeNull()
    expect(vacio).not.toBeUndefined()
  })
})

// ── Criterio 1 · el texto crudo viaja intacto ────────────────────────────────

describe('cache-catastro · guardar y leer devuelve el TEXTO IDÉNTICO (criterio 1)', () => {
  it('un GML real vuelve carácter a carácter, con sus acentos y sus CRLF', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 })

    const leido = await cache.leer(CLAVE_PARCELA)
    expect(leido).not.toBeNull()
    // `toBe` y no `toEqual`: se exige identidad de cadena, no equivalencia.
    expect(leido.valor).toBe(GML_PARCELA)
    expect(leido.valor.length).toBe(GML_PARCELA.length)
    expect(leido.guardadoEn).toBe(T0)
  })

  it('el valor no se interpreta: un POJO del OVC viaja igual que un texto', async () => {
    // La caché no sabe qué guarda (decisión 1 de la cabecera del módulo): lo que
    // entra sale, sea el cuerpo de un GML o la lista de candidatos del OVC.
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    const datos = { candidatos: [{ refcat: RC_BUENA, domicilio: 'CL SAN RESTITUTO 72' }], unico: true }
    await cache.guardar(CLAVE_REVGEO, datos, { guardadoEn: T0 })

    const leido = await cache.leer(CLAVE_REVGEO)
    expect(leido.valor).toEqual(datos)
    expect(leido.valor).not.toBe(datos) // ha viajado por clonado estructurado
  })

  it('un `guardar` posterior con la misma clave PISA el anterior', async () => {
    // El reloj AVANZA con las escrituras: desde S3, una marca posterior al
    // `ahora` de la lectura (reloj retrocedido) se trata como caducada, así que
    // leer con el reloj clavado en T0 un registro guardado «en T0 + 1000» ya no
    // es un acierto — y este test no va de eso, va del pisado.
    const reloj = { t: T0 }
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => reloj.t })
    await cache.guardar(CLAVE_PARCELA, 'primero', { guardadoEn: T0 })
    reloj.t = T0 + 1000
    await cache.guardar(CLAVE_PARCELA, 'segundo', { guardadoEn: T0 + 1000 })

    const leido = await cache.leer(CLAVE_PARCELA)
    expect(leido.valor).toBe('segundo')
    expect(leido.guardadoEn).toBe(T0 + 1000)
  })
})

// ── El enrutado y el campo clave, los dos DERIVADOS ──────────────────────────

describe('cache-catastro · cada clave va a su almacén, con el campo que declara el esquema', () => {
  it('la parcela va al almacén de parcelas y la geocodificación al de revgeo', async () => {
    const apertura = await baseNueva()
    const cache = crearCacheCatastro({ bd: apertura, ahora: () => T0 })
    await cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 })
    await cache.guardar(CLAVE_REVGEO, { unico: true }, { guardadoEn: T0 })

    // El campo en el que la base espera la clave se DERIVA de `ESQUEMA_ALMACENES`
    // (en el módulo tampoco se escribe a mano): si una migración lo moviera, esto
    // sigue valiendo sin tocarlo.
    for (const [clave, almacen] of [
      [CLAVE_PARCELA, ALMACENES.PARCELAS],
      [CLAVE_REVGEO, ALMACENES.REVGEO],
    ]) {
      const { keyPath } = ESQUEMA_ALMACENES[almacen]
      const registro = await apertura.bd.get(almacen, clave)
      expect(registro, `no hay registro de «${clave}» en «${almacen}»`).toBeTruthy()
      expect(registro[keyPath]).toBe(clave)
      expect(registro.guardadoEn).toBe(T0)
    }

    // Y no se han cruzado: cada una en el suyo y solo en el suyo.
    expect(await apertura.bd.get(ALMACENES.REVGEO, CLAVE_PARCELA)).toBeUndefined()
    expect(await apertura.bd.get(ALMACENES.PARCELAS, CLAVE_REVGEO)).toBeUndefined()
    apertura.bd.close()
  })

  it('en el almacén de parcelas se guarda LA CLAVE ENTERA, no la referencia pelada', async () => {
    // Es la trampa que la cabecera del módulo explica: quedarse con los 14
    // caracteres de la referencia borraría el SRS y dos husos colisionarían.
    const apertura = await baseNueva()
    const cache = crearCacheCatastro({ bd: apertura, ahora: () => T0 })
    await cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 })

    const { keyPath } = ESQUEMA_ALMACENES[ALMACENES.PARCELAS]
    const registro = await apertura.bd.get(ALMACENES.PARCELAS, CLAVE_PARCELA)
    expect(registro[keyPath]).toBe(CLAVE_PARCELA)
    expect(registro[keyPath]).not.toBe(RC_BUENA)
    expect(await apertura.bd.get(ALMACENES.PARCELAS, RC_BUENA)).toBeUndefined()
    apertura.bd.close()
  })

  it('la tabla de rutas apunta a almacenes REALES de storage/bd.js', () => {
    for (const almacen of Object.values(ALMACEN_POR_PREFIJO)) {
      expect(Object.values(ALMACENES)).toContain(almacen)
      expect(typeof ESQUEMA_ALMACENES[almacen].keyPath).toBe('string')
    }
    expect(Object.isFrozen(ALMACEN_POR_PREFIJO)).toBe(true)
    expect(Object.isFrozen(PREFIJO)).toBe(true)
  })

  it('una clave con un prefijo DESCONOCIDO lanza: no se archiva en un almacén por defecto', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await expect(cache.leer('expediente:1')).rejects.toThrow(TypeError)
    await expect(cache.leer('expediente:1')).rejects.toThrow(/prefijos conocidos/)
    await expect(cache.guardar('expediente:1', 'x', { guardadoEn: T0 })).rejects.toThrow(
      /prefijos conocidos/,
    )
  })
})

// ── Criterios 2 y 3 · el TTL ─────────────────────────────────────────────────

describe('cache-catastro · el TTL de 7 días, con el reloj INYECTADO (criterios 2 y 3)', () => {
  /**
   * Una caché sobre base nueva con un reloj movible. Devuelve las dos cosas para
   * que la prueba mueva el tiempo sin recrear nada.
   */
  async function conReloj() {
    const reloj = { t: T0 }
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => reloj.t })
    await cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 })
    return { cache, reloj }
  }

  it('MS_TTL son exactamente 7 días', () => {
    expect(MS_TTL).toBe(7 * 24 * 60 * 60 * 1000)
  })

  it('JUSTO ANTES del TTL, acierta (la anti-vacuidad de la caducidad)', async () => {
    // Sin esta prueba, «caducar siempre» aprobaría el criterio 2 tan ricamente.
    const { cache, reloj } = await conReloj()
    reloj.t = T0 + MS_TTL - 1
    const leido = await cache.leer(CLAVE_PARCELA)
    expect(leido).not.toBeNull()
    expect(leido.valor).toBe(GML_PARCELA)
    expect(cache.estado().aciertos).toBe(1)
  })

  it('EN el límite exacto del TTL todavía acierta: el límite es el último valor admitido', async () => {
    // Es lo que distingue `>` de `>=`. Mismo criterio que MAX_AREA_BBOX_M2.
    const { cache, reloj } = await conReloj()
    reloj.t = T0 + MS_TTL
    expect(await cache.leer(CLAVE_PARCELA)).not.toBeNull()
  })

  it('PASADO el TTL se comporta como ausente, sin esperar ni un milisegundo real', async () => {
    const { cache, reloj } = await conReloj()
    reloj.t = T0 + MS_TTL + 1
    expect(await cache.leer(CLAVE_PARCELA)).toBeNull()
    expect(cache.estado().caducados).toBe(1)
    expect(cache.estado().aciertos).toBe(0)
  })

  it('lo decide el `ahora` INYECTADO, no `Date.now()`', async () => {
    // Un registro guardado en la época (1970) que se lee con un reloj inyectado
    // en `MS_TTL` es un acierto. Si el módulo mirase el reloj del sistema, la
    // edad sería de más de medio siglo y esto sería un fallo.
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => MS_TTL })
    await cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: 0 })
    expect(Date.now()).toBeGreaterThan(T0) // el reloj real está lejísimos
    expect(await cache.leer(CLAVE_PARCELA)).not.toBeNull()
  })

  it('caducar NO borra: el registro sigue en la base y lo pisa el siguiente `guardar`', async () => {
    // Decisión 5 del módulo: la purga por antigüedad es de F10. Borrar dentro de
    // una lectura sería una escritura escondida.
    const apertura = await baseNueva()
    const reloj = { t: T0 }
    const cache = crearCacheCatastro({ bd: apertura, ahora: () => reloj.t })
    await cache.guardar(CLAVE_PARCELA, 'viejo', { guardadoEn: T0 })

    reloj.t = T0 + MS_TTL + 1
    expect(await cache.leer(CLAVE_PARCELA)).toBeNull()
    expect(await apertura.bd.get(ALMACENES.PARCELAS, CLAVE_PARCELA)).toBeTruthy()

    await cache.guardar(CLAVE_PARCELA, 'nuevo', { guardadoEn: reloj.t })
    expect((await cache.leer(CLAVE_PARCELA)).valor).toBe('nuevo')
    apertura.bd.close()
  })

  it('S3 · una marca de tiempo FUTURA (reloj retrocedido) se comporta como caducada', async () => {
    // El defecto: con solo `edad > MS_TTL`, un registro guardado «en el futuro»
    // tenía edad NEGATIVA, no caducaba jamás, y el cliente lo presentaba encima
    // como recién traído (`edadMs` se recorta a 0 en `services/catastro.js`). No
    // se puede afirmar «tiene menos de siete días» de algo guardado en un tiempo
    // que aún no ha llegado.
    const { cache, reloj } = await conReloj()
    reloj.t = T0 - 1 // el reloj retrocede 1 ms respecto del momento de guardado
    expect(await cache.leer(CLAVE_PARCELA)).toBeNull()
    expect(cache.estado().caducados).toBe(1)
    expect(cache.estado().aciertos).toBe(0)
  })

  it('S3 · anti-vacuidad: con edad EXACTAMENTE 0 (guardado ahora mismo) sigue acertando', async () => {
    // Es lo que separa `edad < 0` de `edad <= 0`: el registro recién guardado con
    // el mismo reloj es el caso más común de todos y tiene que seguir sirviendo.
    const { cache } = await conReloj() // reloj.t === T0 === guardadoEn
    const leido = await cache.leer(CLAVE_PARCELA)
    expect(leido).not.toBeNull()
    expect(leido.valor).toBe(GML_PARCELA)
  })

  it('un registro sin marca de tiempo utilizable se comporta como caducado', async () => {
    // No se puede afirmar «tiene menos de siete días» de algo cuya edad no se
    // puede calcular. Se escribe por debajo, que es la única forma de que exista.
    const apertura = await baseNueva()
    const { keyPath } = ESQUEMA_ALMACENES[ALMACENES.PARCELAS]
    await apertura.bd.put(ALMACENES.PARCELAS, {
      [keyPath]: CLAVE_PARCELA,
      valor: GML_PARCELA,
      guardadoEn: null,
    })
    const cache = crearCacheCatastro({ bd: apertura, ahora: () => T0 })
    expect(await cache.leer(CLAVE_PARCELA)).toBeNull()
    expect(cache.estado().caducados).toBe(1)
    apertura.bd.close()
  })
})

// ── Criterio 4 · la clave de revgeo redondea al metro ────────────────────────

describe('cache-catastro · dos clics a 30 cm son la MISMA pregunta (criterio 4)', () => {
  // El desplazamiento se DERIVA del propio redondeo y no se pone a ojo, y hace
  // falta: la Y del fixture (4479664.51) cae a un centímetro de un `.5`, así que
  // restarle 15 cm la baja de metro (4479664,36 → 4479664) y la prueba
  // «demostraría» justo lo contrario de lo que dice su nombre.
  const CENTRO_X = Math.round(X_FIXTURE)
  const CENTRO_Y = Math.round(Y_FIXTURE)
  const MEDIA = 0.15 // media separación: los dos puntos quedan a 30 cm

  it('los dos puntos están de verdad a 30 cm y no son el mismo float', () => {
    const d = Math.hypot(CENTRO_X + MEDIA - (CENTRO_X - MEDIA), 0)
    expect(d).toBeCloseTo(0.3, 9)
    expect(CENTRO_X - MEDIA).not.toBe(CENTRO_X + MEDIA)
    // Y el punto del fixture cae de verdad cerca del `.5` que hace peligroso el
    // delta puesto a ojo: si dejara de caer, esta advertencia se quedaría sin
    // sentido y conviene enterarse.
    expect(Math.abs(Y_FIXTURE - Math.trunc(Y_FIXTURE) - 0.5)).toBeLessThan(0.05)
  })

  it('comparten CLAVE: un clic un píxel más allá tiene que ser un acierto', async () => {
    const a = await claveRevgeoDe(CENTRO_X - MEDIA, CENTRO_Y - MEDIA)
    const b = await claveRevgeoDe(CENTRO_X + MEDIA, CENTRO_Y + MEDIA)
    expect(a).toBe(b)
  })

  it('y a un metro NO la comparten: el redondeo distingue celdas contiguas', async () => {
    // Anti-vacuidad: sin esto, «todas las claves iguales» aprobaría lo de arriba.
    const a = await claveRevgeoDe(CENTRO_X, CENTRO_Y)
    const lejos = await claveRevgeoDe(CENTRO_X + 1, CENTRO_Y)
    expect(lejos).not.toBe(a)
  })

  it('el acierto es REAL: se guarda con la clave de un punto y se lee con la del otro', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    const a = await claveRevgeoDe(CENTRO_X - MEDIA, CENTRO_Y - MEDIA)
    const b = await claveRevgeoDe(CENTRO_X + MEDIA, CENTRO_Y + MEDIA)

    await cache.guardar(a, { refcat: RC_BUENA }, { guardadoEn: T0 })
    const leido = await cache.leer(b)
    expect(leido).not.toBeNull()
    expect(leido.valor).toEqual({ refcat: RC_BUENA })
  })
})

// ── Criterio 5 · un fallo de escritura no cambia ningún resultado ────────────

describe('cache-catastro · la cuota agotada NO rompe nada (criterio 5)', () => {
  /** Base real con algo ya guardado, más una caché cuyo `put` rechaza. */
  async function conCuotaAgotada() {
    const apertura = await baseNueva()
    const sana = crearCacheCatastro({ bd: apertura, ahora: () => T0 })
    await sana.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 })

    const avisos = vi.fn()
    const rota = crearCacheCatastro({
      bd: baseConCuotaAgotada(apertura.bd),
      ahora: () => T0,
      alAvisar: avisos,
    })
    return { apertura, rota, avisos }
  }

  it('`guardar` RESUELVE aunque el `put` rechace: la caché es una optimización', async () => {
    const { apertura, rota } = await conCuotaAgotada()
    await expect(rota.guardar(CLAVE_REVGEO, { unico: true }, { guardadoEn: T0 })).resolves.toBeUndefined()
    expect(rota.estado().fallosEscritura).toBe(1)
    expect(rota.estado().escrituras).toBe(0)
    apertura.bd.close()
  })

  it('avisa con NIVEL.AVISO, con la causa dentro y un mensaje presentable', async () => {
    const { apertura, rota, avisos } = await conCuotaAgotada()
    await rota.guardar(CLAVE_REVGEO, { unico: true }, { guardadoEn: T0 })

    expect(avisos).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = avisos.mock.calls[0]
    expect(detalle.nivel).toBe(NIVEL.AVISO)
    expect(detalle.causa.name).toBe('QuotaExceededError')
    // El mensaje dice las dos cosas que importan: que la consulta SÍ funcionó y
    // qué pasa a partir de ahora.
    expect(mensaje).toMatch(/ha funcionado/i)
    expect(mensaje).toMatch(/espacio|cuota/i)
    apertura.bd.close()
  })

  it('y la LECTURA posterior sigue viva: lo que ya estaba guardado se sirve igual', async () => {
    const { apertura, rota } = await conCuotaAgotada()
    await rota.guardar(CLAVE_REVGEO, { unico: true }, { guardadoEn: T0 })

    const leido = await rota.leer(CLAVE_PARCELA)
    expect(leido).not.toBeNull()
    expect(leido.valor).toBe(GML_PARCELA)
    apertura.bd.close()
  })

  it('a través del CLIENTE REAL, la parcela se entrega con éxito pese al fallo de escritura', async () => {
    // Es la formulación completa de la regla: que la caché se llene no puede
    // convertir una parcela traída con éxito en un error.
    const apertura = await baseNueva()
    const avisos = vi.fn()
    const cache = crearCacheCatastro({
      bd: baseConCuotaAgotada(apertura.bd),
      ahora: () => T0,
      alAvisar: avisos,
    })
    const cliente = crearClienteCatastro({
      transporte: transporteQueContesta(conCuerpo(GML_PARCELA)),
      cache,
      ahora: () => T0,
    })

    const r = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(r.ok).toBe(true)
    expect(r.motivo).toBeNull()
    expect(r.datos.refcat).toBe(RC_BUENA)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(avisos).toHaveBeenCalledTimes(1) // el fallo NO se ha callado
    apertura.bd.close()
  })

  it('una LECTURA que revienta se comporta como «no estaba» y avisa', async () => {
    const avisos = vi.fn()
    const cache = crearCacheCatastro({
      bd: baseConLecturaRota(),
      ahora: () => T0,
      alAvisar: avisos,
    })
    expect(await cache.leer(CLAVE_PARCELA)).toBeNull()
    expect(cache.estado().fallosLectura).toBe(1)
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(avisos.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })
})

// ── Criterio 6 · sin base, esto es CACHE_NULA ────────────────────────────────

describe('cache-catastro · sin almacén disponible se comporta como CACHE_NULA (criterio 6)', () => {
  /**
   * Todas las formas legítimas de «aquí no hay base». **Ninguna se espera con
   * `await` en la prueba**: se le pasan a la caché tal cual, que es como llegan
   * en el cableado real (`bd: abrirBd(...)`, sin esperar). Con la promesa que
   * rechaza, además, esperarla aquí reventaría la prueba en vez de ejercitar el
   * camino que se quiere: que la caché la absorba.
   */
  const SIN_ALMACEN = [
    ['no se ha cableado ninguna', () => null],
    [
      'un entorno sin IndexedDB',
      () => {
        vi.resetModules()
        return import('../../storage/bd.js').then(({ abrirBd }) =>
          abrirBd({ indexedDB: null, alAvisar: () => {} }),
        )
      },
    ],
    ['una promesa que rechaza', () => Promise.reject(new Error('apertura imposible'))],
    ['un objeto que no sabe leer ni escribir', () => ({})],
  ]

  for (const [nombre, hacerBd] of SIN_ALMACEN) {
    it(`con ${nombre}: no acierta, no guarda, no lanza — y lo dice UNA sola vez`, async () => {
      const avisos = vi.fn()
      const cache = crearCacheCatastro({ bd: hacerBd(), ahora: () => T0, alAvisar: avisos })

      await expect(cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 })).resolves.toBeUndefined()
      expect(await cache.leer(CLAVE_PARCELA)).toBeNull()
      // Tres operaciones más: el aviso NO se repite (sería ruido en cada consulta).
      await cache.leer(CLAVE_REVGEO)
      await cache.guardar(CLAVE_REVGEO, { unico: true }, { guardadoEn: T0 })
      await cache.leer(CLAVE_PARCELA)

      expect(avisos).toHaveBeenCalledTimes(1)
      const [mensaje, detalle] = avisos.mock.calls[0]
      expect(detalle.nivel).toBe(NIVEL.AVISO)
      // Presentable: dice qué sigue funcionando y qué va a ser más lento.
      expect(mensaje).toMatch(/Catastro/)
      expect(mensaje).toMatch(/GML|funciona/i)
      expect(cache.estado().disponible).toBe(false)
    })
  }

  it('el comportamiento coincide con CACHE_NULA en TODAS las claves del puerto', async () => {
    // Derivado del puerto, no de una lista mía: si `CacheCatastro` creciera, este
    // bucle exige que la equivalencia se compruebe también para lo nuevo.
    const cache = crearCacheCatastro({ bd: null, alAvisar: () => {}, ahora: () => T0 })
    for (const nombre of Object.keys(CACHE_NULA)) {
      expect(await INVOCACION[nombre](cache)).toEqual(await INVOCACION[nombre](CACHE_NULA))
    }
  })

  it('el cliente real funciona entero con la caché sin base: solo va más lento', async () => {
    const cliente = crearClienteCatastro({
      transporte: transporteQueContesta(conCuerpo(GML_PARCELA)),
      cache: crearCacheCatastro({ bd: null, alAvisar: () => {}, ahora: () => T0 }),
      ahora: () => T0,
    })
    const primera = await cliente.parcelaPorRefcat(RC_BUENA)
    const segunda = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(primera.ok && segunda.ok).toBe(true)
    // Sin caché, las dos van a la red. Es correcto, no es un fallo.
    expect(segunda.procedencia.origen).toBe(ORIGEN.RED)
  })
})

// ── S1 · una apertura BLOQUEADA no puede colgar las consultas ────────────────
//
// El defecto (S1, 2026-08-15): con otra pestaña sujetando la base en una versión
// anterior, `abrirBd` recibía `blocked` y su promesa quedaba PENDIENTE PARA
// SIEMPRE. `obtenerBase` la esperaba sin plazo, y como el cliente consulta la
// caché ANTES que la red (trampa 6 de `services/catastro.js`), «Cargar por RC»,
// colindantes, revgeo y descriptivos no resolvían NUNCA — ni llegaban a la red.
// Desde S1, `abrirBd` resuelve `{disponible: false, motivo: BLOQUEADA}` al
// recibir `blocked` y esta caché degrada a `CACHE_NULA`, que es lo que estas dos
// pruebas afirman. Antes de la corrección, se quedaban en el timeout de Vitest.

describe('cache-catastro · S1: la apertura bloqueada degrada a CACHE_NULA, no cuelga', () => {
  /**
   * El escenario del defecto, real y dentro de una misma fábrica: una conexión
   * abierta a mano con la versión 1 —fabricada tal como era en F05, mismo patrón
   * que `pie-firma.test.js`— que no escucha `versionchange`, o sea que no va a
   * soltar la base nunca. `abrirBd` pide la versión de hoy y recibe `blocked`.
   *
   * La promesa de apertura se devuelve SIN esperar, que es como viaja en el
   * cableado real (`bd: abrirBd(...)`, sin `await`).
   */
  async function aperturaBloqueada() {
    vi.resetModules()
    const { NOMBRE_BD, abrirBd } = await import('../../storage/bd.js')
    const fabrica = new IDBFactory()
    const peticionVieja = fabrica.open(NOMBRE_BD, 1)
    peticionVieja.onupgradeneeded = () => {
      peticionVieja.result.createObjectStore('catastroCache', { keyPath: 'refcat' })
      peticionVieja.result.createObjectStore('revgeo', { keyPath: 'clave' })
    }
    const vieja = await new Promise((resolver, rechazar) => {
      peticionVieja.onsuccess = () => resolver(peticionVieja.result)
      peticionVieja.onerror = () => rechazar(peticionVieja.error)
    })
    return { promesa: abrirBd({ indexedDB: fabrica, alAvisar: () => {} }), vieja }
  }

  it('⭐ `leer` y `guardar` RESUELVEN (antes quedaban pendientes para siempre) y lo dicen una vez', async () => {
    const { promesa, vieja } = await aperturaBloqueada()
    const avisos = vi.fn()
    const cache = crearCacheCatastro({ bd: promesa, ahora: () => T0, alAvisar: avisos })

    expect(await cache.leer(CLAVE_PARCELA)).toBeNull()
    await expect(
      cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 }),
    ).resolves.toBeUndefined()
    expect(cache.estado().disponible).toBe(false)
    // El aviso de la decisión 6, una sola vez: «no hay base» es un estado.
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(avisos.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    vieja.close()
  })

  it('⭐ y el CLIENTE REAL llega a la RED: la caché bloqueada no impide traer el dato (trampa 6)', async () => {
    // La formulación completa del defecto: `parcelaPorRefcat` consulta la caché
    // ANTES que la red, así que con la lectura colgada no llegaba NI a la red.
    const { promesa, vieja } = await aperturaBloqueada()
    const cache = crearCacheCatastro({ bd: promesa, ahora: () => T0, alAvisar: () => {} })
    const transporte = transporteQueContesta(conCuerpo(GML_PARCELA))
    const cliente = crearClienteCatastro({ transporte, cache, ahora: () => T0 })

    const r = await cliente.parcelaPorRefcat(RC_BUENA, { srs: SRS_FIXTURE })
    expect(r.ok).toBe(true)
    expect(r.datos.refcat).toBe(RC_BUENA)
    expect(r.procedencia.origen).toBe(ORIGEN.RED)
    expect(transporte.peticiones).toBe(1)
    vieja.close()
  })
})

// ── El ciclo completo, por el cliente de verdad ──────────────────────────────

describe('cache-catastro · el ciclo real: red la primera vez, caché la segunda', () => {
  it('la segunda consulta NO toca la red y llega con su edad puesta', async () => {
    // Es el criterio de aceptación 1 de la spec F05 («segunda llamada sale de
    // caché, sin red»), comprobado sobre IndexedDB de verdad.
    const reloj = { t: T0 }
    const transporte = transporteQueContesta(conCuerpo(GML_PARCELA))
    const cliente = crearClienteCatastro({
      transporte,
      cache: crearCacheCatastro({ bd: await baseNueva(), ahora: () => reloj.t }),
      ahora: () => reloj.t,
    })

    const primera = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(primera.ok).toBe(true)
    expect(primera.procedencia.origen).toBe(ORIGEN.RED)
    expect(transporte.peticiones).toBe(1)

    const SEIS_DIAS = 6 * 24 * 60 * 60 * 1000
    reloj.t = T0 + SEIS_DIAS
    const segunda = await cliente.parcelaPorRefcat(RC_BUENA)
    expect(segunda.ok).toBe(true)
    expect(segunda.procedencia.origen).toBe(ORIGEN.CACHE)
    expect(segunda.procedencia.edadMs).toBe(SEIS_DIAS) // «guardado hace 6 días»
    expect(segunda.datos).toEqual(primera.datos)
    expect(transporte.peticiones, 'la segunda consulta ha tocado la red').toBe(1)
  })

  it('pasado el TTL vuelve a la red por su cuenta', async () => {
    const reloj = { t: T0 }
    const transporte = transporteQueContesta(conCuerpo(GML_PARCELA))
    const cliente = crearClienteCatastro({
      transporte,
      cache: crearCacheCatastro({ bd: await baseNueva(), ahora: () => reloj.t }),
      ahora: () => reloj.t,
    })

    await cliente.parcelaPorRefcat(RC_BUENA)
    reloj.t = T0 + MS_TTL + 1
    const tarde = await cliente.parcelaPorRefcat(RC_BUENA)

    expect(tarde.ok).toBe(true)
    expect(tarde.procedencia.origen).toBe(ORIGEN.RED)
    expect(transporte.peticiones).toBe(2)
  })
})

// ── Contrato roto por el programador ─────────────────────────────────────────

describe('cache-catastro · lo que es culpa del programador revienta (regla de oro 1)', () => {
  it("'ahora' que no es función, 'bd' que es basura y 'alAvisar' que no avisa", () => {
    expect(() => crearCacheCatastro({ ahora: 42 })).toThrow(TypeError)
    expect(() => crearCacheCatastro({ bd: 42 })).toThrow(/ResultadoApertura|null/)
    expect(() => crearCacheCatastro({ bd: 'la base' })).toThrow(TypeError)
    expect(() => crearCacheCatastro({ alAvisar: 'avísame' })).toThrow(TypeError)
    expect(() => crearCacheCatastro(7)).toThrow(/objeto/)
  })

  it('una clave que no es una cadena no vacía rechaza en las dos operaciones', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await expect(cache.leer(null)).rejects.toThrow(TypeError)
    await expect(cache.leer('')).rejects.toThrow(/cadena no vacía/)
    await expect(cache.guardar(42, 'x', { guardadoEn: T0 })).rejects.toThrow(/cadena no vacía/)
  })

  it("un 'guardadoEn' que no es un número finito rechaza: sin marca no se puede caducar", async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await expect(cache.guardar(CLAVE_PARCELA, 'x', { guardadoEn: 'ayer' })).rejects.toThrow(TypeError)
    await expect(cache.guardar(CLAVE_PARCELA, 'x', { guardadoEn: NaN })).rejects.toThrow(/finito/)
    await expect(cache.guardar(CLAVE_PARCELA, 'x', null)).rejects.toThrow(/meta/)
  })

  it("sin 'meta' cae en el reloj inyectado, que es un defecto documentado y no un apaño", async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await cache.guardar(CLAVE_PARCELA, 'x')
    expect((await cache.leer(CLAVE_PARCELA)).guardadoEn).toBe(T0)
  })
})

// ── Contadores ───────────────────────────────────────────────────────────────

describe('cache-catastro · estado() es el gancho informativo de F10', () => {
  it('cuenta aciertos, fallos y caducados por separado, y da una foto nueva cada vez', async () => {
    const reloj = { t: T0 }
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => reloj.t })

    expect(cache.estado().disponible).toBeNull() // aún no se ha mirado
    await cache.leer(CLAVE_PARCELA) // fallo: no hay nada
    await cache.guardar(CLAVE_PARCELA, GML_PARCELA, { guardadoEn: T0 })
    await cache.leer(CLAVE_PARCELA) // acierto
    reloj.t = T0 + MS_TTL + 1
    await cache.leer(CLAVE_PARCELA) // caducado

    const foto = cache.estado()
    expect(foto).toMatchObject({
      disponible: true,
      aciertos: 1,
      fallos: 1,
      caducados: 1,
      escrituras: 1,
      fallosLectura: 0,
      fallosEscritura: 0,
    })
    // Foto, no ventana: guardar el objeto no lo deja cambiar solo.
    await cache.leer(CLAVE_PARCELA)
    expect(foto.caducados).toBe(1)
    expect(cache.estado().caducados).toBe(2)
  })
})

// ── La purga (F10 · T3.4) ────────────────────────────────────────────────────
//
// La degradación del criterio 4 de F10. Lo que hay que demostrar no es que borre
// —eso es un `delete`—, sino las tres cosas que la hacen segura:
//
//   1. que **NO se lleva lo que todavía sirve**, porque esta caché es la mitigación
//      anti-bloqueo del régimen O8 y el bloqueo del Catastro dura ~10 días;
//   2. que **no puede alcanzar** los expedientes del usuario ni el pie de firma, que
//      viven en la misma base y no son caché;
//   3. que **lo dice**, con números, y que no lanza jamás.

describe('cache-catastro · purgarCaducados (F10 · criterio 4)', () => {
  /** Guarda `n` registros de parcela con la marca de tiempo que se le diga. */
  async function sembrar(cache, entradas) {
    for (const [sufijo, guardadoEn] of entradas) {
      await cache.guardar(`${PREFIJO.PARCELA}${SRS_FIXTURE}:${sufijo}`, GML_PARCELA, { guardadoEn })
    }
  }

  it('⭐ borra lo caducado y NO toca lo fresco', async () => {
    const reloj = { t: T0 }
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => reloj.t })

    await sembrar(cache, [
      ['VIEJA1', T0 - MS_TTL - 1], // caducada por 1 ms
      ['VIEJA2', T0 - MS_TTL * 3], // caducadísima
      ['JUSTA', T0 - MS_TTL], // EXACTAMENTE el TTL: todavía acierta
      ['FRESCA', T0 - 1000],
    ])

    const r = await cache.purgarCaducados()

    expect(r.ok).toBe(true)
    expect(r.revisados).toBe(4)
    expect(r.purgados).toBe(2)
    expect(r.sinFecha).toBe(0)
    expect(r.porAlmacen[ALMACENES.PARCELAS]).toBe(2)

    // Y lo que sobrevive, sobrevive de verdad: se lee y acierta.
    expect(await cache.leer(`${PREFIJO.PARCELA}${SRS_FIXTURE}:FRESCA`)).not.toBeNull()
    expect(await cache.leer(`${PREFIJO.PARCELA}${SRS_FIXTURE}:JUSTA`)).not.toBeNull()
    expect(await cache.leer(`${PREFIJO.PARCELA}${SRS_FIXTURE}:VIEJA1`)).toBeNull()
  })

  it('el límite se compara con `>`, igual que en `leer`: el de exactamente 7 días se queda', async () => {
    // Es el mismo criterio que la decisión 2 de la cabecera fija para la lectura. Si
    // los dos divergieran, habría registros que `leer` sirve y la purga tira, o al
    // revés — y nadie lo notaría hasta que faltase una parcela.
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await sembrar(cache, [['JUSTA', T0 - MS_TTL]])
    expect((await cache.purgarCaducados()).purgados).toBe(0)
    expect(await cache.leer(`${PREFIJO.PARCELA}${SRS_FIXTURE}:JUSTA`)).not.toBeNull()
  })

  it('S3 · una marca FUTURA (reloj retrocedido) también se purga: `leer` ya no la sirve nunca', async () => {
    // El gemelo de la corrección en `leer`: sin esto, el registro futuro sería
    // peso muerto INMORTAL — jamás lo serviría `leer` y jamás lo tiraría la
    // purga, porque su edad negativa nunca supera ningún TTL.
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await sembrar(cache, [
      ['FUTURA', T0 + MS_TTL], // guardada «mañana»: edad negativa
      ['FRESCA', T0 - 1000],
    ])

    const r = await cache.purgarCaducados()
    expect(r.purgados).toBe(1)
    // «Futura» no es «rota»: su marca es un número perfectamente finito, solo que
    // imposible. `sinFecha` sigue contando únicamente las inservibles.
    expect(r.sinFecha).toBe(0)
    expect(await cache.leer(`${PREFIJO.PARCELA}${SRS_FIXTURE}:FUTURA`)).toBeNull()
    expect(await cache.leer(`${PREFIJO.PARCELA}${SRS_FIXTURE}:FRESCA`)).not.toBeNull()
  })

  it('un registro con la marca de tiempo rota también se va, y se cuenta APARTE', async () => {
    // `leer` ya lo trata como caducado y no lo sirve nunca: es peso muerto. Pero «viejo»
    // y «roto» no son lo mismo, y un `sinFecha` que sube señala a quien escriba mal.
    const apertura = await baseNueva()
    const cache = crearCacheCatastro({ bd: apertura, ahora: () => T0 })
    await apertura.bd.put(ALMACENES.PARCELAS, {
      refcat: `${PREFIJO.PARCELA}${SRS_FIXTURE}:ROTA`,
      valor: GML_PARCELA,
      guardadoEn: undefined,
    })
    await sembrar(cache, [['FRESCA', T0 - 1000]])

    const r = await cache.purgarCaducados()
    expect(r.purgados).toBe(1)
    expect(r.sinFecha).toBe(1)
    expect(r.revisados).toBe(2)
  })

  it('⭐ NO puede alcanzar los expedientes ni el pie de firma, que viven en la misma base', async () => {
    // Es la garantía que da derivar los almacenes de la tabla de rutas en vez de
    // escribirlos: una purga por espacio no se lleva el trabajo del usuario.
    const apertura = await baseNueva()
    const cache = crearCacheCatastro({ bd: apertura, ahora: () => T0 })

    await apertura.bd.put(ALMACENES.EXPEDIENTES, {
      id: 'EXP-1',
      nombre: 'Trabajo del usuario',
      refcat: null,
      creado: '2020-01-01T00:00:00.000Z',
      actualizado: '2020-01-01T00:00:00.000Z', // antiquísimo, por si acaso
      srs: SRS_FIXTURE,
      expediente: {},
    })
    await apertura.bd.put(ALMACENES.PIE_FIRMA, { id: 'PIE', guardadoEn: T0 - MS_TTL * 100 })
    await sembrar(cache, [['VIEJA', T0 - MS_TTL * 2]])

    const r = await cache.purgarCaducados()
    expect(r.purgados).toBe(1)
    expect(Object.keys(r.porAlmacen).sort()).toEqual([...ALMACENES_DE_CACHE].sort())
    expect(r.porAlmacen[ALMACENES.EXPEDIENTES]).toBeUndefined()

    // Anti-vacuidad: los dos registros ajenos SIGUEN ahí, no es que no existieran.
    expect(await apertura.bd.get(ALMACENES.EXPEDIENTES, 'EXP-1')).toBeDefined()
    expect(await apertura.bd.get(ALMACENES.PIE_FIRMA, 'PIE')).toBeDefined()
  })

  it('los almacenes de la purga se DERIVAN de la tabla de rutas', () => {
    expect(ALMACENES_DE_CACHE).toEqual([...new Set(Object.values(ALMACEN_POR_PREFIJO))])
    expect(ALMACENES_DE_CACHE).toContain(ALMACENES.PARCELAS)
    expect(ALMACENES_DE_CACHE).toContain(ALMACENES.REVGEO)
    expect(ALMACENES_DE_CACHE).not.toContain(ALMACENES.EXPEDIENTES)
    expect(ALMACENES_DE_CACHE).not.toContain(ALMACENES.PIE_FIRMA)
  })

  it('purga los DOS almacenes, no solo el de parcelas', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await cache.guardar(`${PREFIJO.PARCELA}${SRS_FIXTURE}:VIEJA`, GML_PARCELA, {
      guardadoEn: T0 - MS_TTL * 2,
    })
    await cache.guardar(`${PREFIJO.REVGEO}${SRS_FIXTURE}:1:2`, { pc: 'X' }, {
      guardadoEn: T0 - MS_TTL * 2,
    })

    const r = await cache.purgarCaducados()
    expect(r.purgados).toBe(2)
    expect(r.porAlmacen[ALMACENES.PARCELAS]).toBe(1)
    expect(r.porAlmacen[ALMACENES.REVGEO]).toBe(1)
  })

  it('`bytesAprox` es una estimación POR EXCESO, y no se presenta como exacta', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await sembrar(cache, [['VIEJA', T0 - MS_TTL * 2]])
    const r = await cache.purgarCaducados()
    // El GML del fixture ocupa lo suyo: si esto saliera 0, el estimador estaría roto.
    expect(r.bytesAprox).toBeGreaterThan(GML_PARCELA.length)
    // Y el nombre del campo dice que es aproximado; el mensaje, también.
    expect(r.mensaje).toMatch(/unos \d+ kB/)
  })

  it('siempre DICE lo que ha tirado, y también cuando no ha tirado nada', async () => {
    const avisos = []
    const cache = crearCacheCatastro({
      bd: await baseNueva(),
      ahora: () => T0,
      alAvisar: (m) => avisos.push(m),
    })

    // Sin nada caducado: hay mensaje, pero NO se avisa (sería ruido puro).
    await sembrar(cache, [['FRESCA', T0 - 1000]])
    const sinNada = await cache.purgarCaducados()
    expect(sinNada.ok).toBe(true)
    expect(sinNada.purgados).toBe(0)
    expect(sinNada.mensaje).toMatch(/No había nada caducado/)
    expect(avisos).toHaveLength(0)

    // Con algo caducado: se avisa una vez, con la cifra dentro.
    await sembrar(cache, [['VIEJA', T0 - MS_TTL * 2]])
    const conAlgo = await cache.purgarCaducados()
    expect(conAlgo.purgados).toBe(1)
    expect(avisos).toHaveLength(1)
    expect(avisos[0]).toContain('1 de los 2')
    expect(avisos[0]).toMatch(/irá al servicio del Catastro/)
  })

  it('los contadores de `estado()` cuentan las purgas', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    await sembrar(cache, [['V1', T0 - MS_TTL * 2], ['V2', T0 - MS_TTL * 2]])
    expect(cache.estado().purgas).toBe(0)
    await cache.purgarCaducados()
    await cache.purgarCaducados()
    expect(cache.estado().purgas).toBe(2)
    expect(cache.estado().purgados).toBe(2) // los dos de la primera; la segunda, cero
  })

  it('sin base no lanza: degrada con SIN_BD y su frase', async () => {
    const cache = crearCacheCatastro({ bd: null, alAvisar: () => {} })
    const r = await cache.purgarCaducados()
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_PURGA.SIN_BD)
    expect(r.purgados).toBe(0)
    expect(typeof r.mensaje).toBe('string')
  })

  it('una base que cumple el PUERTO pero no sabe listar degrada con SIN_SOPORTE', async () => {
    // `esBase` solo exige `get` y `put` —que es lo que pide el puerto— y no se le sube
    // el listón para no dejar fuera a los dobles legítimos. La capacidad extra se
    // comprueba donde hace falta, y su ausencia se cuenta, no se lanza.
    const cache = crearCacheCatastro({ bd: baseConLecturaRota(), alAvisar: () => {} })
    const r = await cache.purgarCaducados()
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_PURGA.SIN_SOPORTE)
  })

  it('si el borrado revienta a mitad, lo borrado sigue borrado y se dice cuánto', async () => {
    const apertura = await baseNueva()
    const cache = crearCacheCatastro({ bd: apertura, ahora: () => T0, alAvisar: () => {} })
    await sembrar(cache, [['V1', T0 - MS_TTL * 2], ['V2', T0 - MS_TTL * 2]])

    // Una base que borra el primero y revienta con el segundo.
    let borrados = 0
    const rota = {
      get: (a, k) => apertura.bd.get(a, k),
      put: (a, v) => apertura.bd.put(a, v),
      getAll: (a) => apertura.bd.getAll(a),
      delete: async (a, k) => {
        borrados += 1
        if (borrados > 1) throw new DOMException('Transaction aborted.', 'AbortError')
        return apertura.bd.delete(a, k)
      },
    }
    const conFallo = crearCacheCatastro({ bd: rota, ahora: () => T0, alAvisar: () => {} })

    const r = await conFallo.purgarCaducados()
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_PURGA.ERROR)
    expect(r.purgados).toBe(1)
    expect(r.mensaje).toContain('1 registro(s)')
    // Y el que sí se borró, borrado está: no hay medias tintas escondidas.
    expect(await apertura.bd.count(ALMACENES.PARCELAS)).toBe(1)
    expect(conFallo.estado().purgados).toBe(1)
  })

  it('un `ttlMs` inservible LANZA: borraría lo que todavía sirve', async () => {
    const cache = crearCacheCatastro({ bd: await baseNueva(), ahora: () => T0 })
    for (const ttlMs of [-1, NaN, Infinity, '7 días', null]) {
      await expect(cache.purgarCaducados({ ttlMs })).rejects.toThrow(RangeError)
    }
    // Y un `ttlMs: 0` sí vale: es «purga todo lo que no se acabe de guardar».
    await sembrar(cache, [['VIEJA', T0 - 1]])
    expect((await cache.purgarCaducados({ ttlMs: 0 })).purgados).toBe(1)
  })

  it('`purgarCaducados` NO forma parte del puerto que consume el cliente', async () => {
    // El cliente del Catastro sigue sin saber que esto se puede purgar, que es lo
    // correcto: quién purga y cuándo es del cableado.
    expect(Object.keys(CACHE_NULA)).not.toContain('purgarCaducados')
    const cache = crearCacheCatastro({ bd: null, alAvisar: () => {} })
    for (const clave of Object.keys(CACHE_NULA)) {
      expect(typeof cache[clave]).toBe('function') // el puerto entero sigue estando
    }
  })
})

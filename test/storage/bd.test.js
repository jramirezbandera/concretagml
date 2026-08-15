/* -------------------------------------------------------------------------- *
 * test/storage/bd.test.js — F05 · T1D · la apertura de la base IndexedDB       *
 *                                                                              *
 * `storage/bd.js` estrena el almacenamiento persistente del proyecto, y sus     *
 * fallos son de la peor familia: NO SE VEN. Un almacén que no se crea no da     *
 * error hasta el primer `put` de un usuario que ya tenía la base; una escalera  *
 * de migraciones aplicada con `===` deja la base a medias sin una sola          *
 * excepción; una pestaña vieja que bloquea la actualización se manifiesta como  *
 * «la aplicación no guarda nada» y nadie sabe por qué. Este fichero existe para *
 * que ninguna de esas tres cosas pueda pasar en silencio.                       *
 *                                                                              *
 * ── PROYECTO `node`, SIN SUFIJO `.dom`, Y NO ES UN DESCUIDO ──                 *
 * `vitest.config.js` enruta POR SUFIJO: `*.dom.test.js` va a jsdom y todo lo    *
 * demás al proyecto `node` (la guarda de partición de `test/contrato.test.js`   *
 * lo comprueba sobre los globs REALES). `fake-indexeddb` es una implementación  *
 * de IndexedDB en JavaScript puro: no necesita `window` ni jsdom, así que este  *
 * fichero va a `node` — que además es el bucle rápido.                          *
 *                                                                              *
 * ── LAS CUATRO DECISIONES DE DISEÑO DE ESTE FICHERO ──                         *
 *                                                                              *
 * 1. NADA ESCRITO A MANO DOS VECES. Los almacenes que deben existir se derivan  *
 *    de `ALMACENES`, sus `keyPath` de `ESQUEMA_ALMACENES`, las versiones de la  *
 *    escalera de `MIGRACIONES`, y el nombre del campo clave se contrasta contra *
 *    el POJO que devuelve `model/parcela.js#crearParcela`. Un test que repita   *
 *    la lista de almacenes solo comprueba que sé copiar.                         *
 *                                                                              *
 * 2. UNA FÁBRICA POR PRUEBA + UN MÓDULO POR PRUEBA. `new IDBFactory()` de       *
 *    `fake-indexeddb` da un universo de bases completamente aislado (medido     *
 *    abajo), así que ninguna prueba hereda la base de la anterior; y como       *
 *    `abrirBd` MEMOIZA en una variable de módulo, cada prueba que abre lo hace  *
 *    sobre un módulo recién cargado (`vi.resetModules()` + `import()`), que es  *
 *    la versión honesta de «otro proceso». Nada de exportar un `reiniciarBd()`  *
 *    que solo existiría para los tests.                                         *
 *                                                                              *
 * 3. LA ESCALERA SE PRUEBA CON PELDAÑOS SINTÉTICOS. Cuando se escribió esto,    *
 *    `MIGRACIONES` tenía un solo peldaño, y con uno solo NINGUNA prueba puede   *
 *    distinguir `<` de `===`. Por eso `aplicarMigraciones` recibe la escalera   *
 *    por parámetro y aquí se le pasa una de tres peldaños. Desde F09 la real    *
 *    tiene dos —el almacén del pie de firma— y el salto 0 → 2 ya distingue los  *
 *    operadores por sí solo; la sintética se conserva porque sigue siendo la    *
 *    única forma de ejercitar los saltos que la escalera de hoy no permite.     *
 *                                                                              *
 * 4. SE DICE LO QUE `fake-indexeddb` NO PUEDE. Ver el bloque de límites justo   *
 *    debajo: hay una parte del ciclo multipestaña que esta implementación no    *
 *    reproduce, y fingir que está cubierta sería peor que no cubrirla.          *
 *                                                                              *
 * ── LÍMITES MEDIDOS DE `fake-indexeddb` FRENTE AL NAVEGADOR REAL ──            *
 *                                                                              *
 * · `blocked` se ejercita de DOS formas, y las dos hacen falta. La SINTÉTICA    *
 *   (despachar un `IDBVersionChangeEvent('blocked')` sobre la petición real)    *
 *   prueba el cableado del aviso sin depender de cómo `fake-indexeddb` ordena   *
 *   sus eventos. La REAL —desde S1 (2026-08-15)— fabrica el escenario del       *
 *   defecto dentro de UNA MISMA fábrica: una conexión abierta a mano con la     *
 *   versión 1 que no escucha `versionchange` (o sea, que no va a cerrar) y      *
 *   `abrirBd` pidiendo la de hoy. Antes de S1 esa apertura quedaba PENDIENTE    *
 *   PARA SIEMPRE —y con ella la caché y todas las consultas al Catastro—; ahora *
 *   RESUELVE `{disponible: false, motivo: BLOQUEADA}`, que es lo que estas      *
 *   pruebas afirman. (Cuando se escribió la nota original, `VERSION_BD` valía 1 *
 *   y no había ascenso que bloquear; desde F09 lo hay.) El ciclo REAL de dos    *
 *   pestañas —dos contextos de navegación compartiendo origen— sigue siendo     *
 *   materia del guion de humo en navegador.                                     *
 * · `blocking` (nuestro `versionchange`) y la terminación anormal (`close`, vía *
 *   `forceCloseDatabase`) SÍ son reproducibles y aquí se ejercitan DE VERDAD,   *
 *   con eventos que emite la propia implementación, no sintéticos.              *
 * · La cuota (`QuotaExceededError`) no la simula `fake-indexeddb`: no hay       *
 *   límite de memoria que agotar. Es materia de F10, que es quien escribe.      *
 * -------------------------------------------------------------------------- */

// Pone `globalThis.indexedDB` Y las clases `IDB*` globales. Las clases no son
// decoración: `wrap` de `idb` decide con `instanceof IDBTransaction`/`IDBRequest`
// qué envuelve y cómo, así que sin ellas nada de esto funcionaría (y fallaría de
// una forma que no se parecería en nada a la causa). Se afirma abajo.
import 'fake-indexeddb/auto'
import { IDBFactory, IDBVersionChangeEvent, forceCloseDatabase } from 'fake-indexeddb'

import { describe, it, expect, vi } from 'vitest'

import { crearParcela, ORIGEN_PARCELA } from '../../model/parcela.js'
import { NIVEL } from '../../viewer/_comun.js'
// Import estático para todo lo que NO abre nada (constantes, escalera pura) y
// para las dos guardas que lanzan ANTES de abrir: ninguna toca la memoización, así
// que no necesitan módulo fresco. Lo que sí abre usa {@link moduloFresco}.
import {
  ALMACENES,
  ESQUEMA_ALMACENES,
  MIGRACIONES,
  MOTIVO_SIN_BD,
  NOMBRE_BD,
  VERSION_BD,
  abrirBd,
  aplicarMigraciones,
} from '../../storage/bd.js'

// ── Utillaje ─────────────────────────────────────────────────────────────────

/**
 * Carga `storage/bd.js` COMO SI FUERA OTRO PROCESO: `abrirBd` memoiza la
 * conexión en una variable de módulo, y esa memoización es parte del contrato
 * (criterio 5), así que no se puede «reiniciar» sin recargar el módulo.
 *
 * Ojo al orden con `idb`: `vi.resetModules()` también recarga `idb`, y sus cachés
 * (`WeakMap`) son por instancia. Quien necesite `unwrap` de la MISMA generación
 * que el módulo recién cargado tiene que importarlo DESPUÉS de esta llamada.
 */
async function moduloFresco() {
  vi.resetModules()
  return import('../../storage/bd.js')
}

/**
 * Cede turnos al bucle de eventos **hasta que se cumple la condición**, en vez de
 * esperar un número fijo de ticks.
 *
 * ⚠️ Esto no es cosmética: sustituye a un `await new Promise(r => setTimeout(r, 0))`
 * que hacía estas pruebas **flaky bajo carga**. `fake-indexeddb` no despacha sus
 * eventos en el tick siguiente sino repartidos en varios, así que un solo turno
 * bastaba con la máquina descansada y no bastaba con doce tareas en paralelo. Una
 * prueba que falla según lo ocupada que esté la máquina es peor que ninguna: se
 * aprende a ignorarla, y el día que detecte algo de verdad nadie la creerá. Es el
 * mismo error de método que `scripts/smoke-navegador/GUION.md` §3 documenta con
 * los márgenes de tiempo fijos del smoke.
 *
 * El tope existe para que un fallo REAL se vea como un fallo y no como un cuelgue,
 * y el mensaje dice cuántos turnos se esperaron para que nadie confunda «no pasó»
 * con «no esperé bastante».
 *
 * **Comprobado que la espera hace trabajo de verdad** (2026-07-28): con
 * `maxTurnos = 1` —que es justo lo que hacía el `setTimeout(0)` anterior— la
 * prueba de `blocking` se pone roja. O sea que el tick único no es que fuera
 * frágil: era insuficiente, y solo pasaba cuando la máquina iba sobrada.
 *
 * @param {() => boolean} condicion
 * @param {string} queEsperaba  Para el mensaje de fallo.
 * @param {number} [maxTurnos=200]
 */
async function esperarA(condicion, queEsperaba, maxTurnos = 200) {
  for (let turno = 0; turno < maxTurnos; turno++) {
    if (condicion()) return
    await new Promise((resolver) => setTimeout(resolver, 0))
  }
  throw new Error(
    `esperarA: tras ${maxTurnos} turnos del bucle de eventos, sigue sin cumplirse: ${queEsperaba}.`,
  )
}

/**
 * Fábrica de IndexedDB que delega en una real y GUARDA las peticiones que crea.
 * Sirve para dos cosas: contar aperturas (la memoización se comprueba por el
 * número de `open`, no solo por la identidad de la promesa) y tener en la mano la
 * `IDBOpenDBRequest` real sobre la que despachar el evento `blocked`.
 *
 * Es un objeto plano con `open`: eso basta porque el módulo hace DUCK TYPING. Si
 * algún día pidiera `instanceof IDBFactory`, esta prueba se caería y con razón.
 */
function fabricaEspia(real) {
  const peticiones = []
  return {
    peticiones,
    open(...args) {
      const peticion = real.open(...args)
      peticiones.push(peticion)
      return peticion
    },
    deleteDatabase(...args) {
      return real.deleteDatabase(...args)
    },
  }
}

/**
 * Base falsa que solo apunta lo que le mandan crear. Sin IndexedDB de por medio.
 *
 * F10 · `createObjectStore` DEVUELVE el almacén, porque el `IDBObjectStore` real
 * también lo hace y porque es lo único sobre lo que se puede llamar a
 * `createIndex` — que es exactamente lo que estrenó el peldaño 3. Una falsa que
 * devolviera `undefined` haría que toda migración con índices reventara aquí con
 * un `TypeError` sin relación aparente con lo que se está probando (pasó, y es
 * por lo que esto está escrito).
 */
function bdFalsa() {
  const creados = []
  return {
    creados,
    createObjectStore(nombre, opciones) {
      const almacen = {
        nombre,
        keyPath: opciones && opciones.keyPath,
        indices: {},
        createIndex(indice, keyPath, opts) {
          almacen.indices[indice] = { keyPath, unique: Boolean(opts && opts.unique) }
          return { name: indice }
        },
      }
      creados.push(almacen)
      return almacen
    },
  }
}

/** Peldaño sintético que solo apunta su número al aplicarse. */
const peldano = (version, registro) => ({
  version,
  aplicar: () => registro.push(version),
})

/** Una parcela mínima del modelo REAL de F00; de ella sale el nombre del campo clave. */
function parcelaDeModelo(refcat) {
  return crearParcela({ idLocal: 'p1', refcat, origen: ORIGEN_PARCELA.WFS })
}

// ── El arnés es el que decimos (no vacuidad) ─────────────────────────────────

describe('storage/bd · el arnés de fake-indexeddb', () => {
  it('deja en el entorno la fábrica global y las clases IDB* que `wrap` necesita', () => {
    // Si esto se rompiera, el resto del fichero fallaría con errores que no
    // señalarían a la causa: `wrap` devolvería los objetos sin envolver y las
    // promesas dejarían de serlo.
    expect(typeof globalThis.indexedDB).toBe('object')
    expect(typeof globalThis.IDBRequest).toBe('function')
    expect(typeof globalThis.IDBTransaction).toBe('function')
    expect(typeof globalThis.IDBDatabase).toBe('function')
  })

  it('`new IDBFactory()` da un universo de bases AISLADO del global', async () => {
    const fabrica = new IDBFactory()
    expect(fabrica).not.toBe(globalThis.indexedDB)
    expect(await fabrica.databases()).toEqual([])
  })
})

// ── Vocabulario de almacenes ─────────────────────────────────────────────────

describe('storage/bd · almacenes y esquema', () => {
  it('ALMACENES y ESQUEMA_ALMACENES están congelados hasta el último descriptor', () => {
    expect(Object.isFrozen(ALMACENES)).toBe(true)
    expect(Object.isFrozen(ESQUEMA_ALMACENES)).toBe(true)
    for (const descriptor of Object.values(ESQUEMA_ALMACENES)) {
      expect(Object.isFrozen(descriptor)).toBe(true)
    }
  })

  it('cada almacén de ALMACENES tiene esquema, y el esquema no declara almacenes fantasma', () => {
    // El módulo lo comprueba al cargarse (`comprobarInvariantes`), pero eso se
    // afirma aquí también: es el par que se separa al añadir un almacén (F10).
    expect(Object.keys(ESQUEMA_ALMACENES).sort()).toEqual(Object.values(ALMACENES).sort())
    for (const descriptor of Object.values(ESQUEMA_ALMACENES)) {
      expect(typeof descriptor.keyPath).toBe('string')
      expect(descriptor.keyPath.length).toBeGreaterThan(0)
    }
  })

  it('el keyPath de las parcelas es un campo REAL del POJO del modelo (`refcat`, no `refCatastral`)', () => {
    // La trampa que este proyecto ya conoce: el dossier y la spec de F05 escriben
    // `refCatastral`, pero el vocabulario del código es `refcat` desde F00. No se
    // compara contra la cadena 'refcat' escrita a mano por segunda vez: se
    // comprueba que el keyPath declarado es una clave que el modelo REAL tiene.
    // Si mañana el modelo renombrara el campo, esto se pone rojo — que es
    // exactamente cuando hay que enterarse.
    const parcela = parcelaDeModelo('9398516VK3799G')
    const { keyPath } = ESQUEMA_ALMACENES[ALMACENES.PARCELAS]
    expect(Object.keys(parcela)).toContain(keyPath)
    expect(parcela[keyPath]).toBe('9398516VK3799G')
  })
})

// ── La escalera: versión derivada ────────────────────────────────────────────

describe('storage/bd · la versión sale de la escalera (criterio 4)', () => {
  it('VERSION_BD es exactamente el número de migraciones', () => {
    expect(VERSION_BD).toBe(MIGRACIONES.length)
    // No vacuo: si la escalera se quedara vacía, `VERSION_BD` valdría 0 y
    // `open(nombre, 0)` es un error de rango en IndexedDB.
    expect(MIGRACIONES.length).toBeGreaterThan(0)
  })

  it('las versiones son CONSECUTIVAS empezando en 1 (un hueco sería un fallo silencioso)', () => {
    const esperadas = Array.from({ length: MIGRACIONES.length }, (_, i) => i + 1)
    expect(MIGRACIONES.map((m) => m.version)).toEqual(esperadas)
  })

  it('la escalera y sus peldaños están congelados: la historia no se reescribe', () => {
    expect(Object.isFrozen(MIGRACIONES)).toBe(true)
    for (const migracion of MIGRACIONES) {
      expect(Object.isFrozen(migracion)).toBe(true)
      expect(typeof migracion.aplicar).toBe('function')
    }
  })
})

// ── La escalera: `<`, nunca `===` ────────────────────────────────────────────

describe('storage/bd · la escalera se aplica con `<` y jamás con `===` (criterio 3)', () => {
  // ⚠️ ESTA ES LA PRUEBA QUE SE PONE ROJA SI ALGUIEN CAMBIA EL OPERADOR, y por
  // eso usa una escalera SINTÉTICA de tres peldaños: con la real, de uno solo,
  // `<` y `===` darían el mismo resultado y el guardián sería decorativo.
  // Las tres variantes de `===` que alguien podría escribir, y qué devolvería
  // cada una en el salto 0 → 3, que es el de toda base nueva:
  //   · `versionAnterior === m.version`      → []        (no crea NADA)
  //   · `versionAnterior === m.version - 1`  → [1]       (se queda en el primero)
  //   · `VERSION_BD === m.version`           → [3]       (solo el último)
  // Las tres fallan contra el `toEqual([1, 2, 3])` de aquí abajo, y las tres
  // dejarían la base a medias en producción SIN UN SOLO ERROR.
  const escaleraSintetica = (registro) => [
    peldano(1, registro),
    peldano(2, registro),
    peldano(3, registro),
  ]

  it('una base NUEVA (versión 0) pasa por TODAS las migraciones, en orden', () => {
    const registro = []
    const aplicadas = aplicarMigraciones(bdFalsa(), 0, {
      migraciones: escaleraSintetica(registro),
    })
    expect(aplicadas).toEqual([1, 2, 3])
    expect(registro).toEqual([1, 2, 3])
  })

  it('una base a media escalera solo pasa por los peldaños que le faltan', () => {
    const registro = []
    const aplicadas = aplicarMigraciones(bdFalsa(), 1, {
      migraciones: escaleraSintetica(registro),
    })
    expect(aplicadas).toEqual([2, 3])
    expect(registro).toEqual([2, 3])
  })

  it('una base ya al día no repite ninguna migración', () => {
    const registro = []
    const aplicadas = aplicarMigraciones(bdFalsa(), 3, {
      migraciones: escaleraSintetica(registro),
    })
    expect(aplicadas).toEqual([])
    expect(registro).toEqual([])
  })

  it('la escalera REAL, desde 0, crea exactamente los almacenes declarados con su keyPath', () => {
    // Mismo salto (0 = base nueva) sobre la escalera de verdad, y sin IndexedDB
    // de por medio: se mira lo que la escalera MANDA crear.
    const bd = bdFalsa()
    const aplicadas = aplicarMigraciones(bd, 0)
    expect(aplicadas).toEqual(Array.from({ length: MIGRACIONES.length }, (_, i) => i + 1))
    expect(bd.creados.map((c) => c.nombre).sort()).toEqual(Object.values(ALMACENES).sort())
    for (const creado of bd.creados) {
      expect(creado.keyPath).toBe(ESQUEMA_ALMACENES[creado.nombre].keyPath)
    }
  })

  it('la escalera REAL crea también los ÍNDICES que el esquema declara, y ni uno más', () => {
    // F10 · la otra mitad del guardián, y la que faltaba: hasta esta fase el
    // esquema solo declaraba `keyPath`, así que un índice olvidado en la escalera
    // —o uno de más— no lo veía nadie hasta el primer `getAllFromIndex`, con un
    // `NotFoundError` en otro fichero y en otro momento.
    const bd = bdFalsa()
    aplicarMigraciones(bd, 0)

    for (const creado of bd.creados) {
      const declarados = ESQUEMA_ALMACENES[creado.nombre].indices
      expect(Object.keys(creado.indices).sort()).toEqual(Object.keys(declarados).sort())
      for (const [indice, def] of Object.entries(declarados)) {
        expect(creado.indices[indice]).toEqual({ keyPath: def.keyPath, unique: def.unique })
      }
    }

    // Anti-vacuidad: si el esquema dejara de declarar índices en TODAS partes,
    // el bucle de arriba pasaría comparando vacíos con vacíos y no probaría nada.
    const totalDeclarados = Object.values(ESQUEMA_ALMACENES).reduce(
      (n, e) => n + Object.keys(e.indices).length,
      0,
    )
    expect(totalDeclarados).toBeGreaterThan(0)
  })

  it("'versionAnterior' que no es un entero ≥ 0 es contrato roto por el programador: lanza", () => {
    expect(() => aplicarMigraciones(bdFalsa(), -1)).toThrow(TypeError)
    expect(() => aplicarMigraciones(bdFalsa(), 1.5)).toThrow(TypeError)
    expect(() => aplicarMigraciones(bdFalsa(), null)).toThrow(/entero/)
    expect(() => aplicarMigraciones(bdFalsa(), undefined)).toThrow(/entero/)
  })
})

// ── Apertura sobre una base vacía ────────────────────────────────────────────

describe('storage/bd · apertura con base vacía (criterios 1 y 2)', () => {
  it('crea EXACTAMENTE los almacenes de ALMACENES, con el keyPath que declara el esquema', async () => {
    const modulo = await moduloFresco()
    const fabrica = new IDBFactory() // versión 0: base nueva, la escalera entera
    const resultado = await modulo.abrirBd({ indexedDB: fabrica })

    expect(resultado.disponible).toBe(true)
    expect(resultado.motivo).toBeNull()
    expect(resultado.mensaje).toBeNull()

    const bd = resultado.bd
    expect(bd.name).toBe(modulo.NOMBRE_BD)
    expect(bd.version).toBe(modulo.VERSION_BD)

    // Criterio 1: conjuntos, derivados del objeto congelado. Ni un nombre a mano.
    expect(new Set([...bd.objectStoreNames])).toEqual(new Set(Object.values(modulo.ALMACENES)))

    // Criterio 2: cada almacén con SU keyPath.
    for (const [nombre, { keyPath }] of Object.entries(modulo.ESQUEMA_ALMACENES)) {
      expect(bd.transaction(nombre).store.keyPath).toBe(keyPath)
    }

    // F10 · y con SUS índices, sobre la base de verdad y no sobre la falsa: esta
    // es la comparación que el esquema existe para poder hacer.
    for (const [nombre, { indices }] of Object.entries(modulo.ESQUEMA_ALMACENES)) {
      const almacen = bd.transaction(nombre).store
      expect([...almacen.indexNames].sort()).toEqual(Object.keys(indices).sort())
      for (const [indice, def] of Object.entries(indices)) {
        const real = almacen.index(indice)
        expect(real.keyPath).toBe(def.keyPath)
        expect(real.unique).toBe(def.unique)
      }
    }

    bd.close()
  })

  it('la base se crea en la fábrica INYECTADA y no en la global (la inyección no es decorativa)', async () => {
    // Es la comprobación que sostiene toda la estrategia del módulo: `openDB` de
    // `idb` lee el `indexedDB` GLOBAL y no admite fábrica, así que si alguien lo
    // «simplificara» volviendo a `openDB`, la base aparecería en la global y esta
    // prueba lo diría.
    const modulo = await moduloFresco()
    const fabrica = new IDBFactory()
    const { bd } = await modulo.abrirBd({ indexedDB: fabrica })

    expect(await fabrica.databases()).toEqual([
      { name: modulo.NOMBRE_BD, version: modulo.VERSION_BD },
    ])
    const globales = await globalThis.indexedDB.databases()
    expect(globales.map((d) => d.name)).not.toContain(modulo.NOMBRE_BD)

    bd.close()
  })

  it('guarda y recupera un POJO de parcela del modelo usando su propio campo clave', async () => {
    const modulo = await moduloFresco()
    const { bd } = await modulo.abrirBd({ indexedDB: new IDBFactory() })
    const { keyPath } = modulo.ESQUEMA_ALMACENES[modulo.ALMACENES.PARCELAS]

    const parcela = parcelaDeModelo('9398516VK3799G')
    await bd.put(modulo.ALMACENES.PARCELAS, parcela)
    expect(await bd.get(modulo.ALMACENES.PARCELAS, parcela[keyPath])).toEqual(parcela)

    bd.close()
  })

  it('un registro con `refCatastral` en vez de `refcat` NO se guarda: falla con DataError', async () => {
    // El reverso del guardián de arriba, y la razón de que el nombre importe: si
    // alguien copiara el vocabulario del dossier al guardar, IndexedDB no
    // encontraría la clave y rechazaría el registro. Mejor aquí que en la sesión
    // de un usuario.
    const modulo = await moduloFresco()
    const { bd } = await modulo.abrirBd({ indexedDB: new IDBFactory() })

    await expect(
      bd.put(modulo.ALMACENES.PARCELAS, { refCatastral: '9398516VK3799G' }),
    ).rejects.toThrow(/DataError|requirements/i)

    bd.close()
  })
})

// ── Memoización ──────────────────────────────────────────────────────────────

describe('storage/bd · una sola conexión por proceso (criterio 5)', () => {
  it('dos llamadas devuelven LA MISMA promesa y LA MISMA base, y abren una sola vez', async () => {
    const modulo = await moduloFresco()
    const fabrica = fabricaEspia(new IDBFactory())

    const promesa1 = modulo.abrirBd({ indexedDB: fabrica })
    const promesa2 = modulo.abrirBd({ indexedDB: fabrica })
    expect(promesa2).toBe(promesa1) // identidad, no equivalencia

    const [r1, r2] = await Promise.all([promesa1, promesa2])
    expect(r2.bd).toBe(r1.bd)
    // Y la segunda llamada, ya con la base abierta, tampoco vuelve a abrir.
    await modulo.abrirBd({ indexedDB: fabrica })
    expect(fabrica.peticiones).toHaveLength(1)

    r1.bd.close()
  })

  it('llamar luego con OTRA fábrica lanza: creerías estar abriendo otra base', async () => {
    const modulo = await moduloFresco()
    const fabrica = new IDBFactory()
    const { bd } = await modulo.abrirBd({ indexedDB: fabrica })

    expect(() => modulo.abrirBd({ indexedDB: new IDBFactory() })).toThrow(TypeError)
    expect(() => modulo.abrirBd({ indexedDB: new IDBFactory() })).toThrow(/UNA sola conexión/)

    bd.close()
  })
})

// ── El ciclo multipestaña, por el canal Avisar ───────────────────────────────

describe('storage/bd · blocked/blocking/terminated van al canal Avisar (criterio 6)', () => {
  it('`blocked` llega al avisador con NIVEL.AVISO y la apertura RESUELVE degradada (S1)', async () => {
    // El evento se despacha a mano sobre la petición REAL (ver la cabecera): lo
    // que se comprueba es el CABLEADO —que el módulo escucha `blocked`, lo
    // cuenta, y desde S1 además da la apertura por perdida— sin depender de cómo
    // ordena sus eventos `fake-indexeddb`. El escenario real está más abajo.
    const modulo = await moduloFresco()
    const fabrica = fabricaEspia(new IDBFactory())
    const avisos = vi.fn()

    const promesa = modulo.abrirBd({ indexedDB: fabrica, alAvisar: avisos })
    const peticion = fabrica.peticiones[0]
    peticion.dispatchEvent(new IDBVersionChangeEvent('blocked', { oldVersion: 1, newVersion: 2 }))

    expect(avisos).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = avisos.mock.calls[0]
    expect(detalle.nivel).toBe(NIVEL.AVISO)
    expect(typeof mensaje).toBe('string')
    expect(mensaje.length).toBeGreaterThan(0)
    // El aviso tiene que ACCIONAR: nombra la otra pestaña y qué hacer con ella.
    expect(mensaje).toMatch(/pestaña/i)

    // S1: la apertura no se queda pendiente — resuelve SIN base y con su motivo,
    // que es lo que deja a la caché degradar a CACHE_NULA en vez de colgarse.
    const resultado = await promesa
    expect(resultado.disponible).toBe(false)
    expect(resultado.bd).toBeNull()
    expect(resultado.motivo).toBe(MOTIVO_SIN_BD.BLOQUEADA)
    expect(resultado.mensaje).toMatch(/pestaña/i)
  })

  it('⭐ S1 · un `blocked` REAL (pestaña vieja que no suelta la base) resuelve en vez de colgar', async () => {
    // EL DEFECTO: `abrirBd` devolvía una promesa que con `blocked` no resolvía
    // JAMÁS. `cache-catastro#obtenerBase` la esperaba sin plazo, y como el
    // cliente consulta la caché ANTES que la red (trampa 6 de
    // `services/catastro.js`), «Cargar por RC», colindantes, revgeo y
    // descriptivos no resolvían nunca — ni llegaban a la red. Antes de la
    // corrección, esta prueba se quedaba aquí hasta el timeout de Vitest.
    const modulo = await moduloFresco()
    const fabrica = new IDBFactory()

    // La «pestaña vieja»: una conexión REAL con versión anterior que no escucha
    // `versionchange`, o sea que no va a cerrar nunca por su cuenta. La base se
    // fabrica TAL COMO ERA en F05 (mismo patrón que `pie-firma.test.js`).
    const peticionVieja = fabrica.open(NOMBRE_BD, 1)
    peticionVieja.onupgradeneeded = () => {
      peticionVieja.result.createObjectStore('catastroCache', { keyPath: 'refcat' })
      peticionVieja.result.createObjectStore('revgeo', { keyPath: 'clave' })
    }
    const vieja = await new Promise((resolver, rechazar) => {
      peticionVieja.onsuccess = () => resolver(peticionVieja.result)
      peticionVieja.onerror = () => rechazar(peticionVieja.error)
    })

    const avisos = vi.fn()
    const resultado = await modulo.abrirBd({ indexedDB: fabrica, alAvisar: avisos })

    expect(resultado.disponible).toBe(false)
    expect(resultado.bd).toBeNull()
    expect(resultado.motivo).toBe(MOTIVO_SIN_BD.BLOQUEADA)
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(avisos.mock.calls[0][0]).toMatch(/pestaña/i)
    expect(avisos.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)

    vieja.close()
  })

  it('S1 · el bloqueo NO se memoiza: cerrada la pestaña vieja, la siguiente llamada abre', async () => {
    // Es la misma política que ya tenía cualquier fallo de apertura («solo se
    // memoiza el éxito»): la causa —la otra pestaña— se resuelve sola con el
    // tiempo, y memoizar el bloqueo lo volvería permanente.
    const modulo = await moduloFresco()
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

    const bloqueada = await modulo.abrirBd({ indexedDB: fabrica, alAvisar: () => {} })
    expect(bloqueada.disponible).toBe(false)
    expect(bloqueada.motivo).toBe(MOTIVO_SIN_BD.BLOQUEADA)

    vieja.close()
    const reintento = await modulo.abrirBd({ indexedDB: fabrica, alAvisar: () => {} })
    expect(reintento.disponible).toBe(true)
    // Y la base está ENTERA: la escalera se aplicó pese al primer intento
    // bloqueado (la conexión tardía de aquel intento se cierra sola; esta es nueva).
    expect(new Set([...reintento.bd.objectStoreNames])).toEqual(new Set(Object.values(ALMACENES)))
    reintento.bd.close()
  })

  it('`blocking` (otra pestaña quiere actualizar y se lo impedimos) llega al avisador', async () => {
    // Este SÍ es real: lo emite `fake-indexeddb` cuando otra apertura pide una
    // versión mayor mientras nuestra conexión sigue viva.
    const modulo = await moduloFresco()
    const fabrica = new IDBFactory()
    const avisos = vi.fn()
    const { bd } = await modulo.abrirBd({ indexedDB: fabrica, alAvisar: avisos })
    expect(avisos).not.toHaveBeenCalled() // abrir bien no avisa de nada

    const otraPestana = fabrica.open(NOMBRE_BD, VERSION_BD + 1)
    await esperarA(() => avisos.mock.calls.length > 0, 'el aviso de `blocking`')

    expect(avisos).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = avisos.mock.calls[0]
    expect(detalle.nivel).toBe(NIVEL.AVISO)
    expect(mensaje).toMatch(/recarga/i) // la acción, no solo el diagnóstico

    // Se cierra para que la otra apertura pueda completarse y no quede colgada.
    bd.close()
    await esperarA(
      () => otraPestana.readyState === 'done',
      'que la otra apertura se complete al soltarle la conexión',
    )
    expect(otraPestana.readyState).toBe('done')
    if (otraPestana.result) otraPestana.result.close()
  })

  it('F10 · `alVersionChange` recibe las versiones y un `cerrar()`, y el aviso sale IGUAL', async () => {
    // El reparto que la nota de F05 dejó escrito: este módulo avisa siempre —es el
    // suelo de la regla 1— y ADEMÁS entrega la decisión a quien tenga con qué
    // preguntar. El aviso no se sustituye por el gancho: se suman.
    const modulo = await moduloFresco()
    const fabrica = new IDBFactory()
    const avisos = vi.fn()
    const alVersionChange = vi.fn()
    const { bd } = await modulo.abrirBd({ indexedDB: fabrica, alAvisar: avisos, alVersionChange })

    const otraPestana = fabrica.open(NOMBRE_BD, VERSION_BD + 1)
    await esperarA(() => alVersionChange.mock.calls.length > 0, 'la llamada a alVersionChange')

    expect(avisos).toHaveBeenCalledTimes(1) // el aviso NO desaparece por haber gancho
    expect(alVersionChange).toHaveBeenCalledTimes(1)
    const [evento] = alVersionChange.mock.calls[0]
    expect(evento.versionAnterior).toBe(VERSION_BD)
    expect(evento.versionNueva).toBe(VERSION_BD + 1)
    expect(typeof evento.cerrar).toBe('function')

    // Y `cerrar()` hace lo único que desbloquea a la otra pestaña.
    evento.cerrar()
    await esperarA(() => otraPestana.readyState === 'done', 'que `cerrar()` desbloquee la otra apertura')
    expect(otraPestana.readyState).toBe('done')
    if (otraPestana.result) otraPestana.result.close()
    bd.close()
  })

  it('F10 · SIN `alVersionChange` no se cierra nada: el comportamiento de F05 se conserva', async () => {
    // El reverso del anterior, y la mitad que impide que el gancho cambie por su
    // cuenta lo que hacía la aplicación antes de existir: sin él, se avisa y la
    // otra pestaña SIGUE esperando. Si algún día alguien decide cerrar por
    // defecto, esta prueba se pone roja y obliga a decirlo en voz alta.
    const modulo = await moduloFresco()
    const fabrica = new IDBFactory()
    const avisos = vi.fn()
    const { bd } = await modulo.abrirBd({ indexedDB: fabrica, alAvisar: avisos })

    const otraPestana = fabrica.open(NOMBRE_BD, VERSION_BD + 1)
    await esperarA(() => avisos.mock.calls.length > 0, 'el aviso de `blocking`')
    expect(otraPestana.readyState).not.toBe('done') // sigue bloqueada: no cerramos solos

    bd.close()
    await esperarA(() => otraPestana.readyState === 'done', 'la apertura tras soltar la conexión')
    if (otraPestana.result) otraPestana.result.close()
  })

  it("F10 · un `alVersionChange` que no es función ni null es contrato roto: lanza", async () => {
    const modulo = await moduloFresco()
    expect(() => modulo.abrirBd({ indexedDB: new IDBFactory(), alVersionChange: 42 })).toThrow(
      TypeError,
    )
    expect(() =>
      modulo.abrirBd({ indexedDB: new IDBFactory(), alVersionChange: 'cerrar' }),
    ).toThrow(/alVersionChange/)
  })

  it('una terminación ANORMAL de la conexión llega al avisador', async () => {
    // `forceCloseDatabase` de `fake-indexeddb` es su forma de reproducir lo que
    // en el navegador hace un desalojo por cuota o un borrado de los datos del
    // sitio: dispara `close`, que NO se dispara cuando la cierra uno mismo.
    // `unwrap` tiene que venir de la MISMA generación de `idb` que el módulo
    // recién cargado (sus cachés son por instancia), de ahí el import de aquí.
    const modulo = await moduloFresco()
    const { unwrap } = await import('idb')
    const avisos = vi.fn()
    const { bd } = await modulo.abrirBd({ indexedDB: new IDBFactory(), alAvisar: avisos })

    forceCloseDatabase(unwrap(bd))
    await esperarA(() => avisos.mock.calls.length > 0, 'el aviso de terminación anormal')

    expect(avisos).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = avisos.mock.calls[0]
    expect(detalle.nivel).toBe(NIVEL.AVISO)
    expect(mensaje).toMatch(/recarg/i)
  })

  it('sin avisador, el suelo mínimo es console.warn: nunca el silencio', async () => {
    const modulo = await moduloFresco()
    const fabrica = fabricaEspia(new IDBFactory())
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const promesa = modulo.abrirBd({ indexedDB: fabrica })
      fabrica.peticiones[0].dispatchEvent(
        new IDBVersionChangeEvent('blocked', { oldVersion: 1, newVersion: 2 }),
      )
      expect(warn).toHaveBeenCalledTimes(1)
      // S1: el `blocked` (aunque aquí sea sintético) degrada la apertura.
      const resultado = await promesa
      expect(resultado.disponible).toBe(false)
      expect(resultado.motivo).toBe(MOTIVO_SIN_BD.BLOQUEADA)
    } finally {
      warn.mockRestore()
    }
  })
})

// ── Degradación en un entorno sin IndexedDB ──────────────────────────────────

describe('storage/bd · un entorno sin IndexedDB no revienta la app (criterio 7)', () => {
  it('sin `indexedDB` en el entorno, degrada con motivo, avisa y NO lanza', async () => {
    // Se borra el global para ejercitar el CAMINO POR DEFECTO del parámetro, que
    // es el que recorre la aplicación de verdad. Se restaura pase lo que pase.
    const modulo = await moduloFresco()
    const original = globalThis.indexedDB
    const avisos = vi.fn()
    try {
      delete globalThis.indexedDB
      expect(globalThis.indexedDB).toBeUndefined()

      const resultado = await modulo.abrirBd({ alAvisar: avisos })

      expect(resultado.disponible).toBe(false)
      expect(resultado.bd).toBeNull()
      expect(resultado.motivo).toBe(modulo.MOTIVO_SIN_BD.SIN_INDEXEDDB)
      expect(typeof resultado.mensaje).toBe('string')
      expect(resultado.mensaje.length).toBeGreaterThan(0)
      expect(avisos).toHaveBeenCalledTimes(1)
      expect(avisos.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
      // El mensaje se le puede enseñar al usuario tal cual: dice qué NO va a pasar.
      expect(resultado.mensaje).toMatch(/Catastro|caché|recordar/i)
    } finally {
      globalThis.indexedDB = original
    }
  })

  it('degradar NO se memoiza: una llamada posterior con fábrica de verdad sí abre', async () => {
    // Memoizar el fracaso lo volvería permanente. La memoización es de la
    // CONEXIÓN, no del resultado.
    const modulo = await moduloFresco()
    const fallido = await modulo.abrirBd({ indexedDB: null })
    expect(fallido.motivo).toBe(modulo.MOTIVO_SIN_BD.SIN_INDEXEDDB)

    const bueno = await modulo.abrirBd({ indexedDB: new IDBFactory() })
    expect(bueno.disponible).toBe(true)
    bueno.bd.close()
  })

  it('un objeto que no sabe `open` es un entorno que no puede, no un error de programación', async () => {
    const modulo = await moduloFresco()
    const avisos = vi.fn()
    const resultado = await modulo.abrirBd({ indexedDB: {}, alAvisar: avisos })
    expect(resultado.motivo).toBe(modulo.MOTIVO_SIN_BD.SIN_INDEXEDDB)
    expect(avisos).toHaveBeenCalledTimes(1)
  })

  it('pero pasar basura donde va la fábrica sí es contrato roto: lanza', () => {
    // La línea entre las dos cosas es la FORMA frente a lo que sabe hacer, igual
    // que en `gml/descargar.js` con `url`. Estas dos últimas pruebas lanzan ANTES
    // de abrir nada, así que usan el módulo estático sin ensuciar su memoización.
    expect(() => abrirBd({ indexedDB: 42 })).toThrow(TypeError)
    expect(() => abrirBd({ indexedDB: 'indexedDB' })).toThrow(/fábrica/)
  })

  it('un `alAvisar` que no es función revienta en el acto (regla 1: no se corrige callado)', () => {
    expect(() => abrirBd({ alAvisar: 'avísame' })).toThrow(TypeError)
  })
})

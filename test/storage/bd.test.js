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
 * 3. LA ESCALERA SE PRUEBA CON PELDAÑOS SINTÉTICOS. Hoy `MIGRACIONES` tiene un  *
 *    solo peldaño, y con uno solo NINGUNA prueba puede distinguir `<` de `===`. *
 *    Por eso `aplicarMigraciones` recibe la escalera por parámetro y aquí se le *
 *    pasa una de tres peldaños: es la única forma de que cambiar el operador    *
 *    ponga algo rojo HOY, y no dentro de un año, cuando F10 añada la versión 2. *
 *                                                                              *
 * 4. SE DICE LO QUE `fake-indexeddb` NO PUEDE. Ver el bloque de límites justo   *
 *    debajo: hay una parte del ciclo multipestaña que esta implementación no    *
 *    reproduce, y fingir que está cubierta sería peor que no cubrirla.          *
 *                                                                              *
 * ── LÍMITES MEDIDOS DE `fake-indexeddb` FRENTE AL NAVEGADOR REAL ──            *
 *                                                                              *
 * · `blocked` REAL es HOY INALCANZABLE, y no por culpa de `fake-indexeddb`:     *
 *   ese evento solo se dispara cuando una apertura pide una versión MAYOR que   *
 *   la instalada y hay otra conexión abierta. Como `VERSION_BD` vale 1 (hay una *
 *   sola migración), `abrirBd` nunca pide un ascenso y nunca puede ser          *
 *   bloqueada. Lo que se prueba aquí es EL CABLEADO —que el módulo escucha      *
 *   `blocked` y lo lleva al canal `Avisar` con `NIVEL.AVISO`—, despachando un   *
 *   `IDBVersionChangeEvent('blocked')` sobre la petición real. El día que F10   *
 *   añada la versión 2 el ciclo entero pasa a ser reproducible y esta prueba    *
 *   seguirá valiendo sin tocarla. El ciclo REAL de dos pestañas —dos contextos  *
 *   de navegación distintos compartiendo origen— no lo reproduce ningún proceso *
 *   de Node: eso es materia del guion de humo en navegador.                     *
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

/** Base falsa que solo apunta lo que le mandan crear. Sin IndexedDB de por medio. */
function bdFalsa() {
  const creados = []
  return {
    creados,
    createObjectStore(nombre, opciones) {
      creados.push({ nombre, keyPath: opciones && opciones.keyPath })
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
  it('`blocked` llega al avisador con NIVEL.AVISO y un mensaje presentable', async () => {
    // Ver el bloque de límites de la cabecera: el evento se despacha a mano sobre
    // la petición REAL porque con `VERSION_BD === 1` una apertura nuestra no
    // puede ser bloqueada por nadie. Lo que se comprueba es el CABLEADO: que el
    // módulo escucha `blocked` y lo cuenta, en vez de esperar en silencio.
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

    const { bd } = await promesa
    bd.close()
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
      const { bd } = await promesa
      bd.close()
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

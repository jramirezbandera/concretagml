/* -------------------------------------------------------------------------- *
 * test/storage/autoguardado.test.js — F10 · T3.3 · El debounce                *
 *                                                                            *
 * Lo único que este módulo tiene que garantizar es difícil de ver a ojo, así  *
 * que se afirma con contadores:                                              *
 *                                                                            *
 *   1. **Coalescencia**: N cambios seguidos son UNA escritura, y la que se    *
 *      escribe es la ÚLTIMA. Con anti-vacuidad: se comprueba que sin el       *
 *      debounce habrían sido N.                                              *
 *   2. **Un fallo no para el autoguardado**: se cuenta y el siguiente cambio  *
 *      se escribe con normalidad. Incluido el caso feo, que es que `guardar`  *
 *      LANCE en vez de devolver un resultado — dentro del callback de un      *
 *      temporizador no lo cazaría nadie.                                      *
 *   3. **Dos escrituras no se solapan**: si el temporizador vuelve a saltar   *
 *      con un `put` en vuelo, no salen dos a la misma clave. Es la avería que *
 *      dejaría el estado VIEJO en la base sin que nadie lo notase.            *
 *                                                                            *
 * ⚠️ **Sin `vi.useFakeTimers`.** Este repo tiene cero, y no por gusto: falsear *
 * el tiempo global rompe `fake-indexeddb`, del que viven las otras pruebas de *
 * esta carpeta. Los temporizadores se INYECTAN y aquí se disparan a mano, así *
 * que ninguna prueba espera de verdad ni un milisegundo.                      *
 *                                                                            *
 * Proyecto Vitest `node`.                                                     *
 * -------------------------------------------------------------------------- */

import { describe, expect, it, vi } from 'vitest'

import {
  MS_AUTOGUARDADO,
  MS_AUTOGUARDADO_MAX,
  MS_AUTOGUARDADO_MIN,
  crearAutoguardado,
} from '../../storage/autoguardado.js'

// ── Utillaje: un temporizador de mentira que se dispara a mano ──────────────

/**
 * Un reloj de temporizadores manual. `programar` apunta el callback y devuelve un
 * identificador; `disparar()` ejecuta el que esté vivo. No hay ni un `setTimeout`.
 */
function relojFalso() {
  const pendientes = new Map()
  let siguiente = 1
  let msUltimo = null
  return {
    programar(fn, ms) {
      msUltimo = ms
      const id = siguiente++
      pendientes.set(id, fn)
      return id
    },
    cancelar(id) {
      pendientes.delete(id)
    },
    /** Ejecuta todos los temporizadores vivos. Devuelve cuántos había. */
    disparar() {
      const fns = [...pendientes.values()]
      pendientes.clear()
      for (const fn of fns) fn()
      return fns.length
    },
    get vivos() {
      return pendientes.size
    },
    get msUltimo() {
      return msUltimo
    },
  }
}

/** Un estado cualquiera, distinguible por su número. */
const estado = (n) => ({ n })

/** Deja correr las microtareas pendientes (las promesas de `escribir`). */
const asentar = () => new Promise((r) => queueMicrotask(r))

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La cadencia
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/autoguardado · la cadencia', () => {
  it('MS_AUTOGUARDADO está dentro del rango que declara la ficha (1–3 s)', () => {
    expect(MS_AUTOGUARDADO).toBeGreaterThanOrEqual(MS_AUTOGUARDADO_MIN)
    expect(MS_AUTOGUARDADO).toBeLessThanOrEqual(MS_AUTOGUARDADO_MAX)
    expect(MS_AUTOGUARDADO_MIN).toBe(1000)
    expect(MS_AUTOGUARDADO_MAX).toBe(3000)
  })

  it('⚠️ `ms` NO vive en `config/operativos.json`', async () => {
    // Aquel fichero es de tolerancias geométricas y su test exige el juego de claves
    // exacto. El precedente correcto es `MS_TTL` de `storage/cache-catastro.js`.
    const { OPERATIVOS } = await import('../../config/operativos.js')
    for (const clave of Object.keys(OPERATIVOS)) {
      expect(clave.toLowerCase()).not.toContain('autoguard')
    }
    const { MS_TTL } = await import('../../storage/cache-catastro.js')
    expect(typeof MS_TTL).toBe('number') // el precedente sigue donde decíamos
  })

  it('el temporizador se programa con los milisegundos que se le pasan', () => {
    const reloj = relojFalso()
    const auto = crearAutoguardado({ guardar: vi.fn(), ms: 1234, ...reloj })
    auto.cambiado(estado(1))
    expect(reloj.msUltimo).toBe(1234)
  })

  it('por defecto usa MS_AUTOGUARDADO', () => {
    const reloj = relojFalso()
    const auto = crearAutoguardado({ guardar: vi.fn(), ...reloj })
    auto.cambiado(estado(1))
    expect(reloj.msUltimo).toBe(MS_AUTOGUARDADO)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Coalescencia
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/autoguardado · N cambios, UNA escritura', () => {
  it('⭐ quince cambios seguidos escriben una sola vez, y escriben el ÚLTIMO', async () => {
    const reloj = relojFalso()
    const guardar = vi.fn(async (e) => ({ ok: true, e }))
    const auto = crearAutoguardado({ guardar, ...reloj })

    for (let i = 1; i <= 15; i++) auto.cambiado(estado(i))

    // ANTI-VACUIDAD: los quince cambios han LLEGADO —si no, la prueba mediría que no
    // pasa nada porque no pasó nada— y todavía no se ha escrito ni una vez.
    expect(auto.estado().cambios).toBe(15)
    expect(guardar).not.toHaveBeenCalled()
    // Y solo hay UN temporizador vivo: cada cambio canceló el anterior.
    expect(reloj.vivos).toBe(1)

    reloj.disparar()
    await asentar()

    expect(guardar).toHaveBeenCalledTimes(1)
    expect(guardar).toHaveBeenCalledWith({ n: 15 })
    const e = auto.estado()
    expect(e.escrituras).toBe(1)
    expect(e.guardados).toBe(1)
    expect(e.cambios - e.escrituras).toBe(14) // lo que el debounce ha ahorrado
  })

  it('después de escribir, el siguiente cambio vuelve a programar', async () => {
    const reloj = relojFalso()
    const guardar = vi.fn(async () => ({ ok: true }))
    const auto = crearAutoguardado({ guardar, ...reloj })

    auto.cambiado(estado(1))
    reloj.disparar()
    await asentar()
    expect(guardar).toHaveBeenCalledTimes(1)

    auto.cambiado(estado(2))
    reloj.disparar()
    await asentar()
    expect(guardar).toHaveBeenCalledTimes(2)
    expect(guardar).toHaveBeenLastCalledWith({ n: 2 })
  })

  it('un disparo sin cambios pendientes no escribe nada', async () => {
    const reloj = relojFalso()
    const guardar = vi.fn(async () => ({ ok: true }))
    const auto = crearAutoguardado({ guardar, ...reloj })
    auto.cambiado(estado(1))
    reloj.disparar()
    await asentar()
    // El temporizador no se reprograma solo: esto no es un intervalo.
    expect(reloj.vivos).toBe(0)
    expect(guardar).toHaveBeenCalledTimes(1)
  })

  it('`estado()` devuelve una FOTO, no una referencia que cambia sola', async () => {
    const reloj = relojFalso()
    const auto = crearAutoguardado({ guardar: async () => ({ ok: true }), ...reloj })
    auto.cambiado(estado(1))
    const antes = auto.estado()
    reloj.disparar()
    await asentar()
    expect(antes.guardados).toBe(0)
    expect(auto.estado().guardados).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Un fallo no para el autoguardado
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/autoguardado · los fallos se cuentan y se sigue', () => {
  it('un `{ok:false}` se cuenta y NO cancela la siguiente escritura', async () => {
    const reloj = relojFalso()
    const fallos = []
    let toca = 'mal'
    const guardar = vi.fn(async () => (toca === 'mal' ? { ok: false, motivo: 'X' } : { ok: true }))
    const auto = crearAutoguardado({ guardar, ...reloj, alFallo: (i) => fallos.push(i) })

    auto.cambiado(estado(1))
    reloj.disparar()
    await asentar()
    expect(auto.estado().fallos).toBe(1)
    expect(auto.estado().consecutivos).toBe(1)
    expect(fallos[0].resultado).toEqual({ ok: false, motivo: 'X' })

    // Segundo intento, también mal: los consecutivos suben.
    auto.cambiado(estado(2))
    reloj.disparar()
    await asentar()
    expect(auto.estado().consecutivos).toBe(2)

    // Y el tercero va bien: los consecutivos se ponen a cero, el total NO.
    toca = 'bien'
    auto.cambiado(estado(3))
    reloj.disparar()
    await asentar()
    const e = auto.estado()
    expect(e.guardados).toBe(1)
    expect(e.fallos).toBe(2)
    expect(e.consecutivos).toBe(0)
    expect(e.ultimoError).toBeNull()
  })

  it('⭐ un `guardar` que LANZA no mata el autoguardado ni suelta un rechazo', async () => {
    // Dentro del callback de un temporizador nadie caza un throw: se convertiría en un
    // rechazo no gestionado y el autoguardado moriría en silencio. `guardarBorrador`
    // lanza de verdad cuando el expediente no pasa `crearExpediente`.
    const reloj = relojFalso()
    const fallos = []
    let explota = true
    const guardar = vi.fn(async () => {
      if (explota) throw new TypeError('expediente inválido')
      return { ok: true }
    })
    const auto = crearAutoguardado({ guardar, ...reloj, alFallo: (i) => fallos.push(i) })

    auto.cambiado(estado(1))
    expect(() => reloj.disparar()).not.toThrow()
    await asentar()

    expect(auto.estado().fallos).toBe(1)
    expect(auto.estado().ultimoError).toBeInstanceOf(TypeError)
    expect(fallos[0].causa).toBeInstanceOf(TypeError)
    expect(fallos[0].resultado).toBeNull()

    // Y sigue vivo.
    explota = false
    auto.cambiado(estado(2))
    reloj.disparar()
    await asentar()
    expect(auto.estado().guardados).toBe(1)
  })

  it('un `guardar` SÍNCRONO que no devuelve nada se toma por bueno', async () => {
    // Para que un doble sencillo no tenga que fingir la forma de `ResultadoGuardar`.
    const reloj = relojFalso()
    const guardar = vi.fn(() => undefined)
    const auto = crearAutoguardado({ guardar, ...reloj })
    auto.cambiado(estado(1))
    reloj.disparar()
    await asentar()
    expect(auto.estado().guardados).toBe(1)
    expect(auto.estado().fallos).toBe(0)
  })

  it('`alGuardado` se llama en cada acierto, con el resultado dentro', async () => {
    const reloj = relojFalso()
    const vistos = []
    const auto = crearAutoguardado({
      guardar: async () => ({ ok: true, registro: { id: 'EXP-x' } }),
      ...reloj,
      alGuardado: (i) => vistos.push(i),
    })
    auto.cambiado(estado(1))
    reloj.disparar()
    await asentar()
    expect(vistos).toHaveLength(1)
    expect(vistos[0].resultado.registro.id).toBe('EXP-x')
  })

  it('sin `alFallo` ni `alGuardado`, un fallo tampoco revienta', async () => {
    const reloj = relojFalso()
    const auto = crearAutoguardado({ guardar: async () => ({ ok: false }), ...reloj })
    auto.cambiado(estado(1))
    expect(() => reloj.disparar()).not.toThrow()
    await asentar()
    expect(auto.estado().fallos).toBe(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Dos escrituras no se solapan
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/autoguardado · nunca dos `put` a la vez sobre la misma clave', () => {
  it('⭐ un cambio durante una escritura en vuelo NO lanza una segunda', async () => {
    // Es la avería que dejaría el estado VIEJO en la base: dos escrituras a la misma
    // clave, y gana la que resuelva la última, que no tiene por qué ser la más nueva.
    const reloj = relojFalso()
    let resolver
    const guardar = vi.fn(() => new Promise((r) => (resolver = r)))
    const auto = crearAutoguardado({ guardar, ...reloj })

    auto.cambiado(estado(1))
    reloj.disparar() // arranca la escritura de {n:1}; se queda en vuelo
    await asentar()
    expect(guardar).toHaveBeenCalledTimes(1)
    expect(auto.estado().enVuelo).toBe(true)

    // Llegan más cambios con la escritura en vuelo: NO se programa nada todavía.
    auto.cambiado(estado(2))
    auto.cambiado(estado(3))
    expect(reloj.vivos).toBe(0)
    expect(guardar).toHaveBeenCalledTimes(1)

    // Cuando la primera termina, ENTONCES se programa la siguiente.
    resolver({ ok: true })
    await asentar()
    await asentar()
    expect(reloj.vivos).toBe(1)
    expect(auto.estado().enVuelo).toBe(false)

    resolver = undefined
    reloj.disparar()
    await asentar()
    expect(guardar).toHaveBeenCalledTimes(2)
    expect(guardar).toHaveBeenLastCalledWith({ n: 3 }) // el último, no el {n:2}
  })

  it('la escritura pendiente se reprograma incluso si la anterior FALLÓ', async () => {
    const reloj = relojFalso()
    let rechazar
    const guardar = vi.fn(() => new Promise((_r, rj) => (rechazar = rj)))
    const auto = crearAutoguardado({ guardar, ...reloj })

    auto.cambiado(estado(1))
    reloj.disparar()
    await asentar()
    auto.cambiado(estado(2))

    rechazar(new Error('la base se ha ido'))
    await asentar()
    await asentar()
    expect(auto.estado().fallos).toBe(1)
    expect(reloj.vivos).toBe(1) // lo pendiente sigue programado
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · `ahoraMismo`, `olvidar` y `destruir`
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/autoguardado · las tres salidas', () => {
  it('`ahoraMismo()` escribe sin esperar al temporizador', async () => {
    const reloj = relojFalso()
    const guardar = vi.fn(async () => ({ ok: true }))
    const auto = crearAutoguardado({ guardar, ...reloj })

    auto.cambiado(estado(7))
    expect(reloj.vivos).toBe(1)
    await auto.ahoraMismo()

    expect(guardar).toHaveBeenCalledWith({ n: 7 })
    expect(reloj.vivos).toBe(0) // y el temporizador se ha cancelado, no duplicado
  })

  it('`ahoraMismo()` sin nada pendiente devuelve `null` y no escribe', async () => {
    const reloj = relojFalso()
    const guardar = vi.fn(async () => ({ ok: true }))
    const auto = crearAutoguardado({ guardar, ...reloj })
    expect(await auto.ahoraMismo()).toBeNull()
    expect(guardar).not.toHaveBeenCalled()
  })

  it('`ahoraMismo()` con una escritura en vuelo espera a la anterior y escribe la nueva', async () => {
    const reloj = relojFalso()
    let resolver
    const guardar = vi.fn(() => new Promise((r) => (resolver = r)))
    const auto = crearAutoguardado({ guardar, ...reloj })

    auto.cambiado(estado(1))
    reloj.disparar()
    await asentar()
    auto.cambiado(estado(2))

    const flush = auto.ahoraMismo()
    resolver({ ok: true })
    resolver = undefined
    // La segunda llamada a `guardar` devuelve una promesa nueva que nadie resuelve, así
    // que solo se comprueba que SE HA LLAMADO, no que termine.
    await asentar()
    await asentar()
    expect(guardar).toHaveBeenCalledTimes(2)
    expect(guardar).toHaveBeenLastCalledWith({ n: 2 })
    expect(flush).toBeInstanceOf(Promise)
  })

  it('`olvidar()` tira lo pendiente sin escribirlo', async () => {
    const reloj = relojFalso()
    const guardar = vi.fn(async () => ({ ok: true }))
    const auto = crearAutoguardado({ guardar, ...reloj })

    auto.cambiado(estado(1))
    auto.olvidar()
    expect(reloj.vivos).toBe(0)
    expect(auto.estado().pendiente).toBe(false)
    reloj.disparar()
    await asentar()
    expect(guardar).not.toHaveBeenCalled()
    // Y `ahoraMismo()` tampoco lo resucita: «descartar» es descartar.
    expect(await auto.ahoraMismo()).toBeNull()
  })

  it('`destruir()` apaga el autoguardado y NO escribe lo pendiente', async () => {
    const reloj = relojFalso()
    const guardar = vi.fn(async () => ({ ok: true }))
    const auto = crearAutoguardado({ guardar, ...reloj })

    auto.cambiado(estado(1))
    auto.destruir()
    expect(reloj.vivos).toBe(0)

    // Y después de destruido, un cambio nuevo no programa nada.
    auto.cambiado(estado(2))
    expect(reloj.vivos).toBe(0)
    expect(auto.estado().cambios).toBe(1) // el segundo ni se ha contado
    reloj.disparar()
    await asentar()
    expect(guardar).not.toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · La frontera: el programador revienta
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/autoguardado · contrato roto por el programador', () => {
  it('sin `guardar` no se construye: sería un temporizador que no guarda nada', () => {
    expect(() => crearAutoguardado({})).toThrow(TypeError)
    expect(() => crearAutoguardado({ guardar: 'sí' })).toThrow(TypeError)
    expect(() => crearAutoguardado()).toThrow(TypeError)
    expect(() => crearAutoguardado(null)).toThrow(TypeError)
    expect(() => crearAutoguardado([])).toThrow(TypeError)
  })

  it('unos temporizadores que no son funciones lanzan', () => {
    const g = () => {}
    expect(() => crearAutoguardado({ guardar: g, programar: 1 })).toThrow(TypeError)
    expect(() => crearAutoguardado({ guardar: g, cancelar: 1 })).toThrow(TypeError)
    expect(() => crearAutoguardado({ guardar: g, ahora: 1 })).toThrow(TypeError)
    expect(() => crearAutoguardado({ guardar: g, alFallo: 1 })).toThrow(TypeError)
    expect(() => crearAutoguardado({ guardar: g, alGuardado: 1 })).toThrow(TypeError)
  })

  it('un `ms` que no es un número positivo lanza RangeError', () => {
    const g = () => {}
    for (const ms of [0, -1, NaN, Infinity, '2000', null]) {
      expect(() => crearAutoguardado({ guardar: g, ms })).toThrow(RangeError)
    }
  })

  it('`ultimoGuardadoEn` sale del `ahora` inyectado, no del reloj del sistema', async () => {
    const reloj = relojFalso()
    const auto = crearAutoguardado({
      guardar: async () => ({ ok: true }),
      ...reloj,
      ahora: () => 1_754_000_000_000,
    })
    auto.cambiado(estado(1))
    reloj.disparar()
    await asentar()
    expect(auto.estado().ultimoGuardadoEn).toBe(1_754_000_000_000)
  })
})

// test/storage/cuota.test.js — F10 · T1.2.
//
// Proyecto Vitest `node`, sin sufijo `.dom`: este módulo no toca el DOM. Lo que sí
// necesita es un `StorageManager`, que en Node no existe — de ahí que
// `crearCuota` lo reciba inyectado, y de ahí que estas pruebas puedan existir.
//
// ── QUÉ SE PRUEBA AQUÍ Y QUÉ NO ──────────────────────────────────────────────
// Aquí se prueba el CONTRATO: qué devuelve cada rama, qué llega al canal de avisos
// y qué NO llega. Lo que NO se puede probar aquí es el comportamiento del navegador
// de verdad —si concede la persistencia, qué cuota da—: eso se midió en la fase 0
// con `/browse` y está escrito en la cabecera del módulo (`persist()` → `false`,
// cuota 1,82 GB). Un doble no puede confirmar un hecho externo; solo puede
// confirmar que reaccionamos bien a él.

import { describe, expect, it, vi } from 'vitest'

import { NIVEL } from '../../viewer/_comun.js'
import {
  AVISO_SIN_PERSISTENCIA,
  MOTIVO_CUOTA,
  crearCuota,
  esCuotaExcedida,
} from '../../storage/cuota.js'

/** Un `StorageManager` de mentira, con las respuestas que se le pidan. */
function gestor({ persist, persisted, estimate } = {}) {
  const g = {}
  if (persist !== undefined) g.persist = typeof persist === 'function' ? persist : async () => persist
  if (persisted !== undefined) {
    g.persisted = typeof persisted === 'function' ? persisted : async () => persisted
  }
  if (estimate !== undefined) {
    g.estimate = typeof estimate === 'function' ? estimate : async () => estimate
  }
  return g
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · esCuotaExcedida — el predicado, que es lo que dispara la degradación
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/cuota · esCuotaExcedida reconoce el error por name/code, NUNCA por el texto', () => {
  it('reconoce las tres formas vivas del error', () => {
    expect(esCuotaExcedida({ name: 'QuotaExceededError' })).toBe(true)
    expect(esCuotaExcedida({ name: 'NS_ERROR_DOM_QUOTA_REACHED' })).toBe(true)
    expect(esCuotaExcedida({ code: 22 })).toBe(true) // QUOTA_EXCEEDED_ERR heredado
    expect(esCuotaExcedida({ code: 1014 })).toBe(true) // Firefox
  })

  it('reconoce un DOMException de verdad, no solo un objeto con las claves', () => {
    // `DOMException` sí existe en Node desde la v17, así que esta comprobación no
    // depende de un doble: es la forma REAL que llegará por el `catch`.
    const real = new DOMException('la cuota se ha agotado', 'QuotaExceededError')
    expect(real.name).toBe('QuotaExceededError')
    expect(esCuotaExcedida(real)).toBe(true)
  })

  it('⚠️ NO se deja engañar por el texto, ni en inglés ni en castellano', () => {
    // Es el punto entero de la función. Un `mensaje.includes('quota')` daría
    // `true` a los dos de abajo y `false` a un QuotaExceededError en castellano,
    // y el fallo sería que la degradación NO se dispara: silencio justo cuando
    // más falta hace.
    expect(esCuotaExcedida(new Error('quota exceeded'))).toBe(false)
    expect(esCuotaExcedida(new Error('se ha superado la cuota de almacenamiento'))).toBe(false)
    expect(esCuotaExcedida(new DOMException('quota', 'InvalidStateError'))).toBe(false)
  })

  it('no lanza con basura: null, undefined, cadenas y números son «no»', () => {
    for (const v of [null, undefined, '', 'QuotaExceededError', 22, 0, NaN, true, []]) {
      expect(esCuotaExcedida(v)).toBe(false)
    }
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · pedirPersistencia
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/cuota · pedirPersistencia', () => {
  it('concedida: ok, persistido, y ni motivo ni mensaje', async () => {
    const cuota = crearCuota({ almacenamiento: gestor({ persist: true, persisted: false }) })
    expect(await cuota.pedirPersistencia()).toEqual({
      ok: true, persistido: true, yaEstaba: false, motivo: null, mensaje: null, causa: null,
    })
  })

  it('distingue «la he conseguido» de «ya estaba»', async () => {
    // Sin `yaEstaba` no habría forma de saberlo, y la interfaz acabaría contándole
    // al usuario un logro que no ha ocurrido.
    const cuota = crearCuota({ almacenamiento: gestor({ persist: true, persisted: true }) })
    const r = await cuota.pedirPersistencia()
    expect(r.persistido).toBe(true)
    expect(r.yaEstaba).toBe(true)
  })

  it('DENEGADA es ok:true — la pregunta funcionó, la respuesta fue que no', async () => {
    // Es el caso MEDIDO y el normal: `persist()` devuelve false sin preguntar nada.
    // Que salga con `ok: true` no es un descuido: separa «no se ha podido
    // preguntar» de «se preguntó y dijo que no», que exigen respuestas distintas.
    const cuota = crearCuota({ almacenamiento: gestor({ persist: false, persisted: false }) })
    const r = await cuota.pedirPersistencia()
    expect(r).toEqual({
      ok: true,
      persistido: false,
      yaEstaba: false,
      motivo: MOTIVO_CUOTA.DENEGADA,
      mensaje: AVISO_SIN_PERSISTENCIA,
      causa: null,
    })
  })

  it('⚠️ una denegación NO va al canal de avisos: es el estado normal, no un incidente', async () => {
    // Si avisara, cada usuario vería un aviso en el panel en CADA carga, porque el
    // «no» es lo que devuelve el 100 % de las visitas nuevas (medido en la fase 0).
    const avisos = vi.fn()
    const cuota = crearCuota({ almacenamiento: gestor({ persist: false, persisted: false }), alAvisar: avisos })
    await cuota.pedirPersistencia()
    expect(avisos).not.toHaveBeenCalled()
  })

  it('sin API: SIN_API, sin lanzar y sin avisar', async () => {
    for (const almacenamiento of [undefined, null, {}, gestor({ estimate: {} })]) {
      const avisos = vi.fn()
      const cuota = crearCuota({ almacenamiento, alAvisar: avisos })
      const r = await cuota.pedirPersistencia()
      expect(r.ok).toBe(false)
      expect(r.persistido).toBe(false)
      expect(r.motivo).toBe(MOTIVO_CUOTA.SIN_API)
      expect(r.mensaje).toMatch(/navegador/i)
      expect(avisos).not.toHaveBeenCalled()
    }
  })

  it('si la llamada LANZA, eso sí es anómalo: motivo ERROR y aviso por el canal', async () => {
    const avisos = vi.fn()
    const explota = new DOMException('no puede ser', 'SecurityError')
    const cuota = crearCuota({
      almacenamiento: gestor({ persist: () => Promise.reject(explota), persisted: false }),
      alAvisar: avisos,
    })
    const r = await cuota.pedirPersistencia()

    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CUOTA.ERROR)
    expect(r.causa).toBe(explota)
    expect(r.mensaje).toContain('SecurityError')
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(avisos.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('un `persisted()` roto NO hunde la petición: se pide igual y `yaEstaba` queda en null', async () => {
    // La persistencia es lo que se quiere; saber si ya estaba concedida es un
    // extra. Arrastrar la petición principal detrás de un dato accesorio roto
    // daría un resultado peor que no haberlo preguntado nunca.
    const avisos = vi.fn()
    const cuota = crearCuota({
      almacenamiento: gestor({ persist: true, persisted: () => Promise.reject(new Error('nope')) }),
      alAvisar: avisos,
    })
    const r = await cuota.pedirPersistencia()
    expect(r.ok).toBe(true)
    expect(r.persistido).toBe(true)
    expect(r.yaEstaba).toBeNull() // «no se pudo saber», que es lo que pasó
    expect(avisos).not.toHaveBeenCalled()
  })

  it('sin `persisted()` en la API, `yaEstaba` es null y la petición sigue adelante', async () => {
    const r = await crearCuota({ almacenamiento: gestor({ persist: true }) }).pedirPersistencia()
    expect(r.ok).toBe(true)
    expect(r.persistido).toBe(true)
    expect(r.yaEstaba).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · medir
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/cuota · medir', () => {
  it('devuelve uso, cuota y la fracción ya calculada', async () => {
    // Las cifras son las MEDIDAS en la fase 0: 1.863,5 MB de cuota.
    const cuota = crearCuota({
      almacenamiento: gestor({ estimate: { usage: 186_350, quota: 1_954_120_192 } }),
    })
    const r = await cuota.medir()
    expect(r.ok).toBe(true)
    expect(r.usoBytes).toBe(186_350)
    expect(r.cuotaBytes).toBe(1_954_120_192)
    expect(r.fraccion).toBeCloseTo(186_350 / 1_954_120_192, 12)
    expect(r.motivo).toBeNull()
  })

  it('cuota 0 no divide por cero: `fraccion` es null', async () => {
    const cuota = crearCuota({ almacenamiento: gestor({ estimate: { usage: 10, quota: 0 } }) })
    const r = await cuota.medir()
    expect(r.ok).toBe(true)
    expect(r.cuotaBytes).toBe(0)
    expect(r.fraccion).toBeNull() // ni Infinity ni NaN colándose en la interfaz
  })

  it('cifras ausentes o no finitas se declaran null, no se inventan', async () => {
    for (const est of [{}, { usage: undefined, quota: undefined }, { usage: NaN, quota: Infinity }]) {
      const r = await crearCuota({ almacenamiento: gestor({ estimate: est }) }).medir()
      expect(r.usoBytes).toBeNull()
      expect(r.cuotaBytes).toBeNull()
      expect(r.fraccion).toBeNull()
    }
  })

  it('sin API: SIN_API, sin lanzar y sin avisar', async () => {
    const avisos = vi.fn()
    const r = await crearCuota({ almacenamiento: {}, alAvisar: avisos }).medir()
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CUOTA.SIN_API)
    expect(avisos).not.toHaveBeenCalled()
  })

  it('si `estimate()` lanza: motivo ERROR y aviso por el canal', async () => {
    const avisos = vi.fn()
    const r = await crearCuota({
      almacenamiento: gestor({ estimate: () => Promise.reject(new Error('vaya')) }),
      alAvisar: avisos,
    }).medir()
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_CUOTA.ERROR)
    expect(avisos).toHaveBeenCalledTimes(1)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · La frontera: el entorno degrada, el programador revienta
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/cuota · contrato roto por el programador', () => {
  it("un 'almacenamiento' que no es objeto ni nulo lanza TypeError", () => {
    expect(() => crearCuota({ almacenamiento: 42 })).toThrow(TypeError)
    expect(() => crearCuota({ almacenamiento: 'navigator.storage' })).toThrow(/StorageManager/)
  })

  it("un 'alAvisar' que no es función ni nulo lanza (lo hace resolverAvisar)", () => {
    expect(() => crearCuota({ almacenamiento: {}, alAvisar: 'avísame' })).toThrow(TypeError)
  })

  it('null y undefined SÍ valen: son «este entorno no lo tiene», que es legítimo', () => {
    expect(() => crearCuota({ almacenamiento: null })).not.toThrow()
    expect(() => crearCuota({ almacenamiento: undefined })).not.toThrow()
    expect(() => crearCuota()).not.toThrow() // en Node, `navigator.storage` no existe
  })
})

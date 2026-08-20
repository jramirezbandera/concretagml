/* -------------------------------------------------------------------------- *
 * test/storage/expedientes.test.js — F10 · T2.1 · los expedientes guardados   *
 *                                                                            *
 * Este almacén guarda MÁS que ninguno de los anteriores: la geometría de      *
 * fincas concretas y sus referencias catastrales. Los cinco fallos que este   *
 * fichero existe para impedir:                                               *
 *                                                                            *
 *   1. ⭐ Que lo recuperado vuelva SIN CONGELAR. IndexedDB clona con el        *
 *      algoritmo estructurado y `structuredClone` no preserva `Object.freeze`:*
 *      la barrera de la regla de oro 2 desaparecería en silencio, justo antes *
 *      de un diagnóstico que usa `geometriaOficial` como término de           *
 *      comparación. La prueba comprueba las DOS mitades: que el peligro es    *
 *      real en este arnés, y que `recuperar` lo repara.                       *
 *   2. Que la lista salga DEL REVÉS. Medido en la fase 0: el índice devuelve  *
 *      el más antiguo primero, y una lista al revés parece perfectamente      *
 *      normal hasta que alguien busca lo que acaba de guardar.                *
 *   3. Que se guarde MÁS de lo que se dice que se guarda. Se comparan         *
 *      CONJUNTOS de claves derivados del contrato, no una lista a mano.       *
 *   4. Que el borrador del autoguardado se cuele en la lista de expedientes   *
 *      guardados y la haga crecer sola mientras el usuario dibuja.            *
 *   5. Que un registro que el índice no ve desaparezca de la lista SIN QUE    *
 *      NADIE LO DIGA. Es el silencio que la regla de oro 1 prohíbe.           *
 *                                                                            *
 * ── PROYECTO `node`, SIN SUFIJO `.dom` ──                                    *
 * `fake-indexeddb` es JavaScript puro. Mismo criterio que los otros ficheros  *
 * de `test/storage/`, copiado de ellos.                                       *
 * -------------------------------------------------------------------------- */

import 'fake-indexeddb/auto'
import { IDBFactory } from 'fake-indexeddb'
import { describe, expect, it, vi } from 'vitest'

import { crearEdificio } from '../../model/edificio.js'
import { TIPO_EXPEDIENTE, crearExpediente, crearParcela } from '../../model/parcela.js'
import { ALMACENES, ESQUEMA_ALMACENES } from '../../storage/bd.js'
import {
  AVISO_DURABILIDAD,
  CAMPOS_REGISTRO,
  ID_BORRADOR,
  ID_BORRADOR_EDIFICIO,
  ID_BORRADOR_POR_TIPO,
  MOTIVO_EXPEDIENTES,
  NO_SE_GUARDA,
  crearExpedientes,
} from '../../storage/expedientes.js'
import { NIVEL } from '../../viewer/_comun.js'

// ── Utillaje ────────────────────────────────────────────────────────────────

/** Una base recién creada, en su propio universo. */
async function baseNueva() {
  vi.resetModules()
  const { abrirBd } = await import('../../storage/bd.js')
  const apertura = await abrirBd({ indexedDB: new IDBFactory() })
  expect(apertura.disponible, 'el arnés no ha conseguido abrir la base').toBe(true)
  return apertura
}

/** Un anillo cuadrado de `lado` metros, en UTM 30N realista. */
const anillo = (lado, dx = 0) => [
  [440123.45 + dx, 4470987.65],
  [440123.45 + dx + lado, 4470987.65],
  [440123.45 + dx + lado, 4470987.65 + lado],
  [440123.45 + dx, 4470987.65 + lado],
]

/** Un Expediente del modelo REAL, con geometría oficial (que es la que se congela). */
function expedienteDePrueba({ refcat = '9398516VK3799G', dx = 0 } = {}) {
  return crearExpediente({
    srs: 'EPSG:25830',
    parcela: crearParcela({
      idLocal: `ES.LOCAL.CP.${refcat}`,
      refcat,
      recintos: [{ vertices: anillo(40, dx), tipo: 'EXTERIOR' }],
      geometriaOficial: [{ vertices: anillo(40), tipo: 'EXTERIOR' }],
      superficieCatastral: 1600,
      origen: 'WFS',
    }),
  })
}

/** Su gemelo en la rama EDIFICIO (F12 · T4.3). Con identidad, como entra en producción. */
function expedienteDeEdificio({ refcat = 'EDIF-RC', idLocal = 'EDIF-1' } = {}) {
  return crearExpediente({
    tipo: TIPO_EXPEDIENTE.EDIFICIO,
    srs: 'EPSG:25830',
    edificio: crearEdificio({
      idLocal,
      refcat,
      partes: [
        {
          nombre: 'cuerpo principal',
          origen: 'DXF',
          recinto: { tipo: 'EXTERIOR', vertices: anillo(20) },
        },
      ],
    }),
  })
}

/**
 * Envuelve una base real haciendo que una operación RECHACE. Es cómo se simula la
 * cuota agotada: `fake-indexeddb` no tiene límite de memoria que agotar, y en el
 * navegador la situación es exactamente esta — se lee lo de antes, no se escribe lo
 * nuevo. Proxia las CINCO operaciones que el duck typing de `esBase` exige: con
 * menos, el módulo diría «esto no sabe hacer de base» y la prueba mediría otra cosa.
 */
function baseQueFallaEn(bd, operacion, error = new DOMException('lleno', 'QuotaExceededError')) {
  const proxy = {
    get: (...a) => bd.get(...a),
    put: (...a) => bd.put(...a),
    delete: (...a) => bd.delete(...a),
    count: (...a) => bd.count(...a),
    getAllFromIndex: (...a) => bd.getAllFromIndex(...a),
  }
  proxy[operacion] = async () => {
    throw error
  }
  return proxy
}

/** Un reloj que avanza un minuto en cada lectura: fija el orden sin depender del sistema. */
function relojQueAvanza(desde = Date.UTC(2026, 7, 3, 10, 0, 0)) {
  let t = desde
  return () => {
    const v = t
    t += 60_000
    return v
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 1 · El criterio 1 entero: guardar → listar → recuperar → duplicar
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/expedientes · guardar → listar → recuperar → duplicar (criterio 1)', () => {
  it('el ciclo completo conserva el modelo, hasta la última coordenada', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const original = expedienteDePrueba()

    const guardado = await exp.guardar(original, { nombre: 'Linde norte' })
    expect(guardado.ok).toBe(true)
    expect(guardado.registro.nombre).toBe('Linde norte')
    expect(guardado.registro.refcat).toBe('9398516VK3799G')
    expect(guardado.registro.srs).toBe('EPSG:25830')
    expect(guardado.registro.id).toMatch(/^EXP-/) // empieza por letra, nunca la RC desnuda

    const listado = await exp.listar()
    expect(listado.ok).toBe(true)
    expect(listado.registros).toHaveLength(1)
    expect(listado.registros[0].id).toBe(guardado.registro.id)
    // La cabecera de la lista NO arrastra el expediente entero: la lista se pinta
    // sin cargar geometría de todo lo guardado.
    expect(listado.registros[0]).not.toHaveProperty('expediente')

    const recuperado = await exp.recuperar(guardado.registro.id)
    expect(recuperado.ok).toBe(true)
    expect(recuperado.expediente).toEqual(original)

    const copia = await exp.duplicar(guardado.registro.id)
    expect(copia.ok).toBe(true)
    expect(copia.registro.id).not.toBe(guardado.registro.id)
    expect(copia.registro.nombre).toBe('Linde norte (copia)')

    const tras = await exp.listar()
    expect(tras.registros).toHaveLength(2)
    // Y la copia es una copia de VERDAD: tocar una no toca la otra.
    const a = await exp.recuperar(guardado.registro.id)
    const b = await exp.recuperar(copia.registro.id)
    expect(b.expediente).toEqual(a.expediente)
    expect(b.expediente).not.toBe(a.expediente)

    bd.close()
  })

  it('guardar sobre el MISMO id pisa, conserva `creado` y mueve `actualizado`', async () => {
    // Guardar otra vez no es crear otra vez: si `creado` se reescribiera, la lista
    // mentiría sobre cuándo empezó el trabajo.
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    const uno = await exp.guardar(expedienteDePrueba(), { nombre: 'v1' })
    const dos = await exp.guardar(expedienteDePrueba({ dx: 5 }), { nombre: 'v2', id: uno.registro.id })

    expect(dos.registro.id).toBe(uno.registro.id)
    expect(dos.registro.creado).toBe(uno.registro.creado)
    expect(dos.registro.actualizado).not.toBe(uno.registro.actualizado)
    expect((await exp.listar()).registros).toHaveLength(1) // pisó, no duplicó

    bd.close()
  })

  it('sin nombre, el rótulo es la referencia catastral; y sin referencia, lo DICE', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    const con = await exp.guardar(expedienteDePrueba({ refcat: '1234567AB1234C' }))
    expect(con.registro.nombre).toBe('1234567AB1234C')

    const sin = await exp.guardar(
      crearExpediente({
        srs: 'EPSG:25830',
        parcela: crearParcela({ idLocal: 'x', refcat: null, recintos: [{ vertices: anillo(10), tipo: 'EXTERIOR' }], origen: 'DXF' }),
      }),
    )
    expect(sin.registro.refcat).toBeNull()
    expect(sin.registro.nombre).toBe('Parcela sin referencia') // no un hueco mudo

    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 2 · ⭐ La congelación, que es el hallazgo medido de la fase 0
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/expedientes · la geometría oficial vuelve CONGELADA (regla de oro 2)', () => {
  it('el peligro es REAL en este arnés: el registro crudo vuelve sin congelar', async () => {
    // La mitad anti-vacuidad, y va PRIMERO: si `fake-indexeddb` conservara el
    // `Object.freeze`, la prueba de abajo pasaría sin demostrar nada y el defecto
    // aparecería solo en el navegador. Aquí se comprueba que el arnés reproduce el
    // problema que se midió en Chrome el 2026-08-03.
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const original = expedienteDePrueba()

    expect(Object.isFrozen(original.parcela.geometriaOficial)).toBe(true)
    expect(Object.isFrozen(original.parcela.geometriaOficial[0])).toBe(true)

    const { registro } = await exp.guardar(original)
    const crudo = await bd.get(ALMACENES.EXPEDIENTES, registro.id)

    expect(crudo.expediente.parcela.geometriaOficial).toEqual(original.parcela.geometriaOficial)
    expect(Object.isFrozen(crudo.expediente.parcela.geometriaOficial)).toBe(false) // ⚠️ el peligro
    bd.close()
  })

  it('`recuperar` la devuelve congelada otra vez, hasta los anillos de dentro', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardar(expedienteDePrueba())

    const { expediente } = await exp.recuperar(registro.id)
    const oficial = expediente.parcela.geometriaOficial

    expect(Object.isFrozen(oficial)).toBe(true)
    expect(Object.isFrozen(oficial[0])).toBe(true)
    expect(Object.isFrozen(oficial[0].vertices)).toBe(true)
    // Y no es una congelación decorativa: escribir no cambia nada.
    expect(() => {
      oficial[0].vertices[0][0] = 0
    }).toThrow(TypeError) // en módulo ES, el modo estricto convierte el silencio en error
    expect(oficial[0].vertices[0][0]).not.toBe(0)

    bd.close()
  })

  it('⭐ los PUNTOS del levantamiento sobreviven a la vuelta, y vuelven congelados', async () => {
    // ⛔ La lección de F21 en su forma más cara: un campo que la ida y vuelta no
    // arrastra desaparece en silencio y reaparece vacío meses después. Aquí duele
    // el doble, porque los puntos son las dianas sobre las que se dibuja y el DXF
    // de campo puede no estar ya en el disco: sin esto, recuperar un expediente a
    // medio dibujar obligaría a reimportar el fichero.
    const nube = anillo(40)
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const original = crearExpediente({
      srs: 'EPSG:25830',
      parcela: crearParcela({
        idLocal: 'levantamiento.dxf',
        // CERO recintos: el estado real de un levantamiento importado sin unir, y
        // el que más fácil sería perder por el camino.
        recintos: [],
        puntosLevantamiento: nube,
        origen: 'DXF',
      }),
    })

    const { registro } = await exp.guardar(original)
    const { expediente } = await exp.recuperar(registro.id)

    expect(expediente.parcela.puntosLevantamiento).toEqual(nube)
    expect(expediente.parcela.recintos).toEqual([])
    // Y vuelven congelados, como `geometriaOficial`: nada los edita.
    expect(Object.isFrozen(expediente.parcela.puntosLevantamiento)).toBe(true)
    expect(() => {
      expediente.parcela.puntosLevantamiento[0][0] = 0
    }).toThrow(TypeError)

    bd.close()
  })

  it('los recintos EDITABLES siguen siendo editables: no se congela de más', async () => {
    // El reverso: congelar la parcela entera «por si acaso» rompería la edición de
    // F06 en cuanto alguien recuperase un expediente.
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardar(expedienteDePrueba())

    const { expediente } = await exp.recuperar(registro.id)
    expect(Object.isFrozen(expediente.parcela.recintos)).toBe(false)
    expediente.parcela.recintos[0].vertices[0][0] = 1
    expect(expediente.parcela.recintos[0].vertices[0][0]).toBe(1)

    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · El orden de la lista — el otro hallazgo medido
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/expedientes · la lista va del MÁS RECIENTE al más antiguo', () => {
  it('tres expedientes salen en orden inverso al de guardado', async () => {
    // Medido en la fase 0: `getAllFromIndex` sobre `actualizado` devuelve el más
    // ANTIGUO primero. Sin la inversión explícita del módulo, esta prueba saldría
    // exactamente al revés — y una lista al revés parece normal hasta que alguien
    // busca lo que acaba de guardar.
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    const primero = await exp.guardar(expedienteDePrueba(), { nombre: 'el primero' })
    const segundo = await exp.guardar(expedienteDePrueba({ dx: 1 }), { nombre: 'el segundo' })
    const tercero = await exp.guardar(expedienteDePrueba({ dx: 2 }), { nombre: 'el tercero' })

    const { registros } = await exp.listar()
    expect(registros.map((r) => r.nombre)).toEqual(['el tercero', 'el segundo', 'el primero'])
    expect(registros.map((r) => r.id)).toEqual([
      tercero.registro.id,
      segundo.registro.id,
      primero.registro.id,
    ])

    bd.close()
  })

  it('volver a guardar uno viejo lo sube a lo alto de la lista', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    const viejo = await exp.guardar(expedienteDePrueba(), { nombre: 'viejo' })
    await exp.guardar(expedienteDePrueba({ dx: 1 }), { nombre: 'nuevo' })
    await exp.guardar(expedienteDePrueba({ dx: 2 }), { nombre: 'viejo tocado', id: viejo.registro.id })

    expect((await exp.listar()).registros.map((r) => r.nombre)).toEqual(['viejo tocado', 'nuevo'])
    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · El borrador del autoguardado
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/expedientes · el borrador es un registro con clave reservada', () => {
  it('NO sale en la lista, aunque esté en el mismo almacén', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    await exp.guardar(expedienteDePrueba(), { nombre: 'guardado a mano' })
    await exp.guardarBorrador(expedienteDePrueba({ dx: 9 }))

    const { registros, hayBorrador } = await exp.listar()
    expect(registros.map((r) => r.nombre)).toEqual(['guardado a mano'])
    expect(hayBorrador).toBe(true)
    // Pero está en el almacén: son 2 registros, no 1.
    expect(await bd.count(ALMACENES.EXPEDIENTES)).toBe(2)

    bd.close()
  })

  it('cada autoguardado PISA al anterior: no se acumula un historial', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    for (let i = 0; i < 5; i++) await exp.guardarBorrador(expedienteDePrueba({ dx: i }))
    expect(await bd.count(ALMACENES.EXPEDIENTES)).toBe(1)

    const { ok, expediente } = await exp.leerBorrador()
    expect(ok).toBe(true)
    expect(expediente.parcela.recintos[0].vertices[0][0]).toBe(440123.45 + 4) // el último

    bd.close()
  })

  it('sin borrador, `leerBorrador` dice NO_ENCONTRADO y eso no es un fallo', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const r = await exp.leerBorrador()
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_EXPEDIENTES.NO_ENCONTRADO)
    expect(r.mensaje).toBeTruthy() // hay frase que enseñar, no un null mudo
    bd.close()
  })

  it('`descartarBorrador` borra de verdad, y no toca lo guardado a mano', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    await exp.guardar(expedienteDePrueba(), { nombre: 'a mano' })
    await exp.guardarBorrador(expedienteDePrueba({ dx: 9 }))
    expect(await exp.descartarBorrador()).toMatchObject({ ok: true })

    expect(await bd.get(ALMACENES.EXPEDIENTES, ID_BORRADOR)).toBeUndefined()
    expect((await exp.listar()).registros).toHaveLength(1)

    bd.close()
  })

  it('el autoguardado NO avisa por el canal cuando falla: corre solo cada dos segundos', async () => {
    // Si avisara, un fallo persistente llenaría el panel de tarjetas idénticas que
    // el usuario no ha pedido. El fallo se DEVUELVE; quien lo cuenta es el cableado.
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    const exp = crearExpedientes({ bd: baseQueFallaEn(bd, 'put'), alAvisar: avisos, ahora: relojQueAvanza() })

    const r = await exp.guardarBorrador(expedienteDePrueba())
    expect(r.ok).toBe(false)
    expect(r.esCuota).toBe(true)
    expect(avisos).not.toHaveBeenCalled()

    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 bis · F12 · T4.3 · UNA CLAVE RESERVADA POR RAMA
// ═════════════════════════════════════════════════════════════════════════════
//
// Hasta F12 el borrador era UNO. Suscribir el autoguardado al store de edificio con
// una sola clave habría hecho que las dos ramas se pisaran dos segundos después de
// conmutar, sin que nada fallara: es el motivo por escrito de la desviación 7 del
// plan de F11. Estas pruebas son las que dejan esa puerta cerrada.

describe('storage/expedientes · el borrador es UNO POR RAMA (F12 · T4.3)', () => {
  it('⛔ el borrador de EDIFICIO no pisa el de PARCELA: son dos registros', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    await exp.guardarBorrador(expedienteDePrueba({ dx: 7 }))
    await exp.guardarBorrador(expedienteDeEdificio())

    expect(await bd.count(ALMACENES.EXPEDIENTES)).toBe(2)
    const deParcela = await exp.leerBorrador(TIPO_EXPEDIENTE.PARCELA)
    const deEdificio = await exp.leerBorrador(TIPO_EXPEDIENTE.EDIFICIO)
    expect(deParcela.expediente.parcela.recintos[0].vertices[0][0]).toBe(440123.45 + 7)
    expect(deEdificio.expediente.edificio.idLocal).toBe('EDIF-1')
    // Y cada uno en SU clave, no en una cualquiera.
    expect(await bd.get(ALMACENES.EXPEDIENTES, ID_BORRADOR)).toBeDefined()
    expect(await bd.get(ALMACENES.EXPEDIENTES, ID_BORRADOR_EDIFICIO)).toBeDefined()

    bd.close()
  })

  it('la clave la decide el TIPO del expediente, no quien llama', async () => {
    // No hay parámetro que equivocar: `guardarBorrador` la deriva de lo que le dan.
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardarBorrador(expedienteDeEdificio())
    expect(registro.id).toBe(ID_BORRADOR_EDIFICIO)
    expect(registro.id).toBe(ID_BORRADOR_POR_TIPO[TIPO_EXPEDIENTE.EDIFICIO])
    bd.close()
  })

  it('⚠️ la clave de PARCELA NO cambió de valor: un borrador de ayer sigue ahí', async () => {
    // Estrenar nombre habría dejado huérfano el trabajo de quien cerrara la pestaña
    // con la versión anterior: seguiría en la base, invisible, y sin nadie que lo
    // pudiera recuperar. El literal se afirma a pelo, que es de lo que se trata.
    expect(ID_BORRADOR).toBe('EXP-borrador-en-curso')
    expect(ID_BORRADOR_POR_TIPO[TIPO_EXPEDIENTE.PARCELA]).toBe(ID_BORRADOR)
  })

  it('`listar` los excluye a LOS DOS y dice de qué ramas hay', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    await exp.guardar(expedienteDePrueba(), { nombre: 'a mano' })
    expect((await exp.listar()).borradores).toEqual([])

    await exp.guardarBorrador(expedienteDePrueba({ dx: 1 }))
    expect((await exp.listar()).borradores).toEqual([TIPO_EXPEDIENTE.PARCELA])

    await exp.guardarBorrador(expedienteDeEdificio())
    const listado = await exp.listar()
    expect(listado.borradores).toEqual([TIPO_EXPEDIENTE.PARCELA, TIPO_EXPEDIENTE.EDIFICIO])
    expect(listado.hayBorrador).toBe(true)
    expect(listado.registros.map((r) => r.nombre)).toEqual(['a mano'])

    bd.close()
  })

  it('`descartarBorrador` borra el de UNA rama y deja el de la otra', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })

    await exp.guardarBorrador(expedienteDePrueba())
    await exp.guardarBorrador(expedienteDeEdificio())
    expect(await exp.descartarBorrador(TIPO_EXPEDIENTE.EDIFICIO)).toMatchObject({ ok: true })

    expect(await bd.get(ALMACENES.EXPEDIENTES, ID_BORRADOR_EDIFICIO)).toBeUndefined()
    expect(await bd.get(ALMACENES.EXPEDIENTES, ID_BORRADOR)).toBeDefined()
    expect((await exp.listar()).borradores).toEqual([TIPO_EXPEDIENTE.PARCELA])

    bd.close()
  })

  it('sin tipo, las tres siguen hablando de PARCELA: F10 no se entera de nada', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    await exp.guardarBorrador(expedienteDePrueba({ dx: 3 }))
    const r = await exp.leerBorrador()
    expect(r.ok).toBe(true)
    expect(r.registro.id).toBe(ID_BORRADOR)
    expect(await exp.descartarBorrador()).toMatchObject({ ok: true })
    expect((await exp.listar()).hayBorrador).toBe(false)
    bd.close()
  })

  it('⛔ un tipo desconocido LANZA en vez de caer en PARCELA por defecto', async () => {
    // Un defecto silencioso aquí escribiría el edificio encima de la parcela. Es
    // contrato del programador: el tipo sale de `TIPO_EXPEDIENTE`, no de un teclado.
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    await expect(exp.leerBorrador('CONSTRUCCION')).rejects.toThrow(RangeError)
    await expect(exp.descartarBorrador('CONSTRUCCION')).rejects.toThrow(RangeError)
    bd.close()
  })

  it('el rótulo por defecto NOMBRA la rama: un edificio no se llama «Parcela sin…»', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardarBorrador(expedienteDeEdificio({ refcat: null }))
    expect(registro.nombre).toBe('Edificio sin referencia')
    bd.close()
  })

  it('y la referencia catastral del registro sale también de la rama EDIFICIO', async () => {
    // El campo `refcat` del registro está INDEXADO y es lo que la oferta enseña. Antes
    // se leía solo de `parcela`, así que un edificio con RC salía como «sin referencia».
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardarBorrador(expedienteDeEdificio({ refcat: '9398516VK3799G' }))
    expect(registro.refcat).toBe('9398516VK3799G')
    expect(registro.nombre).toBe('9398516VK3799G')
    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Qué se guarda, y sobre todo qué NO
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/expedientes · el registro no lleva ni una clave de más', () => {
  it('las claves del registro son EXACTAMENTE las del contrato', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardar(expedienteDePrueba(), { nombre: 'x' })

    const crudo = await bd.get(ALMACENES.EXPEDIENTES, registro.id)
    expect(new Set(Object.keys(crudo))).toEqual(new Set(CAMPOS_REGISTRO))
    // Y el campo clave se DERIVA del esquema; aquí no se escribe `'id'` a mano.
    expect(CAMPOS_REGISTRO).toContain(ESQUEMA_ALMACENES[ALMACENES.EXPEDIENTES].keyPath)

    bd.close()
  })

  it('lo guardado NO menciona diagnóstico, colindantes ni historial, ni por rastreo de texto', async () => {
    // El registro se escribe desde `crearExpediente`, que solo porta la rama del
    // modelo — pero si algún día alguien colara el estado del cableado, esto lo ve.
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardar(expedienteDePrueba(), { nombre: 'x' })

    const texto = JSON.stringify(await bd.get(ALMACENES.EXPEDIENTES, registro.id))
    for (const prohibido of ['diagnostico', 'colindantes', 'historial', 'firma', 'informe']) {
      expect(texto.toLowerCase()).not.toContain(prohibido)
    }

    bd.close()
  })

  it('la lista de «lo que no se guarda» y el aviso de durabilidad existen y dicen algo', () => {
    // Viven en el módulo —no en el diálogo— para que no se queden desfasados. Que
    // estén vacíos sería peor que no tenerlos: la interfaz enseñaría un hueco.
    expect(NO_SE_GUARDA.length).toBeGreaterThan(0)
    for (const linea of NO_SE_GUARDA) expect(linea.length).toBeGreaterThan(20)
    expect(AVISO_DURABILIDAD).toMatch(/no.*servidor/i)
    // Dice qué HACER, no solo qué temer. La clase entera —`exportar`, `expórtalo`—
    // porque la frase se puede reescribir y lo que no puede desaparecer es la salida.
    expect(AVISO_DURABILIDAD).toMatch(/exp[oó]rta/i)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · El registro que el índice NO ve — el silencio que la regla 1 prohíbe
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/expedientes · un registro sin `actualizado` no desaparece en silencio', () => {
  it('se cuenta como `invisibles` y se avisa', async () => {
    // IndexedDB no indexa un registro cuyo valor de índice sea `undefined`. Sin la
    // comparación contra `count()`, ese registro se esfumaría de la lista sin que
    // nada fallara: el usuario vería una lista más corta y no sabría por qué.
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    const exp = crearExpedientes({ bd, alAvisar: avisos, ahora: relojQueAvanza() })

    await exp.guardar(expedienteDePrueba(), { nombre: 'normal' })
    // Un registro escrito «por otra versión», sin la fecha de modificación.
    await bd.put(ALMACENES.EXPEDIENTES, { id: 'EXP-raro', nombre: 'raro', refcat: null, creado: 'x', srs: 'EPSG:25830', expediente: {} })

    const { registros, invisibles } = await exp.listar()
    expect(registros).toHaveLength(1)
    expect(invisibles).toBe(1)
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(avisos.mock.calls[0][0]).toMatch(/no se han perdido/i)
    expect(avisos.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)

    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Los caminos degradados: sin base, sin espacio, registro ilegible
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/expedientes · degradación', () => {
  it('sin almacén local, TODO devuelve SIN_BD y nada lanza', async () => {
    const avisos = vi.fn()
    const exp = crearExpedientes({ bd: null, alAvisar: avisos, ahora: relojQueAvanza() })

    expect((await exp.guardar(expedienteDePrueba())).motivo).toBe(MOTIVO_EXPEDIENTES.SIN_BD)
    expect(await exp.listar()).toMatchObject({ ok: false, registros: [], motivo: MOTIVO_EXPEDIENTES.SIN_BD })
    expect((await exp.recuperar('EXP-lo-que-sea')).motivo).toBe(MOTIVO_EXPEDIENTES.SIN_BD)
    expect((await exp.duplicar('EXP-lo-que-sea')).motivo).toBe(MOTIVO_EXPEDIENTES.SIN_BD)
    expect((await exp.borrar('EXP-lo-que-sea')).motivo).toBe(MOTIVO_EXPEDIENTES.SIN_BD)
    expect((await exp.guardarBorrador(expedienteDePrueba())).motivo).toBe(MOTIVO_EXPEDIENTES.SIN_BD)

    // Avisa UNA vez por instancia, no seis: el memo de la base lo garantiza.
    expect(avisos).toHaveBeenCalledTimes(1)
    expect(avisos.mock.calls[0][0]).toMatch(/no se repetirá/i)
  })

  it('cuota agotada al guardar: `esCuota`, mensaje que dice qué hacer, y aviso', async () => {
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    const exp = crearExpedientes({ bd: baseQueFallaEn(bd, 'put'), alAvisar: avisos, ahora: relojQueAvanza() })

    const r = await exp.guardar(expedienteDePrueba(), { nombre: 'x' })
    expect(r.ok).toBe(false)
    expect(r.esCuota).toBe(true)
    expect(r.motivo).toBe(MOTIVO_EXPEDIENTES.ERROR_ESCRITURA)
    expect(r.mensaje).toMatch(/export/i) // ofrece la salida, no solo el diagnóstico
    expect(avisos).toHaveBeenCalledTimes(1)

    bd.close()
  })

  it('un fallo de escritura que NO es de cuota se distingue', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({
      bd: baseQueFallaEn(bd, 'put', new DOMException('vaya', 'InvalidStateError')),
      ahora: relojQueAvanza(),
    })
    const r = await exp.guardar(expedienteDePrueba())
    expect(r.ok).toBe(false)
    expect(r.esCuota).toBe(false)
    bd.close()
  })

  it('un registro corrupto sale como REGISTRO_ILEGIBLE y NO entra al modelo', async () => {
    const { bd } = await baseNueva()
    const avisos = vi.fn()
    const exp = crearExpedientes({ bd, alAvisar: avisos, ahora: relojQueAvanza() })

    await bd.put(ALMACENES.EXPEDIENTES, {
      id: 'EXP-roto',
      nombre: 'roto',
      refcat: null,
      creado: '2026-01-01T00:00:00.000Z',
      actualizado: '2026-01-01T00:00:00.000Z',
      srs: 'EPSG:25830',
      expediente: { tipo: 'PARCELA', srs: 'EPSG:4326' }, // srs que el modelo rechaza
    })

    const r = await exp.recuperar('EXP-roto')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_EXPEDIENTES.REGISTRO_ILEGIBLE)
    expect(r.expediente).toBeNull()
    expect(r.registro.nombre).toBe('roto') // se puede seguir enseñando y borrando
    expect(avisos).toHaveBeenCalledTimes(1)

    bd.close()
  })

  it('recuperar algo que no existe es NO_ENCONTRADO, no un error', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const r = await exp.recuperar('EXP-nunca-existio')
    expect(r.motivo).toBe(MOTIVO_EXPEDIENTES.NO_ENCONTRADO)
    expect(r.mensaje).toBeTruthy()
    bd.close()
  })

  it('borrar BORRA de verdad, y si falla lo dice sin fingir', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardar(expedienteDePrueba(), { nombre: 'x' })

    expect(await exp.borrar(registro.id)).toMatchObject({ ok: true })
    expect(await bd.get(ALMACENES.EXPEDIENTES, registro.id)).toBeUndefined()

    const avisos = vi.fn()
    const roto = crearExpedientes({ bd: baseQueFallaEn(bd, 'delete'), alAvisar: avisos, ahora: relojQueAvanza() })
    const r = await roto.borrar('EXP-lo-que-sea')
    expect(r.ok).toBe(false)
    expect(r.motivo).toBe(MOTIVO_EXPEDIENTES.ERROR_BORRADO)
    expect(r.mensaje).toMatch(/sigue guardado/i) // el dato SIGUE ahí, y se dice

    bd.close()
  })

  it('`estado()` cuenta lo que ha pasado, para que la interfaz no tenga que espiar', async () => {
    const { bd } = await baseNueva()
    const exp = crearExpedientes({ bd, ahora: relojQueAvanza() })
    const { registro } = await exp.guardar(expedienteDePrueba())
    await exp.listar()
    await exp.recuperar(registro.id)
    await exp.duplicar(registro.id)
    await exp.borrar(registro.id)

    expect(exp.estado()).toMatchObject({
      disponible: true, guardados: 1, listados: 1, recuperados: 1, duplicados: 1, borrados: 1,
    })
    bd.close()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · La frontera: el entorno degrada, el programador revienta
// ═════════════════════════════════════════════════════════════════════════════

describe('storage/expedientes · contrato roto por el programador', () => {
  it('un expediente que el modelo rechaza LANZA, y lanza también sin base', async () => {
    // La segunda mitad importa: si la validación fuera después de resolver la base,
    // un error de programación aparecería solo en los navegadores con IndexedDB, y
    // el día del despliegue.
    const { bd } = await baseNueva()
    for (const almacen of [bd, null]) {
      const exp = crearExpedientes({ bd: almacen, ahora: relojQueAvanza() })
      await expect(exp.guardar({ tipo: 'PARCELA', srs: 'EPSG:4326' })).rejects.toThrow(RangeError)
      await expect(exp.guardarBorrador({ tipo: 'OTRO', srs: 'EPSG:25830' })).rejects.toThrow(RangeError)
    }
    bd.close()
  })

  it('un id que no es texto no vacío lanza TypeError', async () => {
    const exp = crearExpedientes({ bd: null })
    for (const malo of [null, '', 42, {}, undefined]) {
      await expect(exp.recuperar(malo)).rejects.toThrow(TypeError)
      await expect(exp.borrar(malo)).rejects.toThrow(TypeError)
      await expect(exp.duplicar(malo)).rejects.toThrow(TypeError)
    }
  })

  it('opciones con formas imposibles lanzan al construir', () => {
    expect(() => crearExpedientes({ ahora: 'ya' })).toThrow(TypeError)
    expect(() => crearExpedientes({ nuevoId: 'id' })).toThrow(TypeError)
    expect(() => crearExpedientes({ bd: 42 })).toThrow(TypeError)
    expect(() => crearExpedientes(null)).toThrow(TypeError)
    expect(() => crearExpedientes({ bd: null, alAvisar: 'avisa' })).toThrow(TypeError)
  })
})

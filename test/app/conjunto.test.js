// test/app/conjunto.test.js — F25 · tarea 1.4 · las parcelas del expediente.
//
// El registro es puro: sin store, sin historial, sin DOM. Las pruebas que cruzan con
// `edit/historial.js` lo hacen como lo hará el cableado de la fase 2 —apartar,
// activar, restaurar o sembrar—, para que el contrato entre los dos quede medido
// antes de que exista quien lo use.

import { describe, expect, it, vi } from 'vitest'

import { MOTIVO_CAMBIO, crearConjunto } from '../../app/conjunto.js'
import { apartar, commit, crearHistorial, reiniciar, restaurar, undo } from '../../edit/historial.js'
import { crearParcela } from '../../model/parcela.js'

const p = (idLocal, x = 0) =>
  crearParcela({
    idLocal,
    origen: 'WFS',
    recintos: [{ vertices: [[x, 0], [x + 10, 0], [x + 10, 10]], tipo: 'EXTERIOR' }],
  })

/** La misma parcela con el primer vértice movido: lo que publica una edición. */
const movida = (parcela, dx) => ({
  ...parcela,
  recintos: [
    { ...parcela.recintos[0], vertices: [[parcela.recintos[0].vertices[0][0] + dx, 0], ...parcela.recintos[0].vertices.slice(1)] },
  ],
})

describe('app/conjunto · abrir', () => {
  it('nace vacío: sin parcelas, sin activa, identidad 0', () => {
    const c = crearConjunto()
    expect(c.parcelas()).toEqual([])
    expect(c.activa()).toBe(null)
    expect(c.parcelaActiva()).toBe(null)
    expect(c.identidad()).toBe(0)
  })

  it('abrir sustituye las parcelas, estrena identidad y valida como el modelo', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A'), p('B')], activa: 'B' })
    expect(c.parcelas().map((x) => x.idLocal)).toEqual(['A', 'B'])
    expect(c.activa()).toBe('B')
    expect(c.identidad()).toBe(1)
    c.abrir({ parcelas: [p('Z')] })
    expect(c.activa()).toBe('Z')
    expect(c.identidad()).toBe(2)
    expect(() => c.abrir({ parcelas: [p('A'), p('A')], activa: 'A' })).toThrow(/comparten/)
    // Un abrir que lanza no ha tocado nada.
    expect(c.parcelas().map((x) => x.idLocal)).toEqual(['Z'])
    expect(c.identidad()).toBe(2)
  })

  it('`parcelas()` es una lista nueva: empujar en ella no cambia el registro', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A')] })
    c.parcelas().push(p('X'))
    expect(c.parcelas()).toHaveLength(1)
  })
})

describe('app/conjunto · activar (la identidad del EXPEDIENTE no se mueve)', () => {
  it('cambia la activa, devuelve la parcela que entra y NO cambia la identidad', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A'), p('B', 100)], activa: 'A' })
    const identidad = c.identidad()
    const r = c.activar('B', null)
    expect(r.cambiado).toBe(true)
    expect(r.parcela.idLocal).toBe('B')
    expect(r.apartado).toBe(null) // primera vez: quien llama siembra con `reiniciar`
    expect(c.activa()).toBe('B')
    expect(c.identidad()).toBe(identidad)
  })

  it('activar la que ya está en edición no toca nada', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A')] })
    const oyente = vi.fn()
    c.subscribe(oyente)
    expect(c.activar('A', { pila: [], indice: 0 }).cambiado).toBe(false)
    expect(oyente).not.toHaveBeenCalled()
  })

  it('activar una que no existe LANZA y no cambia la activa', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A')] })
    expect(() => c.activar('NO')).toThrow(/no hay ninguna parcela/)
    expect(c.activa()).toBe('A')
  })

  it('⭐ el recorrido de la fase 2, con el historial de verdad: cada parcela vuelve con SU deshacer', () => {
    const c = crearConjunto()
    const h = crearHistorial()
    c.abrir({ parcelas: [p('A'), p('B', 100)], activa: 'A' })
    reiniciar(h, c.parcelaActiva())

    // Se edita A dos veces.
    let a = movida(c.parcelaActiva(), 1)
    commit(h, a)
    expect(c.actualizarActiva(a)).toBe(true)
    a = movida(a, 1)
    commit(h, a)
    c.actualizarActiva(a)

    // Se cambia a B: es la primera vez, así que se siembra.
    const aB = c.activar('B', apartar(h))
    aB.apartado === null ? reiniciar(h, aB.parcela) : restaurar(h, aB.apartado)
    const b = movida(aB.parcela, 5)
    commit(h, b)
    c.actualizarActiva(b)

    // Se vuelve a A: su historia vuelve entera, y la de B queda apartada.
    const aA = c.activar('A', apartar(h))
    expect(aA.apartado).not.toBe(null)
    restaurar(h, aA.apartado)
    expect(aA.parcela.recintos[0].vertices[0][0]).toBe(2) // la última edición de A
    expect(undo(h).recintos[0].vertices[0][0]).toBe(1)
    expect(undo(h).recintos[0].vertices[0][0]).toBe(0)
    expect(undo(h)).toBe(null) // ⛔ nunca llega a B

    // Y B sigue con su edición dentro del registro.
    expect(c.parcelas()[1].recintos[0].vertices[0][0]).toBe(105)
  })

  it('con `apartadoSaliente` null no se guarda nada: al volver, empieza sin deshacer', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A'), p('B')], activa: 'A' })
    c.activar('B', null)
    expect(c.activar('A', null).apartado).toBe(null)
  })
})

describe('app/conjunto · actualizarActiva', () => {
  it('NO aplica —y no lanza— una parcela que no es la activa: devuelve false', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A'), p('B')], activa: 'A' })
    expect(c.actualizarActiva(p('B', 50))).toBe(false)
    expect(c.actualizarActiva(null)).toBe(false)
    expect(c.actualizarActiva(p('OTRA'))).toBe(false)
    expect(c.parcelas()[1].recintos[0].vertices[0][0]).toBe(0)
  })

  it('la misma referencia no notifica; una edición, sí, con motivo EDITADA', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A')] })
    const oyente = vi.fn()
    c.subscribe(oyente)
    expect(c.actualizarActiva(c.parcelaActiva())).toBe(true)
    expect(oyente).not.toHaveBeenCalled()
    c.actualizarActiva(movida(c.parcelaActiva(), 3))
    expect(oyente).toHaveBeenCalledWith({ motivo: MOTIVO_CAMBIO.EDITADA, identidad: 1, activa: 'A' })
  })
})

describe('app/conjunto · añadir y quitar', () => {
  it('añadir va al FINAL, sin activar, y copia por crearParcela', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A')] })
    const fuente = p('B')
    const copia = c.añadir(fuente)
    expect(copia).not.toBe(fuente)
    expect(c.parcelas().map((x) => x.idLocal)).toEqual(['A', 'B'])
    expect(c.activa()).toBe('A')
  })

  it('en un expediente vacío, la que se añade pasa a estar en edición', () => {
    const c = crearConjunto()
    c.añadir(p('A'))
    expect(c.activa()).toBe('A')
  })

  it('añadir un idLocal repetido LANZA', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A')] })
    expect(() => c.añadir(p('A'))).toThrow(/ya tiene una parcela con idLocal "A"/)
  })

  it('quitar suelta la parcela y su historia apartada', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A'), p('B')], activa: 'A' })
    c.activar('B', null)
    c.activar('A', { pila: [p('B')], indice: 0 }) // la historia de B queda apartada
    c.quitar('B')
    expect(c.parcelas().map((x) => x.idLocal)).toEqual(['A'])
    // Si volviera a entrar una B, no heredaría la historia de la anterior.
    c.añadir(p('B'))
    expect(c.activar('B', null).apartado).toBe(null)
  })

  it('⛔ la que está en edición NO se quita; una que no existe, tampoco', () => {
    const c = crearConjunto()
    c.abrir({ parcelas: [p('A'), p('B')], activa: 'A' })
    expect(() => c.quitar('A')).toThrow(/es la parcela en edición/)
    expect(() => c.quitar('NO')).toThrow(/no hay ninguna parcela/)
    expect(c.parcelas()).toHaveLength(2)
  })
})

describe('app/conjunto · oyentes', () => {
  it('cada operación avisa con su motivo, la identidad y la activa', () => {
    const c = crearConjunto()
    const vistos = []
    c.subscribe((cambio) => vistos.push(cambio))
    c.abrir({ parcelas: [p('A')] })
    c.añadir(p('B'))
    c.activar('B', null)
    c.activar('A', null)
    c.quitar('B')
    expect(vistos).toEqual([
      { motivo: MOTIVO_CAMBIO.ABIERTO, identidad: 1, activa: 'A' },
      { motivo: MOTIVO_CAMBIO.AÑADIDA, identidad: 1, activa: 'A' },
      { motivo: MOTIVO_CAMBIO.ACTIVADA, identidad: 1, activa: 'B' },
      { motivo: MOTIVO_CAMBIO.ACTIVADA, identidad: 1, activa: 'A' },
      { motivo: MOTIVO_CAMBIO.QUITADA, identidad: 1, activa: 'A' },
    ])
  })

  it('un oyente roto no tumba a los demás, y se cuenta en la consola', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const c = crearConjunto()
    const sano = vi.fn()
    c.subscribe(() => {
      throw new Error('roto')
    })
    c.subscribe(sano)
    c.abrir({ parcelas: [p('A')] })
    expect(sano).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalledTimes(1)
    error.mockRestore()
  })

  it('la baja funciona, y destruir deja el registro inerte', () => {
    const c = crearConjunto()
    const oyente = vi.fn()
    const baja = c.subscribe(oyente)
    baja()
    c.abrir({ parcelas: [p('A')] })
    expect(oyente).not.toHaveBeenCalled()
    c.destruir()
    c.destruir() // idempotente
    expect(() => c.abrir()).toThrow(/destruido/)
    expect(c.actualizarActiva(c.parcelaActiva())).toBe(false)
    expect(() => c.subscribe(42)).toThrow(TypeError)
  })
})

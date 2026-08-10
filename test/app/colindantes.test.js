// test/app/colindantes.test.js — F23 · tarea 2.1 · el registro de vecinas.
//
// Sin DOM y sin red: el módulo es estado y traducción, así que corre en el proyecto
// Vitest `node`, que es el bucle rápido.

import { describe, expect, it, vi } from 'vitest'

import { crearRegistroColindantes, traducirColindantes } from '../../app/colindantes.js'

/** Un doble del cableado de F05: solo lo que el registro usa. */
function catastroDoble() {
  const oyentes = new Set()
  return {
    alColindantes(fn) {
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },
    /** Simula que alguien ha traído vecinas y F05 las publica. */
    publicar(colindantes) {
      for (const fn of oyentes) fn({ ok: true, datos: { colindantes } })
    },
    nOyentes: () => oyentes.size,
  }
}

const CRUDAS = [
  { refcat: 'A1', label: '16', recintos: [{ vertices: [], tipo: 'EXTERIOR' }] },
  { refcat: '  ', label: '', recintos: null },
]

describe('traducirColindantes', () => {
  it('emite las TRES claves y nada más', () => {
    const [uno] = traducirColindantes(CRUDAS)
    expect(Object.keys(uno).sort()).toEqual(['label', 'recintos', 'refcat'])
  })

  it('⛔ un refcat de solo espacios es `null`, nunca cadena vacía', () => {
    // Era la discrepancia REAL entre las dos copias que este módulo unificó:
    // `cableado-diagnostico.js` no recortaba antes de comparar y dejaba pasar '  '
    // como referencia; `cableado-informe.js` sí. Quien la presente escribe «parcela
    // sin referencia», y para eso tiene que poder distinguirlo.
    const [, dos] = traducirColindantes(CRUDAS)
    expect(dos.refcat).toBeNull()
    expect(dos.label).toBeNull()
  })

  it('una vecina SIN recintos se deja pasar con `[]`, no se descarta', () => {
    // Descartarla aquí la haría desaparecer sin dejar rastro; quien la consuma la
    // anota en sus `saltados` con el motivo.
    const [, dos] = traducirColindantes(CRUDAS)
    expect(dos.recintos).toEqual([])
    expect(traducirColindantes(CRUDAS)).toHaveLength(2)
  })

  it('lo que no es un array da `[]`: no se inventa nada', () => {
    expect(traducirColindantes(null)).toEqual([])
    expect(traducirColindantes(undefined)).toEqual([])
    expect(traducirColindantes('vecinas')).toEqual([])
  })
})

describe('crearRegistroColindantes · ⛔ null NO es []', () => {
  it('nace en `null`: NO se han consultado', () => {
    const r = crearRegistroColindantes()
    expect(r.get()).toBeNull()
    expect(r.consultado()).toBe(false)
  })

  it('tras adoptar CERO colindantes queda en `[]`: se preguntó y no hay', () => {
    // Una parcela aislada existe —rodeada de viales o de suelo sin parcelar— y es
    // una respuesta, no un fallo. `[]` es lo que permite a `derivacion/vecino.js`
    // afirmar que el exceso cae sobre un vial.
    const r = crearRegistroColindantes()
    r.adoptar({ ok: true, datos: { colindantes: [] } })
    expect(r.get()).toEqual([])
    expect(r.consultado()).toBe(true)
  })

  it('`olvidar()` vuelve a `null` y NO a `[]`', () => {
    // Ha entrado otra parcela: lo cierto es que no se han consultado las suyas, no
    // que no tenga.
    const r = crearRegistroColindantes()
    r.adoptar({ ok: true, datos: { colindantes: CRUDAS } })
    expect(r.consultado()).toBe(true)
    r.olvidar()
    expect(r.get()).toBeNull()
    expect(r.consultado()).toBe(false)
  })
})

describe('crearRegistroColindantes · la suscripción', () => {
  it('se engancha al canal de F05 y se puebla SIN pedir nada', () => {
    const catastro = catastroDoble()
    const r = crearRegistroColindantes({ catastro })
    expect(catastro.nOyentes()).toBe(1)
    expect(r.get()).toBeNull()

    catastro.publicar(CRUDAS)
    expect(r.get()).toHaveLength(2)
    expect(r.get()[0].refcat).toBe('A1')
  })

  it('avisa a sus oyentes al adoptar y al olvidar, y la baja funciona', () => {
    const r = crearRegistroColindantes()
    const visto = []
    const baja = r.subscribe((v) => visto.push(v === null ? null : v.length))

    r.adoptar({ ok: true, datos: { colindantes: CRUDAS } })
    r.olvidar()
    baja()
    r.adoptar({ ok: true, datos: { colindantes: CRUDAS } })

    expect(visto).toEqual([2, null])
  })

  it('un oyente que revienta no tumba a los demás, y NO se traga', () => {
    const r = crearRegistroColindantes()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const bueno = vi.fn()
    r.subscribe(() => {
      throw new Error('yo reviento')
    })
    r.subscribe(bueno)

    r.adoptar({ ok: true, datos: { colindantes: CRUDAS } })

    expect(bueno).toHaveBeenCalledTimes(1)
    expect(error).toHaveBeenCalled()
    error.mockRestore()
  })

  it('⛔ un resultado sin `datos.colindantes` NO borra lo que ya había', () => {
    // Llamar a `adoptar` con cualquier cosa no puede convertir «tengo dos vecinas»
    // en «no se han consultado». Para eso está `olvidar()`, que es explícito.
    const r = crearRegistroColindantes()
    r.adoptar({ ok: true, datos: { colindantes: CRUDAS } })
    r.adoptar({ ok: false, error: 'SIN_RED' })
    r.adoptar(null)
    expect(r.get()).toHaveLength(2)
  })

  it('`destruir()` se da de baja del canal y es idempotente', () => {
    const catastro = catastroDoble()
    const r = crearRegistroColindantes({ catastro })
    r.destruir()
    r.destruir()
    expect(catastro.nOyentes()).toBe(0)
  })

  it('un `catastro` que no publica alColindantes LANZA nombrando el porqué', () => {
    expect(() => crearRegistroColindantes({ catastro: {} })).toThrow(/alColindantes/)
    expect(() => crearRegistroColindantes({ catastro: {} })).toThrow(/se quedaría en null/)
  })

  it('`subscribe` con algo que no es función LANZA', () => {
    const r = crearRegistroColindantes()
    expect(() => r.subscribe('no')).toThrow(TypeError)
  })
})

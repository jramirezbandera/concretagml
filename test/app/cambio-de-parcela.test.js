// test/app/cambio-de-parcela.test.js — F25 · tarea 2.2 · el orden del cambio de parcela.
//
// El store es un doble de tres funciones que APUNTA lo que ve cada suscriptor en el
// instante de la notificación: la marca de cambio de parcela y el historial vigente.
// Es lo que hace falta para afirmar el ORDEN, que es todo el contenido del módulo.

import { describe, expect, it } from 'vitest'

import { cambiarDeParcela } from '../../app/cambio-de-parcela.js'
import { crearConjunto } from '../../app/conjunto.js'
import { commit, crearHistorial, puedeDeshacer, reiniciar, undo } from '../../edit/historial.js'
import { crearParcela } from '../../model/parcela.js'

const p = (idLocal, x = 0) =>
  crearParcela({
    idLocal,
    origen: 'WFS',
    recintos: [{ vertices: [[x, 0], [x + 10, 0], [x + 10, 10]], tipo: 'EXTERIOR' }],
  })
const movida = (parcela, dx) => {
  const otra = structuredClone(parcela)
  otra.recintos[0].vertices[0][0] += dx
  return otra
}

/** Un store mínimo que, al notificar, apunta qué veía en ese instante. */
function storeQueMira({ historial, marca }) {
  let actual = null
  const vistos = []
  return {
    get: () => actual,
    set(x) {
      actual = x
      vistos.push({ idLocal: x?.idLocal, marca: marca.valor, presente: historial.pila[historial.indice]?.idLocal })
    },
    vistos,
  }
}

function montar() {
  const conjunto = crearConjunto()
  const historial = crearHistorial()
  const marca = { valor: false }
  const estado = storeQueMira({ historial, marca })
  conjunto.abrir({ parcelas: [p('A'), p('B', 100)], activa: 'A' })
  estado.set(conjunto.parcelaActiva())
  reiniciar(historial, conjunto.parcelaActiva())
  const cambiar = (idLocal, extra = {}) =>
    cambiarDeParcela({
      conjunto,
      historial,
      estado,
      idLocal,
      marcar: (v) => {
        marca.valor = v
      },
      ...extra,
    })
  /** Una edición como la de producción: `set` + `commit` + la copia del conjunto. */
  const editar = (dx) => {
    const siguiente = movida(estado.get(), dx)
    estado.set(siguiente)
    commit(historial, siguiente)
    conjunto.actualizarActiva(siguiente)
  }
  return { conjunto, historial, estado, marca, cambiar, editar }
}

describe('app/cambio-de-parcela', () => {
  it('⭐ el ORDEN: al notificar, la marca está levantada y el historial YA es el de la que entra', () => {
    const { estado, marca, cambiar } = montar()
    cambiar('B')
    const visto = estado.vistos.at(-1)
    expect(visto).toEqual({ idLocal: 'B', marca: true, presente: 'B' })
    // Y la marca se baja en cuanto termina el `set`.
    expect(marca.valor).toBe(false)
  })

  it('cada parcela vuelve con SU deshacer, y Ctrl+Z nunca cruza a la otra', () => {
    const { historial, cambiar, editar } = montar()
    editar(1)
    editar(1)
    cambiar('B')
    expect(puedeDeshacer(historial)).toBe(false) // B es nueva en edición: sembrada
    editar(5)
    cambiar('A')
    expect(undo(historial).recintos[0].vertices[0][0]).toBe(1)
    expect(undo(historial).recintos[0].vertices[0][0]).toBe(0)
    expect(undo(historial)).toBe(null)
    cambiar('B')
    expect(undo(historial).recintos[0].vertices[0][0]).toBe(100)
  })

  it('activar la que ya está en edición no toca nada', () => {
    const { estado, cambiar } = montar()
    const antes = estado.vistos.length
    expect(cambiar('A')).toEqual({ cambiado: false, deshacerReiniciado: false })
    expect(estado.vistos.length).toBe(antes)
  })

  it('⛔ con instantáneas del EDIFICIO en la pila, no se reparte: se empieza de cero y se dice', () => {
    const { historial, cambiar, editar } = montar()
    editar(1)
    commit(historial, { deEdificio: true, idLocal: 'EDIF' })
    const esDeEdificio = (i) => i.deEdificio === true
    expect(cambiar('B', { esDeEdificio })).toEqual({ cambiado: true, deshacerReiniciado: true })
    expect(historial.pila).toHaveLength(1)
    // Y al volver a A tampoco hay historia guardada que pudiera traer el edificio viejo.
    expect(cambiar('A', { esDeEdificio })).toEqual({ cambiado: true, deshacerReiniciado: false })
    expect(historial.pila.some(esDeEdificio)).toBe(false)
    expect(puedeDeshacer(historial)).toBe(false)
  })

  it('si el `set` revienta, la marca se baja igual', () => {
    const { conjunto, historial, marca } = montar()
    const estadoRoto = {
      set() {
        throw new Error('un suscriptor roto')
      },
    }
    expect(() =>
      cambiarDeParcela({ conjunto, historial, estado: estadoRoto, idLocal: 'B', marcar: (v) => (marca.valor = v) }),
    ).toThrow(/suscriptor roto/)
    expect(marca.valor).toBe(false)
  })

  it('una parcela que no es del expediente LANZA antes de tocar el store', () => {
    const { estado, cambiar } = montar()
    const antes = estado.vistos.length
    expect(() => cambiar('NO')).toThrow(/no hay ninguna parcela/)
    expect(estado.vistos.length).toBe(antes)
  })
})

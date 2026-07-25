import { describe, it, expect } from 'vitest'
import {
  crearHistorial,
  commit,
  undo,
  redo,
  puedeDeshacer,
  puedeRehacer,
} from '../../edit/historial.js'

// Estado de referencia con la forma real del modelo (POJO plano): recintos con
// vértices [x,y] anidados. Sirve para comprobar que structuredClone clona en
// profundidad y que las coords no se comparten entre snapshots.
const estadoRecintos = (tipo = 'EXTERIOR', xy = [1, 2]) => ({
  recintos: [{ vertices: [[...xy]], tipo }],
})

describe('edit/historial.js — undo/redo por snapshots', () => {
  it('crearHistorial arranca vacío y sin poder deshacer/rehacer', () => {
    const h = crearHistorial()
    expect(h.limite).toBe(100)
    expect(puedeDeshacer(h)).toBe(false)
    expect(puedeRehacer(h)).toBe(false)
    // Sin snapshots, undo/redo devuelven null.
    expect(undo(h)).toBe(null)
    expect(redo(h)).toBe(null)
  })

  it('límite por defecto = 100, configurable', () => {
    expect(crearHistorial().limite).toBe(100)
    expect(crearHistorial({ limite: 50 }).limite).toBe(50)
    expect(crearHistorial({ limite: 3 }).limite).toBe(3)
  })

  it('commit → undo → redo restaura estados equivalentes (toEqual)', () => {
    const h = crearHistorial()
    const a = estadoRecintos('EXTERIOR', [1, 2])
    const b = estadoRecintos('EXTERIOR', [3, 4])
    const c = estadoRecintos('HUECO', [5, 6])

    commit(h, a)
    commit(h, b)
    commit(h, c)

    expect(puedeDeshacer(h)).toBe(true)
    expect(puedeRehacer(h)).toBe(false)

    // Deshacer dos veces: c -> b -> a
    expect(undo(h)).toEqual(b)
    expect(undo(h)).toEqual(a)
    expect(puedeDeshacer(h)).toBe(false) // en el snapshot más antiguo
    expect(undo(h)).toBe(null) // no hay nada antes de 'a'

    // Rehacer dos veces: a -> b -> c
    expect(puedeRehacer(h)).toBe(true)
    expect(redo(h)).toEqual(b)
    expect(redo(h)).toEqual(c)
    expect(puedeRehacer(h)).toBe(false)
    expect(redo(h)).toBe(null) // no hay nada después de 'c'
  })

  it('los estados devueltos son CLONES independientes (mutar el devuelto no afecta al guardado)', () => {
    const h = crearHistorial()
    const a = estadoRecintos('EXTERIOR', [1, 2])
    const b = estadoRecintos('EXTERIOR', [3, 4])
    commit(h, a)
    commit(h, b)

    // 1) Mutar la FUENTE tras el commit no afecta al snapshot guardado.
    a.recintos[0].vertices[0][0] = 999
    a.recintos[0].tipo = 'MUTADO'

    const devueltoA = undo(h) // debe ser el 'a' original, no el mutado
    expect(devueltoA).toEqual(estadoRecintos('EXTERIOR', [1, 2]))
    expect(devueltoA.recintos[0].vertices[0][0]).toBe(1)
    expect(devueltoA.recintos[0].tipo).toBe('EXTERIOR')

    // 2) Mutar el DEVUELTO (en profundidad) no debe tocar el snapshot guardado.
    devueltoA.recintos[0].vertices[0][1] = -777
    devueltoA.recintos[0].tipo = 'MUTADO'
    devueltoA.recintos.push({ vertices: [[7, 8]], tipo: 'HUECO' })

    // Volver a navegar hasta 'a' (redo a b, undo a a) debe darlo intacto.
    expect(redo(h)).toEqual(b) // vuelve a 'b'
    const devueltoA2 = undo(h) // vuelve a 'a', clon fresco del snapshot
    expect(devueltoA2).toEqual(estadoRecintos('EXTERIOR', [1, 2]))
    expect(devueltoA2.recintos).toHaveLength(1)
    expect(devueltoA2.recintos[0].tipo).toBe('EXTERIOR')
    expect(devueltoA2.recintos[0].vertices[0][1]).toBe(2)
    // Los dos clones del mismo snapshot no comparten referencias.
    expect(devueltoA2).not.toBe(devueltoA)
    expect(devueltoA2.recintos).not.toBe(devueltoA.recintos)
  })

  it('cada llamada devuelve un clon nuevo (sin alias entre devoluciones)', () => {
    const h = crearHistorial()
    commit(h, estadoRecintos('EXTERIOR', [1, 2]))
    commit(h, estadoRecintos('EXTERIOR', [3, 4]))

    const primera = undo(h)
    const segunda = redo(h)
    const tercera = undo(h)
    // primera y tercera representan el mismo snapshot ('a') pero son objetos distintos.
    expect(primera).toEqual(tercera)
    expect(primera).not.toBe(tercera)
    expect(primera.recintos).not.toBe(tercera.recintos)
    expect(primera.recintos[0].vertices[0]).not.toBe(tercera.recintos[0].vertices[0])
    // Mutar una no toca la otra.
    primera.recintos[0].vertices[0][0] = 111
    expect(tercera.recintos[0].vertices[0][0]).toBe(1)
    expect(segunda).toEqual(estadoRecintos('EXTERIOR', [3, 4]))
  })

  it('structuredClone del estado POJO no rompe (arrays anidados, varios recintos)', () => {
    const h = crearHistorial()
    const estado = {
      recintos: [
        { vertices: [[1, 2], [3, 4], [5, 6]], tipo: 'EXTERIOR' },
        { vertices: [[1.5, 2.5], [2.5, 3.5]], tipo: 'HUECO' },
      ],
      meta: { huso: 30, refCatastral: '9398516VK3799G' },
    }
    expect(() => commit(h, estado)).not.toThrow()
    commit(h, estadoRecintos('EXTERIOR', [9, 9]))
    const recuperado = undo(h)
    expect(recuperado).toEqual(estado)
    expect(recuperado.recintos[0].vertices).toEqual([[1, 2], [3, 4], [5, 6]])
  })

  it('nuevo commit tras undo descarta la rama de redo', () => {
    const h = crearHistorial()
    const a = estadoRecintos('EXTERIOR', [1, 2])
    const b = estadoRecintos('EXTERIOR', [3, 4])
    const c = estadoRecintos('EXTERIOR', [5, 6])
    const d = estadoRecintos('HUECO', [7, 8])

    commit(h, a)
    commit(h, b)
    commit(h, c)

    // Deshacer hasta 'a', luego un commit nuevo 'd' debe borrar b y c del redo.
    expect(undo(h)).toEqual(b)
    expect(undo(h)).toEqual(a)
    expect(puedeRehacer(h)).toBe(true)

    commit(h, d)
    expect(puedeRehacer(h)).toBe(false) // redo descartado
    expect(redo(h)).toBe(null)

    // La historia ahora es a -> d.
    expect(undo(h)).toEqual(a)
    expect(redo(h)).toEqual(d)
  })

  it('la pila respeta el límite: solo conserva los últimos N y undo se detiene', () => {
    const limite = 3
    const h = crearHistorial({ limite })

    // 5 commits con límite 3: solo deben quedar los últimos 3 (C, D, E).
    const estados = ['A', 'B', 'C', 'D', 'E'].map((etq, i) =>
      estadoRecintos('EXTERIOR', [i, i]),
    )
    // Etiquetamos por coordenada para identificarlos: A=[0,0]…E=[4,4].
    for (const e of estados) commit(h, e)

    // La pila interna no supera el límite.
    expect(h.pila.length).toBe(limite)

    // Presente = E ([4,4]). Deshacer solo puede llegar a C ([2,2]).
    expect(undo(h)).toEqual(estadoRecintos('EXTERIOR', [3, 3])) // D
    expect(undo(h)).toEqual(estadoRecintos('EXTERIOR', [2, 2])) // C
    expect(puedeDeshacer(h)).toBe(false)
    expect(undo(h)).toBe(null) // A y B se descartaron; no se puede ir más atrás

    // Rehacer devuelve la rama superior intacta.
    expect(redo(h)).toEqual(estadoRecintos('EXTERIOR', [3, 3])) // D
    expect(redo(h)).toEqual(estadoRecintos('EXTERIOR', [4, 4])) // E
    expect(puedeRehacer(h)).toBe(false)
  })

  it('límite mínimo saneado a 1 (nunca 0 ni negativo)', () => {
    const h = crearHistorial({ limite: 0 })
    expect(h.limite).toBe(1)
    commit(h, estadoRecintos('EXTERIOR', [1, 1]))
    commit(h, estadoRecintos('EXTERIOR', [2, 2]))
    expect(h.pila.length).toBe(1)
    expect(puedeDeshacer(h)).toBe(false)
    expect(undo(h)).toBe(null)
  })

  it('límite NaN/Infinity/no-número cae al valor por defecto — antes dejaba la pila SIN acotar (auditoría A6)', () => {
    for (const malo of [NaN, Infinity, -Infinity, 'cien', undefined]) {
      const h = crearHistorial({ limite: malo })
      expect(h.limite).toBe(100)
    }
    // Y la pila queda realmente acotada: 105 commits → 100 snapshots.
    const h = crearHistorial({ limite: NaN })
    for (let i = 0; i < 105; i++) commit(h, estadoRecintos('EXTERIOR', [i, i]))
    expect(h.pila.length).toBe(100)
  })
})

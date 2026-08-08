import { describe, it, expect } from 'vitest'
import {
  crearHistorial,
  commit,
  reiniciar,
  reencuadrar,
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

describe('edit/historial.js — reiniciar (documento nuevo)', () => {
  it('tras varios commit y algún undo, deja la pila con un único presente', () => {
    const h = crearHistorial()
    commit(h, estadoRecintos('EXTERIOR', [1, 1]))
    commit(h, estadoRecintos('EXTERIOR', [2, 2]))
    commit(h, estadoRecintos('EXTERIOR', [3, 3]))
    undo(h) // el presente queda en medio, con rama de redo por delante
    expect(puedeDeshacer(h)).toBe(true)
    expect(puedeRehacer(h)).toBe(true)

    const nuevo = estadoRecintos('EXTERIOR', [9, 9])
    expect(reiniciar(h, nuevo)).toBe(undefined) // devuelve void

    expect(h.pila.length).toBe(1)
    expect(h.indice).toBe(0)
    expect(puedeDeshacer(h)).toBe(false)
    expect(puedeRehacer(h)).toBe(false)
    // Ni el pasado ni la rama de redo sobreviven.
    expect(undo(h)).toBe(null)
    expect(redo(h)).toBe(null)
    expect(h.pila[0]).toEqual(nuevo)
  })

  it('el estado sembrado es un CLON independiente: mutarlo fuera no cambia la pila', () => {
    const h = crearHistorial()
    const semilla = estadoRecintos('EXTERIOR', [1, 2])
    reiniciar(h, semilla)

    // Mutación en profundidad del objeto que se pasó.
    semilla.recintos[0].vertices[0][0] = 999
    semilla.recintos[0].tipo = 'MUTADO'
    semilla.recintos.push({ vertices: [[7, 8]], tipo: 'HUECO' })

    expect(h.pila[0]).toEqual(estadoRecintos('EXTERIOR', [1, 2]))
    expect(h.pila[0].recintos).toHaveLength(1)
    expect(h.pila[0]).not.toBe(semilla)
    expect(h.pila[0].recintos[0].vertices[0]).not.toBe(semilla.recintos[0].vertices[0])

    // Y se puede volver a él: commit + undo devuelve la semilla ORIGINAL.
    commit(h, estadoRecintos('HUECO', [5, 6]))
    expect(puedeDeshacer(h)).toBe(true)
    expect(undo(h)).toEqual(estadoRecintos('EXTERIOR', [1, 2]))
  })

  it('conserva `limite` (es configuración, no historia)', () => {
    const h = crearHistorial({ limite: 3 })
    for (let i = 0; i < 5; i++) commit(h, estadoRecintos('EXTERIOR', [i, i]))
    expect(h.limite).toBe(3)

    reiniciar(h, estadoRecintos('EXTERIOR', [0, 0]))
    expect(h.limite).toBe(3)

    // Y el límite sigue OPERATIVO tras el reinicio: la pila se vuelve a acotar.
    for (let i = 1; i <= 5; i++) commit(h, estadoRecintos('EXTERIOR', [i, i]))
    expect(h.pila.length).toBe(3)
  })

  it('sobre un historial recién creado (pila vacía, indice -1) siembra igual', () => {
    const h = crearHistorial()
    expect(h.indice).toBe(-1)
    reiniciar(h, estadoRecintos('EXTERIOR', [4, 4]))
    expect(h.pila.length).toBe(1)
    expect(h.indice).toBe(0)
    expect(undo(h)).toBe(null)
    expect(redo(h)).toBe(null)
  })

  it('vacía la pila EN SITIO: quien tenga la referencia al array ve el reinicio', () => {
    const h = crearHistorial()
    commit(h, estadoRecintos('EXTERIOR', [1, 1]))
    commit(h, estadoRecintos('EXTERIOR', [2, 2]))
    const pilaAntes = h.pila

    reiniciar(h, estadoRecintos('EXTERIOR', [3, 3]))

    expect(h.pila).toBe(pilaAntes) // mismo array, no uno nuevo
    expect(pilaAntes.length).toBe(1)
  })

  it('reiniciar dos veces seguidas deja siempre un único presente', () => {
    const h = crearHistorial()
    reiniciar(h, estadoRecintos('EXTERIOR', [1, 1]))
    commit(h, estadoRecintos('EXTERIOR', [2, 2]))
    reiniciar(h, estadoRecintos('HUECO', [3, 3]))
    expect(h.pila.length).toBe(1)
    expect(h.indice).toBe(0)
    expect(h.pila[0]).toEqual(estadoRecintos('HUECO', [3, 3]))
    expect(puedeDeshacer(h)).toBe(false)
    expect(puedeRehacer(h)).toBe(false)
  })
})

describe('edit/historial.js — reencuadrar (cambia el fondo, no el documento)', () => {
  // Fondo oficial con la forma real: recintos de vértices [x,y]. Es lo que el
  // llamante mete en TODOS los snapshots con una sola referencia.
  const oficialPrueba = () => [
    { vertices: [[0, 0], [10, 0], [10, 10], [0, 0]], tipo: 'EXTERIOR' },
  ]

  // Congelado en profundidad, como el que hace `model/parcela.js` con
  // `geometriaOficial`. Local al test: aquí se usa para REFUTAR que el congelado
  // sea la barrera, no para depender de él.
  const congelarHondo = (valor) => {
    if (valor !== null && typeof valor === 'object') {
      for (const k of Object.keys(valor)) congelarHondo(valor[k])
      Object.freeze(valor)
    }
    return valor
  }

  // Historial con tres pasos de edición y el presente deshecho una vez: hay
  // pasado, presente y rama de redo. Es el caso que más partes puede romper.
  const historialConTresPasos = () => {
    const h = crearHistorial()
    commit(h, estadoRecintos('EXTERIOR', [1, 1]))
    commit(h, estadoRecintos('EXTERIOR', [2, 2]))
    commit(h, estadoRecintos('EXTERIOR', [3, 3]))
    undo(h) // presente en medio, con rama de redo por delante
    return h
  }

  it('el fondo entra en TODA la historia: deshacer ya no lo borra', () => {
    const h = historialConTresPasos()
    const oficial = oficialPrueba()

    // Antes: ningún snapshot tiene fondo. Es el defecto que esto viene a evitar
    // — sin reencuadrar, el primer Ctrl+Z devolvía un estado SIN geometría oficial
    // y el parcelario desaparecía sin que nada lo explicara.
    expect(h.pila.every((e) => e.geometriaOficial === undefined)).toBe(true)

    reencuadrar(h, (estado) => ({ ...estado, geometriaOficial: oficial }))

    // El pasado, el presente y la rama de redo llevan el fondo.
    expect(undo(h).geometriaOficial).toEqual(oficial)
    expect(redo(h).geometriaOficial).toEqual(oficial)
    expect(redo(h).geometriaOficial).toEqual(oficial)
  })

  it('deja intactos los recintos, la longitud de la pila y el puntero de undo', () => {
    const h = historialConTresPasos()
    const indiceAntes = h.indice
    const recintosAntes = h.pila.map((e) => structuredClone(e.recintos))

    reencuadrar(h, (estado) => ({ ...estado, geometriaOficial: oficialPrueba() }))

    expect(h.pila).toHaveLength(3)
    expect(h.indice).toBe(indiceAntes)
    expect(h.pila.map((e) => e.recintos)).toEqual(recintosAntes)
    // Las capacidades no cambian: sigue siendo el mismo paso del mismo documento.
    expect(puedeDeshacer(h)).toBe(true)
    expect(puedeRehacer(h)).toBe(true)
  })

  it('devuelve void y rellena la pila EN SITIO (quien tenga la referencia ve el cambio)', () => {
    const h = historialConTresPasos()
    const pilaAntes = h.pila

    expect(reencuadrar(h, (estado) => ({ ...estado, fondo: 1 }))).toBe(undefined)

    expect(h.pila).toBe(pilaAntes) // mismo array, no uno nuevo
    expect(pilaAntes.every((e) => e.fondo === 1)).toBe(true)
  })

  it('`fn` recibe la entrada REAL de la pila y su índice, en orden', () => {
    const h = historialConTresPasos()
    const originales = [...h.pila]
    const recibidos = []
    const indices = []

    reencuadrar(h, (estado, i) => {
      recibidos.push(estado)
      indices.push(i)
      return { ...estado }
    })

    expect(indices).toEqual([0, 1, 2])
    expect(recibidos[0]).toBe(originales[0]) // la entrada, no un clon
    expect(recibidos[2]).toBe(originales[2])
  })

  it('ATÓMICO: si `fn` lanza en el último snapshot, no se ha escrito ni el primero', () => {
    const h = historialConTresPasos()
    const antes = structuredClone(h.pila)
    const indiceAntes = h.indice

    expect(() =>
      reencuadrar(h, (estado, i) => {
        if (i === 2) throw new Error('el fondo no se pudo componer')
        return { ...estado, geometriaOficial: oficialPrueba() }
      }),
    ).toThrow('el fondo no se pudo componer')

    // Ni pila mixta ni puntero movido: el historial no se enteró.
    expect(h.pila).toEqual(antes)
    expect(h.pila.every((e) => e.geometriaOficial === undefined)).toBe(true)
    expect(h.indice).toBe(indiceAntes)
  })

  it('ATÓMICO también con un `fn` que no es función: la pila no se toca', () => {
    const h = historialConTresPasos()
    const antes = structuredClone(h.pila)

    expect(() => reencuadrar(h, null)).toThrow(TypeError)
    expect(h.pila).toEqual(antes)
  })

  it('un `fn` que no devuelve estado se detecta AQUÍ, no en el undo del usuario', () => {
    // El error realista: llaves en la flecha y olvidar el `return`. Sin la guarda,
    // la pila quedaría llena de `undefined` y el fallo saldría mucho después.
    for (const malo of [undefined, null, 42, 'estado']) {
      const h = historialConTresPasos()
      const antes = structuredClone(h.pila)
      expect(() => reencuadrar(h, () => malo)).toThrow(TypeError)
      expect(h.pila).toEqual(antes) // sigue siendo atómico
    }

    const h = historialConTresPasos()
    expect(() => reencuadrar(h, (estado, i) => (i === 1 ? undefined : estado))).toThrow(
      /snapshot 1/,
    )
  })

  it('COMPARTE la referencia: N snapshots, un solo objeto de fondo (no N copias)', () => {
    const h = historialConTresPasos()
    const oficial = oficialPrueba()

    reencuadrar(h, (estado) => ({ ...estado, geometriaOficial: oficial }))

    expect(h.pila[0].geometriaOficial).toBe(oficial)
    expect(h.pila[1].geometriaOficial).toBe(oficial)
    expect(h.pila[2].geometriaOficial).toBe(oficial)
  })

  it('compartir es seguro porque `undo`/`redo` clonan a la salida (esa es la barrera real)', () => {
    const h = historialConTresPasos()
    const oficial = oficialPrueba()
    reencuadrar(h, (estado) => ({ ...estado, geometriaOficial: oficial }))

    const devuelto = undo(h)
    // Lo que sale del módulo es copia fresca, aunque dentro se comparta.
    expect(devuelto.geometriaOficial).toEqual(oficial)
    expect(devuelto.geometriaOficial).not.toBe(oficial)

    // Machacar lo devuelto no contamina ni la fuente ni ningún snapshot.
    devuelto.geometriaOficial[0].vertices[0][0] = 999
    devuelto.geometriaOficial.push({ vertices: [[7, 8]], tipo: 'HUECO' })
    expect(oficial[0].vertices[0][0]).toBe(0)
    expect(oficial).toHaveLength(1)
    expect(redo(h).geometriaOficial).toEqual(oficialPrueba())
  })

  it('el motivo NO es el `deepFreeze`: `structuredClone` lo descarta y los snapshots llegan DESCONGELADOS', () => {
    // Refuta la justificación fácil de compartir la referencia. `model/parcela.js`
    // congela `geometriaOficial` en profundidad, pero ese congelado NO sobrevive al
    // `structuredClone` de `commit` — el mismo hecho medido en la fase 0 de F10
    // (`test/storage/aceptacion-f10.test.js:221`). Si el congelado fuera la barrera,
    // aquí ya no habría ninguna.
    const h = crearHistorial()
    const oficial = congelarHondo(oficialPrueba())
    expect(Object.isFrozen(oficial)).toBe(true)

    commit(h, { ...estadoRecintos('EXTERIOR', [1, 1]), geometriaOficial: oficial })
    expect(Object.isFrozen(h.pila[0].geometriaOficial)).toBe(false)
    expect(Object.isFrozen(h.pila[0].geometriaOficial[0].vertices)).toBe(false)

    // Y aun descongelado, el snapshot sigue a salvo: lo que sale es un clon.
    const devuelto = undo(h)
    expect(devuelto).toBe(null) // un solo snapshot: no hay a dónde volver
    commit(h, estadoRecintos('EXTERIOR', [2, 2]))
    const anterior = undo(h)
    anterior.geometriaOficial[0].tipo = 'MUTADO'
    expect(h.pila[0].geometriaOficial[0].tipo).toBe('EXTERIOR')
  })

  it('sobre un historial vacío no hace nada (ni lanza)', () => {
    const h = crearHistorial()
    let llamadas = 0
    expect(() =>
      reencuadrar(h, (estado) => {
        llamadas++
        return estado
      }),
    ).not.toThrow()
    expect(llamadas).toBe(0)
    expect(h.pila).toHaveLength(0)
    expect(h.indice).toBe(-1)
  })

  it('reencuadrar no consume el límite: la pila sigue acotada y `commit` sigue funcionando', () => {
    const h = crearHistorial({ limite: 3 })
    for (let i = 0; i < 5; i++) commit(h, estadoRecintos('EXTERIOR', [i, i]))
    expect(h.pila).toHaveLength(3)

    reencuadrar(h, (estado) => ({ ...estado, geometriaOficial: oficialPrueba() }))
    expect(h.pila).toHaveLength(3)
    expect(h.limite).toBe(3)

    // Un commit posterior sigue acotando y descartando el más antiguo.
    commit(h, estadoRecintos('HUECO', [9, 9]))
    expect(h.pila).toHaveLength(3)
    expect(h.indice).toBe(2)
    expect(undo(h).geometriaOficial).toEqual(oficialPrueba())
  })

  it('un commit posterior al reencuadre no arrastra el fondo por su cuenta', () => {
    // Anti-vacuidad: el fondo lo mete el llamante en el estado que commitea, no
    // `reencuadrar`. Si esto empezara a pasar, es que alguien mutó en sitio.
    const h = historialConTresPasos()
    reencuadrar(h, (estado) => ({ ...estado, geometriaOficial: oficialPrueba() }))

    commit(h, estadoRecintos('HUECO', [7, 7])) // sin geometriaOficial
    expect(h.pila[h.indice].geometriaOficial).toBe(undefined)
    expect(undo(h).geometriaOficial).toEqual(oficialPrueba()) // el pasado sí lo tiene
  })
})

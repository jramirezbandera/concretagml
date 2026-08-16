/* -------------------------------------------------------------------------- *
 * test/edificio/parte-activa.test.js — El store adaptador (F12 · T3.1)        *
 *                                                                            *
 * Es la pieza que permite que `viewer/edicion.js` —1.500 líneas de F06, atadas *
 * al store de PARCELA— sirva para editar la parte de un edificio sin tocarlo.  *
 * Lo que se defiende aquí:                                                     *
 *   1. ⭐ `get()` devuelve el MISMO objeto mientras no cambie nada. Sin eso la  *
 *      caché de dianas del snap cae en cada fotograma del arrastre.            *
 *   2. `set()` no muta: reconstruye por `conParteRedibujada`.                   *
 *   3. `null` cuando no hay parte, `recintos: []` cuando la hay y no tiene      *
 *      contorno. Son dos cosas distintas y no se confunden.                     *
 *   4. El store del edificio sigue siendo el dueño: sus suscriptores viven.     *
 *   5. ⛔ **El CORRIMIENTO** (auditoría 2026-08-16, hallazgo H2). Añadido en su  *
 *      sección propia al final: la selección por índice no sobrevive a que      *
 *      desaparezca una parte de índice MENOR, y hasta esta fecha no lo cubría   *
 *      ninguna prueba —solo se probaba el fuera de rango, que es otra cosa.     *
 *                                                                              *
 * ── MUTACIONES EJECUTADAS SOBRE LA CORRECCIÓN DEL CORRIMIENTO ──               *
 * Aplicada a `edificio/parte-activa.js`, `node scripts/vitest.mjs run           *
 * --project node -- parte-activa`, y revertida con el editor (nunca con         *
 * `git checkout`):                                                              *
 *   M1 · el módulo TAL COMO ESTABA antes del arreglo (sin reconciliación) ..... *
 *        🔴 3 rojos de los 6 nuevos: la proyección, la ESCRITURA y el borrado   *
 *        de la parte elegida. Los otros tres (renombrar, añadir, eliminar una   *
 *        de índice mayor) salen verdes con y sin arreglo, y a propósito: son    *
 *        los que vigilan que la cura no sea peor que la enfermedad.             *
 *   M2 · reconciliar SIEMPRE por nombre, sin la guarda de «la lista ha          *
 *        encogido» ................................ 🔴 1 rojo: renombrar la     *
 *        parte elegida la deseleccionaba, que es un arreglo peor que el defecto.*
 * -------------------------------------------------------------------------- */

import { describe, expect, it, vi } from 'vitest'

import {
  conParteAnadida,
  conParteEliminada,
  conParteRenombrada,
} from '../../edificio/mutaciones.js'
import { crearVistaParteActiva } from '../../edificio/parte-activa.js'
import { crearEstadoVista } from '../../viewer/_comun.js'
import { ORIGEN_PARTE, crearEdificio, crearParteConstruccion } from '../../model/edificio.js'

// ── Andamiaje ─────────────────────────────────────────────────────────────────

const recinto = (dx = 0) => ({
  tipo: 'EXTERIOR',
  vertices: [
    [440000 + dx, 4100000],
    [440010 + dx, 4100000],
    [440010 + dx, 4100010],
    [440000 + dx, 4100010],
  ],
})

const edificioDeEjemplo = () =>
  crearEdificio({
    idLocal: 'EXP-edificio-1',
    partes: [
      crearParteConstruccion({ nombre: 'cuerpo', recinto: recinto(0), origen: ORIGEN_PARTE.DXF }),
      crearParteConstruccion({ nombre: 'porche', recinto: recinto(50), origen: ORIGEN_PARTE.DXF }),
      crearParteConstruccion({ nombre: 'por dibujar', origen: ORIGEN_PARTE.DIBUJADA }),
    ],
  })

const montar = (edificio = edificioDeEjemplo(), opciones) => {
  const store = crearEstadoVista(edificio)
  return { store, vista: crearVistaParteActiva(store, opciones) }
}

// ── El contrato de store ─────────────────────────────────────────────────────

describe('parte-activa · sirve como store para `crearEdicion`', () => {
  it('tiene las tres operaciones de `crearEstadoVista`, que es lo único que se le pide', () => {
    const { vista } = montar()
    for (const m of ['get', 'set', 'subscribe']) expect(typeof vista[m]).toBe('function')
  })

  it('LANZA si lo que se le da no sirve como store', () => {
    for (const malo of [null, undefined, {}, { get: 1 }, { get: () => {}, set: () => {} }]) {
      expect(() => crearVistaParteActiva(malo)).toThrow(TypeError)
    }
  })
})

// ── La proyección ────────────────────────────────────────────────────────────

describe('parte-activa · qué se ve por `get()`', () => {
  it('sin parte elegida es `null`, no un objeto vacío', () => {
    // `null` es la única respuesta que no miente: no es que la parte no tenga
    // vértices, es que no hay parte.
    const { vista } = montar()
    expect(vista.get()).toBeNull()
    expect(vista.seleccionada()).toBeNull()
  })

  it('elegida una parte, se ve con forma de parcela: `recintos`', () => {
    const { vista } = montar()
    vista.seleccionar(1)
    const doc = vista.get()
    expect(doc.recintos).toHaveLength(1)
    expect(doc.recintos[0].vertices).toEqual(recinto(50).vertices)
    expect(doc.origen).toBe(ORIGEN_PARTE.DXF)
    expect(doc.idLocal).toBe('EXP-edificio-1')
  })

  it('⭐ una parte PENDIENTE DE DIBUJAR da `recintos: []`, que no es `null`', () => {
    // Hay parte, no hay contorno. Son dos cosas distintas y el mapa las pinta
    // distinto: una no se dibuja, la otra ni existe.
    const { vista } = montar()
    vista.seleccionar(2)
    expect(vista.get()).not.toBeNull()
    expect(vista.get().recintos).toEqual([])
  })

  it('lleva de dónde sale, para que nadie lo confunda con una Parcela', () => {
    const { vista } = montar()
    vista.seleccionar(0)
    expect(vista.get().parteDeEdificio).toEqual({ indice: 0, nombre: 'cuerpo' })
  })

  it('sin edificio en el store, `null` aunque haya índice elegido', () => {
    const { store, vista } = montar()
    vista.seleccionar(0)
    store.set(null)
    expect(vista.get()).toBeNull()
  })
})

// ── La identidad, que es de lo que depende el arrastre ───────────────────────

describe('⭐ parte-activa · `get()` es ESTABLE mientras no cambie nada', () => {
  it('dos llamadas seguidas dan el MISMO objeto (identidad, no contenido)', () => {
    // `viewer/edicion.js` compara `estado.get() !== cache.parcela` para invalidar
    // el catálogo de dianas, y `ajustar` corre en cada fotograma del arrastre. Una
    // proyección nueva por llamada reconstruiría el catálogo sesenta veces por
    // segundo.
    const { vista } = montar()
    vista.seleccionar(0)
    expect(vista.get()).toBe(vista.get())
  })

  it('cien llamadas siguen dando el mismo objeto', () => {
    const { vista } = montar()
    vista.seleccionar(0)
    const primero = vista.get()
    for (let i = 0; i < 100; i += 1) expect(vista.get()).toBe(primero)
  })

  it('cambiar de parte SÍ cambia la identidad', () => {
    const { vista } = montar()
    vista.seleccionar(0)
    const a = vista.get()
    vista.seleccionar(1)
    expect(vista.get()).not.toBe(a)
  })

  it('cambiar el edificio SÍ cambia la identidad', () => {
    const { store, vista } = montar()
    vista.seleccionar(0)
    const a = vista.get()
    store.set(edificioDeEjemplo())
    expect(vista.get()).not.toBe(a)
  })
})

// ── Escribir ─────────────────────────────────────────────────────────────────

describe('parte-activa · `set()` escribe en la parte y NO muta', () => {
  const nuevos = [
    {
      tipo: 'EXTERIOR',
      vertices: [
        [1, 1],
        [5, 1],
        [5, 5],
      ],
    },
  ]

  it('los recintos van a parar a la parte elegida', () => {
    const { store, vista } = montar()
    vista.seleccionar(1)
    vista.set({ ...vista.get(), recintos: nuevos })
    expect(store.get().partes[1].recinto.vertices).toHaveLength(3)
    // …y las otras dos no se han tocado.
    expect(store.get().partes[0].recinto.vertices).toHaveLength(4)
    expect(store.get().partes[2].recinto).toBeNull()
  })

  it('el POJO anterior del store no se muta: es lo que sostiene el undo/redo', () => {
    const { store, vista } = montar()
    const antes = store.get()
    const foto = structuredClone(antes)
    vista.seleccionar(0)
    vista.set({ ...vista.get(), recintos: nuevos })
    expect(antes).toEqual(foto)
    expect(store.get()).not.toBe(antes)
  })

  it('conserva el resto de la parte: nombre, tipo, plantas y ORIGEN', () => {
    const { store, vista } = montar()
    vista.seleccionar(0)
    vista.set({ ...vista.get(), recintos: nuevos })
    const p = store.get().partes[0]
    expect(p.nombre).toBe('cuerpo')
    expect(p.origen).toBe(ORIGEN_PARTE.DXF) // editar no es una procedencia nueva
  })

  it('`recintos: []` deja la parte pendiente de dibujar, y lo DETECTA', () => {
    const alDetectar = vi.fn()
    const { store, vista } = montar(edificioDeEjemplo(), { alDetectar })
    vista.seleccionar(0)
    vista.set({ recintos: [] })
    expect(store.get().partes[0].recinto).toBeNull()
    expect(alDetectar).toHaveBeenCalledTimes(1)
    expect(alDetectar.mock.calls[0][0][0].tipo).toBe('PARTE_SIN_GEOMETRIA')
  })

  it('escribir SIN parte elegida no hace nada y NO lanza', () => {
    // Puede llegar por una carrera —soltar el arrastre justo tras deseleccionar—,
    // y eso es un suceso normal de una interfaz, no un contrato roto.
    const { store, vista } = montar()
    const antes = store.get()
    expect(() => vista.set({ recintos: nuevos })).not.toThrow()
    expect(store.get()).toBe(antes)
  })

  it('un documento sin `recintos` se trata como sin contorno, no revienta', () => {
    const { store, vista } = montar()
    vista.seleccionar(0)
    expect(() => vista.set({})).not.toThrow()
    expect(store.get().partes[0].recinto).toBeNull()
  })
})

// ── Los avisos ───────────────────────────────────────────────────────────────

describe('parte-activa · quién avisa a quién', () => {
  it('un `set` notifica a los suscriptores de la vista', () => {
    const { vista } = montar()
    const oyente = vi.fn()
    vista.subscribe(oyente)
    vista.seleccionar(0)
    expect(oyente).toHaveBeenCalledTimes(1)
    vista.set({ recintos: [] })
    expect(oyente.mock.calls.length).toBeGreaterThan(1)
  })

  it('⭐ un cambio del EDIFICIO por otra vía también llega a la vista', () => {
    // Sin esto, mover un vértice desde el panel no repintaría el mapa de la parte.
    const { store, vista } = montar()
    vista.seleccionar(0)
    const oyente = vi.fn()
    vista.subscribe(oyente)
    store.set(edificioDeEjemplo())
    expect(oyente).toHaveBeenCalledTimes(1)
  })

  it('⭐ los suscriptores del store del EDIFICIO siguen vivos: no se los queda', () => {
    // Un adaptador que se quedara los suscriptores sería un segundo dueño del
    // estado, que es lo que el rework de UI existió para quitar.
    const { store, vista } = montar()
    const delPanel = vi.fn()
    store.subscribe(delPanel)
    vista.seleccionar(0)
    vista.set({ recintos: [] })
    expect(delPanel).toHaveBeenCalledTimes(1)
  })

  it('darse de baja funciona, y `destruir` suelta el store de arriba', () => {
    const { store, vista } = montar()
    const oyente = vi.fn()
    const baja = vista.subscribe(oyente)
    baja()
    vista.seleccionar(0)
    expect(oyente).not.toHaveBeenCalled()

    const otro = vi.fn()
    vista.subscribe(otro)
    vista.destruir()
    store.set(edificioDeEjemplo())
    expect(otro).not.toHaveBeenCalled()
  })
})

// ── Seleccionar ──────────────────────────────────────────────────────────────

describe('parte-activa · seleccionar', () => {
  it('`null` deselecciona', () => {
    const { vista } = montar()
    vista.seleccionar(1)
    vista.seleccionar(null)
    expect(vista.seleccionada()).toBeNull()
    expect(vista.get()).toBeNull()
  })

  it('elegir la que ya estaba no notifica de nuevo', () => {
    const { vista } = montar()
    vista.seleccionar(1)
    const oyente = vi.fn()
    vista.subscribe(oyente)
    vista.seleccionar(1)
    expect(oyente).not.toHaveBeenCalled()
  })

  it('fuera de rango LANZA: sale de un bucle, no de un teclado', () => {
    const { vista } = montar()
    expect(() => vista.seleccionar(3)).toThrow(RangeError)
    expect(() => vista.seleccionar(-1)).toThrow(RangeError)
    expect(() => vista.seleccionar(1.5)).toThrow(TypeError)
    expect(() => vista.seleccionar('0')).toThrow(TypeError)
  })
})

// ── ⛔ EL CORRIMIENTO (auditoría 2026-08-16 · H2) ────────────────────────────
//
// Lo que estas pruebas defienden NO es el fuera de rango —eso ya estaba cubierto
// y además lo tapaba el guard de `app/cableado-edificio.js`— sino el caso en que
// el índice SIGUE SIENDO VÁLIDO y ha dejado de apuntar a la misma parte: se
// elige «porche» (índice 1) y desaparece «cuerpo» (índice 0). El índice 1 sigue
// existiendo, pero ahora es «por dibujar», y un `set()` posterior —el drop de un
// arrastre en vuelo— escribía la geometría del porche en la parte equivocada,
// sin un solo error por ninguna parte.

describe('⛔ parte-activa · una parte de índice MENOR desaparece', () => {
  /** El edificio de siempre, con «cuerpo» (0) ya eliminado. */
  const sinElCuerpo = (store) => conParteEliminada(store.get(), 0).edificio

  const nuevos = [
    {
      tipo: 'EXTERIOR',
      vertices: [
        [999, 0],
        [999, 9],
        [990, 9],
      ],
    },
  ]

  it('⭐ la proyección SIGUE a la parte elegida, no al índice', () => {
    const { store, vista } = montar()
    vista.seleccionar(1)
    expect(vista.get().parteDeEdificio).toEqual({ indice: 1, nombre: 'porche' })

    store.set(sinElCuerpo(store))

    expect(vista.seleccionada()).toBe(0)
    expect(vista.get().parteDeEdificio).toEqual({ indice: 0, nombre: 'porche' })
    expect(vista.get().recintos[0].vertices).toEqual(recinto(50).vertices)
  })

  it('⭐⭐ y `set()` escribe en «porche», NO en la parte que ocupó su índice', () => {
    // Es el defecto medido: sin corrección, estos vértices acababan en «por
    // dibujar» (medido: `C:999,0`), que es la parte equivocada — y en silencio.
    const { store, vista } = montar()
    vista.seleccionar(1)
    store.set(sinElCuerpo(store))

    vista.set({ ...vista.get(), recintos: nuevos })

    const partes = store.get().partes
    expect(partes.map((p) => p.nombre)).toEqual(['porche', 'por dibujar'])
    expect(partes[0].recinto.vertices).toHaveLength(3)
    expect(partes[1].recinto, '«por dibujar» sigue sin contorno').toBeNull()
  })

  it('eliminar la parte ELEGIDA deselecciona: no se hereda la que ocupa su hueco', () => {
    const { store, vista } = montar()
    vista.seleccionar(1)
    store.set(conParteEliminada(store.get(), 1).edificio)
    expect(vista.seleccionada()).toBeNull()
    expect(vista.get()).toBeNull()
  })

  it('una parte de índice MAYOR que desaparece no mueve la elegida', () => {
    const { store, vista } = montar()
    vista.seleccionar(0)
    store.set(conParteEliminada(store.get(), 2).edificio)
    expect(vista.seleccionada()).toBe(0)
    expect(vista.get().parteDeEdificio).toEqual({ indice: 0, nombre: 'cuerpo' })
  })

  it('⚠️ RENOMBRAR la parte elegida NO la deselecciona: la lista no ha encogido', () => {
    // La otra mitad del arreglo, y la que impide que la cura sea peor: la
    // identidad de trabajo es el NOMBRE, así que una corrección incondicional
    // por nombre habría soltado la parte cada vez que se la renombra —justo
    // mientras se la está editando.
    const { store, vista } = montar()
    vista.seleccionar(1)
    store.set(conParteRenombrada(store.get(), 1, 'ala sur').edificio)
    expect(vista.seleccionada()).toBe(1)
    expect(vista.get().parteDeEdificio).toEqual({ indice: 1, nombre: 'ala sur' })
  })

  it('añadir una parte (va al final) no mueve la elegida', () => {
    const { store, vista } = montar()
    vista.seleccionar(1)
    store.set(conParteAnadida(store.get()).edificio)
    expect(vista.seleccionada()).toBe(1)
    expect(vista.get().parteDeEdificio.nombre).toBe('porche')
  })
})

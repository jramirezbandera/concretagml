/* -------------------------------------------------------------------------- *
 * test/viewer/dibujo.dom.test.js — Los gestos de dibujar (F12 · T3.3)         *
 *                                                                            *
 * La otra mitad de `edit/dibujo.js`: aquí el ratón, el teclado y lo que se ve. *
 * Lo que se defiende:                                                          *
 *   1. ⭐ El descuento del vértice del DOBLE CLIC. Leaflet dispara `click`      *
 *      antes que `dblclick`, así que cerrar con doble clic deja un vértice de   *
 *      más si nadie lo quita. Es el defecto no evidente de este módulo.         *
 *   2. Que el punto pasa por `ajustar` —el MISMO gancho del arrastre de F06—.   *
 *   3. Que el zoom por doble clic se apaga mientras se dibuja y vuelve después. *
 *   4. Que `alCerrar` es la ÚNICA salida: aquí no se escribe en ningún store.   *
 * -------------------------------------------------------------------------- */

import L from 'leaflet'
import { describe, expect, it, vi } from 'vitest'

import { MENSAJE_CANCELADO, MENSAJE_EMPEZAR, crearDibujo } from '../../viewer/dibujo.js'
import { NIVEL, latLngAUTM, vertUTMaLatLng } from '../../viewer/_comun.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

const HUSO = 30
const ZOOM = 18

/** Cuatro esquinas de un rectángulo pequeño, en UTM del huso 30. */
const V = Object.freeze({
  A: [439240, 4479655],
  B: [439260, 4479655],
  C: [439260, 4479670],
  D: [439240, 4479670],
})

const aLatLng = (utm) => vertUTMaLatLng(utm, HUSO)

function montar({ ajustar = null, alCerrar = vi.fn(), alAvisar = vi.fn() } = {}) {
  const { mapa, destruir: destruirMapa } = montarMapa({ zoom: ZOOM })
  crearPanes(mapa)
  const dibujo = crearDibujo({ mapa, zona: HUSO, ajustar, alCerrar, alAvisar })
  return {
    mapa,
    dibujo,
    alCerrar,
    alAvisar,
    /** Simula un clic del usuario en un punto UTM. */
    clic(utm) {
      mapa.fire('click', { latlng: L.latLng(aLatLng(utm)) })
    },
    dobleClic(utm) {
      mapa.fire('dblclick', { latlng: L.latLng(aLatLng(utm)), originalEvent: new MouseEvent('dblclick') })
    },
    tecla(key) {
      document.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
    },
    limpiar() {
      dibujo.destruir()
      destruirMapa()
    },
  }
}

const mensajes = (alAvisar) => alAvisar.mock.calls.map(([m]) => m)

// ── Contratos del programador ────────────────────────────────────────────────

describe('crearDibujo · contratos', () => {
  it('LANZA sin mapa, sin zona válida o sin `alCerrar`', () => {
    const { mapa, destruir } = montarMapa({ zoom: ZOOM })
    expect(() => crearDibujo({ zona: HUSO, alCerrar: () => {} })).toThrow(TypeError)
    expect(() => crearDibujo({ mapa, zona: 99, alCerrar: () => {} })).toThrow(RangeError)
    expect(() => crearDibujo({ mapa, zona: HUSO })).toThrow(TypeError)
    expect(() => crearDibujo({ mapa, zona: HUSO, alCerrar: () => {}, ajustar: 'no' })).toThrow(
      TypeError,
    )
    destruir()
  })

  it('`alCerrar` obligatorio, y el mensaje dice por qué', () => {
    const { mapa, destruir } = montarMapa({ zoom: ZOOM })
    expect(() => crearDibujo({ mapa, zona: HUSO })).toThrow(/única salida/i)
    destruir()
  })
})

// ── Empezar y poner vértices ─────────────────────────────────────────────────

describe('crearDibujo · el trazo', () => {
  it('antes de empezar, los clics no hacen nada', () => {
    const ctx = montar()
    ctx.clic(V.A)
    expect(ctx.dibujo.nVertices()).toBe(0)
    expect(ctx.dibujo.dibujando()).toBe(false)
    ctx.limpiar()
  })

  it('`empezar` enciende los gestos y lo dice con los tres que hacen falta', () => {
    const ctx = montar()
    expect(ctx.dibujo.empezar()).toBe(true)
    expect(ctx.dibujo.dibujando()).toBe(true)
    expect(mensajes(ctx.alAvisar)).toContain(MENSAJE_EMPEZAR)
    ctx.clic(V.A)
    ctx.clic(V.B)
    expect(ctx.dibujo.nVertices()).toBe(2)
    ctx.limpiar()
  })

  it('empezar dos veces no tira lo que llevas puesto', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    expect(ctx.dibujo.empezar()).toBe(false)
    expect(ctx.dibujo.nVertices()).toBe(2)
    ctx.limpiar()
  })

  it('`sePuedeCerrar` solo con tres o más', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    expect(ctx.dibujo.sePuedeCerrar()).toBe(false)
    ctx.clic(V.A)
    ctx.clic(V.B)
    expect(ctx.dibujo.sePuedeCerrar()).toBe(false)
    ctx.clic(V.C)
    expect(ctx.dibujo.sePuedeCerrar()).toBe(true)
    ctx.limpiar()
  })

  it('Retroceso quita el último', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.tecla('Backspace')
    expect(ctx.dibujo.nVertices()).toBe(1)
    ctx.limpiar()
  })

  it('un punto repetido no avisa: es ruido del enganche, no un error del usuario', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    const antes = mensajes(ctx.alAvisar).length
    ctx.clic(V.A)
    expect(ctx.dibujo.nVertices()).toBe(1)
    expect(mensajes(ctx.alAvisar).length).toBe(antes)
    ctx.limpiar()
  })
})

// ── El enganche ──────────────────────────────────────────────────────────────

describe('crearDibujo · el punto pasa por `ajustar`', () => {
  it('⭐ usa el MISMO gancho que el arrastre de F06, y con `excluir` nulo', () => {
    // Aquí no se está moviendo ningún vértice existente: no hay nada que excluir
    // del catálogo de dianas.
    const ajustar = vi.fn(() => ({ punto: [439999, 4479999], enganchado: true }))
    const ctx = montar({ ajustar })
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    expect(ajustar).toHaveBeenCalledTimes(1)
    expect(ajustar.mock.calls[0][1]).toBeNull()
    ctx.dibujo.cerrar() // no llega a 3, pero deja ver el punto guardado
    ctx.limpiar()
  })

  it('lo que devuelve `ajustar` es lo que se guarda, no el punto del clic', () => {
    // El enganche desplaza cada punto medio metro: así se distingue lo guardado de
    // lo pinchado sin que dos clics acaben en el mismo sitio (que sería
    // `PUNTO_REPETIDO` y no habría recinto que cerrar).
    const ctx = montar({ ajustar: (crudo) => ({ punto: [crudo[0] + 0.5, crudo[1]], enganchado: true }) })
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.dibujo.cerrar()
    const recinto = ctx.alCerrar.mock.calls[0][0]
    expect(recinto.vertices).toHaveLength(3)
    expect(recinto.vertices[0][0]).toBeCloseTo(V.A[0] + 0.5, 0)
  })

  it('sin `ajustar` entra el punto crudo del clic', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.dibujo.cerrar()
    const recinto = ctx.alCerrar.mock.calls[0][0]
    expect(recinto.vertices[0][0]).toBeCloseTo(V.A[0], 0)
    ctx.limpiar()
  })
})

// ── Cerrar ───────────────────────────────────────────────────────────────────

describe('crearDibujo · cerrar', () => {
  it('`alCerrar` recibe un EXTERIOR con sus vértices, y es la única salida', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    expect(ctx.dibujo.cerrar()).toBe(true)
    expect(ctx.alCerrar).toHaveBeenCalledTimes(1)
    const recinto = ctx.alCerrar.mock.calls[0][0]
    expect(recinto.tipo).toBe('EXTERIOR')
    expect(recinto.vertices).toHaveLength(3)
    // Y al cerrar se deja de dibujar.
    expect(ctx.dibujo.dibujando()).toBe(false)
    ctx.limpiar()
  })

  it('con menos de tres NO cierra y avisa como ERROR', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    expect(ctx.dibujo.cerrar()).toBe(false)
    expect(ctx.alCerrar).not.toHaveBeenCalled()
    const niveles = ctx.alAvisar.mock.calls.map(([, d]) => d && d.nivel)
    expect(niveles).toContain(NIVEL.ERROR)
    ctx.limpiar()
  })

  it('Enter cierra igual que el botón', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.tecla('Enter')
    expect(ctx.alCerrar).toHaveBeenCalledTimes(1)
    expect(ctx.alCerrar.mock.calls[0][0].vertices).toHaveLength(3)
    ctx.limpiar()
  })

  it('⭐ el doble clic cierra SIN dejar un vértice de más ni quitar uno bueno', () => {
    // Un doble clic de verdad son DOS `click` en el mismo punto y luego el
    // `dblclick`. El segundo `click` ya lo ignora `edit/dibujo.js`
    // (`PUNTO_REPETIDO`), así que aquí no hay nada que descontar: pinchar A, B, C
    // y cerrar con doble clic en D tiene que dar CUATRO vértices.
    //
    // ⚠️ Esta prueba cazó un error de diseño real: la primera versión descontaba
    // el último a mano y devolvía un triángulo.
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.clic(V.D) // primer clic del doble
    ctx.clic(V.D) // segundo clic del doble → PUNTO_REPETIDO, se ignora
    expect(ctx.dibujo.nVertices()).toBe(4)
    ctx.dobleClic(V.D)
    expect(ctx.alCerrar).toHaveBeenCalledTimes(1)
    expect(ctx.alCerrar.mock.calls[0][0].vertices).toHaveLength(4)
    ctx.limpiar()
  })

  it('el recinto más pequeño se puede cerrar con doble clic: tres vértices', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.clic(V.C) // el segundo clic del doble, ignorado
    ctx.dobleClic(V.C)
    expect(ctx.alCerrar).toHaveBeenCalledTimes(1)
    expect(ctx.alCerrar.mock.calls[0][0].vertices).toHaveLength(3)
    ctx.limpiar()
  })
})

// ── Cancelar ─────────────────────────────────────────────────────────────────

describe('crearDibujo · cancelar', () => {
  it('Escape tira el trazo y no llama a `alCerrar`', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.tecla('Escape')
    expect(ctx.dibujo.dibujando()).toBe(false)
    expect(ctx.dibujo.nVertices()).toBe(0)
    expect(ctx.alCerrar).not.toHaveBeenCalled()
    expect(mensajes(ctx.alAvisar)).toContain(MENSAJE_CANCELADO)
    ctx.limpiar()
  })

  it('cancelar sin haber puesto nada no dice nada: no se ha perdido nada', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    const antes = mensajes(ctx.alAvisar).length
    ctx.dibujo.cancelar()
    expect(mensajes(ctx.alAvisar).length).toBe(antes)
    ctx.limpiar()
  })

  it('tras cancelar, los clics ya no ponen vértices', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.dibujo.cancelar()
    ctx.clic(V.B)
    expect(ctx.dibujo.nVertices()).toBe(0)
    ctx.limpiar()
  })
})

// ── El zoom por doble clic ───────────────────────────────────────────────────

describe('crearDibujo · el zoom por doble clic', () => {
  it('⛔ se apaga mientras se dibuja: cerrar no puede ampliar además', () => {
    const ctx = montar()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(true)
    ctx.dibujo.empezar()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(false)
    ctx.dibujo.cancelar()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(true)
    ctx.limpiar()
  })

  it('también vuelve al cerrar y al destruir', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.dibujo.cerrar()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(true)

    ctx.dibujo.empezar()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(false)
    ctx.dibujo.destruir()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(true)
    ctx.limpiar()
  })
})

// ── Lo que se ve ─────────────────────────────────────────────────────────────

describe('crearDibujo · la pintura', () => {
  /**
   * Las capas DIBUJADAS, no todas las del mapa.
   *
   * ⚠️ Se filtra por `L.Path` a propósito: la primera vez que se pinta un
   * `circleMarker`, Leaflet añade además su **renderer SVG** como una capa más del
   * mapa, y ése no se retira al quitar la geometría — es de Leaflet, no nuestro.
   * Contarlo daba un «queda una capa sin limpiar» que era mentira.
   */
  const capas = (mapa) => {
    const todas = []
    mapa.eachLayer((c) => {
      if (c instanceof L.Path) todas.push(c)
    })
    return todas
  }

  it('pinta un punto por vértice y la polilínea desde el segundo', () => {
    const ctx = montar()
    const antes = capas(ctx.mapa).length
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    expect(capas(ctx.mapa).length).toBe(antes + 1) // solo el punto
    ctx.clic(V.B)
    expect(capas(ctx.mapa).length).toBe(antes + 3) // dos puntos + la línea
    ctx.limpiar()
  })

  it('al cancelar no queda nada pintado', () => {
    const ctx = montar()
    const antes = capas(ctx.mapa).length
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.dibujo.cancelar()
    expect(capas(ctx.mapa).length).toBe(antes)
    ctx.limpiar()
  })

  it('al cerrar tampoco: lo definitivo lo pinta quien tenga el modelo', () => {
    const ctx = montar()
    const antes = capas(ctx.mapa).length
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.dibujo.cerrar()
    expect(capas(ctx.mapa).length).toBe(antes)
    ctx.limpiar()
  })

  it('destruir deja el mapa como se lo encontró', () => {
    const ctx = montar()
    const antes = capas(ctx.mapa).length
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.dibujo.destruir()
    expect(capas(ctx.mapa).length).toBe(antes)
    // Y ya no reacciona a nada.
    ctx.clic(V.C)
    expect(ctx.dibujo.nVertices()).toBe(0)
    ctx.limpiar()
  })
})

// ── No escribe en ningún store ───────────────────────────────────────────────

describe('crearDibujo · no toca el modelo', () => {
  it('la única salida es `alCerrar`: no hay store por ninguna parte', () => {
    // Un módulo del visor que escribiera en el modelo sería el defecto que el
    // rework de UI vino a quitar. Se comprueba por la API: no acepta store.
    const ctx = montar()
    expect(typeof ctx.dibujo.empezar).toBe('function')
    expect('set' in ctx.dibujo).toBe(false)
    expect('estado' in ctx.dibujo).toBe(false)
    ctx.limpiar()
  })

  it('el punto que entra es el del clic, convertido a UTM del huso', () => {
    const ctx = montar()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.dibujo.cerrar()
    const [x, y] = ctx.alCerrar.mock.calls[0][0].vertices[0]
    const esperado = latLngAUTM(L.latLng(aLatLng(V.A)), HUSO)
    expect(x).toBeCloseTo(esperado[0], 6)
    expect(y).toBeCloseTo(esperado[1], 6)
    ctx.limpiar()
  })
})

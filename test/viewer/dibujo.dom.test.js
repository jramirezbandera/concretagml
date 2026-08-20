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
import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  CLASE_PUNTO_CIERRE,
  CLASE_PUNTO_TRAZO,
  MENSAJE_CANCELADO,
  MENSAJE_EMPEZAR,
  crearDibujo,
} from '../../viewer/dibujo.js'
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

function montar({
  ajustar = null,
  alSoltarEnganche = null,
  alCerrar = vi.fn(),
  alAvisar = vi.fn(),
} = {}) {
  const { mapa, destruir: destruirMapa } = montarMapa({ zoom: ZOOM })
  crearPanes(mapa)
  const dibujo = crearDibujo({ mapa, zona: HUSO, ajustar, alSoltarEnganche, alCerrar, alAvisar })
  return {
    mapa,
    dibujo,
    alCerrar,
    alAvisar,
    alSoltarEnganche,
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
    /** Mueve el puntero por el mapa (el gesto que ARMA el cierre). */
    mover(utm) {
      mapa.fire('mousemove', { latlng: L.latLng(aLatLng(utm)) })
    },
    /** Los `L.CircleMarker` del trazo que hay ahora mismo en el mapa. */
    marcadores() {
      const puestos = []
      mapa.eachLayer((capa) => {
        if (capa instanceof L.CircleMarker) puestos.push(capa)
      })
      return puestos
    },
    /**
     * Un punto UTM desplazado `px` píxeles hacia el este EN PANTALLA. Es la única
     * forma honesta de probar un umbral de puntería: convertir metros a píxeles a
     * mano repetiría aquí el cálculo que se está probando.
     */
    aPixelesDe(utm, px) {
      const p = mapa.latLngToContainerPoint(L.latLng(aLatLng(utm)))
      const ll = mapa.containerPointToLatLng(L.point(p.x + px, p.y))
      return latLngAUTM(ll, HUSO)
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
    expect(() =>
      crearDibujo({ mapa, zona: HUSO, alCerrar: () => {}, alSoltarEnganche: 'no' }),
    ).toThrow(TypeError)
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

// ── `alCambiar`: el canal que faltaba (2026-08-18) ───────────────────────────
//
// De las CINCO formas de terminar un dibujo, solo una avisaba a quien lo mandó
// empezar: cerrar bien, por `alCerrar`. `Escape`, `Enter` con menos de tres
// vértices, el doble clic corto y `destruir()` paraban el trazo en silencio, y el
// botón de la barra se quedaba diciendo «Cancelar dibujo» sobre un dibujo que ya
// no existía. En la rama PARCELA eso es peor que cosmético: allí el cableado apaga
// la edición mientras se dibuja, y sin aviso se quedaría apagada para siempre.

describe('crearDibujo · alCambiar', () => {
  it('emite al empezar y al parar, y solo cuando cambia de verdad', () => {
    const ctx = montar()
    const visto = []
    ctx.dibujo.alCambiar((d) => visto.push(d))

    ctx.dibujo.empezar()
    expect(visto).toEqual([true])
    // Empezar dos veces es la misma intención dicha dos veces, no un cambio.
    ctx.dibujo.empezar()
    expect(visto).toEqual([true])

    ctx.dibujo.cancelar()
    expect(visto).toEqual([true, false])
    // Y cancelar sin dibujar tampoco emite: `parar` sale antes.
    ctx.dibujo.cancelar()
    expect(visto).toEqual([true, false])
    ctx.limpiar()
  })

  it('⛔ las cuatro salidas SILENCIOSAS ahora avisan', () => {
    for (const terminar of [
      (ctx) => ctx.tecla('Escape'),
      (ctx) => ctx.tecla('Enter'), // con 3 vértices: cierra
      (ctx) => ctx.dobleClic([440020, 4480000]),
      (ctx) => ctx.dibujo.destruir(),
    ]) {
      const ctx = montar()
      const visto = []
      ctx.dibujo.alCambiar((d) => visto.push(d))
      ctx.dibujo.empezar()
      ctx.clic([440000, 4480000])
      ctx.clic([440010, 4480000])
      ctx.clic([440020, 4480000])
      terminar(ctx)
      expect(visto.at(-1), 'esta salida no ha avisado').toBe(false)
      expect(ctx.dibujo.dibujando()).toBe(false)
      ctx.limpiar()
    }
  })

  it('devuelve la BAJA, y admite más de un oyente', () => {
    // `Set` y no callback único: la barra quiere saberlo y el cableado también, y
    // el segundo en llegar no puede desalojar al primero.
    const ctx = montar()
    const a = []
    const b = []
    const baja = ctx.dibujo.alCambiar((d) => a.push(d))
    ctx.dibujo.alCambiar((d) => b.push(d))

    ctx.dibujo.empezar()
    expect(a).toEqual([true])
    expect(b).toEqual([true])

    baja()
    ctx.dibujo.cancelar()
    expect(a).toEqual([true])
    expect(b).toEqual([true, false])
    ctx.limpiar()
  })

  it('un oyente que LANZA no se lleva por delante ni a los demás ni al gesto', () => {
    // Esto corre en mitad de un `keydown`. Un oyente roto no puede dejar el trazo
    // a medias ni impedir que el siguiente se entere.
    const ctx = montar()
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const visto = []
    ctx.dibujo.alCambiar(() => {
      throw new Error('prueba')
    })
    ctx.dibujo.alCambiar((d) => visto.push(d))

    expect(() => ctx.dibujo.empezar()).not.toThrow()
    expect(visto).toEqual([true])
    expect(error).toHaveBeenCalled()
    error.mockRestore()
    ctx.limpiar()
  })

  it('exige una función', () => {
    const ctx = montar()
    expect(() => ctx.dibujo.alCambiar(null)).toThrow(TypeError)
    expect(() => ctx.dibujo.alCambiar('fn')).toThrow(TypeError)
    ctx.limpiar()
  })
})

// ── ⭐ Cerrar pinchando la primera esquina (2026-08-19) ──────────────────────
//
// ⛔ **EL DEFECTO QUE ESTO CIERRA.** Hasta hoy el recinto solo se cerraba con doble
// clic o `Enter`, y pinchar el primer vértice **no cerraba**: añadía un vértice
// duplicado encima, porque `edit/dibujo.js#anadirPunto` compara el punto nuevo
// contra el ANTERIOR y no contra el primero. El usuario, viendo que no cerraba,
// seguía pinchando y acumulaba vértices en el mismo sitio.
describe('viewer/dibujo · el clic sobre la primera esquina CIERRA', () => {
  const abiertos = []
  afterEach(() => {
    while (abiertos.length > 0) abiertos.pop()()
  })
  const abrir = (opciones) => {
    const ctx = montar(opciones)
    abiertos.push(ctx.limpiar)
    return ctx
  }

  it('⭐ tres esquinas y un clic en la primera: recinto cerrado, sin doble clic', () => {
    const ctx = abrir()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.clic(V.A)

    expect(ctx.alCerrar).toHaveBeenCalledTimes(1)
    const recinto = ctx.alCerrar.mock.calls[0][0]
    // TRES vértices, no cuatro: el clic que cierra NO es un vértice más.
    expect(recinto.vertices).toHaveLength(3)
    expect(ctx.dibujo.dibujando()).toBe(false)
  })

  it('acertar dentro del radio de puntería basta: no hay que dar en el píxel exacto', () => {
    // Es la razón de ser del cambio. Con la tolerancia del ENGANCHE (0,2 m) el
    // primer vértice pide dos píxeles de puntería a escala de finca.
    const ctx = abrir()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.clic(ctx.aPixelesDe(V.A, 8)) // dentro de los 12 px

    expect(ctx.alCerrar).toHaveBeenCalledTimes(1)
  })

  it('⛔ y FUERA del radio pone un vértice, no cierra: la diana tiene borde', () => {
    const ctx = abrir()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.clic(ctx.aPixelesDe(V.A, 40))

    expect(ctx.alCerrar).not.toHaveBeenCalled()
    expect(ctx.dibujo.nVertices()).toBe(4)
    expect(ctx.dibujo.dibujando()).toBe(true)
  })

  it('⚠️ con DOS esquinas puestas, pinchar la primera pone su vértice y NO se queja', () => {
    // `sePuedeCerrar` manda. Soltar aquí «hacen falta al menos tres» sería regañar
    // al usuario por un clic que la aplicación no le ha ofrecido como cierre: el
    // primer vértice ni siquiera se ha agrandado todavía.
    const ctx = abrir()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.A)

    expect(ctx.alCerrar).not.toHaveBeenCalled()
    expect(ctx.dibujo.nVertices()).toBe(3)
    expect(mensajes(ctx.alAvisar).join(' ')).not.toMatch(/al menos tres/i)
  })

  it('⭐ la primera esquina se AGRANDA solo cuando ya se puede cerrar', () => {
    // Un grafismo que anuncie una diana que no lo es es un mando que miente, la
    // misma regla que gobierna los botones de esta aplicación.
    const ctx = abrir()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    expect(ctx.marcadores().every((m) => m.options.className === CLASE_PUNTO_TRAZO)).toBe(true)

    ctx.clic(V.C)
    const conTres = ctx.marcadores()
    expect(conTres[0].options.className).toBe(CLASE_PUNTO_CIERRE)
    expect(conTres[0].options.radius).toBeGreaterThan(conTres[1].options.radius)
  })

  it('y se RELLENA al acercarle el puntero: es el aviso de que ese clic cierra', () => {
    const ctx = abrir()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)

    const cierre = ctx.marcadores()[0]
    expect(cierre.options.fillOpacity).toBe(0)
    ctx.mover(V.A)
    expect(cierre.options.fillOpacity).toBe(1)
    // Y se suelta al alejarse: no es un estado del que no se pueda salir.
    ctx.mover(V.C)
    expect(cierre.options.fillOpacity).toBe(0)
  })

  it('⛔ el DOBLE CLIC sigue cerrando y sigue sin descontar un vértice bueno', () => {
    // El guardián de la lección de F12: pinchar A, B, C y hacer doble clic en D
    // tiene que dar un CUADRILÁTERO. Que ahora exista el cierre por clic no puede
    // haber cambiado eso.
    const ctx = abrir()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.clic(V.D) // primer clic del doble
    ctx.clic(V.D) // segundo clic del doble -> PUNTO_REPETIDO, se ignora
    ctx.dobleClic(V.D)

    expect(ctx.alCerrar).toHaveBeenCalledTimes(1)
    expect(ctx.alCerrar.mock.calls[0][0].vertices).toHaveLength(4)
  })

  it('⛔ y hacer DOBLE clic sobre la primera esquina cierra UNA vez, no dos', () => {
    // Leaflet dispara los dos `click` del doble antes que el `dblclick`. El primero
    // ya cierra y deja `dibujando` en false, así que el segundo sale por la guarda
    // de `alClic`. Sin ella, `alCerrar` se llamaría sobre un trazo ya entregado.
    const ctx = abrir()
    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    ctx.clic(V.A) // primer clic del doble: CIERRA
    ctx.clic(V.A) // segundo: el dibujo ya no está en marcha

    expect(ctx.alCerrar).toHaveBeenCalledTimes(1)
    expect(ctx.alCerrar.mock.calls[0][0].vertices).toHaveLength(3)
  })

  it('el mensaje de arranque nombra el gesto nuevo el PRIMERO', () => {
    const ctx = abrir()
    ctx.dibujo.empezar()
    expect(MENSAJE_EMPEZAR).toMatch(/vuelve a pinchar la primera/i)
    expect(mensajes(ctx.alAvisar)).toContain(MENSAJE_EMPEZAR)
  })
})

// ── ⭐ Los vértices ya puestos son dianas de enganche (2026-08-19) ───────────

describe('viewer/dibujo · el trazo se engancha a sí mismo', () => {
  const abiertos = []
  afterEach(() => {
    while (abiertos.length > 0) abiertos.pop()()
  })

  it('⭐ `ajustar` recibe los vértices ya puestos como `dianasExtra`', () => {
    // El catálogo del enganche se construye sobre el MODELO, y el recinto que se
    // está dibujando todavía no está en él: sin esto no hay forma de clavar un
    // vértice justo encima de otro que uno mismo acaba de poner.
    const ajustar = vi.fn((utm) => ({ punto: utm, enganchado: false, tipo: null }))
    const ctx = montar({ ajustar })
    abiertos.push(ctx.limpiar)

    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)

    const ultima = ajustar.mock.calls.at(-1)
    expect(ultima[1]).toBeNull() // no se está moviendo ningún vértice existente
    // ⚠️ `toBeCloseTo` y no `toEqual`: el punto ha ido y vuelto de lat/lon, así que
    // arrastra el error de coma flotante de la proyección. Lo que se comprueba es
    // que llega el vértice A, no que la reproyección sea exacta al bit.
    expect(ultima[3].dianasExtra).toHaveLength(1)
    expect(ultima[3].dianasExtra[0][0]).toBeCloseTo(V.A[0], 6)
    expect(ultima[3].dianasExtra[0][1]).toBeCloseTo(V.A[1], 6)
  })

  it('el primer clic no lleva ninguna: todavía no hay nada puesto', () => {
    const ajustar = vi.fn((utm) => ({ punto: utm, enganchado: false, tipo: null }))
    const ctx = montar({ ajustar })
    abiertos.push(ctx.limpiar)

    ctx.dibujo.empezar()
    ctx.clic(V.A)
    expect(ajustar.mock.calls[0][3].dianasExtra).toEqual([])
  })
})

// ── ⭐ La previsualización del enganche al pasar el puntero (2026-08-19) ─────

describe('viewer/dibujo · el enganche se ve ANTES de pinchar', () => {
  const abiertos = []
  afterEach(() => {
    while (abiertos.length > 0) abiertos.pop()()
  })

  /**
   * Un `ajustar` que dice «he enganchado» sin mover el punto. Anunciar la captura
   * es lo que enciende el indicador en `viewer/edicion.js`; devolver el punto tal
   * cual es lo que deja que estas pruebas pongan vértices distintos y lleguen a
   * poder cerrar, que es donde vive la mitad interesante del comportamiento.
   */
  const engancharA = () => vi.fn((utm) => ({ punto: [...utm], enganchado: true, tipo: 'VERTICE' }))

  it('⭐ mover el puntero PREGUNTA al enganche, que es quien pinta el indicador', () => {
    // El defecto que esto cierra: hasta hoy `ajustar` solo se llamaba en el CLIC,
    // así que pasar por encima de un punto del levantamiento importado no enseñaba
    // nada y el enganche se descubría cuando el vértice ya estaba puesto.
    const ajustar = engancharA()
    const ctx = montar({ ajustar })
    abiertos.push(ctx.limpiar)

    ctx.dibujo.empezar()
    expect(ajustar).not.toHaveBeenCalled()

    ctx.mover(V.B)
    expect(ajustar).toHaveBeenCalledTimes(1)
    // La MISMA pregunta que hará el clic: sin vértice que excluir y con los ya
    // puestos como dianas. Si divergieran, el indicador prometería un enganche
    // distinto del que el clic va a hacer.
    expect(ajustar.mock.calls[0][1]).toBeNull()
    expect(ajustar.mock.calls[0][3].dianasExtra).toEqual([])
  })

  it('el puntero NO pone vértices: solo pregunta', () => {
    const ajustar = engancharA()
    const ctx = montar({ ajustar })
    abiertos.push(ctx.limpiar)

    ctx.dibujo.empezar()
    ctx.mover(V.A)
    ctx.mover(V.B)
    ctx.mover(V.C)
    expect(ctx.dibujo.nVertices()).toBe(0)
  })

  it('sin dibujar, mover el puntero no pregunta nada', () => {
    const ajustar = engancharA()
    const ctx = montar({ ajustar })
    abiertos.push(ctx.limpiar)

    ctx.mover(V.A)
    expect(ajustar).not.toHaveBeenCalled()
  })

  it('⚠️ sobre la primera esquina ARMADA no previsualiza: ahí el clic CIERRA', () => {
    // Dos marcas encima del mismo punto contando dos cosas distintas —«engancharás
    // aquí» y «cerrarás aquí»— es peor que una sola. Manda el aro relleno.
    const ajustar = engancharA()
    const alSoltarEnganche = vi.fn()
    const ctx = montar({ ajustar, alSoltarEnganche })
    abiertos.push(ctx.limpiar)

    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    const llamadasTrasLosClics = ajustar.mock.calls.length

    ctx.mover(V.A)
    expect(ajustar.mock.calls.length).toBe(llamadasTrasLosClics) // no ha preguntado
    expect(alSoltarEnganche).toHaveBeenCalled() // y ha apagado el indicador
    expect(ctx.marcadores()[0].options.fillOpacity).toBe(1) // el aro sí se rellena
  })

  it('⛔ al PARAR se apaga el indicador: no es pintura de este módulo', () => {
    // `limpiarPintura` no lo alcanza —lo pone `viewer/edicion.js`— y ninguna de las
    // cinco formas de terminar un dibujo pasa por un último `mousemove` que lo
    // apagara. Sin esto se queda pintado sobre un mapa en el que ya no se dibuja.
    const alSoltarEnganche = vi.fn()
    const ctx = montar({ ajustar: engancharA(), alSoltarEnganche })
    abiertos.push(ctx.limpiar)

    ctx.dibujo.empezar()
    ctx.mover(V.B)
    alSoltarEnganche.mockClear()

    ctx.tecla('Escape')
    expect(alSoltarEnganche).toHaveBeenCalledTimes(1)
  })

  it('y también al cerrar bien y al destruir', () => {
    const alSoltarEnganche = vi.fn()
    const ctx = montar({ ajustar: engancharA(), alSoltarEnganche })
    abiertos.push(ctx.limpiar)

    ctx.dibujo.empezar()
    ctx.clic(V.A)
    ctx.clic(V.B)
    ctx.clic(V.C)
    alSoltarEnganche.mockClear()
    ctx.dibujo.cerrar()
    expect(alSoltarEnganche).toHaveBeenCalledTimes(1)

    ctx.dibujo.empezar()
    alSoltarEnganche.mockClear()
    ctx.dibujo.destruir()
    expect(alSoltarEnganche).toHaveBeenCalledTimes(1)
  })

  it('un `alSoltarEnganche` que LANZA no se lleva por delante el gesto', () => {
    const alSoltarEnganche = vi.fn(() => {
      throw new Error('boom')
    })
    const ctx = montar({ ajustar: engancharA(), alSoltarEnganche })
    abiertos.push(ctx.limpiar)
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})

    ctx.dibujo.empezar()
    expect(() => ctx.tecla('Escape')).not.toThrow()
    expect(ctx.dibujo.dibujando()).toBe(false)
    expect(consola).toHaveBeenCalled()
    consola.mockRestore()
  })

  it('sin `alSoltarEnganche` no pasa nada: el gancho es opcional', () => {
    const ctx = montar({ ajustar: engancharA() })
    abiertos.push(ctx.limpiar)

    ctx.dibujo.empezar()
    ctx.mover(V.B)
    expect(() => ctx.tecla('Escape')).not.toThrow()
    expect(ctx.dibujo.dibujando()).toBe(false)
  })
})

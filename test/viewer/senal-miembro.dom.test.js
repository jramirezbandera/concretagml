/* -------------------------------------------------------------------------- *
 * test/viewer/senal-miembro.dom.test.js — «¿CUÁL DE TODAS ES ÉSTA?»            *
 *                                                                              *
 * Lo que este fichero defiende, en una frase: **que se pueda decir QUÉ         *
 * GEOMETRÍA del expediente es la de cada fila**. La zona «Para comprobar» del  *
 * panel del sobrante lista las parcelas que van dentro del fichero por su      *
 * referencia catastral, y el caso normal es que compartan once caracteres de   *
 * doce — `29053A00109007` y `29053A00109007.1`—. Sin esta capa, el usuario     *
 * tiene delante todo lo que va a firmar y no puede emparejarlo con nada de lo  *
 * que hay dibujado.                                                            *
 *                                                                              *
 * Los cuatro asuntos: que MARQUE (con sombra, o sobre una era no se ve), que   *
 * ENCUADRE (el colindante de dos millones de metros cae fuera de la pantalla), *
 * que NO ROBE EL PUNTERO (debajo se está arrastrando un vértice) y que **diga  *
 * en voz alta** lo que no ha podido señalar.                                   *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).       *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { latLngAUTM, NIVEL, PANE, PANES } from '../../viewer/_comun.js'
import {
  CLASE_SENAL,
  CLASE_SENAL_ROTULO,
  CLASE_SENAL_SOMBRA,
  crearSenalMiembro,
} from '../../viewer/senal-miembro.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

// La parcela de demo del arnés cae en el huso 30. El origen se DERIVA del centro
// del mapa montado y no se escribe a mano: así «está en pantalla» es un hecho del
// arnés y no una coincidencia de coordenadas.
const HUSO = 30
let X0 = 0
let Y0 = 0

/** Un cuadrado de `lado` metros con la esquina inferior izquierda en `(x, y)`. */
function cuadrado(x, y, lado) {
  return {
    tipo: 'EXTERIOR',
    vertices: [
      [x, y],
      [x + lado, y],
      [x + lado, y + lado],
      [x, y + lado],
    ],
  }
}

/** Un miembro del expediente de mentira, con lo que la capa lee de verdad. */
function miembro(etiqueta, { x = X0, y = Y0, lado = 10, recintos = null } = {}) {
  return { etiqueta, recintos: recintos ?? [cuadrado(x, y, lado)] }
}

let entorno = null
let avisos = []
const avisar = (mensaje, detalle) => avisos.push({ mensaje, nivel: detalle?.nivel })

beforeEach(() => {
  avisos = []
  entorno = montarMapa({ zoom: 16 })
  crearPanes(entorno.mapa)
  const centro = latLngAUTM(entorno.mapa.getCenter(), HUSO)
  X0 = centro[0] - 20
  Y0 = centro[1] - 20
})

afterEach(() => {
  entorno.destruir()
  entorno = null
})

/** El `<path>` del marco, la sombra y el rótulo que ha puesto la capa. */
const marcos = () => entorno.contenedor.querySelectorAll(`.${CLASE_SENAL}`)
const sombras = () => entorno.contenedor.querySelectorAll(`.${CLASE_SENAL_SOMBRA}`)
const rotulos = () => entorno.contenedor.querySelectorAll(`.${CLASE_SENAL_ROTULO}`)

const crear = () => crearSenalMiembro({ mapa: entorno.mapa, zona: HUSO, alAvisar: avisar })

// ── 1 · Contratos del programador ───────────────────────────────────────────

describe('crearSenalMiembro · contratos', () => {
  it('sin mapa utilizable, LANZA nombrando lo que le falta', () => {
    expect(() => crearSenalMiembro({ zona: HUSO })).toThrow(TypeError)
    expect(() => crearSenalMiembro({ mapa: { addLayer() {} }, zona: HUSO })).toThrow(
      /addLayer\/removeLayer\/getPane\/fitBounds/,
    )
  })

  it('⛔ exige `fitBounds`, y no solo lo que hace falta para pintar', () => {
    // Encuadrar es la MITAD de la razón de ser de este módulo: es lo que resuelve
    // el colindante de dos millones y medio de metros que cae fuera de pantalla.
    // Un doble sin `fitBounds` reventaría en el primer clic del usuario, no aquí.
    const cojo = {
      addLayer() {},
      removeLayer() {},
      getPane: () => ({}),
    }
    expect(() => crearSenalMiembro({ mapa: cojo, zona: HUSO })).toThrow(/fitBounds/)
  })

  it("con una 'zona' que no es un huso, LANZA y AVISA de la confusión con el srs", () => {
    expect(() => crearSenalMiembro({ mapa: entorno.mapa, zona: 25830 })).toThrow(RangeError)
    expect(() => crearSenalMiembro({ mapa: entorno.mapa, zona: 25830 })).toThrow(/husoPorSrs/)
  })

  it('sin el pane declarado, LANZA nombrándolo', () => {
    const pelado = montarMapa({ zoom: 16 })
    try {
      expect(() => crearSenalMiembro({ mapa: pelado.mapa, zona: HUSO })).toThrow(
        new RegExp(PANE.SENAL_MIEMBRO),
      )
    } finally {
      pelado.destruir()
    }
  })

  it('su pane está declarado en PANES, entre acotaciones y los vértices', () => {
    // Un puntero por debajo del relleno de aquello a lo que apunta no apunta a
    // nada; y por encima de los vértices taparía la esquina que se está moviendo.
    const z = Object.fromEntries(PANES.map((p) => [p.nombre, p.zIndex]))
    expect(z[PANE.SENAL_MIEMBRO]).toBeGreaterThan(z[PANE.ACOTACIONES])
    expect(z[PANE.SENAL_MIEMBRO]).toBeGreaterThan(z[PANE.PIEZAS])
    expect(z[PANE.SENAL_MIEMBRO]).toBeLessThan(z[PANE.VERTICES])
  })

  it("señalar algo que no es un miembro ni `null` LANZA; `null` apaga y no lanza", () => {
    const senal = crear()
    expect(() => senal.senalar('29053A01000001')).toThrow(TypeError)
    expect(() => senal.senalar([])).toThrow(TypeError)
    expect(() => senal.senalar(null)).not.toThrow()
    senal.destruir()
  })
})

// ── 2 · Lo que dibuja ───────────────────────────────────────────────────────

describe('crearSenalMiembro · el marco', () => {
  it('señalar pinta UN marco, su sombra y su rótulo; `null` los quita', () => {
    const senal = crear()
    senal.senalar(miembro('29053A00109007'))
    expect(marcos()).toHaveLength(1)
    expect(sombras()).toHaveLength(1)
    expect(rotulos()).toHaveLength(1)

    senal.senalar(null)
    expect(marcos()).toHaveLength(0)
    expect(sombras()).toHaveLength(0)
    expect(rotulos()).toHaveLength(0)
    senal.destruir()
  })

  it('⭐ señala UNA cada vez: la segunda sustituye a la primera', () => {
    // Es un PUNTERO, no una capa de datos: dos marcos a la vez no responderían a
    // «cuál de todas es ésta», la volverían a hacer.
    const senal = crear()
    senal.senalar(miembro('A'))
    senal.senalar(miembro('B', { x: X0 + 30 }))
    expect(marcos()).toHaveLength(1)
    expect(senal.senalada()).toBe('B')
    senal.destruir()
  })

  it('⭐ el rótulo dice la ETIQUETA EXACTA de la fila, y no un número', () => {
    // Ver `29053A00109007.1` escrito sobre la parcela es la respuesta literal a
    // «no sé cuál es cuál». Un `1` no lo sería: la lista no numera sus filas.
    const senal = crear()
    senal.senalar(miembro('29053A00109007.1'))
    expect(rotulos()[0].textContent).toBe('29053A00109007.1')
    senal.destruir()
  })

  it('⛔ el rótulo ESCAPA lo que le dan: la etiqueta puede ser texto del usuario', () => {
    // Es el NOMBRE que se le escribe a una finca nueva en el campo de la lista,
    // no siempre una referencia catastral. Texto tecleado dentro de una cadena de
    // HTML es la definición del agujero.
    const senal = crear()
    senal.senalar(miembro('<img src=x onerror="alert(1)">'))
    const rotulo = rotulos()[0]
    expect(rotulo.querySelector('img')).toBeNull()
    expect(rotulo.textContent).toContain('<img')
    senal.destruir()
  })

  it('sin etiqueta pinta el marco y NO pone rótulo (no inventa un nombre)', () => {
    const senal = crear()
    senal.senalar({ recintos: [cuadrado(X0, Y0, 10)] })
    expect(marcos()).toHaveLength(1)
    expect(rotulos()).toHaveLength(0)
    expect(senal.senalada()).toBe('')
    senal.destruir()
  })

  it('⛔ NO es interactivo: debajo se está arrastrando un vértice', () => {
    // Un polígono interactivo del tamaño de una parcela le robaría el puntero al
    // clic de deducción de F05 y al arrastre del vértice que hay debajo, que es
    // justo lo que el usuario está mirando cuando señala una fila.
    const senal = crear()
    senal.senalar(miembro('29053A00109007'))
    // Leaflet solo pone `.leaflet-interactive` a lo que registra como diana.
    for (const path of [...marcos(), ...sombras()]) {
      expect(path.classList.contains('leaflet-interactive')).toBe(false)
    }
    // Y el rótulo tampoco, que va con `pointer-events:none` en línea.
    expect(rotulos()[0].firstElementChild.getAttribute('style')).toContain('pointer-events:none')
    senal.destruir()
  })

  it('la sombra es MÁS GRUESA que el marco, o no asomaría por ningún lado', () => {
    const senal = crear()
    senal.senalar(miembro('29053A00109007'))
    const grosorMarco = Number(marcos()[0].getAttribute('stroke-width'))
    const grosorSombra = Number(sombras()[0].getAttribute('stroke-width'))
    expect(grosorSombra).toBeGreaterThan(grosorMarco)
    senal.destruir()
  })

  it('el marco va de trazo DISCONTINUO: el lindero de debajo se lee entre guiones', () => {
    const senal = crear()
    senal.senalar(miembro('29053A00109007'))
    expect(marcos()[0].getAttribute('stroke-dasharray')).toBeTruthy()
    senal.destruir()
  })

  it('los huecos del recinto se recortan: exterior en [0] y los huecos detrás', () => {
    const senal = crear()
    senal.senalar(
      miembro('con patio', {
        recintos: [cuadrado(X0, Y0, 30), { tipo: 'INTERIOR', vertices: cuadrado(X0 + 10, Y0 + 10, 5).vertices }],
      }),
    )
    // Un `L.polygon` con dos anillos dibuja UN path con dos subtrazos («M…Z M…Z»).
    const d = marcos()[0].getAttribute('d') ?? ''
    expect((d.match(/M/g) ?? []).length).toBe(2)
    senal.destruir()
  })
})

// ── 3 · Lo que NO se puede dibujar SE DICE ──────────────────────────────────

describe('crearSenalMiembro · la regla 1', () => {
  it('⛔ un miembro sin contorno dibujable no se calla: avisa y apaga el marco', () => {
    // El usuario ha señalado una fila y el mapa no ha hecho nada. Sin este aviso
    // el síntoma es «esta pantalla no va».
    const senal = crear()
    senal.senalar({ etiqueta: '29053A00109007', recintos: [{ tipo: 'EXTERIOR', vertices: [[X0, Y0]] }] })
    expect(marcos()).toHaveLength(0)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toMatch(/29053A00109007/)
    expect(avisos[0].mensaje).toMatch(/sigue entrando en el expediente/)
    expect(avisos[0].nivel).toBe(NIVEL.AVISO)
    senal.destruir()
  })

  it('un miembro sin recintos tampoco lanza: avisa', () => {
    const senal = crear()
    expect(() => senal.senalar({ etiqueta: 'x', recintos: [] })).not.toThrow()
    expect(avisos).toHaveLength(1)
    senal.destruir()
  })
})

// ── 4 · El encuadre ─────────────────────────────────────────────────────────

describe('crearSenalMiembro · encuadrar', () => {
  it('⭐ lleva el mapa a lo señalado: es lo que resuelve la parcela que no se ve', () => {
    const senal = crear()
    // Un miembro LEJOS del encuadre actual: el colindante que cae fuera.
    senal.senalar(miembro('lejos', { x: X0 + 4000, y: Y0 + 4000, lado: 200 }))
    const antes = entorno.mapa.getCenter()
    expect(senal.encuadrar()).toBe(true)
    const despues = entorno.mapa.getCenter()
    expect(despues.lat === antes.lat && despues.lng === antes.lng).toBe(false)
    senal.destruir()
  })

  it('sin nada señalado NO lanza y devuelve false: lo llama un clic, no un programador', () => {
    const senal = crear()
    expect(senal.encuadrar()).toBe(false)
    senal.senalar(null)
    expect(senal.encuadrar()).toBe(false)
    senal.destruir()
  })

  it('no se pasa de zoom con una astilla: se ve un marco pequeño, no una mancha', () => {
    // Sin tope, encuadrar 4 m² dispararía el mapa a zoom 22 y el usuario perdería
    // toda referencia de dónde está.
    const senal = crear()
    senal.senalar(miembro('astilla', { lado: 2 }))
    senal.encuadrar()
    expect(entorno.mapa.getZoom()).toBeLessThanOrEqual(20)
    senal.destruir()
  })
})

// ── 5 · Desmontaje ──────────────────────────────────────────────────────────

describe('crearSenalMiembro · desmontaje', () => {
  it('destruir quita lo puesto y deja `senalar` inerte (no lanza)', () => {
    // El desmontaje del visor va en orden inverso, así que una llamada tardía es
    // normal y no un error de programador. Mismo criterio que el resto de capas.
    const senal = crear()
    senal.senalar(miembro('29053A00109007'))
    senal.destruir()
    expect(marcos()).toHaveLength(0)
    expect(rotulos()).toHaveLength(0)
    expect(() => senal.senalar(miembro('otra'))).not.toThrow()
    expect(marcos()).toHaveLength(0)
    expect(senal.encuadrar()).toBe(false)
    expect(() => senal.destruir()).not.toThrow()
  })
})

/* -------------------------------------------------------------------------- *
 * test/viewer/puntos-levantamiento.dom.test.js — LOS PUNTOS SUELTOS, PINTADOS  *
 *                                                                            *
 * `viewer/puntos-levantamiento.js` dibuja y nada más: no engancha, no escribe  *
 * en ningún store y no tiene eventos. Así que aquí se prueba lo que se PONE en  *
 * el mapa y con qué opciones. Por orden de importancia:                        *
 *                                                                            *
 *   1. **NO SE AGARRAN.** `interactive:false` es la propiedad de la que depende *
 *      que dibujar encima siga funcionando: una capa interactiva sobre las      *
 *      dianas le robaría el clic al mapa, y ese clic ES el vértice que se está  *
 *      poniendo. Se MIDE (oyente en `mapa.on('click')`), no se supone.          *
 *   2. **Un aro por punto**, hueco y en el amarillo de «esto es tuyo».          *
 *   3. **El pane 429**: sobre toda la geometría (una diana tapada no sirve para *
 *      apuntar) y bajo `vertices` (430), donde vive el trazo en curso.          *
 *   4. **El contrato de forma**: pares UTM, y los objetos del parser LANZAN —el *
 *      mismo trato que `viewer/edicion.js#fijarPuntos`, y a propósito, porque   *
 *      las dos comen del mismo array—.                                          *
 *   5. **Un par malo suelto se dice y NO tumba la nube** (regla de oro 1).      *
 *   6. **Que `limpiar()` y `destruir()` no dejan nada.**                        *
 *                                                                            *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).        *
 * -------------------------------------------------------------------------- */

import L from 'leaflet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { COLOR_USUARIO, NIVEL, PANE, PANES, vertUTMaLatLng } from '../../viewer/_comun.js'
import {
  CLASE_PUNTO,
  crearCapaPuntosLevantamiento,
  mensajeDescartados,
} from '../../viewer/puntos-levantamiento.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

const ZONA = 30

/** Tres esquinas en UTM real (huso 30): la proyección se ejecuta de verdad. */
const X0 = 373000
const Y0 = 4070000
const NUBE = [
  [X0, Y0],
  [X0 + 10, Y0],
  [X0 + 10, Y0 + 10],
]

/** Todo lo que hay que desmontar al acabar cada prueba. */
const abiertos = []

function montar() {
  const { mapa, contenedor } = montarMapa({ centro: vertUTMaLatLng([X0, Y0], ZONA), zoom: 19 })
  crearPanes(mapa)
  const alAvisar = vi.fn()
  const capa = crearCapaPuntosLevantamiento({ mapa, zona: ZONA, alAvisar })
  abiertos.push(() => {
    capa.destruir()
    mapa.remove()
    contenedor.remove()
  })
  return { mapa, capa, alAvisar }
}

/** Los `L.CircleMarker` que hay ahora mismo en el mapa. */
function aros(mapa) {
  const encontrados = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.CircleMarker) encontrados.push(capa)
  })
  return encontrados
}

afterEach(() => {
  while (abiertos.length > 0) abiertos.pop()()
  vi.restoreAllMocks()
})

// ─────────────────────────────────────────────────────────────────────────────

describe('viewer/puntos-levantamiento · lo que se pone en el mapa', () => {
  it('un aro por punto, y ni uno más', () => {
    const { mapa, capa } = montar()
    capa.pintar(NUBE)
    expect(aros(mapa)).toHaveLength(3)
  })

  it('⛔ NO son interactivos: el clic del mapa tiene que llegar al mapa', () => {
    // Es el riesgo de este módulo y la razón de que esta prueba vaya la primera:
    // ese clic ES el vértice que se está poniendo con «Dibujar recinto». Una capa
    // que lo intercepte convierte la diana en un obstáculo.
    const { mapa, capa } = montar()
    capa.pintar(NUBE)
    for (const aro of aros(mapa)) expect(aro.options.interactive).toBe(false)
  })

  it('en el pane 429: sobre la geometría y BAJO el trazo que se está dibujando', () => {
    const { mapa, capa } = montar()
    capa.pintar(NUBE)
    for (const aro of aros(mapa)) expect(aro.options.pane).toBe(PANE.PUNTOS_LEVANTAMIENTO)

    const z = (nombre) => PANES.find((p) => p.nombre === nombre).zIndex
    expect(z(PANE.PUNTOS_LEVANTAMIENTO)).toBeGreaterThan(z(PANE.PARCELA_EDITADA))
    expect(z(PANE.PUNTOS_LEVANTAMIENTO)).toBeGreaterThan(z(PANE.DIAGNOSTICO))
    expect(z(PANE.PUNTOS_LEVANTAMIENTO)).toBeLessThan(z(PANE.VERTICES))
  })

  it('⭐ huecos y en el amarillo del técnico: son referencia, no agarradores', () => {
    // La leyenda los pone bajo «Tu medición» junto al vértice, y los dos son
    // amarillos: la FORMA es lo único que los distingue, y tiene que hacerlo —uno
    // se arrastra y el otro no—.
    const { mapa, capa } = montar()
    capa.pintar(NUBE)
    for (const aro of aros(mapa)) {
      expect(aro.options.color).toBe(COLOR_USUARIO)
      expect(aro.options.fillOpacity).toBe(0)
      expect(aro.options.className).toBe(CLASE_PUNTO)
    }
  })

  it('se proyectan de verdad: el aro cae donde dice el par UTM', () => {
    const { mapa, capa } = montar()
    capa.pintar([[X0, Y0]])
    const esperado = vertUTMaLatLng([X0, Y0], ZONA)
    const puesto = aros(mapa)[0].getLatLng()
    expect(puesto.lat).toBeCloseTo(esperado[0], 9)
    expect(puesto.lng).toBeCloseTo(esperado[1], 9)
  })

  it('ni un color de mérito: no hay verde, ni rojo, ni el ámbar de la invasión', () => {
    const { mapa, capa } = montar()
    capa.pintar(NUBE)
    for (const aro of aros(mapa)) {
      expect(aro.options.color.toLowerCase()).not.toMatch(/^#(0f0|00ff00|f00|ff0000)$/)
    }
  })
})

describe('viewer/puntos-levantamiento · el contrato de forma', () => {
  it('⚠️ los objetos del parser LANZAN diciendo cómo convertirlos', () => {
    // El mismo contrato que `viewer/edicion.js#fijarPuntos`, y a propósito: las
    // dos comen del MISMO array, así que si una tragara `{capa,x,y,z}` y la otra
    // no, se vería un punto donde no se puede enganchar.
    const { capa } = montar()
    const delParser = [{ capa: 'VER_P2D', x: X0, y: Y0, z: 404.3 }]
    expect(() => capa.pintar(delParser)).toThrow(TypeError)
    expect(() => capa.pintar(delParser)).toThrow(/p\.x/)
  })

  it('lo que no es array ni null lanza; null y undefined solo limpian', () => {
    const { mapa, capa } = montar()
    expect(() => capa.pintar('tres puntos')).toThrow(TypeError)
    capa.pintar(NUBE)
    capa.pintar(null)
    expect(aros(mapa)).toHaveLength(0)
    capa.pintar(NUBE)
    capa.pintar(undefined)
    expect(aros(mapa)).toHaveLength(0)
  })

  it('un par malo SUELTO se dice y no se lleva la nube por delante', () => {
    // Regla de oro 1: ni error silencioso ni nube perdida por un `NaN`. Mismo
    // trato que `viewer/piezas.js` con una pieza sin contorno.
    const { mapa, capa, alAvisar } = montar()
    capa.pintar([[X0, Y0], [Number.NaN, Y0], [X0 + 10, Y0 + 10], [X0 + 20]])
    expect(aros(mapa)).toHaveLength(2)
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toBe(mensajeDescartados(2, 4))
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('sin nada que descartar no dice nada', () => {
    const { capa, alAvisar } = montar()
    capa.pintar(NUBE)
    expect(alAvisar).not.toHaveBeenCalled()
  })
})

describe('viewer/puntos-levantamiento · montaje y desmontaje', () => {
  it('`pintar` SUSTITUYE la nube anterior, no la acumula', () => {
    const { mapa, capa } = montar()
    capa.pintar(NUBE)
    capa.pintar([[X0, Y0]])
    expect(aros(mapa)).toHaveLength(1)
  })

  it('`limpiar` y `destruir` no dejan nada, y `destruir` es idempotente', () => {
    const { mapa, capa } = montar()
    capa.pintar(NUBE)
    capa.limpiar()
    expect(aros(mapa)).toHaveLength(0)
    capa.pintar(NUBE)
    capa.destruir()
    expect(aros(mapa)).toHaveLength(0)
    expect(() => capa.destruir()).not.toThrow()
  })

  it('tras `destruir`, `pintar` es un NO-OP y no un throw', () => {
    // El desmontaje del visor va en orden inverso. Mismo criterio que
    // `piezas.pintar` y `contraste.pintar`.
    const { mapa, capa } = montar()
    capa.destruir()
    expect(() => capa.pintar(NUBE)).not.toThrow()
    expect(aros(mapa)).toHaveLength(0)
  })

  it('sin el pane montado LANZA nombrándolo, en vez de pintar en el sitio de otro', () => {
    const { mapa, contenedor } = montarMapa({ zoom: 19 })
    abiertos.push(() => {
      mapa.remove()
      contenedor.remove()
    })
    expect(() => crearCapaPuntosLevantamiento({ mapa, zona: ZONA })).toThrow(TypeError)
    expect(() => crearCapaPuntosLevantamiento({ mapa, zona: ZONA })).toThrow(
      new RegExp(PANE.PUNTOS_LEVANTAMIENTO),
    )
  })

  it('la `zona` es el HUSO y el error lo dice, porque es la confusión de la casa', () => {
    const { mapa, contenedor } = montarMapa({ zoom: 19 })
    crearPanes(mapa)
    abiertos.push(() => {
      mapa.remove()
      contenedor.remove()
    })
    expect(() => crearCapaPuntosLevantamiento({ mapa, zona: 25830 })).toThrow(RangeError)
    expect(() => crearCapaPuntosLevantamiento({ mapa, zona: 25830 })).toThrow(/husoPorSrs/)
    expect(() => crearCapaPuntosLevantamiento({ mapa: null, zona: ZONA })).toThrow(TypeError)
  })
})

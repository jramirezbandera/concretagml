/* -------------------------------------------------------------------------- *
 * test/viewer/parcelas-expediente.dom.test.js — F25 · tarea 2.4               *
 *                                                                            *
 * La capa de las parcelas del expediente que NO están en edición, y el       *
 * selector «Parcela en edición». Por orden de importancia:                   *
 *                                                                            *
 *   1. **El clic sigue llegando al mapa** sobre una de esas parcelas: es el  *
 *      gesto de dibujar y de insertar justo en el lindero compartido.        *
 *   2. **Con una sola parcela no hay nada**: ni selector ni capa. Un         *
 *      expediente normal se ve exactamente como antes de F25.               *
 *   3. La que está en edición NO se dibuja aquí (ya la dibuja el visor).     *
 *   4. Elegir en el selector avisa con el `idLocal`, y nada más.             *
 * -------------------------------------------------------------------------- */

import L from 'leaflet'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { COLOR_USUARIO, PANE } from '../../viewer/_comun.js'
import {
  CLASE_OTRA,
  SELECTOR,
  TEXTO,
  crearParcelasExpediente,
  rotularParcela,
} from '../../viewer/parcelas-expediente.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

const ZONA = 30
const X0 = 373000
const Y0 = 4070000

const rect = (x0, y0, x1, y1) => ({
  vertices: [
    [x0, y0],
    [x1, y0],
    [x1, y1],
    [x0, y1],
  ],
  tipo: 'EXTERIOR',
})
const parcela = (idLocal, refcat, dx) => ({ idLocal, refcat, recintos: [rect(X0 + dx, Y0, X0 + dx + 10, Y0 + 10)] })
const MATRIZ = parcela('MATRIZ', '7136910UF1473N', 0)
const PIEZA_1 = parcela('PIEZA-1', null, 10)
const PIEZA_2 = parcela('PIEZA-2', null, 20)

const montados = []
afterEach(() => {
  while (montados.length) {
    try {
      montados.pop()()
    } catch {
      /* la limpieza no enmascara el fallo real */
    }
  }
})

function conMapa() {
  const { mapa, contenedor, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
  crearPanes(mapa)
  const capa = crearParcelasExpediente({ mapa, zona: ZONA })
  montados.push(() => {
    capa.destruir()
    destruir()
  })
  return { mapa, contenedor, capa }
}

const otrasDe = (mapa) => {
  const todas = []
  mapa.eachLayer((c) => {
    if (c instanceof L.Polygon && c.options.className === CLASE_OTRA) todas.push(c)
  })
  return todas
}
const control = (contenedor) => contenedor.querySelector(SELECTOR.CONTROL)
const lista = (contenedor) => contenedor.querySelector(SELECTOR.LISTA)

describe('viewer/parcelas-expediente · con UNA sola parcela, solo la puerta de «Añadir»', () => {
  it('sin parcela en edición no hay control; con una, solo «Añadir parcela» y ninguna capa', () => {
    const { mapa, contenedor, capa } = conMapa()
    expect(control(contenedor).hidden).toBe(true)
    capa.pintar({ parcelas: [MATRIZ], activa: 'MATRIZ' })
    // ⚠️ En la fase 2 esto era «oculto». La fase 3 lo cambió a propósito: «Añadir
    // parcela» es la única puerta al expediente de varias, y escondida no existe.
    expect(control(contenedor).hidden).toBe(false)
    expect(contenedor.querySelector(SELECTOR.AÑADIR).hidden).toBe(false)
    expect(contenedor.querySelector(SELECTOR.FILA_LISTA).hidden).toBe(true)
    expect(contenedor.querySelector(SELECTOR.QUITAR).hidden).toBe(true)
    expect(otrasDe(mapa)).toEqual([])
  })
})

describe('viewer/parcelas-expediente · «Añadir parcela» y «Quitar esta parcela» (fase 3)', () => {
  function conOpciones(opciones, extra = {}) {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    crearPanes(mapa)
    const opcionesAñadir = vi.fn(() => opciones)
    const capa = crearParcelasExpediente({ mapa, zona: ZONA, opcionesAñadir, ...extra })
    montados.push(() => {
      capa.destruir()
      destruir()
    })
    return { capa, contenedor: mapa.getContainer(), opcionesAñadir }
  }
  const pulsar = (contenedor, selector) => contenedor.querySelector(selector).click()

  it('el menú se rellena AL ABRIRLO, y elegir una opción avisa con su clave y lo cierra', () => {
    const { capa, contenedor, opcionesAñadir } = conOpciones([
      { clave: 'dibujar', texto: 'Dibujar una parcela nueva' },
      { clave: 'colindante:9398501VK3799G', texto: 'Colindante 9398501VK3799G' },
    ])
    capa.pintar({ parcelas: [MATRIZ], activa: 'MATRIZ' })
    expect(opcionesAñadir).not.toHaveBeenCalled()
    const alAñadir = vi.fn()
    capa.alAñadir(alAñadir)
    pulsar(contenedor, SELECTOR.AÑADIR)
    expect(opcionesAñadir).toHaveBeenCalledTimes(1)
    expect(contenedor.querySelector(SELECTOR.AÑADIR).getAttribute('aria-expanded')).toBe('true')
    const botones = [...contenedor.querySelectorAll(SELECTOR.OPCION)]
    expect(botones.map((b) => b.textContent)).toEqual(['Dibujar una parcela nueva', 'Colindante 9398501VK3799G'])
    botones[1].click()
    expect(alAñadir).toHaveBeenCalledWith('colindante:9398501VK3799G')
    expect(contenedor.querySelector(SELECTOR.MENU).hidden).toBe(true)
  })

  it('⛔ elegir una opción NO llega al mapa como un clic suyo (era la primera esquina del dibujo)', () => {
    // Medido en Chromium: con el menú vaciándose al elegir, el botón quedaba despegado
    // del DOM y `Map#_isClickDisabled` no encontraba la marca de su control. El dibujo
    // que la opción acababa de empezar recibía ESA pulsación como primer vértice.
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    crearPanes(mapa)
    const capa = crearParcelasExpediente({
      mapa,
      zona: ZONA,
      opcionesAñadir: () => [{ clave: 'dibujar', texto: 'Dibujar una parcela nueva' }],
    })
    montados.push(() => {
      capa.destruir()
      destruir()
    })
    capa.pintar({ parcelas: [MATRIZ], activa: 'MATRIZ' })
    const clicsDelMapa = vi.fn()
    mapa.on('click', clicsDelMapa)
    const contenedor = mapa.getContainer()
    contenedor.querySelector(SELECTOR.AÑADIR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    const opcion = contenedor.querySelector(SELECTOR.OPCION)
    opcion.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 50, clientY: 50 }))
    expect(clicsDelMapa).not.toHaveBeenCalled()
    // Y el botón sigue dentro del control: es lo que el mapa mira.
    expect(opcion.isConnected).toBe(true)
  })

  it('sin opciones el menú lo dice, en vez de abrirse vacío', () => {
    const { capa, contenedor } = conOpciones([])
    capa.pintar({ parcelas: [MATRIZ], activa: 'MATRIZ' })
    pulsar(contenedor, SELECTOR.AÑADIR)
    expect(contenedor.querySelector(SELECTOR.MENU).textContent).toBe(TEXTO.SIN_OPCIONES)
  })

  it('«Quitar» pide DOS pulsaciones; la primera solo arma, y el armado caduca', () => {
    let disparar = null
    const programar = vi.fn((fn) => {
      disparar = fn
      return () => {
        disparar = null
      }
    })
    const { capa, contenedor } = conOpciones([], { programar })
    capa.pintar({ parcelas: [MATRIZ, PIEZA_1], activa: 'PIEZA-1' })
    const alQuitar = vi.fn()
    capa.alQuitar(alQuitar)
    const quitar = contenedor.querySelector(SELECTOR.QUITAR)
    expect(quitar.hidden).toBe(false)
    quitar.click()
    expect(alQuitar).not.toHaveBeenCalled()
    expect(quitar.textContent).toBe(TEXTO.QUITAR_ARMADO)
    disparar() // caduca
    expect(quitar.textContent).toBe(TEXTO.QUITAR)
    quitar.click()
    quitar.click()
    expect(alQuitar).toHaveBeenCalledTimes(1)
    expect(alQuitar).toHaveBeenCalledWith('PIEZA-1')
  })

  it('cambiar de parcela con «Quitar» armado lo DESARMA: no se quita la que no es', () => {
    const { capa, contenedor } = conOpciones([], { programar: () => () => {} })
    capa.pintar({ parcelas: [MATRIZ, PIEZA_1], activa: 'PIEZA-1' })
    const alQuitar = vi.fn()
    capa.alQuitar(alQuitar)
    contenedor.querySelector(SELECTOR.QUITAR).click()
    capa.pintar({ parcelas: [MATRIZ, PIEZA_1], activa: 'MATRIZ' })
    contenedor.querySelector(SELECTOR.QUITAR).click()
    expect(alQuitar).not.toHaveBeenCalled()
    expect(contenedor.querySelector(SELECTOR.QUITAR).textContent).toBe(TEXTO.QUITAR_ARMADO)
  })
})

describe('viewer/parcelas-expediente · con varias', () => {
  it('pinta las que NO están en edición, en el pane de las colindantes, con el color del usuario discontinuo', () => {
    const { mapa, capa } = conMapa()
    capa.pintar({ parcelas: [MATRIZ, PIEZA_1, PIEZA_2], activa: 'PIEZA-1' })
    const otras = otrasDe(mapa)
    expect(otras).toHaveLength(2)
    for (const p of otras) {
      expect(p.options.pane).toBe(PANE.COLINDANTES)
      expect(p.options.color).toBe(COLOR_USUARIO)
      expect(p.options.dashArray).toBeTruthy()
    }
    // El emergente nombra la parcela y dice dónde se elige.
    expect(otras.map((p) => p.getTooltip().getContent()).join('\n')).toContain(TEXTO.ROTULO)
  })

  it('el selector aparece, lista todas en orden con la activa elegida, y dice cuántas', () => {
    const { contenedor, capa } = conMapa()
    capa.pintar({ parcelas: [MATRIZ, PIEZA_1, PIEZA_2], activa: 'PIEZA-1' })
    expect(control(contenedor).hidden).toBe(false)
    const opciones = [...lista(contenedor).options]
    expect(opciones.map((o) => o.value)).toEqual(['MATRIZ', 'PIEZA-1', 'PIEZA-2'])
    expect(opciones.map((o) => o.textContent)).toEqual([
      '1 · 7136910UF1473N',
      '2 · sin referencia',
      '3 · sin referencia',
    ])
    expect(lista(contenedor).value).toBe('PIEZA-1')
    expect(contenedor.querySelector(SELECTOR.CUENTA).textContent).toBe('de 3')
  })

  it('elegir otra avisa con su idLocal', () => {
    const { contenedor, capa } = conMapa()
    const alElegir = vi.fn()
    capa.alElegir(alElegir)
    capa.pintar({ parcelas: [MATRIZ, PIEZA_1], activa: 'MATRIZ' })
    lista(contenedor).value = 'PIEZA-1'
    lista(contenedor).dispatchEvent(new Event('change', { bubbles: true }))
    expect(alElegir).toHaveBeenCalledWith('PIEZA-1')
  })

  it('repintar es idempotente: no acumula polígonos', () => {
    const { mapa, capa } = conMapa()
    const contenido = { parcelas: [MATRIZ, PIEZA_1, PIEZA_2], activa: 'MATRIZ' }
    capa.pintar(contenido)
    capa.pintar(contenido)
    expect(otrasDe(mapa)).toHaveLength(2)
  })

  it('⛔ el clic sobre una de ellas LLEGA al mapa (dibujar e insertar viven ahí)', () => {
    const { mapa, capa } = conMapa()
    const alClicar = vi.fn()
    mapa.on('click', alClicar)
    capa.pintar({ parcelas: [MATRIZ, PIEZA_1], activa: 'MATRIZ' })
    const [otra] = otrasDe(mapa)
    expect(otra.options.bubblingMouseEvents).toBe(true)
    otra.getElement().dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: 400, clientY: 300 }))
    expect(alClicar).toHaveBeenCalledTimes(1)
  })

  it('visible(false) quita la capa y el selector de verdad; visible(true) los devuelve', () => {
    const { mapa, contenedor, capa } = conMapa()
    capa.pintar({ parcelas: [MATRIZ, PIEZA_1], activa: 'MATRIZ' })
    capa.visible(false)
    expect(otrasDe(mapa)).toEqual([])
    expect(control(contenedor).hidden).toBe(true)
    capa.visible(true)
    expect(otrasDe(mapa)).toHaveLength(1)
    expect(control(contenedor).hidden).toBe(false)
  })

  it('una parcela sin contorno dibujable no se pinta y SE DICE', () => {
    const alAvisar = vi.fn()
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    crearPanes(mapa)
    const capa = crearParcelasExpediente({ mapa, zona: ZONA, alAvisar })
    montados.push(() => {
      capa.destruir()
      destruir()
    })
    capa.pintar({ parcelas: [MATRIZ, { idLocal: 'VACIA', refcat: null, recintos: [] }], activa: 'MATRIZ' })
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toMatch(/siguen en el expediente/)
  })

  it('destruir quita el control del mapa y es idempotente', () => {
    const { contenedor, capa } = conMapa()
    capa.destruir()
    capa.destruir()
    expect(control(contenedor)).toBeNull()
  })
})

describe('viewer/parcelas-expediente · contrato', () => {
  it('rotularParcela: el número SIEMPRE, y la referencia o «sin referencia»', () => {
    expect(rotularParcela({ refcat: ' 9398516VK3799G ' }, 1)).toBe('1 · 9398516VK3799G')
    expect(rotularParcela({ refcat: '' }, 2)).toBe('2 · sin referencia')
    expect(rotularParcela({}, 3)).toBe('3 · sin referencia')
  })

  it('lanza con un mapa sin el pane de las colindantes, o con zona/posición inválidas', () => {
    const { mapa, destruir } = montarMapa({ centro: [36.7, -4.5], zoom: 19 })
    montados.push(destruir)
    expect(() => crearParcelasExpediente({ mapa, zona: ZONA })).toThrow(/falta el pane/)
    crearPanes(mapa)
    expect(() => crearParcelasExpediente({ mapa, zona: 28 })).toThrow(RangeError)
    expect(() => crearParcelasExpediente({ mapa, zona: ZONA, posicion: 'centro' })).toThrow(RangeError)
    expect(() => crearParcelasExpediente({ mapa: {}, zona: ZONA })).toThrow(TypeError)
  })
})

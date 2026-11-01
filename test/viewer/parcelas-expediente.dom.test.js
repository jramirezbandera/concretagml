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

describe('viewer/parcelas-expediente · con UNA sola parcela no hay nada', () => {
  it('el selector nace oculto y sigue oculto con una parcela; la capa no pinta nada', () => {
    const { mapa, contenedor, capa } = conMapa()
    expect(control(contenedor).hidden).toBe(true)
    capa.pintar({ parcelas: [MATRIZ], activa: 'MATRIZ' })
    expect(control(contenedor).hidden).toBe(true)
    expect(otrasDe(mapa)).toEqual([])
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

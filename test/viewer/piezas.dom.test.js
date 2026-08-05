/* -------------------------------------------------------------------------- *
 * test/viewer/piezas.dom.test.js — F17 · 4.1 · Las manchas del sobrante         *
 *                                                                              *
 * Lo que este fichero defiende, en una frase: **que se pueda decir QUÉ MANCHA   *
 * se está nombrando**. Toda la decisión de F17 —las piezas se PROPONEN, no se   *
 * crean solas— se apoya en que el usuario revise una por una; y revisar sin     *
 * poder señalar es teatro. De ahí los tres asuntos de abajo: el número          *
 * permanente sobre cada pieza, el resaltado recíproco, y **decir en voz alta**  *
 * lo que no se ha podido pintar o no se ve.                                     *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).        *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import { latLngAUTM, PANE, PANES } from '../../viewer/_comun.js'
import { CLASE_NUMERO, CLASE_PIEZA, crearCapaPiezas, textoNumeroPieza } from '../../viewer/piezas.js'
import { crearPanes, montarMapa } from './_ayuda-jsdom.js'

// La parcela de demo del arnés cae en el huso 30. El origen de las piezas de
// prueba se DERIVA del centro del mapa montado, no se escribe a mano: así «está
// en pantalla» es un hecho del arnés y no una coincidencia de coordenadas.
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

/** Una `PiezaSobrante` de mentira, con lo que la capa lee de verdad. */
function pieza(orden, { x = X0, y = Y0, lado = 10, recintos = null, centroide } = {}) {
  const ext = cuadrado(x, y, lado)
  return {
    orden,
    recintos: recintos ?? [ext],
    area: lado * lado,
    grosor: lado / 2,
    estrecha: false,
    centroide: centroide === undefined ? [x + lado / 2, y + lado / 2] : centroide,
  }
}

let entorno = null
let avisos = []
const avisar = (mensaje, detalle) => avisos.push({ mensaje, nivel: detalle?.nivel })

beforeEach(() => {
  avisos = []
  // Zoom 16 y no 18: a 18 el encuadre mide ~150 m y un cuadrado de 40 m con una
  // pieza a 40 m al este se sale por su cuenta. «Fuera del encuadre» tiene que
  // ser algo que un test PROVOCA, no el estado normal del arnés.
  entorno = montarMapa({ zoom: 16 })
  crearPanes(entorno.mapa)
  const centro = latLngAUTM(entorno.mapa.getCenter(), HUSO)
  // Una esquina al suroeste del centro, para que el cuadrado de 10 m quede dentro.
  X0 = centro[0] - 20
  Y0 = centro[1] - 20
})

afterEach(() => {
  entorno.destruir()
  entorno = null
})

/** Los `<path>` que ha puesto la capa. */
const manchas = () => entorno.contenedor.querySelectorAll(`.${CLASE_PIEZA}`)
/** Los rótulos con el número. */
const numeros = () => entorno.contenedor.querySelectorAll(`.${CLASE_NUMERO}`)

function crear() {
  return crearCapaPiezas({ mapa: entorno.mapa, zona: HUSO, alAvisar: avisar })
}

// ── 1 · Contratos del programador ───────────────────────────────────────────

describe('crearCapaPiezas · contratos', () => {
  it('sin mapa utilizable, LANZA nombrando lo que le falta', () => {
    expect(() => crearCapaPiezas({ zona: HUSO })).toThrow(TypeError)
    expect(() => crearCapaPiezas({ mapa: { addLayer() {} }, zona: HUSO })).toThrow(
      /addLayer\/removeLayer\/getPane\/getBounds/,
    )
  })

  it('⚠️ `getBounds` está en el contrato, y no por simetría', () => {
    // El aviso de «fuera del encuadre» depende de él. Sin comprobarlo, lo que
    // fallaría es el propio aviso: la capa pintaría y se callaría.
    const mapa = {
      addLayer() {},
      removeLayer() {},
      getPane: () => ({}),
    }
    expect(() => crearCapaPiezas({ mapa, zona: HUSO })).toThrow(/getBounds/)
  })

  it('con un huso que no existe, LANZA diciendo que zona no es el srs', () => {
    expect(() => crearCapaPiezas({ mapa: entorno.mapa, zona: 25830 })).toThrow(RangeError)
    expect(() => crearCapaPiezas({ mapa: entorno.mapa, zona: 25830 })).toThrow(/husoPorSrs/)
  })

  it('sin el pane, LANZA explicando por qué va SOBRE la parcela editada', () => {
    const { mapa, destruir } = montarMapa()
    try {
      expect(() => crearCapaPiezas({ mapa, zona: HUSO })).toThrow(/falta el pane 'piezas'/)
    } finally {
      destruir()
    }
  })

  it('`pintar` con algo que no es array ni null LANZA nombrando el error frecuente', () => {
    const capa = crear()
    expect(() => capa.pintar({ piezas: [] })).toThrow(/son las PIEZAS enteras, no sus recintos/)
    capa.destruir()
  })

  it('el pane `piezas` va en 421, entre la parcela editada (420) y las partes (422)', () => {
    const z = Object.fromEntries(PANES.map((p) => [p.nombre, p.zIndex]))
    expect(PANE.PIEZAS).toBe('piezas')
    expect(z[PANE.PIEZAS]).toBe(421)
    expect(z[PANE.PIEZAS]).toBeGreaterThan(z[PANE.PARCELA_EDITADA])
    // ⛔ El sitio se decide contra F07: la pieza ocupa el MISMO terreno que la
    // «diferencia sombreada» del pane 428, y lo que tiene que ganar es la
    // explicación.
    expect(z[PANE.PIEZAS]).toBeLessThan(z[PANE.DIAGNOSTICO])
    expect(z[PANE.PIEZAS]).toBeLessThan(z[PANE.VERTICES])
  })
})

// ── 2 · Pinta, numera y limpia ──────────────────────────────────────────────

describe('crearCapaPiezas · pintar', () => {
  it('una pieza es una mancha CON su número encima', () => {
    const capa = crear()
    capa.pintar([pieza(1)])
    expect(manchas()).toHaveLength(1)
    expect(numeros()).toHaveLength(1)
    expect(numeros()[0].textContent).toBe(textoNumeroPieza(1))
    capa.destruir()
  })

  it('⭐ los números son los `orden`, y NO el índice del array', () => {
    // Es la identidad de la pieza dentro de su foto y lo que la fila de la lista
    // enseña. Renumerar aquí desharía la correspondencia entera.
    const capa = crear()
    capa.pintar([pieza(3), pieza(7, { x: X0 + 40 })])
    expect([...numeros()].map((n) => n.textContent)).toEqual(['3', '7'])
    capa.destruir()
  })

  it('los HUECOS de una pieza se recortan: un polígono, varios anillos', () => {
    const capa = crear()
    const conHueco = pieza(1, {
      lado: 40,
      recintos: [cuadrado(X0, Y0, 40), { tipo: 'HUECO', vertices: cuadrado(X0 + 10, Y0 + 10, 10).vertices }],
    })
    capa.pintar([conHueco])
    expect(manchas()).toHaveLength(1)
    // Dos subcaminos en el `d` del `<path>`: exterior y hueco.
    expect(manchas()[0].getAttribute('d').match(/M/g)).toHaveLength(2)
    capa.destruir()
  })

  it('`pintar` es idempotente y `pintar(null)` solo limpia', () => {
    const capa = crear()
    capa.pintar([pieza(1)])
    capa.pintar([pieza(1)])
    expect(manchas()).toHaveLength(1)
    capa.pintar(null)
    expect(manchas()).toHaveLength(0)
    expect(numeros()).toHaveLength(0)
    capa.destruir()
  })

  it('tras `destruir`, `pintar` es un no-op y no lanza', () => {
    const capa = crear()
    capa.destruir()
    expect(() => capa.pintar([pieza(1)])).not.toThrow()
    expect(manchas()).toHaveLength(0)
  })
})

// ── 3 · ⛔ Lo que no se pinta, SE DICE ──────────────────────────────────────

describe('crearCapaPiezas · lo que no se ve se cuenta', () => {
  it('una pieza sin contorno dibujable no se pinta y se AVISA con cuántas de cuántas', () => {
    const capa = crear()
    capa.pintar([pieza(1), { orden: 2, recintos: [{ tipo: 'EXTERIOR', vertices: [[1, 2]] }] }])
    expect(manchas()).toHaveLength(1)
    expect(avisos.map((a) => a.mensaje).join(' ')).toMatch(/1 de 2 pieza\(s\).*no traen contorno/)
    expect(avisos.every((a) => a.nivel === 'AVISO')).toBe(true)
    capa.destruir()
  })

  it('⚠️ una pieza SIN centroide se pinta muda, y eso se cuenta APARTE', () => {
    // El síntoma es otro: una mancha sin número entre otras numeradas se lee como
    // «esta no cuenta», y fundir los dos avisos dejaría al usuario sin saber cuál
    // de los dos problemas tiene.
    const capa = crear()
    capa.pintar([pieza(1, { centroide: null })])
    expect(manchas()).toHaveLength(1)
    expect(numeros()).toHaveLength(0)
    expect(avisos.map((a) => a.mensaje).join(' ')).toMatch(/se han pintado SIN número/)
    capa.destruir()
  })

  it('⭐ una pieza FUERA del encuadre se dice: es el caso que nadie había nombrado', () => {
    // La lista enseña «pieza 2» y en el mapa no hay ningún 2. Sin decirlo se lee
    // como «esta no se ha pintado», que es una conclusión falsa sobre el dato.
    const capa = crear()
    // 30 km al norte del encuadre: fuera con cualquier zoom razonable.
    capa.pintar([pieza(1), pieza(2, { y: Y0 + 30_000 })])
    expect(manchas()).toHaveLength(2)
    const texto = avisos.map((a) => a.mensaje).join(' ')
    expect(texto).toMatch(/1 de 2 pieza\(s\).*FUERA de lo que se ve del mapa/)
    expect(texto).toMatch(/Aleja el zoom/)
    capa.destruir()
  })

  it('con todo en pantalla no se avisa de nada', () => {
    const capa = crear()
    capa.pintar([pieza(1)])
    expect(avisos).toEqual([])
    capa.destruir()
  })
})

// ── 4 · ⭐ El resaltado, y que sea RECÍPROCO ────────────────────────────────

describe('crearCapaPiezas · resaltado', () => {
  it('`resaltar(n)` marca la suya y desmarca las demás', () => {
    const capa = crear()
    capa.pintar([pieza(1), pieza(2, { x: X0 + 40 })])
    capa.resaltar(2)
    const marcas = [...numeros()].map((n) => n.dataset.resaltada)
    expect(marcas).toEqual(['no', 'si'])
    capa.resaltar(null)
    expect([...numeros()].map((n) => n.dataset.resaltada)).toEqual(['no', 'no'])
    capa.destruir()
  })

  it('un `orden` que ya no está pintado apaga el resaltado y NO lanza', () => {
    // La foto puede haber cambiado entre el `mouseover` de la fila y este cable.
    const capa = crear()
    capa.pintar([pieza(1)])
    capa.resaltar(1)
    expect(() => capa.resaltar(99)).not.toThrow()
    expect([...numeros()].map((n) => n.dataset.resaltada)).toEqual(['no'])
    capa.destruir()
  })

  it('⭐ señalar la MANCHA avisa a quien escuche, y resalta sin esperar respuesta', () => {
    const capa = crear()
    const vistos = []
    capa.alSenalar((orden) => vistos.push(orden))
    capa.pintar([pieza(1), pieza(2, { x: X0 + 40 })])

    manchas()[1].dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
    expect(vistos).toEqual([2])
    expect([...numeros()].map((n) => n.dataset.resaltada)).toEqual(['no', 'si'])

    manchas()[1].dispatchEvent(new window.MouseEvent('mouseout', { bubbles: true }))
    expect(vistos).toEqual([2, null])
    capa.destruir()
  })

  it('⛔ repintar BORRA el resaltado: el número 2 de otra foto es otro terreno', () => {
    // Decisión 3C: el sobrante es una FOTO. Conservar «estaba resaltada la 2» a
    // través de un repintado resaltaría un trozo de terreno distinto.
    const capa = crear()
    capa.pintar([pieza(1), pieza(2, { x: X0 + 40 })])
    capa.resaltar(2)
    capa.pintar([pieza(1), pieza(2, { x: X0 + 40 })])
    expect([...numeros()].map((n) => n.dataset.resaltada)).toEqual(['no', 'no'])
    capa.destruir()
  })

  it('un oyente que revienta no tumba a los demás, y se AVISA', () => {
    const capa = crear()
    const vistos = []
    capa.alSenalar(() => {
      throw new Error('boom')
    })
    capa.alSenalar((o) => vistos.push(o))
    capa.pintar([pieza(1)])
    manchas()[0].dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
    expect(vistos).toEqual([1])
    expect(avisos.map((a) => a.mensaje).join(' ')).toMatch(/oyente de «pieza señalada» ha fallado/)
    capa.destruir()
  })

  it('la baja de `alSenalar` funciona, y `alSenalar` sin función LANZA', () => {
    const capa = crear()
    const vistos = []
    const baja = capa.alSenalar((o) => vistos.push(o))
    baja()
    capa.pintar([pieza(1)])
    manchas()[0].dispatchEvent(new window.MouseEvent('mouseover', { bubbles: true }))
    expect(vistos).toEqual([])
    expect(() => capa.alSenalar('no soy función')).toThrow(TypeError)
    capa.destruir()
  })
})

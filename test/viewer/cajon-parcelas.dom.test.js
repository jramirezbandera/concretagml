/* -------------------------------------------------------------------------- *
 * test/viewer/cajon-parcelas.dom.test.js — F22 · T3.1                        *
 *                                                                            *
 * El cajón donde se elige cuál de las N fincas de un dibujo es la del         *
 * expediente. Lo que se prueba, por orden de importancia:                     *
 *   1. Que NACE sin ninguna marcada y con el primario apagado, y que el       *
 *      renglón dice por qué.                                                  *
 *   2. Que los rótulos salen del dato y no se inventa un nombre.              *
 *   3. Que marcar desde el mapa y marcar en la lista dejan la MISMA pantalla. *
 * -------------------------------------------------------------------------- */

import { afterEach, describe, expect, it } from 'vitest'

import {
  crearCajonParcelas,
  rotularCandidata,
  CLASE,
  SELECTOR,
  SELECTOR_CANDIDATA,
  SIN_FICHERO,
  SIN_ELEGIR,
  EXPLICACION,
} from '../../viewer/cajon-parcelas.js'
import { montarMapa } from './_ayuda-jsdom.js'

/** Los `datos.recintos` de la detección de `parsers/importar.js`, tal cual salen. */
const OCHO = [
  { indice: 0, superficie: 548.05, nVertices: 16, capa: 'Parcela', nombre: '6346726UF8664N' },
  { indice: 1, superficie: 444.11, nVertices: 10, capa: 'Parcela', nombre: '6346725UF8664N' },
  { indice: 2, superficie: 655.7, nVertices: 13, capa: 'Parcela', nombre: '6346714UF8664N' },
]

let vivos = []
const montar = () => {
  const { mapa, destruir } = montarMapa()
  const cajon = crearCajonParcelas({ mapa })
  vivos.push(() => {
    cajon.destruir()
    destruir()
  })
  return { mapa, cajon }
}

afterEach(() => {
  for (const soltar of vivos) soltar()
  vivos = []
})

const nodo = (sel) => document.querySelector(sel)
const radios = () => [...document.querySelectorAll(SELECTOR_CANDIDATA)]

describe('viewer/cajon-parcelas — al nacer', () => {
  it('el contenedor existe, está CERRADO, y todos los nodos del contrato están', () => {
    montar()
    const caja = nodo(`.${CLASE.CONTENEDOR}`)
    expect(caja).not.toBeNull()
    expect(caja.style.display).toBe('none')
    for (const sel of Object.values(SELECTOR)) {
      expect(nodo(sel), `falta ${sel}`).not.toBeNull()
    }
  })

  it('el primario nace APAGADO y el renglón dice por qué', () => {
    montar()
    expect(nodo(SELECTOR.CONFIRMAR).disabled).toBe(true)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(SIN_FICHERO)
  })

  it('⚠️ el botón apagado está enlazado al renglón: el motivo se anuncia con él', () => {
    montar()
    expect(nodo(SELECTOR.CONFIRMAR).getAttribute('aria-describedby')).toBe(
      nodo(SELECTOR.ESTADO).id,
    )
  })

  it('⚠️ el primario NO lleva familia tipográfica en línea', () => {
    // La trampa medida en el guion 10 y corregida en el cajón de F08: un
    // `font: 'inherit'` hereda el `font` EN LÍNEA del contenedor y, por ser
    // inline, GANA a la hoja — dejando el botón en `system-ui` mientras el resto
    // del cajón va en la tipografía del producto. Aquí se evita de origen.
    //
    // ⚠️ Lo que se acusa es la FAMILIA, no el atajo `font`: poner `fontSize` y
    // `fontWeight` por separado hace que `style.font` devuelva «600 inherit», que
    // no fija ninguna familia. Acusar por `style.font` habría puesto este test en
    // rojo sobre el código correcto — la enésima vez que este proyecto casa por la
    // forma en vez de por la afirmación.
    montar()
    const boton = nodo(SELECTOR.CONFIRMAR)
    expect(boton.style.fontFamily).toBe('')
    expect(boton.getAttribute('style')).not.toContain('font-family')
    expect(boton.style.fontSize).toBe('inherit')
  })

  it('la explicación dice por qué hay que elegir Y qué pasa con las demás', () => {
    montar()
    const caja = nodo(`.${CLASE.CONTENEDOR}`)
    expect(caja.textContent).toContain(EXPLICACION)
    // «Elige una» a secas invita a pensar que se pierde el resto.
    expect(EXPLICACION).toContain('contexto')
  })
})

describe('viewer/cajon-parcelas — pintar la lista', () => {
  it('una fila por finca, con su nombre y su superficie', () => {
    const { cajon } = montar()
    cajon.pintar({ nombre: 'ConsultaMasiva_ (90).dxf', candidatas: OCHO, capaRotulos: 'RefCatastral' })
    expect(radios()).toHaveLength(3)
    const caja = nodo(SELECTOR.LISTA)
    expect(caja.textContent).toContain('6346726UF8664N · 548,05 m² · 16 vértices')
    expect(nodo(SELECTOR.FICHERO).textContent).toContain('ConsultaMasiva_ (90).dxf')
    expect(nodo(SELECTOR.FICHERO).textContent).toContain('«RefCatastral»')
  })

  it('⛔ NACE SIN NINGUNA MARCADA, y el primario sigue apagado', () => {
    // Marcar una por defecto —la primera, la mayor— es elegir por el usuario en la
    // única pantalla que existe porque la aplicación NO puede elegir. Un descuido
    // y se firma la finca del vecino.
    const { cajon } = montar()
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO })
    expect(radios().some((r) => r.checked)).toBe(false)
    expect(cajon.elegida()).toBeNull()
    expect(nodo(SELECTOR.CONFIRMAR).disabled).toBe(true)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(SIN_ELEGIR)
  })

  it('sin nombres, el pie lo DICE en vez de callarse', () => {
    const { cajon } = montar()
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO.map(({ nombre, ...r }) => r) })
    expect(nodo(SELECTOR.FICHERO).textContent).toContain('no las nombra')
    expect(nodo(SELECTOR.LISTA).textContent).toContain('Recinto 1 · 548,05 m²')
  })

  it('repintar no acumula filas, y `null` deja el cajón como al nacer', () => {
    const { cajon } = montar()
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO })
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO })
    expect(radios()).toHaveLength(3)
    cajon.pintar(null)
    expect(radios()).toHaveLength(0)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe(SIN_FICHERO)
    expect(nodo(SELECTOR.CONFIRMAR).disabled).toBe(true)
  })

  it('⚠️ dos cajones en la misma página no comparten grupo de radios', () => {
    // Dos grupos con el mismo `name` serían UNO solo, y marcar en el primer mapa
    // desmarcaría en el segundo.
    const a = montar()
    const b = montar()
    a.cajon.pintar({ nombre: 'a.dxf', candidatas: OCHO })
    b.cajon.pintar({ nombre: 'b.dxf', candidatas: OCHO })
    const nombres = new Set(radios().map((r) => r.name))
    expect(nombres.size).toBe(2)
  })
})

describe('viewer/cajon-parcelas — elegir', () => {
  it('marcar un radio avisa con su índice y enciende el primario', () => {
    const { cajon } = montar()
    const visto = []
    cajon.alElegir((i) => visto.push(i))
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO })

    const radio = radios()[1]
    radio.checked = true
    radio.dispatchEvent(new Event('change', { bubbles: true }))

    expect(visto).toEqual([1])
    expect(cajon.elegida()).toBe(1)
    expect(nodo(SELECTOR.CONFIRMAR).disabled).toBe(false)
    expect(nodo(SELECTOR.ESTADO).textContent).toBe('')
  })

  it('⭐ `marcar` desde el mapa deja la MISMA pantalla, y NO reemite', () => {
    // Es la mitad que hace que el clic en el mapa y el clic en la lista sean la
    // misma acción. Si `marcar` reemitiera, el bucle mapa → cajón → mapa se
    // cerraría sobre sí mismo.
    const { cajon } = montar()
    const visto = []
    cajon.alElegir((i) => visto.push(i))
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO })

    cajon.marcar(2)
    expect(visto).toEqual([])
    expect(cajon.elegida()).toBe(2)
    expect(radios()[2].checked).toBe(true)
    expect(nodo(SELECTOR.CONFIRMAR).disabled).toBe(false)
  })

  it('el primario entrega el índice elegido y NO cierra el cajón', () => {
    const { cajon } = montar()
    const visto = []
    cajon.alConfirmar((i) => visto.push(i))
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO })
    cajon.abrir()
    cajon.marcar(0)

    nodo(SELECTOR.CONFIRMAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(visto).toEqual([0])
    // No cierra: quien escucha va a meter la parcela en el store y puede querer
    // contar algo en este renglón.
    expect(nodo(`.${CLASE.CONTENEDOR}`).style.display).not.toBe('none')
  })

  it('sin nada marcado, el primario no avisa a nadie', () => {
    const { cajon } = montar()
    const visto = []
    cajon.alConfirmar((i) => visto.push(i))
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO })
    nodo(SELECTOR.CONFIRMAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(visto).toEqual([])
  })

  it('«Descartar» avisa y SÍ cierra por sí solo', () => {
    const { cajon } = montar()
    let veces = 0
    cajon.alDescartar(() => veces++)
    cajon.abrir()
    nodo(SELECTOR.DESCARTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(veces).toBe(1)
    expect(nodo(`.${CLASE.CONTENEDOR}`).style.display).toBe('none')
  })

  it('las tres suscripciones devuelven su baja, y exigen una función', () => {
    const { cajon } = montar()
    let veces = 0
    const baja = cajon.alDescartar(() => veces++)
    baja()
    cajon.abrir()
    nodo(SELECTOR.DESCARTAR).dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(veces).toBe(0)
    for (const suscribir of ['alElegir', 'alConfirmar', 'alDescartar']) {
      expect(() => cajon[suscribir]('no soy una función')).toThrow(TypeError)
    }
  })
})

describe('viewer/cajon-parcelas — abrir, cerrar y estado', () => {
  it('abrir y cerrar cambian el `display`, y son idempotentes', () => {
    const { cajon } = montar()
    const caja = nodo(`.${CLASE.CONTENEDOR}`)
    cajon.abrir()
    cajon.abrir()
    expect(caja.style.display).not.toBe('none')
    cajon.cerrar()
    cajon.cerrar()
    expect(caja.style.display).toBe('none')
  })

  it('`estado` escribe el renglón: es donde se cuenta lo que falla', () => {
    const { cajon } = montar()
    cajon.estado('Trayendo el parcelario…')
    expect(nodo(SELECTOR.ESTADO).textContent).toBe('Trayendo el parcelario…')
  })

  it('⛔ `caja()` dice el sitio que ocupa, y CERRADO no ocupa ninguno', () => {
    // Existe porque el guion 24 midió que el cajón tapaba CINCO de las ocho fincas
    // al 100 %: quien encuadra el mapa necesita saber qué trozo no está libre, y
    // el único que sabe cuánto ocupa este cajón —y en qué esquina— es él.
    //
    // ⚠️ **En jsdom no hay maquetación**: `getBoundingClientRect()` devuelve ceros
    // SIEMPRE, así que abierto también sale `null`. Lo que aquí se puede afirmar
    // es el contrato de los bordes —cerrado y destruido no estorban, y no lanza—;
    // que el número sea el bueno lo mide el guion.
    const { cajon } = montar()
    expect(cajon.caja()).toBeNull() // nace cerrado
    cajon.abrir()
    expect(() => cajon.caja()).not.toThrow()
    cajon.cerrar()
    expect(cajon.caja()).toBeNull()
    cajon.destruir()
    expect(cajon.caja()).toBeNull()
  })
})

describe('viewer/cajon-parcelas — el rótulo de una candidata', () => {
  it('con nombre, lo pone delante', () => {
    expect(rotularCandidata({ nombre: '6346726UF8664N', superficie: 548.05, nVertices: 16 }, 1)).toBe(
      '6346726UF8664N · 548,05 m² · 16 vértices',
    )
  })

  it('⚠️ sin nombre NO se inventa «Parcela 3»: se dice el sitio en la lista', () => {
    expect(rotularCandidata({ superficie: 655.7, nVertices: 13 }, 3)).toBe(
      'Recinto 3 · 655,70 m² · 13 vértices',
    )
    expect(rotularCandidata({ nombre: '', superficie: 1, nVertices: 1 }, 2)).toBe(
      'Recinto 2 · 1,00 m² · 1 vértice',
    )
  })
})

describe('viewer/cajon-parcelas — contratos y desmontaje', () => {
  it('sin mapa o con una esquina que no existe, LANZA', () => {
    const { mapa, destruir } = montarMapa()
    vivos.push(destruir)
    expect(() => crearCajonParcelas({ mapa: null })).toThrow(TypeError)
    expect(() => crearCajonParcelas({ mapa, posicion: 7 })).toThrow(TypeError)
    expect(() => crearCajonParcelas({ mapa, posicion: 'centro' })).toThrow(RangeError)
  })

  it('tras `destruir` el cajón se va del documento y todo es no-op', () => {
    const { mapa, destruir } = montarMapa()
    const cajon = crearCajonParcelas({ mapa })
    vivos.push(destruir)
    cajon.pintar({ nombre: 'x.dxf', candidatas: OCHO })
    cajon.destruir()
    expect(nodo(`.${CLASE.CONTENEDOR}`)).toBeNull()
    expect(cajon.elegida()).toBeNull()
    expect(() => cajon.pintar({ nombre: 'y.dxf', candidatas: OCHO })).not.toThrow()
    expect(() => cajon.marcar(0)).not.toThrow()
    expect(() => cajon.estado('x')).not.toThrow()
    cajon.destruir() // idempotente
  })
})

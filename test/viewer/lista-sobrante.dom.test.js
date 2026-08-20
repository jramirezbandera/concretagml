/* -------------------------------------------------------------------------- *
 * test/viewer/lista-sobrante.dom.test.js — F17 · 4.1 · La lista del sobrante    *
 *                                                                              *
 * Este bloque es donde F17 rompe A PROPÓSITO la racha de «0 px del panel» que   *
 * el proyecto llevaba defendiendo cinco fases, así que casi todo lo que se      *
 * afirma aquí es un presupuesto o una promesa de no callarse:                   *
 *                                                                              *
 *   1. **Ninguna pieza desaparece.** El tope son 4 filas de ALTURA con scroll   *
 *      dentro, no un recorte de la lista, y el contador dice cuántas hay        *
 *      aunque solo se vean cuatro. La estrecha se lista con su marca y sus      *
 *      cifras; excluirla es del usuario.                                        *
 *   2. **Ninguna se decide sola**, y ⛔ **el botón apagado SIEMPRE dice por      *
 *      qué**: apagarlo sin motivo LANZA, no se queda mudo.                      *
 *   3. **La foto caduca entera** (decisión 3C) y se dice EN EL BLOQUE, que es   *
 *      donde estaba lo que ha desaparecido.                                     *
 *                                                                              *
 * ⭐ **DESDE EL 2026-08-17 EL MÓDULO SÍ IMPORTA LEAFLET**: el bloque dejó de     *
 * ser un trozo de la columna y es una VENTANA que flota sobre el mapa, con      *
 * barra de título, arrastrable, plegable y cerrable. Los bloques 9 y 10 del     *
 * final defienden lo que eso añade —que plegar y cerrar NO pierdan nada, y que  *
 * el panel no pelee con el mapa que tiene debajo—, y con ello la columna        *
 * recupera los ~220 px que el punto de arriba declaraba estar gastando.          *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom, con Leaflet real donde hace falta un mapa).      *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  ALTO_FILA_PX,
  crearListaSobrante,
  DESTINO_ALTA,
  FILAS_VISIBLES,
  FORMATO,
  NOTA_SUELTOS,
  NOTA_SUELTOS_PORQUE,
  PAPEL,
  MOTIVO_FOTO_CADUCA,
  MOTIVO_NINGUNA_INCLUIDA,
  MOTIVO_SIN_DERIVAR,
  ROTULO_ESTRECHA,
  ROTULO_NO_EMITIBLE,
  SALTO_TECLADO,
  SALTO_TECLADO_RAPIDO,
  SELECTOR,
  SIN_PIEZAS,
  SIN_PIEZAS_PORQUE,
  textoContador,
  textoMedidas,
  textoRecuento,
  textoResumen,
  TITULO,
} from '../../viewer/lista-sobrante.js'
import { montarMapa } from './_ayuda-jsdom.js'

const UMBRAL = 0.00707

/** Una `PiezaSobrante` de mentira con lo que la lista lee de verdad. */
function pieza(orden, { area = 12.4, grosor = 0.4231, estrecha = false, emitible = true } = {}) {
  return {
    orden,
    recintos: [{ tipo: 'EXTERIOR', vertices: [[0, 0], [1, 0], [1, 1]] }],
    area,
    grosor,
    estrecha,
    emitible,
    centroide: [0.5, 0.4],
  }
}

/** Una `Cesion` de mentira: solo lo que la vista consume. */
function cesion(piezas, { saltados = [], nEstrechas = null } = {}) {
  return {
    piezas,
    areaTotal: piezas.reduce((s, p) => s + p.area, 0),
    nEstrechas: nEstrechas ?? piezas.filter((p) => p.estrecha).length,
    nNoEmitibles: piezas.filter((p) => p.emitible === false).length,
    umbralGrosorM: UMBRAL,
    saltados,
  }
}

let lista = null
let avisos = []

beforeEach(() => {
  avisos = []
  lista = crearListaSobrante({
    documento: document,
    alAvisar: (mensaje, detalle) => avisos.push({ mensaje, nivel: detalle?.nivel }),
  })
  document.body.append(lista.nodo)
})

afterEach(() => {
  lista.destruir()
  document.body.innerHTML = ''
  lista = null
})

const q = (sel) => lista.nodo.querySelector(sel)
const qq = (sel) => [...lista.nodo.querySelectorAll(sel)]
const filas = () => qq(SELECTOR.FILA)
const casillas = () => qq(SELECTOR.INCLUIR)
const campos = () => qq(SELECTOR.NOMBRE)
const boton = () => q(SELECTOR.ENTREGAR)
const renglon = () => q(SELECTOR.ESTADO_ENTREGA)

/** Cambia un control como lo haría una persona: valor + evento. */
function tocar(control, evento) {
  control.dispatchEvent(new window.Event(evento, { bubbles: true }))
}

// ── 1 · El arranque ─────────────────────────────────────────────────────────

describe('crearListaSobrante · al nacer', () => {
  it('⛔ el botón nace APAGADO y el renglón dice por qué, en el mismo instante', () => {
    // Un botón gris y mudo es un error silencioso: desde fuera no se distingue de
    // uno roto.
    expect(boton().disabled).toBe(true)
    expect(renglon().textContent).toBe(MOTIVO_SIN_DERIVAR)
    expect(renglon().textContent).toMatch(/Rehacer el parcelario/)
  })

  it('el bloque trae su rótulo, su lista y su contador, y no cuelga de nada', () => {
    // ⛔ El rótulo «Sobrante» se retiró el 2026-08-18: quedaba pegado debajo de
    // «Para presentar», dos rótulos apilados sin nada en medio. Su recuento subió
    // a la derecha del que se queda.
    expect(q(SELECTOR.CONTADOR).closest('.gml-rotulo-fila')).not.toBeNull()
    expect(q(SELECTOR.LISTA)).not.toBeNull()
    expect(q(SELECTOR.CONTADOR)).not.toBeNull()
    expect(filas()).toHaveLength(0)
  })

  it('el contador va en `role="status"`: se anuncia SIN robar el foco', () => {
    // Es lo que hace falta cuando el foco está justo en la casilla que lo cambia.
    expect(q(SELECTOR.CONTADOR).getAttribute('role')).toBe('status')
    expect(renglon().getAttribute('role')).toBe('status')
  })

  it('sin documento utilizable, LANZA', () => {
    expect(() => crearListaSobrante({ documento: {} })).toThrow(TypeError)
  })
})

// ── 2 · Pintar una foto ─────────────────────────────────────────────────────

describe('crearListaSobrante · pintar', () => {
  it('una pieza es una fila con su número, su casilla, su nombre y sus DOS cifras', () => {
    lista.pintar(cesion([pieza(1)]))
    expect(filas()).toHaveLength(1)
    expect(filas()[0].dataset.orden).toBe('1')
    expect(casillas()[0].checked).toBe(true)
    expect(campos()[0].value).toBe('')
    expect(q(SELECTOR.MEDIDAS).textContent).toBe(textoMedidas(pieza(1)))
    expect(q(SELECTOR.MEDIDAS).textContent).toMatch(/12,40 m² · 0,4231 m/)
  })

  it('⭐ el grosor lleva CUATRO decimales, y no es aseo', () => {
    // Está medido en F17: una astilla de residuo puede tener 0,0007 m de grosor.
    // Con dos decimales el renglón diría «0,00 m», o sea «no mide nada», que es la
    // lectura tranquilizadora y falsa que la regla de oro 1 prohíbe.
    lista.pintar(cesion([pieza(1, { area: 0.0051, grosor: 0.0007 })]))
    expect(q(SELECTOR.MEDIDAS).textContent).toMatch(/0,0007 m/)
    expect(q(SELECTOR.MEDIDAS).textContent).not.toMatch(/0,00 m$/)
  })

  it('⛔ la pieza ESTRECHA se lista con su marca, y la marca es una PALABRA', () => {
    // Nunca desaparece: se marca, se lista y se avisa. Y la marca es texto y no un
    // símbolo, porque el vocabulario de aviso de este proyecto es la palabra
    // «Aviso» y porque un carácter de advertencia no lo lee igual un lector de
    // pantalla que otro.
    lista.pintar(cesion([pieza(1, { estrecha: true }), pieza(2)]))
    expect(filas()).toHaveLength(2)
    const marcas = qq(SELECTOR.ESTRECHA)
    expect(marcas).toHaveLength(1)
    expect(marcas[0].textContent).toBe(ROTULO_ESTRECHA)
    expect(marcas[0].title).toMatch(/decidirlo es de quien firma/i)
  })

  it('la nota cuenta cuántas son estrechas, con el umbral que se ha usado', () => {
    lista.pintar(cesion([pieza(1, { estrecha: true }), pieza(2, { estrecha: true }), pieza(3)]))
    // La línea CORTA lleva el recuento; el umbral vive detrás del «¿por qué?».
    expect(q(SELECTOR.NOTA).textContent).toMatch(/2 de 3 por debajo del umbral/)
    expect(q(SELECTOR.NOTA).textContent).not.toMatch(/0,0071 m/)
    expect(q(SELECTOR.porqueDe('nota')).textContent).toMatch(/0,0071 m/)
  })

  it('⭐ los `saltados` se pintan AQUÍ y dicen que la lista puede estar corta', () => {
    // La decisión que el plan dejó abierta. En el canal global de avisos se leerían
    // entre hallazgos de otra cosa, y son justamente el motivo por el que puede
    // faltar sobrante en esta lista.
    lista.pintar(
      cesion([pieza(1)], { saltados: [{ sitio: 'recintos[0]', motivo: 'anillo degenerado' }] }),
    )
    expect(q(SELECTOR.NOTA).textContent).toMatch(/1 recinto\(s\) NO se han podido medir/)
    expect(q(SELECTOR.porqueDe('nota')).textContent).toMatch(/anillo degenerado/)
  })

  it('sin piezas, se DICE que no hay sobrante y no se deja una caja vacía', () => {
    // Que no haya sobrante es un resultado legítimo, y una caja vacía se lee como
    // «esto no ha cargado».
    lista.pintar(cesion([]))
    expect(q(SELECTOR.VACIO).hidden).toBe(false)
    expect(q(SELECTOR.VACIO).textContent).toBe(SIN_PIEZAS)
    expect(q(SELECTOR.LISTA).hidden).toBe(true)
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(0, 0))
  })

  it('`pintar` con algo que no es una `Cesion` LANZA nombrando lo que espera', () => {
    expect(() => lista.pintar({ nada: true })).toThrow(/derivarCesion/)
    expect(() => lista.pintar([pieza(1)])).toThrow(TypeError)
  })
})

// ── 3 · ⭐ El presupuesto de píxeles ────────────────────────────────────────

describe('crearListaSobrante · el tope de 4 filas', () => {
  it('el tope de la caja es ALTURA con scroll, no un recorte de la lista', () => {
    // ⛔ Y el número de filas NO lo decide el caso de uso, lo decide la geometría:
    // un vértice mal puesto produce ocho piezas sin que nadie lo pretenda.
    lista.pintar(cesion([1, 2, 3, 4, 5, 6, 7, 8].map((n) => pieza(n))))
    expect(filas(), 'las ocho están en el DOM: el tope es visual').toHaveLength(8)
    expect(q(SELECTOR.LISTA).style.maxHeight).toBe(`${FILAS_VISIBLES * ALTO_FILA_PX}px`)
    expect(q(SELECTOR.LISTA).style.overflowY).toBe('auto')
  })

  it('⭐ el contador deja de ser adorno: ves 4 y dice 8', () => {
    lista.pintar(cesion([1, 2, 3, 4, 5, 6, 7, 8].map((n) => pieza(n))))
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(8, 8))
    expect(q(SELECTOR.CONTADOR).textContent).toMatch(/Se emitirán 8 de 8 piezas/)
  })

  it('el contador concuerda en singular con una sola pieza', () => {
    lista.pintar(cesion([pieza(1)]))
    expect(q(SELECTOR.CONTADOR).textContent).toMatch(/de 1 pieza,/)
  })
})

// ── 4 · Incluir, excluir y nombrar ──────────────────────────────────────────

describe('crearListaSobrante · el usuario decide', () => {
  it('todas nacen marcadas, y desmarcar una actualiza contador y selección', () => {
    lista.pintar(cesion([pieza(1), pieza(2), pieza(3)]))
    expect(lista.seleccionadas()).toEqual([1, 2, 3])

    casillas()[1].checked = false
    tocar(casillas()[1], 'change')
    expect(lista.seleccionadas()).toEqual([1, 3])
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(2, 3))
  })

  it('`alCambiarSeleccion` recibe los `orden` marcados, en orden', () => {
    const vistos = []
    lista.alCambiarSeleccion((s) => vistos.push(s))
    lista.pintar(cesion([pieza(1), pieza(2)]))
    casillas()[0].checked = false
    tocar(casillas()[0], 'change')
    expect(vistos).toEqual([[2]])
  })

  it('`nombres()` devuelve solo los escritos, sin espacios de sobra', () => {
    lista.pintar(cesion([pieza(1), pieza(2)]))
    campos()[0].value = '  Cesión al camino  '
    tocar(campos()[0], 'input')
    expect(lista.nombres()).toEqual({ 1: 'Cesión al camino' })
  })

  it('`alNombrar` avisa con el `orden` y el texto ya limpio', () => {
    const vistos = []
    lista.alNombrar((orden, nombre) => vistos.push([orden, nombre]))
    lista.pintar(cesion([pieza(7)]))
    campos()[0].value = ' Resto '
    tocar(campos()[0], 'input')
    expect(vistos).toEqual([[7, 'Resto']])
  })

  it('⛔ NOMBRE ACCESIBLE en la casilla y en el campo: no vale «casilla, casilla»', () => {
    // Dentro de la etiqueta el texto es el NÚMERO, así que sin `aria-label` un
    // lector de pantalla diría «casilla, 1» sin decir nunca de qué.
    lista.pintar(cesion([pieza(2)]))
    expect(casillas()[0].getAttribute('aria-label')).toBe('Incluir la pieza 2 en el expediente')
    expect(campos()[0].getAttribute('aria-label')).toBe('Nombre de la pieza 2')
  })

  it('el botón APUNTA a su renglón, para que se oiga por qué está apagado', () => {
    expect(boton().getAttribute('aria-describedby')).toBe(renglon().id)
    expect(renglon().id).not.toBe('')
  })
})

// ── 5 · ⛔ El botón, y el motivo obligatorio ────────────────────────────────

describe('crearListaSobrante · entrega', () => {
  it('apagar el botón SIN motivo LANZA: no puede quedarse mudo', () => {
    expect(() => lista.entrega({ habilitado: false })).toThrow(/EXIGE un 'motivo'/)
    expect(() => lista.entrega({ habilitado: false, motivo: '   ' })).toThrow(TypeError)
  })

  it('`habilitado` no booleano LANZA: un botón no tiene tercer estado', () => {
    expect(() => lista.entrega({ habilitado: null, motivo: 'x' })).toThrow(/booleano/)
  })

  it('con motivo, apaga y lo escribe; encender lo deja pulsable', () => {
    lista.entrega({ habilitado: false, motivo: MOTIVO_NINGUNA_INCLUIDA })
    expect(boton().disabled).toBe(true)
    expect(renglon().textContent).toBe(MOTIVO_NINGUNA_INCLUIDA)
    expect(renglon().textContent).toMatch(/usa «Generar GML» para entregar solo la parcela/)

    lista.entrega({ habilitado: true, motivo: '' })
    expect(boton().disabled).toBe(false)
  })

  it('`alEntregar` se dispara al pulsar, y la baja funciona', () => {
    let veces = 0
    const baja = lista.alEntregar(() => veces++)
    lista.entrega({ habilitado: true })
    boton().click()
    expect(veces).toBe(1)
    baja()
    boton().click()
    expect(veces).toBe(1)
  })

  it('`estado()` escribe el acuse, y marca el fallo con la clase de error', () => {
    lista.estado('Descargado «expediente.gml» (2 parcelas).')
    expect(renglon().textContent).toMatch(/Descargado/)
    expect(renglon().classList.contains('gml-accion-estado--error')).toBe(false)
    lista.estado('No se ha podido componer.', { error: true })
    expect(renglon().classList.contains('gml-accion-estado--error')).toBe(true)
  })
})

// ── 6 · ⛔ La foto caduca entera (3C) ───────────────────────────────────────

describe('crearListaSobrante · el sobrante es una FOTO', () => {
  it('⛔ repintar NO conserva nombres ni casillas: el `orden` 2 es otro terreno', () => {
    lista.pintar(cesion([pieza(1), pieza(2)]))
    campos()[1].value = 'La del camino'
    tocar(campos()[1], 'input')
    casillas()[0].checked = false
    tocar(casillas()[0], 'change')
    expect(lista.nombres()).toEqual({ 2: 'La del camino' })

    lista.pintar(cesion([pieza(1), pieza(2)]))
    expect(lista.nombres()).toEqual({})
    expect(lista.seleccionadas()).toEqual([1, 2])
  })

  it('⭐ `invalidar` vacía Y LO DICE, en el propio bloque y no en el canal global', () => {
    // Un aviso se lee donde estaba lo que ha desaparecido. En el canal de avisos
    // —que es de la aplicación entera— «vuelve a derivar» quedaría entre hallazgos
    // de F02 y fallos de red, sin explicar el hueco que el usuario tiene delante.
    lista.pintar(cesion([pieza(1)]))
    lista.invalidar()
    expect(filas()).toHaveLength(0)
    expect(q(SELECTOR.NOTA).hidden).toBe(false)
    expect(q(SELECTOR.NOTA).textContent).toBe(MOTIVO_FOTO_CADUCA)
    expect(q(SELECTOR.NOTA).textContent).toMatch(/Los nombres escritos se han perdido/)
    expect(avisos, 'no se ha usado el canal global').toEqual([])
  })

  it('tras invalidar, el botón vuelve a estar apagado con su motivo', () => {
    lista.pintar(cesion([pieza(1)]))
    lista.entrega({ habilitado: true })
    lista.invalidar('La parcela ha cambiado.')
    expect(boton().disabled).toBe(true)
    expect(renglon().textContent).toBe(MOTIVO_SIN_DERIVAR)
  })

  it('`pintar(null)` deja el bloque como al nacer', () => {
    lista.pintar(cesion([pieza(1)]))
    lista.pintar(null)
    expect(filas()).toHaveLength(0)
    expect(q(SELECTOR.CONTADOR).textContent).toBe('')
    expect(boton().disabled).toBe(true)
    expect(renglon().textContent).toBe(MOTIVO_SIN_DERIVAR)
  })
})

// ── 7 · El resaltado recíproco ──────────────────────────────────────────────

describe('crearListaSobrante · resaltado', () => {
  it('`resaltar(n)` marca su fila y desmarca las demás', () => {
    lista.pintar(cesion([pieza(1), pieza(2)]))
    lista.resaltar(2)
    expect(filas().map((f) => f.dataset.resaltada)).toEqual(['no', 'si'])
    lista.resaltar(null)
    expect(filas().map((f) => f.dataset.resaltada)).toEqual(['no', 'no'])
  })

  it('señalar una FILA avisa a quien escuche (y también con el TECLADO)', () => {
    const vistos = []
    lista.alSenalar((o) => vistos.push(o))
    lista.pintar(cesion([pieza(1), pieza(2)]))

    filas()[1].dispatchEvent(new window.MouseEvent('mouseenter', { bubbles: false }))
    expect(vistos).toEqual([2])
    filas()[1].dispatchEvent(new window.MouseEvent('mouseleave', { bubbles: false }))
    expect(vistos).toEqual([2, null])

    // Quien recorre la lista con el tabulador tiene el mismo derecho a saber qué
    // mancha está tocando que quien usa el ratón.
    casillas()[0].dispatchEvent(new window.FocusEvent('focus'))
    expect(vistos).toEqual([2, null, 1])
  })

  it('`resaltar` con un `orden` que ya no existe no lanza', () => {
    lista.pintar(cesion([pieza(1)]))
    expect(() => lista.resaltar(99)).not.toThrow()
  })

  // ── ⛔ SALIR DE LA LISTA CON EL TABULADOR TAMBIÉN APAGA (auditoría V4) ──────
  // El resaltado por teclado tenía ida y no vuelta: `focus` encendía la fila y su
  // mancha en el mapa, y no había nada que las apagara. Quien tabulaba fuera del
  // bloque —al botón «Rehacer el parcelario», o al siguiente paso— se dejaba una fila
  // y una mancha encendidas indefinidamente, señalando algo que ya no está
  // tocando. Con el ratón sí se apagaba (`mouseleave`), y esa asimetría era el
  // síntoma.
  it('⛔ tabular FUERA de la lista apaga la fila y su mancha', () => {
    const vistos = []
    lista.alSenalar((o) => vistos.push(o))
    lista.pintar(cesion([pieza(1), pieza(2)]))
    const fuera = document.createElement('button')
    document.body.append(fuera)

    casillas()[0].focus()
    expect(vistos).toEqual([1])
    expect(filas()[0].dataset.resaltada).toBe('si')

    fuera.focus()

    expect(vistos, 'salir de la lista no ha apagado la mancha').toEqual([1, null])
    expect(filas().map((f) => f.dataset.resaltada)).toEqual(['no', 'no'])
  })

  it('tabular ENTRE controles de la lista NO parpadea (ni dentro de la fila ni entre filas)', () => {
    // El defecto que se paga por arreglar mal el de arriba: apagar en cada
    // `focusout` mandaría un `null` entre cada dos controles, y la mancha del mapa
    // se encendería y apagaría a cada tabulación.
    const vistos = []
    lista.alSenalar((o) => vistos.push(o))
    lista.pintar(cesion([pieza(1), pieza(2)]))

    casillas()[0].focus()
    campos()[0].focus() // mismo renglón: no es salir
    casillas()[1].focus() // otra fila: la que entra manda, sin `null` de por medio

    // Lo que NO puede aparecer es un `null` intercalado: ése es el parpadeo. Que
    // el 1 se repita al pasar de la casilla a su campo es inocuo —señalar la misma
    // pieza dos veces pinta la misma mancha— y no se dedupica a propósito: costaría
    // un estado más para no arreglar nada que se vea.
    expect(vistos).not.toContain(null)
    expect(vistos).toEqual([1, 1, 2])
    expect(filas().map((f) => f.dataset.resaltada)).toEqual(['no', 'si'])
  })
})

// ── 8 · Desmontaje ──────────────────────────────────────────────────────────

describe('crearListaSobrante · destruir', () => {
  it('saca el nodo del documento, olvida los oyentes y es idempotente', () => {
    const vistos = []
    lista.alCambiarSeleccion((s) => vistos.push(s))
    lista.pintar(cesion([pieza(1)]))
    lista.destruir()
    expect(lista.nodo.isConnected).toBe(false)
    expect(lista.piezas()).toEqual([])
    expect(() => lista.destruir()).not.toThrow()
    expect(() => lista.pintar(cesion([pieza(1)]))).not.toThrow()
    expect(vistos).toEqual([])
  })
})

// ── ⛔ El DESTINO de una pieza (F23) y la cifra que se firma ─────────────────

describe('crearListaSobrante · el destino de una pieza', () => {
  // ⭐ EL DEFECTO (auditoría 2026-08-16, MEDIA). El oyente `change` del desplegable
  // de destino apagaba el campo de nombre y avisaba a `alCambiarSeleccion`, pero
  // **no repintaba el contador**: solo lo hacían el `change` de la casilla y
  // `pintar`. Con 2 piezas marcadas, asignar la 1 a la colindante dejaba
  // `seleccionadas()` en `[2]` y el botón de entrega refrescado, pero el renglón
  // seguía diciendo «Se emitirán 2 de 2 piezas, más la parcela» hasta que se tocaba
  // cualquier casilla. **Es una cifra sobre la que se firma**, y decir de más es
  // exactamente lo que la regla de oro 1 prohíbe.

  /** Una foto cuyas piezas lindan todas con la misma colindante: todas con desplegable. */
  function conVecino(piezas, refcat = 'V-1') {
    const foto = cesion(piezas)
    foto.recorte = {
      consultado: true,
      lindes: piezas.map((p) => ({ orden: p.orden, refcats: [refcat] })),
      atribucion: [],
    }
    return foto
  }

  const destinos = () => qq(SELECTOR.DESTINO)

  it('⛔ mandar una pieza a la colindante REPINTA el contador, no lo deja rancio', () => {
    lista.pintar(conVecino([pieza(1), pieza(2)]))
    expect(destinos()).toHaveLength(2)
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(2, 2))

    destinos()[0].value = 'V-1'
    tocar(destinos()[0], 'change')

    // La selección efectiva ya solo tiene la 2 (la 1 viaja DENTRO de la parcela del
    // vecino, no como miembro suelto del fichero)…
    expect(lista.seleccionadas()).toEqual([2])
    // …y la cifra que se lee lo dice, sin tener que tocar nada más.
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(1, 2))
    expect(q(SELECTOR.CONTADOR).textContent).toMatch(/Se emitirán 1 de 2 piezas/)
  })

  it('y devolverla a «finca nueva» la vuelve a contar', () => {
    lista.pintar(conVecino([pieza(1), pieza(2)]))
    destinos()[0].value = 'V-1'
    tocar(destinos()[0], 'change')
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(1, 2))

    destinos()[0].value = DESTINO_ALTA
    tocar(destinos()[0], 'change')
    expect(lista.seleccionadas()).toEqual([1, 2])
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(2, 2))
  })

  it('desmarcar Y asignar se acumulan en la misma cifra', () => {
    // Los dos caminos que cambian la selección efectiva, a la vez: si solo uno
    // repintara, el contador quedaría con la mitad de la verdad.
    lista.pintar(conVecino([pieza(1), pieza(2), pieza(3)]))
    destinos()[0].value = 'V-1'
    tocar(destinos()[0], 'change')
    casillas()[1].checked = false
    tocar(casillas()[1], 'change')

    expect(lista.seleccionadas()).toEqual([3])
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(1, 3))
  })

  it('el reparto y los oyentes siguen igual: el arreglo solo añade el repintado', () => {
    const vistos = []
    lista.alCambiarSeleccion((s) => vistos.push(s))
    lista.pintar(conVecino([pieza(1), pieza(2)]))

    destinos()[0].value = 'V-1'
    tocar(destinos()[0], 'change')

    expect(lista.asignaciones()).toEqual({ 1: 'V-1' })
    expect(vistos).toEqual([[2]])
    // Y el nombre se apaga: una finca que se funde con la del vecino no se bautiza.
    expect(campos()[0].disabled).toBe(true)
    expect(campos()[1].disabled).toBe(false)
  })
})

// ── ⛔ La pieza que NO se puede escribir en el fichero ───────────────────────

describe('crearListaSobrante · una pieza que no se puede emitir', () => {
  // ⭐ EL DEFECTO (2026-08-10, `6346726UF8664N`). Al enganchar la medición a los
  // linderos oficiales queda una astilla de milímetros. La lista la ofrecía MARCADA
  // como una finca cualquiera, `seleccionadas()` la devolvía, y el escritor de GML
  // se negaba a emitir el documento ENTERO por no encontrarle punto de referencia.
  // El autor veía «Se emitirán 1 de 1 pieza» y un botón que no descargaba nada.
  const astilla = pieza(1, { area: 0.0251, grosor: 0.0011, estrecha: true, emitible: false })

  it('⛔ nace DESMARCADA y `seleccionadas()` no la devuelve', () => {
    lista.pintar(cesion([astilla]))
    expect(casillas()[0].checked).toBe(false)
    expect(lista.seleccionadas()).toEqual([])
  })

  it('⛔ y marcarla A MANO tampoco la mete: no es una preferencia, es imposible', () => {
    // La casilla es del DOM y el DOM se puede tocar. Lo que no puede es cambiar que
    // la pieza deje de encerrar superficie al escribirla.
    lista.pintar(cesion([astilla]))
    casillas()[0].checked = true
    tocar(casillas()[0], 'change')
    expect(lista.seleccionadas()).toEqual([])
  })

  it('lleva su propia marca, distinta de «estrecha», y dice por qué', () => {
    lista.pintar(cesion([astilla]))
    const marca = q(SELECTOR.NO_EMITIBLE)
    expect(marca).not.toBeNull()
    expect(marca.textContent).toBe(ROTULO_NO_EMITIBLE)
    expect(marca.title).toMatch(/deja de encerrar superficie/)
    // ⛔ Y la de estrecha SIGUE ahí: son dos hechos, y el segundo no tapa al primero.
    expect(q(SELECTOR.ESTRECHA)).not.toBeNull()
  })

  it('sin colindantes con quien lindar, la casilla se APAGA en vez de no hacer nada', () => {
    lista.pintar(cesion([astilla]))
    expect(casillas()[0].disabled).toBe(true)
  })

  it('⭐ pero si linda con alguien la casilla sigue viva: dársela al vecino SÍ funciona', () => {
    // Al fundirse con la parcela del colindante deja de ser un recinto propio, así
    // que el problema del punto de referencia desaparece. Apagar la casilla también
    // aquí habría quitado la única salida buena que tiene esa superficie.
    const foto = cesion([astilla])
    foto.recorte = { consultado: true, lindes: [{ orden: 1, refcats: ['V-1'] }], atribucion: [] }
    lista.pintar(foto)
    expect(casillas()[0].disabled).toBe(false)
    expect(q(SELECTOR.DESTINO)).not.toBeNull()
  })

  it('el contador dice 0 de 1, y la nota explica el porqué en vez de dejar el hueco', () => {
    lista.pintar(cesion([astilla]))
    expect(q(SELECTOR.CONTADOR).textContent).toBe(textoContador(0, 1))
    expect(q(SELECTOR.NOTA).hidden).toBe(false)
    // ⚠️ Y CONCUERDA ENTERA. La primera versión decía «1 no se puede emitir como
    // finca: al escribirLAS … DEJAN de encerrar superficie»: lo cazó mirar la
    // pantalla en Chrome, no esta suite. Es la misma exigencia que «Las 1 parcelas»
    // en `comprobacion/conjunto.js`.
    expect(q(SELECTOR.porqueDe('nota')).textContent).toMatch(
      /1 no se puede emitir como finca: al escribirla con los 2 decimales del fichero deja de encerrar superficie\. Se queda fuera del expediente\./,
    )
    expect(q(SELECTOR.porqueDe('nota')).textContent).not.toMatch(/escribirlas|dejan|quedan/)
  })

  it('…y en plural también concuerda', () => {
    lista.pintar(
      cesion([astilla, pieza(2, { area: 0.02, grosor: 0.001, estrecha: true, emitible: false })]),
    )
    expect(q(SELECTOR.porqueDe('nota')).textContent).toMatch(
      /2 no se pueden emitir como finca: al escribirlas con los 2 decimales del fichero dejan de encerrar superficie\. Se quedan fuera del expediente\./,
    )
  })

  it('⛔ una pieza normal en la misma foto no se contagia', () => {
    lista.pintar(cesion([astilla, pieza(2, { area: 30 })]))
    expect(casillas()[0].checked).toBe(false)
    expect(casillas()[1].checked).toBe(true)
    expect(lista.seleccionadas()).toEqual([2])
    expect(qq(SELECTOR.NO_EMITIBLE)).toHaveLength(1)
  })
})

// ── 9 · El cromo del panel: plegar y cerrar (2026-08-17) ────────────────────
//
// Desde que este bloque dejó de ser un trozo fijo de la columna y pasó a ser un
// panel con barra de título, tiene dos estados que el usuario controla. Lo que se
// afirma aquí es lo que hace que sean seguros:
//
//   1. **Plegar y cerrar NO PIERDEN NADA.** Ni un nombre escrito, ni una casilla
//      desmarcada, ni un destino elegido. Lo único que borra esta lista es
//      `invalidar()`, y allí lo que ha caducado es el DATO, no la vista. Si
//      plegar tirara el trabajo, el `[–]` sería una trampa con forma de comodidad.
//   2. **Volver a derivar SIEMPRE devuelve el panel**, esté plegado o cerrado. Sin
//      eso, pulsar «Rehacer el parcelario» correría la derivación entera y no
//      pasaría nada visible: el error silencioso en versión interfaz.

describe('crearListaSobrante · plegar y cerrar', () => {
  const treinta = () => cesion([pieza(1, { area: 30 }), pieza(2, { area: 12 })])

  it('la barra se llama IGUAL que el botón que abre el panel', () => {
    // Es la única pista de que el panel es consecuencia de aquel botón, porque no
    // aparece donde se pulsó. Dos nombres distintos obligarían a deducirlo.
    expect(q(SELECTOR.TITULO).textContent).toBe(TITULO)
    expect(MOTIVO_SIN_DERIVAR).toContain(TITULO)
  })

  it('⛔ esconder de verdad ESCONDE: `hidden` solo no basta con `display` en línea', () => {
    // EL DEFECTO QUE ESTA PRUEBA CIERRA, cazado por el guion de humo 16 en Chrome
    // el 2026-08-17. `hidden` esconde por la hoja del navegador
    // (`[hidden]{display:none}`), y estos dos nodos llevan `display:flex` EN
    // LÍNEA: un estilo en línea gana a cualquier selector, así que plegar y
    // cerrar ponían el atributo y **no escondían nada**. En pantalla el panel
    // seguía puesto; el guion lo denunció como «se ve antes de derivar nada» y
    // tenía razón — lo roto era el cierre.
    //
    // ⚠️ Y las pruebas de aquí abajo NO lo veían, porque comprueban `.hidden`
    // como propiedad y en jsdom nadie maqueta. Por eso ésta mira `display`, que
    // es lo único que de verdad decide si se ve.
    lista.pintar(treinta())

    lista.plegar()
    expect(q(SELECTOR.CUERPO).style.display, 'el cuerpo plegado').toBe('none')
    lista.desplegar()
    expect(q(SELECTOR.CUERPO).style.display, 'y desplegado vuelve a repartir').toBe('flex')

    lista.cerrar()
    expect(lista.nodo.style.display, 'el panel cerrado').toBe('none')
    lista.abrir()
    expect(lista.nodo.style.display).toBe('flex')
  })

  it('plegado deja la BARRA con su recuento y esconde el cuerpo', () => {
    lista.pintar(treinta())
    lista.plegar()

    expect(lista.estaPlegado()).toBe(true)
    expect(q(SELECTOR.CUERPO).hidden, 'el cuerpo se pliega').toBe(true)
    expect(q(SELECTOR.CABECERA).hidden, '⛔ la barra NO: es la única salida').toBe(false)
    expect(lista.nodo.hidden, 'plegar no es cerrar').toBe(false)
    // Plegado, la barra es lo único que queda: tiene que seguir diciendo que hay
    // algo dentro, o se lee como un botón apagado.
    expect(q(SELECTOR.RECUENTO).textContent).toBe(textoRecuento(2))
  })

  it('⛔ restaurar devuelve la lista con NOMBRES y CASILLAS intactos', () => {
    lista.pintar(treinta())
    campos()[0].value = 'La Solana'
    tocar(campos()[0], 'input')
    casillas()[1].checked = false
    tocar(casillas()[1], 'change')

    const antes = { nombres: lista.nombres(), marcadas: lista.seleccionadas() }

    lista.plegar()
    lista.desplegar()

    expect(lista.estaPlegado()).toBe(false)
    expect(q(SELECTOR.CUERPO).hidden).toBe(false)
    expect(lista.nombres(), 'el nombre escrito sobrevive al plegado').toEqual(antes.nombres)
    expect(lista.seleccionadas(), 'y la casilla desmarcada también').toEqual(antes.marcadas)
    expect(campos()[0].value).toBe('La Solana')
  })

  it('cerrar esconde el panel ENTERO, barra incluida, y tampoco pierde nada', () => {
    lista.pintar(treinta())
    campos()[0].value = 'La Solana'
    tocar(campos()[0], 'input')

    lista.cerrar()

    expect(lista.estaAbierto()).toBe(false)
    expect(lista.nodo.hidden).toBe(true)
    expect(lista.nombres(), '⛔ cerrar es esconder, no vaciar').toEqual({ 1: 'La Solana' })

    lista.abrir()
    expect(lista.nodo.hidden).toBe(false)
    expect(campos()[0].value).toBe('La Solana')
  })

  it('los dos estados son INDEPENDIENTES: plegar no cierra ni cerrar pliega', () => {
    // Fundirlos en un solo booleano obligaría a que restaurar decidiera cuál de
    // los dos deshace, y esa decisión sólo la sabe quien lo escondió.
    lista.pintar(treinta())
    lista.plegar()
    lista.cerrar()
    expect([lista.estaPlegado(), lista.estaAbierto()]).toEqual([true, false])

    lista.abrir()
    expect(lista.estaPlegado(), 'sigue plegado tras reabrir').toBe(true)
    expect(q(SELECTOR.CUERPO).hidden).toBe(true)
  })

  it('⛔ una foto NUEVA despliega y abre: derivar otra vez siempre se ve', () => {
    lista.pintar(treinta())
    lista.plegar()
    lista.cerrar()

    lista.pintar(treinta())

    expect(lista.estaAbierto(), 'vuelve a verse').toBe(true)
    expect(lista.estaPlegado(), 'y desplegado').toBe(false)
    expect(lista.nodo.hidden).toBe(false)
    expect(q(SELECTOR.CUERPO).hidden).toBe(false)
  })

  it('…pero una foto VACÍA no fuerza el panel a nadie', () => {
    // `pintar(null)` es lo que corre al arrancar y al invalidar. Abrir el panel
    // ahí sería enseñar una caja vacía a quien acaba de cerrarla.
    lista.pintar(treinta())
    lista.cerrar()
    lista.pintar(null)
    expect(lista.estaAbierto()).toBe(false)
  })

  it('los dos botones del cromo responden al clic, que es como se usan', () => {
    lista.pintar(treinta())

    q(SELECTOR.MINIMIZAR).click()
    expect(lista.estaPlegado()).toBe(true)
    q(SELECTOR.MINIMIZAR).click()
    expect(lista.estaPlegado()).toBe(false)

    q(SELECTOR.CERRAR).click()
    expect(lista.estaAbierto()).toBe(false)
  })

  it('el botón de plegar DICE su estado, y no solo con una flecha', () => {
    // `▲` y `–` sólo se distinguen mirando. Quien llega con un lector de pantalla
    // necesita `aria-expanded`, y que concuerde con lo que se ve.
    const min = () => q(SELECTOR.MINIMIZAR)
    expect(min().getAttribute('aria-expanded')).toBe('true')
    expect(min().getAttribute('aria-label')).toMatch(/Plegar/)

    lista.plegar()
    expect(min().getAttribute('aria-expanded')).toBe('false')
    expect(min().getAttribute('aria-label')).toMatch(/Desplegar/)
  })

  it('el recuento cuenta PIEZAS, y el contador de dentro cuenta las que se emiten', () => {
    // Son dos cifras distintas a propósito: verlas a la vez es lo que enseña que
    // desmarcar una casilla no borra la pieza.
    lista.pintar(treinta())
    casillas()[1].checked = false
    tocar(casillas()[1], 'change')

    expect(q(SELECTOR.RECUENTO).textContent, 'la barra: cuántas hay').toBe(textoRecuento(2))
    expect(q(SELECTOR.CONTADOR).textContent, 'dentro: cuántas van').toBe(textoContador(1, 2))
  })

  it('el recuento concuerda en singular y desaparece sin piezas', () => {
    expect(textoRecuento(1)).toBe('· 1 pieza')
    expect(textoRecuento(2)).toBe('· 2 piezas')
    expect(textoRecuento(0), 'sin piezas no se escribe «· 0 piezas»').toBe('')
  })
})

// ── 10 · El panel sobre el mapa (2026-08-17) ────────────────────────────────
//
// Con `mapa`, esta vista deja de ser un nodo que alguien cuelga y pasa a ser un
// CONTROL de Leaflet en la esquina `bottomleft`. Lo que se afirma aquí es lo que
// separa un panel usable de uno que pelea con el mapa que tiene debajo.
//
// ⚠️ **Lo que este bloque NO puede probar es el ACOTADO**, y no por pereza: en
// jsdom `getBoundingClientRect()` devuelve ceros, así que la corrección siempre
// sale 0 y un `expect` sobre ella compararía nada contra nada. La aritmética se
// prueba con números en `test/viewer/acotar-viewport.test.js` (proyecto `node`) y
// su aplicación real la mide el guion de humo 16, en Chromium.

describe('crearListaSobrante · como control del mapa', () => {
  let entorno = null
  let conMapa = null

  beforeEach(() => {
    entorno = montarMapa({ zoom: 16 })
    conMapa = crearListaSobrante({ mapa: entorno.mapa, documento: document })
  })

  afterEach(() => {
    conMapa.destruir()
    entorno.destruir()
    entorno = null
    conMapa = null
  })

  it('se cuelga SOLO, en la esquina `bottomleft`, sin que nadie le haga append', () => {
    // La esquina no es libre: la comparten tres cajones. No hay turno que
    // negociar porque los tres los decide el PASO (`app/contraste.js#cajonDe`,
    // que sólo devuelve cajón en ENTRADA y DIAGNOSTICO) y éste es de EDICIÓN.
    expect(entorno.contenedor.contains(conMapa.nodo)).toBe(true)
    expect(conMapa.nodo.closest('.leaflet-bottom.leaflet-left')).not.toBeNull()
  })

  it('⛔ el gesto del panel NO LLEGA al mapa: ni el arrastre, ni la rueda', () => {
    // Los dos `OBLIGATORIOS` de Leaflet. Sin ellos el panel es inservible: cada
    // intento de moverlo desplaza la ortofoto por debajo, y cada scroll dentro de
    // la lista cambia la escala del mapa.
    //
    // ⛔ **Se mide la PROPAGACIÓN y no el centro del mapa**, y la primera versión
    // de esta prueba hacía lo segundo: comprobaba que `getCenter()` no cambiara
    // tras un `mousedown`+`mousemove`+`mouseup`. Salía verde **con las dos
    // llamadas borradas**, porque en jsdom el arrastre de Leaflet no llega a
    // mover nada de todas formas — o sea que medía el arnés, no el código. Es
    // literalmente el defecto que este fichero denuncia en su cabecera, cometido
    // dentro de él. Comprobado a la inversa: borrando las dos llamadas, esta
    // versión sale ROJA.
    const llegan = []
    const espia = (e) => llegan.push(e.type)
    for (const tipo of ['mousedown', 'wheel']) {
      entorno.contenedor.addEventListener(tipo, espia)
    }

    conMapa.nodo.dispatchEvent(new window.MouseEvent('mousedown', { bubbles: true }))
    conMapa.nodo.dispatchEvent(new window.WheelEvent('wheel', { bubbles: true, deltaY: -240 }))

    for (const tipo of ['mousedown', 'wheel']) {
      entorno.contenedor.removeEventListener(tipo, espia)
    }
    expect(llegan, 'ningún gesto del panel debe alcanzar el contenedor del mapa').toEqual([])
  })

  it('se viste de VENTANA: fondo, sombra y un tope de alto', () => {
    // Sin tope, una foto con muchas piezas y la sección de «fuera del contorno»
    // estiraría el panel hasta sacar su barra de título por arriba de la
    // ventana — que es justo lo que el acotado existe para impedir, sólo que por
    // el otro borde y sin que nadie arrastre nada.
    expect(conMapa.nodo.style.background).not.toBe('')
    expect(conMapa.nodo.style.boxShadow).not.toBe('')
    expect(conMapa.nodo.style.maxHeight).toBe('60vh')
    expect(conMapa.nodo.style.overflow).toBe('hidden')
  })

  it('el asidero se ve Y el cursor lo confirma: van juntos', () => {
    // Uno se ve de lejos y el otro se descubre al pasar por encima. Con sólo el
    // braille, el panel parece movible y no lo demuestra hasta que lo intentas.
    expect(conMapa.nodo.querySelector(SELECTOR.ASIDERO).textContent).toBe('⠿')
    expect(conMapa.nodo.querySelector(SELECTOR.CABECERA).style.cursor).toBe('move')
  })

  it('destruir lo saca del mapa y no deja el nodo suelto en el documento', () => {
    const nodo = conMapa.nodo
    conMapa.destruir()
    expect(nodo.parentNode).toBeNull()
    // Y es idempotente: el `afterEach` vuelve a llamarlo.
    expect(() => conMapa.destruir()).not.toThrow()
  })

  it('sin mapa sigue siendo el nodo suelto de siempre, sin cromo de ventana', () => {
    // `crearVisor` puede montarse sin la rama del sobrante, y quien lo haga no
    // tiene por qué arrastrar un control a ninguna esquina.
    expect(lista.nodo.style.boxShadow).toBe('')
    expect(lista.nodo.closest('.leaflet-bottom')).toBeNull()
  })
})

// ── 11 · Los ficheros sueltos, «para comprobar» (2026-08-17) ────────────────
//
// ⛔ **LA PROMESA QUE DEFIENDE ESTE BLOQUE NO ES QUE LA DESCARGA FUNCIONE: ES QUE
// SE DIGA LO QUE NO ES.** La FORMA del fichero es el acto jurídico. Un `.gml` con
// un solo `featureMember` es un documento impecable y válido contra el XSD, y aun
// así no es un expediente: la segregación sólo existe cuando las parcelas viajan
// en el MISMO documento (override O18, IVG positivo el 2026-08-03). Bajar las
// piezas una a una y subirlas por separado no es «lo mismo repartido» — es otra
// cosa, y la Sede la devuelve.
//
// Sin la nota de esta zona, dos botones junto a cada fila leerían exactamente
// como «aquí tienes tu expediente en trozos», y quien lo creyera perdería semanas
// esperando un IVG que ya salió negativo.

describe('crearListaSobrante · los ficheros sueltos', () => {
  const SUELTOS = [
    { clave: '9398516VK3799G', etiqueta: '9398516VK3799G', papel: PAPEL.MEDICION, superficieM2: 1336.02 },
    { clave: '9398516VK3799G.1', etiqueta: 'La Solana', papel: PAPEL.ALTA, superficieM2: 199.84 },
    { clave: '7150904UF7675S', etiqueta: '7150904UF7675S', papel: PAPEL.VECINO, superficieM2: 5.3 },
  ]

  it('la zona nace ESCONDIDA y `[]` la esconde otra vez', () => {
    // Antes de componer el expediente no se sabe qué geometrías lo forman, y
    // enseñar aquí lo que el usuario ha marcado sería enseñar una lista que puede
    // no coincidir con lo que acabaría dentro del fichero.
    expect(q(SELECTOR.SUELTOS).hidden).toBe(true)
    lista.piezasSueltas(SUELTOS)
    expect(q(SELECTOR.SUELTOS).hidden).toBe(false)
    lista.piezasSueltas([])
    expect(q(SELECTOR.SUELTOS).hidden).toBe(true)
    expect(qq(SELECTOR.SUELTO_FILA)).toHaveLength(0)
  })

  it('⛔ la zona DICE que un fichero suelto no forma expediente', () => {
    // La afirmación central. Si esta nota desaparece, la función entera pasa a
    // ser una invitación a presentar mal.
    lista.piezasSueltas(SUELTOS)
    expect(q(SELECTOR.SUELTOS_NOTA).textContent).toBe(NOTA_SUELTOS)
    expect(NOTA_SUELTOS).toMatch(/NO forma expediente/)
    // El «mismo documento» —el porqué— vive detrás del «¿por qué?». La línea
    // corta se queda con lo innegociable: que NO forma expediente.
    expect(NOTA_SUELTOS_PORQUE).toMatch(/mismo documento/)
    expect(q(SELECTOR.porqueDe('sueltos-nota')).textContent).toBe(NOTA_SUELTOS_PORQUE)
  })

  it('⭐ LA MEDICIÓN PROPIA está en la lista, y no es un descuido', () => {
    // Es la pieza que el usuario no espera encontrar aquí —«eso ya lo tengo»— y
    // justo por eso hace falta: sin ella la lista enseñaría las fincas nuevas y
    // los vecinos y daría a entender que el expediente son sólo ésas.
    lista.piezasSueltas(SUELTOS)
    const etiquetas = qq(SELECTOR.SUELTO_ETIQUETA).map((e) => e.textContent)
    expect(etiquetas[0]).toMatch(/^Tu medición ·/)
    expect(etiquetas[1]).toMatch(/^Finca nueva · La Solana$/)
    expect(etiquetas[2]).toMatch(/^Colindante recortado ·/)
  })

  it('cada geometría trae su superficie y sus DOS formatos', () => {
    lista.piezasSueltas(SUELTOS)
    expect(qq(SELECTOR.SUELTO_FILA)).toHaveLength(3)
    expect(qq(SELECTOR.SUELTO_MEDIDA)[1].textContent).toMatch(/199,84 m²/)
    const botones = qq(SELECTOR.SUELTO_DESCARGA)
    expect(botones).toHaveLength(6)
    expect(botones.map((b) => b.dataset.formato)).toEqual([
      FORMATO.GML, FORMATO.TXT, FORMATO.GML, FORMATO.TXT, FORMATO.GML, FORMATO.TXT,
    ])
  })

  it('pulsar un formato emite la CLAVE de la pieza y el formato', () => {
    const pedidos = []
    lista.alDescargarSuelto((clave, formato) => pedidos.push([clave, formato]))
    lista.piezasSueltas(SUELTOS)

    const botones = qq(SELECTOR.SUELTO_DESCARGA)
    botones[2].click() // la segunda fila, GML
    botones[5].click() // la tercera fila, TXT

    expect(pedidos).toEqual([
      ['9398516VK3799G.1', FORMATO.GML],
      ['7150904UF7675S', FORMATO.TXT],
    ])
  })

  it('el `aria-label` distingue las seis descargas, y repite el descargo', () => {
    // «gml» a secas repetido seis veces en la misma lista no distingue nada para
    // quien la recorre con un lector de pantalla.
    lista.piezasSueltas(SUELTOS)
    const etiquetas = qq(SELECTOR.SUELTO_DESCARGA).map((b) => b.getAttribute('aria-label'))
    expect(new Set(etiquetas).size, 'las seis son distintas').toBe(6)
    for (const e of etiquetas) expect(e).toMatch(/no forma expediente/)
  })

  it('⛔ una foto NUEVA o vaciada se lleva los sueltos por delante', () => {
    // Dejarlos puestos sería ofrecer la descarga de unas geometrías que ya no se
    // corresponden con la parcela en pantalla. Es la decisión 3C, y aquí con peor
    // final: lo que se llevaría el usuario es un FICHERO.
    lista.piezasSueltas(SUELTOS)
    expect(q(SELECTOR.SUELTOS).hidden).toBe(false)
    lista.pintar(null)
    expect(q(SELECTOR.SUELTOS).hidden).toBe(true)

    lista.piezasSueltas(SUELTOS)
    lista.invalidar()
    expect(q(SELECTOR.SUELTOS).hidden, 'invalidar pasa por `pintar(null)`').toBe(true)
  })
})

// ── 12 · El teclado (2026-08-17) ────────────────────────────────────────────
//
// ⛔ **Un panel que tapa algo y sólo se aparta con ratón es una función que se le
// quita a quien no usa ratón.** `L.Draggable` es de `mousedown`/`touchstart` y no
// trae camino de teclado, así que lo pone este módulo.

describe('crearListaSobrante · el teclado', () => {
  let entorno = null
  let conMapa = null

  beforeEach(() => {
    entorno = montarMapa({ zoom: 16 })
    conMapa = crearListaSobrante({ mapa: entorno.mapa, documento: document })
  })
  afterEach(() => {
    conMapa.destruir()
    entorno.destruir()
  })

  const barra = () => conMapa.nodo.querySelector(SELECTOR.CABECERA)
  const pos = () => {
    const p = conMapa.nodo._leaflet_pos
    return p ? [p.x, p.y] : [0, 0]
  }
  const teclear = (key, extra = {}) =>
    barra().dispatchEvent(new window.KeyboardEvent('keydown', { key, bubbles: true, ...extra }))

  it('la barra recibe el foco y DICE para qué sirve', () => {
    // Un `tabindex` suelto es una parada del tabulador que no anuncia su función.
    expect(barra().tabIndex).toBe(0)
    expect(barra().getAttribute('aria-label')).toMatch(/flechas/i)
  })

  it('las flechas mueven 8 px, y con Mayús 32', () => {
    // Píxel a píxel serían cien pulsaciones para cruzar la pantalla: entonces el
    // teclado no es una alternativa, es un trámite.
    teclear('ArrowRight')
    expect(pos()).toEqual([SALTO_TECLADO, 0])
    teclear('ArrowDown')
    expect(pos()).toEqual([SALTO_TECLADO, SALTO_TECLADO])
    teclear('ArrowLeft', { shiftKey: true })
    expect(pos()).toEqual([SALTO_TECLADO - SALTO_TECLADO_RAPIDO, SALTO_TECLADO])
  })

  it('⛔ NO se roba la flecha si lleva Ctrl, Cmd o Alt', () => {
    // Son atajos del navegador y del lector de pantalla. Comérselos aquí rompería
    // la navegación de quien más depende de ella.
    teclear('ArrowRight', { ctrlKey: true })
    teclear('ArrowRight', { metaKey: true })
    teclear('ArrowRight', { altKey: true })
    expect(pos()).toEqual([0, 0])
  })

  it('`Escape` con el foco DENTRO cierra el panel', () => {
    conMapa.pintar(null)
    teclear('Escape')
    expect(conMapa.estaAbierto()).toBe(false)
  })

  it('⛔ `Escape` FUERA del panel no lo cierra, y esa condición es media decisión', () => {
    // Este panel no es modal: no atrapa el foco y se usa mirando el mapa y la
    // tabla a la vez. Un `Escape` global se comería la tecla que cancela el
    // diálogo del informe y la que cierra los cajones de F07/F08 — «dos cierres
    // por una tecla», que es el defecto que el cajón de diagnóstico ya documenta.
    document.body.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(conMapa.estaAbierto()).toBe(true)
  })
})

// ── 13 · El rediseño: una línea, y el porqué detrás (2026-08-18) ────────────
//
// Encargo del autor: «está mal jerarquizado y tiene demasiado texto y cosas sin
// estructurar». ⛔ **Pero ninguno de esos párrafos sobraba**: cada uno dice algo
// que si no se dice acaba en un expediente mal presentado. El problema no era el
// contenido, era que se leían TODOS a la vez y siempre.
//
// Lo que se defiende aquí es que el recorte NO perdió nada: cada línea corta
// tiene su explicación entera detrás de un «¿por qué?», y lo innegociable se
// queda SIEMPRE en la línea corta.

describe('crearListaSobrante · una línea y el porqué detrás', () => {
  const dos = () => cesion([pieza(1, { area: 30 }), pieza(2, { area: 12 })])

  it('el resumen es lo PRIMERO, y cuenta PARCELAS del fichero, no piezas', () => {
    // La jerarquía que faltaba: lo primero que hay que saber no es cuántos trozos
    // ha calculado la resta booleana, es cuántas fincas salen del fichero.
    // ⚠️ Sin punto de millar en «1763,80», y no es un descuido del formateador:
    // `Intl` en es-ES aplica la regla `min2` —los números de CUATRO dígitos no se
    // agrupan—, que es la tipografía española correcta y la que ya usa la ficha
    // del panel («Superficie 1535,64 m²»). Escribir aquí «1.763,80» habría sido
    // pedirle a esta cifra que se desviara del resto de la aplicación.
    lista.resumir({ parcelas: 2, superficieM2: 1763.8 })
    expect(q(SELECTOR.RESUMEN).textContent).toBe('2 parcelas · 1763,80 m²')
    expect(textoResumen(1, 50)).toMatch(/^1 parcela · /)
    lista.resumir()
    expect(q(SELECTOR.RESUMEN).textContent).toBe('')
  })

  it('el «¿por qué?» nace CERRADO y despliega en el sitio', () => {
    lista.pintar(cesion([]))
    const boton = q(SELECTOR.botonPorqueDe('vacio'))
    const largo = q(SELECTOR.porqueDe('vacio'))

    expect(boton.getAttribute('aria-expanded')).toBe('false')
    expect(largo.style.display, '⛔ y con `display`, no solo `hidden`').toBe('none')

    boton.click()
    expect(boton.getAttribute('aria-expanded')).toBe('true')
    expect(largo.style.display).toBe('block')
    expect(largo.textContent).toBe(SIN_PIEZAS_PORQUE)

    boton.click()
    expect(largo.style.display, 'y se vuelve a cerrar').toBe('none')
  })

  it('el botón APUNTA a su párrafo, para que un lector sepa qué abre', () => {
    lista.pintar(cesion([]))
    const boton = q(SELECTOR.botonPorqueDe('vacio'))
    expect(boton.getAttribute('aria-controls')).toBe(q(SELECTOR.porqueDe('vacio')).id)
  })

  it('⛔ una línea SIN porqué no ofrece abrirlo', () => {
    // `invalidar()` escribe un mensaje que ya está completo. Un «¿por qué?» que
    // abre un hueco vacío enseña a no volver a pulsarlo.
    lista.invalidar('La parcela ha cambiado.')
    expect(q(SELECTOR.NOTA).textContent).toBe('La parcela ha cambiado.')
    expect(q(SELECTOR.botonPorqueDe('nota')).style.display).toBe('none')
  })

  it('⛔ lo INNEGOCIABLE se queda en la línea corta, no detrás del «¿por qué?»', () => {
    // Si de este descargo sólo se lee una línea, tiene que ser la que impide el
    // error —«NO forma expediente»— y no la que explica para qué sirven los
    // sueltos. Un usuario que no pulsa nada tiene que quedarse con lo que le
    // ahorra presentar mal.
    expect(NOTA_SUELTOS).toMatch(/NO forma expediente/)
    expect(NOTA_SUELTOS.length, 'y cabe en una línea').toBeLessThan(60)
  })

  it('la nota corta cuenta, y la larga explica: ninguna de las dos se pierde', () => {
    lista.pintar(cesion([pieza(1, { estrecha: true }), pieza(2)]))
    expect(q(SELECTOR.NOTA).textContent).toBe('1 de 2 por debajo del umbral.')
    expect(q(SELECTOR.porqueDe('nota')).textContent).toMatch(/umbral de grosor \(0,0071 m\)/)
  })
})

// ── 14 · «CUÁL DE TODAS ES ÉSTA» (2026-08-20) ───────────────────────────────
//
// ⛔ **LA PROMESA QUE DEFIENDE ESTE BLOQUE: que se pueda emparejar una fila del
// expediente con una geometría del mapa.** La zona «Para comprobar» lista las
// parcelas que van dentro del fichero por su referencia catastral, y el caso
// normal es que compartan once caracteres de doce (`29053A00109007` y
// `29053A00109007.1`). Sin esta señal, el usuario tiene delante todo lo que va a
// firmar y no tiene forma de saber cuál es cuál — y lo que se firma es un
// documento que modifica la finca de otros titulares.
//
// Los tres estados que la sostienen y por qué son tres, en la cabecera de la zona
// (`viewer/lista-sobrante.js`). Aquí se defiende lo que se ve.

describe('crearListaSobrante · la señal de «cuál es cuál»', () => {
  const SUELTOS = [
    { clave: 'K1', etiqueta: '29053A01000001', papel: PAPEL.MEDICION, superficieM2: 108023.17 },
    { clave: 'K2', etiqueta: '29053A00109007', papel: PAPEL.VECINO, superficieM2: 8049.47 },
    { clave: 'K3', etiqueta: '29053A00109007.1', papel: PAPEL.VECINO, superficieM2: 3050.37 },
  ]

  const etiquetas = () => qq(SELECTOR.SUELTO_ETIQUETA)
  const sueltoFilas = () => qq(SELECTOR.SUELTO_FILA)
  const entrar = (i) => sueltoFilas()[i].dispatchEvent(new window.MouseEvent('mouseenter'))
  const salir = (i) => sueltoFilas()[i].dispatchEvent(new window.MouseEvent('mouseleave'))

  it('⭐ la zona DICE que las filas se señalan: si no, la función no existe', () => {
    // Una fila que sólo reacciona al ratón es invisible hasta que alguien pone el
    // ratón encima por casualidad, y quien no lo haga seguirá sin saber cuál es
    // cuál — que es exactamente el defecto que esto cierra.
    lista.piezasSueltas(SUELTOS)
    expect(q(SELECTOR.SUELTOS_AYUDA).textContent).toMatch(/mapa/)
  })

  it('la etiqueta es un BOTÓN, y dice el gesto y no sólo el nombre', () => {
    // Un `<span>` con un `click` encima no recibe el foco, no se activa con Intro
    // ni con Espacio y no tiene `aria-pressed`. Y «29053A00109007» a secas es lo
    // que ya se lee en la fila: lo que hay que anunciar es que es accionable.
    lista.piezasSueltas(SUELTOS)
    const boton = etiquetas()[1]
    expect(boton.tagName).toBe('BUTTON')
    expect(boton.getAttribute('aria-pressed')).toBe('false')
    expect(boton.getAttribute('aria-label')).toMatch(/29053A00109007/)
    expect(boton.getAttribute('aria-label')).toMatch(/mapa/)
  })

  it('pasar el ratón por una fila emite SU clave, y salir emite null', () => {
    const senaladas = []
    lista.alSenalarSuelto((clave) => senaladas.push(clave))
    lista.piezasSueltas(SUELTOS)
    senaladas.length = 0

    entrar(2)
    expect(senaladas).toEqual(['K3'])
    expect(sueltoFilas()[2].dataset.resaltada).toBe('si')
    salir(2)
    expect(senaladas).toEqual(['K3', null])
    expect(sueltoFilas()[2].dataset.resaltada).toBe('no')
  })

  it('recorrer la lista NO repite la misma clave dos veces seguidas', () => {
    // El canal corre con cada movimiento del ratón y quien escucha repinta un
    // polígono: emitir de más es repintar de más en la mano del usuario.
    const senaladas = []
    lista.piezasSueltas(SUELTOS)
    lista.alSenalarSuelto((clave) => senaladas.push(clave))
    entrar(0)
    entrar(0)
    expect(senaladas).toEqual(['K1'])
  })

  it('⭐ pulsar una fila la FIJA, y emite por el canal del encuadre', () => {
    const fijadas = []
    lista.alFijarSuelto((clave) => fijadas.push(clave))
    lista.piezasSueltas(SUELTOS)

    etiquetas()[1].click()
    expect(fijadas).toEqual(['K2'])
    expect(lista.sueltoFijado()).toBe('K2')
    expect(sueltoFilas()[1].dataset.fijada).toBe('si')
    expect(etiquetas()[1].getAttribute('aria-pressed')).toBe('true')
  })

  it('volver a pulsar la fijada la SUELTA, y lo dice con un null', () => {
    const fijadas = []
    lista.alFijarSuelto((clave) => fijadas.push(clave))
    lista.piezasSueltas(SUELTOS)

    etiquetas()[1].click()
    etiquetas()[1].click()
    expect(fijadas).toEqual(['K2', null])
    expect(lista.sueltoFijado()).toBeNull()
    expect(sueltoFilas()[1].dataset.fijada).toBe('no')
  })

  it('⛔ señalar otra fila NO pierde la fijada: al salir se vuelve a ver', () => {
    // Sin el tercer estado —efectiva = señalada ?? fijada—, pasear el ratón por la
    // lista borraría la elección que el usuario acaba de hacer con un clic.
    lista.piezasSueltas(SUELTOS)
    etiquetas()[0].click()
    expect(lista.sueltoSenalado()).toBe('K1')

    entrar(2)
    expect(lista.sueltoSenalado()).toBe('K3')
    expect(lista.sueltoFijado(), 'la fijada sigue siendo la suya').toBe('K1')
    salir(2)
    expect(lista.sueltoSenalado(), 'y vuelve a verse').toBe('K1')
  })

  it('⛔ pulsar una fila NO emite por el canal de señalar más de lo necesario', () => {
    // Fijar cambia lo efectivo sólo si no estaba ya señalada por el ratón: el
    // usuario que pulsa tiene el ratón encima, así que no hay nada que repintar.
    const senaladas = []
    lista.piezasSueltas(SUELTOS)
    lista.alSenalarSuelto((clave) => senaladas.push(clave))
    entrar(1)
    etiquetas()[1].click()
    expect(senaladas).toEqual(['K2'])
  })

  it('el foco en CUALQUIERA de los tres botones de la fila señala su geometría', () => {
    // Quien tabula hasta «GML» tiene el mismo derecho a saber de qué geometría es
    // ese fichero que quien pasa el ratón — y ahí es cuando más falta le hace.
    lista.piezasSueltas(SUELTOS)
    const descargas = qq(SELECTOR.SUELTO_DESCARGA)
    descargas[2].dispatchEvent(new window.FocusEvent('focus'))
    expect(lista.sueltoSenalado()).toBe('K2')
  })

  it('⛔ tabular DENTRO de la lista no apaga la señal; salir de ella sí', () => {
    // Apagar en cada `focusout` haría parpadear el marco entre cada dos
    // tabulaciones: de la etiqueta a su botón GML se sale de un control para
    // entrar en otro de la MISMA lista.
    lista.piezasSueltas(SUELTOS)
    const fila = sueltoFilas()[0]
    etiquetas()[0].dispatchEvent(new window.FocusEvent('focus'))
    expect(lista.sueltoSenalado()).toBe('K1')

    const hermano = qq(SELECTOR.SUELTO_DESCARGA)[0]
    fila.dispatchEvent(new window.FocusEvent('focusout', { relatedTarget: hermano }))
    expect(lista.sueltoSenalado(), 'sigue dentro de la lista').toBe('K1')

    fila.dispatchEvent(new window.FocusEvent('focusout', { relatedTarget: null }))
    expect(lista.sueltoSenalado(), 'y ahora se ha ido').toBeNull()
  })

  it('⭐ la FIJADA sobrevive a un repintado, la señalada no', () => {
    // Esta lista se repinta entera cada vez que se marca o desmarca una casilla
    // del sobrante. Una fijada que no sobreviviera se perdería al primer clic en
    // cualquier otro sitio, que es tirar la elección del usuario sin nombrarla.
    lista.piezasSueltas(SUELTOS)
    etiquetas()[1].click()
    entrar(0)
    expect(lista.sueltoSenalado()).toBe('K1')

    lista.piezasSueltas(SUELTOS)
    expect(lista.sueltoFijado(), 'la fijada sigue').toBe('K2')
    expect(lista.sueltoSenalado(), 'y lo señalado con el ratón, no').toBe('K2')
    expect(sueltoFilas()[1].dataset.fijada).toBe('si')
  })

  it('⛔ una fijada que YA NO ESTÁ en el expediente se suelta, y se dice', () => {
    // Con el reparto, una parcela entra y sale del fichero según lo que el usuario
    // marque. Conservar la clave dejaría el marco señalando algo que el documento
    // no lleva.
    const senaladas = []
    lista.piezasSueltas(SUELTOS)
    etiquetas()[2].click()
    lista.alSenalarSuelto((clave) => senaladas.push(clave))

    lista.piezasSueltas(SUELTOS.slice(0, 2))
    expect(lista.sueltoFijado()).toBeNull()
    expect(senaladas).toEqual([null])
  })

  it('⛔ vaciar la zona apaga la señal: el marco no puede sobrevivir a la foto', () => {
    const senaladas = []
    lista.piezasSueltas(SUELTOS)
    etiquetas()[0].click()
    lista.alSenalarSuelto((clave) => senaladas.push(clave))

    lista.piezasSueltas([])
    expect(senaladas).toEqual([null])
    expect(lista.sueltoFijado()).toBeNull()

    lista.piezasSueltas(SUELTOS)
    etiquetas()[0].click()
    senaladas.length = 0
    lista.pintar(null)
    expect(senaladas, 'y una foto nueva pasa por el mismo sitio').toEqual([null])
  })

  it('un oyente que revienta no tumba a los demás ni deja la lista a medias', () => {
    lista.alSenalarSuelto(() => {
      throw new Error('boom')
    })
    const vistas = []
    lista.alSenalarSuelto((clave) => vistas.push(clave))
    lista.piezasSueltas(SUELTOS)
    expect(() => entrar(0)).not.toThrow()
    expect(vistas).toContain('K1')
    expect(avisos.some((a) => /alSenalarSuelto|señalar geometría/.test(a.mensaje))).toBe(true)
  })

  it('suscribirse con algo que no es función LANZA, y la baja es idempotente', () => {
    expect(() => lista.alSenalarSuelto(null)).toThrow(TypeError)
    expect(() => lista.alFijarSuelto('no')).toThrow(TypeError)
    const baja = lista.alSenalarSuelto(() => {})
    expect(() => {
      baja()
      baja()
    }).not.toThrow()
  })
})

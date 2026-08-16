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
 * Proyecto Vitest `dom` (jsdom). El módulo no importa Leaflet: es un nodo.      *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  ALTO_FILA_PX,
  crearListaSobrante,
  DESTINO_ALTA,
  FILAS_VISIBLES,
  MOTIVO_FOTO_CADUCA,
  MOTIVO_NINGUNA_INCLUIDA,
  MOTIVO_SIN_DERIVAR,
  ROTULO_ESTRECHA,
  ROTULO_NO_EMITIBLE,
  SELECTOR,
  SIN_PIEZAS,
  textoContador,
  textoMedidas,
} from '../../viewer/lista-sobrante.js'

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
    expect(renglon().textContent).toMatch(/Derivar sobrante/)
  })

  it('el bloque trae su rótulo, su lista y su contador, y no cuelga de nada', () => {
    expect(q('.gml-rotulo').textContent).toBe('Sobrante')
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
    expect(q(SELECTOR.NOTA).textContent).toMatch(/2 de 3 por debajo del umbral/)
    expect(q(SELECTOR.NOTA).textContent).toMatch(/0,0071 m/)
  })

  it('⭐ los `saltados` se pintan AQUÍ y dicen que la lista puede estar corta', () => {
    // La decisión que el plan dejó abierta. En el canal global de avisos se leerían
    // entre hallazgos de otra cosa, y son justamente el motivo por el que puede
    // faltar sobrante en esta lista.
    lista.pintar(
      cesion([pieza(1)], { saltados: [{ sitio: 'recintos[0]', motivo: 'anillo degenerado' }] }),
    )
    expect(q(SELECTOR.NOTA).textContent).toMatch(/1 recinto\(s\) NO se han podido medir/)
    expect(q(SELECTOR.NOTA).textContent).toMatch(/anillo degenerado/)
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
    expect(q(SELECTOR.NOTA).textContent).toMatch(
      /1 no se puede emitir como finca: al escribirla con los 2 decimales del fichero deja de encerrar superficie\. Se queda fuera del expediente\./,
    )
    expect(q(SELECTOR.NOTA).textContent).not.toMatch(/escribirlas|dejan|quedan/)
  })

  it('…y en plural también concuerda', () => {
    lista.pintar(
      cesion([astilla, pieza(2, { area: 0.02, grosor: 0.001, estrecha: true, emitible: false })]),
    )
    expect(q(SELECTOR.NOTA).textContent).toMatch(
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

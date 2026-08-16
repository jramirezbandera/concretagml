// test/viewer/sincronizacion.dom.test.js — F03 · Tarea 2B.4.
//
// Proyecto Vitest `dom` (jsdom): el nombre `*.dom.test.js` lo enruta ahí.
//
// Lo que se blinda aquí (los 3 hallazgos de la review que concentra la tarea):
//   · C6/T6 — multi-recinto con HUECOS: un polígono con anillos anidados y la
//     tabla agrupada por recinto, con `data-recinto`/`data-indice` = RefVertice.
//   · C7/T8 — edición de celda: `change` (no `input`), y una celda ilegible
//     avisa, revierte y JAMÁS mete NaN en el modelo.
//   · C8/T7 — arrastre INCREMENTAL: `drag` no pasa por el store ni hace commit;
//     `dragend` hace UN `set` y UN `commit`; el marcador no se recrea.
//
// El arrastre con ratón REAL (mousedown/mousemove) no se prueba aquí: jsdom no
// tiene hit-testing y simularlo es frágil. Se verifica en navegador (Fase 4).
// El patrón por API (`setLatLng` + `fire('drag')`) lo documenta el arnés en
// `ayuda-jsdom.dom.test.js`.

import { describe, it, expect, vi } from 'vitest'
import L from 'leaflet'

import { NIVEL, PANE, COLOR_USUARIO, crearEstadoVista, vertUTMaLatLng } from '../../viewer/_comun.js'
import { crearHistorial } from '../../edit/historial.js'
import { sincronizar } from '../../viewer/sincronizacion.js'
// `crearPanes` viene del ARNÉS (no reimplementado aquí): así el bucle "crear los
// panes de PANES con su zIndex" existe en un solo sitio del lado de test y un
// cambio en `viewer/_comun.js#PANES` no puede dejar este test verde con panes
// viejos (hallazgo 2.12 de la auditoría de coherencia).
import { crearPanes, montarMapa, parcelaConHueco } from './_ayuda-jsdom.js'

// ── Utilidades del test ──────────────────────────────────────────────────────

function poligonosDe(mapa) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Polygon) out.push(capa)
  })
  return out
}

function marcadoresDe(mapa) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Marker) out.push(capa)
  })
  return out
}

function marcadorDe(mapa, recinto, indice) {
  return (
    marcadoresDe(mapa).find(
      (m) => m.refVertice && m.refVertice.recinto === recinto && m.refVertice.indice === indice,
    ) || null
  )
}

function poligonoEnPane(mapa, nombrePane) {
  return poligonosDe(mapa).find((p) => p.options.pane === nombrePane) || null
}

const filasDe = (tablaEl) => [...tablaEl.querySelectorAll('tr[data-indice]')]
const gruposDe = (tablaEl) => [...tablaEl.querySelectorAll('tbody[data-recinto]')]

function filaDe(tablaEl, recinto, indice) {
  return tablaEl.querySelector(`tr[data-recinto="${recinto}"][data-indice="${indice}"]`)
}

function inputsDe(fila) {
  return {
    x: fila.querySelector('input[data-eje="x"]'),
    y: fila.querySelector('input[data-eje="y"]'),
  }
}

/** Teclea un valor y termina la edición: `change`, NO `input` (hallazgo C7). */
function cambiarCelda(input, texto) {
  input.value = texto
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Recorre TODO el estado y exige coordenadas finitas (cero NaN). */
function exigirSinNaN(parcela) {
  for (const recinto of parcela.recintos) {
    for (const [x, y] of recinto.vertices) {
      expect(Number.isFinite(x)).toBe(true)
      expect(Number.isFinite(y)).toBe(true)
    }
  }
}

/**
 * Monta mapa + panes + tabla + store + `sincronizar`. Devuelve todo lo que los
 * tests necesitan, más `limpiar()`.
 *
 * El resto de opciones (`...ganchos`) se reenvía tal cual a `sincronizar`: es
 * como los tests de F06 · T3.1 enchufan `ajustar`/`alPrevisualizar`/
 * `alCrearMarcador` sin que ninguna de las pruebas anteriores cambie —omitirlos
 * es exactamente el caso "sin ganchos", que debe comportarse igual que F03.
 */
function montar({
  parcela = parcelaConHueco(),
  historial = null,
  alAvisar = vi.fn(),
  ...ganchos
} = {}) {
  const { mapa, destruir: destruirMapa } = montarMapa()
  const panes = crearPanes(mapa)
  const tablaEl = document.createElement('table')
  document.body.appendChild(tablaEl)
  const store = crearEstadoVista(parcela)
  const sinc = sincronizar({
    mapa,
    panes,
    estado: store,
    tablaEl,
    zona: parcela && parcela.huso ? parcela.huso : 30,
    historial,
    alAvisar,
    ...ganchos,
  })
  return {
    mapa,
    panes,
    tablaEl,
    store,
    sinc,
    alAvisar,
    parcela,
    limpiar() {
      sinc.destruir()
      tablaEl.remove()
      destruirMapa()
    },
  }
}

/**
 * Historial REAL de `edit/historial.js` (`{pila, indice, limite}`), no un doble
 * con método `commit`: esa segunda forma se admitía en `sincronizar` pero NO tenía
 * ningún productor en el repo (hallazgo 2.13 de la auditoría de coherencia) y la
 * rama se ha eliminado. Los commits se cuentan por el largo de la pila, que es más
 * fuerte que contar llamadas a un espía: prueba la integración de verdad.
 */
const historialReal = () => crearHistorial()

/** Nº de commits registrados en un historial real. */
const commitsDe = (historial) => historial.pila.length

// ── Contratos del programador ────────────────────────────────────────────────

describe('viewer/sincronizacion · contratos del programador (throw, regla 1)', () => {
  it('lanza sin mapa, sin store, sin elemento de tabla, con zona inválida o sin panes', () => {
    const { mapa, destruir } = montarMapa()
    const panes = crearPanes(mapa)
    const tablaEl = document.createElement('table')
    const estado = crearEstadoVista(parcelaConHueco())

    expect(() => sincronizar({ mapa: null, panes, estado, tablaEl, zona: 30 })).toThrow(TypeError)
    expect(() => sincronizar({ mapa, panes, estado: {}, tablaEl, zona: 30 })).toThrow(TypeError)
    expect(() => sincronizar({ mapa, panes, estado, tablaEl: 'tabla', zona: 30 })).toThrow(TypeError)
    expect(() => sincronizar({ mapa, panes, estado, tablaEl, zona: 4 })).toThrow(RangeError)
    expect(() => sincronizar({ mapa, panes, estado, tablaEl, zona: '30' })).toThrow(RangeError)
    expect(() =>
      sincronizar({ mapa, panes, estado, tablaEl, zona: 30, historial: 'sí' }),
    ).toThrow(TypeError)
    // Un objeto con método `commit` YA NO es un historial válido: la única forma
    // admitida es el POJO de crearHistorial (hallazgo 2.13).
    expect(() =>
      sincronizar({ mapa, panes, estado, tablaEl, zona: 30, historial: { commit: () => {} } }),
    ).toThrow(TypeError)

    // Mapa SIN los panes del visor y sin pasarlos: contrato roto → throw.
    // TypeError (no un `Error` desnudo): hallazgo 2.10.
    const solo = montarMapa()
    expect(() =>
      sincronizar({ mapa: solo.mapa, panes: {}, estado, tablaEl, zona: 30 }),
    ).toThrow(/pane/)
    expect(() =>
      sincronizar({ mapa: solo.mapa, panes: {}, estado, tablaEl, zona: 30 }),
    ).toThrow(TypeError)
    solo.destruir()

    destruir()
  })
})

// ── C6/T6 · Multi-recinto con huecos ─────────────────────────────────────────

describe('viewer/sincronizacion · multi-recinto con huecos (C6/T6)', () => {
  it('el polígono editado tiene DOS anillos (exterior + hueco) en el pane parcelaEditada', () => {
    const ctx = montar()
    const editado = poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA)

    expect(editado).not.toBeNull()
    const anillos = editado.getLatLngs()
    expect(anillos).toHaveLength(2) // [exterior, hueco] → Leaflet recorta el 2.º
    expect(anillos[0]).toHaveLength(4)
    expect(anillos[1]).toHaveLength(4)
    expect(editado.options.color).toBe(COLOR_USUARIO)

    ctx.limpiar()
  })

  it('un marcador divIcon amarillo por vértice de CADA recinto, en el pane vertices', () => {
    const ctx = montar()
    const marcadores = marcadoresDe(ctx.mapa)
    expect(marcadores).toHaveLength(8) // 4 del exterior + 4 del hueco

    for (const m of marcadores) {
      expect(m.options.pane).toBe(PANE.VERTICES)
      expect(m.options.draggable).toBe(true)
      // divIcon, NO L.Icon: sin PNG de Leaflet (que Vite rompería).
      expect(m.options.icon instanceof L.DivIcon).toBe(true)
      expect(m.options.icon instanceof L.Icon.Default).toBe(false)
      expect(m.options.icon.options.html).toContain(COLOR_USUARIO)
    }

    // Uno por RefVertice, sin huecos ni duplicados.
    for (const recinto of [0, 1]) {
      for (const indice of [0, 1, 2, 3]) {
        expect(marcadorDe(ctx.mapa, recinto, indice)).not.toBeNull()
      }
    }

    ctx.limpiar()
  })

  it('la tabla agrupa por recinto (un tbody por recinto, con su rótulo legible)', () => {
    const ctx = montar()
    const grupos = gruposDe(ctx.tablaEl)

    expect(grupos).toHaveLength(2)
    expect(grupos[0].dataset.recinto).toBe('0')
    expect(grupos[1].dataset.recinto).toBe('1')
    expect(grupos[0].querySelector('tr.gml-fila-recinto').textContent).toBe('EXTERIOR')
    expect(grupos[1].querySelector('tr.gml-fila-recinto').textContent).toBe('HUECO 1')
    // Cada grupo lleva SOLO sus vértices.
    expect(grupos[0].querySelectorAll('tr[data-indice]')).toHaveLength(4)
    expect(grupos[1].querySelectorAll('tr[data-indice]')).toHaveLength(4)

    ctx.limpiar()
  })

  it('cada fila lleva su RefVertice {recinto, indice} y sus dos celdas de texto', () => {
    const ctx = montar()
    const filas = filasDe(ctx.tablaEl)
    expect(filas).toHaveLength(8)

    const esperadas = [
      ['0', '0'], ['0', '1'], ['0', '2'], ['0', '3'],
      ['1', '0'], ['1', '1'], ['1', '2'], ['1', '3'],
    ]
    filas.forEach((fila, n) => {
      expect([fila.dataset.recinto, fila.dataset.indice]).toEqual(esperadas[n])
      const { x, y } = inputsDe(fila)
      expect(x.type).toBe('text') // NO type="number" (ver celda.js)
      expect(y.type).toBe('text')
      // La columna Nº es 1-based (humana); data-indice es 0-based (RefVertice).
      expect(fila.querySelector('th.gml-celda-indice').textContent).toBe(
        String(Number(fila.dataset.indice) + 1),
      )
    })

    // Los valores mostrados son los del modelo, recinto a recinto.
    ctx.parcela.recintos.forEach((recinto, r) => {
      recinto.vertices.forEach(([x, y], i) => {
        const { x: ix, y: iy } = inputsDe(filaDe(ctx.tablaEl, r, i))
        expect(Number(ix.value)).toBeCloseTo(x, 3)
        expect(Number(iy.value)).toBeCloseTo(y, 3)
      })
    })

    ctx.limpiar()
  })

  it('sincronizar es dueña de TODO el interior de tablaEl (cabecera incluida)', () => {
    const { mapa, destruir: destruirMapa } = montarMapa()
    const panes = crearPanes(mapa)
    const tablaEl = document.createElement('table')
    tablaEl.innerHTML = '<tbody><tr><td>basura previa</td></tr></tbody>'
    document.body.appendChild(tablaEl)

    const sinc = sincronizar({
      mapa,
      panes,
      estado: crearEstadoVista(parcelaConHueco()),
      tablaEl,
      zona: 30,
    })

    expect(tablaEl.textContent).not.toContain('basura previa')
    const cabeceras = [...tablaEl.querySelectorAll('thead th')].map((th) => th.textContent)
    expect(cabeceras).toEqual(['Nº', 'X (m)', 'Y (m)'])

    sinc.destruir()
    tablaEl.remove()
    destruirMapa()
  })
})

// ── geometriaOficial ─────────────────────────────────────────────────────────

describe('viewer/sincronizacion · geometriaOficial', () => {
  it('sin geometriaOficial: solo el polígono editado', () => {
    const ctx = montar()
    expect(poligonosDe(ctx.mapa)).toHaveLength(1)
    expect(poligonoEnPane(ctx.mapa, PANE.PARCELA_OFICIAL)).toBeNull()
    ctx.limpiar()
  })

  it('con geometriaOficial: un segundo polígono en el pane parcelaOficial, con estilo distinto', () => {
    const base = parcelaConHueco()
    const parcela = {
      ...base,
      geometriaOficial: [
        {
          tipo: 'EXTERIOR',
          vertices: base.recintos[0].vertices.map(([x, y]) => [x + 1, y + 1]),
        },
      ],
    }
    const ctx = montar({ parcela })

    expect(poligonosDe(ctx.mapa)).toHaveLength(2)
    const oficial = poligonoEnPane(ctx.mapa, PANE.PARCELA_OFICIAL)
    const editado = poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA)
    expect(oficial).not.toBeNull()
    expect(editado).not.toBeNull()
    expect(oficial.options.color).not.toBe(editado.options.color) // más sobrio
    expect(oficial.options.fill).toBe(false)
    // La oficial es referencia, NO editable: no genera marcadores.
    expect(marcadoresDe(ctx.mapa)).toHaveLength(8)

    ctx.limpiar()
  })
})

// ── C7/T8 · Edición de celda ─────────────────────────────────────────────────

describe('viewer/sincronizacion · edición de celda válida (C7/T8)', () => {
  it('change con un valor legal cambia ese vértice y SOLO ese, y actualiza el polígono', () => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())

    const { x } = inputsDe(filaDe(ctx.tablaEl, 0, 1))
    cambiarCelda(x, '439261,25') // coma decimal: la interpreta celda.js

    const ahora = ctx.store.get()
    expect(ahora.recintos[0].vertices[1][0]).toBeCloseTo(439261.25, 6)
    expect(ahora.recintos[0].vertices[1][1]).toBeCloseTo(antes.recintos[0].vertices[1][1], 6)

    // Ningún otro vértice se ha movido.
    ahora.recintos.forEach((recinto, r) => {
      recinto.vertices.forEach((v, i) => {
        if (r === 0 && i === 1) return
        expect(v).toEqual(antes.recintos[r].vertices[i])
      })
    })
    exigirSinNaN(ahora)

    // El dibujo refleja el nuevo valor (misma frontera de vista que el módulo).
    const editado = poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA)
    const [lat, lon] = vertUTMaLatLng([439261.25, ahora.recintos[0].vertices[1][1]], 30)
    expect(editado.getLatLngs()[0][1].lat).toBeCloseTo(lat, 9)
    expect(editado.getLatLngs()[0][1].lng).toBeCloseTo(lon, 9)
    // Y el marcador correspondiente, sin haberse recreado.
    expect(marcadorDe(ctx.mapa, 0, 1).getLatLng().lat).toBeCloseTo(lat, 9)

    // Una operación acabada = un commit.
    expect(commitsDe(historial)).toBe(1)
    expect(ctx.alAvisar).not.toHaveBeenCalled()

    ctx.limpiar()
  })

  it('un valor idéntico al del modelo no genera set ni commit (historial limpio)', () => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const espiaSet = vi.spyOn(ctx.store, 'set')

    const { y } = inputsDe(filaDe(ctx.tablaEl, 1, 2))
    cambiarCelda(y, y.value)

    expect(espiaSet).not.toHaveBeenCalled()
    expect(commitsDe(historial)).toBe(0)
    ctx.limpiar()
  })

  it('el historial admitido es EL de crearHistorial, y se registra con commit(historial, estado)', () => {
    // Única forma admitida (hallazgo 2.13): el POJO `{pila, indice, limite}`. La
    // otra rama que se aceptaba —"un objeto con método commit(estado)"— no tenía
    // ningún productor en el repo y se ha eliminado; un objeto así ya no cuela.
    const historial = crearHistorial({ limite: 50 })
    const ctx = montar({ historial })

    const { x } = inputsDe(filaDe(ctx.tablaEl, 0, 0))
    cambiarCelda(x, '439241.5')

    expect(historial.pila).toHaveLength(1)
    expect(historial.pila[0].recintos[0].vertices[0][0]).toBeCloseTo(439241.5, 6)
    // El snapshot es independiente del estado vivo (structuredClone).
    expect(historial.pila[0]).not.toBe(ctx.store.get())

    ctx.limpiar()
  })
})

describe('viewer/sincronizacion · edición de celda inválida: aviso, revertir y CERO NaN (C7/T8)', () => {
  const basura = [
    ['vacío', ''],
    ['solo espacios', '   '],
    ['texto', 'abc'],
    ['ambiguo con punto y coma', '1.234,56'],
    ['exponencial', '1e5'],
    ['separadores duplicados', '12,34,56'],
    ['coma al final', '439240,'],
  ]

  it.each(basura)('%s → avisa, revierte el input y NO toca el modelo', (_titulo, texto) => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())
    const espiaSet = vi.spyOn(ctx.store, 'set')

    const { x } = inputsDe(filaDe(ctx.tablaEl, 0, 2))
    const valorModelo = antes.recintos[0].vertices[2][0]
    cambiarCelda(x, texto)

    // Aviso legible al usuario, no excepción.
    expect(ctx.alAvisar).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = ctx.alAvisar.mock.calls[0]
    expect(typeof mensaje).toBe('string')
    expect(mensaje.length).toBeGreaterThan(0)
    expect(detalle.nivel).toBe(NIVEL.AVISO)

    // Input REVERTIDO al valor del modelo.
    expect(Number(x.value)).toBeCloseTo(valorModelo, 3)

    // El modelo no se ha tocado: ni set, ni commit, ni NaN.
    expect(espiaSet).not.toHaveBeenCalled()
    expect(commitsDe(historial)).toBe(0)
    expect(ctx.store.get().recintos).toEqual(antes.recintos)
    exigirSinNaN(ctx.store.get())

    ctx.limpiar()
  })

  it('tras revertir, el dibujo sigue coherente con el modelo', () => {
    const ctx = montar()
    const antesLatLng = poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA)
      .getLatLngs()[0]
      .map((p) => [p.lat, p.lng])

    const { x } = inputsDe(filaDe(ctx.tablaEl, 0, 0))
    cambiarCelda(x, 'no soy un número')

    const despues = poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA)
      .getLatLngs()[0]
      .map((p) => [p.lat, p.lng])
    expect(despues).toEqual(antesLatLng)

    ctx.limpiar()
  })

  it('escucha change y NO input: teclear (sin terminar) no muta el modelo', () => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())
    const { x } = inputsDe(filaDe(ctx.tablaEl, 0, 0))

    // "43924" es el estado INTERMEDIO de borrar un dígito para escribir otro.
    x.value = '43924'
    x.dispatchEvent(new Event('input', { bubbles: true }))

    expect(ctx.store.get().recintos).toEqual(antes.recintos)
    expect(commitsDe(historial)).toBe(0)
    expect(ctx.alAvisar).not.toHaveBeenCalled()

    ctx.limpiar()
  })
})

// ── C8/T7 · Arrastre incremental ─────────────────────────────────────────────

describe('viewer/sincronizacion · arrastre incremental (C8/T7)', () => {
  /** Posición destino: el vértice desplazado `d` metros en X e Y. */
  function destinoDe(parcela, recinto, indice, d = 1) {
    const [x, y] = parcela.recintos[recinto].vertices[indice]
    const [lat, lng] = vertUTMaLatLng([x + d, y + d], 30)
    return { latlng: { lat, lng }, utm: [x + d, y + d] }
  }

  it('drag actualiza vértice y fila SIN pasar por el store y SIN commit', () => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())
    const espiaSet = vi.spyOn(ctx.store, 'set')

    const marcador = marcadorDe(ctx.mapa, 0, 0)
    const { latlng, utm } = destinoDe(antes, 0, 0)
    marcador.setLatLng(latlng)
    marcador.fire('drag')

    // Fila actualizada…
    const { x, y } = inputsDe(filaDe(ctx.tablaEl, 0, 0))
    expect(Number(x.value)).toBeCloseTo(utm[0], 2)
    expect(Number(y.value)).toBeCloseTo(utm[1], 2)
    // …y el polígono también, en ese punto.
    const anillo = poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA).getLatLngs()[0]
    expect(anillo[0].lat).toBeCloseTo(latlng.lat, 9)
    expect(anillo[0].lng).toBeCloseTo(latlng.lng, 9)
    // Los demás puntos, quietos.
    expect(anillo[1].lat).toBeCloseTo(vertUTMaLatLng(antes.recintos[0].vertices[1], 30)[0], 9)

    // Pero el store y el historial, intactos: nada por frame.
    expect(espiaSet).not.toHaveBeenCalled()
    expect(commitsDe(historial)).toBe(0)
    expect(ctx.store.get().recintos).toEqual(antes.recintos)

    ctx.limpiar()
  })

  it('dragend hace EXACTAMENTE un set y EXACTAMENTE un commit', () => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())
    const espiaSet = vi.spyOn(ctx.store, 'set')

    const marcador = marcadorDe(ctx.mapa, 1, 3)
    const { latlng, utm } = destinoDe(antes, 1, 3, -0.5)
    marcador.setLatLng(latlng)
    marcador.fire('drag')
    marcador.fire('dragend')

    expect(espiaSet).toHaveBeenCalledTimes(1)
    expect(commitsDe(historial)).toBe(1)

    const ahora = ctx.store.get()
    expect(ahora.recintos[1].vertices[3][0]).toBeCloseTo(utm[0], 2)
    expect(ahora.recintos[1].vertices[3][1]).toBeCloseTo(utm[1], 2)
    exigirSinNaN(ahora)

    ctx.limpiar()
  })

  it('VARIOS drag seguidos antes del dragend siguen dando UN solo commit', () => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())
    const espiaSet = vi.spyOn(ctx.store, 'set')

    const marcador = marcadorDe(ctx.mapa, 0, 2)
    for (const d of [0.2, 0.4, 0.6, 0.8, 1]) {
      marcador.setLatLng(destinoDe(antes, 0, 2, d).latlng)
      marcador.fire('drag')
    }
    expect(commitsDe(historial)).toBe(0)
    expect(espiaSet).not.toHaveBeenCalled()

    marcador.fire('dragend')
    expect(espiaSet).toHaveBeenCalledTimes(1)
    expect(commitsDe(historial)).toBe(1)
    expect(ctx.store.get().recintos[0].vertices[2][0]).toBeCloseTo(
      destinoDe(antes, 0, 2, 1).utm[0],
      2,
    )

    ctx.limpiar()
  })

  it('el marcador arrastrado NO se recrea: misma instancia antes y después', () => {
    const ctx = montar({ historial: historialReal() })
    const antes = structuredClone(ctx.store.get())

    const marcador = marcadorDe(ctx.mapa, 0, 0)
    const todosAntes = marcadoresDe(ctx.mapa)

    marcador.setLatLng(destinoDe(antes, 0, 0, 1.5).latlng)
    marcador.fire('drag')
    marcador.fire('dragend')

    expect(marcadorDe(ctx.mapa, 0, 0)).toBe(marcador)
    expect(marcadoresDe(ctx.mapa)).toHaveLength(todosAntes.length)
    // Y ninguna otra instancia ha cambiado tampoco.
    for (const m of todosAntes) {
      expect(marcadorDe(ctx.mapa, m.refVertice.recinto, m.refVertice.indice)).toBe(m)
    }

    ctx.limpiar()
  })

  it('sin historial no falla: dragend hace su set y no intenta commitear', () => {
    const ctx = montar({ historial: null })
    const antes = structuredClone(ctx.store.get())
    const marcador = marcadorDe(ctx.mapa, 0, 1)
    marcador.setLatLng(destinoDe(antes, 0, 1, 1).latlng)
    expect(() => {
      marcador.fire('drag')
      marcador.fire('dragend')
    }).not.toThrow()
    expect(ctx.store.get().recintos[0].vertices[1][0]).toBeCloseTo(
      destinoDe(antes, 0, 1, 1).utm[0],
      2,
    )
    ctx.limpiar()
  })

  it('un set de OTRA vista durante el gesto se DIFIERE, no se descarta (hallazgo 2.11)', () => {
    // Este test FIJA EL CONTRATO: una notificación que llega en medio de un gesto
    // no se repinta durante el gesto (para no recrear la fila que se está
    // actualizando ni pisar el marcador agarrado) pero NO SE PIERDE: al terminar,
    // la vista refleja el estado completo.
    //
    // Honestidad sobre el alcance: con el código de HOY el contrato se cumple
    // incluso sin la bandera, porque `dragend` siempre acaba en un render (su
    // `aplicarVertice` hace `set`, y el suscriptor ya renderiza). La bandera
    // `renderPendiente` convierte un descarte SILENCIOSO en un diferido
    // EXPLÍCITO, y este test es lo que impedirá que la pérdida vuelva cuando F06
    // añada caminos de `dragend` que no acaben en `set` ("no ha cambiado nada, no
    // commiteo") — que es cuando el drenaje pasa a ser imprescindible.
    const ctx = montar()
    const antes = structuredClone(ctx.store.get())

    // Gesto en curso sobre el vértice (0,0).
    const marcador = marcadorDe(ctx.mapa, 0, 0)
    marcador.setLatLng(destinoDe(antes, 0, 0, 1).latlng)
    marcador.fire('drag')

    // Otra vista mueve un vértice DISTINTO —el (1,0)— en medio del gesto.
    const otro = structuredClone(ctx.store.get())
    otro.recintos[1].vertices[0] = [439249.5, 4479661.5]
    ctx.store.set(otro)

    // Durante el gesto, la fila del vértice ajeno NO se ha repintado (es la
    // razón de ser de la guarda: no tocar el DOM en medio del arrastre).
    const filaAjena = inputsDe(filaDe(ctx.tablaEl, 1, 0))
    expect(Number(filaAjena.x.value)).toBeCloseTo(antes.recintos[1].vertices[0][0], 3)

    // Al terminar el gesto, el cambio ajeno aparece: se DIFIRIÓ, no se perdió.
    marcador.fire('dragend')
    expect(Number(inputsDe(filaDe(ctx.tablaEl, 1, 0)).x.value)).toBeCloseTo(439249.5, 3)
    expect(Number(inputsDe(filaDe(ctx.tablaEl, 1, 0)).y.value)).toBeCloseTo(4479661.5, 3)
    expect(marcadorDe(ctx.mapa, 1, 0).getLatLng().lat).toBeCloseTo(
      vertUTMaLatLng([439249.5, 4479661.5], 30)[0],
      9,
    )

    // Y la vista sigue VIVA: un set posterior se ve inmediatamente (la bandera
    // `arrastrando` no ha quedado alta).
    const despues = structuredClone(ctx.store.get())
    despues.recintos[1].vertices[1] = [439253, 4479660.25]
    ctx.store.set(despues)
    expect(Number(inputsDe(filaDe(ctx.tablaEl, 1, 1)).x.value)).toBeCloseTo(439253, 3)

    ctx.limpiar()
  })

  it('⛔ un set que CAMBIA LA FORMA a media-drag: `dragend` RENUNCIA, lo dice y repinta', () => {
    // ⭐ EL DEFECTO (auditoría 2026-08-16, MEDIA). El suscriptor DIFIERE el render
    // mientras dura el gesto (hallazgo 2.11, arriba), pero `dragend` aplicaba por el
    // par `(r,i)` CAPTURADO AL CREAR EL MARCADOR y el guard de `aplicarVertice` solo
    // comprobaba que el vértice EXISTIERA, no que fuera EL MISMO. Si entre el
    // `drag` y el `dragend` llegaba un `set` que cambiaba la forma —el disparador
    // realista es un Ctrl+Z/Ctrl+Y, cuyo atajo solo se inhibe con el foco en un
    // campo de texto, NO durante un arrastre—, el índice `(0,2)` pasaba a señalar
    // OTRO vértice físico y la coordenada arrastrada se escribía encima de él: un
    // vértice que el usuario jamás tocó saltaba a la posición del cursor, **sin un
    // solo aviso**, y ese estado corrupto se commiteaba al historial.
    //
    // Medido antes del arreglo: exterior `[v0..v3]`, arrastre de `v2`, borrado de
    // `v0` a mitad del gesto → el destino del arrastre acababa sobre el físico `v3`
    // y el agarrado se quedaba quieto, con `AVISOS: []`.
    //
    // El contrato que fija este test: si hubo un cambio de FORMA durante el gesto,
    // el arrastre NO se aplica (no hay forma de re-derivar la identidad de un
    // vértice: el modelo son pares `[x,y]` sin identidad propia), el usuario SE
    // ENTERA (regla de oro 1: renunciar en silencio sería el mismo defecto con otro
    // síntoma) y el dibujo vuelve a reflejar el modelo.
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())

    // El usuario agarra el vértice (0,2) y lo lleva 3 m al noreste.
    const marcador = marcadorDe(ctx.mapa, 0, 2)
    marcador.setLatLng(destinoDe(antes, 0, 2, 3).latlng)
    marcador.fire('drag')

    // …y a MITAD del gesto, un deshacer borra el vértice (0,0). El índice 2 ya no
    // es el vértice agarrado: ahora es el que era (0,3).
    const otro = structuredClone(ctx.store.get())
    otro.recintos[0].vertices.splice(0, 1) // 4 → 3 vértices: CAMBIA LA FORMA
    ctx.store.set(otro)
    const commitsPrevios = commitsDe(historial)
    const esperado = otro.recintos[0].vertices.map((v) => [v[0], v[1]])

    marcador.fire('dragend')

    // 1) Ni un vértice se ha movido: el arrastre se ha RENUNCIADO entero.
    const ahora = ctx.store.get()
    expect(ahora.recintos[0].vertices).toEqual(esperado)
    // Y en particular, el físico `v3` (hoy en el índice 2) sigue donde estaba: es
    // EL vértice sobre el que caía la coordenada arrastrada antes del arreglo.
    expect(ahora.recintos[0].vertices[2]).toEqual(antes.recintos[0].vertices[3])
    exigirSinNaN(ahora)

    // 2) …y NO se ha commiteado nada al historial: un estado corrupto commiteado
    // sobrevive al deshacer siguiente.
    expect(commitsDe(historial)).toBe(commitsPrevios)

    // 3) El usuario SE ENTERA, y con NIVEL.ERROR: lo que acababa de hacer NO se ha
    // aplicado (la regla de clasificación de `_comun.js#Avisar`).
    const dichos = ctx.alAvisar.mock.calls.filter(([, d]) => d && d.nivel === NIVEL.ERROR)
    expect(dichos, 'renunciar en silencio incumple la regla de oro 1').toHaveLength(1)
    expect(dichos[0][0]).toMatch(/arrastre/i)

    // 4) Y el mapa y la tabla vuelven a reflejar el MODELO (nada de un dibujo que
    // enseña el arrastre que no se ha aplicado).
    const [lat, lng] = vertUTMaLatLng(esperado[2], 30)
    expect(marcadorDe(ctx.mapa, 0, 2).getLatLng().lat).toBeCloseTo(lat, 9)
    expect(marcadorDe(ctx.mapa, 0, 2).getLatLng().lng).toBeCloseTo(lng, 9)
    expect(Number(inputsDe(filaDe(ctx.tablaEl, 0, 2)).x.value)).toBeCloseTo(esperado[2][0], 3)
    expect(Number(inputsDe(filaDe(ctx.tablaEl, 0, 2)).y.value)).toBeCloseTo(esperado[2][1], 3)
    expect(filasDe(ctx.tablaEl), 'la tabla ya no tiene la fila borrada').toHaveLength(7)
    expect(poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA).getLatLngs()[0]).toHaveLength(3)

    ctx.limpiar()
  })

  it('el gesto SIGUIENTE vuelve a aplicarse: la renuncia no deja la vista muerta', () => {
    // La otra mitad del contrato, y la que impide "arreglarlo" con una bandera que
    // no se baja: renunciar es de ESE gesto, no de la vista.
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())

    const marcador = marcadorDe(ctx.mapa, 0, 2)
    marcador.setLatLng(destinoDe(antes, 0, 2, 3).latlng)
    marcador.fire('drag')
    const otro = structuredClone(ctx.store.get())
    otro.recintos[0].vertices.splice(0, 1)
    ctx.store.set(otro)
    marcador.fire('dragend')

    // Gesto nuevo, sin cambios de forma en medio: se aplica con normalidad.
    const ahora = structuredClone(ctx.store.get())
    const nuevo = marcadorDe(ctx.mapa, 0, 1)
    const { latlng, utm } = destinoDe(ahora, 0, 1, 1)
    nuevo.setLatLng(latlng)
    nuevo.fire('dragstart')
    nuevo.fire('drag')
    nuevo.fire('dragend')

    expect(ctx.store.get().recintos[0].vertices[1][0]).toBeCloseTo(utm[0], 2)
    expect(ctx.store.get().recintos[0].vertices[1][1]).toBeCloseTo(utm[1], 2)
    expect(commitsDe(historial)).toBe(1)

    ctx.limpiar()
  })

  it('un set que NO cambia la forma a media-drag SÍ se aplica (no se renuncia de más)', () => {
    // El caso del hallazgo 2.11 sigue comportándose igual: mismo nº de vértices =
    // el índice sigue señalando al mismo vértice, así que el arrastre es válido.
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())

    const marcador = marcadorDe(ctx.mapa, 0, 2)
    const { latlng, utm } = destinoDe(antes, 0, 2, 3)
    marcador.setLatLng(latlng)
    marcador.fire('drag')

    const otro = structuredClone(ctx.store.get())
    otro.recintos[1].vertices[0] = [439249.5, 4479661.5] // otro recinto, misma forma
    ctx.store.set(otro)

    marcador.fire('dragend')

    expect(ctx.store.get().recintos[0].vertices[2][0]).toBeCloseTo(utm[0], 2)
    expect(ctx.store.get().recintos[0].vertices[2][1]).toBeCloseTo(utm[1], 2)
    expect(commitsDe(historial)).toBe(1)
    expect(ctx.alAvisar).not.toHaveBeenCalled()

    ctx.limpiar()
  })
})

// ── Render idempotente ───────────────────────────────────────────────────────

describe('viewer/sincronizacion · render idempotente', () => {
  it('misma forma: mismas instancias de marcador y mismas filas', () => {
    const ctx = montar()
    const marcador = marcadorDe(ctx.mapa, 0, 0)
    const fila = filaDe(ctx.tablaEl, 0, 0)
    const { x: inputAntes } = inputsDe(fila)

    const siguiente = structuredClone(ctx.store.get())
    siguiente.recintos[0].vertices[0] = [439241, 4479656]
    ctx.store.set(siguiente)

    expect(marcadorDe(ctx.mapa, 0, 0)).toBe(marcador)
    expect(filaDe(ctx.tablaEl, 0, 0)).toBe(fila)
    expect(inputsDe(filaDe(ctx.tablaEl, 0, 0)).x).toBe(inputAntes)
    expect(filasDe(ctx.tablaEl)).toHaveLength(8)
    // Posición actualizada en su sitio.
    expect(Number(inputAntes.value)).toBeCloseTo(439241, 3)
    const [lat] = vertUTMaLatLng([439241, 4479656], 30)
    expect(marcador.getLatLng().lat).toBeCloseTo(lat, 9)

    ctx.limpiar()
  })

  it('distinto nº de vértices: reconstruye (nuevas instancias y nuevas filas)', () => {
    const ctx = montar()
    const marcadorAntes = marcadorDe(ctx.mapa, 0, 0)
    const filaAntes = filaDe(ctx.tablaEl, 0, 0)

    const siguiente = structuredClone(ctx.store.get())
    siguiente.recintos[0].vertices.push([439250, 4479675]) // 4 → 5 vértices
    ctx.store.set(siguiente)

    expect(filasDe(ctx.tablaEl)).toHaveLength(9)
    expect(marcadoresDe(ctx.mapa)).toHaveLength(9)
    expect(marcadorDe(ctx.mapa, 0, 0)).not.toBe(marcadorAntes)
    expect(filaDe(ctx.tablaEl, 0, 0)).not.toBe(filaAntes)
    expect(poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA).getLatLngs()[0]).toHaveLength(5)

    ctx.limpiar()
  })

  it('distinto nº de recintos: reconstruye los grupos de la tabla', () => {
    const ctx = montar()
    const siguiente = structuredClone(ctx.store.get())
    siguiente.recintos.pop() // se queda solo el exterior
    ctx.store.set(siguiente)

    expect(gruposDe(ctx.tablaEl)).toHaveLength(1)
    expect(filasDe(ctx.tablaEl)).toHaveLength(4)
    expect(marcadoresDe(ctx.mapa)).toHaveLength(4)
    expect(poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA).getLatLngs()).toHaveLength(1)

    ctx.limpiar()
  })

  it('estado sin recintos: sin polígono editado, sin marcadores, tabla vacía pero legible', () => {
    const ctx = montar({ parcela: { idLocal: 'vacía', recintos: [], huso: 30 } })
    expect(poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA)).toBeNull()
    expect(marcadoresDe(ctx.mapa)).toHaveLength(0)
    expect(filasDe(ctx.tablaEl)).toHaveLength(0)
    expect(ctx.tablaEl.querySelector('tr.gml-fila-vacia')).not.toBeNull()

    // Y al llegar geometría, se construye sin haber tenido que remontar nada.
    ctx.store.set(parcelaConHueco())
    expect(marcadoresDe(ctx.mapa)).toHaveLength(8)
    expect(filasDe(ctx.tablaEl)).toHaveLength(8)

    ctx.limpiar()
  })

  it('refrescar() fuerza un re-render desde el estado actual', () => {
    const ctx = montar()
    // Mutación en sitio (sin pasar por set): nadie ha notificado.
    ctx.store.get().recintos[0].vertices[0] = [439245, 4479658]
    const { x } = inputsDe(filaDe(ctx.tablaEl, 0, 0))
    expect(Number(x.value)).toBeCloseTo(439240, 3)

    ctx.sinc.refrescar()
    expect(Number(x.value)).toBeCloseTo(439245, 3)

    ctx.limpiar()
  })
})

// ── Sin feedback loop ────────────────────────────────────────────────────────

describe('viewer/sincronizacion · dos vistas de un estado, sin bucle', () => {
  it('un set produce UN solo ciclo de render', () => {
    const ctx = montar()
    const marcador = marcadorDe(ctx.mapa, 0, 0)
    const espia = vi.spyOn(marcador, 'setLatLng')

    const siguiente = structuredClone(ctx.store.get())
    siguiente.recintos[0].vertices[0] = [439242, 4479657]
    ctx.store.set(siguiente)

    expect(espia).toHaveBeenCalledTimes(1)
    ctx.limpiar()
  })

  it('editar desde la tabla no dispara cascada: un set, un render, y termina', () => {
    const ctx = montar({ historial: historialReal() })
    const espiaSet = vi.spyOn(ctx.store, 'set')
    const marcador = marcadorDe(ctx.mapa, 0, 0)
    const espiaRender = vi.spyOn(marcador, 'setLatLng')

    const { x } = inputsDe(filaDe(ctx.tablaEl, 0, 3))
    expect(() => cambiarCelda(x, '439239')).not.toThrow() // no desborda la pila

    expect(espiaSet).toHaveBeenCalledTimes(1)
    expect(espiaRender).toHaveBeenCalledTimes(1)
    ctx.limpiar()
  })

  it('tabla y mapa leen el MISMO store: no hay copia intermedia que divergir', () => {
    const ctx = montar()
    // Un cambio por la tabla se ve en el mapa…
    const { y } = inputsDe(filaDe(ctx.tablaEl, 0, 0))
    cambiarCelda(y, '4479650')
    const [lat] = vertUTMaLatLng([ctx.store.get().recintos[0].vertices[0][0], 4479650], 30)
    expect(marcadorDe(ctx.mapa, 0, 0).getLatLng().lat).toBeCloseTo(lat, 9)

    // …y un cambio por el mapa se ve en la tabla, con el store como única fuente.
    const marcador = marcadorDe(ctx.mapa, 0, 0)
    const [nlat, nlng] = vertUTMaLatLng([439235, 4479645], 30)
    marcador.setLatLng({ lat: nlat, lng: nlng })
    marcador.fire('drag')
    marcador.fire('dragend')
    const { x, y: y2 } = inputsDe(filaDe(ctx.tablaEl, 0, 0))
    expect(Number(x.value)).toBeCloseTo(ctx.store.get().recintos[0].vertices[0][0], 3)
    expect(Number(y2.value)).toBeCloseTo(ctx.store.get().recintos[0].vertices[0][1], 3)

    ctx.limpiar()
  })
})

// ── F06 · T3.1 · Los tres ganchos ────────────────────────────────────────────
//
// Lo que se blinda aquí:
//   · Sin ganchos, comportamiento IDÉNTICO (lo prueba, sobre todo, que ni una de
//     las pruebas de arriba haya tenido que tocarse).
//   · `ajustar` se llama por frame Y en `dragend` — sin lo segundo, el vértice se
//     despegaría del enganche justo al soltarlo.
//   · UN solo `set` y UN solo `commit` por gesto AUNQUE haya ganchos: es donde
//     vive el criterio de aceptación 5 de F06 ("undo/redo revierten operaciones
//     completas, no fotogramas del arrastre").
//   · Un gancho que revienta no tumba el arrastre, avisa UNA vez por episodio (no
//     una por frame) y el gesto termina con el modelo sano.

describe('viewer/sincronizacion · ganchos de F06 (T3.1)', () => {
  /** Posición destino: el vértice desplazado `d` metros en X e Y. */
  function destinoDe(parcela, recinto, indice, d = 1) {
    const [x, y] = parcela.recintos[recinto].vertices[indice]
    const [lat, lng] = vertUTMaLatLng([x + d, y + d], 30)
    return { latlng: { lat, lng }, utm: [x + d, y + d] }
  }

  /** Punto de enganche de mentira: no coincide con NINGÚN vértice de la parcela. */
  const ENGANCHE = [439246.5, 4479658.25]

  /** Un `ajustar` que engancha SIEMPRE al mismo punto (el snap real ya es de `edit/snap.js`). */
  const engancharSiempre = () => ({ punto: [...ENGANCHE], enganchado: true, tipo: 'VERTICE' })

  // ── Contrato ──────────────────────────────────────────────────────────────

  it('un gancho que no es función ni null/undefined es contrato roto: TypeError', () => {
    const { mapa, destruir } = montarMapa()
    const panes = crearPanes(mapa)
    const tablaEl = document.createElement('table')
    const estado = crearEstadoVista(parcelaConHueco())
    const base = { mapa, panes, estado, tablaEl, zona: 30 }

    expect(() => sincronizar({ ...base, ajustar: 'snap' })).toThrow(TypeError)
    expect(() => sincronizar({ ...base, alPrevisualizar: 42 })).toThrow(TypeError)
    expect(() => sincronizar({ ...base, alCrearMarcador: {} })).toThrow(TypeError)

    // `null` y la ausencia son legítimos (y la ausencia ES el defecto).
    const conNulls = sincronizar({
      ...base,
      ajustar: null,
      alPrevisualizar: null,
      alCrearMarcador: null,
    })
    conNulls.destruir()
    const sinNada = sincronizar(base)
    sinNada.destruir()

    destruir()
  })

  it('los tres son opcionales: sin ellos, el arrastre es el de F03 y no avisa de nada', () => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())
    const marcador = marcadorDe(ctx.mapa, 0, 0)

    marcador.setLatLng(destinoDe(antes, 0, 0, 1).latlng)
    marcador.fire('drag')
    marcador.fire('dragend')

    expect(ctx.alAvisar).not.toHaveBeenCalled()
    expect(commitsDe(historial)).toBe(1)
    expect(ctx.store.get().recintos[0].vertices[0][0]).toBeCloseTo(
      destinoDe(antes, 0, 0, 1).utm[0],
      2,
    )
    ctx.limpiar()
  })

  // ── ajustar ───────────────────────────────────────────────────────────────

  it('ajustar se llama en CADA drag con el UTM crudo, la refVertice y el eventoOriginal', () => {
    const ajustar = vi.fn(() => null)
    const ctx = montar({ ajustar })
    const antes = structuredClone(ctx.store.get())

    const marcador = marcadorDe(ctx.mapa, 0, 1)
    const { latlng, utm } = destinoDe(antes, 0, 1, 2)
    marcador.setLatLng(latlng)
    marcador.fire('drag')

    expect(ajustar).toHaveBeenCalledTimes(1)
    const [crudo, ref, evento] = ajustar.mock.calls[0]
    expect(crudo[0]).toBeCloseTo(utm[0], 2)
    expect(crudo[1]).toBeCloseTo(utm[1], 2)
    expect(ref).toEqual({ recinto: 0, indice: 1 })
    // Gesto simulado por API: Leaflet no trae `originalEvent` → null, no undefined.
    expect(evento).toBeNull()

    // Con un evento de Leaflet de verdad, llega su `originalEvent` TAL CUAL: es de
    // donde el consumidor saca `altKey` (la tecla que desactiva el snap).
    const teclado = { altKey: true }
    marcador.fire('drag', { originalEvent: teclado })
    expect(ajustar.mock.calls[1][2]).toBe(teclado)

    ctx.limpiar()
  })

  it('un enganche lleva marcador, polígono y fila al punto ENGANCHADO (reproyectado)', () => {
    const ctx = montar({ ajustar: engancharSiempre })
    const antes = structuredClone(ctx.store.get())
    const espiaSet = vi.spyOn(ctx.store, 'set')

    const marcador = marcadorDe(ctx.mapa, 0, 0)
    marcador.setLatLng(destinoDe(antes, 0, 0, 3).latlng)
    marcador.fire('drag')

    const [lat, lon] = vertUTMaLatLng(ENGANCHE, 30)
    // El marcador se despega del cursor y salta al enganche…
    expect(marcador.getLatLng().lat).toBeCloseTo(lat, 9)
    expect(marcador.getLatLng().lng).toBeCloseTo(lon, 9)
    // …el polígono, igual (si no, el vértice se dibujaría donde el ratón)…
    const anillo = poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA).getLatLngs()[0]
    expect(anillo[0].lat).toBeCloseTo(lat, 9)
    expect(anillo[0].lng).toBeCloseTo(lon, 9)
    // …y la fila muestra el UTM enganchado, no el del cursor.
    const { x, y } = inputsDe(filaDe(ctx.tablaEl, 0, 0))
    expect(Number(x.value)).toBeCloseTo(ENGANCHE[0], 3)
    expect(Number(y.value)).toBeCloseTo(ENGANCHE[1], 3)

    // Y nada de esto ha pasado por el store: el snap es un consejo, no un `set`.
    expect(espiaSet).not.toHaveBeenCalled()
    expect(ctx.store.get().recintos).toEqual(antes.recintos)

    ctx.limpiar()
  })

  it('ajustar se llama TAMBIÉN en dragend: lo que entra en el modelo es el enganche, no el cursor', () => {
    // El fallo que este test impide: si solo se ajustara en `drag`, `dragend`
    // recalcularía el UTM desde `marcador.getLatLng()` y escribiría el punto CRUDO
    // del último movimiento — el enganche se vería durante todo el gesto y se
    // perdería justo al soltar. Por eso el último movimiento va DESPUÉS del último
    // `drag`, que es lo que hace Leaflet de verdad antes de emitir `dragend`.
    const ajustar = vi.fn(engancharSiempre)
    const historial = historialReal()
    const ctx = montar({ ajustar, historial })
    const antes = structuredClone(ctx.store.get())

    const marcador = marcadorDe(ctx.mapa, 0, 0)
    marcador.setLatLng(destinoDe(antes, 0, 0, 3).latlng)
    marcador.fire('drag')

    const ultimo = destinoDe(antes, 0, 0, 5) // el ratón se mueve una vez más…
    marcador.setLatLng(ultimo.latlng)
    marcador.fire('dragend') // …y se suelta ahí

    expect(ajustar).toHaveBeenCalledTimes(2) // el `drag` y el `dragend`
    expect(ajustar.mock.calls[1][0][0]).toBeCloseTo(ultimo.utm[0], 2) // con el crudo final
    expect(ajustar.mock.calls[1][1]).toEqual({ recinto: 0, indice: 0 })

    // En el modelo está el ENGANCHE exacto, no el punto donde se soltó el ratón.
    expect(ctx.store.get().recintos[0].vertices[0]).toEqual(ENGANCHE)
    expect(ctx.store.get().recintos[0].vertices[0][0]).not.toBeCloseTo(ultimo.utm[0], 2)
    exigirSinNaN(ctx.store.get())
    expect(commitsDe(historial)).toBe(1)

    ctx.limpiar()
  })

  it('null o enganchado:false dejan el punto CRUDO (el snap desactivado no estorba)', () => {
    for (const respuesta of [null, { punto: [...ENGANCHE], enganchado: false, tipo: null }]) {
      const ctx = montar({ ajustar: () => respuesta })
      const antes = structuredClone(ctx.store.get())
      const marcador = marcadorDe(ctx.mapa, 1, 1)
      const destino = destinoDe(antes, 1, 1, 1.25)

      marcador.setLatLng(destino.latlng)
      marcador.fire('drag')
      marcador.fire('dragend')

      const v = ctx.store.get().recintos[1].vertices[1]
      expect(v[0]).toBeCloseTo(destino.utm[0], 2)
      expect(v[1]).toBeCloseTo(destino.utm[1], 2)
      expect(v[0]).not.toBeCloseTo(ENGANCHE[0], 2)
      ctx.limpiar()
    }
  })

  it('CRITERIO 5 · un arrastre entero con los tres ganchos deja EXACTAMENTE un snapshot', () => {
    // Si un solo frame escribiera en el store, el undo pasaría a revertir
    // fotogramas del arrastre en vez de la operación completa.
    const historial = historialReal()
    const ctx = montar({
      historial,
      ajustar: engancharSiempre,
      alPrevisualizar: vi.fn(),
      alCrearMarcador: vi.fn(),
    })
    const antes = structuredClone(ctx.store.get())
    const espiaSet = vi.spyOn(ctx.store, 'set')
    const pilaAntes = historial.pila.length

    const marcador = marcadorDe(ctx.mapa, 0, 2)
    for (const d of [0.2, 0.4, 0.6, 0.8, 1]) {
      marcador.setLatLng(destinoDe(antes, 0, 2, d).latlng)
      marcador.fire('drag')
    }
    expect(espiaSet).not.toHaveBeenCalled()
    expect(historial.pila.length).toBe(pilaAntes)

    marcador.fire('dragend')

    expect(espiaSet).toHaveBeenCalledTimes(1)
    expect(historial.pila.length - pilaAntes).toBe(1)
    expect(ctx.store.get().recintos[0].vertices[2]).toEqual(ENGANCHE)

    ctx.limpiar()
  })

  it('un ajustar que revienta no tumba el arrastre: avisa UNA vez por gesto y sigue con el crudo', () => {
    const ajustar = vi.fn(() => {
      throw new Error('snap roto')
    })
    const historial = historialReal()
    const ctx = montar({ ajustar, historial })
    const antes = structuredClone(ctx.store.get())

    const marcador = marcadorDe(ctx.mapa, 0, 0)
    for (const d of [1, 2, 3, 4, 5]) {
      marcador.setLatLng(destinoDe(antes, 0, 0, d).latlng)
      marcador.fire('drag')
    }
    marcador.fire('dragend')

    expect(ajustar).toHaveBeenCalledTimes(6) // 5 frames + el dragend
    // …y UN SOLO aviso: cien mensajes idénticos serían otra forma de silencio.
    expect(ctx.alAvisar).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = ctx.alAvisar.mock.calls[0]
    expect(typeof mensaje).toBe('string')
    expect(mensaje.length).toBeGreaterThan(0)
    // AVISO y no ERROR: el gesto sigue, el modelo queda generable.
    expect(detalle.nivel).toBe(NIVEL.AVISO)
    expect(detalle.causa).toBeInstanceOf(Error)

    // El gesto ha llegado a su fin con el punto CRUDO y su único commit.
    const v = ctx.store.get().recintos[0].vertices[0]
    expect(v[0]).toBeCloseTo(destinoDe(antes, 0, 0, 5).utm[0], 2)
    exigirSinNaN(ctx.store.get())
    expect(commitsDe(historial)).toBe(1)

    // Un SEGUNDO gesto vuelve a avisar: el episodio es el gesto, no la vida del
    // módulo (un fallo que persiste no puede enmudecer para siempre).
    marcador.setLatLng(destinoDe(antes, 0, 0, 6).latlng)
    marcador.fire('drag')
    expect(ctx.alAvisar).toHaveBeenCalledTimes(2)

    ctx.limpiar()
  })

  it('un ajustar que devuelve un punto no finito se ignora con aviso: CERO NaN en el modelo', () => {
    const ctx = montar({
      ajustar: () => ({ punto: [Number.NaN, 4479660], enganchado: true, tipo: 'VERTICE' }),
    })
    const antes = structuredClone(ctx.store.get())

    const marcador = marcadorDe(ctx.mapa, 1, 0)
    const destino = destinoDe(antes, 1, 0, 0.75)
    marcador.setLatLng(destino.latlng)
    marcador.fire('drag')
    marcador.fire('dragend')

    expect(ctx.alAvisar).toHaveBeenCalledTimes(1)
    expect(ctx.alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    exigirSinNaN(ctx.store.get())
    expect(ctx.store.get().recintos[1].vertices[0][0]).toBeCloseTo(destino.utm[0], 2)

    ctx.limpiar()
  })

  // ── alPrevisualizar ───────────────────────────────────────────────────────

  it('alPrevisualizar cierra cada render con los anillos DEL ESTADO y refVertice null', () => {
    const alPrevisualizar = vi.fn()
    const ctx = montar({ alPrevisualizar })

    expect(alPrevisualizar).toHaveBeenCalledTimes(1) // el render de arranque
    const [anillos, ref] = alPrevisualizar.mock.calls[0]
    expect(ref).toBeNull()
    expect(anillos).toHaveLength(2)
    expect(anillos[0]).toEqual(ctx.parcela.recintos[0].vertices)
    expect(anillos[1]).toEqual(ctx.parcela.recintos[1].vertices)

    // Son UTM, no lat/lng (la frontera de vista no se mueve: regla de oro 3).
    expect(anillos[0][0][0]).toBeGreaterThan(1000)

    // Y son una COPIA: un consumidor que los mutara no puede tocar ni el modelo…
    expect(anillos[0]).not.toBe(ctx.store.get().recintos[0].vertices)
    anillos[0][0][0] = 999999
    expect(ctx.store.get().recintos[0].vertices[0][0]).toBeCloseTo(439240, 6)
    // …ni el polígono que se está pintando.
    ctx.sinc.refrescar()
    const anillo = poligonoEnPane(ctx.mapa, PANE.PARCELA_EDITADA).getLatLngs()[0]
    expect(anillo[0].lat).toBeCloseTo(vertUTMaLatLng([439240, 4479655], 30)[0], 9)

    ctx.limpiar()
  })

  it('en cada drag recibe los anillos EN VUELO y la refVertice del vértice movido', () => {
    const alPrevisualizar = vi.fn()
    const ctx = montar({ alPrevisualizar })
    const antes = structuredClone(ctx.store.get())
    alPrevisualizar.mockClear()

    const marcador = marcadorDe(ctx.mapa, 1, 2)
    const destino = destinoDe(antes, 1, 2, 1.5)
    marcador.setLatLng(destino.latlng)
    marcador.fire('drag')

    expect(alPrevisualizar).toHaveBeenCalledTimes(1)
    const [anillos, ref] = alPrevisualizar.mock.calls[0]
    expect(ref).toEqual({ recinto: 1, indice: 2 })
    // El vértice en vuelo ya lleva el valor nuevo…
    expect(anillos[1][2][0]).toBeCloseTo(destino.utm[0], 2)
    expect(anillos[1][2][1]).toBeCloseTo(destino.utm[1], 2)
    // …los demás siguen quietos…
    expect(anillos[1][0]).toEqual(antes.recintos[1].vertices[0])
    expect(anillos[0]).toEqual(antes.recintos[0].vertices)
    // …y el ESTADO todavía no sabe nada: por eso son "en vuelo".
    expect(ctx.store.get().recintos).toEqual(antes.recintos)

    // Al soltar, una llamada más: la del render, ya con el estado y sin refVertice.
    marcador.fire('dragend')
    const [anillosFin, refFin] = alPrevisualizar.mock.calls.at(-1)
    expect(refFin).toBeNull()
    expect(anillosFin[1][2][0]).toBeCloseTo(destino.utm[0], 2)
    expect(anillosFin[1][2]).toEqual(ctx.store.get().recintos[1].vertices[2])

    ctx.limpiar()
  })

  it('un set ajeno re-sincroniza la vista en vivo con el estado', () => {
    const alPrevisualizar = vi.fn()
    const ctx = montar({ alPrevisualizar })
    alPrevisualizar.mockClear()

    const siguiente = structuredClone(ctx.store.get())
    siguiente.recintos[1].vertices[0] = [439249.5, 4479661.5]
    ctx.store.set(siguiente)

    expect(alPrevisualizar).toHaveBeenCalledTimes(1)
    const [anillos, ref] = alPrevisualizar.mock.calls[0]
    expect(ref).toBeNull()
    expect(anillos[1][0]).toEqual([439249.5, 4479661.5])

    ctx.limpiar()
  })

  it('una vista en vivo que revienta no se lleva por delante el modelo', () => {
    const alPrevisualizar = vi.fn(() => {
      throw new Error('acotaciones rotas')
    })
    const historial = historialReal()
    // El render de arranque ya llama al gancho: el primer aviso llega al montar.
    const ctx = montar({ alPrevisualizar, historial })
    expect(ctx.alAvisar).toHaveBeenCalledTimes(1)
    expect(ctx.alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)

    const antes = structuredClone(ctx.store.get())
    const marcador = marcadorDe(ctx.mapa, 0, 3)
    expect(() => {
      for (const d of [1, 2, 3, 4]) {
        marcador.setLatLng(destinoDe(antes, 0, 3, d).latlng)
        marcador.fire('drag')
      }
      marcador.fire('dragend')
    }).not.toThrow()

    expect(alPrevisualizar).toHaveBeenCalledTimes(1 + 4 + 1) // montaje + frames + render final
    // Un aviso por el montaje y UNO por el gesto entero, no cuatro.
    expect(ctx.alAvisar).toHaveBeenCalledTimes(2)

    // El modelo, intacto en su corrección: el gesto ha acabado y ha commiteado.
    expect(ctx.store.get().recintos[0].vertices[3][0]).toBeCloseTo(
      destinoDe(antes, 0, 3, 4).utm[0],
      2,
    )
    exigirSinNaN(ctx.store.get())
    expect(commitsDe(historial)).toBe(1)

    ctx.limpiar()
  })

  // ── alCrearMarcador ───────────────────────────────────────────────────────

  it('alCrearMarcador recibe cada L.Marker recién creado con su refVertice', () => {
    const vistos = []
    const alCrearMarcador = vi.fn((marcador, ref) => vistos.push({ marcador, ref }))
    const ctx = montar({ alCrearMarcador })

    expect(alCrearMarcador).toHaveBeenCalledTimes(8) // uno por vértice de los 2 recintos
    for (const { marcador, ref } of vistos) {
      expect(marcador instanceof L.Marker).toBe(true)
      // El MISMO objeto que cuelga del marcador, no una copia.
      expect(ref).toBe(marcador.refVertice)
      // Ya está en el mapa y ya es localizable por su RefVertice.
      expect(marcadorDe(ctx.mapa, ref.recinto, ref.indice)).toBe(marcador)
    }
    const claves = new Set(vistos.map(({ ref }) => `${ref.recinto}:${ref.indice}`))
    expect(claves.size).toBe(8) // uno por RefVertice, sin repetir

    ctx.limpiar()
  })

  it('se llama al RECONSTRUIR y NO cuando el render actualiza en sitio', () => {
    const alCrearMarcador = vi.fn()
    const ctx = montar({ alCrearMarcador })
    alCrearMarcador.mockClear()

    // Misma forma → render en sitio: las instancias se reutilizan (hallazgo C8),
    // así que no hay ningún marcador nuevo que entregar.
    const igual = structuredClone(ctx.store.get())
    igual.recintos[0].vertices[0] = [439241, 4479656]
    ctx.store.set(igual)
    expect(alCrearMarcador).not.toHaveBeenCalled()

    // Cambia la forma → reconstrucción: se entregan todos otra vez.
    const otra = structuredClone(ctx.store.get())
    otra.recintos[0].vertices.push([439250, 4479675])
    ctx.store.set(otra)
    expect(alCrearMarcador).toHaveBeenCalledTimes(9)

    ctx.limpiar()
  })

  it('un alCrearMarcador que revienta avisa UNA vez (no ocho) y deja los vértices usables', () => {
    const alCrearMarcador = vi.fn(() => {
      throw new Error('edición rota')
    })
    const historial = historialReal()
    const ctx = montar({ alCrearMarcador, historial })

    expect(alCrearMarcador).toHaveBeenCalledTimes(8)
    expect(ctx.alAvisar).toHaveBeenCalledTimes(1) // un aviso por reconstrucción, no por vértice
    expect(ctx.alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    expect(marcadoresDe(ctx.mapa)).toHaveLength(8)

    // Y el arrastre sigue funcionando: la vista rota no se lleva el modelo.
    const antes = structuredClone(ctx.store.get())
    const marcador = marcadorDe(ctx.mapa, 0, 1)
    marcador.setLatLng(destinoDe(antes, 0, 1, 1).latlng)
    marcador.fire('drag')
    marcador.fire('dragend')
    expect(ctx.store.get().recintos[0].vertices[1][0]).toBeCloseTo(
      destinoDe(antes, 0, 1, 1).utm[0],
      2,
    )
    expect(commitsDe(historial)).toBe(1)

    // Una reconstrucción nueva es un episodio nuevo: vuelve a avisar.
    const otra = structuredClone(ctx.store.get())
    otra.recintos[0].vertices.push([439250, 4479675])
    ctx.store.set(otra)
    expect(ctx.alAvisar).toHaveBeenCalledTimes(2)

    ctx.limpiar()
  })
})

// ── destruir ─────────────────────────────────────────────────────────────────

describe('viewer/sincronizacion · destruir()', () => {
  it('vacía la tabla, quita las capas y se da de baja del store', () => {
    const ctx = montar({ historial: historialReal() })
    expect(poligonosDe(ctx.mapa).length).toBeGreaterThan(0)
    expect(marcadoresDe(ctx.mapa).length).toBeGreaterThan(0)

    ctx.sinc.destruir()

    expect(ctx.tablaEl.childNodes).toHaveLength(0)
    expect(poligonosDe(ctx.mapa)).toHaveLength(0)
    expect(marcadoresDe(ctx.mapa)).toHaveLength(0)

    // Un set posterior no re-renderiza ni lanza.
    expect(() => ctx.store.set(parcelaConHueco())).not.toThrow()
    expect(ctx.tablaEl.childNodes).toHaveLength(0)
    expect(marcadoresDe(ctx.mapa)).toHaveLength(0)

    ctx.limpiar() // destruir() es idempotente
  })

  it('es idempotente y deja de escuchar los change de la tabla', () => {
    const ctx = montar({ historial: historialReal() })
    // Se guarda la fila ANTES de destruir (después la tabla está vacía).
    const fila = filaDe(ctx.tablaEl, 0, 0)
    const { x } = inputsDe(fila)

    ctx.sinc.destruir()
    expect(() => ctx.sinc.destruir()).not.toThrow()

    const antes = structuredClone(ctx.store.get())
    ctx.tablaEl.appendChild(fila) // reengancha la fila suelta
    cambiarCelda(x, '999999')
    expect(ctx.store.get().recintos).toEqual(antes.recintos)
    expect(ctx.alAvisar).not.toHaveBeenCalled()

    ctx.limpiar()
  })
})

// ── Selección de vértice: mapa ↔ tabla ───────────────────────────────────────
//
// La tercera vista del mismo dato (las otras dos son el dibujo y la tabla), y la
// única que NO está en el modelo: qué vértice está mirando el usuario. Se blinda
// aquí porque los tres riesgos de la feature son de ENCAJE, no de cálculo:
//   · el clic del marcador SE COME el del mapa (`Map#_findEventTargets`), y de
//     ese clic viven el trazado de F12, el lindero de F06 y el Catastro de F05;
//   · `setIcon` rehace el `MarkerDrag` del marcador, así que seleccionar podría
//     devolverle el arrastre a un vértice que la pantalla había apagado;
//   · el resalte cuelga de `filas`/`marcadores`, que se TIRAN en cada
//     reconstrucción.

describe('viewer/sincronizacion · selección de vértice (mapa ↔ tabla)', () => {
  /** ¿El marcador está pintado como seleccionado? (lo que se VE, no la opción.) */
  const marcadorResaltado = (marcador) =>
    marcador.getElement().classList.contains('gml-vertice-seleccionado')

  /** ¿La fila está marcada? Se lee el ARIA, que es la ÚNICA marca que se pone. */
  const filaMarcada = (tablaEl, r, i) =>
    filaDe(tablaEl, r, i).getAttribute('aria-current') === 'true'

  /** Clic de Leaflet sobre un marcador (el que dispara el hit-testing real). */
  const clicarVertice = (marcador) =>
    marcador.fire('click', { latlng: marcador.getLatLng(), originalEvent: null })

  it('un clic en el vértice lo marca en el mapa Y en su fila', () => {
    const ctx = montar()
    const marcador = marcadorDe(ctx.mapa, 0, 2)

    expect(ctx.sinc.verticeSeleccionado()).toBeNull()
    expect(marcadorResaltado(marcador)).toBe(false)

    clicarVertice(marcador)

    expect(ctx.sinc.verticeSeleccionado()).toEqual({ recinto: 0, indice: 2 })
    expect(marcadorResaltado(marcador)).toBe(true)
    expect(filaMarcada(ctx.tablaEl, 0, 2)).toBe(true)
    // Y SOLO ésa: una selección que marca dos filas no señala ninguna.
    expect(ctx.tablaEl.querySelectorAll('tr[aria-current]')).toHaveLength(1)
    expect(marcadorResaltado(marcadorDe(ctx.mapa, 0, 1))).toBe(false)

    ctx.limpiar()
  })

  it('un clic en la fila marca el vértice del mapa (y el hueco también)', () => {
    const ctx = montar()

    filaDe(ctx.tablaEl, 1, 1).dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(ctx.sinc.verticeSeleccionado()).toEqual({ recinto: 1, indice: 1 })
    expect(marcadorResaltado(marcadorDe(ctx.mapa, 1, 1))).toBe(true)
    expect(filaMarcada(ctx.tablaEl, 1, 1)).toBe(true)

    ctx.limpiar()
  })

  it('entrar en una celda con el TECLADO también señala su vértice', () => {
    const ctx = montar()
    // `focus` NO burbujea y el oyente es delegado: si el módulo escuchara `focus`
    // en vez de `focusin`, esta prueba se quedaría sin selección.
    inputsDe(filaDe(ctx.tablaEl, 0, 3)).y.focus()

    expect(ctx.sinc.verticeSeleccionado()).toEqual({ recinto: 0, indice: 3 })
    expect(marcadorResaltado(marcadorDe(ctx.mapa, 0, 3))).toBe(true)

    ctx.limpiar()
  })

  it('un clic en el mapa (en el vacío) suelta la selección', () => {
    const ctx = montar()
    clicarVertice(marcadorDe(ctx.mapa, 0, 0))
    expect(ctx.sinc.verticeSeleccionado()).not.toBeNull()

    ctx.mapa.fire('click', { latlng: ctx.mapa.getCenter() })

    expect(ctx.sinc.verticeSeleccionado()).toBeNull()
    expect(marcadorResaltado(marcadorDe(ctx.mapa, 0, 0))).toBe(false)
    expect(ctx.tablaEl.querySelectorAll('tr[aria-current]')).toHaveLength(0)

    ctx.limpiar()
  })

  it('EL CLIC DEL VÉRTICE SE LE DEVUELVE AL MAPA, y no se suelta a sí mismo', () => {
    // El riesgo estrella: en cuanto una capa escucha `click`, Leaflet deja de
    // disparar el del mapa. Si este test se pone rojo, lo que se ha roto no es la
    // selección: es poner un punto del trazo (F12), seleccionar el lindero (F06) y
    // deducir del Catastro (F05) pinchando sobre un vértice.
    const ctx = montar()
    const clics = []
    ctx.mapa.on('click', (e) => clics.push(e.latlng))

    const marcador = marcadorDe(ctx.mapa, 0, 1)
    clicarVertice(marcador)

    expect(clics).toHaveLength(1)
    expect(clics[0].lat).toBeCloseTo(marcador.getLatLng().lat, 9)
    expect(clics[0].lng).toBeCloseTo(marcador.getLatLng().lng, 9)
    // Y la guarda de reentrada: el clic reemitido NO puede leerse como «ha
    // pinchado en el vacío» y soltar lo que se acaba de seleccionar.
    expect(ctx.sinc.verticeSeleccionado()).toEqual({ recinto: 0, indice: 1 })
    expect(marcadorResaltado(marcador)).toBe(true)

    ctx.limpiar()
  })

  it('seleccionar NO devuelve el arrastre a un vértice que estaba apagado', () => {
    // `setIcon` rehace el `MarkerDrag` (`Marker#_initIcon` → `_initInteraction`).
    // La pantalla de Validación apaga el arrastre con `dragging.disable()`, y
    // seleccionar un vértice no puede volver a encenderlo por la espalda.
    const ctx = montar()
    const apagado = marcadorDe(ctx.mapa, 0, 0)
    const encendido = marcadorDe(ctx.mapa, 0, 1)
    apagado.dragging.disable()

    clicarVertice(apagado)
    expect(apagado.dragging.enabled()).toBe(false)

    clicarVertice(encendido)
    expect(encendido.dragging.enabled()).toBe(true)

    ctx.limpiar()
  })

  it('tras seleccionar, el arrastre sigue escribiendo en el modelo', () => {
    const historial = historialReal()
    const ctx = montar({ historial })
    const antes = structuredClone(ctx.store.get())
    const [x, y] = antes.recintos[0].vertices[0]
    const [lat, lng] = vertUTMaLatLng([x + 1, y + 1], 30)

    const marcador = marcadorDe(ctx.mapa, 0, 0)
    clicarVertice(marcador)
    marcador.setLatLng({ lat, lng })
    marcador.fire('drag')
    marcador.fire('dragend')

    expect(ctx.store.get().recintos[0].vertices[0][0]).toBeCloseTo(x + 1, 2)
    expect(commitsDe(historial)).toBe(1)
    // Y el vértice movido sigue siendo el señalado.
    expect(ctx.sinc.verticeSeleccionado()).toEqual({ recinto: 0, indice: 0 })
    expect(marcadorResaltado(marcadorDe(ctx.mapa, 0, 0))).toBe(true)

    ctx.limpiar()
  })

  it('la selección sobrevive a un render en sitio y se suelta si el vértice se va', () => {
    const ctx = montar()
    clicarVertice(marcadorDe(ctx.mapa, 0, 2))

    // 1 · Misma FORMA: se actualiza en sitio, no se recrea nada. El resalte sigue.
    const movida = structuredClone(ctx.store.get())
    movida.recintos[0].vertices[0] = [439241, 4479656]
    ctx.store.set(movida)
    expect(ctx.sinc.verticeSeleccionado()).toEqual({ recinto: 0, indice: 2 })
    expect(marcadorResaltado(marcadorDe(ctx.mapa, 0, 2))).toBe(true)
    expect(filaMarcada(ctx.tablaEl, 0, 2)).toBe(true)

    // 2 · Otra FORMA: se reconstruye todo. Filas y marcadores son objetos NUEVOS,
    // y el resalte tiene que volver a ponerse sobre ellos.
    const conUnoMas = structuredClone(ctx.store.get())
    conUnoMas.recintos[0].vertices.push([439250, 4479675])
    ctx.store.set(conUnoMas)
    expect(marcadorResaltado(marcadorDe(ctx.mapa, 0, 2))).toBe(true)
    expect(filaMarcada(ctx.tablaEl, 0, 2)).toBe(true)

    // 3 · El vértice señalado DESAPARECE: la selección se suelta sola, en vez de
    // quedarse apuntando a un hueco y reaparecer sobre el vértice equivocado.
    const recortada = structuredClone(ctx.store.get())
    recortada.recintos[0].vertices.splice(2)
    ctx.store.set(recortada)
    expect(ctx.sinc.verticeSeleccionado()).toBeNull()
    expect(ctx.tablaEl.querySelectorAll('tr[aria-current]')).toHaveLength(0)

    ctx.limpiar()
  })

  it('seleccionarVertice(): lanza con basura, y una ref que no existe suelta', () => {
    const ctx = montar()

    for (const basura of [3, 'x', [], { recinto: 0 }, { recinto: -1, indice: 0 }]) {
      expect(() => ctx.sinc.seleccionarVertice(basura)).toThrow(TypeError)
    }

    expect(ctx.sinc.seleccionarVertice({ recinto: 0, indice: 1 })).toEqual({
      recinto: 0,
      indice: 1,
    })
    // Fuera de rango: NO se guarda (un resalte fantasma reaparecería en el
    // siguiente render). Y no es un contrato roto: la parcela ha podido cambiar
    // entre el clic y la llamada.
    expect(ctx.sinc.seleccionarVertice({ recinto: 9, indice: 0 })).toBeNull()
    expect(ctx.sinc.verticeSeleccionado()).toBeNull()
    expect(ctx.sinc.seleccionarVertice(null)).toBeNull()

    ctx.limpiar()
  })

  it('destruir() deja de escuchar el clic del mapa y suelta la selección', () => {
    const ctx = montar()
    clicarVertice(marcadorDe(ctx.mapa, 0, 0))
    expect(ctx.sinc.verticeSeleccionado()).not.toBeNull()

    ctx.sinc.destruir()

    expect(ctx.sinc.verticeSeleccionado()).toBeNull()
    expect(ctx.sinc.seleccionarVertice({ recinto: 0, indice: 0 })).toBeNull()
    expect(() => ctx.mapa.fire('click', { latlng: ctx.mapa.getCenter() })).not.toThrow()

    ctx.limpiar()
  })
})


// ── La cuarta columna: la × que borra la fila (2026-08-10) ───────────────────
//
// El gancho `alBorrar` es lo que enciende la columna entera. Sin él la tabla es
// exactamente la de F03 —tres columnas, ningún botón—, y eso también se prueba:
// el visor se monta sin edición en más de un sitio (la rama EDIFICIO, una pantalla
// de solo lectura), y ahí un botón de borrar sería un mando muerto.

describe('viewer/sincronizacion · la columna de borrado', () => {
  const botonesBorrar = (ctx) => [...ctx.tablaEl.querySelectorAll('[data-accion="borrar-vertice"]')]

  const clicEnBoton = (boton) =>
    boton.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))

  it('SIN el gancho la tabla es la de F03: tres columnas y ningún botón', () => {
    const ctx = montar()
    expect(botonesBorrar(ctx)).toHaveLength(0)
    expect(ctx.tablaEl.querySelectorAll('thead th')).toHaveLength(3)
    // Y los dos `colspan` del módulo siguen cruzando la tabla entera.
    expect(ctx.tablaEl.querySelector('.gml-fila-recinto th').colSpan).toBe(3)
    ctx.limpiar()
  })

  it('CON el gancho, cada fila de vértice estrena su × y la cabecera su columna', () => {
    const ctx = montar({ alBorrar: vi.fn() })
    const filas = [...ctx.tablaEl.querySelectorAll('tr[data-indice]')]
    expect(filas.length).toBeGreaterThan(0)
    expect(botonesBorrar(ctx)).toHaveLength(filas.length)
    expect(ctx.tablaEl.querySelectorAll('thead th')).toHaveLength(4)
    // ⚠️ El `colspan` NO está escrito a mano: sale de `columnas()`. Sin eso, la fila
    // del recinto dejaría de cruzar la tabla al estrenarse la cuarta columna, que
    // es el desperfecto que nadie mira porque «solo es un colspan».
    expect(ctx.tablaEl.querySelector('.gml-fila-recinto th').colSpan).toBe(4)
    ctx.limpiar()
  })

  it('la × es un `<button>` de verdad, con nombre accesible propio de su fila', () => {
    const ctx = montar({ alBorrar: vi.fn() })
    const boton = botonesBorrar(ctx)[0]
    // `<button>` y no un `<span>` clicable: así entra en el orden de tabulación,
    // responde a Enter y a Espacio sin programarlo, y se anuncia como botón.
    expect(boton.tagName).toBe('BUTTON')
    expect(boton.type).toBe('button')
    // Quince botones llamados «×» son quince botones indistinguibles para quien
    // recorre la página por botones.
    expect(boton.getAttribute('aria-label')).toBe('Borrar el vértice 1 de EXTERIOR')
    ctx.limpiar()
  })

  it('pulsarla llama al gancho con la RefVertice de su fila', () => {
    const alBorrar = vi.fn()
    const ctx = montar({ alBorrar })

    clicEnBoton(botonesBorrar(ctx)[2])

    expect(alBorrar).toHaveBeenCalledTimes(1)
    expect(alBorrar).toHaveBeenCalledWith({ recinto: 0, indice: 2 })
    ctx.limpiar()
  })

  it('⚠️ NO borra por su cuenta: la operación es del gancho', () => {
    // `sincronizacion.js` pinta y arrastra; insertar y eliminar son de
    // `viewer/edicion.js`, que sabe negarse cuando el anillo quedaría con menos de
    // tres vértices. Un borrado hecho aquí se saltaría esa regla.
    const ctx = montar({ alBorrar: vi.fn() })
    const antes = ctx.store.get().recintos[0].vertices.length

    clicEnBoton(botonesBorrar(ctx)[0])

    expect(ctx.store.get().recintos[0].vertices).toHaveLength(antes)
    ctx.limpiar()
  })

  it('la × del HUECO señala a su propio recinto, no al exterior', () => {
    const alBorrar = vi.fn()
    const ctx = montar({ alBorrar })
    const delHueco = [...ctx.tablaEl.querySelectorAll('tr[data-recinto="1"]')].filter((f) =>
      f.hasAttribute('data-indice'),
    )
    expect(delHueco.length).toBeGreaterThan(0)

    clicEnBoton(delHueco[0].querySelector('[data-accion="borrar-vertice"]'))

    expect(alBorrar).toHaveBeenCalledWith({ recinto: 1, indice: 0 })
    ctx.limpiar()
  })

  it('⛔ sobrevive a la RECONSTRUCCIÓN de la tabla (el oyente va delegado)', () => {
    // Borrar un vértice cambia la FORMA, y un cambio de forma rehace la tabla
    // entera. Con un oyente por botón, el primer borrado se llevaría por delante
    // todos los demás y el segundo clic no haría nada.
    const alBorrar = vi.fn()
    const ctx = montar({ alBorrar })
    const antes = botonesBorrar(ctx)[0]

    // Una parcela con OTRA forma: el módulo reconstruye la tabla entera, así que
    // los botones de después son nodos nuevos y los de antes, huérfanos.
    const otra = parcelaConHueco()
    otra.recintos[0].vertices = otra.recintos[0].vertices.slice(0, 3)
    ctx.store.set(otra)
    expect(botonesBorrar(ctx)[0], 'la tabla no se ha reconstruido').not.toBe(antes)

    clicEnBoton(botonesBorrar(ctx)[1])

    expect(alBorrar).toHaveBeenCalledWith({ recinto: 0, indice: 1 })
    ctx.limpiar()
  })

  it('una fila que ya no señala ningún vértice avisa en vez de llamar al gancho', () => {
    const alBorrar = vi.fn()
    const ctx = montar({ alBorrar })
    const boton = botonesBorrar(ctx).at(-1)
    const fila = boton.closest('tr')
    // Se envejece la fila a mano: es lo que pasa cuando otra vista carga otra
    // parcela entre el pintado y el clic.
    fila.dataset.indice = '99'

    clicEnBoton(boton)

    expect(alBorrar).not.toHaveBeenCalled()
    expect(ctx.alAvisar).toHaveBeenCalled()
    ctx.limpiar()
  })

  // ── ⛔ LA SELECCIÓN DESPUÉS DE BORRAR (auditoría V6, 2026-08-16) ────────────
  // El comentario del propio módulo afirmaba que el orden de registro de los dos
  // oyentes de `click` evita que «el borrado deje de paso seleccionada la fila que
  // acaba de desaparecer», y era MENTIRA: `alSeñalarFila` corre después de la
  // reconstrucción, leyendo el `dataset` VIEJO de una fila ya desprendida, y
  // `fijarSeleccion` solo comprueba que el par `(recinto, indice)` exista — y
  // existe, porque es OTRO vértice: el que ha heredado el índice al correrse.
  // Reproducido: borrar `(0,1)` de un exterior de 4 dejaba seleccionado el antiguo
  // `v2`, con su `aria-current` en la fila y su marcador grande en el mapa.
  // Y al borrar la ÚLTIMA fila no pasaba (no hay quien herede el índice), así que
  // además era incoherente.

  /** Un `alBorrar` que BORRA de verdad, como hace `viewer/edicion.js#eliminar`. */
  const borradoReal = (ctx) => ({ recinto, indice }) => {
    const parcela = structuredClone(ctx.store.get())
    parcela.recintos[recinto].vertices.splice(indice, 1)
    ctx.store.set(parcela)
  }

  it('⛔ borrar una fila NO deja seleccionado el vértice que HEREDA su índice', () => {
    const ctx = montar({ alBorrar: (ref) => borradoReal(ctx)(ref) })
    const v2Antes = ctx.store.get().recintos[0].vertices[2]

    clicEnBoton(botonesBorrar(ctx)[1]) // la × de (0,1)

    // El borrado ocurre…
    expect(ctx.store.get().recintos[0].vertices[1]).toEqual(v2Antes)
    // …y NO deja seleccionado a nadie. El vértice que ahora ocupa el índice 1 es
    // otro trozo de terreno: seleccionarlo «porque el par existe» es señalar algo
    // que el usuario no ha tocado.
    expect(ctx.sinc.verticeSeleccionado()).toBeNull()
    expect(ctx.tablaEl.querySelectorAll('[aria-current]')).toHaveLength(0)
    ctx.limpiar()
  })

  it('y tampoco si la fila estaba seleccionada ANTES de pulsar su ×', () => {
    // El otro camino al mismo sitio: la selección ya apuntaba al vértice borrado y
    // `sincronizarSeleccion` la daba por buena porque el par seguía existiendo.
    const ctx = montar({ alBorrar: (ref) => borradoReal(ctx)(ref) })

    ctx.sinc.seleccionarVertice({ recinto: 0, indice: 1 })
    expect(ctx.sinc.verticeSeleccionado()).toEqual({ recinto: 0, indice: 1 })

    clicEnBoton(botonesBorrar(ctx)[1])

    expect(ctx.sinc.verticeSeleccionado()).toBeNull()
    ctx.limpiar()
  })

  it('borrar la ÚLTIMA fila se comporta IGUAL (era el caso que sí funcionaba)', () => {
    // La incoherencia era el otro síntoma: sin nadie que heredara el índice, la
    // selección salía limpia. Ahora los dos casos son el mismo caso.
    const ctx = montar({ alBorrar: (ref) => borradoReal(ctx)(ref) })
    const n = ctx.store.get().recintos[0].vertices.length

    clicEnBoton(botonesBorrar(ctx).filter((b) => b.closest('tr').dataset.recinto === '0').at(-1))

    expect(ctx.store.get().recintos[0].vertices).toHaveLength(n - 1)
    expect(ctx.sinc.verticeSeleccionado()).toBeNull()
    ctx.limpiar()
  })

  it('un clic en la fila (sin ×) SIGUE seleccionando: no se ha apagado la selección por tabla', () => {
    // El control negativo del arreglo: si esto se pusiera rojo, el remedio habría
    // matado la selección por tabla, que es una feature viva.
    const ctx = montar({ alBorrar: vi.fn() })
    const fila = ctx.tablaEl.querySelector('tr[data-recinto="0"][data-indice="1"]')

    fila.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }))

    expect(ctx.sinc.verticeSeleccionado()).toEqual({ recinto: 0, indice: 1 })
    expect(fila.getAttribute('aria-current')).toBe('true')
    ctx.limpiar()
  })

  it('`destruir()` retira también este oyente', () => {
    const alBorrar = vi.fn()
    const ctx = montar({ alBorrar })
    const boton = botonesBorrar(ctx)[0]

    ctx.sinc.destruir()
    clicEnBoton(boton)

    expect(alBorrar).not.toHaveBeenCalled()
    ctx.limpiar()
  })

  it('un `alBorrar` que no es función es contrato roto → throw', () => {
    const { mapa, destruir: destruirMapa } = montarMapa()
    const panes = crearPanes(mapa)
    const tablaEl = document.createElement('table')
    const estado = crearEstadoVista(parcelaConHueco())
    expect(() =>
      sincronizar({ mapa, panes, estado, tablaEl, zona: 30, alBorrar: 'sí' }),
    ).toThrow(TypeError)
    destruirMapa()
  })
})

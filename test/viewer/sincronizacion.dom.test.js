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
 */
function montar({ parcela = parcelaConHueco(), historial = null, alAvisar = vi.fn() } = {}) {
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

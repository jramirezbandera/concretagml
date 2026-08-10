// test/viewer/edicion.dom.test.js — F06 · Tarea T3.3 (interacción de edición).
//
// Proyecto Vitest `dom` (jsdom): el nombre `*.dom.test.js` lo enruta ahí.
//
// Lo que se blinda aquí, por criterios de `spec/feature-06-edicion-parcela.md`:
//   · CA 1 — insertar/eliminar/desplazar MODIFICAN el modelo (un `set` y UN
//     `commit` por operación acabada), y una operación que no cambia nada no deja
//     rastro en el historial.
//   · CA 2 — el snap engancha al vértice/lindero más cercano dentro de τ, NO se
//     engancha a sí mismo, y se apaga con la tecla modificadora POR LOS DOS
//     CAMINOS (evento real y seguimiento propio), con la guarda del `blur`.
//   · CA 3 — el offset publica su `modo` y sus detecciones con el texto de
//     `edit/offset.js`, incluido el fallback de bisel.
//
// Y las tres cosas que solo se ven desde aquí:
//   · la CACHÉ de dianas (una construcción por gesto) y su política de
//     invalidación, medida con un espía sobre `edit/snap.js#dianasDe`;
//   · el mapa de gestos (clic ≠ doble clic ≠ menú contextual) y la promesa de que
//     un clic NUNCA escribe en el modelo;
//   · `destruir()` idempotente que deja el mapa como estaba.
//
// El arrastre con ratón REAL no se prueba (jsdom no tiene hit-testing): los gestos
// se simulan por API, que es el mismo patrón que `sincronizacion.dom.test.js`.

import { afterEach, describe, expect, it, vi } from 'vitest'
import L from 'leaflet'

import { OPERATIVOS } from '../../config/operativos.js'
import { crearHistorial } from '../../edit/historial.js'
import { MODO_OFFSET, TIPO_OFFSET } from '../../edit/offset.js'
import { dianasDe } from '../../edit/snap.js'
import { MENSAJE_POR_MOTIVO, MOTIVO_VERTICE } from '../../edit/vertices.js'
import { TIPO_RECINTO, crearParcela, crearRecinto } from '../../model/parcela.js'
import { CLASE_EDICION, UMBRAL_PUNTERIA_PX, crearEdicion } from '../../viewer/edicion.js'
import { COLOR_USUARIO, NIVEL, PANE, crearEstadoVista, vertUTMaLatLng } from '../../viewer/_comun.js'
import { crearPanes, montarMapa, parcelaConHueco } from './_ayuda-jsdom.js'

// `dianasDe` se envuelve en un espía que llama al ORIGINAL: el comportamiento de
// todas las suites es idéntico y a cambio se puede CONTAR cuántas veces se
// construye el catálogo, que es la única forma de demostrar la caché (su efecto no
// se ve en el resultado: una caché correcta devuelve exactamente lo mismo).
vi.mock('../../edit/snap.js', async (importarOriginal) => {
  const real = await importarOriginal()
  return { ...real, dianasDe: vi.fn(real.dianasDe) }
})

// ── Fixtures ─────────────────────────────────────────────────────────────────

const HUSO = 30

/**
 * Zoom de los tests. A z20 el mapa va a ~0,114 m/px, así que
 * {@link UMBRAL_PUNTERIA_PX} (12 px) son ~1,4 m de terreno: números cómodos para
 * distinguir «has pinchado sobre el lindero» de «has pinchado a diez metros».
 */
const ZOOM = 20

/** Exterior de la parcela de demo del arnés (20 × 15 m), para calcular a mano. */
const V = Object.freeze({
  A: [439240, 4479655], // recinto 0, índice 0
  B: [439260, 4479655], // recinto 0, índice 1
  C: [439260, 4479670], // recinto 0, índice 2
  D: [439240, 4479670], // recinto 0, índice 3
})

/** Un `[lat,lng]` a partir de un par UTM del huso 30. */
const aLatLng = (utm) => vertUTMaLatLng(utm, HUSO)

/**
 * Triángulo MUY plano: los dos linderos contiguos forman ~2,3° con el que se
 * desplaza, así que el corte del miter mandaría el vértice a 25 m por un offset de
 * 1 m y `edit/offset.js` tiene que biselar (miter-limit).
 */
const TRIANGULO_AGUDO = [
  [439240, 4479655],
  [439340, 4479655],
  [439290, 4479657],
]

/** Parcela de un solo recinto con los vértices dados. */
function parcelaCon(vertices, { geometriaOficial = null } = {}) {
  return crearParcela({
    idLocal: 'demo-edicion',
    origen: 'LIST',
    recintos: [crearRecinto(vertices, TIPO_RECINTO.EXTERIOR)],
    geometriaOficial:
      geometriaOficial === null
        ? null
        : [crearRecinto(geometriaOficial, TIPO_RECINTO.EXTERIOR)],
  })
}

/**
 * Monta mapa + store + `crearEdicion`. NO monta `sincronizar`: este módulo se
 * prueba solo, y los marcadores que hagan falta se crean a mano (que es además la
 * forma de comprobar el gancho `alCrearMarcador` sin acoplarse a otra tarea).
 */
function montar({
  parcela = parcelaConHueco(),
  historial = null,
  alAvisar = vi.fn(),
  conPanes = true,
  tolerancia,
} = {}) {
  const { mapa, destruir: destruirMapa } = montarMapa({ zoom: ZOOM })
  const panes = conPanes ? crearPanes(mapa) : null
  const store = crearEstadoVista(parcela)
  const edicion = crearEdicion({
    mapa,
    estado: store,
    zona: HUSO,
    historial,
    alAvisar,
    ...(tolerancia === undefined ? {} : { tolerancia }),
  })
  return {
    mapa,
    panes,
    store,
    edicion,
    alAvisar,
    parcela,
    limpiar() {
      edicion.destruir()
      destruirMapa()
    },
  }
}

// ── Utilidades de inspección ─────────────────────────────────────────────────

function capasDe(mapa, Clase) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof Clase) out.push(capa)
  })
  return out
}

/**
 * El indicador de enganche, o `null`.
 *
 * Se localiza por su CLASE CSS, no por su clase de Leaflet: desde que las siluetas
 * son SVG (la convención OSNAP de AutoCAD — cuadrado para vértice, reloj de arena
 * para lindero) es un `L.Marker` con `divIcon`, igual que los vértices que pinta
 * `viewer/sincronizacion.js`, así que el tipo de Leaflet ya no lo distingue de
 * ellos. La clase SÍ es contrato público (`CLASE_EDICION`) y es lo que miran
 * también `estilos/app.css` y el guion `08-edicion.js`.
 */
const indicadorDe = (mapa) =>
  capasDe(mapa, L.Marker).find((capa) =>
    String(capa.options.icon?.options?.className ?? '').includes(CLASE_EDICION.INDICADOR),
  ) || null

/** El resalte del lado (una `L.Polyline` que NO es un polígono), o `null`. */
const resalteDe = (mapa) =>
  capasDe(mapa, L.Polyline).find((c) => !(c instanceof L.Polygon)) || null

/** Vértices del recinto `r` del estado actual. */
const anilloDe = (store, r = 0) => store.get().recintos[r].vertices

/** Los niveles con los que se ha avisado, en orden. */
const nivelesDe = (alAvisar) => alAvisar.mock.calls.map(([, detalle]) => detalle && detalle.nivel)

/** Los mensajes con los que se ha avisado, en orden. */
const mensajesDe = (alAvisar) => alAvisar.mock.calls.map(([mensaje]) => mensaje)

/** Marcador de vértice suelto (sin `sincronizar`), ya cableado por la edición. */
function marcadorCableado(ctx, utm, ref) {
  const marcador = L.marker(aLatLng(utm), { draggable: true }).addTo(ctx.mapa)
  marcador.refVertice = ref
  ctx.edicion.alCrearMarcador(marcador, ref)
  return marcador
}

afterEach(() => {
  dianasDe.mockClear()
})

// ── Contratos del programador ────────────────────────────────────────────────

describe('viewer/edicion · contratos del programador (throw, regla 1)', () => {
  it('lanza sin mapa, sin store, con zona inválida, con historial que no lo es o con τ imposible', () => {
    const { mapa, destruir } = montarMapa({ zoom: ZOOM })
    const estado = crearEstadoVista(parcelaConHueco())

    expect(() => crearEdicion({ mapa: null, estado, zona: HUSO })).toThrow(TypeError)
    expect(() => crearEdicion({ mapa: {}, estado, zona: HUSO })).toThrow(TypeError)
    expect(() => crearEdicion({ mapa, estado: {}, zona: HUSO })).toThrow(TypeError)
    expect(() => crearEdicion({ mapa, estado, zona: 4 })).toThrow(RangeError)
    expect(() => crearEdicion({ mapa, estado, zona: '30' })).toThrow(RangeError)
    expect(() => crearEdicion({ mapa, estado, zona: HUSO, historial: 'sí' })).toThrow(TypeError)
    // Un objeto con método `commit` NO es el historial: la API de `edit/historial.js`
    // es funcional (mismo criterio que `viewer/sincronizacion.js`).
    expect(() =>
      crearEdicion({ mapa, estado, zona: HUSO, historial: { commit: () => {} } }),
    ).toThrow(TypeError)
    expect(() => crearEdicion({ mapa, estado, zona: HUSO, tolerancia: 'mucha' })).toThrow(TypeError)
    expect(() => crearEdicion({ mapa, estado, zona: HUSO, tolerancia: -1 })).toThrow(RangeError)

    destruir()
  })

  it('lanza con una RefVertice sin forma, y NO por que apunte a un vértice inexistente', () => {
    const ctx = montar()
    expect(() => ctx.edicion.ajustar([439240, 4479655], { recinto: 0 })).toThrow(TypeError)
    expect(() => ctx.edicion.ajustar([439240, 4479655], 3)).toThrow(TypeError)
    expect(() => ctx.edicion.eliminar({ recinto: '0', indice: 0 })).toThrow(TypeError)
    expect(() => ctx.edicion.seleccionarLado({ recinto: 0, indice: 1.5 })).toThrow(TypeError)
    // ⛔ Y `null` SIGUE lanzando en `eliminar`, que sí necesita un vértice: la
    // apertura de abajo es de `ajustar` y solo de `ajustar`. (`seleccionarLado`
    // ya admitía `null` desde F06, y ahí significa «suelta la selección».)
    expect(() => ctx.edicion.eliminar(null)).toThrow(TypeError)
    expect(ctx.edicion.seleccionarLado(null)).toBeNull()

    // Fuera de rango NO lanza: es un gesto sobre algo que ya no está (ver el
    // reparto de responsabilidades en la cabecera del módulo).
    expect(ctx.edicion.ajustar([439240, 4479655], { recinto: 9, indice: 0 })).toBeNull()
    expect(ctx.edicion.eliminar({ recinto: 0, indice: 99 })).toEqual({
      aplicado: false,
      motivo: null,
    })
    ctx.limpiar()
  })

  it('⛔ F12 · `ajustar` con `null` NO lanza: es un punto que se está dibujando', () => {
    // ⛔ **Hasta el 2026-08-06 esto LANZABA**, y era un defecto de encaje de
    // manual: `viewer/dibujo.js` engancha los puntos de un recinto que todavía no
    // está en el modelo, así que le pasa `null` —no hay ningún vértice que
    // excluir del catálogo—, y los dos módulos pasaban sus pruebas por separado
    // porque las del dibujo usaban un `ajustar` de mentira. Lo destapó la primera
    // prueba que los juntó, en `app/cableado-edificio.js`.
    //
    // `dianasDe` admite `excluir: null` desde F06, así que la apertura no inventa
    // nada: solo deja de exigir lo que la capa de abajo nunca exigió.
    const ctx = montar()
    expect(() => ctx.edicion.ajustar([439240, 4479655], null)).not.toThrow()

    // Y ENGANCHA de verdad: el punto cae a 5 cm de un vértice de la parcela y
    // sale pegado a él. Sin esto, la prueba pasaría con un `ajustar` que
    // devolviera `null` siempre y el dibujo se quedaría sin snap en silencio.
    const r = ctx.edicion.ajustar([439240.05, 4479655.05], null)
    expect(r).not.toBeNull()
    expect(r.enganchado).toBe(true)
    expect(r.punto).toEqual([439240, 4479655])
    ctx.limpiar()
  })

  it('F12 · sin referencia NO se excluye ningún vértice del catálogo', () => {
    // La otra mitad: cuando SÍ hay referencia, ese vértice se excluye para que no
    // se enganche a sí mismo. Sin referencia no hay nada que excluir, así que el
    // mismo punto que con `{recinto:0,indice:0}` no engancha, sin ella SÍ.
    const ctx = montar()
    expect(ctx.edicion.ajustar([439240.05, 4479655.05], { recinto: 0, indice: 0 }).punto).not.toEqual(
      [439240, 4479655],
    )
    expect(ctx.edicion.ajustar([439240.05, 4479655.05], null).punto).toEqual([439240, 4479655])
    ctx.limpiar()
  })

  it('`alCrearMarcador` exige un marcador y una referencia con forma', () => {
    const ctx = montar()
    expect(() => ctx.edicion.alCrearMarcador(null, { recinto: 0, indice: 0 })).toThrow(TypeError)
    expect(() => ctx.edicion.alCrearMarcador({}, { recinto: 0, indice: 0 })).toThrow(TypeError)
    const marcador = L.marker(aLatLng(V.A))
    expect(() => ctx.edicion.alCrearMarcador(marcador, 'x')).toThrow(TypeError)
    ctx.limpiar()
  })

  it('`snapActivo`, `tolerancia`, `fijarColindantes` y `alCambiarSeleccion` exigen su tipo', () => {
    const ctx = montar()
    expect(() => ctx.edicion.snapActivo('sí')).toThrow(TypeError)
    expect(() => ctx.edicion.tolerancia('mucha')).toThrow(TypeError)
    expect(() => ctx.edicion.tolerancia(-0.1)).toThrow(RangeError)
    expect(() => ctx.edicion.fijarColindantes('vecinas')).toThrow(TypeError)
    expect(() => ctx.edicion.alCambiarSeleccion(null)).toThrow(TypeError)
    ctx.limpiar()
  })
})

// ── CA 2 · Snap: dianas, exclusión y tolerancia ──────────────────────────────

describe('viewer/edicion · snap (criterio de aceptación 2)', () => {
  it('NO se engancha a sí mismo: el vértice arrastrado y sus dos lados salen del catálogo', () => {
    const ctx = montar()
    // 7 cm de su propia posición: sin `excluir` engancharía a sí mismo (distancia
    // 0 gana siempre) y el vértice quedaría CLAVADO.
    const r = ctx.edicion.ajustar([439240.05, 4479655.05], { recinto: 0, indice: 0 })
    expect(r).not.toBeNull()
    expect(r.enganchado).toBe(false)
    expect(r.tipo).toBeNull()
    expect(r.punto[0]).toBeCloseTo(439240.05, 6)
    expect(r.punto[1]).toBeCloseTo(4479655.05, 6)
    ctx.limpiar()
  })

  it('engancha al VÉRTICE más cercano dentro de τ (y el vértice gana al lindero)', () => {
    const ctx = montar()
    const r = ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })
    expect(r.enganchado).toBe(true)
    expect(r.tipo).toBe('VERTICE')
    expect(r.punto).toEqual(V.B)
    ctx.limpiar()
  })

  it('engancha al LINDERO cuando no hay ningún vértice dentro de τ', () => {
    const ctx = montar()
    const r = ctx.edicion.ajustar([439250, 4479669.9], { recinto: 0, indice: 0 })
    expect(r.enganchado).toBe(true)
    expect(r.tipo).toBe('LINDERO')
    expect(r.punto[0]).toBeCloseTo(439250, 9)
    expect(r.punto[1]).toBeCloseTo(4479670, 9)
    ctx.limpiar()
  })

  it('fuera de τ no engancha, y τ es configurable en METROS', () => {
    const ctx = montar()
    expect(ctx.edicion.tolerancia()).toBe(OPERATIVOS.snapMetros)
    // 40 cm del lindero: fuera de los 20 cm por defecto.
    expect(ctx.edicion.ajustar([439250, 4479669.6], { recinto: 0, indice: 0 }).enganchado).toBe(
      false,
    )
    expect(ctx.edicion.tolerancia(0.5)).toBe(0.5)
    expect(ctx.edicion.ajustar([439250, 4479669.6], { recinto: 0, indice: 0 }).enganchado).toBe(true)
    ctx.limpiar()
  })

  it('`snapActivo(false)` apaga el enganche y devuelve null (sin opinión)', () => {
    const ctx = montar()
    expect(ctx.edicion.snapActivo()).toBe(true)
    expect(ctx.edicion.snapActivo(false)).toBe(false)
    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })).toBeNull()
    ctx.edicion.snapActivo(true)
    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 }).enganchado).toBe(true)
    ctx.limpiar()
  })

  it('sin estado en el store no hay dianas y no se opina', () => {
    const ctx = montar({ parcela: null })
    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })).toBeNull()
    ctx.limpiar()
  })

  it('engancha también a la geometría OFICIAL, que nunca se excluye', () => {
    // La editable se ha movido 5 m al norte; la oficial se queda donde estaba, así
    // que el vértice 0 de la editable tiene una diana oficial a su alcance.
    const editable = [
      [439240, 4479660],
      [439260, 4479660],
      [439260, 4479675],
      [439240, 4479675],
    ]
    const ctx = montar({ parcela: parcelaCon(editable, { geometriaOficial: [V.A, V.B, V.C, V.D] }) })
    const r = ctx.edicion.ajustar([439240.1, 4479655], { recinto: 0, indice: 0 })
    expect(r.enganchado).toBe(true)
    expect(r.tipo).toBe('VERTICE')
    expect(r.punto).toEqual(V.A)
    ctx.limpiar()
  })
})

// ── CA 2 · La tecla modificadora, por los DOS caminos ────────────────────────

describe('viewer/edicion · la tecla Alt apaga el snap', () => {
  it('camino CON evento real: `eventoOriginal.altKey` apaga el enganche', () => {
    const ctx = montar()
    const sinAlt = ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 }, {
      altKey: false,
    })
    expect(sinAlt.enganchado).toBe(true)
    const conAlt = ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 }, {
      altKey: true,
    })
    expect(conAlt).toBeNull()
    ctx.limpiar()
  })

  it('camino CON evento de Leaflet: `altKey` dentro de `originalEvent`', () => {
    const ctx = montar()
    const r = ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 }, {
      originalEvent: { altKey: true },
    })
    expect(r).toBeNull()
    ctx.limpiar()
  })

  it('camino SIN evento: el seguimiento de keydown/keyup sobre document', () => {
    const ctx = montar()
    // El arrastre simulado por API no trae evento original: manda el seguimiento.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }))
    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })).toBeNull()

    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', altKey: false }))
    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 }).enganchado).toBe(true)
    ctx.limpiar()
  })

  it('el evento REAL tiene prioridad sobre el seguimiento, y lo resincroniza', () => {
    const ctx = montar()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }))
    // El seguimiento dice "Alt pulsada", el evento real dice que no: manda el real.
    expect(
      ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 }, { altKey: false })
        .enganchado,
    ).toBe(true)
    // Y además ha corregido el seguimiento: la siguiente llamada SIN evento
    // también engancha (si no, el snap se quedaría apagado por una bandera vieja).
    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 }).enganchado).toBe(true)
    ctx.limpiar()
  })

  it('el `blur` de la ventana baja la bandera: soltar Alt fuera de la pestaña no deja el snap muerto', () => {
    const ctx = montar()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }))
    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })).toBeNull()

    // El usuario suelta Alt en OTRA aplicación: aquí no llega ningún `keyup`.
    window.dispatchEvent(new Event('blur'))
    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 }).enganchado).toBe(true)
    ctx.limpiar()
  })
})

// ── La caché de dianas y su política de invalidación ─────────────────────────

describe('viewer/edicion · caché de dianas (una construcción por gesto)', () => {
  it('un gesto entero (muchos fotogramas) construye el catálogo UNA sola vez', () => {
    const ctx = montar()
    dianasDe.mockClear()
    for (let k = 0; k < 25; k++) {
      ctx.edicion.ajustar([439240 + k * 0.01, 4479655], { recinto: 0, indice: 0 })
    }
    expect(dianasDe).toHaveBeenCalledTimes(1)
    ctx.limpiar()
  })

  it('cambiar de vértice arrastrado invalida el catálogo (es otro gesto)', () => {
    const ctx = montar()
    dianasDe.mockClear()
    ctx.edicion.ajustar([439240, 4479655], { recinto: 0, indice: 0 })
    ctx.edicion.ajustar([439260, 4479655], { recinto: 0, indice: 1 })
    ctx.edicion.ajustar([439260, 4479655], { recinto: 0, indice: 1 })
    expect(dianasDe).toHaveBeenCalledTimes(2)
    ctx.limpiar()
  })

  it('un cambio de estado invalida el catálogo', () => {
    const ctx = montar()
    dianasDe.mockClear()
    ctx.edicion.ajustar([439240, 4479655], { recinto: 0, indice: 0 })
    ctx.store.set(structuredClone(ctx.store.get()))
    ctx.edicion.ajustar([439240, 4479655], { recinto: 0, indice: 0 })
    expect(dianasDe).toHaveBeenCalledTimes(2)
    ctx.limpiar()
  })

  it('`fijarColindantes` invalida el catálogo', () => {
    const ctx = montar()
    dianasDe.mockClear()
    ctx.edicion.ajustar([439240, 4479655], { recinto: 0, indice: 0 })
    ctx.edicion.fijarColindantes([])
    ctx.edicion.ajustar([439240, 4479655], { recinto: 0, indice: 0 })
    expect(dianasDe).toHaveBeenCalledTimes(2)
    ctx.limpiar()
  })

  it('cambiar τ o apagar el snap NO invalida el catálogo (no depende de la tolerancia)', () => {
    const ctx = montar()
    dianasDe.mockClear()
    ctx.edicion.ajustar([439240, 4479655], { recinto: 0, indice: 0 })
    ctx.edicion.tolerancia(0.75)
    ctx.edicion.snapActivo(false)
    ctx.edicion.snapActivo(true)
    ctx.edicion.ajustar([439240, 4479655], { recinto: 0, indice: 0 })
    expect(dianasDe).toHaveBeenCalledTimes(1)
    ctx.limpiar()
  })
})

// ── Colindantes ──────────────────────────────────────────────────────────────

describe('viewer/edicion · colindantes como dianas', () => {
  it('un recinto vecino aporta dianas de enganche', () => {
    const ctx = montar()
    // Antes: nada dentro de τ a 3 m al oeste del vértice 0.
    expect(ctx.edicion.ajustar([439237, 4479655], { recinto: 0, indice: 0 }).enganchado).toBe(false)

    ctx.edicion.fijarColindantes([
      crearRecinto(
        [
          [439237, 4479655],
          [439230, 4479655],
          [439230, 4479670],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
    ])
    const r = ctx.edicion.ajustar([439237.1, 4479655], { recinto: 0, indice: 0 })
    expect(r.enganchado).toBe(true)
    expect(r.tipo).toBe('VERTICE')
    expect(r.punto).toEqual([439237, 4479655])
    ctx.limpiar()
  })

  it('pasar PARCELAS en vez de recintos lanza diciendo cómo aplanarlas (no se traga en silencio)', () => {
    const ctx = montar()
    expect(() => ctx.edicion.fijarColindantes([{ recintos: [] }])).toThrow(TypeError)
    expect(() => ctx.edicion.fijarColindantes([{ recintos: [] }])).toThrow(/flatMap/)
    ctx.limpiar()
  })
})

// ── El indicador de enganche ─────────────────────────────────────────────────

describe('viewer/edicion · indicador de enganche', () => {
  it('aparece al enganchar, distingue VERTICE de LINDERO y nunca es interactivo', () => {
    const ctx = montar()
    expect(indicadorDe(ctx.mapa)).toBeNull()

    ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })
    const enVertice = indicadorDe(ctx.mapa)
    expect(enVertice).not.toBeNull()
    expect(enVertice.options.interactive).toBe(false)
    // Se afirma sobre el ELEMENTO del DOM, no sobre las opciones de Leaflet: la
    // clase del `divIcon` es lo que ven `estilos/app.css` y el guion de navegador,
    // y es lo único que garantiza que la silueta llegó a pintarse.
    expect(enVertice.getElement().className).toContain(CLASE_EDICION.INDICADOR)
    expect(enVertice.getElement().className).toContain(CLASE_EDICION.INDICADOR_VERTICE)

    ctx.edicion.ajustar([439250, 4479669.9], { recinto: 0, indice: 0 })
    const enLindero = indicadorDe(ctx.mapa)
    expect(enLindero.getElement().className).toContain(CLASE_EDICION.INDICADOR_LINDERO)
    expect(enLindero.getElement().className).not.toContain(CLASE_EDICION.INDICADOR_VERTICE)
    // Un solo indicador vivo: el de LINDERO sustituyó al de VÉRTICE, no se sumó.
    expect(ctx.mapa.getContainer().querySelectorAll(`.${CLASE_EDICION.INDICADOR}`)).toHaveLength(1)
    ctx.limpiar()
  })

  it('la SILUETA distingue los dos tipos, no el relleno ni el tamaño (convención OSNAP)', () => {
    // La razón de ser del indicador: el usuario tiene que saber DE UN VISTAZO si ha
    // capturado un vértice exacto o un punto cualquiera del lindero, a mitad de un
    // arrastre y sobre una ortofoto de contraste arbitrario. Dos círculos que solo se
    // diferencian en el relleno no lo consiguen; dos siluetas distintas, sí. Este
    // test afirma la DIFERENCIA DE FORMA, que es lo que se puede comprobar sin ojos.
    const ctx = montar()

    ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })
    const svgVertice = indicadorDe(ctx.mapa).getElement().innerHTML
    ctx.edicion.ajustar([439250, 4479669.9], { recinto: 0, indice: 0 })
    const svgLindero = indicadorDe(ctx.mapa).getElement().innerHTML

    // VÉRTICE = cuadrado (el «Punto final» de AutoCAD): un punto discreto.
    expect(svgVertice).toContain('<rect')
    expect(svgVertice).not.toContain('<polygon')
    // LINDERO = reloj de arena (su «Cercano»): el punto desliza sobre la línea.
    expect(svgLindero).toContain('<polygon')
    expect(svgLindero).not.toContain('<rect')
    expect(svgVertice).not.toBe(svgLindero)

    // Y las dos siluetas llevan el trazo DOBLE (halo oscuro debajo, color encima):
    // sin él el amarillo desaparece sobre hormigón claro (~1,4:1 de contraste).
    for (const svg of [svgVertice, svgLindero]) {
      expect(svg.match(/stroke=/g), 'trazo doble: halo + color').toHaveLength(2)
      expect(svg).toContain(COLOR_USUARIO)
    }
    ctx.limpiar()
  })

  it('desaparece cuando el punto sale de τ y cuando se apaga el snap', () => {
    const ctx = montar()
    ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })
    expect(indicadorDe(ctx.mapa)).not.toBeNull()

    // Lejos de todo: del lindero sur (3 m), del oeste (4 m) y del hueco (4,5 m).
    ctx.edicion.ajustar([439244, 4479658], { recinto: 0, indice: 0 })
    expect(indicadorDe(ctx.mapa)).toBeNull()

    ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })
    expect(indicadorDe(ctx.mapa)).not.toBeNull()
    ctx.edicion.snapActivo(false)
    expect(indicadorDe(ctx.mapa)).toBeNull()
    ctx.limpiar()
  })

  it('⚠️ va POR ENCIMA de las acotaciones y el resalte, por debajo de nada', () => {
    // Regresión encontrada MIRÁNDOLO en el navegador (2026-07-28), no aquí: con el
    // indicador en el pane de la geometría editada (420), un enganche a LINDERO
    // cerca del centro de un lado quedaba tapado por su ACOTACIÓN —pane 425, y se
    // pinta justo en el punto medio del lado, que es donde más cae ese enganche—.
    // El indicador dejaba de hacer su único trabajo en su caso más frecuente.
    // El resalte SÍ se queda abajo, y por el motivo contrario: es un trazo grueso
    // que taparía los vértices sobre los que hay que seguir pinchando.
    const ctx = montar()
    ctx.edicion.ajustar([439250, 4479669.9], { recinto: 0, indice: 0 })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })

    const zIndexDe = (nombre) => Number(ctx.mapa.getPane(nombre).style.zIndex)
    const paneIndicador = indicadorDe(ctx.mapa).options.pane
    const paneResalte = resalteDe(ctx.mapa).options.pane

    expect(zIndexDe(paneIndicador)).toBeGreaterThan(zIndexDe(PANE.ACOTACIONES))
    expect(zIndexDe(paneIndicador)).toBeGreaterThan(zIndexDe(paneResalte))
    expect(zIndexDe(paneResalte)).toBeLessThan(zIndexDe(PANE.VERTICES))
    ctx.limpiar()
  })

  it('el `dragend` del marcador lo retira (el indicador es del GESTO)', () => {
    const ctx = montar()
    const marcador = marcadorCableado(ctx, V.A, { recinto: 0, indice: 0 })
    ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })
    expect(indicadorDe(ctx.mapa)).not.toBeNull()
    marcador.fire('dragend')
    expect(indicadorDe(ctx.mapa)).toBeNull()
    ctx.limpiar()
  })
})

// ── CA 1 · Insertar ──────────────────────────────────────────────────────────

describe('viewer/edicion · insertarEn (CA 1)', () => {
  it('inserta el PIE sobre el lado, no el punto crudo del clic, y hace un set y UN commit', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    const antes = ctx.store.get()

    // 40 cm por dentro del lindero sur, a mitad de lado.
    const r = ctx.edicion.insertarEn(aLatLng([439250, 4479655.4]))
    expect(r.aplicado).toBe(true)
    expect(r.ref).toEqual({ recinto: 0, indice: 1 })

    const anillo = anilloDe(ctx.store)
    expect(anillo).toHaveLength(5)
    // El vértice nuevo está SOBRE el lado (y = 4479655), no en el punto pinchado.
    expect(anillo[1][0]).toBeCloseTo(439250, 2)
    expect(anillo[1][1]).toBeCloseTo(4479655, 2)
    expect(ctx.store.get()).not.toBe(antes)
    expect(historial.pila).toHaveLength(1)
    ctx.limpiar()
  })

  it('no toca `geometriaOficial` (regla de oro 2)', () => {
    const ctx = montar({ parcela: parcelaCon([V.A, V.B, V.C, V.D], { geometriaOficial: [V.A, V.B, V.C, V.D] }) })
    const oficialAntes = structuredClone(ctx.store.get().geometriaOficial)
    ctx.edicion.insertarEn(aLatLng([439250, 4479655.2]))
    expect(anilloDe(ctx.store)).toHaveLength(5)
    expect(ctx.store.get().geometriaOficial).toEqual(oficialAntes)
    ctx.limpiar()
  })

  it('si el clic cae más allá del umbral de PUNTERÍA no inserta: avisa con ERROR y no commitea', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    const antes = ctx.store.get()

    const r = ctx.edicion.insertarEn(aLatLng([439280, 4479690]))
    expect(r).toEqual({ aplicado: false, ref: null })
    expect(ctx.store.get()).toBe(antes)
    expect(historial.pila).toHaveLength(0)
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    expect(mensajesDe(ctx.alAvisar)[0]).toContain(`${UMBRAL_PUNTERIA_PX} px`)
    ctx.limpiar()
  })

  it('si el pie cae en un EXTREMO no inserta (habría dos vértices en la misma coordenada)', () => {
    const ctx = montar()
    const antes = ctx.store.get()
    const r = ctx.edicion.insertarEn(aLatLng([439239.9, 4479654.9]))
    expect(r).toEqual({ aplicado: false, ref: null })
    expect(ctx.store.get()).toBe(antes)
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    expect(mensajesDe(ctx.alAvisar)[0]).toMatch(/vértice 1 de EXTERIOR/)
    ctx.limpiar()
  })

  it('sin geometría cargada avisa con ERROR y no escribe nada', () => {
    const ctx = montar({ parcela: null })
    const r = ctx.edicion.insertarEn(aLatLng([439250, 4479655]))
    expect(r).toEqual({ aplicado: false, ref: null })
    expect(ctx.store.get()).toBeNull()
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    ctx.limpiar()
  })

  it('inserta también en un HUECO (los recintos interiores no son un caso aparte)', () => {
    const ctx = montar()
    // 10 cm por fuera del lindero norte del hueco (y = 4479664, x ∈ [439248, 439252]).
    const r = ctx.edicion.insertarEn(aLatLng([439250, 4479664.1]))
    expect(r.aplicado).toBe(true)
    expect(r.ref.recinto).toBe(1)
    expect(anilloDe(ctx.store, 1)).toHaveLength(5)
    expect(anilloDe(ctx.store, 0)).toHaveLength(4)
    ctx.limpiar()
  })
})

// ── CA 1 · Eliminar ──────────────────────────────────────────────────────────

describe('viewer/edicion · eliminar (CA 1)', () => {
  it('elimina el vértice, hace un set y UN commit', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    const r = ctx.edicion.eliminar({ recinto: 0, indice: 1 })
    expect(r).toEqual({ aplicado: true, motivo: null })
    expect(anilloDe(ctx.store)).toEqual([V.A, V.C, V.D])
    expect(historial.pila).toHaveLength(1)
    ctx.limpiar()
  })

  it('se niega a dejar el anillo por debajo de 3 vértices y PUBLICA el texto de edit/vertices', () => {
    const historial = crearHistorial()
    const ctx = montar({ parcela: parcelaCon([V.A, V.B, V.C]), historial })
    const r = ctx.edicion.eliminar({ recinto: 0, indice: 0 })
    expect(r).toEqual({ aplicado: false, motivo: MOTIVO_VERTICE.MINIMO_TRES_VERTICES })
    expect(anilloDe(ctx.store)).toHaveLength(3)
    expect(historial.pila).toHaveLength(0)
    // Texto VERBATIM del módulo que decidió la regla, no una redacción de la UI.
    expect(mensajesDe(ctx.alAvisar)).toEqual([
      MENSAJE_POR_MOTIVO[MOTIVO_VERTICE.MINIMO_TRES_VERTICES],
    ])
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    ctx.limpiar()
  })

  it('una referencia que ya no existe avisa con ERROR y no escribe', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    const antes = ctx.store.get()
    expect(ctx.edicion.eliminar({ recinto: 0, indice: 7 })).toEqual({
      aplicado: false,
      motivo: null,
    })
    expect(ctx.store.get()).toBe(antes)
    expect(historial.pila).toHaveLength(0)
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    ctx.limpiar()
  })

  it('se dispara con el menú contextual del marcador, evitando el menú del navegador', () => {
    const ctx = montar()
    const marcador = marcadorCableado(ctx, V.B, { recinto: 0, indice: 1 })
    const preventDefault = vi.fn()
    marcador.fire('contextmenu', { originalEvent: { preventDefault } })

    expect(preventDefault).toHaveBeenCalledTimes(1)
    expect(anilloDe(ctx.store)).toEqual([V.A, V.C, V.D])
    ctx.limpiar()
  })
})

// ── CA 3 · Offset del lado seleccionado ──────────────────────────────────────

describe('viewer/edicion · desplazarSeleccion (CA 3)', () => {
  it('desplaza el lado seleccionado en paralelo, con modo MITER y sin detecciones', () => {
    const historial = crearHistorial()
    const ctx = montar({ parcela: parcelaCon([V.A, V.B, V.C, V.D]), historial })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })

    const r = ctx.edicion.desplazarSeleccion(1)
    expect(r.aplicado).toBe(true)
    expect(r.modo).toBe(MODO_OFFSET.MITER)
    expect(r.detecciones).toEqual([])
    // `> 0` aleja el lado del interior de SU anillo: el lindero sur baja 1 m.
    expect(anilloDe(ctx.store)).toEqual([
      [439240, 4479654],
      [439260, 4479654],
      V.C,
      V.D,
    ])
    expect(historial.pila).toHaveLength(1)
    expect(ctx.alAvisar).not.toHaveBeenCalled()
    ctx.limpiar()
  })

  it('sin lado seleccionado no desplaza nada y avisa con ERROR', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    expect(ctx.edicion.desplazarSeleccion(1)).toEqual({
      aplicado: false,
      modo: null,
      detecciones: [],
    })
    expect(historial.pila).toHaveLength(0)
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    ctx.limpiar()
  })

  it('distancia 0: NO se aplica, se publica el texto de edit/offset y con NIVEL.ERROR', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    const antes = ctx.store.get()

    const r = ctx.edicion.desplazarSeleccion(0)
    expect(r.aplicado).toBe(false)
    expect(r.detecciones.map((d) => d.tipo)).toEqual([TIPO_OFFSET.SIN_DESPLAZAMIENTO])
    expect(mensajesDe(ctx.alAvisar)).toEqual([r.detecciones[0].mensaje])
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    // Sin cambio real no hay ni `set` ni `commit`: un historial de snapshots
    // idénticos es basura.
    expect(ctx.store.get()).toBe(antes)
    expect(historial.pila).toHaveLength(0)
    ctx.limpiar()
  })

  it('esquina demasiado aguda: BISELA, lo cuenta con NIVEL.AVISO y suelta la selección', () => {
    const historial = crearHistorial()
    const ctx = montar({ parcela: parcelaCon(TRIANGULO_AGUDO), historial })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })

    const r = ctx.edicion.desplazarSeleccion(1)
    expect(r.aplicado).toBe(true)
    expect(r.modo).toBe(MODO_OFFSET.BEVEL)
    expect(r.detecciones.map((d) => d.tipo)).toEqual([
      TIPO_OFFSET.EXTREMO_BISELADO,
      TIPO_OFFSET.EXTREMO_BISELADO,
    ])
    // Aplicado (aunque degradado) ⇒ AVISO, no ERROR.
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.AVISO, NIVEL.AVISO])
    expect(mensajesDe(ctx.alAvisar)).toEqual(r.detecciones.map((d) => d.mensaje))
    // El bisel añade vértices: el índice del lado ya no señala el mismo lindero,
    // así que el resalte se suelta en vez de mentir.
    expect(anilloDe(ctx.store)).toHaveLength(5)
    expect(ctx.edicion.ladoSeleccionado()).toBeNull()
    expect(resalteDe(ctx.mapa)).toBeNull()
    expect(historial.pila).toHaveLength(1)
    ctx.limpiar()
  })

  it('una distancia que no es un número finito es contrato del PROGRAMADOR: lanza', () => {
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    expect(() => ctx.edicion.desplazarSeleccion(Number.NaN)).toThrow(TypeError)
    expect(() => ctx.edicion.desplazarSeleccion('1')).toThrow(TypeError)
    ctx.limpiar()
  })

  it('si el lado seleccionado ya no existe, avisa con ERROR y suelta la selección', () => {
    const ctx = montar({ parcela: parcelaCon([V.A, V.B, V.C, V.D]) })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 3 })
    // Otra vista carga una parcela más pequeña: el índice 3 deja de existir.
    ctx.store.set(parcelaCon([V.A, V.B, V.C]))
    expect(ctx.edicion.ladoSeleccionado()).toBeNull()

    expect(ctx.edicion.desplazarSeleccion(1).aplicado).toBe(false)
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    ctx.limpiar()
  })
})

// ── Selección y resalte ──────────────────────────────────────────────────────

describe('viewer/edicion · selección del lado y su resalte', () => {
  it('`seleccionarLado` pinta una polilínea NO interactiva sobre el lado, y `null` la retira', () => {
    const ctx = montar()
    expect(resalteDe(ctx.mapa)).toBeNull()

    expect(ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })).toEqual({
      recinto: 0,
      indice: 0,
    })
    const resalte = resalteDe(ctx.mapa)
    expect(resalte).not.toBeNull()
    expect(resalte.options.interactive).toBe(false)
    expect(resalte.options.className).toBe(CLASE_EDICION.RESALTE)

    const [a, b] = resalte.getLatLngs()
    expect(a.lat).toBeCloseTo(aLatLng(V.A)[0], 9)
    expect(b.lng).toBeCloseTo(aLatLng(V.B)[1], 9)

    expect(ctx.edicion.seleccionarLado(null)).toBeNull()
    expect(resalteDe(ctx.mapa)).toBeNull()
    expect(ctx.edicion.ladoSeleccionado()).toBeNull()
    ctx.limpiar()
  })

  it('el lado de CIERRE (último índice) se selecciona sin caso especial', () => {
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 3 })
    const [a, b] = resalteDe(ctx.mapa).getLatLngs()
    expect(a.lat).toBeCloseTo(aLatLng(V.D)[0], 9)
    expect(b.lat).toBeCloseTo(aLatLng(V.A)[0], 9)
    ctx.limpiar()
  })

  it('`alCambiarSeleccion` notifica los cambios (y solo los cambios), y da de baja', () => {
    const ctx = montar()
    const oyente = vi.fn()
    const baja = ctx.edicion.alCambiarSeleccion(oyente)

    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 }) // idéntica: no notifica
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 2 })
    ctx.edicion.seleccionarLado(null)
    expect(oyente.mock.calls.map(([r]) => r)).toEqual([
      { recinto: 0, indice: 0 },
      { recinto: 0, indice: 2 },
      null,
    ])

    baja()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 1 })
    expect(oyente).toHaveBeenCalledTimes(3)
    ctx.limpiar()
  })

  it('seleccionar un lado que no existe avisa con ERROR y deja la selección vacía', () => {
    const ctx = montar()
    expect(ctx.edicion.seleccionarLado({ recinto: 0, indice: 9 })).toBeNull()
    expect(nivelesDe(ctx.alAvisar)).toEqual([NIVEL.ERROR])
    expect(resalteDe(ctx.mapa)).toBeNull()
    ctx.limpiar()
  })

  it('el resalte se actualiza cuando cambia el estado', () => {
    const ctx = montar({ parcela: parcelaCon([V.A, V.B, V.C, V.D]) })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    const antes = resalteDe(ctx.mapa).getLatLngs()[0].lat

    ctx.store.set(parcelaCon([[439240, 4479600], V.B, V.C, V.D]))
    const despues = resalteDe(ctx.mapa).getLatLngs()[0].lat
    expect(despues).not.toBeCloseTo(antes, 6)
    expect(despues).toBeCloseTo(aLatLng([439240, 4479600])[0], 9)
    ctx.limpiar()
  })

  it('durante el arrastre el resalte sigue al vértice, aunque el store aún no haya cambiado', () => {
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    const marcador = marcadorCableado(ctx, V.A, { recinto: 0, indice: 0 })

    const nueva = aLatLng([439241, 4479656])
    marcador.setLatLng(nueva)
    marcador.fire('drag')

    const [a] = resalteDe(ctx.mapa).getLatLngs()
    expect(a.lat).toBeCloseTo(nueva[0], 9)
    // El modelo NO se ha tocado: el arrastre solo escribe en el `dragend`, y de eso
    // es dueño `viewer/sincronizacion.js`.
    expect(anilloDe(ctx.store)[0]).toEqual(V.A)
    ctx.limpiar()
  })

  it('insertar por delante del lado resaltado reubica la selección (el resalte no salta de lado)', () => {
    const ctx = montar({ parcela: parcelaCon([V.A, V.B, V.C, V.D]) })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 2 })
    const antes = resalteDe(ctx.mapa).getLatLngs().map((p) => [p.lat, p.lng])

    // Inserta en el lado 0, que va por delante del resaltado.
    expect(ctx.edicion.insertarEn(aLatLng([439250, 4479655.2])).aplicado).toBe(true)
    expect(ctx.edicion.ladoSeleccionado()).toEqual({ recinto: 0, indice: 3 })

    const despues = resalteDe(ctx.mapa).getLatLngs().map((p) => [p.lat, p.lng])
    expect(despues[0][0]).toBeCloseTo(antes[0][0], 9)
    expect(despues[1][1]).toBeCloseTo(antes[1][1], 9)
    ctx.limpiar()
  })

  it('eliminar el vértice que ABRE el lado resaltado suelta la selección', () => {
    const ctx = montar({ parcela: parcelaCon([V.A, V.B, V.C, V.D]) })
    const oyente = vi.fn()
    ctx.edicion.alCambiarSeleccion(oyente)
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 1 })

    expect(ctx.edicion.eliminar({ recinto: 0, indice: 1 }).aplicado).toBe(true)
    expect(ctx.edicion.ladoSeleccionado()).toBeNull()
    expect(oyente.mock.calls.at(-1)[0]).toBeNull()
    ctx.limpiar()
  })
})

// ── El mapa de gestos ────────────────────────────────────────────────────────

describe('viewer/edicion · mapa de gestos (clic ≠ doble clic ≠ contextmenu)', () => {
  it('el CLIC selecciona el lindero más cercano y NUNCA escribe en el modelo', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    const antes = ctx.store.get()

    ctx.mapa.fire('click', { latlng: L.latLng(aLatLng([439250, 4479655.3])) })
    expect(ctx.edicion.ladoSeleccionado()).toEqual({ recinto: 0, indice: 0 })
    // La garantía de la fase: un clic normal no tiene efectos sorpresa.
    expect(ctx.store.get()).toBe(antes)
    expect(historial.pila).toHaveLength(0)
    ctx.limpiar()
  })

  it('el CLIC lejos de cualquier lindero deselecciona, y no avisa de nada', () => {
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    ctx.mapa.fire('click', { latlng: L.latLng(aLatLng([439280, 4479690])) })
    expect(ctx.edicion.ladoSeleccionado()).toBeNull()
    expect(resalteDe(ctx.mapa)).toBeNull()
    expect(ctx.alAvisar).not.toHaveBeenCalled()
    ctx.limpiar()
  })

  it('el DOBLE CLIC inserta (y es el único gesto del mapa que escribe)', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    const preventDefault = vi.fn()
    ctx.mapa.fire('dblclick', {
      latlng: L.latLng(aLatLng([439250, 4479655.3])),
      originalEvent: { preventDefault },
    })
    expect(anilloDe(ctx.store)).toHaveLength(5)
    expect(historial.pila).toHaveLength(1)
    expect(preventDefault).toHaveBeenCalled()
    ctx.limpiar()
  })

  it('desactiva `doubleClickZoom` mientras vive y lo restaura al destruir', () => {
    const { mapa, destruir } = montarMapa({ zoom: ZOOM })
    expect(mapa.doubleClickZoom.enabled()).toBe(true)
    const edicion = crearEdicion({ mapa, estado: crearEstadoVista(parcelaConHueco()), zona: HUSO })
    expect(mapa.doubleClickZoom.enabled()).toBe(false)
    edicion.destruir()
    expect(mapa.doubleClickZoom.enabled()).toBe(true)
    destruir()
  })
})

// ── El MODO BORRAR (2026-08-10) ──────────────────────────────────────────────
//
// La única excepción a la garantía «un clic sencillo NUNCA escribe en el modelo»,
// y por eso su bloque de pruebas es el más desconfiado del fichero: lo que se
// vigila no es tanto que borre —eso es `eliminar`, que ya tiene su bloque— como
// que **no se quede armado sin que nadie se entere**.

describe('viewer/edicion · el modo borrar', () => {
  /** El punto del vértice 0 del exterior de `parcelaConHueco`, en latlng. */
  const enElVertice = (utm) => ({ latlng: L.latLng(aLatLng(utm)) })

  it('nace apagado y `modoBorrar(true)` lo enciende, avisando a quien se suscriba', () => {
    const ctx = montar()
    const visto = []
    ctx.edicion.alCambiarModoBorrar((activo) => visto.push(activo))

    expect(ctx.edicion.modoBorrar()).toBe(false)
    expect(ctx.edicion.modoBorrar(true)).toBe(true)
    expect(visto).toEqual([true])

    // Un anuncio por CAMBIO real, no por llamada: quien pinta un botón con esto no
    // puede recibir «true» dos veces seguidas por lo mismo.
    ctx.edicion.modoBorrar(true)
    expect(visto).toEqual([true])
    ctx.limpiar()
  })

  it('⭐ armado, el CLIC borra el vértice más cercano en vez de seleccionar lindero', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    const antes = anilloDe(ctx.store).length
    ctx.edicion.modoBorrar(true)

    ctx.mapa.fire('click', enElVertice(V.A))

    expect(anilloDe(ctx.store)).toHaveLength(antes - 1)
    expect(historial.pila, 'borrar es una operación acabada: un commit').toHaveLength(1)
    expect(ctx.edicion.ladoSeleccionado(), 'el clic ya no selecciona linderos').toBeNull()
    ctx.limpiar()
  })

  it('NO se apaga solo tras borrar: borrar ocho seguidos es su caso de uso', () => {
    const ctx = montar()
    ctx.edicion.modoBorrar(true)
    ctx.mapa.fire('click', enElVertice(V.A))
    expect(ctx.edicion.modoBorrar()).toBe(true)
    ctx.limpiar()
  })

  it('el clic LEJOS de todo vértice no borra nada, y lo dice', () => {
    const ctx = montar()
    const antes = anilloDe(ctx.store).length
    ctx.edicion.modoBorrar(true)

    ctx.mapa.fire('click', { latlng: L.latLng(aLatLng([439280, 4479690])) })

    expect(anilloDe(ctx.store)).toHaveLength(antes)
    // ⚠️ Aquí SÍ se avisa, al revés que el clic en el vacío con el modo apagado
    // (aquél DESELECCIONA, que es un efecto visible; este no hace nada). Un modo
    // armado que se traga un clic en silencio es indistinguible de uno apagado.
    expect(mensajesDe(ctx.alAvisar).join(' ')).toMatch(/no se ha borrado/i)
    ctx.limpiar()
  })

  it('⛔ el DOBLE CLIC no inserta mientras el modo está armado', () => {
    // Un doble clic contiene dos clics: sin la guarda el gesto sería «borra, borra,
    // e inserta uno nuevo» — tres escrituras contradictorias con un solo gesto.
    const ctx = montar()
    ctx.edicion.modoBorrar(true)
    const antes = anilloDe(ctx.store).length

    ctx.mapa.fire('dblclick', {
      latlng: L.latLng(aLatLng([439250, 4479655.3])),
      originalEvent: { preventDefault: vi.fn() },
    })

    expect(anilloDe(ctx.store).length, 'no ha insertado').toBeLessThanOrEqual(antes)
    expect(
      anilloDe(ctx.store).some((v) => Math.abs(v[0] - 439250) < 1 && Math.abs(v[1] - 4479655.3) < 1),
      'el vértice del doble clic NO está en el anillo',
    ).toBe(false)
    ctx.limpiar()
  })

  it('encenderlo SUELTA la selección de lindero (el clic ya no la puede cambiar)', () => {
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    expect(resalteDe(ctx.mapa)).not.toBeNull()

    ctx.edicion.modoBorrar(true)

    expect(ctx.edicion.ladoSeleccionado()).toBeNull()
    expect(resalteDe(ctx.mapa), 'un resalte que ya no promete nada').toBeNull()
    ctx.limpiar()
  })

  it('`Escape` lo apaga, y sin robarle la tecla a nadie', () => {
    const ctx = montar()
    ctx.edicion.modoBorrar(true)

    const evento = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.dispatchEvent(evento)

    expect(ctx.edicion.modoBorrar()).toBe(false)
    // Sin `preventDefault`: cancelar un modo propio no puede consumir `Escape` para
    // el diálogo que hubiera abierto encima.
    expect(evento.defaultPrevented).toBe(false)
    ctx.limpiar()
  })

  it('`Escape` con el modo apagado no hace nada (la tecla sigue siendo de otros)', () => {
    const ctx = montar()
    const visto = []
    ctx.edicion.alCambiarModoBorrar((activo) => visto.push(activo))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(visto).toEqual([])
    ctx.limpiar()
  })

  it('⛔ `activa(false)` lo apaga: un modo destructivo NO sobrevive al cambio de pantalla', () => {
    // El accidente que esto impide: el usuario arma el modo, se va a Diagnóstico,
    // vuelve media hora después, pincha para mirar algo y borra un vértice.
    const ctx = montar()
    const visto = []
    ctx.edicion.alCambiarModoBorrar((activo) => visto.push(activo))
    ctx.edicion.modoBorrar(true)

    ctx.edicion.activa(false)

    expect(ctx.edicion.modoBorrar()).toBe(false)
    expect(visto, 'y se anuncia, para que el botón de la barra se levante').toEqual([true, false])
    ctx.limpiar()
  })

  it('pone y quita la clase del CURSOR en el contenedor del mapa', () => {
    const ctx = montar()
    const contenedor = ctx.mapa.getContainer()

    ctx.edicion.modoBorrar(true)
    expect(contenedor.classList.contains(CLASE_EDICION.MODO_BORRAR)).toBe(true)
    ctx.edicion.modoBorrar(false)
    expect(contenedor.classList.contains(CLASE_EDICION.MODO_BORRAR)).toBe(false)
    ctx.limpiar()
  })

  it('⛔ `destruir()` quita la clase: si no, queda un modo FANTASMA', () => {
    // Cursor de borrar puesto y nadie atendiendo el clic. Peor que dejarlo armado,
    // porque no hay forma de apagarlo.
    const ctx = montar()
    const contenedor = ctx.mapa.getContainer()
    ctx.edicion.modoBorrar(true)

    ctx.edicion.destruir()

    expect(contenedor.classList.contains(CLASE_EDICION.MODO_BORRAR)).toBe(false)
    expect(ctx.edicion.modoBorrar()).toBe(false)
  })

  it('tras `destruir()` no se puede volver a armar', () => {
    const ctx = montar()
    ctx.edicion.destruir()
    expect(ctx.edicion.modoBorrar(true)).toBe(false)
  })

  it('contrato roto por el programador → throw', () => {
    const ctx = montar()
    expect(() => ctx.edicion.modoBorrar('sí')).toThrow(TypeError)
    expect(() => ctx.edicion.alCambiarModoBorrar('no soy una función')).toThrow(TypeError)
    // Y leer no escribe.
    expect(ctx.edicion.modoBorrar()).toBe(false)
    ctx.limpiar()
  })

  it('la baja del suscriptor lo desengancha', () => {
    const ctx = montar()
    const visto = []
    const baja = ctx.edicion.alCambiarModoBorrar((activo) => visto.push(activo))
    baja()
    ctx.edicion.modoBorrar(true)
    expect(visto).toEqual([])
    ctx.limpiar()
  })
})

// ── Panes ────────────────────────────────────────────────────────────────────

describe('viewer/edicion · panes', () => {
  it('usa el pane de la geometría editada cuando existe (por debajo de los vértices)', () => {
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    expect(resalteDe(ctx.mapa).options.pane).toBe('parcelaEditada')
    ctx.limpiar()
  })

  it('sobre un mapa SIN los panes del visor no revienta: cae al overlayPane', () => {
    const ctx = montar({ conPanes: false })
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    const resalte = resalteDe(ctx.mapa)
    expect(resalte).not.toBeNull()
    // El defecto de Leaflet para un `Path`: sigue estando por DEBAJO del
    // `markerPane` (600), así que los vértices no quedan tapados igualmente.
    expect(resalte.options.pane).toBe('overlayPane')
    ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })
    expect(indicadorDe(ctx.mapa)).not.toBeNull()
    ctx.limpiar()
  })
})

// ── destruir() ───────────────────────────────────────────────────────────────

describe('viewer/edicion · destruir', () => {
  it('es idempotente y retira todas sus capas', () => {
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })
    expect(resalteDe(ctx.mapa)).not.toBeNull()
    expect(indicadorDe(ctx.mapa)).not.toBeNull()

    ctx.edicion.destruir()
    ctx.edicion.destruir()
    expect(resalteDe(ctx.mapa)).toBeNull()
    expect(indicadorDe(ctx.mapa)).toBeNull()
    ctx.limpiar()
  })

  it('retira los oyentes del mapa: un clic ya no selecciona nada', () => {
    const ctx = montar()
    ctx.edicion.destruir()
    ctx.mapa.fire('click', { latlng: L.latLng(aLatLng([439250, 4479655.3])) })
    // `originalEvent` completo porque al destruir se ha RESTAURADO el
    // `doubleClickZoom` de Leaflet, que vuelve a mirar el evento del navegador.
    ctx.mapa.fire('dblclick', {
      latlng: L.latLng(aLatLng([439250, 4479655.3])),
      containerPoint: L.point(400, 300),
      originalEvent: { preventDefault: vi.fn(), shiftKey: false },
    })
    expect(ctx.edicion.ladoSeleccionado()).toBeNull()
    expect(anilloDe(ctx.store)).toHaveLength(4)
    ctx.limpiar()
  })

  it('se da de baja del store: un `set` posterior no repinta ni revienta', () => {
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    ctx.edicion.destruir()
    expect(() => ctx.store.set(parcelaCon([V.A, V.B, V.C]))).not.toThrow()
    expect(resalteDe(ctx.mapa)).toBeNull()
    ctx.limpiar()
  })

  it('tras destruir, ninguna operación revienta ni escribe en el modelo', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    ctx.edicion.destruir()
    const antes = ctx.store.get()

    expect(ctx.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })).toBeNull()
    expect(ctx.edicion.insertarEn(aLatLng([439250, 4479655.2]))).toEqual({
      aplicado: false,
      ref: null,
    })
    expect(ctx.edicion.eliminar({ recinto: 0, indice: 1 })).toEqual({
      aplicado: false,
      motivo: null,
    })
    expect(ctx.edicion.desplazarSeleccion(1)).toEqual({
      aplicado: false,
      modo: null,
      detecciones: [],
    })
    expect(ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })).toBeNull()
    expect(() => ctx.edicion.fijarColindantes([])).not.toThrow()
    expect(() =>
      ctx.edicion.alCrearMarcador(L.marker(aLatLng(V.A)), { recinto: 0, indice: 0 }),
    ).not.toThrow()

    expect(ctx.store.get()).toBe(antes)
    expect(historial.pila).toHaveLength(0)
    expect(ctx.alAvisar).not.toHaveBeenCalled()
    ctx.limpiar()
  })

  it('retira el seguimiento de teclado del documento', () => {
    const ctx = montar()
    const otro = montar()
    ctx.edicion.destruir()
    // La instancia viva sigue viendo la tecla; la destruida ya no escucha nada, y
    // eso se comprueba porque no queda ningún rastro suyo en el mapa.
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }))
    expect(otro.edicion.ajustar([439259.9, 4479655], { recinto: 0, indice: 0 })).toBeNull()
    expect(indicadorDe(ctx.mapa)).toBeNull()
    otro.limpiar()
    ctx.limpiar()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Rework de UI · REBANADA 3 — Edición pasa a ser un paso de verdad
// ═══════════════════════════════════════════════════════════════════════════
//
// ⛔ EL DEFECTO QUE ESTO CIERRA, MEDIDO EN CHROME EL 2026-08-04: los cuatro
// gestos de edición del mapa —arrastrar, borrar con el botón derecho, insertar
// con doble clic y seleccionar un lindero— estaban vivos en las CUATRO
// pantallas. **15 de 15 marcadores arrastrables en Validación**, exactamente los
// mismos que en Edición. El peldaño «Edición» del rail no cambiaba nada de lo
// que se podía hacer.
//
// Este módulo no sabe nada de navegación (criterio 1 del plan) y por eso el
// interruptor nace en `true`: quien lo conmuta es el aplicador de `app/main.js`.
describe('viewer/edicion · `activa()`, el interruptor de los cuatro gestos', () => {
  it('nace ENCENDIDA: un visor sin aplicador se comporta como antes', () => {
    const ctx = montar()
    expect(ctx.edicion.activa()).toBe(true)
    ctx.limpiar()
  })

  it('apagarla quita el arrastre de los marcadores YA creados', () => {
    // Apagar el oyente de `drag` no bastaría: quien mueve el icono es
    // `L.Draggable` por CSS, así que el vértice se movería en pantalla aunque el
    // modelo no se enterara — el peor de los dos mundos.
    const ctx = montar()
    const marcador = marcadorCableado(ctx, V.A, { recinto: 0, indice: 0 })
    expect(marcador.dragging.enabled()).toBe(true)

    expect(ctx.edicion.activa(false)).toBe(false)
    expect(marcador.dragging.enabled()).toBe(false)

    ctx.edicion.activa(true)
    expect(marcador.dragging.enabled()).toBe(true)
    ctx.limpiar()
  })

  it('un marcador que NACE con la edición apagada no se arrastra', () => {
    // Los marcadores se rehacen en cada `sincronizar`: sin esto, cargar una
    // parcela estando en Validación devolvería 15 vértices arrastrables.
    const ctx = montar()
    ctx.edicion.activa(false)
    const marcador = marcadorCableado(ctx, V.A, { recinto: 0, indice: 0 })
    expect(marcador.dragging.enabled()).toBe(false)
    ctx.limpiar()
  })

  it('apagada, el BOTÓN DERECHO ya no borra un vértice', () => {
    const ctx = montar()
    const marcador = marcadorCableado(ctx, V.A, { recinto: 0, indice: 0 })
    const antes = anilloDe(ctx.store).length
    ctx.edicion.activa(false)

    marcador.fire('contextmenu', { originalEvent: { preventDefault: vi.fn() } })
    expect(anilloDe(ctx.store)).toHaveLength(antes)
    ctx.limpiar()
  })

  it('apagada, el DOBLE CLIC ya no inserta', () => {
    const historial = crearHistorial()
    const ctx = montar({ historial })
    ctx.edicion.activa(false)

    // ⚠️ El evento lleva `containerPoint` y esta prueba NO lo llevaba: con la
    // edición apagada el zoom por doble clic VUELVE, así que el manejador de
    // Leaflet corre de verdad y lo necesita. Lo descubrió ella misma reventando
    // en `Map.DoubleClickZoom`, que es la mejor confirmación de que el zoom
    // vuelve: la prueba de al lado lo afirma, y ésta lo sufre.
    const latlng = L.latLng(aLatLng([439250, 4479655.3]))
    ctx.mapa.fire('dblclick', {
      latlng,
      containerPoint: ctx.mapa.latLngToContainerPoint(latlng),
      originalEvent: { preventDefault: vi.fn() },
    })
    expect(anilloDe(ctx.store)).toHaveLength(4)
    expect(historial.pila).toHaveLength(0)
    ctx.limpiar()
  })

  it('apagada, el CLIC ya no selecciona lindero, y suelta el que hubiera', () => {
    // Un resalte que sobrevive señala un lado que ya no se puede desplazar: la
    // pantalla estaría diciendo que se puede hacer algo que no.
    const ctx = montar()
    ctx.edicion.seleccionarLado({ recinto: 0, indice: 0 })
    expect(ctx.edicion.ladoSeleccionado()).not.toBeNull()

    ctx.edicion.activa(false)
    expect(ctx.edicion.ladoSeleccionado()).toBeNull()
    expect(resalteDe(ctx.mapa)).toBeNull()

    ctx.mapa.fire('click', { latlng: L.latLng(aLatLng([439250, 4479655.3])) })
    expect(ctx.edicion.ladoSeleccionado()).toBeNull()
    ctx.limpiar()
  })

  it('apagada DEVUELVE el zoom por doble clic, y encendida vuelve a quitarlo', () => {
    // El módulo se lo quita al mapa para que insertar un vértice no amplíe
    // además. Sin editar, ese motivo no existe y el doble clic se quedaría sin
    // hacer NADA: ni insertar ni ampliar. Un gesto muerto y en silencio.
    const ctx = montar()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(false)

    ctx.edicion.activa(false)
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(true)

    ctx.edicion.activa(true)
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(false)
    ctx.limpiar()
  })

  it('la API pública SIGUE viva con la edición apagada: la frontera es el GESTO', () => {
    // `insertarEn`/`eliminar`/`desplazarSeleccion` las conduce la barra, y la
    // barra solo se ve en Edición. Apagarlas aquí además dejaría a este mismo
    // fichero sin forma de ejercitar el motor.
    const ctx = montar({ historial: crearHistorial() })
    ctx.edicion.activa(false)
    ctx.edicion.insertarEn(L.latLng(aLatLng([439250, 4479655.3])))
    expect(anilloDe(ctx.store)).toHaveLength(5)
    ctx.limpiar()
  })

  it('con un valor que no es booleano LANZA, y leer no escribe', () => {
    const ctx = montar()
    expect(() => ctx.edicion.activa('si')).toThrow(TypeError)
    expect(() => ctx.edicion.activa(1)).toThrow(TypeError)
    expect(ctx.edicion.activa()).toBe(true)
    ctx.limpiar()
  })
})

// ── F12 · M4 · DOS EDICIONES SOBRE EL MISMO MAPA ─────────────────────────────
//
// F12 monta una SEGUNDA `crearEdicion` sobre el mismo `L.Map`: la de la parcela y
// la de la parte activa del edificio. Los dos defectos que esto arregla están
// MEDIDOS (fase 0 de F12, 2026-08-06, jsdom) y ninguno era visible con una sola:
//
//   · con 4 marcadores de cada una, `edicionA.activa(false)` dejaba **0 de 8**
//     arrastrables —apagaba también los de B— y `activa(true)` encendía **los 8**;
//   · la segunda instancia nacía con el `doubleClickZoom` YA apagado por la
//     primera, así que no se hacía responsable, y apagar la primera **devolvía el
//     zoom por doble clic mientras la segunda seguía editando**.

describe('F12 · dos ediciones sobre el mismo mapa no se pisan', () => {
  /** Monta una segunda edición sobre el mapa de `ctx`, con su propio store. */
  function segundaEdicion(ctx) {
    const store = crearEstadoVista(parcelaCon(TRIANGULO_AGUDO))
    const edicion = crearEdicion({
      mapa: ctx.mapa,
      estado: store,
      zona: HUSO,
      alAvisar: vi.fn(),
    })
    return { store, edicion }
  }

  /** Un marcador cableado por UNA edición concreta. */
  function marcadorDe(ctx, edicion, utm, ref) {
    const marcador = L.marker(aLatLng(utm), { draggable: true }).addTo(ctx.mapa)
    marcador.refVertice = ref
    edicion.alCrearMarcador(marcador, ref)
    return marcador
  }

  it('⛔ apagar UNA no toca los marcadores de la OTRA', () => {
    const ctx = montar()
    const b = segundaEdicion(ctx)
    const mA = marcadorDe(ctx, ctx.edicion, V.A, { recinto: 0, indice: 0 })
    const mB = marcadorDe(ctx, b.edicion, V.B, { recinto: 0, indice: 1 })
    expect(mA.dragging.enabled()).toBe(true)
    expect(mB.dragging.enabled()).toBe(true)

    ctx.edicion.activa(false)
    expect(mA.dragging.enabled(), 'la edición A no ha apagado el suyo').toBe(false)
    expect(mB.dragging.enabled(), 'A ha apagado el marcador de B').toBe(true)

    // Y al revés: encender A no puede resucitar los de B, que sigue encendida…
    ctx.edicion.activa(true)
    b.edicion.activa(false)
    expect(mA.dragging.enabled()).toBe(true)
    expect(mB.dragging.enabled(), 'B no ha apagado el suyo').toBe(false)

    b.edicion.destruir()
    ctx.limpiar()
  })

  it('⛔ el zoom por doble clic no vuelve mientras QUEDE una editando', () => {
    const ctx = montar()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(false)
    const b = segundaEdicion(ctx)
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(false)

    // Apagar la primera NO lo devuelve: la segunda sigue insertando vértices.
    ctx.edicion.activa(false)
    expect(ctx.mapa.doubleClickZoom.enabled(), 'el zoom ha vuelto con B editando').toBe(false)

    // Solo cuando lo suelta la última.
    b.edicion.activa(false)
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(true)

    // Y volver a encender una lo apaga otra vez.
    b.edicion.activa(true)
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(false)

    b.edicion.destruir()
    ctx.limpiar()
  })

  it('destruir una tampoco devuelve el zoom si la otra sigue viva', () => {
    const ctx = montar()
    const b = segundaEdicion(ctx)
    b.edicion.destruir()
    expect(ctx.mapa.doubleClickZoom.enabled(), 'A sigue viva y el zoom ha vuelto').toBe(false)
    // …y cuando se va la última, sí. Se mide ANTES de tirar el mapa: sobre un
    // mapa ya destruido `enabled()` da `false` pase lo que pase, y eso sería un
    // verde (o un rojo) que no habla de este módulo.
    ctx.edicion.destruir()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(true)
    ctx.limpiar()
  })

  it('destruir dos veces no descuenta dos veces', () => {
    const ctx = montar()
    const b = segundaEdicion(ctx)
    b.edicion.destruir()
    b.edicion.destruir()
    expect(ctx.mapa.doubleClickZoom.enabled()).toBe(false)
    ctx.limpiar()
  })

  it('cada una escribe SOLO en su store', () => {
    const ctx = montar({ parcela: parcelaCon(TRIANGULO_AGUDO) })
    const b = segundaEdicion(ctx)
    const antesB = b.store.get()
    ctx.edicion.insertarEn(L.latLng(aLatLng([439290, 4479655])))
    expect(anilloDe(ctx.store).length).toBeGreaterThan(3)
    expect(b.store.get(), 'la edición A ha escrito en el store de B').toBe(antesB)
    b.edicion.destruir()
    ctx.limpiar()
  })
})

// test/viewer/comun.dom.test.js — F03 · Tarea 1.2 (contratos compartidos del visor)
// + smoke del tooling de la Tarea 1.1 (Leaflet importa bajo jsdom).
//
// Proyecto Vitest `dom` (jsdom): el nombre `*.dom.test.js` lo enruta ahí.
import { describe, it, expect, vi } from 'vitest'
import {
  vertUTMaLatLng,
  recintoALatLng,
  latLngAUTM,
  crearEstadoVista,
  PANES,
  PANE,
  COLOR_USUARIO,
} from '../../viewer/_comun.js'

describe('viewer/_comun · frontera de vista (proyección UTM ↔ lat/lon)', () => {
  // Coordenadas plausibles por huso (Península + Baleares). El round-trip es
  // matemático: forward(inverse(x,y,z),z) recupera (x,y) a nivel sub-mm.
  const casos = [
    { zona: 29, xy: [550000, 4750000] }, // Galicia/oeste
    { zona: 30, xy: [439250.35, 4479664.55] }, // parcela real (fixture F00)
    { zona: 31, xy: [450000, 4600000] }, // este/Baleares
  ]

  it.each(casos)('ida y vuelta ≈ identidad (huso $zona)', ({ zona, xy }) => {
    const latlng = vertUTMaLatLng(xy, zona)
    expect(latlng).toHaveLength(2)
    const [x, y] = latLngAUTM({ lat: latlng[0], lng: latlng[1] }, zona)
    expect(x).toBeCloseTo(xy[0], 3) // < 1 mm
    expect(y).toBeCloseTo(xy[1], 3)
  })

  it('acepta latlng como array [lat,lng] o como {lat,lng}', () => {
    const xy = [439250.35, 4479664.55]
    const [lat, lng] = vertUTMaLatLng(xy, 30)
    const comoArray = latLngAUTM([lat, lng], 30)
    const comoObjeto = latLngAUTM({ lat, lng }, 30)
    expect(comoArray[0]).toBeCloseTo(comoObjeto[0], 6)
    expect(comoArray[1]).toBeCloseTo(comoObjeto[1], 6)
  })

  it('recintoALatLng proyecta el anillo entero conservando el nº de vértices', () => {
    const recinto = { vertices: [[439250, 4479660], [439260, 4479660], [439260, 4479670]] }
    const anillo = recintoALatLng(recinto, 30)
    expect(anillo).toHaveLength(3)
    anillo.forEach((p) => expect(p).toHaveLength(2))
  })

  it('lanza (no corrige callado) ante entrada rota del programador', () => {
    expect(() => vertUTMaLatLng(null, 30)).toThrow(TypeError)
    expect(() => recintoALatLng({}, 30)).toThrow(TypeError)
    expect(() => latLngAUTM('nope', 30)).toThrow(TypeError)
  })
})

describe('viewer/_comun · constantes de dominio', () => {
  it('PANES tiene zIndex creciente oficial < editada < vertices', () => {
    const z = Object.fromEntries(PANES.map((p) => [p.nombre, p.zIndex]))
    expect(z[PANE.PARCELA_OFICIAL]).toBeLessThan(z[PANE.PARCELA_EDITADA])
    expect(z[PANE.PARCELA_EDITADA]).toBeLessThan(z[PANE.VERTICES])
    // Entre overlayPane (400) y markerPane (600) de Leaflet.
    for (const p of PANES) {
      expect(p.zIndex).toBeGreaterThan(400)
      expect(p.zIndex).toBeLessThan(600)
    }
  })

  it('la geometría del usuario es violeta #7C3AED', () => {
    expect(COLOR_USUARIO).toBe('#7C3AED')
  })
})

describe('viewer/_comun · crearEstadoVista (store, sin feedback loop)', () => {
  it('get devuelve el estado inicial y set lo reemplaza', () => {
    const estado = crearEstadoVista({ idLocal: 'A' })
    expect(estado.get()).toEqual({ idLocal: 'A' })
    estado.set({ idLocal: 'B' })
    expect(estado.get()).toEqual({ idLocal: 'B' })
  })

  it('notifica a los suscriptores UNA vez por set, con el nuevo estado', () => {
    const estado = crearEstadoVista(null)
    const spy = vi.fn()
    estado.subscribe(spy)
    estado.set({ v: 1 })
    expect(spy).toHaveBeenCalledTimes(1)
    expect(spy).toHaveBeenCalledWith({ v: 1 })
    estado.set({ v: 2 })
    expect(spy).toHaveBeenCalledTimes(2)
  })

  it('sin bucle: un suscriptor que hace set NO dispara cascada infinita', () => {
    const estado = crearEstadoVista(null)
    let entradas = 0
    // Suscriptor "malo" que reacciona escribiendo (simula tabla↔mapa).
    estado.subscribe((s) => {
      entradas++
      if (s && s.n < 3) estado.set({ n: s.n + 1 }) // reentrada
    })
    expect(() => estado.set({ n: 0 })).not.toThrow() // no desborda la pila
    // El estado sí avanza a la última reentrada, pero la notificación no cascadea.
    expect(estado.get()).toEqual({ n: 1 })
    expect(entradas).toBe(1)
  })

  it('unsubscribe deja de notificar', () => {
    const estado = crearEstadoVista(null)
    const spy = vi.fn()
    const baja = estado.subscribe(spy)
    estado.set({ v: 1 })
    baja()
    estado.set({ v: 2 })
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('subscribe exige una función', () => {
    const estado = crearEstadoVista(null)
    expect(() => estado.subscribe(42)).toThrow(TypeError)
  })
})

describe('tooling F03 (Tarea 1.1): Leaflet importa bajo jsdom', () => {
  it('import leaflet resuelve y expone version (window existe en jsdom)', async () => {
    const mod = await import('leaflet')
    const L = mod.default || mod
    expect(typeof L.version).toBe('string')
    expect(typeof L.map).toBe('function')
  })
})

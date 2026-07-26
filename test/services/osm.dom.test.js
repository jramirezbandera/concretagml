// test/services/osm.dom.test.js — F03 · Tarea 3A.1.
//
// `services/osm.js` importa Leaflet (solo-navegador): proyecto Vitest `dom`
// (jsdom), de ahí el sufijo `.dom.test.js`. Espeja `test/services/ign.dom.test.js`
// (el hermano gemelo de `services/osm.js`), adaptado a un único servicio. Usa el
// arnés compartido de la Fase 2A (`test/viewer/_ayuda-jsdom.js`) aunque este
// test viva en `test/services/`.
import { describe, it, expect, vi } from 'vitest'
import { OSM, crearCapaOSM, CAPA_OSM } from '../../services/osm.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { NIVEL } from '../../viewer/_comun.js'
import { montarMapa } from '../viewer/_ayuda-jsdom.js'

describe('services/osm · crearCapaOSM — criterios de aceptación 4 y 5 de F03', () => {
  it("crossOrigin='anonymous' y attribution IDÉNTICA por referencia a ATRIBUCION.OSM", () => {
    const capa = crearCapaOSM()
    expect(capa.options.crossOrigin).toBe('anonymous')
    // Identidad, no `toContain`: lo que detecta una paráfrasis del texto legal
    // (el mismo criterio que `test/services/ign.dom.test.js`).
    expect(capa.options.attribution).toBe(ATRIBUCION.OSM)
  })

  it('la atribución contiene el enlace a la licencia ODbL (criterio 5: "con enlace")', () => {
    const capa = crearCapaOSM()
    expect(capa.options.attribution).toContain('<a href=')
    expect(capa.options.attribution).toContain('openstreetmap.org/copyright')
    expect(capa.options.attribution).toContain('ODbL')
  })

  it('la URL contiene los placeholders {z}/{x}/{y} y el host de OSM', () => {
    const capa = crearCapaOSM()
    const url = capa._url
    expect(url).toContain('tile.openstreetmap.org')
    expect(url).toContain('{z}')
    expect(url).toContain('{x}')
    expect(url).toContain('{y}')
  })

  it('maxNativeZoom definido y maxZoom≥maxNativeZoom (por defecto, igualado)', () => {
    const capa = crearCapaOSM()
    expect(typeof capa.options.maxNativeZoom).toBe('number')
    expect(capa.options.maxNativeZoom).toBe(OSM.maxNativeZoom)
    expect(capa.options.maxZoom).toBeGreaterThanOrEqual(capa.options.maxNativeZoom)
  })

  it('el maxNativeZoom de OSM es 19 (máximo documentado del esquema estándar, no verificado en vivo)', () => {
    // A diferencia del 20 de `services/ign.js#MAX_ZOOM_NATIVO_IGN` (verificado
    // 2026-07-26 contra el GetCapabilities real), el 19 de aquí es el límite
    // documentado del esquema de teselas estándar de OSM.
    expect(OSM.maxNativeZoom).toBe(19)
    expect(crearCapaOSM().options.maxNativeZoom).toBe(19)
  })

  it('opts.maxZoom permite al llamante subir el tope sin tocar este módulo', () => {
    const capa = crearCapaOSM({ maxZoom: 22 })
    expect(capa.options.maxZoom).toBe(22)
    expect(capa.options.maxNativeZoom).toBe(OSM.maxNativeZoom)
  })

  it('opts NO puede debilitar crossOrigin/attribution/maxNativeZoom (invariantes no negociables)', () => {
    const capa1 = crearCapaOSM({
      crossOrigin: false,
      attribution: '',
      maxNativeZoom: 3,
    })
    expect(capa1.options.crossOrigin).toBe('anonymous')
    expect(capa1.options.attribution).toBe(ATRIBUCION.OSM)
    expect(capa1.options.maxNativeZoom).toBe(OSM.maxNativeZoom)

    const capa2 = crearCapaOSM({ crossOrigin: 'use-credentials' })
    expect(capa2.options.crossOrigin).toBe('anonymous')
  })

  it("un 'tileerror' invoca EXACTAMENTE UNA VEZ al alAvisar inyectado, con NIVEL.AVISO", () => {
    const espia = vi.fn()
    const capa = crearCapaOSM({ alAvisar: espia })

    capa.fire('tileerror', { coords: { x: 1, y: 2, z: 3 }, error: new Error('fallo de red') })

    expect(espia).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = espia.mock.calls[0]
    expect(typeof mensaje).toBe('string')
    expect(mensaje.length).toBeGreaterThan(0)
    // Mismo nivel que el fallo de las WMTS del IGN y del WMS del Catastro:
    // cartografía de FONDO que no carga es siempre AVISO, nunca ERROR.
    expect(detalle.nivel).toBe(NIVEL.AVISO)
    expect(detalle.causa).toBeInstanceOf(Error)
  })

  it('se puede añadir a un mapa real del arnés (montarMapa) sin lanzar', () => {
    const { mapa, destruir } = montarMapa()
    const capa = crearCapaOSM()
    expect(() => capa.addTo(mapa)).not.toThrow()
    expect(mapa.hasLayer(capa)).toBe(true)
    destruir()
  })
})

describe('services/osm · CAPA_OSM — descriptor para el control de capas (Fase 3)', () => {
  it('tiene id/nombre/rol/crear/atribucion', () => {
    expect(CAPA_OSM.id).toBe('osm')
    expect(typeof CAPA_OSM.nombre).toBe('string')
    expect(CAPA_OSM.nombre.length).toBeGreaterThan(0)
    expect(CAPA_OSM.rol).toBe('base')
    expect(typeof CAPA_OSM.crear).toBe('function')
    expect(typeof CAPA_OSM.atribucion).toBe('string')
    expect(CAPA_OSM.atribucion.length).toBeGreaterThan(0)
  })

  it('crear() devuelve una capa con crossOrigin correcto y la misma atribución', () => {
    const capa = CAPA_OSM.crear()
    expect(capa.options.crossOrigin).toBe('anonymous')
    expect(capa.options.attribution).toBe(CAPA_OSM.atribucion)
  })

  it('crear(opts) REENVÍA las opciones: un tileerror por el descriptor llega al alAvisar', () => {
    // Un descriptor que no acepta `alAvisar` apaga la regla 1 (hallazgo 2.6 de
    // la auditoría de coherencia, ya corregido en `services/ign.js#CAPAS_IGN`).
    const espia = vi.fn()
    const capa = CAPA_OSM.crear({ alAvisar: espia, maxZoom: 22 })

    // La opción normal se reenvía…
    expect(capa.options.maxZoom).toBe(22)
    // …y los invariantes siguen blindados.
    expect(capa.options.crossOrigin).toBe('anonymous')
    expect(capa.options.attribution).toBe(CAPA_OSM.atribucion)

    capa.fire('tileerror', { error: new Error('fallo de red') })
    expect(espia).toHaveBeenCalledTimes(1)
    expect(espia.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })
})

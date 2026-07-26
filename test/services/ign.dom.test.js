// test/services/ign.dom.test.js — F03 · Tarea 2B.1.
//
// `services/ign.js` importa Leaflet (solo-navegador): proyecto Vitest `dom`
// (jsdom), de ahí el sufijo `.dom.test.js`. Usa el arnés compartido de la Fase
// 2A (`test/viewer/_ayuda-jsdom.js`) aunque este test viva en `test/services/`.
import { describe, it, expect, vi } from 'vitest'
import { WMTS_IGN, crearCapaWMTS, CAPAS_IGN, MAX_ZOOM_NATIVO_IGN } from '../../services/ign.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { NIVEL } from '../../viewer/_comun.js'
import { montarMapa } from '../viewer/_ayuda-jsdom.js'

const IDS = ['pnoa-ma', 'ign-base', 'mapa-raster']

describe('services/ign · crearCapaWMTS — criterios de aceptación 4 y 5 de F03', () => {
  for (const id of IDS) {
    it(`'${id}': crossOrigin='anonymous' y attribution no vacía (criterios 4/5)`, () => {
      const capa = crearCapaWMTS(id)
      expect(capa.options.crossOrigin).toBe('anonymous')
      expect(typeof capa.options.attribution).toBe('string')
      expect(capa.options.attribution.length).toBeGreaterThan(0)
    })
  }

  it("'pnoa-ma' usa EXACTAMENTE ATRIBUCION.PNOA (no una paráfrasis)", () => {
    const capa = crearCapaWMTS('pnoa-ma')
    expect(capa.options.attribution).toBe(ATRIBUCION.PNOA)
  })

  it("'ign-base' y 'mapa-raster' usan EXACTAMENTE ATRIBUCION.IGN", () => {
    expect(crearCapaWMTS('ign-base').options.attribution).toBe(ATRIBUCION.IGN)
    expect(crearCapaWMTS('mapa-raster').options.attribution).toBe(ATRIBUCION.IGN)
  })

  for (const id of IDS) {
    it(`'${id}': la URL contiene su LAYER, GoogleMapsCompatible y los placeholders {z}/{x}/{y}`, () => {
      const capa = crearCapaWMTS(id)
      const url = capa._url
      expect(url).toContain(`LAYER=${WMTS_IGN[id].layer}`)
      expect(url).toContain('TILEMATRIXSET=GoogleMapsCompatible')
      expect(url).toContain('{z}')
      expect(url).toContain('{x}')
      expect(url).toContain('{y}')
      expect(url).toContain('SERVICE=WMTS')
      expect(url).toContain('REQUEST=GetTile')
    })
  }

  for (const id of IDS) {
    it(`'${id}': maxNativeZoom definido y maxZoom≥maxNativeZoom (por defecto, igualado)`, () => {
      const capa = crearCapaWMTS(id)
      expect(typeof capa.options.maxNativeZoom).toBe('number')
      expect(capa.options.maxNativeZoom).toBe(WMTS_IGN[id].maxNativeZoom)
      // Por defecto la capa deja maxZoom == maxNativeZoom (ver comentario en
      // services/ign.js#crearCapaWMTS): el "zoom sin tope artificial" de la
      // spec (maxZoom > maxNativeZoom) es una decisión del MAPA (viewer/mapa.js,
      // Fase 2B), que puede pasar maxZoom en `opts` para subirlo.
      expect(capa.options.maxZoom).toBeGreaterThanOrEqual(capa.options.maxNativeZoom)
    })
  }

  it('el maxNativeZoom de los tres servicios es 20 (VERIFICADO 2026-07-26, no 19)', () => {
    // Banco de pruebas 2D.1: el GetCapabilities de los tres declara
    // TileMatrixSetLimits de GoogleMapsCompatible para 0..20, y pidiendo teselas
    // z20 → HTTP 200 con imagen real, z21 → HTTP 400. El dossier §2.1 decía
    // "hasta z19" para PNOA y se quedaba CORTO. Importa porque con 19 Leaflet
    // reescala la última tesela en z20 en vez de pedir la nativa, y se pierde
    // calidad real en la escala de calcado de precisión.
    for (const id of IDS) {
      expect(WMTS_IGN[id].maxNativeZoom).toBe(20)
      expect(crearCapaWMTS(id).options.maxNativeZoom).toBe(20)
    }
  })

  it('MAX_ZOOM_NATIVO_IGN es DERIVADO de WMTS_IGN, no escrito a mano', () => {
    // El valor vive en un solo sitio: si mañana un servicio sube a z21, esta
    // constante sube con él sin tocar nada más (y el test sigue siendo válido).
    expect(MAX_ZOOM_NATIVO_IGN).toBe(
      Math.max(...Object.values(WMTS_IGN).map((s) => s.maxNativeZoom)),
    )
    expect(MAX_ZOOM_NATIVO_IGN).toBe(20)
  })

  it('opts.maxZoom permite al llamante subir el tope sin tocar este módulo', () => {
    const capa = crearCapaWMTS('pnoa-ma', { maxZoom: 22 })
    expect(capa.options.maxZoom).toBe(22)
    expect(capa.options.maxNativeZoom).toBe(WMTS_IGN['pnoa-ma'].maxNativeZoom)
  })

  it('opts NO puede debilitar crossOrigin/attribution/maxNativeZoom (invariantes no negociables)', () => {
    const capa = crearCapaWMTS('pnoa-ma', {
      crossOrigin: false,
      attribution: 'texto inventado',
      maxNativeZoom: 3,
    })
    expect(capa.options.crossOrigin).toBe('anonymous')
    expect(capa.options.attribution).toBe(ATRIBUCION.PNOA)
    expect(capa.options.maxNativeZoom).toBe(WMTS_IGN['pnoa-ma'].maxNativeZoom)
  })

  it("un 'tileerror' invoca EXACTAMENTE UNA VEZ al alAvisar inyectado, con NIVEL.AVISO", () => {
    const espia = vi.fn()
    const capa = crearCapaWMTS('pnoa-ma', { alAvisar: espia })

    capa.fire('tileerror', { coords: { x: 1, y: 2, z: 3 }, error: new Error('fallo de red') })

    expect(espia).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = espia.mock.calls[0]
    expect(typeof mensaje).toBe('string')
    expect(mensaje.length).toBeGreaterThan(0)
    // Mismo nivel que el fallo de la cartografía del Catastro: los dos son
    // cartografía de FONDO que no carga (hallazgo 2.5), y el nivel se toma del
    // enum, no de un literal suelto.
    expect(detalle.nivel).toBe(NIVEL.AVISO)
    expect(detalle.causa).toBeInstanceOf(Error)
  })

  it("crearCapaWMTS('no-existe') lanza (contrato roto por el programador)", () => {
    expect(() => crearCapaWMTS('no-existe')).toThrow(RangeError)
  })

  it('se puede añadir a un mapa real del arnés (montarMapa) sin lanzar', () => {
    const { mapa, destruir } = montarMapa()
    const capa = crearCapaWMTS('ign-base')
    expect(() => capa.addTo(mapa)).not.toThrow()
    expect(mapa.hasLayer(capa)).toBe(true)
    destruir()
  })
})

describe('services/ign · CAPAS_IGN — germen de la guarda transversal de crossOrigin (Fase 4)', () => {
  it('tiene exactamente 3 descriptores, cada uno con id/nombre/rol/crear/atribucion', () => {
    expect(CAPAS_IGN).toHaveLength(3)
    for (const descriptor of CAPAS_IGN) {
      expect(typeof descriptor.nombre).toBe('string')
      expect(descriptor.nombre.length).toBeGreaterThan(0)
      expect(descriptor.rol).toBe('base')
      expect(typeof descriptor.crear).toBe('function')
      expect(typeof descriptor.atribucion).toBe('string')
      expect(descriptor.atribucion.length).toBeGreaterThan(0)
    }
  })

  it('cada descriptor lleva su `id` — la clave estable con la que indexar/persistir', () => {
    // Hallazgo 2.6: sin `id`, la Fase 3 solo podría indexar por `nombre`, que es
    // un rótulo de UI ('Topográfico IGN (MTN)') — mala clave para persistir "qué
    // capa tenía activa el usuario" y frágil si se retoca el texto.
    expect(CAPAS_IGN.map((d) => d.id)).toEqual(IDS)
    for (const descriptor of CAPAS_IGN) {
      expect(WMTS_IGN[descriptor.id]).toBeDefined()
      expect(descriptor.nombre).toBe(WMTS_IGN[descriptor.id].nombre)
    }
  })

  it('crear() de cada descriptor devuelve una capa con crossOrigin correcto', () => {
    for (const descriptor of CAPAS_IGN) {
      const capa = descriptor.crear()
      expect(capa.options.crossOrigin).toBe('anonymous')
      expect(capa.options.attribution).toBe(descriptor.atribucion)
    }
  })

  it('crear(opts) REENVÍA las opciones: un tileerror por el descriptor llega al alAvisar', () => {
    // Hallazgo 2.6: antes el descriptor llamaba a `crearCapaWMTS(id)` sin
    // argumentos, así que usar CAPAS_IGN para lo que existe (alimentar el control
    // de capas) dejaba TODOS los tileerror fuera de la UI de avisos y la regla 1
    // se quedaba en su suelo mínimo (console.warn).
    for (const descriptor of CAPAS_IGN) {
      const espia = vi.fn()
      const capa = descriptor.crear({ alAvisar: espia, maxZoom: 22 })

      // La opción normal se reenvía…
      expect(capa.options.maxZoom).toBe(22)
      // …y los invariantes siguen blindados.
      expect(capa.options.crossOrigin).toBe('anonymous')
      expect(capa.options.attribution).toBe(descriptor.atribucion)

      capa.fire('tileerror', { error: new Error('fallo de red') })
      expect(espia).toHaveBeenCalledTimes(1)
      expect(espia.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    }
  })
})

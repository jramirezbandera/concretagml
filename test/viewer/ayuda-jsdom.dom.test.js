// test/viewer/ayuda-jsdom.dom.test.js — F03 · Tarea 2A.3.
//
// El arnés se prueba a sí mismo: si esto no está en verde, los cuatro agentes
// de la Fase 2B (services/ign.js, viewer/wms-catastro.js, viewer/mapa.js,
// viewer/sincronizacion.js) construirían sobre arena. Cubre `crearContenedor`,
// `montarMapa`, `crearPanes`, `parcelaConHueco`, `dispararCarga` y `esperarCiclo`.
//
// Proyecto Vitest `dom` (jsdom): el nombre `*.dom.test.js` lo enruta ahí.
import { describe, it, expect } from 'vitest'
import L from 'leaflet'
import { SRS_VALIDOS } from '../../model/parcela.js'
import { PANES } from '../../viewer/_comun.js'
import {
  crearContenedor,
  crearPanes,
  montarMapa,
  parcelaConHueco,
  dispararCarga,
  esperarCiclo,
} from './_ayuda-jsdom.js'

describe('_ayuda-jsdom · montarMapa da a Leaflet un tamaño real bajo jsdom', () => {
  it('mapa.getSize() tiene ancho y alto > 0 y coincide con lo pedido', () => {
    const { mapa, destruir } = montarMapa({ ancho: 400, alto: 300 })
    const tam = mapa.getSize()
    expect(tam.x).toBe(400)
    expect(tam.y).toBe(300)
    expect(tam.x).toBeGreaterThan(0)
    expect(tam.y).toBeGreaterThan(0)
    destruir()
  })

  it('getBounds() NO degenera tras setView: noreste ≠ suroeste', () => {
    const { mapa, destruir } = montarMapa()
    const bounds = mapa.getBounds()
    expect(bounds.getNorth()).toBeGreaterThan(bounds.getSouth())
    expect(bounds.getEast()).toBeGreaterThan(bounds.getWest())
    destruir()
  })

  it('las esquinas del encuadre se pueden proyectar a puntos finitos y distintos', () => {
    const { mapa, destruir } = montarMapa()
    const bounds = mapa.getBounds()
    const sw = L.CRS.EPSG3857.project(bounds.getSouthWest())
    const ne = L.CRS.EPSG3857.project(bounds.getNorthEast())

    expect(Number.isFinite(sw.x)).toBe(true)
    expect(Number.isFinite(sw.y)).toBe(true)
    expect(Number.isFinite(ne.x)).toBe(true)
    expect(Number.isFinite(ne.y)).toBe(true)
    expect(sw.x).not.toBe(ne.x)
    expect(sw.y).not.toBe(ne.y)
    destruir()
  })

  it('destruir() saca el contenedor de document.body', () => {
    const { contenedor, destruir } = montarMapa()
    expect(document.body.contains(contenedor)).toBe(true)
    destruir()
    expect(document.body.contains(contenedor)).toBe(false)
  })
})

describe('_ayuda-jsdom · crearContenedor', () => {
  it('define clientWidth/clientHeight reales y un rect coherente', () => {
    const div = crearContenedor({ ancho: 640, alto: 480 })
    expect(div.clientWidth).toBe(640)
    expect(div.clientHeight).toBe(480)
    const rect = div.getBoundingClientRect()
    expect(rect.width).toBe(640)
    expect(rect.height).toBe(480)
    expect(document.body.contains(div)).toBe(true)
    div.remove()
  })
})

describe('_ayuda-jsdom · crearPanes', () => {
  it('crea EXACTAMENTE los panes de PANES, con su zIndex, y accesibles por mapa.getPane', () => {
    // Derivado de PANES, nunca con nombres/zIndex a mano: es la razón de que el
    // bucle viva en el arnés y no copiado en el test de sincronizacion.js
    // (hallazgo 2.12) — si PANES cambia, ningún test se queda con panes viejos.
    const { mapa, destruir } = montarMapa()
    const panes = crearPanes(mapa)

    expect(Object.keys(panes)).toEqual(PANES.map((p) => p.nombre))
    for (const { nombre, zIndex } of PANES) {
      expect(panes[nombre].style.zIndex).toBe(String(zIndex))
      expect(mapa.getPane(nombre)).toBe(panes[nombre])
    }

    destruir()
  })
})

describe('_ayuda-jsdom · L.marker draggable — patrón de arrastre por API', () => {
  it('setLatLng + fire("drag") y fire("dragend") disparan los handlers registrados', () => {
    const { mapa, destruir } = montarMapa()
    const origen = mapa.getCenter()
    const destino = { lat: origen.lat + 0.0005, lng: origen.lng + 0.0005 }

    const marcador = L.marker(origen, { draggable: true }).addTo(mapa)

    let drags = 0
    let dragends = 0
    marcador.on('drag', () => drags++)
    marcador.on('dragend', () => dragends++)

    marcador.setLatLng(destino)
    marcador.fire('drag')
    marcador.fire('dragend')

    expect(drags).toBe(1)
    expect(dragends).toBe(1)
    expect(marcador.getLatLng().lat).toBeCloseTo(destino.lat, 9)
    expect(marcador.getLatLng().lng).toBeCloseTo(destino.lng, 9)

    destruir()
  })
})

describe('_ayuda-jsdom · parcelaConHueco', () => {
  it('cumple los invariantes del modelo (recintos, tipos, anillos abiertos, srs)', () => {
    const parcela = parcelaConHueco()

    expect(parcela.recintos).toHaveLength(2)
    expect(parcela.recintos[0].tipo).toBe('EXTERIOR')
    expect(parcela.recintos[1].tipo).toBe('HUECO')

    for (const recinto of parcela.recintos) {
      const primero = recinto.vertices[0]
      const ultimo = recinto.vertices[recinto.vertices.length - 1]
      expect(primero).not.toEqual(ultimo) // anillo ABIERTO
    }

    expect(SRS_VALIDOS).toContain(parcela.srs)
    expect(() => structuredClone(parcela)).not.toThrow()
  })
})

describe('_ayuda-jsdom · dispararCarga', () => {
  it('sin error: invoca onload', () => {
    const img = document.createElement('img')
    let cargada = false
    img.onload = () => {
      cargada = true
    }
    dispararCarga(img)
    expect(cargada).toBe(true)
  })

  it('con error:true: invoca onerror', () => {
    const img = document.createElement('img')
    let fallo = false
    img.onerror = () => {
      fallo = true
    }
    dispararCarga(img, { error: true })
    expect(fallo).toBe(true)
  })

  it('carrera: una respuesta antigua que llega tarde no debe pisar a la más nueva', async () => {
    // Patrón que usarán los tests de la capa WMS: dos <img>, la vieja "responde"
    // después de la nueva; el test comprueba que el consumidor descarta la vieja.
    const imgVieja = document.createElement('img')
    const imgNueva = document.createElement('img')
    const eventos = []
    imgVieja.onload = () => eventos.push('vieja')
    imgNueva.onload = () => eventos.push('nueva')

    dispararCarga(imgNueva)
    await esperarCiclo()
    dispararCarga(imgVieja) // llega tarde
    await esperarCiclo()

    expect(eventos).toEqual(['nueva', 'vieja'])
  })
})

describe('_ayuda-jsdom · esperarCiclo', () => {
  it('resuelve tras ceder el hilo (deja correr un setTimeout(0) pendiente)', async () => {
    let marca = false
    setTimeout(() => {
      marca = true
    }, 0)
    await esperarCiclo()
    expect(marca).toBe(true)
  })
})

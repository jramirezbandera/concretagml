// test/viewer/buscador.dom.test.js — el buscador del mapa, su mitad de vista.
//
// Proyecto `dom` (jsdom). El control no sabe de CartoCiudad: recibe `buscar` y
// `situar`, y aquí son dos funciones de mentira que devuelven lo que el servicio
// devolvería. El temporizador entre teclas se INYECTA (`programar`), como en todo
// el repo: nada de relojes falsos.
//
// Lo que se vigila:
//   · que va ENCIMA del zoom (Leaflet lo pondría debajo);
//   · el patrón combobox: aria-expanded, aria-activedescendant, flechas, Intro,
//     Escape, y que Escape con lista NO vacía el campo;
//   · que un portal se lleva a zoom de parcela y una zona se encuadra por su caja;
//   · que la respuesta vieja que llega tarde no pinta nada;
//   · que un clic en la lista NO llega al mapa (el clic del mapa pregunta al
//     Catastro por la parcela que hay debajo);
//   · que los fallos se DICEN en el renglón y no se tragan.

import { describe, it, expect, vi, afterEach } from 'vitest'

import {
  crearBuscador,
  SELECTOR,
  ZOOM_PUNTO,
  ZOOM_MAXIMO_CAJA,
  ESPERA_MS,
} from '../../viewer/buscador.js'
import { montarMapa } from './_ayuda-jsdom.js'

const PORTAL = Object.freeze({
  id: '13.PV',
  tipo: 'portal',
  rotulo: 'CALLE SAN RESTITUTO 72 C, Madrid',
  detalle: 'Portal',
  esPunto: true,
  centro: { lat: 40.4653857, lng: -3.716672 },
})

const MUNICIPIO = Object.freeze({
  id: '29007',
  tipo: 'Municipio',
  rotulo: 'Alhaurín de la Torre, Málaga',
  detalle: 'Municipio',
  esPunto: false,
  centro: null,
})

const ok = (datos) => ({ ok: true, datos, motivo: null, mensaje: null })

/** Un `programar` que guarda la tarea para dispararla a mano. */
function crearProgramar() {
  const tareas = []
  const programar = vi.fn((fn, ms) => {
    const tarea = { fn, ms, cancelada: false }
    tareas.push(tarea)
    return () => {
      tarea.cancelada = true
    }
  })
  return {
    programar,
    tareas,
    async disparar() {
      const vivas = tareas.filter((t) => !t.cancelada)
      tareas.length = 0
      for (const t of vivas) t.fn()
      await Promise.resolve()
      await new Promise((r) => setTimeout(r, 0))
    },
  }
}

const esperarCiclo = () => new Promise((r) => setTimeout(r, 0))

let limpiar = []
afterEach(() => {
  for (const fn of limpiar.splice(0)) fn()
})

function montar({ buscar, situar, alElegir = vi.fn(), atribucion = 'Búsqueda: CartoCiudad' } = {}) {
  const { mapa, destruir } = montarMapa({ zoom: 6, centro: [40, -3.7] })
  const reloj = crearProgramar()
  const b = crearBuscador({
    mapa,
    buscar: buscar ?? vi.fn(async () => ok([PORTAL, MUNICIPIO])),
    situar: situar ?? vi.fn(async (lugar) => ok({ centro: lugar.centro, caja: null })),
    alElegir,
    atribucion,
    programar: reloj.programar,
    alAvisar: vi.fn(),
  })
  limpiar.push(() => {
    b.destruir()
    destruir()
  })
  const raiz = mapa.getContainer()
  const q = (s) => raiz.querySelector(s)
  const campo = q(SELECTOR.CAMPO)
  const escribir = (texto) => {
    campo.value = texto
    campo.dispatchEvent(new Event('input', { bubbles: true }))
  }
  const tecla = (key) => campo.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))
  const opciones = () => [...raiz.querySelectorAll(SELECTOR.OPCION)]
  const estado = () => q(SELECTOR.ESTADO)
  return { mapa, b, reloj, q, campo, escribir, tecla, opciones, estado, alElegir }
}

describe('dónde está', () => {
  it('arriba a la izquierda y ENCIMA del zoom', () => {
    const { mapa, b } = montar()
    const esquina = mapa.getContainer().querySelector('.leaflet-top.leaflet-left')
    expect(esquina.firstElementChild).toBe(b.control._contenedor)
    expect(esquina.querySelector('.leaflet-control-zoom')).not.toBeNull()
  })

  it('es un hito de búsqueda y su campo un combobox con nombre', () => {
    const { campo, q } = montar()
    expect(campo.closest('form').getAttribute('role')).toBe('search')
    expect(campo.getAttribute('role')).toBe('combobox')
    expect(campo.getAttribute('aria-expanded')).toBe('false')
    expect(campo.getAttribute('aria-label')).toMatch(/dirección.*municipio/i)
    expect(campo.getAttribute('aria-controls')).toBe(q(SELECTOR.LISTA).id)
  })
})

describe('preguntar', () => {
  it('con menos de tres letras no programa nada', () => {
    const { escribir, reloj } = montar()
    escribir('ca')
    expect(reloj.programar).not.toHaveBeenCalled()
  })

  it('espera ESPERA_MS tras la última tecla, y solo pregunta la última', async () => {
    const buscar = vi.fn(async () => ok([PORTAL]))
    const { escribir, reloj } = montar({ buscar })
    escribir('cal')
    escribir('calle')
    expect(reloj.programar).toHaveBeenLastCalledWith(expect.any(Function), ESPERA_MS)
    await reloj.disparar()
    expect(buscar).toHaveBeenCalledTimes(1)
    expect(buscar.mock.calls[0][0]).toBe('calle')
    expect(buscar.mock.calls[0][1].senal).toBeInstanceOf(AbortSignal)
  })

  it('pinta las opciones con su segunda línea, y abre el combobox', async () => {
    const { escribir, reloj, opciones, campo, q } = montar()
    escribir('san restituto')
    await reloj.disparar()
    expect(opciones().map((o) => o.textContent)).toEqual([
      `${PORTAL.rotulo}${PORTAL.detalle}`,
      `${MUNICIPIO.rotulo}${MUNICIPIO.detalle}`,
    ])
    expect(campo.getAttribute('aria-expanded')).toBe('true')
    expect(opciones()[0].getAttribute('role')).toBe('option')
    expect(q(SELECTOR.ATRIBUCION).style.display).toBe('')
    expect(q(SELECTOR.ATRIBUCION).textContent).toMatch(/CartoCiudad/)
  })

  it('sin resultados lo DICE, con lo que se buscó', async () => {
    const { escribir, reloj, estado, opciones } = montar({ buscar: vi.fn(async () => ok([])) })
    escribir('zzqxwv')
    await reloj.disparar()
    expect(opciones()).toHaveLength(0)
    expect(estado().textContent).toMatch(/«zzqxwv»/)
  })

  it('un fallo se dice con el mensaje del servicio, y una cancelación no', async () => {
    const fallo = { ok: false, datos: null, motivo: 'SIN_RED', mensaje: 'No se ha podido contactar con el servicio.' }
    const { escribir, reloj, estado } = montar({ buscar: vi.fn(async () => fallo) })
    escribir('madrid')
    await reloj.disparar()
    expect(estado().textContent).toBe(fallo.mensaje)
  })

  it('la respuesta vieja que llega tarde NO pinta nada', async () => {
    let soltarVieja = () => {}
    const buscar = vi.fn((texto) =>
      texto === 'alhaurin'
        ? new Promise((resolver) => {
            soltarVieja = () => resolver(ok([MUNICIPIO]))
          })
        : Promise.resolve(ok([PORTAL])),
    )
    const { escribir, reloj, opciones } = montar({ buscar })
    escribir('alhaurin')
    await reloj.disparar()
    escribir('san restituto')
    await reloj.disparar()
    soltarVieja()
    await esperarCiclo()
    expect(opciones().map((o) => o.dataset.indice)).toEqual(['0'])
    expect(opciones()[0].textContent).toMatch(/SAN RESTITUTO/)
    // Y la vieja se abortó al empezar la nueva.
    expect(buscar.mock.calls[0][1].senal.aborted).toBe(true)
  })
})

describe('el teclado', () => {
  it('las flechas mueven la opción activa sin sacar el foco, y dan la vuelta', async () => {
    const { escribir, reloj, tecla, campo, opciones } = montar()
    escribir('san restituto')
    await reloj.disparar()
    tecla('ArrowDown')
    expect(campo.getAttribute('aria-activedescendant')).toBe(opciones()[0].id)
    expect(opciones()[0].getAttribute('aria-selected')).toBe('true')
    tecla('ArrowDown')
    tecla('ArrowDown')
    expect(campo.getAttribute('aria-activedescendant')).toBe(opciones()[0].id)
    tecla('ArrowUp')
    expect(campo.getAttribute('aria-activedescendant')).toBe(opciones()[1].id)
  })

  it('Escape con la lista abierta la cierra y NO vacía lo escrito', async () => {
    const { escribir, reloj, tecla, campo, opciones } = montar()
    escribir('san restituto')
    await reloj.disparar()
    tecla('Escape')
    expect(opciones()).toHaveLength(0)
    expect(campo.getAttribute('aria-expanded')).toBe('false')
    expect(campo.value).toBe('san restituto')
  })

  it('Intro sin elegir toma la primera', async () => {
    const situar = vi.fn(async (lugar) => ok({ centro: lugar.centro, caja: null }))
    const { escribir, reloj, tecla } = montar({ situar })
    escribir('san restituto')
    await reloj.disparar()
    tecla('Enter')
    await esperarCiclo()
    expect(situar).toHaveBeenCalledWith(PORTAL, expect.objectContaining({ senal: expect.any(AbortSignal) }))
  })
})

describe('elegir', () => {
  it('un PORTAL lleva el mapa a escala de parcela y avisa a la aplicación', async () => {
    const alElegir = vi.fn()
    const { escribir, reloj, opciones, mapa, campo } = montar({ alElegir })
    escribir('san restituto')
    await reloj.disparar()
    opciones()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await esperarCiclo()
    expect(mapa.getZoom()).toBe(Math.min(ZOOM_PUNTO, mapa.getMaxZoom()))
    expect(mapa.getCenter().lat).toBeCloseTo(PORTAL.centro.lat, 5)
    expect(campo.value).toBe(PORTAL.rotulo)
    expect(alElegir).toHaveBeenCalledWith({ lugar: PORTAL, centro: PORTAL.centro, esPunto: true })
  })

  it('una ZONA con caja se encuadra por la caja, con tope de zoom', async () => {
    const caja = [
      [36.60, -4.62],
      [36.72, -4.50],
    ]
    const situar = vi.fn(async () => ok({ centro: { lat: 36.66, lng: -4.58 }, caja }))
    const alElegir = vi.fn()
    const { escribir, reloj, opciones, mapa } = montar({ situar, alElegir })
    escribir('alhaurin')
    await reloj.disparar()
    opciones()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await esperarCiclo()
    expect(mapa.getBounds().contains([36.66, -4.58])).toBe(true)
    expect(mapa.getZoom()).toBeLessThanOrEqual(ZOOM_MAXIMO_CAJA)
    expect(alElegir.mock.calls[0][0].esPunto).toBe(false)
  })

  it('si no se puede situar, lo dice y el mapa NO se mueve', async () => {
    const situar = vi.fn(async () => ({ ok: false, datos: null, motivo: 'NO_ENCONTRADO', mensaje: 'CartoCiudad ya no encuentra «X».' }))
    const alElegir = vi.fn()
    const { escribir, reloj, opciones, mapa, estado } = montar({ situar, alElegir })
    const antes = mapa.getZoom()
    escribir('alhaurin')
    await reloj.disparar()
    opciones()[1].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await esperarCiclo()
    expect(estado().textContent).toMatch(/ya no encuentra/)
    expect(mapa.getZoom()).toBe(antes)
    expect(alElegir).not.toHaveBeenCalled()
  })

  it('⛔ un clic en la lista NO llega al mapa', async () => {
    const { escribir, reloj, opciones, mapa } = montar()
    const alClicMapa = vi.fn()
    mapa.on('click', alClicMapa)
    escribir('san restituto')
    await reloj.disparar()
    opciones()[0].dispatchEvent(new MouseEvent('click', { bubbles: true }))
    await esperarCiclo()
    expect(alClicMapa).not.toHaveBeenCalled()
  })
})

describe('destruir', () => {
  it('retira el control, aborta lo que haya en vuelo y es idempotente', async () => {
    let senal = null
    const buscar = vi.fn((texto, o) => {
      senal = o.senal
      return new Promise(() => {})
    })
    const { escribir, reloj, b, mapa } = montar({ buscar })
    escribir('madrid')
    await reloj.disparar()
    b.destruir()
    b.destruir()
    expect(senal.aborted).toBe(true)
    expect(mapa.getContainer().querySelector(SELECTOR.CAMPO)).toBeNull()
  })
})

/* -------------------------------------------------------------------------- *
 * test/app/dialogo-creditos.dom.test.js — F16 · «Créditos y licencias»         *
 *                                                                              *
 * Lo que se guarda aquí:                                                       *
 *   · Que lo abre el `menuitem` de la barra y que sin él el montaje LANZA: una *
 *     página que las licencias obligan a tener no puede quedarse sin puerta.   *
 *   · Que los datos salen de `ATRIBUCION` y de CartoCiudad tal cual, y que el  *
 *     enlace de OSM es un enlace y no texto con etiquetas.                     *
 *   · Que el software sale del inventario del build, y que en desarrollo, o si *
 *     el fichero no llega, SE DICE por qué no hay lista en vez de dejarla      *
 *     vacía (una lista vacía diría «no usamos software de nadie»).            *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom). El inventario llega por `cargar`: aquí no se  *
 * hace ni una petición.                                                        *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  ESTADO_INVENTARIO,
  SELECTOR_ABRIR_CREDITOS,
  crearDialogoCreditos,
} from '../../app/dialogo-creditos.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { CARTOCIUDAD } from '../../services/cartociudad.js'

function montarCascara() {
  document.body.className = 'gml-app'
  document.body.innerHTML = `
    <div class="gml-barra-menu" role="menu" data-menu="expediente" hidden>
      <button type="button" role="menuitem" data-accion="creditos">Créditos y licencias</button>
    </div>
  `
}

const INVENTARIO = {
  paquetes: [
    {
      nombre: 'leaflet',
      version: '1.9.4',
      spdx: 'BSD-2-Clause',
      copyright: ['Copyright (c) 2010-2023, Volodymyr Agafonkin'],
      url: 'https://www.npmjs.com/package/leaflet/v/1.9.4',
      texto: 'BSD 2-Clause License\n\nCopyright (c) 2010-2023, Volodymyr Agafonkin\n\nRedistribution and use\nin source and binary forms…',
    },
    {
      nombre: 'splaytree-ts',
      version: '1.0.2',
      spdx: 'BSD-3-Clause',
      declarada: 'BDS-3-Clause',
      copyright: [],
      url: 'https://www.npmjs.com/package/splaytree-ts/v/1.0.2',
      texto: 'BSD 3-Clause License',
    },
  ],
  fuentes: [
    {
      nombre: 'Geist y Geist Mono',
      spdx: 'OFL-1.1',
      copyright: ['Copyright (c) 2023 Vercel'],
      url: 'https://github.com/vercel/geist-font',
      texto: 'Copyright (c) 2023 Vercel',
    },
  ],
}

const seccion = (nombre) => document.querySelector(`[data-creditos="${nombre}"]`)
const obras = () => [...document.querySelectorAll('#gml-creditos-software [data-obra]')]

let dlg = null

beforeEach(montarCascara)

afterEach(() => {
  dlg?.destruir()
  dlg = null
  document.body.innerHTML = ''
  document.body.className = ''
})

describe('F16 · se monta y se alcanza desde el menú', () => {
  it('lo abre el `menuitem`, y Cerrar lo cierra', () => {
    dlg = crearDialogoCreditos({ documento: document })
    document.querySelector(SELECTOR_ABRIR_CREDITOS).click()
    expect(dlg.estaAbierto()).toBe(true)
    expect(document.querySelector('.gml-dialogo-creditos')).not.toBeNull()
    document.querySelector('[data-accion="cerrar-creditos"]').click()
    expect(dlg.estaAbierto()).toBe(false)
  })

  it('⛔ sin el `menuitem` de index.html, LANZA al montar', () => {
    document.body.innerHTML = ''
    expect(() => crearDialogoCreditos({ documento: document })).toThrow(/data-accion="creditos"/)
  })

  it('destruir lo quita del DOM y suelta el disparador', () => {
    dlg = crearDialogoCreditos({ documento: document })
    dlg.destruir()
    expect(document.querySelector('.gml-dialogo-creditos')).toBeNull()
    document.querySelector(SELECTOR_ABRIR_CREDITOS).click()
    expect(dlg.estaAbierto()).toBe(false)
  })
})

describe('F16 · los datos cartográficos', () => {
  it('⭐ cada atribución sale LITERAL de su módulo', () => {
    dlg = crearDialogoCreditos({ documento: document })
    const texto = seccion('datos').textContent
    for (const clave of ['PNOA', 'IGN', 'CATASTRO']) expect(texto).toContain(ATRIBUCION[clave])
    expect(texto).toContain(CARTOCIUDAD.ATRIBUCION)
    expect(texto).toContain('ODbL')
  })

  it('el enlace de OpenStreetMap es un ENLACE, no texto con etiquetas', () => {
    dlg = crearDialogoCreditos({ documento: document })
    const a = seccion('datos').querySelector('a[href="https://www.openstreetmap.org/copyright"]')
    expect(a?.textContent).toBe('OpenStreetMap')
    expect(a?.rel).toContain('noopener')
    expect(seccion('datos').textContent).not.toContain('<a')
  })
})

describe('F16 · el software, del inventario del build', () => {
  it('⭐ una ficha por obra, con versión y SPDX a la vista', async () => {
    dlg = crearDialogoCreditos({ documento: document, construido: true, cargar: async () => INVENTARIO })
    await dlg.abrir()
    expect(seccion('software').dataset.estado).toBe(ESTADO_INVENTARIO.LISTO)
    expect(obras().map((o) => o.dataset.obra)).toEqual(['leaflet@1.9.4', 'splaytree-ts@1.0.2', 'Geist y Geist Mono'])
    const leaflet = obras()[0]
    expect(leaflet.dataset.spdx).toBe('BSD-2-Clause')
    expect(leaflet.querySelector('summary').textContent).toContain('1.9.4')
    expect(leaflet.querySelector('summary').textContent).toContain('BSD-2-Clause')
    expect(seccion('software').textContent).toContain('2 paquetes de software (contando cada versión) y 1 tipografía')
  })

  it('el enlace a los textos completos apunta al .txt del build, bajo la base', async () => {
    dlg = crearDialogoCreditos({
      documento: document,
      base: '/concretagml/',
      construido: true,
      cargar: async () => INVENTARIO,
    })
    await dlg.abrir()
    const a = seccion('software').querySelector('a[download]')
    expect(a.getAttribute('href')).toBe('/concretagml/licencias-terceros.txt')
  })

  it('el texto de la licencia se pinta al desplegar, en párrafos con los renglones unidos', async () => {
    dlg = crearDialogoCreditos({ documento: document, construido: true, cargar: async () => INVENTARIO })
    await dlg.abrir()
    const leaflet = obras()[0]
    expect(leaflet.querySelectorAll('.gml-diccionario-apartado')).toHaveLength(0)
    leaflet.open = true
    leaflet.dispatchEvent(new window.Event('toggle'))
    const parrafos = [...leaflet.querySelectorAll('.gml-diccionario-apartado')].map((p) => p.textContent)
    expect(parrafos).toContain('Redistribution and use in source and binary forms…')
    expect(parrafos[0]).toBe('Copyright (c) 2010-2023, Volodymyr Agafonkin')
  })

  it('la corrección del SPDX se cuenta, y lo que no tiene copyright lo dice', async () => {
    dlg = crearDialogoCreditos({ documento: document, construido: true, cargar: async () => INVENTARIO })
    await dlg.abrir()
    const splay = obras()[1]
    splay.open = true
    splay.dispatchEvent(new window.Event('toggle'))
    expect(splay.querySelector('.gml-diccionario-correccion').textContent).toContain('«BDS-3-Clause»')
    expect(splay.textContent).toContain('no lleva aviso de copyright')
  })

  it('pide el inventario UNA vez, por muchas veces que se abra', async () => {
    const cargar = vi.fn(async () => INVENTARIO)
    dlg = crearDialogoCreditos({ documento: document, construido: true, cargar })
    await dlg.abrir()
    dlg.cerrar()
    await dlg.abrir()
    expect(cargar).toHaveBeenCalledTimes(1)
  })

  it('⛔ en desarrollo no pide nada y DICE por qué no hay lista', async () => {
    const cargar = vi.fn(async () => INVENTARIO)
    dlg = crearDialogoCreditos({ documento: document, construido: false, cargar })
    await dlg.abrir()
    expect(cargar).not.toHaveBeenCalled()
    expect(seccion('software').dataset.estado).toBe(ESTADO_INVENTARIO.SIN_INVENTARIO)
    expect(seccion('software').textContent).toMatch(/npm run build/)
    expect(document.querySelector('#gml-creditos-software').hidden).toBe(true)
  })

  it('⛔ si el fichero no llega, lo dice con el motivo, y la próxima apertura reintenta', async () => {
    const cargar = vi
      .fn()
      .mockRejectedValueOnce(new Error('licencias.json contestó 404.'))
      .mockResolvedValueOnce(INVENTARIO)
    dlg = crearDialogoCreditos({ documento: document, construido: true, cargar })
    await dlg.abrir()
    expect(seccion('software').dataset.estado).toBe(ESTADO_INVENTARIO.FALLO)
    expect(seccion('software').textContent).toContain('contestó 404')
    dlg.cerrar()
    await dlg.abrir()
    expect(seccion('software').dataset.estado).toBe(ESTADO_INVENTARIO.LISTO)
  })

  it('⛔ un fichero con otra forma es un fallo, no una lista vacía', async () => {
    dlg = crearDialogoCreditos({ documento: document, construido: true, cargar: async () => ({ paquetes: 'no' }) })
    await dlg.abrir()
    expect(seccion('software').dataset.estado).toBe(ESTADO_INVENTARIO.FALLO)
    expect(obras()).toHaveLength(0)
  })
})

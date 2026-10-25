// @vitest-environment jsdom
// test/app/siguiente-paso.dom.test.js — el botón «Siguiente» del pie del panel.
//
// Se prueba contra la navegación REAL de `app/navegacion.js`: el contrato del
// módulo es que no decide nada, así que un doble de la navegación probaría justo
// lo que no importa.

import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PASO, RAMA, crearNavegacion, evaluarPaso } from '../../app/navegacion.js'
import {
  MENSAJE_ULTIMO_PASO,
  ROTULO_SIGUIENTE,
  SELECTOR,
  cablearSiguientePaso,
  pasoSiguiente,
} from '../../app/siguiente-paso.js'

let panel
let cableado

function montar(navegacion) {
  cableado = cablearSiguientePaso({ documento: document, panel, navegacion })
  return {
    boton: panel.querySelector(SELECTOR.BOTON),
    estado: panel.querySelector(SELECTOR.ESTADO),
  }
}

beforeEach(() => {
  document.body.innerHTML = `
    <aside class="gml-panel">
      <header class="gml-panel-cabecera"></header>
      <p data-estado="generar-gml" role="status"></p>
    </aside>`
  panel = document.querySelector('.gml-panel')
})

afterEach(() => {
  cableado?.destruir()
  cableado = null
})

describe('pasoSiguiente', () => {
  it('sigue el orden de PASOS y no hay nada después del último', () => {
    expect(pasoSiguiente(PASO.ENTRADA)).toBe(PASO.EDICION)
    expect(pasoSiguiente(PASO.EDICION)).toBe(PASO.DIAGNOSTICO)
    expect(pasoSiguiente(PASO.DIAGNOSTICO)).toBeNull()
  })
})

describe('app/siguiente-paso', () => {
  it('se monta delante del acuse de «Generar GML», al pie del panel', () => {
    montar(crearNavegacion())
    const bloque = panel.querySelector(SELECTOR.BLOQUE)
    expect(bloque.nextElementSibling.getAttribute('data-estado')).toBe('generar-gml')
  })

  it('sin geometría está APAGADO y dice por qué, con el mismo veredicto que el rail', () => {
    const navegacion = crearNavegacion()
    const { boton, estado } = montar(navegacion)
    const veredicto = evaluarPaso(PASO.EDICION, navegacion.get())

    expect(boton.hidden).toBe(false)
    expect(boton.disabled).toBe(true)
    expect(boton.textContent).toBe(ROTULO_SIGUIENTE[RAMA.PARCELA][PASO.EDICION])
    expect(estado.textContent).toBe(veredicto.breve)
    expect(boton.title).toBe(veredicto.motivo)
  })

  it('se enciende cuando llegan los hechos, y al pulsar lleva al paso siguiente', () => {
    const navegacion = crearNavegacion()
    const { boton, estado } = montar(navegacion)

    navegacion.actualizarHechos({ geometria: true })
    expect(boton.disabled).toBe(false)
    expect(estado.textContent).toBe('')

    boton.click()
    expect(navegacion.get().paso).toBe(PASO.EDICION)
  })

  it('en Edición se calla: allí el botón «Siguiente» es el CTA del pie', () => {
    const navegacion = crearNavegacion({ hechos: { geometria: true } })
    montar(navegacion)
    navegacion.navegarAPaso(PASO.EDICION)
    expect(panel.querySelector(SELECTOR.BLOQUE).hidden).toBe(true)
    navegacion.navegarAPaso(PASO.ENTRADA)
    expect(panel.querySelector(SELECTOR.BLOQUE).hidden).toBe(false)
  })

  it('el rótulo cambia con la rama', () => {
    const navegacion = crearNavegacion({ rama: RAMA.EDIFICIO })
    const { boton } = montar(navegacion)
    expect(boton.textContent).toBe(ROTULO_SIGUIENTE[RAMA.EDIFICIO][PASO.EDICION])
  })

  it('en el último paso no hay botón: hay una frase que señala «Generar GML»', () => {
    const navegacion = crearNavegacion({
      paso: PASO.DIAGNOSTICO,
      hechos: { geometria: true, oficial: true },
    })
    const { boton, estado } = montar(navegacion)
    expect(navegacion.get().paso).toBe(PASO.DIAGNOSTICO)
    expect(boton.hidden).toBe(true)
    expect(estado.textContent).toBe(MENSAJE_ULTIMO_PASO)
  })

  it('destruir() quita el bloque y deja de escuchar', () => {
    const navegacion = crearNavegacion()
    montar(navegacion)
    cableado.destruir()
    cableado = null
    expect(panel.querySelector(SELECTOR.BLOQUE)).toBeNull()
    expect(() => navegacion.actualizarHechos({ geometria: true })).not.toThrow()
  })
})

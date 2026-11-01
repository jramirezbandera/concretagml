/* -------------------------------------------------------------------------- *
 * test/app/apagado.dom.test.js — los CTA del pie se apagan sin dejar de ser   *
 * enfocables                                                                   *
 *                                                                              *
 * Cierra «La pista del botón apagado no se puede abrir con el teclado»         *
 * (TODOS.md, 2026-08-19). Lo que cada cableado hace al pulsar apagado lo       *
 * prueban sus propios ficheros; aquí, el módulo y el contrato de `index.html`. *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

import { apagar, estaApagado } from '../../app/apagado.js'

const RAIZ = join(import.meta.dirname, '..', '..')

describe('app/apagado', () => {
  it('apaga con `aria-disabled` y enciende QUITANDO el atributo', () => {
    const boton = document.createElement('button')
    apagar(boton, true)
    expect(boton.getAttribute('aria-disabled')).toBe('true')
    expect(estaApagado(boton)).toBe(true)
    expect(boton.disabled, 'sigue enfocable').toBe(false)

    apagar(boton, false)
    expect(boton.hasAttribute('aria-disabled')).toBe(false)
    expect(estaApagado(boton)).toBe(false)
  })

  it('index.html: los cuatro CTA del pie nacen apagados y SIGUEN en el orden de tabulación', () => {
    document.documentElement.innerHTML = readFileSync(join(RAIZ, 'index.html'), 'utf8')
    for (const accion of [
      'traer-fondo-catastral',
      'traer-colindantes',
      'rehacer-parcelario',
      'diagnosticar',
    ]) {
      const boton = document.querySelector(`[data-accion="${accion}"]`)
      expect(boton, accion).not.toBeNull()
      expect(estaApagado(boton), accion).toBe(true)
      // Un `disabled` aquí volvería a sacar el botón del tabulador, y con él la
      // única forma de abrir su pista con el teclado.
      expect(boton.hasAttribute('disabled'), accion).toBe(false)
      expect(boton.closest('.gml-accion'), accion).not.toBeNull()
    }
  })
})

/* -------------------------------------------------------------------------- *
 * test/app/dialogo-avisos.dom.test.js — la mudanza de la lista de avisos       *
 *                                              (2026-08-07)                    *
 *                                                                              *
 * QUÉ CAMBIÓ. Hasta hoy la lista de avisos era una `<section>` de la columna    *
 * izquierda que cedía hasta 34vh del sitio más caro de la aplicación —el que    *
 * comparten la tabla de vértices y el pie donde vive «Generar GML»— y que el    *
 * 95 % del tiempo lo gastaba en poner «AVISOS / Sin avisos.». Ahora vive en un  *
 * `<dialog>` que abren los dos chips de la cabecera.                            *
 *                                                                              *
 * ⭐ QUÉ VIGILA ESTE FICHERO, Y POR QUÉ IMPORTA MÁS QUE LO QUE SE VE. Sacar un  *
 * canal de errores de la pantalla es exactamente el movimiento que puede        *
 * convertir la regla de oro 1 del proyecto («ningún error silencioso») en una   *
 * frase escrita en un comentario. Las tres cosas que lo impiden son:            *
 *                                                                              *
 *   1. los chips siguen contando el TOTAL, aunque haya un filtro puesto;        *
 *   2. las tarjetas siguen EN EL DOM con el diálogo cerrado y SIN filtrar —de   *
 *      eso viven los doce guiones de humo que cuentan `#avisos .gml-aviso` para *
 *      medir «¿esta operación ha dejado avisos?»; si al cerrar se vaciaran o    *
 *      quedara un filtro puesto, esos guiones contarían de menos y **darían     *
 *      verde mintiendo**—;                                                       *
 *   3. el filtro se aplica antes del tope de 12 tarjetas (eso lo vigila         *
 *      `avisos.dom.test.js`, que es de quien es el motor).                       *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom). No hace falta Leaflet: este módulo solo importa *
 * `NIVEL` y `app/avisos.js`.                                                    *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { crearDialogoAvisos } from '../../app/dialogo-avisos.js'
import { NIVEL } from '../../viewer/_comun.js'

/**
 * La cáscara MÍNIMA de la que depende el diálogo, que es su contrato entero con
 * `index.html`: los dos chips. Nada más — el `<div id="avisos">` lo fabrica él,
 * y eso es justamente lo que se mudó.
 */
function montarCascara() {
  document.body.className = 'gml-app'
  document.body.innerHTML = `
    <header class="gml-panel-cabecera">
      <div class="gml-chips">
        <button type="button" class="gml-chip" data-contador="ERROR">0 errores</button>
        <button type="button" class="gml-chip" data-contador="AVISO">0 avisos</button>
      </div>
    </header>
  `
  return {
    chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
    chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
  }
}

const tarjetas = () => [...document.querySelectorAll('#avisos .gml-aviso')]
const textos = () =>
  [...document.querySelectorAll('#avisos .gml-aviso-texto')].map((t) => t.textContent)
const pestana = (clave) => document.querySelector(`.gml-filtro-avisos[data-filtro="${clave}"]`)
const rotulosDePestanas = () =>
  [...document.querySelectorAll('.gml-filtro-avisos')].map((b) => b.textContent)

/** Un clic que se propaga, como el de verdad: el diálogo oye por delegación. */
const clic = (nodo) => nodo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))

let cascara
let avisos

beforeEach(() => {
  cascara = montarCascara()
  avisos = crearDialogoAvisos({ documento: document })
})

afterEach(() => {
  avisos?.destruir()
  document.body.innerHTML = ''
})

describe('app/dialogo-avisos · contrato de construcción', () => {
  it('sin los chips de index.html ⇒ TypeError que dice DÓNDE arreglarlo', () => {
    document.body.innerHTML = ''
    expect(() => crearDialogoAvisos({ documento: document })).toThrow(TypeError)
    expect(() => crearDialogoAvisos({ documento: document })).toThrow(/index\.html/)
    expect(() => crearDialogoAvisos({ documento: document })).toThrow(/data-contador/)
  })

  it('un documento que no lo es ⇒ TypeError (no un «cannot read of undefined»)', () => {
    expect(() => crearDialogoAvisos({ documento: null })).toThrow(TypeError)
    expect(() => crearDialogoAvisos({ documento: {} })).toThrow(TypeError)
  })

  it('⭐ fabrica el `#avisos` que index.html ya NO trae, y uno solo', () => {
    // Si algún día vuelve a haber un `<div id="avisos">` en el marcado, habría
    // dos y `app/main.js` cablearía uno de ellos: el otro se quedaría vacío para
    // siempre, en silencio. El guardián del marcado está en `pantalla.dom.test.js`;
    // éste vigila el lado del módulo.
    expect(document.querySelectorAll('#avisos')).toHaveLength(1)
    expect(avisos.lista.id).toBe('avisos')
    expect(avisos.lista.classList.contains('gml-avisos')).toBe(true)
    expect(avisos.nodo.contains(avisos.lista)).toBe(true)
    expect(avisos.nodo.tagName).toBe('DIALOG')
  })

  it('nace CERRADO y con la lista vacía dicha en voz alta', () => {
    expect(avisos.estaAbierto()).toBe(false)
    expect(avisos.nodo.hasAttribute('open')).toBe(false)
    expect(document.querySelector('#avisos .gml-avisos-vacio').textContent).toBe('Sin avisos.')
  })

  it('sirve tal cual donde antes iba el panel: trae `avisar` suelta', () => {
    // `app/main.js` hace `alAvisar: panel.avisar` y los cableados comprueban
    // `typeof panel?.avisar === 'function'`. Si esto dejara de cumplirse, quince
    // sitios de la aplicación se quedarían sin canal.
    const { avisar } = avisos
    expect(typeof avisar).toBe('function')
    expect(() => avisar('Desde el visor.', { nivel: NIVEL.AVISO })).not.toThrow()
    expect(textos()).toEqual(['Desde el visor.'])
  })
})

describe('app/dialogo-avisos · los chips lo abren', () => {
  it('el chip de errores abre con la pestaña «Errores» puesta', () => {
    avisos.avisar('Un error.', { nivel: NIVEL.ERROR })
    avisos.avisar('Un aviso.', { nivel: NIVEL.AVISO })

    clic(cascara.chipError)
    expect(avisos.estaAbierto()).toBe(true)
    expect(pestana(NIVEL.ERROR).getAttribute('aria-pressed')).toBe('true')
    expect(textos()).toEqual(['Un error.'])
  })

  it('el chip de avisos abre con la pestaña «Avisos» puesta', () => {
    avisos.avisar('Un error.', { nivel: NIVEL.ERROR })
    avisos.avisar('Un aviso.', { nivel: NIVEL.AVISO })

    clic(cascara.chipAviso)
    expect(pestana(NIVEL.AVISO).getAttribute('aria-pressed')).toBe('true')
    expect(textos()).toEqual(['Un aviso.'])
  })

  it('⭐ pinchar el OTRO chip con el diálogo ya abierto cambia de pestaña', () => {
    avisos.avisar('Un error.', { nivel: NIVEL.ERROR })
    avisos.avisar('Un aviso.', { nivel: NIVEL.AVISO })

    clic(cascara.chipError)
    expect(textos()).toEqual(['Un error.'])
    clic(cascara.chipAviso)
    expect(avisos.estaAbierto()).toBe(true)
    expect(textos()).toEqual(['Un aviso.'])
  })

  it('los chips anuncian que abren algo', () => {
    for (const chip of [cascara.chipError, cascara.chipAviso]) {
      expect(chip.getAttribute('aria-haspopup')).toBe('dialog')
    }
  })

  it('el foco va a la pestaña con la que se abre, y vuelve al chip al cerrar', () => {
    cascara.chipError.focus()
    clic(cascara.chipError)
    expect(document.activeElement).toBe(pestana(NIVEL.ERROR))
    avisos.cerrar()
    expect(document.activeElement).toBe(cascara.chipError)
  })
})

describe('app/dialogo-avisos · las tres pestañas', () => {
  beforeEach(() => {
    avisos.avisar('Error uno.', { nivel: NIVEL.ERROR })
    avisos.avisar('Aviso uno.', { nivel: NIVEL.AVISO })
    avisos.avisar('Aviso dos.', { nivel: NIVEL.AVISO })
    avisos.abrir()
  })

  it('los rótulos llevan la cuenta de CADA nivel y la suma en «Todo»', () => {
    expect(rotulosDePestanas()).toEqual(['Todo 3', 'Errores 1', 'Avisos 2'])
  })

  it('la cuenta se actualiza sola cuando entra un aviso con el diálogo abierto', () => {
    avisos.avisar('Error dos.', { nivel: NIVEL.ERROR })
    expect(rotulosDePestanas()).toEqual(['Todo 4', 'Errores 2', 'Avisos 2'])
  })

  it('pinchar una pestaña filtra la lista, y solo una queda pulsada', () => {
    clic(pestana(NIVEL.AVISO))
    expect(textos()).toEqual(['Aviso dos.', 'Aviso uno.'])
    const pulsadas = [...document.querySelectorAll('.gml-filtro-avisos')].filter(
      (b) => b.getAttribute('aria-pressed') === 'true',
    )
    expect(pulsadas).toHaveLength(1)
    expect(pulsadas[0].dataset.filtro).toBe(NIVEL.AVISO)
  })

  it('«Todo» vuelve a enseñarlo todo', () => {
    clic(pestana(NIVEL.ERROR))
    expect(tarjetas()).toHaveLength(1)
    clic(pestana('TODO'))
    expect(tarjetas()).toHaveLength(3)
  })

  it('pinchar DOS VECES la misma pestaña no la desmarca ni desactualiza el rótulo', () => {
    // El caso que se escapaba: `panel.filtro` sale por su guarda de igualdad sin
    // repintar, así que si el diálogo no pintara a mano, un aviso llegado entre
    // los dos clics no aparecería en el rótulo.
    clic(pestana(NIVEL.ERROR))
    avisos.avisar('Error dos.', { nivel: NIVEL.ERROR })
    clic(pestana(NIVEL.ERROR))
    expect(pestana(NIVEL.ERROR).getAttribute('aria-pressed')).toBe('true')
    expect(rotulosDePestanas()).toEqual(['Todo 4', 'Errores 2', 'Avisos 2'])
    expect(textos()).toEqual(['Error dos.', 'Error uno.'])
  })

  it('la clase y el `aria-pressed` no divergen', () => {
    // Se comprueban las dos porque el CSS se cuelga de la clase y el lector de
    // pantalla del atributo: si el módulo se olvidara de una, el fallo sería
    // invisible para la mitad de los usuarios.
    clic(pestana(NIVEL.AVISO))
    for (const boton of document.querySelectorAll('.gml-filtro-avisos')) {
      expect(boton.classList.contains('gml-filtro-avisos--puesto')).toBe(
        boton.getAttribute('aria-pressed') === 'true',
      )
    }
  })
})

describe('app/dialogo-avisos · ⛔ el estado EN REPOSO, del que viven los guiones', () => {
  it('con el diálogo CERRADO las tarjetas siguen en `#avisos`', () => {
    // Si esto se rompe, los doce guiones de humo que cuentan `#avisos .gml-aviso`
    // pasan a contar cero y dan verde diciendo «esta operación no ha dejado ni un
    // aviso». Es el fallo más caro que esta mudanza podía introducir.
    //
    // ⚠️ Se comprueban los DOS reposos, y el segundo no es redundante: medido con
    // una mutación el 2026-08-07, un `cerrar()` que vaciara la lista pasaba
    // INADVERTIDO para la primera mitad de esta prueba, porque sin haber abierto
    // nunca, `cerrar()` sale por su guarda y no llega a hacer daño.
    avisos.avisar('Un error.', { nivel: NIVEL.ERROR })
    avisos.avisar('Un aviso.', { nivel: NIVEL.AVISO })

    // 1 · Nunca abierto (el reposo normal de un guion de humo).
    expect(avisos.estaAbierto()).toBe(false)
    expect(tarjetas()).toHaveLength(2)

    // 2 · Abierto y cerrado (el reposo tras una visita del usuario).
    avisos.abrir()
    avisos.cerrar()
    expect(tarjetas()).toHaveLength(2)
    expect(textos()).toEqual(['Un aviso.', 'Un error.'])
  })

  it('⭐ cerrar DEVUELVE el filtro a «Todo»: en reposo no hay nada oculto', () => {
    avisos.avisar('Un error.', { nivel: NIVEL.ERROR })
    avisos.avisar('Un aviso.', { nivel: NIVEL.AVISO })
    clic(cascara.chipError)
    expect(tarjetas()).toHaveLength(1) // filtrado a errores mientras está abierto
    avisos.cerrar()
    expect(tarjetas()).toHaveLength(2) // y completo otra vez al cerrar
    expect(pestana('TODO').getAttribute('aria-pressed')).toBe('true')
  })

  it('las tarjetas conservan el contrato de DOM que leen los guiones', () => {
    avisos.avisar('Se repite.', { nivel: NIVEL.AVISO })
    avisos.avisar('Se repite.', { nivel: NIVEL.AVISO })
    const tarjeta = document.querySelector('#avisos .gml-aviso')
    expect(tarjeta.dataset.nivel).toBe(NIVEL.AVISO)
    expect(tarjeta.querySelector('.gml-aviso-texto').textContent).toBe('Se repite.')
    expect(tarjeta.querySelector('.gml-aviso-veces').textContent).toBe('×2')
  })
})

describe('app/dialogo-avisos · cerrar y vaciar', () => {
  beforeEach(() => {
    avisos.avisar('Un error.', { nivel: NIVEL.ERROR })
    avisos.abrir()
  })

  it('el botón «Cerrar» cierra', () => {
    clic(document.querySelector('[data-accion="cerrar-avisos"]'))
    expect(avisos.estaAbierto()).toBe(false)
  })

  it('Escape cierra', () => {
    avisos.nodo.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(avisos.estaAbierto()).toBe(false)
  })

  it('un clic en el velo cierra; uno dentro de la caja, no', () => {
    clic(document.querySelector('.gml-dialogo-avisos-cuerpo'))
    expect(avisos.estaAbierto()).toBe(true)
    clic(avisos.nodo)
    expect(avisos.estaAbierto()).toBe(false)
  })

  it('«Vaciar» vacía la lista y los chips, y se apaga solo cuando no hay nada', () => {
    const vaciar = document.querySelector('[data-accion="vaciar-avisos"]')
    expect(vaciar.disabled).toBe(false)
    clic(vaciar)
    expect(tarjetas()).toHaveLength(0)
    expect(avisos.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
    expect(cascara.chipError.textContent).toBe('0 errores')
    expect(vaciar.disabled, 'un botón que ya no hace nada tiene que decirlo').toBe(true)
  })

  it('cerrar es IDEMPOTENTE: el `close` del navegador vuelve a entrar por aquí', () => {
    avisos.cerrar()
    expect(() => avisos.cerrar()).not.toThrow()
    expect(avisos.estaAbierto()).toBe(false)
  })
})

describe('app/dialogo-avisos · destruir', () => {
  it('se lleva el diálogo, los oyentes de los chips y no lanza dos veces', () => {
    avisos.avisar('Un error.', { nivel: NIVEL.ERROR })
    avisos.abrir()
    avisos.destruir()

    expect(document.querySelector('.gml-dialogo-avisos')).toBeNull()
    expect(document.querySelector('#avisos')).toBeNull()
    expect(cascara.chipError.hasAttribute('aria-haspopup')).toBe(false)
    // El chip ya no abre nada: si el oyente siguiera puesto, intentaría enseñar
    // un `<dialog>` que ya no está en el documento.
    expect(() => clic(cascara.chipError)).not.toThrow()
    expect(document.querySelector('.gml-dialogo-avisos')).toBeNull()
    expect(() => avisos.destruir()).not.toThrow()
    avisos = null
  })

  it('`abrir` tras destruir no resucita nada', () => {
    avisos.destruir()
    expect(() => avisos.abrir(NIVEL.ERROR)).not.toThrow()
    expect(document.querySelector('.gml-dialogo-avisos')).toBeNull()
    avisos = null
  })
})

describe('app/dialogo-avisos · sin `showModal` (navegador viejo o jsdom pelado)', () => {
  it('cae al atributo `open` en vez de quedarse mudo', () => {
    // Misma detección de capacidad que los diálogos de F09, F10, F11, F18 y F19.
    // Un diálogo que no se abre y no lo dice es un fallo silencioso, y este es el
    // diálogo del canal de errores.
    const original = window.HTMLDialogElement?.prototype?.showModal
    if (original) {
      vi.spyOn(window.HTMLDialogElement.prototype, 'showModal').mockImplementation(() => {
        throw new Error('sin showModal')
      })
    }
    try {
      avisos.abrir(NIVEL.ERROR)
      expect(avisos.estaAbierto()).toBe(true)
      expect(avisos.nodo.hasAttribute('open')).toBe(true)
    } finally {
      vi.restoreAllMocks()
    }
  })
})

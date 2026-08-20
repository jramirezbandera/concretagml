/* -------------------------------------------------------------------------- *
 * test/app/tarjeta-bienvenida.dom.test.js — LA PRIMERA VISITA    (2026-08-18)  *
 *                                                                              *
 * La tarjeta que sale sola al abrir la aplicación vacía, sobre el mapa de       *
 * España, y que cuenta tres cosas: qué es esto, cómo empezar, y que **pinchar   *
 * el mapa rellena la referencia catastral**.                                    *
 *                                                                              *
 * ── QUÉ SE VIGILA AQUÍ, Y POR QUÉ CADA COSA ──                                *
 *                                                                              *
 * 1. **Que no es un `<dialog>`, y que lo dice.** Es la decisión del cambio:     *
 *    `showModal()` pinta un `::backdrop` que se traga los clics, y esta tarjeta *
 *    existe para enseñar «pincha el mapa». Un día alguien va a querer           *
 *    «unificarla con los otros diálogos»; estas pruebas son el sitio donde ese  *
 *    día se entera de por qué no.                                              *
 *                                                                              *
 * 2. **Que la copia no miente.** El clic rellena EL CAMPO; no trae la parcela.  *
 *    Y el gesto se cuenta en dos tiempos («busca… y pínchala») porque a zoom 6  *
 *    no hay ninguna parcela que señalar. Las dos son afirmaciones sobre el      *
 *    TEXTO, y van aquí porque en este producto la copia es la mitad del diseño. *
 *                                                                              *
 * 3. **Que `localStorage` no puede romper el arranque.** Este proyecto no tenía *
 *    ni una línea de `localStorage` antes de hoy, y el modo de fallo que ya ha  *
 *    pagado una vez (`main.js:1449`) es un `TypeError` en el paso 1 que deja la *
 *    aplicación sin vestir **y la consola muda**. Hay una prueba por cada       *
 *    dirección: leer que lanza y escribir que lanza.                            *
 *                                                                              *
 * 4. **Que apagado dice por qué** (DESIGN.md §8), que es lo que pasa cuando se  *
 *    reabre con una referencia ya en el modelo.                                 *
 *                                                                              *
 * ── QUÉ NO SE PRUEBA AQUÍ ──                                                   *
 * La CONDICIÓN de apertura (llave + los dos stores vacíos) y los dos cierres    *
 * automáticos son de `app/main.js`, no de este módulo: los mide                 *
 * `main-arranque-vacio.dom.test.js`. Aquí el módulo se abre y se cierra a mano. *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  LLAVE,
  SELECTOR_ABRIR_BIENVENIDA,
  crearTarjetaBienvenida,
} from '../../app/tarjeta-bienvenida.js'

/**
 * La cáscara MÍNIMA: la opción del menú (todo el contrato con `index.html`) y el
 * `<main>` del mapa, que hace falta para comprobar dónde se inserta la tarjeta.
 */
function montarCascara() {
  document.body.className = 'gml-app'
  document.body.innerHTML = `
    <nav class="gml-barra">
      <div class="gml-barra-menu" role="menu" data-menu="expediente" hidden>
        <button type="button" role="menuitem" data-accion="consultar-rechazo">Rechazo</button>
        <button type="button" role="menuitem" data-accion="como-funciona" aria-haspopup="dialog">Cómo funciona</button>
      </div>
    </nav>
    <aside class="gml-panel"><input id="refcat" /></aside>
    <main id="mapa" class="gml-mapa"></main>
  `
}

/** Un `localStorage` de mentira, con las dos puertas por las que se puede romper. */
function almacenFalso({ lanzaAlLeer = false, lanzaAlEscribir = false, inicial } = {}) {
  const datos = new Map()
  if (inicial !== undefined) datos.set(LLAVE, inicial)
  return {
    datos,
    getItem(k) {
      if (lanzaAlLeer) throw new DOMException('SecurityError')
      return datos.has(k) ? datos.get(k) : null
    },
    setItem(k, v) {
      if (lanzaAlEscribir) throw new DOMException('QuotaExceededError')
      datos.set(k, v)
    },
  }
}

const tarjetaEl = () => document.querySelector('.gml-bienvenida')
const texto = () => tarjetaEl()?.textContent ?? ''
const vias = () => [...document.querySelectorAll('.gml-bienvenida-via')].map((v) => v.textContent)
const gesto = () => document.querySelector('.gml-bienvenida-gesto')

let t = null

beforeEach(() => {
  montarCascara()
})

afterEach(() => {
  t?.destruir()
  t = null
  document.body.innerHTML = ''
  document.body.className = ''
})

describe('el montaje y la puerta de vuelta', () => {
  it('se monta cerrada: la primera visita la decide `main.js`, no este módulo', () => {
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
    expect(t.estaAbierta()).toBe(false)
    expect(tarjetaEl().hidden).toBe(true)
  })

  it('⛔ LANZA si no está el `menuitem`: una ayuda de un solo uso es lo que §8 prohíbe', () => {
    // Mismo criterio que `crearDialogoDiccionario`. Una tarjeta que se enseña una
    // vez y no se puede recuperar repite el defecto que viene a arreglar: un
    // camino que solo conoce quien lo vio una vez es un secreto.
    document.body.innerHTML = ''
    expect(() => crearTarjetaBienvenida({ documento: document })).toThrow(TypeError)
    expect(() => crearTarjetaBienvenida({ documento: document })).toThrow(
      /como-funciona|contrato de index\.html/,
    )
  })

  it('el `menuitem` la reabre, y reabrir NO vuelve a marcar nada', () => {
    const almacen = almacenFalso()
    t = crearTarjetaBienvenida({ documento: document, almacen })
    document.querySelector(SELECTOR_ABRIR_BIENVENIDA).click()
    expect(t.estaAbierta()).toBe(true)
    // La llave se escribe al CERRAR, no al abrir: abrir no prueba que se haya leído.
    expect(almacen.datos.has(LLAVE)).toBe(false)
  })

  it('se inserta DELANTE del mapa, que es lo que ordena la tabulación', () => {
    // El sitio en pantalla lo pone `grid-area`, así que el orden en el DOM solo
    // gobierna el recorrido del tabulador: panel → tarjeta → cromo de Leaflet, y
    // no hay que atravesar los controles del mapa para llegar a un botón que
    // acaba de aparecer.
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
    const hijos = [...document.body.children]
    expect(hijos.indexOf(tarjetaEl())).toBeLessThan(hijos.indexOf(document.getElementById('mapa')))
  })
})

describe('⛔ NO es un `<dialog>`, y el marcado lo declara', () => {
  it('es una `<section>` con `aria-modal="false"`', () => {
    // Si alguien «unifica» esto con los otros seis diálogos, esta prueba se pone
    // roja y la cabecera del módulo explica por qué no se puede: el `::backdrop`
    // de `showModal()` bloquearía el clic del mapa que la tarjeta enseña.
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
    expect(tarjetaEl().tagName).toBe('SECTION')
    expect(tarjetaEl().getAttribute('aria-modal')).toBe('false')
    expect(tarjetaEl().getAttribute('role')).toBe('dialog')
  })

  it('tiene nombre accesible por su título', () => {
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
    const id = tarjetaEl().getAttribute('aria-labelledby')
    expect(document.getElementById(id).textContent).toBe('Concreta GML')
  })

  it('⭐ NO roba el foco al abrir', () => {
    // Aparece sin que nadie la pida, en el primer segundo. Mover ahí el foco
    // secuestraría un teclado que no ha pedido nada.
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
    const campo = document.getElementById('refcat')
    campo.focus()
    t.abrir()
    expect(document.activeElement).toBe(campo)
  })
})

describe('⭐ la copia, que en este producto es la mitad del diseño', () => {
  beforeEach(() => {
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
    t.abrir()
  })

  it('dice que se RELLENA el campo, y NO que trae la parcela', () => {
    // El clic rellena y nada más: la referencia no entra en el expediente hasta
    // que se pulsa «Traer del Catastro», que es lo que hace que `parcela.refcat`
    // signifique siempre «esto lo afirma quien firma».
    expect(texto()).toMatch(/referencia catastral se rellena sola/i)
    expect(texto()).not.toMatch(/trae la parcela|carga la parcela/i)
  })

  it('cuenta el gesto en DOS TIEMPOS, porque a zoom 6 no hay parcela que señalar', () => {
    expect(texto()).toMatch(/busca tu parcela en el mapa y pínchala/i)
    expect(texto()).not.toMatch(/pincha cualquier parcela/i)
  })

  it('nombra las tres vías, y no las explica', () => {
    expect(vias()).toHaveLength(3)
    expect(vias()[0]).toMatch(/^Referencia catastral —/)
    expect(vias()[1]).toMatch(/^Medición propia —/)
    expect(vias()[2]).toMatch(/^Abrir un GML —/)
  })

  it('en la rama EDIFICIO cambian la primera y la tercera', () => {
    // Un GML de construcción es entrada legítima allí, y «el tuyo o el de otro»
    // se quedaría corto.
    t.abrir({ rama: 'EDIFICIO' })
    expect(vias()[0]).toMatch(/^Origen del edificio —/)
    expect(vias()[2]).toMatch(/de parcela o de construcción/)
  })

  it('una rama desconocida cae en PARCELA, nunca en una lista vacía', () => {
    t.abrir({ rama: 'MARCIANA' })
    expect(vias()).toHaveLength(3)
  })
})

describe('⭐ el gesto APAGADO dice por qué (DESIGN.md §8)', () => {
  beforeEach(() => {
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
  })

  it('con el clic vivo, el bloque está activo', () => {
    t.abrir({ puedeDeducir: true })
    expect(gesto().dataset.estado).toBe('activo')
    expect(texto()).toMatch(/se rellena sola/i)
  })

  it('con una referencia ya en el modelo, se apaga CON el motivo escrito', () => {
    // `cableado-catastro.js#puedeDeducirClicando` apaga el clic a propósito ahí:
    // sustituir en silencio una referencia buena sería el error mudo de siempre.
    t.abrir({ puedeDeducir: false })
    expect(gesto().dataset.estado).toBe('pausa')
    expect(texto()).toMatch(/en pausa: ya hay una referencia en el expediente/i)
  })

  it('el titular NO se retira: sigue en pantalla, apagado', () => {
    t.abrir({ puedeDeducir: false })
    expect(texto()).toMatch(/busca tu parcela en el mapa y pínchala/i)
  })
})

describe('los cuatro cierres, y qué marca cada uno', () => {
  let almacen = null

  beforeEach(() => {
    almacen = almacenFalso()
    t = crearTarjetaBienvenida({ documento: document, almacen })
    t.abrir()
  })

  it('«Empezar» cierra y marca la llave', () => {
    document.querySelector('[data-accion="empezar-bienvenida"]').click()
    expect(t.estaAbierta()).toBe(false)
    expect(almacen.datos.get(LLAVE)).toBe('1')
  })

  it('el aspa cierra y marca', () => {
    document.querySelector('[data-accion="cerrar-bienvenida"]').click()
    expect(t.estaAbierta()).toBe(false)
    expect(almacen.datos.get(LLAVE)).toBe('1')
  })

  it('`Escape` cierra aunque el foco esté FUERA de la tarjeta', () => {
    // El oyente va en el `document` y no en la tarjeta: sin `showModal()` el foco
    // no está aquí dentro, así que un `keydown` en la tarjeta no llegaría nunca.
    document.getElementById('refcat').focus()
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(t.estaAbierta()).toBe(false)
    expect(almacen.datos.get(LLAVE)).toBe('1')
  })

  it('`cerrar()` a secas NO marca: un cierre técnico no prueba nada', () => {
    t.cerrar()
    expect(t.estaAbierta()).toBe(false)
    expect(almacen.datos.has(LLAVE)).toBe(false)
  })

  it('cerrar dos veces no vuelve a escribir ni lanza', () => {
    t.cerrar({ marcar: true })
    almacen.datos.delete(LLAVE)
    t.cerrar({ marcar: true })
    expect(almacen.datos.has(LLAVE)).toBe(false)
  })
})

describe('⛔ `localStorage` NO puede romper el arranque', () => {
  it('leer que LANZA se lee como «no la ha visto»: se enseña', () => {
    // El lado seguro del fallo. Equivocarse hacia aquí cuesta una tarjeta de más;
    // hacia el otro, un usuario nuevo sin ninguna ayuda y sin saber por qué.
    t = crearTarjetaBienvenida({
      documento: document,
      almacen: almacenFalso({ lanzaAlLeer: true, inicial: '1' }),
    })
    expect(t.yaVista()).toBe(false)
  })

  it('escribir que LANZA no revienta el cierre', () => {
    t = crearTarjetaBienvenida({
      documento: document,
      almacen: almacenFalso({ lanzaAlEscribir: true }),
    })
    t.abrir()
    expect(() => t.cerrar({ marcar: true })).not.toThrow()
    expect(t.estaAbierta()).toBe(false)
  })

  it('sin almacén ninguno, la tarjeta sigue funcionando entera', () => {
    t = crearTarjetaBienvenida({ documento: document, almacen: null })
    expect(t.yaVista()).toBe(false)
    t.abrir()
    expect(() => t.cerrar({ marcar: true })).not.toThrow()
  })

  it('con la llave puesta, `yaVista()` lo dice', () => {
    t = crearTarjetaBienvenida({
      documento: document,
      almacen: almacenFalso({ inicial: '1' }),
    })
    expect(t.yaVista()).toBe(true)
  })

  it('una llave de OTRA versión del texto no cuenta: se vuelve a enseñar', () => {
    t = crearTarjetaBienvenida({
      documento: document,
      almacen: almacenFalso({ inicial: '0' }),
    })
    expect(t.yaVista()).toBe(false)
  })
})

describe('`destruir`', () => {
  it('quita el nodo, suelta los oyentes y es IDEMPOTENTE', () => {
    const almacen = almacenFalso()
    t = crearTarjetaBienvenida({ documento: document, almacen })
    t.abrir()
    t.destruir()
    expect(tarjetaEl()).toBeNull()

    // El disparador ya no la resucita, y `Escape` ya no escribe nada.
    document.querySelector(SELECTOR_ABRIR_BIENVENIDA).click()
    document.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(tarjetaEl()).toBeNull()
    expect(almacen.datos.has(LLAVE)).toBe(false)

    expect(() => t.destruir()).not.toThrow()
    t = null
  })

  it('`abrir()` después de destruir no hace nada', () => {
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
    t.destruir()
    t.abrir()
    expect(t.estaAbierta()).toBe(false)
    t = null
  })
})

describe('el contrato con `index.html`', () => {
  it('el `menuitem` real de la cáscara anuncia que abre un diálogo', () => {
    // Para quien no ve la pantalla, «Cómo funciona» tiene que decir que abre algo.
    expect(
      document.querySelector(SELECTOR_ABRIR_BIENVENIDA).getAttribute('aria-haspopup'),
    ).toBe('dialog')
  })

  it('el selector casa EXACTAMENTE un nodo en el `index.html` de verdad', async () => {
    const { readFileSync } = await import('node:fs')
    const { join } = await import('node:path')
    const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8')
    const doc = new DOMParser().parseFromString(html, 'text/html')
    expect(doc.querySelectorAll(SELECTOR_ABRIR_BIENVENIDA)).toHaveLength(1)
  })
})

describe('no ensucia la consola', () => {
  it('montar, abrir y cerrar no escriben ni un `warn` ni un `error`', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    t = crearTarjetaBienvenida({ documento: document, almacen: almacenFalso() })
    t.abrir()
    t.cerrar({ marcar: true })
    expect(warn).not.toHaveBeenCalled()
    expect(error).not.toHaveBeenCalled()
    warn.mockRestore()
    error.mockRestore()
  })
})

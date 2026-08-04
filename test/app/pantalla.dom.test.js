/* -------------------------------------------------------------------------- *
 * test/app/pantalla.dom.test.js — Rework de UI · T6 · el eje PASO del panel    *
 *                                                                              *
 * `app/pantalla.js` escribe `data-paso` en la raíz y pone el título. **No       *
 * oculta nada**: quien esconde las secciones que no tocan son cinco reglas de   *
 * `estilos/app.css`. Eso parte la verificación en dos mitades, y las dos están  *
 * aquí porque las dos pueden fallar EN SILENCIO:                                *
 *                                                                              *
 *   1. **El atributo.** Que la raíz diga en qué paso está, y que el título      *
 *      cambie con él.                                                           *
 *   2. ⭐ **La coherencia entre el marcado y el CSS**, que es donde vive el      *
 *      fallo mudo. jsdom no aplica hojas de estilo, así que aquí no se puede    *
 *      medir si una sección se ve; lo que sí se puede —y es lo que de verdad    *
 *      protege— es exigir que **cada valor de `data-pantalla` sea un paso que   *
 *      existe** y que **cada paso tenga su regla en el CSS**. Un                *
 *      `data-pantalla="validacon"` con la errata no rompe nada: simplemente esa *
 *      sección no se vería NUNCA, en ninguna pantalla, y nadie se enteraría.    *
 *      Y un paso sin regla enseñaría las cinco secciones a la vez.              *
 *                                                                              *
 * Lo que se ve de verdad se mide en un navegador: `scripts/smoke-navegador/     *
 * 14-shell.js`, que es quien puede leer una maquetación.                         *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, vi, afterEach } from 'vitest'

import { PASO, PASOS, crearNavegacion } from '../../app/navegacion.js'
import {
  ATRIBUTO_PANTALLA,
  ATRIBUTO_PASO,
  SELECTOR_APP,
  SELECTOR_TITULO,
  TITULO_PANTALLA,
  cablearPantalla,
  pasosConTitulo,
} from '../../app/pantalla.js'
import { SELECTOR_RAIL } from '../../app/rail.js'

const RAIZ = join(import.meta.dirname, '..', '..')
const CSS = readFileSync(join(RAIZ, 'estilos', 'app.css'), 'utf8')

const INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/pantalla.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara ' +
        'de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const atributos = [...encontrado[1].matchAll(/([\w-]+)\s*=\s*"([^"]*)"/g)].map(([, n, v]) => [n, v])
  return { atributos, cuerpo: encontrado[2] }
})()

/** Monta la cáscara real CON los atributos de la etiqueta `<body>`: `innerHTML`
 *  copia lo de dentro y nada de la etiqueta, y sin `data-app` esto no cablea. */
function montarCascara() {
  for (const [nombre, valor] of INDEX.atributos) document.body.setAttribute(nombre, valor)
  document.body.innerHTML = INDEX.cuerpo
}

let vivo = null
afterEach(() => {
  vivo?.destruir()
  vivo = null
  for (const [nombre] of INDEX.atributos) document.body.removeAttribute(nombre)
})

function cablear({ paso = PASO.ENTRADA, hechos = {} } = {}) {
  montarCascara()
  const navegacion = crearNavegacion({ paso, hechos, avisar: () => {} })
  vivo = cablearPantalla({ documento: document, navegacion })
  return { pantalla: vivo, navegacion }
}

const raiz = () => document.querySelector(SELECTOR_APP)
const titulo = () => document.querySelector(SELECTOR_TITULO)
const secciones = () => Array.from(document.querySelectorAll(`[${ATRIBUTO_PANTALLA}]`))

const TODO = { geometria: true, oficial: true, diagnostico: true }

// ─────────────────────────────────────────────────────────────────────────────

describe('T6 · el contrato de marcado', () => {
  it('`index.html` trae la raíz y el título, uno de cada', () => {
    montarCascara()
    expect(document.querySelectorAll(SELECTOR_APP)).toHaveLength(1)
    expect(document.querySelectorAll(SELECTOR_TITULO)).toHaveLength(1)
  })

  it('la raíz ES el `<body>`, y por eso hay que reponer sus atributos a mano', () => {
    montarCascara()
    expect(raiz()).toBe(document.body)
  })

  it('sin la raíz, cablear LANZA nombrando el selector', () => {
    montarCascara()
    document.body.removeAttribute('data-app')
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => cablearPantalla({ documento: document, navegacion })).toThrow(/data-app="cascara"/)
  })

  it('sin documento o sin navegación, cablear LANZA', () => {
    montarCascara()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => cablearPantalla({ navegacion })).toThrow(TypeError)
    expect(() => cablearPantalla({ documento: document })).toThrow(TypeError)
  })
})

describe('T6 · ⭐ marcado y CSS dicen lo mismo (el fallo mudo)', () => {
  it('todo valor de `data-pantalla` es un paso que EXISTE', () => {
    montarCascara()
    expect(secciones().length, 'no hay ni una sección marcada: el eje PASO no está cableado').toBeGreaterThan(0)
    for (const seccion of secciones()) {
      const declarados = seccion.getAttribute(ATRIBUTO_PANTALLA).split(/\s+/).filter(Boolean)
      expect(declarados.length, `«${seccion.className}» declara un data-pantalla vacío`).toBeGreaterThan(0)
      for (const paso of declarados) {
        expect(
          PASOS,
          `«${seccion.className}» pertenece a «${paso}», que no es un paso. Una errata aquí NO ` +
            `rompe nada: esa sección no se vería NUNCA, en ninguna pantalla, y nadie se enteraría`,
        ).toContain(paso)
      }
    }
  })

  it('cada paso tiene su regla en `estilos/app.css`', () => {
    // Sin la regla, ese paso enseñaría las CINCO secciones a la vez: el selector
    // no casa, nada se oculta, y tampoco avisa nadie.
    for (const paso of PASOS) {
      expect(
        CSS,
        `falta la regla de pantalla de «${paso}» en estilos/app.css: ese paso enseñaría todas ` +
          `las secciones a la vez`,
      ).toContain(`.gml-app[data-paso='${paso}'] [data-pantalla]:not([data-pantalla~='${paso}'])`)
    }
  })

  it('⛔ ninguna sección del RAIL lleva `data-pantalla` (se autoocultarían)', () => {
    // La regla del CSS es de DESCENDENCIA, así que `data-pantalla` dentro del rail
    // haría que los peldaños se ocultaran entre ellos. Es el motivo por el que el
    // rail usa `data-paso` y el panel `data-pantalla`, y no al revés.
    montarCascara()
    const rail = document.querySelector(SELECTOR_RAIL)
    expect(rail).not.toBeNull()
    expect(rail.querySelectorAll(`[${ATRIBUTO_PANTALLA}]`)).toHaveLength(0)
  })

  it('los canales que NO pueden desaparecer no declaran pantalla', () => {
    montarCascara()
    // Los avisos son el canal de errores de la aplicación entera: esconderlo al
    // cambiar de paso sería el peor fallo silencioso que esta cáscara puede tener.
    for (const selector of ['.gml-bloque--avisos', '.gml-panel-cabecera']) {
      const nodo = document.querySelector(selector)
      expect(nodo, `${selector} ha desaparecido de index.html`).not.toBeNull()
      expect(
        nodo.hasAttribute(ATRIBUTO_PANTALLA),
        `${selector} declara pantalla, así que desaparece en las demás`,
      ).toBe(false)
    }
  })

  it('la Entrada y la caja de vértices están en pantallas DISTINTAS', () => {
    // Es la afirmación entera de T6: si las dos se vieran a la vez, las tres vías
    // no tendrían sitio y volveríamos al panel de siempre.
    montarCascara()
    const entrada = document.querySelector('.gml-bloque--catastro').getAttribute(ATRIBUTO_PANTALLA)
    const vertices = document.querySelector('.gml-bloque--vertices').getAttribute(ATRIBUTO_PANTALLA)
    expect(entrada.split(/\s+/)).toContain(PASO.ENTRADA)
    expect(vertices.split(/\s+/)).not.toContain(PASO.ENTRADA)
    expect(vertices.split(/\s+/)).toContain(PASO.VALIDACION)
  })

  it('el pie del panel tampoco está en Entrada (mide 266 px y no cabía)', () => {
    montarCascara()
    const pie = document.querySelector('.gml-panel-pie')
    expect(pie.getAttribute(ATRIBUTO_PANTALLA).split(/\s+/)).not.toContain(PASO.ENTRADA)
    // Y sigue CONECTADO con todo su cableado: se oculta, no se quita.
    expect(pie.isConnected).toBe(true)
    expect(pie.querySelector('[data-accion="generar-gml"]')).not.toBeNull()
    expect(pie.querySelectorAll('[data-ficha]').length).toBeGreaterThan(0)
  })
})

describe('T6 · el atributo y el título', () => {
  it('escribe el paso en la raíz desde el arranque', () => {
    const { pantalla } = cablear()
    expect(raiz().getAttribute(ATRIBUTO_PASO)).toBe(PASO.ENTRADA)
    expect(pantalla.get()).toBe(PASO.ENTRADA)
  })

  it('sigue a la navegación', () => {
    const { navegacion } = cablear({ hechos: TODO })
    navegacion.navegarAPaso(PASO.DIAGNOSTICO)
    expect(raiz().getAttribute(ATRIBUTO_PASO)).toBe(PASO.DIAGNOSTICO)
  })

  it('el título cambia con la pantalla, y los CINCO pasos tienen el suyo', () => {
    const { navegacion } = cablear({ hechos: TODO })
    expect(pasosConTitulo()).toEqual([...PASOS])
    for (const paso of PASOS) {
      navegacion.navegarAPaso(paso)
      expect(titulo().textContent).toBe(TITULO_PANTALLA[paso])
    }
  })

  it('⭐ el título de la pantalla NO es el rótulo del rail', () => {
    // El rail dice «Entrada» porque tiene 210 px; la pantalla dice «Empieza tu
    // expediente», que es la respuesta directa a «no sé por dónde empezar». Si
    // algún día se unificaran, se perdería la segunda.
    expect(TITULO_PANTALLA[PASO.ENTRADA]).toBe('Empieza tu expediente')
    expect(TITULO_PANTALLA[PASO.ENTRADA]).not.toBe('Entrada')
  })

  it('`index.html` arranca con el título de la pantalla inicial', () => {
    // Es lo que se ve durante el instante anterior al montaje. Si dijera otra
    // cosa, la pantalla parpadearía con un título que no es el suyo.
    montarCascara()
    expect(titulo().textContent.trim()).toBe(TITULO_PANTALLA[PASO.ENTRADA])
  })

  it('sin `<h1>` no revienta: es una respuesta prevista', () => {
    montarCascara()
    const navegacion = crearNavegacion({ avisar: () => {} })
    expect(() => {
      vivo = cablearPantalla({ documento: document, navegacion, titulo: null })
    }).not.toThrow()
    expect(raiz().getAttribute(ATRIBUTO_PASO)).toBe(PASO.ENTRADA)
  })
})

describe('T6 · destruir', () => {
  it('quita el atributo, repone el título y es IDEMPOTENTE', () => {
    const { pantalla, navegacion } = cablear({ hechos: TODO })
    navegacion.navegarAPaso(PASO.INFORME)
    expect(titulo().textContent).toBe(TITULO_PANTALLA[PASO.INFORME])

    pantalla.destruir()
    pantalla.destruir()
    vivo = null

    expect(raiz().hasAttribute(ATRIBUTO_PASO)).toBe(false)
    expect(titulo().textContent).toBe(TITULO_PANTALLA[PASO.ENTRADA])
    // Y no se queda escuchando.
    navegacion.navegarAPaso(PASO.VALIDACION)
    expect(raiz().hasAttribute(ATRIBUTO_PASO)).toBe(false)
  })
})

describe('T6 · las tres vías de Entrada (criterio 7)', () => {
  it('hay TRES vías nombradas, cada una con su rótulo y su acción', () => {
    montarCascara()
    const vias = Array.from(document.querySelectorAll('.gml-via'))
    expect(vias).toHaveLength(3)
    for (const via of vias) {
      expect(via.querySelector('h2')?.textContent.trim().length ?? 0).toBeGreaterThan(0)
      expect(via.querySelector('.gml-via-apunte')?.textContent.trim().length ?? 0).toBeGreaterThan(0)
    }
    expect(vias.map((v) => v.querySelector('h2').textContent.trim())).toEqual([
      'Referencia catastral',
      'Medición propia',
      'Comprobar un GML existente',
    ])
  })

  it('⭐ la MEDICIÓN PROPIA estrena botón: hasta T6 solo se podía arrastrar', () => {
    montarCascara()
    const boton = document.querySelector('[data-accion="abrir-medicion"]')
    expect(boton, 'la vía de medición propia no tiene control visible').not.toBeNull()
    expect(boton.closest('.gml-via')).toBe(document.querySelectorAll('.gml-via')[1])
  })

  it('las tres vías van SEPARADAS por un «O bien», que dice que son alternativas', () => {
    montarCascara()
    const separadores = document.querySelectorAll('.gml-obien')
    expect(separadores).toHaveLength(2) // tres vías ⇒ dos separadores
    for (const sep of separadores) expect(sep.textContent.trim()).toBe('O bien')
  })

  it('los botones de las tres vías ya NO viven en la fila del rótulo', () => {
    // Criterio 7, literal: «no como botones sueltos compitiendo en una fila del
    // rótulo». Ahí es donde F08 metió «Abrir un GML…» por una razón de altura que
    // en esta pantalla ya no aplica.
    montarCascara()
    for (const accion of ['abrir-gml', 'abrir-medicion']) {
      const boton = document.querySelector(`[data-accion="${accion}"]`)
      expect(boton.closest('.gml-rotulo-fila'), `«${accion}» sigue en la fila del rótulo`).toBeNull()
      expect(boton.closest('.gml-via'), `«${accion}» no está dentro de una vía`).not.toBeNull()
    }
  })

  it('la cuarta vía existe y va aparte: recuperar no es empezar', () => {
    montarCascara()
    const pie = document.querySelector('.gml-entrada-pie')
    expect(pie).not.toBeNull()
    expect(pie.querySelector('[data-accion="abrir-expediente"]')).not.toBeNull()
    expect(pie.closest('.gml-via')).toBeNull()
  })
})

/* -------------------------------------------------------------------------- *
 * test/app/dialogo-diccionario.dom.test.js — F15 · T2                          *
 *                                                                              *
 * La pantalla del diccionario de errores de la Sede. Lo que se guarda aquí:     *
 *                                                                              *
 *   · Que ABRE CON TODO PUESTO (decisión 6 de la entrevista del 2026-08-11).    *
 *     Es lo que dictan los dos únicos mensajes de rechazo medidos, que son      *
 *     genéricos: una pantalla que arrancara vacía sería inútil justo con ellos. *
 *   · Que pegar el mensaje REAL del IVG y el del ICUC deja su causa la primera  *
 *     y DESPLEGADA, diciendo que casa con el literal.                           *
 *   · Que la procedencia se ve: `MEDIDO` y `COMUNIDAD` no pueden leerse igual   *
 *     de fiables, que es la mitad del valor de este diccionario.                *
 *   · Que sin el `menuitem` de `index.html` el montaje LANZA — una pantalla     *
 *     inalcanzable es el modo de fallo que esta fase existe para no repetir.    *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom). Sin Leaflet: este módulo solo importa el       *
 * cargador del diccionario.                                                     *
 * -------------------------------------------------------------------------- */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'

import {
  crearDialogoDiccionario,
  SELECTOR_ABRIR_DICCIONARIO,
} from '../../app/dialogo-diccionario.js'
import { ERRORES_IVG } from '../../config/errores-ivg.js'

/**
 * La cáscara MÍNIMA: la opción del menú, que es todo el contrato de este diálogo
 * con `index.html`. El `<dialog>` entero lo fabrica el módulo.
 */
function montarCascara() {
  document.body.className = 'gml-app'
  document.body.innerHTML = `
    <nav class="gml-barra">
      <div class="gml-barra-menu" role="menu" data-menu="expediente" hidden>
        <button type="button" role="menuitem" data-accion="abrir-expediente">Expedientes guardados</button>
        <button type="button" role="menuitem" data-accion="consultar-rechazo">Me han rechazado el fichero</button>
      </div>
    </nav>
  `
  return document.querySelector(SELECTOR_ABRIR_DICCIONARIO)
}

/** Los dos mensajes que la Sede ha devuelto DE VERDAD a este proyecto. */
const MENSAJE_IVG = 'El archivo no cumple el esquema Inspire GML'
const MENSAJE_ICUC =
  'Los siguientes ficheros no se han cargado al no ser válidos: - edificio_9398516VK3799G_2026-08-06T21-19-34.gml'

const fichas = () => [...document.querySelectorAll('#gml-diccionario .gml-diccionario-entrada')]
const claves = () => fichas().map((f) => f.dataset.clave)
const cuenta = () => document.querySelector('.gml-diccionario-cuenta')?.textContent ?? ''

/** Teclea en el campo como lo haría el usuario: valor + evento `input`. */
function teclear(dlg, texto) {
  dlg.campo.value = texto
  dlg.campo.dispatchEvent(new window.Event('input', { bubbles: true }))
}

let dlg = null

beforeEach(() => {
  montarCascara()
})

afterEach(() => {
  dlg?.destruir()
  dlg = null
  document.body.innerHTML = ''
  document.body.className = ''
})

describe('F15 · el diálogo se monta y se alcanza desde el menú', () => {
  it('lo abre el `menuitem` de la barra, y no hace falta nada más', () => {
    dlg = crearDialogoDiccionario({ documento: document })
    expect(dlg.estaAbierto()).toBe(false)

    document.querySelector(SELECTOR_ABRIR_DICCIONARIO).click()
    expect(dlg.estaAbierto()).toBe(true)
    expect(document.querySelector('.gml-dialogo-diccionario')).not.toBeNull()
  })

  it('⛔ LANZA si el `menuitem` no está: una pantalla inalcanzable se dice al montar', () => {
    // Es la lección que esta fase paga por adelantado. `model/edificio.js` pasó
    // diez fases sin llamante, `parsers/dxf.js` once y el pegado de LIST doce,
    // todas en verde. Aquí el montaje se niega en vez de quedarse mudo.
    document.body.innerHTML = ''
    expect(() => crearDialogoDiccionario({ documento: document })).toThrow(TypeError)
    expect(() => crearDialogoDiccionario({ documento: document })).toThrow(
      /consultar-rechazo|contrato de index\.html/,
    )
  })

  it('anuncia que abre un diálogo, para quien no ve la pantalla', () => {
    dlg = crearDialogoDiccionario({ documento: document })
    expect(
      document.querySelector(SELECTOR_ABRIR_DICCIONARIO).getAttribute('aria-haspopup'),
    ).toBe('dialog')
  })
})

describe('F15 · ⭐ abre con el diccionario ENTERO puesto', () => {
  beforeEach(() => {
    dlg = crearDialogoDiccionario({ documento: document })
    dlg.abrir()
  })

  it('enseña las 23 entradas sin haber escrito nada', () => {
    expect(fichas()).toHaveLength(ERRORES_IVG.length)
    expect(dlg.visibles()).toBe(ERRORES_IVG.length)
    expect(claves()).toEqual(ERRORES_IVG.map((e) => e.clave))
  })

  it('dice cuántas hay, aunque no esté filtrando', () => {
    expect(cuenta()).toContain(String(ERRORES_IVG.length))
    expect(cuenta()).toMatch(/sin filtrar/i)
  })

  it('todas nacen PLEGADAS: la columna que se ojea es la de claves', () => {
    expect(fichas().filter((f) => f.open)).toHaveLength(0)
  })

  it('«Ver el diccionario entero» nace apagado, porque no hay nada que deshacer', () => {
    const limpiar = document.querySelector('[data-accion="limpiar-diccionario"]')
    expect(limpiar.disabled).toBe(true)
  })

  it('el foco va al campo: se entra aquí con el mensaje en el portapapeles', () => {
    expect(document.activeElement).toBe(dlg.campo)
  })
})

describe('F15 · pegar el mensaje real de la Sede', () => {
  beforeEach(() => {
    dlg = crearDialogoDiccionario({ documento: document })
    dlg.abrir()
  })

  it('el del IVG (2026-07-27) deja su causa LA PRIMERA y desplegada', () => {
    teclear(dlg, MENSAJE_IVG)
    expect(claves()[0]).toBe('wfs:FeatureCollection en la raíz')
    expect(fichas()[0].open).toBe(true)
    expect(fichas()[0].textContent).toContain('Casa con el mensaje literal')
  })

  it('el del ICUC (2026-08-06) deja su causa LA PRIMERA y desplegada', () => {
    teclear(dlg, MENSAJE_ICUC)
    expect(claves()[0]).toBe('falta xmlns:xlink en la raíz')
    expect(fichas()[0].open).toBe(true)
  })

  it('la ficha desplegada trae los tres apartados de la ficha de F15', () => {
    teclear(dlg, MENSAJE_IVG)
    const texto = fichas()[0].textContent
    expect(texto).toContain('Qué significa')
    expect(texto).toContain('Qué suele haber pasado')
    expect(texto).toContain('Qué hacer')
  })

  it('solo se despliega la primera, y solo si ha casado por el literal', () => {
    teclear(dlg, MENSAJE_IVG)
    expect(fichas().filter((f) => f.open)).toHaveLength(1)

    // Casar por palabras sueltas NO despliega: la puntuación no respalda esa
    // certeza y abrir la primera prometería una respuesta que no se tiene.
    teclear(dlg, 'anillo')
    expect(fichas().filter((f) => f.open)).toHaveLength(0)
  })

  it('⛔ la cuenta SEPARA lo que casa por el literal de lo que solo comparte palabras', () => {
    // Lo destapó el guion 26 sobre el navegador real: con el mensaje del IVG
    // casaban 15 de 23, pero solo UNA por el literal — las otras catorce
    // compartían «archivo» o «esquema», que en un diccionario de errores de
    // esquema las comparte medio catálogo. «15 casan» era la aplicación
    // afirmando más de lo que sabe.
    teclear(dlg, MENSAJE_IVG)
    const t = cuenta()
    expect(t).toMatch(/1 entrada casa con el mensaje literal/)
    expect(t).toMatch(/comparten palabras/)
    // Y el número gordo NO puede leerse como si todas casaran.
    expect(t).not.toMatch(new RegExp(`^${fichas().length} `))
  })

  it('sin ningún casamiento literal, la cuenta lo dice en voz baja', () => {
    teclear(dlg, 'anillo')
    expect(cuenta()).toMatch(/comparten palabras|comparte palabras/)
    expect(cuenta()).not.toMatch(/literal/)
  })

  it('cuando solo hay literales, no habla de palabras sueltas', () => {
    teclear(dlg, 'funtional')
    expect(cuenta()).toMatch(/casa con el mensaje literal/)
    expect(cuenta()).not.toMatch(/comparte/)
  })

  it('cuando no casa nada lo DICE, en vez de dejar la lista muda', () => {
    teclear(dlg, 'zzzqqq wwwxxx yyyvvv')
    expect(fichas()).toHaveLength(0)
    const vacio = document.querySelector('.gml-diccionario-vacio')
    expect(vacio).not.toBeNull()
    expect(vacio.textContent).toContain('config/errores-ivg.json')
  })

  it('«Ver el diccionario entero» devuelve las 23 y se vuelve a apagar', () => {
    teclear(dlg, MENSAJE_IVG)
    expect(fichas().length).toBeLessThan(ERRORES_IVG.length)

    const limpiar = document.querySelector('[data-accion="limpiar-diccionario"]')
    expect(limpiar.disabled).toBe(false)
    limpiar.click()

    expect(fichas()).toHaveLength(ERRORES_IVG.length)
    expect(dlg.campo.value).toBe('')
    expect(limpiar.disabled).toBe(true)
  })
})

describe('F15 · la procedencia se VE, que es la mitad del valor', () => {
  beforeEach(() => {
    dlg = crearDialogoDiccionario({ documento: document })
    dlg.abrir()
  })

  it('cada ficha lleva su procedencia y su trámite en el marcado', () => {
    for (const ficha of fichas()) {
      expect(ficha.dataset.diccionarioProcedencia, `«${ficha.dataset.clave}»`).toBeTruthy()
      expect(['IVG', 'ICUC', 'AMBOS']).toContain(ficha.dataset.validador)
    }
  })

  it('`MEDIDO` y `COMUNIDAD` NO se leen igual: el rótulo lo dice con palabras', () => {
    const medida = fichas().find((f) => f.dataset.diccionarioProcedencia === 'MEDIDO')
    const decomunidad = fichas().find((f) => f.dataset.diccionarioProcedencia === 'COMUNIDAD')
    expect(medida.textContent).toContain('Medido contra la Sede')
    expect(decomunidad.textContent).toMatch(/sin comprobar/i)
  })

  it('las tres entradas que enmiendan el catálogo ajeno enseñan su aviso', () => {
    const conCorreccion = fichas().filter((f) =>
      f.querySelector('.gml-diccionario-correccion'),
    )
    expect(conCorreccion).toHaveLength(3)
    for (const f of conCorreccion) {
      expect(f.querySelector('.gml-diccionario-correccion').textContent).toContain('§1.5')
    }
  })

  it('buscar «orientación» saca que NO es causa de rechazo', () => {
    teclear(dlg, 'orientación')
    expect(claves()[0]).toBe('orientación de los anillos')
    fichas()[0].open = true
    expect(fichas()[0].textContent).toMatch(/NO ES CAUSA DE RECHAZO/i)
  })
})

describe('F15 · abrir, cerrar y no dejar rastro', () => {
  beforeEach(() => {
    dlg = crearDialogoDiccionario({ documento: document })
  })

  it('`Escape` cierra, y cerrar es IDEMPOTENTE', () => {
    dlg.abrir()
    dlg.nodo.dispatchEvent(new window.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(dlg.estaAbierto()).toBe(false)
    expect(() => {
      dlg.cerrar()
      dlg.cerrar()
    }).not.toThrow()
  })

  it('un clic en el velo cierra: aquí cerrar no pierde nada', () => {
    dlg.abrir()
    dlg.nodo.dispatchEvent(new window.MouseEvent('click', { bubbles: true }))
    expect(dlg.estaAbierto()).toBe(false)
  })

  it('«Cerrar» cierra', () => {
    dlg.abrir()
    document.querySelector('[data-accion="cerrar-diccionario"]').click()
    expect(dlg.estaAbierto()).toBe(false)
  })

  it('⚠️ NO se vacía el campo al cerrar: quien vuelve, vuelve a lo que leía', () => {
    dlg.abrir()
    teclear(dlg, MENSAJE_IVG)
    dlg.cerrar()
    dlg.abrir()
    expect(dlg.campo.value).toBe(MENSAJE_IVG)
    expect(claves()[0]).toBe('wfs:FeatureCollection en la raíz')
  })

  it('`destruir` se lleva el `<dialog>` y suelta el disparador', () => {
    dlg.abrir()
    dlg.destruir()
    expect(document.querySelector('.gml-dialogo-diccionario')).toBeNull()
    expect(
      document.querySelector(SELECTOR_ABRIR_DICCIONARIO).hasAttribute('aria-haspopup'),
    ).toBe(false)

    // Y el disparador ya no abre nada: sin esto, `destruir` dejaría un oyente
    // apuntando a un nodo desconectado, que es fuga y fallo silencioso a la vez.
    document.querySelector(SELECTOR_ABRIR_DICCIONARIO).click()
    expect(document.querySelector('.gml-dialogo-diccionario')).toBeNull()

    dlg = null
  })

  it('abrir con texto deja la búsqueda hecha (el gancho para el día que un aviso lo ofrezca)', () => {
    dlg.abrir(MENSAJE_ICUC)
    expect(dlg.campo.value).toBe(MENSAJE_ICUC)
    expect(claves()[0]).toBe('falta xmlns:xlink en la raíz')
  })
})

// test/viewer/barra-edicion.dom.test.js — F06 · La barra flotante de edición.
//
// ── QUÉ PROTEGE ESTE FICHERO, POR ORDEN DE IMPORTANCIA ──────────────────────
//
// 1. **Que `app/main.js` no se entere del cambio.** El bloque «Edición» se va del
//    panel lateral al mapa, y `app/main.js#cablearEdicion` localiza sus nodos POR
//    SELECTOR al llamarla. Si la barra produce los mismos siete nodos con los
//    mismos `data-*` y los mismos tipos de elemento, no hay que tocar ni ese
//    módulo, ni sus 61 pruebas, ni el guion de navegador `08-edicion.js`.
//
//    Los siete selectores NO se escriben aquí a mano: se LEEN de la fuente de
//    `app/main.js` (`readFileSync` + las constantes `SELECTOR_*` que ese módulo
//    exporta). Escribirlos a mano habría dejado dos listas que se pueden separar
//    en silencio —y la que se quedaría vieja sería esta—; leerlos del disco hace
//    que renombrar un selector en `main.js`, o cambiar su valor, ponga ESTE test
//    en rojo nombrando la constante. Es el mismo recurso que usan
//    `test/contrato.test.js` y `test/viewer/contrato-capas.dom.test.js`.
//
//    ⚠️ No se puede `import` de `app/main.js`: es la ENTRADA de la app y arranca
//    el visor entero al importarse (efectos de módulo de primer nivel). Por eso
//    se lee como texto.
//
// 2. **Que los campos de los desplegables existan con el desplegable CERRADO.**
//    Si se crearan al abrir, el `nodo()` de `app/main.js` lanzaría en el arranque
//    y `08-edicion.js` —que teclea 300 cm en la tolerancia sin abrir nada— se
//    quedaría sin campo.
//
// 3. **Que un clic en la barra no seleccione un lindero por debajo** ni la rueda
//    haga zoom: el fallo clásico de un control de Leaflet.
//
// 4. **Que «pinchar fuera» cierre sin comerse el clic del mapa.** El test mide las
//    dos mitades: el desplegable se cierra Y el mapa recibe su `click`.
//
// Proyecto Vitest `dom` (jsdom): el módulo importa Leaflet → solo-navegador.
// NINGUNA petición de red: aquí no se monta ni una capa.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import { CLASE_BARRA, GESTOS, crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { UMBRAL_PUNTERIA_PX } from '../../viewer/edicion.js'
import { montarMapa } from './_ayuda-jsdom.js'

// ── Los siete selectores, leídos de `app/main.js` ────────────────────────────

/**
 * Raíz del repositorio.
 *
 * ⚠️ `import.meta.dirname` y NO `new URL('../../', import.meta.url)`: bajo jsdom
 * el `URL` global resuelve contra el DOCUMENTO y `fileURLToPath` revienta con
 * `ERR_INVALID_URL_SCHEME`. Está documentado en
 * `test/viewer/contrato-capas.dom.test.js`, que tropezó con ello primero.
 */
const RAIZ = join(import.meta.dirname, '..', '..')

const FUENTE_MAIN = readFileSync(join(RAIZ, 'app', 'main.js'), 'utf8')

/**
 * El CONTRATO, como pareja «constante de `app/main.js`» → «qué elemento tiene que
 * ser». Los nombres de las constantes son lo único escrito a mano (son el
 * contrato); los VALORES salen de la fuente.
 */
const CONTRATO = Object.freeze([
  { constante: 'SELECTOR_BOTON_DESHACER', etiqueta: 'BUTTON' },
  { constante: 'SELECTOR_BOTON_REHACER', etiqueta: 'BUTTON' },
  { constante: 'SELECTOR_CAMPO_SNAP', etiqueta: 'INPUT', tipo: 'checkbox' },
  { constante: 'SELECTOR_CAMPO_TOLERANCIA', etiqueta: 'INPUT', tipo: 'number' },
  { constante: 'SELECTOR_CAMPO_OFFSET', etiqueta: 'INPUT', tipo: 'number' },
  { constante: 'SELECTOR_BOTON_OFFSET', etiqueta: 'BUTTON' },
  { constante: 'SELECTOR_ESTADO_EDICION', etiqueta: 'P' },
])

/**
 * El VALOR de una constante `SELECTOR_*` exportada por `app/main.js`, leído de su
 * fuente. Lanza si no la encuentra: una guarda que no encuentra a su sujeto pasa
 * en verde sin vigilar nada, que es exactamente lo que no queremos.
 *
 * @param {string} nombre
 * @returns {string}
 */
function selectorDeMain(nombre) {
  const encontrado = new RegExp(`export const ${nombre} = '([^']+)'`).exec(FUENTE_MAIN)
  if (encontrado === null) {
    throw new Error(
      `test/viewer/barra-edicion.dom.test.js: 'app/main.js' ya no exporta ${nombre}. ` +
        `Los siete selectores de cablearEdicion son el CONTRATO de viewer/barra-edicion.js: ` +
        `si se han renombrado, hay que actualizar la barra y esta lista a la vez.`,
    )
  }
  return encontrado[1]
}

/** Los siete selectores, ya resueltos, indexados por nombre de constante. */
const SELECTOR = Object.fromEntries(
  CONTRATO.map(({ constante }) => [constante, selectorDeMain(constante)]),
)

// ── Arnés ────────────────────────────────────────────────────────────────────

/** Limpieza garantizada aunque un `expect` falle a mitad de test. */
const pendientes = []
afterEach(() => {
  while (pendientes.length) {
    const limpiar = pendientes.pop()
    try {
      limpiar()
    } catch {
      /* la limpieza nunca debe enmascarar el fallo real del test */
    }
  }
})

/**
 * Mapa del arnés + barra montada, con su limpieza registrada.
 *
 * @param {object} [opciones]  Se pasan tal cual a `crearBarraEdicion`.
 */
function montarBarra(opciones = {}) {
  const { mapa, contenedor, destruir: destruirMapa } = montarMapa()
  const barra = crearBarraEdicion({ mapa, ...opciones })
  pendientes.push(() => {
    barra.destruir()
    destruirMapa()
  })
  return { mapa, contenedor, barra }
}

/** `document.querySelector` con un fallo legible cuando no encuentra nada. */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  expect(encontrado, `no hay ningún nodo '${selector}' en el documento`).not.toBeNull()
  return encontrado
}

const clic = (elemento) =>
  elemento.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))

const tecla = (destino, key) =>
  destino.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }))

/** Los tres desplegables/paneles de la barra, por su `data-panel`. */
const panel = (nombre) => nodo(`[data-panel="${nombre}"]`)

// ── 1 · El contrato con `app/main.js#cablearEdicion` ─────────────────────────

describe('barra de edición · los SIETE nodos del contrato de app/main.js', () => {
  it('los siete selectores de cablearEdicion encuentran EXACTAMENTE un nodo', () => {
    montarBarra()
    for (const { constante } of CONTRATO) {
      const selector = SELECTOR[constante]
      expect(
        document.querySelectorAll(selector).length,
        `${constante} = ${selector}: cablearEdicion hace document.querySelector con esto`,
      ).toBe(1)
    }
  })

  it('cada nodo es del TIPO de elemento que cablearEdicion presupone', () => {
    montarBarra()
    for (const { constante, etiqueta, tipo } of CONTRATO) {
      const encontrado = nodo(SELECTOR[constante])
      expect(encontrado.tagName, `${constante}: etiqueta`).toBe(etiqueta)
      if (tipo !== undefined) expect(encontrado.type, `${constante}: type`).toBe(tipo)
    }
  })

  it('la casilla del ajuste sigue siendo un checkbox MARCADO (main.js lee .checked)', () => {
    montarBarra()
    const casilla = nodo(SELECTOR.SELECTOR_CAMPO_SNAP)
    expect(casilla.checked).toBe(true)
    // Marcada por ATRIBUTO, como lo estaba en `index.html`: `checked` no refleja.
    expect(casilla.hasAttribute('checked')).toBe(true)
  })

  it('la tolerancia nace en 20 cm, con min 0 y step 1 (la cifra de OPERATIVOS)', () => {
    montarBarra()
    const campo = nodo(SELECTOR.SELECTOR_CAMPO_TOLERANCIA)
    // 20 cm = `OPERATIVOS.snapMetros` (0,2 m). El módulo lo DERIVA; este literal
    // es el otro extremo de la cuerda: si alguien cambia la tolerancia operativa,
    // este test se pone rojo y obliga a mirar si el cambio era intencionado.
    expect(campo.value).toBe('20')
    expect(campo.getAttribute('min')).toBe('0')
    expect(campo.getAttribute('step')).toBe('1')
  })

  it('la distancia del offset va en METROS, con step de 0,01', () => {
    montarBarra()
    expect(nodo(SELECTOR.SELECTOR_CAMPO_OFFSET).getAttribute('step')).toBe('0.01')
  })

  it('los tres botones que main.js gobierna nacen DESHABILITADOS', () => {
    montarBarra()
    expect(nodo(SELECTOR.SELECTOR_BOTON_DESHACER).disabled).toBe(true)
    expect(nodo(SELECTOR.SELECTOR_BOTON_REHACER).disabled).toBe(true)
    expect(nodo(SELECTOR.SELECTOR_BOTON_OFFSET).disabled).toBe(true)
  })

  it('el renglón de estado es un <p role="status"> VACÍO y con la clase del panel', () => {
    montarBarra()
    const renglon = nodo(SELECTOR.SELECTOR_ESTADO_EDICION)
    expect(renglon.getAttribute('role')).toBe('status')
    // Vacío al nacer: `cablearEdicion` solo escribe su rótulo inicial si lo está.
    expect(renglon.textContent).toBe('')
    // `gml-accion-estado` es la clase que ya lleva el `:empty{display:none}` y la
    // que `app/main.js` usa de raíz para el modificador `--error`.
    expect(renglon.classList.contains('gml-accion-estado')).toBe(true)
    expect(renglon.classList.contains(CLASE_BARRA.ESTADO)).toBe(true)
  })

  it('los botones del historial llevan su <kbd> dentro (nadie les toca el textContent)', () => {
    montarBarra()
    const deshacer = nodo(SELECTOR.SELECTOR_BOTON_DESHACER)
    const rehacer = nodo(SELECTOR.SELECTOR_BOTON_REHACER)
    expect(deshacer.querySelector('kbd').textContent).toBe('Ctrl+Z')
    expect(rehacer.querySelector('kbd').textContent).toBe('Ctrl+Y')
    expect(deshacer.getAttribute('aria-keyshortcuts')).toBe('Control+Z')
    expect(rehacer.getAttribute('aria-keyshortcuts')).toBe('Control+Y')
  })
})

// ── 2 · Los campos existen con el desplegable cerrado ────────────────────────

describe('barra de edición · los campos existen aunque el desplegable esté cerrado', () => {
  it('los dos desplegables nacen ocultos y sus campos SIGUEN en el documento', () => {
    montarBarra()
    expect(panel('snap').hidden).toBe(true)
    expect(panel('offset').hidden).toBe(true)
    // Es el punto entero: `nodo()` de main.js los encuentra igual.
    expect(document.querySelector(SELECTOR.SELECTOR_CAMPO_TOLERANCIA)).not.toBeNull()
    expect(document.querySelector(SELECTOR.SELECTOR_CAMPO_OFFSET)).not.toBeNull()
    expect(document.querySelector(SELECTOR.SELECTOR_BOTON_OFFSET)).not.toBeNull()
  })

  it('un `change` sobre la tolerancia CERRADA llega a quien la cablea (lo que hace 08-edicion.js)', () => {
    montarBarra()
    const campo = nodo(SELECTOR.SELECTOR_CAMPO_TOLERANCIA)
    const leidos = []
    campo.addEventListener('change', () => leidos.push(campo.value))

    // Literalmente el gesto del guion de navegador: teclear y disparar `change`
    // SIN abrir ningún desplegable.
    campo.value = '300'
    campo.dispatchEvent(new Event('change'))

    expect(leidos).toEqual(['300'])
    expect(panel('snap').hidden).toBe(true)
  })
})

// ── 3 · Abrir, cerrar y exclusión mutua ──────────────────────────────────────

describe('barra de edición · un solo desplegable abierto a la vez', () => {
  it('la herramienta abre su desplegable y lo anuncia con aria-expanded', () => {
    montarBarra()
    const disparador = nodo('[data-desplegable="snap"]')
    expect(disparador.getAttribute('aria-expanded')).toBe('false')

    clic(disparador)

    expect(panel('snap').hidden).toBe(false)
    expect(disparador.getAttribute('aria-expanded')).toBe('true')
    // Se abre para teclear: el foco va al campo.
    expect(document.activeElement).toBe(nodo(SELECTOR.SELECTOR_CAMPO_TOLERANCIA))
  })

  it('volver a pulsar la misma herramienta lo cierra', () => {
    montarBarra()
    const disparador = nodo('[data-desplegable="snap"]')
    clic(disparador)
    clic(disparador)
    expect(panel('snap').hidden).toBe(true)
    expect(disparador.getAttribute('aria-expanded')).toBe('false')
  })

  it('abrir uno CIERRA el otro (los tres se excluyen)', () => {
    montarBarra()
    const snap = nodo('[data-desplegable="snap"]')
    const offset = nodo('[data-desplegable="offset"]')
    const ayuda = nodo('[data-accion="ayuda"]')

    clic(snap)
    clic(offset)
    expect(panel('snap').hidden).toBe(true)
    expect(panel('offset').hidden).toBe(false)
    expect(snap.getAttribute('aria-expanded')).toBe('false')

    clic(ayuda)
    expect(panel('offset').hidden).toBe(true)
    expect(panel('ayuda').hidden).toBe(false)
    expect(offset.getAttribute('aria-expanded')).toBe('false')
  })

  it('Escape cierra y DEVUELVE EL FOCO a la herramienta que abrió', () => {
    montarBarra()
    const disparador = nodo('[data-desplegable="offset"]')
    clic(disparador)
    expect(panel('offset').hidden).toBe(false)

    // Se pulsa con el foco donde de verdad está: dentro del campo del desplegable.
    tecla(nodo(SELECTOR.SELECTOR_CAMPO_OFFSET), 'Escape')

    expect(panel('offset').hidden).toBe(true)
    expect(document.activeElement).toBe(disparador)
  })

  it('Escape con nada abierto NO se consume (sigue siendo del navegador)', () => {
    montarBarra()
    const evento = new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true })
    document.body.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(false)
  })

  it('el botón «Cerrar» del panel de ayuda lo cierra y devuelve el foco', () => {
    montarBarra()
    const disparador = nodo('[data-accion="ayuda"]')
    clic(disparador)
    clic(nodo(`.${CLASE_BARRA.AYUDA_CERRAR}`))
    expect(panel('ayuda').hidden).toBe(true)
    expect(document.activeElement).toBe(disparador)
  })
})

// ── 4 · Pinchar fuera cierra, SIN comerse el clic del mapa ───────────────────

describe('barra de edición · pinchar fuera cierra y el mapa sigue recibiendo su clic', () => {
  it('un clic en el mapa cierra el desplegable Y llega al mapa como `click`', () => {
    const { mapa, contenedor } = montarBarra()
    const clicsDelMapa = []
    mapa.on('click', () => clicsDelMapa.push(1))

    clic(nodo('[data-desplegable="snap"]'))
    expect(panel('snap').hidden).toBe(false)

    const evento = new MouseEvent('click', { bubbles: true, cancelable: true })
    contenedor.dispatchEvent(evento)

    // Las DOS mitades. Si la barra interceptara el clic para cerrarse, el gesto de
    // F06 «un clic elige el lindero» se perdería justo después de abrir una
    // herramienta, y haría falta pinchar dos veces sin que nada lo explicara.
    expect(panel('snap').hidden).toBe(true)
    expect(clicsDelMapa.length).toBe(1)
    // Ni `preventDefault` ni `stopPropagation`: el clic sale intacto de aquí.
    expect(evento.defaultPrevented).toBe(false)
  })

  it('un clic DENTRO de la barra no cierra lo que se acaba de abrir', () => {
    montarBarra()
    clic(nodo('[data-desplegable="snap"]'))
    // El propio clic que abre también burbujea hasta el `document`: si la guarda
    // `contenedor.contains(...)` no estuviera, se cerraría en el mismo gesto.
    expect(panel('snap').hidden).toBe(false)

    clic(nodo(SELECTOR.SELECTOR_CAMPO_TOLERANCIA))
    expect(panel('snap').hidden).toBe(false)
  })
})

// ── 5 · La barra no le habla al mapa por debajo ──────────────────────────────

describe('barra de edición · disableClickPropagation y disableScrollPropagation', () => {
  it('pulsar un botón de la barra NO dispara el `click` del mapa (no elige lindero)', () => {
    const { mapa } = montarBarra()
    const clicsDelMapa = []
    mapa.on('click', () => clicsDelMapa.push(1))

    clic(nodo(SELECTOR.SELECTOR_BOTON_DESHACER))
    clic(nodo('[data-accion="ayuda"]'))

    expect(clicsDelMapa.length).toBe(0)
  })

  it('un `mousedown` en la barra no llega al contenedor del mapa (no arrastra el mapa)', () => {
    const { contenedor } = montarBarra()
    const vistos = []
    contenedor.addEventListener('mousedown', () => vistos.push(1))

    nodo(SELECTOR.SELECTOR_BOTON_DESHACER).dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true }),
    )

    expect(vistos.length).toBe(0)
  })

  it('la rueda sobre la barra no llega al contenedor del mapa (no hace zoom)', () => {
    const { contenedor } = montarBarra()
    const vistos = []
    contenedor.addEventListener('wheel', () => vistos.push(1))

    clic(nodo('[data-desplegable="snap"]'))
    panel('snap').dispatchEvent(new Event('wheel', { bubbles: true, cancelable: true }))

    expect(vistos.length).toBe(0)
  })
})

// ── 6 · «Desplazar lindero» NUNCA se deshabilita ─────────────────────────────

describe('barra de edición · la herramienta «Desplazar lindero» siempre abre', () => {
  it('el botón de la BARRA no nace deshabilitado y sigue sin estarlo con el de dentro apagado', () => {
    montarBarra()
    const herramienta = nodo('[data-desplegable="offset"]')
    const accion = nodo(SELECTOR.SELECTOR_BOTON_OFFSET)

    expect(herramienta.disabled).toBe(false)
    expect(herramienta.hasAttribute('disabled')).toBe(false)
    // Quien se apaga es el de DENTRO, y lo gobierna `app/main.js`.
    expect(accion.disabled).toBe(true)

    // Se simula el gobierno de main.js en los dos sentidos.
    accion.disabled = false
    expect(herramienta.disabled).toBe(false)
    accion.disabled = true
    expect(herramienta.disabled).toBe(false)
  })

  it('abre su desplegable AUNQUE la acción de dentro esté apagada', () => {
    montarBarra()
    expect(nodo(SELECTOR.SELECTOR_BOTON_OFFSET).disabled).toBe(true)
    clic(nodo('[data-desplegable="offset"]'))
    expect(panel('offset').hidden).toBe(false)
  })

  it('el desplegable dice POR QUÉ, en el hermano SIGUIENTE del botón (invariante del CSS)', () => {
    montarBarra()
    const accion = nodo(SELECTOR.SELECTOR_BOTON_OFFSET)
    const motivo = accion.nextElementSibling

    // El orden de hermanos es lo que permite `[data-accion="offset"]:disabled ~
    // .gml-barra-motivo` en `estilos/app.css`: nadie observa el `disabled`.
    expect(motivo).not.toBeNull()
    expect(motivo.dataset.motivo).toBe('offset')
    expect(motivo.classList.contains(CLASE_BARRA.MOTIVO)).toBe(true)
    expect(motivo.textContent.toLowerCase()).toContain('elige antes un lindero en el mapa')
  })
})

// ── 7 · El panel de ayuda: los ocho gestos ───────────────────────────────────

describe('barra de edición · el panel de ayuda cuenta los OCHO gestos', () => {
  it('es un diálogo con nombre y recibe el foco al abrirse', () => {
    montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    const ayuda = panel('ayuda')
    expect(ayuda.getAttribute('role')).toBe('dialog')
    expect(ayuda.getAttribute('aria-label')).toBeTruthy()
    expect(document.activeElement).toBe(ayuda)
  })

  it('la tabla nombra los ocho gestos, en el orden de la spec', () => {
    montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    const filas = [...panel('ayuda').querySelectorAll('tbody tr')]
    expect(filas.length).toBe(8)

    // Escritos A MANO a propósito: si se derivaran de `GESTOS` este test no diría
    // nada. Son los ocho de la tabla «El mapa de gestos» de
    // `spec/feature-06-edicion-parcela.md`.
    expect(filas.map((fila) => fila.cells[0].textContent.trim())).toEqual([
      'Clic',
      'Doble clic',
      'Clic derecho',
      'Alt sostenida',
      'Arrastrar un vértice',
      'Teclear una coordenada',
      'Desplazar lindero',
      'Ctrl+Z / Ctrl+Y',
    ])
  })

  it('GESTOS son ocho y el umbral de puntería se DERIVA de viewer/edicion.js', () => {
    montarBarra()
    expect(GESTOS.length).toBe(8)
    clic(nodo('[data-accion="ayuda"]'))
    // Si alguien ajusta `UMBRAL_PUNTERIA_PX`, la ayuda lo dice sola.
    expect(panel('ayuda').textContent).toContain(`${UMBRAL_PUNTERIA_PX} px`)
  })

  it('las teclas de la tabla van en <kbd>, no en texto plano', () => {
    montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    const teclas = [...panel('ayuda').querySelectorAll('tbody kbd')].map((k) => k.textContent)
    expect(teclas).toEqual(['Alt', 'Ctrl+Z', 'Ctrl+Y'])
  })
})

// ── 8 · Accesibilidad de la barra ────────────────────────────────────────────

describe('barra de edición · accesibilidad', () => {
  it('la fila es un role="toolbar" con nombre', () => {
    montarBarra()
    const fila = nodo(`.${CLASE_BARRA.FILA}`)
    expect(fila.getAttribute('role')).toBe('toolbar')
    expect(fila.getAttribute('aria-label')).toBeTruthy()
  })

  it('cada disparador apunta con aria-controls a un panel que EXISTE', () => {
    montarBarra()
    for (const selector of ['[data-desplegable="snap"]', '[data-desplegable="offset"]', '[data-accion="ayuda"]']) {
      const disparador = nodo(selector)
      const id = disparador.getAttribute('aria-controls')
      expect(id, `${selector}: aria-controls`).toBeTruthy()
      expect(document.getElementById(id), `${selector}: aria-controls apunta a la nada`).not.toBeNull()
    }
  })

  it('los tres campos tienen un <label for> REAL', () => {
    montarBarra()
    for (const selector of [
      SELECTOR.SELECTOR_CAMPO_SNAP,
      SELECTOR.SELECTOR_CAMPO_TOLERANCIA,
      SELECTOR.SELECTOR_CAMPO_OFFSET,
    ]) {
      const campo = nodo(selector)
      expect(campo.id, `${selector}: sin id no puede haber <label for>`).toBeTruthy()
      expect(
        document.querySelector(`label[for="${campo.id}"]`),
        `${selector}: ningún <label for> lo apunta`,
      ).not.toBeNull()
    }
  })

  it('cada botón con icono lleva texto accesible y el SVG va aria-hidden', () => {
    const { contenedor } = montarBarra()
    const conIcono = [...contenedor.querySelectorAll(`.${CLASE_BARRA.ICONO}`)]
    expect(conIcono.length).toBeGreaterThan(0)
    for (const icono of conIcono) {
      expect(icono.getAttribute('aria-hidden')).toBe('true')
      // Un icono suelto no lo lee nadie: su botón (o su <label>) trae el rótulo.
      const rotulo = icono.parentElement.querySelector(`.${CLASE_BARRA.ROTULO}`)
      expect(rotulo, `un icono sin rótulo accesible en ${icono.parentElement.tagName}`).not.toBeNull()
      expect(rotulo.textContent.trim().length).toBeGreaterThan(0)
    }
  })

  it('las flechas mueven el foco entre las herramientas HABILITADAS', () => {
    montarBarra()
    const casilla = nodo(SELECTOR.SELECTOR_CAMPO_SNAP)
    const dispSnap = nodo('[data-desplegable="snap"]')
    const ayuda = nodo('[data-accion="ayuda"]')

    casilla.focus()
    tecla(casilla, 'ArrowRight')
    expect(document.activeElement).toBe(dispSnap)

    // Hacia atrás desde la casilla: deshacer y rehacer están apagados, así que se
    // saltan y se da la vuelta hasta la última herramienta.
    casilla.focus()
    tecla(casilla, 'ArrowLeft')
    expect(document.activeElement).toBe(ayuda)

    // Y en cuanto main.js enciende «Deshacer», la flecha ya lo alcanza.
    nodo(SELECTOR.SELECTOR_BOTON_DESHACER).disabled = false
    casilla.focus()
    tecla(casilla, 'ArrowLeft')
    expect(document.activeElement).toBe(nodo(SELECTOR.SELECTOR_BOTON_DESHACER))
  })

  it('las flechas dentro de un campo del desplegable son del campo, no de la barra', () => {
    montarBarra()
    clic(nodo('[data-desplegable="snap"]'))
    const campo = nodo(SELECTOR.SELECTOR_CAMPO_TOLERANCIA)
    const evento = new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
      cancelable: true,
    })
    campo.dispatchEvent(evento)
    expect(evento.defaultPrevented).toBe(false)
    expect(document.activeElement).toBe(campo)
  })
})

// ── 9 · destruir() ───────────────────────────────────────────────────────────

describe('barra de edición · destruir()', () => {
  it('quita la barra del documento y es IDEMPOTENTE', () => {
    const { barra } = montarBarra()
    expect(document.querySelector(SELECTOR.SELECTOR_BOTON_DESHACER)).not.toBeNull()

    barra.destruir()
    barra.destruir()

    for (const { constante } of CONTRATO) {
      expect(document.querySelector(SELECTOR[constante]), constante).toBeNull()
    }
  })

  it('no deja NI UN oyente huérfano en el documento', () => {
    const { mapa, destruir: destruirMapa } = montarMapa()
    pendientes.push(destruirMapa)

    // Se espía DESPUÉS de montar el mapa: lo que se cuenta es solo lo que añade
    // la barra. Monkey-patch a mano y no `vi.spyOn`, porque `addEventListener`
    // vive en el prototipo de `EventTarget` y aquí interesa la identidad exacta
    // de la función registrada, que es justo lo que un espía puede difuminar.
    const anadidos = []
    const quitados = []
    const addOriginal = document.addEventListener
    const removeOriginal = document.removeEventListener
    document.addEventListener = function (tipo, fn, opciones) {
      anadidos.push([tipo, fn])
      return addOriginal.call(this, tipo, fn, opciones)
    }
    document.removeEventListener = function (tipo, fn, opciones) {
      quitados.push([tipo, fn])
      return removeOriginal.call(this, tipo, fn, opciones)
    }

    try {
      const barra = crearBarraEdicion({ mapa })
      barra.destruir()
    } finally {
      delete document.addEventListener
      delete document.removeEventListener
    }

    expect(anadidos.map(([tipo]) => tipo).sort()).toEqual(['click', 'keydown'])
    for (const [tipo, fn] of anadidos) {
      expect(
        quitados.some(([t, f]) => t === tipo && f === fn),
        `el oyente '${tipo}' del documento se ha quedado vivo tras destruir()`,
      ).toBe(true)
    }
  })

  it('después de destruir, un Escape o un clic fuera no hacen nada (ni revientan)', () => {
    const { contenedor, barra } = montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    barra.destruir()

    expect(() => {
      contenedor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
      document.body.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
      )
    }).not.toThrow()
    expect(document.querySelector('[data-panel="ayuda"]')).toBeNull()
  })
})

// ── 10 · Contratos del programador ───────────────────────────────────────────

describe('barra de edición · contrato roto por el programador → throw', () => {
  it('sin mapa, o con algo que no es un mapa, lanza TypeError', () => {
    expect(() => crearBarraEdicion()).toThrow(TypeError)
    expect(() => crearBarraEdicion({})).toThrow(/debe ser un mapa de Leaflet/)
    expect(() => crearBarraEdicion({ mapa: {} })).toThrow(TypeError)
    expect(() => crearBarraEdicion({ mapa: { addControl() {} } })).toThrow(TypeError)
  })

  it('una posición que no es una esquina de Leaflet lanza RangeError', () => {
    const { mapa, destruir } = montarMapa()
    pendientes.push(destruir)
    expect(() => crearBarraEdicion({ mapa, posicion: 'centro' })).toThrow(RangeError)
    expect(() => crearBarraEdicion({ mapa, posicion: 'centro' })).toThrow(/topleft/)
    // Forma antes que dominio: un número no es «una esquina desconocida».
    expect(() => crearBarraEdicion({ mapa, posicion: 5 })).toThrow(TypeError)
  })

  it('un `alAvisar` que no es función lanza (patrón obligatorio del visor)', () => {
    const { mapa, destruir } = montarMapa()
    pendientes.push(destruir)
    expect(() => crearBarraEdicion({ mapa, alAvisar: 'ruidito' })).toThrow(TypeError)
  })

  it('acepta las cuatro esquinas y monta la barra dentro del contenedor del mapa', () => {
    for (const posicion of ['topleft', 'topright', 'bottomleft', 'bottomright']) {
      const { mapa, contenedor, destruir } = montarMapa()
      const barra = crearBarraEdicion({ mapa, posicion })
      const caja = contenedor.querySelector(`.${CLASE_BARRA.CONTENEDOR}`)
      expect(caja, `posición ${posicion}`).not.toBeNull()
      // Leaflet le pone su clase: es lo que lo hace parte del cromo del mapa.
      expect(caja.classList.contains('leaflet-control')).toBe(true)
      barra.destruir()
      destruir()
    }
  })
})

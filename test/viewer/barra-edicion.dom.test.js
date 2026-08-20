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
import { describe, it, expect, afterEach, vi } from 'vitest'
import {
  CENTRO_ABAJO,
  CLASE_BARRA,
  CLASE_ESQUINA_CENTRO_ABAJO,
  GESTOS,
  RETARDO_PISTA_MS,
  crearBarraEdicion,
} from '../../viewer/barra-edicion.js'
import { UMBRAL_PUNTERIA_PX } from '../../viewer/_comun.js'
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
  { constante: 'SELECTOR_BOTON_INSERTAR', etiqueta: 'BUTTON' },
  { constante: 'SELECTOR_BOTON_BORRAR', etiqueta: 'BUTTON' },
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
        `Los ocho selectores de cablearEdicion son el CONTRATO de viewer/barra-edicion.js: ` +
        `si se han renombrado, hay que actualizar la barra y esta lista a la vez.`,
    )
  }
  return encontrado[1]
}

/** Los ocho selectores, ya resueltos, indexados por nombre de constante. */
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

describe('barra de edición · los OCHO nodos del contrato de app/main.js', () => {
  it('los ocho selectores de cablearEdicion encuentran EXACTAMENTE un nodo', () => {
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

  it('los botones del historial dicen su atajo en la PISTA y en aria-keyshortcuts', () => {
    montarBarra()
    const deshacer = nodo(SELECTOR.SELECTOR_BOTON_DESHACER)
    const rehacer = nodo(SELECTOR.SELECTOR_BOTON_REHACER)
    // ⚠️ El `<kbd>` visible se fue con las palabras el 2026-08-10 (la barra volvió
    // a los iconos). El atajo NO se perdió: sale por las dos vías que cubren a los
    // dos públicos —la pista para el ratón, `aria-keyshortcuts` para el lector de
    // pantalla— y además sigue en la tabla del panel de ayuda.
    expect(deshacer.dataset.pista).toBe('Deshacer · Ctrl+Z')
    expect(rehacer.dataset.pista).toBe('Rehacer · Ctrl+Y')
    expect(deshacer.getAttribute('aria-keyshortcuts')).toBe('Control+Z')
    expect(rehacer.getAttribute('aria-keyshortcuts')).toBe('Control+Y')
  })

  it('«Borrar vértices» nace armable y sin armar: `aria-pressed="false"`, sin `disabled`', () => {
    montarBarra()
    const boton = nodo(SELECTOR.SELECTOR_BOTON_BORRAR)
    // El atributo tiene que ESTAR desde el arranque, no estrenarse al pulsarlo:
    // hasta entonces el botón se anunciaría como un disparador cualquiera y quien
    // va por lector de pantalla no sabría que ARMA un modo en vez de ejecutarlo.
    expect(boton.getAttribute('aria-pressed')).toBe('false')
    expect(boton.disabled).toBe(false)
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

describe('barra de edición · el panel de ayuda cuenta TODOS los gestos', () => {
  it('es un diálogo con nombre y recibe el foco al abrirse', () => {
    montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    const ayuda = panel('ayuda')
    expect(ayuda.getAttribute('role')).toBe('dialog')
    expect(ayuda.getAttribute('aria-label')).toBeTruthy()
    expect(document.activeElement).toBe(ayuda)
  })

  it('la tabla nombra los veinte gestos, en el orden de la spec', () => {
    montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    const filas = [...panel('ayuda').querySelectorAll('tbody tr')]
    expect(filas.length).toBe(20)

    // Escritos A MANO a propósito: si se derivaran de `GESTOS` este test no diría
    // nada. Los de la tabla «El mapa de gestos» de
    // `spec/feature-06-edicion-parcela.md` primero; luego los del dibujo de F12
    // (`viewer/dibujo.js`), que hasta la fase 5 no salían en la ayuda —cuatro
    // hasta el 2026-08-19, cinco desde que cerrar pinchando la primera esquina es
    // un gesto—; los tres del modo insertar (2026-08-18) y los tres del modo
    // borrar (2026-08-10).
    //
    // ⚠️ Insertar va ANTES que borrar, y ese orden no es libre: es el de los botones
    // en la barra. La ayuda se lee mirando la barra, así que dos ordenaciones
    // distintas para las mismas seis filas obligarían a buscar dos veces.
    expect(filas.map((fila) => fila.cells[0].textContent.trim())).toEqual([
      'Clic',
      'Doble clic',
      'Clic derecho',
      'Alt sostenida',
      'Arrastrar un vértice',
      'Teclear una coordenada',
      'Borrar la fila',
      'Desplazar lindero',
      'Insertar vértices',
      'Clic',
      'Escape',
      'Borrar vértices',
      'Clic',
      'Escape',
      'Ctrl+Z / Ctrl+Y',
      'Clic',
      'Clic en la PRIMERA esquina',
      'Doble clic o Enter',
      'Retroceso / Supr',
      'Escape',
    ])
  })

  it('⛔ el «Clic» aparece CUATRO veces, y la columna «dónde» es lo que los distingue', () => {
    // No es un duplicado: el mismo gesto hace cuatro cosas distintas según si hay un
    // trazo abierto, si el modo borrar está armado, si lo está el de insertar
    // (2026-08-18), o ninguna de las tres. Una tabla que lo dijera una sola vez
    // estaría mintiendo en el caso que más se usa. Si alguien «limpia» los
    // repetidos, esto se pone rojo.
    montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    const filas = [...panel('ayuda').querySelectorAll('tbody tr')]
    const clics = filas.filter((f) => f.cells[0].textContent.trim() === 'Clic')
    expect(clics).toHaveLength(4)
    expect(clics.map((f) => f.cells[1].textContent.trim())).toEqual([
      'mapa',
      'en modo insertar',
      'en modo borrar',
      'dibujando un recinto',
    ])
  })

  it('GESTOS son veinte y el umbral de puntería se DERIVA de viewer/_comun.js', () => {
    montarBarra()
    expect(GESTOS.length).toBe(20)
    clic(nodo('[data-accion="ayuda"]'))
    // Si alguien ajusta `UMBRAL_PUNTERIA_PX`, la ayuda lo dice sola.
    expect(panel('ayuda').textContent).toContain(`${UMBRAL_PUNTERIA_PX} px`)
  })

  it('los CINCO gestos del dibujo están en la ayuda (F12 · T3.5, la mitad que faltaba)', () => {
    // La barra enseña «Dibujar recinto» desde la fase 3, pero la ayuda no decía ni
    // una palabra de qué hacer una vez pulsado. Quien la abriera MIENTRAS dibuja
    // vería ocho gestos y ninguno sería el que está usando.
    montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    const texto = panel('ayuda').textContent
    expect(texto).toContain('dibujando un recinto')
    expect(texto).toMatch(/Añade una esquina/i)
    expect(texto).toMatch(/menos de tres esquinas/i)
    expect(texto).toMatch(/Quita la última esquina/i)
    expect(texto).toMatch(/Cancela el trazo entero/i)
  })

  it('las teclas de la tabla van en <kbd>, no en texto plano', () => {
    montarBarra()
    clic(nodo('[data-accion="ayuda"]'))
    const teclas = [...panel('ayuda').querySelectorAll('tbody kbd')].map((k) => k.textContent)
    expect(teclas).toEqual([
      'Alt',
      // Los `Escape` de los dos modos caen aquí, entre los gestos de cada
      // herramienta y el atajo del historial: la lista sigue el orden de `GESTOS`,
      // que a su vez sigue el orden de los botones en la barra. Insertar primero
      // (2026-08-18), borrar después.
      'Escape',
      'Escape',
      'Ctrl+Z',
      'Ctrl+Y',
      'Enter',
      'Retroceso',
      'Supr',
      'Escape',
    ])
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

  it('NINGUNA herramienta se queda sin nombre accesible, la nombre un texto o un rótulo oculto', () => {
    const { contenedor } = montarBarra()
    // El nombre accesible de un botón es su contenido de texto, venga del `<span>`
    // visible o del de 1×1 px. Lo que se exige aquí es que exista: una herramienta
    // muda es la trampa que el diseño de solo-iconos hacía fácil de dejar.
    const herramientas = [...contenedor.querySelectorAll(`.${CLASE_BARRA.HERRAMIENTA}`)]
    // Nueve desde el 2026-08-19: las cinco de siempre («Deshacer», «Rehacer», la
    // flecha del ajuste, «Desplazar lindero» y «Ayuda»), «Dibujar recinto» de F12
    // —que nace escondida pero está en el marcado, y una herramienta que aparece
    // muda al enseñarla es peor que una muda desde el principio—, «Borrar
    // vértices», «Insertar vértices» y «Quitar los puntos» de F24, que nace
    // escondida por lo mismo que el dibujo. La casilla del ajuste se cuenta aparte,
    // abajo: su piel es el `<label for>`, no un botón con esta clase.
    expect(herramientas.length).toBe(9)
    for (const herramienta of herramientas) {
      const nombre = herramienta.textContent.trim()
      expect(nombre.length, `herramienta sin nombre: ${herramienta.outerHTML}`).toBeGreaterThan(0)
    }
    const rotuloAjuste = nodo(`.${CLASE_BARRA.CONMUTADOR_ROTULO}`)
    expect(rotuloAjuste.textContent.trim()).toBe('Ajuste al parcelario')
  })

  it('cada herramienta dice su nombre POR LOS DOS CANALES, y con el mismo texto', () => {
    // ⭐ El invariante que sostiene toda la barra de iconos: el `<span>` oculto (lo
    // que oye un lector de pantalla) y el `data-pista` (lo que ve el ratón) salen
    // de la MISMA llamada a `nombrar`. Dos textos escritos aparte para el mismo
    // botón divergen, y el que se queda viejo es siempre el que no se ve.
    const { contenedor } = montarBarra()
    const conNombre = [
      ...contenedor.querySelectorAll(`.${CLASE_BARRA.HERRAMIENTA}, .${CLASE_BARRA.CONMUTADOR_ROTULO}`),
    ]
    expect(conNombre.length).toBe(10)
    for (const herramienta of conNombre) {
      const oculto = herramienta.querySelector(`.${CLASE_BARRA.ROTULO}`)
      expect(oculto, `sin nombre accesible: ${herramienta.outerHTML}`).not.toBeNull()
      expect(herramienta.dataset.pista, `sin pista: ${herramienta.outerHTML}`).toBeTruthy()
      // La pista puede AMPLIAR el nombre con el atajo («Deshacer · Ctrl+Z»), pero
      // nunca decir otra cosa.
      expect(herramienta.dataset.pista.startsWith(oculto.textContent)).toBe(true)
    }
  })

  it('⛔ ninguna herramienta lleva `title`: dos globos sobre el mismo botón', () => {
    // El `title` nativo tarda entre 500 y 1.000 ms y se pinta con el estilo del
    // sistema operativo. Dejarlo puesto además de la pista propia significa que a
    // los 120 ms sale el nuestro y medio segundo después el del navegador, encima.
    // Es el descuido clásico de quien se fabrica un tooltip y se olvida del nativo.
    montarBarra()
    // Con raíz en la BARRA y no en el contenedor del mapa: ahí dentro viven además
    // los controles de Leaflet, y el `title="Zoom in"` de su botón de zoom no es
    // asunto de este módulo.
    const barra = nodo(`.${CLASE_BARRA.CONTENEDOR}`)
    for (const nodoConTitulo of barra.querySelectorAll('[title]')) {
      expect.fail(`lleva title además de la pista: ${nodoConTitulo.outerHTML}`)
    }
  })

  it('los iconos van aria-hidden (el nombre no lo pone un dibujo)', () => {
    const { contenedor } = montarBarra()
    const iconos = [...contenedor.querySelectorAll(`.${CLASE_BARRA.ICONO}`)]
    // Nueve dibujos de herramienta —incluido el imán del ajuste— más las dos
    // puntas de flecha de lo que despliega.
    expect(iconos.length).toBe(11)
    for (const icono of iconos) {
      expect(icono.getAttribute('aria-hidden')).toBe('true')
      expect(icono.getAttribute('focusable')).toBe('false')
      // Con medidas propias: el módulo no importa ninguna hoja, y un `<svg>` sin
      // `width`/`height` cae al 300×150 por defecto del navegador. En una barra
      // que ya SOLO son iconos, eso no es un desperfecto: es la barra rota.
      expect(Number(icono.getAttribute('width')), 'el icono sin medida').toBeGreaterThan(0)
      expect(icono.querySelector('path'), 'un icono sin trazo no se ve').not.toBeNull()
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

  it('acepta las cuatro esquinas Y la quinta posición, dentro del contenedor del mapa', () => {
    for (const posicion of ['topleft', 'topright', 'bottomleft', 'bottomright', CENTRO_ABAJO]) {
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

// ═══════════════════════════════════════════════════════════════════════════
// Rework de UI · REBANADA 3 — la barra es de la pantalla de Edición
// ═══════════════════════════════════════════════════════════════════════════
describe('barra de edición · declara a qué pantalla pertenece (rebanada 3)', () => {
  it('el contenedor lleva `data-pantalla="edicion"` y solo ese paso', () => {
    // Medido antes de ponerlo (Chrome, 2026-08-04): la barra se veía en las
    // CUATRO pantallas, con «Deshacer», «Rehacer» y «Desplazar lindero»
    // apagados en las cuatro. La ocultan las cinco reglas de `estilos/app.css`,
    // que son de descendencia desde `.gml-app` y por eso alcanzan también a lo
    // que Leaflet cuelga dentro del mapa.
    const { contenedor } = montarBarra()
    const barra = contenedor.querySelector(`.${CLASE_BARRA.CONTENEDOR}`)
    expect(barra, 'no se encuentra el contenedor de la barra').not.toBeNull()
    expect(barra.dataset.pantalla).toBe('edicion')
  })

  it('⛔ el atributo va en la RAÍZ de la barra, no en un hijo', () => {
    // La regla del CSS oculta el nodo que lo declara. En un hijo escondería una
    // herramienta y dejaría la barra puesta y medio vacía, que es peor que las
    // dos alternativas honestas.
    const { contenedor } = montarBarra()
    const barra = contenedor.querySelector(`.${CLASE_BARRA.CONTENEDOR}`)
    expect(barra.querySelectorAll('[data-pantalla]')).toHaveLength(0)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// Rework de UI · 2026-08-05 — la barra deja de ser seis iconos apilados bajo el
// zoom y pasa a ser seis PALABRAS centradas en el borde inferior del mapa.
// ═══════════════════════════════════════════════════════════════════════════

describe('barra de edición · la quinta esquina (centrada abajo)', () => {
  it('por DEFECTO se monta centrada abajo, en una esquina que Leaflet no traía', () => {
    const { mapa, contenedor } = montarBarra()
    // Las cuatro de Leaflet siguen ahí y la quinta se le ha añadido.
    expect(Object.keys(mapa._controlCorners)).toContain(CENTRO_ABAJO)

    const esquina = contenedor.querySelector(`.${CLASE_ESQUINA_CENTRO_ABAJO}`)
    expect(esquina, 'no existe el <div> de la quinta esquina').not.toBeNull()
    // `leaflet-bottom` NO es decorativa: de ella salen position/bottom/z-index y
    // el margen inferior de los controles. Sin ella la barra se iría arriba a la
    // izquierda sin que nada avisara.
    expect(esquina.classList.contains('leaflet-bottom')).toBe(true)
    expect(esquina.contains(nodo(`.${CLASE_BARRA.CONTENEDOR}`))).toBe(true)
  })

  it('dos barras sobre el mismo mapa reutilizan la esquina: no se crea dos veces', () => {
    const { mapa, contenedor, destruir } = montarMapa()
    const primera = crearBarraEdicion({ mapa })
    const segunda = crearBarraEdicion({ mapa })
    pendientes.push(() => {
      primera.destruir()
      segunda.destruir()
      destruir()
    })
    expect(contenedor.querySelectorAll(`.${CLASE_ESQUINA_CENTRO_ABAJO}`)).toHaveLength(1)
  })

  it('un mapa que no expone `_controlCorners` NO revienta: cae a bottomleft AVISANDO', () => {
    // El punto entero de que esto sea un aviso y no un `throw`: `esMapa` acepta
    // por DUCK TYPING cualquier cosa con addControl/removeControl/getContainer
    // —es una decisión del módulo, documentada—, y esos mapas no tienen por qué
    // traer la API privada de la que sale la quinta esquina. Con ellos la barra
    // tiene que seguir apareciendo: peor puesta, pero dicho en voz alta y no en
    // un `TypeError` dentro de Leaflet.
    const contenedorFalso = document.createElement('div')
    document.body.appendChild(contenedorFalso)
    const mapaDeMentira = {
      addControl(control) {
        control._map = this
        control._container = control.onAdd(this)
        control._container.classList.add('leaflet-control')
        contenedorFalso.appendChild(control._container)
        return this
      },
      removeControl(control) {
        control.remove()
        return this
      },
      getContainer: () => contenedorFalso,
      on() {},
      off() {},
    }

    const avisos = []
    const barra = crearBarraEdicion({
      mapa: mapaDeMentira,
      alAvisar: (mensaje, detalle) => avisos.push({ mensaje, detalle }),
    })
    pendientes.push(() => {
      barra.destruir()
      contenedorFalso.remove()
    })

    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toMatch(/bottomleft/)
    expect(avisos[0].detalle.nivel).toBe('AVISO')
    expect(barra.control.options.position).toBe('bottomleft')
    // Y la barra ESTÁ, que es lo que se estaba protegiendo.
    expect(contenedorFalso.querySelector(`.${CLASE_BARRA.CONTENEDOR}`)).not.toBeNull()
  })

  it('destruir el mapa se lleva la esquina añadida (la limpia el propio Leaflet)', () => {
    const { mapa, contenedor, destruir } = montarMapa()
    const barra = crearBarraEdicion({ mapa })
    expect(contenedor.querySelector(`.${CLASE_ESQUINA_CENTRO_ABAJO}`)).not.toBeNull()

    barra.destruir()
    destruir()

    // `L.Map#_clearControlPos` recorre `_controlCorners` entero, así que la quinta
    // se va con las otras cuatro sin que este módulo tenga que acordarse.
    expect(contenedor.querySelector(`.${CLASE_ESQUINA_CENTRO_ABAJO}`)).toBeNull()
  })
})

describe('barra de edición · las herramientas se dibujan y se nombran en la pista', () => {
  it('cada herramienta lleva su icono y su nombre, en el orden de la barra', () => {
    const { contenedor } = montarBarra()
    const nombres = [
      ...contenedor.querySelectorAll(`.${CLASE_BARRA.HERRAMIENTA}, .${CLASE_BARRA.CONMUTADOR_ROTULO}`),
    ].map((n) => n.querySelector(`.${CLASE_BARRA.ROTULO}`).textContent.trim())

    // ⚠️ «Dibujar recinto» (F12) SÍ está en el marcado desde el montaje, pero nace
    // con `hidden`: en la rama PARCELA no hay ninguna parte que dibujar. Se cuenta
    // aquí porque este guardián mira el MARCADO —que la herramienta esté nombrada—,
    // no lo que se ve; que nazca escondida lo defiende su propia prueba, más abajo.
    expect(nombres).toEqual([
      'Deshacer',
      'Rehacer',
      'Ajuste al parcelario',
      'Tolerancia del ajuste',
      'Desplazar lindero',
      // ⚠️ Insertar ANTES que borrar, y sin separador entre medias: son pareja
      // —el mismo trabajo en los dos sentidos, excluyentes entre sí— y el orden
      // es el de la frase que el usuario ya tiene en la cabeza, crear y destruir.
      'Insertar vértices: enciende el modo y pincha en el lindero',
      'Borrar vértices: enciende el modo y pincha los que sobren',
      'Dibujar el recinto de la parte activa, vértice a vértice',
      // ⚠️ Pegada al dibujo y SIN separador entre medias, por lo mismo que la
      // pareja de arriba: se dibuja SOBRE los puntos y se quitan CUANDO ya se ha
      // dibujado. Y su nombre de NACIMIENTO no lleva cuenta —«los puntos sueltos»,
      // no «los 0 puntos»—: la cuenta la pone `puntosVisible(n)` al enseñarla.
      'Quitar los puntos sueltos del levantamiento (se puede deshacer)',
      'Ayuda sobre los gestos de edición',
    ])
  })

  it('el nombre accesible NO lo pisa un `aria-label`: sale del contenido', () => {
    montarBarra()
    // Con `aria-label` habría dos textos para el mismo botón —el del atributo y el
    // del `<span>` oculto— y nada garantizaría que dijeran lo mismo. Aquí el nombre
    // accesible ES el contenido, así que la pista (que sale del mismo sitio) y lo
    // que oye un lector de pantalla no pueden separarse.
    const ayuda = nodo('[data-accion="ayuda"]')
    expect(ayuda.hasAttribute('aria-label')).toBe(false)
    expect(ayuda.textContent.replace(/\s+/g, ' ').trim()).toBe('Ayuda sobre los gestos de edición')
  })

  it('las dos puntas de flecha son de las herramientas que DESPLIEGAN, y solo de ellas', () => {
    const { contenedor } = montarBarra()
    // Se distinguen del icono de la herramienta por el tamaño: la flecha es más
    // pequeña a propósito (es un apéndice, no una herramienta). Es lo que se mide
    // aquí porque es lo que se ve.
    const flechas = [...contenedor.querySelectorAll(`.${CLASE_BARRA.ICONO}`)].filter(
      (i) => Number(i.getAttribute('width')) < 16,
    )
    expect(flechas.map((i) => i.parentElement)).toEqual([
      nodo('[data-desplegable="snap"]'),
      nodo('[data-desplegable="offset"]'),
    ])
  })

  it('los grupos van separados por un `role="separator"` de verdad', () => {
    const { contenedor } = montarBarra()
    const separadores = [...contenedor.querySelectorAll(`.${CLASE_BARRA.SEPARADOR}`)]
    // ⚠️ **EL AGRUPAMIENTO CAMBIÓ EN T4 y este comentario decía el de antes.** Ya no
    // es «historial · ajuste · geometría (desplazar + borrar) · dibujo · ayuda»: el
    // dibujo se fue al MANDO, y con él el filete que lo abría. Hoy son
    //
    //     historial │ ajuste │ desplazar + [mando] │ quitar puntos │ ayuda
    //
    // o sea los mismos CUATRO filetes, pero el tercero separa ahora el mando de
    // «Quitar puntos» y el cuarto es de «Quitar puntos» en exclusiva
    // (`_refrescarSeparadorPuntos`). El último nace escondido con su botón; que no
    // quede ninguno suelto en ninguna combinación lo vigila la prueba de T8.
    expect(separadores).toHaveLength(4)
    for (const separador of separadores) {
      expect(separador.getAttribute('role')).toBe('separator')
      expect(separador.getAttribute('aria-orientation')).toBe('vertical')
    }
  })

  it('los separadores NO son paradas de las flechas del teclado', () => {
    montarBarra()
    // Las flechas recorren `_herramientas`, que son los controles. Si un filete se
    // colara ahí, el foco caería en un `<span>` que no hace nada.
    const casilla = nodo(SELECTOR.SELECTOR_CAMPO_SNAP)
    casilla.focus()
    tecla(casilla, 'ArrowRight')
    expect(document.activeElement).toBe(nodo('[data-desplegable="snap"]'))
    tecla(document.activeElement, 'ArrowRight')
    expect(document.activeElement).toBe(nodo('[data-desplegable="offset"]'))
  })

  it('⛔ las flechas SALTAN lo oculto además de lo apagado', () => {
    // Hasta el 2026-08-10 `_vecinaHabilitada` solo miraba `disabled`, y «Dibujar
    // recinto» ni siquiera estaba en la lista de paradas. Al meterlo, un recorrido
    // en la rama PARCELA habría llevado el foco a un botón INVISIBLE: el usuario
    // pulsa `Enter` y no sabe qué acaba de hacer. Peor que la parada que faltaba.
    montarBarra()
    const borrar = nodo(SELECTOR.SELECTOR_BOTON_BORRAR)
    expect(nodo('[data-accion="dibujar-recinto"]').hidden, 'el supuesto de partida').toBe(true)

    borrar.focus()
    tecla(borrar, 'ArrowRight')
    expect(document.activeElement).toBe(nodo('[data-accion="ayuda"]'))
  })

  it('…y la alcanzan en cuanto `dibujoVisible(true)` la enseña', () => {
    const { barra } = montarBarra()
    barra.dibujoVisible(true)
    const borrar = nodo(SELECTOR.SELECTOR_BOTON_BORRAR)

    borrar.focus()
    tecla(borrar, 'ArrowRight')
    expect(document.activeElement).toBe(nodo('[data-accion="dibujar-recinto"]'))
  })
})

// ── 11 · La PISTA (el globo que sustituye al `title` nativo) ─────────────────

describe('barra de edición · la pista', () => {
  /** `mouseover` delegado, que es como llega de verdad (burbujea; `mouseenter` no). */
  const senalar = (elemento) => elemento.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
  const dejarDeSenalar = (elemento, hacia = null) =>
    elemento.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: hacia }))

  const pista = () => nodo(`.${CLASE_BARRA.PISTA}`)

  it('nace escondida y con `role="tooltip"` + `aria-hidden`', () => {
    montarBarra()
    expect(pista().hidden).toBe(true)
    expect(pista().getAttribute('role')).toBe('tooltip')
    // `aria-hidden` porque el nombre accesible del botón ya dice lo mismo:
    // anunciarlo otra vez sería el rótulo dicho dos veces.
    expect(pista().getAttribute('aria-hidden')).toBe('true')
  })

  it('con el RATÓN espera; con el TECLADO sale al instante', () => {
    vi.useFakeTimers()
    try {
      montarBarra()
      const ayuda = nodo('[data-accion="ayuda"]')

      senalar(ayuda)
      expect(pista().hidden, 'no puede salir antes del retardo').toBe(true)
      vi.advanceTimersByTime(RETARDO_PISTA_MS)
      expect(pista().hidden).toBe(false)
      expect(pista().textContent).toBe('Ayuda sobre los gestos de edición')

      dejarDeSenalar(ayuda)
      expect(pista().hidden).toBe(true)

      // El foco no espera: quien tabula ya ha decidido pararse ahí, y hacerle
      // esperar sería castigar el camino accesible.
      ayuda.dispatchEvent(new FocusEvent('focusin', { bubbles: true }))
      expect(pista().hidden).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('⛔ señalar y salir ANTES del retardo no deja el globo encendido', () => {
    // El fallo clásico del tooltip con temporizador: cruzar la barra de camino al
    // mapa encendería seis globos, cada uno 120 ms después de que el ratón ya no
    // esté encima.
    vi.useFakeTimers()
    try {
      montarBarra()
      const ayuda = nodo('[data-accion="ayuda"]')
      senalar(ayuda)
      dejarDeSenalar(ayuda)
      vi.advanceTimersByTime(RETARDO_PISTA_MS * 4)
      expect(pista().hidden).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('pasar de una herramienta a otra reescribe el globo SIN esperar', () => {
    vi.useFakeTimers()
    try {
      montarBarra()
      const deshacer = nodo(SELECTOR.SELECTOR_BOTON_DESHACER)
      const borrar = nodo(SELECTOR.SELECTOR_BOTON_BORRAR)

      senalar(deshacer)
      vi.advanceTimersByTime(RETARDO_PISTA_MS)
      expect(pista().textContent).toBe('Deshacer · Ctrl+Z')

      // `relatedTarget` apunta a la herramienta siguiente: sin la guarda, el
      // `mouseout` apagaría el globo que el `mouseover` acaba de encender.
      dejarDeSenalar(deshacer, borrar)
      senalar(borrar)
      expect(pista().hidden, 'la ventana caliente: ya no espera').toBe(false)
      expect(
        pista().textContent,
        'sin repintar al instante, el globo miente 120 ms sobre qué hay debajo',
      ).toBe('Borrar vértices: enciende el modo y pincha los que sobren')
    } finally {
      vi.useRealTimers()
    }
  })

  it('mover el ratón DENTRO del mismo botón no apaga el globo', () => {
    vi.useFakeTimers()
    try {
      montarBarra()
      const ayuda = nodo('[data-accion="ayuda"]')
      senalar(ayuda)
      vi.advanceTimersByTime(RETARDO_PISTA_MS)

      // Del `<button>` a su `<svg>`: son dos nodos, así que `mouseout` salta. Sin
      // mirar el destino, la pista parpadearía al mover el ratón un píxel.
      dejarDeSenalar(ayuda, ayuda.querySelector('svg'))
      expect(pista().hidden).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('con un panel abierto NO hay pista: se abre justo donde ella se dibuja', () => {
    vi.useFakeTimers()
    try {
      montarBarra()
      clic(nodo('[data-accion="ayuda"]'))
      senalar(nodo(SELECTOR.SELECTOR_BOTON_BORRAR))
      vi.advanceTimersByTime(RETARDO_PISTA_MS * 4)
      expect(pista().hidden).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })

  it('⛔ `destruir()` cancela el temporizador pendiente', () => {
    // Sin esto, el `setTimeout` sobrevive al desmontaje y su callback escribe en un
    // nodo que ya no está en el documento. Es el mismo fallo que un oyente sin
    // baja, con la diferencia de que este no se ve.
    vi.useFakeTimers()
    try {
      const { barra } = montarBarra()
      senalar(nodo('[data-accion="ayuda"]'))
      barra.destruir()
      expect(() => vi.advanceTimersByTime(RETARDO_PISTA_MS * 4)).not.toThrow()
      expect(document.querySelector(`.${CLASE_BARRA.PISTA}`)).toBeNull()
    } finally {
      vi.useRealTimers()
    }
  })
})

// ── 12 · «Borrar vértices» ──────────────────────────────────────────────────

describe('barra de edición · el conmutador del modo borrar', () => {
  it('`borrarActivo(true)` lo hunde y le cambia el NOMBRE, no solo el color', () => {
    const { barra } = montarBarra()
    const boton = nodo(SELECTOR.SELECTOR_BOTON_BORRAR)

    barra.borrarActivo(true)
    expect(boton.getAttribute('aria-pressed')).toBe('true')
    // Un botón que hace una cosa distinta tiene que decirlo con palabras, no solo
    // con un fondo: armado, pulsarlo SALE del modo.
    expect(boton.dataset.pista).toMatch(/salir del modo borrar/i)
    expect(boton.querySelector(`.${CLASE_BARRA.ROTULO}`).textContent).toBe(boton.dataset.pista)

    barra.borrarActivo(false)
    expect(boton.getAttribute('aria-pressed')).toBe('false')
    expect(boton.dataset.pista).toMatch(/^Borrar vértices/)
  })

  it('si la pista de ESE botón está a la vista, se reescribe en el acto', () => {
    vi.useFakeTimers()
    try {
      const { barra } = montarBarra()
      const boton = nodo(SELECTOR.SELECTOR_BOTON_BORRAR)
      boton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      vi.advanceTimersByTime(RETARDO_PISTA_MS)

      barra.borrarActivo(true)
      // Apagar o encender el modo con el ratón encima dejaba si no el globo
      // diciendo lo contrario de lo que el botón va a hacer.
      expect(nodo(`.${CLASE_BARRA.PISTA}`).textContent).toMatch(/salir del modo borrar/i)
    } finally {
      vi.useRealTimers()
    }
  })

  it('lleva el modificador de herramienta DESTRUCTIVA (de él cuelga el rojo)', () => {
    montarBarra()
    const boton = nodo(SELECTOR.SELECTOR_BOTON_BORRAR)
    expect(boton.classList.contains(CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA)).toBe(true)
    // Y «Dibujar recinto», que también es un modo, NO lo lleva: uno añade geometría
    // y el otro la destruye al primer clic.
    expect(
      nodo('[data-accion="dibujar-recinto"]').classList.contains(CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA),
    ).toBe(false)
  })
})

// ── F12 · T3.5 · «Dibujar recinto» ───────────────────────────────────────────

describe('F12 · la herramienta de dibujo', () => {
  it('⛔ nace ESCONDIDA, no apagada: en la rama Parcela no hay parte que dibujar', () => {
    // Es la única herramienta de esta barra que se esconde. Las que se apagan
    // —«Deshacer», «Desplazar lindero»— describen algo que AQUÍ se puede hacer y
    // ahora mismo no; un botón gris permanente cuyo motivo hable de otra rama
    // diría menos que su ausencia.
    const { barra } = montarBarra()
    const boton = nodo('[data-accion="dibujar-recinto"]')
    expect(boton).not.toBeNull()
    expect(boton.hidden).toBe(true)
    expect(boton.disabled).toBe(false)
    expect(barra.dibujoVisible()).toBe(false)
  })

  it('⛔ `dibujoVisible` ya NO mueve ningún separador (T4)', () => {
    // Esta prueba exigía lo contrario hasta T4 —enseñar el dibujo tenía que sacar
    // un cuarto filete— y se ha dado la vuelta a propósito, así que conviene decir
    // por qué. Desde que el dibujo es el TERCER SEGMENTO DEL MANDO, esconderlo no
    // deja ningún filete suelto: el mando no se queda vacío nunca (insertar y
    // borrar no se esconden jamás) y el separador que va después sigue separando
    // exactamente lo mismo. Que la cuenta de filetes NO cambie es ahora el
    // invariante, y es más fuerte que el que había: dice que enseñar una
    // herramienta no reorganiza la barra debajo del cursor.
    const { barra, contenedor } = montarBarra()
    const visibles = () =>
      [...contenedor.querySelectorAll(`.${CLASE_BARRA.SEPARADOR}`)].filter((s) => !s.hidden).length

    const antes = visibles()
    barra.dibujoVisible(true)
    expect(nodo('[data-accion="dibujar-recinto"]').hidden).toBe(false)
    expect(visibles(), 'enseñar el dibujo no saca ni quita filetes').toBe(antes)

    barra.dibujoVisible(false)
    expect(nodo('[data-accion="dibujar-recinto"]').hidden).toBe(true)
    expect(visibles()).toBe(antes)
  })

  it('⭐ T8 · NINGUNA raya suelta, en las CUATRO combinaciones', () => {
    // ⛔ **ESTA PRUEBA AFIRMABA UNA CUENTA Y AHORA AFIRMA LA REGLA.** Hasta T8 decía
    // «hay exactamente 1 separador escondido» — cierto en el arranque, y cierto por
    // casualidad después de T4, que mudó un filete de sitio y le cambió el dueño a
    // otro. Una cuenta no habría visto ninguno de los dos defectos que sí importan:
    // un filete al final de la fila, o dos filetes seguidos sin nada en medio.
    //
    // Lo que se afirma es la frase que este módulo lleva repitiendo desde F12 en
    // tres comentarios distintos: **un filete que no separa nada es una raya
    // suelta.** Dicho estructuralmente son tres condiciones sobre la fila VISIBLE:
    // ni abre, ni cierra, ni va pegado a otro.
    const { barra, contenedor } = montarBarra()
    const fila = contenedor.querySelector(`.${CLASE_BARRA.FILA}`)

    // La pista y el renglón de situación cuelgan de la fila pero NO son piezas de
    // la fila: son capas absolutas encima (ver T2). Se descartan por clase y no por
    // `hidden`, que es lo honrado — la pista se enciende al posar el ratón y este
    // guardián no puede depender de dónde esté el cursor.
    const capas = [CLASE_BARRA.PISTA, CLASE_BARRA.SITUACION]
    const piezas = () =>
      [...fila.children]
        .filter((n) => !capas.some((c) => n.classList.contains(c)))
        .filter((n) => !n.hidden)
        .map((n) => (n.classList.contains(CLASE_BARRA.SEPARADOR) ? '│' : '▪'))

    const combinaciones = [
      { dibujo: false, puntos: 0, caso: 'rama PARCELA sin fichero (el arranque)' },
      { dibujo: true, puntos: 0, caso: 'con dibujo, sin puntos' },
      { dibujo: false, puntos: 55, caso: 'con puntos, sin dibujo' },
      { dibujo: true, puntos: 88, caso: 'los nueve botones a la vista' },
    ]

    for (const { dibujo, puntos, caso } of combinaciones) {
      barra.dibujoVisible(dibujo)
      barra.puntosVisible(puntos)
      const p = piezas()
      const dibujada = p.join('')

      expect(p.length, `${caso}: la fila se ha quedado vacía`).toBeGreaterThan(2)
      expect(p[0], `${caso}: la fila ABRE con un filete — «${dibujada}»`).toBe('▪')
      expect(p[p.length - 1], `${caso}: la fila CIERRA con un filete — «${dibujada}»`).toBe('▪')
      expect(
        dibujada.includes('││'),
        `${caso}: dos filetes seguidos, y entre ellos no hay nada — «${dibujada}»`,
      ).toBe(false)
    }
  })

  it('⭐ T8 · y el mando no se queda nunca sin segmentos que agrupar', () => {
    // El corolario de lo anterior, para el nodo que T4 estrenó: un `role="group"`
    // vacío —o con un solo hijo a la vista— sería el equivalente del filete suelto,
    // un marco alrededor de nada. Aguanta porque insertar y borrar NO se esconden
    // jamás; se afirma para que se note el día que alguien les dé un escondite.
    const { barra, contenedor } = montarBarra()
    const mando = contenedor.querySelector(`.${CLASE_BARRA.MANDO}`)
    const aLaVista = () =>
      [...mando.children].filter((n) => !n.hidden).length

    expect(aLaVista(), 'con el dibujo escondido quedan los dos que no se esconden').toBe(2)
    barra.dibujoVisible(true)
    expect(aLaVista()).toBe(3)
    barra.dibujoVisible(false)
    expect(aLaVista()).toBe(2)
  })

  it('mientras se dibuja, el botón CAMBIA DE NOMBRE: lo que hace es cancelar', () => {
    const { barra } = montarBarra()
    const boton = nodo('[data-accion="dibujar-recinto"]')
    // Desde que la barra es de iconos, el nombre vive en el `<span>` oculto y en el
    // `data-pista`, y los dos tienen que moverse a la vez: son las dos salidas del
    // mismo texto (ver `_renombrar`).
    const nombre = () => boton.querySelector(`.${CLASE_BARRA.ROTULO}`).textContent
    expect(nombre()).toMatch(/^Dibujar el recinto/)
    barra.dibujoEnCurso(true)
    expect(nombre()).toMatch(/^Cancelar el dibujo/)
    expect(boton.dataset.pista).toBe(nombre())
    expect(boton.getAttribute('aria-pressed')).toBe('true')
    barra.dibujoEnCurso(false)
    expect(nombre()).toMatch(/^Dibujar el recinto/)
    expect(boton.dataset.pista).toBe(nombre())
    expect(boton.getAttribute('aria-pressed')).toBe('false')
  })

  it('lleva un dibujo, como el resto desde que la barra volvió a los iconos', () => {
    montarBarra()
    // Un RECINTO cerrado y no un lápiz: un lápiz querría decir «dibujar» y también
    // «editar», que es lo que hacen las otras seis herramientas de la barra.
    expect(nodo('[data-accion="dibujar-recinto"]').querySelector('svg')).not.toBeNull()
  })

  it('`dibujoVisible` con algo que no es booleano LANZA, y leer no escribe', () => {
    const { barra } = montarBarra()
    expect(() => barra.dibujoVisible('si')).toThrow(TypeError)
    expect(barra.dibujoVisible()).toBe(false)
  })
})

// ── F24 · «Quitar los puntos del levantamiento» (2026-08-19) ─────────────────
//
// ⛔ **EL HUECO QUE ESTA HERRAMIENTA CIERRA.** Desde que un `.dxf` de puntos entra
// sin unirlos, la nube VIVE EN EL MODELO: se guarda con el expediente, viaja en el
// fichero de proyecto y se vuelve a pintar cada vez que se recupera. En cuanto el
// contorno está dibujado encima deja de servir para nada, y la única forma de
// perderla era no haberla importado. Con 88 puntos sobre una parcela ya cerrada,
// eso es el mapa tapado para siempre.
//
// Lo que se vigila AQUÍ es solo la mitad de la barra —que el botón exista, se
// esconda, se nombre con su cuenta y comparta bien el separador—. Que el clic vacíe
// el modelo y que `Ctrl+Z` lo devuelva vive en `test/app/main-edicion.dom.test.js`,
// que es quien tiene el store y el historial.
describe('F24 · la herramienta que quita los puntos del levantamiento', () => {
  const boton = () => nodo('[data-accion="quitar-puntos"]')
  const nombre = () => boton().querySelector(`.${CLASE_BARRA.ROTULO}`).textContent

  it('⛔ nace ESCONDIDA, no apagada, y sin cuenta en el nombre', () => {
    // Mismo criterio que «Dibujar recinto»: sin puntos no hay nada que quitar, y un
    // botón gris permanente cuyo motivo hable de un fichero que nadie ha soltado
    // diría menos que su ausencia.
    const { barra } = montarBarra()
    expect(boton().hidden).toBe(true)
    expect(boton().disabled).toBe(false)
    expect(barra.puntosVisible()).toBe(false)
    // ⚠️ «los puntos sueltos», NO «los 0 puntos sueltos». El botón nace sin cuenta
    // que dar, y un cero en el rótulo es lo que oiría quien recorra la barra con el
    // lector de pantalla antes de que llegue ningún fichero.
    expect(nombre()).toBe('Quitar los puntos sueltos del levantamiento (se puede deshacer)')
  })

  it('lleva el ROJO de lo destructivo, como la papelera', () => {
    montarBarra()
    // Es la única herramienta de la barra que borra de una vez algo que vino de
    // fuera. Que se pueda deshacer no la hace inocua: la hace reversible.
    expect(boton().classList.contains(CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA)).toBe(true)
    expect(boton().querySelector('svg')).not.toBeNull()
  })

  it('⭐ `puntosVisible(n)` la enseña Y pone la cuenta, por los DOS canales', () => {
    const { barra } = montarBarra()
    expect(barra.puntosVisible(55)).toBe(true)
    expect(boton().hidden).toBe(false)
    // La cuenta es la única cifra que el usuario tiene: sobre el mapa, a 3 px de
    // radio y superpuestos, no hay forma de contar 55 puntos.
    expect(nombre()).toBe('Quitar los 55 puntos sueltos del levantamiento (se puede deshacer)')
    // Y por el canal del ratón, con el MISMO texto: es el invariante de toda la
    // barra de iconos (ver `_renombrar`).
    expect(boton().dataset.pista).toBe(nombre())
  })

  it('con UN punto lo dice en singular', () => {
    const { barra } = montarBarra()
    barra.puntosVisible(1)
    expect(nombre()).toBe('Quitar el punto suelto del levantamiento (se puede deshacer)')
  })

  it('⭐ el CERO la esconde: no hay estado «visible sin puntos»', () => {
    // Ése es el motivo de que el método tenga UN argumento y no dos (`visible` +
    // `cuantos`): con dos existiría el estado imposible —un botón ofreciendo quitar
    // una nube que ya no está— que es justo el defecto que hay que evitar.
    const { barra } = montarBarra()
    barra.puntosVisible(88)
    expect(boton().hidden).toBe(false)
    expect(barra.puntosVisible(0)).toBe(false)
    expect(boton().hidden).toBe(true)
  })

  it('⛔ el filete de después es SUYO y de nadie más (T4)', () => {
    // ⚠️ **ESTA PRUEBA HA CAMBIADO DE EXIGENCIA DOS VECES, y las dos por el mismo
    // motivo: un filete que no separa nada es una raya suelta.**
    //   · F24: el separador dejó de ser de `dibujoVisible` y pasó a mirar a sus DOS
    //     lados, porque el dibujo y los puntos se escondían por separado.
    //   · T4: el dibujo se ha ido al mando, que está al otro lado del filete y no
    //     se esconde nunca. Le queda un solo vecino escondible, así que la
    //     condición vuelve a tener un término — y el dibujo deja de tener voz.
    const { barra, contenedor } = montarBarra()
    const escondidos = () =>
      [...contenedor.querySelectorAll(`.${CLASE_BARRA.SEPARADOR}`)].filter((s) => s.hidden)

    expect(escondidos(), 'sin puntos: el filete sobra').toHaveLength(1)

    barra.puntosVisible(12)
    expect(escondidos(), 'con puntos: el filete separa algo').toHaveLength(0)

    // ⛔ Y el DIBUJO no tiene nada que decir aquí, ni en un sentido ni en el otro.
    barra.dibujoVisible(true)
    expect(escondidos(), 'enseñar el dibujo no toca este filete').toHaveLength(0)
    barra.puntosVisible(0)
    expect(escondidos(), 'sin puntos vuelve a sobrar, aunque el dibujo esté').toHaveLength(1)
    barra.dibujoVisible(false)
    expect(escondidos()).toHaveLength(1)
  })

  it('la PISTA abierta encima se refresca con la cuenta nueva', () => {
    // Sin esto, quitar puntos con el ratón parado sobre el botón dejaría el globo
    // diciendo una cifra que ya no es.
    vi.useFakeTimers()
    try {
      const { barra } = montarBarra()
      barra.puntosVisible(55)
      boton().dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      vi.advanceTimersByTime(RETARDO_PISTA_MS)
      const pista = nodo(`.${CLASE_BARRA.PISTA}`)
      expect(pista.hidden).toBe(false)
      expect(pista.textContent).toContain('55 puntos')

      barra.puntosVisible(3)
      expect(pista.textContent).toContain('3 puntos')
      expect(pista.textContent).not.toContain('55')
    } finally {
      vi.useRealTimers()
    }
  })

  it('`puntosVisible` con algo que no es un entero >= 0 LANZA, y leer no escribe', () => {
    const { barra } = montarBarra()
    for (const malo of ['55', -1, 2.5, NaN, Infinity, null, true]) {
      expect(() => barra.puntosVisible(malo), `admitió ${JSON.stringify(malo)}`).toThrow(TypeError)
    }
    expect(barra.puntosVisible()).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T2 · EL RENGLÓN DE SITUACIÓN (2026-08-19)
// ═════════════════════════════════════════════════════════════════════════════
//
// Lo que protege este bloque, y por qué son DOS nodos y no uno:
//
//   · `role="status"` (`.gml-barra-estado`) — el que ya había. Cuenta el DESENLACE
//     de una acción, va al lector de pantalla y **no se ve**: `app/main.js` le
//     aplica `RENGLON_OCULTO` a todo lo que no sea error. Aquí no se toca.
//   · `.gml-barra-situacion` — el nuevo. Cuenta en qué ESTADO estás, **se ve**, y
//     va `aria-hidden` porque los mismos hechos ya los anuncia el de arriba.
//
// El invariante que más importa es el primero: **el arranque no planta un cartel
// sobre el mapa.** Vale palabra por palabra para este nodo, y su gemelo vive en
// `test/app/main-edicion.dom.test.js`.

describe('barra de edición · T2 · el renglón de situación', () => {
  const situacion = () => nodo(`.${CLASE_BARRA.SITUACION}`)

  it('⛔ NACE VACÍO Y ESCONDIDO: el arranque no planta un cartel sobre el mapa', () => {
    montarBarra()
    expect(situacion().hidden).toBe(true)
    expect(situacion().textContent).toBe('')
  })

  it('⚠️ va `aria-hidden`: el `role="status"` ya anuncia estos hechos', () => {
    montarBarra()
    // Sin esto, quien va por lector de pantalla oiría la selección DOS VECES por
    // cada clic: una por `anunciar(MENSAJE_CON_LADO)` y otra por este espejo.
    expect(situacion().getAttribute('aria-hidden')).toBe('true')
  })

  it('son DOS nodos distintos, y el `role="status"` sigue intacto', () => {
    montarBarra()
    const estado = nodo(`.${CLASE_BARRA.ESTADO}`)
    expect(estado).not.toBe(situacion())
    expect(estado.getAttribute('role')).toBe('status')
    expect(estado.textContent).toBe('')
    // El de los desenlaces NO lleva aria-hidden: tiene que anunciarse.
    expect(estado.hasAttribute('aria-hidden')).toBe(false)
  })

  it('`ladoSeleccionado(true)` lo enseña, y `(false)` lo vuelve a esconder', () => {
    const { barra } = montarBarra()
    barra.ladoSeleccionado(true)
    expect(situacion().hidden).toBe(false)
    expect(situacion().textContent).toBe('Lindero seleccionado')

    barra.ladoSeleccionado(false)
    expect(situacion().hidden).toBe(true)
    expect(situacion().textContent).toBe('')
  })

  it('los tres modos armados se cuentan, cada uno con su frase EN PRESENTE', () => {
    const { barra } = montarBarra()

    barra.insertarActivo(true)
    expect(situacion().textContent).toBe('Modo insertar: pincha en un lindero')
    barra.insertarActivo(false)

    barra.borrarActivo(true)
    expect(situacion().textContent).toBe('Modo borrar: pincha los vértices que sobren')
    barra.borrarActivo(false)

    // «Dibujar recinto» nace OCULTO, así que primero hay que enseñarlo: un modo
    // armado en un botón invisible no se cuenta (ver la prueba de más abajo).
    barra.dibujoVisible(true)
    barra.dibujoEnCurso(true)
    expect(situacion().textContent).toBe('Dibujando un recinto: pincha cada esquina')

    barra.dibujoEnCurso(false)
    expect(situacion().hidden).toBe(true)
  })

  it('selección Y modo se juntan, y SIEMPRE en el mismo orden', () => {
    const { barra } = montarBarra()
    // Se arma el modo ANTES de seleccionar, para probar que el orden del renglón
    // no depende del orden en que llegaron los hechos.
    barra.borrarActivo(true)
    barra.ladoSeleccionado(true)
    expect(situacion().textContent).toBe(
      'Lindero seleccionado · Modo borrar: pincha los vértices que sobren',
    )
  })

  it('⛔ un modo armado en un botón ESCONDIDO no se cuenta', () => {
    // El hueco crítico que marcó la revisión: `dibujoVisible(false)` con el modo
    // puesto dejaba un estado activo sin botón a la vista. El renglón no puede
    // seguir anunciando un modo cuya herramienta ya no está.
    const { barra } = montarBarra()
    barra.dibujoVisible(true)
    barra.dibujoEnCurso(true)
    expect(situacion().hidden).toBe(false)

    barra.dibujoVisible(false)
    barra.ladoSeleccionado(false) // cualquier repintado
    expect(situacion().hidden).toBe(true)
    expect(situacion().textContent).toBe('')
  })

  it('COMPARTE SLOT CON LA PISTA: mientras el globo está a la vista, se aparta', () => {
    vi.useFakeTimers()
    try {
      const { barra } = montarBarra()
      barra.ladoSeleccionado(true)
      expect(situacion().hidden).toBe(false)

      // Leído de `app/main.js`, no copiado: lo exige el guardián de
      // `test/services/contrato-catastro.test.js`, y con razón — un literal a mano
      // aquí puede divergir del de verdad y dejar la prueba verde sobre otra cosa.
      const boton = nodo(SELECTOR.SELECTOR_BOTON_BORRAR)
      boton.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))
      vi.advanceTimersByTime(RETARDO_PISTA_MS)
      expect(nodo(`.${CLASE_BARRA.PISTA}`).hidden).toBe(false)
      // Las dos se dibujan en `bottom: calc(100% + 6px)`: no pueden coincidir.
      expect(situacion().hidden).toBe(true)

      boton.dispatchEvent(new MouseEvent('mouseout', { bubbles: true, relatedTarget: null }))
      expect(nodo(`.${CLASE_BARRA.PISTA}`).hidden).toBe(true)
      expect(situacion().hidden).toBe(false)
    } finally {
      vi.useRealTimers()
    }
  })

  it('con un desplegable ABIERTO se aparta, y vuelve al cerrarlo', () => {
    const { barra } = montarBarra()
    barra.ladoSeleccionado(true)
    expect(situacion().hidden).toBe(false)

    // Los tres paneles se abren justo donde este renglón se dibuja.
    clic(nodo('[data-desplegable="offset"]'))
    expect(situacion().hidden).toBe(true)

    // Se cierra pinchando FUERA y no en el disparador, a propósito: cerrar desde el
    // disparador devuelve el foco, y el foco enciende la pista **al instante** (es
    // la vía del teclado, anterior a T2). Con la pista encendida la situación se
    // aparta —comparten slot—, así que ese camino prueba otra cosa. Lo cubre la
    // prueba siguiente.
    document.body.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    expect(situacion().hidden).toBe(false)
    expect(situacion().textContent).toBe('Lindero seleccionado')
  })

  it('⚠️ cerrar desde el disparador devuelve el FOCO, y el foco enciende la pista', () => {
    // No es un defecto de T2 y se anota para que no lo parezca: `_cerrar(true)`
    // devuelve el foco al disparador, y `focusin` enseña la pista SIN retardo desde
    // el 2026-08-10. La situación cede el slot, que es lo correcto — pero conviene
    // que esté escrito, porque el renglón «desaparece» sin que nadie lo esconda.
    const { barra } = montarBarra()
    barra.ladoSeleccionado(true)

    const disparador = nodo('[data-desplegable="offset"]')
    clic(disparador)
    clic(disparador) // cierra y devuelve el foco

    expect(nodo(`.${CLASE_BARRA.PISTA}`).hidden).toBe(false)
    expect(situacion().hidden).toBe(true)
  })

  it('NO ocupa alto en la fila: es `absolute`, la barra no se mueve sola', () => {
    // El motivo de que sea `absolute` y no un renglón más: la barra está anclada
    // por su borde inferior, así que cualquier cosa con alto EMPUJA la fila hacia
    // arriba y los botones se moverían bajo el cursor al elegir un lindero.
    montarBarra()
    expect(situacion().style.position).toBe('absolute')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T4 · EL MANDO DE LOS TRES MODOS (2026-08-20)
// ═════════════════════════════════════════════════════════════════════════════
//
// ⛔ **QUÉ HECHO CONVIERTE EN VISUAL, que es todo lo que hay que entender.** Tres
// de las herramientas de esta barra no EJECUTAN: ARMAN. Y las tres son excluyentes
// entre sí —lo decide `viewer/edicion.js`, no el usuario—, así que armar una apaga
// las otras dos sin que su botón haya recibido ningún clic. Hasta T4 eso solo se
// sabía después de pulsar, o leyendo el `aria-pressed`, que no se ve. En la fila
// se presentaban igual que la papelera, que la ayuda o que el desplazamiento, que
// no son modos y no se excluyen con nada.
//
// Lo que se vigila aquí es que ese agrupamiento sea de VERDAD —un `role="group"`
// con nombre, con los tres dentro y con nadie más— y, sobre todo, **que no haya
// costado nada de lo que ya funcionaba**: ni el recorrido de las flechas, ni el
// rojo de lo destructivo, ni el contrato de selectores de `app/main.js`.
describe('barra de edición · T4 · el mando de los tres modos', () => {
  const mando = () => nodo(`.${CLASE_BARRA.MANDO}`)
  const segmentos = () => [...mando().querySelectorAll(`.${CLASE_BARRA.HERRAMIENTA}`)]
  const accionesDe = (nodos) => nodos.map((n) => n.dataset.accion)

  it('los tres modos van dentro, en orden, y NADIE más', () => {
    montarBarra()
    // El orden es el de la frase que el usuario ya tiene en la cabeza: crear,
    // destruir, y el que hace un recinto entero.
    expect(accionesDe(segmentos())).toEqual(['insertar-vertice', 'borrar', 'dibujar-recinto'])
  })

  it('⛔ es `role="group"`, NO un `radiogroup`', () => {
    montarBarra()
    // Los dos motivos, y ninguno es de gusto:
    //   · el estado normal de esta barra es NINGÚN modo armado, y un radiogroup no
    //     sabe expresar «ninguno elegido» sin inventarse una opción vacía;
    //   · un radiogroup de verdad se recorre con las FLECHAS, y las flechas de esta
    //     barra ya son suyas desde el 2026-08-10: recorren la fila entera. Dos
    //     widgets peleándose por las mismas teclas romperían la única forma de
    //     teclado que la barra anuncia al ponerse `role="toolbar"`.
    expect(mando().getAttribute('role')).toBe('group')
  })

  it('lleva NOMBRE: un grupo sin nombre añade un nivel y no añade información', () => {
    montarBarra()
    // Aquí sí es `aria-label` y no un `<span>` oculto —al revés que en los botones,
    // donde el nombre ES el contenido—: un `<span>` dentro del grupo sería un
    // cuarto hijo del control segmentado, con su caja y su hueco. El grupo no tiene
    // texto visible del que colgar un `aria-labelledby` porque sus tres segmentos
    // son iconos.
    expect(mando().getAttribute('aria-label')).toBe('Modos de edición de la geometría')
  })

  it('los tres segmentos son conmutadores desde el arranque, y ninguno está armado', () => {
    montarBarra()
    // Es el estado que un `radiogroup` no sabría contar, y el que esta barra tiene
    // el 100 % del tiempo hasta que alguien pulsa algo.
    expect(segmentos().map((s) => s.getAttribute('aria-pressed'))).toEqual([
      'false',
      'false',
      'false',
    ])
  })

  it('⛔ «Quitar puntos» se queda FUERA: se pulsa y sucede, no arma nada', () => {
    const { barra } = montarBarra()
    barra.puntosVisible(88)
    // Hasta T4 iba pegado al dibujo, y esa adyacencia decía algo cierto (se dibuja
    // sobre los puntos y se quitan cuando ya se ha dibujado). Se ha perdido a
    // propósito: el mando significa exactamente «de estos tres, como mucho uno está
    // armado», y una acción que se ejecuta al primer clic dentro de ese marco sería
    // la peor mentira que esta barra podría contar — y la que más caro se paga, que
    // es la única herramienta que borra de golpe algo que vino de fuera.
    expect(nodo('[data-accion="quitar-puntos"]').closest(`.${CLASE_BARRA.MANDO}`)).toBeNull()
    expect(nodo('[data-accion="quitar-puntos"]').hasAttribute('aria-pressed')).toBe(false)
  })

  it('las que NO son modos siguen fuera, cada una en la fila', () => {
    montarBarra()
    // ⚠️ Los del CONTRATO se leen de `app/main.js`, no se copian: es la regla que
    // vigila `test/services/contrato-catastro.test.js` para este fichero entero.
    for (const selector of [
      SELECTOR.SELECTOR_BOTON_DESHACER,
      SELECTOR.SELECTOR_BOTON_REHACER,
      '[data-desplegable="snap"]',
      '[data-desplegable="offset"]',
      '[data-accion="ayuda"]',
    ]) {
      expect(nodo(selector).closest(`.${CLASE_BARRA.MANDO}`), selector).toBeNull()
    }
  })

  it('⛔ «Borrar» CONSERVA el rojo dentro del mando', () => {
    montarBarra()
    // La tentación era quitárselo: si el relleno macizo es lo que dice qué segmento
    // está armado, dos rellenos distintos podrían leerse como dos estados distintos.
    // Es al revés — armar «Borrar» y armar «Insertar» no son el mismo suceso: uno
    // añade geometría al primer clic y el otro la destruye. Dentro de un mando donde
    // los tres se parecen más que nunca, el color hace MÁS falta, no menos.
    const [insertar, borrar, dibujar] = segmentos()
    expect(borrar.classList.contains(CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA)).toBe(true)
    expect(insertar.classList.contains(CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA)).toBe(false)
    expect(dibujar.classList.contains(CLASE_BARRA.HERRAMIENTA_DESTRUCTIVA)).toBe(false)
  })

  it('⭐ las flechas ATRAVIESAN el mando como si no estuviera', () => {
    const { barra } = montarBarra()
    // El riesgo real de meter un contenedor en medio: `_herramientas` es una lista
    // EXPLÍCITA y no los hijos de la fila, así que el mando no la toca — pero eso
    // hay que demostrarlo, porque un día alguien la derivará del DOM.
    barra.dibujoVisible(true)
    barra.puntosVisible(4)

    nodo('[data-desplegable="offset"]').focus()
    const recorrido = []
    for (let i = 0; i < 4; i += 1) {
      tecla(document.activeElement, 'ArrowRight')
      recorrido.push(document.activeElement.dataset.accion)
    }
    expect(recorrido).toEqual(['insertar-vertice', 'borrar', 'dibujar-recinto', 'quitar-puntos'])
  })

  it('⭐ y siguen SALTANDO el segmento escondido', () => {
    const { barra } = montarBarra()
    // «Dibujar recinto» nace oculto. Meterlo en un grupo no puede convertirlo en una
    // parada: un foco invisible es peor que una parada que falta.
    barra.puntosVisible(2)
    nodo(SELECTOR.SELECTOR_BOTON_BORRAR).focus()
    tecla(document.activeElement, 'ArrowRight')
    expect(document.activeElement.dataset.accion).toBe('quitar-puntos')
  })

  it('el mando NO añade una parada de tabulación propia', () => {
    montarBarra()
    // Un `<div>` sin `tabindex` no la añade, pero se afirma porque el fallo típico
    // al agrupar es dárselo «para que se pueda enfocar el grupo»: eso mete un salto
    // de `Tab` que no hace nada y que el usuario tiene que pasar cada vez.
    expect(mando().hasAttribute('tabindex')).toBe(false)
  })

  it('⛔ el redondeo de los extremos NO lo decide JavaScript', () => {
    const { barra } = montarBarra()
    // La trampa que este test vigila: el último segmento es el que se esconde, así
    // que el borde derecho tiene que elegirse mirando quién es el último VISIBLE.
    // Se resuelve en la hoja con `:has(+ [hidden])`, o sea preguntándole al DOM. Si
    // algún día alguien lo mueve a JavaScript aparecerá un estado que puede
    // desincronizarse, y esta prueba se pondrá roja al no encontrar el mando limpio.
    barra.dibujoVisible(true)
    barra.dibujoVisible(false)
    expect(mando().className).toBe(CLASE_BARRA.MANDO)
    expect(Object.keys({ ...mando().dataset })).toEqual([])
    expect(mando().getAttribute('style')).toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// T10 · LOS DOS HUECOS CRÍTICOS (2026-08-20)
// ═════════════════════════════════════════════════════════════════════════════
//
// De la tabla de modos de fallo del diseño, éstos eran los dos únicos marcados a
// la vez **sin test, sin manejo y SILENCIOSOS**. Lo de silencioso es la parte que
// los hace obligatorios: los otros cinco huecos de esa tabla los ve el autor a la
// primera —un filete suelto, un mando descuadrado, dos controles solapados—, y
// éstos no los ve nadie hasta que ya han hecho daño.
describe('barra de edición · T10 · el modo armado en un botón que se esconde', () => {
  const boton = () => nodo('[data-accion="dibujar-recinto"]')
  const situacion = () => document.querySelector(`.${CLASE_BARRA.SITUACION}`)

  it('⛔ esconder el botón DESARMA el modo', () => {
    // ⚠️ **ESTE FALLO EXISTÍA, y esta prueba lo reprodujo antes de arreglarlo.** El
    // camino está en el repositorio: `app/cableado-edificio.js:2529` esconde el
    // botón al desmontar la parte activa y NO pasa por `dibujoEnCurso(false)` —con
    // razón, porque a esas alturas ya ha destruido el motor del dibujo—.
    const { barra } = montarBarra()
    barra.dibujoVisible(true)
    barra.dibujoEnCurso(true)
    expect(boton().getAttribute('aria-pressed')).toBe('true')

    barra.dibujoVisible(false)
    expect(boton().getAttribute('aria-pressed'), 'un botón invisible no puede estar armado').toBe(
      'false',
    )
  })

  it('⛔ y al VOLVER no vuelve armado, que es donde se veía', () => {
    // El estado viejo no hacía daño mientras el botón estaba escondido —el renglón
    // de situación ya ignora los botones ocultos, y las flechas también—. Salía a
    // la luz al elegir otra parte: el botón reaparecía RELLENO y el renglón decía
    // que se estaba dibujando algo que nadie estaba dibujando.
    const { barra } = montarBarra()
    barra.dibujoVisible(true)
    barra.dibujoEnCurso(true)
    barra.dibujoVisible(false)
    barra.dibujoVisible(true)

    expect(boton().hidden).toBe(false)
    expect(boton().getAttribute('aria-pressed')).toBe('false')
    expect(situacion().hidden, 'el renglón afirmaba un dibujo que no existe').toBe(true)
  })

  it('y el NOMBRE vuelve con él: el botón no se queda diciendo «Cancelar»', () => {
    // Desarmar es también devolver el texto, por los dos canales. Si solo se
    // arreglara el atributo, el botón reaparecería ofreciendo cancelar un dibujo
    // que no existe — y la pista del ratón diría lo mismo.
    const { barra } = montarBarra()
    barra.dibujoVisible(true)
    barra.dibujoEnCurso(true)
    barra.dibujoVisible(false)
    barra.dibujoVisible(true)

    const nombre = boton().querySelector(`.${CLASE_BARRA.ROTULO}`).textContent
    expect(nombre).toMatch(/^Dibujar el recinto/)
    expect(boton().dataset.pista).toBe(nombre)
  })

  it('⭐ la coherencia ya no depende de que quien llame se acuerde', () => {
    // Lo que salvaba a la barra hasta hoy era que sus DOS cableados llaman siempre
    // a `dibujoVisible` y a `dibujoEnCurso` seguidos y en ese orden. Un acuerdo así
    // se rompe en la tercera llamada, y por eso el invariante vive AQUÍ: se escoja
    // el orden que se escoja, esconder gana.
    const { barra } = montarBarra()
    barra.dibujoVisible(true)

    barra.dibujoEnCurso(true)
    barra.dibujoVisible(false)
    expect(boton().getAttribute('aria-pressed'), 'armar y luego esconder').toBe('false')

    barra.dibujoVisible(true)
    barra.dibujoVisible(false)
    barra.dibujoEnCurso(true)
    // Al revés SÍ deja el atributo puesto —nadie puede impedir que le mientan— pero
    // el botón sigue oculto, así que ni el renglón lo cuenta ni las flechas paran
    // en él. Se afirma para que quede dicho dónde está el límite de esta garantía.
    expect(boton().hidden).toBe(true)
    expect(situacion().hidden).toBe(true)
  })
})

describe('barra de edición · T10 · nada se anuncia dos veces', () => {
  /**
   * El texto que un lector de pantalla LEERÍA de un subárbol: se salta lo que
   * lleva `aria-hidden="true"` y lo que está `hidden`, y **no** se salta lo que
   * solo está recortado a 1×1 px, que es justo lo que sigue anunciándose.
   */
  const textoAnunciable = (raiz) => {
    const trozos = []
    const bajar = (n) => {
      if (n.nodeType === 3) {
        trozos.push(n.textContent)
        return
      }
      if (n.nodeType !== 1) return
      if (n.hidden || n.getAttribute('aria-hidden') === 'true') return
      for (const hijo of n.childNodes) bajar(hijo)
    }
    bajar(raiz)
    return trozos.join(' ').replace(/\s+/g, ' ').trim()
  }

  it('⛔ la barra tiene UNA sola región viva, y es el `role="status"`', () => {
    // El fallo que esto vigila es el más silencioso de todos los del diseño: si al
    // renglón de situación le cayera un `role="status"` —o un `aria-live`, o le
    // faltara el `aria-hidden`— quien va por lector de pantalla oiría cada cambio
    // DOS VECES, y en la pantalla no se notaría absolutamente nada.
    const { contenedor } = montarBarra()
    const vivas = [...contenedor.querySelectorAll('[role], [aria-live]')].filter((n) => {
      const rol = n.getAttribute('role')
      return n.hasAttribute('aria-live') || rol === 'status' || rol === 'alert' || rol === 'log'
    })
    expect(vivas).toHaveLength(1)
    expect(vivas[0].classList.contains(CLASE_BARRA.ESTADO)).toBe(true)
  })

  it('⭐ el renglón VISIBLE no aporta ni una palabra al árbol de accesibilidad', () => {
    const { barra, contenedor } = montarBarra()
    barra.ladoSeleccionado(true)
    barra.dibujoVisible(true)
    barra.dibujoEnCurso(true)

    // Se ve, y dice algo.
    const situacion = document.querySelector(`.${CLASE_BARRA.SITUACION}`)
    expect(situacion.hidden).toBe(false)
    expect(situacion.textContent.length).toBeGreaterThan(10)

    // Y no se oye: ni una de sus palabras está en lo anunciable de la barra.
    const anunciable = textoAnunciable(contenedor)
    for (const frase of situacion.textContent.split(' · ')) {
      expect(anunciable, `«${frase}» se anunciaría además de verse`).not.toContain(frase)
    }
  })

  it('⛔ y los NOMBRES de los botones sí siguen estando: no se ha silenciado la barra', () => {
    // La cautela que hace que la prueba de arriba signifique algo. Un `aria-hidden`
    // puesto de más —en la fila, en el mando— la dejaría en verde por la vía
    // equivocada: sin nada que anunciar tampoco hay nada duplicado.
    const { contenedor } = montarBarra()
    const anunciable = textoAnunciable(contenedor)
    for (const nombre of [
      'Deshacer',
      'Ajuste al parcelario',
      'Desplazar lindero',
      'Ayuda sobre los gestos de edición',
    ]) {
      expect(anunciable, `${nombre} ha dejado de anunciarse`).toContain(nombre)
    }
  })

  it('⭐ el mando se anuncia por su `aria-label` y no por un texto suelto', () => {
    // El grupo de T4 es el otro sitio donde habría podido colarse un texto visible
    // que se dijera dos veces. Su nombre vive en el atributo, así que no aporta
    // contenido al recorrido: los tres segmentos se anuncian por el suyo.
    montarBarra()
    const mando = nodo(`.${CLASE_BARRA.MANDO}`)
    expect(mando.getAttribute('aria-label')).toBe('Modos de edición de la geometría')
    expect(textoAnunciable(mando)).not.toContain('Modos de edición')
  })
})

/* -------------------------------------------------------------------------- *
 * test/app/rama.dom.test.js — F11 · T2.4 · el conmutador de rama               *
 *                                                                              *
 * `app/rama.js` es la tarea de F11 con MÁS riesgo de romper la rama parcela en  *
 * silencio, y todo lo que puede salir mal en ella es invisible en una captura   *
 * de pantalla:                                                                  *
 *                                                                              *
 *   · Un `replaceChildren` en vez de un `hidden` y las 30 referencias que       *
 *     `app/` resolvió UNA sola vez en el montaje quedan huérfanas: escribir en  *
 *     ellas **no lanza**, sus oyentes **siguen disparando**, y la referencia    *
 *     catastral recién traída del Catastro acaba en un nodo fuera del documento *
 *     mientras el usuario ve el campo vacío. Medido en la fase 0 (T0.3·5), y es *
 *     el guardián de esta suite: va con `toBe` SOBRE EL NODO, no sobre su       *
 *     contenido, porque un contenido igual lo produce también un nodo nuevo.    *
 *   · Un `data-campo` repetido entre las dos ramas y `querySelector` se queda   *
 *     con el de parcela **aunque esté `hidden`** (T0.3·6): el cableado de       *
 *     edificio leería y escribiría en un campo invisible de la otra rama.       *
 *   · Un CTA que se queda encendido en la rama EDIFICIO y el usuario genera el  *
 *     GML de la PARCELA creyendo que genera el del edificio.                    *
 *   · Una barra de edición a la vista con la rama EDIFICIO y un `Ctrl+Z` ahí    *
 *     deshace una edición que el usuario cree estar haciendo sobre el edificio. *
 *                                                                              *
 * ── DECISIÓN 1 · LA CÁSCARA SE LEE DE `index.html`, NO SE COPIA ──             *
 * Misma decisión (y por lo mismo) que `test/app/catastro.dom.test.js`: el       *
 * marcado es CONTRATO, y una copia a mano aquí podría quedarse en verde con un  *
 * `index.html` ya roto — que es exactamente el fallo que el contrato existe     *
 * para evitar. Se monta el `<body>` REAL leído del disco, **con su `class`**:   *
 * `innerHTML` no trae los atributos del `<body>`, y sin `gml-app` el módulo no  *
 * encontraría dónde poner `data-rama`.                                          *
 *                                                                              *
 * ── DECISIÓN 2 · EL PANEL DE EDIFICIO ES UN DOBLE, Y ESO ES CORRECTO ──        *
 * `app/panel-edificio.js` es de T2.5 y se escribe EN PARALELO con esto. Aquí se *
 * fabrica un doble con los nombres del **contrato K.2** (`refcat-edificio`,     *
 * `cargar-catastro-edificio`, `[data-estado="edificio"]`,                       *
 * `[data-procedencia="edificio"]`), que es lo único que `app/rama.js` necesita  *
 * saber de él: que está marcado con `data-rama-panel="EDIFICIO"`. Y el          *
 * guardián de colisiones se escribe GENÉRICO —recorre las dos ramas y cruza los *
 * cinco `data-*` del contrato— para que siga diciendo la verdad el día que el   *
 * doble se sustituya por el módulo de verdad.                                    *
 *                                                                              *
 * ── MUTACIONES EJECUTADAS PARA COMPROBAR QUE LOS GUARDIANES NO SON VACUOS ──   *
 * Cada una se aplicó a `app/rama.js`, se corrió `npm run test:dom` y se         *
 * revirtió con el editor (nunca con `git checkout`).                            *
 *   M1 · `seccion.replaceChildren()` en vez de `seccion.hidden = …` (el fallo   *
 *        que este fichero existe para impedir).                                  *
 *   M2 · quitar `.gml-bloque--vertices` de `SECCIONES_PARCELA` (dos estiradores *
 *        a la vez en la rama EDIFICIO).                                          *
 *   M3 · pintar el activo desde `aria-pressed` y no escribir `data-rama`.        *
 *   M4 · no restaurar el `disabled`/renglón previos de los CTA al volver.        *
 *   M5 · preguntar por `visor.edicion` en vez de por `visor.barraEdicion`.       *
 *   M6 · `barra.remove()` en vez de `barra.hidden = true`.                       *
 *   M7 · `destruir()` sin quitar los oyentes.                                    *
 *   M8 · quitar la reconciliación de la guarda anti-reentrada de `set`.          *
 * Los resultados están anotados al final de este fichero.                        *
 *                                                                              *
 * ⛔ **Y DOS DE LOS OCHO SALIERON VERDES A LA PRIMERA**, o sea que dos          *
 * guardianes de esta suite eran VACUOS y solo se supo al mutar:                  *
 *   · **M5** — el `try` que envuelve a `getContainer()` se traga el TypeError    *
 *     de desreferenciar una `barraEdicion` nula, así que «no lanza» pasaba       *
 *     igual con la instrucción incumplida. Se sustituyó por un contador de       *
 *     accesos a la propiedad: la instrucción es «no leas `edicion`», y eso es    *
 *     lo que ahora se mide.                                                      *
 *   · **M7** — todos los oyentes de este módulo empiezan por `if (destruido)     *
 *     return`, así que pulsar después de `destruir()` se comporta igual con      *
 *     ellos vivos: la prueba medía la bandera, no la retirada. Se sustituyó por  *
 *     un parte de altas y bajas con `addEventListener` intervenido.              *
 * Es la lección de F03 fase 4 —«guardianes que no disparan y tests que mienten   *
 * en verde»— repetida dos veces en el mismo fichero.                             *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import {
  ATRIBUTO_IR_A_RAMA,
  ATRIBUTO_PANEL,
  ATRIBUTO_RAMA,
  CLASE_CONMUTADOR,
  CLASE_REUTILIZADA,
  MENSAJE_CONMUTAR_ROTO,
  MENSAJE_SIN_PANEL_EDIFICIO,
  ID_MOTIVO_CTA,
  // ⭐ F13 · `MOTIVO_CTA_EN_EDIFICIO` y `MOTIVO_GENERAR_GML_EN_EDIFICIO` ya no
  // existen: los retiró la fase que volvió falsa su afirmación. Hay un `it` que
  // comprueba que no vuelven.
  RAMA,
  RAMAS,
  ROTULO,
  SECCIONES_PARCELA,
  SELECTOR,
  cablearRama,
  mensajePanelDesconocido,
  selectorBoton,
  selectorPanel,
} from '../../app/rama.js'
// El espacio entero, para poder afirmar que los dos motivos retirados en F13 NO
// vuelven. Con `import {…}` no se puede: un nombre que no existe se importa como
// `undefined` en unos empaquetadores y revienta la carga en otros; sobre el
// espacio se comprueba sin ambigüedad.
import * as moduloRama from '../../app/rama.js'
import { NIVEL } from '../../viewer/_comun.js'

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

// `import.meta.dirname` y no `fileURLToPath(import.meta.url)`: bajo jsdom la URL
// del módulo no es de esquema `file:` y aquella conversión lanza. Mismo camino
// que `test/app/catastro.dom.test.js`.
const RAIZ = join(import.meta.dirname, '..', '..')

/**
 * El `<body>` de `index.html`: su etiqueta de apertura (de donde sale la clase
 * `gml-app`) y su contenido. El `<script type="module">` de dentro NO se ejecuta
 * al asignarlo por `innerHTML` —jsdom no evalúa scripts insertados así—, que es
 * justo lo que se quiere: aquí no se arranca la app.
 */
const INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body([^>]*)>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/rama.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara de ' +
        'estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const clase = /class\s*=\s*"([^"]*)"/i.exec(encontrado[1])
  return { clase: clase === null ? '' : clase[1], cuerpo: encontrado[2] }
})()

/**
 * Los dos bloques que el panel de edificio de T2.5 pondrá en el panel, con los
 * nombres del contrato K.2. Ver la decisión 2 de la cabecera.
 */
const PANEL_EDIFICIO_DOBLE = `
  <section class="gml-bloque gml-bloque--edificio" ${ATRIBUTO_PANEL}="${RAMA.EDIFICIO}" hidden>
    <h2 class="gml-rotulo">Origen del edificio</h2>
    <input class="gml-entrada gml-mono" type="text" data-campo="refcat-edificio" />
    <button type="button" class="gml-boton" data-accion="cargar-catastro-edificio">
      Traer del Catastro
    </button>
    <p class="gml-accion-estado" data-estado="edificio" role="status"></p>
    <p class="gml-procedencia" data-procedencia="edificio"></p>
  </section>
  <section class="gml-bloque gml-bloque--partes" ${ATRIBUTO_PANEL}="${RAMA.EDIFICIO}" hidden>
    <h2 class="gml-rotulo">Partes de la construcción</h2>
    <ul class="gml-partes" data-lista="partes"></ul>
  </section>
`

/** Monta la cáscara real y, si se pide, el doble del panel de edificio. */
function montarCascara({ conPanelEdificio = true } = {}) {
  document.body.className = INDEX.clase
  document.body.innerHTML = INDEX.cuerpo
  if (!conPanelEdificio) return
  const panel = document.querySelector('.gml-panel')
  const pie = panel.querySelector('.gml-panel-pie')
  const molde = document.createElement('div')
  molde.innerHTML = PANEL_EDIFICIO_DOBLE
  for (const seccion of Array.from(molde.children)) panel.insertBefore(seccion, pie)
}

// ── Dobles ────────────────────────────────────────────────────────────────────

/** Un panel de avisos de mentira: lo único que este módulo le pide es `avisar`. */
function doblePanel() {
  return { avisar: vi.fn() }
}

/**
 * Un visor de mentira. ⛔ `edicion` y `barraEdicion` son DOS preguntas distintas
 * y la primera no implica la segunda (medido por T1.5, `edicion:{barra:false}`),
 * así que se pueden pedir por separado — que es justo lo que hace falta para
 * probar que el módulo pregunta por la buena.
 */
function dobleVisor({ conEdicion = true, conBarra = true } = {}) {
  const contenedorBarra = document.createElement('div')
  contenedorBarra.className = 'gml-barra-edicion'
  document.body.appendChild(contenedorBarra)
  return {
    edicion: conEdicion ? { destruir() {} } : null,
    barraEdicion: conBarra ? { control: { getContainer: () => contenedorBarra } } : null,
    contenedorBarra,
  }
}

// ── Utilidades de medida ─────────────────────────────────────────────────────

const conmutador = () => document.querySelector(SELECTOR.CONMUTADOR)
const boton = (rama) => document.querySelector(selectorBoton(rama))
const campoRefcat = () => document.querySelector('[data-campo="refcat"]')
const seccionCatastro = () => document.querySelector('.gml-bloque--catastro')
const seccionVertices = () => document.querySelector('.gml-bloque--vertices')

/** Los cinco `data-*` que el contrato K.1 prohíbe repetir entre ramas. */
const DATOS_EXCLUSIVOS = ['data-campo', 'data-accion', 'data-estado', 'data-ficha', 'data-procedencia']

/**
 * Recoge los valores de los cinco `data-*` dentro de las secciones de una rama.
 * Genérico a propósito: sirve igual con el doble del panel de edificio y con el
 * módulo de verdad cuando T2.5 aterrice.
 *
 * @param {string} rama
 * @returns {Map<string, Set<string>>}
 */
function datosDeLaRama(rama) {
  const porAtributo = new Map(DATOS_EXCLUSIVOS.map((a) => [a, new Set()]))
  for (const seccion of document.querySelectorAll(selectorPanel(rama))) {
    for (const atributo of DATOS_EXCLUSIVOS) {
      for (const nodo of seccion.querySelectorAll(`[${atributo}]`)) {
        porAtributo.get(atributo).add(nodo.getAttribute(atributo))
      }
      if (seccion.hasAttribute(atributo)) {
        porAtributo.get(atributo).add(seccion.getAttribute(atributo))
      }
    }
  }
  return porAtributo
}

/**
 * Corre `fn` con `addEventListener`/`removeEventListener` intervenidos y devuelve
 * el parte de altas y bajas. Es la única forma que hay de medir que un módulo
 * retira lo que puso: el comportamiento no lo distingue, porque los oyentes de
 * este módulo empiezan todos por `if (destruido) return` y con o sin retirada la
 * pantalla se comporta igual. Ver el `it` que lo usa.
 *
 * @param {() => void} fn
 */
function espiarOyentes(fn) {
  const altas = []
  const bajas = []
  const altaOriginal = EventTarget.prototype.addEventListener
  const bajaOriginal = EventTarget.prototype.removeEventListener
  EventTarget.prototype.addEventListener = function (tipo, oyente, opciones) {
    altas.push({ diana: this, tipo, oyente, opciones })
    return altaOriginal.call(this, tipo, oyente, opciones)
  }
  EventTarget.prototype.removeEventListener = function (tipo, oyente, opciones) {
    bajas.push({ diana: this, tipo, oyente, opciones })
    return bajaOriginal.call(this, tipo, oyente, opciones)
  }
  try {
    fn()
  } finally {
    EventTarget.prototype.addEventListener = altaOriginal
    EventTarget.prototype.removeEventListener = bajaOriginal
  }
  return { altas, bajas }
}

let cableado = null

beforeEach(() => {
  montarCascara()
  cableado = null
  vi.restoreAllMocks()
})

afterEach(() => {
  if (cableado !== null) cableado.destruir()
  cableado = null
})

/** Cablea con el panel doble y devuelve `{rama, panel}`. */
function cablear(opciones = {}) {
  const panel = opciones.panel ?? doblePanel()
  cableado = cablearRama({ documento: document, panel, ...opciones })
  return { rama: cableado, panel }
}

// ── 1 · El marcado que fabrica ───────────────────────────────────────────────

describe('app/rama · fabrica su propio marcado dentro de `.gml-chips`', () => {
  it('`index.html` NO trae el conmutador: lo pone este módulo', () => {
    // Si algún día alguien lo escribe también en la cáscara habría DOS, y
    // `querySelector` se quedaría con el primero: la mitad de los oyentes
    // quedarían muertos y nada avisaría (la trampa que `index.html` documenta
    // desde F06).
    expect(conmutador()).toBeNull()
    cablear()
    expect(conmutador()).not.toBeNull()
  })

  it('el conmutador cuelga de `.gml-chips` y es su PRIMER hijo', () => {
    cablear()
    const chips = document.querySelector(SELECTOR.CHIPS)
    expect(conmutador().parentElement).toBe(chips)
    expect(chips.firstElementChild).toBe(conmutador())
    // Y los dos chips de contadores siguen ahí: el conmutador se suma, no
    // sustituye.
    expect(chips.querySelectorAll('.gml-chip')).toHaveLength(2)
  })

  it('son DOS `.gml-boton--menudo`, uno por rama, con su rótulo', () => {
    cablear()
    const botones = conmutador().querySelectorAll('button')
    expect(botones).toHaveLength(2)
    expect(Array.from(botones).map((b) => b.getAttribute(ATRIBUTO_IR_A_RAMA))).toEqual([...RAMAS])
    for (const b of botones) {
      expect(b.type).toBe('button')
      expect(b.classList.contains('gml-boton')).toBe(true)
      expect(b.classList.contains('gml-boton--menudo')).toBe(true)
    }
    expect(boton(RAMA.PARCELA).textContent.trim()).toBe(ROTULO.PARCELA)
    expect(boton(RAMA.EDIFICIO).textContent.trim()).toBe(ROTULO.EDIFICIO)
  })

  it('el conmutador es un `role="group"` con etiqueta, no dos botones sueltos', () => {
    cablear()
    expect(conmutador().getAttribute('role')).toBe('group')
    expect(conmutador().getAttribute('aria-label')).toBeTruthy()
  })

  it('NO escribe ni una regla CSS desde JS (el cromo es de estilos/app.css)', () => {
    cablear()
    // `gap: 4px`, `inline-flex` y el estado activo son de T1.6. Una declaración
    // en línea aquí ganaría a la hoja y desharía los 116,17 px medidos.
    expect(conmutador().getAttribute('style')).toBeNull()
    for (const rama of RAMAS) expect(boton(rama).getAttribute('style')).toBeNull()
    expect(conmutador().className).toBe(CLASE_CONMUTADOR)
  })

  it('solo usa clases propias o declaradas como REUTILIZADAS (regla de oro 9)', () => {
    cablear()
    const usadas = new Set()
    for (const nodo of [conmutador(), ...conmutador().querySelectorAll('*')]) {
      for (const clase of nodo.classList) usadas.add(clase)
    }
    const permitidas = new Set([CLASE_CONMUTADOR, ...CLASE_REUTILIZADA])
    expect(Array.from(usadas).filter((c) => !permitidas.has(c))).toEqual([])
    // Y ninguna lleva juicio: ni `--ok`, ni `--error`, ni `--valido`.
    for (const clase of usadas) {
      expect(clase).not.toMatch(/(ok|error|exito|éxito|valid|correct|mal|bien)/i)
    }
  })
})

// ── 2 · `set` y el estado visible ────────────────────────────────────────────

describe('app/rama · `set` cambia `data-rama` y `aria-pressed`', () => {
  it('nace en PARCELA, con `data-rama` escrito desde el arranque', () => {
    const { rama } = cablear()
    expect(rama.get()).toBe(RAMA.PARCELA)
    expect(document.body.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.PARCELA)
    expect(boton(RAMA.PARCELA).getAttribute('aria-pressed')).toBe('true')
    expect(boton(RAMA.EDIFICIO).getAttribute('aria-pressed')).toBe('false')
  })

  it('`set(EDIFICIO)` mueve el atributo del `<body>` y los dos `aria-pressed`', () => {
    const { rama } = cablear()
    rama.set(RAMA.EDIFICIO)
    expect(rama.get()).toBe(RAMA.EDIFICIO)
    expect(document.body.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.EDIFICIO)
    expect(boton(RAMA.PARCELA).getAttribute('aria-pressed')).toBe('false')
    expect(boton(RAMA.EDIFICIO).getAttribute('aria-pressed')).toBe('true')
  })

  it('el `<body>` ES `.gml-app`, así que el gancho del CSS está donde el CSS lo busca', () => {
    cablear()
    // `.gml-app[data-rama='EDIFICIO'] [data-ir-a-rama='EDIFICIO']` es (0,3,0) y
    // gana por especificidad; si el atributo cayera en otro nodo, la regla no
    // encontraría nada y el botón activo se vería igual que el apagado.
    expect(document.body.classList.contains('gml-app')).toBe(true)
    expect(document.querySelector(`${SELECTOR.APP}[${ATRIBUTO_RAMA}]`)).toBe(document.body)
  })

  it('pulsar un botón conmuta; pulsar el de la rama activa no notifica', () => {
    const { rama } = cablear()
    const visto = []
    rama.subscribe((r) => visto.push(r))

    boton(RAMA.EDIFICIO).click()
    expect(rama.get()).toBe(RAMA.EDIFICIO)
    expect(visto).toEqual([RAMA.EDIFICIO])

    // Repetir la pulsación no despierta a nadie: un `set` redundante haría que
    // los suscriptores de fuera recargasen sin que nada haya cambiado.
    boton(RAMA.EDIFICIO).click()
    expect(visto).toEqual([RAMA.EDIFICIO])

    boton(RAMA.PARCELA).click()
    expect(visto).toEqual([RAMA.EDIFICIO, RAMA.PARCELA])
  })

  it('una rama que no existe LANZA (contrato del programador)', () => {
    const { rama } = cablear()
    expect(() => rama.set('SOLAR')).toThrow(RangeError)
    expect(() => rama.set(null)).toThrow(RangeError)
    // Y no ha dejado el `<body>` con un valor que ninguna regla del CSS atiende.
    expect(document.body.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.PARCELA)
  })
})

// ── 3 · ⭐ EL GUARDIÁN DEL RIESGO 1 (M10) ────────────────────────────────────

describe('app/rama · ida y vuelta a EDIFICIO deja VIVA la rama parcela (M10)', () => {
  it('el nodo `[data-campo="refcat"]` es EL MISMO, con su valor y sus oyentes', () => {
    const { rama } = cablear()
    const antes = campoRefcat()
    antes.value = '9398516VK3799G'
    const oido = vi.fn()
    antes.addEventListener('input', oido)

    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)

    const despues = campoRefcat()
    // `toBe` sobre el NODO: un contenido igual lo produce también un nodo nuevo,
    // y un nodo nuevo es exactamente el fallo que este `it` existe para cazar.
    expect(despues).toBe(antes)
    expect(despues.isConnected).toBe(true)
    expect(despues.value).toBe('9398516VK3799G')

    despues.dispatchEvent(new Event('input', { bubbles: true }))
    expect(oido).toHaveBeenCalledTimes(1)
  })

  it('mientras está en EDIFICIO el campo sigue CONECTADO, solo que oculto', () => {
    const { rama } = cablear()
    const campo = campoRefcat()
    rama.set(RAMA.EDIFICIO)
    // Ésta es la diferencia entera con `replaceChildren`: allí `isConnected`
    // pasa a `false`, escribir NO lanza y el dato del Catastro se pierde en
    // silencio.
    expect(campo.isConnected).toBe(true)
    expect(document.querySelector('[data-campo="refcat"]')).toBe(campo)
    expect(seccionCatastro().hidden).toBe(true)
  })

  it('el intercambio es por `hidden` y NADA se saca del documento', () => {
    const { rama } = cablear()
    const catastro = seccionCatastro()
    const vertices = seccionVertices()
    const edificio = document.querySelector('.gml-bloque--edificio')
    const partes = document.querySelector('.gml-bloque--partes')

    rama.set(RAMA.EDIFICIO)
    expect(catastro.hidden).toBe(true)
    expect(vertices.hidden).toBe(true)
    expect(edificio.hidden).toBe(false)
    expect(partes.hidden).toBe(false)
    for (const n of [catastro, vertices, edificio, partes]) expect(n.isConnected).toBe(true)

    rama.set(RAMA.PARCELA)
    expect(catastro.hidden).toBe(false)
    expect(vertices.hidden).toBe(false)
    expect(edificio.hidden).toBe(true)
    expect(partes.hidden).toBe(true)
    for (const n of [catastro, vertices, edificio, partes]) expect(n.isConnected).toBe(true)
  })

  it('la caja de vértices y su contenido sobreviven al viaje', () => {
    const { rama } = cablear()
    const tabla = document.querySelector('#tabla-vertices')
    tabla.textContent = 'los 15 vértices'
    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)
    expect(document.querySelector('#tabla-vertices')).toBe(tabla)
    expect(tabla.textContent).toBe('los 15 vértices')
  })

  it('«Vértices» TAMBIÉN es de la rama parcela: el estirador cambia de dueño', () => {
    // `.gml-bloque--partes` es `flex: 1 1 auto` y sustituye a
    // `.gml-bloque--vertices` como único bloque que se estira. Dos estiradores a
    // la vez descosen el reparto de altura del panel (el desastre de F06).
    expect(SECCIONES_PARCELA).toContain('.gml-bloque--vertices')
    cablear()
    expect(seccionVertices().getAttribute(ATRIBUTO_PANEL)).toBe(RAMA.PARCELA)
  })

  it('«Avisos» y el pie NO se intercambian: son de las dos ramas', () => {
    const { rama } = cablear()
    const avisos = document.querySelector('.gml-bloque--avisos')
    const pie = document.querySelector('.gml-panel-pie')
    rama.set(RAMA.EDIFICIO)
    expect(avisos.hasAttribute(ATRIBUTO_PANEL)).toBe(false)
    expect(avisos.hidden).toBe(false)
    expect(pie.hidden).toBe(false)
  })
})

// ── 4 · Ningún `data-*` repetido entre ramas (T0.3·6) ────────────────────────
//
// ⚠️ **ESTE BLOQUE YA NO ES EL ÚNICO GUARDIÁN DE K.1, NI EL PRINCIPAL** (rework
// de UI · T3, 2026-08-04). Lo que hay aquí compara **una rama contra la otra**,
// mirando solo dentro de las secciones marcadas con `data-rama-panel`, y sobre un
// DOBLE del panel de edificio: es la comprobación de cerca, y sigue valiendo
// porque es la que falla ANTES y nombrando la rama.
//
// La de lejos vive en `test/app/main-edificio.dom.test.js` (bloque 8), corre
// sobre `app/main.js` de verdad ya arrancado, y afirma la regla generalizada:
// **cada par atributo/valor es único en el documento montado ENTERO** —pie,
// avisos, cabecera, los dos `<dialog>`, la barra de edición y los cajones
// incluidos—, salvo dos grupos declarados con su motivo. Está escrita así para
// que cubra también el eje PASO sin tocarla el día que el rail aterrice.

describe('app/rama · ningún `data-*` se repite entre las dos ramas', () => {
  it('los cinco atributos del contrato K.1 no tienen ni un valor en común', () => {
    cablear()
    const enParcela = datosDeLaRama(RAMA.PARCELA)
    const enEdificio = datosDeLaRama(RAMA.EDIFICIO)
    for (const atributo of DATOS_EXCLUSIVOS) {
      const comunes = Array.from(enParcela.get(atributo)).filter((v) =>
        enEdificio.get(atributo).has(v),
      )
      expect(
        comunes,
        `«${atributo}» repetido entre las dos ramas: querySelector se quedaría con el de ` +
          `parcela aunque esté hidden, y el cableado de edificio escribiría en un campo invisible`,
      ).toEqual([])
    }
  })

  it('la rama parcela sí trae los suyos (el guardián no es vacuo)', () => {
    cablear()
    const enParcela = datosDeLaRama(RAMA.PARCELA)
    expect(enParcela.get('data-campo').has('refcat')).toBe(true)
    expect(enParcela.get('data-accion').has('cargar-catastro')).toBe(true)
    expect(enParcela.get('data-procedencia').has('parcela')).toBe(true)
    const enEdificio = datosDeLaRama(RAMA.EDIFICIO)
    expect(enEdificio.get('data-campo').has('refcat-edificio')).toBe(true)
    expect(enEdificio.get('data-procedencia').has('edificio')).toBe(true)
  })

  it('el conmutador no vive en ninguna de las dos ramas (no se puede autoocultar)', () => {
    cablear()
    expect(conmutador().closest(`[${ATRIBUTO_PANEL}]`)).toBeNull()
  })
})

// ── 5 · Los dos CTA del pie ──────────────────────────────────────────────────

describe('app/rama · el CTA que esta rama no sabe atender se apaga CON MOTIVO', () => {
  const ctaGenerar = () => document.querySelector(SELECTOR.CTA_GENERAR)
  const ctaDiagnosticar = () => document.querySelector(SELECTOR.CTA_DIAGNOSTICAR)
  const renglonGenerar = () => document.querySelector(SELECTOR.ESTADO_GENERAR)
  const renglonDiagnosticar = () => document.querySelector(SELECTOR.ESTADO_DIAGNOSTICAR)

  // ── ⭐ REESCRITO EN F13 (2026-08-06) ────────────────────────────────────────
  //
  // Hasta esta fase se apagaban LOS DOS CTA con un motivo único que los nombraba,
  // y ese motivo único venía a su vez de una corrección del 2026-08-04 que
  // destapó el guion de humo 13: dos motivos permanentes costaban **+134,75 px**
  // en `.gml-acciones` (72,78 → 207,53), el panel se sobresuscribía **47,54 px en
  // vacío** a 1440×900 y `.gml-panel` recortaba por abajo dejando «Diagnosticar
  // encaje» y su explicación fuera de la pantalla.
  //
  // **F13 deshace el problema en vez de administrarlo**: «Generar GML» ya no se
  // apaga por estar en la rama Edificio, porque esta versión SÍ sabe escribir el
  // GML de una construcción. Queda un solo CTA apagado —«Diagnosticar encaje»,
  // que es F14— y su motivo cabe entero, en su propio renglón.
  //
  // ⚠️ Lo de abajo defiende las dos cosas: lo que hace hoy, y que los literales
  // retirados NO vuelvan.

  it('⭐ F14 · «Diagnosticar encaje» TAMPOCO se apaga ya por estar en Edificio', () => {
    // El cambio de F14, y el que deja a este módulo sin apagar ningún CTA por
    // rama: `diagnostico/edificio.js` contrasta la construcción medida con la
    // registrada, así que el motivo de F11 —«todavía no sabe hacerlo con un
    // edificio»— pasó a ser falso y se retiró.
    //
    // Se enciende primero, como lo enciende `cablearDiagnostico` cuando hay
    // geometría: comprobar que no se apaga algo que ya nacía apagado no probaría
    // nada.
    const { rama } = cablear()
    ctaDiagnosticar().disabled = false
    renglonDiagnosticar().textContent = 'Diagnóstico hecho hace un momento.'

    rama.set(RAMA.EDIFICIO)

    expect(ctaDiagnosticar().disabled).toBe(false)
    expect(renglonDiagnosticar().textContent).toBe('Diagnóstico hecho hace un momento.')
  })

  it('⭐ y «Generar GML» YA NO SE APAGA por estar en la rama Edificio', () => {
    // Es el cambio de F13: `gml/serialize-bu.js` escribe el fichero del ICUC y
    // `app/cableado-edificio-gml.js` gobierna este botón según el DATO. Este
    // módulo no lo toca, ni para apagarlo ni para escribirle el renglón.
    const { rama } = cablear()
    ctaGenerar().disabled = false
    renglonGenerar().textContent = 'GML preparado hace un momento.'

    rama.set(RAMA.EDIFICIO)

    expect(ctaGenerar().disabled).toBe(false)
    expect(renglonGenerar().textContent).toBe('GML preparado hace un momento.')
  })

  it('⭐ conmutar de rama NO deja ni un CTA apagado ni un renglón escrito', () => {
    // La propiedad que resume F14 en este módulo: `app/rama.js` intercambia
    // paneles y conmuta, y **quién puede pulsar qué lo deciden el dato y el
    // peldaño**, cada uno en su sitio. Se mide sobre los DOS botones a la vez,
    // porque el defecto que esto vigila es que alguien vuelva a colgar de aquí un
    // apagado por rama y solo se acuerde de mirar uno.
    const { rama } = cablear()
    ctaGenerar().disabled = false
    ctaDiagnosticar().disabled = false
    renglonGenerar().textContent = ''
    renglonDiagnosticar().textContent = ''

    rama.set(RAMA.EDIFICIO)

    expect(ctaGenerar().disabled).toBe(false)
    expect(ctaDiagnosticar().disabled).toBe(false)
    expect(renglonGenerar().textContent).toBe('')
    expect(renglonDiagnosticar().textContent).toBe('')
    // Y no queda el `id` del motivo colgando de un renglón que ya no lleva motivo.
    expect(renglonDiagnosticar().hasAttribute('id')).toBe(false)
    expect(ctaDiagnosticar().hasAttribute('aria-describedby')).toBe(false)
  })

  it('al volver a PARCELA el documento queda como estaba, atributo a atributo', () => {
    const { rama } = cablear()
    expect(renglonDiagnosticar().hasAttribute('id')).toBe(false)
    ctaDiagnosticar().disabled = false
    renglonDiagnosticar().textContent = 'Diagnóstico hecho hace un momento.'

    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)

    expect(renglonDiagnosticar().hasAttribute('id')).toBe(false)
    expect(ctaDiagnosticar().hasAttribute('aria-describedby')).toBe(false)
    expect(ctaDiagnosticar().disabled).toBe(false)
    expect(renglonDiagnosticar().textContent).toBe('Diagnóstico hecho hace un momento.')
  })

  it('⛔ NINGUNO de los tres motivos de rama retirados vuelve a existir', () => {
    // Guardián de las dos retiradas, la de F13 y la de F14. Los tres literales
    // afirmaban limitaciones que este proyecto ya no tiene:
    //
    //   · «…escribe el GML de una parcela y todavía no el de una construcción»  (F13)
    //   · «…«Generar GML» y «Diagnosticar encaje» están apagados en Edificio»    (F13)
    //   · «…el diagnóstico … todavía no sabe hacerlo con un edificio»            (F14)
    //
    // Si alguien repone cualquiera de ellos, esto se pone rojo.
    expect(moduloRama.MOTIVO_CTA_EN_EDIFICIO).toBeUndefined()
    expect(moduloRama.MOTIVO_GENERAR_GML_EN_EDIFICIO).toBeUndefined()
    expect(moduloRama.MOTIVO_DIAGNOSTICAR_EN_EDIFICIO).toBeUndefined()
  })

  it('⛔ y las frases retiradas no aparecen EN PANTALLA al conmutar', () => {
    // El guardián de arriba mira el módulo; éste mira lo que el usuario LEE, que
    // es lo que de verdad importa: una frase puede volver copiada a mano en
    // cualquier otro sitio del cableado.
    const { rama } = cablear()
    rama.set(RAMA.EDIFICIO)
    const enPantalla = document.body.textContent
    expect(enPantalla).not.toMatch(/todavía no sabe hacerlo con un edificio/i)
    expect(enPantalla).not.toMatch(/todavía no el de una construcción/i)
    expect(enPantalla).not.toMatch(/Vuelve a la rama Parcela y el botón se enciende/i)
  })

  it('⭐ F14 · el modificador `--error` de su renglón ya NO lo toca este módulo', () => {
    // Mientras el CTA se apagaba por rama, este módulo retiraba el `--error`: que
    // el diagnóstico de edificio no existiera todavía no era un error del usuario.
    // Con el apagado retirado, la clase es de quien escribe el renglón —el
    // cableado del diagnóstico— y conmutar de rama no puede borrarle un estado que
    // no ha puesto.
    const { rama } = cablear()
    renglonDiagnosticar().classList.add('gml-accion-estado--error')

    rama.set(RAMA.EDIFICIO)
    expect(renglonDiagnosticar().classList.contains('gml-accion-estado--error')).toBe(true)

    rama.set(RAMA.PARCELA)
    expect(renglonDiagnosticar().classList.contains('gml-accion-estado--error')).toBe(true)
  })

  it('⭐ F14 · «Diagnosticar encaje» SÍ llega a su oyente en la rama Edificio', () => {
    // El gemelo del de «Generar GML» de F13, y el mismo argumento: la guarda de
    // captura ya no se pone en este botón, porque impedir su clic sería impedir
    // justamente lo que F14 viene a permitir — contrastar una construcción.
    const { rama } = cablear()
    const oido = vi.fn()
    ctaDiagnosticar().addEventListener('click', oido)
    ctaDiagnosticar().disabled = false

    rama.set(RAMA.EDIFICIO)
    ctaDiagnosticar().click()

    expect(oido).toHaveBeenCalledTimes(1)
  })

  it('⭐ y «Generar GML» SÍ llega a su oyente en la rama Edificio', () => {
    // El otro lado del cambio: la guarda de captura ya no se pone en este botón,
    // porque impedir su clic sería impedir justamente lo que F13 viene a permitir.
    const { rama } = cablear()
    const oido = vi.fn()
    ctaGenerar().addEventListener('click', oido)
    ctaGenerar().disabled = false

    rama.set(RAMA.EDIFICIO)
    ctaGenerar().click()

    expect(oido).toHaveBeenCalledTimes(1)
  })

  it('en PARCELA la guarda es inerte: el CTA funciona como siempre', () => {
    const { rama } = cablear()
    const oido = vi.fn()
    ctaGenerar().addEventListener('click', oido)
    ctaGenerar().disabled = false

    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)
    ctaGenerar().click()

    expect(oido).toHaveBeenCalledTimes(1)
  })
})

// ── 6 · La barra de edición flotante ─────────────────────────────────────────

describe('app/rama · oculta la barra de edición, sin desmontarla', () => {
  it('en EDIFICIO la barra queda `hidden` y su contenedor SIGUE conectado', () => {
    const visor = dobleVisor()
    const { rama } = cablear({ visor })

    rama.set(RAMA.EDIFICIO)

    expect(visor.contenedorBarra.hidden).toBe(true)
    // `remove()` obligaría a reconstruir la barra y a recablearla desde
    // `app/main.js`, que resolvió sus siete nodos UNA sola vez en el montaje.
    expect(visor.contenedorBarra.isConnected).toBe(true)
    expect(visor.contenedorBarra.parentNode).toBe(document.body)
  })

  it('al volver a PARCELA la barra reaparece con el `hidden` que tenía', () => {
    const visor = dobleVisor()
    const { rama } = cablear({ visor })
    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)
    expect(visor.contenedorBarra.hidden).toBe(false)
  })

  it('⛔ NO LEE `visor.edicion` NI UNA VEZ: la pregunta es por `barraEdicion`', () => {
    // Medido por T1.5: con `edicion:{barra:false}` la edición se monta y la
    // barra no, así que `edicion` no dice nada sobre la barra.
    //
    // ⚠️ Este `it` mira la LECTURA DE LA PROPIEDAD y no el desenlace, y es
    // deliberado: el desenlace no distingue: `nodoBarra` envuelve
    // `getContainer()` en un `try`, así que un módulo que preguntara por
    // `edicion` y reventara al desreferenciar `barraEdicion` **se tragaría su
    // propio TypeError y devolvería `null`** — misma pantalla, misma suite en
    // verde, y la instrucción incumplida sin rastro. Un contador de accesos sí
    // lo ve. (Se descubrió midiendo: la primera versión de esta prueba afirmaba
    // «no lanza» y seguía verde con la mutación puesta.)
    let lecturasDeEdicion = 0
    const contenedorBarra = document.createElement('div')
    document.body.appendChild(contenedorBarra)
    const visor = {
      get edicion() {
        lecturasDeEdicion += 1
        return { destruir() {} }
      },
      barraEdicion: { control: { getContainer: () => contenedorBarra } },
    }

    const { rama } = cablear({ visor })
    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)

    expect(lecturasDeEdicion).toBe(0)
    // Y la barra sí se gobernó, o sea que el `0` no es «no ha hecho nada».
    expect(contenedorBarra.hidden).toBe(false)
  })

  it('con la edición montada y la barra NO (`edicion:{barra:false}`) no lanza ni oculta nada', () => {
    const visor = dobleVisor({ conEdicion: true, conBarra: false })
    const { rama } = cablear({ visor })
    expect(visor.edicion).not.toBeNull()
    expect(visor.barraEdicion).toBeNull()
    expect(() => rama.set(RAMA.EDIFICIO)).not.toThrow()
    expect(visor.contenedorBarra.hidden).toBe(false)
  })

  it('sin visor no pasa nada: es un montaje legítimo', () => {
    const { rama } = cablear({ visor: null })
    expect(() => rama.set(RAMA.EDIFICIO)).not.toThrow()
  })

  it('un `getContainer` que revienta no tumba la conmutación', () => {
    const visor = {
      barraEdicion: {
        control: {
          getContainer() {
            throw new Error('el control no está montado todavía')
          },
        },
      },
    }
    const { rama } = cablear({ visor })
    expect(() => rama.set(RAMA.EDIFICIO)).not.toThrow()
    expect(rama.get()).toBe(RAMA.EDIFICIO)
  })
})

// ── 7 · El store: superficie, bajas y reentrada ──────────────────────────────

describe('app/rama · la misma superficie que `crearEstadoVista`', () => {
  it('devuelve exactamente `get`, `set`, `subscribe` y `destruir`', () => {
    const { rama } = cablear()
    expect(Object.keys(rama).sort()).toEqual(['destruir', 'get', 'set', 'subscribe'])
    for (const clave of ['get', 'set', 'subscribe', 'destruir']) {
      expect(typeof rama[clave]).toBe('function')
    }
  })

  it('`subscribe` devuelve la BAJA, y la baja da de baja', () => {
    const { rama } = cablear()
    const oido = vi.fn()
    const baja = rama.subscribe(oido)
    rama.set(RAMA.EDIFICIO)
    expect(oido).toHaveBeenCalledTimes(1)
    expect(oido).toHaveBeenCalledWith(RAMA.EDIFICIO)
    baja()
    rama.set(RAMA.PARCELA)
    expect(oido).toHaveBeenCalledTimes(1)
  })

  it('`subscribe` con algo que no es función LANZA (contrato heredado del store)', () => {
    const { rama } = cablear()
    expect(() => rama.subscribe('no soy una función')).toThrow(TypeError)
  })

  it('el DOM se aplica ANTES que ningún suscriptor de fuera', () => {
    const { rama } = cablear()
    let vistoEnElDom = null
    rama.subscribe(() => {
      vistoEnElDom = document.body.getAttribute(ATRIBUTO_RAMA)
    })
    rama.set(RAMA.EDIFICIO)
    // Nadie debe reaccionar a una rama que la pantalla todavía no enseña.
    expect(vistoEnElDom).toBe(RAMA.EDIFICIO)
  })

  it('un suscriptor que conmuta DENTRO de la notificación deja `get()` y la pantalla de acuerdo', () => {
    // La guarda anti-reentrada de `crearEstadoVista` actualiza el estado y NO
    // relanza la cascada; sin la reconciliación de `set`, `get()` diría EDIFICIO
    // y el `<body>` seguiría en PARCELA (o al revés).
    const { rama } = cablear()
    let yaVolvio = false
    rama.subscribe((r) => {
      if (r === RAMA.EDIFICIO && !yaVolvio) {
        yaVolvio = true
        rama.set(RAMA.PARCELA)
      }
    })
    rama.set(RAMA.EDIFICIO)
    expect(rama.get()).toBe(RAMA.PARCELA)
    expect(document.body.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.PARCELA)
    expect(seccionCatastro().hidden).toBe(false)
  })

  it('un suscriptor que revienta se cuenta por el panel y no propaga desde el clic', () => {
    const { rama, panel } = cablear()
    vi.spyOn(console, 'error').mockImplementation(() => {})
    rama.subscribe(() => {
      throw new Error('suscriptor roto')
    })
    expect(() => boton(RAMA.EDIFICIO).click()).not.toThrow()
    expect(panel.avisar).toHaveBeenCalledWith(
      MENSAJE_CONMUTAR_ROTO,
      expect.objectContaining({ nivel: NIVEL.ERROR }),
    )
    // Y la pantalla sí se conmutó: el primer suscriptor es el DOM.
    expect(document.body.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.EDIFICIO)
  })
})

// ── 8 · Degradación honrada ──────────────────────────────────────────────────

describe('app/rama · lo que no puede hacer, lo DICE (regla de oro 1)', () => {
  it('conmutar a EDIFICIO sin panel de edificio avisa, y conmuta igual', () => {
    montarCascara({ conPanelEdificio: false })
    const { rama, panel } = cablear()
    rama.set(RAMA.EDIFICIO)
    expect(panel.avisar).toHaveBeenCalledWith(
      MENSAJE_SIN_PANEL_EDIFICIO,
      expect.objectContaining({ nivel: NIVEL.ERROR }),
    )
    // Quedarse a medias sería peor que conmutar: el usuario ve el aviso y sabe
    // volver.
    expect(rama.get()).toBe(RAMA.EDIFICIO)
    expect(document.body.getAttribute(ATRIBUTO_RAMA)).toBe(RAMA.EDIFICIO)
  })

  it('con panel de edificio montado NO avisa de nada', () => {
    const { rama, panel } = cablear()
    rama.set(RAMA.EDIFICIO)
    expect(panel.avisar).not.toHaveBeenCalled()
  })

  it('una sección con un `data-rama-panel` desconocido no se toca, y se denuncia UNA vez', () => {
    const intrusa = document.createElement('section')
    intrusa.setAttribute(ATRIBUTO_PANEL, 'SOLAR')
    document.querySelector('.gml-panel').appendChild(intrusa)

    const { rama, panel } = cablear()
    rama.set(RAMA.EDIFICIO)
    rama.set(RAMA.PARCELA)
    rama.set(RAMA.EDIFICIO)

    // Ocultar un nodo cuyo atributo está mal escrito sería peor que dejarlo.
    expect(intrusa.hidden).toBe(false)
    const denuncias = panel.avisar.mock.calls.filter(
      ([mensaje]) => mensaje === mensajePanelDesconocido('SOLAR'),
    )
    expect(denuncias).toHaveLength(1)
  })

  it('sin panel de avisos no se queda mudo: cae al `console.warn` del visor', () => {
    montarCascara({ conPanelEdificio: false })
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    cableado = cablearRama({ documento: document })
    cableado.set(RAMA.EDIFICIO)
    expect(warn).toHaveBeenCalled()
  })
})

// ── 9 · Contrato del programador ─────────────────────────────────────────────

describe('app/rama · el contrato roto por el PROGRAMADOR lanza al montar', () => {
  it('sin documento → TypeError', () => {
    expect(() => cablearRama()).toThrow(TypeError)
    expect(() => cablearRama({ documento: {} })).toThrow(TypeError)
  })

  it('un `panel` que no sabe avisar → TypeError', () => {
    expect(() => cablearRama({ documento: document, panel: {} })).toThrow(TypeError)
  })

  it('sin `.gml-chips` → Error que NOMBRA el selector', () => {
    document.querySelector(SELECTOR.CHIPS).remove()
    expect(() => cablearRama({ documento: document })).toThrow(/gml-chips/)
  })

  it('sin `.gml-app` → Error que NOMBRA el selector', () => {
    document.body.className = ''
    expect(() => cablearRama({ documento: document })).toThrow(/gml-app/)
  })

  it('sin uno de los dos CTA del pie → Error que NOMBRA el selector', () => {
    document.querySelector(SELECTOR.CTA_GENERAR).remove()
    expect(() => cablearRama({ documento: document })).toThrow(/generar-gml/)
  })

  it('sin una de las secciones de la rama parcela → Error que NOMBRA el selector', () => {
    document.querySelector('.gml-bloque--vertices').remove()
    expect(() => cablearRama({ documento: document })).toThrow(/gml-bloque--vertices/)
  })

  it('`ramaInicial` desconocida → RangeError', () => {
    expect(() => cablearRama({ documento: document, ramaInicial: 'SOLAR' })).toThrow(RangeError)
  })
})

// ── 10 · `destruir` ──────────────────────────────────────────────────────────

describe('app/rama · `destruir` devuelve el documento a como estaba', () => {
  it('retira el conmutador, el `data-rama` y las marcas que puso', () => {
    const { rama } = cablear()
    const catastro = seccionCatastro()
    rama.set(RAMA.EDIFICIO)

    rama.destruir()
    cableado = null

    expect(conmutador()).toBeNull()
    expect(document.body.hasAttribute(ATRIBUTO_RAMA)).toBe(false)
    // Las marcas de la rama parcela las puso este módulo; las de edificio son de
    // quien fabricó aquellas secciones y no se tocan.
    expect(catastro.hasAttribute(ATRIBUTO_PANEL)).toBe(false)
    expect(document.querySelector('.gml-bloque--edificio').getAttribute(ATRIBUTO_PANEL)).toBe(
      RAMA.EDIFICIO,
    )
  })

  it('deja la pantalla en la rama PARCELA, que es la que `index.html` declara', () => {
    const { rama } = cablear()
    rama.set(RAMA.EDIFICIO)
    rama.destruir()
    cableado = null
    expect(seccionCatastro().hidden).toBe(false)
    expect(seccionVertices().hidden).toBe(false)
    expect(document.querySelector('.gml-bloque--edificio').hidden).toBe(true)
  })

  it('restaura los dos CTA y la barra de edición', () => {
    const visor = dobleVisor()
    const { rama } = cablear({ visor })
    document.querySelector(SELECTOR.CTA_GENERAR).disabled = false
    rama.set(RAMA.EDIFICIO)

    rama.destruir()
    cableado = null

    expect(document.querySelector(SELECTOR.CTA_GENERAR).disabled).toBe(false)
    expect(document.querySelector(SELECTOR.ESTADO_GENERAR).textContent).toBe('')
    expect(visor.contenedorBarra.hidden).toBe(false)
  })

  it('DA DE BAJA todos los oyentes que dio de alta, uno a uno', () => {
    // ⚠️ Este `it` cuenta altas y bajas en vez de mirar el comportamiento, y no
    // es purismo: se descubrió midiendo. La primera versión pulsaba los botones
    // después de `destruir()` y **seguía verde con los oyentes vivos**, porque
    // todos ellos empiezan por `if (destruido) return` — o sea que probaba la
    // bandera y no la retirada. La fuga real es otra: los dos CTA del pie
    // SOBREVIVEN a este módulo (están en `index.html`), así que un oyente suyo
    // que se quede puesto vive para siempre sobre una pantalla que ya no es la
    // suya, y eso no tiene síntoma visible.
    const { altas, bajas } = espiarOyentes(() => {
      cableado = cablearRama({ documento: document, panel: doblePanel() })
    })
    expect(altas.length, 'el módulo no ha dado de alta ningún oyente').toBeGreaterThan(0)

    const { bajas: bajasAlDestruir } = espiarOyentes(() => cableado.destruir())
    cableado = null
    const todasLasBajas = [...bajas, ...bajasAlDestruir]

    for (const alta of altas) {
      const casada = todasLasBajas.some(
        (baja) =>
          baja.diana === alta.diana &&
          baja.tipo === alta.tipo &&
          baja.oyente === alta.oyente &&
          Boolean(baja.opciones) === Boolean(alta.opciones),
      )
      expect(
        casada,
        `oyente «${alta.tipo}» sin dar de baja sobre <${alta.diana.tagName?.toLowerCase()}>`,
      ).toBe(true)
    }
  })

  it('después de `destruir` los botones ya no conmutan nada', () => {
    const { rama } = cablear()
    const botonEdificio = boton(RAMA.EDIFICIO)
    rama.destruir()
    cableado = null
    botonEdificio.click()
    expect(document.body.hasAttribute(ATRIBUTO_RAMA)).toBe(false)
  })

  it('después de `destruir` la guarda de captura de los CTA es inerte', () => {
    const { rama } = cablear()
    const oido = vi.fn()
    const cta = document.querySelector(SELECTOR.CTA_GENERAR)
    rama.set(RAMA.EDIFICIO)
    rama.destruir()
    cableado = null
    cta.disabled = false
    cta.addEventListener('click', oido)
    cta.click()
    expect(oido).toHaveBeenCalledTimes(1)
  })

  it('es IDEMPOTENTE y `set` después no hace nada', () => {
    const { rama } = cablear()
    rama.destruir()
    expect(() => rama.destruir()).not.toThrow()
    rama.destruir()
    cableado = null
    expect(() => rama.set(RAMA.EDIFICIO)).not.toThrow()
    expect(document.body.hasAttribute(ATRIBUTO_RAMA)).toBe(false)
  })

  it('devuelve el `hidden` original de las secciones que marcó', () => {
    // La lista de candidatos nace `hidden` en la cáscara; si alguna sección de
    // la rama parcela naciera igual, `destruir` tiene que devolvérselo en vez de
    // dejarla visible.
    seccionVertices().hidden = true
    const { rama } = cablear()
    rama.set(RAMA.EDIFICIO)
    rama.destruir()
    cableado = null
    expect(seccionVertices().hidden).toBe(true)
  })
})

/* -------------------------------------------------------------------------- *
 * RESULTADO DE LAS MUTACIONES — MEDIDO, sobre 57 pruebas                       *
 * (aplicada · `npm run test:dom -- rama` · revertida con el editor)            *
 *                                                                              *
 *   M1 · `replaceChildren` en vez de `hidden` ............... 5 rojos          *
 *        (los tres de M10, el de la caja de vértices y el de colisiones)       *
 *   M2 · sacar `.gml-bloque--vertices` de `SECCIONES_PARCELA`  3 rojos          *
 *   M3 · pintar desde `aria-pressed`, sin `data-rama` ....... 8 rojos          *
 *   M4 · no restaurar el estado previo de los CTA ........... 2 rojos          *
 *   M5 · preguntar por `visor.edicion` ...................... 1 rojo           *
 *        ⛔ 0 rojos con la PRIMERA versión de la prueba: ver la cabecera.       *
 *   M6 · `barra.remove()` en vez de `barra.hidden = true` ... 1 rojo           *
 *   M7 · `destruir()` sin dar de baja los oyentes ........... 1 rojo           *
 *        ⛔ 0 rojos con la PRIMERA versión de la prueba: ver la cabecera.       *
 *   M8 · `set` sin reconciliar la guarda anti-reentrada ..... 1 rojo           *
 * -------------------------------------------------------------------------- */

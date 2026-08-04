/* -------------------------------------------------------------------------- *
 * test/app/edificio.dom.test.js — F11 · T3.2 · el cable de la SEGUNDA rama     *
 *                                                                              *
 * `app/cableado-edificio.js` es lo que convierte las cinco piezas de la fase 2  *
 * en producto, y casi todo lo que puede salir mal en él es invisible desde      *
 * dentro de cualquiera de esas cinco:                                          *
 *                                                                              *
 *   · ⛔⛔ **la costura que ningún contrato asignó**: `app/rama.js` DESCUBRE las *
 *     secciones de edificio por `data-rama-panel` y `app/panel-edificio.js` NO  *
 *     lo escribe. Sin sellado, la rama edificio **no se muestra nunca**. Es la  *
 *     primera prueba de este fichero, y se mide por COMPORTAMIENTO —conmutar y  *
 *     mirar qué se ve— y no solo por el atributo;                              *
 *   · un encuadre hecho con `visor.encuadrar()`, que corre sobre el store de    *
 *     PARCELA: el edificio se carga y el mapa se queda mirando otra cosa, a     *
 *     cientos de kilómetros y sin dar ningún error (README.md:58-63);          *
 *   · `zona` con el `srs` en vez del HUSO: las huellas se pintan a cientos de   *
 *     kilómetros, en silencio;                                                 *
 *   · un `datos.srs === null` —que es un resultado BUENO: la colección vacía—   *
 *     tomado por un fallo, o al revés, un SRS ajeno cargado como si fuera el    *
 *     nuestro;                                                                 *
 *   · el 404 del `wfsBU`, que llega acompañado de un aviso del transporte que   *
 *     habla de «esa dirección no existe» cuando el usuario escribió una         *
 *     referencia catastral;                                                     *
 *   · y ⛔ el diálogo de capas, que ofrece N y `entradaDesdeTexto` acepta UNA.    *
 *                                                                              *
 * ── DECISIÓN 1 · LA CÁSCARA SE LEE DE `index.html`, NO SE COPIA ──             *
 * Misma decisión (y por lo mismo) que en `catastro.dom.test.js` y               *
 * `rama.dom.test.js`: el marcado es CONTRATO y una copia a mano aquí podría     *
 * quedarse verde con un `index.html` ya roto. ⚠️ **`innerHTML` NO trae la clase  *
 * `gml-app` del `<body>`** (medido por T2.4), así que se pone a mano: sin ella  *
 * `cablearRama` no encontraría dónde escribir `data-rama`.                     *
 *                                                                              *
 * ── DECISIÓN 2 · EL PANEL DE EDIFICIO ES EL DE VERDAD, EL MAPA NO ──           *
 * `app/panel-edificio.js` entra REAL: es la mitad de la costura que se está     *
 * probando, y un doble no tendría ni el `<dialog>` de capas ni las casillas.    *
 * El mapa, en cambio, es un doble con `setView`/`fitBounds` contados, porque lo *
 * que hay que medir del encuadre es **cuántas veces se toca la vista**, y con   *
 * un `L.Map` de verdad eso no se ve. `encuadrarSobreRecintos` entra REAL: es    *
 * justo la función cuyo uso correcto se vigila.                                *
 *                                                                              *
 * ── MUTACIONES EJECUTADAS PARA COMPROBAR QUE LOS GUARDIANES NO SON VACUOS ──   *
 * Cada una se aplicó a `app/cableado-edificio.js`, se corrió `npm run test:dom` *
 * y se revirtió con el editor (nunca con `git checkout`). La lección de T2.4    *
 * —dos de sus ocho guardianes salieron VERDES con la mutación puesta— manda, y  *
 * **volvió a morder aquí, en M7**:                                              *
 *                                                                              *
 *   M1  · no sellar `data-rama-panel` .................... 🔴 2 pruebas          *
 *   M2  · `zona: srs` en vez de `zona: huso` ............. 🔴 5 pruebas          *
 *   M3  · encuadrar aunque `encuadrarSobreRecintos`                              *
 *          hubiera devuelto `false` ..................... 🔴 1 prueba           *
 *   M3' · encuadrar en CADA repintado ................... 🔴 1 prueba           *
 *   M4  · quedarse con `elegidas[0]` con varias capas ... 🔴 4 pruebas          *
 *   M5  · publicar el aviso del transporte en vez de                             *
 *          `resultado.mensaje` .......................... 🔴 1 prueba           *
 *   M6  · rechazar el resultado con `datos.srs === null`  🔴 1 prueba           *
 *   M7  · `destruir()` sin dar de baja los TRES oyentes . ⛔ **VERDE** → ver abajo *
 *   M8  · no renumerar las partes al fundir capas ....... 🔴 1 prueba           *
 *   M9  · mandar el `refcat` en CADA repintado .......... 🔴 1 prueba           *
 *   M10 · no fijar el `hidden` inicial de las secciones . 🔴 1 prueba           *
 *   M11 · cerrar la elección de capas sin decir nada .... 🔴 1 prueba           *
 *                                                                              *
 * ⛔ **M7 salió VERDE a la primera**, o sea que ese guardián era VACUO. La        *
 * prueba original decía «tras `destruir()`, un `set` en el store ya no repinta   *
 * el panel» — y eso pasa igual con las bajas quitadas, porque `repintar` y       *
 * `atender` empiezan por `if (destruido) return`: medía LA BANDERA, no la        *
 * retirada. Se sustituyó por un **parte de altas y bajas**: el arnés interviene  *
 * `estado.subscribe`, `panelEdificio.alAccion` y `panelEdificio.alCerrar`, y      *
 * cuenta cuántas veces se llama a cada función de baja. Con esa versión, M7 sale  *
 * 🔴. Es literalmente el caso (b) de la lección de T2.4, con                      *
 * `subscribe`/`alAccion`/`alCerrar` en lugar de `addEventListener`.               *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  ANCLA_ORIGEN,
  ANCLA_PARTES,
  EXTENSIONES,
  MENSAJE_ELIGE_CAPAS,
  MENSAJE_FICHERO_NO_LEIDO,
  MENSAJE_SIN_AUTOGUARDADO,
  MENSAJE_SIN_AUTOGUARDADO_BREVE,
  MENSAJE_SIN_CLIENTE,
  MENSAJE_SIN_REFERENCIA,
  SUJETO_ENCUADRE,
  cablearEdificio,
  entradaPorCapas,
  mensajeCapasCanceladas,
  mensajeVariosCandidatos,
} from '../../app/cableado-edificio.js'
import { SELECTOR as SELECTOR_PANEL, crearPanelEdificio } from '../../app/panel-edificio.js'
import {
  ATRIBUTO_PANEL,
  RAMA,
  SECCIONES_PARCELA,
  cablearRama,
  selectorPanel,
} from '../../app/rama.js'
import { entradaDesdeTexto } from '../../edificio/entrada.js'
import { MODELO_EDIFICIO, crearEdificio } from '../../model/edificio.js'
import { parsearGmlBu } from '../../gml/parse-bu.js'
import { MOTIVO_CATASTRO, ORIGEN } from '../../services/catastro.js'
import { NIVEL, crearEstadoVista } from '../../viewer/_comun.js'
import { encuadrarSobreRecintos } from '../../viewer/index.js'

const RAIZ = join(import.meta.dirname, '..', '..')

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

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
      'test/app/edificio.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara de ' +
        'estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  const clase = /class\s*=\s*"([^"]*)"/i.exec(encontrado[1])
  return { clase: clase === null ? '' : clase[1], cuerpo: encontrado[2] }
})()

// ── Fixtures ─────────────────────────────────────────────────────────────────

const bytesDe = (rel) => readFileSync(join(RAIZ, ...rel.split('/')))

/** Un texto del repo, decodificado con el encoding que él declara (los BU mienten). */
function textoDe(rel) {
  const bytes = bytesDe(rel)
  const prologo = new TextDecoder('ascii').decode(bytes.subarray(0, 200))
  const m = /encoding="([^"]+)"/i.exec(prologo)
  return new TextDecoder(m ? m[1] : 'utf-8').decode(bytes)
}

const RUTA_DXF = 'test/fixtures/parsers/edificio_consulta_masiva_3515508VF0831N.dxf'
const RUTA_UTM = 'test/fixtures/parsers/UTM.dxf'
const RUTA_LIST = 'test/fixtures/parsers/LIST.txt'
const RUTA_TXT = 'test/fixtures/parsers/PARCELA.txt'
const RUTA_GML_PARTES = 'test/fixtures/gml/bu_buildingpart_9398516VK3799G.gml'
const RUTA_GML_VACIO = 'test/fixtures/catastro/wfsbu-coleccion-vacia-13005A10900001.xml'

const DXF_EDIFICIO = readFileSync(join(RAIZ, ...RUTA_DXF.split('/')), 'latin1')
const DXF_UTM = readFileSync(join(RAIZ, ...RUTA_UTM.split('/')), 'latin1')

const SRS = 'EPSG:25830'
const HUSO = 30

const ficheroDe = (rel, nombre) => new File([bytesDe(rel)], nombre, { type: '' })
const ficheroDeTexto = (texto, nombre) =>
  new File([new TextEncoder().encode(texto)], nombre, { type: '' })

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 40) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

// ── Dobles ───────────────────────────────────────────────────────────────────

/**
 * Un mapa de mentira con lo único que `encuadrarSobreRecintos` duck-typea, y con
 * las llamadas CONTADAS: lo que hay que medir del encuadre es «¿ha tocado la
 * vista?», y con un `L.Map` de verdad eso no se ve.
 */
function crearMapaDoble() {
  return {
    setView: vi.fn(),
    fitBounds: vi.fn(),
    // Por si algún día la capa real entrase por aquí.
    addLayer: vi.fn(),
    removeLayer: vi.fn(),
    getPane: () => ({}),
  }
}

/** La capa de huellas, de mentira: se mide QUÉ se le manda pintar y con qué huso. */
function crearCapaDoble() {
  const llamadas = { creada: [], pintado: [], destruida: 0 }
  const crearCapa = (args) => {
    llamadas.creada.push(args)
    return {
      pintar: (partes) => llamadas.pintado.push(partes),
      limpiar: () => {},
      destruir: () => {
        llamadas.destruida += 1
      },
    }
  }
  return { crearCapa, llamadas }
}

/** El resultado del cliente de edificio, con la forma exacta del contrato F. */
function resultadoOk(datos, { origen = ORIGEN.RED, edadMs = null } = {}) {
  return {
    ok: true,
    datos,
    motivo: null,
    mensaje: null,
    procedencia: { origen, edadMs, intentos: 1, ms: 12, url: 'u2', urls: ['u1', 'u2'], consultas: 2 },
  }
}

function resultadoFallo(motivo, mensaje) {
  return {
    ok: false,
    datos: null,
    motivo,
    mensaje,
    procedencia: { origen: ORIGEN.RED, edadMs: null, intentos: 1, ms: 9, url: 'u1', urls: ['u1'], consultas: 1 },
  }
}

// ── Arnés ────────────────────────────────────────────────────────────────────

let montados

/**
 * Monta la cáscara real, el panel de edificio DE VERDAD y el cableado.
 *
 * @param {object} [opciones]
 * @param {object|null} [opciones.cliente]        Cliente de edificio (doble).
 * @param {object|null} [opciones.clienteParcela] Cliente de parcela (doble).
 * @param {boolean} [opciones.conMapa=true]
 * @param {boolean} [opciones.conRama=false]      Cablea también `app/rama.js`.
 * @param {object|null} [opciones.parcela]        Qué hay en el store de parcela.
 */
function montar({
  cliente = null,
  clienteParcela = null,
  conMapa = true,
  conRama = false,
  parcela = null,
  encuadrar,
} = {}) {
  document.body.className = INDEX.clase
  document.body.innerHTML = INDEX.cuerpo

  const avisos = []
  const panel = { avisar: (mensaje, opciones) => avisos.push({ mensaje, ...opciones }) }
  const estado = crearEstadoVista(null)
  const estadoParcela = crearEstadoVista(parcela)
  const panelEdificio = crearPanelEdificio({
    documento: document,
    alAvisar: (mensaje, opciones) => avisos.push({ mensaje, ...opciones }),
  })
  const mapa = conMapa ? crearMapaDoble() : null
  const { crearCapa, llamadas } = crearCapaDoble()

  // ── ⛔ El PARTE DE ALTAS Y BAJAS ────────────────────────────────────────────
  // La lección de T2.4, que aquí volvió a morder: `destruir()` **sin dar de baja
  // los oyentes se comporta igual**, porque todos los manejadores de este módulo
  // empiezan por `if (destruido) return`. Medir el comportamiento después de
  // destruir mide LA BANDERA, no la retirada — y salió VERDE con la mutación
  // puesta. Se interviene `subscribe`/`alAccion` para contar las bajas, que es lo
  // que la instrucción dice de verdad.
  const bajas = { store: 0, panel: 0, cierre: 0 }
  const contar = (objeto, metodo, clave) => {
    const original = objeto[metodo].bind(objeto)
    objeto[metodo] = (fn) => {
      const baja = original(fn)
      return () => {
        bajas[clave] += 1
        baja()
      }
    }
  }
  contar(estado, 'subscribe', 'store')
  contar(panelEdificio, 'alAccion', 'panel')
  contar(panelEdificio, 'alCerrar', 'cierre')

  // ⚠️ La rama se cablea ANTES a propósito en las pruebas que la piden: es el
  // orden que destapa la costura (`aplicar(inicial)` corre con el panel de
  // edificio todavía sin montar).
  const rama = conRama ? cablearRama({ documento: document, panel }) : null

  const cableado = cablearEdificio({
    estado,
    panel,
    panelEdificio,
    srs: SRS,
    cliente,
    clienteParcela,
    mapa,
    estadoParcela,
    rama,
    documento: document,
    crearCapa,
    ...(encuadrar === undefined ? {} : { encuadrar }),
  })

  const contexto = {
    avisos,
    panel,
    estado,
    estadoParcela,
    panelEdificio,
    mapa,
    capa: llamadas,
    rama,
    cableado,
    bajas,
  }
  montados.push(contexto)
  return contexto
}

beforeEach(() => {
  montados = []
})

afterEach(() => {
  for (const { cableado, rama, panelEdificio } of montados) {
    cableado.destruir()
    rama?.destruir()
    panelEdificio.destruir()
  }
  montados = []
  document.body.replaceChildren()
  document.body.className = ''
  vi.restoreAllMocks()
})

/** Lo que se lee en el renglón `role="status"` del panel de edificio. */
const renglon = () => document.querySelector(SELECTOR_PANEL.ESTADO).textContent
/** Lo que se lee en el renglón de procedencia. */
const procedencia = () => document.querySelector(SELECTOR_PANEL.PROCEDENCIA).textContent
/** Las filas de la lista de partes (sin el renglón de «todavía no hay nada»). */
const filasParte = () => [...document.querySelectorAll('[data-parte-indice]')]
/** Las casillas del diálogo de reparto por capas. */
const casillasCapa = () => [...document.querySelectorAll('[data-campo="capa-elegida"]')]

/** Suelta un fichero por la vía de la zona de arrastre y espera al recorrido. */
async function soltar(cableado, fichero) {
  await cableado.alFichero(fichero)
  await cederTurno()
}

// ══ 1 · LA COSTURA ROTA ══════════════════════════════════════════════════════

describe('⛔⛔ el sellado de data-rama-panel — la costura que ningún contrato asignó', () => {
  it('sella las DOS secciones del panel con la rama EDIFICIO', () => {
    const { panelEdificio } = montar()
    for (const seccion of [panelEdificio.seccionOrigen, panelEdificio.seccionPartes]) {
      expect(seccion.getAttribute(ATRIBUTO_PANEL)).toBe(RAMA.EDIFICIO)
    }
    // Y las dos están DENTRO del documento: sellar una sección suelta no sirve.
    expect(document.querySelectorAll(selectorPanel(RAMA.EDIFICIO))).toHaveLength(2)
  })

  it('NO sella los <dialog>: un <dialog open hidden> es un diálogo que no se ve', () => {
    const { panelEdificio } = montar()
    panelEdificio.abrirCapas()
    expect(panelEdificio.dialogoCapas.hasAttribute(ATRIBUTO_PANEL)).toBe(false)
    // Todo lo marcado es una <section>, nunca un <dialog>.
    for (const marcado of document.querySelectorAll(`[${ATRIBUTO_PANEL}]`)) {
      expect(marcado.tagName).toBe('SECTION')
    }
  })

  it('DE PUNTA A PUNTA con app/rama.js: conmutar a EDIFICIO enseña el panel, y volver lo esconde', () => {
    const { rama, panelEdificio } = montar({ conRama: true })
    const dePar = SECCIONES_PARCELA.map((s) => document.querySelector(s))
    const deEdi = [panelEdificio.seccionOrigen, panelEdificio.seccionPartes]

    rama.set(RAMA.EDIFICIO)
    expect(deEdi.map((s) => s.hidden)).toEqual([false, false])
    expect(dePar.map((s) => s.hidden)).toEqual([true, true])

    rama.set(RAMA.PARCELA)
    expect(deEdi.map((s) => s.hidden)).toEqual([true, true])
    expect(dePar.map((s) => s.hidden)).toEqual([false, false])
  })

  it('sin el sellado la rama edificio no se mostraría: rama.js lo denuncia con MENSAJE_SIN_PANEL_EDIFICIO', () => {
    // El contrafactual, montado a mano: la rama sola, sin este cableado. Es lo
    // que había antes de T3.2, y sirve de oráculo independiente del guardián.
    document.body.className = INDEX.clase
    document.body.innerHTML = INDEX.cuerpo
    const avisos = []
    const rama = cablearRama({
      documento: document,
      panel: { avisar: (mensaje, opciones) => avisos.push({ mensaje, ...opciones }) },
    })
    rama.set(RAMA.EDIFICIO)
    expect(avisos.some((a) => a.nivel === NIVEL.ERROR)).toBe(true)
    rama.destruir()
  })

  it('montado DESPUÉS de cablearRama, las secciones nacen OCULTAS: no se apilan sobre el panel de parcela', () => {
    // `app/rama.js` solo reparte visibilidad AL CONMUTAR, así que un panel montado
    // después se quedaría visible encima del de parcela hasta la primera pulsación.
    const { panelEdificio, rama } = montar({ conRama: true })
    expect(rama.get()).toBe(RAMA.PARCELA)
    expect(panelEdificio.seccionOrigen.hidden).toBe(true)
    expect(panelEdificio.seccionPartes.hidden).toBe(true)
  })

  it('sin conmutador y sin data-rama no se toca el hidden: es un montaje legítimo', () => {
    const { panelEdificio } = montar()
    expect(panelEdificio.seccionOrigen.hidden).toBe(false)
  })

  it('destruir() retira la marca que puso ESTE módulo y deja las secciones ocultas', () => {
    const { cableado, panelEdificio } = montar()
    cableado.destruir()
    for (const seccion of [panelEdificio.seccionOrigen, panelEdificio.seccionPartes]) {
      expect(seccion.hasAttribute(ATRIBUTO_PANEL)).toBe(false)
      expect(seccion.hidden).toBe(true)
    }
  })

  it('el panel se monta detrás de sus anclas, y el estirador va donde va la caja de vértices', () => {
    const { panelEdificio } = montar()
    expect(document.querySelector(ANCLA_ORIGEN).nextElementSibling).toBe(
      panelEdificio.seccionOrigen,
    )
    expect(document.querySelector(ANCLA_PARTES).nextElementSibling).toBe(
      panelEdificio.seccionPartes,
    )
  })
})

// ══ 2 · LAS CINCO VÍAS DE ENTRADA ════════════════════════════════════════════

describe('las cinco vías de entrada', () => {
  it('1 · DXF de varias capas: NO carga nada todavía y OFRECE el reparto medido', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_DXF, 'edificio.dxf'))

    // Nada en el store: la decisión 5 es OFRECER, no imponer.
    expect(estado.get()).toBeNull()
    expect(casillasCapa().map((c) => c.value)).toEqual(['Construccion', 'Parcela'])
    expect(document.querySelector('[data-lista="capas"]').textContent).toContain('7 polilíneas')
    expect(document.querySelector('[data-lista="capas"]').textContent).toContain('1 polilínea')
    expect(renglon()).toBe(MENSAJE_ELIGE_CAPAS)
    // Y ninguna viene marcada: elegir por el nombre falla en `UTM.dxf`.
    expect(casillasCapa().every((c) => !c.checked)).toBe(true)
  })

  it('1 bis · marcar «Construccion» y pulsar carga las SIETE partes, y no la de la capa «Parcela»', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_DXF, 'edificio.dxf'))

    casillasCapa()[0].checked = true
    casillasCapa()[0].dispatchEvent(new Event('change', { bubbles: true }))
    document.querySelector(SELECTOR_PANEL.APLICAR_CAPAS).click()
    await cederTurno()

    const edificio = estado.get()
    expect(edificio.partes).toHaveLength(7)
    expect(filasParte()).toHaveLength(7)
    // El oráculo: la vía de una sola capa es DELEGACIÓN PURA en `entradaDesdeTexto`.
    expect(edificio.partes).toEqual(
      entradaDesdeTexto(DXF_EDIFICIO, {
        capa: 'Construccion',
        modelo: MODELO_EDIFICIO.SIMPLIFICADO,
      }).edificio.partes,
    )
    expect(renglon()).toContain('7 partes')
  })

  it('2 · un pegado LIST entra como UNA parte, sin preguntar por capas', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    expect(estado.get().partes).toHaveLength(1)
    expect(estado.get().partes[0].recinto.vertices).toHaveLength(11)
    expect(casillasCapa()).toHaveLength(0)
  })

  it('3 · un listado de coordenadas .txt entra sin preguntar por capas', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_TXT, 'PARCELA.txt'))
    expect(estado.get().partes).toHaveLength(1)
    expect(estado.get().partes[0].origen).toBe('TXT')
  })

  it('4 · un GML de edificio entra por CONTENIDO, no por extensión (13 partes)', async () => {
    const { cableado, estado } = montar()
    // Deliberadamente con extensión `.txt`: `alFichero` enruta por lo que hay
    // dentro, que es lo que hace que la vía del GML exista aunque `.gml` tenga
    // otro dueño.
    await soltar(cableado, ficheroDe(RUTA_GML_PARTES, 'partes.txt'))
    expect(estado.get().partes).toHaveLength(13)
    expect(estado.get().partes[0].origen).toBe('GML_EXISTENTE')
    expect(procedencia()).toContain('GML de edificio')
  })

  it('4 bis · un GML que NO es de edificio no revienta y se dice con palabras', async () => {
    const { cableado, estado, avisos } = montar()
    await soltar(cableado, ficheroDe('test/fixtures/gml/cp_parcela_9398516VK3799G.gml', 'p.gml'))
    expect(estado.get()).toBeNull()
    expect(renglon()).toContain('no es de edificio')
    expect(avisos.some((a) => a.nivel === NIVEL.ERROR || a.nivel === NIVEL.AVISO)).toBe(true)
  })

  it('5 · el Catastro por referencia catastral mete las partes y escribe la procedencia', async () => {
    const datos = { ...parsearGmlBu(textoDe(RUTA_GML_PARTES)), refcat: '9398516VK3799G' }
    const cliente = { edificioPorRefcat: vi.fn(async () => resultadoOk(datos)) }
    const { cableado, estado } = montar({ cliente })

    document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516 vk3799g'
    const r = await cableado.cargar()

    expect(r.ok).toBe(true)
    expect(cliente.edificioPorRefcat).toHaveBeenCalledTimes(1)
    expect(cliente.edificioPorRefcat.mock.calls[0][1].srs).toBe(SRS)
    expect(estado.get().partes).toHaveLength(13)
    // La forma CANÓNICA en el campo: dejar en pantalla otra distinta de la del
    // modelo invita a dudar de cuál se ha cargado.
    expect(document.querySelector(SELECTOR_PANEL.REFCAT).value).toBe('9398516VK3799G')
    expect(procedencia()).toContain('Del Catastro')
  })

  it('el fichero ilegible se dice y no cambia nada', async () => {
    const { cableado, estado, avisos } = montar()
    const roto = ficheroDeTexto('lo que sea', 'x.dxf')
    roto.arrayBuffer = () => Promise.reject(new Error('la unidad se ha desconectado'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    await soltar(cableado, roto)
    expect(estado.get()).toBeNull()
    expect(avisos.map((a) => a.mensaje)).toContain(MENSAJE_FICHERO_NO_LEIDO)
  })
})

// ══ 3 · EL DIÁLOGO DE CAPAS, DE PUNTA A PUNTA ════════════════════════════════

describe('⛔ el diálogo de capas ofrece N y entradaDesdeTexto acepta UNA', () => {
  it('con VARIAS capas marcadas entran TODAS las partes de todas ellas', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_DXF, 'edificio.dxf'))

    for (const casilla of casillasCapa()) {
      casilla.checked = true
      casilla.dispatchEvent(new Event('change', { bubbles: true }))
    }
    document.querySelector(SELECTOR_PANEL.APLICAR_CAPAS).click()
    await cederTurno()

    // 7 + 1: quedarse con la primera marcada cargaría 7 y no lo diría.
    expect(estado.get().partes).toHaveLength(8)
    expect(filasParte()).toHaveLength(8)
  })

  it('al fundir varias capas las partes se RENUMERAN: dos capas no pueden dar dos «Parte 1»', () => {
    const fundida = entradaPorCapas(DXF_EDIFICIO, ['Construccion', 'Parcela'])
    const nombres = fundida.edificio.partes.map((p) => p.nombre)
    expect(nombres).toEqual(['Parte 1', 'Parte 2', 'Parte 3', 'Parte 4', 'Parte 5', 'Parte 6', 'Parte 7', 'Parte 8'])
    expect(new Set(nombres).size).toBe(nombres.length)
  })

  it('con UNA capa, entradaPorCapas es DELEGACIÓN PURA: idéntico a entradaDesdeTexto({capa})', () => {
    // El guardián que ata los dos mecanismos: si alguien reimplementa el filtrado,
    // esto se cae.
    const porCapas = entradaPorCapas(DXF_EDIFICIO, ['Construccion'])
    const delegado = entradaDesdeTexto(DXF_EDIFICIO, { capa: 'Construccion' })
    expect(porCapas.edificio).toEqual(delegado.edificio)
    expect(porCapas.detecciones).toEqual(delegado.detecciones)
    expect(porCapas.bloqueos).toEqual(delegado.resumen.bloqueos)
  })

  it('al fundir, NINGUNA detección anuncia como descartada una capa que sí ha entrado', () => {
    const fundida = entradaPorCapas(DXF_UTM, ['0', 'PARCELA'])
    const descartadas = fundida.detecciones
      .filter((d) => d.tipo === 'CAPA_DXF_DESCARTADA')
      .map((d) => d.datos.capa)
    expect(descartadas).not.toContain('0')
    expect(descartadas).not.toContain('PARCELA')
    // Y las tres que de verdad quedan fuera se nombran, con su literal.
    expect(descartadas.sort()).toEqual(['BLANCO', 'FINO', 'LINDE'])
  })

  it('al fundir, ninguna detección dice «se importa SOLO la capa X»', () => {
    const fundida = entradaPorCapas(DXF_EDIFICIO, ['Construccion', 'Parcela'])
    for (const d of fundida.detecciones) {
      expect(d.mensaje).not.toMatch(/importa SOLO la capa/i)
    }
  })

  it('cerrar la elección de capas sin aplicarla NO se calla, y dice cómo volver', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_DXF, 'edificio.dxf'))
    document.querySelector(SELECTOR_PANEL.CANCELAR_CAPAS).click()
    await cederTurno()

    expect(estado.get()).toBeNull()
    expect(renglon()).toBe(mensajeCapasCanceladas('edificio.dxf'))
    // Y el fichero pendiente se ha soltado: aplicar después no puede resucitarlo.
    document.querySelector(SELECTOR_PANEL.APLICAR_CAPAS).disabled = false
    document.querySelector(SELECTOR_PANEL.APLICAR_CAPAS).click()
    await cederTurno()
    expect(estado.get()).toBeNull()
  })

  it('las detecciones repetidas de las N pasadas se dicen UNA vez', () => {
    const fundida = entradaPorCapas(DXF_EDIFICIO, ['Construccion', 'Parcela'])
    const claves = fundida.detecciones.map((d) => `${d.tipo}|${d.mensaje}`)
    expect(new Set(claves).size).toBe(claves.length)
  })
})

// ══ 4 · EL ENCUADRE ══════════════════════════════════════════════════════════

describe('⛔ el encuadre: encuadrarSobreRecintos, nunca visor.encuadrar()', () => {
  it('encuadra sobre las HUELLAS al entrar un edificio nuevo', async () => {
    const { cableado, mapa } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    expect(mapa.fitBounds).toHaveBeenCalledTimes(1)
    // 11 vértices proyectados uno a uno (no las dos esquinas del bbox UTM).
    expect(mapa.fitBounds.mock.calls[0][0]).toHaveLength(11)
  })

  it('NO toca la vista cuando no hay ni un vértice — el caso del store recién nacido', () => {
    const { mapa } = montar()
    expect(mapa.setView).not.toHaveBeenCalled()
    expect(mapa.fitBounds).not.toHaveBeenCalled()
  })

  it('NO toca la vista con un edificio cuyas partes no traen contorno', async () => {
    const datos = {
      ok: true,
      srs: SRS,
      edificio: null,
      partes: [{ localId: 'a', refcat: null, anillos: [], huecos: [] }],
      otras: [],
      detecciones: [],
      nMiembros: 1,
    }
    const cliente = { edificioPorRefcat: async () => resultadoOk(datos) }
    const { cableado, mapa, estado } = montar({ cliente })
    document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516VK3799G'
    await cableado.cargar()

    expect(estado.get().partes).toHaveLength(1)
    expect(estado.get().partes[0].recinto).toBeNull()
    expect(mapa.setView).not.toHaveBeenCalled()
    expect(mapa.fitBounds).not.toHaveBeenCalled()
  })

  it('llama a encuadrarSobreRecintos con el HUSO, las huellas y el sujeto propio', async () => {
    const espia = vi.fn(() => true)
    const { cableado, estado } = montar({ encuadrar: espia })
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))

    expect(espia).toHaveBeenCalledTimes(1)
    const args = espia.mock.calls[0][0]
    expect(args.zona).toBe(HUSO)
    expect(args.sujeto).toBe(SUJETO_ENCUADRE)
    expect(args.recintos).toEqual(estado.get().partes.map((p) => p.recinto))
  })

  it('⭐ el aviso de vértices no numéricos habla de EL EDIFICIO, no de la parcela', () => {
    // Este cableado es el PRIMER llamante de la historia que puede llegar a ver
    // ese aviso: por la rama de parcela es inalcanzable desde F03
    // (`viewer/sincronizacion.js` proyecta cada vértice antes y
    // `geo/utm.js#inverse` LANZA con un NaN, así que `crearVisor` revienta antes
    // del encuadre). Aquí se ejerce la función REAL con el sujeto que este
    // módulo le pasa, que es lo que el usuario acabaría leyendo.
    const avisos = []
    const mapa = crearMapaDoble()
    const ok = encuadrarSobreRecintos({
      mapa,
      recintos: [
        { vertices: [[Number.NaN, 1], [370_000, 4_080_000], [370_050, 4_080_050], [370_050, 4_080_000]] },
      ],
      zona: HUSO,
      alAvisar: (mensaje, opciones) => avisos.push({ mensaje, ...opciones }),
      sujeto: SUJETO_ENCUADRE,
    })

    expect(ok).toBe(true)
    expect(avisos).toHaveLength(1)
    expect(avisos[0].mensaje).toMatch(/^El edificio tiene 1 vértice/)
    expect(avisos[0].mensaje).not.toMatch(/parcela/i)
  })

  it('la capa de huellas se crea con el HUSO, no con el srs', () => {
    const { capa } = montar()
    expect(capa.creada).toHaveLength(1)
    expect(capa.creada[0].zona).toBe(HUSO)
    expect(capa.creada[0].zona).not.toBe(SRS)
  })

  it('pinta las PARTES del modelo, no anillos sueltos (necesita `nombre` para el emergente)', async () => {
    const { cableado, capa, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    const ultimo = capa.pintado[capa.pintado.length - 1]
    expect(ultimo).toBe(estado.get().partes)
    expect(ultimo[0].nombre).toBe('Parte 1')
  })

  it('sin mapa no hay capa ni encuadre, y eso es un montaje legítimo', async () => {
    const { cableado, estado, capa } = montar({ conMapa: false })
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    expect(estado.get().partes).toHaveLength(1)
    expect(capa.creada).toHaveLength(0)
  })
})

// ══ 5 · EL CATASTRO Y SUS TRAMPAS ════════════════════════════════════════════

describe('⛔ el servicio de edificios y sus cuatro trampas medidas', () => {
  it('un resultado BUENO con srs: null no revienta — es la colección vacía de la obra nueva', async () => {
    const datos = { ...parsearGmlBu(textoDe(RUTA_GML_VACIO)), refcat: '13005A10900001', sinConstrucciones: true }
    expect(datos.srs).toBeNull()
    const cliente = { edificioPorRefcat: async () => resultadoOk(datos) }
    const { cableado, estado } = montar({ cliente })

    document.querySelector(SELECTOR_PANEL.REFCAT).value = '13005A10900001'
    const r = await cableado.cargar()

    expect(r.ok).toBe(true)
    expect(estado.get()).toBeNull()
    // Y se cuenta como lo que es: un punto de partida, no una avería.
    expect(renglon()).toContain('punto de partida de una obra nueva')
  })

  it('un SRS ajeno NO se carga, y se explica por qué', async () => {
    const datos = { ...parsearGmlBu(textoDe(RUTA_GML_PARTES)), srs: 'EPSG:25829' }
    const cliente = { edificioPorRefcat: async () => resultadoOk(datos) }
    const { cableado, estado, avisos } = montar({ cliente })
    document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516VK3799G'
    await cableado.cargar()

    expect(estado.get()).toBeNull()
    expect(avisos.some((a) => a.mensaje.includes('EPSG:25829') && a.mensaje.includes(SRS))).toBe(true)
  })

  it('⛔ el 404: se publica resultado.mensaje, NUNCA el aviso del transporte', async () => {
    const mensaje =
      'Consulta «GetAllConstructionByParcel» (1 de 2). El Catastro no ha localizado nada para la ' +
      'referencia pedida en su servicio de edificios.'
    const cliente = {
      edificioPorRefcat: async () => resultadoFallo(MOTIVO_CATASTRO.NO_ENCONTRADO, mensaje),
    }
    const { cableado, avisos } = montar({ cliente })
    document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516VK3799G'
    await cableado.cargar()

    expect(avisos.map((a) => a.mensaje)).toContain(mensaje)
    // El literal del transporte habla de una DIRECCIÓN WEB cuando el usuario ha
    // escrito una referencia catastral: no puede salir de aquí.
    for (const aviso of avisos) expect(aviso.mensaje).not.toMatch(/esa dirección no existe/i)
    expect(renglon()).toContain('no ha localizado esa referencia')
  })

  it('cada motivo del cliente tiene su renglón: ninguno sale en blanco', async () => {
    for (const motivo of Object.values(MOTIVO_CATASTRO)) {
      const cliente = { edificioPorRefcat: async () => resultadoFallo(motivo, `mensaje de ${motivo}`) }
      const { cableado } = montar({ cliente })
      document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516VK3799G'
      await cableado.cargar()
      expect(renglon().trim(), motivo).not.toBe('')
      expect(renglon(), motivo).toContain('panel de avisos')
    }
  })

  it('una consulta SUPERADA por otra más nueva no escribe nada', async () => {
    let sueltas = []
    const cliente = {
      edificioPorRefcat: () => new Promise((resolver) => sueltas.push(resolver)),
    }
    const datos = parsearGmlBu(textoDe(RUTA_GML_PARTES))
    const { cableado, estado } = montar({ cliente })
    document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516VK3799G'

    const primera = cableado.cargar()
    await cederTurno()
    const segunda = cableado.cargar()
    await cederTurno()
    expect(sueltas).toHaveLength(2)
    // La PRIMERA llega tarde, con 13 partes; la segunda, con una sola.
    sueltas[0](resultadoOk({ ...datos, refcat: 'A' }))
    sueltas[1](resultadoOk({ ...datos, partes: datos.partes.slice(0, 1), refcat: 'B' }))
    const [r1] = await Promise.all([primera, segunda])

    expect(r1.motivo).toBe(MOTIVO_CATASTRO.CANCELADA)
    expect(estado.get().partes).toHaveLength(1)
  })

  it('sin cliente el botón está apagado y el motivo está escrito al lado', async () => {
    const { cableado } = montar({ cliente: null })
    expect(document.querySelector(SELECTOR_PANEL.CARGAR_CATASTRO).disabled).toBe(true)
    expect(renglon()).toBe(MENSAJE_SIN_CLIENTE)
    expect(await cableado.cargar()).toBeNull()
  })

  it('sin referencia escrita y sin huella no se consulta nada, y se dice', async () => {
    const cliente = { edificioPorRefcat: vi.fn() }
    const { cableado, avisos } = montar({ cliente })
    await cableado.cargar()
    expect(cliente.edificioPorRefcat).not.toHaveBeenCalled()
    expect(avisos.map((a) => a.mensaje)).toContain(MENSAJE_SIN_REFERENCIA)
  })

  it('con huella y sin referencia, la DEDUCE del punto interior de la parte mayor', async () => {
    const datos = parsearGmlBu(textoDe(RUTA_GML_PARTES))
    const cliente = { edificioPorRefcat: vi.fn(async () => resultadoOk({ ...datos, refcat: 'X' })) }
    const clienteParcela = {
      refcatPorCoordenada: vi.fn(async () => ({
        ok: true,
        datos: { candidatos: [{ refcat: '9398516VK3799G', domicilio: 'C/ X' }], unico: true },
        motivo: null,
        mensaje: null,
        procedencia: { origen: ORIGEN.RED, edadMs: null, intentos: 1, ms: 3, url: 'u' },
      })),
    }
    const { cableado } = montar({ cliente, clienteParcela })
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    await cableado.cargar()

    expect(clienteParcela.refcatPorCoordenada).toHaveBeenCalledTimes(1)
    const [x, y] = clienteParcela.refcatPorCoordenada.mock.calls[0]
    expect(Number.isFinite(x) && Number.isFinite(y)).toBe(true)
    expect(document.querySelector(SELECTOR_PANEL.REFCAT).value).toBe('9398516VK3799G')
    expect(cliente.edificioPorRefcat).toHaveBeenCalledWith('9398516VK3799G', expect.anything())
  })

  it('con VARIOS candidatos no se rellena ninguno a ciegas', async () => {
    const lista = [
      { refcat: '9398516VK3799G', domicilio: 'A' },
      { refcat: '9398516VK3799H', domicilio: 'B' },
    ]
    const clienteParcela = {
      refcatPorCoordenada: async () => ({
        ok: true,
        datos: { candidatos: lista, unico: false },
        motivo: null,
        mensaje: null,
        procedencia: { origen: ORIGEN.RED, edadMs: null, intentos: 1, ms: 3, url: 'u' },
      }),
    }
    const cliente = { edificioPorRefcat: vi.fn() }
    const { cableado, avisos } = montar({ cliente, clienteParcela })
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    await cableado.cargar()

    expect(cliente.edificioPorRefcat).not.toHaveBeenCalled()
    expect(document.querySelector(SELECTOR_PANEL.REFCAT).value).toBe('')
    expect(avisos.map((a) => a.mensaje)).toContain(mensajeVariosCandidatos(lista))
  })

  it('el dato de la CACHÉ se dice además por el panel', async () => {
    const datos = { ...parsearGmlBu(textoDe(RUTA_GML_PARTES)), refcat: '9398516VK3799G' }
    const cliente = {
      edificioPorRefcat: async () => resultadoOk(datos, { origen: ORIGEN.CACHE, edadMs: 6 * 86_400_000 }),
    }
    const { cableado, avisos } = montar({ cliente })
    document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516VK3799G'
    await cableado.cargar()
    expect(avisos.some((a) => a.mensaje.includes('copia local'))).toBe(true)
    expect(procedencia()).toContain('copia local')
  })
})

// ══ 6 · LA DEGRADACIÓN HONRADA DEL AUTOGUARDADO ══════════════════════════════

describe('el renglón que dice que esta rama NO se autoguarda (desviación 7)', () => {
  // ⛔ CORREGIDO EL 2026-08-04, y lo midió el GUION DE HUMO 13, no esta suite.
  //
  // Aquí se exigía el mensaje ENTERO en el renglón, y el `it` de más abajo exige
  // —con razón— el mensaje ENTERO en el panel de avisos. Los dos a la vez son la
  // misma advertencia dos veces, palabra por palabra, en la misma pantalla. Y
  // costaba: el renglón medía **89,06 px** en un panel de altura fija al que le
  // faltaban 32,70 px para que la lista de partes y los avisos tuvieran una fila
  // cada uno. Esta suite estaba verde afirmando la repetición.
  //
  // El reparto ahora: **una línea permanente aquí** (no guardar es una propiedad
  // de esta versión, no un suceso) y **la tarjeta entera en avisos, una vez**,
  // cuando pasa a haber algo que perder.

  it('está desde el primer pintado, sin haber cargado nada', () => {
    montar()
    expect(procedencia()).toBe(MENSAJE_SIN_AUTOGUARDADO_BREVE)
  })

  it('sobrevive a la carga: la procedencia del dato y el aviso conviven', async () => {
    const { cableado } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    expect(procedencia()).toContain('medido por el técnico')
    expect(procedencia()).toContain(MENSAJE_SIN_AUTOGUARDADO_BREVE)
  })

  it('⛔ y NO repite la versión larga en el renglón: para eso está la tarjeta', async () => {
    const { cableado } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    // Si vuelve, vuelven los 89,06 px y el panel deja de caber.
    expect(procedencia()).not.toContain(MENSAJE_SIN_AUTOGUARDADO)
    // Y la breve dice lo mismo en una línea: qué no pasa y qué hacer.
    expect(MENSAJE_SIN_AUTOGUARDADO_BREVE).toMatch(/no se guarda sola/i)
    expect(MENSAJE_SIN_AUTOGUARDADO_BREVE.length).toBeLessThan(
      MENSAJE_SIN_AUTOGUARDADO.length / 2,
    )
  })

  it('por el panel de avisos se dice UNA sola vez, y cuando pasa a haber algo que perder', async () => {
    const { cableado, avisos } = montar()
    expect(avisos.filter((a) => a.mensaje === MENSAJE_SIN_AUTOGUARDADO)).toHaveLength(0)

    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    expect(avisos.filter((a) => a.mensaje === MENSAJE_SIN_AUTOGUARDADO)).toHaveLength(1)

    await soltar(cableado, ficheroDe(RUTA_TXT, 'PARCELA.txt'))
    expect(avisos.filter((a) => a.mensaje === MENSAJE_SIN_AUTOGUARDADO)).toHaveLength(1)
  })

  it('el mensaje dice las tres cosas: qué no pasa, por qué y qué hacer', () => {
    expect(MENSAJE_SIN_AUTOGUARDADO).toMatch(/no se guarda sola/i)
    expect(MENSAJE_SIN_AUTOGUARDADO).toMatch(/rama Parcela/i)
    expect(MENSAJE_SIN_AUTOGUARDADO).toMatch(/se pierde/i)
  })
})

// ══ 7 · LAS INTENCIONES DEL PANEL ════════════════════════════════════════════

describe('las intenciones del panel llegan a las mutaciones', () => {
  it('renombrar una parte cambia SOLO su nombre y deja el resto igual', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    const antes = estado.get()

    filasParte()[0].querySelector('[data-accion="renombrar-parte"]').click()
    const entrada = document.querySelector('[data-campo="nombre-parte"]')
    entrada.value = 'Vivienda'
    filasParte()[0].querySelector('[data-accion="renombrar-parte"]').click()

    expect(estado.get().partes[0].nombre).toBe('Vivienda')
    expect(estado.get().partes[0].recinto).toEqual(antes.partes[0].recinto)
    expect(estado.get()).not.toBe(antes)
  })

  it('un nombre en blanco NO lanza dentro de un click: se conserva el anterior y se dice', async () => {
    const { cableado, estado, avisos } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))

    filasParte()[0].querySelector('[data-accion="renombrar-parte"]').click()
    document.querySelector('[data-campo="nombre-parte"]').value = '   '
    filasParte()[0].querySelector('[data-accion="renombrar-parte"]').click()

    expect(estado.get().partes[0].nombre).toBe('Parte 1')
    expect(avisos.some((a) => a.mensaje.includes('conserva su nombre'))).toBe(true)
  })

  it('pasar a SIMPLIFICADO borra los siete atributos y lo DICE antes de que nadie lo note', async () => {
    const { cableado, estado, avisos } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))

    // A COMPLETO y de vuelta.
    const radios = [...document.querySelectorAll(SELECTOR_PANEL.MODELO)]
    const completo = radios.find((r) => r.value === MODELO_EDIFICIO.COMPLETO)
    completo.checked = true
    completo.dispatchEvent(new Event('change', { bubbles: true }))
    expect(estado.get().modelo).toBe(MODELO_EDIFICIO.COMPLETO)

    const simple = radios.find((r) => r.value === MODELO_EDIFICIO.SIMPLIFICADO)
    simple.checked = true
    simple.dispatchEvent(new Event('change', { bubbles: true }))

    expect(estado.get().modelo).toBe(MODELO_EDIFICIO.SIMPLIFICADO)
    expect('usoDominante' in estado.get()).toBe(false)
    expect(avisos.some((a) => a.mensaje.includes('atributos'))).toBe(true)
  })

  it('los siete atributos del <dialog> llegan al modelo', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    const completo = [...document.querySelectorAll(SELECTOR_PANEL.MODELO)].find(
      (r) => r.value === MODELO_EDIFICIO.COMPLETO,
    )
    completo.checked = true
    completo.dispatchEvent(new Event('change', { bubbles: true }))

    document.querySelector('[data-accion="abrir-atributos-edificio"]').click()
    document.querySelector('[data-campo="anio-construccion"]').value = '1998'
    document.querySelector('[data-accion="aplicar-atributos"]').click()

    expect(estado.get().anioConstruccion).toBe(1998)
  })

  it('un repintado NO le borra al usuario la referencia que está tecleando', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    const campo = document.querySelector(SELECTOR_PANEL.REFCAT)
    campo.value = '93985'
    // Una mutación cualquiera fuerza un `set` y con él un repintado entero.
    estado.set(estado.get())
    expect(campo.value).toBe('93985')
  })
})

// ══ 8 · LA PARCELA COMO CONTEXTO (desviación 9) ══════════════════════════════

describe('la parcela en pantalla viaja como parcelaContexto, nunca como rama parcela', () => {
  it('los recintos de la parcela entran en edificio.parcelaContexto', async () => {
    const recintos = [{ vertices: [[0, 0], [10, 0], [10, 10]], tipo: 'EXTERIOR' }]
    const { cableado, estado } = montar({ parcela: { refcat: 'P', recintos } })
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    expect(estado.get().parcelaContexto).toEqual(recintos)
    // Y es una COPIA: el modelo no comparte referencias con el otro store.
    expect(estado.get().parcelaContexto).not.toBe(recintos)
  })

  it('sin parcela en pantalla, parcelaContexto es null y no un array vacío', async () => {
    const { cableado, estado } = montar()
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    expect(estado.get().parcelaContexto).toBeNull()
  })

  it('el store de PARCELA no se toca en ninguna vía', async () => {
    const parcela = { refcat: 'P', recintos: [] }
    const { cableado, estadoParcela } = montar({ parcela })
    const espia = vi.spyOn(estadoParcela, 'set')
    await soltar(cableado, ficheroDe(RUTA_LIST, 'LIST.txt'))
    expect(espia).not.toHaveBeenCalled()
    expect(estadoParcela.get()).toBe(parcela)
  })
})

// ══ 9 · DESTRUIR, Y QUE DE VERDAD SE DÉ DE BAJA ══════════════════════════════

describe('destruir()', () => {
  it('⛔ da de baja de VERDAD los dos oyentes: se cuenta la RETIRADA, no la bandera', () => {
    // ⛔ Esta prueba nació midiendo el comportamiento («tras destruir, un `set` no
    // repinta») y salió VERDE con la mutación puesta: todos los manejadores
    // empiezan por `if (destruido) return`, así que medía la bandera. Es la
    // lección de T2.4 repetida. Ahora se cuenta la baja, interviniendo
    // `subscribe` y `alAccion` en el arnés.
    const { cableado, bajas } = montar()
    expect(bajas).toEqual({ store: 0, panel: 0, cierre: 0 })
    cableado.destruir()
    expect(bajas).toEqual({ store: 1, panel: 1, cierre: 1 })
  })

  it('y además deja de repintar: el comportamiento coincide con la retirada', () => {
    const { cableado, estado } = montar()
    cableado.destruir()
    const filasAntes = document.querySelectorAll('[data-parte-indice]').length
    estado.set(crearEdificio({ partes: [] }))
    expect(document.querySelectorAll('[data-parte-indice]').length).toBe(filasAntes)
  })

  it('apaga la capa de huellas', () => {
    const { cableado, capa } = montar()
    cableado.destruir()
    expect(capa.destruida).toBe(1)
  })

  it('es IDEMPOTENTE', () => {
    const { cableado } = montar()
    cableado.destruir()
    expect(() => cableado.destruir()).not.toThrow()
  })

  it('una respuesta que llega DESPUÉS de destruir no escribe en el store', async () => {
    let soltar_
    const cliente = { edificioPorRefcat: () => new Promise((r) => (soltar_ = r)) }
    const datos = parsearGmlBu(textoDe(RUTA_GML_PARTES))
    const { cableado, estado } = montar({ cliente })
    document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516VK3799G'
    const promesa = cableado.cargar()
    await cederTurno()
    cableado.destruir()
    soltar_(resultadoOk({ ...datos, refcat: 'X' }))
    await promesa
    expect(estado.get()).toBeNull()
  })
})

// ══ 10 · CONTRATOS DEL PROGRAMADOR ═══════════════════════════════════════════

describe('contrato del programador: lanza y nombra', () => {
  const base = () => {
    document.body.className = INDEX.clase
    document.body.innerHTML = INDEX.cuerpo
    return {
      estado: crearEstadoVista(null),
      panel: { avisar: () => {} },
      panelEdificio: crearPanelEdificio({ documento: document }),
      srs: SRS,
      documento: document,
    }
  }

  it('sin store lanza nombrando el contrato H', () => {
    const args = base()
    expect(() => cablearEdificio({ ...args, estado: null })).toThrow(/contrato H/)
    args.panelEdificio.destruir()
  })

  it('sin panel de avisos lanza', () => {
    const args = base()
    expect(() => cablearEdificio({ ...args, panel: {} })).toThrow(/crearPanelAvisos/)
    args.panelEdificio.destruir()
  })

  it('con un panel de edificio que no lo es, lanza nombrando lo que le falta', () => {
    const args = base()
    expect(() => cablearEdificio({ ...args, panelEdificio: { montar() {} } })).toThrow(
      /crearPanelEdificio/,
    )
    args.panelEdificio.destruir()
  })

  it('con un srs que no es un huso soportado, lanza (delegado en husoPorSrs)', () => {
    const args = base()
    expect(() => cablearEdificio({ ...args, srs: 'EPSG:4326' })).toThrow()
    args.panelEdificio.destruir()
  })

  it('si falta un ancla en la cáscara, lanza NOMBRANDO el selector', () => {
    document.body.className = INDEX.clase
    document.body.innerHTML = '<div class="gml-panel"></div>'
    const panelEdificio = crearPanelEdificio({ documento: document })
    expect(() =>
      cablearEdificio({
        estado: crearEstadoVista(null),
        panel: { avisar: () => {} },
        panelEdificio,
        srs: SRS,
        documento: document,
      }),
    ).toThrow(new RegExp(ANCLA_ORIGEN.replace(/[.]/g, '\\.')))
    panelEdificio.destruir()
  })
})

// ══ 11 · REGLA DE ORO 9 ══════════════════════════════════════════════════════

describe('regla de oro 9: la aplicación mide, el colegiado interpreta', () => {
  /**
   * Palabras que convertirían una MEDICIÓN en un VEREDICTO. Es la misma lista
   * que vigilan los ficheros de F07, F08 y F09; las fronteras van con
   * `(?<!\p{L})…(?!\p{L})` y bandera `u` **a propósito**: `\b` está definida
   * sobre `\w = [A-Za-z0-9_]`, así que un patrón que empiece o acabe en letra
   * acentuada **no caza nada** (deuda destapada por T2.5 y verificada aparte).
   */
  const VEREDICTOS = [
    'correcto',
    'incorrecto',
    'válido',
    'inválido',
    'erróneo',
    'conforme',
    'apto',
    'aprobado',
    'rechazado',
    'perfecto',
  ]
  const prohibido = (texto) =>
    VEREDICTOS.filter((v) => new RegExp(`(?<!\\p{L})${v}(?!\\p{L})`, 'iu').test(texto))

  // Anti-vacuidad: la lista tiene que cazar cuando de verdad hay un veredicto.
  it('la lista negra no está muerta', () => {
    expect(prohibido('el fichero es válido')).toEqual(['válido'])
    expect(prohibido('el encaje es correcto y queda aprobado')).toEqual(['correcto', 'aprobado'])
    // ⛔ Y la mitad que destapó T2.5: con `\b` en vez de `(?<!\p{L})…(?!\p{L})`
    // un patrón que EMPIEZA o ACABA en letra acentuada no cazaría nunca.
    expect(prohibido('un GML inválido')).toEqual(['inválido'])
  })

  it('ninguno de los literales exportados emite un veredicto', () => {
    for (const literal of [
      MENSAJE_ELIGE_CAPAS,
      MENSAJE_FICHERO_NO_LEIDO,
      MENSAJE_SIN_AUTOGUARDADO,
      MENSAJE_SIN_CLIENTE,
      MENSAJE_SIN_REFERENCIA,
      mensajeVariosCandidatos([{ refcat: 'A' }, { refcat: 'B' }]),
    ]) {
      expect(prohibido(literal), literal).toEqual([])
    }
  })

  it('nada de lo que este módulo escribe en pantalla emite un veredicto', async () => {
    const datos = { ...parsearGmlBu(textoDe(RUTA_GML_PARTES)), refcat: '9398516VK3799G' }
    const cliente = { edificioPorRefcat: async () => resultadoOk(datos) }
    const { cableado, avisos } = montar({ cliente })

    await soltar(cableado, ficheroDe(RUTA_DXF, 'edificio.dxf'))
    casillasCapa()[0].checked = true
    document.querySelector(SELECTOR_PANEL.APLICAR_CAPAS).click()
    await cederTurno()
    document.querySelector(SELECTOR_PANEL.REFCAT).value = '9398516VK3799G'
    await cableado.cargar()

    expect(prohibido(renglon())).toEqual([])
    expect(prohibido(procedencia())).toEqual([])
    // Los avisos que compone ESTE módulo (los de las capas de abajo son suyos y
    // los vigilan sus propias suites).
    for (const aviso of avisos) expect(prohibido(aviso.mensaje), aviso.mensaje).toEqual([])
  })

  it('las extensiones que esta rama aporta son las dos que dice el contrato J', () => {
    expect([...EXTENSIONES]).toEqual(['.dxf', '.txt'])
    // ⛔ `.gml`/`.xml` NO están: las reclama `app/cableado-comprobacion.js` y
    // `entradasExtra` lanza si se intenta tomar una extensión ya tomada.
    expect(EXTENSIONES).not.toContain('.gml')
  })
})

/* -------------------------------------------------------------------------- *
 * Los resultados de las doce mutaciones están en la cabecera de este fichero.   *
 * Once de doce salieron 🔴 a la primera; la que faltaba (M7) salió VERDE y       *
 * obligó a cambiar el guardián por un parte de altas y bajas.                    *
 * -------------------------------------------------------------------------- */

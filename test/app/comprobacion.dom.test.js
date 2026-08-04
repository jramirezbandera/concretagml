/* -------------------------------------------------------------------------- *
 * test/app/comprobacion.dom.test.js — F08 · T4.1 · el recorrido, cableado      *
 *                                                                              *
 * `gml/decodificar.js` sabe leer bytes, `comprobacion/gml.js` sabe decir qué es *
 * un GML, `viewer/cajon-comprobacion.js` sabe enseñarlo y `app/zona-fichero.js` *
 * sabe recoger un fichero. Mientras nadie los enchufe, F08 entera es código     *
 * muerto. Aquí se prueba el CABLE, no las piezas.                               *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelven a probar la decodificación (`test/gml/decodificar.test.js`), la *
 * comprobación (`test/comprobacion/gml.test.js`), el cajón                      *
 * (`test/viewer/cajon-comprobacion.dom.test.js`) ni la zona de fichero          *
 * (`test/app/zona-fichero.dom.test.js`). Se prueban las seis cosas de las que   *
 * este cableado es dueño: que la geometría del FICHERO no se sustituye por la   *
 * del WFS, que el `estado.set` es UNO, que sin referencia utilizable no se toca *
 * la red, que un fallo del servicio no tumba el recorrido, que la procedencia   *
 * dice las DOS cosas, que los dos cajones de `bottomleft` no coinciden, y —§12— *
 * que el campo «Referencia catastral» del panel dice lo MISMO que el modelo.    *
 *                                                                              *
 * ── DECISIÓN 1 · EL RECORRIDO ES EL DE VERDAD, DE PUNTA A PUNTA ──             *
 * Los ficheros se SUELTAN sobre la ventana (evento `drop` con un `File` real    *
 * dentro), no se inyectan por la API: así el test atraviesa `crearZonaFichero`, *
 * `decodificarGml`, `comprobarGml`, el cajón de Leaflet y el cliente del        *
 * Catastro, que es exactamente el camino que hace el usuario. El cajón, el      *
 * panel de avisos, el store y el cliente son los REALES; lo único doblado es el *
 * transporte HTTP, para que la suite no toque la red jamás.                     *
 *                                                                              *
 * ── DECISIÓN 2 · LA CÁSCARA SE LEE DE `index.html`, NO SE COPIA ──             *
 * Igual que en `catastro.dom.test.js` y en `diagnostico.dom.test.js`: el botón  *
 * «Abrir un GML…» y el renglón de procedencia son CONTRATO, y una copia a mano  *
 * podría quedarse en verde con la cáscara ya rota.                              *
 *                                                                              *
 * ── ⚠️ DOS TRAMPAS DE ENTORNO, LAS DOS MEDIDAS ──                              *
 *  1. **`readFileSync` devuelve un `Buffer` del realm de Node**, y bajo jsdom   *
 *     el `instanceof Uint8Array` de `gml/decodificar.js` da `false` sobre él:   *
 *     el `Uint8Array` global es el de jsdom, que es otro realm. Los bytes de un *
 *     fixture se pasan SIEMPRE por `Uint8Array.from(...)`. El test hermano del  *
 *     proyecto `node` no puede encontrar esto, porque allí solo hay un realm.   *
 *  2. **jsdom (29.1) no implementa `DataTransfer` ni `DragEvent`**, así que el  *
 *     `drop` se fabrica con `Event` + un doble de `dataTransfer`, igual que en  *
 *     `test/app/zona-fichero.dom.test.js`.                                      *
 *                                                                              *
 * ── ⛔ MEDIDO, Y CONTRADICE EL ENCARGO DE ESTA TAREA ──                        *
 * El encargo pedía que `cp_ejemplo_explicativo.gml` acabara con                 *
 * `geometriaOficial` traída del WFS. **No puede**: ese fichero es la plantilla  *
 * oficial de ALTA del Catastro y su `cp:nationalCadastralReference` está        *
 * presente y VACÍO (`''`) — igual que el de `UTM_1.gml`—, así que no hay        *
 * ninguna referencia con la que pedir parcelario. Es el mismo hecho que el      *
 * punto 9 del bloque «CORREGIDO AL MEDIRLO» del plan, aplicado a un fichero al  *
 * que el encargo no lo aplicó. El caso del parcelario traído se prueba con el   *
 * único fixture que SÍ trae referencia catastral de verdad, que es la respuesta *
 * real del WFS (`cp_parcela_9398516VK3799G.gml`).                               *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { crearPanelAvisos } from '../../app/avisos.js'
import {
  SELECTOR_BOTON_COLINDANTES,
  SELECTOR_BOTON_DEDUCIR,
  SELECTOR_CAMPO_REFCAT,
  cablearCatastro,
} from '../../app/cableado-catastro.js'
import {
  COLA_SIN_PARCELARIO,
  MENSAJE_FALLO_INESPERADO,
  MOTIVO_SIN_CLIENTE,
  SELECTOR_BOTON_ABRIR,
  SELECTOR_CAMPO_REFCAT as CAMPO_REEXPORTADO,
  SELECTOR_PROCEDENCIA,
  cablearComprobacion,
  motivoSinReferencia,
  motivoSrsAjeno,
} from '../../app/cableado-comprobacion.js'
import { CLASE_INPUT } from '../../app/zona-fichero.js'
import { parsearGml } from '../../gml/parse.js'
import { ORIGEN_PARCELA } from '../../model/parcela.js'
import { crearClienteCatastro } from '../../services/catastro.js'
import { crearEstadoVista } from '../../viewer/_comun.js'
import { crearCajonDiagnostico } from '../../viewer/cajon-diagnostico.js'
import {
  SELECTOR as SELECTOR_CAJON,
  SELECTOR_MIEMBRO,
  crearCajonComprobacion,
} from '../../viewer/cajon-comprobacion.js'
import { montarMapa } from '../viewer/_ayuda-jsdom.js'

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

const CUERPO_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/comprobacion.dom.test.js: no se ha encontrado el <body> de index.html. La ' +
        'cáscara de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

// ── Fixtures REALES ──────────────────────────────────────────────────────────

const leerTexto = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')
/** ⚠️ Trampa 1 de la cabecera: `Uint8Array.from`, nunca el `Buffer` a pelo. */
const leerBytes = (...ruta) => Uint8Array.from(readFileSync(join(RAIZ, ...ruta)))

const GML = (nombre) => ['test', 'fixtures', 'gml', nombre]
const DERIVADO = (nombre) => ['test', 'fixtures', 'gml', 'derivados', nombre]

/** La respuesta REAL del WFS: la única parcela de los fixtures con refcat. */
const TEXTO_WFS = leerTexto(...GML('cp_parcela_9398516VK3799G.gml'))
const PARCELA_WFS = parsearGml(TEXTO_WFS).parcelas[0]
const REFCAT = PARCELA_WFS.refcat

/** El `ExceptionReport` capturado del servicio, que llega con **HTTP 200** (O14). */
const TEXTO_EXCEPCION = leerTexto('test', 'fixtures', 'catastro', 'wfs-exceptionreport-rc-inexistente.xml')

const SRS = 'EPSG:25830'

/**
 * El primer vértice del fixture real, tal como sale del `posList`. Aparece DOS
 * veces (es el primero y el de cierre), y las dos se sustituyen para que el anillo
 * siga cerrado.
 */
const VERTICE_WFS = [439283.23, 4479671.27]
const VERTICE_FICHERO = [439285.73, 4479673.77]

/**
 * El fichero del usuario para el caso que más importa: **la misma parcela, con el
 * primer vértice movido 2,5 m al noreste**.
 *
 * Es una derivación DE TEST y por eso vive aquí y no en `test/fixtures/gml/
 * derivados/`: no describe ningún caso del dominio (no hay nada mal en ella), su
 * única función es que la geometría del fichero y la del WFS sean DISTINGUIBLES
 * vértice a vértice. Sin esa diferencia, «no se ha sustituido la geometría» no se
 * puede afirmar: las dos serían iguales y el test pasaría con un cableado que
 * hiciera justo lo contrario de lo que debe.
 *
 * La receta, entera: sobre `cp_parcela_9398516VK3799G.gml`, las dos apariciones de
 * «439283.23 4479671.27» pasan a «439285.73 4479673.77». Nada más.
 */
const TEXTO_FICHERO_MOVIDO = TEXTO_WFS.replaceAll(
  `${VERTICE_WFS[0]} ${VERTICE_WFS[1]}`,
  `${VERTICE_FICHERO[0]} ${VERTICE_FICHERO[1]}`,
)

/**
 * La misma referencia escrita como la escribe un humano: con el espacio que imprime
 * la Sede y en minúsculas. `normalizarRefcat` tolera las dos cosas a propósito (ver
 * su JSDoc), así que el fichero es perfectamente válido y la forma CANÓNICA de esa
 * referencia sigue siendo {@link REFCAT}.
 */
const REFCAT_CRUDA = `${REFCAT.slice(0, 7)} ${REFCAT.slice(7).toLowerCase()}`

/**
 * El fichero del usuario con la referencia en esa forma cruda. Se sustituye SOLO el
 * contenido de `cp:nationalCadastralReference` y no todas las apariciones del
 * literal: la referencia también está dentro de los `gml:id` y del `localId`, y
 * tocarlos cambiaría la identidad del documento en vez de la forma del dato.
 */
const TEXTO_FICHERO_REFCAT_CRUDA = TEXTO_FICHERO_MOVIDO.replace(
  `<cp:nationalCadastralReference>${REFCAT}</cp:nationalCadastralReference>`,
  `<cp:nationalCadastralReference>${REFCAT_CRUDA}</cp:nationalCadastralReference>`,
)

// ── Dobles: solo el transporte HTTP ──────────────────────────────────────────

/** Un `ResultadoHttp` con éxito, con la forma de `services/_red.js`. */
const http200 = (url, texto) => ({
  ok: true,
  estado: 200,
  texto,
  tipoContenido: 'text/xml',
  motivo: null,
  mensaje: null,
  intentos: 1,
  ms: 1,
  url,
})

/** Un `ResultadoHttp` de red caída: el `fetch` ni llegó a responder. */
const sinRed = (url) => ({
  ok: false,
  estado: 0,
  texto: null,
  tipoContenido: null,
  motivo: 'SIN_RED',
  mensaje: 'No se ha podido contactar con el servicio (sin conexión, DNS, TLS o CORS).',
  intentos: 3,
  ms: 1,
  url,
})

/**
 * Transporte doble. No conoce `fetch`: es IMPOSIBLE que esta suite toque la red, y
 * `peticiones` es el espía con el que se afirma que no se ha pedido nada.
 *
 * @param {(url: string) => object} [responder]
 */
function crearTransporteDoble(responder = (url) => http200(url, TEXTO_WFS)) {
  const peticiones = []
  return {
    peticiones,
    async pedirTexto(url) {
      peticiones.push(url)
      return responder(url)
    },
    estado: () => ({ peticiones: peticiones.length }),
    destruir() {},
  }
}

// ── Arnés ────────────────────────────────────────────────────────────────────

const pendientes = []

beforeEach(() => {
  document.body.innerHTML = CUERPO_INDEX
})

afterEach(() => {
  while (pendientes.length) {
    const limpiar = pendientes.pop()
    try {
      limpiar()
    } catch {
      /* la limpieza nunca debe enmascarar el fallo real del test */
    }
  }
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

/**
 * Store + panel + cajón REALES sobre un `L.Map` real + el cliente del Catastro
 * real sobre un transporte doble + el cableado.
 *
 * @param {object} [opciones]
 * @param {((url: string) => object)|null} [opciones.responder]  Qué contesta el
 *   transporte. `null` ⇒ se cablea SIN cliente (el visor suelto, uso legítimo).
 * @param {object} [opciones.cliente]  Doble del cliente, solo para el caso en que
 *   lo que se quiere romper es el propio cliente.
 * @param {boolean} [opciones.conDiagnostico=false]  Monta también el cajón de F07,
 *   para las pruebas de exclusión mutua.
 * @param {boolean} [opciones.conCatastro=false]  Monta también `cablearCatastro`,
 *   que es quien enciende «Deducir del mapa» y «Traer colindantes» **mirando el
 *   store**. Sin él esos dos botones se quedan en el `disabled` con el que nacen en
 *   `index.html` y la contradicción del defecto no se puede medir.
 */
function montar({
  responder = undefined,
  cliente: clienteDoble,
  conDiagnostico = false,
  conCatastro = false,
  entradasExtra = [],
  alGmlDeEdificio = null,
} = {}) {
  const { mapa, destruir: destruirMapa } = montarMapa({ zoom: 19 })

  const estado = crearEstadoVista(null)
  vi.spyOn(estado, 'set')

  const panel = crearPanelAvisos({
    contenedor: document.getElementById('avisos'),
    chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
    chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
  })
  vi.spyOn(panel, 'avisar')

  const transporte = responder === null ? null : crearTransporteDoble(responder)
  const cliente =
    clienteDoble ?? (transporte === null ? null : crearClienteCatastro({ transporte, srs: SRS }))

  const cajon = crearCajonComprobacion({ mapa })
  const cajonDiagnostico = conDiagnostico ? crearCajonDiagnostico({ mapa }) : null

  // ANTES del de comprobación, que es el orden de `app/main.js` (pasos 7 y 9).
  const catastro = conCatastro ? cablearCatastro({ estado, panel, cliente, srs: SRS }) : null

  const cableado = cablearComprobacion({
    estado,
    cajon,
    panel,
    cliente,
    srs: SRS,
    cajonDiagnostico,
    entradasExtra,
    alGmlDeEdificio,
    ventana: window,
  })

  pendientes.push(() => {
    cableado.destruir()
    if (catastro !== null) catastro.destruir()
    if (cajonDiagnostico !== null) cajonDiagnostico.destruir()
    cajon.destruir()
    destruirMapa()
  })

  return {
    mapa,
    estado,
    panel,
    cajon,
    cajonDiagnostico,
    cableado,
    catastro,
    cliente,
    transporte,
    raizCajon: cajon.control.getContainer(),
    procedencia: document.querySelector(SELECTOR_PROCEDENCIA),
    campo: document.querySelector(SELECTOR_CAMPO_REFCAT),
    botonDeducir: document.querySelector(SELECTOR_BOTON_DEDUCIR),
    botonColindantes: document.querySelector(SELECTOR_BOTON_COLINDANTES),
  }
}

/** `FileList` de mentira: array-like, como la de verdad (y sin métodos de Array). */
function dobleFileList(ficheros) {
  const lista = { length: ficheros.length, item: (i) => ficheros[i] ?? null }
  ficheros.forEach((f, i) => {
    lista[i] = f
  })
  return lista
}

/** Suelta un `File` sobre la ventana, como haría el usuario. Ver la trampa 2. */
function soltar(fichero) {
  const evento = new Event('drop', { bubbles: true, cancelable: true })
  evento.dataTransfer = { types: ['Files'], files: dobleFileList([fichero]), dropEffect: 'none' }
  document.body.dispatchEvent(evento)
  return evento
}

/** Un `File` de verdad con los bytes de un fixture. */
const ficheroDeBytes = (bytes, nombre) => new File([bytes], nombre, { type: '' })
const ficheroDeTexto = (texto, nombre) =>
  new File([new TextEncoder().encode(texto)], nombre, { type: '' })

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 40) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

/** Suelta el fichero y espera a que el recorrido de lectura termine. */
async function soltarYEsperar(fichero) {
  soltar(fichero)
  await cederTurno()
}

/** El botón «Contrastar con el parcelario» del cajón. */
const botonContrastar = (raiz) => raiz.querySelector(SELECTOR_CAJON.CONTRASTAR)
/** El renglón `role="status"` del cajón. */
const estadoCajon = (raiz) => raiz.querySelector(SELECTOR_CAJON.ESTADO).textContent

/** Pulsa «Contrastar» y espera al desenlace (petición al Catastro incluida). */
async function contrastar(raiz) {
  botonContrastar(raiz).click()
  await cederTurno()
}

/** Los mensajes que han llegado al panel de avisos. */
const mensajes = (panel) => panel.avisar.mock.calls.map(([mensaje]) => mensaje)

// ── 1 · Contrato con `index.html` ────────────────────────────────────────────

describe('cableado-comprobacion · el marcado de index.html es CONTRATO', () => {
  it('lanza nombrando el selector que falte, en vez de morir cien líneas después', () => {
    document.querySelector(SELECTOR_BOTON_ABRIR).remove()
    expect(() => montar()).toThrow(/data-accion="abrir-gml"/)
  })

  it('la guarda NO es vacua: index.html trae los dos nodos del contrato', () => {
    // Sin esta comprobación, la de arriba pasaría igual con un `index.html` que
    // hubiera perdido los dos nodos.
    expect(document.querySelector(SELECTOR_BOTON_ABRIR)).not.toBeNull()
    expect(document.querySelector(SELECTOR_PROCEDENCIA)).not.toBeNull()
    expect(document.querySelectorAll(SELECTOR_PROCEDENCIA)).toHaveLength(1)
  })

  it('el renglón de procedencia es el MISMO que escribe el cableado del Catastro', () => {
    // Hay UN solo renglón de procedencia porque hay UN solo dato del que hablar: la
    // parcela cargada. Dos nodos serían dos verdades simultáneas sobre la misma.
    montar()
    expect(SELECTOR_PROCEDENCIA).toBe('[data-procedencia="parcela"]')
  })

  it('cablea la zona de fichero: fabrica su <input type="file"> y lo retira al destruir', () => {
    const { cableado } = montar()
    expect(document.querySelector(`.${CLASE_INPUT}`)).not.toBeNull()
    cableado.destruir()
    expect(document.querySelector(`.${CLASE_INPUT}`)).toBeNull()
  })
})

// ── 2 · El recorrido completo con la plantilla oficial ───────────────────────

describe('cableado-comprobacion · soltar la plantilla oficial de alta', () => {
  it('la abre, la comprueba y ENSEÑA el cajón', async () => {
    const { cajon, raizCajon } = montar()
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('cp_ejemplo_explicativo.gml')), 'cp_ejemplo_explicativo.gml'))

    expect(cajon.abierto()).toBe(true)
    expect(raizCajon.querySelector(SELECTOR_CAJON.FICHERO).textContent).toContain(
      'cp_ejemplo_explicativo.gml',
    )
    expect(botonContrastar(raizCajon).disabled).toBe(false)
  })

  it('«Contrastar» mete la parcela con UN SOLO estado.set, origen GML_EXISTENTE y la geometría del FICHERO', async () => {
    const { estado, cajon, raizCajon } = montar()
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('cp_ejemplo_explicativo.gml')), 'cp_ejemplo_explicativo.gml'))
    await contrastar(raizCajon)

    expect(estado.set).toHaveBeenCalledTimes(1)
    const parcela = estado.get()
    expect(parcela.origen).toBe(ORIGEN_PARCELA.GML_EXISTENTE)
    expect(parcela.idLocal).toBe('1A')
    // Los 8 vértices que trae el fichero, medidos en `comprobacion/gml.js`.
    expect(parcela.recintos[0].vertices).toHaveLength(8)
    expect(parcela.recintos[0].vertices[0]).toEqual([269218.83, 4805295.18])
    // El recorrido TERMINA con el cajón cerrado: el cierre es de este cableado.
    expect(cajon.abierto()).toBe(false)
  })

  it('⛔ MEDIDO: su referencia catastral viene VACÍA, así que no hay parcelario que pedir', async () => {
    // Esto contradice el encargo de T4.1, que daba por hecho que este fichero
    // acabaría con `geometriaOficial` del WFS. La plantilla oficial de ALTA trae el
    // elemento presente y vacío (`''`), igual que `UTM_1.gml`: no hay referencia.
    const { estado, transporte, procedencia, raizCajon } = montar()
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('cp_ejemplo_explicativo.gml')), 'cp_ejemplo_explicativo.gml'))
    await contrastar(raizCajon)

    expect(transporte.peticiones).toHaveLength(0)
    expect(estado.get().geometriaOficial).toBeNull()
    expect(estado.get().refcat).toBeNull()
    expect(procedencia.textContent).toContain('VACÍA')
  })
})

// ── 3 · EL TEST QUE MÁS IMPORTA: la geometría del fichero NO se sustituye ────

describe('cableado-comprobacion · la geometría del fichero NO se sustituye por la del WFS', () => {
  it('compone las dos: `recintos` del fichero y `geometriaOficial` del Catastro', async () => {
    const { estado, transporte, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    expect(transporte.peticiones).toHaveLength(1)
    expect(transporte.peticiones[0]).toContain(REFCAT)

    const parcela = estado.get()
    // La del FICHERO, vértice a vértice: el que se movió 2,5 m al noreste.
    expect(parcela.recintos[0].vertices[0]).toEqual(VERTICE_FICHERO)
    // La del CATASTRO, intacta y en su sitio.
    expect(parcela.geometriaOficial[0].vertices[0]).toEqual(VERTICE_WFS)
    // Y no son la misma lista por accidente.
    expect(parcela.recintos[0].vertices[0]).not.toEqual(parcela.geometriaOficial[0].vertices[0])
  })

  it('la prueba NO es vacua: el fichero y la respuesta del WFS son distinguibles', () => {
    // Si la derivación de test dejara de mover el vértice, el test de arriba
    // pasaría con un cableado que sustituyera la geometría del usuario por la del
    // Catastro — que es exactamente el fallo que existe para cazar.
    expect(TEXTO_FICHERO_MOVIDO).not.toBe(TEXTO_WFS)
    expect(parsearGml(TEXTO_FICHERO_MOVIDO).parcelas[0].recintos[0].vertices[0]).toEqual(
      VERTICE_FICHERO,
    )
    expect(PARCELA_WFS.recintos[0].vertices[0]).toEqual(VERTICE_WFS)
  })

  it('la superficie catastral es la que declara el PARCELARIO, no la del fichero', async () => {
    const { estado, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    expect(estado.get().superficieCatastral).toBe(PARCELA_WFS.areaValue)
  })

  it('un solo `estado.set`, y el cajón cerrado al terminar', async () => {
    const { estado, cajon, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    expect(estado.set).toHaveBeenCalledTimes(1)
    expect(cajon.abierto()).toBe(false)
  })
})

// ── 4 · La procedencia dice las DOS cosas ────────────────────────────────────

describe('cableado-comprobacion · la procedencia es DOBLE y lo dice', () => {
  it('nombra el fichero como origen de la geometría Y el Catastro como origen del parcelario', async () => {
    const { procedencia, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    const texto = procedencia.textContent
    expect(texto).toContain('de-otro-despacho.gml')
    expect(texto).toMatch(/geometría del fichero/i)
    expect(texto).toMatch(/parcelario/i)
    expect(texto).toMatch(/del servicio a las \d{1,2}:\d{2}/i)
  })

  it('NO se conforma con «Del Catastro» a secas: eso convertiría el fichero en un dato oficial', async () => {
    // Es el error de producto de toda la fase, y el renglón es donde ocurriría.
    const { procedencia, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    expect(procedencia.textContent.startsWith('Del Catastro')).toBe(false)
    expect(procedencia.textContent).toMatch(/NO del Catastro/)
  })

  it('sin parcelario, lo dice en el mismo renglón en vez de dejarlo en blanco', async () => {
    const { procedencia, raizCajon } = montar()
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('UTM_1.gml')), 'UTM_1.gml'))
    await contrastar(raizCajon)

    expect(procedencia.textContent).toMatch(/geometría del fichero/i)
    expect(procedencia.textContent).toContain('Sin parcelario')
    expect(procedencia.textContent).toContain(COLA_SIN_PARCELARIO)
  })
})

// ── 5 · Sin referencia utilizable no se toca la red ──────────────────────────

describe('cableado-comprobacion · un GML sin referencia catastral', () => {
  it('UTM_1.gml (referencia VACÍA) no pide NADA a la red, y lo dice', async () => {
    const { estado, transporte, panel, raizCajon } = montar()
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('UTM_1.gml')), 'UTM_1.gml'))
    await contrastar(raizCajon)

    expect(transporte.peticiones).toHaveLength(0)
    expect(estado.get().geometriaOficial).toBeNull()
    expect(estado.get().origen).toBe(ORIGEN_PARCELA.GML_EXISTENTE)
    expect(mensajes(panel)).toContain(motivoSinReferencia(''))
  })

  it('el 3.0 se carga IGUAL: `puedeContinuar` es capacidad, no mérito', async () => {
    // `UTM_1.gml` trae un `DIALECTO_RECHAZADO` de nivel ERROR y el recorrido sigue.
    const { estado, raizCajon } = montar()
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('UTM_1.gml')), 'UTM_1.gml'))

    expect(botonContrastar(raizCajon).disabled).toBe(false)
    await contrastar(raizCajon)
    expect(estado.get().recintos[0].vertices).toHaveLength(11)
  })

  it('NO usa el `localId` como referencia de repuesto, aunque tenga forma de una', async () => {
    // Trampa medida: el `localId` de `UTM_1.gml` es `8703362TF9980S0001SH`, que
    // `normalizarRefcat` aceptaría como referencia de INMUEBLE y recortaría a
    // `8703362TF9980S`. Se pediría al Catastro una parcela que nadie ha dicho que
    // sea ésta, y su contorno entraría como término de comparación.
    const { estado, transporte, raizCajon } = montar()
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('UTM_1.gml')), 'UTM_1.gml'))
    await contrastar(raizCajon)

    expect(transporte.peticiones).toHaveLength(0)
    expect(estado.get().refcat).toBeNull()
    // El identificador local sí se conserva, como identificador local que es.
    expect(estado.get().idLocal).toBe('8703362TF9980S0001SH')
  })

  it('sin cliente del Catastro tampoco se cae: se carga y se DICE', async () => {
    const { estado, panel, raizCajon } = montar({ responder: null })
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    expect(estado.get().geometriaOficial).toBeNull()
    expect(mensajes(panel)).toContain(MOTIVO_SIN_CLIENTE)
  })
})

// ── 6 · El servicio falla, y el recorrido NO se cae ──────────────────────────

describe('cableado-comprobacion · el Catastro no entrega el parcelario', () => {
  it('ExceptionReport con HTTP 200 (override O14): la parcela entra igual, con su motivo y sin excepción', async () => {
    const { estado, panel, procedencia, transporte, raizCajon } = montar({
      responder: (url) => http200(url, TEXTO_EXCEPCION),
    })
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    // Se pidió de verdad, y la respuesta fue un 200 «correcto» con un error dentro.
    expect(transporte.peticiones).toHaveLength(1)

    const parcela = estado.get()
    expect(parcela.geometriaOficial).toBeNull()
    expect(parcela.recintos[0].vertices[0]).toEqual(VERTICE_FICHERO)
    expect(parcela.superficieCatastral).toBeNull()

    // El texto del servicio se arrastra íntegro; no se interpreta.
    expect(procedencia.textContent).toContain('Sin parcelario')
    expect(mensajes(panel).join(' | ')).toContain('0000000XX0000X')
    expect(mensajes(panel).join(' | ')).toContain(COLA_SIN_PARCELARIO)
  })

  it('el motivo de quedarse sin parcelario se cuenta UNA sola vez', async () => {
    // El panel AGRUPA por mensaje, así que decirlo dos veces no se ve como dos
    // tarjetas: se ve como un «×2» que nadie sabe explicar. Publicarlo en un solo
    // sitio no es estética, es lo que hace que el contador signifique algo.
    const { panel, raizCajon } = montar({ responder: (url) => http200(url, TEXTO_EXCEPCION) })
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    expect(mensajes(panel).filter((m) => m.includes(COLA_SIN_PARCELARIO))).toHaveLength(1)
  })

  it('dos pulsaciones seguidas no encabalgan dos peticiones ni dos `set`', async () => {
    const { estado, transporte, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))

    botonContrastar(raizCajon).click()
    botonContrastar(raizCajon).click()
    await cederTurno()

    expect(transporte.peticiones).toHaveLength(1)
    expect(estado.set).toHaveBeenCalledTimes(1)
  })

  it('la red caída tampoco tumba nada', async () => {
    const { estado, panel, raizCajon } = montar({ responder: (url) => sinRed(url) })
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    expect(estado.get().geometriaOficial).toBeNull()
    expect(estado.get().recintos[0].vertices).toHaveLength(15)
    expect(mensajes(panel).join(' | ')).toContain(COLA_SIN_PARCELARIO)
  })

  it('un cliente que REVIENTA se cuenta y el recorrido sigue: nada sube por la excepción', async () => {
    // Es la consecuencia de lo medido en T3.2: una excepción dentro de un oyente
    // del DOM no sale por `dispatchEvent`, así que un fallo que se dejara subir
    // sería invisible para el usuario. Aquí se rompe el camino INESPERADO del
    // cliente (los motivos del catálogo salen por `ok:false`, no por `throw`).
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { estado, cajon, raizCajon } = montar({
      cliente: {
        parcelaPorRefcat: () => Promise.reject(new Error('el cliente ha reventado')),
      },
    })
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    // La parcela entra IGUAL, con la geometría del fichero y sin parcelario.
    expect(estado.set).toHaveBeenCalledTimes(1)
    expect(estado.get().geometriaOficial).toBeNull()
    expect(estado.get().recintos[0].vertices[0]).toEqual(VERTICE_FICHERO)
    expect(cajon.abierto()).toBe(false)
    expect(consola).toHaveBeenCalled()
  })

  it('el parcelario en OTRO SRS que el expediente no se usa como contorno oficial', async () => {
    // El fichero declara 25829 sobre coordenadas de huso 30 (fixture derivado). No
    // se pide parcelario: se traería en otro sistema de referencia que la geometría
    // del fichero, y el contraste daría cientos de kilómetros con pinta de medida.
    const { estado, transporte, panel, raizCajon } = montar()
    await soltarYEsperar(
      ficheroDeBytes(leerBytes(...DERIVADO('cp_huso_incoherente.gml')), 'cp_huso_incoherente.gml'),
    )
    await contrastar(raizCajon)

    expect(transporte.peticiones).toHaveLength(0)
    expect(estado.get().geometriaOficial).toBeNull()
    // Pero la geometría SÍ entra: el recorrido continúa.
    expect(estado.get().recintos[0].vertices).toHaveLength(15)
    expect(mensajes(panel)).toContain(motivoSrsAjeno('EPSG:25829', SRS))
  })
})

// ── 7 · Multiparcela: se elige UNA, y entra ÉSA ──────────────────────────────

describe('cableado-comprobacion · un fichero con tres parcelas', () => {
  it('marcar el SEGUNDO radio hace que entre la segunda, no la primera', async () => {
    const { estado, raizCajon } = montar()
    await soltarYEsperar(
      ficheroDeBytes(leerBytes(...DERIVADO('cp_multiparcela_entrega.gml')), 'tres.gml'),
    )

    const radios = raizCajon.querySelectorAll(SELECTOR_MIEMBRO)
    expect(radios).toHaveLength(3)

    radios[1].click()
    await cederTurno(2)
    await contrastar(raizCajon)

    const parcela = estado.get()
    expect(parcela.idLocal).toBe('2B')
    // Las tres están separadas 30 m en X: la elegida es distinguible de las otras.
    expect(parcela.recintos[0].vertices[0]).toEqual([269248.83, 4805295.18])
    expect(estado.set).toHaveBeenCalledTimes(1)
  })

  it('las otras dos se quedan en el fichero: NUNCA se unen', async () => {
    const { estado, raizCajon } = montar()
    await soltarYEsperar(
      ficheroDeBytes(leerBytes(...DERIVADO('cp_multiparcela_entrega.gml')), 'tres.gml'),
    )
    await contrastar(raizCajon)

    // Una sola parcela, un solo exterior, los 8 vértices de la primera.
    expect(estado.get().recintos).toHaveLength(1)
    expect(estado.get().recintos[0].vertices).toHaveLength(8)
    expect(estado.get().idLocal).toBe('1A')
  })
})

// ── 8 · Un GML de edificio se detiene con honradez ───────────────────────────

describe('cableado-comprobacion · un GML de edificio', () => {
  it('deja «Contrastar» apagado CON su motivo escrito, y no entra nada en el store', async () => {
    const { estado, raizCajon } = montar()
    await soltarYEsperar(
      ficheroDeBytes(leerBytes(...GML('bu_building_9398516VK3799G.gml')), 'edificio.gml'),
    )

    expect(botonContrastar(raizCajon).disabled).toBe(true)
    expect(estadoCajon(raizCajon)).toMatch(/CONSTRUCCIÓN/)
    expect(estado.set).not.toHaveBeenCalled()
    expect(estado.get()).toBeNull()
  })

  it('ni forzando la acción desde la API: el gate no se puede saltar', async () => {
    const { estado, cableado, transporte } = montar()
    await soltarYEsperar(
      ficheroDeBytes(leerBytes(...GML('bu_building_9398516VK3799G.gml')), 'edificio.gml'),
    )
    await cableado.contrastar()

    expect(estado.set).not.toHaveBeenCalled()
    expect(transporte.peticiones).toHaveLength(0)
  })
})

// ── 8 bis · F11 · el desvío: ese callejón ya tiene salida ────────────────────
//
// Los dos `it` de arriba siguen siendo el comportamiento **sin desvío inyectado**,
// que es el de F08 y el de cualquier pantalla sin rama de edificio. Lo que se
// prueba aquí es el otro montaje: `alGmlDeEdificio` puesto.
//
// ⚠️ Y hay una razón medida para que estas pruebas existan y no baste con las del
// ensamblaje: la primera versión del desvío llevaba un `ReferenceError` —`DIALECTO`
// sin importar— que **esta suite no podía ver**, porque con el desvío en `null` el
// `&&` corta antes de evaluarlo. Lo cazó `main-comprobacion.dom.test.js` cuando ya
// estaba montado en `app/main.js`. Un guardián que no ejercita la rama nueva no es
// un guardián.

describe('cableado-comprobacion · F11 · el GML de edificio se ENCAMINA', () => {
  const ficheroBu = () =>
    ficheroDeBytes(leerBytes(...GML('bu_building_9398516VK3799G.gml')), 'edificio.gml')

  it('entrega el fichero al desvío, y NO abre el cajón de parcela', async () => {
    const destino = vi.fn()
    const { cajon, estado } = montar({ alGmlDeEdificio: destino })

    await soltarYEsperar(ficheroBu())

    expect(destino).toHaveBeenCalledTimes(1)
    // El MISMO `File`, no una copia ni sus bytes: quien lo recibe vuelve a leerlo.
    expect(destino.mock.calls[0][0].name).toBe('edificio.gml')
    expect(cajon.abierto()).toBe(false)
    // Y el store de PARCELA sigue intacto: este fichero no era suyo.
    expect(estado.set).not.toHaveBeenCalled()
  })

  it('cierra el cajón si venía ABIERTO de un fichero anterior', async () => {
    const destino = vi.fn()
    const { cajon } = montar({ alGmlDeEdificio: destino })

    // Primero una parcela de verdad: el cajón se abre y dice lo suyo.
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    expect(cajon.abierto()).toBe(true)

    // Y ahora el de edificio, que se va a otra rama.
    await soltarYEsperar(ficheroBu())

    expect(destino).toHaveBeenCalledTimes(1)
    // Sin este cierre, el usuario se quedaría mirando el cajón del fichero ANTERIOR
    // mientras la pantalla cambia de rama debajo.
    expect(cajon.abierto()).toBe(false)
  })

  it('SUELTA la comprobación: el informe de F09 no puede citar un edificio como fuente', async () => {
    const { cableado } = montar({ alGmlDeEdificio: vi.fn() })

    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    expect(cableado.comprobacion()).not.toBeNull()

    await soltarYEsperar(ficheroBu())

    // `comprobacion()` es lo que `cablearInforme` imprime bajo «lo que se leyó del
    // fichero». Dejar ahí la comprobación del GML de construcción haría que el
    // informe de contraste de una parcela citara como procedencia un edificio.
    expect(cableado.comprobacion()).toBeNull()
  })

  it('un GML de PARCELA no se desvía aunque el desvío esté puesto', async () => {
    const destino = vi.fn()
    const { cajon, cableado } = montar({ alGmlDeEdificio: destino })

    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))

    expect(destino).not.toHaveBeenCalled()
    expect(cajon.abierto()).toBe(true)
    expect(cableado.comprobacion()).not.toBeNull()
  })

  it('un desvío que revienta se cuenta por el panel, no se lo traga el `drop`', async () => {
    const destino = vi.fn(() => {
      throw new Error('el cableado de edificio ha explotado')
    })
    const { panel } = montar({ alGmlDeEdificio: destino })
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})

    await soltarYEsperar(ficheroBu())

    expect(destino).toHaveBeenCalledTimes(1)
    // El reparto de este módulo: al usuario el mensaje único de fallo interno, y el
    // detalle —con el NOMBRE del fichero y la causa— a la consola. Se comprueban las
    // dos mitades, porque una sin la otra es «no ha pasado nada».
    expect(mensajes(panel)).toContain(MENSAJE_FALLO_INESPERADO)
    expect(consola.mock.calls[0][0]).toMatch(/edificio\.gml/)
    expect(consola.mock.calls[0][1]).toBeInstanceOf(Error)
    consola.mockRestore()
  })

  it('`alGmlDeEdificio` que no es función LANZA al cablear (contrato del programador)', () => {
    expect(() => montar({ alGmlDeEdificio: 'sí, por favor' })).toThrow(TypeError)
    expect(() => montar({ alGmlDeEdificio: 'sí, por favor' })).toThrow(/alGmlDeEdificio/)
  })
})

// ── 9 · Los dos cajones de `bottomleft` no coinciden ─────────────────────────

describe('cableado-comprobacion · exclusión mutua de los dos cajones', () => {
  it('cualquier `estado.set` cierra el de comprobación, venga de donde venga', async () => {
    const { estado, cajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    expect(cajon.abierto()).toBe(true)

    // Un `set` que NO viene de este cableado (una parcela del Catastro, un `undo`).
    estado.set(null)
    expect(cajon.abierto()).toBe(false)
  })

  it('soltar un fichero cierra el de diagnóstico, que comparte la esquina', async () => {
    const { cajon, cajonDiagnostico } = montar({ conDiagnostico: true })
    cajonDiagnostico.abrir()
    expect(cajonDiagnostico.abierto()).toBe(true)

    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))

    expect(cajon.abierto()).toBe(true)
    expect(cajonDiagnostico.abierto()).toBe(false)
  })
})

// ── 10 · «Descartar» y `destruir()` ──────────────────────────────────────────

describe('cableado-comprobacion · las salidas', () => {
  it('«Descartar» cierra el cajón y SUELTA el fichero', async () => {
    const { cajon, cableado, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    expect(cableado.comprobacion()).not.toBeNull()

    raizCajon.querySelector(SELECTOR_CAJON.DESCARTAR).click()

    expect(cajon.abierto()).toBe(false)
    expect(cableado.comprobacion()).toBeNull()
    expect(botonContrastar(raizCajon).disabled).toBe(true)
  })

  it('`destruir()` retira los oyentes de la VENTANA: soltar después no hace nada', async () => {
    const { estado, cajon, cableado } = montar()
    cableado.destruir()

    const evento = soltar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await cederTurno()

    // Ni se cancela el evento (el navegador abriría el fichero, pero ya no es
    // nuestra pantalla), ni se pinta nada, ni se escribe en el store.
    expect(evento.defaultPrevented).toBe(false)
    expect(cajon.abierto()).toBe(false)
    expect(estado.set).not.toHaveBeenCalled()
  })

  it('`destruir()` es IDEMPOTENTE y suelta la suscripción al store', () => {
    const { estado, cableado } = montar()
    cableado.destruir()
    expect(() => cableado.destruir()).not.toThrow()
    expect(() => estado.set(null)).not.toThrow()
  })
})

// ── 11 · Lo que no es un GML ─────────────────────────────────────────────────

describe('cableado-comprobacion · entradas que no son un GML de parcela', () => {
  it('un fichero vacío no lanza: se comprueba, se dice y no entra nada en el store', async () => {
    const { estado, cajon, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto('', 'vacio.gml'))

    expect(cajon.abierto()).toBe(true)
    expect(botonContrastar(raizCajon).disabled).toBe(true)
    expect(estadoCajon(raizCajon).length).toBeGreaterThan(0)
    expect(estado.set).not.toHaveBeenCalled()
  })

  it('un fichero cuyos bytes no se pueden leer se cuenta por el panel, no por la excepción', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { estado, panel } = montar()

    const roto = ficheroDeTexto('<x/>', 'roto.gml')
    roto.arrayBuffer = () => Promise.reject(new Error('la unidad se ha desconectado'))

    expect(() => soltar(roto)).not.toThrow()
    await cederTurno()

    expect(mensajes(panel).join(' | ')).toMatch(/no se ha podido leer el contenido del fichero/i)
    expect(estado.set).not.toHaveBeenCalled()
    expect(consola).toHaveBeenCalled()
  })

  it('un fallo INESPERADO de la composición se cuenta con su mensaje, sin dejar la pantalla muda', async () => {
    const consola = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { estado, panel, cajon, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))

    // Se rompe el store justo antes de escribir: es el hueco por el que puede
    // colarse un defecto de programación después de una consulta correcta.
    estado.set.mockImplementation(() => {
      throw new Error('el store ha reventado')
    })
    await contrastar(raizCajon)

    expect(mensajes(panel)).toContain(MENSAJE_FALLO_INESPERADO)
    expect(estadoCajon(raizCajon)).toMatch(/panel de avisos/i)
    expect(cajon.abierto()).toBe(true)
    expect(consola).toHaveBeenCalled()
  })
})

/* ── 12 · El campo «Referencia catastral» dice lo mismo que el modelo ─────────
 *
 * EL DEFECTO que esta sección ata, medido a mano sobre la app publicada: al cargar
 * un GML la referencia entraba en el MODELO pero no llegaba al campo del panel. Y
 * como «Deducir del mapa» y «Traer colindantes» se encienden mirando el STORE
 * (`cableado-catastro.js#refrescar`, suscriptor de `estado.subscribe`), quedaban
 * ENCENDIDOS con el campo vacío: la pantalla se contradecía a sí misma, con el botón
 * diciendo «hay referencia» y el campo diciendo que no.
 *
 * ── LA DECISIÓN, Y POR QUÉ NO ES LA MISMA QUE LA DE LA VÍA DEL CATASTRO ──
 * Sin referencia utilizable el campo **se VACÍA**; no se deja como estaba. En
 * `cableado-catastro.js#aplicar` es al revés (`if (parcela.refcat !== null)`) y las
 * dos decisiones son correctas porque el campo significa cosas distintas en cada
 * vía: allí es lo que el usuario ha TECLEADO para buscar, y borrárselo sería
 * quitarle de las manos lo que estaba intentando; aquí no hay nada tecleado que
 * respetar —manda el fichero—, y lo único que podría quedar ahí es la referencia de
 * una carga ANTERIOR. Eso sería peor que el hueco: el campo hablaría de una parcela
 * que ya no está en pantalla, y además reproduciría la contradicción del defecto del
 * revés (una referencia perfectamente escrita al lado de «Deducir del mapa»
 * encendido, que es el botón que promete que no hace falta escribirla).
 * ------------------------------------------------------------------------- */

describe('cableado-comprobacion · el campo de la referencia catastral', () => {
  it('reutiliza el selector que YA exporta `cableado-catastro.js`; no copia el literal', () => {
    // Hay UN campo porque hay UNA parcela cargada, y dos vías distintas de traerla.
    // Dos literales serían dos contratos con `index.html` que pueden divergir.
    expect(CAMPO_REEXPORTADO).toBe(SELECTOR_CAMPO_REFCAT)
    expect(document.querySelectorAll(SELECTOR_CAMPO_REFCAT)).toHaveLength(1)
  })

  it('un GML con referencia deja el campo con la forma CANÓNICA, no con la del fichero', async () => {
    const { estado, campo, raizCajon } = montar()
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_REFCAT_CRUDA, 'con-refcat-cruda.gml'))
    await contrastar(raizCajon)

    // La que ha entrado en el MODELO, letra por letra.
    expect(estado.get().refcat).toBe(REFCAT)
    expect(campo.value).toBe(REFCAT)
    // Y no la cadena del fichero: «9398516 vk3799g» y «9398516VK3799G» son la misma
    // parcela, y dejar en pantalla una forma distinta de la del modelo invita a
    // dudar de cuál de las dos se ha cargado (precedente de `cableado-catastro.js`).
    expect(campo.value).not.toBe(REFCAT_CRUDA)
  })

  it('la prueba NO es vacua: el fichero declara la referencia en OTRA forma', () => {
    // Sin esto, el test de arriba pasaría con un cableado que copiara la cadena
    // cruda: las dos formas serían la misma y no habría nada que distinguir.
    expect(REFCAT_CRUDA).not.toBe(REFCAT)
    expect(TEXTO_FICHERO_REFCAT_CRUDA).not.toBe(TEXTO_FICHERO_MOVIDO)
    expect(parsearGml(TEXTO_FICHERO_REFCAT_CRUDA).parcelas[0].refcat).toBe(REFCAT_CRUDA)
  })

  it.each(['UTM_1.gml', 'cp_ejemplo_explicativo.gml'])(
    '%s trae la referencia PRESENTE y VACÍA: el campo se VACÍA, no se deja como estaba',
    async (fixture) => {
      // Los dos son ALTAS y traen `cp:nationalCadastralReference` presente y con
      // `''` dentro (medido; ver la cabecera del módulo). O sea: `refcat` no es solo
      // `null`. Lo que se vacía aquí es lo que hubiera escrito una carga anterior —
      // dejarlo sería que el campo hablara de una parcela que ya no está en pantalla.
      const { estado, campo, raizCajon } = montar()
      campo.value = 'DE LA PARCELA ANTERIOR'

      await soltarYEsperar(ficheroDeBytes(leerBytes(...GML(fixture)), fixture))
      await contrastar(raizCajon)

      expect(estado.get().refcat).toBeNull()
      expect(campo.value).toBe('')
    },
  )

  it('cargar una parcela y luego OTRA no deja en el campo la referencia de la primera', async () => {
    const { estado, campo, raizCajon } = montar()

    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'primera.gml'))
    await contrastar(raizCajon)
    expect(campo.value).toBe(REFCAT)

    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('UTM_1.gml')), 'UTM_1.gml'))
    await contrastar(raizCajon)

    // La parcela de pantalla es OTRA: la del alta, que no tiene referencia.
    expect(estado.get().idLocal).toBe('8703362TF9980S0001SH')
    expect(estado.get().refcat).toBeNull()
    expect(campo.value).toBe('')
  })

  it('escribir el campo es PINTAR, no consultar: no dispara ninguna petición', async () => {
    const { cliente, transporte, campo, raizCajon } = montar()
    const espia = vi.spyOn(cliente, 'parcelaPorRefcat')

    // Una carga CON referencia: una sola consulta, la del parcelario.
    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'primera.gml'))
    await contrastar(raizCajon)
    expect(campo.value).toBe(REFCAT)
    expect(espia).toHaveBeenCalledTimes(1)

    // Y otra SIN: el campo se REESCRIBE (se vacía) y nadie vuelve a preguntar nada.
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('UTM_1.gml')), 'UTM_1.gml'))
    await contrastar(raizCajon)

    expect(campo.value).toBe('')
    expect(espia).toHaveBeenCalledTimes(1)
    expect(transporte.peticiones).toHaveLength(1)
  })

  it('EL DEFECTO: con referencia, el campo y los botones derivados dicen lo MISMO', async () => {
    const { estado, campo, botonDeducir, botonColindantes, raizCajon } = montar({
      conCatastro: true,
    })

    // De partida no hay parcela: nada que deducir y nadie a quien pedir vecinas.
    expect(campo.value).toBe('')
    expect(botonDeducir.disabled).toBe(true)
    expect(botonColindantes.disabled).toBe(true)

    await soltarYEsperar(ficheroDeTexto(TEXTO_FICHERO_MOVIDO, 'de-otro-despacho.gml'))
    await contrastar(raizCajon)

    expect(estado.get().refcat).toBe(REFCAT)
    // Las tres superficies afirman lo mismo: hay referencia.
    expect(campo.value).toBe(REFCAT)
    expect(botonColindantes.disabled).toBe(false)
    // Y «Deducir del mapa» apagado, que es la otra cara de la misma afirmación: con
    // referencia no hay nada que deducir.
    expect(botonDeducir.disabled).toBe(true)
  })

  it('EL DEFECTO, del otro lado: sin referencia, campo vacío Y botón apagado', async () => {
    // La comprobación que hace que la de arriba no sea media prueba: un cableado que
    // escribiera el campo SIEMPRE (con la cadena cruda, o con la anterior) pasaría
    // aquella y fallaría ésta.
    const { estado, campo, botonDeducir, botonColindantes, raizCajon } = montar({
      conCatastro: true,
    })
    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('UTM_1.gml')), 'UTM_1.gml'))
    await contrastar(raizCajon)

    expect(estado.get().refcat).toBeNull()
    expect(campo.value).toBe('')
    expect(botonColindantes.disabled).toBe(true)
    // Y «Deducir del mapa» ENCENDIDO: hay geometría y no hay referencia, que es
    // exactamente lo que el campo vacío está diciendo. No hay contradicción.
    expect(botonDeducir.disabled).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// F10 · T5.1 · las entradas AJENAS de la única zona de fichero
//
// F10 necesita meter un `.json` por la misma puerta, y lo que NO se puede hacer es
// instanciar una segunda `crearZonaFichero`: engancha `dragenter`/`dragover`/
// `dragleave`/`drop` en la VENTANA ENTERA, así que dos zonas vivas cancelarían las
// dos el mismo `drop` y entregarían el mismo fichero a dos destinos. Se prueba el
// ENRUTADO, que es lo único que este módulo aporta a aquello.
// ══════════════════════════════════════════════════════════════════════════════
describe('F08 · T5.1 (ampliado en F10) · entradas ajenas por extensión', () => {
  /** Una entrada ajena que solo apunta lo que le llega. */
  function entradaEspia(extensiones = ['.json']) {
    const recibidos = []
    return { recibidos, entrada: { extensiones, alFichero: (f) => recibidos.push(f.name) } }
  }

  it('un fichero de una extensión ajena va a su destino y NO se comprueba como GML', async () => {
    const { recibidos, entrada } = entradaEspia()
    const { cajon } = montar({ entradasExtra: [entrada] })
    const pintar = vi.spyOn(cajon, 'pintar')

    await soltarYEsperar(ficheroDeTexto('{"formato":"concreta-gml/proyecto"}', 'p.json'))

    expect(recibidos).toEqual(['p.json'])
    // Anti-vacuidad de la mitad negativa: el cajón de comprobación ni se entera.
    expect(pintar).not.toHaveBeenCalled()
  })

  it('…y un `.gml` sigue yendo al recorrido de siempre', async () => {
    const { recibidos, entrada } = entradaEspia()
    const { cajon } = montar({ entradasExtra: [entrada] })
    const pintar = vi.spyOn(cajon, 'pintar')

    await soltarYEsperar(ficheroDeBytes(leerBytes(...GML('UTM_1.gml')), 'UTM_1.gml'))

    expect(recibidos).toEqual([])
    // El cajón de comprobación SÍ se pinta: el fichero ha hecho el recorrido entero.
    expect(pintar).toHaveBeenCalled()
  })

  it('el enrutado NO distingue mayúsculas, como el resto de la zona', async () => {
    const { recibidos, entrada } = entradaEspia()
    montar({ entradasExtra: [entrada] })
    await soltarYEsperar(ficheroDeTexto('{}', 'PROYECTO.JSON'))
    expect(recibidos).toEqual(['PROYECTO.JSON'])
  })

  it('la extensión ajena entra en el `accept` del input y en el texto del velo', () => {
    const { entrada } = entradaEspia()
    montar({ entradasExtra: [entrada] })

    const input = document.querySelector(`.${CLASE_INPUT}`)
    expect(input.accept).toBe('.gml,.xml,.json')
    const velo = document.querySelector('.gml-soltar-superposicion-texto')
    expect(velo.textContent).toContain('.json')
  })

  it('⚠️ una extensión ya tomada por el GML NO se puede secuestrar', () => {
    expect(() => montar({ entradasExtra: [{ extensiones: ['.gml'], alFichero: () => {} }] })).toThrow(
      /ya está tomada/,
    )
  })

  it('dos entradas que se peleen por la misma extensión revientan al cablear', () => {
    expect(() =>
      montar({
        entradasExtra: [
          { extensiones: ['.json'], alFichero: () => {} },
          { extensiones: ['.json'], alFichero: () => {} },
        ],
      }),
    ).toThrow(/ya está tomada/)
  })

  it('una entrada mal escrita revienta nombrando su índice, no en el primer fichero', () => {
    expect(() => montar({ entradasExtra: [{ extensiones: ['json'], alFichero: () => {} }] })).toThrow(
      /entradasExtra\[0\]/,
    )
    expect(() => montar({ entradasExtra: [{ extensiones: ['.json'], alFichero: 'no' }] })).toThrow(
      /entradasExtra\[0\]\.alFichero/,
    )
  })

  it('un destino ajeno que revienta se cuenta por el panel, no se pierde', async () => {
    const { panel } = montar({
      entradasExtra: [
        {
          extensiones: ['.json'],
          alFichero: () => {
            throw new Error('boom')
          },
        },
      ],
    })
    await soltarYEsperar(ficheroDeTexto('{}', 'p.json'))
    expect(panel.avisar).toHaveBeenCalled()
  })

  it('`elegirFichero()` abre el selector de ESTA zona y de ninguna otra', () => {
    const { cableado } = montar()
    const input = document.querySelector(`.${CLASE_INPUT}`)
    const clic = vi.spyOn(input, 'click').mockImplementation(() => {})
    cableado.elegirFichero()
    expect(clic).toHaveBeenCalledTimes(1)
    // Y después de destruir no abre nada: un selector cuyo `change` no escucha nadie
    // es un gesto que no lleva a ninguna parte.
    cableado.destruir()
    cableado.elegirFichero()
    expect(clic).toHaveBeenCalledTimes(1)
  })
})

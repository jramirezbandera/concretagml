/* -------------------------------------------------------------------------- *
 * test/comprobacion/aceptacion-f08.dom.test.js — F08 · T6.1 · SUITE DE ACEPTACIÓN *
 *                                                                              *
 * La prueba que decide si F08 está hecha. Los CUATRO criterios de              *
 * `spec/feature-08-comprobar-gml.md` § «Criterios de aceptación», uno a uno y   *
 * con su texto LITERAL en el nombre del `describe`:                             *
 *                                                                              *
 *   AC1 · «Un `.gml` de parcela válido se parsea y llega al diagnóstico sin    *
 *         pasar por edición ni generación.»                                    *
 *   AC2 · «Un GML con varias parcelas ofrece elegir; uno con SRS inesperado o  *
 *         coords fuera de huso lo indica como nota, no como fallo.»            *
 *   AC3 · «La acción principal del diagnóstico por esta vía es "Descargar      *
 *         informe de contraste".»                                              *
 *   AC4 · «Un GML de edificio se encamina al contraste de construcción (F14),  *
 *         no al de lindero.»  ⚠️ SE CUMPLE A MEDIAS — ver § 7.                  *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LAS CUATRO REGLAS QUE GOBIERNAN ESTE FICHERO                                 *
 * ════════════════════════════════════════════════════════════════════════════ *
 * 1. **POR LA PANTALLA, Y CON FICHEROS DE VERDAD.** Nada se afirma llamando a  *
 *    `comprobarGml`: se monta la cáscara REAL de `index.html`, un `L.Map` de   *
 *    verdad con los dos cajones y la capa de contraste, los dos cableados de   *
 *    producción, y **se SUELTA el fichero sobre la ventana** (evento `drop`    *
 *    con un `File` dentro). Ése es el camino del usuario. Lo único doblado es  *
 *    el transporte HTTP —jsdom no toca al Catastro jamás— y el `url`/          *
 *    `documento` de la entrega, que es de donde se AGARRA el Blob.             *
 * 2. **LOS FICHEROS SON LOS DEL REPO.** Los reales (`test/fixtures/gml/`) y    *
 *    los derivados con procedencia escrita (`test/fixtures/gml/derivados/`).   *
 *    Ni un GML inventado en el propio test: un fixture sin procedencia es una  *
 *    opinión con formato de dato, y este proyecto ya pagó un rechazo del IVG   *
 *    por derivar del fichero equivocado (SPEC §3.1).                           *
 *      ⚠️ El único fichero con REFERENCIA CATASTRAL de verdad es la descarga   *
 *      del WFS. La plantilla oficial y el CP 3.0 la traen presente y VACÍA     *
 *      (`''`, medido en T2.1), porque son altas. El recorrido completo —con    *
 *      parcelario traído y CTA encendido— solo se puede ver con la primera.    *
 * 3. **NO SE DUPLICAN LAS UNITARIAS.** Cada `it` cita la frase del criterio a  *
 *    la que está atado. Lo que ya afirma un test de módulo se REMITE:          *
 *      · los bytes y la mentira del encoding → `test/gml/decodificar.test.js`; *
 *      · la comprobación caso a caso, C1–C4 → `test/comprobacion/gml.test.js`; *
 *      · el cajón nodo a nodo → `test/viewer/cajon-comprobacion.dom.test.js`;  *
 *      · el arrastre, el velo y el `input` → `test/app/zona-fichero.dom.test.js`; *
 *      · el cable (un solo `estado.set`, la geometría que NO se sustituye, el  *
 *        fallo de red, la exclusión de los dos cajones) →                      *
 *        `test/app/comprobacion.dom.test.js`;                                  *
 *      · el ensamblaje del paso 9 → `test/app/main-comprobacion.dom.test.js`;  *
 *      · el informe párrafo a párrafo → `test/report/contraste-texto.test.js`. *
 * 4. **CADA GUARDIÁN, CON SU PRUEBA DE QUE DISPARA.** Es la disciplina de      *
 *    `test/gml/aceptacion-f04.test.js`: un guardián que nunca se ha visto en   *
 *    rojo es una promesa, no una prueba. Los tres frentes del § 9 se mutan y   *
 *    se exige que salten.                                                      *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * EL GUARDIÁN DE LA REGLA DE ORO 9, EN TRES FRENTES MECÁNICOS (§ 9)            *
 * ════════════════════════════════════════════════════════════════════════════ *
 *   1/3 · `config/umbrales.json` NO EXISTE — `existsSync` sobre la ruta real,  *
 *         con anti-vacuidad: la misma resolución SÍ encuentra                  *
 *         `config/operativos.json`.                                            *
 *   2/3 · NINGUNA clave de veredicto, ni en los EXPORTS de `comprobacion/` y   *
 *         `report/`, ni —recorrido RECURSIVO— en el objeto REAL que devuelve   *
 *         `comprobarGml` sobre los nueve ficheros del repo. Nada de listas     *
 *         escritas a mano: se recorre lo que hay.                              *
 *   3/3 · EL DOM DEL CAJÓN PINTADO por el recorrido de verdad: ni palabra de   *
 *         mérito en el vocabulario PROPIO, ni clase CSS de mérito en ningún    *
 *         nodo.                                                                *
 *                                                                              *
 * `puedeContinuar` es la **ÚNICA excepción**, nombrada explícitamente: es      *
 * CAPACIDAD DE LA APLICACIÓN («yo no puedo seguir»), no mérito de la parcela   *
 * («tu parcela está mal»). Precedente literal: el gate `puedeGenerar` de F02.  *
 * El `puede` del patrón lo añadió T2.1 al medir que sin él la «única           *
 * excepción» era decorativa: el patrón original no cazaba `puedeContinuar`,    *
 * así que tampoco habría cazado un `puedeGenerar` o un `puedeSubir` colándose. *
 *                                                                              *
 * ⚠️ **LO QUE EL GUARDIÁN NO PUEDE HACER, Y ESTÁ MEDIDO (T2.2 y T3.1).**       *
 * No se puede aplicar al texto completo de un informe ni al DOM entero de un   *
 * cajón. Sobre el recorrido REAL, `gml/decodificar.js` escribe «…sin una sola  *
 * secuencia **inválida**» y «El texto es **correcto**; lo que está mal es la   *
 * declaración del fichero» —habla de BYTES—, y `validation/parcela.js` emite   *
 * «no es un contorno EXTERIOR **válido**» —hecho estructural—. Los dos son     *
 * legítimos y se imprimen LITERALES por la regla de oro 1: reescribirlos       *
 * crearía una segunda redacción que diverge de la del módulo que lo sabe. El   *
 * guardián vigila **el vocabulario que cada módulo escribe**, no el texto que  *
 * atraviesa desde capas inferiores; el criterio de despojado es el que ya      *
 * resolvió `test/viewer/cajon-comprobacion.dom.test.js` y aquí se REUTILIZA.   *
 * Un guardián sobre el documento entero sería rojo permanente, y uno que se    *
 * apaga para no molestar es exactamente lo que costó el rechazo del IVG        *
 * (SPEC §3.1). El § 10 deja ese paso a través documentado y demuestra que,     *
 * retirado el pasaje ajeno, lo propio queda limpio.                            *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * DOS TRAMPAS DE ENTORNO, LAS DOS MEDIDAS ANTES DE ESTA TAREA                  *
 * ════════════════════════════════════════════════════════════════════════════ *
 *  1. `readFileSync` devuelve un `Buffer` del realm de Node, y bajo jsdom el   *
 *     `instanceof Uint8Array` de `gml/decodificar.js` da `false` sobre él: el  *
 *     `Uint8Array` global es el de la ventana, que es otro realm. Los bytes de *
 *     un fixture pasan SIEMPRE por `Uint8Array.from(...)`.                     *
 *  2. jsdom no implementa `DataTransfer` ni `DragEvent`: el `drop` se fabrica  *
 *     con `Event` + un doble de `dataTransfer`, igual que en las suites de     *
 *     T3.2 y T4.1.                                                             *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom + Leaflet real, arnés `_ayuda-jsdom.js`).       *
 * -------------------------------------------------------------------------- */

import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { crearDialogoAvisos } from '../../app/dialogo-avisos.js'
import {
  SELECTOR_PROCEDENCIA,
  cablearComprobacion,
} from '../../app/cableado-comprobacion.js'
import {
  EXTENSION_INFORME,
  MOTIVO_SIN_OFICIAL,
  PREFIJO_INFORME,
  SELECTOR_BOTON_DIAGNOSTICAR,
  SELECTOR_ESTADO_DIAGNOSTICO,
  cablearDiagnostico,
  nombreFicheroInforme,
} from '../../app/cableado-diagnostico.js'
import * as comprobacionComun from '../../comprobacion/_comun.js'
import * as comprobacionGml from '../../comprobacion/gml.js'
import { comprobarGml } from '../../comprobacion/gml.js'
import { decodificarGml } from '../../gml/decodificar.js'
import { descargarTexto } from '../../gml/descargar.js'
import { parsearGml } from '../../gml/parse.js'
import { ORIGEN_PARCELA } from '../../model/parcela.js'
import * as reportContraste from '../../report/contraste-texto.js'
import { crearClienteCatastro } from '../../services/catastro.js'
import { crearEstadoVista } from '../../viewer/_comun.js'
import {
  MOTIVO_INFORME_SIN_DIAGNOSTICO,
  SELECTOR as SELECTOR_DIAG,
  crearCajonDiagnostico,
} from '../../viewer/cajon-diagnostico.js'
import {
  SELECTOR as SELECTOR_COMP,
  SELECTOR_MIEMBRO,
  crearCajonComprobacion,
} from '../../viewer/cajon-comprobacion.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Los ficheros del repo, y la cáscara real
// ═════════════════════════════════════════════════════════════════════════════

const RAIZ = join(import.meta.dirname, '..', '..')
const leerTexto = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')
/** ⚠️ Trampa 1 de la cabecera: `Uint8Array.from`, nunca el `Buffer` a pelo. */
const leerBytes = (...ruta) => Uint8Array.from(readFileSync(join(RAIZ, ...ruta)))

const GML = (nombre) => ['test', 'fixtures', 'gml', nombre]
const DERIVADO = (nombre) => ['test', 'fixtures', 'gml', 'derivados', nombre]

/** El ÚNICO fixture con referencia catastral real: la descarga del WFS (T4.1). */
const WFS = 'cp_parcela_9398516VK3799G.gml'
/** La plantilla oficial de ALTA: su `nationalCadastralReference` viene VACÍA. */
const PLANTILLA = 'cp_ejemplo_explicativo.gml'
/** El CP 3.0 de 2015: dialecto rechazado (ERROR) y la parcela se lee igual. */
const TRESCERO = 'UTM_1.gml'
/** Los dos GML de EDIFICIO: el caso del AC4. */
const EDIFICIO = 'bu_building_9398516VK3799G.gml'
const EDIFICIO_PARTE = 'bu_buildingpart_9398516VK3799G.gml'
/** Derivados con `PROCEDENCIA.md`: tres parcelas, EPSG:4326 y huso mentido. */
const MULTI = 'derivados/cp_multiparcela_entrega.gml'
const SRS_MALO = 'derivados/cp_srs_no_soportado.gml'
const HUSO_MALO = 'derivados/cp_huso_incoherente.gml'
const AREA_MALA = 'derivados/cp_area_discrepante.gml'

/** Los nueve, para los invariantes que valen para TODOS. */
const TODOS = [
  WFS,
  PLANTILLA,
  TRESCERO,
  EDIFICIO,
  EDIFICIO_PARTE,
  MULTI,
  SRS_MALO,
  HUSO_MALO,
  AREA_MALA,
]

const rutaDe = (nombre) =>
  nombre.startsWith('derivados/') ? DERIVADO(nombre.slice('derivados/'.length)) : GML(nombre)

const bytesDe = (nombre) => leerBytes(...rutaDe(nombre))
const nombreCorto = (nombre) => nombre.split('/').pop()

/** La respuesta REAL del WFS: lo que contesta el Catastro al pedir el parcelario. */
const TEXTO_WFS = leerTexto(...GML(WFS))
const PARCELA_WFS = parsearGml(TEXTO_WFS).parcelas[0]
const REFCAT = PARCELA_WFS.refcat
/** `GetNeighbourParcel` real: 5 miembros para 4 colindantes, con la propia (O15). */
const TEXTO_VECINDAD = leerTexto('test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml')
const VECINDAD = parsearGml(TEXTO_VECINDAD).parcelas

const SRS = 'EPSG:25830'
const HUSO = 30

/**
 * El instante del informe, FIJO. `report/contraste-texto.js` no consulta el reloj
 * por contrato (un snapshot tiene que valer lo mismo dentro de un año), y poder
 * fijarlo es lo único que permite afirmar algo exacto sobre la cabecera Y sobre el
 * nombre del fichero a la vez.
 */
const FECHA_INFORME = new Date(Date.UTC(2026, 6, 30, 11, 45, 30))

/** La cáscara REAL: el marcado es contrato y una copia a mano se quedaría vieja. */
const CUERPO_INDEX = (() => {
  const html = leerTexto('index.html')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'aceptacion-f08: no se ha encontrado el <body> de index.html. La cáscara se lee del ' +
        'fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

/**
 * La comprobación PURA de un fichero, para usarla como ORÁCULO de lo que la
 * pantalla tiene que estar enseñando. No sustituye al recorrido: se compara contra
 * él.
 */
function comprobarFixture(nombre, extra = {}) {
  const bytes = bytesDe(nombre)
  const { texto, detecciones, encodingUsado } = decodificarGml(bytes)
  return comprobarGml({
    texto,
    nombreFichero: nombreCorto(nombre),
    bytes: bytes.byteLength,
    deteccionesPrevias: detecciones,
    encodingUsado,
    ...extra,
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El banco integrado: cáscara + mapa + los dos cajones + los dos cableados
// ═════════════════════════════════════════════════════════════════════════════

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

/**
 * Transporte doble. No conoce `fetch`: es IMPOSIBLE que esta suite toque la red, y
 * `peticiones` es además el espía con el que se afirma que no se pide nada hasta
 * que el usuario pulsa (régimen del override O8).
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

/**
 * Doble LIGERO del cableado de F05 para las colindantes del diagnóstico, calcado
 * del de `test/diagnostico/aceptacion-f07.dom.test.js`: publica ANTES de devolver y
 * cede el turno antes de publicar, que es lo que hace el `colindantes()` real al
 * pasar por la caché asíncrona.
 */
function crearCatastroDoble() {
  const suscriptores = new Set()
  return {
    async colindantes() {
      await Promise.resolve()
      const resultado = {
        ok: true,
        datos: { propia: null, colindantes: VECINDAD.filter((p) => p.refcat !== REFCAT) },
        motivo: null,
        mensaje: null,
        procedencia: {},
      }
      for (const fn of suscriptores) fn(resultado)
      return resultado
    },
    alColindantes(fn) {
      suscriptores.add(fn)
      return () => suscriptores.delete(fn)
    },
  }
}

/**
 * El entorno de la ENTREGA, espiado. Mismo par de dobles que `test/app/
 * diagnostico.dom.test.js`, y por lo mismo:
 *
 *   · `url` es lo único desde donde se puede AGARRAR el Blob, que es donde están
 *     los bytes de verdad (el AC3 exige comprobar que no baja un fichero vacío).
 *   · el `click()` de jsdom sobre un `<a href="blob:…">` intenta NAVEGAR y escupe
 *     un «Not implemented: navigation»; se sustituye solo él.
 *
 * La descarga que se ejercita es la REAL (`gml/descargar.js#descargarTexto`): un
 * doble de la entrega dejaría sin comprobar justo lo que hay que comprobar.
 */
function crearEntregaEspia() {
  const creados = []
  const anclas = []
  const url = {
    createObjectURL(blob) {
      const href = `blob:https://concreta.test/${creados.length}`
      creados.push({ blob, href })
      return href
    },
    revokeObjectURL() {},
  }
  const documento = {
    body: document.body,
    createElement(etiqueta) {
      const el = document.createElement(etiqueta)
      if (etiqueta === 'a') {
        anclas.push(el)
        el.click = () => {}
      }
      return el
    },
  }
  return {
    creados,
    anclas,
    descargar: (texto, opciones) => descargarTexto(texto, { ...opciones, documento, url }),
    /** El último Blob entregado, decodificado desde los BYTES. */
    async ultimoTexto() {
      if (creados.length === 0) return null
      return creados[creados.length - 1].blob.text()
    },
  }
}

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
 * La pantalla de F08 entera: store, panel, los dos cajones de `bottomleft`, la capa
 * de contraste, el cliente del Catastro sobre el transporte doble, y los dos
 * cableados de producción enlazados como los enlaza `app/main.js` (pasos 8 y 9).
 *
 * **Lo que NO se monta es tan importante como lo que sí**: aquí no hay
 * `cablearEdicion` ni `cablearGeneracionGml`. Que el recorrido del AC1 llegue al
 * diagnóstico con solo estas dos piezas es la mitad estructural de «sin pasar por
 * edición ni generación»; la mitad observable va en el § 4.
 */
function montar({ responder, conVecinas = true } = {}) {
  const { mapa, destruir: destruirMapa } = montarMapa({ zoom: 19 })
  crearPanes(mapa)

  const estado = crearEstadoVista(null)
  vi.spyOn(estado, 'set')

  const panel = crearDialogoAvisos({ documento: document })
  // ⭐ Espiado desde el 2026-08-07 y **sin doblarlo**: `vi.spyOn` llama al original,
  // así que el diálogo real sigue pintando. Hace falta porque las notas y los
  // bloqueos del fichero salen ahora por aquí en vez de por el cajón, y varios `it`
  // de esta suite tienen que poder leer lo que se publicó.
  vi.spyOn(panel, 'avisar')

  const transporte = crearTransporteDoble(responder)
  const cliente = crearClienteCatastro({ transporte, srs: SRS })

  const cajonComprobacion = crearCajonComprobacion({ mapa })
  const cajonDiagnostico = crearCajonDiagnostico({ mapa })
  const contraste = crearContraste({ mapa, zona: HUSO })

  const comprobacion = cablearComprobacion({
    estado,
    cajon: cajonComprobacion,
    panel,
    cliente,
    srs: SRS,
    cajonDiagnostico,
    ventana: window,
    ahora: () => FECHA_INFORME,
  })

  const entrega = crearEntregaEspia()
  const diagnostico = cablearDiagnostico({
    estado,
    cajon: cajonDiagnostico,
    contraste,
    panel,
    catastro: conVecinas ? crearCatastroDoble() : null,
    // El envoltorio de `app/main.js`: la comprobación CAMBIA con el tiempo, así que
    // se pasa la función y no el valor.
    comprobacion: () => comprobacion.comprobacion(),
    ahora: () => FECHA_INFORME,
    descargar: entrega.descargar,
  })

  pendientes.push(() => {
    diagnostico.destruir()
    comprobacion.destruir()
    contraste.destruir()
    cajonDiagnostico.destruir()
    cajonComprobacion.destruir()
    destruirMapa()
  })

  const raizComp = cajonComprobacion.control.getContainer()
  const raizDiag = cajonDiagnostico.control.getContainer()

  return {
    mapa,
    estado,
    panel,
    transporte,
    entrega,
    comprobacion,
    cajonComprobacion,
    cajonDiagnostico,
    raizComp,
    raizDiag,
    procedencia: document.querySelector(SELECTOR_PROCEDENCIA),
    ctaDiagnosticar: document.querySelector(SELECTOR_BOTON_DIAGNOSTICAR),
    renglonDiagnosticar: document.querySelector(SELECTOR_ESTADO_DIAGNOSTICO),
    botonContrastar: raizComp.querySelector(SELECTOR_COMP.CONTRASTAR),
    diagnostico,
    botonInforme: raizDiag.querySelector(SELECTOR_DIAG.PREPARAR),
    renglonInforme: raizDiag.querySelector(SELECTOR_DIAG.ESTADO_INFORME),
  }
}

// ── El gesto del usuario ─────────────────────────────────────────────────────

/** `FileList` de mentira: array-like, como la de verdad (sin métodos de Array). */
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

/** Cede el turno al bucle de microtareas (lectura del fichero, red doblada…). */
async function cederTurno(veces = 40) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

/** Suelta un fixture del repo y espera a que el recorrido de lectura termine. */
async function soltarFixture(nombre) {
  soltar(new File([bytesDe(nombre)], nombreCorto(nombre), { type: '' }))
  await cederTurno()
}

const texto = (raiz, selector) => raiz.querySelector(selector).textContent

/**
 * Un texto con TODOS sus blancos colapsados en un espacio.
 *
 * No es cosmética: el informe de contraste va justificado a 78 columnas y parte los
 * mensajes largos por donde le toca, así que una frase de un módulo de abajo llega
 * repartida en tres líneas con su sangría. Buscarla literal daría un «no está»
 * falso. Se aplana los dos lados y se comparan párrafos reflowados con su original.
 */
const aplanar = (t) => t.replace(/\s+/g, ' ')

// ═════════════════════════════════════════════════════════════════════════════
// 3 · Anti-vacuidad: los ficheros traen EXACTAMENTE los casos que hacen falta
// ═════════════════════════════════════════════════════════════════════════════
//
// Sin esta sección, media suite podría estar pasando sobre ficheros que no
// contienen el caso que dicen contener — que es la clase de fixture que el
// directorio `derivados/` existe para impedir (SPEC §3.1).

describe('F08 · aceptación · los ficheros sobre los que se acepta traen su caso', () => {
  it('el ÚNICO fixture con referencia catastral real es la descarga del WFS', () => {
    // ⛔ MEDIDO en T2.1 y T4.1: la plantilla oficial y el CP 3.0 traen el elemento
    // `cp:nationalCadastralReference` PRESENTE y VACÍO (`''`), porque son altas. Sin
    // esto, el AC1 podría escribirse con la plantilla y el recorrido «llega al
    // diagnóstico» sería imposible: no habría parcelario que pedir.
    expect(comprobarFixture(WFS).miembros[0].refcat).toBe('9398516VK3799G')
    expect(comprobarFixture(PLANTILLA).miembros[0].refcat).toBe('')
    expect(comprobarFixture(TRESCERO).miembros[0].refcat).toBe('')
  })

  it('el multiparcela trae TRES parcelas de verdad, y el resto una o ninguna', () => {
    expect(comprobarFixture(MULTI).miembros).toHaveLength(3)
    expect(comprobarFixture(WFS).miembros).toHaveLength(1)
    // El edificio no trae NINGUNA: es el AC4.
    expect(comprobarFixture(EDIFICIO).miembros).toEqual([])
  })

  it('el de huso incoherente declara 25829 sobre coordenadas de huso 30, y se nota', () => {
    // ⛔ CORREGIDO AL MEDIRLO en T1.2: con 25831 esas coordenadas caen DENTRO del
    // BBOX de España y el fichero habría prometido un caso que no contiene. Con
    // 25829 la longitud se va a −9,72° y salen los 15 vértices fuera.
    const c = comprobarFixture(HUSO_MALO)
    expect(c.miembros[0].srs).toBe('EPSG:25829')
    const nota = c.notas.find((d) => d.tipo === 'HUSO_FUERA_DE_RANGO')
    expect(nota, 'el fixture no produce el hallazgo de huso que promete').toBeDefined()
    expect(nota.datos.nFuera).toBe(15)
  })

  it('el de SRS no soportado NO declara ninguno de los tres husos peninsulares', () => {
    const c = comprobarFixture(SRS_MALO)
    expect(c.miembros[0].srs).toBeNull()
    expect(c.puedeContinuar).toBe(false)
  })

  it('los nueve ficheros se comprueban sin lanzar, que es la premisa de todo lo demás', () => {
    for (const nombre of TODOS) {
      expect(() => comprobarFixture(nombre), `${nombre} lanza al comprobarse`).not.toThrow()
    }
    expect(TODOS.length, 'la lista de ficheros está vacía: el recorrido sería vacuo').toBe(9)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · AC1 · «Un `.gml` de parcela válido se parsea y llega al diagnóstico sin
//           pasar por edición ni generación.»
// ═════════════════════════════════════════════════════════════════════════════

describe('F08 · AC1 · un .gml de parcela válido se parsea y llega al diagnóstico sin pasar por edición ni generación', () => {
  it('⭐ «se parsea»: soltarlo sobre la ventana lo CARGA, sin cajón y sin confirmar', async () => {
    // ⛔ **ESTE `it` AFIRMABA LO CONTRARIO HASTA EL 2026-08-07.** Exigía
    // `cajonComprobacion.abierto() === true`, las cifras pintadas en el cajón y
    // `transporte.peticiones` VACÍO, porque el parcelario esperaba a una pulsación.
    // El fichero entra ahora como un `.dxf`: la comprobación se sigue calculando
    // —se afirma sobre el objeto, que es donde vive— y el cajón no aparece.
    const banco = montar()

    await soltarFixture(WFS)

    expect(banco.cajonComprobacion.abierto()).toBe(false)
    const c = banco.comprobacion.comprobacion()
    expect(c.fichero.nombre).toContain(WFS)
    expect(c.dialecto.queSignifica).toBe(comprobarFixture(WFS).dialecto.queSignifica)
    // Y las cifras del fichero, leídas de sus propias coordenadas.
    expect(c.miembros[c.elegido].nVertices).toBe(15)
    expect(c.geometria.srs).toBe(SRS)
    // Régimen del override O8: **UNA** petición por fichero abierto, ni una más.
    // Antes eran dos gestos (soltar + pulsar) y esta misma petición; el número no
    // sube, baja el número de gestos que le cuesta al usuario.
    expect(banco.transporte.peticiones).toHaveLength(1)
    expect(banco.estado.get().origen).toBe(ORIGEN_PARCELA.GML_EXISTENTE)
  })

  it('«llega al diagnóstico»: al pulsar «Contrastar», el CTA de F07 se enciende SOLO', async () => {
    const banco = montar()
    // El CTA nace apagado, y dice por qué (regla de oro 1: un botón gris y mudo no
    // se distingue de uno roto).
    expect(banco.ctaDiagnosticar.disabled).toBe(true)

    await soltarFixture(WFS)
    banco.botonContrastar.click()
    await cederTurno()

    // Una sola petición, y con la referencia que trae el propio fichero.
    expect(banco.transporte.peticiones).toHaveLength(1)
    expect(banco.transporte.peticiones[0]).toContain(REFCAT)

    const parcela = banco.estado.get()
    expect(parcela.origen).toBe(ORIGEN_PARCELA.GML_EXISTENTE)
    expect(parcela.geometriaOficial).not.toBeNull()
    // Cero código nuevo en F07: el CTA se habilita ⟺ hay contorno oficial.
    expect(banco.ctaDiagnosticar.disabled).toBe(false)
  })

  it('…y pulsarlo pinta el diagnóstico de encaje con las cifras de ESTA parcela', async () => {
    const banco = montar()
    await soltarFixture(WFS)
    banco.botonContrastar.click()
    await cederTurno()

    banco.ctaDiagnosticar.click()
    await cederTurno()

    expect(banco.cajonDiagnostico.abierto()).toBe(true)
    expect(texto(banco.raizDiag, SELECTOR_DIAG.TITULAR)).toMatch(
      /^Contraste con el parcelario — Medición de /,
    )
    // La superficie medida es la del FICHERO, medida por la app: un número de
    // verdad con sus dos decimales, no un hueco.
    expect(texto(banco.raizDiag, SELECTOR_DIAG.MEDIDA)).toMatch(/^\d[\d.]*,\d{2} m²$/)
    // Y el par medición−catastro está en la tabla a tres bandas, que es lo que
    // significa «llega al diagnóstico».
    expect(texto(banco.raizDiag, SELECTOR_DIAG.CRUCES)).toContain('Medición')
  })

  it('«sin pasar por EDICIÓN»: un solo `estado.set` y la geometría intacta, vértice a vértice', async () => {
    // Dos afirmaciones que juntas cierran el «sin edición»:
    //   · el store se escribe UNA vez en todo el recorrido, así que no hay ningún
    //     paso intermedio que haya tocado la geometría (una edición es, por
    //     construcción, otro `estado.set`);
    //   · lo que llega al diagnóstico es EXACTAMENTE lo que el fichero traía, hasta
    //     el último bit, comparado contra la comprobación pura como oráculo.
    const banco = montar()
    await soltarFixture(WFS)
    banco.botonContrastar.click()
    await cederTurno()
    banco.ctaDiagnosticar.click()
    await cederTurno()

    expect(banco.estado.set).toHaveBeenCalledTimes(1)
    const delFichero = comprobarFixture(WFS).geometria.recintos
    expect(banco.estado.get().recintos).toEqual(delFichero)
  })

  it('«sin pasar por GENERACIÓN»: no ha bajado ningún fichero, y «Generar GML» ni se ha rozado', async () => {
    // La generación de F04 se manifiesta de una sola forma observable: un fichero
    // que baja. En todo el recorrido no baja ninguno.
    const banco = montar()
    const generar = document.querySelector('[data-accion="generar-gml"]')
    expect(generar, 'la cáscara ya no trae el botón de generar: la guarda sería vacua').not.toBeNull()

    await soltarFixture(WFS)
    banco.botonContrastar.click()
    await cederTurno()
    banco.ctaDiagnosticar.click()
    await cederTurno()

    expect(banco.entrega.creados, 'algo ha bajado a la carpeta de descargas').toEqual([])
    // Y nada del recorrido ha tocado el botón de generar: sigue como lo dejó la
    // cáscara. Quien lo enciende es `cablearGeneracionGml` (paso 10 de `app/main.js`),
    // que esta pantalla ni siquiera monta — la mitad estructural del criterio.
    expect(generar.disabled).toBe(true)
    expect(document.querySelector('[data-estado="generar-gml"]').textContent).toBe('')
    //
    // ⛔ DESVIACIÓN DELIBERADA DEL ENUNCIADO, razonada en el plan de F08 y que hay
    // que leer junto a esto: en la aplicación COMPLETA «Generar GML» **sigue
    // encendido** en esta vía. La spec dice «no incluye generación», pero el valor
    // que `gml/parse.js` declara para un fichero 3.0 es literalmente «te la
    // reescribo en 4.0», y apagar el botón mataría ese recorrido entero. Lo que el
    // criterio pide de verdad —que el camino al diagnóstico no PASE por la
    // generación— se cumple: aquí no está montada y el recorrido llega igual. Cuál
    // es la acción PRINCIPAL del diagnóstico es el AC3.
  })

  it('la procedencia dice las DOS cosas: geometría del fichero, parcelario del Catastro', async () => {
    // El error de producto de esta fase sería que una parcela cargada de fichero se
    // confundiera con una traída del Catastro. Un renglón que dijera «del Catastro»
    // a secas convertiría el fichero del usuario en un dato oficial.
    const banco = montar()
    await soltarFixture(WFS)
    banco.botonContrastar.click()
    await cederTurno()

    const dice = banco.procedencia.textContent
    expect(dice).toContain(`Geometría del fichero «${WFS}», NO del Catastro.`)
    expect(dice).toContain('Parcelario, solo para contrastar')
  })

  it('el CP 3.0 también llega: un ERROR en el fichero NO apaga el recorrido', async () => {
    // `bloqueos` no es lo contrario de `puedeContinuar`, y éste es el caso real:
    // `DIALECTO_RECHAZADO` es de nivel ERROR y el botón sigue encendido. Fundir las
    // dos cosas habría convertido el gate en un veredicto.
    const banco = montar()
    await soltarFixture(TRESCERO)

    expect(comprobarFixture(TRESCERO).bloqueos.map((d) => d.tipo)).toContain('DIALECTO_RECHAZADO')
    // El ERROR del fichero sale por el PANEL —el cajón ya no se abre— y el
    // recorrido sigue: la parcela entra igual. Ésa es la distinción que este `it`
    // existe para atestar, y no ha cambiado.
    expect(banco.comprobacion.comprobacion().puedeContinuar).toBe(true)

    // Sin referencia catastral no hay parcelario que pedir: se dice y se carga igual.
    expect(banco.transporte.peticiones).toEqual([])
    expect(banco.estado.get().origen).toBe(ORIGEN_PARCELA.GML_EXISTENTE)
    expect(banco.estado.get().geometriaOficial).toBeNull()
    expect(banco.procedencia.textContent).toContain('VACÍA')
    // Y el CTA de F07 se queda apagado CON SU MOTIVO escrito, no gris y mudo.
    expect(banco.ctaDiagnosticar.disabled).toBe(true)
    expect(banco.renglonDiagnosticar.textContent.length).toBeGreaterThan(20)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · AC2 · «Un GML con varias parcelas ofrece elegir; uno con SRS inesperado o
//           coords fuera de huso lo indica como nota, no como fallo.»
// ═════════════════════════════════════════════════════════════════════════════

describe('F08 · AC2 · un GML con varias parcelas ofrece elegir; uno con SRS inesperado o coords fuera de huso lo indica como nota, no como fallo', () => {
  it('«ofrece elegir»: tres parcelas, tres radios, y la primera marcada', async () => {
    const banco = montar()
    await soltarFixture(MULTI)

    const radios = [...banco.raizComp.querySelectorAll(SELECTOR_MIEMBRO)]
    expect(radios).toHaveLength(3)
    expect(radios.map((r) => r.checked)).toEqual([true, false, false])
    // Y se dice que las demás se quedan en el fichero: multiparcela está fuera de
    // alcance (SPEC §1) y unirlas no es algo que esta aplicación haga.
    expect(texto(banco.raizComp, SELECTOR_COMP.MIEMBROS)).toContain('se quedan')
  })

  it('elegir la 2ª recomprueba el fichero ENTERO y solo esa entra en el expediente', async () => {
    const banco = montar()
    await soltarFixture(MULTI)

    const radios = [...banco.raizComp.querySelectorAll(SELECTOR_MIEMBRO)]
    radios[1].checked = true
    radios[1].dispatchEvent(new Event('change', { bubbles: true }))
    await cederTurno()

    const segunda = comprobarFixture(MULTI, { indiceElegido: 1 })
    expect(banco.comprobacion.comprobacion().elegido).toBe(1)
    // Las cifras pintadas son las de la 2ª, no las de la 1ª: el cajón recomprueba
    // entero en vez de «ajustar» lo pintado.
    expect(texto(banco.raizComp, SELECTOR_COMP.VERTICES)).toBe(
      String(segunda.miembros[1].nVertices),
    )

    banco.botonContrastar.click()
    await cederTurno()

    expect(banco.estado.set).toHaveBeenCalledTimes(1)
    expect(banco.estado.get().recintos).toEqual(segunda.geometria.recintos)
  })

  it('«coords fuera de huso»: NOTA de nivel AVISO nombrando los 15 vértices, y el recorrido SIGUE', async () => {
    const banco = montar()
    await soltarFixture(HUSO_MALO)

    const c = banco.comprobacion.comprobacion()
    const nota = c.notas.find((d) => d.tipo === 'HUSO_FUERA_DE_RANGO')
    // Es una NOTA (AVISO), no un bloqueo: los `bloqueos` de este fichero están
    // vacíos y el gate sigue en `true`.
    expect(nota.severidad).toBe('AVISO')
    expect(c.bloqueos).toEqual([])
    expect(c.puedeContinuar).toBe(true)
    // ⭐ Y se PUBLICA por el panel de avisos, que es donde se leen las notas desde
    // el 2026-08-07: antes se pintaban en la sección de notas del cajón, y el cajón
    // ya no se abre. La nota conserva su texto entero y su nivel de AVISO.
    const avisos = banco.panel.avisar.mock.calls.map(([m]) => m).join(' | ')
    expect(avisos).toContain('15 de los 15 vértices caen FUERA del huso 29')
    expect(avisos).toContain('Es una nota, no un fallo')
    // Y el recorrido continúa: la parcela entra sola.
    expect(banco.estado.get().origen).toBe(ORIGEN_PARCELA.GML_EXISTENTE)
  })

  it('«SRS inesperado» que la app SÍ soporta (25829): es nota y el recorrido sigue', async () => {
    // La mitad limpia del criterio. `cp_huso_incoherente.gml` declara un huso que no
    // es el del expediente y la aplicación no lo trata como un fallo: lo cuenta y
    // sigue. Lo único que se pierde es el parcelario, y se dice por qué (regla 3:
    // pedirlo en otro huso daría una desviación de cientos de kilómetros con pinta
    // de medida).
    const banco = montar()
    await soltarFixture(HUSO_MALO)

    expect(banco.transporte.peticiones).toEqual([])
    expect(banco.estado.get().geometriaOficial).toBeNull()
    expect(banco.procedencia.textContent).toContain('EPSG:25829')
    expect(banco.procedencia.textContent).toContain('EPSG:25830')
  })

  it('«SRS inesperado» que la app NO soporta (4326): se PARA, y eso también se dice con palabras', async () => {
    // ⚠️ LA MITAD QUE HAY QUE ESCRIBIR CON HONRADEZ. Un EPSG:4326 no es una nota:
    // sin husos no se sabe dónde caen esas coordenadas, así que la aplicación no
    // puede situarlas ni contrastarlas y el recorrido se para. Lo que el criterio
    // exige —y lo que dice el § «Alcance» de la spec con todas las letras: «nota
    // clara, NO UN ERROR DE PROGRAMA»— sí se cumple entero: no hay excepción, no
    // hay consola sucia, y el botón apagado lleva escrito su motivo al lado.
    const banco = montar()
    await soltarFixture(SRS_MALO)

    const c = banco.comprobacion.comprobacion()
    expect(c.puedeContinuar).toBe(false)
    // El motivo, en castellano, POR EL PANEL desde el 2026-08-07 —antes iba al
    // renglón `role="status"` del cajón, que ya no se abre—. Nunca vacío, y con el
    // nombre del fichero delante para que se sepa de cuál habla.
    const avisos = banco.panel.avisar.mock.calls.map(([m]) => m).join(' | ')
    expect(avisos).toContain(c.motivoNoContinua)
    expect(avisos).toContain('EPSG:25829, 25830 o 25831')
    expect(avisos).toContain('Reproyéctalo')
    // Y la nota que sí es nota: no se ha podido cotejar el huso, y se dice.
    expect(c.notas.map((d) => d.tipo)).toContain('HUSO_NO_COTEJABLE')
    // No se ha metido nada en el expediente a medias.
    expect(banco.estado.set).not.toHaveBeenCalled()
  })

  it('los tres casos del criterio: ni una excepción ni una línea de consola', async () => {
    // «No un error de programa» se mide así: soltar los tres ficheros del criterio
    // no lanza y no escribe NADA en la consola. Un `console.error` aquí significaría
    // que algo se ha ido por el camino del fallo interno.
    const espiaError = vi.spyOn(console, 'error').mockImplementation(() => {})
    const espiaWarn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const banco = montar()

    for (const nombre of [MULTI, SRS_MALO, HUSO_MALO]) {
      await expect(soltarFixture(nombre)).resolves.toBeUndefined()
    }
    banco.botonContrastar.click()
    await cederTurno()

    expect(espiaError.mock.calls.map((c) => String(c[0]))).toEqual([])
    expect(espiaWarn.mock.calls.map((c) => String(c[0]))).toEqual([])
  })

  it('y el guardián de consola NO es vacuo: un fichero ilegible sí escribe', async () => {
    // La mitad anti-vacuidad del test de arriba. Si el espía no pudiera detectar
    // nada, «la consola está limpia» sería una frase sin contenido.
    const espiaError = vi.spyOn(console, 'error').mockImplementation(() => {})
    montar()

    const roto = new File(['no soy un fichero'], 'roto.gml', { type: '' })
    // Un `File` cuyos bytes no se pueden leer: el navegador entrega el `File` y el
    // `arrayBuffer()` revienta (fichero movido, renombrado, pendrive desconectado).
    roto.arrayBuffer = () => Promise.reject(new Error('prueba: el fichero se ha movido'))
    soltar(roto)
    await cederTurno()

    expect(espiaError).toHaveBeenCalled()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · AC3 · «La acción principal del diagnóstico por esta vía es "Descargar
//           informe de contraste".»
// ═════════════════════════════════════════════════════════════════════════════
//
// El botón vive DENTRO del cajón de diagnóstico y no en el pie de la aplicación,
// y está razonado en el plan: es la acción que consume el diagnóstico, el cajón
// tiene anchura y el pie no (un tercer CTA a lo ancho vuelve a costar ~36 px), y
// sirve igual de bien a las DOS vías —quien llegó por referencia catastral también
// quiere su informe—, así que la interfaz no se ramifica por procedencia.
//
// ── ⛔ EL BOTÓN QUE AC3 NOMBRABA YA NO EXISTE (2026-08-15) ───────────────────
// «Descargar informe de contraste» se ha retirado del pie por encargo del autor:
// «no hace falta lo de descargar informe de contraste que saca el txt, solo
// necesito el pdf». Y este bloque **no se borra**, porque lo que AC3 pedía de
// verdad no era ese botón:
//
//   · **«la acción principal del diagnóstico»** — sigue habiéndola, y sigue
//     estando en el pie del cajón. Es «Preparar informe (PDF)», que desde F09 era
//     ya el primario de los dos y hoy es el único.
//   · **«por esta vía»** — que quien llega soltando un GML llegue al MISMO informe
//     que quien llega por referencia catastral, sin que la interfaz se ramifique
//     por procedencia. Eso es lo que de verdad se estaba afirmando, y sigue
//     entero: el compositor del texto no se ha tocado.
//
// Lo que cambia es el GESTO que dispara el `.txt`: ya no hay botón, y se compone
// llamando a `descargarInforme()` en la API de `cablearDiagnostico` — donde
// siempre estuvo, y donde su propia cabecera decía que estaba «por si alguna vez
// hace falta dispararlo desde fuera». Todo lo que este bloque prueba del DOCUMENTO
// —los bytes, el nombre, la sección del fichero, el «No consta»— vale palabra por
// palabra, porque de eso no se ha retirado nada.

/** Deja la pantalla con el diagnóstico de un fichero ya calculado y visible. */
async function conDiagnosticoDeFichero(banco, nombre = WFS) {
  await soltarFixture(nombre)
  banco.botonContrastar.click()
  await cederTurno()
  banco.ctaDiagnosticar.click()
  await cederTurno()
  return banco
}

describe('F08 · AC3 · la acción principal del diagnóstico por esta vía sigue estando en el cajón', () => {
  it('la acción principal es UNA, se llama «Preparar informe (PDF)» y vive en el pie del cajón', () => {
    const banco = montar()

    // ⚠️ HISTORIA DE ESTA AFIRMACIÓN, que es la mitad de su valor:
    // · Cuando se escribió AC3, el informe de contraste era el ÚNICO documento que
    //   la herramienta sabía emitir, así que era el primario del pie.
    // · F09 (T4.2) trajo el documento FIRMABLE —plano a 300 ppp, descripción del
    //   lindero y pie de firma— y ÉSE pasó a ser el primario; el de texto se quedó
    //   como la alternativa que se compone SIN RED y sin plano.
    // · El REWORK DE UI (T9) metió un cuarto botón —«Tomar esta geometría y
    //   editarla», la puerta de D4— y el 2026-08-07 se retiró con el modo
    //   COMPROBACIÓN entero.
    // · El 2026-08-15 se retiró el de texto, por encargo del autor.
    // AC3 no se ha movido en ninguno de los cuatro, y por la misma razón: lo que
    // pide es que la acción que CONSUME el diagnóstico esté donde el diagnóstico se
    // lee, no que se llame de una forma concreta.
    expect(banco.botonInforme.textContent).toBe('Preparar informe (PDF)')
    const botones = [...banco.raizDiag.querySelectorAll('button')]
    expect(botones.map((b) => b.dataset.accion).sort()).toEqual([
      'cerrar-diagnostico',
      'preparar-informe',
    ])
    // Y cuelga del `<footer>` del cajón, no del pie de la aplicación: eso es lo que
    // AC3 afirma de verdad, y es lo que no ha cambiado en un año de rediseños.
    expect(banco.botonInforme.closest('footer')).not.toBeNull()
    expect(banco.raizDiag.contains(banco.botonInforme)).toBe(true)
  })

  it('⛔ y el `.txt` sigue componiéndose: se ha retirado el botón, no el documento', () => {
    // La distinción que este bloque existe para dejar escrita. Quitar un botón es
    // cosa de la interfaz; borrar `report/contraste-texto.js` sería quitar la única
    // salida que se compone SIN RED, que era la degradación declarada de F09 para
    // el día que el plano no se pueda armar.
    const banco = montar()
    expect(typeof banco.diagnostico.descargarInforme).toBe('function')
    expect(banco.raizDiag.querySelector('[data-accion="descargar-informe"]')).toBeNull()
  })

  it('nace APAGADO y con el motivo escrito: un botón gris y mudo es un error silencioso', () => {
    const banco = montar()

    expect(banco.botonInforme.disabled).toBe(true)
    expect(banco.renglonInforme.textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
    expect(banco.renglonInforme.getAttribute('role')).toBe('status')
  })

  it('con el diagnóstico calculado se enciende SOLO', async () => {
    const banco = await conDiagnosticoDeFichero(montar())

    expect(banco.botonInforme.disabled).toBe(false)
    expect(banco.renglonInforme.textContent).not.toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
  })

  it('pulsarlo BAJA BYTES DE VERDAD: el Blob no está vacío y trae el informe entero', async () => {
    const banco = await conDiagnosticoDeFichero(montar())

    banco.diagnostico.descargarInforme()
    await cederTurno()

    expect(banco.entrega.creados, 'no se ha entregado ningún Blob').toHaveLength(1)
    const { blob } = banco.entrega.creados[0]
    // Los BYTES, que es lo que el criterio pide comprobar. Un fichero vacío pesa 0.
    expect(blob.size).toBeGreaterThan(2000)
    expect(blob.type).toContain('text/plain')

    const contenido = await banco.entrega.ultimoTexto()
    expect(contenido.length).toBeGreaterThan(2000)

    // El nombre LEGAL, que no es el del documento oficial del Catastro.
    expect(contenido).toContain('INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL')
    // Dice que no lleva pie de firma y REMITE al documento que sí lo lleva. (Decía
    // que el firmable «todavía no existe»; F09 lo trajo y la frase se reescribió.)
    expect(contenido).toContain('VERSIÓN EN TEXTO, SIN PIE DE FIRMA')
    expect(contenido).not.toContain('todavía no existe')
    expect(contenido).toMatch(/«Preparar\s+informe\s+\(PDF\)»/)
    // Y niega expresamente ser el IVG/VGA, que es lo que un cliente confundiría.
    expect(contenido).toContain('NO es la validación gráfica alternativa (VGA)')
    // La sección que SOLO existe por esta vía: qué se leyó del fichero.
    expect(contenido).toContain('QUÉ SE LEYÓ DEL FICHERO')
    expect(contenido).toContain(WFS)
    expect(contenido).toContain(REFCAT)
    // Y las cifras del contraste, con su número de verdad.
    expect(contenido).toContain('CONTRASTE CON EL PARCELARIO')
    expect(contenido).toMatch(/Medida sobre la geometría de la parcela\s+[\d.]+,\d{2} m²/)
  })

  it('el fichero baja con su nombre compuesto, emparejable con el GML del mismo instante', async () => {
    const banco = await conDiagnosticoDeFichero(montar())

    banco.diagnostico.descargarInforme()
    await cederTurno()

    // El nombre lo compone el módulo real y se afirma con SUS constantes: escribir
    // aquí el literal sería una segunda redacción que se queda vieja sola.
    const esperado = nombreFicheroInforme({ refcat: REFCAT, fecha: FECHA_INFORME })
    expect(banco.entrega.anclas).toHaveLength(1)
    expect(banco.entrega.anclas[0].download).toBe(esperado)
    expect(esperado.startsWith(PREFIJO_INFORME)).toBe(true)
    expect(esperado.endsWith(EXTENSION_INFORME)).toBe(true)
    expect(esperado).toContain(REFCAT)
    // El desenlace se dice SIEMPRE, y aquí dice que ha bajado y con qué nombre.
    expect(banco.renglonInforme.textContent).toBe(`Descargado «${esperado}».`)
  })

  it('«No consta» donde no hay dato, jamás un 0 que tranquilice en falso', async () => {
    const banco = await conDiagnosticoDeFichero(montar())
    banco.diagnostico.descargarInforme()
    await cederTurno()

    const contenido = await banco.entrega.ultimoTexto()
    // La superficie registral no se ha tecleado: no hay con qué comparar, y se dice.
    expect(contenido).toContain('Registral, de la escritura')
    expect(contenido).toContain('No consta')
    expect(contenido).toMatch(/Medición - Registro\s+No consta\s+No consta/)
  })

  it('el informe es del FICHERO, no de una parcela cualquiera: cita su procedencia y su dialecto', async () => {
    // Es lo que distingue «el informe de contraste por esta vía» de un informe
    // genérico: la cabecera dice de dónde salió la geometría —del fichero del
    // usuario, no del Catastro— y la sección 2 dice qué era ese fichero.
    const banco = await conDiagnosticoDeFichero(montar())
    banco.diagnostico.descargarInforme()
    await cederTurno()

    const plano = aplanar(await banco.entrega.ultimoTexto())
    expect(plano).toContain('Fichero GML aportado por el usuario')
    expect(plano).toContain(aplanar(comprobarFixture(WFS).dialecto.etiqueta))
    // Y por la OTRA vía —quien llegó por referencia catastral— el mismo botón
    // descarga el mismo informe SIN esta sección: la interfaz no se ramifica por
    // procedencia. Eso lo cubre `test/app/diagnostico.dom.test.js`.
  })

  it('⛔ MEDIDO: sin referencia catastral no se llega al informe, y el CTA lo dice', async () => {
    // Consecuencia real de la cadena, y conviene tenerla escrita porque no es
    // evidente: el informe recoge las medidas del DIAGNÓSTICO, el diagnóstico
    // necesita el contorno oficial, y el contorno oficial se pide con la referencia
    // catastral del propio fichero. La plantilla oficial de alta la trae VACÍA, así
    // que su recorrido acaba —correctamente— antes del informe, con los dos motivos
    // escritos: el del CTA de F07 y el del botón del informe.
    const banco = montar()
    await soltarFixture(PLANTILLA)
    banco.botonContrastar.click()
    await cederTurno()

    expect(banco.estado.get().geometriaOficial).toBeNull()
    expect(banco.ctaDiagnosticar.disabled).toBe(true)
    banco.ctaDiagnosticar.click()
    await cederTurno()

    expect(banco.renglonDiagnosticar.textContent).toBe(MOTIVO_SIN_OFICIAL)
    expect(banco.cajonDiagnostico.abierto()).toBe(false)
    expect(banco.botonInforme.disabled).toBe(true)
    expect(banco.renglonInforme.textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
    expect(banco.entrega.creados).toEqual([])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · AC4 · «Un GML de edificio se encamina al contraste de construcción (F14),
//           no al de lindero.»
// ═════════════════════════════════════════════════════════════════════════════
//
// ⚠️ ESTE CRITERIO SE CUMPLE **A MEDIAS**, Y ASÍ SE ESCRIBE.
//
// La mitad comprobable hoy —que **NO** se encamina al contraste de lindero, y que
// se dice qué es el fichero— se testea aquí entera. La otra mitad —«se encamina al
// contraste de construcción (F14)»— **no se puede cumplir: F14 no existe**. Es una
// feature entera (`spec/feature-14-edificio-contraste-informe.md`) que depende a su
// vez de F11, F12 y F13, ninguna empezada.
//
// Se deja PENDIENTE y declarado, no disimulado. Fingir un destino sería peor que
// decir que no, que es exactamente lo que ya hace `gml/parse.js` devolviendo
// `parcelas: []` para el dialecto `BU`. Cuando llegue F14, esta suite se completa:
// el `it` marcado con «PENDIENTE F14» se sustituye por su afirmación de verdad
// —que el cajón ofrece el contraste de construcción— y el guardián de que
// `comprobacion/edificio.js` no existe se cae solo, que es como debe caerse.

describe('F08 · AC4 · un GML de edificio se encamina al contraste de construcción (F14), no al de lindero', () => {
  it('SE CUMPLE · «no al de lindero»: se para en seco y no entra nada en el expediente', async () => {
    const banco = montar()
    await soltarFixture(EDIFICIO)

    // El cajón ya no se abre (2026-08-07): el gate sigue viviendo donde vivía
    // —`puedeContinuar`, de `comprobacion/gml.js`— y el motivo sale por el panel.
    expect(banco.cajonComprobacion.abierto()).toBe(false)
    expect(banco.comprobacion.comprobacion().puedeContinuar).toBe(false)

    // Ni siquiera forzándolo desde la API: el gate no es la cortesía del `disabled`.
    banco.comprobacion.contrastar()
    await cederTurno()

    expect(banco.estado.set).not.toHaveBeenCalled()
    expect(banco.estado.get()).toBeNull()
    expect(banco.transporte.peticiones).toEqual([])
    // Y el CTA de F07 sigue apagado: no hay ningún lindero que diagnosticar.
    expect(banco.ctaDiagnosticar.disabled).toBe(true)
    expect(banco.cajonDiagnostico.abierto()).toBe(false)
  })

  it('SE CUMPLE · «lo dice»: nombra que es un GML de edificio y por qué el camino se acaba', async () => {
    const banco = montar()
    await soltarFixture(EDIFICIO)

    expect(banco.comprobacion.comprobacion().dialecto.queSignifica).toContain(
      'habla de la CONSTRUCCIÓN, no del lindero de la parcela',
    )
    // ⭐ El motivo sale por el PANEL desde el 2026-08-07, con el nombre del fichero
    // delante: antes lo escribía el renglón del cajón al lado del botón apagado.
    const avisos = banco.panel.avisar.mock.calls.map(([m]) => m).join(' | ')
    expect(avisos).toContain(comprobarFixture(EDIFICIO).motivoNoContinua)
    expect(avisos).toContain('describe una CONSTRUCCIÓN, no una parcela')
    expect(avisos).toContain('todavía no existe en esta aplicación')
    // Sin parcelas y sin geometría validada: `null` («no se ha mirado») y no `[]`.
    expect(banco.comprobacion.comprobacion().miembros).toEqual([])
    expect(comprobarFixture(EDIFICIO).hallazgos).toBeNull()
  })

  it('SE CUMPLE · los DOS ficheros de edificio del repo se comportan igual', async () => {
    for (const nombre of [EDIFICIO, EDIFICIO_PARTE]) {
      const c = comprobarFixture(nombre)
      expect(c.dialecto.id, nombre).toBe('BU')
      expect(c.miembros, nombre).toEqual([])
      expect(c.puedeContinuar, nombre).toBe(false)
      expect(c.motivoNoContinua, nombre).toContain('CONSTRUCCIÓN')
    }
  })

  it('PENDIENTE F14 · «se encamina al contraste de construcción» NO se cumple: ese destino no existe', () => {
    // Guardián de la mitad pendiente, escrito para que se caiga solo el día que F14
    // llegue —momento en el que este `it` hay que sustituirlo por la afirmación de
    // verdad: que el cajón ofrece el contraste de construcción—.
    const edificio = join(RAIZ, 'comprobacion', 'edificio.js')
    // Anti-vacuidad: la MISMA resolución de ruta sí encuentra a su hermano.
    expect(existsSync(join(RAIZ, 'comprobacion', 'gml.js'))).toBe(true)
    expect(
      existsSync(edificio),
      `${edificio} existe: F14 ha llegado. Este test ya no describe la realidad — ` +
        'sustitúyelo por la afirmación de que el GML de edificio SÍ se encamina al ' +
        'contraste de construcción, y bórrale el «PENDIENTE» del nombre.',
    ).toBe(false)
    // Y la feature está escrita y sin empezar, que es la razón de que esto sea una
    // deuda declarada y no un olvido.
    expect(existsSync(join(RAIZ, 'spec', 'feature-14-edificio-contraste-informe.md'))).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · Los dos cajones comparten `bottomleft` y NUNCA se ven a la vez
// ═════════════════════════════════════════════════════════════════════════════
//
// No es un criterio de la spec: es el riesgo de esta fase. Las CUATRO esquinas del
// mapa ya estaban ocupadas cuando llegó F08 —`topleft` la barra de edición,
// `topright` el control de capas, `bottomright` la opacidad y la atribución—, así
// que el cajón de comprobación comparte `bottomleft` con el de diagnóstico y son
// **mutuamente excluyentes por diseño**. Aquí se afirma sobre el recorrido de
// verdad; los tres caminos uno a uno están en `test/app/comprobacion.dom.test.js`.

describe('F08 · los dos cajones de bottomleft nunca coinciden', () => {
  it('soltar un fichero con el diagnóstico abierto CIERRA el de diagnóstico', async () => {
    const banco = await conDiagnosticoDeFichero(montar())
    expect(banco.cajonDiagnostico.abierto()).toBe(true)

    // Con VARIAS parcelas, que es lo único que abre el cajón desde el 2026-08-07:
    // es el único estado en el que los dos podrían apilarse en la misma esquina.
    await soltarFixture(MULTI)

    expect(banco.cajonComprobacion.abierto()).toBe(true)
    expect(banco.cajonDiagnostico.abierto()).toBe(false)
  })

  it('cargar el fichero deja cerrado el de comprobación antes de llegar al diagnóstico', async () => {
    const banco = montar()
    await soltarFixture(WFS)

    expect(banco.cajonComprobacion.abierto()).toBe(false)
    banco.ctaDiagnosticar.click()
    await cederTurno()
    expect(banco.cajonDiagnostico.abierto()).toBe(true)
    expect(banco.cajonComprobacion.abierto()).toBe(false)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · EL GUARDIÁN DE LA REGLA DE ORO 9, EN TRES FRENTES
// ═════════════════════════════════════════════════════════════════════════════
//
// «La aplicación mide; el colegiado interpreta y firma» (SPEC §2, regla 9). En F08
// pesa más que en ninguna fase anterior porque esta pantalla habla del trabajo de
// OTRO técnico: el que hizo el GML que se acaba de soltar.

/**
 * Clave de veredicto. **Es el patrón que fija el plan de F08, letra por letra**, y
 * el `puede` inicial lo añadió T2.1 al medir que sin él la «única excepción» era
 * decorativa: el patrón original no cazaba `puedeContinuar`, así que tampoco habría
 * cazado un `puedeGenerar` o un `puedeSubir` colándose por la puerta de atrás.
 */
const CLAVE_PROHIBIDA = /^(puede|ok|valido|apto|aprobado|dentro|cumple|semaforo|umbral)/i

/**
 * **LA ÚNICA EXCEPCIÓN**, y el porqué, que es la mitad que importa.
 *
 * `puedeContinuar` es CAPACIDAD DE LA APLICACIÓN, no mérito de la parcela: vale
 * `false` solo cuando no hay geometría con la que trabajar —XML irrecuperable, GML
 * de edificio, colección sin parcelas, SRS con el que esta aplicación no sabe
 * situar nada—, nunca porque la parcela «esté mal». Precedente literal: el gate
 * `puedeGenerar` de F02, que dice si se puede ESCRIBIR un GML y tampoco juzga el
 * lindero. La frontera se cruza en un solo sentido y está escrita en la cabecera de
 * `comprobacion/gml.js`; aquí se nombra para que añadir una segunda excepción
 * cueste tocar esta constante y no pase inadvertido.
 *
 * Que no se reexponga el `puedeGenerar` de `validarParcela` es parte del mismo
 * cuidado: un segundo booleano en esta salida se confundiría con éste.
 */
const UNICA_EXCEPCION = 'puedeContinuar'

/**
 * Palabras que convertirían en dictamen el texto que ESTE proyecto escribe. Mismo
 * vocabulario que el guardián del cajón (T3.1) y que el del informe (T2.2): tres
 * guardianes que dijeran cosas distintas dejarían pasar por un lado lo que el otro
 * prohíbe.
 */
const PALABRA_VEREDICTO =
  /\b(apt[oa]s?|correct[oa]s?|incorrect[oa]s?|v[áa]lid[oa]s?|inv[áa]lid[oa]s?|aprobad[oa]s?|conforme|cumple|incumple|supera|admisible|aceptable|sem[áa]foro|umbral|toleranci\w*|dentro del margen)\b/i

/** Clase CSS de mérito: el modificador BEM que pintaría un semáforo. */
const CLASE_MERITO = /(^|[-_])(ok|exito|éxito|error|valido|válido|correcto|apto|bien|mal)([-_]|$)/i

/**
 * Recorrido RECURSIVO sobre un objeto real: devuelve la RUTA de cada clave que casa
 * {@link CLAVE_PROHIBIDA}, saltando la única excepción. Nada de listas escritas a
 * mano: se recorre lo que hay, así que una clave nueva entra sola en el examen.
 */
function clavesDeVeredicto(valor, ruta = 'raíz', vistos = new WeakSet(), salida = []) {
  if (valor === null || typeof valor !== 'object') return salida
  if (vistos.has(valor)) return salida
  vistos.add(valor)
  if (Array.isArray(valor)) {
    valor.forEach((v, i) => clavesDeVeredicto(v, `${ruta}[${i}]`, vistos, salida))
    return salida
  }
  for (const [clave, v] of Object.entries(valor)) {
    if (clave !== UNICA_EXCEPCION && CLAVE_PROHIBIDA.test(clave)) salida.push(`${ruta}.${clave}`)
    clavesDeVeredicto(v, `${ruta}.${clave}`, vistos, salida)
  }
  return salida
}

/**
 * Todo el texto que el cajón NO escribe: lo redactan capas de abajo y llega LITERAL,
 * porque reescribirlo sería inventarse una traducción que se queda corta en silencio
 * (regla de oro 1). **Criterio calcado de `test/viewer/cajon-comprobacion.dom.test.js`
 * a propósito**: dos despojados distintos serían dos guardianes que se desincronizan.
 */
const textoAjeno = (c) =>
  [
    c.dialecto.etiqueta,
    c.dialecto.queSignifica,
    c.fichero.nombre,
    c.motivoNoContinua ?? '',
    ...c.miembros.map((m) => m.etiqueta),
    ...c.notas.map((d) => d.mensaje),
    ...c.bloqueos.map((d) => d.mensaje),
    ...(c.hallazgos ?? []).flatMap((h) => [h.mensaje, h.correccion ?? '']),
  ].filter((t) => t.length > 0)

/** El DOM pintado MENOS todo lo que lo atraviesa: o sea, el vocabulario PROPIO. */
function vocabularioPropio(raiz, c) {
  let resto = raiz.textContent
  // De más largo a más corto: un fragmento corto podría estar contenido en uno
  // largo y dejarlo partido en trozos que ya no casarían.
  for (const ajeno of textoAjeno(c).sort((a, b) => b.length - a.length)) {
    resto = resto.split(ajeno).join(' ')
  }
  return resto
}

describe('F08 · regla de oro 9 · 1/3 · no existe ningún fichero de umbrales', () => {
  it('config/umbrales.json NO existe — y este test caza a quien lo cree', () => {
    const umbrales = join(RAIZ, 'config', 'umbrales.json')
    // Anti-vacuidad: la MISMA resolución de ruta sí encuentra el fichero hermano.
    // Sin esto, un test movido de sitio «pasaría» mirando un directorio vacío.
    expect(existsSync(join(RAIZ, 'config', 'operativos.json'))).toBe(true)
    expect(
      existsSync(umbrales),
      `${umbrales} existe: alguien ha creado el fichero de umbrales que la spec prohíbe ` +
        '(regla de oro 9). No hay umbral bueno: bórralo y lee SPEC §2.',
    ).toBe(false)
  })
})

describe('F08 · regla de oro 9 · 2/3 · ninguna clave de veredicto en comprobacion/ ni en report/', () => {
  const MODULOS = {
    'comprobacion/_comun.js': comprobacionComun,
    'comprobacion/gml.js': comprobacionGml,
    'report/contraste-texto.js': reportContraste,
  }

  it('ningún EXPORT de las dos capas nuevas, ni ninguna clave de sus objetos congelados', () => {
    let miradas = 0
    for (const [fichero, modulo] of Object.entries(MODULOS)) {
      for (const [nombre, valor] of Object.entries(modulo)) {
        miradas += 1
        expect(nombre, `${fichero} exporta '${nombre}'`).not.toMatch(CLAVE_PROHIBIDA)
        // Y las claves de los objetos congelados exportados (TIPO_COMPROBACION,
        // SEVERIDAD, OMISION_CONOCIDA…): un `SEVERIDAD.OK` sería un veredicto con
        // otro sombrero.
        if (valor !== null && typeof valor === 'object') {
          for (const clave of Object.keys(valor)) {
            miradas += 1
            expect(clave, `${fichero} → ${nombre}.${clave}`).not.toMatch(CLAVE_PROHIBIDA)
          }
        }
      }
    }
    // El guardián mira algo: si un refactor vaciara los imports, esto lo diría.
    expect(miradas).toBeGreaterThan(25)
  })

  it('el objeto REAL que devuelve `comprobarGml`, recorrido entero, sobre los NUEVE ficheros', () => {
    // Recursivo y sobre el objeto de verdad —notas, bloqueos, hallazgos, miembros y
    // los `datos` de cada detección—, no sobre una lista escrita a mano de campos
    // que alguien se acordó de mirar.
    for (const nombre of TODOS) {
      const c = comprobarFixture(nombre)
      expect(clavesDeVeredicto(c), `claves de veredicto con ${nombre}`).toEqual([])
    }
  })

  it('`puedeContinuar` es la ÚNICA excepción, y NO es decorativa: el patrón la caza', () => {
    // Si el patrón no cazara la excepción, «la única excepción» sería una frase sin
    // contenido — y tampoco cazaría un `puedeGenerar` colándose. Es el motivo por el
    // que T2.1 le añadió el `puede`.
    expect(CLAVE_PROHIBIDA.test(UNICA_EXCEPCION)).toBe(true)
    expect(CLAVE_PROHIBIDA.test('puedeGenerar')).toBe(true)
    expect(CLAVE_PROHIBIDA.test('puedeSubir')).toBe(true)
    // Y está de verdad en la salida: no se está excusando algo que no existe.
    const c = comprobarFixture(WFS)
    expect(Object.hasOwn(c, UNICA_EXCEPCION)).toBe(true)
    expect(typeof c[UNICA_EXCEPCION]).toBe('boolean')
    // Es capacidad, no mérito: el fichero con MÁS hallazgos del repo lo tiene en
    // `true`, y el que se para lo hace por no poder situar las coordenadas.
    expect(comprobarFixture(HUSO_MALO).puedeContinuar).toBe(true)
    expect(comprobarFixture(HUSO_MALO).hallazgos.some((h) => h.nivel === 'ERROR')).toBe(true)
  })

  it('DISPARA: un `puedeGenerar` o un `ok` colados en la salida ponen rojo el recorrido', () => {
    // La mitad anti-vacuidad. Se muta la salida REAL —no un objeto de mentira— y se
    // exige que el mismo recorrido los encuentre, con su ruta.
    const c = comprobarFixture(WFS)
    expect(clavesDeVeredicto({ ...c, puedeGenerar: false })).toEqual(['raíz.puedeGenerar'])
    expect(clavesDeVeredicto({ ...c, dialecto: { ...c.dialecto, ok: true } })).toEqual([
      'raíz.dialecto.ok',
    ])
    // Y en profundidad, dentro de un array y dentro de los `datos` de una detección,
    // que es donde se colaría sin que nadie lo viera.
    const conMiembroSucio = {
      ...c,
      miembros: [{ ...c.miembros[0], dentroDeTolerancia: true }],
    }
    expect(clavesDeVeredicto(conMiembroSucio)).toEqual(['raíz.miembros[0].dentroDeTolerancia'])
    const conNotaSucia = {
      ...c,
      notas: c.notas.map((d, i) => (i === 0 ? { ...d, datos: { ...d.datos, umbral: 0.5 } } : d)),
    }
    expect(clavesDeVeredicto(conNotaSucia)).toEqual(['raíz.notas[0].datos.umbral'])
  })
})

describe('F08 · regla de oro 9 · 3/3 · el DOM del cajón pintado por el recorrido de verdad', () => {
  it.each(TODOS)('el vocabulario PROPIO del cajón está limpio con %s', async (nombre) => {
    const banco = montar()
    await soltarFixture(nombre)

    const c = banco.comprobacion.comprobacion()
    const propio = vocabularioPropio(banco.raizComp, c)
    // Anti-vacuidad: si el despojado se hubiera llevado el texto entero, este
    // guardián estaría examinando una cadena vacía y pasaría siempre.
    expect(propio.replace(/\s+/g, ' ').trim().length).toBeGreaterThan(200)
    expect(propio).not.toMatch(PALABRA_VEREDICTO)
  })

  it.each(TODOS)('ninguna clase CSS de mérito en ningún nodo con %s', async (nombre) => {
    // Aquí NO hay despojado que valga: una clase `--ok` o `--error` es una
    // invitación escrita a pintar de rojo el fichero de otro técnico, y las clases
    // las pone este módulo entero.
    const banco = montar()
    await soltarFixture(nombre)

    for (const el of [banco.raizComp, ...banco.raizComp.querySelectorAll('*')]) {
      for (const clase of el.classList) {
        expect(clase, `clase de mérito en <${el.tagName.toLowerCase()}>: ${clase}`).not.toMatch(
          CLASE_MERITO,
        )
      }
    }
  })

  it('DISPARA: una palabra de mérito PROPIA colada en el cajón lo pone rojo', async () => {
    // Se ensucia el DOM con texto que NO está en la comprobación —o sea, texto «del
    // módulo»— y se exige que el mismo recorrido lo cace. Un guardián que nunca se
    // ha visto fallar no es un guardián.
    const banco = montar()
    await soltarFixture(WFS)
    const c = banco.comprobacion.comprobacion()
    expect(vocabularioPropio(banco.raizComp, c)).not.toMatch(PALABRA_VEREDICTO)

    const intruso = document.createElement('p')
    intruso.textContent = 'La parcela es correcta y apta para presentar.'
    banco.raizComp.append(intruso)

    expect(vocabularioPropio(banco.raizComp, c)).toMatch(PALABRA_VEREDICTO)
  })

  it('DISPARA: una clase de mérito colada en el cajón lo pone rojo', async () => {
    const banco = montar()
    await soltarFixture(WFS)
    const intruso = document.createElement('span')
    intruso.className = 'gml-cajon-cifra--ok'
    banco.raizComp.append(intruso)

    const clases = [...banco.raizComp.querySelectorAll('*')].flatMap((el) => [...el.classList])
    expect(clases.some((c) => CLASE_MERITO.test(c))).toBe(true)
  })

  it('el diagnóstico al que se llega POR ESTA VÍA tampoco dictamina', async () => {
    // El cajón de F07 se vigila en su propia suite, pero por esta vía enseña la
    // parcela de un tercero — que es cuando un adjetivo de más deja de ser un
    // descuido y pasa a ser un juicio sobre el trabajo de otro colegiado.
    const banco = await conDiagnosticoDeFichero(montar())

    const dice = banco.raizDiag.textContent
    expect(dice.length, 'el cajón de diagnóstico está vacío: el guardián sería vacuo')
      .toBeGreaterThan(200)
    expect(dice).not.toMatch(PALABRA_VEREDICTO)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · El paso a través: por qué el guardián NO puede mirar el documento entero
// ═════════════════════════════════════════════════════════════════════════════
//
// Está MEDIDO (T2.2 y T3.1) y esta sección lo deja fijado con el recorrido real,
// para que nadie «arregle» el guardián ampliándolo al texto completo y se lo
// encuentre en rojo permanente — ni, peor, lo apague para que deje de molestar.

describe('F08 · regla de oro 9 · el texto de OTRAS capas atraviesa, y eso no es una infracción', () => {
  it('el informe de un recorrido real CONTIENE «inválida» y «correcto», y los dos son legítimos', async () => {
    const banco = await conDiagnosticoDeFichero(montar())
    banco.diagnostico.descargarInforme()
    await cederTurno()
    // Se APLANA antes de buscar: el informe va justificado a 78 columnas y parte los
    // mensajes de las capas de abajo por donde le toca. Buscarlos literales daría un
    // «no está» falso, que es la clase de verde que no significa nada.
    const plano = aplanar(await banco.entrega.ultimoTexto())

    // Vienen de `gml/decodificar.js`, que habla de BYTES: el fichero del WFS declara
    // ISO-8859-1 y sus bytes son UTF-8, y la prueba de que son UTF-8 es justamente
    // que se decodifican «sin una sola secuencia inválida».
    expect(plano).toContain('sin una sola secuencia inválida')
    expect(plano).toContain('El texto es correcto; lo que está mal es la declaración')
    // O sea: el guardián aplicado al documento entero estaría ROJO aquí, siempre.
    expect(plano).toMatch(PALABRA_VEREDICTO)
  })

  it('…y retirado el pasaje ajeno, lo que el informe escribe POR SU CUENTA queda limpio', async () => {
    // La otra mitad, que es la que convierte lo de arriba en un hecho y no en una
    // excusa: el veredicto venía del mensaje que atraviesa, no de la plantilla.
    const banco = await conDiagnosticoDeFichero(montar())
    banco.diagnostico.descargarInforme()
    await cederTurno()

    const c = banco.comprobacion.comprobacion()
    let plano = aplanar(await banco.entrega.ultimoTexto())
    for (const ajeno of textoAjeno(c)
      .map(aplanar)
      .sort((a, b) => b.length - a.length)) {
      plano = plano.split(ajeno).join(' ')
    }

    expect(plano.trim().length, 'el despojado se ha llevado el informe entero').toBeGreaterThan(
      1000,
    )
    expect(plano).not.toMatch(PALABRA_VEREDICTO)
    // Y la nota legal, que SÍ es del informe, sigue ahí después del despojado: es la
    // prueba de que se ha quitado el pasaje ajeno y no la plantilla entera.
    expect(plano).toContain('La aplicación mide; el colegiado interpreta y firma')
  })
})

/* -------------------------------------------------------------------------- *
 * ⛔ LO QUE ESTA SUITE **NO** PUEDE CUBRIR, DICHO CON TODAS LAS LETRAS         *
 *                                                                              *
 * jsdom no tiene motor de layout, ni rasterizador, ni un gestor de ventanas    *
 * que entregue ficheros de verdad. Nada de lo que sigue se puede afirmar aquí  *
 * sin mentir.                                                                  *
 *                                                                              *
 * ── Lo mide `scripts/smoke-navegador/10-comprobar-gml.js` (T6.2) ──           *
 *   (n1) **Que soltar un fichero DE VERDAD funcione.** Aquí el `drop` se       *
 *        fabrica con un `Event` y un doble de `dataTransfer`, porque jsdom no  *
 *        implementa ni `DataTransfer` ni `DragEvent`: lo que se ejercita es el *
 *        oyente, no el gesto. Solo un navegador real puede decir que el        *
 *        arrastre llega.                                                       *
 *   (n2) **Que el cajón de comprobación no TAPE la barra de edición ni el      *
 *        cajón de F07**, con los que comparte esquina. Son medidas de          *
 *        `getBoundingClientRect` y aquí todas valen 0.                         *
 *   (n3) **Que la caja de vértices siga en 267 px** — la prueba de que la      *
 *        Decisión 5 se cumplió y F08 costó 0 px de panel.                      *
 *   (n4) **Que el fichero del informe llegue a la carpeta de descargas.** Aquí *
 *        se comprueban los BYTES del Blob y el `download` del ancla, que es    *
 *        todo lo que se puede comprobar sin un navegador: el `click()` está    *
 *        sustituido porque el de jsdom intenta navegar.                        *
 *   (n5) **Cuánto tarda** el recorrido completo sobre un fichero de verdad.    *
 *                                                                              *
 * ── Queda para el checklist humano (§9 de `CHECKLIST-HUMANO.md`) ──           *
 *   (h1) **Si el cajón de comprobación se entiende sin que nadie lo explique.***
 *   (h2) **Si alguna nota se LEE como una regañina** —o peor, como un          *
 *        veredicto sobre el trabajo de otro técnico— aunque el guardián        *
 *        mecánico del § 9 esté en verde. Ese punto hereda el carácter          *
 *        BLOQUEANTE de la §8 de F07: ninguna máquina puede firmarlo.           *
 *   (h3) **Si «se cumple a medias» del AC4 se acepta como cierre de fase.**    *
 *        El test lo declara; que sea suficiente para dar F08 por hecha es una  *
 *        decisión de producto, no una aserción.                                *
 *   (h4) **Que el recorrido de F05 → F06 → F07 siga igual.** F08 escribe en el *
 *        store desde un TERCER sitio; que traer una parcela por referencia     *
 *        catastral siga funcionando y que el historial no se ensucie con la    *
 *        carga de un fichero se mira a mano, con la app viva.                  *
 * -------------------------------------------------------------------------- */

/* -------------------------------------------------------------------------- *
 * test/app/catastro.dom.test.js — F05 · T3B · el cable del Catastro             *
 *                                                                              *
 * `services/catastro.js` está terminado y probado hasta el motivo; `index.html` *
 * tiene el campo, los dos botones y las tres cajas vacías. Este fichero prueba  *
 * LO QUE HAY EN MEDIO, que no lo prueba nadie más y que, roto, deja la suite en *
 * verde y al usuario con la parcela del vecino en el expediente.                *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelve a probar el cliente (`test/services/catastro.test.js`), ni el    *
 * lector del WFS, ni el del OVC, ni el modelo. Se prueba el CABLE: que dos      *
 * consultas encabalgadas no se pisen, que el botón vuelva a encenderse aunque   *
 * la consulta reviente, que la deducción pregunte por un punto INTERIOR y no    *
 * por el centroide, que con varios candidatos no se rellene nada, y que lo que  *
 * entra en el store lleve `geometriaOficial` y `superficieCatastral`.           *
 *                                                                              *
 * ── DECISIÓN 1 · LA CÁSCARA SE LEE DE `index.html`, NO SE COPIA ──             *
 * El marcado es CONTRATO entre `index.html` y este cableado (los `data-*`, el   *
 * `disabled` con el que nace «Deducir del mapa», el `hidden` de la lista). Una  *
 * copia a mano aquí podría quedarse en verde con un `index.html` ya roto, que   *
 * es exactamente el fallo que el contrato pretende evitar. Se monta el `<body>` *
 * REAL leído del disco.                                                         *
 *                                                                              *
 * ── DECISIÓN 2 · EL «CLIENTE DOBLE» ES EL CLIENTE DE VERDAD ──                 *
 * Lo que se dobla es el TRANSPORTE, no el cliente: `crearClienteCatastro` es el *
 * real y sirve las respuestas de los fixtures capturados con `curl` el          *
 * 2026-07-27. Así los `motivo`, la `procedencia`, la separación de la parcela   *
 * propia y —sobre todo— la `ParcelaGml` que acaba en el store salen del código  *
 * real y no de una imitación mía. **La suite no llama al Catastro jamás**: el   *
 * transporte doble no conoce `fetch`.                                           *
 *   · Un doble del cliente entero se usa SOLO donde hace falta provocar algo    *
 *     que el cliente real no puede producir: una excepción, o un `motivo` que   *
 *     no está en su catálogo.                                                   *
 *                                                                              *
 * ── DECISIÓN 3 · EL TRANSPORTE PUEDE RESOLVER FUERA DE ORDEN, Y A MANO ──      *
 * `crearTransporteDoble({manual: true})` deja cada petición PENDIENTE y da al   *
 * test un `responder()` por petición. Es la única forma de montar el caso que   *
 * el token de secuencia existe para cubrir: que la primera consulta conteste    *
 * BIEN y TARDE, después de la segunda. Con resoluciones en orden, ese test      *
 * pasaría sin token y no probaría nada.                                         *
 *   · `responder()` respeta la señal (si se abortó, contesta `CANCELADA`, que   *
 *     es lo que hace el transporte real).                                        *
 *   · `responderPeseAlAborto()` contesta con el cuerpo AUNQUE la señal esté     *
 *     abortada: modela «la respuesta ya venía por el cable cuando llegó el      *
 *     abort», que es justo el caso en el que abortar no basta.                   *
 *                                                                              *
 * ── MUTACIONES EJECUTADAS PARA COMPROBAR QUE LOS GUARDIANES NO SON VACUOS ──   *
 * Cada una se aplicó a `app/cableado-catastro.js`, se corrió `npm run test:dom` *
 * y se revirtió con el editor (nunca con `git checkout`).                       *
 *   M1 · `vigente: true` fijo en `operar` (sin token) → 3 rojos, entre ellos «el *
 *        store acaba con la parcela de la SEGUNDA»: la primera, que contesta    *
 *        después, pisa el store. Es la prueba de que el abortador NO basta: la  *
 *        señal estaba abortada y aun así el dato viejo entró.                    *
 *   M2 · quitar `enVuelo.abort()` de `operar` → 1 rojo, «la consulta nueva      *
 *        ABORTA la anterior». Y ningún otro: la prueba del token sigue verde    *
 *        sin abortador, que es la otra mitad de por qué hacen falta las dos.     *
 *   M3 · sacar `refrescar` del `finally` (dejarlo sólo en el camino de éxito) → *
 *        2 rojos, «el botón se REHABILITA aunque la consulta reviente».          *
 *   M4 · `nodo()` sin la comprobación de `null` → 6 rojos, los seis casos del   *
 *        contrato con `index.html`.                                              *
 *   M5 · `destruir()` sin `secuencia += 1` ni `abort()` → 2 rojos: «aborta lo   *
 *        que esté en vuelo» y «lo que llegue después NO escribe en el store».    *
 *   M6 · deducir con el centroide aritmético en vez de `puntoInterior` → 1      *
 *        rojo, «es un punto DENTRO de la parcela, no el centroide».              *
 *   M7 · publicar las `detecciones` de `puntoInterior` en el panel → 1 rojo,    *
 *        «NO republica las detecciones».                                         *
 *   M8 · rellenar el campo con `candidatos[0]` también cuando hay varios → 1    *
 *        rojo, «NO rellena nada».                                                *
 *   M9 · `geometriaOficial: null` en `crearParcela` → 1 rojo, «la parcela       *
 *        cargada lleva su GEOMETRÍA OFICIAL».                                    *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

import {
  MENSAJE_FALLO_INESPERADO,
  ROTULO_DEDUCIDA,
  SELECTOR_BOTON_CARGAR,
  SELECTOR_BOTON_DEDUCIR,
  SELECTOR_CAMPO_REFCAT,
  SELECTOR_CANDIDATOS,
  SELECTOR_ESTADO_CATASTRO,
  SELECTOR_PROCEDENCIA,
  cablearCatastro,
} from '../../app/cableado-catastro.js'
import { crearPanelAvisos } from '../../app/avisos.js'
import { ORIGEN_PUNTO, puntoInterior } from '../../gml/anillos.js'
import { parsearGml } from '../../gml/parse.js'
import { ORIGEN_PARCELA, TIPO_RECINTO, crearParcela, crearRecinto } from '../../model/parcela.js'
import { MOTIVO_CATASTRO, ORIGEN, crearClienteCatastro } from '../../services/catastro.js'
import { NIVEL, crearEstadoVista } from '../../viewer/_comun.js'

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

// `import.meta.dirname` y no `fileURLToPath(import.meta.url)`: bajo jsdom la URL
// del módulo no es de esquema `file:` y aquella conversión lanza. Mismo camino que
// `test/app/main-gml.dom.test.js`.
const RAIZ = join(import.meta.dirname, '..', '..')

/**
 * El `<body>` de `index.html` tal cual está en el disco. El `<script
 * type="module">` que lleva dentro NO se ejecuta al asignarlo por `innerHTML`
 * (jsdom no evalúa scripts insertados así), que es justo lo que se quiere: aquí
 * no se arranca la app, sólo se cablea el bloque del Catastro.
 */
const CUERPO_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/catastro.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara ' +
        'de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

const montarCascara = () => {
  document.body.innerHTML = CUERPO_INDEX
}

// ── Los fixtures, y todo lo que se DERIVA de ellos ───────────────────────────
//
// Cero listas escritas a mano: las referencias catastrales, las superficies, los
// vértices y los domicilios salen de parsear los ficheros reales con el parser
// real. Si mañana se recaptura un fixture, estas pruebas le siguen solas.

const leer = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')

const FIXTURES_GML = ['test', 'fixtures', 'gml']
const FIXTURES_CATASTRO = ['test', 'fixtures', 'catastro']

/** `GetParcel` de la parcela real (1 miembro). */
const TEXTO_PARCELA = leer(...FIXTURES_GML, 'cp_parcela_9398516VK3799G.gml')
/** `GetNeighbourParcel`: 5 miembros para 4 colindantes, con la propia en 2.ª. */
const TEXTO_VECINDAD = leer(...FIXTURES_CATASTRO, 'wfs-neighbour-9398516VK3799G.xml')
/** `ExceptionReport` de una referencia que no existe. */
const TEXTO_INEXISTENTE = leer(...FIXTURES_CATASTRO, 'wfs-exceptionreport-rc-inexistente.xml')
/** `Consulta_RCCOOR` con UN candidato. */
const TEXTO_RCCOOR_OK = leer(...FIXTURES_CATASTRO, 'ovc-rccoor-ok.json')
/** `Consulta_RCCOOR` con `cod 16`: «para esas coordenadas no hay referencia». */
const TEXTO_RCCOOR_SIN = leer(...FIXTURES_CATASTRO, 'ovc-rccoor-cod16.json')

/** La parcela real, ya parseada. De aquí salen refcat, superficie y vértices. */
const PARCELA_FIXTURE = parsearGml(TEXTO_PARCELA).parcelas[0]
const REFCAT = PARCELA_FIXTURE.refcat

/** Las cinco de la consulta de vecindad, con la propia dentro (trampa 2 de F05). */
const VECINDAD_FIXTURE = parsearGml(TEXTO_VECINDAD).parcelas
/** Una parcela REAL distinta de la anterior, para las carreras de dos consultas. */
const VECINA = VECINDAD_FIXTURE.find((p) => p.refcat !== REFCAT)

/** Envoltorio del JSON del OVC, tal como lo escribe el servicio. */
const CLAVE_RCCOOR = 'Consulta_RCCOORResult'

/**
 * `Consulta_RCCOOR` con DOS candidatos. El servicio nunca devolvió dos en las 8
 * capturas de `PROCEDENCIA.md`, así que se DUPLICA el candidato real del fixture
 * (mismo camino que `test/services/catastro-ovc.test.js`): la referencia del
 * segundo es la de una parcela REAL de la consulta de vecindad, partida en `pc1` +
 * `pc2` como hace el propio OVC. Lo único inventado es el número de la calle del
 * segundo domicilio, y hace falta: sin dos domicilios DISTINTOS no se puede
 * comprobar que cada fila lleva el suyo, que es lo único que permite elegir.
 */
const TEXTO_RCCOOR_VARIOS = (() => {
  const cuerpo = JSON.parse(TEXTO_RCCOOR_OK)
  const uno = cuerpo[CLAVE_RCCOOR].coordenadas.coord[0]
  const otro = structuredClone(uno)
  otro.pc = { pc1: VECINA.refcat.slice(0, 7), pc2: VECINA.refcat.slice(7) }
  otro.ldt = uno.ldt.replace(/\b\d+\b/, '74')
  cuerpo[CLAVE_RCCOOR].coordenadas.coord = [uno, otro]
  return JSON.stringify(cuerpo)
})()

const SRS = 'EPSG:25830'

/** Instante FIJO: la hora sale por pantalla en el renglón de procedencia. */
const INSTANTE = new Date(Date.UTC(2026, 6, 27, 10, 15, 0))
/** El mismo instante para el reloj del CLIENTE, que trabaja en milisegundos. */
const AHORA_MS = INSTANTE.getTime()
const DIA_MS = 86_400_000

/**
 * Parcela en forma de L, construida a mano y con motivo: **ningún fixture tiene un
 * contorno reentrante**, y sin uno no se puede demostrar la trampa que
 * `puntoInterior` existe para esquivar (el centroide aritmético cae FUERA). Se
 * construye con `model/parcela.js` para que los invariantes del modelo sigan
 * garantizados; lo peculiar es la forma, no la estructura. Mismo criterio que
 * `parcelaCruzada` en `test/app/main-gml.dom.test.js`.
 */
const recintosEnEle = () => [
  crearRecinto(
    [
      [439300, 4479650],
      [439340, 4479650],
      [439340, 4479660],
      [439310, 4479660],
      [439310, 4479690],
      [439300, 4479690],
    ],
    TIPO_RECINTO.EXTERIOR,
  ),
]

/** El centroide ARITMÉTICO de un anillo: lo que NO se debe consultar. */
function centroideDe(recintos) {
  const v = recintos[0].vertices
  return [
    v.reduce((suma, par) => suma + par[0], 0) / v.length,
    v.reduce((suma, par) => suma + par[1], 0) / v.length,
  ]
}

/** Parcela SIN referencia catastral: el estado en el que deducir tiene sentido. */
const parcelaSinReferencia = (recintos = recintosEnEle()) =>
  crearParcela({ idLocal: 'sin-refcat', origen: ORIGEN_PARCELA.DXF, recintos })

/** Parcela CON referencia: el estado en el que deducir no tiene ningún sentido. */
const parcelaConReferencia = () =>
  crearParcela({
    idLocal: REFCAT,
    refcat: REFCAT,
    origen: ORIGEN_PARCELA.WFS,
    recintos: PARCELA_FIXTURE.recintos,
  })

// ── El transporte doble ──────────────────────────────────────────────────────

/**
 * Un `ResultadoHttp` con éxito. La forma es la de `services/_red.js`; el `texto`
 * es el fixture, byte a byte.
 */
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
 * Un `ResultadoHttp` cancelado. El `motivo` se toma de {@link MOTIVO_CATASTRO} y no
 * del `MOTIVO_RED` de `services/_red.js`: los cuatro motivos del transporte se
 * llaman IGUAL en el vocabulario público (la traducción se DERIVA de las claves,
 * ver `services/catastro.js`), así que este test no necesita importar un módulo
 * privado para nombrar el mismo código.
 */
const httpCancelada = (url) => ({
  ok: false,
  estado: null,
  texto: null,
  tipoContenido: null,
  motivo: MOTIVO_CATASTRO.CANCELADA,
  mensaje: 'La petición se ha cancelado: el llamante abortó la señal.',
  intentos: 0,
  ms: 1,
  url,
})

/**
 * Transporte doble: cumple el puerto que `crearClienteCatastro` exige
 * (`pedirTexto`, `estado`, `destruir`) y sirve fixtures según la URL. **No conoce
 * `fetch`**: es imposible que esta suite toque la red.
 *
 * @param {object} [opciones]
 * @param {boolean} [opciones.manual=false]  Deja cada petición PENDIENTE.
 * @param {string} [opciones.rccoor]  Qué contesta el OVC.
 * @param {string|null} [opciones.parcela=null]  Qué contesta `GetParcel` (por
 *   defecto, el fixture que corresponda a la referencia pedida).
 */
function crearTransporteDoble({ manual = false, rccoor = TEXTO_RCCOOR_OK, parcela = null } = {}) {
  const peticiones = []
  let emitidas = 0

  function cuerpoDe(url) {
    if (url.includes('Consulta_RCCOOR')) return rccoor
    if (url.includes('GetNeighbourParcel')) return TEXTO_VECINDAD
    if (parcela !== null) return parcela
    const pedida = /[?&]refcat=([^&]*)/.exec(url)[1]
    if (pedida === REFCAT) return TEXTO_PARCELA
    // Cualquier referencia de la consulta de vecindad se sirve con esa colección:
    // el cliente separa la propia POR REFERENCIA, nunca por posición, así que
    // devuelve la que se pidió. Es dato real y evita inventarse un segundo GML.
    if (VECINDAD_FIXTURE.some((p) => p.refcat === pedida)) return TEXTO_VECINDAD
    return TEXTO_INEXISTENTE
  }

  return {
    peticiones,
    get emitidas() {
      return emitidas
    },
    async pedirTexto(url, { senal = null } = {}) {
      emitidas += 1
      let resolver
      const promesa = new Promise((cumplir) => {
        resolver = cumplir
      })
      const peticion = {
        url,
        senal,
        /** Contesta como el transporte real: si la señal se abortó, `CANCELADA`. */
        responder: () =>
          resolver(senal !== null && senal.aborted ? httpCancelada(url) : http200(url, cuerpoDe(url))),
        /** Contesta con el cuerpo AUNQUE se haya abortado: ya venía por el cable. */
        responderPeseAlAborto: () => resolver(http200(url, cuerpoDe(url))),
      }
      peticiones.push(peticion)
      if (!manual) peticion.responder()
      return promesa
    },
    estado: () => ({ peticiones: emitidas }),
    destruir() {},
  }
}

/**
 * Caché doble: devuelve SIEMPRE la misma entrada (o nada) y apunta lo guardado.
 *
 * ⚠️ Lo que se guarda es **el texto crudo del GML**, no el POJO ya parseado: es el
 * contrato que fija `services/catastro.js#leerColeccionDeCache` («los bytes son la
 * verdad externa; el árbol es una interpretación de hoy»). Aquí eso viene de perlas,
 * porque el valor cacheado acaba siendo el fixture real byte a byte.
 */
function crearCacheDoble({ valor = null, guardadoEn = null } = {}) {
  const guardados = []
  return {
    guardados,
    leer: async () => (valor === null ? null : { valor, guardadoEn }),
    guardar: async (clave, dato, meta) => {
      guardados.push({ clave, dato, meta })
    },
  }
}

// ── Arnés ────────────────────────────────────────────────────────────────────

/**
 * Monta store + panel + cliente REAL sobre transporte doble + cableado, sobre la
 * cáscara ya presente en el documento.
 *
 * El store se envuelve para CONTAR los `set`: «una carga con éxito hace un solo
 * `estado.set`» no se puede afirmar mirando el resultado final.
 */
function cablear(opciones = {}) {
  const {
    parcelaInicial = null,
    transporte = crearTransporteDoble(),
    cache,
    ahoraMs = AHORA_MS,
    ...resto
  } = opciones

  const real = crearEstadoVista(parcelaInicial)
  const sets = []
  const estado = {
    get: real.get,
    set(parcela) {
      sets.push(parcela)
      real.set(parcela)
    },
    subscribe: real.subscribe,
  }

  const panel = crearPanelAvisos({
    contenedor: document.getElementById('avisos'),
    chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
    chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
  })

  const cliente = crearClienteCatastro({ transporte, cache, srs: SRS, ahora: () => ahoraMs })

  const cableado = cablearCatastro({
    estado,
    panel,
    cliente,
    srs: SRS,
    ahora: () => INSTANTE,
    ...resto,
  })

  return {
    estado,
    sets,
    panel,
    transporte,
    cliente,
    cableado,
    campo: document.querySelector(SELECTOR_CAMPO_REFCAT),
    botonCargar: document.querySelector(SELECTOR_BOTON_CARGAR),
    botonDeducir: document.querySelector(SELECTOR_BOTON_DEDUCIR),
    renglon: document.querySelector(SELECTOR_ESTADO_CATASTRO),
    procedencia: document.querySelector(SELECTOR_PROCEDENCIA),
    lista: document.querySelector(SELECTOR_CANDIDATOS),
  }
}

/** Textos de las tarjetas del panel de avisos, en el orden en que se ven. */
const textosDelPanel = () =>
  [...document.querySelectorAll('#avisos .gml-aviso-texto')].map((t) => t.textContent)

/** La tarjeta cuyo texto es exactamente `mensaje`, o `null`. */
const tarjetaDe = (mensaje) =>
  [...document.querySelectorAll('#avisos .gml-aviso')].find(
    (t) => t.querySelector('.gml-aviso-texto').textContent === mensaje,
  ) ?? null

/** ¿Está el renglón en estado de fallo (el modificador rojo del CSS)? */
const renglonEnFallo = (renglon) => renglon.classList.contains('gml-accion-estado--error')

/** Emisor doble del mapa: `on`/`off` y nada más (DUCK TYPING, sin Leaflet). */
function crearMapaDoble() {
  const oyentes = new Map()
  return {
    oyentes,
    on(suceso, fn) {
      if (!oyentes.has(suceso)) oyentes.set(suceso, new Set())
      oyentes.get(suceso).add(fn)
    },
    off(suceso, fn) {
      if (oyentes.has(suceso)) oyentes.get(suceso).delete(fn)
    },
    emitir(suceso, evento) {
      for (const fn of oyentes.get(suceso) ?? []) fn(evento)
    },
  }
}

/**
 * Cede el turno unas cuantas veces al bucle de microtareas.
 *
 * Hace falta porque entre `cargar()` y el `pedirTexto` del transporte hay VARIOS
 * `await` del cliente real —la consulta a la caché, que es lo primero que hace, es
 * asíncrona por contrato—, así que la petición **no existe en el mismo tick** del
 * clic. Lo que sí es síncrono es el estado de los botones y el abortador: eso se
 * afirma sin ceder nada, y a propósito.
 */
async function cederTurno(veces = 20) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

/** Cede el turno hasta que el transporte haya emitido `cuantas` peticiones. */
async function hastaPeticion(transporte, cuantas) {
  for (let vuelta = 0; vuelta < 50 && transporte.peticiones.length < cuantas; vuelta += 1) {
    await Promise.resolve()
  }
  expect(transporte.peticiones.length, 'el transporte no ha llegado a emitir la petición').toBe(
    cuantas,
  )
}

/** Las coordenadas UTM de la última consulta al OVC, leídas de su URL. */
function puntoConsultado(transporte) {
  const url = new URL(transporte.peticiones.at(-1).url)
  return [Number(url.searchParams.get('CoorX')), Number(url.searchParams.get('CoorY'))]
}

beforeEach(montarCascara)

// ── 1 · Contrato con `index.html` ────────────────────────────────────────────

describe('cableado-catastro · el marcado de index.html es CONTRATO', () => {
  it.each([
    ['el campo de la referencia', SELECTOR_CAMPO_REFCAT],
    ['el botón de cargar', SELECTOR_BOTON_CARGAR],
    ['el botón de deducir', SELECTOR_BOTON_DEDUCIR],
    ['el renglón de estado', SELECTOR_ESTADO_CATASTRO],
    ['el renglón de procedencia', SELECTOR_PROCEDENCIA],
    ['la lista de candidatos', SELECTOR_CANDIDATOS],
  ])('falta %s ⇒ lanza NOMBRANDO el selector', (_caso, selector) => {
    document.querySelector(selector).remove()
    expect(() => cablear()).toThrow(selector)
  })

  it('la guarda NO es vacua: index.html trae los seis nodos, y en su estado inicial', () => {
    for (const selector of [
      SELECTOR_CAMPO_REFCAT,
      SELECTOR_BOTON_CARGAR,
      SELECTOR_BOTON_DEDUCIR,
      SELECTOR_ESTADO_CATASTRO,
      SELECTOR_PROCEDENCIA,
      SELECTOR_CANDIDATOS,
    ]) {
      expect(document.querySelector(selector), selector).not.toBeNull()
    }
    // «Deducir del mapa» nace apagado en el HTML: deducir sólo tiene sentido con
    // geometría y sin referencia, y ofrecerlo antes prometería lo que no se puede.
    expect(document.querySelector(SELECTOR_BOTON_DEDUCIR).disabled).toBe(true)
    // La lista nace oculta: una lista visible y vacía AFIRMARÍA que no se encontró
    // nada, que es otra cosa muy distinta de que aún no se haya deducido.
    expect(document.querySelector(SELECTOR_CANDIDATOS).hidden).toBe(true)
    // Y el renglón se anuncia sin robar el foco.
    expect(document.querySelector(SELECTOR_ESTADO_CATASTRO).getAttribute('role')).toBe('status')
  })

  it('sin nodos explícitos los localiza solo (es como lo llamará `app/main.js`)', () => {
    expect(() => cablear()).not.toThrow()
  })

  it('un `cliente` que no lo es se rechaza al cablear, no en el primer clic', () => {
    expect(() =>
      cablearCatastro({ estado: crearEstadoVista(null), panel: null, cliente: {}, srs: SRS }),
    ).toThrow(/cliente/)
  })

  it('un `mapa` que no emite se rechaza al cablear', () => {
    expect(() => cablear({ mapa: { on: 1 } })).toThrow(/mapa/)
  })

  it('un `srs` que no es un huso soportado se rechaza al cablear', () => {
    expect(() => cablear({ srs: 'EPSG:4326' })).toThrow()
  })
})

// ── 2 · Traer del Catastro: el camino feliz ──────────────────────────────────

describe('cableado-catastro · cargar la parcela real del fixture', () => {
  it('hace UN SOLO `estado.set`, y con lo que exige el modelo de F05', async () => {
    const montado = cablear()
    montado.campo.value = REFCAT
    await montado.cableado.cargar()

    expect(montado.sets).toHaveLength(1)
    const parcela = montado.sets[0]
    expect(parcela.origen).toBe(ORIGEN_PARCELA.WFS)
    expect(parcela.refcat).toBe(REFCAT)
    // La superficie que el Catastro DECLARA, tal cual: es el término de comparación
    // del diagnóstico, y se derivan del fixture las dos cifras.
    expect(parcela.superficieCatastral).toBe(PARCELA_FIXTURE.areaValue)
    expect(parcela.recintos[0].vertices).toEqual(PARCELA_FIXTURE.recintos[0].vertices)
  })

  it('la parcela cargada lleva su GEOMETRÍA OFICIAL, congelada y aparte', async () => {
    // Regla de oro 2: `geometriaOficial` es lo que dijo el Catastro y no se muta
    // nunca. Sin ella, F07 compararía la geometría del usuario consigo misma.
    const montado = cablear()
    montado.campo.value = REFCAT
    await montado.cableado.cargar()

    const parcela = montado.sets[0]
    expect(parcela.geometriaOficial).not.toBeNull()
    expect(parcela.geometriaOficial[0].vertices).toEqual(parcela.recintos[0].vertices)
    // Copia INDEPENDIENTE, no la misma referencia: editar un vértice no puede
    // arrastrar consigo el original.
    expect(parcela.geometriaOficial[0].vertices).not.toBe(parcela.recintos[0].vertices)
    expect(Object.isFrozen(parcela.geometriaOficial[0].vertices)).toBe(true)
  })

  it('⚠️ cargar el fixture REAL no produce ni un `console.warn`', async () => {
    // `crearRecinto` avisa por consola si le llega un anillo CERRADO, y `parsearGml`
    // los entrega abiertos. Si algún día uno de los dos cambiara de criterio, el
    // usuario vería la app llena de avisos que no entiende y esta prueba lo dice
    // antes. Se espía la consola porque un aviso a consola es, por definición,
    // invisible desde el DOM.
    const consola = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const montado = cablear()
    montado.campo.value = REFCAT
    await montado.cableado.cargar()
    expect(consola).not.toHaveBeenCalled()
    consola.mockRestore()
  })

  it('el renglón cuenta el desenlace sin marcar fallo, y no ensucia el panel', async () => {
    const montado = cablear()
    montado.campo.value = REFCAT
    await montado.cableado.cargar()

    expect(montado.renglon.textContent).toContain(REFCAT)
    expect(renglonEnFallo(montado.renglon)).toBe(false)
    expect(montado.panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })

  it('`data-procedencia` dice que viene del servicio, y a qué hora', async () => {
    const montado = cablear()
    montado.campo.value = REFCAT
    const resultado = await montado.cableado.cargar()

    expect(resultado.procedencia.origen).toBe(ORIGEN.RED)
    // La hora se calcula aquí por separado (no se importa la del módulo): así la
    // prueba es inmune a la versión de ICU y sigue afirmando algo exacto.
    const hora = new Intl.DateTimeFormat('es-ES', { hour: '2-digit', minute: '2-digit' }).format(
      INSTANTE,
    )
    expect(montado.procedencia.textContent).toContain(hora)
  })

  it('el campo se queda con la referencia CANÓNICA que el Catastro ha confirmado', async () => {
    // Se teclea como la copia la gente de la Sede: con espacios y en minúsculas.
    const montado = cablear()
    montado.campo.value = ` ${REFCAT.slice(0, 7)} ${REFCAT.slice(7).toLowerCase()} `
    await montado.cableado.cargar()
    expect(montado.campo.value).toBe(REFCAT)
  })
})

// ── 3 · Traer del Catastro: cuando no hay dato ───────────────────────────────

describe('cableado-catastro · la consulta no trae parcela', () => {
  it('una referencia inexistente NO toca el store y lo cuenta por los dos sitios', async () => {
    const montado = cablear()
    // Referencia con FORMA válida (14 alfanuméricos) que el servicio no conoce: es
    // lo que hace que la consulta salga y vuelva con el `ExceptionReport` del
    // fixture, en vez de morir en la validación de forma.
    montado.campo.value = '0000000XX0000X'
    const resultado = await montado.cableado.cargar()

    expect(resultado.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    expect(montado.sets).toHaveLength(0)
    expect(montado.estado.get()).toBeNull()
    // El mensaje ÍNTEGRO del cliente al panel: es el único sitio donde cabe.
    expect(textosDelPanel()).toContain(resultado.mensaje)
    // Y en el nivel que decide `NIVEL_POR_MOTIVO`, que para F05 es SIEMPRE aviso:
    // que el Catastro no tenga la parcela no bloquea generar el GML a mano.
    expect(tarjetaDe(resultado.mensaje).dataset.nivel).toBe(NIVEL.AVISO)
    expect(montado.panel.resumen()[NIVEL.ERROR]).toBe(0)
    // El renglón lleva el RESUMEN, no el mensajón: cabe en una línea de 11 px.
    expect(montado.renglon.textContent.length).toBeLessThan(resultado.mensaje.length)
    expect(renglonEnFallo(montado.renglon)).toBe(true)
  })

  it('el campo vacío no llega a la red: se resuelve como entrada inválida', async () => {
    const montado = cablear()
    montado.campo.value = ''
    const resultado = await montado.cableado.cargar()

    expect(resultado.motivo).toBe(MOTIVO_CATASTRO.ENTRADA_INVALIDA)
    expect(montado.transporte.emitidas).toBe(0)
    expect(montado.renglon.textContent.length).toBeGreaterThan(0)
  })

  it('un fallo NO borra la procedencia del dato que sigue en el store', async () => {
    // Lo que hay cargado sigue viniendo de donde venía: borrar el renglón porque
    // una consulta POSTERIOR ha fallado sería mentir por omisión sobre el dato que
    // el usuario tiene delante.
    const montado = cablear()
    montado.campo.value = REFCAT
    await montado.cableado.cargar()
    const antes = montado.procedencia.textContent
    expect(antes.length).toBeGreaterThan(0)

    montado.campo.value = '0000000XX0000X'
    await montado.cableado.cargar()
    expect(montado.procedencia.textContent).toBe(antes)
  })

  it('un motivo que este cableado no conoce no deja el renglón en blanco', async () => {
    // El catálogo del cliente está cubierto por un guardián de carga, así que este
    // caso no puede salir del cliente real: se provoca con un doble. Un renglón
    // vacío tras pulsar un botón es la definición de error silencioso.
    const clienteRaro = {
      parcelaPorRefcat: async () => ({
        ok: false,
        datos: null,
        motivo: 'UN_MOTIVO_QUE_NO_EXISTE',
        mensaje: 'El cliente ha devuelto un motivo de otro planeta.',
        procedencia: { origen: ORIGEN.LOCAL, edadMs: null, intentos: 0, ms: 0, url: null },
      }),
      parcelaYColindantes: async () => {},
      refcatPorCoordenada: async () => {},
    }
    const montado = cablear({ cliente: clienteRaro })
    await montado.cableado.cargar()

    expect(montado.renglon.textContent.length).toBeGreaterThan(0)
    expect(renglonEnFallo(montado.renglon)).toBe(true)
    // Y el nivel cae al suelo seguro: nunca se inventa un bloqueo.
    expect(montado.panel.resumen()[NIVEL.AVISO]).toBe(1)
  })
})

// ── 4 · La procedencia de la caché ───────────────────────────────────────────

describe('cableado-catastro · una parcela que sale de la copia local', () => {
  const seisDias = () =>
    cablear({
      cache: crearCacheDoble({ valor: TEXTO_PARCELA, guardadoEn: AHORA_MS - 6 * DIA_MS }),
    })

  it('se carga sin tocar la red y el renglón de procedencia dice su edad', async () => {
    const montado = seisDias()
    montado.campo.value = REFCAT
    const resultado = await montado.cableado.cargar()

    expect(resultado.procedencia.origen).toBe(ORIGEN.CACHE)
    expect(montado.transporte.emitidas).toBe(0)
    expect(montado.sets).toHaveLength(1)

    // «hace 6 días», calculado aquí por separado con el mismo Intl.
    const edad = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' }).format(-6, 'day')
    expect(montado.procedencia.textContent).toContain(edad)
  })

  it('y además salta al panel: el renglón gris de 11 px se lee poco', async () => {
    const montado = seisDias()
    montado.campo.value = REFCAT
    await montado.cableado.cargar()
    expect(montado.panel.resumen()[NIVEL.AVISO]).toBe(1)
    expect(textosDelPanel()[0]).toContain(REFCAT)
  })

  it('una carga de RED no deja esa tarjeta: no hay nada que advertir', async () => {
    const montado = cablear()
    montado.campo.value = REFCAT
    await montado.cableado.cargar()
    expect(montado.panel.resumen()[NIVEL.AVISO]).toBe(0)
  })
})

// ── 5 · Las dos defensas contra la carrera ───────────────────────────────────
//
// Aquí está el corazón de la tarea. Las dos pruebas de abajo son distintas a
// propósito: una mide el ABORTADOR (que la red se corta) y la otra el TOKEN (que
// una respuesta lenta y ya superada no escribe). Ninguna de las dos cubre a la
// otra, y por eso hacen falta las dos defensas.

describe('cableado-catastro · dos consultas encabalgadas', () => {
  it('⚠️ el store acaba con la parcela de la SEGUNDA, aunque la primera conteste después', async () => {
    const transporte = crearTransporteDoble({ manual: true })
    const montado = cablear({ transporte })

    montado.campo.value = REFCAT
    const primera = montado.cableado.cargar()
    montado.campo.value = VECINA.refcat
    const segunda = montado.cableado.cargar()

    await hastaPeticion(transporte, 2)

    // Fuera de orden: contesta antes la SEGUNDA. Y la primera contesta BIEN pese a
    // estar abortada, que es lo que de verdad pasa cuando la respuesta ya venía por
    // el cable: sin token de secuencia, esa respuesta pisaría el store.
    transporte.peticiones[1].responder()
    await segunda
    transporte.peticiones[0].responderPeseAlAborto()
    const resultadoPrimera = await primera

    expect(montado.sets).toHaveLength(1)
    expect(montado.estado.get().refcat).toBe(VECINA.refcat)
    // Y la primera lo DICE: no devuelve un éxito mudo cuyo dato se tiró.
    expect(resultadoPrimera.ok).toBe(false)
    expect(resultadoPrimera.motivo).toBe(MOTIVO_CATASTRO.CANCELADA)
    // Conserva la procedencia real: la consulta costó lo que costó.
    expect(resultadoPrimera.procedencia).not.toBeNull()
  })

  it('⚠️ la consulta nueva ABORTA la anterior: el servicio deja de trabajar en vano', async () => {
    const transporte = crearTransporteDoble({ manual: true })
    const montado = cablear({ transporte })

    montado.campo.value = REFCAT
    const primera = montado.cableado.cargar()
    await hastaPeticion(transporte, 1)
    expect(transporte.peticiones[0].senal.aborted).toBe(false)

    montado.campo.value = VECINA.refcat
    const segunda = montado.cableado.cargar()

    // SÍNCRONO: empezar la segunda corta la primera en el acto, sin esperar a que
    // nadie ceda el turno. El servicio deja de trabajar para una pregunta que ya no
    // interesa, que es lo que de verdad protege del bloqueo.
    expect(transporte.peticiones[0].senal.aborted).toBe(true)

    await hastaPeticion(transporte, 2)
    expect(transporte.peticiones[1].senal.aborted).toBe(false)

    transporte.peticiones[0].responder()
    transporte.peticiones[1].responder()
    await Promise.all([primera, segunda])
  })

  it('la consulta superada no escribe NADA: ni renglón, ni procedencia, ni panel', async () => {
    const transporte = crearTransporteDoble({ manual: true })
    const montado = cablear({ transporte })

    montado.campo.value = REFCAT
    const primera = montado.cableado.cargar()
    montado.campo.value = VECINA.refcat
    const segunda = montado.cableado.cargar()

    await hastaPeticion(transporte, 2)
    transporte.peticiones[1].responder()
    await segunda
    const renglonTrasLaSegunda = montado.renglon.textContent
    const procedenciaTrasLaSegunda = montado.procedencia.textContent

    transporte.peticiones[0].responderPeseAlAborto()
    await primera

    expect(montado.renglon.textContent).toBe(renglonTrasLaSegunda)
    expect(montado.procedencia.textContent).toBe(procedenciaTrasLaSegunda)
    // Avisar de una consulta que el propio usuario ha sustituido es ruido sobre su
    // propia decisión (misma política que `viewer/wms-catastro.js`).
    expect(montado.panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })

  it('mientras hay algo en vuelo los dos botones están apagados, y luego vuelven', async () => {
    const transporte = crearTransporteDoble({ manual: true })
    const montado = cablear({ transporte, parcelaInicial: parcelaSinReferencia() })
    expect(montado.botonDeducir.disabled).toBe(false)

    montado.campo.value = REFCAT
    const enCurso = montado.cableado.cargar()
    // Síncrono, en el mismo tick del clic: no hay una ventana en la que el botón
    // siga pulsable «mientras arranca la consulta».
    expect(montado.botonCargar.disabled).toBe(true)
    expect(montado.botonDeducir.disabled).toBe(true)

    await hastaPeticion(transporte, 1)
    transporte.peticiones[0].responder()
    await enCurso
    expect(montado.botonCargar.disabled).toBe(false)
  })
})

// ── 6 · Un fallo INESPERADO no deja la UI muerta ─────────────────────────────

describe('cableado-catastro · el `await` lanza', () => {
  /** Cliente que revienta, como haría un contrato roto en una capa de abajo. */
  const clienteQueRevienta = () => ({
    parcelaPorRefcat: async () => {
      throw new Error('contrato roto en services/')
    },
    parcelaYColindantes: async () => {
      throw new Error('contrato roto en services/')
    },
    refcatPorCoordenada: async () => {
      throw new Error('contrato roto en services/')
    },
  })

  let consola
  beforeEach(() => {
    consola = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('⚠️ el botón se REHABILITA aunque la consulta reviente', async () => {
    const montado = cablear({ cliente: clienteQueRevienta() })
    montado.campo.value = REFCAT

    await expect(montado.cableado.cargar()).rejects.toThrow()

    // Sin esto, un fallo inesperado deja al usuario con la UI muerta y muda.
    expect(montado.botonCargar.disabled).toBe(false)
  })

  it('y el usuario se entera por los tres canales, sin ver la excepción cruda', async () => {
    const montado = cablear({ cliente: clienteQueRevienta() })
    montado.campo.value = REFCAT
    await expect(montado.cableado.cargar()).rejects.toThrow()

    expect(montado.renglon.textContent).toBe(MENSAJE_FALLO_INESPERADO)
    expect(renglonEnFallo(montado.renglon)).toBe(true)
    expect(textosDelPanel()).toContain(MENSAJE_FALLO_INESPERADO)
    // Un `throw` NO es un motivo del catálogo de F05: es un defecto de
    // programación, y esos sí son bloqueantes.
    expect(tarjetaDe(MENSAJE_FALLO_INESPERADO).dataset.nivel).toBe(NIVEL.ERROR)
    // Y el defecto no se tapa: sale por consola para quien depura.
    expect(consola).toHaveBeenCalled()
    // Pero el texto técnico no se le enseña a quien no programa.
    expect(montado.renglon.textContent).not.toMatch(/contrato roto/)
  })

  it('el clic (que suelta la promesa) tampoco deja la UI muerta', async () => {
    const montado = cablear({ cliente: clienteQueRevienta() })
    montado.campo.value = REFCAT
    montado.botonCargar.click()
    // El manejador suelta la promesa a propósito (ya se ha contado por tres
    // canales); se cede el turno para que el rechazo se procese.
    await cederTurno()

    expect(montado.botonCargar.disabled).toBe(false)
    expect(montado.renglon.textContent).toBe(MENSAJE_FALLO_INESPERADO)
  })
})

// ── 7 · `destruir()` ─────────────────────────────────────────────────────────

describe('cableado-catastro · destruir()', () => {
  it('⚠️ aborta lo que esté en vuelo', async () => {
    const transporte = crearTransporteDoble({ manual: true })
    const montado = cablear({ transporte })
    montado.campo.value = REFCAT
    const enCurso = montado.cableado.cargar()
    await hastaPeticion(transporte, 1)

    montado.cableado.destruir()
    expect(transporte.peticiones[0].senal.aborted).toBe(true)

    transporte.peticiones[0].responder()
    await enCurso
  })

  it('⚠️ y lo que llegue después NO escribe en el store de una pantalla que ya no está', async () => {
    const transporte = crearTransporteDoble({ manual: true })
    const montado = cablear({ transporte })
    montado.campo.value = REFCAT
    const enCurso = montado.cableado.cargar()
    await hastaPeticion(transporte, 1)

    montado.cableado.destruir()
    transporte.peticiones[0].responderPeseAlAborto()
    await enCurso

    expect(montado.sets).toHaveLength(0)
    expect(montado.estado.get()).toBeNull()
  })

  it('retira los oyentes de los dos botones y del mapa', async () => {
    const mapa = crearMapaDoble()
    const montado = cablear({ mapa, parcelaInicial: parcelaSinReferencia() })
    expect(mapa.oyentes.get('click').size).toBe(1)

    montado.cableado.destruir()

    expect(mapa.oyentes.get('click').size).toBe(0)
    montado.botonCargar.click()
    montado.botonDeducir.click()
    await Promise.resolve()
    expect(montado.transporte.emitidas).toBe(0)
  })

  it('deja de seguir al store, y es IDEMPOTENTE', () => {
    const montado = cablear({ parcelaInicial: parcelaSinReferencia() })
    expect(montado.botonDeducir.disabled).toBe(false)

    montado.cableado.destruir()
    montado.estado.set(parcelaConReferencia())
    // Si siguiera suscrito, el botón se habría apagado al entrar una parcela con
    // referencia. Ya no es asunto de este cableado.
    expect(montado.botonDeducir.disabled).toBe(false)

    expect(() => montado.cableado.destruir()).not.toThrow()
  })

  it('tras destruir, las tres acciones devuelven `null` sin consultar nada', async () => {
    const montado = cablear({ parcelaInicial: parcelaSinReferencia() })
    montado.cableado.destruir()
    await expect(montado.cableado.cargar()).resolves.toBeNull()
    await expect(montado.cableado.deducir()).resolves.toBeNull()
    await expect(montado.cableado.colindantes()).resolves.toBeNull()
    expect(montado.transporte.emitidas).toBe(0)
  })
})

// ── 8 · El botón «Deducir del mapa» lo enciende el ESTADO ────────────────────

describe('cableado-catastro · cuándo se puede deducir', () => {
  it('⚠️ apagado con una parcela que YA tiene referencia', () => {
    const montado = cablear({ parcelaInicial: parcelaConReferencia() })
    expect(montado.botonDeducir.disabled).toBe(true)
  })

  it('⚠️ encendido con una parcela que NO tiene referencia', () => {
    const montado = cablear({ parcelaInicial: parcelaSinReferencia() })
    expect(montado.botonDeducir.disabled).toBe(false)
  })

  it('apagado sin nada en el store: no hay desde dónde deducir', () => {
    const montado = cablear({ parcelaInicial: null })
    expect(montado.botonDeducir.disabled).toBe(true)
  })

  it('se re-evalúa con el store, no sólo al cablear', () => {
    const montado = cablear({ parcelaInicial: parcelaSinReferencia() })
    expect(montado.botonDeducir.disabled).toBe(false)
    montado.estado.set(parcelaConReferencia())
    expect(montado.botonDeducir.disabled).toBe(true)
  })

  it('sin geometría, pulsarlo lo explica en vez de consultar a ciegas', async () => {
    const montado = cablear({ parcelaInicial: null })
    const resultado = await montado.cableado.deducir()
    expect(resultado).toBeNull()
    expect(montado.transporte.emitidas).toBe(0)
    expect(montado.renglon.textContent.length).toBeGreaterThan(0)
    expect(montado.panel.resumen()[NIVEL.AVISO]).toBe(1)
  })
})

// ── 9 · La deducción pregunta por un punto INTERIOR ──────────────────────────

describe('cableado-catastro · el punto que se le pregunta al Catastro', () => {
  it('⚠️ es un punto DENTRO de la parcela, no el centroide aritmético', async () => {
    const recintos = recintosEnEle()
    const centroide = centroideDe(recintos)

    // La premisa, establecida con el módulo real: el centroide de esta L NO cae
    // dentro. `puntoInterior` devuelve el punto APORTADO cuando lo verifica dentro,
    // así que un origen distinto demuestra que lo descartó por estar fuera.
    expect(puntoInterior(recintos, { aportado: centroide }).origen).not.toBe(
      ORIGEN_PUNTO.APORTADO,
    )

    const montado = cablear({ parcelaInicial: parcelaSinReferencia(recintos) })
    await montado.cableado.deducir()

    // Y lo que se ha consultado es exactamente lo que `puntoInterior` decidió.
    expect(puntoConsultado(montado.transporte)).toEqual(puntoInterior(recintos).punto)
  })

  it('⚠️ NO republica las detecciones de `puntoInterior`: aquí mentirían', async () => {
    // Sus textos hablan del `cp:referencePoint` y de «lo que el Catastro rechaza».
    // Aquí no se está serializando nada y no hay ningún referencePoint: publicarlas
    // le contaría al usuario un problema que no tiene.
    const recintos = recintosEnEle()
    const { detecciones } = puntoInterior(recintos)
    expect(detecciones.length, 'esta L ya no fuerza ninguna detección: la prueba sería vacua')
      .toBeGreaterThan(0)

    const montado = cablear({ parcelaInicial: parcelaSinReferencia(recintos) })
    await montado.cableado.deducir()

    for (const d of detecciones) expect(textosDelPanel()).not.toContain(d.mensaje)
  })
})

// ── 10 · La deducción rellena el CAMPO, nunca el modelo ──────────────────────

describe('cableado-catastro · deducción con UN candidato', () => {
  const deducido = () => JSON.parse(TEXTO_RCCOOR_OK)[CLAVE_RCCOOR].coordenadas.coord[0]
  const refcatDeducida = () => `${deducido().pc.pc1}${deducido().pc.pc2}`

  it('⚠️ rellena el campo y NO toca el store', async () => {
    const montado = cablear({ parcelaInicial: parcelaSinReferencia() })
    await montado.cableado.deducir()

    expect(montado.campo.value).toBe(refcatDeducida())
    // `refcat` no entra en el modelo hasta que el usuario pulsa «Traer del
    // Catastro»: así `parcela.refcat` significa siempre «esto lo afirma el
    // usuario», nunca «esto lo adivinó un servicio».
    expect(montado.sets).toHaveLength(0)
    expect(montado.estado.get().refcat).toBeNull()
  })

  it('lo DICE en el rótulo de procedencia, con el texto de la spec', async () => {
    const montado = cablear({ parcelaInicial: parcelaSinReferencia() })
    await montado.cableado.deducir()
    expect(montado.procedencia.textContent).toBe(ROTULO_DEDUCIDA)
    expect(ROTULO_DEDUCIDA).toContain('puedes corregirla')
  })

  it('no enseña la lista de candidatos: no hay entre qué elegir', async () => {
    const montado = cablear({ parcelaInicial: parcelaSinReferencia() })
    await montado.cableado.deducir()
    expect(montado.lista.hidden).toBe(true)
    expect(montado.lista.children).toHaveLength(0)
  })

  it('deducir y luego cargar: entonces sí entra en el modelo', async () => {
    // El recorrido completo del usuario, y la prueba de que la separación entre
    // campo y modelo no es un callejón sin salida.
    const montado = cablear({ parcelaInicial: parcelaSinReferencia() })
    await montado.cableado.deducir()
    await montado.cableado.cargar()

    expect(montado.sets).toHaveLength(1)
    expect(montado.estado.get().refcat).toBe(REFCAT)
    expect(montado.estado.get().origen).toBe(ORIGEN_PARCELA.WFS)
  })
})

describe('cableado-catastro · deducción con VARIOS candidatos', () => {
  const varios = () =>
    cablear({
      parcelaInicial: parcelaSinReferencia(),
      transporte: crearTransporteDoble({ rccoor: TEXTO_RCCOOR_VARIOS }),
    })

  it('⚠️ NO rellena nada: elegir por el usuario sería meterle la parcela del vecino', async () => {
    const montado = varios()
    await montado.cableado.deducir()
    expect(montado.campo.value).toBe('')
    expect(montado.sets).toHaveLength(0)
  })

  it('los lista, y cada uno con SU domicilio (que es lo único que los distingue)', async () => {
    const montado = varios()
    const resultado = await montado.cableado.deducir()

    expect(montado.lista.hidden).toBe(false)
    const filas = [...montado.lista.querySelectorAll('li')]
    expect(filas).toHaveLength(resultado.datos.cuantos)
    // Derivado del propio resultado: si mañana el lector del OVC cambia de forma,
    // esta prueba le sigue en vez de quedarse con una copia vieja.
    resultado.datos.candidatos.forEach((candidato, i) => {
      expect(filas[i].textContent).toContain(candidato.refcat)
      expect(filas[i].textContent).toContain(candidato.domicilio)
    })
    // Y los domicilios son DISTINTOS: una lista de códigos iguales no se puede usar.
    const domicilios = new Set(resultado.datos.candidatos.map((c) => c.domicilio))
    expect(domicilios.size).toBe(resultado.datos.cuantos)
  })

  it('cada fila es PULSABLE y rellena el campo con la suya', async () => {
    const montado = varios()
    const resultado = await montado.cableado.deducir()
    const elegido = resultado.datos.candidatos[1]

    montado.lista.querySelectorAll('button')[1].click()

    expect(montado.campo.value).toBe(elegido.refcat)
    expect(montado.procedencia.textContent).toBe(ROTULO_DEDUCIDA)
    // La lista se recoge: ya se ha elegido.
    expect(montado.lista.hidden).toBe(true)
    // Y sigue sin tocarse el modelo.
    expect(montado.sets).toHaveLength(0)
  })

  it('un clic en la lista fuera de un candidato no hace nada', () => {
    const montado = varios()
    expect(() => montado.lista.click()).not.toThrow()
    expect(montado.campo.value).toBe('')
  })
})

describe('cableado-catastro · deducción sin NINGÚN candidato', () => {
  it('lo dice sin culpar al usuario, y con el mensaje entero del cliente', async () => {
    const montado = cablear({
      parcelaInicial: parcelaSinReferencia(),
      transporte: crearTransporteDoble({ rccoor: TEXTO_RCCOOR_SIN }),
    })
    const resultado = await montado.cableado.deducir()

    expect(resultado.motivo).toBe(MOTIVO_CATASTRO.NO_ENCONTRADO)
    // El mensaje del cliente lleva la cola que explica que no encontrar nada es un
    // estado VÁLIDO (hay suelo sin parcela; País Vasco y Navarra tienen catastro
    // propio). Llega al panel íntegro, que es donde cabe.
    expect(textosDelPanel()).toContain(resultado.mensaje)
    expect(tarjetaDe(resultado.mensaje).dataset.nivel).toBe(NIVEL.AVISO)
    // Y el renglón no acusa a quien pinchó.
    expect(montado.renglon.textContent).not.toMatch(/inválid|no válid|has escrito|mal escrit/i)
    expect(montado.campo.value).toBe('')
  })

  it('retira la lista anterior: no se enseñan candidatos de otra consulta', async () => {
    const transporte = crearTransporteDoble({ rccoor: TEXTO_RCCOOR_VARIOS })
    const montado = cablear({ parcelaInicial: parcelaSinReferencia(), transporte })
    await montado.cableado.deducir()
    expect(montado.lista.hidden).toBe(false)

    // La segunda deducción no encuentra nada: la lista vieja tiene que irse.
    const sinNada = crearTransporteDoble({ rccoor: TEXTO_RCCOOR_SIN })
    montado.cableado.destruir()
    const otro = cablear({ parcelaInicial: parcelaSinReferencia(), transporte: sinNada })
    await otro.cableado.deducir()
    expect(otro.lista.hidden).toBe(true)
  })
})

// ── 11 · El clic en el mapa (duck typing, sin Leaflet) ───────────────────────

describe('cableado-catastro · deducir con un clic en el mapa', () => {
  /** Un `latlng` de Leaflet dentro de la parcela real. Se deriva de sus vértices. */
  const latlngDentro = { lat: 40.4, lng: -3.7 }

  it('un emisor con `on`/`off` basta: este módulo no importa Leaflet', async () => {
    const mapa = crearMapaDoble()
    const montado = cablear({ mapa, parcelaInicial: parcelaSinReferencia() })

    mapa.emitir('click', { latlng: latlngDentro })
    await cederTurno()

    expect(montado.transporte.emitidas).toBe(1)
    expect(montado.transporte.peticiones[0].url).toContain('Consulta_RCCOOR')
  })

  it('la coordenada llega al Catastro en UTM, no en grados', async () => {
    const mapa = crearMapaDoble()
    const montado = cablear({ mapa, parcelaInicial: parcelaSinReferencia() })

    mapa.emitir('click', { latlng: latlngDentro })
    await cederTurno()

    const [x, y] = puntoConsultado(montado.transporte)
    // Metros del huso 30, no los −3,7 / 40,4 que trae el evento: si se colara la
    // latitud, el OVC contestaría sobre un punto en el golfo de Guinea.
    expect(x).toBeGreaterThan(100_000)
    expect(y).toBeGreaterThan(1_000_000)
  })

  it('se ignora cuando la parcela YA tiene referencia: no es tráfico que nadie pidió', async () => {
    const mapa = crearMapaDoble()
    const montado = cablear({ mapa, parcelaInicial: parcelaConReferencia() })

    mapa.emitir('click', { latlng: latlngDentro })
    await Promise.resolve()

    expect(montado.transporte.emitidas).toBe(0)
  })

  it('se ignora mientras hay una consulta en vuelo: un clic no puede abortar la carga', async () => {
    const mapa = crearMapaDoble()
    const transporte = crearTransporteDoble({ manual: true })
    const montado = cablear({ mapa, transporte, parcelaInicial: parcelaSinReferencia() })

    montado.campo.value = REFCAT
    const enCurso = montado.cableado.cargar()
    // El clic cae con la carga EN VUELO (`enVuelo` se pone en el mismo tick).
    mapa.emitir('click', { latlng: latlngDentro })
    await cederTurno()

    expect(transporte.peticiones).toHaveLength(1)
    expect(transporte.peticiones[0].senal.aborted).toBe(false)

    transporte.peticiones[0].responder()
    await enCurso
  })
})

// ── 12 · Colindantes ─────────────────────────────────────────────────────────

describe('cableado-catastro · colindantes()', () => {
  it('devuelve los colindantes SEPARADOS de la propia, y no toca el store', async () => {
    const montado = cablear({ parcelaInicial: parcelaConReferencia() })
    const resultado = await montado.cableado.colindantes()

    // El fixture trae 5 miembros para 4 colindantes, con la propia en 2.ª posición:
    // el recuento se DERIVA del fichero, no se escribe.
    expect(resultado.ok).toBe(true)
    expect(resultado.datos.propia.refcat).toBe(REFCAT)
    expect(resultado.datos.colindantes).toHaveLength(VECINDAD_FIXTURE.length - 1)
    // `model/parcela.js` no tiene dónde guardar unas vecinas, y meterlas donde no
    // van sería peor que devolverlas: quien las pida decide qué hacer con ellas.
    expect(montado.sets).toHaveLength(0)
  })

  it('lo cuenta en el renglón, que es el desenlace de lo que se pidió', async () => {
    const montado = cablear({ parcelaInicial: parcelaConReferencia() })
    const resultado = await montado.cableado.colindantes()
    expect(montado.renglon.textContent).toContain(String(resultado.datos.colindantes.length))
    expect(renglonEnFallo(montado.renglon)).toBe(false)
  })

  it('sin parcela cargada usa lo que haya en el campo', async () => {
    const montado = cablear({ parcelaInicial: null })
    montado.campo.value = REFCAT
    const resultado = await montado.cableado.colindantes()
    expect(resultado.ok).toBe(true)
    expect(montado.transporte.peticiones[0].url).toContain('GetNeighbourParcel')
  })
})

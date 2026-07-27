/* -------------------------------------------------------------------------- *
 * test/app/main-gml.dom.test.js — F04 · T6.1 · el botón «Generar GML»          *
 *                                                                              *
 * Es el único trozo de F04 que el usuario ve. `gml/` está terminado y probado   *
 * hasta el byte, pero mientras nadie llame a `serializarParcelaCp` desde la     *
 * pantalla, toda la feature es código muerto: el cableado de este fichero es lo *
 * que la convierte en producto.                                                 *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelve a probar el GML (`test/gml/serialize-cp.test.js`), ni el nombre  *
 * de fichero ni la codificación (`test/gml/descargar.dom.test.js`), ni las      *
 * reglas de validación (`test/validation/`). Se prueba el CABLE: que la app     *
 * valide antes de generar, que publique en el panel todo lo que el serializador *
 * decidió, que no descargue nada cuando no hay GML, y que el estado del botón   *
 * se vuelva a calcular cuando cambia el store. Cinco cosas que no comprueba     *
 * ninguna otra suite y que, rotas, dejan la app en verde y al usuario con un    *
 * fichero mal hecho —o sin fichero y sin explicación.                            *
 *                                                                              *
 * ── DECISIÓN 1 · SE IMPORTA `app/main.js`, Y ADEMÁS SE EXTRAJO UNA FUNCIÓN ──  *
 * `app/main.js` es un script de arranque: su código de nivel superior ensambla  *
 * la app ENTERA al importarlo, así que no hay forma de coger una función suya   *
 * sin ejecutarlo. Se ha hecho lo uno y lo otro, a propósito:                     *
 *   · La cáscara se monta ANTES del import (y el import es dinámico, para que   *
 *     el orden sea explícito y no dependa del izado de ESM). El import, por     *
 *     tanto, EJERCITA el ensamblaje real: si el cableado nuevo rompiera el      *
 *     arranque, este fichero entero fallaría en la primera línea.               *
 *   · Lo que se ejercita caso por caso es `cablearGeneracionGml`, la única      *
 *     función que `app/main.js` exporta. Sin esa extracción cada prueba tendría *
 *     que recargar el módulo con su propio `?demo=` y su propio DOM, y las      *
 *     seis situaciones de abajo (parcela con hueco, autointersección, colapso   *
 *     por redondeo…) no se podrían montar en absoluto: el dataset lo elige la   *
 *     URL. El resto de `app/main.js` ya está cubierto: los datos en             *
 *     `test/app/demo-datos.test.js`, el panel en `test/app/avisos.dom.test.js`  *
 *     y el visor en toda la suite de `test/viewer/`.                             *
 *                                                                              *
 * ── DECISIÓN 2 · LA CÁSCARA SE LEE DE `index.html`, NO SE COPIA ──             *
 * El marcado es CONTRATO entre `index.html` y `app/main.js` (el `data-accion`,  *
 * el `data-estado`, el `disabled` con el que nace el botón). Una copia a mano   *
 * en este fichero podría quedarse en verde con un `index.html` ya roto, que es  *
 * exactamente el fallo que el contrato pretende evitar. Aquí se monta el        *
 * `<body>` REAL leído del disco.                                                *
 *                                                                              *
 * ── DECISIÓN 3 · SE DOBLA `viewer/index.js`, Y NADA MÁS ──                     *
 * `crearVisor` monta un `L.Map` de Leaflet, que bajo jsdom necesita un          *
 * contenedor con dimensiones falsificadas (`test/viewer/_ayuda-jsdom.js`) y una *
 * ristra de animaciones desactivadas. Nada de eso tiene que ver con generar un  *
 * GML, y `crearVisor` tiene su propia suite. Se dobla ese módulo —uno solo— y   *
 * se dejan REALES el store, el panel, la validación, el serializador y la       *
 * entrega: el cable que se prueba es de punta a punta salvo por el mapa.        *
 *                                                                              *
 * ── DECISIÓN 4 · LA ENTREGA PASA POR `descargarGml` DE VERDAD ──               *
 * El espía no sustituye la descarga: la registra y la DELEGA en `descargarGml`  *
 * con un `documento` y un `url` inyectados (los que el propio módulo admite     *
 * para esto). Así el nombre que se afirma es el que compone el módulo real, y   *
 * el Blob que se decodifica es el que habría bajado a la carpeta de descargas.  *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, vi } from 'vitest'

import { crearPanelAvisos } from '../../app/avisos.js'
import { REFCAT_DEMO, SRS_DEMO, parcelaDemo, parcelaDemoConHueco } from '../../app/demo-datos.js'
import { SEVERIDAD, dateTimeCatastro } from '../../gml/_comun.js'
import { MARCA_SIN_REFCAT, descargarGml } from '../../gml/descargar.js'
import { serializarParcelaCp } from '../../gml/serialize-cp.js'
import { crearParcela, crearRecinto, ORIGEN_PARCELA, TIPO_RECINTO } from '../../model/parcela.js'
import { validarParcela } from '../../validation/parcela.js'
import { NIVEL, crearEstadoVista } from '../../viewer/_comun.js'

// `crearVisor` es lo ÚNICO que se dobla (decisión 3). El doble devuelve la
// misma forma que el real —un objeto con `destruir`— para que `app/main.js` no
// tenga que saber que está doblado.
vi.mock('../../viewer/index.js', () => ({
  crearVisor: () => ({ destruir() {} }),
}))

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

/**
 * El `<body>` de `index.html` tal cual está en el disco. El `<script
 * type="module">` que lleva dentro NO se ejecuta al asignarlo por `innerHTML`
 * (jsdom no evalúa scripts insertados así), que es justo lo que se quiere: el
 * arranque de la app se dispara UNA vez, abajo, con el `import` explícito.
 */
const CUERPO_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/main-gml.dom.test.js: no se ha encontrado el <body> de index.html. ' +
        'La cáscara de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

/** Monta la cáscara real en el documento del test. */
function montarCascara() {
  document.body.innerHTML = CUERPO_INDEX
}

// La cáscara TIENE que existir antes de importar `app/main.js`: su código de
// nivel superior busca los nodos con `nodo(...)`, que LANZA si falta alguno.
montarCascara()

const {
  cablearGeneracionGml,
  SELECTOR_BOTON_GML,
  SELECTOR_ESTADO_GML,
  MENSAJE_FALLO_INESPERADO,
  MENSAJE_FALLO_ENTREGA,
} = await import(
  '../../app/main.js'
)

// ── Datos de las situaciones que no da `app/demo-datos.js` ───────────────────

/**
 * Instante FIJO. `gml/` no consulta el reloj por contrato y la capa de
 * aplicación es quien lo lee, así que fijarlo aquí hace que el GML generado y el
 * nombre del fichero sean reproducibles y se puedan afirmar exactamente.
 */
const INSTANTE = new Date(Date.UTC(2026, 6, 27, 11, 45, 30))
const RELOJ = () => INSTANTE

/**
 * Parcela con el contorno exterior CRUZADO consigo mismo (una pajarita). Es un
 * error BLOQUEANTE de `validation/reglas-topologia.js`, y del más realista: sale
 * de arrastrar un vértice al otro lado de la parcela, que es exactamente lo que
 * F06 va a permitir hacer. Se construye con `model/parcela.js` —no a mano— para
 * que los invariantes del modelo sigan garantizados: lo roto es la topología, no
 * la estructura.
 */
function parcelaCruzada() {
  return crearParcela({
    idLocal: 'demo-cruzada',
    origen: ORIGEN_PARCELA.LIST,
    recintos: [
      crearRecinto(
        [
          [439300, 4479650],
          [439324, 4479666],
          [439324, 4479650],
          [439300, 4479666],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
    ],
  })
}

/**
 * Parcela VÁLIDA para F02 en la que, sin embargo, el serializador tiene algo que
 * contar: dos vértices consecutivos a ~3 mm que `toFixed(2)` funde en el mismo
 * punto. F02 no puede verlo —trabaja sobre las coordenadas SIN redondear y su
 * umbral de duplicado es 1 mm—, así que es el caso que demuestra que publicar
 * las detecciones del serializador no es redundante con el panel de validación.
 * El anillo conserva 4 vértices distintos tras el redondeo, luego el colapso es
 * AVISO y el GML se emite igual.
 */
function parcelaConColapso() {
  return crearParcela({
    idLocal: 'demo-colapso',
    origen: ORIGEN_PARCELA.LIST,
    recintos: [
      crearRecinto(
        [
          [439300, 4479650],
          [439324, 4479650],
          [439324.001, 4479650.003],
          [439324, 4479666],
          [439300, 4479666],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
    ],
  })
}

/**
 * Parcela VÁLIDA para F02 cuyo HUECO se desintegra al redondear: sus cuatro
 * vértices están a milímetros y quedan todos en el mismo punto, así que el
 * `gml:LinearRing` se quedaría por debajo de los 4 puntos que exige el esquema.
 * Eso es una detección de severidad ERROR y `serializarParcelaCp` devuelve
 * `xml: null`. Es la única forma honesta de llegar a ese camino: no se puede
 * falsear el serializador porque el cableado lo llama de verdad.
 */
function parcelaQueNoSePuedeEscribir() {
  return crearParcela({
    idLocal: 'demo-hueco-colapsado',
    origen: ORIGEN_PARCELA.LIST,
    recintos: [
      crearRecinto(
        [
          [439300, 4479650],
          [439324, 4479650],
          [439324, 4479666],
          [439300, 4479666],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
      crearRecinto(
        [
          [439310, 4479657],
          [439310.003, 4479657],
          [439310.003, 4479657.003],
          [439310, 4479657.003],
        ],
        TIPO_RECINTO.HUECO,
      ),
    ],
  })
}

// ── Arnés ────────────────────────────────────────────────────────────────────

/**
 * Espía de la entrega. NO sustituye a `descargarGml`: registra la llamada y le
 * pasa el testigo, con un `documento` y un `url` inyectados (los dos parámetros
 * que el módulo admite justo para esto). El `click` del anchor se sustituye
 * porque el heredado de jsdom intenta navegar a la `blob:` y escupe un «Not
 * implemented: navigation» sin descargar nada; todo lo demás es DOM real.
 */
function crearEspiaDeEntrega() {
  const llamadas = []
  const anclas = []
  const blobs = []
  const revocadas = []

  const documento = {
    createElement(etiqueta) {
      const el = document.createElement(etiqueta)
      if (etiqueta === 'a') {
        el.click = () => {}
        anclas.push(el)
      }
      return el
    },
    get body() {
      return document.body
    },
  }

  const url = {
    createObjectURL(blob) {
      blobs.push(blob)
      return `blob:prueba/${blobs.length - 1}`
    },
    revokeObjectURL(href) {
      revocadas.push(href)
    },
  }

  return {
    llamadas,
    anclas,
    blobs,
    revocadas,
    descargar(xml, opciones) {
      llamadas.push({ xml, opciones })
      return descargarGml(xml, { ...opciones, documento, url })
    },
  }
}

/**
 * Monta panel + store + cableado sobre la cáscara ya presente en el documento.
 *
 * @param {object|null} parcelaInicial
 * @param {object} [extra]  Opciones que sustituyen a las de por defecto.
 */
function cablear(parcelaInicial, extra = {}) {
  const estado = crearEstadoVista(parcelaInicial)
  const panel = crearPanelAvisos({
    contenedor: document.getElementById('avisos'),
    chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
    chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
  })
  const entrega = crearEspiaDeEntrega()
  const cableado = cablearGeneracionGml({
    estado,
    panel,
    srs: SRS_DEMO,
    ahora: RELOJ,
    descargar: entrega.descargar,
    ...extra,
  })
  return {
    estado,
    panel,
    entrega,
    cableado,
    boton: document.querySelector(SELECTOR_BOTON_GML),
    renglon: document.querySelector(SELECTOR_ESTADO_GML),
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

/** ¿Está el renglón en estado de error (el modificador rojo del CSS)? */
const renglonEnError = (renglon) => renglon.classList.contains('gml-accion-estado--error')

/**
 * Serializa la misma parcela POR SEPARADO, con las mismas opciones que usa el
 * cableado, para poder derivar de ahí lo que el panel DEBERÍA mostrar en vez de
 * copiar los mensajes a mano. Si el serializador cambia un texto, estas pruebas
 * lo siguen; si el cableado deja de publicar, caen.
 */
function detectadoAlSerializar(parcela) {
  return serializarParcelaCp({
    recintos: parcela.recintos,
    srs: SRS_DEMO,
    refcat: parcela.refcat ?? parcela.idLocal,
    beginLifespanVersion: dateTimeCatastro(INSTANTE),
  })
}

beforeEach(montarCascara)

// ── 1 · La parcela real: el camino feliz completo ────────────────────────────

describe('app/main · generar el GML de la parcela demo (válida, con referencia)', () => {
  it('arranca con el botón HABILITADO y el renglón vacío', () => {
    const { boton, renglon } = cablear(parcelaDemo())
    expect(boton.disabled).toBe(false)
    expect(renglon.textContent).toBe('')
    expect(renglonEnError(renglon)).toBe(false)
  })

  it('pulsar genera un GML NO vacío y lo entrega una sola vez', () => {
    const { boton, entrega } = cablear(parcelaDemo())
    boton.click()

    expect(entrega.llamadas).toHaveLength(1)
    const { xml } = entrega.llamadas[0]
    expect(typeof xml).toBe('string')
    expect(xml.length).toBeGreaterThan(0)
    expect(xml).toContain('<cp:CadastralParcel')
    expect(xml).toContain('<gml:posList')
  })

  it('el nombre del fichero entregado lleva la referencia catastral', () => {
    const { boton, entrega } = cablear(parcelaDemo())
    boton.click()

    // El nombre lo compone `gml/descargar.js`, no este fichero: se afirma sobre
    // el anchor REAL que el módulo creó y soltó en el documento.
    expect(entrega.anclas).toHaveLength(1)
    expect(entrega.anclas[0].download).toContain(REFCAT_DEMO)
    expect(entrega.anclas[0].download.endsWith('.gml')).toBe(true)
  })

  it('la referencia que se pasa a la descarga es la de la parcela, no su idLocal', () => {
    const parcela = parcelaDemo()
    const { boton, entrega } = cablear(parcela)
    boton.click()
    expect(entrega.llamadas[0].opciones.refcat).toBe(parcela.refcat)
  })

  it('el renglón anuncia la descarga por su nombre, sin marcar error', () => {
    const { boton, renglon, entrega } = cablear(parcelaDemo())
    boton.click()
    expect(renglon.textContent).toContain(entrega.anclas[0].download)
    expect(renglonEnError(renglon)).toBe(false)
  })

  it('los bytes que bajarían son EXACTAMENTE el GML generado', async () => {
    const { boton, entrega } = cablear(parcelaDemo())
    boton.click()
    expect(entrega.blobs).toHaveLength(1)
    await expect(entrega.blobs[0].text()).resolves.toBe(entrega.llamadas[0].xml)
  })

  it('la fecha del CONTENIDO y la del NOMBRE salen del mismo instante', () => {
    // Es la razón por la que la capa de aplicación lee el reloj UNA vez y lo
    // pasa a las dos llamadas: un GML fechado a las 11:45:30 dentro de un
    // fichero llamado …T11-45-31 es imposible de emparejar después.
    const { boton, entrega } = cablear(parcelaDemo())
    boton.click()

    const marca = dateTimeCatastro(INSTANTE)
    expect(entrega.llamadas[0].xml).toContain(`<cp:beginLifespanVersion>${marca}<`)
    expect(entrega.anclas[0].download).toContain(marca.split(':').join('-'))
    expect(entrega.llamadas[0].opciones.fecha).toBe(INSTANTE)
  })

  it('el GML se emite como ALTA de particular, no como dato oficial del Catastro', () => {
    // `ES.LOCAL.CP` (alta) y NO `ES.SDGC.CP` (dato de la Sede), y
    // `nationalCadastralReference` VACÍO: rellenarlo con la referencia
    // convertiría el alta en una declaración falsa de inscripción.
    const { boton, entrega } = cablear(parcelaDemo())
    boton.click()
    const { xml } = entrega.llamadas[0]
    expect(xml).toContain('<namespace>ES.LOCAL.CP</namespace>')
    expect(xml).not.toContain('ES.SDGC.CP')
    expect(xml).toContain('<cp:nationalCadastralReference/>')
    expect(xml).toContain(`<localId>${REFCAT_DEMO}</localId>`)
  })
})

// ── 2 · La parcela sintética: con hueco y SIN referencia catastral ───────────

describe('app/main · parcela SINTÉTICA con hueco y sin referencia catastral', () => {
  it('se genera igual: el hueco sale como `gml:interior` del mismo patch', () => {
    const { boton, entrega } = cablear(parcelaDemoConHueco())
    boton.click()

    expect(entrega.llamadas).toHaveLength(1)
    expect(entrega.llamadas[0].xml).toContain('<gml:interior>')
    // Un hueco es un anillo interior del MISMO PolygonPatch, nunca una segunda
    // superficie: un MultiPolygon con varias caras es rechazo directo del IVG.
    expect(entrega.llamadas[0].xml.match(/<gml:surfaceMember>/g)).toHaveLength(1)
  })

  it('el nombre del fichero DICE que no hay referencia, en vez de inventarse una', () => {
    const parcela = parcelaDemoConHueco()
    expect(parcela.refcat, 'el dataset sintético no tiene referencia').toBeNull()

    const { boton, entrega } = cablear(parcela)
    boton.click()

    const nombre = entrega.anclas[0].download
    expect(nombre).toContain(MARCA_SIN_REFCAT)
    // Y no se cuela el identificador interno haciéndose pasar por referencia.
    expect(nombre).not.toContain(parcela.idLocal)
    expect(entrega.llamadas[0].opciones.refcat).toBeNull()
  })

  it('la IDENTIDAD del GML sí cae al `idLocal`: el serializador la exige', () => {
    // Las dos caras de la misma decisión: sin referencia, el `<localId>` es el
    // identificador local del modelo (patrón del alta real `UTM_1.gml`), pero el
    // NOMBRE del fichero no puede presentarlo como si fuera una referencia.
    const parcela = parcelaDemoConHueco()
    const { boton, entrega } = cablear(parcela)
    boton.click()
    expect(entrega.llamadas[0].xml).toContain(`<localId>${parcela.idLocal}</localId>`)
  })
})

// ── 3 · Regla de oro 1: lo que el serializador decidió, al panel ─────────────

describe('app/main · las detecciones del serializador se PUBLICAN en el panel', () => {
  it('un anillo invertido: el usuario se entera de que se le ha cambiado el sentido', () => {
    const parcela = parcelaDemoConHueco()
    const { detecciones } = detectadoAlSerializar(parcela)
    expect(
      detecciones.some((d) => d.tipo === 'ORIENTACION_NORMALIZADA'),
      'el dataset elegido ya no fuerza una inversión: la prueba sería vacua',
    ).toBe(true)

    const { boton } = cablear(parcela)
    boton.click()

    // Derivado: TODO lo que el serializador dijo tiene que estar en el panel.
    for (const d of detecciones) expect(textosDelPanel()).toContain(d.mensaje)
  })

  it('un colapso por redondeo que F02 NO puede ver también llega al panel', () => {
    const parcela = parcelaConColapso()
    const { xml, detecciones } = detectadoAlSerializar(parcela)
    expect(xml, 'el colapso de esta parcela es AVISO: el GML se emite igual').not.toBeNull()
    expect(detecciones.some((d) => d.tipo === 'COLAPSO_POR_REDONDEO')).toBe(true)

    const { boton, entrega } = cablear(parcela)
    boton.click()

    expect(entrega.llamadas).toHaveLength(1)
    for (const d of detecciones) expect(textosDelPanel()).toContain(d.mensaje)
  })

  it('sin ninguna detección el panel no se ensucia con tarjetas inventadas', () => {
    const parcela = parcelaDemo()
    expect(detectadoAlSerializar(parcela).detecciones).toHaveLength(0)

    const { boton, panel } = cablear(parcela)
    boton.click()
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })

  it('la severidad de `gml/` se traduce al nivel del panel sin inventar bloqueos', () => {
    // El contrato se escribe aquí ENTERO (no se importa la tabla del módulo: eso
    // sería preguntarle al examinado por las respuestas) y se comprueba que
    // cubre las tres severidades que existen, para que una nueva no pase muda.
    const ESPERADO = {
      [SEVERIDAD.INFO]: NIVEL.AVISO,
      [SEVERIDAD.AVISO]: NIVEL.AVISO,
      [SEVERIDAD.ERROR]: NIVEL.ERROR,
    }
    expect(Object.keys(ESPERADO).sort()).toEqual(Object.values(SEVERIDAD).sort())

    // Dos parcelas para tocar INFO (orientación) y AVISO (colapso) en el mismo
    // panel. La severidad ERROR se comprueba en el bloque siguiente, donde el
    // serializador se niega a emitir.
    for (const construir of [parcelaDemoConHueco, parcelaConColapso]) {
      montarCascara()
      const parcela = construir()
      const { detecciones } = detectadoAlSerializar(parcela)
      const { boton } = cablear(parcela)
      boton.click()

      for (const d of detecciones) {
        const tarjeta = tarjetaDe(d.mensaje)
        expect(tarjeta, `sin tarjeta para «${d.tipo}»`).not.toBeNull()
        expect(tarjeta.dataset.nivel).toBe(ESPERADO[d.severidad])
      }
    }
  })
})

// ── 4 · Cuando el serializador NO emite fichero ──────────────────────────────

describe('app/main · el serializador devuelve `xml: null`', () => {
  it('no se descarga nada, y el renglón dice por qué', () => {
    const parcela = parcelaQueNoSePuedeEscribir()
    const { xml, resumen, detecciones } = detectadoAlSerializar(parcela)
    expect(xml, 'esta parcela debe bloquear al serializador, no antes').toBeNull()
    expect(resumen.bloqueos.length).toBeGreaterThan(0)

    const { boton, renglon, entrega, panel } = cablear(parcela)
    expect(boton.disabled, 'F02 sí la da por buena: el bloqueo es del serializador').toBe(false)
    boton.click()

    // Ni siquiera se intenta la entrega: bajar un fichero de 0 bytes sería peor.
    expect(entrega.llamadas).toHaveLength(0)
    expect(entrega.blobs).toHaveLength(0)
    // Y no se calla: el motivo en el renglón, el detalle en el panel.
    expect(renglonEnError(renglon)).toBe(true)
    for (const bloqueo of resumen.bloqueos) expect(renglon.textContent).toContain(bloqueo)
    for (const d of detecciones) expect(textosDelPanel()).toContain(d.mensaje)
    expect(panel.resumen()[NIVEL.ERROR]).toBeGreaterThan(0)
  })
})

// ── 5 · Error bloqueante de la validación ────────────────────────────────────

describe('app/main · parcela con un error BLOQUEANTE inyectado', () => {
  it('el botón nace DESHABILITADO y el renglón dice cuántos errores y de qué', () => {
    // El recuento y los textos se DERIVAN del validador, no se copian: una
    // pajarita dispara además la regla de superficie nula, y el día que F02
    // añada o quite una regla esta prueba sigue diciendo la verdad.
    const parcela = parcelaCruzada()
    const { errores } = validarParcela(parcela.recintos, { srs: SRS_DEMO })
    expect(errores.length).toBeGreaterThan(0)

    const { boton, renglon } = cablear(parcela)
    expect(boton.disabled).toBe(true)
    expect(renglonEnError(renglon)).toBe(true)
    // CUÁNTOS…
    expect(renglon.textContent).toContain(
      errores.length === 1
        ? '1 error bloquea la generación'
        : `${errores.length} errores bloquean la generación`,
    )
    // …y DE QUÉ (los dos primeros mensajes distintos caben en el renglón).
    for (const mensaje of [...new Set(errores.map((e) => e.mensaje))].slice(0, 2)) {
      expect(renglon.textContent).toContain(mensaje)
    }
  })

  it('pulsarlo (la ruta real del usuario) no descarga nada', () => {
    const { boton, entrega } = cablear(parcelaCruzada())
    boton.click()
    expect(entrega.llamadas).toHaveLength(0)
  })

  it('forzando el manejador tampoco: no se fía de `disabled` y vuelve a validar', () => {
    // `boton.click()` sobre un botón deshabilitado no activa nada (lo impide el
    // propio DOM), así que la guarda del manejador quedaría SIN PROBAR. Se
    // despacha el evento a mano para llegar a ella: `disabled` es estado de
    // presentación y la corrección del fichero no puede depender de que un
    // atributo del DOM esté al día.
    const { boton, renglon, entrega } = cablear(parcelaCruzada())
    boton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(entrega.llamadas).toHaveLength(0)
    expect(boton.disabled).toBe(true)
    expect(renglonEnError(renglon)).toBe(true)
  })

  it('cada error entra en el PANEL con su mensaje, no sólo en el renglón', () => {
    // El renglón resume; el panel lleva TODOS los errores enteros. Es la única
    // superficie donde caben los que no entran en una línea de 11 px.
    const parcela = parcelaCruzada()
    const { errores } = validarParcela(parcela.recintos, { srs: SRS_DEMO })
    const distintos = [...new Set(errores.map((e) => e.mensaje))]

    const { boton, panel } = cablear(parcela)
    boton.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    for (const mensaje of distintos) expect(textosDelPanel()).toContain(mensaje)
    expect(panel.resumen()[NIVEL.ERROR]).toBe(distintos.length)
    // Bloqueantes, no avisos de cortesía.
    for (const mensaje of distintos) expect(tarjetaDe(mensaje).dataset.nivel).toBe(NIVEL.ERROR)
  })

  it('sin parcela en el store: bloquea diciéndolo, y no revienta', () => {
    // `null` es el valor inicial documentado del store. `validarParcela` LANZA si
    // no le dan un array, así que el cableado tiene que traducirlo a «no hay
    // contorno exterior», que es un estado del expediente y no una excepción.
    const { boton, renglon } = cablear(null)
    expect(boton.disabled).toBe(true)
    expect(renglon.textContent).toContain('contorno exterior')
  })
})

// ── 6 · El estado del botón se RE-EVALÚA con el store ────────────────────────

describe('app/main · el botón se recalcula en cada cambio del store (F06)', () => {
  it('de válida a rota: el botón se apaga y aparece el motivo', () => {
    const { estado, boton, renglon } = cablear(parcelaDemo())
    expect(boton.disabled).toBe(false)

    estado.set(parcelaCruzada())

    expect(boton.disabled).toBe(true)
    expect(renglonEnError(renglon)).toBe(true)
    expect(renglon.textContent).toContain('Autointersección')
  })

  it('de rota a válida: el botón se enciende y el renglón se limpia del todo', () => {
    const { estado, boton, renglon } = cablear(parcelaCruzada())
    expect(boton.disabled).toBe(true)

    estado.set(parcelaDemo())

    expect(boton.disabled).toBe(false)
    // Vacío Y sin el modificador: si se quedara la clase, el CSS colapsaría el
    // renglón (`:empty`) pero volvería en rojo al siguiente mensaje.
    expect(renglon.textContent).toBe('')
    expect(renglonEnError(renglon)).toBe(false)
  })

  it('tras romperla, pulsar ya no genera el GML que sí generaba antes', () => {
    const { estado, boton, entrega } = cablear(parcelaDemo())
    boton.click()
    expect(entrega.llamadas).toHaveLength(1)

    estado.set(parcelaCruzada())
    boton.click()

    expect(entrega.llamadas, 'se ha generado con una parcela rota').toHaveLength(1)
  })

  it('`destruir()` corta el oyente y la suscripción', () => {
    const { estado, boton, cableado, entrega } = cablear(parcelaDemo())
    cableado.destruir()

    boton.click()
    expect(entrega.llamadas).toHaveLength(0)

    // Y el botón deja de seguir al store: ya no es asunto de este cableado.
    estado.set(parcelaCruzada())
    expect(boton.disabled).toBe(false)
  })
})

// ── 7 · Contrato con `index.html` ────────────────────────────────────────────

describe('app/main · el marcado de index.html es CONTRATO', () => {
  it.each([
    ['el botón', SELECTOR_BOTON_GML],
    ['el renglón de estado', SELECTOR_ESTADO_GML],
  ])('falta %s ⇒ lanza NOMBRANDO el selector', (_caso, selector) => {
    document.querySelector(selector).remove()
    const estado = crearEstadoVista(parcelaDemo())
    const panel = crearPanelAvisos({
      contenedor: document.getElementById('avisos'),
      chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
      chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
    })
    expect(() => cablearGeneracionGml({ estado, panel, srs: SRS_DEMO })).toThrow(selector)
  })

  it('la guarda NO es vacua: index.html trae los dos nodos, y el botón nace apagado', () => {
    const boton = document.querySelector(SELECTOR_BOTON_GML)
    expect(boton).not.toBeNull()
    expect(document.querySelector(SELECTOR_ESTADO_GML)).not.toBeNull()
    // Nace `disabled` en el HTML a propósito: antes de validar no se sabe si se
    // puede generar, y ofrecerlo sería prometer un GML que quizá no salga.
    expect(boton.disabled).toBe(true)
    // Y el renglón es un `role="status"`: se anuncia sin robar el foco.
    expect(document.querySelector(SELECTOR_ESTADO_GML).getAttribute('role')).toBe('status')
  })

  it('sin nodos explícitos los localiza solo (es como lo llama `app/main.js`)', () => {
    const estado = crearEstadoVista(parcelaDemo())
    const panel = crearPanelAvisos({
      contenedor: document.getElementById('avisos'),
      chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
      chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
    })
    expect(() => cablearGeneracionGml({ estado, panel, srs: SRS_DEMO })).not.toThrow()
    expect(document.querySelector(SELECTOR_BOTON_GML).disabled).toBe(false)
  })
})

// ── 8 · Un fallo INESPERADO no deja al usuario con un botón mudo ─────────────
//
// Las capas de abajo no siempre devuelven hallazgos: ante un CONTRATO ROTO
// LANZAN. Sin red, esa excepción sube desde el manejador de `click` y el usuario
// pulsa, no baja nada y nada le dice por qué — un error silencioso de manual.
//
// El camino de entrada NO es hipotético y está MEDIDO: el store admite cualquier
// POJO (`crearEstadoVista` no valida) y `crearRecinto` sólo protege a quien pase
// por él, así que una coordenada no finita puede acabar dentro del estado. Lo
// interesante es DÓNDE revienta: `validarParcela` no la deja pasar en silencio,
// lanza ella misma desde `geo/huso.js#detectarHuso`. Es decir, el agujero está en
// el paso 1 y no en la serialización — por eso la red envuelve el recorrido
// entero. Estas pruebas fijan ese hecho para que nadie «simplifique» la red
// bajándola al paso 2, donde no habría servido de nada.

describe('app/main · fallo inesperado durante la generación', () => {
  /** Parcela con un vértice no finito, como POJO CRUDO (el store lo admite). */
  const parcelaCorrupta = () => ({
    ...parcelaDemo(),
    recintos: [
      {
        tipo: TIPO_RECINTO.EXTERIOR,
        vertices: [
          [439283.23, 4479671.27],
          [439268.76, Number.NaN],
          [439257.63, 4479647.8],
          [439246.37, 4479637.48],
        ],
      },
    ],
  })

  /** `refrescar` manda el detalle técnico a la consola: aquí no interesa verlo. */
  let consola
  beforeEach(() => {
    consola = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('la premisa es cierta: `validarParcela` LANZA con una coordenada no finita', () => {
    // Es lo que hace que la red tenga que envolver el paso 1 y no sólo el 2. Si
    // algún día F02 pasara a devolver un hallazgo en vez de lanzar, esta prueba
    // cae y hay que revisar si la red sigue haciendo falta donde está.
    expect(() => validarParcela(parcelaCorrupta().recintos, { srs: SRS_DEMO })).toThrow()
  })

  it('CABLEAR con la parcela corrupta NO tumba la app: apaga el botón y lo explica', () => {
    // El caso más grave que encontré: `cablearGeneracionGml` evalúa el estado del
    // botón al cablear, dentro del ensamblaje de `app/main.js`. Si eso relanzara,
    // no habría mapa, ni tabla, ni ficha, ni panel — y el usuario perdería justo
    // lo que necesita para ver qué tiene mal.
    let montado
    expect(() => {
      montado = cablear(parcelaCorrupta())
    }).not.toThrow()

    expect(montado.boton.disabled).toBe(true)
    expect(montado.renglon.textContent).toBe(MENSAJE_FALLO_INESPERADO)
    expect(renglonEnError(montado.renglon)).toBe(true)
    expect(textosDelPanel()).toContain(MENSAJE_FALLO_INESPERADO)
    expect(tarjetaDe(MENSAJE_FALLO_INESPERADO).dataset.nivel).toBe(NIVEL.ERROR)

    // Pero el defecto NO se tapa: sale por la consola para quien depura.
    expect(consola).toHaveBeenCalled()
    expect(String(consola.mock.calls[0])).toMatch(/no finita/i)
  })

  it('pulsar sí RELANZA: es una acción explícita, con la app ya montada', () => {
    const { cableado, entrega, renglon } = cablear(parcelaCorrupta())

    // Relanza: el defecto de programación sigue siendo visible para quien depura.
    expect(() => cableado.generar()).toThrow()

    // Y aun así el usuario se ha enterado, que es la regla de oro 1.
    expect(renglon.textContent).toBe(MENSAJE_FALLO_INESPERADO)
    expect(renglonEnError(renglon)).toBe(true)

    // Y no ha bajado ningún fichero.
    expect(entrega.llamadas).toHaveLength(0)
  })

  it('el mensaje NO enseña la excepción cruda (no le sirve a quien no programa)', () => {
    const { cableado, renglon } = cablear(parcelaCorrupta())
    expect(() => cableado.generar()).toThrow()
    // El texto de `detectarHuso` («coordenada no finita») es de programador: va a
    // la consola vía `causa`, no a la cara del usuario.
    expect(renglon.textContent).not.toMatch(/no finita/i)
    expect(document.getElementById('avisos').textContent).not.toMatch(/detectarHuso/)
  })
})

describe('app/main · fallo al ENTREGAR el fichero (el GML sí se generó)', () => {
  /** Una entrega que revienta, como haría un navegador que niega la descarga. */
  const entregaRota = () => {
    throw new Error('createObjectURL no disponible')
  }

  it('mensaje DISTINTO al del fallo de generación, y relanza', () => {
    const { cableado, renglon } = cablear(parcelaDemo(), { descargar: entregaRota })

    expect(() => cableado.generar()).toThrow()

    expect(renglon.textContent).toBe(MENSAJE_FALLO_ENTREGA)
    expect(renglonEnError(renglon)).toBe(true)
    expect(textosDelPanel()).toContain(MENSAJE_FALLO_ENTREGA)

    // Los dos mensajes son distintos A PROPÓSITO: «tu dato no se puede escribir»
    // y «el fichero está bien pero no ha bajado» llevan a acciones distintas.
    expect(MENSAJE_FALLO_ENTREGA).not.toBe(MENSAJE_FALLO_INESPERADO)
    expect(textosDelPanel()).not.toContain(MENSAJE_FALLO_INESPERADO)
  })

  it('las detecciones del serializador YA se habían publicado antes del fallo', () => {
    // El GML se generó bien: lo que falló fue la entrega. Perder por el camino lo
    // que el serializador decidió sobre la geometría sería tirar información que
    // el usuario necesita igual (regla de oro 1).
    const { cableado } = cablear(parcelaConColapso(), { descargar: entregaRota })
    expect(() => cableado.generar()).toThrow()

    const { detecciones } = detectadoAlSerializar(parcelaConColapso())
    expect(detecciones.length).toBeGreaterThan(0)
    for (const d of detecciones) expect(textosDelPanel()).toContain(d.mensaje)
  })
})

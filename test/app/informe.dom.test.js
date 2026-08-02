/* -------------------------------------------------------------------------- *
 * test/app/informe.dom.test.js — F09 · T5.1 · el informe firmable, cableado    *
 *                                                                              *
 * `report/` sabe encuadrar, dibujar, redactar y maquetar; `app/dialogo-informe` *
 * sabe recoger lo que el usuario corrige; `services/` sabe preguntarle al       *
 * Catastro. Mientras nadie los enchufe, F09 entera es código muerto. Aquí se    *
 * prueba el CABLE, no las piezas.                                              *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelve a probar el encuadre (`test/report/encuadre.test.js`), el plano  *
 * (`test/report/canvas.dom.test.js`), la maqueta (`test/report/pdf-parcela`),   *
 * el literal, la firma ni el diálogo (`test/app/dialogo-informe.dom.test.js`).  *
 * Se prueba lo que solo existe cuando las piezas se juntan:                     *
 *                                                                              *
 *   1. **El recorrido completo**, de pulsar el botón a los bytes del PDF.       *
 *   2. **Que la PROCEDENCIA se propaga.** Es la mina de esta tarea: sin ella el *
 *      informe imprime «No se ha consultado» en campos que SÍ se consultaron.   *
 *      El test lleva su control negativo, o no probaría nada.                   *
 *   3. **Que un fallo de red no cancela nada**: ni el del DNPRC ni el del plano.*
 *   4. **Que el clic del `<a download>` NO cierra el cajón** (el defecto real   *
 *      que costó una corrida del guion de navegador en F08).                    *
 *   5. **Que lo que el usuario deja escrito es lo que se imprime.**             *
 *                                                                              *
 * ── DECISIÓN 1 · LA CÁSCARA SE LEE DE `index.html`, NO SE COPIA ──             *
 * Igual que en `diagnostico.dom.test.js` y por lo mismo: el panel de avisos es  *
 * contrato de la cáscara, y una copia a mano podría quedarse en verde con el    *
 * `index.html` real ya roto.                                                    *
 *                                                                              *
 * ── DECISIÓN 2 · EL CAJÓN Y EL DIÁLOGO SON LOS DE VERDAD ──                    *
 * El cajón se monta sobre un `L.Map` real del arnés compartido y el `<dialog>`  *
 * lo fabrica `crearDialogoInforme`. Un doble de cualquiera de los dos sería una *
 * segunda redacción de su API que se desincroniza en silencio, y dejaría estas  *
 * pruebas ciegas justo a un cambio de contrato — que es lo único que este       *
 * fichero existe para vigilar.                                                  *
 *                                                                              *
 * ── DECISIÓN 3 · EL PLANO SE INYECTA, Y NO HAY ALTERNATIVA ──                  *
 * `report/canvas.js` necesita un contexto 2D y jsdom no lo tiene (el paquete    *
 * `canvas` no está instalado ni se va a instalar: es la desviación 1 declarada  *
 * de F09, trasladada al guion de navegador 11). Así que el cableado recibe      *
 * `plano` inyectable y aquí entra un doble que registra con qué se le llamó.    *
 * Lo que sí es REAL es todo lo que va detrás: la maqueta, el escritor de PDF y  *
 * la entrega producen los bytes de verdad.                                      *
 *                                                                              *
 * ── DECISIÓN 4 · EL JPEG DEL DOBLE ES SINTÉTICO Y DECLARA EL TAMAÑO GRANDE ──  *
 * `report/pdf.js` LEE del propio JPEG su tamaño (marcador SOF) y lo contrasta   *
 * contra lo declarado —la defensa contra el WMS que devuelve 4000×2000 cuando   *
 * le piden 4200×100—, y `report/pdf-parcela.js` exige además que la relación de *
 * aspecto de la imagen coincida con la de la caja de papel. Un JPEG de 24×16    *
 * como el de `test/report/` haría saltar esa segunda guarda contra los 180×130  *
 * mm que fija el cableado. La salida honrada es un JPEG mínimo —SOI + SOF0 +    *
 * EOI— que DECLARA el tamaño del encuadre: son los bytes que las dos guardas    *
 * leen, y aquí no se está probando la cartografía sino el cable.                *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { crearPanelAvisos } from '../../app/avisos.js'
import { cablearDiagnostico } from '../../app/cableado-diagnostico.js'
import {
  ACUSE_CANCELADO,
  ACUSE_DESCRIPTIVOS,
  ALTO_PLANO_MM,
  ANCHO_PLANO_MM,
  AVISO_SIN_PLANO,
  MENSAJE_DESCRIPTIVOS_ROTO,
  MENSAJE_PLANO_NO_COMPUESTO,
  MOTIVO_CIERRE_POR_CAMBIO,
  MOTIVO_DESCRIPTIVOS_SIN_DATO,
  MOTIVO_SIN_CLIENTE,
  MOTIVO_SIN_REFCAT,
  cablearInforme,
} from '../../app/cableado-informe.js'
import { SELECTOR as SELECTOR_DIALOGO, selectorEncabezado } from '../../app/dialogo-informe.js'
import { diagnosticar } from '../../diagnostico/parcela.js'
import { TIPO_MIME_PDF, descargarBinario } from '../../gml/descargar.js'
import { parsearGml } from '../../gml/parse.js'
import { ORIGEN_PARCELA, crearParcela } from '../../model/parcela.js'
import {
  NO_CONSTA,
  NO_CONSULTADO,
  NO_SE_HA_PODIDO_CONSULTAR,
  lineasEncabezado,
} from '../../report/firma.js'
import { leerDnprc } from '../../services/_catastro-dnp.js'
import { crearEstadoVista } from '../../viewer/_comun.js'
import {
  SELECTOR as SELECTOR_CAJON,
  crearCajonDiagnostico,
} from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

// `diagnosticar` se envuelve en un espía que llama al ORIGINAL: el comportamiento
// es idéntico y a cambio se puede CONTAR cuántas veces se calcula. Es la única
// forma de afirmar «el informe imprime el diagnóstico del cajón y no uno propio»:
// un recálculo de más no deja ninguna huella observable —daría las mismas cifras
// hoy— y por eso es peligroso. Mismo patrón que `test/app/diagnostico.dom.test.js`.
vi.mock('../../diagnostico/parcela.js', async (importarOriginal) => {
  const real = await importarOriginal()
  return { ...real, diagnosticar: vi.fn(real.diagnosticar) }
})

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

const CUERPO_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/informe.dom.test.js: no se ha encontrado el <body> de index.html. La cáscara ' +
        'de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

// ── Fixtures REALES ──────────────────────────────────────────────────────────

const leer = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')

/** `GetParcel` de la parcela real (1 miembro). */
const PARCELA_FIXTURE = parsearGml(
  leer('test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml'),
).parcelas[0]
const REFCAT = PARCELA_FIXTURE.refcat

/** `GetNeighbourParcel`: 5 miembros para 4 colindantes, con la propia en 2.ª (O15). */
const VECINDAD_FIXTURE = parsearGml(
  leer('test', 'fixtures', 'catastro', 'wfs-neighbour-9398516VK3799G.xml'),
).parcelas
const COLINDANTES = VECINDAD_FIXTURE.filter((p) => p.refcat !== REFCAT)

/** Los dos sobres de `Consulta_DNPRC`, medidos en vivo en F09/T0.2. */
const DNP_URBANA = leerDnprc(
  leer('test', 'fixtures', 'catastro', 'ovc-dnprc-urbana-9398516VK3799G.json'),
)
const DNP_RUSTICA = leerDnprc(
  leer('test', 'fixtures', 'catastro', 'ovc-dnprc-rustica-13005A10900005.json'),
)

const SRS = 'EPSG:25830'
const HUSO = 30

/**
 * El instante que se le inyecta al cableado. Fijo a propósito: de él salen la
 * fecha del encabezado, el `idDocumento` y —a través de él— el nombre del
 * fichero, y poder fijarlo es lo único que permite afirmar algo exacto sobre los
 * tres. `report/` no consulta el reloj por contrato.
 */
const FECHA = new Date(Date.UTC(2026, 7, 2, 17, 4, 53))

/** El identificador que `componerIdDocumento` produce con {@link FECHA}. */
const ID_DOCUMENTO = `CG-${REFCAT}-20260802-170453Z`

/**
 * La parcela tal como la deja `cablearCatastro` tras «Traer del Catastro»: la
 * medida y la OFICIAL nacen iguales. Se construye igual que allí para que este
 * test no invente un estado que la app no produce.
 */
const parcelaDelCatastro = () =>
  crearParcela({
    idLocal: REFCAT,
    refcat: REFCAT,
    recintos: PARCELA_FIXTURE.recintos,
    geometriaOficial: PARCELA_FIXTURE.recintos,
    superficieCatastral: PARCELA_FIXTURE.areaValue,
    origen: ORIGEN_PARCELA.WFS,
  })

/** OTRA parcela, para el caso «ha entrado un expediente nuevo». */
const otraParcela = () =>
  crearParcela({
    idLocal: COLINDANTES[0].refcat,
    refcat: COLINDANTES[0].refcat,
    recintos: COLINDANTES[0].recintos,
    geometriaOficial: COLINDANTES[0].recintos,
    superficieCatastral: COLINDANTES[0].areaValue,
    origen: ORIGEN_PARCELA.WFS,
  })

/** Una parcela SIN referencia catastral: el alta de un particular. */
const parcelaSinRefcat = () =>
  crearParcela({
    idLocal: 'alta-de-particular',
    recintos: PARCELA_FIXTURE.recintos,
    geometriaOficial: PARCELA_FIXTURE.recintos,
    origen: ORIGEN_PARCELA.DXF,
  })

// ── Dobles ───────────────────────────────────────────────────────────────────

/**
 * Un JPEG MÍNIMO que declara `anchoPx × altoPx` en su marcador SOF0. Ver la
 * decisión 4 de la cabecera: `report/pdf.js` lee el tamaño de aquí y
 * `report/pdf-parcela.js` contrasta la relación de aspecto contra la caja de
 * papel, así que lo único que hace falta que sea cierto son estos ocho bytes.
 *
 * Estructura: `FFD8` (SOI) · `FFC0` + longitud 17 + precisión 8 + alto + ancho +
 * 3 componentes de 3 bytes · `FFD9` (EOI).
 */
function jpegQueDeclara(anchoPx, altoPx) {
  return Uint8Array.from([
    0xff, 0xd8,
    0xff, 0xc0, 0x00, 0x11, 0x08,
    (altoPx >> 8) & 0xff, altoPx & 0xff,
    (anchoPx >> 8) & 0xff, anchoPx & 0xff,
    0x03,
    0x01, 0x11, 0x00, 0x02, 0x11, 0x01, 0x03, 0x11, 0x01,
    0xff, 0xd9,
  ])
}

/**
 * Doble de `report/canvas.js#componerPlano`. Registra CON QUÉ se le llamó —que
 * es la mitad de lo que este fichero vigila— y devuelve un `Plano` con la forma
 * del contrato B.
 *
 * @param {object} [opciones]
 * @param {Error|null} [opciones.reventarCon]  Si se pasa, el plano no se compone.
 * @param {Array} [opciones.capasCaidas]  Para el caso «llegó, pero incompleto».
 */
function crearPlanoDoble({ reventarCon = null, capasCaidas = [] } = {}) {
  const llamadas = []
  return {
    llamadas,
    async componer(entrada) {
      llamadas.push(entrada)
      await Promise.resolve()
      if (reventarCon !== null) throw reventarCon
      const { anchoPx, altoPx } = entrada.encuadre
      return {
        jpeg: jpegQueDeclara(anchoPx, altoPx),
        anchoPx,
        altoPx,
        teselasPedidas: 1,
        capasUsadas: ['Catastro'],
        capasCaidas,
        atribucion: '© Dirección General del Catastro',
        teselasCaidas: [],
        peticiones: 1,
        teselasDibujadas: 1,
        metrosBarra: 10,
        calidad: 0.92,
      }
    },
  }
}

/**
 * Doble del CLIENTE del Catastro: solo `descriptivosPorRefcat`, que es lo único
 * que el cableado le pide. Cuenta las llamadas —el presupuesto de red de F09 es
 * UNA petición por expediente— y las referencias con las que se le llamó.
 *
 * @param {object} [opciones]
 * @param {object|null} [opciones.sobre]  El `ResultadoCatastro` que devuelve.
 * @param {Error|null} [opciones.reventarCon]  Para el fallo INESPERADO.
 */
function crearClienteDoble({ sobre = sobreOk(DNP_URBANA), reventarCon = null } = {}) {
  const pedidas = []
  return {
    pedidas,
    async descriptivosPorRefcat(refcat) {
      pedidas.push(refcat)
      await Promise.resolve()
      if (reventarCon !== null) throw reventarCon
      return sobre
    },
  }
}

/** El sobre del contrato E con datos, tal como lo devuelve `services/catastro.js`. */
const sobreOk = (dnp) => ({
  ok: true,
  datos: dnp.datos,
  motivo: null,
  mensaje: null,
  procedencia: { origen: 'RED' },
})

/** El sobre de una consulta que salió y no trajo dato. */
const sobreFallo = (mensaje) => ({
  ok: false,
  datos: null,
  motivo: 'SIN_RED',
  mensaje,
  procedencia: { origen: 'RED' },
})

/** Doble del cableado de F05: de él solo se usa `alColindantes`. */
function crearCatastroDoble() {
  const suscriptores = new Set()
  return {
    get cuantos() {
      return suscriptores.size
    },
    alColindantes(fn) {
      suscriptores.add(fn)
      return () => suscriptores.delete(fn)
    },
    /** Publica, como hace el real tras «Traer colindantes». */
    publicar(parcelas) {
      const resultado = {
        ok: true,
        datos: { propia: null, colindantes: parcelas },
        motivo: null,
        mensaje: null,
      }
      for (const fn of suscriptores) fn(resultado)
    },
  }
}

/** Almacén del pie de firma, en memoria: cumple el puerto y nada más. */
function crearPieFirmaDoble({ firma = null, recordado = false } = {}) {
  const eventos = []
  let guardada = firma
  let hay = recordado
  return {
    eventos,
    async recuperar() {
      eventos.push({ tipo: 'recuperar' })
      return { recordado: hay, firma: guardada, guardadoEn: null, motivo: null, mensaje: null }
    },
    async recordar(f) {
      eventos.push({ tipo: 'recordar', firma: f })
      guardada = f
      hay = true
      return { guardado: true, firma: f, guardadoEn: 1, motivo: null, mensaje: null }
    },
    async olvidar() {
      eventos.push({ tipo: 'olvidar' })
      guardada = null
      hay = false
      return { olvidado: true, habia: true, motivo: null, mensaje: null }
    },
  }
}

/**
 * El entorno de la ENTREGA, espiado — mismo par de dobles que
 * `test/gml/descargar.dom.test.js` y `test/app/diagnostico.dom.test.js`:
 *
 *   · `url` es lo único desde donde se puede AGARRAR el Blob entregado, que es
 *     donde están los bytes de verdad;
 *   · el `click()` heredado de jsdom sobre un `<a href="blob:…">` intenta NAVEGAR
 *     y escupe «Not implemented: navigation». Se sustituye solo él; el resto del
 *     anchor —`href`, `download`, los oyentes— es de verdad, que es lo que
 *     permite comprobar que el clic NO se escapa al `document`.
 *
 * La descarga que se prueba es la REAL (`gml/descargar.js#descargarBinario`).
 */
function crearEntregaEspia({ alHacerClick = () => {} } = {}) {
  const creados = []
  const revocados = []
  const anclas = []
  const url = {
    createObjectURL(blob) {
      const href = `blob:https://concreta.test/${creados.length}`
      creados.push({ blob, href })
      return href
    },
    revokeObjectURL(href) {
      revocados.push(href)
    },
  }
  const documento = {
    body: document.body,
    createElement(etiqueta) {
      const el = document.createElement(etiqueta)
      if (etiqueta === 'a') {
        anclas.push(el)
        el.click = () => alHacerClick(el)
      }
      return el
    },
  }
  return {
    creados,
    revocados,
    anclas,
    descargar: (bytes, opciones) => descargarBinario(bytes, { ...opciones, documento, url }),
    /** Los bytes del último fichero entregado. */
    async ultimosBytes() {
      if (creados.length === 0) return null
      const buf = await creados[creados.length - 1].blob.arrayBuffer()
      return new Uint8Array(buf)
    },
  }
}

// ── Lectura del PDF ──────────────────────────────────────────────────────────

/**
 * Los bytes del PDF como texto latin-1. En latin-1 cada byte es un carácter, así
 * que buscar una frase ASCII dentro es exacto y no se come los bytes altos. Mismo
 * truco que `test/report/pdf-parcela.test.js`.
 */
const comoTexto = (bytes) => Buffer.from(bytes).toString('latin1')

/**
 * Los renglones del PDF, en orden de escritura. De cada `(…) Tj` se saca el texto
 * con los escapes deshechos. Es lo mínimo para poder afirmar sobre una FILA
 * concreta —«qué hay escrito justo después de la etiqueta “Domicilio”»— en vez de
 * buscar una frase suelta en todo el documento, que es como se escribe un test
 * que confunde dos secciones distintas.
 */
function renglonesDelPdf(bytes) {
  const texto = comoTexto(bytes)
  const salida = []
  const re = /\(((?:\\.|[^\\()])*)\)\s*Tj/g
  let m
  while ((m = re.exec(texto)) !== null) {
    salida.push(m[1].replace(/\\([()\\])/g, '$1'))
  }
  return salida
}

/** Lo que hay escrito justo después de una etiqueta, o `null` si no está. */
function valorTrasLaEtiqueta(bytes, etiqueta) {
  const renglones = renglonesDelPdf(bytes)
  const i = renglones.indexOf(etiqueta)
  return i === -1 || i + 1 >= renglones.length ? null : renglones[i + 1]
}

// ── Arnés ────────────────────────────────────────────────────────────────────

const pendientes = []

beforeEach(() => {
  document.body.innerHTML = CUERPO_INDEX
  vi.mocked(diagnosticar).mockClear()
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
 * Store + panel + cajón REALES sobre un `L.Map` real, el cableado del
 * diagnóstico de F07 (para que el botón se encienda como en la app) y el
 * cableado del informe.
 *
 * @param {object} [opciones]
 */
function montar({
  parcelaInicial = parcelaDelCatastro(),
  cliente = crearClienteDoble(),
  catastro = crearCatastroDoble(),
  pieFirma = crearPieFirmaDoble(),
  comprobacion = () => null,
  planoDoble = crearPlanoDoble(),
  entrega = crearEntregaEspia(),
  srs = SRS,
} = {}) {
  const { mapa, destruir: destruirMapa } = montarMapa({ zoom: 19 })
  crearPanes(mapa)

  const estado = crearEstadoVista(parcelaInicial)
  const panel = crearPanelAvisos({
    contenedor: document.getElementById('avisos'),
    chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
    chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
  })
  const cajon = crearCajonDiagnostico({ mapa })
  const contraste = crearContraste({ mapa, zona: HUSO })

  // El cableado de F07, de verdad: es quien pinta el diagnóstico en el cajón y,
  // con él, quien ENCIENDE los dos botones del pie. Sin él, el botón «Preparar
  // informe (PDF)» estaría apagado y este fichero probaría el vacío.
  const diag = cablearDiagnostico({
    estado,
    cajon,
    contraste,
    panel,
    catastro: null,
    comprobacion,
  })

  const informe = cablearInforme({
    estado,
    cajon,
    panel,
    srs,
    diagnostico: diag.ultimoDiagnostico,
    cliente,
    catastro,
    pieFirma,
    comprobacion,
    ahora: () => FECHA,
    plano: planoDoble.componer,
    descargar: entrega.descargar,
  })

  pendientes.push(() => {
    informe.destruir()
    diag.destruir()
    contraste.destruir()
    cajon.destruir()
    destruirMapa()
  })

  const raizCajon = cajon.control.getContainer()
  return {
    mapa,
    estado,
    panel,
    cajon,
    diag,
    informe,
    cliente,
    catastro,
    pieFirma,
    planoDoble,
    entrega,
    raizCajon,
    dialogo: informe.dialogo,
    botonPreparar: raizCajon.querySelector(SELECTOR_CAJON.PREPARAR),
    renglonInforme: raizCajon.querySelector(SELECTOR_CAJON.ESTADO_INFORME),
  }
}

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 40) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

/** Abre el cajón del diagnóstico y espera a que pinte. */
async function abrirDiagnostico(m) {
  await m.diag.abrir()
  await cederTurno()
}

/** El recorrido hasta tener el diálogo abierto. */
async function prepararInforme(m) {
  await abrirDiagnostico(m)
  await m.informe.preparar()
  await cederTurno()
}

/** Un nodo del diálogo, por selector. */
const enDialogo = (m, selector) => m.dialogo.nodo.querySelector(selector)

// ═════════════════════════════════════════════════════════════════════════════
// 1 · Contratos del programador
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · lo que exige de quien lo monta', () => {
  it('lanza nombrando cada dependencia que falte o venga mal', () => {
    const base = () => ({
      estado: crearEstadoVista(null),
      cajon: {
        alPreparar: () => () => {},
        estadoInforme: () => {},
        pintar: () => {},
      },
      panel: { avisar: () => {} },
      srs: SRS,
      diagnostico: () => null,
      dialogo: dialogoInerte(),
    })

    expect(() => cablearInforme({ ...base(), estado: {} })).toThrow(/'estado'/)
    expect(() => cablearInforme({ ...base(), cajon: { pintar: () => {} } })).toThrow(/'cajon'/)
    expect(() => cablearInforme({ ...base(), panel: {} })).toThrow(/'panel'/)
    expect(() => cablearInforme({ ...base(), srs: '' })).toThrow(/'srs'/)
    expect(() => cablearInforme({ ...base(), diagnostico: null })).toThrow(/'diagnostico'/)
    expect(() => cablearInforme({ ...base(), cliente: {} })).toThrow(/'cliente'/)
    expect(() => cablearInforme({ ...base(), catastro: {} })).toThrow(/'catastro'/)
    expect(() => cablearInforme({ ...base(), pieFirma: {} })).toThrow(/'pieFirma'/)
  })

  it("un 'diagnostico' pasado como VALOR y no como función lanza al montar", () => {
    // El error fácil de cometer aquí: pasar el objeto en vez de la función que lo
    // devuelve. Sin guarda se descubriría el día que alguien pulse el botón.
    expect(() =>
      cablearInforme({
        estado: crearEstadoVista(null),
        cajon: { alPreparar: () => () => {}, estadoInforme: () => {}, pintar: () => {} },
        panel: { avisar: () => {} },
        srs: SRS,
        diagnostico: { superficie: {} },
        dialogo: dialogoInerte(),
      }),
    ).toThrow(/'diagnostico' debe ser una función/)
  })

  it('el cajón sin `alPreparar` YA no pasa la guarda de cablearDiagnostico', () => {
    // La mina 2 de esta tarea: sin esta comprobación, un cajón sin ese canal
    // pasaba la validación y el botón primario quedaba montado y MUDO.
    const { mapa, destruir } = montarMapa({ zoom: 19 })
    crearPanes(mapa)
    const cajon = crearCajonDiagnostico({ mapa })
    const contraste = crearContraste({ mapa, zona: HUSO })
    const mutilado = { ...cajon, alPreparar: undefined }
    pendientes.push(() => {
      contraste.destruir()
      cajon.destruir()
      destruir()
    })
    expect(() =>
      cablearDiagnostico({
        estado: crearEstadoVista(null),
        cajon: mutilado,
        contraste,
        panel: { avisar: () => {} },
      }),
    ).toThrow(/'cajon'/)
    // Anti-vacuidad: el cajón ENTERO sí pasa.
    expect(() =>
      cablearDiagnostico({
        estado: crearEstadoVista(null),
        cajon,
        contraste,
        panel: { avisar: () => {} },
      }).destruir(),
    ).not.toThrow()
  })
})

/** Un diálogo inerte con la forma del contrato, para las pruebas de guardas. */
function dialogoInerte() {
  return {
    nodo: document.createElement('div'),
    fijar() {},
    fijarLindero() {},
    abrir() {},
    cerrar() {},
    abierto: () => false,
    valores: () => null,
    puedeComponer: () => false,
    estado() {},
    alComponer: () => () => {},
    alRegenerar: () => () => {},
    alCancelar: () => () => {},
    destruir() {},
  }
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · El gate: sin diagnóstico no hay informe
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · el gate del pie', () => {
  it('el botón «Preparar informe (PDF)» existe, NACE apagado y se enciende con el diagnóstico', async () => {
    const m = montar()
    expect(m.botonPreparar).not.toBeNull()
    expect(m.botonPreparar.disabled).toBe(true)

    await abrirDiagnostico(m)
    expect(m.botonPreparar.disabled).toBe(false)
  })

  it('pulsar sin diagnóstico no abre el diálogo ni toca la red', async () => {
    const m = montar()
    await m.informe.preparar()
    await cederTurno()

    expect(m.dialogo.abierto()).toBe(false)
    expect(m.cliente.pedidas).toHaveLength(0)
    // Y el cajón vuelve a escribir SU motivo, que es el único sitio donde vive.
    expect(m.renglonInforme.textContent).not.toBe('')
  })

  it('el clic real en el botón dispara el recorrido', async () => {
    const m = montar()
    await abrirDiagnostico(m)
    m.botonPreparar.click()
    await cederTurno()

    expect(m.dialogo.abierto()).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 3 · El recorrido completo, de punta a punta
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · el recorrido completo', () => {
  it('de pulsar el botón a los bytes del PDF en la carpeta de descargas', async () => {
    const m = montar()
    m.catastro.publicar(COLINDANTES)
    await prepararInforme(m)

    // ── 1 · Se ha consultado el DNPRC, UNA vez y con la referencia de la parcela.
    expect(m.cliente.pedidas).toEqual([REFCAT])

    // ── 2 · El diálogo está abierto con el encabezado compuesto…
    expect(m.dialogo.abierto()).toBe(true)
    expect(enDialogo(m, selectorEncabezado('municipio')).value).toBe('MADRID')
    expect(enDialogo(m, selectorEncabezado('provincia')).value).toBe('MADRID')
    expect(enDialogo(m, selectorEncabezado('refcat')).textContent).toBe(REFCAT)
    expect(enDialogo(m, selectorEncabezado('srs')).textContent).toBe(SRS)
    expect(enDialogo(m, selectorEncabezado('idDocumento')).textContent).toBe(ID_DOCUMENTO)

    // … y con el lindero YA redactado (no un cuadro en blanco).
    const cuadro = enDialogo(m, SELECTOR_DIALOGO.LITERAL)
    expect(cuadro.value).toMatch(/Linda al /)
    // Las colindantes publicadas se han USADO: el literal nombra las que de verdad
    // alcanzan un lindero. No se exige que salgan las cuatro —una parcela vecina
    // en el WFS puede no tocar el contorno— sino que la suscripción haya servido
    // para algo, que es lo que este cableado aporta.
    expect(COLINDANTES.some((c) => cuadro.value.includes(c.refcat))).toBe(true)

    // ── 3 · «Componer PDF» NACE APAGADO, porque el borrador de esta parcela
    // propone un frente como vía pública y eso no se ha medido. Es la única
    // excepción a la regla de oro 9 en toda la aplicación, y el diálogo la pone
    // detrás de un acuse con la mano — aquí se comprueba de punta a punta que el
    // cable no la ha desactivado por el camino.
    expect(m.dialogo.puedeComponer()).toBe(false)
    expect(enDialogo(m, SELECTOR_DIALOGO.PRESUNCION).hidden).toBe(false)
    const acuse = enDialogo(m, SELECTOR_DIALOGO.ACUSE)
    acuse.checked = true
    acuse.dispatchEvent(new Event('change', { bubbles: true }))
    expect(m.dialogo.puedeComponer()).toBe(true)

    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    // El plano se ha pedido UNA vez, con el encuadre de 180×130 mm y el SRS del
    // expediente — no con los valores por defecto de `report/canvas.js`.
    expect(m.planoDoble.llamadas).toHaveLength(1)
    const [entradaPlano] = m.planoDoble.llamadas
    expect(entradaPlano.srs).toBe(SRS)
    expect(entradaPlano.encuadre.anchoMm).toBe(ANCHO_PLANO_MM)
    expect(entradaPlano.encuadre.altoMm).toBe(ALTO_PLANO_MM)
    // Y con la geometría OFICIAL, que es la mitad del contraste que el plano
    // existe para enseñar.
    expect(entradaPlano.recintosOficiales).not.toBeNull()

    // ── 4 · Han bajado bytes, y son un PDF.
    const bytes = await m.entrega.ultimosBytes()
    expect(bytes).not.toBeNull()
    expect(bytes.length).toBeGreaterThan(0)
    expect(comoTexto(bytes.slice(0, 5))).toBe('%PDF-')
    expect(m.entrega.creados[0].blob.type).toBe(TIPO_MIME_PDF)
    expect(m.entrega.anclas[0].download).toBe(`informe-contraste-${ID_DOCUMENTO}.pdf`)
    // La URL del blob se revoca SIEMPRE: sin esto, una sesión de trabajo deja
    // decenas de PDF vivos en memoria.
    expect(m.entrega.revocados).toEqual([m.entrega.creados[0].href])

    // ── 5 · El diálogo se cierra y el acuse queda donde el usuario mira.
    expect(m.dialogo.abierto()).toBe(false)
    expect(m.renglonInforme.textContent).toContain(`informe-contraste-${ID_DOCUMENTO}.pdf`)
  })

  it('el PDF lleva dentro el nombre legal, la fecha inyectada y el identificador', async () => {
    const m = montar()
    await prepararInforme(m)
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    const texto = comoTexto(await m.entrega.ultimosBytes())
    expect(texto).toContain('Informe de contraste con el parcelario catastral')
    expect(texto).toContain(ID_DOCUMENTO)
    // La fecha del documento es la INYECTADA, no la del reloj del sistema: es lo
    // que hace que el mismo expediente produzca siempre el mismo papel.
    expect(texto).toContain('D:20260802170453Z')
    // Y ni una sigla de los documentos OFICIALES del Catastro (SPEC §11.1).
    expect(texto).not.toMatch(/\bIVG\b/)
    expect(texto).not.toMatch(/\bVGA\b/)
  })

  it('una segunda pulsación NO gasta una segunda petición al Catastro', async () => {
    const m = montar()
    await prepararInforme(m)
    m.dialogo.cerrar()
    await m.informe.preparar()
    await cederTurno()

    // El presupuesto de red de F09 es +1 petición, y la caché por expediente es lo
    // que lo cumple aunque el usuario prepare el informe cinco veces.
    expect(m.cliente.pedidas).toEqual([REFCAT])
    expect(m.dialogo.abierto()).toBe(true)
  })

  it('otra parcela SÍ vuelve a consultar (la caché es por expediente, no global)', async () => {
    const m = montar()
    await prepararInforme(m)
    m.estado.set(otraParcela())
    await cederTurno()
    await prepararInforme(m)

    expect(m.cliente.pedidas).toEqual([REFCAT, COLINDANTES[0].refcat])
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 4 · LA MINA · la procedencia se propaga, o el informe miente
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · la procedencia de los descriptivos', () => {
  it('un campo consultado y AUSENTE se imprime «No consta», nunca «No se ha consultado»', async () => {
    // El caso REAL: la parcela urbana de referencia contesta con municipio y
    // provincia y **sin domicilio** (viene por la rama de varios inmuebles, que no
    // trae `ldt`). Si la procedencia no se propagara, el informe diría que ese
    // campo no se ha consultado — y sí se consultó.
    const m = montar()
    await prepararInforme(m)

    const apunte = enDialogo(m, selectorEncabezado('domicilio')).nextElementSibling
    expect(apunte).not.toBeNull()
    expect(apunte.textContent).toContain(NO_CONSTA)
    expect(apunte.textContent).not.toContain(NO_CONSULTADO)

    // Y en el PAPEL, que es lo que alguien firma. Se mira la FILA del encabezado y
    // no todo el documento: «No se ha consultado» es también la respuesta correcta
    // de otras secciones (la invasión a colindantes, cuando nadie las trajo), y
    // buscarla suelta confundiría dos afirmaciones distintas.
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()
    const bytes = await m.entrega.ultimosBytes()
    expect(valorTrasLaEtiqueta(bytes, 'Domicilio')).toBe(NO_CONSTA)
  })

  it('CONTROL NEGATIVO: sin propagar la procedencia, ese mismo campo diría «No se ha consultado»', () => {
    // Sin este control, la prueba de arriba pasaría igual con un `lineasEncabezado`
    // que nunca escribiera «No se ha consultado». Aquí se comprueba que la
    // diferencia EXISTE y que es exactamente la que la mina describe.
    const encabezado = {
      municipio: 'MADRID',
      provincia: 'MADRID',
      paraje: null,
      poligono: null,
      parcela: null,
      domicilio: null,
      clase: 'URBANA',
      refcat: REFCAT,
      srs: SRS,
      fecha: FECHA,
      idDocumento: ID_DOCUMENTO,
    }
    const conProcedencia = lineasEncabezado(encabezado, {
      procedencia: { consultado: true, ok: true, motivo: null, mensaje: null },
    })
    const sinProcedencia = lineasEncabezado(encabezado)

    const domicilioDe = (lineas) => lineas.find((l) => l.campo === 'domicilio').valor
    expect(domicilioDe(conProcedencia)).toBe(NO_CONSTA)
    expect(domicilioDe(sinProcedencia)).toBe(NO_CONSULTADO)
  })

  it('sin referencia catastral no se consulta nada, y se DICE', async () => {
    const m = montar({ parcelaInicial: parcelaSinRefcat() })
    await prepararInforme(m)

    expect(m.cliente.pedidas).toHaveLength(0)
    expect(m.renglonInforme.textContent).toBe(MOTIVO_SIN_REFCAT)
    // «No se ha consultado» aquí es la VERDAD, y por eso sí sale.
    const apunte = enDialogo(m, selectorEncabezado('municipio')).nextElementSibling
    expect(apunte.textContent).toContain(NO_CONSULTADO)
  })

  it('sin cliente del Catastro tampoco, y también se dice', async () => {
    const m = montar({ cliente: null })
    await prepararInforme(m)

    expect(m.renglonInforme.textContent).toBe(MOTIVO_SIN_CLIENTE)
    expect(m.dialogo.abierto()).toBe(true)
  })

  it('la CLASE alimenta las dos cosas: las filas del encabezado y el literal', async () => {
    // En rústica salen paraje, polígono y parcela; en urbana no salen porque no
    // existen para la finca. Una sola fuente —el encabezado— para las dos.
    const m = montar({ cliente: crearClienteDoble({ sobre: sobreOk(DNP_RUSTICA) }) })
    await prepararInforme(m)

    expect(enDialogo(m, selectorEncabezado('paraje')).value).toBe('C.BOLSA')
    expect(enDialogo(m, selectorEncabezado('poligono')).value).toBe('109')
    expect(enDialogo(m, selectorEncabezado('parcela')).value).toBe('5')

    // Y en urbana esas tres filas NO se pintan.
    const urbana = montar()
    await prepararInforme(urbana)
    expect(enDialogo(urbana, selectorEncabezado('paraje'))).toBeNull()
    expect(enDialogo(urbana, selectorEncabezado('domicilio'))).not.toBeNull()
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · Los fallos de red no cancelan nada
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · el DNPRC que no contesta', () => {
  it('un `ok:false` del servicio NO cancela el informe: se compone con «No se ha podido consultar»', async () => {
    const m = montar({
      cliente: crearClienteDoble({ sobre: sobreFallo('El Catastro no ha contestado a tiempo.') }),
    })
    await prepararInforme(m)

    expect(m.dialogo.abierto()).toBe(true)
    expect(m.renglonInforme.textContent).toBe(MOTIVO_DESCRIPTIVOS_SIN_DATO)
    const apunte = enDialogo(m, selectorEncabezado('municipio')).nextElementSibling
    expect(apunte.textContent).toContain(NO_SE_HA_PODIDO_CONSULTAR)
    // El mensaje del servicio se copia LITERAL, sin traducir (regla de oro 1).
    expect(apunte.textContent).toContain('El Catastro no ha contestado a tiempo.')

    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()
    const texto = comoTexto(await m.entrega.ultimosBytes())
    expect(texto).toContain(NO_SE_HA_PODIDO_CONSULTAR)
  })

  it('un fallo INESPERADO del cliente se envuelve y el informe sale igual', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const m = montar({
      cliente: crearClienteDoble({ reventarCon: new Error('el transporte ha reventado') }),
    })
    await prepararInforme(m)

    expect(m.dialogo.abierto()).toBe(true)
    const apunte = enDialogo(m, selectorEncabezado('municipio')).nextElementSibling
    expect(apunte.textContent).toContain(MENSAJE_DESCRIPTIVOS_ROTO)
    expect(console.error).toHaveBeenCalled()
  })
})

describe('cablearInforme · el plano que no se puede componer', () => {
  it('el informe se compone SIN plano, se descarga igual y se dice por los tres canales', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const m = montar({
      planoDoble: crearPlanoDoble({ reventarCon: new Error('el WMS no ha contestado') }),
    })
    await prepararInforme(m)
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    // 1 · El panel de avisos.
    const avisos = [...document.querySelectorAll('#avisos [data-aviso], #avisos li, #avisos p')]
      .map((n) => n.textContent)
      .join(' ')
    expect(avisos).toContain(MENSAJE_PLANO_NO_COMPUESTO)
    // 2 · El renglón del pie.
    expect(m.renglonInforme.textContent).toContain(AVISO_SIN_PLANO)
    // 3 · El propio PDF, que es lo único que sobrevive a que alguien lo reenvíe.
    const bytes = await m.entrega.ultimosBytes()
    expect(comoTexto(bytes.slice(0, 5))).toBe('%PDF-')
    expect(comoTexto(bytes)).toContain('No se ha podido componer el plano de situaci')
  })

  it('una CAPA caída no tumba el plano, pero se cuenta', async () => {
    const m = montar({
      planoDoble: crearPlanoDoble({
        capasCaidas: [{ capa: 'Catastro', motivo: 'el servidor ha contestado 500' }],
      }),
    })
    await prepararInforme(m)
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    const avisos = document.getElementById('avisos').textContent
    expect(avisos).toContain('el servidor ha contestado 500')
    expect(m.renglonInforme.textContent).toContain('incidencia')
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · LA MINA 3 · el clic de la descarga no puede cerrar el cajón
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · la entrega binaria', () => {
  it('el clic del <a download> NO llega al `document` y el cajón sigue abierto', async () => {
    // El defecto REAL de F08, medido en navegador: el `click()` del anchor burbujea
    // hasta `document`, el guardián de clic-fuera del cajón lo cuenta como un clic
    // FUERA y lo cierra — dejando el acuse de recibo en un `role="status"` que
    // acaba de quedar en `display:none`. `descargarBinario` hereda de la cadena
    // compartida el `stopPropagation` en fase de CAPTURA que lo impide.
    const vistos = []
    // La MISMA referencia para el alta y para la baja, o el oyente sobreviviría al
    // test y contaminaría los siguientes.
    const espiarClic = (e) => vistos.push(e.target)
    document.addEventListener('click', espiarClic)
    pendientes.push(() => document.removeEventListener('click', espiarClic))

    const entrega = crearEntregaEspia({
      // El clic de VERDAD, con burbujeo: es la única forma de reproducir el fallo.
      alHacerClick: (a) => a.dispatchEvent(new MouseEvent('click', { bubbles: true })),
    })
    const m = montar({ entrega })
    await prepararInforme(m)
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    // El clic del anchor NO ha llegado al `document`…
    expect(vistos.filter((n) => n.tagName === 'A')).toHaveLength(0)
    // … el cajón sigue abierto…
    expect(m.cajon.abierto()).toBe(true)
    // … y el acuse está donde se puede leer.
    expect(m.renglonInforme.textContent).toContain('Descargado')
  })

  it('un entorno sin `URL.createObjectURL` no baja nada, lo dice y deja el diálogo abierto', async () => {
    const m = montar({
      entrega: {
        creados: [],
        anclas: [],
        revocados: [],
        descargar: (bytes, opciones) => descargarBinario(bytes, { ...opciones, url: {} }),
        ultimosBytes: async () => null,
      },
    })
    await prepararInforme(m)
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    // El diálogo se queda ABIERTO: el documento sigue preparado y volver a pulsar
    // es la acción correcta.
    expect(m.dialogo.abierto()).toBe(true)
    expect(enDialogo(m, SELECTOR_DIALOGO.ESTADO).textContent).toContain(
      'no implementa URL.createObjectURL',
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · Lo que el usuario deja escrito es lo que se imprime
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · las correcciones del usuario', () => {
  it('el lindero REESCRITO llega al papel (y no el borrador de la aplicación)', async () => {
    const m = montar()
    await prepararInforme(m)

    const cuadro = enDialogo(m, SELECTOR_DIALOGO.LITERAL)
    const original = cuadro.value
    cuadro.value = 'Linda al Norte con el camino viejo.\n\nY al Sur con nada de esto.'
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    const texto = comoTexto(await m.entrega.ultimosBytes())
    expect(texto).toContain('Linda al Norte con el camino viejo.')
    expect(texto).toContain('Y al Sur con nada de esto.')
    // Anti-vacuidad: el borrador original decía otra cosa y ya no está.
    expect(original).not.toContain('camino viejo')
  })

  it('el encabezado CORREGIDO a mano llega al papel', async () => {
    const m = montar()
    await prepararInforme(m)

    enDialogo(m, selectorEncabezado('municipio')).value = 'Villanueva del Contraste'
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    expect(comoTexto(await m.entrega.ultimosBytes())).toContain('Villanueva del Contraste')
  })

  it('la casilla «Recordar» guarda el pie de firma; desmarcarla lo BORRA', async () => {
    const pieFirma = crearPieFirmaDoble()
    const m = montar({ pieFirma })
    await prepararInforme(m)

    m.dialogo.nodo.querySelector('[data-firma="nombre"]').value = 'Nombre Apellido'
    m.dialogo.nodo.querySelector('[data-firma="numeroColegiado"]').value = '04321'
    enDialogo(m, SELECTOR_DIALOGO.RECORDAR).checked = true
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    const guardado = pieFirma.eventos.find((e) => e.tipo === 'recordar')
    expect(guardado).toBeDefined()
    expect(guardado.firma.nombre).toBe('Nombre Apellido')
    expect(guardado.firma.numeroColegiado).toBe('04321')
    // Y va al papel.
    expect(comoTexto(await m.entrega.ultimosBytes())).toContain('Nombre Apellido')

    // Ahora sin marcar: desmarcar la casilla de privacidad BORRA lo guardado.
    pieFirma.eventos.length = 0
    await m.informe.preparar()
    await cederTurno()
    enDialogo(m, SELECTOR_DIALOGO.RECORDAR).checked = false
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    expect(pieFirma.eventos.some((e) => e.tipo === 'olvidar')).toBe(true)
  })

  it('«Regenerar» rehace el borrador con las colindantes que hayan llegado después', async () => {
    // El diálogo restaura por su cuenta el borrador que guardó; lo que este cable
    // aporta es RECALCULARLO con lo que se sepa ahora. Si entre abrir el diálogo y
    // pulsar «Regenerar» han llegado las vecinas, el lindero pasa de «no se han
    // consultado» a nombrarlas una por una.
    const m = montar()
    await prepararInforme(m)
    const cuadro = enDialogo(m, SELECTOR_DIALOGO.LITERAL)
    const sinVecinas = cuadro.value
    expect(COLINDANTES.some((c) => sinVecinas.includes(c.refcat))).toBe(false)

    m.catastro.publicar(COLINDANTES)
    enDialogo(m, SELECTOR_DIALOGO.REGENERAR).click()
    await cederTurno()

    expect(cuadro.value).not.toBe(sinVecinas)
    expect(COLINDANTES.some((c) => cuadro.value.includes(c.refcat))).toBe(true)
  })

  it('«Regenerar» sin nada nuevo NO pisa el acuse que escribe el propio diálogo', async () => {
    const m = montar()
    await prepararInforme(m)
    enDialogo(m, SELECTOR_DIALOGO.REGENERAR).click()
    await cederTurno()

    // El diálogo escribe «el texto ya era el borrador…»; sustituirlo por lo mismo
    // repintaría el gate y se llevaría ese acuse por delante.
    expect(enDialogo(m, SELECTOR_DIALOGO.ESTADO).textContent).toMatch(/borrador/i)
  })

  it('la firma RECORDADA se precarga al abrir el diálogo', async () => {
    const m = montar({
      pieFirma: crearPieFirmaDoble({
        firma: {
          nombre: 'Quien Firmó Ayer',
          numeroColegiado: '00007',
          colegio: null,
          contacto: null,
        },
        recordado: true,
      }),
    })
    await prepararInforme(m)

    expect(m.dialogo.nodo.querySelector('[data-firma="nombre"]').value).toBe('Quien Firmó Ayer')
    expect(enDialogo(m, SELECTOR_DIALOGO.RECORDAR).checked).toBe(true)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · La identidad del documento
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · el documento describe lo que hay en pantalla', () => {
  it('si el store cambia con el diálogo abierto, se cierra y se dice por qué', async () => {
    const m = montar()
    await prepararInforme(m)
    expect(m.dialogo.abierto()).toBe(true)

    m.estado.set(otraParcela())
    await cederTurno()

    expect(m.dialogo.abierto()).toBe(false)
    expect(m.renglonInforme.textContent).toBe(MOTIVO_CIERRE_POR_CAMBIO)
  })

  it('cancelar el diálogo no compone nada, y se dice', async () => {
    const m = montar()
    await prepararInforme(m)
    enDialogo(m, SELECTOR_DIALOGO.CANCELAR).click()
    await cederTurno()

    expect(m.dialogo.abierto()).toBe(false)
    expect(m.renglonInforme.textContent).toBe(ACUSE_CANCELADO)
    expect(m.entrega.creados).toHaveLength(0)
  })

  it('el diagnóstico que se imprime es EL DEL CAJÓN, no uno recalculado', async () => {
    const m = montar()
    await abrirDiagnostico(m)
    // El cajón ya ha calculado el suyo: sin esta comprobación, la de abajo sería
    // vacua (cero llamadas antes y cero después probaría solo que nadie mide nada).
    const antes = vi.mocked(diagnosticar).mock.calls.length
    expect(antes).toBeGreaterThan(0)

    // A partir de aquí, cualquier `diagnosticar()` sería un SEGUNDO cálculo — y con
    // él, una segunda verdad sobre el mismo expediente.
    await m.informe.preparar()
    await cederTurno()
    enDialogo(m, SELECTOR_DIALOGO.COMPONER).click()
    await cederTurno()

    expect(vi.mocked(diagnosticar).mock.calls.length).toBe(antes)
    // Y la superficie que sale en el papel es la que el cajón está enseñando.
    const medidaEnCajon = m.raizCajon.querySelector(SELECTOR_CAJON.MEDIDA).textContent
    const cifra = medidaEnCajon.replace(/[^\d,]/g, '').split(',')[0]
    expect(comoTexto(await m.entrega.ultimosBytes())).toContain(cifra)
  })

  it('el acuse de la consulta se escribe cuando el botón está encendido', async () => {
    const m = montar()
    await prepararInforme(m)
    expect(enDialogo(m, SELECTOR_DIALOGO.ESTADO).textContent).toBe(ACUSE_DESCRIPTIVOS)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · Ciclo de vida
// ═════════════════════════════════════════════════════════════════════════════

describe('cablearInforme · destruir', () => {
  it('es idempotente y deja el botón sin llamar a nadie', async () => {
    const m = montar()
    await abrirDiagnostico(m)
    m.informe.destruir()
    expect(() => m.informe.destruir()).not.toThrow()

    m.botonPreparar.click()
    await cederTurno()
    expect(m.cliente.pedidas).toHaveLength(0)
  })

  it('el `<dialog>` que fabricó este módulo se retira del documento', async () => {
    const m = montar()
    const nodo = m.dialogo.nodo
    expect(nodo.isConnected).toBe(true)
    m.informe.destruir()
    expect(nodo.isConnected).toBe(false)
  })

  it('un diálogo INYECTADO no se destruye: es de quien lo pasó', () => {
    const inyectado = dialogoInerte()
    let destruido = false
    inyectado.destruir = () => {
      destruido = true
    }
    const cableado = cablearInforme({
      estado: crearEstadoVista(null),
      cajon: { alPreparar: () => () => {}, estadoInforme: () => {}, pintar: () => {} },
      panel: { avisar: () => {} },
      srs: SRS,
      diagnostico: () => null,
      dialogo: inyectado,
    })
    cableado.destruir()
    expect(destruido).toBe(false)
  })
})

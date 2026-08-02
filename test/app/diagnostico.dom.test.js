/* -------------------------------------------------------------------------- *
 * test/app/diagnostico.dom.test.js — F07 · T4.3 · el diagnóstico, cableado     *
 *                                                                              *
 * `diagnostico/` sabe medir, `viewer/cajon-diagnostico.js` sabe enseñarlo y     *
 * `viewer/contraste.js` sabe señalarlo. Mientras nadie los enchufe, F07 entera  *
 * es código muerto. Aquí se prueba el CABLE, no las piezas.                     *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelven a probar las nueve métricas (`test/diagnostico/parcela.test.js`),*
 * el dibujo (`test/viewer/contraste.dom.test.js`) ni el cajón                   *
 * (`test/viewer/cajon-diagnostico.dom.test.js`). Se prueban las CINCO cosas de  *
 * las que el cableado es dueño: el CTA y su motivo, la petición única de        *
 * vecinas, la traducción (con el override O15 dentro), el estado del expediente *
 * y la cadencia del recálculo.                                                  *
 *                                                                              *
 * ── DECISIÓN 1 · LA CÁSCARA SE LEE DE `index.html`, NO SE COPIA ──             *
 * Igual que en `catastro.dom.test.js` y por lo mismo: los dos `data-*` del CTA  *
 * y el `disabled` con el que nace son CONTRATO, y una copia a mano podría       *
 * quedarse en verde con la cáscara ya rota.                                     *
 *                                                                              *
 * ── DECISIÓN 2 · EL CAJÓN Y EL CONTRASTE SON LOS DE VERDAD ──                  *
 * Se montan sobre un `L.Map` real del arnés compartido                          *
 * (`test/viewer/_ayuda-jsdom.js#montarMapa`), no con dobles. Un doble del cajón *
 * habría sido una segunda redacción de su API que se desincroniza en silencio,  *
 * y además dejaría estas pruebas ciegas a un cambio de contrato. Lo que sí se   *
 * ahorra es el visor entero: capas, WMS, tabla, sincronización y encuadre.      *
 *                                                                              *
 * ── DECISIÓN 3 · PARA LAS VECINAS, EL CAMINO REAL ──                           *
 * El test del override O15 —«la propia NO puede colarse entre las colindantes»— *
 * no significa nada contra un doble que devuelva la lista ya limpia. Se monta   *
 * `cablearCatastro` de verdad, con el cliente real, sobre un transporte doble   *
 * que sirve el fixture `GetNeighbourParcel` capturado del servicio (5 miembros  *
 * para 4 colindantes, con la propia en 2.ª posición). Para todo lo demás basta  *
 * un doble ligero del cableado de F05, que es lo que este módulo consume.       *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import L from 'leaflet'

import { crearPanelAvisos } from '../../app/avisos.js'
import {
  COLA_SIN_VECINAS,
  EXTENSION_INFORME,
  MENSAJE_FALLO_INESPERADO,
  MENSAJE_INFORME_NO_COMPUESTO,
  MENSAJE_INFORME_NO_ENTREGADO,
  MOTIVO_SIN_CATASTRO,
  MOTIVO_SIN_OFICIAL,
  PREFIJO_INFORME,
  SELECTOR_BOTON_DIAGNOSTICAR,
  SELECTOR_ESTADO_DIAGNOSTICO,
  cablearDiagnostico,
  nombreFicheroInforme,
} from '../../app/cableado-diagnostico.js'
import { cablearCatastro } from '../../app/cableado-catastro.js'
import { comprobarGml } from '../../comprobacion/gml.js'
import { diagnosticar } from '../../diagnostico/parcela.js'
import {
  EXTENSION_GML,
  PREFIJO_NOMBRE,
  TIPO_MIME_TEXTO,
  descargarTexto,
  nombreFicheroGml,
} from '../../gml/descargar.js'
import { parsearGml } from '../../gml/parse.js'
import { ORIGEN_PARCELA, crearParcela } from '../../model/parcela.js'
import { crearClienteCatastro } from '../../services/catastro.js'
import { PANE, crearEstadoVista } from '../../viewer/_comun.js'
import {
  MOTIVO_INFORME_SIN_DIAGNOSTICO,
  SELECTOR as SELECTOR_CAJON,
  crearCajonDiagnostico,
} from '../../viewer/cajon-diagnostico.js'
import { crearContraste } from '../../viewer/contraste.js'
import { crearPanes, montarMapa } from '../viewer/_ayuda-jsdom.js'

// `diagnosticar` se envuelve en un espía que llama al ORIGINAL: el comportamiento
// es idéntico y a cambio se puede CONTAR cuántas veces se recalcula. Es la única
// forma de afirmar «una vez por operación acabada, nunca por frame»: un recálculo
// de más no deja ninguna huella observable en el DOM, que es justo lo que lo hace
// peligroso. Mismo patrón —y por lo mismo— que el espía sobre `sincronizar` de
// `test/viewer/index.dom.test.js`.
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
      'test/app/diagnostico.dom.test.js: no se ha encontrado el <body> de index.html. La ' +
        'cáscara de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

// ── Fixtures REALES ──────────────────────────────────────────────────────────

const leer = (...ruta) => readFileSync(join(RAIZ, ...ruta), 'utf8')

/** `GetParcel` de la parcela real (1 miembro). */
const TEXTO_PARCELA = leer('test', 'fixtures', 'gml', 'cp_parcela_9398516VK3799G.gml')
/** `GetNeighbourParcel`: 5 miembros para 4 colindantes, con la propia en 2.ª (O15). */
const TEXTO_VECINDAD = leer(
  'test',
  'fixtures',
  'catastro',
  'wfs-neighbour-9398516VK3799G.xml',
)

const PARCELA_FIXTURE = parsearGml(TEXTO_PARCELA).parcelas[0]
const REFCAT = PARCELA_FIXTURE.refcat
const VECINDAD_FIXTURE = parsearGml(TEXTO_VECINDAD).parcelas

const SRS = 'EPSG:25830'
const HUSO = 30

/**
 * La parcela tal como la deja `cablearCatastro` tras «Traer del Catastro»: la
 * medida y la OFICIAL nacen iguales, y la superficie catastral es el `areaValue`
 * DECLARADO. Se construye igual que allí (mismos cinco campos) para que este test
 * no invente un estado que la app no produce.
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

/** La misma parcela con un vértice movido 40 cm al norte: una edición cualquiera. */
function parcelaEditada() {
  const base = parcelaDelCatastro()
  const movidos = base.recintos[0].vertices.map((v, i) => (i === 0 ? [v[0], v[1] + 0.4] : v))
  return crearParcela({
    idLocal: base.idLocal,
    refcat: base.refcat,
    recintos: [{ vertices: movidos, tipo: base.recintos[0].tipo }, ...base.recintos.slice(1)],
    geometriaOficial: base.geometriaOficial,
    superficieCatastral: base.superficieCatastral,
    origen: base.origen,
  })
}

/** Una parcela SIN contorno oficial: la de un DXF o un contorno dibujado. */
const parcelaSinOficial = () =>
  crearParcela({
    idLocal: 'de-un-dxf',
    recintos: PARCELA_FIXTURE.recintos,
    origen: ORIGEN_PARCELA.DXF,
  })

/** OTRA parcela distinta, para el caso «ha entrado un expediente nuevo». */
const otraParcela = () => {
  const vecina = VECINDAD_FIXTURE.find((p) => p.refcat !== REFCAT)
  return crearParcela({
    idLocal: vecina.refcat,
    refcat: vecina.refcat,
    recintos: vecina.recintos,
    geometriaOficial: vecina.recintos,
    superficieCatastral: vecina.areaValue,
    origen: ORIGEN_PARCELA.WFS,
  })
}

// ── Dobles ───────────────────────────────────────────────────────────────────

/**
 * Doble LIGERO del cableado de F05: solo lo que este módulo le pide
 * (`colindantes` y `alColindantes`), y reproduciendo las DOS cosas de su
 * comportamiento de las que el cableado depende: **publica ANTES de devolver**, y
 * **cede el turno antes de publicar**.
 *
 * Lo segundo no es adorno: el `colindantes()` real espera a la caché —asíncrona por
 * contrato— antes de tocar la red, así que la publicación NUNCA ocurre en el mismo
 * tick del clic. Un doble síncrono adoptaría las vecinas dentro del propio
 * `boton.click()` y dejaría sin probar justo la decisión que este módulo toma: que
 * el cajón se pinta ANTES de que lleguen.
 *
 * @param {object} [opciones]
 * @param {Array|null} [opciones.parcelas]  Qué colindantes trae. `null` ⇒ la
 *   consulta falla con `ok:false`, que es como el cliente cuenta un fallo de red.
 */
function crearCatastroDoble({ parcelas = VECINDAD_FIXTURE.filter((p) => p.refcat !== REFCAT) } = {}) {
  const suscriptores = new Set()
  let llamadas = 0
  return {
    get llamadas() {
      return llamadas
    },
    async colindantes() {
      llamadas += 1
      await Promise.resolve()
      const resultado =
        parcelas === null
          ? { ok: false, datos: null, motivo: 'SIN_RED', mensaje: 'no hay red', procedencia: {} }
          : { ok: true, datos: { propia: null, colindantes: parcelas }, motivo: null, mensaje: null, procedencia: {} }
      if (resultado.ok) for (const fn of suscriptores) fn(resultado)
      return resultado
    },
    alColindantes(fn) {
      suscriptores.add(fn)
      return () => suscriptores.delete(fn)
    },
  }
}

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
 * Transporte doble para el camino REAL del Catastro (decisión 3). No conoce
 * `fetch`: es imposible que esta suite toque la red.
 */
function crearTransporteDoble() {
  const peticiones = []
  return {
    peticiones,
    async pedirTexto(url) {
      peticiones.push(url)
      return http200(url, url.includes('GetNeighbourParcel') ? TEXTO_VECINDAD : TEXTO_PARCELA)
    },
    estado: () => ({ peticiones: peticiones.length }),
    destruir() {},
  }
}

/**
 * El instante que se le inyecta al cableado para el informe. Fijo a propósito: la
 * fecha entra en la CABECERA del informe **y** en el nombre del fichero, y poder
 * fijarla es lo único que permite afirmar algo exacto sobre los dos.
 * `report/contraste-texto.js` no consulta el reloj por contrato.
 */
const FECHA_INFORME = new Date(Date.UTC(2026, 6, 30, 11, 45, 30))

/**
 * El entorno de la ENTREGA, espiado — mismo par de dobles que
 * `test/gml/descargar.dom.test.js`, y por lo mismo:
 *
 *   · `url` es lo único desde donde se puede AGARRAR el Blob que se entrega, que es
 *     donde están los bytes de verdad. Inyectarlo (en vez de parchear el global)
 *     evita contaminar a los demás ficheros de test.
 *   · el `click()` heredado de jsdom sobre un `<a href="blob:…">` intenta NAVEGAR y
 *     escupe un «Not implemented: navigation». Se sustituye solo él; el resto del
 *     anchor —`href`, `download`, `isConnected`— es de verdad.
 *
 * La descarga que se prueba es la REAL (`gml/descargar.js#descargarTexto`): un doble
 * de la entrega dejaría sin comprobar justo lo que hay que comprobar, que del botón
 * salen bytes y no un fichero vacío.
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
    descargar: (texto, opciones) => descargarTexto(texto, { ...opciones, documento, url }),
    /** El último Blob entregado, decodificado. */
    async ultimoTexto() {
      if (creados.length === 0) return null
      return creados[creados.length - 1].blob.text()
    },
  }
}

/** Caché de verdad, en memoria: cumple el puerto `CacheCatastro` y nada más. */
function crearCacheEnMemoria() {
  const almacen = new Map()
  return {
    leer: async (clave) => almacen.get(clave) ?? null,
    guardar: async (clave, valor, meta) => {
      almacen.set(clave, { valor, guardadoEn: meta.guardadoEn })
    },
  }
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
})

/**
 * Store + panel + cajón y contraste REALES sobre un `L.Map` real + cableado.
 *
 * @param {object} [opciones]
 * @param {object|null} [opciones.parcelaInicial=null]
 * @param {object|null|undefined} [opciones.catastro]  `undefined` ⇒ doble ligero;
 *   `null` ⇒ sin cliente (el caso legítimo de un visor suelto).
 * @param {() => (object|null)} [opciones.comprobacion]  De dónde sale la
 *   `Comprobacion` del informe. El defecto —`() => null`— es LA VÍA DE F05: quien
 *   llegó por referencia catastral no tiene fichero que comprobar.
 * @param {() => Date} [opciones.ahora]  El reloj del informe, fijo por defecto.
 */
function montar({
  parcelaInicial = null,
  catastro = crearCatastroDoble(),
  comprobacion = () => null,
  ahora = () => FECHA_INFORME,
  entrega = crearEntregaEspia(),
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
  const cableado = cablearDiagnostico({
    estado,
    cajon,
    contraste,
    panel,
    catastro,
    comprobacion,
    ahora,
    descargar: entrega.descargar,
  })

  pendientes.push(() => {
    cableado.destruir()
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
    contraste,
    cableado,
    catastro,
    entrega,
    raizCajon,
    boton: document.querySelector(SELECTOR_BOTON_DIAGNOSTICAR),
    renglon: document.querySelector(SELECTOR_ESTADO_DIAGNOSTICO),
    botonInforme: raizCajon.querySelector(SELECTOR_CAJON.DESCARGAR),
    renglonInforme: raizCajon.querySelector(SELECTOR_CAJON.ESTADO_INFORME),
  }
}

/**
 * Las capas que el contraste ha puesto en el mapa. Se filtran POR PANE —el
 * contraste dibuja polígonos y polilíneas, igual que la capa de edición, y el pane
 * es lo que las distingue de verdad—, **excluyendo el RENDERIZADOR**.
 *
 * Lo segundo hay que saberlo o los conteos mienten: en cuanto se dibuja el primer
 * trazo en un pane, Leaflet crea un `L.SVG` PARA ESE PANE y lo añade al mapa como
 * una capa más — con `options.pane === 'diagnostico'`, así que el filtro por pane
 * lo recoge—. No lo pone el contraste, no lo quita `limpiar()` y no debe quitarlo:
 * es del mapa. Sin esta exclusión, «el mapa quedó limpio» sería imposible de
 * afirmar. Es la misma trampa que documenta `test/viewer/contraste.dom.test.js`.
 */
function capasDeDiagnostico(mapa) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Renderer) return
    if (capa.options && capa.options.pane === PANE.DIAGNOSTICO) out.push(capa)
  })
  return out
}

/** El texto de una sección del cajón. */
const textoDe = (raiz, selector) => raiz.querySelector(selector).textContent

/** Cede el turno al bucle de microtareas unas cuantas veces. */
async function cederTurno(veces = 30) {
  for (let vuelta = 0; vuelta < veces; vuelta += 1) await Promise.resolve()
}

// ── 1 · Contrato con `index.html` ────────────────────────────────────────────

describe('cableado-diagnostico · el marcado de index.html es CONTRATO', () => {
  it('lanza nombrando el selector que falte, en vez de morir cien líneas después', () => {
    document.querySelector(SELECTOR_BOTON_DIAGNOSTICAR).remove()
    expect(() => montar()).toThrow(/data-accion="diagnosticar"/)
  })

  it('la guarda NO es vacua: index.html trae los dos nodos, y el CTA NACE apagado', () => {
    // Sin esta comprobación, la de arriba pasaría igual con un `index.html` que
    // hubiera perdido los dos nodos.
    const boton = document.querySelector(SELECTOR_BOTON_DIAGNOSTICAR)
    const renglon = document.querySelector(SELECTOR_ESTADO_DIAGNOSTICO)
    expect(boton).not.toBeNull()
    expect(renglon).not.toBeNull()
    expect(boton.disabled).toBe(true)
    expect(renglon.getAttribute('role')).toBe('status')
  })

  it('el renglón del CTA y el del CAJÓN son DOS nodos distintos', () => {
    // La trampa que `index.html` documenta desde F06: `querySelector` se queda con
    // el PRIMERO del documento y el `<aside>` va antes que el `<main>`. Si los dos
    // llevaran el mismo `data-estado`, el del cajón quedaría inalcanzable y mudo.
    const { raizCajon, renglon } = montar()
    const delCajon = raizCajon.querySelector(SELECTOR_CAJON.ESTADO)
    expect(delCajon).not.toBeNull()
    expect(delCajon).not.toBe(renglon)
    expect(document.querySelectorAll(SELECTOR_ESTADO_DIAGNOSTICO)).toHaveLength(1)
  })
})

// ── 2 · El CTA: encendido ⟺ hay contorno oficial ─────────────────────────────

describe('cableado-diagnostico · el CTA y su motivo', () => {
  it('sin parcela nace apagado Y con el motivo escrito: nunca gris y mudo', () => {
    const { boton, renglon } = montar()
    expect(boton.disabled).toBe(true)
    expect(renglon.textContent).toBe(MOTIVO_SIN_OFICIAL)
  })

  it('con una parcela SIN contorno oficial sigue apagado, con el mismo motivo', () => {
    // El caso que la redacción del motivo tiene que cubrir: hay parcela, hay
    // geometría, y aun así no vale — es un DXF, no trae contra qué contrastar.
    const { boton, renglon, estado } = montar()
    estado.set(parcelaSinOficial())
    expect(boton.disabled).toBe(true)
    expect(renglon.textContent).toContain('contorno OFICIAL')
  })

  it('con contorno oficial se enciende, y el motivo se borra del renglón', () => {
    const { boton, renglon, estado } = montar()
    expect(renglon.textContent).toBe(MOTIVO_SIN_OFICIAL)

    estado.set(parcelaDelCatastro())

    expect(boton.disabled).toBe(false)
    // Y el motivo se va, porque quien lo borra es la rama de «ha entrado una parcela
    // distinta»: un motivo que ya no se cumple es peor que un renglón vacío. Que se
    // borre por esa vía y no por una línea suelta en `refrescarBoton` es lo que
    // impide que se borre TAMBIÉN en cada vértice que se mueva.
    expect(renglon.textContent).toBe('')
  })

  it('se enciende ya en el montaje si la parcela estaba cargada de antes', () => {
    // `subscribe` no notifica al suscribirse: sin el `refrescarBoton` a mano del
    // final del cableado, el CTA se quedaría gris hasta el primer cambio del store.
    const { boton } = montar({ parcelaInicial: parcelaDelCatastro() })
    expect(boton.disabled).toBe(false)
  })
})

// ── 3 · Abrir: las dos vistas, y en este orden ───────────────────────────────

describe('cableado-diagnostico · abrir pinta las DOS vistas', () => {
  it('pulsar abre el cajón, escribe las cifras y mancha el mapa', async () => {
    const { boton, cajon, raizCajon, mapa, estado } = montar({
      parcelaInicial: parcelaDelCatastro(),
    })
    expect(cajon.abierto()).toBe(false)

    boton.click()
    await cederTurno()

    expect(cajon.abierto()).toBe(true)
    // La cifra medida sale del fixture real, no de un literal: se DERIVA por el
    // mismo camino que la app.
    expect(textoDe(raizCajon, SELECTOR_CAJON.TITULAR)).toContain('Contraste con el parcelario')
    expect(textoDe(raizCajon, SELECTOR_CAJON.CATASTRAL)).not.toBe('No consta')
    expect(capasDeDiagnostico(mapa).length).toBeGreaterThan(0)
    expect(estado.get()).toBe(estado.get()) // el diagnóstico no toca el modelo
  })

  it('el cajón se pinta ANTES de que lleguen las vecinas', () => {
    // La decisión del orden: las ocho medidas que no dependen de la red se ven al
    // instante, y la invasión aparece cuando llega. Sin ceder el turno, la petición
    // ni siquiera se ha resuelto.
    const { boton, raizCajon } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()

    expect(textoDe(raizCajon, SELECTOR_CAJON.TITULAR)).toContain('Contraste con el parcelario')
    expect(textoDe(raizCajon, SELECTOR_CAJON.INVASION)).toContain('no se ha consultado')
  })

  it('con el cajón CERRADO no se calcula nada: medir para no enseñarlo no es gratis', () => {
    const { estado } = montar({ parcelaInicial: parcelaDelCatastro() })
    estado.set(parcelaEditada())
    expect(vi.mocked(diagnosticar)).not.toHaveBeenCalled()
  })

  it('cerrar el cajón limpia el mapa: una anotación sin su explicación no se deja', async () => {
    const { boton, cajon, mapa } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()
    expect(capasDeDiagnostico(mapa).length).toBeGreaterThan(0)

    cajon.cerrar()
    expect(capasDeDiagnostico(mapa)).toHaveLength(0)
  })

  it('con el CTA apagado, pulsar no abre nada (y lo dice)', () => {
    const { boton, cajon, renglon } = montar()
    // El `disabled` es cortesía; la garantía es la comprobación de dentro. Se
    // llama al manejador saltándose el atributo, que es lo que haría un atajo de
    // teclado o el inspector.
    boton.disabled = false
    boton.click()

    expect(cajon.abierto()).toBe(false)
    expect(renglon.textContent).toBe(MOTIVO_SIN_OFICIAL)
  })
})

// ── 4 · Las colindantes: UNA petición por apertura ───────────────────────────

describe('cableado-diagnostico · las colindantes', () => {
  it('la primera apertura pide vecinas UNA vez; la segunda no vuelve a pedirlas', async () => {
    // Override O8: una pulsación, una petición. La segunda apertura ya las tiene.
    const { boton, cajon, catastro } = montar({ parcelaInicial: parcelaDelCatastro() })

    boton.click()
    await cederTurno()
    expect(catastro.llamadas).toBe(1)

    cajon.cerrar()
    boton.click()
    await cederTurno()
    expect(catastro.llamadas).toBe(1)
  })

  it('una vez llegan, la invasión se recalcula y se dice', async () => {
    const { boton, raizCajon } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    expect(textoDe(raizCajon, SELECTOR_CAJON.INVASION)).toContain('no se ha consultado')

    await cederTurno()

    // La parcela oficial contra sus colindantes oficiales: ninguna invasión. Lo que
    // importa es que ya NO dice «no se ha consultado» — son afirmaciones opuestas.
    expect(textoDe(raizCajon, SELECTOR_CAJON.INVASION)).not.toContain('no se ha consultado')
    expect(textoDe(raizCajon, SELECTOR_CAJON.INVASION)).toContain('ninguna')
  })

  it('las vecinas que trae el botón de F05 se ADOPTAN sin pedirlas otra vez', async () => {
    // Quien ya las trajo no tiene que traerlas dos veces: el cableado se suscribe a
    // `alColindantes`, que es el mismo canal que usa el snap de F06.
    const { boton, cajon, catastro, raizCajon } = montar({
      parcelaInicial: parcelaDelCatastro(),
    })
    await catastro.colindantes() // como si el usuario hubiera pulsado «Traer colindantes»
    expect(catastro.llamadas).toBe(1)

    boton.click()
    await cederTurno()

    expect(catastro.llamadas).toBe(1)
    expect(cajon.abierto()).toBe(true)
    expect(textoDe(raizCajon, SELECTOR_CAJON.INVASION)).not.toContain('no se ha consultado')
  })

  it('si la consulta FALLA, el diagnóstico se pinta igual y se dice qué falta', async () => {
    // La regla que este módulo defiende: un fallo de red no puede tumbar las ocho
    // medidas que no dependen de la red.
    const { boton, raizCajon, renglon } = montar({
      parcelaInicial: parcelaDelCatastro(),
      catastro: crearCatastroDoble({ parcelas: null }),
    })

    boton.click()
    await cederTurno()

    expect(textoDe(raizCajon, SELECTOR_CAJON.TITULAR)).toContain('Contraste con el parcelario')
    expect(textoDe(raizCajon, SELECTOR_CAJON.CATASTRAL)).not.toBe('No consta')
    // ⛔ NUNCA «ninguna invasión»: no se ha podido mirar.
    expect(textoDe(raizCajon, SELECTOR_CAJON.INVASION)).toContain('no se ha consultado')
    expect(renglon.textContent).toBe(COLA_SIN_VECINAS)
    expect(renglon.classList.contains('gml-accion-estado--error')).toBe(true)
  })

  it('sin cliente del Catastro se DICE, y las otras ocho medidas siguen ahí', async () => {
    const { boton, raizCajon, renglon } = montar({
      parcelaInicial: parcelaDelCatastro(),
      catastro: null,
    })

    boton.click()
    await cederTurno()

    expect(renglon.textContent).toBe(MOTIVO_SIN_CATASTRO)
    expect(renglon.classList.contains('gml-accion-estado--error')).toBe(false)
    expect(textoDe(raizCajon, SELECTOR_CAJON.CATASTRAL)).not.toBe('No consta')
  })
})

// ── 5 · Override O15, por el camino REAL ─────────────────────────────────────

describe('cableado-diagnostico · la parcela propia NO se cuela entre las colindantes (O15)', () => {
  it('el diagnóstico no la encuentra invadiéndose a sí misma', async () => {
    // `GetNeighbourParcel` devuelve la parcela pedida DENTRO de la respuesta, en
    // 2.ª posición (medido, override O15). Quien la separa es
    // `services/catastro.js#parcelaYColindantes`; este test lo afirma de extremo a
    // extremo porque la consecuencia de que se colara sería grotesca y silenciosa:
    // la parcela apareceria invadiendo a «su vecina» en el 100 % de su superficie.
    const transporte = crearTransporteDoble()
    const cliente = crearClienteCatastro({
      transporte,
      cache: crearCacheEnMemoria(),
      srs: SRS,
      ahora: () => Date.UTC(2026, 6, 29),
    })
    const { mapa, destruir: destruirMapa } = montarMapa({ zoom: 19 })
    crearPanes(mapa)
    const estado = crearEstadoVista(parcelaDelCatastro())
    const panel = crearPanelAvisos({
      contenedor: document.getElementById('avisos'),
      chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
      chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
    })
    const catastro = cablearCatastro({ estado, panel, cliente, srs: SRS })
    const cajon = crearCajonDiagnostico({ mapa })
    const contraste = crearContraste({ mapa, zona: HUSO })
    const cableado = cablearDiagnostico({ estado, cajon, contraste, panel, catastro })
    pendientes.push(() => {
      cableado.destruir()
      catastro.destruir()
      contraste.destruir()
      cajon.destruir()
      destruirMapa()
    })

    // La guarda NO es vacua: el fixture SÍ trae la propia dentro, y en 2.ª posición.
    expect(VECINDAD_FIXTURE).toHaveLength(5)
    expect(VECINDAD_FIXTURE[1].refcat).toBe(REFCAT)

    document.querySelector(SELECTOR_BOTON_DIAGNOSTICAR).click()
    await cederTurno(80)

    const invasion = cajon.control.getContainer().querySelector(SELECTOR_CAJON.INVASION).textContent
    expect(invasion).not.toContain('no se ha consultado')
    expect(invasion).not.toContain(REFCAT)
    expect(invasion).toContain('ninguna')
  })
})

// ── 6 · El estado del expediente ─────────────────────────────────────────────

describe('cableado-diagnostico · el expediente sobrevive a las ediciones', () => {
  it('la superficie registral tecleada se conserva al mover un vértice', async () => {
    const { boton, estado, raizCajon, cajon } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()

    raizCajon.querySelector(SELECTOR_CAJON.REGISTRAL).value = '1500'
    raizCajon
      .querySelector(SELECTOR_CAJON.REGISTRAL)
      .dispatchEvent(new Event('change', { bubbles: true }))
    expect(cajon.registral()).toBe(1500)

    estado.set(parcelaEditada())

    // Mover un vértice no cambia lo que dice la escritura.
    expect(cajon.registral()).toBe(1500)
    expect(textoDe(raizCajon, SELECTOR_CAJON.CRUCES)).toContain('Registro')
  })

  it('teclear la registral RECALCULA (es el segundo canal, junto al store)', async () => {
    const { boton, raizCajon } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()
    const antes = vi.mocked(diagnosticar).mock.calls.length

    raizCajon.querySelector(SELECTOR_CAJON.REGISTRAL).value = '1500'
    raizCajon
      .querySelector(SELECTOR_CAJON.REGISTRAL)
      .dispatchEvent(new Event('change', { bubbles: true }))

    expect(vi.mocked(diagnosticar).mock.calls.length).toBeGreaterThan(antes)
    expect(vi.mocked(diagnosticar).mock.lastCall[0].superficieRegistral).toBe(1500)
  })

  it('una parcela DISTINTA cierra el cajón, reinicia el expediente y tira las vecinas', async () => {
    const { boton, estado, cajon, mapa, raizCajon, catastro } = montar({
      parcelaInicial: parcelaDelCatastro(),
    })
    boton.click()
    await cederTurno()
    raizCajon.querySelector(SELECTOR_CAJON.REGISTRAL).value = '1500'
    raizCajon.querySelector(SELECTOR_CAJON.CLASE_PARCELA).value = 'URBANA'
    expect(catastro.llamadas).toBe(1)

    estado.set(otraParcela())

    expect(cajon.abierto()).toBe(false)
    expect(cajon.registral()).toBeNull()
    expect(cajon.clase()).toBeNull()
    expect(capasDeDiagnostico(mapa)).toHaveLength(0)

    // Y las vecinas de la anterior se han tirado: la siguiente apertura vuelve a
    // preguntar, con el gesto del usuario por delante (override O8).
    boton.click()
    await cederTurno()
    expect(catastro.llamadas).toBe(2)
  })

  it('la MISMA parcela editada no reinicia nada: la clave es refcat, no la identidad', () => {
    const { estado, cajon, boton } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    cajon.control._registral.value = '1500'

    // `edit/` reconstruye el POJO en cada operación: si la clave fuera la identidad
    // del objeto, cada arrastre borraría la superficie de la escritura.
    estado.set(parcelaEditada())

    expect(cajon.abierto()).toBe(true)
    expect(cajon.registral()).toBe(1500)
  })
})

// ── 7 · La cadencia del recálculo ────────────────────────────────────────────

describe('cableado-diagnostico · una vez por operación, nunca por frame', () => {
  it('cada `estado.set` produce EXACTAMENTE un diagnóstico', async () => {
    const { boton, estado } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()
    vi.mocked(diagnosticar).mockClear()

    estado.set(parcelaEditada())
    expect(vi.mocked(diagnosticar)).toHaveBeenCalledTimes(1)

    estado.set(parcelaDelCatastro())
    expect(vi.mocked(diagnosticar)).toHaveBeenCalledTimes(2)
  })

  it('lo que se le pasa a `diagnosticar` sale del store y de los dos campos', async () => {
    const { boton, estado } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()

    const entrada = vi.mocked(diagnosticar).mock.lastCall[0]
    const parcelaActual = estado.get()
    expect(entrada.recintos).toBe(parcelaActual.recintos)
    expect(entrada.geometriaOficial).toBe(parcelaActual.geometriaOficial)
    expect(entrada.superficieCatastral).toBe(PARCELA_FIXTURE.areaValue)
    expect(entrada.refcat).toBe(REFCAT)
    expect(entrada.superficieRegistral).toBeNull()
    expect(entrada.clase).toBeNull()
    // `vecinas` es un ARRAY, no `null`: ya han llegado (y `[]` significaría «se
    // consultó y no hay», que es otra cosa).
    expect(Array.isArray(entrada.vecinas)).toBe(true)
    expect(entrada.vecinas.length).toBeGreaterThan(0)
    for (const vecina of entrada.vecinas) {
      expect(Object.keys(vecina).sort()).toEqual(['recintos', 'refcat'])
    }
  })
})

// ── 8 · Fallos y desmontaje ──────────────────────────────────────────────────

describe('cableado-diagnostico · un fallo del cálculo no tumba a los demás', () => {
  it('lo cuenta por el panel y por el cajón, y NO deja subir la excepción', async () => {
    const { boton, estado, raizCajon } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()

    vi.mocked(diagnosticar).mockImplementationOnce(() => {
      throw new Error('un contrato roto de una capa de abajo')
    })
    const enConsola = vi.spyOn(console, 'error').mockImplementation(() => {})

    // El camino real: esto se alcanza desde un suscriptor del store, y dejar
    // reventar ahí tumbaría también a los otros suscriptores (la ficha del pie).
    expect(() => estado.set(parcelaEditada())).not.toThrow()

    expect(textoDe(raizCajon, SELECTOR_CAJON.ESTADO)).toContain('ha fallado')
    expect(
      [...document.querySelectorAll('#avisos .gml-aviso-texto')].map((t) => t.textContent),
    ).toContain(MENSAJE_FALLO_INESPERADO)
    expect(enConsola).toHaveBeenCalled()
    enConsola.mockRestore()
  })
})

describe('cableado-diagnostico · destruir', () => {
  it('deja el CTA inerte, limpia el mapa y es IDEMPOTENTE', async () => {
    const { boton, cableado, mapa, estado } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()
    expect(capasDeDiagnostico(mapa).length).toBeGreaterThan(0)

    cableado.destruir()

    expect(capasDeDiagnostico(mapa)).toHaveLength(0)
    vi.mocked(diagnosticar).mockClear()
    boton.click()
    estado.set(parcelaEditada())
    expect(vi.mocked(diagnosticar)).not.toHaveBeenCalled()

    expect(() => cableado.destruir()).not.toThrow()
  })

  it('NO destruye el cajón ni el contraste: son del visor', () => {
    // Cada módulo desmonta lo que ha montado él, ni más ni menos. Si este se
    // llevara por delante el cajón, `visor.destruir()` se encontraría un control
    // ya retirado y el orden de desmontaje del visor dejaría de ser el documentado.
    const { cableado, cajon, raizCajon } = montar({ parcelaInicial: parcelaDelCatastro() })
    cableado.destruir()

    expect(raizCajon.isConnected).toBe(true)
    expect(() => cajon.abrir()).not.toThrow()
    expect(cajon.abierto()).toBe(true)
  })
})

// ── 9 · El informe de contraste (F08 · T4.2) ─────────────────────────────────
//
// El botón vive DENTRO del cajón —razonado en `viewer/cajon-diagnostico.js`— y este
// cableado es quien compone el texto (`report/contraste-texto.js`) y lo entrega
// (`gml/descargar.js#descargarTexto`). Lo que se prueba aquí es el CABLE: que el
// botón nunca esté gris y mudo, que de él salgan BYTES y no un fichero vacío, que el
// nombre no pise al del GML, y que la vía de la referencia catastral —`comprobacion:
// null`— funcione exactamente igual que la del fichero.

const pulsar = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true }))

describe('cableado-diagnostico · el informe de contraste: el gate del botón', () => {
  it('nace APAGADO y con el motivo escrito: nunca gris y mudo (regla de oro 1)', () => {
    const { botonInforme, renglonInforme } = montar({ parcelaInicial: parcelaDelCatastro() })
    expect(botonInforme.disabled).toBe(true)
    expect(renglonInforme.textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
  })

  it('se enciende cuando hay diagnóstico calculado, y el motivo se va', async () => {
    const { boton, botonInforme, renglonInforme } = montar({
      parcelaInicial: parcelaDelCatastro(),
    })
    boton.click()
    await cederTurno()

    expect(botonInforme.disabled).toBe(false)
    expect(renglonInforme.textContent).toBe('')
  })

  it('con el botón apagado, pulsar NO descarga nada (y el motivo sigue a la vista)', () => {
    // El `disabled` es cortesía; la garantía es la comprobación de dentro. Se llama
    // al manejador saltándose el atributo, que es lo que haría un atajo de teclado o
    // el inspector. Mismo criterio que el CTA del pie.
    const { botonInforme, renglonInforme, entrega } = montar({
      parcelaInicial: parcelaDelCatastro(),
    })
    botonInforme.disabled = false
    pulsar(botonInforme)

    expect(entrega.creados).toHaveLength(0)
    expect(renglonInforme.textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
  })

  it('una parcela DISTINTA lo apaga: no se baja el informe de la que ya no está', async () => {
    // El fallo más caro que este pie podría cometer, y sería silencioso: el cajón se
    // cierra al entrar otra parcela, así que `recalcular()` sale por arriba y no
    // repinta. Sin olvidar el diagnóstico anterior, el botón se quedaría encendido y
    // el fichero que bajara hablaría de la parcela anterior — con SU referencia
    // catastral en el nombre.
    const { boton, estado, botonInforme, renglonInforme, entrega } = montar({
      parcelaInicial: parcelaDelCatastro(),
    })
    boton.click()
    await cederTurno()
    expect(botonInforme.disabled).toBe(false)

    estado.set(otraParcela())

    expect(botonInforme.disabled).toBe(true)
    expect(renglonInforme.textContent).toBe(MOTIVO_INFORME_SIN_DIAGNOSTICO)
    botonInforme.disabled = false
    pulsar(botonInforme)
    expect(entrega.creados).toHaveLength(0)
  })

  it('un fallo del CÁLCULO también lo apaga: no se ofrece un informe de cifras muertas', async () => {
    const { boton, estado, botonInforme } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()
    expect(botonInforme.disabled).toBe(false)

    vi.mocked(diagnosticar).mockImplementationOnce(() => {
      throw new Error('un contrato roto de una capa de abajo')
    })
    const enConsola = vi.spyOn(console, 'error').mockImplementation(() => {})
    estado.set(parcelaEditada())
    enConsola.mockRestore()

    expect(botonInforme.disabled).toBe(true)
  })

  it('⚠️ M8 · `informe-contraste` es ÚNICO en TODO el documento (cáscara incluida)', () => {
    // La lección M8 de F07: `querySelector` se queda con el PRIMERO del documento y
    // el `<aside>` de `index.html` va antes que el `<main>` donde vive el mapa. Dos
    // nodos con el mismo `data-estado` dejarían a uno mudo y SIN SÍNTOMA. Aquí se
    // mide sobre el documento entero —la cáscara real más el cajón montado—, que es
    // el único sitio donde la colisión podría existir de verdad.
    montar({ parcelaInicial: parcelaDelCatastro() })

    expect(document.querySelectorAll(SELECTOR_CAJON.ESTADO_INFORME)).toHaveLength(1)
    expect(document.querySelectorAll(SELECTOR_CAJON.DESCARGAR)).toHaveLength(1)
    // Anti-vacuidad: la cáscara SÍ trae otros `data-estado`, así que el recuento no
    // está saliendo de un documento vacío.
    const estados = [...document.querySelectorAll('[data-estado]')].map((el) => el.dataset.estado)
    expect(estados.length).toBeGreaterThan(3)
    expect(estados.filter((v) => v === 'informe-contraste')).toHaveLength(1)
    // Y el valor del renglón no es el de NINGUNA acción del documento: cruzar los dos
    // espacios de nombres es exactamente lo que costó M8.
    const acciones = [...document.querySelectorAll('[data-accion]')].map((el) => el.dataset.accion)
    expect(acciones).toContain('descargar-informe')
    expect(acciones).not.toContain('informe-contraste')
    expect(estados).not.toContain('descargar-informe')
    // ⚠️ Y NO se exige que estado y acción sean disjuntos en todo el documento: en el
    // PIE de la app la convención es justo la contraria (`cargar-catastro`/
    // `cargar-catastro`, `generar-gml`/`generar-gml`) y ahí es correcta, porque hay
    // un nodo de cada. La regla que aquí se afirma es la de DENTRO DEL MAPA, donde
    // los renglones conviven con los del `<aside>`: se nombran por el componente.
    expect(estados).toContain('cargar-catastro')
    expect(acciones).toContain('cargar-catastro')
  })
})

describe('cableado-diagnostico · el informe de contraste: bytes de verdad', () => {
  it('pulsar produce BYTES (no un fichero vacío) con el nombre y el MIME esperados', async () => {
    const { boton, botonInforme, renglonInforme, entrega } = montar({
      parcelaInicial: parcelaDelCatastro(),
    })
    boton.click()
    await cederTurno()

    pulsar(botonInforme)

    // (a) Se entregó UN fichero, y sus bytes son los del texto en UTF-8. Comprobar el
    // `charset` del MIME sería comprobar la ETIQUETA; aquí se decodifica el Blob.
    expect(entrega.creados).toHaveLength(1)
    const { blob } = entrega.creados[0]
    const texto = await blob.text()
    const buffer = await blob.arrayBuffer()
    // Como arrays normales y no como vistas tipadas: el buffer sale del Blob del
    // entorno jsdom y el esperado del `TextEncoder` de Node, y `toEqual` sobre dos
    // vistas de REALMS distintos falla aunque los bytes coincidan (medido en
    // `test/gml/descargar.dom.test.js`).
    expect(buffer.byteLength).toBeGreaterThan(0)
    expect(Array.from(new Uint8Array(buffer))).toEqual(
      Array.from(new TextEncoder().encode(texto)),
    )
    // El informe lleva `m²`, acentos y `ñ`: hay carga multibyte de verdad, así que
    // la comprobación de bytes no es vacua.
    expect(buffer.byteLength).toBeGreaterThan(texto.length)
    expect(blob.type).toBe(TIPO_MIME_TEXTO)

    // (b) Y no es un fichero vacío disfrazado: trae el informe entero, con el nombre
    // LEGAL (jamás «validación gráfica») y las cifras de la parcela real.
    expect(texto.length).toBeGreaterThan(1000)
    expect(texto).toContain('INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL')
    expect(texto).toContain(REFCAT)
    expect(texto).toContain('30/07/2026 11:45 (UTC)')

    // (c) El nombre del fichero, derivado del de `nombreFicheroGml`.
    expect(entrega.anclas).toHaveLength(1)
    expect(entrega.anclas[0].download).toBe(
      nombreFicheroInforme({ refcat: REFCAT, fecha: FECHA_INFORME }),
    )
    expect(entrega.anclas[0].download).toBe(`contraste_${REFCAT}_2026-07-30T11-45-30.txt`)

    // (d) El desenlace se DICE, y no queda basura: el objeto-URL se revoca.
    expect(renglonInforme.textContent).toBe(`Descargado «${entrega.anclas[0].download}».`)
    expect(entrega.revocados).toEqual([entrega.creados[0].href])
  })

  it('con `comprobacion: null` —la vía de la REFERENCIA CATASTRAL— baja igual', async () => {
    // Es la razón de que el botón viva en el cajón y no en el pie de la comprobación:
    // sirve a las DOS vías sin ramificar la interfaz. Quien llegó por RC no tiene
    // fichero, y su informe se emite sin la sección «Qué se leyó del fichero».
    const { boton, botonInforme, entrega } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()

    pulsar(botonInforme)

    const texto = await entrega.ultimoTexto()
    expect(texto).toContain('INFORME DE CONTRASTE CON EL PARCELARIO CATASTRAL')
    expect(texto).not.toContain('QUÉ SE LEYÓ DEL FICHERO')
  })

  it('con la comprobación de un GML aportado, el informe añade la sección del fichero', async () => {
    // La MISMA interfaz, con la comprobación REAL de `comprobacion/gml.js` sobre el
    // fichero real. Un doble aquí no demostraría nada: lo que se afirma es que el
    // cableado pasa lo que hay cuando lo hay.
    const NOMBRE = 'cp_parcela_9398516VK3799G.gml'
    const { boton, botonInforme, entrega } = montar({
      parcelaInicial: parcelaDelCatastro(),
      comprobacion: () => comprobarGml({ texto: TEXTO_PARCELA, nombreFichero: NOMBRE }),
    })
    boton.click()
    await cederTurno()

    pulsar(botonInforme)

    const texto = await entrega.ultimoTexto()
    expect(texto).toContain('QUÉ SE LEYÓ DEL FICHERO')
    expect(texto).toContain(NOMBRE)
  })

  it('la fecha se INYECTA: el informe no consulta el reloj del sistema', async () => {
    // `report/contraste-texto.js` no lo consulta por contrato (hay un guardián con
    // grep sobre su fuente), y el nombre del fichero tampoco. El instante entra por
    // `ahora()`, igual que en `cablearCatastro` y en `cablearGeneracionGml`.
    const OTRO = new Date(Date.UTC(2019, 0, 2, 3, 4, 5))
    const { boton, botonInforme, entrega } = montar({
      parcelaInicial: parcelaDelCatastro(),
      ahora: () => OTRO,
    })
    boton.click()
    await cederTurno()

    pulsar(botonInforme)

    expect(entrega.anclas[0].download).toBe(`contraste_${REFCAT}_2019-01-02T03-04-05.txt`)
    expect(await entrega.ultimoTexto()).toContain('02/01/2019 03:04 (UTC)')
  })

  it('descargar dos veces produce dos ficheros y no duplica anclas colgadas del DOM', async () => {
    const { boton, botonInforme, entrega } = montar({ parcelaInicial: parcelaDelCatastro() })
    boton.click()
    await cederTurno()

    pulsar(botonInforme)
    pulsar(botonInforme)

    expect(entrega.creados).toHaveLength(2)
    expect(entrega.revocados).toHaveLength(2)
    for (const ancla of entrega.anclas) expect(ancla.isConnected).toBe(false)
  })
})

describe('cableado-diagnostico · el nombre del informe', () => {
  it('NO colisiona con el del GML de la misma parcela y el mismo instante', () => {
    const gml = nombreFicheroGml({ refcat: REFCAT, fecha: FECHA_INFORME })
    const informe = nombreFicheroInforme({ refcat: REFCAT, fecha: FECHA_INFORME })

    expect(informe).not.toBe(gml)
    expect(gml.endsWith(EXTENSION_GML)).toBe(true)
    expect(informe.endsWith(EXTENSION_INFORME)).toBe(true)
    expect(informe.startsWith(`${PREFIJO_INFORME}_`)).toBe(true)
    // Y la parte de en medio es la MISMA: es lo que permite emparejar el informe con
    // su GML de un vistazo en la carpeta de descargas, sin abrir ninguno.
    expect(informe.slice(PREFIJO_INFORME.length, -EXTENSION_INFORME.length)).toBe(
      gml.slice(PREFIJO_NOMBRE.length, -EXTENSION_GML.length),
    )
  })

  it('hereda el SANEADO de `nombreFicheroGml`: no hay una segunda lista blanca', () => {
    // La referencia la teclea o la pega el usuario. El saneador de `gml/descargar.js`
    // no está exportado, así que el nombre se DERIVA del suyo en vez de copiar
    // cuarenta líneas de lista blanca que se quedarían desincronizadas en verde.
    const SUCIA = '../CON:9398516VK3799G'
    const nombre = nombreFicheroInforme({ refcat: SUCIA, fecha: FECHA_INFORME })

    // Anti-vacuidad: la entrada SÍ traía todo lo que no puede sobrevivir.
    expect(SUCIA).toContain('..')
    expect(SUCIA).toMatch(/[/:]/)
    expect(nombre).not.toContain('..')
    expect(nombre).not.toMatch(/[/\\:*?"<>|]/)
    expect(nombre.endsWith(EXTENSION_INFORME)).toBe(true)
  })

  it('sin referencia sale la MISMA marca honesta que en el GML', () => {
    // No se inventa una referencia: es el caso real de un alta nueva y del `UTM_1.gml`
    // (donde la refcat medida es `''`, no `null` — F08 · T2.1).
    for (const refcat of [null, '', '   ']) {
      expect(nombreFicheroInforme({ refcat, fecha: FECHA_INFORME })).toBe(
        `contraste_sin-referencia_2026-07-30T11-45-30.txt`,
      )
    }
  })

  it('una parcela SIN refcat baja su informe con la marca, no con el `idLocal`', async () => {
    // `claveDeExpediente` mezcla `refcat` con `idLocal` y les pone prefijo: si el
    // nombre saliera de ahí, el fichero se llamaría `idLocal-de-un-dxf`.
    const { boton, botonInforme, entrega, estado } = montar()
    estado.set(
      crearParcela({
        idLocal: 'de-un-dxf',
        recintos: PARCELA_FIXTURE.recintos,
        geometriaOficial: PARCELA_FIXTURE.recintos,
        origen: ORIGEN_PARCELA.DXF,
      }),
    )
    boton.click()
    await cederTurno()

    pulsar(botonInforme)

    expect(entrega.anclas[0].download).toBe('contraste_sin-referencia_2026-07-30T11-45-30.txt')
    expect(entrega.anclas[0].download).not.toContain('de-un-dxf')
  })
})

describe('cableado-diagnostico · el informe cuando algo falla', () => {
  it('si el informe no se puede COMPONER se cuenta por el panel y por el renglón', async () => {
    // Una `comprobacion()` que devuelve algo que no es una Comprobacion ni `null` es
    // un contrato roto: `informeContrasteTexto` lanza. La excepción NO puede subir —
    // esto corre dentro de un oyente del DOM y una excepción lanzada ahí no sale por
    // `dispatchEvent` (medido en F08 · T3.2): el usuario vería que no pasa nada.
    const { boton, botonInforme, renglonInforme, entrega } = montar({
      parcelaInicial: parcelaDelCatastro(),
      comprobacion: () => 42,
    })
    boton.click()
    await cederTurno()
    const enConsola = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => pulsar(botonInforme)).not.toThrow()

    expect(entrega.creados).toHaveLength(0)
    expect(renglonInforme.textContent).toContain('no se ha podido componer')
    expect(
      [...document.querySelectorAll('#avisos .gml-aviso-texto')].map((t) => t.textContent),
    ).toContain(MENSAJE_INFORME_NO_COMPUESTO)
    expect(enConsola).toHaveBeenCalled()
    enConsola.mockRestore()
  })

  it('si el navegador no puede ENTREGARLO se dice con OTRO mensaje, y tampoco sube', async () => {
    // «Tu informe no se puede escribir» y «el informe está hecho pero no ha bajado»
    // llevan a acciones distintas. `descargarTexto` propaga lo que lance el `click()`
    // (una extensión que ha manipulado el DOM) DESPUÉS de limpiar.
    const fallo = new Error('una extensión ha roto el click')
    const entrega = crearEntregaEspia({
      alHacerClick: () => {
        throw fallo
      },
    })
    const { boton, botonInforme, renglonInforme } = montar({
      parcelaInicial: parcelaDelCatastro(),
      entrega,
    })
    boton.click()
    await cederTurno()
    const enConsola = vi.spyOn(console, 'error').mockImplementation(() => {})

    expect(() => pulsar(botonInforme)).not.toThrow()

    // La limpieza de `descargarTexto` se hizo IGUAL, antes de propagar: el anchor no
    // se ha quedado colgado del DOM y el objeto-URL está revocado.
    expect(entrega.anclas[0].isConnected).toBe(false)
    expect(entrega.revocados).toEqual([entrega.creados[0].href])
    expect(renglonInforme.textContent).toContain('no ha bajado')
    expect(
      [...document.querySelectorAll('#avisos .gml-aviso-texto')].map((t) => t.textContent),
    ).toContain(MENSAJE_INFORME_NO_ENTREGADO)
    expect(enConsola).toHaveBeenCalled()
    enConsola.mockRestore()
  })

  it('`destruir()` deja el botón del informe INERTE', async () => {
    const { boton, botonInforme, cableado, entrega } = montar({
      parcelaInicial: parcelaDelCatastro(),
    })
    boton.click()
    await cederTurno()

    cableado.destruir()
    pulsar(botonInforme)

    expect(entrega.creados).toHaveLength(0)
    // Y por la API tampoco: el cableado está muerto.
    expect(cableado.descargarInforme()).toBeNull()
  })
})

describe('cableado-diagnostico · contratos del programador', () => {
  it('rechaza lo que no es el store, el cajón, el contraste o el panel', () => {
    const { mapa } = montarMapa({ zoom: 19 })
    crearPanes(mapa)
    const cajon = crearCajonDiagnostico({ mapa })
    const contraste = crearContraste({ mapa, zona: HUSO })
    const panel = crearPanelAvisos({
      contenedor: document.getElementById('avisos'),
      chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
      chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
    })
    const estado = crearEstadoVista(null)
    const base = { estado, cajon, contraste, panel }

    expect(() => cablearDiagnostico({ ...base, estado: {} })).toThrow(TypeError)
    // El mensaje del cajón dice la causa MÁS PROBABLE, que es haber montado el
    // visor sin `diagnostico: true`.
    expect(() => cablearDiagnostico({ ...base, cajon: undefined })).toThrow(/diagnostico: true/)
    expect(() => cablearDiagnostico({ ...base, contraste: null })).toThrow(TypeError)
    expect(() => cablearDiagnostico({ ...base, panel: null })).toThrow(TypeError)
    expect(() => cablearDiagnostico({ ...base, catastro: 'sí' })).toThrow(TypeError)

    cajon.destruir()
    contraste.destruir()
  })

  it('rechaza `comprobacion`, `ahora` y `descargar` que no sean FUNCIONES', () => {
    // El error fácil aquí es pasar `comprobacion` como el OBJETO en vez de la función
    // que lo devuelve. Sin guarda se descubriría el día que alguien pulse el botón,
    // con un TypeError de dentro de este módulo y no del llamante que se equivocó.
    const { mapa } = montarMapa({ zoom: 19 })
    crearPanes(mapa)
    const cajon = crearCajonDiagnostico({ mapa })
    const contraste = crearContraste({ mapa, zona: HUSO })
    const panel = crearPanelAvisos({
      contenedor: document.getElementById('avisos'),
      chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
      chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
    })
    const base = { estado: crearEstadoVista(null), cajon, contraste, panel }

    expect(() => cablearDiagnostico({ ...base, comprobacion: {} })).toThrow(/comprobacion/)
    expect(() => cablearDiagnostico({ ...base, ahora: FECHA_INFORME })).toThrow(/ahora/)
    expect(() => cablearDiagnostico({ ...base, descargar: null })).toThrow(/descargar/)

    cajon.destruir()
    contraste.destruir()
  })

  it('exige del cajón las DOS piezas del pie del informe', () => {
    // Se comprueba lo que se USA. Un cajón sin `alDescargar`/`estadoInforme` dejaría
    // el botón montado y mudo, que es exactamente el fallo que este pie no admite.
    const { mapa } = montarMapa({ zoom: 19 })
    crearPanes(mapa)
    const cajon = crearCajonDiagnostico({ mapa })
    const contraste = crearContraste({ mapa, zona: HUSO })
    const panel = crearPanelAvisos({
      contenedor: document.getElementById('avisos'),
      chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
      chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
    })
    const base = { estado: crearEstadoVista(null), contraste, panel }

    for (const que of ['alDescargar', 'estadoInforme']) {
      const mutilado = { ...cajon, [que]: undefined }
      expect(() => cablearDiagnostico({ ...base, cajon: mutilado }), que).toThrow(TypeError)
    }
    // Anti-vacuidad: el cajón ENTERO sí se acepta.
    expect(() => cablearDiagnostico({ ...base, cajon }).destruir()).not.toThrow()

    cajon.destruir()
    contraste.destruir()
  })
})

/* -------------------------------------------------------------------------- *
 * test/app/main-edicion.dom.test.js — F06 · T5.1 · la edición, cableada        *
 *                                                                              *
 * `edit/` (historial, métricas, snap, offset, vértices) y `viewer/edicion.js`   *
 * están terminados y probados; mientras nadie los enchufe a la pantalla, toda   *
 * F06 es código muerto. El cableado de este fichero es lo que la convierte en   *
 * producto, y son los criterios de aceptación **4** (superficie / perímetro /   *
 * Δcatastral durante el arrastre) y **5** (undo/redo revierten operaciones      *
 * completas) los que se juegan aquí.                                            *
 *                                                                              *
 * ── QUÉ SE PRUEBA AQUÍ, Y QUÉ NO ──                                            *
 * NO se vuelven a probar el historial (`test/edit/historial.test.js`), las      *
 * métricas (`test/edit/metricas.test.js`), el offset, el snap ni la interacción *
 * del mapa (`test/viewer/edicion.dom.test.js`). Se prueba el CABLE: que la pila *
 * nazca SEMBRADA, que los botones y los atajos la sigan, que los atajos se      *
 * callen dentro de un campo de texto, que undo/redo NO ensucien la pila, que la *
 * ficha se repinte por el canal en vivo y por el del store con la MISMA         *
 * función, y que las colindantes lleguen APLANADAS a las dianas del enganche.   *
 *                                                                              *
 * ── DECISIÓN 1 · DOS NIVELES, Y LOS DOS HACEN FALTA ──                         *
 *   · **El ENSAMBLAJE real** — se importa `app/main.js` una vez, con la cáscara *
 *     de `index.html` ya montada, y se afirma sobre lo que quedó cableado. Es   *
 *     la única forma de comprobar cosas que no son de ninguna función sino del  *
 *     ORDEN del arranque: que el visor se monta con edición, que la pila que    *
 *     recibe está sembrada, y que el canal en vivo llega a la ficha.            *
 *     ⚠️ Los nodos del arranque se capturan ANTES de que ningún `beforeEach`    *
 *     remonte la cáscara. Siguen siendo los que `app/main.js` tiene en la mano  *
 *     —aunque queden fuera del documento— y un nodo desprendido conserva su     *
 *     `textContent`: por eso estas afirmaciones siguen valiendo después.        *
 *   · **`cablearEdicion` a pelo** — con su propio store, su propia pila y un    *
 *     doble de `visor.edicion`, para poder poner el sistema en estados que el   *
 *     arranque no alcanza (una pila con historia, un lado seleccionado, una     *
 *     consulta de colindantes que responde).                                    *
 *                                                                              *
 * ── DECISIÓN 2 · EL MARCADO SE LEE DE SU FUENTE, NO SE COPIA ──                *
 * Igual que en `main-gml.dom.test.js` y por lo mismo: el marcado es CONTRATO    *
 * (los `data-accion`, los `data-campo`, el `disabled` con el que nacen los      *
 * tres botones, el `20` en centímetros del campo de tolerancia). Una copia a    *
 * mano podría quedarse en verde con la fuente ya rota.                          *
 *                                                                              *
 * ⚠️ Desde el traslado de F06 esa fuente son DOS. La cáscara —el panel, la      *
 * ficha, el botón «Generar GML»— se lee del `<body>` de `index.html`; los       *
 * SIETE nodos de las herramientas de edición ya no están ahí: los fabrica       *
 * `viewer/barra-edicion.js` en una barra flotante sobre el mapa, y quien la     *
 * monta es `crearVisor`. Aquí se montan las dos, y en ese orden.                *
 *                                                                              *
 * ── DECISIÓN 3 · SE DOBLA `viewer/index.js`, Y NADA MÁS ──                     *
 * `crearVisor` monta un `L.Map` real, y nada de eso tiene que ver con cablear   *
 * un botón. El doble CAPTURA sus opciones —de ahí salen el store, la pila y el  *
 * canal `alPrevisualizar` del ensamblaje— y devuelve una `edicion` de mentira   *
 * que registra lo que le piden. Todo lo demás (el store, el panel, el           *
 * historial, las métricas) es REAL.                                             *
 *                                                                              *
 * ⚠️ Y desde el traslado, `crearVisor` tiene un SEGUNDO efecto sobre el         *
 * documento: monta la barra, o sea los siete nodos que `cablearEdicion` busca   *
 * por selector. El doble tiene que reproducirlo, o estaría doblando algo        *
 * distinto de lo que hace el original —y `cablearEdicion` lanzaría en el        *
 * `[data-accion="deshacer"]` que nadie habría creado—. Se reproduce llamando    *
 * a `crearBarraEdicion` DE VERDAD, sobre un `L.Map` del arnés compartido        *
 * (`test/viewer/_ayuda-jsdom.js#montarMapa`), y NO inyectando una copia del     *
 * marcado: una copia sería una segunda redacción de esos siete nodos, que se    *
 * desincroniza en silencio del módulo que los fabrica —este repo ya tiene esa   *
 * cicatriz en `viewer/_comun.js#validarVistaInicial`, un validador duplicado    *
 * que ya había divergido— y que además dejaría estas pruebas ciegas a un        *
 * cambio de contrato de la barra. Con la barra de verdad, si cambia, se         *
 * enteran aquí. Lo que la decisión 3 se sigue ahorrando es todo lo demás del    *
 * visor: capas, WMS, tabla, sincronización y encuadre.                          *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

import { crearPanelAvisos } from '../../app/avisos.js'
import { SRS_DEMO, parcelaDemo } from '../../app/demo-datos.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { commit, crearHistorial, puedeDeshacer, puedeRehacer } from '../../edit/historial.js'
import { metricas } from '../../edit/metricas.js'
import { crearParcela, crearRecinto, ORIGEN_PARCELA, TIPO_RECINTO } from '../../model/parcela.js'
import { NIVEL, crearEstadoVista } from '../../viewer/_comun.js'
import { crearBarraEdicion } from '../../viewer/barra-edicion.js'
import { montarMapa } from '../viewer/_ayuda-jsdom.js'

// ── La BARRA: el segundo efecto de `crearVisor` sobre el documento ───────────

/** Cómo desmontar la barra viva ahora mismo (y su mapa), o `null` si no hay. */
let desmontarBarraViva = null

/**
 * Pone en el documento los SIETE nodos de las herramientas de edición, con el
 * módulo que los fabrica en producción y no con una copia (decisión 3). Es lo
 * que `crearVisor` hace de verdad cuando la edición está activa, así que lo hace
 * también su doble; y hay que repetirlo en cada `beforeEach`, porque
 * {@link montarCascara} vacía el `<body>` y se lleva por delante el contenedor
 * del mapa, que es donde vive la barra.
 *
 * IDEMPOTENTE en el sentido que hace falta: desmonta la anterior antes de montar
 * la siguiente. Sin eso quedarían dos barras (o sea, los siete nodos por
 * duplicado, que es justo el fallo que G16 vigila en `index.html`) y una pila de
 * oyentes de `document` sobre barras ya muertas.
 */
function montarBarra() {
  desmontarBarra()
  const { mapa, destruir: destruirMapa } = montarMapa()
  const barra = crearBarraEdicion({ mapa })
  desmontarBarraViva = () => {
    barra.destruir()
    destruirMapa()
  }
}

/** Quita la barra viva y su mapa. No hace nada si no hay ninguna. */
function desmontarBarra() {
  if (desmontarBarraViva === null) return
  const desmontar = desmontarBarraViva
  desmontarBarraViva = null
  desmontar()
}

// ── El doble de `crearVisor`, que además es el sensor del ensamblaje ─────────

/**
 * `vi.mock` se IZA por encima de todo, así que su fábrica no puede leer un
 * `const` de este módulo (zona muerta). `vi.hoisted` es la vía oficial para
 * compartir un objeto con ella.
 */
const arranque = vi.hoisted(() => ({
  /** Opciones con las que `app/main.js` montó el visor. */
  opciones: null,
  /** Opciones con las que `app/main.js` cableó el Catastro. */
  catastro: null,
  /** El oyente de colindantes que `app/main.js` registró en el cableado. */
  alColindantes: null,
  /** Lo que se le ha pedido al doble de `visor.edicion`. */
  registro: {
    snapActivo: [],
    tolerancia: [],
    colindantes: [],
    desplazamientos: [],
  },
}))

vi.mock('../../viewer/index.js', () => ({
  crearVisor: (_contenedor, opciones) => {
    arranque.opciones = opciones
    // El segundo efecto del original sobre el documento: si el doble no lo
    // reprodujera, `cablearEdicion` lanzaría al buscar `[data-accion="deshacer"]`
    // y este fichero no recolectaría ni un test. Ver la decisión 3.
    montarBarra()
    let tau = opciones.edicion && opciones.edicion.tolerancia
    return {
      mapa: { on() {}, off() {} },
      estado: opciones.estado,
      capas: {},
      acotaciones: null,
      edicion: {
        snapActivo(valor) {
          if (valor !== undefined) arranque.registro.snapActivo.push(valor)
          return true
        },
        tolerancia(metros) {
          if (metros !== undefined) {
            arranque.registro.tolerancia.push(metros)
            tau = metros
          }
          return tau
        },
        ladoSeleccionado: () => null,
        alCambiarSeleccion: () => () => {},
        fijarColindantes(recintos) {
          arranque.registro.colindantes.push(recintos)
        },
        desplazarSeleccion(distancia) {
          arranque.registro.desplazamientos.push(distancia)
          return { aplicado: false, modo: null, detecciones: [] }
        },
      },
      destruir() {},
    }
  },
}))

// ── El doble de `cablearCatastro`, que es el otro extremo del cable ──────────
//
// Se dobla SOLO la función de cableado (sus selectores y el resto del módulo se
// dejan pasar con `importOriginal`, porque `app/main.js` los usa en su `catch`).
// Doblarlo aquí compra dos cosas que el módulo real no puede dar:
//   · llegar a los DOS GANCHOS de F06 (`alCargarParcela` y el oyente de
//     colindantes) sin una consulta real al WFS, y
//   · ejercitar el PUENTE del arranque —`if (typeof catastro.alColindantes ===
//     'function')`— con un cableado que sí lo publica.
// El cableado de verdad tiene su propia suite (`test/app/catastro.dom.test.js`)
// y además se ejercita entero en `main-gml.dom.test.js`, que no lo dobla.
vi.mock('../../app/cableado-catastro.js', async (importOriginal) => {
  const original = await importOriginal()
  return {
    ...original,
    cablearCatastro: (opciones) => {
      arranque.catastro = opciones
      return {
        cargar: async () => null,
        deducir: async () => null,
        colindantes: async () => null,
        alColindantes(fn) {
          arranque.alColindantes = fn
          return () => {
            arranque.alColindantes = null
          }
        },
        destruir() {},
      }
    },
  }
})

// ── La cáscara REAL, leída de `index.html` ───────────────────────────────────

const RAIZ = join(import.meta.dirname, '..', '..')

const CUERPO_INDEX = (() => {
  const html = readFileSync(join(RAIZ, 'index.html'), 'utf8')
  const encontrado = /<body[^>]*>([\s\S]*)<\/body>/i.exec(html)
  if (encontrado === null) {
    throw new Error(
      'test/app/main-edicion.dom.test.js: no se ha encontrado el <body> de index.html. La ' +
        'cáscara de estas pruebas se lee del fichero real a propósito (no se copia).',
    )
  }
  return encontrado[1]
})()

/**
 * Monta la cáscara real en el documento del test.
 *
 * ⚠️ Se lleva por delante TODO lo que hubiera en el `<body>`, incluida la barra
 * de edición (que vive dentro del contenedor del mapa). Quien la use en un
 * `beforeEach` tiene que volver a montarla: ver {@link montarBarra}.
 */
function montarCascara() {
  document.body.innerHTML = CUERPO_INDEX
}

// La cáscara TIENE que existir antes de importar `app/main.js`: su código de
// nivel superior busca los nodos con `nodo(...)`, que LANZA si falta alguno. La
// BARRA no se monta aquí a propósito: en producción la monta `crearVisor`, o sea
// el import de la línea siguiente, y este fichero reproduce ese orden.
montarCascara()

const {
  cablearEdicion,
  cablearGeneracionGml,
  SELECTOR_BOTON_DESHACER,
  SELECTOR_BOTON_REHACER,
  SELECTOR_CAMPO_SNAP,
  SELECTOR_CAMPO_TOLERANCIA,
  SELECTOR_CAMPO_OFFSET,
  SELECTOR_BOTON_OFFSET,
  SELECTOR_ESTADO_EDICION,
  SELECTOR_BOTON_GML,
} = await import('../../app/main.js')

/**
 * Los nodos que `app/main.js` capturó AL ARRANCAR. Se guardan ahora, antes de
 * que el primer `beforeEach` remonte la cáscara: a partir de ese momento el
 * documento tiene otros, pero estos siguen siendo los que el ensamblaje escribe
 * (y un nodo desprendido conserva su `textContent`).
 */
const DEL_ARRANQUE = Object.freeze({
  superficie: document.querySelector('[data-ficha="superficie"]'),
  perimetro: document.querySelector('[data-ficha="perimetro"]'),
  delta: document.querySelector('[data-ficha="delta-catastral"]'),
  vertices: document.querySelector('[data-ficha="vertices"]'),
  colindantes: document.querySelector('[data-ficha="colindantes"]'),
  tolerancia: document.querySelector(SELECTOR_CAMPO_TOLERANCIA),
  snap: document.querySelector(SELECTOR_CAMPO_SNAP),
})

/** El store REAL del ensamblaje (el mismo objeto que comparten las tres vistas). */
const estadoDelArranque = arranque.opciones.estado
/** La pila REAL del ensamblaje. */
const historialDelArranque = arranque.opciones.historial
/** El canal en vivo que `app/main.js` le entregó al visor. */
const previsualizarDelArranque = arranque.opciones.alPrevisualizar

// ── Datos ────────────────────────────────────────────────────────────────────

/** Cuadrado de 10 × 10 m con un hueco de 2 × 2 m. Superficie neta: 96 m². */
function parcelaConHueco({ superficieCatastral = null } = {}) {
  return crearParcela({
    idLocal: 'prueba-hueco',
    refcat: null,
    origen: ORIGEN_PARCELA.LIST,
    superficieCatastral,
    recintos: [
      crearRecinto(
        [
          [439300, 4479650],
          [439310, 4479650],
          [439310, 4479660],
          [439300, 4479660],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
      crearRecinto(
        [
          [439304, 4479654],
          [439306, 4479654],
          [439306, 4479656],
          [439304, 4479656],
        ],
        TIPO_RECINTO.HUECO,
      ),
    ],
  })
}

/** Cuadrado simple de 10 × 10 m (100 m² exactos), sin huecos. */
function parcelaCuadrada({ superficieCatastral = null, lado = 10 } = {}) {
  return crearParcela({
    idLocal: 'prueba-cuadrada',
    refcat: null,
    origen: ORIGEN_PARCELA.LIST,
    superficieCatastral,
    recintos: [
      crearRecinto(
        [
          [439300, 4479650],
          [439300 + lado, 4479650],
          [439300 + lado, 4479650 + lado],
          [439300, 4479650 + lado],
        ],
        TIPO_RECINTO.EXTERIOR,
      ),
    ],
  })
}

/** El contorno EXTERIOR cruzado consigo mismo: error bloqueante de F02. */
function parcelaCruzada() {
  return crearParcela({
    idLocal: 'prueba-cruzada',
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

/** Los anillos (solo vértices) de una parcela, como los entrega `sincronizar`. */
const anillosDe = (parcela) => parcela.recintos.map((r) => r.vertices.map((v) => [v[0], v[1]]))

// ── Arnés de `cablearEdicion` ────────────────────────────────────────────────

/**
 * Doble de `visor.edicion` con la superficie que consume `cablearEdicion` y la
 * memoria justa para poder afirmar sobre ella. No imita a `viewer/edicion.js`:
 * registra lo que le piden.
 */
function crearEdicionFalsa({ desplazamiento = { aplicado: true, modo: 'MITER', detecciones: [] } } = {}) {
  let snap = true
  let tau = OPERATIVOS.snapMetros
  let seleccion = null
  const oyentes = new Set()

  return {
    llamadas: { snapActivo: [], tolerancia: [], colindantes: [], desplazar: [] },
    /** Simula un clic del mapa que selecciona (o suelta) un lindero. */
    seleccionar(ref) {
      seleccion = ref
      for (const fn of oyentes) fn(ref)
    },
    snapActivo(valor) {
      if (valor !== undefined) {
        this.llamadas.snapActivo.push(valor)
        snap = valor
      }
      return snap
    },
    tolerancia(metros) {
      if (metros !== undefined) {
        this.llamadas.tolerancia.push(metros)
        tau = metros
      }
      return tau
    },
    ladoSeleccionado: () => seleccion,
    alCambiarSeleccion(fn) {
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },
    fijarColindantes(recintos) {
      this.llamadas.colindantes.push(recintos)
    },
    desplazarSeleccion(distancia) {
      this.llamadas.desplazar.push(distancia)
      return desplazamiento
    },
  }
}

/** Lo que hay montado en cada prueba. Se destruye en el `afterEach`. */
let montado = null

/**
 * Monta panel + store + historial SEMBRADO + cableado de la edición sobre la
 * cáscara ya presente en el documento.
 *
 * @param {object|null} parcelaInicial
 * @param {object} [extra]  Opciones que sustituyen a las de por defecto.
 */
function cablear(parcelaInicial, extra = {}) {
  const estado = crearEstadoVista(parcelaInicial)
  const historial = crearHistorial()
  // La MISMA siembra que hace `app/main.js` (decisión 1 de F06): sin ella la
  // primera edición del usuario sería irreversible.
  commit(historial, estado.get())

  const panel = crearPanelAvisos({
    contenedor: document.getElementById('avisos'),
    chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
    chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
  })
  const edicion = extra.edicion ?? crearEdicionFalsa()
  const colindantesContadas = []

  const cableado = cablearEdicion({
    estado,
    historial,
    edicion,
    panel,
    alContarColindantes: (cuantas) => colindantesContadas.push(cuantas),
    ...extra,
  })

  montado = {
    estado,
    historial,
    panel,
    edicion,
    cableado,
    colindantesContadas,
    deshacer: document.querySelector(SELECTOR_BOTON_DESHACER),
    rehacer: document.querySelector(SELECTOR_BOTON_REHACER),
    snap: document.querySelector(SELECTOR_CAMPO_SNAP),
    tolerancia: document.querySelector(SELECTOR_CAMPO_TOLERANCIA),
    offsetCampo: document.querySelector(SELECTOR_CAMPO_OFFSET),
    offsetBoton: document.querySelector(SELECTOR_BOTON_OFFSET),
    renglon: document.querySelector(SELECTOR_ESTADO_EDICION),
  }
  return montado
}

/** Deja correr la cola de microtareas (donde se refrescan los dos botones). */
const cederMicrotarea = () => Promise.resolve()

/**
 * Una operación de edición como la que hacen `sincronizacion.js` y `edicion.js`:
 * `estado.set(clon)` y DESPUÉS `commit`, en ese orden.
 *
 * Ese orden es justo el que obliga a `cablearEdicion` a leer la pila en una
 * MICROTAREA: un suscriptor del store corre dentro del `set`, o sea antes del
 * `commit`, y vería la pila sin la operación que acaba de ocurrir. Por eso este
 * ayudante es `async` y hay que esperarlo antes de mirar los botones — en la
 * pantalla real ese hueco dura menos que un fotograma.
 */
async function editar(estado, historial, parcelaNueva) {
  estado.set(parcelaNueva)
  commit(historial, parcelaNueva)
  await cederMicrotarea()
}

/** Dispara un atajo de teclado sobre `destino` (por defecto, el `<body>`). */
function teclear(tecla, { ctrl = true, shift = false, meta = false, destino = null } = {}) {
  const evento = new KeyboardEvent('keydown', {
    key: tecla,
    ctrlKey: ctrl,
    shiftKey: shift,
    metaKey: meta,
    bubbles: true,
    cancelable: true,
  })
  ;(destino ?? document.body).dispatchEvent(evento)
  return evento
}

/** Textos de las tarjetas del panel de avisos. */
const textosDelPanel = () =>
  [...document.querySelectorAll('#avisos .gml-aviso-texto')].map((t) => t.textContent)

/** ¿Está el renglón en estado de error (el modificador rojo del CSS)? */
const renglonEnError = (renglon) => renglon.classList.contains('gml-accion-estado--error')

// Las DOS fuentes del marcado, en el mismo orden que en producción: la cáscara
// (de `index.html`) y después la barra (de `viewer/barra-edicion.js`, montada
// por `crearVisor`). Sin la segunda, los siete nodos que `cablearEdicion` busca
// no existirían a partir del primer test.
beforeEach(() => {
  desmontarBarra()
  montarCascara()
  montarBarra()
})
afterEach(() => {
  // Los atajos viven en `document`: sin esta baja, el cableado de una prueba
  // seguiría escuchando en la siguiente.
  if (montado !== null) montado.cableado.destruir()
  montado = null
})

// ── 1 · El ENSAMBLAJE: lo que solo se puede comprobar arrancando ─────────────

describe('app/main · el arranque monta la edición (F06)', () => {
  it('el visor se monta CON edición y con la tolerancia EXPLÍCITA de `operativos`', () => {
    // `edicion` es una lista de claves CERRADA: una errata lanzaría. Que la τ
    // viaje explícita es lo que ata los 20 cm del campo a los 0,2 m del modelo.
    expect(arranque.opciones.edicion).toEqual({ tolerancia: OPERATIVOS.snapMetros })
  })

  it('el visor recibe la pila del historial, YA SEMBRADA', () => {
    // Sin la semilla, `puedeDeshacer` (que exige `indice > 0`) dejaría la PRIMERA
    // edición del usuario fuera del alcance del undo, y para siempre.
    expect(historialDelArranque).not.toBeNull()
    expect(historialDelArranque.pila).toHaveLength(1)
    expect(historialDelArranque.indice).toBe(0)
    expect(puedeDeshacer(historialDelArranque)).toBe(false)
  })

  it('el visor recibe el canal EN VIVO como opción de primer nivel', () => {
    expect(typeof previsualizarDelArranque).toBe('function')
  })

  it('la casilla del snap manda: su estado inicial se le empuja al visor', () => {
    expect(DEL_ARRANQUE.snap.checked, 'la barra la trae marcada').toBe(true)
    expect(arranque.registro.snapActivo).toContain(true)
  })

  it('los 20 cm del campo y los metros del visor coinciden POR CONSTRUCCIÓN', () => {
    // El campo se teclea en CENTÍMETROS y el visor trabaja en METROS: la
    // conversión es de esta capa. Se afirma la equivalencia, no el literal «20»:
    // si mañana `operativos.json` dijera otra cosa, el campo tendría que seguirla.
    const cm = Number(DEL_ARRANQUE.tolerancia.value)
    expect(Number.isFinite(cm)).toBe(true)
    expect(cm / 100).toBeCloseTo(OPERATIVOS.snapMetros, 10)
  })
})

describe('app/main · la ficha del pie arranca MEDIDA, no con los guiones del HTML', () => {
  it('superficie, perímetro y vértices salen de `edit/metricas.js`', () => {
    // Se DERIVA de las métricas de la parcela demo en vez de copiar cifras: si el
    // dataset cambia, la prueba lo sigue.
    const esperado = metricas(parcelaDemo().recintos, { superficieCatastral: null })

    expect(DEL_ARRANQUE.vertices.textContent).toBe(String(esperado.nVertices))
    expect(DEL_ARRANQUE.superficie.textContent).toContain(
      esperado.superficie.toFixed(2).replace('.', ','),
    )
    expect(DEL_ARRANQUE.perimetro.textContent).toContain(
      esperado.perimetro.exterior.toFixed(2).replace('.', ','),
    )
    expect(DEL_ARRANQUE.perimetro.textContent.endsWith(' m')).toBe(true)
  })

  it('el Δ catastral DICE que no hay con qué comparar, en vez de pintar «0,00»', () => {
    // La demo no trae superficie declarada, así que `deltaCatastral` es `null`.
    // Un «0,00 m²» afirmaría que no hay discrepancia, que es lo contrario de lo
    // que sabemos —y la versión tranquilizadora—.
    expect(metricas(parcelaDemo().recintos, {}).deltaCatastral).toBeNull()
    expect(DEL_ARRANQUE.delta.textContent).not.toMatch(/0,00/)
    expect(DEL_ARRANQUE.delta.textContent.length).toBeGreaterThan(0)
    expect(DEL_ARRANQUE.delta.textContent).not.toBe('—')
  })

  it('los colindantes siguen diciendo «Sin consultar»: nadie los ha pedido', () => {
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('Sin consultar')
  })
})

// ── 2 · Criterio de aceptación 4: las medidas, EN VIVO ───────────────────────

describe('app/main · el canal en vivo repinta la ficha durante el arrastre (criterio 4)', () => {
  /** Deja el store del ensamblaje como estaba, pase lo que pase. */
  const original = estadoDelArranque.get()
  afterEach(() => estadoDelArranque.set(original))

  it('mover un vértice cambia superficie y perímetro SIN tocar el store', () => {
    const antes = {
      superficie: DEL_ARRANQUE.superficie.textContent,
      perimetro: DEL_ARRANQUE.perimetro.textContent,
    }
    const parcelaAntes = estadoDelArranque.get()

    // Un vértice desplazado 5 m: es lo que `sincronizacion.js` entrega en cada
    // fotograma, anillos EN VUELO que aún no han pasado por el store.
    const anillos = anillosDe(parcelaAntes)
    anillos[0][0] = [anillos[0][0][0] + 5, anillos[0][0][1] + 5]
    previsualizarDelArranque(anillos, { recinto: 0, indice: 0 })

    expect(DEL_ARRANQUE.superficie.textContent).not.toBe(antes.superficie)
    expect(DEL_ARRANQUE.perimetro.textContent).not.toBe(antes.perimetro)
    // …y el modelo sigue intacto: el arrastre no escribe hasta el `dragend`.
    expect(estadoDelArranque.get()).toBe(parcelaAntes)
  })

  it('la cifra en vivo es EXACTAMENTE la que dan las métricas de esos anillos', () => {
    // Es la prueba de que los dos caminos (vivo y store) pintan con la misma
    // función: si divergieran, la que se vería mal es justo esta.
    const parcela = estadoDelArranque.get()
    const anillos = anillosDe(parcela)
    anillos[0][1] = [anillos[0][1][0] + 3, anillos[0][1][1]]

    previsualizarDelArranque(anillos, null)

    const esperado = metricas(
      anillos.map((vertices, i) => ({ ...parcela.recintos[i], vertices })),
      { superficieCatastral: null },
    )
    expect(DEL_ARRANQUE.superficie.textContent).toContain(
      esperado.superficie.toFixed(2).replace('.', ','),
    )
  })

  it('un `set` en el store vuelve a dejar la ficha en la geometría asentada', () => {
    const anillos = anillosDe(estadoDelArranque.get())
    anillos[0][0] = [anillos[0][0][0] + 40, anillos[0][0][1] + 40]
    previsualizarDelArranque(anillos, null)
    const enVuelo = DEL_ARRANQUE.superficie.textContent

    estadoDelArranque.set(original)

    expect(DEL_ARRANQUE.superficie.textContent).not.toBe(enVuelo)
    expect(DEL_ARRANQUE.superficie.textContent).toContain(
      metricas(original.recintos, {}).superficie.toFixed(2).replace('.', ','),
    )
  })

  it('el Δ catastral se mueve con el arrastre cuando SÍ hay superficie declarada', () => {
    // El criterio 4 lo pide expresamente: «diferencia respecto a la superficie
    // catastral en vivo si hay parcela oficial cargada».
    estadoDelArranque.set(parcelaCuadrada({ superficieCatastral: 100 }))
    // Medida (100 m²) y declarada (100 m²) coinciden: la diferencia es cero, que
    // aquí sí es una cifra —hay con qué comparar— y por eso se escribe.
    expect(DEL_ARRANQUE.delta.textContent).toMatch(/0,00\s*m²/)

    // Se saca un vértice 1 m: el cuadrado pasa a trapecio y gana superficie.
    const anillos = anillosDe(estadoDelArranque.get())
    anillos[0][1] = [anillos[0][1][0] + 1, anillos[0][1][1]]
    previsualizarDelArranque(anillos, { recinto: 0, indice: 1 })

    const esperado = metricas(
      anillos.map((vertices, i) => ({ tipo: TIPO_RECINTO.EXTERIOR, vertices })),
      { superficieCatastral: 100 },
    )
    expect(esperado.deltaCatastral.absoluto).toBeGreaterThan(0)
    // Con SIGNO: «+5,00 m²» dice algo que «5,00 m²» no dice.
    expect(DEL_ARRANQUE.delta.textContent).toContain(
      `+${esperado.deltaCatastral.absoluto.toFixed(2).replace('.', ',')} m²`,
    )
    expect(DEL_ARRANQUE.delta.textContent).toContain('%')
  })

  it('con hueco, el perímetro dice el del EXTERIOR y suma los huecos aparte', () => {
    estadoDelArranque.set(parcelaConHueco())
    // Exterior 4 × 10 = 40 m; hueco 4 × 2 = 8 m. Ni se callan ni se funden.
    expect(DEL_ARRANQUE.perimetro.textContent).toContain('40,00 m')
    expect(DEL_ARRANQUE.perimetro.textContent).toContain('8,00 m')
    // Y la superficie sí es la NETA (100 − 4): la asimetría es real.
    expect(DEL_ARRANQUE.superficie.textContent).toContain('96,00')
  })
})

// ── 3 · Criterio de aceptación 5: undo/redo ──────────────────────────────────

describe('app/main · deshacer y rehacer (criterio 5)', () => {
  it('tras UNA sola edición ya se puede deshacer, y el undo devuelve la original', async () => {
    // El caso que rompería una pila sin sembrar: la PRIMERA edición.
    const inicial = parcelaCuadrada()
    const { estado, historial, deshacer } = cablear(inicial)
    expect(deshacer.disabled, 'al arrancar no hay nada que deshacer').toBe(true)

    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))

    expect(puedeDeshacer(historial)).toBe(true)
    expect(deshacer.disabled).toBe(false)

    deshacer.click()

    expect(estado.get().recintos[0].vertices).toEqual(inicial.recintos[0].vertices)
    expect(deshacer.disabled).toBe(true)
  })

  it('el botón se enciende aunque el `commit` llegue DESPUÉS del `set`', async () => {
    // El orden real de los dos módulos que commitean. Leyendo la pila DENTRO del
    // `set` (que es cuando corren los suscriptores del store) el botón se
    // quedaría un paso por detrás para siempre: encendido por la operación
    // anterior, nunca por la que se acaba de hacer.
    const { estado, historial, deshacer } = cablear(parcelaCuadrada())
    estado.set(parcelaCuadrada({ lado: 20 }))
    commit(historial, estado.get())

    await cederMicrotarea()
    expect(deshacer.disabled).toBe(false)
  })

  it('el botón de rehacer se enciende al deshacer, y rehacer restaura', async () => {
    const { estado, historial, deshacer, rehacer } = cablear(parcelaCuadrada())
    const editada = parcelaCuadrada({ lado: 20 })
    await editar(estado, historial, editada)

    deshacer.click()
    expect(puedeRehacer(historial)).toBe(true)
    expect(rehacer.disabled).toBe(false)

    rehacer.click()
    expect(estado.get().recintos[0].vertices).toEqual(editada.recintos[0].vertices)
    expect(rehacer.disabled).toBe(true)
  })

  it('⚠️ undo y redo NO ensucian la pila: solo mueven el índice', async () => {
    // No se da por hecho, se mide. Un `commit` al deshacer convertiría el propio
    // deshacer en una operación deshacible y borraría la rama de rehacer; y un
    // suscriptor del store que commiteara haría lo mismo por la puerta de atrás.
    const { estado, historial, deshacer, rehacer } = cablear(parcelaCuadrada())
    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))
    await editar(estado, historial, parcelaCuadrada({ lado: 30 }))

    const alturaAntes = historial.pila.length
    expect(alturaAntes).toBe(3)
    expect(historial.indice).toBe(2)

    deshacer.click()
    deshacer.click()
    expect(historial.pila).toHaveLength(alturaAntes)
    expect(historial.indice).toBe(0)

    rehacer.click()
    expect(historial.pila).toHaveLength(alturaAntes)
    expect(historial.indice).toBe(1)
    // La rama de rehacer sigue entera: si `deshacer` hubiera commiteado, el
    // tercer snapshot se habría perdido en el primer undo.
    expect(puedeRehacer(historial)).toBe(true)
  })

  it('la instantánea es INDEPENDIENTE: deshacer no devuelve el objeto mutado', async () => {
    const { estado, historial, deshacer } = cablear(parcelaCuadrada())
    const antes = estado.get()
    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))

    deshacer.click()

    expect(estado.get()).not.toBe(antes) // es un clon del snapshot…
    expect(estado.get().recintos[0].vertices).toEqual(antes.recintos[0].vertices) // …idéntico
  })

  it('sin nada que deshacer, pulsar NO revienta y el renglón lo dice', () => {
    const { deshacer, rehacer, cableado, renglon } = cablear(parcelaCuadrada())
    expect(deshacer.disabled).toBe(true)

    // `click()` sobre un botón deshabilitado no dispara nada, así que se llama a
    // la acción directamente: es el camino que sí alcanza el atajo de teclado.
    expect(() => cableado.deshacer()).not.toThrow()
    expect(renglon.textContent).toMatch(/deshacer/i)
    expect(() => cableado.rehacer()).not.toThrow()
    expect(renglon.textContent).toMatch(/rehacer/i)
    expect(deshacer.disabled).toBe(true)
    expect(rehacer.disabled).toBe(true)
  })

  it('los botones NUNCA pierden su `<kbd>`: se les toca el `disabled`, no el texto', async () => {
    const { estado, historial, deshacer, rehacer } = cablear(parcelaCuadrada())
    await editar(estado, historial, parcelaCuadrada({ lado: 20 }))
    deshacer.click()

    for (const boton of [deshacer, rehacer]) {
      expect(boton.querySelector('kbd'), 'el atajo escrito dentro del botón').not.toBeNull()
    }
  })
})

// ── 4 · Los atajos de teclado ────────────────────────────────────────────────

describe('app/main · atajos de deshacer/rehacer', () => {
  /** Deja la pila con una edición hecha, lista para deshacerse. */
  async function conHistoria() {
    const arnes = cablear(parcelaCuadrada())
    await editar(arnes.estado, arnes.historial, parcelaCuadrada({ lado: 20 }))
    return arnes
  }

  it('`Ctrl+Z` deshace', async () => {
    const { historial } = await conHistoria()
    teclear('z')
    expect(historial.indice).toBe(0)
  })

  it('`Ctrl+Y` rehace', async () => {
    const { historial } = await conHistoria()
    teclear('z')
    teclear('y')
    expect(historial.indice).toBe(1)
  })

  it('`Ctrl+Shift+Z` rehace también (las dos formas existen en el mundo real)', async () => {
    const { historial } = await conHistoria()
    teclear('z')
    teclear('z', { shift: true })
    expect(historial.indice).toBe(1)
  })

  it('`Meta` cuenta como `Ctrl` (macOS)', async () => {
    const { historial } = await conHistoria()
    teclear('z', { ctrl: false, meta: true })
    expect(historial.indice).toBe(0)
  })

  it('sin modificador no pasa nada: la «z» a secas se escribe, no deshace', async () => {
    const { historial } = await conHistoria()
    teclear('z', { ctrl: false })
    expect(historial.indice).toBe(1)
  })

  it('⚠️ dentro de un `<input>` el atajo NO se roba: es el deshacer del navegador', async () => {
    // Las celdas de coordenada de la tabla de vértices SON inputs. Robar ahí el
    // `Ctrl+Z` revertiría la geometría mientras el usuario corrige un dígito.
    const { historial, tolerancia } = await conHistoria()
    const evento = teclear('z', { destino: tolerancia })

    expect(historial.indice, 'la pila no se ha movido').toBe(1)
    expect(evento.defaultPrevented, 'el navegador conserva su atajo').toBe(false)
  })

  it('y tampoco en el campo de la referencia catastral ni en un `contentEditable`', async () => {
    const { historial } = await conHistoria()
    teclear('z', { destino: document.querySelector('[data-campo="refcat"]') })
    expect(historial.indice).toBe(1)

    const editable = document.createElement('div')
    // jsdom no calcula `isContentEditable` desde el atributo: se fija a mano, que
    // es lo que el navegador expondría.
    Object.defineProperty(editable, 'isContentEditable', { value: true })
    document.body.appendChild(editable)
    teclear('z', { destino: editable })
    expect(historial.indice).toBe(1)
  })

  it('el atajo se CONSUME cuando es nuestro, también si no hay nada que deshacer', () => {
    cablear(parcelaCuadrada())
    const evento = teclear('z')
    expect(evento.defaultPrevented).toBe(true)
  })

  it('`destruir()` retira el oyente del documento', async () => {
    const { historial, cableado } = await conHistoria()
    cableado.destruir()
    teclear('z')
    expect(historial.indice).toBe(1)
  })
})

// ── 5 · Los tres controles del bloque ────────────────────────────────────────

describe('app/main · la casilla y la tolerancia del enganche', () => {
  it('la casilla escribe en `visor.edicion.snapActivo`', () => {
    const { snap, edicion } = cablear(parcelaCuadrada())
    snap.checked = false
    snap.dispatchEvent(new Event('change', { bubbles: true }))
    expect(edicion.llamadas.snapActivo.at(-1)).toBe(false)

    snap.checked = true
    snap.dispatchEvent(new Event('change', { bubbles: true }))
    expect(edicion.llamadas.snapActivo.at(-1)).toBe(true)
  })

  it('⚠️ la tolerancia se teclea en CENTÍMETROS y baja al visor en METROS', () => {
    const { tolerancia, edicion } = cablear(parcelaCuadrada())
    tolerancia.value = '50'
    tolerancia.dispatchEvent(new Event('change', { bubbles: true }))
    expect(edicion.llamadas.tolerancia.at(-1)).toBeCloseTo(0.5, 10)
  })

  it('`0` es válido: apaga el enganche y no se corrige ni se avisa', () => {
    const { tolerancia, edicion, panel } = cablear(parcelaCuadrada())
    tolerancia.value = '0'
    tolerancia.dispatchEvent(new Event('change', { bubbles: true }))

    expect(edicion.llamadas.tolerancia.at(-1)).toBe(0)
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })

  it.each([
    ['vacía', ''],
    ['negativa', '-5'],
  ])('una tolerancia %s es DATO MALO: avisa, revierte y NO lanza', (_caso, valor) => {
    const { tolerancia, edicion, panel, renglon } = cablear(parcelaCuadrada())
    const antes = edicion.tolerancia()

    expect(() => {
      tolerancia.value = valor
      tolerancia.dispatchEvent(new Event('change', { bubbles: true }))
    }).not.toThrow()

    // Ni se aplica…
    expect(edicion.tolerancia()).toBe(antes)
    // …ni se deja el campo con lo ilegible dentro…
    expect(Number(tolerancia.value)).toBeCloseTo(antes * 100, 10)
    // …ni se calla (panel + renglón, como el resto del fichero).
    expect(panel.resumen()[NIVEL.AVISO]).toBe(1)
    expect(renglonEnError(renglon)).toBe(true)
  })
})

describe('app/main · el desplazamiento de lindero (offset)', () => {
  it('el botón nace apagado y se enciende con la SELECCIÓN', () => {
    const { offsetBoton, edicion, renglon } = cablear(parcelaCuadrada())
    expect(offsetBoton.disabled).toBe(true)

    // ⚠️ AQUÍ ya no se exige que el renglón traiga el motivo AL ARRANCAR, y no es
    // un aflojamiento de la regla de oro 1 («un botón gris y mudo es un error
    // silencioso»): es que el motivo cambió de sitio el 2026-07-29, cuando los
    // controles se fueron del panel a la barra flotante SOBRE EL MAPA. Escrito en
    // el renglón, el mismo texto pasaba de ser una nota de 11 px al pie de un
    // bloque a un cartel de tres líneas plantado sobre la ortofoto que no se iba
    // hasta la primera edición. Quien lo garantiza ahora, cada uno donde el
    // usuario lo va a buscar:
    //   · `viewer/barra-edicion.js` emite `[data-motivo="offset"]` DENTRO del
    //     desplegable del offset, y `estilos/app.css` lo enseña justamente
    //     mientras el botón está apagado (regla de hermano sobre `:disabled`);
    //   · el panel de ayuda del botón «?» lo dice en su primera línea.
    // Los dos tienen su propia prueba en `test/viewer/barra-edicion.dom.test.js`.
    // Lo que este fichero SÍ sigue exigiendo es lo de abajo: que apagarlo por una
    // acción del usuario (deseleccionar) se cuente en el momento en que ocurre.
    expect(renglon.textContent, 'el arranque no planta un cartel sobre el mapa').toBe('')

    edicion.seleccionar({ recinto: 0, indice: 1 })
    expect(offsetBoton.disabled).toBe(false)

    edicion.seleccionar(null)
    expect(offsetBoton.disabled).toBe(true)
    expect(renglon.textContent, 'apagarlo por un gesto del usuario SÍ se cuenta').toMatch(
      /lindero/i,
    )
  })

  it('la distancia baja en METROS, tal cual, incluido el `0`', () => {
    const { offsetBoton, offsetCampo, edicion } = cablear(parcelaCuadrada())
    edicion.seleccionar({ recinto: 0, indice: 0 })

    offsetCampo.value = '0.5'
    offsetBoton.click()
    expect(edicion.llamadas.desplazar).toEqual([0.5])

    // El «desplazar 0 m» lo cuenta `viewer/edicion.js`: adelantarnos aquí sería
    // una segunda redacción del mismo suceso.
    offsetCampo.value = '0'
    offsetBoton.click()
    expect(edicion.llamadas.desplazar).toEqual([0.5, 0])
  })

  it('una distancia ilegible avisa y NO llega a `desplazarSeleccion`', () => {
    const { offsetBoton, offsetCampo, edicion, panel, renglon } = cablear(parcelaCuadrada())
    edicion.seleccionar({ recinto: 0, indice: 0 })

    offsetCampo.value = ''
    expect(() => offsetBoton.click()).not.toThrow()

    expect(edicion.llamadas.desplazar).toEqual([])
    expect(panel.resumen()[NIVEL.AVISO]).toBe(1)
    expect(renglonEnError(renglon)).toBe(true)
    // Y NO se le borra al usuario lo que estaba escribiendo: aquí no hay ningún
    // «valor vigente» del modelo al que revertir.
    expect(offsetCampo.value).toBe('')
  })

  it('las detecciones NO se publican dos veces: de eso ya se encargó el visor', () => {
    // `viewer/edicion.js` suelta en el panel, verbatim, cada detección de
    // `edit/offset.js`. Republicarlas aquí obligaría a leerlo todo dos veces.
    const edicion = crearEdicionFalsa({
      desplazamiento: {
        aplicado: true,
        modo: 'BEVEL',
        detecciones: [{ tipo: 'BISEL_APLICADO', mensaje: 'Se ha biselado la esquina.' }],
      },
    })
    const { offsetBoton, offsetCampo, panel } = cablear(parcelaCuadrada(), { edicion })
    edicion.seleccionar({ recinto: 0, indice: 0 })

    offsetCampo.value = '1'
    offsetBoton.click()

    expect(textosDelPanel()).not.toContain('Se ha biselado la esquina.')
    expect(panel.resumen()).toEqual({ [NIVEL.ERROR]: 0, [NIVEL.AVISO]: 0 })
  })

  it('cuando el offset no se aplica, el renglón lo dice y remite al panel', () => {
    const edicion = crearEdicionFalsa({
      desplazamiento: { aplicado: false, modo: null, detecciones: [] },
    })
    const { offsetBoton, offsetCampo, renglon } = cablear(parcelaCuadrada(), { edicion })
    edicion.seleccionar({ recinto: 0, indice: 0 })

    offsetCampo.value = '1'
    offsetBoton.click()

    expect(renglonEnError(renglon)).toBe(true)
    expect(renglon.textContent).toMatch(/panel de avisos/i)
  })
})

// ── 6 · Los dos ganchos que se le entregan al Catastro ───────────────────────

describe('app/main · una parcela nueva REINICIA el historial (decisión 2 de F06)', () => {
  it('deshacer no devuelve la parcela anterior: la pila empieza de cero', () => {
    const { estado, historial, cableado, deshacer, renglon } = cablear(parcelaCuadrada())
    editar(estado, historial, parcelaCuadrada({ lado: 20 }))
    expect(puedeDeshacer(historial)).toBe(true)

    const traida = parcelaConHueco({ superficieCatastral: 96 })
    estado.set(traida) // lo que hace `cablearCatastro` antes de llamar al gancho
    cableado.alCargarParcela(traida)

    expect(historial.pila).toHaveLength(1)
    expect(historial.indice).toBe(0)
    expect(puedeDeshacer(historial)).toBe(false)
    expect(deshacer.disabled).toBe(true)
    // Y se dice: un botón que se apaga solo, sin motivo, se lee como un fallo.
    expect(renglon.textContent.length).toBeGreaterThan(0)
  })

  it('suelta las colindantes de la parcela anterior (ya no lindan con nada)', () => {
    const { cableado, edicion, colindantesContadas } = cablear(parcelaCuadrada())
    cableado.alColindantes({
      ok: true,
      datos: { colindantes: [parcelaCuadrada(), parcelaConHueco()] },
    })
    expect(edicion.llamadas.colindantes.at(-1).length).toBeGreaterThan(0)

    cableado.alCargarParcela(parcelaCuadrada({ lado: 30 }))

    expect(edicion.llamadas.colindantes.at(-1)).toEqual([])
    expect(colindantesContadas.at(-1)).toBeNull()
  })

  it('tras el reinicio, la primera edición vuelve a ser deshacible', async () => {
    const { estado, historial, cableado, deshacer } = cablear(parcelaCuadrada())
    const traida = parcelaCuadrada({ lado: 15 })
    estado.set(traida)
    cableado.alCargarParcela(traida)

    editar(estado, historial, parcelaCuadrada({ lado: 25 }))
    await cederMicrotarea()

    expect(deshacer.disabled).toBe(false)
    deshacer.click()
    expect(estado.get().recintos[0].vertices).toEqual(traida.recintos[0].vertices)
  })
})

describe('app/main · las colindantes llegan APLANADAS a las dianas del enganche', () => {
  it('⚠️ `fijarColindantes` recibe RECINTOS, no parcelas', () => {
    // Pasarle parcelas sin aplanar LANZA en `viewer/edicion.js` (a propósito: no
    // aportarían ni una diana y el snap parecería roto sin motivo).
    const { cableado, edicion } = cablear(parcelaCuadrada())
    const vecinas = [parcelaCuadrada(), parcelaConHueco()]

    cableado.alColindantes({ ok: true, datos: { colindantes: vecinas } })

    const recibidos = edicion.llamadas.colindantes.at(-1)
    expect(recibidos).toHaveLength(3) // 1 exterior + (1 exterior + 1 hueco)
    for (const recinto of recibidos) {
      expect(Array.isArray(recinto.vertices), 'cada elemento es un RECINTO').toBe(true)
      expect(recinto.recintos, 'y no una parcela').toBeUndefined()
    }
  })

  it('el recuento sale por el callback de la ficha, no escribiendo en el `<dd>`', () => {
    const { cableado, colindantesContadas } = cablear(parcelaCuadrada())
    cableado.alColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    expect(colindantesContadas).toEqual([1])
  })

  it('cero colindantes SÍ es una respuesta: se cuenta el 0', () => {
    const { cableado, colindantesContadas, edicion, renglon } = cablear(parcelaCuadrada())
    cableado.alColindantes({ ok: true, datos: { colindantes: [] } })

    expect(colindantesContadas).toEqual([0])
    expect(edicion.llamadas.colindantes.at(-1)).toEqual([])
    expect(renglon.textContent.length).toBeGreaterThan(0)
  })

  it('una consulta que FALLA no borra las dianas ni inventa un recuento', () => {
    // Una consulta que falla no es una consulta que devuelve cero vecinas, y el
    // motivo ya lo ha contado `cableado-catastro.js` en su propio renglón.
    const { cableado, edicion, colindantesContadas } = cablear(parcelaCuadrada())
    cableado.alColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    const dianas = edicion.llamadas.colindantes.length

    cableado.alColindantes({ ok: false, datos: null, motivo: 'RED' })
    cableado.alColindantes(null)

    expect(edicion.llamadas.colindantes).toHaveLength(dianas)
    expect(colindantesContadas).toEqual([1])
  })
})

// ── 7 · El cable ENTERO: del Catastro a la ficha, por el ensamblaje real ─────

describe('app/main · los dos ganchos que el arranque le entrega al Catastro', () => {
  const original = estadoDelArranque.get()
  afterEach(() => {
    // Se deja el ensamblaje como estaba: su store, su pila y su ficha. El propio
    // gancho de «parcela nueva» es lo que devuelve las tres cosas a cero.
    estadoDelArranque.set(original)
    arranque.catastro.alCargarParcela(original)
    estadoDelArranque.set(original)
  })

  it('el arranque le pasa `alCargarParcela` y le registra el oyente de colindantes', () => {
    expect(typeof arranque.catastro.alCargarParcela).toBe('function')
    expect(typeof arranque.alColindantes, 'el puente del arranque').toBe('function')
  })

  it('traer una parcela REINICIA la pila del arranque (deshacer no la devuelve)', () => {
    const traida = parcelaCuadrada({ superficieCatastral: 100 })
    // Lo que hace el cableado real: un `set` y después el gancho.
    estadoDelArranque.set(traida)
    arranque.catastro.alCargarParcela(traida)

    expect(historialDelArranque.pila).toHaveLength(1)
    expect(historialDelArranque.indice).toBe(0)
    expect(puedeDeshacer(historialDelArranque)).toBe(false)
  })

  it('las colindantes llegan a las dianas APLANADAS y a la ficha CONTADAS', () => {
    // El recorrido completo: resultado del WFS → `flatMap` a recintos →
    // `visor.edicion.fijarColindantes` → callback → `<dd data-ficha>`.
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('Sin consultar')

    arranque.alColindantes({
      ok: true,
      datos: { colindantes: [parcelaCuadrada(), parcelaConHueco()] },
    })

    const dianas = arranque.registro.colindantes.at(-1)
    expect(dianas).toHaveLength(3) // 1 exterior + (1 exterior + 1 hueco)
    for (const recinto of dianas) expect(Array.isArray(recinto.vertices)).toBe(true)
    // Y la ficha deja por fin de decir «Sin consultar».
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('2')
  })

  it('cargar otra parcela suelta el recuento: esas vecinas ya no lindan con nada', () => {
    arranque.alColindantes({ ok: true, datos: { colindantes: [parcelaCuadrada()] } })
    expect(DEL_ARRANQUE.colindantes.textContent).toBe('1')

    const traida = parcelaCuadrada({ lado: 30 })
    estadoDelArranque.set(traida)
    arranque.catastro.alCargarParcela(traida)

    expect(DEL_ARRANQUE.colindantes.textContent).toBe('Sin consultar')
    expect(arranque.registro.colindantes.at(-1)).toEqual([])
  })
})

// ── 8 · «Generar GML» se re-evalúa también con las operaciones nuevas ────────

describe('app/main · el botón «Generar GML» sigue al store tras un undo', () => {
  it('deshacer una edición que rompía la parcela vuelve a encender el botón', () => {
    const estado = crearEstadoVista(parcelaCuadrada())
    const historial = crearHistorial()
    commit(historial, estado.get())
    const panel = crearPanelAvisos({
      contenedor: document.getElementById('avisos'),
      chipError: document.querySelector('.gml-chip[data-contador="ERROR"]'),
      chipAviso: document.querySelector('.gml-chip[data-contador="AVISO"]'),
    })
    const gml = cablearGeneracionGml({ estado, panel, srs: SRS_DEMO })
    const edicionCableada = cablearEdicion({
      estado,
      historial,
      edicion: crearEdicionFalsa(),
      panel,
    })
    const boton = document.querySelector(SELECTOR_BOTON_GML)
    expect(boton.disabled).toBe(false)

    // Una edición que cruza el contorno consigo mismo: F02 bloquea.
    editar(estado, historial, parcelaCruzada())
    expect(boton.disabled).toBe(true)

    edicionCableada.deshacer()

    // El estado del botón corresponde al estado RESTAURADO, no al anterior.
    expect(boton.disabled).toBe(false)

    edicionCableada.rehacer()
    expect(boton.disabled).toBe(true)

    edicionCableada.destruir()
    gml.destruir()
  })
})

// ── 9 · Contrato con la barra de edición ─────────────────────────────────────

describe('app/main · el marcado de las herramientas de edición es CONTRATO', () => {
  it.each([
    ['el botón de deshacer', SELECTOR_BOTON_DESHACER],
    ['el botón de rehacer', SELECTOR_BOTON_REHACER],
    ['la casilla del snap', SELECTOR_CAMPO_SNAP],
    ['la tolerancia', SELECTOR_CAMPO_TOLERANCIA],
    ['la distancia del offset', SELECTOR_CAMPO_OFFSET],
    ['el botón del offset', SELECTOR_BOTON_OFFSET],
    ['el renglón de estado', SELECTOR_ESTADO_EDICION],
  ])('falta %s ⇒ lanza NOMBRANDO el selector', (_caso, selector) => {
    document.querySelector(selector).remove()
    const estado = crearEstadoVista(parcelaCuadrada())
    const historial = crearHistorial()
    commit(historial, estado.get())
    expect(() =>
      cablearEdicion({ estado, historial, edicion: crearEdicionFalsa(), panel: null }),
    ).toThrow(selector)
  })

  it('la guarda NO es vacua: la barra trae los siete nodos y su estado inicial', () => {
    for (const selector of [
      SELECTOR_BOTON_DESHACER,
      SELECTOR_BOTON_REHACER,
      SELECTOR_CAMPO_SNAP,
      SELECTOR_CAMPO_TOLERANCIA,
      SELECTOR_CAMPO_OFFSET,
      SELECTOR_BOTON_OFFSET,
      SELECTOR_ESTADO_EDICION,
    ]) {
      expect(document.querySelector(selector), selector).not.toBeNull()
    }
    // Los tres botones nacen apagados y la casilla marcada (ver la barra).
    for (const selector of [SELECTOR_BOTON_DESHACER, SELECTOR_BOTON_REHACER, SELECTOR_BOTON_OFFSET]) {
      expect(document.querySelector(selector).disabled, selector).toBe(true)
    }
    expect(document.querySelector(SELECTOR_CAMPO_SNAP).checked).toBe(true)
    // Y el renglón se anuncia sin robar el foco.
    expect(document.querySelector(SELECTOR_ESTADO_EDICION).getAttribute('role')).toBe('status')
  })

  it('un visor SIN edición no se cablea a medias: lanza diciendo por qué', () => {
    const estado = crearEstadoVista(parcelaCuadrada())
    const historial = crearHistorial()
    commit(historial, estado.get())
    expect(() => cablearEdicion({ estado, historial, edicion: null, panel: null })).toThrow(
      /edicion/i,
    )
  })

  it('un historial que no es el POJO de `crearHistorial` es contrato roto', () => {
    const estado = crearEstadoVista(parcelaCuadrada())
    expect(() =>
      cablearEdicion({ estado, historial: { deshacer() {} }, edicion: crearEdicionFalsa() }),
    ).toThrow(/historial/i)
  })
})

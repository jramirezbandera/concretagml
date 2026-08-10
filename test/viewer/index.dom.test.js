// test/viewer/index.dom.test.js — F03 · Tarea 3C.
//
// CAJA NEGRA sobre `crearVisor`. Aquí NO se repite lo que ya cubren los tests de
// los nueve módulos del visor (las cinco bases conmutan → `capas.dom.test.js`;
// el arrastre incremental → `sincronizacion.dom.test.js`; los panes → `mapa.dom.
// test.js`): se prueba lo que SOLO existe cuando las piezas están ensambladas.
//
// Lo que este fichero protege:
//   · EL CONTRATO DE VIEWPORT (hallazgo C5) — los tres caminos: geometría,
//     `vistaInicial` y `throw`. Es la razón de ser de la tarea: un visor que
//     arranca mirando a un sitio arbitrario es un fallo silencioso.
//   · El caso DEGENERADO (un vértice, o vértices coincidentes): ni zoom absurdo
//     ni NaN.
//   · El ensamblaje visto desde fuera (criterio de aceptación 3) y la atribución
//     en el DOM (criterio de aceptación 5).
//   · La traducción `srs → zona` y la comprobación del tope de zoom.
//   · Que `alAvisar` llega a las DOS mitades (capas y sincronización).
//   · `destruir()`: idempotente y sin dejar nada vivo detrás.
//
// Y desde F06 · T4.1, la OPCIÓN `edicion` — que es ensamblaje puro y por tanto
// vive aquí y no en `edicion.dom.test.js` ni en `acotaciones.dom.test.js`:
//   · `edicion:false` (el defecto) ⇒ el visor de F03 EXACTO, con los TRES
//     ganchos de `sincronizar` en `null` y `visor.edicion`/`visor.acotaciones` a
//     `null` (no `undefined`).
//   · `edicion:true|{…}` ⇒ las dos piezas montadas y ENCHUFADAS: los ganchos que
//     recibe `sincronizar` son los de la edición, y su `alPrevisualizar` repinta
//     las cotas.
//   · el DOBLE CANAL de `alPrevisualizar` (cotas + llamante) y su orden.
//   · el desmontaje en orden INVERSO, con el `doubleClickZoom` restaurado
//     mientras el mapa sigue en pie.
//   · la ATOMICIDAD cuando la edición falla a mitad del ensamblaje.
//
// Y desde F07 · T4.1, la OPCIÓN `diagnostico`, por el mismo motivo:
//   · `diagnostico:false` (el defecto) ⇒ el visor de antes de F07 EXACTO: ni un
//     control, ni una capa, ni un listener de más, y `visor.diagnostico` a `null`.
//   · `diagnostico:true|{…}` ⇒ el cajón (CERRADO) y la capa (VACÍA) montados, con
//     sus dos opciones llegando a su destinatario.
//   · que las dos opciones son INDEPENDIENTES: diagnosticar sobre una parcela que
//     se está editando es el caso normal, no una combinación exótica.
//   · el desmontaje —el diagnóstico es el PRIMERO en caer— y la atomicidad.
//
// Y desde F08 · T3.1, la OPCIÓN `comprobacion`, por el mismo motivo:
//   · `comprobacion:false` (el defecto) ⇒ el visor de antes de F08 EXACTO: ni un
//     control ni un listener de más, y `visor.comprobacion` a `null`.
//   · `comprobacion:true|{…}` ⇒ el cajón montado, CERRADO y en blanco, con su
//     única opción llegando a su destinatario.
//   · que su cajón COMPARTE la esquina `bottomleft` con el de F07 —las cuatro del
//     mapa ya estaban ocupadas— y que ahí caben los dos sin pelearse: la exclusión
//     mutua es del CABLEADO, no del ensamblador, y hay un test que lo fija.
//   · el desmontaje —la comprobación es lo último que se monta y lo primero que
//     cae— y la atomicidad.
//
// Y desde el arreglo del REENCUADRE VIVO (defecto de F05 encontrado en la
// revisión visual de F08: el mapa solo se encuadraba al construir el visor, así
// que traer una parcela de Sevilla dejaba el mapa mirando la de demostración):
//   · una parcela con OTRA identidad (`refcat ?? idLocal`) mueve la vista;
//   · **la MISMA identidad con los vértices movidos NO la mueve** — es la prueba
//     de que editar no hace que el mapa persiga al vértice, y la más importante
//     de las dos: sin ella, F06 sería inusable;
//   · el arranque encuadra UNA sola vez, no dos;
//   · `visor.encuadrar()`, el encuadre explícito, con su cascada completa;
//   · que del MISMO cambio de identidad cuelga la limpieza de las COLINDANTES
//     (parcela nueva ⇒ vecinas que ya no son suyas), con su gemela: editar la
//     misma parcela NO las borra;
//   · y que la suscripción se da de baja en `destruir()`.
//
// Y desde F11 · T1.5, los tres cambios quirúrgicos que abren la rama EDIFICIO sin
// tocar el visor de parcela (el bloque grande del final de este fichero):
//   · el pane `PANE.PARTES`, que lo crea el MAPA iterando `PANES` y no una opción;
//   · `encuadrarSobreRecintos(...)`, hasta ahora privado: encuadra sobre recintos
//     AJENOS al store —`visor.encuadrar()` no sirve en la rama edificio, porque
//     ejecuta la cascada sobre el store de PARCELA— y trae el caso degenerado
//     dentro. Hay un test que exige que la vía nueva y la vieja dejen el mapa en
//     EXACTAMENTE la misma vista: esto es una extracción, no una reescritura.
//   · `visor.barraEdicion`, para poder OCULTARLA sin desmontarla.
//
// Y la OPCIÓN `colindantes` (la capa de parcelas vecinas, que tampoco existía:
// se traían del Catastro y no las pintaba nadie), con el mismo reparto de
// siempre — lo que la PIEZA hace vive en `colindantes.dom.test.js`; aquí solo el
// ensamblaje.
//
// Proyecto Vitest `dom` (jsdom): el sufijo `.dom.test.js` lo enruta ahí, porque
// `viewer/index.js` arrastra Leaflet. NINGUNA petición real de red: jsdom no
// descarga imágenes, y `load`/`error` se emiten a mano con `dispararCarga`.

import { describe, it, expect, vi, afterEach } from 'vitest'
import L from 'leaflet'

import { crearVisor, encuadrarSobreRecintos } from '../../viewer/index.js'
import { NIVEL, PANE, PANES, crearEstadoVista, vertUTMaLatLng } from '../../viewer/_comun.js'
import { BASE_POR_DEFECTO, ID_CAPA, maxZoomNativo, CAPAS } from '../../viewer/capas.js'
import { ATRIBUCION } from '../../viewer/atribucion.js'
import { CLASE_ACOTACION, textoDeLongitud } from '../../viewer/acotaciones.js'
import { CLASE_BARRA } from '../../viewer/barra-edicion.js'
import { CLASE_COLINDANTE } from '../../viewer/colindantes.js'
import { CLASE as CLASE_CAJON, SELECTOR as SELECTOR_CAJON } from '../../viewer/cajon-diagnostico.js'
import {
  CLASE as CLASE_COMPROBACION,
  SELECTOR as SELECTOR_COMPROBACION,
} from '../../viewer/cajon-comprobacion.js'
import {
  CLASE as CLASE_PARCELAS,
  SELECTOR as SELECTOR_PARCELAS,
} from '../../viewer/cajon-parcelas.js'
import { CLASE_CANDIDATA } from '../../viewer/candidatas.js'
import { MENSAJES } from '../../viewer/wms-catastro.js'
import { sincronizar } from '../../viewer/sincronizacion.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { crearHistorial } from '../../edit/historial.js'
import {
  crearContenedor,
  dispararCarga,
  espiarPeticiones,
  parcelaConHueco,
} from './_ayuda-jsdom.js'

// `sincronizar` se envuelve en un espía que llama al ORIGINAL: el comportamiento
// del visor es idéntico —y por eso las 28 pruebas de F03 de este fichero siguen
// verdes sin tocar ni una línea— y a cambio se puede LEER con qué ganchos se ha
// construido. Es la única forma de demostrar «los tres en `null`»: un gancho que
// no se enchufa no deja ninguna huella observable, que es justo lo que hay que
// probar. Mismo patrón —y por el mismo motivo— que el espía sobre `dianasDe` de
// `test/viewer/edicion.dom.test.js`.
vi.mock('../../viewer/sincronizacion.js', async (importarOriginal) => {
  const real = await importarOriginal()
  return { ...real, sincronizar: vi.fn(real.sincronizar) }
})

// ── Utilidades del test ──────────────────────────────────────────────────────

/** Huso/SRS de `parcelaConHueco()` (Península, EPSG:25830). */
const SRS_DEMO = 'EPSG:25830'
const HUSO_DEMO = 30

/** Tope nativo de las capas del visor (20, DERIVADO — no escrito a mano aquí). */
const MAX_NATIVO = maxZoomNativo(CAPAS)

/** Vista explícita de ejemplo para la rama 2 de la cascada (Madrid, Puerta del Sol). */
const VISTA_MADRID = Object.freeze({ centro: [40.4169, -3.7036], zoom: 15 })

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
 * Contenedor + tabla listos y registrados para limpieza. Se separa de
 * `abrirVisor` porque los tests de `throw` necesitan el contenedor SIN visor,
 * para poder afirmar que no ha quedado nada montado dentro.
 */
function prepararDOM({ ancho, alto } = {}) {
  const contenedor = crearContenedor({ ancho, alto })
  const tablaEl = document.createElement('table')
  document.body.appendChild(tablaEl)
  pendientes.push(() => {
    contenedor.remove()
    tablaEl.remove()
  })
  return { contenedor, tablaEl }
}

/**
 * Abre un visor completo sobre `parcelaConHueco()` y registra su destrucción.
 *
 * Las cuatro animaciones van desactivadas por el REST de opciones (que
 * `crearVisor` reenvía a `L.map` vía `crearMapa`): son transiciones CSS que
 * jsdom nunca resuelve — la razón está en la cabecera de `_ayuda-jsdom.js`.
 */
function abrirVisor({ parcela = parcelaConHueco(), estado, srs = SRS_DEMO, ...resto } = {}) {
  const { contenedor, tablaEl } = prepararDOM()
  const store = estado || crearEstadoVista(parcela)
  const visor = crearVisor(contenedor, {
    estado: store,
    tablaEl,
    srs,
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    inertia: false,
    ...resto,
  })
  pendientes.push(() => visor.destruir())
  return { contenedor, tablaEl, store, visor, parcela }
}

/** Todos los vértices UTM de todos los recintos de una parcela, aplanados. */
const verticesDe = (parcela) => parcela.recintos.flatMap((recinto) => recinto.vertices)

function marcadoresDe(mapa) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Marker) out.push(capa)
  })
  return out
}

function marcadorDe(mapa, recinto, indice) {
  return (
    marcadoresDe(mapa).find(
      (m) => m.refVertice && m.refVertice.recinto === recinto && m.refVertice.indice === indice,
    ) || null
  )
}

const filasDe = (tablaEl) => [...tablaEl.querySelectorAll('tr[data-indice]')]

function inputXDe(tablaEl, recinto, indice) {
  return tablaEl.querySelector(
    `tr[data-recinto="${recinto}"][data-indice="${indice}"] input[data-eje="x"]`,
  )
}

/** Teclea un valor y termina la edición: `change`, NO `input` (hallazgo C7). */
function cambiarCelda(input, texto) {
  input.value = texto
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * `espiarPeticiones` del arnés (`_ayuda-jsdom.js`) + registro automático de su
 * `restaurar()` en la pila de limpieza de esta suite. El envoltorio de
 * `globalThis.Image` es compartido con `wms-catastro.dom.test.js` y
 * `capas.dom.test.js`; lo único propio de aquí es CUÁNDO se deshace.
 *
 * @returns {ReturnType<typeof espiarPeticiones>}
 */
function espiarPeticionesDeEsteTest() {
  const espia = espiarPeticiones()
  pendientes.push(() => espia.restaurar())
  return espia
}

/**
 * Los argumentos con los que se construyó la ÚLTIMA sincronización. Se lee la
 * última llamada (y no se limpia el espía entre tests) porque cada test abre su
 * propio visor: la última llamada es siempre la suya.
 *
 * @returns {object}
 */
function argumentosDeSincronizar() {
  const llamadas = vi.mocked(sincronizar).mock.calls
  expect(llamadas.length, 'nadie ha llamado a sincronizar').toBeGreaterThan(0)
  return llamadas[llamadas.length - 1][0]
}

/** Los rótulos de acotación que hay pintados DENTRO del contenedor del mapa. */
const cotasDe = (contenedor) => [...contenedor.querySelectorAll(`.${CLASE_ACOTACION}`)]

/** El texto de cada cota, en un Set (el orden de los lados no importa aquí). */
const textosDeCotas = (contenedor) => new Set(cotasDe(contenedor).map((el) => el.textContent))

/**
 * Anillos UTM de una parcela, en la forma en la que viajan por `alPrevisualizar`
 * (un array por recinto). Se DERIVA de la parcela, nunca se copia a mano.
 */
const anillosDe = (parcela) => parcela.recintos.map((recinto) => recinto.vertices)

/**
 * Sustituye `obj.destruir` por una versión que apunta su nombre en `orden` (y
 * ejecuta `antes` justo antes de desmontar de verdad).
 *
 * Funciona porque la pila `deshacer` de `crearVisor` guarda `() => pieza.destruir()`
 * —la propiedad se resuelve EN LA LLAMADA—, y `visor.edicion`/`visor.acotaciones`/
 * `visor.capas` son exactamente esos mismos objetos.
 */
function anotarDestruccion(obj, nombre, orden, antes) {
  const real = obj.destruir.bind(obj)
  obj.destruir = () => {
    orden.push(nombre)
    if (antes) antes()
    real()
  }
}

/** El nodo del cajón del diagnóstico dentro del contenedor del mapa, o `null`. */
const cajonDe = (contenedor) => contenedor.querySelector(`.${CLASE_CAJON.CONTENEDOR}`)

/**
 * Las capas que el contraste ha puesto en el mapa. Se filtran POR PANE y no por
 * clase de Leaflet: el contraste dibuja polígonos y polilíneas —y la capa de
 * edición también—, así que `instanceof L.Polygon` mezclaría las dos. El pane es
 * lo que las distingue de verdad, y además es lo que gobierna el apilado.
 *
 * ⚠️ Y se excluye el RENDERIZADOR: al dibujar el primer trazo en un pane, Leaflet
 * crea un `L.SVG` **para ese pane** y lo añade al mapa como una capa más, así que
 * el filtro por pane lo recogería. No lo pone el contraste y no lo quita
 * `limpiar()`. Ver `test/viewer/contraste.dom.test.js`, donde esto costó siete
 * pruebas en rojo.
 */
function capasDeDiagnostico(mapa) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Renderer) return
    if (capa.options && capa.options.pane === PANE.DIAGNOSTICO) out.push(capa)
  })
  return out
}

/**
 * Un diagnóstico MÍNIMO con la forma que consumen el cajón y la capa. No sale de
 * `diagnosticar()` a propósito: aquí se prueba el ENSAMBLAJE, y hacer pasar los
 * tests del visor por el orquestador los ataría a sus cifras. Lo que se afirma es
 * que lo que entra por `visor.diagnostico` llega a las dos piezas.
 */
function diagnosticoMinimo() {
  return {
    superficie: { medida: 300, catastral: 298, registral: null, oficial: 298 },
    perimetro: { medido: 70, oficial: 70 },
    bandas: { valores: {}, cruces: [] },
    solape: null,
    diferencia: null,
    centroides: null,
    desviacion: null,
    invasion: { consultado: false, invasiones: [], descartadas: [] },
    margen: null,
    omisiones: [],
    saltados: [],
  }
}

/**
 * Un `desviacion` cuyo segmento medido→oficial mide 4 m, DERIVADO del primer
 * vértice de la parcela que se le pase. Cuatro metros y no los 40 cm del caso real
 * porque aquí lo que se prueba es el umbral en píxeles: hace falta un segmento que
 * lo supere holgadamente a cualquier encuadre razonable.
 */
function desviacionDeCuatroMetros(parcela) {
  const [x, y] = parcela.recintos[0].vertices[0]
  const maxima = { recinto: 0, indice: 0, maxima: 4, en: [x, y], enOficial: [x, y + 4] }
  // `maxima` es LA MISMA entrada de `porLado` (identidad, no copia): es el contrato
  // de `diagnostico/desviacion.js` y el fixture no puede contradecirlo.
  return { porLado: [maxima], maxima, nMuestras: 1 }
}

/**
 * Parcela POJO con geometría DEGENERADA. A mano y no con `model/parcela.js`
 * porque el modelo no produciría esto (un recinto exige un anillo de verdad):
 * llega de un GML corrupto cargado por F01 o de un boceto a medias de F06, y el
 * visor no puede reventar ni encuadrar a un zoom absurdo por ello.
 */
function parcelaDegenerada(vertices) {
  return { idLocal: 'degenerada', recintos: [{ vertices }] }
}

// ── EL CONTRATO DE VIEWPORT (hallazgo C5) ────────────────────────────────────

describe('crearVisor · contrato de viewport: nunca un encuadre mudo (hallazgo C5)', () => {
  it('CON GEOMETRÍA encuadra sobre ella: los bounds contienen TODOS los vértices de TODOS los recintos', () => {
    const { visor, parcela } = abrirVisor()
    const bounds = visor.mapa.getBounds()

    // Los ocho vértices (exterior + hueco), no solo los del recinto 0.
    const vertices = verticesDe(parcela)
    expect(vertices.length).toBe(8)
    for (const vertice of vertices) {
      const latlng = L.latLng(vertUTMaLatLng(vertice, HUSO_DEMO))
      expect(bounds.contains(latlng), `vértice [${vertice}] fuera del encuadre`).toBe(true)
    }

    // Y encuadra AJUSTADO, no "España entera": el ancho del encuadre es del
    // orden del de la parcela (~20 m), no de kilómetros.
    const anchoEncuadreM = visor.mapa.distance(bounds.getNorthWest(), bounds.getNorthEast())
    expect(anchoEncuadreM).toBeLessThan(200)
  })

  it('SIN geometría pero CON vistaInicial, aplica ESE centro y ESE zoom', () => {
    const { visor, tablaEl } = abrirVisor({
      estado: crearEstadoVista(null),
      vistaInicial: VISTA_MADRID,
    })

    expect(visor.mapa.getCenter().lat).toBeCloseTo(VISTA_MADRID.centro[0], 9)
    expect(visor.mapa.getCenter().lng).toBeCloseTo(VISTA_MADRID.centro[1], 9)
    expect(visor.mapa.getZoom()).toBe(VISTA_MADRID.zoom)
    // La tabla existe y dice que no hay vértices (no se inventa geometría).
    expect(filasDe(tablaEl)).toHaveLength(0)
    expect(tablaEl.textContent).toContain('Sin vértices')
  })

  it('SIN geometría y SIN vistaInicial LANZA, y el mensaje nombra LAS DOS salidas', () => {
    const { contenedor, tablaEl } = prepararDOM()

    let error = null
    try {
      crearVisor(contenedor, { estado: crearEstadoVista(null), tablaEl, srs: SRS_DEMO })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(TypeError)
    // Las dos salidas, nombradas: si alguien "simplifica" el mensaje, este test
    // salta antes de que nadie descubra el visor mudo en producción.
    expect(error.message).toMatch(/vistaInicial/)
    expect(error.message).toMatch(/geometr/i)
  })

  it('el throw del encuadre NO deja un visor a medio montar (ensamblaje atómico)', () => {
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, { estado: crearEstadoVista(null), tablaEl, srs: SRS_DEMO }),
    ).toThrow()

    // El mapa se monta ANTES de encuadrar, así que sin el desmontaje quedaría un
    // L.Map vivo en el DOM (con sus controles, sus listeners de window y sus
    // imágenes en vuelo) y nadie con una referencia para destruirlo.
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-layers')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-attribution')).toBeNull()
    // Y la tabla, que `sincronizar` ya había construido, queda vacía.
    expect(tablaEl.children).toHaveLength(0)
  })

  it('con geometría Y vistaInicial, MANDA la geometría (precedencia documentada)', () => {
    const { visor, parcela } = abrirVisor({ vistaInicial: VISTA_MADRID })
    const bounds = visor.mapa.getBounds()

    expect(bounds.contains(L.latLng(vertUTMaLatLng(parcela.recintos[0].vertices[0], HUSO_DEMO)))).toBe(
      true,
    )
    expect(bounds.contains(L.latLng(VISTA_MADRID.centro))).toBe(false)
  })

  it('una vistaInicial malformada es contrato roto del programador → TypeError', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    for (const vistaInicial of [
      {},
      { centro: [40.4], zoom: 15 },
      { centro: [40.4, -3.7], zoom: 'quince' },
      { centro: [40.4, -3.7] },
      null,
    ]) {
      expect(() => crearVisor(contenedor, { ...base, vistaInicial })).toThrow(TypeError)
    }
    // Se valida ANTES de montar nada, aunque la geometría fuera a ganar igual.
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
  })
})

// ── Caso degenerado: ni zoom absurdo ni NaN ──────────────────────────────────

describe('crearVisor · geometría degenerada (bounds sin extensión)', () => {
  it('una parcela de UN SOLO vértice no produce zoom absurdo ni NaN', () => {
    const punto = [439250, 4479662.5]
    const { visor } = abrirVisor({ parcela: parcelaDegenerada([punto]) })

    const zoom = visor.mapa.getZoom()
    const centro = visor.mapa.getCenter()

    expect(Number.isFinite(zoom)).toBe(true)
    // Sin tratar el caso, `fitBounds` sobre bounds de extensión cero da una
    // escala infinita y el zoom se pega al maxZoom del mapa (24).
    expect(zoom).toBeLessThan(visor.mapa.getMaxZoom())
    expect(zoom).toBeGreaterThanOrEqual(15)
    expect(zoom).toBeLessThanOrEqual(MAX_NATIVO)

    const [lat, lon] = vertUTMaLatLng(punto, HUSO_DEMO)
    expect(Number.isFinite(centro.lat)).toBe(true)
    expect(Number.isFinite(centro.lng)).toBe(true)
    expect(centro.lat).toBeCloseTo(lat, 9)
    expect(centro.lng).toBeCloseTo(lon, 9)
  })

  it('vértices TODOS COINCIDENTES se tratan igual que un punto', () => {
    const punto = [439250, 4479662.5]
    const { visor } = abrirVisor({ parcela: parcelaDegenerada([punto, punto, punto]) })

    expect(Number.isFinite(visor.mapa.getZoom())).toBe(true)
    expect(visor.mapa.getZoom()).toBeLessThan(visor.mapa.getMaxZoom())
    expect(visor.mapa.getCenter().lat).toBeCloseTo(vertUTMaLatLng(punto, HUSO_DEMO)[0], 9)
  })

  it('geometría degenerada en UN SOLO eje (vértices alineados) sí la encuadra fitBounds', () => {
    // No es un caso "de punto": el eje con extensión manda en la escala, y el
    // encuadre resultante debe contener los tres vértices.
    const alineados = [
      [439240, 4479660],
      [439250, 4479660],
      [439260, 4479660],
    ]
    const { visor } = abrirVisor({ parcela: parcelaDegenerada(alineados) })

    const bounds = visor.mapa.getBounds()
    for (const vertice of alineados) {
      expect(bounds.contains(L.latLng(vertUTMaLatLng(vertice, HUSO_DEMO)))).toBe(true)
    }
    expect(Number.isFinite(visor.mapa.getZoom())).toBe(true)
  })
})

// ── Ensamblaje visto desde fuera (criterio de aceptación 3) ──────────────────

// OJO con el rótulo: aquí NO se prueba el criterio de aceptación 3 («arrastrar un
// marcador actualiza la fila y viceversa, sin bucle») — eso lo prueba
// `sincronizacion.dom.test.js`, y este fichero no lo repite (ver la cabecera).
// Lo que se prueba aquí es que el ENSAMBLAJE deja al visor en un estado del que
// el criterio 3 pueda partir: una base, los panes, y una fila y un marcador por
// vértice.
describe('crearVisor · ensamblaje del visor completo, desde fuera', () => {
  it('ensamblaje completo: base activa, los tres panes, y tabla y marcadores para cada vértice', () => {
    const { visor, tablaEl, parcela } = abrirVisor()

    // Base activa (la del defecto: Ortofoto PNOA) y una sola.
    expect(visor.capas.baseActiva()).toBe(BASE_POR_DEFECTO)
    expect(visor.mapa.hasLayer(visor.capas.bases.get(BASE_POR_DEFECTO))).toBe(true)
    const basesEnMapa = [...visor.capas.bases].filter(([, capa]) => visor.mapa.hasLayer(capa))
    expect(basesEnMapa).toHaveLength(1)

    // Los tres panes del visor (derivados de PANE, no escritos a mano).
    for (const nombre of Object.values(PANE)) {
      expect(visor.mapa.getPane(nombre), `falta el pane «${nombre}»`).toBeTruthy()
    }

    // Una fila por vértice de CADA recinto, y un marcador por vértice.
    const vertices = verticesDe(parcela)
    expect(filasDe(tablaEl)).toHaveLength(vertices.length)
    expect(marcadoresDe(visor.mapa)).toHaveLength(vertices.length)
    expect(tablaEl.querySelectorAll('tbody[data-recinto]')).toHaveLength(parcela.recintos.length)
  })

  it('devuelve EL MISMO store que se le pasó (no crea otro ni lo copia)', () => {
    const store = crearEstadoVista(parcelaConHueco())
    const { visor } = abrirVisor({ estado: store })
    expect(visor.estado).toBe(store)
  })

  it('`capas` es la API de montarCapas: conmutar base y regular la superpuesta', () => {
    const { visor } = abrirVisor()

    visor.capas.activarBase(ID_CAPA.BLANCO)
    expect(visor.capas.baseActiva()).toBe(ID_CAPA.BLANCO)

    expect(visor.capas.superpuestaActiva()).toBe(false)
    visor.capas.activarSuperpuesta(true)
    expect(visor.capas.superpuestaActiva()).toBe(true)
    expect(visor.capas.fijarOpacidad(0.25)).toBe(0.25)
  })

  it('CRITERIO 5: la atribución de la base activa aparece EN EL DOM del contenedor', () => {
    const { contenedor, visor } = abrirVisor()

    const control = contenedor.querySelector('.leaflet-control-attribution')
    expect(control).not.toBeNull()
    // Texto EXACTO de `viewer/atribucion.js` (obligación legal: una paráfrasis
    // sería un incumplimiento de licencia, así que no vale un `toContain('IGN')`).
    expect(control.textContent).toContain(ATRIBUCION.PNOA)

    // Y sigue el juego de Leaflet al conmutar: la del Catastro entra, la del
    // PNOA sale. `crearVisor` no hace NADA activo aquí — es el control nativo.
    visor.capas.activarBase(ID_CAPA.CATASTRO)
    expect(control.textContent).toContain(ATRIBUCION.CATASTRO)
    expect(control.textContent).not.toContain(ATRIBUCION.PNOA)
  })
})

// ── srs → zona ───────────────────────────────────────────────────────────────

describe('crearVisor · traducción srs → zona (geo/huso.js#husoPorSrs)', () => {
  it("con 'EPSG:25830' los vértices caen donde deben (huso 30)", () => {
    const { visor, parcela } = abrirVisor({ srs: 'EPSG:25830' })

    for (let i = 0; i < parcela.recintos[0].vertices.length; i++) {
      const [lat, lon] = vertUTMaLatLng(parcela.recintos[0].vertices[i], 30)
      const marcador = marcadorDe(visor.mapa, 0, i)
      expect(marcador).not.toBeNull()
      expect(marcador.getLatLng().lat).toBeCloseTo(lat, 9)
      expect(marcador.getLatLng().lng).toBeCloseTo(lon, 9)
    }
  })

  it("con 'EPSG:25829' la MISMA geometría cae en otro huso (la zona se usa de verdad)", () => {
    // Si `crearVisor` ignorase el srs y asumiera un huso fijo, este test y el
    // anterior no podrían pasar los dos: las mismas coordenadas UTM en el huso
    // 29 caen ~6° al oeste.
    const parcela = parcelaConHueco()
    const { visor } = abrirVisor({ parcela, srs: 'EPSG:25829' })

    const [lat29, lon29] = vertUTMaLatLng(parcela.recintos[0].vertices[0], 29)
    const marcador = marcadorDe(visor.mapa, 0, 0)
    expect(marcador.getLatLng().lat).toBeCloseTo(lat29, 9)
    expect(marcador.getLatLng().lng).toBeCloseTo(lon29, 9)

    const [, lon30] = vertUTMaLatLng(parcela.recintos[0].vertices[0], 30)
    expect(Math.abs(lon29 - lon30)).toBeGreaterThan(5)
  })

  it('un SRS no soportado lanza RangeError ANTES de montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl }

    // Canarias (EPSG:32628) está DIFERIDA (override O13) y 4326 no es un huso.
    expect(() => crearVisor(contenedor, { ...base, srs: 'EPSG:32628' })).toThrow(RangeError)
    expect(() => crearVisor(contenedor, { ...base, srs: 'EPSG:4326' })).toThrow(RangeError)
    // La forma URI/URN del srsName del GML es de F04, no de aquí.
    expect(() =>
      crearVisor(contenedor, { ...base, srs: 'http://www.opengis.net/def/crs/EPSG/0/25830' }),
    ).toThrow(RangeError)
    // Y sin srs, TypeError (es un string, no un objeto).
    expect(() => crearVisor(contenedor, base)).toThrow(TypeError)

    expect(contenedor.children).toHaveLength(0)
  })
})

// ── Tope de zoom vs. maxNativeZoom de lo montado ─────────────────────────────

describe('crearVisor · el maxZoom del mapa debe superar el zoom nativo de las capas', () => {
  it('un maxZoom insuficiente LANZA RangeError, con el valor que haría falta en el mensaje', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    let error = null
    try {
      crearVisor(contenedor, { ...base, maxZoom: MAX_NATIVO })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(RangeError)
    expect(error.message).toContain('maxZoom')
    expect(error.message).toContain(String(MAX_NATIVO))
    // Nada montado tras el fallo (mismo ensamblaje atómico que el encuadre mudo).
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()

    // Igual de insuficiente por debajo.
    expect(() => crearVisor(contenedor, { ...base, maxZoom: MAX_NATIVO - 5 })).toThrow(RangeError)
  })

  it('el maxZoom por DEFECTO (24, de crearMapa) no lanza y supera el tope nativo', () => {
    const { visor } = abrirVisor()
    expect(visor.mapa.getMaxZoom()).toBeGreaterThan(MAX_NATIVO)
    expect(visor.capas.maxNativeZoom).toBe(MAX_NATIVO)
  })

  it('un maxZoom por encima del tope nativo (21) sí se acepta', () => {
    const { visor } = abrirVisor({ maxZoom: MAX_NATIVO + 1 })
    expect(visor.mapa.getMaxZoom()).toBe(MAX_NATIVO + 1)
  })
})

// ── Propagación de alAvisar (regla de oro 1) ─────────────────────────────────

describe('crearVisor · propaga alAvisar a las DOS mitades (regla de oro 1)', () => {
  it('un fallo de carga de la cartografía WMS llega al alAvisar del VISOR', () => {
    // Mitad «capas»: sin la propagación, el fallo se quedaría en el console.warn
    // por defecto y la UI de avisos no se enteraría nunca.
    const espia = espiarPeticionesDeEsteTest()
    const alAvisar = vi.fn()
    abrirVisor({ alAvisar, baseInicial: ID_CAPA.CATASTRO })

    // Una imagen por encuadre, y del encuadre DEFINITIVO: el encuadre es el
    // último paso del ensamblaje, así que la capa no llega a pedir un encuadre
    // intermedio (criterio de aceptación 2).
    expect(espia.total).toBe(1)
    dispararCarga(espia.imagenes[0], { error: true })

    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toBe(MENSAJES.SIN_CARTOGRAFIA)
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('una celda de coordenada ilegible llega al alAvisar del VISOR', () => {
    // Mitad «sincronización».
    const alAvisar = vi.fn()
    const { tablaEl, store } = abrirVisor({ alAvisar })
    const antes = structuredClone(store.get())

    cambiarCelda(inputXDe(tablaEl, 0, 0), 'no soy un número')

    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
    // Y el modelo, intacto (dato malo del usuario: aviso, no throw ni NaN).
    expect(store.get()).toEqual(antes)
  })

  it('sin alAvisar el visor arranca igual (suelo mínimo: console.warn)', () => {
    const aviso = vi.spyOn(console, 'warn').mockImplementation(() => {})
    pendientes.push(() => aviso.mockRestore())

    const { tablaEl } = abrirVisor()
    cambiarCelda(inputXDe(tablaEl, 0, 0), 'basura')

    expect(aviso).toHaveBeenCalled()
    expect(String(aviso.mock.calls[0][0])).toContain('[visor]')
  })

  it('un alAvisar que no es función es contrato roto → TypeError, sin montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        alAvisar: 'no soy una función',
      }),
    ).toThrow(TypeError)
    expect(contenedor.children).toHaveLength(0)
  })
})

// ── Historial (F06 enchufará undo/redo encima) ───────────────────────────────

describe('crearVisor · propagación del historial', () => {
  it('si viene historial, una edición VÁLIDA commitea una instantánea', () => {
    const historial = crearHistorial()
    const { tablaEl, store } = abrirVisor({ historial })

    cambiarCelda(inputXDe(tablaEl, 0, 1), '439261,25')

    expect(historial.pila).toHaveLength(1)
    expect(historial.pila[0].recintos[0].vertices[1][0]).toBeCloseTo(439261.25, 6)
    expect(store.get().recintos[0].vertices[1][0]).toBeCloseTo(439261.25, 6)
  })

  it('si NO viene historial, la misma edición se aplica y no lanza', () => {
    const { tablaEl, store } = abrirVisor()
    expect(() => cambiarCelda(inputXDe(tablaEl, 0, 1), '439261,25')).not.toThrow()
    expect(store.get().recintos[0].vertices[1][0]).toBeCloseTo(439261.25, 6)
  })
})

// ── destruir() ───────────────────────────────────────────────────────────────

describe('crearVisor · destruir', () => {
  it('deja el contenedor sin mapa y la tabla vacía', () => {
    const { contenedor, tablaEl, visor } = abrirVisor({ superpuestaInicial: true })

    expect(contenedor.querySelector('.leaflet-map-pane')).not.toBeNull()
    expect(filasDe(tablaEl).length).toBeGreaterThan(0)

    visor.destruir()

    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-layers')).toBeNull()
    expect(contenedor.querySelector('.gml-control-opacidad')).toBeNull()
    expect(tablaEl.children).toHaveLength(0)
    // El mapa queda desmontado (mismo contrato de Leaflet que usa mapa.dom.test.js).
    expect(() => visor.mapa.getCenter()).toThrow()
  })

  it('es IDEMPOTENTE: llamarlo dos (y tres) veces no lanza', () => {
    const { visor } = abrirVisor()
    visor.destruir()
    expect(() => visor.destruir()).not.toThrow()
    expect(() => visor.destruir()).not.toThrow()
  })

  it('un estado.set POSTERIOR no lanza ni repinta (la sincronización se dio de baja)', () => {
    const { tablaEl, store, visor } = abrirVisor()
    visor.destruir()

    const otra = parcelaConHueco()
    otra.recintos[0].vertices[0] = [439200, 4479600]
    expect(() => store.set(otra)).not.toThrow()

    // Ni una fila repintada: la tabla sigue vacía y el store guarda el valor.
    expect(tablaEl.children).toHaveLength(0)
    expect(store.get()).toBe(otra)
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// F06 · T4.1 — la opción `edicion`
// ═══════════════════════════════════════════════════════════════════════════

// ── El DEFECTO: el visor de F03, exacto ──────────────────────────────────────

describe('crearVisor · edicion:false (el DEFECTO) es el visor de F03 EXACTO', () => {
  it('no monta nada: visor.edicion y visor.acotaciones valen null, NO undefined', () => {
    const { visor, contenedor } = abrirVisor()

    expect(visor.edicion).toBeNull()
    expect(visor.acotaciones).toBeNull()
    // La diferencia entre «no montado» y «me he olvidado de devolverlo»: las
    // propiedades EXISTEN y valen null. Sin esto, `null` y `undefined` serían
    // indistinguibles para el llamante.
    expect('edicion' in visor).toBe(true)
    expect('acotaciones' in visor).toBe(true)

    // Ni una cota pintada, y el zoom por doble clic INTACTO (lo apaga
    // `crearEdicion`, y un visor de solo lectura no puede perderlo).
    expect(cotasDe(contenedor)).toHaveLength(0)
    expect(visor.mapa.doubleClickZoom.enabled()).toBe(true)
  })

  it('sincronizar recibe los TRES ganchos de F06 en null', () => {
    abrirVisor()
    const args = argumentosDeSincronizar()

    expect(args.ajustar).toBeNull()
    expect(args.alPrevisualizar).toBeNull()
    expect(args.alCrearMarcador).toBeNull()
  })

  it('`edicion: false` explícito se comporta igual que no pasarlo', () => {
    const { visor } = abrirVisor({ edicion: false })
    expect(visor.edicion).toBeNull()
    expect(visor.acotaciones).toBeNull()
    expect(argumentosDeSincronizar().alPrevisualizar).toBeNull()
  })
})

// ── `edicion: true` — las dos piezas montadas y ENCHUFADAS ───────────────────

describe('crearVisor · edicion:true monta las dos piezas y las enchufa', () => {
  it('devuelve las dos piezas, con su API completa', () => {
    const { visor } = abrirVisor({ edicion: true })

    expect(visor.edicion).not.toBeNull()
    expect(visor.acotaciones).not.toBeNull()
    for (const metodo of [
      'ajustar',
      'alCrearMarcador',
      'snapActivo',
      'tolerancia',
      'seleccionarLado',
      'ladoSeleccionado',
      'desplazarSeleccion',
      'insertarEn',
      'eliminar',
      'fijarColindantes',
      'alCambiarSeleccion',
      'destruir',
    ]) {
      expect(typeof visor.edicion[metodo], `falta edicion.${metodo}`).toBe('function')
    }
    expect(typeof visor.acotaciones.pintar).toBe('function')
  })

  it('sincronizar recibe `ajustar` y `alCrearMarcador` DE LA EDICIÓN (las mismas funciones)', () => {
    const { visor } = abrirVisor({ edicion: true })
    const args = argumentosDeSincronizar()

    // Identidad, no "una función cualquiera": si el visor fabricara un envoltorio
    // propio, el snap y el menú de vértice podrían no ser los de esta edición.
    expect(args.ajustar).toBe(visor.edicion.ajustar)
    expect(args.alCrearMarcador).toBe(visor.edicion.alCrearMarcador)
    expect(typeof args.alPrevisualizar).toBe('function')
  })

  it('el alPrevisualizar que recibe sincronizar REPINTA LAS COTAS, con el soloRef del gesto', () => {
    const { visor } = abrirVisor({ edicion: true })
    const pintar = vi.spyOn(visor.acotaciones, 'pintar')

    const anillos = [
      [
        [439240, 4479655],
        [439260, 4479655],
        [439260, 4479670],
      ],
    ]
    const ref = { recinto: 0, indice: 1 }
    argumentosDeSincronizar().alPrevisualizar(anillos, ref)

    // `soloRef` es lo que hace que un arrastre repinte DOS lados y no 500.
    expect(pintar).toHaveBeenCalledTimes(1)
    expect(pintar).toHaveBeenCalledWith(anillos, { soloRef: ref })
  })

  it('las cotas están pintadas de ARRANQUE, con la longitud real de cada lado', () => {
    const { contenedor, parcela } = abrirVisor({ edicion: true })

    // 4 lados del exterior + 4 del hueco (el último de cada anillo es el cierre).
    const lados = parcela.recintos.reduce((n, r) => n + r.vertices.length, 0)
    expect(cotasDe(contenedor)).toHaveLength(lados)

    // El exterior mide 20 × 15 m y el hueco 4 × 4: los textos se DERIVAN de la
    // misma función que los escribe, nunca se copia el formato español a mano.
    const textos = textosDeCotas(contenedor)
    for (const metros of [20, 15, 4]) {
      expect(textos.has(textoDeLongitud(metros)), `falta la cota de ${metros} m`).toBe(true)
    }
    // Y se ven: a este encuadre (parcela de 20 m en 800 px) ningún lado baja del
    // umbral por defecto.
    for (const cota of cotasDe(contenedor)) expect(cota.style.display).not.toBe('none')
  })

  it('el arranque con edición NO deja ni un aviso espurio', () => {
    // Regresión de la coda del ensamblaje: el primer render de `sincronizar`
    // ocurre con el mapa AÚN SIN VISTA, y las cotas miden en píxeles
    // (`latLngToLayerPoint` LANZA sin vista). Si el puente no naciera mudo, cada
    // arranque con edición dejaría el aviso «las medidas en vivo han fallado»,
    // que es ruido indistinguible de un fallo de verdad.
    const alAvisar = vi.fn()
    const { contenedor } = abrirVisor({ edicion: true, alAvisar })

    expect(alAvisar).not.toHaveBeenCalled()
    // Y no es que no haya pintado nada: las cotas están.
    expect(cotasDe(contenedor).length).toBeGreaterThan(0)
  })

  it('arranca SIN geometría (vistaInicial) y las cotas aparecen cuando llega la parcela', () => {
    // El camino real de F05 → F06: el visor se abre vacío sobre una vista
    // explícita y la parcela entra después por el store. El puente tiene que
    // seguir vivo, sin que nadie lo vuelva a enchufar.
    const store = crearEstadoVista(null)
    const { contenedor } = abrirVisor({
      estado: store,
      vistaInicial: VISTA_MADRID,
      edicion: true,
    })
    expect(cotasDe(contenedor)).toHaveLength(0)

    store.set(parcelaConHueco())

    expect(cotasDe(contenedor).length).toBeGreaterThan(0)
    expect(textosDeCotas(contenedor).has(textoDeLongitud(20))).toBe(true)
  })

  it('CON EDICIÓN, el ENCUADRE sigue siendo el último paso: UNA sola petición al WMS', () => {
    // Criterio de aceptación 2 de F03. Montar dos piezas más entre las capas y el
    // encuadre no puede colar una petición del encuadre intermedio, y el
    // repintado posterior de las cotas no mueve el mapa, así que tampoco añade
    // una segunda.
    const espia = espiarPeticionesDeEsteTest()
    abrirVisor({ edicion: true, baseInicial: ID_CAPA.CATASTRO })

    expect(espia.total).toBe(1)
  })
})

// ── Las opciones llegan a quien deben ────────────────────────────────────────

describe('crearVisor · las opciones de `edicion` llegan a su destinatario', () => {
  it('sin opciones, cada pieza usa SU defecto de config/operativos.json', () => {
    const { visor } = abrirVisor({ edicion: true })
    expect(visor.edicion.tolerancia()).toBe(OPERATIVOS.snapMetros)
    expect(visor.edicion.snapActivo()).toBe(true)
  })

  it('`tolerancia` y `snapActivo` llegan a crearEdicion', () => {
    const { visor } = abrirVisor({ edicion: { tolerancia: 1.25, snapActivo: false } })
    expect(visor.edicion.tolerancia()).toBe(1.25)
    expect(visor.edicion.snapActivo()).toBe(false)
  })

  it('`minimoPx` llega a crearAcotaciones (se mide en QUÉ cotas se ven)', () => {
    // El umbral no se puede leer de la API de acotaciones, así que se mide por su
    // efecto, que es lo que importa: con 0 se rotula todo, con un umbral enorme
    // no se rotula nada. Los rótulos siguen existiendo en los dos casos (se
    // ocultan con `display`, no se destruyen).
    const todas = abrirVisor({ edicion: { minimoPx: 0 } })
    expect(cotasDe(todas.contenedor).length).toBeGreaterThan(0)
    for (const cota of cotasDe(todas.contenedor)) expect(cota.style.display).not.toBe('none')

    const ninguna = abrirVisor({ edicion: { minimoPx: 1e6 } })
    expect(cotasDe(ninguna.contenedor).length).toBeGreaterThan(0)
    for (const cota of cotasDe(ninguna.contenedor)) expect(cota.style.display).toBe('none')
  })

  it('una clave DESCONOCIDA en `edicion` es TypeError y no monta nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    let error = null
    try {
      // La errata clásica. Sin esta guarda, el snap usaría los 20 cm por defecto
      // y el usuario vería «engancha mal» sin que nada lo explicara.
      crearVisor(contenedor, { ...base, edicion: { toleracia: 1.25 } })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toContain('toleracia')
    expect(error.message).toContain('tolerancia')
    expect(contenedor.children).toHaveLength(0)
  })

  it('`edicion` que no es booleano ni objeto es TypeError, sin montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    // `null` se rechaza a propósito: sería una cuarta forma de decir "no", y casi
    // siempre es un `?? false` que falta.
    for (const edicion of ['si', 1, null, [], () => {}]) {
      expect(() => crearVisor(contenedor, { ...base, edicion })).toThrow(TypeError)
    }
    expect(contenedor.children).toHaveLength(0)
  })

  it('un `snapActivo` que no es booleano lanza, y no deja la edición montada', () => {
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        edicion: { snapActivo: 'sí' },
      }),
    ).toThrow(TypeError)

    // Se aplica DESPUÉS de apilar el deshacer de la edición, así que el fallo
    // arrastra también a la pieza ya construida.
    expect(contenedor.children).toHaveLength(0)
    expect(document.querySelector(`.${CLASE_ACOTACION}`)).toBeNull()
  })
})

// ── El DOBLE CANAL de alPrevisualizar ────────────────────────────────────────

describe('crearVisor · alPrevisualizar del llamante (canal propio, no una clave de edicion)', () => {
  it('se llama TAMBIÉN con edición montada, y DESPUÉS de repintar las cotas', () => {
    const orden = []
    const alPrevisualizar = vi.fn(() => orden.push('llamante'))
    const { visor } = abrirVisor({ edicion: true, alPrevisualizar })

    // Arranque: exactamente UNA llamada (la del render posterior al encuadre; la
    // del render mudo previo no cuenta), con los anillos del estado y ref null.
    expect(alPrevisualizar).toHaveBeenCalledTimes(1)

    vi.spyOn(visor.acotaciones, 'pintar').mockImplementation(() => orden.push('cotas'))
    orden.length = 0
    argumentosDeSincronizar().alPrevisualizar([[[1, 2]]], null)

    // Las cotas PRIMERO: es el orden que garantiza que un llamante que revienta no
    // se lleve por delante el repintado.
    expect(orden).toEqual(['cotas', 'llamante'])
  })

  it('recibe los anillos UTM del estado y refVertice null en el arranque', () => {
    const alPrevisualizar = vi.fn()
    const { parcela } = abrirVisor({ edicion: true, alPrevisualizar })

    const [anillos, ref] = alPrevisualizar.mock.calls[0]
    expect(anillos).toEqual(anillosDe(parcela))
    expect(ref).toBeNull()
    // COPIA, nunca los arrays del estado (contrato de `sincronizacion.js`).
    expect(anillos[0]).not.toBe(parcela.recintos[0].vertices)
  })

  it('funciona SIN edición montada: son dos cosas distintas', () => {
    const alPrevisualizar = vi.fn()
    const { visor, parcela } = abrirVisor({ alPrevisualizar })

    expect(visor.edicion).toBeNull()
    expect(visor.acotaciones).toBeNull()
    // El gancho que llega a `sincronizar` ya no es `null`: hay un consumidor.
    expect(typeof argumentosDeSincronizar().alPrevisualizar).toBe('function')
    expect(alPrevisualizar).toHaveBeenCalledTimes(1)
    expect(alPrevisualizar.mock.calls[0][0]).toEqual(anillosDe(parcela))
  })

  it('un alPrevisualizar que REVIENTA no tumba el visor ni el repintado de las cotas', () => {
    const alAvisar = vi.fn()
    const alPrevisualizar = vi.fn(() => {
      throw new Error('la ficha del pie ha explotado')
    })
    const { contenedor } = abrirVisor({ edicion: true, alPrevisualizar, alAvisar })

    // Las cotas se han pintado igual (van primero) …
    expect(cotasDe(contenedor).length).toBeGreaterThan(0)
    // … y el fallo NO se ha tragado: lo cuenta la red que `sincronizacion.js` ya
    // pone, UNA vez (aquí no se duplica esa protección).
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('un alPrevisualizar que no es función es contrato roto → TypeError, sin montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        alPrevisualizar: 'no soy una función',
      }),
    ).toThrow(TypeError)
    expect(contenedor.children).toHaveLength(0)
  })
})

// ── ATOMICIDAD del ensamblaje con edición ────────────────────────────────────

describe('crearVisor · si la edición falla a mitad, no queda NADA montado', () => {
  it('un fallo de crearEdicion (tolerancia negativa) deja el contenedor limpio', () => {
    const { contenedor, tablaEl } = prepararDOM()

    let error = null
    try {
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        // Una tolerancia negativa no es una tolerancia: `crearEdicion` lanza. Y lo
        // hace con el mapa, las capas y las acotaciones YA montadas, que es
        // exactamente el punto medio que este test vigila.
        edicion: { tolerancia: -1 },
      })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(RangeError)
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-layers')).toBeNull()
    expect(contenedor.querySelector('.leaflet-control-attribution')).toBeNull()
    expect(contenedor.children).toHaveLength(0)
    // Y las acotaciones, que sí llegaron a montarse, se han desmontado con todo
    // lo demás (si no, quedarían rótulos huérfanos en el documento).
    expect(document.querySelector(`.${CLASE_ACOTACION}`)).toBeNull()
    // La tabla ni siquiera llegó a construirse: `sincronizar` es el paso 4.
    expect(tablaEl.children).toHaveLength(0)
  })

  it('un fallo de crearAcotaciones (minimoPx inválido) deja el contenedor limpio', () => {
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        edicion: { minimoPx: -1 },
      }),
    ).toThrow(TypeError)

    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(contenedor.children).toHaveLength(0)
  })
})

// ── destruir() con edición montada ───────────────────────────────────────────

describe('crearVisor · destruir con edición: orden inverso e idempotencia', () => {
  it('desmonta en ORDEN INVERSO: sincronización → edición → acotaciones → capas → mapa', () => {
    const { contenedor, tablaEl, visor } = abrirVisor({ edicion: true })
    expect(tablaEl.children.length).toBeGreaterThan(0)

    const orden = []
    /** Lo observado en el instante en el que le toca a la EDICIÓN. */
    let alTocarleALaEdicion = null

    anotarDestruccion(visor.edicion, 'edicion', orden, () => {
      alTocarleALaEdicion = {
        // La sincronización ya se ha ido: es la primera de la pila, y lo único
        // que deja como huella es la tabla vaciada.
        tablaYaVacia: tablaEl.children.length === 0,
        // Y el mapa SIGUE EN PIE: `crearEdicion` tiene que poder restaurarle el
        // `doubleClickZoom` y darse de baja de sus eventos.
        mapaAunEnPie: contenedor.querySelector('.leaflet-map-pane') !== null,
      }
    })
    anotarDestruccion(visor.acotaciones, 'acotaciones', orden)
    anotarDestruccion(visor.capas, 'capas', orden)
    const quitarMapa = visor.mapa.remove.bind(visor.mapa)
    visor.mapa.remove = () => {
      orden.push('mapa')
      return quitarMapa()
    }

    visor.destruir()

    expect(orden).toEqual(['edicion', 'acotaciones', 'capas', 'mapa'])
    expect(alTocarleALaEdicion).toEqual({ tablaYaVacia: true, mapaAunEnPie: true })
    expect(contenedor.querySelector('.leaflet-map-pane')).toBeNull()
    expect(cotasDe(contenedor)).toHaveLength(0)
  })

  it('restaura el doubleClickZoom que crearEdicion había apagado', () => {
    const { visor } = abrirVisor({ edicion: true })

    // Mientras la edición vive, el doble clic INSERTA un vértice: ampliar además
    // el mapa con el mismo gesto sería un efecto sorpresa.
    expect(visor.mapa.doubleClickZoom.enabled()).toBe(false)

    // Se mide EN EL INSTANTE del desmontaje del mapa y no después: `Map#remove`
    // deshabilita todos sus handlers, así que preguntarlo al final daría `false`
    // pasara lo que pasara — el test parecería pasar sin probar nada.
    let alQuitarElMapa = null
    const quitarMapa = visor.mapa.remove.bind(visor.mapa)
    visor.mapa.remove = () => {
      alQuitarElMapa = visor.mapa.doubleClickZoom.enabled()
      return quitarMapa()
    }

    visor.destruir()
    expect(alQuitarElMapa).toBe(true)
  })

  it('es IDEMPOTENTE: cada pieza se desmonta UNA sola vez aunque se llame tres', () => {
    const { visor } = abrirVisor({ edicion: true })

    const orden = []
    anotarDestruccion(visor.edicion, 'edicion', orden)
    anotarDestruccion(visor.acotaciones, 'acotaciones', orden)

    visor.destruir()
    expect(() => visor.destruir()).not.toThrow()
    expect(() => visor.destruir()).not.toThrow()

    expect(orden).toEqual(['edicion', 'acotaciones'])
  })

  it('tras destruir, un estado.set no revive ni las cotas ni la edición', () => {
    const { contenedor, store, visor } = abrirVisor({ edicion: true })
    visor.destruir()

    const otra = parcelaConHueco()
    otra.recintos[0].vertices[0] = [439200, 4479600]
    expect(() => store.set(otra)).not.toThrow()

    expect(cotasDe(contenedor)).toHaveLength(0)
    expect(() => visor.edicion.insertarEn({ lat: 40, lng: -3 })).not.toThrow()
    expect(visor.edicion.insertarEn({ lat: 40, lng: -3 }).aplicado).toBe(false)
  })
})

// ── F07 · T4.1 — la opción `diagnostico` ─────────────────────────────────────

describe('crearVisor · diagnostico:false (el DEFECTO) es el visor de antes de F07', () => {
  it('no monta nada: visor.diagnostico vale null, NO undefined', () => {
    const { visor, contenedor } = abrirVisor()

    expect(visor.diagnostico).toBeNull()
    // Misma distinción que con `edicion`: la propiedad EXISTE y vale null, así que
    // «no montado» y «se me ha olvidado devolverlo» no se confunden.
    expect('diagnostico' in visor).toBe(true)

    expect(cajonDe(contenedor)).toBeNull()
    expect(capasDeDiagnostico(visor.mapa)).toHaveLength(0)
  })

  it('`diagnostico: false` explícito se comporta igual que no pasarlo', () => {
    const { visor, contenedor } = abrirVisor({ diagnostico: false })
    expect(visor.diagnostico).toBeNull()
    expect(cajonDe(contenedor)).toBeNull()
  })

  it('el pane del diagnóstico EXISTE igualmente: lo crea el mapa, no la opción', () => {
    // Un pane vacío no cuesta nada y `crearMapa` los crea todos iterando `PANES`.
    // Se afirma para que quede claro que «hay pane» no significa «hay diagnóstico»
    // — el discriminante de `capasDeDiagnostico` no valdría nada si lo fuera.
    const { visor } = abrirVisor()
    expect(visor.mapa.getPane(PANE.DIAGNOSTICO)).toBeTruthy()
    expect(capasDeDiagnostico(visor.mapa)).toHaveLength(0)
  })
})

describe('crearVisor · diagnostico:true monta las dos piezas, INERTES', () => {
  it('devuelve las dos juntas, con su API completa', () => {
    const { visor } = abrirVisor({ diagnostico: true })

    expect(visor.diagnostico).not.toBeNull()
    for (const metodo of [
      'pintar',
      'abrir',
      'cerrar',
      'abierto',
      'registral',
      'clase',
      'estado',
      'alCambiar',
      'alCerrar',
      'destruir',
    ]) {
      expect(typeof visor.diagnostico.cajon[metodo], `falta cajon.${metodo}`).toBe('function')
    }
    for (const metodo of ['pintar', 'limpiar', 'destruir']) {
      expect(typeof visor.diagnostico.contraste[metodo], `falta contraste.${metodo}`).toBe(
        'function',
      )
    }
  })

  it('el cajón está en el DOM pero CERRADO, y la capa vacía: montar no es diagnosticar', () => {
    const { visor, contenedor } = abrirVisor({ diagnostico: true })

    const cajon = cajonDe(contenedor)
    expect(cajon).not.toBeNull()
    // Los nodos del CONTRATO con `app/cableado-diagnostico.js` ya están, que es la
    // razón de montarlo aquí y no en la app: cuando `crearVisor` devuelve, el
    // cableado puede resolverlos por selector.
    for (const selector of Object.values(SELECTOR_CAJON)) {
      expect(cajon.querySelector(selector), `falta ${selector}`).not.toBeNull()
    }

    // Y sin embargo NO se ve, ni hay nada pintado sobre el mapa. Un visor que se
    // abriera solo taparía el mapa con un cajón que nadie ha pedido.
    expect(visor.diagnostico.cajon.abierto()).toBe(false)
    expect(cajon.style.display).toBe('none')
    expect(capasDeDiagnostico(visor.mapa)).toHaveLength(0)
  })

  it('el arranque con diagnóstico NO deja ni un aviso espurio', () => {
    // Regresión del paso 5: el contraste se suscribe a `zoomend moveend` con el
    // mapa AÚN SIN VISTA, y el encuadre del paso 6 dispara los dos. Si su repintado
    // no saliera por la puerta de atrás mientras no le han pintado nada, mediría en
    // píxeles sobre un mapa sin vista y avisaría en CADA arranque.
    const alAvisar = vi.fn()
    abrirVisor({ diagnostico: true, alAvisar })
    expect(alAvisar).not.toHaveBeenCalled()
  })

  it('CON DIAGNÓSTICO, el ENCUADRE sigue siendo el último paso: UNA sola petición al WMS', () => {
    const espia = espiarPeticionesDeEsteTest()
    abrirVisor({ diagnostico: true, baseInicial: ID_CAPA.CATASTRO })
    expect(espia.total).toBe(1)
  })

  it('lo que se pinta por `visor.diagnostico` llega a las DOS piezas', () => {
    const { visor, contenedor, parcela } = abrirVisor({ diagnostico: true })
    const { cajon, contraste } = visor.diagnostico

    cajon.abrir()
    cajon.pintar(diagnosticoMinimo())
    contraste.pintar(diagnosticoMinimo(), {
      recintos: parcela.recintos,
      geometriaOficial: parcela.recintos,
    })

    expect(cajonDe(contenedor).style.display).not.toBe('none')
    expect(cajonDe(contenedor).querySelector(SELECTOR_CAJON.TITULAR).textContent).toContain('300')
    // La diferencia simétrica es UN polígono con los anillos de las dos geometrías
    // (`fillRule:'evenodd'`), así que aquí hay capa aunque las dos coincidan.
    expect(capasDeDiagnostico(visor.mapa).length).toBeGreaterThan(0)
  })
})

describe('crearVisor · las opciones de `diagnostico` llegan a su destinatario', () => {
  it('sin opciones, el cajón va a la ÚNICA esquina libre (bottomleft)', () => {
    const { visor, contenedor } = abrirVisor({ diagnostico: true })
    expect(visor.diagnostico.cajon.control.getPosition()).toBe('bottomleft')
    // Y de verdad cuelga de esa esquina del mapa, no de cualquier sitio del DOM.
    expect(
      contenedor
        .querySelector('.leaflet-bottom.leaflet-left')
        .querySelector(`.${CLASE_CAJON.CONTENEDOR}`),
    ).not.toBeNull()
  })

  it('`posicion` llega a crearCajonDiagnostico', () => {
    const { visor, contenedor } = abrirVisor({ diagnostico: { posicion: 'topright' } })
    expect(visor.diagnostico.cajon.control.getPosition()).toBe('topright')
    expect(
      contenedor
        .querySelector('.leaflet-top.leaflet-right')
        .querySelector(`.${CLASE_CAJON.CONTENEDOR}`),
    ).not.toBeNull()
  })

  it('`minimoPx` llega a crearContraste (se mide en si la cota se rotula o no)', () => {
    // Mismo criterio que con `edicion.minimoPx`: el umbral no se puede leer de la
    // API, así que se mide por su efecto. Con 0 se rotula la cota de la desviación
    // máxima; con un umbral enorme, no. En los dos casos el resalte del lado SÍ se
    // dibuja: lo que el umbral filtra es el RÓTULO, no el hallazgo.
    // El rótulo es un `L.divIcon` sobre un marcador (mismo recurso que las cotas
    // de F06); la línea guía y el resalte son polilíneas.
    const rotulosDe = (mapa) => capasDeDiagnostico(mapa).filter((capa) => capa instanceof L.Marker)

    const conRotulo = abrirVisor({ diagnostico: { minimoPx: 0 } })
    conRotulo.visor.diagnostico.contraste.pintar(
      { ...diagnosticoMinimo(), desviacion: desviacionDeCuatroMetros(conRotulo.parcela) },
      { recintos: conRotulo.parcela.recintos, geometriaOficial: null },
    )

    const sinRotulo = abrirVisor({ diagnostico: { minimoPx: 1e6 } })
    sinRotulo.visor.diagnostico.contraste.pintar(
      { ...diagnosticoMinimo(), desviacion: desviacionDeCuatroMetros(sinRotulo.parcela) },
      { recintos: sinRotulo.parcela.recintos, geometriaOficial: null },
    )

    expect(rotulosDe(conRotulo.visor.mapa)).toHaveLength(1)
    expect(rotulosDe(sinRotulo.visor.mapa)).toHaveLength(0)
    // El hallazgo se sigue señalando en el mapa en los dos casos.
    expect(capasDeDiagnostico(sinRotulo.visor.mapa).length).toBeGreaterThan(0)
  })

  it('una clave DESCONOCIDA en `diagnostico` es TypeError y no monta nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    let error = null
    try {
      crearVisor(contenedor, { ...base, diagnostico: { posicón: 'topright' } })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toContain('posicón')
    expect(error.message).toContain('posicion')
    // Y el mensaje nombra la vía correcta para lo que la lista cerrada excluye.
    expect(error.message).toContain('colindantes')
    expect(contenedor.children).toHaveLength(0)
  })

  it('`diagnostico` que no es booleano ni objeto es TypeError, sin montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    for (const diagnostico of ['si', 1, null, [], () => {}]) {
      expect(() => crearVisor(contenedor, { ...base, diagnostico })).toThrow(TypeError)
    }
    expect(contenedor.children).toHaveLength(0)
  })

  it('una `posicion` que no es esquina de Leaflet lanza, y no deja el cajón montado', () => {
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        diagnostico: { posicion: 'centro' },
      }),
    ).toThrow(RangeError)

    expect(contenedor.children).toHaveLength(0)
    expect(document.querySelector(`.${CLASE_CAJON.CONTENEDOR}`)).toBeNull()
  })

  it('un fallo del contraste (minimoPx negativo) arrastra al cajón YA montado', () => {
    // El punto medio que este test vigila: el cajón se monta primero, así que
    // cuando `crearContraste` lanza hay un control vivo en el mapa. O cae todo, o
    // queda un cajón huérfano en un contenedor que el llamante cree vacío.
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        diagnostico: { minimoPx: -1 },
      }),
    ).toThrow(TypeError)

    expect(contenedor.children).toHaveLength(0)
    expect(document.querySelector(`.${CLASE_CAJON.CONTENEDOR}`)).toBeNull()
  })
})

describe('crearVisor · `edicion` y `diagnostico` son INDEPENDIENTES', () => {
  it('las dos a la vez: es el caso NORMAL de F07, no una combinación exótica', () => {
    // El JSDoc de `edicion` llegó a decir que «el diagnóstico de F07» era un visor
    // de solo lectura. Era falso, y este test es lo que impide que vuelva a serlo:
    // se diagnostica SOBRE la parcela que se está editando.
    const { visor, contenedor } = abrirVisor({ edicion: true, diagnostico: true })

    expect(visor.edicion).not.toBeNull()
    expect(visor.diagnostico).not.toBeNull()
    expect(cajonDe(contenedor)).not.toBeNull()
    expect(cotasDe(contenedor).length).toBeGreaterThan(0)
    // `topleft` sigue teniendo cromo (el control de zoom). Lo tenía también la
    // barra de edición hasta el 2026-08-05, cuando se fue al centro del borde
    // inferior porque apilarse bajo el zoom era justo lo que se quería quitar;
    // el cajón sigue abajo a la izquierda y ninguno de los tres se pisa.
    expect(contenedor.querySelector('.leaflet-top.leaflet-left').children.length).toBeGreaterThan(0)
  })

  it('diagnóstico SIN edición: un visor de solo lectura que sí diagnostica', () => {
    const { visor } = abrirVisor({ diagnostico: true })
    expect(visor.edicion).toBeNull()
    expect(visor.diagnostico).not.toBeNull()
    // Y conserva el zoom por doble clic, que es lo que `crearEdicion` apaga.
    expect(visor.mapa.doubleClickZoom.enabled()).toBe(true)
  })

  it('el diagnóstico NO le pone ganchos a sincronizar (por eso va DESPUÉS)', () => {
    // Es la justificación del orden del paso 5, afirmada: si algún día el
    // diagnóstico necesitara medir durante el arrastre, este test caería y con él
    // el motivo escrito en la cabecera.
    abrirVisor({ diagnostico: true })
    const args = argumentosDeSincronizar()

    expect(args.ajustar).toBeNull()
    expect(args.alPrevisualizar).toBeNull()
    expect(args.alCrearMarcador).toBeNull()
  })
})

describe('crearVisor · destruir con diagnóstico', () => {
  it('el diagnóstico es el PRIMERO en caer, con el mapa todavía en pie', () => {
    const { contenedor, visor } = abrirVisor({ edicion: true, diagnostico: true })

    const orden = []
    let alTocarleAlContraste = null

    anotarDestruccion(visor.diagnostico.contraste, 'contraste', orden, () => {
      alTocarleAlContraste = {
        mapaAunEnPie: contenedor.querySelector('.leaflet-map-pane') !== null,
        cajonAunPuesto: cajonDe(contenedor) !== null,
      }
    })
    anotarDestruccion(visor.diagnostico.cajon, 'cajon', orden)
    anotarDestruccion(visor.edicion, 'edicion', orden)
    anotarDestruccion(visor.acotaciones, 'acotaciones', orden)
    anotarDestruccion(visor.capas, 'capas', orden)

    visor.destruir()

    // Dentro del bloque de F07 el orden también es el inverso del montaje: primero
    // el contraste (el último apilado), luego el cajón.
    expect(orden).toEqual(['contraste', 'cajon', 'edicion', 'acotaciones', 'capas'])
    expect(alTocarleAlContraste).toEqual({ mapaAunEnPie: true, cajonAunPuesto: true })
    expect(cajonDe(contenedor)).toBeNull()
    expect(contenedor.children).toHaveLength(0)
  })

  it('tras destruir no queda ni el cajón ni una capa del contraste', () => {
    const { visor, contenedor, parcela } = abrirVisor({ diagnostico: true })
    visor.diagnostico.cajon.abrir()
    visor.diagnostico.contraste.pintar(diagnosticoMinimo(), {
      recintos: parcela.recintos,
      geometriaOficial: parcela.recintos,
    })
    expect(capasDeDiagnostico(visor.mapa).length).toBeGreaterThan(0)

    visor.destruir()

    expect(cajonDe(contenedor)).toBeNull()
    expect(document.querySelector(`.${CLASE_CAJON.CONTENEDOR}`)).toBeNull()
  })

  it('es IDEMPOTENTE: cada pieza del diagnóstico se desmonta UNA sola vez', () => {
    const { visor } = abrirVisor({ diagnostico: true })

    const orden = []
    anotarDestruccion(visor.diagnostico.contraste, 'contraste', orden)
    anotarDestruccion(visor.diagnostico.cajon, 'cajon', orden)

    visor.destruir()
    expect(() => visor.destruir()).not.toThrow()
    expect(() => visor.destruir()).not.toThrow()

    expect(orden).toEqual(['contraste', 'cajon'])
  })
})

// ── F08 · T3.1 — la opción `comprobacion` ────────────────────────────────────
//
// Mismo reparto que con `edicion` y `diagnostico`: lo que la PIEZA hace vive en
// `test/viewer/cajon-comprobacion.dom.test.js`; aquí solo lo que existe cuando
// está ENSAMBLADA — que el defecto no cuesta nada, que la opción llega a su
// destinatario, que comparte esquina con el cajón de F07 sin pelearse, y que el
// desmontaje sigue siendo atómico y en orden inverso.

/** El nodo del cajón de COMPROBACIÓN dentro del contenedor del mapa, o `null`. */
const cajonComprobacionDe = (contenedor) =>
  contenedor.querySelector(`.${CLASE_COMPROBACION.CONTENEDOR}`)

describe('crearVisor · comprobacion:false (el DEFECTO) es el visor de antes de F08', () => {
  it('no monta nada: visor.comprobacion vale null, NO undefined', () => {
    const { visor, contenedor } = abrirVisor()

    expect(visor.comprobacion).toBeNull()
    // Misma distinción que con `edicion` y `diagnostico`: la propiedad EXISTE y
    // vale null, así que «no montado» y «se me ha olvidado devolverlo» no se
    // confunden.
    expect('comprobacion' in visor).toBe(true)
    expect(cajonComprobacionDe(contenedor)).toBeNull()
  })

  it('`comprobacion: false` explícito se comporta igual que no pasarlo', () => {
    const { visor, contenedor } = abrirVisor({ comprobacion: false })
    expect(visor.comprobacion).toBeNull()
    expect(cajonComprobacionDe(contenedor)).toBeNull()
  })

  it('con diagnóstico y SIN comprobación, la esquina compartida solo lleva un cajón', () => {
    // Es la mitad que garantiza que F08 no le cobra un solo nodo al visor de F07:
    // sus pruebas siguen intactas porque el DOM que ven es el mismo.
    const { contenedor } = abrirVisor({ diagnostico: true })
    const esquina = contenedor.querySelector('.leaflet-bottom.leaflet-left')
    expect(esquina.querySelectorAll(`.${CLASE_CAJON.CONTENEDOR}`)).toHaveLength(1)
    expect(esquina.querySelectorAll(`.${CLASE_COMPROBACION.CONTENEDOR}`)).toHaveLength(0)
  })
})

describe('crearVisor · comprobacion:true monta el cajón, INERTE', () => {
  it('devuelve la pieza SUELTA (no envuelta), con su API completa', () => {
    // Va suelta y no en `{cajon}` como `diagnostico`: F07 son DOS piezas
    // inseparables, F08 es UNA. Envolverla por simetría obligaría a todos sus
    // llamantes a escribir `.cajon` por una hermandad que no existe.
    const { visor } = abrirVisor({ comprobacion: true })

    expect(visor.comprobacion).not.toBeNull()
    for (const metodo of [
      'pintar',
      'abrir',
      'cerrar',
      'abierto',
      'elegido',
      'puedeContrastar',
      'estado',
      'alElegir',
      'alContrastar',
      'alDescartar',
      'destruir',
    ]) {
      expect(typeof visor.comprobacion[metodo], `falta comprobacion.${metodo}`).toBe('function')
    }
  })

  it('el cajón está en el DOM pero CERRADO y en blanco: montar no es comprobar', () => {
    const { visor, contenedor } = abrirVisor({ comprobacion: true })

    const cajon = cajonComprobacionDe(contenedor)
    expect(cajon).not.toBeNull()
    // Los nodos del CONTRATO con el cableado ya están, que es la razón de montarlo
    // aquí y no en la app: cuando `crearVisor` devuelve, se pueden resolver por
    // selector.
    for (const selector of Object.values(SELECTOR_COMPROBACION)) {
      expect(cajon.querySelector(selector), `falta ${selector}`).not.toBeNull()
    }

    expect(visor.comprobacion.abierto()).toBe(false)
    expect(cajon.style.display).toBe('none')
    // Y sin fichero no hay nada que contrastar: el botón primario nace apagado.
    expect(visor.comprobacion.puedeContrastar()).toBe(false)
  })

  it('el arranque con comprobación NO deja ni un aviso espurio', () => {
    const alAvisar = vi.fn()
    abrirVisor({ comprobacion: true, alAvisar })
    expect(alAvisar).not.toHaveBeenCalled()
  })

  it('CON COMPROBACIÓN, el ENCUADRE sigue siendo el último paso: UNA sola petición al WMS', () => {
    const espia = espiarPeticionesDeEsteTest()
    abrirVisor({ comprobacion: true, baseInicial: ID_CAPA.CATASTRO })
    expect(espia.total).toBe(1)
  })

  it('no le pone ganchos a sincronizar (por eso puede ir al final del montaje)', () => {
    abrirVisor({ comprobacion: true })
    const args = argumentosDeSincronizar()

    expect(args.ajustar).toBeNull()
    expect(args.alPrevisualizar).toBeNull()
    expect(args.alCrearMarcador).toBeNull()
  })
})

describe('crearVisor · las opciones de `comprobacion` llegan a su destinatario', () => {
  it('sin opciones, el cajón va a `bottomleft` — la esquina que comparte con F07', () => {
    const { visor, contenedor } = abrirVisor({ comprobacion: true })
    expect(visor.comprobacion.control.getPosition()).toBe('bottomleft')
    expect(
      contenedor
        .querySelector('.leaflet-bottom.leaflet-left')
        .querySelector(`.${CLASE_COMPROBACION.CONTENEDOR}`),
    ).not.toBeNull()
  })

  it('`posicion` llega a crearCajonComprobacion', () => {
    const { visor, contenedor } = abrirVisor({ comprobacion: { posicion: 'topright' } })
    expect(visor.comprobacion.control.getPosition()).toBe('topright')
    expect(
      contenedor
        .querySelector('.leaflet-top.leaflet-right')
        .querySelector(`.${CLASE_COMPROBACION.CONTENEDOR}`),
    ).not.toBeNull()
  })

  it('una clave DESCONOCIDA es TypeError, y el mensaje nombra la vía correcta', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    let error = null
    try {
      crearVisor(contenedor, { ...base, comprobacion: { posicón: 'topright' } })
    } catch (e) {
      error = e
    }

    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toContain('posicón')
    expect(error.message).toContain('posicion')
    expect(error.message).toContain('comprobarGml')
    expect(contenedor.children).toHaveLength(0)
  })

  it('`comprobacion` que no es booleano ni objeto es TypeError, sin montar nada', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    for (const comprobacion of ['si', 1, null, [], () => {}]) {
      expect(() => crearVisor(contenedor, { ...base, comprobacion })).toThrow(TypeError)
    }
    expect(contenedor.children).toHaveLength(0)
  })

  it('una `posicion` que no es esquina de Leaflet lanza y NO deja nada montado', () => {
    // El cajón de comprobación es el ÚLTIMO en montarse, así que cuando lanza hay un
    // visor entero vivo detrás. O cae todo, o el llamante se queda con un mapa que
    // cree que no existe.
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        diagnostico: true,
        comprobacion: { posicion: 'centro' },
      }),
    ).toThrow(RangeError)

    expect(contenedor.children).toHaveLength(0)
    expect(document.querySelector(`.${CLASE_COMPROBACION.CONTENEDOR}`)).toBeNull()
    expect(document.querySelector(`.${CLASE_CAJON.CONTENEDOR}`)).toBeNull()
  })
})

describe('crearVisor · las TRES opciones conviven', () => {
  it('edición, diagnóstico y comprobación a la vez: es el visor de F08 completo', () => {
    const { visor, contenedor } = abrirVisor({
      edicion: true,
      diagnostico: true,
      comprobacion: true,
    })

    expect(visor.edicion).not.toBeNull()
    expect(visor.diagnostico).not.toBeNull()
    expect(visor.comprobacion).not.toBeNull()

    // Los dos cajones caben en la MISMA esquina: Leaflet los apila y ninguno pisa al
    // otro. Que no se abran a la vez es del cableado, no del visor.
    const esquina = contenedor.querySelector('.leaflet-bottom.leaflet-left')
    expect(esquina.querySelectorAll(`.${CLASE_CAJON.CONTENEDOR}`)).toHaveLength(1)
    expect(esquina.querySelectorAll(`.${CLASE_COMPROBACION.CONTENEDOR}`)).toHaveLength(1)
    // Y la barra de edición sigue arriba a la izquierda, sin pelearse con nadie.
    expect(contenedor.querySelector('.leaflet-top.leaflet-left').children.length).toBeGreaterThan(0)
  })

  it('comprobación SIN diagnóstico: la esquina es suya sola', () => {
    const { visor, contenedor } = abrirVisor({ comprobacion: true })
    expect(visor.diagnostico).toBeNull()
    const esquina = contenedor.querySelector('.leaflet-bottom.leaflet-left')
    expect(esquina.querySelectorAll(`.${CLASE_CAJON.CONTENEDOR}`)).toHaveLength(0)
    expect(esquina.querySelectorAll(`.${CLASE_COMPROBACION.CONTENEDOR}`)).toHaveLength(1)
  })

  it('los dos cajones son independientes: abrir uno no toca al otro', () => {
    // El visor NO coordina la exclusión mutua, y este test lo fija: si algún día
    // alguien la implementa aquí, cae — y tiene que caer, porque quien sabe en qué
    // punto del recorrido está la aplicación es el cableado, no el ensamblador.
    const { visor } = abrirVisor({ diagnostico: true, comprobacion: true })

    visor.comprobacion.abrir()
    expect(visor.comprobacion.abierto()).toBe(true)
    expect(visor.diagnostico.cajon.abierto()).toBe(false)

    visor.diagnostico.cajon.abrir()
    expect(visor.diagnostico.cajon.abierto()).toBe(true)
    expect(visor.comprobacion.abierto()).toBe(true)
  })
})

describe('crearVisor · destruir con comprobación', () => {
  it('la comprobación es la PRIMERA en caer, con el mapa todavía en pie', () => {
    const { contenedor, visor } = abrirVisor({
      edicion: true,
      diagnostico: true,
      comprobacion: true,
    })

    const orden = []
    let alTocarleALaComprobacion = null

    anotarDestruccion(visor.comprobacion, 'comprobacion', orden, () => {
      alTocarleALaComprobacion = {
        mapaAunEnPie: contenedor.querySelector('.leaflet-map-pane') !== null,
        cajonDeF07AunPuesto: cajonDe(contenedor) !== null,
      }
    })
    anotarDestruccion(visor.diagnostico.contraste, 'contraste', orden)
    anotarDestruccion(visor.diagnostico.cajon, 'cajon', orden)
    anotarDestruccion(visor.edicion, 'edicion', orden)
    anotarDestruccion(visor.capas, 'capas', orden)

    visor.destruir()

    // Orden inverso EXACTO al del montaje: la comprobación es lo último que se
    // apila, así que es lo primero que se desapila.
    expect(orden).toEqual(['comprobacion', 'contraste', 'cajon', 'edicion', 'capas'])
    expect(alTocarleALaComprobacion).toEqual({ mapaAunEnPie: true, cajonDeF07AunPuesto: true })
    expect(cajonComprobacionDe(contenedor)).toBeNull()
    expect(contenedor.children).toHaveLength(0)
  })

  it('tras destruir no queda el cajón, ni aunque estuviera abierto', () => {
    const { visor, contenedor } = abrirVisor({ comprobacion: true })
    visor.comprobacion.abrir()

    visor.destruir()

    expect(cajonComprobacionDe(contenedor)).toBeNull()
    expect(document.querySelector(`.${CLASE_COMPROBACION.CONTENEDOR}`)).toBeNull()
  })

  it('es IDEMPOTENTE: el cajón se desmonta UNA sola vez', () => {
    const { visor } = abrirVisor({ comprobacion: true })

    const orden = []
    anotarDestruccion(visor.comprobacion, 'comprobacion', orden)

    visor.destruir()
    expect(() => visor.destruir()).not.toThrow()
    expect(() => visor.destruir()).not.toThrow()

    expect(orden).toEqual(['comprobacion'])
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// EL REENCUADRE VIVO — el mapa sigue a la parcela, pero no persigue al editor
// ═══════════════════════════════════════════════════════════════════════════
//
// Defecto REAL de F05, encontrado en la revisión visual de F08: `encuadrar()` se
// llamaba UNA sola vez, al construir el visor, y no había ninguna forma de volver
// a encuadrar. Se traía una parcela de Sevilla por referencia catastral —o se
// soltaba un GML de Cádiz— y el mapa seguía mirando la parcela de demostración.

/** Dos referencias catastrales reales distintas (mismo polígono, otra parcela). */
const REF_A = '9398516VK3799G'
const REF_B = '9398501VK3799G'

/**
 * `parcelaConHueco()` con la identidad y el desplazamiento que se le pidan. Se
 * DERIVA del arnés (nunca se copian vértices a mano) para que un cambio en la
 * parcela de demo no deje estos tests midiendo otra geometría.
 *
 * @param {object} [opciones]
 * @param {string|null} [opciones.refcat]   Referencia catastral (`null` = ninguna).
 * @param {string} [opciones.idLocal]        Identificador local.
 * @param {number} [opciones.dx]             Desplazamiento Este, en metros.
 * @param {number} [opciones.dy]             Desplazamiento Norte, en metros.
 */
function parcelaComo({ refcat = null, idLocal, dx = 0, dy = 0 } = {}) {
  const base = parcelaConHueco()
  return {
    ...base,
    refcat,
    idLocal: idLocal ?? base.idLocal,
    recintos: base.recintos.map((recinto) => ({
      ...recinto,
      vertices: recinto.vertices.map(([x, y]) => [x + dx, y + dy]),
    })),
  }
}

/** La vista actual, en una forma comparable con `toEqual` (sin objetos LatLng). */
const vistaDe = (mapa) => ({
  lat: mapa.getCenter().lat,
  lng: mapa.getCenter().lng,
  zoom: mapa.getZoom(),
})

/** ¿El encuadre contiene TODOS los vértices de la parcela? */
function encuadraA(mapa, parcela) {
  const bounds = mapa.getBounds()
  return verticesDe(parcela).every((v) => bounds.contains(L.latLng(vertUTMaLatLng(v, HUSO_DEMO))))
}

describe('crearVisor · reencuadre automático: solo cuando entra una parcela DISTINTA', () => {
  it('LA PRUEBA QUE MANDA: la MISMA parcela con los vértices movidos NO mueve la vista', () => {
    // Es lo que hace usable F06. `edit/` reconstruye el POJO en cada operación, así
    // que comparar la identidad del OBJETO diría «otra parcela» en cada frame de un
    // arrastre y el mapa se recentraría bajo el puntero: el vértice se escaparía de
    // la mano. Por eso la identidad es `refcat ?? idLocal`, no la referencia.
    const parcela = parcelaComo({ refcat: REF_A })
    const { visor, store } = abrirVisor({ parcela })
    const antes = vistaDe(visor.mapa)

    // Un arrastre de 40 m —enorme para una parcela de 20— sobre la MISMA parcela.
    store.set(parcelaComo({ refcat: REF_A, dx: 40, dy: 40 }))

    expect(vistaDe(visor.mapa)).toEqual(antes)
  })

  it('ni siquiera con veinte ediciones seguidas: la vista no se mueve NI UN PÍXEL', () => {
    const { visor, store } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })
    const antes = vistaDe(visor.mapa)

    for (let i = 1; i <= 20; i++) store.set(parcelaComo({ refcat: REF_A, dx: i, dy: i }))

    expect(vistaDe(visor.mapa)).toEqual(antes)
  })

  it('una parcela con OTRA refcat SÍ mueve la vista, y encuadra sobre ella', () => {
    const { visor, store } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })
    const antes = vistaDe(visor.mapa)

    // 500 m: lo bastante lejos como para que el encuadre viejo no la contenga.
    const otra = parcelaComo({ refcat: REF_B, dx: 500, dy: 500 })
    store.set(otra)

    expect(vistaDe(visor.mapa)).not.toEqual(antes)
    expect(encuadraA(visor.mapa, otra), 'la parcela nueva no ha quedado encuadrada').toBe(true)
    // Y ajustado, no «Andalucía entera»: sigue siendo un encuadre de parcela.
    const bounds = visor.mapa.getBounds()
    expect(visor.mapa.distance(bounds.getNorthWest(), bounds.getNorthEast())).toBeLessThan(200)
  })

  it('sin refcat, manda el `idLocal`: otro idLocal mueve, el mismo no', () => {
    // Es el caso de un DXF, un TXT o un GML ajeno sin referencia: la parcela no
    // deja de tener identidad por no venir del Catastro.
    const { visor, store } = abrirVisor({ parcela: parcelaComo({ idLocal: 'expediente-1' }) })
    const antes = vistaDe(visor.mapa)

    store.set(parcelaComo({ idLocal: 'expediente-1', dx: 40, dy: 40 }))
    expect(vistaDe(visor.mapa)).toEqual(antes)

    store.set(parcelaComo({ idLocal: 'expediente-2', dx: 500, dy: 500 }))
    expect(vistaDe(visor.mapa)).not.toEqual(antes)
  })

  it('la refcat MANDA sobre el idLocal: misma refcat con otro idLocal no mueve nada', () => {
    // Mismo orden de precedencia que `app/cableado-diagnostico.js#claveDeExpediente`.
    // La referencia catastral identifica la parcela; el `idLocal` es el respaldo.
    const { visor, store } = abrirVisor({
      parcela: parcelaComo({ refcat: REF_A, idLocal: 'expediente-1' }),
    })
    const antes = vistaDe(visor.mapa)

    store.set(parcelaComo({ refcat: REF_A, idLocal: 'expediente-2', dx: 40, dy: 40 }))

    expect(vistaDe(visor.mapa)).toEqual(antes)
  })

  it('el CASO DEGENERADO también al reencuadrar: un vértice no da un zoom absurdo', () => {
    const { visor, store } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })

    const punto = [439900, 4480200]
    store.set({ ...parcelaDegenerada([punto]), refcat: REF_B })

    const zoom = visor.mapa.getZoom()
    expect(Number.isFinite(zoom)).toBe(true)
    // Sin tratar el caso, `fitBounds` sobre bounds de extensión cero pegaría el
    // zoom al maxZoom del mapa (24) sobre un único vértice.
    expect(zoom).toBeLessThan(visor.mapa.getMaxZoom())
    expect(zoom).toBeGreaterThanOrEqual(15)
    expect(zoom).toBeLessThanOrEqual(MAX_NATIVO)
    const [lat, lon] = vertUTMaLatLng(punto, HUSO_DEMO)
    expect(visor.mapa.getCenter().lat).toBeCloseTo(lat, 9)
    expect(visor.mapa.getCenter().lng).toBeCloseTo(lon, 9)
  })

  it('la parcela que ENTRA en un visor arrancado vacío se encuadra (el camino de F05)', () => {
    const store = crearEstadoVista(null)
    const { visor } = abrirVisor({ estado: store, vistaInicial: VISTA_MADRID })
    expect(visor.mapa.getCenter().lat).toBeCloseTo(VISTA_MADRID.centro[0], 9)

    const parcela = parcelaComo({ refcat: REF_A })
    store.set(parcela)

    expect(encuadraA(visor.mapa, parcela)).toBe(true)
  })

  it('VACIAR el store no lanza y NO viaja a vistaInicial: se queda donde está', () => {
    // Dentro de una notificación del store no puede haber ni el `throw` del
    // encuadre mudo ni un salto a Madrid: no hay nada que mirar, y quedarse quieto
    // es lo único que no sorprende.
    const alAvisar = vi.fn()
    const { visor, store } = abrirVisor({
      parcela: parcelaComo({ refcat: REF_A }),
      vistaInicial: VISTA_MADRID,
      alAvisar,
    })
    const antes = vistaDe(visor.mapa)

    expect(() => store.set(null)).not.toThrow()

    expect(vistaDe(visor.mapa)).toEqual(antes)
    expect(alAvisar).not.toHaveBeenCalled()
  })

  it('una parcela SIN identidad no mueve el mapa, pero lo DICE (regla de oro 1)', () => {
    // `crearParcela` exige `idLocal`, así que esto solo llega de un POJO hecho a
    // mano. Y aun así: no poder distinguir «otra parcela» de «esta, editada» es un
    // motivo para NO mover el mapa —nunca se estropea un arrastre— y para contarlo.
    //
    // El visor arranca YA con la parcela anónima, y es a propósito: pasar de una
    // parcela identificada a una anónima sí es un cambio de identidad observable
    // («la que había decía llamarse X y esta no lo dice») y sí reencuadra. Lo que
    // no se puede distinguir es una anónima de OTRA anónima, que es esto.
    const alAvisar = vi.fn()
    const anonima = (dx = 0, dy = 0) => ({ recintos: parcelaComo({ dx, dy }).recintos })
    const { visor, store } = abrirVisor({ parcela: anonima(), alAvisar })
    const antes = vistaDe(visor.mapa)

    store.set(anonima(500, 500))
    store.set(anonima(900, 900))

    expect(vistaDe(visor.mapa)).toEqual(antes)
    // UNA vez por visor, no una por `set`: si no, editar una parcela anónima
    // llenaría el panel de avisos idénticos.
    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toContain('encuadrar()')
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('de una parcela IDENTIFICADA a una anónima sí es un cambio: reencuadra', () => {
    // La otra mitad del caso de arriba, afirmada para que no se lea como un
    // descuido: la clave pasa de `refcat:…` a `null`, y eso es una identidad
    // distinta. Se reencuadra y NO se avisa (no hay ninguna ambigüedad que contar).
    const alAvisar = vi.fn()
    const { visor, store } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }), alAvisar })
    const antes = vistaDe(visor.mapa)

    const anonima = { recintos: parcelaComo({ dx: 500, dy: 500 }).recintos }
    store.set(anonima)

    expect(vistaDe(visor.mapa)).not.toEqual(antes)
    expect(encuadraA(visor.mapa, anonima)).toBe(true)
    expect(alAvisar).not.toHaveBeenCalled()
  })

  it('el ARRANQUE encuadra UNA sola vez: `subscribe` no notifica al suscribirse', () => {
    // Doble encuadre = doble petición al WMS del Catastro (criterio de aceptación
    // 2 de F03) y un salto visible. Se mide sobre `fitBounds`, que es la llamada
    // que ejecuta el encuadre de una parcela normal.
    const espiaFit = vi.spyOn(L.Map.prototype, 'fitBounds')
    pendientes.push(() => espiaFit.mockRestore())

    abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })

    expect(espiaFit).toHaveBeenCalledTimes(1)
  })

  it('traer otra parcela pide UNA imagen más al WMS, no dos', () => {
    const espia = espiarPeticionesDeEsteTest()
    const { store } = abrirVisor({
      parcela: parcelaComo({ refcat: REF_A }),
      baseInicial: ID_CAPA.CATASTRO,
    })
    expect(espia.total).toBe(1)

    store.set(parcelaComo({ refcat: REF_B, dx: 500, dy: 500 }))

    expect(espia.total).toBe(2)
  })

  // ── Y del MISMO cambio de identidad cuelga la limpieza de las vecinas ──────
  //
  // Gemelas de las dos de arriba y por el mismo motivo: unas colindantes dibujadas
  // junto a una parcela que ya no está en pantalla son una MENTIRA sobre el mapa,
  // igual que un encuadre que se quedó en la parcela anterior. Va en el visor —y no
  // en los cableados de `app/`— porque hay tres vías de entrada de parcela y todas
  // pasan por el store: una llamada por cableado se rompería en silencio con la
  // cuarta. Ver el paso 7 de `viewer/index.js`.

  it('LA GEMELA: editar la MISMA parcela NO borra las vecinas', () => {
    // La mitad que hace usable F06. Si esto cayera, cada arrastre borraría unos
    // contornos que siguen siendo perfectamente válidos y habría que volver a
    // pedírselos al Catastro — una consulta de red por vértice movido.
    const { visor, store, parcela } = abrirVisor({
      parcela: parcelaComo({ refcat: REF_A }),
      colindantes: true,
    })
    visor.colindantes.pintar([vecinaJuntoA(parcela, REF_B)])
    expect(capasDeColindantes(visor.mapa)).toHaveLength(1)

    for (let i = 1; i <= 5; i++) store.set(parcelaComo({ refcat: REF_A, dx: i, dy: i }))

    expect(capasDeColindantes(visor.mapa)).toHaveLength(1)
  })

  it('una parcela con OTRA identidad SÍ las borra: ya no son sus vecinas', () => {
    const { visor, store, parcela } = abrirVisor({
      parcela: parcelaComo({ refcat: REF_A }),
      colindantes: true,
    })
    visor.colindantes.pintar([
      vecinaJuntoA(parcela, REF_B),
      vecinaJuntoA(parcela, '9398502VK3799G'),
    ])
    expect(capasDeColindantes(visor.mapa)).toHaveLength(2)

    store.set(parcelaComo({ refcat: REF_B, dx: 500, dy: 500 }))

    expect(capasDeColindantes(visor.mapa)).toHaveLength(0)
    // Y no queda ni un `<path>` colgando en el documento.
    expect(document.querySelector(`.${CLASE_COLINDANTE}`)).toBeNull()
  })

  it('VACIAR el store también las borra: sin parcela no hay vecinas de nadie', () => {
    const { visor, store, parcela } = abrirVisor({
      parcela: parcelaComo({ refcat: REF_A }),
      colindantes: true,
    })
    visor.colindantes.pintar([vecinaJuntoA(parcela, REF_B)])

    store.set(null)

    expect(capasDeColindantes(visor.mapa)).toHaveLength(0)
  })

  it('la limpieza va ANTES del encuadre: el mapa se mueve ya sin los contornos viejos', () => {
    // El orden importa para que ningún repintado intermedio pueda enseñar las
    // vecinas de la parcela anterior sobre la nueva. Se mide con un espía en
    // `fitBounds` que fotografía cuántos contornos quedaban al encuadrar.
    const { visor, store, parcela } = abrirVisor({
      parcela: parcelaComo({ refcat: REF_A }),
      colindantes: true,
    })
    visor.colindantes.pintar([vecinaJuntoA(parcela, REF_B)])

    let contornosAlEncuadrar = null
    const fitBoundsReal = L.Map.prototype.fitBounds
    const espia = vi.spyOn(L.Map.prototype, 'fitBounds').mockImplementation(function (...args) {
      contornosAlEncuadrar = capasDeColindantes(visor.mapa).length
      return fitBoundsReal.apply(this, args)
    })
    pendientes.push(() => espia.mockRestore())

    store.set(parcelaComo({ refcat: REF_B, dx: 500, dy: 500 }))

    expect(contornosAlEncuadrar, 'no se ha llegado a encuadrar').toBe(0)
  })

  it('un visor SIN la capa no revienta al cambiar de parcela', () => {
    // `colindantes: false` es el defecto y `visor.colindantes` vale `null`: la
    // limpieza tiene que preguntar antes de llamar.
    const { visor, store } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })
    expect(visor.colindantes).toBeNull()

    expect(() => store.set(parcelaComo({ refcat: REF_B, dx: 500, dy: 500 }))).not.toThrow()
  })

  it('la parcela ANÓNIMA no las borra —no puede saber si son suyas— y lo DICE', () => {
    // Misma decisión que con el encuadre, y por el mismo motivo: sin identidad, «ha
    // entrado otra parcela» y «se ha editado esta» son indistinguibles, y entre
    // borrar unas vecinas que siguen valiendo (en CADA edición) y dejar unas que
    // quizá ya no valen, se elige lo que no destruye trabajo. Y no se calla.
    const alAvisar = vi.fn()
    const anonima = (dx = 0, dy = 0) => ({ recintos: parcelaComo({ dx, dy }).recintos })
    const { visor, store, parcela } = abrirVisor({
      parcela: anonima(),
      colindantes: true,
      alAvisar,
    })
    visor.colindantes.pintar([vecinaJuntoA(parcela, REF_B)])

    store.set(anonima(500, 500))

    expect(capasDeColindantes(visor.mapa)).toHaveLength(1)
    expect(alAvisar).toHaveBeenCalledTimes(1)
    // El aviso nombra las DOS consecuencias, no solo el encuadre.
    expect(alAvisar.mock.calls[0][0]).toContain('encuadrar()')
    expect(alAvisar.mock.calls[0][0]).toContain('colindantes.limpiar()')
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('sin capa montada, el aviso de la parcela anónima NO habla de vecinas', () => {
    // Mandar al usuario a `visor.colindantes.limpiar()` en un visor que no monta la
    // capa sería mandarlo a un `null`.
    const alAvisar = vi.fn()
    const anonima = (dx = 0, dy = 0) => ({ recintos: parcelaComo({ dx, dy }).recintos })
    const { store } = abrirVisor({ parcela: anonima(), alAvisar })

    store.set(anonima(500, 500))

    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).not.toContain('colindantes')
  })

  it('tras destruir(), una parcela NUEVA en el store no lanza ni toca nada', () => {
    // La suscripción se da de baja con el resto del visor: sin eso, `fitBounds`
    // correría sobre un mapa ya retirado del DOM y reventaría dentro de Leaflet.
    const { store, visor } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })
    visor.destruir()

    expect(() => store.set(parcelaComo({ refcat: REF_B, dx: 500, dy: 500 }))).not.toThrow()
  })
})

// ── visor.encuadrar() — el encuadre EXPLÍCITO ────────────────────────────────

describe('crearVisor · visor.encuadrar(): la misma cascada, a petición', () => {
  it('devuelve la vista a la parcela después de que el usuario se haya ido navegando', () => {
    const parcela = parcelaComo({ refcat: REF_A })
    const { visor } = abrirVisor({ parcela })

    visor.mapa.setView(VISTA_MADRID.centro, VISTA_MADRID.zoom)
    expect(encuadraA(visor.mapa, parcela)).toBe(false)

    expect(visor.encuadrar()).toBe('geometria')
    expect(encuadraA(visor.mapa, parcela)).toBe(true)
  })

  it('respeta el caso DEGENERADO igual que el encuadre del montaje', () => {
    // Reutiliza la misma función, así que no puede divergir; el test lo fija.
    const punto = [439250, 4479662.5]
    const { visor } = abrirVisor({ parcela: parcelaDegenerada([punto]) })

    visor.mapa.setView(VISTA_MADRID.centro, VISTA_MADRID.zoom)
    visor.encuadrar()

    expect(visor.mapa.getZoom()).toBeLessThan(visor.mapa.getMaxZoom())
    expect(visor.mapa.getCenter().lat).toBeCloseTo(vertUTMaLatLng(punto, HUSO_DEMO)[0], 9)
  })

  it('SIN geometría cae a vistaInicial, y lo dice', () => {
    const store = crearEstadoVista(null)
    const { visor } = abrirVisor({ estado: store, vistaInicial: VISTA_MADRID })

    visor.mapa.setView([41.65, -0.88], 12) // Zaragoza, a mano
    expect(visor.encuadrar()).toBe('vistaInicial')
    expect(visor.mapa.getCenter().lat).toBeCloseTo(VISTA_MADRID.centro[0], 9)
    expect(visor.mapa.getZoom()).toBe(VISTA_MADRID.zoom)
  })

  it('SIN geometría y SIN vistaInicial LANZA: es la misma cascada, no una versión blanda', () => {
    const { visor, store } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })
    store.set(null)

    let error = null
    try {
      visor.encuadrar()
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toMatch(/vistaInicial/)
    expect(error.message).toMatch(/geometr/i)
  })

  it('encuadrar a mano CUENTA como «esta es la vista de esta parcela»', () => {
    // Si no actualizara la clave, un `set` posterior de la MISMA parcela editada
    // volvería a encuadrar y desharía lo que el usuario acaba de pedir.
    const { visor, store } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })
    store.set(null)
    store.set(parcelaComo({ refcat: REF_B, dx: 500, dy: 500 }))

    visor.encuadrar()
    const despues = vistaDe(visor.mapa)

    store.set(parcelaComo({ refcat: REF_B, dx: 540, dy: 540 }))
    expect(vistaDe(visor.mapa)).toEqual(despues)
  })

  it('tras destruir() es un NO-OP que devuelve null, no un throw', () => {
    // Mismo criterio que `acotaciones.pintar` y `contraste.pintar`: el desmontaje
    // va en orden inverso y una respuesta de red en vuelo puede llegar después.
    const { visor } = abrirVisor({ parcela: parcelaComo({ refcat: REF_A }) })
    visor.destruir()

    expect(visor.encuadrar()).toBeNull()
  })
})

// ── La opción `colindantes` — la capa de parcelas vecinas ────────────────────
//
// Mismo reparto que con `edicion`, `diagnostico` y `comprobacion`: lo que la PIEZA
// hace vive en `test/viewer/colindantes.dom.test.js` (incluido el riesgo estrella:
// que el clic del mapa sobreviva a una capa interactiva); aquí solo el ENSAMBLAJE.

/** Las capas que la capa de colindantes ha puesto, filtradas POR PANE. */
function capasDeColindantes(mapa) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Renderer) return
    if (capa.options && capa.options.pane === PANE.COLINDANTES) out.push(capa)
  })
  return out
}

/** Una vecina con la forma que consume la capa (y `diagnostico/parcela.js`). */
function vecinaJuntoA(parcela, refcat) {
  const vertices = parcela.recintos[0].vertices.map(([x, y]) => [x + 25, y])
  return { refcat, recintos: [{ vertices, tipo: 'EXTERIOR' }] }
}

describe('crearVisor · colindantes:false (el DEFECTO) no cuesta ni una capa', () => {
  it('no monta nada: visor.colindantes vale null, NO undefined', () => {
    const { visor } = abrirVisor()

    expect(visor.colindantes).toBeNull()
    expect('colindantes' in visor).toBe(true)
    expect(capasDeColindantes(visor.mapa)).toHaveLength(0)
  })

  it('`colindantes: false` explícito se comporta igual que no pasarlo', () => {
    const { visor } = abrirVisor({ colindantes: false })
    expect(visor.colindantes).toBeNull()
  })

  it('el pane EXISTE igualmente: lo crea el mapa, no la opción', () => {
    const { visor } = abrirVisor()
    expect(visor.mapa.getPane(PANE.COLINDANTES)).toBeTruthy()
    expect(capasDeColindantes(visor.mapa)).toHaveLength(0)
  })
})

describe('crearVisor · colindantes:true monta la capa, VACÍA', () => {
  it('devuelve la pieza con su API completa, y sin nada puesto', () => {
    const { visor } = abrirVisor({ colindantes: true })

    expect(visor.colindantes).not.toBeNull()
    for (const metodo of ['pintar', 'limpiar', 'destruir']) {
      expect(typeof visor.colindantes[metodo], `falta colindantes.${metodo}`).toBe('function')
    }
    // Montar la capa NO trae vecinas: eso es una consulta al WFS que hace la app.
    expect(capasDeColindantes(visor.mapa)).toHaveLength(0)
  })

  it('lo que se pinta por `visor.colindantes` aparece en su pane', () => {
    const { visor, parcela } = abrirVisor({ colindantes: true })

    visor.colindantes.pintar([
      vecinaJuntoA(parcela, '9398501VK3799G'),
      vecinaJuntoA(parcela, '9398502VK3799G'),
    ])

    expect(capasDeColindantes(visor.mapa)).toHaveLength(2)
    visor.colindantes.limpiar()
    expect(capasDeColindantes(visor.mapa)).toHaveLength(0)
  })

  it('recibe el `zona` del `srs` del visor (no un huso fijo)', () => {
    const { visor, parcela } = abrirVisor({ colindantes: true, srs: 'EPSG:25829' })
    const vecina = vecinaJuntoA(parcela, '9398501VK3799G')
    visor.colindantes.pintar([vecina])

    const anillo = capasDeColindantes(visor.mapa)[0].getLatLngs()[0]
    const [lat29, lon29] = vertUTMaLatLng(vecina.recintos[0].vertices[0], 29)
    expect(anillo[0].lat).toBeCloseTo(lat29, 9)
    expect(anillo[0].lng).toBeCloseTo(lon29, 9)
  })

  it('el alAvisar del VISOR llega a la capa', () => {
    const alAvisar = vi.fn()
    const { visor } = abrirVisor({ colindantes: true, alAvisar })

    visor.colindantes.pintar([{ refcat: 'sin-geometria', recintos: [] }])

    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][1].nivel).toBe(NIVEL.AVISO)
  })

  it('el arranque con colindantes NO deja ni un aviso espurio, y sigue habiendo UNA petición', () => {
    const espia = espiarPeticionesDeEsteTest()
    const alAvisar = vi.fn()
    abrirVisor({ colindantes: true, alAvisar, baseInicial: ID_CAPA.CATASTRO })

    expect(alAvisar).not.toHaveBeenCalled()
    expect(espia.total).toBe(1)
  })

  it('no le pone ganchos a sincronizar (por eso puede ir pegada a las capas de fondo)', () => {
    abrirVisor({ colindantes: true })
    const args = argumentosDeSincronizar()

    expect(args.ajustar).toBeNull()
    expect(args.alPrevisualizar).toBeNull()
    expect(args.alCrearMarcador).toBeNull()
  })

  it('`colindantes` que no es booleano es TypeError, y el mensaje nombra la vía correcta', () => {
    const { contenedor, tablaEl } = prepararDOM()
    const base = { estado: crearEstadoVista(parcelaConHueco()), tablaEl, srs: SRS_DEMO }

    let error = null
    try {
      // La tentación es pasarle un objeto de opciones, como a las otras tres.
      crearVisor(contenedor, { ...base, colindantes: { color: 'gris' } })
    } catch (e) {
      error = e
    }
    expect(error).toBeInstanceOf(TypeError)
    expect(error.message).toContain('BOOLEANO')
    expect(error.message).toContain('pintar')

    for (const colindantes of ['si', 1, null, [], () => {}]) {
      expect(() => crearVisor(contenedor, { ...base, colindantes })).toThrow(TypeError)
    }
    expect(contenedor.children).toHaveLength(0)
  })
})

describe('crearVisor · destruir con colindantes', () => {
  it('cae DESPUÉS de la edición y ANTES de las capas, con el mapa todavía en pie', () => {
    const { contenedor, visor } = abrirVisor({ edicion: true, colindantes: true })

    const orden = []
    let alTocarleALasColindantes = null

    anotarDestruccion(visor.edicion, 'edicion', orden)
    anotarDestruccion(visor.acotaciones, 'acotaciones', orden)
    anotarDestruccion(visor.colindantes, 'colindantes', orden, () => {
      alTocarleALasColindantes = {
        mapaAunEnPie: contenedor.querySelector('.leaflet-map-pane') !== null,
      }
    })
    anotarDestruccion(visor.capas, 'capas', orden)

    visor.destruir()

    // Es lo primero que se monta después de las capas, así que es lo último que se
    // desmonta antes de ellas: orden inverso EXACTO.
    expect(orden).toEqual(['edicion', 'acotaciones', 'colindantes', 'capas'])
    expect(alTocarleALasColindantes).toEqual({ mapaAunEnPie: true })
    expect(contenedor.children).toHaveLength(0)
  })

  it('tras destruir no queda ni un contorno de vecina', () => {
    const { visor, parcela } = abrirVisor({ colindantes: true })
    visor.colindantes.pintar([vecinaJuntoA(parcela, '9398501VK3799G')])
    expect(capasDeColindantes(visor.mapa).length).toBeGreaterThan(0)

    visor.destruir()

    expect(document.querySelector(`.${CLASE_COLINDANTE}`)).toBeNull()
  })

  it('es IDEMPOTENTE: la capa se desmonta UNA sola vez', () => {
    const { visor } = abrirVisor({ colindantes: true })

    const orden = []
    anotarDestruccion(visor.colindantes, 'colindantes', orden)

    visor.destruir()
    expect(() => visor.destruir()).not.toThrow()
    expect(() => visor.destruir()).not.toThrow()

    expect(orden).toEqual(['colindantes'])
  })

  it('un fallo posterior del ensamblaje arrastra a la capa YA montada (atomicidad)', () => {
    const { contenedor, tablaEl } = prepararDOM()

    expect(() =>
      crearVisor(contenedor, {
        estado: crearEstadoVista(parcelaConHueco()),
        tablaEl,
        srs: SRS_DEMO,
        colindantes: true,
        // Lanza en `crearEdicion`, con la capa de colindantes ya montada.
        edicion: { tolerancia: -1 },
      }),
    ).toThrow(RangeError)

    expect(contenedor.children).toHaveLength(0)
    expect(document.querySelector(`.${CLASE_COLINDANTE}`)).toBeNull()
  })
})

// ═══════════════════════════════════════════════════════════════════════════
// F11 · T1.5 — el pane de las PARTES, el encuadre EXTRAÍDO y la barra EXPUESTA
// ═══════════════════════════════════════════════════════════════════════════
//
// Tres cambios quirúrgicos para que la rama EDIFICIO pueda existir SIN tocar el
// visor de parcela, que lleva cuatro fases en verde:
//
//   · `PANE.PARTES` — una entrada en `viewer/_comun.js#PANES` y nada más:
//     `crearMapa` itera esa lista. Aquí se comprueba desde el ENSAMBLAJE (que es
//     donde se ve que no hace falta ninguna opción para tenerlo) y que llega
//     VACÍO, como el de diagnóstico mientras nadie diagnostica.
//   · `encuadrarSobreRecintos(...)` — hasta F10 era privado. La rama edificio lo
//     necesita ENTERO, y sobre todo el caso degenerado: un edificio de un vértice
//     tiene que ir a `setView` con zoom de parcela y NUNCA a un `fitBounds` sobre
//     bounds sin extensión, que daría el `maxZoom` del mapa (24) sobre un punto.
//     `visor.encuadrar()` no sirve ahí: ejecuta la cascada sobre el store de
//     PARCELA. Y es EXTRACCIÓN, no reescritura: hay un test que exige que el caso
//     degenerado por la vía nueva dé EXACTAMENTE la misma vista que por la vieja.
//   · `visor.barraEdicion` — para poder OCULTARLA (no desmontarla) cuando la rama
//     activa es EDIFICIO: con la parcela como contexto, `viewer/edicion.js`
//     seguiría dejando arrastrar sus vértices y un Ctrl+Z ahí deshace una edición
//     que el usuario cree estar haciendo sobre el edificio.

/** El pane recibe zIndex desde `PANES`; el valor NO se copia aquí a mano. */
const zIndexDe = (nombre) => PANES.find((p) => p.nombre === nombre).zIndex

/** Capas montadas en un pane concreto, sin contar el renderizador de Leaflet. */
function capasEnPane(mapa, nombre) {
  const out = []
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Renderer) return
    if (capa.options && capa.options.pane === nombre) out.push(capa)
  })
  return out
}

/** Un recinto suelto (la forma que consume `encuadrarSobreRecintos`). */
const recintoDe = (vertices) => ({ vertices })

/**
 * Un recinto de 100×80 m a ~150 km de la parcela de demostración, en el MISMO
 * huso. Es el caso real de F11: un edificio traído por referencia catastral que
 * cae lejísimos de lo que se está mirando — el defecto que la firma humana
 * encontró en F03 y que `README.md:58-63` documenta.
 */
const RECINTOS_LEJOS = Object.freeze([
  recintoDe([
    [300000, 4400000],
    [300100, 4400000],
    [300100, 4400080],
    [300000, 4400080],
  ]),
])

describe('crearVisor · PANE.PARTES (F11): el pane lo crea el MAPA, no una opción', () => {
  it('existe en un visor pelado, con su zIndex, y llega VACÍO', () => {
    const { visor } = abrirVisor()

    const pane = visor.mapa.getPane(PANE.PARTES)
    expect(pane).toBeTruthy()
    expect(pane.style.zIndex).toBe(String(zIndexDe(PANE.PARTES)))
    // Montar el visor no pinta ninguna parte: `viewer/partes.js` es de T2.3 y aquí
    // ni se importa. Igual que el pane del diagnóstico sin diagnosticar.
    expect(capasEnPane(visor.mapa, PANE.PARTES)).toHaveLength(0)
  })

  it('no le ha costado nada al resto: los otros seis panes siguen exactos', () => {
    // La entrada nueva se intercala entre `parcelaEditada` y `acotaciones`, así que
    // lo que hay que atestar es que NO ha movido a nadie. Todo derivado de `PANES`.
    const { visor } = abrirVisor()

    for (const { nombre, zIndex } of PANES) {
      expect(visor.mapa.getPane(nombre), `falta el pane «${nombre}»`).toBeTruthy()
      expect(visor.mapa.getPane(nombre).style.zIndex).toBe(String(zIndex))
    }
    // Y la geometría de la parcela sigue donde estaba: por DEBAJO de las huellas.
    expect(zIndexDe(PANE.PARCELA_EDITADA)).toBeLessThan(zIndexDe(PANE.PARTES))
    expect(zIndexDe(PANE.PARTES)).toBeLessThan(zIndexDe(PANE.VERTICES))
  })
})

describe('encuadrarSobreRecintos (F11): el encuadre, sin store de por medio', () => {
  it('sale del módulo: es una función exportada por `viewer/index.js`', () => {
    // Guardián de la exportación: `app/cableado-edificio.js` (T3.2) programa contra
    // ella, y `viewer/` NO sale por el barrel raíz (Leaflet exige `window`), así que
    // esta es la única puerta.
    expect(typeof encuadrarSobreRecintos).toBe('function')
  })

  it('encuadra sobre recintos AJENOS al store: ni lo lee ni lo escribe', () => {
    const { visor, store, parcela } = abrirVisor()
    expect(encuadraA(visor.mapa, parcela)).toBe(true)

    const encuadrado = encuadrarSobreRecintos({
      mapa: visor.mapa,
      recintos: RECINTOS_LEJOS,
      zona: HUSO_DEMO,
    })

    expect(encuadrado).toBe(true)
    const bounds = visor.mapa.getBounds()
    for (const [x, y] of RECINTOS_LEJOS[0].vertices) {
      expect(bounds.contains(L.latLng(vertUTMaLatLng([x, y], HUSO_DEMO)))).toBe(true)
    }
    // El mapa se ha ido de verdad: la parcela del store ya no se ve.
    expect(encuadraA(visor.mapa, parcela)).toBe(false)
    // Y el store no se ha tocado: es la propiedad que hace que esto sirva para el
    // SEGUNDO store de F11 sin que la rama parcela se entere de nada.
    expect(store.get()).toBe(parcela)
  })

  it('CASO DEGENERADO: un solo vértice va a setView, y JAMÁS a fitBounds', () => {
    const punto = [439250, 4479662.5]
    const { visor } = abrirVisor()
    const setView = vi.spyOn(visor.mapa, 'setView')
    const fitBounds = vi.spyOn(visor.mapa, 'fitBounds')

    expect(
      encuadrarSobreRecintos({
        mapa: visor.mapa,
        recintos: [recintoDe([punto])],
        zona: HUSO_DEMO,
      }),
    ).toBe(true)

    // Lo que este test impide: `fitBounds` sobre unos bounds SIN EXTENSIÓN calcula
    // una escala infinita y devuelve el maxZoom del mapa (24) sobre un punto.
    expect(fitBounds).not.toHaveBeenCalled()
    expect(setView).toHaveBeenCalledTimes(1)
    expect(visor.mapa.getZoom()).toBeLessThan(visor.mapa.getMaxZoom())
    expect(visor.mapa.getZoom()).toBeGreaterThanOrEqual(15)
    expect(visor.mapa.getZoom()).toBeLessThanOrEqual(MAX_NATIVO)
    const [lat, lon] = vertUTMaLatLng(punto, HUSO_DEMO)
    expect(visor.mapa.getCenter().lat).toBeCloseTo(lat, 9)
    expect(visor.mapa.getCenter().lng).toBeCloseTo(lon, 9)
  })

  it('EXTRACCIÓN, NO REESCRITURA: el punto da la MISMA vista que por la vía del montaje', () => {
    // La prueba que hace de este cambio una extracción y no una copia: el mismo
    // vértice degenerado, encuadrado (a) por la cascada del montaje leyendo el
    // store —el camino de F03, intacto— y (b) por la función recién exportada,
    // tiene que dejar el mapa EXACTAMENTE en el mismo sitio y al mismo zoom.
    const punto = [439250, 4479662.5]

    const { visor: porElMontaje } = abrirVisor({ parcela: parcelaDegenerada([punto]) })
    const { visor: porLaFuncion } = abrirVisor()
    encuadrarSobreRecintos({
      mapa: porLaFuncion.mapa,
      recintos: [recintoDe([punto])],
      zona: HUSO_DEMO,
    })

    expect(vistaDe(porLaFuncion.mapa)).toEqual(vistaDe(porElMontaje.mapa))
  })

  it('vértices TODOS COINCIDENTES se tratan igual que un punto', () => {
    const punto = [439250, 4479662.5]
    const { visor } = abrirVisor()
    const fitBounds = vi.spyOn(visor.mapa, 'fitBounds')

    encuadrarSobreRecintos({
      mapa: visor.mapa,
      recintos: [recintoDe([punto, punto, punto])],
      zona: HUSO_DEMO,
    })

    expect(fitBounds).not.toHaveBeenCalled()
    expect(visor.mapa.getZoom()).toBeLessThan(visor.mapa.getMaxZoom())
  })

  it('con extensión de verdad SÍ usa fitBounds, y con margen', () => {
    const { visor } = abrirVisor()
    const fitBounds = vi.spyOn(visor.mapa, 'fitBounds')

    encuadrarSobreRecintos({ mapa: visor.mapa, recintos: RECINTOS_LEJOS, zona: HUSO_DEMO })

    expect(fitBounds).toHaveBeenCalledTimes(1)
    // Se proyecta VÉRTICE A VÉRTICE (no las dos esquinas del bbox UTM: la
    // desproyección no conserva los ejes) y va con `padding`.
    const [bounds, opciones] = fitBounds.mock.calls[0]
    expect(bounds).toHaveLength(RECINTOS_LEJOS[0].vertices.length)
    expect(opciones.padding[0]).toBeGreaterThan(0)
  })

  it('sin nada que encuadrar devuelve false y NO toca la vista (no es un error)', () => {
    // El store de edificio NACE VACÍO: «no hay recintos» es un estado legítimo del
    // recorrido, no un contrato roto. Quedarse donde se está es lo único que no
    // sorprende — la misma regla que el reencuadre vivo con `set(null)`.
    const { visor } = abrirVisor()
    const antes = vistaDe(visor.mapa)

    for (const recintos of [null, undefined, [], [{ vertices: [] }], 'no es un array']) {
      expect(
        encuadrarSobreRecintos({ mapa: visor.mapa, recintos, zona: HUSO_DEMO }),
        `«${JSON.stringify(recintos)}» debería no encuadrar`,
      ).toBe(false)
    }
    expect(vistaDe(visor.mapa)).toEqual(antes)
  })

  it('un vértice no numérico se descarta y se AVISA, con el SUJETO que le den', () => {
    const { visor } = abrirVisor()
    const alAvisar = vi.fn()

    encuadrarSobreRecintos({
      mapa: visor.mapa,
      recintos: [
        recintoDe([
          [300000, 4400000],
          [300100, 4400000],
          [300100, 4400080],
          [Number.NaN, 4400080],
        ]),
      ],
      zona: HUSO_DEMO,
      alAvisar,
      sujeto: 'El edificio',
    })

    expect(alAvisar).toHaveBeenCalledTimes(1)
    const [mensaje, detalle] = alAvisar.mock.calls[0]
    // El sujeto es parámetro justamente para esto: decir «La parcela tiene…»
    // mientras el usuario mira un edificio sería contarle un fallo REAL sobre el
    // objeto equivocado.
    expect(mensaje).toContain('El edificio tiene 1 vértice(s)')
    expect(mensaje).not.toContain('La parcela')
    // AVISO y no ERROR: se encuadra igual con el resto y el GML sigue generable.
    expect(detalle.nivel).toBe(NIVEL.AVISO)
  })

  it('SIN sujeto el aviso es el literal de F03, letra por letra (la rama parcela no cambia)', () => {
    // Guardián de la extracción por el otro lado. El defecto de `sujeto` es «La
    // parcela» justamente para que la rama que lleva cuatro fases en verde no
    // cambie ni una letra de lo que el usuario lee: `encuadrarGeometria` —la rama
    // 1 de la cascada del viewport— llama a esta función SIN pasar sujeto.
    //
    // ⚠️ Y se prueba llamando DIRECTAMENTE, no montando un visor con un vértice
    // NaN, porque eso último es imposible desde F03 y no por culpa del encuadre:
    // `viewer/sincronizacion.js` proyecta los vértices en el paso 4 del montaje y
    // `geo/utm.js#inverse` LANZA con un NaN, o sea antes de que el encuadre (paso
    // 6) llegue a mirarlos. Por la rama de parcela este aviso es hoy inalcanzable;
    // por la de edificio no lo será, porque `app/cableado-edificio.js` llama aquí
    // directamente y sin `sincronizar` de por medio.
    const { visor } = abrirVisor()
    const alAvisar = vi.fn()

    encuadrarSobreRecintos({
      mapa: visor.mapa,
      recintos: [
        recintoDe([
          [300000, 4400000],
          [300100, 4400000],
          [300100, 4400080],
          [300000, Number.NaN],
        ]),
      ],
      zona: HUSO_DEMO,
      alAvisar,
    })

    expect(alAvisar).toHaveBeenCalledTimes(1)
    expect(alAvisar.mock.calls[0][0]).toBe(
      'La parcela tiene 1 vértice(s) con coordenadas no numéricas: el encuadre ' +
        'inicial del mapa los ignora.',
    )
  })

  it('un `mapa` que no es de Leaflet es contrato roto → TypeError', () => {
    // Regla de oro 1: sin esta guarda, un mapa equivocado revienta DENTRO de
    // Leaflet, a tres saltos de aquí y con un mensaje ilegible.
    for (const mapa of [null, undefined, {}, 'mapa', 42]) {
      expect(() =>
        encuadrarSobreRecintos({ mapa, recintos: RECINTOS_LEJOS, zona: HUSO_DEMO }),
      ).toThrow(TypeError)
    }
  })

  it('un `alAvisar` que no es función es contrato roto → TypeError', () => {
    const { visor } = abrirVisor()
    expect(() =>
      encuadrarSobreRecintos({
        mapa: visor.mapa,
        recintos: RECINTOS_LEJOS,
        zona: HUSO_DEMO,
        alAvisar: 'no soy una función',
      }),
    ).toThrow(TypeError)
  })
})

describe('crearVisor · `barraEdicion` en el objeto devuelto (F11)', () => {
  const barraEnDom = (contenedor) => contenedor.querySelector(`.${CLASE_BARRA.CONTENEDOR}`)

  it('sin edición vale null, NO undefined', () => {
    const { visor } = abrirVisor()
    expect(visor.barraEdicion).toBeNull()
    expect('barraEdicion' in visor).toBe(true)
  })

  it('con edición devuelve la BarraMontada, y su control apunta al nodo REAL', () => {
    const { visor, contenedor } = abrirVisor({ edicion: true })

    expect(visor.barraEdicion).not.toBeNull()
    expect(typeof visor.barraEdicion.destruir).toBe('function')
    // `getContainer()` es API pública de `L.Control`, y es la puerta por la que
    // `app/rama.js` (T2.4) va a ocultarla.
    const nodo = visor.barraEdicion.control.getContainer()
    expect(nodo).toBe(barraEnDom(contenedor))
    expect(nodo.isConnected).toBe(true)
  })

  it('`edicion:{barra:false}` monta la edición y NO la barra: son dos preguntas', () => {
    const { visor, contenedor } = abrirVisor({ edicion: { barra: false } })

    expect(visor.edicion).not.toBeNull()
    expect(visor.barraEdicion).toBeNull()
    expect(barraEnDom(contenedor)).toBeNull()
  })

  it('OCULTARLA con `hidden` no la desmonta: los siete nodos del contrato siguen ahí', () => {
    // El motivo por el que se expone (T2.4): con la rama EDIFICIO activa la barra
    // estorba —un Ctrl+Z ahí deshace una edición de la parcela, que en ese momento
    // es contexto—, pero desmontarla obligaría a reconstruirla y a recablearla al
    // volver. Y la lección medida de F11 · T0.3: `hidden` conserva el nodo,
    // `replaceChildren` deja la referencia huérfana, escribible y muda.
    const { visor, contenedor } = abrirVisor({ edicion: true })
    const nodo = visor.barraEdicion.control.getContainer()

    nodo.hidden = true

    expect(nodo.isConnected).toBe(true)
    expect(barraEnDom(contenedor)).toBe(nodo)
    // Los siete nodos que `app/main.js#cablearEdicion` resolvió UNA sola vez en el
    // montaje siguen siendo los mismos y siguen estando en el documento.
    for (const selector of [
      '[data-accion="deshacer"]',
      '[data-accion="rehacer"]',
      '[data-accion="offset"]',
      '[data-campo="snap"]',
      '[data-campo="snap-tolerancia"]',
      '[data-campo="offset-distancia"]',
      '[data-estado="edicion"]',
    ]) {
      const encontrado = contenedor.querySelector(selector)
      expect(encontrado, `falta ${selector} tras ocultar la barra`).not.toBeNull()
      expect(encontrado.isConnected).toBe(true)
    }

    // Y se vuelve: enseñarla otra vez es una línea, sin reconstruir nada.
    nodo.hidden = false
    expect(visor.barraEdicion.control.getContainer()).toBe(nodo)
  })

  it('`destruir()` se la lleva, y sigue siendo idempotente', () => {
    const { visor, contenedor } = abrirVisor({ edicion: true })
    expect(barraEnDom(contenedor)).not.toBeNull()

    visor.destruir()

    expect(barraEnDom(contenedor)).toBeNull()
    expect(() => visor.destruir()).not.toThrow()
  })
})

// ── F22 · T3.1/T3.2 — la opción `parcelas` ───────────────────────────────────
//
// Mismo reparto que las tres de arriba: lo que las PIEZAS hacen vive en
// `test/viewer/cajon-parcelas.dom.test.js` y `test/viewer/candidatas.dom.test.js`;
// aquí solo lo que existe cuando están ENSAMBLADAS.

/** El nodo del cajón de PARCELAS dentro del contenedor del mapa, o `null`. */
const cajonParcelasDe = (contenedor) =>
  contenedor.querySelector(`.${CLASE_PARCELAS.CONTENEDOR}`)

describe('crearVisor · parcelas:false (el DEFECTO) no cuesta un nodo', () => {
  it('visor.parcelas vale null, NO undefined, y no hay cajón', () => {
    const { visor, contenedor } = abrirVisor()
    expect(visor.parcelas).toBeNull()
    expect('parcelas' in visor).toBe(true)
    expect(cajonParcelasDe(contenedor)).toBeNull()
  })

  it('`parcelas: false` explícito se comporta igual que no pasarlo', () => {
    const { visor, contenedor } = abrirVisor({ parcelas: false })
    expect(visor.parcelas).toBeNull()
    expect(cajonParcelasDe(contenedor)).toBeNull()
  })
})

describe('crearVisor · parcelas:true monta las DOS piezas, inertes', () => {
  it('devuelve `{cajon, capa}` juntas, y no sueltas', () => {
    // Al revés que `comprobacion` y como `diagnostico`: elegir entre ocho
    // referencias que comparten los once primeros caracteres SIN ver el mapa no es
    // elegir, es adivinar. Las dos piezas son inseparables.
    const { visor } = abrirVisor({ parcelas: true })
    expect(visor.parcelas).not.toBeNull()
    expect(Object.keys(visor.parcelas).sort()).toEqual(['cajon', 'capa'])
    for (const metodo of ['pintar', 'marcar', 'elegida', 'abrir', 'cerrar', 'estado',
      'alElegir', 'alConfirmar', 'alDescartar', 'destruir']) {
      expect(typeof visor.parcelas.cajon[metodo], `falta cajon.${metodo}`).toBe('function')
    }
    for (const metodo of ['pintar', 'resaltar', 'limpiar', 'alSenalar', 'resaltada', 'destruir']) {
      expect(typeof visor.parcelas.capa[metodo], `falta capa.${metodo}`).toBe('function')
    }
  })

  it('el cajón está en el DOM, CERRADO, y con todos los nodos del contrato', () => {
    const { visor, contenedor } = abrirVisor({ parcelas: true })
    const cajon = cajonParcelasDe(contenedor)
    expect(cajon).not.toBeNull()
    for (const selector of Object.values(SELECTOR_PARCELAS)) {
      expect(cajon.querySelector(selector), `falta ${selector}`).not.toBeNull()
    }
    expect(cajon.style.display).toBe('none')
    expect(visor.parcelas.cajon.elegida()).toBeNull()
  })

  it('la capa nace VACÍA: montar no dibuja ninguna finca', () => {
    const { visor, contenedor } = abrirVisor({ parcelas: true })
    expect(visor.parcelas.capa.resaltada()).toBeNull()
    expect(contenedor.querySelectorAll(`.${CLASE_CANDIDATA}`)).toHaveLength(0)
  })

  it('⚠️ TERCER cajón en `bottomleft`, y los tres conviven cerrados', () => {
    // Son caras del mismo hueco y son mutuamente excluyentes POR RECORRIDO, no por
    // montaje: montarlos los tres es lo normal, abrir dos a la vez no — y de eso
    // responde el cableado, que es quien sabe en qué punto del recorrido está.
    const { contenedor } = abrirVisor({ diagnostico: true, comprobacion: true, parcelas: true })
    const esquina = contenedor.querySelector('.leaflet-bottom.leaflet-left')
    expect(esquina.querySelectorAll(`.${CLASE_CAJON.CONTENEDOR}`)).toHaveLength(1)
    expect(esquina.querySelectorAll(`.${CLASE_COMPROBACION.CONTENEDOR}`)).toHaveLength(1)
    expect(esquina.querySelectorAll(`.${CLASE_PARCELAS.CONTENEDOR}`)).toHaveLength(1)
    for (const caja of esquina.querySelectorAll('section')) {
      expect(caja.style.display).toBe('none')
    }
  })

  it('`{posicion}` llega a su destinatario, y una clave desconocida LANZA', () => {
    const { contenedor } = abrirVisor({ parcelas: { posicion: 'topright' } })
    const esquina = contenedor.querySelector('.leaflet-top.leaflet-right')
    expect(esquina.querySelector(`.${CLASE_PARCELAS.CONTENEDOR}`)).not.toBeNull()
    expect(() => abrirVisor({ parcelas: { candidatas: [] } })).toThrow(TypeError)
    expect(() => abrirVisor({ parcelas: 'sí' })).toThrow(TypeError)
    expect(() => abrirVisor({ parcelas: [] })).toThrow(TypeError)
  })

  it('el desmontaje se lleva las dos piezas', () => {
    const { visor, contenedor } = abrirVisor({ parcelas: true })
    visor.parcelas.capa.pintar([
      { vertices: parcelaConHueco().recintos[0].vertices, nombre: 'X', superficie: 1 },
    ])
    visor.destruir()
    expect(cajonParcelasDe(contenedor)).toBeNull()
    expect(contenedor.querySelectorAll(`.${CLASE_CANDIDATA}`)).toHaveLength(0)
  })
})


// ── La × de la tabla, enchufada de verdad (2026-08-10) ───────────────────────
//
// `sincronizacion.js` fabrica el botón y `edicion.js` sabe borrar; lo que se
// prueba aquí es LA SOLDADURA, que es la que ningún test de módulo ve: que
// `crearVisor` le pasa `edicion.eliminar` como `alBorrar`, y que sin edición no le
// pasa nada.

describe('crearVisor · la × de cada fila borra de VERDAD (soldadura de F06)', () => {
  const botonesBorrar = (tablaEl) => [
    ...tablaEl.querySelectorAll('[data-accion="borrar-vertice"]'),
  ]

  it('con edición, pulsar la × elimina el vértice del modelo y commitea', () => {
    const historial = crearHistorial()
    const { tablaEl, store } = abrirVisor({ historial, edicion: true })
    const antes = store.get().recintos[0].vertices.length

    botonesBorrar(tablaEl)[0].dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true }),
    )

    expect(store.get().recintos[0].vertices).toHaveLength(antes - 1)
    expect(historial.pila, 'una operación acabada, un commit').toHaveLength(1)
  })

  it('el modelo se NIEGA por debajo de tres vértices, y el botón no se salta la regla', () => {
    // La razón entera de que la × delegue en `edicion.eliminar` en vez de borrar
    // por su cuenta: `edit/vertices.js` es quien sabe que un anillo de dos puntos
    // no encierra superficie, y su negativa tiene que valer venga de donde venga.
    const triangulo = parcelaConHueco()
    triangulo.recintos = [{ ...triangulo.recintos[0] }]
    triangulo.recintos[0].vertices = triangulo.recintos[0].vertices.slice(0, 3)
    const { tablaEl, store } = abrirVisor({ parcela: triangulo, edicion: true })

    botonesBorrar(tablaEl)[0].dispatchEvent(
      new window.MouseEvent('click', { bubbles: true, cancelable: true }),
    )

    expect(store.get().recintos[0].vertices, 'no ha borrado nada').toHaveLength(3)
  })

  it('SIN edición no hay columna: un mando muerto no se apaga, no se pone', () => {
    const { tablaEl } = abrirVisor({ edicion: false })
    expect(botonesBorrar(tablaEl)).toHaveLength(0)
    expect(tablaEl.querySelectorAll('thead th')).toHaveLength(3)
  })
})

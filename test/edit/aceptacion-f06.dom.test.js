/* -------------------------------------------------------------------------- *
 * test/edit/aceptacion-f06.dom.test.js — F06 · T6.1 · SUITE DE ACEPTACIÓN       *
 *                                                                              *
 * La prueba que decide si F06 está hecha. Los CINCO criterios de                *
 * `spec/feature-06-edicion-parcela.md` § «Criterios de aceptación», uno a uno y *
 * con su texto LITERAL en el nombre del `describe`:                             *
 *                                                                              *
 *   AC1 · «Arrastrar/insertar/eliminar y teclear coordenada modifican el modelo *
 *         y se reflejan en mapa y tabla **a la vez**.»                          *
 *   AC2 · «Snap engancha al vértice/lindero más cercano dentro de τ y **se      *
 *         desactiva con la tecla modificadora**.»                               *
 *   AC3 · «Offset de un lado recalcula los vértices contiguos por intersección; *
 *         ~~en ángulo agudo~~ **casi siempre** aplica el fallback **sin          *
 *         explotar**.» ⚠️ El «casi siempre» es la CORRECCIÓN que la propia spec *
 *         se aplicó al medir (hallazgo M2): sobre la parcela real, **1 de los 15 *
 *         lados** corta limpio y los **14 restantes** caen a un fallback. Esta   *
 *         suite afirma el enunciado CORREGIDO, no el original, y lo mide (§ 7·e).*
 *   AC4 · «Superficie/perímetro/Δcatastral se actualizan **durante** el          *
 *         arrastre.»                                                            *
 *   AC5 · «Undo/redo revierten operaciones completas, **no fotogramas** del      *
 *         arrastre.»                                                            *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * LAS CUATRO REGLAS QUE GOBIERNAN ESTE FICHERO                                  *
 * ════════════════════════════════════════════════════════════════════════════ *
 * 1. **SOBRE LA PARCELA REAL, NO SOBRE UN CUADRADO.** Toda la suite trabaja     *
 *    sobre 9398516VK3799G —15 vértices, EPSG:25830, superficie declarada por el *
 *    Catastro 1536 m² y shoelace 1535,87 m²—, que es la que `app/demo-datos.js` *
 *    lleva a la pantalla. Un cuadrado de 10 m no tiene ángulos agudos, ni lados *
 *    casi colineales, ni vértices a 14 cm unos de otros: o sea que no tiene     *
 *    NINGUNO de los casos que estos criterios existen para cubrir. La           *
 *    verdad-terreno se lee del fixture `test/fixtures/geo/parcela-ring.json`    *
 *    (que a su vez sale del GML del WFS) y se comprueba contra `parcelaDemo()`  *
 *    en § 1: si la copia a mano de producción se desviara del fixture, esta     *
 *    suite lo dice antes que ningún criterio.                                   *
 * 2. **CERO ÍNDICES MÁGICOS.** Ni el lado que biselará, ni el que corta limpio, *
 *    ni el más largo, ni el vértice que se arrastra: todos se DERIVAN midiendo  *
 *    la parcela (§ 2). Escribir «el lado 10» dejaría la prueba en verde         *
 *    apuntando a otro sitio el día que se recapture el fixture.                 *
 * 3. **SIN DOBLES DONDE IMPORTA.** Los criterios 1 y 4 son sobre el ENSAMBLAJE: *
 *    se monta `crearVisor` de verdad (mapa Leaflet, capas, tabla, edición,      *
 *    acotaciones e historial) y se accionan GESTOS —`drag`/`dragend` sobre el   *
 *    marcador, `dblclick` y `click` sobre el mapa, `contextmenu` sobre el       *
 *    vértice, `change` sobre la celda—, no llamadas a funciones internas. Lo    *
 *    único doblado es lo que jsdom no puede tener: no hay red, no hay teselas y *
 *    no hay motor de layout (ver § 8).                                          *
 * 4. **NO SE DUPLICAN LAS UNITARIAS.** Hay 2.818 pruebas que ya cubren los      *
 *    módulos por dentro. Aquí cada `it` cita la frase del criterio a la que     *
 *    está atado; si un `it` no puede citarla, no pertenece a este fichero.      *
 *    Lo que se remite, y a dónde:                                               *
 *      · los 54 casos del offset (signo, huecos, triángulos, inmutabilidad,     *
 *        precedencia de modos) → `test/edit/offset.test.js`;                    *
 *      · el catálogo de dianas, los empates y el `excluir` → `test/edit/snap.js`*
 *        y `test/edit/snap.test.js`;                                            *
 *      · la pila, su límite y la rama de redo → `test/edit/historial.test.js`;  *
 *      · la asimetría superficie/perímetro y `deltaCatastral: null` →           *
 *        `test/edit/metricas.test.js`;                                          *
 *      · el mapa de gestos completo, el indicador, el resalte y la reubicación  *
 *        de la selección → `test/viewer/edicion.dom.test.js`;                   *
 *      · el render idempotente y la celda ilegible →                            *
 *        `test/viewer/sincronizacion.dom.test.js`;                              *
 *      · los BOTONES de deshacer/rehacer, sus atajos `Ctrl+Z`/`Ctrl+Y` y el     *
 *        renglón de estado → `test/app/main-edicion.dom.test.js` (ver § 8).     *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * CÓMO SE AFIRMA CADA ADVERBIO (que es donde está el criterio)                  *
 * ════════════════════════════════════════════════════════════════════════════ *
 * · **«a la vez»** (AC1). No basta con que el modelo cambie. Cada operación se  *
 *   observa DENTRO de la notificación del store —esta suite se suscribe DESPUÉS *
 *   de `crearVisor`, así que su callback corre cuando el render ya ha pasado—,  *
 *   y ahí se exige que la fila `tr[data-recinto][data-indice]`, el polígono del *
 *   pane editable y el modelo digan LO MISMO. Un `set` que dejara una de las    *
 *   tres vistas atrás se ve aquí y en el mismo instante en que ocurre. El       *
 *   arrastre es el caso especial y más exigente: durante el gesto no hay `set`  *
 *   ninguno, así que «a la vez» se mide DENTRO DE UN SOLO `drag`.               *
 * · **«dentro de τ» y «la tecla»** (AC2). Los DOS caminos de lectura del        *
 *   modificador, porque ninguno cubre al otro: el `originalEvent.altKey` del    *
 *   gesto real y el seguimiento propio de `keydown`/`keyup` (un arrastre        *
 *   simulado por API no trae evento original — y eso no es una peculiaridad de  *
 *   los tests: es también el camino de cualquier automatismo).                  *
 * · **«sin explotar»** (AC3). Es una afirmación NUMÉRICA: ningún vértice del    *
 *   resultado se aleja más de `miterLimite · |d|` del anillo de partida. Y para *
 *   que no sea vacua, el MISMO caso con `miterLimite: Infinity` —que            *
 *   `edit/offset.js` acepta a propósito— manda un vértice a más de 20 m.        *
 * · **«durante»** (AC4). Las tres cifras cambian DENTRO de un frame de `drag`,  *
 *   con `estado.set` sin llamar y la pila del historial sin crecer. Si solo     *
 *   cambiaran al soltar, el criterio estaría roto y esta suite en rojo.         *
 * · **«no fotogramas»** (AC5). Un arrastre de 8 frames deja EXACTAMENTE un      *
 *   snapshot, el undo devuelve la geometría ORIGINAL (no una intermedia) y      *
 *   ninguna de las 8 posiciones intermedias aparece jamás en la pila.           *
 *                                                                              *
 * ════════════════════════════════════════════════════════════════════════════ *
 * COMPROBADO POR MUTACIÓN (2026-07-28: mutar producción, correr, revertir)      *
 * ════════════════════════════════════════════════════════════════════════════ *
 * Un criterio que nunca se ha visto fallar no es una garantía, es una           *
 * esperanza. Cada mutación se aplicó al fichero de producción indicado, se      *
 * corrió SOLO este fichero                                                      *
 * (`node scripts/vitest.mjs run --project dom test/edit/aceptacion-f06.dom.test.js`) *
 * y se revirtió CON EL EDITOR (nunca con `git checkout --`: hay trabajo sin     *
 * commitear en el árbol y tres tareas en paralelo sobre este mismo árbol).      *
 * NUEVE mutaciones, al menos una por criterio, y **ninguna dejó la suite en     *
 * verde**. Los números son los MEDIDOS, sobre 27 pruebas:                       *
 *                                                                              *
 *   MA1 · `sincronizacion.js#escribirInput` sin escribir (el mapa se mueve, la  *
 *         tabla no) → **6 rojos**: AC1 (a), (a·2), (d), (e), AC3 (a) y AC5 (b). *
 *         Es «a la vez» roto en su forma más pura. Los dos que sobreviven —AC1  *
 *         (b) y (c)— son los que CAMBIAN LA FORMA del anillo, y ahí la tabla se *
 *         reconstruye entera en vez de escribirse celda a celda: por eso hacen  *
 *         falta también MA9 y los casos de forma variable.                      *
 *   MA2 · `edicion.js#toleranciaEfectiva` devolviendo `toleranciaM` sin mirar   *
 *         `altVigente(evento)` (la tecla deja de apagar el snap) → **2 rojos**, *
 *         justo los dos caminos de lectura del AC2, y ningún otro.               *
 *   MA3 · `edicion.js#altVigente` ignorando el evento real y devolviendo        *
 *         siempre `altPulsado` → **1 rojo**, el camino del `originalEvent`. El  *
 *         del seguimiento sigue VERDE: es la prueba de que los dos caminos son  *
 *         independientes y de que ninguno tapa al otro.                          *
 *   MA4 · `offset.js#resolverExtremo` sin la comparación                        *
 *         `salto / magnitud > miterLimite` (no bisela nunca) → **4 rojos**, y   *
 *         el primero es la ANTI-VACUIDAD: «LADO_AGUDO no se ha podido derivar   *
 *         de la parcela», porque sin bisel ya no hay ningún lado que bisele. Es *
 *         exactamente lo que esa guarda existe para decir.                       *
 *   MA5 · `index.js#puentePrevisualizacion` llamando solo a las cotas y no al   *
 *         gancho del llamante → **3 rojos**: los dos del AC4 y el del arranque. *
 *         Las cotas se siguen repintando; la ficha se queda congelada todo el   *
 *         gesto. Los dos consumidores del canal, separados.                      *
 *   MA6 · `sincronizacion.js#alMover` haciendo `aplicarVertice` por frame (el   *
 *         «arreglo» que rompe el criterio 5) → **7 rojos**, el más letal: los   *
 *         dos del AC5 sobre el arrastre, tres del AC1 y los dos del AC4. Un     *
 *         `set` por fotograma se ve desde CUATRO criterios distintos.            *
 *   MA7 · `edicion.js#aplicarRecintos` sin `commitHistorial` (insertar,          *
 *         eliminar y offset dejan de ser deshacibles) → **1 rojo**, el AC5 (c). *
 *   MA8 · `edit/snap.js#ajustar` devolviendo siempre `sinEnganche()` → **4      *
 *         rojos**: los cuatro del AC2 que afirman que el snap ENGANCHA. Los de  *
 *         la tecla no caen —lógico: con el snap muerto, apagarlo no se nota—, y *
 *         por eso MA2 y MA8 son dos mutaciones y no una.                         *
 *   MA9 · `sincronizacion.js#mismaForma` comparando solo el nº de recintos (un  *
 *         cambio en el nº de VÉRTICES deja de reconstruir la vista) → **4       *
 *         rojos**: AC1 (b), (c), (e) y AC5 (c), o sea EXACTAMENTE las           *
 *         operaciones que cambian la forma del anillo. Es la mitad de «a la     *
 *         vez» que MA1 no alcanza.                                              *
 *                                                                              *
 * ⚠️ **No se ha encontrado ningún fallo real de producción**: los 32 rojos      *
 * provocados desaparecieron al revertir, y no hay ni un `it.fails` ni un        *
 * `it.todo` en este fichero.                                                     *
 *                                                                              *
 * Proyecto Vitest `dom` (jsdom): el sufijo `.dom.test.js` lo enruta ahí, porque *
 * `viewer/index.js` arrastra Leaflet. NINGUNA petición de red: jsdom no         *
 * descarga imágenes y aquí no se dispara ni un `load`.                          *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, it, expect, afterEach } from 'vitest'
import L from 'leaflet'

import { SRS_DEMO, parcelaDemo } from '../../app/demo-datos.js'
import { OPERATIVOS } from '../../config/operativos.js'
import { crearHistorial, redo, reiniciar, undo } from '../../edit/historial.js'
import { metricas } from '../../edit/metricas.js'
import { MODO_OFFSET, TIPO_OFFSET, desplazarLado } from '../../edit/offset.js'
import { MINIMO_VERTICES } from '../../edit/vertices.js'
import { ORIGEN_PARCELA, TIPO_RECINTO, crearParcela, crearRecinto } from '../../model/parcela.js'
import { NIVEL, PANE, crearEstadoVista, latLngAUTM, vertUTMaLatLng } from '../../viewer/_comun.js'
import { CLASE_EDICION } from '../../viewer/edicion.js'
import { CLASE_ACOTACION } from '../../viewer/acotaciones.js'
import { crearVisor } from '../../viewer/index.js'
import { crearContenedor } from '../viewer/_ayuda-jsdom.js'

// ═════════════════════════════════════════════════════════════════════════════
// 1 · La verdad-terreno: la parcela REAL, leída del fixture
// ═════════════════════════════════════════════════════════════════════════════
//
// `import.meta.dirname` y no `fileURLToPath(import.meta.url)`: bajo jsdom la URL
// del módulo no es de esquema `file:` y aquella conversión lanza (mismo camino
// que `test/app/catastro.dom.test.js`).

const RAIZ = join(import.meta.dirname, '..', '..')

/** El fixture del que sale TODO lo que esta suite da por sabido. */
const FIXTURE = JSON.parse(
  readFileSync(join(RAIZ, 'test', 'fixtures', 'geo', 'parcela-ring.json'), 'utf8'),
)

/** Anillo EXTERIOR abierto de 9398516VK3799G, UTM EPSG:25830. */
const ANILLO = FIXTURE.anilloExterior
/** `cp:areaValue`: la superficie que el Catastro DECLARA. No es una medición. */
const AREA_DECLARADA = FIXTURE.areaValue
const REFCAT = FIXTURE.refCatastral
const SRS = FIXTURE.srs
const HUSO = FIXTURE.huso

// ── Oráculos propios, que NO comparten código con lo que se prueba ───────────
//
// La geometría de referencia se calcula aquí a mano (cuatro líneas) en vez de
// pedírsela a `geo/`: preguntarle a un módulo si está de acuerdo consigo mismo
// no es un oráculo. Es la misma disciplina que `test/gml/aceptacion-f04.test.js`.

const dist = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1])

/**
 * Área firmada por la fórmula del cordón de zapato (shoelace).
 *
 * ⚠️ **Trasladada a un origen local** (el primer vértice), que es la regla de oro
 * 5 del proyecto y no un adorno: sumada sobre las coordenadas UTM ABSOLUTAS
 * —Este ≈ 4,4·10⁵, Norte ≈ 4,5·10⁶— la misma fórmula pierde ~4·10⁻⁵ m² por
 * cancelación catastrófica en float64. Medido: sin trasladar, este oráculo daba
 * −1535,8651123 frente a los −1535,8651500 del fixture. La resta es exacta
 * (mismo exponente) y el producto ya trabaja con números de orden 10¹.
 */
function shoelace(anillo) {
  const [ox, oy] = anillo[0]
  let suma = 0
  for (let i = 0; i < anillo.length; i++) {
    const a = anillo[i]
    const b = anillo[(i + 1) % anillo.length]
    suma += (a[0] - ox) * (b[1] - oy) - (b[0] - ox) * (a[1] - oy)
  }
  return suma / 2
}

/** Longitud del anillo CERRADO (perímetro), sumando lado a lado. */
function perimetroDe(anillo) {
  let total = 0
  for (let i = 0; i < anillo.length; i++) total += dist(anillo[i], anillo[(i + 1) % anillo.length])
  return total
}

/** Distancia de `p` a la RECTA (infinita) que pasa por `a` y `b`. */
function distanciaARecta(p, a, b) {
  const cruz = (b[0] - a[0]) * (p[1] - a[1]) - (b[1] - a[1]) * (p[0] - a[0])
  return Math.abs(cruz) / dist(a, b)
}

/** Lo que más se ha alejado un vértice del RESULTADO respecto del anillo de partida. */
const maxSalto = (resultado, anillo) =>
  Math.max(...resultado.map((p) => Math.min(...anillo.map((q) => dist(p, q)))))

/**
 * La parcela real, con su `superficieCatastral` DECLARADA puesta.
 *
 * `parcelaDemo()` no la porta (la app la recibe del WFS en F05), y sin ella
 * `deltaCatastral` sería `null` —«no hay con qué comparar»— y el criterio 4 no
 * se podría afirmar entero. El número sale del fixture, no de aquí.
 *
 * @returns {object}
 */
function parcelaReal() {
  const base = parcelaDemo()
  return crearParcela({
    idLocal: base.idLocal,
    refcat: base.refcat,
    origen: ORIGEN_PARCELA.WFS,
    recintos: base.recintos.map((r) => crearRecinto(r.vertices, r.tipo)),
    geometriaOficial: base.geometriaOficial.map((r) => crearRecinto(r.vertices, r.tipo)),
    superficieCatastral: AREA_DECLARADA,
  })
}

// ═════════════════════════════════════════════════════════════════════════════
// 2 · Los lados que cada criterio necesita, DERIVADOS de la parcela
// ═════════════════════════════════════════════════════════════════════════════
//
// Cero índices escritos a mano (regla 2 de la cabecera). Los tres se eligen
// midiendo, y § 3 comprueba que los tres existen: si un día la parcela dejara de
// tener un lado que bisela, esta suite lo diría en vez de pasar en verde
// afirmando algo que ya no ocurre.

const LADOS = ANILLO.map((_, i) => i)

/** Ensayo del offset sobre la parcela de partida, sin tocar nada. */
const ensayarOffset = (indice, distancia, opciones) =>
  desplazarLado(
    [crearRecinto(ANILLO, TIPO_RECINTO.EXTERIOR)],
    { recinto: 0, indice },
    distancia,
    opciones,
  )

/** Desplazamiento del caso LIMPIO del AC3, en metros. */
const D_MITER = 0.5
/** Desplazamiento del caso AGUDO del AC3, en metros. */
const D_AGUDO = 1

/**
 * El lado que corta LIMPIO por los dos extremos: modo MITER y ni una detección.
 * Es el caso canónico de «recalcula los vértices contiguos por intersección».
 */
const LADO_MITER = LADOS.find((i) => {
  const r = ensayarOffset(i, D_MITER)
  return r.modo === MODO_OFFSET.MITER && r.detecciones.length === 0
})

/**
 * El lado cuyo ángulo agudo MÁS lejos mandaría el vértice si no hubiera guarda.
 * Se ordena por el salto SIN miter-limit, así que es el peor caso real de la
 * parcela, no uno cualquiera de los que biselan.
 */
const LADO_AGUDO = LADOS.filter((i) => ensayarOffset(i, D_AGUDO).modo === MODO_OFFSET.BEVEL).sort(
  (a, b) =>
    maxSalto(ensayarOffset(b, D_AGUDO, { miterLimite: Infinity }).recintos[0].vertices, ANILLO) -
    maxSalto(ensayarOffset(a, D_AGUDO, { miterLimite: Infinity }).recintos[0].vertices, ANILLO),
)[0]

/** El lado MÁS LARGO: la diana inequívoca del clic, del doble clic y del snap. */
const LADO_LARGO = LADOS.reduce((mejor, i) =>
  dist(ANILLO[i], ANILLO[(i + 1) % ANILLO.length]) >
  dist(ANILLO[mejor], ANILLO[(mejor + 1) % ANILLO.length])
    ? i
    : mejor,
)

/** Punto medio de un lado del anillo, en UTM. */
function medioDelLado(indice, anillo = ANILLO) {
  const a = anillo[indice]
  const b = anillo[(indice + 1) % anillo.length]
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]
}

/** Normal unitaria del lado `indice` (perpendicular a él). */
function normalDelLado(indice, anillo = ANILLO) {
  const a = anillo[indice]
  const b = anillo[(indice + 1) % anillo.length]
  const largo = dist(a, b)
  return [(b[1] - a[1]) / largo, -(b[0] - a[0]) / largo]
}

/**
 * El vértice que se arrastra en casi toda la suite: el 0.
 *
 * Se declara con nombre en vez de escribir `0` suelto por todas partes, porque
 * lo que importa de él es una propiedad, no su número: es el vértice cuyo caso
 * de `excluir` es el frágil (sus dos lados son el de CIERRE y el PRIMERO, ver
 * `edit/snap.js`), así que arrastrarlo ejercita el camino que más fácil se
 * rompe.
 */
const VERT = 0

// ═════════════════════════════════════════════════════════════════════════════
// 3 · El banco de pruebas: el visor COMPLETO, con edición e historial
// ═════════════════════════════════════════════════════════════════════════════

/** Limpieza garantizada aunque un `expect` falle a mitad de test (LIFO). */
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
  document.body.replaceChildren()
})

/**
 * Mide como lo hace la FICHA DEL PIE, con la misma función y en el mismo orden
 * que `app/main.js#previsualizarMedidas`: los anillos EN VUELO llevan el `tipo`
 * de su recinto por posición (el invariante EXTERIOR/HUECO que `geo/area.js`
 * exige), y la declarada sale del POJO del store.
 *
 * @param {Array<Array<[number, number]>>} anillosUTM
 * @param {object|null} parcelaActual
 * @returns {object}  Lo que devuelve `edit/metricas.js#metricas`.
 */
function medirComoLaFicha(anillosUTM, parcelaActual) {
  const base = parcelaActual && Array.isArray(parcelaActual.recintos) ? parcelaActual.recintos : []
  return metricas(
    anillosUTM.map((vertices, i) => ({ ...base[i], vertices })),
    { superficieCatastral: parcelaActual ? parcelaActual.superficieCatastral : null },
  )
}

/**
 * Monta el visor REAL sobre la parcela real: mapa Leaflet con tamaño utilizable,
 * capas, tabla de vértices, la edición de F06 con sus acotaciones, y el historial
 * YA SEMBRADO (la decisión 1 de F06: sin semilla, el primer `undo` no tendría a
 * dónde volver).
 *
 * Las cuatro animaciones van desactivadas por el REST de opciones: son
 * transiciones CSS que jsdom nunca resuelve (el porqué completo está en la
 * cabecera de `test/viewer/_ayuda-jsdom.js`).
 *
 * @param {object} [opciones]
 * @returns {object}  El banco: visor, store, historial, tabla, avisos y medidas.
 */
function abrirBanco({ parcela = parcelaReal(), edicion = true, ...resto } = {}) {
  const contenedor = crearContenedor()
  // `<div>` y no `<table>`, como `index.html`: `sincronizar` crea la tabla dentro.
  const tablaEl = document.createElement('div')
  document.body.appendChild(tablaEl)

  const estado = crearEstadoVista(parcela)
  const historial = crearHistorial()
  reiniciar(historial, parcela)

  const avisos = []
  /** Lo que la ficha del pie habría pintado, en orden. */
  const medidas = []

  const visor = crearVisor(contenedor, {
    estado,
    tablaEl,
    srs: SRS_DEMO,
    historial,
    edicion,
    alAvisar: (mensaje, detalle) => avisos.push({ mensaje, nivel: detalle && detalle.nivel }),
    alPrevisualizar: (anillosUTM) => medidas.push(medirComoLaFicha(anillosUTM, estado.get())),
    zoomAnimation: false,
    fadeAnimation: false,
    markerZoomAnimation: false,
    inertia: false,
    ...resto,
  })
  pendientes.push(() => visor.destruir())

  return { contenedor, tablaEl, estado, historial, visor, avisos, medidas, parcela }
}

// ── Localizadores (los selectores documentados de `viewer/sincronizacion.js`) ─

/** Marcadores del visor indexados por su `refVertice` (`'recinto:indice'`). */
function marcadoresPorRef(mapa) {
  const porRef = new Map()
  mapa.eachLayer((capa) => {
    if (capa.refVertice) porRef.set(`${capa.refVertice.recinto}:${capa.refVertice.indice}`, capa)
  })
  return porRef
}

const marcadorDe = (mapa, recinto, indice) => marcadoresPorRef(mapa).get(`${recinto}:${indice}`)

/** El polígono de la geometría EDITABLE (por su pane, derivado de `PANE`). */
function poligonoEditadoDe(mapa) {
  let encontrado = null
  mapa.eachLayer((capa) => {
    if (capa instanceof L.Polygon && capa.options.pane === PANE.PARCELA_EDITADA) encontrado = capa
  })
  return encontrado
}

/**
 * El indicador de enganche, o `null`.
 *
 * Se localiza por su CLASE CSS, no por su clase de Leaflet: desde que las siluetas
 * son SVG (la convención OSNAP de AutoCAD — cuadrado para vértice, reloj de arena
 * para lindero) es un `L.Marker` con `divIcon`, igual que los vértices que pinta
 * `viewer/sincronizacion.js`, así que el tipo de Leaflet ya no lo distingue de
 * ellos. La clase SÍ es contrato público (`CLASE_EDICION`).
 */
function indicadorDe(mapa) {
  let encontrado = null
  mapa.eachLayer((capa) => {
    const clase = String(capa.options?.icon?.options?.className ?? '')
    if (capa instanceof L.Marker && clase.includes(CLASE_EDICION.INDICADOR)) encontrado = capa
  })
  return encontrado
}

const filaDe = (tablaEl, recinto, indice) =>
  tablaEl.querySelector(`tr[data-recinto="${recinto}"][data-indice="${indice}"]`)

const inputDe = (fila, eje) => fila.querySelector(`input[data-eje="${eje}"]`)

/** Teclea un valor y TERMINA la edición: `change`, nunca `input` (hallazgo C7). */
function cambiarCelda(input, texto) {
  input.value = texto
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

/** Los textos de las cotas que hay AHORA MISMO sobre el dibujo. */
const cotasDe = (contenedor) =>
  [...contenedor.querySelectorAll(`.${CLASE_ACOTACION}`)].map((el) => el.textContent)

/**
 * Las TRES VISTAS del recinto exterior, leídas a la vez: el modelo, la tabla y
 * el dibujo. Es la pieza central del AC1 — «a la vez» significa que estas tres
 * listas coinciden, y coinciden en el mismo instante.
 *
 * @param {object} banco
 * @returns {{modelo: Array, tabla: Array, dibujo: Array}}
 */
function tresVistas({ estado, tablaEl, visor }) {
  const modelo = estado.get().recintos[0].vertices.map(([x, y]) => [x, y])
  const tabla = [...tablaEl.querySelectorAll('tr[data-recinto="0"][data-indice]')].map((tr) => [
    Number(inputDe(tr, 'x').value),
    Number(inputDe(tr, 'y').value),
  ])
  const dibujo = poligonoEditadoDe(visor.mapa)
    .getLatLngs()[0]
    .map((p) => latLngAUTM(p, HUSO))
  return { modelo, tabla, dibujo }
}

/**
 * Afirma que las tres vistas dicen LO MISMO, vértice a vértice.
 *
 * Las tolerancias no son laxitud: la tabla muestra 3 decimales
 * (`formatearCoordenada`) y el dibujo pasa por lat/lon, así que exigir igualdad
 * de bits sería exigir que dos vistas no fueran vistas. 1 mm en la tabla y
 * 1 µm en el mapa son órdenes de magnitud por debajo de cualquier error real.
 *
 * @param {{modelo: Array, tabla: Array, dibujo: Array}} vistas
 * @param {string} cuando
 */
function afirmarTresVistasAlineadas({ modelo, tabla, dibujo }, cuando) {
  expect(tabla, `${cuando}: la tabla tiene otro número de filas que el modelo`).toHaveLength(
    modelo.length,
  )
  expect(dibujo, `${cuando}: el dibujo tiene otro número de puntos que el modelo`).toHaveLength(
    modelo.length,
  )
  for (let i = 0; i < modelo.length; i++) {
    expect(tabla[i][0], `${cuando}: la X de la fila ${i} no es la del modelo`).toBeCloseTo(
      modelo[i][0],
      3,
    )
    expect(tabla[i][1], `${cuando}: la Y de la fila ${i} no es la del modelo`).toBeCloseTo(
      modelo[i][1],
      3,
    )
    expect(dist(dibujo[i], modelo[i]), `${cuando}: el punto ${i} del dibujo no es el del modelo`)
      .toBeLessThan(1e-6)
  }
}

/**
 * Se suscribe al store y fotografía las TRES VISTAS en cada notificación.
 *
 * ⚠️ La suscripción ocurre DESPUÉS de `crearVisor`, y de eso depende todo: los
 * suscriptores se notifican en orden de alta, así que cuando corre este callback
 * el render de `sincronizacion.js` YA ha pasado. Una vista que se quedara atrás
 * en ese `set` se ve aquí, en el mismo instante en que ocurre.
 *
 * @param {object} banco
 * @returns {Array}  Una entrada por `set`, con las tres vistas de ese momento.
 */
function fotografiarCadaSet(banco) {
  const fotos = []
  pendientes.push(banco.estado.subscribe(() => fotos.push(tresVistas(banco))))
  return fotos
}

/** Cuenta los `set` que llegan a las vistas (el «sin bucle» de F03, aquí el «cuándo»). */
function contarSets(estado) {
  let n = 0
  pendientes.push(estado.subscribe(() => n++))
  return () => n
}

/**
 * Un GESTO de arrastre completo: coloca el marcador, emite `frames` eventos
 * `drag` y cierra con `dragend`.
 *
 * `evento` es lo que Leaflet llamaría `originalEvent`. Cuando es `null` no se
 * pasa NINGUNO, que es exactamente lo que ocurre en un arrastre simulado por API
 * y el camino que obliga al seguimiento propio de la tecla (ver AC2).
 */
function arrastrar(marcador, destinoUTM, { evento = null, frames = 1 } = {}) {
  marcador.setLatLng(vertUTMaLatLng(destinoUTM, HUSO))
  const datos = evento === null ? undefined : { originalEvent: evento }
  for (let f = 0; f < frames; f++) marcador.fire('drag', datos)
  marcador.fire('dragend', datos)
}

// ═════════════════════════════════════════════════════════════════════════════
// 4 · Anti-vacuidad: la parcela real es la real, y trae los casos que hacen falta
// ═════════════════════════════════════════════════════════════════════════════

describe('F06 · aceptación · la parcela sobre la que se acepta es la REAL', () => {
  it('el fixture y la copia de `app/demo-datos.js` dicen lo MISMO, vértice a vértice', () => {
    // La cabecera de `demo-datos.js` declara que sus 15 vértices están COPIADOS a
    // mano desde este fixture y que, si divergen, manda el fixture. Esto es lo
    // que convierte esa declaración en una comprobación.
    const demo = parcelaDemo()
    expect(demo.recintos, 'la parcela real tiene UN recinto exterior').toHaveLength(1)
    expect(demo.recintos[0].vertices).toEqual(ANILLO)
    expect(demo.geometriaOficial[0].vertices, 'recién cargada, editable === oficial').toEqual(ANILLO)
    expect(demo.refcat).toBe(REFCAT)
    expect(SRS_DEMO, 'el SRS del dataset debe ser el del fixture').toBe(SRS)
  })

  it('15 vértices, huso 30, y la superficie MEDIDA no es la DECLARADA (1535,87 ≠ 1536)', () => {
    expect(ANILLO).toHaveLength(15)
    expect(HUSO).toBe(30)
    // Norte ≈ 4,48·10⁶ y Este ≈ 4,39·10⁵: si algo trabajara en lat/lon, se vería.
    expect(ANILLO[0][0]).toBeGreaterThan(400000)
    expect(ANILLO[0][1]).toBeGreaterThan(4000000)

    // Oráculo propio (shoelace de cuatro líneas) contra el fixture y contra el
    // módulo que la app usa para medir. Los tres tienen que coincidir.
    expect(shoelace(ANILLO)).toBeCloseTo(FIXTURE._verificado.areaFirmada, 9)
    const medida = metricas([crearRecinto(ANILLO, TIPO_RECINTO.EXTERIOR)], {
      superficieCatastral: AREA_DECLARADA,
    })
    expect(medida.superficie).toBeCloseTo(Math.abs(shoelace(ANILLO)), 9)
    expect(medida.perimetro.exterior).toBeCloseTo(perimetroDe(ANILLO), 9)

    // Y la Δ del criterio 4 EXISTE y no es cero: sin esto, «Δcatastral se
    // actualiza» se podría afirmar sobre un `null` y no significaría nada.
    expect(AREA_DECLARADA, 'el Catastro declara un entero de m²').toBe(1536)
    expect(medida.deltaCatastral, 'con declarada, la Δ no puede ser null').not.toBeNull()
    expect(medida.deltaCatastral.absoluto).toBeCloseTo(-0.134850003239, 6)
  })

  it('la parcela trae los TRES lados que los criterios necesitan, y son distintos', () => {
    // Sin esto, un `find` que no encontrara nada dejaría `undefined` en un índice
    // y los criterios fallarían por una razón que no es la suya.
    for (const [rotulo, indice] of [
      ['LADO_MITER', LADO_MITER],
      ['LADO_AGUDO', LADO_AGUDO],
      ['LADO_LARGO', LADO_LARGO],
    ]) {
      expect(Number.isInteger(indice), `${rotulo} no se ha podido derivar de la parcela`).toBe(true)
      expect(indice, `${rotulo} fuera del anillo`).toBeLessThan(ANILLO.length)
    }
    // El caso limpio y el caso agudo tienen que ser CASOS DISTINTOS, o el AC3
    // estaría probando dos veces lo mismo.
    expect(LADO_MITER, 'el lado que corta limpio y el que bisela son el mismo').not.toBe(LADO_AGUDO)
    expect(ensayarOffset(LADO_MITER, D_MITER).modo).toBe(MODO_OFFSET.MITER)
    expect(ensayarOffset(LADO_AGUDO, D_AGUDO).modo).toBe(MODO_OFFSET.BEVEL)
  })

  it('el visor arranca montado ENTERO: edición, acotaciones, 15 marcadores y 15 filas', () => {
    const banco = abrirBanco()
    expect(banco.visor.edicion, 'sin `visor.edicion` no hay F06 que aceptar').not.toBeNull()
    expect(banco.visor.acotaciones, 'las cotas son la otra mitad de la opción').not.toBeNull()
    expect(marcadoresPorRef(banco.visor.mapa).size).toBe(ANILLO.length)
    expect(banco.tablaEl.querySelectorAll('tr[data-indice]')).toHaveLength(ANILLO.length)
    expect(poligonoEditadoDe(banco.visor.mapa), 'debe existir el polígono editable').not.toBeNull()
    // La pila nace SEMBRADA (decisión 1 de F06): hay un presente al que volver.
    expect(banco.historial.pila).toHaveLength(1)
    expect(banco.historial.indice).toBe(0)
    // Y el canal en vivo nace abierto: la ficha está pintada desde el arranque.
    expect(banco.medidas.length, 'el visor fuerza un render tras encuadrar').toBeGreaterThan(0)
    expect(cotasDe(banco.contenedor).length, 'sin cotas no habría retroalimentación').toBeGreaterThan(
      0,
    )
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 5 · AC1 · «Arrastrar/insertar/eliminar y teclear coordenada modifican el
//           modelo y se reflejan en mapa y tabla A LA VEZ.»
// ═════════════════════════════════════════════════════════════════════════════
//
// Las CUATRO operaciones, accionadas como GESTOS (no como llamadas internas):
// `drag`/`dragend` sobre el marcador, `dblclick` sobre el mapa, `contextmenu`
// sobre el vértice y `change` sobre la celda. Y en las cuatro se exige lo mismo:
// que el modelo cambie, y que la fila y el polígono lo enseñen ya —no en el
// siguiente ciclo, no cuando alguien refresque—.

describe('F06 · AC1 · arrastrar/insertar/eliminar y teclear modifican el modelo y se reflejan en mapa y tabla a la vez', () => {
  it('(a) ARRASTRAR: dentro de UN SOLO `drag`, fila y polígono ya se han movido — y el modelo aún no', () => {
    const banco = abrirBanco()
    const { visor, tablaEl, estado } = banco
    const sets = contarSets(estado)

    const marcador = marcadorDe(visor.mapa, 0, VERT)
    const fila = filaDe(tablaEl, 0, VERT)
    const xAntes = Number(inputDe(fila, 'x').value)
    const modeloAntes = structuredClone(estado.get())

    // 3 m al Este y 2 m al Norte: muy por encima de τ (20 cm), así que el snap no
    // tiene nada que decir y lo que se mide es el arrastre, no el enganche.
    const destino = [ANILLO[VERT][0] + 3, ANILLO[VERT][1] + 2]
    marcador.setLatLng(vertUTMaLatLng(destino, HUSO))
    marcador.fire('drag')

    // «…se reflejan en mapa y tabla A LA VEZ»: las dos, en el mismo frame.
    expect(Number(inputDe(fila, 'x').value), 'la celda X debe seguir al marcador').toBeCloseTo(
      destino[0],
      2,
    )
    expect(Number(inputDe(fila, 'y').value)).toBeCloseTo(destino[1], 2)
    expect(Number(inputDe(fila, 'x').value)).not.toBe(xAntes)
    const enDibujo = latLngAUTM(poligonoEditadoDe(visor.mapa).getLatLngs()[0][VERT], HUSO)
    expect(dist(enDibujo, destino), 'el polígono debe seguir al marcador').toBeLessThan(1e-6)

    // Y el modelo NO: un gesto en curso no es una operación acabada (es lo que
    // sostiene el criterio 5, y aquí se comprueba desde el criterio 1).
    expect(sets(), 'un frame de arrastre no debe hacer NINGÚN set').toBe(0)
    expect(estado.get(), 'el modelo no cambia hasta que el gesto acaba').toEqual(modeloAntes)
  })

  it('(a·2) …y al SOLTAR, el modelo cambia y las tres vistas coinciden en la MISMA notificación', () => {
    const banco = abrirBanco()
    const { visor, estado } = banco
    const fotos = fotografiarCadaSet(banco)

    const destino = [ANILLO[VERT][0] + 3, ANILLO[VERT][1] + 2]
    arrastrar(marcadorDe(visor.mapa, 0, VERT), destino, { frames: 3 })

    expect(fotos, 'un gesto acabado = UN set, sin importar los frames').toHaveLength(1)
    afirmarTresVistasAlineadas(fotos[0], 'al soltar el arrastre')
    // El modelo va en UTM y es el destino, no una posición intermedia.
    expect(dist(fotos[0].modelo[VERT], destino)).toBeLessThan(1e-6)
    expect(estado.get().recintos[0].vertices).toHaveLength(ANILLO.length)
  })

  it('(b) INSERTAR (doble clic sobre el lindero): 15 → 16 en el modelo, en la tabla y en el dibujo, a la vez', () => {
    const banco = abrirBanco()
    const { visor, estado } = banco
    const fotos = fotografiarCadaSet(banco)

    // Se pincha en el PUNTO MEDIO del lado más largo: la diana es inequívoca y el
    // pie de la proyección cae dentro del lado (no en un extremo, donde ya hay
    // vértice y `viewer/edicion.js` se niega a propósito).
    const medio = medioDelLado(LADO_LARGO)
    visor.mapa.fire('dblclick', { latlng: vertUTMaLatLng(medio, HUSO) })

    expect(fotos, 'insertar es UNA operación: UN set').toHaveLength(1)
    expect(fotos[0].modelo, 'el anillo debe crecer en un vértice').toHaveLength(ANILLO.length + 1)
    afirmarTresVistasAlineadas(fotos[0], 'tras insertar')

    // El vértice NUEVO entra detrás del que abre el lado, y es el punto medio: se
    // inserta el PIE de la proyección, no el punto crudo del clic.
    const nuevo = fotos[0].modelo[LADO_LARGO + 1]
    expect(dist(nuevo, medio), 'el vértice nuevo debe ser el pie sobre el lindero').toBeLessThan(
      1e-6,
    )
    // Y las tres vistas tienen ya la fila y el marcador del vértice nuevo.
    expect(filaDe(banco.tablaEl, 0, LADO_LARGO + 1), 'falta la fila del vértice nuevo').not.toBeNull()
    expect(marcadoresPorRef(visor.mapa).size).toBe(ANILLO.length + 1)
    expect(estado.get().recintos[0].vertices).toHaveLength(ANILLO.length + 1)
  })

  it('(c) ELIMINAR (menú contextual sobre el vértice): 15 → 14 en las tres vistas, a la vez', () => {
    const banco = abrirBanco()
    const { visor } = banco
    const fotos = fotografiarCadaSet(banco)

    const borrado = ANILLO[VERT]
    marcadorDe(visor.mapa, 0, VERT).fire('contextmenu')

    expect(fotos, 'eliminar es UNA operación: UN set').toHaveLength(1)
    expect(fotos[0].modelo).toHaveLength(ANILLO.length - 1)
    afirmarTresVistasAlineadas(fotos[0], 'tras eliminar')
    // El que se ha ido es el que se pidió, y el resto conserva su orden.
    expect(fotos[0].modelo.some((p) => dist(p, borrado) < 1e-9), 'el vértice sigue ahí').toBe(false)
    expect(fotos[0].modelo[0]).toEqual(ANILLO[VERT + 1])
    expect(marcadoresPorRef(visor.mapa).size).toBe(ANILLO.length - 1)
    expect(banco.tablaEl.querySelectorAll('tr[data-indice]')).toHaveLength(ANILLO.length - 1)
    // Queda muy por encima del mínimo: esto no es el caso de «no se puede borrar».
    expect(fotos[0].modelo.length).toBeGreaterThan(MINIMO_VERTICES)
  })

  it('(d) TECLEAR la coordenada en la celda: el modelo, el marcador y el polígono lo recogen a la vez', () => {
    const banco = abrirBanco()
    const { visor, tablaEl, estado } = banco
    const fotos = fotografiarCadaSet(banco)

    // Se teclea con COMA, que es lo que teclea un usuario español, y un valor
    // DERIVADO del fixture (1,25 m al Este del vértice 3).
    const indice = 3
    const nuevoX = ANILLO[indice][0] + 1.25
    cambiarCelda(inputDe(filaDe(tablaEl, 0, indice), 'x'), String(nuevoX).replace('.', ','))

    expect(fotos, 'teclear una celda es UNA operación: UN set').toHaveLength(1)
    afirmarTresVistasAlineadas(fotos[0], 'tras teclear la celda')
    expect(fotos[0].modelo[indice][0]).toBeCloseTo(nuevoX, 6)
    expect(fotos[0].modelo[indice][1], 'la Y no se toca al editar la X').toBeCloseTo(
      ANILLO[indice][1],
      6,
    )
    // «…y viceversa»: el MARCADOR es la tercera vista del mismo vértice.
    const enMarcador = latLngAUTM(marcadorDe(visor.mapa, 0, indice).getLatLng(), HUSO)
    expect(dist(enMarcador, [nuevoX, ANILLO[indice][1]])).toBeLessThan(1e-6)
    expect(estado.get().recintos[0].vertices[indice][0]).toBeCloseTo(nuevoX, 6)
  })

  it('(e) las CUATRO seguidas: ninguna vista se descuelga por el camino', () => {
    // El caso que ninguna operación aislada cubre: que las cuatro compuestas
    // dejen las tres vistas alineadas. Si una reconstrucción dejara la tabla con
    // el recuento viejo o el polígono con un punto de más, saldría aquí.
    const banco = abrirBanco()
    const { visor, tablaEl } = banco
    const fotos = fotografiarCadaSet(banco)

    arrastrar(marcadorDe(visor.mapa, 0, VERT), [ANILLO[VERT][0] + 3, ANILLO[VERT][1] + 2])
    visor.mapa.fire('dblclick', { latlng: vertUTMaLatLng(medioDelLado(LADO_LARGO), HUSO) })
    marcadorDe(visor.mapa, 0, 5).fire('contextmenu')
    const fila = filaDe(tablaEl, 0, 2)
    cambiarCelda(inputDe(fila, 'y'), String(Number(inputDe(fila, 'y').value) + 0.4))

    expect(fotos, 'cuatro operaciones acabadas = cuatro sets').toHaveLength(4)
    fotos.forEach((foto, i) => afirmarTresVistasAlineadas(foto, `tras la operación ${i + 1}`))
    // 15 − 0 + 1 − 1 = 15: el recuento final cuadra con lo que se hizo.
    expect(fotos[3].modelo).toHaveLength(ANILLO.length)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 6 · AC2 · «Snap engancha al vértice/lindero más cercano dentro de τ y SE
//           DESACTIVA CON LA TECLA MODIFICADORA.»
// ═════════════════════════════════════════════════════════════════════════════
//
// La diana del enganche es `parcela.geometriaOficial`, o sea el parcelario
// oficial del Catastro, que es el caso de uso entero de F06 («ajustar unos
// vértices sobre la parcela oficial»). Y `excluir` NO se aplica a la oficial a
// propósito (`edit/snap.js`): por eso mover un vértice MENOS de τ lo devuelve a
// su sitio oficial. Eso no es un fallo del snap — es lo que el snap significa, y
// para eso está la tecla.

describe('F06 · AC2 · el snap engancha al vértice/lindero más cercano dentro de τ y se desactiva con la tecla modificadora', () => {
  /** Desplazamiento de prueba: la mitad de τ, o sea claramente DENTRO. */
  const DENTRO_DE_TAU = OPERATIVOS.snapMetros / 2

  it('(a) "engancha al VÉRTICE más cercano dentro de τ": a media τ del oficial, vuelve EXACTAMENTE a él', () => {
    const banco = abrirBanco()
    const marcador = marcadorDe(banco.visor.mapa, 0, VERT)

    const destino = [ANILLO[VERT][0] + DENTRO_DE_TAU, ANILLO[VERT][1]]
    // Un frame de `drag` antes de soltar: es donde aparece el indicador visual.
    marcador.setLatLng(vertUTMaLatLng(destino, HUSO))
    marcador.fire('drag')
    const indicador = indicadorDe(banco.visor.mapa)
    expect(indicador, 'el enganche tiene que verse mientras dura el gesto').not.toBeNull()
    expect(indicador.getElement().className).toContain(CLASE_EDICION.INDICADOR_VERTICE)
    marcador.fire('dragend')

    // EXACTAMENTE el vértice oficial: el snap escribe la diana, no una
    // aproximación (por eso `toEqual` y no `toBeCloseTo`).
    expect(banco.estado.get().recintos[0].vertices[VERT]).toEqual(ANILLO[VERT])
    // Y el indicador es del GESTO: se va con él.
    expect(indicadorDe(banco.visor.mapa), 'el indicador no sobrevive al gesto').toBeNull()
  })

  it('(b) "…o al LINDERO más cercano": a 5 cm del lindero, el vértice cae SOBRE la línea, no en el cursor', () => {
    const banco = abrirBanco()
    const marcador = marcadorDe(banco.visor.mapa, 0, VERT)

    // 5 cm por fuera del punto medio del lado más largo (a 16 m de cualquier
    // vértice, así que no hay ningún candidato de tipo VERTICE que pueda ganar).
    const separacion = 0.05
    const medio = medioDelLado(LADO_LARGO)
    const normal = normalDelLado(LADO_LARGO)
    const destino = [medio[0] + separacion * normal[0], medio[1] + separacion * normal[1]]

    marcador.setLatLng(vertUTMaLatLng(destino, HUSO))
    marcador.fire('drag')
    expect(indicadorDe(banco.visor.mapa).getElement().className).toContain(
      CLASE_EDICION.INDICADOR_LINDERO,
    )
    marcador.fire('dragend')

    const puesto = banco.estado.get().recintos[0].vertices[VERT]
    const A = ANILLO[LADO_LARGO]
    const B = ANILLO[(LADO_LARGO + 1) % ANILLO.length]
    // Sobre la línea (proyección punto→segmento del spec), no donde estaba el cursor.
    expect(distanciaARecta(puesto, A, B), 'el vértice debe caer SOBRE el lindero').toBeLessThan(1e-6)
    expect(dist(puesto, destino), 'y a la distancia que había: los 5 cm que se enganchan')
      .toBeCloseTo(separacion, 6)
    expect(dist(puesto, medio), 'el pie de la proyección es el punto medio').toBeLessThan(1e-6)
  })

  it('(c) "SE DESACTIVA CON LA TECLA MODIFICADORA" · camino 1: el `altKey` del evento real', () => {
    const banco = abrirBanco()
    const destino = [ANILLO[VERT][0] + DENTRO_DE_TAU, ANILLO[VERT][1]]

    arrastrar(marcadorDe(banco.visor.mapa, 0, VERT), destino, { evento: { altKey: true } })

    const puesto = banco.estado.get().recintos[0].vertices[VERT]
    expect(dist(puesto, destino), 'con Alt el vértice se queda donde lo dejó el usuario')
      .toBeLessThan(1e-6)
    expect(puesto, 'con Alt NO puede haber vuelto al vértice oficial').not.toEqual(ANILLO[VERT])
    // Y sin indicador: no ha enganchado nada, así que no hay nada que señalar.
    expect(indicadorDe(banco.visor.mapa)).toBeNull()
  })

  it('(d) "…con la tecla modificadora" · camino 2: el seguimiento de `keydown`/`keyup` (sin evento original)', () => {
    // Este camino NO es un apaño para los tests: un arrastre simulado por API no
    // trae `originalEvent`, y sin el seguimiento propio la tecla no se leería.
    const banco = abrirBanco()
    const marcador = marcadorDe(banco.visor.mapa, 0, VERT)
    const destino = [ANILLO[VERT][0] + DENTRO_DE_TAU, ANILLO[VERT][1]]

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Alt', altKey: true }))
    arrastrar(marcador, destino)
    expect(
      dist(banco.estado.get().recintos[0].vertices[VERT], destino),
      'con Alt pulsada (y sin evento original) el snap no debe enganchar',
    ).toBeLessThan(1e-6)

    // Y al SOLTAR la tecla el enganche vuelve, sin que nadie tenga que reactivarlo.
    document.dispatchEvent(new KeyboardEvent('keyup', { key: 'Alt', altKey: false }))
    arrastrar(marcadorDe(banco.visor.mapa, 0, VERT), destino)
    expect(
      banco.estado.get().recintos[0].vertices[VERT],
      'sin Alt, el mismo gesto tiene que volver a enganchar',
    ).toEqual(ANILLO[VERT])
  })

  it('(e) "DENTRO DE τ": τ es configurable, y fuera de ella el snap no opina', () => {
    const banco = abrirBanco()
    const destino = [ANILLO[VERT][0] + DENTRO_DE_TAU, ANILLO[VERT][1]]

    // τ por debajo del desplazamiento ⇒ el vértice se queda donde el usuario lo dejó.
    banco.visor.edicion.tolerancia(DENTRO_DE_TAU / 2)
    arrastrar(marcadorDe(banco.visor.mapa, 0, VERT), destino)
    expect(dist(banco.estado.get().recintos[0].vertices[VERT], destino)).toBeLessThan(1e-6)

    // τ por encima ⇒ el MISMO gesto engancha. Los dos lados de la frontera con el
    // mismo arrastre: es lo que hace que «dentro de τ» no sea una frase.
    banco.visor.edicion.tolerancia(DENTRO_DE_TAU * 2)
    arrastrar(marcadorDe(banco.visor.mapa, 0, VERT), destino)
    expect(banco.estado.get().recintos[0].vertices[VERT]).toEqual(ANILLO[VERT])

    // Y τ arranca en el valor operativo del proyecto, no en uno inventado.
    expect(abrirBanco().visor.edicion.tolerancia()).toBe(OPERATIVOS.snapMetros)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 7 · AC3 · «Offset de un lado recalcula los vértices contiguos POR INTERSECCIÓN;
//           ~~en ángulo agudo~~ CASI SIEMPRE aplica el fallback SIN EXPLOTAR.»
// ═════════════════════════════════════════════════════════════════════════════
//
// El «casi siempre» tachando «en ángulo agudo» es la corrección que la propia
// spec se aplicó al MEDIR (hallazgo M2): el fallback no es el caso raro, es la
// experiencia normal, porque un anillo del Catastro trae vértices de PASO que no
// son esquinas. El caso (e) de este bloque lo mide sobre la parcela real en vez
// de darlo por bueno.

describe('F06 · AC3 · el offset de un lado recalcula los vértices contiguos por intersección y casi siempre aplica el fallback sin explotar', () => {
  it('(a) "RECALCULA LOS VÉRTICES CONTIGUOS POR INTERSECCIÓN": los dos caen sobre la recta de su lindero vecino', () => {
    const banco = abrirBanco()
    const { visor, estado } = banco

    // Se selecciona con el GESTO real (clic sobre el lindero), no por API: así se
    // comprueba de paso que lo que el usuario pincha es lo que se desplaza.
    visor.mapa.fire('click', { latlng: vertUTMaLatLng(medioDelLado(LADO_MITER), HUSO) })
    expect(visor.edicion.ladoSeleccionado(), 'el clic debe seleccionar ESE lindero').toEqual({
      recinto: 0,
      indice: LADO_MITER,
    })

    const { aplicado, modo } = visor.edicion.desplazarSeleccion(D_MITER)
    expect(aplicado).toBe(true)
    expect(modo, 'este lado corta limpio por los dos extremos').toBe(MODO_OFFSET.MITER)

    const despues = estado.get().recintos[0].vertices
    const n = ANILLO.length
    const i = LADO_MITER
    const j = (i + 1) % n
    const anterior = (i - 1 + n) % n
    const siguiente = (j + 1) % n

    // 1) Solo se han movido los DOS vértices del lado. Ni uno más.
    expect(despues, 'un MITER no añade ni quita vértices').toHaveLength(n)
    const movidos = despues.map((p, k) => (dist(p, ANILLO[k]) > 1e-9 ? k : -1)).filter((k) => k >= 0)
    expect(movidos, 'solo los dos extremos del lado desplazado').toEqual([i, j])

    // 2) POR INTERSECCIÓN: cada extremo nuevo está sobre la RECTA del lindero
    //    contiguo (que es la definición de «se recalcula por intersección»)…
    expect(distanciaARecta(despues[i], ANILLO[anterior], ANILLO[i])).toBeLessThan(1e-6)
    expect(distanciaARecta(despues[j], ANILLO[j], ANILLO[siguiente])).toBeLessThan(1e-6)
    // 3) …y sobre la PARALELA a distancia `d` del lado original, que es la otra
    //    recta que se corta. Las dos condiciones juntas son el punto de corte.
    expect(distanciaARecta(despues[i], ANILLO[i], ANILLO[j])).toBeCloseTo(D_MITER, 9)
    expect(distanciaARecta(despues[j], ANILLO[i], ANILLO[j])).toBeCloseTo(D_MITER, 9)

    // Y la operación llega a las tres vistas como cualquier otra.
    afirmarTresVistasAlineadas(tresVistas(banco), 'tras desplazar el lindero')
  })

  it('(b) "EN ÁNGULO AGUDO APLICA EL FALLBACK": bisela, lo dice y ningún vértice pasa de miterLimite·|d|', () => {
    const banco = abrirBanco()
    const { visor, estado, avisos } = banco

    visor.edicion.seleccionarLado({ recinto: 0, indice: LADO_AGUDO })
    const { aplicado, modo, detecciones } = visor.edicion.desplazarSeleccion(D_AGUDO)

    expect(aplicado, 'el fallback APLICA la operación, no la cancela').toBe(true)
    expect(modo).toBe(MODO_OFFSET.BEVEL)
    expect(detecciones.map((d) => d.tipo)).toContain(TIPO_OFFSET.EXTREMO_BISELADO)

    // ⚠️ EL NÚMERO DEL CRITERIO. «Sin explotar» no es una impresión: es esta cota.
    const tope = OPERATIVOS.miterLimiteFactor * D_AGUDO
    const despues = estado.get().recintos[0].vertices
    expect(
      maxSalto(despues, ANILLO),
      `ningún vértice puede alejarse más de ${tope} m (miterLimite · |d|)`,
    ).toBeLessThanOrEqual(tope + 1e-9)
    // Y de hecho se queda en |d|: el bisel corta la punta en vez de lanzarla.
    expect(maxSalto(despues, ANILLO)).toBeCloseTo(D_AGUDO, 6)
    for (const [x, y] of despues) {
      expect(Number.isFinite(x) && Number.isFinite(y), 'ni un NaN en el anillo').toBe(true)
    }

    // Degradada pero aplicada ⇒ AVISO, no ERROR (regla de clasificación de
    // `viewer/edicion.js`). Y el texto es el de `edit/offset.js`, verbatim.
    const delBisel = avisos.filter((a) => a.mensaje.includes('demasiado aguda'))
    expect(delBisel.length, 'el bisel tiene que CONTARSE, no hacerse en silencio').toBeGreaterThan(0)
    for (const aviso of delBisel) expect(aviso.nivel).toBe(NIVEL.AVISO)
  })

  it('(c) el guardián NO es decorativo: el MISMO lado sin miter-limit manda un vértice a más de 20 m', () => {
    // `edit/offset.js` acepta `miterLimite: Infinity` justamente para esto. Sin
    // esta comprobación, «sin explotar» pasaría igual con la guarda desactivada —
    // y entonces no estaría afirmando nada.
    const sinGuarda = ensayarOffset(LADO_AGUDO, D_AGUDO, { miterLimite: Infinity })
    const salto = maxSalto(sinGuarda.recintos[0].vertices, ANILLO)

    expect(sinGuarda.modo, 'sin la guarda no hay bisel que aplicar').toBe(MODO_OFFSET.MITER)
    expect(salto, 'con 1 m pedido, la punta se va a decenas de metros').toBeGreaterThan(20)
    // Veintitantas veces el desplazamiento pedido: eso es 1/|sin θ| con θ ≈ 2,5°.
    expect(salto / D_AGUDO).toBeGreaterThan(20)
    // Con la guarda, el mismo caso se queda en 1 vez. La diferencia ES el criterio.
    const conGuarda = maxSalto(ensayarOffset(LADO_AGUDO, D_AGUDO).recintos[0].vertices, ANILLO)
    expect(salto / conGuarda).toBeGreaterThan(20)
  })

  it('(d) desplazar sin lado seleccionado no hace nada, y lo dice como ERROR', () => {
    // La otra mitad de la frontera: el usuario pide algo que no se puede hacer, y
    // eso NUNCA lanza (regla de oro 1). Va aquí porque es el mismo criterio visto
    // desde el lado en que no se aplica.
    const banco = abrirBanco()
    const sets = contarSets(banco.estado)

    expect(banco.visor.edicion.ladoSeleccionado()).toBeNull()
    const r = banco.visor.edicion.desplazarSeleccion(D_MITER)

    expect(r.aplicado).toBe(false)
    expect(sets(), 'lo que no se aplica no toca el modelo').toBe(0)
    expect(banco.historial.pila, 'ni el historial').toHaveLength(1)
    expect(banco.avisos.some((a) => a.nivel === NIVEL.ERROR)).toBe(true)
  })

  it('(e) "CASI SIEMPRE": sobre la parcela real, UN lado corta limpio y los otros CATORCE caen al fallback', () => {
    // La corrección que la spec se hizo a sí misma al medir (hallazgo M2), aquí
    // MEDIDA y no citada. La causa está en el dato, no en el algoritmo: un anillo
    // del Catastro trae vértices de PASO —casi colineales— que no son esquinas, y
    // sobre ellos no hay nada que cortar. Por eso «el fallback sin explotar» no es
    // un caso límite: es lo que el usuario ve casi cada vez que desplaza un lado.
    const reparto = { [MODO_OFFSET.MITER]: 0, [MODO_OFFSET.BEVEL]: 0, [MODO_OFFSET.TRASLACION]: 0 }
    const tope = OPERATIVOS.miterLimiteFactor * D_MITER
    for (const i of LADOS) {
      const r = ensayarOffset(i, D_MITER)
      reparto[r.modo] += 1
      // Y «sin explotar» vale para LOS QUINCE, no solo para el que se eligió: es
      // la cota del criterio aplicada a la parcela entera.
      expect(
        maxSalto(r.recintos[0].vertices, ANILLO),
        `el lado ${i} lanza un vértice más allá de miterLimite · |d|`,
      ).toBeLessThanOrEqual(tope + 1e-9)
    }

    expect(reparto[MODO_OFFSET.MITER], 'solo un lado de los 15 resuelve sin fallback').toBe(1)
    expect(
      reparto[MODO_OFFSET.BEVEL] + reparto[MODO_OFFSET.TRASLACION],
      'los otros catorce caen a uno de los DOS fallbacks',
    ).toBe(LADOS.length - 1)
    // Y los DOS fallbacks aparecen: no es que uno se coma al otro.
    expect(reparto[MODO_OFFSET.BEVEL]).toBeGreaterThan(0)
    expect(reparto[MODO_OFFSET.TRASLACION]).toBeGreaterThan(0)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 8 · AC4 · «Superficie/perímetro/Δcatastral se actualizan DURANTE el arrastre.»
// ═════════════════════════════════════════════════════════════════════════════
//
// El adverbio ES el criterio. Si las tres cifras solo cambiaran al soltar, la
// retroalimentación en vivo del spec no existiría — y el visor pasaría igual
// todas las demás pruebas. Aquí se mide DENTRO de un frame de `drag`, con tres
// condiciones simultáneas: las cifras se mueven, `estado.set` NO se llama y la
// pila del historial NO crece.

describe('F06 · AC4 · superficie, perímetro y Δcatastral se actualizan durante el arrastre', () => {
  /** Desplazamiento visible: 5 m, que cambia las tres cifras sin ambigüedad. */
  const EMPUJE = 5

  it('(a) "DURANTE": en UN SOLO frame de `drag` cambian las TRES, sin un `set` y sin un snapshot', () => {
    const banco = abrirBanco()
    const { visor, estado, historial, medidas } = banco
    const sets = contarSets(estado)

    const base = medidas[medidas.length - 1]
    expect(base, 'la ficha tiene que nacer pintada').toBeTruthy()
    expect(base.deltaCatastral, 'sin declarada no habría Δ que actualizar').not.toBeNull()
    const pilaAntes = historial.pila.length
    const cuantas = medidas.length

    const marcador = marcadorDe(visor.mapa, 0, VERT)
    marcador.setLatLng(vertUTMaLatLng([ANILLO[VERT][0] + EMPUJE, ANILLO[VERT][1] + EMPUJE], HUSO))
    marcador.fire('drag')

    expect(medidas.length, 'el frame de arrastre debe medir').toBe(cuantas + 1)
    const enVuelo = medidas[medidas.length - 1]

    // LAS TRES CIFRAS DEL CRITERIO, una a una.
    expect(enVuelo.superficie, 'la superficie no se ha movido con el vértice').not.toBeCloseTo(
      base.superficie,
      6,
    )
    expect(enVuelo.perimetro.exterior, 'el perímetro no se ha movido').not.toBeCloseTo(
      base.perimetro.exterior,
      6,
    )
    expect(enVuelo.deltaCatastral.absoluto, 'la Δ catastral no se ha movido').not.toBeCloseTo(
      base.deltaCatastral.absoluto,
      6,
    )
    // Y la Δ sigue siendo lo que dice ser: medida − declarada.
    expect(enVuelo.deltaCatastral.absoluto).toBeCloseTo(enVuelo.superficie - AREA_DECLARADA, 9)

    // DURANTE, y no al soltar: el modelo y el historial siguen intactos.
    expect(sets(), 'medir en vivo no puede costar un `set`').toBe(0)
    expect(historial.pila.length, 'ni un snapshot por fotograma').toBe(pilaAntes)
    expect(estado.get().recintos[0].vertices[VERT], 'el modelo aún no se ha enterado').toEqual(
      ANILLO[VERT],
    )
  })

  it('(b) las cifras SIGUEN al vértice frame a frame, y no dan un salto solo al final', () => {
    const banco = abrirBanco()
    const marcador = marcadorDe(banco.visor.mapa, 0, VERT)
    const sets = contarSets(banco.estado)

    // Cinco frames alejando el vértice: la superficie tiene que crecer en CADA
    // uno. Un solo salto al final (o cinco valores iguales) sería el criterio roto.
    const superficies = []
    for (let f = 1; f <= 5; f++) {
      marcador.setLatLng(vertUTMaLatLng([ANILLO[VERT][0] + f, ANILLO[VERT][1] + f], HUSO))
      marcador.fire('drag')
      superficies.push(banco.medidas[banco.medidas.length - 1].superficie)
    }

    expect(new Set(superficies).size, 'cinco frames, cinco superficies distintas').toBe(5)
    for (let k = 1; k < superficies.length; k++) {
      expect(superficies[k], 'alejar el vértice tiene que agrandar la parcela').toBeGreaterThan(
        superficies[k - 1],
      )
    }
    expect(sets(), 'cinco frames y NINGÚN set').toBe(0)

    // Y al soltar, lo que se ve es lo que hay: la cifra en vivo y la del store no
    // pueden divergir (si divergieran, la que mentiría es la que el usuario mira).
    marcador.fire('dragend')
    const alSoltar = banco.medidas[banco.medidas.length - 1]
    const delStore = medirComoLaFicha(
      banco.estado.get().recintos.map((r) => r.vertices),
      banco.estado.get(),
    )
    expect(alSoltar.superficie).toBeCloseTo(delStore.superficie, 9)
    expect(alSoltar.perimetro.exterior).toBeCloseTo(delStore.perimetro.exterior, 9)
    expect(alSoltar.deltaCatastral.absoluto).toBeCloseTo(delStore.deltaCatastral.absoluto, 9)
  })

  it('(c) las COTAS del dibujo se repintan en el mismo frame (el otro consumidor del canal)', () => {
    // La spec pide las cotas de cada lado «siempre visibles mientras se edita»,
    // por el MISMO canal en vivo. Que las dos mitades se muevan a la vez es lo
    // que hace que el dibujo y la ficha no puedan contradecirse.
    const banco = abrirBanco()
    const antes = cotasDe(banco.contenedor)
    expect(antes.length, 'sin cotas no hay nada que comprobar').toBeGreaterThan(0)

    const marcador = marcadorDe(banco.visor.mapa, 0, VERT)
    marcador.setLatLng(vertUTMaLatLng([ANILLO[VERT][0] + EMPUJE, ANILLO[VERT][1] + EMPUJE], HUSO))
    marcador.fire('drag')

    expect(cotasDe(banco.contenedor), 'las cotas no se han enterado del arrastre').not.toEqual(antes)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 9 · AC5 · «Undo/redo revierten operaciones completas, NO FOTOGRAMAS del
//           arrastre.»
// ═════════════════════════════════════════════════════════════════════════════
//
// El criterio más fácil de fingir: una pila que crece por fotograma pasa
// cualquier prueba que solo mire «¿se puede deshacer?». Aquí se cuentan los
// snapshots, se comprueba que las posiciones intermedias NO están en la pila, y
// se exige que el undo devuelva la geometría ORIGINAL y no una de en medio.
//
// La navegación se hace como la hace `app/main.js#cablearEdicion` (`undo`/`redo`
// + `estado.set`, sin commitear: la pila lleva su propia cuenta con `indice`).
// Los BOTONES y los atajos `Ctrl+Z`/`Ctrl+Y` que la disparan son de
// `test/app/main-edicion.dom.test.js` — ver § 10.

describe('F06 · AC5 · undo/redo revierten operaciones completas, no fotogramas del arrastre', () => {
  /** Navega el historial y aplica el resultado al store, como hace la app. */
  function deshacer(banco) {
    const instantanea = undo(banco.historial)
    if (instantanea !== null) banco.estado.set(instantanea)
    return instantanea
  }
  function rehacer(banco) {
    const instantanea = redo(banco.historial)
    if (instantanea !== null) banco.estado.set(instantanea)
    return instantanea
  }

  it('(a) "NO FOTOGRAMAS": un arrastre de OCHO frames deja EXACTAMENTE UN snapshot', () => {
    const banco = abrirBanco()
    const marcador = marcadorDe(banco.visor.mapa, 0, VERT)
    const pilaAntes = banco.historial.pila.length

    const intermedias = []
    for (let f = 1; f <= 8; f++) {
      const punto = [ANILLO[VERT][0] + f * 0.5, ANILLO[VERT][1] + f * 0.5]
      intermedias.push(punto)
      marcador.setLatLng(vertUTMaLatLng(punto, HUSO))
      marcador.fire('drag')
    }
    expect(banco.historial.pila.length, 'ocho frames NO son ocho operaciones').toBe(pilaAntes)
    marcador.fire('dragend')

    expect(banco.historial.pila.length, 'el gesto acabado deja UN snapshot').toBe(pilaAntes + 1)

    // Y ninguna de las ocho posiciones intermedias entró en la pila (salvo la
    // última, que es donde el gesto acabó y por tanto es la operación).
    const finales = new Set(
      banco.historial.pila.map((s) => s.recintos[0].vertices[VERT].join(',')),
    )
    for (const punto of intermedias.slice(0, -1)) {
      expect(
        [...finales].some((clave) => {
          const [x, y] = clave.split(',').map(Number)
          return dist([x, y], punto) < 1e-6
        }),
        `la posición intermedia ${punto.join(',')} no debe estar en el historial`,
      ).toBe(false)
    }
  })

  it('(b) el undo devuelve la geometría ORIGINAL, no un fotograma de en medio; el redo, la final', () => {
    const banco = abrirBanco()
    const marcador = marcadorDe(banco.visor.mapa, 0, VERT)
    const destino = [ANILLO[VERT][0] + 4, ANILLO[VERT][1] + 4]

    arrastrar(marcador, destino, { frames: 8 })
    const trasArrastrar = structuredClone(banco.estado.get().recintos[0].vertices)
    expect(dist(trasArrastrar[VERT], destino)).toBeLessThan(1e-6)

    // UNDO: el anillo ENTERO vuelve a ser el del fixture, uno a uno.
    expect(deshacer(banco)).not.toBeNull()
    expect(banco.estado.get().recintos[0].vertices, 'el undo debe devolver la parcela ORIGINAL')
      .toEqual(ANILLO)
    afirmarTresVistasAlineadas(tresVistas(banco), 'tras deshacer')

    // REDO: y vuelve a la posición final, no a un frame intermedio.
    expect(rehacer(banco)).not.toBeNull()
    expect(banco.estado.get().recintos[0].vertices).toEqual(trasArrastrar)
    afirmarTresVistasAlineadas(tresVistas(banco), 'tras rehacer')
  })

  it('(c) "OPERACIONES COMPLETAS": insertar, eliminar y offset son UNA cada una, y se deshacen enteras', () => {
    const banco = abrirBanco()
    const { visor } = banco
    const pilaInicial = banco.historial.pila.length

    // 1 · Insertar (doble clic sobre el lindero más largo): 15 → 16.
    visor.mapa.fire('dblclick', { latlng: vertUTMaLatLng(medioDelLado(LADO_LARGO), HUSO) })
    expect(banco.historial.pila).toHaveLength(pilaInicial + 1)
    expect(banco.estado.get().recintos[0].vertices).toHaveLength(ANILLO.length + 1)

    // 2 · Eliminar (menú contextual): 16 → 15.
    marcadorDe(visor.mapa, 0, 2).fire('contextmenu')
    expect(banco.historial.pila).toHaveLength(pilaInicial + 2)
    expect(banco.estado.get().recintos[0].vertices).toHaveLength(ANILLO.length)

    // 3 · Offset del lado agudo: UNA operación, aunque el bisel añada vértices.
    visor.edicion.seleccionarLado({ recinto: 0, indice: LADO_AGUDO })
    expect(visor.edicion.desplazarSeleccion(D_AGUDO).aplicado).toBe(true)
    expect(banco.historial.pila, 'un offset es UNA operación, biselado o no').toHaveLength(
      pilaInicial + 3,
    )
    const trasTodo = structuredClone(banco.estado.get().recintos[0].vertices)

    // TRES undos ⇒ la parcela de partida, exacta.
    deshacer(banco)
    deshacer(banco)
    deshacer(banco)
    expect(banco.estado.get().recintos[0].vertices, 'tres operaciones, tres undos').toEqual(ANILLO)
    expect(undo(banco.historial), 'la pila sembrada no deja deshacer más allá del origen').toBeNull()

    // Y TRES redos ⇒ exactamente donde se estaba.
    rehacer(banco)
    rehacer(banco)
    rehacer(banco)
    expect(banco.estado.get().recintos[0].vertices).toEqual(trasTodo)
    afirmarTresVistasAlineadas(tresVistas(banco), 'tras rehacer las tres operaciones')
  })

  it('(d) navegar el historial NO ensucia la pila: ningún suscriptor del visor commitea', () => {
    // De esto DEPENDE que el undo sea reversible: si un `set` externo commiteara,
    // el propio deshacer se volvería una operación deshacible y borraría la rama
    // de rehacer. Es la decisión 3 de F06, y se comprueba sobre el visor REAL —
    // que es quien tiene dos suscriptores (`sincronizacion.js` y `edicion.js`).
    const banco = abrirBanco()
    arrastrar(marcadorDe(banco.visor.mapa, 0, VERT), [ANILLO[VERT][0] + 2, ANILLO[VERT][1]])
    const tras = banco.historial.pila.length
    const indice = banco.historial.indice

    deshacer(banco)
    expect(banco.historial.pila, 'un undo no puede AÑADIR un snapshot').toHaveLength(tras)
    expect(banco.historial.indice).toBe(indice - 1)

    rehacer(banco)
    expect(banco.historial.pila, 'ni un redo').toHaveLength(tras)
    expect(banco.historial.indice).toBe(indice)
  })
})

// ═════════════════════════════════════════════════════════════════════════════
// 10 · ⛔ LO QUE ESTA SUITE **NO** PUEDE AFIRMAR, DICHO CON TODAS LAS LETRAS
// ═════════════════════════════════════════════════════════════════════════════
//
// Un hueco tapado con una prueba que finge cobertura es peor que un hueco
// declarado: el día que se rompa, seguirá en verde. Estos son los de F06, y
// ninguno se disimula.
//
// (h1) **EL ARRASTRE CON RATÓN DE VERDAD NO SE PRUEBA AQUÍ. NI AQUÍ NI EN
//      NINGÚN TEST DE ESTE REPO.** jsdom no tiene motor de layout: no hay
//      hit-testing, no hay `pointer-events`, no hay tamaño real del área de
//      agarre del vértice (10 px), y `L.Draggable` nunca llega a arrancar. Todo
//      lo que esta suite llama «arrastrar» es `marcador.fire('drag')`, o sea el
//      manejador que Leaflet llamaría — pero no la cadena
//      `mousedown → mousemove → mouseup` que lo produce. Lo que queda sin
//      comprobar, y solo se puede comprobar en un navegador de verdad:
//        · que el cuadradito de 10 px se pueda agarrar con el ratón (y con el
//          dedo) sin pinchar el mapa por debajo;
//        · que el `dblclick` de insertar no dispare además un `dragstart`;
//        · que el menú contextual del navegador no salga encima del vértice;
//        · que arrastrar el vértice no PANEE el mapa a la vez.
//      → guion `08-edicion.js` de `scripts/smoke-navegador/` + checklist humano.
//
// (h2) **SI `Alt` LA ROBA EL NAVEGADOR O EL SISTEMA.** En Windows `Alt` activa la
//      barra de menús; en algunos gestores de ventanas de Linux, `Alt`+arrastrar
//      MUEVE LA VENTANA entera y la página no ve nada. Aquí el `altKey` se
//      fabrica y siempre llega. Que el modificador sea USABLE es una cuestión de
//      plataforma, no de código, y se decide mirándolo: → smoke + checklist.
//      (El seguimiento de `keydown`/`keyup` tiene además una guarda de `blur`
//      para cuando la ventana pierde el foco con la tecla pulsada; su prueba está
//      en `test/viewer/edicion.dom.test.js`, no aquí.)
//
// (h3) **EL CONTRASTE DE LAS COTAS Y DEL INDICADOR SOBRE ORTOFOTO.** Esta suite
//      comprueba que las cotas se repintan y que el indicador lleva su clase,
//      pero no que se LEAN: sobre una ortofoto de PNOA hay tejados claros, asfalto
//      oscuro y vegetación, y jsdom no pinta un solo píxel. El amarillo
//      `#FFD600` y el halo del resalte solo se pueden juzgar mirándolos.
//      → smoke + checklist humano (es el mismo tipo de hueco que F03 dejó
//      declarado con el «salto» del zoom del WMS).
//
// (h4) **EL RENDIMIENTO DEL GESTO.** «Se actualizan durante el arrastre» tiene una
//      segunda mitad implícita —que se actualicen SIN QUE SE NOTE— y aquí se
//      cuentan llamadas, no milisegundos. La caché de dianas de `viewer/edicion.js`
//      existe justamente por eso, y su efecto (60 fps sobre un parcelario lleno)
//      no es medible en jsdom. → `/benchmark` en navegador.
//
// (h5) **LOS BOTONES Y LOS ATAJOS DEL HISTORIAL.** El AC5 se acciona aquí con
//      `undo`/`redo` + `estado.set`, que son las dos líneas que ejecuta
//      `app/main.js#cablearEdicion`. Lo que NO se toca es la capa de mando:
//      `disabled` derivado de `puedeDeshacer`/`puedeRehacer`, el refresco en
//      microtarea (porque el `commit` va DESPUÉS del `set`), `Ctrl+Z`/`Ctrl+Y`/
//      `⌘Z` y su inhibición dentro de un campo de texto. Todo eso es de
//      `test/app/main-edicion.dom.test.js`, y no se duplica: dos guardianes del
//      mismo invariante se desincronizan, y el que se quede viejo pasará en verde.
//      Importar `app/main.js` aquí tampoco sería una opción: ese módulo ARRANCA
//      la app entera al cargarse (por eso las dos suites de `test/app/` doblan
//      `viewer/index.js`), y esta necesita el visor REAL.
//
// (h6) **EL SNAP A LAS COLINDANTES DE F05.** `fijarColindantes` tiene su contrato
//      probado en `test/viewer/edicion.dom.test.js` y su cable en
//      `test/app/main-edicion.dom.test.js`. Aquí el snap se afirma contra
//      `geometriaOficial`, que es la diana principal del spec («ajustar unos
//      vértices sobre la parcela oficial») y la única que existe sin una petición
//      al WFS. Con vecinas de verdad, el catálogo es mayor y el comportamiento el
//      mismo — pero eso es una afirmación, no una medición, y por eso está aquí.
//
// (h7) **`edit/dibujo.js` NO EXISTE TODAVÍA.** La spec lo lista en «Ficheros» y
//      dice que se estrena en F06 «en su base» y se completa en F12. Dibujar un
//      recinto desde cero no está en ninguno de los cinco criterios de
//      aceptación, así que esta suite no lo exige — pero que no lo exija no
//      significa que esté hecho. Queda dicho.

describe('F06 · aceptación · los huecos declarados son huecos REALES (§ 10)', () => {
  it('(h1) jsdom no tiene layout: el tamaño del contenedor es FALSO y por eso no hay hit-testing', () => {
    // La prueba estructural del hueco (h1), y no una opinión: un `<div>` normal
    // mide 0 en jsdom, y el del arnés mide 800 porque se lo hemos escrito con
    // `Object.defineProperty`. Donde no hay layout no hay puntero que acertar, ni
    // `pointer-events`, ni área de agarre: el arrastre REAL es incomprobable aquí.
    const pelado = document.createElement('div')
    pelado.style.width = '800px'
    pelado.style.height = '600px'
    document.body.appendChild(pelado)
    expect(pelado.clientWidth, 'si jsdom calculara layout, esto no sería 0').toBe(0)

    const delArnes = crearContenedor()
    expect(delArnes.clientWidth, 'el tamaño del arnés está ESCRITO, no medido').toBe(800)
    expect(
      Object.getOwnPropertyDescriptor(delArnes, 'clientWidth').value,
      'y por eso es una propiedad propia, no una medida del motor',
    ).toBe(800)
  })
})

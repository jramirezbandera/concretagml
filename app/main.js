// app/main.js — F03 · Fase 4, Tarea 4B.1. EL ARRANQUE DE LA APP.
//
// Sustituye la sonda de build de la tarea 4A.1. Es la ENTRADA de Vite y el
// ÚNICO sitio del proyecto que ensambla la aplicación completa: coge las cajas
// vacías que declara `index.html` y las convierte en la pantalla viva.
//
// ── QUÉ ENSAMBLA, Y EN QUÉ ORDEN (el orden importa, y aquí está el por qué) ──
//   1. DATOS      — `parcelaDemo()` (o `parcelaDemoConHueco()` con `?demo=hueco`)
//                   de `./demo-datos.js`. Un POJO de parcela, en UTM.
//   2. ESTADO     — `crearEstadoVista(parcela)`. **LO CREA LA APP, NO EL VISOR**
//                   (ver más abajo: es la razón de ser de la ficha del pie).
//   3. PANEL      — `crearPanelAvisos(...)` de `./avisos.js`. Va ANTES del visor
//                   porque el visor necesita su `avisar` como `alAvisar`: si se
//                   creara después, los avisos del PRIMER encuadre (una tesela
//                   del IGN que no carga, la imagen WMS que falla) se irían al
//                   `console.warn` por defecto y el usuario no vería nada.
//   4. VISOR      — `crearVisor(...)` de `../viewer/index.js`. Monta mapa +
//                   capas + tabla de vértices y encuadra sobre la geometría.
//   5. FICHA      — `estado.subscribe(actualizarFicha)` y una primera llamada a
//                   mano (`subscribe` NO notifica al suscribirse).
//
// ── POR QUÉ EL STORE LO CREA ESTA FUNCIÓN Y NO `crearVisor` ─────────────────
// `viewer/index.js` documenta que recibe el store ya hecho y NO lo fabrica, para
// que el llamante pueda COMPARTIRLO con otras vistas. Hasta ahora eso era una
// promesa sobre F05/F06; la ficha del pie de este fichero lo convierte en un
// hecho comprobable en producción: es un SEGUNDO suscriptor del MISMO store que
// el mapa y la tabla, y por eso existe. Se edita una coordenada en la tabla →
// `sincronizar` hace `estado.set` → se repintan el polígono del mapa Y la
// superficie del pie, sin que ninguna de las dos vistas sepa de la otra.
//
// ── POR QUÉ SE IMPORTA `viewer/index.js` DIRECTAMENTE Y NUNCA EL BARREL RAÍZ ─
// El barrel raíz `index.js` NO exporta el visor A PROPÓSITO (hallazgo C1/T10):
// `viewer/` y `services/` importan Leaflet, que exige `window`, y el barrel lo
// carga el proyecto Vitest `node`, que corre sin DOM. `test/contrato.test.js`
// vigila ese invariante y su comentario nombra LITERALMENTE esta tarea (la
// entrada demo de la Fase 4) como el momento en que alguien va a querer
// «exportar el visor por el barrel para que la demo lo importe bonito». No se ha
// hecho: aquí se importa `../viewer/index.js`.
//
// La comprobación de cierre de esta tarea es un grep sobre `app/` buscando
// importaciones del barrel raíz, y tiene que salir VACÍO. Por eso este párrafo
// describe el patrón en vez de escribirlo: un comentario que cita el patrón
// literal se convierte él mismo en una coincidencia y convierte un «cero duro»
// en un «cero salvo este falso positivo que hay que leer cada vez».
//   @see test/contrato.test.js  →  describe('contrato F03 · el visor NO sale por
//                                  el barrel raíz (Leaflet exige window)')
//
// ── POR QUÉ EL CSS DE LEAFLET SE IMPORTA AQUÍ Y NO EN `viewer/` ─────────────
// `viewer/index.js` declara que NO importa `leaflet/dist/leaflet.css` a
// propósito: el visor es una LIBRERÍA y el CSS es responsabilidad de la ENTRADA
// de la aplicación, que es este fichero. Sin él, el mapa sale descuadrado
// (panes sin `position:absolute`, controles sin caja).
// La otra hoja, `estilos/app.css`, va por `<link>` en `index.html` y NO se
// importa aquí: así la cáscara está vestida en el primer pintado, sin fogonazo
// de HTML crudo en cada recarga de `npm run dev`. El orden entre las dos hojas
// es indiferente por diseño (ver la cabecera de `estilos/app.css`: sus reglas
// sobre cromo de Leaflet suben la especificidad a `.gml-app .gml-mapa`).
//
// ── POR QUÉ NO HAY `import.meta.hot.accept()` ───────────────────────────────
// Un `accept` volvería a ejecutar este módulo sobre un `#mapa` que ya tiene un
// `L.Map` montado, y Leaflet lanzaría «Map container is already initialized»
// (doble montaje). Sin `accept`, Vite hace RECARGA COMPLETA de la página ante
// cualquier cambio, que es exactamente lo que este arranque necesita. Si algún
// día se quiere HMR fino, la vía es `import.meta.hot.dispose(() => visor.destruir())`,
// no `accept` a secas.
//
// ── POR QUÉ NO HAY NINGÚN GLOBAL DE DEPURACIÓN (`window.__gml`) ─────────────
// La sonda de build sí colgaba un `globalThis.__visor`. Aquí no: la verificación
// de esta tarea conduce la UI REAL (se mira el mapa, se cuentan las filas, se
// arrastra el deslizador), y un asa global es una API accidental que alguien
// acabaría usando en serio. Lo que hacía falta comprobar por consola —el riesgo
// nº 1 de la fase, que `mapa.getSize().y > 0`— se lee del DOM sin ningún hook:
// `getSize()` ES `[#mapa.clientWidth, #mapa.clientHeight]` (`Map#getSize` lee el
// contenedor), así que se comprueba con
// `const e = document.getElementById('mapa'); [e.clientWidth, e.clientHeight]`.
//
// ── POR QUÉ NO HAY BOTÓN «DIAGNOSTICAR» ────────────────────────────────────
// La maqueta de diseño lleva un CTA que abre el diagnóstico de F07. F07 no
// existe todavía, y un botón deshabilitado es UI muerta: promete una función que
// nadie puede usar y hay que acordarse de encenderla. Cuando F07 exista, se
// añade entonces.

import 'leaflet/dist/leaflet.css'

import { superficie } from '../geo/area.js'
import { crearEstadoVista, NIVEL } from '../viewer/_comun.js'
import { crearVisor } from '../viewer/index.js'
import { crearPanelAvisos } from './avisos.js'
import {
  AVISO_DEMO_HUECO_SINTETICO,
  SRS_DEMO,
  parcelaDemo,
  parcelaDemoConHueco,
} from './demo-datos.js'

// ── Constantes de presentación ───────────────────────────────────────────────

/**
 * Valor de `?demo=` que selecciona el dataset SINTÉTICO con hueco. Es la única
 * vía para verlo: la parcela por defecto es la REAL del Catastro y nunca se le
 * añade un patio inventado encima (ver la cabecera de `./demo-datos.js`).
 */
const DEMO_HUECO = 'hueco'

/** Eyebrow de la cabecera cuando el dataset NO procede del Catastro. */
const EYEBROW_SINTETICA = 'Parcela sintética · demostración'

/** Texto de la ficha cuando la parcela no tiene referencia catastral. */
const SIN_REFCAT = 'Sin referencia'

/**
 * Superficie con dos decimales y separadores españoles (1.019,17). Dos
 * decimales porque es la precisión con la que el Catastro expresa la superficie
 * de parcela; el redondeo es de PRESENTACIÓN y jamás toca el modelo.
 */
const FORMATO_SUPERFICIE = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/** Enteros con separador de millares español (para el recuento de vértices). */
const FORMATO_ENTERO = new Intl.NumberFormat('es-ES')

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO (ver la
 * cabecera de `index.html`), así que un selector que no encuentra nada es un bug
 * del programador, no un dato malo: regla de oro 1, se lanza y se nombra el
 * selector. La alternativa —seguir con un `null` y morir cien líneas más allá
 * con «cannot set properties of null»— es justo el fallo ilegible que el
 * proyecto no admite.
 *
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error} Si la cáscara no tiene ese nodo.
 */
function nodo(selector) {
  const encontrado = document.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/main.js: la cáscara no tiene ningún nodo '${selector}'. El marcado de ` +
        `index.html es contrato de esta entrada (y de estilos/app.css): si se ha ` +
        `renombrado o movido ese nodo, hay que arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── 1 · Datos ────────────────────────────────────────────────────────────────

// `?demo=hueco` es la vía explícita para ver en pantalla un hueco interior, su
// rótulo «HUECO 1» y el recorte de anillos anidados. Cualquier otro valor (o
// ninguno) carga la parcela REAL del Catastro.
const esSintetica = new URLSearchParams(window.location.search).get('demo') === DEMO_HUECO
const parcela = esSintetica ? parcelaDemoConHueco() : parcelaDemo()

// El eyebrow tiene que DECIR que el dato es inventado. Presentar una parcela
// sintética bajo el rótulo «Parcela cargada» sería hacerla pasar por un dato del
// Catastro, y eso el spec no lo permite (nada de maquillar la procedencia).
if (esSintetica) nodo('[data-eyebrow]').textContent = EYEBROW_SINTETICA

// ── 2 · Estado ───────────────────────────────────────────────────────────────

// UN solo store para las TRES vistas: el dibujo del mapa, la tabla de vértices
// y la ficha del pie (ver la cabecera).
const estado = crearEstadoVista(parcela)

// ── 3 · Panel de avisos ──────────────────────────────────────────────────────

// Los dos chips del contador se localizan por `data-contador`, que es el
// contrato de `index.html`: nacen NEUTROS («0 errores» / «0 avisos») y es
// `app/avisos.js` quien pone y quita los modificadores de color.
const panel = crearPanelAvisos({
  contenedor: nodo('#avisos'),
  chipError: nodo('.gml-chip[data-contador="ERROR"]'),
  chipAviso: nodo('.gml-chip[data-contador="AVISO"]'),
})

// El dataset sintético lo dice también EN LA LISTA de avisos, no solo en el
// eyebrow: el eyebrow se lee una vez al abrir y la lista queda.
if (esSintetica) panel.avisar(AVISO_DEMO_HUECO_SINTETICO, { nivel: NIVEL.AVISO })

// ── 4 · Visor ────────────────────────────────────────────────────────────────

crearVisor(nodo('#mapa'), {
  estado,
  // `<div>`, no `<table>`: es la caja con `overflow:auto` contra la que scrollea
  // la cabecera pegajosa. `sincronizar` crea la `<table>` dentro.
  tablaEl: nodo('#tabla-vertices'),
  srs: SRS_DEMO,
  // El ÚNICO camino para que un fallo de red de la cartografía o una celda
  // ilegible acaben en el panel en vez de en el `console.warn` por defecto.
  alAvisar: panel.avisar,
  // Ortofoto PNOA. Coincide con `capas.js#BASE_POR_DEFECTO`, y se pasa igual de
  // forma explícita: es LA capa sobre la que se calca, y que la app diga en voz
  // alta con qué base arranca vale más que ahorrar una línea.
  baseInicial: 'pnoa-ma',
  // ⚠️ DECISIÓN, y va CONTRA el defecto de `montarCapas` (que es `false`). Con
  // `false` la cartografía catastral arranca apagada y, sobre todo, el control
  // de opacidad arranca DESHABILITADO: quien abre la app por primera vez ve un
  // deslizador gris que no se mueve y lo lee como un fallo del programa. Además
  // catastral-en-transparencia-sobre-ortofoto ES la vista que da sentido al
  // producto (calcar), y encenderla cuesta exactamente 1 `GetMap` por encuadre
  // — la capa WMS pide una imagen por encuadre, no un mosaico de teselas.
  superpuestaInicial: true,
  // F06 enchufa aquí `crearHistorial()` de `edit/historial.js`. Hoy `null`
  // EXPLÍCITO (que es también el defecto) para que se vea que el hueco existe y
  // que no está sin decidir: `sincronizar` ya sabe commitear una instantánea por
  // operación acabada, lo que falta es la pila y los atajos de undo/redo.
  historial: null,
})

// ── 5 · Ficha del pie: el SEGUNDO suscriptor del mismo store ─────────────────

const fichaSrs = nodo('[data-ficha="srs"]')
const fichaRefcat = nodo('[data-ficha="refcat"]')
const fichaVertices = nodo('[data-ficha="vertices"]')
const fichaSuperficie = nodo('[data-ficha="superficie"]')

/**
 * Repinta la ficha del pie desde el POJO de parcela. Suscriptor del store: se
 * llama en CADA `estado.set` (una coordenada editada en la tabla, un vértice
 * arrastrado en el mapa) y la superficie se recalcula sola.
 *
 * `superficie` (geo/area.js) es la ÚNICA fuente de la cifra: exterior menos
 * huecos, por la fórmula del polígono sobre UTM. No se cachea y no se reimplementa
 * aquí. Si el modelo llegara con el invariante roto (`recintos[0]` que no es
 * EXTERIOR), `superficie` LANZA a propósito y este suscriptor deja que el error
 * suba: es un bug del programa y tiene que sonar (regla de oro 1), no quedarse en
 * un guion en el pie.
 *
 * El SRS no sale de la parcela: `crearParcela` no porta `srs` (vive en el
 * Expediente), así que se pinta el del dataset, el mismo que se le da al visor.
 *
 * @param {object|null} parcelaActual  POJO de parcela del store (o `null`).
 * @returns {void}
 */
function actualizarFicha(parcelaActual) {
  const recintos = (parcelaActual && parcelaActual.recintos) || []
  const nVertices = recintos.reduce((total, recinto) => total + recinto.vertices.length, 0)

  fichaSrs.textContent = SRS_DEMO
  // `refcat` es `null` en el dataset sintético, y se DICE («Sin referencia») en
  // vez de dejar un guion: un guion se lee como «esto no ha cargado».
  fichaRefcat.textContent = (parcelaActual && parcelaActual.refcat) || SIN_REFCAT
  fichaVertices.textContent = FORMATO_ENTERO.format(nVertices)
  fichaSuperficie.textContent = `${FORMATO_SUPERFICIE.format(superficie(recintos))} m²`
}

estado.subscribe(actualizarFicha)
// `subscribe` NO notifica al suscribirse (ver `crearEstadoVista`): el primer
// pintado se hace a mano, o la ficha se quedaría con los guiones del HTML hasta
// la primera edición.
actualizarFicha(estado.get())

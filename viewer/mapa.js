// viewer/mapa.js — F03 · Tarea 2B.3 (inicialización del mapa Leaflet).
//
// Módulo pequeño y muy acotado, pero fija CUATRO decisiones del spec
// (feature-03-visor.md, sección Interacción) que ya no se pueden reparar desde
// fuera una vez creado el `L.Map`:
//
//   1. `zoomSnap: 0` + un `maxZoom` alto por defecto
//      ({@link ZOOM_MAXIMO_DEFECTO} = 24). El usuario es un arquitecto calcando
//      una parcela sobre la ortofoto: tiene que poder acercarse MÁS ALLÁ de la
//      resolución nativa de las teselas (aunque la imagen pixele) y el zoom no
//      puede saltar a valores enteros al hacerlo — de ahí `zoomSnap: 0`. Sin
//      este par de opciones fijado aquí, cualquier capa que se añada después
//      (Fase 3) heredaría un tope de zoom que rompería el calcado de precisión.
//   2. Los tres panes de `PANES` (`viewer/_comun.js`), creados con
//      `mapa.createPane` y con su `zIndex` aplicado al estilo — Leaflet NO
//      asigna zIndex a un pane custom por sí solo (a diferencia de sus panes
//      nativos, que lo traen de `leaflet.css`). Se itera `PANES`: los nombres y
//      los zIndex NUNCA se copian a mano, `_comun.js` es la única fuente de
//      verdad.
//   3. El control de escala (`L.control.scale`) con `metric:true,
//      imperial:false` — SOLO la barra gráfica. El spec es explícito: la
//      escala NUMÉRICA pertenece al PDF (F09), no al visor.
//   4. `attributionControl: true`, BLINDADO tras el spread de `opts` (hallazgo
//      2.2 de la auditoría de coherencia 2C.2). Sin ello, un
//      `crearMapa(el, { attributionControl: false })` apagaría el control nativo
//      y el CRITERIO DE ACEPTACIÓN 5 («la atribución aparece en el visor») se
//      incumpliría aunque todas las capas llevaran su atribución perfecta. No es
//      cosmético: es CC-BY 4.0 del IGN, Ley 37/2007 RISP y ODbL.
//
// Qué NO decide este módulo (a propósito):
//   · Capas (base/superpuesta/WMS): es la Fase 3 (`viewer/capas.js`,
//     `services/ign.js`, `viewer/wms-catastro.js`). Aquí el mapa se devuelve
//     SIN ninguna capa montada.
//   · El TOPE de zoom en función de las capas: este módulo no monta ninguna
//     capa, así que no sabe qué `maxNativeZoom` aplica y NO tiene ninguna
//     constante del IGN (hallazgo 2.7 de la auditoría de coherencia; antes
//     tenía una copia privada del 19 y un `RangeError` que rechazaba
//     configuraciones legítimas — un visor sin capas del IGN no podía pedir
//     `maxZoom: 20`). La comprobación «`maxZoom` > el `maxNativeZoom` de las
//     capas REALMENTE MONTADAS» pertenece a `crearVisor`/`viewer/capas.js` de la
//     Fase 3, que es quien sabe qué capas hay. Ese tope lo DERIVA
//     `viewer/capas.js#maxZoomNativo` capa a capa, del `maxNativeZoom` que
//     declara cada descriptor — no de un máximo global del IGN: un visor sin
//     capas del IGN no debe compararse contra el tope del IGN.
//     `services/ign.js#MAX_ZOOM_NATIVO_IGN` es otra cosa (un dato agregado DEL
//     SERVICIO) y NADIE del visor lo lee.
//   · Encuadre (`fitBounds` sobre la parcela, o exigir vista explícita, o
//     fallar): es contrato de `crearVisor` (Fase 3) — hallazgo de review C5,
//     "no debe haber encuadres mudos". Aquí: si `opts.vistaInicial` llega, se
//     aplica tal cual; si no, el mapa se deja SIN CENTRAR a propósito (ver
//     JSDoc de `crearMapa`). Nunca se inventa un centro por defecto.
//   · Escala numérica: F09 (PDF), no este módulo.
//
// Módulo SOLO-navegador (importa Leaflet, que exige `window`): su test lleva
// el sufijo `.dom.test.js` (proyecto Vitest `dom`, jsdom) y este fichero NUNCA
// se añade al barrel raíz `index.js` — igual que `services/ign.js`,
// `viewer/wms-catastro.js` y `viewer/sincronizacion.js` (decisión de review,
// Codex C1; ver cabecera de `viewer/_comun.js`). Tampoco importa
// `leaflet/dist/leaflet.css`: el CSS de Leaflet va solo en la entrada demo de
// la Fase 4.

import L from 'leaflet'
import { PANES, validarVistaInicial } from './_comun.js'

/**
 * `maxZoom` por defecto del mapa: holgadamente por encima del `maxNativeZoom` de
 * cualquier cartografía teselada que se le pueda montar, para poder seguir
 * acercando el zoom más allá de la resolución nativa de las teselas (calcado de
 * precisión sobre la ortofoto, aunque pixele).
 *
 * Es un DEFECTO, no un mínimo: el llamante puede bajarlo y este módulo no lo
 * juzga — no sabe qué capas se van a montar. Quien comprueba que el `maxZoom`
 * supera el tope nativo de las capas montadas es `crearVisor` (Fase 3), con el
 * valor que le DERIVA `viewer/capas.js#maxZoomNativo` de los descriptores
 * realmente montados (hoy siempre las seis capas del visor, tope 20).
 */
const ZOOM_MAXIMO_DEFECTO = 24

/**
 * ¿Sirve como contenedor del mapa? DUCK TYPING deliberado, no
 * `instanceof HTMLElement` (hallazgo 2.10 de la auditoría de coherencia): un
 * elemento venido de otro realm (iframe) NO pasa el `instanceof`, y `HTMLElement`
 * es además un global inexistente bajo el proyecto Vitest `node`. Se comprueba lo
 * que Leaflet de verdad necesita del contenedor, igual que hace
 * `viewer/sincronizacion.js` con sus argumentos del DOM.
 *
 * @param {*} el
 * @returns {boolean}
 */
function esElementoDOM(el) {
  return (
    !!el &&
    typeof el === 'object' &&
    typeof el.appendChild === 'function' &&
    typeof el.addEventListener === 'function' &&
    el.nodeType === 1
  )
}

/** Prefijo del mensaje de error de `validarVistaInicial` para este módulo. */
const CONTEXTO_VISTA_INICIAL = "crearMapa: 'opts.vistaInicial'"

/**
 * Crea el mapa Leaflet del visor: fija panes, zoom sin tope artificial y la
 * barra de escala gráfica. NO monta ninguna capa (Fase 3) y NO encuadra el
 * mapa salvo que se pida explícitamente (contrato de `crearVisor`, Fase 3).
 *
 * Sin `opts.vistaInicial`, el mapa queda SIN CENTRAR A PROPÓSITO: no lanza,
 * simplemente no llama a `setView`. Un mapa Leaflet sin vista es una forma
 * válida y esperada del valor de retorno — quien llame a `crearMapa` sin
 * `vistaInicial` sabe (por este mismo JSDoc) que es SU responsabilidad
 * encuadrar después (`crearVisor`, Fase 3, hallazgo de review C5: "no debe
 * haber encuadres mudos"). Este módulo nunca inventa un centro por defecto
 * (nada de "centrar en España" ni similar).
 *
 * @param {HTMLElement} contenedor  Elemento del DOM donde montar el mapa.
 * @param {object} [opts]  **El resto de claves de `opts`** (todo lo que no sea
 *   `vistaInicial` ni `maxZoom`) se pasa TAL CUAL a `L.map` — es un rest
 *   parameter sobre `opts`, no una clave anidada: se escribe
 *   `crearMapa(el, { zoomAnimation: false })`, NO
 *   `crearMapa(el, { opcionesLeaflet: { … } })`. La misma forma que
 *   `crearCapaWMTS(id, opts)` y que `montarMapa` del arnés de test. Ninguna de
 *   esas opciones puede sobrescribir `zoomSnap`, `maxZoom` ni
 *   `attributionControl`, que son decisiones fijas de este módulo (van DESPUÉS
 *   del spread).
 * @param {{centro: [number, number], zoom: number}} [opts.vistaInicial]
 *   Si se da, se aplica con `mapa.setView(centro, zoom)`. Si se omite, el mapa
 *   queda sin centrar (ver arriba).
 * @param {number} [opts.maxZoom=24]  Tope de zoom del mapa. Este módulo NO lo
 *   valida contra ningún `maxNativeZoom`: no monta capas y por tanto no sabe
 *   cuál aplica (ver cabecera). Esa comprobación es de `crearVisor`/
 *   `viewer/capas.js` (Fase 3).
 * @returns {{ mapa: import('leaflet').Map, panes: Record<string, HTMLElement>, destruir: () => void }}
 *   `panes` indexado por nombre canónico (`viewer/_comun.js#PANE`), para que
 *   `viewer/sincronizacion.js` pinte cada capa en su pane. `destruir()` es
 *   IDEMPOTENTE: llamarlo más de una vez no lanza (la segunda vez no hace nada).
 * @throws {TypeError} Si `contenedor` no es un elemento del DOM, o si
 *   `opts.vistaInicial` no tiene la forma `{centro, zoom}`.
 */
export function crearMapa(contenedor, opts = {}) {
  if (!esElementoDOM(contenedor)) {
    throw new TypeError(
      `crearMapa: 'contenedor' debe ser un elemento del DOM; recibido ${JSON.stringify(contenedor)}.`,
    )
  }

  const { vistaInicial, maxZoom = ZOOM_MAXIMO_DEFECTO, ...opcionesLeaflet } = opts

  if (vistaInicial !== undefined) {
    // Validador COMPARTIDO con `crearVisor` (`viewer/_comun.js`): había una copia
    // aquí y otra allí, y ya habían divergido (ver el JSDoc del validador).
    validarVistaInicial(vistaInicial, CONTEXTO_VISTA_INICIAL)
  }

  // `zoomSnap`/`maxZoom`/`attributionControl` van DESPUÉS de `...opcionesLeaflet`
  // a propósito: son decisiones fijas de este módulo (ver cabecera) y ninguna
  // opción que pase el llamante puede pisarlas. `attributionControl` está aquí
  // porque su ausencia incumpliría el criterio de aceptación 5 (obligación
  // legal de atribución), no por gusto de simetría.
  const mapa = L.map(contenedor, {
    ...opcionesLeaflet,
    zoomSnap: 0,
    maxZoom,
    attributionControl: true,
  })

  // Decisión 2: los tres panes de PANES, con su zIndex aplicado al estilo.
  // Se itera PANES (nunca se copian nombres/zIndex a mano): `_comun.js` es la
  // única fuente de verdad, y el orden de PANES ya es el zIndex creciente
  // (parcelaOficial < parcelaEditada < vertices).
  const panes = {}
  for (const { nombre, zIndex } of PANES) {
    const pane = mapa.createPane(nombre)
    pane.style.zIndex = String(zIndex)
    panes[nombre] = pane
  }

  // Decisión 3: solo la barra gráfica de escala (metric); la numérica es F09.
  L.control.scale({ metric: true, imperial: false }).addTo(mapa)

  // Sin capas (Fase 3) y sin encuadre implícito (contrato de crearVisor):
  // solo se centra si el llamante lo pide explícitamente.
  if (vistaInicial !== undefined) {
    mapa.setView(vistaInicial.centro, vistaInicial.zoom)
  }

  let destruido = false
  function destruir() {
    if (destruido) return
    destruido = true
    mapa.remove()
  }

  return { mapa, panes, destruir }
}

// viewer/_comun.js — F03 · Visor. Contratos y utilidades COMPARTIDAS del visor.
//
// Keystone del visor: todo `viewer/*` y `services/*` importa de aquí. Fija el
// vocabulario común (descriptor de capa, panes, color), la FRONTERA DE VISTA
// (proyección UTM↔lat/lon, único punto del visor donde aparece lat/lon) y el
// STORE de estado del que la tabla y el mapa son vistas.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 3 — El modelo va SIEMPRE en UTM. lat/lon SÓLO para pintar: la
//     desproyección vive aquí, en la capa de vista, y NUNCA se guarda en el
//     modelo. `geo/utm.js` es la maquinaria; este módulo es el adaptador de
//     vista (recinto/vértice UTM → [lat,lon] para Leaflet, y de vuelta).
//   · Regla 4 — POJO plano. El estado del store ES el POJO de parcela que
//     `edit/historial.js#commit` fotografía con `structuredClone` (decisión de
//     review, hallazgo 1): así F06 enchufa undo/redo SIN reformar el estado.
//   · Regla 1 — Ningún error silencioso: contrato roto por el programador
//     (zona/estado inválidos) → throw; nunca se corrige callado.
//
// IMPORTANTE (decisión de review, Codex C1): este módulo NO importa Leaflet
// (no usa `L.*`), por eso es seguro importarlo también bajo el proyecto Vitest
// `node`. Los módulos que sí usan Leaflet (`services/ign`, `viewer/wms-catastro`,
// `viewer/mapa`, `viewer/sincronizacion`) son SOLO-navegador y jamás deben
// entrar por el barrel raíz `index.js` (rompería la suite node: Leaflet exige
// `window`).

import { forward, inverse } from '../geo/utm.js'

// ── Vocabulario común ─────────────────────────────────────────────────────────

/**
 * Descriptor de una capa del visor (base o superpuesta). POJO plano.
 *
 * @typedef {Object} DescriptorCapa
 * @property {string} nombre        Rótulo para el control de capas (español).
 * @property {'base'|'overlay'} rol Capa base (excluyente) o superpuesta.
 * @property {() => object} crear   Factory que devuelve la capa Leaflet, montada
 *                                  SIEMPRE con `crossOrigin:'anonymous'` (O7).
 * @property {string} atribucion    Texto legal de atribución (obligatorio).
 */

/**
 * Un vértice de la tabla/mapa, referido a su recinto. Coincide 1:1 con el
 * `RefVertice` de `validation/_comun.js` (`{recinto, indice}`) para que el
 * resaltado de F02 case sin traducción (decisión de review, hallazgo 8/C6).
 *
 * @typedef {Object} RefVertice
 * @property {number} recinto  Índice del recinto (0 = EXTERIOR; ≥1 = HUECO).
 * @property {number} indice   Índice del vértice dentro del anillo ABIERTO.
 */

/** Color de la geometría del usuario (violeta; el azul choca con la hidrografía). */
export const COLOR_USUARIO = '#7C3AED'

/** Densidad tipográfica base del cromo del visor, en px. */
export const DENSIDAD_BASE_PX = 13

/** Nombres canónicos de los panes del visor. */
export const PANE = Object.freeze({
  PARCELA_OFICIAL: 'parcelaOficial',
  PARCELA_EDITADA: 'parcelaEditada',
  VERTICES: 'vertices',
})

/**
 * Panes del visor con zIndex CRECIENTE (SPEC feature-03, Interacción): la
 * geometría editada va sobre la oficial y los vértices SIEMPRE encima. Los
 * valores caen entre `overlayPane` (400) y `markerPane` (600) de Leaflet.
 *
 * @type {ReadonlyArray<{nombre:string, zIndex:number}>}
 */
export const PANES = Object.freeze([
  { nombre: PANE.PARCELA_OFICIAL, zIndex: 410 },
  { nombre: PANE.PARCELA_EDITADA, zIndex: 420 },
  { nombre: PANE.VERTICES, zIndex: 430 },
])

// ── Frontera de vista: proyección UTM ↔ lat/lon (regla 3) ─────────────────────

/**
 * Un vértice UTM `[x, y]` → `[lat, lon]` para Leaflet (que espera `[lat, lng]`).
 * Único sentido de desproyección del visor; delega en `geo/utm.js#inverse`.
 *
 * @param {[number, number]} vertice  Par UTM `[x, y]` (Este, Norte).
 * @param {number} zona               Huso UTM (29, 30 o 31).
 * @returns {[number, number]}        `[lat, lon]` en grados.
 */
export function vertUTMaLatLng(vertice, zona) {
  if (!Array.isArray(vertice) || vertice.length < 2) {
    throw new TypeError(
      `vertUTMaLatLng: 'vertice' debe ser un par UTM [x,y]; recibido ${JSON.stringify(vertice)}.`,
    )
  }
  const { lat, lon } = inverse(vertice[0], vertice[1], zona)
  return [lat, lon]
}

/**
 * Los vértices de un recinto (anillo ABIERTO en UTM) → array de `[lat, lon]`
 * para dibujar el anillo en Leaflet. NO cierra el anillo (Leaflet lo cierra al
 * pintar un `L.polygon`).
 *
 * @param {{vertices: [number, number][]}} recinto  Recinto del modelo.
 * @param {number} zona                             Huso UTM (29/30/31).
 * @returns {[number, number][]}                    Anillo en `[lat, lon]`.
 */
export function recintoALatLng(recinto, zona) {
  if (!recinto || !Array.isArray(recinto.vertices)) {
    throw new TypeError(
      `recintoALatLng: 'recinto' debe tener 'vertices' (array de pares [x,y]); ` +
        `recibido ${JSON.stringify(recinto)}.`,
    )
  }
  return recinto.vertices.map((v) => vertUTMaLatLng(v, zona))
}

/**
 * Posición de Leaflet (`{lat, lng}` o `[lat, lng]`) → vértice UTM `[x, y]` para
 * escribir en el modelo. Único sentido de proyección del visor; delega en
 * `geo/utm.js#forward`. Es la mitad de vuelta del arrastre: `drag → aquí → set`.
 *
 * @param {{lat:number, lng:number} | [number, number]} latlng
 * @param {number} zona  Huso UTM (29/30/31).
 * @returns {[number, number]}  Par UTM `[x, y]`.
 */
export function latLngAUTM(latlng, zona) {
  let lat, lng
  if (Array.isArray(latlng)) {
    ;[lat, lng] = latlng
  } else if (latlng && typeof latlng === 'object') {
    lat = latlng.lat
    lng = latlng.lng
  }
  if (typeof lat !== 'number' || typeof lng !== 'number') {
    throw new TypeError(
      `latLngAUTM: 'latlng' debe ser {lat,lng} o [lat,lng] numérico; recibido ${JSON.stringify(latlng)}.`,
    )
  }
  const { x, y } = forward(lat, lng, zona)
  return [x, y]
}

// ── Store de estado de vista ──────────────────────────────────────────────────

/**
 * Un suscriptor del store: se le notifica con el estado actual tras cada `set`.
 * @callback Suscriptor
 * @param {object|null} estado  El POJO de parcela actual (o null).
 * @returns {void}
 */

/**
 * @typedef {Object} EstadoVista
 * @property {() => (object|null)} get               Devuelve el estado actual.
 * @property {(parcela: object|null) => void} set    Reemplaza el estado y notifica.
 * @property {(fn: Suscriptor) => (() => void)} subscribe  Registra un suscriptor;
 *   devuelve una función para darse de baja.
 */

/**
 * Crea el store observable del visor. El estado ES el POJO de parcela (o null),
 * la MISMA forma que `edit/historial.js#commit` fotografía (decisión de review,
 * hallazgo 1): F06 enchufará undo/redo haciendo `commit(historial, estado.get())`
 * sin reformar nada.
 *
 * Tabla y mapa son AMBOS vistas del mismo estado: se suscriben, y cuando uno
 * edita llama a `set`, que reemplaza el estado y notifica a todos. Una GUARDA
 * anti-reentrada evita el bucle de realimentación (SPEC feature-03: "sin feedback
 * loop"): si un suscriptor llama a `set` durante la notificación, el estado se
 * actualiza pero NO se relanza la notificación en cascada.
 *
 * @param {object|null} [parcelaInicial=null]  POJO de parcela inicial (o null).
 * @returns {EstadoVista}
 */
export function crearEstadoVista(parcelaInicial = null) {
  let estado = parcelaInicial
  const suscriptores = new Set()
  let notificando = false

  return {
    get: () => estado,

    set(parcela) {
      estado = parcela
      // Guarda anti-reentrada: si el set ocurre DENTRO de una notificación
      // (un suscriptor que reacciona escribiendo), no relanzamos la cascada.
      if (notificando) return
      notificando = true
      try {
        for (const fn of suscriptores) fn(estado)
      } finally {
        notificando = false
      }
    },

    subscribe(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`subscribe: 'fn' debe ser una función; recibido ${typeof fn}.`)
      }
      suscriptores.add(fn)
      return () => suscriptores.delete(fn)
    },
  }
}

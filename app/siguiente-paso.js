// app/siguiente-paso.js — 2026-10-25 · EL BOTÓN «SIGUIENTE» AL PIE DEL PANEL.
//
// ── POR QUÉ EXISTE ──────────────────────────────────────────────────────────
// Encargo del autor, el 2026-10-25: «el usuario puede no saber las funciones que
// tiene» y, del edificio, «es difícil de entender los pasos y cómo hay que
// hacerlo». Medido el mismo día en Chrome a 1440×900: se carga un GML de 13
// partes, el panel dice «Cargadas 13 partes»… **y se queda en Entrada**. Nada en
// la columna dice que lo siguiente es Edición; la única pista es el rail de
// arriba, que es NAVEGACIÓN (se pulsa si ya sabes a dónde vas), no GUÍA.
//
// Este módulo es la guía: un botón al pie del panel que nombra el paso siguiente
// con un verbo («Siguiente: editar el recinto») y lleva a él. En el último paso
// no hay botón: hay una frase que señala «Generar GML», que es donde termina el
// recorrido y vive en la barra.
//
// ⚠️ **En Edición se calla entero** ({@link PASOS_CON_GUIA_PROPIA}). Allí la guía
// es «Diagnosticar encaje» del pie, que ya llevaba al Diagnóstico y ahora es
// primario y se rotula «Siguiente: …». Dos botones para el mismo gesto, uno
// encima del otro, costaban 57 px que la tabla de vértices no tiene a 1280×720
// (medido: se quedaba en la cabecera, sin una fila).
//
// ── QUIÉN DECIDE Y QUIÉN PINTA ──────────────────────────────────────────────
// **No decide nada.** Si el paso siguiente está abierto lo dice
// `navegacion.puedeIrA` —la misma `evaluarPaso` que pinta el rail— y el motivo de
// un apagado es el `breve`/`motivo` que ya redacta `app/navegacion.js`. Así el
// botón y el rail no pueden discrepar: son dos lecturas de un solo veredicto.
//
// ⛔ **Apagado y con su motivo, jamás retirado** (DESIGN.md §8). Sin geometría el
// botón sigue ahí, gris, con el BREVE visible debajo («Falta la parcela») y el
// LARGO en el `title`.
//
// ── FABRICA SU MARCADO, Y `destruir()` LO QUITA ─────────────────────────────
// Igual que `app/rama.js` con su conmutador: `index.html` no se toca, y la
// cáscara no se queda con un botón huérfano el día que nadie cablee esto.

import { PASO, PASOS, RAMA } from './navegacion.js'

/** El rótulo del botón, por rama y por paso DE DESTINO. Verbo y objeto: dice lo
 *  que vas a hacer allí, no el nombre de la pantalla, que ya está en el rail.
 *  Sin Diagnóstico como destino: ese rótulo es el del CTA del pie (`index.html`). */
export const ROTULO_SIGUIENTE = Object.freeze({
  [RAMA.PARCELA]: Object.freeze({ edicion: 'Siguiente: editar el recinto →' }),
  [RAMA.EDIFICIO]: Object.freeze({ edicion: 'Siguiente: revisar las partes →' }),
})

/** Los pasos cuyo pie ya trae su propio botón «Siguiente». Ver la cabecera. */
export const PASOS_CON_GUIA_PROPIA = Object.freeze([PASO.EDICION])

/** Lo que se lee en el último paso, donde no hay paso siguiente. */
export const MENSAJE_ULTIMO_PASO =
  'Último paso. Cuando el diagnóstico te convenza, pulsa «Generar GML», arriba a la derecha.'

export const CLASE_SIGUIENTE = 'gml-siguiente'

export const SELECTOR = Object.freeze({
  BLOQUE: '[data-siguiente]',
  BOTON: '[data-accion="siguiente-paso"]',
  ESTADO: '[data-estado="siguiente-paso"]',
  /** Delante de quién se inserta: el acuse de «Generar GML», último hijo del panel. */
  ANCLA: '[data-estado="generar-gml"]',
})

/**
 * El paso que viene después de `paso`, o `null` si es el último.
 * @param {string} paso
 */
export function pasoSiguiente(paso) {
  const i = PASOS.indexOf(paso)
  return i >= 0 && i < PASOS.length - 1 ? PASOS[i + 1] : null
}

/**
 * Monta el botón al pie de `panel` y lo tiene al día con la navegación.
 *
 * @param {Object} opciones
 * @param {Document} opciones.documento
 * @param {HTMLElement} opciones.panel  El `<aside class="gml-panel">`.
 * @param {{get: Function, subscribe: Function, puedeIrA: Function, navegarAPaso: Function}} opciones.navegacion
 * @returns {{repintar: () => void, destruir: () => void}}
 */
export function cablearSiguientePaso({ documento, panel, navegacion }) {
  if (!panel || typeof panel.querySelector !== 'function') {
    throw new TypeError('cablearSiguientePaso: falta el panel donde montar el botón.')
  }
  if (!navegacion || typeof navegacion.subscribe !== 'function') {
    throw new TypeError('cablearSiguientePaso: falta la navegación de app/navegacion.js.')
  }

  const bloque = documento.createElement('div')
  bloque.className = CLASE_SIGUIENTE
  bloque.setAttribute('data-siguiente', '')

  const boton = documento.createElement('button')
  boton.type = 'button'
  boton.className = 'gml-boton gml-boton--primario'
  boton.setAttribute('data-accion', 'siguiente-paso')

  const estado = documento.createElement('p')
  estado.className = 'gml-accion-estado'
  estado.setAttribute('data-estado', 'siguiente-paso')
  estado.setAttribute('role', 'status')

  bloque.append(boton, estado)
  const ancla = panel.querySelector(SELECTOR.ANCLA)
  if (ancla && ancla.parentNode === panel) panel.insertBefore(bloque, ancla)
  else panel.appendChild(bloque)

  function pintar() {
    const { rama, paso } = navegacion.get()
    bloque.hidden = PASOS_CON_GUIA_PROPIA.includes(paso)
    if (bloque.hidden) return
    const destino = pasoSiguiente(paso)
    if (destino === null) {
      boton.hidden = true
      boton.dataset.destino = ''
      estado.textContent = MENSAJE_ULTIMO_PASO
      return
    }
    const veredicto = navegacion.puedeIrA(destino)
    boton.hidden = false
    boton.dataset.destino = destino
    boton.textContent = ROTULO_SIGUIENTE[rama][destino]
    boton.disabled = !veredicto.disponible
    if (veredicto.disponible) {
      boton.removeAttribute('title')
      estado.textContent = ''
    } else {
      boton.title = veredicto.motivo ?? ''
      estado.textContent = veredicto.breve ?? veredicto.motivo ?? ''
    }
  }

  function alPulsar() {
    const destino = boton.dataset.destino
    if (!destino) return
    const desenlace = navegacion.navegarAPaso(destino)
    if (!desenlace.ok) estado.textContent = desenlace.motivo ?? ''
  }

  boton.addEventListener('click', alPulsar)
  const baja = navegacion.subscribe(pintar)
  pintar()

  return {
    repintar: pintar,
    destruir() {
      baja()
      boton.removeEventListener('click', alPulsar)
      bloque.remove()
    },
  }
}

export default cablearSiguientePaso

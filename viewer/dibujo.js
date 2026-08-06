// viewer/dibujo.js — F12 · T3.3. LOS GESTOS DE DIBUJAR UN RECINTO SOBRE EL MAPA.
//
// La otra mitad de `edit/dibujo.js`. Allí está la máquina de estados pura —qué es
// un trazo, cuándo se puede cerrar, qué se ignora—; aquí están el ratón, el
// teclado y lo que se ve mientras tanto. La frontera es la de siempre en este
// proyecto: `edit/` sabe geometría, `viewer/` sabe gestos.
//
//   const dibujo = crearDibujo({ mapa, zona, ajustar: edicion.ajustar, alCerrar })
//   dibujo.empezar()          // la barra pulsa «Dibujar recinto»
//   …clics del usuario…
//   // al cerrar, `alCerrar(recinto)` recibe el `{tipo:'EXTERIOR', vertices}`
//
// ═════════════════════════════════════════════════════════════════════════════
// LOS GESTOS, Y POR QUÉ ESTOS
// ═════════════════════════════════════════════════════════════════════════════
//   · **Clic** en el mapa → pone un vértice. El punto pasa antes por `ajustar`,
//     que es **el mismo gancho que usa el arrastre de F06**: el dibujo no tiene
//     su propia idea de dónde está el parcelario (ver `edit/dibujo.js`).
//   · **Doble clic** → cierra. Es el gesto que espera cualquiera que haya dibujado
//     en un CAD o en un mapa, y por eso hay que apagarle al mapa el zoom por doble
//     clic mientras dura: si no, cerrar el recinto ampliaría además.
//     ⭐ Leaflet dispara los DOS `click` del doble antes que el `dblclick`, y aquí
//     no hay que descontar nada: los dos caen en el mismo punto y el segundo ya lo
//     ignora `edit/dibujo.js` con `PUNTO_REPETIDO`. Descontarlo a mano quitaba un
//     vértice bueno — lo cazó una prueba, ver {@link crearDibujo} → `cerrarAhora`.
//   · **Enter** → cierra también, para quien va por teclado.
//   · **Backspace / Delete** → deshace el último vértice.
//   · **Escape** → cancela el trazo entero.
//
// ── LO QUE ESTE MÓDULO NO HACE ──────────────────────────────────────────────
//   · **No apaga la edición.** Mientras se dibuja no se puede arrastrar un
//     vértice de la parte, pero quien apaga eso es `app/`, llamando a
//     `edicion.activa(false)`. Este módulo no conoce a la edición ni al revés.
//   · **No escribe en ningún store.** Entrega el recinto por `alCerrar` y se
//     olvida; quien lo mete en el modelo es `edificio/mutaciones.js` a través del
//     cableado. Un módulo del visor que escribiera en el modelo sería el defecto
//     que el rework de UI vino a quitar.
//   · **No valida la geometría.** Cerrar un contorno que se cruza consigo mismo
//     está PERMITIDO a propósito: es un hallazgo de `validation/`, no un fallo de
//     la herramienta (razonado en `edit/dibujo.js`).
//
// ── DÓNDE SE PINTA ──────────────────────────────────────────────────────────
// En el pane `vertices` (430), el más alto: lo que se está dibujando es lo que se
// está mirando, y tiene que quedar por encima de las huellas y de la parcela. En
// amarillo {@link COLOR_USUARIO}, que es el color de «esto es tuyo» desde F03.

import L from 'leaflet'

import {
  MENSAJE_POR_MOTIVO_DIBUJO,
  MOTIVO_DIBUJO,
  anadirPunto,
  cancelar,
  cerrar as cerrarTrazo,
  deshacerUltimo,
  iniciar,
  recintoDe,
  sePuedeCerrar,
} from '../edit/dibujo.js'
import {
  COLOR_USUARIO,
  NIVEL,
  PANE,
  latLngAUTM,
  pedirZoomDobleClicApagado,
  resolverAvisar,
  soltarZoomDobleClicApagado,
  vertUTMaLatLng,
} from './_comun.js'

// ── Constantes de aspecto ────────────────────────────────────────────────────

/** Clase del trazo en curso. Contrato con `estilos/app.css` si algún día lo viste. */
export const CLASE_TRAZO = 'gml-trazo'

/** Clase de cada vértice ya puesto. */
export const CLASE_PUNTO_TRAZO = 'gml-trazo-punto'

/**
 * Radio en píxeles de los puntos ya puestos. Más pequeño que el marcador de
 * vértice de F06 (que es agarrable): éstos **no se agarran**, solo se ven.
 */
const RADIO_PUNTO_PX = 4

/** Estilo de la polilínea en curso. Discontinua: todavía no es un recinto. */
const ESTILO_TRAZO = Object.freeze({
  color: COLOR_USUARIO,
  weight: 2,
  dashArray: '6 4',
  interactive: false,
})

const ESTILO_PUNTO = Object.freeze({
  color: COLOR_USUARIO,
  fillColor: COLOR_USUARIO,
  fillOpacity: 1,
  weight: 1,
  interactive: false,
})

// ── Lo que se le dice al usuario ─────────────────────────────────────────────

/** Al empezar. Dice los tres gestos que hacen falta y ninguno más. */
export const MENSAJE_EMPEZAR =
  'Dibujando el recinto: pincha cada esquina. Doble clic o Enter para cerrarlo, Retroceso para ' +
  'quitar el último punto, Escape para cancelar.'

/** Al cerrar bien. Lleva la cifra porque es lo que se comprueba de un vistazo. */
export const mensajeCerrado = (n) => `Recinto cerrado con ${n} vértices.`

/** Al cancelar habiendo puesto algo. Si no se había puesto nada no se dice nada. */
export const MENSAJE_CANCELADO = 'Dibujo cancelado: no se ha creado ningún recinto.'

// ── Helpers ──────────────────────────────────────────────────────────────────

const describir = (v) => (v === null ? 'null' : Array.isArray(v) ? 'un array' : typeof v)

/**
 * Crea la interacción de dibujo sobre un mapa.
 *
 * @param {object} opciones
 * @param {import('leaflet').Map} opciones.mapa
 * @param {number} opciones.zona  Huso UTM (29, 30 o 31).
 * @param {((punto: [number,number]) => ({punto: [number,number]}|null))|null} [opciones.ajustar]
 *   El gancho de enganche de F06 (`visor.edicion.ajustar`). `null` = sin snap.
 *   ⚠️ Se le pasa el punto CRUDO en UTM y se usa lo que devuelva; su firma real
 *   lleva además una `RefVertice`, que aquí no existe (no se está moviendo ningún
 *   vértice) y por eso se llama con `null`.
 * @param {(recinto: object) => void} opciones.alCerrar  Recibe el
 *   `{tipo:'EXTERIOR', vertices}` terminado. Es la ÚNICA salida de este módulo.
 * @param {import('./_comun.js').Avisar} [opciones.alAvisar]
 * @returns {object}
 * @throws {TypeError|RangeError}
 */
export function crearDibujo({ mapa, zona, ajustar = null, alCerrar, alAvisar } = {}) {
  if (
    !mapa ||
    typeof mapa.on !== 'function' ||
    typeof mapa.off !== 'function' ||
    typeof mapa.addLayer !== 'function'
  ) {
    throw new TypeError(
      `crearDibujo: 'mapa' debe ser un L.Map (con on/off/addLayer); recibido ${describir(mapa)}.`,
    )
  }
  if (![29, 30, 31].includes(zona)) {
    throw new RangeError(`crearDibujo: 'zona' inválida: ${JSON.stringify(zona)}. Válidas: 29, 30, 31.`)
  }
  if (typeof alCerrar !== 'function') {
    throw new TypeError(
      `crearDibujo: 'alCerrar' es obligatorio y debe ser una función: es la única salida de ` +
        `este módulo. Recibido ${describir(alCerrar)}.`,
    )
  }
  if (ajustar !== null && typeof ajustar !== 'function') {
    throw new TypeError(
      `crearDibujo: 'ajustar' debe ser el gancho de enganche o null; recibido ${describir(ajustar)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  let vivo = true
  let dibujando = false
  let trazo = iniciar()
  let linea = null
  const puntos = []
  const doc = typeof document === 'undefined' ? null : document

  // ── Pintado ───────────────────────────────────────────────────────────────

  function limpiarPintura() {
    if (linea !== null) {
      mapa.removeLayer(linea)
      linea = null
    }
    for (const p of puntos) mapa.removeLayer(p)
    puntos.length = 0
  }

  function repintar() {
    limpiarPintura()
    if (trazo.puntos.length === 0) return
    const latlngs = trazo.puntos.map((p) => vertUTMaLatLng(p, zona))
    if (latlngs.length >= 2) {
      linea = L.polyline(latlngs, { ...ESTILO_TRAZO, pane: PANE.VERTICES })
      linea.addTo(mapa)
    }
    for (const ll of latlngs) {
      const punto = L.circleMarker(ll, {
        ...ESTILO_PUNTO,
        radius: RADIO_PUNTO_PX,
        pane: PANE.VERTICES,
        className: CLASE_PUNTO_TRAZO,
      })
      punto.addTo(mapa)
      puntos.push(punto)
    }
    if (linea !== null && typeof linea.getElement === 'function') {
      const el = linea.getElement()
      if (el && el.classList) el.classList.add(CLASE_TRAZO)
    }
  }

  // ── El punto que entra ────────────────────────────────────────────────────

  /**
   * El punto del evento, en UTM y **ya enganchado** si hay snap.
   *
   * Se le pasa `excluir: null` porque aquí no se está moviendo ningún vértice
   * existente: no hay nada que excluir del catálogo de dianas.
   */
  function puntoDe(evento) {
    const crudo = latLngAUTM(evento.latlng, zona)
    if (ajustar === null) return crudo
    const enganche = ajustar(crudo, null)
    return enganche && Array.isArray(enganche.punto) ? enganche.punto : crudo
  }

  /** Aplica un resultado de `edit/dibujo.js` y avisa si rechazó la operación. */
  function aplicar(resultado, { silencioso = false } = {}) {
    if (resultado.motivo === null) {
      trazo = resultado.trazo
      repintar()
      return true
    }
    // Un punto repetido es ruido del enganche, no un error del usuario: no se
    // interrumpe con un aviso cada vez que dos clics caen en el mismo vértice.
    if (!silencioso && resultado.motivo !== MOTIVO_DIBUJO.PUNTO_REPETIDO) {
      avisar(mensajePorMotivo(resultado.motivo), { nivel: NIVEL.ERROR })
    }
    return false
  }

  /**
   * El texto de un motivo. **Los redacta `edit/dibujo.js`, no este módulo**: es la
   * misma regla que ya cumple `viewer/edicion.js` con `MENSAJE_POR_MOTIVO` de
   * `edit/vertices.js` — quien decide los motivos escribe sus palabras, o acaban
   * dichos de dos formas distintas en dos pantallas.
   */
  const mensajePorMotivo = (motivo) => MENSAJE_POR_MOTIVO_DIBUJO[motivo] ?? motivo

  // ── Gestos ────────────────────────────────────────────────────────────────

  const alClic = (evento) => {
    if (!vivo || !dibujando || !evento || !evento.latlng) return
    aplicar(anadirPunto(trazo, puntoDe(evento)))
  }

  const alDobleClic = (evento) => {
    if (!vivo || !dibujando) return
    if (evento && evento.originalEvent) L.DomEvent.stop(evento.originalEvent)
    cerrarAhora()
  }

  const alTeclear = (evento) => {
    if (!vivo || !dibujando || !evento) return
    if (evento.key === 'Escape') {
      cancelarAhora()
      return
    }
    if (evento.key === 'Enter') {
      cerrarAhora()
      return
    }
    if (evento.key === 'Backspace' || evento.key === 'Delete') {
      // Sin esto, `Backspace` navega hacia atrás en algunos navegadores.
      if (typeof evento.preventDefault === 'function') evento.preventDefault()
      aplicar(deshacerUltimo(trazo))
    }
  }

  // ── Las tres salidas ──────────────────────────────────────────────────────

  /**
   * Cierra el trazo y entrega el recinto.
   *
   * ⭐ **Aquí NO hay que descontar el vértice del doble clic, y eso lo descubrió
   * una prueba.** El razonamiento con el que se escribió este módulo era: «un
   * doble clic dispara dos `click` y luego `dblclick`, así que al cerrar sobra un
   * vértice». La primera mitad es cierta; la conclusión, no. Los dos `click` de un
   * doble caen en el MISMO punto, y un punto encima del anterior ya lo ignora
   * `edit/dibujo.js` con {@link MOTIVO_DIBUJO}.PUNTO_REPETIDO — que existe
   * exactamente para esto y estaba escrito antes.
   *
   * Descontar a mano quitaba un vértice BUENO: pinchar A, B, C y hacer doble clic
   * en D daba un triángulo, no el cuadrilátero que el usuario había dibujado.
   * La regla que queda es la de siempre: **una sola definición de cada cosa, y en
   * la capa que sabe** — la deduplicación es geometría, y la geometría es de
   * `edit/`.
   */
  function cerrarAhora() {
    const candidato = trazo
    if (!sePuedeCerrar(candidato)) {
      avisar(mensajePorMotivo(MOTIVO_DIBUJO.MINIMO_TRES_VERTICES), { nivel: NIVEL.ERROR })
      return false
    }
    const resultado = cerrarTrazo(candidato)
    if (resultado.motivo !== null) {
      avisar(mensajePorMotivo(resultado.motivo), { nivel: NIVEL.ERROR })
      return false
    }
    const recinto = recintoDe(resultado.trazo)
    const n = recinto.vertices.length
    parar()
    avisar(mensajeCerrado(n), { nivel: NIVEL.INFO })
    alCerrar(recinto)
    return true
  }

  function cancelarAhora() {
    const habiaAlgo = trazo.puntos.length > 0
    parar()
    if (habiaAlgo) avisar(MENSAJE_CANCELADO, { nivel: NIVEL.INFO })
  }

  /** Deja de dibujar: quita los oyentes, la pintura y devuelve el zoom. */
  function parar() {
    if (!dibujando) return
    dibujando = false
    trazo = cancelar()
    limpiarPintura()
    mapa.off('click', alClic)
    mapa.off('dblclick', alDobleClic)
    if (doc) doc.removeEventListener('keydown', alTeclear)
    soltarZoomDobleClicApagado(mapa)
  }

  return {
    /**
     * Empieza a dibujar. Llamarlo dos veces no reinicia el trazo: es la misma
     * intención dicha dos veces, no una orden de tirar lo que llevas puesto.
     */
    empezar() {
      if (!vivo || dibujando) return false
      dibujando = true
      trazo = iniciar()
      mapa.on('click', alClic)
      mapa.on('dblclick', alDobleClic)
      if (doc) doc.addEventListener('keydown', alTeclear)
      // El doble clic CIERRA, así que mientras dura no puede ampliar además.
      pedirZoomDobleClicApagado(mapa)
      avisar(MENSAJE_EMPEZAR, { nivel: NIVEL.INFO })
      return true
    },

    /** Cancela el trazo en curso. Idempotente: cancelar sin dibujar no hace nada. */
    cancelar: cancelarAhora,

    /** Cierra por botón (equivale a `Enter`). `false` si todavía no se podía. */
    cerrar: () => cerrarAhora(),

    /** ¿Se está dibujando ahora mismo? */
    dibujando: () => dibujando,

    /** ¿Se puede cerrar ya? La barra lo usa para encender su botón. */
    sePuedeCerrar: () => dibujando && sePuedeCerrar(trazo),

    /** Cuántos vértices lleva puestos. Para el renglón de estado. */
    nVertices: () => trazo.puntos.length,

    destruir() {
      if (!vivo) return
      parar()
      vivo = false
    },
  }
}

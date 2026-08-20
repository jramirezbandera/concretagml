// viewer/puntos-levantamiento.js — LOS PUNTOS SUELTOS DEL LEVANTAMIENTO, PINTADOS.
//
// ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────
//
// El fichero real de un topógrafo no trae polilíneas: trae **puntos sueltos**.
// Desde el 2026-08-19 se pueden importar sin unir (`parsers/importar.js`,
// `opts.soloPuntos`) y quedan como DIANAS de enganche para dibujar el linde encima
// con la herramienta de `viewer/dibujo.js`.
//
// ⛔ **Y sin esta capa esas dianas eran invisibles.** `edit/snap.js#dianasDe` ya
// las ponía las primeras del catálogo y `viewer/edicion.js#fijarPuntos` ya las
// recibía —escrito, documentado y probado desde el paso 9 de F18— pero **nada las
// dibujaba**: el usuario tenía que adivinar dónde estaban sus 88 esquinas y
// comprobar a posteriori, por el salto del cursor, si había enganchado. Un
// enganche que no se ve no es una ayuda, es una lotería.
//
// ── LO QUE ESTA CAPA NO HACE ────────────────────────────────────────────────
//   · **No engancha.** El snap es de `edit/snap.js`, y quien le da los puntos es
//     `viewer/edicion.js#fijarPuntos`. Aquí solo se ven. Que las dos cosas se
//     alimenten del MISMO array —`parcela.puntosLevantamiento`— es lo que impide
//     que lo dibujado y lo enganchable se separen.
//   · **No escribe en ningún store.** No tiene eventos ni salidas: es la capa más
//     tonta del visor, a propósito.
//   · **No se agarra.** `interactive: false`: un punto de levantamiento no se
//     mueve —es LO MEDIDO, el término de comparación— y hacerlo agarrable
//     invitaría a corregir el dato de campo con el ratón. Para eso está el vértice
//     del recinto, que es otra cosa y se ve distinta.
//
// ── CÓMO SE VEN, Y POR QUÉ NO COMO UN VÉRTICE ──────────────────────────────
// En {@link COLOR_USUARIO} —el amarillo de «esto es tuyo» desde F03, porque son
// del técnico y no del Catastro— pero **huecos**: aro fino sin relleno, más
// pequeño que el cuadradito agarrable de F06. La leyenda los nombra bajo «Tu
// medición» junto al recinto y al vértice, así que la FORMA es lo único que los
// distingue de un vértice, y tiene que distinguirlos: uno se arrastra y el otro
// no. Un círculo hueco es además la convención de «punto de referencia» en
// cualquier CAD.
//
// ── DÓNDE SE PINTA ──────────────────────────────────────────────────────────
// En el pane `puntosLevantamiento` (429), justo por debajo de `vertices` (430):
// encima de toda la geometría —una diana tapada no sirve para apuntar— y debajo
// del trazo que se está dibujando ahora mismo. El porqué de los dos lados está en
// `viewer/_comun.js#PANES`.

import L from 'leaflet'

import { COLOR_USUARIO, NIVEL, PANE, resolverAvisar, vertUTMaLatLng } from './_comun.js'

// ── Constantes de aspecto ────────────────────────────────────────────────────

/** Clase de cada punto. Contrato con `estilos/app.css` si algún día lo viste. */
export const CLASE_PUNTO = 'gml-punto-levantamiento'

/**
 * Radio en píxeles. **Más pequeño que el vértice agarrable de F06 (10 px de lado)
 * y que el punto del trazo en curso (4 px)**: son referencia de fondo, y en un
 * levantamiento de 88 esquinas un punto grande convierte el linde en una cadena
 * de manchas que se tocan.
 */
const RADIO_PX = 3

/** Aro sin relleno: la convención de «punto de referencia», no de «agarrador». */
const ESTILO = Object.freeze({
  color: COLOR_USUARIO,
  weight: 1.5,
  fillOpacity: 0,
  interactive: false,
})

/** Husos que este proyecto sabe pintar (Península + Baleares). */
const HUSOS_VALIDOS = Object.freeze([29, 30, 31])

// ── Helpers ──────────────────────────────────────────────────────────────────

const describir = (v) => (v === null ? 'null' : Array.isArray(v) ? 'un array' : typeof v)

const esPar = (p) =>
  Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1])

/**
 * Lo que se dice cuando el array trae pares que no lo son. **Se dice, no se
 * calla** (regla de oro 1), pero no lanza: un par malo suelto es dato, y la nube
 * entera no puede perderse por él. Es el mismo trato que `viewer/piezas.js` da a
 * una pieza sin contorno.
 */
export const mensajeDescartados = (cuantos, total) =>
  `${cuantos} de los ${total} puntos del levantamiento no traen unas coordenadas utilizables y ` +
  `no se han dibujado. Los demás sí están, y se puede seguir dibujando sobre ellos.`

/**
 * @typedef {object} CapaPuntosLevantamiento
 * @property {(puntos: Array<[number,number]>|null) => void} pintar
 * @property {() => void} limpiar
 * @property {() => void} destruir
 */

/**
 * Crea la capa de puntos sueltos del levantamiento.
 *
 * ```js
 * const capa = crearCapaPuntosLevantamiento({ mapa, zona: 30, alAvisar })
 * capa.pintar(parcela.puntosLevantamiento)   // pares UTM
 * capa.pintar(null)                          // limpia
 * capa.destruir()
 * ```
 *
 * ⚠️ Recibe **PARES `[x, y]` en UTM**, no los objetos `{capa, x, y, z}` del
 * parser, y por lo mismo que `viewer/edicion.js#fijarPuntos`: este lado del
 * proyecto no conoce ni capas de DXF ni cotas. La conversión es de quien cablea, y
 * aquí se lanza diciéndolo en vez de dibujar cero puntos en silencio.
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado, con el pane
 *   `PANE.PUNTOS_LEVANTAMIENTO` montado (lo crea `crearMapa` iterando `PANES`).
 * @param {number} args.zona  Huso UTM (29, 30 o 31). **Es el HUSO, no el srs.**
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @returns {CapaPuntosLevantamiento}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearCapaPuntosLevantamiento({ mapa, zona, alAvisar } = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ─────────────
  // Se comprueba lo que este módulo USA de verdad, igual que `crearCapaPiezas`:
  // un guardián que solo mira `addLayer` deja pasar dobles que revientan por
  // dentro.
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.getPane !== 'function'
  ) {
    throw new TypeError(
      `crearCapaPuntosLevantamiento: 'mapa' debe ser un L.Map (con ` +
        `addLayer/removeLayer/getPane); recibido ${describir(mapa)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearCapaPuntosLevantamiento: 'zona' inválida: ${JSON.stringify(zona)}. ` +
        `Válidas: ${HUSOS_VALIDOS.join(', ')}. Ojo: 'zona' es el HUSO, no el srs — ` +
        `de 'EPSG:25830' se saca con geo/huso.js#husoPorSrs.`,
    )
  }
  if (!mapa.getPane(PANE.PUNTOS_LEVANTAMIENTO)) {
    throw new TypeError(
      `crearCapaPuntosLevantamiento: falta el pane '${PANE.PUNTOS_LEVANTAMIENTO}'. Créalo con ` +
        `los nombres de viewer/_comun.js#PANES antes de pintar: estos puntos van SOBRE toda la ` +
        `geometría (son las dianas contra las que se apunta) y bajo el trazo en curso.`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  let vivo = true
  /** Los `L.CircleMarker` puestos por el último `pintar`. */
  let capas = []

  function limpiar() {
    for (const capa of capas) {
      try {
        mapa.removeLayer(capa)
      } catch {
        // Una capa que ya no está en el mapa no es un error que deba tumbar el
        // resto del desmontaje: el desmontaje es idempotente en todo el visor.
      }
    }
    capas = []
  }

  /**
   * Pinta la nube entera, sustituyendo la anterior.
   *
   * @param {Array<[number,number]>|null} puntos  Pares UTM; `null`/`undefined`
   *   ⇒ solo limpia (que es lo que toca al cerrar un expediente).
   * @returns {void}
   * @throws {TypeError} Si no es un array ni `null`, o si trae los objetos del parser.
   */
  function pintar(puntos) {
    // Tras `destruir()` esto es un no-op y no un throw: el desmontaje del visor va
    // en orden inverso. Mismo criterio que `piezas.pintar` y `contraste.pintar`.
    if (!vivo) return
    limpiar()
    if (puntos === null || puntos === undefined) return

    if (!Array.isArray(puntos)) {
      throw new TypeError(
        `pintar: 'puntos' debe ser un array de pares UTM [x, y] —el ` +
          `'puntosLevantamiento' del modelo— o null para limpiar; recibido ${describir(puntos)}.`,
      )
    }
    for (const p of puntos) {
      if (p && typeof p === 'object' && !Array.isArray(p) && 'x' in p && 'y' in p) {
        throw new TypeError(
          `pintar: se esperan PARES [x, y] y han llegado los objetos del parser (los elementos ` +
            `traen 'x' e 'y'). Conviértelos: puntos.map((p) => [p.x, p.y]). Es el mismo contrato ` +
            `que viewer/edicion.js#fijarPuntos, y a propósito: los dos comen del mismo array.`,
        )
      }
    }

    let descartados = 0
    for (const p of puntos) {
      if (!esPar(p)) {
        descartados++
        continue
      }
      const marca = L.circleMarker(vertUTMaLatLng([p[0], p[1]], zona), {
        ...ESTILO,
        radius: RADIO_PX,
        pane: PANE.PUNTOS_LEVANTAMIENTO,
        className: CLASE_PUNTO,
      })
      marca.addTo(mapa)
      capas.push(marca)
    }

    if (descartados > 0) {
      avisar(mensajeDescartados(descartados, puntos.length), { nivel: NIVEL.AVISO })
    }
  }

  return {
    pintar,
    limpiar,

    /** Quita todo y se apaga. Idempotente. */
    destruir() {
      if (!vivo) return
      limpiar()
      vivo = false
    },
  }
}

export default crearCapaPuntosLevantamiento

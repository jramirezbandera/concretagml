// viewer/candidatas.js — F22 · T3.2. LAS FINCAS ENTRE LAS QUE HAY QUE ELEGIR.
//
// Un DXF de «Consulta Masiva» del Catastro trae la manzana entera: ocho fincas
// disjuntas, cada una con su referencia. `parsers/importar.js` sabe demostrar que
// son ocho y sabe cómo se llaman; lo que falta es que el usuario pueda decir cuál
// es la suya. **Ocho referencias catastrales que comparten los once primeros
// caracteres (`6346726UF8664N` / `6346725UF8664N`) no se distinguen leyendo: se
// distinguen viendo.** Esta capa es el «viendo».
//
// ── POR QUÉ ES UNA CAPA APARTE Y NO PARTE DEL CAJÓN ──────────────────────────
//
// Es el patrón de la casa, y se comprobó antes de escribir: **ningún cajón de
// este visor dibuja**. `viewer/cajon-diagnostico.js` y `viewer/cajon-comprobacion.js`
// no importan `PANE` ni construyen una sola capa; lo que se pinta vive en
// `viewer/piezas.js`, `viewer/contraste.js` y `viewer/colindantes.js`. Un control
// es DOM y una capa es geometría, y quien mezcla las dos cosas acaba con un
// control que necesita saber el huso.
//
// ⚠️ Por eso F22 estrena DOS módulos de visor donde su plan preveía uno. La ficha
// lo declara: el plan se escribió antes de mirar cómo está partido el visor.
//
// ── UN ANILLO POR CANDIDATA, Y NO ES UNA SIMPLIFICACIÓN ─────────────────────
//
// Aquí cada candidata es UN anillo sin huecos, y eso no se asume: se DEDUCE del
// caso. Esta capa solo se pinta cuando `parsers/topologia.js` ha demostrado que
// los anillos son disjuntos, y «disjuntos» incluye que **ninguno contiene a
// otro**. Un patio dentro de una finca sería contención, el reparto dejaría de
// ser disjunto y no habría nada que elegir. O sea: en el caso que esta capa
// dibuja, un hueco es imposible por construcción.
//
// ── EL PANE: `colindantes`, el de más abajo ─────────────────────────────────
//
// Estas fincas **todavía no son la parcela** —no ha entrado nada en el store—, y
// llamarlas de otra forma sería adelantar una decisión que el usuario aún no ha
// tomado. `PANE.COLINDANTES` es además el que ya existe para «geometría de
// contexto», y el que garantiza que el día que algo más se pinte encima no lo
// tape. Regla de oro 9: la capa no dictamina, enseña.

import L from 'leaflet'

import { HUSOS_VALIDOS } from '../geo/huso.js'
import { PANE, resolverAvisar, vertUTMaLatLng } from './_comun.js'

/** Clase CSS de una candidata sin resaltar. Contrato con la hoja y con los tests. */
export const CLASE_CANDIDATA = 'gml-candidata'

/**
 * Clase CSS de la candidata resaltada. Se AÑADE a la anterior, no la sustituye.
 *
 * ⛔ **Estuvo exportada y muerta hasta la fase 5**, y es un defecto pequeño de la
 * familia cara: un nombre exportado es un CONTRATO —quien lo lea escribirá una
 * regla en la hoja o buscará por él— y `resaltar` no lo ponía en ningún nodo. La
 * regla nunca habría pintado y nadie habría sabido por qué. Lo destapó escribir
 * el guion de humo, buscando cómo afirmar el resalte desde fuera del módulo.
 */
export const CLASE_RESALTADA = 'gml-candidata--resaltada'

/** Clase del emergente con el nombre de la candidata. */
export const CLASE_EMERGENTE = 'gml-candidata-emergente'

/**
 * Cómo se encuentra en el documento la finca nº `i` de la lista.
 *
 * ⚠️ **Por atributo y NO por posición**, porque `resaltar` llama a
 * `bringToFront` y eso reordena los `<path>` del SVG: desde el primer resalte,
 * «el tercer nodo» y «la tercera finca» dejan de ser lo mismo.
 *
 * @param {number} indice
 * @returns {string}
 */
export const selectorCandidata = (indice) => `[data-candidata="${indice}"]`

/**
 * Gris de contexto, el MISMO que `viewer/colindantes.js`: las candidatas son
 * exactamente eso —parcelas ajenas hasta que una deje de serlo— y darles un color
 * propio inventaría una categoría que no existe.
 */
const COLOR_CANDIDATA = '#CBD5E1'

/**
 * Y el resalte va en el azul de la interfaz, NO en el amarillo `COLOR_USUARIO`.
 * Ese amarillo significa «esto es tuyo» desde F03, y una candidata señalada no es
 * tuya todavía: es la que estás mirando. Pintarla de amarillo diría que ya ha
 * entrado, que es justo lo que el usuario está a punto de decidir.
 */
const COLOR_RESALTE = '#2563EB'

const GROSOR_CANDIDATA = 1.5
const GROSOR_RESALTE = 3

/**
 * Relleno de la resaltada. Las candidatas sin resaltar van con relleno de opacidad
 * CERO —el mismo recurso que `colindantes.js`—: no pintan un píxel y aun así todo
 * su interior responde al puntero, que es lo que hace que se puedan señalar
 * pinchando dentro y no solo sobre un trazo de 1,5 px.
 */
const RELLENO_RESALTE = 0.18

const describir = (v) => (v === null ? 'null' : Array.isArray(v) ? `un array` : typeof v)

/** ¿Es un par [x, y] de números finitos? */
const esParUTM = (v) =>
  Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])

/**
 * El texto del emergente de una candidata.
 *
 * ⚠️ **Sin nombre NO se inventa uno**, y menos «Parcela»: el fichero puede no
 * traer rótulos, y llamar «Parcela 3» a un recinto del que no sabemos el nombre
 * es afirmar algo que nadie ha dicho. Se enseña su sitio en la lista y su tamaño,
 * que es lo que sí se ha medido.
 *
 * @param {string|null} nombre
 * @param {number} orden  Posición en la lista, **empezando en 1** (lo que el
 *   usuario ve), no el índice interno.
 * @param {number} superficie  m².
 * @returns {string}
 */
export function textoEmergente(nombre, orden, superficie) {
  const medida = `${superficie.toLocaleString('es-ES', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} m²`
  return nombre === null || nombre === undefined || nombre === ''
    ? `Recinto ${orden} · ${medida}`
    : `${nombre} · ${medida}`
}

/**
 * @typedef {Object} Candidata
 * @property {Array<[number,number]>} vertices  Anillo ABIERTO en UTM.
 * @property {string|null} [nombre]  Lo que el fichero la llama, si la llama.
 * @property {number} [superficie]  m², ya medidos por `parsers/importar.js`. Se
 *   recibe en vez de recalcularse aquí: dos medidas del mismo anillo es como se
 *   acaba enseñando en el mapa un número distinto del que dice el cajón.
 */

/**
 * Crea la capa de candidatas.
 *
 * @param {object} opciones
 * @param {object} opciones.mapa  `L.Map` con el pane {@link PANE.COLINDANTES}.
 * @param {number} opciones.zona  Huso UTM (29/30/31).
 * @param {Function} [opciones.alAvisar]
 * @returns {{pintar: Function, resaltar: Function, encuadrar: Function, limpiar: Function,
 *   destruir: Function, alSenalar: Function}}
 * @throws {TypeError|RangeError}  Contratos del programador.
 */
export function crearCapaCandidatas({ mapa, zona, alAvisar } = {}) {
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.getPane !== 'function'
  ) {
    throw new TypeError(
      `crearCapaCandidatas: 'mapa' debe ser un L.Map (con addLayer/removeLayer/getPane); ` +
        `recibido ${describir(mapa)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearCapaCandidatas: 'zona' inválida: ${JSON.stringify(zona)}. ` +
        `Válidas: ${HUSOS_VALIDOS.join(', ')}.`,
    )
  }
  if (!mapa.getPane(PANE.COLINDANTES)) {
    throw new TypeError(
      `crearCapaCandidatas: falta el pane '${PANE.COLINDANTES}'. Créalo con los nombres de ` +
        `viewer/_comun.js#PANES antes de pintar las candidatas.`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  let vivo = true
  /** Polígonos puestos por el último `pintar`, en el MISMO orden que las candidatas. */
  let capas = []
  /** Índice resaltado, o `null`. */
  let resaltado = null
  /** Suscriptores de «el usuario ha señalado la candidata i» (clic en el mapa). */
  const oyentes = new Set()

  /**
   * Reparte el margen del encuadre para dejar libre el trozo que ocupa `estorbo`.
   *
   * Devuelve `[paddingTopLeft, paddingBottomRight]` de Leaflet. Un estorbo pegado
   * a la esquina inferior izquierda —que es donde viven los cajones de esta
   * aplicación— se convierte en margen por la IZQUIERDA y por ABAJO, o sea que
   * empuja la geometría al hueco de arriba a la derecha.
   *
   * ⚠️ **Con tope, y el tope es la mitad del hallazgo.** Un cajón de 420 px sobre
   * un mapa de 678 se comería el 62 % del ancho: sin tope, el encuadre saldría
   * tan apretado que las fincas volverían a no verse — el defecto de partida con
   * otra causa. Se cede como mucho el 45 % de cada eje y se acepta que un cajón
   * enorme tape algo: es preferible a un mapa reducido a una rendija.
   *
   * @param {DOMRect|null} estorbo  En coordenadas de VENTANA, como el contenedor.
   * @param {[number, number]} base  El margen normal, que se suma en los cuatro lados.
   * @returns {[[number, number], [number, number]]}
   */
  function margenesEvitando(estorbo, base) {
    const arriba = [base[0], base[1]]
    const abajo = [base[0], base[1]]
    if (!estorbo || typeof mapa.getContainer !== 'function') return [arriba, abajo]

    const m = mapa.getContainer().getBoundingClientRect()
    if (m.width <= 0 || m.height <= 0) return [arriba, abajo]
    // Sin solape no hay nada que esquivar: un cajón fuera del mapa (o cerrado) no
    // estorba, y añadirle margen movería el encuadre sin motivo.
    const solapa =
      estorbo.left < m.right && m.left < estorbo.right && estorbo.top < m.bottom && m.top < estorbo.bottom
    if (!solapa) return [arriba, abajo]

    const tope = (v, total) => Math.max(0, Math.min(Math.round(v), Math.round(total * 0.45)))

    // En cada eje, el estorbo se apoya en el lado del que tiene menos holgura.
    if (estorbo.left - m.left <= m.right - estorbo.right) {
      arriba[0] += tope(estorbo.right - m.left, m.width)
    } else {
      abajo[0] += tope(m.right - estorbo.left, m.width)
    }
    if (estorbo.top - m.top <= m.bottom - estorbo.bottom) {
      arriba[1] += tope(estorbo.bottom - m.top, m.height)
    } else {
      abajo[1] += tope(m.bottom - estorbo.top, m.height)
    }
    return [arriba, abajo]
  }

  /** Los estilos de una candidata según esté resaltada o no. Un solo sitio. */
  const estiloDe = (esta) => ({
    color: esta ? COLOR_RESALTE : COLOR_CANDIDATA,
    weight: esta ? GROSOR_RESALTE : GROSOR_CANDIDATA,
    fillColor: esta ? COLOR_RESALTE : COLOR_CANDIDATA,
    fillOpacity: esta ? RELLENO_RESALTE : 0,
  })

  function limpiar() {
    for (const capa of capas) {
      try {
        mapa.removeLayer(capa)
      } catch {
        // Idempotente, como en todo el visor: una capa que ya no está no es un
        // error que deba tumbar el resto del desmontaje.
      }
    }
    capas = []
    resaltado = null
  }

  /**
   * Pinta las candidatas. Idempotente: limpia lo anterior en cada llamada.
   *
   * @param {Candidata[]|null} candidatas  `null`/`undefined` ⇒ solo limpia.
   * @returns {void}
   * @throws {TypeError} Si no es un array ni `null`.
   */
  function pintar(candidatas) {
    if (!vivo) return
    limpiar()
    if (candidatas === null || candidatas === undefined) return
    if (!Array.isArray(candidatas)) {
      throw new TypeError(
        `pintar: 'candidatas' debe ser un array [{vertices, nombre, superficie}] o null ` +
          `para limpiar; recibido ${describir(candidatas)}.`,
      )
    }

    let saltadas = 0
    candidatas.forEach((cand, i) => {
      const vertices = cand && Array.isArray(cand.vertices) ? cand.vertices.filter(esParUTM) : []
      if (vertices.length < 3) {
        saltadas++
        // Se empuja `null` para que `capas[i]` siga casando con `candidatas[i]`:
        // sin esto, resaltar la 5.ª resaltaría otra en cuanto una se saltara, y el
        // fallo sería silencioso y de los que se descubren señalando mal una finca.
        capas.push(null)
        return
      }
      const poligono = L.polygon(
        [vertices.map((v) => vertUTMaLatLng(v, zona))],
        {
          pane: PANE.COLINDANTES,
          className: CLASE_CANDIDATA,
          // Interactiva: señalar en el mapa es la mitad de esta capa. Ver el
          // relleno de opacidad 0, que es lo que hace que responda por dentro.
          interactive: true,
          fill: true,
          opacity: 0.9,
          ...estiloDe(false),
        },
      )
      poligono.bindTooltip(
        textoEmergente(cand?.nombre ?? null, i + 1, Number(cand?.superficie) || 0),
        { className: CLASE_EMERGENTE, sticky: true, direction: 'top' },
      )
      poligono.on('click', () => {
        for (const fn of oyentes) {
          try {
            fn(i)
          } catch (causa) {
            avisar('Un suscriptor de la elección de candidata ha fallado.', causa)
          }
        }
      })
      poligono.addTo(mapa)
      // ⚠️ El índice va en el NODO, y no es decoración. `resaltar` usa
      // `bringToFront`, que **reordena el DOM**, así que a partir del primer
      // resalte el orden de los `<path>` ya no es el de la lista. Sin este
      // atributo, cualquiera —un test, el guion de humo, el cableado— que busque
      // «la tercera finca» por posición encontrará otra, y el fallo es de los que
      // se descubren señalando mal una parcela.
      const nodo = typeof poligono.getElement === 'function' ? poligono.getElement() : null
      if (nodo) nodo.dataset.candidata = String(i)
      capas.push(poligono)
    })

    if (saltadas > 0) {
      // Regla de oro 1: dibujar menos fincas de las que el cajón enumera es
      // exactamente el tipo de desajuste que nadie nota hasta que elige mal.
      avisar(
        `${saltadas} de ${candidatas.length} recinto(s) no se han podido dibujar por no tener ` +
          `tres vértices válidos. Siguen en la lista, pero no se pueden señalar en el mapa.`,
      )
    }
  }

  /**
   * Resalta UNA candidata y devuelve las demás a su estilo de contexto.
   *
   * @param {number|null} indice  `null` ⇒ ninguna resaltada.
   * @returns {void}
   */
  function resaltar(indice) {
    if (!vivo) return
    const destino = Number.isInteger(indice) ? indice : null
    resaltado = destino
    capas.forEach((capa, i) => {
      if (capa === null) return
      const esta = i === destino
      capa.setStyle(estiloDe(esta))
      // La clase, ADEMÁS del estilo en línea. El estilo es lo que se ve sin hoja
      // ninguna —jsdom, `npm run dev` antes de que llegue el CSS— y la clase es el
      // gancho por el que la hoja y quien mire desde fuera pueden encontrar la
      // resaltada sin adivinar un color. Ver {@link CLASE_RESALTADA}.
      const nodo = typeof capa.getElement === 'function' ? capa.getElement() : null
      if (nodo) nodo.classList.toggle(CLASE_RESALTADA, esta)
      // Al frente para que su trazo no quede por debajo del de una vecina con la
      // que comparte lindero: en una manzana TODAS lo comparten, así que sin esto
      // el resalte se ve a medias justo en el borde que hay que comparar.
      if (esta && typeof capa.bringToFront === 'function') capa.bringToFront()
    })
  }

  /**
   * Lleva el mapa a donde están las candidatas.
   *
   * ⛔ **Existe porque el guion de humo midió que las ocho fincas salían a 0 × 0
   * px.** La aplicación arranca vacía y con el mapa mirando a España entera; las
   * candidatas se pintan **sin que nada mueva el encuadre** —no pasan por el
   * store, que es quien reencuadra— así que una manzana de cien metros ocupaba
   * menos de un píxel. El cajón decía «marca la tuya, se resalta en el mapa» y en
   * el mapa no había nada que mirar.
   *
   * ⚠️ **Y la suite no podía verlo**: en jsdom `getBoundingClientRect()` devuelve
   * ceros, así que «se ve» y «no se ve» son indistinguibles. Es la razón de que
   * este método NO se llame desde `pintar`: mover el mapa es una decisión del
   * recorrido —quién pregunta y cuándo—, y esconderla dentro del pintado la haría
   * inevitable también para quien solo quiera dibujar sin secuestrar la vista.
   *
   * ⛔ **Y con `evitar`, porque encuadrarlas no basta: el guion midió que el cajón
   * tapaba CINCO de las ocho al 100 %.** Meterlas todas en el mapa y ponerles
   * encima el panel que hace la pregunta es pedir que se elija a ciegas. Quien
   * pasa el `evitar` es el recorrido, y el rectángulo lo da el propio cajón, que
   * es el único que sabe cuánto ocupa y en qué esquina.
   *
   * @param {{padding?: [number, number], maxZoom?: number, evitar?: DOMRect|null}} [opciones]
   * @returns {boolean}  `false` si no hay nada dibujado que encuadrar.
   */
  function encuadrar({ padding = [24, 24], maxZoom = 19, evitar = null } = {}) {
    if (!vivo) return false
    const dibujadas = capas.filter((c) => c !== null)
    if (dibujadas.length === 0) return false

    let limites = null
    for (const capa of dibujadas) {
      if (typeof capa.getBounds !== 'function') continue
      const suyos = capa.getBounds()
      if (!suyos || typeof suyos.isValid !== 'function' || !suyos.isValid()) continue
      limites = limites === null ? suyos : limites.extend(suyos)
    }
    if (limites === null) return false

    const [arriba, abajo] = margenesEvitando(evitar, padding)

    try {
      mapa.fitBounds(limites, { paddingTopLeft: arriba, paddingBottomRight: abajo, maxZoom })
      return true
    } catch (causa) {
      // Un `fitBounds` que falla no puede tumbar la pregunta: las fincas siguen
      // dibujadas y el cajón sigue enumerándolas, solo que hay que buscarlas.
      avisar('No se ha podido encuadrar el mapa sobre las fincas del dibujo.', causa)
      return false
    }
  }

  /**
   * Se suscribe al clic sobre una candidata del mapa. Devuelve la baja.
   *
   * @param {(indice: number) => void} fn
   * @returns {() => void}
   */
  function alSenalar(fn) {
    if (typeof fn !== 'function') {
      throw new TypeError(`alSenalar: se esperaba una función; recibido ${typeof fn}.`)
    }
    oyentes.add(fn)
    return () => oyentes.delete(fn)
  }

  return {
    pintar,
    resaltar,
    encuadrar,
    limpiar,
    alSenalar,
    /** Cuál está resaltada ahora mismo. Para los tests y para el cableado. */
    resaltada: () => resaltado,
    destruir() {
      if (!vivo) return
      limpiar()
      oyentes.clear()
      vivo = false
    },
  }
}

export default crearCapaCandidatas

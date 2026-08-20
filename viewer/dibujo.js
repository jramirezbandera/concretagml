// viewer/dibujo.js — F12 · T3.3. LOS GESTOS DE DIBUJAR UN RECINTO SOBRE EL MAPA.
//
// La otra mitad de `edit/dibujo.js`. Allí está la máquina de estados pura —qué es
// un trazo, cuándo se puede cerrar, qué se ignora—; aquí están el ratón, el
// teclado y lo que se ve mientras tanto. La frontera es la de siempre en este
// proyecto: `edit/` sabe geometría, `viewer/` sabe gestos.
//
//   const dibujo = crearDibujo({ mapa, zona, ajustar: edicion.ajustar, alCerrar })
//   dibujo.alCambiar((dibujando) => barra.dibujoEnCurso(dibujando))
//   dibujo.empezar()          // la barra pulsa «Dibujar recinto»
//   …clics del usuario…
//   // al cerrar, `alCerrar(recinto)` recibe el `{tipo:'EXTERIOR', vertices}`
//
// ═════════════════════════════════════════════════════════════════════════════
// LOS GESTOS, Y POR QUÉ ESTOS
// ═════════════════════════════════════════════════════════════════════════════
//   · **Clic** en el mapa → pone un vértice. El punto pasa antes por `ajustar`,
//     que es **el mismo gancho que usa el arrastre de F06**: el dibujo no tiene
//     su propia idea de dónde está el parcelario (ver `edit/dibujo.js`). Desde el
//     2026-08-19 le pasa además los vértices YA PUESTOS como dianas, que el
//     catálogo no puede conocer porque el recinto no está aún en el modelo.
//   · **Clic sobre el PRIMER vértice** → cierra (2026-08-19). Es el gesto de
//     cualquier CAD, y hasta esa fecha no existía: pinchar ahí añadía un vértice
//     duplicado —`anadirPunto` compara contra el ANTERIOR, no contra el primero—
//     y el recinto solo se podía cerrar con doble clic. La diana se mide en
//     PÍXELES (`UMBRAL_PUNTERIA_PX`), porque cerrar es un gesto y los gestos se
//     miden en pantalla; ver {@link crearDibujo} → `cierraSobreElPrimero`.
//   · **Doble clic** → cierra. Es el gesto que espera cualquiera que haya dibujado
//     en un CAD o en un mapa, y por eso hay que apagarle al mapa el zoom por doble
//     clic mientras dura: si no, cerrar el recinto ampliaría además.
//     ⭐ Leaflet dispara los DOS `click` del doble antes que el `dblclick`, y aquí
//     no hay que descontar nada: los dos caen en el mismo punto y el segundo ya lo
//     ignora `edit/dibujo.js` con `PUNTO_REPETIDO`. Descontarlo a mano quitaba un
//     vértice bueno — lo cazó una prueba, ver {@link crearDibujo} → `cerrarAhora`.
//   · **Pasar el puntero** (sin pinchar) → **previsualiza el enganche**
//     (2026-08-19): se le pregunta a `ajustar` lo mismo que se le preguntará al
//     pinchar, y su indicador OSNAP aparece bajo el cursor cuando hay una diana a
//     tiro —un punto del levantamiento importado, un vértice del parcelario, un
//     lindero—. Antes el indicador solo salía EN el clic, así que el enganche se
//     descubría cuando ya estaba puesto. Ver {@link crearDibujo} → `alMoverPuntero`.
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
  UMBRAL_PUNTERIA_PX,
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
 * Clase del PRIMER vértice cuando pinchándolo se cierra. Contrato con los tests.
 * No lleva estilo en `estilos/app.css` —esa hoja está a 0 B de holgura— : lo que
 * se ve lo escriben las opciones de Leaflet. La clase existe para poder afirmarlo.
 */
export const CLASE_PUNTO_CIERRE = 'gml-trazo-cierre'

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

/**
 * Radio del PRIMER vértice cuando ya se puede cerrar. Más grande que los demás
 * para que se vea que es una diana, y no más grande que {@link UMBRAL_PUNTERIA_PX}
 * para que lo que se ve **sea** lo que se puede pinchar: un adorno mayor que su
 * zona activa promete un clic que no cierra.
 */
const RADIO_CIERRE_PX = 6

/**
 * Y el mismo, con el puntero encima. Es la única señal de «este clic cierra» que
 * hay antes de darlo, y va rellena: el aro hueco es «puedes», el relleno es «vas
 * a». Sin este paso el usuario solo se entera de que ha cerrado cuando ya ha
 * cerrado, que es tarde para no hacerlo.
 */
const ESTILO_CIERRE_ARMADO = Object.freeze({ fillOpacity: 1, weight: 3 })

/** Y su reposo: hueco, para no confundirse con un vértice puesto. */
const ESTILO_CIERRE_SUELTO = Object.freeze({ fillOpacity: 0, weight: 2 })

// ── Lo que se le dice al usuario ─────────────────────────────────────────────

/** Al empezar. Dice los tres gestos que hacen falta y ninguno más. */
export const MENSAJE_EMPEZAR =
  'Dibujando el recinto: pincha cada esquina y vuelve a pinchar la primera para cerrarlo. Doble ' +
  'clic o Enter también cierran, Retroceso quita el último punto, Escape cancela.'

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
 * @param {(() => void)|null} [opciones.alSoltarEnganche]  La contrapartida de
 *   `ajustar`: apaga el indicador OSNAP (`visor.edicion.soltarEnganche`). Hace
 *   falta porque desde el 2026-08-19 el indicador se enciende también **al pasar
 *   el puntero**, y un dibujo se termina de cinco maneras —`Escape`, `Enter`,
 *   doble clic, botón, `destruir()`— ninguna de las cuales pasa por un último
 *   `mousemove` que lo apagara. Sin esto el cuadradito se queda pintado sobre un
 *   mapa en el que ya no se dibuja. `null` = no hay nada que apagar.
 * @param {(recinto: object) => void} opciones.alCerrar  Recibe el
 *   `{tipo:'EXTERIOR', vertices}` terminado. Es la ÚNICA salida de este módulo.
 * @param {import('./_comun.js').Avisar} [opciones.alAvisar]
 * @returns {object}
 * @throws {TypeError|RangeError}
 */
export function crearDibujo({
  mapa,
  zona,
  ajustar = null,
  alSoltarEnganche = null,
  alCerrar,
  alAvisar,
} = {}) {
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
  if (alSoltarEnganche !== null && typeof alSoltarEnganche !== 'function') {
    throw new TypeError(
      `crearDibujo: 'alSoltarEnganche' debe ser una función o null; recibido ` +
        `${describir(alSoltarEnganche)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  /**
   * Apaga el indicador de enganche, si hay quien lo apague. Se aísla el fallo por
   * lo mismo que en {@link anunciarCambio}: esto corre dentro de un `mousemove` y
   * dentro de `parar()`, y una excepción de la capa de adorno no puede llevarse por
   * delante el gesto que la estaba usando ni dejar el dibujo a medio parar.
   */
  function soltarEnganche() {
    if (alSoltarEnganche === null) return
    try {
      alSoltarEnganche()
    } catch (causa) {
      console.error('[dibujo] alSoltarEnganche ha lanzado:', causa)
    }
  }

  let vivo = true
  let dibujando = false
  /** Oyentes de {@link alCambiar}. `Set`, no callback único: ver su JSDoc. */
  const oyentesCambio = new Set()
  let trazo = iniciar()
  let linea = null
  const puntos = []
  /**
   * El marcador del PRIMER vértice cuando ya se puede cerrar, o `null`. Se guarda
   * aparte de `puntos` porque es el único al que se le cambia el aspecto sobre la
   * marcha (al pasarle el puntero por encima) y buscarlo por índice en cada
   * `mousemove` obligaría a repetir aquí la regla de cuándo existe.
   */
  let marcadorCierre = null
  /** Si el puntero está AHORA dentro del radio de cierre. Evita repintar por nada. */
  let cierreArmado = false
  const doc = typeof document === 'undefined' ? null : document

  /**
   * Anuncia que `dibujando` ha cambiado. Se llama SIEMPRE que cambia y solo
   * cuando cambia: `empezar` sobre un dibujo ya empezado no emite nada, igual que
   * no reinicia el trazo.
   *
   * Un oyente que lanza no puede llevarse por delante ni a los demás ni al gesto
   * que iba en marcha —esto corre en mitad de un `keydown`—, así que se aísla y se
   * cuenta por consola. Es el mismo trato que `viewer/edicion.js` da a los suyos.
   */
  function anunciarCambio() {
    for (const fn of oyentesCambio) {
      try {
        fn(dibujando)
      } catch (causa) {
        console.error('[dibujo] un oyente de alCambiar ha lanzado:', causa)
      }
    }
  }

  // ── Pintado ───────────────────────────────────────────────────────────────

  function limpiarPintura() {
    if (linea !== null) {
      mapa.removeLayer(linea)
      linea = null
    }
    for (const p of puntos) mapa.removeLayer(p)
    puntos.length = 0
    marcadorCierre = null
    cierreArmado = false
  }

  function repintar() {
    limpiarPintura()
    if (trazo.puntos.length === 0) return
    const latlngs = trazo.puntos.map((p) => vertUTMaLatLng(p, zona))
    if (latlngs.length >= 2) {
      linea = L.polyline(latlngs, { ...ESTILO_TRAZO, pane: PANE.VERTICES })
      linea.addTo(mapa)
    }
    // ⭐ El PRIMER vértice se agranda **solo cuando ya se puede cerrar**. Antes de
    // tres vértices pinchándolo no pasa nada, y anunciar una diana que no lo es
    // sería un mando que miente — la misma regla que gobierna los botones de esta
    // aplicación, aplicada a un grafismo.
    const puedeCerrar = sePuedeCerrar(trazo)
    latlngs.forEach((ll, i) => {
      const esCierre = i === 0 && puedeCerrar
      const punto = L.circleMarker(ll, {
        ...ESTILO_PUNTO,
        ...(esCierre ? ESTILO_CIERRE_SUELTO : {}),
        radius: esCierre ? RADIO_CIERRE_PX : RADIO_PUNTO_PX,
        pane: PANE.VERTICES,
        className: esCierre ? CLASE_PUNTO_CIERRE : CLASE_PUNTO_TRAZO,
      })
      punto.addTo(mapa)
      puntos.push(punto)
      if (esCierre) marcadorCierre = punto
    })
    if (linea !== null && typeof linea.getElement === 'function') {
      const el = linea.getElement()
      if (el && el.classList) el.classList.add(CLASE_TRAZO)
    }
  }

  // ── El punto que entra ────────────────────────────────────────────────────

  /**
   * Pregunta al enganche por el punto de un evento del ratón.
   *
   * ⚠️ **Tiene EFECTO VISIBLE, y es el que interesa**: `viewer/edicion.js#ajustar`
   * enciende o apaga el indicador OSNAP —el cuadradito sobre el vértice, la cruz
   * sobre el lindero— según lo que capture. Por eso lo llaman los DOS gestos, el
   * clic y el simple paso del puntero: la marca que se ve antes de pinchar y la
   * coordenada que entra al pinchar salen de la MISMA pregunta, así que no pueden
   * decir cosas distintas.
   *
   * Se le pasa `excluir: null` porque aquí no se está moviendo ningún vértice
   * existente: no hay nada que excluir del catálogo de dianas.
   *
   * @param {object} evento  Un `click` o un `mousemove` de Leaflet, con su `latlng`.
   * @returns {{crudo: [number,number], enganche: object|null}}
   */
  function engancheDe(evento) {
    const crudo = latLngAUTM(evento.latlng, zona)
    if (ajustar === null) return { crudo, enganche: null }
    // ⭐ **Y los vértices YA PUESTOS entran como dianas (2026-08-19).** El catálogo
    // del enganche se construye sobre el MODELO, y el recinto que se está dibujando
    // todavía no está en él: sin esto no había forma de clavar un vértice justo
    // encima de otro que uno mismo acababa de poner, que es lo que hace falta para
    // volver sobre el trazo o rematar contra una esquina propia.
    //
    // ⚠️ Se pasan al gancho en vez de engancharse aquí, para que la tolerancia siga
    // siendo UNA y la tecla `Alt` la siga apagando igual. Ver `viewer/edicion.js#ajustar`.
    const enganche = ajustar(crudo, null, evento?.originalEvent ?? null, {
      dianasExtra: trazo.puntos,
    })
    return { crudo, enganche: enganche ?? null }
  }

  /** El punto del evento, en UTM y **ya enganchado** si hay snap. */
  function puntoDe(evento) {
    const { crudo, enganche } = engancheDe(evento)
    return enganche && Array.isArray(enganche.punto) ? enganche.punto : crudo
  }

  /**
   * ⭐ **¿Este clic cae sobre el primer vértice, o sea CIERRA? (2026-08-19)**
   *
   * ── EL DEFECTO QUE ESTO CIERRA ────────────────────────────────────────────
   * Hasta hoy el recinto **solo** se cerraba con doble clic o `Enter`, y pinchar
   * el primer vértice no cerraba: **añadía un vértice duplicado encima**.
   * `edit/dibujo.js#anadirPunto` compara el punto nuevo contra el ANTERIOR, no
   * contra el primero, así que el trazo se quedaba con dos vértices en el mismo
   * sitio y el usuario, buscando por qué no cerraba, seguía pinchando.
   *
   * ── POR QUÉ EN PÍXELES, Y POR QUÉ AQUÍ ────────────────────────────────────
   * Cerrar es un GESTO, y los gestos se miden en pantalla: con la tolerancia del
   * enganche (τ = 0,2 m) acertar el primer vértice a escala de finca pide dos
   * píxeles de puntería. Subir τ no era la respuesta —eso mueve dónde caen los
   * VÉRTICES, que es precisión del dato— sino usar {@link UMBRAL_PUNTERIA_PX}, la
   * tolerancia que este proyecto ya tenía escrita para exactamente esto.
   *
   * Y por eso vive en `viewer/` y no en `edit/dibujo.js`: ese módulo declara que no
   * quiere un segundo criterio de proximidad —«quien decide qué está lo bastante
   * cerca es `edit/snap.js`»— y tiene razón, **en geometría**. Un radio de pantalla
   * no es geometría: no existe sin un mapa con un zoom. La frontera de la casa
   * —`edit/` sabe geometría, `viewer/` sabe gestos— cae justo aquí.
   *
   * ⚠️ **Con menos de tres vértices devuelve `false`**, y lo decide
   * `sePuedeCerrar`: así el segundo clic sobre el primer punto no suelta un error
   * («hacen falta al menos tres»), simplemente pone su vértice. Que el primer
   * vértice no se agrande hasta entonces es la otra mitad de lo mismo.
   *
   * @param {object} evento  El `click` de Leaflet, con su `latlng`.
   * @returns {boolean}
   */
  function cierraSobreElPrimero(evento) {
    if (!sePuedeCerrar(trazo)) return false
    if (typeof mapa.latLngToContainerPoint !== 'function') return false
    const primero = vertUTMaLatLng(trazo.puntos[0], zona)
    const a = mapa.latLngToContainerPoint(evento.latlng)
    const b = mapa.latLngToContainerPoint(primero)
    return Math.hypot(a.x - b.x, a.y - b.y) <= UMBRAL_PUNTERIA_PX
  }

  /**
   * Enseña —o deja de enseñar— que el clic que viene cerraría el recinto.
   *
   * Es la única señal que hay ANTES de dar el clic. Sin ella, el usuario se entera
   * de que ha cerrado cuando ya ha cerrado, y para deshacerlo tiene que usar
   * `Ctrl+Z` sobre una operación que no pretendía.
   *
   * ⚠️ **Todo por opciones de Leaflet y ni un byte de CSS**: `estilos/app.css` está
   * en su techo de presupuesto con 0 B de holgura (`scripts/presupuesto-css.mjs`),
   * y este estado lo escribe JS en cada gesto — no hay ningún selector que pudiera
   * expresarlo sin que la hoja observara una clase.
   */
  function alMoverPuntero(evento) {
    if (!vivo || !dibujando || !evento || !evento.latlng) return
    const armado = cierraSobreElPrimero(evento)
    // ⭐ **LA PREVISUALIZACIÓN DEL ENGANCHE (2026-08-19).** Hasta hoy el indicador
    // OSNAP solo aparecía en el instante del CLIC —`ajustar` se llamaba una vez, en
    // `puntoDe`—, así que al pasar el puntero sobre un punto del levantamiento
    // importado no se veía nada: el usuario descubría si había enganchado DESPUÉS
    // de poner el vértice, mirando si había saltado. Un enganche que solo se ve
    // cuando ya es irreversible obliga a deshacer para preguntar.
    //
    // Preguntando aquí lo mismo que se preguntará al pinchar, el cuadradito
    // aparece bajo el puntero mientras se pasa por encima, y **promete exactamente
    // lo que el clic va a hacer**: misma τ, misma tecla `Alt`, mismas dianas. Si a
    // este zoom la tolerancia no llega, no se pinta nada — que también es la
    // verdad, y es lo que evita un adorno que anuncia un enganche que no ocurriría.
    //
    // ⚠️ Sobre el PRIMER vértice armado no se previsualiza: ahí el clic no pone un
    // vértice, CIERRA, y el aro relleno ya lo está diciendo. Dos marcas encima del
    // mismo punto contando dos cosas distintas es peor que una sola.
    if (armado) soltarEnganche()
    else engancheDe(evento)
    if (marcadorCierre === null || armado === cierreArmado) return
    cierreArmado = armado
    marcadorCierre.setStyle(armado ? ESTILO_CIERRE_ARMADO : ESTILO_CIERRE_SUELTO)
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
    // ⭐ Primero se pregunta si CIERRA. Al revés, el clic sobre el primer vértice
    // añadiría su duplicado antes de que nadie mirase, que es el defecto de partida.
    if (cierraSobreElPrimero(evento)) {
      cerrarAhora()
      return
    }
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

  /** Deja de dibujar: quita los oyentes, la pintura, el indicador y el zoom. */
  function parar() {
    if (!dibujando) return
    dibujando = false
    trazo = cancelar()
    limpiarPintura()
    // El indicador NO es pintura de este módulo —lo pone `viewer/edicion.js`—, así
    // que `limpiarPintura` no lo alcanza y hay que pedirlo aparte. Va aquí y no en
    // cada salida porque las cinco pasan por `parar`.
    soltarEnganche()
    mapa.off('click', alClic)
    mapa.off('dblclick', alDobleClic)
    mapa.off('mousemove', alMoverPuntero)
    if (doc) doc.removeEventListener('keydown', alTeclear)
    soltarZoomDobleClicApagado(mapa)
    anunciarCambio()
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
      // El único oyente que no gobierna una acción: solo enseña que el clic que
      // viene cerraría. Se da de baja en `parar`, simétrico con los otros dos.
      mapa.on('mousemove', alMoverPuntero)
      if (doc) doc.addEventListener('keydown', alTeclear)
      // El doble clic CIERRA, así que mientras dura no puede ampliar además.
      pedirZoomDobleClicApagado(mapa)
      avisar(MENSAJE_EMPEZAR, { nivel: NIVEL.INFO })
      anunciarCambio()
      return true
    },

    /** Cancela el trazo en curso. Idempotente: cancelar sin dibujar no hace nada. */
    cancelar: cancelarAhora,

    /** Cierra por botón (equivale a `Enter`). `false` si todavía no se podía. */
    cerrar: () => cerrarAhora(),

    /**
     * Se suscribe al ENCENDIDO y APAGADO del dibujo. Devuelve la función de BAJA.
     *
     * ⛔ **Por qué hace falta, y qué arreglaba el día que se escribió
     * (2026-08-18).** De las cinco formas de terminar un dibujo, solo UNA avisaba
     * a quien lo mandó empezar: cerrar bien, por `alCerrar`. `Escape`, `Enter` con
     * menos de tres vértices, el doble clic y `destruir()` paraban el trazo en
     * silencio, así que el botón de la barra se quedaba en «Cancelar dibujo» y con
     * `aria-pressed="true"` **sobre un dibujo que ya no existía** — un mando que
     * miente sobre lo que va a pasar, medido en la rama EDIFICIO.
     *
     * Y en la rama PARCELA no era cosmético: allí el cableado APAGA la edición
     * mientras se dibuja (si no, el mismo clic pondría un vértice y además
     * seleccionaría un lindero), y sin este canal un `Escape` habría dejado la
     * edición apagada para siempre y en silencio.
     *
     * Es un `Set` y no un callback único por la razón de siempre en esta casa: la
     * barra quiere saberlo y el cableado también, y el segundo en llegar no puede
     * desalojar al primero.
     *
     * @param {(dibujando: boolean) => void} fn
     * @returns {() => void}  La baja.
     * @throws {TypeError}
     */
    alCambiar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alCambiar: 'fn' debe ser una función; recibido ${describir(fn)}.`)
      }
      oyentesCambio.add(fn)
      return () => oyentesCambio.delete(fn)
    },

    /** ¿Se está dibujando ahora mismo? */
    dibujando: () => dibujando,

    /** ¿Se puede cerrar ya? La barra lo usa para encender su botón. */
    sePuedeCerrar: () => dibujando && sePuedeCerrar(trazo),

    /** Cuántos vértices lleva puestos. Para el renglón de estado. */
    nVertices: () => trazo.puntos.length,

    destruir() {
      if (!vivo) return
      // `parar()` primero: emite el último `false` y así quien escuche deja la
      // barra y la edición como estaban. Los oyentes se sueltan DESPUÉS, o ese
      // último anuncio no llegaría a nadie.
      parar()
      oyentesCambio.clear()
      vivo = false
    },
  }
}

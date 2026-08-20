// viewer/senal-miembro.js — «¿CUÁL DE TODAS ES ÉSTA?» (2026-08-20).
//
// ── EL DEFECTO QUE CIERRA, EN PALABRAS DEL AUTOR ────────────────────────────
// «Me gustaría que en ese menú de expediente hubiera alguna forma de seleccionar
// la geometría y me la marcara en el mapa para saber cuál es cada una, porque no
// sé cuál es cuál.»
//
// La zona «Para comprobar» del panel del sobrante lista las parcelas que forman
// el expediente —la medición propia, las fincas nuevas y los colindantes
// recortados— con su referencia catastral y su superficie. Y ahí se acababa: cuatro
// filas que dicen `29053A00100012`, `29053A00109007` y `29053A00109007.1`
// —**once caracteres iguales de doce**— junto a un mapa donde hay cuatro manchas
// y ninguna lleva el nombre de ninguna fila. El usuario tiene delante todo lo que
// va a firmar y no puede emparejar una cosa con la otra.
//
// ⛔ **Y no es un problema de rótulos que faltan, es de ESCALA.** El caso medido
// que lo estrena tiene una parcela propia de 108.023 m² y un colindante de
// 2.437.967 m²: veintitrés veces mayor, con el grueso de su superficie fuera del
// encuadre. Numerar las manchas —lo que ya hace `viewer/piezas.js` con las piezas
// del sobrante— no habría bastado, porque el número de esa parcela cae donde
// nadie está mirando. Hace falta poder DECIR «llévame a ésta».
//
// ── QUÉ ES, Y QUÉ NO ES ─────────────────────────────────────────────────────
// Es un PUNTERO, no una capa de datos. Dibuja **una geometría cada vez** —la que
// el usuario está señalando en la lista— con un marco de selección, y sabe
// encuadrarla. No mide, no pinta relleno con significado y no se queda con nada:
// el dato es de `derivacion/entrega.js`, que ya lo compuso, y quien decide qué
// señalar es `app/cableado-derivacion.js`.
//
// ── ⛔ EL MARCO NO LLEVA COLOR PROPIO, Y ES LA DECISIÓN DEL MÓDULO ──────────
// Toda capa de este proyecto elige su color por descarte y lo declara con el
// porqué al lado: cian el sobrante, ámbar la invasión, violeta el vecino
// recortado, amarillo la geometría del usuario. Aquí **eso habría estado mal**.
// La regla de oro 9 dice que un color no puede significar «bien» ni «mal»; el
// corolario que este módulo estrena es que **un color tampoco puede significar
// «te estoy apuntando a esto»**, porque entonces el mismo trozo de terreno
// cambiaría de color según dónde tenga el ratón el usuario, y la leyenda —que en
// este proyecto se deriva de lo que hay pintado— tendría que anunciar un quinto
// significado para un tono que aparece y desaparece solo.
//
// Un puntero se dibuja con la GRAMÁTICA de los punteros, que es la misma en todos
// los programas que enseñan un plano: **un marco de trazo discontinuo blanco sobre
// una sombra oscura**. El blanco no está tomado: no lo usa ninguna capa, la
// ortofoto no lo tiene saturado, y la sombra por debajo es lo que lo salva de
// desaparecer sobre una era o un camino de albero. Y como no es un color con
// significado, señalar una parcela **no le quita el suyo**: el ámbar del trozo que
// invade y el violeta del vecino recortado siguen viéndose por debajo del marco.
//
// ── EL RÓTULO DICE LA REFERENCIA, Y NO UN NÚMERO ────────────────────────────
// `viewer/piezas.js` rotula con `1`, `F2`, `V3` porque sus manchas son MUCHAS y
// permanentes: un número corto cabe sobre una astilla y se lee de un vistazo.
// Aquí es al revés —hay UNA sola y solo mientras se apunta—, así que el rótulo
// puede permitirse lo que de verdad resuelve la pregunta: la etiqueta EXACTA que
// dice la fila. Ver `29053A00109007.1` escrito sobre la parcela es la respuesta
// literal a «no sé cuál es cuál».
//
// SOLO-NAVEGADOR: importa Leaflet, así que su test lleva el sufijo `.dom` y JAMÁS
// entra en el barrel raíz `index.js` (rompería la suite `node`: Leaflet exige
// `window`).

import L from 'leaflet'

import { HUSOS_VALIDOS } from '../geo/huso.js'
import { NIVEL, PANE, resolverAvisar, vertUTMaLatLng } from './_comun.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Clase CSS del marco. ESTABLE, como `CLASE_PIEZA` de `viewer/piezas.js` y por lo
 * mismo: `estilos/app.css` puede afinar sobre ella sin que este módulo importe
 * CSS, y lo imprescindible para que se VEA va en las opciones de Leaflet.
 */
export const CLASE_SENAL = 'gml-senal-miembro'

/** Clase CSS de la SOMBRA que va debajo del marco. */
export const CLASE_SENAL_SOMBRA = 'gml-senal-miembro-sombra'

/** Clase CSS del rótulo con la etiqueta de la geometría señalada. */
export const CLASE_SENAL_ROTULO = 'gml-senal-miembro-rotulo'

/**
 * El trazo del marco. Blanco puro: el único tono que este proyecto no ha gastado
 * en significar algo (ver la cabecera), y el que mejor aguanta la ortofoto cuando
 * lleva sombra debajo.
 */
const COLOR_MARCO = '#FFFFFF'

/**
 * Y la sombra sobre la que se dibuja. El mismo `slate-900` con el que las cotas
 * de F06 y los números de F17 respaldan su texto: el problema es idéntico —un
 * grafismo claro sobre una imagen de contraste impredecible— y ya está resuelto.
 */
const COLOR_SOMBRA = '#0F172A'

/** Grosor del marco, en píxeles. */
const GROSOR_MARCO = 3

/**
 * Y el de la sombra. **Tiene que ser mayor que el del marco**, no igual: la sombra
 * existe para asomar por los dos lados del trazo blanco, y con el mismo grosor
 * quedaría exactamente debajo y no se vería nunca.
 */
const GROSOR_SOMBRA = 7

/** Opacidad de la sombra: un velo, no una segunda línea que compita con el marco. */
const OPACIDAD_SOMBRA = 0.55

/**
 * El patrón del trazo discontinuo, en píxeles de pantalla.
 *
 * ⚠️ **Discontinuo y no continuo, a propósito.** Una parcela señalada comparte
 * lindero con las de al lado, y un trazo blanco continuo encima taparía el lindero
 * entero: el usuario dejaría de ver por dónde pasa justo mientras lo está mirando.
 * Con el trazo partido, el lindero de debajo se lee entre guion y guion.
 */
const TRAZO_MARCO = '8 6'

/**
 * Relleno del marco. Casi nada, y **no es un adorno tímido**: una parcela de dos
 * millones y medio de metros cuadrados con relleno visible dejaría media pantalla
 * blanca y taparía las manchas cian y ámbar que el usuario está comparando. Este
 * 0,08 es lo justo para que una parcela pequeña se distinga de un hueco sin que
 * una grande borre el mapa.
 */
const OPACIDAD_RELLENO = 0.08

/**
 * Cuánto margen deja el encuadre alrededor de la geometría, en píxeles.
 *
 * ⚠️ **NO es simétrico, y tiene que no serlo.** El panel que dispara este
 * encuadre —la lista del sobrante— flota en la esquina INFERIOR IZQUIERDA del
 * mapa y ocupa del orden de 420×360 px. Encuadrar con margen igual por los cuatro
 * lados dejaría media parcela debajo del propio panel desde el que se pidió
 * verla, que es el único sitio de la pantalla donde no sirve de nada ponerla.
 *
 * Por eso van los dos vértices por separado y no un `padding` único: Leaflet
 * aplica `padding` igual a los dos lados, y lo que hace falta es engordar el
 * margen IZQUIERDO (`paddingTopLeft[0]`) y el de ABAJO (`paddingBottomRight[1]`),
 * que son los dos que el panel se come.
 */
const MARGEN_ENCUADRE = Object.freeze({
  /** `[izquierda, arriba]`. La izquierda lleva el ancho del panel. */
  arribaIzquierda: [420, 40],
  /** `[derecha, abajo]`. Abajo lleva el alto del panel. */
  abajoDerecha: [40, 360],
})

/**
 * Zoom máximo al encuadrar. Sin tope, encuadrar una astilla de 4 m² dispararía el
 * mapa a zoom 22 y el usuario perdería toda referencia de dónde está: vería un
 * rectángulo blanco sobre una ortofoto ampliada más allá de su resolución. Con
 * tope, el marco puede quedar pequeño en el centro de la pantalla, que es una
 * respuesta legible.
 */
const ZOOM_MAXIMO_ENCUADRE = 20

/**
 * Estilo EN LÍNEA del rótulo. Va en línea y no en la hoja por lo mismo que en
 * `viewer/acotaciones.js` y `viewer/piezas.js`: este módulo no importa CSS, y un
 * rótulo que solo se ve con `estilos/app.css` cargada dejaría el mapa mudo sin
 * ella. `pointer-events:none` para que no le robe el puntero a nada de debajo.
 */
const ESTILO_ROTULO =
  'display:inline-block;transform:translate(-50%,-50%);' +
  'white-space:nowrap;pointer-events:none;' +
  'font:700 12px/1.35 ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums;' +
  `color:${COLOR_MARCO};background:rgba(15,23,42,.86);` +
  `padding:2px 8px;border-radius:999px;border:1px solid rgba(255,255,255,.55);`

// ── Helpers de módulo (puros) ────────────────────────────────────────────────

/** Describe un valor para un mensaje de contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/** ¿Es un par UTM `[x,y]` utilizable (finito en las dos componentes)? */
function esParUTM(v) {
  return Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])
}

/**
 * El tamaño del mapa en píxeles por un eje, o `0` si no se puede saber.
 *
 * Tolerante a propósito: `getSize` existe en todo `L.Map` real, pero este módulo
 * ya acepta dobles en sus contratos y un encuadre no puede reventar porque un
 * arnés de test no implemente un método que solo sirve para AFINAR el margen.
 * Con `0`, el tope no recorta y se piden los márgenes enteros.
 */
function tamano(mapa, eje) {
  if (typeof mapa.getSize !== 'function') return 0
  try {
    const medida = mapa.getSize()
    const valor = medida && medida[eje]
    return Number.isFinite(valor) ? valor : 0
  } catch {
    return 0
  }
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} MiembroSenalable
 * @property {Array<{vertices: Array<[number,number]>}>} recintos  Los recintos del
 *   miembro del expediente, con el EXTERIOR en `[0]` y los huecos detrás
 *   (invariante de `model/parcela.js`). Es el `recintos` que compone
 *   `derivacion/entrega.js`, sin tocar.
 * @property {string} [etiqueta]  Cómo se llama en la fila de la lista. Se pinta
 *   TAL CUAL sobre la geometría: es lo que empareja una cosa con la otra.
 */

/**
 * @typedef {Object} SenalMiembro
 * @property {(miembro: MiembroSenalable|null) => void} senalar  Marca UNA
 *   geometría, o ninguna con `null`. Idempotente: señalar dos veces la misma deja
 *   el mapa igual.
 * @property {() => boolean} encuadrar  Lleva el mapa a lo que hay señalado ahora
 *   mismo. `false` si no hay nada señalado o si no se pudo (sin geometría
 *   dibujable): **no lanza**, porque quien la llama es un clic del usuario y un
 *   `throw` ahí sería un error de programador escrito en la consola por un gesto
 *   legítimo.
 * @property {() => (string|null)} senalada  La etiqueta de lo señalado, o `null`.
 *   Para inspección y para los tests.
 * @property {() => void} limpiar
 * @property {() => void} destruir
 */

/**
 * Crea la señal: el marco que dice QUÉ geometría del expediente es la de esa fila.
 *
 * ```js
 * const senal = crearSenalMiembro({ mapa, zona: 30, alAvisar })
 * senal.senalar({ recintos: miembro.recintos, etiqueta: miembro.etiqueta })
 * senal.encuadrar()   // el usuario ha FIJADO esa fila: llévame allí
 * senal.senalar(null) // ha sacado el ratón de la lista
 * senal.destruir()
 * ```
 *
 * ⚠️ **`zona` es el HUSO (29/30/31), NO el `srs`.** Misma convención que
 * `crearCapaPiezas` y `crearAcotaciones`. Equivocarla no da error: pone el marco a
 * cientos de kilómetros, en silencio.
 *
 * Política de errores (SPEC §2, regla 1):
 *   · Contrato roto por el PROGRAMADOR → `throw`. `mapa` que no es un `L.Map`,
 *     `zona` fuera de 29/30/31, falta el pane, `alAvisar` que no es función,
 *     `miembro` que no es un objeto ni `null`.
 *   · Miembro sin contorno dibujable → **no lanza y no se calla**: se apaga la
 *     señal y se cuenta en un aviso. Es el caso en el que el usuario señala una
 *     fila y no pasa nada en el mapa, y sin decirlo se lee como «esta pantalla no
 *     va».
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado, con el pane
 *   `PANE.SENAL_MIEMBRO` montado (lo crea `crearMapa` iterando `PANES`).
 * @param {number} args.zona  Huso UTM (29, 30 o 31). Ver `geo/huso.js`.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @returns {SenalMiembro}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearSenalMiembro({ mapa, zona, alAvisar } = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ─────────────
  // Se comprueba lo que este módulo USA de verdad, igual que `crearCapaPiezas`.
  // `fitBounds` está en la lista porque `encuadrar` es la mitad de la razón de
  // ser de este módulo, y un doble que solo trajera `addLayer` reventaría en el
  // primer clic del usuario en vez de en el montaje.
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.getPane !== 'function' ||
    typeof mapa.fitBounds !== 'function'
  ) {
    throw new TypeError(
      `crearSenalMiembro: 'mapa' debe ser un L.Map (con addLayer/removeLayer/getPane/` +
        `fitBounds); recibido ${describir(mapa)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearSenalMiembro: 'zona' inválida: ${JSON.stringify(zona)}. ` +
        `Válidas: ${HUSOS_VALIDOS.join(', ')}. Ojo: 'zona' es el HUSO, no el srs — ` +
        `de 'EPSG:25830' se saca con geo/huso.js#husoPorSrs.`,
    )
  }
  if (!mapa.getPane(PANE.SENAL_MIEMBRO)) {
    throw new TypeError(
      `crearSenalMiembro: falta el pane '${PANE.SENAL_MIEMBRO}'. Créalo con los nombres de ` +
        `viewer/_comun.js#PANES antes de señalar nada (va SOBRE todo lo que puede señalar: ` +
        `un puntero por debajo del relleno de aquello a lo que apunta no apunta a nada).`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────
  let vivo = true
  /** Lo puesto en el mapa ahora mismo, o `null`. */
  let puesto = null

  /**
   * Los ANILLOS dibujables de un miembro, en `[lat,lon]`, o `null` si no los hay.
   * El exterior en `[0]` y los huecos detrás, que es lo que `L.polygon` espera
   * para recortarlos — igual que en `viewer/piezas.js` y `viewer/colindantes.js`.
   *
   * Un anillo con menos de 3 vértices finitos no encierra nada y se descarta; si
   * el que se cae es el EXTERIOR, el miembro entero no se puede dibujar.
   *
   * @param {MiembroSenalable} miembro
   * @returns {Array<Array<[number,number]>>|null}
   */
  function anillosLatLng(miembro) {
    const recintos = miembro && Array.isArray(miembro.recintos) ? miembro.recintos : null
    if (recintos === null || recintos.length === 0) return null

    const anillos = []
    for (const recinto of recintos) {
      const vertices = recinto && Array.isArray(recinto.vertices) ? recinto.vertices : []
      const finitos = vertices.filter(esParUTM)
      if (finitos.length < 3) {
        if (anillos.length === 0) return null
        continue
      }
      anillos.push(finitos.map((v) => vertUTMaLatLng(v, zona)))
    }
    return anillos.length === 0 ? null : anillos
  }

  /** Quita del mapa lo que hubiera puesto. */
  function limpiar() {
    if (puesto === null) return
    for (const capa of [puesto.sombra, puesto.marco, puesto.rotulo]) {
      if (capa === null) continue
      try {
        mapa.removeLayer(capa)
      } catch {
        // Una capa que ya no está en el mapa no es un error que deba tumbar el
        // resto del desmontaje: el desmontaje es idempotente en todo el visor.
      }
    }
    puesto = null
  }

  /**
   * Marca UNA geometría. `null` apaga la señal.
   *
   * ⚠️ **Idempotente por ETIQUETA + geometría, no solo por etiqueta.** Se compara
   * la referencia del objeto `miembro`, que es lo que el cableado guarda por
   * clave y no reconstruye entre `mouseenter` y `mouseenter`: así recorrer la
   * lista con el ratón no repinta el mismo polígono treinta veces por segundo.
   *
   * @param {MiembroSenalable|null} miembro
   * @returns {void}
   * @throws {TypeError} Si `miembro` no es un objeto ni `null`.
   */
  function senalar(miembro) {
    // Tras `destruir()` esto es un no-op y no un throw: el desmontaje del visor va
    // en orden inverso. Mismo criterio que `piezas.pintar` y `contraste.pintar`.
    if (!vivo) return

    if (miembro === null || miembro === undefined) {
      limpiar()
      return
    }
    if (typeof miembro !== 'object' || Array.isArray(miembro)) {
      throw new TypeError(
        `senalar: 'miembro' debe ser {recintos, etiqueta} —el miembro que compone ` +
          `derivacion/entrega.js— o null para apagar la señal; recibido ${describir(miembro)}.`,
      )
    }
    if (puesto !== null && puesto.miembro === miembro) return

    limpiar()

    const anillos = anillosLatLng(miembro)
    if (anillos === null) {
      // ⛔ No se calla (regla 1): el usuario ha señalado una fila y el mapa no ha
      // hecho nada. Sin este aviso, el síntoma es «esta pantalla no va».
      avisar(
        `La geometría «${miembro.etiqueta ?? '(sin etiqueta)'}» no trae contorno dibujable: ` +
          `no se puede señalar en el mapa. Sigue en la lista y sigue entrando en el expediente.`,
        { nivel: NIVEL.AVISO },
      )
      return
    }

    const comunes = {
      pane: PANE.SENAL_MIEMBRO,
      // ⛔ NO interactivo, y es una decisión: al marco se llega desde la fila de la
      // lista, nunca desde el mapa. Un polígono interactivo del tamaño de una
      // parcela le robaría el puntero al CLIC DE DEDUCCIÓN de F05 y al arrastre
      // del vértice de debajo, que es justo lo que se está mirando.
      interactive: false,
    }

    // La SOMBRA primero, para que el marco quede encima: dentro de un mismo pane
    // manda el orden de inserción en el SVG.
    const sombra = L.polygon(anillos, {
      ...comunes,
      className: CLASE_SENAL_SOMBRA,
      color: COLOR_SOMBRA,
      weight: GROSOR_SOMBRA,
      opacity: OPACIDAD_SOMBRA,
      fill: false,
    })
    sombra.addTo(mapa)

    const marco = L.polygon(anillos, {
      ...comunes,
      className: CLASE_SENAL,
      color: COLOR_MARCO,
      weight: GROSOR_MARCO,
      opacity: 1,
      dashArray: TRAZO_MARCO,
      fill: true,
      fillColor: COLOR_MARCO,
      fillOpacity: OPACIDAD_RELLENO,
    })
    marco.addTo(mapa)

    // El rótulo, en el centro del ENCUADRE del exterior y no en el centroide del
    // área. Aquí no hay centroide medido que reutilizar —los miembros del
    // expediente no lo traen, al revés que las piezas del sobrante— y calcularlo
    // aquí sería una segunda definición de «dónde está el centro de esto» en un
    // proyecto que ya tiene la suya en `geo/centroide.js`. El centro del encuadre
    // no pretende ser el centroide: pretende ser el sitio donde el rótulo se ve.
    let rotulo = null
    const etiqueta = typeof miembro.etiqueta === 'string' ? miembro.etiqueta.trim() : ''
    if (etiqueta !== '') {
      rotulo = L.marker(marco.getBounds().getCenter(), {
        pane: PANE.SENAL_MIEMBRO,
        icon: L.divIcon({
          className: CLASE_SENAL_ROTULO,
          // `iconSize: null` a propósito, igual que en `viewer/piezas.js`:
          // `L.DivIcon` trae `[12,12]` por defecto y una referencia catastral no
          // tiene ancho fijo. Con `null` la caja queda en 0×0 sobre el punto, que
          // es el ancla que queremos (el `translate(-50%,-50%)` hace el resto).
          iconSize: null,
          html: `<span style="${ESTILO_ROTULO}">${escapar(etiqueta)}</span>`,
        }),
        // Fuera del tabulador y sin puntero: al rótulo se llega por la fila de la
        // lista, que sí es accionable. Un rótulo no accionable en el orden de
        // tabulación es una trampa de accesibilidad, no una ayuda — la misma
        // decisión que tomaron las cotas de F06 y los números de F17.
        interactive: false,
        keyboard: false,
      })
      rotulo.addTo(mapa)
    }

    puesto = { miembro, etiqueta, sombra, marco, rotulo }
  }

  /**
   * Lleva el mapa a lo que hay señalado. Ver {@link SenalMiembro.encuadrar}.
   *
   * ⛔ **NO devuelve la vista anterior al apagar la señal, y es deliberado.**
   * Guardar «dónde estaba» y restaurarlo convierte un encuadre en un estado que
   * hay que caducar: el usuario puede mover el mapa, editar un vértice o cambiar
   * de parcela entre el clic que le trajo aquí y el que apaga la señal, y
   * entonces «volver» le devolvería a un sitio que ya no significa nada.
   * Encuadrar es un gesto, no un modo.
   *
   * @returns {boolean}
   */
  function encuadrar() {
    if (!vivo || puesto === null) return false
    let limites = null
    try {
      limites = puesto.marco.getBounds()
    } catch {
      return false
    }
    if (!limites || typeof limites.isValid !== 'function' || !limites.isValid()) return false
    // ⚠️ Los márgenes se recortan si no caben. Con la ventana estrecha, 420+40 px
    // de margen horizontal sobre un mapa de 600 px dejarían un hueco NEGATIVO y
    // Leaflet devolvería un zoom absurdo. Se pide como mucho el 35 % de cada eje,
    // que sigue apartando la geometría del panel sin poder invertir el encuadre.
    const anchoMapa = tamano(mapa, 'x')
    const altoMapa = tamano(mapa, 'y')
    const tope = (valor, total) => (total > 0 ? Math.min(valor, Math.round(total * 0.35)) : valor)
    mapa.fitBounds(limites, {
      paddingTopLeft: [
        tope(MARGEN_ENCUADRE.arribaIzquierda[0], anchoMapa),
        tope(MARGEN_ENCUADRE.arribaIzquierda[1], altoMapa),
      ],
      paddingBottomRight: [
        tope(MARGEN_ENCUADRE.abajoDerecha[0], anchoMapa),
        tope(MARGEN_ENCUADRE.abajoDerecha[1], altoMapa),
      ],
      maxZoom: ZOOM_MAXIMO_ENCUADRE,
    })
    return true
  }

  return {
    senalar,
    encuadrar,
    limpiar,
    senalada: () => (puesto === null ? null : puesto.etiqueta),

    /** Deshace todo: quita el marco y su rótulo del mapa. Idempotente. */
    destruir() {
      if (!vivo) return
      vivo = false
      limpiar()
    },
  }
}

/**
 * Escapa lo que va DENTRO del `html` del `divIcon`.
 *
 * ⛔ **Hace falta de verdad**: la etiqueta puede ser el NOMBRE que el usuario le
 * ha escrito a una finca nueva en el campo de la lista, no solo una referencia
 * catastral. Es texto tecleado por una persona metido en una cadena de HTML, que
 * es la definición del agujero. `viewer/piezas.js` no lo necesita porque allí lo
 * que se interpola es un número.
 */
function escapar(texto) {
  return String(texto)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

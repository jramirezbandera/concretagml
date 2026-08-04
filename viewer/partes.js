// viewer/partes.js — Las HUELLAS de las partes de construcción, dibujadas.
//
// F11, decisión 3: **las partes SE PINTAN en el mapa**. No es un adorno, es la
// forma de comprobar el criterio de aceptación 2 con los ojos y no solo en un
// test — la lección que dejaron escrita la fase 4 de F03 (la aplicación existía
// en la suite y no se veía) y el guion de F08 (dos defectos que la suite no
// destapaba). Un edificio importado de un DXF que cae 40 m al norte por un huso
// mal deducido es indistinguible de uno bueno en la lista del panel, y salta a la
// vista en cuanto se pinta sobre la ortofoto.
//
// ── QUÉ DIBUJA ──────────────────────────────────────────────────────────────
// Un polígono RELLENO por parte, con su nombre en un título emergente. Nada más:
// esta capa no mide, no compara y no acota. La envolvente del edificio es
// derivada y se calcula en F12 (`model/edificio.js` no la guarda a propósito), y
// el contraste contra el Catastro es de F14.
//
// ── EL MOLDE ES `viewer/colindantes.js`, CON DOS DIFERENCIAS DE FONDO ───────
// La estructura —fábrica con `{pintar, limpiar, destruir}`, contratos del
// programador con `throw`, dato malo contado en un aviso— es la de esa capa
// letra por letra. Lo que cambia es lo que la capa SIGNIFICA, y de ahí salen las
// dos diferencias:
//
//   1. **AQUÍ SÍ HAY RELLENO VISIBLE.** En `colindantes.js` el relleno es de
//      opacidad CERO —un truco para que el emergente responda en todo el interior
//      sin pintar un píxel— porque una vecina es CONTEXTO. Aquí la huella es EL
//      ASUNTO de la rama: lo que el usuario está construyendo. Un contorno hueco
//      sobre una ortofoto llena de linderos se pierde; una mancha se ve.
//      Pero **baja** (ver {@link OPACIDAD_RELLENO}): el usuario tiene que seguir
//      viendo la cubierta que hay debajo, porque comparar la huella con el tejado
//      real de la imagen ES la comprobación que justifica pintarlas.
//
//   2. **UNA PARTE TRAE UN `recinto`, NO UN ARRAY DE ELLOS.** Una vecina llega
//      como `{refcat, recintos[]}` —exterior + patios—, y `colindantes.js` mete
//      todos los anillos en un mismo `L.polygon` para que los huecos se recorten
//      solos. Una `ParteConstruccion` tiene UN `recinto` y ya está
//      (`model/edificio.js:165`): el modelo no le da huecos hoy. Así que aquí un
//      polígono es un anillo, y si F12 le añade patios a una parte, este módulo
//      tendrá que envolverlos igual que el de colindantes.
//
// ── ⚠️ `recinto: null` ES UN ESTADO NORMAL, NO UN FALLO ─────────────────────
// `crearParteConstruccion` admite `recinto = null` y lo documenta como «pendiente
// de dibujar»; dibujarlas es F12. Así que una parte sin contorno **no lanza** —
// eso sería tratar un dato legítimo como un error del programador—, pero
// **tampoco se calla**: no se pinta y se cuenta en un aviso con cuántas de
// cuántas, exactamente como `viewer/colindantes.js:340-349`. Callarlo dejaría 10
// huellas en el mapa mientras la lista del panel dice «13 partes», y esa resta la
// tendría que hacer el usuario de cabeza (regla de oro 1).
//
// ── EL PANE 422 ─────────────────────────────────────────────────────────────
// `PANE.PARTES` va **sobre** la parcela editada (420) y **debajo** de las
// acotaciones (425) y de los vértices (430). El razonamiento completo —por qué la
// relación con la parcela es la INVERSA de la de `colindantes`, y por qué una
// huella rellena no es lo mismo que una anotación— está en `viewer/_comun.js#PANES`
// y no se repite aquí.
//
// ── EL EMERGENTE OBLIGA A `interactive: true` ───────────────────────────────
// Mismo riesgo, mismo desenlace y misma medición que en `colindantes.js`: el
// título con el nombre de la parte necesita que la capa reciba eventos de puntero,
// y una capa interactiva podría robarle el clic al mapa —que es «Deducir del mapa»
// de F05—. No pasa, porque `L.Path` trae `bubblingMouseEvents: true`. Aquí el
// riesgo es MAYOR que allí y por eso también se mide: `colindantes` se defiende
// además con el apilado (va en 405, debajo de todo), mientras que estas huellas
// van en 422 y **sí quedan por encima del polígono de la parcela**. Si esa prueba
// cayera algún día, la salida es la misma que dejó escrita F05: la capa se queda
// SIN emergente y con `interactive:false`.
//
// SOLO-NAVEGADOR: importa Leaflet, así que su test lleva el sufijo `.dom` y JAMÁS
// entra en el barrel raíz `index.js` (rompería la suite `node`: Leaflet exige
// `window`). Ojo con la trampa que ya documenta `report/canvas.js`: este módulo
// solo toca el DOM DENTRO de sus funciones, así que un `import` suelto **no
// lanzaría** y dejaría el barrel roto en producción y verde en la suite.

import L from 'leaflet'

import { HUSOS_VALIDOS } from '../geo/huso.js'
import { NIVEL, PANE, resolverAvisar, vertUTMaLatLng } from './_comun.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Clase CSS de la huella de una parte. ESTABLE: `estilos/app.css` puede afinar
 * sobre ella (cursor, impresión…) sin que este módulo importe CSS, igual que
 * `viewer/colindantes.js#CLASE_COLINDANTE` y `viewer/acotaciones.js#CLASE_ACOTACION`.
 * Lo imprescindible para que se VEA va en las opciones de Leaflet, no en la hoja:
 * `viewer/*` no la carga.
 *
 * ⚠️ **`gml-huella` y no `gml-parte`**, que ya existe y es otra cosa: la FILA de
 * la lista del panel (`estilos/app.css`, sección de F11, junto a
 * `.gml-parte-nombre` y `.gml-parte-dato`). Son dos objetos distintos —un `<path>`
 * dentro del mapa y un `<li>` dentro del panel— y compartir prefijo acabaría con
 * una regla pensada para uno aplicándose al otro.
 */
export const CLASE_HUELLA = 'gml-huella'

/** Clase CSS del título emergente con el nombre de la parte. */
export const CLASE_EMERGENTE = 'gml-huella-emergente'

/**
 * Color de la huella de una parte de construcción. Elegido por DESCARTE, con el
 * mismo método que `COLOR_USUARIO` (ver `viewer/_comun.js`) y que
 * `COLOR_COLINDANTE`, y con una restricción más que ninguno de los dos:
 *
 *   · **No puede significar nada** (regla de oro 9). Una parte no está «bien» ni
 *     «mal»: es lo que el usuario ha dibujado. Fuera el verde y el rojo, y fuera
 *     el ÁMBAR `#D97706`, que en este proyecto es la invasión a colindante y es
 *     la única excepción autorizada a la regla 9
 *     (`viewer/contraste.js#COLOR_INVASION`).
 *   · **No puede ser el AMARILLO del usuario** `#FFD600`, y esta es la
 *     restricción nueva. En la rama EDIFICIO la parcela sigue en pantalla como
 *     CONTEXTO, pintada de amarillo, y las huellas van justo ENCIMA (pane 422
 *     sobre 420). Si las dos cosas fueran amarillas, el técnico no podría
 *     distinguir el edificio del solar — que es exactamente la confusión que el
 *     reparto de panes existe para evitar, y pintarlas del mismo color la traería
 *     de vuelta por la puerta de al lado.
 *   · **No puede ser gris.** El gris ya está tomado dos veces y las dos con el
 *     mismo sentido: la colindante (`#CBD5E1`) y la diferencia sombreada de F07
 *     (`#64748B`) son CONTEXTO. Una huella gris se leería como más contexto, y
 *     aquí es al revés.
 *   · **No puede competir con el rojo del parcelario catastral superpuesto** (que
 *     descarta magenta y rosa —el rosa además es la desviación máxima de F07—) ni
 *     con el AZUL de la hidrografía catastral.
 *
 * Queda el VIOLETA, que lleva libre desde que la fase 5 de F03 se lo quitó a la
 * geometría del usuario. Y se recupera **claro** (violet-400) y no en el
 * `#7C3AED` que entonces se descartó, porque el motivo del descarte sigue vivo:
 * los tonos oscuros desaparecen en las sombras de la ortofoto. Aquí muerde más
 * que en ningún sitio — una huella se dibuja sobre una CUBIERTA, y media cubierta
 * de cada dos está en sombra.
 */
const COLOR_HUELLA = '#A78BFA'

/** Grosor del contorno de la huella, en píxeles. */
const GROSOR_HUELLA = 2

/** Opacidad del trazo. Opaco: la huella es el asunto, no el contexto. */
const OPACIDAD_TRAZO = 1

/**
 * Opacidad del relleno de la huella. **Baja, pero no cero**, y el número tiene un
 * porqué medible en pantalla:
 *
 *   · **No cero**, al revés que en `colindantes.js`: sin mancha, un contorno más
 *     sobre una ortofoto que ya lleva linderos catastrales, sombras de aleros y
 *     bordes de acera no se distingue de nada. La huella es el asunto y tiene que
 *     leerse de un vistazo.
 *   · **Baja**, y esto es lo que decide la cifra: el usuario tiene que seguir
 *     viendo LA CUBIERTA que hay debajo. Comparar la huella con el tejado real de
 *     la imagen es la comprobación entera que justifica pintar las partes
 *     (decisión 3 de la fase); un relleno opaco taparía justo el dato contra el
 *     que se comprueba, y la capa pasaría de servir para algo a estorbar.
 *
 * `0.25` queda en la familia de las opacidades de mancha que ya usa el proyecto
 * —la diferencia sombreada de F07 va al 0,22 y la invasión al 0,45— y del lado
 * bajo, porque aquella explica y esta se compara.
 */
const OPACIDAD_RELLENO = 0.25

/**
 * Texto del emergente cuando la parte llega SIN nombre utilizable.
 *
 * ⚠️ **Es una red, no un estado normal**, y ahí se diferencia de
 * `colindantes.js#SIN_REFERENCIA`: allí el caso ocurre de verdad (el Catastro
 * sirve parcelas con la referencia vacía), mientras que aquí
 * `crearParteConstruccion` **lanza** con un nombre que no sea un string no vacío
 * (`model/edificio.js:137-141`), así que por el camino del modelo esto es
 * inalcanzable. Existe porque esta capa recibe lo que le pase `app/`, y un
 * polígono mudo entre otros que sí hablan se lee como «este no ha cargado bien»
 * — decirlo es la regla de oro 1, callarlo no.
 */
export const SIN_NOMBRE = 'Parte sin nombre'

// ── Helpers de módulo (puros) ────────────────────────────────────────────────

/** Describe un valor para un mensaje de contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Texto del título emergente de una parte. Exportado para que los tests —y quien
 * quiera rotular lo mismo en otro sitio— comparen contra ESTA función y no contra
 * una copia del formato.
 *
 * @param {string|null|undefined} nombre  El `nombre` de la `ParteConstruccion`.
 * @returns {string}  El nombre sin espacios de sobra, o {@link SIN_NOMBRE}.
 */
export function textoEmergenteParte(nombre) {
  const texto = typeof nombre === 'string' ? nombre.trim() : ''
  return texto === '' ? SIN_NOMBRE : texto
}

/** ¿Es un par UTM `[x,y]` utilizable (finito en las dos componentes)? */
function esParUTM(v) {
  return Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} CapaPartes
 * @property {(partes: object[]|null) => void} pintar
 * @property {() => void} limpiar
 * @property {() => void} destruir
 */

/**
 * Crea la capa de huellas de las partes de construcción: un polígono relleno por
 * parte, con su nombre en un título emergente.
 *
 * ```js
 * const partes = crearCapaPartes({ mapa, zona: 30, alAvisar })
 * partes.pintar(edificio.partes)   // el array del POJO de `crearEdificio`
 * partes.limpiar()                 // al vaciar la rama: ya no hay edificio
 * partes.destruir()
 * ```
 *
 * ⚠️ **Recibe `ParteConstruccion` del modelo, no anillos sueltos.** Necesita las
 * dos cosas que solo trae la parte entera: `nombre` para el emergente y `recinto`
 * para el contorno. Pasarle `edificio.partes.map(p => p.recinto)` compilaría, no
 * lanzaría y dejaría todas las huellas con el mismo rótulo genérico — que es el
 * modo de fallo que este párrafo existe para evitar.
 *
 * ⚠️ **`zona` es el HUSO (29/30/31), NO el `srs`.** Se saca con
 * `geo/huso.js#husoPorSrs(srs)`, que es lo que ya hace `viewer/index.js:1180` y la
 * misma convención que fijó `encuadrarSobreRecintos` en T1.5. Equivocarla no da un
 * error: pone las huellas a cientos de kilómetros, en silencio.
 *
 * Política de errores (SPEC §2, regla 1):
 *   · Contrato roto por el PROGRAMADOR → `throw`. `mapa` que no es un `L.Map`,
 *     `zona` fuera de 29/30/31, falta el pane, `alAvisar` que no es función,
 *     `partes` que no es un array ni `null`.
 *   · Parte SIN contorno dibujable (`recinto: null`, que es un estado NORMAL, o un
 *     anillo con menos de 3 vértices finitos) → **no lanza y no se calla**: no se
 *     pinta y se AVISA una vez por llamada, con cuántas de cuántas.
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado (`viewer/mapa.js`), con
 *   el pane `PANE.PARTES` ya montado (lo crea `crearMapa` iterando `PANES`).
 * @param {number} args.zona  Huso UTM (29, 30 o 31). Ver `geo/huso.js`.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @returns {CapaPartes}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearCapaPartes({ mapa, zona, alAvisar } = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ─────────────
  // Se comprueban las funciones que este módulo usa DE VERDAD (mismo criterio que
  // `viewer/colindantes.js` y `viewer/contraste.js`): un guardián que solo mira
  // `addLayer` deja pasar dobles de test que después revientan por dentro.
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.getPane !== 'function'
  ) {
    throw new TypeError(
      `crearCapaPartes: 'mapa' debe ser un L.Map (con addLayer/removeLayer/getPane); ` +
        `recibido ${describir(mapa)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearCapaPartes: 'zona' inválida: ${JSON.stringify(zona)}. ` +
        `Válidas: ${HUSOS_VALIDOS.join(', ')}. Ojo: 'zona' es el HUSO, no el srs — ` +
        `de 'EPSG:25830' se saca con geo/huso.js#husoPorSrs.`,
    )
  }
  if (!mapa.getPane(PANE.PARTES)) {
    throw new TypeError(
      `crearCapaPartes: falta el pane '${PANE.PARTES}'. Créalo con los nombres de ` +
        `viewer/_comun.js#PANES antes de pintar las huellas (van SOBRE la parcela ` +
        `editada: en la rama EDIFICIO el asunto es el edificio y la parcela es ` +
        `contexto, y por debajo el relleno amarillo las taparía).`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────
  let vivo = true
  /** Los polígonos puestos en el mapa por el último `pintar`. */
  let capas = []

  /**
   * El anillo DIBUJABLE de una parte, en `[lat,lon]`, o `null` si no lo hay.
   *
   * Un anillo con menos de 3 vértices finitos no encierra nada y se descarta: un
   * vértice no finito reventaría dentro de `L.LatLng` con un error de Leaflet
   * ilegible. Lo que sí es de esta capa es no dibujar menos huellas de las que
   * dice la lista del panel sin contarlo: eso lo hace `pintar`.
   *
   * @param {{vertices: Array<[number,number]>}|null|undefined} recinto
   * @returns {Array<[number,number]>|null}
   */
  function anilloLatLng(recinto) {
    const vertices = recinto && Array.isArray(recinto.vertices) ? recinto.vertices : null
    if (!vertices) return null
    const finitos = vertices.filter(esParUTM)
    if (finitos.length < 3) return null
    return finitos.map((v) => vertUTMaLatLng(v, zona))
  }

  /** Quita del mapa todo lo puesto por el último `pintar`. */
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
   * Pinta las huellas. Idempotente: cada llamada limpia lo anterior, así que
   * llamarla dos veces con las mismas partes deja el mapa igual. Es lo que
   * permite que el suscriptor del store la llame en cada `set` sin llevar la
   * cuenta de nada.
   *
   * @param {object[]|null} partes  `Array<ParteConstruccion>` del modelo
   *   (`model/edificio.js`). `null`/`undefined` ⇒ solo limpia.
   * @returns {void}
   * @throws {TypeError} Si `partes` no es un array ni `null`.
   */
  function pintar(partes) {
    // Tras `destruir()` esto es un no-op y no un throw: el desmontaje del visor va
    // en orden inverso y una respuesta del WFS de edificio en vuelo puede llegar
    // después. Mismo criterio que `colindantes.pintar` y `contraste.pintar`.
    if (!vivo) return
    limpiar()
    if (partes === null || partes === undefined) return

    if (!Array.isArray(partes)) {
      throw new TypeError(
        `pintar: 'partes' debe ser un array de ParteConstruccion —el 'partes' del POJO ` +
          `de model/edificio.js#crearEdificio— o null para limpiar; recibido ` +
          `${describir(partes)}. Ojo: son las PARTES enteras, no sus recintos: el ` +
          `emergente necesita el 'nombre'.`,
      )
    }

    let saltadas = 0
    for (const parte of partes) {
      const anillo = anilloLatLng(parte && parte.recinto)
      if (anillo === null) {
        saltadas++
        continue
      }

      const poligono = L.polygon(anillo, {
        pane: PANE.PARTES,
        className: CLASE_HUELLA,
        // Interactiva a propósito, por el emergente. El porqué —y por qué no le
        // roba el clic al mapa— está en la cabecera.
        interactive: true,
        color: COLOR_HUELLA,
        weight: GROSOR_HUELLA,
        opacity: OPACIDAD_TRAZO,
        // Con relleno VISIBLE, al revés que en `colindantes.js`: aquí la huella es
        // el asunto. Ver {@link OPACIDAD_RELLENO} para por qué es bajo.
        fill: true,
        fillColor: COLOR_HUELLA,
        fillOpacity: OPACIDAD_RELLENO,
      })

      poligono.bindTooltip(textoEmergenteParte(parte && parte.nombre), {
        className: CLASE_EMERGENTE,
        // `sticky`: el emergente sigue al puntero en vez de plantarse en el centro
        // geométrico de la huella. En una nave o en un edificio en L el centro
        // puede caer fuera del polígono —y hasta fuera de la pantalla—, y un
        // rótulo invisible es un rótulo que no está.
        sticky: true,
        direction: 'top',
      })

      poligono.addTo(mapa)
      capas.push(poligono)
    }

    if (saltadas > 0) {
      avisar(
        `${saltadas} de ${partes.length} parte(s) de construcción no traen contorno ` +
          `dibujable: no se han pintado en el mapa. El resto sí.`,
        // AVISO y no ERROR: no impide seguir (la regla de clasificación está junto
        // al typedef `Avisar` de `viewer/_comun.js`). Y aquí el motivo normal ni
        // siquiera es un fallo — una parte puede estar «pendiente de dibujar»
        // (`recinto: null`), que es F12.
        { nivel: NIVEL.AVISO },
      )
    }
  }

  return {
    pintar,
    limpiar,

    /** Deshace todo: quita las huellas del mapa. Idempotente. */
    destruir() {
      if (!vivo) return
      vivo = false
      limpiar()
    },
  }
}

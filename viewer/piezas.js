// viewer/piezas.js — F17 · Las PIEZAS del sobrante, dibujadas y NUMERADAS.
//
// ── POR QUÉ ESTA CAPA EXISTE, Y POR QUÉ EL NÚMERO NO ES UN ADORNO ───────────
// La decisión de fondo de F17 es que **las piezas se PROPONEN, no se crean
// solas**: la aplicación deriva `P_of − P_new`, las lista con su superficie y su
// grosor, y quien firma decide cuáles entran en el expediente y cómo se llaman.
//
// Esa decisión se queda en la letra si el usuario no puede decir QUÉ MANCHA está
// nombrando. Una lista de cuatro filas que dicen «12,40 m²», «0,03 m²», «8,71 m²»
// y «0,004 m²» no se puede revisar: revisar es mirar el mapa y reconocer el trozo.
// Por eso esta capa pinta un **número permanente** sobre cada pieza, el mismo
// `orden` que la fila enseña, y por eso el resaltado es **recíproco** —señalar la
// fila resalta la mancha y señalar la mancha resalta la fila—. Sin esto, la
// revisión sería teatro.
//
// ⚠️ Y el número **no puede vivir SOLO aquí**. Si la correspondencia fila↔mancha
// fuera únicamente visual, para un lector de pantalla no existiría. El número va
// también en el texto de la fila; eso es de `viewer/lista-sobrante.js`, y se dice
// aquí porque es la mitad de una misma decisión.
//
// ── QUÉ DIBUJA, Y QUÉ NO ────────────────────────────────────────────────────
// Un polígono relleno por pieza —con sus HUECOS recortados, que una pieza del
// sobrante puede tenerlos— y su número encima. Nada más: esta capa no mide, no
// ordena y no decide qué es una astilla. Todo eso ya viene hecho y medido dentro
// de la `PiezaSobrante` que le pasan (`derivacion/cesion.js`), y recalcularlo aquí
// sería una segunda definición de «cuánto mide esto» en un proyecto que tiene una.
//
// ── EL MOLDE ES `viewer/partes.js`, CON TRES DIFERENCIAS ────────────────────
// La estructura —fábrica con `{pintar, limpiar, destruir}`, contratos del
// programador con `throw`, dato malo contado en un aviso— es la de aquella capa.
// Lo que cambia:
//
//   1. **Una pieza trae `recintos[]`, no un `recinto`.** Es un array con el
//      EXTERIOR en `[0]` y los huecos detrás (invariante de `model/parcela.js`),
//      así que aquí un polígono son VARIOS anillos y Leaflet recorta los huecos
//      solo — como en `viewer/colindantes.js`, no como en `partes.js`.
//   2. **Hay rótulo permanente, no emergente.** Un título que aparece al pasar el
//      ratón no sirve para lo que esta capa existe: el usuario tiene que poder
//      leer los cuatro números A LA VEZ mientras recorre la lista.
//   3. **Hay resaltado, y es bidireccional.** La capa avisa de qué pieza se está
//      señalando ({@link CapaPiezas.alSenalar}) y acepta que se lo digan
//      ({@link CapaPiezas.resaltar}). Quien une los dos extremos es
//      `app/cableado-derivacion.js`: ni la lista conoce el mapa ni el mapa la lista.
//
// ── ⚠️ UNA PIEZA FUERA DEL ENCUADRE SE DICE ─────────────────────────────────
// El caso que nadie había nombrado: la lista enseña «pieza 3» y en el mapa no hay
// ningún 3, porque cae fuera de lo que se ve. Ocurre de verdad —el encuadre lo
// decide la geometría EDITADA, y una cesión puede quedarse en el borde— y sin
// decirlo se lee como «esta no se ha pintado». Se cuenta en un aviso, con cuántas
// de cuántas, exactamente como `partes.js` cuenta las que no traen contorno.
//
// ⚠️ Se mide contra el encuadre **del momento de pintar**. No se sigue al mapa
// (`moveend`/`zoomend`): esta capa no se suscribe a nada, y hacerlo la convertiría
// en una fuente de avisos repetidos a cada arrastre del mapa. Quien quiera el dato
// fresco vuelve a pintar, que es lo que hace el cableado cuando la foto cambia.
//
// SOLO-NAVEGADOR: importa Leaflet, así que su test lleva el sufijo `.dom` y JAMÁS
// entra en el barrel raíz `index.js` (rompería la suite `node`: Leaflet exige
// `window`).

import L from 'leaflet'

import { HUSOS_VALIDOS } from '../geo/huso.js'
import {
  NIVEL,
  PANE,
  PREFIJO_FUERA,
  resolverAvisar,
  textoNumeroPieza,
  vertUTMaLatLng,
} from './_comun.js'

// El rótulo se REEXPORTA y no se redefine: lo escriben esta capa y la lista del
// panel, y la lista no puede importar de aquí (Leaflet). Vive en `_comun.js`, que
// es el único sitio que las dos alcanzan. Se reexporta para no romper a quien ya lo
// importaba de este módulo — que es donde nació.
export { PREFIJO_FUERA, textoNumeroPieza }

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Clase CSS de la mancha de una pieza. ESTABLE, como `CLASE_HUELLA` de
 * `viewer/partes.js`: `estilos/app.css` puede afinar sobre ella sin que este
 * módulo importe CSS. Lo imprescindible para que se VEA va en las opciones de
 * Leaflet, porque `viewer/*` no carga ninguna hoja.
 */
export const CLASE_PIEZA = 'gml-pieza'

/** Clase CSS del rótulo con el número de la pieza. */
export const CLASE_NUMERO = 'gml-pieza-numero'

/**
 * Color de una pieza del sobrante. Elegido por DESCARTE, con el mismo método que
 * `COLOR_USUARIO` (`viewer/_comun.js`) y que `COLOR_HUELLA` (`viewer/partes.js`),
 * y con la restricción que decide el caso:
 *
 *   · **No puede ser el gris `#64748B` de la diferencia sombreada de F07**, y
 *     ésta es la que manda: una pieza del sobrante ocupa EXACTAMENTE el mismo
 *     terreno que aquella mancha, porque las dos son `P_of − P_new`. Con el mismo
 *     color, el usuario no sabría si está mirando la explicación de F07 o el
 *     objeto que F17 le propone entregar.
 *   · **No puede significar nada** (regla de oro 9): una pieza no está «bien» ni
 *     «mal» —ni siquiera la estrecha, que se lista con su aviso y su cifra—. Fuera
 *     el verde y el rojo, y fuera el ÁMBAR `#D97706`, que en este proyecto es la
 *     invasión a colindante y es la ÚNICA excepción autorizada a la regla 9.
 *   · **No puede ser el amarillo `#FFD600` del usuario**: la pieza sale de su
 *     geometría pero ya NO es su geometría — es lo que deja de serlo.
 *   · Quedan fuera además el violeta `#A78BFA` (huella de parte), el rosa
 *     `#DB2777` (desviación máxima de F07), el rojo del parcelario catastral
 *     superpuesto y el verde de la vegetación de la ortofoto.
 *
 * Queda el CIAN, que no lo usa nadie. Y se coge **claro** (cyan-400) por la
 * lección que la fase 5 de F03 pagó con el violeta oscuro: los tonos oscuros
 * desaparecen en las sombras de la ortofoto, y una cesión cae con frecuencia en un
 * borde arbolado. El azul de la hidrografía catastral es un azul saturado y
 * oscuro; a este cian claro no se le parece sobre imagen.
 */
const COLOR_PIEZA = '#22D3EE'

/**
 * Clase CSS de la mancha que cae **FUERA** del contorno oficial. Se pone ADEMÁS
 * de {@link CLASE_PIEZA}, no en su lugar: las dos son manchas medidas de esta
 * capa y quien quiera contarlas todas sigue teniendo un solo selector.
 */
export const CLASE_PIEZA_FUERA = 'gml-pieza--fuera'

/**
 * Color de un trozo que se sale del contorno oficial.
 *
 * ⚠️ **Es EL MISMO ámbar que `viewer/contraste.js#COLOR_INVASION`, y no por
 * casualidad: significa exactamente lo mismo.** Un trozo de la geometría medida
 * que cae fuera de la parcela oficial ES terreno de un colindante, que es el
 * único hecho al que este proyecto autoriza ponerle color con carga —la excepción
 * declarada a la regla de oro 9, ya escrita en la cabecera de este mismo fichero
 * cuando se eligió el cian por descarte—.
 *
 * Repetir el literal en vez de importarlo de `contraste.js` es la convención que
 * ya siguen los tres módulos que lo nombran (`contraste.js`, `partes.js` y éste):
 * cada capa declara su paleta con el porqué al lado, porque el porqué es distinto
 * en cada una aunque el hex coincida. Lo que NO puede pasar es que diverjan, y de
 * eso se encarga la prueba que compara los dos.
 */
const COLOR_FUERA = '#D97706'

/**
 * Las dos variantes de la capa: qué pinta y con qué aspecto.
 *
 * Van como UN valor y no como tres opciones sueltas (color, clase, prefijo) para
 * que no se puedan combinar en algo que no signifique nada — una mancha ámbar con
 * número sin prefijo sería un desborde disfrazado de sobrante.
 */
export const VARIANTE = Object.freeze({
  /** Lo que la parcela SUELTA: `P_of − P_new`. Es el defecto. */
  SOBRANTE: 'SOBRANTE',
  /** Lo que la parcela INVADE: `P_new − P_of`. */
  FUERA: 'FUERA',
})

/** El aspecto de cada variante, en un solo sitio. */
const ASPECTO = Object.freeze({
  [VARIANTE.SOBRANTE]: { color: COLOR_PIEZA, clase: CLASE_PIEZA, prefijo: '' },
  [VARIANTE.FUERA]: {
    color: COLOR_FUERA,
    clase: `${CLASE_PIEZA} ${CLASE_PIEZA_FUERA}`,
    prefijo: PREFIJO_FUERA,
  },
})

/** Grosor del contorno, en píxeles. */
const GROSOR_TRAZO = 2

/** Y el del contorno RESALTADO: el doble, que es lo que se ve de reojo. */
const GROSOR_TRAZO_RESALTADO = 4

/**
 * Opacidad del relleno. Del lado ALTO de la familia del proyecto —la diferencia
 * de F07 va al 0,22 y la huella de F11 al 0,25— y por un motivo que es el inverso
 * del de aquéllas: aquí no hay nada debajo contra lo que comparar. La pieza no se
 * contrasta con la ortofoto, se RECONOCE, y lo que el usuario necesita es
 * distinguirla de la de al lado de un vistazo.
 *
 * No llega a opaca porque una astilla de 4 cm² sobre un lindero tiene que dejar
 * ver el lindero: si tapara el borde, el usuario no podría juzgar si esa esquirla
 * es un trozo de finca o un residuo de redondeo, que es la decisión entera que
 * esta pantalla le pide.
 */
const OPACIDAD_RELLENO = 0.35

/** Y la del relleno resaltado. Sube lo justo para que la mancha «salte». */
const OPACIDAD_RELLENO_RESALTADO = 0.6

/**
 * Estilo EN LÍNEA del rótulo del número. Va en línea y no en la hoja por lo mismo
 * que en `viewer/acotaciones.js`: este módulo no importa CSS, y un número que solo
 * se ve con `estilos/app.css` cargada dejaría el mapa pelado sin rótulos.
 *
 * Fondo oscuro y texto cian: el mismo par que usa la cota de F06 (fondo
 * `rgba(17,24,39,.82)` y el color de su geometría), porque el problema es el
 * mismo —un rótulo sobre una ortofoto de contraste impredecible— y ya está
 * resuelto. `pointer-events:none` para que el número no le robe el puntero a la
 * mancha que rotula: quien recoge el ratón es el polígono.
 */
const estiloNumero = (color) =>
  'display:inline-block;transform:translate(-50%,-50%);' +
  'white-space:nowrap;pointer-events:none;' +
  'font:700 12px/1.35 ui-sans-serif,system-ui,sans-serif;font-variant-numeric:tabular-nums;' +
  `color:${color};background:rgba(17,24,39,.82);` +
  'padding:1px 6px;border-radius:999px;'

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

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../derivacion/cesion.js').PiezaSobrante} PiezaSobrante
 */

/**
 * @typedef {Object} CapaPiezas
 * @property {(piezas: PiezaSobrante[]|null) => void} pintar
 * @property {(orden: number|null) => void} resaltar  Resalta UNA pieza por su
 *   `orden`, o ninguna con `null`. Idempotente y tolerante: un `orden` que no está
 *   pintado apaga el resaltado y no lanza (la foto puede haber cambiado entre el
 *   `mouseover` de la fila y este cable).
 * @property {(fn: (orden: number|null) => void) => (() => void)} alSenalar
 *   Suscribe «el usuario está señalando esta pieza en el MAPA» (o ninguna, con
 *   `null`). Devuelve la baja.
 * @property {() => void} limpiar
 * @property {() => void} destruir
 */

/**
 * Crea la capa de piezas del sobrante: una mancha por pieza, con su número encima.
 *
 * ```js
 * const piezas = crearCapaPiezas({ mapa, zona: 30, alAvisar })
 * piezas.pintar(cesion.piezas)   // el array de `derivacion/cesion.js#derivarCesion`
 * piezas.resaltar(2)             // el usuario señala la fila 2 de la lista
 * piezas.limpiar()               // la foto se invalidó: la parcela ha cambiado
 * piezas.destruir()
 * ```
 *
 * ⚠️ **Recibe `PiezaSobrante` del modelo de derivación, no recintos sueltos.**
 * Necesita `orden` para el número y `centroide` para colocarlo. Pasarle
 * `cesion.piezas.map(p => p.recintos)` no lanzaría —los recintos son lo único que
 * se dibuja— y dejaría todas las manchas SIN número, que es justo la mitad por la
 * que esta capa existe.
 *
 * ⚠️ **`zona` es el HUSO (29/30/31), NO el `srs`.** Misma convención que
 * `crearCapaPartes` y `crearAcotaciones`. Equivocarla no da error: pone las piezas
 * a cientos de kilómetros, en silencio.
 *
 * Política de errores (SPEC §2, regla 1):
 *   · Contrato roto por el PROGRAMADOR → `throw`. `mapa` que no es un `L.Map`,
 *     `zona` fuera de 29/30/31, falta el pane, `alAvisar` que no es función,
 *     `piezas` que no es un array ni `null`.
 *   · Pieza sin contorno dibujable, o sin centroide con el que colocar el número, o
 *     que cae FUERA del encuadre → **no lanza y no se calla**: se cuenta en un
 *     aviso por llamada, con cuántas de cuántas y de qué clase es el problema.
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado, con el pane
 *   `PANE.PIEZAS` montado (lo crea `crearMapa` iterando `PANES`).
 * @param {number} args.zona  Huso UTM (29, 30 o 31). Ver `geo/huso.js`.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @param {'SOBRANTE'|'FUERA'} [args.variante='SOBRANTE']  Qué está pintando esta
 *   capa: lo que la parcela SUELTA (cian, sin prefijo) o lo que se SALE del
 *   contorno oficial (ámbar, prefijo `F`). Ver {@link VARIANTE}. Son dos capas
 *   distintas y no una con dos modos: se pintan a la vez, cada una con su foto, y
 *   cada una tiene su propio resaltado recíproco con su mitad de la lista.
 * @returns {CapaPiezas}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearCapaPiezas({ mapa, zona, alAvisar, variante = VARIANTE.SOBRANTE } = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ─────────────
  // Se comprueba lo que este módulo USA de verdad, igual que `crearCapaPartes`:
  // un guardián que solo mira `addLayer` deja pasar dobles que revientan por
  // dentro. `getBounds` está en la lista porque el aviso de «fuera del encuadre»
  // depende de él, y sin comprobarlo ese aviso sería el que fallara.
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.getPane !== 'function' ||
    typeof mapa.getBounds !== 'function'
  ) {
    throw new TypeError(
      `crearCapaPiezas: 'mapa' debe ser un L.Map (con addLayer/removeLayer/getPane/getBounds); ` +
        `recibido ${describir(mapa)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearCapaPiezas: 'zona' inválida: ${JSON.stringify(zona)}. ` +
        `Válidas: ${HUSOS_VALIDOS.join(', ')}. Ojo: 'zona' es el HUSO, no el srs — ` +
        `de 'EPSG:25830' se saca con geo/huso.js#husoPorSrs.`,
    )
  }
  if (!mapa.getPane(PANE.PIEZAS)) {
    throw new TypeError(
      `crearCapaPiezas: falta el pane '${PANE.PIEZAS}'. Créalo con los nombres de ` +
        `viewer/_comun.js#PANES antes de pintar el sobrante (va SOBRE la parcela ` +
        `editada: una pieza no es una anotación sobre ella, es otra finca).`,
    )
  }

  if (!Object.hasOwn(ASPECTO, variante)) {
    throw new RangeError(
      `crearCapaPiezas: 'variante' inválida: ${JSON.stringify(variante)}. ` +
        `Válidas: ${Object.keys(ASPECTO).join(', ')} (viewer/piezas.js#VARIANTE). ` +
        `Un valor desconocido no puede caer al defecto: pintaría de CIAN —el color de lo que ` +
        `la parcela suelta— un trozo que a lo mejor es de un colindante.`,
    )
  }
  const aspecto = ASPECTO[variante]

  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────
  let vivo = true
  /** `{orden, poligono, marcador}` de lo puesto por el último `pintar`. */
  let puestas = []
  /** El `orden` resaltado ahora mismo, o `null`. */
  let resaltada = null
  /** @type {Set<(orden: number|null) => void>} */
  const oyentes = new Set()

  /** Avisa a los suscriptores de qué pieza se está señalando en el mapa. */
  function emitirSenal(orden) {
    for (const fn of oyentes) {
      try {
        fn(orden)
      } catch (causa) {
        // Un oyente que revienta no puede tumbar al resto ni dejar la capa a
        // medias: es el mismo criterio con el que `crearEstadoVista` aísla a sus
        // suscriptores. Pero no se traga (regla 1).
        avisar('Un oyente de «pieza señalada» ha fallado; el resaltado sigue funcionando.', {
          nivel: NIVEL.AVISO,
          causa,
        })
      }
    }
  }

  /**
   * Los ANILLOS dibujables de una pieza, en `[lat,lon]`, o `null` si no los hay.
   * El exterior en `[0]` y los huecos detrás, que es lo que `L.polygon` espera
   * para recortarlos — igual que `viewer/colindantes.js` con los patios.
   *
   * Un anillo con menos de 3 vértices finitos no encierra nada y se descarta; si
   * el que se cae es el EXTERIOR, la pieza entera no se puede dibujar.
   *
   * @param {{recintos: Array<{vertices: Array<[number,number]>}>}} pieza
   * @returns {Array<Array<[number,number]>>|null}
   */
  function anillosLatLng(pieza) {
    const recintos = pieza && Array.isArray(pieza.recintos) ? pieza.recintos : null
    if (recintos === null || recintos.length === 0) return null

    const anillos = []
    for (const recinto of recintos) {
      const vertices = recinto && Array.isArray(recinto.vertices) ? recinto.vertices : []
      const finitos = vertices.filter(esParUTM)
      if (finitos.length < 3) {
        // El exterior es `recintos[0]`: sin él no hay pieza. Un HUECO que no se
        // puede dibujar solo se pierde como hueco, y el aviso de `pintar` lo
        // cuenta junto con lo demás.
        if (anillos.length === 0) return null
        continue
      }
      anillos.push(finitos.map((v) => vertUTMaLatLng(v, zona)))
    }
    return anillos.length === 0 ? null : anillos
  }

  /** Aplica a una entrada el estilo que le toca según si está resaltada. */
  function vestir(entrada) {
    const activa = entrada.orden === resaltada
    entrada.poligono.setStyle({
      weight: activa ? GROSOR_TRAZO_RESALTADO : GROSOR_TRAZO,
      fillOpacity: activa ? OPACIDAD_RELLENO_RESALTADO : OPACIDAD_RELLENO,
    })
    // El rótulo se marca con un `data-*` en vez de con un color distinto: es un
    // gancho de inspección para los tests y para `estilos/app.css`, y no gasta
    // vocabulario visual nuevo (el número ya destaca por el resaltado de su
    // mancha, que es lo que el ojo sigue).
    const el = entrada.marcador === null ? null : entrada.marcador.getElement()
    if (el) el.dataset.resaltada = activa ? 'si' : 'no'
  }

  /** Quita del mapa todo lo puesto por el último `pintar`. */
  function limpiar() {
    for (const entrada of puestas) {
      for (const capa of [entrada.poligono, entrada.marcador]) {
        if (capa === null) continue
        try {
          mapa.removeLayer(capa)
        } catch {
          // Una capa que ya no está en el mapa no es un error que deba tumbar el
          // resto del desmontaje: el desmontaje es idempotente en todo el visor.
        }
      }
    }
    puestas = []
    resaltada = null
  }

  /**
   * Pinta las piezas. Idempotente: cada llamada limpia lo anterior, así que
   * llamarla dos veces con la misma foto deja el mapa igual.
   *
   * ⛔ **Y BORRA EL RESALTADO**, a propósito: la decisión 3C de F17 dice que el
   * sobrante es una FOTO y que recalcularlo lo invalida entero. Conservar «estaba
   * resaltada la 2» a través de un repintado resaltaría la pieza número 2 de otra
   * derivación, que es un trozo de terreno distinto con el mismo número.
   *
   * @param {PiezaSobrante[]|null} piezas  `null`/`undefined` ⇒ solo limpia.
   * @returns {void}
   * @throws {TypeError} Si `piezas` no es un array ni `null`.
   */
  function pintar(piezas) {
    // Tras `destruir()` esto es un no-op y no un throw: el desmontaje del visor va
    // en orden inverso. Mismo criterio que `partes.pintar` y `contraste.pintar`.
    if (!vivo) return
    limpiar()
    if (piezas === null || piezas === undefined) return

    if (!Array.isArray(piezas)) {
      throw new TypeError(
        `pintar: 'piezas' debe ser un array de PiezaSobrante —el 'piezas' de ` +
          `derivacion/cesion.js#derivarCesion— o null para limpiar; recibido ` +
          `${describir(piezas)}. Ojo: son las PIEZAS enteras, no sus recintos: el ` +
          `número necesita 'orden' y 'centroide'.`,
      )
    }

    let sinContorno = 0
    let sinNumero = 0
    let fueraDelEncuadre = 0
    // Se lee UNA vez por llamada y no una por pieza: `getBounds` proyecta, y en el
    // caso normal (cuatro piezas) da igual, pero el caso que este proyecto ha visto
    // es el de las ocho astillas que nadie pretendía.
    const encuadre = mapa.getBounds()

    for (const pieza of piezas) {
      const anillos = anillosLatLng(pieza)
      if (anillos === null) {
        sinContorno++
        continue
      }

      const orden = pieza && Number.isFinite(pieza.orden) ? pieza.orden : null
      const poligono = L.polygon(anillos, {
        pane: PANE.PIEZAS,
        className: aspecto.clase,
        // Interactiva a propósito: sin puntero no hay resaltado recíproco, que es
        // media razón de ser de esta capa. No le roba el clic al mapa porque
        // `L.Path` trae `bubblingMouseEvents: true` — el mismo hecho medido que
        // sostiene a `colindantes.js` y a `partes.js`.
        interactive: true,
        color: aspecto.color,
        weight: GROSOR_TRAZO,
        opacity: 1,
        fill: true,
        fillColor: aspecto.color,
        fillOpacity: OPACIDAD_RELLENO,
      })
      poligono.addTo(mapa)

      // El número, en el centroide del ÁREA que ya trae medido la pieza. No se
      // recalcula aquí: `derivacion/cesion.js` lo obtiene de `geo/centroide.js` y
      // una segunda cuenta podría colocar el rótulo en otro sitio que el que la
      // lista dice.
      let marcador = null
      const centro = pieza && Array.isArray(pieza.centroide) ? pieza.centroide : null
      if (orden === null || !esParUTM(centro)) {
        // La mancha SÍ está pintada; lo que falta es el número. Se cuenta aparte
        // de `sinContorno` porque el síntoma es otro: una mancha muda entre otras
        // numeradas se lee como «esta no cuenta».
        sinNumero++
      } else {
        const latlng = vertUTMaLatLng(centro, zona)
        marcador = L.marker(latlng, {
          pane: PANE.PIEZAS,
          icon: L.divIcon({
            className: CLASE_NUMERO,
            // `iconSize: null` a propósito, igual que en `viewer/acotaciones.js`:
            // `L.DivIcon` trae `[12,12]` por defecto y un número no tiene ancho
            // fijo. Con `null`, la caja queda en 0×0 sobre el punto, que es el
            // ancla que queremos (el `translate(-50%,-50%)` hace el resto).
            iconSize: null,
            html:
              `<span style="${estiloNumero(aspecto.color)}">` +
              `${textoNumeroPieza(orden, aspecto.prefijo)}</span>`,
          }),
          // No interactivo y fuera del tabulador: al número se llega por la fila
          // de la lista, que sí es accionable. Un rótulo no accionable en el orden
          // de tabulación es una trampa de accesibilidad, no una ayuda — la misma
          // decisión que tomaron las cotas de F06.
          interactive: false,
          keyboard: false,
        })
        marcador.addTo(mapa)

        if (!encuadre.contains(latlng)) fueraDelEncuadre++
      }

      const entrada = { orden, poligono, marcador }
      puestas.push(entrada)
      vestir(entrada)

      if (orden !== null) {
        poligono.on('mouseover', () => {
          resaltar(orden)
          emitirSenal(orden)
        })
        poligono.on('mouseout', () => {
          resaltar(null)
          emitirSenal(null)
        })
      }
    }

    // Los tres avisos van SEPARADOS y no fundidos en uno: son tres hechos
    // distintos, con tres remedios distintos, y un renglón que los sumara dejaría
    // al usuario sin saber cuál le está pasando.
    if (sinContorno > 0) {
      avisar(
        `${sinContorno} de ${piezas.length} pieza(s) del sobrante no traen contorno dibujable: ` +
          `no se han pintado en el mapa. Siguen en la lista, con sus cifras.`,
        { nivel: NIVEL.AVISO },
      )
    }
    if (sinNumero > 0) {
      avisar(
        `${sinNumero} de ${piezas.length} pieza(s) del sobrante se han pintado SIN número ` +
          `(no tienen centroide con el que colocarlo). Para saber cuál es cada una, ` +
          `señálalas en la lista: la mancha se resalta igual.`,
        { nivel: NIVEL.AVISO },
      )
    }
    if (fueraDelEncuadre > 0) {
      avisar(
        `${fueraDelEncuadre} de ${piezas.length} pieza(s) del sobrante caen FUERA de lo que se ` +
          `ve del mapa: su número está en la lista pero no en pantalla. Aleja el zoom para ` +
          `verlas.`,
        { nivel: NIVEL.AVISO },
      )
    }
  }

  /**
   * Resalta la pieza `orden`, o ninguna con `null`.
   *
   * @param {number|null} orden
   * @returns {void}
   */
  function resaltar(orden) {
    if (!vivo) return
    const siguiente = Number.isFinite(orden) ? orden : null
    if (siguiente === resaltada) return
    resaltada = siguiente
    for (const entrada of puestas) vestir(entrada)
  }

  return {
    pintar,
    resaltar,
    limpiar,

    alSenalar(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(`alSenalar: 'fn' debe ser una función; recibido ${describir(fn)}.`)
      }
      oyentes.add(fn)
      return () => oyentes.delete(fn)
    },

    /** Deshace todo: quita las manchas y los números del mapa. Idempotente. */
    destruir() {
      if (!vivo) return
      vivo = false
      limpiar()
      oyentes.clear()
    },
  }
}

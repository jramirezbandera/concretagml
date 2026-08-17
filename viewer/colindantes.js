// viewer/colindantes.js — Las PARCELAS COLINDANTES, dibujadas.
//
// Deuda de F05, encontrada en la revisión visual de F08: las vecinas se traían
// del Catastro (`services/catastro.js#parcelaYColindantes`), se publicaban por
// `alColindantes` y las consumían el SNAP de F06 y la INVASIÓN de F07 —pero no
// había ni una capa que las pintara—. Pulsar «Traer colindantes» no producía
// ningún acuse de recibo visual: el usuario leía «12 parcelas colindantes» en el
// panel y el mapa seguía exactamente igual. Que el dato se usara por dentro no lo
// arregla; que no se vea es la regla de oro 1 rota en el último tramo.
//
// ── QUÉ DIBUJA, Y POR QUÉ TAN POCO ───────────────────────────────────────────
// Un CONTORNO fino y gris por vecina, sin relleno, permanente. Nada más. La capa
// no anota, no compara y no destaca: eso es de `viewer/contraste.js` (F07), que
// para eso recibe un diagnóstico. Aquí solo se responde a «¿qué hay alrededor?».
//
// ── NI UN COLOR DE MÉRITO (regla de oro 9) ──────────────────────────────────
// Una vecina no está «bien» ni «mal»: es contexto. Así que nada de verde ni de
// rojo — y **tampoco el ÁMBAR**, que en este proyecto está reservado a la INVASIÓN
// a colindante y es la única excepción autorizada a la regla 9
// (`viewer/contraste.js#COLOR_INVASION`). Si una vecina se pintara de ámbar por
// el mero hecho de existir, el ámbar dejaría de significar lo único que significa.
// Ver {@link COLOR_COLINDANTE} para el porqué del gris concreto.
//
// ── EL EMERGENTE OBLIGA A `interactive: true`, Y ESO TENÍA UN RIESGO ────────
// La referencia catastral de cada vecina se enseña al pasar por encima
// (`bindTooltip`), y un `tooltip` de Leaflet necesita que la capa reciba eventos
// de puntero. Una capa interactiva puede ROBARLE EL CLIC AL MAPA — y ese clic es
// la DEDUCCIÓN de F05, que saca la referencia catastral de dónde se pulsa. Desde
// que se retiró el botón «Deducir del mapa» (2026-08-16) es además el ÚNICO gesto
// que la ofrece, así que perderla por un adorno sería peor negocio que entonces.
//
// No pasa, y no se da por hecho: `L.Path` trae `bubblingMouseEvents: true` por
// defecto, así que Leaflet dispara el evento en la capa Y DESPUÉS en el mapa
// (`Map#_fireDOMEvent` recorre todos los destinatarios y solo se detiene ante un
// `bubblingMouseEvents:false` o un `stop()` explícito). Está MEDIDO en
// `test/viewer/colindantes.dom.test.js`: un oyente en `mapa.on('click')`, un clic
// sobre el `<path>` de una vecina, y el oyente disparándose con su `latlng`. Si
// esa prueba cae algún día, la salida está decidida de antemano: la capa se queda
// SIN emergente y con `interactive:false` — el clic de F05 manda sobre el adorno.
//
// La segunda mitad de esa defensa es el PANE: `colindantes` va en zIndex 405, por
// debajo de todo lo demás del visor (el razonamiento completo está en
// `viewer/_comun.js#PANES`). Estando debajo, el vértice que se arrastra y el
// polígono editado siguen ganando el puntero por apilado, y la vecina solo recoge
// lo que cae fuera de la parcela propia.
//
// ── EL RELLENO INVISIBLE NO ES UN DESCUIDO ──────────────────────────────────
// Se pide un contorno SIN relleno, y aun así el polígono se monta con `fill:true`
// y `fillOpacity:0`. Con `fill:false` Leaflet escribe `fill="none"` en el `<path>`
// y el navegador solo entrega el puntero sobre el TRAZO: apuntar a una línea de
// 1,5 px para leer una referencia catastral no es una función, es una prueba de
// puntería. Con un relleno de opacidad cero el dibujo es idéntico —cero píxeles
// pintados— y el interior entero responde al emergente.
//
// SOLO-NAVEGADOR: importa Leaflet, así que su test lleva el sufijo `.dom` y JAMÁS
// entra en el barrel raíz `index.js` (rompería la suite `node`: Leaflet exige
// `window`). Lo vigila `test/contrato.test.js`.

import L from 'leaflet'

import { HUSOS_VALIDOS } from '../geo/huso.js'
import { NIVEL, PANE, resolverAvisar, vertUTMaLatLng } from './_comun.js'

// ── Constantes ───────────────────────────────────────────────────────────────

/**
 * Clase CSS del contorno de una vecina. ESTABLE: `estilos/app.css` puede afinar
 * sobre ella (cursor, impresión…) sin que este módulo importe CSS, igual que
 * `viewer/acotaciones.js#CLASE_ACOTACION`. Lo imprescindible para que se VEA va en
 * las opciones de Leaflet, no en la hoja: `viewer/*` no la carga.
 */
export const CLASE_COLINDANTE = 'gml-colindante'

/** Clase CSS del título emergente con la referencia catastral. */
export const CLASE_EMERGENTE = 'gml-colindante-emergente'

/**
 * Gris del contorno de una colindante. Elegido por DESCARTE, con el mismo método
 * que `COLOR_USUARIO` (ver `viewer/_comun.js`), y con dos restricciones más que él:
 *
 *   · **No puede significar nada** (regla de oro 9). Fuera el verde, el rojo y el
 *     ámbar —este último porque es el color de la INVASIÓN y solo de ella—, fuera
 *     el amarillo del usuario y fuera el azul de acento. Queda la familia gris.
 *   · **No puede competir con el rojo del parcelario catastral superpuesto**, que
 *     dibuja EXACTAMENTE los mismos linderos cuando el usuario lo enciende. Un
 *     gris medio saturado ahí produciría un lindero doble y sucio.
 *   · **Tiene que sobrevivir a la ortofoto**, que en un mismo encuadre va de
 *     asfalto casi blanco a arbolado en sombra. Aquí manda la misma lección que
 *     llevó el color del usuario del violeta al amarillo: los tonos OSCUROS
 *     desaparecen en las sombras, que es donde más falta hace ver el lindero. Por
 *     eso se coge un gris CLARO (slate-300) y no el `#64748B` de la diferencia
 *     sombreada de F07 — aquella se pinta como una mancha ancha translúcida y
 *     puede permitirse ser oscura; una línea de 1,5 px no.
 *
 * Y **claro y fino a la vez es lo que lo hace discreto**, que es el encargo: se
 * lee cuando se busca y no distrae cuando no.
 */
const COLOR_COLINDANTE = '#CBD5E1'

/** Grosor del contorno, en píxeles. Fino: es contexto, no el asunto. */
const GROSOR_COLINDANTE = 1.5

/** Opacidad del trazo. Por debajo de 1 para que no compita con el amarillo. */
const OPACIDAD_COLINDANTE = 0.85

/**
 * Texto del emergente cuando la vecina llega SIN referencia catastral.
 *
 * No se calla y no se deja sin emergente: un contorno mudo entre otros que sí
 * hablan se lee como «este no ha cargado bien». Decir que no la trae es un dato,
 * y es lo que la regla de oro 1 pide (el caso existe: `gml/parse.js` devuelve `''`
 * en los ficheros donde el elemento está y viene vacío).
 */
export const SIN_REFERENCIA = 'Colindante sin referencia catastral'

// ── Helpers de módulo (puros) ────────────────────────────────────────────────

/** Describe un valor para un mensaje de contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Texto del título emergente de una vecina. Exportado para que los tests —y quien
 * quiera rotular lo mismo en otro sitio— comparen contra ESTA función y no contra
 * una copia del formato.
 *
 * @param {string|null|undefined} refcat
 * @returns {string}  La referencia tal cual, o {@link SIN_REFERENCIA}.
 */
export function textoEmergente(refcat) {
  const rc = typeof refcat === 'string' ? refcat.trim() : ''
  return rc === '' ? SIN_REFERENCIA : rc
}

/** ¿Es un par UTM `[x,y]` utilizable (finito en las dos componentes)? */
function esParUTM(v) {
  return Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} Vecina
 * @property {string|null} refcat  Referencia catastral de la colindante (la del
 *   emergente). `null`/`''` es un caso legítimo, no un fallo.
 * @property {Array<{vertices: Array<[number,number]>}>} recintos  Sus recintos en
 *   UTM, anillos ABIERTOS: `recintos[0]` es el EXTERIOR y el resto, huecos.
 */

/**
 * @typedef {Object} CapaColindantes
 * @property {(vecinas: Vecina[]|null) => void} pintar
 * @property {() => void} limpiar
 * @property {() => void} destruir
 */

/**
 * Crea la capa de parcelas colindantes: un contorno gris fino por vecina, con su
 * referencia catastral en un título emergente.
 *
 * ```js
 * const colindantes = crearCapaColindantes({ mapa, zona: 30 })
 * colindantes.pintar(vecinas)   // [{refcat, recintos}] — lo que devuelve F05
 * colindantes.limpiar()         // al cambiar de parcela: ya no son sus vecinas
 * colindantes.destruir()
 * ```
 *
 * `vecinas` es **la misma forma que consume `diagnostico/parcela.js#diagnosticar`**
 * (`[{refcat, recintos}]`), y no es casualidad: el mismo array que se le pasa al
 * diagnóstico se le pasa a esta capa, sin traducción intermedia. Ojo con la trampa
 * de F05, que ya está escrita en `app/main.js#alColindantes`: **el servicio
 * devuelve PARCELAS y `edicion.fijarColindantes` recibe RECINTOS**. Aquí se
 * reciben PARCELAS, sin aplanar, porque el emergente necesita saber de qué parcela
 * es cada contorno — que es justo lo que el aplanado pierde.
 *
 * Política de errores (SPEC §2, regla 1):
 *   · Contrato roto por el PROGRAMADOR → `throw`. `mapa` que no es un `L.Map`,
 *     `zona` fuera de 29/30/31, falta el pane, `alAvisar` que no es función,
 *     `vecinas` que no es un array ni `null`.
 *   · Vecina SIN contorno dibujable (sin recintos, o con anillos de menos de 3
 *     vértices finitos) → **no lanza y no se calla**: no se pinta y se AVISA una
 *     vez por llamada, con cuántas de cuántas. Callarlo dejaría 11 contornos en
 *     pantalla mientras el panel dice «12 parcelas colindantes», y esa resta la
 *     tendría que hacer el usuario de cabeza.
 *
 * @param {object} args
 * @param {import('leaflet').Map} args.mapa  Mapa ya creado (`viewer/mapa.js`), con
 *   el pane `PANE.COLINDANTES` ya montado (lo crea `crearMapa` iterando `PANES`).
 * @param {number} args.zona  Huso UTM (29, 30 o 31). Ver `geo/huso.js`.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @returns {CapaColindantes}
 * @throws {TypeError|RangeError} Contrato del programador.
 */
export function crearCapaColindantes({ mapa, zona, alAvisar } = {}) {
  // ── Contratos del programador: throw, nunca corrección callada ─────────────
  // Se comprueban las funciones que este módulo usa DE VERDAD (mismo criterio que
  // `viewer/acotaciones.js` y `viewer/contraste.js`): un guardián que solo mira
  // `addLayer` deja pasar dobles de test que después revientan por dentro.
  if (
    !mapa ||
    typeof mapa.addLayer !== 'function' ||
    typeof mapa.removeLayer !== 'function' ||
    typeof mapa.getPane !== 'function'
  ) {
    throw new TypeError(
      `crearCapaColindantes: 'mapa' debe ser un L.Map (con addLayer/removeLayer/` +
        `getPane); recibido ${describir(mapa)}.`,
    )
  }
  if (!HUSOS_VALIDOS.includes(zona)) {
    throw new RangeError(
      `crearCapaColindantes: 'zona' inválida: ${JSON.stringify(zona)}. ` +
        `Válidas: ${HUSOS_VALIDOS.join(', ')}.`,
    )
  }
  if (!mapa.getPane(PANE.COLINDANTES)) {
    throw new TypeError(
      `crearCapaColindantes: falta el pane '${PANE.COLINDANTES}'. Créalo con los nombres ` +
        `de viewer/_comun.js#PANES antes de pintar las vecinas (van por DEBAJO de la ` +
        `parcela: una colindante es contexto y jamás debe tapar a la parcela propia).`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────
  let vivo = true
  /** Los polígonos puestos en el mapa por el último `pintar`. */
  let capas = []

  /**
   * Los anillos DIBUJABLES de una vecina, en `[lat,lon]`.
   *
   * Un anillo con menos de 3 vértices finitos no encierra nada y se descarta: un
   * vértice no finito reventaría dentro de `L.LatLng` con un error de Leaflet
   * ilegible, y señalar la degeneración de una geometría AJENA no es de esta capa
   * (es del Catastro que la sirvió). Lo que sí es de esta capa es no dibujar
   * menos vecinas de las que dice el panel sin contarlo: eso lo hace `pintar`.
   *
   * @param {Array<{vertices: Array<[number,number]>}>|null} recintos
   * @returns {Array<Array<[number,number]>>}
   */
  function anillosLatLng(recintos) {
    if (!Array.isArray(recintos)) return []
    const anillos = []
    for (const recinto of recintos) {
      const vertices = recinto && Array.isArray(recinto.vertices) ? recinto.vertices : null
      if (!vertices) continue
      const finitos = vertices.filter(esParUTM)
      if (finitos.length < 3) continue
      anillos.push(finitos.map((v) => vertUTMaLatLng(v, zona)))
    }
    return anillos
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
   * Pinta las colindantes. Idempotente: cada llamada limpia lo anterior, así que
   * llamarla dos veces con las mismas vecinas deja el mapa igual.
   *
   * UN polígono por VECINA (no uno por recinto), y con todos sus anillos dentro:
   * así el emergente es uno por parcela —que es la unidad que tiene referencia
   * catastral— y los huecos se recortan solos con el `fillRule:'evenodd'` que
   * Leaflet trae por defecto (el mismo hallazgo que le ahorró a F07 su única
   * dependencia nueva; está escrito en `viewer/contraste.js`).
   *
   * @param {Vecina[]|null} vecinas  Lo que devuelve F05, traducido a
   *   `[{refcat, recintos}]`. `null`/`undefined` ⇒ solo limpia.
   * @returns {void}
   * @throws {TypeError} Si `vecinas` no es un array ni `null`.
   */
  function pintar(vecinas) {
    // Tras `destruir()` esto es un no-op y no un throw: el desmontaje del visor va
    // en orden inverso y una respuesta del WFS en vuelo puede llegar después.
    // Mismo criterio que `viewer/acotaciones.js` y `viewer/contraste.js`.
    if (!vivo) return
    limpiar()
    if (vecinas === null || vecinas === undefined) return

    if (!Array.isArray(vecinas)) {
      throw new TypeError(
        `pintar: 'vecinas' debe ser un array [{refcat, recintos}] —la misma forma que ` +
          `consume diagnostico/parcela.js— o null para limpiar; recibido ` +
          `${describir(vecinas)}. Ojo: F05 devuelve PARCELAS, no recintos aplanados.`,
      )
    }

    let saltadas = 0
    for (const vecina of vecinas) {
      const anillos = anillosLatLng(vecina && vecina.recintos)
      if (anillos.length === 0) {
        saltadas++
        continue
      }

      const poligono = L.polygon(anillos, {
        pane: PANE.COLINDANTES,
        className: CLASE_COLINDANTE,
        // Interactiva a propósito, y es lo único de esta capa que lo es. El
        // porqué —y por qué no le roba el clic al mapa— está en la cabecera.
        interactive: true,
        color: COLOR_COLINDANTE,
        weight: GROSOR_COLINDANTE,
        opacity: OPACIDAD_COLINDANTE,
        // Relleno de opacidad CERO: no pinta ni un píxel y sin embargo hace que el
        // interior entero responda al emergente (ver la cabecera). `fill:false`
        // dejaría el emergente colgando de un trazo de 1,5 px.
        fill: true,
        fillColor: COLOR_COLINDANTE,
        fillOpacity: 0,
      })

      poligono.bindTooltip(textoEmergente(vecina && vecina.refcat), {
        className: CLASE_EMERGENTE,
        // `sticky`: el emergente sigue al puntero en vez de plantarse en el
        // centro geométrico de la vecina, que en una parcela rústica grande puede
        // caer fuera de la pantalla — un rótulo invisible es un rótulo que no está.
        sticky: true,
        direction: 'top',
      })

      poligono.addTo(mapa)
      capas.push(poligono)
    }

    if (saltadas > 0) {
      avisar(
        `${saltadas} de ${vecinas.length} parcela(s) colindante(s) no traen un contorno ` +
          `dibujable: no se han pintado en el mapa. El resto sí.`,
        // AVISO y no ERROR: no impide generar el GML (la regla de clasificación
        // está junto al typedef `Avisar` de `viewer/_comun.js`); lo que falta es
        // contexto en la pantalla, no geometría propia.
        { nivel: NIVEL.AVISO },
      )
    }
  }

  return {
    pintar,
    limpiar,

    /** Deshace todo: quita los contornos del mapa. Idempotente. */
    destruir() {
      if (!vivo) return
      vivo = false
      limpiar()
    },
  }
}

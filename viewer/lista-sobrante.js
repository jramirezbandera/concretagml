// viewer/lista-sobrante.js — F17 · La lista del SOBRANTE, en la columna izquierda.
//
// ── QUÉ ES ESTO Y DÓNDE VIVE ────────────────────────────────────────────────
// La vista de `derivacion/cesion.js`: las piezas de `P_of − P_new`, una por fila,
// con su superficie, su grosor, una casilla para incluirla o excluirla del
// expediente y un campo para ponerle nombre. Más el contador «se emitirán N de M»
// y el botón que descarga el expediente entero.
//
// ⛔ **NO ES UN CONTROL DE LEAFLET.** Es un nodo suelto que `app/main.js` cuelga
// de la sección `[data-anfitrion="sobrante"]` del panel, así que no tiene
// `abrir`/`cerrar`/`abierto`: quién lo enseña y quién lo esconde es el eje PASO
// —`data-pantalla="validacion"` en `index.html`, resuelto por CSS— y el cableado,
// que le pone `hidden` a la sección mientras no hay sobrante que enseñar.
//
// **Y ESO ES UNA CORRECCIÓN DEL DISEÑO DE F17, NO SU PLAN ORIGINAL.** El diseño
// aprobado el 2026-08-02 ponía este bloque FLOTANDO en la esquina `bottomleft` del
// mapa, «mutuamente excluyente con los cajones de F07/F08». Esa esquina está libre
// porque se vació a propósito el 2026-08-05, cuando el diagnóstico se mudó a la
// columna, y el argumento que lo movió vale aquí palabra por palabra: **las piezas
// se leen MIRANDO EL MAPA** —se sombrean sobre él, con su número encima, y
// señalar una fila resalta su mancha—, así que flotando taparían justo lo que
// señalan. Además el sobrante es parte de **la entrega** (qué más va en el
// fichero), y la entrega vive en Validación desde el rework.
//
// ── ⚠️ AQUÍ SE ROMPE A PROPÓSITO LA RACHA DE «0 px DEL PANEL» ───────────────
// Cinco fases seguidas resolvieron su interfaz sin gastar un píxel de la columna:
// F06 se llevó la edición a una barra flotante, F07 y F08 sus cifras a cajones
// sobre el mapa, F09 y F10 a sendos `<dialog>`. F17 no puede: la revisión pieza a
// pieza **es** una lista, y una lista con el mapa al lado es exactamente lo que
// hace falta para poder revisarla.
//
// Así que se gasta, y se declara. El presupuesto medido en la revisión de diseño
// (1440×900 y 1280×720, sobre la aplicación real):
//
//     bloque VACÍO ............ 96,63 px
//     cada fila ............... 31,00 px
//     invariante a defender ... 267,44 px de tabla de vértices (desde F07)
//
// De ahí sale {@link FILAS_VISIBLES}: con 4 filas el bloque mide ~220 px y la
// tabla se queda en ≈287 px, por encima del invariante; con 5 lo rompe. ⛔ **Y el
// número de filas NO lo decide el caso de uso, lo decide la geometría**: un
// vértice mal puesto produce ocho piezas sin que nadie lo pretenda. Por eso el
// tope es de ALTURA con scroll dentro, y no un recorte de la lista — ninguna pieza
// desaparece, y el contador dice cuántas hay aunque solo se vean cuatro.
//
// ⛔ **Y el panel NO desborda cuando esto crece: la tabla de vértices ENCOGE EN
// SILENCIO.** Está medido: desborde 0 en los seis casos. O sea que aquí no hay
// síntoma visible que avise de haberse pasado, que es el error silencioso en
// versión maquetación. El guardián es el guion de humo 16, que mide la tabla.
//
// ── ESTE MÓDULO ES UNA VISTA, Y NADA MÁS ────────────────────────────────────
// Fabrica nodos, los rellena y avisa de lo que el usuario toca. **No conoce el
// modelo, ni el store, ni la red, ni `derivacion/`**: recibe el POJO de la
// `Cesion` y lo pinta. Quien la calcula, quien decide si el botón puede encenderse
// y quien descarga es `app/cableado-derivacion.js`. Misma doctrina, y por las
// mismas razones, que `viewer/barra-edicion.js` y `viewer/cajon-diagnostico.js`.
//
// ── EL SOBRANTE ES UNA FOTO (decisión 3C) ───────────────────────────────────
// Editar la parcela **invalida la foto entera**: los nombres escritos se pierden y
// se DICE. Jamás se reasignan por clave heurística — un nombre pegado a la pieza
// equivocada es una finca mal nombrada en un papel que se firma, y el `orden` de
// una pieza vale solo dentro de SU derivación. Aquí eso son dos cosas concretas:
// {@link ListaSobrante.invalidar}, que vacía y explica, y que `pintar` NO conserva
// nada de la foto anterior.
//
// ⚠️ **Y el mensaje de invalidación se pinta AQUÍ, no en el canal global de
// avisos** (decisión que el plan dejó abierta). El canal de avisos es de la
// aplicación entera y mezcla hallazgos de F02, fallos de red y errores del
// serializador; «la parcela ha cambiado, vuelve a derivar» leído entre ellos no
// explica el hueco que el usuario tiene DELANTE, que es la lista vacía. Un aviso
// se lee donde estaba lo que ha desaparecido.
//
// ── CSS: CERO BYTES NUEVOS, Y NO ES CASUALIDAD ──────────────────────────────
// Como el cajón de F07, este módulo **no importa ninguna hoja** —tiene que ser
// legible en jsdom y sobre un mapa pelado—, así que su cromo va en estilos EN
// LÍNEA. Lo que sí usa son las CLASES que ya existen (`gml-rotulo`,
// `gml-rotulo-fila`, `gml-boton`, `gml-accion-estado`, `gml-entrada`, `gml-mono`):
// cuando `estilos/app.css` está cargada, el bloque hereda el sistema de diseño sin
// que este fichero declare ni un color ni un espaciado propios. Cero vocabulario
// visual nuevo.
//
// SOLO-NAVEGADOR de hecho aunque no importe Leaflet: toca el DOM. Su test lleva el
// sufijo `.dom` y no entra en el barrel raíz `index.js`.

import { NIVEL, PREFIJO_FUERA, resolverAvisar, textoNumeroPieza } from './_comun.js'

// ── Contrato de nodos: los `data-*` que este módulo produce ──────────────────

/**
 * Los selectores del bloque. **Son el CONTRATO con `app/cableado-derivacion.js`**
 * y con los tests, y están exportados para que nadie los escriba a mano: un
 * literal mal tecleado en un `querySelector` devuelve `null` sin quejarse.
 *
 * ⚠️ **Los de FILA van en `data-sobrante` y NO en `data-campo`**, y es a propósito.
 * El contrato K.1 (`test/app/main-edificio.dom.test.js`) exige que ningún
 * `data-campo`/`data-accion`/`data-estado`/`data-ficha`/`data-procedencia` se
 * repita en el documento montado, porque `querySelector` se queda con el primero y
 * deja al segundo mudo. Una lista tiene N casillas y N campos de nombre por
 * definición, así que usar `data-campo` obligaría a declarar dos excepciones
 * nuevas en aquel guardián para debilitarlo. `data-sobrante` no está en esa lista y
 * se lee SIEMPRE con `querySelectorAll` acotado a la lista, o por
 * `evento.target.dataset`.
 *
 * ⚠️ `ENTREGAR` y `ESTADO_ENTREGA` sí son únicos, y por eso sí llevan
 * `data-accion`/`data-estado`, con la convención del pie de la app (el renglón
 * lleva el mismo valor que su acción).
 */
export const SELECTOR = Object.freeze({
  BLOQUE: '[data-sobrante="bloque"]',
  CONTADOR: '[data-sobrante="contador"]',
  LISTA: '[data-sobrante="lista"]',
  FILA: '[data-sobrante="fila"]',
  INCLUIR: '[data-sobrante="incluir"]',
  NOMBRE: '[data-sobrante="nombre"]',
  MEDIDAS: '[data-sobrante="medidas"]',
  ESTRECHA: '[data-sobrante="estrecha"]',
  /** La marca de la pieza que NO sobrevive al fichero (F23, 2026-08-10). */
  NO_EMITIBLE: '[data-sobrante="no-emitible"]',
  NOTA: '[data-sobrante="nota"]',
  VACIO: '[data-sobrante="vacio"]',
  ENTREGAR: '[data-accion="entregar-expediente"]',
  ESTADO_ENTREGA: '[data-estado="entregar-expediente"]',
  // ── Lo que se SALE del contorno oficial ────────────────────────────────────
  FUERA: '[data-sobrante="fuera"]',
  FUERA_ROTULO: '[data-sobrante="fuera-rotulo"]',
  FUERA_LISTA: '[data-sobrante="fuera-lista"]',
  FUERA_FILA: '[data-sobrante="fuera-fila"]',
  /** El desplegable de DESTINO de una pieza del sobrante (F23). */
  DESTINO: '[data-sobrante="destino"]',
})

/**
 * El valor del destino «finca nueva», que es el defecto.
 *
 * Va como cadena y no como `''` para que un desplegable sin elegir y uno elegido a
 * «finca nueva» no se lean igual: el primero sería un fallo del pintado.
 */
export const DESTINO_ALTA = 'ALTA'

// ── Números: cuántas filas caben y cuánto mide una ───────────────────────────

/**
 * Cuántas filas se ven sin scroll. **Es un presupuesto medido, no un gusto**: ver
 * el bloque de la cabecera. Cambiar este número mueve la tabla de vértices, y
 * quien lo toque tiene que rehacer la resta contra los 267,44 px.
 */
export const FILAS_VISIBLES = 4

/**
 * Alto de una fila, en píxeles, para calcular el tope de la caja que scrollea.
 *
 * ⛔ **26 px, MEDIDOS SOBRE ESTA LISTA en Chrome el 2026-08-05** por el guion 16.
 * La revisión de diseño publicó **31,00** y ese número no era de aquí: salía de
 * una maqueta escrita antes que el componente. Con 31 el tope quedaba en 124 px y
 * enseñaba **4,77 filas** en vez de 4 — no un defecto (ninguna pieza desaparece y
 * el contador dice cuántas hay), pero **20 px de panel cobrados de más**, y el
 * panel es justo lo que F17 está gastando a propósito.
 *
 * La aritmética de la fila escrita, con los tokens del proyecto, cuadra con lo
 * medido y no con la maqueta:
 *
 *     campo de nombre .... 12 px × 1,45 + 2×2 de relleno + 2×1 de borde = 23,40 px
 *     relleno de la fila . 2 × 3 px ......................................  6,00 px
 *     separador .......... 1 px de `border-top` .........................  1,00 px
 *     TOTAL ............................................................. 30,40 px
 *
 * (Los 4,4 px de diferencia con lo medido son que la fila NO gasta el
 * `line-height` de 1,45 completo: el `<input>` fija su propia caja.)
 *
 * ⚠️ Quien toque el relleno, el tamaño de letra o el borde de `.gml-entrada`
 * mueve este número, y el guion 16 lo dirá con una advertencia. **El que manda es
 * el que mide el navegador**, no el de esta constante.
 */
export const ALTO_FILA_PX = 26

// ── Textos ───────────────────────────────────────────────────────────────────

/**
 * Lo que se lee cuando la derivación no ha encontrado ni una pieza. **No es un
 * hueco ni un guion**: que no haya sobrante es un resultado legítimo y frecuente
 * (la parcela no menguó, o menguó por debajo del redondeo), y una caja vacía se
 * lee como «esto no ha cargado».
 */
export const SIN_PIEZAS =
  'La derivación no ha encontrado sobrante: la geometría medida cubre el contorno oficial ' +
  'entero. No hay ninguna finca que segregar.'

/**
 * Por qué el botón nace apagado. Se escribe en el renglón **en el mismo instante**
 * en que se apaga, porque un botón gris y mudo es un error silencioso (regla de
 * oro 1): desde fuera no se distingue de uno roto.
 */
export const MOTIVO_SIN_DERIVAR =
  'Todavía no se ha derivado ningún sobrante. Pulsa «Derivar sobrante» en el pie del panel.'

/**
 * Y por qué se apaga cuando el usuario desmarca las N piezas. **No se descarta la
 * decisión ni se vuelve a marcar nada**: excluirlas todas es legítimo (puede que
 * ninguna sea una finca), pero entonces lo que hay que entregar no es un
 * expediente de varias parcelas — es el GML de una, que ya sabe hacer «Generar
 * GML» del pie. Decirlo es la diferencia entre un botón apagado y un botón muerto.
 */
export const MOTIVO_NINGUNA_INCLUIDA =
  'No hay ninguna pieza incluida, así que no hay expediente de varias parcelas que entregar. ' +
  'Marca al menos una, o usa «Generar GML» para entregar solo la parcela.'

/** El mensaje de la invalidación de 3C, cuando el llamante no da uno propio. */
export const MOTIVO_FOTO_CADUCA =
  'La parcela ha cambiado, así que el sobrante que había en esta lista ya no le corresponde. ' +
  'Los nombres escritos se han perdido: vuelve a derivar.'

/** Marca de la pieza que cae por debajo del umbral de grosor. */
export const ROTULO_ESTRECHA = 'estrecha'

/**
 * Marca de la pieza que NO se puede escribir en el fichero.
 *
 * ⛔ **Es una marca distinta de {@link ROTULO_ESTRECHA} y tiene que serlo.**
 * «Estrecha» invita a decidir —la casilla sigue viva y el `title` dice que decidirlo
 * es de quien firma—; ésta dice que no hay nada que decidir, porque la pieza deja de
 * encerrar superficie al redondearla a los 2 decimales del fichero. Enseñarlas con
 * la misma palabra habría dejado al usuario marcando una casilla que no podía
 * funcionar, que es como se perdió una tarde el 2026-08-10.
 */
export const ROTULO_NO_EMITIBLE = 'no se puede emitir'

/** El rótulo de la sección de lo que se sale del contorno oficial. */
export const ROTULO_FUERA = 'Fuera del contorno oficial'

/**
 * Lo que se lee bajo ese rótulo, y es la frase que esta fase existe para poder
 * escribir.
 *
 * ⛔ **Hasta hoy este bloque NO se enseñaba.** Cuando la geometría medida se salía
 * por algún sitio, `app/cableado-derivacion.js` escondía la lista entera y el
 * sobrante —que estaba medido, correcto y era de la misma foto— se tiraba sin que
 * el usuario lo viera nunca. Y el caso no es raro: rectificar un lindero es
 * retranquearse por un lado y salirse por otro, medido sobre el expediente real
 * `29050A01000144` (36,46 m² de sobrante y 25,49 m² de exceso a la vez).
 *
 * Lo que sigue siendo cierto es que **no se puede ENTREGAR** así: esos metros son
 * de un colindante, y un expediente sin él vuelve con IVG negativo. Por eso lo que
 * se separa es VER de ENTREGAR, y no se levanta la puerta.
 *
 * No lleva cifras dentro: las cifras van en las filas, junto al trozo que
 * describen, que es donde se pueden auditar.
 */
export const NOTA_FUERA =
  'Estos trozos de la geometría medida caen fuera de la parcela oficial. Los que caen sobre un ' +
  'colindante se le recortan a él, y su parcela entra en el expediente; los que no caen sobre ' +
  'ninguna (un vial, o un hueco del parcelario) se declaran tal cual.'

/**
 * Formato de una superficie y de una longitud. Local a este módulo, como el
 * `FORMATO_LONGITUD` de `viewer/acotaciones.js` y por lo mismo: la capa de vista
 * formatea lo suyo y no importa el formateador de otra capa para un `Intl`.
 */
const FORMATO_AREA = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * El grosor va con CUATRO decimales y la superficie con dos, y no es un descuido.
 * Está medido en F17: una astilla de residuo puede tener 0,0007 m de grosor, y con
 * dos decimales el renglón diría «0,00 m» — o sea, «no mide nada», que es
 * exactamente la lectura tranquilizadora y falsa que la regla de oro 1 prohíbe.
 */
const FORMATO_GROSOR = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 4,
  maximumFractionDigits: 4,
})

/**
 * Las dos cifras de una pieza, en un solo renglón. Exportada para que los tests
 * comparen contra ESTA función y no contra una copia del formato.
 *
 * Van juntas y no en dos columnas porque el panel mide ~344 px útiles y una
 * columna más dejaría el campo del nombre sin sitio; y van EN ESTE ORDEN porque la
 * superficie es lo que el usuario busca y el grosor lo que le explica por qué esa
 * pieza lleva la marca de estrecha.
 *
 * @param {{area:number, grosor:number}} pieza
 * @returns {string}  P. ej. `'12,40 m² · 0,4231 m'`.
 */
export function textoMedidas(pieza) {
  const area = Number.isFinite(pieza && pieza.area) ? pieza.area : NaN
  const grosor = Number.isFinite(pieza && pieza.grosor) ? pieza.grosor : NaN
  const textoArea = Number.isFinite(area) ? `${FORMATO_AREA.format(area)} m²` : 'sin medir'
  const textoGrosor = Number.isFinite(grosor) ? `${FORMATO_GROSOR.format(grosor)} m` : 'sin medir'
  return `${textoArea} · ${textoGrosor}`
}

/**
 * El contador. **Deja de ser adorno en cuanto la lista tiene más de cuatro
 * piezas**: se ven 4 y el contador dice 8, así que nada desaparece en silencio
 * aunque no quepa.
 *
 * @param {number} incluidas
 * @param {number} total
 * @returns {string}
 */
export function textoContador(incluidas, total) {
  if (total === 0) return 'No hay piezas que emitir.'
  const cuantas = total === 1 ? '1 pieza' : `${total} piezas`
  return `Se emitirán ${incluidas} de ${cuantas}, más la parcela.`
}

// ── Estilos en línea (ver la cabecera: este módulo no importa CSS) ───────────

/**
 * ⚠️ **El hueco entre las partes del bloque son 4 px y no 8, y el número lo
 * decidió una medición**, no el gusto. Con 8 px el bloque medía 133,33 px y a
 * 1280×720 —el viewport MÍNIMO declarado del proyecto— dejaba la tabla de
 * vértices en **119,14 px**: la cabecera, la fila del recinto y **dos** vértices
 * de los quince. El suelo que este proyecto se exige son TRES (124,57 px,
 * derivados de lo que miden esas filas), y los 8 px que faltaban estaban justo
 * aquí. Medido por el guion 16 el 2026-08-05.
 *
 * `--space-1` (4 px) es vocabulario del proyecto y esta columna ya es densa
 * —12 px de cuerpo—, así que el bloque no queda apretado: queda como el resto del
 * panel. Quien lo suba tiene que rehacer la resta a 1280×720, no solo mirarlo a
 * 1440.
 */
const ESTILO_BLOQUE = Object.freeze({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minHeight: '0',
})

const ESTILO_LISTA = Object.freeze({
  margin: '0',
  padding: '0',
  listStyle: 'none',
  // El tope de D1 y su scroll. `overscrollBehavior:'contain'` para que la rueda al
  // final de la lista no acabe haciendo scroll en la aplicación, igual que
  // `.gml-partes`.
  maxHeight: `${FILAS_VISIBLES * ALTO_FILA_PX}px`,
  overflowY: 'auto',
  overscrollBehavior: 'contain',
})

const ESTILO_FILA = Object.freeze({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  padding: '3px 0',
  fontSize: '12px',
})

const ESTILO_NUMERO = Object.freeze({
  flex: 'none',
  minWidth: '1.2em',
  fontWeight: '700',
  fontVariantNumeric: 'tabular-nums',
})

const ESTILO_NOMBRE = Object.freeze({
  flex: '1 1 auto',
  // `minWidth:0` es lo que le deja encoger dentro del flex: sin él, el ancho de su
  // contenido es un suelo duro y la fila desbordaría el panel, que es
  // `overflow:hidden` — o sea, se RECORTARÍA EN SILENCIO.
  minWidth: '0',
  fontSize: '12px',
  padding: '2px 4px',
})

const ESTILO_MEDIDAS = Object.freeze({
  flex: 'none',
  fontSize: '11px',
  fontVariantNumeric: 'tabular-nums',
  whiteSpace: 'nowrap',
})

const ESTILO_NOTA = Object.freeze({ margin: '0', fontSize: '11px' })

// ── Helpers de módulo ────────────────────────────────────────────────────────

/** Describe un valor para un mensaje de contrato roto. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return 'un array'
  return typeof valor
}

/**
 * Asigna estilos propiedad a propiedad. `cssText` PISA lo previo; esto no. Mismo
 * helper, y por el mismo motivo, que en `viewer/cajon-diagnostico.js`.
 *
 * @param {HTMLElement} el
 * @param {Record<string,string>} estilos
 * @returns {HTMLElement}
 */
function estilar(el, estilos) {
  for (const [propiedad, valor] of Object.entries(estilos)) el.style[propiedad] = valor
  return el
}

// ── API ──────────────────────────────────────────────────────────────────────

/**
 * @typedef {import('../derivacion/cesion.js').PiezaSobrante} PiezaSobrante
 * @typedef {import('../derivacion/cesion.js').Cesion} Cesion
 */

/**
 * @typedef {Object} ListaSobrante
 * @property {HTMLElement} nodo  El bloque entero, listo para colgar de la sección
 *   anfitriona. Ya nace con su rótulo, su lista, su nota y su botón.
 * @property {(cesion: Cesion|null) => void} pintar  Pinta una FOTO. `null` vacía.
 * @property {(motivo?: string) => void} invalidar  La parcela ha cambiado: vacía y
 *   lo DICE, en el propio bloque (decisión 3C).
 * @property {() => PiezaSobrante[]} piezas  Las piezas de la foto pintada.
 * @property {() => number[]} seleccionadas  Los `orden` marcados, en orden.
 * @property {() => Object<number,string>} nombres  `{orden: 'texto'}`, solo los no
 *   vacíos. Es lo que come `derivacion/entrega.js#prepararEntrega`.
 * @property {(orden: number|null) => void} resaltar  Resalta una fila. La otra
 *   mitad de {@link alSenalar}: quien las une es el cableado.
 * @property {(opciones: {habilitado: boolean, motivo?: string}) => void} entrega
 *   Enciende o apaga el botón, **con el motivo escrito**.
 * @property {(texto: string, opciones?: {error?: boolean}) => void} estado  El
 *   renglón del botón: el acuse de la descarga, o el fallo.
 * @property {(fn: (seleccionadas: number[]) => void) => (() => void)} alCambiarSeleccion
 * @property {(fn: (orden: number, nombre: string) => void) => (() => void)} alNombrar
 * @property {(fn: (orden: number|null) => void) => (() => void)} alSenalar
 * @property {(fn: () => void) => (() => void)} alEntregar
 * @property {() => void} destruir
 */

/**
 * Crea el bloque del sobrante.
 *
 * ```js
 * const lista = crearListaSobrante({ documento: document, alAvisar })
 * seccionAnfitriona.append(lista.nodo)
 * lista.pintar(derivarCesion({ recintos, geometriaOficial }))
 * lista.seleccionadas()   // [1, 2, 3]
 * ```
 *
 * ⚠️ **No trae `alDerivar`, y el contrato del plan sí lo declaraba.** El CTA
 * «Derivar sobrante» bajó al PIE del panel (decisión de diseño D2: un bloque vacío
 * permanente cobraría 96,63 px en el 100 % de las sesiones para una función que se
 * usa en una fracción), así que ese botón lo pone `index.html` y lo cablea
 * `app/cableado-derivacion.js` directamente. Lo que sí vive aquí es
 * {@link ListaSobrante.alEntregar}, que es la acción que CONSUME la lista — el
 * mismo criterio con el que F08 metió «Descargar informe de contraste» dentro del
 * cajón de F07 en vez de poner un tercer botón en el pie.
 *
 * @param {object} [args]
 * @param {Document} [args.documento]  Por defecto el global. Explícito para poder
 *   montarlo en un documento de prueba, igual que `app/dialogo-informe.js`.
 * @param {import('./_comun.js').Avisar} [args.alAvisar]  Canal de aviso.
 * @returns {ListaSobrante}
 * @throws {TypeError} Contrato del programador.
 */
export function crearListaSobrante({ documento, alAvisar } = {}) {
  const doc = documento === undefined || documento === null ? globalThis.document : documento
  if (!doc || typeof doc.createElement !== 'function') {
    throw new TypeError(
      `crearListaSobrante: 'documento' debe ser un Document (con createElement); recibido ` +
        `${describir(documento)}.`,
    )
  }
  const avisar = resolverAvisar(alAvisar)

  // ── Estado interno ────────────────────────────────────────────────────────
  let vivo = true
  /** @type {PiezaSobrante[]} */
  let piezasPintadas = []
  /** `orden` → `{fila, casilla, campo}` de la foto actual. */
  const filasPorOrden = new Map()
  /** @type {Set<Function>} */
  const oyentesSeleccion = new Set()
  /** @type {Set<Function>} */
  const oyentesNombre = new Set()
  /** @type {Set<Function>} */
  const oyentesSenal = new Set()
  /** @type {Set<Function>} */
  const oyentesEntrega = new Set()

  /**
   * Notifica a un juego de oyentes aislando los fallos: uno que reviente no puede
   * tumbar a los demás ni dejar la vista a medias (mismo criterio que
   * `crearEstadoVista`). Pero no se traga: sale por el canal de avisos.
   */
  function emitir(oyentes, que, ...args) {
    for (const fn of oyentes) {
      try {
        fn(...args)
      } catch (causa) {
        avisar(`Un oyente de «${que}» del sobrante ha fallado; la lista sigue funcionando.`, {
          nivel: NIVEL.AVISO,
          causa,
        })
      }
    }
  }

  // ── Los nodos ─────────────────────────────────────────────────────────────

  const bloque = doc.createElement('div')
  bloque.dataset.sobrante = 'bloque'
  estilar(bloque, ESTILO_BLOQUE)

  const filaRotulo = doc.createElement('div')
  filaRotulo.className = 'gml-rotulo-fila'
  const rotulo = doc.createElement('h2')
  rotulo.className = 'gml-rotulo'
  rotulo.textContent = 'Sobrante'
  const contador = doc.createElement('span')
  contador.dataset.sobrante = 'contador'
  // `role="status"` como el resto de renglones vivos de la aplicación: el lector
  // de pantalla anuncia el recuento al marcar y desmarcar **sin robar el foco**,
  // que es exactamente lo que hace falta cuando el foco está en la casilla.
  contador.setAttribute('role', 'status')
  filaRotulo.append(rotulo, contador)

  const nota = doc.createElement('p')
  nota.dataset.sobrante = 'nota'
  estilar(nota, ESTILO_NOTA)

  const lista = doc.createElement('ul')
  lista.dataset.sobrante = 'lista'
  estilar(lista, ESTILO_LISTA)

  const vacio = doc.createElement('p')
  vacio.dataset.sobrante = 'vacio'
  estilar(vacio, ESTILO_NOTA)

  // ── La sección de lo que se SALE, que nace escondida ──────────────────────
  // ⚠️ **Cuesta CERO píxeles en el caso normal**, y no es un detalle menor en esta
  // pantalla: el panel mide ~344 px útiles y cada renglón que se añade se lo quita
  // a la tabla de vértices (medido por el guion 16 en la fase 4 de F17). Esta
  // sección sólo aparece cuando hay exceso — que es exactamente el caso en el que
  // hasta hoy no se veía NADA, así que no le quita sitio a nada que existiera.
  const fuera = doc.createElement('div')
  fuera.dataset.sobrante = 'fuera'
  fuera.hidden = true

  const fueraFilaRotulo = doc.createElement('div')
  fueraFilaRotulo.className = 'gml-rotulo-fila'
  const fueraRotulo = doc.createElement('h2')
  fueraRotulo.className = 'gml-rotulo'
  fueraRotulo.textContent = ROTULO_FUERA
  const fueraContador = doc.createElement('span')
  fueraContador.dataset.sobrante = 'fuera-rotulo'
  fueraContador.setAttribute('role', 'status')
  fueraFilaRotulo.append(fueraRotulo, fueraContador)

  const fueraLista = doc.createElement('ul')
  fueraLista.dataset.sobrante = 'fuera-lista'
  estilar(fueraLista, ESTILO_LISTA)

  const fueraNota = doc.createElement('p')
  estilar(fueraNota, ESTILO_NOTA)
  fueraNota.textContent = NOTA_FUERA

  fuera.append(fueraFilaRotulo, fueraLista, fueraNota)

  const boton = doc.createElement('button')
  boton.type = 'button'
  boton.className = 'gml-boton gml-boton--primario'
  boton.dataset.accion = 'entregar-expediente'
  boton.textContent = 'Descargar expediente'
  boton.disabled = true

  const renglon = doc.createElement('p')
  renglon.className = 'gml-accion-estado'
  renglon.dataset.estado = 'entregar-expediente'
  renglon.setAttribute('role', 'status')
  // El botón APUNTA a su renglón: quien llegue al botón con un lector de pantalla
  // oye por qué está apagado sin tener que buscarlo. Es lo mismo que hacen los dos
  // botones del pie del cajón de diagnóstico.
  renglon.id = 'gml-estado-entregar-expediente'
  boton.setAttribute('aria-describedby', renglon.id)

  // El exceso va DESPUÉS de la lista del sobrante y ANTES del botón: se lee de
  // arriba abajo como «esto sueltas · esto invades · esto puedes hacer», y así el
  // motivo por el que el botón está apagado queda justo encima del botón.
  bloque.append(filaRotulo, nota, lista, vacio, fuera, boton, renglon)

  // ── Pintado ───────────────────────────────────────────────────────────────

  /** El destino elegido para una pieza, o {@link DESTINO_ALTA} si no hay desplegable. */
  function destinoDe(entrada) {
    const sel = entrada.fila.querySelector(SELECTOR.DESTINO)
    return sel === null ? DESTINO_ALTA : sel.value
  }

  /**
   * Los `orden` que entran como PARCELA PROPIA del expediente.
   *
   * ⛔ Una pieza asignada a un colindante **no está aquí**, y no es una omisión: esa
   * superficie se funde con la parcela del vecino y viaja dentro de ella. Contarla
   * además como miembro suelto la metería DOS veces en el fichero, el conjunto
   * saldría con solape y el IVG lo devolvería.
   */
  function seleccionadas() {
    const marcadas = []
    for (const pieza of piezasPintadas) {
      // ⛔ Una pieza que no sobrevive al fichero NUNCA es un alta, marque el usuario
      // lo que marque: escrita con 2 decimales deja de encerrar superficie y el
      // serializador se niega a emitir el documento ENTERO. Lo que sí puede es pasar
      // a un colindante —al fundirse con su parcela deja de ser un recinto propio—,
      // y eso viaja por `asignaciones()`, no por aquí.
      if (pieza.emitible === false) continue
      const entrada = filasPorOrden.get(pieza.orden)
      if (entrada && entrada.casilla.checked && destinoDe(entrada) === DESTINO_ALTA) {
        marcadas.push(pieza.orden)
      }
    }
    return marcadas
  }

  /**
   * Lo que el usuario ha decidido repartir: `{orden: refcat}`.
   *
   * Solo las piezas MARCADAS: desmarcar es sacarla del expediente entero, y una
   * pieza fuera no se le da a nadie.
   */
  function asignaciones() {
    /** @type {Object<number,string>} */
    const reparto = {}
    for (const pieza of piezasPintadas) {
      const entrada = filasPorOrden.get(pieza.orden)
      if (!entrada || !entrada.casilla.checked) continue
      const destino = destinoDe(entrada)
      if (destino !== DESTINO_ALTA && destino !== '') reparto[pieza.orden] = destino
    }
    return reparto
  }

  /** Los nombres escritos, sin los vacíos. */
  function nombres() {
    /** @type {Object<number,string>} */
    const escritos = {}
    for (const [orden, entrada] of filasPorOrden) {
      const texto = entrada.campo.value.trim()
      if (texto !== '') escritos[orden] = texto
    }
    return escritos
  }

  /** Reescribe el contador. No decide nada más: encender el botón es del cableado. */
  function repintarContador() {
    contador.textContent = textoContador(seleccionadas().length, piezasPintadas.length)
  }

  /**
   * Fabrica la fila de un trozo que se SALE del contorno oficial.
   *
   * ⛔ **Sin casilla y sin campo de nombre, y es la diferencia que importa.** Una
   * pieza del sobrante es una finca que puedes incluir, excluir y bautizar; un
   * trozo de fuera **no es tuyo**: es terreno de un colindante, y ofrecer sobre él
   * los mismos controles diría que se puede entregar. Aquí solo se mide y se
   * enseña — que es justo lo que hasta hoy no se hacía.
   *
   * @param {{orden:number, area:number, grosor:number}} pieza
   * @param {number} indice  Posición en SU lista, para el filete separador.
   */
  function crearFilaFuera(pieza, indice, atribucion) {
    const fila = doc.createElement('li')
    fila.dataset.sobrante = 'fuera-fila'
    fila.dataset.orden = String(pieza.orden)
    estilar(fila, ESTILO_FILA)
    if (indice > 0) fila.style.borderTop = '1px solid rgba(100,116,139,.28)'

    const numero = doc.createElement('span')
    // El MISMO rótulo que la mancha ámbar del mapa: `F1`, `F2`… Ver `_comun.js`.
    numero.textContent = textoNumeroPieza(pieza.orden, PREFIJO_FUERA)
    estilar(numero, ESTILO_NUMERO)

    const medidas = doc.createElement('span')
    medidas.className = 'gml-mono'
    medidas.dataset.sobrante = 'medidas'
    medidas.textContent = textoMedidas(pieza)
    estilar(medidas, ESTILO_MEDIDAS)

    // El hueco flexible va en medio para que las medidas queden alineadas a la
    // derecha igual que en las filas del sobrante, sin repetir su maquetación: allí
    // ese papel lo hace el campo de nombre, que aquí no existe.
    const hueco = doc.createElement('span')
    estilar(hueco, { flex: '1 1 auto' })

    fila.append(numero, hueco, medidas)

    // ── SOBRE QUIÉN CAE ───────────────────────────────────────────────────────
    // Es el dato que convierte «te sales 25,49 m²» en algo accionable: sin él, el
    // usuario ve una cifra y no sabe a quién tiene que ir a buscar. Va en un
    // segundo renglón porque el primero ya lleva número y medidas y el panel mide
    // ~344 px; y **solo aparece si se ha consultado**, porque no haberlo preguntado
    // y no caer sobre nadie son cosas opuestas.
    if (atribucion !== null && atribucion !== undefined) {
      const dueños = doc.createElement('span')
      dueños.dataset.sobrante = 'fuera-sobre'
      estilar(dueños, { flex: '1 1 100%', fontSize: '11px', paddingLeft: '2px' })
      const trozos = atribucion.porVecino.map(
        (v) => `${v.refcat ?? 'parcela sin referencia'} (${FORMATO_AREA.format(v.area)} m²)`,
      )
      if (atribucion.sobreNadie > 0.005) {
        // ⚠️ **No se llama «vial» aquí.** Que no solape ninguna colindante es lo
        // MEDIDO; que sea un vial, dominio público o un hueco del parcelario es una
        // interpretación, y este proyecto no dictamina (regla de oro 9). El aviso
        // de `derivacion/vecino.js` sí enumera las tres posibilidades, con su
        // superficie, que es donde cabe explicarlo.
        // ⚠️ Con la MISMA forma que las demás entradas —«quién (cuánto)»— porque
        // todas se concatenan detrás de un solo «sobre». La primera versión decía
        // «56,37 m² sobre ninguna parcela» y salía «sobre 56,37 m² sobre ninguna
        // parcela»: lo cazó el guion 25 en su primera corrida, no la suite.
        trozos.push(`ninguna parcela (${FORMATO_AREA.format(atribucion.sobreNadie)} m²)`)
      }
      dueños.textContent = trozos.length === 0 ? '' : `sobre ${trozos.join(' · ')}`
      if (dueños.textContent !== '') fila.append(dueños)
    }

    return fila
  }

  /**
   * Pinta la sección del exceso a partir de la PUERTA de la cesión.
   *
   * Se alimenta de `cesion.puerta.piezas`, que ya viene medida, ordenada y
   * renumerada 1…M por `derivacion/cesion.js`. Esta vista **no calcula nada**.
   *
   * @param {{contenida: boolean|null, piezas: Array, area: number}|null} puerta
   */
  function pintarFuera(puerta, recorte = null) {
    fueraLista.replaceChildren()
    const piezas =
      puerta !== null && puerta !== undefined && Array.isArray(puerta.piezas) ? puerta.piezas : []
    // La atribución, indexada por el `orden` del trozo. `null` si no se han
    // consultado las colindantes: entonces las filas no dicen sobre quién caen, que
    // es la verdad, en vez de decir «sobre nadie», que sería lo tranquilizador.
    const porOrden =
      recorte !== null && recorte !== undefined && recorte.consultado === true
        ? new Map(recorte.atribucion.map((a) => [a.orden, a]))
        : null

    // `contenida === null` (no se ha podido medir) NO enseña sección: no hay nada
    // que enseñar, y una sección vacía con su rótulo se leería como «no hay
    // exceso», que es la lectura tranquilizadora y falsa de siempre. Quien lo dice
    // en ese caso es el renglón del pie, con su motivo.
    if (piezas.length === 0) {
      fuera.hidden = true
      fueraContador.textContent = ''
      return
    }

    piezas.forEach((pieza, i) =>
      fueraLista.append(
        crearFilaFuera(pieza, i, porOrden === null ? null : (porOrden.get(pieza.orden) ?? null)),
      ),
    )
    const total = piezas.reduce((s, p) => s + (Number.isFinite(p.area) ? p.area : 0), 0)
    fueraContador.textContent =
      `${piezas.length} ${piezas.length === 1 ? 'trozo' : 'trozos'} · ` +
      `${FORMATO_AREA.format(total)} m²`
    fuera.hidden = false
  }

  /** Fabrica la fila de una pieza. `candidatos` son los refcat con los que LINDA. */
  function crearFila(pieza, candidatos = []) {
    const fila = doc.createElement('li')
    fila.dataset.sobrante = 'fila'
    fila.dataset.orden = String(pieza.orden)
    estilar(fila, ESTILO_FILA)
    if (piezasPintadas.length > 0) fila.style.borderTop = '1px solid rgba(100,116,139,.28)'

    // La casilla y el número van dentro de UNA etiqueta: así el número es zona
    // pulsable de la casilla (que mide 14 px y es el objetivo más pequeño de la
    // pantalla) y el lector de pantalla lee los dos como un solo control.
    const etiqueta = doc.createElement('label')
    estilar(etiqueta, { display: 'flex', alignItems: 'center', gap: '4px', flex: 'none' })

    const casilla = doc.createElement('input')
    casilla.type = 'checkbox'
    casilla.dataset.sobrante = 'incluir'
    casilla.dataset.orden = String(pieza.orden)
    casilla.checked = true
    // ⛔ NOMBRE ACCESIBLE EXPLÍCITO, y no vale confiar en la etiqueta: dentro de
    // ella el texto es el NÚMERO, así que un lector de pantalla diría «casilla,
    // 1», «casilla, 2»… sin decir nunca de qué. Era el hueco mayor que la revisión
    // de diseño dejó abierto.
    casilla.setAttribute('aria-label', `Incluir la pieza ${pieza.orden} en el expediente`)

    const numero = doc.createElement('span')
    // Por `textoNumeroPieza` y no por `String(orden)`: es la MISMA función que
    // rotula la mancha del mapa (`viewer/_comun.js`), y pasar los dos por ella es
    // lo que impide que un cambio de formato deje una de las dos vistas hablando
    // otro idioma. Hoy las dos dan «1»; el valor está en que sigan dándolo.
    numero.textContent = textoNumeroPieza(pieza.orden)
    estilar(numero, ESTILO_NUMERO)
    etiqueta.append(casilla, numero)

    const campo = doc.createElement('input')
    campo.type = 'text'
    campo.className = 'gml-entrada'
    campo.dataset.sobrante = 'nombre'
    campo.dataset.orden = String(pieza.orden)
    campo.placeholder = 'Sin nombre'
    campo.setAttribute('aria-label', `Nombre de la pieza ${pieza.orden}`)
    estilar(campo, ESTILO_NOMBRE)

    const medidas = doc.createElement('span')
    medidas.className = 'gml-mono'
    medidas.dataset.sobrante = 'medidas'
    medidas.textContent = textoMedidas(pieza)
    estilar(medidas, ESTILO_MEDIDAS)

    fila.append(etiqueta, campo, medidas)

    // ── EL DESTINO (F23) ─────────────────────────────────────────────────────
    // Solo aparece si el trozo LINDA con alguna colindante. Sin candidatos no hay
    // nada que preguntar —solo puede ser finca nueva— y un desplegable de una sola
    // opción es un control que no decide nada ocupando una fila que el panel no
    // tiene: ~344 px útiles, medidos.
    //
    // ⛔ La lista de candidatos NO es «todas las colindantes»: la calcula
    // `derivacion/vecino.js` UNIENDO, y deja fuera a las que solo tocan en un punto.
    // Medido sobre el expediente real: `…146` está a 0,000000 m del trozo y aun así
    // no linda con él. Ofrecerla habría dejado crear una finca unida por un vértice.
    if (candidatos.length > 0) {
      const destino = doc.createElement('select')
      destino.dataset.sobrante = 'destino'
      destino.dataset.orden = String(pieza.orden)
      destino.setAttribute('aria-label', `Destino de la pieza ${pieza.orden}`)
      estilar(destino, { flex: '1 1 100%', fontSize: '11px', marginTop: '2px' })

      const alta = doc.createElement('option')
      alta.value = DESTINO_ALTA
      alta.textContent = 'Finca nueva (alta)'
      destino.append(alta)

      for (const rc of candidatos) {
        const opcion = doc.createElement('option')
        opcion.value = rc ?? ''
        opcion.textContent = `Pasa a ${rc ?? 'la parcela sin referencia'}`
        destino.append(opcion)
      }
      destino.value = DESTINO_ALTA

      destino.addEventListener('change', () => {
        // El nombre solo tiene sentido para un alta: una finca que pasa al vecino se
        // funde con la suya y no se bautiza. Se apaga el campo en vez de esconderlo
        // para que la fila no cambie de alto al elegir.
        campo.disabled = destino.value !== DESTINO_ALTA
        // ⛔ **Y SE REPINTA EL CONTADOR, igual que en la casilla** (auditoría
        // 2026-08-16). Elegir destino cambia la SELECCIÓN EFECTIVA tanto como
        // desmarcar: `seleccionadas()` deja fuera lo que va a un colindante (viaja
        // dentro de la parcela del vecino, no como miembro suelto). Sin esta línea
        // el cableado refrescaba el botón de entrega pero el renglón seguía
        // diciendo «Se emitirán 2 de 2 piezas» hasta que se tocara cualquier
        // casilla — **una cifra sobre la que se firma**, y de más.
        // La regla, para que no vuelva a faltar: *todo camino que pueda cambiar lo
        // que devuelve `seleccionadas()` repinta el contador ANTES de emitir*. Hoy
        // son exactamente tres —esta, el `change` de la casilla y `pintar`— y no
        // hay ninguna API pública que toque casilla o destino desde fuera.
        repintarContador()
        emitir(oyentesSeleccion, 'destino', seleccionadas())
      })

      fila.append(destino)
    }

    // ── LA QUE NO SE PUEDE EMITIR ────────────────────────────────────────────
    // Nace DESMARCADA, y la casilla solo sigue viva si el trozo linda con alguien:
    // dársela a un colindante sí funciona (se funde con su parcela y deja de ser un
    // recinto propio), quedársela como finca no. Sin candidatos no hay nada que la
    // casilla pueda hacer, así que se apaga en vez de quedarse como un control que
    // no cambia nada.
    if (pieza.emitible === false) {
      casilla.checked = false
      casilla.disabled = candidatos.length === 0
      campo.disabled = true
      const marca = doc.createElement('span')
      marca.dataset.sobrante = 'no-emitible'
      marca.textContent = ROTULO_NO_EMITIBLE
      marca.title =
        'Escrita con los 2 decimales del fichero, esta pieza deja de encerrar superficie: sus ' +
        'dos bordes caen sobre las mismas coordenadas y no hay punto de referencia que ' +
        'declarar. Es la astilla que queda al enganchar tu medición al lindero oficial, no ' +
        'terreno. Puede pasar a una colindante, pero no ser una finca.'
      estilar(marca, { flex: 'none', fontSize: '11px', fontStyle: 'italic' })
      fila.append(marca)
    }

    if (pieza.estrecha === true) {
      // ⚠️ **La marca es la PALABRA, no un emoji.** El vocabulario de aviso de este
      // proyecto es el rótulo «Aviso» de `app/avisos.js`, no un símbolo suelto; y
      // un carácter de advertencia lo leería un lector de pantalla como «signo de
      // exclamación» o como nada, según la plataforma. La palabra se lee igual con
      // los ojos y con el oído, y **no dictamina** (regla de oro 9): dice que es
      // estrecha, no que sobre.
      const estrecha = doc.createElement('span')
      estrecha.dataset.sobrante = 'estrecha'
      estrecha.textContent = ROTULO_ESTRECHA
      estrecha.title =
        'Su grosor está por debajo del umbral con el que este proyecto distingue una astilla ' +
        'de redondeo de una finca. Se lista con sus cifras y NO se descarta: decidirlo es de ' +
        'quien firma.'
      estilar(estrecha, { flex: 'none', fontSize: '11px', fontStyle: 'italic' })
      fila.append(estrecha)
    }

    casilla.addEventListener('change', () => {
      repintarContador()
      emitir(oyentesSeleccion, 'incluir/excluir', seleccionadas())
    })
    campo.addEventListener('input', () => {
      emitir(oyentesNombre, 'nombrar', pieza.orden, campo.value.trim())
    })
    // El resaltado recíproco. `mouseenter`/`mouseleave` y no `mouseover`/`mouseout`
    // porque estos últimos vuelven a dispararse al pasar de un hijo a otro dentro
    // de la misma fila (del campo a la cifra), y el resaltado parpadearía.
    fila.addEventListener('mouseenter', () => {
      resaltar(pieza.orden)
      emitir(oyentesSenal, 'señalar', pieza.orden)
    })
    fila.addEventListener('mouseleave', () => {
      resaltar(null)
      emitir(oyentesSenal, 'señalar', null)
    })
    // Y por teclado: quien recorre la lista con el tabulador tiene el mismo
    // derecho a saber qué mancha está tocando que quien usa el ratón.
    for (const control of [casilla, campo]) {
      control.addEventListener('focus', () => {
        resaltar(pieza.orden)
        emitir(oyentesSenal, 'señalar', pieza.orden)
      })
    }
    // ⛔ **Y APAGARLO AL SALIR** (auditoría V4, 2026-08-16). El resaltado por
    // teclado tenía ida y no vuelta: encendía la fila y su mancha en el mapa, y
    // nada las apagaba. Quien tabulaba fuera del bloque se dejaba una fila y una
    // mancha encendidas indefinidamente, señalando un trozo de terreno que ya no
    // estaba tocando — con el ratón sí se apagaba (`mouseleave`), y esa asimetría
    // era el síntoma.
    //
    // ⚠️ **`focusout` y no `blur`, y se pregunta por `relatedTarget`.** `blur` no
    // burbujea (no alcanzaría al `<select>` de destino) y, sobre todo, apagar en
    // CADA salida haría parpadear la mancha entre cada dos tabulaciones: de la
    // casilla a su campo, y de una fila a la siguiente, se sale de un control para
    // entrar en otro de la MISMA lista. La pregunta correcta no es «¿se ha salido
    // de este control?» sino «¿se ha salido de la lista?»: si el foco entra en
    // otra fila, quien manda es el `focus` que viene detrás, que ya resalta la
    // suya. `relatedTarget` en `null` —el foco se va a la ventana o al cromo del
    // navegador— cuenta como salir, que es lo que de verdad es.
    fila.addEventListener('focusout', (evento) => {
      const destinoFoco = evento.relatedTarget
      if (destinoFoco !== null && destinoFoco !== undefined && lista.contains(destinoFoco)) return
      resaltar(null)
      emitir(oyentesSenal, 'señalar', null)
    })

    filasPorOrden.set(pieza.orden, { fila, casilla, campo })
    return fila
  }

  /**
   * Pinta una foto. **No conserva NADA de la anterior** (decisión 3C): ni los
   * nombres, ni las casillas desmarcadas, ni el resaltado. Reasignarlos por
   * `orden` pegaría el nombre de la pieza 2 de la foto vieja al trozo de terreno
   * que ahora es la 2, que es otro.
   *
   * @param {Cesion|null} cesion
   * @returns {void}
   */
  function pintar(cesion) {
    if (!vivo) return

    lista.replaceChildren()
    filasPorOrden.clear()
    piezasPintadas = []
    nota.textContent = ''
    nota.hidden = true
    renglon.textContent = ''
    renglon.classList.remove('gml-accion-estado--error')

    if (cesion === null || cesion === undefined) {
      vacio.textContent = ''
      vacio.hidden = true
      lista.hidden = true
      contador.textContent = ''
      boton.disabled = true
      renglon.textContent = MOTIVO_SIN_DERIVAR
      pintarFuera(null)
      return
    }

    if (typeof cesion !== 'object' || Array.isArray(cesion) || !Array.isArray(cesion.piezas)) {
      throw new TypeError(
        `pintar: 'cesion' debe ser el POJO de derivacion/cesion.js#derivarCesion (con 'piezas'), ` +
          `o null para vaciar; recibido ${describir(cesion)}.`,
      )
    }

    // Los candidatos de reparto salen del RECORTE, que viaja dentro de la misma
    // foto. Sin colindantes consultadas no hay ninguno y las filas no traen
    // desplegable, que es lo correcto: no se puede ofrecer dárselo a alguien de
    // quien no se sabe si existe.
    const candidatosPorOrden = new Map(
      (cesion.recorte?.lindes ?? []).map((l) => [l.orden, l.refcats]),
    )
    for (const pieza of cesion.piezas) {
      const fila = crearFila(pieza, candidatosPorOrden.get(pieza.orden) ?? [])
      piezasPintadas.push(pieza)
      lista.append(fila)
    }

    const hayPiezas = piezasPintadas.length > 0
    lista.hidden = !hayPiezas
    vacio.hidden = hayPiezas
    vacio.textContent = hayPiezas ? '' : SIN_PIEZAS
    repintarContador()

    // La otra mitad de la foto. Sale de `cesion.puerta`, que esta vista ya recibía
    // dentro del mismo POJO y hasta hoy ignoraba: el cableado escondía el bloque
    // entero antes de llegar aquí, así que la mitad medida no tenía dónde verse.
    pintarFuera(cesion.puerta ?? null, cesion.recorte ?? null)

    // La nota junta los dos hechos que la lista sola no cuenta y que NO pueden
    // quedarse en consola: cuántas piezas son estrechas (para que el usuario sepa
    // que la marca de las filas no es una rareza) y qué NO se ha podido medir.
    // Los `saltados` de la resta son el caso que el plan dejó abierto: si acabaran
    // en el canal global se leerían entre avisos de otra cosa, y son justamente el
    // motivo por el que la lista puede estar más corta de lo que debería.
    const trozos = []
    if (cesion.nEstrechas > 0) {
      trozos.push(
        `${cesion.nEstrechas} de ${piezasPintadas.length} por debajo del umbral de grosor ` +
          `(${FORMATO_GROSOR.format(cesion.umbralGrosorM)} m).`,
      )
    }
    // Aparte del recuento de estrechas, y no dentro: son dos hechos distintos —uno
    // invita a decidir y el otro dice que no se puede— y juntarlos en una cifra
    // haría creer que la casilla desmarcada es una elección de la aplicación.
    // ⚠️ La frase concuerda ENTERA, no solo el verbo. La primera versión decía «1 no
    // se puede emitir como finca: al escribirLAS … dejan de encerrar superficie», y
    // lo cazó mirar la pantalla, no la suite. Un renglón que no concuerda se lee
    // como un renglón de máquina, igual que «Las 1 parcelas» en `conjunto.js`.
    if (cesion.nNoEmitibles > 0) {
      const una = cesion.nNoEmitibles === 1
      trozos.push(
        `${cesion.nNoEmitibles} ${una ? 'no se puede' : 'no se pueden'} emitir como finca: al ` +
          `${una ? 'escribirla' : 'escribirlas'} con los 2 decimales del fichero ` +
          `${una ? 'deja' : 'dejan'} de encerrar superficie. ` +
          `${una ? 'Se queda fuera' : 'Se quedan fuera'} del expediente.`,
      )
    }
    if (Array.isArray(cesion.saltados) && cesion.saltados.length > 0) {
      trozos.push(
        `${cesion.saltados.length} recinto(s) NO se han podido medir, así que puede faltar ` +
          `sobrante en esta lista: ${cesion.saltados.map((s) => s.motivo).join('; ')}.`,
      )
    }
    nota.textContent = trozos.join(' ')
    nota.hidden = trozos.length === 0
  }

  /**
   * La foto ha caducado (3C). Vacía la lista **y lo dice en el propio bloque**.
   *
   * @param {string} [motivo]  El texto a enseñar. Por defecto
   *   {@link MOTIVO_FOTO_CADUCA}.
   * @returns {void}
   */
  function invalidar(motivo) {
    if (!vivo) return
    const texto = typeof motivo === 'string' && motivo.trim() !== '' ? motivo : MOTIVO_FOTO_CADUCA
    pintar(null)
    nota.textContent = texto
    nota.hidden = false
  }

  /**
   * Resalta la fila `orden`, o ninguna con `null`. Tolerante: un `orden` que ya no
   * está pintado apaga el resaltado y no lanza (la foto puede haber cambiado entre
   * el `mouseover` de la mancha y este cable).
   *
   * @param {number|null} orden
   * @returns {void}
   */
  function resaltar(orden) {
    if (!vivo) return
    const activa = Number.isFinite(orden) ? orden : null
    for (const [clave, entrada] of filasPorOrden) {
      const esta = clave === activa
      // `data-resaltada` y no una clase: es un gancho de inspección para los tests
      // y para `estilos/app.css`, y no gasta vocabulario visual nuevo.
      entrada.fila.dataset.resaltada = esta ? 'si' : 'no'
      entrada.fila.style.background = esta ? 'rgba(34,211,238,.18)' : ''
    }
  }

  boton.addEventListener('click', () => emitir(oyentesEntrega, 'entregar'))

  // Estado de arranque: el bloque nace vacío y el botón apagado CON su motivo.
  pintar(null)

  /** Registra un oyente en un juego y devuelve la baja. */
  function suscribir(oyentes, nombreApi, fn) {
    if (typeof fn !== 'function') {
      throw new TypeError(`${nombreApi}: 'fn' debe ser una función; recibido ${describir(fn)}.`)
    }
    oyentes.add(fn)
    return () => oyentes.delete(fn)
  }

  return {
    nodo: bloque,
    pintar,
    invalidar,
    resaltar,

    piezas: () => piezasPintadas.slice(),
    seleccionadas,
    asignaciones,
    nombres,

    entrega({ habilitado, motivo } = {}) {
      if (!vivo) return
      if (typeof habilitado !== 'boolean') {
        throw new TypeError(
          `entrega: 'habilitado' debe ser booleano; recibido ${describir(habilitado)}. ` +
            `Un botón se enciende o se apaga: no hay tercer estado.`,
        )
      }
      boton.disabled = !habilitado
      // ⛔ Apagar SIN motivo es lo que la regla de oro 1 prohíbe, así que se exige
      // aquí y no se confía en que el llamante se acuerde.
      if (!habilitado) {
        const texto = typeof motivo === 'string' && motivo.trim() !== '' ? motivo : ''
        if (texto === '') {
          throw new TypeError(
            `entrega: apagar el botón EXIGE un 'motivo'. Un botón gris y mudo no se distingue ` +
              `de uno roto (regla de oro 1).`,
          )
        }
        renglon.textContent = texto
        renglon.classList.remove('gml-accion-estado--error')
      } else if (typeof motivo === 'string') {
        renglon.textContent = motivo
      }
    },

    estado(texto, { error = false } = {}) {
      if (!vivo) return
      renglon.textContent = typeof texto === 'string' ? texto : ''
      renglon.classList.toggle('gml-accion-estado--error', error === true)
    },

    alCambiarSeleccion: (fn) => suscribir(oyentesSeleccion, 'alCambiarSeleccion', fn),
    alNombrar: (fn) => suscribir(oyentesNombre, 'alNombrar', fn),
    alSenalar: (fn) => suscribir(oyentesSenal, 'alSenalar', fn),
    alEntregar: (fn) => suscribir(oyentesEntrega, 'alEntregar', fn),

    /** Deshace todo. Idempotente. */
    destruir() {
      if (!vivo) return
      vivo = false
      lista.replaceChildren()
      filasPorOrden.clear()
      piezasPintadas = []
      oyentesSeleccion.clear()
      oyentesNombre.clear()
      oyentesSenal.clear()
      oyentesEntrega.clear()
      if (bloque.parentNode !== null) bloque.remove()
    },
  }
}

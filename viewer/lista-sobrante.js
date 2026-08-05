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

import { NIVEL, resolverAvisar } from './_comun.js'

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
  NOTA: '[data-sobrante="nota"]',
  VACIO: '[data-sobrante="vacio"]',
  ENTREGAR: '[data-accion="entregar-expediente"]',
  ESTADO_ENTREGA: '[data-estado="entregar-expediente"]',
})

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

  bloque.append(filaRotulo, nota, lista, vacio, boton, renglon)

  // ── Pintado ───────────────────────────────────────────────────────────────

  /** Los `orden` marcados ahora mismo, en el orden de la lista. */
  function seleccionadas() {
    const marcadas = []
    for (const pieza of piezasPintadas) {
      const entrada = filasPorOrden.get(pieza.orden)
      if (entrada && entrada.casilla.checked) marcadas.push(pieza.orden)
    }
    return marcadas
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

  /** Fabrica la fila de una pieza. */
  function crearFila(pieza) {
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
    numero.textContent = String(pieza.orden)
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
      return
    }

    if (typeof cesion !== 'object' || Array.isArray(cesion) || !Array.isArray(cesion.piezas)) {
      throw new TypeError(
        `pintar: 'cesion' debe ser el POJO de derivacion/cesion.js#derivarCesion (con 'piezas'), ` +
          `o null para vaciar; recibido ${describir(cesion)}.`,
      )
    }

    for (const pieza of cesion.piezas) {
      const fila = crearFila(pieza)
      piezasPintadas.push(pieza)
      lista.append(fila)
    }

    const hayPiezas = piezasPintadas.length > 0
    lista.hidden = !hayPiezas
    vacio.hidden = hayPiezas
    vacio.textContent = hayPiezas ? '' : SIN_PIEZAS
    repintarContador()

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

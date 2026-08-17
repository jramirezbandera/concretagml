// viewer/lista-sobrante.js — F17 · La lista del SOBRANTE, en la columna izquierda.
//
// ── QUÉ ES ESTO Y DÓNDE VIVE ────────────────────────────────────────────────
// La vista de `derivacion/cesion.js`: las piezas de `P_of − P_new`, una por fila,
// con su superficie, su grosor, una casilla para incluirla o excluirla del
// expediente y un campo para ponerle nombre. Más el contador «se emitirán N de M»
// y el botón que descarga el expediente entero.
//
// ── ⭐ ES UN CONTROL DE LEAFLET, Y DESDE EL 2026-08-17 ──────────────────────
// Vive FLOTANDO en la esquina `bottomleft` del mapa, con barra de título propia:
// se arrastra, se pliega y se cierra. Hasta hoy era un nodo suelto colgado de la
// sección `[data-anfitrion="sobrante"]` de la columna izquierda, y ese cambio de
// naturaleza —de trozo de panel a ventana— es lo que pidió el autor al ver la
// pantalla: «no me gusta dónde está el menú de después de derivar sobrante».
//
// **Y con esto el diseño vuelve A DONDE ESTABA EL 2026-08-02.** Aquel plan ya lo
// ponía flotando aquí; la fase 4 lo bajó a la columna con un argumento que sonaba
// bien —«las piezas se leen MIRANDO EL MAPA, así que flotando taparían justo lo
// que señalan»— y que resultó ser sólo media verdad. Lo que tapa es un panel
// FIJO. Uno que se arrastra a un hueco, se pliega a una barra de 22 px y se
// cierra del todo no tapa nada más de lo que el usuario consienta, y a cambio
// devuelve la columna entera. Aquel argumento pedía CONTROL sobre el estorbo, y
// se leyó como si pidiera no flotar.
//
// ── LA ESQUINA ESTÁ LIBRE, Y ESO SE COMPROBÓ ANTES DE OCUPARLA ──────────────
// `bottomleft` la comparten tres cajones (comprobación, contraste-edificio,
// parcelas) que son mutuamente excluyentes. Pero **ninguno de los tres puede
// estar abierto cuando este panel existe**: quién se abre lo decide el PASO en
// `app/contraste.js#cajonDe`, que sólo devuelve cajón en `ENTRADA` y en
// `DIAGNOSTICO`, y este panel es de `EDICION`. Así que no hay turno que negociar
// ni coordinación que escribir — la exclusión ya la garantiza el eje de pantalla.
// ⚠️ Quien algún día enseñe el sobrante en Diagnóstico tiene que volver aquí.
//
// ── ⭐ LA RACHA DE «0 px DEL PANEL» SE RECUPERA ─────────────────────────────
// Cinco fases seguidas resolvieron su interfaz sin gastar un píxel de la columna
// —F06 la edición a una barra flotante, F07 y F08 sus cifras a cajones sobre el
// mapa, F09 y F10 a sendos `<dialog>`—, y **F17 la rompió a propósito**: la
// revisión pieza a pieza es una lista, y una lista con el mapa al lado es lo que
// hace falta para revisarla. Costó lo que se declaró en su día:
//
//     bloque VACÍO ............ 96,63 px
//     cada fila ............... 31,00 px
//     invariante a defender ... 267,44 px de tabla de vértices (desde F07)
//
// Hoy se devuelve entero. La sección de la columna se queda vacía y la tabla de
// vértices recupera sus ~220 px, que es la mitad de lo que este cambio persigue.
//
// ⛔ **Y el desborde seguía sin dar síntoma: la tabla de vértices ENCOGÍA EN
// SILENCIO** (medido: desborde 0 en los seis casos). O sea que el precio se
// pagaba sin que nada avisara, que es el error silencioso en versión maquetación.
// El guardián sigue siendo el guion de humo 16, y ahora mide lo contrario: que la
// tabla ha RECUPERADO la altura.
//
// {@link FILAS_VISIBLES} sobrevive al cambio y ya no defiende la columna, sino la
// legibilidad del propio panel: con más de cuatro filas a la vista la ventana
// empieza a tapar el mapa que las filas señalan. ⛔ El número de filas **NO lo
// decide el caso de uso, lo decide la geometría** —un vértice mal puesto produce
// ocho piezas sin que nadie lo pretenda—, así que el tope es de ALTURA con scroll
// dentro y no un recorte: ninguna pieza desaparece, y el contador dice cuántas
// hay aunque sólo se vean cuatro.
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
// SOLO-NAVEGADOR: importa Leaflet y toca el DOM. Su test lleva el sufijo `.dom` y
// monta un mapa de verdad con `montarMapa` de `test/viewer/_ayuda-jsdom.js`.
//
// ⚠️ **La aritmética del acotado NO está aquí**, y es a propósito: vive en
// `viewer/acotar-viewport.js`, sin DOM y sin Leaflet, para poder probarse con
// números en el proyecto `node`. En jsdom `getBoundingClientRect()` devuelve
// ceros, así que una prueba del acotado escrita aquí mediría **nada** y saldría
// verde. El porqué largo, en la cabecera de aquel fichero.

import L from 'leaflet'

import { acotarAlViewport } from './acotar-viewport.js'
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
  // ── El cromo del panel (2026-08-17) ────────────────────────────────────────
  // ⚠️ `MINIMIZAR` y `CERRAR` sí llevan `data-accion` —y no `data-sobrante`—
  // porque son ÚNICOS en el documento, que es justo lo que K.1 exige. La
  // convención es la del cajón de F07: `cerrar-diagnostico` allí,
  // `cerrar-parcelario` aquí.
  CABECERA: '[data-sobrante="cabecera"]',
  TITULO: '[data-sobrante="titulo"]',
  ASIDERO: '[data-sobrante="asidero"]',
  RECUENTO: '[data-sobrante="recuento"]',
  CUERPO: '[data-sobrante="cuerpo"]',
  MINIMIZAR: '[data-accion="minimizar-parcelario"]',
  CERRAR: '[data-accion="cerrar-parcelario"]',
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
  'Todavía no se ha derivado ningún sobrante. Pulsa «Rehacer el parcelario» en el pie del panel.'

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
 * El título del panel, y **el mismo texto que el botón que lo abre**.
 *
 * ⛔ **Que coincidan palabra por palabra no es cosmética.** Es la única pista de
 * que este panel es la consecuencia de aquel botón: se pulsa «Rehacer el
 * parcelario» en el pie y aparece una ventana que se llama igual. Con dos nombres
 * distintos —«Rehacer el parcelario» abajo, «Sobrante» arriba— el usuario tiene
 * que deducir la relación, y el sitio donde aparece no ayuda, porque no es donde
 * pulsó. Si alguien renombra el botón, esta constante va en el mismo gesto.
 */
export const TITULO = 'Rehacer el parcelario'

/**
 * Lo que dice la barra cuando el panel está PLEGADO: `· 3 piezas`.
 *
 * Plegado, la barra es lo ÚNICO que queda, así que tiene que seguir diciendo que
 * hay algo dentro. Una barra que solo pusiera «Rehacer el parcelario» se leería
 * como un botón apagado, y el usuario que la plegó para ver el mapa no tendría
 * cómo saber si sus tres piezas siguen ahí o se perdieron al plegar.
 *
 * ⚠️ Se escribe también DESPLEGADO —no se borra al restaurar—, porque el recuento
 * de arriba y el contador «se emitirán N de M» de dentro cuentan cosas distintas:
 * éste dice cuántas piezas hay, aquél cuántas van al fichero. Verlos a la vez es
 * lo que enseña que excluir una casilla no borra la pieza.
 */
export function textoRecuento(total) {
  if (!Number.isFinite(total) || total <= 0) return ''
  return `· ${total} ${total === 1 ? 'pieza' : 'piezas'}`
}

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

/**
 * ⭐ **EL CROMO DE VENTANA** (2026-08-17), la misma receta que el cajón de F07
 * usa sobre el mapa, para que el proyecto no estrene un segundo aspecto de
 * «cosa que flota sobre la ortofoto».
 *
 * Las tres decisiones que no se leen solas:
 *
 *   · **`maxWidth: 'min(420px,42vw)'`**, calcado de `cajon-diagnostico.js`. Las
 *     filas llevan un campo de nombre que quiere ancho, pero un panel que se
 *     come la mitad de la pantalla deja de ser una ventana y vuelve a ser una
 *     columna — que es justo de lo que se está saliendo.
 *   · **`maxHeight: '60vh'` con `overflow: 'hidden'`**: el tope de la LISTA ya
 *     lo pone {@link FILAS_VISIBLES}, pero el panel entero puede crecer por
 *     abajo (la sección de «fuera del contorno», la nota de piezas saltadas), y
 *     sin tope una foto rara lo estiraría hasta salirse por arriba de la
 *     ventana, llevándose la barra de título con él. ⛔ Que es exactamente lo
 *     que `viewer/acotar-viewport.js` existe para impedir, sólo que por el otro
 *     borde y sin que nadie arrastre nada.
 *   · **`zIndex: '1000'`**: el de los controles de Leaflet. Sin declararlo, el
 *     panel queda por debajo de las manchas del sobrante que él mismo enumera.
 */
const ESTILO_SOBRE_EL_MAPA = Object.freeze({
  background: '#fff',
  padding: '8px 10px',
  borderRadius: '6px',
  boxShadow: '0 2px 10px rgba(15,23,42,.25)',
  width: 'min(420px,42vw)',
  maxHeight: '60vh',
  overflow: 'hidden',
  zIndex: '1000',
})

/**
 * El envoltorio mínimo que convierte el bloque en un control de Leaflet.
 *
 * ⛔ **Es un envoltorio y no una reescritura, y la diferencia importa.** La
 * tentación era volver a escribir las 1.200 líneas de esta vista como
 * `L.Control.extend({ onAdd() {…} })`, que es la forma del cajón de F07. Pero
 * aquel cajón se construye DENTRO de `onAdd` porque nació así; éste ya tiene su
 * nodo montado, con sus oyentes puestos y su foto pintada, mucho antes de que
 * nadie hable de mapas. Lo único que Leaflet tiene que aportar es **dónde se
 * cuelga** —la esquina, y que `remove()` funcione—, y eso son cinco líneas.
 *
 * `onAdd` devuelve el nodo que ya existe en vez de fabricar otro: un segundo
 * contenedor sería un segundo `[data-accion="entregar-expediente"]` en el
 * documento, y `querySelector` se queda con el PRIMERO. Es la trampa que
 * `index.html` lleva documentando desde F06.
 */
const ControlSobrante = L.Control.extend({
  options: { position: 'bottomleft' },
  initialize(bloque, opciones) {
    L.Util.setOptions(this, opciones)
    this._bloque = bloque
  },
  onAdd() {
    return this._bloque
  },
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

// ── El cromo del panel (2026-08-17) ──────────────────────────────────────────

/**
 * La barra de título: asidero, nombre, recuento y los dos controles.
 *
 * ⚠️ **`flex: 'none'` es lo que la salva de encoger.** El bloque es un flex en
 * columna con un `maxHeight` por debajo, así que sin declararlo la barra sería
 * candidata a repartirse el recorte con la lista — y una barra de título de 14 px
 * de alto no es una barra de título, es un renglón inservible con dos botones que
 * ya no se pueden pulsar. Encoger es de la lista, que para eso scrollea.
 *
 * `userSelect: 'none'` porque arrastrar por un texto seleccionable selecciona el
 * texto en vez de mover el panel: el cursor se convierte en una I, aparece el
 * resalte azul y el panel se queda quieto. Es el defecto clásico de todo lo que
 * se arrastra por su título.
 */
const ESTILO_CABECERA = Object.freeze({
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
  flex: 'none',
  margin: '0',
  padding: '2px 0',
  userSelect: 'none',
})

/**
 * El asidero `⠿`. **Existe para que el arrastre se vea antes de intentarlo**: un
 * panel que se puede mover y no lo anuncia es un panel que nadie mueve.
 *
 * ⚠️ `aria-hidden` porque es DECORACIÓN: quien lo oye leído como «puntos braille
 * dos-cuatro-cinco» no recibe ninguna información. Lo que sí anuncia el arrastre
 * a un lector de pantalla son las teclas de flecha sobre la barra, y eso se dice
 * con texto de verdad. El braille es para el ojo.
 */
const ESTILO_ASIDERO = Object.freeze({
  flex: 'none',
  fontSize: '12px',
  lineHeight: '1',
  color: '#94A3B8',
})

const ESTILO_TITULO = Object.freeze({
  flex: 'none',
  margin: '0',
  fontSize: '12px',
  fontWeight: '600',
  color: '#0F172A',
})

/**
 * El recuento de la barra. `flex: '1 1 auto'` con `minWidth: '0'`: es lo ÚNICO
 * que puede encogerse aquí, así que cuando el panel se estrecha se recorta este
 * texto y no los botones. Un `[×]` recortado es un panel que no se cierra.
 */
const ESTILO_RECUENTO = Object.freeze({
  flex: '1 1 auto',
  minWidth: '0',
  overflow: 'hidden',
  whiteSpace: 'nowrap',
  textOverflow: 'ellipsis',
  fontSize: '11px',
  color: '#64748B',
})

/**
 * Los dos botones del cromo, con la misma receta que el `✕` del cajón de F07
 * (`viewer/cajon-diagnostico.js`) para que no estrenen un aspecto propio.
 *
 * ⚠️ **`cursor: 'pointer'` y no `'move'`**, aunque estén dentro de la barra que
 * se arrastra: sobre ellos el gesto que vale es el clic. Y por eso mismo el
 * arrastre los excluye explícitamente (`L.DomEvent.disableClickPropagation` no
 * basta: no detiene el `click`, y está documentado en el cajón de al lado).
 */
const ESTILO_BOTON_CROMO = Object.freeze({
  flex: 'none',
  border: '0',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '13px',
  lineHeight: '1',
  padding: '2px 4px',
  color: '#64748B',
})

/**
 * El cuerpo: todo menos la barra. Es lo que se pliega, y es lo único que hereda
 * el `minHeight: '0'` que le deja encoger dentro del flex de la columna.
 */
const ESTILO_CUERPO = Object.freeze({
  display: 'flex',
  flexDirection: 'column',
  gap: '4px',
  minHeight: '0',
})

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
 * @property {() => void} plegar  Deja solo la barra de título con su recuento.
 *   **No pierde nada**: ni nombres, ni casillas, ni destinos.
 * @property {() => void} desplegar
 * @property {() => void} cerrar  Esconde el panel entero, barra incluida.
 * @property {() => void} abrir
 * @property {() => boolean} estaPlegado
 * @property {() => boolean} estaAbierto
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
 * «Rehacer el parcelario» bajó al PIE del panel (decisión de diseño D2: un bloque vacío
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
export function crearListaSobrante({ mapa, documento, alAvisar } = {}) {
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

  // ── La barra de título, y por qué el panel entero cuelga de ella ───────────
  //
  // Es lo primero que se fabrica porque es lo que SOBREVIVE a todo lo demás:
  // plegado, el cuerpo desaparece y la barra se queda; arrastrando, la barra es
  // el asidero; y el acotado al viewport se calcula sobre SU rectángulo, no
  // sobre el del panel (ver `viewer/acotar-viewport.js` y el porqué largo).
  const cabecera = doc.createElement('header')
  cabecera.dataset.sobrante = 'cabecera'
  estilar(cabecera, ESTILO_CABECERA)

  const asidero = doc.createElement('span')
  asidero.dataset.sobrante = 'asidero'
  asidero.textContent = '⠿'
  asidero.setAttribute('aria-hidden', 'true')
  estilar(asidero, ESTILO_ASIDERO)

  // ⛔ **SIN la clase `gml-rotulo`, y no es un olvido.** El bloque ya tiene un
  // `.gml-rotulo` dentro («Sobrante»), y esta barra se pinta ANTES en el DOM: con
  // la clase puesta, `querySelector('.gml-rotulo')` —que es como lo resuelven los
  // tests y como podría resolverlo cualquiera— pasaría a devolver el TÍTULO DE LA
  // VENTANA en vez del rótulo de la sección, y el de dentro se quedaría mudo. Es
  // literalmente la trampa que `index.html` lleva documentando desde F06, sólo
  // que por clase en vez de por `data-*`. Y además sería mentira semántica: un
  // título de ventana no es un rótulo de grupo, y el vocabulario visual de
  // `.gml-rotulo` (versalita, interletraje) es el de los segundos.
  const titulo = doc.createElement('h2')
  titulo.dataset.sobrante = 'titulo'
  titulo.textContent = TITULO
  estilar(titulo, ESTILO_TITULO)

  const recuento = doc.createElement('span')
  recuento.dataset.sobrante = 'recuento'
  // `role="status"` como los demás renglones vivos: al derivar otra vez, el
  // lector de pantalla anuncia cuántas piezas hay SIN robar el foco.
  recuento.setAttribute('role', 'status')
  estilar(recuento, ESTILO_RECUENTO)

  const botonMinimizar = doc.createElement('button')
  botonMinimizar.type = 'button'
  botonMinimizar.dataset.accion = 'minimizar-parcelario'
  estilar(botonMinimizar, ESTILO_BOTON_CROMO)

  const botonCerrar = doc.createElement('button')
  botonCerrar.type = 'button'
  botonCerrar.dataset.accion = 'cerrar-parcelario'
  botonCerrar.textContent = '✕'
  botonCerrar.setAttribute('aria-label', `Cerrar «${TITULO}»`)
  estilar(botonCerrar, ESTILO_BOTON_CROMO)

  cabecera.append(asidero, titulo, recuento, botonMinimizar, botonCerrar)

  // ── El cuerpo: todo lo demás, en un nodo propio para poder plegarlo ────────
  // ⚠️ **Un contenedor y no `hidden` en cada hijo**: plegar tiene que ser UN
  // gesto reversible sin memoria. Escondiendo los hijos de uno en uno habría que
  // acordarse de cuáles estaban ya escondidos por su cuenta —la sección de
  // «fuera del contorno» nace `hidden`, y el bloque vacío también— y restaurar
  // los repondría todos, enseñando cosas que no tocaba enseñar.
  const cuerpo = doc.createElement('div')
  cuerpo.dataset.sobrante = 'cuerpo'
  estilar(cuerpo, ESTILO_CUERPO)

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
  cuerpo.append(filaRotulo, nota, lista, vacio, fuera, boton, renglon)
  bloque.append(cabecera, cuerpo)

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
      recuento.textContent = textoRecuento(0)
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
    // El recuento de la BARRA cuenta piezas; el contador de dentro cuenta las que
    // van al fichero. Son dos cifras distintas a propósito (ver {@link textoRecuento}).
    recuento.textContent = textoRecuento(piezasPintadas.length)

    // ⛔ **Una foto nueva DESPLIEGA y ABRE el panel**, y es lo que cierra el
    // círculo con el botón del pie: se pulsa «Rehacer el parcelario» y sale el
    // panel llamado igual. Sin esto, quien lo hubiera cerrado o plegado antes
    // volvería a pulsar el botón, la derivación correría entera y **no pasaría
    // nada visible** — el error silencioso en versión interfaz.
    if (hayPiezas) {
      fijarAbierto(true)
      fijarPlegado(false)
    }

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

  // ── Plegar y cerrar ───────────────────────────────────────────────────────
  //
  // Dos estados INDEPENDIENTES, y tienen que serlo: plegado es «lo tengo, no lo
  // miro ahora» y cerrado es «quítamelo». Fundirlos en uno obligaría a que
  // restaurar decidiera cuál de los dos deshacía, y esa decisión no la puede
  // tomar el panel — sólo la sabe quien lo plegó.
  //
  // ⚠️ **Ninguno de los dos pierde nada.** Ni los nombres escritos, ni las
  // casillas, ni los destinos, ni el resaltado: se esconde el nodo, y nada más.
  // La única cosa que borra esta lista es {@link invalidar}, porque allí lo que
  // ha caducado es el DATO. Confundirlos sería tirar el trabajo del usuario por
  // haber pulsado `[–]`.

  /** @type {boolean} */
  let plegado = false
  /** @type {boolean} */
  let abierto = true

  /**
   * Pliega o despliega. El botón cambia de flecha Y de etiqueta: `▲`/`▼` solo se
   * distinguen mirando, y `aria-expanded` es lo que lo dice de verdad.
   */
  function fijarPlegado(valor) {
    plegado = valor === true
    cuerpo.hidden = plegado
    botonMinimizar.textContent = plegado ? '▲' : '–'
    botonMinimizar.setAttribute('aria-expanded', plegado ? 'false' : 'true')
    botonMinimizar.setAttribute(
      'aria-label',
      plegado ? `Desplegar «${TITULO}»` : `Plegar «${TITULO}»`,
    )
  }

  /** Enseña o esconde el panel ENTERO, barra incluida. */
  function fijarAbierto(valor) {
    abierto = valor === true
    bloque.hidden = !abierto
  }

  botonMinimizar.addEventListener('click', () => fijarPlegado(!plegado))
  botonCerrar.addEventListener('click', () => fijarAbierto(false))

  // ── El panel sobre el mapa: control, arrastre y acotado ───────────────────
  //
  // Todo esto es CONDICIONAL a que haya mapa, y no por comodidad de los tests:
  // `crearVisor` puede montarse sin la rama del sobrante, y un `montarSobrante`
  // en `false` no tiene por qué arrastrar un control a ningún sitio. Sin mapa
  // este módulo sigue siendo lo que era —un nodo que alguien cuelga— y el
  // llamante se apaña con `.nodo`.

  /** @type {ReturnType<typeof L.Control>|null} */
  let control = null
  /** @type {L.Draggable|null} */
  let arrastre = null
  /** La ventana donde vive el panel, para el `resize`. `null` sin mapa. */
  const vista = mapa ? (doc.defaultView ?? globalThis.window ?? null) : null

  /**
   * Devuelve el panel al viewport si su BARRA DE TÍTULO se ha salido.
   *
   * ⛔ **Se mide la barra y no el panel**, y la diferencia es la que separa
   * «incómodo» de «irrecuperable»: un cuerpo que se sale por abajo se arrastra
   * hacia arriba, pero una barra fuera del viewport se lleva con ella el
   * asidero, el `[–]` y el `[×]` — y entonces la única salida es recargar, que
   * es tirar los nombres que el usuario acababa de escribir.
   *
   * La cuenta no está aquí: es {@link acotarAlViewport}, pura y probada con
   * números en el proyecto `node` (ver la cabecera de este fichero).
   *
   * ⚠️ **En jsdom no hace nada, y eso es correcto**: `getBoundingClientRect()`
   * devuelve ceros, el rectángulo cabe de sobra y la corrección sale 0. Lo que
   * este código hace de verdad sólo lo puede comprobar el guion de humo 16, en
   * Chromium y con un `resize` de verdad.
   */
  function acotar() {
    if (!vista || bloque.parentNode === null) return
    const r = cabecera.getBoundingClientRect()
    const destino = acotarAlViewport(
      { x: r.left, y: r.top, ancho: r.width, alto: r.height },
      { ancho: vista.innerWidth, alto: vista.innerHeight },
    )
    // Leaflet posiciona por `transform`, así que lo que se corrige es el
    // DESPLAZAMIENTO acumulado y no una coordenada absoluta: sumarle el delta
    // entre donde está la barra y donde debería estar respeta la esquina de la
    // que cuelga el control.
    const actual = L.DomUtil.getPosition(bloque) ?? new L.Point(0, 0)
    const corregido = actual.add(new L.Point(destino.x - r.left, destino.y - r.top))
    if (!corregido.equals(actual)) L.DomUtil.setPosition(bloque, corregido)
  }

  if (mapa) {
    // El cromo de ventana se pone AQUÍ y no al fabricar el nodo: sin mapa este
    // bloque no flota sobre nada, y pintarle sombra y fondo blanco dentro de una
    // columna sería dibujar una tarjeta dentro de una tarjeta.
    estilar(bloque, ESTILO_SOBRE_EL_MAPA)
    // El cursor es la mitad de la promesa del asidero `⠿`: uno se ve de lejos y
    // el otro se descubre al pasar por encima. Van juntos o no van.
    cabecera.style.cursor = 'move'

    control = new ControlSobrante(bloque)
    control.addTo(mapa)

    // ── ⛔ LOS DOS OBLIGATORIOS ────────────────────────────────────────────
    // Sin ellos, arrastrar el panel ARRASTRA EL MAPA por debajo y hacer scroll
    // dentro de la lista HACE ZOOM. Están marcados como obligatorios, con el
    // mismo comentario, en `viewer/cajon-diagnostico.js:152`.
    //
    // ⚠️ Y `disableClickPropagation` **NO detiene el `click`**: detiene
    // `mousedown`/`touchstart`/`dblclick`, que es lo que le hace falta a
    // Leaflet, pero un `click` sigue burbujeando hasta el `document`. Lo dice
    // aquel módulo en su línea 148, y aquí importa porque los dos botones del
    // cromo son `click`: si algún día se añade un guardián de «clic fuera»,
    // tendrá que excluir este nodo a mano.
    L.DomEvent.disableClickPropagation(bloque)
    L.DomEvent.disableScrollPropagation(bloque)

    // ── El arrastre ────────────────────────────────────────────────────────
    // Por la BARRA y no por el panel entero: arrastrando desde el cuerpo sería
    // imposible marcar una casilla o seleccionar el texto de un nombre, porque
    // cada `mousedown` empezaría a mover la ventana.
    arrastre = new L.Draggable(bloque, cabecera)
    arrastre.enable()
    arrastre.on('dragend', acotar)
    // Y al cambiar el tamaño de la ventana, porque encoger el viewport deja
    // fuera un panel que no se ha movido: el que se mueve es el borde.
    vista?.addEventListener('resize', acotar)
  }

  // El estado inicial del cromo, escrito por la misma función que lo cambia
  // después: así el botón no puede nacer con una flecha y un `aria-expanded` que
  // no concuerden, que es la clase de divergencia que sólo se ve con un lector.
  fijarPlegado(false)

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

    // ── El cromo, en la API porque el cableado tiene que poder tocarlo ───────
    // ⚠️ Se exponen los DOS estados por separado y con lectores propios, y no un
    // solo `visible`: el cableado necesita distinguirlos para escribir el
    // renglón vivo del pie («3 piezas, panel plegado» no se dice igual que
    // «3 piezas, panel cerrado»), y un booleano fundido no deja.
    plegar: () => fijarPlegado(true),
    desplegar: () => fijarPlegado(false),
    cerrar: () => fijarAbierto(false),
    abrir: () => fijarAbierto(true),
    estaPlegado: () => plegado,
    estaAbierto: () => abierto,

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
      // El orden importa: primero se suelta el arrastre y el oyente de la
      // ventana —que sobreviven al nodo y seguirían midiendo un panel que ya no
      // está—, y sólo después se quita el control. `control.remove()` hace
      // `DomUtil.remove(this._container)`, así que se lleva el nodo con él.
      arrastre?.disable()
      vista?.removeEventListener('resize', acotar)
      control?.remove()
      if (bloque.parentNode !== null) bloque.remove()
    },
  }
}

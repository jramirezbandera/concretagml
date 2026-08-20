// app/cableado-expediente.js — F10 · T5.1. DONDE SE COSE LA FASE ENTERA.
//
// Diez fases después, esta aplicación **por fin recuerda**. Hasta aquí recargar la
// pestaña tiraba el trabajo entero: no había ni una línea de almacenamiento, ni un
// flag de sucio, ni una forma de llevarse un expediente a otro equipo. Este módulo
// es el único sitio donde todo eso se conecta, y no aporta reglas nuevas: pone en
// contacto piezas que las fases 1 a 4 dejaron escritas y probadas por separado.
//
// ── LAS CINCO COSTURAS, Y QUÉ HACE CADA UNA ────────────────────────────────
//
//  1. **EL EXPEDIENTE POR FIN EXISTE.** `crearExpediente` vive en
//     `model/parcela.js` desde F00 y su ÚNICO llamante en todo el repo era
//     `test/contrato.test.js`: la aplicación trabajaba con una Parcela suelta en el
//     store y el `srs` era una constante de módulo. Aquí se junta lo uno con lo
//     otro —{@link cablearExpediente}`#expedienteActual`— con el `srs` saliendo de
//     `app/demo-datos.js`, tal y como la cabecera de aquel fichero lleva pidiendo
//     desde F03. El Expediente **se DERIVA, no se guarda**: la fuente de verdad de
//     la geometría sigue siendo el store, y una segunda copia viva del mismo dato
//     es la forma más segura de que las dos discrepen.
//
//  2. **EL AUTOGUARDADO**, séptimo suscriptor del mismo store, enchufando el
//     debounce de T3.3 al almacén de T2.1. Ver el apartado «La espera del
//     autoguardado», que es la decisión menos obvia del módulo.
//
//  3. **EL ARRANQUE**: se pide la persistencia, se lee lo guardado y, si hay
//     trabajo autoguardado de otra sesión, **se OFRECE** (decisión 2 de la
//     entrevista de F10: ofrecer, no imponer). La aplicación arranca exactamente
//     como siempre; nada se mueve bajo los pies del usuario.
//
//  4. **LAS TRES DESCARGAS** —DXF, listado de coordenadas y fichero de proyecto—
//     por `gml/descargar.js#descargarTexto`, con los nombres DERIVADOS de
//     `nombreFicheroGml` (ver {@link nombreFicheroExport}).
//
//  5. **LA ENTRADA DEL `.json`**, que no instancia una segunda zona de fichero: se
//     le añade la extensión a la ÚNICA que hay y se enruta por extensión. El
//     mecanismo es `cablearComprobacion`·`entradasExtra`, y el porqué está escrito
//     allí: dos zonas vivas engancharían las dos el `drop` de la ventana entera.
//
// Y la degradación del criterio 4: `QuotaExceededError` → purgar la caché del
// Catastro por antigüedad → reintentar → si sigue fallando, **decirlo**.
//
// ── ⛔ LO QUE EL PLAN PROMETÍA Y NO SE HACE: `metadatos.idDocumento` ────────
// El plan de F10 decía que con el Expediente por fin construido
// «`metadatos.idDocumento` deja de componerse siempre», apuntando a
// `app/cableado-informe.js`, que hoy llama a `componerIdDocumento(refcat, fecha)`
// en cada informe. **No se hace, y hay dos motivos concretos:**
//
//   1. **El identificador del informe lleva dentro el instante de emisión.** Su
//      forma es `CG-<refcat>-<AAAAMMDD>-<hhmmss>Z` (`report/firma.js`), y
//      `esIdDocumento` existe para reconocerla. Reutilizar uno guardado en el
//      expediente estamparía en un PDF de hoy la hora de la semana pasada: la
//      matrícula mentiría sobre cuándo se hizo ese papel, que es justo lo que un
//      documento firmable no puede hacer. El identificador del INFORME es del
//      informe; el del EXPEDIENTE, si lo hubiera, sería otra cosa.
//   2. **Un identificador guardado DENTRO del expediente sobrevive a `duplicar`.**
//      `storage/expedientes.js#duplicar` hace `structuredClone` del registro y
//      cambia **solo la clave**; nada toca `expediente.metadatos`. Una copia
//      llevaría dentro la identidad del original, apuntando a otro registro, sin
//      que nada fallara. La identidad de un expediente es su clave en el almacén,
//      y tener dos nombres para la misma cosa es exactamente lo que la cabecera de
//      `index.js` explica que este proyecto evita.
//
// Lo que sí cambia —y es la mitad de la promesa que sí se sostiene— es que
// `metadatos.creado` y `metadatos.modificado` **dejan de reestamparse a «ahora» en
// cada derivación**: se conservan en {@link cablearExpediente} y viajan al fichero
// de proyecto, así que un `.json` exportado dice de verdad cuándo se empezó ese
// trabajo en vez de decir la hora de la exportación.
//
// ── LA ESPERA DEL AUTOGUARDADO (y por qué no se arma al arrancar) ───────────
// El borrador es UN registro con clave reservada (`ID_BORRADOR`): cada disparo del
// debounce lo pisa. Si el autoguardado se armara al arrancar, **la primera edición
// del usuario borraría el trabajo de la sesión anterior antes de que le diera
// tiempo a verlo ofrecido** — y el síntoma sería que la oferta desaparece sola.
// Así que mientras haya una oferta pendiente el autoguardado está EN ESPERA, y el
// primer cambio que llega en ese estado lo dice una vez por el panel
// ({@link MENSAJE_AUTOGUARDADO_EN_ESPERA}) en lugar de escribir en silencio. En
// cuanto el usuario recupera o descarta, se arma y ya no vuelve a pararse.
//
// ── ⛔ F11 · LA SEGUNDA RAMA, Y POR QUÉ ESTE MÓDULO TENÍA QUE ENTERARSE ─────
// F11 le añade a la aplicación una rama EDIFICIO que **sustituye** al panel de
// parcela (`app/rama.js`). Este módulo es el sitio donde esa novedad podía romper
// F10 **sin hacer ruido**, y por eso la rama entra aquí como dependencia:
//
//  · **`expedienteActual()` PREGUNTA POR LA RAMA.** Hasta F11 construía siempre
//    `{srs, parcela}`. Con la rama EDIFICIO activa eso tenía dos desenlaces y los
//    dos eran malos: guardar el expediente **de la parcela** mientras en pantalla
//    hay un edificio —documento equivocado, en silencio, regla de oro 1 rota— o
//    pasarle las dos ramas a `crearExpediente`, que **lanza** (`model/parcela.js`
//    impone la exclusividad) dentro de un `click`. Ahora deriva la rama que toca,
//    y **nunca las dos**.
//  · **La parcela que hubiera en pantalla viaja como `edificio.parcelaContexto`**
//    —un array de recintos, que es literalmente lo que el modelo previó— y jamás
//    como rama `parcela` del expediente. Es la desviación 9 del plan de F11.
//  · ⛔ **F11 NO guarda expedientes de edificio en este navegador, y lo DICE.**
//    {@link idLocalAbierto} deriva la identidad del documento de `parcela.idLocal`
//    y **un `Edificio` no tiene `idLocal`**: `crearEdificio` devuelve `refcat`,
//    `modelo`, `partes`, `parcelaContexto` y `construccionOficial`, y nada más.
//    Inventarle identidad obliga a tocar `model/edificio.js`, que la desviación 2
//    del plan prohíbe. Así que «Guardar» se apaga **con el motivo escrito al lado**
//    ({@link MOTIVO_GUARDAR_EN_EDIFICIO}): botón apagado con motivo, jamás botón
//    muerto. **Deuda anotada para F12.**
//  · **Y el autoguardado tampoco se extiende** (desviación 7). Es suscriptor del
//    store de PARCELA; suscribirlo también al de edificio sin resolver lo anterior
//    haría que el borrador de edificio **pisara el de parcela**, porque el borrador
//    es un registro único de clave reservada (ver «La espera del autoguardado»).
//    Con la rama EDIFICIO activa **no se dispara**, y lo que hubiera cambiado se
//    vuelca al volver a PARCELA, igual que se vuelca al acabarse la oferta.
//    ⚠️ El renglón que se lo cuenta al usuario lo pone el panel de edificio
//    (`app/cableado-edificio.js`): **aquí no se duplica**.
//  · **Lo que SÍ se puede hacer con un edificio es llevárselo en un `.json`**, y no
//    es una concesión: siendo el único sitio donde se conserva, el fichero de
//    proyecto pasa de ser la puerta de la caja fuerte a ser la caja entera. Por eso
//    {@link cablearExpediente}`#abrirProyecto` **conmuta la rama** al abrir uno.
//  · **Las otras dos exportaciones NO se conmutan**: el DXF y el listado de
//    coordenadas son de la PARCELA (`serializarParcelaDxf` habla de recintos, no de
//    partes). Con la rama EDIFICIO se apagan diciéndolo, en vez de bajar un fichero
//    de la parcela que hay debajo mientras el usuario está mirando un edificio.
//
// ⚠️ Los dos parámetros nuevos son **opcionales y nacen en `null`**: sin ellos este
// cableado se comporta EXACTAMENTE como en F10, que es lo que permite que las 60
// pruebas de aquella fase sigan valiendo sin tocarles una línea.
//
// ── ⛔ REWORK DE UI · T7 · Y LA RAMA QUE SE QUEDA FUERA, DICHA ──────────────
// Lo de arriba dejó una consecuencia que hasta hoy no se contaba, y es el hallazgo
// **A2** de la revisión de ingeniería del rework: con las DOS ramas con dato,
// «Guardar» y «Guardar proyecto (.json)» escriben una y **descartan la otra en
// silencio**. El usuario lee un acuse que dice que ha salido bien y la mitad de lo
// que tiene en pantalla no está dentro.
//
// **La semántica no se cambia** —la exclusividad es del modelo y está ahí por un
// motivo; el design doc lo pone en su tabla de «NOT in scope»: se avisa, no se
// cambia—. Lo que se arregla es el silencio, que es la regla de oro 1. El acuse de
// las dos acciones dice ahora qué rama ha entrado y cuál se ha quedado fuera, por el
// renglón del diálogo **y** por el panel, con tres textos según el caso: ver
// {@link mensajeEdificioFuera}, {@link mensajeParcelaDeContexto} y
// {@link mensajeParcelaFuera}.
//
// ⚠️ **El DXF y el listado de coordenadas quedan fuera de T7 a propósito**: no
// descartan ninguna rama —son de la parcela por definición— y con la rama EDIFICIO
// ni siquiera bajan. Y **la asimetría del otro lado está declarada, no resuelta**:
// al ABRIR un `.json` de edificio, la parcela de contexto que trae dentro no se
// cuenta ni se abre en el panel de parcela. Se dice al exportar, que es donde el
// usuario todavía puede hacer algo; contarlo también al abrir es de otra tarea.
//
// ── LO QUE ESTE MÓDULO NO HACE ─────────────────────────────────────────────
//   · **No fabrica marcado de la cáscara.** El `<dialog>` lo fabrica
//     `app/dialogo-expediente.js`; de `index.html` solo se coge el botón
//     «Expediente», que sí está declarado allí (F10 · T4.1).
//   · **No sabe de IndexedDB.** Habla con `storage/expedientes.js` y
//     `storage/cuota.js` por sus resultados, y los dos entran CONSTRUIDOS desde
//     `app/main.js` — mismo reparto que el transporte, la caché y el cliente del
//     Catastro en F05.
//   · **No decide si el trabajo está bien.** Guarda, recupera y escribe ficheros
//     (regla de oro 9).
//   · **No cambia de huso.** Si un expediente guardado está en otro `srs`, se dice
//     y no se abre (desviación 8 del plan de F10). El diálogo ya apaga su botón con
//     el motivo escrito; aquí está la guarda que no depende de un `disabled`.
//
// Su test es `test/app/expediente.dom.test.js`, con sufijo `.dom`: toca el DOM.

import { TIPO_EXPEDIENTE, crearExpediente } from '../model/parcela.js'
import { conIdLocal } from '../edificio/mutaciones.js'
import { SEVERIDAD } from '../export/_comun.js'
import { serializarCoordenadasTxt } from '../export/coordenadas.js'
import { serializarCoordenadasExcel } from '../export/excel-coordenadas.js'
import { serializarParcelaDxf } from '../export/dxf.js'
import { aProyecto, deProyecto } from '../export/proyecto.js'
import {
  EXTENSION_GML,
  PREFIJO_NOMBRE,
  TIPO_MIME_DXF,
  TIPO_MIME_JSON,
  TIPO_MIME_TEXTO,
  TIPO_MIME_XLSX,
  descargarBinario,
  descargarTexto,
  nombreFicheroGml,
} from '../gml/descargar.js'
import { MS_AUTOGUARDADO, crearAutoguardado } from '../storage/autoguardado.js'
import { AVISO_SIN_PERSISTENCIA } from '../storage/cuota.js'
import { NIVEL } from '../viewer/_comun.js'
import { describirEdad } from './cableado-catastro.js'
import {
  ACCION,
  crearDialogoExpediente,
  enumerarBorradores,
  motivoOtroHuso,
} from './dialogo-expediente.js'
import { RAMA } from './rama.js'
import {
  MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO,
  MENSAJE_SIN_EDIFICIO,
  MENSAJE_SIN_PARCELA,
  SALIDA,
  evaluarSalida,
  evaluarSalidas,
} from './salidas.js'

/**
 * ⭐ **LOS TRES MOTIVOS DE LAS SALIDAS SE MUDARON A `app/salidas.js` EL 2026-08-11**,
 * y se re-exportan desde aquí porque sus importadores (las pruebas de esta pantalla)
 * los piden a este módulo desde F11 y F20, y cambiarles la puerta no aporta nada.
 *
 * La mudanza es la mitad del trabajo de aquel día, no un movimiento de ficheros:
 * mientras el motivo viviera pegado a la acción, cualquier superficie que quisiera
 * decirlo ANTES de pulsar —el desplegable de la barra, el `<dialog>`— tenía que
 * importar este cableado de 2.400 líneas, y dos superficies habrían acabado con dos
 * redacciones del mismo obstáculo. Ver la cabecera de `app/salidas.js`.
 */
export {
  MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO,
  MENSAJE_SIN_EDIFICIO,
  MENSAJE_SIN_PARCELA,
} from './salidas.js'

// ── El contrato con `index.html` ─────────────────────────────────────────────

/**
 * El botón «Expediente» de la fila del rótulo «Origen de la parcela». Vive en la
 * cáscara (F10 · T4.1) y **no lo fabrica nadie**: es el único nodo que este módulo
 * necesita de `index.html`.
 */
export const SELECTOR_BOTON_EXPEDIENTE = '[data-accion="abrir-expediente"]'

/**
 * El desplegable de SALIDAS de la barra de arriba, puesto el 2026-08-11 a petición
 * del autor («no tiene sentido que la exportación esté dentro del menú de
 * expediente»). Dentro viven los tres `[data-accion]` de exportación de geometría,
 * que hasta ese día los fabricaba `app/dialogo-expediente.js`.
 *
 * ⚠️ **Se apunta al MENÚ y no a cada botón**: el oyente es uno solo y por
 * delegación, igual que el del diálogo, para que añadir o quitar una salida sea
 * tocar `index.html` y nada más.
 *
 * ⚠️ **Y es OPCIONAL.** Una cáscara sin este menú —las pruebas de F10, que montan
 * un DOM mínimo— sigue montando el cableado: lo que falta es una puerta de entrada,
 * no una pieza. El botón de expediente sí es obligatorio y sigue siéndolo, porque
 * sin él el diálogo no se puede abrir de ninguna manera.
 */
export const SELECTOR_MENU_SALIDAS = '[data-menu="salidas"]'

/**
 * Los tres botones de dentro de ese menú, por si alguien los necesita nombrar
 * (las pruebas los pulsan). Se derivan de {@link ACCION}, que sigue siendo el
 * vocabulario único; aquí no se copia ningún literal.
 *
 * ⚠️ **Se llama `SELECTORES_` y no `SELECTOR_` a propósito.** El guardían G16
 * (`test/services/contrato-catastro.test.js`) recoge todo export de `app/` cuyo
 * nombre empiece por `SELECTOR_` y exige que sea una CADENA que case exactamente
 * un nodo de `index.html`. Esto es un objeto de tres, así que con aquel prefijo
 * lo pondría rojo por la forma y no por el fondo.
 */
export const SELECTORES_SALIDA = Object.freeze({
  DXF: `[data-accion="${ACCION.EXPORTAR_DXF}"]`,
  COORDENADAS: `[data-accion="${ACCION.EXPORTAR_COORDENADAS}"]`,
  EXCEL: `[data-accion="${ACCION.EXPORTAR_EXCEL}"]`,
})

/**
 * La clase del `<span>` de texto oculto que lleva la forma BREVE del motivo dentro
 * de una salida apagada (2026-08-11).
 *
 * ⚠️ **No es una clase nueva: es `.gml-rotulo-oculto`, la genérica que ya existe** y
 * que su propio bloque en `estilos/app.css` declara reutilizable («hoy la usa la
 * cabecera de la columna de borrado y mañana la usará el siguiente rótulo que haya
 * que decir sin escribir»). Se nombra aquí como constante para que las pruebas la
 * afirmen sin copiar el literal, no porque haya que declararla en ninguna parte.
 *
 * ⭐ Que se reutilice es lo que hace que cerrar esta deuda cueste **0 B de hoja**, y
 * desde hoy eso importa: el techo del criterio 10 quedó clavado en la medición de
 * esta misma fecha (`scripts/presupuesto-css.mjs#TECHO`), así que una clase nueva
 * habría puesto rojo el presupuesto por decir en voz baja lo que ya se sabía decir.
 */
export const CLASE_MOTIVO_SALIDA = 'gml-rotulo-oculto'

// ── Nombres de los cuatro ficheros ───────────────────────────────────────────

/**
 * Extensiones que la zona de fichero acepta ADEMÁS de las del GML, y con las que
 * `app/main.js` la amplía. Solo el fichero de proyecto: el DXF y los dos listados de
 * coordenadas son de SALIDA — la aplicación los escribe y todavía no los sabe abrir
 * desde la interfaz, que es una asimetría real y está declarada en el plan.
 *
 * ⚠️ Con el `.xlsx` de F20 esa asimetría **no empeora, pero cambia de naturaleza**: el
 * `.dxf` y el `.txt` sí los sabe leer la aplicación por otras vías (F18 y F19 los
 * cablearon como medición propia), y un libro de Excel **no lo sabe leer en absoluto**.
 * Por eso su aviso impreso da esa razón y no la del `.txt`.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const EXTENSIONES_PROYECTO = Object.freeze(['.json'])

/**
 * Los cuatro ficheros que este cableado entrega, con su prefijo y su extensión.
 *
 * ⚠️ **El DXF conserva el prefijo `parcela`** —el mismo que el GML— y los otros
 * llevan el suyo. No es descuido:
 *
 *   · El DXF y el GML son **la misma geometría en dos formatos**, y que se emparejen
 *     de un vistazo en la carpeta de descargas es exactamente lo que se quiere. No
 *     pueden colisionar porque la extensión ya los distingue.
 *   · El listado **no puede** llamarse `parcela_…​.txt`: `.txt` ya lo usa el informe
 *     de contraste de F08 (`contraste_…​.txt`), y dos ficheros de texto sobre la
 *     misma parcela y el mismo instante distinguidos solo por el prefijo es
 *     precisamente la razón por la que aquel eligió el suyo.
 *   · El proyecto lleva el suyo porque es lo único de los cuatro que se puede volver
 *     a abrir aquí, y el usuario tiene que poder encontrarlo sin abrirlo.
 *
 * ⭐ **Y el Excel de F20 comparte el prefijo `coordenadas` con el `.txt`, a
 * propósito.** Es el argumento del DXF y el GML aplicado otra vez: son **el mismo
 * documento en dos envases**, y que aparezcan uno al lado del otro en la carpeta de
 * descargas es justo lo que se busca. Tampoco pueden colisionar —la extensión los
 * distingue—, y quien baje los dos verá `coordenadas_…​.txt` y `coordenadas_…​.xlsx`
 * con la MISMA marca de tiempo, que es la forma de saber que dicen lo mismo.
 *
 * @readonly
 */
export const FICHERO = Object.freeze({
  DXF: Object.freeze({ prefijo: PREFIJO_NOMBRE, extension: '.dxf', mime: TIPO_MIME_DXF }),
  COORDENADAS: Object.freeze({ prefijo: 'coordenadas', extension: '.txt', mime: TIPO_MIME_TEXTO }),
  EXCEL: Object.freeze({ prefijo: 'coordenadas', extension: '.xlsx', mime: TIPO_MIME_XLSX }),
  PROYECTO: Object.freeze({ prefijo: 'proyecto', extension: '.json', mime: TIPO_MIME_JSON }),
})

/**
 * Compone el nombre de un fichero de salida: `<prefijo>_<referencia>_<marca>.<ext>`.
 *
 *     parcela_9398516VK3799G_2026-08-03T11-45-30.dxf
 *     coordenadas_sin-referencia_2026-08-03T11-45-30.txt
 *     proyecto_9398516VK3799G_2026-08-03T11-45-30.json
 *
 * ── POR QUÉ SE DERIVA DE `nombreFicheroGml` Y NO SE ESCRIBE OTRA VEZ ────────
 * Exactamente el mismo argumento que ya dejó escrito `nombreFicheroInforme` en
 * `app/cableado-diagnostico.js`, y por eso esta función es su gemela y no una
 * segunda invención: el nombre de un fichero **no es texto libre**. La referencia
 * catastral la teclea o la pega el usuario, y de ahí salen rutas (`/`, `\`, `..`),
 * caracteres ilegales en Windows, nombres de DISPOSITIVO reservados (`CON.dxf` no
 * se puede crear) y longitudes que revientan. Todo eso está resuelto —por lista
 * BLANCA y con el porqué de cada decisión al lado— dentro de `gml/descargar.js`, y
 * su saneador **no está exportado**. Se le pide el nombre HECHO y se le cambian las
 * dos piezas que son de este dominio.
 *
 * Se generaliza en vez de escribir tres funciones casi iguales porque aquí son TRES
 * ficheros: tres copias de la misma derivación son tres sitios donde arreglar la
 * misma cosa el día que cambie.
 *
 * FUNCIÓN PURA: la fecha entra por parámetro, igual que en `gml/` y en `export/`.
 *
 * @param {object} args
 * @param {string} args.prefijo    Uno de los de {@link FICHERO}.
 * @param {string} args.extension  Con el punto.
 * @param {string|null} [args.refcat=null]  Tal cual la tenga el expediente, SIN sanear.
 * @param {Date} args.fecha  Instante que se estampa. OBLIGATORIO.
 * @returns {string}  Nombre de fichero seguro.
 * @throws {TypeError|RangeError}  Los de `nombreFicheroGml`, sin traducir: son
 *   contratos del programador y su mensaje nombra el problema mejor.
 */
export function nombreFicheroExport({ prefijo, extension, refcat = null, fecha }) {
  const delGml = nombreFicheroGml({ refcat, fecha })
  // Se recorta por longitud y no con un `replace`, por lo mismo que allí: un
  // `replace` de la cadena «parcela» acertaría también dentro de una referencia
  // catastral que la contuviera.
  const cuerpo = delGml.slice(PREFIJO_NOMBRE.length, delGml.length - EXTENSION_GML.length)
  return `${prefijo}${cuerpo}${extension}`
}

// ── Traducción de severidades ────────────────────────────────────────────────

/**
 * Las TRES severidades de `export/` a los DOS niveles del panel. Misma tabla, y por
 * las mismas razones, que la de `app/main.js` para `gml/`: `NIVEL.ERROR` significa
 * BLOQUEANTE en toda la app, y un `INFO` de `export/` no es ruido de depuración
 * —son `SIN_GEOMETRIA_OFICIAL` y `HUECO_EXPORTADO`—: el fichero que baja no dice
 * todo lo que el usuario tiene en pantalla, y la regla de oro 1 dice que se entera.
 *
 * Una severidad futura da `undefined` y cae a `NIVEL.AVISO`, que es el suelo seguro:
 * nunca inventa un bloqueo.
 */
const NIVEL_POR_SEVERIDAD = Object.freeze({
  [SEVERIDAD.INFO]: NIVEL.AVISO,
  [SEVERIDAD.AVISO]: NIVEL.AVISO,
  [SEVERIDAD.ERROR]: NIVEL.ERROR,
})

// ── Tiempos ──────────────────────────────────────────────────────────────────

/**
 * Cuánto dura el armado de «Borrar» antes de olvidarse.
 *
 * ⚠️ **Borrar es irreversible y el diálogo no tiene pantalla de confirmación**: sus
 * filas las pinta `app/dialogo-expediente.js`, que emite {@link ACCION}`.BORRAR` en
 * cuanto se pulsa. Así que la confirmación la pone ESTE módulo sin tocar ni un nodo
 * ajeno: el primer clic ARMA y lo escribe en el renglón de estado (que es
 * `role="status"`, o sea que un lector de pantalla lo anuncia sin robar el foco), y
 * el segundo clic **sobre la misma fila y dentro de este plazo** borra. Un clic en
 * otra fila desarma: armar dos borrados a la vez sería peor que no armar ninguno.
 *
 * Limitación declarada para el §11 del checklist humano: el rótulo del botón sigue
 * diciendo «Borrar» mientras está armado, porque el marcado de la fila es del
 * diálogo. El aviso está en el renglón, no en el botón.
 */
export const MS_CONFIRMAR_BORRADO = 5000

// ── Textos ───────────────────────────────────────────────────────────────────

/**
 * Lo que se dice al arrancar cuando hay trabajo autoguardado de otra sesión. Va al
 * PANEL y no solo al diálogo, y esa es la diferencia entre ofrecer y esconder: un
 * renglón que solo se ve abriendo el diálogo no es una oferta, porque el usuario no
 * tiene ningún motivo para abrirlo.
 *
 * Dice las tres cosas que hacen falta: **qué hay**, **que no se ha tocado nada** y
 * **dónde está el botón**.
 *
 * ⚠️ **Recibe una LISTA desde F12 · T4.3** (antes, `(refcat, edad)`): con las dos
 * ramas autoguardando puede haber trabajo en las dos, y decir solo una habría dejado
 * la otra en la base sin que nadie supiera que estaba. La edad que se dice es **la
 * más reciente**, que es la que responde a «¿de cuándo es esto?».
 *
 * @param {Array<{tipo: string, refcat: string|null, edad: string|null}>} borradores
 * @returns {string}
 */
export const mensajeHayBorrador = (borradores) => {
  const lista = Array.isArray(borradores) ? borradores : []
  const edad = lista.map((b) => b.edad).find((e) => e !== null && e !== undefined) ?? null
  const cuando = edad === null || edad === undefined ? 'de una sesión anterior' : `de ${edad}`
  const cual = enumerarBorradores(lista)
  return (
    `Hay trabajo autoguardado ${cuando}${cual === '' ? '' : `, ${cual}`}. No se ha abierto nada: ` +
    'la pantalla sigue como siempre. Para recuperarlo o descartarlo, abre «Expediente», en la ' +
    'fila «Origen de la parcela».'
  )
}

/** Ver el apartado «La espera del autoguardado» de la cabecera. Se dice UNA vez. */
export const MENSAJE_AUTOGUARDADO_EN_ESPERA =
  'El autoguardado está en espera: hay trabajo autoguardado de una sesión anterior sin recuperar, ' +
  'y guardar encima lo borraría. Abre «Expediente» y recupéralo o descártalo; a partir de ahí el ' +
  'trabajo en curso se guarda solo.'

/* ⛔ AQUÍ VIVÍA `MENSAJE_SIN_PARCELA` («no hay nada que guardar ni que exportar»),
   mudado a `app/salidas.js` el 2026-08-11 con los otros dos motivos de salida y
   re-exportado desde la cabecera de este fichero. Ver allí el porqué. */

/**
 * Con qué nombre entra un edificio que llega en un fichero de proyecto **sin
 * identidad dentro** —un `.json` escrito antes de F12— y cuyo fichero tampoco tiene
 * nombre utilizable. Es el último recurso del último recurso; el normal es el nombre
 * del fichero. Ver `app/cableado-edificio.js#IDENTIDAD_SIN_NOMBRE`, que es su gemelo
 * en la otra puerta.
 *
 * @readonly
 */
export const IDENTIDAD_DE_PROYECTO = 'edificio-de-proyecto'

/** Cuando el expediente guardado dice ser de PARCELA y no trae ninguna geometría. */
export const MENSAJE_GUARDADO_SIN_PARCELA =
  'Ese expediente guardado no lleva ninguna parcela, así que no hay geometría que abrir en el ' +
  'visor. No se ha borrado nada.'

// ── F11 · lo que la rama EDIFICIO cambia, dicho ──────────────────────────────

/**
 * Por qué «Guardar» está apagado con la rama EDIFICIO activa. **Desviación 6 del
 * plan de F11**, y la regla de la casa: botón apagado **con motivo**, jamás botón
 * muerto.
 *
 * Dice las tres cosas que hacen falta —qué no se puede, por qué, y qué hacer en su
 * lugar—, y la tercera no es un consuelo: el fichero de proyecto **sí** guarda un
 * expediente de edificio entero, y esta misma pantalla lo vuelve a abrir.
 *
 * ⛔ **F12 · T4.3 · EL MOTIVO SE REESCRIBIÓ PORQUE HABÍA DEJADO DE SER VERDAD.**
 * Decía «porque un edificio no tiene aún el identificador con el que se distinguen
 * los expedientes guardados», y esta misma tarea se lo da (`model/edificio.js#idLocal`
 * de T1.1, estampado por `app/cableado-edificio.js`). Mandaba a esperar por algo que
 * ya está.
 *
 * Lo que **sigue** sin estar es la vuelta: la lista de guardados no distingue de qué
 * rama es cada fila y «Recuperar» solo sabe abrir parcelas, así que archivar un
 * edificio ahí sería meterlo donde no se puede sacar. Ésa es la razón que queda, es
 * comprobable —hay una prueba de que `recuperar` rechaza un registro de edificio— y
 * es la que se dice. **El trabajo en curso sí se guarda solo desde T4.3**, y el
 * motivo lo dice para que nadie crea que se está perdiendo lo que tiene en pantalla.
 *
 * Se exporta para que su prueba lo afirme sin copiar el literal, igual que
 * `MOTIVO_GENERAR_GML_EN_EDIFICIO` en `app/rama.js`.
 */
export const MOTIVO_GUARDAR_EN_EDIFICIO =
  '«Guardar» está apagado mientras estás en la rama Edificio: la lista de expedientes guardados ' +
  'todavía es de la rama Parcela y «Recuperar» no sabría volver a abrir un edificio desde ahí. ' +
  'El trabajo en curso no se pierde —esta rama se autoguarda y se recupera al volver—; para ' +
  'archivarlo con nombre, usa «Guardar proyecto (.json)»: ese fichero se lleva el edificio ' +
  'entero y se vuelve a abrir aquí.'

/* ⛔ AQUÍ VIVÍAN `MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO` y `MENSAJE_SIN_EDIFICIO`,
   mudados a `app/salidas.js` el 2026-08-11 y re-exportados desde la cabecera de este
   fichero. El primero llevaba escrito un aviso que sigue vigente allí: **enumera las
   salidas, así que caduca cada vez que se añade una** —ya pasó con el `.xlsx` de F20,
   que lo dejó diciendo «El DXF y el listado» cuando ya eran tres—. */

/**
 * Cuando llega un `.json` con un expediente de EDIFICIO y esta pantalla no tiene
 * cableada la rama de edificio. Es un fallo de montaje de la aplicación, pero el
 * usuario ve un fichero que no se abre: se cuenta por los dos canales y no se toca
 * nada de lo que hubiera en pantalla.
 */
export const MENSAJE_SIN_RAMA_EDIFICIO =
  'Ese fichero de proyecto lleva un edificio, y en esta pantalla no está montada la rama Edificio, ' +
  'así que no hay dónde abrirlo. No se ha cambiado nada de lo que tenías. Si esto pasa siempre, es ' +
  'un fallo de montaje de la aplicación.'

/**
 * Cuando se suelta un `.json` de proyecto mientras el anterior todavía se leía
 * (auditoría 2026-08-16, tercera puerta de la misma familia).
 *
 * ⛔ `await fichero.text()` no garantiza orden: entre dos ficheros mandaba el que
 * TERMINABA de leerse antes y no el ÚLTIMO que se soltaba, así que un proyecto
 * grande podía pisar segundos después al pequeño que el usuario acababa de abrir
 * — y aquí abrir un proyecto CONMUTA la rama y escribe el store.
 *
 * ⚠️ No afirma que el otro haya entrado, solo que llegó después: el segundo puede
 * haber fallado por su cuenta.
 *
 * Texto duplicado a propósito en las cuatro puertas, con un test-guarda que las
 * ata (`test/contrato.test.js`). Misma disciplina que `MENSAJE_FICHERO_NO_LEIDO`.
 *
 * @param {string} nombre  El que NO se ha cargado.
 * @param {string} vigente  El que sí manda.
 * @returns {string}
 */
export const mensajeFicheroSuperado = (nombre, vigente) =>
  `No se ha cargado «${nombre}»: mientras se leía soltaste «${vigente}». Entre dos ficheros manda ` +
  `el ÚLTIMO que sueltas, no el que termine de leerse antes. Si el que querías era «${nombre}», ` +
  `suéltalo otra vez.`

/** Cuando el `.json` dice ser de EDIFICIO y no trae edificio dentro. */
export const MENSAJE_GUARDADO_SIN_EDIFICIO =
  'Ese fichero de proyecto dice llevar un edificio, pero no trae ninguno dentro, así que no hay ' +
  'nada que abrir. No se ha cambiado nada de lo que tenías.'

// ── Rework de UI · T7 · la rama que se queda FUERA, dicha ────────────────────
//
// ⛔ **HALLAZGO A2 de la revisión de ingeniería del rework:** `expedienteActual()`
// deriva la rama activa y **descarta la otra en silencio**. Con las dos ramas con
// dato —que es el caso normal en cuanto alguien mira un edificio sobre su parcela— el
// usuario pulsa «Guardar» o «Guardar proyecto (.json)», lee un acuse que dice que ha
// salido bien, y **la mitad de lo que tiene en pantalla no está dentro**.
//
// La exclusividad NO se cambia: es del modelo (`model/parcela.js#crearExpediente`
// lanza al recibir las dos ramas juntas) y está ahí por un motivo. Lo que se arregla
// es el silencio, que es la regla de oro 1. Decidido así en A2, y el design doc lo
// pone por escrito en su tabla de «NOT in scope»: **se avisa, no se cambia.**
//
// Los tres textos son FUNCIONES porque el acuse tiene que nombrar el documento que se
// acaba de escribir —{@link DOCUMENTO}—: decir «el fichero» cuando lo que se ha
// escrito es un registro del navegador manda al usuario a buscar donde no hay nada.

/**
 * Cómo se llama, en el acuse, cada uno de los dos documentos que este cableado
 * escribe. Se exporta para que las pruebas compongan el mensaje esperado en vez de
 * copiar el literal, igual que se hace con {@link MOTIVO_GUARDAR_EN_EDIFICIO}.
 *
 * @readonly
 */
export const DOCUMENTO = Object.freeze({
  GUARDADO: 'El expediente guardado',
  PROYECTO: 'El fichero de proyecto',
})

/**
 * Rama PARCELA con un edificio cargado en la otra: **el edificio no va dentro**.
 *
 * Dice las cuatro cosas que hacen falta —qué lleva el documento, qué no, que lo que se
 * queda fuera **sigue en pantalla** y qué hacer para conservarlo—, y la cuarta no es
 * adorno: el almacén de este navegador todavía no sabe archivar un edificio con nombre
 * ({@link MOTIVO_GUARDAR_EN_EDIFICIO}), así que el `.json` es la única forma de
 * llevárselo. Enterarse de eso al volver mañana es enterarse tarde.
 *
 * ⚠️ **F12 · T4.3 corrigió la mitad que se quedó falsa.** Decía «y una recarga se lo
 * llevaría», y eso valía mientras el autoguardado no llegaba a esa rama (desviación 7
 * de F11). Ahora llega: una recarga lo devuelve. Lo que no hay es archivo con nombre,
 * y es lo único que se sigue diciendo.
 *
 * @param {string} donde  Uno de {@link DOCUMENTO}.
 * @returns {string}
 */
export const mensajeEdificioFuera = (donde) =>
  `${donde} lleva la parcela y NO lleva el edificio: un expediente es de una cosa o de la otra, ` +
  'nunca de las dos. El edificio que tienes cargado sigue en pantalla y esta versión lo ' +
  'autoguarda, pero no lo archiva con nombre: para conservarlo aparte, conmuta a la rama ' +
  'Edificio y guarda desde allí un fichero de proyecto (.json).'

/**
 * Rama EDIFICIO con una parcela debajo: la parcela **sí viaja, pero como contexto y
 * recortada**. {@link cablearExpediente}`#conParcelaDeContexto` mete `parcela.recintos`
 * en `edificio.parcelaContexto` (desviación 9 de F11), así que se quedan fuera la
 * referencia catastral, la geometría oficial y la identidad local; y al reabrir ese
 * fichero el contexto **no vuelve al panel de parcela**, porque
 * {@link cablearExpediente}`#abrirProyectoDeEdificio` carga el store de edificio y no
 * toca el otro. Las dos afirmaciones tienen su prueba: un mensaje que promete de más
 * es peor que el silencio que viene a arreglar.
 *
 * @param {string} donde  Uno de {@link DOCUMENTO}.
 * @returns {string}
 */
export const mensajeParcelaDeContexto = (donde) =>
  `${donde} lleva el edificio. La parcela que se ve debajo no viaja como parcela: va dentro del ` +
  'edificio como contexto, solo con sus recintos —sin la referencia catastral ni la geometría ' +
  'oficial del Catastro—, y al volver a abrir este fichero no aparece en el panel de parcela. Si ' +
  'la necesitas entera, vuelve a la rama Parcela y guarda desde allí un segundo fichero de proyecto.'

/**
 * Rama EDIFICIO, parcela debajo **y** un edificio que ya traía su propio
 * `parcelaContexto`. Ése no se pisa —la parcela que se dibuja debajo puede estar
 * editada a mano, y el contexto que vino con el edificio es el que le corresponde—,
 * así que aquí la parcela de pantalla no viaja **ni siquiera como contexto**.
 *
 * Es el caso peor y por eso tiene texto propio: decirle a alguien que su parcela «va
 * dentro como contexto» cuando no va sería mentir con más palabras.
 *
 * @param {string} donde  Uno de {@link DOCUMENTO}.
 * @returns {string}
 */
export const mensajeParcelaFuera = (donde) =>
  `${donde} lleva el edificio y NO lleva la parcela que se ve debajo: el edificio ya venía con su ` +
  'propia parcela de contexto y ésa no se pisa con la que tengas en pantalla. Si quieres ' +
  'conservar tu parcela, vuelve a la rama Parcela y guarda desde allí un segundo fichero de ' +
  'proyecto.'

/** Cuando se choca con la cuota y no hay caché que purgar. */
export const MENSAJE_SIN_PURGA =
  'No hay espacio en el almacén local y esta pantalla no tiene la caché del Catastro cableada, ' +
  'así que no hay nada que liberar automáticamente. Exporta el trabajo a un fichero de proyecto ' +
  'y borra expedientes que ya no necesites, o libera espacio desde el navegador.'

/** Cuando se ha purgado y aun así no cabe. */
export const MENSAJE_CUOTA_TRAS_PURGAR =
  'Sigue sin haber espacio en el almacén local después de liberar la caché del Catastro. Exporta ' +
  'el trabajo a un fichero de proyecto —eso no depende del espacio del navegador— y borra ' +
  'expedientes que ya no necesites.'

/** Coletilla del acuse de guardado cuando el navegador no garantiza la conservación. */
export const COLETILLA_SIN_PERSISTENCIA =
  ' El navegador no garantiza conservarlo: si se queda sin espacio puede borrarlo por su cuenta.'

/** Cuando falla el autoguardado varias veces seguidas. Se dice UNA vez por racha. */
export const MENSAJE_AUTOGUARDADO_ROTO =
  'El trabajo en curso no se está pudiendo autoguardar en este navegador. Lo que hay en pantalla ' +
  'no corre peligro mientras la pestaña siga abierta, pero una recarga se lo llevaría: exporta el ' +
  'expediente a un fichero de proyecto.'

/**
 * ⛔ E1 (auditoría del 2026-08-16): segunda pulsación de «Guardar» con la primera
 * todavía escribiendo en IndexedDB. Sin la guarda de reentrada de {@link guardar},
 * los dos clics veían `id === null` —la identidad se fija al VOLVER la escritura—
 * y cada uno creaba su registro: un doble clic dejaba dos expedientes duplicados.
 * Mismo patrón que `componiendo` en `app/cableado-informe.js`, y regla de oro 1:
 * la pulsación que no hace nada lo dice, no se traga en silencio.
 */
export const MENSAJE_YA_GUARDANDO =
  'El expediente ya se está guardando: esta segunda pulsación no hace nada, para no crear dos ' +
  'registros iguales. El acuse dirá cuándo ha terminado.'

/** Cuando alguien suelta un `.json` y este cableado no llegó a montarse. */
export const MENSAJE_SIN_EXPEDIENTE =
  'No se ha podido preparar el expediente, así que un fichero de proyecto no se puede abrir en ' +
  'esta sesión. El detalle técnico está en la consola del navegador.'

/** Cuando «Abrir un proyecto…» no tiene a quién pedirle el selector de ficheros. */
export const MENSAJE_SIN_SELECTOR =
  'No se puede abrir el selector de ficheros desde aquí: la entrada por fichero de la aplicación ' +
  'no está disponible en esta sesión. Puedes arrastrar el fichero de proyecto sobre la ventana.'

// ── Duck typing de las dependencias inyectadas ───────────────────────────────

/** ¿Sirve como store? Lo mismo que piden los otros cableados, y nada más. */
function esStore(s) {
  return (
    !!s &&
    typeof s === 'object' &&
    typeof s.get === 'function' &&
    typeof s.set === 'function' &&
    typeof s.subscribe === 'function'
  )
}

/**
 * ¿Sirve como almacén de expedientes? DUCK TYPING sobre las nueve operaciones que
 * este módulo usa, por el mismo motivo que en todo `storage/`: un doble de prueba no
 * debería fingir una jerarquía entera para hacer de almacén.
 */
function esAlmacen(e) {
  return (
    !!e &&
    typeof e === 'object' &&
    typeof e.guardar === 'function' &&
    typeof e.listar === 'function' &&
    typeof e.recuperar === 'function' &&
    typeof e.duplicar === 'function' &&
    typeof e.borrar === 'function' &&
    typeof e.guardarBorrador === 'function' &&
    typeof e.leerBorrador === 'function' &&
    typeof e.descartarBorrador === 'function'
  )
}

/** ¿Sirve como gestor de cuota? Solo `pedirPersistencia`: `medir` no se usa aquí. */
function esCuota(c) {
  return !!c && typeof c === 'object' && typeof c.pedirPersistencia === 'function'
}

/**
 * ¿Sirve como conmutador de rama? Las tres de {@link esStore} —`app/rama.js` es por
 * dentro un `crearEstadoVista`— y nada más: `destruir` es de quien lo cableó, no de
 * este módulo, y pedirlo obligaría a los dobles de prueba a fingirlo.
 */
const esRama = esStore

/**
 * ¿Hay un Edificio en el store de la otra rama? **La misma vara que usa
 * `crearExpediente`** para su chequeo estructural (`model/parcela.js`): un objeto con
 * `partes[]` y `modelo` de texto. Ni más —validar el dominio es de `model/edificio.js`,
 * que F11 no toca— ni menos.
 *
 * ⚠️ Un edificio con CERO partes cuenta como edificio, y es a propósito: una parcela
 * del Catastro sin construcción devuelve exactamente eso, y es **el punto de partida
 * de la obra nueva**, no un vacío. Lo que no cuenta es `null`, que es como nace el
 * store.
 */
export function hayEdificio(edificio) {
  return (
    !!edificio &&
    typeof edificio === 'object' &&
    Array.isArray(edificio.partes) &&
    typeof edificio.modelo === 'string'
  )
}

/**
 * ¿Hay geometría que guardar? Un exterior con al menos un vértice.
 *
 * ⚠️ **`hayGeometria` y `hayEdificio` SE EXPORTAN desde el rework de UI (T5)**, y
 * las dos eran privadas hasta entonces. El motivo es que el rail de navegación
 * necesita exactamente esta pregunta —«¿hay algo con lo que trabajar en la rama
 * activa?»— para decidir si el paso «Validación» está disponible, y la
 * alternativa era escribir una TERCERA copia de la regla en `app/main.js`.
 *
 * Exportarlas no las convierte en API pública del proyecto: siguen sin salir por
 * el barrel (`index.js` no expone `app/`, y hay una prueba de contrato que lo
 * vigila). Son dos predicados ESTRUCTURALES sobre los POJO del modelo, no reglas
 * de esta pantalla; ése es justo el criterio por el que `puedeDiagnosticar` de
 * `app/cableado-diagnostico.js` sigue sin exportarse y estas dos sí.
 */
export function hayGeometria(parcela) {
  return (
    !!parcela &&
    typeof parcela === 'object' &&
    Array.isArray(parcela.recintos) &&
    parcela.recintos.length > 0 &&
    Array.isArray(parcela.recintos[0]?.vertices) &&
    parcela.recintos[0].vertices.length > 0
  )
}

/**
 * ⭐ **(2026-08-19) ¿Hay puntos sueltos de un levantamiento importado?**
 *
 * El tercer hecho de `app/navegacion.js#CLAVES_HECHOS`, y vive aquí por lo mismo
 * que sus dos hermanos: es un predicado ESTRUCTURAL sobre el POJO del modelo, no
 * una regla de ninguna pantalla, y la alternativa era escribirlo otra vez en
 * `app/main.js`.
 *
 * ⛔ **NO es lo mismo que {@link hayGeometria}, y por eso son dos funciones.** Un
 * fichero de campo trae 88 `POINT` y cero polilíneas: importado sin unir, esa
 * parcela tiene puntos y **`recintos: []`**. Hay con qué trabajar —se dibuja el
 * linde encima, enganchando a ellos— pero **no hay geometría que firmar**, así que
 * lo que se abre con esto es Edición y no Diagnóstico. Fundir los dos predicados
 * en uno haría que el Diagnóstico contrastara un contorno inexistente contra el
 * parcelario y llamara diagnóstico al resultado.
 *
 * @param {object|null} parcela
 * @returns {boolean}
 */
export function hayPuntos(parcela) {
  return (
    !!parcela &&
    typeof parcela === 'object' &&
    Array.isArray(parcela.puntosLevantamiento) &&
    parcela.puntosLevantamiento.length > 0
  )
}

// ── Nodos de la cáscara ──────────────────────────────────────────────────────

/**
 * Nodo de `index.html`, o `throw`. El marcado de la cáscara es CONTRATO, así que un
 * selector que no encuentra nada es un bug del programador y no un dato malo: se
 * lanza y **se nombra el selector**. Gemelo del de `cableado-catastro.js` y del de
 * `cableado-diagnostico.js`; siguen siendo copias de cuatro líneas porque cada
 * mensaje nombra su propio módulo, que es lo único que se lee cuando salta.
 *
 * @param {Document} doc
 * @param {string} selector
 * @returns {HTMLElement}
 * @throws {Error}
 */
function nodoDe(doc, selector) {
  const encontrado = doc.querySelector(selector)
  if (encontrado === null) {
    throw new Error(
      `app/cableado-expediente.js: la cáscara no tiene ningún nodo '${selector}'. El marcado de ` +
        `index.html es contrato de este cableado: si se ha renombrado o movido ese botón, hay que ` +
        `arreglarlo en index.html, no aquí.`,
    )
  }
  return /** @type {HTMLElement} */ (encontrado)
}

// ── El cableado ──────────────────────────────────────────────────────────────

/**
 * Cablea el expediente: el botón «Expediente», su diálogo, el almacén local, el
 * autoguardado y las tres exportaciones.
 *
 * ```js
 * const exp = cablearExpediente({
 *   estado, panel, srs: SRS_DEMO,
 *   expedientes: crearExpedientes({ bd: abrirBd({ alAvisar: panel.avisar }), alAvisar: panel.avisar }),
 *   cuota: crearCuota({ alAvisar: panel.avisar }),
 *   cache: cacheCatastro,
 *   alCargarParcela: edicionCableada.alCargarParcela,
 *   elegirFichero: () => comprobacionCableada.elegirFichero(),
 * })
 * ```
 *
 * @param {Object} opciones
 * @param {import('../viewer/_comun.js').EstadoVista} opciones.estado  El MISMO store
 *   que el mapa, la tabla, la ficha, el diagnóstico, la comprobación, el botón del
 *   GML y el informe. Este cableado es su **séptimo** suscriptor.
 * @param {import('./avisos.js').PanelAvisos} opciones.panel
 * @param {string} opciones.srs  El SRS del expediente. Se valida al cablear.
 * @param {object} opciones.expedientes  El de `storage/expedientes.js`, **ya
 *   construido**: mismo reparto que el cliente del Catastro en F05, para que este
 *   módulo no decida por el llamante la base, el reloj ni el canal de avisos.
 * @param {object} opciones.cuota  El de `storage/cuota.js`, ya construido.
 * @param {{purgarCaducados: Function}|null} [opciones.cache=null]  La caché del
 *   Catastro, **solo para purgarla** cuando se agote la cuota (criterio 4). `null` ⇒
 *   no hay nada que liberar automáticamente, y se DICE ({@link MENSAJE_SIN_PURGA}).
 * @param {{get: Function, set: Function, subscribe: Function}|null} [opciones.rama=null]
 *   El conmutador de rama de `app/rama.js`, **ya cableado**. `null` ⇒ esta pantalla
 *   solo tiene la rama de parcela y todo se comporta como en F10, que es el montaje de
 *   cualquier test de aquella fase. Ver el apartado «F11 · la segunda rama» de la
 *   cabecera: de aquí sale la respuesta a «¿qué documento hay en pantalla?».
 * @param {import('../viewer/_comun.js').EstadoVista|null} [opciones.estadoEdificio=null]
 *   El SEGUNDO store, el de la rama EDIFICIO. Nace en `null` y lo llena
 *   `app/cableado-edificio.js`. `null` ⇒ no hay rama de edificio montada.
 * @param {((parcela: object) => void)|null} [opciones.alCargarParcela=null]  Se llama
 *   DESPUÉS del `estado.set`, con el POJO que ha entrado. El MISMO gancho que reciben
 *   `cablearCatastro` y `cablearComprobacion`, y por lo mismo: recuperar un expediente
 *   es **abrir un documento nuevo**, así que el historial se REINICIA en vez de
 *   commitear encima (decisión 2 de F06).
 * @param {(() => void)|null} [opciones.elegirFichero=null]  Abre el selector de
 *   ficheros de la ÚNICA zona de la aplicación (`cablearComprobacion#elegirFichero`).
 *   `null` ⇒ «Abrir un proyecto…» lo dice en vez de no hacer nada.
 * @param {HTMLElement} [opciones.boton]  Por defecto {@link SELECTOR_BOTON_EXPEDIENTE}.
 * @param {Document} [opciones.documento=globalThis.document]
 * @param {typeof URL} [opciones.url=globalThis.URL]  Objeto con
 *   `createObjectURL`/`revokeObjectURL`, que es lo que convierte una cadena en un
 *   fichero descargado. **Se acepta aquí porque `descargarTexto` ya lo acepta**, y
 *   por lo mismo: en jsdom no existe, así que sin inyectarlo las tres exportaciones
 *   solo se podrían probar por su degradación y nunca por lo que bajan.
 * @param {() => Date} [opciones.ahora]  De dónde sale «ahora». Inyectable porque sale
 *   POR PANTALLA (la antigüedad de cada guardado) y por fichero (la marca de tiempo
 *   de los tres nombres), y un módulo que lee el reloj del sistema no es reproducible.
 * @param {number} [opciones.ms=MS_AUTOGUARDADO]  Espera del debounce.
 * @param {(fn: Function, ms: number) => *} [opciones.programar]  Ver `storage/autoguardado.js`.
 * @param {(id: *) => void} [opciones.cancelar]  Ídem.
 * @returns {{abrir: () => void,
 *            abrirProyecto: (fichero: File) => Promise<void>,
 *            expedienteActual: () => object|null,
 *            guardarBorradorYa: () => Promise<*>,
 *            estado: () => object,
 *            destruir: () => void}}
 * @throws {TypeError}   Contrato del programador.
 * @throws {RangeError}  Si el `srs` no es uno de los del modelo (lo lanza `crearExpediente`).
 * @throws {Error}       Si la cáscara no trae el botón.
 */
export function cablearExpediente({
  estado,
  panel,
  acuse = null,
  menuSalidas,
  srs,
  expedientes,
  cuota,
  cache = null,
  rama = null,
  estadoEdificio = null,
  alCargarParcela = null,
  elegirFichero = null,
  documento = globalThis.document,
  url = globalThis.URL,
  boton,
  ahora = () => new Date(),
  ms = MS_AUTOGUARDADO,
  programar,
  cancelar,
} = {}) {
  if (!esStore(estado)) {
    throw new TypeError(
      `cablearExpediente: 'estado' debe ser el store de crearEstadoVista ` +
        `({get, set, subscribe}); recibido ${typeof estado}.`,
    )
  }
  if (!panel || typeof panel.avisar !== 'function') {
    throw new TypeError(
      `cablearExpediente: 'panel' debe ser el panel de avisos (con 'avisar'); recibido ` +
        `${typeof panel}. Sin él, un expediente que no se puede guardar no tendría dónde contarse.`,
    )
  }
  if (!esAlmacen(expedientes)) {
    throw new TypeError(
      `cablearExpediente: 'expedientes' debe ser el almacén de storage/expedientes.js ` +
        `(guardar, listar, recuperar, duplicar, borrar y el trío del borrador); recibido ` +
        `${typeof expedientes}. Se pasa CONSTRUIDO, como el cliente del Catastro.`,
    )
  }
  if (!esCuota(cuota)) {
    throw new TypeError(
      `cablearExpediente: 'cuota' debe ser el de storage/cuota.js (con pedirPersistencia); ` +
        `recibido ${typeof cuota}.`,
    )
  }
  if (cache !== null && typeof cache?.purgarCaducados !== 'function') {
    throw new TypeError(
      `cablearExpediente: 'cache' debe ser la caché del Catastro (con purgarCaducados) o null si ` +
        `no hay ninguna que purgar; recibido ${typeof cache}.`,
    )
  }
  if (rama !== null && !esRama(rama)) {
    throw new TypeError(
      `cablearExpediente: 'rama' debe ser el conmutador de app/rama.js#cablearRama ` +
        `({get, set, subscribe}) o null si esta pantalla solo tiene la rama de parcela; recibido ` +
        `${typeof rama}.`,
    )
  }
  if (estadoEdificio !== null && !esStore(estadoEdificio)) {
    throw new TypeError(
      `cablearExpediente: 'estadoEdificio' debe ser el store de la rama EDIFICIO ` +
        `({get, set, subscribe}) o null si no hay ninguna montada; recibido ${typeof estadoEdificio}.`,
    )
  }
  if (alCargarParcela !== null && typeof alCargarParcela !== 'function') {
    throw new TypeError(
      `cablearExpediente: 'alCargarParcela' debe ser una función o null; recibido ` +
        `${typeof alCargarParcela}.`,
    )
  }
  if (elegirFichero !== null && typeof elegirFichero !== 'function') {
    throw new TypeError(
      `cablearExpediente: 'elegirFichero' debe ser una función o null; recibido ` +
        `${typeof elegirFichero}.`,
    )
  }
  if (typeof ahora !== 'function') {
    throw new TypeError(`cablearExpediente: 'ahora' debe ser una función; recibido ${typeof ahora}.`)
  }
  // DELEGADO, igual que `cablearComprobacion` delega el huso en `husoPorSrs`: el
  // único sitio que sabe qué `srs` admite el modelo es `crearExpediente`, y su
  // mensaje («Válidos: …») nombra el problema mejor que cualquier paráfrasis. El
  // expediente que sale se tira: lo que interesa es que no lance.
  crearExpediente({ srs })

  const doc = documento
  const botonAbrir = boton ?? nodoDe(doc, SELECTOR_BOTON_EXPEDIENTE)

  let destruido = false

  // ── La puerta de fichero, que es de UNO a la vez (auditoría 2026-08-16) ─────
  // Cuenta FICHEROS SOLTADOS, no consultas ni refrescos. Ver
  // {@link mensajeFicheroSuperado}.
  let secuenciaFichero = 0
  /** El nombre del último fichero aceptado, para poder decir quién ganó. */
  let ficheroVigente = null

  // ── La identidad del expediente abierto, UNA POR RAMA ─────────────────────
  //
  // Lo que NO está en el store y no puede deducirse de él: con qué registro se
  // corresponde lo que hay en pantalla, cómo se llama y desde cuándo existe.
  //
  // `id === null` significa «esto todavía no se ha guardado nunca», que es el estado
  // de partida y el de cada documento nuevo. Guardar con `id` pone al día ESE
  // registro; guardar sin él crea uno.
  //
  // ⛔ **F12 · T4.3 · era UNA y ahora son DOS**, y el motivo es el mismo que parte en
  // dos la clave del borrador: con las dos ramas autoguardando a la vez, una sola
  // identidad haría que el borrador del edificio se escribiera con el `creado` de la
  // parcela y que cargar una parcela le reseteara la fecha al edificio. Cada rama
  // lleva la suya, y `ramaActual()` decide cuál se está mirando.
  const instanteISO = () => new Date(ahora()).toISOString()

  /** Una identidad recién nacida: sin registro y estrenando fechas. */
  const identidadNueva = () => ({
    /** @type {string|null} */ id: null,
    /** @type {string|null} */ nombre: null,
    creado: instanteISO(),
    modificado: instanteISO(),
  })

  const identidades = {
    [RAMA.PARCELA]: identidadNueva(),
    [RAMA.EDIFICIO]: identidadNueva(),
  }

  /** La identidad de la rama que se está mirando. Nunca `undefined`. */
  const identidadActual = () => identidades[ramaActual()]

  // ── ⭐ EL CANAL DE IDENTIDAD (auditoría del 2026-08-16) ────────────────────
  //
  // Quién más necesita enterarse de esto: la **zona de expediente de la barra**
  // (`app/barra.js#pintarExpediente`), que lee `estado()` en cada pintada y aun así
  // se quedaba rancia. Y no por leer mal, sino porque **no había pintada**: a
  // `pintar()` solo lo disparan la navegación y `refrescarHechos()` de
  // `app/main.js`, que cuelga de los dos STORES. Archivar, renombrar y borrar
  // cambian `identidades[rama]` sin tocar un store y sin mover de paso, así que
  // tras guardar «X» la barra seguía diciendo «Sin guardar» —con el diálogo
  // acusando «Guardado «X»» al lado— y tras borrar seguía enseñando el nombre de un
  // expediente que ya no existía. Lo segundo es lo caro: afirma que el trabajo está
  // archivado cuando no lo está.
  //
  // ⚠️ **El aviso NO lleva carga, y es deliberado.** Quien escuche vuelve a leer
  // `estado()`, que es la única definición de «qué expediente tengo». Mandar la foto
  // por el canal crearía una segunda, y una foto que viaja es una foto que se puede
  // quedar atrás — exactamente el defecto que esto viene a arreglar.
  //
  // ⚠️ Y se dispara **después** de haber puesto al día la identidad, nunca antes: un
  // canal que dice «ha cambiado» y enseña lo de antes es peor que no avisar.

  /** @type {Set<Function>} */
  const oyentesIdentidad = new Set()

  /**
   * Reparte el aviso **atrapando lo que revienten**: uno roto no puede dejar sin
   * enterarse a los demás, y una excepción que subiera desde aquí saldría dentro de
   * un `click` —donde no la ve nadie— o dentro de un `await` de `guardar`.
   */
  function notificarIdentidad() {
    for (const fn of [...oyentesIdentidad]) {
      try {
        fn()
      } catch (causa) {
        console.error('[expediente] un oyente del canal de identidad ha fallado:', causa)
      }
    }
  }

  /**
   * El `idLocal` del documento abierto **en cada rama**. Es lo que distingue **una
   * edición** de **otro documento**, y no es una elección nueva: `app/main.js` ya
   * razona por escrito que `idLocal` es el único de los cuatro candidatos que sirve
   * —`refcat` no (la demo es una parcela real), `origen` no (la demo ya es `WFS`), la
   * identidad del POJO no (editar construye uno nuevo)—.
   *
   * Importa porque sin esto, traer otra parcela del Catastro y pulsar «Guardar»
   * **pisaría el expediente anterior con una geometría que no es la suya**.
   *
   * ⚠️ Y desde F12 el `Edificio` también lo tiene (`model/edificio.js#idLocal`, T1.1):
   * hasta T4.3 este mapa habría tenido un `null` fijo en esa rama, que es
   * exactamente lo que la desviación 7 de F11 dio como motivo para no autoguardarla.
   *
   * @type {Record<string, string|null>}
   */
  const idLocalAbierto = {
    [RAMA.PARCELA]: estado.get()?.idLocal ?? null,
    [RAMA.EDIFICIO]: estadoEdificio?.get()?.idLocal ?? null,
  }

  /** Lo que devolvió `pedirPersistencia()`, o `null` mientras no se sepa. */
  let persistencia = null

  /**
   * Los borradores que se están OFRECIENDO, o `null` si no hay ninguno o si el
   * usuario ya los resolvió en esta sesión. Mientras no sea `null`, el autoguardado
   * está en espera (ver la cabecera).
   *
   * ⛔ **Es una LISTA desde F12 · T4.3**, y no por simetría: con las dos ramas
   * autoguardando, lo normal es acabar una sesión con trabajo en las dos. Ofrecer
   * solo uno habría dejado el otro en la base sin nadie que lo recuperara y sin nadie
   * que lo dijera — un borrador invisible es peor que ninguno, porque ocupa sitio y
   * el usuario cree que lo ha perdido.
   *
   * El orden es el de `ID_BORRADOR_POR_TIPO`, que es el que devuelve `listar()`.
   *
   * @type {Array<{tipo: string, refcat: string|null, edad: string|null}>|null}
   */
  let ofrecido = null

  /** ¿Se ha terminado ya la lectura de arranque? Hasta entonces no se pisa nada. */
  let arrancado = false

  /**
   * Hubo un cambio en el store **de esta rama** mientras el autoguardado estaba en
   * espera. Sin esto, una edición hecha en el medio segundo que tarda la lectura de
   * arranque —o mientras la oferta está en pie— **no se guardaría nunca**: el debounce
   * solo escribe lo que le han contado, y a ese cambio nadie se lo contó. Se vuelca en
   * cuanto la espera termina, que es lo que convierte «no pisar» en «no perder».
   *
   * ⚠️ **Es uno por rama desde F12 · T4.3, y con una bandera única salía mal.** Al
   * volcar habría que escribir las dos —no se sabría cuál cambió—, y eso escribiría el
   * borrador de una rama que el usuario no ha tocado: la próxima carga le ofrecería
   * «trabajo sin terminar» de algo que nunca empezó. Un borrador inventado es una
   * afirmación falsa, aunque sea una afirmación cómoda.
   *
   * @type {Record<string, boolean>}
   */
  const cambioEnEspera = {
    [RAMA.PARCELA]: false,
    [RAMA.EDIFICIO]: false,
  }

  /** ¿Queda algo por volcar en alguna rama? */
  const hayEnEspera = () => Object.values(cambioEnEspera).some(Boolean)

  /** Para que {@link MENSAJE_AUTOGUARDADO_EN_ESPERA} se diga una vez y no en cada tecla. */
  let dichaLaEspera = false

  /** Ídem para la racha de fallos del autoguardado. */
  let dichoElFalloAuto = false

  /** El borrado armado: `{id, hasta}` en milisegundos de época. Ver {@link MS_CONFIRMAR_BORRADO}. */
  let armado = null

  // ── Utilidades de dicción ─────────────────────────────────────────────────

  /** Al renglón del diálogo. Lo que se escriba aquí vale hasta el siguiente `fijar`. */
  /**
   * Lo que este cableado tiene que decir, dicho **donde se pueda leer**.
   *
   * Siempre va al renglón `role="status"` del `<dialog>`, que es donde ha vivido
   * desde F10. Y desde el 2026-08-11, **si el diálogo está cerrado va también al
   * acuse de la barra**, porque ese día las tres exportaciones de geometría se
   * mudaron al desplegable de salidas y se piden con el diálogo cerrado.
   *
   * ⛔ **Sin esto la mudanza habría creado un fallo silencioso de manual**, y no en
   * el camino feliz sino en el que más importa: pedir un DXF sin parcela cargada
   * responde «no hay nada que guardar ni que exportar», y ese mensaje se habría
   * escrito en un renglón que nadie está mirando. Un menú que se pulsa y no pasa
   * nada. Es exactamente la regla de oro 1.
   *
   * ⚠️ **Se enruta aquí y no en cada llamante** a propósito: hay siete sitios que
   * dicen algo antes de exportar (los tres «sin parcela», el de la rama edificio y
   * los dos desenlaces de la entrega), y repartir el `if` por todos ellos es
   * garantizar que el octavo se olvide. Con la condición aquí, cualquier camino
   * futuro que hable con el diálogo cerrado se ve solo.
   *
   * @param {string} texto
   * @param {{error?: boolean, exito?: boolean}} [tono]  Solo lo usa el acuse: el
   *   renglón del diálogo no tiene modificadores de color.
   */
  const decir = (texto, { error = false, exito = false } = {}) => {
    if (destruido) return
    dialogo.estado(texto)
    if (!dialogo.abierto()) acusar(texto, error, exito)
  }

  /**
   * El desenlace de una ENTREGA, dicho donde se ve **cuando el diálogo está
   * cerrado** — que desde el 2026-08-11 es el caso normal de las tres exportaciones
   * de geometría, porque se piden desde el desplegable de la barra.
   *
   * ⛔ **Sin esto la mudanza habría creado un fallo silencioso de manual.**
   * {@link decir} escribe en el renglón `role="status"` del `<dialog>`; con el
   * diálogo cerrado ese renglón no lo ve nadie, así que exportar un DXF sin parcela
   * cargada —que responde «no hay nada que exportar»— habría sido un menú que se
   * pulsa y no pasa nada. Es exactamente la regla de oro 1.
   *
   * ⚠️ **No escribe el nodo: se lo pide a su dueño.** El renglón
   * `[data-estado="generar-gml"]` y sus dos modificadores (rojo/verde) son de
   * `cablearGeneracionGml`, que lo expone como `acusar`. Dos módulos escribiendo
   * las mismas clases sobre el mismo nodo es la divergencia que esta casa lleva
   * evitando desde F04; un método público deja UN dueño y dos llamantes.
   *
   * Es el renglón correcto y no uno prestado: acusa lo que sale de la ZONA DE
   * ENTREGA de la barra, y las tres exportaciones viven ahora en esa zona.
   */
  const acusar = (texto, esError, esExito = false) => {
    if (!destruido && acuse !== null) acuse(texto, esError, esExito)
  }

  /** Al panel, que es donde queda constancia de lo que le pasa al DATO. */
  const avisar = (mensaje, nivel = NIVEL.AVISO, causa) => {
    if (!destruido) panel.avisar(mensaje, causa === undefined ? { nivel } : { nivel, causa })
  }

  /**
   * Publica en el panel lo que decidió un escritor de `export/` (regla de oro 1).
   * Un DXF que ha tenido que fundir dos vértices, o que sale con una capa en vez de
   * dos, no es el dibujo que el usuario tiene en pantalla.
   */
  function publicarDetecciones(detecciones) {
    for (const d of detecciones ?? []) {
      avisar(d.mensaje, NIVEL_POR_SEVERIDAD[d.severidad] ?? NIVEL.AVISO)
    }
  }

  /** «hace 6 días» a partir de una marca ISO. `null` si no se puede saber. */
  function edadDe(marcaISO) {
    const t = Date.parse(marcaISO)
    if (!Number.isFinite(t)) return null
    return describirEdad(ahora().getTime() - t)
  }

  // ── La rama activa (F11) ──────────────────────────────────────────────────

  /**
   * Qué rama está activa. **Sin conmutador cableado la respuesta es PARCELA**, que es
   * lo que hace que este módulo se comporte exactamente como en F10 cuando nadie le
   * pasa `rama`: no hay estado «sin rama» ni hay que preguntarlo en veinte sitios.
   *
   * @returns {'PARCELA'|'EDIFICIO'}
   */
  const ramaActual = () => (rama === null ? RAMA.PARCELA : rama.get())

  /** Atajo de lectura: `ramaActual() === RAMA.EDIFICIO`. */
  const enEdificio = () => ramaActual() === RAMA.EDIFICIO

  /** El Edificio del segundo store, o `null`. */
  const edificioActual = () => (estadoEdificio === null ? null : estadoEdificio.get())

  /**
   * Lleva la pantalla a una rama, si hace falta y si hay conmutador. Se llama al ABRIR
   * un documento: recuperar una parcela con la rama EDIFICIO puesta dejaría la
   * geometría en un store que nadie está mirando.
   *
   * @param {'PARCELA'|'EDIFICIO'} destino
   */
  function irARama(destino) {
    if (rama === null || rama.get() === destino) return
    rama.set(destino)
  }

  // ── El Expediente, derivado del store de la rama activa ───────────────────

  /**
   * El Expediente que corresponde a lo que hay ahora mismo en pantalla, o `null` si
   * no hay nada que expedientar. **Se deriva en cada llamada y no se guarda**: la
   * fuente de verdad de la geometría es el store, y una segunda copia viva sería la
   * forma más segura de que las dos discreparan.
   *
   * ⛔ **PREGUNTA POR LA RAMA, y ésta es la costura donde F11 podía romper F10 sin
   * hacer ruido** (ver la cabecera). Devuelve **una** rama y nunca las dos:
   * `crearExpediente` impone la exclusividad y lanzaría —dentro de un `click`— si se
   * le pasaran juntas.
   *
   * `metadatos` NO se deja en su defecto: `crearExpediente` estampa «ahora» en
   * `creado` y en `modificado` cuando no se le dan, así que un expediente derivado
   * cada vez diría que se creó en el instante de exportarlo. Ver la cabecera.
   *
   * @returns {object|null}
   * @throws {TypeError|RangeError}  Lo que lance `crearExpediente` si el store tiene
   *   una parcela rota. Es un contrato roto, y quien llama lo cuenta.
   */
  function expedienteActual() {
    const identidad = identidadActual()
    const metadatos = {
      creado: identidad.creado,
      modificado: identidad.modificado,
      // El autor NO lo sabe esta aplicación: el pie de firma es de F09, se guarda
      // aparte y se borra aparte, y está en la lista de lo que este almacén NO
      // guarda. Inventarlo aquí sería atribuirle un trabajo a alguien.
      autor: '',
      // Vacío A PROPÓSITO. Ver el apartado de la cabecera: el identificador del
      // informe lleva dentro su instante de emisión, y uno guardado aquí
      // sobreviviría a `duplicar` apuntando al registro original.
      idDocumento: '',
    }
    if (enEdificio()) {
      const edificio = edificioActual()
      if (!hayEdificio(edificio)) return null
      return crearExpediente({
        tipo: TIPO_EXPEDIENTE.EDIFICIO,
        srs,
        edificio: conParcelaDeContexto(edificio),
        metadatos,
      })
    }
    const parcela = estado.get()
    if (!hayGeometria(parcela)) return null
    return crearExpediente({ srs, parcela, metadatos })
  }

  /**
   * El edificio, con la parcela que hubiera en pantalla metida como CONTEXTO.
   *
   * ⛔ **Desviación 9 del plan de F11, y es la que evita el fallo caro**: la parcela
   * que se ve debajo del edificio no puede viajar como rama `parcela` del expediente
   * —ni el modelo la admitiría junto al edificio, ni sería verdad: el documento es el
   * edificio—, pero tirarla tampoco vale. `model/edificio.js` previó exactamente este
   * sitio: `parcelaContexto` es un array de recintos.
   *
   * **No pisa lo que ya hubiera.** Si el edificio viene del WFS con su parcela de
   * contexto, esa es la buena: la que se dibuja debajo puede estar editada a mano.
   *
   * No muta el POJO del store (regla de oro 4): devuelve uno nuevo, y `crearExpediente`
   * hace además su propia copia profunda.
   *
   * @param {object} edificio
   * @returns {object}
   */
  function conParcelaDeContexto(edificio) {
    if (edificio.parcelaContexto != null) return edificio
    const parcela = estado.get()
    if (!hayGeometria(parcela)) return edificio
    return { ...edificio, parcelaContexto: parcela.recintos }
  }

  /**
   * Qué se queda FUERA del documento que se acaba de escribir, o `null` si no se queda
   * nada. Es el hallazgo A2 dicho; el porqué de cada texto está arriba, con ellos.
   *
   * ⚠️ **Se llama DESPUÉS de escribir, y nunca antes.** No es una guarda: no impide
   * nada, porque la exclusividad de rama es del modelo y no se cambia. Es la mitad del
   * acuse que faltaba.
   *
   * @param {string} donde  Uno de {@link DOCUMENTO}.
   * @param {string} [r=ramaActual()]  ⛔ E2 (auditoría del 2026-08-16): `guardar`
   *   pasa su FOTO de la rama, tomada antes del primer `await`. Se describe el
   *   documento que se ESCRIBIÓ; leer la rama del instante del acuse mentiría si
   *   hubo una conmutación durante la escritura. `exportarProyecto` es síncrono y
   *   usa el defecto.
   * @returns {string|null}
   */
  function loQueSeQuedaFuera(donde, r = ramaActual()) {
    if (r !== RAMA.EDIFICIO) {
      return hayEdificio(edificioActual()) ? mensajeEdificioFuera(donde) : null
    }
    if (!hayGeometria(estado.get())) return null
    // La distinción NO es cosmética: con un contexto propio ya puesto, la parcela de
    // pantalla no viaja ni como contexto. Ver {@link conParcelaDeContexto}.
    return edificioActual()?.parcelaContexto == null
      ? mensajeParcelaDeContexto(donde)
      : mensajeParcelaFuera(donde)
  }

  /**
   * La referencia catastral de lo que hay en pantalla, o `null`. **De la rama activa**:
   * de ella sale el nombre de los ficheros que bajan, y estampar la RC de la parcela en
   * un fichero de edificio sería etiquetar mal un documento.
   */
  const refcatActual = () =>
    (enEdificio() ? edificioActual()?.refcat : estado.get()?.refcat) ?? null

  // ── Carga de una parcela en el store ──────────────────────────────────────

  /**
   * Mete una parcela en el store como DOCUMENTO NUEVO. El orden importa: la identidad
   * se fija ANTES del `set`, porque `set` notifica **de forma síncrona** y nuestro
   * propio suscriptor se despertaría con la identidad vieja y tomaría esta carga por
   * la llegada de un documento ajeno.
   *
   * ⚠️ **Y la rama se conmuta ANTES del `set`, por lo mismo** (F11): abrir una parcela
   * con la rama EDIFICIO puesta la metería en un store que nadie está mirando, y el
   * usuario vería su fichero «abrirse» sin que cambiara nada en pantalla. Conmutar
   * después tampoco valdría: nuestro propio suscriptor —y los otros diez— se
   * despertarían con la rama equivocada.
   *
   * @param {object} parcela
   * @param {{id: string|null, nombre: string|null, creado: string, modificado: string}} nuevaIdentidad
   */
  function cargar(parcela, nuevaIdentidad) {
    identidades[RAMA.PARCELA] = nuevaIdentidad
    idLocalAbierto[RAMA.PARCELA] = parcela?.idLocal ?? null
    irARama(RAMA.PARCELA)
    estado.set(parcela)
    if (alCargarParcela !== null) alCargarParcela(parcela)
  }

  /**
   * Lo mismo con un EDIFICIO: conmuta a su rama y lo escribe en el SEGUNDO store.
   * Nunca en el de parcela — meter un edificio en el store de la parcela es
   * exactamente el fallo que la tarea T3.3 existe para no cometer.
   *
   * No hay `alCargarParcela` que llamar: ese gancho reinicia el historial de edición
   * de la parcela, y aquí no ha entrado ninguna.
   *
   * ⚠️ **`idLocalAbierto` SÍ se mueve desde F12 · T4.3.** Antes no: un `Edificio` no
   * tenía `idLocal` y esta función lo decía. Ahora lo tiene, y sin moverlo aquí el
   * suscriptor del segundo store tomaría este documento recién abierto por «otro» y
   * le tiraría la identidad que se le acaba de dar en la línea anterior.
   *
   * @param {object} edificio
   * @param {{id: string|null, nombre: string|null, creado: string, modificado: string}} nuevaIdentidad
   */
  function cargarEdificio(edificio, nuevaIdentidad) {
    identidades[RAMA.EDIFICIO] = nuevaIdentidad
    idLocalAbierto[RAMA.EDIFICIO] = edificio?.idLocal ?? null
    irARama(RAMA.EDIFICIO)
    estadoEdificio.set(edificio)
  }

  // ── El autoguardado, UNO POR RAMA ─────────────────────────────────────────
  //
  // ⛔ **F12 · T4.3 · son DOS debounces, no uno que reparte.** La tentación era
  // pasarle al único `crearAutoguardado` un `{rama, dato}` y decidir dentro, y sale
  // mal por cómo funciona un debounce: `cambiado()` **coalesce, se queda con el
  // último y tira los anteriores** (`storage/autoguardado.js`, la variable `ultimo`).
  // Editar la parcela, conmutar y tocar el edificio dentro de la misma ventana de dos
  // segundos habría hecho que el cambio de la parcela **no se escribiera nunca** — y
  // en un autoguardado eso no lo nota nadie hasta el día que hace falta.
  //
  // Dos instancias no pueden coalescer la una en la otra. Cada una escribe en su
  // clave reservada (`storage/expedientes.js#ID_BORRADOR_POR_TIPO`) y lleva su propia
  // cuenta de fallos; lo único que comparten es el aviso, que se dice una vez.

  /**
   * Fabrica el autoguardado de una rama. Lo único que cambia entre los dos es cómo se
   * arma el Expediente; todo lo demás —cadencia, reloj, temporizadores inyectados y
   * el aviso de racha rota— es idéntico a propósito: dos cadencias distintas serían
   * dos comportamientos que explicar.
   *
   * @param {(dato: *) => object} armar  Del dato del store al Expediente.
   * @returns {ReturnType<typeof crearAutoguardado>}
   */
  const autoDeRama = (armar) =>
    crearAutoguardado({
      // Recibe el DATO del store y deriva aquí, no antes: `cambiado()` se llama en cada
      // edición y derivar un Expediente entero en cada tecla sería copiar la geometría
      // por gusto. Cuando el debounce decide escribir, ya solo queda uno.
      guardar: (dato) => expedientes.guardarBorrador(armar(dato)),
      ms,
      ...(programar === undefined ? {} : { programar }),
      ...(cancelar === undefined ? {} : { cancelar }),
      ahora: () => ahora().getTime(),
      // `guardarBorrador` NO avisa por el canal cuando falla, y lo dice por escrito: el
      // autoguardado corre solo cada dos segundos y un fallo persistente llenaría el
      // panel de tarjetas idénticas. Quien lo cuenta —UNA vez por racha— es esto.
      //
      // ⚠️ La bandera es COMPARTIDA por los dos: el usuario no tiene dos almacenes,
      // tiene uno, y si se ha llenado la causa es la misma. Dos tarjetas diciendo lo
      // mismo con distinta palabra serían dos problemas para quien lee.
      alFallo: ({ consecutivos, causa }) => {
        if (dichoElFalloAuto) return
        dichoElFalloAuto = true
        avisar(MENSAJE_AUTOGUARDADO_ROTO, NIVEL.AVISO, causa)
        console.warn(`[expediente] el autoguardado lleva ${consecutivos} fallo(s) seguido(s):`, causa)
      },
      // Una racha rota vuelve a habilitar el aviso: si falla otra vez dentro de un rato,
      // es un incidente nuevo y merece contarse otra vez.
      alGuardado: () => {
        dichoElFalloAuto = false
      },
    })

  /** Los metadatos del borrador de una rama. Ver la cabecera: `creado` NO se reestampa. */
  const metadatosDe = (r) => ({
    creado: identidades[r].creado,
    modificado: identidades[r].modificado,
    autor: '',
    idDocumento: '',
  })

  const auto = autoDeRama((parcela) =>
    crearExpediente({ srs, parcela, metadatos: metadatosDe(RAMA.PARCELA) }),
  )

  /**
   * El de la rama EDIFICIO. **La parcela que hubiera debajo viaja como contexto**,
   * por el mismo `conParcelaDeContexto` con el que viajan «Guardar proyecto» y
   * `expedienteActual`: si no, recuperar el borrador devolvería el edificio flotando
   * sobre nada y el usuario no vería lo que dejó en pantalla.
   *
   * Nace aunque `estadoEdificio` sea `null` —una pantalla sin rama de edificio, que
   * es el montaje de todas las pruebas de F10—: sin suscriptor no recibe un solo
   * `cambiado()`, así que no escribe nada, y tenerlo evita un `if` en cada uso.
   */
  const autoEdificio = autoDeRama((edificio) =>
    crearExpediente({
      tipo: TIPO_EXPEDIENTE.EDIFICIO,
      srs,
      edificio: conParcelaDeContexto(edificio),
      metadatos: metadatosDe(RAMA.EDIFICIO),
    }),
  )

  // ── El diálogo ────────────────────────────────────────────────────────────

  const dialogo = crearDialogoExpediente({ documento: doc, alAvisar: panel.avisar })

  /**
   * ⛔ E3 (auditoría del 2026-08-16): el turno del último `refrescar` lanzado. Es el
   * patrón de la casa —contador monótono: se captura al lanzar y se coteja antes de
   * pintar—. Dos `listar()` concurrentes (p. ej. `duplicar` y un cambio de store con
   * el diálogo abierto) podían volver INVERTIDOS, y `fijar` pintaba la lista vieja
   * encima de la nueva: un duplicado recién creado desaparecía de pantalla.
   */
  let turnoRefresco = 0

  /**
   * Repinta el diálogo con lo que hay guardado ahora mismo.
   *
   * `nombre` se pasa SOLO cuando hay que cambiarlo: `fijar` sin esa clave no toca el
   * campo a propósito, para que un repintado no le borre al usuario un rótulo a medio
   * teclear.
   *
   * @param {{nombre?: string}} [opciones]
   */
  async function refrescar({ nombre } = {}) {
    const turno = (turnoRefresco += 1)
    const listado = await expedientes.listar()
    if (destruido) return
    // ⛔ E3: si mientras se leía el almacén alguien lanzó OTRO refresco, lo de este
    // turno ya es viejo y no se pinta — el que manda es siempre el último lanzado.
    if (turno !== turnoRefresco) return
    dialogo.fijar({
      registros: listado.registros.map((r) => ({ ...r, edad: edadDe(r.actualizado) })),
      borrador: ofrecido,
      srsActual: srs,
      puedeGuardar: puedeGuardarse(),
      ...(nombre === undefined ? {} : { nombre }),
    })
    // ⛔ F11 · el motivo VERDADERO del gate, justo después de `fijar`, que es quien
    // escribe ahí el genérico. Con la rama EDIFICIO el diálogo diría «todavía no hay
    // ninguna parcela en pantalla que guardar» —su único motivo, y vive en
    // `app/dialogo-expediente.js`, que esta tarea no toca—, y eso es FALSO: hay un
    // edificio, y lo que falta es el identificador. Un motivo equivocado manda al
    // usuario a arreglar lo que no está roto.
    if (enEdificio()) decir(MOTIVO_GUARDAR_EN_EDIFICIO)
  }

  /**
   * ¿Se puede guardar en el almacén lo que hay en pantalla? Dos condiciones, y la
   * segunda es de F11: que haya geometría **y** que no estemos en la rama EDIFICIO
   * (desviación 6 del plan; el porqué está en {@link MOTIVO_GUARDAR_EN_EDIFICIO}).
   */
  const puedeGuardarse = () => !enEdificio() && hayGeometria(estado.get())

  // ── Arranque ──────────────────────────────────────────────────────────────

  /**
   * Lo que pasa al cargar la página. **No abre nada y no mueve nada**: pregunta por la
   * persistencia, mira si hay trabajo de otra sesión y, si lo hay, lo OFRECE.
   *
   * `pedirPersistencia()` devuelve `false` y está MEDIDO (fase 0 de F10): la ficha de
   * la feature prometía que «evita el desalojo» y no lo evita en un perfil sin
   * interacción previa. Aun así se pide —en cuanto el usuario marque la página como
   * favorita o la instale, la MISMA llamada empieza a devolver `true`— y el resultado
   * **se dice**: en el acuse de cada guardado ({@link COLETILLA_SIN_PERSISTENCIA}) y,
   * si ya hay trabajo guardado que perder, también al arrancar. No se dice al
   * arrancar cuando no hay nada guardado, y esa es la única concesión: una advertencia
   * sobre la conservación de un dato que todavía no existe no informa, asusta.
   */
  async function arrancar() {
    persistencia = await cuota.pedirPersistencia()
    if (destruido) return

    const listado = await expedientes.listar()
    if (destruido) return

    // ⛔ F12 · T4.3 · se leen los borradores de TODAS las ramas que tengan uno, no
    // «el» borrador. `listar()` dice cuáles hay (`borradores`), y el respaldo a
    // PARCELA es lo que mantiene en pie las pruebas de F10, que no conocen el campo.
    const conBorrador = listado.borradores ?? (listado.hayBorrador ? [TIPO_EXPEDIENTE.PARCELA] : [])
    const encontrados = []
    for (const tipo of conBorrador) {
      const b = await expedientes.leerBorrador(tipo)
      if (destruido) return
      // Un borrador que no se puede leer NI se ofrece (no habría qué recuperar) NI se
      // pisa en silencio: se deja donde está. `recuperar` ya lo ha avisado por el
      // canal con su motivo; aquí solo se decide no armarse por él. Y los demás sí se
      // ofrecen: uno ilegible no puede secuestrar el trabajo de la otra rama.
      if (b.ok && b.registro !== null) {
        encontrados.push({ tipo, refcat: b.registro.refcat, edad: edadDe(b.registro.actualizado) })
      }
    }
    ofrecido = encontrados.length === 0 ? null : encontrados

    // La oferta del borrador SÍ sale por el panel: es de una sola vez por sesión, es
    // directamente accionable y desaparece en cuanto el usuario la resuelve.
    if (ofrecido !== null) {
      avisar(mensajeHayBorrador(ofrecido))
    }
    // ⛔ **Y el aviso de persistencia NO sale por aquí, y es una corrección MEDIDA**
    // (guion 12, 2026-08-03). Estaba puesto —al arrancar, si ya había algo guardado
    // que perder— y la primera corrida tras recargar lo delató: **la caja de
    // vértices pasaba de 267 a 215 px**, por debajo del suelo de 220 que este
    // proyecto lleva cinco fases defendiendo. Y a cambio de nada: a diferencia de la
    // oferta del borrador, este aviso NO se resuelve —vuelve en cada carga, para
    // siempre, en cuanto el usuario tiene un expediente guardado—.
    //
    // No se calla: se dice donde tiene consecuencias y donde se puede actuar —en el
    // acuse de CADA guardado ({@link COLETILLA_SIN_PERSISTENCIA}) y en el renglón del
    // diálogo al abrirlo, junto al texto de durabilidad que ya vive ahí—. Lo que se
    // quita es la TERCERA repetición, que es la única que cuesta píxeles permanentes.

    arrancado = true
    // Sin oferta pendiente, la espera se acaba aquí — y con ella se vuelca lo que
    // hubiera cambiado mientras se leía el almacén. Con oferta, la espera sigue: la
    // resolverá el usuario.
    if (ofrecido === null) resolverOferta()
    if (dialogo.abierto()) await refrescar()
  }

  // ── La degradación del criterio 4 ─────────────────────────────────────────

  /**
   * Se ha acabado el espacio. Purga la caché del Catastro **por antigüedad** y
   * reintenta.
   *
   * ⚠️ La caché no es comodidad: `MEJORES_PRACTICAS_GML.md` §2.4 la llama «el mayor
   * factor anti-bloqueo del cliente» frente al régimen O8. Por eso se purga POR
   * ANTIGÜEDAD y nunca a lo bruto, y por eso lo que se tira **se dice** — el usuario
   * notará que las próximas consultas tardan más y tiene derecho a saber por qué.
   *
   * Lo que esta purga **no puede** alcanzar son los expedientes ni el pie de firma:
   * `storage/cache-catastro.js` solo enruta sus propios almacenes, y hay una prueba
   * que lo afirma sembrando los otros dos.
   *
   * @param {() => Promise<{ok: boolean, mensaje?: string|null}>} reintentar
   * @returns {Promise<{ok: boolean, mensaje: string|null, registro?: object|null}>}
   */
  async function purgarYReintentar(reintentar) {
    if (cache === null) {
      return { ok: false, mensaje: MENSAJE_SIN_PURGA, registro: null }
    }
    const purga = await cache.purgarCaducados()
    if (destruido) return { ok: false, mensaje: null, registro: null }
    // `purgarCaducados` solo avisa por su cuenta cuando ha tirado algo; que no haya
    // tirado nada también es una respuesta y aquí sí importa, porque explica por qué
    // el reintento no va a servir de nada.
    if (!purga.ok || purga.purgados === 0) {
      return { ok: false, mensaje: `${purga.mensaje} ${MENSAJE_CUOTA_TRAS_PURGAR}`, registro: null }
    }
    const segundo = await reintentar()
    if (segundo.ok) return segundo
    return { ...segundo, mensaje: MENSAJE_CUOTA_TRAS_PURGAR }
  }

  // ── Las acciones del diálogo ──────────────────────────────────────────────

  /**
   * ⛔ E1 (auditoría del 2026-08-16): ¿hay un «Guardar» en vuelo? El diálogo emite
   * la acción en cada clic sin apagarse mientras dura la operación, así que la
   * guarda vive aquí. Ver {@link MENSAJE_YA_GUARDANDO}.
   */
  let guardando = false

  /** «Guardar». Crea el expediente o pone al día el que esté abierto. */
  async function guardar(nombre) {
    // ⛔ E1 · GUARDA DE REENTRADA (auditoría del 2026-08-16). La identidad se fija
    // DESPUÉS del `await` de la escritura: dos clics dentro de la latencia de
    // IndexedDB veían los dos `id === null` y creaban DOS registros duplicados.
    // Mismo patrón que `componiendo` en `app/cableado-informe.js`. El botón NO se
    // apaga desde aquí a propósito: su gate lo gobierna `fijar` con `puedeGuardar`
    // —un segundo dueño del `disabled` es la divergencia que esta casa evita— y la
    // ventana son milisegundos; lo que hace falta es que la segunda pulsación no
    // escriba y LO DIGA (regla de oro 1), no un parpadeo del botón.
    if (guardando) {
      decir(MENSAJE_YA_GUARDANDO)
      return
    }
    // ⛔ F11 · la guarda que NO depende del `disabled` del botón. El diálogo lo apaga
    // —`refrescar` le pasa `puedeGuardar: false`— pero un `disabled` es cortesía:
    // exactamente el mismo argumento que ya escribió `recuperar` para el huso. Y aquí
    // importa más, porque el precio de que se colara es guardar el expediente de la
    // parcela mientras el usuario está mirando un edificio, en silencio.
    if (enEdificio()) {
      decir(MOTIVO_GUARDAR_EN_EDIFICIO)
      return
    }
    const exp = expedienteActual()
    if (exp === null) {
      decir(MENSAJE_SIN_PARCELA, { error: true })
      return
    }
    // ⛔ E2 · LA RAMA SE FOTOGRAFÍA ANTES DEL PRIMER `await` (auditoría del
    // 2026-08-16) y la foto se usa en todo el recorrido. Se leía `ramaActual()`
    // DESPUÉS de la escritura, con la rama de ESE instante: una conmutación durante
    // los milisegundos de IndexedDB apuntaba el registro guardado a la identidad de
    // la OTRA rama — la parcela quedaba «sin guardar» y el edificio con un `id` que
    // no es suyo. El expediente (`exp`) ya era una foto; la rama también tiene que serlo.
    const ramaFoto = ramaActual()
    guardando = true
    try {
      const opts = {
        ...(nombre === null ? {} : { nombre }),
        ...(identidades[ramaFoto].id === null ? {} : { id: identidades[ramaFoto].id }),
      }
      let r = await expedientes.guardar(exp, opts)
      if (destruido) return
      if (!r.ok && r.esCuota) {
        r = await purgarYReintentar(() => expedientes.guardar(exp, opts))
        if (destruido) return
      }
      if (!r.ok) {
        // El almacén ya ha avisado por el panel con su motivo técnico; aquí se escribe
        // en el renglón, que es donde está mirando quien acaba de pulsar.
        decir(r.mensaje ?? 'No se ha podido guardar el expediente.')
        return
      }
      identidades[ramaFoto] = {
        id: r.registro.id,
        nombre: r.registro.nombre,
        creado: r.registro.creado,
        modificado: r.registro.actualizado,
      }
      // Archivar y renombrar salen los dos por aquí —renombrar es guardar el MISMO
      // registro con otro nombre—, y ninguno de los dos toca un store: sin este aviso
      // la barra sigue diciendo «Sin guardar» con el acuse al lado. Ver el canal.
      notificarIdentidad()
      await refrescar({ nombre: r.registro.nombre })
      if (destruido) return
      // Rework de UI · T7: el acuse dice también lo que NO ha entrado. Va en la MISMA
      // llamada a `decir` porque el renglón es uno solo y la segunda borraría la primera.
      // ⚠️ Con la FOTO de la rama (E2): el acuse describe el documento que se acaba de
      // escribir, no lo que la pantalla esté mirando ahora.
      const fuera = loQueSeQuedaFuera(DOCUMENTO.GUARDADO, ramaFoto)
      decir(
        `Guardado «${r.registro.nombre}» en este navegador.` +
          (persistencia?.persistido === false ? COLETILLA_SIN_PERSISTENCIA : '') +
          (fuera === null ? '' : ` ${fuera}`),
      )
      // Y al panel, que es donde queda constancia de lo que le pasa al DATO: el renglón
      // del diálogo se lo lleva el siguiente `fijar`, y esto hay que poder releerlo con
      // el diálogo ya cerrado. El panel agrupa los repetidos con su contador, así que
      // guardar diez veces con un edificio cargado deja una tarjeta, no diez.
      if (fuera !== null) avisar(fuera)
    } finally {
      guardando = false
    }
  }

  /** «Recuperar» de una fila. */
  async function recuperar(id) {
    const r = await expedientes.recuperar(id)
    if (destruido) return
    if (!r.ok) {
      decir(r.mensaje ?? 'No se ha podido recuperar ese expediente.')
      return
    }
    // Guarda de cinturón sobre el huso. El diálogo ya apaga el botón de las filas de
    // otro `srs` con el motivo escrito, pero un `disabled` es cortesía: la garantía es
    // esta comprobación, y el texto es EL MISMO —importado, no redactado otra vez—.
    if (r.registro.srs !== srs) {
      decir(motivoOtroHuso(r.registro.srs))
      return
    }
    const parcela = r.expediente?.parcela ?? null
    if (!hayGeometria(parcela)) {
      decir(MENSAJE_GUARDADO_SIN_PARCELA)
      return
    }
    cargar(parcela, {
      id: r.registro.id,
      nombre: r.registro.nombre,
      creado: r.expediente.metadatos?.creado ?? r.registro.creado,
      modificado: r.registro.actualizado,
    })
    decir(`Abierto «${r.registro.nombre}».`)
    // Se CIERRA: recuperar un expediente es pedir que se abra en el visor, y dejar el
    // diálogo tapando el mapa obligaría a un segundo gesto para ver lo que se acaba de
    // pedir. Lo que ha pasado no queda mudo —cambia la geometría del mapa, la tabla de
    // vértices y la ficha del pie entera—, y el renglón de arriba lo dice para cuando
    // se vuelva a abrir.
    dialogo.cerrar()
  }

  /** «Duplicar» de una fila. */
  async function duplicar(id) {
    let r = await expedientes.duplicar(id)
    if (destruido) return
    if (!r.ok && r.esCuota) {
      r = await purgarYReintentar(() => expedientes.duplicar(id))
      if (destruido) return
    }
    if (!r.ok) {
      decir(r.mensaje ?? 'No se ha podido duplicar ese expediente.')
      return
    }
    await refrescar()
    if (destruido) return
    decir(`Duplicado: se ha creado «${r.registro.nombre}».`)
  }

  /** «Borrar» de una fila, en dos tiempos. Ver {@link MS_CONFIRMAR_BORRADO}. */
  async function borrar(id) {
    const t = ahora().getTime()
    if (armado === null || armado.id !== id || t > armado.hasta) {
      armado = { id, hasta: t + MS_CONFIRMAR_BORRADO }
      decir(
        'Vuelve a pulsar «Borrar» en esa misma fila para confirmarlo. Se borra de este navegador ' +
          'y no se puede deshacer; si quieres conservarlo, guárdalo antes como fichero de proyecto.',
      )
      return
    }
    armado = null
    const r = await expedientes.borrar(id)
    if (destruido) return
    if (!r.ok) {
      decir(r.mensaje ?? 'No se ha podido borrar ese expediente.')
      return
    }
    // Si el borrado era el expediente ABIERTO, lo que hay en pantalla deja de
    // corresponder a ningún registro. No se toca la geometría —el usuario no ha pedido
    // cerrar nada— pero la identidad se suelta, para que el siguiente «Guardar» cree un
    // registro nuevo en vez de resucitar el que se acaba de borrar.
    // Se mira en las DOS ramas y no solo en la activa: el registro borrado puede ser
    // el que estaba abierto en la otra, y dejarle ahí el `id` haría que el siguiente
    // «Guardar» de aquella rama resucitara lo que se acaba de borrar.
    let soltada = false
    for (const r of Object.keys(identidades)) {
      if (identidades[r].id === id) {
        identidades[r] = { ...identidades[r], id: null, nombre: null }
        soltada = true
      }
    }
    // Solo si de verdad se ha soltado alguna: borrar un registro que no era el
    // abierto no cambia qué expediente tengo, y avisar igual convertiría el canal en
    // ruido. Ver el canal de identidad.
    if (soltada) notificarIdentidad()
    await refrescar()
    if (destruido) return
    decir('Borrado de este navegador.')
  }

  /**
   * Las ramas que se están ofreciendo. Con la oferta ya resuelta —o sin ella— es la
   * de PARCELA, que es lo que hacían las llamadas de F10 sin decirlo.
   *
   * @returns {string[]}
   */
  const ramasOfrecidas = () =>
    ofrecido === null || ofrecido.length === 0
      ? [TIPO_EXPEDIENTE.PARCELA]
      : ofrecido.map((b) => b.tipo)

  /**
   * «Recuperar» el borrador del autoguardado.
   *
   * ⛔ **Recupera TODAS las ramas ofrecidas, no una** (F12 · T4.3). No son documentos
   * que compitan: son las dos mitades de lo que había en pantalla, y devolver solo una
   * sería devolver media sesión. Lo que sí es exclusivo es la RAMA que queda puesta al
   * acabar, y se elige la del borrador **más reciente**, que es la respuesta a «sigue
   * donde lo dejaste».
   *
   * Un borrador que no se puede abrir no impide abrir el otro: se cuenta al final, con
   * el resto, en una sola frase.
   */
  async function recuperarBorrador() {
    const lecturas = []
    for (const tipo of ramasOfrecidas()) {
      const r = await expedientes.leerBorrador(tipo)
      if (destruido) return
      lecturas.push({ tipo, r })
    }

    // Lo que sí se puede abrir, y por qué no lo demás. Las dos listas se llenan en el
    // mismo bucle para que no puedan discrepar en el recuento.
    const abribles = []
    const estorbos = []
    for (const { tipo, r } of lecturas) {
      if (!r.ok) {
        estorbos.push(r.mensaje ?? 'Ya no queda trabajo autoguardado que recuperar.')
        continue
      }
      if (r.registro.srs !== srs) {
        estorbos.push(motivoOtroHuso(r.registro.srs))
        continue
      }
      const parcela = r.expediente?.parcela ?? null
      const edificio = r.expediente?.edificio ?? null
      if (tipo === TIPO_EXPEDIENTE.EDIFICIO) {
        // Sin rama de edificio montada no hay dónde ponerlo, y decirlo es mejor que
        // abrirlo en un store que nadie mira (es el mismo criterio de `abrirProyecto`).
        if (!hayEdificio(edificio) || rama === null || estadoEdificio === null) {
          estorbos.push(MENSAJE_GUARDADO_SIN_EDIFICIO)
          continue
        }
      } else if (!hayGeometria(parcela)) {
        estorbos.push(MENSAJE_GUARDADO_SIN_PARCELA)
        continue
      }
      abribles.push({ tipo, r })
    }

    // El borrador NO se borra al recuperarlo, y es distinto de lo que sugiere la
    // cabecera de `storage/expedientes.js`: allí se razona para un mundo sin
    // autoguardado vivo. Aquí, borrarlo dejaría el trabajo sin red durante los dos
    // segundos siguientes y el propio debounce lo reescribiría igual. Lo que se acaba
    // es la OFERTA, que es de una sola vez por sesión.
    // ⚠️ La oferta se resuelve ANTES de cargar, no después. `estado.set` notifica de
    // forma SÍNCRONA, así que con la oferta todavía en pie nuestro propio suscriptor
    // se despertaría dentro de la espera y sacaría por el panel un
    // {@link MENSAJE_AUTOGUARDADO_EN_ESPERA} — un aviso de que no se guarda lo que se
    // acaba de recuperar, justo mientras se recupera.
    resolverOferta()

    if (abribles.length === 0) {
      await refrescar()
      if (destruido) return
      decir(estorbos[0] ?? 'Ya no queda trabajo autoguardado que recuperar.')
      return
    }

    // ⚠️ **Del más antiguo al más reciente, y por eso se ordena.** Cada carga conmuta
    // a su rama, así que la ÚLTIMA es la que queda en pantalla: cargar en el orden del
    // almacén dejaría puesta la rama que el usuario tocó primero.
    abribles.sort((a, b) => String(a.r.registro.actualizado).localeCompare(String(b.r.registro.actualizado)))

    for (const { tipo, r } of abribles) {
      const nueva = {
        id: null,
        nombre: null,
        creado: r.expediente.metadatos?.creado ?? r.registro.creado,
        modificado: r.registro.actualizado,
      }
      if (tipo === TIPO_EXPEDIENTE.EDIFICIO) cargarEdificio(r.expediente.edificio, nueva)
      else cargar(r.expediente.parcela, nueva)
    }

    const que = enumerarBorradores(abribles.map(({ tipo, r }) => ({ tipo, refcat: r.registro.refcat })))
    decir(
      `Recuperado el trabajo autoguardado ${que}. Todavía no está guardado como expediente.` +
        (estorbos.length === 0 ? '' : ` ${estorbos.join(' ')}`),
    )
    dialogo.cerrar()
  }

  /**
   * «Descartar» el borrador. **Descarta las ramas ofrecidas, todas**: la oferta es una
   * y el gesto es uno, y dejar media atrás la resucitaría en la carga siguiente
   * —después de que el usuario ya hubiera dicho que no la quería—.
   */
  async function descartarBorrador() {
    const fallos = []
    for (const tipo of ramasOfrecidas()) {
      const r = await expedientes.descartarBorrador(tipo)
      if (destruido) return
      if (!r.ok) fallos.push(r.mensaje ?? 'No se ha podido descartar el trabajo autoguardado.')
    }
    resolverOferta()
    await refrescar()
    if (destruido) return
    decir(
      fallos.length === 0
        ? 'Descartado el trabajo autoguardado. A partir de ahora se guarda solo lo de esta sesión.'
        : fallos.join(' '),
    )
  }

  /**
   * La oferta se acabó: el autoguardado se arma, deja de estar en espera y **vuelca
   * lo que hubiera cambiado durante la espera**. Esa última parte es la que impide
   * que una edición hecha con la oferta en pie se quede sin guardar para siempre.
   */
  function resolverOferta() {
    ofrecido = null
    dichaLaEspera = false
    // ⛔ F12 · T4.3 · aquí había una excepción —«con la rama EDIFICIO activa no se
    // vuelca»— que existía porque el autoguardado no llegaba a esa rama. Ahora llega,
    // y cada una escribe en su clave, así que se vuelca lo que cada una tenga pendiente.
    if (hayEnEspera()) volcarLoPendiente()
  }

  // ── Las cuatro exportaciones ──────────────────────────────────────────────

  /**
   * Entrega un fichero. Punto único para las cuatro salidas: el nombre, el MIME y el
   * acuse se deciden en un solo sitio, así que no pueden divergir.
   *
   * ⭐ **Desde F20 admite BYTES además de texto**, y el reparto se hace por el tipo de
   * lo que llega, no por un parámetro que haya que acordarse de pasar. El motivo de
   * que no valga un solo primitivo está escrito en `gml/descargar.js`: `descargarTexto`
   * codifica en UTF-8 por especificación, así que pasar por él los bytes de un `.xlsx`
   * —que es un ZIP— los **corrompería en silencio**, con la firma `PK` intacta al
   * principio y el defecto invisible hasta que Excel dijera que el fichero está dañado.
   * Es el mismo motivo por el que F09 tuvo que escribir `descargarBinario` para el PDF.
   *
   * Se elige por tipo y no por bandera precisamente porque una bandera se olvida: quien
   * añada la quinta salida no tiene que leer esta cabecera para acertar.
   *
   * @param {string|Uint8Array} contenido  Texto, o los bytes de un fichero binario.
   * @param {{prefijo: string, extension: string, mime: string}} formato
   * @param {Date} fecha
   * @param {string} queEs  Cómo se llama en el acuse.
   * @param {string|null} [coletilla=null]  Lo que se queda fuera del fichero, cuando
   *   algo se queda (rework de UI · T7). Va pegada al acuse **y solo si la descarga ha
   *   salido**: contarle a alguien qué no lleva un fichero que no ha llegado a bajar es
   *   ruido encima de un fallo.
   */
  function entregar(contenido, formato, fecha, queEs, coletilla = null) {
    const nombreFichero = nombreFicheroExport({
      prefijo: formato.prefijo,
      extension: formato.extension,
      refcat: refcatActual(),
      fecha,
    })
    const opcionesDescarga = { nombreFichero, mime: formato.mime, documento: doc, url }
    const entrega =
      typeof contenido === 'string'
        ? descargarTexto(contenido, opcionesDescarga)
        : descargarBinario(contenido, opcionesDescarga)
    // El desenlace se dice SIEMPRE, salga bien o mal. Cuando falla, los dos primitivos
    // traen un `mensaje` en castellano ya presentable.
    if (!entrega.descargado) {
      decir(entrega.mensaje, { error: true })
      avisar(entrega.mensaje, NIVEL.ERROR)
      return
    }
    decir(
      `Descargado ${queEs}: «${entrega.nombre}».${coletilla === null ? '' : ` ${coletilla}`}`,
      { exito: true },
    )
    // Al panel por el mismo motivo que {@link publicarDetecciones}: el fichero que baja
    // no dice todo lo que el usuario tiene en pantalla, y eso es del DATO.
    if (coletilla !== null) avisar(coletilla)
  }

  // ── El predicado de las salidas, y sus dos usos ────────────────────────────
  //
  // ⭐ **HASTA EL 2026-08-11 ESTO NO EXISTÍA COMO DATO.** Cada `exportar*` repetía
  // su regla a mano con dos `if` seguidos —la rama y el dato— y el motivo se decía
  // AL PULSAR. Eso dejaba la aplicación con una incoherencia que se veía: los tres
  // peldaños del recorrido se apagan con motivo, «Generar GML» se apaga con motivo,
  // y las cuatro salidas no podían porque su disponibilidad solo vivía dentro de
  // aquellos `if`. Ver `app/salidas.js`, donde vive ahora la regla, y `TODOS.md`,
  // donde esto estuvo aplazado desde el 2026-08-09 esperando a que el menú existiera.
  //
  // ⚠️ **Y el predicado tiene DOS llamantes, que es todo el punto**: la guarda de la
  // acción (aquí abajo) y el pintado del menú ({@link refrescarSalidas}). Si fueran
  // dos reglas, el día que una cambiara el menú ofrecería lo que la acción rechaza.

  /**
   * Los dos hechos que `app/salidas.js` necesita, resueltos aquí porque es quien
   * conoce los dos stores. Los MISMOS predicados que alimentan el rail de
   * navegación ({@link hayGeometria}, {@link hayEdificio}), y no una tercera copia.
   */
  const hechosDeSalida = () => ({
    parcela: hayGeometria(estado.get()),
    edificio: hayEdificio(edificioActual()),
  })

  /** La situación completa, que es lo único que el predicado recibe. */
  const situacionDeSalida = () => ({ rama: ramaActual(), hechos: hechosDeSalida() })

  /**
   * La guarda de una salida. Si no se puede, lo DICE y devuelve `true`.
   *
   * ⚠️ Sigue diciéndolo al pulsar, y eso no es el trabajo a medias: es la red. El
   * menú ya lo apaga con su motivo antes de pulsar, pero las cuatro acciones también
   * entran por `atender()` —el guion de humo las llama, y mañana un atajo de teclado
   * podría— y una acción que se fía de que su botón estuviera apagado es una acción
   * sin guarda. Lo que se ha ido es la DUPLICACIÓN de la regla, no la comprobación.
   *
   * @param {string} salida  Una de `SALIDA`.
   * @returns {boolean} `true` si NO se puede (y ya se ha dicho por qué).
   */
  function bloqueada(salida) {
    const veredicto = evaluarSalida(salida, situacionDeSalida())
    if (veredicto.disponible) return false
    decir(veredicto.motivo, { error: true })
    return true
  }

  /**
   * Los nodos de las cuatro salidas, resueltos UNA vez al montar.
   *
   * ⚠️ **`doc.querySelector` se queda con el PRIMERO del documento**, que es la trampa
   * K.1 de esta casa. Aquí es seguro y por una razón comprobable, no por suerte: las
   * tres exportaciones de geometría se RETIRARON de `app/dialogo-expediente.js` el
   * 2026-08-11 justamente para que hubiera un nodo por acción, y `exportar-proyecto`
   * sigue existiendo solo dentro del `<dialog>`. Un nodo cada una.
   *
   * Se resuelven una vez y no en cada repintado porque **ninguno se reconstruye**: los
   * tres de la barra son marcado de `index.html` y el del diálogo se fabrica en su
   * constructor y vive en `pieFicheros`, que `fijar()` no toca (lo que `fijar()`
   * reemplaza es la LISTA de registros).
   */
  const nodosDeSalida = new Map()

  /**
   * El `<span>` de texto oculto de una opción, creándolo la primera vez.
   *
   * ⛔ **Por qué hace falta si nunca se ve.** Una opción `disabled` cuyo nombre
   * accesible es «Exportar para CAD .dxf» a secas le dice a quien va por lector de
   * pantalla que no puede, y nada más — que es la definición de apagado y mudo, o sea
   * la regla de oro 1 al revés. Con esto el nombre pasa a ser «Exportar para CAD .dxf
   * · Falta la parcela». Es la MISMA receta que el rail volvió a decidir el
   * 2026-08-10 para su motivo breve.
   *
   * ⚠️ **Reutiliza `.gml-rotulo-oculto`, que ya existe y es genérica a propósito**
   * («hoy la usa la cabecera de la columna de borrado y mañana la usará el siguiente
   * rótulo que haya que decir sin escribir», dice su bloque en `estilos/app.css`). Así
   * esta feature cuesta **0 B de hoja**, que desde hoy no es un detalle: el techo del
   * criterio 10 quedó clavado en la medición de esta misma fecha.
   *
   * ⚠️ Y va DENTRO del botón, no en un `aria-describedby` aparte: la forma breve es
   * parte de qué es este control ahora mismo, y un `describedby` en un `<button>`
   * `disabled` no lo anuncian todos los lectores.
   */
  function motivoOculto(nodo) {
    const puesto = nodo.querySelector(`.${CLASE_MOTIVO_SALIDA}`)
    if (puesto !== null) return puesto
    const span = doc.createElement('span')
    span.className = CLASE_MOTIVO_SALIDA
    nodo.append(span)
    return span
  }

  /**
   * Apaga o enciende las cuatro salidas, **con su motivo puesto en el mismo paso**.
   *
   * ⭐ Esto es lo que cierra «Las salidas no saben decir si se pueden». Antes del
   * 2026-08-11 las cuatro estaban siempre encendidas y contestaban al pulsarlas;
   * ahora son lo mismo que un peldaño del recorrido o que «Generar GML»: apagadas
   * cuando no se puede, con la forma LARGA en el `title` y la BREVE en el nombre
   * accesible.
   *
   * ⛔ **Se APAGAN, jamás se retiran del menú**, que es la regla dura del rail escrita
   * en `app/barra.js`: una opción que desaparece deja al usuario preguntándose si la
   * recordaba mal, y un menú que cambia de tamaño según el estado no se aprende nunca.
   *
   * ⚠️ **Y no hay que enseñarle nada a `app/barra.js`**: su mecanismo de menús ya
   * pone el foco en `[role="menuitem"]:not([disabled])`, así que abrir el desplegable
   * con la primera opción apagada aterriza en la primera que sí se puede. Estaba
   * escrito antes de que hubiera una sola opción que se apagara.
   */
  function refrescarSalidas() {
    if (destruido) return
    for (const v of evaluarSalidas(situacionDeSalida())) {
      const nodo = nodosDeSalida.get(v.salida)
      if (nodo === undefined) continue
      nodo.disabled = !v.disponible
      if (v.disponible) {
        nodo.removeAttribute('title')
        motivoOculto(nodo).textContent = ''
      } else {
        nodo.title = v.motivo
        // El separador va aquí y no en la tabla de motivos: es cosa de cómo se
        // concatena un nombre accesible, no del motivo.
        motivoOculto(nodo).textContent = ` · ${v.breve}`
      }
    }
  }

  /** «Exportar DXF para CAD». */
  function exportarDxf() {
    if (bloqueada(SALIDA.DXF)) return
    const parcela = estado.get()
    const { dxf, detecciones } = serializarParcelaDxf({
      recintosEditados: parcela.recintos,
      // La geometría OFICIAL va tal cual está (regla de oro 2). `null` cuando la
      // parcela no vino del Catastro: sale una capa en vez de dos, y se declara.
      recintosOficiales: parcela.geometriaOficial ?? null,
    })
    publicarDetecciones(detecciones)
    entregar(dxf, FICHERO.DXF, ahora(), 'el DXF')
  }

  /** «Exportar coordenadas (.txt)». */
  function exportarCoordenadas() {
    if (bloqueada(SALIDA.COORDENADAS)) return
    const parcela = estado.get()
    const fecha = ahora()
    const { texto, detecciones } = serializarCoordenadasTxt({
      recintos: parcela.recintos,
      refcat: parcela.refcat ?? null,
      srs,
      fecha,
      nombre: identidadActual().nombre,
    })
    publicarDetecciones(detecciones)
    entregar(texto, FICHERO.COORDENADAS, fecha, 'el listado de coordenadas')
  }

  /**
   * «Exportar coordenadas (.xlsx)» — F20.
   *
   * Gemela de {@link exportarCoordenadas} hasta en el orden de las líneas, y es lo
   * que se quiere: **son el mismo documento en dos envases**, así que reciben lo mismo
   * y comparten hasta la aritmética (`export/coordenadas.js#prepararListado`). Lo
   * único que cambia es el escritor y que lo que baja son bytes.
   */
  function exportarExcel() {
    if (bloqueada(SALIDA.EXCEL)) return
    const parcela = estado.get()
    const fecha = ahora()
    const { bytes, detecciones } = serializarCoordenadasExcel({
      recintos: parcela.recintos,
      refcat: parcela.refcat ?? null,
      srs,
      fecha,
      nombre: identidadActual().nombre,
    })
    publicarDetecciones(detecciones)
    entregar(bytes, FICHERO.EXCEL, fecha, 'el listado de coordenadas en Excel')
  }

  /**
   * «Guardar proyecto (.json)».
   *
   * ⭐ **Es la ÚNICA salida que sirve para las dos ramas**, y en F11 pasa a ser algo
   * más que una comodidad: siendo el almacén de este navegador incapaz de archivar un
   * edificio (desviación 6), este fichero es el único sitio donde un edificio se
   * conserva. `expedienteActual()` ya devuelve la rama que toca, así que aquí no hay
   * ni un `if`: lo que cambia es el mensaje de cuando no hay nada.
   *
   * ⚠️ **La guarda pasó a ser {@link bloqueada} el 2026-08-11 y NO comprueba
   * `exp === null` detrás**, que parecería lo prudente. No lo es: sería código
   * imposible de alcanzar, y por un motivo comprobable, no por confianza.
   * `expedienteActual()` devuelve `null` en exactamente dos casos —`!hayEdificio()` en
   * la rama EDIFICIO y `!hayGeometria()` en PARCELA— que son **los dos hechos que el
   * predicado acaba de exigir**, calculados con las mismas dos funciones. Las dos
   * ramas no pueden discrepar porque leen lo mismo. Lo que `expedienteActual()` sí
   * puede hacer es LANZAR, si el store tiene una parcela estructuralmente rota, y de
   * eso se sigue encargando el `try` de `alAccion`.
   *
   * ⭐ Y con el cambio, este motivo **pasa a decirse en rojo como los otros tres**.
   * Era la única de las cuatro salidas que llamaba a `decir()` sin `{error: true}`:
   * el renglón salía en gris, indistinguible de un acuse normal.
   */
  function exportarProyecto(nombre) {
    if (bloqueada(SALIDA.PROYECTO)) return
    const exp = expedienteActual()
    const fecha = ahora()
    const proyecto = aProyecto(exp, { fecha, nombre: nombre ?? identidadActual().nombre })
    // Con sangría de 2: un fichero de proyecto se abre a mano más veces de las que
    // parece —para ver por qué otro equipo no lo puede leer—, y lo que se gana en
    // bytes al compactarlo se pierde en la primera vez que alguien tiene que mirarlo.
    entregar(
      JSON.stringify(proyecto, null, 2),
      FICHERO.PROYECTO,
      fecha,
      'el fichero de proyecto',
      // Rework de UI · T7. Es la ÚNICA de las tres salidas que lo lleva: el DXF y el
      // listado no descartan ninguna rama —son de la parcela por definición y con la
      // rama EDIFICIO ni siquiera bajan ({@link MENSAJE_EXPORTAR_PARCELA_EN_EDIFICIO})—.
      loQueSeQuedaFuera(DOCUMENTO.PROYECTO),
    )
  }

  /**
   * Abre un fichero de proyecto. Es lo que recibe la zona de fichero cuando la
   * extensión es `.json`, y también lo que hace «Abrir un proyecto…».
   *
   * **No lanza por el contenido del fichero**, que es la lección de F08 entera:
   * `deProyecto` devuelve su motivo y sus avisos, y aquí se cuentan.
   *
   * @param {File} fichero
   * @returns {Promise<void>}
   */
  async function abrirProyecto(fichero) {
    if (destruido) return
    // La puerta se reclama al ACEPTAR, no al terminar de leer. Ver
    // {@link mensajeFicheroSuperado}.
    const nombreEste = typeof fichero?.name === 'string' ? fichero.name : 'el fichero'
    const turno = (secuenciaFichero += 1)
    ficheroVigente = nombreEste
    let texto
    try {
      texto = await fichero.text()
    } catch (causa) {
      avisar(
        `No se ha podido leer «${fichero?.name ?? 'el fichero'}»: el navegador no ha dejado ` +
          'acceder a su contenido. Prueba a copiarlo a otra carpeta y volver a abrirlo.',
        NIVEL.ERROR,
        causa,
      )
      return
    }
    if (destruido) return
    if (turno !== secuenciaFichero) {
      // Llegó otro mientras este se leía: manda el otro, y se DICE (regla de oro 1).
      avisar(mensajeFicheroSuperado(nombreEste, ficheroVigente ?? 'el siguiente'), NIVEL.AVISO)
      return
    }

    const r = deProyecto(texto)
    // Los avisos van SIEMPRE, salga bien o mal la lectura: una clave desconocida o una
    // versión posterior son cosas que el usuario tiene que saber aunque el fichero se
    // haya podido abrir (regla de oro 1).
    publicarDetecciones(r.avisos)
    if (!r.ok) {
      avisar(r.mensaje, NIVEL.ERROR)
      decir(r.mensaje)
      return
    }
    if (r.expediente.srs !== srs) {
      avisar(motivoOtroHuso(r.expediente.srs), NIVEL.ERROR)
      decir(motivoOtroHuso(r.expediente.srs))
      return
    }
    // ⛔ F11 · UN `.json` DE EDIFICIO CONMUTA LA RAMA. Antes de esto, el expediente de
    // edificio se leía entero (`export/proyecto.js` lo admite desde F10) y **se caía
    // por el desagüe**: la rama `parcela` venía `null`, así que salía por el
    // «no lleva ninguna parcela» de abajo y el trabajo no aparecía por ninguna parte.
    // Ahora va al store que le corresponde y la pantalla se conmuta para enseñarlo.
    if (r.expediente.tipo === TIPO_EXPEDIENTE.EDIFICIO) {
      abrirProyectoDeEdificio(r, fichero)
      return
    }
    const parcela = r.expediente.parcela ?? null
    if (!hayGeometria(parcela)) {
      avisar(MENSAJE_GUARDADO_SIN_PARCELA)
      decir(MENSAJE_GUARDADO_SIN_PARCELA)
      return
    }
    // Entra SIN identificador: el fichero viene de otro equipo o de otra sesión y no se
    // corresponde con ningún registro de ESTE navegador. El primer «Guardar» creará el
    // suyo. El nombre sí viaja, porque es del trabajo y no del almacén.
    cargar(parcela, {
      id: null,
      nombre: r.nombre,
      creado: r.expediente.metadatos?.creado ?? instanteISO(),
      modificado: instanteISO(),
    })
    avisar(
      `Abierto el proyecto «${r.nombre ?? fichero.name}». Todavía no está guardado en este ` +
        'navegador: usa «Guardar» en «Expediente» si quieres conservarlo aquí.',
    )
    decir(`Abierto el proyecto «${r.nombre ?? fichero.name}».`)
    dialogo.cerrar()
  }

  /**
   * La mitad de {@link abrirProyecto} que va por la rama EDIFICIO. Está aparte para que
   * la de parcela se lea igual que en F10 y para que las dos degradaciones nuevas —sin
   * rama montada, y un expediente de edificio sin edificio dentro— no se escondan
   * dentro de una cadena de `if`.
   *
   * **No toca nada cuando no puede abrir**: lo que hubiera en pantalla se queda como
   * estaba, y se dice por los dos canales.
   *
   * @param {{expediente: object, nombre: string|null}} r  Lo que devolvió `deProyecto`.
   * @param {File} fichero
   */
  function abrirProyectoDeEdificio(r, fichero) {
    const edificio = r.expediente.edificio ?? null
    if (!hayEdificio(edificio)) {
      avisar(MENSAJE_GUARDADO_SIN_EDIFICIO)
      decir(MENSAJE_GUARDADO_SIN_EDIFICIO)
      return
    }
    if (rama === null || estadoEdificio === null) {
      avisar(MENSAJE_SIN_RAMA_EDIFICIO, NIVEL.ERROR)
      decir(MENSAJE_SIN_RAMA_EDIFICIO)
      return
    }
    // Entra SIN identificador **de expediente**, igual que la parcela y por lo mismo:
    // el fichero viene de otro equipo o de otra sesión.
    //
    // ⚠️ La IDENTIDAD LOCAL sí se le pone si no traía ninguna (F12 · T4.3): un `.json`
    // escrito antes de esta fase lleva dentro un `Edificio` con `idLocal: null`, y sin
    // identidad no se autoguarda ({@link alCambiarElEdificio} lo dice y calla). El
    // nombre sale del propio fichero, que es lo único que consta — mismo último
    // recurso que en la rama de parcela.
    const nombreFichero = r.nombre ?? fichero.name
    const deFichero = typeof nombreFichero === 'string' ? nombreFichero.trim() : ''
    const conIdentidad =
      (edificio.idLocal ?? null) !== null
        ? edificio
        : conIdLocal(edificio, deFichero === '' ? IDENTIDAD_DE_PROYECTO : deFichero).edificio
    cargarEdificio(conIdentidad, {
      id: null,
      nombre: r.nombre,
      creado: r.expediente.metadatos?.creado ?? instanteISO(),
      modificado: instanteISO(),
    })
    // El aviso dice lo que ha pasado Y lo que NO va a poder hacer, en el mismo sitio:
    // enterarse de que un edificio no se archiva **después** de haber trabajado una
    // hora es enterarse tarde. ⚠️ Ya no dice «no lo puede guardar»: desde T4.3 lo
    // autoguarda. Lo que no hace es archivarlo con nombre.
    avisar(
      `Abierto el proyecto «${nombreFichero}», que lleva un edificio: la pantalla ha ` +
        'cambiado a la rama Edificio para enseñarlo. Esta versión lo autoguarda pero no lo ' +
        'archiva con nombre en este navegador, así que consérvalo con «Guardar proyecto (.json)».',
    )
    decir(`Abierto el proyecto «${r.nombre ?? fichero.name}» en la rama Edificio.`)
    dialogo.cerrar()
  }

  /** «Abrir un proyecto…»: abre el selector de la ÚNICA zona de fichero de la app. */
  function pedirProyecto() {
    if (elegirFichero === null) {
      decir(MENSAJE_SIN_SELECTOR)
      avisar(MENSAJE_SIN_SELECTOR)
      return
    }
    elegirFichero()
  }

  // ── Oyentes ───────────────────────────────────────────────────────────────

  /**
   * Todas las intenciones del diálogo entran por aquí. **Suelta la promesa a
   * propósito y no puede lanzar**: una excepción dentro de un oyente del DOM no sale
   * por `dispatchEvent` (medido en F08), así que dejarla propagar sería un error
   * silencioso. El diálogo tiene su propia red (`MENSAJE_OYENTE_ROTO`) y aquí se
   * atrapa antes, para poder decir de qué acción se trataba.
   *
   * @param {{accion: string, id: string|null, nombre: string|null}} suceso
   */
  /**
   * El vocabulario del embudo, para que el menú de la barra pueda filtrar sin
   * copiar la lista. Gemelo del `ACCIONES` de `app/dialogo-expediente.js`, y son
   * dos a propósito: cada puerta valida lo suyo antes de dejar entrar.
   */
  const ACCIONES_VALIDAS = new Set(Object.values(ACCION))

  function alAccion({ accion, id, nombre }) {
    if (destruido) return
    // Cualquier acción que no sea otro «Borrar» desarma el borrado pendiente: quien se
    // ha ido a hacer otra cosa ya no está confirmando nada.
    if (accion !== ACCION.BORRAR) armado = null

    const tarea = () => {
      switch (accion) {
        case ACCION.GUARDAR:
          return guardar(nombre)
        case ACCION.RECUPERAR:
          return recuperar(id)
        case ACCION.DUPLICAR:
          return duplicar(id)
        case ACCION.BORRAR:
          return borrar(id)
        case ACCION.RECUPERAR_BORRADOR:
          return recuperarBorrador()
        case ACCION.DESCARTAR_BORRADOR:
          return descartarBorrador()
        case ACCION.EXPORTAR_DXF:
          return exportarDxf()
        case ACCION.EXPORTAR_COORDENADAS:
          return exportarCoordenadas()
        case ACCION.EXPORTAR_EXCEL:
          return exportarExcel()
        case ACCION.EXPORTAR_PROYECTO:
          return exportarProyecto(nombre)
        case ACCION.ABRIR_PROYECTO:
          return pedirProyecto()
        /* c8 ignore next 2 -- el diálogo solo emite las diez de arriba */
        default:
          return undefined
      }
    }

    let resultado
    try {
      resultado = tarea()
    } catch (causa) {
      reventar(accion, causa)
      return
    }
    if (resultado && typeof resultado.then === 'function') {
      resultado.catch((causa) => reventar(accion, causa))
    }
  }

  /**
   * Un defecto de ESTA casa, contado por los dos canales. El mensaje nombra la acción
   * porque «algo se ha interrumpido» no le dice al usuario si lo que ha fallado es
   * guardar o exportar, que llevan a decisiones distintas.
   */
  function reventar(accion, causa) {
    const mensaje =
      `La orden «${accion}» ha llegado bien, pero la aplicación no ha podido completarla por un ` +
      'fallo interno; no se ha cambiado nada. El detalle técnico está en la consola del navegador.'
    avisar(mensaje, NIVEL.ERROR, causa)
    decir(mensaje)
    console.error(`[expediente] la acción «${accion}» ha fallado de forma inesperada:`, causa)
  }

  /**
   * Pone al día la identidad de una rama a partir del documento que acaba de entrar
   * en su store. Distingue **una edición** de **otro documento** por `idLocal` (ver
   * {@link idLocalAbierto}) y, si es otro documento, suelta la identidad: el
   * siguiente «Guardar» creará un registro nuevo en vez de pisar el anterior con una
   * geometría que no es la suya.
   *
   * Una sola función para las dos ramas desde F12 · T4.3: era el cuerpo de
   * `alCambiarElStore` y se sacó tal cual, sin cambiarle una regla, para que las dos
   * no puedan divergir en cuándo se considera que ha llegado otro documento.
   *
   * @param {string} r  Una de `RAMA`.
   * @param {object|null} documento  Lo que hay ahora en el store de esa rama.
   */
  function refrescarIdentidad(r, documento) {
    const idLocal = documento?.idLocal ?? null
    if (idLocal !== idLocalAbierto[r]) {
      idLocalAbierto[r] = idLocal
      identidades[r] = identidadNueva()
    } else {
      identidades[r] = { ...identidades[r], modificado: instanteISO() }
    }
  }

  /**
   * ¿Puede escribir ya el autoguardado, o hay que apuntarlo para después?
   *
   * Hasta que la lectura de arranque no ha terminado no se sabe si hay una oferta
   * pendiente, así que tampoco se escribe: dos segundos de espera son gratis y el
   * trabajo de la sesión anterior no lo es.
   *
   * ⛔ **Lo que YA NO mira es la rama** (F12 · T4.3). Lo hacía —«con la rama EDIFICIO
   * puesta tampoco se dispara para la parcela»— por un motivo que era bueno y que ha
   * dejado de existir: el borrador era UN registro de clave reservada y las dos ramas
   * se habrían pisado. Con una clave por rama no se pisan, y suprimirlo ahora sería
   * dejar de guardar la parcela por una razón que ya no se sostiene.
   *
   * @param {string} r  La rama que quiere escribir. Se apunta SOLO ella.
   * @returns {boolean}
   */
  function autoguardadoArmado(r) {
    if (!arrancado || ofrecido !== null) {
      cambioEnEspera[r] = true
      if (!dichaLaEspera && ofrecido !== null) {
        dichaLaEspera = true
        avisar(MENSAJE_AUTOGUARDADO_EN_ESPERA)
      }
      return false
    }
    return true
  }

  /**
   * El SÉPTIMO suscriptor del store de PARCELA. Hace dos cosas y ninguna es dibujar:
   * pone al día la identidad de su rama y avisa a su debounce.
   */
  function alCambiarElStore(parcela) {
    if (destruido) return
    refrescarIdentidad(RAMA.PARCELA, parcela)
    // ⚠️ Antes de la guarda del autoguardado A PROPÓSITO: lo que hay en pantalla ha
    // cambiado, y si las salidas se pueden o no depende de eso y no de si el borrador
    // está en condiciones de escribirse. Puesto debajo, traer la primera parcela con
    // una oferta de borrador sin resolver dejaría las cuatro salidas apagadas
    // teniendo geometría delante.
    refrescarSalidas()
    // ⛔ E4 (auditoría del 2026-08-16): el refresco del diálogo, ANTES de la guarda
    // del autoguardado y por el mismo argumento que las salidas de arriba. Estaba
    // detrás del `return`, y con la oferta de borrador pendiente una parcela llegada
    // por vía asíncrona con el diálogo abierto dejaba el gate «Guardar» apagado con
    // un motivo ya falso hasta reabrir. Que el borrador no pueda escribirse todavía
    // no cambia lo que el diálogo tiene que enseñar.
    if (dialogo.abierto()) {
      refrescar().catch((causa) => reventar('refrescar', causa))
    }
    if (!autoguardadoArmado(RAMA.PARCELA)) return
    auto.cambiado(parcela)
  }

  /**
   * Su gemelo en la rama EDIFICIO (F12 · T4.3). **Es lo que la desviación 7 de F11
   * dejó sin hacer**, y lo que hace que un edificio dibujado a mano sobreviva a una
   * recarga: hasta aquí, cerrar la pestaña con partes dibujadas se las llevaba y lo
   * único que quedaba era el aviso diciéndolo.
   *
   * @param {object|null} edificio
   */
  function alCambiarElEdificio(edificio) {
    if (destruido) return
    refrescarIdentidad(RAMA.EDIFICIO, edificio)
    // Por el mismo motivo que en su gemelo de PARCELA: antes de la guarda del
    // autoguardado. Aquí además importa más, porque `exportar-proyecto` es la ÚNICA
    // salida que un edificio habilita y es la única forma de sacarlo de la aplicación.
    refrescarSalidas()
    // ⛔ E4 (auditoría del 2026-08-16): mismo orden que en el gemelo de PARCELA, y
    // por lo mismo. Las dos salidas tempranas de abajo —la espera de la oferta y el
    // edificio sin identidad— son razones para NO escribir el borrador, no para
    // dejar de poner al día lo que el diálogo enseña.
    if (dialogo.abierto()) {
      refrescar().catch((causa) => reventar('refrescar', causa))
    }
    if (!autoguardadoArmado(RAMA.EDIFICIO)) return
    // ⚠️ **Un edificio sin identidad no se autoguarda**, y se calla a propósito: es el
    // estado de un `Edificio` construido a mano fuera de las vías de entrada (los
    // dobles de prueba, un `.json` de antes de F12), no un fallo del usuario. Lo que
    // no puede pasar es escribirlo: dos documentos sin identidad son indistinguibles,
    // y el segundo pisaría al primero creyendo que es una edición suya.
    if (edificio !== null && (edificio.idLocal ?? null) === null) return
    autoEdificio.cambiado(edificio)
  }

  /**
   * F11 · el suscriptor del CONMUTADOR de rama. Hace dos cosas, y ninguna es dibujar:
   *
   *   1. **Vuelca lo que hubiera quedado pendiente** mientras el autoguardado estaba
   *      en espera. Sin esto, una edición hecha justo antes de conmutar —o por
   *      cualquiera de los otros diez suscriptores— **no se guardaría nunca**: el
   *      debounce solo escribe lo que le han contado. Es el mismo desenlace que
   *      `resolverOferta` resuelve para la oferta, y se resuelve igual.
   *   2. Repinta el diálogo si está abierto: «Guardar» acaba de encenderse o de apagarse
   *      y su motivo cambia con él.
   *
   * ⛔ **F12 · T4.3: ya no mira A QUÉ rama se va.** Miraba `!== EDIFICIO` porque
   * aquella rama no se autoguardaba; ahora las dos lo hacen, y el volcado es de las
   * dos. Dejarlo como estaba habría hecho que conmutar HACIA el edificio no volcara
   * nada — que es justo el gesto tras el que uno se va a mirar otra cosa.
   *
   * @param {string} _ramaNueva  Ya no decide nada. Se conserva en la firma porque es
   *   lo que entrega `rama.subscribe`, y quitarlo escondería de dónde viene la llamada.
   */
  function alCambiarLaRama(_ramaNueva) {
    if (destruido) return
    // ⭐ El tercer llamante, y el que más se nota: conmutar a Edificio apaga las tres
    // exportaciones de geometría en el acto, con el motivo puesto, en vez de dejarlas
    // encendidas para contestar «eso es de la parcela» cuando ya has pulsado.
    refrescarSalidas()
    if (arrancado && ofrecido === null && hayEnEspera()) volcarLoPendiente()
    if (dialogo.abierto()) {
      refrescar().catch((causa) => reventar('refrescar', causa))
    }
  }

  /**
   * Le cuenta a cada debounce lo que hay en su store ahora mismo. Es lo que convierte
   * «no pisar» en «no perder»: mientras el autoguardado está en espera los cambios se
   * marcan pero no se cuentan, y sin esta llamada se quedarían sin contar para siempre.
   *
   * ⚠️ Las dos ramas, siempre. Volcar solo la activa dejaría el trabajo de la otra sin
   * escribir hasta que el usuario volviera a tocarla, que puede ser nunca.
   */
  function volcarLoPendiente() {
    if (cambioEnEspera[RAMA.PARCELA]) {
      cambioEnEspera[RAMA.PARCELA] = false
      auto.cambiado(estado.get())
    }
    if (cambioEnEspera[RAMA.EDIFICIO]) {
      cambioEnEspera[RAMA.EDIFICIO] = false
      const edificio = estadoEdificio === null ? null : estadoEdificio.get()
      // Misma guarda que en el suscriptor: sin identidad no se escribe. Ver allí.
      if (edificio !== null && (edificio.idLocal ?? null) !== null) autoEdificio.cambiado(edificio)
    }
  }

  /** El botón «Expediente» de la fila del rótulo. */
  function abrir() {
    if (destruido) return
    // Se abre YA y se refresca después: la lista sale de IndexedDB y hacer esperar a
    // un diálogo por una lectura de disco es cómo se consigue que un botón parezca
    // roto. Lo que se enseña mientras tanto es lo último que se supo, que no es
    // mentira: es lo de hace un momento.
    dialogo.abrir()
    refrescar()
      .then(() => {
        // El régimen de almacenamiento, DICHO donde el usuario decide si confiarle un
        // trabajo a este navegador. Va DESPUÉS de `refrescar` porque `fijar` reescribe
        // el renglón, y solo cuando el gate está arriba: el motivo de un botón apagado
        // manda sobre esto (mismo orden que en el resto del módulo).
        if (persistencia?.persistido === false && dialogo.puedeGuardar()) {
          decir(AVISO_SIN_PERSISTENCIA)
        }
      })
      .catch((causa) => reventar('abrir', causa))
  }

  /**
   * La pestaña se va a segundo plano. Es el único momento en el que se puede escribir
   * lo pendiente con garantías: en `beforeunload`/`unload` una escritura de IndexedDB
   * ya no llega a completarse, y por eso NO se cuelga nada de ahí. Lo que queda
   * expuesto es la ventana del debounce, y está declarado.
   */
  function alOcultarse() {
    if (destruido) return
    if (doc.visibilityState !== 'hidden') return
    // Los DOS, y sin esperar al otro: son escrituras a claves distintas y encadenarlas
    // haría que un fallo de la primera se llevara por delante la segunda.
    escribirYa().catch((causa) => {
      console.warn('[expediente] no se ha podido volcar el borrador al ocultar la pestaña:', causa)
    })
  }

  /** Escribe YA lo pendiente de las dos ramas. `Promise.all` para poder esperarlas. */
  const escribirYa = () => Promise.all([auto.ahoraMismo(), autoEdificio.ahoraMismo()])

  const oyentes = []
  function escuchar(diana, tipo, fn) {
    diana.addEventListener(tipo, fn)
    oyentes.push({ diana, tipo, fn })
  }

  escuchar(botonAbrir, 'click', abrir)
  escuchar(doc, 'visibilitychange', alOcultarse)

  // ── El desplegable de SALIDAS de la barra (2026-08-11) ──────────────────────
  //
  // UN oyente por DELEGACIÓN sobre el menú, por el mismo motivo que el del diálogo:
  // así añadir o quitar una salida es tocar `index.html` y nada más.
  //
  // ⚠️ **No cierra el menú, y es correcto**: quien lo abre y lo cierra es
  // `app/barra.js` (su oyente de `click` en el `document` ya lo hace, y a propósito
  // corre DESPUÉS que éste). Cerrarlo también desde aquí serían dos dueños del
  // mismo estado visible.
  //
  // ⚠️ **Y solo atiende lo que sea `ACCION`**: el menú podría llevar mañana una
  // opción de otro dueño, y tragarse un `data-accion` ajeno la dejaría muerta sin
  // que lo dijera nadie. La guarda es la misma que la del diálogo.
  const menuDeSalidas = menuSalidas ?? doc.querySelector(SELECTOR_MENU_SALIDAS)
  if (menuDeSalidas !== null && menuDeSalidas !== undefined) {
    escuchar(menuDeSalidas, 'click', (evento) => {
      const boton = evento.target?.closest?.('[data-accion]')
      if (!boton || !menuDeSalidas.contains(boton) || boton.disabled) return
      if (!ACCIONES_VALIDAS.has(boton.dataset.accion)) return
      alAccion({ accion: boton.dataset.accion, id: null, nombre: null })
    })
  }
  // ── Las cuatro salidas nacen sabiendo si se pueden (2026-08-11) ─────────────
  //
  // ⚠️ **Va DESPUÉS de crear el diálogo**, y no es casual: `exportar-proyecto` es un
  // nodo que fabrica su constructor, así que localizarlo antes lo dejaría fuera del
  // mapa y esa opción sería la única de las cuatro que no se apaga nunca — el defecto
  // más difícil de ver de los posibles aquí, porque las otras tres funcionarían.
  for (const { salida } of evaluarSalidas(situacionDeSalida())) {
    const nodo = doc.querySelector(`[data-accion="${salida}"]`)
    if (nodo !== null) nodosDeSalida.set(salida, nodo)
  }
  // Y el primer pintado, sin esperar a que cambie nada: la aplicación arranca VACÍA
  // desde el 2026-08-07, así que el estado inicial de las cuatro es «no se puede».
  refrescarSalidas()

  const bajaAccion = dialogo.alAccion(alAccion)
  const desuscribirStore = estado.subscribe(alCambiarElStore)
  // Sin conmutador cableado no hay a qué suscribirse, y la baja es un no-op: así
  // `destruir()` no tiene que preguntar. Lo mismo con el segundo store, que en las
  // pantallas sin rama de edificio —y en todas las pruebas de F10— es `null`.
  const bajaRama = rama === null ? () => {} : rama.subscribe(alCambiarLaRama)
  const bajaEdificio =
    estadoEdificio === null ? () => {} : estadoEdificio.subscribe(alCambiarElEdificio)

  // El arranque va SUELTO a propósito, sin `await` y sin bloquear el montaje: leer el
  // almacén local no puede retrasar ni un milisegundo el primer pintado del mapa. Su
  // `catch` es la red de la regla de oro 1 — nada de lo que hay dentro debería lanzar,
  // y si lo hace tiene que verse.
  arrancar().catch((causa) => reventar('arrancar', causa))

  return {
    /** Abre el diálogo sin pasar por el botón. */
    abrir,

    /**
     * El embudo de acciones, abierto como método público el 2026-08-11.
     *
     * Hasta ese día `alAccion` era interno y su única puerta era el `<dialog>`. El
     * desplegable de salidas de la barra es la SEGUNDA puerta a las mismas acciones,
     * y el hueco de `index.html` ya tenía escrito desde la rebanada 2 del topbar que
     * hacía falta esto: «el embudo YA existe, solo le falta la puerta».
     *
     * ⚠️ Ignora en silencio lo que no sea una {@link ACCION}: es una puerta, no un
     * validador de contrato del programador. Quien pase una cadena inventada no ha
     * roto nada — no hay nada que romper.
     *
     * @param {string} accion  Una de {@link ACCION}.
     * @param {{id?: string|null, nombre?: string|null}} [contexto]
     */
    atender(accion, { id = null, nombre = null } = {}) {
      if (!ACCIONES_VALIDAS.has(accion)) return
      alAccion({ accion, id, nombre })
    },

    /** Abre un fichero de proyecto. Es lo que enruta la zona de fichero. No lanza. */
    abrirProyecto,

    /** El Expediente de lo que hay en pantalla, o `null`. Solo para leer. */
    expedienteActual,

    /**
     * Escribe YA los borradores pendientes, sin esperar al debounce. Para el guion de
     * humo. **Los dos**, desde F12 · T4.3: quien pide esto quiere el estado actual en
     * la base, y «actual» incluye la rama que no se esté mirando.
     */
    guardarBorradorYa: () => escribirYa(),

    /**
     * ⭐ **El canal de identidad.** Avisa —sin carga— cuando cambia QUÉ expediente
     * hay abierto: al archivarlo, al renombrarlo y al borrarlo. Quien escuche
     * vuelve a leer {@link estado}, que sigue siendo la única definición.
     *
     * Existe porque esos tres gestos **no tocan ningún store ni la navegación**, y
     * son lo único que mueve las pintadas de la aplicación: sin este aviso la zona
     * de expediente de `app/barra.js` se queda rancia hasta el siguiente cambio de
     * store, diciendo «Sin guardar» con el acuse de «Guardado «X»» al lado, o
     * enseñando el nombre de un expediente ya borrado. El razonamiento entero está
     * donde se implementa ({@link notificarIdentidad}).
     *
     * ⚠️ No notifica al suscribirse —mismo contrato que `crearEstadoVista`—: quien
     * pinta al montar ya lee `estado()` por su cuenta.
     *
     * @param {() => void} fn
     * @returns {() => void}  La baja. IDEMPOTENTE.
     * @throws {TypeError}  Si `fn` no es una función.
     */
    alCambiarIdentidad(fn) {
      if (typeof fn !== 'function') {
        throw new TypeError(
          `alCambiarIdentidad: 'fn' debe ser una función; recibido ${typeof fn}.`,
        )
      }
      oyentesIdentidad.add(fn)
      return () => oyentesIdentidad.delete(fn)
    },

    /** Fotografía del estado interno: lo que el guion de humo necesita comprobar. */
    estado: () => ({
      idAbierto: identidadActual().id,
      nombreAbierto: identidadActual().nombre,
      creado: identidadActual().creado,
      modificado: identidadActual().modificado,
      ofreciendoBorrador: ofrecido !== null,
      /** F12 · de qué ramas hay trabajo ofrecido. `[]` cuando no hay oferta. */
      ramasOfrecidas: ofrecido === null ? [] : ofrecido.map((b) => b.tipo),
      arrancado,
      /** F11 · qué rama ve este cableado. `PARCELA` también cuando no hay conmutador. */
      rama: ramaActual(),
      /** Si «Guardar» está encendido, y por tanto si la rama lo permite. */
      puedeGuardar: puedeGuardarse(),
      persistido: persistencia === null ? null : persistencia.persistido,
      /**
       * ⚠️ Sigue siendo el de PARCELA, y por eso el de edificio tiene clave propia:
       * `autoguardado` lo lee el guion 12 desde F10 y cambiarle el significado habría
       * hecho que siguiera pasando midiendo otra cosa.
       */
      autoguardado: auto.estado(),
      /** F12 · T4.3 · el segundo debounce, el de la rama EDIFICIO. */
      autoguardadoEdificio: autoEdificio.estado(),
    }),

    /**
     * Deja el cableado inerte: retira los dos escuchadores, la suscripción del store y
     * la del diálogo, apaga el autoguardado **sin escribir lo pendiente** (hacerlo sería
     * una escritura escondida dentro de un desmontaje) y destruye el diálogo, que sí es
     * suyo. IDEMPOTENTE.
     */
    destruir() {
      if (destruido) return
      destruido = true
      for (const { diana, tipo, fn } of oyentes) diana.removeEventListener(tipo, fn)
      oyentes.length = 0
      bajaAccion()
      desuscribirStore()
      bajaRama()
      bajaEdificio()
      // El canal de identidad se queda mudo con el resto. La guarda de `destruido`
      // de `alAccion` ya impide que llegue un aviso después, pero vaciar el
      // conjunto es lo que evita retener a quien se suscribió: un oyente de una
      // barra ya desmontada escribiría en nodos que no gobierna nadie.
      oyentesIdentidad.clear()
      auto.destruir()
      autoEdificio.destruir()
      dialogo.destruir()
    },
  }
}

export default cablearExpediente

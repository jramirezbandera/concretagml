// gml/descargar.js — F04 · Tarea T5.1. La ENTREGA del GML al usuario.
//
// Es el último metro del recorrido de F04: el serializador ya ha compuesto el
// texto del GML y aquí ese texto se convierte en un fichero que aterriza en la
// carpeta de descargas. Son veinte líneas de DOM y, sin embargo, concentran
// cuatro formas distintas de arruinar el trabajo de toda la feature. Esta
// cabecera existe para que ninguna de las cuatro se «simplifique» más adelante.
//
// ── F08 · T1.3 · LA MECÁNICA SE COMPARTE, NO SE COPIA ────────────────────────
// F08 baja un INFORME DE CONTRASTE EN TEXTO, no un GML. La mecánica —`Blob` →
// `createObjectURL` → `<a download>` → `click()` → `revokeObjectURL`, con su
// comprobación de capacidad y su limpieza innegociable— es exactamente la misma,
// y las cuatro trampas de esta cabecera también lo son. Por eso vive ahora en
// {@link descargarTexto}, que es el PRIMITIVO, y {@link descargarGml} pasa a ser
// un LLAMANTE que solo aporta lo que sabe de su dominio: el tipo MIME
// ({@link TIPO_MIME_GML}), el nombre saneado ({@link nombreFicheroGml}) y el
// mensaje concreto de «el serializador no emitió nada».
//
// No se ha copiado, y el motivo no es estético: este repo ya arrastra la deuda
// declarada de cuatro copias de `describir` repartidas por las capas (escrita en
// `edit/_comun.js:42-46`). Una segunda familia de duplicados querría decir que la
// próxima corrección de la fuga de memoria —o del `finally` anidado, o del caveat
// de Safari de más abajo— habría que acordarse de hacerla dos veces, y la que se
// olvide fallará en verde. La prueba de que la extracción fue una EXTRACCIÓN y no
// un rediseño es que ni una línea de `test/gml/descargar.dom.test.js` sobre
// `descargarGml` tuvo que cambiar.
//
// Un único desenlace observable cambió, y se anota aquí para que no se descubra
// por sorpresa: cuando `documento` o `url` son inválidos A LA VEZ que `refcat` o
// `fecha`, el `TypeError` que sale ahora es el del nombre y antes era el del
// entorno. Los dos son contratos rotos por el programador, ninguna prueba los
// pinta juntos, y el orden entre dos errores de programación no es una garantía
// que merezca código para conservarse.
//
// ── F09 · T5.1 · EL TERCER LLAMANTE, Y POR QUÉ ES BINARIO ────────────────────
// F09 baja un INFORME FIRMABLE EN PDF. Un PDF **son bytes**: lleva un JPEG
// pegado sin recodificar (`/DCTDecode`) y una tabla `xref` con desplazamientos
// de byte exactos, así que pasarlo por {@link descargarTexto} —que codifica en
// UTF-8 por especificación— lo corrompería en silencio, con el `%PDF` intacto en
// la cabecera y el defecto invisible hasta abrirlo. De ahí
// {@link descargarBinario}.
//
// Y como eran ya TRES, la cadena que los tres comparten —capacidad → `Blob` →
// `createObjectURL` → `<a download>` con su `stopPropagation` en CAPTURA →
// `click()` → limpieza en `finally` anidados— se ha extraído a {@link entregar}.
// Lo que se valida sigue en cada función pública, con SU nombre en el mensaje;
// lo que se comparte es la mecánica, que es la que concentra las cuatro trampas
// de esta cabecera. Ni una línea de `test/gml/descargar.dom.test.js` cambió, que
// es la prueba de que fue una extracción y no un rediseño.
//
// ── 1 · CODIFICACIÓN: el fichero no puede mentir sobre sí mismo ──────────────
// La spec de F04 lo pide con todas las letras: «Fichero UTF-8 (encoding
// declarado == bytes reales)». El GML lleva escrito en su prólogo
// `encoding="UTF-8"`; si los bytes que bajan NO son UTF-8, el fichero se
// contradice a sí mismo y el validador de la Sede lo lee mal —o lo rechaza— sin
// que nadie entienda por qué, porque el texto se ve perfecto en el editor de
// quien lo generó. El constructor `Blob` resuelve esto por especificación: una
// entrada de tipo string se codifica SIEMPRE en UTF-8, sin BOM y sin consultar
// la configuración regional del sistema. Por eso aquí se le pasa el string tal
// cual y NO se hace ninguna conversión manual a bytes: cualquier paso intermedio
// (un `TextEncoder` propio, un `encodeURIComponent` en un `data:` URI, una
// concatenación con BOM) es una oportunidad de estropearlo. El `charset=utf-8`
// del tipo MIME es la MISMA verdad dicha por segunda vez, no la fuente de la
// verdad: el test comprueba los BYTES decodificándolos, no el tipo declarado.
//
// ── 2 · FUGA DE MEMORIA: `revokeObjectURL` es obligatorio, pase lo que pase ───
// `URL.createObjectURL` registra el blob en el navegador y lo mantiene VIVO
// hasta que la página se descarga o alguien revoca la URL. Un GML de parcela son
// unas decenas de kB, pero una sesión de trabajo son decenas de descargas, y
// nadie recarga la página entre una y otra. Por eso la revocación va en un
// `finally` —y en el `finally` MÁS INTERNO— para que ocurra también si el
// `click()` lanza. Un `try/catch` mudo alrededor del click sería peor que no
// tener nada: taparía el fallo Y la fuga.
//
// ⚠️ CAVEAT CONOCIDO, anotado para que no se descubra por sorpresa: la
// revocación es SÍNCRONA, inmediatamente después del `click()`. Es correcto por
// especificación —al despachar el click sobre un anchor con `download`, la
// descarga se inicia en ese mismo turno y el navegador ya no depende de la
// entrada del registro de blobs— y así funciona en Chrome y en Firefox. Hay
// bibliotecas (FileSaver.js) que aun así retrasan la revocación con un
// `setTimeout`, por precaución frente a implementaciones antiguas de Safari. No
// se ha hecho aquí porque un temporizador convertiría la limpieza en algo que
// puede no llegar a ocurrir —si la página se cierra antes, la fuga vuelve— y
// haría imposible afirmar «se revoca siempre» en una prueba síncrona. Si alguna
// vez se observa una descarga truncada en un navegador concreto, ESTE es el
// punto que hay que mirar, y el cambio es local: mover la llamada a un
// `setTimeout(…, 0)` dentro del mismo `finally`.
//
// ── 3 · EL NOMBRE DEL FICHERO ES UN NOMBRE DE FICHERO ────────────────────────
// La referencia catastral la teclea (o la pega) el usuario, y de ahí puede salir
// cualquier cosa. Un nombre con `/` o `\` no es un nombre: es una RUTA. Un
// nombre con `..` es una ruta RELATIVA. Un `:` es ilegal en Windows y en macOS
// significaba «separador de directorio». Y `CON`, `NUL`, `COM1`… son nombres de
// DISPOSITIVO reservados en Windows desde MS-DOS: siguen siéndolo hoy, incluso
// con extensión (`CON.gml` no se puede crear), y el error que produce el sistema
// no dice «nombre reservado», dice cosas como «acceso denegado». Por eso
// {@link nombreFicheroGml} sanea por LISTA BLANCA (no por lista negra: una lista
// negra siempre se queda corta) y neutraliza los nombres reservados.
//
// ── 4 · EL RELOJ NO SE LEE AQUÍ ──────────────────────────────────────────────
// Misma regla que en `gml/_comun.js` y `gml/ids.js`, y aquí es todavía más
// visible: si el nombre del fichero dependiera del reloj del sistema, su test no
// podría afirmar NADA sobre él —cada ejecución daría un nombre distinto— y el
// saneado quedaría sin comprobar. La fecha entra por parámetro, siempre. Este
// módulo no instancia fechas propias ni consulta la marca de tiempo del sistema,
// ni siquiera dentro de un comentario, y hay un test que lo comprueba con un
// grep sobre el TEXTO de este fichero.
//
// ── QUÉ SE DEVUELVE CUANDO NO SE DESCARGA NADA (y por qué NO es una detección) ─
// El caso real es «el serializador encontró errores bloqueantes y no emitió
// nada»: llega `xml === null`. {@link descargarGml} NO descarga un fichero vacío
// —un GML de 0 bytes en la carpeta de descargas es una trampa: parece que la
// operación funcionó— y NO falla en silencio: devuelve
// `{descargado, nombre, motivo, mensaje}`, con `motivo` en {@link MOTIVO_NO_DESCARGADO}.
//
// Se ha elegido el valor de retorno y NO una {@link DeteccionGml} por dos
// razones concretas, no por gusto:
//   (a) `TIPO_GML` no tiene —ni debe tener— un código para «no bajó ningún
//       fichero»: su catálogo describe lo que le pasa AL GML (dialecto, srsName,
//       geometría, ids), no lo que le pasa al navegador. `crearDeteccionGml`
//       LANZA ante un tipo que no esté en el catálogo, así que la vía ni siquiera
//       está abierta sin tocar `gml/_comun.js`, que es otra capa.
//   (b) El motivo por el que el serializador no produjo GML ya está contado, con
//       detalle y con severidad, en las detecciones que emitió ÉL. Repetirlo aquí
//       duplicaría el aviso en el panel de F03 y le haría creer al usuario que
//       hay dos problemas donde solo hay uno. La capa de entrega no rediagnostica:
//       informa de lo suyo —«no ha bajado ningún fichero, y esta es la razón»— y
//       el llamante decide cómo enseñarlo.
// El `mensaje` va siempre en castellano y es directamente presentable: quien lo
// reciba puede pasarlo a `app/avisos.js` sin traducir nada.
//
// ── LA EXCEPCIÓN SÍ SE PROPAGA ───────────────────────────────────────────────
// Si `click()` lanza (una extensión que ha manipulado el DOM, un `HTMLAnchorElement`
// parcheado), la excepción SALE de {@link descargarGml} después de limpiar. No se
// convierte en un `motivo`: eso aplanaría un error con traza a una etiqueta de
// texto, y la regla de oro 1 pide no SILENCIAR, no «devolver siempre un objeto».
// Los `motivo` describen desenlaces PREVISTOS del dominio (no hay GML que
// entregar; el entorno no sabe entregarlo); una excepción es una anomalía.
//
// ── DEGRADACIÓN EXPLÍCITA EN UN ENTORNO SIN `createObjectURL` ────────────────
// MEDIDO, con un matiz que conviene no perder porque es contraintuitivo: jsdom
// POR SU CUENTA (`new JSDOM(...)`, que es como lo usan otros tests de este repo)
// NO implementa `URL.createObjectURL` ni `URL.revokeObjectURL` — son `undefined`.
// Pero bajo el entorno `jsdom` de Vitest, el `URL` global que se ve es el de
// Node (WHATWG), que SÍ los implementa desde Node 16 sobre su propio registro de
// blobs. O sea: el test de este módulo corre con la API disponible de verdad, no
// con un hueco, y ese hueco NO se puede dar por supuesto en ninguna dirección.
//
// La comprobación de capacidad se queda igualmente, porque el hueco existe fuera
// de aquí: un navegador viejo, un contexto de render en servidor, un jsdom
// crudo. Cuando falta algo, el módulo lo detecta ANTES de tocar nada y devuelve
// `motivo: SIN_SOPORTE_NAVEGADOR` NOMBRANDO qué falta, en vez de reventar a
// mitad del proceso con un «url.createObjectURL is not a function» que no le
// dice nada a nadie. Lo que NO hace es debilitarse para que el test pase.
//
// ── AUSENTE ≠ EQUIVOCADO: dónde está la línea entre el TypeError y el motivo ─
// `documento: null`, `documento: 7`, `url: 'URL'` son CONTRATOS ROTOS por el
// programador y LANZAN: te has equivocado de argumento, y aplanarlo a una
// etiqueta de texto solo retrasaría el momento de enterarte. Que el global NO
// EXISTA —`globalThis.document` en un proceso de Node, un `URL` que no está— es
// una limitación del ENTORNO, exactamente igual que un `Blob` ausente, y se
// degrada con `SIN_SOPORTE_NAVEGADOR` nombrando lo que falta. Es la misma línea
// que este módulo ya trazaba para `url` (forma frente a capacidad), aplicada
// ahora también a la ausencia: la FORMA la pone quien llama, la CAPACIDAD la
// pone el entorno. Consecuencia práctica: `descargarTexto` se puede invocar
// desde código que quizá corra sin DOM y responde con un motivo presentable en
// vez de con una excepción que nadie esperaba.
//
// ── INYECCIÓN DE `documento` Y `url` ─────────────────────────────────────────
// Ambos se pueden inyectar y ambos caen por defecto al global correspondiente,
// así que en la app se llama sin ceremonia: `descargarGml(xml, {refcat, fecha})`.
// La inyección existe porque `URL` y `document` son globales COMPARTIDOS del
// entorno de test: parchearlos desde un fichero de test contamina a los demás y
// deja fugas si un `afterEach` no restaura. `Blob` no se inyecta a propósito —es
// un constructor estándar sin efectos observables que falsear, y el test recibe
// el Blob REAL a través del espía de `createObjectURL`, que es justo donde
// quiere mirarlo.
//
// Única dependencia: `gml/_comun.js`, del que sale el formato de fecha del
// Catastro. Ni DOM propio, ni modelo, ni Leaflet.

import { dateTimeCatastro } from './_comun.js'

// ── Tipo MIME y extensión ─────────────────────────────────────────────────────

/**
 * Extensión del fichero. La Sede espera `.gml`; `.xml` sería técnicamente cierto
 * y prácticamente inservible.
 *
 * @readonly
 */
export const EXTENSION_GML = '.gml'

/**
 * Tipo MIME del Blob. `application/gml+xml` es el tipo registrado de GML, y el
 * `charset=utf-8` DECLARA lo que el Blob ya hace por especificación (codificar
 * las entradas de tipo string en UTF-8).
 *
 * Ojo con la lectura de esta constante: el `charset` NO es lo que produce los
 * bytes, es lo que los describe. Un test que compruebe la codificación mirando
 * este texto no está comprobando nada — hay que decodificar el Blob.
 *
 * @readonly
 */
export const TIPO_MIME_GML = 'application/gml+xml;charset=utf-8'

/**
 * Tipo MIME del informe de contraste en texto plano de F08. Vive aquí, junto a
 * {@link TIPO_MIME_GML}, porque el vocabulario de la ENTREGA es de este módulo.
 *
 * El `charset=utf-8` no es decorativo y por eso hay constante en vez de una
 * cadena escrita en el llamante: un `text/plain` a secas deja al navegador
 * ADIVINAR la codificación al abrir el fichero, y el informe lleva `ñ`, acentos
 * y el símbolo `²` de las superficies. Adivinando mal, el técnico ve mojibake en
 * un documento que va a leer un tercero. El Blob ya codifica en UTF-8 por
 * especificación; esto lo DECLARA, que es la misma verdad dicha dos veces —igual
 * que en el GML.
 *
 * @readonly
 */
export const TIPO_MIME_TEXTO = 'text/plain;charset=utf-8'

/**
 * Tipo MIME del informe firmable en PDF de F09. Vive aquí por lo mismo que los
 * otros dos: el vocabulario de la ENTREGA es de este módulo.
 *
 * **Sin `charset`, y no es un olvido.** Un PDF no es texto: es un contenedor
 * binario que declara sus propias codificaciones dentro (`/WinAnsiEncoding` en
 * las fuentes, `/DCTDecode` en la imagen). Añadirle un `charset=utf-8` sería
 * afirmar sobre los bytes algo que no es cierto y que ningún lector consulta.
 *
 * @readonly
 */
export const TIPO_MIME_PDF = 'application/pdf'

/**
 * Tipo MIME del DXF de F10. Vive aquí por lo mismo que los otros tres: el
 * vocabulario de la ENTREGA es de este módulo, aunque quien escribe el fichero sea
 * `export/dxf.js` —que es puro y no sabe nada de `Blob`—.
 *
 * **`image/vnd.dxf` es el tipo REGISTRADO en IANA**, y sí, empieza por `image/`
 * aunque un DXF sea texto plano: se registró bajo esa rama por historia de AutoCAD,
 * no porque sea un mapa de bits. Se usa el registrado y no ninguno de los tres
 * inventados que circulan (`application/dxf`, `application/x-dxf`, `image/x-dxf`)
 * porque el que está registrado es el único que un tercero puede reconocer sin
 * adivinar.
 *
 * **Sin `charset`, y no es un olvido.** El parámetro `charset` solo significa algo en
 * los tipos `text/*`, así que aquí lo ignorarían todos. Y tampoco haría falta:
 * `export/dxf.js` emite ASCII puro —códigos de grupo, números y los nombres de capa
 * `PARCELA_OFICIAL`/`PARCELA_EDITADA`—, y por eso el fichero no necesita declarar
 * `$DWGCODEPAGE`. El día que una capa lleve una `ñ`, el sitio donde eso se declara es
 * la cabecera del DXF, no este MIME.
 *
 * @readonly
 */
export const TIPO_MIME_DXF = 'image/vnd.dxf'

/**
 * Tipo MIME del fichero de proyecto de F10.
 *
 * **Sin `charset`, y aquí el motivo es el más fuerte de los cuatro**: el registro de
 * `application/json` NO define el parámetro, porque RFC 8259 §8.1 obliga a que un
 * JSON intercambiado entre sistemas sea UTF-8. Añadir `;charset=utf-8` sería declarar
 * como opcional algo que la norma da por obligatorio, y algunos analizadores estrictos
 * rechazan el parámetro. Es justo lo contrario del caso del informe en texto, donde el
 * `charset` es imprescindible porque `text/plain` deja al navegador ADIVINAR.
 *
 * @readonly
 */
export const TIPO_MIME_JSON = 'application/json'

// ── Repertorio de caracteres del nombre de fichero ───────────────────────────

/**
 * Carácter con el que se sustituye todo lo que no cabe en un nombre de fichero,
 * y también los dos puntos del dateTime del Catastro. El guion es la elección
 * natural: es legal en los tres sistemas de ficheros que importan, no necesita
 * comillas en una consola y ya aparece en la parte de fecha del nombre, así que
 * no introduce un símbolo nuevo.
 *
 * @readonly
 */
export const SUSTITUTO_NOMBRE = '-'

/**
 * Separador entre las TRES partes del nombre (prefijo, referencia y marca de
 * tiempo). Es el guion BAJO y no el guion medio a propósito: `_` no pertenece al
 * repertorio permitido de un segmento, así que dentro de un segmento no puede
 * aparecer nunca. Consecuencia útil: partir el nombre por `_` devuelve
 * exactamente las tres partes, sin ambigüedad, tanto para quien lee el fichero
 * como para el test.
 *
 * @readonly
 */
export const SEPARADOR_NOMBRE = '_'

/**
 * Primera parte del nombre. Dice QUÉ es el fichero antes de decir de qué parcela
 * es: los GML de parcela (F04) y los de edificio (F13) acabarán conviviendo en
 * la misma carpeta de descargas del mismo usuario, y la extensión no los
 * distingue. Además agrupa: todo lo que salga de esta aplicación ordena junto.
 *
 * @readonly
 */
export const PREFIJO_NOMBRE = 'parcela'

/**
 * Primera parte del nombre cuando el fichero lleva **varias** parcelas.
 *
 * ⭐ Entra con F17 y es lo único que hacía falta para nombrar una entrega
 * multiparcela: `PREFIJO_NOMBRE` dice «parcela», en singular, y con N
 * `gml:featureMember` dentro eso sería mentira en el sitio más visible de toda la
 * operación —la barra de descargas del navegador—.
 *
 * ⛔ NO ES UN DISCRIMINANTE POR PIEZA, y conviene saber por qué no. El diseño de
 * agosto preveía añadirle al nombre algo que distinguiera cada trozo cedido,
 * porque la entrega iba a ser un ZIP con un `.gml` por parcela y dos cesiones
 * anónimas de la misma fecha habrían colisionado **en silencio**. El ZIP se
 * canceló al medir que la Sede acepta un sobre único (override O18), y con **una
 * sola descarga no hay nombres que colisionen**: el problema desapareció con la
 * solución que lo causaba.
 *
 * `expediente` y no `parcelas` a secas: es la palabra con la que el usuario de
 * esta aplicación llama al conjunto de fincas de una misma alteración, y es la
 * que ya usa el almacén (`storage/expedientes.js`).
 *
 * @readonly
 */
export const PREFIJO_NOMBRE_EXPEDIENTE = 'expediente'

/**
 * Segmento que ocupa el lugar de la referencia catastral cuando NO hay ninguna.
 * Es el caso normal de un alta nueva: la parcela todavía no existe en las bases
 * del Catastro, así que no tiene referencia y no se le puede inventar una. El
 * texto dice exactamente eso y no otra cosa.
 *
 * @readonly
 */
export const MARCA_SIN_REFCAT = 'sin-referencia'

/**
 * Segmento que ocupa el lugar de la referencia cuando SÍ se aportó una pero, tras
 * el saneado, no queda de ella ni un carácter utilizable (`'///'`, `'..'`, un
 * puñado de espacios). Es DISTINTO de {@link MARCA_SIN_REFCAT} a propósito:
 * decir «sin referencia» de una parcela cuyo usuario escribió algo sería mentir
 * sobre lo que él hizo. Aquí hubo referencia; lo que no hubo fue nada aprovechable.
 *
 * @readonly
 */
export const MARCA_REFCAT_ILEGIBLE = 'referencia-ilegible'

/**
 * Longitud máxima del segmento de referencia. Una referencia catastral real mide
 * 14 caracteres (parcela) o 20 (con cargo e inmueble); el tope es holgado.
 *
 * Existe porque el nombre de un fichero no es un campo de texto libre: la
 * inmensa mayoría de los sistemas de ficheros limitan cada componente de la ruta
 * a 255 caracteres, y el error que dan al pasarse (`ENAMETOOLONG`) le llega al
 * usuario como una descarga que sencillamente no ocurre. Con este tope, el nombre
 * completo se queda muy por debajo del límite sea cual sea la entrada.
 *
 * @readonly
 */
export const LONGITUD_MAXIMA_SEGMENTO = 64

/**
 * Los caracteres que Windows prohíbe explícitamente en un nombre de fichero
 * (`/ \ : * ? " < > |`). Los tres primeros son además separadores de ruta o de
 * volumen en algún sistema: dejarlos pasar no produciría un nombre feo, produciría
 * una RUTA.
 *
 * ⚠️ ESTA LISTA NO ES LA QUE APLICA EL SANEADO. El saneado va por LISTA BLANCA
 * ({@link LONGITUD_MAXIMA_SEGMENTO} aparte, solo sobreviven letras ASCII, dígitos
 * y {@link SUSTITUTO_NOMBRE}), que es estrictamente más estricta y no se queda
 * corta cuando aparece un carácter que a nadie se le había ocurrido —un carácter
 * de control, un `‮` que invierte el sentido de lectura del nombre, un
 * espacio final que Windows recorta por su cuenta—. Está exportada para que el
 * test pueda construir la entrada sucia y comprobar que ninguno sobrevive, sin
 * escribir la lista a mano por segunda vez.
 *
 * @readonly
 */
export const CARACTERES_PROHIBIDOS_WINDOWS = '/\\:*?"<>|'

/** Nombres de dispositivo de MS-DOS sin numerar. */
const RESERVADOS_DISPOSITIVO = Object.freeze(['CON', 'PRN', 'AUX', 'NUL'])

/** Familias de dispositivo numeradas: puertos serie y de impresora. */
const RESERVADOS_NUMERADOS = Object.freeze(['COM', 'LPT'])

/**
 * Nombres reservados de Windows, DERIVADOS y no copiados: cuatro dispositivos
 * sueltos más las dos familias numeradas de 0 a 9. La documentación actual de
 * Microsoft incluye `COM0` y `LPT0` además de los clásicos `COM1`…`LPT9`, así que
 * el rango empieza en cero: sobrar en la lista no cuesta nada, faltar sí.
 *
 * La reserva se aplica al COMPONENTE completo de la ruta y sigue viva aunque
 * lleve extensión: `CON.gml` tampoco se puede crear.
 *
 * Fuera del alcance de esta lista, y a propósito, quedan las variantes con
 * caracteres que el saneado ya elimina antes de llegar aquí: `CONIN$`/`CONOUT$`
 * (el `$` no está en la lista blanca) y los `COM¹`/`COM²`/`COM³` con exponente
 * (tampoco son ASCII alfanuméricos). Al pasar por la lista blanca se convierten
 * en `CONIN-`, `CONOUT-` y `COM-`, que no son reservados.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const NOMBRES_RESERVADOS_WINDOWS = Object.freeze([
  ...RESERVADOS_DISPOSITIVO,
  ...RESERVADOS_NUMERADOS.flatMap((base) =>
    Array.from({ length: 10 }, (_, i) => `${base}${i}`),
  ),
])

/** Búsqueda O(1) en mayúsculas: la reserva de Windows ignora may./min. */
const RESERVADOS = new Set(NOMBRES_RESERVADOS_WINDOWS)

/** {@link SUSTITUTO_NOMBRE} escapado para poder incrustarlo en una RegExp. */
const SUSTITUTO_ESCAPADO = SUSTITUTO_NOMBRE.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&')

/**
 * LISTA BLANCA del segmento: letras ASCII, dígitos y el sustituto. Nada más.
 * Se deja fuera el punto (que es lo que hace imposible un `..`, y también un
 * nombre acabado en punto, que Windows recorta por su cuenta) y se deja fuera
 * todo lo no ASCII (una referencia catastral es alfanumérica; un nombre con
 * acentos viaja mal entre sistemas de ficheros con distinta normalización
 * Unicode).
 */
const RE_FUERA_DEL_NOMBRE = new RegExp(`[^A-Za-z0-9${SUSTITUTO_ESCAPADO}]`, 'g')

/** Dos o más sustitutos seguidos, fruto de una ristra de caracteres ilegales. */
const RE_SUSTITUTOS_SEGUIDOS = new RegExp(`${SUSTITUTO_ESCAPADO}{2,}`, 'g')

/** Sustitutos pegados a los extremos del segmento. */
const RE_SUSTITUTO_EN_EXTREMOS = new RegExp(
  `^${SUSTITUTO_ESCAPADO}+|${SUSTITUTO_ESCAPADO}+$`,
  'g',
)

// ── Saneado de un segmento del nombre ────────────────────────────────────────

/**
 * Convierte una cadena cualquiera en un segmento apto para un nombre de fichero,
 * en este orden:
 *   1. Sustituye por {@link SUSTITUTO_NOMBRE} todo lo que no esté en la lista
 *      blanca. Aquí caen `/ \ : * ? " < > |`, el punto (adiós al `..`), los
 *      espacios, los caracteres de control y todo lo no ASCII.
 *   2. Colapsa las ristras de sustitutos: `«a///b»` da `a-b`, no `a---b`.
 *   3. Recorta a {@link LONGITUD_MAXIMA_SEGMENTO}.
 *   4. Poda los sustitutos de los extremos (incluido el que pueda haber dejado
 *      el recorte del paso 3).
 *
 * Puede devolver la cadena vacía: es un resultado legítimo —«no quedó nada»— y
 * quien llama decide qué poner en su lugar. Neutralizar los nombres reservados
 * NO es cosa de esta función: ese paso va después, sobre el segmento definitivo.
 *
 * @param {string} bruto
 * @returns {string}  Segmento saneado, posiblemente vacío.
 */
function sanearSegmento(bruto) {
  return bruto
    .replace(RE_FUERA_DEL_NOMBRE, SUSTITUTO_NOMBRE)
    .replace(RE_SUSTITUTOS_SEGUIDOS, SUSTITUTO_NOMBRE)
    .slice(0, LONGITUD_MAXIMA_SEGMENTO)
    .replace(RE_SUSTITUTO_EN_EXTREMOS, '')
}

/**
 * Desactiva un nombre de dispositivo reservado añadiéndole un sustituto al final
 * (`CON` → `CON-`). Se añade en vez de sustituir para que el usuario siga
 * reconociendo lo que escribió: el objetivo es que el fichero se pueda crear, no
 * castigar la entrada.
 *
 * Se aplica DESPUÉS de podar los extremos, para que el sustituto añadido no se
 * lo lleve por delante la propia poda.
 *
 * @param {string} segmento
 * @returns {string}
 */
function neutralizarReservado(segmento) {
  return RESERVADOS.has(segmento.toUpperCase()) ? `${segmento}${SUSTITUTO_NOMBRE}` : segmento
}

/**
 * Segmento que representa a la referencia catastral en el nombre: la referencia
 * saneada, o una de las dos marcas honestas cuando no la hay o cuando no queda
 * nada de ella.
 *
 * @param {string|null|undefined} refcat
 * @returns {string}
 */
function segmentoDeRefcat(refcat) {
  if (refcat === null || refcat === undefined || refcat.trim().length === 0) {
    return MARCA_SIN_REFCAT
  }
  const saneado = sanearSegmento(refcat)
  if (saneado.length === 0) return MARCA_REFCAT_ILEGIBLE
  return neutralizarReservado(saneado)
}

// ── Nombre del fichero ────────────────────────────────────────────────────────

/**
 * Compone el nombre con el que baja el fichero:
 * `parcela_<referencia>_<AAAA-MM-DDTHH-mm-ss>.gml`.
 *
 * Ejemplos reales de las tres formas que puede tomar la parte central:
 *
 *     parcela_9398516VK3799G_2026-07-27T11-45-30.gml   ← con referencia
 *     parcela_sin-referencia_2026-07-27T11-45-30.gml   ← alta nueva, sin RC
 *     parcela_referencia-ilegible_2026-07-27T11-45-30.gml ← se aportó basura
 *
 * LA MARCA DE TIEMPO ES LA MISMA QUE VA DENTRO DEL FICHERO. Se obtiene de
 * `gml/_comun.js#dateTimeCatastro` —el formato exacto del `beginLifespanVersion`
 * y del `timeStamp` de la raíz— y solo se le cambian los dos puntos por
 * {@link SUSTITUTO_NOMBRE}, porque Windows no admite `:` en un nombre de fichero.
 * Que sean la misma cadena no es un adorno: permite emparejar un fichero de la
 * carpeta de descargas con su contenido de un vistazo, sin abrirlo, y evita la
 * situación clásica de tener tres GML de la misma parcela sin saber cuál es cuál.
 * Por el mismo motivo la fecha se rinde en componentes UTC (lo hace
 * `dateTimeCatastro`): el nombre y el contenido no pueden discrepar.
 *
 * FUNCIÓN PURA. La fecha entra por parámetro; este módulo no consulta el reloj.
 *
 * ── Sobre la regla de oro 1 y el saneado silencioso ──
 * Esta función NO emite detecciones cuando tiene que sanear la referencia, a
 * diferencia de `gml/ids.js#toXmlId`, que sí lo hace. La diferencia no es
 * descuido: un `gml:id` saneado queda ESCONDIDO dentro del fichero, donde el
 * usuario no lo verá jamás si nadie se lo cuenta; el nombre del fichero es, en
 * cambio, lo más visible de toda la operación —aparece en la barra de descargas
 * del navegador y en la carpeta— y va delante de los ojos del usuario sin que
 * nadie se lo tenga que anunciar. Avisar de ello sería ruido; el propio artefacto
 * es el aviso.
 *
 * @param {object} args
 * @param {string|null} [args.refcat=null]  Referencia catastral tal cual la
 *   tenga el expediente, sin sanear. `null` (o ausente, o vacía) = alta nueva sin
 *   referencia, que es un estado legítimo y no un error.
 * @param {Date} args.fecha  Instante que se estampa en el nombre. OBLIGATORIO y
 *   por parámetro: ver la cabecera del módulo.
 * @param {number} [args.miembros=1]  Cuántas parcelas lleva DENTRO el fichero.
 *   Con 1 el nombre es EXACTAMENTE el de siempre; con más, el prefijo pasa a
 *   {@link PREFIJO_NOMBRE_EXPEDIENTE}. Se pide el HECHO —cuántas van— y no el
 *   prefijo: si el llamante pudiera elegir el nombre, podría llamar «parcela» a
 *   un fichero con tres, que es justo lo que este primitivo existe para impedir.
 *   La `refcat` que se pasa en ese caso es la de la MATRIZ, y no cambia de papel:
 *   sigue siendo de quién es el expediente.
 * @returns {string}  Nombre de fichero seguro, terminado en {@link EXTENSION_GML}.
 * @throws {TypeError}   Si `refcat` no es un string ni nulo, si `fecha` no es
 *   una fecha, o si `miembros` no es un entero ≥ 1 (contrato roto por el
 *   programador).
 * @throws {RangeError}  Si `fecha` es una fecha inválida (tiempo no finito).
 */
export function nombreFicheroGml({ refcat = null, fecha, miembros = 1 } = {}) {
  if (refcat !== null && refcat !== undefined && typeof refcat !== 'string') {
    throw new TypeError(
      `nombreFicheroGml: 'refcat' debe ser un string o nulo; ` +
        `recibido ${JSON.stringify(refcat)}. Un alta sin referencia se pide con null.`,
    )
  }
  // `instanceof Date`, igual que `dateTimeCatastro`, al que se delega justo
  // debajo: aceptar aquí un pato que allí no pasa solo movería el error de sitio.
  if (!(fecha instanceof Date)) {
    throw new TypeError(
      `nombreFicheroGml: 'fecha' debe ser una fecha; recibido ${JSON.stringify(fecha)}. ` +
        'El nombre del fichero no consulta el reloj: la fecha entra por parámetro.',
    )
  }
  if (!Number.isFinite(fecha.getTime())) {
    throw new RangeError("nombreFicheroGml: 'fecha' es inválida (tiempo no finito).")
  }
  // LANZA en vez de corregir: un 0, un 1,5 o un `'2'` aquí significan que quien
  // llama no sabe cuántas parcelas está escribiendo, y ése es un bug del programa.
  // Redondear por lo bajo produciría el nombre de siempre para un fichero que ya
  // no es de siempre — un fallo mudo en el sitio más visible de la operación.
  if (!Number.isInteger(miembros) || miembros < 1) {
    throw new TypeError(
      `nombreFicheroGml: 'miembros' debe ser un entero >= 1; recibido ` +
        `${JSON.stringify(miembros)}. Es CUÁNTAS parcelas lleva el fichero, y de ahí ` +
        'sale el prefijo del nombre.',
    )
  }

  // El dateTime del Catastro (`AAAA-MM-DDTHH:mm:ss`) solo necesita perder los dos
  // puntos: el resto de su repertorio —dígitos, guiones y la `T`— ya está dentro
  // de la lista blanca del nombre.
  const marcaTiempo = dateTimeCatastro(fecha).split(':').join(SUSTITUTO_NOMBRE)

  // ⛔ Con `miembros === 1` esto tiene que dar EXACTAMENTE el nombre de siempre:
  // es el camino del 100 % del uso actual, y hay un guardián de regresión que lo
  // exige byte a byte. El prefijo es lo ÚNICO que cambia con varias parcelas —la
  // referencia y la marca de tiempo siguen significando lo mismo—, así que las
  // tres partes separadas por `_` se siguen partiendo igual, y `nombreFicheroExport`
  // (que corta por la longitud del prefijo) no se entera de nada mientras siga
  // pidiendo el fichero de una sola.
  const prefijo = miembros === 1 ? PREFIJO_NOMBRE : PREFIJO_NOMBRE_EXPEDIENTE
  const base = [prefijo, segmentoDeRefcat(refcat), marcaTiempo].join(SEPARADOR_NOMBRE)

  // Segunda pasada de neutralización, ahora sobre el nombre COMPLETO. Con la
  // plantilla de hoy nunca puede disparar (el nombre empieza por «parcela_» y
  // acaba en la marca de tiempo), y aun así se hace: un saneador que solo es
  // correcto mientras nadie toque la plantilla no es un saneador, es una
  // coincidencia. Cuesta una comparación de cadena por descarga.
  return `${neutralizarReservado(base)}${EXTENSION_GML}`
}

// ── Descarga ──────────────────────────────────────────────────────────────────

/**
 * Por qué no se descargó nada. Códigos estables: la UI puede decidir con ellos
 * sin analizar el texto de `mensaje`.
 *
 * @readonly
 */
export const MOTIVO_NO_DESCARGADO = Object.freeze({
  // El serializador no produjo GML (encontró errores bloqueantes): `xml` llegó
  // como `null` o como cadena vacía. No se baja un fichero de 0 bytes.
  SIN_CONTENIDO: 'SIN_CONTENIDO',
  // El entorno no implementa lo que hace falta para entregar un fichero
  // (`URL.createObjectURL`, `URL.revokeObjectURL` o `Blob`). Es el caso de jsdom
  // y el de un navegador antiguo.
  SIN_SOPORTE_NAVEGADOR: 'SIN_SOPORTE_NAVEGADOR',
})

/**
 * Describe un valor para el mensaje de una guarda. `JSON.stringify` a secas no
 * vale aquí: los dos parámetros que usan esta función (`documento` y `url`) son
 * objetos del ENTORNO, y a alguien que se equivoque de argumento le es fácil
 * pasar `window` —circular, `JSON.stringify` lanza— y acabar viendo una
 * excepción de serialización en lugar del `TypeError` que explicaba su error.
 *
 * @param {*} valor
 * @returns {string}
 */
function describir(valor) {
  try {
    const texto = JSON.stringify(valor)
    if (texto !== undefined) return texto
  } catch {
    // Estructura circular (window, document…): se cae al tipo, más abajo. No se
    // está tapando ningún fallo: esto solo compone el texto de un mensaje.
  }
  return `un ${typeof valor}`
}

/**
 * ¿Sirve como `document`? DUCK TYPING deliberado, no `instanceof Document`:
 * mismo criterio que `app/avisos.js#esElementoDOM` y `viewer/mapa.js`. Se pide
 * exactamente lo que este módulo usa y nada más, para que un doble de test no
 * tenga que fingir un documento entero.
 *
 * @param {*} d
 * @returns {boolean}
 */
function esDocumentoUtil(d) {
  return (
    !!d &&
    typeof d === 'object' &&
    typeof d.createElement === 'function' &&
    !!d.body &&
    typeof d.body.appendChild === 'function'
  )
}

/**
 * ¿Tiene `url` la FORMA de un objeto? Se admite `function` además de `object`
 * porque el `URL` global es una clase, y `typeof URL === 'function'`.
 *
 * Ojo a la distinción con la comprobación de CAPACIDAD que viene después: que
 * `url` no sea un objeto es un contrato roto por el programador (te has
 * equivocado de argumento) y lanza; que sea un objeto al que le faltan
 * `createObjectURL`/`revokeObjectURL` es una limitación del ENTORNO y se degrada
 * con motivo. La línea entre las dos cosas es la forma frente a lo que sabe hacer.
 *
 * @param {*} u
 * @returns {boolean}
 */
function esObjetoUrl(u) {
  return !!u && (typeof u === 'object' || typeof u === 'function')
}

/**
 * Resultado de {@link descargarTexto} y de {@link descargarGml} — el mismo tipo
 * para las dos, porque el desenlace de una entrega no depende de qué se entregue.
 * POJO plano, mismas cuatro claves siempre presentes: quien lo reciba puede
 * leerlas sin comprobar antes si existen.
 *
 * @typedef {Object} ResultadoDescarga
 * @property {boolean} descargado  `true` solo si el fichero llegó a entregarse.
 * @property {string|null} nombre  Nombre REAL del fichero entregado, o `null` si
 *   no se entregó ninguno. No se anuncia el nombre de un fichero que no existe.
 * @property {string|null} motivo  `null` si `descargado`; si no, una clave de
 *   {@link MOTIVO_NO_DESCARGADO}.
 * @property {string|null} mensaje  `null` si `descargado`; si no, texto en
 *   castellano directamente presentable al usuario (regla de oro 1).
 */

/**
 * Entrega un TEXTO como fichero descargado por el navegador. Es el primitivo de
 * la entrega: no sabe qué le están dando —un GML (F04), un informe de contraste
 * (F08), lo que venga— y por eso no compone nombres, no elige tipos MIME y no
 * rediagnostica nada. Pide las dos cosas que no puede saber (el nombre y el
 * MIME) y hace la única cosa que sí es suya: convertir una cadena en un fichero
 * sin perder un byte y sin dejar basura detrás.
 *
 * El recorrido completo, en orden, es: `Blob` con los bytes UTF-8 exactos →
 * `URL.createObjectURL` → anchor sintético con `download` → `click()` → retirada
 * del anchor → `URL.revokeObjectURL`. Los dos últimos pasos van en `finally`
 * anidados para que ocurran también si el `click()` lanza (ver la cabecera).
 *
 * ── EL NOMBRE LLEGA HECHO, Y ESO ES UNA RESPONSABILIDAD DE QUIEN LLAMA ──
 * Aquí NO se sanea: sanear el nombre COMPLETO se llevaría por delante el punto
 * de la extensión, y esta función no puede saber qué parte del nombre es
 * extensión y qué parte no. Quien construya el nombre tiene el precedente
 * entero en {@link nombreFicheroGml}: lista blanca, nombres reservados de
 * Windows y tope de longitud, con el porqué de cada cosa escrito al lado.
 *
 * @param {string|null} texto  El contenido ya compuesto, o `null` si quien lo
 *   genera no produjo nada. La cadena VACÍA se trata igual que `null`: un fichero
 *   de 0 bytes en la carpeta de descargas es peor que ninguno, porque aparenta
 *   que la operación salió bien.
 * @param {object} opciones
 * @param {string} opciones.nombreFichero  Nombre con el que baja el fichero,
 *   extensión incluida y YA SANEADO. Obligatorio.
 * @param {string} opciones.mime  Tipo MIME del Blob, con su `charset`.
 *   Obligatorio y sin valor por defecto: ver {@link TIPO_MIME_TEXTO}.
 * @param {Document} [opciones.documento=globalThis.document]  Documento donde se
 *   crea el anchor.
 * @param {typeof URL} [opciones.url=globalThis.URL]  Objeto con
 *   `createObjectURL`/`revokeObjectURL`.
 * @returns {ResultadoDescarga}
 * @throws {TypeError}  Si `nombreFichero` o `mime` no son cadenas con contenido,
 *   si `texto` no es un string ni `null`, si `documento` está PRESENTE y no sirve
 *   como documento, o si `url` está PRESENTE y no es un objeto. Que falten del
 *   entorno no lanza: degrada con motivo (ver la cabecera, «ausente ≠ equivocado»).
 * @throws {*}  Lo que lance `click()`, DESPUÉS de haber revocado la URL y
 *   retirado el anchor. Ver la cabecera: no se convierte en un `motivo`.
 */
export function descargarTexto(texto, opciones = {}) {
  const {
    nombreFichero,
    mime,
    documento = globalThis.document,
    url = globalThis.URL,
  } = opciones ?? {}

  if (typeof nombreFichero !== 'string' || nombreFichero.trim().length === 0) {
    throw new TypeError(
      `descargarTexto: 'nombreFichero' debe ser un nombre de fichero no vacío; ` +
        `recibido ${describir(nombreFichero)}. El nombre lo pone quien llama, ya ` +
        'saneado y con su extensión: este primitivo no lo inventa (ver nombreFicheroGml).',
    )
  }
  if (typeof mime !== 'string' || mime.trim().length === 0) {
    throw new TypeError(
      `descargarTexto: 'mime' debe ser un tipo MIME no vacío; recibido ${describir(mime)}. ` +
        'No hay valor por defecto a propósito: un MIME supuesto es un fichero que se ' +
        'abre con el programa equivocado o con la codificación adivinada.',
    )
  }
  if (texto !== null && typeof texto !== 'string') {
    throw new TypeError(
      `descargarTexto: 'texto' debe ser un string o null; recibido ${describir(texto)}. ` +
        'null significa «quien lo genera no produjo nada»; undefined significa que ' +
        'alguien se ha dejado el argumento, y eso no es lo mismo.',
    )
  }
  // `!== undefined`: ausente es el entorno hablando y se degrada más abajo;
  // presente-y-raro es el programador equivocándose y lanza aquí.
  if (documento !== undefined && !esDocumentoUtil(documento)) {
    throw new TypeError(
      `descargarTexto: 'documento' debe ser un documento del DOM con 'createElement' y ` +
        `'body'; recibido ${describir(documento)}. Sin DOM no hay descarga: ` +
        'esta función es del navegador.',
    )
  }
  if (url !== undefined && !esObjetoUrl(url)) {
    throw new TypeError(
      `descargarTexto: 'url' debe ser un objeto con 'createObjectURL' y ` +
        `'revokeObjectURL'; recibido ${describir(url)}.`,
    )
  }

  if (texto === null || texto.length === 0) {
    return {
      descargado: false,
      nombre: null,
      motivo: MOTIVO_NO_DESCARGADO.SIN_CONTENIDO,
      mensaje:
        'No se ha descargado ningún fichero porque no había contenido que entregar. ' +
        'Un fichero de 0 bytes en la carpeta de descargas es peor que ninguno: ' +
        'aparenta que la operación salió bien.',
    }
  }

  // Los bytes. `Blob` codifica en UTF-8 por especificación cuando la entrada es
  // un string: no hay conversión manual que pueda estropearlo, y tampoco BOM.
  return entregar([texto], { nombreFichero, mime, documento, url })
}

/**
 * **LA CADENA DE LA ENTREGA, EN UN SOLO SITIO.** Comprobación de capacidad →
 * `Blob` → `createObjectURL` → `<a download>` con su `stopPropagation` en
 * CAPTURA → `click()` → retirada → `revokeObjectURL`.
 *
 * Se extrajo en F09 (T5.1) al aparecer el TERCER llamante —un PDF son bytes, no
 * texto—, y por la misma razón por la que F08 extrajo {@link descargarTexto} de
 * {@link descargarGml}: la cabecera de este módulo se niega expresamente a abrir
 * una segunda familia de duplicados. Las cuatro trampas de arriba (codificación,
 * fuga de memoria, nombre de fichero, propagación del clic) son idénticas para
 * un GML, un informe de texto y un PDF; una copia que se olvidara de una
 * corrección fallaría en verde.
 *
 * **Aquí NO se valida nada del llamante.** Los `TypeError` de contrato los lanza
 * cada función pública con SU nombre dentro del mensaje, que es la mitad de lo
 * que sirve; esta se ocupa solo de lo que el ENTORNO sabe o no sabe hacer.
 *
 * @param {Array<string|ArrayBufferView|ArrayBuffer|Blob>} partes  Lo que va
 *   dentro del `Blob`, tal cual se le pasa al constructor.
 * @param {object} opciones
 * @param {string} opciones.nombreFichero  Ya saneado y con extensión.
 * @param {string} opciones.mime
 * @param {Document|undefined} opciones.documento  `undefined` ⇒ el entorno no
 *   tiene `document`, y se degrada con motivo (no lanza).
 * @param {typeof URL|undefined} opciones.url  Ídem.
 * @returns {ResultadoDescarga}
 * @throws {*}  Lo que lance `click()`, DESPUÉS de haber revocado la URL y
 *   retirado el anchor.
 */
function entregar(partes, { nombreFichero, mime, documento, url }) {
  const ConstructorBlob = globalThis.Blob
  const faltan = []
  if (documento === undefined) faltan.push('document')
  if (typeof ConstructorBlob !== 'function') faltan.push('Blob')
  if (url === undefined) {
    faltan.push('URL')
  } else {
    if (typeof url.createObjectURL !== 'function') faltan.push('URL.createObjectURL')
    if (typeof url.revokeObjectURL !== 'function') faltan.push('URL.revokeObjectURL')
  }
  if (faltan.length > 0) {
    return {
      descargado: false,
      nombre: null,
      motivo: MOTIVO_NO_DESCARGADO.SIN_SOPORTE_NAVEGADOR,
      mensaje:
        `No se ha descargado ningún fichero: este entorno no implementa ${faltan.join(', ')}. ` +
        'El contenido se ha generado correctamente, pero no hay forma de entregarlo desde aquí.',
    }
  }

  const blob = new ConstructorBlob(partes, { type: mime })

  const href = url.createObjectURL(blob)
  const anchor = documento.createElement('a')
  anchor.href = href
  anchor.download = nombreFichero
  // Sin texto dentro no ocuparía nada igualmente, pero `hidden` lo deja fuera del
  // flujo sin depender de qué layout tenga el `body` de turno.
  anchor.hidden = true
  // ⚠️ EL CLIC DE ESTE ENLACE NO PUEDE SALIR DE AQUÍ (2026-07-30).
  //
  // `anchor.click()` despacha un evento que BURBUJEA hasta `document`, y ahí lo
  // recoge cualquiera que esté escuchando. Medido en navegador real por el guion
  // `10-comprobar-gml.js`: al pulsar «Descargar informe de contraste», el
  // guardián de clic-fuera de `viewer/cajon-diagnostico.js` veía este clic, hacía
  // `contains(evento.target)` sobre un `<a>` que cuelga del `<body>` —así que no
  // está en el cajón— y CERRABA el cajón. El informe bajaba bien, pero el acuse
  // de recibo se escribía en un `role="status"` que acababa de quedar en
  // `display:none`: invisible y además fuera del árbol de accesibilidad. La regla
  // de oro 1 rota justo en el último gesto del recorrido de F08.
  //
  // La corrección va AQUÍ y no en el cajón, y el motivo es de fondo: este clic no
  // es un gesto del usuario, es **fontanería de la descarga**. Que un detalle de
  // implementación de este módulo sea observable por el resto de la aplicación es
  // el defecto; parchear a cada oyente para que aprenda a ignorarlo sería repartir
  // el arreglo entre todos los que algún día escuchen en `document`.
  //
  // `stopPropagation` **no** impide la acción por defecto: la descarga se dispara
  // igual. Y va en fase de captura sobre el propio nodo para que ni un oyente
  // puesto antes en el mismo elemento pueda reenviarlo.
  anchor.addEventListener('click', (evento) => evento.stopPropagation(), { capture: true })
  documento.body.appendChild(anchor)

  try {
    anchor.click()
  } finally {
    // Dos limpiezas, y no son igual de importantes: si `remove()` fallara (un
    // nodo que otra cosa ya movió, un DOM manipulado por una extensión), sin
    // este anidamiento la revocación se saltaría y el blob se quedaría vivo
    // hasta recargar la página. La revocación va, por tanto, en el `finally` más
    // interno: es la única que NO puede perderse.
    try {
      anchor.remove()
    } finally {
      url.revokeObjectURL(href)
    }
  }

  return { descargado: true, nombre: nombreFichero, motivo: null, mensaje: null }
}

/**
 * ¿Son BYTES entregables? Se admite `Uint8Array` —lo que devuelve
 * `report/pdf.js#bytes()`— y, en general, cualquier vista de `ArrayBuffer` o el
 * propio `ArrayBuffer`, que es exactamente lo que el constructor de `Blob`
 * acepta. Duck typing, no `instanceof`: un `Uint8Array` de otro realm (un
 * `<iframe>`, un worker) no pasa el `instanceof` y sí es perfectamente
 * entregable, y es la misma línea que este módulo ya traza con `documento`.
 *
 * @param {*} v
 * @returns {boolean}
 */
function esBytes(v) {
  if (ArrayBuffer.isView(v)) return true
  // `instanceof` primero (barato) y la marca interna después, que es la que
  // reconoce un `ArrayBuffer` fabricado en otro realm.
  return v instanceof ArrayBuffer || Object.prototype.toString.call(v) === '[object ArrayBuffer]'
}

/**
 * Cuántos bytes hay. `ArrayBuffer` mide por `byteLength` y las vistas también,
 * así que la misma propiedad sirve para las dos formas.
 *
 * @param {ArrayBufferView|ArrayBuffer} v
 * @returns {number}
 */
const cuantosBytes = (v) => (typeof v.byteLength === 'number' ? v.byteLength : 0)

/**
 * Entrega unos BYTES como fichero descargado por el navegador. Es el gemelo
 * binario de {@link descargarTexto} y **comparte con él la cadena entera** (ver
 * {@link entregar}): la misma comprobación de capacidad, el mismo `<a download>`
 * con su `stopPropagation` en fase de CAPTURA, la misma limpieza en `finally`
 * anidados y el mismo {@link ResultadoDescarga} de cuatro claves.
 *
 * ── POR QUÉ HACE FALTA, HABIENDO `descargarTexto` ──
 * Un PDF **son bytes, no texto**. Pasar un `Uint8Array` por `descargarTexto`
 * lanzaría (su guarda exige `string|null`), y convertirlo a cadena antes sería
 * peor que lanzar: el `Blob` recodificaría en UTF-8 cada byte ≥ 0x80 y el
 * fichero saldría corrupto —con el `%PDF` intacto en la cabecera, así que el
 * defecto no se vería hasta abrirlo—. El JPEG del plano y la tabla `xref`
 * (desplazamientos de byte EXACTOS) no sobreviven a ninguna reinterpretación.
 *
 * ── EL `stopPropagation` NO ES OPCIONAL ──
 * Está medido en navegador real (F08, guion 10): sin él, el `click()` de este
 * anchor burbujea hasta `document`, el guardián de clic-fuera de
 * `viewer/cajon-diagnostico.js` lo cuenta como un clic FUERA del cajón y lo
 * cierra — dejando el acuse de recibo escrito en un `role="status"` que acaba de
 * quedar en `display:none`. Aquí se hereda de {@link entregar} por construcción,
 * que es justo el motivo de haber extraído la cadena en vez de copiarla.
 *
 * @param {ArrayBufferView|ArrayBuffer|null} bytes  El documento ya compuesto, o
 *   `null` si quien lo genera no produjo nada. **Cero bytes se trata igual que
 *   `null`**: un fichero vacío en la carpeta de descargas aparenta que la
 *   operación salió bien.
 * @param {object} opciones
 * @param {string} opciones.nombreFichero  Nombre con el que baja el fichero,
 *   extensión incluida y YA SANEADO. Obligatorio: este primitivo no lo inventa.
 * @param {string} opciones.mime  Tipo MIME del Blob. Obligatorio y sin defecto,
 *   por lo mismo que en {@link descargarTexto}. Ver {@link TIPO_MIME_PDF}.
 * @param {Document} [opciones.documento=globalThis.document]
 * @param {typeof URL} [opciones.url=globalThis.URL]
 * @returns {ResultadoDescarga}
 * @throws {TypeError}  Si `nombreFichero` o `mime` no son cadenas con contenido,
 *   si `bytes` no es un búfer ni `null`, o si `documento`/`url` están PRESENTES y
 *   no sirven. Que falten del entorno NO lanza: degrada con motivo.
 * @throws {*}  Lo que lance `click()`, DESPUÉS de haber limpiado.
 */
export function descargarBinario(bytes, opciones = {}) {
  const {
    nombreFichero,
    mime,
    documento = globalThis.document,
    url = globalThis.URL,
  } = opciones ?? {}

  if (typeof nombreFichero !== 'string' || nombreFichero.trim().length === 0) {
    throw new TypeError(
      `descargarBinario: 'nombreFichero' debe ser un nombre de fichero no vacío; ` +
        `recibido ${describir(nombreFichero)}. El nombre lo pone quien llama, ya ` +
        'saneado y con su extensión: este primitivo no lo inventa (ver nombreFicheroGml).',
    )
  }
  if (typeof mime !== 'string' || mime.trim().length === 0) {
    throw new TypeError(
      `descargarBinario: 'mime' debe ser un tipo MIME no vacío; recibido ${describir(mime)}. ` +
        'No hay valor por defecto a propósito: un MIME supuesto es un fichero que se ' +
        'abre con el programa equivocado.',
    )
  }
  if (bytes !== null && !esBytes(bytes)) {
    throw new TypeError(
      `descargarBinario: 'bytes' debe ser un Uint8Array (u otra vista de ArrayBuffer), un ` +
        `ArrayBuffer, o null; recibido ${describir(bytes)}. null significa «quien lo genera no ` +
        'produjo nada»; undefined significa que alguien se ha dejado el argumento, y eso no es ' +
        'lo mismo. Un string tampoco vale: para texto está descargarTexto, que codifica en UTF-8.',
    )
  }
  // `!== undefined`: ausente es el entorno hablando y se degrada más abajo;
  // presente-y-raro es el programador equivocándose y lanza aquí.
  if (documento !== undefined && !esDocumentoUtil(documento)) {
    throw new TypeError(
      `descargarBinario: 'documento' debe ser un documento del DOM con 'createElement' y ` +
        `'body'; recibido ${describir(documento)}. Sin DOM no hay descarga: ` +
        'esta función es del navegador.',
    )
  }
  if (url !== undefined && !esObjetoUrl(url)) {
    throw new TypeError(
      `descargarBinario: 'url' debe ser un objeto con 'createObjectURL' y ` +
        `'revokeObjectURL'; recibido ${describir(url)}.`,
    )
  }

  if (bytes === null || cuantosBytes(bytes) === 0) {
    return {
      descargado: false,
      nombre: null,
      motivo: MOTIVO_NO_DESCARGADO.SIN_CONTENIDO,
      mensaje:
        'No se ha descargado ningún fichero porque no había contenido que entregar. ' +
        'Un fichero de 0 bytes en la carpeta de descargas es peor que ninguno: ' +
        'aparenta que la operación salió bien.',
    }
  }

  return entregar([bytes], { nombreFichero, mime, documento, url })
}

/**
 * Entrega el GML como fichero descargado por el navegador.
 *
 * Es un LLAMANTE de {@link descargarTexto}: aporta las tres cosas que sabe de su
 * dominio —el nombre saneado ({@link nombreFicheroGml}), el tipo MIME
 * ({@link TIPO_MIME_GML}) y el mensaje concreto de cuando el serializador no
 * emitió nada— y delega toda la mecánica del navegador. Ver la cabecera del
 * módulo: la mecánica se comparte, no se copia.
 *
 * @param {string|null} xml  El GML ya serializado, o `null` si el serializador no
 *   produjo nada por errores bloqueantes. La cadena VACÍA se trata igual que
 *   `null`: descargar un fichero de 0 bytes es peor que no descargar nada, porque
 *   aparenta que la operación salió bien.
 * @param {object} [opciones]
 * @param {string|null} [opciones.refcat=null]  Ver {@link nombreFicheroGml}.
 * @param {Date} opciones.fecha  Ver {@link nombreFicheroGml}. Obligatorio, y se
 *   valida SIEMPRE —incluso cuando `xml` es `null` y no va a bajar nada—, para
 *   que un cableado mal hecho no se descubra el día en que el serializador acierta.
 * @param {number} [opciones.miembros=1]  Cuántas parcelas lleva DENTRO el `xml`.
 *   Se reenvía tal cual a {@link nombreFicheroGml}, que es quien decide el prefijo.
 *   ⛔ **El defecto es 1 y con él el nombre es EXACTAMENTE el de siempre**: F17
 *   añade un caso, no cambia el que había. Quien entrega un expediente de varias
 *   parcelas (`derivacion/entrega.js`) tiene el hecho a mano en `entrega.nMiembros`
 *   y lo pasa; nadie tiene que acordarse de elegir un prefijo.
 * @param {Document} [opciones.documento=globalThis.document]  Documento donde se
 *   crea el anchor. El valor por defecto lo aplica {@link descargarTexto}, que es
 *   quien lo usa: un solo sitio donde caer al global.
 * @param {typeof URL} [opciones.url=globalThis.URL]  Objeto con
 *   `createObjectURL`/`revokeObjectURL`. Ídem.
 * @returns {ResultadoDescarga}
 * @throws {TypeError}  Si `xml` no es un string ni `null`, si `refcat`/`fecha`
 *   incumplen el contrato de {@link nombreFicheroGml}, o si `documento`/`url`
 *   incumplen el de {@link descargarTexto}.
 * @throws {RangeError}  Si `fecha` es una fecha inválida.
 * @throws {*}  Lo que lance `click()`, DESPUÉS de haber revocado la URL y
 *   retirado el anchor. Ver la cabecera: no se convierte en un `motivo`.
 */
export function descargarGml(xml, opciones = {}) {
  // `documento` y `url` se reenvían SIN resolver el global: el defecto vive en
  // `descargarTexto` y tenerlo en dos sitios sería la primera grieta por la que
  // se cuela un duplicado.
  const { refcat = null, fecha, miembros = 1, documento, url } = opciones ?? {}

  if (xml !== null && typeof xml !== 'string') {
    throw new TypeError(
      `descargarGml: 'xml' debe ser un string o null; recibido ${JSON.stringify(xml)}. ` +
        'null significa «el serializador no produjo GML»; undefined significa que ' +
        'alguien se ha dejado el argumento, y eso no es lo mismo.',
    )
  }

  // Se calcula ANTES de mirar `xml`: el contrato de `refcat`/`fecha` se cumple o
  // no se cumple, y no depende de que haya algo que descargar.
  const nombre = nombreFicheroGml({ refcat, fecha, miembros })

  // Este caso NO se delega, y no es un descuido: `descargarTexto` también se
  // niega a bajar 0 bytes, pero con un mensaje genérico. El de aquí nombra la
  // causa REAL y le dice al usuario qué mirar —los errores del expediente—, que
  // es la única forma de que la regla de oro 1 sirva para algo.
  if (xml === null || xml.length === 0) {
    return {
      descargado: false,
      nombre: null,
      motivo: MOTIVO_NO_DESCARGADO.SIN_CONTENIDO,
      mensaje:
        'No se ha descargado ningún fichero porque no se ha generado GML. ' +
        'Revisa los errores del expediente: mientras haya alguno bloqueante, el ' +
        'serializador no emite nada, y un GML vacío sería peor que ninguno.',
    }
  }

  return descargarTexto(xml, {
    nombreFichero: nombre,
    mime: TIPO_MIME_GML,
    documento,
    url,
  })
}

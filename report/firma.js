// report/firma.js — F09 · T3.3. El PIE DE FIRMA y el ENCABEZADO del informe.
//
// Contrato D del plan de F09:
//
//   firma:      { nombre, numeroColegiado, colegio, contacto }        // string|null
//   encabezado: { municipio, provincia, paraje, poligono, parcela,
//                 refcat, srs, fecha: Date, idDocumento }
//
// Módulo PURO: sin DOM, sin red, sin reloj y sin un solo `import`. Normaliza lo
// que le dan, decide qué se imprime y qué se sustituye, y compone el
// identificador del documento a partir de una fecha que recibe. Quien maqueta es
// `report/pdf.js` (T3.2) y quien lo rellena es el diálogo de T4.1; aquí no se
// dibuja nada.
//
// ── POR QUÉ ESTE FICHERO NO ES UN FORMULARIO MÁS ────────────────────────────
// `spec/feature-09-informe-parcela.md:21` lo dice sin rodeos: **«el punto 6
// sostiene toda la propuesta de valor»**. Es lo que convierte una medición en un
// documento que alguien firma y entrega, y es —según `MEJORES_PRACTICAS_GML.md`
// §5.4— uno de los tres huecos que ningún competidor cubre. Un pie de firma que
// se pierde entre sesiones, que imprime un hueco mudo donde falta un dato o que
// le pone a quien firma una etiqueta que no le corresponde, no es un detalle de
// maquetación: es el producto entero fallando en su última línea.
//
// ── LA NEUTRALIDAD DE ESTE BLOQUE ES JURÍDICA, NO DE REDACCIÓN ──────────────
// `MEJORES_PRACTICAS_GML.md` §5.2: **quién puede firmar qué está en disputa**.
// Colegios de varias ramas se disputan la atribución, y la sentencia que se cita
// en los foros para zanjarlo está degradada a Tier C en ese mismo documento
// (fuente de parte interesada, no localizada en CENDOJ, y con doctrina contraria
// a la que se le atribuye). Consecuencias, y son REGLAS de este fichero:
//
//   · **El bloque no presupone titulación.** Ni la nombra, ni la insinúa, ni
//     ofrece una lista de la que elegirla. `colegio` es texto libre y no un
//     desplegable: un desplegable es una lista cerrada, y cerrar esa lista es
//     justo la decisión que este proyecto no puede tomar.
//   · **Nada de rótulos del estilo «El … que suscribe».** Las etiquetas son
//     descriptivas del CAMPO («Nombre y apellidos», «Número de colegiado») y no
//     de la persona.
//   · **Ante la duda entre dos redacciones, la que menos afirme.** Por eso el
//     bloque se titula {@link TITULO_FIRMA} y no otra cosa.
//
// El guardián de vocabulario de `test/report/firma.test.js` afirma esto sobre
// TODO lo que el módulo puede llegar a imprimir —los rótulos, el título y los
// sustitutos—, y se prueba a sí mismo contra una frase que sí presupone
// titulación, para que no pueda quedarse verde por vacuo.
//
// ⚠️ Lo que el guardián NO mira, y es deliberado: los VALORES que teclea el
// usuario. Si alguien escribe su titulación en `colegio`, se imprime tal cual —
// es su documento y su decisión. Lo que este módulo se prohíbe es afirmarlo ÉL.
//
// ── LOS TRES SABORES DE «NO HAY», OTRA VEZ Y POR ESCRITO ────────────────────
// Es la doctrina que `diagnostico/parcela.js` fijó en F07 y `report/contraste-texto.js`
// conservó letra por letra en F08. Aquí vuelve porque un encabezado es donde
// más barato sale confundirlos:
//
//   1. **El dato está** → se imprime.
//   2. **El dato se pidió y no vino** (`null`, o `''`) → {@link NO_CONSTA}. Nunca
//      un hueco en blanco: un hueco lo lee el destinatario como «esto no hacía
//      falta», y lo que de verdad pasa es que el dato falta.
//   3. **El dato no se pidió** → {@link NO_CONSULTADO}, que NO es lo mismo. Decir
//      «No consta el paraje» cuando nadie ha preguntado por él es afirmar algo
//      sobre el Catastro que no sabemos. Y si se preguntó y el servicio falló, es
//      un TERCER caso ({@link NO_SE_HA_PODIDO_CONSULTAR}), con el mensaje del
//      servicio disponible en la propia línea.
//
// **Hecho MEDIDO que conviene leer antes de escribir un test:** en la parcela
// urbana de referencia del proyecto (`9398516VK3799G`) el servicio descriptivo
// del Catastro devuelve **municipio y provincia, pero ni paraje, ni polígono, ni
// parcela, ni domicilio** — esa rama de la respuesta no los trae. Del domicilio
// eso es el sabor 2 y punto. De los otros tres **no es ningún sabor**, y por qué
// no lo es está en la sección siguiente, que es lo que arregla este fichero.
//
// ── PARAJE, POLÍGONO Y PARCELA SON EL IDENTIFICADOR DE LA FINCA RÚSTICA ─────
// Los tres sabores de arriba responden a «¿qué ha pasado con el dato?». Falta el
// caso en el que la pregunta misma no tiene sentido, y en este encabezado es el
// caso MAYORITARIO: **una finca urbana no tiene paraje, ni polígono, ni número
// de parcela dentro del polígono**. No es que el servicio se los salte: es que
// esa terna es el sistema de identificación de la finca RÚSTICA. El identificador
// equivalente de una urbana es la vía y el número, o sea el **domicilio**.
//
// Antes de esto, la urbana de referencia salía así:
//
//     Paraje                        : No se ha consultado
//     Polígono                      : No se ha consultado
//     Parcela (nº en el polígono)   : No se ha consultado
//
// y las tres líneas eran **falsas**: `Consulta_DNPRC` sí se consultó y sí
// contestó. Quien lo lea entiende «se omitió ese dato» cuando lo cierto es «ese
// dato no existe para esta finca». No es un error silencioso —esos los persigue
// el resto del repo— sino un no-error que confunde, y en un documento que alguien
// firma eso cuesta lo mismo.
//
// **La decisión, y es la de este módulo: en una urbana esas tres filas NO SE
// IMPRIMEN.** No se emiten con un «No aplica» ni con ningún otro sustituto.
// Razones, en orden:
//
//   · Un sustituto tendría que repetirse TRES veces para decir una sola cosa, y
//     esa cosa no es del dato: es de la finca. Se dice UNA vez, en su sitio, con
//     la fila {@link ROTULO_ENCABEZADO}`.clase` — «Clase de finca: URBANA»— que
//     es además lo que imprime la propia consulta descriptiva del Catastro.
//   · El hueco que dejan no queda mudo: lo ocupa el **domicilio**, que es el
//     identificador que una urbana sí tiene. Si el servicio no lo trajo —y en la
//     rama `lrcdnp` no lo trae, medido—, esa línea dirá «No consta», que esta vez
//     sí es verdad: el domicilio existe en el mundo y no nos lo han dado.
//   · Ocultar sin decir por qué sería la trampa de siempre. Por eso la fila de la
//     clase se imprime SIEMPRE, también cuando no se sabe cuál es: es la que
//     explica la ausencia de las otras.
//
// Y una invariante dura, para que esta decisión no pueda perder un dato jamás:
// **una fila solo se oculta si NO tiene dato.** Si a un encabezado marcado como
// urbano le llegara un polígono, el polígono se imprime — antes que creerse la
// clasificación, se le cree al dato. Es el mismo criterio con el que
// {@link procedenciaDescriptivos} deriva su `ok` de si hay `datos` y no de la
// bandera.
//
// Con `clase: 'RUSTICA'` no cambia nada respecto de lo de siempre: ahí las tres
// filas son el identificador de la finca, y si faltan, faltan de verdad. Con
// `clase: null` —el servicio no ha podido determinarla, o nadie lo ha
// consultado— **no se adivina**: se emiten las tres y se declara el sabor que
// toque, que es la conducta prudente y la que ya había.
//
// ── EL RELOJ NO SE LEE AQUÍ ─────────────────────────────────────────────────
// Mismo criterio, y por el mismo motivo, que `report/contraste-texto.js` y todo
// `gml/`: un informe firmado es un SNAPSHOT y tiene que valer lo mismo dentro de
// un año. La `fecha` entra por parámetro y {@link componerIdDocumento} la recibe;
// este módulo no consulta la marca de tiempo del sistema ni instancia una fecha
// propia. Tampoco usa formateadores dependientes del entorno: la fecha se rinde
// por componentes UTC, como `gml/_comun.js#dateTimeCatastro`, para que el mismo
// instante produzca el mismo texto en CI y en el equipo de quien firma. Hay un
// guardián por grep sobre el TEXTO de este fichero, así que esas llamadas no
// aparecen ni dentro de un comentario.
//
// ── `idDocumento`: SE REUTILIZA LA CLAVE QUE YA EXISTE ──────────────────────
// `model/parcela.js#crearExpediente` ya lleva `metadatos.idDocumento` desde F00.
// **No se inventa otra clave**: el encabezado usa ESA, y si el expediente trae
// una, manda la suya y se imprime literal.
//
// Cuando no la trae —y no la trae casi nunca, porque `crearExpediente` la deja
// en `''` por defecto—, se COMPONE con {@link componerIdDocumento}. Es la ÚNICA
// excepción a la regla dura de arriba, y está razonada: «No consta» es la
// respuesta honesta para un dato DEL MUNDO que no tenemos (el paraje existe o no
// existe, lo sepamos o no), pero el identificador no es un dato del mundo: es la
// matrícula que esta herramienta le pone al documento que está emitiendo. Un
// documento cuyo identificador dice «No consta» no es honesto, es inservible.
//
// La forma es **`CG-<refcat>-<AAAAMMDD>-<hhmmss>Z`** y está elegida para que se
// pueda leer y rastrear a ojo:
//   · `CG` — Concreta GML. Distingue el identificador de los códigos oficiales
//     (el CSV del IVG lo emite la Sede, y este NO es aquello).
//   · `<refcat>` — la referencia catastral en forma canónica (mayúsculas, solo
//     letras y dígitos). Es lo que permite decir de un vistazo de qué parcela es.
//     Sin referencia, {@link SIN_REFCAT}, que se ve y se entiende.
//   · fecha y hora **UTC** por componentes, y la `Z` final es la marca ISO 8601
//     de que lo son. Sin ella, dos documentos emitidos a las 01:00 en España
//     llevarían una fecha que no cuadra con la del día en que se firmaron y nadie
//     sabría por qué; con ella, la ambigüedad se acaba en un carácter.
// {@link esIdDocumento} reconoce esa forma, para que quien la reciba pueda
// comprobarla sin volver a escribir la expresión regular.
//
// ── QUÉ NO HACE ─────────────────────────────────────────────────────────────
//   · **No lanza porque falte un dato.** Un informe sin número de colegiado es un
//     informe legítimo. Lanza —`TypeError`— ante un TIPO imposible o una clave
//     desconocida, que es contrato roto por el programador. Es la frontera de
//     siempre en este repo: *el entorno degrada, el programador revienta*.
//   · **No persiste nada.** El pie de firma se recuerda entre sesiones desde
//     `storage/pie-firma.js`, que es quien tiene la base y quien escribe qué se
//     guarda y cómo se borra. Aquí no hay estado.
//   · **No maqueta.** {@link lineasFirma} y {@link lineasEncabezado} devuelven
//     rótulo y valor ya resueltos; dónde caen en la página es de `report/pdf.js`.
//   · **No traduce los mensajes del servicio.** Llegan en español, redactados por
//     `services/`, y se copian literales (regla de oro 1).
//
// Regla de oro 9, que aquí también aplica: la aplicación mide, el colegiado
// interpreta y firma. Este fichero no dice una palabra sobre el mérito de nada.

// ── Vocabulario impreso ──────────────────────────────────────────────────────

/**
 * Lo que se escribe cuando un dato **se pidió y no lo hay**. Mismo texto,
 * deliberadamente, que `report/contraste-texto.js` y `viewer/cajon-diagnostico.js`:
 * tres módulos que dicen lo mismo tienen que decirlo con las mismas palabras.
 *
 * No es un `—` a secas: un guion se lee como «cero» o como «nada que reseñar».
 *
 * @readonly
 */
export const NO_CONSTA = 'No consta'

/**
 * Lo que se escribe cuando el dato **no se pidió**. Sabor 3 de la cabecera, y la
 * distinción más cara de perder: «No consta el polígono» afirma algo sobre el
 * Catastro; «no se ha consultado» afirma algo sobre nosotros, que es lo único
 * que sabemos.
 *
 * @readonly
 */
export const NO_CONSULTADO = 'No se ha consultado'

/**
 * Lo que se escribe cuando el dato **se pidió y la consulta falló**. Ni «No
 * consta» (que daría por hecho que el dato no existe) ni «No se ha consultado»
 * (que sería falso: sí se intentó). El porqué concreto viaja en el `detalle` de
 * la línea, redactado por `services/`.
 *
 * @readonly
 */
export const NO_SE_HA_PODIDO_CONSULTAR = 'No se ha podido consultar'

/**
 * La finca es URBANA. **Vocabulario del contrato E**, no de este módulo: lo fija
 * `services/_catastro-dnp.js#CLASE_PARCELA` y aquí se escribe otra vez porque
 * este fichero no importa nada (ver la cabecera y el guardián por grep de su
 * test). Que las dos copias digan lo mismo lo afirma el test, no la fe.
 *
 * Se imprime **literal**, como el municipio: el servicio habla en mayúsculas y
 * sin acentos, y arreglarlo sería redactar el dato (regla de oro 8).
 *
 * @readonly
 */
export const CLASE_URBANA = 'URBANA'

/**
 * La finca es RÚSTICA. Íd. Es la única clase para la que paraje, polígono y
 * parcela son el identificador de la finca, y por tanto la única en la que su
 * ausencia es una ausencia.
 *
 * @readonly
 */
export const CLASE_RUSTICA = 'RUSTICA'

/**
 * Las dos clases que el contrato E puede dar. **Lista CERRADA**: cualquier otro
 * valor es contrato roto por el programador y {@link componerEncabezado} lanza,
 * porque una clase que no se entiende ni se puede imprimir ni sirve para decidir
 * qué filas aplican. La forma de decir «no se sabe» es `null`, y está prevista.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLASES_ADMITIDAS = Object.freeze([CLASE_URBANA, CLASE_RUSTICA])

/**
 * El rótulo del bloque de firma. **«Firma», y nada más.**
 *
 * Se consideraron y se descartaron «Técnico que suscribe», «El técnico
 * competente», «Firma facultativa» y cualquier variante con profesión: todas
 * afirman quién puede firmar, y eso está en disputa (ver la cabecera). Entre dos
 * redacciones, la que menos afirme.
 *
 * @readonly
 */
export const TITULO_FIRMA = 'Firma'

// ── Los campos del contrato D ────────────────────────────────────────────────

/**
 * Los cuatro campos del pie de firma, **en el orden en que se imprimen**. El
 * orden es parte del contrato: quien maqueta recorre esta lista y no inventa la
 * suya, así que añadir un campo se hace en un sitio y llega a todas partes.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CAMPOS_FIRMA = Object.freeze(['nombre', 'numeroColegiado', 'colegio', 'contacto'])

/**
 * Los campos del encabezado que **vienen del servicio descriptivo del Catastro**
 * (contrato E), en orden de impresión. Son los únicos que pueden tener el sabor 3
 * —«no se ha consultado»—, porque son los únicos que hay que ir a preguntar.
 *
 * Son los siete de `services/_catastro-dnp.js#CAMPOS_DESCRIPTIVOS`, y el test lo
 * afirma contra esa lista en vez de dar por hecho que nadie las desincronizará.
 *
 * `refcat`, `srs`, `fecha` e `idDocumento` los pone la propia aplicación: si
 * faltaran, faltarían aquí dentro y no en el Catastro.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CAMPOS_DEL_SERVICIO = Object.freeze([
  'municipio',
  'provincia',
  // La clase va antes que el bloque de identificación porque es la que dice cuál
  // de los dos bloques aplica. Ver la cabecera.
  'clase',
  'domicilio',
  'paraje',
  'poligono',
  'parcela',
])

/**
 * Las tres filas que **solo tienen sentido en una finca rústica**: son su sistema
 * de identificación. En una urbana no faltan, es que no existen, y por eso no se
 * imprimen (ver la cabecera). Se exporta para que quien maquete pueda razonar
 * sobre ellas sin volver a escribir la lista.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CAMPOS_SOLO_RUSTICA = Object.freeze(['paraje', 'poligono', 'parcela'])

/**
 * Los once campos del encabezado, en orden de impresión. **Que estén todos en el
 * objeto no significa que se impriman todos**: {@link lineasEncabezado} omite los
 * de {@link CAMPOS_SOLO_RUSTICA} cuando la finca es urbana y no traen dato.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CAMPOS_ENCABEZADO = Object.freeze([
  ...CAMPOS_DEL_SERVICIO,
  'refcat',
  'srs',
  'fecha',
  'idDocumento',
])

/**
 * Lo que {@link lineasEncabezado} EXIGE encontrar en el objeto que le pasen.
 *
 * No son los once: `clase` y `domicilio` llegaron después que el resto, y un
 * encabezado escrito antes —o compuesto a mano por quien solo tenga los otros
 * nueve— tiene que seguir imprimiéndose en vez de reventar. Sin `clase` no hay
 * urbana que detectar, así que ese encabezado se imprime como se imprimía: con
 * las tres filas rústicas y el sabor que toque.
 *
 * @readonly
 * @type {readonly string[]}
 */
const CAMPOS_ENCABEZADO_EXIGIDOS = Object.freeze(
  CAMPOS_ENCABEZADO.filter((campo) => campo !== 'clase' && campo !== 'domicilio'),
)

/**
 * Rótulo de cada campo de la firma. **Descriptivos del CAMPO, no de la persona**
 * (ver la cabecera): «Nombre y apellidos» describe qué se escribe ahí; «El
 * técnico que suscribe» describiría quién es, que es justo lo que no sabemos.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const ROTULO_FIRMA = Object.freeze({
  nombre: 'Nombre y apellidos',
  numeroColegiado: 'Número de colegiado',
  // «Colegio profesional» y no una lista de colegios: campo libre a propósito.
  colegio: 'Colegio profesional',
  contacto: 'Contacto',
})

/**
 * Rótulo de cada campo del encabezado.
 *
 * `parcela` lleva la aclaración «(nº en el polígono)» porque en el mismo bloque
 * hay una «Referencia catastral», y dos rótulos que se pueden confundir en un
 * documento que alguien presenta valen menos que uno largo. No es el mismo dato:
 * el polígono y la parcela son la identificación RÚSTICA, y el servicio solo los
 * trae en esa rama.
 *
 * `clase` se rotula «Clase de finca» y no «Tipo»: es la palabra con la que el
 * Catastro publica ese dato en su propia consulta descriptiva, y aquí se copia el
 * vocabulario de fuera antes que inventar el de dentro.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const ROTULO_ENCABEZADO = Object.freeze({
  municipio: 'Municipio',
  provincia: 'Provincia',
  clase: 'Clase de finca',
  domicilio: 'Domicilio',
  paraje: 'Paraje',
  poligono: 'Polígono',
  parcela: 'Parcela (nº en el polígono)',
  refcat: 'Referencia catastral',
  srs: 'Sistema de referencia',
  fecha: 'Fecha del informe',
  idDocumento: 'Identificador del documento',
})

/**
 * Una firma sin ningún dato. Congelada, y por eso {@link normalizarFirma} nunca
 * la devuelve tal cual: devuelve una copia nueva, porque quien la reciba la va a
 * enchufar a un formulario y va a querer escribir en ella.
 *
 * @readonly
 * @type {Readonly<{nombre: null, numeroColegiado: null, colegio: null, contacto: null}>}
 */
export const FIRMA_VACIA = Object.freeze(
  Object.fromEntries(CAMPOS_FIRMA.map((campo) => [campo, null])),
)

// ── El identificador del documento ───────────────────────────────────────────

/** Prefijo del identificador: Concreta GML. Ver la cabecera. */
export const PREFIJO_ID_DOCUMENTO = 'CG'

/**
 * Lo que ocupa el sitio de la referencia catastral en el identificador cuando no
 * hay ninguna. Se ve y se entiende: un identificador con un hueco (`CG--2026…`)
 * parecería un error de programa.
 */
export const SIN_REFCAT = 'SINREF'

/**
 * La forma del identificador. Se usa aquí y en {@link esIdDocumento}, y no se
 * escribe dos veces.
 *
 * @type {RegExp}
 */
const FORMA_ID_DOCUMENTO = /^CG-[A-Z0-9]+-\d{8}-\d{6}Z$/

// ── Utilidades ───────────────────────────────────────────────────────────────

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para un mensaje de error, sin reventar con los cíclicos. */
function describir(valor) {
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

/**
 * Un texto utilizable, o `null`. Recorta los extremos y **colapsa las rachas de
 * espacio internas a una sola**, saltos de línea incluidos.
 *
 * Lo segundo no es cosmética: un nombre pegado desde un correo trae a menudo un
 * salto de línea dentro, y ese salto rompe la caja del pie de firma en el PDF
 * (donde el ancho lo decide `report/pdf.js#partirTexto`, que reparte por
 * palabras y no espera saltos). Colapsar aquí es la única forma de que el
 * problema no llegue a la maqueta.
 *
 * @param {string} valor
 * @returns {string|null}
 */
function limpiar(valor) {
  const limpio = valor.replace(/\s+/g, ' ').trim()
  return limpio === '' ? null : limpio
}

/**
 * Exige `string | null | undefined` y devuelve texto limpio o `null`.
 *
 * **Un número LANZA**, y es deliberado aunque `numeroColegiado` invite a pasarlo:
 * los números de colegiado llevan ceros a la izquierda, puntos de millar y a
 * veces letras, y `String(4321)` perdería en silencio el `0` de `04321`. Que
 * reviente en la primera línea que lo escriba.
 *
 * @param {*} valor
 * @param {string} campo
 * @param {string} quien
 * @returns {string|null}
 * @throws {TypeError}
 */
function exigirTextoONulo(valor, campo, quien) {
  if (valor === null || valor === undefined) return null
  if (typeof valor !== 'string') {
    throw new TypeError(
      `${quien}: '${campo}' debe ser una cadena o null; recibido ${describir(valor)}. ` +
        'Un número se convertiría solo y perdería los ceros a la izquierda sin decirlo: ' +
        'conviértelo tú, a la vista, si de verdad es lo que quieres.',
    )
  }
  return limpiar(valor)
}

/**
 * Exige una clase de finca del contrato E: {@link CLASE_URBANA},
 * {@link CLASE_RUSTICA} o `null`.
 *
 * **Un tercer valor LANZA.** No es rigidez: la clase decide qué filas del
 * encabezado aplican (ver la cabecera), así que una clase que no se entiende o
 * imprimiría una palabra que nadie ha escrito, o —peor— dejaría el encabezado de
 * una urbana con las tres filas rústicas sin que nadie se enterase. `null` es la
 * forma prevista y correcta de decir «no se sabe», y esa no lanza.
 *
 * La caja no manda (`'urbana'` vale y se canonicaliza), porque es un código y no
 * un texto del mundo: aquí no se está «arreglando» un dato del Catastro, se está
 * leyendo un valor de un vocabulario cerrado que este proyecto ya tradujo.
 *
 * @param {*} valor
 * @param {string} quien
 * @returns {'URBANA'|'RUSTICA'|null}
 * @throws {TypeError}
 */
function exigirClase(valor, quien) {
  const texto = exigirTextoONulo(valor, 'clase', quien)
  if (texto === null) return null
  const canonica = texto.toUpperCase()
  if (!CLASES_ADMITIDAS.includes(canonica)) {
    throw new TypeError(
      `${quien}: 'clase' debe ser ${CLASES_ADMITIDAS.join(' o ')} —el vocabulario del contrato ` +
        `E— o null si no se ha podido determinar; recibido ${describir(valor)}. No se ignora a ` +
        'propósito: la clase decide si el paraje y el polígono aplican a esta finca, y una ' +
        'clase que no se entiende dejaría el encabezado de una urbana pidiendo disculpas por ' +
        'datos que no existen para ella.',
    )
  }
  return canonica
}

/**
 * Rechaza claves que no están en el contrato. **Se lanza en vez de ignorarlas**
 * porque el fallo que evita es el peor de este fichero: un `{colegiado: '4321'}`
 * —una letra de menos que `numeroColegiado`— se ignoraría sin ruido y el
 * documento saldría firmado con «No consta» donde el usuario había escrito su
 * número. Un dato tecleado que desaparece en silencio es exactamente lo que la
 * regla de oro 1 prohíbe.
 *
 * @param {object} entrada
 * @param {readonly string[]} admitidas
 * @param {string} quien
 * @throws {TypeError}  Nombrando las sobrantes y las válidas.
 */
function exigirClavesConocidas(entrada, admitidas, quien) {
  const sobrantes = Object.keys(entrada).filter((k) => !admitidas.includes(k))
  if (sobrantes.length > 0) {
    throw new TypeError(
      `${quien}: claves desconocidas (${sobrantes.join(', ')}). Las admitidas son ` +
        `${admitidas.join(', ')}. No se ignoran a propósito: una clave mal escrita se ` +
        'perdería en silencio y el documento se imprimiría con «No consta» donde había un dato.',
    )
  }
}

/**
 * Exige una fecha utilizable. La misma guarda, con las mismas palabras, que
 * `report/contraste-texto.js`.
 *
 * @param {*} fecha
 * @param {string} quien
 * @returns {Date}
 * @throws {TypeError}  Si no es una fecha.
 * @throws {RangeError}  Si es una fecha inválida (tiempo no finito).
 */
function exigirFecha(fecha, quien) {
  if (!(fecha instanceof Date)) {
    throw new TypeError(
      `${quien}: 'fecha' debe ser una fecha; recibido ${describir(fecha)}. Este módulo no ` +
        'consulta el reloj: la fecha entra por parámetro.',
    )
  }
  if (!Number.isFinite(fecha.getTime())) {
    throw new RangeError(`${quien}: 'fecha' es inválida (tiempo no finito).`)
  }
  return fecha
}

const dos = (n) => String(n).padStart(2, '0')

/**
 * Fecha → `dd/mm/aaaa hh:mm (UTC)`, **por componentes UTC**.
 *
 * Ni se consulta el reloj ni se usa un formateador dependiente del entorno: el
 * mismo instante tiene que producir el mismo texto en CI y en el equipo de quien
 * firma (mismo razonamiento, y mismos componentes, que
 * `gml/_comun.js#dateTimeCatastro` y `report/contraste-texto.js`). Lleva el
 * `(UTC)` escrito porque una hora sin zona, en un documento con pretensión de
 * constancia, es una hora que no significa nada.
 *
 * @param {Date} fecha
 * @returns {string}
 * @throws {TypeError|RangeError}
 */
export function textoFecha(fecha) {
  exigirFecha(fecha, 'textoFecha')
  return (
    `${dos(fecha.getUTCDate())}/${dos(fecha.getUTCMonth() + 1)}/${fecha.getUTCFullYear()} ` +
    `${dos(fecha.getUTCHours())}:${dos(fecha.getUTCMinutes())} (UTC)`
  )
}

// ── La firma ─────────────────────────────────────────────────────────────────

/**
 * El pie de firma normalizado (contrato D).
 *
 * @typedef {Object} Firma
 * @property {string|null} nombre  Nombre y apellidos de quien firma.
 * @property {string|null} numeroColegiado  Tal cual lo escribe, ceros incluidos.
 * @property {string|null} colegio  **Texto libre.** No hay lista cerrada, y no la
 *   habrá: cerrarla sería tomar partido en una disputa de atribución (§5.2).
 * @property {string|null} contacto  Teléfono, correo, lo que quiera poner.
 */

/**
 * Normaliza un pie de firma: recorta, colapsa espacios, convierte `''` en `null`
 * y devuelve **siempre los cuatro campos**, en el orden de {@link CAMPOS_FIRMA}.
 *
 * **No lanza porque falte un dato.** Un informe sin número de colegiado, sin
 * colegio o sin contacto es un informe legítimo, y este módulo no es quien para
 * exigirlos. Lanza ante un TIPO imposible o una clave desconocida, que es
 * contrato roto por el programador.
 *
 * El objeto devuelto es NUEVO y mutable en cada llamada: quien lo reciba lo va a
 * enchufar a un formulario. La entrada no se toca.
 *
 * @param {Partial<Firma>|null} [entrada=null]  `null`/`undefined` ⇒ firma vacía,
 *   que es el caso del primer arranque y no un error.
 * @returns {Firma}
 * @throws {TypeError}  Si `entrada` no es un objeto ni nulo, si algún campo no es
 *   cadena ni nulo, o si trae claves que no están en el contrato.
 */
export function normalizarFirma(entrada = null) {
  if (entrada === null || entrada === undefined) return { ...FIRMA_VACIA }
  if (!esObjeto(entrada)) {
    throw new TypeError(
      `normalizarFirma: se espera un objeto {${CAMPOS_FIRMA.join(', ')}} o null; ` +
        `recibido ${describir(entrada)}.`,
    )
  }
  exigirClavesConocidas(entrada, CAMPOS_FIRMA, 'normalizarFirma')

  const firma = {}
  for (const campo of CAMPOS_FIRMA) {
    firma[campo] = exigirTextoONulo(entrada[campo], campo, 'normalizarFirma')
  }
  return firma
}

/**
 * ¿Hay ALGO que firmar? `true` si al menos uno de los cuatro campos consta.
 *
 * Existe para el diálogo de T4.1: la casilla «Recordar» no tiene nada que
 * recordar de una firma entera en blanco, y el módulo de persistencia no debe
 * ser quien decida eso por su cuenta (guardar o no guardar es de quien tiene la
 * casilla delante).
 *
 * **No cambia lo que se imprime**: una firma vacía se imprime igual, con sus
 * cuatro «No consta». El hueco mudo no es una opción ni aunque no haya nada.
 *
 * @param {Partial<Firma>|null} [firma=null]
 * @returns {boolean}
 * @throws {TypeError}  Lo que lance {@link normalizarFirma}.
 */
export function hayAlgunDato(firma = null) {
  const normal = normalizarFirma(firma)
  return CAMPOS_FIRMA.some((campo) => normal[campo] !== null)
}

// ── El encabezado ────────────────────────────────────────────────────────────

/**
 * El encabezado normalizado (contrato D). **Las once claves siempre presentes**,
 * en el orden de {@link CAMPOS_ENCABEZADO}. Que estén todas no quiere decir que
 * se impriman todas: eso lo decide {@link lineasEncabezado} con la `clase`.
 *
 * @typedef {Object} Encabezado
 * @property {string|null} municipio  Del contrato E. Llega en mayúsculas y sin
 *   acentos, tal como lo emite el servicio: no se «arregla» (regla de oro 8).
 * @property {string|null} provincia  Íd.
 * @property {'URBANA'|'RUSTICA'|null} clase  Íd. `null` es «no se ha podido
 *   determinar», y se respeta: no se adivina.
 * @property {string|null} domicilio  Íd. La vía y el número, que es el
 *   identificador de una finca urbana. En la rama `lrcdnp` del servicio no viene
 *   —medido—, y entonces es `null`, que es una ausencia de verdad.
 * @property {string|null} paraje  Íd. **Solo en rústica**; en urbana es `null`
 *   porque ese dato no existe para ella, no porque falte.
 * @property {string|null} poligono  Íd. Solo en rústica.
 * @property {string|null} parcela  Íd. Solo en rústica. Es el número de parcela
 *   dentro del polígono, **no** la referencia catastral.
 * @property {string|null} refcat  La referencia catastral, tal cual la lleva el
 *   expediente.
 * @property {string|null} srs  `EPSG:25830` y compañía.
 * @property {Date} fecha  El instante que se estampa. INYECTADO.
 * @property {string} idDocumento  Nunca `null`: o el del expediente, o el
 *   compuesto (ver la cabecera).
 */

/**
 * De dónde salen —o no salen— los descriptivos del Catastro. Es lo que permite
 * distinguir los sabores 2 y 3 al imprimir, sin meter una clave de más en el
 * contrato D, que está congelado.
 *
 * @typedef {Object} ProcedenciaDescriptivos
 * @property {boolean} consultado  `false` ⇒ nadie preguntó al servicio.
 * @property {boolean} ok  `true` solo si se preguntó y contestó con datos.
 * @property {string|null} motivo  Clave de `MOTIVO_CATASTRO`, cuando la hay.
 * @property {string|null} mensaje  Español presentable tal cual, de `services/`.
 */

/**
 * Lee el sobre del contrato E y dice **qué pasó con la consulta**, que no es lo
 * mismo que qué datos trajo.
 *
 * ```js
 * { ok, motivo, mensaje, procedencia,
 *   datos: { municipio, provincia, paraje, poligono, parcela, domicilio, clase } }
 * ```
 *
 * Se programa contra el CONTRATO y no contra `services/_catastro-dnp.js`: los
 * dos se escriben en paralelo, y el contrato es lo que los dos firmaron.
 *
 * @param {object|null} [descriptivos=null]  El sobre, o `null` si no se consultó.
 * @returns {ProcedenciaDescriptivos}
 * @throws {TypeError}  Si es un objeto pero no tiene la forma del sobre.
 */
export function procedenciaDescriptivos(descriptivos = null) {
  if (descriptivos === null || descriptivos === undefined) {
    return { consultado: false, ok: false, motivo: null, mensaje: null }
  }
  if (!esObjeto(descriptivos)) {
    throw new TypeError(
      `procedenciaDescriptivos: 'descriptivos' debe ser el resultado del servicio ` +
        `({ok, motivo, mensaje, procedencia, datos}) o null si no se ha consultado; ` +
        `recibido ${describir(descriptivos)}.`,
    )
  }
  if (!('datos' in descriptivos)) {
    throw new TypeError(
      `procedenciaDescriptivos: 'descriptivos' no tiene la clave 'datos', así que no es el ` +
        'sobre del servicio descriptivo (contrato E). Si lo que tienes son los datos sueltos, ' +
        'pásalos como {datos}; si no se ha consultado, pasa null — que NO es lo mismo que un ' +
        'sobre vacío, y el informe lo escribe distinto.',
    )
  }
  const datos = descriptivos.datos
  if (datos !== null && datos !== undefined && !esObjeto(datos)) {
    throw new TypeError(
      `procedenciaDescriptivos: 'descriptivos.datos' debe ser un objeto o null; ` +
        `recibido ${describir(datos)}.`,
    )
  }
  // `ok` se deriva de si HAY datos y no de la bandera a solas: un sobre con
  // `ok: true` y `datos: null` sería incoherente, y entre creerle a la bandera o
  // creerle al dato, se le cree al dato.
  const ok = esObjeto(datos)
  return {
    consultado: true,
    ok,
    motivo: ok ? null : exigirTextoONulo(descriptivos.motivo, 'motivo', 'procedenciaDescriptivos'),
    mensaje: ok ? null : exigirTextoONulo(descriptivos.mensaje, 'mensaje', 'procedenciaDescriptivos'),
  }
}

/** Las claves que {@link componerEncabezado} admite en su argumento. */
const ARGUMENTOS_ENCABEZADO = Object.freeze([
  'descriptivos',
  'refcat',
  'srs',
  'fecha',
  'idDocumento',
])

/**
 * Compone el encabezado del informe (contrato D) a partir de los descriptivos
 * del contrato E y de lo que ya sabe el expediente.
 *
 * ```js
 * const encabezado = componerEncabezado({
 *   descriptivos,               // el sobre de services/, o null si no se consultó
 *   refcat: parcela.refcat,
 *   srs: expediente.srs,
 *   fecha,                      // INYECTADA: aquí no se lee el reloj
 *   idDocumento: expediente.metadatos.idDocumento,   // '' ⇒ se compone
 * })
 * ```
 *
 * **Los siete descriptivos se copian del servicio y no se completan de ningún
 * otro sitio.** Si el servicio no trae paraje, el encabezado no trae paraje: la
 * alternativa —deducirlo, arrastrarlo de otra consulta, dejarlo de la anterior—
 * es cómo se acaba imprimiendo el paraje de otra finca. El `domicilio` es el
 * ejemplo vivo: en la rama `lrcdnp` no viene, y **no se compone** desde las
 * piezas de la dirección (esa es la decisión C de `services/_catastro-dnp.js`);
 * si alguien lo trae por otra vía —`refcatPorCoordenada().datos.candidatos[i]`—
 * se acepta aquí dentro, pero este módulo no va a buscarlo.
 *
 * @param {object} [entrada]
 * @param {object|null} [entrada.descriptivos=null]  Sobre del contrato E. `null`
 *   significa **no se ha consultado**, que se imprime distinto de «no consta».
 * @param {string|null} [entrada.refcat=null]
 * @param {string|null} [entrada.srs=null]
 * @param {Date} entrada.fecha  Obligatoria y por parámetro.
 * @param {string|null} [entrada.idDocumento=null]  El de
 *   `Expediente.metadatos.idDocumento`. `null` o `''` ⇒ se compone con
 *   {@link componerIdDocumento} (ver la cabecera: es la única excepción a la
 *   regla del «No consta»).
 * @returns {Encabezado}
 * @throws {TypeError}  Entrada que no es objeto, clave desconocida, tipo
 *   imposible, sobre sin `datos` o `fecha` que no es una fecha.
 * @throws {RangeError}  `fecha` inválida.
 */
export function componerEncabezado(entrada = {}) {
  if (!esObjeto(entrada)) {
    throw new TypeError(
      `componerEncabezado: se espera un objeto {${ARGUMENTOS_ENCABEZADO.join(', ')}}; ` +
        `recibido ${describir(entrada)}.`,
    )
  }
  exigirClavesConocidas(entrada, ARGUMENTOS_ENCABEZADO, 'componerEncabezado')

  const {
    descriptivos = null,
    refcat = null,
    srs = null,
    fecha,
    idDocumento = null,
  } = entrada

  exigirFecha(fecha, 'componerEncabezado')
  // Se valida el sobre aunque aquí solo se usen los datos: un sobre mal formado
  // tiene que reventar en el sitio donde se pasa, no producir cinco «No consta»
  // que nadie relacionaría con la causa.
  procedenciaDescriptivos(descriptivos)
  const datos = esObjeto(descriptivos?.datos) ? descriptivos.datos : null

  const refcatLimpia = exigirTextoONulo(refcat, 'refcat', 'componerEncabezado')
  const idDado = exigirTextoONulo(idDocumento, 'idDocumento', 'componerEncabezado')

  const encabezado = {}
  for (const campo of CAMPOS_DEL_SERVICIO) {
    encabezado[campo] =
      campo === 'clase'
        ? exigirClase(datos?.clase, 'componerEncabezado')
        : exigirTextoONulo(datos?.[campo], campo, 'componerEncabezado')
  }
  encabezado.refcat = refcatLimpia
  encabezado.srs = exigirTextoONulo(srs, 'srs', 'componerEncabezado')
  encabezado.fecha = fecha
  encabezado.idDocumento = idDado ?? componerIdDocumento(refcatLimpia, fecha)
  return encabezado
}

/**
 * Compone el identificador del documento: **`CG-<refcat>-<AAAAMMDD>-<hhmmss>Z`**.
 *
 * ```js
 * componerIdDocumento('9398516VK3799G', fecha)  // 'CG-9398516VK3799G-20260802-170453Z'
 * componerIdDocumento(null, fecha)              // 'CG-SINREF-20260802-170453Z'
 * ```
 *
 * **Función PURA: la fecha se inyecta.** El módulo no consulta la marca de
 * tiempo del sistema (ver la cabecera y el guardián por grep de su test), así
 * que el mismo instante produce siempre el mismo identificador y el informe de
 * prueba se puede afirmar carácter a carácter.
 *
 * La referencia catastral se canonicaliza —mayúsculas, solo letras y dígitos—
 * porque el identificador tiene que tener una forma fija que se pueda reconocer
 * ({@link esIdDocumento}) y buscar en un listado; un espacio o un guion pegado al
 * teclearla la rompería. **En el ENCABEZADO, en cambio, la referencia se imprime
 * tal como viene**: allí es un dato, no una matrícula.
 *
 * Fecha y hora son **UTC**, y la `Z` final lo dice (ISO 8601). Ver la cabecera.
 *
 * @param {string|null} refcat  La referencia catastral, o `null`.
 * @param {Date} fecha  Instante de emisión. INYECTADO.
 * @returns {string}
 * @throws {TypeError}  `refcat` que no es cadena ni nulo, o `fecha` que no es
 *   una fecha.
 * @throws {RangeError}  `fecha` inválida.
 */
export function componerIdDocumento(refcat, fecha) {
  const limpia = exigirTextoONulo(refcat, 'refcat', 'componerIdDocumento')
  exigirFecha(fecha, 'componerIdDocumento')

  const canonica = limpia === null ? '' : limpia.toUpperCase().replace(/[^A-Z0-9]/g, '')
  const parteRefcat = canonica === '' ? SIN_REFCAT : canonica

  const dia =
    `${fecha.getUTCFullYear()}${dos(fecha.getUTCMonth() + 1)}${dos(fecha.getUTCDate())}`
  const hora =
    `${dos(fecha.getUTCHours())}${dos(fecha.getUTCMinutes())}${dos(fecha.getUTCSeconds())}`

  return `${PREFIJO_ID_DOCUMENTO}-${parteRefcat}-${dia}-${hora}Z`
}

/**
 * ¿Tiene esto la forma de un identificador emitido por esta herramienta?
 *
 * Se exporta para que quien reciba un identificador pueda comprobarlo sin
 * reescribir la expresión regular en otro fichero — que es como acaban
 * existiendo dos formas del mismo identificador.
 *
 * ⚠️ Dice **forma**, no procedencia: no hay firma criptográfica ni código seguro
 * de verificación. El CSV lo emite la Sede Electrónica del Catastro y este
 * identificador **no es aquello**.
 *
 * @param {*} valor
 * @returns {boolean}
 */
export function esIdDocumento(valor) {
  return typeof valor === 'string' && FORMA_ID_DOCUMENTO.test(valor)
}

// ── Qué se imprime ───────────────────────────────────────────────────────────

/**
 * Una línea lista para maquetar. `valor` es **siempre una cadena no vacía**: es
 * lo que hace estructuralmente imposible el hueco mudo. Quien maqueta no tiene
 * que decidir nada ni comprobar nada.
 *
 * @typedef {Object} LineaImpresa
 * @property {string} campo  La clave del contrato, por si hay que estilar una.
 * @property {string} etiqueta  El rótulo neutro.
 * @property {string} valor  El dato, o el sustituto que corresponda.
 * @property {boolean} consta  `true` si `valor` ES el dato. `false` si es uno de
 *   los tres sustitutos. **No es un juicio de valor** (regla de oro 9): dice si
 *   hay dato, no si el dato es bueno.
 * @property {string|null} detalle  El mensaje del servicio, cuando el sustituto
 *   es «No se ha podido consultar». Llega redactado de `services/` y se copia
 *   literal.
 */

/**
 * Lo que se imprime en el sitio de un valor que puede faltar. **La regla dura del
 * contrato D, en una función**: `null` y `''` se imprimen «No consta», nunca en
 * blanco.
 *
 * @param {string|null} valor
 * @returns {string}
 */
export function paraImprimir(valor) {
  if (typeof valor !== 'string') return NO_CONSTA
  const limpio = limpiar(valor)
  return limpio === null ? NO_CONSTA : limpio
}

/**
 * Las cuatro líneas del pie de firma, en orden.
 *
 * **Salen las cuatro siempre**, aunque no haya ni un dato. Una línea que
 * desaparece se lee como «este documento no necesitaba ese dato», y lo que pasa
 * es que falta. Es el mismo criterio con el que `report/contraste-texto.js` emite
 * los tres pares de la comparación a tres bandas aunque falte con qué calcularlos.
 *
 * @param {Partial<Firma>|null} [firma=null]
 * @returns {LineaImpresa[]}
 * @throws {TypeError}  Lo que lance {@link normalizarFirma}.
 */
export function lineasFirma(firma = null) {
  const normal = normalizarFirma(firma)
  return CAMPOS_FIRMA.map((campo) => ({
    campo,
    etiqueta: ROTULO_FIRMA[campo],
    valor: paraImprimir(normal[campo]),
    consta: normal[campo] !== null,
    // Un campo de firma no se «consulta» en ningún sitio: o lo escribe quien
    // firma, o no está. No hay tercer sabor que detallar.
    detalle: null,
  }))
}

/**
 * La clase de finca de un encabezado, canonicalizada, o `null` si no la trae o no
 * se entiende.
 *
 * Es TOLERANTE a propósito, al revés que {@link exigirClase}: aquí ya no se está
 * recibiendo un dato del programador, se está imprimiendo lo que haya. Un
 * encabezado sin `clase` —los había antes de que existiera el campo— vale, y se
 * imprime como se imprimía.
 *
 * @param {object} encabezado
 * @returns {'URBANA'|'RUSTICA'|null}
 */
function claseDe(encabezado) {
  if (typeof encabezado.clase !== 'string') return null
  const limpia = limpiar(encabezado.clase)
  if (limpia === null) return null
  const canonica = limpia.toUpperCase()
  return CLASES_ADMITIDAS.includes(canonica) ? canonica : null
}

/**
 * ¿Esta fila **no aplica a esta finca**, y por tanto no se imprime?
 *
 * Solo dice que sí de los tres campos de {@link CAMPOS_SOLO_RUSTICA}, solo en una
 * urbana, y solo **cuando no hay dato**. Esa última condición es la invariante que
 * hace que esta función no pueda perder nada: si el dato está, se imprime, pase lo
 * que pase con la clasificación (ver la cabecera).
 *
 * @param {string} campo
 * @param {'URBANA'|'RUSTICA'|null} clase
 * @param {object} encabezado
 * @returns {boolean}
 */
function noAplica(campo, clase, encabezado) {
  if (clase !== CLASE_URBANA) return false
  if (!CAMPOS_SOLO_RUSTICA.includes(campo)) return false
  const bruto = encabezado[campo]
  return typeof bruto !== 'string' || limpiar(bruto) === null
}

/**
 * Las líneas del encabezado, en orden, **con los tres sabores de «no hay»
 * escritos distinto** y **sin las filas que no aplican a esta finca** (ver la
 * cabecera, que es donde se razonan las dos cosas).
 *
 * No son siempre las mismas líneas, y ese es justo el arreglo: en una finca
 * **urbana** no salen `paraje`, `poligono` ni `parcela` —no le faltan, es que no
 * existen para ella—, y su sitio lo ocupan `clase` y `domicilio`, que sí la
 * identifican. En una rústica salen las once. Quien maquete tiene que recorrer lo
 * que devuelve esta función y no dar por hecho un número de filas.
 *
 * La `procedencia` es la que devuelve {@link procedenciaDescriptivos} y solo
 * afecta a los campos de {@link CAMPOS_DEL_SERVICIO}: `refcat`, `srs`, `fecha` e
 * `idDocumento` los pone la aplicación, así que su ausencia nunca es «no se ha
 * consultado».
 *
 * @param {Encabezado} encabezado  El de {@link componerEncabezado}.
 * @param {object} [opciones]
 * @param {ProcedenciaDescriptivos|object|null} [opciones.procedencia=null]  La de
 *   {@link procedenciaDescriptivos}, o el sobre del contrato E tal cual (se
 *   traduce solo), o `null` ⇒ **no se consultó**.
 * @returns {LineaImpresa[]}
 * @throws {TypeError}  Encabezado que no es objeto, o al que le faltan campos.
 */
export function lineasEncabezado(encabezado, { procedencia = null } = {}) {
  if (!esObjeto(encabezado)) {
    throw new TypeError(
      `lineasEncabezado: 'encabezado' debe ser el objeto de componerEncabezado; ` +
        `recibido ${describir(encabezado)}.`,
    )
  }
  const faltan = CAMPOS_ENCABEZADO_EXIGIDOS.filter((campo) => !(campo in encabezado))
  if (faltan.length > 0) {
    throw new TypeError(
      `lineasEncabezado: al encabezado le faltan campos (${faltan.join(', ')}). Las claves del ` +
        'contrato D están siempre presentes: componlo con componerEncabezado en vez de a mano, ' +
        'o quien imprima se encontrará huecos que no sabrá explicar.',
    )
  }

  // Se admite tanto la procedencia ya traducida como el sobre del servicio: el
  // llamante suele tener a mano el segundo, y obligarle a traducirlo es la clase
  // de paso que se olvida y deja los cinco campos con el sabor equivocado.
  const p =
    procedencia !== null && esObjeto(procedencia) && typeof procedencia.consultado === 'boolean'
      ? procedencia
      : procedenciaDescriptivos(procedencia)

  // Qué filas aplican a ESTA finca. Se decide antes de recorrer, porque es una
  // propiedad del encabezado entero y no de cada campo por su cuenta.
  const clase = claseDe(encabezado)

  return CAMPOS_ENCABEZADO.filter((campo) => !noAplica(campo, clase, encabezado)).map((campo) => {
    const etiqueta = ROTULO_ENCABEZADO[campo]

    if (campo === 'fecha') {
      return { campo, etiqueta, valor: textoFecha(encabezado.fecha), consta: true, detalle: null }
    }

    const bruto = encabezado[campo]
    const valor = typeof bruto === 'string' ? limpiar(bruto) : null
    if (valor !== null) {
      return { campo, etiqueta, valor, consta: true, detalle: null }
    }

    // No hay dato: cuál de los tres sabores es.
    if (!CAMPOS_DEL_SERVICIO.includes(campo)) {
      return { campo, etiqueta, valor: NO_CONSTA, consta: false, detalle: null }
    }
    if (!p.consultado) {
      return { campo, etiqueta, valor: NO_CONSULTADO, consta: false, detalle: null }
    }
    if (!p.ok) {
      return {
        campo,
        etiqueta,
        valor: NO_SE_HA_PODIDO_CONSULTAR,
        consta: false,
        detalle: p.mensaje,
      }
    }
    return { campo, etiqueta, valor: NO_CONSTA, consta: false, detalle: null }
  })
}

// storage/expedientes.js — F10 · T2.1. LOS EXPEDIENTES GUARDADOS.
//
// Hasta aquí esta aplicación no recordaba nada: recargar la pestaña tiraba el
// trabajo entero. Este módulo es el que lo arregla, y es también el que estrena en
// producción `model/parcela.js#crearExpediente`, que llevaba desde F00 sin un solo
// llamante fuera de los tests.
//
// ── QUÉ SE GUARDA, DÓNDE Y CÓMO SE BORRA ────────────────────────────────────
// Se escribe aquí, en la cabecera y no en un documento aparte, por lo mismo que en
// `storage/pie-firma.js`: es lo primero que hay que poder responder cuando alguien
// pregunte. Y aquí pesa más que allí — aquello eran cuatro campos de una persona;
// esto es **la geometría de fincas concretas y sus referencias catastrales**.
//
// **QUÉ.** Un registro por expediente, con exactamente {@link CAMPOS_REGISTRO}:
// el identificador, un rótulo que el usuario puede cambiar, la referencia catastral
// (o `null`), cuándo se creó y cuándo se tocó por última vez, el sistema de
// referencia, y el Expediente del modelo — que es la parcela y nada más.
//
// **Lo que NO se guarda**, y cada cosa por su motivo escrito:
//   · el **historial de deshacer**: `edit/historial.js` declara en su cabecera que
//     no forma parte del modelo serializable. Recuperar un expediente empieza una
//     sesión de edición nueva, no continúa la de ayer;
//   · las **parcelas colindantes**: son caché del Catastro (F05) y se vuelven a
//     pedir. Guardarlas duplicaría el dato y lo dejaría envejecer aquí sin TTL;
//   · el **diagnóstico** y el **informe**: se recalculan desde la geometría, y
//     guardar una medición vieja junto a una geometría nueva es la clase de
//     incoherencia que esta aplicación existe para no producir;
//   · el **pie de firma**: tiene su propio almacén y su propia política de borrado.
// La interfaz **enumera** esta lista (regla de oro 1): quien guarda tiene derecho a
// saber qué NO se está guardando, y a enterarse antes y no al recuperar.
//
// **DÓNDE.** En IndexedDB, en este navegador y en este equipo, dentro de la base
// `concreta-gml` (`storage/bd.js`), almacén `ALMACENES.EXPEDIENTES`. **No se envía
// a ningún servidor**: esta aplicación no tiene ninguno.
//
// **CÓMO SE BORRA.** `borrar(id)` uno a uno; `descartarBorrador()` el trabajo en
// curso; borrar los datos del sitio desde el navegador (se lleva la base entera); o
// `indexedDB.deleteDatabase(NOMBRE_BD)`.
//
// ⚠️ **Y una advertencia que la interfaz tiene que repetir**: el navegador **no
// garantiza** conservar esto. `navigator.storage.persist()` devuelve `false` en un
// sitio que no esté instalado ni marcado como favorito —medido el 2026-08-03, ver
// `storage/cuota.js`—, así que un desalojo por espacio se lo puede llevar. Para
// llevarse un trabajo con seguridad hay que **exportarlo a un fichero**.
//
// ── EL BORRADOR ES UN REGISTRO MÁS, CON CLAVE RESERVADA ─────────────────────
// El autoguardado no escribe en un almacén aparte: escribe en ESTE, con una clave
// fija, así que cada disparo del debounce PISA al anterior y no se acumula un
// historial que nadie ha pedido. Es el mismo diseño de registro único que
// `storage/pie-firma.js`. {@link crearExpedientes}`.listar()` los excluye: el
// trabajo en curso no es un expediente guardado, y mezclarlos haría que la lista
// creciera sola mientras el usuario dibuja.
//
// ⛔ **F12 · T4.3 · LA CLAVE ES UNA POR RAMA, y no por gusto.** Hasta aquí era UNA
// sola ({@link ID_BORRADOR}) porque solo autoguardaba la rama de parcela. F12 le
// da identidad al `Edificio` y suscribe el autoguardado a su store, y con una
// clave compartida eso tendría un desenlace exacto y silencioso: **el borrador de
// edificio pisaría al de parcela y al revés**, dos segundos después de conmutar,
// sin que nada fallara. Lo dejó escrito la desviación 7 del plan de F11 —«el
// autoguardado no se extiende: el borrador es un registro único de clave
// reservada»—, y esto es lo que la levanta.
//
// El reparto está en {@link ID_BORRADOR_POR_TIPO} y lo enruta **el `tipo` del
// propio Expediente**: {@link crearExpedientes}`.guardarBorrador` no recibe la
// clave por parámetro, la deriva de lo que le dan. Un parámetro más sería un
// parámetro que se puede pasar equivocado, y equivocarlo aquí es exactamente el
// fallo que este reparto viene a impedir.
//
// ⚠️ **Y el valor de la clave de parcela NO cambia.** Estrenar un nombre nuevo
// habría dejado huérfano el borrador de quien cerrara la pestaña ayer: seguiría en
// la base, invisible para la lista y para la oferta, ocupando espacio y sin nadie
// que lo pudiera recuperar. La clave vieja es la de parcela, y la nueva es la de
// la rama nueva.
//
// ── POR QUÉ LA LECTURA PASA SIEMPRE POR `crearExpediente` ───────────────────
// **Medido en la fase 0, no deducido:** IndexedDB guarda y devuelve con el algoritmo
// de clonado estructurado, y `structuredClone` **no preserva `Object.freeze`**. Un
// expediente leído de la base vuelve con `geometriaOficial` DESCONGELADA, y la
// barrera de la regla de oro 2 —la geometría oficial se conserva intacta— habría
// desaparecido en silencio, en el peor sitio posible: justo antes de un diagnóstico
// que la usa como término de comparación. `model/parcela.js:301-308` ya avisaba de
// esto para la rama de edificio; aquí es la ruta normal.
//
// Por eso {@link crearExpedientes}`.recuperar()` **no devuelve el registro crudo**:
// lo pasa por `crearExpediente`, que revalida, recopia y vuelve a congelar. De paso,
// un registro corrupto —escrito por una versión futura, o a medio escribir— se
// detecta ahí y sale como `REGISTRO_ILEGIBLE` en vez de entrar al modelo.
//
// ── NO SALE POR EL BARREL RAÍZ ──────────────────────────────────────────────
// `storage/` entero está fuera de `index.js` por decisión de capas (es un adaptador
// de entorno, no dominio). Ojo: importarlo **no rompería la suite** —`indexedDB` se
// lee al llamar, no al cargar—, así que el único que lo impide es el guardián de
// `test/contrato.test.js`.

import { TIPO_EXPEDIENTE, crearExpediente } from '../model/parcela.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'
import { ALMACENES, ESQUEMA_ALMACENES } from './bd.js'
// `esCuotaExcedida` es PURA: no toca `navigator.storage` ni nada del entorno, así
// que importarla no ata este módulo a la API de cuota. Y se importa en vez de
// repetir aquí la comprobación de `name`/`code` porque dos sitios decidiendo por su
// cuenta qué es «se acabó el espacio» acabarían discrepando en el que nadie mire.
import { esCuotaExcedida } from './cuota.js'

// ── Identidad de los registros ───────────────────────────────────────────────

/**
 * La clave reservada del borrador del autoguardado **de la rama PARCELA**. Se
 * exporta para que el guion de humo y una herramienta de diagnóstico puedan mirarlo
 * sin adivinar cómo se llama.
 *
 * Empieza por letra, como todo identificador de este proyecto (regla de oro 10 en
 * espíritu), y lleva un prefijo que lo distingue a simple vista de un expediente
 * guardado cuando alguien abra el inspector del navegador.
 *
 * ⚠️ **Su valor no se toca nunca.** Ver el apartado del borrador en la cabecera:
 * renombrarla dejaría huérfano el trabajo de quien cerrara la pestaña con la
 * versión anterior. El nombre sigue sin decir «parcela» por eso mismo — es un
 * literal ya escrito en bases de datos reales, no un rótulo que se pueda mejorar.
 *
 * @readonly
 */
export const ID_BORRADOR = 'EXP-borrador-en-curso'

/**
 * La clave reservada del borrador **de la rama EDIFICIO** (F12 · T4.3). Estrena
 * nombre porque estrena rama: aquí no hay nada anterior que huerfanar.
 *
 * @readonly
 */
export const ID_BORRADOR_EDIFICIO = 'EXP-borrador-edificio-en-curso'

/**
 * Qué clave le toca a cada rama. **Es el índice por el que enruta todo el módulo**:
 * ningún sitio de aquí abajo vuelve a nombrar una de las dos claves a pelo, para que
 * añadir una tercera rama algún día sea añadir una entrada y no buscar literales.
 *
 * Las claves del mapa son las de `TIPO_EXPEDIENTE` (`model/parcela.js`), que es el
 * mismo vocabulario con el que el Expediente se declara a sí mismo. No hay un
 * segundo enumerado paralelo: dos vocabularios para lo mismo acaban discrepando en
 * el que nadie mire.
 *
 * @readonly
 * @type {Readonly<Record<string, string>>}
 */
export const ID_BORRADOR_POR_TIPO = Object.freeze({
  [TIPO_EXPEDIENTE.PARCELA]: ID_BORRADOR,
  [TIPO_EXPEDIENTE.EDIFICIO]: ID_BORRADOR_EDIFICIO,
})

/** Las dos claves reservadas, para excluirlas del listado de una sola pasada. */
const CLAVES_BORRADOR = Object.freeze(Object.values(ID_BORRADOR_POR_TIPO))

/**
 * A qué clave escribe (o de cuál lee) el borrador de este tipo de expediente.
 *
 * **LANZA con un tipo desconocido**, y es lo correcto: el tipo no lo teclea nadie,
 * sale de `TIPO_EXPEDIENTE` o del Expediente que ya ha pasado por el modelo. Un
 * defecto por defecto —«si no lo conozco, parcela»— escribiría el edificio encima
 * del borrador de la parcela, que es justo lo que este reparto existe para impedir.
 *
 * @param {string} tipo  Uno de `TIPO_EXPEDIENTE`.
 * @param {string} fn  Nombre de quien pregunta, para el mensaje.
 * @returns {string}
 * @throws {RangeError}
 */
function claveBorrador(tipo, fn) {
  const clave = ID_BORRADOR_POR_TIPO[tipo]
  if (clave === undefined) {
    throw new RangeError(
      `${fn}: 'tipo' de expediente desconocido: ${JSON.stringify(tipo)}. ` +
        `Válidos: ${Object.keys(ID_BORRADOR_POR_TIPO).join(', ')}.`,
    )
  }
  return clave
}

/** El campo en el que la base espera la clave. **Derivado**, nunca escrito. */
const CAMPO_CLAVE = ESQUEMA_ALMACENES[ALMACENES.EXPEDIENTES].keyPath

/** Los índices que este módulo puede usar. **Derivados** del esquema, no escritos. */
const INDICE = Object.freeze({
  ACTUALIZADO: 'actualizado',
  REFCAT: 'refcat',
})

/**
 * Las claves que puede tener un registro, y ninguna más.
 *
 * Existe para que el test pueda afirmar **qué NO se guarda** comparando conjuntos,
 * en vez de leer esta cabecera y confiar: un registro con una clave de más —el
 * diagnóstico, las colindantes, el historial— pone la prueba en rojo.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CAMPOS_REGISTRO = Object.freeze([
  CAMPO_CLAVE,
  'nombre',
  'refcat',
  'creado',
  'actualizado',
  'srs',
  'expediente',
])

/**
 * Lo que la interfaz tiene que enseñar junto a «Guardar»: lo que este módulo **no**
 * guarda. Vive aquí —y no en el diálogo— porque describe lo que hace ESTE código, y
 * una lista escrita lejos del código que la cumple se queda desfasada sin que nadie
 * lo note. Mismo criterio que `AVISO_PRIVACIDAD` en `storage/pie-firma.js`.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const NO_SE_GUARDA = Object.freeze([
  'El historial de deshacer y rehacer: al recuperar se empieza una sesión de edición nueva.',
  'Las parcelas colindantes: se vuelven a pedir al Catastro cuando hagan falta.',
  'El diagnóstico de encaje y el informe: se recalculan desde la geometría.',
  'El pie de firma, que se recuerda aparte y se borra aparte.',
])

/**
 * Lo que la interfaz tiene que decir sobre la durabilidad. **No es alarmismo: es lo
 * medido** (`storage/cuota.js`).
 *
 * @readonly
 */
export const AVISO_DURABILIDAD =
  'Esto se guarda en este navegador y en este equipo, no en ningún servidor. El navegador ' +
  'puede borrarlo si se queda sin espacio, y borrar los datos del sitio se lo lleva todo. ' +
  'Para conservar un trabajo con seguridad, expórtalo a un fichero de proyecto.'

// ── Degradación ──────────────────────────────────────────────────────────────

/**
 * Por qué una operación no ha podido ser. Códigos estables, para que la interfaz
 * decida sin leerle el texto al `mensaje` (mismo criterio que `MOTIVO_SIN_PIE`).
 *
 * @readonly
 */
export const MOTIVO_EXPEDIENTES = Object.freeze({
  /** No hay almacén local utilizable. Node, ventana privada, datos bloqueados. */
  SIN_BD: 'SIN_BD',
  /**
   * No hay ningún registro con ese identificador. **No es un fallo**: es un
   * expediente ya borrado, o un enlace viejo. Lleva `mensaje` igualmente.
   */
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  /** La lectura reventó en IndexedDB. */
  ERROR_LECTURA: 'ERROR_LECTURA',
  /** La escritura reventó. Si fue por espacio, `esCuota` lo dice. */
  ERROR_ESCRITURA: 'ERROR_ESCRITURA',
  /** El borrado reventó. El registro **sigue ahí**, y se dice. */
  ERROR_BORRADO: 'ERROR_BORRADO',
  /** Había registro, pero no se pudo leer como un Expediente del modelo. */
  REGISTRO_ILEGIBLE: 'REGISTRO_ILEGIBLE',
})

// ── Utilidades ───────────────────────────────────────────────────────────────

/** Texto corto de un fallo. Misma forma que el resto de `storage/`. */
function detalleDe(error) {
  return error && error.name ? `${error.name}: ${error.message}` : String(error)
}

/**
 * ¿Es esto una base de `idb` utilizable? DUCK TYPING sobre lo que este módulo usa y
 * nada más, por el mismo motivo que los otros módulos de `storage/`: el constructor
 * global no existe en Node y un doble no debería fingir la jerarquía entera. Es
 * además lo que permite envolver la base REAL con un `put` que rechaza, que es como
 * se simula la cuota agotada.
 *
 * @param {*} v
 * @returns {boolean}
 */
function esBase(v) {
  return (
    !!v &&
    typeof v === 'object' &&
    typeof v.get === 'function' &&
    typeof v.put === 'function' &&
    typeof v.delete === 'function' &&
    typeof v.count === 'function' &&
    typeof v.getAllFromIndex === 'function'
  )
}

/**
 * El rótulo por defecto de un expediente recién guardado. La referencia catastral
 * cuando la hay, y si no una frase que **dice que no la hay** en vez de dejar el
 * hueco en blanco (regla de oro 1: «Sin referencia catastral» y «todavía no se ha
 * mirado» no son lo mismo, pero un rótulo vacío no distingue ni eso).
 *
 * ⚠️ **La frase nombra la RAMA** (F12 · T4.3). Antes decía «Parcela sin referencia»
 * siempre, porque solo había una rama; con dos, un edificio sin RC habría entrado en
 * la lista llamándose «Parcela», que es el único dato que el usuario tendría para
 * distinguirlo y estaría diciéndole lo que no es.
 *
 * @param {string|null} refcat
 * @param {string} [tipo=TIPO_EXPEDIENTE.PARCELA]  Uno de `TIPO_EXPEDIENTE`.
 * @returns {string}
 */
function nombrePorDefecto(refcat, tipo = TIPO_EXPEDIENTE.PARCELA) {
  if (typeof refcat === 'string' && refcat.length > 0) return refcat
  return tipo === TIPO_EXPEDIENTE.EDIFICIO ? 'Edificio sin referencia' : 'Parcela sin referencia'
}

/**
 * La referencia catastral de un Expediente, **venga de la rama que venga**. Una sola
 * función porque el registro tiene UN campo `refcat` indexado y las dos ramas lo
 * llenan: mirar solo `parcela` dejaba el de edificio a `null` y su rótulo por defecto
 * en «sin referencia» teniéndola.
 *
 * @param {object} expediente  Ya normalizado por `crearExpediente`.
 * @returns {string|null}
 */
function refcatDe(expediente) {
  return expediente.parcela?.refcat ?? expediente.edificio?.refcat ?? null
}

// ── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * Un registro del almacén. Es lo que `listar()` devuelve por cada expediente, y lo
 * que `recuperar()` acompaña al expediente rehidratado.
 *
 * @typedef {Object} RegistroExpediente
 * @property {string} id  Clave. `EXP-…`, nunca la referencia catastral desnuda.
 * @property {string} nombre  Rótulo del usuario. Nunca vacío.
 * @property {string|null} refcat  Referencia catastral, indexada.
 * @property {string} creado  ISO 8601.
 * @property {string} actualizado  ISO 8601. El orden de la lista.
 * @property {string} srs  Duplicado fuera del expediente a propósito: la lista lo
 *   enseña, y avisar de que un expediente es de otro huso no debería obligar a
 *   rehidratarlo entero primero.
 * @property {object} expediente  El Expediente de `model/parcela.js`.
 */

/**
 * @typedef {Object} ResultadoGuardar
 * @property {boolean} ok
 * @property {RegistroExpediente|null} registro  Lo que quedó escrito, o `null`.
 * @property {string|null} motivo  Clave de {@link MOTIVO_EXPEDIENTES}.
 * @property {string|null} mensaje
 * @property {boolean} esCuota  `true` solo si el fallo fue falta de espacio. Es lo
 *   que la degradación del criterio 4 mira para decidir si merece la pena purgar.
 */

/**
 * @typedef {Object} ResultadoListar
 * @property {boolean} ok
 * @property {RegistroExpediente[]} registros  **Del más reciente al más antiguo.**
 *   Vacío si no hay ninguno o si no se pudo leer: quien pregunta mira `ok`.
 * @property {number} invisibles  Cuántos registros hay en el almacén que el índice
 *   NO devuelve. Debería ser 0 siempre; ver la nota de `listar`.
 * @property {boolean} hayBorrador  Si existe trabajo en curso autoguardado **en
 *   alguna rama**. Se devuelve aquí —y no obligando a una lectura aparte— porque la
 *   lista ya ha tenido los registros en la mano para excluirlos. **Derivado** de
 *   `borradores`, nunca escrito aparte.
 * @property {string[]} borradores  De qué ramas hay trabajo en curso: `TIPO_EXPEDIENTE`
 *   en el orden de {@link ID_BORRADOR_POR_TIPO}. Vacío si no hay ninguno. Es lo que
 *   la oferta del arranque necesita para decir QUÉ ha encontrado (F12 · T4.3).
 * @property {string|null} motivo
 * @property {string|null} mensaje
 */

/**
 * @typedef {Object} ResultadoRecuperar
 * @property {boolean} ok
 * @property {object|null} expediente  **Rehidratado** por `crearExpediente`, con la
 *   geometría oficial vuelta a congelar. `null` si no se pudo.
 * @property {RegistroExpediente|null} registro
 * @property {string|null} motivo
 * @property {string|null} mensaje
 */

// ── La fábrica ───────────────────────────────────────────────────────────────

/**
 * Crea el almacén de expedientes.
 *
 * ```js
 * const exp = crearExpedientes({ bd: abrirBd({ alAvisar }), alAvisar })
 * const { registro } = await exp.guardar(expediente, { nombre: 'Linde norte' })
 * const { registros } = await exp.listar()          // del más reciente al más viejo
 * const { expediente } = await exp.recuperar(registro.id)
 * ```
 *
 * Es una factory (`crearX`), nunca una clase: todo el estado vive en el cierre, así
 * que dos instancias no comparten nada y cada prueba monta la suya.
 *
 * **Ninguna operación lanza por causa del almacenamiento.** Sí lanzan las de
 * contrato roto por el programador: un expediente que `crearExpediente` rechaza, un
 * identificador que no es texto. Es la frontera de siempre — *el entorno degrada, el
 * programador revienta*.
 *
 * @param {object} [opciones]
 * @param {Promise<import('./bd.js').ResultadoApertura>|object|null} [opciones.bd=null]
 *   La base, en cualquiera de las tres formas que admite `storage/pie-firma.js`.
 * @param {() => number} [opciones.ahora=() => Date.now()]  Reloj en milisegundos de
 *   época. Inyectable por el precedente del repo: un test que dependa del reloj del
 *   sistema no puede afirmar la marca que escribe.
 * @param {(() => string)|null} [opciones.nuevoId=null]  Generador de identificadores.
 *   `null` ⇒ uno derivado del reloj y de un contador de la instancia, que es
 *   determinista si `ahora` lo es — y por eso los tests no necesitan doblarlo salvo
 *   que quieran forzar una colisión.
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]
 * @returns {object}
 * @throws {TypeError}  Contrato roto por el programador.
 */
export function crearExpedientes(opciones = {}) {
  if (!opciones || typeof opciones !== 'object') {
    throw new TypeError(`crearExpedientes: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`)
  }
  const { bd = null, ahora = () => Date.now(), nuevoId = null, alAvisar = null } = opciones

  if (typeof ahora !== 'function') {
    throw new TypeError(`crearExpedientes: 'ahora' debe ser una función; recibido ${typeof ahora}.`)
  }
  if (nuevoId !== null && typeof nuevoId !== 'function') {
    throw new TypeError(
      `crearExpedientes: 'nuevoId' debe ser una función o null; recibido ${typeof nuevoId}.`,
    )
  }
  if (bd !== null && bd !== undefined && typeof bd !== 'object') {
    throw new TypeError(
      `crearExpedientes: 'bd' debe ser la promesa de abrirBd, su ResultadoApertura, la base ` +
        `envuelta por idb, o null/undefined si no hay almacén local; recibido un ${typeof bd}.`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  const cuenta = {
    disponible: null,
    guardados: 0,
    listados: 0,
    recuperados: 0,
    duplicados: 0,
    borrados: 0,
    fallosLectura: 0,
    fallosEscritura: 0,
    fallosBorrado: 0,
    ilegibles: 0,
  }

  let contadorId = 0
  /** Identificador nuevo. Empieza por letra y no lleva nunca la referencia desnuda. */
  const idNuevo =
    nuevoId ?? (() => `EXP-${ahora().toString(36)}-${(contadorId++).toString(36)}`)

  /** @type {Promise<*|null>|null} */
  let resuelta = null
  /** El último `mensaje` de «no hay base», para devolverlo con el motivo. */
  let mensajeSinBase = null

  /** Deja constancia de que no hay almacén y devuelve `null`. Avisa una vez. */
  function sinBase(razon, causa) {
    cuenta.disponible = false
    mensajeSinBase =
      `Los expedientes no se pueden guardar en este navegador (${razon}). Puedes trabajar, ` +
      'generar el GML y exportar con normalidad; lo único que no habrá es guardado entre ' +
      'sesiones. Este aviso no se repetirá durante esta sesión.'
    avisar(mensajeSinBase, { nivel: NIVEL.AVISO, causa })
    return null
  }

  /** Resuelve `opciones.bd` a una base utilizable o a `null`. Nunca lanza. */
  async function obtenerBase() {
    let abierta
    try {
      abierta = await bd
    } catch (error) {
      return sinBase(`la apertura del almacén ha fallado — ${detalleDe(error)}`, error)
    }
    if (abierta === null || abierta === undefined) {
      return sinBase('no se ha cableado ningún almacén local', null)
    }
    if (esBase(abierta)) {
      cuenta.disponible = true
      return abierta
    }
    if (abierta.disponible === true && esBase(abierta.bd)) {
      cuenta.disponible = true
      return abierta.bd
    }
    if (abierta.disponible === false) {
      return sinBase(abierta.mensaje || `motivo ${abierta.motivo}`, abierta)
    }
    return sinBase('lo que se ha pasado como base no sabe leer, escribir ni borrar', abierta)
  }

  /** La base, resolviéndola como mucho una vez. */
  function base() {
    if (resuelta === null) resuelta = obtenerBase()
    return resuelta
  }

  /** Resultado de «no hay base», con la forma que pida cada operación. */
  const conSinBase = (extra) => ({
    ok: false,
    motivo: MOTIVO_EXPEDIENTES.SIN_BD,
    mensaje: mensajeSinBase,
    ...extra,
  })

  /**
   * Rehidrata el expediente de un registro, o dice que no se puede. **No lanza**:
   * leer la propia base no puede dejar a nadie sin aplicación.
   *
   * Aquí es donde vuelve a congelarse `geometriaOficial` (ver la cabecera).
   *
   * @param {*} registro
   * @returns {object|null}
   */
  function expedienteDelRegistro(registro) {
    const guardado = registro?.expediente
    if (!guardado || typeof guardado !== 'object' || Array.isArray(guardado)) return null
    try {
      return crearExpediente({
        tipo: guardado.tipo,
        srs: guardado.srs,
        metadatos: guardado.metadatos ?? undefined,
        parcela: guardado.parcela ?? null,
        edificio: guardado.edificio ?? null,
      })
    } catch {
      return null
    }
  }

  /** El registro, sin el expediente: lo que la lista necesita. */
  const soloCabecera = (r) => ({
    id: r[CAMPO_CLAVE],
    nombre: r.nombre,
    refcat: r.refcat ?? null,
    creado: r.creado,
    actualizado: r.actualizado,
    srs: r.srs,
  })

  /**
   * Escribe un registro. Compartido por `guardar`, `duplicar` y el borrador, para
   * que el manejo del fallo de cuota —que es el criterio 4— esté escrito UNA vez.
   */
  async function escribir(db, registro, queEs) {
    try {
      await db.put(ALMACENES.EXPEDIENTES, registro)
      return { ok: true, registro, motivo: null, mensaje: null, esCuota: false }
    } catch (error) {
      cuenta.fallosEscritura += 1
      // Aquí solo hace falta saber SI fue por espacio; quién purga y qué purga lo
      // decide el cableado, que es el que conoce la caché del Catastro.
      const esCuota = esCuotaExcedida(error)
      const mensaje = esCuota
        ? `No queda espacio en este navegador para guardar ${queEs}. Puedes liberar sitio ` +
          'borrando expedientes que ya no necesites, o exportar este a un fichero de proyecto.'
        : `No se ha podido guardar ${queEs} (${detalleDe(error)}). El trabajo sigue en pantalla; ` +
          'lo que no ha ocurrido es el guardado.'
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return { ok: false, registro: null, motivo: MOTIVO_EXPEDIENTES.ERROR_ESCRITURA, mensaje, esCuota }
    }
  }

  // ── Las operaciones ───────────────────────────────────────────────────────

  /**
   * Guarda un expediente, creándolo o pisando el que ya tuviera ese identificador.
   *
   * El expediente se pasa **primero** por `crearExpediente`, y a propósito antes de
   * resolver la base: un error de programación tiene que reventar igual en un
   * entorno sin IndexedDB, o el día del despliegue aparecerá solo en los navegadores
   * que sí la tienen. Mismo orden que `recordar` en `storage/pie-firma.js`.
   *
   * @param {object} expediente  Un Expediente de `model/parcela.js`.
   * @param {{nombre?: string, id?: string}} [opts]
   * @returns {Promise<ResultadoGuardar>}
   * @throws {TypeError|RangeError}  Lo que lance `crearExpediente`.
   */
  async function guardar(expediente, { nombre, id } = {}) {
    const normal = crearExpediente({
      tipo: expediente?.tipo,
      srs: expediente?.srs,
      metadatos: expediente?.metadatos ?? undefined,
      parcela: expediente?.parcela ?? null,
      edificio: expediente?.edificio ?? null,
    })
    if (id !== undefined && (typeof id !== 'string' || id.length === 0)) {
      throw new TypeError(`guardar: 'id' debe ser un texto no vacío; recibido ${JSON.stringify(id)}.`)
    }
    if (nombre !== undefined && typeof nombre !== 'string') {
      throw new TypeError(`guardar: 'nombre' debe ser un texto; recibido ${typeof nombre}.`)
    }

    const db = await base()
    if (db === null) return conSinBase({ registro: null, esCuota: false })

    const clave = id ?? idNuevo()
    const marca = new Date(ahora()).toISOString()
    const refcat = refcatDe(normal)

    // Si ya existía, se conserva su `creado`: guardar otra vez no es crear otra vez.
    let creado = marca
    try {
      const previo = await db.get(ALMACENES.EXPEDIENTES, clave)
      if (typeof previo?.creado === 'string') creado = previo.creado
    } catch {
      // Que no se pueda leer el anterior no impide guardar el nuevo; lo único que
      // se pierde es la fecha de creación original, y el registro lo dirá porque
      // `creado` y `actualizado` saldrán iguales.
    }

    const rotulo =
      nombre !== undefined && nombre.trim().length > 0
        ? nombre.trim()
        : nombrePorDefecto(refcat, normal.tipo)
    const registro = {
      [CAMPO_CLAVE]: clave,
      nombre: rotulo,
      refcat,
      creado,
      actualizado: marca,
      srs: normal.srs,
      expediente: normal,
    }

    const r = await escribir(db, registro, 'el expediente')
    if (r.ok) cuenta.guardados += 1
    return r
  }

  /**
   * Los expedientes guardados, **del más reciente al más antiguo**, sin el borrador.
   *
   * ⚠️ **El orden se invierte a mano, y no es un descuido.** Medido en la fase 0 de
   * F10: `getAllFromIndex` sobre el índice `actualizado` devuelve **el más antiguo
   * primero** (ascendente por clave, que es como IndexedDB recorre un índice). La
   * ficha de la fase decía «listar (`getAllFromIndex`)» a secas, y ese orden habría
   * pasado por bueno sin que nadie lo mirase dos veces: sale una lista plausible,
   * solo que del revés. Se invierte aquí, explícitamente, y con esta nota al lado.
   *
   * ⚠️ **Y se cuenta el almacén además de leer el índice.** IndexedDB no indexa un
   * registro cuyo valor de índice sea `undefined`: un registro sin `actualizado`
   * —escrito por una versión futura, o a medio escribir— sería **invisible en la
   * lista sin que nada fallara**. Comparar contra `count()` es lo que convierte ese
   * silencio en un número que la interfaz puede contar (regla de oro 1).
   *
   * @returns {Promise<ResultadoListar>}
   */
  async function listar() {
    const db = await base()
    // `hayBorrador`/`borradores` van explícitos aunque no haya base: sin ellos salían
    // `undefined`, y `undefined` en una bandera se lee como `false` sin haberlo dicho.
    if (db === null) {
      return conSinBase({ registros: [], invisibles: 0, hayBorrador: false, borradores: [] })
    }

    try {
      const crudos = await db.getAllFromIndex(ALMACENES.EXPEDIENTES, INDICE.ACTUALIZADO)
      const total = await db.count(ALMACENES.EXPEDIENTES)

      const visibles = crudos.filter((r) => !CLAVES_BORRADOR.includes(r?.[CAMPO_CLAVE]))
      // Qué RAMAS tienen trabajo en curso, no cuántos registros hay: es lo que la
      // oferta del arranque necesita para decir qué se ha encontrado (F12 · T4.3).
      const borradores = Object.entries(ID_BORRADOR_POR_TIPO)
        .filter(([, clave]) => crudos.some((r) => r?.[CAMPO_CLAVE] === clave))
        .map(([tipo]) => tipo)
      // DERIVADO, nunca escrito aparte: dos banderas que dicen lo mismo son dos
      // banderas que pueden discrepar, y ésta la leen tres sitios desde F10.
      const hayBorrador = borradores.length > 0
      // `total` incluye los borradores si existen; `crudos` también, si están indexados.
      const invisibles = Math.max(0, total - crudos.length)

      const registros = visibles.reverse().map(soloCabecera)
      cuenta.listados += 1

      if (invisibles > 0) {
        avisar(
          `Hay ${invisibles} registro(s) guardado(s) que la lista no puede mostrar porque les ` +
            'falta la fecha de modificación. No se han perdido: siguen en el almacén local.',
          { nivel: NIVEL.AVISO },
        )
      }
      return {
        ok: true,
        registros,
        invisibles,
        hayBorrador,
        borradores,
        motivo: null,
        mensaje: null,
      }
    } catch (error) {
      cuenta.fallosLectura += 1
      const mensaje = `No se ha podido leer la lista de expedientes guardados (${detalleDe(error)}).`
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return {
        ok: false,
        registros: [],
        invisibles: 0,
        hayBorrador: false,
        borradores: [],
        motivo: MOTIVO_EXPEDIENTES.ERROR_LECTURA,
        mensaje,
      }
    }
  }

  /**
   * Recupera un expediente **rehidratado**: pasado por `crearExpediente`, con la
   * geometría oficial vuelta a congelar (ver la cabecera).
   *
   * @param {string} id
   * @returns {Promise<ResultadoRecuperar>}
   * @throws {TypeError}  Si `id` no es un texto no vacío.
   */
  async function recuperar(id) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError(`recuperar: 'id' debe ser un texto no vacío; recibido ${JSON.stringify(id)}.`)
    }
    const db = await base()
    if (db === null) return conSinBase({ expediente: null, registro: null })

    let crudo
    try {
      crudo = await db.get(ALMACENES.EXPEDIENTES, id)
    } catch (error) {
      cuenta.fallosLectura += 1
      const mensaje = `No se ha podido leer el expediente guardado (${detalleDe(error)}).`
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return { ok: false, expediente: null, registro: null, motivo: MOTIVO_EXPEDIENTES.ERROR_LECTURA, mensaje }
    }

    if (crudo === undefined) {
      return {
        ok: false,
        expediente: null,
        registro: null,
        motivo: MOTIVO_EXPEDIENTES.NO_ENCONTRADO,
        mensaje: 'Ese expediente ya no está guardado en este navegador.',
      }
    }

    const expediente = expedienteDelRegistro(crudo)
    if (expediente === null) {
      cuenta.ilegibles += 1
      const mensaje =
        'El expediente guardado no se ha podido leer: su contenido no tiene la forma que espera ' +
        'esta versión de la aplicación. No se ha borrado nada; puedes eliminarlo de la lista.'
      avisar(mensaje, { nivel: NIVEL.AVISO })
      return {
        ok: false,
        expediente: null,
        registro: soloCabecera(crudo),
        motivo: MOTIVO_EXPEDIENTES.REGISTRO_ILEGIBLE,
        mensaje,
      }
    }

    cuenta.recuperados += 1
    return { ok: true, expediente, registro: soloCabecera(crudo), motivo: null, mensaje: null }
  }

  /**
   * Duplica un expediente guardado: `structuredClone` y clave nueva.
   *
   * El clon se hace sobre el registro **crudo** y no sobre el rehidratado, a
   * propósito: duplicar es copiar lo que hay, no revalidarlo. Un expediente que ya
   * no se puede leer se puede seguir duplicando —por ejemplo para exportarlo antes
   * de tocarlo—, y quien lo recupere se encontrará el mismo `REGISTRO_ILEGIBLE` que
   * en el original, que es la verdad.
   *
   * @param {string} id
   * @returns {Promise<ResultadoGuardar>}
   */
  async function duplicar(id) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError(`duplicar: 'id' debe ser un texto no vacío; recibido ${JSON.stringify(id)}.`)
    }
    const db = await base()
    if (db === null) return conSinBase({ registro: null, esCuota: false })

    let crudo
    try {
      crudo = await db.get(ALMACENES.EXPEDIENTES, id)
    } catch (error) {
      cuenta.fallosLectura += 1
      const mensaje = `No se ha podido leer el expediente que se quería duplicar (${detalleDe(error)}).`
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return { ok: false, registro: null, motivo: MOTIVO_EXPEDIENTES.ERROR_LECTURA, mensaje, esCuota: false }
    }
    if (crudo === undefined) {
      return {
        ok: false,
        registro: null,
        motivo: MOTIVO_EXPEDIENTES.NO_ENCONTRADO,
        mensaje: 'Ese expediente ya no está guardado en este navegador.',
        esCuota: false,
      }
    }

    const marca = new Date(ahora()).toISOString()
    const copia = structuredClone(crudo)
    copia[CAMPO_CLAVE] = idNuevo()
    copia.nombre = `${crudo.nombre} (copia)`
    copia.creado = marca
    copia.actualizado = marca

    const r = await escribir(db, copia, 'la copia del expediente')
    if (r.ok) cuenta.duplicados += 1
    return r
  }

  /**
   * Borra un expediente. Borrar de verdad: no lo marca ni lo esconde.
   *
   * @param {string} id
   * @returns {Promise<{ok: boolean, motivo: string|null, mensaje: string|null}>}
   */
  async function borrar(id) {
    if (typeof id !== 'string' || id.length === 0) {
      throw new TypeError(`borrar: 'id' debe ser un texto no vacío; recibido ${JSON.stringify(id)}.`)
    }
    const db = await base()
    if (db === null) return conSinBase({})

    try {
      await db.delete(ALMACENES.EXPEDIENTES, id)
      cuenta.borrados += 1
      return { ok: true, motivo: null, mensaje: null }
    } catch (error) {
      cuenta.fallosBorrado += 1
      const mensaje =
        `No se ha podido borrar el expediente (${detalleDe(error)}). Sigue guardado: vuelve ` +
        'a intentarlo, o borra los datos del sitio desde el navegador.'
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return { ok: false, motivo: MOTIVO_EXPEDIENTES.ERROR_BORRADO, mensaje }
    }
  }

  // ── El borrador del autoguardado ──────────────────────────────────────────

  /**
   * Guarda el trabajo en curso, pisando el borrador anterior **de su misma rama**.
   * Lo llama el debounce de `storage/autoguardado.js`, no el usuario.
   *
   * ⛔ **La clave la decide el `tipo` del expediente, no quien llama** (F12 · T4.3).
   * Ver el apartado del borrador en la cabecera: un parámetro de clave sería un
   * parámetro que se puede pasar equivocado, y equivocarlo aquí es escribir el
   * edificio encima de la parcela sin que nada falle.
   *
   * A diferencia de {@link guardar}, **no avisa por el canal cuando falla**: el
   * autoguardado corre solo, cada dos segundos, y un fallo persistente llenaría el
   * panel de tarjetas idénticas que el usuario no ha pedido. El fallo se devuelve —
   * y quien lo cuenta, una sola vez y donde importa, es el cableado. Es la misma
   * distinción que hace `storage/cache-catastro.js` frente a `storage/pie-firma.js`:
   * avisa quien ha pedido algo explícitamente.
   *
   * @param {object} expediente
   * @returns {Promise<ResultadoGuardar>}
   * @throws {TypeError|RangeError}  Lo que lance `crearExpediente`.
   */
  async function guardarBorrador(expediente) {
    const normal = crearExpediente({
      tipo: expediente?.tipo,
      srs: expediente?.srs,
      metadatos: expediente?.metadatos ?? undefined,
      parcela: expediente?.parcela ?? null,
      edificio: expediente?.edificio ?? null,
    })
    // Va DESPUÉS de normalizar y antes de tocar la base: `crearExpediente` ya ha
    // validado el tipo, así que llegar aquí con uno desconocido solo puede ser que
    // este mapa se haya quedado corto — y eso tiene que verse, no degradar.
    const clave = claveBorrador(normal.tipo, 'guardarBorrador')

    const db = await base()
    if (db === null) return conSinBase({ registro: null, esCuota: false })

    const marca = new Date(ahora()).toISOString()
    const refcat = refcatDe(normal)
    const registro = {
      [CAMPO_CLAVE]: clave,
      nombre: nombrePorDefecto(refcat, normal.tipo),
      refcat,
      creado: marca,
      actualizado: marca,
      srs: normal.srs,
      expediente: normal,
    }

    try {
      await db.put(ALMACENES.EXPEDIENTES, registro)
      return { ok: true, registro, motivo: null, mensaje: null, esCuota: false }
    } catch (error) {
      cuenta.fallosEscritura += 1
      return {
        ok: false,
        registro: null,
        motivo: MOTIVO_EXPEDIENTES.ERROR_ESCRITURA,
        mensaje: `No se ha podido autoguardar el trabajo en curso (${detalleDe(error)}).`,
        esCuota: esCuotaExcedida(error),
      }
    }
  }

  /**
   * El trabajo en curso **de una rama**, si lo hay. `ok: false` con `NO_ENCONTRADO`
   * **no es un fallo**: es que no hay borrador, que es el caso normal del primer
   * arranque — y, desde F12, también el de la rama que el usuario no haya tocado.
   *
   * El defecto es `PARCELA` porque es la rama con la que arranca la aplicación y la
   * única que existía cuando esto se escribió: las llamadas de F10 siguen valiendo
   * palabra por palabra. Un tipo desconocido **lanza** (ver {@link claveBorrador}).
   *
   * @param {string} [tipo=TIPO_EXPEDIENTE.PARCELA]  Uno de `TIPO_EXPEDIENTE`.
   * @returns {Promise<ResultadoRecuperar>}
   * @throws {RangeError}  Con un tipo que no tiene clave reservada.
   */
  async function leerBorrador(tipo = TIPO_EXPEDIENTE.PARCELA) {
    return recuperar(claveBorrador(tipo, 'leerBorrador'))
  }

  /**
   * Tira el borrador **de una rama**. Lo llama «Descartar», y también el cableado en
   * cuanto el usuario recupera el trabajo: dejarlo ahí después de recuperarlo haría
   * que la próxima carga volviera a ofrecer algo que ya está en pantalla.
   *
   * ⚠️ Borra el de UNA rama, no los dos. Quien quiera acabar con la oferta entera
   * llama dos veces, y lo hace a la vista: un «descarta todo» escondido detrás de un
   * defecto tiraría el trabajo de una rama que el usuario no estaba mirando.
   *
   * @param {string} [tipo=TIPO_EXPEDIENTE.PARCELA]  Uno de `TIPO_EXPEDIENTE`.
   * @returns {Promise<{ok: boolean, motivo: string|null, mensaje: string|null}>}
   * @throws {RangeError}  Con un tipo que no tiene clave reservada.
   */
  async function descartarBorrador(tipo = TIPO_EXPEDIENTE.PARCELA) {
    return borrar(claveBorrador(tipo, 'descartarBorrador'))
  }

  /**
   * Contadores de la instancia. Mismo papel que `estado()` en
   * `storage/cache-catastro.js`: el gancho informativo con el que la interfaz puede
   * enseñar qué ha pasado sin que este módulo tenga que saber pintarlo.
   *
   * @returns {object}
   */
  function estado() {
    return { ...cuenta }
  }

  return {
    guardar,
    listar,
    recuperar,
    duplicar,
    borrar,
    guardarBorrador,
    leerBorrador,
    descartarBorrador,
    estado,
  }
}

export default crearExpedientes

// storage/pie-firma.js — F09 · T3.3. El PIE DE FIRMA, recordado entre sesiones.
//
// El diálogo «Preparar informe» (T4.1) tiene una casilla «Recordar». Esto es lo
// que hay detrás: **el primer dato del expediente que esta aplicación guarda**.
// Hasta hoy `storage/` solo tenía caché del Catastro —cartografía pública, que se
// puede tirar y volver a pedir—; aquí hay nombre, número de colegiado, colegio y
// contacto de una persona. Esa diferencia manda en todo el fichero.
//
// ── QUÉ SE GUARDA, DÓNDE, Y CÓMO SE BORRA ───────────────────────────────────
// Se escribe aquí, en la cabecera y no en un documento aparte, porque es lo
// primero que hay que poder responder cuando alguien pregunta.
//
// **QUÉ.** Exactamente los cuatro campos del contrato D —`nombre`,
// `numeroColegiado`, `colegio`, `contacto`— y la marca de tiempo de cuándo se
// guardaron. Ni un campo más. En particular **NO se guarda**:
//   · el ENCABEZADO (municipio, referencia catastral, polígono, fecha,
//     identificador del documento). No es un dato del usuario sino de la parcela
//     que está mirando, y guardarlo construiría —sin que nadie lo haya pedido—
//     un registro de qué fincas ha consultado esta persona y cuándo. Eso es
//     muchísimo más dato personal que los cuatro campos de la firma, y no hace
//     ninguna falta: el encabezado se compone de cero en cada informe.
//   · un HISTORIAL. El almacén tiene **un solo registro**, siempre con la misma
//     clave ({@link CLAVE_PIE_FIRMA}), así que cada `recordar` PISA al anterior.
//     No hay versiones antiguas del nombre o del teléfono de nadie criando polvo.
//   · los identificadores de los documentos emitidos. No se lleva registro de qué
//     informes se han hecho.
//
// **DÓNDE.** En IndexedDB, en el navegador y en el equipo de quien lo escribe,
// dentro de la base `concreta-gml` (`storage/bd.js`), almacén
// `ALMACENES.PIE_FIRMA`. **No se envía a ningún servidor**: esta aplicación no
// tiene backend (SPEC §3), y ese es justo uno de los motivos por los que no lo
// tiene. {@link AVISO_PRIVACIDAD} dice esto mismo en una frase presentable, para
// que el diálogo lo pueda poner al lado de la casilla en vez de que el usuario
// tenga que suponerlo.
//
// **CÓMO SE BORRA.** Tres vías, y las tres funcionan:
//   1. **Desmarcar la casilla** ⇒ {@link crearPieDeFirmaGuardado}·`olvidar()`, que
//      **BORRA el registro**. No lo marca como «no usar», no lo deja «inactivo»:
//      lo borra. Desmarcar «Recordar» y que el dato siga ahí sería mentir con una
//      casilla, que es la peor forma de mentir.
//   2. Borrar los datos del sitio desde el navegador (borra la base entera).
//   3. Programáticamente, `indexedDB.deleteDatabase(NOMBRE_BD)`.
//
// ── EL MODO DEGRADADO ES EL MISMO DE SIEMPRE, Y AQUÍ SE CUENTA DOS VECES ────
// `storage/bd.js#abrirBd` no lanza cuando no puede: devuelve
// `{disponible: false, motivo, mensaje}` —Node, ventana privada, datos del sitio
// bloqueados, `<iframe>` de tercera parte—. Con la base así, este módulo **no
// guarda, no recupera y no lanza nunca**: el informe sale igual, sin pie de firma
// recordado, y hay que volver a teclearlo la próxima vez.
//
// La diferencia con `storage/cache-catastro.js`, y es deliberada: aquella
// **solo** avisa por el canal `Avisar` cuando la escritura falla, porque el dato
// que el usuario quería ya lo tiene en la mano y el fallo no le cambia nada. Aquí
// el usuario ha **marcado una casilla**: ha pedido algo explícitamente, y si no se
// ha podido, tiene que enterarse EN EL DIÁLOGO y no solo en la consola. Por eso
// todas las operaciones **avisan por el canal y ADEMÁS devuelven el fallo** con su
// `motivo` y su `mensaje` presentables. Lo que no hacen nunca es lanzar por causa
// del almacenamiento: la frontera de siempre —*el entorno degrada, el programador
// revienta*— sigue en pie, y una clave desconocida en la firma sí revienta,
// porque la lanza `report/firma.js#normalizarFirma`.
//
// ── ESTO NO ES UNA CACHÉ, Y POR ESO NO TIENE TTL ────────────────────────────
// `storage/cache-catastro.js` caduca a los siete días porque la cartografía del
// Catastro cambia y servir una copia vieja sin decirlo sería mentir. El nombre de
// quien firma no caduca. Un TTL aquí solo produciría un día en que la aplicación
// «se olvida» del usuario sin que él haya tocado nada, y eso no se lee como una
// política de caché: se lee como que el programa está roto. **El registro se queda
// hasta que alguien lo borra**, que es lo que la casilla promete.
//
// Sí se guarda `guardadoEn`, pero para CONTARLO, no para caducar: el diálogo puede
// decir «recordado el …» y el usuario sabe de cuándo es lo que tiene delante.
//
// ── LO QUE SE GUARDA ESTÁ NORMALIZADO, Y LO NORMALIZA report/firma.js ───────
// El registro pasa por `normalizarFirma` **al escribir y al leer**. No es
// paranoia: es que un `''` guardado y un `null` guardado tienen que imprimirse
// igual («No consta»), y la única forma de que no puedan divergir es que la
// decisión la tome un solo módulo. `storage/` importa de `report/` y no al revés
// —`report/firma.js` es puro y no importa nada—, así que la dependencia va en la
// dirección correcta y no hay ciclo.
//
// Al LEER, además, un registro que no se pueda normalizar (base manipulada a
// mano, versión futura con basura dentro) **no revienta**: sale como
// {@link MOTIVO_SIN_PIE}·`REGISTRO_ILEGIBLE`, con su aviso, y el diálogo se abre
// en blanco. Reventar al leer la propia base es la forma más tonta de dejar a
// alguien sin poder usar la aplicación.
//
// ── EL CAMPO CLAVE SE DERIVA, COMO EN LA CACHÉ ──────────────────────────────
// El nombre del campo sale de `ESQUEMA_ALMACENES[…].keyPath`: en este fichero no
// se escribe la cadena `'id'` ni una sola vez. Mismo motivo que en
// `storage/cache-catastro.js`: si una migración futura moviera el `keyPath`, este
// módulo la sigue sin que nadie lo toque.
//
// Su test es `test/storage/pie-firma.test.js`, **sin sufijo `.dom`**:
// `fake-indexeddb` es JavaScript puro y no necesita jsdom (mismo criterio que los
// otros dos ficheros de `test/storage/`).

import { CAMPOS_FIRMA, FIRMA_VACIA, normalizarFirma } from '../report/firma.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'
import { ALMACENES, ESQUEMA_ALMACENES } from './bd.js'

// ── Identidad del registro ───────────────────────────────────────────────────

/**
 * La clave del ÚNICO registro del almacén. Fija a propósito: con una clave fija,
 * `put` pisa, y en este almacén no puede acumularse un historial de firmas (ver
 * la cabecera). Se exporta para que una herramienta de diagnóstico o el guion de
 * humo puedan mirar el registro sin adivinar cómo se llama.
 *
 * @readonly
 */
export const CLAVE_PIE_FIRMA = 'unico'

/**
 * El campo en el que la base espera la clave. **Derivado**, nunca escrito.
 *
 * @readonly
 */
const CAMPO_CLAVE = ESQUEMA_ALMACENES[ALMACENES.PIE_FIRMA].keyPath

/**
 * Las claves que puede tener un registro de este almacén, y ninguna más. Se
 * deriva del campo clave para que no haya que tocarla si el esquema cambia.
 *
 * Existe para que su test pueda afirmar **qué NO se guarda** comparando conjuntos
 * en vez de leyendo la cabecera y confiando: un registro con una clave de más
 * —el encabezado, la referencia catastral, lo que sea— pone la prueba en rojo.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CAMPOS_REGISTRO = Object.freeze([CAMPO_CLAVE, 'firma', 'guardadoEn'])

// ── Degradación: por qué no hay pie de firma ─────────────────────────────────

/**
 * Por qué una operación no ha podido ser. Códigos estables, para que la UI decida
 * sin leerle el texto al `mensaje` (mismo criterio que `MOTIVO_SIN_BD` en
 * `storage/bd.js` y `MOTIVO_NO_DESCARGADO` en `gml/descargar.js`).
 *
 * @readonly
 */
export const MOTIVO_SIN_PIE = Object.freeze({
  /** No hay almacén local utilizable. Node, ventana privada, datos bloqueados. */
  SIN_BD: 'SIN_BD',
  /**
   * No hay nada guardado. **No es un fallo**: es el primer arranque, o es que el
   * usuario nunca marcó la casilla, o que la desmarcó. Lleva `mensaje` igualmente
   * —mismo criterio que `MOTIVO_CATASTRO.NO_ENCONTRADO`— para que quien lo reciba
   * no tenga que redactar su propia frase.
   */
  NO_GUARDADO: 'NO_GUARDADO',
  /** La lectura reventó en IndexedDB. */
  ERROR_LECTURA: 'ERROR_LECTURA',
  /** La escritura reventó (cuota agotada, desalojo, datos bloqueados). */
  ERROR_ESCRITURA: 'ERROR_ESCRITURA',
  /** El borrado reventó. El dato **sigue ahí**, y se dice. */
  ERROR_BORRADO: 'ERROR_BORRADO',
  /** Había registro, pero no se pudo leer como una firma. Ver la cabecera. */
  REGISTRO_ILEGIBLE: 'REGISTRO_ILEGIBLE',
})

/**
 * La frase que el diálogo de T4.1 pone junto a la casilla «Recordar». Vive aquí
 * —y no en el diálogo— porque describe lo que hace ESTE módulo, y una promesa
 * sobre datos personales escrita lejos del código que la cumple es una promesa
 * que se queda desfasada sin que nadie lo note.
 *
 * @readonly
 */
export const AVISO_PRIVACIDAD =
  'Se guardan solo estos cuatro datos (nombre, número de colegiado, colegio y contacto) en este ' +
  'navegador y en este equipo. No se envían a ningún servidor: esta aplicación no tiene ninguno. ' +
  'No se guarda ningún dato de la parcela ni de los informes emitidos. Al desmarcar esta casilla ' +
  'se borran.'

// ── Utilidades ───────────────────────────────────────────────────────────────

/** Texto corto de un fallo. Misma forma que `storage/bd.js` y la caché. */
function detalleDe(error) {
  return error && error.name ? `${error.name}: ${error.message}` : String(error)
}

/**
 * ¿Es esto una base de `idb` utilizable? DUCK TYPING sobre lo que este módulo usa
 * —`get`, `put` y `delete`— y nada más, por el mismo motivo que los otros dos
 * módulos de `storage/`: el constructor global no existe en Node, y un doble de
 * test no debería fingir una jerarquía entera para hacer de base. Es además lo
 * que permite envolver la base REAL con un `put` que rechaza, que es como se
 * simula la cuota agotada.
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
    typeof v.delete === 'function'
  )
}

// ── Typedefs ─────────────────────────────────────────────────────────────────

/** @typedef {import('../report/firma.js').Firma} Firma */

/**
 * @typedef {Object} ResultadoRecordar
 * @property {boolean} guardado  `true` solo si el registro está en la base.
 * @property {Firma} firma  La firma **ya normalizada**, la haya guardado o no.
 *   Se devuelve siempre para que el formulario se quede con la versión canónica
 *   (recortada, `''` → `null`) y no con lo que se tecleó.
 * @property {number|null} guardadoEn  Marca de tiempo escrita, o `null`.
 * @property {string|null} motivo  Clave de {@link MOTIVO_SIN_PIE}; `null` si fue.
 * @property {string|null} mensaje  Español presentable; `null` si fue.
 */

/**
 * @typedef {Object} ResultadoRecuperar
 * @property {boolean} recordado  `true` solo si había firma guardada.
 * @property {Firma} firma  **Nunca `null`**: si no hay nada, es la firma vacía,
 *   con sus cuatro campos a `null`. Así el diálogo la enchufa a los `<input>` sin
 *   un `if` previo — el mismo criterio con el que `services/catastro.js` tiene
 *   `CACHE_NULA` en vez de un `null` que obliga a comprobar en cada punto de uso.
 * @property {number|null} guardadoEn  Cuándo se guardó, para poder contarlo.
 * @property {string|null} motivo  Clave de {@link MOTIVO_SIN_PIE}; `null` si sí.
 * @property {string|null} mensaje  Español presentable; `null` si sí.
 */

/**
 * @typedef {Object} ResultadoOlvidar
 * @property {boolean} olvidado  `true` si al terminar NO queda nada guardado.
 * @property {boolean} habia  Si había algo que borrar. Distinguirlo permite decir
 *   «borrado» en vez de «no había nada», que no es lo mismo.
 * @property {string|null} motivo
 * @property {string|null} mensaje
 */

/**
 * Contadores acumulados. Fotografía nueva en cada llamada; no se reinician nunca,
 * porque un contador que se borra miente sobre lo que pasó (misma disciplina que
 * `storage/cache-catastro.js` y `services/_red.js`).
 *
 * @typedef {Object} EstadoPieFirma
 * @property {boolean|null} disponible  `null` mientras no se haya mirado la base.
 * @property {number} recordados  Escrituras que llegaron a la base.
 * @property {number} recuperados  Lecturas que devolvieron firma.
 * @property {number} olvidados  Borrados que llegaron a la base (había o no).
 * @property {number} fallosLectura
 * @property {number} fallosEscritura
 * @property {number} fallosBorrado
 * @property {number} ilegibles  Registros que no se pudieron leer como firma.
 */

// ── El almacén ───────────────────────────────────────────────────────────────

/**
 * Crea el acceso al pie de firma guardado.
 *
 * ```js
 * import { abrirBd } from './storage/bd.js'
 * import { crearPieDeFirmaGuardado } from './storage/pie-firma.js'
 *
 * // `abrirBd` devuelve una PROMESA y se pasa sin esperarla: se resuelve sola en
 * // la primera operación, así que abrir el diálogo no espera a IndexedDB.
 * const pie = crearPieDeFirmaGuardado({ bd: abrirBd({ alAvisar }), alAvisar })
 *
 * const { firma, recordado, guardadoEn } = await pie.recuperar()
 * await pie.recordar({ nombre: 'Nombre Apellido', numeroColegiado: '04321' })
 * await pie.olvidar()   // desmarcar la casilla BORRA
 * ```
 *
 * Es una factory (`crearX`), nunca una clase: todo el estado —la base resuelta,
 * los contadores, el «ya avisé de que no hay base»— vive en el cierre, así que dos
 * instancias no comparten nada y cada prueba monta la suya sin reiniciar nada.
 *
 * @param {object} [opciones]
 * @param {Promise<import('./bd.js').ResultadoApertura>|object|null} [opciones.bd=null]
 *   La base. Se admiten las tres formas de `storage/cache-catastro.js`: la promesa
 *   de `abrirBd`, su `ResultadoApertura` ya resuelto, o la base envuelta por `idb`.
 *   `null`/`undefined` = no hay almacén local, que es un estado legítimo.
 * @param {() => number} [opciones.ahora=() => Date.now()]  Reloj, en milisegundos
 *   de época. Inyectable por el precedente del repo (cero `vi.useFakeTimers`): un
 *   test que dependa del reloj del sistema no puede afirmar la marca que escribe,
 *   y falsear el tiempo global rompe a `fake-indexeddb`.
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]
 *   Canal de aviso. `null` ⇒ `console.warn`, el suelo mínimo de la regla de oro 1.
 * @returns {{recordar: (firma: object|null) => Promise<ResultadoRecordar>,
 *            recuperar: () => Promise<ResultadoRecuperar>,
 *            olvidar: () => Promise<ResultadoOlvidar>,
 *            estado: () => EstadoPieFirma}}
 * @throws {TypeError}  Contrato roto por el programador: `opciones` que no es un
 *   objeto, `ahora` que no es función, `alAvisar` que no es función ni nulo, o un
 *   `bd` que no es ni objeto ni nulo.
 */
export function crearPieDeFirmaGuardado(opciones = {}) {
  if (!opciones || typeof opciones !== 'object') {
    throw new TypeError(
      `crearPieDeFirmaGuardado: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`,
    )
  }
  const { bd = null, ahora = () => Date.now(), alAvisar = null } = opciones

  if (typeof ahora !== 'function') {
    throw new TypeError(
      `crearPieDeFirmaGuardado: 'ahora' debe ser una función; recibido ${typeof ahora}.`,
    )
  }
  // La FORMA se exige aquí; que sepa hacer de base o no es cosa del entorno y se
  // degrada. Misma línea que traza `storage/bd.js` con su fábrica.
  if (bd !== null && bd !== undefined && typeof bd !== 'object') {
    throw new TypeError(
      `crearPieDeFirmaGuardado: 'bd' debe ser la promesa de abrirBd, su ResultadoApertura, la ` +
        `base envuelta por idb, o null/undefined si no hay almacén local; recibido un ${typeof bd}.`,
    )
  }

  const avisar = resolverAvisar(alAvisar)

  /** @type {EstadoPieFirma} */
  const cuenta = {
    disponible: null,
    recordados: 0,
    recuperados: 0,
    olvidados: 0,
    fallosLectura: 0,
    fallosEscritura: 0,
    fallosBorrado: 0,
    ilegibles: 0,
  }

  /**
   * La base resuelta, memoizada. Se guarda la PROMESA y no la base para que dos
   * operaciones simultáneas durante la resolución compartan la misma.
   *
   * @type {Promise<*|null>|null}
   */
  let resuelta = null

  /** El último `mensaje` de «no hay base», para poder devolverlo con el motivo. */
  let mensajeSinBase = null

  /**
   * Deja constancia de que no hay almacén y devuelve `null`.
   *
   * **Avisa UNA sola vez por instancia**, y sin bandera: aquí solo se llega desde
   * {@link obtenerBase}, que corre como mucho una vez porque {@link base} memoiza
   * su promesa. Es la misma nota que `storage/cache-catastro.js` dejó escrita tras
   * comprobar que la bandera «por si acaso» era código que ningún test podía
   * matar. Si algún día alguien quita el memo, el aviso se repetirá y su prueba se
   * pondrá roja, que es donde debe saltar.
   *
   * @param {string} razon
   * @param {*} causa
   * @returns {null}
   */
  function sinBase(razon, causa) {
    cuenta.disponible = false
    mensajeSinBase =
      `El pie de firma no se puede recordar entre sesiones (${razon}). Puedes preparar y ` +
      'descargar el informe con normalidad; lo único que pasa es que habrá que volver a ' +
      'escribir el nombre, el número de colegiado y el contacto la próxima vez. Este aviso no ' +
      'se repetirá durante esta sesión.'
    avisar(mensajeSinBase, { nivel: NIVEL.AVISO, causa })
    return null
  }

  /**
   * Resuelve `opciones.bd` a una base utilizable o a `null`. **Nunca lanza y
   * nunca rechaza**: no tener almacén es un estado, no un fallo.
   *
   * @returns {Promise<*|null>}
   */
  async function obtenerBase() {
    let abierta
    try {
      // `await` sobre un valor que no es promesa lo devuelve tal cual: esta línea
      // cubre las tres formas admitidas sin ramificar.
      abierta = await bd
    } catch (error) {
      return sinBase(`la apertura del almacén ha fallado — ${detalleDe(error)}`, error)
    }

    if (abierta === null || abierta === undefined) {
      return sinBase('no se ha cableado ningún almacén local', null)
    }
    // El orden importa: un `ResultadoApertura` no tiene `get` ni `put`, así que
    // esta comprobación no se lo puede tragar por error.
    if (esBase(abierta)) {
      cuenta.disponible = true
      return abierta
    }
    if (abierta.disponible === true && esBase(abierta.bd)) {
      cuenta.disponible = true
      return abierta.bd
    }
    if (abierta.disponible === false) {
      // El `mensaje` de `abrirBd` ya está en español y ya explica el porqué; se
      // arrastra como razón en vez de reescribirlo peor.
      return sinBase(abierta.mensaje || `motivo ${abierta.motivo}`, abierta)
    }
    return sinBase(
      'lo que se ha pasado como base no sabe leer, escribir ni borrar',
      abierta,
    )
  }

  /** La base, resolviéndola como mucho una vez. */
  function base() {
    if (resuelta === null) resuelta = obtenerBase()
    return resuelta
  }

  /**
   * Convierte un registro de la base en una firma normalizada, o dice que no se
   * puede. **No lanza**: leer la propia base no puede dejar a nadie sin aplicación.
   *
   * Se copian SOLO los campos del contrato ({@link CAMPOS_FIRMA}) antes de
   * normalizar, así que un registro escrito por una versión futura con un campo de
   * más se lee sin problema en vez de reventar contra la guarda de claves
   * desconocidas de `normalizarFirma`.
   *
   * @param {*} registro
   * @returns {{firma: Firma, guardadoEn: number|null}|null}
   */
  function firmaDelRegistro(registro) {
    const guardada = registro?.firma
    if (guardada === null || typeof guardada !== 'object' || Array.isArray(guardada)) return null
    const soloDelContrato = {}
    for (const campo of CAMPOS_FIRMA) {
      if (guardada[campo] !== undefined) soloDelContrato[campo] = guardada[campo]
    }
    let firma
    try {
      firma = normalizarFirma(soloDelContrato)
    } catch {
      return null
    }
    // Sin TTL, una marca de tiempo inservible no invalida nada: solo impide decir
    // cuándo se guardó. Se devuelve `null` y quien lo cuente se calla la fecha.
    const guardadoEn = Number.isFinite(registro?.guardadoEn) ? registro.guardadoEn : null
    return { firma, guardadoEn }
  }

  // ── Las tres operaciones ──────────────────────────────────────────────────

  /**
   * Guarda (pisando) el pie de firma. Es lo que hace la casilla «Recordar» al
   * marcarse.
   *
   * **No lanza por causa del almacenamiento**: si la escritura falla (cuota
   * agotada es el caso real), avisa por el canal, **y además** devuelve
   * `guardado: false` con motivo y mensaje, porque el usuario ha pedido esto
   * explícitamente y tiene que verlo en el diálogo (ver la cabecera).
   *
   * Sí lanza si la firma trae una clave desconocida o un tipo imposible: eso lo
   * lanza `report/firma.js#normalizarFirma` y es contrato roto por el programador.
   *
   * @param {object|null} firma  Lo que hay en el formulario.
   * @returns {Promise<ResultadoRecordar>}
   * @throws {TypeError}  Lo que lance `normalizarFirma`.
   */
  async function recordar(firma) {
    // A propósito ANTES de resolver la base: un error de programación tiene que
    // reventar igual en un entorno sin IndexedDB, o el día que se despliegue
    // aparecerá solo en los navegadores que sí la tienen.
    const normal = normalizarFirma(firma)

    const db = await base()
    if (db === null) {
      return {
        guardado: false,
        firma: normal,
        guardadoEn: null,
        motivo: MOTIVO_SIN_PIE.SIN_BD,
        mensaje: mensajeSinBase,
      }
    }

    const guardadoEn = ahora()
    try {
      // El campo de la clave se DERIVA del esquema: aquí no se escribe `'id'`. Y
      // el registro lleva EXACTAMENTE tres claves — ver «qué se guarda».
      await db.put(ALMACENES.PIE_FIRMA, {
        [CAMPO_CLAVE]: CLAVE_PIE_FIRMA,
        firma: normal,
        guardadoEn,
      })
      cuenta.recordados += 1
      return { guardado: true, firma: normal, guardadoEn, motivo: null, mensaje: null }
    } catch (error) {
      cuenta.fallosEscritura += 1
      const mensaje =
        `No se ha podido guardar el pie de firma en este navegador (${detalleDe(error)}). Lo más ` +
        'probable es que se haya agotado el espacio que reserva para este sitio. El informe se ' +
        'genera igual con los datos que has escrito; lo único que no pasará es que se recuerden ' +
        'la próxima vez.'
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return {
        guardado: false,
        firma: normal,
        guardadoEn: null,
        motivo: MOTIVO_SIN_PIE.ERROR_ESCRITURA,
        mensaje,
      }
    }
  }

  /**
   * El pie de firma guardado, si lo hay.
   *
   * `firma` **nunca es `null`**: cuando no hay nada, es la firma vacía. Quien lo
   * reciba puede volcarla en el formulario sin comprobar nada, y quien quiera
   * saber si había algo mira `recordado`.
   *
   * @returns {Promise<ResultadoRecuperar>}
   */
  async function recuperar() {
    const vacia = () => ({ ...FIRMA_VACIA })

    const db = await base()
    if (db === null) {
      return {
        recordado: false,
        firma: vacia(),
        guardadoEn: null,
        motivo: MOTIVO_SIN_PIE.SIN_BD,
        mensaje: mensajeSinBase,
      }
    }

    let registro
    try {
      registro = await db.get(ALMACENES.PIE_FIRMA, CLAVE_PIE_FIRMA)
    } catch (error) {
      cuenta.fallosLectura += 1
      const mensaje =
        `No se ha podido leer el pie de firma guardado en este navegador ` +
        `(${detalleDe(error)}). Escríbelo otra vez y el informe saldrá igual.`
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return {
        recordado: false,
        firma: vacia(),
        guardadoEn: null,
        motivo: MOTIVO_SIN_PIE.ERROR_LECTURA,
        mensaje,
      }
    }

    if (registro === null || registro === undefined) {
      return {
        recordado: false,
        firma: vacia(),
        guardadoEn: null,
        motivo: MOTIVO_SIN_PIE.NO_GUARDADO,
        mensaje:
          'Todavía no hay ningún pie de firma guardado en este navegador. Escríbelo y marca ' +
          '«Recordar» si quieres que la próxima vez salga puesto.',
      }
    }

    const leido = firmaDelRegistro(registro)
    if (leido === null) {
      cuenta.ilegibles += 1
      const mensaje =
        'Había un pie de firma guardado en este navegador, pero no se ha podido leer y se ' +
        'ignora. Escríbelo otra vez y vuelve a marcar «Recordar» para reemplazarlo.'
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: registro })
      return {
        recordado: false,
        firma: vacia(),
        guardadoEn: null,
        motivo: MOTIVO_SIN_PIE.REGISTRO_ILEGIBLE,
        mensaje,
      }
    }

    cuenta.recuperados += 1
    return {
      recordado: true,
      firma: leido.firma,
      guardadoEn: leido.guardadoEn,
      motivo: null,
      mensaje: null,
    }
  }

  /**
   * **BORRA** el pie de firma guardado. Es lo que hace la casilla «Recordar» al
   * desmarcarse: no lo desactiva, no lo marca, lo borra (ver la cabecera).
   *
   * Borrar lo que no existe **no es un fallo**: `olvidado: true`, `habia: false`.
   * El estado final es el que se pedía, y decir «error» ahí obligaría a quien
   * llama a distinguir un caso que no le importa.
   *
   * Si el borrado falla, **el dato sigue ahí y se dice**: `olvidado: false` con
   * `ERROR_BORRADO`. Devolver `true` «para no molestar» sería prometerle a alguien
   * que sus datos se han ido cuando no se han ido, y eso es de lo peor que puede
   * hacer este fichero.
   *
   * @returns {Promise<ResultadoOlvidar>}
   */
  async function olvidar() {
    const db = await base()
    if (db === null) {
      // Sin base no hay nada guardado que borrar: el estado final ES el pedido.
      // Se devuelve `olvidado: true` con el motivo, para que el diálogo no tenga
      // que enseñar un fallo por algo que ha salido como el usuario quería.
      return {
        olvidado: true,
        habia: false,
        motivo: MOTIVO_SIN_PIE.SIN_BD,
        mensaje: mensajeSinBase,
      }
    }

    let habia = false
    try {
      // Se mira antes de borrar SOLO para poder contarlo (`habia`): «se ha
      // borrado» y «no había nada» son dos frases distintas en el diálogo. Un
      // fallo de esta lectura no impide borrar; se sigue con `habia: false`.
      habia = (await db.get(ALMACENES.PIE_FIRMA, CLAVE_PIE_FIRMA)) !== undefined
    } catch {
      habia = false
    }

    try {
      await db.delete(ALMACENES.PIE_FIRMA, CLAVE_PIE_FIRMA)
      cuenta.olvidados += 1
      return { olvidado: true, habia, motivo: null, mensaje: null }
    } catch (error) {
      cuenta.fallosBorrado += 1
      const mensaje =
        `No se ha podido borrar el pie de firma guardado en este navegador ` +
        `(${detalleDe(error)}). SIGUE GUARDADO. Puedes borrarlo desde los ajustes del ` +
        'navegador, en los datos de este sitio.'
      avisar(mensaje, { nivel: NIVEL.AVISO, causa: error })
      return { olvidado: false, habia, motivo: MOTIVO_SIN_PIE.ERROR_BORRADO, mensaje }
    }
  }

  /**
   * Fotografía de los contadores. Objeto nuevo en cada llamada: quien la guarde
   * conserva la foto y no una referencia que cambia sola.
   *
   * @returns {EstadoPieFirma}
   */
  function estado() {
    return { ...cuenta }
  }

  return { recordar, recuperar, olvidar, estado }
}

// derivacion/identidad.js — F17 · tarea 2.3 · QUIÉN ES cada parcela del
// expediente, en los términos del `inspireId`.
//
// Módulo PURO y hoja del grafo: no importa nada. Sin DOM, sin Leaflet, sin turf,
// sin red, sin estado y sin reloj.
//
// ── POR QUÉ ESTO NO VIVE EN `gml/` ──────────────────────────────────────────
// Porque en esta aplicación **`gml/` nunca decide identidad: la recibe**.
// `gml/serialize-cp.js` exige `refcat` y `namespaceInspire` como parámetros y su
// propio JSDoc dice que «este módulo no se la inventa»; `gml/ids.js#idsDeParcela`
// compone los cuatro `gml:id` a partir de lo que le dan. Quien decidía era
// `app/main.js`, con dos funciones y un comentario de cuarenta líneas, y eso ya era
// una capa de dominio metida dentro de la interfaz. F17 la necesita en un tercer
// sitio —la cesión— así que baja aquí, donde puede probarse sin `document`.
//
// ── LOS TRES CAMPOS SON **UNA** AFIRMACIÓN, NO TRES AJUSTES ─────────────────
// Es la trampa 2 de `spec/SPEC.md` §3.1, y esta aplicación cayó en ella hasta el
// 2026-07-27. La FAQ del Catastro («¿Cómo nombrar las parcelas dentro de un GML de
// parcela catastral?»):
//
//   · «Si la parcela está inscrita en las bases de datos de catastro […] el valor
//     del atributo identificativo localId será la referencia catastral y el valor
//     del atributo namespace empleado será ES.SDGC.CP.»
//   · «Si la parcela no existe en la base de datos de catastro se deberá emplear el
//     valor del atributo namespace ES.LOCAL.CP y un identificador unívoco dentro
//     del negocio jurídico.»
//
// La app venía poniendo la referencia catastral real como `localId` bajo
// `ES.LOCAL.CP`: decía a la vez «ésta es su referencia catastral» y «esta parcela
// no existe en el Catastro». No era una preferencia discutible, era una
// contradicción dentro del mismo elemento. Por eso estas funciones devuelven los
// TRES campos juntos y no hay ninguna que devuelva uno solo: para que no se puedan
// combinar mal.
//
// ── ⛔ LA CESIÓN, Y LA CONTRADICCIÓN QUE LA MEDICIÓN OBLIGA A ESCRIBIR ───────
// Leída la regla de arriba, una parcela segregada «debería» ir con
// `nationalCadastralReference` VACÍO: `ES.LOCAL.CP` afirma que no está en la base
// de datos, y una referencia catastral afirma que sí. Eso es lo que el comentario
// de `gml/serialize-cp.js` dedujo, y es una DEDUCCIÓN.
//
// ⭐ **Lo MEDIDO el 2026-08-03 fue otra cosa, y la medición manda (regla de oro 8):**
// el expediente que la Sede aceptó con IVG **positivo** (CSV `XMWPXCN9J8DB9J89`)
// llevaba la cesión con `localId` = `nationalCadastralReference` =
// `7136910UF1473N.1` bajo `ES.LOCAL.CP` — la referencia del padre SUFIJADA, no
// vacía. La Sede además **distingue** las dos: marca la matriz con una insignia
// `RC` y la segregada no. Override **O19**.
//
// ⚠️ Y lo que ese override NO dice, que es lo que impide convertirlo en una
// corrección: **que la forma con sufijo valga no dice que la vacía falle.** La
// forma vacía no se ha presentado nunca. Por eso `gml/serialize-cp.js` recibe una
// EXCEPCIÓN escrita y no un cambio de criterio, y por eso aquí se implementa lo
// medido y se deja dicho de dónde sale.
//
// ── EL SUFIJO ───────────────────────────────────────────────────────────────
// `padre` + `.` + ordinal empezando en 1, que es literalmente lo que se presentó.
// El ordinal es el número de orden de la pieza en la derivación, y de ahí viene la
// razón por la que ese orden es determinista por construcción
// (`derivacion/cesion.js`): si bailara entre corridas, bailaría el identificador de
// una finca en un papel que se firma, y nadie lo vería.

/**
 * Namespace INSPIRE de una parcela que SÍ está en la base de datos del Catastro.
 * Su pareja obligatoria es un `localId` que ES la referencia catastral.
 */
export const NAMESPACE_CATASTRO = 'ES.SDGC.CP'

/**
 * Namespace INSPIRE de una parcela que NO está en la base de datos del Catastro:
 * un alta de particular, o una pieza segregada que todavía no existe como finca.
 */
export const NAMESPACE_LOCAL = 'ES.LOCAL.CP'

/**
 * Lo que separa la referencia del padre del ordinal de la pieza. Un punto, que es
 * lo que llevaba el expediente aceptado (`7136910UF1473N.1`).
 */
export const SEPARADOR_SEGREGADA = '.'

/**
 * La identidad de una parcela en el `inspireId`, en la forma EXACTA que consumen
 * `gml/serialize-cp.js#serializarParcelaCp` y `serializarExpedienteCp`: se puede
 * esparcir tal cual sobre sus opciones.
 *
 * @typedef {Object} IdentidadInspire
 * @property {string} refcat  Lo que va en `<localId>` y es la base de los cuatro
 *   `gml:id`. NO es lo mismo que {@link IdentidadInspire.nationalCadastralReference}.
 * @property {string} namespaceInspire  {@link NAMESPACE_CATASTRO} o {@link NAMESPACE_LOCAL}.
 * @property {string} nationalCadastralReference  La referencia catastral OFICIAL.
 *   Vacía significa «esta finca no está inscrita»; rellenarla es afirmar que sí.
 */

/** Un texto utilizable como identidad: string con algo que no sea espacio. */
const util = (v) => typeof v === 'string' && v.trim().length > 0

/**
 * Identidad de la parcela que el usuario tiene delante — la MATRIZ del expediente.
 *
 * Dos casos, y son los dos párrafos de la FAQ:
 *   · **Con referencia catastral** (el caso normal de esta herramienta: el técnico
 *     descarga la cartografía de una finca que existe, corrige el lindero y la
 *     vuelve a subir) ⇒ `localId` = la referencia, namespace `ES.SDGC.CP`,
 *     `nationalCadastralReference` = la misma referencia.
 *   · **Sin ella** (un alta: parcela dibujada, DXF, TXT) ⇒ `localId` = el `idLocal`
 *     del modelo, namespace `ES.LOCAL.CP`, referencia VACÍA. Es el patrón de
 *     `UTM_1.gml`, el alta real de un particular que este proyecto tiene versionada.
 *
 * @param {object} args
 * @param {string|null} [args.refcat=null]  Referencia catastral, si consta.
 * @param {string|null} [args.idLocal=null]  Identificador interno del modelo.
 *   `model/parcela.js#crearParcela` lo exige, así que siempre hay uno.
 * @returns {IdentidadInspire}
 * @throws {TypeError} Si no hay NI referencia NI `idLocal`: una parcela sin ninguna
 *   de las dos no se puede nombrar, y el serializador lanzaría más tarde y más
 *   lejos. Aquí el mensaje todavía puede decir de qué parcela se trata.
 */
export function identidadDeParcela({ refcat = null, idLocal = null } = {}) {
  if (util(refcat)) {
    const rc = refcat.trim()
    return {
      refcat: rc,
      namespaceInspire: NAMESPACE_CATASTRO,
      nationalCadastralReference: rc,
    }
  }
  if (!util(idLocal)) {
    throw new TypeError(
      'identidadDeParcela: hace falta `refcat` o `idLocal`, y no ha llegado ninguno de los ' +
        'dos. El `<localId>` del inspireId no puede quedar vacío (el XSD no lo admite y es ' +
        'la base de los cuatro gml:id), y esta función no se inventa identidades.',
    )
  }
  return {
    refcat: idLocal.trim(),
    namespaceInspire: NAMESPACE_LOCAL,
    nationalCadastralReference: '',
  }
}

/**
 * Identidad de una pieza CEDIDA: el trozo que la matriz suelta y que el expediente
 * tiene que aportar como parcela propia.
 *
 * ⭐ **Implementa lo MEDIDO, no lo deducido** (override O19; ver la cabecera). Con
 * referencia del padre, los tres campos salen así:
 *
 *   `localId` = `nationalCadastralReference` = `«padre».«orden»`,
 *   namespace = `ES.LOCAL.CP`
 *
 * y sí, eso es a la vez «esta finca no está en la base de datos» y «su referencia
 * es ésta». La combinación **se presentó y obtuvo IVG positivo**; la alternativa
 * coherente sobre el papel —referencia vacía— **no se ha presentado nunca**. Entre
 * una deducción elegante y una medición, este proyecto se queda con la medición.
 *
 * Sin referencia del padre (la matriz también es un alta) la pieza no puede
 * heredar ninguna referencia, así que la suya va VACÍA y el `localId` se compone
 * sobre el `idLocal` del padre. Ese camino **no está medido**, y se dice.
 *
 * @param {object} args
 * @param {string|null} [args.refcatPadre=null]  Referencia catastral de la matriz.
 * @param {string|null} [args.idLocalPadre=null]  Su `idLocal`, para el caso de alta.
 * @param {number} args.orden  Ordinal de la pieza, entero ≥ 1. Es el `orden` de
 *   `derivacion/cesion.js#PiezaSobrante`, que es determinista por construcción.
 * @returns {IdentidadInspire}
 * @throws {TypeError}  Si no hay NI `refcatPadre` NI `idLocalPadre`.
 * @throws {RangeError} Si `orden` no es un entero ≥ 1. Un `0` daría `…N.0`, que no
 *   es lo que se presentó, y un `undefined` daría `…N.undefined` **sin protestar**:
 *   un identificador de finca con la palabra «undefined» dentro, en un fichero que
 *   se firma.
 */
export function identidadDeCesion({ refcatPadre = null, idLocalPadre = null, orden } = {}) {
  if (!Number.isInteger(orden) || orden < 1) {
    throw new RangeError(
      `identidadDeCesion: 'orden' debe ser un entero ≥ 1 (el ordinal de la pieza en la ` +
        `derivación); recibido ${JSON.stringify(orden)}.`,
    )
  }
  const padre = util(refcatPadre) ? refcatPadre.trim() : util(idLocalPadre) ? idLocalPadre.trim() : null
  if (padre === null) {
    throw new TypeError(
      'identidadDeCesion: hace falta `refcatPadre` o `idLocalPadre`. Una pieza cedida se ' +
        'nombra SIEMPRE a partir de la finca de la que sale: es lo que permite reconocer en ' +
        'la Sede que las dos parcelas del envío son la matriz y su segregada.',
    )
  }

  const localId = `${padre}${SEPARADOR_SEGREGADA}${orden}`
  return {
    refcat: localId,
    namespaceInspire: NAMESPACE_LOCAL,
    // Con referencia del padre, la MISMA cadena que el localId (O19, medido). Sin
    // ella no hay nada inscrito a lo que referirse, y rellenarlo con un `idLocal`
    // interno sería afirmar una inscripción que no existe.
    nationalCadastralReference: util(refcatPadre) ? localId : '',
  }
}

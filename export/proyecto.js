// export/proyecto.js — F10 · T3.2. EL FICHERO DE PROYECTO, para llevarse el trabajo.
//
// ── POR QUÉ EXISTE, SI YA HAY IndexedDB ────────────────────────────────────
// Es alcance NUEVO de F10: no está en la ficha de la fase, ni en `spec/SPEC.md`, ni
// en el dossier. Entra por una razón muy concreta, y conviene dejarla escrita porque
// nadie la va a deducir del código: **IndexedDB, sin backend y sin cuentas, es una
// caja fuerte sin puerta**. Lo que se guarda ahí vive en ESTE navegador y en ESTE
// equipo; borrar los datos del sitio se lo lleva todo, un desalojo por espacio también
// —`navigator.storage.persist()` devuelve `false`, medido en la fase 0—, y no hay
// forma de mandarle un expediente a un compañero, de pasarlo al portátil, ni de
// guardarlo en la copia de seguridad de la empresa.
//
// El fichero de proyecto es esa puerta. Es también la respuesta honrada a la
// advertencia que `storage/expedientes.js` obliga a enseñar en la interfaz: «para
// conservar un trabajo con seguridad, expórtalo a un fichero».
//
// ── EL FORMATO ES EL EXPEDIENTE MÁS UN SOBRE. NO SE INVENTA NADA ───────────
//
//     {
//       "formato": "concreta-gml/proyecto",
//       "version": 1,
//       "generado": "2026-08-03T09:45:12.000Z",
//       "nombre": "Linde norte",
//       "expediente": { "tipo": …, "srs": …, "metadatos": …, "parcela": …, "edificio": … }
//     }
//
// El `expediente` es LITERALMENTE lo que devuelve `model/parcela.js#crearExpediente`,
// sin una clave de más ni de menos. Es POJO plano desde F00 —regla de oro 4, escrita
// para que `structuredClone` copiase el modelo en el undo/redo— y resulta que un POJO
// plano es exactamente lo que `JSON.stringify` sabe escribir sin perder nada. La
// decisión ya estaba tomada, para otra cosa, hace meses.
//
// Inventarle una forma propia al fichero tendría el problema de siempre: dos
// representaciones del mismo dato que hay que mantener sincronizadas, y la que se
// desincroniza es la que nadie mira. **La única forma buena es la que el modelo ya
// tiene.**
//
// El sobre lleva las cuatro cosas que el expediente NO puede saber de sí mismo: de qué
// programa salió (`formato`), con qué versión del formato se escribió (`version`),
// cuándo (`generado`) y con qué rótulo lo tenía guardado el usuario (`nombre`).
//
// ── LEER UN FICHERO AJENO NO PUEDE REVENTAR NUNCA. ES LA LECCIÓN DE F08 ────
// {@link deProyecto} **no lanza jamás** por causa del contenido: ni con un JSON roto,
// ni con un fichero de otro programa, ni con un `expediente` a medias, ni con una
// versión del futuro. Todo sale como `{ok: false, motivo, mensaje}` con el motivo en
// castellano, o como `{ok: true, …, avisos: […]}` cuando se pudo leer pero hubo algo
// que contar. Es exactamente la frontera de `comprobacion/gml.js`, y por lo mismo: el
// fichero lo elige el usuario, así que un contenido raro es un DATO, no un error de
// programación. Lo único que lanza aquí es {@link aProyecto}, y solo con un expediente
// que el propio modelo rechaza — porque escribir un fichero inválido para que lo abra
// otra persona sí es un fallo nuestro.
//
// ── TOLERANTE, PERO NO CRÉDULO ────────────────────────────────────────────
// «Tolerante» no significa «acepta cualquier cosa que se le parezca». Se exige el
// `formato`, y un fichero sin él se rechaza CON una frase que dice qué se ha
// encontrado en su lugar —incluso si parece un GML, que es el error de bulto más
// probable cuando hay dos entradas de fichero en la misma pantalla—. Aceptar «lo que
// tenga un campo parcela» sería tragarse ficheros de otros programas y presentarlos
// como si fueran nuestros.
//
// Lo que sí se tolera, y se DECLARA (regla de oro 1):
//   · una **versión posterior** a la que este código conoce: se lee igual, porque el
//     sobre es estable y una versión nueva lo más probable es que añada claves, no que
//     cambie las que hay. Pero se avisa, y con la cifra;
//   · una **clave desconocida**, en el sobre o dentro del expediente: se ignora al
//     construir el modelo y se dice CUÁL. Una clave que se cae en silencio es trabajo
//     de alguien que desaparece;
//   · un expediente de **EDIFICIO**: se lee —el modelo lo admite desde F00— y se avisa
//     de lo que la aplicación sabe y no sabe hacer con él. ⚠️ **Ese aviso cambió en
//     F11** y no es un retoque de estilo: hasta F10 decía «esta versión solo sabe
//     enseñar y editar la rama de parcela», y desde que F11 aterriza eso es FALSO —la
//     rama de edificio existe, se dibuja y se edita—. Lo que sigue sin poder hacerse es
//     **guardarlo en el almacén de este navegador** (un `Edificio` no tiene `idLocal`,
//     desviación 6 del plan de F11), escribir su GML (F13) y contrastarlo (F14). Un
//     aviso que se queda viejo es peor que no tenerlo: el usuario decide con él.
//
// ── LO QUE NO VIAJA EN EL FICHERO ─────────────────────────────────────────
// Lo mismo que no se guarda en IndexedDB, y por los mismos motivos escritos: el
// historial de deshacer (`edit/historial.js` lo declara no serializable), las
// colindantes (caché del Catastro, se vuelven a pedir), el diagnóstico y el informe
// (se recalculan), y el pie de firma (tiene su almacén y su política de borrado). La
// lista redactada vive en `storage/expedientes.js#NO_SE_GUARDA` y la enseña el diálogo;
// **aquí no se copia** para que no haya dos versiones que puedan divergir, y `export/`
// no importa de `storage/` porque es la capa de abajo de la de arriba.
//
// ── EL RELOJ NO SE LEE AQUÍ ───────────────────────────────────────────────
// `fecha` entra por parámetro, igual que en `export/coordenadas.js`, en todo `gml/` y
// en todo `report/`. Un fichero exportado es un snapshot: su prueba tiene que valer
// igual dentro de un año.

import { SRS_VALIDOS, TIPO_EXPEDIENTE, crearExpediente } from '../model/parcela.js'
import { SEVERIDAD, TIPO_EXPORT, crearDeteccionExport, resumirDetecciones } from './_comun.js'

// ── Identidad del formato ────────────────────────────────────────────────────

/**
 * La marca del sobre. Lleva el nombre del programa y una barra, como un tipo MIME de
 * subformato, para que sea reconocible de un vistazo al abrir el JSON en un editor y
 * para que no colisione con el `formato` de ningún otro fichero.
 *
 * @readonly
 */
export const FORMATO_PROYECTO = 'concreta-gml/proyecto'

/**
 * Versión del FORMATO DEL FICHERO. No es la versión de la aplicación ni la de la base
 * de datos (`storage/bd.js#VERSION_BD`, que va por su cuenta y por otra escalera): un
 * fichero que salió de aquí tiene que poder abrirse dentro de dos años sin que le
 * importe qué versión de la app lo escribió.
 *
 * Sube cuando cambie la FORMA de lo que se escribe. Añadir una clave que los lectores
 * viejos puedan ignorar no obliga a subirla —para eso está {@link TIPO_EXPORT}`.CLAVE_DESCONOCIDA`—;
 * cambiar el significado de una que ya existe, sí.
 *
 * @readonly
 */
export const VERSION_PROYECTO = 1

/**
 * Las claves que este código conoce del SOBRE. Cualquier otra se declara como
 * {@link TIPO_EXPORT}`.CLAVE_DESCONOCIDA` en vez de caerse en silencio.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLAVES_SOBRE = Object.freeze(['formato', 'version', 'generado', 'nombre', 'expediente'])

/**
 * Las claves que este código conoce del EXPEDIENTE. Se derivan de lo que
 * `crearExpediente` devuelve, no se escriben a ojo — si el modelo crece, esta lista
 * crece con él y el lector deja de avisar de una clave que ya sí entiende.
 *
 * ⚠️ Sí, esto construye un expediente vacío al cargar el módulo y se queda solo con
 * sus nombres de campo. Es barato (no toca red, ni disco, ni DOM) y es la única forma
 * de que la lista no pueda desincronizarse del modelo. El expediente que se fabrica se
 * tira: de él no se lee ni un valor, solo la FORMA.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CLAVES_EXPEDIENTE = Object.freeze(Object.keys(crearExpediente()))

// ── Degradación ──────────────────────────────────────────────────────────────

/**
 * Por qué un fichero no se ha podido abrir. Códigos estables, para que la interfaz
 * decida sin leerle el texto al `mensaje` (mismo criterio que `MOTIVO_EXPEDIENTES` y
 * que `MOTIVO_SIN_PIE`).
 *
 * @readonly
 */
export const MOTIVO_PROYECTO = Object.freeze({
  /** El texto no es JSON. Fichero truncado, binario, o de otra cosa. */
  NO_ES_JSON: 'NO_ES_JSON',
  /** Es JSON, pero no un objeto: un array, un número, `null`. */
  NO_ES_OBJETO: 'NO_ES_OBJETO',
  /** Es un objeto JSON, pero no lleva nuestra marca de formato. */
  OTRO_FORMATO: 'OTRO_FORMATO',
  /** Lleva la marca, pero no trae `expediente`. */
  SIN_EXPEDIENTE: 'SIN_EXPEDIENTE',
  /** El sistema de referencia no es uno de los que esta aplicación sabe dibujar. */
  SRS_NO_SOPORTADO: 'SRS_NO_SOPORTADO',
  /** Trae expediente, pero el modelo lo rechaza. El motivo del modelo va dentro. */
  EXPEDIENTE_ILEGIBLE: 'EXPEDIENTE_ILEGIBLE',
})

// ── Utilidades ───────────────────────────────────────────────────────────────

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Describe un valor para un mensaje, sin reventar con los cíclicos ni los enormes. */
function describir(valor) {
  if (valor === null) return 'null'
  if (Array.isArray(valor)) return `una lista de ${valor.length} elemento(s)`
  if (typeof valor === 'string') return `un texto de ${valor.length} caracteres`
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

/** Texto corto de un fallo. Misma forma que el resto del repo. */
const detalleDe = (error) => (error && error.name ? `${error.name}: ${error.message}` : String(error))

/**
 * Las claves de `objeto` que no están en `conocidas`, como detección. Se llama para el
 * sobre y para el expediente, con la misma frase y distinto sitio.
 *
 * @param {object} objeto
 * @param {readonly string[]} conocidas
 * @param {string} donde  Dónde se encontraron, para el mensaje.
 * @returns {import('./_comun.js').DeteccionExport[]}
 */
function clavesDesconocidas(objeto, conocidas, donde) {
  const extras = Object.keys(objeto).filter((k) => !conocidas.includes(k))
  if (extras.length === 0) return []
  return [
    crearDeteccionExport(
      TIPO_EXPORT.CLAVE_DESCONOCIDA,
      `El fichero trae ${extras.length === 1 ? 'un dato' : `${extras.length} datos`} en ${donde} que ` +
        `esta versión de la aplicación no sabe interpretar (${extras.join(', ')}). No se ` +
        'pierde nada de lo que sí entiende, pero eso no se ha cargado. Lo más probable es que ' +
        'el fichero lo escribiera una versión más nueva.',
      SEVERIDAD.AVISO,
      { donde, claves: extras },
    ),
  ]
}

// ── Typedefs ─────────────────────────────────────────────────────────────────

/** @typedef {import('./_comun.js').DeteccionExport} DeteccionExport */

/**
 * El POJO que se serializa a JSON.
 *
 * @typedef {Object} Proyecto
 * @property {string} formato  {@link FORMATO_PROYECTO}.
 * @property {number} version  {@link VERSION_PROYECTO}.
 * @property {string} generado  ISO 8601 del instante de exportación.
 * @property {string|null} nombre  Rótulo con el que estaba guardado, si lo había.
 * @property {object} expediente  El Expediente de `model/parcela.js`, tal cual.
 */

/**
 * @typedef {Object} ResultadoProyecto
 * @property {boolean} ok
 * @property {object|null} expediente  **Revalidado** por `crearExpediente`, con la
 *   geometría oficial congelada otra vez. `null` si no se pudo leer.
 * @property {string|null} nombre  El rótulo que traía el fichero, o `null`.
 * @property {string|null} generado  Cuándo se exportó, tal como lo puso quien exportó.
 * @property {number|null} version  La versión que DECLARA el fichero, no la nuestra.
 * @property {string|null} motivo  Clave de {@link MOTIVO_PROYECTO}.
 * @property {string|null} mensaje  En castellano, listo para enseñar.
 * @property {DeteccionExport[]} avisos  Lo que se pudo leer pero hay que contar.
 * @property {{total: number, porTipo: Record<string, number>, porSeveridad: Record<string, number>}} resumen
 */

// ── Escribir ─────────────────────────────────────────────────────────────────

/**
 * Compone el POJO del fichero de proyecto a partir de un expediente.
 *
 * Devuelve el objeto y **no la cadena**: quien serializa elige la indentación —el
 * cableado usa dos espacios, para que un humano pueda abrir el fichero y leerlo— y
 * así el test puede afirmar sobre la estructura sin volver a parsear su propio JSON.
 *
 * **El expediente se pasa por `crearExpediente` antes de escribirlo.** Es a propósito
 * y es la misma disciplina que `storage/expedientes.js#guardar`: lo que sale por la
 * puerta hacia otra persona o hacia otro equipo tiene que estar validado aquí, porque
 * al otro lado no habrá nadie a quien preguntarle. Un expediente que el modelo rechaza
 * **lanza**: escribir un fichero inválido no es degradación del entorno, es un fallo
 * nuestro (SPEC §2.1).
 *
 * @param {object} expediente  Un Expediente de `model/parcela.js`.
 * @param {object} opciones
 * @param {Date} opciones.fecha  Instante de la exportación. **Obligatorio y por
 *   parámetro**: este módulo no consulta el reloj.
 * @param {string|null} [opciones.nombre=null]  Rótulo con el que estaba guardado.
 * @returns {Proyecto}
 * @throws {TypeError|RangeError}  Lo que lance `crearExpediente`, y además: `fecha`
 *   que no es una fecha o es inválida, `nombre` que no es texto ni `null`.
 */
export function aProyecto(expediente, opciones = {}) {
  if (!esObjeto(opciones)) {
    throw new TypeError(`aProyecto: 'opciones' debe ser un objeto {fecha, nombre}; recibido ${describir(opciones)}.`)
  }
  const { fecha, nombre = null } = opciones
  if (!(fecha instanceof Date)) {
    throw new TypeError(
      `aProyecto: 'fecha' debe ser una fecha; recibido ${describir(fecha)}. El fichero no ` +
        'consulta el reloj: la fecha entra por parámetro.',
    )
  }
  if (!Number.isFinite(fecha.getTime())) {
    throw new RangeError("aProyecto: 'fecha' es inválida (tiempo no finito).")
  }
  if (nombre !== null && typeof nombre !== 'string') {
    throw new TypeError(`aProyecto: 'nombre' debe ser un texto o null; recibido ${describir(nombre)}.`)
  }

  const normal = crearExpediente({
    tipo: expediente?.tipo,
    srs: expediente?.srs,
    metadatos: expediente?.metadatos ?? undefined,
    parcela: expediente?.parcela ?? null,
    edificio: expediente?.edificio ?? null,
  })

  return {
    formato: FORMATO_PROYECTO,
    version: VERSION_PROYECTO,
    generado: fecha.toISOString(),
    nombre: nombre !== null && nombre.trim() !== '' ? nombre.trim() : null,
    expediente: normal,
  }
}

// ── Leer ─────────────────────────────────────────────────────────────────────

/** Un rechazo, con la forma completa de {@link ResultadoProyecto}. */
function rechazo(motivo, mensaje, avisos = []) {
  return {
    ok: false,
    expediente: null,
    nombre: null,
    generado: null,
    version: null,
    motivo,
    mensaje,
    avisos,
    resumen: resumirDetecciones(avisos),
  }
}

/**
 * Lee un fichero de proyecto. **Nunca lanza por el contenido del fichero.**
 *
 * ```js
 * const r = deProyecto(await file.text())
 * if (!r.ok) enseñarError(r.mensaje)         // con su motivo estable en `r.motivo`
 * else { cargar(r.expediente); enseñarAvisos(r.avisos) }
 * ```
 *
 * @param {string|object} entrada  El texto del fichero, o el objeto ya parseado (que
 *   es lo que hace cómodo el test y lo que permite reusar esto desde el portapapeles).
 * @returns {ResultadoProyecto}
 * @throws {TypeError}  Solo si `entrada` no es ni texto ni objeto: eso no es un
 *   fichero raro del usuario, es una llamada mal hecha.
 */
export function deProyecto(entrada) {
  if (typeof entrada !== 'string' && !esObjeto(entrada)) {
    throw new TypeError(
      `deProyecto: 'entrada' debe ser el texto del fichero o el objeto ya parseado; ` +
        `recibido ${describir(entrada)}.`,
    )
  }

  // ── 1 · JSON ──────────────────────────────────────────────────────────────
  let crudo = entrada
  if (typeof entrada === 'string') {
    // La pista se da ANTES de intentar el parseo, porque el mensaje de `JSON.parse`
    // («Unexpected token <») no le dice nada a nadie. Soltar un GML en la entrada del
    // proyecto es el error más probable habiendo dos entradas de fichero en la misma
    // pantalla, y decirlo cuesta una línea.
    if (entrada.trimStart().startsWith('<')) {
      return rechazo(
        MOTIVO_PROYECTO.NO_ES_JSON,
        'Esto no es un fichero de proyecto: parece un fichero XML o GML. Si quieres comprobar ' +
          'un GML del Catastro, usa «Abrir un GML…» en el origen de la parcela.',
      )
    }
    try {
      crudo = JSON.parse(entrada)
    } catch (error) {
      return rechazo(
        MOTIVO_PROYECTO.NO_ES_JSON,
        `El fichero no se ha podido leer como JSON (${detalleDe(error)}). Puede estar incompleto, ` +
          'o no ser un fichero de proyecto de esta aplicación.',
      )
    }
  }

  if (!esObjeto(crudo)) {
    return rechazo(
      MOTIVO_PROYECTO.NO_ES_OBJETO,
      `El fichero es JSON válido, pero su contenido es ${describir(crudo)} y un proyecto tiene ` +
        'que ser un objeto.',
    )
  }

  // ── 2 · ¿es nuestro? ──────────────────────────────────────────────────────
  if (crudo.formato !== FORMATO_PROYECTO) {
    const queTrae =
      crudo.formato === undefined
        ? 'no dice de qué formato es'
        : `dice ser de formato «${String(crudo.formato)}»`
    return rechazo(
      MOTIVO_PROYECTO.OTRO_FORMATO,
      `Este fichero ${queTrae}, así que no es un proyecto de esta aplicación (se esperaba ` +
        `«${FORMATO_PROYECTO}»). No se abre a medias a propósito: cargar el contenido de un ` +
        'fichero de otro programa como si fuera tuyo es peor que no abrirlo.',
    )
  }

  /** @type {DeteccionExport[]} */
  const avisos = []

  // ── 3 · la versión ────────────────────────────────────────────────────────
  const version = crudo.version
  if (typeof version === 'number' && Number.isFinite(version)) {
    if (version > VERSION_PROYECTO) {
      avisos.push(
        crearDeteccionExport(
          TIPO_EXPORT.VERSION_POSTERIOR,
          `El fichero se escribió con la versión ${version} del formato y esta aplicación conoce ` +
            `la ${VERSION_PROYECTO}. Se abre igual, porque el sobre no ha cambiado, pero si trae ` +
            'algo que aquí todavía no existe no se cargará. Conviene actualizar la aplicación.',
          SEVERIDAD.AVISO,
          { version, conocida: VERSION_PROYECTO },
        ),
      )
    }
  } else {
    avisos.push(
      crearDeteccionExport(
        TIPO_EXPORT.VERSION_POSTERIOR,
        `El fichero no declara una versión de formato utilizable (${describir(version)}). Se lee ` +
          `como si fuera de la versión ${VERSION_PROYECTO}, que es la que esta aplicación escribe.`,
        SEVERIDAD.AVISO,
        { version: null, conocida: VERSION_PROYECTO },
      ),
    )
  }

  avisos.push(...clavesDesconocidas(crudo, CLAVES_SOBRE, 'la cabecera del fichero'))

  // ── 4 · el expediente ─────────────────────────────────────────────────────
  const guardado = crudo.expediente
  if (!esObjeto(guardado)) {
    return rechazo(
      MOTIVO_PROYECTO.SIN_EXPEDIENTE,
      `El fichero lleva la marca de un proyecto de esta aplicación, pero no trae el expediente ` +
        `dentro (se ha encontrado ${describir(guardado)} donde debía ir). Puede que se guardara ` +
        'a medias.',
      avisos,
    )
  }

  avisos.push(...clavesDesconocidas(guardado, CLAVES_EXPEDIENTE, 'el expediente'))

  // El SRS se comprueba aquí, antes de `crearExpediente`, para poder decir CUÁL es el
  // que no vale y cuáles sí. `crearExpediente` también lo rechaza, pero con el
  // mensaje genérico del modelo, y aquí el fichero lo eligió el usuario.
  if (guardado.srs !== undefined && !SRS_VALIDOS.includes(guardado.srs)) {
    return rechazo(
      MOTIVO_PROYECTO.SRS_NO_SOPORTADO,
      `El expediente está en el sistema de referencia «${String(guardado.srs)}», que esta ` +
        `aplicación no sabe dibujar (admite ${SRS_VALIDOS.join(', ')}). No se abre en otro huso: ` +
        'la geometría saldría en el sitio equivocado sin que nada lo indicara.',
      avisos,
    )
  }

  let expediente
  try {
    expediente = crearExpediente({
      tipo: guardado.tipo,
      srs: guardado.srs,
      metadatos: guardado.metadatos ?? undefined,
      parcela: guardado.parcela ?? null,
      edificio: guardado.edificio ?? null,
    })
  } catch (error) {
    return rechazo(
      MOTIVO_PROYECTO.EXPEDIENTE_ILEGIBLE,
      `El expediente del fichero no tiene la forma que espera esta aplicación: ${detalleDe(error)}`,
      avisos,
    )
  }

  // La rama EDIFICIO se lee —el modelo la admite desde F00— y se dice QUÉ se va a poder
  // hacer con ella y qué no. Callarlo dejaría al usuario suponiendo (regla de oro 1).
  //
  // ⛔ **Reescrito en F11 · T3.3.** El texto de F10 —«esta versión de la aplicación solo
  // sabe enseñar y editar la rama de parcela»— dejó de ser cierto el día que aterrizó la
  // segunda rama: hoy el fichero se abre EN la rama de edificio, sus partes se dibujan en
  // el mapa y sus datos se editan. Lo que sigue sin poder hacerse son tres cosas
  // concretas, y las tres se nombran: **guardarlo en el almacén de este navegador**
  // —`app/cableado-expediente.js` deriva la identidad del documento de `parcela.idLocal`
  // y un `Edificio` no tiene ninguno—, escribir su GML (F13) y contrastarlo (F14).
  //
  // ⚠️ El tipo sigue siendo `VERSION_POSTERIOR` y **no es el nombre que le pega**: esto
  // no habla de la versión del formato. `TIPO_EXPORT` vive en `export/_comun.js`, que
  // F11 · T3.3 no toca, así que darle código propio es deuda declarada y no un olvido.
  // Quien decida por CÓDIGO en vez de por texto —que es para lo que están los códigos—
  // tiene `datos.tipo === 'EDIFICIO'`, que sí lo distingue sin ambigüedad.
  if (expediente.tipo === TIPO_EXPEDIENTE.EDIFICIO) {
    avisos.push(
      crearDeteccionExport(
        TIPO_EXPORT.VERSION_POSTERIOR,
        'El fichero trae un expediente de EDIFICIO. Se ha leído entero y no se ha perdido nada: ' +
          'la aplicación lo abre en la rama Edificio, dibuja sus partes en el mapa y deja editar ' +
          'sus datos. Lo que esta versión todavía no hace es guardarlo en el almacén de este ' +
          'navegador —de momento solo se conserva en el fichero de proyecto—, escribir su GML ' +
          'ni contrastarlo con el Catastro.',
        SEVERIDAD.AVISO,
        { tipo: expediente.tipo },
      ),
    )
  }

  return {
    ok: true,
    expediente,
    nombre: typeof crudo.nombre === 'string' && crudo.nombre.trim() !== '' ? crudo.nombre.trim() : null,
    generado: typeof crudo.generado === 'string' ? crudo.generado : null,
    version: typeof version === 'number' && Number.isFinite(version) ? version : null,
    motivo: null,
    mensaje: null,
    avisos,
    resumen: resumirDetecciones(avisos),
  }
}

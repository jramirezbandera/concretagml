// export/_comun.js — F10 · T2.2. El vocabulario compartido de la capa de SALIDA.
//
// Estrena el directorio `export/`, que el mapa de ficheros de `spec/SPEC.md` §5
// llevaba reservado desde el día 1. Aquí viven las tres salidas que no son el GML:
// el DXF para el CAD (`dxf.js`), el listado de coordenadas (`coordenadas.js`) y el
// fichero de proyecto (`proyecto.js`).
//
// ── QUÉ ES ESTA CAPA, Y QUÉ NO ──────────────────────────────────────────────
// Todo lo de `export/` es **puro**: entra geometría del modelo en UTM, sale una
// cadena de texto. Ni `Blob`, ni `document`, ni `URL.createObjectURL`, ni red, ni
// reloj —la fecha se INYECTA, misma regla que `gml/` y `report/` y por lo mismo:
// un snapshot tiene que valer igual dentro de un año—. La ENTREGA del fichero es de
// `gml/descargar.js`, que es impuro y por eso está vetado en el barrel raíz.
//
// Consecuencia práctica: `export/` **sí** sale por el barrel (`index.js`), al
// contrario que `storage/`.
//
// ── POR QUÉ UN LÉXICO DE DETECCIONES PROPIO ─────────────────────────────────
// Es la tercera vez que este proyecto hace lo mismo, y por el mismo motivo escrito
// en `gml/_comun.js`: `parsers/_comun.js` tiene su `TIPO_DETECCION` con
// `ARCO_DISCRETIZADO` y el tokenizador de LIST/TXT dentro; `gml/_comun.js` tiene su
// `TIPO_GML` con el orden del XSD. Importar cualquiera de los dos metería su rama
// entera en el grafo de dependencias de un escritor de DXF, que no tiene nada que
// ver con ninguna de las dos.
//
// Lo que **sí** se conserva es la FORMA —`{tipo, mensaje, severidad, datos?}`— para
// que la interfaz pinte las tres con el mismo componente y sin adaptador. Lo que
// cambia es el catálogo.

// ── Severidad ────────────────────────────────────────────────────────────────

/**
 * Severidad de una detección. Las mismas tres cadenas que `parsers/_comun.js` y
 * `gml/_comun.js`, repetidas y no importadas por el motivo de la cabecera.
 *
 * @readonly
 */
export const SEVERIDAD = Object.freeze({
  INFO: 'INFO',
  AVISO: 'AVISO',
  ERROR: 'ERROR',
})

// ── Tipos ────────────────────────────────────────────────────────────────────

/**
 * Tipos de detección de la capa de salida. Vocabulario completo desde ya —aunque
 * en T2.2 solo emita el DXF— para que los tres escritores hablen el mismo idioma.
 *
 * @readonly
 */
export const TIPO_EXPORT = Object.freeze({
  // ── Comunes a las tres salidas ────────────────────────────────────────────
  /** Se pidió una capa/bloque y no había geometría que poner en él. */
  CAPA_VACIA: 'CAPA_VACIA',
  /**
   * La parcela no trae `geometriaOficial`. **No es un fallo**: es el caso de una
   * parcela que vino de un DXF, de un TXT o de un GML ajeno y nunca se contrastó
   * con el Catastro. El fichero sale con una capa en vez de dos, y lo dice.
   */
  SIN_GEOMETRIA_OFICIAL: 'SIN_GEOMETRIA_OFICIAL',
  /** Dos vértices se funden al redondear a la precisión de salida. */
  COLAPSO_POR_REDONDEO: 'COLAPSO_POR_REDONDEO',
  /** Un anillo se queda con menos de 3 vértices y no se emite. */
  ANILLO_DESCARTADO: 'ANILLO_DESCARTADO',

  // ── Del DXF ───────────────────────────────────────────────────────────────
  /**
   * Un hueco sale como polilínea cerrada propia, en la misma capa que su
   * exterior. **El DXF no tiene el concepto de «hueco»**: quien abra el fichero
   * verá dos contornos y tendrá que saber cuál está dentro de cuál. Se declara
   * porque callarlo sería dejar que el usuario deduzca mal una superficie.
   */
  HUECO_EXPORTADO: 'HUECO_EXPORTADO',

  // ── Del fichero de proyecto (F10 · T3.2) ──────────────────────────────────
  /** El fichero declara una versión de formato posterior a la que se conoce. */
  VERSION_POSTERIOR: 'VERSION_POSTERIOR',
  /** El fichero trae una clave que esta versión no sabe interpretar. */
  CLAVE_DESCONOCIDA: 'CLAVE_DESCONOCIDA',
})

// ── Factory ──────────────────────────────────────────────────────────────────

/**
 * Una detección de la capa de salida. POJO plano, misma forma que las de
 * `parsers/` y `gml/`.
 *
 * @typedef {Object} DeteccionExport
 * @property {string} tipo  Una de las claves de {@link TIPO_EXPORT}.
 * @property {string} mensaje  Texto legible en español, para la interfaz.
 * @property {'INFO'|'AVISO'|'ERROR'} severidad
 * @property {object} [datos]  Datos estructurados opcionales.
 */

/**
 * Crea una {@link DeteccionExport} validando `tipo` y `severidad`. **LANZA** si
 * cualquiera es inválido: una detección con un tipo que la interfaz no sabe
 * interpretar es una detección muda, que es lo que la regla de oro 1 prohíbe.
 *
 * @param {string} tipo
 * @param {string} mensaje
 * @param {'INFO'|'AVISO'|'ERROR'} severidad
 * @param {object} [datos]
 * @returns {DeteccionExport}
 * @throws {RangeError}  Si `tipo` o `severidad` no están en el catálogo.
 * @throws {TypeError}   Si `mensaje` no es un texto no vacío.
 */
export function crearDeteccionExport(tipo, mensaje, severidad, datos) {
  const tiposValidos = Object.values(TIPO_EXPORT)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearDeteccionExport: 'tipo' inválido: ${JSON.stringify(tipo)}. ` +
        `Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  const sevsValidas = Object.values(SEVERIDAD)
  if (!sevsValidas.includes(severidad)) {
    throw new RangeError(
      `crearDeteccionExport: 'severidad' inválida: ${JSON.stringify(severidad)}. ` +
        `Válidas: ${sevsValidas.join(', ')}.`,
    )
  }
  if (typeof mensaje !== 'string' || mensaje.length === 0) {
    throw new TypeError(
      `crearDeteccionExport: 'mensaje' debe ser un texto no vacío; recibido ${JSON.stringify(mensaje)}.`,
    )
  }
  const d = { tipo, mensaje, severidad }
  if (datos !== undefined) d.datos = datos
  return d
}

/**
 * Recuento de detecciones por tipo y por severidad. Misma forma que el `resumen`
 * de `gml/serialize-cp.js`, para que la interfaz no tenga dos maneras de contar
 * lo mismo.
 *
 * @param {readonly DeteccionExport[]} detecciones
 * @returns {{total: number, porTipo: Record<string, number>, porSeveridad: Record<string, number>}}
 */
export function resumirDetecciones(detecciones) {
  const porTipo = {}
  const porSeveridad = {}
  for (const d of detecciones) {
    porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + 1
    porSeveridad[d.severidad] = (porSeveridad[d.severidad] ?? 0) + 1
  }
  return { total: detecciones.length, porTipo, porSeveridad }
}

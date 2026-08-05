// derivacion/_comun.js — F17 · El vocabulario de la capa que DERIVA geometría.
//
// Contrato **D** del proyecto, quinta copia: `{tipo, mensaje, severidad, datos?}`,
// exactamente la misma forma que `parsers/_comun.js`, `gml/_comun.js`,
// `export/_comun.js` y `edificio/_comun.js`. La interfaz pinta las cinco con el
// mismo componente y sin adaptador.
//
// ── POR QUÉ UNA QUINTA COPIA Y NO UN MÓDULO COMPARTIDO ──────────────────────
// La pregunta se hizo al planear F17 y la respuesta sigue siendo la de F01: el
// léxico de TIPOS es lo que impide que una detección de una capa se cuele en otra.
// `crearDeteccionDerivacion('HUECO_EXPORTADO', …)` es un `RangeError` hoy, y con un
// `TIPO_DETECCION` común sería un mensaje que la interfaz no sabe interpretar
// —mudo, que es lo que prohíbe la regla de oro 1—.
//
// Lo que SÍ se duplica sin ganancia es `SEVERIDAD` y la validación de la fábrica.
// F17 no las extrae, y la razón está medida en el plan: sacar el contrato común
// metería `parsers/`, `gml/`, `export/` y `edificio/` —con sus cuatro suites— en un
// diff que va de restar polígonos. **Lo que sí entra es el guardián**: un test que
// ata las cinco copias (mismos `SEVERIDAD`, mismo rechazo ante entrada mala), que
// compra la protección sin el refactor. Hasta hoy había cuatro fábricas copiadas a
// mano y nada que las comparase.
//
// Módulo PURO: sin DOM, sin Leaflet, sin turf, sin estado y sin reloj.

// ── Severidad ────────────────────────────────────────────────────────────────

/**
 * Severidad de una detección. Misma escala que las otras cuatro capas: `INFO` no
 * cambia nada, `AVISO` pide mirar, `ERROR` bloquea. La duplicación está razonada
 * en la cabecera y la vigila `test/contrato.test.js`.
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
 * Tipos de detección de la capa de DERIVACIÓN. Vocabulario completo desde ya,
 * aunque la tarea 1.2 solo emita los tres primeros: `cesion.js` (2.1) y
 * `entrega.js` (3.1) hablan este mismo idioma, igual que hicieron los cuatro
 * léxicos anteriores.
 *
 * @readonly
 */
export const TIPO_DERIVACION = Object.freeze({
  /** El motor booleano LANZÓ con una geometría que no pudo digerir. */
  RESTA_FALLIDA: 'RESTA_FALLIDA',
  /** Una región no se pudo construir: faltaba exterior o venía degenerada. */
  REGION_NO_APTA: 'REGION_NO_APTA',
  /** La resta salió vacía: no hay sobrante. NO es un error, es una respuesta. */
  SIN_SOBRANTE: 'SIN_SOBRANTE',
  /** Una pieza cae por debajo del umbral de grosor: se LISTA, no se descarta sola. */
  PIEZA_ESTRECHA: 'PIEZA_ESTRECHA',
  /** La parcela editada NO está contenida en la oficial: la puerta de la fase 1. */
  CRECE_FUERA: 'CRECE_FUERA',
  /** No hay `geometriaOficial` contra la que restar (dibujo a mano, DXF, TXT). */
  SIN_GEOMETRIA_OFICIAL: 'SIN_GEOMETRIA_OFICIAL',
})

/**
 * Por qué una resta no se pudo medir. Los valores de `saltados[i].motivo` que
 * añade ESTA capa; los de construcción de región vienen tal cual de
 * `geo/poligono.js#MOTIVO_REGION` y no se renombran, porque son el mismo hecho.
 *
 * @readonly
 */
export const MOTIVO_RESTA = Object.freeze({
  /** `@turf/difference` lanzó. Sale por aquí, NUNCA por la consola. */
  MOTOR_BOOLEANO: 'MOTOR_BOOLEANO',
})

// ── Detección ────────────────────────────────────────────────────────────────

/**
 * Una detección de la capa de derivación. POJO plano, misma forma que las de
 * `parsers/`, `gml/`, `export/` y `edificio/`.
 *
 * @typedef {Object} DeteccionDerivacion
 * @property {string} tipo  Una de las claves de {@link TIPO_DERIVACION}.
 * @property {string} mensaje  Texto legible en español, para la interfaz.
 * @property {'INFO'|'AVISO'|'ERROR'} severidad  Ver {@link SEVERIDAD}.
 * @property {object} [datos]  Datos estructurados opcionales (objeto plano).
 */

/**
 * Crea una {@link DeteccionDerivacion} validando `tipo` y `severidad`. **LANZA**
 * si cualquiera es inválido: una detección con un tipo que la interfaz no sabe
 * interpretar es una detección muda.
 *
 * @param {string} tipo  Una de las claves/valores de {@link TIPO_DERIVACION}.
 * @param {string} mensaje  Texto no vacío, en español.
 * @param {'INFO'|'AVISO'|'ERROR'} severidad
 * @param {object} [datos]  Objeto plano con el detalle estructurado.
 * @returns {DeteccionDerivacion}
 * @throws {RangeError}  Si `tipo` o `severidad` no están en su catálogo.
 * @throws {TypeError}   Si `mensaje` no es texto no vacío o `datos` no es objeto plano.
 */
export function crearDeteccionDerivacion(tipo, mensaje, severidad, datos) {
  const tiposValidos = Object.values(TIPO_DERIVACION)
  if (!tiposValidos.includes(tipo)) {
    throw new RangeError(
      `crearDeteccionDerivacion: 'tipo' inválido: ${JSON.stringify(tipo)}. ` +
        `Válidos: ${tiposValidos.join(', ')}.`,
    )
  }
  const sevsValidas = Object.values(SEVERIDAD)
  if (!sevsValidas.includes(severidad)) {
    throw new RangeError(
      `crearDeteccionDerivacion: 'severidad' inválida: ${JSON.stringify(severidad)}. ` +
        `Válidas: ${sevsValidas.join(', ')}.`,
    )
  }
  if (typeof mensaje !== 'string' || mensaje.length === 0) {
    throw new TypeError(
      `crearDeteccionDerivacion: 'mensaje' debe ser un texto no vacío; recibido ${JSON.stringify(mensaje)}.`,
    )
  }
  const d = { tipo, mensaje, severidad }
  if (datos !== undefined) {
    if (datos === null || typeof datos !== 'object' || Array.isArray(datos)) {
      throw new TypeError(
        `crearDeteccionDerivacion: 'datos' debe ser un objeto plano o estar ausente; ` +
          `recibido ${JSON.stringify(datos)}.`,
      )
    }
    d.datos = datos
  }
  return d
}

/**
 * Recuento de detecciones por tipo y por severidad. **Misma forma y misma
 * implementación** que las otras cuatro capas, para que la interfaz no tenga cinco
 * maneras de contar lo mismo. Copiada y no importada, por el motivo de la
 * cabecera; el guardián de `test/contrato.test.js` comprueba que las cinco dan
 * exactamente el mismo objeto ante la misma entrada.
 *
 * @param {DeteccionDerivacion[]} detecciones
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

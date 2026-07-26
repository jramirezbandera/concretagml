// validation/parcela.js — F02 · Validación geométrica de la parcela (ORQUESTADOR).
//
// Superficie PÚBLICA de F02 (la expone el barrel index.js como `validacion`).
// Corrige el defecto del validador oficial: dice DÓNDE está el problema
// (verticesAfectados) y separa ERRORES de AVISOS. Los errores BLOQUEAN la
// generación de GML (F04); los avisos no.
//
// Estructura (como F01 modularizó parsers/): este orquestador colecciona los
// hallazgos de los tres módulos de reglas y los agrega; el vocabulario y los
// helpers viven en ./_comun.js. Referencias: spec/feature-02-validacion-parcela.md,
// spec/SPEC.md §3 (override O1), reglas de oro 1/6/9. Precedente: parsers/importar.js.
//
// Contrato (fijado en Fase 0):
//   validarParcela(recintos, { srs }) → { errores, avisos, puedeGenerar }
//     · recintos: [{ vertices:[[x,y],…], tipo }] en UTM, anillos ABIERTOS,
//       recintos[0]=EXTERIOR (model/parcela.js).
//     · srs: SRS del Expediente ('EPSG:25830'…), necesario para la regla de huso.
//     · errores/avisos: Hallazgo[] SEPARADOS (nunca sumados — criterio 3).
//     · puedeGenerar: errores.length === 0.
//   Un dato malo del USUARIO produce hallazgos, nunca una excepción (regla 1);
//   el `throw` se reserva para el contrato roto por el llamante (programador).
//
// Rendimiento (eng-review): en parcelas grandes (>500 vért.) la regla de huso
// reproyecta por vértice y kinks() es O(n²). La CADENCIA de la validación en vivo
// (debounce/throttle) es responsabilidad de F03, no de aquí. Optimización futura
// posible: short-circuit de las reglas caras si ya hay un ERROR bloqueante barato.

import { NIVEL, crearHallazgo, refsAnillo } from './_comun.js'
import { reglasGeometria } from './reglas-geometria.js'
import { reglasTopologia } from './reglas-topologia.js'
import { reglasHuso } from './reglas-huso.js'

// Reexporta NIVEL en la superficie pública para que la UI lo consuma vía el
// barrel: `validacion.NIVEL`. Y lo consume de verdad: el visor (F03) lo toma por
// `viewer/_comun.js`, que re-exporta el MISMO objeto de `./_comun.js` (no una
// copia), así que el vocabulario de niveles es único en todo el proyecto.
export { NIVEL }

/**
 * Comprueba la invariante estructural del modelo: existe un recinto y el primero
 * es el EXTERIOR. Devuelve el Hallazgo bloqueante si falla, o null si está bien.
 * (geo/area.js#superficie usa el mismo literal 'EXTERIOR' para su guarda.)
 *
 * @param {Array<{vertices?: Array<[number,number]>, tipo?: string}>} recintos
 * @returns {import('./_comun.js').Hallazgo | null}
 */
function comprobarExterior(recintos) {
  if (recintos.length === 0) {
    return crearHallazgo(
      NIVEL.ERROR,
      'La parcela no tiene ningún recinto: falta el contorno exterior.',
      [],
      'Definir el contorno exterior de la parcela',
    )
  }
  // Nunca crashear si recintos[0] es null/malformado (regla 1): se trata como
  // "no hay contorno exterior válido".
  const primero = recintos[0]
  if (!primero || typeof primero !== 'object' || primero.tipo !== 'EXTERIOR') {
    const n = primero && Array.isArray(primero.vertices) ? primero.vertices.length : 0
    return crearHallazgo(
      NIVEL.ERROR,
      'El primer recinto no es un contorno EXTERIOR válido.',
      refsAnillo(0, n),
      'Marcar el contorno exterior de la parcela',
    )
  }
  return null
}

/**
 * Valida la geometría de una parcela y separa errores (bloqueantes) de avisos.
 *
 * @param {Array<{vertices: Array<[number,number]>, tipo: string}>} recintos
 *   Recintos del modelo (UTM, anillos abiertos; recintos[0]=EXTERIOR).
 * @param {{ srs?: string }} [opts]  `srs` del Expediente (para la regla de huso).
 * @returns {{
 *   errores: import('./_comun.js').Hallazgo[],
 *   avisos:  import('./_comun.js').Hallazgo[],
 *   puedeGenerar: boolean,
 * }}
 * @throws {TypeError} Si `recintos` no es un array (contrato roto por el llamante).
 */
export function validarParcela(recintos, { srs } = {}) {
  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `validarParcela: 'recintos' debe ser un array de recintos; recibido ${typeof recintos}. ` +
        `(Un dato de usuario inválido se señala con hallazgos, no con throw — regla 1; ` +
        `esto es un contrato roto por el llamante.)`,
    )
  }

  // Guard estructural (eng-review, finding 1): sin un contorno EXTERIOR no hay
  // parcela que validar ni que generar. Es un ERROR bloqueante y corta aquí: las
  // reglas topológicas asumen recintos[0]=EXTERIOR, así que correrlas sin él daría
  // resultados sin sentido. Cubre además el caso "recintos[0] no es EXTERIOR".
  const sinExterior = comprobarExterior(recintos)
  if (sinExterior) {
    return { errores: [sinExterior], avisos: [], puedeGenerar: false }
  }

  const hallazgos = [
    ...reglasGeometria(recintos),
    ...reglasTopologia(recintos),
    ...reglasHuso(recintos, { srs }),
  ]

  // Categorías SEPARADAS (criterio de aceptación 3): nunca "2 avisos" cuando uno
  // es bloqueante. El recuento de cada lista es su .length.
  const errores = hallazgos.filter((h) => h.nivel === NIVEL.ERROR)
  const avisos = hallazgos.filter((h) => h.nivel === NIVEL.AVISO)

  return { errores, avisos, puedeGenerar: errores.length === 0 }
}

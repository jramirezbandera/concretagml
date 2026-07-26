// validation/reglas-huso.js — F02 · Regla de RANGO / huso.
//
// Comprueba que cada vértice de cada recinto cae dentro de España para el huso
// del modelo. Reutiliza geo/huso.js (NO añade nada a F00). NUNCA lanza por dato
// del usuario (regla 1): una coordenada fuera de rango produce un Hallazgo.
//
// Definición de "fuera de rango / fuera del huso" (decisión de contrato 5):
//   huso = husoPorSrs(srs) — 'EPSG:25829'→29, 'EPSG:25830'→30, 'EPSG:25831'→31
//   (geo/huso.js es el hogar canónico del dominio; NO se repite la tabla aquí).
//   Un vértice está fuera si `detectarHuso([x,y], [huso]) === null` (su
//   desproyección cae fuera de la ventana CM±3° o del bbox España). Se pasa
//   SIEMPRE el huso como único candidato → modo "solo verificar".
//   Si `srs` falta o no está implementado, no se puede juzgar el rango: se
//   devuelve [] (no es un error del usuario). Para eso se usa
//   `husoPorSrsOpcional`, la variante `number|null` de geo/huso.js: ESTA regla es
//   el único llamante del proyecto que legítimamente NO tiene contrato sobre el
//   `srs`, así que el "no puedo juzgarlo" le llega como VALOR y no como
//   excepción. Antes se hacía con `try { husoPorSrs(srs) } catch { return [] }`,
//   y ese `catch` desnudo atrapaba CUALQUIER throw: el día que `husoPorSrs`
//   crezca (la normalización URI/URN que su JSDoc anuncia para F04), un bug ahí
//   habría degradado esta regla —cuyo trabajo entero es detectar coordenadas
//   fuera de España— a "no valida el huso", en silencio y sin hallazgos. El
//   comportamiento observable NO cambia: sigue siendo "sin srs derivable → []",
//   el mismo documentado en F02.
//   detectarHuso ya valida coords finitas (el modelo las garantiza), así que
//   aquí no hay que proteger de NaN.

import { crearHallazgo, ref, NIVEL } from './_comun.js'
import { detectarHuso, husoPorSrsOpcional, srsPorHuso } from '../geo/huso.js'

/**
 * @param {Array<{vertices: Array<[number,number]>, tipo: string}>} recintos
 * @param {{ srs?: string }} [opts]
 * @returns {import('./_comun.js').Hallazgo[]}
 */
export function reglasHuso(recintos, { srs } = {}) {
  // Sin huso derivable no hay contra qué comparar el rango: no es error del
  // usuario, así que no se emite ningún hallazgo (regla 1: nada silencioso, pero
  // tampoco se inventa un error que no podemos justificar). `husoPorSrsOpcional`
  // devuelve `null` ante `srs` ausente/no-string/no-soportado (incluida Canarias
  // 'EPSG:32628', DIFERIDA): ese `null` es "no se puede juzgar el rango", NO un
  // fallo de esta regla.
  const huso = husoPorSrsOpcional(srs)
  if (huso === null) return []

  const hallazgos = []
  for (let r = 0; r < recintos.length; r++) {
    // Nunca crashear por un recinto malformado (regla 1, postura común a los 3
    // módulos): sin `vertices` array se trata como anillo vacío y se salta; la
    // rotura la señala reglas-geometria ("insuficientes").
    const rec = recintos[r]
    const vertices = rec && Array.isArray(rec.vertices) ? rec.vertices : []
    // Reúne los índices de este recinto cuyo vértice cae fuera del huso.
    const fuera = []
    for (let i = 0; i < vertices.length; i++) {
      if (detectarHuso(vertices[i], [huso]) === null) fuera.push(ref(r, i))
    }
    // Agregación por recinto: un único hallazgo para todos sus vértices fuera.
    if (fuera.length > 0) {
      const n = fuera.length
      const plural = n === 1 ? 'vértice cae' : 'vértices caen'
      hallazgos.push(
        crearHallazgo(
          NIVEL.ERROR,
          // El código EPSG se PIDE a geo/huso.js (`srsPorHuso`), nunca se deriva
          // a mano con aritmética sobre el huso: `25800 + huso` acierta por
          // casualidad para 29/30/31 y MENTIRÍA en cuanto entrara Canarias
          // (huso 28 → EPSG:32628, no 25828). El hogar del dominio es geo/huso.js.
          `${n} ${plural} fuera del huso ${huso} (${srsPorHuso(huso)}): la desproyección ` +
            `queda fuera de España.`,
          fuera,
          `Revisar las coordenadas fuera del huso ${huso}`,
        ),
      )
    }
  }
  return hallazgos
}

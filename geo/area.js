// geo/area.js — Superficie por fórmula del polígono (shoelace) sobre UTM.
//
// Convenciones (F00, no negociables):
//   · Anillos ABIERTOS: [[x,y], …] en UTM (x=Este, y=Norte), SIN repetir el
//     vértice de cierre. El índice de cierre es (i+1) mod n.
//   · Traslación a origen local (restar el primer vértice) ANTES del sumatorio:
//     con Norte ≈ 4·10⁶, evita la cancelación catastrófica de float64. Es el
//     punto de precisión más importante del área (SPEC §2 regla 5, dossier §3.3).
//   · Nunca turf.area (es geodésica esférica en grados). No se corrige por el
//     factor de escala k: el Catastro define la superficie sobre la proyección.
//
// Orientación (SPEC §3 override O1): A_signed > 0 ⇒ +1 (antihorario/CCW);
// A_signed < 0 ⇒ −1 (horario/CW). El Catastro quiere el exterior HORARIO
// (A_signed < 0) y los huecos antihorario. Este módulo SOLO expone el signo;
// la normalización al serializar vive en F04.

/**
 * Área firmada del anillo por la fórmula del polígono (shoelace), con
 * traslación a origen local para preservar la precisión float64.
 *
 * A_signed = ½·Σ (x_i·y_{(i+1)modn} − x_{(i+1)modn}·y_i)  sobre coords trasladadas.
 *
 * @param {Array<[number, number]>} anillo  Anillo abierto en UTM [[x,y], …].
 * @returns {number}  Área firmada (m²). >0 antihorario, <0 horario.
 */
export function areaFirmada(anillo) {
  const n = anillo.length
  if (n < 3) return 0

  const [ox, oy] = anillo[0]
  let suma = 0
  for (let i = 0; i < n; i++) {
    const [xi, yi] = anillo[i]
    const [xj, yj] = anillo[(i + 1) % n]
    // Coordenadas trasladadas al primer vértice (origen local).
    suma += (xi - ox) * (yj - oy) - (xj - ox) * (yi - oy)
  }
  return suma / 2
}

/**
 * Superficie (área absoluta) del anillo: |A_signed|.
 *
 * @param {Array<[number, number]>} anillo  Anillo abierto en UTM.
 * @returns {number}  Área en m², siempre ≥ 0.
 */
export function area(anillo) {
  return Math.abs(areaFirmada(anillo))
}

/**
 * Orientación del anillo: signo del área firmada.
 *   +1 = antihorario (CCW),  −1 = horario (CW; convención Catastro para el exterior).
 *
 * Convención para degenerados (auditoría A9): un anillo con área firmada 0
 * (menos de 3 vértices, colineal, o pajarita simétrica) devuelve +1. Detectar y
 * señalar la degeneración es responsabilidad de la validación (F02), no de esta
 * función pura.
 *
 * @param {Array<[number, number]>} anillo  Anillo abierto en UTM.
 * @returns {-1 | 1}
 */
export function orientacion(anillo) {
  return areaFirmada(anillo) < 0 ? -1 : 1
}

/**
 * Superficie neta de un conjunto de recintos: exterior menos huecos.
 *   S = |A_ext| − Σ |A_hueco|
 *
 * recintos[0] es el exterior; los huecos van marcados con tipo 'HUECO'.
 *
 * @param {Array<{vertices: Array<[number, number]>, tipo: 'EXTERIOR'|'HUECO'}>} recintos
 * @returns {number}  Superficie neta en m².
 */
export function superficie(recintos) {
  if (!recintos || recintos.length === 0) return 0

  // Guardas de invariante (auditoría A9, regla 1): antes se confiaba en el
  // llamante en silencio. El invariante lo impone model/parcela.js; si llega
  // roto hasta aquí es un bug del programa y debe sonar, no absorberse.
  if (recintos[0].tipo !== 'EXTERIOR') {
    throw new TypeError(
      `superficie: recintos[0] debe ser el EXTERIOR; recibido tipo='${recintos[0].tipo}'.`,
    )
  }

  const exterior = area(recintos[0].vertices)
  let huecos = 0
  for (let i = 1; i < recintos.length; i++) {
    if (recintos[i].tipo !== 'HUECO') {
      throw new TypeError(
        `superficie: recintos[${i}] debe ser HUECO; recibido tipo='${recintos[i].tipo}'. ` +
          `(Antes se ignoraba en silencio — regla de oro 1.)`,
      )
    }
    huecos += area(recintos[i].vertices)
  }
  return exterior - huecos
}

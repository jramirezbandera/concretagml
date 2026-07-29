// geo/centroide.js — Centroide del ÁREA de un anillo, y de una región con
// huecos ponderada por área (F07, tarea T1.2). Módulo PURO y hoja de `geo/`,
// mismo criterio que `geo/area.js` y `geo/metrica.js`: sin DOM, sin Leaflet,
// sin Turf. Su única dependencia es `geo/area.js`, para no reimplementar el
// shoelace.
//
// POR QUÉ EXISTE. F07 publica «desplazamiento de centroides»
// (spec/feature-07-diagnostico-parcela.md §10.1): cuánto se ha movido la
// parcela editada (`recintos`) respecto a la oficial (`geometriaOficial`).
// Esa cifra tiene que medir el DESPLAZAMIENTO DE LA PARCELA, no otra cosa que
// se le parezca.
//
// DECISIÓN 1 — el centroide del ÁREA, no el promedio de los vértices. Un
// lindero catastral trae vértices DE PASO (puntos que documentan el trazado
// pero no son esquina) además de esquinas: de los 15 vértices de la parcela
// real del fixture (`test/fixtures/geo/parcela-ring.json`), 5 son de paso. El
// promedio aritmético pondera cada vértice por igual, así que un lado con
// varios puntos de paso arrastra el promedio hacia ese lado — mide el REPARTO
// de los vértices sobre el perímetro, no el centro de masa de la superficie.
// El centroide del ÁREA (la fórmula de este módulo) es insensible a cuántos
// vértices tenga un lado recto: solo depende del contorno que trazan, no de
// cómo está muestreado. Con el promedio, F07 publicaría una cifra que cambia
// según la fase de captura del vecino, no según si la parcela se movió —
// exactamente el número plausible y falso que la regla de oro 1 prohíbe.
//
// DECISIÓN 2 — `null`, no el promedio de vértices, cuando el área es 0. Un
// polígono sin área no tiene centro de masa: no hay «casi lo mismo» que
// devolver. Devolver el promedio de vértices sería sustituir una respuesta
// indefinida por OTRA cifra que se parece lo bastante como para que nadie la
// compruebe (regla de oro 1: una medida que "vale" estando mal es peor que
// una que falla). El precedente es `geo/area.js#orientacion`, que ante un
// área firmada 0 no intenta adivinar: devuelve `+1` y lo DOCUMENTA como
// convención. Aquí la convención análoga es `null`; señalar la degeneración
// (el porqué de esa parcela) es trabajo de la validación (F02), no de esta
// función pura.
//
// PRECISIÓN (regla de oro 5). Al contrario que `geo/metrica.js` —que opera
// sobre DIFERENCIAS de coordenadas y no necesita trasladar—, aquí los
// productos cruzados de la fórmula del centroide (`x_i·y_j`) multiplican
// coordenadas ABSOLUTAS entre sí. Con Norte ≈ 4·10⁶ eso es exactamente la
// cancelación catastrófica que describe `geo/area.js`: se traslada a origen
// local (restando el primer vértice) antes de acumular, igual que el
// shoelace, y se deshace la traslación al final sumando ese vértice al
// resultado.
//
// No se reimplementa el shoelace: el área con signo (para el denominador de
// `centroideAnillo`) y el área absoluta (para los pesos de `centroide`) se
// piden siempre a `geo/area.js`.

import { areaFirmada, area } from './area.js'

/**
 * Centroide del ÁREA de un anillo abierto, en UTM.
 *
 *   Cx = (1/(6A))·Σ (x_i+x_j)·(x_i·y_j−x_j·y_i)
 *   Cy = (1/(6A))·Σ (y_i+y_j)·(x_i·y_j−x_j·y_i)
 *
 * con A = área FIRMADA (`geo/area.js#areaFirmada`), j = (i+1) % n, sobre
 * coordenadas TRASLADADAS a origen local (se resta `anillo[0]`; se deshace la
 * traslación al devolver el resultado). El signo de A y el signo de cada
 * término (x_i·y_j−x_j·y_i) se cancelan en el cociente: el resultado es el
 * MISMO centroide recorriendo el anillo en cualquier sentido.
 *
 * @param {Array<[number, number]>} anillo  Anillo abierto en UTM [[x,y], …].
 * @returns {[number, number] | null}  Centroide en UTM, o `null` si el área
 *   firmada es 0: menos de 3 vértices, anillo colineal, o pajarita simétrica
 *   (mismo criterio degenerado que `geo/area.js#orientacion`).
 */
export function centroideAnillo(anillo) {
  // areaFirmada ya devuelve 0 para n < 3 sin tocar anillo[0]: cubre ese caso
  // sin necesidad de comprobar la longitud aparte.
  const aFirmada = areaFirmada(anillo)
  if (aFirmada === 0) return null

  const n = anillo.length
  const [ox, oy] = anillo[0]
  let sumaX = 0
  let sumaY = 0
  for (let i = 0; i < n; i++) {
    const xi = anillo[i][0] - ox
    const yi = anillo[i][1] - oy
    const [xj0, yj0] = anillo[(i + 1) % n]
    const xj = xj0 - ox
    const yj = yj0 - oy
    const cruce = xi * yj - xj * yi // el mismo término que suma el shoelace de area.js
    sumaX += (xi + xj) * cruce
    sumaY += (yi + yj) * cruce
  }

  const factor = 1 / (6 * aFirmada)
  return [ox + sumaX * factor, oy + sumaY * factor]
}

/**
 * Centroide de una región con huecos, PONDERADO POR ÁREA:
 *
 *   C = (A_ext·C_ext − Σ A_h·C_h) / (A_ext − Σ A_h)
 *
 * con áreas ABSOLUTAS (`geo/area.js#area`), no firmadas: el signo del anillo
 * es una convención de dibujo (override O1) y aquí lo que resta es la MASA
 * del hueco, no su orientación — mezclar los dos sería contar el signo dos
 * veces.
 *
 * Invariante EXTERIOR/HUECO (regla de oro 1, mismo criterio que
 * `geo/area.js#superficie`): `recintos[0]` es el EXTERIOR y el resto son
 * HUECOS. Lo impone `model/parcela.js`; si llega roto hasta aquí es un bug
 * del PROGRAMA y debe sonar, no absorberse.
 *
 * @param {Array<{vertices: Array<[number, number]>, tipo: 'EXTERIOR'|'HUECO'}>} recintos
 * @returns {[number, number] | null}  `null` si `recintos` está vacío/nulo, si
 *   el EXTERIOR es degenerado ({@link centroideAnillo} → `null`), o si el
 *   denominador (área neta A_ext − Σ A_h) es 0: los huecos consumen toda la
 *   superficie y no queda masa que ponderar.
 * @throws {TypeError} Si `recintos[0]` no es EXTERIOR o algún `recintos[i≥1]`
 *   no es HUECO.
 */
export function centroide(recintos) {
  if (!recintos || recintos.length === 0) return null

  if (recintos[0].tipo !== 'EXTERIOR') {
    throw new TypeError(
      `centroide: recintos[0] debe ser el EXTERIOR; recibido tipo='${recintos[0].tipo}'.`,
    )
  }

  const cExt = centroideAnillo(recintos[0].vertices)
  if (cExt === null) return null // exterior degenerado: no hay centro que ponderar

  const aExt = area(recintos[0].vertices)
  let sumaXHuecos = 0
  let sumaYHuecos = 0
  let aHuecos = 0
  for (let i = 1; i < recintos.length; i++) {
    if (recintos[i].tipo !== 'HUECO') {
      throw new TypeError(
        `centroide: recintos[${i}] debe ser HUECO; recibido tipo='${recintos[i].tipo}'.`,
      )
    }
    const cHueco = centroideAnillo(recintos[i].vertices)
    if (cHueco === null) continue // hueco degenerado (área 0): no aporta masa
    const aHueco = area(recintos[i].vertices)
    sumaXHuecos += aHueco * cHueco[0]
    sumaYHuecos += aHueco * cHueco[1]
    aHuecos += aHueco
  }

  const denominador = aExt - aHuecos
  if (denominador === 0) return null // los huecos consumen toda la superficie: sin masa neta

  return [
    (aExt * cExt[0] - sumaXHuecos) / denominador,
    (aExt * cExt[1] - sumaYHuecos) / denominador,
  ]
}

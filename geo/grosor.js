// geo/grosor.js — El GROSOR de una pieza de geometría: `2·área / perímetro`.
// Módulo PURO (sin DOM, sin Leaflet, sin turf, sin estado, sin reloj) y hoja del
// grafo salvo por sus dos vecinos de la misma capa, `geo/area.js` y
// `geo/metrica.js`.
//
// POR QUÉ EXISTE (F17, tarea 1.1). Esta aritmética vivía dentro de
// `diagnostico/topologia.js#medirPieza`, privada, desde F07. F17 necesita
// EXACTAMENTE la misma para decidir si un trozo de sobrante es una cesión de
// verdad o una astilla de redondeo, y copiarla habría dado **dos definiciones de
// qué es una astilla** en el mismo programa: la del diagnóstico y la de la
// derivación, libres de divergir en el primer ajuste. Se extrae, no se duplica.
//
// ⚠️ Y el umbral con el que se compara **no vive aquí**: es
// `OPERATIVOS.grosorInvasionMinimoM` (`config/operativos.js`), y sigue siendo del
// llamante. Este módulo mide; quién descarta y con qué número es una decisión
// operativa, y mezclarlas convertiría una medida en un veredicto (regla de oro 9).
//
// ── QUÉ ES ESTA CIFRA, Y QUÉ NO ES ──────────────────────────────────────────
// Para una franja alargada de base `L` y altura `h` —el caso que importa: la
// astilla de un lindero compartido es exactamente eso— el perímetro es ≈ `2L` y el
// área ≈ `L·h/2`, así que `2A/P ≈ h/2`: proporcional a la altura y, lo esencial,
// **INDEPENDIENTE de `L`**. Esa es la propiedad por la que este filtro sustituyó
// al de área en F07: el área de la astilla crece con la longitud del lindero y el
// grosor no.
//
// NO es el grosor exacto de nadie (para un cuadrado de lado `s` da `s/2`, no `s`),
// y no hace falta que lo sea: lo que se le pide es separar por órdenes de magnitud
// dos poblaciones que están a tres de distancia —0,071 mm la astilla real medida
// sobre el fixture, 4,9 cm una franja invadida de 2 m × 5 cm—. Un ancho mínimo
// exacto (la anchura del rectángulo de área mínima que la contiene) costaría una
// envolvente convexa y calipers rotatorios para decidir lo mismo.
//
// ── ⛔ EL LÍMITE CONOCIDO, REMEDIDO EN F17: F07 LO TENÍA AL REVÉS ────────────
// La cabecera de `diagnostico/topologia.js` decía —y era una conjetura, no una
// medición— que «una pieza con hueco tiene mucho perímetro y poca área, así que su
// grosor sale POR DEBAJO del real y podría descartarse». Allí era una patología
// que nadie había visto; en F17 **el sobrante anular es un caso normal** (encoger
// una parcela por todos sus lados deja exactamente un anillo), así que hubo que
// medirlo. Las dos conclusiones cambian:
//
//   1. ⭐ **PARA UN ANILLO DE GROSOR UNIFORME, `2A/P = h` EXACTAMENTE**, y no solo
//      si es delgado. Sale de la propia álgebra: para un marco rectangular de lados
//      `L`×`W` y grosor `h`, `A = 2h(L+W) − 4h²` y `P = 4(L+W) − 8h`, luego
//      `2A/P = h` sin aproximar. MEDIDO a 0,001 · 0,01 · 0,05 · 1 · 20 y 25 m: los
//      seis dan `h` con error 0 en float64. **El sobrante de un encogimiento
//      uniforme se mide bien, y ésa es la buena noticia que F17 necesitaba.**
//   2. ⛔ **El riesgo real es el CONTRARIO del que estaba escrito, y es peor.** Con
//      un anillo NO uniforme la cifra es una especie de promedio, así que
//      **SOBREestima el lado fino**: medido, un marco de 100×100 con el hueco
//      descentrado —1 m de grosor en un lado y 49 en el opuesto— da `2A/P = 25`. Un
//      sobrante con un lado de milímetros pasaría el filtro anunciando 25 m. No
//      descarta de más: **admite de más**, que en esta aplicación es el error que
//      importa, porque una astilla admitida se emite y se firma.
//
// No se defiende contra ello aquí, y es deliberado: quien mira el número de la
// pieza es la interfaz, y la respuesta correcta es **enseñar la pieza** —el usuario
// ve la forma en el mapa— y no inventar una heurística de uniformidad. Queda
// escrito para que nadie lea `grosor` como «el ancho mínimo».

import { superficie } from './area.js'
import { perimetro } from './metrica.js'

/** @typedef {{vertices: Array<[number,number]>}} Recinto */

/**
 * Mide una pieza: su superficie, y el grosor estimado como `2·área / perímetro`.
 *
 * La pieza es un `recintos` del modelo —exterior en `[0]`, huecos detrás—, así que
 * tanto `superficie` como `perimetro` cuentan los huecos con su signo: el área los
 * RESTA y el perímetro los SUMA, que es lo que hace que un anillo delgado dé su
 * grosor de verdad (ver la cabecera).
 *
 * @param {Recinto[]} pieza  Una pieza de geometría (un `recintos` válido).
 * @returns {{pieza: Recinto[], area: number, grosor: number}}  `area` en m² y
 *   `grosor` en metros. `grosor` es `0` si el perímetro es 0 (pieza degenerada),
 *   lo que la deja siempre por debajo de cualquier umbral: una pieza sin perímetro
 *   no es una cesión, y devolver `Infinity` o `NaN` la habría colado.
 * @throws {TypeError} Los de `geo/area.js#superficie` y `geo/metrica.js#perimetro`,
 *   sin traducir: si la pieza no cumple el invariante de `recintos` es un bug del
 *   llamante, y sus mensajes ya lo dicen mejor que uno intermedio.
 */
export function medirPieza(pieza) {
  const area = superficie(pieza)
  const { total } = perimetro(pieza)
  return { pieza, area, grosor: total === 0 ? 0 : (2 * area) / total }
}

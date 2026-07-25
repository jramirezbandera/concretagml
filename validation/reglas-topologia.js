// validation/reglas-topologia.js — F02 · Reglas TOPOLÓGICAS (único fichero con Turf).
//
// Contrato: `reglasTopologia(recintos) → Hallazgo[]`. ÚNICO fichero de F02 que
// importa Turf (regla 6: SOLO funciones TOPOLÓGICAS — kinks/booleanContains/
// intersect). Turf corre directamente sobre UTM. Los anillos del modelo van
// ABIERTOS (sin repetir el cierre) → se pasan a Turf CERRADOS con
// coordsPoligono/anilloCerrado de ./_comun.js. NUNCA lanza por dato del usuario
// (regla 1): un anillo con < 3 vértices haría lanzar a polygon() (el cierre
// tendría < 4 posiciones), así que esos recintos se GUARDAN por conteo y se
// SALTAN — su degeneración la detecta reglas-geometria, no esta tarea. No se usa
// try/catch para tapar: el guardado es estructural.
//
// ⚠️ Turf 7.3.5 (VERIFICADO): `intersect` recibe un FeatureCollection de DOS
//    polígonos → `intersect(featureCollection([polA, polB]))`; la forma de dos
//    argumentos LANZA "Must specify at least 2 geometries". `kinks(pol)` devuelve
//    un FeatureCollection de puntos de cruce (0 = sin autointersección).
//
// Reglas (todas ERROR, con verbo en `correccion`):
//   · Autointersección     — kinks(recinto).features.length > 0. Marca el anillo
//                            entero (robusto). Verbo: "Deshacer el cruce del contorno".
//   · Hueco fuera del ext.  — !booleanContains(exterior, hueco). Marca el hueco.
//                            Verbo: "Mover el hueco dentro de la parcela".
//   · Huecos solapados      — intersect(FC([hi,hj])) ≠ null. Marca ambos huecos.
//                            Verbo: "Separar los huecos que se solapan".

import { NIVEL, crearHallazgo, ref, refsAnillo, coordsPoligono, distancia } from './_comun.js'
import kinks from '@turf/kinks'
import booleanContains from '@turf/boolean-contains'
import intersect from '@turf/intersect'
import { polygon, featureCollection } from '@turf/helpers'

// ── Helpers internos ─────────────────────────────────────────────────────────

/**
 * ¿El recinto tiene suficientes vértices para formar un polígono Turf sin lanzar?
 * El modelo guarda anillos ABIERTOS: n vértices → n+1 posiciones al cerrar. Turf
 * exige ≥ 4 posiciones cerradas, luego el mínimo abierto es n ≥ 3. Los recintos
 * con menos se saltan (su degeneración la emite reglas-geometria, regla 1).
 *
 * @param {{vertices: Array<[number,number]>}} recinto
 * @returns {boolean}
 */
const esRecintoApto = (recinto) =>
  !!recinto && Array.isArray(recinto.vertices) && recinto.vertices.length >= 3

/** Nombre legible del recinto para los mensajes (0 = exterior; resto = huecos). */
const nombreRecinto = (indice) =>
  indice === 0 ? 'el contorno exterior' : `el hueco nº ${indice}`

// Tolerancia para casar un punto de cruce de kinks() con un segmento del anillo.
// El punto lo calcula Turf sobre las MISMAS coords UTM (metros), así que cae
// sobre el segmento salvo ruido float (~1e-10 a magnitud 1e6); 0,1 mm es holgado
// y no casa segmentos vecinos que no cruzan.
const TOL_CRUCE_M = 1e-4

/** ¿El punto p está (aprox) sobre el segmento a-b, con tolerancia tol (m)? */
function puntoEnSegmento(p, a, b, tol) {
  const abx = b[0] - a[0]
  const aby = b[1] - a[1]
  const len2 = abx * abx + aby * aby
  if (len2 === 0) return distancia(p, a) <= tol
  let t = ((p[0] - a[0]) * abx + (p[1] - a[1]) * aby) / len2
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(p[0] - (a[0] + t * abx), p[1] - (a[1] + t * aby)) <= tol
}

/**
 * `verticesAfectados` de una autointersección: los extremos de los segmentos que
 * pasan por cada punto de cruce que devuelve kinks(). Es el "dice DÓNDE" fino
 * (no el anillo entero). Si ningún segmento casa (ruido numérico raro), degrada a
 * marcar el anillo entero para NO devolver [] ante un cruce real.
 *
 * @param {Array<[number,number]>} vertices  Anillo ABIERTO.
 * @param {number} recIndex                  Índice del recinto en `recintos`.
 * @param {Array<{geometry:{coordinates:[number,number]}}>} kinkFeatures  kinks().features.
 * @returns {import('./_comun.js').RefVertice[]}
 */
function refsDelCruce(vertices, recIndex, kinkFeatures) {
  const n = vertices.length
  const idx = new Set()
  for (const f of kinkFeatures) {
    const p = f.geometry.coordinates
    for (let i = 0; i < n; i++) {
      const a = vertices[i]
      const b = vertices[(i + 1) % n]
      if (puntoEnSegmento(p, a, b, TOL_CRUCE_M)) {
        idx.add(i)
        idx.add((i + 1) % n)
      }
    }
  }
  if (idx.size === 0) return refsAnillo(recIndex, n) // fallback robusto
  return [...idx].sort((x, y) => x - y).map((i) => ref(recIndex, i))
}

// ── Regla topológica ─────────────────────────────────────────────────────────

/**
 * Reglas topológicas sobre la parcela (regla 6: SOLO Turf topológico, sobre UTM).
 *
 * @param {Array<{vertices: Array<[number,number]>, tipo: string}>} recintos
 *   Recintos en UTM, anillos ABIERTOS. `recintos[0]` es el EXTERIOR; el resto HUECOS.
 * @returns {import('./_comun.js').Hallazgo[]}
 */
export function reglasTopologia(recintos) {
  // Sin recintos o sin un EXTERIOR apto no hay topología que comprobar (la
  // degeneración del exterior la emite reglas-geometria). Regla 1: devolver [].
  if (!Array.isArray(recintos) || recintos.length === 0) return []
  if (!esRecintoApto(recintos[0])) return []

  // Polígonos Turf precomputados (o null si el recinto no es apto). Construirlos
  // aquí evita repetir polygon()/anilloCerrado en cada regla.
  const polis = recintos.map((r) => (esRecintoApto(r) ? polygon(coordsPoligono(r)) : null))

  const hallazgos = []

  // Regla 1 — Autointersección: para CADA recinto apto (exterior o hueco).
  for (let i = 0; i < recintos.length; i++) {
    const poli = polis[i]
    if (poli === null) continue
    const cruces = kinks(poli).features
    if (cruces.length > 0) {
      hallazgos.push(
        crearHallazgo(
          NIVEL.ERROR,
          `Autointersección: ${nombreRecinto(i)} se cruza consigo mismo.`,
          refsDelCruce(recintos[i].vertices, i, cruces),
          'Deshacer el cruce del contorno.',
        ),
      )
    }
  }

  // Regla 2 — Hueco fuera del exterior: para cada hueco apto, si el EXTERIOR no
  // lo contiene. El exterior (polis[0]) es apto por el guard de arriba.
  const poliExterior = polis[0]
  for (let i = 1; i < recintos.length; i++) {
    const poliHueco = polis[i]
    if (poliHueco === null) continue
    if (!booleanContains(poliExterior, poliHueco)) {
      hallazgos.push(
        crearHallazgo(
          NIVEL.ERROR,
          `El hueco nº ${i} queda fuera del contorno exterior.`,
          refsAnillo(i, recintos[i].vertices.length),
          'Mover el hueco dentro de la parcela.',
        ),
      )
    }
  }

  // Regla 3 — Huecos solapados: para cada par (i, j) de huecos aptos, si su
  // intersección tiene área (intersect ≠ null; tocarse en un borde da null).
  for (let i = 1; i < recintos.length; i++) {
    if (polis[i] === null) continue
    for (let j = i + 1; j < recintos.length; j++) {
      if (polis[j] === null) continue
      if (intersect(featureCollection([polis[i], polis[j]])) !== null) {
        hallazgos.push(
          crearHallazgo(
            NIVEL.ERROR,
            `El hueco nº ${i} y el hueco nº ${j} se solapan.`,
            [...refsAnillo(i, recintos[i].vertices.length), ...refsAnillo(j, recintos[j].vertices.length)],
            'Separar los huecos que se solapan.',
          ),
        )
      }
    }
  }

  return hallazgos
}

// validation/reglas-geometria.js — F02 · Reglas geométricas de MÉTRICA PROPIA.
//
// Contrato: `reglasGeometria(recintos) → Hallazgo[]`. Recorre cada recinto (anillo
// ABIERTO en UTM) y emite hallazgos vía crearHallazgo de ./_comun.js. NUNCA lanza
// por dato del usuario (regla 1). Métricas con helpers propios y geo/area.js
// (nunca turf). Tolerancias desde OPERATIVOS (config/operativos.json).
//
// Reglas implementadas:
//   ERROR (con `correccion`):
//     · Vértices insuficientes  — < 3 vértices DISTINTOS en el anillo.
//     · Vértices duplicados     — consecutivos a distancia < OPERATIVOS.duplicadoMetros
//                                 (1 mm) → verticesAfectados = {i}, {i+1}. Verbo:
//                                 "Eliminar vértice duplicado".
//     · Superficie NETA nula    — superficie(recintos) ≤ OPERATIVOS.areaNulaM2 (≈0).
//   AVISO (sin `correccion`):
//     · Casi colineales         — anguloVertice(prev,v,next) > OPERATIVOS.colinealidadGrados
//                                 (179,9°) → verticesAfectados = {vértice central}.
//     · Segmento muy corto      — duplicadoMetros ≤ distancia(v,v+1) < OPERATIVOS.segmentoCortoMetros
//                                 (5 cm). Excluye los ya duplicados (<1 mm).
//     · Superficie NETA pequeña — OPERATIVOS.areaNulaM2 < superficie(recintos) < superficieMinimaM2
//                                 (1 m²). NETA = exterior − huecos. EXCLUSIÓN MUTUA con nula.
//
// Nota (eng-review): las reglas de superficie miden la NETA de la parcela
// (exterior − huecos) vía geo/area.js#superficie, NO por-anillo: así se detecta la
// parcela cuyo hueco anula el exterior y no se mete ruido en huecos pequeños.
//     · Muchos vértices         — nº de vértices > OPERATIVOS.maxVertices (500).

import { NIVEL, crearHallazgo, ref, refsAnillo, distancia, anguloVertice, OPERATIVOS } from './_comun.js'
import { superficie } from '../geo/area.js'

const {
  duplicadoMetros,
  segmentoCortoMetros,
  colinealidadGrados,
  superficieMinimaM2,
  areaNulaM2,
  maxVertices,
} = OPERATIVOS

/**
 * Nº de vértices DISTINTOS del anillo colapsando los near-duplicates
 * CONSECUTIVOS (distancia < duplicadoMetros), incluido el par de cierre
 * (n-1 ≈ 0). Cuenta las "fronteras" del ciclo (aristas cuya longitud llega al
 * umbral): para un ciclo con ≥2 grupos distintos coincide con el nº de grupos;
 * si todo colapsa a un único punto (0 fronteras) devuelve 1.
 * @param {Array<[number,number]>} anillo
 * @returns {number}
 */
function contarVerticesDistintos(anillo) {
  const n = anillo.length
  if (n === 0) return 0
  let fronteras = 0
  for (let i = 0; i < n; i++) {
    if (distancia(anillo[i], anillo[(i + 1) % n]) >= duplicadoMetros) fronteras++
  }
  return fronteras === 0 ? 1 : fronteras
}

/**
 * Superficie NETA de la parcela (exterior − huecos), reutilizando
 * geo/area.js#superficie PERO sin heredar su throw: si la estructura no cumple su
 * invariante (recintos[0]=EXTERIOR, resto HUECO, todos con `vertices` array), no se
 * puede medir con fiabilidad y se devuelve null — esa rotura la señalan
 * comprobarExterior (orquestador) y las reglas per-anillo. Nunca lanza (regla 1).
 *
 * @param {Array<{vertices?: Array<[number,number]>, tipo?: string}>} recintos
 * @returns {number|null}
 */
function superficieNeta(recintos) {
  if (recintos.length === 0) return null
  for (let i = 0; i < recintos.length; i++) {
    const r = recintos[i]
    if (!r || !Array.isArray(r.vertices)) return null
    if (i === 0 ? r.tipo !== 'EXTERIOR' : r.tipo !== 'HUECO') return null
  }
  return superficie(recintos)
}

/**
 * Reglas geométricas de métrica propia sobre un conjunto de recintos (anillos
 * ABIERTOS en UTM). Nunca lanza por geometría del usuario: todo se materializa
 * como Hallazgo[].
 *
 * @param {Array<{vertices: Array<[number,number]>, tipo: string}>} recintos
 * @returns {import('./_comun.js').Hallazgo[]}
 */
export function reglasGeometria(recintos) {
  const rs = Array.isArray(recintos) ? recintos : []
  const hallazgos = []

  for (let r = 0; r < rs.length; r++) {
    const rec = rs[r]
    const anillo = rec && Array.isArray(rec.vertices) ? rec.vertices : []
    const n = anillo.length

    // ── ERROR · Vértices insuficientes (< 3 distintos) ────────────────────────
    if (contarVerticesDistintos(anillo) < 3) {
      hallazgos.push(
        crearHallazgo(
          NIVEL.ERROR,
          'El anillo tiene menos de 3 vértices distintos.',
          refsAnillo(r, n),
          'Definir al menos 3 vértices',
        ),
      )
    }

    // ── Recorrido de aristas del ciclo: duplicados (ERROR) y segmentos cortos
    //    (AVISO). El else-if garantiza que un segmento corto EXCLUYE el ya
    //    duplicado (<1 mm). Para un dígono (n===2) las aristas (0,1) y (1,0) son
    //    el mismo par físico: se recorre una sola vez para no doblar el hallazgo.
    if (n >= 2) {
      const numAristas = n === 2 ? 1 : n
      for (let i = 0; i < numAristas; i++) {
        const j = (i + 1) % n
        const d = distancia(anillo[i], anillo[j])
        if (d < duplicadoMetros) {
          hallazgos.push(
            crearHallazgo(
              NIVEL.ERROR,
              'Vértices consecutivos duplicados (distancia < 1 mm).',
              [ref(r, i), ref(r, j)],
              'Eliminar vértice duplicado',
            ),
          )
        } else if (d < segmentoCortoMetros) {
          hallazgos.push(
            crearHallazgo(
              NIVEL.AVISO,
              'Segmento muy corto (< 5 cm).',
              [ref(r, i), ref(r, j)],
            ),
          )
        }
      }
    }

    // ── AVISO · Vértices casi colineales (ángulo interior > 179,9°) ────────────
    if (n >= 3) {
      for (let i = 0; i < n; i++) {
        const prev = anillo[(i - 1 + n) % n]
        const v = anillo[i]
        const next = anillo[(i + 1) % n]
        if (anguloVertice(prev, v, next) > colinealidadGrados) {
          hallazgos.push(
            crearHallazgo(
              NIVEL.AVISO,
              'Vértice casi colineal con sus vecinos (ángulo > 179,9°).',
              [ref(r, i)],
            ),
          )
        }
      }
    }

    // ── AVISO · Demasiados vértices (> maxVertices) ───────────────────────────
    if (n > maxVertices) {
      hallazgos.push(
        crearHallazgo(NIVEL.AVISO, `Demasiados vértices (${n} > ${maxVertices}).`, []),
      )
    }
  }

  // ── Superficie NETA de la parcela (una sola vez, no per-anillo). Se ancla en
  //    el contorno exterior. EXCLUSIÓN MUTUA nula ↔ muy pequeña (rangos disjuntos).
  const neta = superficieNeta(rs)
  if (neta !== null) {
    const nExt = rs[0].vertices.length
    if (neta <= areaNulaM2) {
      hallazgos.push(
        crearHallazgo(
          NIVEL.ERROR,
          'Superficie neta de la parcela nula (≈ 0 m²).',
          refsAnillo(0, nExt),
          'Revisar la geometría (superficie nula)',
        ),
      )
    } else if (neta < superficieMinimaM2) {
      hallazgos.push(
        crearHallazgo(
          NIVEL.AVISO,
          'Superficie neta de la parcela muy pequeña (< 1 m²).',
          refsAnillo(0, nExt),
        ),
      )
    }
  }

  return hallazgos
}

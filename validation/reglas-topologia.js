// validation/reglas-topologia.js — F02 · Reglas TOPOLÓGICAS (único fichero con Turf).
//
// Contrato: `reglasTopologia(recintos) → Hallazgo[]`. ÚNICO fichero de F02 que
// importa Turf (regla 6: SOLO funciones TOPOLÓGICAS — kinks/difference/
// intersect). Turf corre directamente sobre UTM. Los anillos del modelo van
// ABIERTOS (sin repetir el cierre) → se pasan a Turf CERRADOS con
// coordsPoligono/anilloCerrado de ./_comun.js. NUNCA lanza por dato del usuario
// (regla 1): un anillo con < 3 vértices haría lanzar a polygon() (el cierre
// tendría < 4 posiciones), así que esos recintos se GUARDAN por conteo y se
// SALTAN — su degeneración la detecta reglas-geometria, no esta tarea. No se usa
// try/catch para tapar: el guardado es estructural.
//
// ⚠️ Turf 7.3.5 (VERIFICADO): `intersect` y `difference` reciben un
//    FeatureCollection de DOS polígonos → `intersect(featureCollection([polA,
//    polB]))`; la forma de dos argumentos LANZA "Must specify at least 2
//    geometries". `kinks(pol)` devuelve un FeatureCollection de puntos de cruce
//    (0 = sin autointersección).
//
// Reglas (todas ERROR, con verbo en `correccion`):
//   · Autointersección      — kinks(recinto).features.length > 0. Marca el anillo
//                            entero (robusto). Verbo: "Deshacer el cruce del contorno".
//   · Hueco fuera del ext.  — difference(FC([hueco, exterior])) con área >
//                            OPERATIVOS.areaNulaM2. Marca el hueco. Verbo: "Mover
//                            el hueco dentro de la parcela".
//                            ⚠️ ANTES era `!booleanContains(exterior, hueco)`, y
//                            booleanContains solo comprueba los VÉRTICES del
//                            interior (isPolyInPoly → booleanPointInPolygon punto
//                            a punto): un hueco con todos los vértices dentro pero
//                            una ARISTA que sale por una concavidad del exterior
//                            pasaba sin hallazgo (auditoría 2026-08, V1). El área
//                            no engaña: si un trozo del hueco queda fuera, mide.
//   · Hueco apoyado en ext. — aristas del hueco colineales y SOLAPADAS con aristas
//                            del exterior a lo largo de un tramo. Un anillo
//                            interior que toca el exterior a lo largo de una CURVA
//                            es inválido (ISO 19107); tocarlo en PUNTOS aislados
//                            es válido y NO se señala (auditoría 2026-08, V2 — el
//                            arreglo por área de V1 no lo caza: área fuera = 0).
//                            Marca los extremos de los lados apoyados. Verbo:
//                            "Separar el hueco del contorno exterior".
//   · Huecos solapados      — intersect(FC([hi,hj])) ≠ null. Marca ambos huecos.
//                            Verbo: "Separar los huecos que se solapan".

import {
  NIVEL,
  crearHallazgo,
  ref,
  refsAnillo,
  coordsPoligono,
  distancia,
  esRecintoApto,
  OPERATIVOS,
} from './_comun.js'
import kinks from '@turf/kinks'
import difference from '@turf/difference'
import intersect from '@turf/intersect'
import { polygon, featureCollection } from '@turf/helpers'
// La vuelta del GeoJSON de Turf al modelo y la medición del área son aritmética
// de la casa: `recintosDeGeometriaTurf` no se re-exporta en ./_comun.js (es el
// contrato de F02, no un barrel) y se importa de su hogar, como hace
// validation/edificio.js con `superficie`.
import { recintosDeGeometriaTurf } from '../geo/poligono.js'
import { superficie } from '../geo/area.js'

// ── Helpers internos ─────────────────────────────────────────────────────────

// ⚠️ `esRecintoApto` ya NO se define aquí (F17, tarea 1.1): vive en
// `geo/poligono.js` y llega por el re-export de `./_comun.js`, igual que
// `anilloCerrado` y `coordsPoligono` desde F07. Estaba escrita tres veces con el
// mismo razonamiento, y lo que define —cuántos vértices necesita un anillo para
// que Turf lo acepte— depende del formato del anillo, que es de `geo/`.

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

/**
 * Área (m²) del hueco que queda FUERA del contorno exterior: `difference(hueco −
 * exterior)`, medida con la aritmética de la casa (`geo/area.js#superficie`,
 * shoelace con traslación a origen local) tras volver del GeoJSON de Turf por el
 * puente de `geo/poligono.js`. `0` si el hueco está contenido (difference → null).
 *
 * Es la mitad TOPOLÓGICA de la regla «hueco fuera del exterior»: a magnitud UTM
 * (~1e6 m) la resta booleana puede dejar esquirlas de ruido float (~1e-9 m²), así
 * que el veredicto no es «≠ null» sino «área > OPERATIVOS.areaNulaM2», el mismo
 * umbral con el que validation/edificio.js juzga sus solapes.
 *
 * @param {object} poliHueco     Polígono Turf del hueco.
 * @param {object} poliExterior  Polígono Turf del exterior.
 * @returns {number}  Área fuera, en m² (≥ 0).
 */
function areaFueraDelExterior(poliHueco, poliExterior) {
  const fuera = difference(featureCollection([poliHueco, poliExterior]))
  if (fuera === null) return 0
  let total = 0
  for (const piezaRecintos of recintosDeGeometriaTurf(fuera)) total += superficie(piezaRecintos)
  return total
}

/**
 * Índices de los vértices del hueco cuyos LADOS se apoyan en el contorno
 * exterior a lo largo de un tramo (aristas colineales y solapadas). Vacío si el
 * hueco solo toca el exterior en puntos aislados, o no lo toca.
 *
 * Aritmética propia (regla 6: de Turf, solo lo topológico booleano; una
 * proyección sobre un segmento es euclídea de la casa). Un lado del hueco se
 * apoya en un lado del exterior si:
 *   · sus DOS extremos quedan a < `OPERATIVOS.duplicadoMetros` (1 mm) de la
 *     RECTA del lado exterior — la misma tolerancia con la que el proyecto
 *     declara dos puntos coincidentes: un segmento recto o está en la línea del
 *     lindero o no lo está; y
 *   · el tramo común (proyección 1-D acotada al lado exterior) mide más de
 *     `OPERATIVOS.segmentoCortoMetros` (5 cm): por debajo, el propio proyecto
 *     trata un segmento como degenerado, y ese contacto ES un punto — que es
 *     válido ISO 19107 y no debe producir un falso positivo (auditoría V2).
 *
 * @param {Array<[number,number]>} verticesHueco     Anillo ABIERTO del hueco.
 * @param {Array<[number,number]>} verticesExterior  Anillo ABIERTO del exterior.
 * @returns {number[]}  Índices (ordenados, sin repetir) de vértices del hueco.
 */
function indicesApoyadosEnExterior(verticesHueco, verticesExterior) {
  const nH = verticesHueco.length
  const nE = verticesExterior.length
  const idx = new Set()
  for (let a = 0; a < nH; a++) {
    const h1 = verticesHueco[a]
    const h2 = verticesHueco[(a + 1) % nH]
    for (let b = 0; b < nE; b++) {
      const e1 = verticesExterior[b]
      const e2 = verticesExterior[(b + 1) % nE]
      const ex = e2[0] - e1[0]
      const ey = e2[1] - e1[1]
      const len = Math.hypot(ex, ey)
      if (len === 0) continue // lado exterior degenerado: lo señala reglas-geometria
      // Distancia perpendicular de cada extremo del lado del hueco a la RECTA
      // (no al segmento: el acotado va después, en la proyección 1-D).
      const d1 = Math.abs((h1[0] - e1[0]) * ey - (h1[1] - e1[1]) * ex) / len
      const d2 = Math.abs((h2[0] - e1[0]) * ey - (h2[1] - e1[1]) * ex) / len
      if (d1 > OPERATIVOS.duplicadoMetros || d2 > OPERATIVOS.duplicadoMetros) continue
      // Proyección de los extremos del lado del hueco sobre el lado exterior, en
      // metros desde e1, acotada a [0, len]: lo que quede es el tramo común.
      const t1 = ((h1[0] - e1[0]) * ex + (h1[1] - e1[1]) * ey) / len
      const t2 = ((h2[0] - e1[0]) * ex + (h2[1] - e1[1]) * ey) / len
      const comun = Math.min(len, Math.max(t1, t2)) - Math.max(0, Math.min(t1, t2))
      if (comun > OPERATIVOS.segmentoCortoMetros) {
        idx.add(a)
        idx.add((a + 1) % nH)
      }
    }
  }
  return [...idx].sort((x, y) => x - y)
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

  // Regla 2 — Hueco fuera del exterior (por ÁREA, no por vértices — auditoría
  // V1) y, si el área no delata nada, hueco APOYADO en el exterior a lo largo de
  // un tramo (auditoría V2). El exterior (polis[0]) es apto por el guard de
  // arriba. Un hallazgo por hueco: si se sale, «mover el hueco» ya obliga a
  // revisar su posición entera y el apoyo no aporta un segundo verbo.
  const poliExterior = polis[0]
  for (let i = 1; i < recintos.length; i++) {
    const poliHueco = polis[i]
    if (poliHueco === null) continue
    if (areaFueraDelExterior(poliHueco, poliExterior) > OPERATIVOS.areaNulaM2) {
      hallazgos.push(
        crearHallazgo(
          NIVEL.ERROR,
          `El hueco nº ${i} queda fuera del contorno exterior.`,
          refsAnillo(i, recintos[i].vertices.length),
          'Mover el hueco dentro de la parcela.',
        ),
      )
      continue
    }
    const apoyados = indicesApoyadosEnExterior(recintos[i].vertices, recintos[0].vertices)
    if (apoyados.length > 0) {
      hallazgos.push(
        crearHallazgo(
          NIVEL.ERROR,
          `El hueco nº ${i} se apoya en el contorno exterior a lo largo de un tramo: un anillo ` +
            `interior solo puede tocar el exterior en puntos aislados (ISO 19107).`,
          apoyados.map((v) => ref(i, v)),
          'Separar el hueco del contorno exterior.',
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

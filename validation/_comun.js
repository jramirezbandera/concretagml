// validation/_comun.js — F02 · Contrato y utilidades COMPARTIDAS de la validación.
//
// Este módulo NO valida ninguna regla concreta: fija el vocabulario común (NIVEL),
// el contrato del Hallazgo, la factory que lo construye y los helpers euclídeos y
// de adaptación a Turf que comparten reglas-geometria/reglas-topologia/reglas-huso.
// Es el análogo de parsers/_comun.js para la rama de validación.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — NADA silencioso. Cada regla materializa un {@link Hallazgo}; un
//     dato malo del USUARIO produce Hallazgos, nunca una excepción. El `throw` se
//     reserva para errores del PROGRAMADOR (contrato roto por el llamante).
//   · Regla 6 — Turf SOLO para topología (kinks/booleanContains/intersect), y en
//     otra tarea (reglas-topologia.js). Este módulo es aritmética PROPIA: no
//     importa turf. Solo prepara coordenadas (anillo abierto → cerrado GeoJSON).
//   · Regla 9 — las tolerancias viven en config/operativos.json (decisiones de
//     ingeniería), NO en un `umbrales.json` (prohibido). Se cargan aquí una vez.
//   · Override O1 — exterior HORARIO (A_signed<0), huecos antihorario. La
//     validación NO falla por orientación (se normaliza en F04); la convención se
//     usa solo si alguna regla emite un mensaje sobre orientación.
//
// Modelo que se valida (model/parcela.js): `recintos` = [{ vertices:[[x,y],…],
// tipo }] en UTM, ANILLOS ABIERTOS (sin repetir el cierre); recintos[0]=EXTERIOR.

import OPERATIVOS_RAW from '../config/operativos.json' with { type: 'json' }

/** Tolerancias operativas (config/operativos.json). Congeladas (regla 9). */
export const OPERATIVOS = Object.freeze({ ...OPERATIVOS_RAW })

// ── Vocabulario ───────────────────────────────────────────────────────────────

/**
 * Nivel de un {@link Hallazgo}. ERROR bloquea la generación (F04); AVISO no.
 * Errores y avisos son categorías SEPARADAS: nunca se suman en un mismo recuento.
 * @readonly
 */
export const NIVEL = Object.freeze({ ERROR: 'ERROR', AVISO: 'AVISO' })

// ── Typedefs del contrato ───────────────────────────────────────────────────

/**
 * Referencia a un vértice del modelo: qué recinto y qué índice DENTRO del anillo
 * ABIERTO. Se usa `{recinto,indice}` (no un índice pelado) porque hay reglas que
 * cruzan anillos (hueco fuera del exterior, huecos solapados) y la UI (F03) debe
 * saber qué recinto resaltar.
 *
 * @typedef {Object} RefVertice
 * @property {number} recinto  Índice en `recintos` (0 = EXTERIOR).
 * @property {number} indice   Índice del vértice en `recintos[recinto].vertices`.
 */

/**
 * Un hallazgo de validación. POJO plano.
 *
 * @typedef {Object} Hallazgo
 * @property {'ERROR'|'AVISO'} nivel
 * @property {string} mensaje                Texto legible (español) para la UI.
 * @property {RefVertice[]} verticesAfectados  Vértices implicados (puede ir vacío).
 * @property {string} [correccion]           Solo en errores: la acción con su VERBO
 *   ("Eliminar vértice duplicado", no "Corregir"). Ausente en avisos.
 */

// ── Factory de hallazgos ────────────────────────────────────────────────────

/**
 * Crea un {@link Hallazgo} validando la forma. LANZA si el llamante (una regla)
 * rompe el contrato — eso es un bug del programa, no un dato del usuario (regla 1).
 *
 * @param {'ERROR'|'AVISO'} nivel
 * @param {string} mensaje                Texto no vacío.
 * @param {RefVertice[]} [verticesAfectados=[]]  Cada entrada `{recinto,indice}` con enteros ≥0.
 * @param {string|null} [correccion=null]  Verbo de corrección (solo tiene sentido en ERROR).
 * @returns {Hallazgo}
 * @throws {RangeError} Si `nivel` no está en {@link NIVEL}.
 * @throws {TypeError}  Si `mensaje`, `verticesAfectados` o `correccion` no cumplen la forma.
 */
export function crearHallazgo(nivel, mensaje, verticesAfectados = [], correccion = null) {
  const nivelesValidos = Object.values(NIVEL)
  if (!nivelesValidos.includes(nivel)) {
    throw new RangeError(
      `crearHallazgo: 'nivel' inválido: ${JSON.stringify(nivel)}. Válidos: ${nivelesValidos.join(', ')}.`,
    )
  }
  if (typeof mensaje !== 'string' || mensaje.length === 0) {
    throw new TypeError(
      `crearHallazgo: 'mensaje' debe ser un string no vacío; recibido ${JSON.stringify(mensaje)}.`,
    )
  }
  if (!Array.isArray(verticesAfectados)) {
    throw new TypeError(
      `crearHallazgo: 'verticesAfectados' debe ser un array; recibido ${typeof verticesAfectados}.`,
    )
  }
  const vAfectados = verticesAfectados.map((r, i) => {
    if (
      !r ||
      typeof r !== 'object' ||
      !Number.isInteger(r.recinto) || r.recinto < 0 ||
      !Number.isInteger(r.indice) || r.indice < 0
    ) {
      throw new TypeError(
        `crearHallazgo: verticesAfectados[${i}] debe ser {recinto:int≥0, indice:int≥0}; recibido ${JSON.stringify(r)}.`,
      )
    }
    return { recinto: r.recinto, indice: r.indice }
  })

  const h = { nivel, mensaje, verticesAfectados: vAfectados }
  if (correccion !== null) {
    if (typeof correccion !== 'string' || correccion.length === 0) {
      throw new TypeError(
        `crearHallazgo: 'correccion' debe ser un string no vacío o null; recibido ${JSON.stringify(correccion)}.`,
      )
    }
    h.correccion = correccion
  }
  return h
}

/** Azúcar para construir una {@link RefVertice}. */
export const ref = (recinto, indice) => ({ recinto, indice })

/**
 * Refs {recinto,indice} de TODOS los vértices de un anillo (0..n-1). Helper
 * compartido: lo usan reglas-geometria (superficie nula/pequeña, insuficientes) y
 * reglas-topologia (hueco fuera, huecos solapados) para señalar el anillo entero.
 *
 * @param {number} recinto  Índice del recinto en `recintos`.
 * @param {number} n        Nº de vértices del anillo (abierto). n===0 ⇒ [].
 * @returns {RefVertice[]}
 */
export const refsAnillo = (recinto, n) => Array.from({ length: n }, (_, i) => ref(recinto, i))

// ── Helpers euclídeos PROPIOS (regla 6: nunca turf.distance/turf.length) ──────

/**
 * Distancia euclídea entre dos vértices UTM (metros). La métrica es plana sobre la
 * proyección, coherente con el resto del motor (geo/area.js).
 * @param {[number,number]} a
 * @param {[number,number]} b
 * @returns {number}
 */
export const distancia = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1])

/**
 * Ángulo interior en el vértice `v` formado por los segmentos v→prev y v→next, en
 * GRADOS dentro de [0, 180]. Un valor cercano a 180° indica que `v` es casi
 * colineal con sus vecinos. Si algún vecino coincide con `v` (segmento nulo) el
 * ángulo es 0 por convención; detectar duplicados es de reglas-geometria.
 *
 * @param {[number,number]} prev
 * @param {[number,number]} v
 * @param {[number,number]} next
 * @returns {number}  Ángulo en grados, [0, 180].
 */
export function anguloVertice(prev, v, next) {
  const ux = prev[0] - v[0], uy = prev[1] - v[1]
  const wx = next[0] - v[0], wy = next[1] - v[1]
  const dot = ux * wx + uy * wy
  const cross = ux * wy - uy * wx
  return Math.abs(Math.atan2(cross, dot)) * (180 / Math.PI)
}

// ── Adaptación a Turf (SOLO preparación de coordenadas; sin importar turf) ────

/**
 * Cierra un anillo ABIERTO del modelo repitiendo el primer vértice al final, como
 * exige GeoJSON/Turf. Devuelve una COPIA (no muta la entrada). Si ya viniera
 * cerrado, se copia tal cual.
 *
 * @param {Array<[number,number]>} anillo  Anillo abierto en UTM.
 * @returns {Array<[number,number]>}  Anillo cerrado (primer=último).
 */
export function anilloCerrado(anillo) {
  const n = anillo.length
  if (n === 0) return []
  const copia = anillo.map((p) => [p[0], p[1]])
  const [fx, fy] = copia[0]
  const [lx, ly] = copia[n - 1]
  if (fx === lx && fy === ly) return copia
  copia.push([fx, fy])
  return copia
}

/**
 * Coordenadas GeoJSON de un recinto como polígono de un solo anillo:
 * `[ anilloCerrado(recinto.vertices) ]`. Listo para `polygon(coordsPoligono(r))`
 * de @turf/helpers en reglas-topologia.js. Turf corre directamente sobre UTM.
 *
 * @param {{vertices: Array<[number,number]>}} recinto
 * @returns {Array<Array<[number,number]>>}
 */
export const coordsPoligono = (recinto) => [anilloCerrado(recinto.vertices)]

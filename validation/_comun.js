// validation/_comun.js — F02 · Contrato y utilidades COMPARTIDAS de la validación.
//
// Este módulo NO valida ninguna regla concreta: fija el vocabulario común (NIVEL),
// el contrato del Hallazgo, la factory que lo construye y los helpers euclídeos y
// de adaptación a Turf que comparten reglas-geometria/reglas-topologia/reglas-huso.
// Es el análogo de parsers/_comun.js para la rama de validación.
//
// Varios de esos «helpers» ya no se definen aquí, se RE-EXPORTAN: `OPERATIVOS`
// viene de `config/operativos.js` y `distancia` de `geo/metrica.js` (F06, T1.2);
// `anilloCerrado` y `coordsPoligono`, de `geo/poligono.js` (F07, T1.1). Vivían en
// este fichero solo porque F02 fue quien primero los necesitó, y eso obligaba a
// las capas de edición y de diagnóstico a depender de la de VALIDACIÓN para leer
// una constante, medir una hipotenusa o cerrar un anillo. La API pública de este
// módulo no cambia: sus consumidores siguen importándolos de aquí. Es el mismo
// movimiento que hizo `viewer/_comun.js` con `NIVEL`, y por el mismo motivo — una
// sola definición en todo el proyecto ⇒ nada puede divergir.
//
// Fronteras de responsabilidad (SPEC §2):
//   · Regla 1 — NADA silencioso. Cada regla materializa un {@link Hallazgo}; un
//     dato malo del USUARIO produce Hallazgos, nunca una excepción. El `throw` se
//     reserva para errores del PROGRAMADOR (contrato roto por el llamante).
//   · Regla 6 — Turf SOLO para topología (kinks/booleanContains/intersect), y en
//     otra tarea (reglas-topologia.js). Este módulo es aritmética PROPIA: no
//     importa turf, ni directa ni indirectamente. Lo único que hace por Turf es
//     preparar coordenadas (anillo abierto → cerrado GeoJSON), y eso ya vive en
//     `geo/poligono.js` — que tampoco importa turf — y se re-exporta al final.
//   · Regla 9 — las tolerancias viven en config/operativos.json (decisiones de
//     ingeniería), NO en un `umbrales.json` (prohibido). Las carga UNA sola vez
//     `config/operativos.js`, que es de donde este módulo las re-exporta.
//   · Override O1 — exterior HORARIO (A_signed<0), huecos antihorario. La
//     validación NO falla por orientación (se normaliza en F04); la convención se
//     usa solo si alguna regla emite un mensaje sobre orientación.
//
// Modelo que se valida (model/parcela.js): `recintos` = [{ vertices:[[x,y],…],
// tipo }] en UTM, ANILLOS ABIERTOS (sin repetir el cierre); recintos[0]=EXTERIOR.

/**
 * Tolerancias operativas (`config/operativos.json`), congeladas (regla 9).
 * **Re-exportadas de `config/operativos.js`, no redefinidas aquí** (F06, T1.2):
 * el cargador vivía en este módulo porque F02 fue quien primero lo necesitó,
 * pero la edición (F06) también lee tolerancias —`snapMetros`— y tenerlo aquí
 * obligaba a `edit/` a importar de `validation/` para leer una constante: una
 * dependencia al revés. El cargador está ahora en un módulo NEUTRO que no
 * depende de nadie, y este re-export mantiene intacta la API de F02: quien
 * importaba `OPERATIVOS` de aquí sigue haciéndolo. Un solo objeto congelado en
 * memoria para todo el proyecto ⇒ imposible que dos capas midan con reglas
 * distintas. El porqué de cada cifra está en el JSDoc de `config/operativos.js`.
 *
 * Sigue siendo seguro importar este módulo bajo el proyecto Vitest `node`: el
 * `with { type: 'json' }` no ha desaparecido, se ha mudado un fichero más allá.
 */
export { OPERATIVOS } from '../config/operativos.js'

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
 * Este typedef es la ÚNICA definición del tipo en el proyecto: `viewer/_comun.js`
 * lo ALIASA (`@typedef {import('../validation/_comun.js').RefVertice}`) en vez de
 * re-declararlo, para que la tabla de vértices de F03 y el resaltado de F02 no
 * puedan divergir (auditoría de coherencia 2C.2, hallazgo 2.10).
 *
 * @typedef {Object} RefVertice
 * @property {number} recinto  Índice en `recintos`: **0 = EXTERIOR; ≥1 = HUECO**
 *   (invariante de `model/parcela.js`).
 * @property {number} indice   Índice del vértice en `recintos[recinto].vertices`,
 *   0-based y sobre el anillo **ABIERTO** (sin el vértice de cierre).
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
 *
 * **Re-exportada de `geo/metrica.js`, no redefinida aquí** (F06, T1.2), por el
 * mismo motivo que {@link OPERATIVOS} arriba: la edición (F06) y las acotaciones
 * (F09) también miden distancias, y no pueden depender de la capa de validación
 * para calcular una hipotenusa. La aritmética vive en `geo/`, junto a
 * `geo/area.js`; este módulo la re-exporta para que las reglas de F02
 * (`reglas-geometria.js`, `reglas-topologia.js`) sigan importándola de aquí sin
 * cambios. Una sola definición en todo el proyecto.
 *
 * `geo/metrica.js` añade además `longitudesDeLados`, `perimetroAnillo` y
 * `perimetro`: si una regla nueva necesita medir un anillo entero, se importan
 * de allí y no se re-exportan aquí (esto es el contrato de F02, no un barrel).
 */
export { distancia } from '../geo/metrica.js'

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
 * Cierre de anillo (`anilloCerrado`: anillo ABIERTO del modelo → anillo cerrado
 * GeoJSON, en una copia) y coordenadas de polígono de un recinto
 * (`coordsPoligono`: `[ anilloCerrado(recinto.vertices) ]`, listo para
 * `polygon(...)` de @turf/helpers en `reglas-topologia.js`). Turf corre
 * directamente sobre UTM.
 *
 * **Re-exportadas de `geo/poligono.js`, no redefinidas aquí** (F07, T1.1), por el
 * mismo motivo que {@link OPERATIVOS} y {@link distancia} arriba: el diagnóstico
 * de encaje (`diagnostico/`, F07) también tiene que cerrar anillos para hablar con
 * Turf —el solape con la geometría oficial y la invasión a colindantes son
 * `intersect`— y no puede depender de la capa de VALIDACIÓN para eso. La
 * adaptación vive en `geo/`, junto a `geo/area.js` y `geo/metrica.js`, y este
 * re-export mantiene intacta la API de F02: `reglas-topologia.js` sigue
 * importándolas de aquí sin cambios. Una sola definición en todo el proyecto.
 *
 * `geo/poligono.js` añade además la dirección INVERSA
 * (`recintosDeGeometriaTurf`: la geometría que devuelve una booleana de Turf →
 * `recintos` del modelo, en LISTA porque la intersección puede salir en varias
 * piezas disjuntas). No se re-exporta aquí: F02 no la necesita y este módulo es
 * el contrato de la validación, no un barrel.
 *
 * ⚠️ **`esRecintoApto` se une al re-export en F17** (tarea 1.1). Estaba escrita
 * TRES veces con el mismo razonamiento —aquí en `reglas-topologia.js`, en
 * `diagnostico/topologia.js`, y habría hecho falta una cuarta en `derivacion/`— y
 * lo que define es «cuántos vértices necesita un anillo para que Turf lo acepte»,
 * que depende del FORMATO del anillo y por tanto es de `geo/`. Misma jugada que
 * `anilloCerrado` en F07: baja una vez y sube re-exportada, sin tocar a quien la
 * usaba.
 */
export { anilloCerrado, coordsPoligono, esRecintoApto } from '../geo/poligono.js'

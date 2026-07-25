// geo/cierre.js — F00 · Compensación del error de cierre de polígonos.
//
// Contexto (PLAN §5.5 "Cierre que no cierra", §2.2): en un levantamiento
// (LIST/TXT) el usuario introduce un polígono cuya secuencia de vértices
// "debería" cerrar (el último vértice coincide con el primero) pero, por error
// de medición, no cierra exactamente.
//
// Regla de oro 1 (SPEC §2): NINGÚN error silencioso. Este módulo NI falla NI
// cierra en silencio: mide el error de cierre ("misclosure") y lo distribuye
// entre los vértices, devolviendo SIEMPRE el error para que el llamante informe
// al usuario y ofrezca compensarlo.
//
// Modelo (regla de oro 4): los anillos se guardan ABIERTOS (sin repetir el
// vértice de cierre). `compensarCierre` recibe el anillo de ENTRADA —que trae el
// vértice de cierre casi-duplicado— y devuelve el anillo ABIERTO ya compensado.
//
// Distancias euclídeas propias con `Math.hypot` (UTM en metros); NUNCA
// `turf.distance` / `turf.length` (regla de oro 6).

// Misclosure por debajo del cual no hay nada que repartir (1 nm; despreciable).
const TOL_CIERRE_POR_DEFECTO = 1e-9

/** Distancia euclídea entre dos vértices [x,y] (metros UTM). */
function distancia(a, b) {
  return Math.hypot(a[0] - b[0], a[1] - b[1])
}

/** Valida que `anillo` sea un array de vértices [x,y] numéricos y finitos. */
function validarAnillo(anillo) {
  if (!Array.isArray(anillo)) {
    throw new TypeError('cierre: el anillo debe ser un array de vértices [x,y].')
  }
  if (anillo.length < 2) {
    throw new RangeError('cierre: el anillo necesita al menos 2 vértices.')
  }
  for (const v of anillo) {
    if (
      !Array.isArray(v) ||
      v.length < 2 ||
      !Number.isFinite(v[0]) ||
      !Number.isFinite(v[1])
    ) {
      throw new TypeError('cierre: cada vértice debe ser [x,y] numérico y finito.')
    }
  }
}

/**
 * Error de cierre (misclosure): distancia euclídea entre el primer y el último
 * vértice del anillo de ENTRADA (que puede venir con un vértice de cierre
 * casi-duplicado).
 *
 * @param {number[][]} anillo  Vértices [x,y] en UTM (metros).
 * @returns {number}  Distancia primer↔último vértice.
 */
export function errorCierre(anillo) {
  validarAnillo(anillo)
  return distancia(anillo[0], anillo[anillo.length - 1])
}

/**
 * Compensa el error de cierre repartiéndolo entre los vértices, elimina el
 * vértice de cierre duplicado y devuelve el anillo ABIERTO ya compensado.
 *
 * Método de reparto:
 *  - `bowditch` (por defecto): regla de la brújula/Bowditch. La corrección de
 *    cada vértice es proporcional a la longitud acumulada del recorrido hasta
 *    ese vértice: c_k = −e · (S_k / P), con e = misclosure (vector), S_k la
 *    longitud acumulada hasta V_k y P el perímetro del recorrido de entrada.
 *    El primer vértice queda fijo (S_0 = 0) y el vértice de cierre (S = P)
 *    recibiría −e y coincidiría exactamente con el primero: por eso se elimina.
 *  - `lineal` (fallback documentado): reparto proporcional al índice del
 *    vértice, c_k = −e · k/(n−1). Se usa también si el perímetro es 0
 *    (todos los vértices coincidentes) para evitar división por cero.
 *
 * NUNCA cierra en silencio: devuelve siempre `error` (misclosure original).
 *
 * @param {number[][]} anillo  Anillo de ENTRADA con vértice de cierre (V_last ≈ V_0).
 * @param {{metodo?: 'bowditch'|'lineal', tol?: number}} [opciones]
 * @returns {{anillo: number[][], error: number, aplicado: boolean}}
 *   `anillo`: anillo ABIERTO compensado (n−1 vértices); `error`: misclosure
 *   original; `aplicado`: true si se distribuyó el error (misclosure > tol).
 */
export function compensarCierre(anillo, opciones = {}) {
  validarAnillo(anillo)

  const metodo = opciones.metodo ?? 'bowditch'
  const tol = opciones.tol ?? TOL_CIERRE_POR_DEFECTO
  if (metodo !== 'bowditch' && metodo !== 'lineal') {
    throw new RangeError(
      `cierre: método desconocido '${metodo}' (usa 'bowditch' o 'lineal').`,
    )
  }

  const n = anillo.length
  const primero = anillo[0]
  const ultimo = anillo[n - 1]

  // Misclosure: vector (e) y módulo (error). e apunta del primero al vértice
  // de cierre; hay que restarlo, repartido, para volver a cerrar.
  const ex = ultimo[0] - primero[0]
  const ey = ultimo[1] - primero[1]
  const error = Math.hypot(ex, ey)

  // Anillo ABIERTO: quitamos el vértice de cierre (el último) y copiamos cada
  // vértice para no mutar la entrada.
  const abierto = new Array(n - 1)
  for (let i = 0; i < n - 1; i++) abierto[i] = [anillo[i][0], anillo[i][1]]

  // Sin misclosure apreciable: nada que repartir. Devolvemos el anillo abierto
  // intacto, pero SIEMPRE con el error medido (no se cierra en silencio).
  if (error <= tol) {
    return { anillo: abierto, error, aplicado: false }
  }

  // Pesos de reparto w_k ∈ [0,1] por vértice k (0..n−1); w_0 = 0, w_{n−1} = 1.
  const pesos = new Array(n).fill(0)
  let metodoUsado = metodo

  if (metodo === 'bowditch') {
    // Longitud acumulada S_k a lo largo del recorrido de entrada (incluye la
    // arista de cierre V_{n−2}→V_{n−1}).
    let perimetro = 0
    const acum = new Array(n).fill(0)
    for (let k = 1; k < n; k++) {
      perimetro += distancia(anillo[k - 1], anillo[k])
      acum[k] = perimetro
    }
    if (perimetro > 0) {
      for (let k = 0; k < n; k++) pesos[k] = acum[k] / perimetro
    } else {
      // Degenerado (vértices coincidentes): fallback lineal documentado.
      metodoUsado = 'lineal'
    }
  }

  if (metodoUsado === 'lineal') {
    for (let k = 0; k < n; k++) pesos[k] = k / (n - 1)
  }

  // Aplicar corrección c_k = −e · w_k a los vértices del anillo abierto.
  // El vértice de cierre (k = n−1, w = 1) se ha eliminado: su corrección lo
  // llevaría exactamente al primero.
  for (let k = 0; k < n - 1; k++) {
    abierto[k][0] -= ex * pesos[k]
    abierto[k][1] -= ey * pesos[k]
  }

  return { anillo: abierto, error, aplicado: true }
}

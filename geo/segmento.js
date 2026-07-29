// geo/segmento.js — F06 · Proyección punto→segmento e intersección de rectas.
//
// Las dos primitivas euclídeas que necesita la edición de parcela (F06) y que
// este proyecto NO puede tomar de Turf: `nearestPointOnLine`, `distance` y
// `length` son métricas ESFÉRICAS en grados y están PROHIBIDAS sobre UTM
// (SPEC §2 regla 6, dossier §3.4). Aquí se implementan a mano, en el plano de
// la proyección, con `Math.hypot` (que ni desborda ni pierde precisión en los
// extremos, a diferencia de `Math.sqrt(dx*dx + dy*dy)`).
//
// Fórmulas (dossier §3.6 «Algoritmos de edición»):
//   · Snap a lindero — proyección punto→segmento:
//       t = dot(P−A, AB) / dot(AB, AB);  t ← clamp(t, 0, 1);  F = A + t·AB
//     El vértice solo se INSERTA si 0 < t < 1 (si el pie cae en un extremo ya
//     hay vértice ahí); por eso el resultado lleva `enExtremo`.
//   · Offset perpendicular — el lindero desplazado se corta con las rectas de
//     los linderos vecinos. Si esas rectas son casi paralelas, el corte se
//     dispara: la velocidad del vértice va como 1/sin(θ/2) y diverge en ángulos
//     agudos. Por eso `intersectarRectas` NO devuelve un punto en ese caso: se
//     declara `paralelas` y el llamante hace el fallback (traslación/bevel).
//
// PRECISIÓN — regla de oro 5, el punto que hay que entender de este fichero.
// Las coordenadas son UTM en metros: X ≈ 4·10⁵ y, sobre todo, Y ≈ 4·10⁶. Todos
// los productos se hacen sobre coordenadas YA TRASLADADAS a un origen local
// (`A` en la proyección, `P` en la intersección) ANTES de multiplicar. Con las
// coordenadas absolutas los productos valdrían ≈ 2·10¹³, cuyo ulp float64 es
// ≈ 4·10⁻³ m: la cancelación catastrófica se comería los milímetros del
// levantamiento. Trasladando, los operandos son decenas de metros y el
// resultado es exacto muy por debajo del picómetro. `geo/area.js` hace
// exactamente lo mismo con el shoelace, y por el mismo motivo.
//
// SIN CONFIGURACIÓN. Es un módulo `geo/`: puro, sin DOM, sin estado y sin
// dependencias — tampoco de `config/`. El umbral de paralelismo entra por
// opción, con `SENO_MINIMO_DEFECTO` como valor de reserva. En F06 será
// `edit/offset.js` quien le pase el valor de
// `config/operativos.json#senoMinimoOffset`; la lectura de configuración vive
// en `edit/`, nunca aquí.
//
// Regla de oro 1 (ningún error silencioso), con la frontera bien marcada:
//   · Contrato roto por el PROGRAMADOR (no es [x,y], no son números finitos)
//     → `TypeError` que nombra el argumento y lo recibido.
//   · Caso GEOMÉTRICO legítimo (segmento degenerado, rectas paralelas, vector
//     director nulo) → NO lanza: es un dato posible del modelo (un vértice
//     duplicado, dos linderos alineados) y se devuelve DESCRITO en el
//     resultado, para que el llamante decida y avise al usuario.

/**
 * Seno mínimo por defecto para considerar que dos rectas se cortan: 0.01, es
 * decir ≈ 0,573°.
 *
 * Es un seno de directores NORMALIZADOS, así que es ADIMENSIONAL: no depende de
 * la longitud de los vectores ni de la escala de las coordenadas. Ese es el
 * motivo de normalizar — un `cross(r, s)` crudo comparado contra un épsilon
 * mezcla ángulo con escala y deja de significar nada.
 *
 * Por qué 0,573°: en el offset de un lindero, el desplazamiento del vértice va
 * como 1/sin θ. Con sin θ = 0.01, mover el lindero 1 m mueve el vértice 100 m —
 * ya no es una edición, es un artefacto. Por debajo de ese umbral el llamante
 * debe hacer fallback (traslación/bevel, «miter limit»), no confiar en el corte.
 *
 * F06 lo sustituirá por `config/operativos.json#senoMinimoOffset` pasado como
 * opción desde `edit/offset.js`.
 */
export const SENO_MINIMO_DEFECTO = 0.01

/**
 * Longitud (m) por debajo de la cual un segmento o un vector director se
 * consideran NULOS: 1e-12 m (un picómetro).
 *
 * No es una tolerancia de ingeniería, es el umbral de «esto ya no define una
 * dirección». Referencia: a Y ≈ 4,48·10⁶ el ulp de float64 es ≈ 9,3·10⁻¹⁰ m, de
 * modo que dos coordenadas UTM DISTINTAS nunca caen por debajo; el umbral solo
 * captura extremos realmente coincidentes y vectores construidos casi a cero.
 */
export const LONGITUD_NULA_METROS = 1e-12

/** True si `P` es un punto/vector plano válido: `[x, y]` con ambos finitos. */
function esPuntoFinito(P) {
  return (
    Array.isArray(P) &&
    P.length === 2 &&
    Number.isFinite(P[0]) &&
    Number.isFinite(P[1])
  )
}

/**
 * Guarda de contrato (regla de oro 1): lanza nombrando el argumento y lo
 * recibido. Un dato malformado es un bug del programa, no un caso geométrico.
 */
function exigirPunto(valor, nombre, funcion) {
  if (!esPuntoFinito(valor)) {
    throw new TypeError(
      `${funcion}: ${nombre} debe ser [x,y] con dos números finitos (UTM, m); ` +
        `recibido ${JSON.stringify(valor)}.`,
    )
  }
}

/**
 * Proyecta el punto `P` sobre el SEGMENTO `A`→`B` (snap a lindero, dossier §3.6).
 *
 *   t = clamp( dot(P−A, AB) / dot(AB, AB), 0, 1 )      F = A + t·AB
 *
 * El recorte a [0,1] es lo que distingue el segmento de la recta: si el pie de
 * la perpendicular cae fuera, el punto más próximo del segmento es su extremo.
 *
 * Todo el cálculo se hace en coordenadas trasladadas a `A` (regla de oro 5), y
 * `distancia` se mide TAMBIÉN en local: obtenerla como |P − punto| sobre las
 * coordenadas UTM absolutas volvería a introducir el redondeo que la traslación
 * acaba de evitar.
 *
 * Segmento DEGENERADO (`A` y `B` coincidentes, |AB| ≤ {@link LONGITUD_NULA_METROS}):
 * NO lanza — un vértice duplicado es un dato posible del modelo y lo detecta la
 * validación (F02), no esta función. Se devuelve `t = 0`, `punto = A`,
 * `enExtremo = 'A'` y la distancia real |P − A|.
 *
 * @param {[number, number]} P  Punto a proyectar, UTM [x=Este, y=Norte] en metros.
 * @param {[number, number]} A  Extremo inicial del segmento, UTM.
 * @param {[number, number]} B  Extremo final del segmento, UTM.
 * @returns {{
 *   punto: [number, number],      // pie de la proyección F, en UTM (m).
 *   t: number,                    // parámetro YA recortado a [0,1].
 *   distancia: number,            // |P − F| euclídea en metros (Math.hypot).
 *   enExtremo: 'A' | 'B' | null,  // 'A' si t===0, 'B' si t===1, null si 0<t<1.
 * }}
 *   `enExtremo` es la respuesta a «¿puedo insertar un vértice aquí?»: solo si
 *   es `null` (0 < t < 1) el pie cae en el interior del lindero y hay vértice
 *   nuevo que insertar; en un extremo el vértice ya existe.
 * @throws {TypeError} Si `P`, `A` o `B` no son `[x,y]` con dos números finitos.
 */
export function proyectarEnSegmento(P, A, B) {
  exigirPunto(P, 'P', 'proyectarEnSegmento')
  exigirPunto(A, 'A', 'proyectarEnSegmento')
  exigirPunto(B, 'B', 'proyectarEnSegmento')

  // Traslación a origen local: A pasa a ser (0,0). A partir de aquí se opera
  // con decenas de metros, no con UTM de 4·10⁶ (regla de oro 5).
  const px = P[0] - A[0]
  const py = P[1] - A[1]
  const bx = B[0] - A[0]
  const by = B[1] - A[1]

  const largo2 = bx * bx + by * by

  // Segmento degenerado: A y B coinciden. Caso geométrico legítimo → se
  // describe, no se lanza. El punto más próximo del «segmento» es A.
  if (largo2 <= LONGITUD_NULA_METROS * LONGITUD_NULA_METROS) {
    return {
      punto: [A[0], A[1]],
      t: 0,
      distancia: Math.hypot(px, py),
      enExtremo: 'A',
    }
  }

  const bruto = (px * bx + py * by) / largo2
  const t = bruto <= 0 ? 0 : bruto >= 1 ? 1 : bruto

  // Pie de la proyección, aún en coordenadas locales.
  const fx = t * bx
  const fy = t * by

  return {
    punto: [A[0] + fx, A[1] + fy],
    t,
    distancia: Math.hypot(px - fx, py - fy),
    enExtremo: t === 0 ? 'A' : t === 1 ? 'B' : null,
  }
}

/**
 * Corta las dos RECTAS paramétricas `P + t·r` y `Q + u·s` (dossier §3.6, guarda
 * de paralelismo del offset).
 *
 * Son rectas INFINITAS, no segmentos: el corte puede caer fuera de los tramos
 * que las originaron. Eso es justo lo que quiere el offset, que reconstruye los
 * vértices cortando linderos prolongados.
 *
 *   ŝ, r̂ = directores normalizados;  seno = cross(r̂, ŝ)
 *   a     = cross(Q−P, ŝ) / seno         (distancia con signo desde P a lo largo de r̂)
 *   punto = P + a·r̂
 *
 * `seno` sale de directores NORMALIZADOS a propósito: así es adimensional y ES
 * el seno del ángulo entre las rectas, comparable contra una tolerancia angular
 * con sentido físico. Un `cross(r, s)` sin normalizar crecería con la longitud
 * de los vectores y obligaría a un épsilon dependiente de la escala, que es
 * exactamente el tipo de umbral que no significa nada.
 *
 * La traslación a origen local (aquí `w = Q − P`) es de nuevo la regla de oro 5.
 *
 * Casos geométricos legítimos — NO lanzan, se describen en el resultado:
 *   · |seno| < `senoMinimo` (rectas paralelas o casi) → `punto: null`,
 *     `paralelas: true`. El llamante debe hacer fallback (bevel), porque el
 *     corte real estaría a una distancia absurda o no existiría.
 *   · Vector director nulo (|r| o |s| ≤ {@link LONGITUD_NULA_METROS}) → no hay
 *     recta que cortar: `punto: null`, `paralelas: true`, `seno: 0`.
 *
 * @param {[number, number]} P  Punto de paso de la primera recta, UTM (m).
 * @param {[number, number]} r  Vector director de la primera recta (m, no unitario).
 * @param {[number, number]} Q  Punto de paso de la segunda recta, UTM (m).
 * @param {[number, number]} s  Vector director de la segunda recta (m, no unitario).
 * @param {{ senoMinimo?: number }} [opciones]  `senoMinimo` ∈ [0,1): seno por
 *   debajo del cual las rectas se declaran paralelas. Por defecto
 *   {@link SENO_MINIMO_DEFECTO}. F06 le pasará
 *   `config/operativos.json#senoMinimoOffset` desde `edit/offset.js`.
 * @returns {{
 *   punto: [number, number] | null,  // corte en UTM (m); null si paralelas.
 *   paralelas: boolean,              // true ⇒ no hay corte utilizable.
 *   seno: number,                    // cross(r̂, ŝ) CON SIGNO, adimensional.
 * }}
 *   El signo de `seno` dice de qué lado queda `s` respecto de `r` (>0 = giro
 *   antihorario de r̂ a ŝ) y se invierte al intercambiar las rectas.
 * @throws {TypeError} Si `P`, `r`, `Q` o `s` no son `[x,y]` finitos, o si
 *   `senoMinimo` no es un número en [0,1).
 */
export function intersectarRectas(P, r, Q, s, { senoMinimo = SENO_MINIMO_DEFECTO } = {}) {
  exigirPunto(P, 'P', 'intersectarRectas')
  exigirPunto(r, 'r', 'intersectarRectas')
  exigirPunto(Q, 'Q', 'intersectarRectas')
  exigirPunto(s, 's', 'intersectarRectas')
  if (!Number.isFinite(senoMinimo) || senoMinimo < 0 || senoMinimo >= 1) {
    throw new TypeError(
      `intersectarRectas: senoMinimo debe ser un número en [0,1) (es un seno, ` +
        `adimensional); recibido ${senoMinimo}.`,
    )
  }

  const lr = Math.hypot(r[0], r[1])
  const ls = Math.hypot(s[0], s[1])

  // Director nulo: no hay recta. Caso legítimo (dos vértices coincidentes en el
  // anillo de origen) → se describe, no se lanza.
  if (lr <= LONGITUD_NULA_METROS || ls <= LONGITUD_NULA_METROS) {
    return { punto: null, paralelas: true, seno: 0 }
  }

  const rx = r[0] / lr
  const ry = r[1] / lr
  const sx = s[0] / ls
  const sy = s[1] / ls

  // Seno del ángulo entre las rectas = producto vectorial de los UNITARIOS.
  const seno = rx * sy - ry * sx

  // `seno === 0` se comprueba aparte para que `senoMinimo: 0` (permitido) no
  // acabe dividiendo por cero: paralelas exactas siguen siendo paralelas.
  if (seno === 0 || Math.abs(seno) < senoMinimo) {
    return { punto: null, paralelas: true, seno }
  }

  // Traslación a origen local: w = Q − P son metros, no coordenadas de 4·10⁶.
  const wx = Q[0] - P[0]
  const wy = Q[1] - P[1]

  // a = distancia CON SIGNO desde P hasta el corte, medida a lo largo de r̂.
  const a = (wx * sy - wy * sx) / seno

  return { punto: [P[0] + a * rx, P[1] + a * ry], paralelas: false, seno }
}

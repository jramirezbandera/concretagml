// geo/arco.js — Discretización de arcos DXF (bulge, código 42) sobre UTM.
//
// El GML del Catastro NO admite arcos: hay que sustituir cada arco por una
// polilínea de cuerdas. Ignorar el código 42 convierte el arco en su cuerda
// (el comando CONTORNO de AutoCAD, que todos usan, genera arcos). Ver
// spec/feature-01-entrada-parcela.md § "Discretización de arcos DXF".
//
// GEOMETRÍA EUCLÍDEA PLANA sobre coordenadas UTM en METROS. Aquí NO hay husos
// ni lat/lon (regla de oro 3): P1, P2 son [x=Este, y=Norte] en metros y todo
// lo que sale son puntos en el mismo sistema. Solo helpers propios (Math.hypot,
// Math.atan2…), nunca turf.distance/midpoint/bearing (regla de oro 6).
//
// Definición del bulge b (código DXF 42) entre P1 y P2:
//   b = tan(Δθ/4)   ⇒   Δθ = 4·atan(b)      (ángulo barrido, CON signo)
//   · b > 0 ⇒ Δθ > 0 ⇒ arco ANTIHORARIO (CCW) de P1 a P2.
//   · b < 0 ⇒ Δθ < 0 ⇒ arco HORARIO (CW).
//   · b = 0 ⇒ segmento RECTO (cuerda), sin arco.
//   c = |P2 − P1| (longitud de la cuerda);  R = c·(1+b²)/(4·|b|) (radio > 0);
//   M = (P1+P2)/2;  C = M + sign(b)·apo·n̂  con apo = R·cos(Δθ/2) y n̂ la
//   perpendicular unitaria IZQUIERDA a (P2−P1). apo se vuelve negativo para
//   arcos mayores (|Δθ| > π, |b| > 1), lo que coloca el centro en el lado
//   correcto sin casos especiales.
//
// Subdivisión por FLECHA (sagitta), NO por número fijo de tramos: se exige que
// la flecha de cada cuerda ≤ ε (0,01 m = 1 cm por defecto, parametrizable).
//   δ_max = 2·acos(1 − ε/R)   (ángulo máximo por tramo para flecha ≤ ε)
//   n_seg = ceil(|Δθ| / δ_max) (≥ 1)
//
// Reporte de variación de superficie (regla de oro 1: ningún error silencioso;
// el usuario debe saber cuánto varió la superficie al discretizar):
//   S_arco     = ½·R²·(|Δθ| − sin|Δθ|)                (segmento circular real)
//   S_discreto = Σ ½·R²·(δ − sin δ)  sobre los n_seg tramos, δ = |Δθ|/n_seg
//   ΔS         = S_arco − S_discreto
// ΔS es exactamente el área encerrada entre la polilínea discretizada y la
// cuerda P1→P2 (identidad: |ΔS| = ½R²·|n·sin(Δθ/n) − sinΔθ| = área shoelace
// del polígono [P1, …vertices, P2]). Es decir, el área que aporta el arco
// sobre su cuerda; es la cifra a informar como "variación de superficie".

const FLECHA_MAX_DEFECTO = 0.01 // metros (1 cm) — tolerancia de flecha por defecto.

/** True si P es un punto UTM válido: [x, y] con ambos finitos. */
function esPuntoFinito(P) {
  return (
    Array.isArray(P) &&
    P.length === 2 &&
    Number.isFinite(P[0]) &&
    Number.isFinite(P[1])
  )
}

/** Área del segmento circular ½·R²·(θ − sin θ) para un ángulo θ ≥ 0. */
function areaSegmentoCircular(R, theta) {
  return 0.5 * R * R * (theta - Math.sin(theta))
}

/**
 * Discretiza un tramo con bulge (código DXF 42) entre dos vértices UTM.
 *
 * CONVENCIÓN DE VÉRTICES DEVUELTOS (crítica para el ensamblador — parser DXF,
 * Fase 2): `vertices` contiene SOLO los vértices NUEVOS e intermedios del arco,
 * en orden de P1 a P2, SIN incluir ni P1 ni P2. El llamante reconstruye la
 * polilínea completa como `[P1, ...vertices, P2]`. Así los puntos se insertan
 * limpiamente entre dos vértices ya existentes sin duplicarlos. Cuando no hace
 * falta subdividir (arco cuya propia flecha ya ≤ ε, o b === 0) `vertices` es `[]`.
 *
 * Nunca devuelve lat/lon: entra y sale geometría euclídea plana en UTM (m).
 *
 * @param {[number, number]} P1  Vértice inicial UTM [x, y] (Este, Norte) en metros.
 * @param {[number, number]} P2  Vértice final UTM [x, y] en metros.
 * @param {number} b  Bulge (código DXF 42). b>0 = CCW, b<0 = CW, b=0 = recto.
 * @param {{ flechaMax?: number }} [opciones]  flechaMax = tolerancia de flecha en
 *   metros (sagitta máxima por tramo). Por defecto 0.01 (1 cm). Debe ser > 0.
 * @returns {{
 *   vertices: number[][],   // vértices intermedios NUEVOS (sin P1 ni P2), en UTM.
 *   nSeg: number,           // nº de tramos (cuerdas). vertices.length === nSeg − 1.
 *   radio: number,          // R del arco en metros; Infinity si b === 0.
 *   deltaTheta: number,     // Δθ barrido CON signo (rad); + = CCW, − = CW; 0 si recto.
 *   centro: [number, number] | null,  // centro del arco en UTM; null si b === 0.
 *   deltaS: number,         // ΔS = S_arco − S_discreto (m², ≥ 0); 0 si recto.
 * }}
 * @throws {TypeError} Si P1/P2 no son [x,y] finitos, b no es finito, flechaMax no
 *   es > 0, o P1 y P2 coinciden con b ≠ 0 (cuerda de longitud 0: arco degenerado).
 *   Regla de oro 1: entrada inválida lanza, nunca se corrige en silencio.
 */
export function discretizarBulge(P1, P2, b, { flechaMax = FLECHA_MAX_DEFECTO } = {}) {
  if (!esPuntoFinito(P1)) {
    throw new TypeError(
      `discretizarBulge: P1 debe ser [x,y] finito en UTM (m); recibido ${JSON.stringify(P1)}.`,
    )
  }
  if (!esPuntoFinito(P2)) {
    throw new TypeError(
      `discretizarBulge: P2 debe ser [x,y] finito en UTM (m); recibido ${JSON.stringify(P2)}.`,
    )
  }
  if (!Number.isFinite(b)) {
    throw new TypeError(
      `discretizarBulge: b (bulge, código DXF 42) debe ser un número finito; recibido ${b}.`,
    )
  }
  if (!Number.isFinite(flechaMax) || flechaMax <= 0) {
    throw new TypeError(
      `discretizarBulge: flechaMax debe ser un número > 0 (metros); recibido ${flechaMax}.`,
    )
  }

  const [x1, y1] = P1
  const [x2, y2] = P2
  const dx = x2 - x1
  const dy = y2 - y1
  const c = Math.hypot(dx, dy)

  // Caso recto: b === 0 → la cuerda ES el segmento; sin vértices, sin variación.
  if (b === 0) {
    return { vertices: [], nSeg: 1, radio: Infinity, deltaTheta: 0, centro: null, deltaS: 0 }
  }

  // Cuerda de longitud 0 con b ≠ 0: arco degenerado (radio 0). No inventar nada.
  if (c === 0) {
    throw new TypeError(
      `discretizarBulge: P1 y P2 coinciden (cuerda de longitud 0) con b=${b} ≠ 0: arco degenerado.`,
    )
  }

  const deltaTheta = 4 * Math.atan(b) // Δθ con signo: b>0 CCW, b<0 CW.
  const absTheta = Math.abs(deltaTheta)
  const R = (c * (1 + b * b)) / (4 * Math.abs(b))

  // Centro C = M + sign(b)·apo·n̂, con n̂ perpendicular unitaria izquierda a P2−P1.
  const mx = (x1 + x2) / 2
  const my = (y1 + y2) / 2
  const nx = -dy / c
  const ny = dx / c
  const apo = R * Math.cos(deltaTheta / 2) // < 0 para |Δθ| > π (arcos mayores): correcto.
  const signo = Math.sign(b)
  const cx = mx + signo * apo * nx
  const cy = my + signo * apo * ny

  // Subdivisión por flecha: δ_max = 2·acos(1 − ε/R). Se acota el argumento del
  // acos a [−1,1] por si R es diminuto (ε ≥ 2R); n_seg ≥ 1 siempre. Para |b| muy
  // pequeño R→∞ y δ_max→0⁺, pero |Δθ|→0 a la par, así que n_seg→1 (estable).
  const arg = Math.min(1, Math.max(-1, 1 - flechaMax / R))
  const deltaMax = 2 * Math.acos(arg)
  let nSeg = deltaMax > 0 ? Math.ceil(absTheta / deltaMax) : 1
  if (!Number.isFinite(nSeg) || nSeg < 1) nSeg = 1

  // Vértices intermedios NUEVOS (sin P1 ni P2): i = 1 .. nSeg−1 sobre el círculo.
  const phi1 = Math.atan2(y1 - cy, x1 - cx)
  const paso = deltaTheta / nSeg
  const vertices = []
  for (let i = 1; i < nSeg; i++) {
    const phi = phi1 + paso * i
    vertices.push([cx + R * Math.cos(phi), cy + R * Math.sin(phi)])
  }

  // Reporte de variación de superficie (magnitudes, ΔS ≥ 0).
  const deltaPorTramo = absTheta / nSeg
  const sArco = areaSegmentoCircular(R, absTheta)
  const sDiscreto = nSeg * areaSegmentoCircular(R, deltaPorTramo)
  const deltaS = sArco - sDiscreto

  return { vertices, nSeg, radio: R, deltaTheta, centro: [cx, cy], deltaS }
}

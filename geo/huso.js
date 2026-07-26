// geo/huso.js — F00 · Detección de huso UTM y saneamiento defensivo de coordenadas.
//
// Contexto (PLAN §5.5, dossier §3.1/§3.2, SPEC §2 regla 1 y regla 3): el dato de
// entrada de una parcela llega en UTM (x=Este, y=Norte) pero puede venir sin huso
// declarado, con X e Y invertidas, o —por error del usuario— en grados geográficos.
// Este módulo aporta los DETECTORES PUROS (la UI de estas detecciones vive en F01):
//   · detectarHuso  — deduce el huso desproyectando el centroide y validándolo
//                     contra la ventana del meridiano central (±3°) y el bbox España.
//   · sanear        — detecta X/Y invertidas y geográficas pegadas.
//
// Regla de oro 1 (NINGÚN error silencioso): `sanear` NUNCA corrige en silencio;
// devuelve la lista de correcciones aplicadas o necesarias para que el llamante
// (F01) informe al usuario. Si detecta grados NO reproyecta por su cuenta: lo
// señala para que la UI ofrezca la proyección (regla de oro 3: modelo en UTM).
//
// Regla de oro 3 (modelo en UTM): la ÚNICA función que toca lat/lon es la
// desproyección interna, delegada en geo/utm.js. Este módulo no expone lat/lon
// al modelo; el `{lon,lat}` que devuelve `detectarHuso` es solo para "mostrar
// dónde ha caído la parcela" (PLAN §5.5), no para almacenarlo.
//
// Territorio (SPEC §1, override O13): husos 29/30/31 (EPSG 25829/30/31),
// Península + Baleares. Canarias (huso 28 / EPSG 32628) DIFERIDO — ver gancho abajo.

import { inverse, meridianoCentral } from './utm.js'

// Reexportamos meridianoCentral desde utm.js para que huso.js quede alineado con
// el motor (misma fórmula λ0 = (z−1)·6 − 180 + 3 → 29:−9°, 30:−3°, 31:+3°) y no
// haya dos definiciones que puedan divergir.
export { meridianoCentral }

// ---------------------------------------------------------------------------
// Constantes verificadas (dossier §3.2, VERBATIM)
// ---------------------------------------------------------------------------

// Bounding box Península + Baleares. Canarias queda FUERA a propósito (O13).
export const BBOX_ESPANA = Object.freeze({
  lonMin: -9.5,
  lonMax: 4.5,
  latMin: 35.5,
  latMax: 44.5,
})

// Rangos UTM plausibles (Península). Se usan para verificar el resultado tras un
// swap de X/Y (dossier §3.2; PLAN §5.5 "X ronda las centenas de millar, Y los 4M").
const ESTE_MIN = 166000
const ESTE_MAX = 834000
const NORTE_MIN = 3930000
const NORTE_MAX = 4930000

// Candidatos por defecto para la autodetección. El orden es una PRIORIDAD: el
// huso 30 domina la Península, por eso va primero. El easting NO identifica el
// huso (siempre ~500.000). VERIFICADO EMPÍRICAMENTE (auditoría F00, A1): la
// ventana CM±3° casi nunca discrimina — desproyectar con el huso vecino
// desplaza la lon ~±6°, que cae dentro de la ventana del candidato — así que
// la interpretación prioritaria por defecto equivale a "asumir huso 30".
// Por eso `detectarHuso` devuelve TODOS los candidatos viables (ver abajo):
// el llamante (F01) debe tratar `ambiguo:true` como decisión del usuario,
// y si el dato ya trae huso, pasar `[huso]` para solo VERIFICAR.
// Canarias (28) y 27 NO entran aquí por decisión de alcance (override O13).
export const CANDIDATOS_DEFECTO = Object.freeze([30, 29, 31])

// DIFERIDO: Canarias -> forzar huso 28, srsName EPSG 0/32628
// (todo el archipiélago en EPSG:32628 = WGS84/UTM 28N, CM −15°). No se implementa
// en F00: cuando se aborde, añadir 28 a los candidatos, un bbox Canarias propio
// (lon −18.5…−13.0, lat 27.5…29.5) y srsPorHuso(28) → 'EPSG:32628'.

// Mapa huso → forma del campo `srs` del modelo (§4.1). El dialecto srsName del GML
// (URI vs URN, override O2) lo decide F04, NO aquí.
const SRS_POR_HUSO = Object.freeze({
  29: 'EPSG:25829',
  30: 'EPSG:25830',
  31: 'EPSG:25831',
})

// Husos UTM soportados por el proyecto (Península y Baleares). Es el mismo
// dominio que `model/parcela.js#SRS_VALIDOS` visto desde la capa `geo/` (más
// baja): NO se importan entre sí (evitar acoplo cruzado de capas); el test-
// guarda que ambas listas no puedan divergir vive en `test/geo/huso.test.js`.
// Canarias (28) queda DIFERIDA a propósito (override O13, gancho arriba).
export const HUSOS_VALIDOS = Object.freeze([29, 30, 31])

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

/**
 * Forma del campo `srs` del modelo para un huso implementado (29/30/31).
 *
 * @param {number} zona  Huso UTM.
 * @returns {'EPSG:25829'|'EPSG:25830'|'EPSG:25831'}
 * @throws {RangeError} Si el huso no está implementado (regla de oro 1: sin
 *   error silencioso; Canarias/huso 28 está DIFERIDO, ver gancho arriba).
 */
export function srsPorHuso(zona) {
  if (!Number.isInteger(zona)) {
    // Sin coerción de clave: '30' (string) debe fallar igual que en utm.js (A8).
    throw new TypeError(`srsPorHuso: el huso debe ser un entero; recibido ${JSON.stringify(zona)}.`)
  }
  const srs = SRS_POR_HUSO[zona]
  if (!srs) {
    throw new RangeError(
      `srsPorHuso: huso ${zona} no implementado (válidos: 29/30/31). ` +
        `Canarias (28 → EPSG:32628) está DIFERIDO (override O13).`,
    )
  }
  return srs
}

// Inversa de `srsPorHuso` construida recorriendo `HUSOS_VALIDOS` y llamando a
// `srsPorHuso` para cada zona: NO es una segunda tabla escrita a mano, así que
// las dos direcciones no pueden divergir entre sí (ese es el objetivo entero
// de esta consolidación). Se construye una única vez al cargar el módulo.
const HUSO_POR_SRS = new Map(HUSOS_VALIDOS.map((zona) => [srsPorHuso(zona), zona]))

/**
 * Inversa de `srsPorHuso`: `'EPSG:25830' → 30`.
 *
 * Forma aceptada: ÚNICAMENTE la forma corta `'EPSG:258xx'`, que es la que
 * circula por el campo `srs` del modelo y por todas las capas que lo
 * consumen hoy (`model/parcela.js#SRS_VALIDOS`, `validation/reglas-huso.js`,
 * `viewer/sincronizacion.js`). NO tolera las formas URI/URN del `srsName` del
 * GML (dossier override O2/O10: la parcela serializa en URI
 * `http://www.opengis.net/def/crs/EPSG/0/25830`, el edificio en URN
 * `urn:ogc:def:crs:EPSG::25830`) — esa traducción es de F04, en el momento de
 * serializar/leer el GML, y no se inventa aquí una tolerancia que hoy nadie
 * pide; cuando F04 la necesite, deberá normalizar a la forma corta ANTES de
 * llamar a `husoPorSrs`, no al revés.
 *
 * @param {string} srs  P.ej. `'EPSG:25830'`.
 * @returns {number} El huso UTM correspondiente (29, 30 o 31).
 * @throws {TypeError}  Si `srs` no es un string.
 * @throws {RangeError} Si `srs` no corresponde a un huso soportado (incluye
 *   Canarias `'EPSG:32628'`, DIFERIDA por decisión de alcance, override O13).
 */
export function husoPorSrs(srs) {
  if (typeof srs !== 'string') {
    throw new TypeError(`husoPorSrs: 'srs' debe ser un string; recibido ${JSON.stringify(srs)}.`)
  }
  const zona = HUSO_POR_SRS.get(srs)
  if (zona === undefined) {
    throw new RangeError(
      `husoPorSrs: srs ${JSON.stringify(srs)} no corresponde a un huso soportado ` +
        `(válidos: ${[...HUSO_POR_SRS.keys()].join(', ')}). ` +
        `Canarias (EPSG:32628) está DIFERIDA (override O13).`,
    )
  }
  return zona
}

/**
 * Como {@link husoPorSrs} pero SIN LANZAR: `null` cuando el `srs` no es un
 * string o no corresponde a un huso soportado. Existe para el único llamante
 * que legítimamente NO tiene contrato sobre el `srs` — `validation/reglas-huso.js`,
 * que debe poder decir "no puedo juzgar el rango" sin que eso sea un error.
 * Quien SÍ tiene contrato (`viewer/index.js`, F04) usa `husoPorSrs`.
 *
 * Variante `number|null` y NO un predicado booleano `esSrsSoportado`: el booleano
 * obligaría al llamante a consultar la tabla DOS veces (primero "¿vale?", después
 * "dame el huso") y abriría una ventana para que la segunda consulta no case con
 * la primera. Aquí se pregunta una sola vez, a la MISMA tabla que `husoPorSrs`
 * ({@link HUSO_POR_SRS}, derivada de `srsPorHuso`), así que las dos funciones no
 * pueden divergir.
 *
 * Sustituye al `try { husoPorSrs(srs) } catch { … }` que `reglas-huso.js`
 * arrastraba de F02: aquel `catch` desnudo atrapaba CUALQUIER throw, así que el
 * día que `husoPorSrs` crezca (la normalización URI/URN que su JSDoc anuncia
 * para F04) un bug ahí degradaría la regla del huso a "no valida nada" en
 * silencio. Aquí el "no sé juzgarlo" es un VALOR, no una excepción.
 *
 * @param {*} srs  P.ej. `'EPSG:25830'`. Cualquier valor: no hay contrato.
 * @returns {number|null}  El huso UTM (29/30/31), o `null` si no es derivable.
 */
export function husoPorSrsOpcional(srs) {
  if (typeof srs !== 'string') return null
  const zona = HUSO_POR_SRS.get(srs)
  return zona === undefined ? null : zona
}

/** ¿Este en rango UTM plausible de la Península? (dossier §3.2) */
function estePlausible(x) {
  return x >= ESTE_MIN && x <= ESTE_MAX
}

/** ¿Norte en rango UTM plausible de la Península? (dossier §3.2) */
function nortePlausible(y) {
  return y >= NORTE_MIN && y <= NORTE_MAX
}

/** ¿(lon,lat) dentro del bbox Península + Baleares? */
function enBboxEspana(lon, lat) {
  return (
    lon >= BBOX_ESPANA.lonMin &&
    lon <= BBOX_ESPANA.lonMax &&
    lat >= BBOX_ESPANA.latMin &&
    lat <= BBOX_ESPANA.latMax
  )
}

/**
 * Detecta el huso UTM de una coordenada [x,y] por desproyección del centroide.
 *
 * Para cada candidato `z`: desproyecta (x,y) con utm.inverse y acepta `z` si
 * `lon ∈ [CM(z)−3°, CM(z)+3°]` Y `(lon,lat) ∈ bbox España`. Devuelve TODOS los
 * candidatos viables; la interpretación PRIORITARIA (el primero del orden) va
 * aplanada en la raíz del resultado por comodidad.
 *
 * ⚠️ Límite estructural VERIFICADO (auditoría F00, hallazgo A1): el easting NO
 * identifica el huso (siempre ~500.000) y la latitud es idéntica sea cual sea
 * el candidato; desproyectar con el huso vecino desplaza la lon ~±6°, que suele
 * caer dentro de la ventana del vecino. En un barrido de 168 puntos peninsulares
 * la autodetección con el orden por defecto devolvió SIEMPRE huso 30: equivale a
 * "asumir 30". Por eso el resultado lleva `ambiguo` y `candidatos`: cuando
 * `ambiguo === true`, el llamante (F01) DEBE mostrar dónde cae la parcela en cada
 * interpretación y dejar decidir al usuario (PLAN §5.5), no dar el primero por
 * bueno. Si el dato ya trae huso, pásalo como único candidato (`[huso]`) para
 * solo VERIFICAR (modo que acepta 168/168 en el barrido).
 *
 * @param {[number, number]} coord  Coordenada UTM [x=Este, y=Norte] (metros).
 * @param {number[]} [candidatos=CANDIDATOS_DEFECTO]  Husos a probar, en orden de prioridad.
 * @returns {{zona:number, srs:string, lon:number, lat:number,
 *            ambiguo:boolean, candidatos:Array<{zona:number, srs:string, lon:number, lat:number}>} | null}
 *   `null` si ningún candidato cae dentro de España. `zona/srs/lon/lat` = el
 *   candidato prioritario; `candidatos` = todos los viables en orden de prioridad.
 * @throws {TypeError} Si `coord` no es un par de números finitos (sin error silencioso).
 */
export function detectarHuso(coord, candidatos = CANDIDATOS_DEFECTO) {
  if (!Array.isArray(coord) || coord.length < 2) {
    throw new TypeError(`detectarHuso: se esperaba [x, y]; recibido ${JSON.stringify(coord)}`)
  }
  const [x, y] = coord
  if (!Number.isFinite(x) || !Number.isFinite(y)) {
    throw new TypeError(`detectarHuso: coordenada no finita [${x}, ${y}]`)
  }

  const viables = []
  for (const zona of candidatos) {
    const { lat, lon } = inverse(x, y, zona)
    const cm = meridianoCentral(zona)
    const enVentanaCM = lon >= cm - 3 && lon <= cm + 3
    if (enVentanaCM && enBboxEspana(lon, lat)) {
      viables.push({ zona, srs: srsPorHuso(zona), lon, lat })
    }
  }

  if (viables.length === 0) return null
  const prioritario = viables[0]
  return { ...prioritario, ambiguo: viables.length > 1, candidatos: viables }
}

/**
 * Saneamiento defensivo de una coordenada [x,y]: detecta X/Y invertidas y
 * geográficas pegadas. NUNCA corrige en silencio (regla de oro 1): devuelve la
 * lista de correcciones aplicadas o necesarias para que la UI (F01) informe.
 *
 * Umbrales EXACTOS (dossier §3.2):
 *   · Geográficas pegadas: `|c0| < 1000 && |c1| < 1000` → son grados, NO UTM.
 *     Se señala (`tipo:'GRADOS'`) para que F01 ofrezca proyectar; aquí NO se
 *     reproyecta (regla de oro 3) y la coordenada se devuelve intacta.
 *   · X/Y invertidas: `|c0| > 1_000_000 && |c1| < 1_000_000` → swap a [Este,Norte];
 *     tras el swap se comprueban los rangos Este/Norte plausibles.
 * Una coordenada UTM normal no dispara ninguna corrección.
 *
 * @param {[number, number]} coord  Coordenada de entrada [c0, c1].
 * @returns {{coord:[number,number], correcciones:Array<object>}}
 *   `coord` = coordenada resultante (swapped si procede; intacta en el resto).
 *   `correcciones` = una entrada por corrección aplicada/necesaria (vacío si nada).
 * @throws {TypeError} Si `coord` no es un par de números finitos.
 */
export function sanear(coord) {
  if (!Array.isArray(coord) || coord.length < 2) {
    throw new TypeError(`sanear: se esperaba [x, y]; recibido ${JSON.stringify(coord)}`)
  }
  let [c0, c1] = coord
  if (!Number.isFinite(c0) || !Number.isFinite(c1)) {
    throw new TypeError(`sanear: coordenada no finita [${c0}, ${c1}]`)
  }

  const correcciones = []

  // Geográficas pegadas: ambos |v| < 1000 → grados (lon,lat), no UTM.
  if (Math.abs(c0) < 1000 && Math.abs(c1) < 1000) {
    correcciones.push({
      tipo: 'GRADOS',
      mensaje:
        `Ambos valores con |v|<1000: parecen coordenadas geográficas en grados ` +
        `(lon=${c0}, lat=${c1}), no UTM. Requiere proyección; no se reproyecta aquí.`,
      coord: [c0, c1],
      reproyectar: true, // señal para la UI (F01); este módulo no proyecta
    })
    // No hay swap posible sobre grados: se devuelve intacta.
    return { coord: [c0, c1], correcciones }
  }

  // X/Y invertidas: |c0|>1e6 (parece un Norte) y |c1|<1e6 (parece un Este) → swap.
  if (Math.abs(c0) > 1_000_000 && Math.abs(c1) < 1_000_000) {
    const antes = [c0, c1]
    ;[c0, c1] = [c1, c0] // swap → [Este, Norte]
    const rangoPlausible = estePlausible(c0) && nortePlausible(c1)
    correcciones.push({
      tipo: 'SWAP_XY',
      mensaje:
        `X e Y invertidas (|c0|>1e6, |c1|<1e6): intercambiadas a ` +
        `[Este=${c0}, Norte=${c1}]` +
        (rangoPlausible ? '.' : ' (aviso: fuera del rango UTM plausible tras el swap).'),
      antes,
      despues: [c0, c1],
      rangoPlausible,
    })
  }

  return { coord: [c0, c1], correcciones }
}

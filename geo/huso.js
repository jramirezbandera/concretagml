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

// Bounding box Península + Baleares (y las ciudades autónomas, ver abajo).
// Canarias queda FUERA a propósito (O13). Es la UNIÓN de los tres husos: sirve
// para «¿esto es España?» a secas (lo usa `situarGrados`, que parte de una
// longitud y no tiene nada que discriminar), NO para decidir en qué huso cae un
// punto. Para eso está {@link BBOX_POR_HUSO}, y el porqué está escrito ahí.
//
// ⛔ latMin (G1, auditoría 2026-08-15): estaba en 35,5 —bajado en su día para
// capturar CEUTA (lat 35,88)— y dejaba fuera a MELILLA (lat 35,29, lon −2,94,
// huso 30, con Catastro real en EPSG:25830): `detectarHuso` contestaba null
// («no cae en España») y `situarGrados` decía FUERA sobre suelo español con
// parcelario. Se baja a 35,1 con el mismo criterio generoso de siempre (~0,2°
// de margen bajo el extremo real); lo que entra de más es mar de Alborán y
// franja rifeña, igual que la ventana de Ceuta ya tragaba estrecho — la caja es
// una criba de plausibilidad, no un mapa.
export const BBOX_ESPANA = Object.freeze({
  lonMin: -9.5,
  lonMax: 4.5,
  latMin: 35.1,
  latMax: 44.5,
})

// ---------------------------------------------------------------------------
// ⭐ QUÉ TERRITORIO ESPAÑOL HAY EN CADA HUSO (2026-08-09)
//
// ⛔ Hasta hoy, `detectarHuso` validaba los tres candidatos contra el MISMO
// rectángulo ({@link BBOX_ESPANA}), y ese rectángulo se traga medio Mediterráneo
// y un trozo de Argelia. MEDIDO sobre 42 municipios reales, uno por uno,
// llevados a su huso verdadero y devueltos por este módulo: **42 de 42 salían
// ambiguos y en 22 de 42 el prioritario era el huso EQUIVOCADO** — Galicia,
// Extremadura, Huelva y Cádiz (huso 29) y Cataluña y Baleares (huso 31)
// entraban TODAS como huso 30, que es el primero de la lista de prioridad.
//
// El caso que lo destapó: una parcela de Málaga (386.132, 4.064.410). Leída como
// huso 30 cae en lon −4,275 · lat 36,719, que es Málaga. Leída como huso 31 cae
// en lon +1,725 · lat 36,719, que es **mar abierto frente a la costa argelina**
// — y pasaba el filtro, porque el rectángulo único llega hasta lon 4,5.
//
// La clave está en que **la latitud es IDÉNTICA en todos los candidatos**: leer
// el mismo par de metros con el huso vecino mueve la longitud exactamente ±6° y
// deja la latitud donde estaba. Así que la longitud NO discrimina nunca (por eso
// la ventana CM±3° «casi nunca discrimina», como dice el hallazgo A1 de la
// auditoría F00: los ±6° caen justo en la banda del vecino), y la latitud SÍ, a
// cambio de saber qué latitudes tiene territorio cada banda:
//
//   · Huso 29 (lon −12…−6): Galicia, oeste de Castilla, Extremadura oeste,
//     Huelva y Cádiz. Del Cabo de Trafalgar (36,18) a Estaca de Bares (43,79).
//   · Huso 30 (lon −6…0): el grueso de la Península. De Punta de Tarifa (36,00)
//     —y Ceuta, 35,88, y Melilla, 35,29 (G1, 2026-08-15)— al Cabo de Peñas (43,66).
//   · Huso 31 (lon 0…6): Cataluña, el norte de Castellón y las Baleares. De
//     **Formentera (38,63)** al Valle de Arán (42,84). **Ahí abajo no hay nada
//     español**, y por eso el 31 deja de ser una lectura viable de una parcela
//     andaluza o murciana.
//
// ⚠️ Los límites son GENEROSOS a propósito (margen de ~0,2° sobre el extremo
// real): esto decide si una parcela legítima entra o se rechaza, y equivocarse
// por estrecho es peor que quedarse largo. Lo que se recorta es mar, no suelo.
//
// ⚠️ Y NO cierra la ambigüedad: quedan pares donde las dos lecturas caen sobre
// suelo español de verdad —una parcela de Barcelona leída como huso 30 aterriza
// en Guadalajara; una de Valencia leída como 29 aterriza en Cáceres—. Ésas no
// las resuelve ninguna geometría: las decide el usuario, y por eso desde hoy la
// ambigüedad ABRE la pantalla de revisión (`app/dialogo-importacion.js`).
// ---------------------------------------------------------------------------

/**
 * Ventana geográfica del territorio español dentro de cada huso. El `lon` repite
 * la banda del huso (lo mismo que ya impone la ventana CM±3°) recortada por
 * España; el `lat` es lo que de verdad discrimina. Ver el bloque de arriba.
 *
 * @type {Readonly<Record<number, {lonMin:number, lonMax:number, latMin:number, latMax:number}>>}
 */
export const BBOX_POR_HUSO = Object.freeze({
  29: Object.freeze({ lonMin: -9.5, lonMax: -6.0, latMin: 36.0, latMax: 44.0 }),
  // latMin 35,1: el sur del huso 30 no acaba en Tarifa (36,0) ni en Ceuta
  // (35,88): MELILLA está en 35,29 y su Catastro sirve EPSG:25830 (G1,
  // 2026-08-15). Mismo margen generoso (~0,2°) que el resto de límites.
  30: Object.freeze({ lonMin: -6.0, lonMax: 0.0, latMin: 35.1, latMax: 44.0 }),
  31: Object.freeze({ lonMin: 0.0, lonMax: 4.5, latMin: 38.5, latMax: 43.0 }),
})

// Rangos UTM plausibles (Península y ciudades autónomas). Se usan para verificar
// el resultado tras un swap de X/Y (dossier §3.2; PLAN §5.5 "X ronda las
// centenas de millar, Y los 4M").
// ⛔ NORTE_MIN (G1, 2026-08-15): 3.930.000 correspondía a lat ~35,5 y declaraba
// «no plausible» el Norte de MELILLA (~3.905.000 m, lat 35,29). Se baja a
// 3.880.000 (~lat 35,1), el mismo límite sur que BBOX_ESPANA/BBOX_POR_HUSO[30]
// para que las dos cribas no se contradigan entre sí.
const ESTE_MIN = 166000
const ESTE_MAX = 834000
const NORTE_MIN = 3880000
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

// El bbox del gancho de arriba, ESCRITO (F19). No se implementa Canarias con
// esto: se usa para poder DECIR «esto es Canarias y esta versión no la proyecta»
// en vez de dejar caer un archipiélago entero en «fuera de España», que es lo
// que hacía hasta F19 y es un motivo falso. Ver {@link situarGrados}.
export const BBOX_CANARIAS = Object.freeze({
  lonMin: -18.5,
  lonMax: -13.0,
  latMin: 27.5,
  latMax: 29.5,
})

/** Umbral de «esto son grados y no metros»: |v| < 1000 en las DOS componentes
 *  (dossier §3.2). Vivía escrito dos veces —aquí dentro de `sanear` y otra vez
 *  en `parsers/importar.js#pareceGrados`—; F19 lo saca a un solo sitio antes de
 *  añadir el tercer llamante, que es como una constante duplicada se convierte
 *  en dos constantes distintas. */
export const UMBRAL_GRADOS = 1000

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

/** ¿(lon,lat) dentro de un bbox cualquiera de los declarados arriba? */
function enBbox(lon, lat, bbox) {
  return lon >= bbox.lonMin && lon <= bbox.lonMax && lat >= bbox.latMin && lat <= bbox.latMax
}

/** ¿(lon,lat) dentro del bbox Península + Baleares? */
function enBboxEspana(lon, lat) {
  return enBbox(lon, lat, BBOX_ESPANA)
}

/**
 * ¿(lon,lat) cae sobre territorio español del huso `zona`? Es {@link enBboxEspana}
 * afinado por huso ({@link BBOX_POR_HUSO}). Un huso sin ventana propia —no lo hay
 * hoy, pero Canarias entrará algún día— cae al rectángulo único, que es el
 * comportamiento de antes: se degrada a lo de siempre, no se rompe.
 */
function enTerritorioDelHuso(lon, lat, zona) {
  return enBbox(lon, lat, BBOX_POR_HUSO[zona] ?? BBOX_ESPANA)
}

/**
 * Detecta el huso UTM de una coordenada [x,y] por desproyección del centroide.
 *
 * Para cada candidato `z`: desproyecta (x,y) con utm.inverse y acepta `z` si
 * `lon ∈ [CM(z)−3°, CM(z)+3°]` Y `(lon,lat)` cae en el territorio español de ESE
 * huso ({@link BBOX_POR_HUSO}, y no el rectángulo único de {@link BBOX_ESPANA}:
 * ver el bloque «QUÉ TERRITORIO ESPAÑOL HAY EN CADA HUSO»). Devuelve TODOS los
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
 * ⭐ El 2026-08-09 la ventana por huso recorta buena parte de esa ambigüedad
 * —MEDIDO sobre 42 municipios reales, ver el bloque de arriba—, pero NO la
 * elimina: donde las dos lecturas caen sobre suelo español, `ambiguo` sigue
 * siendo `true` y la decisión sigue siendo del usuario. Es exactamente el aviso
 * del párrafo anterior, ahora con menos falsos positivos.
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
    if (enVentanaCM && enTerritorioDelHuso(lon, lat, zona)) {
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
  if (pareceEnGrados([c0, c1])) {
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

// ---------------------------------------------------------------------------
// F19 · Grados: situarlos para poder PROYECTARLOS
//
// Hasta F19 este módulo sabía decir «esto son grados» y ahí se paraba: la
// detección viajaba con `reproyectar: true` y NO HABÍA NADIE que supiera
// atenderla (medido en F18, M10). Lo que faltaba no era la proyección —
// `geo/utm.js#forward` está escrita y verificada desde F00— sino las dos
// preguntas de antes: en qué ORDEN vienen las dos columnas, y en qué HUSO cae.
//
// Las dos se contestan sin desproyectar nada y sin heurísticas:
//
//   · El ORDEN, porque los rangos de España son DISJUNTOS. lon ∈ [−9,5 · 4,5] y
//     lat ∈ [35,5 · 44,5] no se solapan, así que ninguna pareja puede leerse
//     como válida en los dos órdenes: como mucho una cae dentro. No es una
//     preferencia, es aritmética de intervalos, y por eso aquí se DEDUCE en vez
//     de preguntarse (F19, decisión 8).
//   · El HUSO, porque en grados la longitud LO DA: zona = ⌊(lon+180)/6⌋+1. Nada
//     que ver con `detectarHuso`, que existe para el problema inverso —partir de
//     metros— y que en grados contesta un disparate (ver abajo).
//
// ⛔ Y esto último no es teórico: hasta F19, un pegado de Málaga en grados se
// rechazaba diciendo «el centroide (−4.42, 36.72) NO CAE en la España peninsular
// ni Baleares», sobre un punto que ES Málaga. El bloqueo era correcto y el
// motivo era falso. Es la misma familia del diagnóstico falso que F18 midió en el
// `.txt` de replanteo propio: lo que se le dice al usuario tiene que ser verdad
// aunque la decisión de no seguir sea la buena.
// ---------------------------------------------------------------------------

/**
 * ¿Esta pareja parece estar en grados y no en metros? (dossier §3.2).
 *
 * @param {[number, number]} coord
 * @returns {boolean}
 */
export function pareceEnGrados(coord) {
  return (
    Array.isArray(coord) &&
    Number.isFinite(coord[0]) &&
    Number.isFinite(coord[1]) &&
    Math.abs(coord[0]) < UMBRAL_GRADOS &&
    Math.abs(coord[1]) < UMBRAL_GRADOS
  )
}

/**
 * Huso UTM que corresponde a una longitud. Vale para CUALQUIER longitud del
 * planeta —incluida una que este proyecto no sabe proyectar—, y es a propósito:
 * quien pregunta necesita poder decir «esto es el huso 28, que es Canarias, y
 * esta versión no lo hace». Filtrar aquí por {@link HUSOS_VALIDOS} obligaría a
 * contestar `null` y el llamante no podría nombrar lo que ha visto.
 *
 * @param {number} lon  Longitud en grados decimales.
 * @returns {number}    Huso UTM 1..60.
 * @throws {TypeError}  Si `lon` no es un número finito.
 */
export function zonaPorLon(lon) {
  if (!Number.isFinite(lon)) {
    throw new TypeError(`zonaPorLon: se esperaba una longitud finita; recibido ${JSON.stringify(lon)}`)
  }
  // Normalizamos a [−180, 180) para que una longitud de 185° (que existe en
  // ficheros de verdad) no dé el huso 61, que no existe.
  const normal = ((((lon + 180) % 360) + 360) % 360) - 180
  return Math.floor((normal + 180) / 6) + 1
}

/**
 * @typedef {Object} SituacionGrados
 * @property {'LON_LAT'|'LAT_LON'|null} orden  Cómo hay que leer la pareja, o
 *   `null` si ninguna de las dos lecturas cae en territorio conocido.
 * @property {number|null} lon  Longitud YA en el orden bueno.
 * @property {number|null} lat  Latitud YA en el orden bueno.
 * @property {number|null} zona  Huso deducido de la longitud; en Canarias es 28
 *   FIJO por región (todo el archipiélago va en EPSG:32628, no por longitud —
 *   El Hierro caería en el 27; ver G3 abajo y el dossier S11/O13).
 * @property {string|null} srs   `srsPorHuso(zona)` si es proyectable; `null` si no.
 * @property {'PENINSULA_BALEARES'|'CANARIAS'|'FUERA'} region  Dónde ha caído.
 * @property {boolean} proyectable  Si esta versión sabe llevarlo a UTM.
 * @property {boolean} invertido  `true` si hubo que leerla como (lat, lon).
 */

/**
 * Sitúa una pareja de grados: decide el orden de las columnas, el huso y si el
 * proyecto sabe proyectarla. **No proyecta** (regla de oro 3: este módulo no
 * expone lat/lon al modelo); devuelve lo que hace falta para preguntárselo al
 * usuario y, si dice que sí, para que `parsers/importar.js` llame a `forward`.
 *
 * Canarias sale como `region: 'CANARIAS'` con `proyectable: false` y **con su
 * huso 28 dicho**, no como un «fuera de España» genérico: el override O13 la
 * difiere, y difierir no es lo mismo que no reconocerla.
 *
 * @param {[number, number]} coord  La pareja tal cual viene del fichero.
 * @returns {SituacionGrados}
 * @throws {TypeError}  Si `coord` no es un par de números finitos.
 */
export function situarGrados(coord) {
  if (!Array.isArray(coord) || coord.length < 2) {
    throw new TypeError(`situarGrados: se esperaba [a, b]; recibido ${JSON.stringify(coord)}`)
  }
  const [a, b] = coord
  if (!Number.isFinite(a) || !Number.isFinite(b)) {
    throw new TypeError(`situarGrados: coordenada no finita [${a}, ${b}]`)
  }

  // Las dos lecturas posibles, y los dos territorios que sabemos nombrar. El
  // orden de la búsqueda importa poco —los cuatro casos son excluyentes por los
  // rangos— pero se prueba antes la Península, que es el 99 % del trabajo.
  const lecturas = [
    { orden: 'LON_LAT', lon: a, lat: b, invertido: false },
    { orden: 'LAT_LON', lon: b, lat: a, invertido: true },
  ]

  for (const region of ['PENINSULA_BALEARES', 'CANARIAS']) {
    const bbox = region === 'CANARIAS' ? BBOX_CANARIAS : BBOX_ESPANA
    for (const lectura of lecturas) {
      if (enBbox(lectura.lon, lectura.lat, bbox)) {
        // ⛔ G3 (2026-08-15): en CANARIAS el huso se fija POR REGIÓN, no por la
        // longitud. `zonaPorLon` puro daba huso 27 para El Hierro (lon −18,1) —
        // geométricamente cierto y catastralmente falso: el Catastro codifica
        // TODO el archipiélago en EPSG:32628 (huso 28 único, dossier S11 /
        // override O13), El Hierro y La Palma incluidas. El JSDoc de `zona` ya
        // prometía «28 en Canarias»; ahora es verdad también al oeste de −18°.
        const zona = region === 'CANARIAS' ? 28 : zonaPorLon(lectura.lon)
        const proyectable = HUSOS_VALIDOS.includes(zona)
        return {
          ...lectura,
          zona,
          srs: proyectable ? srsPorHuso(zona) : null,
          region,
          proyectable,
        }
      }
    }
  }

  return {
    orden: null,
    lon: null,
    lat: null,
    zona: null,
    srs: null,
    region: 'FUERA',
    proyectable: false,
    invertido: false,
  }
}

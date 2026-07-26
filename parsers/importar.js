// parsers/importar.js — F01 · Orquestador de importación (T3.1, INTEGRACIÓN).
//
// Convierte los detectores PUROS de F00 en un informe de detecciones accionable.
// Es el pegamento de F01: recibe un volcado del técnico (pegado de LISTA, TXT de
// dos columnas o DXF), lo despacha al parser correspondiente, ARRASTRA sus
// detecciones y, sobre CADA anillo devuelto, aplica los detectores defensivos
// (cierre, X/Y invertidas, geográficas pegadas, huso) SIN corregir nada en
// silencio: ofrece, no impone. Cuando procede, construye el modelo (model/parcela.js).
//
// NO reimplementa NADA: reutiliza literalmente parsers/{list,txt,dxf}.js,
// geo/{huso,cierre,area}.js y model/parcela.js. NO introduce backend, proj4js ni
// html2canvas, ni toca lat/lon en el modelo (regla 3).
//
// Reglas de oro (SPEC §2) que gobiernan este módulo:
//   1  Nada silencioso: toda corrección ofrecida o necesaria es una Deteccion
//      (o, cuando el vocabulario CONGELADO de TIPO_DETECCION no tiene un tipo para
//      ese hecho —formato deducido, cotejo de superficie—, un campo estructurado
//      del `resumen`, que la UI de F03 pinta). Nunca se descarta un hecho.
//   3  Modelo en UTM: el {lon,lat} del huso es solo "dónde cae la parcela"; NO se
//      almacena. Las geográficas pegadas se señalan, NUNCA se reproyectan aquí.
//   4  POJO plano; anillos ABIERTOS (el vértice de cierre se quita, no se guarda).
//   5/6 Superficie por shoelace propio (geo/area.js#superficie), nunca turf.area.
//
// Frontera de errores (SPEC §2, y el criterio de los parsers): un dato MALO del
// usuario (coords en grados, huso fuera de España, cierre que no cierra, X/Y
// invertidas) produce DETECCIONES y `parcela=null`, NUNCA una excepción. Los
// throw se reservan a errores de PROGRAMACIÓN (texto no-string, opts inválidas).

import { parseLIST } from './list.js'
import { parseTXT } from './txt.js'
import { parseDXF } from './dxf.js'
import { crearDeteccion, TIPO_DETECCION, SEVERIDAD } from './_comun.js'
import { detectarHuso, sanear, HUSOS_VALIDOS } from '../geo/huso.js'
import { errorCierre, compensarCierre } from '../geo/cierre.js'
import { superficie } from '../geo/area.js'
import { crearParcela, crearRecinto, TIPO_RECINTO, ORIGEN_PARCELA } from '../model/parcela.js'

// ── Umbrales (todos parametrizables por opts) ─────────────────────────────────

/** Por debajo de este error de cierre (m) el vértice de cierre se da por EXACTO:
 *  se retira para dejar el anillo abierto (regla 4) sin emitir Deteccion — es
 *  normalización trivial, no una corrección. Coincide con el orden de magnitud
 *  que sugiere la tarea (≈1e-6 m). */
const TOL_CIERRE_EXACTO = 1e-6

/** Ventana SUPERIOR (m) del error de cierre para interpretarlo como MISCLOSURE
 *  (un vértice de cierre casi-duplicado, off por error de medición). Un error
 *  mayor NO es un misclosure sino una arista de cierre REAL de un anillo abierto
 *  sin vértice repetido (el caso normal de LIST/TXT): ahí no se compensa nada.
 *  Ejemplo real: LIST.txt es un anillo abierto de 11 vértices cuya arista de
 *  cierre mide 3.52 m — NO es un error de cierre. La captura catastral es <25 cm
 *  (dossier S6), así que 0.5 m separa con holgura misclosure de arista real. */
const TOL_CIERRE_MISCLOSURE = 0.5

/** Umbral RELATIVO por defecto del cotejo de superficie (calculada vs reportada).
 *  Solo marca discrepancia; nunca emite juicio de valor (regla 9). */
const UMBRAL_SUPERFICIE = 0.01

const FORMATOS = Object.freeze({ LIST: 'LIST', TXT: 'TXT', DXF: 'DXF' })

// ── Autodetección de formato ──────────────────────────────────────────────────

/**
 * Deduce el formato del volcado con criterio (regla 1: la deducción se expone en
 * `resumen.formato`/`formatoAutodetectado`). NO usa una Deteccion porque el
 * vocabulario CONGELADO de TIPO_DETECCION no tiene un tipo para "formato deducido"
 * (mismo motivo por el que list.js expone Área/Perímetro como `meta`, no Deteccion).
 *
 *   · DXF  — estructura de secciones ASCII: par de group codes `0 / SECTION`.
 *            Es el marcador inequívoco; un pegado de LISTA con la palabra
 *            "LWPOLYLINE" en su cabecera NO lo tiene, así que no se confunde.
 *   · LIST — pegado de la LISTA de AutoCAD: rótulos "Ubicación", "X=…/Y=…" o el
 *            encabezado "LWPOLYLINE" (ya descartado DXF).
 *   · TXT  — por defecto: dos columnas numéricas sin rótulos.
 *
 * @param {string} texto
 * @returns {'LIST'|'TXT'|'DXF'}
 */
function autodetectarFormato(texto) {
  if (/(^|\n)[ \t]*0[ \t]*\r?\n[ \t]*SECTION\b/.test(texto)) return FORMATOS.DXF
  if (/Ubicaci[óo]n/i.test(texto) || (/\bX\s*=/.test(texto) && /\bY\s*=/.test(texto))) {
    return FORMATOS.LIST
  }
  if (/\bLWPOLYLINE\b/.test(texto)) return FORMATOS.LIST
  return FORMATOS.TXT
}

/** Despacha al parser del formato. */
function despachar(formato, texto, opts) {
  switch (formato) {
    case FORMATOS.LIST:
      return parseLIST(texto, opts)
    case FORMATOS.TXT:
      return parseTXT(texto, opts)
    case FORMATOS.DXF:
      return parseDXF(texto, opts)
    default:
      // Inalcanzable: el formato ya se validó/dedujo. Error de programación.
      throw new RangeError(`importar: formato no soportado: ${JSON.stringify(formato)}.`)
  }
}

// ── Helpers geométricos locales ───────────────────────────────────────────────

/** Centroide (media aritmética) de los vértices de un anillo. Punto representativo
 *  suficiente para detectarHuso (que solo decide en qué huso deproyecta el punto). */
function centroideVertices(anillo) {
  let sx = 0
  let sy = 0
  for (const [x, y] of anillo) {
    sx += x
    sy += y
  }
  return [sx / anillo.length, sy / anillo.length]
}

/** ¿Todos los vértices parecen grados geográficos (|v|<1000)? Criterio de sanear,
 *  usado como PRE-chequeo para no medir "misclosure en metros" sobre grados. */
function pareceGrados(anillo) {
  return anillo.length > 0 && anillo.every(([x, y]) => Math.abs(x) < 1000 && Math.abs(y) < 1000)
}

// ── Detección defensiva de CIERRE sobre un anillo crudo ───────────────────────
//
// Interpreta el cierre SIN alterar la geometría por defecto (decisión de la
// entrevista F01: "ofrecer, no tocar"). Tres bandas según error = dist(V0, Vúltimo):
//   · error ≤ TOL_CIERRE_EXACTO   → Vúltimo es duplicado EXACTO: retirarlo es un
//                                   no-op geométrico → normalización trivial, sin Deteccion.
//   · (EXACTO, toleranciaCierre]  → BANDA AMBIGUA: no se sabe si Vúltimo es un vértice
//                                   de cierre mal tecleado o una arista corta REAL. NO se
//                                   toca; AVISO con las DOS lecturas OFRECIDAS como dato
//                                   (retirar / compensar). Solo se aplica si opts lo pide.
//   · error > toleranciaCierre    → anillo ABIERTO con arista de cierre real (caso normal
//                                   LIST/TXT/DXF). No se toca; INFO dejando constancia de
//                                   la interpretación (regla 1: nada se asume en silencio).
// El usuario ELIGE la corrección vía opts.compensarCierre (Bowditch) o opts.retirarCierre.
function resolverCierre(anilloCrudo, esGrados, opts, detecciones) {
  // Grados: el "error de cierre" en metros no tiene sentido (son grados). Se deja
  // el anillo tal cual; el bloque GRADOS lo señalará y bloqueará el modelo.
  if (esGrados || anilloCrudo.length < 2) return anilloCrudo

  const error = errorCierre(anilloCrudo)

  // (a) Duplicado EXACTO/insignificante: retirar Vúltimo es no-op → sin Deteccion.
  if (error <= TOL_CIERRE_EXACTO) {
    return anilloCrudo.slice(0, -1).map(([x, y]) => [x, y])
  }

  // (b) Anillo ABIERTO con arista de cierre real (LEJOS): no se toca, pero se deja
  //     constancia (INFO) para que la interpretación no sea una asunción silenciosa.
  if (error > opts.toleranciaCierre) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.CIERRE,
        `Anillo tratado como ABIERTO: primer y último vértice distan ${error.toFixed(4)} m ` +
          `(> ${opts.toleranciaCierre} m) → se interpreta como arista de cierre real, no como misclosure.`,
        SEVERIDAD.INFO,
        { error, interpretacion: 'ABIERTO', toleranciaCierre: opts.toleranciaCierre },
      ),
    )
    return anilloCrudo.map(([x, y]) => [x, y])
  }

  // (c) BANDA AMBIGUA: se OFRECEN ambas lecturas; por defecto NO se altera la geometría.
  const comp = compensarCierre(anilloCrudo, { metodo: opts.metodoCierre })
  const sinCierre = anilloCrudo.slice(0, -1).map(([x, y]) => [x, y])
  let salida = anilloCrudo.map(([x, y]) => [x, y]) // por defecto: crudo, intacto
  let aplicado = 'NINGUNO'
  if (opts.compensarCierre === true) {
    salida = comp.anillo.map(([x, y]) => [x, y])
    aplicado = 'COMPENSADO'
  } else if (opts.retirarCierre === true) {
    salida = sinCierre
    aplicado = 'RETIRADO'
  }
  detecciones.push(
    crearDeteccion(
      TIPO_DETECCION.CIERRE,
      `El último vértice queda a ${error.toFixed(4)} m del primero (banda ambigua ≤ ${opts.toleranciaCierre} m): ` +
        `puede ser un vértice de cierre mal tecleado o una arista corta real. Por defecto NO se toca; se ofrecen ` +
        `dos lecturas (retirar el vértice de cierre / compensar el misclosure ${opts.metodoCierre ?? 'bowditch'}). ` +
        `Aplicado: ${aplicado}.`,
      SEVERIDAD.AVISO,
      {
        error,
        aplicado, // 'NINGUNO' | 'COMPENSADO' | 'RETIRADO'
        metodo: opts.metodoCierre ?? 'bowditch',
        anilloSinCierre: sinCierre, // oferta A: retirar Vúltimo
        anilloCompensado: comp.anillo, // oferta B: compensar el misclosure
        toleranciaCierre: opts.toleranciaCierre,
      },
    ),
  )
  return salida
}

// ── Detección defensiva de SWAP_XY / GRADOS sobre un anillo (por anillo) ───────
//
// sanear es POR coordenada; aquí se decide POR ANILLO. Devuelve el anillo a
// almacenar (intercambiado solo si opts.intercambiarXY y TODO el anillo lo pide)
// y `gradosAll` (para bloquear el modelo). Empuja las Detecciones oportunas.
function resolverSaneo(anillo, opts, detecciones) {
  const n = anillo.length
  if (n === 0) return { anillo, gradosAll: false }

  const saneos = anillo.map((v) => sanear(v))
  const swapCorrs = saneos.map((s) => s.correcciones.find((c) => c.tipo === 'SWAP_XY') || null)
  const gradCorrs = saneos.map((s) => s.correcciones.find((c) => c.tipo === 'GRADOS') || null)
  const nSwap = swapCorrs.filter(Boolean).length
  const nGrados = gradCorrs.filter(Boolean).length

  // ── GRADOS (geográficas pegadas) ──
  const gradosAll = nGrados === n
  if (gradosAll) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.GRADOS,
        `Todo el anillo (${n} vértices) parece estar en grados geográficos (|v|<1000), no en UTM. ` +
          `Se ofrece proyectar; no se reproyecta aquí (regla 3).`,
        SEVERIDAD.AVISO,
        { vertices: n, reproyectar: true },
      ),
    )
  } else if (nGrados > 0) {
    // Inconsistente: unos sí, otros no → datos sospechosos, NO se proyecta.
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.GRADOS,
        `Datos sospechosos: ${nGrados}/${n} vértices con |v|<1000 (posibles grados) y el resto no. ` +
          `No se proyecta: revisa la mezcla de unidades.`,
        SEVERIDAD.AVISO,
        { conGrados: nGrados, total: n },
      ),
    )
  }

  // ── SWAP_XY (X/Y invertidas) ──
  let anilloResuelto = anillo
  const swapAll = nGrados === 0 && nSwap === n // grados y swap son excluyentes por vértice
  if (swapAll) {
    const intercambiado = saneos.map((s) => [s.coord[0], s.coord[1]])
    const rangoPlausible = swapCorrs.every((c) => c && c.rangoPlausible)
    const aplicar = opts.intercambiarXY === true
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.SWAP_XY,
        `Todo el anillo (${n} vértices) tiene X/Y invertidas (|Este|>1e6, |Norte|<1e6). ` +
          `Se ofrece el anillo intercambiado${rangoPlausible ? '' : ' (aviso: fuera del rango UTM plausible tras el swap)'}; ` +
          `${aplicar ? 'aplicado' : 'NO aplicado por defecto'}.`,
        SEVERIDAD.AVISO,
        { vertices: n, rangoPlausible, aplicado: aplicar, anilloIntercambiado: intercambiado },
      ),
    )
    if (aplicar) anilloResuelto = intercambiado.map(([x, y]) => [x, y])
  } else if (nSwap > 0) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.SWAP_XY,
        `Datos sospechosos: ${nSwap}/${n} vértices parecen tener X/Y invertidas y el resto no. ` +
          `No se intercambia: revisa el orden de columnas.`,
        SEVERIDAD.AVISO,
        { conSwap: nSwap, total: n },
      ),
    )
  }

  return { anillo: anilloResuelto, gradosAll }
}

// ── Detección de HUSO sobre el anillo exterior ────────────────────────────────
//
// Calcula el centroide del exterior y deduce el huso. El resultado es SIEMPRE una
// OFERTA (nunca un desplegable forzado, feature §5.5): el punto de caída se emite
// como HUSO_DETECTADO/INFO; si no cae en España, HUSO_DETECTADO/AVISO; si es
// ambiguo, un HUSO_AMBIGUO/AVISO extra con todos los candidatos. HUSO_DETECTADO
// (punto de caída / no deducible) y HUSO_AMBIGUO (varios husos viables) son tipos
// DISTINTOS: así la UI de F03 filtra la ambigüedad sin falsos positivos del camino
// feliz. (_comun.js es módulo de F01, no de F00: ampliar su léxico está en alcance.)
function resolverHuso(anilloExterior, opts, detecciones) {
  if (!anilloExterior || anilloExterior.length === 0) return null

  const centro = centroideVertices(anilloExterior)
  const candidatos = opts.huso != null ? [opts.huso] : undefined
  const huso = detectarHuso(centro, candidatos)

  if (huso === null) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.HUSO_DETECTADO,
        `El centroide de la parcela (${centro[0].toFixed(2)}, ${centro[1].toFixed(2)}) no cae en la ` +
          `España peninsular ni Baleares: no se pudo deducir el huso. Revisa coordenadas/huso.`,
        SEVERIDAD.AVISO,
        { fueraDeEspana: true, centroide: centro },
      ),
    )
    return null
  }

  // Punto de caída (interpretación prioritaria) — siempre, como INFO.
  detecciones.push(
    crearDeteccion(
      TIPO_DETECCION.HUSO_DETECTADO,
      `La parcela cae en el huso ${huso.zona} (${huso.srs}): ` +
        `lon=${huso.lon.toFixed(6)}, lat=${huso.lat.toFixed(6)}.`,
      SEVERIDAD.INFO,
      {
        zona: huso.zona,
        srs: huso.srs,
        lon: huso.lon,
        lat: huso.lat,
        ambiguo: huso.ambiguo,
        candidatos: huso.candidatos,
      },
    ),
  )

  // Ambigüedad real (varios husos viables): AVISO extra con todos los candidatos.
  if (huso.ambiguo) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.HUSO_AMBIGUO,
        `Huso ambiguo: ${huso.candidatos.length} interpretaciones viables ` +
          `(${huso.candidatos.map((c) => c.zona).join(', ')}). ` +
          `Se ofrece la ${huso.zona} por defecto; confirma dónde cae en cada una.`,
        SEVERIDAD.AVISO,
        { candidatos: huso.candidatos, prioritario: huso.zona },
      ),
    )
  }

  return huso
}

// ── Cotejo de superficie (valor añadido; solo LIST con meta.areaReportada) ────
function cotejarSuperficie(recintos, areaReportada, umbral) {
  const calculada = superficie(recintos)
  const diferencia = Math.abs(calculada - areaReportada)
  const diferenciaRelativa =
    areaReportada !== 0 ? diferencia / Math.abs(areaReportada) : calculada === 0 ? 0 : Infinity
  return {
    calculada,
    reportada: areaReportada,
    diferencia,
    diferenciaRelativa,
    umbral,
    coincide: diferenciaRelativa <= umbral,
  }
}

// ── Recuento de detecciones para el resumen ───────────────────────────────────
function contarDetecciones(detecciones) {
  const porTipo = {}
  const porSeveridad = { INFO: 0, AVISO: 0, ERROR: 0 }
  for (const d of detecciones) {
    porTipo[d.tipo] = (porTipo[d.tipo] || 0) + 1
    porSeveridad[d.severidad] = (porSeveridad[d.severidad] || 0) + 1
  }
  return { total: detecciones.length, porTipo, porSeveridad }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * @typedef {Object} ResumenImportacion
 * @property {'LIST'|'TXT'|'DXF'} formato   Formato usado (dado o deducido).
 * @property {boolean} formatoAutodetectado true si el formato se dedujo.
 * @property {string} origen                 ORIGEN_PARCELA del parser.
 * @property {number} nAnillos               Nº de anillos importados.
 * @property {number[]} nVertices            Nº de vértices por anillo (ya abiertos).
 * @property {{zona:number,srs:string,lon:number,lat:number,ambiguo:boolean}|null} huso
 *   Punto de caída (dónde cae la parcela) del huso deducido; null si no se resolvió.
 * @property {object|null} superficie        Cotejo calculada vs reportada (solo LIST con meta).
 * @property {string[]} bloqueos             Motivos por los que `parcela` es null (vacío si se construyó).
 * @property {boolean} construida            true si se construyó la parcela.
 * @property {{total:number,porTipo:object,porSeveridad:object}} detecciones  Recuentos.
 */

/**
 * Importa un volcado de parcela (LIST/TXT/DXF), aplica los detectores defensivos
 * de F00 y, si no hay bloqueos, construye el modelo. NUNCA corrige en silencio.
 *
 * @param {string} texto  Volcado del técnico (pegado LISTA, TXT o DXF ASCII).
 * @param {object} [opts]
 * @param {'LIST'|'TXT'|'DXF'} [opts.formato]  Formato; si se omite, se autodetecta.
 * @param {string} [opts.idLocal='parcela-importada']  idLocal del modelo.
 * @param {string|null} [opts.refcat=null]  Referencia catastral.
 * @param {number} [opts.huso]  Si el dato YA trae huso (29/30/31), se VERIFICA solo ese.
 * @param {boolean} [opts.compensarCierre=false]  En la banda ambigua, aplicar la compensación (Bowditch) al modelo.
 * @param {boolean} [opts.retirarCierre=false]  En la banda ambigua, retirar el vértice de cierre (sin compensar). Excluyente con compensarCierre.
 * @param {boolean} [opts.intercambiarXY=false]  Aplicar el swap X/Y al modelo cuando todo el anillo lo pida.
 * @param {number} [opts.toleranciaCierre=0.5]  Ventana (m) para tratar el error de cierre como misclosure.
 * @param {'bowditch'|'lineal'} [opts.metodoCierre='bowditch']  Método de compensación ofrecido.
 * @param {number} [opts.umbralSuperficie=0.01]  Umbral relativo del cotejo de superficie.
 * @param {','|'.'} [opts.separadorDecimal]  Reenviado a los parsers LIST/TXT.
 * @param {string} [opts.palabraSeparador]  Reenviado a los parsers LIST/TXT.
 * @param {number} [opts.flechaMax]  Reenviado al parser DXF (discretización de arcos).
 * @returns {{ parcela: object|null, anillos: number[][][],
 *   detecciones: import('./_comun.js').Deteccion[], resumen: ResumenImportacion }}
 * @throws {TypeError}   Si `texto` no es un string (error de programación).
 * @throws {RangeError}  Si `opts.formato` u `opts.huso` son inválidos (error de programación).
 */
export function importar(texto, opts = {}) {
  if (typeof texto !== 'string') {
    throw new TypeError(`importar: se esperaba el volcado como string; recibido ${typeof texto}.`)
  }
  if (opts.formato !== undefined && !Object.values(FORMATOS).includes(opts.formato)) {
    throw new RangeError(
      `importar: 'opts.formato' inválido: ${JSON.stringify(opts.formato)}. Válidos: LIST, TXT, DXF.`,
    )
  }
  if (opts.huso !== undefined && !HUSOS_VALIDOS.includes(opts.huso)) {
    throw new RangeError(
      // Los husos se DERIVAN de `HUSOS_VALIDOS` (la misma lista que valida arriba),
      // nunca se escriben a mano: el mensaje no puede desincronizarse de la
      // comprobación el día que entre Canarias. Igual que `geo/huso.js:142-143`.
      `importar: 'opts.huso' inválido: ${JSON.stringify(opts.huso)}. Válidos: ${HUSOS_VALIDOS.join(', ')} (Canarias diferido).`,
    )
  }

  const idLocal = typeof opts.idLocal === 'string' && opts.idLocal.length > 0 ? opts.idLocal : 'parcela-importada'
  const refcat = opts.refcat ?? null
  const umbral = typeof opts.umbralSuperficie === 'number' ? opts.umbralSuperficie : UMBRAL_SUPERFICIE
  const optsInternas = {
    ...opts,
    toleranciaCierre:
      typeof opts.toleranciaCierre === 'number' ? opts.toleranciaCierre : TOL_CIERRE_MISCLOSURE,
  }

  // 1) Formato (dado o autodetectado) y despacho al parser.
  const formatoAutodetectado = opts.formato === undefined
  const formato = opts.formato ?? autodetectarFormato(texto)
  const res = despachar(formato, texto, opts)

  // 2) Arrastramos las detecciones del parser al informe final.
  const detecciones = [...res.detecciones]

  // 3) Detectores defensivos por anillo: cierre → saneo (swap/grados).
  const anillos = []
  let gradosCualquiera = false
  res.anillos.forEach((anilloCrudo) => {
    const esGrados = pareceGrados(anilloCrudo)
    const abierto = resolverCierre(anilloCrudo, esGrados, optsInternas, detecciones)
    const { anillo, gradosAll } = resolverSaneo(abierto, optsInternas, detecciones)
    anillos.push(anillo)
    // Un anillo ENTERO en grados (exterior O hueco) contamina el modelo con unidades
    // mezcladas → bloquea la construcción (regla 1). Antes solo se miraba el exterior:
    // un hueco en grados se colaba a un GML con unidades mezcladas (revisión F01, MEDIO).
    if (gradosAll) gradosCualquiera = true
  })

  // 4) Huso sobre el anillo exterior (siempre se informa el punto de caída).
  const huso = anillos.length > 0 ? resolverHuso(anillos[0], opts, detecciones) : null

  // 5) Modelo. Los recintos se construyen salvo que sean grados (no son UTM).
  //    recintos[0] = EXTERIOR; el resto = HUECO (multiparcela fuera de alcance).
  let recintos = null
  if (anillos.length > 0 && !gradosCualquiera) {
    recintos = anillos.map((r, i) =>
      crearRecinto(r, i === 0 ? TIPO_RECINTO.EXTERIOR : TIPO_RECINTO.HUECO),
    )
  }

  // 6) Cotejo de superficie (valor añadido, solo LIST con Área reportada).
  let cotejo = null
  if (recintos && recintos.length > 0 && res.origen === ORIGEN_PARCELA.LIST && res.meta &&
      typeof res.meta.areaReportada === 'number') {
    cotejo = cotejarSuperficie(recintos, res.meta.areaReportada, umbral)
  }

  // 7) Bloqueos → parcela o null (SIEMPRE con informe, nunca excepción por dato malo).
  const bloqueos = []
  if (anillos.length === 0) bloqueos.push('SIN_GEOMETRIA')
  else {
    if (gradosCualquiera) bloqueos.push('COORDENADAS_EN_GRADOS')
    if (huso === null) bloqueos.push('HUSO_NO_RESUELTO')
  }
  const parcela =
    bloqueos.length === 0 && recintos
      ? crearParcela({ idLocal, refcat, recintos, origen: res.origen })
      : null

  // 8) Resumen para la UI (F03).
  const resumen = {
    formato,
    formatoAutodetectado,
    origen: res.origen,
    nAnillos: anillos.length,
    nVertices: anillos.map((r) => r.length),
    huso: huso ? { zona: huso.zona, srs: huso.srs, lon: huso.lon, lat: huso.lat, ambiguo: huso.ambiguo } : null,
    superficie: cotejo,
    bloqueos,
    construida: parcela !== null,
    detecciones: contarDetecciones(detecciones),
  }

  return { parcela, anillos, detecciones, resumen }
}

export default importar

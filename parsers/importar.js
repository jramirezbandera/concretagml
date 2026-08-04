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
//
// ── F11 · EL REPARTO POR CAPAS, Y EL DEFECTO QUE DESTAPÓ ─────────────────────
//
// ⛔ Hasta F11 este módulo construía parcelas de superficie NEGATIVA en silencio.
// MEDIDO el 2026-08-03: `importar(UTM.dxf)` devolvía **−390,45 m²** (la parcela
// real mide 61,05) y el DXF de dos capas que escribe `export/dxf.js` devolvía
// **−100,00 m²** (la real, 1.500,00); las dos veces con `bloqueos: []` y
// `construida: true`. La causa está abajo, en el paso 5: `recintos[0]` es el
// EXTERIOR y TODO lo demás HUECO. Esa regla vale cuando los anillos son una
// figura con sus patios —el caso de LIST/TXT, para el que se escribió— y es
// falsa en cuanto el DXF trae más de un dibujo: en `UTM.dxf` el anillo 0 es un
// linde de 107,94 m² de la capa «PARCELA» y los otros 24 (cajetín, marco,
// leyenda…) se le restan. Es la regla de oro 1 en su forma más pura: un error
// que no avisa. F11 no podía cablear la entrada DXF sin arreglarlo.
//
// El arreglo NO adivina, porque el dato demuestra que adivinar falla: en
// `UTM.dxf` la parcela de verdad está en la capa «0» y NO en la llamada
// «PARCELA» (sus 11 vértices coinciden uno a uno con `PARCELA.txt`, la verdad
// externa de F01). Elegir por el nombre habría fallado en el único plano real
// que tenemos. Así que se hace lo que este módulo hace con todo lo demás
// —ofrecer, no imponer— con DOS guardas y UNA oferta:
//
//   · `ANILLOS_EN_VARIAS_CAPAS` (bloqueo) — si los anillos vienen de más de una
//     capa, no hay forma honrada de decir cuál es el exterior y cuáles los
//     huecos. Se BLOQUEA nombrando el reparto entero, en vez de adivinar por
//     posición.
//   · `SUPERFICIE_NO_POSITIVA` (bloqueo) — la prueba, no la causa: si el
//     exterior menos los huecos sale ≤ 0, eso no es una parcela, se llame como
//     se llame. Hace falta ADEMÁS del anterior porque el reparto también se
//     rompe DENTRO de una sola capa: en `UTM.dxf`, `opts.capa: 'PARCELA'` deja
//     tres anillos disjuntos (107,94 − 65,70 − 71,31) y da **−29,06 m² medidos**.
//   · `opts.capa` (la oferta) — el llamante elige una capa y se importa solo
//     esa. Es el mismo patrón que `opts.intercambiarXY`, `opts.compensarCierre`
//     y `opts.retirarCierre`: la detección OFRECE, `opts` APLICA. Con
//     `opts.capa: '0'` sobre `UTM.dxf` salen los 61,05 m² buenos y `bloqueos: []`.
//     Y es también la respuesta a la asimetría que dejó escrita F10: nuestro
//     propio DXF vuelve con `PARCELA_OFICIAL` y `PARCELA_EDITADA` 1:1 con sus
//     anillos, así que la geometría editada se recupera pidiendo su capa.
//
// ⚠️ Los dos bloqueos nuevos son DE PARCELA, no del dato: dicen que el reparto
// «uno exterior + N huecos» no se sostiene, no que el fichero esté mal. Para la
// rama EDIFICIO —donde cada anillo es su propio exterior— **no aplican**; ver el
// catálogo `BLOQUEOS` más abajo, que lo declara uno a uno.
//
// ⚠️ El tipo de las detecciones de reparto es `SEPARADOR_POLIGONO`, que es el
// único hueco del léxico CONGELADO de `parsers/_comun.js` que habla de cómo se
// reparten los anillos en polígonos (allí, la palabra `separador` de LIST/TXT;
// aquí, la capa del DXF). El nombre propio sería `REPARTO_POR_CAPAS`, pero
// ampliar ese léxico no es de esta tarea: `parsers/_comun.js` no se toca en F11.

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

/**
 * Catálogo de motivos por los que `parcela` sale `null`. Existía disperso en
 * literales; F11 lo reúne para que nadie lo escriba a mano y —sobre todo— para
 * poder DECIR cuál es universal y cuál es de la rama parcela.
 *
 * Universales (valen igual para un edificio):
 *   · `SIN_GEOMETRIA`         — no llegó ni un anillo.
 *   · `COORDENADAS_EN_GRADOS` — algún anillo entero parece lat/lon, no UTM.
 *   · `HUSO_NO_RESUELTO`      — el punto no cae en la España peninsular ni Baleares.
 *
 * ⚠️ SOLO DE PARCELA (F11): hablan del reparto «recintos[0] EXTERIOR y el resto
 * HUECO», que es una regla de este módulo y NO del fichero. Un edificio no los
 * hereda —para él cada anillo es su propio exterior—, así que quien reutilice
 * este orquestador para otra rama tiene que FILTRARLOS, no arrastrarlos:
 *   · `ANILLOS_EN_VARIAS_CAPAS` — los anillos vienen de más de una capa del DXF.
 *   · `SUPERFICIE_NO_POSITIVA`  — exterior menos huecos da ≤ 0 m².
 * El filtro es una línea, {@link BLOQUEOS_SOLO_PARCELA}, y hace falta: un DXF de
 * edificio SIEMPRE trae varias capas (el fixture real son «Construccion» ⇢ 7 y
 * «Parcela» ⇢ 1), así que arrastrarlos dejaría la rama de edificio bloqueada
 * justo en su caso normal.
 *
 * @readonly
 */
export const BLOQUEOS = Object.freeze({
  SIN_GEOMETRIA: 'SIN_GEOMETRIA',
  COORDENADAS_EN_GRADOS: 'COORDENADAS_EN_GRADOS',
  HUSO_NO_RESUELTO: 'HUSO_NO_RESUELTO',
  ANILLOS_EN_VARIAS_CAPAS: 'ANILLOS_EN_VARIAS_CAPAS',
  SUPERFICIE_NO_POSITIVA: 'SUPERFICIE_NO_POSITIVA',
})

/** Los dos bloqueos que hablan del reparto de parcela y NO del fichero. */
export const BLOQUEOS_SOLO_PARCELA = Object.freeze([
  BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS,
  BLOQUEOS.SUPERFICIE_NO_POSITIVA,
])

/**
 * ⛔ **Y hay una segunda mitad, que se descubrió en producción y no en la suite.**
 * Filtrar `resumen.bloqueos` no basta: **la detección que acompaña a un bloqueo de
 * parcela se sigue LEYENDO**, y es la mitad que ve el usuario. El guion de humo 13
 * (F11 · T5.2, 2026-08-04) midió la rama EDIFICIO diciendo a la vez «Cargadas 7
 * partes… 62 vértices en total» y «El contorno menos los huecos da **−13,32 m²**…
 * **No se construye la parcela**». Las dos frases eran ciertas por separado; juntas
 * son una contradicción, y la suite estaba verde porque reenviar las detecciones
 * «tal cual» era deliberado y estaba probado.
 *
 * Por eso esas detecciones llevan **`datos.bloqueo`** con el código al que
 * acompañan, y quien filtre los bloqueos filtra también las detecciones con la
 * MISMA lista. No se filtra por `tipo` —`SEPARADOR_POLIGONO` lo comparte con el
 * mensaje del reparto por capas, que sí le sirve al edificio— ni por texto, que es
 * lo único de una detección que se puede reescribir sin avisar.
 *
 * @param {ReadonlyArray<object>} detecciones
 * @returns {Array<object>}  Las que NO hablan del reparto de parcela.
 */
export function sinDeteccionesDeParcela(detecciones) {
  return detecciones.filter((d) => {
    const bloqueo = d?.datos?.bloqueo
    return bloqueo === undefined || !BLOQUEOS_SOLO_PARCELA.includes(bloqueo)
  })
}

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

// ── Reparto por capas (solo DXF: es el único formato que trae código 8) ───────
//
// Cuenta cuántos anillos aporta cada capa, aplica `opts.capa` si el llamante ha
// elegido una, y deja constancia del reparto ENTERO (regla 1: el usuario tiene
// que poder ver las 5 capas de su plano aunque solo importemos una).

/** Reparto {capa: nºAnillos}, ordenado de más a menos anillos (empates: orden
 *  de aparición). Es el orden en que la interfaz debe ofrecerlo: primero el
 *  grupo grande, que es el que suele ser mobiliario de dibujo o el bueno. */
function contarCapas(capas) {
  const m = new Map()
  for (const c of capas) m.set(c, (m.get(c) || 0) + 1)
  return [...m.entries()].sort((a, b) => b[1] - a[1])
}

/** «"FINO" ⇢ 16, "LINDE" ⇢ 4, …» — con el nombre entrecomillado porque una capa
 *  puede llamarse «0» y «0 1» no se lee. */
function textoReparto(pares) {
  return pares.map(([nombre, n]) => `«${nombre}» ⇢ ${n}`).join(', ')
}

/**
 * Aplica el reparto por capas: emite la detección-resumen y, si `opts.capa` pide
 * una, filtra los anillos a esa capa. Devuelve el subconjunto a importar.
 *
 * @param {number[][][]} anillos  Anillos crudos del parser.
 * @param {string[]} capas        `capas[i]` es la capa de `anillos[i]`.
 * @param {string|undefined} capaElegida
 * @param {import('./_comun.js').Deteccion[]} detecciones  Se le empuja la detección.
 * @returns {{ anillos: number[][][], capas: string[], nCapas: number }}
 */
function resolverCapas(anillos, capas, capaElegida, detecciones) {
  const pares = contarCapas(capas)
  const nCapas = pares.length
  const reparto = Object.fromEntries(pares)
  const cabecera =
    `${anillos.length} polilínea(s) en ${nCapas} capa(s): ${textoReparto(pares)}.`

  // (a) El llamante ha elegido capa: se filtra y se dice qué se ha dejado fuera.
  if (capaElegida !== undefined) {
    const indices = capas.map((c, i) => [c, i]).filter(([c]) => c === capaElegida)
    const existe = indices.length > 0
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.SEPARADOR_POLIGONO,
        existe
          ? `${cabecera} Se importa SOLO la capa «${capaElegida}» (${indices.length} anillo(s)); ` +
            `el resto queda fuera a petición del llamante.`
          : `${cabecera} La capa pedida, «${capaElegida}», NO existe en el fichero: ` +
            `no se importa ningún anillo. Elige una de las de arriba.`,
        existe ? SEVERIDAD.INFO : SEVERIDAD.AVISO,
        { capas: reparto, nCapas, nAnillos: anillos.length, aplicado: 'FILTRADO', capaElegida, existe },
      ),
    )
    return {
      anillos: indices.map(([, i]) => anillos[i]),
      capas: indices.map(([c]) => c),
      nCapas: existe ? 1 : 0,
    }
  }

  // (b) Sin elección: una sola capa es el camino feliz; varias, una decisión que
  //     NO nos toca tomar (bloquea abajo, en el paso 7).
  detecciones.push(
    crearDeteccion(
      TIPO_DETECCION.SEPARADOR_POLIGONO,
      nCapas > 1
        ? `${cabecera} Con los anillos repartidos en varias capas NO se puede decir cuál es el ` +
          `contorno y cuáles los huecos: no se adivina por posición. Elige la capa a importar ` +
          `(opts.capa). Aplicado: NINGUNO.`
        : cabecera,
      nCapas > 1 ? SEVERIDAD.AVISO : SEVERIDAD.INFO,
      { capas: reparto, nCapas, nAnillos: anillos.length, aplicado: 'NINGUNO', capaElegida: null },
    ),
  )
  return { anillos, capas, nCapas }
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
 * @property {string[]} capas                Capa de cada anillo, 1:1 con `nVertices`
 *   y con `anillos`. LITERAL (F11). Solo el DXF trae capas: en LIST y TXT todas
 *   son `''`, porque esos formatos no tienen el concepto y NO se inventa.
 * @property {{zona:number,srs:string,lon:number,lat:number,ambiguo:boolean}|null} huso
 *   Punto de caída (dónde cae la parcela) del huso deducido; null si no se resolvió.
 * @property {object|null} superficie        Cotejo calculada vs reportada (solo LIST con meta).
 * @property {string[]} bloqueos             Motivos por los que `parcela` es null (vacío si se
 *   construyó). Valores de {@link BLOQUEOS}; ⚠️ los de {@link BLOQUEOS_SOLO_PARCELA} hablan del
 *   reparto exterior/huecos de ESTE módulo y no del fichero (ver la cabecera).
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
 * @param {string} [opts.capa]  (F11) Importar SOLO los anillos de esta capa del DXF, con su
 *   nombre LITERAL. Es la oferta que resuelve `ANILLOS_EN_VARIAS_CAPAS`. Si la capa no existe
 *   en el fichero NO se lanza: se avisa nombrándola, no entra ningún anillo y el bloqueo pasa a
 *   ser `SIN_GEOMETRIA` — elegir mal una capa es una decisión sobre el dato, no un fallo del programa.
 * @returns {{ parcela: object|null, anillos: number[][][], capas: string[],
 *   detecciones: import('./_comun.js').Deteccion[], resumen: ResumenImportacion }}
 *   `capas[i]` es la capa de `anillos[i]` (F11); ver `ResumenImportacion.capas`.
 * @throws {TypeError}   Si `texto` no es un string (error de programación).
 * @throws {RangeError}  Si `opts.formato`, `opts.huso` u `opts.capa` son inválidos (error de programación).
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
  if (opts.capa !== undefined && typeof opts.capa !== 'string') {
    // El TIPO es contrato del programador (RangeError, como los de arriba); que la
    // capa EXISTA o no en el fichero es dato del usuario y se resuelve con detecciones.
    throw new RangeError(
      `importar: 'opts.capa' debe ser el nombre literal de una capa (string); recibido ${typeof opts.capa}.`,
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

  // 2bis) Reparto por capas (F11). Solo el DXF trae capas; LIST y TXT no tienen
  //   el concepto, así que se rellena con '' para que `capas` sea SIEMPRE un
  //   array 1:1 con `anillos` —quien lo recorra no se encuentra un `undefined`—
  //   y para que «más de una capa» sea trivialmente falso ahí.
  const traeCapas = Array.isArray(res.capas)
  const capasCrudas = traeCapas ? res.capas : res.anillos.map(() => '')
  const reparto =
    traeCapas && res.anillos.length > 0
      ? resolverCapas(res.anillos, capasCrudas, opts.capa, detecciones)
      : { anillos: res.anillos, capas: capasCrudas, nCapas: capasCrudas.length > 0 ? 1 : 0 }

  // 3) Detectores defensivos por anillo: cierre → saneo (swap/grados).
  const anillos = []
  const capas = [...reparto.capas]
  let gradosCualquiera = false
  reparto.anillos.forEach((anilloCrudo) => {
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

  // 6bis) La superficie del reparto (F11). Es la PRUEBA de que «uno exterior y
  //   el resto huecos» se sostiene: si sale ≤ 0, no es una parcela y no se
  //   construye. No es lo mismo que el cotejo de arriba, que compara contra el
  //   Área que reporta la LISTA de AutoCAD y solo existe en el formato LIST.
  const superficieReparto = recintos && recintos.length > 0 ? superficie(recintos) : null
  if (superficieReparto !== null && superficieReparto <= 0) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.SEPARADOR_POLIGONO,
        `El contorno menos los huecos da ${superficieReparto.toFixed(2)} m² con ${recintos.length} ` +
          `anillo(s): el reparto «el primero es el contorno y los demás son huecos» NO se sostiene. ` +
          `No se construye la parcela; revisa qué anillos del fichero son de verdad la parcela.`,
        SEVERIDAD.AVISO,
        // ⛔ `bloqueo` NO es decoración: es lo que permite FILTRAR esta detección
        // desde fuera sin mirar su texto ni su tipo. Añadido el 2026-08-04, después
        // de que el guion de humo 13 destapara que la rama EDIFICIO enseñaba a la
        // vez «Cargadas 7 partes, 62 vértices» y «da −13,32 m²… No se construye la
        // parcela» — las dos ciertas, y juntas una contradicción.
        //
        // El bloqueo gemelo ya se filtraba con `BLOQUEOS_SOLO_PARCELA` (ver su
        // JSDoc); lo que no se podía filtrar era **la mitad que el usuario LEE**.
        // Filtrarla por `tipo` no vale: `SEPARADOR_POLIGONO` lo comparte con el
        // mensaje del reparto por capas, que sí le sirve al edificio. Y filtrarla
        // por texto sería atarse a la única cosa que se puede reescribir.
        //
        // ⚠️ Quien añada aquí otra detección que solo tenga sentido para PARCELA
        // tiene que ponerle su `datos.bloqueo`, o volverá a salir en la otra rama.
        // Hay un test que exige que toda detección con `datos.bloqueo` nombre un
        // código de `BLOQUEOS_SOLO_PARCELA`.
        {
          superficie: superficieReparto,
          nRecintos: recintos.length,
          bloqueo: BLOQUEOS.SUPERFICIE_NO_POSITIVA,
        },
      ),
    )
  }

  // 7) Bloqueos → parcela o null (SIEMPRE con informe, nunca excepción por dato malo).
  //    ⚠️ Los códigos se escriben LITERALES y no `BLOQUEOS.X`, a propósito: hay
  //    guardas estáticos que buscan `bloqueos.push('CÓDIGO')` en el texto de este
  //    fichero para que un renombrado aquí caiga en su test y no en producción
  //    (`test/edificio/comun.test.js`, misma fórmula que el grep de proj4 de
  //    `test/contrato.test.js`). La coherencia con el catálogo la ata un test
  //    propio en `test/parsers/importar.test.js`, así que no puede desincronizarse.
  const bloqueos = []
  if (anillos.length === 0) bloqueos.push('SIN_GEOMETRIA')
  else {
    if (gradosCualquiera) bloqueos.push('COORDENADAS_EN_GRADOS')
    if (huso === null) bloqueos.push('HUSO_NO_RESUELTO')
    // Los dos de F11 van AL FINAL, detrás de los tres de F01, para que un
    // `bloqueos[0]` de F01 siga significando lo mismo que significaba.
    if (reparto.nCapas > 1) bloqueos.push('ANILLOS_EN_VARIAS_CAPAS')
    if (superficieReparto !== null && superficieReparto <= 0) {
      bloqueos.push('SUPERFICIE_NO_POSITIVA')
    }
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
    capas,
    huso: huso ? { zona: huso.zona, srs: huso.srs, lon: huso.lon, lat: huso.lat, ambiguo: huso.ambiguo } : null,
    superficie: cotejo,
    bloqueos,
    construida: parcela !== null,
    detecciones: contarDetecciones(detecciones),
  }

  return { parcela, anillos, capas, detecciones, resumen }
}

export default importar

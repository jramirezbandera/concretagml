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
// ── F22 · Y LA PRUEBA DE F11 SOLO PROBABA UNA MITAD ──────────────────────────
//
// ⛔ Lo de arriba llama a `SUPERFICIE_NO_POSITIVA` «la prueba, no la causa».
// MEDIDO el 2026-08-09: **prueba la mitad, y la otra mitad era silenciosa.** El
// DXF de «Consulta Masiva» del Catastro trae la MANZANA ENTERA —su capa
// «Parcela» son 8 fincas disjuntas, cada una con su referencia rotulada dentro— y
// la resta da −8.866,39 m². El bloqueo salta y todo parece funcionar.
//
// **Salta porque la finca más pequeña viene la primera en el fichero.** Con los
// mismos ocho anillos y el mayor delante, la resta da **+368,22 m²** y la parcela
// se CONSTRUYE: una finca que no existe, cuyos siete «huecos» son las parcelas de
// los vecinos, `bloqueos: []`, `construida: true` y lista para firmarse. Lo único
// que separaba a este módulo de entregar geometría falsa era **el orden en que un
// fichero ajeno lista sus polilíneas**.
//
// Por eso F22 mira el reparto POR TOPOLOGÍA (`parsers/topologia.js`) y no por su
// resultado aritmético, y lo mira SIEMPRE que hay más de un anillo:
//
//   · `VARIOS_RECINTOS_DISJUNTOS` (bloqueo) — ningún anillo está dentro de otro y
//     ninguno se solapa con otro ⇒ **no son un contorno con huecos, son N fincas**.
//     La salida no es corregir nada: es ELEGIR cuál de ellas es la del expediente,
//     y ésa es la decisión que F22 le pone delante al usuario.
//   · `SUPERFICIE_NO_POSITIVA` se queda **intacto** para su caso —anillos que se
//     solapan de verdad, o sea un dato roto— y deja de contestar cuando la causa
//     es la otra. Los dos son excluyentes: decir a la vez «son ocho, elige una» y
//     «revisa qué anillos son de verdad la parcela» son dos frases ciertas que
//     juntas se leen como una contradicción, y esa factura ya se pagó en F11 con
//     el guion 13.
//
// ⚠️ El bloqueo nuevo entra en {@link BLOQUEOS_SOLO_PARCELA}, y ahí es donde más
// falta hace: las huellas de un edificio son disjuntas POR DEFINICIÓN, así que sin
// el filtro la rama EDIFICIO se habría bloqueado en el 100 % de sus ficheros.
//
// ⚠️ El tipo de las detecciones de reparto es `SEPARADOR_POLIGONO`, que es el
// único hueco del léxico CONGELADO de `parsers/_comun.js` que habla de cómo se
// reparten los anillos en polígonos (allí, la palabra `separador` de LIST/TXT;
// aquí, la capa del DXF). El nombre propio sería `REPARTO_POR_CAPAS`, pero
// ampliar ese léxico no es de esta tarea: `parsers/_comun.js` no se toca en F11.

import { parseLIST } from './list.js'
import { parseTXT } from './txt.js'
import { parseDXF } from './dxf.js'
import { analizarReparto, rotularRecintos } from './topologia.js'
import { crearDeteccion, declinar, SUJETOS, TIPO_DETECCION, SEVERIDAD } from './_comun.js'
import {
  detectarHuso,
  sanear,
  situarGrados,
  pareceEnGrados,
  HUSOS_VALIDOS,
} from '../geo/huso.js'
import { forward } from '../geo/utm.js'
import { errorCierre, compensarCierre } from '../geo/cierre.js'
import { area, superficie } from '../geo/area.js'
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
 *   · `VARIOS_RECINTOS_DISJUNTOS` (F22) — los anillos son N fincas separadas.
 * El filtro es una línea, {@link BLOQUEOS_SOLO_PARCELA}, y hace falta: un DXF de
 * edificio SIEMPRE trae varias capas (el fixture real son «Construccion» ⇢ 7 y
 * «Parcela» ⇢ 1), así que arrastrarlos dejaría la rama de edificio bloqueada
 * justo en su caso normal. ⚠️ El de F22 es el que MÁS falta hace que se filtre:
 * las huellas de un edificio son disjuntas **por definición**, así que sin el
 * filtro la rama EDIFICIO se bloquearía en el 100 % de sus ficheros.
 *
 * @readonly
 */
export const BLOQUEOS = Object.freeze({
  SIN_GEOMETRIA: 'SIN_GEOMETRIA',
  COORDENADAS_EN_GRADOS: 'COORDENADAS_EN_GRADOS',
  HUSO_NO_RESUELTO: 'HUSO_NO_RESUELTO',
  ANILLOS_EN_VARIAS_CAPAS: 'ANILLOS_EN_VARIAS_CAPAS',
  SUPERFICIE_NO_POSITIVA: 'SUPERFICIE_NO_POSITIVA',
  VARIOS_RECINTOS_DISJUNTOS: 'VARIOS_RECINTOS_DISJUNTOS',
})

/** Los bloqueos que hablan del reparto de parcela y NO del fichero. */
export const BLOQUEOS_SOLO_PARCELA = Object.freeze([
  BLOQUEOS.ANILLOS_EN_VARIAS_CAPAS,
  BLOQUEOS.SUPERFICIE_NO_POSITIVA,
  BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
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
 *  usado como PRE-chequeo para no medir "misclosure en metros" sobre grados.
 *  ⚠️ El umbral NO se reescribe aquí desde F19: es `geo/huso.js#UMBRAL_GRADOS`,
 *  el mismo que usa `sanear`. Eran dos copias y F19 iba a añadir la tercera. */
function pareceGrados(anillo) {
  return anillo.length > 0 && anillo.every((v) => pareceEnGrados(v))
}

/**
 * Proyecta un anillo de grados a UTM con la situación ya decidida
 * ({@link situarGrados}). La Z no existe aquí: los parsers ya la descartaron.
 *
 * ⚠️ **El orden lo manda la situación, no el fichero**: si las columnas venían
 * como (lat, lon) —cosa que pasa con los volcados de GPS— se leen al revés y se
 * escriben SIEMPRE como [Este, Norte], que es lo único que el modelo admite.
 *
 * @param {number[][]} anillo
 * @param {import('../geo/huso.js').SituacionGrados} situacion
 * @returns {number[][]}
 */
function proyectarAnillo(anillo, situacion) {
  return anillo.map(([a, b]) => {
    const lon = situacion.invertido ? b : a
    const lat = situacion.invertido ? a : b
    const { x, y } = forward(lat, lon, situacion.zona)
    return [x, y]
  })
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

/**
 * La cola del mensaje de GRADOS: qué se puede hacer con estas coordenadas.
 *
 * ⛔ **Existe porque hasta F19 aquí se decía «se ofrece proyectar» y no había
 * NADIE que supiera hacerlo** (F18, M10). Ahora cada rama dice lo que de verdad
 * pasa, y la de Canarias la nombra en vez de dejarla caer en un «fuera de
 * España» que es cierto de forma inútil.
 *
 * @param {import('../geo/huso.js').SituacionGrados|null} situacion
 * @returns {string}
 */
function textoSituacionGrados(situacion) {
  if (situacion === null) return 'Se ofrece proyectar; no se reproyecta aquí (regla 3).'

  const comoVienen = situacion.invertido
    ? 'Las columnas vienen como (latitud, longitud), al revés de lo habitual. '
    : ''

  if (situacion.proyectable) {
    return (
      `${comoVienen}Cae en la España peninsular o Baleares, huso ${situacion.zona} ` +
      `(${situacion.srs}), en lon=${situacion.lon.toFixed(6)}, lat=${situacion.lat.toFixed(6)}. ` +
      `Se OFRECE proyectarlas a UTM; no se proyecta nada sin confirmarlo.`
    )
  }
  if (situacion.region === 'CANARIAS') {
    return (
      `${comoVienen}Cae en Canarias (huso ${situacion.zona}), en lon=${situacion.lon.toFixed(6)}, ` +
      `lat=${situacion.lat.toFixed(6)}. **Esta versión no proyecta Canarias** (está diferida): ` +
      `vuelve a exportar el dibujo en UTM desde el CAD.`
    )
  }
  return (
    `Leídas en los dos órdenes posibles, no caen ni en la España peninsular y Baleares ni en ` +
    `Canarias, así que no se puede deducir el huso. Revisa el orden de las columnas o el sistema ` +
    `de referencia, y vuelve a exportar el dibujo en UTM desde el CAD.`
  )
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
    // F19 · La situación (dónde cae, en qué orden vienen las columnas y si el
    // proyecto sabe proyectarla) la calcula `importar()` UNA vez sobre el anillo
    // exterior —el huso es uno para toda la parcela— y la deja aquí. Si no viene,
    // el mensaje es el de antes: este módulo no la deduce por su cuenta.
    const situacion = opts.situacionGrados ?? null
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.GRADOS,
        `Todo el anillo (${n} vértices) parece estar en grados geográficos (|v|<1000), no en UTM. ` +
          textoSituacionGrados(situacion),
        SEVERIDAD.AVISO,
        { vertices: n, reproyectar: true, situacion },
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

  // ⭐ F14 · De QUÉ se habla. El defecto es «la parcela», así que la rama de
  // parcela dice exactamente lo que decía. Ver `parsers/_comun.js#SUJETO`.
  const sujeto = declinar(opts.sujeto)

  if (huso === null) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.HUSO_DETECTADO,
        `El centroide ${sujeto.genitivo} (${centro[0].toFixed(2)}, ${centro[1].toFixed(2)}) no cae en la ` +
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
      `${sujeto.nominativo} cae en el huso ${huso.zona} (${huso.srs}): ` +
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

/**
 * El huso cuando el fichero viene en grados y NO se ha proyectado. No se deduce
 * nada aquí: se traslada lo que {@link situarGrados} ya sabe, con la misma forma
 * que devuelve {@link resolverHuso} para que `resumen.huso` sea siempre lo mismo.
 *
 * ⚠️ **Sin `ambiguo`**: en grados no hay ambigüedad de huso —la longitud lo fija—,
 * al revés que partiendo de metros, donde el Este vale ~500.000 en todos y por eso
 * `detectarHuso` devuelve varios candidatos.
 *
 * Que esto conteste algo (y no `null`) es lo que evita que el usuario reciba a la
 * vez «cae en el huso 30, ¿lo proyecto?» y «no se ha podido resolver el huso»:
 * dos frases ciertas que juntas se leen como una contradicción.
 *
 * @param {import('../geo/huso.js').SituacionGrados|null} situacion
 * @returns {{zona:number, srs:string, lon:number, lat:number, ambiguo:boolean}|null}
 */
function husoDeGrados(situacion) {
  if (situacion === null || !situacion.proyectable) return null
  return {
    zona: situacion.zona,
    srs: situacion.srs,
    lon: situacion.lon,
    lat: situacion.lat,
    ambiguo: false,
  }
}

// ── Reparto por capas (solo DXF: es el único formato que trae código 8) ───────
//
// Cuenta cuántos anillos aporta cada capa, aplica `opts.capa` si el llamante ha
// elegido una, y deja constancia del reparto ENTERO (regla 1: el usuario tiene
// que poder ver las 5 capas de su plano aunque solo importemos una).

// ── F22 · QUÉ CAPA DE RÓTULOS NOMBRA LAS FINCAS ──────────────────────────────
//
// Un DXF del Catastro trae los rótulos repartidos en capas: en el fichero real,
// 153 en `txtConstru` (plantas: `II`, `POR`, `TZA+I`…) y 8 en `RefCatastral` (las
// referencias). Solo una de las dos NOMBRA los recintos.
//
// ⛔ **No se elige por el nombre de la capa, y no es purismo: F11 ya pagó ese
// atajo.** En `UTM.dxf` la parcela de verdad está en la capa «0» y NO en la que
// se llama «PARCELA» — «elegir por el nombre habría fallado en el único plano
// real que tenemos». Aquí `RefCatastral` es un nombre igual de tentador y de
// frágil: lo pone el escritor del DXF, no el formato.
//
// Se elige MIDIENDO: se prueba cada capa de rótulos y se acepta la que empareja
// **1:1 y sin sobras** con los recintos (`rotularRecintos(...).limpia`). Sobre el
// fichero real, `txtConstru` sale con 7 recintos ambiguos —varias plantas dentro
// de cada finca— y `RefCatastral` sale limpia con las ocho referencias. La
// decisión la toma el dato.
//
// ⚠️ Y si empatan DOS capas limpias no se desempata: no se nombra nada y se dice.
// Dos formas distintas de llamar a la misma finca es justo lo que no puede pasar
// en la pantalla donde el usuario reconoce su parcela.

/**
 * Elige la capa de rótulos que nombra los recintos, o `null` si ninguna lo hace.
 *
 * @param {number[][][]} anillos
 * @param {ReadonlyArray<{capa: string}>} rotulos
 * @param {string|undefined} capaPedida  `opts.capaRotulos`: si viene, se usa ESA
 *   y no se prueba ninguna otra (misma forma que `opts.capa`: ofrecer y aplicar).
 * @returns {{capa: string, nombres: Array<string|null>}|null}
 */
function elegirCapaDeRotulos(anillos, rotulos, capaPedida) {
  if (!Array.isArray(rotulos) || rotulos.length === 0 || anillos.length === 0) return null

  const capas = [...new Set(rotulos.map((r) => r.capa))]
  const candidatas = capaPedida === undefined ? capas : capas.filter((c) => c === capaPedida)

  const limpias = []
  for (const capa of candidatas) {
    const r = rotularRecintos(
      anillos,
      rotulos.filter((x) => x.capa === capa),
    )
    if (r.limpia) limpias.push({ capa, nombres: r.nombres })
  }
  // Ninguna limpia, o varias: en los dos casos no se nombra. Ver la cabecera.
  return limpias.length === 1 ? limpias[0] : null
}

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
 * @property {{capa: string, nombres: Array<string|null>}|null} rotulos  **F22.**
 *   Los nombres que el fichero le da a sus recintos, si los trae: `nombres[i]`
 *   nombra a `anillos[i]`. `null` cuando ninguna capa de rótulos empareja 1:1 con
 *   los recintos —o cuando empatan varias, que tampoco se desempata—. Solo el DXF
 *   puede traerlos. ⚠️ Que valga `null` significa «el fichero no los nombra», NO
 *   «no se ha mirado».
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
 * @param {boolean} [opts.proyectarGrados=false]  **F19.** Proyecta a UTM un
 *   fichero que viene ENTERO en grados geográficos. Solo se aplica si además el
 *   destino es proyectable por este proyecto (Península y Baleares; Canarias está
 *   diferida por O13) y **nunca por su cuenta**: hasta que el llamante la pida, la
 *   detección `GRADOS` dice dónde cae y ahí se queda. El orden de las columnas —
 *   (lon, lat) o (lat, lon)— lo decide `geo/huso.js#situarGrados`, no esta opción.
 * @param {','|'.'} [opts.separadorDecimal]  Reenviado a los parsers LIST/TXT.
 * @param {string} [opts.palabraSeparador]  Reenviado a los parsers LIST/TXT.
 * @param {number} [opts.flechaMax]  Reenviado al parser DXF (discretización de arcos).
 * @param {number} [opts.tolerancia]  **F22.** Reenviado a `parsers/topologia.js`:
 *   suelo ABSOLUTO (m²) por debajo del cual dos anillos que se pisan se dan por
 *   disjuntos. Es ruido de coma flotante, no tolerancia de dibujo.
 * @param {string} [opts.capaRotulos]  **F22.** Usar SOLO esta capa de rótulos para
 *   nombrar los recintos, en vez de probarlas todas y quedarse con la que empareja
 *   1:1. Mismo patrón que `opts.capa`: la aplicación ofrece lo que ha medido y el
 *   llamante puede imponer otra cosa. Si la capa pedida no empareja limpiamente,
 *   **no se nombra nada** — pedirla no la hace válida.
 * @param {number} [opts.fraccion]  **F22.** La otra mitad de ese umbral: fracción
 *   del MENOR de los dos anillos. Existe porque el suelo absoluto solo **no
 *   bastaba** contra cartografía real (dos medianeras que comparten muro se pisan
 *   0,0012 m² medidos). Ver `parsers/topologia.js#FRACCION_SOLAPE`.
 * @param {'PARCELA'|'CONSTRUCCION'} [opts.sujeto='PARCELA']  **F14.** De QUÉ hablan
 *   los mensajes de esta capa. Desde F11 el MISMO importador lee el volcado de una
 *   parcela y el de una construcción (`edificio/entrada.js`), y decirle al usuario
 *   «la parcela cae en el huso 30» con trece partes de un edificio delante le hace
 *   buscar un fallo real donde no está. El defecto conserva los literales de
 *   siempre, byte a byte. Ver `parsers/_comun.js#SUJETO`.
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
  if (opts.sujeto !== undefined && !SUJETOS.includes(opts.sujeto)) {
    // Contrato del programador, como `formato` y `huso`: un sujeto mal escrito
    // haría que los avisos hablaran del objeto por defecto sin que nada lo dijera,
    // y son avisos sobre fallos REALES del fichero. Se lanza al ENTRAR, que es
    // donde el error es de quien llama; dentro de los parsers, `declinar` se cae al
    // defecto y no revienta (ver su JSDoc).
    throw new RangeError(
      `importar: 'opts.sujeto' inválido: ${JSON.stringify(opts.sujeto)}. ` +
        `Válidos: ${SUJETOS.join(', ')}. Es de QUÉ hablan los mensajes de esta capa: el MISMO ` +
        `importador lee el volcado de una parcela y el de una construcción desde F11.`,
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

  // 2ter) F19 · ¿Está TODO el fichero en grados? Se decide y se sitúa ANTES del
  //   bucle, y sobre el anillo EXTERIOR, por dos motivos: el huso es uno solo para
  //   toda la parcela (proyectar cada anillo con el suyo la partiría en pedazos que
  //   no encajan), y proyectar antes del bucle hace que el cierre, el saneo, el
  //   huso y la superficie trabajen sobre metros, que es lo que saben hacer.
  const todoEnGrados = reparto.anillos.length > 0 && reparto.anillos.every(pareceGrados)
  const situacionGrados = todoEnGrados
    ? situarGrados(centroideVertices(reparto.anillos[0]))
    : null
  // Se proyecta SOLO si el usuario lo ha pedido (regla de oro 1: ninguna corrección
  // se aplica sola) y si el proyecto sabe hacerlo (Canarias está diferida, O13).
  const proyectando =
    situacionGrados !== null && situacionGrados.proyectable && opts.proyectarGrados === true
  if (proyectando) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.GRADOS,
        `Coordenadas PROYECTADAS de grados a UTM huso ${situacionGrados.zona} ` +
          `(${situacionGrados.srs}), leyendo las columnas como ` +
          `${situacionGrados.invertido ? '(latitud, longitud)' : '(longitud, latitud)'}. ` +
          `Lo que se mide y lo que se exporta desde aquí son metros.`,
        SEVERIDAD.INFO,
        { situacion: situacionGrados, aplicado: true },
      ),
    )
  }
  const conSituacion = situacionGrados === null ? optsInternas : { ...optsInternas, situacionGrados }

  // 3) Detectores defensivos por anillo: cierre → saneo (swap/grados).
  const anillos = []
  const capas = [...reparto.capas]
  let gradosCualquiera = false
  reparto.anillos.forEach((anilloCrudo) => {
    // La proyección va la PRIMERA: de aquí abajo todo el mundo ve metros, y el
    // saneo deja de reconocer grados por sí solo (que es justo lo que queremos:
    // ya no los hay).
    const crudo = proyectando ? proyectarAnillo(anilloCrudo, situacionGrados) : anilloCrudo
    const esGrados = pareceGrados(crudo)
    const abierto = resolverCierre(crudo, esGrados, conSituacion, detecciones)
    const { anillo, gradosAll } = resolverSaneo(abierto, conSituacion, detecciones)
    anillos.push(anillo)
    // Un anillo ENTERO en grados (exterior O hueco) contamina el modelo con unidades
    // mezcladas → bloquea la construcción (regla 1). Antes solo se miraba el exterior:
    // un hueco en grados se colaba a un GML con unidades mezcladas (revisión F01, MEDIO).
    if (gradosAll) gradosCualquiera = true
  })

  // 4) Huso sobre el anillo exterior (siempre se informa el punto de caída).
  //
  // ⛔ F19 · Con el anillo en GRADOS esto no se llama, y el motivo es un defecto
  // medido: `detectarHuso` trata la pareja como metros, desproyecta un disparate y
  // contestaba «el centroide (−4.42, 36.72) no cae en la España peninsular ni
  // Baleares» sobre un punto que ES Málaga. El bloqueo era correcto y **el motivo
  // era falso**. En grados el huso no hay que deducirlo: lo da la longitud, y ya lo
  // ha hecho `situarGrados` unas líneas más arriba.
  //
  // ⚠️ Y si hemos proyectado NOSOTROS, el huso se le pasa como único candidato: no
  // hay nada que deducir sobre unas coordenadas que acabamos de fabricar con él.
  // Sin esto, `detectarHuso` vuelve a encontrar 30 y 31 viables —el Este vale
  // ~500.000 en todos los husos— y la pantalla enseñaba «proyectadas al huso 30» y
  // «huso ambiguo, confirma cuál» una debajo de la otra. Es el modo VERIFICAR que
  // su propia documentación recomienda cuando el dato ya trae huso.
  const optsHuso = proyectando ? { ...opts, huso: situacionGrados.zona } : opts
  const huso =
    anillos.length === 0
      ? null
      : gradosCualquiera
        ? husoDeGrados(situacionGrados)
        : resolverHuso(anillos[0], optsHuso, detecciones)

  // 5) Modelo. Los recintos se construyen salvo que sean grados (no son UTM).
  //    recintos[0] = EXTERIOR; el resto = HUECO. ⚠️ El motivo dejó de ser
  //    «multiparcela fuera de alcance» el 2026-08-03 (override O18): es que un
  //    fichero importado describe UNA parcela, y los anillos que trae detrás del
  //    primero se leen como sus huecos.
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

  // 6ter) ⛔ **F22 · Y la superficie NO BASTA como prueba, que es lo que este
  //   módulo llevaba creyendo desde F11.** `SUPERFICIE_NO_POSITIVA` se escribió
  //   como «la prueba, no la causa», y se midió el 2026-08-09 que solo prueba una
  //   MITAD: el DXF de «Consulta Masiva» del Catastro trae la manzana entera —8
  //   fincas disjuntas en la capa «Parcela»— y da −8.866,39 m² **porque la más
  //   pequeña viene la primera en el fichero**.
  //
  //   ⛔ **Con el orden al revés no había bloqueo ninguno.** Medido sobre esos
  //   MISMOS ocho anillos, poniendo el mayor el primero: `superficie` da
  //   **+368,22 m²** y la parcela se CONSTRUYE — una finca que no existe, con
  //   siete huecos que son las parcelas de los vecinos, sin un solo aviso y lista
  //   para firmarse. Es la regla de oro 1 en su forma más cara, y lo único que nos
  //   separaba de ella era el orden en que un fichero ajeno lista sus polilíneas.
  //
  //   Por eso el reparto se analiza SIEMPRE que hay más de un anillo, y no solo
  //   cuando la resta sale negativa. `parsers/topologia.js` contesta con hechos
  //   —quién está dentro de quién, qué pares se solapan y cuánto— y aquí se decide.
  const analisis =
    anillos.length > 1 && !gradosCualquiera ? analizarReparto(anillos, opts) : null
  const sonDisjuntos = analisis !== null && analisis.disjuntos

  // 6quater) F22 · ¿Trae el fichero los NOMBRES de sus recintos? Va aquí, y no en
  //   el resumen del final, porque la detección de abajo los necesita: quien
  //   pregunte «¿cuál de estas ocho es la tuya?» tiene que poder poner
  //   `6346726UF8664N` en el renglón, y no «Recinto 3».
  const rotulacion = gradosCualquiera
    ? null
    : elegirCapaDeRotulos(anillos, res.rotulos, opts.capaRotulos)

  if (sonDisjuntos) {
    detecciones.push(
      crearDeteccion(
        TIPO_DETECCION.SEPARADOR_POLIGONO,
        `El fichero trae ${anillos.length} recintos SEPARADOS, no uno con huecos: ninguno está ` +
          `dentro de otro y ninguno se solapa con otro. Un expediente lleva UNA parcela, así que ` +
          `hay que decir cuál de los ${anillos.length} lo es; los demás son fincas distintas y no ` +
          `huecos de ésta. No se construye la parcela mientras no se elija.` +
          (rotulacion === null
            ? ''
            : ` El propio fichero los nombra, en la capa «${rotulacion.capa}»: ` +
              `${rotulacion.nombres.join(', ')}.`),
        SEVERIDAD.AVISO,
        {
          // El detalle de cada recinto, para que quien pregunte «¿cuál es la tuya?»
          // pueda rotularlos sin volver a medir: dos medidas del mismo anillo es como
          // se acaba enseñando un número distinto del que se guarda.
          //
          // ⚠️ Se mide sobre `recintos`, que es lo que el modelo tendría, y NO sobre
          // `anillos`: el paso 5 ya los ha construido con `crearRecinto`, que puede
          // haber retirado un vértice de cierre. Medir el crudo daría una cifra de un
          // anillo que no es el que se va a guardar. Y `area()` —el módulo del
          // anillo— y no `superficie()`, que restaría los que vienen como HUECO:
          // aquí cada recinto se mide POR SÍ MISMO, que es justo lo que se ha
          // demostrado que son.
          recintos: recintos.map((r, i) => ({
            indice: i,
            superficie: area(r.vertices),
            nVertices: r.vertices.length,
            capa: capas[i] ?? '',
            // F22 · El nombre que el fichero le da, si lo trae. `null` cuando no
            // hay rótulos que nombren limpiamente: no se rellena con «Recinto i»
            // aquí, porque inventar un nombre en la capa que produce el dato es
            // como se acaba enseñando un rótulo que el fichero nunca dijo.
            nombre: rotulacion === null ? null : (rotulacion.nombres[i] ?? null),
          })),
          nRecintos: anillos.length,
          saltados: analisis.saltados,
          rotulos: rotulacion === null ? null : { capa: rotulacion.capa },
          bloqueo: BLOQUEOS.VARIOS_RECINTOS_DISJUNTOS,
        },
      ),
    )
  }

  // ⚠️ `SUPERFICIE_NO_POSITIVA` NO se retira ni se relaja: sigue siendo la guarda
  // buena para su caso —anillos que se solapan de verdad, un dato roto—, que es
  // distinto del de arriba. Lo que cambia es que deja de ser quien CONTESTA cuando
  // la causa es otra: decir a la vez «son ocho fincas, elige una» y «revisa qué
  // anillos son de verdad la parcela» son dos frases ciertas que juntas se leen
  // como una contradicción, y este módulo ya pagó esa factura en F11 (guion 13).
  if (!sonDisjuntos && superficieReparto !== null && superficieReparto <= 0) {
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
    // `bloqueos[0]` de F01 siga significando lo mismo que significaba. Y el de
    // F22 detrás de ellos, por lo mismo.
    if (reparto.nCapas > 1) bloqueos.push('ANILLOS_EN_VARIAS_CAPAS')
    // ⚠️ Excluyentes, y en este orden: cuando los anillos son N fincas separadas
    // la superficie negativa es una CONSECUENCIA de haberlas leído como huecos, no
    // un hecho sobre el fichero. Emitir los dos haría que la pantalla dijera a la
    // vez «elige una de las ocho» y «revisa qué anillos son de verdad la parcela».
    if (!sonDisjuntos && superficieReparto !== null && superficieReparto <= 0) {
      bloqueos.push('SUPERFICIE_NO_POSITIVA')
    }
    if (sonDisjuntos) bloqueos.push('VARIOS_RECINTOS_DISJUNTOS')
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
    rotulos: rotulacion,
    huso: huso ? { zona: huso.zona, srs: huso.srs, lon: huso.lon, lat: huso.lat, ambiguo: huso.ambiguo } : null,
    superficie: cotejo,
    bloqueos,
    construida: parcela !== null,
    detecciones: contarDetecciones(detecciones),
  }

  return { parcela, anillos, capas, detecciones, resumen }
}

export default importar

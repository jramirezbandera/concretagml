// parsers/topologia.js — F22 · T1.1. ¿SE SOSTIENE EL REPARTO «uno exterior y el
// resto huecos»? Y si no se sostiene, ¿es porque son N recintos DISJUNTOS?
//
// ── POR QUÉ EXISTE ────────────────────────────────────────────────────────────
//
// `parsers/importar.js` reparte los anillos de un fichero con una sola regla, la
// de su paso 5: **`recintos[0]` es el EXTERIOR y todo lo demás es HUECO**. Esa
// regla es correcta cuando el fichero describe UNA finca con sus patios —el caso
// para el que se escribió, LIST y TXT— y F11 ya midió que se rompe en cuanto un
// DXF trae más de un dibujo. F11 le puso dos guardas: `ANILLOS_EN_VARIAS_CAPAS`,
// cuya salida es elegir capa, y `SUPERFICIE_NO_POSITIVA`, que su propia cabecera
// llama «la prueba, no la causa».
//
// ⛔ **Y la prueba confunde dos cosas que no se parecen en nada.** Un DXF de
// «Consulta Masiva» del Catastro trae la MANZANA ENTERA: medido sobre
// `icuc-pruebas/ConsultaMasiva_ (90).dxf`, su capa «Parcela» son **8 fincas
// distintas y disjuntas** (548,05 · 444,11 · 655,70 · 1.098,85 · 862,78 ·
// 5.165,36 · 645,85 · 541,79 m²), cada una con su referencia catastral rotulada
// dentro. Aplicarles «el primero es el contorno y los demás son huecos» da
// **−8.866,39 m²** —el número cuadra al céntimo— y el usuario recibe «revisa qué
// anillos del fichero son de verdad la parcela», que es acusar al fichero de un
// defecto que no tiene. **La respuesta honrada es «hay ocho, dime cuál es la
// tuya»**, y para poder decirla hay que poder DEMOSTRAR que son ocho.
//
// Eso es lo único que hace este módulo. No decide nada, no emite detecciones y no
// sabe qué es una parcela: mide y contesta. Quien decide es `importar.js`.
//
// ── POR QUÉ AQUÍ, Y NO EN `geo/` NI EN `validation/` ─────────────────────────
//
// Es el TERCER `topologia.js` del proyecto —ya están `diagnostico/topologia.js`
// (F07) y `derivacion/topologia.js` (F17)— y sigue exactamente su patrón: cada
// capa que necesita una booleana se trae Turf en un módulo hoja propio, en vez de
// importarlo de la capa de al lado. Las otras dos casas se descartaron midiendo:
//
//   · `geo/` **no puede**: es aritmética pura y hoja del grafo, y sus dos
//     módulos vecinos —`geo/poligono.js` y `geo/rumbo.js`— tienen un test que
//     exige que no importen NADA. Bajar Turf ahí rompería lo que ese test
//     defiende.
//   · `validation/reglas-topologia.js` **ya sabe** preguntar si un hueco está
//     dentro del exterior… pero su contrato es `Hallazgo[]`, no un booleano, y
//     que `parsers/` (F01) importe de `validation/` (F02) es la dependencia al
//     revés. Se reutiliza lo que SÍ es común y está extraído: `geo/poligono.js`.
//
// ⚠️ **Turf entra en `parsers/` por primera vez, y NO añade dependencia**:
// `@turf/intersect` y `@turf/boolean-contains` ya estaban en el grafo de
// producción antes de F22 —`validation/reglas-topologia.js` los importa, y a él
// se llega desde `app/main.js` e `index.js` por `validation/parcela.js`—, así que
// lo único que este fichero le suma al paquete es su propio código. ⚠️ Y eso es
// lo VERIFICADO: el delta en kB no se ha medido aislado, porque el árbol tenía
// cambios de otra rama de trabajo cuando se escribió esto. Se mide en la fase 5.
// Regla de oro 6 (de Turf, SOLO lo topológico):
// aquí se usan dos booleanas y ni una medida — **la superficie sale de
// `geo/area.js`**, nunca de `@turf/area`, que además NO está instalado y no debe
// instalarse.
//
// ⚠️ Los PARSERS (`dxf.js`, `list.js`, `txt.js`) siguen sin tocar Turf y sin
// importar esto: son texto → coordenadas. Este módulo lo usa el ORQUESTADOR.
//
// ── DOS HECHOS MEDIDOS QUE GOBIERNAN EL CÓDIGO DE ABAJO ──────────────────────
//
// **1 · Dos vecinas que comparten lindero salen DISJUNTAS, y así debe ser.**
// `diagnostico/topologia.js` lo dejó medido con estas palabras: «`intersect` da
// `null` tanto si son disjuntas como si el lindero coincide entero, en parte o en
// una esquina». Es justo el caso de una manzana: las 8 fincas se tocan y ninguna
// invade a ninguna. Medido sobre el fichero real: **28 pares, 0 solapes, solape
// máximo 0,000 m², 21,94 ms**, y `booleanContains` da **0 de 7** anillos dentro
// del primero.
//
// **2 · ⛔ El coste es CUADRÁTICO y el peor caso está en el mismo fichero.** Los
// 28 pares de la capa «Parcela» son baratos; la capa «Construccion» del MISMO
// DXF trae **168 polilíneas**, o sea **14.028 pares**, que a ese ritmo son
// segundos de pantalla congelada. Por eso hay un **prefiltro por caja
// envolvente** (aritmética propia, sin Turf) delante de cada llamada: dos anillos
// cuyas cajas no se tocan no pueden solaparse ni contenerse, y eso se decide con
// cuatro comparaciones. ⚠️ El prefiltro **no** basta por sí solo —en este mismo
// fichero las cajas de los recintos #168 y #169 SÍ se solapan y los recintos no—,
// así que descarta, nunca afirma.

import booleanContains from '@turf/boolean-contains'
import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import intersect from '@turf/intersect'
import { polygon, featureCollection } from '@turf/helpers'
import { coordsPoligono, recintosDeGeometriaTurf } from '../geo/poligono.js'
import { area, superficie } from '../geo/area.js'

/**
 * Suelo ABSOLUTO (m²) por debajo del cual un solape es ruido de coma flotante.
 *
 * No es una tolerancia de dibujo: es el ruido de una booleana sobre coordenadas
 * UTM, cuya magnitud es ~1e6 m. Un milímetro cuadrado queda muy por encima de ese
 * ruido y muy por debajo de nada que alguien dibuje a propósito.
 */
export const TOL_SOLAPE_M2 = 1e-6

/**
 * Y la mitad RELATIVA: un solape también es ruido si no llega a esta fracción del
 * MENOR de los dos anillos.
 *
 * ⛔ **Existe porque medir refutó el número que escribí por inferencia, el mismo
 * día.** Con solo el suelo absoluto, la capa «Construccion» del fichero real
 * —168 huellas de edificio— salía **`disjuntos: false` por DOS solapes de
 * 0,0012 m²**, o sea 12 cm² repartidos entre dos medianeras que comparten muro.
 * Eso no es un dato roto: es cómo se digitaliza la cartografía de verdad. Un
 * criterio de milímetro cuadrado es correcto contra el ruido de la máquina y
 * **falso contra el ruido del mundo**.
 *
 * ⚠️ **Y el error se elige hacia el lado barato, a propósito.** Pasarse de
 * generoso hace que un fichero dudoso se lea como «N recintos» y la aplicación
 * PREGUNTE cuál es la parcela; quedarse corto lo devuelve al callejón sin salida
 * que esta fase existe para quitar. Preguntar de más cuesta un clic; el callejón
 * cuesta el fichero entero. El 1 % es holgado para el ruido de captura (el
 * dossier da <25 cm) y sigue siendo diminuto frente a cualquier solape que
 * signifique algo: dos parcelas de 500 m² que se pisan 20 m² dan un 4 %.
 */
export const FRACCION_SOLAPE = 0.01

/** Nº mínimo de vértices para que Turf acepte el anillo cerrado (≥4 posiciones). */
const MIN_VERTICES = 3

/** ¿Es un par [x, y] de números finitos? */
const esParFinito = (v) =>
  Array.isArray(v) && v.length >= 2 && Number.isFinite(v[0]) && Number.isFinite(v[1])

/**
 * Caja envolvente de un anillo, o `null` si no tiene vértices finitos suficientes.
 * Aritmética propia y sin Turf: es el prefiltro, y un prefiltro que costara lo que
 * la llamada que evita no serviría de nada.
 *
 * @param {Array<[number,number]>} vertices  Vértices YA filtrados a finitos.
 * @returns {{minX:number, minY:number, maxX:number, maxY:number}}
 */
function caja(vertices) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (const [x, y] of vertices) {
    if (x < minX) minX = x
    if (x > maxX) maxX = x
    if (y < minY) minY = y
    if (y > maxY) maxY = y
  }
  return { minX, minY, maxX, maxY }
}

/**
 * ¿Las dos cajas se tocan siquiera? Si NO, los anillos no pueden solaparse ni
 * contenerse y la llamada a Turf se ahorra entera.
 *
 * Se compara con `<`/`>` estrictos: dos cajas que solo comparten el borde
 * (linderos alineados, que en una manzana es lo NORMAL) siguen entrando a la
 * comprobación fina. Ahorrar ahí sería ahorrar en el único sitio donde el
 * prefiltro podría equivocarse.
 */
const cajasSeparadas = (a, b) =>
  a.maxX < b.minX || b.maxX < a.minX || a.maxY < b.minY || b.maxY < a.minY

/**
 * La superficie común de dos polígonos de Turf, en m², por `geo/area.js`.
 *
 * ⚠️ **Nunca `@turf/area`** (regla de oro 5): no está instalado y no debe estarlo.
 * La geometría que devuelve la booleana se traduce a `recintos` del modelo con
 * `geo/poligono.js#recintosDeGeometriaTurf` —que es quien sabe hacerlo y ya lo
 * hace para F07 y F17— y se mide con el shoelace del proyecto.
 *
 * Un resultado que no sea `Polygon`/`MultiPolygon` cuenta como **0**: cuando dos
 * anillos solo comparten lindero, una booleana puede devolver una línea o un
 * punto, y una línea no encierra superficie. No se le pasa a
 * `recintosDeGeometriaTurf`, que lanzaría con razón —es su contrato— por un caso
 * que aquí no es ningún error.
 *
 * @returns {number}  m² ≥ 0.
 */
function superficieComun(polA, polB) {
  const cruce = intersect(featureCollection([polA, polB]))
  if (cruce === null || cruce === undefined) return 0
  const geom = cruce.type === 'Feature' ? cruce.geometry : cruce
  if (!geom || (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon')) return 0
  let total = 0
  for (const recintos of recintosDeGeometriaTurf(geom)) total += Math.abs(superficie(recintos))
  return total
}

/**
 * @typedef {Object} Solape
 * @property {number} a       Índice del primer anillo, en `anillos`.
 * @property {number} b       Índice del segundo, siempre `b > a`.
 * @property {number} area    Superficie común en m², por `geo/area.js`.
 * @property {number} umbral  El umbral que ese par tuvo que superar para contar
 *   como solape REAL. Viaja con el hallazgo porque es la mitad que lo explica:
 *   «0,03 m² comunes» no dice nada sin «sobre un umbral de 0,004».
 */

/**
 * @typedef {Object} Reparto
 * @property {boolean} disjuntos  `true` ⟺ hay ≥ 2 anillos aptos y **ningún** par
 *   se solapa ni se contiene. Es la afirmación «esto son N recintos separados», y
 *   la que autoriza a `importar.js` a preguntar cuál de ellos es la parcela.
 * @property {number[]} dentro    Índices `i > 0` CONTENIDOS en el anillo 0. Son
 *   los únicos que la lectura «el primero es el contorno y los demás son huecos»
 *   describe bien.
 * @property {number[]} fuera     Índices `i > 0` que NO están dentro del 0.
 * @property {Solape[]} solapes   Pares con superficie común por encima de la
 *   tolerancia, con su área. Se devuelven TODOS y no solo un booleano: un solape
 *   de 12 m² y uno de 0,004 m² no significan lo mismo, y quien redacte el mensaje
 *   necesita la cifra (regla de oro 1).
 * @property {number[]} saltados  Índices de anillos con menos de 3 vértices
 *   finitos. No participan en nada: son degenerados y su degeneración la denuncia
 *   `validation/`, no esta función. Se nombran para que nadie confunda «no se
 *   solapan» con «no se han medido».
 * @property {number} pares       Pares que llegaron a la comprobación fina (los
 *   que el prefiltro no descartó). Es la medida del coste, y está aquí para que un
 *   test pueda vigilar que el prefiltro sigue prefiltrando.
 */

/**
 * Mide si el reparto «`anillos[0]` es el contorno y el resto son huecos» se
 * sostiene, y si lo que hay en su lugar son N recintos disjuntos.
 *
 * **No decide, no corrige y no emite detecciones**: contesta con hechos. Tampoco
 * lanza por un dato malo del usuario (regla de oro 1) — un anillo degenerado sale
 * en `saltados` y la función sigue.
 *
 * @param {Array<Array<[number,number]>>} anillos  Anillos ABIERTOS en UTM, tal
 *   cual salen de un parser o de `importar.js` tras el saneo.
 * @param {object} [opts]
 * @param {number} [opts.tolerancia=TOL_SOLAPE_M2]  Suelo ABSOLUTO (m²) del solape.
 *   Ver {@link TOL_SOLAPE_M2}.
 * @param {number} [opts.fraccion=FRACCION_SOLAPE]  Mitad RELATIVA: fracción del
 *   menor de los dos anillos. Ver {@link FRACCION_SOLAPE}, que existe porque el
 *   suelo absoluto solo **no bastaba** contra cartografía real.
 * @returns {Reparto}
 * @throws {TypeError}  Si `anillos` no es un array (error de PROGRAMACIÓN, como
 *   los `throw` de `importar.js`: el dato del usuario nunca llega hasta aquí sin
 *   pasar por un parser).
 */
export function analizarReparto(anillos, opts = {}) {
  if (!Array.isArray(anillos)) {
    throw new TypeError(
      `analizarReparto: se esperaba un array de anillos; recibido ${typeof anillos}.`,
    )
  }
  const tolerancia =
    typeof opts.tolerancia === 'number' && Number.isFinite(opts.tolerancia)
      ? opts.tolerancia
      : TOL_SOLAPE_M2
  const fraccion =
    typeof opts.fraccion === 'number' && Number.isFinite(opts.fraccion)
      ? opts.fraccion
      : FRACCION_SOLAPE

  // ── Preparación: un polígono de Turf y una caja por anillo APTO ────────────
  const saltados = []
  /** @type {Array<{i:number, pol:object, caja:object}>} */
  const aptos = []
  anillos.forEach((anillo, i) => {
    const finitos = Array.isArray(anillo) ? anillo.filter(esParFinito) : []
    if (finitos.length < MIN_VERTICES) {
      saltados.push(i)
      return
    }
    aptos.push({
      i,
      pol: polygon(coordsPoligono({ vertices: finitos })),
      caja: caja(finitos),
      // Por `geo/area.js` (shoelace propio), que es de donde sale toda superficie
      // de este proyecto. Se usa solo para la mitad RELATIVA del umbral de solape.
      area: area(finitos),
    })
  })

  const dentro = []
  const fuera = []
  const solapes = []
  let pares = 0

  // ── ¿Qué anillos están DENTRO del primero? ────────────────────────────────
  // Es la pregunta que define la lectura «contorno + huecos», y se hace aparte
  // del barrido de pares porque su respuesta no es simétrica: importa quién
  // contiene a quién. El anillo 0 puede haberse saltado por degenerado, y
  // entonces no hay contorno del que estar dentro y todos quedan `fuera`.
  const exterior = aptos.find((a) => a.i === 0) ?? null
  for (const cand of aptos) {
    if (cand.i === 0) continue
    const contenido =
      exterior !== null &&
      !cajasSeparadas(exterior.caja, cand.caja) &&
      booleanContains(exterior.pol, cand.pol)
    if (contenido) dentro.push(cand.i)
    else fuera.push(cand.i)
  }

  // ── El barrido de pares: ¿alguno se solapa o contiene a otro? ─────────────
  // Cualquiera de las dos cosas descarta «recintos disjuntos», y por motivos
  // distintos: contención es una figura con su patio, solape es un dato roto.
  // Aquí solo hace falta saber que pasa; QUÉ pasa lo dicen `dentro` y `solapes`.
  let hayContencion = false
  for (let a = 0; a < aptos.length; a++) {
    for (let b = a + 1; b < aptos.length; b++) {
      // El prefiltro DESCARTA, nunca afirma: ver la cabecera, hecho 2.
      if (cajasSeparadas(aptos[a].caja, aptos[b].caja)) continue
      pares++
      if (
        booleanContains(aptos[a].pol, aptos[b].pol) ||
        booleanContains(aptos[b].pol, aptos[a].pol)
      ) {
        hayContencion = true
        continue // contenido ⇒ la superficie común es la del pequeño, y no aporta.
      }
      const comun = superficieComun(aptos[a].pol, aptos[b].pol)
      // El umbral es el MAYOR de los dos criterios: el suelo absoluto protege del
      // ruido de la máquina y la fracción del ruido del mundo. Ver FRACCION_SOLAPE,
      // que existe porque el segundo se midió y el primero no bastaba.
      const umbral = Math.max(tolerancia, fraccion * Math.min(aptos[a].area, aptos[b].area))
      if (comun > umbral) {
        solapes.push({ a: aptos[a].i, b: aptos[b].i, area: comun, umbral })
      }
    }
  }

  return {
    disjuntos: aptos.length >= 2 && !hayContencion && solapes.length === 0,
    dentro,
    fuera,
    solapes,
    saltados,
    pares,
  }
}

// ── F22 · T2.3 · EMPAREJAR RÓTULOS Y RECINTOS ────────────────────────────────
//
// El DXF del Catastro trae la referencia de cada finca escrita DENTRO de ella. La
// pregunta «¿cuál de estos ocho recintos es tu parcela?» se contesta muchísimo
// mejor con `6346726UF8664N` delante que con «Recinto 3», y el dato ya viene en
// el fichero.
//
// ⛔ **Lo que esta función NO hace: adivinar.** `report/literal.js` resolvió un
// problema parecido —qué colindante toca cada lado— y dejó escrito su límite: «si
// dos colindantes se SOLAPAN, el punto cae en las dos y gana **la primera**». Ahí
// es un límite asumido; aquí sería un error caro, porque el resultado es el
// NOMBRE con el que el usuario va a identificar su parcela antes de firmarla. Un
// rótulo que cae en dos recintos, o dos rótulos dentro del mismo, **no nombran
// nada** y se cuentan aparte. Regla de oro 1: nada en silencio.
//
// ⚠️ `booleanPointInPolygon` es Turf TOPOLÓGICO (regla 6) y ya estaba en el grafo
// de producción por `gml/anillos.js` y `report/literal.js`: no añade dependencia.

/**
 * @typedef {Object} Rotulo
 * @property {string} texto
 * @property {number} x
 * @property {number} y
 * @property {string} [capa]
 */

/**
 * @typedef {Object} Rotulacion
 * @property {Array<string|null>} nombres  `nombres[i]` es el texto que nombra a
 *   `anillos[i]`, o `null`. Mismo largo que `anillos`, SIEMPRE.
 * @property {boolean} limpia  `true` ⟺ **cada** recinto tiene exactamente un
 *   nombre y no ha sobrado ni faltado nada. Es la condición que autoriza a usar
 *   estos rótulos para identificar fincas; con `false`, se puede enseñar lo que
 *   haya pero no se puede decir que el fichero las nombre.
 * @property {Array<{texto: string, x: number, y: number}>} huerfanos  Rótulos que
 *   no caen dentro de ningún recinto.
 * @property {Array<{texto: string, indices: number[]}>} compartidos  Rótulos que
 *   caen dentro de VARIOS recintos (recintos anidados): no nombran a ninguno.
 * @property {Array<{indice: number, textos: string[]}>} ambiguos  Recintos con más
 *   de un rótulo dentro: ninguno lo nombra.
 */

/**
 * Empareja rótulos con recintos por punto-en-polígono, sin adivinar.
 *
 * @param {Array<Array<[number,number]>>} anillos  Anillos ABIERTOS en UTM.
 * @param {ReadonlyArray<Rotulo>} rotulos  Los de `parsers/dxf.js#parseDXF`.
 * @returns {Rotulacion}
 * @throws {TypeError}  Si `anillos` no es un array (error de PROGRAMACIÓN).
 */
export function rotularRecintos(anillos, rotulos) {
  if (!Array.isArray(anillos)) {
    throw new TypeError(
      `rotularRecintos: se esperaba un array de anillos; recibido ${typeof anillos}.`,
    )
  }
  const lista = Array.isArray(rotulos) ? rotulos : []
  const nombres = anillos.map(() => null)
  const huerfanos = []
  const compartidos = []
  const ambiguos = []

  // Un polígono por anillo apto, con su caja: el prefiltro vale igual aquí, y con
  // 153 rótulos contra 168 recintos (el peor caso del fichero real) importa.
  const aptos = []
  anillos.forEach((anillo, i) => {
    const finitos = Array.isArray(anillo) ? anillo.filter(esParFinito) : []
    if (finitos.length < MIN_VERTICES) return
    aptos.push({ i, pol: polygon(coordsPoligono({ vertices: finitos })), caja: caja(finitos) })
  })

  /** Textos que han caído dentro de cada recinto. */
  const dentroDe = new Map(aptos.map((a) => [a.i, []]))

  for (const rot of lista) {
    if (!rot || typeof rot.texto !== 'string') continue
    if (!Number.isFinite(rot.x) || !Number.isFinite(rot.y)) continue
    const punto = [rot.x, rot.y]
    const donde = []
    for (const a of aptos) {
      if (
        rot.x < a.caja.minX ||
        rot.x > a.caja.maxX ||
        rot.y < a.caja.minY ||
        rot.y > a.caja.maxY
      ) {
        continue // fuera de la caja ⇒ fuera del recinto, sin llamar a Turf.
      }
      if (booleanPointInPolygon(punto, a.pol)) donde.push(a.i)
    }
    if (donde.length === 0) {
      huerfanos.push({ texto: rot.texto, x: rot.x, y: rot.y })
    } else if (donde.length > 1) {
      compartidos.push({ texto: rot.texto, indices: donde })
    } else {
      dentroDe.get(donde[0]).push(rot.texto)
    }
  }

  for (const [indice, textos] of dentroDe) {
    if (textos.length === 1) nombres[indice] = textos[0]
    else if (textos.length > 1) ambiguos.push({ indice, textos })
  }

  const limpia =
    anillos.length > 0 &&
    nombres.every((n) => n !== null) &&
    huerfanos.length === 0 &&
    compartidos.length === 0 &&
    ambiguos.length === 0

  return { nombres, limpia, huerfanos, compartidos, ambiguos }
}

export default analizarReparto

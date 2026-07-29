// edit/snap.js — F06 · Enganche (snap) al parcelario oficial y a las colindantes.
//
// Es el criterio de aceptación 2 de `spec/feature-06-edicion-parcela.md`: «Snap
// engancha al vértice/lindero más cercano dentro de τ y se desactiva con la tecla
// modificadora». Aquí vive la primera mitad —la geometría— y NADA de la segunda:
// la tecla modificadora es un evento del navegador y se resuelve donde viven los
// eventos, pasando `tolerancia: 0` (ver «snap apagado» más abajo). Este módulo no
// sabe que existe un teclado.
//
// Dos funciones y una separación deliberada entre ellas:
//
//   dianasDe({parcela, colindantes, excluir}) -> {vertices, segmentos}
//   ajustar(punto, dianas, {tolerancia})      -> {punto, enganchado, tipo, distancia, t}
//
// El catálogo se construye UNA vez (en `dragstart`) y se consulta en CADA
// fotograma del arrastre. Si `ajustar` recibiera la parcela en vez del catálogo,
// cada `mousemove` volvería a recorrer el modelo entero, a copiar pares [x,y] y a
// recalcular qué segmentos hay que excluir — sesenta veces por segundo y para
// obtener siempre lo mismo. La frontera está donde está porque es la que separa
// lo que cambia (el cursor) de lo que no (la geometría contra la que se engancha).
//
// ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
// No escribe en el modelo. Devuelve una coordenada corregida y quién la corrigió;
// mover el vértice es de `edit/vertices.js` y del store. Tampoco inserta el
// vértice nuevo cuando el enganche cae en el interior de un lindero: por eso el
// resultado lleva `t` — con 0 < t < 1 el llamante SABE que hay sitio para
// insertar (`geo/segmento.js#proyectarEnSegmento` lo explica con su `enExtremo`),
// y decide él.
//
// ── REGLAS DE ORO QUE GOBIERNAN ESTE FICHERO (SPEC §2) ───────────────────────
//   · Regla 3 — todo en UTM y en METROS. Ni una latitud, ni una longitud, ni un
//     grado. La conversión a píxeles/geográficas es de la capa de vista
//     (`viewer/`), y no llega hasta aquí.
//   · Regla 6 — la proyección punto→segmento es PROPIA (`geo/segmento.js`).
//     `turf.nearestPointOnLine` está PROHIBIDA: es esférica sobre grados y aquí
//     las coordenadas son metros proyectados. Las distancias salen de
//     `geo/metrica.js#distancia` (`Math.hypot`), que es la única definición de
//     distancia del proyecto; aquí no se reescribe ninguna fórmula.
//   · Regla 4 — POJO plano de entrada y de salida, anillos ABIERTOS (el lado de
//     cierre v[n−1] → v[0] NO está materializado y hay que generarlo).
//   · Regla 2 — `geometriaOficial` viene CONGELADA en profundidad y es el término
//     de comparación del diagnóstico: de ella solo se leen COPIAS. Ningún array
//     devuelto por `dianasDe` comparte referencia con el modelo.
//   · Regla 9 — τ por defecto es `config/operativos.json#snapMetros` (0,2 m),
//     leído por `config/operativos.js`. **El 0.2 no se escribe a mano en ninguna
//     línea de este fichero**: si mañana la cifra cambia, cambia en un solo sitio.
//   · Regla 1 — la frontera, y aquí es especialmente fina:
//       · Contrato roto por el PROGRAMADOR (un `punto` que no es un par finito,
//         unas `dianas` sin la forma del catálogo, un `excluir` que apunta a un
//         vértice que no existe) → `throw` nombrando el argumento y lo recibido.
//       · Dato GEOMÉTRICO degenerado (un vértice con NaN en el store, un vértice
//         duplicado que hace un lado de longitud cero, un anillo de un solo
//         punto) → NO lanza: esa diana simplemente no entra en el catálogo. Es
//         dato posible del usuario, y quien lo señala es la validación (F02), no
//         el snap. Que el usuario tenga un vértice repetido no puede impedirle
//         arrastrar el de al lado.

import { OPERATIVOS } from '../config/operativos.js'
import { distancia } from '../geo/metrica.js'
import { proyectarEnSegmento, LONGITUD_NULA_METROS } from '../geo/segmento.js'
import { describir } from './_comun.js'

/**
 * @typedef {import('../validation/_comun.js').RefVertice} RefVertice
 *   `{recinto, indice}`, con `indice` 0-based sobre el anillo ABIERTO. Se ALIASA
 *   el typedef de la validación en vez de re-declararlo (mismo criterio que
 *   `edit/vertices.js`): la tabla de F03, el resaltado de F02 y el snap señalan
 *   vértices con la misma forma, y con una sola definición no pueden divergir.
 */

/**
 * @typedef {{vertices: Array<[number,number]>, tipo: string}} Recinto
 *   Anillo del modelo (`model/parcela.js#crearRecinto`) o del WFS
 *   (`gml/parse.js#RecintoGml`): tienen la MISMA forma, que es lo que permite
 *   meter la parcela propia y las colindantes por el mismo embudo.
 */

/**
 * Catálogo de dianas contra las que se engancha, ya aplanado y desligado del
 * modelo. Ambas listas llevan COPIAS de las coordenadas.
 *
 * @typedef {Object} Dianas
 * @property {Array<[number,number]>} vertices  Puntos de enganche, en UTM (m).
 * @property {Array<[[number,number],[number,number]]>} segmentos  Lados `[A, B]`
 *   en UTM (m), con el lado de CIERRE de cada anillo incluido.
 */

/**
 * Resultado de {@link ajustar}. **Las cinco claves están siempre**, haya enganche
 * o no, y `punto` es SIEMPRE utilizable: nunca se devuelve `null`. Es la misma
 * disciplina que `services/catastro.js#ResultadoCatastro` y por el mismo motivo —
 * un resultado cuya forma depende del éxito obliga a todos sus consumidores a
 * defenderse, y en un `mousemove` uno se olvida.
 *
 * @typedef {Object} Enganche
 * @property {[number,number]} punto  Coordenada corregida si hubo enganche; una
 *   COPIA del punto de entrada si no.
 * @property {boolean} enganchado
 * @property {'VERTICE'|'LINDERO'|null} tipo  Clave de {@link TIPO_ENGANCHE}; `null` si no hubo.
 * @property {number|null} distancia  Metros del punto de entrada a la diana; `null` si no hubo.
 * @property {number|null} t  Parámetro sobre el lado, ∈ [0,1], **solo en
 *   `LINDERO`**; `null` en `VERTICE` y sin enganche. Con `0 < t < 1` el pie cae en
 *   el INTERIOR del lado y hay un vértice que se puede insertar ahí; con `t` 0 o 1
 *   el enganche coincide con un extremo, donde ya hay vértice.
 */

// ── Vocabulario público ──────────────────────────────────────────────────────

/**
 * Qué clase de diana ha capturado el punto. **Códigos estables: la UI decide con
 * ellos sin analizar ningún texto** (mismo trato que `MOTIVO_VERTICE` en
 * `edit/vertices.js` o `MOTIVO_CATASTRO` en `services/catastro.js`) — el
 * indicador visual del snap que pide la spec pinta un cuadrado en el vértice o
 * una cruz sobre el lindero mirando esta clave, no una cadena redactada.
 *
 * @readonly
 */
export const TIPO_ENGANCHE = Object.freeze({ VERTICE: 'VERTICE', LINDERO: 'LINDERO' })

// ── Helpers internos ─────────────────────────────────────────────────────────

const esNumeroFinito = (n) => typeof n === 'number' && Number.isFinite(n)

/** True si `p` es un par UTM `[x, y]` de números finitos. */
const esPar = (p) =>
  Array.isArray(p) && p.length >= 2 && esNumeroFinito(p[0]) && esNumeroFinito(p[1])

/**
 * Vuelca un anillo ABIERTO en el catálogo: sus vértices y sus lados.
 *
 * **El nº de lados no es siempre `n`**, y las tres ramas tienen su razón:
 *   · `n ≥ 3` → `n` lados, porque el ÚLTIMO es el de CIERRE (v[n−1] → v[0]), que
 *     en un anillo abierto no está materializado. Olvidarlo dejaría un lindero
 *     entero sin snap, y precisamente el que nadie mira en la tabla.
 *   · `n === 2` → UN lado. Emitir `v0→v1` y `v1→v0` sería la misma línea dos
 *     veces: dobla el trabajo y fabrica un empate falso. (Es el mismo motivo por
 *     el que `geo/metrica.js#longitudesDeLados` se niega a recorrer un anillo de
 *     2 vértices, allí para no publicar un perímetro del doble de lo real.)
 *   · `n < 2` → ninguno. Un punto no tiene lados.
 *
 * Lo que se descarta EN SILENCIO —y no es un error silencioso, es una diana que
 * no existe—: vértices no finitos (el store admite cualquier POJO y la validación
 * F02 es quien los señala), lados con algún extremo no finito, y lados de
 * longitud nula (vértice duplicado): un punto repetido no es un lindero, y
 * dejarlo dentro haría que un enganche a un VÉRTICE se anunciara como LINDERO.
 *
 * @param {unknown} anillo  `vertices` del recinto; si no es array, no aporta nada.
 * @param {Dianas} salida   Catálogo en construcción (se muta EN SITIO, es local).
 * @param {number} indiceExcluido  Índice del vértice que se está arrastrando en
 *   ESTE anillo, o `-1`. Ver {@link dianasDe} para el porqué de los dos lados.
 */
function acumularAnillo(anillo, salida, indiceExcluido) {
  if (!Array.isArray(anillo)) return
  const n = anillo.length

  for (let i = 0; i < n; i++) {
    if (i === indiceExcluido) continue
    const v = anillo[i]
    if (!esPar(v)) continue
    salida.vertices.push([v[0], v[1]])
  }

  const nLados = n < 2 ? 0 : n === 2 ? 1 : n
  for (let i = 0; i < nLados; i++) {
    const j = (i + 1) % n
    // Los DOS lados que tocan al vértice arrastrado se van con él: el que llega
    // (j === excluido) y el que sale (i === excluido).
    if (i === indiceExcluido || j === indiceExcluido) continue
    const A = anillo[i]
    const B = anillo[j]
    if (!esPar(A) || !esPar(B)) continue
    if (distancia(A, B) <= LONGITUD_NULA_METROS) continue
    salida.segmentos.push([
      [A[0], A[1]],
      [B[0], B[1]],
    ])
  }
}

/**
 * Vuelca una lista de recintos en el catálogo. Un recinto que no sea un objeto
 * con `vertices` array no aporta dianas y NO lanza: es dato del modelo.
 *
 * @param {unknown} recintos
 * @param {Dianas} salida
 * @param {number} recintoExcluido  Índice del recinto donde vive el vértice
 *   arrastrado, o `-1`. La exclusión se aplica SOLO a ese recinto: un hueco no
 *   pierde nada porque se arrastre un vértice del exterior.
 * @param {number} indiceExcluido
 */
function acumularRecintos(recintos, salida, recintoExcluido, indiceExcluido) {
  if (!Array.isArray(recintos)) return
  for (let r = 0; r < recintos.length; r++) {
    const rec = recintos[r]
    if (rec === null || typeof rec !== 'object') continue
    acumularAnillo(rec.vertices, salida, r === recintoExcluido ? indiceExcluido : -1)
  }
}

// ── Catálogo de dianas ───────────────────────────────────────────────────────

/**
 * Construye el catálogo de dianas contra las que engancha {@link ajustar}.
 *
 * **Tres fuentes, y este es su orden** (que además es el de prioridad en los
 * empates, ver {@link ajustar}):
 *
 *   1. **`parcela.geometriaOficial`** — el parcelario oficial del Catastro. Es la
 *      diana principal: el caso de uso entero de F06 es «ajustar unos vértices
 *      sobre la parcela oficial» (spec F06, «Objetivo»).
 *   2. **`colindantes`** — parcelas vecinas tal como las devuelve
 *      `services/catastro.js#parcelaYColindantes` (cada una un
 *      `gml/parse.js#ParcelaGml`, con su array `recintos`). Por defecto VACÍO:
 *      solo se llenan si el usuario pulsa «Traer colindantes», porque traerlas
 *      cuesta una petición al WFS y no se hace a espaldas de nadie.
 *   3. **`parcela.recintos`** — la propia geometría EDITABLE, menos el vértice
 *      que se está moviendo (ver `excluir`).
 *
 * ── `excluir`: EL VÉRTICE **Y SUS DOS LADOS** ────────────────────────────────
 * Esto es lo delicado del módulo y lo primero que rompería un «simplificador»
 * que viera dos casos donde parece haber uno.
 *
 * Sin `excluir`, arrastrar un vértice sería imposible: el propio vértice está en
 * el catálogo a distancia 0 de sí mismo, gana siempre, y el punto queda CLAVADO
 * en su sitio hagas lo que hagas con el ratón. Quitarlo de `vertices` es evidente.
 *
 * Lo que no es evidente es que hay que quitar **los dos lados que lo tocan**
 * (`indice−1 → indice` e `indice → indice+1`, con el módulo del anillo cerrado):
 * esos lados **se mueven con el vértice**, así que engancharse a ellos es
 * engancharse a uno mismo. Si se dejaran, el vértice arrastrado se pegaría a la
 * posición ANTERIOR de sus propios linderos y se movería a saltos, o se quedaría
 * deslizando sobre una línea que ya no existe. Y el caso que más fácil se rompe
 * es `indice === 0`, cuyos dos lados son el de CIERRE (v[n−1] → v[0], el último
 * del array) y el PRIMERO (v[0] → v[1]): quien escriba `indice−1` sin el módulo
 * del anillo se lleva el lado `−1`, que no existe, y deja el de cierre dentro.
 *
 * **`excluir` NO se aplica a `geometriaOficial`.** Y es a propósito: aunque una
 * parcela recién descargada tenga `recintos` y `geometriaOficial` con las MISMAS
 * coordenadas, son dos geometrías distintas —la que se edita y la de referencia—,
 * y el vértice oficial sigue siendo una diana legítima: engancharse a él es,
 * literalmente, «ajustar el vértice sobre la parcela oficial». La consecuencia
 * práctica —que un desplazamiento menor que τ vuelva al sitio— no es un fallo del
 * snap sino lo que el snap significa; para eso está la tecla modificadora.
 *
 * No muta nada y no devuelve nada del modelo: cada `[x,y]` del catálogo es una
 * copia nueva. Con la parcela congelada en profundidad (que es como llega
 * `geometriaOficial`, regla 2) funciona igual.
 *
 * @param {object} [args]
 * @param {object|null} [args.parcela=null]  Parcela del modelo
 *   (`model/parcela.js#crearParcela`). `null`, sin `recintos` o sin
 *   `geometriaOficial` no es un error: aporta menos dianas, o ninguna.
 * @param {Array<{recintos?: Recinto[]}>} [args.colindantes=[]]  Parcelas vecinas.
 * @param {RefVertice|null} [args.excluir=null]  Vértice que se está arrastrando.
 * @returns {Dianas}  Catálogo aplanado; `{vertices: [], segmentos: []}` si no hay
 *   geometría de la que sacar dianas.
 * @throws {TypeError}  Si `parcela` no es un objeto o `null`, si `colindantes` no
 *   es un array, o si `excluir` no tiene la forma `{recinto, indice}` de enteros ≥ 0.
 * @throws {RangeError} Si `excluir` apunta a un recinto o a un índice que no
 *   existe en `parcela.recintos`. No se absorbe: un `excluir` que no señala nada
 *   deja el vértice arrastrado enganchado a sí mismo, que es exactamente el bug
 *   que esta opción existe para evitar — y lo haría en silencio.
 */
export function dianasDe({ parcela = null, colindantes = [], excluir = null } = {}) {
  const FN = 'dianasDe'

  if (parcela !== null && parcela !== undefined) {
    if (typeof parcela !== 'object' || Array.isArray(parcela)) {
      throw new TypeError(
        `${FN}: 'parcela' debe ser una Parcela del modelo o null; recibido ${describir(parcela)}.`,
      )
    }
  }
  if (!Array.isArray(colindantes)) {
    throw new TypeError(
      `${FN}: 'colindantes' debe ser un array de parcelas (las de ` +
        `services/catastro.js#parcelaYColindantes); recibido ${describir(colindantes)}.`,
    )
  }

  let recintoExcluido = -1
  let indiceExcluido = -1
  if (excluir !== null && excluir !== undefined) {
    if (typeof excluir !== 'object' || Array.isArray(excluir)) {
      throw new TypeError(
        `${FN}: 'excluir' debe ser una RefVertice {recinto, indice} o null; recibido ${describir(excluir)}.`,
      )
    }
    const { recinto, indice } = excluir
    if (!Number.isInteger(recinto) || recinto < 0) {
      throw new TypeError(
        `${FN}: 'excluir.recinto' debe ser un entero ≥ 0 (índice en recintos); recibido ${describir(recinto)}.`,
      )
    }
    if (!Number.isInteger(indice) || indice < 0) {
      throw new TypeError(
        `${FN}: 'excluir.indice' debe ser un entero ≥ 0 (índice en el anillo ABIERTO); ` +
          `recibido ${describir(indice)}.`,
      )
    }
    const editables = parcela && Array.isArray(parcela.recintos) ? parcela.recintos : null
    if (editables === null || recinto >= editables.length) {
      throw new RangeError(
        `${FN}: 'excluir' apunta al recinto ${recinto}, que no existe en parcela.recintos ` +
          `(${editables === null ? 'la parcela no tiene recintos' : `válidos 0..${editables.length - 1}`}). ` +
          `Un 'excluir' que no señala nada dejaría el vértice arrastrado enganchado a sí mismo.`,
      )
    }
    const anillo = editables[recinto].vertices
    if (!Array.isArray(anillo) || indice >= anillo.length) {
      throw new RangeError(
        `${FN}: 'excluir' apunta al vértice ${indice} del recinto ${recinto}, que no existe ` +
          `(${Array.isArray(anillo) ? `el anillo ABIERTO tiene ${anillo.length} vértice(s)` : 'el recinto no tiene vertices'}).`,
      )
    }
    recintoExcluido = recinto
    indiceExcluido = indice
  }

  const salida = { vertices: [], segmentos: [] }

  // 1 · Parcelario oficial. Sin exclusión: es OTRA geometría (ver JSDoc).
  if (parcela) acumularRecintos(parcela.geometriaOficial, salida, -1, -1)

  // 2 · Colindantes (ParcelaGml: `recintos` con la misma forma que el modelo).
  for (const vecina of colindantes) {
    if (vecina === null || typeof vecina !== 'object') continue
    acumularRecintos(vecina.recintos, salida, -1, -1)
  }

  // 3 · Geometría editable, menos el vértice arrastrado y sus dos lados.
  if (parcela) acumularRecintos(parcela.recintos, salida, recintoExcluido, indiceExcluido)

  return salida
}

// ── Enganche ─────────────────────────────────────────────────────────────────

/**
 * Engancha `punto` a la diana más cercana dentro de la tolerancia τ.
 *
 * ── LA POLÍTICA, EN TRES REGLAS ──────────────────────────────────────────────
 *
 * **1 · VÉRTICE gana a LINDERO dentro de τ, aunque el lindero esté más cerca.**
 * No es un descuido de la comparación: es lo que fija el dossier §3.6 y tiene
 * sentido operativo. Quien acerca un vértice a otro casi siempre quiere que
 * COINCIDAN exactamente —que compartan coordenada, que no quede una hendidura de
 * 3 cm entre dos parcelas—, no caer sobre el lado a tres centímetros de su
 * extremo. Ordenarlo por distancia pura haría lo segundo casi siempre, porque el
 * pie de la perpendicular sobre un lado que sale del vértice está SIEMPRE más
 * cerca que el vértice mismo. Los dos recorridos son independientes: primero se
 * busca el mejor vértice y, **solo si no hay ninguno dentro de τ**, se buscan
 * linderos.
 *
 * **2 · Dentro de cada clase, gana el más cercano; en un empate, el primero del
 * recorrido.** El orden del recorrido es el del catálogo, que
 * {@link dianasDe} construye siempre igual: oficial → colindantes → editable. Se
 * compara con `<` estricto, de modo que un empate NUNCA reemplaza al ya elegido:
 * la misma entrada da siempre la misma salida, que es lo mínimo exigible a algo
 * que corre en cada fotograma. No se deduplican dianas idénticas (la parcela
 * recién descargada las tiene por duplicado en `recintos` y `geometriaOficial`):
 * hacerlo pediría una tolerancia de igualdad —un segundo umbral que nadie ha
 * pedido y que nadie vería— y no cambiaría el resultado, porque el desempate ya
 * es determinista.
 *
 * **3 · Sin enganche NO se devuelve `null`.** Se devuelve el punto de entrada
 * copiado, con `enganchado: false`. El llamante escribe `resultado.punto` en el
 * modelo sin preguntar, y por eso no hay ninguna rama en el `mousemove` donde
 * olvidarse del caso.
 *
 * ── τ ────────────────────────────────────────────────────────────────────────
 * Por defecto `config/operativos.json#snapMetros` (20 cm), del orden de la
 * precisión de captura del propio Catastro: enganchar por debajo del error del
 * dato de referencia sería fingir una precisión que el parcelario no tiene. Es
 * configurable por el usuario.
 *
 * **τ ≤ 0 ⇒ no engancha nada, y no lanza.** Esa es la forma de apagar el snap
 * —la tecla modificadora de la spec— sin una rama especial ni un booleano
 * paralelo que pueda contradecir a la tolerancia. La comparación es INCLUSIVA
 * (`distancia ≤ τ`): una diana exactamente a τ engancha.
 *
 * Dianas degeneradas (par no finito, lado de longitud nula) se ignoran sin
 * lanzar, igual que en {@link dianasDe}: el catálogo puede venir de cualquier
 * llamante, no solo de allí.
 *
 * @param {[number,number]} punto  Posición actual del cursor/vértice, UTM (m).
 * @param {Dianas} dianas  Catálogo de {@link dianasDe}.
 * @param {{tolerancia?: number}} [opciones]  `tolerancia` (τ) en METROS; por
 *   defecto `OPERATIVOS.snapMetros`.
 * @returns {Enganche}  Nunca `null`; `punto` siempre utilizable.
 * @throws {TypeError} Si `punto` no es un par UTM finito, si `dianas` no tiene la
 *   forma `{vertices: [], segmentos: []}`, o si `tolerancia` no es un número finito.
 */
export function ajustar(punto, dianas, { tolerancia = OPERATIVOS.snapMetros } = {}) {
  const FN = 'ajustar'

  if (!esPar(punto)) {
    throw new TypeError(
      `${FN}: 'punto' debe ser un par UTM [x,y] de números finitos (metros); recibido ${describir(punto)}.`,
    )
  }
  if (
    dianas === null ||
    typeof dianas !== 'object' ||
    !Array.isArray(dianas.vertices) ||
    !Array.isArray(dianas.segmentos)
  ) {
    throw new TypeError(
      `${FN}: 'dianas' debe ser el catálogo de dianasDe ({vertices: [], segmentos: []}); ` +
        `recibido ${describir(dianas)}.`,
    )
  }
  if (!esNumeroFinito(tolerancia)) {
    throw new TypeError(
      `${FN}: 'tolerancia' debe ser un número finito en METROS (τ ≤ 0 apaga el snap); ` +
        `recibido ${describir(tolerancia)}.`,
    )
  }

  /** Sin enganche: el punto de entrada, COPIADO. Nunca se devuelve `null`. */
  const sinEnganche = () => ({
    punto: [punto[0], punto[1]],
    enganchado: false,
    tipo: null,
    distancia: null,
    t: null,
  })

  // Snap apagado (tecla modificadora). Sale antes de recorrer nada: con τ = 0 ni
  // siquiera una diana a distancia exacta 0 engancha, que es lo que «apagado»
  // significa.
  if (tolerancia <= 0) return sinEnganche()

  // `proyectarEnSegmento` exige pares de longitud EXACTA 2. Se normaliza sin
  // copiar en el caso normal (que es el 100% de lo que sale de `dianasDe`).
  const P = punto.length === 2 ? punto : [punto[0], punto[1]]

  // 1 · Vértices. Prioridad absoluta dentro de τ.
  let mejorVertice = null
  let distVertice = Infinity
  for (const v of dianas.vertices) {
    if (!esPar(v)) continue
    const d = distancia(P, v)
    // `<` estricto: en un empate se conserva el PRIMERO del recorrido.
    if (d <= tolerancia && d < distVertice) {
      distVertice = d
      mejorVertice = v
    }
  }
  if (mejorVertice !== null) {
    return {
      punto: [mejorVertice[0], mejorVertice[1]],
      enganchado: true,
      tipo: TIPO_ENGANCHE.VERTICE,
      distancia: distVertice,
      // `t` es el parámetro sobre un LADO: en un vértice no significa nada, y
      // devolver 0 invitaría a leerlo como «el extremo A de algún segmento».
      t: null,
    }
  }

  // 2 · Linderos. Solo si ningún vértice estaba dentro de τ.
  let mejorLindero = null
  let distLindero = Infinity
  for (const s of dianas.segmentos) {
    if (!Array.isArray(s) || s.length < 2) continue
    const a = s[0]
    const b = s[1]
    if (!esPar(a) || !esPar(b)) continue
    const A = a.length === 2 ? a : [a[0], a[1]]
    const B = b.length === 2 ? b : [b[0], b[1]]
    // Lado de longitud nula: un vértice duplicado no es un lindero (dato del
    // usuario, lo señala F02). Se ignora, no se lanza.
    if (distancia(A, B) <= LONGITUD_NULA_METROS) continue
    const proy = proyectarEnSegmento(P, A, B)
    if (proy.distancia <= tolerancia && proy.distancia < distLindero) {
      distLindero = proy.distancia
      mejorLindero = proy
    }
  }
  if (mejorLindero !== null) {
    return {
      punto: [mejorLindero.punto[0], mejorLindero.punto[1]],
      enganchado: true,
      tipo: TIPO_ENGANCHE.LINDERO,
      distancia: distLindero,
      // 0 < t < 1 ⇒ el pie cae en el INTERIOR del lado y el llamante puede
      // insertar ahí un vértice (`edit/vertices.js#insertarVertice`).
      t: mejorLindero.t,
    }
  }

  return sinEnganche()
}

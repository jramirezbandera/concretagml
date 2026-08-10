// derivacion/vecino.js — F23 · tarea 2.2 · EL COLINDANTE RECORTADO: a quién le
// quita terreno la geometría medida, cuánto, y cómo queda su parcela.
//
// Es el módulo que convierte «me salgo 25,49 m²» en «le quito 20,29 m² a
// 29050A01000143 y 5,19 m² a 29050A01000121, y así quedan sus linderos».
//
// Módulo PURO: sin DOM, sin Leaflet, sin red, sin estado y sin reloj. Turf entra
// por `derivacion/topologia.js`, que sigue siendo el único fichero de esta capa
// que lo importa (regla de oro 6).
//
// ── EL MARCO: LA MEDICIÓN ES LA REFERENCIA ──────────────────────────────────
// La decisión de producto que hace existir a este módulo, y conviene que esté
// escrita donde se implementa: **la geometría que levanta el técnico es la buena**.
// El contorno que publica el Catastro no es el árbitro, es una foto anterior y
// posiblemente peor. Así que donde la medición entra en la parcela de un vecino, el
// que se corrige es el VECINO:
//
//     V_i_new = V_i_oficial − P_new
//
// Eso NO es una opinión de este código: es lo que convierte un expediente que la
// Sede devuelve con IVG negativo en uno que puede salir positivo, porque el
// conjunto pasa a cubrir exactamente la unión de lo oficial afectado. La identidad
// está medida sobre el expediente real 29050A01000144 (2026-08-10) y sale con
// residuo **0,000000 m²**, y no por suerte:
//
//     Σ nueva = (P_new + sobrante) + ΣV − exceso
//             = (P_of  + exceso)   + ΣV − exceso  =  P_of + ΣV  =  Σ oficial
//
// ── ⛔ LO QUE ESTE MÓDULO **NO** DECIDE ─────────────────────────────────────
// **No reparte el sobrante.** Que un trozo que la parcela SUELTA pase al vecino o
// se dé de alta como finca nueva es un acto **jurídico, no geométrico**, y se
// pregunta pieza a pieza (decisión del autor, 2026-08-10, confirmada por medición:
// en el expediente real el sobrante linda 18,42 m con `…145` —que no pierde nada— y
// 12,09 m con `…143`; un reparto automático «al que más linde» habría elegido al
// que no participa). Aquí solo se RESTA lo que la medición invade.
//
// ── EL EXCESO QUE NO CAE SOBRE NADIE NO ES UN FALLO ─────────────────────────
// Si un trozo de `P_new − P_of` no solapa ninguna colindante, está sobre un vial,
// sobre dominio público o sobre un hueco del parcelario. **Eso es un caso legítimo
// y se declara, no se bloquea** (decisión del autor, 2026-08-10): un vial puede
// estar mal georreferenciado y necesitar que lo pises para colocar bien tu finca.
// Sale por `sobreNadie` con su superficie, y quien decida qué hacer con él es quien
// firma. Lo que NO puede es confundirse con «no hay exceso».
//
// ── ⚠️ UN VECINO SE PUEDE PARTIR EN DOS, Y ENTONCES SON DOS FINCAS ──────────
// Si la geometría medida atraviesa a un colindante de lado a lado, `V_of − P_new`
// sale en piezas disjuntas. La regla la fijó el autor (2026-08-10) y cae sobre
// terreno YA MEDIDO: **la pieza MAYOR conserva la referencia catastral** y las
// demás se nombran con el sufijo del padre (`…145.1`, `…145.2`), que es exactamente
// el patrón del override O19 — presentado y con IVG positivo (CSV XMWPXCN9J8DB9J89).
// Aquí se ordenan y se marca `seParte`; los identificadores los pone
// `derivacion/identidad.js`, que es quien sabe de `inspireId`.
//
// ⛔ Y el orden por área **no es cosmético**: decide cuál de los trozos se queda la
// referencia catastral real de otro titular. Dos trozos que empatan en área tienen
// que desempatar por algo estable, no por el orden en que Turf los devolvió.

import { OPERATIVOS } from '../config/operativos.js'
import { superficie } from '../geo/area.js'
import { centroide } from '../geo/centroide.js'
import { medirPieza } from '../geo/grosor.js'
import { DECIMALES_COORD } from '../gml/anillos.js'

import {
  SEVERIDAD,
  TIPO_DERIVACION,
  crearDeteccionDerivacion,
  describir,
  exigirOpciones,
  exigirRecintos,
  numero,
  resumirDetecciones,
} from './_comun.js'
import { restar, unir } from './topologia.js'

/**
 * ¿LINDA este trozo con esta parcela, o solo se rozan en un punto?
 *
 * ⭐ **Se pregunta UNIENDO, no midiendo distancias**, y la diferencia está MEDIDA
 * sobre el expediente real 29050A01000144 (2026-08-10). La colindante `…146` está a
 * **0,000000 m** del trozo del sobrante —comparten un vértice— y sin embargo NO
 * linda con él: al unirlos salen DOS piezas. Una heurística de distancia con
 * cualquier épsilon la habría admitido como candidata, y asignarle el trozo habría
 * creado una finca unida por un punto, que no es una finca.
 *
 * La unión no cuesta nada: `@turf/union` ya estaba en el paquete desde
 * `edificio/envolvente.js`, y corre sobre el mismo `polyclip-ts` que `difference`.
 *
 * @param {Recinto[]} trozo
 * @param {Recinto[]} region
 * @returns {boolean}  `false` también si la unión no se pudo calcular: sin poder
 *   afirmarlo, no se ofrece la opción.
 */
function lindaCon(trozo, region) {
  const u = unir(trozo, region)
  if (u.detecciones.some((d) => d.severidad === SEVERIDAD.ERROR)) return false
  return u.piezas.length === 1
}

/** @typedef {import('../geo/poligono.js').RecintoSaltado} RecintoSaltado */
/** @typedef {import('./_comun.js').DeteccionDerivacion} DeteccionDerivacion */
/** @typedef {{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}} Recinto */
/** @typedef {{refcat: string|null, recintos: Recinto[]}} Vecina */

/**
 * Un colindante al que la geometría medida le quita terreno.
 *
 * @typedef {Object} VecinoRecortado
 * @property {string|null} refcat  Su referencia catastral, o `null` si no consta.
 * @property {Recinto[]} recintosOficiales  Su contorno ANTES del recorte, tal cual
 *   lo publica el Catastro. Viaja con el vecino porque es lo que pasa a formar
 *   parte de la DIANA del cierre: `comprobacion/conjunto.js` tiene que restarle los
 *   miembros a todo lo oficial que el expediente toca, no solo a la finca propia.
 *   Sin él, quien arme el expediente tendría que volver a buscarlo en la lista de
 *   colindantes y emparejarlo por referencia, que es un emparejamiento de más
 *   pudiendo no serlo.
 * @property {number} areaOficial  Lo que medía antes, m² (shoelace sobre UTM).
 * @property {number} areaNueva  Lo que mide después del recorte, m².
 * @property {number} pierde  `areaOficial − areaNueva`, m². Siempre > 0: un vecino
 *   que no pierde nada NO sale en la lista.
 * @property {number} grosorPerdido  Grosor de la franja más ancha que se le quita, en
 *   metros (`2·área/perímetro` sobre `V_of − V_new`). **Es la cifra que decide si el
 *   vecino entra**, no `pierde`: ver el filtro. `Infinity` si no se pudo medir, que
 *   por diseño hace que entre.
 * @property {Array<{recintos: Recinto[], area: number, grosor: number,
 *   centroide: [number,number]|null}>} trozos  En qué queda su parcela, ordenados
 *   **de mayor a menor área**. Casi siempre uno.
 * @property {boolean} seParte  `trozos.length > 1`: la medición lo ha cortado en
 *   fincas disjuntas. La mayor conserva la referencia; las otras van con sufijo.
 */

/**
 * Lo que devuelve {@link recortarVecinos}.
 *
 * @typedef {Object} Recorte
 * @property {VecinoRecortado[]} vecinos  Solo los que pierden algo, de mayor a
 *   menor superficie perdida.
 * @property {number} areaCedida  Suma de `vecinos[].pierde`, m².
 * @property {Array<{orden: number, area: number, porVecino:
 *   Array<{refcat: string|null, area: number}>, sobreNadie: number}>} atribucion
 *   Para CADA trozo del exceso, sobre quién cae y cuánto. Un trozo puede caer sobre
 *   dos colindantes a la vez.
 * @property {number} sobreNadie  m² del exceso que no solapan NINGUNA colindante:
 *   vial, dominio público o hueco del parcelario. **No es un fallo.**
 * @property {Array<{refcat: string|null, area: number, grosor: number}>} soloRedondeo
 *   Los colindantes a los que la medición solo roza una franja más fina que el
 *   redondeo del fichero. **No están en `vecinos`** —no se les recorta ni entran en
 *   el expediente— y salen aquí para que el filtro se pueda auditar sin recalcularlo.
 * @property {boolean} consultado  `false` si no se han traído las colindantes.
 *   ⛔ Con `false`, `sobreNadie` NO significa «cae sobre un vial»: significa que no
 *   se ha mirado. Son cosas opuestas y la segunda tranquiliza.
 * @property {RecintoSaltado[]} saltados
 * @property {DeteccionDerivacion[]} detecciones
 * @property {{total: number, porTipo: Object<string,number>,
 *   porSeveridad: Object<string,number>}} resumen
 */

/** El área de una lista de piezas crudas de `restar()`. */
const areaDe = (piezas) => piezas.reduce((s, p) => s + superficie(p), 0)

/**
 * La superficie más pequeña que el FICHERO puede representar, en m².
 *
 * Con las coordenadas en la retícula de `DECIMALES_COORD` decimales, el triángulo
 * no degenerado más pequeño tiene catetos de `10⁻ᴰ` y área `½·10⁻²ᴰ`: con D = 2 son
 * **5·10⁻⁵ m² (0,5 cm²)**. Por debajo de eso no hay superficie que declarar, hay
 * ruido de coma flotante.
 *
 * Se DERIVA del formato, como el `DESPLAZAMIENTO_MAXIMO_COORD_M` de
 * `comprobacion/conjunto.js`, y por la misma razón: un número escrito a mano se
 * queda atrás el día que el Catastro admita tres decimales, y nadie se entera.
 */
const AREA_MINIMA_FICHERO_M2 = 0.5 * 10 ** (-2 * DECIMALES_COORD)

/**
 * La geometría que un colindante PIERDE: su contorno oficial menos lo que le queda
 * tras el recorte.
 *
 * ⭐ Hace falta la GEOMETRÍA y no basta la resta de áreas porque lo que decide si un
 * vecino entra en el expediente es el **grosor** de la franja, no sus metros
 * cuadrados (ver el filtro que la usa). Se calcula encadenando restas —la misma
 * técnica que `comprobacion/conjunto.js` usa para la cobertura— porque `restar` toma
 * UNA región y lo que le queda al vecino puede ser varias.
 *
 * @param {Recinto[]} oficiales  `V_of`.
 * @param {Array<Recinto[]>} restantes  Las piezas de `V_of − P_new`.
 * @param {RecintoSaltado[]} saltados  Acumulador.
 * @returns {Array<Recinto[]>|null}  Las piezas perdidas, o `null` si alguna resta
 *   falló. ⛔ `null` **no es «no pierde nada»**: es «no se sabe», y quien lo lea
 *   tiene que quedarse del lado de incluir al vecino, no del de saltárselo.
 */
function geometriaPerdida(oficiales, restantes, saltados) {
  let perdidas = [oficiales]
  for (const trozo of restantes) {
    const siguientes = []
    for (const region of perdidas) {
      const d = restar(region, trozo)
      saltados.push(...d.saltados)
      if (d.detecciones.some((x) => x.severidad === SEVERIDAD.ERROR)) return null
      siguientes.push(...d.piezas)
    }
    perdidas = siguientes
    if (perdidas.length === 0) break
  }
  return perdidas
}

/**
 * ¿Cuánto de `recintos` cae dentro de `region`?
 *
 * Se mide **restando**, no intersecando: `area(A) − area(A − B)`. Da el mismo
 * número que `@turf/intersect` y evita meter un segundo motor booleano en esta
 * capa — `derivacion/topologia.js` es el único fichero con Turf y así sigue.
 *
 * @returns {{area: number, saltados: RecintoSaltado[], fallo: boolean}}
 */
function cuantoCaeDentro(recintos, region) {
  const r = restar(recintos, region)
  const fallo = r.detecciones.some((d) => d.severidad === SEVERIDAD.ERROR)
  if (fallo) return { area: 0, saltados: r.saltados, fallo: true }
  return { area: superficie(recintos) - areaDe(r.piezas), saltados: r.saltados, fallo: false }
}

/**
 * Recorta a cada colindante por donde la geometría medida se le mete, y dice a
 * quién cae cada trozo del exceso.
 *
 * ```js
 * const recorte = recortarVecinos({
 *   recintos: parcela.recintos,          // P_new — la medición, que es la buena
 *   vecinas,                             // [{refcat, recintos}] o null
 *   fuera: cesion.puerta.piezas,         // los trozos que se salen, ya medidos
 * })
 * ```
 *
 * @param {object} entrada
 * @param {Recinto[]} entrada.recintos  La geometría EDITADA (`P_new`).
 * @param {Vecina[]|null} [entrada.vecinas=null]  Las colindantes.
 *   ⛔ **`null` y `[]` NO significan lo mismo**: `null` es «no se han consultado» y
 *   `[]` es «se han consultado y no hay ninguna» (parcela aislada, rodeada de
 *   viales). Confundirlas haría que un exceso sobre un vecino real se declarara
 *   sobre un vial. Es la misma distinción que sostiene `invasion.consultado` en F07.
 * @param {Array<{orden:number, recintos: Recinto[], area:number}>} [entrada.fuera=[]]
 *   Los trozos de `P_new − P_of`, tal cual salen de `derivacion/cesion.js` en
 *   `puerta.piezas`. Se usan SOLO para la atribución; el recorte se hace contra
 *   `recintos` entera, que es lo correcto: al vecino se le quita lo que la parcela
 *   nueva ocupa, no lo que un trozo concreto ocupa.
 * @param {number} [entrada.umbralGrosorM=OPERATIVOS.grosorInvasionMinimoM]
 * @returns {Recorte}
 * @throws {TypeError}  Contrato del programador.
 * @throws {RangeError} Si `umbralGrosorM` no es un número finito ≥ 0.
 */
export function recortarVecinos(entrada) {
  exigirOpciones(entrada, 'recortarVecinos', 'un objeto {recintos, vecinas, fuera}')

  const {
    recintos,
    vecinas = null,
    fuera = [],
    sobrante = [],
    asignadas = {},
    umbralGrosorM = OPERATIVOS.grosorInvasionMinimoM,
  } = entrada

  exigirRecintos(recintos, 'recortarVecinos')
  if (vecinas !== null && !Array.isArray(vecinas)) {
    throw new TypeError(
      `recortarVecinos: 'vecinas' debe ser un array de {refcat, recintos} o null (= NO se han ` +
        `consultado); recibido ${describir(vecinas)}. Un array VACÍO es otra cosa: significa que ` +
        `se preguntó y la parcela está aislada, y eso sí permite afirmar que el exceso cae sobre ` +
        `un vial.`,
    )
  }
  if (!Array.isArray(fuera)) {
    throw new TypeError(
      `recortarVecinos: 'fuera' debe ser un array de piezas (el 'puerta.piezas' de ` +
        `derivacion/cesion.js); recibido ${describir(fuera)}.`,
    )
  }
  if (!Number.isFinite(umbralGrosorM) || umbralGrosorM < 0) {
    throw new RangeError(
      `recortarVecinos: 'umbralGrosorM' debe ser un número finito ≥ 0 (metros); recibido ` +
        `${describir(umbralGrosorM)}.`,
    )
  }

  /** @type {DeteccionDerivacion[]} */
  const detecciones = []
  /** @type {RecintoSaltado[]} */
  const saltados = []
  /**
   * Los colindantes a los que solo se les quita una franja más fina que el redondeo
   * del fichero: **no entran en el expediente**, pero salen aquí con su superficie y
   * su grosor para que el filtro se pueda auditar (regla de oro 1).
   * @type {Array<{refcat: string|null, area: number, grosor: number}>}
   */
  const soloRedondeo = []

  const cerrar = (extra) => ({
    vecinos: [],
    areaCedida: 0,
    areaRepartida: 0,
    atribucion: [],
    lindes: [],
    sobreNadie: 0,
    soloRedondeo,
    consultado: vecinas !== null,
    saltados,
    detecciones,
    resumen: resumirDetecciones(detecciones),
    ...extra,
  })

  // ── 0 · Sin haber preguntado no se puede afirmar NADA ─────────────────────
  if (vecinas === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.VECINAS_SIN_CONSULTAR,
        'No se han consultado las parcelas colindantes, así que no se puede saber a quién le ' +
          'quita terreno la geometría medida. Eso NO es que no le quite a nadie: es que no se ' +
          'ha mirado. Trae las colindantes del Catastro y vuelve.',
        SEVERIDAD.AVISO,
      ),
    )
    return cerrar({})
  }

  // ── 0b · CON QUIÉN LINDA CADA TROZO DEL SOBRANTE ──────────────────────────
  // Es lo que decide qué opciones se le ofrecen al usuario. Ofrecer «al vecino» de
  // uno con el que el trozo no linda produciría una finca en dos pedazos —o unida
  // por un punto—, así que la lista de candidatos NO es «todas las colindantes»:
  // es la de las que de verdad comparten lindero con ese trozo.
  const lindes = sobrante.map((pieza) => {
    const suyos = pieza && Array.isArray(pieza.recintos) ? pieza.recintos : null
    const refcats =
      suyos === null
        ? []
        : vecinas
            .filter((v) => Array.isArray(v?.recintos) && v.recintos.length > 0)
            .filter((v) => lindaCon(suyos, v.recintos))
            .map((v) => v.refcat ?? null)
    return { orden: pieza.orden, refcats }
  })

  // Lo que el usuario ha decidido, indexado por vecina. `asignadas` es
  // `{orden: refcat}`, y aquí se le da la vuelta.
  const piezaPorOrden = new Map(sobrante.map((p) => [p.orden, p]))
  const lindePorOrden = new Map(lindes.map((l) => [l.orden, l.refcats]))
  /** @type {Map<string, Array<object>>} */
  const asignadasA = new Map()
  for (const [clave, refcat] of Object.entries(asignadas)) {
    const orden = Number(clave)
    const pieza = piezaPorOrden.get(orden)
    if (pieza === undefined || refcat === null || refcat === undefined) continue
    // ⛔ Una asignación a alguien con quien el trozo NO linda se RECHAZA y se dice.
    // No es una preferencia del usuario que haya que respetar: es una finca imposible.
    if (!(lindePorOrden.get(orden) ?? []).includes(refcat)) {
      detecciones.push(
        crearDeteccionDerivacion(
          TIPO_DERIVACION.ASIGNACION_IMPOSIBLE,
          `La pieza nº ${orden} se ha asignado a ${refcat}, pero no lindan: la parcela ` +
            'resultante quedaría en dos pedazos separados, o unida por un solo punto. La pieza ' +
            'se queda como finca nueva.',
          SEVERIDAD.ERROR,
          { orden, refcat },
        ),
      )
      continue
    }
    if (!asignadasA.has(refcat)) asignadasA.set(refcat, [])
    asignadasA.get(refcat).push(pieza)
  }

  // ── 1 · El recorte de cada colindante ─────────────────────────────────────
  /** @type {VecinoRecortado[]} */
  const vecinos = []
  for (const vecina of vecinas) {
    const suyos = vecina === null || vecina === undefined ? null : vecina.recintos
    if (!Array.isArray(suyos) || suyos.length === 0) continue

    const areaOficial = superficie(suyos)
    const r = restar(suyos, recintos)
    saltados.push(...r.saltados)

    if (r.detecciones.some((d) => d.severidad === SEVERIDAD.ERROR)) {
      // ⛔ Un vecino que no se ha podido recortar NO se salta en silencio: si de
      // verdad le tocábamos, el expediente saldría sin él y el IVG lo cazaría. Se
      // dice, y con severidad ERROR, porque es una medición que falta.
      detecciones.push(
        crearDeteccionDerivacion(
          TIPO_DERIVACION.RECORTE_FALLIDO,
          `No se ha podido recortar la parcela ${vecina.refcat ?? '(sin referencia)'}: el motor ` +
            'geométrico ha fallado sobre su contorno. No se sabe si la geometría medida le quita ' +
            'terreno, y suponer que no sería justo la suposición que deja un expediente ' +
            'incompleto.',
          SEVERIDAD.ERROR,
          { refcat: vecina.refcat ?? null },
        ),
      )
      continue
    }

    // ── EL REPARTO: los trozos del sobrante que el usuario le ha dado ────────
    // `V_new = (V_of − P_new) ∪ trozos`. Se unen UNO A UNO sobre el resultado del
    // recorte, no todos de golpe, porque dos trozos asignados al mismo vecino pueden
    // no tocarse entre sí y la unión iría acumulando piezas — que es exactamente lo
    // que hay que detectar, no lo que hay que esconder.
    let recortadas = r.piezas
    const recibidas = asignadasA.get(vecina.refcat ?? null) ?? []
    let areaRecibida = 0
    for (const pieza of recibidas) {
      // Se une contra la pieza del vecino con la que ese trozo linda. Con una sola
      // (el caso normal) es directo; con varias, la que dé UNA pieza al unir.
      const indice = recortadas.findIndex((p) => lindaCon(pieza.recintos, p))
      if (indice === -1) {
        detecciones.push(
          crearDeteccionDerivacion(
            TIPO_DERIVACION.ASIGNACION_IMPOSIBLE,
            `La pieza nº ${pieza.orden} lindaba con ${vecina.refcat ?? '(sin referencia)'} ANTES ` +
              'del recorte, pero ya no linda con lo que le queda: la geometría medida se ha ' +
              'metido justo por su lindero común. Se queda como finca nueva.',
            SEVERIDAD.ERROR,
            { orden: pieza.orden, refcat: vecina.refcat ?? null },
          ),
        )
        continue
      }
      const u = unir(recortadas[indice], pieza.recintos)
      saltados.push(...u.saltados)
      if (u.detecciones.some((d) => d.severidad === SEVERIDAD.ERROR) || u.piezas.length !== 1) {
        detecciones.push(...u.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR))
        continue
      }
      recortadas = recortadas.map((p, k) => (k === indice ? u.piezas[0] : p))
      areaRecibida += pieza.area
    }

    const trozos = recortadas
      .map((pieza) => ({ recintos: pieza, ...medirPieza(pieza), centroide: centroide(pieza) }))
      // De MAYOR a menor: la primera es la que conserva la referencia catastral.
      // El desempate por firma lo pone quien numere; aquí el área basta para el
      // caso real y el empate exacto es geometría de laboratorio.
      .sort((a, b) => b.area - a.area)

    const areaNueva = trozos.reduce((s, t) => s + t.area, 0)
    // ⚠️ `pierde` es la pérdida BRUTA —lo que la medición le quita— y NO el saldo.
    // Se calcula sobre el recorte, antes de sumarle lo que reciba, porque es la
    // cifra que tiene que cuadrar con el exceso: `Σ pierde === exceso` es el
    // invariante que hace cerrar al expediente, y mezclarlo con el reparto lo
    // rompería (el sobrante ya estaba dentro de lo oficial y no viene de fuera).
    const pierde = areaOficial - (areaNueva - areaRecibida)

    // ── ⛔ EL FILTRO ES DE GROSOR, Y ANTES COMPARABA m² CONTRA METROS ─────────
    // Esta línea decía `pierde <= umbralGrosorM`: una SUPERFICIE contra una
    // LONGITUD. La comparación no significaba nada, y su efecto medido el
    // 2026-08-10 sobre `6346726UF8664N` fue que la parcela `6346714UF8664N` entraba
    // en el expediente —recortada, con su titular y todo— porque el enganche de
    // linderos le rozaba **0,018 m² en una franja de 1,5 mm**.
    //
    // ⛔ Eso no es un fallo cosmético: es **modificar la finca de un tercero por el
    // ruido del redondeo** en un fichero que se firma y se presenta. Y el propio
    // proyecto ya sabía que no: el diagnóstico de encaje descarta esos mismos
    // solapes por grosor y lo dice en pantalla («se han descartado 2 solapes de
    // 0,06 m² por caber dentro del redondeo al centímetro»). Había dos respuestas a
    // la misma pregunta dentro del mismo programa; ahora hay una.
    //
    // El grosor sale de la geometría REALMENTE perdida, no de una estimación:
    // `2·área/perímetro` sobre `V_of − V_new` (ver `geo/grosor.js`).
    const perdidas = geometriaPerdida(suyos, r.piezas, saltados)
    const franjas = perdidas === null ? null : perdidas.map((p) => medirPieza(p))
    // `null` = no se ha podido medir ⇒ **no se salta al vecino**. Quedarse del lado
    // de excluirlo dejaría el expediente sin quien pierde terreno, que es el error
    // caro; incluirlo de más lo delata el cierre.
    const grosorPerdido =
      franjas === null ? Infinity : franjas.reduce((m, f) => Math.max(m, f.grosor), 0)

    // ⛔ Pero un vecino que NO pierde nada y SÍ recibe también entra: es el caso
    // medido sobre el expediente real —el sobrante linda 18,42 m con `…145`, que no
    // pierde ni un metro—, y dejarlo fuera emitiría un expediente donde una finca
    // crece sin que su titular aparezca.
    if (grosorPerdido < umbralGrosorM && areaRecibida <= 0) {
      // No se calla: una superficie que desaparece del expediente sin dejar rastro
      // es lo que la regla de oro 1 prohíbe. Se junta y sale en un solo aviso.
      if (pierde > AREA_MINIMA_FICHERO_M2) {
        soloRedondeo.push({
          refcat: vecina.refcat ?? null,
          area: pierde,
          grosor: grosorPerdido,
        })
      }
      continue
    }

    const vecino = {
      refcat: vecina.refcat ?? null,
      recintosOficiales: suyos,
      areaOficial,
      areaNueva,
      pierde,
      // El grosor de la franja que se le quita: la cifra con la que se audita el
      // filtro de arriba sin tener que recalcular nada (regla de oro 1).
      grosorPerdido,
      recibe: areaRecibida,
      trozos,
    }
    vecino.seParte = trozos.length > 1
    vecinos.push(vecino)

    if (vecino.seParte) {
      detecciones.push(
        crearDeteccionDerivacion(
          TIPO_DERIVACION.VECINO_PARTIDO,
          `La geometría medida parte la parcela ${vecino.refcat ?? '(sin referencia)'} en ` +
            `${trozos.length} trozos disjuntos (${trozos.map((t) => `${numero(t.area)} m²`).join(', ')}). ` +
            'El mayor conserva su referencia catastral y los demás se dan de alta con el sufijo ' +
            'del padre. Revísalo: partir la finca de otro titular no es lo mismo que recortarla.',
          SEVERIDAD.AVISO,
          { refcat: vecino.refcat ?? null, nTrozos: trozos.length },
        ),
      )
    }
  }

  vecinos.sort((a, b) => b.pierde - a.pierde)
  const areaCedida = vecinos.reduce((s, v) => s + v.pierde, 0)
  const areaRepartida = vecinos.reduce((s, v) => s + v.recibe, 0)

  // ── Los que se quedan fuera por ser solo redondeo: UN aviso, con las cifras ──
  // Uno por vecino llenaría el panel en cuanto el usuario engancha un lindero
  // largo, que es el caso normal. Con la forma del mensaje que ya usa el
  // diagnóstico de encaje para descartar estos mismos solapes, porque es el mismo
  // hecho contado en otra pantalla.
  if (soloRedondeo.length > 0) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.VECINO_SOLO_REDONDEO,
        `${soloRedondeo.length === 1 ? 'A 1 colindante se le roza' : `A ${soloRedondeo.length} colindantes se les roza`} ` +
          'una franja más fina que el redondeo con el que el Catastro publica sus linderos, así ' +
          `que no se ${soloRedondeo.length === 1 ? 'le recorta' : 'les recorta'} ni ` +
          `${soloRedondeo.length === 1 ? 'entra' : 'entran'} en el expediente: ` +
          soloRedondeo
            .map(
              (v) =>
                `${v.refcat ?? 'parcela sin referencia'} (${numero(v.area, 4)} m², ` +
                `${numero(v.grosor * 1000, 1)} mm de ancho)`,
            )
            .join('; ') +
          '. Modificar la finca de otro titular por el ruido del redondeo es lo que devuelve un ' +
          'expediente con reparos.',
        SEVERIDAD.AVISO,
        { vecinos: soloRedondeo, umbralGrosorM },
      ),
    )
  }

  // ── 2 · A quién cae CADA trozo del exceso ─────────────────────────────────
  const atribucion = []
  let sobreNadie = 0
  for (const pieza of fuera) {
    const suyos = pieza && Array.isArray(pieza.recintos) ? pieza.recintos : null
    if (suyos === null) continue

    const area = Number.isFinite(pieza.area) ? pieza.area : superficie(suyos)
    const porVecino = []
    let atribuida = 0
    for (const vecina of vecinas) {
      const suyas = vecina === null || vecina === undefined ? null : vecina.recintos
      if (!Array.isArray(suyas) || suyas.length === 0) continue
      const { area: comun, saltados: s, fallo } = cuantoCaeDentro(suyos, suyas)
      saltados.push(...s)
      // ⛔ El umbral es de ÁREA porque `comun` es un área: aquí también se comparaba
      // contra `umbralGrosorM`, que son metros. Lo que se filtra es el ruido de coma
      // flotante de dos restas encadenadas, y el suelo de eso lo fija el fichero
      // —nada por debajo de medio centímetro cuadrado se puede ni escribir—, no un
      // criterio de si la franja es finca: eso lo decide el filtro de los vecinos,
      // por grosor, unas líneas más arriba.
      if (fallo || comun <= AREA_MINIMA_FICHERO_M2) continue
      porVecino.push({ refcat: vecina.refcat ?? null, area: comun })
      atribuida += comun
    }
    porVecino.sort((a, b) => b.area - a.area)

    // Lo que queda sin dueño. `Math.max(0, …)` porque dos colindantes que declaran
    // el mismo lindero con dos decimales pueden solaparse unos mm² entre ellas y
    // hacer que la suma pase del área del trozo: eso es ruido de redondeo, no
    // superficie negativa.
    const huerfana = Math.max(0, area - atribuida)
    sobreNadie += huerfana
    atribucion.push({ orden: pieza.orden, area, porVecino, sobreNadie: huerfana })
  }

  // ── 3 · El exceso que no cae sobre nadie: se DECLARA, no se bloquea ───────
  if (sobreNadie > umbralGrosorM) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.FUERA_SOBRE_NADIE,
        `${numero(sobreNadie, 4)} m² de la geometría medida caen fuera de la parcela oficial y ` +
          'NO solapan ninguna colindante: es un vial, dominio público o un hueco del parcelario. ' +
          'No es necesariamente un error —un vial mal georreferenciado se pisa para colocar bien ' +
          'la finca—, pero esa superficie no se le quita a nadie en este expediente, así que el ' +
          'conjunto no cubrirá exactamente lo oficial. Queda declarado.',
        SEVERIDAD.AVISO,
        { area: sobreNadie },
      ),
    )
  }

  return cerrar({
    vecinos,
    areaCedida,
    areaRepartida,
    atribucion,
    lindes,
    sobreNadie,
    soloRedondeo,
  })
}

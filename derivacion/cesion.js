// derivacion/cesion.js — F17 · tarea 2.1 · EL SOBRANTE de una parcela que se
// encoge: qué suelta, cuánto mide cada trozo, y si de verdad se ha encogido.
//
// Es el módulo que INTERPRETA lo que `derivacion/topologia.js` se limita a restar.
// La primitiva devuelve geometría muda; aquí se decide qué significa: qué es una
// astilla, en qué orden van las piezas, y qué pasa cuando la parcela CRECE en vez
// de menguar. Por eso `restar()` no sale del barrel y esto sí.
//
// Módulo PURO: sin DOM, sin Leaflet, sin turf (lo importa `topologia.js`, que es
// su vecino), sin red, sin estado y sin reloj.
//
// ── QUÉ CALCULA ─────────────────────────────────────────────────────────────
//     cesion = P_of − P_new
// con `P_of` la geometría OFICIAL (la que publica el Catastro) y `P_new` la
// EDITADA. Cada componente conexa del resultado es **UNA parcela**, no una parcela
// con varias superficies: `model/parcela.js` LANZA si `recintos[i≥1]` no es un
// hueco, y su mensaje ya dice qué hacer en su lugar («N piezas sueltas = N
// `crearParcela`, cada una con su `idLocal`»). **El invariante del modelo no se
// toca**, y no hace falta ningún algoritmo de componentes conexas:
// `geo/poligono.js#recintosDeGeometriaTurf` ya parte el `MultiPolygon` en piezas
// disjuntas, cada una con su exterior y sus huecos.
//
// ── ⛔ LA PUERTA `P_new ⊆ P_of`, Y POR QUÉ NO ES `booleanContains` ───────────
// Si la parcela CRECE en vez de menguar, la resta sale vacía **mientras hay
// vecinos afectados**: la aplicación emitiría un expediente incompleto con total
// confianza, que es el peor fallo posible de esta fase. Así que se comprueba, y se
// comprueba **restando al revés**: `restar(P_new, P_of)` con el MISMO umbral de
// grosor.
//
// ⛔ **`@turf/boolean-contains` NO vale, y no es una preferencia.** Leído en
// `node_modules/@turf/boolean-contains/dist/cjs/index.cjs:197-205`: para dos
// polígonos comprueba que **cada VÉRTICE** del uno caiga dentro del otro. En una
// parcela CÓNCAVA eso devuelve `true` con un LADO entero por fuera —los vértices
// dentro, el lado cruzando el hueco del contorno—. Y no es hipotético: la parcela
// de referencia de este proyecto es cóncava (medido: 4 vértices reflejos de 11 en
// el GML oficial). Una puerta que se abre justo en la forma que tiene el caso real
// no es una puerta.
//
// La resta, en cambio, mide la SUPERFICIE que se sale, y con el mismo criterio de
// astilla que el resto de la fase: dos linderos que declaran la misma línea con
// 2 decimales dejan agujas de redondeo a un lado y a otro, y una aguja no es
// crecer. Ver `config/operativos.js#grosorInvasionMinimoM`.
//
// ⚠️ **La puerta tiene TRES estados, no dos.** `contenida: true` (cabe),
// `false` (se sale, y aquí está por cuánto) y **`null` (no se ha podido medir)**.
// Ese tercero es la razón de ser de toda esta capa: un `false` afirma que la
// parcela crece, y afirmarlo sin haberlo medido es exactamente la clase de número
// plausible y equivocado que la regla de oro 1 prohíbe.
//
// ── LAS ASTILLAS SE LISTAN, NO SE TIRAN ─────────────────────────────────────
// Aquí el filtro por grosor **no descarta nada**, al contrario que en F07. En el
// diagnóstico una astilla es ruido que ensucia un aviso; aquí es un trozo de finca
// que el usuario va a firmar o no. Cada pieza sale con su área, su grosor y su
// marca `estrecha`, y una detección AVISO con las cifras al lado. Quien decide es
// el colegiado (regla de oro 9); esta función mide y enseña.
//
// ── EL ORDEN ES DETERMINISTA POR CONSTRUCCIÓN, Y HACE FALTA QUE LO SEA ──────
// El número de orden de una pieza acaba siendo su `idLocal` en un fichero que se
// firma. Si dos corridas sobre la MISMA parcela dieran órdenes distintos, el
// `idLocal` bailaría entre sesiones **y el usuario no lo vería nunca**: no hay
// pantalla donde se note. Turf devuelve las piezas de un `MultiPolygon` en el
// orden que le sale del barrido, así que el orden se impone aquí, con una cadena
// de criterios que termina en una firma geométrica:
//
//   1. de NORTE a SUR   (centroide, `y` descendente) — se lee como se lee un mapa;
//   2. de OESTE a ESTE  (centroide, `x` ascendente);
//   3. la MAYOR primero (área descendente);
//   4. la firma canónica de sus vértices.
//
// Los tres primeros son para las personas; **el cuarto es el que hace del orden un
// orden total**. Dos piezas simétricas empatan en centroide y en área —el caso que
// de verdad rompe—, y sin (4) quedarían en el orden en que Turf las devolvió. La
// firma no depende ni del vértice por el que empieza el anillo ni del sentido en
// que se recorre, que es justo lo que Turf no garantiza.
//
// ⛔ **Y esa firma NO SALE de este módulo.** Es tentador exponerla como «clave
// estable de la pieza» para volver a pegarle el nombre que el usuario le puso
// antes de reeditar. Está prohibido y es la decisión 3C de la fase: **el sobrante
// es una FOTO**. Al cambiar la parcela, las piezas ya no son las mismas piezas
// aunque se parezcan, los nombres se pierden **y se dice**. Un nombre pegado a la
// pieza equivocada es una finca mal nombrada en un papel que se firma, y ese error
// no lo detecta nadie aguas abajo.
//
// ── `piezas: []` SIGUE SIN PODER SIGNIFICAR DOS COSAS ────────────────────────
// El contrato que fijó `topologia.js` sube hasta aquí y se refuerza:
// `puedeEntregarse` es `false` en cuanto hay una detección de severidad ERROR, y
// `bloqueos` dice de qué tipo. Comprobar `piezas.length === 0` a secas es leer un
// silencio como un cero, en las cuatro situaciones que lo producen: no hay
// sobrante (bien), no hay geometría oficial, la región no se pudo construir, o el
// motor booleano lanzó.

import { OPERATIVOS } from '../config/operativos.js'
import { superficie } from '../geo/area.js'
import { centroide } from '../geo/centroide.js'
import { medirPieza } from '../geo/grosor.js'

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
import { restar } from './topologia.js'

/** @typedef {import('../geo/poligono.js').RecintoSaltado} RecintoSaltado */
/** @typedef {import('./_comun.js').DeteccionDerivacion} DeteccionDerivacion */
/** @typedef {{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}} Recinto */

/**
 * Una pieza del sobrante, medida y numerada.
 *
 * @typedef {Object} PiezaSobrante
 * @property {number} orden  1…N en el orden determinista de la lista. **Es la
 *   ÚNICA identidad de la pieza**, y vale solo dentro de ESTA derivación (3C).
 * @property {Recinto[]} recintos  La pieza: exterior en `[0]`, huecos detrás,
 *   anillos ABIERTOS en UTM. Cumple el invariante de `model/parcela.js`.
 * @property {number} area  m², shoelace sobre UTM (`geo/area.js`), huecos restados.
 * @property {number} grosor  m, `2·área/perímetro` (`geo/grosor.js`). NO es el
 *   ancho mínimo: ver la cabecera de ese módulo.
 * @property {boolean} estrecha  `grosor < umbralGrosorM`. **No se descarta**: se
 *   marca, se lista y se avisa.
 * @property {[number,number]|null} centroide  Centroide del ÁREA, o `null` si la
 *   pieza es degenerada (`geo/centroide.js`).
 */

/**
 * El resultado de la puerta `P_new ⊆ P_of`.
 *
 * @typedef {Object} PuertaCesion
 * @property {boolean|null} contenida  `true` si la parcela editada cabe dentro de
 *   la oficial a la precisión del umbral; `false` si se sale; **`null` si no se ha
 *   podido medir** (ver la cabecera: son tres estados, no dos).
 * @property {PiezaSobrante[]} piezas  Los trozos que se salen, medidos y ordenados
 *   con el mismo criterio que el sobrante. Vacío si `contenida !== false`.
 * @property {number} area  Suma de las áreas de esos trozos, en m².
 * @property {number} grosorMaximo  El grosor del más ancho: la cifra con la que se
 *   audita el umbral. `0` si no hay ninguno.
 */

/**
 * Lo que devuelve {@link derivarCesion}.
 *
 * @typedef {Object} Cesion
 * @property {PiezaSobrante[]} piezas  El sobrante, en orden determinista.
 * @property {number} areaTotal  Suma de `piezas[].area`, en m².
 * @property {number} nEstrechas  Cuántas piezas caen bajo el umbral.
 * @property {PuertaCesion} puerta
 * @property {boolean} puedeEntregarse  `false` en cuanto hay una detección ERROR.
 *   **Es lo que hay que mirar**, no `piezas.length`.
 * @property {string[]} bloqueos  Tipos de las detecciones ERROR, sin repetir y en
 *   orden de aparición. Vacío si `puedeEntregarse`.
 * @property {number} areaOficial  Superficie de la geometría oficial, m². `NaN` si
 *   no la hay.
 * @property {number} areaEditada  Superficie de la geometría editada, m².
 * @property {number} umbralGrosorM  El umbral que se ha usado, para que quien lea
 *   las cifras pueda auditarlas sin buscarlo.
 * @property {RecintoSaltado[]} saltados  Lo que no se pudo medir, con su sitio y su
 *   motivo.
 * @property {DeteccionDerivacion[]} detecciones
 * @property {{total: number, porTipo: Object<string,number>,
 *   porSeveridad: Object<string,number>}} resumen
 */

/**
 * Firma canónica de una pieza: independiente del vértice por el que empieza cada
 * anillo y del sentido en que se recorre, que es lo que Turf no garantiza.
 *
 * ⚠️ Es PRIVADA a propósito y no se expone en {@link PiezaSobrante}: ver la
 * decisión 3C en la cabecera. Existe para desempatar un orden, no para reidentificar
 * una finca entre dos ediciones.
 *
 * @param {Recinto[]} recintos
 * @returns {string}
 */
function firmaCanonica(recintos) {
  return recintos
    .map((r) =>
      r.vertices
        .map(([x, y]) => `${x},${y}`)
        .sort()
        .join(' '),
    )
    .join('|')
}

/**
 * El orden de la cabecera, como comparador. Total sobre piezas geométricamente
 * distintas: dos piezas que empatan en los cuatro criterios tienen el mismo
 * multiconjunto de vértices, o sea son la misma forma en el mismo sitio, y da
 * igual cuál vaya antes.
 *
 * Las piezas degeneradas (centroide `null`) van al FINAL, no al principio: son las
 * que menos se pueden señalar en el mapa y no deben encabezar una lista que el
 * usuario lee de arriba abajo.
 */
function compararPiezas(a, b) {
  const ca = a.centroide
  const cb = b.centroide
  if (ca === null || cb === null) {
    if (ca !== cb) return ca === null ? 1 : -1
  } else {
    if (ca[1] !== cb[1]) return cb[1] - ca[1] // 1 · de NORTE a SUR
    if (ca[0] !== cb[0]) return ca[0] - cb[0] // 2 · de OESTE a ESTE
  }
  if (a.area !== b.area) return b.area - a.area // 3 · la mayor primero
  // 4 · la firma: lo que convierte la cadena en un orden TOTAL.
  return a.firma < b.firma ? -1 : a.firma > b.firma ? 1 : 0
}

/**
 * Mide, ordena y numera una lista de piezas crudas de `restar()`.
 *
 * @param {Array<Recinto[]>} crudas
 * @param {number} umbralGrosorM
 * @returns {PiezaSobrante[]}
 */
function medirYOrdenar(crudas, umbralGrosorM) {
  return crudas
    .map((pieza) => {
      const { area, grosor } = medirPieza(pieza)
      return {
        recintos: pieza,
        area,
        grosor,
        estrecha: grosor < umbralGrosorM,
        centroide: centroide(pieza),
        firma: firmaCanonica(pieza),
      }
    })
    .sort(compararPiezas)
    .map(({ firma, ...resto }, i) => ({ orden: i + 1, ...resto }))
}

/**
 * Deriva el SOBRANTE de una parcela: los trozos que suelta al haberse encogido su
 * lindero, listos para entregarse como parcelas más del mismo fichero (O18).
 *
 * Acepta una `Parcela` del modelo TAL CUAL —solo lee `recintos` y
 * `geometriaOficial`—, así que `derivarCesion(expediente.parcela)` funciona sin
 * adaptador. No la muta ni comparte referencias con ella: todo lo que sale son
 * recintos nuevos, construidos por `geo/poligono.js` a partir de la salida de Turf.
 *
 * ⛔ **Mirar `piezas.length` no basta.** El campo que dice si esto se puede
 * entregar es `puedeEntregarse`, y `puerta.contenida` puede ser `null`. Ver la
 * cabecera del módulo.
 *
 * @param {object} entrada
 * @param {Recinto[]} entrada.recintos  La geometría EDITADA (`P_new`).
 * @param {Recinto[]|null} [entrada.geometriaOficial=null]  La del Catastro
 *   (`P_of`). `null` es un caso legítimo y frecuente —parcela dibujada, DXF, TXT—
 *   y NO se puede derivar: se dice y se para.
 * @param {number} [entrada.umbralGrosorM=OPERATIVOS.grosorInvasionMinimoM]  Grosor
 *   por debajo del cual una pieza se marca `estrecha` (y por debajo del cual un
 *   desbordamiento no cuenta como crecer). Se HEREDA de F07 —1 mm, que es
 *   `duplicadoMetros`— y el porqué está en `config/operativos.js`.
 * @returns {Cesion}
 * @throws {TypeError}  Si `entrada` no es un objeto de opciones, o si `recintos` /
 *   `geometriaOficial` no son arrays: eso es un contrato roto por el PROGRAMA.
 * @throws {RangeError} Si `umbralGrosorM` no es un número finito ≥ 0.
 */
export function derivarCesion(entrada) {
  exigirOpciones(entrada, 'derivarCesion', 'un objeto {recintos, geometriaOficial, …}')

  const {
    recintos,
    geometriaOficial = null,
    umbralGrosorM = OPERATIVOS.grosorInvasionMinimoM,
  } = entrada

  exigirRecintos(recintos, 'derivarCesion')
  if (geometriaOficial !== null) {
    exigirRecintos(geometriaOficial, 'derivarCesion', 'geometriaOficial')
  }
  if (!Number.isFinite(umbralGrosorM) || umbralGrosorM < 0) {
    throw new RangeError(
      `derivarCesion: 'umbralGrosorM' debe ser un número finito ≥ 0 (metros); recibido ` +
        `${describir(umbralGrosorM)}. El valor del proyecto es ` +
        `OPERATIVOS.grosorInvasionMinimoM (${OPERATIVOS.grosorInvasionMinimoM} m).`,
    )
  }

  /** @type {DeteccionDerivacion[]} */
  const detecciones = []
  /** @type {RecintoSaltado[]} */
  const saltados = []

  const areaEditada = superficie(recintos)

  /** Empaqueta el retorno con las reglas de bloqueo, para no repetirlas en cada salida. */
  const salida = (piezas, puerta, areaOficial) => {
    const bloqueos = [
      ...new Set(detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR).map((d) => d.tipo)),
    ]
    return {
      piezas,
      areaTotal: piezas.reduce((s, p) => s + p.area, 0),
      nEstrechas: piezas.filter((p) => p.estrecha).length,
      puerta,
      puedeEntregarse: bloqueos.length === 0,
      bloqueos,
      areaOficial,
      areaEditada,
      umbralGrosorM,
      saltados,
      detecciones,
      resumen: resumirDetecciones(detecciones),
    }
  }

  const PUERTA_SIN_MEDIR = { contenida: null, piezas: [], area: 0, grosorMaximo: 0 }

  // ── 0 · Sin geometría oficial no hay minuendo, y eso no es «no hay sobrante» ─
  if (geometriaOficial === null) {
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.SIN_GEOMETRIA_OFICIAL,
        'Esta parcela no trae la geometría que publica el Catastro (se dibujó a mano, o ' +
          'llegó por DXF, TXT o un GML ajeno), así que no hay contra qué restar. El sobrante ' +
          'es la diferencia entre lo oficial y lo editado: sin lo oficial no es que no haya ' +
          'sobrante, es que no se puede saber. Carga la parcela por su referencia catastral.',
        SEVERIDAD.ERROR,
      ),
    )
    return salida([], PUERTA_SIN_MEDIR, NaN)
  }

  const areaOficial = superficie(geometriaOficial)

  // ── 1 · El SOBRANTE: lo oficial menos lo editado ──────────────────────────
  // Va primero porque es lo que se ha pedido, y porque si las regiones no se
  // pueden construir sus detecciones lo dicen mejor aquí —con los nombres
  // `recintosA`/`recintosB` referidos a esta resta— que en la puerta.
  const sobrante = restar(geometriaOficial, recintos)
  saltados.push(...sobrante.saltados)
  detecciones.push(...sobrante.detecciones)

  const hayFalloDeResta = sobrante.detecciones.some((d) => d.severidad === SEVERIDAD.ERROR)
  if (hayFalloDeResta) {
    // La puerta se calcula con las MISMAS dos regiones: si una no se ha podido
    // construir, preguntarle a la otra dirección daría el mismo fallo con otro
    // nombre. `contenida` se queda en `null`, que es la verdad.
    return salida([], PUERTA_SIN_MEDIR, areaOficial)
  }

  const piezas = medirYOrdenar(sobrante.piezas, umbralGrosorM)

  for (const p of piezas) {
    if (!p.estrecha) continue
    detecciones.push(
      crearDeteccionDerivacion(
        TIPO_DERIVACION.PIEZA_ESTRECHA,
        // 4 decimales y no 2: una astilla de 0,005 m² con dos decimales se
        // imprimiría como «0 m²», que es exactamente el número plausible y falso
        // que esta aplicación persigue. La cifra sin tocar va en `datos`.
        `La pieza nº ${p.orden} mide ${numero(p.area, 4)} m² y es una franja de ` +
          `${numero(p.grosor * 1000, 1)} mm de ancho, por debajo de los ` +
          `${numero(umbralGrosorM * 1000, 1)} mm a partir de los cuales una franja se ` +
          'considera superficie y no ruido de redondeo del lindero. Se lista igual, con sus ' +
          'cifras: incluirla o no es tuyo.',
        SEVERIDAD.AVISO,
        { orden: p.orden, area: p.area, grosor: p.grosor, umbralGrosorM },
      ),
    )
  }

  // ── 2 · LA PUERTA: ¿de verdad se ha encogido? ─────────────────────────────
  // Restando AL REVÉS. Ver la cabecera: `booleanContains` compara vértices y esta
  // parcela es cóncava.
  const exceso = restar(recintos, geometriaOficial)
  saltados.push(...exceso.saltados)

  const falloDePuerta = exceso.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR)
  if (falloDePuerta.length > 0) {
    // No se puede afirmar ni que crece ni que no. Las detecciones del motor pasan
    // tal cual —dicen qué falló— y el bloqueo lo pone su severidad ERROR.
    detecciones.push(...falloDePuerta)
    return salida(piezas, PUERTA_SIN_MEDIR, areaOficial)
  }

  // Las de la puerta que NO son error se DESCARTAN a propósito: un `SIN_SOBRANTE`
  // en esta dirección significa «la parcela cabe dentro de la oficial», que es el
  // caso bueno, y colarlo en la lista del sobrante diría al usuario que no hay
  // nada que ceder justo cuando sí lo hay.
  const desbordes = medirYOrdenar(exceso.piezas, umbralGrosorM).filter((p) => !p.estrecha)

  if (desbordes.length === 0) {
    return salida(piezas, { contenida: true, piezas: [], area: 0, grosorMaximo: 0 }, areaOficial)
  }

  // Se RENUMERAN tras filtrar las astillas: la lista de desbordes es una lista
  // propia y sus números tienen que ser 1…M seguidos, no los huecos que dejaría
  // haber quitado piezas de en medio.
  const fuera = desbordes.map((p, i) => ({ ...p, orden: i + 1 }))
  const areaFuera = fuera.reduce((s, p) => s + p.area, 0)
  const grosorMaximo = Math.max(...fuera.map((p) => p.grosor))

  detecciones.push(
    crearDeteccionDerivacion(
      TIPO_DERIVACION.CRECE_FUERA,
      `La parcela editada NO cabe dentro de la oficial: se sale por ${fuera.length} ` +
        `${fuera.length === 1 ? 'sitio' : 'sitios'}, ${numero(areaFuera, 4)} m² en total y hasta ` +
        `${numero(grosorMaximo, 3)} m de ancho. Eso no es una cesión: es superficie que hay que quitarle ` +
        'a alguien, y quien la pierde tiene que ir en el expediente o el IVG saldrá negativo. ' +
        'El sobrante que se lista aquí sería un expediente INCOMPLETO.',
      SEVERIDAD.ERROR,
      { nPiezas: fuera.length, area: areaFuera, grosorMaximo, umbralGrosorM },
    ),
  )

  return salida(
    piezas,
    { contenida: false, piezas: fuera, area: areaFuera, grosorMaximo },
    areaOficial,
  )
}

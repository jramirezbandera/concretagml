// comprobacion/conjunto.js — F17 · tarea 2.2 · EL CIERRE DEL CONJUNTO, sobre las
// coordenadas que van a ir ESCRITAS.
//
// Módulo PURO: sin DOM, sin Leaflet, sin red, sin estado y sin reloj. **No importa
// Turf**: compone `derivacion/`, `diagnostico/`, `gml/` y `geo/`, que es lo mismo
// que hace su vecino `comprobacion/gml.js` y la razón por la que esta capa existe.
//
// ── LA PREGUNTA ─────────────────────────────────────────────────────────────
// El cierre de un anillo es una propiedad LOCAL y F02 ya la vigila. Lo que juzga el
// IVG es otra cosa: si las N parcelas del envío **cubren exactamente** el trozo de
// parcelario que dicen cubrir. Un hueco entre dos de ellas es superficie que deja
// de tener dueño, y el expediente vuelve negativo.
//
// ── ⛔ Y SE COMPRUEBA SOBRE LO REDONDEADO, NO SOBRE EL MODELO ────────────────
// El fichero lleva 2 decimales. Verificar el cierre en float64 y romperse al
// redondear es el fallo silencioso de manual: la comprobación diría que sí sobre un
// polígono que no es el que se entrega. Así que **cada miembro pasa por
// `gml/anillos.js#prepararRecintos`** —la MISMA función que usa el serializador—
// antes de medir nada. No se escribe una segunda: si el redondeo, la reorientación
// o el `areaValue` cambiaran algún día, tienen que cambiar en los dos sitios a la
// vez porque son un solo sitio. El precedente exacto está en
// `gml/serialize-cp.js`, que ya verifica el punto de referencia contra lo
// redondeado y no contra el modelo.
//
// ── ⛔ SON **TRES** AFIRMACIONES, Y NO UNA ──────────────────────────────────
// La tentación es quedarse con la suma:
//
//     Σ superficies redondeadas emitidas == superficie redondeada de lo oficial
//
// y es insuficiente, porque **un solape y un hueco se compensan en área**. Dos
// miembros que se pisan 3 m² y dejan 3 m² sin cubrir dan exactamente la misma suma
// que un parcelario perfecto. La suma sola sería un número tranquilizador sobre un
// expediente roto, que es la peor clase de número.
//
//   (a) **SUMA** con tolerancia DECLARADA. `==` es falso y está medido: `SPEC.md`
//       §7.1 publica un residuo de 0,0064 m² sobre el único expediente que la Sede
//       ha aceptado. Ver {@link toleranciaCierre}.
//   (b) **CERO SOLAPE** entre cada par de miembros (`diagnostico/topologia.js#solape`).
//   (c) **COBERTURA**: restarle a lo oficial los miembros, uno detrás de otro
//       (`derivacion/topologia.js#restar`). Lo que quede es superficie sin dueño.
//
// ⚠️ **Y el reparto de trabajo entre las tres no es simétrico**, lo que decide qué
// tan apretado puede ir cada número: la que caza los huecos es **(c)**, que trabaja
// con geometría y llega al milímetro. **(a)** es la comprobación aritmética barata
// —un miembro que falta, uno contado dos veces, una geometría cambiada— y ésos son
// metros cuadrados, no decímetros. Por eso (a) puede permitirse una tolerancia
// RIGUROSA (que nunca da falso positivo) sin perder nada: no es ella la que
// encuentra el hueco.
//
// ── ⛔ LO QUE LA MEDICIÓN REFUTÓ MIENTRAS SE ESCRIBÍA ESTE FICHERO ───────────
// La primera versión de esta cabecera afirmaba que el residuo de un expediente
// DERIVADO sería despreciable, «porque las piezas comparten vértices con la parcela
// editada y un mismo float redondeado a 2 decimales da siempre el mismo resultado,
// así que los bordes siguen coincidiendo». **Es falso, y se midió media hora
// después sobre la geometría del expediente de oro.**
//
// El error del razonamiento: los vértices que la derivación CREA —donde el lindero
// nuevo corta al oficial— no caen sobre la retícula de 2 decimales, y sobre todo
// **caen DENTRO de un lado del contorno oficial, no sobre uno de sus vértices**. Al
// redondearlos se salen de ese lado, y la unión de las piezas redondeadas ya no es
// el contorno redondeado: sobra o falta una cuña.
//
// Medido sobre `7136910UF1473N` (466,21 m², perímetro 87,10 m) con doce recortes
// distintos, de 0,2 m a 12 m:
//
//   · residuo de la suma: hasta **0,1008 m²** — o sea que un umbral fijo de
//     0,01 m² (el que este fichero llegó a llevar escrito) habría dado falso
//     positivo en la mitad de los casos;
//   · grosor de las cuñas de (b) y (c): hasta **0,00249 m**, siempre por debajo del
//     desplazamiento máximo que puede meter el redondeo;
//   · y el caso que de verdad hace F17 —**arrastrar un vértice existente**— da
//     residuo **0,000000 exacto** y cero cuñas, porque no crea ningún vértice
//     nuevo. El caso feo es el del corte, no el del arrastre.
//
// De ahí que los dos números de este módulo dejen de ser constantes elegidas y
// pasen a **derivarse de `gml/anillos.js#DECIMALES_COORD`**.
//
// ⚠️ La cuarta afirmación posible —que ningún miembro se salga del contorno
// oficial— **no se mide aquí, se DEDUCE**, y conviene decirlo con el álgebra
// delante: sin solape, `área(∪ miembros) = Σ áreas`; con (a) eso es `área(oficial)`;
// con (c) `oficial ⊆ ∪`, luego `área(∪ \ oficial) = 0`. La deducción es exacta y las
// mediciones no: vale hasta la tolerancia de (a) y hasta el umbral de astilla de
// (c). Para el camino de esta fase da igual —una pieza de `P_of − P_new` está
// dentro de `P_of` por construcción—, pero el día que esta función coma un fichero
// ajeno (la entrada por fichero del comprobador, diferida) habrá que medirlo.
//
// ── EL UMBRAL DE ASTILLA, Y POR QUÉ **NO** ES EL DE F07 ─────────────────────
// Tanto (b) como (c) filtran por GROSOR, igual que F07, y con un número **siete
// veces mayor**. No es un aflojamiento: es que el fenómeno es otro.
//
//   · F07 mide el solape de dos parcelas VECINAS que declaran, cada una por su
//     lado, la misma línea de lindero. Las dos vienen ya en la retícula de 2
//     decimales, así que la discrepancia entre ellas es de décimas de milímetro
//     (0,071 mm medido sobre el fixture real). Con 1 mm sobra.
//   · Aquí una de las dos fronteras es un punto **creado sobre un lado** y luego
//     redondeado: se sale de ese lado hasta `½·10⁻² ·√2 = 7,07 mm`. Un milímetro
//     dejaría pasar por «hueco real» una cuña que sólo existe porque el fichero
//     lleva centímetros.
//
// Por eso {@link GROSOR_REDONDEO_M} no se lee de `config/operativos.js` **y es
// deliberado**: el plan de F17 preveía abrir allí una clave propia si el 1 mm no se
// sostenía. No se sostiene, y la clave sigue sin abrirse porque esto **no es una
// decisión operativa que alguien pueda querer ajustar**: es una consecuencia
// aritmética del número de decimales del fichero. Ponerlo entre los números que sí
// se ajustan diría que es una preferencia.
//
// Lo descartado **no se pierde**: sale con su área y su grosor para que quien
// desconfíe del umbral lo audite (regla de oro 1).
//
// ── LA DEPENDENCIA DE `diagnostico/`, DECLARADA ─────────────────────────────
// `comprobacion/_comun.js` se negó en F08 a importar `describir` de
// `diagnostico/_comun.js` para no crear la arista `comprobacion/ → diagnostico/`.
// Aquí se crea, y la diferencia no es de grado: **`describir` es redacción y
// `solape` es la medición**. Duplicar quince líneas de texto es cosmético; duplicar
// el cálculo de una intersección topológica es tener dos respuestas posibles a «¿se
// pisan estas dos parcelas?» dentro de un programa que emite parcelario. Y la
// dirección ya existía de hecho: `comprobacion/gml.js` importa `validation/parcela.js`,
// que es otra capa hermana, por esta misma razón.

import { restar } from '../derivacion/topologia.js'
import { solape } from '../diagnostico/topologia.js'
import { medirPieza } from '../geo/grosor.js'
import { perimetro } from '../geo/metrica.js'
import { coordsRegion } from '../geo/poligono.js'
import { DECIMALES_COORD, prepararRecintos } from '../gml/anillos.js'

import {
  SEVERIDAD,
  TIPO_COMPROBACION,
  crearDeteccionComprobacion,
  describir,
  exigirOpciones,
  numero,
} from './_comun.js'

/** @typedef {import('../geo/poligono.js').RecintoSaltado} RecintoSaltado */
/** @typedef {import('./_comun.js').DeteccionComprobacion} DeteccionComprobacion */
/** @typedef {{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}} Recinto */

/**
 * Cuánto puede alejarse de su sitio un vértice al escribirlo en el fichero, en
 * metros: media unidad del último decimal en cada eje, o sea la diagonal
 * `½·10⁻ᴰ·√2`. Con `DECIMALES_COORD = 2` son **7,07 mm**.
 *
 * Se DERIVA y no se escribe: si el Catastro admitiera otro día tres decimales, los
 * dos números de este módulo bajarían solos. Una constante a mano se habría quedado
 * atrás sin que nada lo dijera.
 */
export const DESPLAZAMIENTO_MAXIMO_COORD_M = 0.5 * 10 ** -DECIMALES_COORD * Math.SQRT2

/**
 * Grosor por debajo del cual una cuña entre dos miembros —o entre los miembros y el
 * contorno oficial— **no es superficie, es el redondeo del fichero**. Es el
 * desplazamiento máximo de un vértice, y la cabecera explica por qué no es el
 * milímetro de F07.
 *
 * MEDIDO sobre `7136910UF1473N` con doce recortes distintos: la cuña más gruesa que
 * produjo el redondeo fue de **2,49 mm**, así que este umbral la filtra con un
 * factor de 2,8 de margen y sin haberlo ajustado a los datos — sale de la aritmética
 * del formato, y los datos sólo confirman que la aritmética iba por buen camino.
 */
export const GROSOR_REDONDEO_M = DESPLAZAMIENTO_MAXIMO_COORD_M

/**
 * Tolerancia del residuo de la afirmación (a), en m², para un perímetro total dado.
 *
 * ⭐ **Es una COTA, no un ajuste.** Mover un vértice `ε` cambia el área del anillo
 * en `½·ε × (v⁺ − v⁻)` (derivada del shoelace), luego para todo el anillo
 * `|ΔA| ≤ ½·δ·Σ(|e| + |e'|) = δ·P`. Sumando los miembros y el contorno oficial:
 *
 *     |residuo| ≤ δ · (P_oficial + Σ P_miembro)
 *
 * con `δ` = {@link DESPLAZAMIENTO_MAXIMO_COORD_M}. **Nunca da falso positivo**, que
 * es lo que se le pide: (a) no es la afirmación que caza huecos —esa es (c), que
 * llega al milímetro— sino la que caza que falte un miembro entero o que sobre uno
 * contado dos veces, y eso son metros cuadrados.
 *
 * Sobre el expediente de oro (perímetros ≈ 187 m entre las tres geometrías) da
 * ≈ **1,3 m²**, frente a un residuo medido máximo de **0,1008 m²**: trece veces de
 * margen. ⛔ Y un umbral FIJO de 0,01 m² —el que este módulo llevó escrito media
 * hora— habría dado falso positivo en la mitad de los doce recortes medidos.
 *
 * @param {number} perimetroTotalM  Suma de los perímetros de lo oficial y de todos
 *   los miembros, en metros.
 * @returns {number}  Tolerancia en m².
 */
export function toleranciaCierre(perimetroTotalM) {
  return DESPLAZAMIENTO_MAXIMO_COORD_M * perimetroTotalM
}

/**
 * Un miembro del envío, tal como entra en esta comprobación.
 *
 * @typedef {Object} MiembroConjunto
 * @property {Recinto[]} recintos  Anillos ABIERTOS en UTM, en float64 completo:
 *   el redondeo lo hace esta función, igual que lo hace el serializador.
 * @property {string} [etiqueta]  Cómo se llama en los mensajes. Por defecto
 *   `«miembro N»`. Si el llamante tiene la referencia catastral o el `idLocal`,
 *   pasarlos aquí es lo que convierte «dos miembros se pisan» en una frase que
 *   dice QUÉ dos.
 */

/**
 * Una pieza sobrante o solapada, medida.
 *
 * @typedef {Object} PiezaMedida
 * @property {Recinto[]} recintos
 * @property {number} area    m²
 * @property {number} grosor  m (`2·área/perímetro`; ver `geo/grosor.js`)
 */

/**
 * @typedef {Object} ComprobacionConjunto
 * @property {boolean|null} cierra  `true` si las TRES afirmaciones se cumplen;
 *   `false` si alguna falla; **`null` si alguna no se ha podido medir**. Los tres
 *   estados son distintos y el tercero no es «no cierra»: es «no lo sabemos».
 * @property {{areaOficial: number, areaMiembros: number, residuo: number,
 *   toleranciaM2: number, perimetroTotal: number, cumple: boolean|null}} suma  (a).
 *   `residuo` es `areaMiembros − areaOficial`, con signo: positivo es que sobra
 *   superficie. `toleranciaM2` es la que se ha USADO —la cota derivada, o la que
 *   pasara el llamante—, nunca un número escondido, y `perimetroTotal` es de dónde
 *   sale.
 * @property {{pares: Array<{a: string, b: string, area: number, grosor: number,
 *   piezas: PiezaMedida[]}>, descartados: Array<{a: string, b: string, area: number,
 *   grosor: number, nPiezas: number}>, cumple: boolean|null}} solapes  (b).
 * @property {{huecos: PiezaMedida[], area: number, descartados: PiezaMedida[],
 *   cumple: boolean|null}} cobertura  (c). `cumple` es `null` si la resta encadenada
 *   no se pudo completar.
 * @property {Array<{etiqueta: string, areaValue: number, superficieRedondeada: number,
 *   superficieModelo: number, nVertices: number}>} miembros  Lo que cada miembro
 *   aporta, ya redondeado. `areaValue` es EXACTAMENTE el entero que iría al
 *   `cp:areaValue` de ese miembro.
 * @property {number} umbralGrosorM
 * @property {RecintoSaltado[]} saltados
 * @property {DeteccionComprobacion[]} detecciones
 */

/** Etiqueta por defecto de un miembro, para que ningún mensaje diga «undefined». */
const etiquetaPorDefecto = (i) => `miembro ${i + 1}`

/** Mide una lista de piezas crudas y la parte en las que cuentan y las astillas. */
function partirPorGrosor(piezas, umbralGrosorM) {
  const cuentan = []
  const astillas = []
  for (const pieza of piezas) {
    const { area, grosor } = medirPieza(pieza)
    ;(grosor < umbralGrosorM ? astillas : cuentan).push({ recintos: pieza, area, grosor })
  }
  return { cuentan, astillas }
}

/**
 * Comprueba que N parcelas CIERREN sobre el contorno oficial, con las tres
 * afirmaciones de la cabecera y sobre las coordenadas ya redondeadas a 2 decimales.
 *
 * ⛔ **No califica nada** (regla de oro 9): devuelve el residuo con su superficie,
 * los solapes con la suya y los huecos con la suya. Que un residuo de 3 cm² sea
 * aceptable o no es del colegiado que firma.
 *
 * @param {object} entrada
 * @param {Recinto[]} entrada.geometriaOficial  El contorno que el conjunto tiene
 *   que cubrir: la geometría que publica el Catastro para la finca de partida.
 * @param {MiembroConjunto[]} entrada.miembros  Las parcelas del envío, **todas**,
 *   incluida la propia. Con una sola también vale: un expediente de una parcela es
 *   una Subsanación, y comprobar que cubre lo oficial es exactamente lo mismo.
 * @param {number|null} [entrada.toleranciaM2=null]  `null` = la cota derivada de
 *   {@link toleranciaCierre} sobre los perímetros reales, que es lo correcto casi
 *   siempre. Se admite un número para poder APRETARLA en un test o en un guion; el
 *   valor que se ha usado sale en `suma.toleranciaM2`, así que nunca es un número
 *   escondido.
 * @param {number} [entrada.umbralGrosorM=GROSOR_REDONDEO_M]
 * @returns {ComprobacionConjunto}
 * @throws {TypeError}  Si `entrada` no es un objeto de opciones, si
 *   `geometriaOficial` o `miembros` no son arrays, si `miembros` viene VACÍO (un
 *   conjunto sin miembros no cierra ni deja de cerrar: es una llamada sin sentido),
 *   o si algún miembro no trae `recintos`.
 * @throws {RangeError} Si `toleranciaM2` o `umbralGrosorM` no son números finitos ≥ 0.
 */
export function comprobarConjunto(entrada) {
  exigirOpciones(entrada, 'comprobarConjunto', 'un objeto {geometriaOficial, miembros, …}')

  const {
    geometriaOficial,
    miembros,
    toleranciaM2 = null,
    umbralGrosorM = GROSOR_REDONDEO_M,
  } = entrada

  if (!Array.isArray(geometriaOficial)) {
    throw new TypeError(
      `comprobarConjunto: 'geometriaOficial' debe ser un array de recintos; recibido ` +
        `${describir(geometriaOficial)}. Es el contorno contra el que se comprueba el cierre: ` +
        'sin él no hay nada que cerrar.',
    )
  }
  if (!Array.isArray(miembros) || miembros.length === 0) {
    throw new TypeError(
      `comprobarConjunto: 'miembros' debe ser un array NO vacío de {recintos, etiqueta?}; ` +
        `recibido ${describir(miembros)}. Un conjunto sin miembros no cierra ni deja de ` +
        'cerrar, así que devolver un veredicto sería inventárselo.',
    )
  }
  miembros.forEach((m, i) => {
    if (m === null || typeof m !== 'object' || !Array.isArray(m.recintos)) {
      throw new TypeError(
        `comprobarConjunto: 'miembros[${i}]' debe ser {recintos, etiqueta?} con 'recintos' ` +
          `array; recibido ${describir(m)}.`,
      )
    }
  })
  for (const [nombre, valor] of [
    ['toleranciaM2', toleranciaM2],
    ['umbralGrosorM', umbralGrosorM],
  ]) {
    if (valor === null && nombre === 'toleranciaM2') continue
    if (!Number.isFinite(valor) || valor < 0) {
      throw new RangeError(
        `comprobarConjunto: '${nombre}' debe ser un número finito ≥ 0; recibido ${describir(valor)}.`,
      )
    }
  }

  /** @type {DeteccionComprobacion[]} */
  const detecciones = []
  /** @type {RecintoSaltado[]} */
  const saltados = []

  // ── 0 · TODO se lleva a las coordenadas del FICHERO, antes de medir nada ───
  // Incluida la oficial: comparar lo redondeado contra un contorno sin redondear
  // metería en el residuo la diferencia del propio redondeo, que no es un hueco.
  const oficial = prepararRecintos(geometriaOficial)
  const preparados = miembros.map((m, i) => ({
    etiqueta: typeof m.etiqueta === 'string' && m.etiqueta.trim() !== '' ? m.etiqueta : etiquetaPorDefecto(i),
    ...prepararRecintos(m.recintos),
  }))

  // Concordancia: con un solo miembro «Las 1 parcelas» delata que nadie leyó el
  // mensaje. Un renglón que suena a máquina se lee como un renglón de máquina.
  const cuantas =
    preparados.length === 1
      ? 'La única parcela del envío suma'
      : `Las ${preparados.length} parcelas del envío suman`

  const areaOficial = oficial.superficieRedondeada
  const areaMiembros = preparados.reduce((s, p) => s + p.superficieRedondeada, 0)

  // ── 0b · ⛔ ¿HAY GEOMETRÍA QUE MEDIR, EN TODAS? ────────────────────────────
  // Un miembro que no forma región —lista vacía, o un exterior de menos de tres
  // vértices— no se puede intersecar ni descontar, y su superficie sale 0. Sin
  // esta puerta las tres afirmaciones darían VERDE sobre él: el 0 no rompe la
  // suma, no se pisa con nadie, y no tapa nada del contorno, así que si otro
  // miembro ya cubría el oficial la cobertura también saldría bien. Verde por
  // ausencia de datos, que es el fallo silencioso que esta capa persigue.
  const inaptos = []
  for (const g of [{ etiqueta: 'la geometría oficial', recintos: oficial.recintos }, ...preparados]) {
    const { anillos, saltados: propios } = coordsRegion(g.recintos, g.etiqueta)
    if (anillos === null) {
      inaptos.push(g.etiqueta)
      saltados.push(...propios)
    }
  }
  if (inaptos.length > 0) {
    detecciones.push(
      crearDeteccionComprobacion(
        TIPO_COMPROBACION.CONJUNTO_NO_COTEJABLE,
        `No se puede comprobar el cierre: ${inaptos.length === 1 ? 'la geometría de' : 'las geometrías de'} ` +
          inaptos.map((e) => `«${e}»`).join(', ') +
          ' no forma' +
          (inaptos.length === 1 ? '' : 'n') +
          ' un recinto medible (hacen falta al menos tres vértices en el contorno). Esto NO ' +
          'significa que el conjunto cierre ni que no cierre: significa que no se sabe.',
        SEVERIDAD.ERROR,
        { inaptos, saltados },
      ),
    )
    return {
      cierra: null,
      suma: {
        areaOficial,
        areaMiembros,
        residuo: areaMiembros - areaOficial,
        toleranciaM2: NaN,
        perimetroTotal: NaN,
        cumple: null,
      },
      solapes: { pares: [], descartados: [], cumple: null },
      cobertura: { huecos: [], area: NaN, descartados: [], cumple: null },
      miembros: preparados.map((p) => ({
        etiqueta: p.etiqueta,
        areaValue: p.areaValue,
        superficieRedondeada: p.superficieRedondeada,
        superficieModelo: p.superficieModelo,
        nVertices: p.nVertices,
      })),
      umbralGrosorM,
      saltados,
      detecciones,
    }
  }

  // ── (a) LA SUMA ───────────────────────────────────────────────────────────
  // La tolerancia se calcula sobre los perímetros de LO REDONDEADO, que es la
  // geometría cuyo área se está comparando. Ver `toleranciaCierre`: es una cota,
  // no un ajuste, y por eso no puede dar falso positivo.
  const perimetroTotal =
    perimetro(oficial.recintos).total +
    preparados.reduce((s, p) => s + perimetro(p.recintos).total, 0)
  const tolerancia = toleranciaM2 === null ? toleranciaCierre(perimetroTotal) : toleranciaM2
  const residuo = areaMiembros - areaOficial
  const sumaCumple = Math.abs(residuo) <= tolerancia
  detecciones.push(
    sumaCumple
      ? crearDeteccionComprobacion(
          TIPO_COMPROBACION.SUMA_COTEJADA,
          `${cuantas} ${numero(areaMiembros)} m² sobre ` +
            `los ${numero(areaOficial)} m² del contorno oficial: ` +
            `${numero(Math.abs(residuo), 4)} m² de diferencia, dentro de los ` +
            `${numero(tolerancia, 4)} m² que se admiten por el redondeo a 2 decimales.`,
          SEVERIDAD.INFO,
          { areaOficial, areaMiembros, residuo, toleranciaM2: tolerancia, perimetroTotal },
        )
      : crearDeteccionComprobacion(
          TIPO_COMPROBACION.SUMA_DISCREPANTE,
          `${cuantas} ${numero(areaMiembros)} m² y el ` +
            `contorno oficial mide ${numero(areaOficial)} m²: ` +
            `${residuo > 0 ? 'sobran' : 'faltan'} ${numero(Math.abs(residuo), 4)} m², muy por ` +
            `encima de los ${numero(tolerancia, 4)} m² del redondeo. Con esta diferencia el ` +
            'conjunto no cubre lo que dice cubrir.',
          SEVERIDAD.ERROR,
          { areaOficial, areaMiembros, residuo, toleranciaM2: tolerancia, perimetroTotal },
        ),
  )

  // ── (b) CERO SOLAPE, PAR A PAR ────────────────────────────────────────────
  // Sobre `preparados[i].recintos`, que son los anillos REDONDEADOS: dos parcelas
  // pueden no pisarse en float64 y pisarse al pasar a centímetros.
  const paresSolapados = []
  const paresDescartados = []
  for (let i = 0; i < preparados.length; i++) {
    for (let j = i + 1; j < preparados.length; j++) {
      const a = preparados[i]
      const b = preparados[j]
      const s = solape(a.recintos, b.recintos)
      saltados.push(...s.saltados.map((x) => ({ ...x, donde: `solape(${a.etiqueta}, ${b.etiqueta})` })))
      if (s.nPiezas === 0) continue

      const { cuentan, astillas } = partirPorGrosor(s.piezas, umbralGrosorM)
      if (astillas.length > 0) {
        paresDescartados.push({
          a: a.etiqueta,
          b: b.etiqueta,
          area: astillas.reduce((t, p) => t + p.area, 0),
          grosor: Math.max(...astillas.map((p) => p.grosor)),
          nPiezas: astillas.length,
        })
      }
      if (cuentan.length > 0) {
        paresSolapados.push({
          a: a.etiqueta,
          b: b.etiqueta,
          area: cuentan.reduce((t, p) => t + p.area, 0),
          grosor: Math.max(...cuentan.map((p) => p.grosor)),
          piezas: cuentan,
        })
      }
    }
  }

  const solapeCumple = paresSolapados.length === 0
  detecciones.push(
    solapeCumple
      ? crearDeteccionComprobacion(
          TIPO_COMPROBACION.SIN_SOLAPE,
          preparados.length === 1
            ? 'Solo hay una parcela en el envío, así que no hay ningún par que pueda pisarse.'
            : `Ninguna de las ${preparados.length} parcelas del envío comparte superficie con ` +
              'otra: cada metro cuadrado tiene un solo dueño.',
          SEVERIDAD.INFO,
          { nPares: (preparados.length * (preparados.length - 1)) / 2, descartados: paresDescartados },
        )
      : crearDeteccionComprobacion(
          TIPO_COMPROBACION.MIEMBROS_SOLAPADOS,
          `${paresSolapados.length === 1 ? 'Hay un par de parcelas que se pisan' : `Hay ${paresSolapados.length} pares de parcelas que se pisan`}: ` +
            paresSolapados
              // 4 decimales: un solape justo por encima del umbral de astilla mide
              // centímetros cuadrados, y con dos decimales se leería «0 m²».
              .map((p) => `«${p.a}» y «${p.b}» comparten ${numero(p.area, 4)} m²`)
              .join('; ') +
            '. Esa superficie tendría dos dueños en el mismo envío.',
          SEVERIDAD.ERROR,
          { pares: paresSolapados.map(({ piezas, ...r }) => r), descartados: paresDescartados },
        ),
  )

  // ── (c) COBERTURA: a lo oficial se le van quitando los miembros ───────────
  // Encadenar restas evita necesitar una UNIÓN —otro subpaquete de Turf y otro
  // delta de bundle—: lo que queda tras quitarlos todos es exactamente
  // `oficial \ ∪ miembros`, que es la definición de «superficie sin cubrir».
  //
  // ⚠️ El resto se lleva como LISTA de regiones y no como una: en cuanto la
  // primera resta parte el contorno en dos trozos, `restar` —que toma UNA región
  // con sus huecos— ya no puede recibirlo entero. Quedarse con el trozo mayor
  // sería perder huecos en silencio, que es el error que `geo/poligono.js`
  // documenta en su cabecera (12 m² presentados como 7).
  let restos = [oficial.recintos]
  let coberturaMedible = true
  for (const m of preparados) {
    if (restos.length === 0) break // ya no queda nada que descontar: está cubierto
    const siguientes = []
    for (const [k, region] of restos.entries()) {
      const r = restar(region, m.recintos)
      saltados.push(
        ...r.saltados.map((x) => ({ ...x, donde: `cobertura(${m.etiqueta})[${k}]` })),
      )
      if (r.detecciones.some((d) => d.severidad === SEVERIDAD.ERROR)) {
        coberturaMedible = false
        break
      }
      siguientes.push(...r.piezas)
    }
    if (!coberturaMedible) break
    restos = siguientes
  }

  const { cuentan: huecos, astillas: huecosDescartados } = coberturaMedible
    ? partirPorGrosor(restos, umbralGrosorM)
    : { cuentan: [], astillas: [] }
  const areaSinCubrir = huecos.reduce((t, p) => t + p.area, 0)
  /** `null` = no se ha podido medir, que NO es «no cubre». */
  const coberturaCumple = coberturaMedible ? huecos.length === 0 : null

  if (!coberturaMedible) {
    detecciones.push(
      crearDeteccionComprobacion(
        TIPO_COMPROBACION.CONJUNTO_NO_COTEJABLE,
        'No se ha podido comprobar si las parcelas cubren el contorno oficial: el motor ' +
          'geométrico no pudo completar la resta. Esto NO significa que el conjunto cierre; ' +
          'significa que no se sabe.',
        SEVERIDAD.ERROR,
        { afirmacion: 'cobertura', saltados },
      ),
    )
  } else if (coberturaCumple) {
    detecciones.push(
      crearDeteccionComprobacion(
        TIPO_COMPROBACION.COBERTURA_VERIFICADA,
        `${preparados.length === 1 ? 'La única parcela cubre' : `Las ${preparados.length} parcelas cubren`} el contorno oficial completo: no queda ` +
          'ningún trozo sin dueño.' +
          (huecosDescartados.length === 0
            ? ''
            : ` Se han descartado ${huecosDescartados.length} tiras de menos de ` +
              `${numero(umbralGrosorM * 1000, 1)} mm de ancho, que son ruido del redondeo ` +
              'del lindero y no superficie.'),
        SEVERIDAD.INFO,
        { descartados: huecosDescartados.map(({ recintos, ...r }) => r) },
      ),
    )
  } else {
    detecciones.push(
      crearDeteccionComprobacion(
        TIPO_COMPROBACION.COBERTURA_INCOMPLETA,
        `${huecos.length === 1 ? 'Queda 1 trozo' : `Quedan ${huecos.length} trozos`} del contorno ` +
          `oficial sin cubrir por ninguna de las parcelas del envío: ${numero(areaSinCubrir, 4)} ` +
          'm² en total. Esa superficie se quedaría sin dueño y el IVG devuelve un hueco.',
        SEVERIDAD.ERROR,
        {
          nHuecos: huecos.length,
          area: areaSinCubrir,
          huecos: huecos.map(({ recintos, ...r }) => r),
          descartados: huecosDescartados.map(({ recintos, ...r }) => r),
        },
      ),
    )
  }

  // ── El veredicto, con sus TRES estados ────────────────────────────────────
  // Una afirmación MEDIDA que falla manda sobre una que no se ha podido medir: si
  // la suma no cuadra, el conjunto no cierra, sepamos o no lo de la cobertura.
  // Sólo cuando todo lo medido va bien y queda algo sin medir el veredicto es
  // `null` — y `null` no es «cierra».
  const cierra =
    !sumaCumple || !solapeCumple ? false : coberturaCumple === null ? null : coberturaCumple

  return {
    cierra,
    suma: { areaOficial, areaMiembros, residuo, toleranciaM2: tolerancia, perimetroTotal, cumple: sumaCumple },
    solapes: { pares: paresSolapados, descartados: paresDescartados, cumple: solapeCumple },
    cobertura: {
      huecos,
      area: areaSinCubrir,
      descartados: huecosDescartados,
      cumple: coberturaCumple,
    },
    miembros: preparados.map((p) => ({
      etiqueta: p.etiqueta,
      areaValue: p.areaValue,
      superficieRedondeada: p.superficieRedondeada,
      superficieModelo: p.superficieModelo,
      nVertices: p.nVertices,
    })),
    umbralGrosorM,
    saltados,
    detecciones,
  }
}

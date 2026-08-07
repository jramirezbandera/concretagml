// gml/serialize-bu.js — F13 · El serializador a INSPIRE Buildings 2D extendido.
//
// Aquí se escribe el fichero de CONSTRUCCIÓN que el técnico sube a la Sede para
// pedir un **ICUC** (Informe Catastral de Ubicación de Construcciones). Es el
// gemelo de `gml/serialize-cp.js` y comparte con él el riesgo que lo define: un
// GML bien formado y mal hecho no se queja aquí — se queja la Sede, semanas
// después. Por eso este módulo tampoco inventa nada: cada namespace, cada
// anidamiento y cada literal salen de un fichero real de `test/fixtures/`
// (regla de oro 8).
//
// ═════════════════════════════════════════════════════════════════════════════
// ⛔ QUÉ SE EMITE, Y POR QUÉ NO SE EMITEN LAS PARTES
// ═════════════════════════════════════════════════════════════════════════════
// La ayuda oficial del ICUC dice, literalmente, que **solo procesa `Building` con
// `horizontalGeometryReference="footPrint"` u `OtherConstruction`** (dossier
// §1.3). O sea que **`BuildingPart` no lo mira**. La ficha de F13 mandaba emitir
// «`Building` + `BuildingPart` por parte con sus plantas», y eso habría metido en
// el documento trece afirmaciones que ningún validador comprueba — lo contrario de
// lo que este proyecto hace con los datos. Decisión del autor del 2026-08-06:
//
//   · **`Building`** — UNA huella, la **envolvente derivada** de las partes SOBRE
//     RASANTE, con un `gml:PolygonPatch` por cuerpo disjunto.
//   · **`OtherConstruction`** — una por cada parte de tipo «Otra» (piscinas).
//   · **`BuildingPart`** — NO se emite. Se sigue LEYENDO: `gml/parse-bu.js` no se
//     toca, y las plantas por parte siguen siendo lo que decide qué entra en la
//     envolvente.
//
// ⭐ **Y hay verdad externa de que la envolvente es lo correcto**, medida el
// 2026-08-06: la que `edificio/envolvente.js` deriva de las 13 partes del fixture
// es —**vértice a vértice**— la que el Catastro publica en su propio `Building`:
// dos piezas de 4 y 52 vértices, 5,20 y 316,93 m², con la parte 10 (un sótano, y
// la MAYOR con 245,90 m²) excluida en las dos. El criterio «solo lo que tiene
// volumen sobre rasante» no es nuestro: es el suyo.
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ AQUÍ NO HAY `perfil` Y SÍ HAY `modelo`
// ═════════════════════════════════════════════════════════════════════════════
// En parcela, `PERFIL.ENTREGA` frente a `PERFIL.WFS` existe por una causa concreta
// y cara: el WFS responde con raíz `wfs:FeatureCollection`, el IVG carga solo el
// esquema de parcela y el documento muere en la primera línea. Es el rechazo del
// 2026-07-27.
//
// **En edificio esa causa no existe**: el `wfsBU` responde ya con
// `gml:FeatureCollection`, igual que el fichero que se sube. Lo único que cambia
// entre la descarga y la entrega es **qué atributos lleva dentro**, y ese eje ya
// tiene nombre en el modelo: {@link MODELO}. Añadir un `perfil` sería una segunda
// palanca para la misma pregunta, y dos palancas para una pregunta acaban
// contradiciéndose.
//
// ═════════════════════════════════════════════════════════════════════════════
// LAS TRES DECISIONES QUE SE CALCAN DE `serialize-cp.js`, Y POR SUS MOTIVOS
// ═════════════════════════════════════════════════════════════════════════════
//   1. Devuelve `{xml, detecciones, resumen}` y no un string pelado: serializar
//      PIERDE información (redondeo a 2 decimales, inversión de anillos, fusión
//      de vértices, saneado de ids) y tragárselo en silencio es lo que prohíbe la
//      regla de oro 1.
//   2. **`xml` es `null` si hay una sola detección de severidad ERROR.** Un
//      fichero descargable es una invitación a subirlo.
//   3. **El reloj entra por parámetro.** Ni este módulo ni ningún otro de `gml/`
//      consultan la marca de tiempo del sistema — el guardián lee el TEXTO del
//      fichero, así que no debe aparecer ni dentro de un comentario.
//
// ═════════════════════════════════════════════════════════════════════════════
// DONDE EL FICHERO REAL MANDA SOBRE LA DOCUMENTACIÓN
// ═════════════════════════════════════════════════════════════════════════════
//   · `srsName` va en **URN** (`urn:ogc:def:crs:EPSG::25830`), no en URI. Es el
//     override O2 y es la diferencia más fácil de romper copiando de al lado.
//   · `conditionOfConstruction` se escribe **`functional`**. El PDF oficial lo
//     escribe mal («funtional») y ése es justo el error que copia quien transcribe.
//   · Las «otras» llevan su geometría en un **`gml:Polygon` DIRECTO**, sin
//     `Surface`/`patches`, y su `conditionOfConstruction` va `xsi:nil`.
//   · La huella es **un solo `gml:Surface` con N `PolygonPatch`**, nunca un
//     `MultiSurface` (que es lo que sí usa la parcela).

import {
  NS,
  SCHEMA_LOCATION_BU,
  SEVERIDAD,
  TIPO_GML,
  crearDeteccionGml,
  srsNameUrn,
} from './_comun.js'
import { DECIMALES_COORD, cerrarAnillo, prepararRecintos } from './anillos.js'
import { NAMESPACE_BU_CATASTRO, NAMESPACE_BU_DEFECTO, idsDeEdificio } from './ids.js'
import { ordenarSegunXsd } from './serialize-cp.js'
import { elem, render } from './xml.js'

// ── Constantes del dialecto ──────────────────────────────────────────────────

/** Prólogo. UTF-8 declarado y UTF-8 escrito (el fixture del Catastro miente aquí). */
export const DECLARACION_XML_BU = '<?xml version="1.0" encoding="UTF-8"?>'

/**
 * Comentario que el Catastro pone en la segunda línea de todos sus ficheros BU.
 * **No se copia** en la entrega: nuestro fichero no lo emite la D.G. del Catastro
 * y firmarlo con su rótulo sería decir que sí. Se declara para que quien compare
 * con el fixture sepa que la ausencia es deliberada.
 *
 * @readonly
 */
export const COMENTARIO_CATASTRO = 'Edificios de la D.G. del Catastro.'

/**
 * Los prefijos que se declaran en la raíz, en el orden en que se escriben.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 * ⛔ `xlink` NO SE USA EN NINGÚN ELEMENTO, Y SIN ÉL LA SEDE RECHAZA EL FICHERO
 * ═══════════════════════════════════════════════════════════════════════════
 * **MEDIDO CONTRA EL ICUC REAL EL 2026-08-06**, con certificado y sobre la
 * parcela `9398516VK3799G`. El servicio contesta «*Los siguientes ficheros no se
 * han cargado al no ser válidos*» —sin más detalle— a cualquier GML de edificio
 * que no declare `xmlns:xlink` en la raíz. Se acotó bisecando en cuatro rondas de
 * subida, y las seis medidas cuadran sin excepción:
 *
 *   · el fichero del Catastro, **tal cual** → **carga**
 *   · el fichero del Catastro **con solo nuestros 5 prefijos** → **RECHAZADO**
 *   · el nuestro con 8 prefijos más, sin `xlink` → **RECHAZADO**
 *   · el nuestro con los 5 de ISO 19139, sin `xlink` → **RECHAZADO**
 *   · el nuestro con otros 8 que **sí** incluyen `xlink` → **carga**
 *   · ⭐ el nuestro con **`xlink` y nada más** → **carga**
 *
 * Y lo que NO era, también medido, porque descartarlo costó tres rondas: no es el
 * nombre del fichero, ni los `xsi:nil`, ni la codificación, ni `gml:boundedBy`,
 * ni los atributos semánticos, ni `dateOfConstruction`/`externalReference`/
 * `addresses`/`cadastralParcels`, ni usar el namespace `ES.LOCAL.BU`.
 *
 * ⚠️ **Ni el XSD ni la ayuda oficial lo exigen.** El fichero valida contra
 * `BuildingExtended2D.xsd` con y sin la declaración —comprobado con libxml2
 * contra el esquema que sirve el propio Catastro—, y la ayuda del ICUC no la
 * menciona. Es la asimetría de F04 otra vez: **que el esquema diga OK no
 * garantiza que la Sede lo acepte**.
 *
 * ⛔ **Y F04 ya lo sabía.** `gml/_comun.js` lo tiene escrito desde julio para la
 * parcela: «*`gmd`, `ogc` y `xlink` van declarados aunque ningún elemento los
 * use: se emiten igual, por fidelidad a los ficheros reales*». Al escribir este
 * módulo declaré **solo los prefijos que mis elementos usan** —lo limpié— y ahí
 * nació el defecto. La regla de oro 8 vale también para lo que a uno le parece
 * superfluo, y sobre todo para eso.
 */
const PREFIJOS_RAIZ = Object.freeze([
  'base32',
  'bu-core2d',
  'bu-ext2d',
  'gml',
  'xlink',
  'xsi',
])

/**
 * `xmlns:` con el que sale cada prefijo interno. `base32` es la única clave de
 * {@link NS} cuyo nombre no coincide con su prefijo XML: en el fichero se declara
 * `xmlns:base`, y aquí se llama `base32` porque ya existe un `base33` (el de
 * parcela) y son namespaces distintos con el mismo prefijo.
 */
const PREFIJO_XML = Object.freeze({ base32: 'base' })
const prefijoXml = (clave) => PREFIJO_XML[clave] ?? clave

/**
 * `nilReason` con el que se declara «no consta». Es el que usan TODOS los
 * elementos nulos de los ficheros reales del Catastro, sin excepción medida.
 *
 * @readonly
 */
export const NIL_REASON_BU = 'other:unpopulated'

/** `srsDimension` de todo `posList`: dos coordenadas por punto (regla del ICUC). */
const SRS_DIMENSION = '2'

/** Unidad del `horizontalGeometryEstimatedAccuracy`. */
const UOM_METROS = 'm'

/** Unidad de la superficie oficial. */
const UOM_AREA = 'm2'

/**
 * El valor obligatorio de `horizontalGeometryReference` para que el ICUC procese
 * la construcción. Sin él, la respuesta literal del servicio es «*Se debe aportar
 * la geometría de la huella…*» (dossier §1.3).
 *
 * @readonly
 */
export const REFERENCIA_GEOMETRIA = 'footPrint'

/**
 * Los dos modelos de serialización, espejo de `MODELO_EDIFICIO` de
 * `model/edificio.js`. Se declaran aquí —con las mismas cadenas— y no se importan,
 * por la frontera de siempre: `gml/` no depende de `model/`. Hay un guardián que
 * prohíbe que las dos listas diverjan.
 *
 * @readonly
 */
export const MODELO = Object.freeze({
  /** Lo que el técnico rellena para el ICUC: geometría, identidad y estado. */
  SIMPLIFICADO: 'SIMPLIFICADO',
  /** Añade los atributos semánticos que devuelve el WFS. */
  COMPLETO: 'COMPLETO',
})

/**
 * Codelist de `conditionOfConstruction`, tal cual la publica INSPIRE. Es la
 * INVERSA de `edificio/entrada.js#CONDICION_A_ESTADO`, y se escribe aquí en vez
 * de importarla porque la frontera va en el otro sentido: `gml/` no conoce el
 * vocabulario del modelo. El guardián de contrato comprueba que las dos tablas
 * dicen lo mismo.
 *
 * ⚠️ `functional` con dos «c» y una «t». El PDF oficial del formato escribe
 * «funtional» y es el error que copia quien transcribe a mano.
 *
 * @readonly
 */
export const ESTADO_A_CONDICION = Object.freeze({
  FUNCIONAL: 'functional',
  EN_CONSTRUCCION: 'underConstruction',
  RUINOSO: 'ruin',
  DERRUIDO: 'demolished',
})

/**
 * `constructionNature` de las construcciones «otras». Hoy solo hay un valor
 * porque es el único MEDIDO —la piscina del fixture real— y porque el modelo no
 * distingue tipos de «otra»: inventar `openAirPool` para un porche sería afirmar
 * que hay una piscina donde no la hay.
 *
 * @readonly
 */
export const NATURALEZA_OTRA = 'openAirPool'

/**
 * Orden XSD de los hijos de `bu-ext2d:Building`, leído del fichero real
 * `bu_building_9398516VK3799G.gml`. Es un PREFIJO de la secuencia completa: detrás
 * van elementos opcionales que este proyecto no emite.
 *
 * Como en parcela, el orden se IMPONE con {@link ordenarSegunXsd} en vez de
 * confiarlo a en qué línea escribió cada uno el programador: con una plantilla,
 * meter un condicional o extraer un helper lo rompe y nada chilla hasta la Sede.
 *
 * @readonly
 */
export const ORDEN_BUILDING = Object.freeze([
  // ── en `bu-core2d` ──
  'beginLifespanVersion',
  'conditionOfConstruction',
  'dateOfConstruction',
  'endLifespanVersion',
  'externalReference',
  'inspireId',
  // ── en `bu-ext2d` ──
  'geometry',
  'currentUse',
  'numberOfBuildingUnits',
  'numberOfDwellings',
  'numberOfFloorsAboveGround',
  'officialArea',
])

/**
 * Orden XSD de los hijos de `bu-ext2d:OtherConstruction`, leído de
 * `wfsbu-allconstruction-9398516VK3799G.xml`, que es el único fichero real del
 * repo que trae una.
 *
 * @readonly
 */
export const ORDEN_OTHER_CONSTRUCTION = Object.freeze([
  // `bu-core2d` los tres primeros; `bu-ext2d` los dos últimos.
  'beginLifespanVersion',
  'conditionOfConstruction',
  'inspireId',
  'constructionNature',
  'geometry',
])

/**
 * Orden de los hijos de `bu-core2d:BuildingGeometry`. Ídem, del fichero real.
 *
 * ⚠️ Aquí `geometry` es el de `bu-core2d` y en {@link ORDEN_BUILDING} es el de
 * `bu-ext2d`: son dos elementos distintos con el mismo nombre local, uno dentro
 * del otro. Es la trampa más fina del dialecto —`gml/parse-bu.js` la documenta
 * desde F11— y aquí no muerde porque cada secuencia gobierna a un padre distinto.
 *
 * @readonly
 */
export const ORDEN_BUILDING_GEOMETRY = Object.freeze([
  'geometry',
  'horizontalGeometryEstimatedAccuracy',
  'horizontalGeometryReference',
  'referenceGeometry',
])

// ── Typedefs ─────────────────────────────────────────────────────────────────

/**
 * @typedef {Object} OpcionesEdificioBu
 * @property {Array<Array<object>>} envolvente  Las piezas de la huella: un array de
 *   `recintos` por cuerpo disjunto (`recintos[0]` EXTERIOR, el resto huecos),
 *   anillos ABIERTOS en UTM. Es lo que devuelve `edificio/envolvente.js#envolventeDe`
 *   en su clave `recintos`. Vacío ⇒ no hay huella que aportar (ERROR).
 * @property {Array<{nombre?: string, recinto: object}>} [otras=[]]  Construcciones
 *   «otras» (piscinas), una por elemento, con su anillo exterior.
 * @property {string} srs  `'EPSG:25830'`…
 * @property {string} refcat  La identidad. Ver `idsDeEdificio`: no se inventa aquí.
 * @property {string} [namespaceInspire='ES.LOCAL.BU']
 * @property {'SIMPLIFICADO'|'COMPLETO'} [modelo='SIMPLIFICADO']
 * @property {string|null} [beginLifespanVersion=null]  dateTime del Catastro. `null`
 *   ⇒ `xsi:nil`, que es lo honesto en un alta: la versión aún no rige.
 * @property {number|null} [plantasSobreRasante=null]  El MÁXIMO de las partes.
 * @property {string|null} [estadoConservacion=null]  Clave de {@link ESTADO_A_CONDICION}.
 * @property {number|null} [precisionMetros=null]  `horizontalGeometryEstimatedAccuracy`.
 *   `null` ⇒ `xsi:nil`. Ver la nota en {@link nodoBuildingGeometry}.
 * @property {string|null} [usoDominante=null]     Solo COMPLETO.
 * @property {number|null} [numeroInmuebles=null]  Solo COMPLETO.
 * @property {number|null} [numeroViviendas=null]  Solo COMPLETO.
 * @property {number|null} [superficieConstruida=null]  Solo COMPLETO (m²).
 * @property {number|null} [anioConstruccion=null]  Solo COMPLETO.
 * @property {string|null} [comentario=null]  Comentario(s) del prólogo.
 * @property {string} [indentacion='  ']
 */

// ── Helpers de nodo ──────────────────────────────────────────────────────────

/** Un elemento con `xsi:nil="true"` y su `nilReason`: «no consta», dicho. */
const nodoNil = (nombre, atributos = []) =>
  elem(nombre, [...atributos, ['xsi:nil', 'true'], ['nilReason', NIL_REASON_BU]], null)

/** `gml:posList` de un anillo ABIERTO: se cierra al escribir (regla de oro 4). */
function nodoPosList(vertices) {
  const cerrado = cerrarAnillo(vertices)
  const numeros = cerrado
    .map(([x, y]) => `${x.toFixed(DECIMALES_COORD)} ${y.toFixed(DECIMALES_COORD)}`)
    .join(' ')
  return elem(
    'gml:posList',
    [
      ['srsDimension', SRS_DIMENSION],
      ['count', String(cerrado.length)],
    ],
    numeros,
  )
}

/** `gml:exterior`/`gml:interior` → `gml:LinearRing` → `gml:posList`. */
const nodoAnillo = (recinto, i) =>
  elem(i === 0 ? 'gml:exterior' : 'gml:interior', [], [
    elem('gml:LinearRing', [], [nodoPosList(recinto.vertices)]),
  ])

/** `base:Identifier` con su `localId` y su `namespace`. */
const nodoInspireId = (nombre, localId, namespace) =>
  elem(nombre, [], [
    elem('base:Identifier', [], [
      elem('base:localId', [], localId),
      elem('base:namespace', [], namespace),
    ]),
  ])

/**
 * `bu-core2d:BuildingGeometry`: la huella, su precisión, su referencia y la
 * bandera de geometría de referencia.
 *
 * ⚠️ **`horizontalGeometryEstimatedAccuracy` sale `xsi:nil` por defecto, y es una
 * decisión.** El fixture del Catastro declara `0.1` — diez centímetros—, pero eso
 * es una afirmación del Catastro sobre SU dato. Copiarlo sería afirmar en nombre
 * del técnico una precisión de levantamiento que esta aplicación **no mide**
 * (regla de oro 9). Emitirlo nulo dice la verdad («no consta») y deja el elemento
 * presente, que es lo que hace falta si el esquema lo exige — el mismo recurso con
 * el que `serialize-cp.js` resuelve `beginLifespanVersion` en la entrega. Quien
 * tenga el dato lo pasa por `precisionMetros` y se emite.
 *
 * @param {object[]} nodosPatch
 * @param {string} srsName
 * @param {string} idSuperficie
 * @param {number|null} precisionMetros
 * @returns {object}
 */
function nodoBuildingGeometry(nodosPatch, srsName, idSuperficie, precisionMetros) {
  const superficie = elem(
    'gml:Surface',
    [
      ['gml:id', idSuperficie],
      ['srsName', srsName],
    ],
    [elem('gml:patches', [], nodosPatch)],
  )

  const hijos = ordenarSegunXsd(
    [
      elem('bu-core2d:geometry', [], [superficie]),
      precisionMetros === null
        ? nodoNil('bu-core2d:horizontalGeometryEstimatedAccuracy', [['uom', UOM_METROS]])
        : elem(
            'bu-core2d:horizontalGeometryEstimatedAccuracy',
            [['uom', UOM_METROS]],
            String(precisionMetros),
          ),
      elem('bu-core2d:horizontalGeometryReference', [], REFERENCIA_GEOMETRIA),
      elem('bu-core2d:referenceGeometry', [], 'true'),
    ],
    ORDEN_BUILDING_GEOMETRY,
  )

  return elem('bu-ext2d:geometry', [], [elem('bu-core2d:BuildingGeometry', [], hijos)])
}

// ── Validación de opciones ───────────────────────────────────────────────────

/** LANZA si el llamante rompe el contrato. Un dato malo del usuario no llega aquí. */
function exigirOpciones(opciones) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `serializarEdificioBu: se esperaba un objeto de opciones; recibido ${JSON.stringify(opciones)}.`,
    )
  }
  const { envolvente, otras = [], modelo = MODELO.SIMPLIFICADO, estadoConservacion = null } = opciones
  if (!Array.isArray(envolvente)) {
    throw new TypeError(
      `serializarEdificioBu: 'envolvente' debe ser un array de piezas (cada una un array de ` +
        `recintos); recibido ${typeof envolvente}. Es la clave 'recintos' de envolventeDe().`,
    )
  }
  if (!Array.isArray(otras)) {
    throw new TypeError(
      `serializarEdificioBu: 'otras' debe ser un array; recibido ${typeof otras}.`,
    )
  }
  const modelos = Object.values(MODELO)
  if (!modelos.includes(modelo)) {
    throw new RangeError(
      `serializarEdificioBu: 'modelo' inválido: ${JSON.stringify(modelo)}. Válidos: ${modelos.join(', ')}.`,
    )
  }
  if (estadoConservacion !== null && ESTADO_A_CONDICION[estadoConservacion] === undefined) {
    throw new RangeError(
      `serializarEdificioBu: 'estadoConservacion' inválido: ${JSON.stringify(estadoConservacion)}. ` +
        `Válidos: ${Object.keys(ESTADO_A_CONDICION).join(', ')}, o null.`,
    )
  }
}

// ── La función ───────────────────────────────────────────────────────────────

/**
 * Serializa una construcción al dialecto que valida el ICUC.
 *
 * @param {OpcionesEdificioBu} [opciones]
 * @returns {{xml: string|null, detecciones: object[], resumen: object}}
 *   `xml` es `null` si alguna detección es de severidad ERROR; `resumen.bloqueos`
 *   dice cuáles, en orden.
 * @throws {TypeError|RangeError} Contrato roto por el llamante.
 */
export function serializarEdificioBu(opciones = {}) {
  exigirOpciones(opciones)
  const {
    envolvente,
    otras = [],
    srs,
    refcat,
    namespaceInspire = NAMESPACE_BU_DEFECTO,
    modelo = MODELO.SIMPLIFICADO,
    beginLifespanVersion = null,
    plantasSobreRasante = null,
    estadoConservacion = null,
    precisionMetros = null,
    usoDominante = null,
    numeroInmuebles = null,
    numeroViviendas = null,
    superficieConstruida = null,
    anioConstruccion = null,
    comentario = null,
    indentacion = '  ',
  } = opciones

  const detecciones = []
  const srsName = srsNameUrn(srs)

  // ── 1 · Identidad ─────────────────────────────────────────────────────────
  const { ids, detecciones: detIds } = idsDeEdificio({
    namespaceInspire,
    refcat,
    nOtras: otras.length,
  })
  detecciones.push(...detIds)

  // ⛔ La trampa de `xs:ID` (la que `serializarExpedienteCp` documenta como su
  // modo de fallo principal): un id repetido invalida el documento ENTERO y no lo
  // enseña ninguna herramienta local. Se comprueba antes de renderizar y se LANZA,
  // porque llegar aquí con ids repetidos es un bug de este módulo, no un dato malo.
  //
  // ⚠️ **Hoy esta guarda es INALCANZABLE desde la API pública, y se queda igual.**
  // Lo es porque `idsDeEdificio` numera las «otras» por ÍNDICE y prefija cada
  // familia con su tipo (`Surface_`, `Polygon_`), así que dos ids solo podrían
  // chocar si alguien cambiara esa composición. Hay un test que afirma la
  // propiedad —todos los ids distintos, incluso con referencias adversas— en vez
  // de dejar aquí un guardián que nadie sabe si funciona. El día que el sufijo
  // salga del NOMBRE que ponga el usuario (dos piscinas «Piscina»), esto pasa a
  // ser alcanzable en la primera llamada.
  const todosLosIds = [
    ids.coleccion,
    ids.edificio,
    ids.superficie,
    ...ids.otras.flatMap((o) => [o.gmlId, o.poligono]),
  ]
  const repetido = todosLosIds.find((id, i) => todosLosIds.indexOf(id) !== i)
  if (repetido !== undefined) {
    throw new TypeError(
      `serializarEdificioBu: el gml:id ${JSON.stringify(repetido)} sale repetido en el documento. ` +
        'xs:ID es único en todo el fichero: repetirlo lo invalida entero, y ninguna herramienta ' +
        'local lo enseña. Revisa `refcat` y el número de construcciones «otras».',
    )
  }

  // ── 2 · La huella ─────────────────────────────────────────────────────────
  // Una pieza = un `gml:PolygonPatch`. Cada una pasa por `prepararRecintos`, que
  // es quien redondea, orienta (override O1) y cuenta lo que ha tenido que decidir.
  const patches = []
  let superficieHuella = 0
  envolvente.forEach((pieza) => {
    const preparados = prepararRecintos(pieza)
    detecciones.push(...preparados.detecciones)
    superficieHuella += preparados.superficieRedondeada
    patches.push(elem('gml:PolygonPatch', [], preparados.recintos.map(nodoAnillo)))
  })

  if (patches.length === 0) {
    detecciones.push(
      crearDeteccionGml(
        TIPO_GML.SIN_MIEMBROS,
        'No hay ninguna huella que aportar: ninguna parte de la construcción tiene volumen ' +
          'sobre rasante, así que la envolvente sale vacía. El ICUC contesta a esto «Se debe ' +
          'aportar la geometría de la huella…»; el fichero no se genera.',
        SEVERIDAD.ERROR,
        { piezas: 0, otras: otras.length },
      ),
    )
  }

  // ── 3 · El `Building` ─────────────────────────────────────────────────────
  const esCompleto = modelo === MODELO.COMPLETO
  const hijosEdificio = ordenarSegunXsd(
    [
      beginLifespanVersion === null
        ? nodoNil('bu-core2d:beginLifespanVersion')
        : elem('bu-core2d:beginLifespanVersion', [], beginLifespanVersion),
      estadoConservacion === null
        ? nodoNil('bu-core2d:conditionOfConstruction')
        : elem('bu-core2d:conditionOfConstruction', [], ESTADO_A_CONDICION[estadoConservacion]),
      esCompleto && anioConstruccion !== null
        ? elem('bu-core2d:dateOfConstruction', [], [
            elem('bu-core2d:DateOfEvent', [], [
              elem('bu-core2d:beginning', [], `${anioConstruccion}-01-01T00:00:00`),
            ]),
          ])
        : null,
      nodoInspireId('bu-core2d:inspireId', ids.localId, ids.namespace),
      patches.length === 0
        ? null
        : nodoBuildingGeometry(patches, srsName, ids.superficie, precisionMetros),
      esCompleto && usoDominante !== null ? elem('bu-ext2d:currentUse', [], usoDominante) : null,
      esCompleto && numeroInmuebles !== null
        ? elem('bu-ext2d:numberOfBuildingUnits', [], String(numeroInmuebles))
        : null,
      esCompleto && numeroViviendas !== null
        ? elem('bu-ext2d:numberOfDwellings', [], String(numeroViviendas))
        : null,
      // ⚠️ El fixture del WFS trae esto `xsi:nil` y la plantilla del modelo
      // SIMPLIFICADO (dossier §1.2) lo trae CON VALOR: no se contradicen, son dos
      // modelos distintos. Aquí es el MÁXIMO de plantas sobre rasante de las
      // partes —medido: 7 en el edificio de referencia—, y `null` sale nulo.
      plantasSobreRasante === null
        ? nodoNil('bu-ext2d:numberOfFloorsAboveGround')
        : elem('bu-ext2d:numberOfFloorsAboveGround', [], String(plantasSobreRasante)),
      esCompleto && superficieConstruida !== null
        ? elem('bu-ext2d:officialArea', [], [
            elem('bu-ext2d:OfficialArea', [], [
              elem('bu-ext2d:officialAreaReference', [], 'grossFloorArea'),
              elem('bu-ext2d:value', [['uom', UOM_AREA]], String(superficieConstruida)),
            ]),
          ])
        : null,
    ].filter(Boolean),
    ORDEN_BUILDING,
  )

  const nodoEdificio = elem('bu-ext2d:Building', [['gml:id', ids.edificio]], hijosEdificio)

  // ── 4 · Las «otras» ───────────────────────────────────────────────────────
  const nodosOtras = otras.map((otra, i) => {
    const preparados = prepararRecintos([otra.recinto])
    detecciones.push(...preparados.detecciones)
    const identidad = ids.otras[i]
    const poligono = elem(
      'gml:Polygon',
      [
        ['gml:id', identidad.poligono],
        ['srsName', srsName],
      ],
      preparados.recintos.map(nodoAnillo),
    )
    const hijos = ordenarSegunXsd(
      [
        nodoNil('bu-core2d:beginLifespanVersion'),
        // Va SIEMPRE nulo, y no por comodidad: así lo trae la piscina del fichero
        // real. Una piscina no está «en funcionamiento» ni «en ruina».
        nodoNil('bu-core2d:conditionOfConstruction'),
        nodoInspireId('bu-core2d:inspireId', identidad.localId, ids.namespace),
        elem('bu-ext2d:constructionNature', [], NATURALEZA_OTRA),
        elem('bu-ext2d:geometry', [], [poligono]),
      ],
      ORDEN_OTHER_CONSTRUCTION,
    )
    return elem('bu-ext2d:OtherConstruction', [['gml:id', identidad.gmlId]], hijos)
  })

  // ── 5 · El resumen y la puerta ────────────────────────────────────────────
  const bloqueos = detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR).map((d) => d.tipo)
  const resumen = {
    modelo,
    namespaceInspire,
    srsName,
    ids,
    nPiezas: patches.length,
    nOtras: nodosOtras.length,
    superficieHuella,
    bloqueos,
  }

  if (bloqueos.length > 0) return { xml: null, detecciones, resumen }

  // ── 6 · El documento ──────────────────────────────────────────────────────
  const atributos = [['gml:id', ids.coleccion]]
  for (const clave of PREFIJOS_RAIZ) atributos.push([`xmlns:${prefijoXml(clave)}`, NS[clave]])
  atributos.push(['xsi:schemaLocation', SCHEMA_LOCATION_BU])

  const miembros = [nodoEdificio, ...nodosOtras].map((n) => elem('gml:featureMember', [], [n]))
  const raiz = elem('gml:FeatureCollection', atributos, miembros)

  const comentarios =
    comentario === null ? [] : (Array.isArray(comentario) ? comentario : [comentario])
  const lineas = [
    DECLARACION_XML_BU,
    ...comentarios.map((c) => `<!--${c}-->`),
    render(raiz, { indentacion }),
  ]

  return { xml: `${lineas.join('\n')}\n`, detecciones, resumen }
}

// Re-exportados por comodidad del llamante, que casi siempre necesita elegir
// namespace y no debería tener que saber en qué módulo vive cada constante.
export { NAMESPACE_BU_CATASTRO, NAMESPACE_BU_DEFECTO }

// gml/parse-bu.js — F11 · Lectura de un GML de EDIFICIO (dialecto `DIALECTO.BU`).
// Tarea T1.2, contrato **C**.
//
// Es el hermano de `gml/parse.js` para la OTRA rama del proyecto. `gml/parse.js`
// lee un GML de PARCELA y, cuando le llega uno de edificio, se planta con un
// mensaje bueno («Esto es un GML de EDIFICIO, no de parcela», `:1135-1147`). Ese
// clasificador NO se ha reescrito: este módulo lo COMPLEMENTA por el otro lado —
// recibe el mismo fichero, reconoce el mismo dialecto con la misma tabla
// (`gml/_comun.js#DIALECTOS`) y devuelve lo que hay dentro.
//
// ── LO QUE DEVUELVE ES CRUDO. LA TRADUCCIÓN ES DE `edificio/entrada.js` ──────
// Regla dura del contrato C: aquí NO se traduce ni un valor. Sale `'functional'`,
// no `'FUNCIONAL'`; `'1_residential'`, no `'usoDominante'`; `'grossFloorArea'`,
// no `'superficieConstruida'`. El mapeo INSPIRE → vocabulario del modelo vive en
// `edificio/entrada.js` (T2.1), y esa frontera tiene una consecuencia práctica
// que es justo por lo que se trazó: **este módulo no importa `model/`**, así que
// se puede probar contra el fichero real sin arrastrar el modelo de dominio. Por
// el mismo motivo tampoco importa `gml/parse.js` —que sí importa
// `model/parcela.js` para su `TIPO_RECINTO`—, y de ahí la única duplicación de
// este fichero: {@link MAX_ERRORES_XML_BU} y el patrón de número de GML.
//
// «Crudo» se refiere al VOCABULARIO, no al tipo de dato. Un `posList` se trocea
// en números y `numberOfDwellings` sale como `17`, no como `'17'`, exactamente
// igual que `cp:areaValue` en `gml/parse.js`: convertir un texto decimal en un
// número no es traducir, es leer. Lo que no se toca son las cadenas de
// enumeración y las fechas, que salen tal cual venían.
//
// ── ⚠️ LA INVERSIÓN DE `soportado`, Y POR QUÉ ESTE MÓDULO NO LO DEVUELVE ─────
// En `gml/_comun.js#DIALECTOS`, `DIALECTO.BU` lleva `soportado: false`. Eso es
// cierto **desde la rama de parcela**, que es quien escribió la tabla: la Sede no
// admite un GML de edificio donde pide uno de parcela. Desde AQUÍ es al revés —
// BU es el único dialecto que este módulo sabe leer— y devolver ese `soportado`
// tal cual habría hecho que el fichero bueno saliera marcado como no soportado.
// Por eso el resultado lleva `ok` y no `soportado`: `ok` significa «esto es un
// GML de edificio y lo he leído», y de un CP 4.0 perfecto sale `ok: false`.
//
// ── NO LANZA POR EL CONTENIDO (la lección de F08 entera) ─────────────────────
// Frontera de SPEC §2.1, la misma de `gml/xml.js`, `gml/parse.js` y
// `parsers/importar.js`: XML sin cerrar, raíz ajena, `posList` con letras, un
// `Building` sin geometría… todo sale por `detecciones` y por `{ok:false, motivo}`.
// El `throw` se reserva al contrato roto por el PROGRAMADOR (`xml` que no es un
// string, `opciones` que no es un objeto). `xml` es texto YA DECODIFICADO: este
// módulo no toca bytes — pero sí REPORTA el `encoding` que el prólogo declara,
// porque los cinco ficheros BU reales dicen `ISO-8859-1`.
//
// ── LAS CUATRO COSAS QUE SE MIDIERON Y QUE SON FALLO SILENCIOSO SI FALTAN ────
// Las cuatro salen de la fase 0 de F11 (2026-08-03) y están atestadas una a una
// en `test/gml/parse-bu.test.js`. Un lector escrito solo contra los dos fixtures
// de F00 falla las cuatro **en verde**:
//
//   1. **Hay un TERCER tipo de feature: `bu-ext2d:OtherConstruction`.** La parcela
//      de referencia del proyecto tiene una PISCINA (`constructionNature =
//      openAirPool`, `gml:id` con sufijo `_PI.1`) que no está en ningún fixture de
//      F00. Y muerde por partida doble: su geometría es un **`gml:Polygon`
//      DIRECTO** (`exterior/LinearRing/posList`), no `Surface/patches/PolygonPatch`,
//      y cuelga de `bu-ext2d:geometry` **sin** el envoltorio
//      `bu-core2d:BuildingGeometry` que sí llevan el `Building` y las partes. Ver
//      {@link superficieDe}, que admite las dos formas y NOMBRA las dos cuando no
//      encuentra ninguna.
//   2. **Los atributos semánticos y las plantas viven en `bu-ext2d`, NO en
//      `bu-core2d`.** En `bu-ext2d`: `numberOfFloorsAboveGround`,
//      `numberOfFloorsBelowGround`, `heightBelowGround`, `currentUse`,
//      `numberOfBuildingUnits`, `numberOfDwellings`, `officialArea`,
//      `constructionNature` y el propio `geometry`. En `bu-core2d`:
//      `conditionOfConstruction`, `dateOfConstruction`, `inspireId`,
//      `externalReference`, `beginLifespanVersion`/`endLifespanVersion`,
//      `BuildingGeometry` y su `geometry` interno. Buscarlos en el namespace
//      equivocado devuelve `null` en las trece partes **y `part10` parece normal**.
//      Por eso no hay ni una búsqueda por nombre local suelta en la geometría ni
//      en los atributos: todas van con su namespace explícito. Ver {@link NS_BU}.
//   3. **N `gml:PolygonPatch` por `gml:Surface`.** El `Building` de la parcela de
//      referencia trae DOS (`count` 5 y 53) dentro de un solo `Surface`: quedarse
//      con el primero pierde **53 de 58 puntos**, sin decir nada. Aquí se leen
//      todos y se emite un {@link TIPO_GML.MULTIPLES_CARAS} de nivel INFO — que en
//      `gml/parse.js` es ERROR porque una parcela es UN perímetro, y en un edificio
//      es lo normal.
//   4. **El `count` de `gml:posList` incluye el punto de cierre.** Medido en los 17
//      anillos de los cinco ficheros: `count` es siempre igual al número de pares
//      CERRADOS. El modelo guarda el anillo **ABIERTO** (regla de oro 4), así que
//      el vértice de cierre se retira aquí, dejando constancia con
//      `CIERRE_RETIRADO`. Quien use `count` como «número de vértices» se pasa uno.
//
// ── LA COLECCIÓN VACÍA NO ES UN ERROR ────────────────────────────────────────
// Medido (T0.1·5): `GetOtherBuildingByParcel` sobre una parcela que existe
// devuelve **200 OK** con un `gml:FeatureCollection` de CERO `gml:featureMember`.
// Y en el flujo de edificio —a menudo obra nueva— ése es **el punto de partida**,
// no una avería. Por eso `SIN_MIEMBROS` se emite con severidad INFO (en
// `gml/parse.js` es ERROR) y `ok` sigue siendo `true`. Tampoco se emite
// `SRS_AUSENTE`: una colección sin features no declara sistema de referencia
// porque no tiene coordenadas, y exigírselo sería inventar un defecto.
//
// ── LO QUE ESTE MÓDULO NO LEE, A PROPÓSITO ───────────────────────────────────
// El contrato C fija la superficie y esto se ciñe a ella. Están en los ficheros y
// NO se devuelven: `beginLifespanVersion`/`endLifespanVersion`,
// `namespace` del `inspireId` (sí sale el `localId`), `externalReference/
// informationSystem`, `horizontalGeometryEstimatedAccuracy`,
// `horizontalGeometryReference`, `referenceGeometry`, `bu-ext2d:document` entero,
// `bu-core2d:addresses` y el `gml:Envelope` del `gml:boundedBy` —del que solo se
// aprovecha el `srsName`, para el cotejo de coherencia—. Ninguno hace falta hoy;
// si F12 o F13 los necesitan, se añaden aquí con su línea de test, que es más
// barato que devolver un objeto que nadie sabe leer.
//
// EL RELOJ NO SE LEE AQUÍ, como en todo `gml/`: el módulo es función PURA de su
// entrada. Hay un test-guarda que mira el TEXTO de este fichero, así que la
// instanciación de fechas no debe aparecer ni dentro de un comentario.
//
// Dependencias: `gml/_comun.js` (vocabulario) y `gml/xml.js` (lector XML propio).
// Ni `model/`, ni `geo/`, ni Leaflet, ni Turf: corre igual en el proyecto Vitest
// `node` y en el bundle de navegador.

import {
  DIALECTO,
  DIALECTOS,
  NS,
  SEVERIDAD,
  SRS_SOPORTADOS,
  TIPO_GML,
  clasificarDialecto,
  crearDeteccionGml,
  normalizarSrsName,
  srsCorto,
  srsNamePorForma,
} from './_comun.js'
import { SIN_NAMESPACE, atributo, hijo, hijos, parsearXml, texto } from './xml.js'

// ── Constantes ────────────────────────────────────────────────────────────────

/**
 * Tope de errores de XML mal formado que se convierten en detecciones, una a una.
 *
 * DUPLICADO a propósito de `gml/parse.js#MAX_ERRORES_XML`, con el mismo valor y
 * el mismo motivo (un fichero hostil puede traer miles y sepultar el informe).
 * No se importa de allí porque `gml/parse.js` importa `model/parcela.js`, y este
 * módulo se prueba contra el fixture SIN conocer `model/` — ver la cabecera. Son
 * dos números iguales; el acoplo costaría más.
 */
export const MAX_ERRORES_XML_BU = 20

/**
 * Los dos namespaces del dialecto de edificio, y el reparto EXACTO de qué vive
 * en cada uno. Es el hallazgo T0.2·5 de la fase 0 de F11, y buscar un elemento en
 * el que no es **no falla: devuelve `null`**, que es el modo de fallo que la
 * regla de oro 1 persigue.
 *
 * `ext2d` es el mismo URI que `gml/_comun.js#DIALECTOS` guarda como `featureNs`
 * del dialecto BU —es el DISCRIMINANTE del dialecto, y por eso vive allí—; el
 * test de este módulo ata las dos cadenas para que no puedan divergir. `core2d`
 * no está en `_comun.js` porque no discrimina nada: no distingue este dialecto de
 * ningún otro, solo dice dónde está cada dato una vez sabemos que es BU.
 *
 * Qué cuelga de cada uno, medido sobre los cinco ficheros reales:
 *   · `ext2d` — los tres tipos de feature (`Building`, `BuildingPart`,
 *     `OtherConstruction`), `geometry` (el contenedor EXTERIOR), `currentUse`,
 *     `numberOfBuildingUnits`, `numberOfDwellings`, `numberOfFloorsAboveGround`,
 *     `numberOfFloorsBelowGround`, `heightBelowGround`, `constructionNature`,
 *     `officialArea`/`OfficialArea`/`officialAreaReference`/`value`, `document`.
 *   · `core2d` — `conditionOfConstruction`, `dateOfConstruction`/`DateOfEvent`/
 *     `beginning`/`end`, `inspireId`, `externalReference`/`ExternalReference`/
 *     `reference`, `beginLifespanVersion`/`endLifespanVersion`, `addresses`,
 *     `cadastralParcels`, y el par `BuildingGeometry` → `geometry` INTERIOR.
 *
 * Los dos `geometry` (uno en cada namespace, anidados uno dentro del otro) son la
 * trampa más fina del fichero: `bu-ext2d:geometry` → `bu-core2d:BuildingGeometry`
 * → `bu-core2d:geometry` → `gml:Surface`. Ver {@link superficieDe}.
 *
 * @readonly
 */
export const NS_BU = Object.freeze({
  ext2d: 'http://inspire.jrc.ec.europa.eu/schemas/bu-ext2d/2.0',
  core2d: 'http://inspire.jrc.ec.europa.eu/schemas/bu-core2d/2.0',
})

/**
 * Los TRES tipos de construcción que trae el `wfsBU` del Catastro, con el nombre
 * LOCAL que llevan en `bu-ext2d`. El tercero es el que no estaba en ningún
 * fixture de F00 y el que se pierde en silencio si no se busca (T0.1·7).
 *
 * @readonly
 */
export const FEATURE_BU = Object.freeze({
  /** El edificio: envolvente + los siete atributos semánticos. Uno por parcela. */
  BUILDING: 'Building',
  /** Cada volumen con sus plantas. La geometría fina vive aquí (13 en el fixture). */
  BUILDING_PART: 'BuildingPart',
  /** Piscinas, porches y demás. `gml:Polygon` DIRECTO y `constructionNature`. */
  OTHER_CONSTRUCTION: 'OtherConstruction',
})

/**
 * Un número tal como GML lo escribe. DUPLICADO de `gml/parse.js` por el mismo
 * motivo que {@link MAX_ERRORES_XML_BU}, y deliberadamente MÁS ESTRICTO que
 * `Number`: `Number('0x1A')`, `Number('Infinity')` y `Number('1_0')` devuelven
 * valores sin protestar y ninguno es un token legítimo de un `gml:posList`.
 */
const RE_NUMERO = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

/** Formas del `encoding` del prólogo que son UTF-8 (el que este proyecto emite). */
const ENCODINGS_UTF8 = Object.freeze(['utf-8', 'utf8'])

/** El `refcat=` de un `xlink:href` del `wfsBU` (`…&refcat=9398516VK3799G&…`). */
const RE_REFCAT_HREF = /[?&]refcat=([^&]+)/i

/** El dialecto BU de la tabla compartida. Se resuelve una vez, al cargar. */
const DIALECTO_BU = DIALECTOS.find((d) => d.id === DIALECTO.BU)

// ── Typedefs del contrato C ───────────────────────────────────────────────────

/**
 * Los elementos que vinieron con `xsi:nil="true"`, con su `nilReason`.
 *
 * Existe porque el contrato C exige distinguir **`null` porque el fichero dice
 * expresamente que no consta** de **`null` porque el elemento no está**, y con un
 * único campo `numberOfFloorsAboveGround: null` esa diferencia se pierde. Es un
 * caso REAL y no una hipótesis: el `Building` de la parcela de referencia trae
 * `numberOfFloorsAboveGround xsi:nil="true" nilReason="other:unpopulated"`, y las
 * TRECE partes traen así su `conditionOfConstruction` —que es exactamente por lo
 * que el estado de conservación hay que sacarlo del `Building`—.
 *
 * La clave es el nombre LOCAL del elemento; el valor, su `nilReason` tal cual
 * (`'other:unpopulated'`), o `null` si no lo llevaba.
 *
 * @typedef {Object<string, string|null>} NilsBu
 */

/**
 * El `bu-ext2d:Building`: la envolvente y los atributos semánticos. Uno por
 * parcela.
 *
 * @typedef {Object} EdificioBu
 * @property {string|null} gmlId    Atributo `gml:id` del feature.
 * @property {string|null} localId  `localId` del `inspireId` (`'9398516VK3799G'`).
 * @property {string|null} refcat   Referencia catastral. Ver {@link leerRefcat}.
 * @property {Array<Array<[number, number]>>} anillos  UN anillo por
 *   `gml:PolygonPatch` del `gml:Surface` (medido: **2** en la parcela de
 *   referencia). ABIERTOS y sin reorientar.
 * @property {Array<Array<[number, number]>>} huecos   `gml:interior` de esos
 *   patches, aplanados. Medido: 0 en los cinco ficheros reales.
 * @property {string|null} conditionOfConstruction  CRUDO: `'functional'`.
 * @property {string|null} currentUse               CRUDO: `'1_residential'`.
 * @property {number|null} numberOfBuildingUnits
 * @property {number|null} numberOfDwellings
 * @property {number|null} numberOfFloorsAboveGround  `null` **por `xsi:nil`** en
 *   la parcela de referencia: mira `nils` para distinguirlo de la ausencia.
 * @property {{beginning: string|null, end: string|null}|null} dateOfConstruction
 *   dateTime tal cual. Medido: el Catastro lo refiere al **1 de enero**
 *   (`'1997-01-01T00:00:00'` en `beginning` y en `end`).
 * @property {Array<{referencia: string|null, valor: number|null, uom: string|null}>}
 *   officialArea  Un elemento por `bu-ext2d:officialArea`. Medido: uno solo, con
 *   `referencia: 'grossFloorArea'`, `valor: 2513`, `uom: 'm2'`.
 * @property {NilsBu} nils
 */

/**
 * Un `bu-ext2d:BuildingPart`: un volumen con sus plantas.
 *
 * @typedef {Object} ParteBu
 * @property {string|null} gmlId
 * @property {string|null} localId  `'9398516VK3799G_part10'`.
 * @property {string|null} refcat
 * @property {Array<Array<[number, number]>>} anillos  Uno por patch (medido: 1).
 * @property {Array<Array<[number, number]>>} huecos   Medido: 0 en las trece.
 * @property {number|null} numberOfFloorsAboveGround   Las TRECE lo traen.
 * @property {number|null} numberOfFloorsBelowGround   Las TRECE lo traen.
 * @property {number|null} heightBelowGround           En metros (`uom="m"`).
 * @property {string|null} heightBelowGroundUom        El `uom` literal.
 * @property {string|null} conditionOfConstruction  `xsi:nil` en las trece ⇒ `null`.
 * @property {NilsBu} nils
 */

/**
 * Un `bu-ext2d:OtherConstruction`: piscina, porche… El tipo que no estaba en
 * ningún fixture de F00.
 *
 * @typedef {Object} OtraBu
 * @property {string|null} gmlId    Lleva sufijo: `'…9398516VK3799G_PI.1'`.
 * @property {string|null} localId  `'9398516VK3799G_PI.1'`.
 * @property {string|null} refcat
 * @property {Array<Array<[number, number]>>} anillos  Del `gml:Polygon` DIRECTO.
 * @property {Array<Array<[number, number]>>} huecos
 * @property {string|null} constructionNature  CRUDO: `'openAirPool'`.
 * @property {string|null} conditionOfConstruction  `xsi:nil` en la piscina ⇒ `null`.
 * @property {NilsBu} nils
 */

/**
 * @typedef {Object} ResultadoParseGmlBu
 * @property {boolean} ok  `true` si el documento ES un GML de edificio y se ha
 *   podido recorrer. Una colección VACÍA sale con `ok: true` (ver la cabecera).
 *   **No es `soportado`**: ver la inversión explicada en la cabecera.
 * @property {string|null} motivo  Por qué `ok` es `false`, en castellano. `null`
 *   cuando `ok` es `true`.
 * @property {string} dialecto  Clave de {@link DIALECTO}. `'BU'` en el caso bueno;
 *   con un GML de parcela sale su dialecto real, para poder nombrarlo.
 * @property {string|null} srs  Forma corta (`'EPSG:25830'`), la que consumen
 *   `model/` y `geo/huso.js`. `null` si falta, si no es de los soportados o si el
 *   documento se contradice a sí mismo.
 * @property {string|null} srsName  El `srsName` **LITERAL**, sin normalizar: en BU
 *   es la URN (`'urn:ogc:def:crs:EPSG::25830'`). Es el primero de los observados;
 *   si hubiera varios distintos se emite `SRS_INCOHERENTE` y `srs` sale `null`.
 * @property {EdificioBu|null} edificio  El PRIMER `Building`, o `null`.
 * @property {ParteBu[]} partes  En orden de documento.
 * @property {OtraBu[]} otras    En orden de documento.
 * @property {number} nMiembros  `gml:featureMember` de la raíz. **0 no es error.**
 * @property {import('./_comun.js').DeteccionGml[]} detecciones
 */

// ── Detecciones ───────────────────────────────────────────────────────────────

/** Contexto de una llamada: detecciones y `srsName` observados. */
function crearContexto() {
  return { detecciones: [], srsNames: [] }
}

/** Añade una detección de documento (sin feature asociado). */
function anota(ctx, tipo, mensaje, severidad, datos) {
  ctx.detecciones.push(crearDeteccionGml(tipo, mensaje, severidad, datos))
}

/**
 * Añade una detección atribuida a un FEATURE concreto. El `donde` va delante del
 * mensaje y también dentro de `datos`, para que la interfaz pueda decir de qué
 * parte habla cada aviso en vez de enseñarlas todas juntas sin dueño — que con
 * trece partes es la diferencia entre un informe y una lista.
 */
function anotaEn(ctx, ref, tipo, mensaje, severidad, datos) {
  anota(ctx, tipo, `${ref.donde}: ${mensaje}`, severidad, {
    miembro: ref.miembro,
    donde: ref.donde,
    ...(datos ?? {}),
  })
}

/** Recuentos. Misma forma que `gml/parse.js#contarDetecciones`. */
function contarDetecciones(detecciones) {
  const porTipo = {}
  const porSeveridad = { INFO: 0, AVISO: 0, ERROR: 0 }
  for (const d of detecciones) {
    porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + 1
    porSeveridad[d.severidad] += 1
  }
  return { total: detecciones.length, porTipo, porSeveridad }
}

// ── Lectura de valores ────────────────────────────────────────────────────────

/**
 * Texto de un elemento que puede venir ANULADO, apuntando el `nilReason` en
 * `nils` cuando lo está.
 *
 * `xsi:nil="true"` es AUSENCIA DECLARADA y devolverlo como `''` lo confundiría
 * con un elemento vacío, que es otro dato. Y devolverlo como `null` a secas lo
 * confundiría con «el elemento no está», que es lo que el contrato C exige
 * distinguir: de ahí `nils`.
 *
 * ⚠️ `nilReason` va SIN NAMESPACE aunque `nil` lleve el de `xsi`: es la trampa de
 * XML-NS 1.0 §6.2 que documenta la cabecera de `gml/xml.js`.
 *
 * @param {object|null} nodo
 * @param {NilsBu} nils
 * @returns {string|null}
 */
function valorTexto(nodo, nils) {
  if (nodo === null) return null
  if (atributo(nodo, NS.xsi, 'nil') === 'true') {
    nils[nodo.local] = atributo(nodo, SIN_NAMESPACE, 'nilReason')
    return null
  }
  return texto(nodo)
}

/**
 * Igual que {@link valorTexto} pero devolviendo NÚMERO.
 *
 * Cuando el texto está y no es un número se emite una detección y se devuelve
 * `null`: callarlo sería meter un `null` indistinguible de la ausencia, que es el
 * error silencioso que este módulo existe para no cometer.
 *
 * ⚠️ El tipo es `AREA_DECLARADA_DISCREPANTE` y **no encaja del todo**: el
 * vocabulario de `gml/_comun.js#TIPO_GML` está CERRADO —no se amplía desde aquí,
 * que es fichero de otra tarea— y no tiene ningún tipo para «un valor declarado
 * no se puede interpretar» fuera del área. Es el mismo apaño, con el mismo
 * razonamiento escrito, que ya hace `gml/parse.js#leerAreaValue` con un
 * `cp:areaValue` ilegible. El mensaje dice el elemento exacto, que es lo que el
 * usuario necesita; el tipo es solo la etiqueta con la que la interfaz lo agrupa.
 *
 * @returns {number|null}
 */
function valorNumero(ctx, ref, nodo, nils, cualificado) {
  const crudo = valorTexto(nodo, nils)
  if (crudo === null || crudo === '') return null
  if (!RE_NUMERO.test(crudo)) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.AREA_DECLARADA_DISCREPANTE,
      `«${cualificado}» declara ${JSON.stringify(crudo)}, que no es un número y no se puede ` +
        'usar. Se devuelve sin valor; el dato original está en el fichero, sin tocar.',
      SEVERIDAD.AVISO,
      { elemento: cualificado, crudo },
    )
    return null
  }
  return Number(crudo)
}

/**
 * Referencia catastral del feature, de las DOS fuentes que traen los ficheros
 * reales, en este orden:
 *
 *   1. `bu-core2d:externalReference/…/bu-core2d:reference` — la declaración
 *      explícita. **Solo la trae el `Building`**; ni las partes ni las otras
 *      construcciones la llevan.
 *   2. El parámetro `refcat=` del `xlink:href` de `bu-core2d:cadastralParcels`
 *      (y, en su defecto, el de `bu-core2d:addresses`). Lo llevan **los tres
 *      tipos**, y no es una deducción nuestra: es la referencia con la que el
 *      propio servicio enlaza este feature con su parcela.
 *
 * Lo que NO se hace, y está medido que no se puede hacer: **cortar el `localId`**.
 * Vale `'9398516VK3799G_part10'` en una parte y `'9398516VK3799G_PI.1'` en la
 * piscina, y recortarlo por longitud —14 o 20 caracteres— acierta unas veces y
 * otras no. La procedencia del fixture lo deja escrito con todas las letras.
 *
 * @returns {string|null}
 */
function leerRefcat(feature) {
  const externa = hijo(feature, NS_BU.core2d, 'externalReference')
  const bloque = externa === null ? null : hijo(externa, NS_BU.core2d, 'ExternalReference')
  const referencia = bloque === null ? null : hijo(bloque, NS_BU.core2d, 'reference')
  if (referencia !== null) {
    const valor = texto(referencia)
    if (valor !== '') return valor
  }
  for (const local of ['cadastralParcels', 'addresses']) {
    const enlace = hijo(feature, NS_BU.core2d, local)
    if (enlace === null) continue
    const href = atributo(enlace, NS.xlink, 'href')
    const m = href === null ? null : RE_REFCAT_HREF.exec(href)
    if (m !== null) return decodeURIComponent(m[1])
  }
  return null
}

/**
 * `localId` del `inspireId`.
 *
 * El `Identifier` y sus hijos se buscan por nombre LOCAL, igual que en
 * `gml/parse.js`: en BU van sobre INSPIRE base **3.2**
 * (`urn:x-inspire:specification:gmlas:BaseTypes:3.2`), que es la del CP 3.0, y no
 * sobre la 3.3 del CP 4.0. Aquí eso NO es un defecto que reprochar —es el
 * dialecto que el Catastro emite en edificio— así que no se emite
 * `INSPIREID_NS_INESPERADO`: sería un aviso que sale siempre, y un aviso que sale
 * siempre es un aviso que ya no se lee.
 *
 * @returns {string|null}
 */
function leerLocalId(feature) {
  const inspireId = hijo(feature, NS_BU.core2d, 'inspireId')
  if (inspireId === null) return null
  const identifier = inspireId.hijos.find((h) => h.local === 'Identifier') ?? null
  if (identifier === null) return null
  const localId = identifier.hijos.find((h) => h.local === 'localId') ?? null
  return localId === null ? null : texto(localId)
}

// ── srsName ───────────────────────────────────────────────────────────────────

/** Anota el `srsName` de un nodo, si lo lleva, para el cotejo de coherencia. */
function recogerSrsName(ctx, nodo, donde) {
  const crudo = atributo(nodo, SIN_NAMESPACE, 'srsName')
  if (crudo !== null) ctx.srsNames.push({ donde, valor: crudo.trim() })
}

/**
 * Decide el `srs` del documento a partir de todos los `srsName` observados.
 *
 * Se juzga a nivel de DOCUMENTO y no de feature: las trece partes, el edificio y
 * la piscina son el mismo objeto físico visto por trozos, y dos husos distintos
 * en el mismo fichero no son «una parte en otro sistema», son un fichero roto.
 * Medido: los cinco ficheros reales declaran la MISMA URN en todos sus
 * portadores (13 `Surface`; `Envelope` + `Surface`; `Envelope`+`Surface` y
 * `Envelope`+`Polygon`).
 */
function resolverSrs(ctx, hayFeatures) {
  if (ctx.srsNames.length === 0) {
    if (!hayFeatures) {
      // Colección vacía: no hay coordenadas, así que no falta ningún `srsName`.
      // Exigirlo aquí convertiría el punto de partida de la obra nueva en un
      // defecto, que es justo lo contrario de lo que la fase 0 midió.
      return { srs: null, srsName: null }
    }
    anota(
      ctx,
      TIPO_GML.SRS_AUSENTE,
      'Ninguna geometría del fichero declara «srsName»: no se puede saber en qué sistema de ' +
        'referencia están las coordenadas, y suponerlo sería inventarlo.',
      SEVERIDAD.ERROR,
    )
    return { srs: null, srsName: null }
  }

  const literal = ctx.srsNames[0].valor
  const distintos = [...new Set(ctx.srsNames.map((s) => s.valor))]
  const analisis = normalizarSrsName(literal, { formaCanonica: DIALECTO_BU.formaSrsName })

  if (distintos.length > 1) {
    anota(
      ctx,
      TIPO_GML.SRS_INCOHERENTE,
      `El fichero declara ${distintos.length} «srsName» distintos ` +
        `(${distintos.map((v) => JSON.stringify(v)).join(', ')}). No se elige uno: todas las ` +
        'construcciones de una misma parcela tienen que estar en el mismo sistema, y quedarse ' +
        'con el primero llevaría a pintar unas partes en un huso y otras en otro.',
      SEVERIDAD.ERROR,
      { valores: distintos, donde: ctx.srsNames.map((s) => s.donde) },
    )
    return { srs: null, srsName: literal }
  }

  if (analisis.codigo === null) {
    anota(
      ctx,
      TIPO_GML.SRS_NO_SOPORTADO,
      `El «srsName» ${JSON.stringify(literal)} no contiene ningún código EPSG reconocible. ` +
        'Formas admitidas: la URN «urn:ogc:def:crs:EPSG::25830» —que es la que emite el ' +
        'servicio de edificios del Catastro—, la URI OGC ' +
        '«http://www.opengis.net/def/crs/EPSG/0/25830» y la forma corta «EPSG:25830».',
      SEVERIDAD.ERROR,
      { srsName: literal, forma: analisis.forma },
    )
    return { srs: null, srsName: literal }
  }

  const corto = `EPSG:${analisis.codigo}`
  if (!SRS_SOPORTADOS.includes(corto)) {
    anota(
      ctx,
      TIPO_GML.SRS_NO_SOPORTADO,
      `El fichero está en ${corto} y este proyecto solo trabaja en ` +
        `${SRS_SOPORTADOS.join(', ')}. Reproyecta el fichero a ETRS89/UTM antes de leerlo.`,
      SEVERIDAD.ERROR,
      { codigo: analisis.codigo, srsName: literal, soportados: [...SRS_SOPORTADOS] },
    )
    return { srs: null, srsName: literal }
  }

  if (!analisis.coherente) {
    anota(
      ctx,
      TIPO_GML.SRS_FORMA_INESPERADA,
      `El «srsName» ${JSON.stringify(literal)} está en forma ${analisis.forma}, y el GML de ` +
        `edificio del Catastro lo lleva en ${analisis.formaCanonica}: ` +
        `«${srsNamePorForma(srsCorto(analisis.codigo), analisis.formaCanonica)}» (override O10). ` +
        'El código EPSG se entiende igual y la geometría se lee sin problema; se avisa porque ' +
        'no es la forma del fichero de referencia.',
      SEVERIDAD.AVISO,
      { srsName: literal, forma: analisis.forma, codigo: analisis.codigo },
    )
  }

  return { srs: srsCorto(analisis.codigo), srsName: literal }
}

// ── Anillos ───────────────────────────────────────────────────────────────────

/**
 * Trocea una lista de coordenadas en números. `null` si algún token no lo es.
 */
function leerNumeros(ctx, ref, crudo, donde) {
  const tokens = crudo.split(/\s+/).filter((t) => t.length > 0)
  const malos = tokens.filter((t) => !RE_NUMERO.test(t))
  if (malos.length > 0) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.POSLIST_INVALIDA,
      `${donde}: ${malos.length} de ${tokens.length} valores no son números ` +
        `(${malos.slice(0, 5).map((t) => JSON.stringify(t)).join(', ')}). Una lista de ` +
        'coordenadas de GML lleva solo números decimales separados por espacios, con punto ' +
        'decimal.',
      SEVERIDAD.ERROR,
      { anillo: donde, tokens: tokens.length, malos: malos.slice(0, 5) },
    )
    return null
  }
  return tokens.map(Number)
}

/**
 * Lee un `gml:exterior`/`gml:interior` y devuelve sus vértices ya ABIERTOS.
 *
 * ⚠️ AQUÍ VIVE EL HALLAZGO 4 DE LA FASE 0: el atributo `count` de un `gml:posList`
 * cuenta los pares **CERRADOS**, con el punto de cierre incluido. Medido en los
 * 17 anillos de los cinco ficheros reales: `count="5"` ⇒ 5 pares en la lista ⇒
 * **4 vértices** en el anillo abierto que guarda el modelo (regla de oro 4). Por
 * eso el cotejo del `count` se hace contra los pares LEÍDOS, antes de abrir, y el
 * cierre se retira después dejando constancia con `CIERRE_RETIRADO`.
 *
 * Si el último par NO repite al primero, el anillo se devuelve tal cual y se
 * emite `ANILLO_NO_CERRADO`: cerrarlo por nuestra cuenta sería inventar una
 * arista que el fichero no declara.
 *
 * @returns {Array<[number, number]>|null}
 */
function leerAnillo(ctx, ref, contenedor, donde) {
  const anillo = hijo(contenedor, NS.gml, 'LinearRing')
  if (anillo === null) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.POSLIST_INVALIDA,
      `${donde}: no contiene ningún «gml:LinearRing».`,
      SEVERIDAD.ERROR,
      { anillo: donde, falta: 'LinearRing' },
    )
    return null
  }
  recogerSrsName(ctx, anillo, `${ref.donde} · ${donde}/LinearRing`)

  const posList = hijo(anillo, NS.gml, 'posList')
  if (posList === null) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.POSLIST_INVALIDA,
      `${donde}: el «gml:LinearRing» no contiene ningún «gml:posList», que es de donde este ` +
        'proyecto lee las coordenadas de un anillo.',
      SEVERIDAD.ERROR,
      { anillo: donde, falta: 'posList' },
    )
    return null
  }

  const srsDimension = atributo(posList, SIN_NAMESPACE, 'srsDimension')
  if (srsDimension !== null && srsDimension.trim() !== '2') {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.SRS_DIMENSION_INESPERADA,
      `${donde}: «srsDimension» vale ${JSON.stringify(srsDimension)} y este proyecto lee la ` +
        'lista como pares (x y) en dos dimensiones. Los valores se emparejan igual, de dos en ' +
        'dos: revisa si el fichero traía cotas.',
      SEVERIDAD.AVISO,
      { anillo: donde, srsDimension },
    )
  }

  const numeros = leerNumeros(ctx, ref, texto(posList), donde)
  if (numeros === null) return null
  if (numeros.length === 0 || numeros.length % 2 !== 0) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.POSLIST_INVALIDA,
      `${donde}: hay ${numeros.length} valores, que no forman pares (x y) completos. Se ` +
        'esperaba un número PAR de valores y al menos uno.',
      SEVERIDAD.ERROR,
      { anillo: donde, valores: numeros.length },
    )
    return null
  }
  const pares = []
  for (let i = 0; i < numeros.length; i += 2) pares.push([numeros[i], numeros[i + 1]])

  const count = atributo(posList, SIN_NAMESPACE, 'count')
  if (count !== null && Number(count.trim()) !== pares.length) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.COUNT_DISCREPANTE,
      `${donde}: el atributo «count» declara ${JSON.stringify(count)} y la lista trae ` +
        `${pares.length} pares de coordenadas (contando el punto de cierre, que es como el ` +
        'Catastro lo cuenta). Manda la lista; el «count» es una redundancia del fichero.',
      SEVERIDAD.AVISO,
      { anillo: donde, count, pares: pares.length },
    )
  }

  if (pares.length < 2) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.ANILLO_NO_CERRADO,
      `${donde}: el anillo trae ${pares.length} vértice(s); no hay con qué comprobar el ` +
        'cierre. Un anillo de GML repite el primer par al final.',
      SEVERIDAD.ERROR,
      { anillo: donde, vertices: pares.length },
    )
    return pares
  }

  const [px, py] = pares[0]
  const [ux, uy] = pares[pares.length - 1]
  if (px !== ux || py !== uy) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.ANILLO_NO_CERRADO,
      `${donde}: el último par (${ux} ${uy}) no repite al primero (${px} ${py}), y en GML un ` +
        '«gml:LinearRing» va cerrado. No se cierra por nuestra cuenta: añadir esa arista sería ' +
        'inventar geometría que el fichero no declara.',
      SEVERIDAD.ERROR,
      { anillo: donde, primero: [px, py], ultimo: [ux, uy], vertices: pares.length },
    )
    return pares
  }

  const abierto = pares.slice(0, -1)
  anotaEn(
    ctx,
    ref,
    TIPO_GML.CIERRE_RETIRADO,
    `${donde}: el anillo venía CERRADO (${pares.length} pares, el último repite al primero) y ` +
      `el modelo los guarda ABIERTOS (regla de oro 4): se retira el vértice de cierre → ` +
      `${abierto.length} vértices. El «count» del fichero cuenta los ${pares.length}.`,
    SEVERIDAD.INFO,
    { anillo: donde, antes: pares.length, despues: abierto.length },
  )
  return abierto
}

// ── Geometría ─────────────────────────────────────────────────────────────────

/**
 * Localiza el `gml:Surface` o `gml:Polygon` que hay bajo `bu-ext2d:geometry`.
 *
 * ⚠️ SON DOS FORMAS, Y LAS DOS SON REALES EN EL MISMO SERVICIO (T0.1·7):
 *
 *   · **Envuelta** — `Building` y `BuildingPart`:
 *     `bu-ext2d:geometry` → `bu-core2d:BuildingGeometry` → `bu-core2d:geometry` →
 *     `gml:Surface` → `gml:patches` → N `gml:PolygonPatch`.
 *   · **Directa** — `OtherConstruction` (la piscina):
 *     `bu-ext2d:geometry` → `gml:Polygon` → `gml:exterior` → `gml:LinearRing`.
 *
 * Fíjate en los DOS `geometry`: el de fuera es de `bu-ext2d` y el de dentro de
 * `bu-core2d`. Un lector que busque `geometry` por nombre local encuentra el que
 * no toca la mitad de las veces; uno escrito solo contra los fixtures de F00
 * pierde la piscina ENTERA sin decir nada.
 *
 * @returns {object|null}
 */
function superficieDe(ctx, ref, geometria) {
  const directa =
    hijo(geometria, NS.gml, 'Surface') ?? hijo(geometria, NS.gml, 'Polygon') ?? null
  if (directa !== null) return directa

  const envoltorio = hijo(geometria, NS_BU.core2d, 'BuildingGeometry')
  const interna = envoltorio === null ? null : hijo(envoltorio, NS_BU.core2d, 'geometry')
  const envuelta =
    interna === null
      ? null
      : hijo(interna, NS.gml, 'Surface') ?? hijo(interna, NS.gml, 'Polygon') ?? null
  if (envuelta !== null) return envuelta

  anotaEn(
    ctx,
    ref,
    TIPO_GML.POSLIST_INVALIDA,
    'dentro de «bu-ext2d:geometry» no hay ninguna de las dos formas que emite el servicio de ' +
      'edificios: ni «bu-core2d:BuildingGeometry → bu-core2d:geometry → gml:Surface» (que es ' +
      'la del Building y la de las partes) ni un «gml:Polygon» directo (que es la de las otras ' +
      `construcciones). Lo que hay dentro es: ${
        geometria.hijos.length === 0
          ? 'nada'
          : geometria.hijos.map((h) => `«${h.prefijo ? `${h.prefijo}:` : ''}${h.local}»`).join(', ')
      }.`,
    SEVERIDAD.ERROR,
    { hijos: geometria.hijos.map((h) => ({ ns: h.ns, local: h.local })) },
  )
  return null
}

/**
 * Las CARAS de una superficie: los `gml:PolygonPatch` de un `gml:Surface`, o el
 * propio `gml:Polygon`, que lleva `exterior`/`interior` colgando de sí mismo.
 *
 * @returns {object[]}  Vacío si no hay ninguna (ya anotado).
 */
function carasDe(ctx, ref, superficie) {
  if (superficie.local === 'Polygon') return [superficie]

  const patches = hijo(superficie, NS.gml, 'patches')
  const caras = patches === null ? [] : hijos(patches, NS.gml, 'PolygonPatch')
  if (caras.length === 0) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.POSLIST_INVALIDA,
      'el «gml:Surface» no contiene ningún «gml:PolygonPatch» dentro de «gml:patches»: no hay ' +
        'de dónde sacar el contorno.',
      SEVERIDAD.ERROR,
      { superficie: superficie.local },
    )
  }
  return caras
}

/**
 * Lee la geometría entera de un feature de edificio.
 *
 * @returns {{anillos: Array<Array<[number, number]>>, huecos: Array<Array<[number, number]>>}}
 */
function leerGeometria(ctx, ref, feature) {
  const vacio = { anillos: [], huecos: [] }

  const geometrias = hijos(feature, NS_BU.ext2d, 'geometry')
  if (geometrias.length === 0) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.POSLIST_INVALIDA,
      'la construcción no trae «bu-ext2d:geometry»: no hay coordenadas que leer. OJO al ' +
        'namespace — el contenedor exterior es de `bu-ext2d`, no de `bu-core2d`.',
      SEVERIDAD.ERROR,
      { falta: 'geometry' },
    )
    return vacio
  }
  if (geometrias.length > 1) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.MULTIPLES_CARAS,
      `trae ${geometrias.length} «bu-ext2d:geometry». Una construcción tiene UNA geometría; ` +
        'con varias no se puede saber cuál es la buena, y quedarse con la primera sería elegir ' +
        'por el usuario.',
      SEVERIDAD.ERROR,
      { geometrias: geometrias.length },
    )
    return vacio
  }

  const superficie = superficieDe(ctx, ref, geometrias[0])
  if (superficie === null) return vacio
  recogerSrsName(ctx, superficie, `${ref.donde} · gml:${superficie.local}`)

  const caras = carasDe(ctx, ref, superficie)
  if (caras.length === 0) return vacio

  const anillos = []
  const huecos = []
  caras.forEach((cara, j) => {
    const etiqueta = superficie.local === 'Polygon' ? 'gml:Polygon' : `gml:PolygonPatch[${j}]`
    const exteriores = hijos(cara, NS.gml, 'exterior')
    if (exteriores.length === 0) {
      anotaEn(
        ctx,
        ref,
        TIPO_GML.POSLIST_INVALIDA,
        `${etiqueta}: no trae «gml:exterior»: sin anillo exterior no hay contorno.`,
        SEVERIDAD.ERROR,
        { cara: etiqueta, falta: 'exterior' },
      )
      return
    }
    if (exteriores.length > 1) {
      anotaEn(
        ctx,
        ref,
        TIPO_GML.MULTIPLES_CARAS,
        `${etiqueta}: trae ${exteriores.length} «gml:exterior» y una cara tiene UNO; los demás ` +
          'recintos van como «gml:interior» (huecos). Se lee el primero.',
        SEVERIDAD.ERROR,
        { cara: etiqueta, exteriores: exteriores.length },
      )
    }
    const vertices = leerAnillo(ctx, ref, exteriores[0], `${etiqueta}/gml:exterior`)
    if (vertices !== null) anillos.push(vertices)

    hijos(cara, NS.gml, 'interior').forEach((nodo, k) => {
      const v = leerAnillo(ctx, ref, nodo, `${etiqueta}/gml:interior[${k}]`)
      if (v !== null) huecos.push(v)
    })
  })

  // N patches por Surface es NORMAL en edificio (el Building de la parcela de
  // referencia trae DOS, de 5 y 53 puntos) y por eso esto es INFO y no el ERROR
  // que emite `gml/parse.js` — allí varias caras significan multiparcela, que
  // está fuera de alcance. Se dice igual, porque quien lea `anillos[0]` creyendo
  // que ahí está todo el contorno se deja el 91% de los puntos fuera.
  if (caras.length > 1) {
    anotaEn(
      ctx,
      ref,
      TIPO_GML.MULTIPLES_CARAS,
      `el «gml:Surface» trae ${caras.length} «gml:PolygonPatch» y se leen TODOS ` +
        `(${anillos.map((a) => a.length).join(' + ')} vértices). En un edificio eso es normal ` +
        'y no un defecto: quedarse con el primero perdería el resto en silencio.' +
        (huecos.length > 0
          ? ` ⚠️ Además hay ${huecos.length} «gml:interior»: al venir los huecos en una lista ` +
            'aparte, con más de un patch se pierde a cuál pertenece cada uno.'
          : ''),
      huecos.length > 0 ? SEVERIDAD.AVISO : SEVERIDAD.INFO,
      { caras: caras.length, vertices: anillos.map((a) => a.length), huecos: huecos.length },
    )
  }

  return { anillos, huecos }
}

// ── Los tres tipos de feature ─────────────────────────────────────────────────

/** Lo común a los tres: identidad y geometría. */
function leerComun(ctx, ref, feature) {
  const nils = {}
  const boundedBy = hijo(feature, NS.gml, 'boundedBy')
  const envelope = boundedBy === null ? null : hijo(boundedBy, NS.gml, 'Envelope')
  // Del `gml:boundedBy` solo se aprovecha el `srsName`, para el cotejo de
  // coherencia: la envolvente en sí es redundante —se deduce del propio
  // `posList`— y el modelo de edificio no tiene campo donde guardarla.
  if (envelope !== null) recogerSrsName(ctx, envelope, `${ref.donde} · gml:Envelope`)

  return {
    gmlId: atributo(feature, NS.gml, 'id'),
    localId: leerLocalId(feature),
    refcat: leerRefcat(feature),
    ...leerGeometria(ctx, ref, feature),
    nils,
  }
}

/** `bu-ext2d:Building` → {@link EdificioBu}. */
function leerEdificio(ctx, ref, feature) {
  const comun = leerComun(ctx, ref, feature)
  const { nils } = comun

  const fecha = hijo(feature, NS_BU.core2d, 'dateOfConstruction')
  const evento = fecha === null ? null : hijo(fecha, NS_BU.core2d, 'DateOfEvent')

  const officialArea = hijos(feature, NS_BU.ext2d, 'officialArea').map((oa) => {
    const bloque = hijo(oa, NS_BU.ext2d, 'OfficialArea') ?? oa
    const valorNodo = hijo(bloque, NS_BU.ext2d, 'value')
    return {
      referencia: valorTexto(hijo(bloque, NS_BU.ext2d, 'officialAreaReference'), nils),
      valor: valorNumero(ctx, ref, valorNodo, nils, 'bu-ext2d:value'),
      uom: valorNodo === null ? null : atributo(valorNodo, SIN_NAMESPACE, 'uom'),
    }
  })

  return {
    ...comun,
    // `bu-core2d`, no `bu-ext2d`: es el ÚNICO sitio del documento donde el estado
    // de conservación tiene valor (en las trece partes viene `xsi:nil`).
    conditionOfConstruction: valorTexto(
      hijo(feature, NS_BU.core2d, 'conditionOfConstruction'),
      nils,
    ),
    // Y de aquí abajo, todo `bu-ext2d`.
    currentUse: valorTexto(hijo(feature, NS_BU.ext2d, 'currentUse'), nils),
    numberOfBuildingUnits: valorNumero(
      ctx,
      ref,
      hijo(feature, NS_BU.ext2d, 'numberOfBuildingUnits'),
      nils,
      'bu-ext2d:numberOfBuildingUnits',
    ),
    numberOfDwellings: valorNumero(
      ctx,
      ref,
      hijo(feature, NS_BU.ext2d, 'numberOfDwellings'),
      nils,
      'bu-ext2d:numberOfDwellings',
    ),
    numberOfFloorsAboveGround: valorNumero(
      ctx,
      ref,
      hijo(feature, NS_BU.ext2d, 'numberOfFloorsAboveGround'),
      nils,
      'bu-ext2d:numberOfFloorsAboveGround',
    ),
    dateOfConstruction:
      evento === null
        ? null
        : {
            beginning: valorTexto(hijo(evento, NS_BU.core2d, 'beginning'), nils),
            end: valorTexto(hijo(evento, NS_BU.core2d, 'end'), nils),
          },
    officialArea,
  }
}

/** `bu-ext2d:BuildingPart` → {@link ParteBu}. */
function leerParte(ctx, ref, feature) {
  const comun = leerComun(ctx, ref, feature)
  const { nils } = comun
  const altura = hijo(feature, NS_BU.ext2d, 'heightBelowGround')

  return {
    ...comun,
    // LAS TRECE traen las dos plantas, no solo `part10` (T0.2·6). F11 las declara
    // `null` por alcance en el modelo, pero el dato SALE de aquí crudo: tirarlo en
    // el lector obligaría a reabrirlo en F12.
    numberOfFloorsAboveGround: valorNumero(
      ctx,
      ref,
      hijo(feature, NS_BU.ext2d, 'numberOfFloorsAboveGround'),
      nils,
      'bu-ext2d:numberOfFloorsAboveGround',
    ),
    numberOfFloorsBelowGround: valorNumero(
      ctx,
      ref,
      hijo(feature, NS_BU.ext2d, 'numberOfFloorsBelowGround'),
      nils,
      'bu-ext2d:numberOfFloorsBelowGround',
    ),
    heightBelowGround: valorNumero(ctx, ref, altura, nils, 'bu-ext2d:heightBelowGround'),
    heightBelowGroundUom: altura === null ? null : atributo(altura, SIN_NAMESPACE, 'uom'),
    conditionOfConstruction: valorTexto(
      hijo(feature, NS_BU.core2d, 'conditionOfConstruction'),
      nils,
    ),
  }
}

/** `bu-ext2d:OtherConstruction` → {@link OtraBu}. */
function leerOtra(ctx, ref, feature) {
  const comun = leerComun(ctx, ref, feature)
  const { nils } = comun
  return {
    ...comun,
    constructionNature: valorTexto(hijo(feature, NS_BU.ext2d, 'constructionNature'), nils),
    conditionOfConstruction: valorTexto(
      hijo(feature, NS_BU.core2d, 'conditionOfConstruction'),
      nils,
    ),
  }
}

// ── Documento ─────────────────────────────────────────────────────────────────

/** El `encoding` del prólogo, y su aviso si no es UTF-8. */
function revisarEncoding(ctx, declaracion) {
  const declarado = declaracion?.encoding ?? null
  if (declarado === null) return
  if (ENCODINGS_UTF8.includes(declarado.trim().toLowerCase())) return
  anota(
    ctx,
    TIPO_GML.ENCODING_DECLARADO,
    `El fichero declara «encoding=${JSON.stringify(declarado)}» en el prólogo. Se ha leído con ` +
      'el texto que se le ha pasado a este módulo, que NO transcodifica nada; los GML de ' +
      'edificio del Catastro declaran ISO-8859-1 y sus bytes suelen ser otra cosa. ' +
      'Compruébalo si ves acentos rotos.',
    SEVERIDAD.AVISO,
    { encodingDeclarado: declarado },
  )
}

/** Convierte los errores del lector XML en detecciones, con tope. */
function volcarErroresXml(ctx, errores) {
  for (const e of errores.slice(0, MAX_ERRORES_XML_BU)) {
    anota(
      ctx,
      TIPO_GML.XML_MAL_FORMADO,
      `Línea ${e.linea}, columna ${e.columna}: ${e.mensaje}`,
      SEVERIDAD.ERROR,
      { linea: e.linea, columna: e.columna },
    )
  }
  if (errores.length > MAX_ERRORES_XML_BU) {
    anota(
      ctx,
      TIPO_GML.XML_MAL_FORMADO,
      `…y ${errores.length - MAX_ERRORES_XML_BU} problema(s) de XML más, que no se detallan ` +
        `para no sepultar el resto del informe (tope: ${MAX_ERRORES_XML_BU}). Arregla los de ` +
        'arriba y vuelve a abrirlo.',
      SEVERIDAD.ERROR,
      { total: errores.length, detallados: MAX_ERRORES_XML_BU },
    )
  }
}

/**
 * `gml:id` de la raíz del `wfsBU`. Medido idéntico en los cinco ficheros reales,
 * incluida la colección vacía, y distinto del de la rama de parcela
 * (`ES.SDGC.CP` / `ES.LOCAL.CP`). Es el desempate de {@link clasificar} y nada
 * más: en cuanto hay un feature dentro, manda su namespace.
 */
export const ID_RAIZ_BU = 'ES.SDGC.BU'

/**
 * Clasifica el documento con la MISMA tabla que `gml/parse.js`. La raíz sola no
 * distingue el CP 3.0 del edificio (los dos son `gml:FeatureCollection` con
 * `gml:featureMember`), así que hace falta el namespace del elemento de feature;
 * si con ese dato no casa nada se reintenta sin él.
 *
 * ⚠️ Con la COLECCIÓN VACÍA no hay feature del que sacar el namespace, y la raíz
 * `gml:FeatureCollection` es ambigua entre tres dialectos ⇒ `clasificarDialecto`
 * devuelve DESCONOCIDO, y hacía bien. Aquí se desempata con el `gml:id` de la
 * raíz, que en los cinco ficheros del `wfsBU` vale `'ES.SDGC.BU'`: es el único
 * rastro del tema que queda en un documento sin contenido, y sin él el punto de
 * partida de la obra nueva se leería como «fichero desconocido».
 */
function clasificar(raiz) {
  const featureNs = raiz.hijos[0]?.hijos[0]?.ns ?? null
  const conFeature = clasificarDialecto({ ns: raiz.ns, local: raiz.local, featureNs })
  if (conFeature.id !== DIALECTO.DESCONOCIDO) return conFeature

  const sinFeature = clasificarDialecto({ ns: raiz.ns, local: raiz.local })
  if (sinFeature.id !== DIALECTO.DESCONOCIDO) return sinFeature

  const gmlId = atributo(raiz, NS.gml, 'id')
  if (raiz.hijos.length === 0 && gmlId === ID_RAIZ_BU) return DIALECTO_BU
  return sinFeature
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Lee un GML de EDIFICIO (dialecto `DIALECTO.BU`): el que devuelve el `wfsBU` del
 * Catastro y el que trae el técnico descargado de ahí.
 *
 * NO LANZA por un fichero malo: todo lo que esté mal en el documento sale por
 * `detecciones`, y si ni siquiera es un GML de edificio sale por `{ok:false,
 * motivo}` (regla de oro 1). El único `throw` es por contrato roto del
 * programador.
 *
 * @param {string} xml  Documento GML COMPLETO, **ya decodificado** a string. Este
 *   módulo no toca bytes ni encodings; sí informa del `encoding` DECLARADO.
 * @param {object} [opciones]  Reservado. Hoy no hay ninguna opción: el parámetro
 *   existe por simetría con `gml/parse.js#parsearGml` y para que añadir la primera
 *   no cambie la firma. Se valida igualmente, para que una llamada con algo que
 *   no es un objeto no se ignore en silencio.
 * @returns {ResultadoParseGmlBu}
 * @throws {TypeError}  Si `xml` no es un string o `opciones` no es un objeto plano.
 */
export function parsearGmlBu(xml, opciones = {}) {
  if (typeof xml !== 'string') {
    throw new TypeError(
      `parsearGmlBu: 'xml' debe ser el documento GML como string YA DECODIFICADO; recibido ` +
        `${typeof xml}. Un GML mal formado o de otro tema NO se señala con excepción: sale en ` +
        '`ok: false` con su `motivo`, y en la lista `detecciones`.',
    )
  }
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `parsearGmlBu: 'opciones' debe ser un objeto plano o estar ausente; recibido ` +
        `${JSON.stringify(opciones)}.`,
    )
  }

  const ctx = crearContexto()
  const { raiz, declaracion, errores } = parsearXml(xml)
  revisarEncoding(ctx, declaracion)
  volcarErroresXml(ctx, errores)

  /** Cierra el resultado resolviendo el SRS al final, con todo ya observado. */
  const cerrar = ({ ok, motivo, dialecto, edificio = null, partes = [], otras = [], nMiembros = 0 }) => {
    const { srs, srsName } = ok
      ? resolverSrs(ctx, nMiembros > 0)
      : { srs: null, srsName: null }
    return {
      ok,
      motivo: motivo ?? null,
      dialecto: dialecto.id,
      srs,
      srsName,
      edificio,
      partes,
      otras,
      nMiembros,
      detecciones: ctx.detecciones,
    }
  }

  if (raiz === null) {
    // Documento vacío o irrecuperable: `volcarErroresXml` ya ha dicho por qué.
    return cerrar({
      ok: false,
      motivo:
        'El fichero no es XML utilizable: no se ha podido leer ni el elemento raíz. Mira las ' +
        'detecciones de tipo XML_MAL_FORMADO, que traen línea y columna.',
      dialecto: clasificarDialecto({ local: '' }),
    })
  }

  const dialecto = clasificar(raiz)

  if (dialecto.id === DIALECTO.DESCONOCIDO) {
    anota(
      ctx,
      TIPO_GML.RAIZ_INESPERADA,
      `La raíz del documento es «${raiz.local}» en el namespace ` +
        `${raiz.ns === '' ? '(ninguno)' : JSON.stringify(raiz.ns)}, que no corresponde a ningún ` +
        'GML conocido. Un GML de edificio del Catastro es una «gml:FeatureCollection» de GML ' +
        `3.2 con «gml:featureMember» y features en ${JSON.stringify(NS_BU.ext2d)}.`,
      SEVERIDAD.ERROR,
      { ns: raiz.ns, local: raiz.local, featureNs: raiz.hijos[0]?.hijos[0]?.ns ?? null },
    )
    return cerrar({
      ok: false,
      motivo: 'Este fichero no es un GML reconocible: su raíz no es ninguna FeatureCollection conocida.',
      dialecto,
    })
  }

  if (dialecto.id !== DIALECTO.BU) {
    // El espejo exacto de `gml/parse.js:1135-1147`, en la otra dirección: no es un
    // fichero equivocado, es OTRO TEMA. Se dice qué es y se para, sin fingir que
    // de una parcela sale un edificio.
    anota(
      ctx,
      TIPO_GML.DIALECTO_OTRO_TEMA,
      `Esto es un GML de PARCELA, no de edificio: ${dialecto.motivo} Para leer una parcela usa ` +
        '`parsearGml`, que es el lector de la otra rama; aquí solo se leen construcciones ' +
        '(Building, BuildingPart y OtherConstruction).',
      SEVERIDAD.ERROR,
      { dialecto: dialecto.id, featureNs: dialecto.featureNs },
    )
    return cerrar({
      ok: false,
      motivo: 'Este fichero es un GML de parcela, no de edificio.',
      dialecto,
      nMiembros: hijos(raiz, dialecto.miembro.ns, dialecto.miembro.local).length,
    })
  }

  const miembros = hijos(raiz, dialecto.miembro.ns, dialecto.miembro.local)

  if (miembros.length === 0) {
    // ⭐ INFO, no ERROR (y ahí está la diferencia con `gml/parse.js`): medido el
    // 2026-08-03, el `wfsBU` contesta 200 OK con una colección vacía cuando la
    // parcela no tiene construcciones de ese tipo, y en el flujo de edificio —a
    // menudo obra nueva— ése es el punto de partida, no una avería.
    anota(
      ctx,
      TIPO_GML.SIN_MIEMBROS,
      'La «FeatureCollection» no contiene ningún «gml:featureMember»: el documento está bien ' +
        'formado y dice que ahí no hay ninguna construcción registrada. **No es un error**: en ' +
        'obra nueva es exactamente el punto de partida.',
      SEVERIDAD.INFO,
      { miembro: dialecto.miembro.local },
    )
  }

  let edificio = null
  const edificiosDeMas = []
  const partes = []
  const otras = []

  miembros.forEach((miembroNodo, i) => {
    const feature = miembroNodo.hijos[0] ?? null
    const ref = {
      miembro: i,
      donde: `featureMember nº ${i + 1}${feature === null ? '' : ` (${feature.local})`}`,
    }
    if (feature === null) {
      anota(
        ctx,
        TIPO_GML.RAIZ_INESPERADA,
        `El «gml:featureMember» nº ${i + 1} está vacío: no contiene ninguna construcción.`,
        SEVERIDAD.ERROR,
        { miembro: i },
      )
      return
    }
    if (feature.ns !== NS_BU.ext2d) {
      anota(
        ctx,
        TIPO_GML.RAIZ_INESPERADA,
        `Dentro del «gml:featureMember» nº ${i + 1} hay un «${feature.local}» del namespace ` +
          `${JSON.stringify(feature.ns)}, y las construcciones de este dialecto van en ` +
          `${JSON.stringify(NS_BU.ext2d)}.`,
        SEVERIDAD.ERROR,
        { miembro: i, local: feature.local, ns: feature.ns },
      )
      return
    }
    switch (feature.local) {
      case FEATURE_BU.BUILDING:
        if (edificio === null) edificio = leerEdificio(ctx, ref, feature)
        else edificiosDeMas.push(i)
        return
      case FEATURE_BU.BUILDING_PART:
        partes.push(leerParte(ctx, ref, feature))
        return
      case FEATURE_BU.OTHER_CONSTRUCTION:
        otras.push(leerOtra(ctx, ref, feature))
        return
      default:
        anota(
          ctx,
          TIPO_GML.RAIZ_INESPERADA,
          `Dentro del «gml:featureMember» nº ${i + 1} se esperaba una construcción ` +
            `(${Object.values(FEATURE_BU).join(', ')}) y hay «${feature.local}». Se deja fuera: ` +
            'este lector no sabe qué es y adivinarlo sería inventárselo.',
          SEVERIDAD.ERROR,
          { miembro: i, local: feature.local, conocidos: Object.values(FEATURE_BU) },
        )
    }
  })

  if (edificiosDeMas.length > 0) {
    anota(
      ctx,
      TIPO_GML.VARIOS_MIEMBROS,
      `El fichero trae ${edificiosDeMas.length + 1} «bu-ext2d:Building». Un edificio del ` +
        'Catastro es UNO por referencia catastral, así que en `edificio` va el primero y los ' +
        `demás (miembros ${edificiosDeMas.map((n) => n + 1).join(', ')}) se quedan fuera. Si el ` +
        'fichero mezcla varias parcelas, sepáralas antes.',
      SEVERIDAD.AVISO,
      { edificios: edificiosDeMas.length + 1, fuera: edificiosDeMas },
    )
  }

  return cerrar({ ok: true, dialecto, edificio, partes, otras, nMiembros: miembros.length })
}

/**
 * Recuentos de las detecciones de un resultado, en la misma forma que
 * `parsers/importar.js#resumen.detecciones` y `gml/parse.js`. Sale como función y
 * no como campo del resultado porque el contrato C fija la superficie y no lo
 * incluye: quien lo quiera lo pide, y quien no, no lo paga.
 *
 * @param {ResultadoParseGmlBu} resultado
 * @returns {{total: number, porTipo: object, porSeveridad: object}}
 * @throws {TypeError}  Si `resultado` no trae una lista de detecciones.
 */
export function resumirDeteccionesBu(resultado) {
  if (resultado === null || typeof resultado !== 'object' || !Array.isArray(resultado.detecciones)) {
    throw new TypeError(
      `resumirDeteccionesBu: se esperaba el resultado de parsearGmlBu; recibido ` +
        `${JSON.stringify(resultado)}.`,
    )
  }
  return contarDetecciones(resultado.detecciones)
}

/**
 * Los tipos de detección de severidad ERROR de un resultado, sin repetir: por qué
 * este fichero no se puede dar por bueno tal como está. Derivado de las propias
 * detecciones y no de una lista escrita a mano, así que no puede haber un ERROR
 * que no bloquee ni un bloqueo sin su explicación.
 *
 * ⚠️ **Devuelve tipos de {@link TIPO_GML}, y HOY NO LA LLAMA NADIE fuera de sus
 * tests.** Esta ficha decía antes que «es lo que `edificio/entrada.js` mete en
 * `resumen.bloqueos`», y era falso —y además irrealizable—: el `resumen.bloqueos`
 * del contrato D se rellena con `edificio/_comun.js#MOTIVO_ENTRADA`, un catálogo
 * CERRADO de cinco códigos que un test-guarda ata, y volcar aquí un `TIPO_GML`
 * lo abriría a los ~30 tipos de este lector. Lo que `edificio/entrada.js` hace de
 * verdad es traducir: un documento que no es BU sale como `DIALECTO_NO_BU` y uno
 * sin miembros como `SIN_CONSTRUCCION`, y las detecciones originales viajan
 * enteras en la lista, que es donde vive el detalle.
 *
 * Se conserva porque es la forma barata de contestar «¿por qué no se puede dar
 * por bueno este fichero?» sin recorrer las detecciones a mano —los tests de este
 * módulo la usan justo para eso—, y porque el consumidor natural está a la vista:
 * cuando F12 o F14 enseñen el detalle de un GML de edificio rechazado, es esto lo
 * que necesitan. Si llegado el momento sigue sin llamante, se borra entonces.
 *
 * @param {ResultadoParseGmlBu} resultado
 * @returns {string[]}
 * @throws {TypeError}  Si `resultado` no trae una lista de detecciones.
 */
export function bloqueosBu(resultado) {
  if (resultado === null || typeof resultado !== 'object' || !Array.isArray(resultado.detecciones)) {
    throw new TypeError(
      `bloqueosBu: se esperaba el resultado de parsearGmlBu; recibido ` +
        `${JSON.stringify(resultado)}.`,
    )
  }
  return [
    ...new Set(
      resultado.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR).map((d) => d.tipo),
    ),
  ]
}

export default parsearGmlBu

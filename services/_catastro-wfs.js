// services/_catastro-wfs.js — F05 · T1B. EL DIALECTO del WFS de parcelas del
// Catastro: cómo se le pregunta, y cómo se lee lo que contesta.
//
// Este módulo NO hace red. No hay `fetch`, ni cola, ni reintentos, ni caché, ni
// reloj: eso es `services/_red.js` y `services/catastro.js`. Aquí solo hay dos
// cosas, las dos PURAS — construir la URL exacta que el servicio entiende, y
// clasificar el CUERPO que devuelve. Separarlo así es lo que permite probar el
// dialecto ENTERO contra los ficheros reales de `test/fixtures/catastro/` sin
// tocar la red ni una vez; y como la política de uso del Catastro sanciona el uso
// automático con denegación de servicio ~10 días (override O8 de `spec/SPEC.md`),
// «probarlo contra el servicio» no es una alternativa disponible.
//
// El guion bajo del nombre dice que esto es INTERIOR de `services/`: el punto
// ÚNICO de contacto público con el Catastro es `services/catastro.js` (spec F05).
// Este módulo es su gramática, no su boca.
//
// ═════════════════════════════════════════════════════════════════════════════
// HECHOS VERIFICADOS CONTRA EL SERVICIO REAL — 8 peticiones con `curl` el
// 2026-07-27, una por caso, documentadas con su URL, su SHA-256 y su cuerpo en
// `test/fixtures/catastro/PROCEDENCIA.md`. Ese documento MANDA sobre cualquier
// otra documentación (regla de oro 8) y sobre lo que diga la spec de F05.
// ═════════════════════════════════════════════════════════════════════════════
//
// (a) **EL ERROR LLEGA CON HTTP 200.** Las 8 respuestas —las buenas, la de
//     referencia inexistente, la de caja vacía y las dos de parámetros mal
//     puestos— devolvieron `200 OK`. `response.ok` es `true` SIEMPRE y no
//     clasifica nada en este servicio: la clasificación se hace LEYENDO EL
//     CUERPO, que es justo lo que hace este módulo. Un cliente que haga
//     `if (!res.ok) throw` y dé por buena la rama contraria tratará un
//     `ExceptionReport` como si fuera una parcela.
//
// (b) **NINGUNA RAÍZ LLEVA PREFIJO.** El servicio declara el namespace POR
//     DEFECTO y escribe `<ExceptionReport xmlns="…/ows/1.1">` y
//     `<FeatureCollection xmlns="…/wfs/2.0">` a secas. Un olfateo de
//     `<ows:ExceptionReport` NO lo vería nunca. La discriminación es por
//     **namespace + nombre local**, jamás por prefijo. Ver {@link esExceptionReport}.
//
// (c) **NO EXISTE LA «COLECCIÓN VACÍA».** Medido: una caja BBOX sin parcelas
//     devuelve un `ExceptionReport` con EXACTAMENTE el mismo
//     `exceptionCode="OperationProcessingFailed"` que una referencia catastral
//     inexistente. Lo ÚNICO que los distingue es el texto libre del `CDATA`, que
//     además viene en dos idiomas y con una errata del propio servicio
//     («No records *founded*»). Consecuencias, y son el corazón de este módulo:
//       · `OperationProcessingFailed` es un CAJÓN DE SASTRE y se traduce a
//         {@link TIPO_RESPUESTA_WFS.NO_ENCONTRADO}, venga de donde venga.
//       · **Está PROHIBIDO ramificar sobre el texto del `CDATA`.** Se arrastra
//         íntegro en `detalle` como dato presentable y no se analiza nunca. Un
//         `if (detalle.includes('parcela'))` sería un guardián que se rompe solo
//         el día que el Catastro corrija su errata o traduzca el mensaje, y se
//         rompería EN VERDE: seguiría devolviendo una rama, la equivocada.
//     Esto CORRIGE a `spec/feature-05-catastro-vivo.md`, que dice «el WFS puede
//     devolver `ExceptionReport` o feature vacía». La feature vacía no existe.
//
// (d) **LOS DOS ATRIBUTOS DE CONTEO MIENTEN.** Medido en `wfs-bbox-count10.xml`:
//     con `count=10` el cuerpo trae **10** `<member>` y tanto `numberMatched`
//     como `numberReturned` declaran **539**. `numberReturned` debería ser, por
//     la especificación WFS 2.0, el número de elementos DE ESA RESPUESTA. No se
//     entera de que la respuesta está truncada. Por eso este módulo **cuenta los
//     miembros contándolos** (`nMiembros`, que sale de `gml/parse.js`) y expone
//     los atributos bajo la clave `declarado`, cuyo nombre dice lo que son: lo
//     que el servicio DECLARA, no lo que hay. Nadie debe paginar ni dibujar un
//     contador con ellos.
//
// (e) **NO HAY NINGUNA *STORED QUERY* DE BBOX.** El catálogo completo, dicho por
//     el propio servicio en `wfs-describestoredqueries.xml`, son cinco:
//     `GetParcel`, `GetFeatureById`, `GetNeighbourParcel`, `GetZoning` y
//     `GetParcelByZoning`. `spec/feature-05-catastro-vivo.md` lista
//     `getParcelsByBBox(bbox, srs)` en una enumeración donde las demás SÍ tienen
//     su *stored query* una a una, y la simetría invita a buscar un
//     `GetParcelsByBBox` que **NO EXISTE**. El BBOX se hace con `GetFeature`
//     ESTÁNDAR + `typenames=cp:CadastralParcel` + `bbox=…`. Ver {@link urlBbox}.
//
// (f) **`GetNeighbourParcel` DEVUELVE TAMBIÉN LA PROPIA PARCELA**, y no la
//     primera: en el fixture medido está en segunda posición de cinco. Aquí NO se
//     separa —este módulo dice cuántos miembros vienen y quiénes son, nada más—;
//     filtrarla por referencia catastral es trabajo de `services/catastro.js`.
//
// ── FRONTERA DE ERRORES (SPEC §2.1, la misma que trazan `gml/parse.js` y
//    `gml/xml.js`) ────────────────────────────────────────────────────────────
//   · **Contrato roto por el PROGRAMADOR** → `throw TypeError`/`RangeError`. Un
//     `refcat` que no es string, un `srs` que no es un huso soportado, un BBOX
//     degenerado o invertido: eso es un bug, no hay dato de usuario que avisar y
//     lo que hace falta es verlo.
//   · **Respuesta rara del SERVICIO** → objeto de estado con su `tipo`, NUNCA una
//     excepción. Un `ExceptionReport`, un XML ilegible o un GML de otro tema son
//     respuestas normales de un servicio ajeno: la capa de arriba tiene que poder
//     decidir qué enseña.
//   Este módulo **no define `MOTIVO_CATASTRO`** (eso es de `services/catastro.js`,
//   que es quien habla con la UI): devuelve su propio {@link TIPO_RESPUESTA_WFS} y
//   deja la traducción a la capa que la necesita.
//
// Sin dependencias externas: solo `geo/huso.js` (validación del SRS, delegada),
// `gml/xml.js` (el lector XML propio del proyecto — `DOMParser` NO existe en el
// proyecto Vitest `node`) y `gml/parse.js` (lector de GML de parcela). Ni
// Leaflet, ni Turf, ni proj4: corre igual en la suite `node` y en el navegador.
// Su test es `test/services/catastro-wfs.test.js`, SIN sufijo `.dom`.

import { husoPorSrs } from '../geo/huso.js'
import { DIALECTO } from '../gml/_comun.js'
import { parsearGml } from '../gml/parse.js'
import { SIN_NAMESPACE, atributo, hijos, parsearXml, texto } from '../gml/xml.js'

// ── Constantes del servicio ───────────────────────────────────────────────────

/**
 * Endpoint ÚNICO del WFS INSPIRE de parcela catastral (`wfsCP.aspx`).
 *
 * Es la constante base única que pide la regla de oro 7 y el override O7: si
 * algún día el Catastro retira `Access-Control-Allow-Origin: *` —hoy VERIFICADO
 * en las 8 respuestas medidas—, se apunta esta cadena a un proxy **en un solo
 * sitio** y ni `services/catastro.js` ni la UI se enteran. Nadie más debe
 * escribir esta URL, exactamente igual que con
 * `viewer/wms-catastro.js#CATASTRO_WMS`.
 *
 * ⚠️ Matiz medido que conviene no perder: `ACAO: *` es la ÚNICA cabecera CORS
 * presente (no hay `-Headers` ni `-Methods`), así que solo la petición SIMPLE
 * está respaldada. Quien añada cabeceras propias forzará un *preflight* `OPTIONS`
 * del que no hay ninguna medición, y `credentials: 'include'` es incompatible con
 * el comodín. Eso es de `services/_red.js`, pero se anota aquí porque es de este
 * endpoint.
 */
export const CATASTRO_WFS_CP = 'https://ovc.catastro.meh.es/INSPIRE/wfsCP.aspx'

/**
 * Las *stored queries* que ESTE módulo usa, con su `id` tal como el servicio lo
 * publica. Congelado y **corto a propósito**: solo lo que se construye de verdad.
 *
 * De dónde salen (regla de oro 8): del catálogo que devuelve el propio servicio,
 * versionado en `test/fixtures/catastro/wfs-describestoredqueries.xml`. El
 * catálogo completo son CINCO —`GetParcel`, `GetFeatureById`,
 * `GetNeighbourParcel`, `GetZoning` y `GetParcelByZoning`—; las tres que no
 * aparecen aquí existen y sencillamente todavía no se piden desde este módulo.
 * `test/services/catastro-wfs.test.js` comprueba las DOS mitades: que estos
 * valores son un SUBCONJUNTO de los del fichero, y que `'GetParcelsByBBox'` no
 * está en el fichero — sin la segunda mitad, un módulo que no usara ninguna
 * consulta aprobaría el test sin decir nada.
 *
 * ⛔ `GetParcelsByBBox` **NO EXISTE**. Ver el hecho (e) de la cabecera.
 *
 * @readonly
 */
export const CONSULTAS_ALMACENADAS = Object.freeze({
  /** Parcela por referencia catastral. Parámetros del servicio: REFCAT + SRSNAME. */
  PARCELA: 'GetParcel',
  /**
   * Parcelas VECINAS por referencia catastral. Mismos parámetros. Devuelve
   * también la propia parcela consultada: hecho (f) de la cabecera.
   */
  VECINDAD: 'GetNeighbourParcel',
})

/**
 * `typeNames` del `GetFeature` estándar con el que se hace el BBOX. Es el mismo
 * nombre de tipo que el catálogo declara como `returnFeatureTypes` de las
 * *stored queries* de parcela.
 */
export const TIPO_PARCELA_WFS = 'cp:CadastralParcel'

/**
 * `count` por defecto del BBOX, y el porqué de que exista un defecto.
 *
 * Medido: **la misma caja de 600 × 600 m (0,36 km², un trozo de Madrid), pedida
 * SIN `count`, devolvió 539 parcelas y ~1,15 MB.** Sobre un tercio de kilómetro
 * cuadrado. Un BBOX sin tope no es una petición grande: es una descarga masiva
 * accidental, y la descarga masiva es exactamente lo que la política de uso del
 * Catastro sanciona (override O8).
 *
 * El valor —10— es el ÚNICO que se ha medido, y por eso es el defecto: no es un
 * máximo del servicio, ni un óptimo, ni una recomendación de nadie. Es lo que
 * sabemos que funciona. Quien necesite más lo sube A SABIENDAS pasando `count`, y
 * asume que a partir de ahí está en territorio no medido.
 *
 * El test lo ATA al fichero: son los `<member>` que trae `wfs-bbox-count10.xml`.
 */
export const COUNT_BBOX_DEFECTO = 10

/**
 * Namespace del `ExceptionReport` de OWS 1.1, tal como lo declara el servicio
 * (por defecto, sin prefijo: hecho (b) de la cabecera). Es el par
 * `{namespace, nombre local}` lo que confirma una excepción, nunca la etiqueta.
 */
export const NS_OWS_1_1 = 'http://www.opengis.net/ows/1.1'

/**
 * El `exceptionCode` CAJÓN DE SASTRE del servicio. Ver el hecho (c) de la
 * cabecera: «no existe esa referencia» y «no hay ninguna parcela en esa caja»
 * llegan las dos con este código, y no hay forma contractual de distinguirlas.
 * Se tratan como una sola cosa —{@link TIPO_RESPUESTA_WFS.NO_ENCONTRADO}—, que es
 * además la lectura correcta para el usuario en los dos casos («aquí no hay lo
 * que pides»), y el texto del `CDATA` se le enseña íntegro para que sepa cuál de
 * los dos era.
 */
export const CODIGO_CAJON_DE_SASTRE = 'OperationProcessingFailed'

/**
 * Qué es una respuesta del WFS, una vez leída. Es el vocabulario de ESTE módulo:
 * `services/catastro.js` lo traducirá a su `MOTIVO_CATASTRO`, que es el que ve la
 * UI. Aquí no hay mensajes de usuario, hay clasificación.
 *
 * @readonly
 */
export const TIPO_RESPUESTA_WFS = Object.freeze({
  /** Colección de parcelas CP 4.0 leída. Trae `parcelas`, `nMiembros` y `declarado`. */
  PARCELAS: 'PARCELAS',
  /**
   * `ExceptionReport` con {@link CODIGO_CAJON_DE_SASTRE}. Cubre a la vez «esa
   * referencia no existe» y «no hay parcelas en esa caja»: el servicio no los
   * distingue (hecho (c)). NO es un fallo técnico; es un resultado.
   */
  NO_ENCONTRADO: 'NO_ENCONTRADO',
  /**
   * `ExceptionReport` con CUALQUIER OTRO `exceptionCode`. No se ha medido ninguno
   * —el servicio contestó siempre con el cajón de sastre—, así que este tipo
   * existe para no tragarse en silencio un código que no conocemos: el llamante
   * enseña el `codigo` y el `detalle` tal cual y dice que no sabe interpretarlo.
   */
  EXCEPCION: 'EXCEPCION',
  /**
   * XML legible y GML reconocible, pero NO una colección de parcelas que este
   * proyecto sepa leer (p. ej. un GML de EDIFICIO, que es otro tema y otro
   * lector — F13). Se dice qué es, en vez de devolver una colección vacía.
   */
  NO_SOPORTADO: 'NO_SOPORTADO',
  /**
   * Ni una cosa ni la otra: XML mal formado, raíz desconocida, cuerpo vacío, o un
   * olfateo de excepción que el parseo NO confirma. Ver {@link esExceptionReport}.
   */
  RESPUESTA_ILEGIBLE: 'RESPUESTA_ILEGIBLE',
})

// Forma de las dos peticiones MEDIDAS, y por qué no se unifican.
//
// `version` y `request` NO son iguales en las dos: las *stored queries* se
// midieron con `version=2` y `request=getfeature` (minúsculas), y el `GetFeature`
// con BBOX y el `DescribeStoredQueries` con `version=2.0.0` y `request=GetFeature`
// (camelCase). Es asimétrico y probablemente el servicio acepte las cuatro
// combinaciones — pero eso NO está medido. Unificarlas sería cambiar dos
// peticiones que sabemos que funcionan por dos que no hemos probado nunca, a
// cambio de estética. Se reproducen tal cual, y el test las coteja contra las URL
// literales que quedaron anotadas en `PROCEDENCIA.md`.
const PETICION_CONSULTA_ALMACENADA = Object.freeze({ version: '2', request: 'getfeature' })
const PETICION_GETFEATURE = Object.freeze({ version: '2.0.0', request: 'GetFeature' })

/**
 * Olfateo BARATO de `ExceptionReport`. Casa con prefijo y sin él —el servicio lo
 * manda sin prefijo (hecho (b)), pero un `ows:` no debe despistar al olfato—, y
 * exige que tras el nombre venga un espacio o el cierre de la etiqueta, para que
 * un hipotético `ExceptionReportLista` no lo dispare.
 *
 * SIN bandera `g`: una RegExp global guarda estado en `lastIndex` y haría que dos
 * llamadas seguidas dieran resultados distintos sobre el mismo texto.
 */
const RE_OLFATO_EXCEPCION = /<\s*(?:[A-Za-z_][\w.-]*:)?ExceptionReport[\s/>]/

// ── Typedefs del contrato ─────────────────────────────────────────────────────

/**
 * BBOX ya expresado en las unidades del SRS que se va a pedir, en orden X,Y.
 *
 * MISMA FORMA que `viewer/wms-catastro.js#BBoxProyectado`, y a propósito: es la
 * convención del proyecto para una caja proyectada, y un objeto con nombres evita
 * el clásico «¿el tercero era maxX o minY?» de una tupla. NO se importa aquel
 * typedef porque aquel módulo importa Leaflet y este tiene que correr en la suite
 * `node`.
 *
 * Este módulo **no proyecta nada y nunca reordena ejes**: 25829/25830/25831 son
 * CRS proyectados y el WFS los quiere `Xmin,Ymin,Xmax,Ymax` (así está la caja
 * medida). Quien tenga la caja en geográficas la proyecta ANTES.
 *
 * @typedef {Object} BBoxProyectado
 * @property {number} minX  Este mínimo, en metros.
 * @property {number} minY  Norte mínimo, en metros.
 * @property {number} maxX  Este máximo, en metros.
 * @property {number} maxY  Norte máximo, en metros.
 */

/**
 * Una `<Exception>` del informe, leída entera y sin interpretar.
 *
 * @typedef {Object} ExcepcionWfs
 * @property {string|null} codigo   Atributo `exceptionCode`. `null` si no viene.
 * @property {string|null} locator  Atributo `locator` (opcional en OWS). `null`.
 * @property {string[]} textos      Los `ExceptionText`, ÍNTEGROS y en orden. Es
 *   texto libre, no contractual y en dos idiomas: se muestra, no se analiza.
 */

/**
 * Una colección de parcelas leída del cuerpo.
 *
 * @typedef {Object} RespuestaParcelas
 * @property {'PARCELAS'} tipo
 * @property {import('../gml/parse.js').ParcelaGml[]} parcelas  Las que se han
 *   podido leer. Puede ser MÁS CORTA que `nMiembros` si algún `member` traía
 *   dentro algo que no era un `cp:CadastralParcel`; en ese caso hay su detección.
 * @property {number} nMiembros  Miembros CONTADOS en el documento. Es el número
 *   bueno: ver el hecho (d) de la cabecera.
 * @property {{timeStamp: string|null, numberMatched: string|null,
 *   numberReturned: string|null}} declarado  Los atributos de la raíz WFS 2.0
 *   TAL CUAL, sin convertir. Se llaman `declarado` porque es lo que el servicio
 *   DICE, no lo que hay: los dos conteos mintieron los dos en la medición. Dato
 *   informativo; no se pagina ni se cuenta con ellos.
 * @property {string} dialecto  Clave de `gml/_comun.js#DIALECTO`.
 * @property {import('../gml/_comun.js').DeteccionGml[]} detecciones  Las de
 *   `gml/parse.js`, arrastradas íntegras (regla de oro 1).
 */

/**
 * Un `ExceptionReport` leído.
 *
 * @typedef {Object} RespuestaExcepcion
 * @property {'NO_ENCONTRADO'|'EXCEPCION'} tipo
 * @property {string|null} codigo   `exceptionCode` de la PRIMERA excepción.
 * @property {string} detalle       Los `ExceptionText` de la primera excepción,
 *   unidos por salto de línea y **sin tocar**. Presentable tal cual; jamás
 *   analizable (hecho (c) de la cabecera).
 * @property {ExcepcionWfs[]} excepciones  Todas, por si vinieran varias. En la
 *   medición siempre vino una; se leen todas para no perder información.
 * @property {string|null} version  Atributo `version` de la raíz (`'2.0.0'`).
 * @property {import('../gml/xml.js').ErrorXml[]} erroresXml  Problemas del XML
 *   recuperables. Normalmente vacío; se arrastra para no callarlos.
 */

/**
 * Cuerpo que no es una colección de parcelas legible.
 *
 * @typedef {Object} RespuestaNoLegible
 * @property {'NO_SOPORTADO'|'RESPUESTA_ILEGIBLE'} tipo
 * @property {string} motivo  Por qué, en castellano y nombrando lo observado. NO
 *   es un mensaje de usuario terminado: es la explicación técnica que
 *   `services/catastro.js` envuelve.
 * @property {string|null} dialecto  Clave de `gml/_comun.js#DIALECTO` si se llegó
 *   a clasificar el documento; `null` si ni eso.
 * @property {import('../gml/_comun.js').DeteccionGml[]} detecciones  Las de
 *   `gml/parse.js` cuando hubo parseo de GML; vacío si no se llegó a él.
 * @property {import('../gml/xml.js').ErrorXml[]} erroresXml  Problemas del XML
 *   cuando el cuerpo se leyó como XML suelto; vacío si no.
 */

/**
 * Lo que devuelve {@link leerColeccion}: una de las cuatro formas, discriminada
 * por `tipo`. NUNCA una excepción por culpa del servicio.
 *
 * @typedef {RespuestaParcelas|RespuestaExcepcion|RespuestaNoLegible} RespuestaWfs
 */

// ── Validación de argumentos (contrato del PROGRAMADOR: aquí sí se lanza) ─────

/**
 * Exige un cuerpo de respuesta como string.
 *
 * @param {*} cuerpo
 * @param {string} quien  Nombre de la función que llama, para el mensaje.
 * @throws {TypeError}
 */
function exigirCuerpo(cuerpo, quien) {
  if (typeof cuerpo !== 'string') {
    throw new TypeError(
      `${quien}: 'cuerpo' debe ser el texto de la respuesta YA DECODIFICADO; recibido ` +
        `${typeof cuerpo}. Ojo con el encoding: los XML del Catastro declaran ISO-8859-1 y ` +
        'sus bytes son UTF-8 — manda la cabecera HTTP (`charset=utf-8`), que es la que ' +
        'obedece `fetch().text()`. Una respuesta RARA del servicio no se señala con ' +
        'excepción: sale con su `tipo` en el resultado.',
    )
  }
}

/**
 * Exige una referencia catastral utilizable como valor de query string.
 *
 * NO juzga su FORMA (14 alfanuméricos): eso es dato del usuario, y este módulo no
 * tiene canal para avisarle. Un `refcat` mal tecleado produce una URL legítima a
 * la que el servicio contesta {@link TIPO_RESPUESTA_WFS.NO_ENCONTRADO} —medido:
 * eso es exactamente lo que hace con `0000000XX0000X`—, que es una respuesta
 * honesta y presentable. Lo que sí se exige es que sea un string no vacío, porque
 * un `undefined` en la URL es un bug del programador.
 *
 * @param {*} refcat
 * @param {string} quien
 * @returns {string}
 * @throws {TypeError}
 */
function exigirRefcat(refcat, quien) {
  if (typeof refcat !== 'string' || refcat.length === 0) {
    throw new TypeError(
      `${quien}: 'refcat' debe ser la referencia catastral como string no vacío; recibido ` +
        `${JSON.stringify(refcat)}.`,
    )
  }
  return refcat
}

/**
 * Exige un `count` entero positivo.
 *
 * @param {*} count
 * @param {string} quien
 * @returns {number}
 * @throws {TypeError|RangeError}
 */
function exigirCount(count, quien) {
  if (typeof count !== 'number') {
    throw new TypeError(`${quien}: 'opciones.count' debe ser un número; recibido ${typeof count}.`)
  }
  if (!Number.isInteger(count) || count < 1) {
    throw new RangeError(
      `${quien}: 'opciones.count' debe ser un entero ≥ 1; recibido ${JSON.stringify(count)}. ` +
        `El defecto es ${COUNT_BBOX_DEFECTO} y no es caprichoso: la misma caja sin tope ` +
        'devolvió 539 parcelas y ~1,15 MB (ver COUNT_BBOX_DEFECTO).',
    )
  }
  return count
}

/**
 * Exige un {@link BBoxProyectado} no degenerado ni invertido.
 *
 * @param {*} bbox
 * @param {string} quien
 * @returns {BBoxProyectado}
 * @throws {TypeError|RangeError}
 */
function exigirBBox(bbox, quien) {
  if (bbox === null || typeof bbox !== 'object' || Array.isArray(bbox)) {
    throw new TypeError(
      `${quien}: 'bbox' debe ser un objeto {minX, minY, maxX, maxY} en metros del SRS ` +
        `pedido (misma forma que viewer/wms-catastro.js#BBoxProyectado); recibido ` +
        `${Array.isArray(bbox) ? 'un array' : typeof bbox}.`,
    )
  }
  for (const clave of ['minX', 'minY', 'maxX', 'maxY']) {
    if (typeof bbox[clave] !== 'number' || !Number.isFinite(bbox[clave])) {
      throw new TypeError(
        `${quien}: 'bbox.${clave}' debe ser un número finito; recibido ` +
          `${JSON.stringify(bbox[clave])}.`,
      )
    }
  }
  for (const [min, max, eje] of [['minX', 'maxX', 'X'], ['minY', 'maxY', 'Y']]) {
    if (bbox[min] >= bbox[max]) {
      throw new RangeError(
        `${quien}: BBOX degenerado o invertido en ${eje} (${min}=${bbox[min]} >= ` +
          `${max}=${bbox[max]}). La caja va en orden Xmin,Ymin,Xmax,Ymax y en metros del ` +
          'SRS: este módulo no proyecta ni reordena ejes.',
      )
    }
  }
  return { minX: bbox.minX, minY: bbox.minY, maxX: bbox.maxX, maxY: bbox.maxY }
}

// ── Construcción de URL ───────────────────────────────────────────────────────

/**
 * Forma corta del modelo → forma del query string del WFS.
 * `'EPSG:25830'` → `'EPSG::25830'`.
 *
 * **Los DOS dos puntos no son una errata.** Es la forma con la que se midieron
 * las 5 peticiones al WFS, y es la del registro EPSG con el segmento de versión
 * VACÍO (la misma convención que la URN `urn:ogc:def:crs:EPSG::25830` de
 * `gml/_comun.js#PREFIJO_SRSNAME_URN`). Un `EPSG:25830` con un solo par de puntos
 * es otra cosa para el servicio.
 *
 * Asimetría medida que conviene tener presente: se PIDE en esta forma y el
 * servicio CONTESTA con la URI OGC (`http://www.opengis.net/def/crs/EPSG/0/25830`)
 * dentro del GML. Los dos extremos del canal hablan formas distintas, y las dos
 * son legítimas.
 *
 * La validación se DELEGA en `geo/huso.js#husoPorSrs`: es el único sitio del
 * proyecto que sabe qué husos están implementados y cuál está diferido (Canarias,
 * override O13). Duplicar aquí la lista sería crear una segunda verdad que puede
 * divergir de la primera.
 *
 * @param {string} srs  Forma corta del modelo: `'EPSG:25829'|'EPSG:25830'|'EPSG:25831'`.
 * @returns {string}  La forma del query string, con doble dos puntos.
 * @throws {TypeError}   Si `srs` no es un string (lo lanza `husoPorSrs`).
 * @throws {RangeError}  Si no corresponde a un huso soportado (idem).
 */
export function srsWfs(srs) {
  // El valor de retorno no se usa: lo que interesa es que LANCE si el srs no vale.
  // Se llama igualmente para que la validación no pueda divergir de la del resto
  // del proyecto (Canarias diferida incluida).
  husoPorSrs(srs)
  return `EPSG::${srs.slice('EPSG:'.length)}`
}

/**
 * Ensambla la URL. Los valores se concatenan SIN percent-encoding en `:` y `,`
 * —caracteres legales en un query string (RFC 3986)— para que la URL sea
 * LITERALMENTE igual a la que se midió, y no una equivalente que nadie ha
 * probado. Es el mismo criterio de `viewer/wms-catastro.js#getMapUrl`.
 *
 * Lo único que se codifica es el `refcat`, que viene del usuario: para un valor
 * legítimo `encodeURIComponent` es la identidad (son alfanuméricos), y para uno
 * hostil impide que un `&` inventado añada parámetros a la petición.
 *
 * @param {Array<[string, string]>} pares  Pares `[nombre, valor]` EN EL ORDEN en
 *   que se escriben (array, no objeto: el orden es el de la petición medida).
 * @returns {string}
 */
function url(pares) {
  return `${CATASTRO_WFS_CP}?${pares.map(([n, v]) => `${n}=${v}`).join('&')}`
}

/**
 * Pares comunes a las dos *stored queries*: son idénticas salvo el `id`.
 *
 * @param {string} id      Valor de {@link CONSULTAS_ALMACENADAS}.
 * @param {string} refcat  Ya validado.
 * @param {string} srs     Forma corta del modelo, ya validada.
 * @returns {string}
 */
function urlConsultaAlmacenada(id, refcat, srs) {
  return url([
    ['service', 'wfs'],
    ['version', PETICION_CONSULTA_ALMACENADA.version],
    ['request', PETICION_CONSULTA_ALMACENADA.request],
    // `STOREDQUERIE_ID`, sin la «S» de «QUERIES». No es una errata nuestra: es el
    // nombre del parámetro con el que el servicio contestó en la medición, y el
    // que documenta la propia guía del WFS del Catastro. No se «arregla».
    ['STOREDQUERIE_ID', id],
    ['refcat', encodeURIComponent(refcat)],
    ['srsname', srsWfs(srs)],
  ])
}

/**
 * URL de la *stored query* `GetParcel`: UNA parcela por su referencia catastral.
 *
 * Es el flujo más frecuente de F05 (spec §«Carga por RC»): traer la parcela
 * oficial como punto de partida editable.
 *
 * Respuestas medidas para esta petición: el GML de parcela CP 4.0 en sobre WFS
 * (`test/fixtures/gml/cp_parcela_9398516VK3799G.gml`) cuando existe, y un
 * `ExceptionReport` con {@link CODIGO_CAJON_DE_SASTRE} cuando no
 * (`wfs-exceptionreport-rc-inexistente.xml`) — con HTTP 200 en los dos casos.
 *
 * @param {string} refcat  Referencia catastral. No se juzga su forma: ver
 *   `exigirRefcat`.
 * @param {string} srs  Forma corta del modelo (`'EPSG:25830'`). **Obligatorio y
 *   sin valor por defecto**: el huso no se adivina. `geo/huso.js#detectarHuso`
 *   avisa por escrito de que autodetectar «equivale a asumir huso 30», y poner
 *   aquí un defecto sería tomar esa decisión a espaldas del llamante. El defecto
 *   de producto (`SRS_DEFAULT` de la spec de F05) lo declara `services/catastro.js`,
 *   que es quien conoce el expediente.
 * @returns {string}  URL absoluta.
 * @throws {TypeError|RangeError}  Contrato roto por el programador.
 */
export function urlGetParcel(refcat, srs) {
  return urlConsultaAlmacenada(
    CONSULTAS_ALMACENADAS.PARCELA,
    exigirRefcat(refcat, 'urlGetParcel'),
    srs,
  )
}

/**
 * URL de la *stored query* `GetNeighbourParcel`: la parcela y sus COLINDANTES.
 *
 * ⚠️ Devuelve TAMBIÉN la parcela consultada, y no la primera (hecho (f) de la
 * cabecera: en el fixture medido está la 2ª de 5, o sea 4 colindantes reales, no
 * 5). No se puede descartar por índice; hay que filtrar por referencia catastral,
 * y eso lo hace `services/catastro.js`, no este módulo.
 *
 * @param {string} refcat  Referencia catastral de la parcela CENTRAL.
 * @param {string} srs  Forma corta del modelo. Obligatorio: ver {@link urlGetParcel}.
 * @returns {string}  URL absoluta.
 * @throws {TypeError|RangeError}  Contrato roto por el programador.
 */
export function urlGetNeighbourParcel(refcat, srs) {
  return urlConsultaAlmacenada(
    CONSULTAS_ALMACENADAS.VECINDAD,
    exigirRefcat(refcat, 'urlGetNeighbourParcel'),
    srs,
  )
}

/**
 * URL de un `GetFeature` ESTÁNDAR acotado por caja. **El BBOX no es una *stored
 * query*** (hecho (e) de la cabecera): no existe ningún `GetParcelsByBBox`, por
 * mucho que la spec de F05 lo nombre. Se pide con `typenames` + `bbox`, sin
 * `STOREDQUERIE_ID` ninguno.
 *
 * El `bbox` del WFS lleva **cinco** componentes: las cuatro coordenadas y el SRS
 * al final, en la misma forma de doble dos puntos que `srsname`. Así se midió.
 *
 * ⚠️ Si la caja no contiene ninguna parcela, la respuesta **no es una colección
 * vacía**: es un `ExceptionReport` indistinguible del de una referencia
 * inexistente (hecho (c)). Quien llame a esto tiene que estar preparado para
 * {@link TIPO_RESPUESTA_WFS.NO_ENCONTRADO} como caso NORMAL.
 *
 * @param {BBoxProyectado} bbox  Caja en metros del SRS pedido, orden X,Y.
 * @param {string} srs  Forma corta del modelo. Obligatorio: ver {@link urlGetParcel}.
 * @param {object} [opciones]
 * @param {number} [opciones.count=COUNT_BBOX_DEFECTO]  Tope de parcelas. Ver
 *   {@link COUNT_BBOX_DEFECTO} para por qué hay tope y por qué vale 10.
 * @returns {string}  URL absoluta.
 * @throws {TypeError|RangeError}  Contrato roto por el programador (bbox
 *   degenerado o invertido incluido).
 */
export function urlBbox(bbox, srs, opciones = {}) {
  if (opciones === null || typeof opciones !== 'object') {
    throw new TypeError(`urlBbox: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`)
  }
  const { count = COUNT_BBOX_DEFECTO } = opciones
  const { minX, minY, maxX, maxY } = exigirBBox(bbox, 'urlBbox')
  exigirCount(count, 'urlBbox')
  const srsPeticion = srsWfs(srs)

  return url([
    ['service', 'wfs'],
    ['version', PETICION_GETFEATURE.version],
    ['request', PETICION_GETFEATURE.request],
    ['typenames', TIPO_PARCELA_WFS],
    ['srsname', srsPeticion],
    ['bbox', [minX, minY, maxX, maxY].map(numeroBbox).join(',') + `,${srsPeticion}`],
    ['count', String(count)],
  ])
}

/**
 * Coordenada → texto para el `bbox`. `String` de un número finito nunca produce
 * separadores de miles ni comas decimales (la coma es el separador de COMPONENTES
 * del bbox: una coma decimal partiría la caja en seis trozos), y no se redondea
 * nada: la caja la fija el llamante y recortarle precisión sería moverle el
 * encuadre sin decírselo.
 *
 * El `-0` se normaliza a `0`: `String(-0)` da `'0'` en JavaScript, pero se deja
 * explícito para que nadie lo «arregle» con un `toFixed` que sí lo conserva.
 *
 * @param {number} v
 * @returns {string}
 */
function numeroBbox(v) {
  return String(Object.is(v, -0) ? 0 : v)
}

// ── Lectura del cuerpo ────────────────────────────────────────────────────────

/**
 * ¿Huele este cuerpo a `ExceptionReport`?
 *
 * **Esta función ELIGE LECTOR. No interpreta, no clasifica y no decide nada.**
 * Existe por una razón de coste: un cuerpo del WFS puede pesar 1 MB (la caja de
 * 600 m sin `count` midió ~1,15 MB) y parsearlo entero DOS VECES —una para
 * descartar que sea una excepción, otra para leer la colección— es tirar el
 * trabajo. Una RegExp sobre el texto es un recorrido lineal barato.
 *
 * Lo que esta función NO puede hacer, y por eso {@link leerExceptionReport}
 * vuelve a comprobarlo: **una RegExp no puede decidir sobre XML.** La cadena
 * podría estar dentro de un comentario o de un `CDATA`. Por eso el olfateo solo
 * encamina, y si el parseo NO confirma la raíz
 * `{http://www.opengis.net/ows/1.1, ExceptionReport}` el resultado es
 * {@link TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE} — nunca una excepción ASUMIDA a
 * partir del olfato.
 *
 * Casa con prefijo y sin él. El servicio lo manda SIN prefijo (hecho (b) de la
 * cabecera), que es justo lo que haría fallar a un `texto.includes('<ows:')`.
 *
 * @param {string} cuerpo  Texto de la respuesta, ya decodificado.
 * @returns {boolean}
 * @throws {TypeError}  Si `cuerpo` no es un string.
 */
export function esExceptionReport(cuerpo) {
  exigirCuerpo(cuerpo, 'esExceptionReport')
  return RE_OLFATO_EXCEPCION.test(cuerpo)
}

/** Construye un resultado NO_SOPORTADO/RESPUESTA_ILEGIBLE con todas sus claves. */
function noLegible(tipo, motivo, { dialecto = null, detecciones = [], erroresXml = [] } = {}) {
  return { tipo, motivo, dialecto, detecciones, erroresXml }
}

/**
 * Lee un `ExceptionReport` de OWS 1.1.
 *
 * Clasifica por el `exceptionCode` de la primera excepción y **por nada más**: el
 * texto del `CDATA` se arrastra íntegro en `detalle` y no se mira. Ver el hecho
 * (c) de la cabecera para el porqué, que es la decisión más importante de este
 * módulo.
 *
 * No lanza por un cuerpo raro: si la raíz no es la esperada devuelve
 * {@link TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE} diciendo qué se encontró.
 *
 * @param {string} cuerpo  Texto de la respuesta, ya decodificado.
 * @returns {RespuestaExcepcion|RespuestaNoLegible}
 * @throws {TypeError}  Si `cuerpo` no es un string (contrato del programador).
 */
export function leerExceptionReport(cuerpo) {
  exigirCuerpo(cuerpo, 'leerExceptionReport')
  const { raiz, errores } = parsearXml(cuerpo)

  if (raiz === null) {
    return noLegible(
      TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE,
      'La respuesta no contiene ningún elemento raíz utilizable: no es XML legible, así que ' +
        'no se puede afirmar que sea un «ExceptionReport» ni ninguna otra cosa.',
      { erroresXml: errores },
    )
  }
  if (raiz.ns !== NS_OWS_1_1 || raiz.local !== 'ExceptionReport') {
    // AQUÍ vive la trampa del olfateo: se llegó hasta este lector por una RegExp
    // y el documento NO lo confirma. No se asume la excepción.
    return noLegible(
      TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE,
      `Se esperaba un «ExceptionReport» en el namespace ${NS_OWS_1_1} y la raíz del ` +
        `documento es «${raiz.local}» en ${raiz.ns === '' ? '(ninguno)' : raiz.ns}. Si has ` +
        'llegado aquí por `esExceptionReport`, esa RegExp solo ELIGE LECTOR: una expresión ' +
        'regular no puede decidir sobre XML, y una excepción asumida sin confirmar sería ' +
        'peor que no leer nada.',
      { erroresXml: errores },
    )
  }

  const excepciones = hijos(raiz, NS_OWS_1_1, 'Exception').map((nodo) => ({
    // `exceptionCode` y `locator` van SIN prefijo, y un atributo sin prefijo NO
    // está en el namespace por defecto (XML-NS 1.0 §6.2): la trampa que documenta
    // `gml/xml.js` en su cabecera. Se piden con SIN_NAMESPACE o no se encuentran.
    codigo: atributo(nodo, SIN_NAMESPACE, 'exceptionCode'),
    locator: atributo(nodo, SIN_NAMESPACE, 'locator'),
    // `texto()` recorta y recoge también el contenido de las secciones CDATA, que
    // es como viene SIEMPRE el mensaje de este servicio.
    textos: hijos(nodo, NS_OWS_1_1, 'ExceptionText').map((t) => texto(t)),
  }))

  if (excepciones.length === 0) {
    return noLegible(
      TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE,
      'El «ExceptionReport» no contiene ninguna «Exception»: el servicio dice que ha fallado ' +
        'pero no dice qué, y no hay nada que traducir ni que enseñar al usuario.',
      { erroresXml: errores },
    )
  }

  const primera = excepciones[0]
  return {
    tipo:
      primera.codigo === CODIGO_CAJON_DE_SASTRE
        ? TIPO_RESPUESTA_WFS.NO_ENCONTRADO
        : TIPO_RESPUESTA_WFS.EXCEPCION,
    codigo: primera.codigo,
    detalle: primera.textos.join('\n'),
    excepciones,
    version: atributo(raiz, SIN_NAMESPACE, 'version'),
    erroresXml: errores,
  }
}

/**
 * Lee el cuerpo de CUALQUIER respuesta del WFS de parcelas y dice qué es.
 *
 * Es la puerta única: olfatea (barato), encamina al lector que toque y devuelve
 * siempre un {@link RespuestaWfs} con su `tipo`. **Nunca lanza por culpa del
 * servicio.**
 *
 * Los cuatro caminos, todos medidos o derivados de fixtures reales:
 *   · `ExceptionReport` → {@link leerExceptionReport}. Con el cajón de sastre,
 *     `NO_ENCONTRADO`; con otro código, `EXCEPCION`.
 *   · GML de parcela CP 4.0 → `PARCELAS`, con los miembros CONTADOS.
 *   · GML de otro dialecto conocido (edificio, CP 3.0) → `NO_SOPORTADO`. No es un
 *     fichero equivocado: es otro tema, y decirlo vale más que devolver una
 *     colección vacía que nadie sabría interpretar.
 *   · Cualquier otra cosa → `RESPUESTA_ILEGIBLE`.
 *
 * ⚠️ Por qué el olfateo no «cae hacia atrás» al lector de GML si el parseo no
 * confirma la excepción: porque volver a recorrer entero un cuerpo que ya se ha
 * descartado es la doble pasada que el olfateo existía para evitar, y porque un
 * falso positivo del olfato (la cadena `<ExceptionReport` dentro de un comentario
 * de un GML) daría `RESPUESTA_ILEGIBLE`, que es VISIBLE y arreglable, mientras
 * que un falso negativo silencioso no lo sería.
 *
 * @param {string} cuerpo  Texto de la respuesta, ya decodificado (ver
 *   `exigirCuerpo` para la trampa del encoding declarado).
 * @param {object} [opciones]
 * @param {boolean} [opciones.tolerarPolygon=true]  Se pasa tal cual a
 *   `gml/parse.js#parsearGml`. El WFS emite siempre la forma canónica
 *   `Surface/patches/PolygonPatch`, así que en la práctica da igual; existe para
 *   no cerrar la opción desde aquí.
 * @returns {RespuestaWfs}
 * @throws {TypeError}  Si `cuerpo` no es un string (contrato del programador).
 */
export function leerColeccion(cuerpo, opciones = {}) {
  exigirCuerpo(cuerpo, 'leerColeccion')
  if (opciones === null || typeof opciones !== 'object') {
    throw new TypeError(`leerColeccion: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`)
  }
  if (esExceptionReport(cuerpo)) return leerExceptionReport(cuerpo)

  const resultado = parsearGml(cuerpo, opciones)
  const { dialecto, soportado, parcelas, detecciones, resumen } = resultado

  if (!soportado) {
    // `gml/parse.js` distingue «raíz que no reconozco» de «dialecto que reconozco
    // y no leo», y esa distinción se conserva: la primera es una respuesta que no
    // entendemos (¿otro servicio?, ¿una página de error?), la segunda es un
    // fichero perfectamente válido de otro tema.
    const desconocido = dialecto === DIALECTO.DESCONOCIDO
    return noLegible(
      desconocido ? TIPO_RESPUESTA_WFS.RESPUESTA_ILEGIBLE : TIPO_RESPUESTA_WFS.NO_SOPORTADO,
      desconocido
        ? `La respuesta no es un GML de parcela reconocible: la raíz es ` +
          `${resumen.raiz === null ? '(ninguna)' : `«${resumen.raiz.local}»`}. Tampoco es un ` +
          '«ExceptionReport». Míralo tal cual antes de suponer nada: el WFS contesta con ' +
          'HTTP 200 incluso cuando falla, así que el cuerpo es lo único que informa.'
        : `La respuesta es un GML del dialecto ${dialecto}, que no es una colección de ` +
          'parcelas CP 4.0. Se dice qué es en vez de devolver una colección vacía: un GML ' +
          'de EDIFICIO tiene su propio lector (F13) y una parcela CP 3.0 es el dialecto de ' +
          '2015, que la Sede ya no admite.',
      { dialecto, detecciones },
    )
  }

  return {
    tipo: TIPO_RESPUESTA_WFS.PARCELAS,
    parcelas,
    // CONTADOS, no declarados. Ver el hecho (d) de la cabecera: los dos atributos
    // de conteo del servicio mintieron los dos en la medición.
    nMiembros: resumen.nMiembros,
    // Y aquí van esos atributos, con un nombre que dice lo que son.
    declarado: resumen.wfs,
    dialecto,
    detecciones,
  }
}

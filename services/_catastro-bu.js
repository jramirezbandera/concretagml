// services/_catastro-bu.js — F11 · T1.4. EL DIALECTO del WFS de EDIFICIOS del
// Catastro (`wfsBU.aspx`): cómo se le pregunta, y cómo se clasifica lo que
// contesta.
//
// Este módulo NO hace red. No hay `fetch`, ni cola, ni reintentos, ni caché, ni
// reloj: eso es `services/_red.js` y `services/catastro-edificio.js` (F11 · T2.2).
// Aquí solo hay dos cosas, las dos PURAS — construir la URL exacta que el
// servicio entiende, y clasificar lo OBSERVADO (estado HTTP + cuerpo). Separarlo
// así es lo que permite probar el dialecto ENTERO contra los ficheros reales de
// `test/fixtures/catastro/` sin tocar la red ni una vez; y como la política de uso
// del Catastro sanciona el uso automático con denegación de servicio ~10 días
// (override O8 de `spec/SPEC.md`), «probarlo contra el servicio» no es una
// alternativa disponible.
//
// El guion bajo del nombre dice que esto es INTERIOR de `services/`: es la
// gramática del endpoint, no su boca. Y NO sale por el barrel raíz.
//
// ═════════════════════════════════════════════════════════════════════════════
// HECHOS VERIFICADOS CONTRA EL SERVICIO REAL — 7 peticiones con `curl` el
// 2026-08-03 (F11 · T0.1), una por caso, documentadas con su URL, su SHA-256 y su
// cuerpo en `test/fixtures/catastro/PROCEDENCIA.md`, bloque «wfsBU.aspx — el
// servicio de EDIFICIO (F11)». Ese documento MANDA sobre cualquier otra
// documentación (regla de oro 8) y sobre lo que diga el plan de F11.
// ═════════════════════════════════════════════════════════════════════════════
//
// ⛔ ESTE ENDPOINT NO SE COMPORTA COMO SU HERMANO `wfsCP.aspx`. Cuatro de los
// hechos de abajo CONTRADICEN a los que `services/_catastro-wfs.js` congeló para
// parcelas, y dar por bueno aquí lo aprendido allí produce un cliente roto —en
// concreto, un cliente que intenta parsear como GML una página de error de
// ASP.NET—. Se enumeran en paralelo a propósito, para que la contradicción se lea:
//
// (a) ⛔ **EL ERROR NO LLEGA CON HTTP 200.** *(a) del `wfsCP` dice «el error llega
//     con HTTP 200 y `response.ok` no clasifica nada».* **MEDIDO aquí: una
//     referencia catastral inexistente devuelve `302 Found` con
//     `Location: /OVCError.aspx`, y esa página contesta `404 Not Found` con una
//     pantalla de error de ASP.NET en HTML.** `fetch` sigue el redirect por
//     defecto (`redirect: 'follow'`), así que a la aplicación le llega el **404**.
//     **Aquí `response.ok` SÍ clasifica**, justo al revés que en el `wfsCP`. Por
//     eso {@link clasificarRespuestaBu} pide el ESTADO y lo mira ANTES que el
//     cuerpo: ver {@link ESTADO_NO_LOCALIZADA}.
//
// (b) ⛔ **CERO `ExceptionReport` EN LAS 7 RESPUESTAS.** No hay OWS 1.1, ni
//     `exceptionCode`, ni `ExceptionText`, ni `CDATA`. Todo el aparato de
//     `services/_catastro-wfs.js` —el cajón de sastre `OperationProcessingFailed`,
//     la prohibición de ramificar sobre el texto libre, el olfateo por RegExp—
//     **no aplica**. Precio, y hay que DECIRLO en vez de adivinarlo (regla de oro
//     1): **el 404 es MUDO**. No dice qué referencia falló, ni por qué, ni en qué
//     parámetro; «esa RC no existe» y «la URL está mal construida» son
//     INDISTINGUIBLES. Este módulo no inventa la diferencia: la nombra en el
//     `motivo` de {@link TIPO_RESPUESTA_BU.NO_LOCALIZADA}.
//
// (c) ⛔ **LA COLECCIÓN VACÍA EXISTE, y NO es un error.** *(c) del `wfsCP` dice
//     «NO EXISTE la colección vacía».* **MEDIDO aquí: `200 OK` +
//     `gml:FeatureCollection` con CERO `gml:featureMember`** (fixture
//     `wfsbu-coleccion-vacia-13005A10900001.xml`). Y es **el punto de partida de
//     la obra nueva**: el flujo de edificio arranca a menudo de una parcela sin
//     nada registrado, y «aquí no hay nada construido» tiene que poder decirse sin
//     que se lea como una avería. Sale como
//     {@link TIPO_RESPUESTA_BU.SIN_CONSTRUCCIONES}, que es un resultado.
//     ⚠️ Lo medido es «la parcela existe y no hay construcciones DE ESE TIPO»
//     (`GetOtherBuildingByParcel` sobre una rústica que sí tiene `Building`), no
//     «no hay construcciones de ninguna clase». Que un solar de verdad conteste
//     con esta misma forma es **inferencia razonable, no medición**, y así queda
//     escrito en «Huecos declarados» de `PROCEDENCIA.md`.
//
// (d) ⛔ **LA RAÍZ LLEVA PREFIJO Y NO ES LA DEL WFS.** *(b) del `wfsCP` dice
//     «ninguna raíz lleva prefijo».* **MEDIDO aquí:
//     `<gml:FeatureCollection gml:id="ES.SDGC.BU">`**, namespace GML 3.2, miembros
//     `<gml:featureMember>`, y **sin `numberMatched` ni `numberReturned`**. Que no
//     existan los contadores es una buena noticia: aquí los miembros HAY que
//     contarlos y no hay ningún atributo que invite a fiarse (en el `wfsCP` los
//     dos mintieron —hecho (d) de aquel módulo—).
//
// (e) ⚠️ **EL `Content-Type` NO ES XML.** Las respuestas de datos llegan
//     con `application/x-unknown; charset=utf-8` y `Content-Disposition:
//     filename="Building_<REFCAT>.gml"`: el servicio quiere que el navegador se lo
//     descargue como fichero, no que lo lea. **Un cliente que decida si parsear
//     mirando el tipo de contenido no parsearía NINGUNA respuesta útil de este
//     endpoint.** Este módulo no lo mira ni lo recibe.
//
// (f) ⭐ **EL CATÁLOGO TIENE CINCO CONSULTAS Y EL DOSSIER DOCUMENTA TRES.**
//     `MEJORES_PRACTICAS_GML.md` §2.1 lista tres; el servicio publica cinco. La
//     que faltaba y la que importa es **`GetAllConstructionByParcel`**, que
//     devuelve `Building` + `OtherConstruction` en un solo documento ⇒ **2
//     peticiones por edificio** (con `GetBuildingPartByParcel`) en vez de 3. Ver
//     {@link CONSULTAS_BU}. Es la primera vez en este proyecto que una lista de
//     *stored queries* del dossier sobrevive a la medición: en F05,
//     `GetParcelsByBBox` no existía.
//
// (g) ⛔ **`returnFeatureTypes` VALE `bu:Building` EN LAS CINCO**, incluidas la de
//     partes y la de «otros». Es un error del propio servicio: medido,
//     `GetBuildingPartByParcel` devuelve `BuildingPart` y
//     `GetOtherBuildingByParcel` devuelve `OtherConstruction`. **Ese atributo no
//     sirve para saber qué llega**; hay que mirar el documento. Por eso este
//     módulo no lo usa para nada.
//
// ── LOS TRES ESTADOS MEDIDOS, Y POR QUÉ ESTA CLASIFICACIÓN ES LIMPIA ──────────
//
//   | Observado                                        | Significa                          |
//   |--------------------------------------------------|------------------------------------|
//   | 200 + `FeatureCollection` con N `featureMember`  | hay N construcciones               |
//   | 200 + `FeatureCollection` SIN `featureMember`    | la parcela existe y no hay nada de |
//   |                                                  | ese tipo — punto de partida        |
//   | 302 → 404 + HTML                                 | la RC no existe, **o** la URL está |
//   |                                                  | mal — y no se distingue            |
//
// Ninguno de los tres exige mirar un texto libre. **Aquí no hay ningún `CDATA`
// sobre el que esté prohibido ramificar, porque no hay `CDATA`**: es la
// clasificación más limpia que este proyecto ha medido en un servicio del
// Catastro. Los otros dos valores de {@link TIPO_RESPUESTA_BU} —`RESPUESTA_ILEGIBLE`
// y `ESTADO_NO_MEDIDO`— NO corresponden a nada observado: existen para no tragarse
// en silencio lo que nadie ha visto nunca, exactamente como
// `TIPO_RESPUESTA_WFS.EXCEPCION` en el módulo hermano.
//
// ── FRONTERA DE ERRORES (SPEC §2.1, la misma que trazan `gml/parse.js`,
//    `gml/xml.js` y `services/_catastro-wfs.js`) ───────────────────────────────
//   · **Contrato roto por el PROGRAMADOR** → `throw TypeError`/`RangeError`. Un
//     `refcat` que no es string, un `srs` que no es un huso soportado, una
//     consulta que no está en el catálogo, o llamar a clasificar sin estado HTTP:
//     eso es un bug, no hay dato de usuario que avisar y lo que hace falta es
//     verlo.
//   · **Respuesta rara del SERVICIO** → objeto de estado con su `tipo`, NUNCA una
//     excepción. Un 404, un HTML, un XML ilegible o un GML de otro tema son
//     respuestas normales de un servicio ajeno: la capa de arriba tiene que poder
//     decidir qué enseña.
//   Este módulo **no define `MOTIVO_CATASTRO`** (eso es de `services/catastro.js`,
//   que es quien habla con la UI): devuelve su propio {@link TIPO_RESPUESTA_BU} y
//   deja la traducción a `services/catastro-edificio.js`.
//
// Sin dependencias externas: `geo/huso.js` (validación del SRS, delegada),
// `gml/_comun.js` (la tabla de dialectos, que es de donde salen la raíz y el
// contenedor del sobre BU), `gml/xml.js` (el lector XML propio del proyecto —
// `DOMParser` NO existe en el proyecto Vitest `node`) y `services/_catastro-wfs.js`
// (solo `srsWfs`: ver {@link urlConsultaBu}). Ni Leaflet, ni Turf, ni proj4: corre
// igual en la suite `node` y en el navegador. Su test es
// `test/services/catastro-bu.test.js`, SIN sufijo `.dom`.

import { DIALECTO, DIALECTOS, NS, clasificarDialecto } from '../gml/_comun.js'
import { atributo, hijos, parsearXml } from '../gml/xml.js'
import { srsWfs } from './_catastro-wfs.js'

// ── Constantes del servicio ───────────────────────────────────────────────────

/**
 * Endpoint ÚNICO del WFS INSPIRE de EDIFICIOS (`wfsBU.aspx`). Hermano de
 * `services/_catastro-wfs.js#CATASTRO_WFS_CP`, y **otra base**: son dos servicios
 * distintos del mismo host, con dos sobres distintos y dos formas distintas de
 * decir que algo ha fallado.
 *
 * Es una constante base única por la regla de oro 7 y el override O7: si algún día
 * el Catastro retira `Access-Control-Allow-Origin: *` —hoy VERIFICADO en las 7
 * respuestas medidas, **incluidos el 302 y el 404**—, se apunta esta cadena a un
 * proxy en un solo sitio y nadie más se entera.
 *
 * ⚠️ Que el 404 lleve CORS no es un detalle: significa que en el navegador el
 * fallo llega como **respuesta legible** y no como error de red opaco, así que la
 * aplicación puede distinguir «el Catastro dice que no» de «no hay internet», que
 * es justo lo que la regla de oro 1 exige.
 *
 * ⚠️ Matiz medido, igual que en el `wfsCP`: `ACAO: *` es la ÚNICA cabecera CORS
 * presente (no hay `-Headers` ni `-Methods`), así que solo la petición SIMPLE está
 * respaldada. Ninguna de las 7 peticiones llevó `Origin`.
 */
export const CATASTRO_WFS_BU = 'https://ovc.catastro.meh.es/INSPIRE/wfsBU.aspx'

/**
 * Las *stored queries* que ESTE módulo sabe construir, con su `id` tal como el
 * servicio lo publica.
 *
 * De dónde salen (regla de oro 8): del catálogo que devuelve el propio servicio,
 * versionado en `test/fixtures/catastro/wfsbu-describestoredqueries.xml`. El
 * catálogo completo son **CINCO**; aquí hay **CUATRO**, y la que falta no falta por
 * descuido — ver abajo.
 *
 * ⭐ **`GetAllConstructionByParcel` no está en el dossier** (`MEJORES_PRACTICAS_GML.md`
 * §2.1 documenta tres) **y es la que importa**: devuelve el `Building` **y** las
 * `OtherConstruction` —la piscina— en un solo documento. Medido contando los
 * `gml:featureMember` de las respuestas reales:
 *
 *   | Consulta                      | `Building` | `BuildingPart` | `OtherConstruction` |
 *   |-------------------------------|------------|----------------|---------------------|
 *   | `GetAllConstructionByParcel`  | 1          | **0**          | 1                   |
 *   | `GetBuildingByParcel`         | 1          | 0              | 0                   |
 *   | `GetBuildingPartByParcel`     | 0          | **13**         | 0                   |
 *
 * O sea: **un edificio del Catastro cuesta DOS peticiones**, no una y no tres —
 * `TODAS_LAS_CONSTRUCCIONES` (envolvente + atributos + piscinas) **+** `PARTES`
 * (la geometría de las 13 partes)—. La vía obvia de tres consultas cuesta un 50 %
 * más, y contra el override **O8** eso es lo único que había que pesar.
 *
 * ⛔ **La quinta consulta del catálogo, `GetFeatureById`, NO está aquí y no se
 * puede construir con {@link urlConsultaBu}**, por dos motivos medidos:
 *   1. **Sus parámetros son `ID` y `SRSNAME`, no `REFCAT`** — lo declara el propio
 *      catálogo. Meterla en esta tabla haría que `urlConsultaBu` construyera una
 *      URL con el parámetro equivocado, que es exactamente la clase de fallo que
 *      el 404 mudo (hecho (b)) hace **indistinguible** de «esa RC no existe».
 *   2. **No se ha medido ni una vez**, y esta aplicación entra siempre por
 *      referencia catastral: no hay ningún flujo previsto que la necesite (así
 *      queda declarado en «Huecos declarados» de `PROCEDENCIA.md`).
 * `test/services/catastro-bu.test.js` comprueba las DOS mitades —que estos cuatro
 * son un SUBCONJUNTO del catálogo, y que el que falta es exactamente el que el
 * catálogo declara con parámetro `ID`—, porque sin la segunda un módulo que no
 * usara ninguna consulta aprobaría el subconjunto sin decir nada.
 *
 * @readonly
 */
export const CONSULTAS_BU = Object.freeze({
  /** `Building` + `OtherConstruction` de una vez. La primera de las dos de F11. */
  TODAS_LAS_CONSTRUCCIONES: 'GetAllConstructionByParcel',
  /** Los `BuildingPart`: **la geometría de las partes**. La segunda de las dos. */
  PARTES: 'GetBuildingPartByParcel',
  /** Solo el `Building` (envolvente + atributos semánticos). */
  EDIFICIO: 'GetBuildingByParcel',
  /** Solo los `OtherConstruction` (piscinas y demás). */
  OTRAS_CONSTRUCCIONES: 'GetOtherBuildingByParcel',
})

/**
 * Estado HTTP con el que este servicio dice «no hay eso», y el ÚNICO camino de
 * error medido.
 *
 * El mecanismo completo, porque no es evidente y explica por qué el número es 404
 * y no otro: la petición con una referencia inexistente contesta **`302 Found`**
 * con `Location: /OVCError.aspx`; esa página **no está publicada** y contesta
 * **`404 Not Found`** con la pantalla estándar de ASP.NET. `fetch` sigue el
 * redirect solo, así que a la aplicación le llega el 404 y `response.ok` vale
 * `false`.
 *
 * ⚠️ **Es MUDO** (hecho (b) de la cabecera): no distingue «esa referencia no
 * existe» de «hemos construido mal la URL». Este módulo lo dice en el `motivo` en
 * vez de elegir una de las dos.
 */
export const ESTADO_NO_LOCALIZADA = 404

/**
 * `gml:id` de la raíz de TODA colección de este servicio, medido idéntico en los
 * CINCO documentos BU del repo —las dos respuestas de `GetAllConstructionByParcel`,
 * la colección vacía, y los dos fixtures de F00 `test/fixtures/gml/bu_*.gml`—,
 * capturados en dos tandas distintas y con seis días de diferencia.
 *
 * **Es el único discriminante que tiene la COLECCIÓN VACÍA**, y por eso está aquí:
 * un documento sin miembros no tiene ningún elemento de feature del que sacar el
 * namespace, que es lo que `gml/_comun.js#clasificarDialecto` necesita para
 * distinguir un sobre de otro. Y la distinción importa de verdad: **el GML de
 * parcela de ENTREGA tiene EXACTAMENTE la misma raíz y el mismo contenedor**
 * (`gml:FeatureCollection` + `gml:featureMember`) y se diferencia justo en esto —
 * `ES.SDGC.CP` en `test/fixtures/gml/cp_ejemplo_explicativo.gml`—. Sin este
 * atributo, una colección de parcelas vacía se leería como «esta parcela no tiene
 * nada construido».
 */
export const ID_COLECCION_BU = 'ES.SDGC.BU'

/**
 * Qué es una respuesta del `wfsBU`, una vez observada. Es el vocabulario de ESTE
 * módulo: `services/catastro-edificio.js` lo traducirá a `MOTIVO_CATASTRO`, que es
 * el que ve la UI. Aquí no hay mensajes de usuario, hay clasificación.
 *
 * Los **tres primeros están MEDIDOS**; los dos últimos **no corresponden a nada
 * observado** y existen para no dar por buena una respuesta desconocida.
 *
 * @readonly
 */
export const TIPO_RESPUESTA_BU = Object.freeze({
  /**
   * `200` + colección BU con N ≥ 1 `gml:featureMember`. Trae `nMiembros`
   * CONTADOS —aquí no hay `numberMatched` que pueda mentir (hecho (d))— y el
   * cuerpo sigue siendo del llamante: quien lo lee es `gml/parse-bu.js` (T1.2).
   */
  CONSTRUCCIONES: 'CONSTRUCCIONES',
  /**
   * `200` + colección BU con CERO miembros. **NO es un error ni un fallo: es el
   * punto de partida de la obra nueva** (hecho (c)). Un llamante que lo trate como
   * avería le estará diciendo al técnico que el Catastro está roto cuando lo que
   * pasa es que su solar está vacío, que es justo el caso que quería trabajar.
   */
  SIN_CONSTRUCCIONES: 'SIN_CONSTRUCCIONES',
  /**
   * {@link ESTADO_NO_LOCALIZADA}. **Cubre a la vez «esa referencia catastral no
   * existe» y «la URL está mal construida», y el servicio no los distingue**
   * (hecho (b)): no hay `ExceptionReport`, no hay código, no hay mensaje. Es un
   * resultado, no un fallo técnico — pero tampoco es una afirmación sobre la
   * referencia, y el `motivo` lo dice.
   */
  NO_LOCALIZADA: 'NO_LOCALIZADA',
  /**
   * Hubo un 2xx y el cuerpo no es una colección de este servicio: XML mal formado,
   * cuerpo vacío, HTML, una raíz desconocida, o un GML de PARCELA (que tiene la
   * misma raíz que este, hecho (d) — de ahí {@link ID_COLECCION_BU}). Se dice qué
   * ha llegado en vez de devolver cero construcciones, que es la mentira cómoda.
   */
  RESPUESTA_ILEGIBLE: 'RESPUESTA_ILEGIBLE',
  /**
   * Cualquier otro estado HTTP. **No se ha medido ninguno**: las 7 peticiones
   * dieron 200, 302 o 404. Existe para que un 403 —el bloqueo por abuso que el
   * override O8 declara como hueco A PROPÓSITO, porque provocarlo cuesta ~10 días
   * de servicio— no salga disfrazado de «esa referencia no existe». Decir «no sé
   * qué es este 500» es información; decir «la parcela no existe» sería mentira.
   */
  ESTADO_NO_MEDIDO: 'ESTADO_NO_MEDIDO',
})

// Forma de la petición MEDIDA. Cuatro URL de datos en `PROCEDENCIA.md`, las cuatro
// con `version=2` y `request=getfeature` EN MINÚSCULAS. Coincide con la del
// `wfsCP` (`PETICION_CONSULTA_ALMACENADA` de `_catastro-wfs.js`), pero se declara
// aquí y no se importa: es una medición INDEPENDIENTE sobre otro endpoint, y
// compartir la constante haría que un cambio medido en uno moviera al otro sin que
// nadie lo hubiera medido. La coincidencia se comprueba en el test, que es donde
// una coincidencia se afirma sin convertirse en acoplamiento.
const PETICION_CONSULTA_ALMACENADA = Object.freeze({ version: '2', request: 'getfeature' })

/**
 * El dialecto BU, sacado de la tabla ÚNICA de `gml/_comun.js#DIALECTOS`. De ahí
 * salen la raíz (`gml:FeatureCollection` en GML 3.2) y el contenedor
 * (`gml:featureMember`) del sobre, en vez de escribirlos otra vez aquí: una
 * segunda copia sería una segunda verdad que puede divergir de la primera, y la
 * primera es la que usa `gml/parse.js` para reconocer estos mismos ficheros.
 */
const DIALECTO_BU = DIALECTOS.find((d) => d.id === DIALECTO.BU)

/* c8 ignore start */
if (DIALECTO_BU === undefined) {
  throw new Error(
    'services/_catastro-bu: `gml/_comun.js#DIALECTOS` ya no declara el dialecto BU. Este ' +
      'módulo saca de ahí la raíz y el contenedor del sobre del wfsBU para no tener una ' +
      'segunda copia; sin esa fila no hay nada contra lo que clasificar.',
  )
}
/* c8 ignore stop */

// ── Typedefs del contrato ─────────────────────────────────────────────────────

/**
 * Lo OBSERVADO en una respuesta del `wfsBU`. Es un objeto y no dos argumentos
 * sueltos a propósito: obliga a NOMBRAR el estado en la llamada, que es la
 * diferencia entera con el `wfsCP` —allí `response.ok` no clasifica nada; aquí es
 * lo primero que se mira (hecho (a))—.
 *
 * Encaja con `services/_red.js#ResultadoHttp` sin adaptador:
 * `{estado: r.estado, cuerpo: r.texto}`.
 *
 * @typedef {Object} ObservadoBu
 * @property {number} estado  Código HTTP de la respuesta FINAL, ya seguido el
 *   redirect. Entero; ver {@link clasificarRespuestaBu} para por qué `null` no
 *   vale.
 * @property {string|null} cuerpo  Cuerpo decodificado como UTF-8, o `null` si no
 *   lo hubo. `services/_red.js` devuelve `texto: null` en todos sus caminos de
 *   fallo, el 404 incluido, así que el `null` es el caso NORMAL de esta clave y no
 *   una rareza.
 */

/**
 * Resultado de {@link clasificarRespuestaBu}. **Siempre las mismas siete claves**,
 * pase lo que pase — misma disciplina que `services/_red.js#ResultadoHttp`: un
 * llamante nunca tiene que comprobar si una clave existe, solo mirar `tipo`.
 *
 * @typedef {Object} RespuestaBu
 * @property {'CONSTRUCCIONES'|'SIN_CONSTRUCCIONES'|'NO_LOCALIZADA'|'RESPUESTA_ILEGIBLE'|'ESTADO_NO_MEDIDO'} tipo
 *   Clave de {@link TIPO_RESPUESTA_BU}.
 * @property {number} estado  El estado HTTP observado, tal cual y sin interpretar.
 * @property {number|null} nMiembros  `gml:featureMember` **CONTADOS**, o `null` si
 *   no se llegó a contarlos. Contados y no declarados porque este servicio **no
 *   emite `numberMatched` ni `numberReturned`** (hecho (d)): no hay ningún atributo
 *   del que fiarse, ni que desmentir.
 * @property {string|null} idColeccion  El `gml:id` de la raíz, tal cual. `null` si
 *   no hubo raíz o no traía el atributo. Ver {@link ID_COLECCION_BU}.
 * @property {string|null} dialecto  Clave de `gml/_comun.js#DIALECTO` si se llegó
 *   a clasificar el documento por el namespace de su primer miembro; `null` si no
 *   (sin cuerpo, sin raíz, o colección vacía — que no tiene miembro que mirar).
 * @property {string} motivo  Por qué, en castellano y **nombrando lo observado**.
 *   NO es un mensaje de usuario terminado: es la explicación técnica que
 *   `services/catastro-edificio.js` envuelve. Está presente también en los caminos
 *   buenos, porque «hay 13 construcciones» y «no hay ninguna» son las dos cosas que
 *   el técnico necesita leer.
 * @property {import('../gml/xml.js').ErrorXml[]} erroresXml  Problemas del XML,
 *   arrastrados sin callarlos. **Vacío cuando no se ha parseado nada**, que es lo
 *   que permite afirmar en el test que el HTML del 404 no se intentó leer como GML.
 */

// ── Validación de argumentos (contrato del PROGRAMADOR: aquí sí se lanza) ─────

/**
 * Exige una referencia catastral utilizable como valor de query string.
 *
 * NO juzga su FORMA (14 alfanuméricos): eso es dato del usuario, y este módulo no
 * tiene canal para avisarle. Lo que sí se exige es que sea un string no vacío,
 * porque un `undefined` en la URL es un bug del programador.
 *
 * ⚠️ Y aquí duele más que en el `wfsCP`: allí un `refcat` mal tecleado produce un
 * `ExceptionReport` que dice qué referencia no se encontró; **aquí produce un 404
 * mudo**, indistinguible de una URL mal construida (hecho (b)).
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
 * Exige un `id` de *stored query* que este módulo sepa construir.
 *
 * @param {*} consulta
 * @param {string} quien
 * @returns {string}
 * @throws {TypeError|RangeError}
 */
function exigirConsulta(consulta, quien) {
  if (typeof consulta !== 'string') {
    throw new TypeError(
      `${quien}: 'consulta' debe ser un valor de CONSULTAS_BU como string; recibido ` +
        `${typeof consulta}.`,
    )
  }
  const validas = Object.values(CONSULTAS_BU)
  if (!validas.includes(consulta)) {
    throw new RangeError(
      `${quien}: «${consulta}» no es una consulta construible. Las cuatro que este módulo ` +
        `sabe pedir son ${validas.join(', ')}. El catálogo del servicio publica una quinta, ` +
        '«GetFeatureById», que NO está aquí porque sus parámetros son ID y SRSNAME —no ' +
        'REFCAT— y porque no se ha medido nunca: construirla con el parámetro equivocado ' +
        'daría un 404 MUDO, indistinguible de «esa referencia no existe».',
    )
  }
  return consulta
}

// ── Construcción de URL ───────────────────────────────────────────────────────

/**
 * Ensambla la URL. Los valores se concatenan SIN percent-encoding en `:` y `,`
 * —caracteres legales en un query string (RFC 3986)— para que la URL sea
 * LITERALMENTE igual a la que se midió, y no una equivalente que nadie ha probado.
 * Mismo criterio que `services/_catastro-wfs.js#url` y que
 * `viewer/wms-catastro.js#getMapUrl`.
 *
 * @param {Array<[string, string]>} pares  Pares `[nombre, valor]` EN EL ORDEN en
 *   que se escriben (array, no objeto: el orden es el de la petición medida).
 * @returns {string}
 */
function url(pares) {
  return `${CATASTRO_WFS_BU}?${pares.map(([n, v]) => `${n}=${v}`).join('&')}`
}

/**
 * URL de una de las cuatro *stored queries* de {@link CONSULTAS_BU}. Las cuatro
 * son IDÉNTICAS salvo el `id`: mismos parámetros (`REFCAT` + `SRSNAME`), mismo
 * orden, mismo todo. Por eso hay una función y no cuatro.
 *
 * Dos peticiones de esta forma están medidas byte a byte
 * (`GetAllConstructionByParcel` y `GetOtherBuildingByParcel`, con sus URL en
 * `PROCEDENCIA.md`); las otras dos son el mismo molde con otro `id`, que es lo que
 * el catálogo del servicio declara.
 *
 * ⚠️ **La grafía del parámetro es `STOREDQUERIE_ID`, sin la «S» de «QUERIES».** No
 * es una errata nuestra: es el nombre con el que el servicio contestó en la
 * medición —el mismo del `wfsCP`, ya documentado en
 * `services/_catastro-wfs.js:516-519`— y el que documenta la guía del Catastro. **No
 * se «arregla».**
 *
 * ⚠️ El `srsname` se construye con `srsWfs`, IMPORTADO del módulo hermano y no
 * copiado. Medido: las cuatro URL del `wfsBU` llevan `srsname=EPSG::25830`, con el
 * **doble dos puntos**, byte por byte la misma forma que las cinco del `wfsCP`. Una
 * segunda copia de esa traducción sería una segunda verdad, y de paso perdería la
 * validación del huso que `srsWfs` delega en `geo/huso.js` (Canarias diferida,
 * override O13). El test la ancla contra las URL medidas de ESTE endpoint, así que
 * si algún día las dos formas divergieran de verdad, saldría rojo aquí.
 *
 * Lo único que se codifica es el `refcat`, que viene del usuario: para un valor
 * legítimo `encodeURIComponent` es la identidad (son alfanuméricos), y para uno
 * hostil impide que un `&` inventado añada parámetros a la petición.
 *
 * @param {string} consulta  Valor de {@link CONSULTAS_BU}.
 * @param {string} refcat  Referencia catastral de la PARCELA. No se juzga su
 *   forma: ver `exigirRefcat`.
 * @param {string} srs  Forma corta del modelo (`'EPSG:25830'`). **Obligatorio y
 *   sin valor por defecto**: el huso no se adivina, y poner aquí un defecto sería
 *   tomar esa decisión a espaldas del llamante. El defecto de producto lo declara
 *   `services/catastro.js#SRS_DEFAULT`, que es quien conoce el expediente.
 * @returns {string}  URL absoluta.
 * @throws {TypeError|RangeError}  Contrato roto por el programador.
 */
export function urlConsultaBu(consulta, refcat, srs) {
  exigirConsulta(consulta, 'urlConsultaBu')
  exigirRefcat(refcat, 'urlConsultaBu')
  return url([
    ['service', 'wfs'],
    ['version', PETICION_CONSULTA_ALMACENADA.version],
    ['request', PETICION_CONSULTA_ALMACENADA.request],
    ['STOREDQUERIE_ID', consulta],
    ['refcat', encodeURIComponent(refcat)],
    ['srsname', srsWfs(srs)],
  ])
}

// ── Clasificación de la respuesta ─────────────────────────────────────────────

/** Construye un {@link RespuestaBu} con sus SIETE claves, siempre las mismas. */
function respuesta(
  tipo,
  estado,
  motivo,
  { nMiembros = null, idColeccion = null, dialecto = null, erroresXml = [] } = {},
) {
  return { tipo, estado, nMiembros, idColeccion, dialecto, motivo, erroresXml }
}

/**
 * Clasifica una respuesta del `wfsBU` mirando **primero el estado y después el
 * cuerpo**, y dice qué es.
 *
 * ⛔ **El orden no es estilo: es la corrección medida de F11 sobre la lección de
 * F05.** En el `wfsCP` está medido que todo error llega con HTTP 200 y que el
 * estado no clasifica nada, así que aquel módulo lee siempre el cuerpo. **Aquí el
 * error llega con 404 y el cuerpo es una página HTML de ASP.NET** (hecho (a)): un
 * cliente escrito con el `wfsCP` en la cabeza intentaría parsearla como GML, y lo
 * que sacaría de ahí —una raíz desconocida, o basura— NO diría lo que de verdad ha
 * pasado. Por eso el 404 sale de aquí **sin tocar el cuerpo**, y `erroresXml` vacío
 * es la prueba comprobable de que no se tocó.
 *
 * **Nunca lanza por culpa del servicio.** Los cinco caminos:
 *   · `404` → `NO_LOCALIZADA`. Sin leer el cuerpo. Mudo: no se afirma cuál de las
 *     dos causas fue.
 *   · otro estado no 2xx → `ESTADO_NO_MEDIDO`. Tampoco se lee el cuerpo: no hay
 *     ninguna medición que diga qué trae.
 *   · `2xx` + colección BU con miembros → `CONSTRUCCIONES`, con `nMiembros`.
 *   · `2xx` + colección BU sin miembros → `SIN_CONSTRUCCIONES`. **Resultado, no
 *     error** (hecho (c)).
 *   · `2xx` + cualquier otra cosa → `RESPUESTA_ILEGIBLE`, diciendo qué llegó.
 *
 * @param {ObservadoBu} observado  `{estado, cuerpo}`.
 * @returns {RespuestaBu}
 * @throws {TypeError}  Si `observado` no es un objeto, si `estado` no es un entero
 *   o si `cuerpo` no es un string ni `null` (contrato del programador). En
 *   particular **`estado: null` LANZA**: `services/_red.js` lo pone a `null` cuando
 *   NO llegó a haber respuesta (sin red, plazo agotado, cancelación), y eso no es
 *   una respuesta de este servicio ni hay nada que clasificar aquí — es un
 *   `MOTIVO_RED`, y quien lo confunda tiene un bug, no un dato raro.
 */
export function clasificarRespuestaBu(observado) {
  if (observado === null || typeof observado !== 'object' || Array.isArray(observado)) {
    throw new TypeError(
      'clasificarRespuestaBu: se espera un objeto {estado, cuerpo}; recibido ' +
        `${Array.isArray(observado) ? 'un array' : typeof observado}. El estado va NOMBRADO ` +
        'a propósito: en este endpoint es lo primero que clasifica (al revés que en el ' +
        'wfsCP), y un argumento suelto se pasa en el orden que no es sin que nada avise.',
    )
  }
  const { estado, cuerpo = null } = observado
  if (typeof estado !== 'number' || !Number.isInteger(estado)) {
    throw new TypeError(
      `clasificarRespuestaBu: 'estado' debe ser el código HTTP como entero; recibido ` +
        `${JSON.stringify(estado)}. Si no llegó a haber respuesta —sin red, plazo agotado, ` +
        'cancelación— `services/_red.js` deja `estado` en null y eso NO lo clasifica este ' +
        'módulo: es un MOTIVO_RED y no una respuesta del wfsBU.',
    )
  }
  if (cuerpo !== null && typeof cuerpo !== 'string') {
    throw new TypeError(
      `clasificarRespuestaBu: 'cuerpo' debe ser el texto de la respuesta YA DECODIFICADO, o ` +
        `null si no lo hubo; recibido ${typeof cuerpo}. Ojo con el encoding: los XML de este ` +
        'servicio declaran ISO-8859-1 y sus bytes son UTF-8 — manda la cabecera HTTP ' +
        '(charset=utf-8), que es la que obedece `response.text()`, y decodificar a mano haría ' +
        'texto roto a partir de bytes correctos.',
    )
  }

  // ── El estado, ANTES que el cuerpo. Ver el aviso de la cabecera de la función.
  if (estado === ESTADO_NO_LOCALIZADA) {
    return respuesta(
      TIPO_RESPUESTA_BU.NO_LOCALIZADA,
      estado,
      'El servicio ha redirigido a su página de error y esa página devuelve 404. Es la única ' +
        'forma de fallo que tiene este endpoint, y NO dice cuál de las dos cosas ha pasado: o ' +
        'esa referencia catastral no existe, o la petición se ha construido mal. No hay ' +
        'código, ni mensaje, ni ExceptionReport que mirar — el cuerpo es una página HTML ' +
        'genérica de ASP.NET, y por eso ni se intenta leer.',
    )
  }
  if (estado < 200 || estado > 299) {
    return respuesta(
      TIPO_RESPUESTA_BU.ESTADO_NO_MEDIDO,
      estado,
      `El servicio ha respondido con el código HTTP ${estado}, que no se ha observado nunca en ` +
        'este endpoint: las 7 peticiones medidas dieron 200, 302 y 404. No se interpreta el ' +
        'cuerpo porque no hay ninguna medición que diga qué trae, y afirmar que la referencia ' +
        'no existe sería inventárselo.',
    )
  }

  if (cuerpo === null) {
    return respuesta(
      TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE,
      estado,
      `El servicio ha respondido ${estado} y no ha llegado ningún cuerpo que leer. Una ` +
        'colección sin construcciones NO se dice así: se dice con un documento completo y ' +
        'cero miembros, que es un caso distinto y normal.',
    )
  }

  const { raiz, errores } = parsearXml(cuerpo)

  if (raiz === null) {
    return respuesta(
      TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE,
      estado,
      'La respuesta no contiene ningún elemento raíz utilizable: no es XML legible, así que ' +
        'no se puede afirmar que sea una colección de construcciones ni ninguna otra cosa. ' +
        'Mírala tal cual antes de suponer nada.',
      { erroresXml: errores },
    )
  }

  const { raiz: sobre, miembro } = DIALECTO_BU
  // `gml:id` va con prefijo y por tanto SÍ está en el namespace de GML — al revés
  // que los atributos sin prefijo, que no heredan el namespace por defecto
  // (XML-NS 1.0 §6.2, la trampa que documenta `gml/xml.js` en su cabecera).
  const idColeccion = atributo(raiz, NS.gml, 'id')

  if (raiz.ns !== sobre.ns || raiz.local !== sobre.local) {
    return respuesta(
      TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE,
      estado,
      `Se esperaba «${sobre.local}» en ${sobre.ns} y la raíz del documento es «${raiz.local}» ` +
        `en ${raiz.ns === '' ? '(ninguno)' : raiz.ns}. Ojo con confundir los dos servicios: ` +
        'el WFS de PARCELAS contesta con otro sobre (raíz en el namespace del WFS 2.0 y ' +
        'miembros «member»), y su lector es `services/_catastro-wfs.js`.',
      { idColeccion, erroresXml: errores },
    )
  }

  const miembros = hijos(raiz, miembro.ns, miembro.local)

  // ── COLECCIÓN VACÍA: el caso que en el wfsCP no existe, y que aquí es el punto
  //    de partida de la obra nueva. Sin miembros no hay elemento de feature del
  //    que sacar el namespace, así que el ÚNICO discriminante es el `gml:id` de la
  //    raíz: ver ID_COLECCION_BU, y la trampa del GML de parcela de ENTREGA, que
  //    tiene esta misma raíz y este mismo contenedor.
  if (miembros.length === 0) {
    if (idColeccion !== ID_COLECCION_BU) {
      return respuesta(
        TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE,
        estado,
        `Ha llegado una colección VACÍA cuyo gml:id es ${
          idColeccion === null ? '(ninguno)' : `«${idColeccion}»`
        } y no «${ID_COLECCION_BU}». Sin miembros no hay ningún elemento de feature del que ` +
          'deducir el dialecto, así que ese identificador es lo único que distingue una ' +
          'colección de construcciones vacía de, por ejemplo, una colección de parcelas vacía ' +
          '—que tiene la misma raíz y el mismo contenedor—. Decir «aquí no hay nada ' +
          'construido» sin comprobarlo sería afirmar sobre un documento que no se ha ' +
          'reconocido.',
        { nMiembros: 0, idColeccion, erroresXml: errores },
      )
    }
    return respuesta(
      TIPO_RESPUESTA_BU.SIN_CONSTRUCCIONES,
      estado,
      'La colección ha llegado entera y sin ningún miembro: la parcela existe y el Catastro no ' +
        'tiene nada construido de ese tipo. No es un fallo — es el punto de partida normal de ' +
        'una obra nueva.',
      { nMiembros: 0, idColeccion, erroresXml: errores },
    )
  }

  // ── CON MIEMBROS: el discriminante fuerte es el namespace del primer elemento
  //    de feature, que es lo que `gml/_comun.js#clasificarDialecto` mira. Se usa
  //    él y no el `gml:id` porque es el mismo criterio con el que `gml/parse.js`
  //    reconoce estos ficheros, y porque distingue de verdad los cuatro dialectos.
  const primerFeature = miembros[0].hijos[0] ?? null
  const featureNs = primerFeature === null ? null : primerFeature.ns
  const dialecto = clasificarDialectoDelMiembro(raiz, featureNs)

  if (dialecto !== DIALECTO.BU) {
    return respuesta(
      TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE,
      estado,
      `El sobre es el de una colección, pero su primer miembro contiene ${
        primerFeature === null
          ? 'un «featureMember» vacío'
          : `«${primerFeature.local}» en ${
              featureNs === '' || featureNs === null ? '(ningún namespace)' : featureNs
            }`
      }, que corresponde al dialecto ${dialecto}. Este servicio devuelve edificios; se dice ` +
        'qué ha llegado en vez de contarlo como construcciones que nadie va a poder leer.',
      { nMiembros: miembros.length, idColeccion, dialecto, erroresXml: errores },
    )
  }

  return respuesta(
    TIPO_RESPUESTA_BU.CONSTRUCCIONES,
    estado,
    `La colección trae ${miembros.length} ${
      miembros.length === 1 ? 'construcción contada' : 'construcciones contadas'
    } una a una. Este servicio no declara numberMatched ni numberReturned, así que no hay ` +
      'ningún contador del que fiarse: el número sale de contar los miembros.',
    { nMiembros: miembros.length, idColeccion, dialecto, erroresXml: errores },
  )
}

/**
 * Clave de `gml/_comun.js#DIALECTO` del documento, a partir de su raíz y del
 * namespace de su primer elemento de feature.
 *
 * Envuelve a `clasificarDialecto` para quedarse SOLO con el `id`: el resto del
 * `Dialecto` —el `motivo`, el `formaSrsName`, el `soportado`— habla de leer
 * geometría, y eso es de `gml/parse-bu.js`. Aquí se está clasificando una
 * respuesta HTTP, no leyendo un fichero.
 *
 * @param {import('../gml/xml.js').NodoXml} raiz
 * @param {string|null} featureNs
 * @returns {string}  Clave de `DIALECTO`.
 */
function clasificarDialectoDelMiembro(raiz, featureNs) {
  return clasificarDialecto({ ns: raiz.ns, local: raiz.local, featureNs }).id
}

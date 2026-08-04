// services/catastro-edificio.js — F11 · T2.2. LA PUERTA PÚBLICA del servicio de
// EDIFICIO del Catastro (`wfsBU`), hermana de `services/catastro.js`.
//
// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║ ESTE MÓDULO ORQUESTA; NO REIMPLEMENTA NADA.                                  ║
// ║  · La URL y la clasificación del cuerpo son de `services/_catastro-bu.js`.   ║
// ║  · Los bytes y los códigos HTTP son de `services/_red.js`.                   ║
// ║  · Leer el GML es de `gml/parse-bu.js`.                                      ║
// ║  · El vocabulario que ve la UI —`MOTIVO_CATASTRO`, `ORIGEN`, `CACHE_NULA`,   ║
// ║    `SRS_DEFAULT`, `normalizarRefcat`— es de `services/catastro.js`, y se     ║
// ║    IMPORTA en vez de duplicarse.                                            ║
// ║                                                                              ║
// ║ Lo único que se decide aquí es la SECUENCIA: qué se pide, en qué orden, qué  ║
// ║ se para en cuanto falla, qué se guarda y cómo se juntan dos documentos en    ║
// ║ uno. Todo lo demás ya estaba escrito.                                       ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
//
// ── LO QUE CUESTA UNA CARGA, DICHO POR DELANTE ───────────────────────────────
// **DOS peticiones.** Ni una ni tres, y la combinación está MEDIDA (F11 · T0.1,
// `test/fixtures/catastro/PROCEDENCIA.md`, bloque «wfsBU.aspx»):
//
//   | Consulta                      | `Building` | `BuildingPart` | `OtherConstruction` |
//   |-------------------------------|------------|----------------|---------------------|
//   | `GetAllConstructionByParcel`  | 1          | **0**          | 1                   |
//   | `GetBuildingByParcel`         | 1          | 0              | 0                   |
//   | `GetBuildingPartByParcel`     | 0          | **13**         | 0                   |
//
// `GetAllConstructionByParcel` trae la envolvente **y** las «otras construcciones»
// —la piscina— de una vez, así que con `GetBuildingPartByParcel` se tiene todo. La
// vía obvia (`Building` + `BuildingPart` + `OtherBuilding`) cuesta **un 50 % más**
// y no aporta nada. ⭐ Y esa consulta **no está en el dossier**, que documenta tres
// de las cinco *stored queries* del catálogo: se encontró midiendo.
// Ver {@link CONSULTAS_DE_CARGA} y {@link CONSULTAS_POR_CARGA}.
//
// Excepciones al «dos», las dos hacia abajo y las dos declaradas:
//   · **Con las dos respuestas en la caché, CERO.** La caché es la mayor medida
//     anti-bloqueo del cliente (`MEJORES_PRACTICAS_GML.md` §2.4).
//   · **Si la primera dice que no existe esa referencia, UNA.** No se pregunta por
//     las partes de algo que el servicio acaba de decir que no encuentra.
//
// ── EL TRANSPORTE ES EL MISMO QUE EL DE LA RAMA DE PARCELA, Y ESO ES EL DISEÑO ─
// `crearClienteEdificio` recibe el MISMO `transporte` que `crearClienteCatastro`
// (`services/_red.js#crearTransporte`). No es estilo: la cola de concurrencia 2,
// los reintentos, el backoff con jitter y los contadores son **compartidos**, y esa
// es la disciplina que exige el override **O8** — el Catastro sanciona el uso
// automático con denegación de servicio de ~10 días. Dos transportes serían dos
// colas de 2, o sea 4 peticiones simultáneas contra el mismo servicio, que es
// exactamente el perfil que se está evitando.
//
// ⛔ **CONSECUENCIA MEDIBLE Y ASIMÉTRICA: `destruir()` NO destruye el transporte.**
// `services/catastro.js#destruir` sí lo hace, y su propia cabecera dejó escrito por
// qué y qué haría falta el día que se compartiera: *«Si algún día hiciera falta
// compartir un transporte entre dos clientes, esto habría que revisarlo — y por eso
// está escrito aquí.»* **Ese día es F11.** Si este módulo destruyera el transporte
// al cerrarse, cerrar la rama EDIFICIO dejaría muda la rama PARCELA, en silencio y
// para siempre. Así que aquí `destruir()` solo se apaga a sí mismo.
//
// ⚠️ **La asimetría sigue viva en el otro sentido, y quien cablee tiene que
// saberlo**: `crearClienteCatastro.destruir()` **sí** destruye el transporte
// compartido, y a partir de ahí este cliente devuelve `CANCELADA` sin haber sido
// destruido. A nivel de aplicación es lo que se quiere —se cierra la pantalla y
// para todo—, pero **el orden importa**: destruir primero el cliente de parcela
// deja este inservible. Queda dicho para T3.2 y T4.1.
//
// ── LAS SEIS TRAMPAS QUE ESTE MÓDULO EXISTE PARA NO PISAR ────────────────────
//
// 1) ⛔⛔ **EL ESTADO HTTP SE MIRA ANTES DE TRADUCIR NADA.** `services/_red.js` en
//    un no-2xx devuelve `ok: false`, `motivo: ESTADO_HTTP` y **`texto: null`** — ni
//    siquiera entrega el cuerpo. Si aquí se tradujera `MOTIVO_RED → MOTIVO_CATASTRO`
//    nada más ver `!http.ok`, **el 404 de este servicio saldría como fallo técnico
//    en vez de como «esa referencia no está»**, que es justo lo que el usuario
//    necesita distinguir. Por eso el único caso que se traduce por `MOTIVO_RED` es
//    **`estado === null`**, que en el contrato de `_red.js` significa exactamente
//    «no llegó a haber respuesta» (sin red, plazo agotado, cancelación). Todo lo
//    demás —hubo respuesta— lo clasifica `clasificarRespuestaBu`, que además
//    **LANZA con `estado: null`** a propósito: los dos contratos encajan sin
//    adaptador y sin hueco por el que colarse.
//
// 2) ⛔ **AQUÍ EL ERROR NO LLEGA CON 200, al revés que en el `wfsCP`.** Medido: una
//    referencia inexistente devuelve `302 Found` → `/OVCError.aspx` → `404` con una
//    página de ASP.NET en HTML. `fetch` sigue el redirect, así que llega el 404 y
//    **`response.ok` SÍ clasifica**. Un cliente escrito con la lección de F05 en la
//    cabeza intentaría parsear como GML una página de error.
//
// 3) ⛔ **EL 404 ES MUDO, Y HAY QUE DECIRLO.** No hay `ExceptionReport`, ni
//    `exceptionCode`, ni texto del servicio que enseñar: «esa referencia catastral
//    no existe» y «la petición se ha construido mal» son **indistinguibles**. Este
//    módulo no elige una: las nombra las dos en el `mensaje` (regla de oro 1). Y
//    cuando la que falla es la SEGUNDA consulta —con la primera ya contestada— lo
//    dice, porque entonces «la referencia no existe» es la explicación menos
//    probable de las dos. Eso es derivado de lo observado, no adivinado.
//
// 4) ⛔ **LA COLECCIÓN VACÍA NO ES UN ERROR: ES EL PUNTO DE PARTIDA.** Medido: `200`
//    + `gml:FeatureCollection` con CERO `gml:featureMember`. Sale con **`ok: true`**
//    y con `datos.sinConstrucciones === true`, no con un `motivo`. Un solar sin nada
//    registrado es el caso frecuente de este flujo (obra nueva), y contarlo como
//    avería sería decirle al técnico que el Catastro está roto cuando lo que pasa es
//    que su parcela está vacía — que es justo lo que quería trabajar.
//    ⚠️ Lo medido es «la parcela existe y no hay construcciones DE ESE TIPO»; que un
//    solar de verdad conteste igual es **inferencia razonable, no medición**, y así
//    está declarado en `PROCEDENCIA.md`.
//
// 5) ⛔ **CINCO ESTADOS, NO TRES.** A los tres observados,
//    `services/_catastro-bu.js` añade `RESPUESTA_ILEGIBLE` y `ESTADO_NO_MEDIDO`, y
//    el segundo importa aquí más que en ningún sitio: **un 403 de bloqueo por abuso
//    —el hueco que el override O8 declara a propósito— saldría disfrazado de «esa
//    referencia no existe»** si todo lo no-2xx se tratara como el 404. Sale como
//    `ESTADO_HTTP`, con el número dentro del mensaje y sin afirmar nada sobre la
//    referencia.
//
// 6) ⚠️ **EL TRANSPORTE AVISA POR SU CUENTA, Y EN EL 404 DICE OTRA COSA.**
//    `_red.js#fallar` emite por el canal «El servicio ha respondido con el código
//    HTTP 404. El servidor dice que esa dirección no existe.» **antes** de que este
//    módulo tenga nada que decir. No se puede evitar sin tocar `_red.js`, que esta
//    tarea no toca. Consecuencia práctica para quien cablee la pantalla: **el
//    renglón bueno es el `mensaje` del resultado**, no el aviso del canal, que aquí
//    habla de una dirección web cuando el usuario ha escrito una referencia
//    catastral. Queda declarado en vez de descubierto.
//
// ── EL CANAL DE AVISO SE RESERVA A LO QUE NO CABE EN EL RESULTADO ────────────
// Misma decisión que `services/catastro.js`, y por lo mismo: cada resultado ya lleva
// `motivo` + `mensaje` presentable, y su destinatario es quien llamó. Lo único que
// sale por el canal son **los fallos de la CACHÉ**, que no cambian el resultado y
// que sin canal no se enteraría nadie. Las detecciones del lector NO van por ahí:
// caben en `datos.detecciones`, que es su sitio.
//
// ── LO QUE ESTE MÓDULO NO HACE ───────────────────────────────────────────────
//   · **No traduce al modelo.** `functional → FUNCIONAL`, `1_residential →
//     usoDominante` y `grossFloorArea → superficieConstruida` son de
//     `edificio/entrada.js` (T2.1). Aquí `datos` es el contrato **C** crudo, tal
//     como lo devuelve `gml/parse-bu.js`, y por eso este módulo no importa `model/`.
//   · **No consulta por `ID`.** El catálogo publica una quinta consulta,
//     `GetFeatureById`, cuyos parámetros son `ID` y `SRSNAME` y **no `REFCAT`**;
//     `services/_catastro-bu.js` la declara con su porqué y no la construye. Esta
//     aplicación entra siempre por referencia catastral.
//   · **No deduplica peticiones en vuelo** ni **caduca nada**: lo primero lo razona
//     `services/catastro.js` y lo segundo es de `storage/cache-catastro.js`.
//   · **No toca IndexedDB.** La caché entra por el puerto `CacheCatastro`, con
//     `CACHE_NULA` por defecto: el cliente funciona entero sin almacenamiento.
//
// Su test es `test/services/catastro-edificio.test.js`, **sin sufijo `.dom`**: aquí
// no hay DOM, ni Leaflet, ni red (el `fetch` entra doblado por `_red.js`). Y **no
// sale por el barrel raíz**, como ningún módulo de `services/`.

import { husoPorSrs } from '../geo/huso.js'
import { parsearGmlBu } from '../gml/parse-bu.js'
import { NIVEL, resolverAvisar } from '../viewer/_comun.js'
import {
  CONSULTAS_BU,
  TIPO_RESPUESTA_BU,
  clasificarRespuestaBu,
  urlConsultaBu,
} from './_catastro-bu.js'
import { MOTIVO_RED } from './_red.js'
import { CACHE_NULA, MOTIVO_CATASTRO, ORIGEN, SRS_DEFAULT, normalizarRefcat } from './catastro.js'

// ── Lo que cuesta una carga ───────────────────────────────────────────────────

/**
 * Las *stored queries* de UNA carga de edificio, **en el orden en que se piden**.
 * Es un array y no un objeto porque el orden es parte de la decisión: primero la
 * que dice si la referencia existe, después la que trae la geometría.
 *
 * Por qué estas dos y no otras, con las cifras medidas delante: ver la tabla de la
 * cabecera del módulo. En corto: `TODAS_LAS_CONSTRUCCIONES` trae el `Building`
 * **y** las `OtherConstruction` en un solo documento, y `PARTES` trae los
 * `BuildingPart`, que es donde está la geometría de verdad. Con eso está todo.
 *
 * **Se derivan de `CONSULTAS_BU`**, no se escriben los `id` a mano: el nombre
 * exacto de cada consulta lo publica el servicio y lo congela
 * `services/_catastro-bu.js` contra su catálogo versionado.
 *
 * @readonly
 * @type {readonly string[]}
 */
export const CONSULTAS_DE_CARGA = Object.freeze([
  CONSULTAS_BU.TODAS_LAS_CONSTRUCCIONES,
  CONSULTAS_BU.PARTES,
])

/**
 * Cuántas peticiones cuesta una carga de edificio que llega a la red: **2**.
 *
 * **DERIVADO**, no escrito: si algún día alguien añadiera una tercera consulta a
 * {@link CONSULTAS_DE_CARGA}, esta cifra le seguiría sola y el test que la compara
 * con el coste real seguiría siendo cierto. Un 2 escrito a mano sería la primera
 * cosa que se queda vieja.
 *
 * Es el número que la interfaz puede enseñar («esta consulta cuesta 2 peticiones al
 * Catastro»), y el que hay que pesar contra el override **O8**.
 */
export const CONSULTAS_POR_CARGA = CONSULTAS_DE_CARGA.length

// ── Traducción de los dos vocabularios de debajo ──────────────────────────────

/**
 * `MOTIVO_RED` → {@link MOTIVO_CATASTRO}. **Se DERIVA de las claves de
 * `MOTIVO_RED`**, igual que en `services/catastro.js` y por lo mismo: los cuatro
 * motivos del transporte se llaman igual en el vocabulario público, y derivarlo es
 * lo que hace imposible que se desincronicen.
 *
 * ⛔ **Solo se usa cuando `estado === null`** (trampa 1 de la cabecera). Con
 * respuesta HTTP de por medio manda {@link MOTIVO_POR_TIPO_BU}.
 *
 * @type {Readonly<Record<string, string>>}
 */
const MOTIVO_POR_MOTIVO_RED = Object.freeze(
  Object.fromEntries(Object.keys(MOTIVO_RED).map((clave) => [clave, MOTIVO_CATASTRO[clave]])),
)

/**
 * `TIPO_RESPUESTA_BU` → {@link MOTIVO_CATASTRO}, **solo para los tipos que NO
 * traen dato**. `CONSTRUCCIONES` y `SIN_CONSTRUCCIONES` no están porque ninguno de
 * los dos es un fallo: el segundo es el punto de partida de la obra nueva (trampa
 * 4), y ponerle un motivo lo convertiría en avería.
 *
 * Las tres entradas, con su porqué:
 *   · `NO_LOCALIZADA` → `NO_ENCONTRADO`. Es el 404 mudo. **No dice cuál de las dos
 *     causas fue**, y el mensaje lo declara en vez de elegir.
 *   · `RESPUESTA_ILEGIBLE` → `RESPUESTA_ILEGIBLE`. Un 2xx con un cuerpo que no es
 *     una colección de este servicio: HTML, XML roto, o un GML de PARCELA, que
 *     tiene la MISMA raíz y el MISMO contenedor.
 *   · `ESTADO_NO_MEDIDO` → `ESTADO_HTTP`. **Y no `NO_ENCONTRADO`**, que es la
 *     línea entera: un 403 de bloqueo por abuso no puede salir disfrazado de «esa
 *     referencia no existe» (trampa 5).
 *
 * @type {Readonly<Record<string, string>>}
 */
const MOTIVO_POR_TIPO_BU = Object.freeze({
  [TIPO_RESPUESTA_BU.NO_LOCALIZADA]: MOTIVO_CATASTRO.NO_ENCONTRADO,
  [TIPO_RESPUESTA_BU.RESPUESTA_ILEGIBLE]: MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
  [TIPO_RESPUESTA_BU.ESTADO_NO_MEDIDO]: MOTIVO_CATASTRO.ESTADO_HTTP,
})

/**
 * Guardián de carga: los dos mapas de arriba tienen que ser TOTALES sobre su
 * dominio. Si `services/_red.js` o `services/_catastro-bu.js` añaden un caso y aquí
 * no se traduce, el módulo **no se carga** en vez de meter un `motivo: undefined` en
 * un resultado que la UI daría por bueno.
 *
 * Es ruidoso a propósito, y es el mismo guardián que ya tiene `services/catastro.js`:
 * un módulo que no carga se arregla en cinco minutos; un `motivo` indefinido viaja
 * hasta la pantalla.
 */
for (const [nombre, dominio, mapa] of [
  ['MOTIVO_RED', Object.keys(MOTIVO_RED), MOTIVO_POR_MOTIVO_RED],
  [
    'TIPO_RESPUESTA_BU',
    Object.values(TIPO_RESPUESTA_BU).filter(
      (t) => t !== TIPO_RESPUESTA_BU.CONSTRUCCIONES && t !== TIPO_RESPUESTA_BU.SIN_CONSTRUCCIONES,
    ),
    MOTIVO_POR_TIPO_BU,
  ],
]) {
  for (const clave of dominio) {
    /* c8 ignore next 7 -- solo se alcanza si un módulo de debajo crece y este no */
    if (mapa[clave] === undefined) {
      throw new Error(
        `services/catastro-edificio: falta la traducción de ${nombre}.${clave}. Un caso nuevo ` +
          `en un módulo de debajo tiene que llegar al vocabulario público con un motivo ` +
          `decidido por alguien, no heredar 'undefined'. Y si el caso nuevo NO es un fallo ` +
          `—como SIN_CONSTRUCCIONES—, su sitio no es este mapa: es el camino de éxito.`,
      )
    }
  }
}

// ── Typedefs del contrato ─────────────────────────────────────────────────────

/**
 * El dato de una carga de edificio: el contrato **C** de F11 —lo que devuelve
 * `gml/parse-bu.js#parsearGmlBu`— con **los dos documentos ya juntos** y tres claves
 * más, que son las que este módulo puede afirmar y el lector de un fichero suelto
 * no.
 *
 * **Nada traducido**: `conditionOfConstruction` sigue siendo `'functional'` y
 * `constructionNature` sigue siendo `'openAirPool'`. La traducción al vocabulario
 * del modelo es de `edificio/entrada.js`.
 *
 * @typedef {Object} EdificioCatastro
 * @property {boolean} ok  Siempre `true`: un `EdificioCatastro` solo existe cuando
 *   hay dato. Se conserva la clave para que la forma sea la del contrato C y quien
 *   sepa leer uno sepa leer el otro.
 * @property {string} refcat  La referencia **PEDIDA**, ya normalizada. Va aquí
 *   porque el documento no siempre la trae (medido: los `BuildingPart` no llevan
 *   `bu-core2d:reference`; su referencia sale del `xlink:href`) y porque la colección
 *   vacía no trae absolutamente nada de lo que deducirla.
 * @property {string} dialecto  Clave de `gml/_comun.js#DIALECTO`. `'BU'` siempre.
 * @property {string|null} srs  Forma corta (`'EPSG:25830'`). **`null` en una
 *   colección vacía**, que es lo que devuelve el lector cuando no hay ni un feature
 *   del que sacar el `srsName`: no se inventa el que se pidió.
 * @property {string|null} srsName  El `srsName` LITERAL, sin normalizar (en BU es la
 *   URN `'urn:ogc:def:crs:EPSG::25830'`).
 * @property {object|null} edificio  El `Building`: envolvente + atributos
 *   semánticos. `null` si no hay ninguno.
 * @property {object[]} partes  Los `BuildingPart`, en orden de documento. Aquí está
 *   la geometría de las huellas.
 * @property {object[]} otras  Las `OtherConstruction` —la piscina—, en orden de
 *   documento.
 * @property {boolean} sinConstrucciones  `true` cuando no hay `Building`, ni partes,
 *   ni otras. **Es un resultado, no un fallo**: el punto de partida de la obra nueva.
 * @property {number} nMiembros  `gml:featureMember` CONTADOS, sumando los dos
 *   documentos. Contados y no declarados porque este servicio **no emite
 *   `numberMatched` ni `numberReturned`**: no hay contador del que fiarse.
 * @property {number} consultas  Cuántas *stored queries* han compuesto este dato.
 *   Hoy {@link CONSULTAS_POR_CARGA}; va en el dato para que la interfaz pueda decir
 *   lo que cuesta sin importar esta constante.
 * @property {import('../gml/_comun.js').DeteccionGml[]} detecciones  Las de los dos
 *   documentos, concatenadas en el orden de {@link CONSULTAS_DE_CARGA}.
 */

/**
 * De dónde vino el dato y cuánto costó. **Las cinco claves de
 * `services/catastro.js#ProcedenciaCatastro`, en el mismo orden**, más dos que este
 * flujo necesita porque pide más de una URL.
 *
 * Las dos añadidas son ADITIVAS a propósito: `app/cableado-catastro.js#textoProcedencia`
 * lee `origen`, `edadMs` y `url`, así que la interfaz de F11 lo reutiliza **sin
 * escribir nada nuevo**, que es lo que pide el contrato F.
 *
 * @typedef {Object} ProcedenciaEdificio
 * @property {'CACHE'|'RED'|'LOCAL'} origen  Clave de `ORIGEN`.
 * @property {number|null} edadMs  Milisegundos desde que se guardó, **solo si
 *   `origen === 'CACHE'`**. Con dos entradas cacheadas es la edad de **la MÁS VIEJA**:
 *   decir la de la más nueva sería presentar como reciente un dato que en su mitad no
 *   lo es. `null` si alguna no supo decir cuándo se guardó.
 * @property {number} intentos  Peticiones HTTP EMITIDAS de verdad, **sumando las dos
 *   consultas y sus reintentos**. `0` si no se llegó a la red.
 * @property {number} ms  Milisegundos de extremo a extremo de ESTA llamada, consulta
 *   a la caché incluida: es lo que esperó el llamante.
 * @property {string|null} url  La URL de la petición de la que habla este resultado:
 *   **la que falló**, cuando algo falló, y la última emitida cuando salió bien.
 *   `null` si no se pidió ninguna. `url === null` ⟺ `origen !== 'RED'`.
 * @property {string[]} urls  ⭐ Todas las URL emitidas, en orden. Vacío si no hubo
 *   red. Es lo que hace **afirmable** «esta carga ha costado dos peticiones» desde el
 *   propio resultado, y no solo desde un espía del `fetch` que vive en el test.
 * @property {number} consultas  Cuántas *stored queries* se han llegado a emitir:
 *   `0` desde la caché, `1` cuando la primera dice que esa referencia no está, y
 *   {@link CONSULTAS_POR_CARGA} en el caso normal.
 */

/**
 * Lo que devuelve {@link crearClienteEdificio}·`edificioPorRefcat`. **La misma forma
 * que `services/catastro.js#ResultadoCatastro`**, con `datos` = un
 * {@link EdificioCatastro}.
 *
 * Misma forma significa que la interfaz reutiliza `NIVEL_POR_MOTIVO` y
 * `textoProcedencia` tal cual. Los invariantes también son los mismos y se pueden
 * dar por buenos:
 *   · `ok === true` ⟺ `datos !== null` ⟺ `motivo === null` ⟺ `mensaje === null`.
 *   · `motivo`, cuando lo hay, es SIEMPRE una clave de `MOTIVO_CATASTRO`.
 *   · `procedencia` existe siempre y sus siete claves también.
 *
 * ⚠️ **`ok: true` con `datos.sinConstrucciones` NO es un caso de error**: es la
 * parcela que existe y no tiene nada construido. Quien lo trate como fallo le estará
 * diciendo al técnico que algo va mal justo cuando todo va bien.
 *
 * @typedef {Object} ResultadoEdificioCatastro
 * @property {boolean} ok
 * @property {EdificioCatastro|null} datos
 * @property {string|null} motivo  Clave de `MOTIVO_CATASTRO`; `null` si `ok`.
 * @property {string|null} mensaje  Español presentable tal cual; `null` si `ok`.
 * @property {ProcedenciaEdificio} procedencia
 */

/** @typedef {import('./catastro.js').CacheCatastro} CacheCatastro */

// ── Mensajes ──────────────────────────────────────────────────────────────────

/**
 * Cola de los mensajes de «no está»: lo que el servicio NO distingue. Se escribe
 * una vez porque es la frase que impide leer «no encontrado» como «esta herramienta
 * ha fallado», y porque el 404 de este endpoint es **mudo** — no hay texto del
 * servicio que citar, al revés que en el WFS de parcelas, donde el `ExceptionReport`
 * al menos dice algo.
 */
const COLA_MUDA =
  'El servicio no da ningún detalle: no manda código de error ni mensaje, así que esta ' +
  'herramienta no puede distinguir «esa referencia catastral no existe» de «la petición se ha ' +
  'construido mal». Comprueba la referencia antes que nada.'

/**
 * Mensaje de una respuesta que no trae construcciones. Nombra la consulta que falló
 * y, cuando la que falla es la SEGUNDA, dice que la primera sí contestó — que es un
 * dato observado y cambia la lectura del fallo (trampa 3).
 *
 * @param {import('./_catastro-bu.js').RespuestaBu} bu
 * @param {string} consulta  El `id` de la *stored query*.
 * @param {number} yaResueltas  Cuántas consultas de la carga habían ido bien.
 * @returns {string}
 */
function mensajeBu(bu, consulta, yaResueltas) {
  const cual = `Consulta «${consulta}» (${yaResueltas + 1} de ${CONSULTAS_POR_CARGA}).`
  if (bu.tipo === TIPO_RESPUESTA_BU.NO_LOCALIZADA) {
    const matiz =
      yaResueltas > 0
        ? ` Ojo: la consulta anterior de esta misma carga SÍ ha contestado para esta referencia, ` +
          `así que «no existe» es la explicación menos probable de las dos.`
        : ''
    return (
      `${cual} El Catastro no ha localizado nada para la referencia pedida en su servicio de ` +
      `edificios. ${COLA_MUDA}${matiz} No encontrar nada es un estado válido, no un fallo de la ` +
      `herramienta: el País Vasco y Navarra tienen catastro propio, fuera del alcance de esta ` +
      `aplicación.`
    )
  }
  if (bu.tipo === TIPO_RESPUESTA_BU.ESTADO_NO_MEDIDO) {
    return (
      `${cual} ${bu.motivo} No se afirma que la referencia no exista, porque eso no es lo que ` +
      `dice un ${bu.estado}: si esto se repite, lo que hay que mirar es el estado del servicio.`
    )
  }
  return (
    `${cual} No se ha podido leer la respuesta del Catastro. ${bu.motivo} Eso apunta a un ` +
    `cambio del servicio o a un fallo de esta aplicación, NO a que el dato no exista.`
  )
}

/**
 * Mensaje del caso «los dos documentos han llegado y no se pueden juntar». Se separa
 * porque es el único fallo que este módulo produce por su cuenta, y conviene que
 * diga exactamente qué se ha comparado.
 *
 * @param {string} detalle
 * @returns {string}
 */
const mensajeIncoherente = (detalle) =>
  `El Catastro ha contestado a las ${CONSULTAS_POR_CARGA} consultas de esta carga, pero las ` +
  `respuestas no encajan entre sí y juntarlas daría un edificio que no existe. ${detalle} No se ` +
  `entrega media respuesta: apunta a un cambio del servicio o a un fallo de esta aplicación.`

// ── Duck typing de las inyecciones ────────────────────────────────────────────

/** ¿Sirve como transporte? Lo que este módulo usa, y nada más. */
function esTransporte(t) {
  return (
    !!t &&
    typeof t === 'object' &&
    typeof t.pedirTexto === 'function' &&
    typeof t.estado === 'function' &&
    typeof t.destruir === 'function'
  )
}

/** ¿Sirve como caché? Las dos operaciones del puerto {@link CacheCatastro}. */
function esCache(c) {
  return !!c && typeof c === 'object' && typeof c.leer === 'function' && typeof c.guardar === 'function'
}

// ── Cliente ───────────────────────────────────────────────────────────────────

/**
 * Crea el cliente del servicio de EDIFICIO del Catastro.
 *
 * Es una factory (`crearX`), nunca una clase (convención del proyecto). Todo el
 * estado vive en el cierre, así que dos clientes no comparten ni contadores ni
 * caché — lo que **sí** comparten, y a propósito, es el transporte.
 *
 * ```js
 * const red = crearTransporte({ alAvisar })            // ⚠️ UNO solo para toda la app
 * const catastro = crearClienteCatastro({ transporte: red, cache, alAvisar })
 * const edificios = crearClienteEdificio({ transporte: red, cache, alAvisar })
 *
 * const r = await edificios.edificioPorRefcat(loQueEscribioElUsuario)   // 2 peticiones
 * if (r.ok && r.datos.sinConstrucciones) empezarObraNueva(r.datos.refcat)
 * else if (r.ok) pintarPartes(r.datos.partes, r.procedencia)
 * else mostrar(r.mensaje, NIVEL_POR_MOTIVO[r.motivo])   // ← el mapa de services/catastro.js
 * ```
 *
 * @param {object} opciones
 * @param {{pedirTexto: Function, estado: Function, destruir: Function}} opciones.transporte
 *   ⚠️ **El MISMO que recibe `crearClienteCatastro`**, y por eso es obligatorio y sin
 *   defecto: crear uno aquí partiría en dos la cola de concurrencia que el override
 *   O8 exige compartir, y en un test tocaría la red de verdad.
 * @param {CacheCatastro} [opciones.cache=CACHE_NULA]  El puerto de
 *   `services/catastro.js`. Por defecto, sin almacenamiento.
 * @param {string} [opciones.srs=SRS_DEFAULT]  SRS por defecto de las consultas, en
 *   forma corta. Se valida al crear el cliente, no en la primera consulta.
 * @param {() => number} [opciones.ahora=() => Date.now()]  Reloj. Se inyecta porque
 *   un módulo que lee el reloj del sistema no es reproducible, y porque de aquí sale
 *   la EDAD de lo cacheado, que es un dato que acaba en pantalla.
 * @param {import('../viewer/_comun.js').Avisar|null} [opciones.alAvisar=null]
 *   Canal de aviso. **Solo se usa para los fallos de la CACHÉ**: ver la cabecera.
 * @returns {{edificioPorRefcat: Function, estado: Function, destruir: Function}}
 * @throws {TypeError|RangeError}  Contrato roto por el programador.
 */
export function crearClienteEdificio(opciones = {}) {
  if (!opciones || typeof opciones !== 'object') {
    throw new TypeError(
      `crearClienteEdificio: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`,
    )
  }
  const {
    transporte,
    cache = CACHE_NULA,
    srs: srsCliente = SRS_DEFAULT,
    ahora = () => Date.now(),
    alAvisar = null,
  } = opciones

  if (!esTransporte(transporte)) {
    throw new TypeError(
      `crearClienteEdificio: 'transporte' debe ser el de services/_red.js#crearTransporte ` +
        `(con pedirTexto, estado y destruir); recibido ${typeof transporte}. Y tiene que ser EL ` +
        `MISMO objeto que recibe crearClienteCatastro: la cola de concurrencia, los reintentos ` +
        `y el ritmo son compartidos, que es lo que exige el override O8. No se crea uno por ` +
        `defecto a propósito.`,
    )
  }
  if (!esCache(cache)) {
    throw new TypeError(
      `crearClienteEdificio: 'cache' debe cumplir el puerto CacheCatastro (leer y guardar, las ` +
        `dos asíncronas); recibido ${typeof cache}. Usa CACHE_NULA si no quieres almacenamiento.`,
    )
  }
  if (typeof ahora !== 'function') {
    throw new TypeError(
      `crearClienteEdificio: 'ahora' debe ser una función; recibido ${typeof ahora}.`,
    )
  }
  // Delegado: `husoPorSrs` es el único sitio del proyecto que sabe qué husos están
  // implementados y cuál está diferido (Canarias, override O13). Lanza solo.
  husoPorSrs(srsCliente)

  const avisar = resolverAvisar(alAvisar)

  /** Contadores acumulados. Nunca se reinician: un contador que se borra miente. */
  const cuenta = { cargas: 0, deCache: 0, deRed: 0, peticiones: 0, fallosCache: 0 }
  let destruido = false

  // ── Resultados: fábrica única ───────────────────────────────────────────────

  /**
   * ÚNICA fábrica de {@link ResultadoEdificioCatastro} del módulo. Por aquí pasan
   * TODOS los caminos de salida, y por eso las cinco claves están siempre y en el
   * mismo orden. Escribir el objeto a mano en cada `return` es exactamente cómo
   * aparecen los resultados a los que les falta una clave.
   *
   * @param {object} campos
   * @returns {ResultadoEdificioCatastro}
   */
  function crearResultado({
    ok,
    datos = null,
    motivo = null,
    mensaje = null,
    origen,
    edadMs = null,
    intentos = 0,
    inicio,
    url = null,
    urls = [],
  }) {
    return {
      ok,
      datos,
      motivo,
      mensaje,
      procedencia: {
        origen,
        edadMs,
        intentos,
        ms: Math.max(0, ahora() - inicio),
        url,
        urls,
        consultas: urls.length,
      },
    }
  }

  /** Decisión tomada aquí, sin preguntar a nadie: `origen: LOCAL`, `url: null`. */
  const local = (motivo, mensaje, inicio) =>
    crearResultado({ ok: false, motivo, mensaje, origen: ORIGEN.LOCAL, inicio })

  /** Fallo con la red de por medio: conserva los intentos y las URL que se pidieron. */
  const fallar = (motivo, mensaje, inicio, { intentos, urls }) =>
    crearResultado({
      ok: false,
      motivo,
      mensaje,
      origen: ORIGEN.RED,
      intentos,
      inicio,
      url: urls[urls.length - 1] ?? null,
      urls,
    })

  /**
   * El cliente está destruido. Se devuelve resultado en vez de lanzar por la misma
   * razón que en `services/_red.js#destruir`: «pedir sobre un cliente ya destruido»
   * no es un bug, es la carrera normal entre una pantalla que se cierra y un
   * manejador que ya estaba en marcha.
   */
  const cancelado = (inicio) =>
    local(
      MOTIVO_CATASTRO.CANCELADA,
      'La consulta al Catastro se ha cancelado: la pantalla que la pidió ya no está activa.',
      inicio,
    )

  // ── Caché ───────────────────────────────────────────────────────────────────
  //
  // ╔════════════════════════════════════════════════════════════════════════╗
  // ║ EL EDIFICIO SÍ ENTRA EN LA CACHÉ, Y AQUÍ ESTÁ EL MOTIVO ESCRITO.        ║
  // ╚════════════════════════════════════════════════════════════════════════╝
  //
  // Tres razones, en orden de peso:
  //
  //  1. **Esta carga cuesta el DOBLE que la de parcela** (2 peticiones frente a 1),
  //     y la caché es la mayor medida anti-bloqueo del cliente
  //     (`MEJORES_PRACTICAS_GML.md` §2.4, override O8). Si hay un flujo de esta
  //     aplicación que necesita caché, es este.
  //  2. **No hace falta tocar `storage/`.** `storage/cache-catastro.js#rutaDe`
  //     LANZA con una clave cuyo prefijo no conoce, y hoy solo conoce `parcela:` y
  //     `revgeo:`; un prefijo nuevo obligaría a un almacén nuevo en `storage/bd.js`
  //     y a su migración. Con el prefijo `parcela:` y un sufijo propio la entrada es
  //     inconfundible y no pisa a nadie — es el mismo recurso que ya usan
  //     `claveVecindad` y `claveDescriptivos` de `services/catastro.js`, con su
  //     razonamiento escrito allí. Y de paso entra sola en la purga por TTL, porque
  //     `ALMACENES_DE_CACHE` se deriva de esa misma tabla.
  //  3. **Se cachea el TEXTO del GML, no el POJO ya leído**, por las tres razones
  //     que `services/catastro.js#leerColeccionDeCache` dejó escritas. Aquí la
  //     primera pesa más que en ningún sitio: `gml/parse-bu.js` se ha escrito HOY
  //     (F11 · T1.2) y es el lector más joven del proyecto. Guardar el POJO
  //     congelaría cada entrada con los fallos que tuviera el lector el día que se
  //     guardó y los serviría durante el TTL entero sin que nada avisara.
  //
  // Y una decisión de forma que conviene entender antes de cambiarla: **las dos
  // entradas se leen TODO-O-NADA**. Un acierto a medias obligaría a devolver
  // `origen: 'RED'` con una `edadMs` que solo vale para la mitad del dato, o sea a
  // mentir en el único renglón que existe para no mentir. Como las dos se escriben
  // juntas, el acierto parcial solo pasa si el navegador desaloja una: se paga con
  // una petición de más y se dice la verdad.

  /**
   * Clave de caché de UNA *stored query*. El SRS entra en la clave porque la
   * geometría depende de él; la consulta también, porque dos consultas distintas
   * sobre la misma referencia devuelven dos cuerpos distintos y compartir clave
   * serviría lo uno por lo otro (el mismo error que `claveVecindad` evita).
   *
   * @param {string} consulta  Valor de `CONSULTAS_BU`.
   * @param {string} refcat  Ya normalizada.
   * @param {string} srs
   * @returns {string}
   */
  const claveConsulta = (consulta, refcat, srs) => `parcela:${srs}:${refcat}:bu:${consulta}`

  /**
   * Consulta la caché. **Nunca lanza y nunca cambia el curso de la consulta**: si
   * falla, avisa y devuelve `null`, o sea «no estaba», y se va a la red.
   *
   * @param {string} clave
   * @returns {Promise<{valor: *, edadMs: number|null}|null>}
   */
  async function leerDeCache(clave) {
    let entrada
    try {
      entrada = await cache.leer(clave)
    } catch (error) {
      cuenta.fallosCache += 1
      avisar(
        `No se ha podido leer la caché local del Catastro (${clave}). Se consulta al servicio, ` +
          `que es más lento pero da el mismo dato.`,
        { nivel: NIVEL.AVISO, causa: error },
      )
      return null
    }
    if (entrada === null || entrada === undefined) return null
    if (typeof entrada !== 'object' || entrada.valor === undefined) {
      cuenta.fallosCache += 1
      avisar(
        `La caché local del Catastro ha devuelto para ${clave} algo que no tiene la forma ` +
          `{valor, guardadoEn}. Se ignora y se consulta al servicio.`,
        { nivel: NIVEL.AVISO },
      )
      return null
    }
    return {
      valor: entrada.valor,
      // Sin `guardadoEn` utilizable no se inventa una edad: `null` significa «no sé
      // cuándo se guardó», que es distinto de «se guardó hace 0 ms».
      edadMs: Number.isFinite(entrada.guardadoEn) ? Math.max(0, ahora() - entrada.guardadoEn) : null,
    }
  }

  /**
   * Las {@link CONSULTAS_DE_CARGA} tal como estaban guardadas, **o `null` si falta
   * alguna** (todo-o-nada: ver el bloque de arriba).
   *
   * @param {string[]} claves  Una por consulta, en el orden de la carga.
   * @returns {Promise<{textos: string[], edadMs: number|null}|null>}
   */
  async function leerCargaDeCache(claves) {
    const entradas = []
    for (const clave of claves) {
      const entrada = await leerDeCache(clave)
      if (entrada === null || typeof entrada.valor !== 'string') return null
      entradas.push(entrada)
    }
    // La edad de la MÁS VIEJA. Y `null` si alguna no supo decir la suya: con una
    // mitad de edad desconocida, afirmar la edad del conjunto sería inventársela.
    const edades = entradas.map((e) => e.edadMs)
    return {
      textos: entradas.map((e) => e.valor),
      edadMs: edades.some((e) => e === null) ? null : Math.max(...edades),
    }
  }

  /**
   * Guarda. **Un fallo aquí NO cambia el resultado**: el edificio ya se ha traído
   * bien, y que el almacenamiento esté lleno o bloqueado (navegación privada, cuota
   * agotada) no puede convertir un acierto en un error. Avisa, eso sí: si no, sería
   * el único suceso silencioso del módulo.
   *
   * @param {string} clave
   * @param {string} texto
   * @returns {Promise<void>}
   */
  async function guardarEnCache(clave, texto) {
    try {
      await cache.guardar(clave, texto, { guardadoEn: ahora() })
    } catch (error) {
      cuenta.fallosCache += 1
      avisar(
        `El edificio se ha traído bien del Catastro, pero no se ha podido guardar en la caché ` +
          `local (${clave}). La consulta ha funcionado; la próxima vez volverá a costar ` +
          `${CONSULTAS_POR_CARGA} peticiones al servicio.`,
        { nivel: NIVEL.AVISO, causa: error },
      )
    }
  }

  // ── Juntar los dos documentos ───────────────────────────────────────────────

  /**
   * Lee los cuerpos de las {@link CONSULTAS_DE_CARGA} y los junta en un
   * {@link EdificioCatastro}. Devuelve `{datos}` o `{detalle}` con el porqué.
   *
   * Se comprueban DOS cosas antes de juntar, y las dos son la lección de F05
   * aplicada aquí:
   *
   *   · **La referencia catastral, y nunca la posición.** Está medido en el WFS de
   *     parcelas que el servicio devuelve la propia parcela en 2.ª posición dentro
   *     de una colección de colindantes; fiarse del orden es equivocarse. Aquí las
   *     consultas son por referencia, así que lo que se comprueba es lo contrario:
   *     que **TODO** lo que ha llegado hable de la referencia que se pidió.
   *     ⛔ **Y es «todo», no «alguno», y la diferencia la cazó un test**: con dos
   *     documentos de dos parcelas distintas, exigir solo que *alguno* case deja
   *     pasar la mezcla —el `Building` de una parcela con las partes de otra—, que
   *     es exactamente el edificio inexistente que este bloque existe para no
   *     construir.
   *     ⚠️ Solo se juzgan las referencias LEGIBLES. Un documento que no traiga
   *     ninguna no se rechaza: hacerlo tiraría una geometría perfectamente
   *     utilizable por un identificador que el usuario ya tiene delante. Medido: en
   *     los cinco documentos reales del repo la referencia se lee siempre.
   *   · **El SRS.** Las dos peticiones llevan el mismo `srsname`, así que dos husos
   *     distintos en la misma carga son el servicio contradiciéndose, y juntar las
   *     dos geometrías produciría un edificio partido en dos sitios del mapa. Se
   *     comparan solo cuando los dos documentos lo traen: la colección vacía no
   *     tiene ni un feature del que sacarlo y devuelve `null`, que no es discrepar.
   *
   * @param {string[]} textos  Un cuerpo por consulta, en el orden de la carga.
   * @param {string} refcat  Ya normalizada.
   * @returns {{datos: EdificioCatastro, detalle?: undefined}|{datos?: undefined, detalle: string}}
   */
  function juntarCarga(textos, refcat) {
    const leidos = []
    for (const [i, texto] of textos.entries()) {
      const doc = parsearGmlBu(texto)
      if (!doc.ok) {
        return {
          detalle:
            `La respuesta de «${CONSULTAS_DE_CARGA[i]}» no se ha podido leer como GML de ` +
            `edificio: ${doc.motivo}`,
        }
      }
      leidos.push(doc)
    }

    const referencias = leidos.flatMap((doc) =>
      [doc.edificio, ...doc.partes, ...doc.otras]
        .map((f) => f?.refcat ?? null)
        .filter((r) => r !== null),
    )
    const ajenas = [...new Set(referencias.filter((r) => normalizarRefcat(r) !== refcat))]
    if (ajenas.length > 0) {
      return {
        detalle:
          `Se pidió la referencia ${refcat} y ha llegado ${
            referencias.length === ajenas.length ? 'otra' : 'también'
          }: ${ajenas.join(', ')}. No se enseña una construcción ajena por parecerse a la ` +
          `pedida, y menos aún se mezclan dos parcelas en un mismo edificio.`,
      }
    }

    const srsNames = leidos.map((doc) => doc.srsName).filter((s) => s !== null)
    if (new Set(srsNames).size > 1) {
      return {
        detalle:
          `Las respuestas vienen en sistemas de referencia distintos ` +
          `(${[...new Set(srsNames)].join(' y ')}) aunque las dos se pidieron en el mismo. ` +
          `Juntarlas pondría las partes lejos de su edificio.`,
      }
    }

    const conSrs = leidos.find((doc) => doc.srs !== null) ?? null
    const edificio = leidos.find((doc) => doc.edificio !== null)?.edificio ?? null
    const partes = leidos.flatMap((doc) => doc.partes)
    const otras = leidos.flatMap((doc) => doc.otras)

    return {
      datos: {
        ok: true,
        refcat,
        dialecto: leidos[0].dialecto,
        srs: conSrs === null ? null : conSrs.srs,
        srsName: conSrs === null ? null : conSrs.srsName,
        edificio,
        partes,
        otras,
        sinConstrucciones: edificio === null && partes.length === 0 && otras.length === 0,
        nMiembros: leidos.reduce((total, doc) => total + doc.nMiembros, 0),
        consultas: leidos.length,
        detecciones: leidos.flatMap((doc) => doc.detecciones),
      },
    }
  }

  // ── Opciones comunes ────────────────────────────────────────────────────────

  /**
   * Lee `{srs, senal}` de las opciones y valida el SRS. El `srs` por llamada existe
   * porque un expediente puede estar en otro huso que el defecto del cliente.
   *
   * @param {*} opciones
   * @param {string} quien
   * @returns {{srs: string, senal: AbortSignal|null}}
   * @throws {TypeError|RangeError}
   */
  function leerOpciones(opciones, quien) {
    if (opciones === null || typeof opciones !== 'object') {
      throw new TypeError(`${quien}: 'opciones' debe ser un objeto; recibido ${typeof opciones}.`)
    }
    const srs = opciones.srs === undefined ? srsCliente : opciones.srs
    husoPorSrs(srs)
    return { srs, senal: opciones.senal === undefined ? null : opciones.senal }
  }

  // ── API pública ─────────────────────────────────────────────────────────────

  /**
   * El edificio oficial de una referencia catastral de PARCELA: envolvente,
   * atributos semánticos, partes y «otras construcciones».
   *
   * **Cuesta {@link CONSULTAS_POR_CARGA} peticiones**, o cero desde la caché, o una
   * cuando la referencia no está. La cuenta exacta viaja en el propio resultado
   * (`procedencia.urls` y `procedencia.consultas`), así que no hace falta creérselo.
   *
   * ⚠️ **`ok: true` con `datos.sinConstrucciones === true` es un resultado normal**,
   * no un fallo: la parcela existe y el Catastro no tiene nada construido en ella.
   * Es el punto de partida de una obra nueva.
   *
   * @param {*} refcatCrudo  Lo que haya escrito el usuario; se normaliza aquí con la
   *   misma función que la rama de parcela, que además acepta la referencia de
   *   INMUEBLE de 20 caracteres y se queda con sus 14 primeros.
   * @param {object} [opciones]
   * @param {string} [opciones.srs]  SRS de esta consulta. Por defecto, el del cliente.
   * @param {AbortSignal|null} [opciones.senal]
   * @returns {Promise<ResultadoEdificioCatastro>}
   * @throws {TypeError|RangeError}  Contrato roto por el programador (`opciones` que
   *   no es objeto, `srs` que no es un huso soportado). **Una referencia mal escrita
   *   NO lanza**: es dato del usuario y sale como `ENTRADA_INVALIDA`.
   */
  async function edificioPorRefcat(refcatCrudo, opciones = {}) {
    const inicio = ahora()
    const { srs, senal } = leerOpciones(opciones, 'edificioPorRefcat')
    cuenta.cargas += 1
    if (destruido) return cancelado(inicio)

    const refcat = normalizarRefcat(refcatCrudo)
    if (refcat === null) {
      return local(
        MOTIVO_CATASTRO.ENTRADA_INVALIDA,
        `«${String(refcatCrudo)}» no tiene forma de referencia catastral de parcela: se esperan ` +
          `14 caracteres, solo letras y números (por ejemplo, 9398516VK3799G). Los espacios ` +
          `sobran y las minúsculas valen. No se consulta al Catastro: su servicio de edificios ` +
          `contestaría con un 404 mudo que no dice si el fallo está en la referencia o en la ` +
          `petición.`,
        inicio,
      )
    }

    // ── La caché, antes que la red. Las dos entradas o ninguna.
    const claves = CONSULTAS_DE_CARGA.map((consulta) => claveConsulta(consulta, refcat, srs))
    const enCache = await leerCargaDeCache(claves)
    if (enCache !== null) {
      const juntada = juntarCarga(enCache.textos, refcat)
      if (juntada.datos !== undefined) {
        cuenta.deCache += 1
        return crearResultado({
          ok: true,
          datos: juntada.datos,
          origen: ORIGEN.CACHE,
          edadMs: enCache.edadMs,
          inicio,
        })
      }
      // Cuerpos cacheados que ya no se pueden juntar con el código de hoy: se tratan
      // como si no estuvieran y se va a la red. No se avisa al usuario porque no le
      // ha pasado nada — tendrá su edificio igual, solo que por el camino lento.
    }

    // ── La red: las consultas de la carga, en orden y parando en el primer fallo.
    /** @type {string[]} */
    const urls = []
    /** @type {string[]} */
    const cuerpos = []
    let intentos = 0

    for (const consulta of CONSULTAS_DE_CARGA) {
      const url = urlConsultaBu(consulta, refcat, srs)
      urls.push(url)
      cuenta.peticiones += 1

      const http = await transporte.pedirTexto(url, { senal })
      intentos += http.intentos
      const proc = { intentos, urls: [...urls] }

      // ⛔ EL ESTADO, ANTES DE TRADUCIR NADA (trampa 1 de la cabecera).
      // `estado === null` es el contrato de `_red.js` para «no llegó a haber
      // respuesta»: ahí manda MOTIVO_RED, y `clasificarRespuestaBu` LANZA a
      // propósito porque no hay ninguna respuesta de este servicio que clasificar.
      if (http.estado === null) {
        cuenta.deRed += 1
        return fallar(MOTIVO_POR_MOTIVO_RED[http.motivo], http.mensaje, inicio, proc)
      }

      const bu = clasificarRespuestaBu({ estado: http.estado, cuerpo: http.texto })
      if (
        bu.tipo !== TIPO_RESPUESTA_BU.CONSTRUCCIONES &&
        bu.tipo !== TIPO_RESPUESTA_BU.SIN_CONSTRUCCIONES
      ) {
        cuenta.deRed += 1
        return fallar(
          MOTIVO_POR_TIPO_BU[bu.tipo],
          mensajeBu(bu, consulta, cuerpos.length),
          inicio,
          proc,
        )
      }

      // Los dos tipos que quedan son 2xx con colección BU dentro, así que
      // `clasificarRespuestaBu` ya ha descartado el cuerpo ausente: aquí hay texto.
      cuerpos.push(http.texto)
    }

    cuenta.deRed += 1
    const proc = { intentos, urls }
    const juntada = juntarCarga(cuerpos, refcat)
    if (juntada.datos === undefined) {
      return fallar(
        MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
        mensajeIncoherente(juntada.detalle),
        inicio,
        proc,
      )
    }

    for (const [i, clave] of claves.entries()) await guardarEnCache(clave, cuerpos[i])

    return crearResultado({
      ok: true,
      datos: juntada.datos,
      origen: ORIGEN.RED,
      intentos,
      inicio,
      url: urls[urls.length - 1],
      urls,
    })
  }

  /**
   * Fotografía de los contadores. Objeto nuevo en cada llamada: quien lo guarde
   * conserva la foto, no una referencia que cambia sola.
   *
   * ⚠️ **`red` son los contadores del transporte COMPARTIDO**, así que incluyen el
   * tráfico de la rama de parcela. No es un defecto: es precisamente el presupuesto
   * conjunto de peticiones que el override O8 obliga a vigilar de una pieza.
   *
   * Hay **dos unidades** y conviene no confundirlas: una *carga* es una llamada a
   * `edificioPorRefcat`; una *petición* es una *stored query* emitida. Una carga
   * cuesta 0, 1 o {@link CONSULTAS_POR_CARGA} peticiones.
   *
   * @returns {{red: object, cargas: number, deCache: number, deRed: number,
   *            peticiones: number, fallosCache: number}}
   */
  function estado() {
    return { red: transporte.estado(), ...cuenta }
  }

  /**
   * Deja el cliente inerte: las llamadas posteriores devuelven `CANCELADA` sin tocar
   * ni la caché ni la red.
   *
   * ⛔ **NO destruye el transporte, al revés que `services/catastro.js#destruir`**, y
   * es la diferencia más importante entre los dos módulos. El transporte es
   * COMPARTIDO con el cliente de parcela (override O8): destruirlo aquí dejaría muda
   * la otra rama entera, en silencio. Aquel módulo dejó escrito que el día que se
   * compartiera habría que revisarlo; este es ese día, y esta es la revisión.
   *
   * ⚠️ Consecuencia que no se puede arreglar desde aquí y que por eso se declara:
   * `crearClienteCatastro.destruir()` **sí** aborta el transporte compartido, y a
   * partir de ese momento este cliente devuelve `CANCELADA` aunque nadie lo haya
   * destruido. Quien cablee la aplicación tiene que saber que el orden importa.
   *
   * Idempotente. Los contadores acumulados NO se borran.
   */
  function destruir() {
    destruido = true
  }

  return { edificioPorRefcat, estado, destruir }
}

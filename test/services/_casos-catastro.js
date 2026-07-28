/* -------------------------------------------------------------------------- *
 * test/services/_casos-catastro.js — F05 · T5A                                 *
 * EL CATÁLOGO DE CASOS REPRODUCIBLES DE `MOTIVO_CATASTRO`                      *
 *                                                                              *
 * ── POR QUÉ NO ES UN `*.test.js` ────────────────────────────────────────────  *
 * No lleva el sufijo a propósito, igual que `_doble-fetch.js`, `_canonico.js`   *
 * y `_ayuda-jsdom.js`: la guarda de partición de `test/contrato.test.js`        *
 * recorre el repo entero exigiendo que TODO fichero `*.test.js` lo ejecute      *
 * exactamente un proyecto de Vitest, y esto no es una suite, es un catálogo.    *
 * Con el sufijo aparecería como un fichero de test sin un solo `it`. El         *
 * prefijo `_` sigue la convención de `parsers/_comun.js`: módulo de APOYO.      *
 *                                                                              *
 * ── QUÉ ES ESTE FICHERO, Y POR QUÉ EXISTE ───────────────────────────────────  *
 * Es la lista de las SITUACIONES REALES que producen cada uno de los motivos    *
 * de `services/catastro.js#MOTIVO_CATASTRO`. Tiene dos lectores y sirve a los   *
 * dos a la vez:                                                                *
 *                                                                              *
 *   1. **La máquina.** `test/services/contrato-catastro.test.js` (guardián      *
 *      G13) recorre `CASOS`, ejecuta cada uno de verdad, recoge los motivos     *
 *      que salen y exige que ese conjunto sea IGUAL —en los dos sentidos— a     *
 *      `Object.values(MOTIVO_CATASTRO)`. Añadir un motivo sin un caso que lo    *
 *      produzca pone la suite en rojo, con el nombre del motivo huérfano.       *
 *   2. **La persona.** Quien lo lea de arriba abajo tiene que poder contestar   *
 *      «¿y esto cuándo le pasa a un usuario?» para cada motivo, sin abrir el    *
 *      módulo. Por eso cada caso lleva `situacion` en español y dice de dónde   *
 *      sale su respuesta.                                                       *
 *                                                                              *
 * ── LA DECISIÓN QUE ESTE CATÁLOGO DEFIENDE ──────────────────────────────────  *
 * **No existe ningún motivo de «bloqueado» ni de «límite excedido».** No hay    *
 * `LIMITE_EXCEDIDO`, ni `BLOQUEADO`, ni `RATE_LIMITED`, y no es un descuido:    *
 * nadie ha medido —ni va a medir— qué contesta el Catastro a un cliente         *
 * denegado, porque provocarlo cuesta ~10 días de servicio (override O8;         *
 * `test/fixtures/catastro/PROCEDENCIA.md` lo declara como hueco A PROPÓSITO,    *
 * en «Huecos declarados»).                                                     *
 *                                                                              *
 * Un detector de una señal que nadie ha visto solo puede acabar de dos          *
 * maneras: o es **código muerto que además TRANQUILIZA** —parece que el caso    *
 * está cubierto y no lo está—, o **dispara en falso** y le dice al usuario que  *
 * está bloqueado cuando lo que se le ha caído es el wifi. Este fichero es la    *
 * formulación COMPROBABLE de «no rellenar huecos con plausibilidad»: un motivo  *
 * solo puede existir si aquí abajo hay una situación que lo produce.            *
 *                                                                              *
 * ── LA SUITE NO LLAMA AL CATASTRO JAMÁS ─────────────────────────────────────  *
 * El `fetch` entra siempre doblado (`_doble-fetch.js`), y los cuerpos son los   *
 * ficheros reales de `test/fixtures/` capturados con `curl` el 2026-07-27, con  *
 * su SHA-256 en `PROCEDENCIA.md`. Ningún caso construye un `globalThis.fetch`.  *
 *                                                                              *
 * Cada caso declara su `fuente`, y la distinción NO es cosmética:               *
 *   · `FIXTURE` — el cuerpo es verdad externa MEDIDA. Manda sobre nuestro       *
 *     criterio (regla de oro 8).                                                *
 *   · `DOBLE`   — el cuerpo o el fallo los fabrica el arnés porque **no hay     *
 *     fixture posible**: `PROCEDENCIA.md` deja escrito que no existe captura    *
 *     de servicio caído (5xx, timeout, DNS) ni de bloqueo por abuso, «y eso     *
 *     queda dicho aquí para que nadie lo confunda con verdad externa: no lo     *
 *     es». Los tres casos `DOBLE` de abajo son exactamente esos.                *
 *   · `LOCAL`   — la decisión se toma en el cliente sin preguntar a nadie, y    *
 *     se comprueba que **no se emite ni una petición** (`peticiones: 0`).       *
 *                                                                              *
 * ── CERO LITERALES INVENTADOS ───────────────────────────────────────────────  *
 * La referencia buena sale del GML; la inexistente, del `CDATA` del propio      *
 * `ExceptionReport`; el punto y su SRS, del `geo` de `ovc-rccoor-ok.json`; el   *
 * lado de las cajas, de `MAX_AREA_BBOX_M2`; el número de peticiones de un       *
 * fallo reintentable, de `BACKOFF.intentos`. Si un fixture cambia, esto lo      *
 * sigue solo.                                                                   *
 *                                                                              *
 * ⚠️ El guion del `fetch` doble NO mira la URL, y es deliberado: lo que este    *
 * catálogo mide es la CLASIFICACIÓN del cuerpo, no la construcción de la URL.   *
 * De eso responde `test/services/catastro.test.js`, que sí contrasta cada URL   *
 * contra la medida en `PROCEDENCIA.md` byte a byte.                            *
 *                                                                              *
 * ⚠️ ENCODING: los XML del Catastro declaran `ISO-8859-1` y sus bytes son       *
 * UTF-8 (mentira heredada del servicio). Se leen SIEMPRE como UTF-8.           *
 *                                                                              *
 * Proyecto Vitest `node`: ni DOM, ni Leaflet, ni IndexedDB.                     *
 * -------------------------------------------------------------------------- */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

import { BACKOFF, crearTransporte } from '../../services/_red.js'
import {
  MAX_AREA_BBOX_M2,
  MOTIVO_CATASTRO,
  crearClienteCatastro,
} from '../../services/catastro.js'
import { crearDobleDormir, crearDobleFetch, errorDeRed } from './_doble-fetch.js'

// ── Los ficheros de verdad externa ───────────────────────────────────────────

const DIR_FIXTURES = fileURLToPath(new URL('../fixtures/', import.meta.url))

/**
 * Lee un fixture por su ruta relativa a `test/fixtures/`, SIEMPRE como UTF-8.
 *
 * @param {string} rel  Por ejemplo `'catastro/wfs-bbox-vacio-mar.xml'`.
 * @returns {string}
 */
export const leerFixture = (rel) => readFileSync(`${DIR_FIXTURES}${rel}`, 'utf8')

/**
 * Rutas (relativas a `test/fixtures/`) de todo lo que usa este catálogo. Se
 * declaran en un solo sitio para que el guardián pueda comprobar que **cada
 * caso `FIXTURE` nombra un fichero que existe de verdad**: un catálogo que dice
 * apoyarse en verdad externa y nombra un fichero que no está sería justo la
 * clase de tranquilidad falsa que este fichero existe para impedir.
 *
 * @readonly
 */
export const FIXTURE = Object.freeze({
  /** `GetParcel` bueno. Vive en `../gml/` y NO se duplica (ver `PROCEDENCIA.md`). */
  PARCELA_OK: 'gml/cp_parcela_9398516VK3799G.gml',
  /** GML de EDIFICIO: un dialecto real que NO es una colección de parcelas CP 4.0. */
  EDIFICIO: 'gml/bu_building_9398516VK3799G.gml',
  /** «No se ha encontrado la parcela …»: el error que viene con HTTP 200. */
  EXC_RC_INEXISTENTE: 'catastro/wfs-exceptionreport-rc-inexistente.xml',
  /** «No records founded for BBOX…»: idéntico al anterior salvo por el texto libre. */
  EXC_BBOX_VACIO: 'catastro/wfs-bbox-vacio-mar.xml',
  /** OVC: el camino de éxito, con la RC partida en `pc1` + `pc2`. */
  OVC_OK: 'catastro/ovc-rccoor-ok.json',
  /** OVC `cod:16` — «para esas coordenadas no hay referencia disponible». */
  OVC_COD16: 'catastro/ovc-rccoor-cod16.json',
  /** OVC `cod:76` — la URL la construimos MAL nosotros. No es «no hay parcela». */
  OVC_COD76: 'catastro/ovc-rccoor-cod76.json',
})

const GML_PARCELA = leerFixture(FIXTURE.PARCELA_OK)
const GML_EDIFICIO = leerFixture(FIXTURE.EDIFICIO)
const EXC_RC_INEXISTENTE = leerFixture(FIXTURE.EXC_RC_INEXISTENTE)
const EXC_BBOX_VACIO = leerFixture(FIXTURE.EXC_BBOX_VACIO)
const OVC_OK = leerFixture(FIXTURE.OVC_OK)
const OVC_COD16 = leerFixture(FIXTURE.OVC_COD16)
const OVC_COD76 = leerFixture(FIXTURE.OVC_COD76)

// ── Datos DERIVADOS de los ficheros (aquí no se teclea ningún literal) ───────

/**
 * La referencia catastral BUENA, leída del GML medido. No se escribe a mano: si
 * el fixture se sustituyera por otra parcela, todo este catálogo la seguiría.
 */
export const RC_BUENA = /<cp:nationalCadastralReference>([^<]+)</.exec(GML_PARCELA)?.[1] ?? ''

/**
 * La referencia INEXISTENTE, leída del `CDATA` del propio `ExceptionReport`
 * («No se ha encontrado la parcela 0000000XX0000X para el huso 25830»). Es
 * sintácticamente plausible y no existe: el caso «el usuario tecleó bien y la
 * parcela no está», que es distinto de «el usuario tecleó cualquier cosa».
 */
export const RC_INEXISTENTE = /parcela\s+([0-9A-Z]{14})\b/.exec(EXC_RC_INEXISTENTE)?.[1] ?? ''

/** El `geo` del fixture de éxito del OVC: punto medido y SRS con el que se midió. */
const GEO_MEDIDO = JSON.parse(OVC_OK).Consulta_RCCOORResult.coordenadas.coord[0].geo

/** Este del punto medido, en metros. */
export const X_MEDIDO = Number(GEO_MEDIDO.xcen)
/** Norte del punto medido, en metros. */
export const Y_MEDIDO = Number(GEO_MEDIDO.ycen)
/** El SRS con el que se capturaron los fixtures, dicho por el propio fixture. */
export const SRS_MEDIDO = GEO_MEDIDO.srs

/**
 * Desplazamiento al norte que saca el punto medido de España sin salirse del
 * dominio numérico de la proyección: 1.500 km sobre un país que mide ~1.000 km
 * de sur a norte. Es el «clic en el sitio equivocado» del mapa, que llega hasta
 * mucho más allá de la frontera.
 */
const SALTO_FUERA_DE_ESPANA = 1_500_000

/**
 * Medio lado del tope de área. Una caja de `LADO_ADMITIDO` × `LADO_ADMITIDO`
 * mide la CUARTA parte de {@link MAX_AREA_BBOX_M2}: holgadamente admitida, y
 * derivada del propio tope en vez de ser un 500 escrito a mano.
 */
const LADO_ADMITIDO = Math.sqrt(MAX_AREA_BBOX_M2) / 2

/**
 * Lado que se pasa del tope. `sqrt(MAX) + 1` es el primer entero cuyo cuadrado
 * excede el tope: el caso mínimo que lo rebasa, no una exageración.
 */
const LADO_EXCESIVO = Math.ceil(Math.sqrt(MAX_AREA_BBOX_M2)) + 1

/** Caja cuadrada de lado `lado` anclada en el punto medido. */
const cajaDe = (lado) => ({
  minX: X_MEDIDO,
  minY: Y_MEDIDO,
  maxX: X_MEDIDO + lado,
  maxY: Y_MEDIDO + lado,
})

// ── El arnés ─────────────────────────────────────────────────────────────────

/**
 * De dónde sale la respuesta de un caso. Ver la cabecera: la distinción entre
 * `FIXTURE` y `DOBLE` es la frontera entre lo medido y lo fabricado, y no se
 * borra.
 *
 * @readonly
 */
export const FUENTE = Object.freeze({
  /** Cuerpo real capturado con `curl`, con su SHA-256 en `PROCEDENCIA.md`. */
  FIXTURE: 'FIXTURE',
  /** Fallo fabricado por el arnés: no hay captura posible (servicio caído). */
  DOBLE: 'DOBLE',
  /** No hay respuesta: el cliente decide sin salir a la red. */
  LOCAL: 'LOCAL',
})

/**
 * Guion que el `fetch` doble NO debería llegar a ejecutar nunca. Se usa en los
 * casos `LOCAL`, donde lo que se afirma es que no se emite ni una petición.
 *
 * Es un 4xx a propósito: el transporte no reintenta un 4xx, así que si algún día
 * un caso `LOCAL` tocara la red, el caso fallaría **rápido y por el motivo
 * equivocado** (`ESTADO_HTTP` en vez del suyo), que es exactamente como se quiere
 * enterar uno.
 */
const PLAN_PROHIBIDO = {
  estado: 418,
  texto: 'este cuerpo no debería pedirse nunca: el caso es LOCAL',
}

/**
 * Monta transporte + cliente + dobles. `alAvisar` es un espía en los dos, así que
 * ningún caso escribe en la consola.
 *
 * `aleatorio: () => 0` fija el jitter del backoff en su extremo inferior: las
 * esperas salen de 0 ms y el catálogo entero corre sin gastar tiempo real.
 *
 * @param {object} [opciones]
 * @param {import('./_doble-fetch.js').GuionFetch|Function} [opciones.plan]
 * @param {boolean} [opciones.venceElReloj=false]  Ver `crearDobleDormir`.
 * @returns {{cliente: object, transporte: object, red: object, esperas: object,
 *            avisos: {mensaje: string, detalle: *}[]}}
 */
export function montar({ plan = PLAN_PROHIBIDO, venceElReloj = false } = {}) {
  const red = crearDobleFetch({ plan })
  const esperas = crearDobleDormir({ venceElReloj })
  const avisos = []
  const espia = (mensaje, detalle) => avisos.push({ mensaje, detalle })
  const transporte = crearTransporte({
    fetch: red.fetch,
    dormir: esperas.dormir,
    aleatorio: () => 0,
    alAvisar: espia,
  })
  const cliente = crearClienteCatastro({ transporte, alAvisar: espia })
  return { cliente, transporte, red, esperas, avisos }
}

/**
 * Lo que devuelve `caso.ejecutar()`. Se devuelve el `ResultadoCatastro` ENTERO y
 * no solo su `motivo` para que el guardián pueda comprobar de paso los
 * invariantes del contrato (`ok ⟺ datos ⟺ motivo ⟺ mensaje`), y el recuento de
 * peticiones para que «no se emite la petición» sea afirmable y no un deseo.
 *
 * @typedef {Object} EjecucionCaso
 * @property {import('../../services/catastro.js').ResultadoCatastro} resultado
 * @property {number} peticiones  Llamadas al `fetch` doble. Cero ⟺ no hubo red.
 * @property {{mensaje: string, detalle: *}[]} avisos  Lo que salió por el canal.
 */

/**
 * Un caso del catálogo.
 *
 * @typedef {Object} CasoCatastro
 * @property {string} nombre  Corto y en español: lo que le pasa al usuario.
 * @property {string} motivo  Clave de `MOTIVO_CATASTRO` que DEBE salir.
 * @property {string} situacion  El porqué, legible sin abrir el módulo.
 * @property {'FIXTURE'|'DOBLE'|'LOCAL'} fuente
 * @property {string|null} fixture  Ruta relativa a `test/fixtures/`, o `null`.
 * @property {number} peticiones  Cuántas llamadas al `fetch` se esperan.
 * @property {() => Promise<EjecucionCaso>} ejecutar
 */

// ── EL CATÁLOGO ──────────────────────────────────────────────────────────────
// Un motivo puede tener VARIOS casos, y varios los tienen: son situaciones que
// el servicio NO distingue y que aquí se dejan escritas una al lado de otra,
// precisamente para que se vea que no se distinguen.

/** @type {ReadonlyArray<CasoCatastro>} */
export const CASOS = Object.freeze([
  // ── ENTRADA_INVALIDA ──────────────────────────────────────────────────────
  {
    nombre: 'la referencia catastral está mal tecleada',
    motivo: MOTIVO_CATASTRO.ENTRADA_INVALIDA,
    situacion:
      'El usuario escribe en el campo algo que no tiene forma de referencia catastral de ' +
      'parcela (14 caracteres, letras y números). La consulta se para en el cliente y NO se ' +
      'emite ninguna petición: es dato del usuario, así que sale como estado y no como ' +
      'excepción.',
    fuente: FUENTE.LOCAL,
    fixture: null,
    peticiones: 0,
    async ejecutar() {
      const { cliente, red, avisos } = montar()
      const resultado = await cliente.parcelaPorRefcat('esto no es una referencia')
      return { resultado, peticiones: red.total, avisos }
    },
  },
  {
    nombre: 'el usuario pincha el mapa fuera de España',
    motivo: MOTIVO_CATASTRO.ENTRADA_INVALIDA,
    situacion:
      'El mapa llega hasta Marruecos y hasta Francia, y hacer clic en el sitio equivocado no ' +
      'puede reventar la app. El punto medido, desplazado 1.500 km al norte, ya no cae en ' +
      'España: no se emite la petición porque el OVC contestaría «aquí no hay parcela», y eso ' +
      'sería mentir sobre la causa.',
    fuente: FUENTE.LOCAL,
    fixture: null,
    peticiones: 0,
    async ejecutar() {
      const { cliente, red, avisos } = montar()
      const resultado = await cliente.refcatPorCoordenada(
        X_MEDIDO,
        Y_MEDIDO + SALTO_FUERA_DE_ESPANA,
      )
      return { resultado, peticiones: red.total, avisos }
    },
  },

  // ── NO_ENCONTRADO ─────────────────────────────────────────────────────────
  // Tres situaciones distintas y un solo motivo. Las dos primeras llegan del
  // WFS con EL MISMO `exceptionCode` y solo se diferencian en el texto libre
  // del CDATA, que no se analiza jamás: por eso NO se distinguen, y por eso
  // están aquí las dos.
  {
    nombre: 'la referencia catastral no existe',
    motivo: MOTIVO_CATASTRO.NO_ENCONTRADO,
    situacion:
      'El usuario teclea bien una referencia que el Catastro no tiene. Llega un ' +
      '`ExceptionReport` con HTTP 200 y `exceptionCode="OperationProcessingFailed"`. No es un ' +
      'fallo de la herramienta (override C6): hay suelo sin parcela, y el País Vasco y ' +
      'Navarra tienen catastro propio.',
    fuente: FUENTE.FIXTURE,
    fixture: FIXTURE.EXC_RC_INEXISTENTE,
    peticiones: 1,
    async ejecutar() {
      const { cliente, red, avisos } = montar({
        plan: { estado: 200, texto: EXC_RC_INEXISTENTE },
      })
      const resultado = await cliente.parcelaPorRefcat(RC_INEXISTENTE)
      return { resultado, peticiones: red.total, avisos }
    },
  },
  {
    nombre: 'no hay ninguna parcela en el encuadre (mar abierto)',
    motivo: MOTIVO_CATASTRO.NO_ENCONTRADO,
    situacion:
      'MEDIDO: una caja sin parcelas NO devuelve una colección vacía, devuelve un ' +
      '`ExceptionReport` byte por byte de la misma forma que el de referencia inexistente. ' +
      'El servicio usa UN código para las dos cosas, así que salen con el MISMO motivo y esta ' +
      'herramienta no puede distinguirlas. Está aquí al lado del anterior para que se vea.',
    fuente: FUENTE.FIXTURE,
    fixture: FIXTURE.EXC_BBOX_VACIO,
    peticiones: 1,
    async ejecutar() {
      const { cliente, red, avisos } = montar({ plan: { estado: 200, texto: EXC_BBOX_VACIO } })
      const resultado = await cliente.parcelasEnBbox(cajaDe(LADO_ADMITIDO))
      return { resultado, peticiones: red.total, avisos }
    },
  },
  {
    nombre: 'la geocodificación inversa no encuentra parcela en el punto',
    motivo: MOTIVO_CATASTRO.NO_ENCONTRADO,
    situacion:
      'El OVC contesta `cod:16` — «PARA ESAS COORDENADAS NO HAY REFERENCIA DISPONIBLE» —, que ' +
      'es su forma de decir que ahí no hay nada. Es el ÚNICO `cod` del OVC que significa eso; ' +
      'los demás son fallos técnicos (ver el caso del `cod:76`).',
    fuente: FUENTE.FIXTURE,
    fixture: FIXTURE.OVC_COD16,
    peticiones: 1,
    async ejecutar() {
      const { cliente, red, avisos } = montar({ plan: { estado: 200, texto: OVC_COD16 } })
      const resultado = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)
      return { resultado, peticiones: red.total, avisos }
    },
  },

  // ── BBOX_DEMASIADO_GRANDE ─────────────────────────────────────────────────
  {
    nombre: 'el usuario aleja el mapa y pide un encuadre mayor que el tope',
    motivo: MOTIVO_CATASTRO.BBOX_DEMASIADO_GRANDE,
    situacion:
      'Hacer zoom out no es un bug y no puede reventar la app, así que es estado y no ' +
      '`throw`. Se comprueba ANTES de emitir: medido, 600 × 600 m devolvieron 539 parcelas y ' +
      '~1,15 MB, o sea que a un tercio del tope ya se descarga un megabyte.',
    fuente: FUENTE.LOCAL,
    fixture: null,
    peticiones: 0,
    async ejecutar() {
      const { cliente, red, avisos } = montar()
      const resultado = await cliente.parcelasEnBbox(cajaDe(LADO_EXCESIVO))
      return { resultado, peticiones: red.total, avisos }
    },
  },

  // ── RESPUESTA_ILEGIBLE ────────────────────────────────────────────────────
  // «Ha contestado algo que esta aplicación no sabe usar». Apunta a un cambio
  // del servicio o a un fallo NUESTRO, nunca a que el dato no exista — y esa
  // diferencia es justo la que `services/_catastro-ovc.js` existe para no
  // borrar.
  {
    nombre: 'el WFS contesta un GML de otro tema (edificio, no parcela)',
    motivo: MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
    situacion:
      'Un GML perfectamente válido del dialecto de EDIFICIO donde se esperaba una colección ' +
      'de parcelas CP 4.0. No se devuelve una colección vacía: se dice qué ha llegado. El ' +
      'detalle técnico viaja íntegro en `mensaje`.',
    fuente: FUENTE.FIXTURE,
    fixture: FIXTURE.EDIFICIO,
    peticiones: 1,
    async ejecutar() {
      const { cliente, red, avisos } = montar({ plan: { estado: 200, texto: GML_EDIFICIO } })
      const resultado = await cliente.parcelaPorRefcat(RC_BUENA)
      return { resultado, peticiones: red.total, avisos }
    },
  },
  {
    nombre: 'la URL del OVC la hemos construido mal nosotros (`cod:76`)',
    motivo: MOTIVO_CATASTRO.RESPUESTA_ILEGIBLE,
    situacion:
      'El OVC contesta `cod:76` — «LA COORDENADA X OBLIGATORIA» — con HTTP 200. Un lector ' +
      'ingenuo traduciría cualquier `cuerr` a «aquí no hay parcela»: el usuario movería el ' +
      'marcador, volvería a leer «aquí no hay nada» y concluiría que el Catastro está caído, ' +
      'cuando el fallo es nuestro y está en CADA petición. Sale como fallo técnico.',
    fuente: FUENTE.FIXTURE,
    fixture: FIXTURE.OVC_COD76,
    peticiones: 1,
    async ejecutar() {
      const { cliente, red, avisos } = montar({ plan: { estado: 200, texto: OVC_COD76 } })
      const resultado = await cliente.refcatPorCoordenada(X_MEDIDO, Y_MEDIDO)
      return { resultado, peticiones: red.total, avisos }
    },
  },

  // ── ESTADO_HTTP · TIEMPO_AGOTADO · SIN_RED ────────────────────────────────
  // Los TRES son `DOBLE`, y `PROCEDENCIA.md` explica por qué en «Huecos
  // declarados»: «No hay fixture de servicio caído (5xx, timeout, DNS). No es
  // capturable a voluntad sin provocarlo, y provocarlo es exactamente lo que la
  // política de uso del Catastro sanciona con ~10 días de denegación».
  {
    nombre: 'el servicio del Catastro está caído (5xx)',
    motivo: MOTIVO_CATASTRO.ESTADO_HTTP,
    situacion:
      'Un 503 se reintenta —el servidor dice que el fallo es suyo, y suyo puede ser el arreglo ' +
      'un segundo después— hasta agotar `BACKOFF.intentos`, y entonces sale con el número de ' +
      'estado exacto para que la UI pueda distinguirlo sin leer una palabra en español. ' +
      'Medido: el Catastro NUNCA contestó 4xx ni 5xx en las 8 capturas; este caso no es ' +
      'verdad externa y por eso se declara `DOBLE`.',
    fuente: FUENTE.DOBLE,
    fixture: null,
    peticiones: BACKOFF.intentos,
    async ejecutar() {
      const { cliente, red, avisos } = montar({ plan: { estado: 503 } })
      const resultado = await cliente.parcelaPorRefcat(RC_BUENA)
      return { resultado, peticiones: red.total, avisos }
    },
  },
  {
    nombre: 'el servicio no contesta dentro del plazo',
    motivo: MOTIVO_CATASTRO.TIEMPO_AGOTADO,
    situacion:
      'La petición se queda colgada y vence el reloj de `MS_TIMEOUT`. NO se reintenta: ya se ' +
      'ha esperado un orden de magnitud por encima de lo peor medido (2,9 s en el OVC), y ' +
      'echarle dos peticiones más encima a un servicio saturado es la oleada que el Catastro ' +
      'penaliza. El plazo se hace vencer inyectando la espera, sin temporizadores falsos.',
    fuente: FUENTE.DOBLE,
    fixture: null,
    peticiones: 1,
    async ejecutar() {
      const { cliente, red, avisos } = montar({
        plan: { pendiente: true },
        venceElReloj: true,
      })
      const resultado = await cliente.parcelaPorRefcat(RC_BUENA)
      return { resultado, peticiones: red.total, avisos }
    },
  },
  {
    nombre: 'no hay conexión (o DNS, o TLS, o CORS: no se distinguen)',
    motivo: MOTIVO_CATASTRO.SIN_RED,
    situacion:
      'El `fetch` RECHAZA sin llegar a haber respuesta. Los cuatro casos llegan con el MISMO ' +
      '`TypeError: Failed to fetch` y el motivo real solo aparece en la consola de devtools, ' +
      'escrito por el navegador e inalcanzable desde script. Un motivo y un mensaje que nombra ' +
      'las cuatro posibilidades, en vez de sonar seguros de algo que no sabemos.',
    fuente: FUENTE.DOBLE,
    fixture: null,
    peticiones: BACKOFF.intentos,
    async ejecutar() {
      const { cliente, red, avisos } = montar({ plan: { error: errorDeRed() } })
      const resultado = await cliente.parcelaPorRefcat(RC_BUENA)
      return { resultado, peticiones: red.total, avisos }
    },
  },

  // ── CANCELADA ─────────────────────────────────────────────────────────────
  {
    nombre: 'la pantalla se cierra mientras la consulta estaba en marcha',
    motivo: MOTIVO_CATASTRO.CANCELADA,
    situacion:
      'Pedir sobre un cliente ya destruido no es un bug: es la carrera normal entre una ' +
      'pantalla que se cierra y un manejador que ya estaba en marcha. Devuelve resultado en ' +
      'vez de lanzar, para no obligar a envolver cada llamada en un `try`. Y no cuenta como ' +
      'fallo del servicio: cancelar es una decisión de la app.',
    fuente: FUENTE.LOCAL,
    fixture: null,
    peticiones: 0,
    async ejecutar() {
      const { cliente, red, avisos } = montar()
      cliente.destruir()
      const resultado = await cliente.parcelaPorRefcat(RC_BUENA)
      return { resultado, peticiones: red.total, avisos }
    },
  },
])

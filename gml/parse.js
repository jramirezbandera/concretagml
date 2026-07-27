// gml/parse.js — F04 · Lectura de un GML de PARCELA (tarea T3.1).
//
// Es la puerta de ENTRADA de la rama `gml/`: recibe el texto de un GML —el que
// devuelve el WFS del Catastro, el que trae el técnico de otro programa, o el que
// este mismo proyecto acaba de escribir— y lo convierte en datos planos que el
// resto de la aplicación entiende. Dos consumidores, y los dos mandan sobre su
// diseño:
//
//   · F04 (test de ida y vuelta) — `parse(fixture) → serialize` tiene que
//     reproducir el fichero del WFS. Por eso aquí se conserva TODO lo que el
//     serializador vuelve a necesitar (el `timeStamp` de la raíz, el `areaValue`
//     DECLARADO, el `gml:id`, el `namespace` del inspireId) aunque a la app le dé
//     igual: cada dato que este módulo tire por el camino es una línea más en la
//     lista de «cosas que la comparación ignora», y esa lista es justo la medida
//     de lo mal que estaría el round-trip.
//   · F08 (comprobar un GML ajeno) — el recorrido «cargar GML → comprobar →
//     diagnosticar». F08 pide poder tolerar el dialecto 4.0 y el de edificio,
//     detectar un 3.0 antiguo y avisar, admitir varias parcelas dejando ELEGIR, y
//     tratar un SRS o un huso inesperado como NOTA CLARA y no como error de
//     programa. Todo eso está implementado aquí abajo, y de ahí salen las tres
//     decisiones que gobiernan el módulo:
//
// ── (1) UN FICHERO MALO DEL USUARIO PRODUCE DETECCIONES, JAMÁS UNA EXCEPCIÓN ──
// Es la frontera de SPEC §2.1, la misma que ya trazan `parsers/importar.js` y
// `gml/xml.js`: XML sin cerrar, raíz ajena, `posList` con letras, SRS de otro
// continente… todo sale por `detecciones` (regla de oro 1: ningún error
// silencioso, y «esto no vale» a secas tampoco es una respuesta). El `throw` se
// reserva al contrato roto por el PROGRAMADOR: `xml` que no es un string.
// `xml` es texto YA DECODIFICADO: este módulo no toca bytes ni encodings — pero
// sí REPORTA el `encoding` que el prólogo declara, porque los GML del WFS dicen
// ISO-8859-1 y el que este proyecto emite es UTF-8, y esa diferencia se cuenta.
//
// ── (2) UN 3.0 SE RECHAZA *Y* SE LEE ─────────────────────────────────────────
// `UTM_1.gml` (CP 3.0) sale con `soportado:false` y su `DIALECTO_RECHAZADO`,
// pero `parcelas` VIENE RELLENA. No es una contradicción: el valor de F08 con un
// fichero de 2015 delante es «tu GML es de la versión que la Sede ya no admite,
// aquí está tu parcela, te la reescribo en 4.0». Devolver `parcelas:[]` mataría
// ese recorrido entero por respetar una pureza que no sirve a nadie. El GML de
// EDIFICIO, en cambio, sí sale con `parcelas:[]`: no es un fichero equivocado, es
// OTRO TEMA (su lector y su serializador son F13), y fingir que se le puede sacar
// una parcela sería peor que decir que no.
//
// ── (3) LOS ANILLOS SALEN ABIERTOS Y **SIN REORIENTAR** ──────────────────────
// SIN REORIENTAR porque el diagnóstico de F08 es precisamente «tu anillo exterior
// está antihorario y el Catastro lo quiere horario» (override O1). Si este módulo
// arreglara la orientación al vuelo, ese diagnóstico sería imposible de dar: el
// dato ya no estaría. Por eso cada recinto trae su `orientacion` (−1 horario,
// +1 antihorario) tal como venía, y la normalización se queda donde le toca, en
// el serializador.
// ABIERTOS porque el modelo vive abierto (regla de oro 4: el vértice de cierre se
// añade solo al serializar) — y porque `model/parcela.js#crearRecinto` emite un
// `console.warn` por CADA anillo cerrado que recibe. Como en GML todos los
// anillos vienen cerrados por definición, delegar el cierre en `crearRecinto`
// llenaría la consola de ruido en cada fichero legítimo, y un aviso que sale
// siempre es un aviso que ya no se lee. Se abre aquí, y se dice: `CIERRE_RETIRADO`
// (INFO) si el último par repetía al primero, `ANILLO_NO_CERRADO` (ERROR) si no.
// De ahí también que la salida sean `recintos` y NO una `Parcela` de
// `model/parcela.js`: `crearParcela` exige `idLocal` y `origen`, que son
// decisiones del LLAMANTE (¿expediente nuevo?, ¿GML_EXISTENTE o WFS?), no del
// lector. Los recintos se construyen como POJO plano aquí mismo, sin pasar por
// `crearRecinto`, por el motivo del `console.warn` de arriba y porque un anillo
// degenerado (dos vértices idénticos) volvería a disparar el aviso al abrirlo.
//
// ── LO QUE ESTE MÓDULO NO HACE, A PROPÓSITO ──────────────────────────────────
//   · NO recalcula la superficie. `areaValue` es el DECLARADO en el fichero. El
//     cotejo con la shoelace de las coordenadas es diagnóstico (F07/F08) y se
//     hace con `geo/area.js`, que ya existe: aquí se conserva el dato tal cual
//     para que la comparación tenga los DOS términos.
//   · NO reproyecta ni deduce el huso por su cuenta. Se conserva el `srsName`
//     leído y su análisis; el cotejo «¿las coordenadas caen donde dice el
//     `srsName`?» lo hace el llamante con `geo/huso.js#detectarHuso`, y no se
//     hace aquí por dos motivos: el vocabulario de {@link TIPO_GML} está cerrado
//     y ninguno de sus 25 tipos significa «coordenadas fuera del huso declarado»,
//     y `detectarHuso` avisa por escrito de que en modo autodetección «equivale a
//     asumir huso 30» — una nota construida sobre eso sería un falso positivo
//     disfrazado de hecho, justo lo contrario de la regla de oro 9.
//   · NO valida geometría (autointersecciones, vértices repetidos, mínimo de
//     puntos): eso es `validation/parcela.js` (F02), que ya está en verde.
//
// EL RELOJ NO SE LEE AQUÍ, igual que en el resto de `gml/`: el módulo es una
// función PURA de su entrada, para que el snapshot del test de ida y vuelta valga
// lo mismo hoy que dentro de un año. Un test lo comprueba con un grep sobre el
// TEXTO de este fichero, así que la instanciación de fechas y la consulta de la
// marca de tiempo del sistema no deben aparecer ni dentro de un comentario.
//
// Dependencias: `gml/_comun.js` (vocabulario), `gml/xml.js` (lector XML propio),
// `geo/area.js` (signo del área — el shoelace canónico del proyecto, con su
// traslación a origen local) y la constante `TIPO_RECINTO` de `model/parcela.js`.
// Ni Leaflet, ni Turf, ni proj4: corre igual en el proyecto Vitest `node` y en el
// bundle de navegador.

import {
  DIALECTO,
  ELEMENTOS_PROSCRITOS_CP40,
  NS,
  ORDEN_CADASTRAL_PARCEL,
  SEVERIDAD,
  SRS_SOPORTADOS,
  TIPO_GML,
  clasificarDialecto,
  crearDeteccionGml,
  normalizarSrsName,
  srsCorto,
  srsNamePorForma,
} from './_comun.js'
import { SIN_NAMESPACE, atributo, hijo, hijoUnico, hijos, parsearXml, texto } from './xml.js'
import { orientacion } from '../geo/area.js'
import { TIPO_RECINTO } from '../model/parcela.js'

// ── Constantes ────────────────────────────────────────────────────────────────

/**
 * Tope de errores de XML mal formado que se convierten en detecciones, una a una.
 * `gml/xml.js` corta en seco ante un error irrecuperable, pero los recuperables
 * (un «&» suelto, una entidad ajena, un atributo repetido) se acumulan: un
 * fichero hostil podría traer miles y sepultar el resto del informe. Pasado el
 * tope se emite UNA detección más diciendo cuántos quedan sin detallar — que es
 * distinto de tragárselos (regla de oro 1).
 */
export const MAX_ERRORES_XML = 20

/**
 * Un número tal como GML lo escribe. Deliberadamente MÁS ESTRICTO que `Number`:
 * `Number('0x1A')`, `Number('Infinity')` y `Number('1_0')` devuelven valores
 * finitos o infinitos sin protestar, y ninguno de los tres es un token legítimo
 * de un `gml:posList`. Colarlos sería meter en el modelo una coordenada que el
 * fichero no dice — el error silencioso que la regla de oro 1 prohíbe.
 */
const RE_NUMERO = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/

/**
 * Declaraciones de namespace tal como aparecen en el TEXTO del documento.
 *
 * Se leen del texto y no del árbol A PROPÓSITO: `gml/xml.js` descarta las
 * declaraciones `xmlns`/`xmlns:p` de la lista de atributos (son maquinaria, y su
 * efecto ya está aplicado en el `ns` de cada nodo), así que el árbol NO puede
 * decir qué namespaces declaró el fichero — solo cuáles se usan, que es otra cosa
 * (el GML del WFS declara `gmd` y no lo usa en ningún elemento). Como
 * `nsDeclarados` es dato INFORMATIVO del resumen —«qué dice este fichero de sí
 * mismo», para el panel de comprobación de F08— y no entra en ninguna decisión,
 * el barrido de texto es honesto: a lo sumo recogerá de más si un comentario
 * contiene un `xmlns=`.
 */
const RE_XMLNS = /\bxmlns(?::[\w.-]+)?\s*=\s*(?:"([^"]*)"|'([^']*)')/g

/** Formas del `encoding` del prólogo que son UTF-8 (el que este proyecto emite). */
const ENCODINGS_UTF8 = Object.freeze(['utf-8', 'utf8'])

/**
 * Por qué un EPSG concreto no se admite, cuando la razón NO es «no está en la
 * lista» sino algo que el usuario tiene que entender para arreglar su fichero.
 * Se escriben aquí y no en el sitio de uso para que el mensaje sea uno solo.
 *
 * @readonly
 */
const MOTIVOS_SRS_NO_SOPORTADO = Object.freeze({
  4326:
    'EPSG:4326 (WGS84 geográficas) declara los ejes en el orden LATITUD, LONGITUD, ' +
    'y este proyecto lee el `posList` como pares [x=Este, y=Norte]: tomarlo tal cual ' +
    'metería la latitud donde va el Este y violaría de raíz la regla de oro 3 ' +
    '(el modelo vive SIEMPRE en UTM, nunca en lat/lon). Reproyecta el fichero a ' +
    'ETRS89/UTM (25829, 25830 o 25831) antes de comprobarlo.',
  32628:
    'EPSG:32628 (WGS84/UTM 28N) es el sistema de Canarias, DIFERIDA por decisión de ' +
    'alcance del proyecto (override O13): el motor UTM y la detección de huso solo ' +
    'cubren hoy Península y Baleares.',
})

// ── Typedefs del contrato ─────────────────────────────────────────────────────

/**
 * Un recinto (anillo) leído del GML. Misma FORMA que lo que produce
 * `model/parcela.js#crearRecinto` —`{vertices, tipo}`, coordenadas `[x, y]` en
 * UTM— para que el llamante pueda pasárselo a `crearParcela` sin adaptador, pero
 * construido aquí como POJO plano: ver la decisión (3) de la cabecera.
 *
 * Los vértices vienen ABIERTOS (sin repetir el primero al final) y en el ORDEN y
 * la ORIENTACIÓN que traía el fichero.
 *
 * @typedef {Object} RecintoGml
 * @property {Array<[number, number]>} vertices  Pares UTM `[Este, Norte]`.
 * @property {'EXTERIOR'|'HUECO'} tipo  `recintos[0]` es el EXTERIOR; el resto, huecos.
 */

/**
 * Una parcela leída del GML: UNA por `member`/`featureMember` del documento.
 *
 * @typedef {Object} ParcelaGml
 * @property {string|null} refcat  `cp:nationalCadastralReference`. `''` si el
 *   elemento está pero vacío (el 3.0 lo deja en blanco a propósito), `null` si NO
 *   está: son cosas distintas y no se confunden.
 * @property {string|null} localId  `localId` del `inspireId`.
 * @property {string|null} namespaceInspire  `namespace` del `inspireId`
 *   (`'ES.SDGC.CP'` en el GML del WFS, `'ES.LOCAL.CP'` en un alta de particular).
 * @property {string|null} label  `cp:label`.
 * @property {string|null} gmlId  Atributo `gml:id` del feature.
 * @property {number|null} areaValue  El `cp:areaValue` **DECLARADO** en el
 *   fichero. NO se recalcula: ver «lo que este módulo no hace» en la cabecera.
 * @property {string|null} beginLifespanVersion  dateTime tal cual; `null` si el
 *   elemento falta o viene con `xsi:nil="true"`.
 * @property {[number, number]|null} puntoReferencia  El `gml:pos` del
 *   `cp:referencePoint`, en UTM.
 * @property {RecintoGml[]} recintos  Abiertos y sin reorientar. Vacío si no se
 *   pudo leer ninguna geometría (con su detección al lado).
 * @property {Array<-1|1>} orientacion  Signo del área firmada de cada recinto,
 *   TAL COMO VENÍA: −1 horario (lo que quiere el Catastro en el exterior),
 *   +1 antihorario. Mismo orden y longitud que `recintos`.
 * @property {string|null} srs  Forma corta (`'EPSG:25830'`) del sistema de
 *   referencia, la que consumen `model/` y `geo/huso.js`. `null` si falta, si no
 *   es uno de los soportados o si el documento se contradice a sí mismo.
 * @property {import('./_comun.js').AnalisisSrs|null} srsName  El análisis del
 *   `srsName` crudo (forma, código y si es la canónica del 4.0).
 * @property {number} nSurfaceMembers  Cuántos `gml:surfaceMember` traía la
 *   geometría. `0` si no venía envuelta en `gml:MultiSurface`.
 */

/**
 * @typedef {Object} ResumenParseGml
 * @property {string} dialecto  Clave de {@link DIALECTO}.
 * @property {{ns: string, local: string}|null} raiz  Elemento raíz observado;
 *   `null` si el documento no llegó a tener uno. `ns` es `''` si no tiene.
 * @property {string|null} encodingDeclarado  El `encoding` del prólogo, tal cual.
 * @property {number} nMiembros  Contenedores de feature encontrados en la raíz.
 * @property {{timeStamp: string|null, numberMatched: string|null,
 *   numberReturned: string|null}} wfs  Atributos de la raíz WFS 2.0, SIN
 *   convertir: `numberMatched` admite el valor `'unknown'` y el `timeStamp` se le
 *   pasa tal cual al serializador en el test de ida y vuelta.
 * @property {string[]} nsDeclarados  Namespaces declarados en el texto, en orden
 *   de aparición y sin repetir.
 * @property {string[]} bloqueos  Tipos de detección de severidad ERROR, sin
 *   repetir: por qué este fichero no se puede dar por bueno tal como está.
 * @property {{total: number, porTipo: object, porSeveridad: object}} detecciones
 */

/**
 * @typedef {Object} ResultadoParseGml
 * @property {string} dialecto  Clave de {@link DIALECTO}.
 * @property {boolean} soportado  `true` solo en CP 4.0.
 * @property {ParcelaGml[]} parcelas  Una por miembro. Rellena también en CP 3.0
 *   (ver la decisión (2) de la cabecera); vacía en GML de edificio.
 * @property {import('./_comun.js').DeteccionGml[]} detecciones
 * @property {ResumenParseGml} resumen
 */

// ── Detecciones ───────────────────────────────────────────────────────────────

/** Contexto de una llamada: la lista de detecciones que se va llenando. */
function crearContexto() {
  return { detecciones: [] }
}

/** Añade una detección de documento (sin miembro asociado). */
function anota(ctx, tipo, mensaje, severidad, datos) {
  ctx.detecciones.push(crearDeteccionGml(tipo, mensaje, severidad, datos))
}

/**
 * Añade una detección atribuida a un MIEMBRO concreto. El índice va dentro de
 * `datos` para que la UI de F08 —que deja elegir parcela cuando hay varias— sepa
 * a cuál de ellas pertenece cada aviso, en vez de mostrarlas todas juntas sin
 * dueño.
 */
function anotaEn(ctx, miembro, tipo, mensaje, severidad, datos) {
  anota(ctx, tipo, mensaje, severidad, { miembro, ...(datos ?? {}) })
}

/** Recuentos del resumen. Misma forma que `parsers/importar.js#contarDetecciones`. */
function contarDetecciones(detecciones) {
  const porTipo = {}
  const porSeveridad = { INFO: 0, AVISO: 0, ERROR: 0 }
  for (const d of detecciones) {
    porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + 1
    porSeveridad[d.severidad] += 1
  }
  return { total: detecciones.length, porTipo, porSeveridad }
}

// ── Utilidades de árbol ───────────────────────────────────────────────────────

/** Todos los descendientes-elemento de un nodo, en orden de documento. */
function descendientes(nodo, acc = []) {
  for (const h of nodo.hijos) {
    acc.push(h)
    descendientes(h, acc)
  }
  return acc
}

/**
 * Texto de un elemento que puede venir anulado. `xsi:nil="true"` es AUSENCIA
 * declarada (así viene `cp:endLifespanVersion` en el fixture del WFS y
 * `cp:beginLifespanVersion` en el 3.0), y devolverlo como `''` lo confundiría con
 * un elemento vacío, que es otro dato.
 */
function valorTexto(nodo) {
  if (nodo === null) return null
  if (atributo(nodo, NS.xsi, 'nil') === 'true') return null
  return texto(nodo)
}

/** Anota el `srsName` de un nodo, si lo lleva, para el cotejo de coherencia. */
function recogerSrsName(destino, nodo, donde) {
  const crudo = atributo(nodo, SIN_NAMESPACE, 'srsName')
  if (crudo !== null) destino.push({ donde, valor: crudo.trim() })
}

// ── Números y listas de coordenadas ───────────────────────────────────────────

/**
 * Trocea una lista de coordenadas (`gml:posList`, `gml:pos`) en números.
 *
 * @returns {number[]|null}  `null` si algún token no es un número de GML (ya
 *   anotado como `POSLIST_INVALIDA`).
 */
function leerNumeros(ctx, miembro, crudo, donde) {
  const tokens = crudo.split(/\s+/).filter((t) => t.length > 0)
  const malos = tokens.filter((t) => !RE_NUMERO.test(t))
  if (malos.length > 0) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.POSLIST_INVALIDA,
      `${donde}: ${malos.length} de ${tokens.length} valores no son números ` +
        `(${malos.slice(0, 5).map((t) => JSON.stringify(t)).join(', ')}). ` +
        'Una lista de coordenadas de GML lleva solo números decimales separados por ' +
        'espacios, con punto decimal.',
      SEVERIDAD.ERROR,
      { donde, tokens: tokens.length, malos: malos.slice(0, 5) },
    )
    return null
  }
  return tokens.map(Number)
}

/**
 * Pares `[x, y]` de una lista de números. Un número impar de valores significa
 * que la lista está truncada o que la dimensión no es 2: no se adivina cuál.
 *
 * @returns {Array<[number, number]>|null}
 */
function emparejar(ctx, miembro, numeros, donde) {
  if (numeros.length === 0 || numeros.length % 2 !== 0) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.POSLIST_INVALIDA,
      `${donde}: hay ${numeros.length} valores, que no forman pares (x y) completos. ` +
        'Se esperaba un número PAR de valores y al menos uno.',
      SEVERIDAD.ERROR,
      { donde, valores: numeros.length },
    )
    return null
  }
  const pares = []
  for (let i = 0; i < numeros.length; i += 2) pares.push([numeros[i], numeros[i + 1]])
  return pares
}

// ── Anillos ───────────────────────────────────────────────────────────────────

/**
 * Lee un `gml:LinearRing` y devuelve sus vértices ya ABIERTOS.
 *
 * Aquí vive la decisión (3) de la cabecera: el GML trae el anillo cerrado (repite
 * el primer par al final) y el modelo lo guarda abierto, así que el vértice
 * sobrante se retira AQUÍ —dejando constancia con `CIERRE_RETIRADO`— en vez de
 * delegarlo en `crearRecinto`, que lo haría con un `console.warn` en cada fichero
 * legítimo. Si el último par NO repite al primero, el anillo se devuelve tal cual
 * y se emite `ANILLO_NO_CERRADO`: el GML entrante está mal, y corregirlo por
 * nuestra cuenta sería inventar una arista.
 *
 * @returns {Array<[number, number]>|null}
 */
function leerAnillo(ctx, miembro, nodoAnillo, donde) {
  const nodoPosList = hijo(nodoAnillo, NS.gml, 'posList')
  if (nodoPosList === null) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.POSLIST_INVALIDA,
      `${donde}: el «gml:LinearRing» no contiene ningún «gml:posList», que es de donde ` +
        'este proyecto lee las coordenadas de un anillo.',
      SEVERIDAD.ERROR,
      { donde },
    )
    return null
  }

  const srsDimension = atributo(nodoPosList, SIN_NAMESPACE, 'srsDimension')
  if (srsDimension !== null && srsDimension.trim() !== '2') {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.SRS_DIMENSION_INESPERADA,
      `${donde}: «srsDimension» vale ${JSON.stringify(srsDimension)} y este proyecto lee ` +
        'la lista como pares (x y) en dos dimensiones. Los valores se emparejan igual, ' +
        'de dos en dos: revisa si el fichero traía cotas.',
      SEVERIDAD.AVISO,
      { donde, srsDimension },
    )
  }

  const numeros = leerNumeros(ctx, miembro, texto(nodoPosList), donde)
  if (numeros === null) return null
  const pares = emparejar(ctx, miembro, numeros, donde)
  if (pares === null) return null

  const count = atributo(nodoPosList, SIN_NAMESPACE, 'count')
  if (count !== null && Number(count.trim()) !== pares.length) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.COUNT_DISCREPANTE,
      `${donde}: el atributo «count» declara ${JSON.stringify(count)} y la lista trae ` +
        `${pares.length} pares de coordenadas. Manda la lista; el «count» es una ` +
        'redundancia del fichero y no cuadra.',
      SEVERIDAD.AVISO,
      { donde, count, pares: pares.length },
    )
  }

  if (pares.length < 2) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.ANILLO_NO_CERRADO,
      `${donde}: el anillo trae ${pares.length} vértice(s); no hay con qué comprobar el ` +
        'cierre. Un anillo de GML repite el primer par al final.',
      SEVERIDAD.ERROR,
      { donde, vertices: pares.length },
    )
    return pares
  }

  const [px, py] = pares[0]
  const [ux, uy] = pares[pares.length - 1]
  if (px !== ux || py !== uy) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.ANILLO_NO_CERRADO,
      `${donde}: el último par (${ux} ${uy}) no repite al primero (${px} ${py}), y en GML ` +
        'un «gml:LinearRing» va cerrado. No se cierra por nuestra cuenta: añadir esa ' +
        'arista sería inventar geometría que el fichero no declara.',
      SEVERIDAD.ERROR,
      { donde, primero: [px, py], ultimo: [ux, uy], vertices: pares.length },
    )
    return pares
  }

  const abierto = pares.slice(0, -1)
  anotaEn(
    ctx,
    miembro,
    TIPO_GML.CIERRE_RETIRADO,
    `${donde}: el anillo venía CERRADO (${pares.length} pares, el último repite al ` +
      `primero) y el modelo los guarda ABIERTOS (regla de oro 4): se retira el vértice ` +
      `de cierre → ${abierto.length} vértices. El cierre se vuelve a añadir al serializar.`,
    SEVERIDAD.INFO,
    { donde, antes: pares.length, despues: abierto.length },
  )
  return abierto
}

// ── Geometría ─────────────────────────────────────────────────────────────────

/**
 * Localiza el nodo que lleva los anillos (`gml:PolygonPatch` o, con
 * `tolerarPolygon`, un `gml:Polygon`) dentro de un `gml:Surface`/`gml:Polygon`.
 *
 * @returns {object|null}
 */
function leerCara(ctx, miembro, nodoSuperficie, srsNames, tolerarPolygon) {
  recogerSrsName(srsNames, nodoSuperficie, nodoSuperficie.local)

  if (nodoSuperficie.local === 'Polygon') {
    // `gml:Polygon` lleva `exterior`/`interior` colgando de sí mismo: ES la cara.
    return nodoSuperficie
  }

  const patches = hijo(nodoSuperficie, NS.gml, 'patches')
  const caras = patches === null ? [] : hijos(patches, NS.gml, 'PolygonPatch')
  if (caras.length === 0) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.POSLIST_INVALIDA,
      'La geometría no contiene ningún «gml:PolygonPatch» dentro de «gml:patches»: ' +
        'la estructura esperada es MultiSurface → surfaceMember → Surface → patches → ' +
        'PolygonPatch → exterior/interior → LinearRing → posList' +
        (tolerarPolygon ? ', o bien un «gml:Polygon» directo.' : '.'),
      SEVERIDAD.ERROR,
      { superficie: nodoSuperficie.local },
    )
    return null
  }
  if (caras.length > 1) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.MULTIPLES_CARAS,
      `La superficie trae ${caras.length} «gml:PolygonPatch». Una parcela es UN perímetro ` +
        'exterior con sus huecos, no varias caras (multiparcela y MultiPolygon están fuera ' +
        'de alcance). Se lee la primera y las demás se dejan fuera.',
      SEVERIDAD.ERROR,
      { caras: caras.length },
    )
  }
  return caras[0]
}

/**
 * Escoge la superficie (`gml:Surface` o `gml:Polygon`) que hay bajo un nodo, y
 * es el ÚNICO sitio que reporta su ausencia (así no hay dos mensajes para el
 * mismo hecho).
 *
 * `tolerarPolygon` existe porque hay generadores de terceros que emiten
 * `gml:Polygon` directo en vez de `Surface/patches/PolygonPatch`: se acepta por
 * defecto, pero se puede exigir la forma canónica.
 */
function escogerSuperficie(ctx, miembro, contenedor, tolerarPolygon) {
  const superficie = hijo(contenedor, NS.gml, 'Surface')
  if (superficie !== null) return superficie

  const poligono = hijo(contenedor, NS.gml, 'Polygon')
  if (poligono !== null && tolerarPolygon) return poligono

  anotaEn(
    ctx,
    miembro,
    TIPO_GML.POSLIST_INVALIDA,
    poligono === null
      ? `No se ha encontrado ninguna «gml:Surface» dentro de «${contenedor.local}» donde ` +
        'leer el polígono de la parcela.'
      : 'La geometría usa «gml:Polygon» y no «gml:Surface» con «gml:patches», y se ha ' +
        'llamado con `tolerarPolygon: false`. Vuelve a leerlo con la opción por defecto ' +
        'si quieres aceptar esa forma.',
    SEVERIDAD.ERROR,
    { contenedor: contenedor.local, encontrado: poligono === null ? null : 'Polygon' },
  )
  return null
}

/**
 * Lee `cp:geometry` completo: recintos abiertos, orientaciones y `srsName`.
 *
 * @returns {{recintos: RecintoGml[], orientaciones: Array<-1|1>, nSurfaceMembers: number}}
 */
function leerGeometria(ctx, miembro, feature, nsFeature, srsNames, tolerarPolygon) {
  const vacio = { recintos: [], orientaciones: [], nSurfaceMembers: 0 }

  const duplicados = []
  const geometria = hijoUnico(feature, nsFeature, 'geometry', duplicados)
  if (geometria === null) {
    // `hijoUnico` devuelve null tanto si hay CERO como si hay VARIOS, y solo en el
    // segundo caso anota en `duplicados`: por eso los dos casos se distinguen aquí
    // y NO se reportan con el mismo mensaje.
    if (duplicados.length > 0) {
      anotaEn(
        ctx,
        miembro,
        TIPO_GML.MULTIPLES_CARAS,
        `${duplicados[0].mensaje} Una parcela tiene UNA geometría; con varias no se puede ` +
          'saber cuál es la buena, y quedarse con la primera sería elegir por el usuario.',
        SEVERIDAD.ERROR,
        { linea: duplicados[0].linea, columna: duplicados[0].columna },
      )
    } else {
      anotaEn(
        ctx,
        miembro,
        TIPO_GML.POSLIST_INVALIDA,
        'La parcela no trae «geometry»: no hay coordenadas que leer.',
        SEVERIDAD.ERROR,
        { falta: 'geometry' },
      )
    }
    return vacio
  }

  // La geometría canónica va envuelta en `gml:MultiSurface`; se acepta también una
  // `gml:Surface`/`gml:Polygon` suelta, que es como la emiten otros generadores.
  const multiSurface = hijo(geometria, NS.gml, 'MultiSurface')
  let nSurfaceMembers = 0
  let contenedor = geometria
  if (multiSurface !== null) {
    recogerSrsName(srsNames, multiSurface, 'MultiSurface')
    const miembrosSuperficie = hijos(multiSurface, NS.gml, 'surfaceMember')
    nSurfaceMembers = miembrosSuperficie.length
    if (nSurfaceMembers === 0) {
      anotaEn(
        ctx,
        miembro,
        TIPO_GML.POSLIST_INVALIDA,
        'El «gml:MultiSurface» no contiene ningún «gml:surfaceMember»: no hay superficie ' +
          'que leer.',
        SEVERIDAD.ERROR,
        { falta: 'surfaceMember' },
      )
      return vacio
    }
    if (nSurfaceMembers > 1) {
      anotaEn(
        ctx,
        miembro,
        TIPO_GML.MULTIPLES_CARAS,
        `La geometría trae ${nSurfaceMembers} «gml:surfaceMember». Una parcela es UN ` +
          'perímetro exterior con sus huecos como «interior», no varias caras: la ' +
          'multiparcela está fuera de alcance (SPEC §1) y el IVG rechaza el MultiPolygon. ' +
          'Se lee el primero y los demás se dejan fuera.',
        SEVERIDAD.ERROR,
        { surfaceMembers: nSurfaceMembers },
      )
    }
    contenedor = miembrosSuperficie[0]
  }

  const superficie = escogerSuperficie(ctx, miembro, contenedor, tolerarPolygon)
  if (superficie === null) return { ...vacio, nSurfaceMembers }

  const cara = leerCara(ctx, miembro, superficie, srsNames, tolerarPolygon)
  if (cara === null) return { ...vacio, nSurfaceMembers }

  const duplicadosExterior = []
  const exterior = hijoUnico(cara, NS.gml, 'exterior', duplicadosExterior)
  if (exterior === null) {
    anotaEn(
      ctx,
      miembro,
      duplicadosExterior.length > 0 ? TIPO_GML.MULTIPLES_CARAS : TIPO_GML.POSLIST_INVALIDA,
      duplicadosExterior.length > 0
        ? `${duplicadosExterior[0].mensaje} Un polígono tiene UN anillo exterior; los demás ` +
          'recintos van como «gml:interior» (huecos).'
        : 'El polígono no trae «gml:exterior»: sin anillo exterior no hay parcela.',
      SEVERIDAD.ERROR,
      { falta: 'exterior' },
    )
    return { ...vacio, nSurfaceMembers }
  }

  const anillos = [{ nodo: exterior, tipo: TIPO_RECINTO.EXTERIOR, donde: 'gml:exterior' }]
  hijos(cara, NS.gml, 'interior').forEach((nodo, i) => {
    anillos.push({ nodo, tipo: TIPO_RECINTO.HUECO, donde: `gml:interior[${i}]` })
  })

  const recintos = []
  const orientaciones = []
  for (const { nodo, tipo, donde } of anillos) {
    const linearRing = hijo(nodo, NS.gml, 'LinearRing')
    if (linearRing === null) {
      anotaEn(
        ctx,
        miembro,
        TIPO_GML.POSLIST_INVALIDA,
        `${donde}: no contiene ningún «gml:LinearRing».`,
        SEVERIDAD.ERROR,
        { donde, falta: 'LinearRing' },
      )
      continue
    }
    recogerSrsName(srsNames, linearRing, `${donde}/LinearRing`)
    const vertices = leerAnillo(ctx, miembro, linearRing, donde)
    if (vertices === null) continue
    // POJO plano, sin pasar por `crearRecinto`: decisión (3) de la cabecera.
    recintos.push({ vertices, tipo })
    orientaciones.push(orientacion(vertices))
  }

  // Si el exterior se cayó por el camino, los huecos quedarían de `recintos[0]` y
  // romperían la invariante del modelo (`recintos[0]` es SIEMPRE el EXTERIOR).
  // Mejor devolver nada que devolver algo que `crearParcela` rechazaría después.
  if (recintos.length > 0 && recintos[0].tipo !== TIPO_RECINTO.EXTERIOR) {
    return { recintos: [], orientaciones: [], nSurfaceMembers }
  }
  return { recintos, orientaciones, nSurfaceMembers }
}

// ── Sistema de referencia ─────────────────────────────────────────────────────

/**
 * Decide el `srs` de la parcela a partir de todos los `srsName` recogidos.
 *
 * El cotejo de COHERENCIA es lo importante: sin él, un fichero cuyo `MultiSurface`
 * dice 25830 y cuyo `Point` dice 25831 se leería con el primero y F08
 * diagnosticaría en el huso equivocado sin que nadie se enterase.
 */
function resolverSrs(ctx, miembro, srsNames, dialecto) {
  if (srsNames.length === 0) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.SRS_AUSENTE,
      'La geometría no declara «srsName» por ninguna parte: no se puede saber en qué ' +
        'sistema de referencia están las coordenadas, y suponerlo sería inventarlo.',
      SEVERIDAD.ERROR,
    )
    return { srs: null, srsName: null }
  }

  const distintos = [...new Set(srsNames.map((s) => s.valor))]
  // La forma canónica LA DICE EL DIALECTO, no una constante global: la URN es la
  // correcta en una ENTREGA y la URI en una descarga del WFS, y hasta el
  // 2026-07-27 este lector daba por buena solo la segunda. Ver `gml/_comun.js`.
  const analisis = normalizarSrsName(srsNames[0].valor, {
    formaCanonica: dialecto.formaSrsName,
  })
  if (distintos.length > 1) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.SRS_INCOHERENTE,
      `El fichero declara ${distintos.length} «srsName» distintos en la misma parcela ` +
        `(${distintos.map((v) => JSON.stringify(v)).join(', ')}). No se elige uno: la ` +
        'geometría y el punto de referencia tienen que estar en el mismo sistema, y ' +
        'quedarse con el primero llevaría a diagnosticar en el huso equivocado.',
      SEVERIDAD.ERROR,
      { valores: distintos, donde: srsNames.map((s) => s.donde) },
    )
    return { srs: null, srsName: analisis }
  }

  if (analisis.codigo === null) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.SRS_NO_SOPORTADO,
      `El «srsName» ${JSON.stringify(analisis.valor)} no contiene ningún código EPSG ` +
        'reconocible. Formas admitidas: la URI OGC ' +
        '«http://www.opengis.net/def/crs/EPSG/0/25830», la URN ' +
        '«urn:ogc:def:crs:EPSG::25830» y la forma corta «EPSG:25830».',
      SEVERIDAD.ERROR,
      { srsName: analisis.valor, forma: analisis.forma },
    )
    return { srs: null, srsName: analisis }
  }

  const corto = `EPSG:${analisis.codigo}`
  if (!SRS_SOPORTADOS.includes(corto)) {
    const motivo = MOTIVOS_SRS_NO_SOPORTADO[String(analisis.codigo)]
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.SRS_NO_SOPORTADO,
      `El fichero está en ${corto} y este proyecto solo trabaja en ` +
        `${SRS_SOPORTADOS.join(', ')}. ` +
        (motivo ?? 'Reproyecta el fichero a ETRS89/UTM antes de comprobarlo.'),
      SEVERIDAD.ERROR,
      { codigo: analisis.codigo, srsName: analisis.valor, soportados: [...SRS_SOPORTADOS] },
    )
    return { srs: null, srsName: analisis }
  }

  // La forma solo se juzga en los dialectos SOPORTADOS: en el 3.0 y en el de
  // edificio avisar sería ruido sobre un fichero que ya se ha señalado entero.
  //
  // Y se juzga contra la forma DE SU DIALECTO, no contra una única forma buena.
  // Hasta el 2026-07-27 aquí se exigía la URI siempre y se decía que «la Sede
  // rechaza la otra forma»: era falso —las dos son `xsd:anyURI` y las dos
  // validan— y además al revés, porque la que hay que emitir para SUBIR es la
  // URN. Ahora es un aviso de coherencia con el perfil, no un veredicto.
  if (dialecto.soportado && !analisis.coherente) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.SRS_FORMA_INESPERADA,
      `El «srsName» ${JSON.stringify(analisis.valor)} está en forma ${analisis.forma}, y un ` +
        `fichero de este tipo (${dialecto.id}) lo lleva en ${analisis.formaCanonica}: ` +
        `«${srsNamePorForma(srsCorto(analisis.codigo), analisis.formaCanonica)}». El código ` +
        'EPSG se entiende igual y el esquema admite las dos formas, así que la geometría se ' +
        'lee sin problema; se avisa porque no es la forma del fichero de referencia.',
      SEVERIDAD.AVISO,
      { srsName: analisis.valor, forma: analisis.forma, codigo: analisis.codigo },
    )
  }

  return { srs: srsCorto(analisis.codigo), srsName: analisis }
}

// ── Estructura del feature (lo que hace rechazar un GML ajeno, F08) ───────────

/**
 * Elementos que el checklist del IVG no admite en una parcela 4.0.
 *
 * Severidad AVISO y no ERROR, y el matiz está MEDIDO contra el XSD oficial: el
 * esquema los ADMITE (`validFrom`/`validTo`/`zoning` siguen en la secuencia de
 * `CadastralParcelType` con `minOccurs="0"`, y `boundedBy` se hereda de
 * `gml:AbstractFeatureType`). Quien los rechaza es el validador de la Sede, no el
 * esquema — y quien ejecute `npm run validar:xsd` sobre un GML con `gml:boundedBy`
 * lo verá pasar en verde. El mensaje lo dice, para que nadie concluya que el
 * guardián está roto.
 */
function revisarElementosProscritos(ctx, miembro, feature) {
  const locales = descendientes(feature).map((n) => n.local)
  for (const proscrito of ELEMENTOS_PROSCRITOS_CP40) {
    const veces = locales.filter((l) => l === proscrito.local).length
    if (veces === 0) continue
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.ELEMENTO_PROSCRITO,
      `La parcela contiene «${proscrito.local}»${veces > 1 ? ` (×${veces})` : ''}, que este ` +
        'proyecto no emite en 4.0. OJO: el XSD de INSPIRE lo ADMITE — validar contra el ' +
        'esquema no lo detecta —; quien lo rechaza es el checklist del IVG. Motivo: ' +
        proscrito.motivo,
      SEVERIDAD.AVISO,
      { local: proscrito.local, veces, motivo: proscrito.motivo },
    )
  }
}

/**
 * Orden de los hijos del feature frente al del XSD (override O5).
 *
 * Solo se juzgan los elementos que {@link ORDEN_CADASTRAL_PARCEL} conoce, y el
 * matiz es importante: esa constante es un PREFIJO de la secuencia real de trece
 * elementos, no la secuencia entera. Un fichero con `validFrom` NO está mal
 * ordenado por traerlo — su sitio está detrás de los ocho que conocemos y aquí no
 * se puede afirmar nada sobre él —, así que los desconocidos se ignoran en vez de
 * contarse como fuera de sitio. Por lo mismo la severidad es AVISO: lo que se
 * comprueba es un orden relativo PARCIAL.
 */
function revisarOrden(ctx, miembro, feature) {
  const observado = feature.hijos
    .map((h) => h.local)
    .filter((l) => ORDEN_CADASTRAL_PARCEL.includes(l))
  const esperado = ORDEN_CADASTRAL_PARCEL.filter((l) => observado.includes(l))
  if (observado.join('|') === esperado.join('|')) return
  anotaEn(
    ctx,
    miembro,
    TIPO_GML.ORDEN_INESPERADO,
    `Los hijos de la parcela van en el orden [${observado.join(', ')}] y el XSD los exige ` +
      `en [${esperado.join(', ')}] (override O5). La misma información en otro orden es ` +
      'un rechazo del validador.',
    SEVERIDAD.AVISO,
    { observado, esperado },
  )
}

/**
 * `inspireId`: `localId` + `namespace`, y el aviso de la VERSIÓN de base.
 *
 * ⚠️ Aquí se juzga el NAMESPACE, no el prefijo, y la distinción costó un rechazo.
 * Hasta el 2026-07-27 esta función avisaba de `base:Identifier` porque el dossier
 * (override O4) decía que el prefijo era del 3.0 y «produce rechazo en 4.0». Es
 * falso: en XML el prefijo no es información —el infoset guarda la URI del
 * namespace y nada más—, y la PLANTILLA OFICIAL del Catastro usa `base:` sobre
 * base 3.3 y valida contra el XSD. Con aquella regla, el fichero de referencia
 * del propio Catastro salía marcado.
 *
 * Lo que sí distingue los dialectos es la VERSIÓN: base 3.3
 * (`http://inspire.ec.europa.eu/schemas/base/3.3`) es la del CP 4.0, y base 3.2
 * (`urn:x-inspire:specification:gmlas:BaseTypes:3.2`) la del CP 3.0. Se leen los
 * valores igual —el dato es aprovechable y F08 quiere reescribirlo en 4.0—, pero
 * se dice.
 */
function leerInspireId(ctx, miembro, feature, nsFeature) {
  const inspireId = hijo(feature, nsFeature, 'inspireId')
  if (inspireId === null) return { localId: null, namespaceInspire: null }

  const identifier = inspireId.hijos.find((h) => h.local === 'Identifier') ?? null
  if (identifier === null) return { localId: null, namespaceInspire: null }

  if (identifier.ns !== NS.base33) {
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.INSPIREID_NS_INESPERADO,
      `El «Identifier» del «inspireId» está en el namespace ` +
        `${JSON.stringify(identifier.ns)}. Una parcela 4.0 lo lleva en INSPIRE base 3.3 ` +
        `(${NS.base33}); ese otro es de base 3.2, que va con el GML 3.0. El prefijo con que ` +
        'se escriba (`base:` o ninguno) da igual: lo que cuenta es el namespace.',
      SEVERIDAD.AVISO,
      { prefijo: identifier.prefijo, ns: identifier.ns, esperado: NS.base33 },
    )
  }

  // El `localId`/`namespace` se buscan por nombre LOCAL: los ficheros reales los
  // escriben con prefijo y sin él, y el dato es el mismo en los dos casos.
  const porLocal = (nombre) => identifier.hijos.find((h) => h.local === nombre) ?? null
  return {
    localId: valorTexto(porLocal('localId')),
    namespaceInspire: valorTexto(porLocal('namespace')),
  }
}

/** `cp:referencePoint` → `[x, y]`, recogiendo de paso el `srsName` del `gml:Point`. */
function leerPuntoReferencia(ctx, miembro, feature, nsFeature, srsNames) {
  const referencePoint = hijo(feature, nsFeature, 'referencePoint')
  if (referencePoint === null) return null
  const punto = hijo(referencePoint, NS.gml, 'Point')
  if (punto === null) return null
  recogerSrsName(srsNames, punto, 'Point')
  const pos = hijo(punto, NS.gml, 'pos')
  if (pos === null) return null

  const numeros = leerNumeros(ctx, miembro, texto(pos), 'cp:referencePoint/gml:pos')
  if (numeros === null) return null
  const pares = emparejar(ctx, miembro, numeros, 'cp:referencePoint/gml:pos')
  if (pares === null) return null
  return pares[0]
}

/** `cp:areaValue` → número DECLARADO. No se recalcula (ver cabecera). */
function leerAreaValue(ctx, miembro, feature, nsFeature) {
  const nodo = hijo(feature, nsFeature, 'areaValue')
  const crudo = valorTexto(nodo)
  if (crudo === null || crudo === '') return null
  if (!RE_NUMERO.test(crudo)) {
    // No hay un tipo para «el areaValue no es un número», y el más cercano es
    // este: un `areaValue` ilegible es la forma extrema de discrepar con la
    // superficie de las coordenadas — ni siquiera se puede comparar. Se dice con
    // todas las letras en vez de devolver `null` en silencio (regla de oro 1).
    anotaEn(
      ctx,
      miembro,
      TIPO_GML.AREA_DECLARADA_DISCREPANTE,
      `El «areaValue» declarado (${JSON.stringify(crudo)}) no es un número: no se puede ` +
        'cotejar con la superficie que sale de las coordenadas.',
      SEVERIDAD.AVISO,
      { crudo },
    )
    return null
  }
  return Number(crudo)
}

// ── Una parcela ───────────────────────────────────────────────────────────────

/**
 * Lee un `cp:CadastralParcel` completo.
 *
 * @returns {ParcelaGml}
 */
function leerParcela(ctx, miembro, feature, dialecto, tolerarPolygon) {
  const nsFeature = feature.ns
  const srsNames = []

  revisarElementosProscritos(ctx, miembro, feature)
  revisarOrden(ctx, miembro, feature)

  const { recintos, orientaciones, nSurfaceMembers } = leerGeometria(
    ctx,
    miembro,
    feature,
    nsFeature,
    srsNames,
    tolerarPolygon,
  )
  const puntoReferencia = leerPuntoReferencia(ctx, miembro, feature, nsFeature, srsNames)
  const { srs, srsName } = resolverSrs(ctx, miembro, srsNames, dialecto)
  const { localId, namespaceInspire } = leerInspireId(ctx, miembro, feature, nsFeature)

  return {
    refcat: valorTexto(hijo(feature, nsFeature, 'nationalCadastralReference')),
    localId,
    namespaceInspire,
    label: valorTexto(hijo(feature, nsFeature, 'label')),
    gmlId: atributo(feature, NS.gml, 'id'),
    areaValue: leerAreaValue(ctx, miembro, feature, nsFeature),
    beginLifespanVersion: valorTexto(hijo(feature, nsFeature, 'beginLifespanVersion')),
    puntoReferencia,
    recintos,
    orientacion: orientaciones,
    srs,
    srsName,
    nSurfaceMembers,
  }
}

// ── Documento ─────────────────────────────────────────────────────────────────

/** Namespaces declarados en el TEXTO, en orden de aparición y sin repetir. */
function nsDeclaradosDe(xml) {
  const vistos = []
  for (const m of xml.matchAll(RE_XMLNS)) {
    const valor = m[1] ?? m[2]
    if (!vistos.includes(valor)) vistos.push(valor)
  }
  return vistos
}

/** El `encoding` del prólogo, y su aviso si no es UTF-8. */
function revisarEncoding(ctx, declaracion) {
  const declarado = declaracion?.encoding ?? null
  if (declarado === null) return null
  if (ENCODINGS_UTF8.includes(declarado.trim().toLowerCase())) return declarado
  anota(
    ctx,
    TIPO_GML.ENCODING_DECLARADO,
    `El fichero declara «encoding=${JSON.stringify(declarado)}» en el prólogo. Se ha leído ` +
      'con el texto que se le ha pasado a este módulo, que NO transcodifica nada; el GML ' +
      'que este proyecto emite va en UTF-8 con el encoding declarado igual a los bytes ' +
      'reales. Compruébalo si ves acentos rotos.',
    SEVERIDAD.AVISO,
    { encodingDeclarado: declarado },
  )
  return declarado
}

/** Convierte los errores del lector XML en detecciones, con tope. */
function volcarErroresXml(ctx, errores) {
  for (const e of errores.slice(0, MAX_ERRORES_XML)) {
    anota(
      ctx,
      TIPO_GML.XML_MAL_FORMADO,
      `Línea ${e.linea}, columna ${e.columna}: ${e.mensaje}`,
      SEVERIDAD.ERROR,
      { linea: e.linea, columna: e.columna },
    )
  }
  if (errores.length > MAX_ERRORES_XML) {
    anota(
      ctx,
      TIPO_GML.XML_MAL_FORMADO,
      `…y ${errores.length - MAX_ERRORES_XML} problema(s) de XML más, que no se detallan ` +
        `para no sepultar el resto del informe (tope: ${MAX_ERRORES_XML}). Arregla los de ` +
        'arriba y vuelve a comprobarlo.',
      SEVERIDAD.ERROR,
      { total: errores.length, detallados: MAX_ERRORES_XML },
    )
  }
}

/**
 * Clasifica el documento. La raíz SOLA no distingue el CP 3.0 del GML de
 * edificio (los dos son `gml:FeatureCollection` con `gml:featureMember`), así que
 * hace falta el namespace del elemento de feature; pero si con ese dato no casa
 * nada se reintenta sin él, porque para la raíz WFS 2.0 la raíz ya es inequívoca
 * y un `member` con algo raro dentro no debería degradar la clasificación.
 */
function clasificar(raiz) {
  const featureNs = raiz.hijos[0]?.hijos[0]?.ns ?? null
  const conFeature = clasificarDialecto({ ns: raiz.ns, local: raiz.local, featureNs })
  if (conFeature.id !== DIALECTO.DESCONOCIDO) return conFeature
  return clasificarDialecto({ ns: raiz.ns, local: raiz.local })
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Lee un GML de parcela.
 *
 * NO LANZA por un fichero malo: todo lo que esté mal en el documento sale por
 * `detecciones` (regla de oro 1). El único `throw` es por contrato roto del
 * programador.
 *
 * @param {string} xml  Documento GML COMPLETO, **ya decodificado** a string. Este
 *   módulo no toca bytes ni encodings; sí informa del `encoding` DECLARADO.
 * @param {object} [opciones]
 * @param {boolean} [opciones.tolerarPolygon=true]  Aceptar `gml:Polygon` directo
 *   además de `gml:Surface`/`gml:patches`/`gml:PolygonPatch`, porque hay
 *   generadores de terceros que lo emiten así.
 * @returns {ResultadoParseGml}
 * @throws {TypeError}  Si `xml` no es un string o `tolerarPolygon` no es booleano.
 */
export function parsearGml(xml, opciones = {}) {
  if (typeof xml !== 'string') {
    throw new TypeError(
      `parsearGml: 'xml' debe ser el documento GML como string YA DECODIFICADO; recibido ` +
        `${typeof xml}. Un GML mal formado o de otro dialecto NO se señala con excepción: ` +
        'sale en la lista `detecciones`.',
    )
  }
  const { tolerarPolygon = true } = opciones
  if (typeof tolerarPolygon !== 'boolean') {
    throw new TypeError(
      `parsearGml: 'opciones.tolerarPolygon' debe ser booleano; recibido ${typeof tolerarPolygon}.`,
    )
  }

  const ctx = crearContexto()
  const { raiz, declaracion, errores } = parsearXml(xml)
  const encodingDeclarado = revisarEncoding(ctx, declaracion)
  volcarErroresXml(ctx, errores)
  const nsDeclarados = nsDeclaradosDe(xml)

  const cerrar = (dialecto, parcelas, datosRaiz, nMiembros, wfs) => {
    const bloqueos = [
      ...new Set(
        ctx.detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR).map((d) => d.tipo),
      ),
    ]
    return {
      dialecto: dialecto.id,
      soportado: dialecto.soportado,
      parcelas,
      detecciones: ctx.detecciones,
      resumen: {
        dialecto: dialecto.id,
        raiz: datosRaiz,
        encodingDeclarado,
        nMiembros,
        wfs,
        nsDeclarados,
        // Derivados de las propias detecciones, no una lista escrita a mano: así
        // no puede haber un ERROR que no bloquee ni un bloqueo sin su explicación.
        bloqueos,
        detecciones: contarDetecciones(ctx.detecciones),
      },
    }
  }
  const SIN_WFS = { timeStamp: null, numberMatched: null, numberReturned: null }

  if (raiz === null) {
    // Documento vacío o irrecuperable: `volcarErroresXml` ya ha dicho por qué.
    return cerrar(clasificarDialecto({ local: '' }), [], null, 0, SIN_WFS)
  }

  const datosRaiz = { ns: raiz.ns, local: raiz.local }
  const wfs = {
    timeStamp: atributo(raiz, SIN_NAMESPACE, 'timeStamp'),
    numberMatched: atributo(raiz, SIN_NAMESPACE, 'numberMatched'),
    numberReturned: atributo(raiz, SIN_NAMESPACE, 'numberReturned'),
  }
  const dialecto = clasificar(raiz)

  if (dialecto.id === DIALECTO.DESCONOCIDO) {
    anota(
      ctx,
      TIPO_GML.RAIZ_INESPERADA,
      `La raíz del documento es «${raiz.local}» en el namespace ` +
        `${raiz.ns === '' ? '(ninguno)' : JSON.stringify(raiz.ns)}, que no corresponde a ` +
        'ningún GML conocido. Se esperaba una «FeatureCollection», o bien de GML 3.2 ' +
        '(entrega de parcela 4.0, parcela 3.0 o edificio) o bien de WFS 2.0 (descarga del ' +
        'servicio del Catastro).',
      SEVERIDAD.ERROR,
      { ...datosRaiz, featureNs: raiz.hijos[0]?.hijos[0]?.ns ?? null },
    )
    return cerrar(dialecto, [], datosRaiz, 0, wfs)
  }

  const miembros = hijos(raiz, dialecto.miembro.ns, dialecto.miembro.local)

  if (dialecto.tema === 'EDIFICIO') {
    // No es un fichero equivocado: es OTRO TEMA. Se dice qué es y se para, sin
    // fingir que de un Building sale una parcela. Su lector y su serializador
    // son F13.
    anota(
      ctx,
      TIPO_GML.DIALECTO_OTRO_TEMA,
      `Esto es un GML de EDIFICIO, no de parcela: ${dialecto.motivo} Para contrastar la ` +
        'construcción registrada hace falta el recorrido de edificio, no el de lindero.',
      SEVERIDAD.ERROR,
      { dialecto: dialecto.id, featureNs: dialecto.featureNs },
    )
    return cerrar(dialecto, [], datosRaiz, miembros.length, wfs)
  }

  if (!dialecto.soportado) {
    // 3.0: se RECHAZA y aun así se LEE. Ver la decisión (2) de la cabecera.
    anota(
      ctx,
      TIPO_GML.DIALECTO_RECHAZADO,
      `${dialecto.motivo} La parcela se lee igual, para que puedas verla y volver a ` +
        'generarla en el dialecto que la Sede sí admite (CP 4.0 sobre WFS 2.0).',
      SEVERIDAD.ERROR,
      { dialecto: dialecto.id, featureNs: dialecto.featureNs },
    )
  }

  if (miembros.length === 0) {
    anota(
      ctx,
      TIPO_GML.SIN_MIEMBROS,
      `La «${raiz.local}» no contiene ningún «${dialecto.miembro.local}»: el documento está ` +
        'bien formado pero no trae ninguna parcela dentro.',
      SEVERIDAD.ERROR,
      { miembro: dialecto.miembro.local },
    )
  } else if (miembros.length > 1) {
    // El llamante ELIGE; parse no decide (F08: «si hay más de una parcela, dejar
    // elegir cuál se contrasta»).
    anota(
      ctx,
      TIPO_GML.VARIOS_MIEMBROS,
      `El fichero trae ${miembros.length} parcelas. Se leen TODAS y se devuelven en ` +
        '`parcelas`: elige cuál quieres comprobar, porque este módulo no decide por ti.',
      SEVERIDAD.AVISO,
      { miembros: miembros.length },
    )
  }

  const parcelas = []
  miembros.forEach((miembroNodo, i) => {
    const feature = miembroNodo.hijos[0] ?? null
    if (feature === null || feature.local !== 'CadastralParcel') {
      anota(
        ctx,
        TIPO_GML.RAIZ_INESPERADA,
        `Dentro del «${dialecto.miembro.local}» nº ${i + 1} se esperaba un ` +
          `«CadastralParcel» y hay ${feature === null ? 'nada' : `«${feature.local}»`}.`,
        SEVERIDAD.ERROR,
        { miembro: i, local: feature?.local ?? null, ns: feature?.ns ?? null },
      )
      return
    }
    parcelas.push(leerParcela(ctx, i, feature, dialecto, tolerarPolygon))
  })

  return cerrar(dialecto, parcelas, datosRaiz, miembros.length, wfs)
}

export default parsearGml

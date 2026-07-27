// gml/serialize-cp.js — F04 · El serializador a INSPIRE Cadastral Parcels 4.0.
//
// Aquí se escribe el fichero que el usuario sube a la Sede Electrónica. Es la
// pieza de MAYOR RIESGO del proyecto y el motivo es asimétrico: un GML mal
// formado lo caza cualquiera, pero un GML *bien formado y mal hecho* —la URN en
// vez de la URI, el anillo antihorario, el `gml:id` que empieza por dígito, dos
// hijos permutados— sale sin una sola queja de ninguna herramienta local y muere
// en el validador del IVG, semanas después, con un mensaje que no dice qué pasa.
// De ahí que este módulo no invente NADA: cada namespace, cada atributo, cada
// anidamiento y hasta el orden en que se escriben los atributos de la raíz salen
// de `test/fixtures/gml/cp_parcela_9398516VK3799G.gml`, el GML real del WFS
// (regla de oro 8). Donde el dossier y el fichero real discrepan, manda el
// fichero real; los dos puntos donde eso ocurre están anotados abajo.
//
// ═════════════════════════════════════════════════════════════════════════════
// LAS TRES DECISIONES DE DISEÑO, Y POR QUÉ
// ═════════════════════════════════════════════════════════════════════════════
//
// ── 1 · Devuelve `{xml, detecciones, resumen}`, NO un string pelado ──────────
// Serializar PIERDE INFORMACIÓN, y bastante:
//   · redondea las coordenadas a 2 decimales (regla de oro 11);
//   · puede INVERTIR el sentido de un anillo (override O1);
//   · puede DESCARTAR el punto de referencia que aportó el llamante y calcular
//     otro, porque el suyo no caía dentro;
//   · puede FUNDIR dos vértices que estaban a milímetros (`COLAPSO_POR_REDONDEO`);
//   · puede SANEAR un `gml:id` que no era un NCName válido.
// Devolver solo el texto obligaría a tragarse esas cinco decisiones en silencio,
// que es exactamente lo que prohíbe la regla de oro 1 («un GML que valida estando
// mal es peor que uno que falla»). Además, la forma `{resultado, detecciones,
// resumen}` ya es la que usa `parsers/importar.js` desde F01, así que la UI de
// F03/F08 pinta estas detecciones con el mismo componente y sin adaptador.
//
// ── 2 · `xml` es `null` si hay ALGUNA detección de severidad ERROR ───────────
// Un GML que este módulo SABE que está mal no sale del módulo. `resumen.bloqueos`
// dice por qué (los tipos de las detecciones ERROR, en orden). No se devuelve el
// texto «por si acaso al usuario le sirve»: un fichero descargable es una
// invitación a subirlo, y subir lo que sabemos que rechaza el IVG es peor que no
// darle nada. Misma decisión que `importar()` toma con `parcela: null`.
//
// ── 3 · `beginLifespanVersion` es OBLIGATORIO; `timeStamp` es opcional ───────
// Ni este módulo ni ningún otro de `gml/` consultan la marca de tiempo del
// sistema. El motivo es el test de ida y vuelta (T4.1): compara un GML ENTERO
// contra un snapshot, y con el reloj metido dentro del serializador el fichero
// cambiaría en cada ejecución y ese test no podría afirmar nada. Así que la fecha
// entra por parámetro:
//   · `beginLifespanVersion` es obligatorio y se valida con
//     {@link RE_DATETIME_CATASTRO} (`TypeError` si falta o no casa). Es un
//     elemento SIN `minOccurs` en el XSD: obligatorio de verdad, y no hay ningún
//     valor por defecto honesto que este módulo pueda poner en su lugar.
//   · `timeStamp` (atributo de la raíz WFS) solo se emite si se aporta. En el
//     fixture está porque lo puso el servidor al responder la petición; un
//     fichero que genera el técnico para SUBIRLO no tiene por qué llevarlo.
// Quien necesite «ahora» lo obtiene en la capa de aplicación, formateándolo con
// `dateTimeCatastro(…)` de `gml/_comun.js`, y lo pasa hacia abajo. Hay un test
// que vigila esta frontera con un grep sobre el TEXTO de este fichero, así que
// las llamadas al reloj no deben aparecer ni siquiera dentro de un comentario.
//
// ═════════════════════════════════════════════════════════════════════════════
// LA IDENTIDAD DE LA PARCELA: `refcat` FRENTE A `nationalCadastralReference`
// ═════════════════════════════════════════════════════════════════════════════
// Son dos cosas distintas y este módulo las separa a propósito, porque
// confundirlas es afirmar algo falso sobre la finca:
//
//   · `refcat` (OBLIGATORIO) es la IDENTIDAD del objeto. De ella salen el
//     `<localId>` del `inspireId` y la base de los cuatro `gml:id`. No se
//     inventa aquí —`idsDeParcela` lanza `RangeError` con la cadena vacía— y este
//     módulo tampoco se la inventa: EXIGE que el llamante aporte una. En un alta
//     de particular, donde todavía no hay referencia catastral asignada, lo que
//     se pasa es el `idLocal` del modelo (`model/parcela.js#crearParcela` lo tiene
//     y es obligatorio ahí también); la capa de aplicación resuelve
//     `parcela.refcat ?? parcela.idLocal` y lo manda por este parámetro. Se hace
//     así, y no importando el modelo, porque `gml/` no depende de `model/`.
//
//   · `nationalCadastralReference` (OPCIONAL, por defecto VACÍO) es la
//     AFIRMACIÓN de que la parcela ya está inscrita con esa referencia en las
//     bases del Catastro. Por eso NO se rellena por defecto con `refcat`: hacerlo
//     convertiría un alta en una declaración falsa de inscripción, en silencio.
//     `UTM_1.gml` —el alta real de un particular— lo confirma: su `localId` es
//     `8703362TF9980S0001SH` y su `nationalCadastralReference` está VACÍO.
//
// Que se pueda emitir vacío no es una licencia nuestra: `cp:label` y
// `cp:nationalCadastralReference` NO llevan `minOccurs` en el XSD (luego son
// obligatorios) pero su tipo es `string` SIN `minLength`, así que `<cp:label/>`
// valida. Comprobado contra el XSD oficial y contra `UTM_1.gml`.
//
// ═════════════════════════════════════════════════════════════════════════════
// POR QUÉ EL ORDEN XSD SE IMPONE CON UNA FUNCIÓN Y NO ESCRIBIENDO BIEN
// ═════════════════════════════════════════════════════════════════════════════
// El validador exige los ocho hijos de `cp:CadastralParcel` en el orden de
// {@link ORDEN_CADASTRAL_PARCEL} (override O5). Con una plantilla de string —o
// con un array escrito «ya en orden»— ese orden sería un ACCIDENTE de en qué
// línea escribió cada uno el programador: meter un condicional, extraer un
// helper o reordenar «para que se lea mejor» lo rompe y nada chilla hasta la
// Sede. Por eso los hijos se construyen en el orden que resulta cómodo LEER
// (identidad → vida del objeto → geometría → superficie) y es
// {@link ordenarSegunXsd} quien los coloca, LANZANDO si aparece un nombre que no
// está en la secuencia. El orden pasa así de ser una convención a ser un
// invariante comprobable, y el test lo lee del fixture en vez de repetirlo.
//
// ⚠️ `ORDEN_CADASTRAL_PARCEL` es un PREFIJO de la secuencia real del XSD (13
// elementos: detrás van `validFrom`, `validTo`, `basicPropertyUnit`,
// `administrativeUnit` y `zoning`, todos opcionales y todos fuera de lo que este
// proyecto emite). Como orden de EMISIÓN nuestros ocho son correctos y completos.
//
// ═════════════════════════════════════════════════════════════════════════════
// DONDE EL FICHERO REAL CORRIGE A LA DOCUMENTACIÓN
// ═════════════════════════════════════════════════════════════════════════════
// `numberMatched` / `numberReturned` SÍ se emiten. La plantilla anotada del
// dossier los omite; el XSD de WFS 2.0 los declara `use="required"` en
// `FeatureCollection` y el fichero real del WFS los trae. Manda el fichero
// (regla de oro 8). Se derivan del nº de miembros, que hoy es siempre 1
// (multiparcela está fuera de alcance, SPEC §1).
//
// ═════════════════════════════════════════════════════════════════════════════
// TRES DIFERENCIAS DE TEXTO CON EL FIXTURE, TODAS DELIBERADAS
// ═════════════════════════════════════════════════════════════════════════════
// Ninguna cambia el DATO; están escritas aquí para que nadie las «corrija»
// copiando el fichero del WFS carácter a carácter.
//
//   1. EL ENCODING. El fixture DECLARA `ISO-8859-1` y sus bytes son UTF-8: ese
//      fichero miente sobre sí mismo. Nosotros declaramos `UTF-8` y escribimos
//      UTF-8, que es lo que pide la spec de F04 («encoding declarado == bytes
//      reales»).
//
//   2. LOS CEROS FINALES DEL `posList`. El fixture es INCONSISTENTE consigo
//      mismo: escribe `439283.23` con dos decimales y `4479647.8` con uno, y
//      `4479678` con ninguno — es decir, recorta los ceros no significativos.
//      Nosotros emitimos SIEMPRE `toFixed(2)` (`4479647.80`, `4479678.00`),
//      porque es lo que la spec de F04 fija literalmente y porque una anchura
//      fija hace visible de un vistazo que la lista tiene el número de pares que
//      dice el `count`. `xsd:double` no distingue las dos formas: para el
//      validador —y para cualquier parser— `4479647.8` y `4479647.80` son el
//      mismo número, así que el round-trip compara VALORES y no texto.
//
//   3. EL ELEMENTO VACÍO. El fixture escribe `<cp:endLifespanVersion …></…>` y
//      `render` emite la forma autocerrada `<cp:endLifespanVersion …/>`. Son el
//      mismo infoset; es además la forma que el generador de referencia usa para
//      `<cp:label/>` en `UTM_1.gml`.
//
// ═════════════════════════════════════════════════════════════════════════════
// FRONTERAS
// ═════════════════════════════════════════════════════════════════════════════
//   · Aritmética CERO. Las áreas, las orientaciones, el redondeo, el colapso por
//     redondeo y el punto interior son de `gml/anillos.js`; los identificadores,
//     de `gml/ids.js`; el vocabulario y las traducciones de `srsName`/fecha, de
//     `gml/_comun.js`; el XML, de `gml/xml.js`. Aquí solo se DECIDE QUÉ
//     ELEMENTOS hay, cómo se llaman y en qué orden van.
//   · No se concatena XML a mano en ningún punto: todo pasa por `elem`/`render`,
//     que escapan el texto y los atributos. Lo único que este módulo escribe
//     literalmente es el prólogo (declaración y comentarios), que no es un
//     elemento y por tanto no lo cubre `render`.
//   · Este módulo no llama a `validation/parcela.js#puedeGenerar`: ese es el gate
//     de la APP (decide si se ofrece el botón). Aquí se comprueba otra cosa —lo
//     que solo se ve al redondear y al escribir— y por eso los dos existen.

import {
  NS,
  SCHEMA_LOCATION,
  ORDEN_CADASTRAL_PARCEL,
  SEVERIDAD,
  srsNameUri,
} from './_comun.js'
import { elem, render } from './xml.js'
import { DECIMALES_COORD, cerrarAnillo, prepararRecintos, puntoInterior } from './anillos.js'
import { NAMESPACE_INSPIRE_DEFECTO, idsDeParcela } from './ids.js'

// ── Constantes de emisión ─────────────────────────────────────────────────────

/**
 * Prólogo del documento. Declara UTF-8 y el fichero se escribe en UTF-8: ver la
 * cabecera (el fixture declara ISO-8859-1 y sus bytes son UTF-8; ese fichero
 * miente y nosotros no).
 *
 * @readonly
 */
export const DECLARACION_XML = '<?xml version="1.0" encoding="UTF-8"?>'

/**
 * `nilReason` de `cp:endLifespanVersion`, copiado del fixture 4.0. Es la URI del
 * code list de INSPIRE, no la forma corta `other:unpopulated` que usa el GML 3.0
 * de `UTM_1.gml`: el dialecto que este proyecto emite es el 4.0 del WFS.
 *
 * @readonly
 */
export const NIL_REASON_END_LIFESPAN =
  'http://inspire.ec.europa.eu/codelist/VoidReasonValue/Unpopulated'

/**
 * Unidad del `cp:areaValue` (override O6: entero, `uom="m2"`).
 *
 * @readonly
 */
export const UOM_AREA = 'm2'

/**
 * `srsDimension` del `gml:posList`. Siempre 2: el modelo es plano (regla de oro
 * 3, UTM sin cota). Es un string porque va en un atributo y `elem` no convierte
 * números por su cuenta a propósito.
 *
 * @readonly
 */
export const SRS_DIMENSION = '2'

/**
 * Formato del dateTime del Catastro: `YYYY-MM-DDTHH:mm:ss`, sin fracción de
 * segundo y sin indicador de zona. Es EXACTAMENTE lo que produce
 * `dateTimeCatastro` y lo que traen el `cp:beginLifespanVersion` y el `timeStamp`
 * del fixture. Se valida aquí porque una fecha con otra forma la acepta el XSD
 * (es `xsd:dateTime`) pero deja de reproducir el fichero del Catastro.
 *
 * @readonly
 */
export const RE_DATETIME_CATASTRO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/

/**
 * Miembros del documento. HOY es siempre 1: multiparcela está fuera de alcance
 * (SPEC §1). De aquí salen `numberMatched` y `numberReturned` de la raíz, que se
 * DERIVAN en vez de escribirse a mano para que el día que entren varias parcelas
 * no queden dos sitios que actualizar.
 */
const MIEMBROS = 1

// ── Tipos ─────────────────────────────────────────────────────────────────────

/**
 * Opciones de {@link serializarParcelaCp}.
 *
 * @typedef {Object} OpcionesParcelaCp
 * @property {import('./anillos.js').Recinto[]} recintos  Anillos ABIERTOS en UTM
 *   (regla de oro 4), `recintos[0]` EXTERIOR y el resto HUECO. En float64
 *   completo: el redondeo a 2 decimales lo hace este módulo, no el llamante.
 * @property {string} srs  Forma corta del SRS (`'EPSG:25830'`…). Se traduce a la
 *   URI OGC con `srsNameUri` (override O2).
 * @property {string} refcat  IDENTIDAD de la parcela: referencia catastral si la
 *   hay, o el `idLocal` del modelo si es un alta que aún no la tiene. Ver la
 *   cabecera. NO es lo mismo que `nationalCadastralReference`.
 * @property {string} beginLifespanVersion  dateTime en el formato de
 *   {@link RE_DATETIME_CATASTRO}. OBLIGATORIO (ver la cabecera, decisión 3).
 * @property {string} [namespaceInspire='ES.LOCAL.CP']  Namespace INSPIRE.
 *   `ES.LOCAL.CP` para el alta de un particular; `ES.SDGC.CP` para el dato
 *   oficial (round-trip).
 * @property {string} [label='']  `cp:label`. Vacío en un alta: sale `<cp:label/>`.
 * @property {string} [nationalCadastralReference='']  Referencia catastral
 *   OFICIAL. Vacío por defecto a propósito (ver la cabecera).
 * @property {[number, number]|null} [puntoReferencia=null]  Punto propuesto para
 *   el `cp:referencePoint`. Se VERIFICA: si no cae dentro se descarta con una
 *   detección y se calcula otro.
 * @property {string|null} [timeStamp=null]  Atributo `timeStamp` de la raíz. Solo
 *   se emite si se aporta; mismo formato que `beginLifespanVersion`.
 * @property {string|string[]|null} [comentario=null]  Comentario(s) del prólogo,
 *   como los dos que el WFS pone en su fichero. Sin `--` dentro y sin terminar
 *   en `-`, que es lo que XML prohíbe en un comentario.
 * @property {string} [indentacion='  ']  Sangrado por nivel; se pasa a `render`.
 */

/**
 * Recuento de detecciones. Misma forma que `parsers/importar.js`.
 *
 * @typedef {Object} RecuentoDetecciones
 * @property {number} total
 * @property {Object<string, number>} porTipo
 * @property {{INFO: number, AVISO: number, ERROR: number}} porSeveridad
 */

/**
 * Lo que hubo que decidir para escribir el fichero, en forma consultable por la
 * UI y por el informe. Todo lo que aquí aparece se corresponde con algo que el
 * usuario puede querer ver o comprobar.
 *
 * @typedef {Object} ResumenSerializacion
 * @property {boolean} emitido  `true` si `xml` es un documento (sin bloqueos).
 * @property {string[]} bloqueos  Tipos de las detecciones de severidad ERROR, sin
 *   repetir y en orden de aparición. Vacío si se emitió.
 * @property {string} srs         Forma corta recibida.
 * @property {string} srsName     URI OGC emitida (override O2).
 * @property {string} namespaceInspire
 * @property {string} localId     Lo que va en `<localId>`: es `refcat`.
 * @property {import('./ids.js').IdsParcela} ids  Los cuatro `gml:id` emitidos.
 * @property {number} areaValue   Entero publicado en `cp:areaValue`.
 * @property {number} superficieRedondeada  Superficie neta sobre las coordenadas
 *   YA redondeadas, sin redondear a entero (regla de oro 11).
 * @property {number} superficieModelo      La misma sobre las originales. No se
 *   publica: sirve para enseñar cuánto costó el redondeo.
 * @property {number} nAnillos
 * @property {number[]} nVertices  Vértices de cada anillo ABIERTO. El `count` de
 *   su `posList` es este número + 1 (el vértice de cierre).
 * @property {boolean[]} invertidos  Anillos cuyo sentido hubo que normalizar (O1).
 * @property {Array<-1|1>} orientacionOriginal  Orientación medida antes de normalizar.
 * @property {{punto: [number, number]|null, origen: string|null}} puntoReferencia
 * @property {string} beginLifespanVersion
 * @property {string|null} timeStamp  `null` si no se emitió.
 * @property {number} numberMatched
 * @property {number} numberReturned
 * @property {RecuentoDetecciones} detecciones
 */

/**
 * Resultado de {@link serializarParcelaCp}.
 *
 * @typedef {Object} ResultadoSerializacion
 * @property {string|null} xml  El documento completo (con declaración y salto de
 *   línea final), o `null` si hubo alguna detección de severidad ERROR.
 * @property {import('./_comun.js').DeteccionGml[]} detecciones
 * @property {ResumenSerializacion} resumen
 */

// ── Orden XSD, impuesto estructuralmente (override O5) ───────────────────────

/** Nombre local de un nombre cualificado: `'cp:areaValue'` → `'areaValue'`. */
const nombreLocal = (cualificado) => {
  const dosPuntos = cualificado.indexOf(':')
  return dosPuntos === -1 ? cualificado : cualificado.slice(dosPuntos + 1)
}

/**
 * Coloca los hijos de un elemento en el orden que exige una secuencia del XSD y
 * LANZA si alguno no pertenece a ella.
 *
 * El `throw` no es celo: es lo que convierte el orden en un invariante. Sin él,
 * un hijo con el nombre mal escrito —o uno nuevo que alguien añada mañana— se
 * caería del resultado EN SILENCIO y el GML saldría incompleto pero bien formado,
 * que es la peor clase de fallo de este proyecto. Con él, el error aparece en la
 * suite y nombra al culpable.
 *
 * El orden relativo de los hijos que comparten nombre local se conserva (la
 * colocación es estable). Este módulo no emite ninguno repetido —los ocho de
 * `cp:CadastralParcel` son todos `maxOccurs="1"`—, pero cuántas veces aparece
 * cada elemento es cosa de quien construye la lista, no de esta función: aquí
 * solo se decide el ORDEN.
 *
 * @param {import('./xml.js').NodoSalida[]} hijos  Nodos a ordenar, en el orden
 *   en que resultó cómodo escribirlos.
 * @param {readonly string[]} secuencia  Nombres LOCALES en el orden del XSD, p.
 *   ej. {@link ORDEN_CADASTRAL_PARCEL}.
 * @returns {import('./xml.js').NodoSalida[]}  Array nuevo, ordenado.
 * @throws {TypeError}   Si los argumentos no tienen la forma debida.
 * @throws {RangeError}  Si algún hijo tiene un nombre local que no está en
 *   `secuencia` (contrato roto por el programador).
 */
export function ordenarSegunXsd(hijos, secuencia) {
  if (!Array.isArray(hijos)) {
    throw new TypeError(
      `ordenarSegunXsd: 'hijos' debe ser un array de NodoSalida; recibido ${typeof hijos}.`,
    )
  }
  if (!Array.isArray(secuencia) || secuencia.length === 0) {
    throw new TypeError(
      `ordenarSegunXsd: 'secuencia' debe ser un array NO vacío de nombres locales ` +
        `(p. ej. ORDEN_CADASTRAL_PARCEL); recibido ${JSON.stringify(secuencia)}.`,
    )
  }

  const locales = hijos.map((h, i) => {
    if (h === null || typeof h !== 'object' || typeof h.nombre !== 'string') {
      throw new TypeError(
        `ordenarSegunXsd: el hijo ${i} no es un NodoSalida (constrúyelo con elem); ` +
          `recibido ${JSON.stringify(h)}.`,
      )
    }
    return nombreLocal(h.nombre)
  })

  const fuera = locales.filter((l) => !secuencia.includes(l))
  if (fuera.length > 0) {
    throw new RangeError(
      `ordenarSegunXsd: ${fuera.map((l) => `«${l}»`).join(', ')} no pertenece(n) a la ` +
        `secuencia del XSD [${secuencia.join(' → ')}]. Un elemento fuera de la secuencia ` +
        `no se puede colocar sin inventarse dónde va, y el validador del IVG rechaza el ` +
        `fichero si el orden no es exacto (override O5).`,
    )
  }

  return secuencia.flatMap((local) => hijos.filter((_, i) => locales[i] === local))
}

// ── Validación del contrato (errores del PROGRAMADOR, no del usuario) ────────

/** Exige un string no vacío tras recortar. */
function exigirTexto(valor, nombre, ayuda) {
  if (typeof valor !== 'string') {
    throw new TypeError(
      `serializarParcelaCp: '${nombre}' debe ser un string; recibido ${JSON.stringify(valor)}.` +
        (ayuda === undefined ? '' : ` ${ayuda}`),
    )
  }
}

/**
 * Exige un dateTime en el formato del Catastro. `TypeError` en los dos casos
 * —ausente y con formato ajeno— porque los dos son el mismo suceso: el llamante
 * no ha cumplido el contrato de pasar una fecha ya formateada.
 */
function exigirDateTime(valor, nombre) {
  if (typeof valor !== 'string' || !RE_DATETIME_CATASTRO.test(valor)) {
    throw new TypeError(
      `serializarParcelaCp: '${nombre}' debe ser un dateTime 'YYYY-MM-DDTHH:mm:ss' ` +
        `(sin fracción de segundo ni zona); recibido ${JSON.stringify(valor)}. ` +
        `Fórmatelo en la capa de aplicación con dateTimeCatastro(...) de gml/_comun.js: ` +
        `este módulo no consulta la marca de tiempo del sistema, para que el GML generado ` +
        `sea el mismo en cada ejecución.`,
    )
  }
}

/**
 * Normaliza `comentario` a una lista de textos y comprueba que cada uno puede ir
 * dentro de un `<!-- … -->`. XML prohíbe `--` en el cuerpo del comentario y que
 * termine en `-`; con cualquiera de las dos cosas el documento dejaría de estar
 * bien formado — y como el prólogo es lo único que este módulo escribe sin pasar
 * por `render`, aquí no hay escapado que lo salve. Se lanza en vez de recortar
 * en silencio (regla de oro 1).
 *
 * @param {string|string[]|null|undefined} comentario
 * @returns {string[]}
 * @throws {TypeError}
 */
function normalizarComentarios(comentario) {
  if (comentario === null || comentario === undefined) return []
  const lista = Array.isArray(comentario) ? comentario : [comentario]
  return lista.map((c, i) => {
    if (typeof c !== 'string') {
      throw new TypeError(
        `serializarParcelaCp: el comentario ${i} debe ser un string; ` +
          `recibido ${JSON.stringify(c)}.`,
      )
    }
    if (c.includes('--') || c.endsWith('-')) {
      throw new TypeError(
        `serializarParcelaCp: el comentario ${i} no puede contener «--» ni terminar en «-» ` +
          `(XML 1.0 §2.5); recibido ${JSON.stringify(c)}.`,
      )
    }
    return c
  })
}

// ── Construcción de los nodos ────────────────────────────────────────────────

/**
 * `gml:posList` de un anillo: pares X Y (Este Norte) a 2 decimales, separados por
 * espacios, con el primer vértice REPETIDO al final.
 *
 * El `count` es el número de PARES —no de números— y por eso vale
 * `vertices.length + 1`: el fixture trae `count="16"` con 32 valores. Confundirlo
 * es un rechazo, y es el error más fácil de cometer aquí.
 *
 * En 25829/30/31 los ejes NO se invierten: el primer valor es el Este. La
 * inversión de ejes es exclusiva de 4326 y aquí no aplica.
 *
 * @param {Array<[number, number]>} vertices  Anillo ABIERTO, ya redondeado.
 * @returns {import('./xml.js').NodoSalida}
 */
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

/**
 * `cp:geometry` completo.
 *
 * La cadena es exactamente la del fixture y no admite atajos: `cp:geometry →
 * gml:MultiSurface → gml:surfaceMember → gml:Surface → gml:patches →
 * gml:PolygonPatch → gml:exterior|gml:interior → gml:LinearRing → gml:posList`.
 *
 * UN SOLO `gml:surfaceMember`. Los huecos son `gml:interior` DEL MISMO
 * `PolygonPatch`, no superficies aparte: una parcela es un único perímetro
 * exterior con huecos, y un MultiPolygon con varias caras es un rechazo directo
 * del IVG (checklist del dossier §1.5).
 *
 * @param {import('./anillos.js').Recinto[]} recintos  Ya preparados: `[0]` es el
 *   exterior y el resto huecos.
 * @param {string} srsName  URI OGC (override O2). Va en `MultiSurface` y en
 *   `Surface`, repetida, como en el fichero real.
 * @param {import('./ids.js').IdsParcela} ids
 * @returns {import('./xml.js').NodoSalida}
 */
function nodoGeometria(recintos, srsName, ids) {
  const anillos = recintos.map((r, i) =>
    elem(i === 0 ? 'gml:exterior' : 'gml:interior', [], [
      elem('gml:LinearRing', [], [nodoPosList(r.vertices)]),
    ]),
  )

  const surface = elem(
    'gml:Surface',
    [
      ['gml:id', ids.surfaces[0]],
      ['srsName', srsName],
    ],
    [elem('gml:patches', [], [elem('gml:PolygonPatch', [], anillos)])],
  )

  return elem('cp:geometry', [], [
    elem(
      'gml:MultiSurface',
      [
        ['gml:id', ids.multiSurface],
        ['srsName', srsName],
      ],
      [elem('gml:surfaceMember', [], [surface])],
    ),
  ])
}

/**
 * `cp:inspireId` (override O4): `<Identifier>` con el namespace de base 3.3 como
 * `xmlns` POR DEFECTO y SIN prefijo `base:`. El `base:` es de la 3.2, va con el
 * CP 3.0 (así lo escribe `UTM_1.gml`) y produce rechazo en 4.0.
 *
 * `localId` y `namespace` no llevan prefijo: heredan el default del `Identifier`,
 * igual que en el fixture.
 *
 * @param {string} localId
 * @param {string} namespaceInspire
 * @returns {import('./xml.js').NodoSalida}
 */
function nodoInspireId(localId, namespaceInspire) {
  return elem('cp:inspireId', [], [
    elem('Identifier', [['xmlns', NS.base33]], [
      elem('localId', [], localId),
      elem('namespace', [], namespaceInspire),
    ]),
  ])
}

/**
 * `cp:referencePoint`. El `gml:Point` repite el `srsName` (tercera y última vez
 * que aparece en el documento, override O2) y lleva su propio `gml:id`.
 *
 * @param {[number, number]} punto  Ya verificado interior y redondeado.
 * @param {string} srsName
 * @param {import('./ids.js').IdsParcela} ids
 * @returns {import('./xml.js').NodoSalida}
 */
function nodoReferencePoint(punto, srsName, ids) {
  return elem('cp:referencePoint', [], [
    elem(
      'gml:Point',
      [
        ['gml:id', ids.puntoReferencia],
        ['srsName', srsName],
      ],
      [
        elem(
          'gml:pos',
          [],
          `${punto[0].toFixed(DECIMALES_COORD)} ${punto[1].toFixed(DECIMALES_COORD)}`,
        ),
      ],
    ),
  ])
}

/**
 * Atributos de la raíz, EN EL ORDEN del fichero real (regla de oro 8): las cinco
 * declaraciones con prefijo, el `xsi:schemaLocation`, el `xmlns` por defecto —que
 * es el de WFS 2.0, override O3— y por último los tres atributos de la respuesta.
 *
 * El namespace de base 3.3 NO se declara aquí: vive en el `<Identifier>`, que es
 * donde lo pone el Catastro. `xlink` y `gmd` se declaran aunque el documento no
 * los use en ningún elemento, también por fidelidad al fichero real.
 *
 * @param {string|null} timeStamp
 * @returns {Array<[string, string]>}
 */
function atributosRaiz(timeStamp) {
  const atributos = [
    ['xmlns:xsi', NS.xsi],
    ['xmlns:gml', NS.gml],
    ['xmlns:xlink', NS.xlink],
    ['xmlns:cp', NS.cp],
    ['xmlns:gmd', NS.gmd],
    ['xsi:schemaLocation', SCHEMA_LOCATION],
    ['xmlns', NS.wfs],
  ]
  if (timeStamp !== null) atributos.push(['timeStamp', timeStamp])
  atributos.push(['numberMatched', String(MIEMBROS)], ['numberReturned', String(MIEMBROS)])
  return atributos
}

// ── Recuento de detecciones (misma forma que parsers/importar.js) ────────────

/**
 * @param {import('./_comun.js').DeteccionGml[]} detecciones
 * @returns {RecuentoDetecciones}
 */
function contarDetecciones(detecciones) {
  const porTipo = {}
  const porSeveridad = { INFO: 0, AVISO: 0, ERROR: 0 }
  for (const d of detecciones) {
    porTipo[d.tipo] = (porTipo[d.tipo] ?? 0) + 1
    porSeveridad[d.severidad] = (porSeveridad[d.severidad] ?? 0) + 1
  }
  return { total: detecciones.length, porTipo, porSeveridad }
}

// ── API pública ───────────────────────────────────────────────────────────────

/**
 * Serializa una parcela a INSPIRE Cadastral Parcels 4.0 sobre WFS 2.0.
 *
 * Qué hace, en este orden:
 *   1. Valida el CONTRATO (lo que es responsabilidad del programador) y lanza.
 *   2. Compone los cuatro `gml:id` (`gml/ids.js`).
 *   3. Prepara los anillos: redondeo, colapsos, orientación y `areaValue`
 *      (`gml/anillos.js`). Toda la aritmética ocurre ahí.
 *   4. Resuelve el punto de referencia VERIFICÁNDOLO contra la geometría ya
 *      redondeada, que es la que va al fichero.
 *   5. Si NO hay ninguna detección de severidad ERROR, construye el árbol y lo
 *      renderiza. Si la hay, `xml` es `null` y `resumen.bloqueos` dice por qué.
 *
 * NO lanza por un dato malo del usuario (geometría degenerada, punto fuera,
 * vértices que colapsan): eso sale por `detecciones` y por `bloqueos`. El `throw`
 * se reserva al contrato roto por el programador — SPEC §2.1.
 *
 * @param {OpcionesParcelaCp} opciones
 * @returns {ResultadoSerializacion}
 * @throws {TypeError}   Si falta `refcat`/`srs`/`beginLifespanVersion` o alguno
 *   de los parámetros no tiene el tipo o el formato debidos; si `recintos` no
 *   cumple el invariante del modelo (`recintos[0]` EXTERIOR, resto HUECO).
 * @throws {RangeError}  Si `srs` no está soportado (Canarias sigue DIFERIDA,
 *   override O13), si `refcat` está en blanco, o si alguna coordenada queda
 *   fuera del rango publicable (`gml/anillos.js#redondearCoord`).
 */
export function serializarParcelaCp(opciones = {}) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `serializarParcelaCp: se esperaba un objeto de opciones; ` +
        `recibido ${JSON.stringify(opciones)}.`,
    )
  }

  const {
    recintos,
    srs,
    refcat,
    beginLifespanVersion,
    namespaceInspire = NAMESPACE_INSPIRE_DEFECTO,
    label = '',
    nationalCadastralReference = '',
    puntoReferencia = null,
    timeStamp = null,
    comentario = null,
    indentacion = '  ',
  } = opciones

  // ── 1 · Contrato ──────────────────────────────────────────────────────────
  // `srsNameUri` valida el SRS y hace la traducción del override O2 de una vez:
  // no hay una segunda tabla aquí que pudiera divergir de la suya.
  const srsName = srsNameUri(srs)

  exigirDateTime(beginLifespanVersion, 'beginLifespanVersion')
  // `timeStamp` es lo ÚNICO opcional de las dos fechas: solo se valida —y solo se
  // emite— si se aporta. El `null` del destructuring cubre también el
  // `timeStamp: undefined` explícito, así que aquí basta comparar con `null`.
  if (timeStamp !== null) exigirDateTime(timeStamp, 'timeStamp')

  exigirTexto(
    refcat,
    'refcat',
    'Es la IDENTIDAD de la parcela (el <localId> y la base de los gml:id): la referencia ' +
      'catastral si la hay, o el idLocal del modelo si es un alta que todavía no la tiene. ' +
      'Este módulo no se la inventa.',
  )
  if (refcat.trim().length === 0) {
    throw new RangeError(
      'serializarParcelaCp: `refcat` no puede estar en blanco. En un alta sin referencia ' +
        'catastral asignada, pasa el `idLocal` del modelo (model/parcela.js#crearParcela lo ' +
        'exige, así que siempre hay uno) y deja `nationalCadastralReference` vacío: eso es ' +
        'justo el patrón del alta de particular que hace UTM_1.gml.',
    )
  }
  exigirTexto(label, 'label')
  exigirTexto(
    nationalCadastralReference,
    'nationalCadastralReference',
    'Va VACÍO mientras la parcela no esté inscrita: rellenarlo es afirmar que ya lo está.',
  )
  exigirTexto(namespaceInspire, 'namespaceInspire')

  const comentarios = normalizarComentarios(comentario)

  // ── 2 · Identificadores ───────────────────────────────────────────────────
  // Una sola superficie: la parcela es UN exterior con huecos (los huecos son
  // `gml:interior` del mismo patch, no superficies numeradas aparte).
  const { ids, detecciones: detIds } = idsDeParcela({ namespaceInspire, refcat, nSurfaces: 1 })

  // ── 3 · Aritmética ────────────────────────────────────────────────────────
  const preparados = prepararRecintos(recintos)

  // ── 4 · Punto de referencia ───────────────────────────────────────────────
  // Se verifica contra `preparados.recintos` —los anillos REDONDEADOS— y no
  // contra los de entrada: el punto tiene que caer dentro del polígono que va a
  // ir ESCRITO en el fichero, que es otro polígono (por centímetros) que el del
  // modelo. Verificar contra el modelo sería verificar otra cosa.
  const referencia = puntoInterior(preparados.recintos, { aportado: puntoReferencia })

  const detecciones = [...detIds, ...preparados.detecciones, ...referencia.detecciones]

  // ── 5 · ¿Sale el fichero? ─────────────────────────────────────────────────
  const bloqueos = [
    ...new Set(
      detecciones.filter((d) => d.severidad === SEVERIDAD.ERROR).map((d) => d.tipo),
    ),
  ]

  const resumen = {
    emitido: bloqueos.length === 0,
    bloqueos,
    srs,
    srsName,
    namespaceInspire,
    localId: refcat,
    ids,
    areaValue: preparados.areaValue,
    superficieRedondeada: preparados.superficieRedondeada,
    superficieModelo: preparados.superficieModelo,
    nAnillos: preparados.recintos.length,
    nVertices: preparados.recintos.map((r) => r.vertices.length),
    invertidos: preparados.invertidos,
    orientacionOriginal: preparados.orientacionOriginal,
    puntoReferencia: { punto: referencia.punto, origen: referencia.origen },
    beginLifespanVersion,
    timeStamp,
    numberMatched: MIEMBROS,
    numberReturned: MIEMBROS,
    detecciones: contarDetecciones(detecciones),
  }

  if (bloqueos.length > 0) return { xml: null, detecciones, resumen }

  // Sin bloqueos, `referencia.punto` NO es nulo: `puntoInterior` solo devuelve
  // `null` acompañado de una detección de severidad ERROR, que ya habría entrado
  // en `bloqueos`. Por eso aquí se puede emitir el `referencePoint` sin condición.

  // ── 6 · El árbol ──────────────────────────────────────────────────────────
  // Los hijos se escriben AGRUPADOS POR SENTIDO (identidad, vida del objeto,
  // geometría, superficie), que es como se leen bien; el orden que exige el XSD
  // lo impone `ordenarSegunXsd`. Que estas dos listas NO coincidan es
  // deliberado: si coincidieran, el día que alguien reordenara estas líneas el
  // documento seguiría saliendo bien y nadie sabría que el orden estaba
  // sostenido por una casualidad.
  const hijos = ordenarSegunXsd(
    [
      nodoInspireId(refcat, namespaceInspire),
      elem('cp:label', [], label),
      elem('cp:nationalCadastralReference', [], nationalCadastralReference),
      elem('cp:beginLifespanVersion', [], beginLifespanVersion),
      elem(
        'cp:endLifespanVersion',
        [
          ['xsi:nil', 'true'],
          ['nilReason', NIL_REASON_END_LIFESPAN],
        ],
        null,
      ),
      nodoGeometria(preparados.recintos, srsName, ids),
      nodoReferencePoint(referencia.punto, srsName, ids),
      elem('cp:areaValue', [['uom', UOM_AREA]], String(preparados.areaValue)),
    ],
    ORDEN_CADASTRAL_PARCEL,
  )

  const raiz = elem('FeatureCollection', atributosRaiz(timeStamp), [
    elem('member', [], [
      elem('cp:CadastralParcel', [['gml:id', ids.parcela]], hijos),
    ]),
  ])

  // ── 7 · Texto ─────────────────────────────────────────────────────────────
  // El prólogo es lo único que no pasa por `render` (no son elementos). Los
  // comentarios ya vienen comprobados por `normalizarComentarios`.
  const lineas = [
    DECLARACION_XML,
    ...comentarios.map((c) => `<!--${c}-->`),
    render(raiz, { indentacion }),
  ]

  return { xml: `${lineas.join('\n')}\n`, detecciones, resumen }
}

export default serializarParcelaCp

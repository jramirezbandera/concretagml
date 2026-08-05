// gml/serialize-cp.js — F04 · El serializador a INSPIRE Cadastral Parcels 4.0.
//
// Aquí se escribe el fichero que el usuario sube a la Sede Electrónica. Es la
// pieza de MAYOR RIESGO del proyecto y el motivo es asimétrico: un GML mal
// formado lo caza cualquiera, pero un GML *bien formado y mal hecho* sale sin una
// sola queja de ninguna herramienta local y muere en el validador del IVG,
// semanas después, con un mensaje que no dice qué pasa. De ahí que este módulo no
// invente NADA: cada namespace, cada atributo, cada anidamiento y hasta el orden
// en que se escriben los atributos de la raíz salen de un fichero real de
// `test/fixtures/gml/` (regla de oro 8).
//
// ═════════════════════════════════════════════════════════════════════════════
// ⚠️ EL FALLO DEL 2026-07-27, QUE ES EL MOTIVO DE QUE EXISTA `perfil`
// ═════════════════════════════════════════════════════════════════════════════
// La primera versión de este módulo copió `cp_parcela_9398516VK3799G.gml`. Ese
// fichero es la RESPUESTA del WFS del Catastro, y la Sede rechazó lo que salió de
// aquí: «El archivo no cumple el esquema Inspire GML».
//
// La causa, medida contra los XSD oficiales con libxml2, cabe en una línea:
//
//     Element '{http://www.opengis.net/wfs/2.0}FeatureCollection':
//     No matching global declaration available for the validation root.
//
// El validador del IVG carga el esquema de PARCELA (`cp/4.0`), no el de WFS. La
// raíz `wfs:FeatureCollection` no existe ahí y el documento muere en la primera
// línea, sin llegar a mirar la geometría — que estaba bien.
//
// La descarga y la entrega son DOS DIRECCIONES del mismo formato, y el fichero
// que las distingue es `cp_ejemplo_explicativo.gml`: la plantilla que el propio
// Catastro publica y que sus instrucciones mandan usar para generar el fichero
// que se sube. De ahí {@link PERFIL}:
//
//   · `PERFIL.ENTREGA` (POR DEFECTO) — `gml:FeatureCollection` +
//     `gml:featureMember`, `srsName` en URN, `xsi:schemaLocation` solo de cp/4.0,
//     sin atributos de WFS. Es lo que baja la app. Derivado de la plantilla.
//   · `PERFIL.WFS` — el sobre de la descarga. Existe para reproducir el fichero
//     del Catastro en el test de ida y vuelta, que es lo que demuestra que los
//     NÚMEROS son correctos. No se puede subir, y el módulo lo dice.
//
// Lo que cambia entre perfiles es SOLO el sobre: el interior del
// `cp:CadastralParcel` es idéntico. Toda la aritmética, los identificadores y el
// orden XSD son comunes, y por eso el fallo no tocó ni una línea de `anillos.js`.
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
// ── 3 · La fecha ENTRA POR PARÁMETRO; el módulo no consulta el reloj ─────────
// Ni este módulo ni ningún otro de `gml/` consultan la marca de tiempo del
// sistema. El motivo es el test de ida y vuelta (T4.1): compara un GML ENTERO
// contra un snapshot, y con el reloj metido dentro del serializador el fichero
// cambiaría en cada ejecución y ese test no podría afirmar nada. Quien necesite
// «ahora» lo obtiene en la capa de aplicación, formateándolo con
// `dateTimeCatastro(…)` de `gml/_comun.js`, y lo pasa hacia abajo. Hay un test
// que vigila esta frontera con un grep sobre el TEXTO de este fichero, así que
// las llamadas al reloj no deben aparecer ni siquiera dentro de un comentario.
//
// `cp:beginLifespanVersion` es un elemento SIN `minOccurs` en el XSD: hay que
// emitirlo siempre. Pero QUÉ se emite depende del perfil, y la diferencia es una
// afirmación sobre el mundo, no un detalle de formato:
//   · `PERFIL.WFS` — dateTime OBLIGATORIO. El fichero reproduce un dato del
//     Catastro, que sabe desde cuándo rige esa versión del objeto.
//   · `PERFIL.ENTREGA` — dateTime OPCIONAL. Sin él sale
//     `<cp:beginLifespanVersion xsi:nil="true" nilReason="other:unpopulated"/>`,
//     que es EXACTAMENTE lo que trae la plantilla oficial. Y es lo honesto: en un
//     alta, la versión del objeto todavía no ha empezado a regir — poner la fecha
//     de hoy sería afirmar algo que decide el Catastro, no el declarante.
// `timeStamp` (atributo de la raíz WFS) solo existe en `PERFIL.WFS`: es la marca
// que pone el servidor al responder. Pasarlo en una entrega es un `TypeError`,
// no un valor ignorado en silencio.
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
// `numberMatched` / `numberReturned` se emiten en `PERFIL.WFS`. La plantilla
// anotada del dossier los omite; el XSD de WFS 2.0 los declara `use="required"`
// en `FeatureCollection` y el fichero real del WFS los trae. Manda el fichero
// (regla de oro 8). Se derivan del nº de miembros del documento, que **desde F17
// puede ser mayor que 1**: `serializarExpedienteCp` escribe varias parcelas en un
// solo fichero (override O18, medido con IVG positivo el 2026-08-03). ⚠️ Hasta
// entonces esto era la constante `MIEMBROS = 1` justificada con «multiparcela está
// fuera de alcance», y esa justificación caducó — era cierta en F04 y dejó de
// serlo—. En `PERFIL.ENTREGA` no existen: la raíz no es de WFS y esos atributos no
// están declarados en ningún sitio.
//
// El `gml:id` de la raíz (solo en `PERFIL.ENTREGA`, donde la raíz hereda de
// `gml:AbstractGML` y lo exige) es el NAMESPACE INSPIRE —`ES.LOCAL.CP`— y no la
// identidad de la parcela. No es cosmético: `gml:id` es de tipo `xs:ID`, único en
// todo el documento, y `UTM_1.gml` repite el mismo valor en la raíz y en el
// `cp:CadastralParcel`. Comprobado mutando nuestra salida: con el id repetido el
// validador responde «'…' is not a valid value of the atomic type 'xs:ID'». La
// plantilla oficial usa el namespace, y por eso lo usamos.
//
// ═════════════════════════════════════════════════════════════════════════════
// TRES DIFERENCIAS DE TEXTO CON EL FIXTURE DEL WFS, TODAS DELIBERADAS
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
  ORDEN_CADASTRAL_PARCEL,
  PERFIL,
  PERFILES,
  SEVERIDAD,
  perfilPorId,
  srsNamePorForma,
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
 * `nilReason` de `cp:endLifespanVersion`, copiado del fixture del WFS. Es la URI
 * del code list de INSPIRE. Solo se usa en `PERFIL.WFS`, que es el único que
 * emite ese elemento.
 *
 * @readonly
 */
export const NIL_REASON_END_LIFESPAN =
  'http://inspire.ec.europa.eu/codelist/VoidReasonValue/Unpopulated'

/**
 * `nilReason` del `cp:beginLifespanVersion` vacío de una ENTREGA, copiado LETRA A
 * LETRA de `cp_ejemplo_explicativo.gml`.
 *
 * Es la forma CORTA (`other:unpopulated`), no la URI larga del code list que usa
 * el WFS para su `endLifespanVersion`. Que convivan las dos formas en el mismo
 * proyecto no es un descuido: cada una está copiada del fichero que la usa, y
 * unificarlas «por coherencia» sería preferir nuestro criterio al de los ficheros
 * reales, que es justo lo que prohíbe la regla de oro 8.
 *
 * @readonly
 */
export const NIL_REASON_BEGIN_LIFESPAN = 'other:unpopulated'

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
 * Miembros del documento cuando se serializa UNA parcela. De aquí salen
 * `numberMatched` y `numberReturned` de la raíz, que se DERIVAN en vez de
 * escribirse a mano.
 *
 * ⭐ **Ese «día que entren varias parcelas» llegó el 2026-08-03** (override O18: la
 * Sede aceptó un `.gml` con dos `gml:featureMember` e IVG positivo), y el JSDoc de
 * esta constante lo anticipaba desde F04. Ya no es que «multiparcela esté fuera de
 * alcance» —dejó de estarlo—: es que **una llamada a `serializarParcelaCp`
 * serializa una parcela**, y el documento de varias lo escribe
 * {@link serializarExpedienteCp}, que pasa su propio recuento.
 *
 * @readonly
 */
const MIEMBROS_UNA_PARCELA = 1

// ── Tipos ─────────────────────────────────────────────────────────────────────

/**
 * Opciones de {@link serializarParcelaCp}.
 *
 * @typedef {Object} OpcionesParcelaCp
 * @property {import('./anillos.js').Recinto[]} recintos  Anillos ABIERTOS en UTM
 *   (regla de oro 4), `recintos[0]` EXTERIOR y el resto HUECO. En float64
 *   completo: el redondeo a 2 decimales lo hace este módulo, no el llamante.
 * @property {string} srs  Forma corta del SRS (`'EPSG:25830'`…). Se traduce a URN
 *   o a URI según el perfil, con `srsNamePorForma`.
 * @property {string} refcat  IDENTIDAD de la parcela: referencia catastral si la
 *   hay, o el `idLocal` del modelo si es un alta que aún no la tiene. Ver la
 *   cabecera. NO es lo mismo que `nationalCadastralReference`.
 * @property {'ENTREGA'|'WFS'} [perfil='ENTREGA']  Qué SOBRE se escribe. Ver
 *   {@link PERFILES} y la cabecera del módulo. El defecto es el fichero que se
 *   sube a la Sede, porque es para lo que existe esta herramienta.
 * @property {string|null} [beginLifespanVersion=null]  dateTime en el formato de
 *   {@link RE_DATETIME_CATASTRO}. OBLIGATORIO en `PERFIL.WFS`; en
 *   `PERFIL.ENTREGA` es opcional y su ausencia emite el elemento con
 *   `xsi:nil="true"`, como la plantilla oficial (ver la cabecera, decisión 3).
 * @property {string} [namespaceInspire='ES.LOCAL.CP']  Namespace INSPIRE.
 *   `ES.LOCAL.CP` para el alta de un particular; `ES.SDGC.CP` cuando el `localId`
 *   ES una referencia catastral real (así lo exige la FAQ del Catastro).
 * @property {string} [label='']  `cp:label`. Vacío en un alta: sale `<cp:label/>`.
 * @property {string} [nationalCadastralReference='']  Referencia catastral
 *   OFICIAL. Vacío por defecto a propósito (ver la cabecera).
 * @property {[number, number]|null} [puntoReferencia=null]  Punto propuesto para
 *   el `cp:referencePoint`. Se VERIFICA siempre: si no cae dentro se descarta con
 *   una detección y se calcula otro. OJO: en `PERFIL.ENTREGA` el punto se calcula
 *   y se devuelve en `resumen` pero NO se escribe en el fichero, porque la
 *   plantilla oficial no lo trae (ver {@link PERFILES}).
 * @property {string|null} [timeStamp=null]  Atributo `timeStamp` de la raíz.
 *   EXCLUSIVO de `PERFIL.WFS`: en una entrega es un `TypeError`, porque esa raíz
 *   no admite el atributo y aceptarlo en silencio sería emitir un fichero
 *   distinto del que el llamante cree haber pedido.
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
 * @property {'ENTREGA'|'WFS'} perfil  Sobre que se ha escrito.
 * @property {boolean} subibleALaSede  `true` solo en `PERFIL.ENTREGA`. Existe
 *   para que la UI no tenga que saberse la tabla de perfiles: un fichero del
 *   perfil WFS es perfectamente válido y NO se puede subir, y eso hay que poder
 *   decirlo sin razonarlo en cada llamante.
 * @property {string} srs         Forma corta recibida.
 * @property {string} srsName     `srsName` emitido, en la forma del perfil.
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
 *   Se rellena SIEMPRE, aunque el perfil no lo escriba: la UI lo necesita para
 *   poder dibujarlo y para explicar que se recalculó.
 * @property {boolean} referencePointEmitido  Si además fue AL FICHERO.
 * @property {string|null} beginLifespanVersion  `null` si se emitió con `xsi:nil`.
 * @property {string|null} timeStamp  `null` si no se emitió.
 * @property {number|null} numberMatched   `null` fuera de `PERFIL.WFS`.
 * @property {number|null} numberReturned  `null` fuera de `PERFIL.WFS`.
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
 * `cp:inspireId`. Los dos perfiles usan el MISMO namespace —INSPIRE base 3.3— y
 * se diferencian solo en cómo lo declaran, porque así lo hace cada fichero real:
 *
 *   · `ENTREGA` — `xmlns:base` en el `cp:inspireId` y prefijo `base:` en los tres
 *     elementos. Copiado de `cp_ejemplo_explicativo.gml`.
 *   · `WFS` — `xmlns` POR DEFECTO en el `<Identifier>`, sin prefijo. Copiado de
 *     `cp_parcela_9398516VK3799G.gml`.
 *
 * ⚠️ CORRECCIÓN DEL OVERRIDE O4. El dossier afirmaba que el prefijo `base:`
 * «produce rechazo en 4.0». Es FALSO, y conviene entender por qué para no volver
 * a escribirlo: en XML un prefijo no es información. `<base:Identifier
 * xmlns:base="…/base/3.3">` y `<Identifier xmlns="…/base/3.3">` son el MISMO
 * elemento para cualquier validador — el infoset solo guarda la URI del
 * namespace. La plantilla oficial usa `base:` y valida (medido). Lo que sí
 * importa es la VERSIÓN del namespace: base 3.2 (`urn:x-inspire:…:BaseTypes:3.2`)
 * es del CP 3.0 y esa sí es otra cosa.
 *
 * Se conservan las dos formas, en vez de unificarlas, por la regla de oro 8: cada
 * perfil escribe lo que escribe su fichero de referencia, y el round-trip lo
 * comprueba byte a byte.
 *
 * @param {string} localId
 * @param {string} namespaceInspire
 * @param {import('./_comun.js').PerfilEmision} perfil
 * @returns {import('./xml.js').NodoSalida}
 */
function nodoInspireId(localId, namespaceInspire, perfil) {
  if (perfil.id === PERFIL.ENTREGA) {
    return elem('cp:inspireId', [['xmlns:base', NS.base33]], [
      elem('base:Identifier', [], [
        elem('base:localId', [], localId),
        elem('base:namespace', [], namespaceInspire),
      ]),
    ])
  }
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
 * Atributos de la raíz, EN EL ORDEN del fichero real de cada perfil (regla de oro
 * 8). Los prefijos que se declaran y su orden salen de `perfil.prefijosRaiz`, no
 * de una lista escrita aquí: así hay UN solo sitio donde mirar qué escribe cada
 * perfil, y el test lo puede contrastar contra el fixture correspondiente.
 *
 * Diferencias entre los dos, todas leídas de sus ficheros:
 *   · ENTREGA — `gml:id` PRIMERO (la raíz `gml:FeatureCollection` hereda de
 *     `gml:AbstractGML`, donde `gml:id` es obligatorio) y ningún `xmlns` por
 *     defecto: la raíz va prefijada. Sin atributos de respuesta.
 *   · WFS — sin `gml:id`, con `xmlns` por defecto = WFS 2.0, y con
 *     `timeStamp`/`numberMatched`/`numberReturned` al final.
 *
 * El namespace de base 3.3 no se declara aquí en ninguno de los dos: vive en el
 * `inspireId`, que es donde lo ponen los ficheros del Catastro. `xlink`, `gmd` y
 * `ogc` se declaran aunque el documento no los use en ningún elemento, también
 * por fidelidad.
 *
 * @param {import('./_comun.js').PerfilEmision} perfil
 * @param {string|null} timeStamp
 * @param {string} gmlIdRaiz  Solo se usa si `perfil.raizLlevaGmlId`.
 * @param {number} miembros  Cuántos `featureMember` lleva el documento. Se PIDE y
 *   no se supone: `numberMatched`/`numberReturned` describen el documento entero,
 *   y desde F17 puede llevar varias parcelas (override O18). Cuando eran siempre
 *   uno esto era una constante del módulo, que es justo lo que hacía imposible
 *   escribir el segundo miembro sin que la raíz mintiera.
 * @returns {Array<[string, string]>}
 */
function atributosRaiz(perfil, timeStamp, gmlIdRaiz, miembros) {
  const atributos = []
  if (perfil.raizLlevaGmlId) atributos.push(['gml:id', gmlIdRaiz])
  for (const prefijo of perfil.prefijosRaiz) atributos.push([`xmlns:${prefijo}`, NS[prefijo]])
  atributos.push(['xsi:schemaLocation', perfil.schemaLocation])
  // El `xmlns` por defecto se declara si —y solo si— la raíz del perfil va SIN
  // prefijo, que es lo que la obliga a estar en el namespace por defecto. Se
  // deduce del propio nombre en vez de con una bandera aparte: así no puede
  // quedar una bandera diciendo una cosa y el nombre del elemento otra.
  if (!perfil.raiz.includes(':')) atributos.push(['xmlns', perfil.raizNs])
  if (perfil.atributosWfs) {
    if (timeStamp !== null) atributos.push(['timeStamp', timeStamp])
    atributos.push(['numberMatched', String(miembros)], ['numberReturned', String(miembros)])
  }
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
function prepararMiembroCp(opciones = {}, quien = 'serializarParcelaCp', miembros = 1) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `${quien}: se esperaba un objeto de opciones; ` + `recibido ${JSON.stringify(opciones)}.`,
    )
  }

  const {
    recintos,
    srs,
    refcat,
    perfil: idPerfil = PERFIL.ENTREGA,
    beginLifespanVersion = null,
    namespaceInspire = NAMESPACE_INSPIRE_DEFECTO,
    label = '',
    nationalCadastralReference = '',
    puntoReferencia = null,
    timeStamp = null,
    comentario = null,
    indentacion = '  ',
  } = opciones

  // ── 1 · Contrato ──────────────────────────────────────────────────────────
  // El perfil se resuelve LO PRIMERO: de él dependen la forma del `srsName`, qué
  // fechas son obligatorias y qué elementos se emiten.
  const perfil = perfilPorId(idPerfil)

  // `srsNamePorForma` valida el SRS y hace la traducción de una vez: no hay una
  // segunda tabla aquí que pudiera divergir de la de `_comun.js`.
  const srsName = srsNamePorForma(srs, perfil.formaSrsName)

  // La fecha del `beginLifespanVersion`: obligatoria en la descarga, opcional en
  // la entrega. Ver la decisión 3 de la cabecera — no es un capricho de formato,
  // es que en un alta esa fecha todavía no existe.
  if (perfil.id === PERFIL.WFS || beginLifespanVersion !== null) {
    exigirDateTime(beginLifespanVersion, 'beginLifespanVersion')
  }

  // `timeStamp` es de la respuesta del servicio y no existe fuera de ella. Se
  // LANZA en vez de ignorarlo: quien lo pasa cree que va a salir en el fichero, y
  // descubrirlo al subirlo a la Sede es exactamente el modo de fallo que este
  // módulo persigue (regla de oro 1).
  if (timeStamp !== null) {
    if (!perfil.atributosWfs) {
      throw new TypeError(
        `${quien}: 'timeStamp' no existe en el perfil ${perfil.id}. Es un atributo ` +
          `de la raíz «${PERFILES[PERFIL.WFS].raiz}», que marca cuándo respondió el servicio; ` +
          `un fichero que se SUBE a la Sede no responde a ninguna petición y su raíz ` +
          `(«${PERFILES[PERFIL.ENTREGA].raiz}») no admite el atributo.`,
      )
    }
    exigirDateTime(timeStamp, 'timeStamp')
  }

  exigirTexto(
    refcat,
    'refcat',
    'Es la IDENTIDAD de la parcela (el <localId> y la base de los gml:id): la referencia ' +
      'catastral si la hay, o el idLocal del modelo si es un alta que todavía no la tiene. ' +
      'Este módulo no se la inventa.',
  )
  if (refcat.trim().length === 0) {
    throw new RangeError(
      `${quien}: \`refcat\` no puede estar en blanco. ` +
        'En un alta sin referencia ' +
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
    perfil: perfil.id,
    subibleALaSede: perfil.id === PERFIL.ENTREGA,
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
    referencePointEmitido: perfil.emiteReferencePoint,
    beginLifespanVersion,
    timeStamp,
    numberMatched: perfil.atributosWfs ? miembros : null,
    numberReturned: perfil.atributosWfs ? miembros : null,
    detecciones: contarDetecciones(detecciones),
  }

  /** Lo que el envoltorio necesita saber además del nodo. */
  const sobre = { perfil, ids, comentarios, indentacion, timeStamp }

  if (bloqueos.length > 0) return { nodo: null, detecciones, resumen, ...sobre }

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
  // `cp:beginLifespanVersion` sale con valor o con `xsi:nil`; los otros dos
  // opcionales sólo existen en el perfil que los tiene (ver {@link PERFILES}).
  // `filter(Boolean)` NO puede tragarse nada por descuido: `elem` siempre
  // devuelve objeto, así que lo único falsy de esta lista son los `null`
  // escritos aquí a propósito.
  const hijos = ordenarSegunXsd(
    [
      nodoInspireId(refcat, namespaceInspire, perfil),
      elem('cp:label', [], label),
      elem('cp:nationalCadastralReference', [], nationalCadastralReference),
      beginLifespanVersion === null
        ? elem(
            'cp:beginLifespanVersion',
            [
              ['xsi:nil', 'true'],
              ['nilReason', NIL_REASON_BEGIN_LIFESPAN],
            ],
            null,
          )
        : elem('cp:beginLifespanVersion', [], beginLifespanVersion),
      perfil.emiteEndLifespan
        ? elem(
            'cp:endLifespanVersion',
            [
              ['xsi:nil', 'true'],
              ['nilReason', NIL_REASON_END_LIFESPAN],
            ],
            null,
          )
        : null,
      nodoGeometria(preparados.recintos, srsName, ids),
      perfil.emiteReferencePoint ? nodoReferencePoint(referencia.punto, srsName, ids) : null,
      elem('cp:areaValue', [['uom', UOM_AREA]], String(preparados.areaValue)),
    ].filter(Boolean),
    ORDEN_CADASTRAL_PARCEL,
  )

  return {
    nodo: elem('cp:CadastralParcel', [['gml:id', ids.parcela]], hijos),
    detecciones,
    resumen,
    ...sobre,
  }
}

/**
 * El DOCUMENTO a partir de los miembros ya preparados: raíz, prólogo y texto.
 *
 * El `gml:id` de la RAÍZ es el namespace INSPIRE saneado, no la identidad de
 * ninguna parcela: `xs:ID` es único en el documento y repetirlo lo invalida
 * entero (ver la cabecera). Lo compone `gml/ids.js` como los demás.
 *
 * @param {object} sobre  Perfil, ids, comentarios, indentación y timeStamp del
 *   PRIMER miembro: son comunes a todo el documento (ver `serializarExpedienteCp`,
 *   que lo exige en vez de suponerlo).
 * @param {object[]} nodos  Los `cp:CadastralParcel` ya construidos.
 * @returns {string}
 */
function documentoCp(sobre, nodos) {
  const raiz = elem(
    sobre.perfil.raiz,
    atributosRaiz(sobre.perfil, sobre.timeStamp, sobre.ids.coleccion, nodos.length),
    nodos.map((n) => elem(sobre.perfil.miembro, [], [n])),
  )

  // El prólogo es lo único que no pasa por `render` (no son elementos). Los
  // comentarios ya vienen comprobados por `normalizarComentarios`.
  const lineas = [
    DECLARACION_XML,
    ...sobre.comentarios.map((c) => `<!--${c}-->`),
    render(raiz, { indentacion: sobre.indentacion }),
  ]
  return `${lineas.join('\n')}\n`
}

/**
 * Serializa UNA parcela. Es la API de F04 y no cambia: el 100 % del uso actual
 * pasa por aquí, y hay un snapshot que exige que el fichero salga byte a byte
 * igual que antes de F17.
 *
 * @param {OpcionesParcelaCp} [opciones]
 * @returns {ResultadoSerializacion}
 */
export function serializarParcelaCp(opciones = {}) {
  const m = prepararMiembroCp(opciones, 'serializarParcelaCp', MIEMBROS_UNA_PARCELA)
  if (m.nodo === null) return { xml: null, detecciones: m.detecciones, resumen: m.resumen }
  return { xml: documentoCp(m, [m.nodo]), detecciones: m.detecciones, resumen: m.resumen }
}

/**
 * Serializa UN EXPEDIENTE: varias parcelas en **un solo documento**, una por
 * `gml:featureMember`.
 *
 * ⭐ **MEDIDO, no deducido** (override **O18**, `SPEC.md` §7.1): el 2026-08-03 se
 * subió a la Sede un `.gml` con dos miembros y el IVG devolvió POSITIVO, CSV
 * `XMWPXCN9J8DB9J89`. Lo instruía además la línea 42 de la plantilla oficial
 * —«Si se desea incluir varias parcelas en un mismo fichero, se pondrá un nuevo
 * grupo featureMember para cada parcela»— desde antes de F04. ⚠️ Medido con **dos**;
 * tres o más es plausible y NO está medido.
 *
 * Consecuencia de diseño que conviene tener presente: para entregar varias
 * parcelas **no hace falta ningún empaquetador**. El ZIP que el plan preveía se
 * canceló al medir esto.
 *
 * ── ⛔ EL RIESGO DE ESTA FUNCIÓN ES `xs:ID`, Y NO ES TEÓRICO ─────────────────
 * `idsDeParcela` compone los cuatro identificadores a partir del `refcat`, así que
 * **dos miembros con la misma referencia repiten los cuatro `gml:id` y el
 * documento entero queda inválido** — un error que ninguna herramienta local
 * enseña y que el IVG rechaza semanas después. Con un solo miembro la trampa era
 * teórica (`SPEC.md` §3.1, trampa 1); aquí es el modo de fallo principal. Por eso
 * se comprueba ANTES de renderizar y se LANZA nombrando el id repetido y las dos
 * posiciones: es un contrato roto por el programador, no un dato malo del usuario.
 *
 * ── QUÉ ES COMÚN AL DOCUMENTO Y QUÉ ES DE CADA MIEMBRO ──────────────────────
 * El sobre es UNO: perfil, prólogo, comentarios e indentación. Se exige que todos
 * los miembros declaren el mismo `perfil` y el mismo `srs` en vez de tomarlos del
 * primero y callar: mezclar un miembro de ENTREGA con uno de WFS produciría un
 * documento cuyo sobre contradice a su contenido, y hacerlo en silencio sería el
 * fallo mudo que este módulo persigue.
 *
 * ⚠️ El `gml:id` de la COLECCIÓN sale del `namespaceInspire` del PRIMER miembro, y
 * eso es correcto **aunque los miembros tengan namespaces distintos**: es
 * exactamente el caso medido —la matriz bajo `ES.SDGC.CP` y la cesión bajo
 * `ES.LOCAL.CP`— y el documento aceptado llevaba un solo id de colección.
 *
 * @param {object} opciones
 * @param {OpcionesParcelaCp[]} opciones.parcelas  Una entrada por parcela, con las
 *   mismas opciones que {@link serializarParcelaCp}. `comentario` e `indentacion`
 *   se ignoran aquí (son del documento) y se pasan aparte.
 * @param {string|null} [opciones.comentario=null]  Comentario(s) del prólogo.
 * @param {string} [opciones.indentacion='  ']  Indentación del documento.
 * @param {string|null} [opciones.timeStamp=null]  Solo en `PERFIL.WFS`.
 * @returns {{xml: string|null, detecciones: object[], resumen: object}}  `resumen`
 *   trae `porMiembro` (el resumen de cada parcela, tal cual) más el AGREGADO del
 *   documento. `xml` es `null` si CUALQUIER miembro está bloqueado: un expediente
 *   incompleto no se descarga, porque la Sede lo valida como un todo.
 * @throws {TypeError}   Si `parcelas` no es un array no vacío, si los miembros no
 *   coinciden en `perfil`/`srs`, o si dos miembros repiten un `gml:id`.
 */
export function serializarExpedienteCp(opciones = {}) {
  if (opciones === null || typeof opciones !== 'object' || Array.isArray(opciones)) {
    throw new TypeError(
      `serializarExpedienteCp: se esperaba un objeto de opciones; recibido ${JSON.stringify(opciones)}.`,
    )
  }
  const { parcelas, comentario = null, indentacion = '  ', timeStamp = null } = opciones

  if (!Array.isArray(parcelas) || parcelas.length === 0) {
    throw new TypeError(
      `serializarExpedienteCp: 'parcelas' debe ser un array con al menos una parcela; ` +
        `recibido ${JSON.stringify(parcelas)}. Para una sola, `.concat(
          'serializarParcelaCp es la función directa y su salida no cambia.',
        ),
    )
  }

  // Cada miembro se prepara con el recuento REAL del documento: `numberMatched` y
  // `numberReturned` de la raíz WFS tienen que decir cuántas van, no cuántas iban
  // cuando el sobre solo admitía una.
  const miembros = parcelas.map((p, i) =>
    prepararMiembroCp(
      { ...p, comentario, indentacion, timeStamp },
      `serializarExpedienteCp: parcelas[${i}]`,
      parcelas.length,
    ),
  )

  // ── El sobre es UNO: se exige, no se supone ───────────────────────────────
  const cabeza = miembros[0]
  for (let i = 1; i < miembros.length; i++) {
    if (miembros[i].resumen.perfil !== cabeza.resumen.perfil) {
      throw new TypeError(
        `serializarExpedienteCp: parcelas[${i}] declara el perfil ` +
          `«${miembros[i].resumen.perfil}» y parcelas[0] «${cabeza.resumen.perfil}». Un documento ` +
          'tiene UN sobre: mezclarlos daría una raíz que contradice a su contenido.',
      )
    }
    if (miembros[i].resumen.srsName !== cabeza.resumen.srsName) {
      throw new TypeError(
        `serializarExpedienteCp: parcelas[${i}] declara el SRS «${miembros[i].resumen.srs}» y ` +
          `parcelas[0] «${cabeza.resumen.srs}». Las geometrías de un mismo expediente están en el ` +
          'mismo sistema de referencia, y el `srsName` se escribe una vez por geometría: ' +
          'admitir dos husos aquí produciría un fichero cuyas parcelas no encajan entre sí.',
      )
    }
  }

  // ── ⛔ `xs:ID` único en TODO el documento ──────────────────────────────────
  const vistos = new Map()
  miembros.forEach((m, i) => {
    const suyos = [m.ids.parcela, m.ids.multiSurface, ...m.ids.surfaces, m.ids.puntoReferencia]
    for (const id of suyos) {
      if (vistos.has(id)) {
        throw new TypeError(
          `serializarExpedienteCp: el gml:id «${id}» sale en parcelas[${vistos.get(id)}] y en ` +
            `parcelas[${i}]. \`xs:ID\` es único en el DOCUMENTO, así que esto invalidaría el ` +
            'fichero entero — y el IVG lo rechazaría semanas después sin decir dónde. Los ids se ' +
            'componen a partir de `refcat`: dos parcelas del mismo expediente necesitan ' +
            'identidades distintas (en la segregación medida, la cesión llevaba el sufijo `.1`).',
        )
      }
      vistos.set(id, i)
    }
  })

  const detecciones = miembros.flatMap((m) => m.detecciones)
  const bloqueos = [...new Set(miembros.flatMap((m) => m.resumen.bloqueos))]

  const resumen = {
    emitido: bloqueos.length === 0,
    bloqueos,
    perfil: cabeza.resumen.perfil,
    subibleALaSede: cabeza.resumen.subibleALaSede,
    srs: cabeza.resumen.srs,
    srsName: cabeza.resumen.srsName,
    nMiembros: miembros.length,
    localIds: miembros.map((m) => m.resumen.localId),
    namespaces: miembros.map((m) => m.resumen.namespaceInspire),
    // La suma de lo REDONDEADO, que es lo que va escrito y lo que juzga el IVG
    // (regla de oro 11). Sumar el float64 del modelo daría otra cifra y sería la
    // que no se puede comprobar abriendo el fichero.
    areaValueTotal: miembros.reduce((s, m) => s + m.resumen.areaValue, 0),
    superficieRedondeadaTotal: miembros.reduce((s, m) => s + m.resumen.superficieRedondeada, 0),
    timeStamp,
    numberMatched: cabeza.resumen.numberMatched,
    numberReturned: cabeza.resumen.numberReturned,
    porMiembro: miembros.map((m) => m.resumen),
    detecciones: contarDetecciones(detecciones),
  }

  // Un expediente incompleto NO se descarga: la Sede valida el conjunto, y bajar
  // el fichero con una parcela menos es la invitación a presentarlo así.
  if (bloqueos.length > 0) return { xml: null, detecciones, resumen }

  return {
    xml: documentoCp(cabeza, miembros.map((m) => m.nodo)),
    detecciones,
    resumen,
  }
}

export default serializarParcelaCp

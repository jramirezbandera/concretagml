// report/literal.js — F09 · T2.2 · La DESCRIPCIÓN LITERARIA DEL LINDERO.
//
// El borrador de las frases que en España se redactan a mano para escrituras e
// instancias: «Linda al Sudoeste, en línea quebrada de 3 lados que suman 50,00 m,
// con la parcela de referencia catastral 9398515VK3799G». Es uno de los cuatro
// diferenciadores del producto (`MEJORES_PRACTICAS_GML.md` §5.6, A5;
// `spec/feature-09-informe-parcela.md`, «Descripción literaria del lindero»), y lo
// que sale de aquí acaba en un documento que firma un colegiado. De ahí que este
// fichero se pase la mitad del tiempo diciendo lo que NO afirma.
//
// ── EL RECORRIDO, DEFINIDO HASTA EL DESEMPATE ────────────────────────────────
//
// El patrón del sector (plugin QGIS Linderos360CO, y el modo en que se redacta a
// mano) es «recorrido HORARIO desde el vértice más al noroeste». Las dos mitades
// de esa frase hay que fijarlas, porque a medias dan recorridos distintos según el
// orden en que llegaron los vértices:
//
//   · «MÁS AL NOROESTE» = el vértice a MENOR DISTANCIA EUCLÍDEA de la esquina NO
//     de la caja envolvente (`geo/bbox.js#bbox` → `[minX, maxY]`), y **a igual
//     distancia gana el índice MENOR**. No es «el de mayor Y» (dos vértices
//     pueden compartir el máximo), ni «el de menor X» (lo mismo), ni «el de mayor
//     Y − X» (que depende de las unidades de cada eje aunque aquí coincidan).
//     Elegida la esquina de la caja como referencia, la respuesta es única salvo
//     empate exacto, y el empate exacto lo rompe el índice.
//   · «HORARIO» es el sentido de RECORRIDO, y **no se da por hecho el del anillo**.
//     Este repo se encuentra las dos orientaciones —el WFS del Catastro emite el
//     exterior horario (SPEC §3, override O1) y su propia plantilla oficial lo trae
//     antihorario—, así que el sentido se MIDE con `geo/area.js#orientacion` y, si
//     el anillo viene antihorario, se recorre al revés. Un lindero descrito en
//     sentido contrario nombra los cardinales opuestos (azimut + 180°) y sigue
//     leyéndose perfectamente bien: es el error silencioso exacto que prohíbe la
//     regla de oro 1.
//
// ── LA ATRIBUCIÓN DEL COLINDANTE: TOPOLÓGICA, SIN `@turf/buffer` ─────────────
//
// Regla de oro 6: de Turf solo lo TOPOLÓGICO. `buffer`, `distance`, `length`,
// `along` y `bearing` están prohibidas (son geodésicas sobre grados y aquí las
// coordenadas son metros UTM). Lo permitido es `booleanPointInPolygon`, que es
// justo lo que hace falta:
//
//   1. Punto medio del lado.
//   2. Desplazado ε = `OPERATIVOS.epsilonColindanteMetros` (0,30 m) **hacia
//      fuera**, con la normal exterior de `edit/offset.js` §1 — `signo =
//      orientacion(anillo)`, `n = signo·(u.y, −u.x)`. El signo es la pieza que se
//      suele equivocar y aquí NO viene de una convención implícita: se mide sobre
//      el anillo REALMENTE recorrido. Con el signo cambiado, el punto cae dentro
//      de la propia parcela y NINGÚN lado encuentra colindante: el fallo es total
//      y visible, no un sesgo de un lado.
//   3. `booleanPointInPolygon` contra cada vecina. Si cae dentro de una, el lado
//      linda con ella; si no cae en ninguna, `refcat: null` — que **no es lo
//      mismo** que no haber mirado (ver `vecinasConsultadas`).
//
// Límites conocidos de este método, escritos porque se van a encontrar:
//   · Un lado más corto que 2ε con el vecino en diagonal puede desplazar su punto
//     medio a la parcela de al lado. Sobre linderos reales (ε = 30 cm) hace falta
//     un lado de menos de 60 cm para que el efecto se note.
//   · Si dos colindantes se SOLAPAN, el punto cae en las dos y gana **la primera
//     de la lista recibida**. Que dos parcelas del parcelario se pisen es una
//     anomalía que señala el diagnóstico de invasión (F07, `diagnostico/topologia.js`),
//     no esta descripción; aquí solo se declara el criterio para que sea
//     reproducible.
//
// ── LO QUE ESTE TEXTO NO PUEDE DECIR ────────────────────────────────────────
//
// El ejemplo de la spec dice «con la parcela 98 del polígono 8». **Ese dato no lo
// tenemos para los colindantes y no se va a pedir**: el polígono y la parcela
// salen de `Consulta_DNPRC`, que se consulta POR referencia catastral, y hacerlo
// para los cuatro vecinos serían cinco peticiones por informe contra el régimen de
// uso del servicio (override O8: denegación de servicio ~10 días por abuso). Los
// colindantes se nombran por lo que SÍ consta en el parcelario que ya se ha
// descargado: su **referencia catastral** y su **`cp:label`** — y el `cp:label` se
// escribe entrecomillado y atribuido («rotulada «17» en el parcelario catastral»),
// nunca como «la parcela 17», que es precisamente la afirmación que no podemos
// sostener.
//
// ── LA ÚNICA COSA QUE ESTE MÓDULO PROPONE: «PRESUMIBLEMENTE, VÍA PÚBLICA» ────
//
// Y hay que leerla entera antes de imitarla, porque roza la regla de oro 9.
//
// EL HECHO. **Los viales urbanos no tienen referencia catastral.** Es uno de los
// puntos de dolor documentados del sector (`MEJORES_PRACTICAS_GML.md` §5.2, punto
// 3: «solapes/huecos con la catastral y viales urbanos sin RC»). Consecuencia
// directa sobre este texto: en una parcela urbana entre medianeras, el frente que
// da a la calle **no puede** encontrar colindante por más vecinas que se traigan
// del WFS, porque la calle no es una parcela. En la parcela de referencia del
// repo son NUEVE lados y 47,21 m de los 163,12 m del perímetro: casi un tercio.
// Escribir ahí «parcela sin identificar» obliga al técnico a reescribir a mano
// casi todos los informes, que es justo lo que este módulo existe para evitar.
//
// LA EXCEPCIÓN, Y SUS TRES CANDADOS. La app mide y el colegiado interpreta; aquí,
// por una vez, la app **propone**. Para que proponer no se confunda con afirmar:
//
//   1. **Solo en URBANA**, y la clase entra por parámetro (`clase`), no se deduce.
//      Por defecto es `null`, y con `null` o `'RUSTICA'` el texto es exactamente
//      el de siempre. En rústica, un lindero sin parcela catastral puede ser un
//      camino, un cauce, un monte público o una finca no catastrada: sugerir «vía
//      pública» ahí sería temerario, y no se hace.
//   2. **Solo si de verdad se ha mirado**: `vecinas` consultadas Y con al menos
//      una parcela dentro. Sin haber mirado no hay «ninguna parcela alcanza este
//      lindero» que sostenga la presunción; y con la lista vacía, sugerir «vía
//      pública» en los cuatro frentes sería un disparate con formato de dato.
//   3. **Se dice TRES VECES que no está verificado**, y las tres van en la misma
//      frase que el lector copia: «presumiblemente», «dato NO verificado» y
//      «confirme antes de firmar». Además la marca viaja en el DATO
//      (`tramos[].presuncionNoVerificada`), no solo en la prosa, para que el
//      diálogo de edición pueda resaltarla y el PDF sepa que ese renglón lleva
//      advertencia. Una advertencia que solo existiera en una cadena de texto se
//      pierde en el primer `replace` de quien maquete.
//
// POR QUÉ NO ABRE LA PUERTA A OTRAS. Lo que se propone aquí no es un JUICIO sobre
// la parcela —no dice si el lindero está bien, ni si encaja, ni si la superficie
// cuadra—, sino la lectura más probable de una AUSENCIA cuya causa está
// documentada y es estructural: en suelo urbano, lo que no es parcela catastral
// suele ser vial. Es el mismo estatuto que `puedeContinuar` en F08
// (`report/contraste-texto.js`): una afirmación sobre lo que la herramienta puede
// decir, no sobre el mérito de lo que mira. Cualquier otra frase que quisiera
// entrar por esta puerta tendría que traer las tres cosas que trae ésta: un hecho
// estructural documentado que la explique, una condición dura que la limite al
// caso donde ese hecho vale, y la marca de no verificada dentro del dato. El
// guardián de vocabulario de esta capa (`test/report/literal.test.js`) NO se
// relaja para dejarla pasar: la NOMBRA, la acota a los tramos que la llevan y
// exige que las tres marcas viajen juntas.
//
// **«En línea recta» solo cuando lo es.** Un tramo AGRUPADO no es un segmento:
// son varios lados casi alineados, y su longitud es la SUMA de los lados (no la
// cuerda), para que la suma de los tramos sea el perímetro. Llamar «línea recta»
// de 47,21 m a una quebrada de nueve lados sería una medida que no se puede
// replantear sobre el terreno. Por eso un tramo de un solo lado se escribe «en
// línea recta de X m» y uno agrupado «en línea quebrada de N lados que suman X m».
//
// ── REGLA DE ORO 9, Y AQUÍ PESA MÁS QUE EN NINGÚN OTRO MÓDULO ───────────────
//
// «La aplicación mide; el colegiado interpreta y firma» (SPEC §2). Esto describe
// la finca de alguien en un papel que se presenta ante notario o registrador: ni
// una palabra de mérito, ni una valoración, ni un «correctamente», ni un «se
// ajusta a». Se describe lo que hay. Hay un guardián de vocabulario sobre el texto
// generado, con las mismas palabras que el de `report/contraste-texto.js`.
//
// ── NORTE DE CUADRÍCULA ─────────────────────────────────────────────────────
//
// Los rumbos vienen de `geo/rumbo.js`, que los mide contra el eje +Y de la
// proyección UTM: es Norte de CUADRÍCULA, no geográfico (la diferencia es la
// convergencia de meridianos, que pasa de 2° en el borde del huso). Aquella
// cabecera razona por qué no se corrige; aquí lo único que toca es que **el texto
// lo diga**, porque quien lo firma tiene derecho a saber contra qué norte está
// escrito.
//
// ── PURO ────────────────────────────────────────────────────────────────────
//
// Sin DOM, sin red, sin reloj, sin estado. Misma entrada ⇒ mismo texto, hoy y
// dentro de un año. No descarga nada (el `Blob` es de `gml/descargar.js`) y **no
// envuelve el texto a un ancho de columna**: el destino es un PDF que rompe líneas
// por sí mismo y un cuadro de edición donde el usuario reescribe (la spec pide que
// sea editable antes de exportar), y unos saltos de línea duros metidos aquí se
// arrastrarían hasta la escritura.

import booleanPointInPolygon from '@turf/boolean-point-in-polygon'
import { polygon } from '@turf/helpers'

import { OPERATIVOS } from '../config/operativos.js'
import { orientacion } from '../geo/area.js'
import { bbox } from '../geo/bbox.js'
import { distancia, longitudesDeLados } from '../geo/metrica.js'
import { anilloCerrado } from '../geo/poligono.js'
import { azimut, cuadrante, nombreCardinal } from '../geo/rumbo.js'

// ── Vocabulario ─────────────────────────────────────────────────────────────

/**
 * Motivos por los que un lado del contorno NO se describe. Código, no frase: el
 * consumidor decide cómo presentarlo, igual que hace `diagnostico/topologia.js`
 * con sus `saltados`. La frase en español está en {@link FRASE_SALTADO} y este
 * módulo la escribe en el `texto`, para que un lado que no se describe no
 * desaparezca en silencio (regla de oro 1).
 *
 * @type {Readonly<Record<string, string>>}
 */
export const MOTIVO_SALTADO = Object.freeze({
  /**
   * Los dos extremos del lado son el MISMO punto, así que no hay rumbo:
   * `geo/rumbo.js#azimut` devuelve `null` y no 0 — porque 0 es el Norte, un rumbo
   * legítimo, y «linda al Norte» donde no hay lindero es lo peor que podría
   * escribirse aquí. Detectar el vértice duplicado es trabajo de la validación
   * (F02, `duplicadoMetros`); esta descripción solo se salta el lado y lo dice.
   */
  LADO_SIN_RUMBO: 'LADO_SIN_RUMBO',
})

/** La frase con la que el `texto` cuenta cada motivo de {@link MOTIVO_SALTADO}. */
const FRASE_SALTADO = Object.freeze({
  [MOTIVO_SALTADO.LADO_SIN_RUMBO]:
    'sus dos extremos son el mismo punto y no definen rumbo alguno',
})

/**
 * Lo que este módulo puede llegar a PROPONER para un tramo sin colindante
 * catastral. Hoy hay exactamente una entrada, y la cabecera («LA ÚNICA COSA QUE
 * ESTE MÓDULO PROPONE») razona por qué esa y por qué no otras.
 *
 * El valor viaja en `tramos[].presuncionNoVerificada`, cuyo NOMBRE lleva la
 * advertencia dentro a propósito: un consumidor que lea el campo no puede
 * confundirlo con un dato medido, y no hace falta que se acuerde de mirar una
 * segunda bandera para saber que esto no está comprobado.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const PRESUNCION = Object.freeze({
  /**
   * El lindero da, con toda probabilidad, a un VIAL. Los viales urbanos no tienen
   * referencia catastral (`MEJORES_PRACTICAS_GML.md` §5.2, punto 3), así que en
   * suelo urbano un frente que ninguna parcela colindante alcanza suele ser la
   * calle. **Presunción, no medición**: nadie ha consultado el callejero.
   */
  VIA_PUBLICA: 'VIA_PUBLICA',
})

/**
 * Clases de suelo que este módulo entiende, ESPEJO de
 * `services/_catastro-dnp.js#CLASE_PARCELA`.
 *
 * No se importa de allí, y es la misma decisión que tomó
 * `report/contraste-texto.js` con `OMISION_CONOCIDA`: importarlo crearía una
 * dependencia `report/ → services/`, o sea que un módulo PURO —que se prueba sin
 * red y que compone un documento— pasaría a colgar de la capa que habla con el
 * Catastro. Lo que impide que las dos listas diverjan no es la disciplina: es un
 * test-guarda que las compara (`test/report/literal.test.js`), la misma fórmula
 * con la que conviven `gml/_comun.js#SRS_SOPORTADOS` y `model/parcela.js#SRS_VALIDOS`.
 *
 * @type {Readonly<Record<string, string>>}
 */
export const CLASE_CONOCIDA = Object.freeze({
  URBANA: 'URBANA',
  RUSTICA: 'RUSTICA',
})

// ── Formato de números, en español ──────────────────────────────────────────
//
// Mismo criterio, exactamente, que `report/contraste-texto.js`: `es-ES`, coma
// decimal, dos decimales de SALIDA (regla 11: el modelo no se redondea) y
// separador de millar en las longitudes, que aquí se leen como magnitudes. Lo
// que no puede pasar es que el mismo informe escriba «12.45 m» en un sitio y
// «12,45 m» en otro. No se importa de aquel módulo porque allí es privado, y
// exportarlo convertiría un formateador interno en API; lo que impide que los dos
// diverjan es un test que compara la MISMA longitud rendida por los dos.

const FORMATO_2 = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

/**
 * Coordenadas: dos decimales y **sin separador de millar** (`439283,23`, no
 * `439.283,23`), que es la convención de cualquier listado topográfico y la misma
 * divergencia deliberada que ya hace `report/contraste-texto.js`. Un punto de
 * millar y una coma decimal en la misma cifra son la lectura equivocada más fácil
 * de cometer.
 */
const FORMATO_COORD = new Intl.NumberFormat('es-ES', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
  useGrouping: false,
})

/** Una longitud en metros, presentable. */
const metros = (v) => `${FORMATO_2.format(v)} m`

/** Un par UTM `[x, y]` como `X 439222,47 · Y 4479678,13`. */
const punto = (p) => `X ${FORMATO_COORD.format(p[0])} · Y ${FORMATO_COORD.format(p[1])}`

/** Un entero (cuentas de lados, de vértices, de colindantes). */
const FORMATO_0 = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 0 })

/** Singular o plural según la cuenta, para no escribir «1 lado(s)». */
const plural = (n, singular, pluralizado) =>
  `${FORMATO_0.format(n)} ${n === 1 ? singular : pluralizado}`

// ── Guardas de contrato ─────────────────────────────────────────────────────

/** Describe un valor para el mensaje de un `throw`. */
function describir(valor) {
  if (valor === null) return 'null'
  if (valor === undefined) return 'undefined'
  if (Array.isArray(valor)) return `un array de ${valor.length}`
  if (typeof valor === 'string') return JSON.stringify(valor)
  if (typeof valor === 'object') return 'un objeto'
  return `${typeof valor} (${String(valor)})`
}

const esObjeto = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)

/** Un texto no vacío, o `null`. Un `''` no es un dato (caso REAL de `UTM_1.gml`). */
const textoONulo = (v) => (typeof v === 'string' && v.trim() !== '' ? v : null)

/**
 * Una tolerancia numérica de las opciones, con su defecto y su dominio.
 *
 * @param {unknown} valor
 * @param {number} defecto
 * @param {string} nombre
 * @param {(n: number) => boolean} dominio
 * @param {string} queDominio  Cómo se describe el dominio en el mensaje.
 * @returns {number}
 */
function exigirTolerancia(valor, defecto, nombre, dominio, queDominio) {
  if (valor === undefined) return defecto
  if (typeof valor !== 'number') {
    throw new TypeError(
      `describirLindero: 'opciones.${nombre}' debe ser un número; recibido ${describir(valor)}.`,
    )
  }
  if (!Number.isFinite(valor) || !dominio(valor)) {
    throw new RangeError(
      `describirLindero: 'opciones.${nombre}' debe ser ${queDominio}; recibido ${valor}.`,
    )
  }
  return valor
}

// ── El recorrido ────────────────────────────────────────────────────────────

/**
 * Índice del vértice **más al noroeste**: el más cercano a la esquina NO de la
 * caja envolvente, y a igual distancia el de índice MENOR.
 *
 * El desempate por `<` estricto (y no `<=`) es lo que hace que el criterio sea
 * completo: sin él, dos vértices simétricos respecto de esa esquina darían
 * arranques distintos según en qué orden llegaran, y el mismo lindero se
 * describiría de dos maneras.
 *
 * @param {Array<[number,number]>} anillo  Anillo ABIERTO en UTM.
 * @param {{minX: number, maxY: number}} caja  La envolvente de la parcela.
 * @returns {number}
 */
function indiceMasAlNoroeste(anillo, caja) {
  const esquina = [caja.minX, caja.maxY]
  let mejor = 0
  let mejorD = distancia(anillo[0], esquina)
  for (let i = 1; i < anillo.length; i++) {
    const d = distancia(anillo[i], esquina)
    if (d < mejorD) {
      mejor = i
      mejorD = d
    }
  }
  return mejor
}

/**
 * El anillo REORDENADO para el recorrido: horario y arrancando en `inicio`.
 *
 * Devuelve los ÍNDICES en el anillo original, no los puntos, porque los tramos
 * declaran `indiceInicio`/`indiceFin` referidos al anillo tal como se recibió: si
 * el llamante quiere señalar el vértice en el mapa, tiene que poder indexar su
 * propio array.
 *
 * @param {number} n        Número de vértices.
 * @param {number} inicio   Índice del vértice de arranque.
 * @param {boolean} alReves `true` si el anillo venía ANTIHORARIO y hay que
 *   recorrerlo en sentido inverso al de sus índices.
 * @returns {number[]}  `n` índices, en orden de recorrido.
 */
function ordenDeRecorrido(n, inicio, alReves) {
  const orden = new Array(n)
  for (let k = 0; k < n; k++) {
    // El doble módulo del sentido inverso no es adorno: `-k % n` es NEGATIVO en
    // JavaScript, y un índice negativo daría `undefined` en el primer acceso.
    orden[k] = alReves ? (((inicio - k) % n) + n) % n : (inicio + k) % n
  }
  return orden
}

// ── Las vecinas ─────────────────────────────────────────────────────────────

/**
 * Una vecina en forma de polígono de Turf (con sus huecos), o `null` si su
 * geometría no forma anillo.
 *
 * Se admite `recintos: []` sin quejarse porque es lo que produce el cableado para
 * una vecina que el Catastro devolvió sin geometría (`app/cableado-diagnostico.js#aVecinas`,
 * que a propósito no la filtra). No puede contener a ningún punto, así que no
 * cambia ninguna atribución; lo que no puede es desaparecer sin más, y por eso el
 * `texto` las cuenta.
 *
 * @param {{recintos: Array<{vertices: Array<[number,number]>}>}} vecina
 * @returns {object|null}
 */
function poligonoDeVecina(vecina) {
  const recintos = Array.isArray(vecina?.recintos) ? vecina.recintos : []
  const apto = (r) => Array.isArray(r?.vertices) && r.vertices.length >= 3
  if (recintos.length === 0 || !apto(recintos[0])) return null
  const anillos = [anilloCerrado(recintos[0].vertices)]
  for (let i = 1; i < recintos.length; i++) {
    if (apto(recintos[i])) anillos.push(anilloCerrado(recintos[i].vertices))
  }
  return polygon(anillos)
}

// ── La agrupación ───────────────────────────────────────────────────────────

/**
 * Diferencia angular entre dos rumbos, en grados y **por el camino corto**:
 * siempre en [0, 180]. Sin esto, 359° y 1° parecerían 358° distintos cuando son
 * 2°, y un lindero que cruza el Norte se partiría en dos tramos por nada.
 *
 * @param {number} a  Azimut en grados.
 * @param {number} b  Azimut en grados.
 * @returns {number}
 */
function separacionAngular(a, b) {
  const bruta = Math.abs(a - b) % 360
  return bruta > 180 ? 360 - bruta : bruta
}

// ── La redacción ────────────────────────────────────────────────────────────

/**
 * Con quién linda un tramo, en palabras. Los cinco casos se escriben DISTINTO a
 * propósito; los tres últimos son el mismo `refcat: null` del contrato y no
 * significan lo mismo.
 *
 * @param {{refcat: string|null, label: string|null, presuncionNoVerificada: string|null}} tramo
 * @param {boolean} consultadas
 * @returns {string}
 */
function conQuienLinda(tramo, consultadas) {
  if (tramo.refcat !== null) {
    const rotulo =
      tramo.label === null ? '' : `, rotulada «${tramo.label}» en el parcelario catastral`
    return `con la parcela de referencia catastral ${tramo.refcat}${rotulo}`
  }
  if (tramo.label !== null) {
    return (
      `con la parcela rotulada «${tramo.label}» en el parcelario catastral, ` +
      'de la que no consta referencia catastral'
    )
  }
  // La ÚNICA propuesta del módulo, con sus tres avisos en la misma frase que el
  // lector copia y pega: «presumiblemente», «NO verificado» y «confirme antes de
  // firmar». Los tres van juntos o no va ninguno (ver la cabecera y el guardián de
  // vocabulario de `test/report/literal.test.js`).
  if (tramo.presuncionNoVerificada === PRESUNCION.VIA_PUBLICA) {
    return (
      'presumiblemente con vía pública (ninguna parcela catastral colindante alcanza ' +
      'este lindero; dato NO verificado, confirme antes de firmar)'
    )
  }
  // Los dos «no hay» que no se pueden confundir. La primera frase dice lo que se
  // sabe SIN afirmar que no haya nadie al otro lado —siempre hay algo: una calle,
  // un camino, un cauce, una parcela que no se ha traído—, y la segunda dice que
  // no se ha mirado. Escribir «con nadie» sería falso en los dos casos.
  return consultadas
    ? 'con parcela sin identificar (ninguna de las colindantes consultadas pone ' +
        'referencia catastral a este lindero)'
    : 'con parcela sin identificar (no se han consultado las parcelas colindantes)'
}

/** La medida de un tramo: recta si es un solo lado, quebrada si se agruparon varios. */
const medidaDelTramo = (tramo) =>
  tramo.nLados === 1
    ? `en línea recta de ${metros(tramo.longitud)}`
    : `en línea quebrada de ${plural(tramo.nLados, 'lado', 'lados')} que suman ${metros(tramo.longitud)}`

/**
 * Una frase de lindero por cada RACHA de tramos consecutivos con el mismo
 * cardinal, que es lo que pide la spec («agrupando por cuadrantes N/E/S/O») y lo
 * que hace legible el resultado: «Linda al Norte, en línea recta de 12,45 m, con
 * A; y en línea recta de 3,20 m, con B.»
 *
 * @param {Array<object>} tramos
 * @param {boolean} consultadas
 * @returns {string[]}  Una frase por racha, en el orden del recorrido.
 */
function frasesDeLindero(tramos, consultadas) {
  const frases = []
  let i = 0
  while (i < tramos.length) {
    let j = i + 1
    while (j < tramos.length && tramos[j].cardinal === tramos[i].cardinal) j++
    const partes = tramos
      .slice(i, j)
      .map((t) => `${medidaDelTramo(t)}, ${conQuienLinda(t, consultadas)}`)
    const cuerpo =
      partes.length === 1
        ? partes[0]
        : `${partes.slice(0, -1).join('; ')}; y ${partes[partes.length - 1]}`
    frases.push(`Linda al ${tramos[i].cardinal}, ${cuerpo}.`)
    i = j
  }
  return frases
}

/** Rótulo con el que abre la nota técnica dentro del documento completo. */
const ROTULO_NOTA = 'Nota técnica.'

/**
 * El documento, en sus DOS mitades: el lindero y la nota técnica.
 *
 * ── POR QUÉ EL MÉTODO VA AL PIE Y NO A LA CABEZA ────────────────────────────
 * La descripción empieza en «Linda al Este…», que es como se lee un lindero en
 * una escritura y como se copia y pega en una instancia. Todo lo metodológico
 * —sentido del recorrido, vértice de arranque, Norte de cuadrícula, reparto en
 * tramos, qué significa que un tramo no lleve referencia catastral— es
 * imprescindible y **no se pierde ni una palabra**: baja al final, agrupado, para
 * que quien componga el PDF pueda ponerlo en cuerpo menor sin trocear nada. Un
 * preámbulo metodológico delante obliga a saltárselo en cada lectura y, sobre
 * todo, se cuela en el portapapeles de quien solo quería los linderos.
 *
 * @param {object} datos
 * @returns {{lindero: string[], notaTecnica: string[]}}  Párrafos sueltos, sin
 *   envolver a ningún ancho (ver la cabecera del módulo).
 */
function redactar({
  tramos,
  saltados,
  consultadas,
  nVecinas,
  nVecinasSinGeometria,
  nVertices,
  arranque,
  nHuecos,
  longitudTotal,
  clase,
}) {
  const lindero = []
  const nota = []

  if (tramos.length > 0) {
    lindero.push(...frasesDeLindero(tramos, consultadas))
  } else if (arranque === null) {
    // Contorno que no llega a anillo. Esto NO es nota técnica: es la respuesta a
    // «descríbeme el lindero», y va donde iría el lindero.
    lindero.push(
      `No hay lindero que describir: el contorno exterior, de ` +
        `${plural(nVertices, 'vértice', 'vértices')}, no llega a formar anillo (hacen falta ` +
        `al menos tres). Sin anillo no hay lados, ni rumbos, ni colindantes que atribuir.`,
    )
  } else {
    lindero.push(
      'No ha podido describirse ningún tramo: todos los lados del contorno se han quedado ' +
        'sin describir, y el motivo de cada uno va en la nota técnica.',
    )
  }

  // ── La nota técnica ───────────────────────────────────────────────────────

  if (arranque !== null) {
    // El vértice de arranque se cita por sus COORDENADAS y no por su número de
    // orden, y es una decisión: el número de orden depende de por dónde empiece la
    // lista de vértices del fichero —el mismo lindero, con los vértices al revés,
    // llevaría otro número— mientras que la coordenada es la misma en los dos
    // casos y, además, es la que se puede replantear sobre el terreno. El ÍNDICE,
    // para quien lo necesite, viaja en `tramos[0].indiceInicio`.
    nota.push(
      `${ROTULO_NOTA} El contorno exterior de la parcela, de ` +
        `${plural(nVertices, 'vértice', 'vértices')}, se recorre en sentido horario desde el ` +
        `vértice más al noroeste (${punto(arranque)}). Los rumbos son de Norte de cuadrícula ` +
        `—el eje +Y de la proyección UTM, que es el norte de los planos de este informe—, no ` +
        `de Norte geográfico.`,
    )
  }

  if (tramos.length > 0) {
    nota.push(
      `El recorrido descrito se reparte en ${plural(tramos.length, 'tramo', 'tramos')} y ` +
        `suma ${metros(longitudTotal)}, que es el perímetro del contorno exterior.`,
    )

    if (consultadas) {
      nota.push(
        nVecinas === 0
          ? 'No se ha aportado ninguna parcela colindante con la que contrastar el lindero, ' +
              'de modo que ningún tramo lleva referencia catastral.'
          : `El lindero se ha contrastado lado a lado con ${plural(nVecinas, 'parcela del parcelario catastral', 'parcelas del parcelario catastral')}. ` +
              'Que un tramo no lleve referencia catastral no significa que no haya nada al ' +
              'otro lado: significa que ninguna de esas parcelas lo alcanza.',
      )
    } else {
      nota.push(
        'No se han consultado las parcelas colindantes, así que esta descripción no dice ' +
          'con quién linda ninguno de los tramos. No es lo mismo que haber mirado y no ' +
          'haber encontrado colindante.',
      )
    }

    // La presunción, explicada donde se explica todo lo demás. Va ADEMÁS de los
    // tres avisos que lleva la propia frase del lindero, no en su lugar: quien
    // solo copie los linderos se lleva la advertencia igualmente.
    const conPresuncion = tramos.filter((t) => t.presuncionNoVerificada !== null)
    if (conPresuncion.length > 0) {
      nota.push(
        `${plural(conPresuncion.length, 'tramo se describe', 'tramos se describen')} como vía ` +
          'pública POR PRESUNCIÓN y no por medición: la parcela consta como URBANA y los ' +
          'viales urbanos no tienen referencia catastral, así que un frente que ninguna ' +
          'parcela colindante alcanza suele ser la calle. Esta aplicación no ha consultado ' +
          'el callejero ni el inventario de bienes de dominio público: quien firma tiene que ' +
          'comprobarlo.',
      )
    } else if (clase === CLASE_CONOCIDA.RUSTICA) {
      // Por qué NO se propone nada en rústica, dicho en el documento y no solo en
      // el código: es la mitad honrada del candado 1.
      nota.push(
        'La parcela consta como RÚSTICA. En rústica, un lindero que ninguna parcela ' +
          'catastral alcanza puede ser un camino, un cauce, un monte público o una finca no ' +
          'catastrada, así que esta descripción no propone ninguna de esas lecturas.',
      )
    }

    if (nVecinasSinGeometria > 0) {
      nota.push(
        `${plural(nVecinasSinGeometria, 'parcela colindante aportada no trae geometría', 'parcelas colindantes aportadas no traen geometría')} ` +
          'con la que comparar, así que no ha podido atribuirse a ningún tramo.',
      )
    }
  }

  if (nHuecos > 0) {
    nota.push(
      `La parcela tiene ${plural(nHuecos, 'hueco interior', 'huecos interiores')}, cuyo ` +
        'contorno no forma parte de esta descripción: aquí se describe el lindero exterior.',
    )
  }

  if (saltados.length > 0) {
    const detalle = saltados
      .map(
        (s) =>
          `el lado que arranca en el vértice ${FORMATO_0.format(s.indice + 1)}, porque ` +
          `${FRASE_SALTADO[s.motivo] ?? `su motivo es ${s.motivo}`}`,
      )
      .join('; ')
    nota.push(
      `${plural(saltados.length, 'lado del contorno se ha quedado', 'lados del contorno se han quedado')} ` +
        `sin describir: ${detalle}.`,
    )
  }

  // Si el contorno no llegaba a anillo no hay nota que dar, y el rótulo tampoco:
  // un epígrafe «Nota técnica.» seguido de nada es un hueco con nombre. Cuando la
  // nota empieza por otro párrafo (no hay arranque pero sí saltados), el rótulo se
  // le pone al primero que haya.
  if (nota.length > 0 && !nota[0].startsWith(ROTULO_NOTA)) {
    nota[0] = `${ROTULO_NOTA} ${nota[0]}`
  }

  return { lindero, notaTecnica: nota }
}

/**
 * El objeto de salida, montado en UN SOLO SITIO.
 *
 * `texto` no se compone aparte de `lindero` y `notaTecnica`: se compone DE ellos,
 * y por eso la identidad `texto === [...lindero, ...notaTecnica].join('\n\n')` no
 * es una promesa del JSDoc que haya que mantener a mano, sino la única forma en
 * que este módulo sabe fabricar la cadena. Dos vistas del mismo documento que
 * pudieran discrepar serían dos documentos.
 *
 * @param {object} datos  Lo que necesita {@link redactar}.
 * @returns {{tramos: object[], texto: string, lindero: string[],
 *   notaTecnica: string[], vecinasConsultadas: boolean, saltados: object[]}}
 */
function salida(datos) {
  const { lindero, notaTecnica } = redactar(datos)
  return {
    tramos: datos.tramos,
    texto: [...lindero, ...notaTecnica].join('\n\n'),
    lindero,
    notaTecnica,
    vecinasConsultadas: datos.consultadas,
    saltados: datos.saltados,
  }
}

// ── La función pública ──────────────────────────────────────────────────────

/**
 * Una parcela vecina, tal como la consume este módulo.
 *
 * Es la `Vecina` de `diagnostico/_comun.js` **más el `cp:label`**, que allí no
 * hacía falta (un hallazgo de invasión se nombra por referencia catastral) y aquí
 * es la única otra cosa que el parcelario dice de un colindante sin gastar una
 * petición más (ver la cabecera, «Lo que este texto no puede decir»). La
 * traducción `ParcelaGml → Vecina` es del cableado, no de esta capa.
 *
 * @typedef {Object} VecinaLiteral
 * @property {string|null} [refcat]  Referencia catastral, o `null` si no consta.
 * @property {string|null} [label]   `cp:label` del parcelario, o `null`.
 * @property {Array<{vertices: Array<[number,number]>, tipo?: string}>} recintos
 *   Su geometría; `[]` es legítimo (el Catastro devolvió la vecina sin geometría).
 */

/**
 * Un tramo del lindero: uno o varios lados consecutivos fundidos.
 *
 * @typedef {Object} TramoLindero
 * @property {string} cardinal  Nombre del cuadrante tal como se escribe («Norte»,
 *   «Sudoeste»…), el de `geo/rumbo.js#nombreCardinal`. El CÓDIGO ('N', 'SO') se
 *   obtiene con `cuadrante(azimut)`: no se duplica aquí.
 * @property {number} azimut  Rumbo del tramo en grados [0, 360), desde el Norte de
 *   CUADRÍCULA y horario. En un tramo agrupado es el rumbo de la CUERDA (del
 *   primer vértice al último), que es la dirección media pesada por longitud.
 * @property {number} longitud  Metros. **Suma de los lados**, no la cuerda: así la
 *   suma de los tramos es el perímetro del contorno exterior y ninguna cifra de
 *   esta descripción contradice a `geo/metrica.js#perimetroAnillo`.
 * @property {string|null} refcat  Referencia catastral del colindante, o `null` si
 *   ninguna de las vecinas alcanza el tramo. `null` **no** distingue por sí solo
 *   «no hay» de «no se ha mirado»: eso lo dice `vecinasConsultadas`.
 * @property {string|null} label  `cp:label` del colindante, o `null`.
 * @property {number} indiceInicio  Índice, EN EL ANILLO TAL COMO SE RECIBIÓ, del
 *   vértice donde arranca el tramo.
 * @property {number} indiceFin  Índice del vértice donde termina. Con el anillo
 *   antihorario el recorrido va al revés que los índices, así que `indiceFin`
 *   puede ser menor que `indiceInicio`: son índices, no un rango ordenado.
 * @property {number} nLados  Cuántos lados se han fundido en el tramo (≥ 1).
 * @property {string|null} presuncionNoVerificada  Código de {@link PRESUNCION} si
 *   este tramo se describe por PRESUNCIÓN y no por medición, `null` si no. Hoy el
 *   único valor posible es `'VIA_PUBLICA'`, y solo aparece en parcela URBANA con
 *   colindantes realmente consultadas (los tres candados están en la cabecera).
 *   **El nombre lleva la advertencia dentro a propósito**: quien pinte este tramo
 *   en un diálogo o en un PDF no puede leerlo sin enterarse de que no está
 *   comprobado, y no depende de acordarse de mirar una segunda bandera.
 */

/**
 * La descripción literaria del lindero de una parcela.
 *
 * ```js
 * const { lindero, notaTecnica, texto, tramos } = describirLindero({
 *   recintos,          // los del modelo: [0] EXTERIOR, el resto HUECOS
 *   vecinas: colindantes,  // null = NO se han consultado; [] = se consultaron y no hay
 *   clase: 'URBANA',   // 'URBANA' | 'RUSTICA' | null (defecto)
 * })
 * ```
 *
 * ### Las tres vistas del mismo documento
 *
 * `texto` es el documento entero y `lindero` / `notaTecnica` son sus dos mitades,
 * en párrafos sueltos, para que quien componga el PDF pueda darle a la nota un
 * cuerpo menor sin trocear cadenas. La identidad
 * **`texto === [...lindero, ...notaTecnica].join('\n\n')`** se cumple SIEMPRE y hay
 * un test que la afirma: dos vistas que pudieran discrepar serían dos documentos.
 * El lindero va PRIMERO —«Linda al Este…»— porque es lo que se copia a una
 * escritura o a una instancia; lo metodológico va al pie, entero y sin perder una
 * palabra.
 *
 * ### Lo que garantiza
 *
 *   · **Recorrido horario desde el vértice más al noroeste**, mida lo que mida la
 *     orientación del anillo recibido: el mismo lindero da **el mismo `texto`**
 *     tanto si los vértices vienen horarios como antihorarios. Los `indiceInicio`
 *     / `indiceFin` sí cambian, porque son índices en la lista que llegó, y por eso
 *     el texto nombra el vértice de arranque por sus COORDENADAS. La única grieta
 *     de esa igualdad es el EMPATE exacto en la distancia a la esquina NO: lo rompe
 *     el índice menor, que es lo que la lista dice, así que dos listas distintas
 *     pueden arrancar en vértices distintos. Con coordenadas de campo el empate
 *     exacto no se da; con una figura simétrica de laboratorio, sí.
 *   · **`Σ tramos[i].longitud === perimetroAnillo(recintos[0].vertices)`** salvo el
 *     redondeo de la suma en float64. Un lado sin rumbo (dos vértices coincidentes)
 *     mide 0, así que tampoco rompe la igualdad al quedar fuera.
 *   · **`null` no es `[]`**: `vecinas: null` ⇒ `vecinasConsultadas: false` y el
 *     texto dice que no se ha mirado; `vecinas: []` ⇒ `true` y el texto dice que se
 *     ha mirado y ninguna alcanza el lindero. Son afirmaciones distintas y la
 *     segunda no se puede escribir cuando lo cierto es la primera.
 *   · **Ni una palabra de mérito** (regla de oro 9). Aquí no hay conclusiones. Lo
 *     único que el módulo PROPONE es la vía pública de un frente urbano sin
 *     colindante catastral, con sus tres candados y sus tres avisos; la cabecera
 *     razona por qué esa excepción está justificada y por qué no abre la puerta a
 *     ninguna otra.
 *
 * @param {Object} entrada
 * @param {Array<{vertices: Array<[number,number]>, tipo: 'EXTERIOR'|'HUECO'}>} entrada.recintos
 *   Los del modelo. Se describe SOLO el exterior (`recintos[0]`).
 * @param {VecinaLiteral[]|null} [entrada.vecinas=null]  Las parcelas colindantes.
 *   **`null` significa «no se han consultado»** y `[]` significa «se han consultado
 *   y no hay ninguna conocida». No se pueden confundir.
 * @param {'URBANA'|'RUSTICA'|null} [entrada.clase=null]  Clase de suelo de la
 *   parcela, la que produce `services/_catastro-dnp.js` (contrato E). **Solo sirve
 *   para una cosa**: habilitar la presunción de vía pública, que se limita a
 *   `'URBANA'`. Con `null` («no consta», que es el defecto) o `'RUSTICA'` el texto
 *   es exactamente el mismo que si el parámetro no existiera. No se deduce de nada:
 *   una clase adivinada aquí acabaría escribiendo «vía pública» en un lindero de
 *   monte.
 * @param {Object} [entrada.opciones]
 * @param {number} [entrada.opciones.epsilonMetros]  Cuánto se aleja del lindero,
 *   hacia fuera, el punto con el que se pregunta por el colindante. Defecto
 *   `OPERATIVOS.epsilonColindanteMetros` (0,30 m). > 0.
 * @param {number} [entrada.opciones.rumboSimilarGrados]  Cuánto puede separarse el
 *   rumbo de un lado del rumbo del PRIMER lado de su tramo para fundirse con él.
 *   Defecto `OPERATIVOS.rumboSimilarGrados` (22,5°). ∈ (0, 180].
 * @returns {{tramos: TramoLindero[], texto: string, lindero: string[],
 *   notaTecnica: string[], vecinasConsultadas: boolean,
 *   saltados: Array<{indice: number, motivo: string}>}}
 *   `lindero` son los párrafos «Linda al …» y `notaTecnica` el método, en párrafos
 *   sueltos y sin envolver; `texto` es la concatenación de los dos con línea en
 *   blanco entre párrafos. `saltados[].indice` es el índice, en el anillo tal como
 *   se recibió, del vértice donde arranca el lado que no se ha descrito.
 * @throws {TypeError} Contrato del programador: `entrada` que no es objeto,
 *   `recintos` que no es un array, `vecinas` que no es un array ni `null`, `clase`
 *   que no es una de {@link CLASE_CONOCIDA} ni `null`, una vecina que no es objeto,
 *   u opciones que no son números. También lo que rechace
 *   `geo/bbox.js#bbox`, que es quien impone aquí el invariante EXTERIOR/HUECO: un
 *   `recintos` roto es un bug de `model/parcela.js`, no un dato del usuario, y ese
 *   módulo ya decidió —con su razón escrita— que eso suena en vez de absorberse.
 * @throws {RangeError} Si `recintos` está vacío o si una tolerancia se sale de su
 *   dominio. **Un contorno con menos de 3 vértices NO lanza**: es un dato posible
 *   del usuario, y se devuelve `tramos: []` con el motivo escrito en `texto`
 *   (mismo criterio que `geo/metrica.js#longitudesDeLados`, que devuelve `[]`).
 */
export function describirLindero(entrada) {
  if (!esObjeto(entrada)) {
    throw new TypeError(
      `describirLindero: se espera un objeto {recintos, vecinas, clase, opciones}; ` +
        `recibido ${describir(entrada)}.`,
    )
  }

  const { recintos, vecinas = null, clase = null, opciones = {} } = entrada

  if (!Array.isArray(recintos)) {
    throw new TypeError(
      `describirLindero: 'recintos' debe ser un array de recintos {vertices, tipo}; ` +
        `recibido ${describir(recintos)}.`,
    )
  }
  if (recintos.length === 0) {
    throw new RangeError(
      'describirLindero: se esperaba al menos un recinto (el EXTERIOR) y ha llegado la ' +
        'lista vacía. Sobre el vacío no hay lindero que describir.',
    )
  }
  if (vecinas !== null && !Array.isArray(vecinas)) {
    throw new TypeError(
      `describirLindero: 'vecinas' debe ser un array o null; recibido ${describir(vecinas)}. ` +
        'null significa «no se han consultado» y [] significa «se han consultado y no hay ' +
        'ninguna»: son cosas distintas y por eso no se admite undefined como sinónimo de [].',
    )
  }
  if (clase !== null && !Object.hasOwn(CLASE_CONOCIDA, clase === undefined ? '' : String(clase))) {
    // `Object.hasOwn` y no `CLASE_CONOCIDA[clase] === undefined`: con 'constructor'
    // la búsqueda directa encontraría algo HEREDADO y habilitaría la presunción por
    // la puerta de atrás. Y se LANZA en vez de tratar lo desconocido como `null`:
    // un `'urbana'` en minúscula o un `'UR'` del servicio pasarían por «no consta»
    // y la presunción desaparecería en silencio, que es la avería más difícil de
    // ver de todas —el texto seguiría siendo correcto, solo que peor.
    throw new TypeError(
      `describirLindero: 'clase' debe ser ${Object.keys(CLASE_CONOCIDA).join(' o ')} (o null ` +
        `si no consta); recibido ${describir(clase)}. Es el vocabulario de ` +
        `services/_catastro-dnp.js#CLASE_PARCELA, en mayúsculas y en español.`,
    )
  }
  if (!esObjeto(opciones)) {
    throw new TypeError(
      `describirLindero: 'opciones' debe ser un objeto; recibido ${describir(opciones)}.`,
    )
  }

  const epsilon = exigirTolerancia(
    opciones.epsilonMetros,
    OPERATIVOS.epsilonColindanteMetros,
    'epsilonMetros',
    (n) => n > 0,
    'un número de metros mayor que 0',
  )
  const rumboSimilar = exigirTolerancia(
    opciones.rumboSimilarGrados,
    OPERATIVOS.rumboSimilarGrados,
    'rumboSimilarGrados',
    (n) => n > 0 && n <= 180,
    'un ángulo en grados dentro de (0, 180]',
  )

  const consultadas = vecinas !== null
  const listaVecinas = consultadas ? vecinas : []
  for (let i = 0; i < listaVecinas.length; i++) {
    if (!esObjeto(listaVecinas[i])) {
      throw new TypeError(
        `describirLindero: 'vecinas[${i}]' debe ser un objeto {refcat, label, recintos}; ` +
          `recibido ${describir(listaVecinas[i])}.`,
      )
    }
  }

  const anillo = Array.isArray(recintos[0]?.vertices) ? recintos[0].vertices : []
  const n = anillo.length
  const nHuecos = recintos.length - 1

  // Contorno que no llega a anillo: NO se lanza (es un dato posible, no un bug del
  // programador) y no se inventa un tramo. `bbox()` sí lanzaría, así que se
  // resuelve antes de llamarla.
  if (n < 3) {
    return salida({
      tramos: [],
      saltados: [],
      consultadas,
      nVecinas: listaVecinas.length,
      nVecinasSinGeometria: 0,
      nVertices: n,
      arranque: null,
      nHuecos,
      longitudTotal: 0,
      clase,
    })
  }

  // ── 1 · El recorrido ──────────────────────────────────────────────────────
  const caja = bbox(recintos)
  const inicio = indiceMasAlNoroeste(anillo, caja)
  // `orientacion` mide el sentido del anillo RECIBIDO; +1 es antihorario, y
  // entonces recorrer en el orden de los índices sería recorrer al revés.
  const alReves = orientacion(anillo) === 1
  const orden = ordenDeRecorrido(n, inicio, alReves)

  // El anillo tal como se RECORRE. De él sale el signo de la normal exterior, con
  // la fórmula medida de `edit/offset.js` §1: así el signo no depende de que la
  // inversión de arriba esté bien, sino del anillo que de verdad se está usando.
  const recorrido = orden.map((i) => anillo[i])
  const signo = orientacion(recorrido)

  // Las longitudes NO se recalculan aquí: son las de `geo/metrica.js`, que ya
  // devuelve los n lados incluido el de cierre. `lados[k]` es el lado v[k]→v[k+1].
  const lados = longitudesDeLados(anillo)

  // ── 2 · Las vecinas, una sola vez ─────────────────────────────────────────
  const poligonos = listaVecinas.map(poligonoDeVecina)
  const nVecinasSinGeometria = poligonos.filter((p) => p === null).length

  // ── 3 · Lado a lado ───────────────────────────────────────────────────────
  const saltados = []
  const descritos = []

  for (let k = 0; k < n; k++) {
    const iDesde = orden[k]
    const iHasta = orden[(k + 1) % n]
    const a = anillo[iDesde]
    const b = anillo[iHasta]

    const az = azimut(a, b)
    if (az === null) {
      // Dos vértices coincidentes: no hay rumbo. Tratar el `null` como 0 lo
      // convertiría en «linda al Norte», que es un rumbo legítimo y por tanto una
      // mentira que nadie detectaría (`geo/rumbo.js#azimut`). El lado mide 0 m, así
      // que dejarlo fuera no altera la suma de longitudes.
      saltados.push({ indice: iDesde, motivo: MOTIVO_SALTADO.LADO_SIN_RUMBO })
      continue
    }

    // El lado k del anillo va de v[k] a v[k+1]; recorriéndolo al revés, el lado
    // iDesde→iHasta es el `lados[iHasta]`. La longitud no se vuelve a calcular.
    const longitud = alReves ? lados[iHasta] : lados[iDesde]

    // EL SIGNO (`edit/offset.js` §1): `(u.y, −u.x)` es la normal a la DERECHA del
    // recorrido y `orientacion` decide de qué lado queda el exterior. Con el signo
    // cambiado, el punto cae DENTRO de la propia parcela y ningún lado encuentra
    // colindante.
    const ux = (b[0] - a[0]) / longitud
    const uy = (b[1] - a[1]) / longitud
    const nx = signo * uy
    const ny = signo * -ux
    const sonda = [
      (a[0] + b[0]) / 2 + epsilon * nx,
      (a[1] + b[1]) / 2 + epsilon * ny,
    ]

    // La PRIMERA vecina que contiene la sonda (ver «Límites conocidos» en la
    // cabecera). Sin `ignoreBoundary`: si la sonda cayera justo sobre el borde de
    // la vecina, ese lado linda con ella tanto como si cayera dentro.
    let vecina = null
    for (let v = 0; v < poligonos.length; v++) {
      if (poligonos[v] !== null && booleanPointInPolygon(sonda, poligonos[v])) {
        vecina = listaVecinas[v]
        break
      }
    }

    descritos.push({
      iDesde,
      iHasta,
      azimut: az,
      longitud,
      refcat: textoONulo(vecina?.refcat),
      label: textoONulo(vecina?.label),
    })
  }

  // ── 4 · Agrupación en tramos ──────────────────────────────────────────────
  //
  // Se funden lados CONSECUTIVOS con el MISMO colindante y rumbo similar. La
  // comparación es contra el PRIMER lado del tramo y no contra el anterior: en
  // cadena, mil lados que giren un grado cada uno acabarían en un solo «tramo» que
  // ha dado la vuelta entera. Comparando con el primero, la apertura total del
  // tramo está acotada por la tolerancia.
  const tramos = []
  for (const lado of descritos) {
    const ultimo = tramos.length === 0 ? null : tramos[tramos.length - 1]
    const mismoColindante =
      ultimo !== null && ultimo.refcat === lado.refcat && ultimo.label === lado.label
    const rumboParecido =
      ultimo !== null && separacionAngular(ultimo.azimutPrimero, lado.azimut) <= rumboSimilar

    if (mismoColindante && rumboParecido) {
      ultimo.longitud += lado.longitud
      ultimo.indiceFin = lado.iHasta
      ultimo.nLados += 1
      // ⛔ `azimutPrimero` NO se actualiza, y ésa es toda la diferencia entre las
      // dos reglas: refrescarlo con el rumbo del lado recién absorbido convertiría
      // la comparación de arriba en «contra el anterior» y devolvería la deriva en
      // cadena. Hay un test con un polígono de 36 lados que lo caza.
      continue
    }
    tramos.push({
      azimutPrimero: lado.azimut,
      longitud: lado.longitud,
      refcat: lado.refcat,
      label: lado.label,
      indiceInicio: lado.iDesde,
      indiceFin: lado.iHasta,
      nLados: 1,
    })
  }

  // ── 5 · La presunción, con sus TRES candados ──────────────────────────────
  //
  // Los tres se evalúan aquí y no dentro del bucle porque los tres son globales a
  // la parcela; el cuarto (que el tramo no tenga colindante) es por tramo. Ver la
  // cabecera, «LA ÚNICA COSA QUE ESTE MÓDULO PROPONE».
  //
  //   1. URBANA — en rústica, un lindero sin parcela catastral puede ser un
  //      camino, un cauce, un monte público o una finca no catastrada.
  //   2. Consultadas — sin haber mirado no hay «ninguna parcela alcanza este
  //      lindero» que sostenga nada.
  //   3. Y con alguna vecina DENTRO: con la lista vacía no se ha contrastado
  //      contra nada, y proponer «vía pública» en los cuatro frentes de una
  //      parcela sería un disparate con formato de dato.
  //
  // ⚠️ Hoy el candado 3 IMPLICA al 2 —`listaVecinas` es `[]` cuando no se ha
  // consultado, unas líneas más arriba—, así que quitar `consultadas` de esta
  // expresión no cambiaría nada y no hay test que lo cace: MEDIDO por mutación, no
  // supuesto. Se deja escrito porque es una condición del CRITERIO y no del
  // cálculo: el día que `listaVecinas` deje de estar vacía en ese caso, el candado
  // tiene que seguir aquí y no haber que redescubrirlo.
  const proponerViaPublica =
    clase === CLASE_CONOCIDA.URBANA && consultadas && listaVecinas.length > 0

  // El rumbo de un tramo agrupado es el de su CUERDA (primer vértice → último):
  // la dirección media pesada por la longitud de cada lado, que es exactamente lo
  // que describe «va de aquí hasta allí». Si la cuerda fuera degenerada —un tramo
  // que vuelve sobre sí mismo— se conserva el rumbo del primer lado, que es el
  // único dato cierto que queda.
  const publicos = tramos.map((t) => {
    const cuerda =
      t.nLados === 1 ? t.azimutPrimero : azimut(anillo[t.indiceInicio], anillo[t.indiceFin])
    const az = cuerda === null ? t.azimutPrimero : cuerda
    const sinColindante = t.refcat === null && t.label === null
    return {
      cardinal: nombreCardinal(cuadrante(az)),
      azimut: az,
      longitud: t.longitud,
      refcat: t.refcat,
      label: t.label,
      indiceInicio: t.indiceInicio,
      indiceFin: t.indiceFin,
      nLados: t.nLados,
      presuncionNoVerificada:
        proponerViaPublica && sinColindante ? PRESUNCION.VIA_PUBLICA : null,
    }
  })

  const longitudTotal = publicos.reduce((s, t) => s + t.longitud, 0)

  return salida({
    tramos: publicos,
    saltados,
    consultadas,
    nVecinas: listaVecinas.length,
    nVecinasSinGeometria,
    nVertices: n,
    arranque: anillo[inicio],
    nHuecos,
    longitudTotal,
    clase,
  })
}
